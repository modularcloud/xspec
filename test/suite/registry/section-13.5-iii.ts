// TEST-SPEC §13.5 (concurrency and isolation), part iii — SUITE-48:
// T13.5-11 (release), registered with (b), (c), and (d) whole and with
// these of (a)'s endings: each mutating command's success, its usage errors
// past acquisition, the exit-1 refusals (a) lists, and the busy refusal.
// (a)'s other endings — a read failure past acquisition and a configuration
// error the rediscovery meets (T13.5-12(e), (d)), acquisition's own read and
// write failures outside the residue cases (T13.5-10(d)), and T13.5-7's
// write failures but (b)'s — are not yet observed here (FIX_PLAN Tasks 29b
// and 29c add them).
//
// Release (SPEC 13.5): a command ending normally — completed, refused, or
// failed, at acquisition or at a refused write or read included — deletes
// its entry, then the lock directory when that holds nothing else, then
// `.xspec` when its acquisition created it and it then holds nothing else;
// release reads nothing, and a deletion the environment refuses changes no
// outcome and is no write failure (14.24).
//
// Every arm but (b)'s starts from the session staging on a fresh
// CONF-CORE-shaped workspace (section-13.5-ii.ts `stageArmWorkspace`:
// `build`, `review create --strategy audit --name s`, the session's items
// read by `review status s --json`, `.xspec/lock` checked absent once those
// runs have ended — itself release after a success); every command runs
// under `--json`, bounded (`runBounded`) or, held, under a hang guard (H-8,
// H-10); every held run is started with its hold path outside the
// workspace, and once it holds the held-state comparison (TEST-SPEC §13.5's
// preamble; helpers/lock-state.ts `assertHeldState`) is made against the
// workspace before it started, observing its entry — the lock directory's
// only one.
//
// (a) `.xspec/lock` absent after each ending (SPEC 13.5: release on every
// normal end):
// - Each mutating command's success, exit 0 — each of T13.5-10's commands
//   (section-13.5-ii.ts `T13_5_10_OPERATIONS`: `rename specs/A.mdx a a2`,
//   `move specs/A.mdx specs/B.mdx`, `review create --strategy audit --name
//   t`, `review resolve s <g's item> --status no-change`, `review split s
//   <a's item>`) on a session staging of its own; each run is the unstaged
//   twin whose outcome (c) and (d) compare with.
// - Its usage errors past acquisition, exit 2 with the error document,
//   `code` `null` (SPEC 12.0: for a mutating command the acquisition and
//   hold-file errors of 13.5 come first, then the unknown names of the usage
//   class; 13.5: acquisition precedes every later check): each command with
//   its `--test-hold` path occupied by a plain file (T13.5-1), and each
//   unknown name a command takes — an old ID (`rename specs/A.mdx nope x`;
//   `move specs/A.mdx#nope specs/B.mdx#x`, the section form's), an origin
//   file (`rename specs/Nope.mdx a x`; `move specs/Nope.mdx specs/C.mdx`), a
//   profile (`review create --coverage nope --name n`), a session and an
//   item (`review resolve` and `review split` naming either) — on one
//   session staging, each run judged before the next.
// - Its refusals, exit 1, on one session staging in turn: `rename specs/A.mdx
//   a g`, its new ID colliding with `g` (T6.4-3); `move specs/A.mdx
//   other/B.mdx`, its destination in no spec group (T6.5-4); `review create
//   --strategy audit --name s`, naming an existing session (T10.7-1); `review
//   resolve s <a's item> --status no-change`, a blocked item (T10.7-10);
//   once `review split s <a's item>` has succeeded, `review split s <a's
//   parent-consistency item>`, an item of another kind (T10.7-9); `review
//   resolve` and `review split` naming `s` made corrupt for that run alone
//   (unparseable bytes, T10.1-4); and, `specs/B.mdx` beginning with a
//   byte-order mark staged last (T13.5-8's failing workspace), `review create
//   --strategy audit --name n`, the gate turning it back (T10.7-1, 13.3) —
//   each met past acquisition, release following it alike (13.5).
// - The busy refusal: while `rename specs/A.mdx a a2` holds, each command is
//   refused, exit 2, `code` `"workspace-busy"`, `path` `".xspec/lock"`, and
//   `.xspec/lock` then holds exactly the holder's entry — byte-identical,
//   name and content, the lock directory's only one (T13.5-2; 13.5: the
//   refused run's release deletes its own entry and nothing else); the
//   holder, its hold lifted, completes, exit 0, `.xspec/lock` absent.
// (b) The area's directory, each run `rename specs/A.mdx nope x --json`
// failing its argument check (an unknown old ID, exit 2, `code` `null`) on
// an unbuilt workspace: holding no `.xspec`, it leaves no `.xspec`, its
// acquisition having created it — its outcome the unstaged twin's; held,
// `.xspec`'s read permission removed during its hold (`-wx`: the harness's
// own listing refused, its examination of `.xspec/lock` kept, verified
// first), it exits 2 with that twin's output and leaves no `.xspec`, release
// reading nothing (13.5: a directory's deletion alone decides whether it
// holds anything else); with an empty `.xspec` present beforehand it leaves
// `.xspec` present and empty; held, the workspace root alone made read-only
// during its hold (`r-x`: the harness's own creation of a file and a
// directory in the root refused, its listing kept, verified first), it exits
// 2 with the twin's output — no `write-failure` — and leaves `.xspec`
// present and empty, release's third deletion refused (13.5: a deletion the
// environment refuses changes no outcome; 14.24); and with an empty
// `.xspec/lock` present beforehand it leaves no `.xspec/lock`. CORE_DECL's
// glob reaches nothing under `.xspec`, so (b) admits the twin's outcome
// alone (14.25: a refused listing of the area's own occupant past
// acquisition is condition 23's state, never a read failure).
// (c) Release reads nothing — with each command in turn, held, the lock
// directory's read permission removed during its hold (`-wx`, T14-10's
// discipline: the harness's own listing refused, its examination of the
// held run's entry kept, verified first): the command ends either with its
// unstaged twin's outcome — exit code, standard output and standard error
// byte-equal — or with exit 2, `code` `"read-failure"`, `path`
// `".xspec/lock"` (SPEC 12.7, 14.25: a refused read of the lock path is a
// read failure wherever made, the command then attempting nothing further
// but release), and in both leaves no `.xspec/lock`, release deleting its
// entry and then the emptied directory, neither deletion needing the
// directory's read permission.
// (d) A refused deletion — with each command in turn, held, the lock
// directory made unwritable during its hold (`r-x`, T14-9's discipline: the
// harness's own creation of a file and a directory in it, and its renaming
// over and removal of the held run's entry, each refused, the listing kept,
// verified first): the command ends with its unstaged twin's outcome — exit
// 0, output byte-equal, no `write-failure` (14.24) — and its entry remains
// under its name, a plain file, the lock directory's only one (the harness
// restoring the permissions to inspect it); the run's process group
// confirmed gone (T13.5-3's discipline: the held run started leading a
// process group of its own), the next mutating command, `review create
// --strategy audit --name u --json`, takes the entry over — a leftover — and
// succeeds, exit 0, `.xspec/lock` absent afterwards; a `workspace-busy`
// refusal there meets T13.5-3's reuse check, the trial void where an
// identifier of the run's group is listed again (a voidable trial, rerun on
// a fresh workspace), a failure otherwise.
//
// CERTIFICATIONS.md: T13.5-11 lies in no certification scope (the Exclusions
// entry for T13.5-9 through T13.5-12 and T13.4-12): its absences of
// `.xspec/lock` are braced by the lock path's presence asserted at the same
// path — the entry a refused deletion leaves ((d)), and the holder's entry
// after each busy refusal — and every held arm makes the held-state
// comparison, which a product keeping its exclusion state anywhere but the
// lock directory fails loud, the held run's entry absent from
// `.xspec/lock`; its stagings verify themselves on the harness itself before
// use, an ineffective staging a harness error (E-1, H-11), never a pass or a
// skip. The Linux leg's stagings: permission removals, the process list
// (E-1).

import { Buffer } from "node:buffer";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { assertExitCode, fail } from "../../helpers/assertions.js";
import { assertRunOutcomesEqual } from "../../helpers/determinism.js";
import {
  applyReuseCheck,
  runVoidableTrial,
} from "../../helpers/kill-discipline.js";
import { LOCK_PATH } from "../../helpers/lock-path.js";
import type { LockEntry } from "../../helpers/lock-staging.js";
import { AREA_PATH, renderRel } from "../../helpers/lock-staging.js";
import {
  assertHeldState,
  assertLockDirectoryEntries,
  assertLockPathAbsent,
  assertOnlyEntry,
} from "../../helpers/lock-state.js";
import type { PermissionStaging } from "../../helpers/permissions.js";
import { stageDirectoryMode } from "../../helpers/permissions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { snapshotDirectory } from "../../helpers/snapshot.js";
import type {
  ProductBinding,
  RunningProduct,
  RunResult,
} from "../../helpers/subprocess.js";
import {
  releaseHoldFile,
  startProduct,
  summarizeResult,
} from "../../helpers/subprocess.js";
import type { WorkspaceDecl } from "../../helpers/workspace.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import {
  exitOnceLifted,
  RENAME_A,
  stageArmWorkspace,
  T13_5_10_OPERATIONS,
} from "./section-13.5-ii.js";
import type { SessionItems, SessionOperation } from "./section-13.5.js";
import {
  CORE_DECL,
  corruptSessionForRun,
  runBounded,
  T13_5_8_BOM,
} from "./section-13.5.js";
import { assertSameJson, expectErrorDocument } from "./support.js";
import {
  awaitHoldFile,
  holdPathFor,
  requireItemByScope,
  sessionStatus,
  WRITE_FAILURE_CODE,
} from "./write-refusal-staging.js";

/** The stable code of 14.26, the busy refusal. */
const WORKSPACE_BUSY = "workspace-busy";

/** The stable code of 14.25, the read failure. */
const READ_FAILURE_CODE = "read-failure";

/** An item no session holds (harness-prefixed: never a product's own). */
const NO_SUCH_ITEM = "xspec-harness-no-such-item";

/** A session no workspace here holds (well-formed under SPEC 10.1). */
const NO_SUCH_SESSION = "xspec-harness-no-such-session";

/** The hang guard of a held run (H-10: never an assertion input). */
const HELD_RUN_TIMEOUT_MS = 120_000;

/** `-wx`: unlistable, searchable and writable. */
const UNLISTABLE_MODE = 0o300;

/** `r-x`: listable and searchable, refusing writes. */
const UNWRITABLE_MODE = 0o500;

/** What a plain file occupying a `--test-hold` path holds. */
const HOLD_OCCUPANT_BYTES = "A plain file occupying the hold path.\n";

/** The rule every absence of `.xspec/lock` below cites. */
const RELEASE_RULE =
  "SPEC 13.5: a command ending normally — completed, refused, or failed — " +
  "deletes its entry, then the lock directory when that holds nothing " +
  "else, then `.xspec` when its acquisition created it and it then holds " +
  "nothing else";

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

/** A run held at the seam of 13.5, and the entry it holds by. */
interface HeldRun {
  readonly running: RunningProduct;
  /** Its hold file's absolute path, outside the workspace. */
  readonly hold: string;
  /** Its entry, as the held-state comparison observed it once it held. */
  readonly entry: LockEntry;
}

/**
 * Start `argv` in `workspace` under `--test-hold <path>` — the hold path
 * outside the workspace, the run leading a process group of its own where
 * `processGroup` says so (T13.5-3's discipline) — await its hold file, and
 * make the held-state comparison against the workspace's state before it
 * started (TEST-SPEC §13.5's preamble): every path but the lock path, and
 * `.xspec` itself where the invocation found none, byte-identical, and
 * `.xspec/lock` a directory holding exactly the held run's entry, a plain
 * file. Then run `body` with the held run. Whatever happens, the run is
 * killed (a no-op once it has exited) and its hold file removed.
 */
async function withHeldRun<T>(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  context: string,
  body: (held: HeldRun) => Promise<T>,
  options: { readonly processGroup?: boolean } = {},
): Promise<T> {
  const root = workspace.root;
  const hold = holdPathFor(workspace, "hold-release.tmp");
  const baseline = await snapshotDirectory(root);
  const running = await startProduct(product, {
    cwd: root,
    argv: [...argv, "--test-hold", hold],
    timeoutMs: HELD_RUN_TIMEOUT_MS,
    processGroup: options.processGroup === true,
  });
  try {
    await awaitHoldFile(running, hold, context);
    const entries = await assertHeldState(
      root,
      { baseline, heldRuns: 1 },
      `${context}, once it holds, against the workspace before it started`,
    );
    const [entry] = entries;
    if (entry === undefined || entries.length !== 1) {
      throw new Error(
        `T13.5-11: assertHeldState returned ${String(entries.length)} ` +
          `entries for one held run`,
      );
    }
    return await body({ running, hold, entry });
  } finally {
    running.kill();
    await releaseHoldFile(hold);
  }
}

/** The lock directory's entry `name`, workspace-relative bytes. */
function entryRel(name: Buffer): Buffer {
  return Buffer.concat([Buffer.from(`${LOCK_PATH}/`), name]);
}

/** Lift `held`'s hold and await its exit (`exitOnceLifted`). */
async function liftAndWait(held: HeldRun, context: string): Promise<RunResult> {
  await releaseHoldFile(held.hold);
  return await exitOnceLifted(held.running, context);
}

/**
 * A usage error past acquisition (SPEC 12.0): exit 2 with the 12.7 error
 * document as the entire stdout, its `code` `null` — the usage class
 * carries no stable code (SPEC 14), unlike acquisition's own failures
 * (14.24–14.26), which a product judging the name before acquiring would
 * not reach either.
 */
function assertUsageError(
  result: RunResult,
  context: string,
  rule: string,
): void {
  assertExitCode(result, 2, `${context}: ${rule}`);
  const finding = expectErrorDocument(result, context);
  if (finding.code !== null) {
    fail(
      `${context}: ${rule} — the usage error's error document carries ` +
        `\`code\` null (SPEC 12.7, 14: the usage class assigns no stable ` +
        `code); found ${JSON.stringify(finding.code)}: ` +
        JSON.stringify(finding.message),
    );
  }
}

// ---------------------------------------------------------------------------
// (a) `.xspec/lock` absent after each ending
// ---------------------------------------------------------------------------

/** An operation's success on its own session staging: (c)'s and (d)'s twin. */
interface SuccessTwin {
  readonly operation: SessionOperation;
  /** Its run under `--json`: exit 0. */
  readonly result: RunResult;
}

/**
 * Each mutating command's success (TEST-SPEC T13.5-11(a)): `operation` under
 * `--json`, bounded, on a fresh session staging — exit 0, an operation
 * succeeding there — and `.xspec/lock` absent once it has ended. Its run is
 * the unstaged twin (c) and (d) take the outcome from.
 */
async function successRun(
  product: ProductBinding,
  operation: SessionOperation,
): Promise<SuccessTwin> {
  return await withWorkspace(CORE_DECL, async (workspace) => {
    const context =
      `T13.5-11(a) ${operation.what} --json, an operation succeeding on a ` +
      `freshly built valid workspace holding an \`audit\` session \`s\` ` +
      `(also (c)'s and (d)'s unstaged twin)`;
    const items = await stageArmWorkspace(product, workspace, context);
    const result = await runBounded(
      product,
      workspace.root,
      [...operation.argv(items), "--json"],
      context,
    );
    assertExitCode(
      result,
      0,
      `${context}: it completes, exit 0 (SPEC 13.5, 6.4, 6.5, 10.7)`,
    );
    await assertLockPathAbsent(
      workspace.root,
      `${context}: once it has completed, exit 0 (${RELEASE_RULE})`,
    );
    return { operation, result };
  });
}

/** One usage error of (a), named by what its run spells. */
interface UsageErrorArm {
  readonly what: string;
  /** Its arguments, `--json` aside, naming the session's items. */
  readonly argv: (items: SessionItems) => readonly string[];
}

/**
 * Each unknown name a mutating command takes (TEST-SPEC T13.5-11(a): an old
 * ID, an origin file, a profile, a session, an item), each judged past
 * acquisition (SPEC 12.0; 13.5) — an unknown or wrong-kind name of the usage
 * class, `code` `null`.
 */
const UNKNOWN_NAME_ARMS: readonly UsageErrorArm[] = [
  {
    what: "`rename specs/A.mdx nope x` (an unknown old ID)",
    argv: () => ["rename", "specs/A.mdx", "nope", "x"],
  },
  {
    what: "`rename specs/Nope.mdx a x` (an unknown origin file)",
    argv: () => ["rename", "specs/Nope.mdx", "a", "x"],
  },
  {
    what: "`move specs/Nope.mdx specs/C.mdx` (an unknown origin file)",
    argv: () => ["move", "specs/Nope.mdx", "specs/C.mdx"],
  },
  {
    what: "`move specs/A.mdx#nope specs/B.mdx#x` (an unknown old ID, the section form)",
    argv: () => ["move", "specs/A.mdx#nope", "specs/B.mdx#x"],
  },
  {
    what: "`review create --coverage nope --name n` (an unknown profile)",
    argv: () => ["review", "create", "--coverage", "nope", "--name", "n"],
  },
  {
    what: `\`review resolve ${NO_SUCH_SESSION} <g's item> --status skipped\` (an unknown session)`,
    argv: (items) => [
      "review",
      "resolve",
      NO_SUCH_SESSION,
      items.leaf,
      "--status",
      "skipped",
    ],
  },
  {
    what: `\`review resolve s ${NO_SUCH_ITEM} --status skipped\` (an unknown item)`,
    argv: () => ["review", "resolve", "s", NO_SUCH_ITEM, "--status", "skipped"],
  },
  {
    what: `\`review split ${NO_SUCH_SESSION} <a's item>\` (an unknown session)`,
    argv: (items) => ["review", "split", NO_SUCH_SESSION, items.parent],
  },
  {
    what: `\`review split s ${NO_SUCH_ITEM}\` (an unknown item)`,
    argv: () => ["review", "split", "s", NO_SUCH_ITEM],
  },
];

/**
 * One usage error past acquisition (TEST-SPEC T13.5-11(a)): `argv` under
 * `--json`, bounded — exit 2, `code` `null` — then `.xspec/lock` absent.
 */
async function usageErrorRun(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  context: string,
): Promise<void> {
  const result = await runBounded(
    product,
    workspace.root,
    [...argv, "--json"],
    context,
  );
  assertUsageError(
    result,
    context,
    `a usage error past acquisition, exit 2 (SPEC 12.0: for a mutating ` +
      `command the acquisition and hold-file errors of 13.5 come first, ` +
      `then the unknown names of the usage class; 13.5: acquisition ` +
      `precedes every later check)`,
  );
  await assertLockPathAbsent(
    workspace.root,
    `${context}: once it has failed, exit 2 — its acquisition made, release ` +
      `following the usage error alike (${RELEASE_RULE})`,
  );
}

/**
 * (a)'s usage errors past acquisition, on one session staging, each run
 * judged before the next: each mutating command with its `--test-hold` path
 * occupied by a plain file (T13.5-1: the hold file's creation fails when
 * anything exists at the path), then each unknown name a command takes.
 */
async function usageErrorArms(product: ProductBinding): Promise<void> {
  await withWorkspace(CORE_DECL, async (workspace) => {
    const label = "T13.5-11(a) usage errors past acquisition";
    const items = await stageArmWorkspace(product, workspace, label);
    const occupied = holdPathFor(workspace, "hold-occupied.tmp");
    await fsp.writeFile(occupied, HOLD_OCCUPANT_BYTES);
    for (const operation of T13_5_10_OPERATIONS) {
      await usageErrorRun(
        product,
        workspace,
        [...operation.argv(items), "--test-hold", occupied],
        `${label}: ${operation.what} --json --test-hold <path>, a plain ` +
          `file occupying the hold path (T13.5-1)`,
      );
    }
    for (const arm of UNKNOWN_NAME_ARMS) {
      await usageErrorRun(
        product,
        workspace,
        arm.argv(items),
        `${label}: ${arm.what} --json`,
      );
    }
  });
}

/** The spec source the gate's arm adds: T13.5-8's BOM-led `specs/B.mdx`. */
const BOM_FILE = "specs/B.mdx";

/**
 * One refusal (TEST-SPEC T13.5-11(a)): `argv` under `--json`, bounded —
 * exit 1, the operation refused past acquisition (`why`) — then
 * `.xspec/lock` absent. `around` stages what the run alone meets (a
 * session made corrupt for it) and returns its undoing, made once the run
 * has ended.
 */
async function refusalRun(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  context: string,
  why: string,
  around?: () => Promise<() => Promise<void>>,
): Promise<void> {
  const undo = around === undefined ? undefined : await around();
  let result: RunResult;
  try {
    result = await runBounded(
      product,
      workspace.root,
      [...argv, "--json"],
      context,
    );
  } finally {
    if (undo !== undefined) await undo();
  }
  assertExitCode(result, 1, `${context}: ${why}`);
  await assertLockPathAbsent(
    workspace.root,
    `${context}: once it has been refused, exit 1 — met past acquisition, ` +
      `release following it alike (${RELEASE_RULE})`,
  );
}

/**
 * (a)'s refusals (exit 1), in turn on one session staging: a `rename`
 * refused by validation, a `move` refused for one of 6.5's reasons, a
 * `review create` naming an existing session, a `resolve` of a blocked item,
 * a `split` of an item of another kind (once `a`'s item is split, its
 * parent-consistency item), a `resolve` and a `split` naming the session
 * made corrupt for that run alone, and — the workspace failed last, by
 * T13.5-8's BOM-led second source — a `review create` the gate turns back.
 */
async function refusalArms(product: ProductBinding): Promise<void> {
  await withWorkspace(CORE_DECL, async (workspace) => {
    const root = workspace.root;
    const label = "T13.5-11(a) refusals (exit 1)";
    const items = await stageArmWorkspace(product, workspace, label);
    await refusalRun(
      product,
      workspace,
      ["rename", "specs/A.mdx", "a", "g"],
      `${label}: \`rename specs/A.mdx a g --json\``,
      "its new ID collides with `g`, so validation refuses it, exit 1 " +
        "(SPEC 6.4; T6.4-3)",
    );
    await refusalRun(
      product,
      workspace,
      ["move", "specs/A.mdx", "other/B.mdx"],
      `${label}: \`move specs/A.mdx other/B.mdx --json\``,
      "its destination lies in no spec group, so it is refused for one of " +
        "6.5's reasons, exit 1 (SPEC 6.5; T6.5-4)",
    );
    await refusalRun(
      product,
      workspace,
      ["review", "create", "--strategy", "audit", "--name", "s"],
      `${label}: \`review create --strategy audit --name s --json\``,
      "it names an existing session, so it is refused, exit 1 (SPEC 10.1, " +
        "10.7; T10.7-1)",
    );
    await refusalRun(
      product,
      workspace,
      ["review", "resolve", "s", items.parent, "--status", "no-change"],
      `${label}: \`review resolve s <a's item> --status no-change --json\``,
      "`a`'s item is blocked by its child `a.k`'s, unresolved, so resolving " +
        "it is refused, exit 1 (SPEC 10.6, 10.7; T10.7-10)",
    );
    // `a`'s item split — a success, release following it — yields its
    // parent-consistency item, an item of another kind than `split` takes.
    const splitContext = `${label} staging: \`review split s <a's item> --json\``;
    const split = await runBounded(
      product,
      root,
      ["review", "split", "s", items.parent, "--json"],
      splitContext,
    );
    assertExitCode(
      split,
      0,
      `${splitContext}: a subtree-coherence item whose scope root has ` +
        `children splits, exit 0 (SPEC 10.7)`,
    );
    await assertLockPathAbsent(
      root,
      `${splitContext}: once it has completed, exit 0 (${RELEASE_RULE})`,
    );
    const parentConsistency = requireItemByScope(
      await sessionStatus(product, workspace, "s", `${label} staging`),
      "specs/A.mdx#a",
      `${label} staging: once \`a\`'s item is split`,
    );
    if (parentConsistency.kind !== "parent-consistency") {
      fail(
        `${label} staging: once \`a\`'s item is split, the item scoped at ` +
          `specs/A.mdx#a is its parent-consistency item (SPEC 10.7: the ` +
          `original removed, one parent-consistency item for the scope root ` +
          `added); found kind ${JSON.stringify(parentConsistency.kind)}`,
      );
    }
    await refusalRun(
      product,
      workspace,
      ["review", "split", "s", parentConsistency.id],
      `${label}: \`review split s <a's parent-consistency item> --json\``,
      "`split` applies to a subtree-coherence item alone, so splitting an " +
        "item of another kind is refused, exit 1 (SPEC 10.7; T10.7-9)",
    );
    await refusalRun(
      product,
      workspace,
      ["review", "resolve", "s", items.leaf, "--status", "skipped"],
      `${label}: \`review resolve s <g's item> --status skipped --json\` ` +
        `naming \`s\` made corrupt for this run (unparseable bytes)`,
      "a `review` subcommand naming a corrupt session reports the " +
        "corruption, exit 1 (SPEC 10.1, 14.21; T10.1-4)",
      () => corruptSessionForRun(workspace, "s", label),
    );
    await refusalRun(
      product,
      workspace,
      ["review", "split", "s", items.leaf],
      `${label}: \`review split s <g's item> --json\` naming \`s\` made ` +
        `corrupt for this run (unparseable bytes)`,
      "a `review` subcommand naming a corrupt session reports the " +
        "corruption, exit 1 (SPEC 10.1, 14.21; T10.1-4)",
      () => corruptSessionForRun(workspace, "s", label),
    );
    // The workspace failed last: a second spec source beginning with a
    // byte-order mark (T13.5-8's failing workspace; SPEC 1.6, 14.20).
    await workspace.file(BOM_FILE, T13_5_8_BOM);
    await refusalRun(
      product,
      workspace,
      ["review", "create", "--strategy", "audit", "--name", "n"],
      `${label}: \`review create --strategy audit --name n --json\` with ` +
        `${BOM_FILE} beginning with a byte-order mark`,
      "the workspace fails `build`'s validations, so the gate of 13.3 turns " +
        "it back with the findings, exit 1 (SPEC 13.3, 10.7; T10.7-1)",
    );
  });
}

/**
 * (a)'s busy refusal (TEST-SPEC T13.5-11(a), T13.5-2): while `rename
 * specs/A.mdx a a2` holds a session staging, each mutating command in turn
 * is refused — exit 2, `code` `"workspace-busy"`, `path` `".xspec/lock"` —
 * and `.xspec/lock` then holds exactly the holder's entry, byte-identical,
 * name and content, the lock directory's only one (SPEC 13.5: the refused
 * run's release deletes its own entry and nothing else); the holder, its
 * hold lifted, completes, exit 0, and `.xspec/lock` is absent.
 */
async function busyRefusalArm(product: ProductBinding): Promise<void> {
  await withWorkspace(CORE_DECL, async (workspace) => {
    const root = workspace.root;
    const label =
      `T13.5-11(a) the busy refusal: each mutating command while ` +
      `${RENAME_A.what} --json --test-hold <path> holds`;
    const items = await stageArmWorkspace(product, workspace, label);
    await withHeldRun(
      product,
      workspace,
      [...RENAME_A.argv(items), "--json"],
      label,
      async (held) => {
        for (const operation of T13_5_10_OPERATIONS) {
          const context = `${label}: ${operation.what} --json`;
          const result = await runBounded(
            product,
            root,
            [...operation.argv(items), "--json"],
            context,
          );
          const rule =
            "an entry of a run alive on this machine refuses acquisition " +
            "(SPEC 13.5, 14.26)";
          assertExitCode(result, 2, `${context}: ${rule}`);
          const finding = expectErrorDocument(result, context);
          assertSameJson(
            { code: finding.code, path: finding.path },
            { code: WORKSPACE_BUSY, path: LOCK_PATH },
            `${context}: ${rule} — the stable code "${WORKSPACE_BUSY}", ` +
              `the concerned path "${LOCK_PATH}"`,
          );
          await assertOnlyEntry(
            root,
            held.entry,
            `${context}: once it has been refused, ${LOCK_PATH} holds ` +
              `exactly the holder's entry (T13.5-2)`,
          );
        }
        const result = await liftAndWait(held, label);
        assertExitCode(
          result,
          0,
          `${label}: the holder, its hold lifted, completes, exit 0 (SPEC ` +
            `13.5)`,
        );
        await assertLockPathAbsent(
          root,
          `${label}: once the holder has completed, exit 0 (${RELEASE_RULE})`,
        );
      },
    );
  });
}

// ---------------------------------------------------------------------------
// (b) The area's directory
// ---------------------------------------------------------------------------

/** (b)'s run: `rename specs/A.mdx nope x --json`, an unknown old ID. */
const UNKNOWN_OLD_ID_RENAME: readonly string[] = [
  "rename",
  "specs/A.mdx",
  "nope",
  "x",
  "--json",
];

/** The rule (b)'s run fails by. */
const ARGUMENT_CHECK_RULE =
  "a `rename` naming an unknown old ID fails its argument check past " +
  "acquisition, a usage error, exit 2 (SPEC 12.0, 6.4, 13.5)";

/** An unbuilt workspace holds no `.xspec` (a staging premise of (b)). */
async function requireNoArea(
  workspace: TestWorkspace,
  context: string,
): Promise<void> {
  const kind = await workspace.kind(AREA_PATH);
  if (kind !== "absent") {
    throw new Error(
      `${context}: staging premise — the unbuilt workspace holds no ` +
        `${AREA_PATH}; found ${kind}`,
    );
  }
}

/**
 * No `.xspec` once (b)'s run has ended: its acquisition created the area's
 * directory, and release deleted it, emptied (SPEC 13.5).
 */
async function assertNoArea(
  workspace: TestWorkspace,
  context: string,
): Promise<void> {
  const kind = await workspace.kind(AREA_PATH);
  if (kind === "absent") return;
  const held =
    kind === "dir"
      ? ` holding ${JSON.stringify(
          (await workspace.readdirBytes(AREA_PATH)).map((name) =>
            Buffer.from(name).toString("utf8"),
          ),
        )}`
      : "";
  fail(
    `${context}: no ${AREA_PATH} once it has ended — its acquisition ` +
      `created the area's directory, which release deletes once it holds ` +
      `nothing else (${RELEASE_RULE}); found a ${kind} at ${AREA_PATH}${held}`,
  );
}

/** `.xspec` present and empty once (b)'s run has ended (`why` says why). */
async function assertEmptyArea(
  workspace: TestWorkspace,
  context: string,
  why: string,
): Promise<void> {
  const expectation = `${AREA_PATH} present and empty once it has ended — ${why}`;
  const kind = await workspace.kind(AREA_PATH);
  if (kind !== "dir") {
    fail(`${context}: ${expectation}; found ${kind} at ${AREA_PATH}`);
  }
  const names = await workspace.readdirBytes(AREA_PATH);
  if (names.length > 0) {
    fail(
      `${context}: ${expectation}; it holds ` +
        JSON.stringify(names.map((name) => Buffer.from(name).toString("utf8"))),
    );
  }
}

/**
 * A held (b) run: on an unbuilt workspace holding no `.xspec`, `rename
 * specs/A.mdx nope x --json --test-hold <path>` held (`withHeldRun`: the
 * held-state comparison taken, `.xspec` itself a directory acquisition
 * created), `stage` applied during its hold and verified on the harness
 * itself, the hold lifted, and the staging restored once the run has exited
 * — restoring nothing where its directory is gone. Returns the run's result.
 */
async function heldAreaRun(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
  stage: (root: string) => Promise<PermissionStaging>,
): Promise<RunResult> {
  await requireNoArea(workspace, context);
  return await withHeldRun(
    product,
    workspace,
    UNKNOWN_OLD_ID_RENAME,
    context,
    async (held) => {
      let staging: PermissionStaging | undefined;
      try {
        staging = await stage(workspace.root);
        return await liftAndWait(held, context);
      } finally {
        if (staging !== undefined) await staging.restore();
      }
    },
  );
}

/**
 * (b) The area's directory (TEST-SPEC T13.5-11(b)), each arm on a fresh
 * unbuilt workspace: holding no `.xspec` — the unstaged twin; held, `.xspec`
 * unlistable during its hold; an empty `.xspec` beforehand; held, the root
 * read-only during its hold; an empty `.xspec/lock` beforehand.
 */
async function areaArms(product: ProductBinding): Promise<void> {
  const twinContext =
    "T13.5-11(b) `rename specs/A.mdx nope x --json` on an unbuilt " +
    "workspace holding no `.xspec` (also the unstaged twin of (b)'s held runs)";
  const twin = await withWorkspace(CORE_DECL, async (workspace) => {
    await requireNoArea(workspace, twinContext);
    const result = await runBounded(
      product,
      workspace.root,
      UNKNOWN_OLD_ID_RENAME,
      twinContext,
    );
    assertUsageError(result, twinContext, ARGUMENT_CHECK_RULE);
    await assertNoArea(workspace, twinContext);
    return result;
  });

  await withWorkspace(CORE_DECL, async (workspace) => {
    const context =
      "T13.5-11(b) `rename specs/A.mdx nope x --json --test-hold <path>` on " +
      "an unbuilt workspace holding no `.xspec`, `.xspec`'s read permission " +
      "removed during its hold (mode `-wx`)";
    const result = await heldAreaRun(product, workspace, context, (root) =>
      stageDirectoryMode(path.join(root, AREA_PATH), UNLISTABLE_MODE, [
        { attempt: "list", refused: true },
        { attempt: "create", refused: false },
        { attempt: "examine", name: "lock", refused: false },
      ]),
    );
    assertRunOutcomesEqual(
      result,
      twin,
      `${context}: it exits 2 with its unstaged twin's output (SPEC 13.5: ` +
        `release reads nothing — a directory's deletion alone decides ` +
        `whether it holds anything else; 14.25: a refused listing of the ` +
        `area's own occupant past acquisition is condition 23's state, ` +
        `never a read failure, which a \`rename\` failing its argument ` +
        `check never reports)`,
      "the run whose `.xspec` was unlistable",
      "its unstaged twin",
    );
    await assertNoArea(
      workspace,
      `${context}: release deleting the area's directory without listing it`,
    );
  });

  await withWorkspace(CORE_DECL, async (workspace) => {
    const context =
      "T13.5-11(b) `rename specs/A.mdx nope x --json` with an empty " +
      "`.xspec` present beforehand";
    await workspace.dir(AREA_PATH);
    const result = await runBounded(
      product,
      workspace.root,
      UNKNOWN_OLD_ID_RENAME,
      context,
    );
    assertUsageError(result, context, ARGUMENT_CHECK_RULE);
    await assertEmptyArea(
      workspace,
      context,
      "its acquisition found the area's directory, so release leaves it, " +
        "deleting only its entry and then the emptied lock directory (SPEC " +
        "13.5: `.xspec` deleted only when its acquisition created it)",
    );
  });

  await withWorkspace(CORE_DECL, async (workspace) => {
    const context =
      "T13.5-11(b) `rename specs/A.mdx nope x --json --test-hold <path>` on " +
      "an unbuilt workspace holding no `.xspec`, the workspace root alone " +
      "made read-only during its hold (mode `r-x`, `.xspec` left writable)";
    const result = await heldAreaRun(product, workspace, context, (root) =>
      stageDirectoryMode(root, UNWRITABLE_MODE, [
        { attempt: "create", refused: true },
        { attempt: "list", refused: false },
      ]),
    );
    assertRunOutcomesEqual(
      result,
      twin,
      `${context}: it exits 2 with its unstaged twin's output — no ` +
        `"${WRITE_FAILURE_CODE}" (SPEC 13.5: a deletion the environment ` +
        `refuses changes no outcome; 14.24: and is no write failure)`,
      "the run whose root was read-only",
      "its unstaged twin",
    );
    await assertEmptyArea(
      workspace,
      context,
      "release deletes its entry and then the emptied lock directory, its " +
        "third deletion — the area's directory, which its acquisition " +
        "created — refused by the read-only root, which changes no outcome " +
        "(SPEC 13.5, 14.24)",
    );
  });

  await withWorkspace(CORE_DECL, async (workspace) => {
    const context =
      "T13.5-11(b) `rename specs/A.mdx nope x --json` with an empty " +
      "`.xspec/lock` present beforehand";
    await workspace.dir(LOCK_PATH);
    const result = await runBounded(
      product,
      workspace.root,
      UNKNOWN_OLD_ID_RENAME,
      context,
    );
    assertUsageError(result, context, ARGUMENT_CHECK_RULE);
    await assertLockPathAbsent(
      workspace.root,
      `${context}: once it has failed — release deletes its entry, then the ` +
        `lock directory, holding nothing else (${RELEASE_RULE})`,
    );
  });
}

// ---------------------------------------------------------------------------
// (c) Release reads nothing
// ---------------------------------------------------------------------------

/**
 * (c)'s admitted outcomes (TEST-SPEC T13.5-11(c)): the unstaged twin's —
 * exit code, standard output and standard error byte-equal — or exit 2
 * with the error document, `code` `"read-failure"`, `path` `".xspec/lock"`.
 */
function assertTwinOutcomeOrReadFailure(
  result: RunResult,
  twin: SuccessTwin,
  context: string,
): void {
  const admitted =
    `either its unstaged twin's outcome — exit ` +
    `${String(twin.result.exitCode)}, standard output and standard error ` +
    `byte-equal — or exit 2 with the error document, \`code\` ` +
    `"${READ_FAILURE_CODE}", \`path\` "${LOCK_PATH}" (SPEC 13.5: release ` +
    `reads nothing, and SPEC.md neither states nor excludes a read of the ` +
    `lock path between the hold and release; 14.25: a refused read of the ` +
    `lock path is a read failure wherever made, the command then ` +
    `attempting nothing further but release)`;
  if (result.exitCode === 2 && twin.result.exitCode !== 2) {
    const finding = expectErrorDocument(result, `${context}: ${admitted}`);
    assertSameJson(
      { code: finding.code, path: finding.path },
      { code: READ_FAILURE_CODE, path: LOCK_PATH },
      `${context}: it ends with ${admitted}; it exited 2 — message: ` +
        JSON.stringify(finding.message),
    );
    return;
  }
  assertRunOutcomesEqual(
    result,
    twin.result,
    `${context}: it ends with ${admitted}`,
    "the run whose lock directory was unlistable",
    "its unstaged twin",
  );
}

/**
 * (c) with `twin.operation` (TEST-SPEC T13.5-11(c)): on a fresh session
 * staging, the operation held (`withHeldRun`), the lock directory's read
 * permission removed during its hold (`-wx`, verified on the harness: its
 * own listing refused, its examination of the held run's entry kept), the
 * hold lifted, the mode restored once the run has exited — restoring
 * nothing where the directory is gone; the run's outcome the twin's or the
 * read failure at `.xspec/lock`, and no `.xspec/lock` either way.
 */
async function unlistableLockDirectoryRun(
  product: ProductBinding,
  twin: SuccessTwin,
): Promise<void> {
  await withWorkspace(CORE_DECL, async (workspace) => {
    const root = workspace.root;
    const context =
      `T13.5-11(c) ${twin.operation.what} --json --test-hold <path>, the ` +
      `lock directory's read permission removed during its hold (mode ` +
      `\`-wx\`)`;
    const items = await stageArmWorkspace(product, workspace, context);
    await withHeldRun(
      product,
      workspace,
      [...twin.operation.argv(items), "--json"],
      context,
      async (held) => {
        let staging: PermissionStaging | undefined;
        let result: RunResult;
        try {
          staging = await stageDirectoryMode(
            path.join(root, LOCK_PATH),
            UNLISTABLE_MODE,
            [
              { attempt: "list", refused: true },
              { attempt: "examine", name: held.entry.name, refused: false },
            ],
          );
          result = await liftAndWait(held, context);
        } finally {
          if (staging !== undefined) await staging.restore();
        }
        assertTwinOutcomeOrReadFailure(result, twin, context);
        await assertLockPathAbsent(
          root,
          `${context}: once it has ended, either way — release deletes its ` +
            `entry and then the emptied directory, neither deletion needing ` +
            `the directory's read permission (${RELEASE_RULE}; release reads ` +
            `nothing)`,
        );
      },
    );
  });
}

// ---------------------------------------------------------------------------
// (d) A refused deletion
// ---------------------------------------------------------------------------

/**
 * (d)'s next mutating command once the permissions are restored: an audit
 * session `u`, an operation succeeding on the state every command of
 * `T13_5_10_OPERATIONS` leaves.
 */
const NEXT_COMMAND: readonly string[] = [
  "review",
  "create",
  "--strategy",
  "audit",
  "--name",
  "u",
  "--json",
];

/**
 * (d)'s residue (TEST-SPEC T13.5-11(d): "its entry remains, the lock
 * directory's only one"): `.xspec/lock` a directory holding exactly one
 * entry, a plain file, and nothing else (`assertLockDirectoryEntries`), named
 * as the held run's entry was once it held — release's deletion of it
 * refused, nothing else of release's undone; its content and permissions
 * the product's own (H-4).
 */
async function assertEntryRemains(
  root: string,
  entry: LockEntry,
  context: string,
): Promise<void> {
  const rule =
    `its entry remains — release's deletion of it refused, which changes ` +
    `no outcome — the lock directory's only one (SPEC 13.5, 14.24)`;
  const [only] = await assertLockDirectoryEntries(
    root,
    { entries: 1 },
    `${context}: ${rule}`,
  );
  if (only === undefined || !only.name.equals(entry.name)) {
    fail(
      `${context}: ${rule}; the held run's entry was ` +
        `${renderRel(entryRel(entry.name))}, but the one entry now is ` +
        `${only === undefined ? "missing" : renderRel(entryRel(only.name))}`,
    );
  }
}

/**
 * (d) with `twin.operation` (TEST-SPEC T13.5-11(d)), a voidable trial on a
 * fresh session staging: the operation held, leading a process group of
 * its own (`withHeldRun`), the lock directory made unwritable during its
 * hold (`r-x`, verified on the harness: its own creation in the directory,
 * and its renaming over and removal of the held run's entry, each refused,
 * the listing kept), the hold lifted, the mode restored once the run has
 * exited. The run ends with its unstaged twin's outcome — exit 0, output
 * byte-equal, no `write-failure` — and its entry remains, the lock
 * directory's only one (`assertEntryRemains`). Its group confirmed gone (T13.5-3's
 * discipline: `killGroup`, which signals nothing once every member has
 * ended), the next mutating command takes the entry over and succeeds,
 * `.xspec/lock` absent afterwards; a `workspace-busy` refusal there meets
 * T13.5-3's reuse check (void where an identifier of the group is listed
 * again, a failure otherwise).
 */
async function unwritableLockDirectoryRun(
  product: ProductBinding,
  twin: SuccessTwin,
): Promise<void> {
  const label =
    `T13.5-11(d) ${twin.operation.what} --json --test-hold <path>, the ` +
    `lock directory made unwritable during its hold (mode \`r-x\`)`;
  await runVoidableTrial(label, async (attempt) => {
    await withWorkspace(CORE_DECL, async (workspace) => {
      const root = workspace.root;
      const context = `${label} (trial ${String(attempt)})`;
      const items = await stageArmWorkspace(product, workspace, context);
      await withHeldRun(
        product,
        workspace,
        [...twin.operation.argv(items), "--json"],
        context,
        async (held) => {
          let staging: PermissionStaging | undefined;
          let result: RunResult;
          try {
            staging = await stageDirectoryMode(
              path.join(root, LOCK_PATH),
              UNWRITABLE_MODE,
              [
                { attempt: "create", refused: true },
                { attempt: "remove", name: held.entry.name },
                { attempt: "list", refused: false },
              ],
            );
            result = await liftAndWait(held, context);
          } finally {
            if (staging !== undefined) await staging.restore();
          }
          const rule =
            `it ends with its unstaged twin's outcome — exit 0, output ` +
            `byte-equal, no "${WRITE_FAILURE_CODE}" (SPEC 13.5: a deletion ` +
            `the environment refuses changes no outcome; 14.24: and is no ` +
            `write failure)`;
          assertExitCode(result, 0, `${context}: ${rule}`);
          assertRunOutcomesEqual(
            result,
            twin.result,
            `${context}: ${rule}`,
            "the run whose lock directory was unwritable",
            "its unstaged twin",
          );
          await assertEntryRemains(
            root,
            held.entry,
            `${context}: once it has completed, the permissions restored`,
          );
          const gone = await held.running.killGroup();
          const nextContext =
            `${context}: the next mutating command once the permissions ` +
            `are restored, \`review create --strategy audit --name u ` +
            `--json\`, the run's process group confirmed gone first ` +
            `(T13.5-3's discipline)`;
          const next = await runBounded(
            product,
            root,
            NEXT_COMMAND,
            nextContext,
          );
          if (
            next.exitCode === 2 &&
            expectErrorDocument(next, nextContext).code === WORKSPACE_BUSY
          ) {
            await applyReuseCheck(
              gone.identifiers,
              `${nextContext} — ${summarizeResult(next)}`,
            );
          }
          assertExitCode(
            next,
            0,
            `${nextContext}: it takes the entry over — a leftover, its run ` +
              `ended — and succeeds, exit 0 (SPEC 13.5: a leftover MUST NOT ` +
              `block later commands)`,
          );
          await assertLockPathAbsent(
            root,
            `${nextContext}: once it has completed — the leftover removed ` +
              `at its acquisition, its own entry released (${RELEASE_RULE})`,
          );
        },
        { processGroup: true },
      );
    });
  });
}

// ---------------------------------------------------------------------------
// T13.5-11
// ---------------------------------------------------------------------------

const T13_5_11 = defineProductTest({
  id: "T13.5-11",
  title:
    "release, arms (b), (c), and (d) and four of (a)'s endings so far ((a)'s read failure and configuration error past acquisition, acquisition's own read and write failures, and T13.5-7's write failures not yet implemented) — a command ending normally deletes its entry, then the lock directory when that holds nothing else, then `.xspec` when its acquisition created it and it then holds nothing else, release reading nothing, a deletion the environment refuses changing no outcome: (a) `.xspec/lock` absent after each mutating command's success (`rename specs/A.mdx a a2`, `move specs/A.mdx specs/B.mdx`, `review create --strategy audit --name t`, `review resolve s <item> --status no-change`, `review split s <item>`, each on a freshly built valid workspace holding an `audit` session `s`, exit 0), after its usage errors past acquisition (each command's `--test-hold` path occupied; an unknown old ID, origin file, profile, session, or item — exit 2, `code` `null`), and after each refusal (a `rename` refused by validation, a `move` refused for a 6.5 reason, a `review create` naming an existing session and one the gate turns back, a `resolve` of a blocked item, a `split` of an item of another kind, a `resolve` and a `split` naming a corrupt session — exit 1); after a busy refusal of each command while `rename specs/A.mdx a a2` holds (exit 2, `code` `\"workspace-busy\"`, `path` `\".xspec/lock\"`) the lock directory holds exactly the holder's entry, byte-identical, and once the holder completes `.xspec/lock` is absent; (b) `rename specs/A.mdx nope x` failing its argument check on an unbuilt workspace leaves no `.xspec`, also with `.xspec` made `-wx` during its hold (exit 2 with its unstaged twin's output); with an empty `.xspec` beforehand it leaves `.xspec` present and empty; with the root alone made `r-x` during its hold it exits 2 with the twin's output, no `write-failure`, leaving `.xspec` present and empty; with an empty `.xspec/lock` beforehand, no `.xspec/lock`; (c) with each command held and the lock directory made `-wx` during its hold → its unstaged twin's outcome (exit code, standard output and error byte-equal) or exit 2 with `code` `\"read-failure\"`, `path` `\".xspec/lock\"`, and no `.xspec/lock` either way; (d) with each command held and the lock directory made `r-x` during its hold → its unstaged twin's outcome, exit 0, no `write-failure`, its entry remaining under its name, the lock directory's only one; the permissions restored and the run's process group confirmed gone, `review create --strategy audit --name u` takes the entry over, exit 0, `.xspec/lock` absent (a `workspace-busy` refusal meeting T13.5-3's reuse check); each held run's held-state comparison made once it holds, each staging verified on the harness itself (SPEC 13.5, 14.24, 14.25, 14.26)",
  // A hang guard (H-10): 109 product invocations — ~8 s against the
  // CONF-CORE conformer, which passes it whole, and ~35 s for a product at
  // the built product's speed (~0.3 s a run; AGENTS.md): ample margin.
  timeoutMs: 300_000,
  run: async (product) => {
    // (a) Each mutating command's success — the unstaged twins of (c) and
    // (d) — then its usage errors past acquisition, the refusals, and the
    // busy refusal.
    const twins: SuccessTwin[] = [];
    for (const operation of T13_5_10_OPERATIONS) {
      twins.push(await successRun(product, operation));
    }
    await usageErrorArms(product);
    await refusalArms(product);
    await busyRefusalArm(product);
    // (b) The area's directory.
    await areaArms(product);
    // (c) Release reads nothing: the lock directory `-wx` during each
    // command's hold.
    for (const twin of twins) {
      await unlistableLockDirectoryRun(product, twin);
    }
    // (d) A refused deletion: the lock directory `r-x` during each
    // command's hold, then the next mutating command's takeover.
    for (const twin of twins) {
      await unwritableLockDirectoryRun(product, twin);
    }
  },
});

/** TEST-SPEC §13.5, part iii, in canonical ID order (SUITE-48). */
export const section135iiiTests: readonly ProductTestEntry[] = [T13_5_11];
