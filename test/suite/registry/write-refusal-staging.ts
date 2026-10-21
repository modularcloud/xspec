// TEST-SPEC T13.5-7 / T14-9 — the write-refusal stagings (a)–(h) and the
// choreography that applies them while a mutating command is held at the
// seam of SPEC 13.5, shared by T13.5-7 (the per-command states a refused
// write leaves; section-13.5.ts), T14-9 (the 14.24 contract; section-14),
// and T13.5-11(a) (release after each of T13.5-7's refused writes but
// (b)'s; section-13.5-iii.ts, which stages them through the fixtures,
// pre-invocation stagings, appliers, and constants exported here).
//
// Staging discipline (TEST-SPEC T14-9, E-1): an environment refusal is staged
// by permission removal alone through helpers/permissions.ts — the directory
// holding the concerned path made read-only and its occupant, where one
// exists, unwritable — so creation, replacement in place or by renaming,
// appending, and removal are all refused whatever write strategy the product
// uses — a graph-data write by T14-9's graph-data staging (`graphDataRefusal`:
// `.xspec` itself and every directory of T13.3-2's operational path set
// read-only and every file of it unwritable, whatever layout graph data
// takes, the journal, the session directory, and the lock path keeping their
// modes); each staging verifies itself on the harness's own process before the
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
// where 13.5 leaves an order unpinned (a regeneration's or a `build`'s
// derived-file writes) `assertEachWriteComplete` asserts the weaker law
// path by path — each file present afterwards byte-equal either to its
// bytes before the invocation or to the twin's file at that path, none
// partial (TEST-SPEC T13.5-7 (f)), and a path holding nothing afterwards
// holding nothing before or in the twin. `check`'s expected staleness set is
// computed by comparison (`derivedPathsDifferingFrom`, `graphDataDiffers`):
// with a build twin of the same edit where no operation ran (TEST-SPEC
// T13.5-7 (e), (f)), and, for the state an operation stopped before its
// journal append leaves — (b)'s rename at the append, (g)'s section move at
// its created target file — with a `build` on a copy of that state,
// permissions restored (`stalenessAgainstRebuiltCopy`) — never with the
// twin's post-operation derived files, the twin's journal holding the entry
// the stopped state lacks (SPEC 13.4: derived files are reproducible from
// sources, configuration, and the journal, 5.4). T13.3-5 (b) and (c)
// (section-13.3.ts) compute their sets with these helpers too: (b) against
// a twin on which `build` ran once a source was added, (c) against a
// `build` on a copy of a state whose journal was deleted by hand — both
// judged by `assertStalenessAlone`.
//
// Product-chosen names are compared by their exact bytes: a companion's
// suffix is the product's choice (SPEC 13.1), so a derived path under
// `specs/b/` may hold any bytes, and a reported path is a plain string when
// its bytes are valid UTF-8 and the marked byte form otherwise, paths
// comparing byte-wise (SPEC 12.0, 12.7). The admissible concerned paths of
// `expectWriteFailure` and the expected per-file paths of
// `assertStalenessAlone` are snapshot keys (helpers/snapshot.ts: a path's
// exact bytes, one latin1 character per byte — an ASCII constant is its own
// key), each compared with the reported path value byte for byte
// (`snapshotKeyBytes` against `pathValueBytes`), never as strings; a
// diagnosis renders a key with `displaySnapshotPath` and a reported path
// with `renderPathValue`.
//
// Every arm starts from a freshly built, valid, journal-bearing workspace
// with no refresh pending (`prepareRefusalWorkspace`): `build`, then a prior
// journaled rename (SPEC 6.1: the journal comes into existence with the first
// journaled operation — `build` need not create it), then `check` clean,
// then a git commit serving as the `impact --base` baseline of the recovery
// assertions (6.3, 6.7); an arm's own staging follows, on its twin alike
// (H-6) — (c)'s rename, on the rename fixture's emitted-Markdown variant,
// deleting `out/specs/b/B.md` so that its regeneration owes that file's
// creation, and (h), on the move fixture, disabling Markdown emission so
// that its regenerations owe `out/specs/A.md`'s removal; (g)'s section-move
// fixtures hold the empty target directory `specs/n` from the start. The
// fixtures deliberately leave CONF-CORE's in-scope shape
// (imports, a code group, Markdown emission): T13.5-7 and T14-9 are
// uncertified (CERTIFICATIONS.md §Exclusions).

import { Buffer } from "node:buffer";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import type {
  Finding,
  ImpactReport,
  PathValue,
  SessionStatusReport,
} from "../../helpers/adapters/index.js";
import {
  decodeFindingsReport,
  decodeImpactReport,
  decodeSessionStatusReport,
  isGraphDataKey,
  pathValueBytes,
  renderPathValue,
} from "../../helpers/adapters/index.js";
import {
  assertExitCode,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { excludingLockPath } from "../../helpers/lock-path.js";
import { killHeldRun } from "../../helpers/lock-staging.js";
import type { KilledRunTwin } from "../../helpers/lock-state.js";
import {
  assertLockDirectoryEntries,
  assertLockPathAbsent,
  assertLockPathAfterKill,
} from "../../helpers/lock-state.js";
import type { PermissionStaging } from "../../helpers/permissions.js";
import {
  stageGraphDataWriteRefusal,
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
  diffSnapshots,
  displaySnapshotPath,
  lockPathExclusion,
  snapshotDirectory,
  snapshotKeyBytes,
} from "../../helpers/snapshot.js";
import { stagedMdx } from "../../helpers/staged-mdx.js";
import { stagedTs } from "../../helpers/staged-ts.js";
import type {
  KilledGroup,
  ProductBinding,
  RunGuards,
  RunningProduct,
  RunResult,
} from "../../helpers/subprocess.js";
import {
  releaseHoldFile,
  rethrowHarnessError,
  runProduct,
  startProduct,
  summarizeResult,
} from "../../helpers/subprocess.js";
import { copyTreeBytes } from "../../helpers/tree-copy.js";
import type { WorkspaceDecl } from "../../helpers/workspace.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import {
  assertConditionCounts,
  assertFindingInstructsRebuilding,
  assertFindingLocated,
  assertSameJson,
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
 * rejection (the process exited first — its own hang guard's kill
 * included: the wait beside it carries no bound of its own, TEST-SPEC S-3)
 * into a diagnosed assertion failure (H-8). A harness error is never
 * converted: a run the capture limit killed
 * (`ProductRunOutputOverflowError`) or whose T6.5-22(a) check failed
 * (`HarnessEvaluationError`) propagates as itself (H-11).
 */
export async function awaitHoldFile(
  running: RunningProduct,
  absPath: string,
  context: string,
): Promise<void> {
  try {
    await running.waitForFile(absPath);
  } catch (error) {
    rethrowHarnessError(error);
    fail(
      `${context}: the mutating command must create the hold file at ` +
        `${absPath} immediately after acquiring workspace exclusivity and ` +
        `before modifying anything (SPEC 13.5) — ` +
        `${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Start `argv` under `--test-hold` in `workspace` — in a process group of
 * its own, so that a kill reaches every process the run started (TEST-SPEC
 * T13.5-3's exit-collection discipline, `RunningProduct.killGroup`) — await
 * its hold file, and lift the hold, deleting it: the start of T13.5-3's
 * past-the-hold kills and their twins, and of T13.5-7's kill arm. Resolves
 * with the run and the instant of its lift (`performance.now()`). A run
 * never holding fails diagnosed (H-8), its group killed first.
 */
export async function startHeldAndLift(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  holdName: string,
  context: string,
): Promise<{ readonly running: RunningProduct; readonly liftedAt: number }> {
  const hold = holdPathFor(workspace, holdName);
  const running = await startProduct(product, {
    cwd: workspace.root,
    argv: [...argv, "--test-hold", hold],
    processGroup: true,
  });
  try {
    await awaitHoldFile(running, hold, context);
    await releaseHoldFile(hold);
    return { running, liftedAt: performance.now() };
  } catch (error) {
    await running.killGroup().catch((kill: unknown) => {
      rethrowHarnessError(kill);
    });
    await releaseHoldFile(hold);
    throw error;
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

// The rename fixture (T13.5-7 (a), (b), (e), (f), and the kill arm; (c)'s
// rename through its emitted-Markdown variant below): one spec group with
// Markdown emitted beside each source, and a rename whose section lives in
// `specs/b/B.mdx`, referenced from `specs/a/A.mdx` (a `d` reference) and
// `specs/c/C.mdx` (an embedding) — the preview's `files` order by path bytes
// is A, B, C (SPEC 6.6, 12.7). The sources are staged
// under `b0`; the prior journaled rename `b0` → `b` leaves them under `b`, so
// the arms' rename is `b` → `b2`.
//
// The H-6 twin is always created after the original's `build`, and every arm
// after its body's first, so the `.mdx` sources of both fixtures are
// staged-source records (S-9's before-any-product clause;
// helpers/staged-mdx.ts) named with every test that prepares the fixture —
// T13.5-7, T13.5-11 (section-13.5-iii.ts, its (a) after each of T13.5-7's
// refused writes but (b)'s), and T14-9 and T14-10 (section-14-ii.ts; their
// `PRECEDENCE_FIXTURE` and `LISTING_FIXTURE` spread the rename fixture's
// files too) — and their configurations and code source are TypeScript
// staged-source records (helpers/staged-ts.ts; S-9's TypeScript and timing
// clauses), named likewise.
const RENAME_CONFIG = stagedTs(
  "T13.5-7/T13.5-11/T14-9/T14-10 the rename fixture xspec.config.ts (one spec group, Markdown emission next to sources)",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  markdown: { emit: true }
})
`,
);
const RENAME_A = stagedMdx(
  "T13.5-7/T13.5-11/T14-9/T14-10 the rename fixture specs/a/A.mdx (a d reference to b0)",
  [
    'import B from "../b/B.xspec"',
    "",
    '<S id="a" d={B.b0}>',
    "Alpha text.",
    "</S>",
    "",
  ].join("\n"),
);
const RENAME_B = stagedMdx(
  "T13.5-7/T13.5-11/T14-9/T14-10 the rename fixture specs/b/B.mdx (b0 holding b0.k)",
  [
    '<S id="b0">',
    "Beta text.",
    '<S id="b0.k">',
    "Kid text.",
    "</S>",
    "</S>",
    "",
  ].join("\n"),
);
const RENAME_C = stagedMdx(
  "T13.5-7/T13.5-11/T14-9/T14-10 the rename fixture specs/c/C.mdx (an embedding of b0)",
  [
    'import B from "../b/B.xspec"',
    "",
    '<S id="c">',
    "Ceta embeds: {text(B.b0)}",
    "</S>",
    "",
  ].join("\n"),
);

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

// The rename fixture's emitted-Markdown variant (T13.5-7 (c)'s rename stopped
// at a Markdown write, and T13.5-11 (a)'s release after that write failure):
// the same sources and prior rename under a configuration emitting Markdown
// under `outDir: "out"`, so a build leaves `out/specs/a/A.md`,
// `out/specs/b/B.md`, and `out/specs/c/C.md` (SPEC 13.2, 7.3) —
// `out/specs/b` holding B's alone. The arm deletes `out/specs/b/B.md` and
// stages `out/specs/b` unwritable at the hold, so the rename's finishing
// regeneration owes a write there, that file's creation, however it treats
// the emitted files whose content the rename leaves unchanged (a rename
// changes no Markdown, SPEC 3). The configuration is a TypeScript
// staged-source record (S-9; the arm's workspaces are created after the
// body's first invocation, in either test), named, as the rename fixture's
// records are, with each test that prepares the variant; the sources are
// the rename fixture's own records.
const RENAME_OUT_CONFIG = stagedTs(
  "T13.5-7/T13.5-11 the rename fixture's emitted-Markdown variant xspec.config.ts (one spec group, Markdown emission under outDir out)",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  markdown: { emit: true, outDir: "out" }
})
`,
);

/** The variant's emitted-Markdown directory for `specs/b/B.mdx` (SPEC 7.3). */
export const RENAME_OUT_MARKDOWN_DIR = "out/specs/b";
/** `specs/b/B.mdx`'s emitted Markdown under the variant (SPEC 13.2, 7.3). */
export const RENAME_OUT_MARKDOWN = "out/specs/b/B.md";

export const RENAME_OUT_FIXTURE: RefusalFixture = {
  decl: {
    files: {
      ...RENAME_FIXTURE.decl.files,
      "xspec.config.ts": RENAME_OUT_CONFIG,
    },
  },
  priorRename: RENAME_FIXTURE.priorRename,
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
const MOVE_CONFIG = stagedTs(
  "T13.5-7/T13.5-11/T14-9 the move fixture xspec.config.ts (spec groups specs/** and docs/**, code group src/**/*.ts, Markdown emission under outDir out)",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx", "docs/**/*.mdx"]
  },
  code: {
    app: ["src/**/*.ts"]
  },
  markdown: { emit: true, outDir: "out" }
})
`,
);
const MOVE_OTHER = stagedMdx(
  "T13.5-7/T13.5-11/T14-9 the move fixture docs/Other.mdx (oth0)",
  ['<S id="oth0">', "Other text.", "</S>", ""].join("\n"),
);
const MOVE_A = stagedMdx(
  "T13.5-7/T13.5-11/T14-9 the move fixture specs/A.mdx (importing docs/Other.mdx, a d reference to oth0)",
  [
    'import Other from "../docs/Other.xspec"',
    "",
    '<S id="a" d={Other.oth0}>',
    "Alpha text.",
    "</S>",
    "",
  ].join("\n"),
);
const MOVE_APP = stagedTs(
  "T13.5-7/T13.5-11/T14-9 the move fixture src/app.ts (the importer of specs/A.mdx's module whose specifier the move rewrites)",
  ['import A from "../specs/A.xspec";', "", "A.a;", ""].join("\n"),
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

// The section-move fixtures (T13.5-7 (g): a created target file is a source
// edit, made in its `files` place; T13.5-11 (a)'s release after that write
// failure, in either byte order): one spec group and one spec source
// holding `a` and `x`, a top-level section nothing references, with
// `specs/n` an empty directory from the start (the declaration's `dirs`),
// so `move <origin>#x specs/n/N.mdx#x` creates the target file
// `specs/n/N.mdx` (SPEC 6.5: at a target path nothing occupies, the target
// file is created) — two source edits, one write per file the operation
// rewrites or creates, in the order the preview's `files` lists them, by
// path bytes (13.5, 6.6, 12.7). The two workspaces differ in the origin's
// path alone: `specs/a/A.mdx`, listed before the created file, so that the
// origin's edit is the run's first write, and `specs/z/Z.mdx`, listed after
// it, so that the creation is. The source is staged under `a0`; the prior
// journaled rename `a0` → `a` makes each workspace journal-bearing (6.1).
// Every workspace of the arm is created after the body's first invocation,
// in either test, so the configuration and the source are staged-source
// records named with both (S-9; one record per byte sequence, the origin's
// at either path).
const SECTION_MOVE_CONFIG = stagedTs(
  "T13.5-7/T13.5-11 the section-move fixtures' xspec.config.ts (one spec group)",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
);
const SECTION_MOVE_ORIGIN_SOURCE = stagedMdx(
  "T13.5-7/T13.5-11 the section-move fixtures' origin, specs/a/A.mdx or, the byte order reversed, specs/z/Z.mdx (a0, and x, a top-level section nothing references)",
  [
    '<S id="a0">',
    "Alpha text.",
    "</S>",
    "",
    '<S id="x">',
    "Ex text.",
    "</S>",
    "",
  ].join("\n"),
);

/** The empty directory the section move's target file is created in. */
export const SECTION_MOVE_TARGET_DIR = "specs/n";
/** The target file the section move creates (SPEC 6.5). */
export const SECTION_MOVE_TARGET = "specs/n/N.mdx";

/**
 * One of T13.5-7 (g)'s two byte orders: the workspace whose origin holds
 * `x`, the top-level section nothing references, and the section move of
 * `x` into the created target file `specs/n/N.mdx` (SPEC 6.5).
 */
export interface CreatedTargetOrder {
  /** The origin spec source. */
  readonly origin: string;
  /** The origin's generated module, beside it (SPEC 13.1). */
  readonly originModule: string;
  /**
   * Whether the preview's `files` lists the origin before the created file
   * — by path bytes (SPEC 6.6, 12.7) — so that the origin's edit, and not
   * the creation, is the run's first write (13.5).
   */
  readonly originFirst: boolean;
  readonly fixture: RefusalFixture;
  /** `move <origin>#x specs/n/N.mdx#x` (SPEC 6.5). */
  readonly argv: readonly string[];
  /** The `--test-hold` file's name, beside the workspace root. */
  readonly holdName: string;
}

function createdTargetOrder(
  origin: string,
  holdName: string,
): CreatedTargetOrder {
  return {
    origin,
    originModule: origin.replace(/\.mdx$/, ".xspec.ts"),
    originFirst:
      Buffer.compare(
        Buffer.from(origin, "utf8"),
        Buffer.from(SECTION_MOVE_TARGET, "utf8"),
      ) < 0,
    fixture: {
      decl: {
        files: {
          "xspec.config.ts": SECTION_MOVE_CONFIG,
          [origin]: SECTION_MOVE_ORIGIN_SOURCE,
        },
        dirs: [SECTION_MOVE_TARGET_DIR],
      },
      priorRename: ["rename", origin, "a0", "a"],
    },
    argv: ["move", `${origin}#x`, `${SECTION_MOVE_TARGET}#x`],
    holdName,
  };
}

/**
 * T13.5-7 (g)'s two byte orders: the origin `specs/a/A.mdx` before the
 * created `specs/n/N.mdx` in `files`, then `specs/z/Z.mdx` after it — the
 * refused creation then the run's first write.
 */
export const CREATED_TARGET_ORDERS: readonly CreatedTargetOrder[] = [
  createdTargetOrder("specs/a/A.mdx", "hold-g.tmp"),
  createdTargetOrder("specs/z/Z.mdx", "hold-g-reversed.tmp"),
];

// (h)'s staging on the move fixture (T13.5-7 (h): a removal owed alone;
// T13.5-11 (a)'s release after that write failure, for `build` and for the
// rename): once the workspace is prepared — built under `markdown: { emit:
// true, outDir: "out" }`, `out/specs` holding `A.md` alone and
// `docs/Other.mdx` emitting under `out/docs` — emission is disabled by
// rewriting the configuration with `markdown` removed, so that a
// regeneration owes nothing under `out/specs` but the removal of
// `out/specs/A.md`, a recorded derived file the current configuration no
// longer generates (SPEC 12.1, 13.4, 7.3). The configuration is written
// after the body's first invocation, in either test, so it is a TypeScript
// staged-source record named with both (S-9).
const MOVE_UNEMITTED_CONFIG = stagedTs(
  "T13.5-7/T13.5-11 the move fixture's xspec.config.ts with emission disabled (spec groups specs/** and docs/**, code group src/**/*.ts, markdown removed)",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx", "docs/**/*.mdx"]
  },
  code: {
    app: ["src/**/*.ts"]
  }
})
`,
);

/**
 * `specs/A.mdx`'s emitted Markdown under the move fixture: recorded, and no
 * longer generated once emission is disabled — the one write (h)'s
 * regenerations owe under `out/specs`, its removal (SPEC 12.1, 13.4).
 */
export const ORPHANED_MARKDOWN = "out/specs/A.md";
/**
 * (h)'s rename of `specs/A.mdx`'s section `a` (SPEC 6.4), rewriting its
 * `id` attribute and its importer `src/app.ts`'s marker.
 */
export const ORPHAN_RENAME_ARGV: readonly string[] = [
  "rename",
  MOVE_ORIGIN,
  "a",
  "a2",
];

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

/**
 * The graph-data area or anything beneath it (SPEC 11.6, 13.3) — the
 * transient lock path included, which lies in the area though it is no
 * graph data (13.4), so no derived scope below ever holds it.
 */
export function isAreaPath(rel: string): boolean {
  return rel === GRAPH_DATA_AREA || rel.startsWith(`${GRAPH_DATA_AREA}/`);
}

/**
 * Graph data: the area itself and T13.3-2's operational path set beneath it
 * (`isGraphDataKey`) — the area minus its durable occupants, journal and
 * sessions, and minus the transient lock path with everything under it
 * (SPEC 13.4: no graph data, bearing on no comparison of graph data).
 */
export function isGraphDataPath(rel: string): boolean {
  return rel === GRAPH_DATA_AREA || isGraphDataKey(rel);
}

/** A source of every fixture: the configuration, spec sources, code sources. */
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
 * write attempted). Each entry is compared under H-6's lock-path exclusion
 * of its pair (helpers/snapshot.ts `lockPathExclusion`): against the twin's
 * state, a comparison across workspaces, the lock path is left out; against
 * the pre-invocation state, the lock path of the mutating command's run that
 * acted between the two snapshots is — acquisition's and release's writes
 * there count as no modification, and a residue a refused release deletion
 * leaves there is T13.5-7's own assertion (13.5).
 */
export function assertPinnedState(
  before: DirectorySnapshot,
  after: DirectorySnapshot,
  twinAfter: DirectorySnapshot,
  completed: readonly string[],
  context: string,
): void {
  const completedSet = new Set(completed);
  const againstTwin = lockPathExclusion(after, twinAfter);
  const againstBefore = lockPathExclusion(before, after);
  for (const key of unionKeys(before, after, twinAfter)) {
    const isCompleted = completedSet.has(key);
    if ((isCompleted ? againstTwin : againstBefore).excludes(key)) continue;
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
 * or a `build`'s derived-file writes, graph data's included — derived files,
 * 13.4; TEST-SPEC T13.5-7 (c), its rename, (f), and (h)'s `build` and
 * rename), judged path by path
 * over `scope`: every file present afterwards is complete — byte-equal
 * either to its bytes before the invocation or to the twin's file at that
 * path, the one or the other required, never a partial write and never
 * content neither holds (12.1, 13.5) — and a path holding nothing afterwards
 * held nothing before the invocation or holds nothing in the twin (13.5: a
 * path xspec writes holds its prior state, absence included, or its
 * complete new content, a removal's absence included); a directory is
 * compared by its kind. H-6's lock-path exclusion of either pair leaves an
 * entry out (as in `assertPinnedState`; no scope here reaches the lock
 * path, which is neither a derived file nor graph data, 13.4).
 */
export function assertEachWriteComplete(
  before: DirectorySnapshot,
  after: DirectorySnapshot,
  twinAfter: DirectorySnapshot,
  scope: (rel: string) => boolean,
  context: string,
): void {
  const againstTwin = lockPathExclusion(after, twinAfter);
  const againstBefore = lockPathExclusion(before, after);
  for (const key of unionKeys(before, after, twinAfter)) {
    if (!scope(key)) continue;
    if (againstTwin.excludes(key) || againstBefore.excludes(key)) continue;
    const actual = after.entries.get(key);
    if (sameEntry(actual, before.entries.get(key))) continue;
    if (sameEntry(actual, twinAfter.entries.get(key))) continue;
    fail(
      `${context}: ${key} must hold either its state before the invocation ` +
        `or the twin's at that path — each write complete, never partial, ` +
        `never content neither holds (SPEC 12.1, 13.5); before ` +
        `${renderEntry(before.entries.get(key))}, the twin's ` +
        `${renderEntry(twinAfter.entries.get(key))}, found ` +
        renderEntry(actual),
    );
  }
}

/**
 * Derived paths whose occupant differs from a reference state's — a build
 * twin's (T13.5-7 (e), (f); T13.3-5 (b), a twin on which `build` ran once a
 * source was added) or a rebuilt copy's (`stalenessAgainstRebuiltCopy`) —
 * absent on one side included, as snapshot keys (`assertStalenessAlone`'s
 * `perFile` form). The caller leaves out what no `build` writes and no
 * comparison of derived files concerns, such as the harness's own `.git`.
 */
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

/**
 * Whether graph data differs from a reference state's — a build twin's or a
 * rebuilt copy's (the 14.10 unit form's premise).
 */
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

/** What `check` must find stale on a state (`stalenessAgainstRebuiltCopy`). */
export interface RebuiltCopyStaleness {
  /**
   * Every derived path at which the state's occupant differs from the one
   * a `build` leaves on a copy of it, absent on one side included, as
   * snapshot keys (`assertStalenessAlone`'s `perFile` form).
   */
  readonly perFile: readonly string[];
  /** Whether graph data differs from the rebuilt copy's (the unit form's premise). */
  readonly graphDataDiffers: boolean;
}

/**
 * A state's staleness by comparison with a `build` on a copy of it,
 * permissions restored (TEST-SPEC T13.5-7 (b), a rename stopped at its
 * journal append; (g), a section move stopped at its created target file,
 * and T13.3-5 (c) compute their sets "as T13.5-7(b) does"): the state
 * `workspace` holds is copied into a fresh workspace (helpers/tree-copy.ts
 * `copyTreeBytes`) — every entry of the root but the harness's own `.git`
 * and the lock path, transient and bearing on no comparison of derived
 * files or graph data (SPEC 13.4; H-6) — and the copy, checked against the
 * original before anything runs there (a difference is a harness error,
 * never a product verdict), is built: exit 0 required — the caller's state
 * is valid, so a `build` succeeds there (SPEC 12.1), a diagnosed failure
 * naming the copy's findings otherwise. `perFile` is then every derived
 * path at which the state's occupant differs from the rebuilt copy's,
 * compared byte for byte over the paths either tree holds
 * (`derivedPathsDifferingFrom`), and `graphDataDiffers` whether graph data
 * differs (`graphDataDiffers`). Never a twin's post-operation derived
 * files: a twin that completed the operation holds the journal entry a
 * state stopped before the append lacks, and derived files are
 * reproducible from sources, configuration, and the journal (SPEC 13.4,
 * 5.4), so only a `build` of this very state says what is stale on it —
 * whether generated content depends on the journal is never assumed. The
 * caller restores every staging first (the copy carries each entry's
 * mode); the copy is disposed whatever happens.
 */
export async function stalenessAgainstRebuiltCopy(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
): Promise<RebuiltCopyStaleness> {
  const options = excludingLockPath({ exclude: excludeGitTree });
  const stopped = await snapshotDirectory(workspace.root, options);
  const copy = await TestWorkspace.create();
  try {
    await copyTreeBytes(
      Buffer.from(workspace.root),
      Buffer.from(copy.root),
      options.exclude,
    );
    const differences = diffSnapshots(
      stopped,
      await snapshotDirectory(copy.root, options),
    );
    if (differences.length > 0) {
      throw new Error(
        `harness error: ${context}: the copy of ${workspace.root} at ` +
          `${copy.root} differs from it (\`.git\` and the lock path aside): ` +
          differences
            .slice(0, 10)
            .map((change) => `${change.change} ${change.path}`)
            .join(", "),
      );
    }
    await buildOk(
      product,
      copy,
      `${context}: \`build\` on a copy of this state, permissions restored — ` +
        `the workspace is valid, so the build succeeds, leaving what the ` +
        `current sources, configuration, and journal generate (SPEC 12.1, ` +
        `13.4)`,
    );
    const rebuilt = await snapshotDirectory(copy.root, options);
    return {
      perFile: derivedPathsDifferingFrom(stopped, rebuilt),
      graphDataDiffers: graphDataDiffers(stopped, rebuilt),
    };
  } finally {
    await copy.dispose();
  }
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

/**
 * T14-9's area-form discipline beneath a workspace-relative directory (the
 * derived files under `specs/b/`, emitted Markdown under `out/specs`, a
 * relocation's directory) — never the graph-data area, whose writes take
 * {@link graphDataRefusal}.
 */
export function refusalUnder(rel: string): StagingApplier {
  return async (root) => await stageWriteRefusalUnder(path.join(root, rel));
}

/**
 * T14-9's graph-data staging (helpers/permissions.ts
 * `stageGraphDataWriteRefusal`), wherever a test refuses a graph-data write
 * by staging `.xspec` unwritable: `.xspec` itself and every directory of
 * T13.3-2's operational path set read-only and every file of it unwritable,
 * so every graph-data write is refused whatever layout graph data takes,
 * the journal, the session directory, and the lock path keeping their
 * modes — each staging verified on the harness itself (E-1).
 */
export function graphDataRefusal(): StagingApplier {
  return async (root) => await stageGraphDataWriteRefusal(root);
}

/**
 * Run a command to completion under a hang guard (never an assertion input,
 * H-10), converting a rejection — a product that blocks or hangs, killed at
 * the bound — into a diagnosed failure (H-8). A harness error — an
 * exhausted capture limit, a failure of the driver's in-run evaluation
 * (T6.5-22(a)'s check) — is never converted: it propagates as itself
 * (H-11). `guards` lower the bound or the capture limit for S-8's vector
 * alone.
 */
export async function runSettled(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  context: string,
  guards: RunGuards = {},
): Promise<RunResult> {
  try {
    return await runProduct(product, {
      cwd: workspace.root,
      argv,
      timeoutMs: guards.timeoutMs ?? 30_000,
      maxOutputBytes: guards.maxOutputBytes,
    });
  } catch (error) {
    rethrowHarnessError(error);
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
 * whatever happens (a `HarnessStagingError` from `apply` included). A
 * rejected run fails diagnosed (H-8), except a harness error — an exhausted
 * capture limit, a failure of the driver's in-run evaluation (T6.5-22(a)'s
 * check) — which propagates as itself (H-11). `guards` lower the hang guard
 * or the capture limit for S-8's vector alone.
 */
export async function runHeldWithStaging(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  holdName: string,
  apply: StagingApplier,
  context: string,
  guards: RunGuards = {},
): Promise<RunResult> {
  const hold = holdPathFor(workspace, holdName);
  const running = await startProduct(product, {
    cwd: workspace.root,
    argv: [...argv, "--test-hold", hold],
    timeoutMs: guards.timeoutMs,
    maxOutputBytes: guards.maxOutputBytes,
  });
  let staging: PermissionStaging | undefined;
  try {
    await awaitHoldFile(running, hold, context);
    staging = await apply(workspace.root);
    await releaseHoldFile(hold);
    try {
      return await running.waitForExit();
    } catch (error) {
      rethrowHarnessError(error);
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

/**
 * Nothing at `.xspec/lock` once a staged command has ended (TEST-SPEC
 * T13.5-7: every arm but (b), whose read-only `.xspec` keeps the emptied
 * lock directory, ends with `.xspec/lock` absent; T13.5-11). `acquiring`: a
 * mutating command, whose release — no staging covering `.xspec`, the lock
 * directory's parent — deletes its entry, then the emptied lock directory;
 * otherwise `build` or a refreshing read, which acquires nothing, no write
 * but acquisition and release touching the lock path (SPEC 13.5, 13.4).
 */
async function assertNoLockPathAfter(
  workspace: TestWorkspace,
  acquiring: boolean,
  context: string,
): Promise<void> {
  await assertLockPathAbsent(
    workspace.root,
    acquiring
      ? `${context}: once it has ended — no staging covers \`.xspec\`, the ` +
          `lock directory's parent, so its release deletes its entry, then ` +
          `the emptied lock directory, a stop never withholding either ` +
          `deletion (SPEC 13.5, 14.24; T13.5-11)`
      : `${context}: it acquires nothing (SPEC 13.5: \`build\` and the ` +
          `reads take no exclusivity), and no write but acquisition and ` +
          `release touches the lock path (13.4)`,
  );
}

// ---------------------------------------------------------------------------
// The 14.24 contract and the states `check` reports
// ---------------------------------------------------------------------------

/** 14.24's stable code, carried only by the exit-2 error document (SPEC 14). */
export const WRITE_FAILURE_CODE = "write-failure";

/**
 * The exact bytes of an expected path given as a snapshot key
 * (`snapshotKeyBytes`). A string holding a character above U+00FF is no key
 * — a key holds one latin1 character per byte — so it is refused as harness
 * misuse, a plain `Error` (H-11), never a diagnosed failure: a non-ASCII
 * path enters as the key a snapshot gives it, never as UTF-8 path text.
 */
function expectedPathBytes(key: string): Buffer {
  for (const char of key) {
    if ((char.codePointAt(0) ?? 0) > 0xff) {
      throw new Error(
        `write-refusal-staging: ${JSON.stringify(key)} is no snapshot key ` +
          `(it holds a character above U+00FF); pass a non-ASCII path as ` +
          `the key a snapshot gives it`,
      );
    }
  }
  return snapshotKeyBytes(key);
}

/** Path values in bytewise order, a `null` path first. */
function comparePathValues(a: PathValue | null, b: PathValue | null): number {
  if (a === null || b === null) {
    return (a === null ? 0 : 1) - (b === null ? 0 : 1);
  }
  return Buffer.compare(pathValueBytes(a), pathValueBytes(b));
}

/**
 * A refused write's contract (SPEC 14.24, 12.0, 12.7; T13.5-7, T14-9): exit
 * 2; the error document as the entire stdout; its finding's stable code
 * `write-failure`; its `path` one of the admissible concerned paths — the
 * workspace-relative path of the file the write would have produced or
 * removed (or the graph-data area for a graph-data write).
 *
 * `concerned` holds snapshot keys — an ASCII constant is its own key; a
 * non-ASCII path, such as a companion whose suffix the product chose (SPEC
 * 13.1), enters as the key a snapshot gives it — and the reported path
 * matches one when its exact bytes (`pathValueBytes`: a plain string's
 * UTF-8, the marked byte form's decoded bytes) equal the key's (SPEC 12.7:
 * paths compare byte-wise). A `null` path matches none.
 */
export function expectWriteFailure(
  result: RunResult,
  concerned: readonly string[],
  context: string,
): Finding {
  const admissible = concerned.map(expectedPathBytes);
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
  const reported = finding.path;
  if (
    reported === null ||
    !admissible.some((bytes) => bytes.equals(pathValueBytes(reported)))
  ) {
    const shown = concerned.map(displaySnapshotPath);
    fail(
      `${context} — the concerned path is the workspace-relative path of ` +
        `the file the refused write would have produced or removed: ` +
        `${shown.length === 1 ? JSON.stringify(shown[0]) : `one of ${JSON.stringify(shown)}`} ` +
        `(SPEC 14.24, 12.7; paths compare byte-wise); got ` +
        `${JSON.stringify(renderPathValue(reported))} (message: ` +
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
  /**
   * Exactly the derived paths reported in the per-file form, as snapshot
   * keys (an ASCII constant is its own key; a non-ASCII path enters as the
   * key a snapshot gives it), compared with the reported paths by bytes.
   */
  readonly perFile: readonly string[];
  /** Whether the graph-data unit form (concerning the area) is reported. */
  readonly unit: boolean;
}

/**
 * `check` reports condition 10 alone, in exactly the expected forms: one
 * per-file finding per expected derived path, concerning it, and the unit
 * form — concerning the graph-data area — exactly when expected (SPEC 14.10,
 * 12.7, 11.6). The per-file compare is order-insensitive and by exact bytes:
 * the reported paths (`pathValueBytes`) and the expected keys
 * (`snapshotKeyBytes`) must be the same multiset of byte strings (SPEC 12.7:
 * paths compare byte-wise); a `null` path matches no expected path. Once
 * the findings are condition 10 alone and concern exactly the expected
 * paths, every finding instructs rebuilding
 * (`assertFindingInstructsRebuilding`: its message names `build`), the
 * correction SPEC 14.10 requires of each per-file finding and of the unit
 * form. Every caller's state keeps each recorded derived file among the
 * paths the current sources and configuration generate — T13.5-7 (b) a
 * rename's identity change, (d) a relocation whose origin stays, (e) and
 * (f) a text edit, (g) a section removed from a file that stays, T14-10 (e)
 * and (f) a refused read, T13.3-5 (b) a source added and (c) a journal
 * deleted — so no recorded file obstructs a rebuild
 * write: the one condition-10 form whose correction is its manual deletion
 * instead (SPEC 14.10, 13.4, 14.22; T13.4-10's judge), never this helper's.
 */
export function assertStalenessAlone(
  findings: readonly Finding[],
  expected: StalenessExpectation,
  context: string,
): void {
  const expectedBytes = expected.perFile.map(expectedPathBytes);
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
  // Both sides in bytewise order (a `null` path first), compared element by
  // element: equal exactly when they are the same multiset of byte strings.
  const perFile = findings
    .map((finding) => finding.path)
    .filter((value) => value !== GRAPH_DATA_AREA)
    .sort(comparePathValues);
  const expectedPerFile = [...expectedBytes].sort(Buffer.compare);
  if (
    perFile.length !== expectedPerFile.length ||
    perFile.some(
      (value, index) =>
        value === null ||
        !pathValueBytes(value).equals(expectedPerFile[index]!),
    )
  ) {
    fail(
      `${context}: the per-file condition-10 findings must name exactly the ` +
        `derived paths whose occupant differs from what the current sources ` +
        `and configuration generate — one finding per path, concerning it ` +
        `(SPEC 14.10, 12.7; paths compare byte-wise); expected ` +
        `${JSON.stringify([...expected.perFile].sort().map(displaySnapshotPath))}, ` +
        `got ${JSON.stringify(perFile.map(renderPathValue))}`,
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
  for (const finding of findings) {
    assertFindingInstructsRebuilding(
      finding,
      `${context} — the finding concerning ` +
        `${renderPathValue(finding.path)}: no recorded file obstructs a ` +
        `rebuild write on this state, so every condition-10 finding, per ` +
        `file and unit form alike, instructs rebuilding (SPEC 14.10, 14)`,
    );
  }
}

/**
 * The concern and the correction of every finding a `check` reporting
 * condition 10 alone gives (SPEC 14.10, 14, 12.7): each condition-10
 * finding — a per-file finding (a missing or mismatched derived file, or a
 * recorded derived file the current sources and configuration no longer
 * generate) or the graph-data unit form — has no in-source location and
 * carries the derived path (or the graph-data area) it concerns as its 12.7
 * `path`: `path` non-null, `locations` `[]`; and it instructs rebuilding
 * (`assertFindingInstructsRebuilding`: its message names `build`), the
 * correction SPEC 14.10 requires of each such finding. The caller asserts
 * the findings are condition 10 alone, on a state holding no recorded file
 * that obstructs a rebuild write — the one condition-10 form whose
 * correction is its manual deletion instead (SPEC 14.10, 13.4, 14.22;
 * T13.4-10's judge). Shared by T13.5-7 (c)'s `check` (`afterAppendArm`) and
 * the never-reporter `check` of T13.5-7 (f) and T14-9
 * (`assertEditedBStalenessConcerns`).
 */
function assertStaleFindingsConcernAndCorrection(
  findings: readonly Finding[],
  context: string,
): void {
  for (const finding of findings) {
    if (finding.path === null) {
      fail(
        `${context}: a condition-10 finding has no in-source location and ` +
          `carries the derived path (or the graph-data area) it concerns ` +
          `as its 12.7 \`path\`; got null (message: ` +
          `${JSON.stringify(finding.message)}) (SPEC 14.10, 14, 12.7)`,
      );
    }
    assertSameJson(
      finding.locations,
      [],
      `${context} — a condition-10 finding has no in-source location: ` +
        `\`locations\` [] (SPEC 14.10, 14, 12.7)`,
    );
    assertFindingInstructsRebuilding(
      finding,
      `${context} — the finding concerning ` +
        `${renderPathValue(finding.path)}: no recorded file obstructs a ` +
        `rebuild write on this state, so every condition-10 finding, per ` +
        `file and unit form alike, instructs rebuilding in its 12.7 ` +
        `\`message\` (SPEC 14.10, 14, 12.7)`,
    );
  }
}

/**
 * A never-reporter `check`'s staleness on the B-edited workspace — T13.5-7
 * (f)'s refreshing-read state and T14-9's reporter-set state, each a built
 * workspace whose `specs/b/B.mdx` text was edited without rebuilding, with
 * `.xspec` unwritable by T14-9's graph-data staging (SPEC 14.10, 14, 12.7):
 * every condition-10 finding — a per-file finding or the graph-data unit
 * form — has no in-source location and carries the derived path (or the
 * graph-data area) it concerns as its 12.7 `path`: `path` non-null,
 * `locations` `[]`; and
 * every finding instructs rebuilding (`assertFindingInstructsRebuilding`:
 * its message names `build`), the correction SPEC 14.10 requires of each
 * per-file finding and of the unit form — the staging is a text edit of a
 * valid built workspace and the findings are condition 10 alone, so no
 * recorded file obstructs a rebuild write (that would be 14.22's, reported
 * beside; 13.4), the one form whose correction is its manual deletion
 * instead (both through `assertStaleFindingsConcernAndCorrection`). B's
 * generated module `specs/b/B.xspec.ts`, whose node documentation embeds
 * the edited text (SPEC 4.2, 13.1; TEST-SPEC T13.5-7 (f): B's module and
 * companions certainly differ), is among the concerned paths, compared by
 * bytes. Which further derived files differ is the product's (companions,
 * 13.1; graph data, 13.3), so membership alone — the shape of T12.2-2's
 * edited-source arm. The caller asserts the findings are condition 10
 * alone.
 */
export function assertEditedBStalenessConcerns(
  findings: readonly Finding[],
  context: string,
): void {
  assertStaleFindingsConcernAndCorrection(findings, context);
  const moduleBytes = expectedPathBytes(RENAME_B_MODULE);
  const named = findings.some(
    (finding) =>
      finding.path !== null && pathValueBytes(finding.path).equals(moduleBytes),
  );
  if (!named) {
    fail(
      `${context}: B's generated module ${RENAME_B_MODULE} embeds the ` +
        `edited text in its node documentation, so it no longer matches ` +
        `what the current sources generate and a per-file finding ` +
        `concerning it is among the findings (SPEC 14.10, 14, 12.7, 4.2, ` +
        `13.1; paths compare byte-wise); got the paths ` +
        JSON.stringify(
          findings.map((finding) => renderPathValue(finding.path)),
        ),
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

/**
 * A journaled operation changing no content is pure — T13.5-7 (c)'s file
 * move and its rename alike, each stopped after the append: no change
 * categories, no impacted code (SPEC 6.2).
 */
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
      `${context}: a journaled operation — a file move or a rename — ` +
        `produces no change categories relative to the pre-operation ` +
        `baseline — the identity effect is observable through the ` +
        `journal's effects alone (SPEC 6.2, 6.4, 13.5); got ` +
        JSON.stringify(report),
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
// T13.5-7's arms (TEST-SPEC T13.5-7 (a)–(h) and the kill arm)
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
    await assertNoLockPathAfter(workspace, true, context);
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
 * concerns `.xspec/journal`; `check` reports condition 10 alone — the
 * graph-data unit form and one per-file finding for each derived path
 * whose occupant differs from the one a `build` leaves on a copy of this
 * state, permissions restored (`stalenessAgainstRebuiltCopy`; B's module
 * certainly among them, SPEC 4.1), never computed from the twin's
 * post-operation derived files, the twin's journal holding the entry this
 * state lacks (13.4, 5.4); once restored, `impact --base <pre-rename ref>`
 * reports the old identity deleted and the new one added (manual
 * restructuring, 6.7) and the next `build` leaves `check` clean. Release
 * meets the staging too: the read-only `.xspec` refuses the deletion of the
 * emptied lock directory, which remains, empty — no outcome changed, no
 * write failure reported (13.5, 14.24) — until a mutating command run once
 * the permissions are restored proceeds unrefused and removes it
 * (T13.5-11).
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
    // Release, refused at the lock directory (the staging restored by now):
    // the run's entry deleted, the read-only `.xspec` refusing the deletion
    // of the emptied lock directory — a residue changing no outcome, no
    // write failure reported, the error document above concerning the
    // journal alone (SPEC 13.5, 14.24).
    await assertLockDirectoryEntries(
      workspace.root,
      { entries: 0 },
      `${context}: release's residue — the run's entry deleted, the read-only ` +
        `\`.xspec\` refusing the deletion of the emptied lock directory, ` +
        `which remains, empty, no outcome changed and no write failure ` +
        `reported (SPEC 13.5: a deletion the environment refuses changes no ` +
        `outcome and is no write failure; 14.24)`,
    );
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
    // The expected per-file set: what a `build` on a copy of this state,
    // permissions restored, leaves — never the twin's derived files, the
    // twin's journal holding the entry this state lacks (SPEC 13.4, 5.4).
    const expected = await stalenessAgainstRebuiltCopy(
      product,
      workspace,
      context,
    );
    if (!expected.perFile.includes(RENAME_B_MODULE)) {
      fail(
        `${context}: B's generated module ${RENAME_B_MODULE} must differ ` +
          `from the one a \`build\` leaves on a copy of this state — its ` +
          `nodes' properties are named by ID segment (SPEC 4.1) and the ` +
          `rename made \`b\` \`b2\` — so it is certainly among the stale ` +
          `derived paths; differing: ` +
          JSON.stringify(expected.perFile.map(displaySnapshotPath)),
      );
    }
    if (!expected.graphDataDiffers) {
      fail(
        `${context}: graph data must differ from the graph data a \`build\` ` +
          `leaves on a copy of this state — it carries the identities the ` +
          `rename changed (SPEC 13.3) — so the unit form is certainly ` +
          `reported; found it byte-identical`,
      );
    }
    assertStalenessAlone(
      await checkFindings(product, workspace, context),
      { perFile: expected.perFile, unit: true },
      `${context}: \`check\` after the refused append — condition 10 alone: ` +
        `the graph-data unit form (graph data no longer matches the ` +
        `rewritten sources, SPEC 13.3) and one per-file finding for each ` +
        `derived path whose occupant differs from the one a \`build\` ` +
        `leaves on a copy of this state, permissions restored (B's module ` +
        `certainly among them), the workspace being valid and consistently ` +
        `rewritten (SPEC 13.5, 14.10, 13.4)`,
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
    // The residue stands until a mutating command run once the permissions
    // are restored proceeds and removes it: `check`, `impact`, and `build`
    // acquire nothing, and no write but acquisition and release touches the
    // lock path (SPEC 13.5, 13.4).
    await assertLockDirectoryEntries(
      workspace.root,
      { entries: 0 },
      `${context}: the residue still stands, empty, after \`check\`, ` +
        `\`impact\`, and \`build\`, which acquire nothing (SPEC 13.4: no ` +
        `write but acquisition and release touches the lock path)`,
    );
    const remover = ["review", "create", "--strategy", "audit", "--name", "r"];
    const removerContext = `${context}: \`${remover.join(" ")}\`, a mutating command run once the permissions are restored`;
    await expectExit(
      product,
      workspace,
      remover,
      0,
      `${removerContext}, proceeds unrefused — the emptied lock directory ` +
        `holds no entry, so nothing there refuses its acquisition (SPEC 13.5)`,
    );
    await assertLockPathAbsent(
      workspace.root,
      `${removerContext}, removes the residue: its acquisition adds its ` +
        `entry to the emptied lock directory and its release deletes that ` +
        `entry, then the lock directory (SPEC 13.5; T13.5-11)`,
    );
  } finally {
    await workspace.dispose();
  }
}

/**
 * The snapshot restricted to the entries `scope` admits, its root, real
 * root, and acquisition mark carried over (H-6's classification of its
 * compares, helpers/snapshot.ts `lockPathExclusion`).
 */
function restrictSnapshot(
  snapshot: DirectorySnapshot,
  scope: (rel: string) => boolean,
): DirectorySnapshot {
  const entries = new Map<string, SnapshotEntry>();
  for (const [key, entry] of snapshot.entries) {
    if (scope(key)) entries.set(key, entry);
  }
  return { ...snapshot, entries };
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
 * `check` on the state an operation stopped after its commit point leaves
 * (T13.5-7 (c): the file-form move, and the rename stopped there alike):
 * condition-10 findings alone — the stale remainder (SPEC 13.5, 14.10) —
 * each concerning its derived path or the graph-data area as its 12.7
 * `path`, with `locations` `[]`, and instructing rebuilding
 * (`assertStaleFindingsConcernAndCorrection`; SPEC 14, 14.10, 12.7): the
 * recorded derived files the move leaves behind (the origin's module,
 * companions, and Markdown) lie at paths the current sources and
 * configuration no longer generate, none a directory component of a path a
 * rebuild writes (14.22), and the rename, whose derived paths are its
 * sources' own, leaves none, so nothing obstructs a rebuild write and every
 * finding's correction is rebuilding. The emitted Markdown `missing`, which
 * the stopped regeneration never produced, is certainly among the paths
 * named (14.10, 13.2), compared by bytes (12.7); which further derived
 * files are stale is the product's (its regeneration's write order is
 * unpinned, 13.5; companions are its own, 13.1), so membership alone.
 */
function assertStaleRemainder(
  findings: readonly Finding[],
  missing: string,
  why: string,
  context: string,
): void {
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
  assertStaleFindingsConcernAndCorrection(
    findings,
    `${context} — each finding of the stale remainder concerns its derived ` +
      `path or the graph-data area, with no in-source location, and ` +
      `instructs rebuilding (SPEC 14, 14.10, 12.7)`,
  );
  const missingBytes = expectedPathBytes(missing);
  const named = findings.some(
    (finding) =>
      finding.path !== null &&
      pathValueBytes(finding.path).equals(missingBytes),
  );
  if (!named) {
    fail(
      `${context}: ${JSON.stringify(displaySnapshotPath(missing))} — ${why} ` +
        `— is certainly among the stale derived paths \`check\` names, ` +
        `its per-file finding concerning it (SPEC 14.10, 13.2, 12.7; paths ` +
        `compare byte-wise); named: ` +
        JSON.stringify(
          findings.map((finding) => renderPathValue(finding.path)),
        ),
    );
  }
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
 * missing — each finding concerning its derived path (or, the unit form,
 * the graph-data area) as its 12.7 `path` with `locations` `[]` and
 * instructing rebuilding (`assertStaleRemainder`; SPEC 14, 14.10, 12.7);
 * restored, `impact` reports no change categories and the next `build`
 * leaves `check` clean. The rename stopped there alike is
 * {@link renameAfterAppendArm}.
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
    await assertNoLockPathAfter(workspace, true, context);
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
    assertStaleRemainder(
      await checkFindings(product, workspace, context),
      MOVE_MARKDOWN_WRITES[0]!,
      "the destination's emitted Markdown, never produced — its creation " +
        "refused or not attempted",
      `${context}: \`check\` after the stopped regeneration`,
    );
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
 * The premise of (c)'s rename staging and of (h)'s, checked on each arm's
 * workspace and its twin alike before the staging: once built under
 * `markdown: { emit: true, outDir: "out" }`, `directory` holds `source`'s
 * emitted Markdown `markdown`, a plain file, and nothing else — a diagnosed
 * failure otherwise (SPEC 13.2: `NAME.mdx` emits `NAME.md`, placed per
 * `markdown.outDir`, 7.3; 13.4: every file xspec writes is a plain file).
 * `purpose` says what the staging makes of that file.
 */
async function assertEmittedMarkdownAlone(
  workspace: TestWorkspace,
  directory: string,
  source: string,
  markdown: string,
  purpose: string,
  context: string,
): Promise<void> {
  const directoryKind = await workspace.kind(directory);
  const names =
    directoryKind === "dir" ? await workspace.readdirBytes(directory) : [];
  const fileKind = await workspace.kind(markdown);
  if (directoryKind !== "dir" || fileKind !== "file" || names.length !== 1) {
    const held = names.map((name) =>
      displaySnapshotPath(Buffer.from(name).toString("latin1")),
    );
    fail(
      `${context}: once built under \`markdown: { emit: true, outDir: ` +
        `"out" }\`, ${directory} holds ${source}'s ` +
        `emitted Markdown ${markdown}, a plain file, and nothing ` +
        `else (SPEC 13.2: \`NAME.mdx\` emits \`NAME.md\`, placed per ` +
        `\`markdown.outDir\`, 7.3; 13.4: every file xspec writes is a plain ` +
        `file) — ${purpose}; found ${directory} ` +
        `${directoryKind === "dir" ? `holding ${JSON.stringify(held)}` : directoryKind}, ` +
        `${markdown} ${fileKind}`,
    );
  }
}

/**
 * (c)'s rename staging once the workspace is prepared, on the arm's
 * workspace and its twin alike, and on T13.5-11 (a)'s (section-13.5-iii.ts):
 * the build having emitted `specs/b/B.mdx`'s Markdown at
 * `out/specs/b/B.md`, `out/specs/b` holding it alone — checked first
 * (`assertEmittedMarkdownAlone`) — that file is deleted, `out/specs/b` left
 * empty, so the rename's finishing regeneration owes a write there: its
 * creation (SPEC 6.4, 12.1).
 */
export async function deleteRenameOutMarkdown(
  workspace: TestWorkspace,
  context: string,
): Promise<void> {
  await assertEmittedMarkdownAlone(
    workspace,
    RENAME_OUT_MARKDOWN_DIR,
    RENAME_B_PATH,
    RENAME_OUT_MARKDOWN,
    "the premise of deleting it so that the rename's regeneration owes its " +
      "creation",
    context,
  );
  await fsp.rm(workspace.path(RENAME_OUT_MARKDOWN));
}

/**
 * (c), a rename stopped there alike (SPEC 6.4: it reports the write failure
 * alone, its journaled mapping observable thereafter only through the
 * journal's effects): (a)'s rename on the emitted-Markdown variant of (a)'s
 * workspace (`RENAME_OUT_FIXTURE`: `markdown: { emit: true, outDir: "out"
 * }`), built, `out/specs/b/B.md` then deleted — `out/specs/b` holding
 * nothing else (`deleteRenameOutMarkdown`) — and `out/specs/b` staged
 * unwritable at the hold, after acquisition, so that the regeneration owes a
 * write there, that file's creation, however it treats the derived files
 * whose content the rename leaves unchanged (a rename changes no Markdown,
 * 3), the twin's completed rename creating it (the arm's premise) — A, B,
 * and C byte-equal to the twin's and the journal holding exactly one new
 * entry byte-equal to the twin's, every other source untouched; stdout under
 * `--json` exactly the error document concerning `out/specs/b/B.md`, no
 * `mapping` beside or instead of it (the form-exact decode of
 * `expectWriteFailure`); every derived-file and graph-data entry its state
 * before the invocation or the twin's (`assertEachWriteComplete`); `check`
 * condition-10 findings alone, each concerning its derived path or the
 * graph-data area with `locations` `[]` and instructing rebuilding,
 * `out/specs/b/B.md`'s per-file finding among them (`assertStaleRemainder`);
 * `.xspec/lock` absent; and, the permissions restored, `impact --base
 * <pre-rename ref>` reports no change categories (6.2) and the next `build`
 * leaves `check` clean. Its twin is its own: the variant prepared alike and
 * `out/specs/b/B.md` deleted, the rename then run unrefused (H-6).
 */
export async function renameAfterAppendArm(
  product: ProductBinding,
): Promise<void> {
  const context =
    "T13.5-7 (c) `rename specs/b/B.mdx b b2 --json` with out/specs/b/B.md deleted and out/specs/b unwritable";
  const twin = await completeOnTwin(
    product,
    RENAME_OUT_FIXTURE,
    RENAME_ARGV,
    (workspace) => deleteRenameOutMarkdown(workspace, `${context} twin`),
    `${context} rename`,
  );
  const regenerated = twin.after.entries.get(RENAME_OUT_MARKDOWN);
  if (regenerated?.kind !== "file") {
    fail(
      `${context}: the twin's completed rename creates ` +
        `${RENAME_OUT_MARKDOWN} — its finishing regeneration regenerates ` +
        `every derived file the current sources and configuration generate ` +
        `(SPEC 6.4, 12.1, 13.2), so the regeneration owes that file's ` +
        `creation, the arm's premise; found ${renderEntry(regenerated)}`,
    );
  }
  const prepared = await prepareRefusalWorkspace(
    product,
    RENAME_OUT_FIXTURE,
    context,
  );
  const { workspace, baseline } = prepared;
  try {
    await deleteRenameOutMarkdown(workspace, context);
    const before = await snapshotWorkspace(workspace.root);
    assertTwinsIdentical(before, twin.before, context);
    const result = await runHeldWithStaging(
      product,
      workspace,
      RENAME_JSON,
      "hold-c-rename.tmp",
      refusalUnder(RENAME_OUT_MARKDOWN_DIR),
      context,
    );
    expectWriteFailure(
      result,
      [RENAME_OUT_MARKDOWN],
      `${context} — the regeneration's one write under ` +
        `${RENAME_OUT_MARKDOWN_DIR}, ${RENAME_OUT_MARKDOWN}'s creation, is ` +
        `the refused one, and the rename reports that write failure alone: ` +
        `its error document the entire stdout, no \`mapping\` beside or ` +
        `instead of it (SPEC 6.4, 14.24, 12.0)`,
    );
    await assertNoLockPathAfter(workspace, true, context);
    const after = await snapshotWorkspace(workspace.root);
    assertPinnedState(
      restrictSnapshot(before, isOrderedWritePath),
      restrictSnapshot(after, isOrderedWritePath),
      restrictSnapshot(twin.after, isOrderedWritePath),
      [RENAME_A_PATH, RENAME_B_PATH, RENAME_C_PATH, JOURNAL_PATH],
      `${context}: the state left — every source edit made (A, B, C ` +
        `byte-equal to the twin's), the journal holding exactly one new ` +
        `entry byte-equal to the twin's (the append precedes the finishing ` +
        `regeneration), every other source untouched`,
    );
    assertEachWriteComplete(
      before,
      after,
      twin.after,
      isRegenerationPath,
      `${context}: the finishing regeneration, stopped at the refused ` +
        `Markdown write — every derived file and graph-data entry`,
    );
    assertStaleRemainder(
      await checkFindings(product, workspace, context),
      RENAME_OUT_MARKDOWN,
      "deleted before the rename, its creation by the regeneration refused",
      `${context}: \`check\` after the stopped regeneration`,
    );
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
    await assertNoLockPathAfter(workspace, true, context);
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
          JSON.stringify(
            [...twin.after.entries.keys()].map(displaySnapshotPath),
          ),
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

// (e)'s staging, exported for T13.5-11(a) (section-13.5-iii.ts), which
// observes release after each of T13.5-7's refused writes but (b)'s on
// stagings made exactly as here.
/** (e)'s session, created on the prepared workspace (SPEC 10.7). */
export const SESSION = "s";
/** The session (e)'s `review create` names, never created. */
export const NEW_SESSION = "n";
export const SESSION_FILE = `${REVIEWS_DIR}/${SESSION}.json`;
export const NEW_SESSION_FILE = `${REVIEWS_DIR}/${NEW_SESSION}.json`;
/** An unblocked leaf item's scope (SPEC 10.6) — not the edited source's. */
export const RESOLVE_SCOPE = "specs/c/C.mdx#c";
/** A parent item's scope, its node holding a child subtree (`split`). */
export const SPLIT_SCOPE = "specs/b/B.mdx#b";
/** (e)'s staleness edit of A's text, made after `build`. */
export const E_EDIT_FROM = "Alpha text.";
export const E_EDIT_TO = "Alpha text, edited.";

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
    await assertNoLockPathAfter(workspace, true, resolveContext);
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
    await assertNoLockPathAfter(workspace, true, createContext);
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
    await assertNoLockPathAfter(workspace, true, splitContext);
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

/** (f)'s edit of B's text, the workspace valid (exported for T13.5-11(a)). */
export const F_EDIT_FROM = "Beta text.";
export const F_EDIT_TO = "Beta text, edited.";

/**
 * (f) `build` and a refresh, each file complete, the order unpinned: a built
 * workspace whose `specs/b/B.mdx` is edited (the workspace valid) before
 * `specs/b` is staged unwritable — `build` exits 2 with the error document
 * concerning a derived path under `specs/b/` (B's module or a companion,
 * the first `specs/b/` write in the product's order); every derived file
 * present afterwards is complete — byte-equal either to its bytes before
 * the invocation or to the twin's file at that path, one or the other, none
 * partial (12.1, 13.5; `assertEachWriteComplete`, graph data's files
 * included, 13.4) — and `check` reports exactly the derived paths whose
 * occupant differs from the twin's derived state (computed by comparison,
 * B's module certainly in it, its companions as the comparison finds them —
 * companions are the product's own, 13.1), the graph-data unit form exactly
 * when graph data differs; the next `build`, permissions restored, exits 0
 * with `check` clean (12.1, 13.4).
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
          JSON.stringify(derivedUnderB.map(displaySnapshotPath)),
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
    await assertNoLockPathAfter(workspace, false, context);
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
      `${context}: every derived file present afterwards, graph data's ` +
        `included, is complete — byte-equal either to its bytes before the ` +
        `invocation or to the twin's file at that path, none partial (the ` +
        `order among a \`build\`'s derived-file writes is unpinned)`,
    );
    const perFile = derivedPathsDifferingFrom(after, buildTwin.after);
    if (!perFile.includes(RENAME_B_MODULE)) {
      fail(
        `${context}: B's module ${RENAME_B_MODULE}, whose regeneration was ` +
          `refused or never attempted, certainly differs from the twin's ` +
          `(the edited text changes it, SPEC 13.1); differing: ` +
          JSON.stringify(perFile.map(displaySnapshotPath)),
      );
    }
    assertStalenessAlone(
      await checkFindings(product, workspace, context),
      { perFile, unit: graphDataDiffers(after, buildTwin.after) },
      `${context}: \`check\` reports exactly the derived paths whose ` +
        `occupant differs from the twin's derived state (B's module ` +
        `certainly among them, its companions as the comparison finds them, ` +
        `SPEC 13.1) and the graph-data unit form exactly when graph data ` +
        `differs (SPEC 14.10, 12.1, 13.4)`,
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
 * with `.xspec` staged unwritable by T14-9's graph-data staging, which
 * covers the area and every path of T13.3-2's operational path set
 * (`stageGraphDataWriteRefusal`: `.xspec` and every directory of the set
 * read-only, every file of it unwritable, the journal, the session
 * directory, and the lock path keeping their modes), `query nodes` and
 * `view specs/a/A.mdx` each exit 2 with the error document concerning
 * `.xspec` (14.24: a graph-data write concerns the area), stdout exactly
 * that document and no answer (13.3, 11.2), while `check` on the same state
 * exits 1 reporting the staleness (never a 14.24 reporter) — condition 10
 * alone, every finding concerning a path with `locations` `[]` and
 * instructing rebuilding, B's generated module `specs/b/B.xspec.ts` among
 * them (14.10, 14, 12.7; `assertEditedBStalenessConcerns`) — and a `move
 * --preview` exits 0 writing nothing (6.6).
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
    const staging = await graphDataRefusal()(workspace.root);
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
        await assertNoLockPathAfter(workspace, false, label);
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
      assertEditedBStalenessConcerns(
        findings,
        `${checkLabel} — the staleness of B's edited text`,
      );
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

/**
 * (g)'s premise, read from the order's twin: its completed move created
 * the target file `specs/n/N.mdx`, a plain file where nothing stood, and
 * rewrote the origin, removing `x` — the move's two source edits (SPEC 6.5:
 * at a target path nothing occupies, the target file is created; 13.5: one
 * write per file the operation rewrites or creates).
 */
function assertCreatedTargetPremise(
  twin: TwinOutcome,
  order: CreatedTargetOrder,
  context: string,
): void {
  const targetBefore = twin.before.entries.get(SECTION_MOVE_TARGET);
  const created = twin.after.entries.get(SECTION_MOVE_TARGET);
  const originBefore = twin.before.entries.get(order.origin);
  const originAfter = twin.after.entries.get(order.origin);
  if (
    targetBefore !== undefined ||
    created?.kind !== "file" ||
    originAfter?.kind !== "file" ||
    sameEntry(originBefore, originAfter)
  ) {
    fail(
      `${context}: the twin's completed move creates the target file ` +
        `${SECTION_MOVE_TARGET} where nothing stood (SPEC 6.5: at a target ` +
        `path nothing occupies, the target file is created) and rewrites ` +
        `${order.origin}, removing \`x\` — two source edits, the arm's ` +
        `premise (13.5); found ${SECTION_MOVE_TARGET} ` +
        `${renderEntry(targetBefore)} before and ${renderEntry(created)} ` +
        `after, ${order.origin} ${renderEntry(originBefore)} before and ` +
        `${renderEntry(originAfter)} after`,
    );
  }
}

/**
 * (g) A created target file is a source edit, made in its `files` place
 * (SPEC 13.5: one write per file the operation rewrites or creates, in the
 * order the preview's `files` lists them — a created file at the path its
 * creation would occupy, 12.7): `move <origin>#x specs/n/N.mdx#x`, `x` a
 * top-level section of the origin that nothing references and `specs/n` an
 * empty directory, so the target file is created (6.5), with `specs/n`
 * staged unwritable at the hold, after acquisition. Either way the run
 * exits 2, its stdout under `--json` exactly the error document concerning
 * `specs/n/N.mdx` (14.24: the file the write would have produced), no
 * `mapping` beside or instead of it (the form-exact decode of
 * `expectWriteFailure`), and `.xspec/lock` is absent afterwards. The origin
 * first (`specs/a/A.mdx`): the origin rewritten, byte-equal to the twin's;
 * nothing at `specs/n/N.mdx`, `specs/n` still empty; the journal
 * byte-unchanged (no entry: the append follows every source edit, the
 * creation included); derived files and graph data byte-unchanged
 * (`assertPinnedState`); and `check` reporting condition 10 alone, the
 * workspace valid with `x` deleted as by manual restructuring (6.7): the
 * graph-data unit form and one per-file finding for each derived path whose
 * occupant differs from the one a `build` leaves on a copy of this state,
 * permissions restored — computed by comparison, as in (b)
 * (`stalenessAgainstRebuiltCopy`) — the origin's module certainly among
 * them (4.1: its node skeleton names `x`). The creation first
 * (`specs/z/Z.mdx`, the byte order reversed): the refused creation is the
 * run's first write — the origin byte-untouched, nothing at
 * `specs/n/N.mdx`, the journal, derived files, and graph data
 * byte-unchanged — and `check` clean, exit 0. A product creating the target
 * file after the journal append, as part of the finishing regeneration,
 * fails both, leaving an entry; one making a section move's writes in any
 * order but `files`' fails one or the other. Each order's twin is its own:
 * its fixture prepared alike, the move then run unrefused (H-6), creating
 * the target file and rewriting the origin (`assertCreatedTargetPremise`).
 */
export async function createdTargetArm(
  product: ProductBinding,
  order: CreatedTargetOrder,
): Promise<void> {
  const context =
    `T13.5-7 (g) \`${order.argv.join(" ")} --json\` with ` +
    `${SECTION_MOVE_TARGET_DIR} unwritable` +
    (order.originFirst
      ? ""
      : " (the byte order reversed: the creation listed first)");
  const twin = await completeOnTwin(
    product,
    order.fixture,
    order.argv,
    undefined,
    `${context} move`,
  );
  assertCreatedTargetPremise(twin, order, context);
  const prepared = await prepareRefusalWorkspace(
    product,
    order.fixture,
    context,
  );
  const { workspace } = prepared;
  try {
    assertTwinsIdentical(prepared.before, twin.before, context);
    const result = await runHeldWithStaging(
      product,
      workspace,
      [...order.argv, "--json"],
      order.holdName,
      refusalUnder(SECTION_MOVE_TARGET_DIR),
      context,
    );
    expectWriteFailure(
      result,
      [SECTION_MOVE_TARGET],
      `${context} — the refused write is the target file's creation, a ` +
        `source edit: the error document, the entire stdout, concerns the ` +
        `file the write would have produced, no \`mapping\` beside or ` +
        `instead of it (SPEC 14.24, 13.5, 6.5, 12.0)`,
    );
    await assertNoLockPathAfter(workspace, true, context);
    const after = await snapshotWorkspace(workspace.root);
    if (!order.originFirst) {
      assertPinnedState(
        prepared.before,
        after,
        twin.after,
        [],
        `${context}: the state left — the refused creation, listed first in ` +
          `\`files\`, is the run's first write: ${order.origin} ` +
          `byte-untouched, nothing at ${SECTION_MOVE_TARGET} ` +
          `(${SECTION_MOVE_TARGET_DIR} still empty), the journal, derived ` +
          `files, and graph data byte-unchanged`,
      );
      await expectExit(
        product,
        workspace,
        ["check"],
        0,
        `${context}: \`check\` is clean — the run stopped at its first ` +
          `write, so nothing changed (SPEC 13.5, 12.2)`,
      );
    } else {
      assertPinnedState(
        prepared.before,
        after,
        twin.after,
        [order.origin],
        `${context}: the state left — ${order.origin} rewritten (the first ` +
          `source edit, complete and byte-equal to the twin's), nothing at ` +
          `${SECTION_MOVE_TARGET} (${SECTION_MOVE_TARGET_DIR} still empty: ` +
          `the creation refused), the journal byte-unchanged (no entry: the ` +
          `append follows every source edit, the creation included), ` +
          `derived files and graph data byte-unchanged`,
      );
      // The expected per-file set: what a `build` on a copy of this state,
      // permissions restored, leaves — as in (b), never the twin's derived
      // files, the twin's journal holding the entry this state lacks (SPEC
      // 13.4, 5.4).
      const expected = await stalenessAgainstRebuiltCopy(
        product,
        workspace,
        context,
      );
      if (!expected.perFile.includes(order.originModule)) {
        fail(
          `${context}: the origin's generated module ${order.originModule} ` +
            `must differ from the one a \`build\` leaves on a copy of this ` +
            `state — its node skeleton names \`x\` (SPEC 4.1), which the ` +
            `origin's rewrite removed — so it is certainly among the stale ` +
            `derived paths; differing: ` +
            JSON.stringify(expected.perFile.map(displaySnapshotPath)),
        );
      }
      if (!expected.graphDataDiffers) {
        fail(
          `${context}: graph data must differ from the graph data a ` +
            `\`build\` leaves on a copy of this state — it records \`x\`, ` +
            `which the origin's rewrite removed (SPEC 13.3) — so the unit ` +
            `form is certainly reported; found it byte-identical`,
        );
      }
      assertStalenessAlone(
        await checkFindings(product, workspace, context),
        { perFile: expected.perFile, unit: true },
        `${context}: \`check\` after the refused creation — condition 10 ` +
          `alone, the workspace valid with \`x\` deleted as by manual ` +
          `restructuring (SPEC 6.7): the graph-data unit form and one ` +
          `per-file finding for each derived path whose occupant differs ` +
          `from the one a \`build\` leaves on a copy of this state, ` +
          `permissions restored (the origin's module certainly among them) ` +
          `(SPEC 13.5, 14.10, 13.4)`,
      );
    }
  } finally {
    await workspace.dispose();
  }
}

/**
 * (h)'s staging once the move fixture is prepared, on the arm's workspaces
 * and their twins alike, and on T13.5-11 (a)'s (section-13.5-iii.ts): the
 * build having emitted `specs/A.mdx`'s Markdown at `out/specs/A.md`,
 * `out/specs` holding it alone — checked first
 * (`assertEmittedMarkdownAlone`) — the configuration is rewritten with
 * `markdown` removed (`MOVE_UNEMITTED_CONFIG`), emission disabled, so that
 * a regeneration owes nothing under `out/specs` but that file's removal
 * (SPEC 12.1, 13.4).
 */
export async function disableMoveEmission(
  workspace: TestWorkspace,
  context: string,
): Promise<void> {
  await assertEmittedMarkdownAlone(
    workspace,
    MOVE_MARKDOWN_DIR,
    MOVE_ORIGIN,
    ORPHANED_MARKDOWN,
    "the premise of disabling emission so that a regeneration owes nothing " +
      `under ${MOVE_MARKDOWN_DIR} but its removal`,
    context,
  );
  await workspace.file("xspec.config.ts", MOVE_UNEMITTED_CONFIG);
}

/**
 * (h)'s premise, read from a twin on which the operation completed on the
 * emission-disabled move fixture: nothing remains under `out/specs` — its
 * regeneration removed `out/specs/A.md`, the recorded derived file the
 * current configuration no longer generates, and wrote nothing else there
 * (SPEC 12.1, 13.4) — so that removal is the one write the regeneration
 * owes under `out/specs`.
 */
function assertOrphanRemovalOwedAlone(
  twin: TwinOutcome,
  operation: string,
  context: string,
): void {
  const left = [...twin.after.entries.keys()].filter((rel) =>
    rel.startsWith(`${MOVE_MARKDOWN_DIR}/`),
  );
  if (left.length > 0) {
    fail(
      `${context}: the twin's completed ${operation} removes ` +
        `${ORPHANED_MARKDOWN} — a regeneration removes the recorded derived ` +
        `files the current sources and configuration no longer generate, ` +
        `emission being disabled (SPEC 12.1, 13.4) — and writes nothing ` +
        `else under ${MOVE_MARKDOWN_DIR}, so that removal is the one write ` +
        `the regeneration owes there, the arm's premise; found ` +
        JSON.stringify(left.map(displaySnapshotPath)),
    );
  }
}

/**
 * (h) A removal owed alone (SPEC 14.24: a removal is a write the
 * environment can refuse; 12.1, 13.4: removing the recorded derived files
 * the current sources and configuration no longer generate is part of
 * every regeneration): (c)'s workspace, built under `markdown: { emit:
 * true, outDir: "out" }` — `out/specs` holding `A.md` alone — with emission
 * then disabled (`disableMoveEmission`), so that a regeneration owes
 * nothing under `out/specs` but `out/specs/A.md`'s removal, and `out/specs`
 * staged unwritable before the invocation (`build` takes no hold): `build`
 * exits 2, stdout under `--json` exactly the error document, `code`
 * `"write-failure"`, `path` `"out/specs/A.md"`, the file byte-identical in
 * place; no source and no journal written (12.1, 6.1); every derived-file
 * and graph-data entry its state before the invocation or the build twin's
 * (`assertEachWriteComplete`: the order among a `build`'s writes is
 * unpinned, 13.5); `.xspec/lock` absent. A product whose orphan removal is
 * best-effort meets no other refused write and exits 0, failing here. The
 * build twin is its own: the fixture prepared and emission disabled alike,
 * then `build` run unrefused (H-6), removing `out/specs/A.md` alone there
 * (`assertOrphanRemovalOwedAlone`). The rename on the same state is
 * {@link orphanRemovalRenameArm}.
 */
export async function orphanRemovalBuildArm(
  product: ProductBinding,
): Promise<void> {
  const context =
    "T13.5-7 (h) `build --json` with emission disabled and out/specs unwritable";
  const buildTwin = await completeOnTwin(
    product,
    MOVE_FIXTURE,
    ["build"],
    (workspace) => disableMoveEmission(workspace, `${context} build twin`),
    `${context} build`,
  );
  assertOrphanRemovalOwedAlone(buildTwin, "`build`", context);
  const prepared = await prepareRefusalWorkspace(
    product,
    MOVE_FIXTURE,
    context,
  );
  const { workspace } = prepared;
  try {
    await disableMoveEmission(workspace, context);
    const staged = await snapshotWorkspace(workspace.root);
    assertTwinsIdentical(staged, buildTwin.before, context);
    const result = await runStaged(
      product,
      workspace,
      ["build", "--json"],
      refusalUnder(MOVE_MARKDOWN_DIR),
      context,
    );
    expectWriteFailure(
      result,
      [ORPHANED_MARKDOWN],
      `${context} — the one write the regeneration owes under ` +
        `${MOVE_MARKDOWN_DIR}, ${ORPHANED_MARKDOWN}'s removal, is refused: ` +
        `the error document, the entire stdout, concerns the file the ` +
        `removal would have removed (SPEC 14.24, 12.1, 13.4, 12.0)`,
    );
    await assertNoLockPathAfter(workspace, false, context);
    const after = await snapshotWorkspace(workspace.root);
    assertSameEntry(
      after,
      staged,
      ORPHANED_MARKDOWN,
      `${context}: ${ORPHANED_MARKDOWN} byte-identical in place — its ` +
        `removal refused (SPEC 14.24, 13.5)`,
    );
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
      `${context}: every derived file and graph-data entry afterwards is ` +
        `complete — byte-equal either to its bytes before the invocation ` +
        `or to the build twin's at that path, none partial (the order ` +
        `among a \`build\`'s writes is unpinned)`,
    );
  } finally {
    await workspace.dispose();
  }
}

/**
 * (h), the rename on the same state (SPEC 6.4: a rename a write failure
 * stops reports it alone, its journaled mapping observable thereafter only
 * through the journal's effects): `rename specs/A.mdx a a2` on the
 * emission-disabled move fixture, `out/specs` staged unwritable at its
 * hold, after acquisition — exit 2 with the same error document alone,
 * concerning `out/specs/A.md`, no `mapping` beside or instead of it (the
 * form-exact decode of `expectWriteFailure`); its source edits and journal
 * append made — `specs/A.mdx` and its importer `src/app.ts` byte-equal to
 * the twin's, the journal holding exactly one new entry byte-equal to the
 * twin's, every other source untouched; `out/specs/A.md` byte-identical in
 * place; every derived-file and graph-data entry its state before the
 * invocation or the twin's (`assertEachWriteComplete`: the order among a
 * regeneration's writes is unpinned, 13.5); `.xspec/lock` absent. A
 * product whose orphan removal is best-effort exits 0, failing here. Its
 * twin is its own: the fixture prepared and emission disabled alike, the
 * rename then run unrefused (H-6), its regeneration removing
 * `out/specs/A.md` alone there (`assertOrphanRemovalOwedAlone`).
 */
export async function orphanRemovalRenameArm(
  product: ProductBinding,
): Promise<void> {
  const context =
    "T13.5-7 (h) `rename specs/A.mdx a a2 --json` with emission disabled and out/specs unwritable";
  const twin = await completeOnTwin(
    product,
    MOVE_FIXTURE,
    ORPHAN_RENAME_ARGV,
    (workspace) => disableMoveEmission(workspace, `${context} twin`),
    `${context} rename`,
  );
  assertOrphanRemovalOwedAlone(twin, "rename", context);
  const prepared = await prepareRefusalWorkspace(
    product,
    MOVE_FIXTURE,
    context,
  );
  const { workspace } = prepared;
  try {
    await disableMoveEmission(workspace, context);
    const before = await snapshotWorkspace(workspace.root);
    assertTwinsIdentical(before, twin.before, context);
    const result = await runHeldWithStaging(
      product,
      workspace,
      [...ORPHAN_RENAME_ARGV, "--json"],
      "hold-h-rename.tmp",
      refusalUnder(MOVE_MARKDOWN_DIR),
      context,
    );
    expectWriteFailure(
      result,
      [ORPHANED_MARKDOWN],
      `${context} — the finishing regeneration's one write under ` +
        `${MOVE_MARKDOWN_DIR}, ${ORPHANED_MARKDOWN}'s removal, is the ` +
        `refused one, and the rename reports that write failure alone: its ` +
        `error document the entire stdout, no \`mapping\` beside or ` +
        `instead of it (SPEC 6.4, 14.24, 12.0)`,
    );
    await assertNoLockPathAfter(workspace, true, context);
    const after = await snapshotWorkspace(workspace.root);
    assertPinnedState(
      restrictSnapshot(before, isOrderedWritePath),
      restrictSnapshot(after, isOrderedWritePath),
      restrictSnapshot(twin.after, isOrderedWritePath),
      [MOVE_ORIGIN, MOVE_IMPORTER, JOURNAL_PATH],
      `${context}: the state left — its source edits made (${MOVE_ORIGIN} ` +
        `and its importer ${MOVE_IMPORTER} byte-equal to the twin's), the ` +
        `journal holding exactly one new entry byte-equal to the twin's ` +
        `(the append precedes the finishing regeneration), every other ` +
        `source untouched`,
    );
    assertSameEntry(
      after,
      before,
      ORPHANED_MARKDOWN,
      `${context}: ${ORPHANED_MARKDOWN} byte-identical in place — its ` +
        `removal refused (SPEC 14.24, 13.5)`,
    );
    assertEachWriteComplete(
      before,
      after,
      twin.after,
      isRegenerationPath,
      `${context}: the finishing regeneration, stopped at the refused ` +
        `removal — every derived file and graph-data entry`,
    );
  } finally {
    await workspace.dispose();
  }
}

// Post-lift kill delays in milliseconds — scheduling choreography only,
// never an assertion input (H-10): every assertion of a kill is conditioned
// on what the kill found — the collected exit and the workspace — and holds
// for a conforming product under every timing; one fixed spread, in CI as
// everywhere (E-5).
const KILL_DELAYS_MS: readonly number[] = [0, 2, 5, 10, 20, 40, 80, 160];

/**
 * The kill arm, a robustness check only — a kill lands nondeterministically,
 * the refused write being the deterministic seam. Each kill is made under
 * TEST-SPEC T13.5-3's exit-collection discipline without the reuse check:
 * the rename started in a process group of its own, the whole group killed
 * with SIGKILL, the started process's exit collected, and no process of the
 * group listed before `check` runs, no mutating command following. A kill
 * at the held point (T13.5-3's kill while held, `killHeldRun`) leaves
 * `.xspec/lock` holding exactly one entry, a plain file — the dead run's
 * (13.5: an abnormal termination leaves its entry) — and the workspace
 * consistent (`check` exits 0: the hold precedes all modification). Across
 * a spread of kill timings after the lift on (a)'s rename, the lock path's
 * state is T13.5-3's past-the-hold arm's, judged by its shared machinery
 * (helpers/lock-state.ts `assertLockPathAfterKill`, against the rename
 * twin's final state and the paths its run changed): one plain-file entry
 * wherever the kill stopped the run short of the twin's final state,
 * nothing where the run ended first; the journal is byte-equal either to
 * its prior bytes or to the twin's post-operation bytes (13.5: each write
 * complete); and `check` never crashes and reports exactly a state 13.5
 * admits — clean, or condition 5–7 findings alone (a partly applied
 * rewrite), or condition 10 findings alone (the journal appended, derived
 * files not yet regenerated). No permission staging; the process list and
 * process groups are the Linux leg's (the Windows subset selects T13.5-7
 * nowhere).
 */
export async function runKillArm(
  product: ProductBinding,
  twin: TwinOutcome,
): Promise<void> {
  // The past-the-hold judgement's basis: the twin's final state and every
  // path its run changed, the lock path aside (H-6).
  const judgedAgainst: KilledRunTwin = {
    final: twin.after,
    changed: diffSnapshots(twin.before, twin.after).map((change) => change.key),
  };
  const probe = async (delayMs: number | null): Promise<void> => {
    const label =
      delayMs === null ? "held point" : `${String(delayMs)} ms after its lift`;
    const context = `T13.5-7 (kill, ${label}) \`rename specs/b/B.mdx b b2 --test-hold <path>\``;
    const prepared = await prepareRefusalWorkspace(
      product,
      RENAME_FIXTURE,
      context,
    );
    const { workspace } = prepared;
    try {
      assertTwinsIdentical(prepared.before, twin.before, context);
      let after: DirectorySnapshot;
      if (delayMs === null) {
        // T13.5-3's kill while held: `killHeldRun` asserts the run killed
        // while held and the lock directory's one entry, a plain file.
        await killHeldRun(product, {
          root: workspace.root,
          argv: RENAME_ARGV,
          holdPath: holdPathFor(workspace, "hold-kill.tmp"),
          context,
        });
        after = await snapshotWorkspace(workspace.root);
      } else {
        const { running, liftedAt } = await startHeldAndLift(
          product,
          workspace,
          RENAME_ARGV,
          "hold-kill.tmp",
          context,
        );
        const remainingMs = delayMs - (performance.now() - liftedAt);
        if (remainingMs > 0) await sleep(remainingMs);
        let killed: KilledGroup;
        try {
          killed = await running.killGroup();
        } catch (error) {
          rethrowHarnessError(error);
          return fail(
            `${context}: the run must end on its own or by the kill, its ` +
              `exit collected (SPEC 13.5; H-8) — ` +
              `${error instanceof Error ? error.message : String(error)}`,
          );
        }
        after = await snapshotWorkspace(workspace.root);
        await assertLockPathAfterKill(
          workspace.root,
          killed.result,
          after,
          judgedAgainst,
          `${context}: the lock path's state after the kill, T13.5-3's ` +
            `past-the-hold arm's`,
        );
      }
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
      const checkContext = `${context} \`check --json\` after the kill, its group gone`;
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
 * T13.5-7's refusal arms (a)–(h) on the Linux leg, each starting from a
 * freshly prepared workspace; the rename twin is the caller's (shared with
 * the kill arm), the move twin ((c)'s move and (d)) is built here, and (c)'s
 * rename, (e), (f), each of (g)'s byte orders, and each of (h)'s two
 * operations build their own.
 */
export async function runWriteRefusalArms(
  product: ProductBinding,
  rename: TwinOutcome,
): Promise<void> {
  await sourceEditsArm(product, rename);
  await journalCommitPointArm(product, rename);
  const move = await moveTwin(product);
  await afterAppendArm(product, move);
  await renameAfterAppendArm(product);
  await relocationArm(product, move);
  await reviewMutatorsArm(product);
  await buildArm(product);
  await refreshingReadsArm(product);
  for (const order of CREATED_TARGET_ORDERS) {
    await createdTargetArm(product, order);
  }
  await orphanRemovalBuildArm(product);
  await orphanRemovalRenameArm(product);
}
