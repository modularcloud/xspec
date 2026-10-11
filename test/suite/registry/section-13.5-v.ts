// TEST-SPEC §13.5 (concurrency and isolation), part v — SUITE-48: T13.5-9
// (the exclusion's reach), registered whole.
//
// SPEC 13.5: while one run holds exclusivity, every other run on the
// machine against the same workspace that reaches acquisition — by any user
// who can write it, in any environment, through any path to its root
// directory, a symbolic link above the root or another mount of it included
// — fails there promptly, modifying nothing, with the usage error of 14.26,
// or of 14.25 or 14.24 should the environment refuse a read or write
// acquisition makes; and no acquisition or release removes or alters a live
// run's entry. Exclusivity is kept in the workspace, in the lock directory
// `.xspec/lock`, an entry there of a run alive on this machine — alive in
// the acquiring process's process list under the identifier the entry's
// name records — refusing acquisition.
//
// Every arm starts from the session staging (section-13.5-ii.ts
// `stageArmWorkspace`: a fresh CONF-CORE-shaped workspace, `build`, `review
// create --strategy audit --name s`, the session's items read by `review
// status s --json`, `.xspec/lock` checked absent). The holder is `review
// resolve s <leaf item> --status skipped --test-hold <path>` (the hold path
// outside the workspace), started by the harness's own identity, from the
// workspace root, in the harness's environment (in (a), that environment
// with `TMPDIR`, `HOME`, and `XDG_RUNTIME_DIR` set to the holder's own
// directories); its hold file awaited, the held-state comparison
// (TEST-SPEC §13.5's preamble; helpers/lock-state.ts `assertHeldState`) is
// made once it holds, against the workspace before it started, observing
// its entry. While it holds, each mutating command in turn — `rename
// specs/A.mdx a a2`, `move specs/A.mdx specs/B.mdx`, `review create
// --strategy audit --name t`, `review resolve s <leaf item> --status
// no-change`, and `review split s <parent item>` (section-13.5-ii.ts
// `T13_5_10_OPERATIONS`), each an operation succeeding on an unheld twin —
// runs as a second run in the arm's situation, under `--json`, bounded (a
// hang guard, H-10), and must exit 2 while the holder still holds, its
// stdout the 12.7 error document — `code` `"workspace-busy"`, `path`
// `".xspec/lock"`, `locations` `[]` (14.26) in (a)–(c) — modifying nothing
// (the compare bracketing this run alone, its baseline taken while the
// holder holds, the lock path left out: H-6, the lock directory judged
// apart), the holder's entry byte-identical, name and content, and again
// the lock directory's only entry once the second run has exited
// (helpers/lock-state.ts `assertOnlyEntry`). A refusal modifies nothing, so
// each command in turn meets the state the one before it met. Once the five
// have run, the hold is lifted and the holder completes, exit 0 (SPEC 10.7,
// 13.5), so the refusals it saw are attributable to it alone.
//
// The situations of the second runs:
// (a) a different environment: the holder's and the second runs' `TMPDIR`,
//     `HOME`, and `XDG_RUNTIME_DIR` set to six distinct existing
//     directories outside the root, and unrelated variables added to the
//     second runs';
// (b) a different working directory: the root's subdirectory `specs`, and a
//     directory outside the root with the configuration named through
//     `--config` (relative: `../work/xspec.config.ts`), each given as the
//     working directory and as `PWD`, as a shell that `cd`ed there presents
//     it;
// (c) a different path to the root: through a symbolic link above the root
//     (the harness's own: `elsewhere/link` beside the root, targeting the
//     root's parent, the working directory `elsewhere/link/work`, verified to
//     resolve to the root), and through a second mount of the root (a bind
//     mount under the workspace's temporary directory, made with E-1's
//     administrative access and verified — helpers/machine-staging.ts
//     `stageSecondMount`: a file the harness creates through either path
//     appears through the other, the two paths distinct mount points —
//     removed before the workspace is);
// (d) a different user who can write the workspace: the second user
//     (helpers/machine-staging.ts `ensureSecondUser`: an unprivileged
//     identity distinct from the harness's, sharing its group), the
//     workspace staged group-readable and group-writable, its directories
//     group-searchable (`stageGroupAccess`, made once `.xspec` exists, undone
//     at the arm's end), the second user verified on the harness before use
//     (`verifySecondUserReach`: its uid not the harness's; it lists every
//     directory and reads every file under the root, the configuration and
//     every discovered source among them; it creates and removes a file in
//     the root and in `.xspec`; it reaches the product's executable; each
//     identity's process list lists the other's process), each second run
//     started as it through its launcher (`secondUserLauncher`: sudo, then
//     unprivileged, the harness's umask, resource limits, and the driver's
//     environment) — exit 2 with `code` `"workspace-busy"`, or
//     `"write-failure"` or `"read-failure"`, `path` `".xspec/lock"`, never
//     success (the modes of the lock directory and its entries are the
//     product's own, and may refuse that user acquisition's read or write);
//     and again with `.xspec/lock` made by the harness before the holder
//     starts — an empty directory the shared group may list, write, and
//     search (mode 0770), which acquisition keeps — the second user verified
//     before the holder starts to create and remove a file there too (a
//     failure an ineffective staging, H-11), and asked again once the holder
//     holds (`secondUserCreatesIn`): able, exactly `"workspace-busy"` at
//     `".xspec/lock"` — failing a product that judges a live holder of
//     another user dead because its liveness probe is refused — and unable,
//     the holder's acquisition having withdrawn that access, the lenient
//     expectation above. After each run as the second user, and before the
//     workspace's disposal, everything under the root is reclaimed for the
//     harness (`reclaimForHarness`), so a product writing as the second user
//     where it must be refused still fails diagnosed (H-8).
//
// A product keeping its exclusion state outside the workspace — under a
// temporary, home, or runtime directory, or per user — fails (a) or (d)
// where that state follows the environment or the user, and fails the
// held-state comparison wherever it lies, `.xspec/lock` not holding the
// held run's entry; one keying the workspace by the spelling of its root's
// path fails (b) or (c).
//
// The body runs the unheld twins first — S-7's empty stub fails at the
// first, before anything needing administrative access is reached — then
// the arms needing none ((a), (b), (c)'s symbolic link:
// `runT1359PlainArms`), and last the arms whose stagings need E-1's
// administrative access ((c)'s second mount, (d), and (d) again:
// `runT1359MachineArms`); a runner withholding that access fails them as
// harness errors, never skips (E-1, H-9, H-11). Mounts and the second user's
// runs are each arm's own, undone with it (E-3).
//
// CERTIFICATIONS.md: T13.5-9 lies in no certification scope (the Exclusions
// entry for T13.5-9 through T13.5-12 and T13.4-12): its stagings need a
// second user and a second mount, and every held arm makes the held-state
// comparison, which a product keeping its exclusion state anywhere but the
// lock directory fails loud. The Linux leg's stagings (E-1).

import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { assertExitCode, fail } from "../../helpers/assertions.js";
import { EXCLUDE_LOCK_PATH, LOCK_PATH } from "../../helpers/lock-path.js";
import type { LockEntry } from "../../helpers/lock-staging.js";
import { AREA_PATH } from "../../helpers/lock-staging.js";
import { assertHeldState, assertOnlyEntry } from "../../helpers/lock-state.js";
import type { SecondUser } from "../../helpers/machine-staging.js";
import {
  ensureSecondUser,
  reclaimForHarness,
  secondUserCreatesIn,
  secondUserLauncher,
  stageGroupAccess,
  stageSecondMount,
  verifySecondUserReach,
} from "../../helpers/machine-staging.js";
import { HarnessStagingError } from "../../helpers/permissions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import {
  assertSnapshotsEqual,
  snapshotDirectory,
} from "../../helpers/snapshot.js";
import type {
  ProductBinding,
  RunLauncher,
  RunningProduct,
  RunResult,
} from "../../helpers/subprocess.js";
import {
  releaseHoldFile,
  rethrowHarnessError,
  runProduct,
  startProduct,
} from "../../helpers/subprocess.js";
import type { WorkspaceDecl } from "../../helpers/workspace.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import { stageArmWorkspace, T13_5_10_OPERATIONS } from "./section-13.5-ii.js";
import type { SessionItems, SessionOperation } from "./section-13.5.js";
import {
  CONFIG_PATH,
  CORE_DECL,
  describeExit,
  runBounded,
} from "./section-13.5.js";
import { assertSameJson, expectErrorDocument } from "./support.js";
import { awaitHoldFile, holdPathFor } from "./write-refusal-staging.js";

/** The stable code of 14.26, the busy refusal. */
const WORKSPACE_BUSY = "workspace-busy";

/** The stable code of 14.24, the write failure. */
const WRITE_FAILURE = "write-failure";

/** The stable code of 14.25, the read failure. */
const READ_FAILURE = "read-failure";

/**
 * The holder's hang guard: its hold spans five second runs and, in (d),
 * the second user's probes (H-10: a hang guard, never an assertion input;
 * a holder hanging once lifted fails diagnosed at it).
 */
const HOLDER_TIMEOUT_MS = 300_000;

/**
 * A second run's hang guard (H-10): a refusal is prompt, so a run still
 * going at the bound — sudo's start included for the second user's — is a
 * product blocking or hanging, killed and diagnosed (H-8).
 */
const SECOND_RUN_TIMEOUT_MS = 30_000;

/** The root's subdirectory (b) starts from: CORE_DECL's spec directory. */
const SUBDIRECTORY = "specs";

/** The mode of the lock directory the harness makes in (d) again: rwxrwx---. */
const SHARED_LOCK_DIRECTORY_MODE = 0o770;

/**
 * The unrelated variables (a) adds to the second runs' environment: names
 * no xspec rule or platform convention reads.
 */
const UNRELATED_VARIABLES: Readonly<Record<string, string>> = {
  T13_5_9_UNRELATED_NOTE: "an unrelated variable",
  HARNESS_UNRELATED_FLAG: "1",
};

/** The holder's arguments: `review resolve s <leaf item> --status skipped`. */
function holderArgv(items: SessionItems): readonly string[] {
  return ["review", "resolve", "s", items.leaf, "--status", "skipped"];
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

/** The held `review resolve`, as `withHolder` hands it to its body. */
interface Holder {
  readonly running: RunningProduct;
  /**
   * Its entry as the held-state comparison observed it once it held — name
   * bytes, content, and mode (H-4: observed, never pinned).
   */
  readonly entry: LockEntry;
}

/**
 * Run `body` while the holder — `review resolve s <leaf item> --status
 * skipped --test-hold <path>`, started by the harness's own identity from
 * the workspace root, in the harness's environment with `env` merged over it
 * — holds `workspace`: the workspace's state taken just before it starts,
 * its hold file awaited (the hold path outside the workspace), and the
 * held-state comparison made against that state once it holds (TEST-SPEC
 * §13.5's preamble), observing its entry; then the hold lifted and the
 * holder required to complete, exit 0 (SPEC 10.7, 13.5), so the refusals
 * `body` observed are attributable to it alone. A wait it never ends fails
 * diagnosed (H-8); a harness error propagates as itself (H-11). Whatever
 * happens, the holder is killed (a no-op once it has exited) and its hold
 * file removed.
 */
async function withHolder<T>(
  product: ProductBinding,
  workspace: TestWorkspace,
  items: SessionItems,
  context: string,
  env: Readonly<Record<string, string>> | undefined,
  body: (holder: Holder) => Promise<T>,
): Promise<T> {
  const hold = holdPathFor(workspace, "hold-reach.tmp");
  const baseline = await snapshotDirectory(workspace.root);
  const running = await startProduct(product, {
    cwd: workspace.root,
    argv: [...holderArgv(items), "--test-hold", hold],
    env,
    timeoutMs: HOLDER_TIMEOUT_MS,
  });
  try {
    await awaitHoldFile(running, hold, context);
    const entries = await assertHeldState(
      workspace.root,
      { baseline, heldRuns: 1 },
      `${context}, once it holds, against the workspace before it started`,
    );
    const [entry] = entries;
    if (entry === undefined || entries.length !== 1) {
      throw new Error(
        `T13.5-9: assertHeldState returned ${String(entries.length)} ` +
          `entries for one held run`,
      );
    }
    const value = await body({ running, entry });
    await releaseHoldFile(hold);
    let result: RunResult;
    try {
      result = await running.waitForExit();
    } catch (error) {
      rethrowHarnessError(error);
      return fail(
        `${context}: once its hold file is deleted the holder must proceed ` +
          `and exit (SPEC 13.5) — ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
    assertExitCode(
      result,
      0,
      `${context}: once its hold is lifted it completes its resolution, ` +
        `exit 0 (SPEC 10.7, 13.5), so the refusals while it held are ` +
        `attributable to it alone`,
    );
    return value;
  } finally {
    running.kill();
    await releaseHoldFile(hold);
  }
}

// ---------------------------------------------------------------------------
// The second runs
// ---------------------------------------------------------------------------

/** How a second run is started: the arm's situation (module header). */
interface Situation {
  /** The arm, as its diagnoses name it: `(a) a different environment`. */
  readonly arm: string;
  /** The working directory, absolute. */
  readonly cwd: string;
  /** Arguments after the operation's own: `--config <path>` where named. */
  readonly extraArgs?: readonly string[];
  /** Merged over the driver's environment (helpers/subprocess.ts). */
  readonly env?: Readonly<Record<string, string>>;
  /** (d)'s second user's launcher (H-2). */
  readonly launcher?: RunLauncher;
  /**
   * Run once each second run has exited, before anything is observed:
   * (d)'s reclaiming of the root for the harness.
   */
  readonly afterRun?: () => Promise<void>;
}

/**
 * Which ending a second run must meet: `"busy"`, exactly `"workspace-busy"`;
 * `"lenient"`, `"workspace-busy"`, `"write-failure"`, or `"read-failure"`
 * ((d): the environment may refuse the second user a read or write
 * acquisition makes) — each at `".xspec/lock"`, exit 2.
 */
export type Expectation = "busy" | "lenient";

/** The codes each expectation admits. */
const ADMITTED: Readonly<Record<Expectation, readonly string[]>> = {
  busy: [WORKSPACE_BUSY],
  lenient: [WORKSPACE_BUSY, WRITE_FAILURE, READ_FAILURE],
};

/** One second run's ending, as an arm reports it. */
export interface ReachOutcome {
  readonly operation: string;
  /** The error document's `code`. */
  readonly code: string | null;
}

/**
 * Run a second run to completion under its hang guard, converting a
 * rejection (a product that blocks or hangs, killed at the bound) into a
 * diagnosed failure (H-8); a harness error — the driver's, or a staging
 * error of the launcher — propagates as itself (H-11).
 */
async function runSecond(
  product: ProductBinding,
  situation: Situation,
  argv: readonly string[],
  context: string,
): Promise<RunResult> {
  try {
    return await runProduct(product, {
      cwd: situation.cwd,
      argv,
      env: situation.env,
      launcher: situation.launcher,
      timeoutMs: SECOND_RUN_TIMEOUT_MS,
    });
  } catch (error) {
    rethrowHarnessError(error);
    if (error instanceof HarnessStagingError) throw error;
    return fail(
      `${context}: the command must terminate on its own — promptly, ` +
        `never waiting for the holder's exclusivity to end — rather than ` +
        `block or hang (SPEC 13.5, 12.0; H-8: hangs become diagnosed ` +
        `failures) — ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * One second run while the holder holds (TEST-SPEC T13.5-9): `operation`
 * under `--json` in `situation`, bounded — exit 2, exiting while the holder
 * still holds (SPEC 13.5: promptly, never waiting for the holder's
 * exclusivity to end); its stdout the 12.7 error document, its `code` one
 * `expectation` admits, `path` `".xspec/lock"`, `locations` `[]` (14.26,
 * 14.24, 14.25; `message` and `identities` informational); modifying
 * nothing — the compare bracketing this run alone, its baseline taken while
 * the holder holds, the lock path left out (H-6: the run reaches
 * acquisition, whose writes and release's count as no modification); and
 * the holder's entry byte-identical, name and content, and again the lock
 * directory's only entry (SPEC 13.5: no acquisition or release removes or
 * alters a live run's entry, and the refused run's release deletes its
 * own). Returns its ending.
 */
async function secondRun(
  product: ProductBinding,
  workspace: TestWorkspace,
  holder: Holder,
  items: SessionItems,
  operation: SessionOperation,
  situation: Situation,
  expectation: Expectation,
): Promise<ReachOutcome> {
  const root = workspace.root;
  const context =
    `T13.5-9${situation.arm}: ${operation.what} --json, a second run ` +
    `while the held \`review resolve\` holds`;
  const before = await snapshotDirectory(root, EXCLUDE_LOCK_PATH);
  const result = await runSecond(
    product,
    situation,
    [...operation.argv(items), ...(situation.extraArgs ?? []), "--json"],
    context,
  );
  await situation.afterRun?.();
  const admitted = ADMITTED[expectation];
  const rule =
    expectation === "busy"
      ? `another run alive on this machine holds exclusivity in the same ` +
        `workspace, which the second run reaches — so it fails at ` +
        `acquisition, promptly, modifying nothing, with the usage error of ` +
        `14.26 (SPEC 13.5, 14.26, 12.0)`
      : `another run alive on this machine holds exclusivity in the same ` +
        `workspace, which this user can write — so the run fails at ` +
        `acquisition, promptly, modifying nothing, with the usage error of ` +
        `14.26, or of 14.24 or 14.25 where the environment refuses this ` +
        `user a write or read acquisition makes; never success (SPEC 13.5, ` +
        `14.24–14.26, 12.0)`;
  assertExitCode(result, 2, `${context}: ${rule}`);
  if (holder.running.hasExited()) {
    fail(
      `${context}: the holder must still hold when the second run exits — ` +
        `the refusal is prompt, never a wait for the holder's exclusivity ` +
        `to end (SPEC 13.5) — ${await describeExit(holder.running)}`,
    );
  }
  const finding = expectErrorDocument(result, context);
  const code = finding.code;
  if (code === null || !admitted.includes(code)) {
    fail(
      `${context}: ${rule}; the error document's \`code\` must be ` +
        `${admitted.map((admit) => JSON.stringify(admit)).join(" or ")}, ` +
        `not ${JSON.stringify(code)} — message: ${JSON.stringify(finding.message)}`,
    );
  }
  assertSameJson(
    { path: finding.path, locations: finding.locations },
    { path: LOCK_PATH, locations: [] },
    `${context}: the refusal at acquisition concerns the lock path ` +
      `"${LOCK_PATH}" and carries no locations (SPEC 14.26, 14.24, 14.25, ` +
      `12.7; \`message\` and \`identities\` informational) — code ` +
      `${JSON.stringify(code)}, message: ${JSON.stringify(finding.message)}`,
  );
  assertSnapshotsEqual(
    before,
    await snapshotDirectory(root, EXCLUDE_LOCK_PATH),
    `${context}: modifies nothing — every workspace path but the lock path ` +
      `byte-identical, the compare bracketing this run alone, its baseline ` +
      `taken while the holder already held (SPEC 13.5; H-6: the lock path, ` +
      `judged apart, left out)`,
  );
  await assertOnlyEntry(
    root,
    holder.entry,
    `${context}: once the second run has exited, the holder's entry`,
  );
  return { operation: operation.what, code };
}

/**
 * Every mutating command in turn as a second run in `situation` (module
 * header) while the holder holds `workspace` — the holder started with
 * `holderEnv` merged over the harness's environment — each judged by
 * `secondRun` under the expectation `expectation` decides once the holder
 * holds. Returns the expectation and each run's ending.
 */
async function secondRunsWhileHeld(
  product: ProductBinding,
  workspace: TestWorkspace,
  items: SessionItems,
  situation: Situation,
  options: {
    readonly holderEnv?: Readonly<Record<string, string>>;
    readonly expectation?: () => Promise<Expectation>;
  } = {},
): Promise<ArmReport> {
  return await withHolder(
    product,
    workspace,
    items,
    `T13.5-9${situation.arm}: the held \`review resolve s <leaf item> ` +
      `--status skipped --test-hold <path>\`, started by the harness's own ` +
      `identity from the workspace root`,
    options.holderEnv,
    async (holder) => {
      const expectation =
        options.expectation === undefined
          ? "busy"
          : await options.expectation();
      const outcomes: ReachOutcome[] = [];
      for (const operation of T13_5_10_OPERATIONS) {
        outcomes.push(
          await secondRun(
            product,
            workspace,
            holder,
            items,
            operation,
            situation,
            expectation,
          ),
        );
      }
      return { arm: situation.arm, expectation, outcomes };
    },
  );
}

/** One arm's report: the expectation its runs met, and their endings. */
export interface ArmReport {
  readonly arm: string;
  readonly expectation: Expectation;
  readonly outcomes: readonly ReachOutcome[];
}

// ---------------------------------------------------------------------------
// The unheld twins, and the arms needing no administrative access
// ---------------------------------------------------------------------------

/**
 * The unheld twin of `operation` (TEST-SPEC T13.5-9: each mutating command
 * an operation succeeding on an unheld twin): the session staging, nothing
 * held, and the operation under `--json`, bounded — exit 0, so its exit 2
 * as a second run while the holder holds is the exclusion's alone.
 */
async function unheldTwin(
  product: ProductBinding,
  operation: SessionOperation,
): Promise<void> {
  await withWorkspace(CORE_DECL, async (workspace) => {
    const context = `T13.5-9: the unheld twin of ${operation.what} --json`;
    const items = await stageArmWorkspace(product, workspace, context);
    assertExitCode(
      await runBounded(
        product,
        workspace.root,
        [...operation.argv(items), "--json"],
        context,
      ),
      0,
      `${context}: each command T13.5-9 runs as a second run is an ` +
        `operation succeeding on an unheld twin — the same staging, nothing ` +
        `held (SPEC 13.5) — so its exit 2 while the holder holds is the ` +
        `exclusion's alone`,
    );
  });
}

/** The variables (a) sets, for the holder and the second runs apart. */
const ENVIRONMENT_DIRECTORIES = ["TMPDIR", "HOME", "XDG_RUNTIME_DIR"] as const;

/**
 * (a)'s environment for `who`: `TMPDIR`, `HOME`, and `XDG_RUNTIME_DIR`, each
 * set to a fresh existing directory of its own beside the root, under the
 * workspace's temporary directory — the holder's and the second runs' six
 * directories distinct.
 */
async function environmentOf(
  workspace: TestWorkspace,
  who: "holder" | "second",
): Promise<Record<string, string>> {
  const env: Record<string, string> = {};
  for (const name of ENVIRONMENT_DIRECTORIES) {
    const dir = path.join(
      workspace.tempRoot,
      `environment-${who}-${name.toLowerCase()}`,
    );
    await fsp.mkdir(dir, { mode: 0o700 });
    env[name] = dir;
  }
  return env;
}

/**
 * (a) a different environment: the holder started with its own `TMPDIR`,
 * `HOME`, and `XDG_RUNTIME_DIR`, each second run from the root with three
 * others and unrelated variables added.
 */
async function differentEnvironmentArm(
  product: ProductBinding,
): Promise<ArmReport> {
  return await withWorkspace(CORE_DECL, async (workspace) => {
    const arm =
      "(a) a different environment (`TMPDIR`, `HOME`, and " +
      "`XDG_RUNTIME_DIR` set, for the holder and the second run, to " +
      "different existing directories, unrelated variables added)";
    const items = await stageArmWorkspace(product, workspace, `T13.5-9${arm}`);
    const holderEnv = await environmentOf(workspace, "holder");
    const secondEnv = await environmentOf(workspace, "second");
    return await secondRunsWhileHeld(
      product,
      workspace,
      items,
      {
        arm,
        cwd: workspace.root,
        env: { ...secondEnv, ...UNRELATED_VARIABLES },
      },
      { holderEnv },
    );
  });
}

/**
 * (b) a different working directory, the root's subdirectory `specs`: each
 * second run started there, `PWD` naming it.
 */
async function subdirectoryArm(product: ProductBinding): Promise<ArmReport> {
  return await withWorkspace(CORE_DECL, async (workspace) => {
    const arm = `(b) a different working directory (the root's subdirectory \`${SUBDIRECTORY}\`)`;
    const items = await stageArmWorkspace(product, workspace, `T13.5-9${arm}`);
    const cwd = workspace.path(SUBDIRECTORY);
    return await secondRunsWhileHeld(product, workspace, items, {
      arm,
      cwd,
      env: { PWD: cwd },
    });
  });
}

/**
 * (b) a different working directory outside the root: each second run
 * started from a fresh directory beside it, `PWD` naming that directory,
 * the configuration named through `--config` relative to it
 * (`../work/xspec.config.ts`).
 */
async function outsideDirectoryArm(
  product: ProductBinding,
): Promise<ArmReport> {
  return await withWorkspace(CORE_DECL, async (workspace) => {
    const outside = path.join(workspace.tempRoot, "outside");
    await fsp.mkdir(outside);
    const config = path
      .relative(outside, workspace.path(CONFIG_PATH))
      .split(path.sep)
      .join("/");
    const arm =
      `(b) a different working directory (a directory outside the root, ` +
      `the configuration named through \`--config ${config}\`)`;
    const items = await stageArmWorkspace(product, workspace, `T13.5-9${arm}`);
    return await secondRunsWhileHeld(product, workspace, items, {
      arm,
      cwd: outside,
      extraArgs: ["--config", config],
      env: { PWD: outside },
    });
  });
}

/**
 * (c) a different path to the root, through a symbolic link above it — the
 * harness's own: `elsewhere/link` beside the root, targeting the root's
 * parent — each second run started at `elsewhere/link/work`, `PWD` naming
 * that path. The staging is verified on the harness first: the link a
 * symbolic link, the path resolving to the root; anything else is a
 * harness error (H-11).
 */
async function symbolicLinkArm(product: ProductBinding): Promise<ArmReport> {
  return await withWorkspace(CORE_DECL, async (workspace) => {
    const arm =
      "(c) a different path to the root (through a symbolic link above the " +
      "root)";
    const items = await stageArmWorkspace(product, workspace, `T13.5-9${arm}`);
    const elsewhere = path.join(workspace.tempRoot, "elsewhere");
    await fsp.mkdir(elsewhere);
    const link = path.join(elsewhere, "link");
    await fsp.symlink(workspace.tempRoot, link);
    const cwd = path.join(link, path.basename(workspace.root));
    const [realCwd, realRoot] = await Promise.all([
      fsp.realpath(cwd),
      fsp.realpath(workspace.root),
    ]);
    if (!(await fsp.lstat(link)).isSymbolicLink() || realCwd !== realRoot) {
      throw new Error(
        `T13.5-9(c): the staging is ineffective (H-11): ${cwd} must reach ` +
          `the root ${realRoot} through the symbolic link ${link}; it ` +
          `resolves to ${realCwd}`,
      );
    }
    return await secondRunsWhileHeld(product, workspace, items, {
      arm,
      cwd,
      env: { PWD: cwd },
    });
  });
}

/**
 * T13.5-9's unheld twins and its arms needing no administrative access —
 * (a), (b)'s two working directories, and (c)'s symbolic link — in turn,
 * against `product`: the registered body's first part, which a machine
 * withholding E-1's administrative access can run alone (AGENTS.md).
 * Returns each arm's report.
 */
export async function runT1359PlainArms(
  product: ProductBinding,
): Promise<ArmReport[]> {
  for (const operation of T13_5_10_OPERATIONS) {
    await unheldTwin(product, operation);
  }
  return [
    await differentEnvironmentArm(product),
    await subdirectoryArm(product),
    await outsideDirectoryArm(product),
    await symbolicLinkArm(product),
  ];
}

// ---------------------------------------------------------------------------
// The arms needing administrative access (E-1)
// ---------------------------------------------------------------------------

/**
 * (c) a different path to the root, through a second mount of it: the root
 * bind-mounted under the workspace's temporary directory, verified
 * (`stageSecondMount`), each second run started at the mount point, `PWD`
 * naming it; the mount removed before the workspace is.
 */
async function secondMountArm(product: ProductBinding): Promise<ArmReport> {
  return await withWorkspace(CORE_DECL, async (workspace) => {
    const arm =
      "(c) a different path to the root (through a second mount of the " +
      "root)";
    const items = await stageArmWorkspace(product, workspace, `T13.5-9${arm}`);
    const mount = await stageSecondMount(workspace.root, workspace.tempRoot);
    try {
      return await secondRunsWhileHeld(product, workspace, items, {
        arm,
        cwd: mount.path,
        env: { PWD: mount.path },
      });
    } finally {
      await mount.remove();
    }
  });
}

/**
 * (d) a different user who can write the workspace — and, where
 * `sharedLockDirectory`, (d) again with `.xspec/lock` made by the harness
 * before the holder starts, an empty directory the shared group may list,
 * write, and search, which acquisition keeps (module header). The session
 * staging made, the workspace is staged for the shared group and the second
 * user verified on the harness (a failure is an ineffective staging, H-11:
 * `HarnessStagingError`), creating and removing a file in the harness's lock
 * directory too where there is one; each second run is started from the
 * root as the second user. Without the harness's lock directory each ending
 * is judged leniently; with it, exactly `"workspace-busy"` where the second
 * user can still create and remove a file there once the holder holds, and
 * leniently where the holder's acquisition withdrew that access. After each
 * second run, and whatever happens before the workspace's disposal,
 * everything under the root is reclaimed for the harness; the group
 * staging is undone.
 */
async function secondUserArm(
  product: ProductBinding,
  user: SecondUser,
  sharedLockDirectory: boolean,
): Promise<ArmReport> {
  return await withWorkspace(CORE_DECL, async (workspace) => {
    const root = workspace.root;
    const arm = sharedLockDirectory
      ? "(d) again (a different user who can write the workspace, " +
        "`.xspec/lock` made by the harness before the holder starts — an " +
        "empty directory the shared group may list, write, and search)"
      : "(d) a different user who can write the workspace";
    const items = await stageArmWorkspace(product, workspace, `T13.5-9${arm}`);
    const area = workspace.path(AREA_PATH);
    const lockDirectory = workspace.path(LOCK_PATH);
    if (sharedLockDirectory) {
      await fsp.mkdir(lockDirectory);
      await fsp.chmod(lockDirectory, SHARED_LOCK_DIRECTORY_MODE);
    }
    const access = await stageGroupAccess(root);
    try {
      await verifySecondUserReach(user, {
        root,
        createIn: sharedLockDirectory
          ? [root, area, lockDirectory]
          : [root, area],
        binding: product,
      });
      const launcher = await secondUserLauncher(user);
      return await secondRunsWhileHeld(
        product,
        workspace,
        items,
        {
          arm,
          cwd: root,
          launcher,
          afterRun: () => reclaimForHarness(root),
        },
        {
          expectation: async () => {
            if (!sharedLockDirectory) return "lenient";
            const onceHeld = await secondUserCreatesIn(user, lockDirectory);
            return onceHeld.ok ? "busy" : "lenient";
          },
        },
      );
    } finally {
      await reclaimForHarness(root);
      await access.restore();
    }
  });
}

/**
 * T13.5-9's arms needing E-1's administrative access — (c)'s second mount,
 * (d), and (d) again — in turn, against `product`: the registered body's
 * last part, which a probe runs alone where that access is (CI's Linux
 * legs; AGENTS.md). A runner withholding it fails them as harness errors,
 * never skips (E-1, H-9, H-11). Returns each arm's report.
 */
export async function runT1359MachineArms(
  product: ProductBinding,
): Promise<ArmReport[]> {
  const reports = [await secondMountArm(product)];
  const user = await ensureSecondUser();
  reports.push(await secondUserArm(product, user, false));
  reports.push(await secondUserArm(product, user, true));
  return reports;
}

// ---------------------------------------------------------------------------
// T13.5-9
// ---------------------------------------------------------------------------

const T13_5_9 = defineProductTest({
  id: "T13.5-9",
  title:
    '13.5\'s reach: while a `review resolve s <item> --status skipped --test-hold <path>` started by the harness\'s own identity, from the workspace root, in the harness\'s environment, is held — the held-state comparison holding once it holds — each mutating command in turn (`rename specs/A.mdx a a2`, `move specs/A.mdx specs/B.mdx`, `review create --strategy audit --name t`, `review resolve s <item> --status no-change`, `review split s <item>`; each an operation succeeding on an unheld twin, exit 0) runs as a second run in each situation, under `--json`, and fails promptly, exiting while the hold stands, with exit 2 and nothing modified, the holder\'s entry byte-identical, name and content, and again the lock directory\'s only entry once the second run has exited: (a) a different environment — `TMPDIR`, `HOME`, and `XDG_RUNTIME_DIR` each set, for the holder and the second run, to different existing directories, unrelated variables added to the second run\'s; (b) a different working directory — the root\'s subdirectory `specs`, and a directory outside the root with the configuration named through `--config` (each given as `PWD` too); (c) a different path to the root — through a symbolic link above the root, and through a second mount of the root (a bind mount) — each of (a)–(c) with `code` `"workspace-busy"`, `path` `".xspec/lock"`, `locations` `[]`; (d) a different user who can write the workspace (an unprivileged identity distinct from the harness\'s, sharing its group, the workspace group-readable and group-writable, its directories group-searchable) — `"workspace-busy"`, or `"write-failure"` or `"read-failure"`, at `".xspec/lock"`, never success; and (d) again with `.xspec/lock` made by the harness before the holder starts, an empty directory the shared group may list, write, and search — exactly `"workspace-busy"` at `".xspec/lock"`, the second user\'s creation and removal of a file there verified before the holder starts (a failure an ineffective staging) and again once it holds (a failure leaving the lenient expectation); the holder completing, exit 0; the mount and the second user made with E-1\'s administrative access and verified on the harness before use — a file created through either path appearing through the other, the two paths distinct mount points; the second user\'s uid not the harness\'s, every directory listed and every file read by it, a file created and removed by it in the root and in `.xspec`, each identity\'s process list listing the other\'s — an ineffective staging a harness error, never a pass or a skip (SPEC 13.5, 14.24, 14.25, 14.26, 12.0, H-6)',
  timeoutMs: 600_000,
  run: async (product) => {
    await runT1359PlainArms(product);
    await runT1359MachineArms(product);
  },
});

/** TEST-SPEC §13.5, part v, in canonical ID order (SUITE-48). */
export const section135vTests: readonly ProductTestEntry[] = [T13_5_9];
