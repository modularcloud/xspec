// TEST-SPEC §13.5 (concurrency and isolation), part iv — SUITE-48:
// T13.5-12 (rediscovery under exclusivity), registered whole: (a) sources
// created during a hold — a spec source holding a `d` reference to the
// section a held `rename` renames, a code source holding a marker on it,
// and a spec source created during a held `review create` — (b) referencing
// sources deleted during a hold, (c) the origin file created or deleted
// during a hold, (d) a configuration error the rediscovery meets, and (e) a
// read failure it meets, (d) and (e) with each mutating command.
//
// SPEC 13.5: a mutating command acquires exclusivity once its configuration
// is loaded and its sources discovered, and, holding it, discovers its
// sources again: that discovery fixes the sources every later check and
// read consults, a configuration error it meets reported there — after
// acquisition's and the hold file's errors, before every other (12.0). The
// hold-file seam engages at acquisition, before the second discovery, so a
// change made during a hold, before the hold is lifted, is met by that
// discovery deterministically.
//
// Every arm runs on T13.5-8's valid workspace (section-13.5.ts
// `ACQUISITION_DECL`, configured as T13.5-12(d)'s: the spec group matching
// `specs/**/*.mdx` and `src/*.mdx`, the code group `src/*`, so both match
// the unoccupied `src/*.mdx` paths; `specs/A.mdx` holding `a` with its
// child `a.k`, then `g`; `specs/sub/S.mdx`, the discovered directory (e)
// makes unlistable; the markerless code source `src/c.ts`) — (c)'s creation
// arm on that workspace without `specs/A.mdx` — freshly built (`build`,
// exit 0: a valid workspace), (d) and (e) on its session staging
// (section-13.5-ii.ts `stageArmWorkspace`: `build`, `review create
// --strategy audit --name s`, the session's items read by `review status s
// --json`, `.xspec/lock` checked absent), so that each command is an
// operation otherwise succeeding there. Every command runs under `--json`.
// Each held run is started with its hold path outside the workspace
// (section-13.5-iii.ts `withHeldRun`), its hold file awaited — a run exiting
// without creating it fails diagnosed (T13.5-8's waits) — and, once it
// holds, the held-state comparison (TEST-SPEC §13.5's preamble;
// helpers/lock-state.ts `assertHeldState`) is made against the workspace
// before it started, observing its entry, the lock directory's only one;
// the arm's change is then made and complete before the hold is
// lifted — every during-hold step awaited before the lift, as T13.5-4
// awaits its `build`'s exit (VIOL-CORE-BUILDWAIT) — and the run awaited to
// its exit under its hang guard (H-10). Each twin — "a twin's on which that
// file was created [deleted] before the invocation" — is a fresh workspace
// staged alike, freshly built, the arm's change made before the invocation,
// and the same command run unheld, bounded (`runBounded`): the seam changes
// no other behavior (13.5), so a held run whose second discovery meets the
// change ends as its twin does.
//
// (a) Created during the hold, each met by the second discovery:
// - `specs/R.mdx`, a spec source holding the `d` reference `A.a` through an
//   import of `specs/A.mdx`'s module, created during the hold of `rename
//   specs/A.mdx a a2` — rewritten too (SPEC 6.4: a rename rewrites every
//   reference to the affected identities across all configured spec and
//   code sources): the run's exit code, standard output and error, and
//   final workspace byte-equal to the twin's (H-6, the lock path left out
//   across directories), the twin's `specs/R.mdx` holding `A.a2` (6.4's
//   minimal in-place edit, its access form kept) — the arm's premise;
// - `src/use.ts`, a code source the code group matches, importing that
//   module and holding the marker `A.a;` (4.5), likewise, its rewrite
//   `A.a2;`;
// - `specs/N.mdx`, a spec source created during the hold of `review create
//   --strategy audit --name n`: the run exits 0, the session `n` holds an
//   item scoped at its section (`review status n --json`; SPEC 10.6: one
//   item per requirement node) — the source lies within the session's scope
//   — and the session file is byte-equal to the twin's, read before any
//   later command.
// (b) Each referencing source of (a) present at invocation — staged with the
// workspace, so freshly built with it — and deleted during the `rename`'s
// hold is absent from the operation: exit 0, no `read-failure`, the result —
// exit code, standard output and error, final workspace — byte-equal to the
// twin's, on which it was deleted before the invocation.
// (c) On the workspace without `specs/A.mdx`, that file created during the
// hold of `rename specs/A.mdx a b`: the `rename` proceeds, exit 0, its
// result byte-equal to the twin's, on which the file was created before the
// invocation; separately, `specs/A.mdx` present at invocation and deleted
// during the hold: exit 2, the unknown-file usage error (`code` `null`;
// 12.0: an unknown `<file>` is a usage error, judged over the sources the
// second discovery fixed), nothing modified — the workspace once the run
// has ended byte-identical to its state once the file was deleted (H-6: the
// run's lock path left out).
// (d) A file created at `src/both.mdx`, a path the spec and code groups
// both match and nothing occupies at invocation, during the hold of `rename
// specs/A.mdx nope x` (an unknown old ID): exit 2, `code`
// `"configuration-error"`, `path` `"xspec.config.ts"` (7.2, 14.14; T12.7-3)
// — never the unknown-ID usage error, `code` `null` — nothing modified (the
// workspace once the run has ended byte-identical to its state once the file
// was created), `.xspec/lock` absent afterwards (T13.5-11); likewise with
// each other mutating command, as an operation otherwise succeeding:
// `move specs/A.mdx specs/B.mdx` (the file form), `review create --strategy
// audit --name t`, `review resolve s <g's item> --status no-change`, and
// `review split s <a's item>`.
// (e) `specs/sub`, a directory discovery lists, made unlistable during the
// hold (`--x`, T14-10's discipline: its search permission kept, verified on
// the harness itself before use; section-13.5.ts `UNLISTABLE_SUB_DIR`):
// exit 2, `code` `"read-failure"`, `path` `"specs/sub"` (14.25), nothing
// modified (the workspace's state during the hold, before the change,
// against its state once the run has ended and the mode is restored — the
// staging and its undoing restore a directory's mode alone, never a byte),
// `.xspec/lock` absent afterwards; likewise with each command (d) runs.
//
// The body runs the arms within CONF-CORE's surface first — (c), (a)'s
// session-scope arm, (d), and (e) — and the four arms whose workspaces
// carry a `d` prop or a marker-bearing code source last (TEST-SPEC's order
// otherwise), so the CONF-CORE reference meets every arm it serves first.
//
// CERTIFICATIONS.md: T13.5-12 lies in no certification scope (the
// Exclusions entry for T13.5-9 through T13.5-12 and T13.4-12): its
// operative assertions are positive — the effect of a change made during
// the hold, each failing loud against a product consulting its first
// discovery; its during-hold stagings ride the seam choreography the
// CONF-CORE lock violators certify, its waits for the hold file among it
// (VIOL-CORE-LATEHOLD); and every held arm makes the held-state comparison,
// which a product keeping its exclusion state anywhere but the lock
// directory fails loud. Its absences of `.xspec/lock` ((d), (e)) are braced
// by the held run's entry asserted present at the same path. The Linux
// leg's staging: (e)'s permission removal (E-1).

import * as fsp from "node:fs/promises";
import {
  assertBytesEqual,
  assertExitCode,
  fail,
} from "../../helpers/assertions.js";
import { assertRunOutcomesEqual } from "../../helpers/determinism.js";
import { assertLockPathAbsent } from "../../helpers/lock-state.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import type { DirectorySnapshot } from "../../helpers/snapshot.js";
import {
  assertSnapshotsEqual,
  describeEntry,
  snapshotDirectory,
} from "../../helpers/snapshot.js";
import { stagedMdx } from "../../helpers/staged-mdx.js";
import type { StagedMdx } from "../../helpers/staged-mdx.js";
import { stagedTs } from "../../helpers/staged-ts.js";
import type { StagedTs } from "../../helpers/staged-ts.js";
import type { ProductBinding, RunResult } from "../../helpers/subprocess.js";
import type { WorkspaceDecl } from "../../helpers/workspace.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import {
  RENAME_A,
  stageArmWorkspace,
  T13_5_10_OPERATIONS,
} from "./section-13.5-ii.js";
import {
  assertFailureEnding,
  assertUsageError,
  liftAndWait,
  withHeldRun,
} from "./section-13.5-iii.js";
import type {
  AcquisitionAfterStaging,
  SessionOperation,
} from "./section-13.5.js";
import {
  ACQUISITION_DECL,
  CONFIG_PATH,
  CORE_A_STAGED,
  DOUBLY_MATCHED_FILE,
  DOUBLY_MATCHED_PATH,
  runBounded,
  SUB_DIR,
  UNLISTABLE_SUB_DIR,
} from "./section-13.5.js";
import { buildOk } from "./support.js";
import { requireItemByScope, sessionStatus } from "./write-refusal-staging.js";

/** The stable code of 14.25, the read failure. */
const READ_FAILURE_CODE = "read-failure";

/** The stable code of 14.14, the configuration error. */
const CONFIGURATION_ERROR_CODE = "configuration-error";

/** The origin file every `rename` here names. */
const A_PATH = "specs/A.mdx";

/** (a)'s and (b)'s `rename`: `a`, with its child `a.k`, to `a2`. */
const RENAME_A_A2: readonly string[] = ["rename", A_PATH, "a", "a2"];

/** (c)'s `rename`. */
const RENAME_A_B: readonly string[] = ["rename", A_PATH, "a", "b"];

/** (a)'s session-scope arm's `review create`. */
const CREATE_N: readonly string[] = [
  "review",
  "create",
  "--strategy",
  "audit",
  "--name",
  "n",
];

/** The session file `review create --name n` writes (SPEC 10.1). */
const SESSION_N_FILE = ".xspec/reviews/n.json";

/** The rule every absence of `.xspec/lock` below cites. */
const RELEASE_RULE =
  "SPEC 13.5: a command ending normally — completed, refused, or failed — " +
  "deletes its entry, then the lock directory when that holds nothing " +
  "else, then `.xspec` when its acquisition created it and it then holds " +
  "nothing else; T13.5-11";

/** The rule every arm's change rests on. */
const REDISCOVERY_RULE =
  "SPEC 13.5: holding exclusivity — past the hold, which engages at " +
  "acquisition, before the second discovery — the command discovers its " +
  "sources again, and that discovery fixes the sources every later check " +
  "and read consults";

// The sources (a) creates and (b) deletes during a hold, and (a)'s
// session-scope source. Each is staged in a workspace created after the
// body's first product invocation, or by an arm after one, so each is a
// staged-source record S-9 judges before any product exists
// (helpers/staged-mdx.ts, helpers/staged-ts.ts; S-9's timing clause).

/** `specs/R.mdx` holding the `d` reference `A.<id>` (SPEC 2.1, 2.2). */
function referringSpecText(id: string): string {
  return [
    'import A from "./A.xspec"',
    "",
    `<S id="r" d={A.${id}}>`,
    "Refers text.",
    "</S>",
    "",
  ].join("\n");
}
const REFERRING_SPEC_PATH = "specs/R.mdx";
const REFERRING_SPEC = stagedMdx(
  "T13.5-12 specs/R.mdx — a spec source holding the d reference A.a to specs/A.mdx#a through an import of its module (created during a rename's hold in (a); present at invocation and deleted during the hold in (b))",
  referringSpecText("a"),
);

/** `src/use.ts`: an import of `specs/A.mdx`'s module, the marker `A.<id>;`. */
function markerCodeText(id: string): string {
  return ['import A from "../specs/A.xspec";', "", `A.${id};`, ""].join("\n");
}
const MARKER_CODE_PATH = "src/use.ts";
const MARKER_CODE = stagedTs(
  "T13.5-12 src/use.ts — a code source the code group src/* matches, importing specs/A.mdx's module and holding the marker A.a on specs/A.mdx#a (created during a rename's hold in (a); present at invocation and deleted during the hold in (b))",
  markerCodeText("a"),
);

/** `specs/N.mdx`: one section, `fresh` (a valid ID, SPEC 1.4). */
const SCOPED_SPEC_PATH = "specs/N.mdx";
const SCOPED_SPEC_SCOPE = `${SCOPED_SPEC_PATH}#fresh`;
const SCOPED_SPEC = stagedMdx(
  "T13.5-12 specs/N.mdx — a spec source created during the hold of review create --strategy audit --name n ((a)'s session-scope arm), and before the invocation on its twin",
  ['<S id="fresh">', "Fresh text.", "</S>", ""].join("\n"),
);

/**
 * (c)'s creation arm's workspace: `ACQUISITION_DECL` without `specs/A.mdx`
 * — `specs/sub/S.mdx`, `src/c.ts`, and the configuration — which that arm
 * creates during the hold (`CORE_A_STAGED`).
 */
const WITHOUT_A_DECL: WorkspaceDecl = withoutFile(ACQUISITION_DECL, A_PATH);

/** `decl` without its file at `rel` (a harness error where it holds none). */
function withoutFile(decl: WorkspaceDecl, rel: string): WorkspaceDecl {
  const files = Object.entries(decl.files ?? {});
  const kept = files.filter(([path]) => path !== rel);
  if (kept.length !== files.length - 1) {
    throw new Error(`T13.5-12: the workspace declaration holds no ${rel}`);
  }
  return { ...decl, files: Object.fromEntries(kept) };
}

/** `decl` with `record` staged at `rel` too (a harness error where taken). */
function withFile(
  decl: WorkspaceDecl,
  rel: string,
  record: StagedMdx | StagedTs,
): WorkspaceDecl {
  if (decl.files !== undefined && rel in decl.files) {
    throw new Error(`T13.5-12: the workspace declaration already holds ${rel}`);
  }
  return { ...decl, files: { ...decl.files, [rel]: record } };
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

/** A run's outcome, and its workspace's state once it has ended. */
interface RunAndState {
  readonly result: RunResult;
  readonly final: DirectorySnapshot;
}

/** A change an arm makes to its workspace, during the hold or before it. */
type Change = (workspace: TestWorkspace) => Promise<void>;

/** Create `record` at `rel`. */
function creating(rel: string, record: StagedMdx | StagedTs): Change {
  return async (workspace) => {
    await workspace.file(rel, record);
  };
}

/** Delete the plain file at `rel`. */
function deleting(rel: string): Change {
  return async (workspace) => {
    await fsp.unlink(workspace.path(rel));
  };
}

/**
 * The twin (TEST-SPEC T13.5-12: "a twin's on which that file was created
 * [deleted] before the invocation"): a fresh workspace of `decl`, freshly
 * built, `change` made, then `argv` under `--json`, unheld and bounded —
 * an operation succeeding there, exit 0.
 */
async function twinRun(
  product: ProductBinding,
  decl: WorkspaceDecl,
  change: Change,
  argv: readonly string[],
  context: string,
): Promise<RunAndState> {
  return await withWorkspace(decl, async (workspace) => {
    await buildOk(product, workspace, `${context}: its staging \`build\``);
    await change(workspace);
    const result = await runBounded(
      product,
      workspace.root,
      [...argv, "--json"],
      context,
    );
    assertExitCode(
      result,
      0,
      `${context}: the change made before the invocation, the command is ` +
        `an operation succeeding there (the arm's premise: SPEC 6.4, 10.7)`,
    );
    return { result, final: await snapshotDirectory(workspace.root) };
  });
}

/**
 * The held side of an arm: a fresh workspace of `decl`, freshly built,
 * `argv` under `--json` held (`withHeldRun`: the held-state comparison once
 * it holds), `change` made during the hold — complete before the hold is
 * lifted — then the hold lifted and the run awaited to its exit; `body`
 * judges the outcome while the workspace stands.
 */
async function heldChangeRun<T>(
  product: ProductBinding,
  decl: WorkspaceDecl,
  argv: readonly string[],
  change: Change,
  context: string,
  body: (result: RunResult, workspace: TestWorkspace) => Promise<T>,
): Promise<T> {
  return await withWorkspace(decl, async (workspace) => {
    await buildOk(product, workspace, `${context}: its staging \`build\``);
    return await withHeldRun(
      product,
      workspace,
      [...argv, "--json"],
      context,
      async (held) => {
        await change(workspace);
        const result = await liftAndWait(held, context);
        return await body(result, workspace);
      },
    );
  });
}

/**
 * The arm's result against its twin's (TEST-SPEC T13.5-12: "the result
 * byte-equal to a twin's"): exit code, standard output, and standard error
 * byte-equal, then the final workspaces byte-identical — the lock path left
 * out across directories (H-6).
 */
function assertTwinResult(
  arm: RunAndState,
  twin: RunAndState,
  context: string,
  rule: string,
): void {
  assertRunOutcomesEqual(
    arm.result,
    twin.result,
    `${context}: ${rule}`,
    "the held run",
    "its twin's run",
  );
  assertSnapshotsEqual(
    twin.final,
    arm.final,
    `${context}: its final workspace byte-identical to the twin's ` +
      `("added" naming what only the held run's workspace holds) — ${rule}`,
  );
}

/** The bytes of the plain file at `rel` in `snapshot` (an ASCII path). */
function fileBytesIn(
  snapshot: DirectorySnapshot,
  rel: string,
  context: string,
): Uint8Array {
  const entry = snapshot.entries.get(rel);
  if (entry?.kind !== "file") {
    return fail(
      `${context}: expected a plain file at ${rel}; found ` +
        (entry === undefined ? "nothing" : describeEntry(entry)),
    );
  }
  return entry.bytes;
}

/** Read a file the product should have written, diagnosed (H-8). */
async function readWritten(abs: string, context: string): Promise<Buffer> {
  try {
    return await fsp.readFile(abs);
  } catch (error) {
    return fail(
      `${context}: expected a readable plain file at ${abs} — ` +
        `${(error as Error).message}`,
    );
  }
}

// ---------------------------------------------------------------------------
// (a), (b): referencing sources created or deleted during a `rename`'s hold
// ---------------------------------------------------------------------------

/** A source referencing `specs/A.mdx#a`, as (a) creates and (b) deletes it. */
interface ReferringSource {
  readonly what: string;
  readonly path: string;
  readonly record: StagedMdx | StagedTs;
  /** Its bytes once `rename specs/A.mdx a a2` rewrites it (SPEC 6.4). */
  readonly rewritten: string;
}

const REFERRING_SOURCES: readonly ReferringSource[] = [
  {
    what:
      `${REFERRING_SPEC_PATH}, a spec source holding the \`d\` reference ` +
      "`A.a` through an import of specs/A.mdx's module",
    path: REFERRING_SPEC_PATH,
    record: REFERRING_SPEC,
    rewritten: referringSpecText("a2"),
  },
  {
    what:
      `${MARKER_CODE_PATH}, a code source the code group matches, importing ` +
      "specs/A.mdx's module and holding the marker `A.a;`",
    path: MARKER_CODE_PATH,
    record: MARKER_CODE,
    rewritten: markerCodeText("a2"),
  },
];

/**
 * (a): `source` created during the hold of `rename specs/A.mdx a a2` is
 * rewritten too, the result byte-equal to the twin's, on which it was
 * created before the invocation — the twin's rewrite of it asserted first,
 * the arm's premise (SPEC 6.4).
 */
async function createdReferenceArm(
  product: ProductBinding,
  source: ReferringSource,
): Promise<void> {
  const context =
    `T13.5-12(a) \`rename specs/A.mdx a a2 --json --test-hold <path>\` on ` +
    `a freshly built valid workspace, ${source.what}, created during its ` +
    "hold";
  const twin = await twinRun(
    product,
    ACQUISITION_DECL,
    creating(source.path, source.record),
    RENAME_A_A2,
    `${context} — its twin, on which that file was created before the ` +
      `invocation`,
  );
  assertBytesEqual(
    fileBytesIn(twin.final, source.path, `${context} — its twin`),
    source.rewritten,
    `${context} — its twin, the arm's premise: the rename rewrites the ` +
      `file's reference to \`a\` in place, its access form kept, \`A.a\` ` +
      `becoming \`A.a2\` (SPEC 6.4: every reference to the affected ` +
      `identities across all configured spec and code sources)`,
  );
  const arm = await heldChangeRun(
    product,
    ACQUISITION_DECL,
    RENAME_A_A2,
    creating(source.path, source.record),
    context,
    async (result, workspace) => {
      assertExitCode(
        result,
        0,
        `${context}: the rename proceeds over the sources its second ` +
          `discovery fixed, the created file among them (${REDISCOVERY_RULE})`,
      );
      return { result, final: await snapshotDirectory(workspace.root) };
    },
  );
  assertTwinResult(
    arm,
    twin,
    context,
    `the created file is rewritten too, as on the twin (${REDISCOVERY_RULE})`,
  );
}

/**
 * (b): `source` present at invocation and deleted during the hold of
 * `rename specs/A.mdx a a2` is absent from the operation — exit 0, no
 * `read-failure`, the result byte-equal to the twin's, on which it was
 * deleted before the invocation.
 */
async function deletedReferenceArm(
  product: ProductBinding,
  source: ReferringSource,
): Promise<void> {
  const decl = withFile(ACQUISITION_DECL, source.path, source.record);
  const context =
    `T13.5-12(b) \`rename specs/A.mdx a a2 --json --test-hold <path>\` on ` +
    `a freshly built valid workspace holding ${source.what}, deleted ` +
    `during the hold`;
  const twin = await twinRun(
    product,
    decl,
    deleting(source.path),
    RENAME_A_A2,
    `${context} — its twin, on which that file was deleted before the ` +
      `invocation`,
  );
  const arm = await heldChangeRun(
    product,
    decl,
    RENAME_A_A2,
    deleting(source.path),
    context,
    async (result, workspace) => {
      assertExitCode(
        result,
        0,
        `${context}: the deleted file is absent from the operation — the ` +
          `second discovery, made past the hold, finds it gone — so the ` +
          `rename succeeds, exit 0, no \`${READ_FAILURE_CODE}\` (` +
          `${REDISCOVERY_RULE}; 14.25)`,
      );
      return { result, final: await snapshotDirectory(workspace.root) };
    },
  );
  assertTwinResult(
    arm,
    twin,
    context,
    `the deleted file is absent from the operation, as on the twin ` +
      `(${REDISCOVERY_RULE})`,
  );
}

// ---------------------------------------------------------------------------
// (a)'s session-scope arm: a spec source created during `review create`'s hold
// ---------------------------------------------------------------------------

/**
 * (a): `specs/N.mdx` created during the hold of `review create --strategy
 * audit --name n` lies within the session's scope — the run exits 0, `n`
 * holds an item scoped at its section — the session file byte-equal to the
 * twin's, on which the file was created before the invocation.
 */
async function sessionScopeArm(product: ProductBinding): Promise<void> {
  const context =
    "T13.5-12(a) `review create --strategy audit --name n --json " +
    "--test-hold <path>` on a freshly built valid workspace, " +
    `${SCOPED_SPEC_PATH}, a spec source, created during its hold`;
  const change = creating(SCOPED_SPEC_PATH, SCOPED_SPEC);
  const twinSession = await withWorkspace(
    ACQUISITION_DECL,
    async (workspace) => {
      const twinContext =
        `${context} — its twin, on which that file was created before the ` +
        `invocation`;
      await buildOk(
        product,
        workspace,
        `${twinContext}: its staging \`build\``,
      );
      await change(workspace);
      const result = await runBounded(
        product,
        workspace.root,
        [...CREATE_N, "--json"],
        twinContext,
      );
      assertExitCode(
        result,
        0,
        `${twinContext}: an operation succeeding there (the arm's premise: ` +
          `SPEC 10.7)`,
      );
      return await readWritten(
        workspace.path(SESSION_N_FILE),
        `${twinContext}: the session file it writes (SPEC 10.1)`,
      );
    },
  );
  const armSession = await heldChangeRun(
    product,
    ACQUISITION_DECL,
    CREATE_N,
    change,
    context,
    async (result, workspace) => {
      assertExitCode(
        result,
        0,
        `${context}: the command succeeds over the sources its second ` +
          `discovery fixed (${REDISCOVERY_RULE})`,
      );
      // Read before any later command: the session file as the run left it.
      const bytes = await readWritten(
        workspace.path(SESSION_N_FILE),
        `${context}: the session file it writes (SPEC 10.1)`,
      );
      requireItemByScope(
        await sessionStatus(product, workspace, "n", context),
        SCOPED_SPEC_SCOPE,
        `${context}: the created source lies within the session's scope — ` +
          `an audit session holds one item per requirement node (SPEC 10.6), ` +
          `over the sources the second discovery fixed (${REDISCOVERY_RULE})`,
      );
      return bytes;
    },
  );
  assertBytesEqual(
    armSession,
    twinSession,
    `${context}: the session file ${SESSION_N_FILE} byte-equal to the ` +
      `twin's — the created source within its scope, as on the twin ` +
      `(${REDISCOVERY_RULE}; SPEC 10.1: a plain, deterministic file)`,
  );
}

// ---------------------------------------------------------------------------
// (c): the origin file created or deleted during a `rename`'s hold
// ---------------------------------------------------------------------------

/**
 * (c): on the workspace built without `specs/A.mdx`, that file created
 * during the hold of `rename specs/A.mdx a b` — the `rename` proceeds,
 * exit 0, as on the twin, on which the file was created before the
 * invocation.
 */
async function originCreatedArm(product: ProductBinding): Promise<void> {
  const context =
    "T13.5-12(c) `rename specs/A.mdx a b --json --test-hold <path>` on a " +
    `freshly built valid workspace built without ${A_PATH}, that file ` +
    "created during its hold";
  const change = creating(A_PATH, CORE_A_STAGED);
  const twin = await twinRun(
    product,
    WITHOUT_A_DECL,
    change,
    RENAME_A_B,
    `${context} — its twin, on which that file was created before the ` +
      `invocation`,
  );
  const arm = await heldChangeRun(
    product,
    WITHOUT_A_DECL,
    RENAME_A_B,
    change,
    context,
    async (result, workspace) => {
      assertExitCode(
        result,
        0,
        `${context}: the rename proceeds, exit 0 — its origin file judged ` +
          `among the sources its second discovery fixed, never its first ` +
          `(${REDISCOVERY_RULE}; 12.0)`,
      );
      return { result, final: await snapshotDirectory(workspace.root) };
    },
  );
  assertTwinResult(
    arm,
    twin,
    context,
    `the rename proceeds as on the twin (${REDISCOVERY_RULE})`,
  );
}

/**
 * (c): `specs/A.mdx` present at invocation and deleted during the hold of
 * `rename specs/A.mdx a b` — exit 2, the unknown-file usage error (`code`
 * `null`), nothing modified: the workspace once the run has ended
 * byte-identical to its state once the file was deleted (H-6).
 */
async function originDeletedArm(product: ProductBinding): Promise<void> {
  const context =
    "T13.5-12(c) `rename specs/A.mdx a b --json --test-hold <path>` on a " +
    `freshly built valid workspace, ${A_PATH} deleted during its hold`;
  await withWorkspace(ACQUISITION_DECL, async (workspace) => {
    const root = workspace.root;
    await buildOk(product, workspace, `${context}: its staging \`build\``);
    await withHeldRun(
      product,
      workspace,
      [...RENAME_A_B, "--json"],
      context,
      async (held) => {
        await deleting(A_PATH)(workspace);
        const deleted = await snapshotDirectory(root);
        const result = await liftAndWait(held, context);
        assertUsageError(
          result,
          context,
          `the origin file, deleted during the hold, is no discovered spec ` +
            `source of the second discovery — the unknown-file usage error, ` +
            `exit 2 (${REDISCOVERY_RULE}; 6.4, 12.0)`,
        );
        assertSnapshotsEqual(
          deleted,
          await snapshotDirectory(root),
          `${context}: modifies nothing — the workspace once the run has ` +
            `ended byte-identical to its state once the file was deleted, ` +
            `the run's lock path left out (SPEC 13.5, 12.0; H-6)`,
        );
      },
    );
  });
}

// ---------------------------------------------------------------------------
// (d), (e): the rediscovery's configuration error and read failure
// ---------------------------------------------------------------------------

/** `rename specs/A.mdx nope x`: (d)'s and (e)'s held `rename`. */
const RENAME_NOPE: SessionOperation = {
  what: "`rename specs/A.mdx nope x` (an unknown old ID)",
  argv: () => ["rename", A_PATH, "nope", "x"],
};

/**
 * The commands (d) and (e) hold: `rename specs/A.mdx nope x`, then each
 * other mutating command as an operation otherwise succeeding on the
 * session staging — T13.5-10's commands but its `rename` (section-13.5-ii.ts
 * `T13_5_10_OPERATIONS`).
 */
const REDISCOVERY_OPERATIONS: readonly SessionOperation[] = [
  RENAME_NOPE,
  ...T13_5_10_OPERATIONS.filter((operation) => operation !== RENAME_A),
];

/** A change the rediscovery meets, (d)'s or (e)'s. */
interface RediscoveryArm {
  readonly label: "(d)" | "(e)";
  readonly what: string;
  readonly staging: AcquisitionAfterStaging;
  readonly code: string;
  readonly path: string;
  readonly rule: string;
}

const CONFIGURATION_ERROR_ARM: RediscoveryArm = {
  label: "(d)",
  what:
    `a file created during the hold at ${DOUBLY_MATCHED_PATH}, a path the ` +
    `spec group and the code group both match and nothing occupies at ` +
    `invocation`,
  staging: DOUBLY_MATCHED_FILE,
  code: CONFIGURATION_ERROR_CODE,
  path: CONFIG_PATH,
  rule:
    "the configuration error the second discovery meets — a file both " +
    "groups match — concerning the configuration file, exit 2, reported " +
    "after acquisition's and the hold file's errors and before every other " +
    "(SPEC 13.5, 7.2, 14.14, 12.0; T12.7-3)",
};

const READ_FAILURE_ARM: RediscoveryArm = {
  label: "(e)",
  what:
    `${SUB_DIR}, a directory discovery lists, made unlistable during the ` +
    `hold (mode \`--x\`, T14-10's discipline)`,
  staging: UNLISTABLE_SUB_DIR,
  code: READ_FAILURE_CODE,
  path: SUB_DIR,
  rule:
    "the read failure the second discovery meets — its refused listing of " +
    "a directory it lists — concerning that directory, exit 2 (SPEC 13.5, " +
    "14.25)",
};

/**
 * One run of (d) or (e) with `operation` on a fresh session staging: held
 * (`withHeldRun`: the held-state comparison once it holds), `arm`'s change
 * made during the hold, the hold lifted; the ending — exit 2, `arm`'s code
 * and path — then nothing modified, the compare bracketing the run past the
 * change (a directory made unlistable: the change and its undoing too,
 * which restore its mode alone), then, the change undone, `.xspec/lock`
 * absent.
 */
async function rediscoveryRun(
  product: ProductBinding,
  operation: SessionOperation,
  arm: RediscoveryArm,
): Promise<void> {
  await withWorkspace(ACQUISITION_DECL, async (workspace) => {
    const root = workspace.root;
    const context =
      `T13.5-12${arm.label} ${operation.what} --json --test-hold <path> on ` +
      `a freshly built valid workspace configured as T13.5-12(d)'s, ` +
      `holding an \`audit\` session \`s\`, with ${arm.what}`;
    const items = await stageArmWorkspace(product, workspace, context);
    const rule =
      operation === RENAME_NOPE && arm.label === "(d)"
        ? `${arm.rule} — never the unknown-ID usage error, \`code\` \`null\``
        : arm.rule;
    await withHeldRun(
      product,
      workspace,
      [...operation.argv(items), "--json"],
      context,
      async (held) => {
        const outer =
          arm.staging.unlistable === true
            ? await snapshotDirectory(root)
            : undefined;
        let undo: (() => Promise<void>) | undefined;
        try {
          undo = await arm.staging.make(workspace, context);
          const before = outer ?? (await snapshotDirectory(root));
          const result = await liftAndWait(held, context);
          assertFailureEnding(
            result,
            { codes: [arm.code], path: arm.path },
            context,
            rule,
          );
          if (outer === undefined) {
            assertSnapshotsEqual(
              before,
              await snapshotDirectory(root),
              `${context}: modifies nothing — the workspace once the run ` +
                `has ended byte-identical to its state once the change was ` +
                `made, the run's lock path left out (SPEC 13.5, 12.0; H-6)`,
            );
          }
        } finally {
          if (undo !== undefined) await undo();
        }
        if (outer !== undefined) {
          assertSnapshotsEqual(
            outer,
            await snapshotDirectory(root),
            `${context}: modifies nothing — the workspace once the run has ` +
              `ended and the change is undone byte-identical to its state ` +
              `during the hold before the change, which with its undoing ` +
              `restores a directory's mode alone, the run's lock path left ` +
              `out (SPEC 13.5, 12.0; H-6)`,
          );
        }
      },
    );
    await assertLockPathAbsent(
      root,
      `${context}: once it has failed, exit 2, the change undone (` +
        `${RELEASE_RULE})`,
    );
  });
}

// ---------------------------------------------------------------------------
// T13.5-12
// ---------------------------------------------------------------------------

/** One arm of T13.5-12, as the body runs it. */
export interface T13512Arm {
  readonly what: string;
  readonly run: (product: ProductBinding) => Promise<void>;
}

/**
 * T13.5-12's arms in the order the body runs them: those within
 * CONF-CORE's surface first — (c), (a)'s session-scope arm, (d), (e) — then
 * (a)'s and (b)'s referencing sources, whose `d` prop and marker lie
 * outside it.
 */
export const T13_5_12_ARMS: readonly T13512Arm[] = [
  { what: "(c) origin created", run: originCreatedArm },
  { what: "(c) origin deleted", run: originDeletedArm },
  { what: "(a) session scope", run: sessionScopeArm },
  ...[CONFIGURATION_ERROR_ARM, READ_FAILURE_ARM].flatMap((arm) =>
    REDISCOVERY_OPERATIONS.map((operation) => ({
      what: `${arm.label} ${operation.what}`,
      run: (product: ProductBinding) => rediscoveryRun(product, operation, arm),
    })),
  ),
  ...REFERRING_SOURCES.map((source) => ({
    what: `(a) ${source.path} created`,
    run: (product: ProductBinding) => createdReferenceArm(product, source),
  })),
  ...REFERRING_SOURCES.map((source) => ({
    what: `(b) ${source.path} deleted`,
    run: (product: ProductBinding) => deletedReferenceArm(product, source),
  })),
];

const T13_5_12 = defineProductTest({
  id: "T13.5-12",
  title:
    'rediscovery under exclusivity, arms (a) to (e) — a mutating command holding exclusivity discovers its sources again, past the hold, and that discovery fixes the sources every later check and read consults, each change made during the hold before it is lifted, each arm under `--json` on a freshly built valid workspace (one spec group matching `specs/**/*.mdx` and `src/*.mdx`, one code group matching `src/*`): (a) `specs/R.mdx`, a spec source holding the `d` reference `A.a` to `specs/A.mdx#a`, and separately `src/use.ts`, a code source importing its module and holding the marker `A.a;`, each created during the hold of `rename specs/A.mdx a a2` — rewritten too, the result (exit code, standard output and error, final workspace) byte-equal to a twin\'s on which the file was created before the invocation, the twin\'s reference rewritten to `A.a2`; `specs/N.mdx` created during the hold of `review create --strategy audit --name n` — exit 0, within the session\'s scope, the session file byte-equal to such a twin\'s; (b) each such referencing source present at invocation and deleted during the `rename`\'s hold — exit 0, no `read-failure`, the result byte-equal to a twin\'s on which it was deleted before the invocation; (c) on a workspace built without `specs/A.mdx`, that file created during the hold of `rename specs/A.mdx a b` — exit 0, as on a twin on which it was created before the invocation; `specs/A.mdx` present at invocation and deleted during the hold — exit 2, the unknown-file usage error (`code` `null`), nothing modified; (d) a file created at `src/both.mdx`, a path both groups match and nothing occupies at invocation, during the hold of `rename specs/A.mdx nope x` — exit 2, `code` `"configuration-error"`, `path` `"xspec.config.ts"`, never the unknown-ID usage error, nothing modified, `.xspec/lock` absent afterwards; (e) `specs/sub`, a directory discovery lists, made `--x` during the hold — exit 2, `code` `"read-failure"`, `path` `"specs/sub"`, nothing modified, `.xspec/lock` absent afterwards; (d) and (e) likewise with `move specs/A.mdx specs/B.mdx`, `review create --strategy audit --name t`, `review resolve s <item> --status no-change`, and `review split s <item>` on a workspace holding an `audit` session `s`, each an operation otherwise succeeding; each held run\'s held-state comparison made once it holds (SPEC 13.5, 12.0, 6.4, 14.14, 14.25)',
  run: async (product) => {
    for (const arm of T13_5_12_ARMS) {
      await arm.run(product);
    }
  },
});

/** TEST-SPEC §13.5, part iv, in canonical ID order (SUITE-48). */
export const section135ivTests: readonly ProductTestEntry[] = [T13_5_12];
