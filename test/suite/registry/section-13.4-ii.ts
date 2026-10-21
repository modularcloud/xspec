// TEST-SPEC §13.4 (derived, durable, and transient files), part ii —
// SUITE-47: T13.4-12 (the transient lock path) and T13.4-13 (any other
// occupant: FIFOs).
//
// T13.4-12. The lock path `.xspec/lock` is transient (SPEC 13.4): it bears
// on no comparison of graph data and on no record, no write but acquisition
// and release touches it, and graph data lies beside it, so it is no write
// path of `build`'s either (14.22).
//
// Every arm starts from a fresh CONF-CORE-shaped workspace (CORE_DECL,
// section-13.5.ts: one spec group, `specs/A.mdx` holding `a` with its child
// `a.k`, then `g`), and every command runs bounded (`runBounded`): it
// completes promptly, and a product opening a staged FIFO — an open with no
// writer blocks — fails diagnosed at the bound (H-8), the harness itself
// never opening one (helpers/lock-staging.ts).
//
// - The leftover-free twin: a freshly built workspace, nothing at
//   `.xspec/lock` once `build` has run, whose answers every comparison
//   below takes — `inventory --json`'s `recorded` (available: a premise),
//   `ids --json`, `move specs/A.mdx specs/B.mdx --preview --json` (an
//   operation succeeding there, exit 0, its `delta` available: a premise),
//   and, once a section's text is edited (`g`'s "Gamma text.", a staged
//   record), `check --json` and `ids --json` again. Its run order mirrors
//   the readable arms' (a second `build` before the edit), so the states it
//   answers from are theirs.
// - Readable leftovers and obstructions, each staged in turn on a freshly
//   built valid workspace: a dead run's entry — a held `rename specs/A.mdx a
//   a2` killed under T13.5-3's discipline (helpers/lock-staging.ts
//   `killHeldRun`), the workspace otherwise unmodified by it (a premise:
//   13.5's hold precedes every modification) — a plain file at
//   `.xspec/lock` holding garbage (ill-formed UTF-8 and a NUL), a symbolic
//   link there to a directory outside the workspace holding a file, a FIFO
//   there, and a lock directory holding a symbolic link (to a directory
//   outside the workspace holding a file), a FIFO, and a directory holding
//   a file, each staged in turn as an occupant at `.xspec/lock/<name>`
//   (`stageLeftover`, each staging verified on the harness itself). Then
//   `check --json` is clean, exit 0 — neither condition 10 nor condition
//   22; `inventory --json` exits 0, finding-free, its `recorded` available
//   and equal to the twin's; `build` exits 0; and, the section's text then
//   edited as on the twin, `check --json` reports exactly the stale twin's
//   findings (its exit code and its decoded report) and `ids --json`
//   answers exit 0 with the stale twin's answer (stdout byte-equal). After
//   each command, wherever a directory occupies the lock path (the dead
//   run's entry, the lock directory's occupants), the count half first
//   (helpers/lock-state.ts `assertLockDirectoryEntries`, the held-state
//   comparison's count half, the machinery VIOL-CORE-READERENTRY's
//   certification exercises): the lock directory holds exactly the dead
//   run's entry, or its staged occupants in place and no entry, nothing
//   else. Then the inclusion check (H-6; `captureLockPath` then
//   `assertLockPathAsCaptured`): the lock path holds exactly what was
//   staged — kind, name, content, and a link's target alike, a dead entry
//   by name and content — nothing added beside it; every link's target
//   outside the workspace byte-identical, every staged FIFO in place.
// - Clean path: on an unbuilt workspace `build` exits 0; then `review create
//   --strategy audit --name s --json`; then `build`, `check --json`,
//   `inventory --json`, `rename specs/A.mdx a a2 --preview --json`, `ids
//   --json`, `review status s --json`, and `version`; then, `g`'s text
//   edited, `ids --json`, and, the edit undone (graph data again stale, the
//   refresh having followed the edit), `review status s --json` — each
//   reading on stale graph data and so refreshing it before answering
//   (13.3). Each exits 0 and leaves nothing at `.xspec/lock`.
// - Unreadable leftovers (14.25: the lock path with everything under it is
//   no part of condition 23's state, a refused read there a read failure
//   wherever a command makes it): on a freshly built valid workspace holding
//   a dead run's entry staged as above, the lock directory made unlistable
//   (`--x`) and, on another such workspace, the entry made unreadable
//   (`-w-------`) — T14-10's disciplines (helpers/permissions.ts
//   `stageReadRefusalOfDirectory`, `stageReadRefusalOfFile`), each verified
//   on the harness itself, staged afresh before each command and restored
//   once it ends. `inventory --json`, `check --json`, and `ids --json` each
//   either answer exactly as on the twin — `recorded` available and equal,
//   finding-free; `check` clean; `ids` the twin's stdout; each exit 0 — or
//   exit 2 with the error document's `code` `"read-failure"` and `path`
//   `".xspec/lock"`, nothing modified (every path but the lock path,
//   compared with the lock path pruned from both walks: the unlistable lock
//   directory admits no walk); `move specs/A.mdx specs/B.mdx --preview
//   --json` exits 0, its `delta` available, its stdout byte-identical to the
//   twin's — never the read failure (6.6: a preview's answer is the real
//   operation's once holding exclusivity, which no state of the lock path
//   decides; T6.6-3(a)). Never `recorded` or `delta` unavailable, a
//   condition-23 finding, or `check`'s unit form: each falls outside both
//   admitted outcomes, a diagnosed failure naming it. After each command,
//   its permission restored (and, on a read's exit-2 path, before the
//   snapshot compare), the count half first — the lock directory holding
//   exactly one entry, a plain file, nothing beside it — then the lock path
//   holding exactly the dead entry, byte-identical, name and content, the
//   lock directory's only occupant (`assertLockPathHolds`).
// - Manual remedy (13.4): each obstruction of T13.5-10(a) (section-13.5-ii.ts
//   `OBSTRUCTIONS`, staged on its session staging, `stageArmWorkspace`) —
//   `.xspec` a plain file, a symbolic link to the workspace's own area
//   relocated outside it, a dangling symbolic link, or a FIFO; `.xspec/lock`
//   a symbolic link to a directory or to a file outside the workspace, a
//   dangling symbolic link, or a FIFO — deleted by hand while no mutating
//   command runs (the occupant itself, a link never followed), and the next
//   `rename specs/A.mdx a a2 --json` proceeds, exit 0.
//
// The arms needing exclusivity behaviour of the product — a dead run's
// entry exists only where a held mutating command leaves its entry in
// `.xspec/lock` — are the readable dead-entry staging and both unreadable
// stagings; a product keeping its exclusion state elsewhere fails each at
// `killHeldRun`, diagnosed (`found nothing at .xspec/lock`).
//
// CERTIFICATIONS.md: T13.4-12 lies in no certification scope (the Exclusions
// entry for T13.5-9 through T13.5-12 and T13.4-12): its absences of
// `.xspec/lock` are braced by the staged leftover's kind, name, and content
// asserted present after each command; its lock-path inclusions share the
// comparison machinery VIOL-CORE-READERENTRY certifies — the held-state
// comparison's count half (helpers/lock-state.ts
// `assertLockDirectoryEntries`), which VIOL-CORE-READERENTRY's certified
// failure of T13.5-4 exercises, run first wherever a directory occupies the
// lock path, the inclusion check following it; its stagings verify
// themselves on the harness before use, an ineffective staging a harness
// error (E-1, H-11), never a pass or a skip. A conformer serving it whole
// would carry `inventory`, `version`, and the preview documents of
// performable operations. The Linux leg's stagings: FIFOs, permission
// removals, the process list (E-1).
//
// T13.4-13. SPEC.md's catch-all occupant clauses, staged elsewhere with
// directories, symbolic links, and plain files alone, met by a FIFO — an
// occupant of none of those kinds, the Linux leg's (helpers/lock-staging.ts
// `stageFifo`; at `.xspec`, section-13.5-ii.ts `obstructArea` — `mkfifo`,
// never opened by the harness, each verified on the harness itself as a
// FIFO in place, E-1). Each arm starts from a fresh workspace of T10.1-6's
// shape (section-10.1.ts `CORE_FILES`: one spec group over
// `specs/**/*.mdx`, `specs/A.mdx` holding `a` with its child `a.k`) — (f)'s,
// (h)'s, and (g)'s third staging's configuration adding Markdown emission,
// (g)'s `specs/A.mdx` a section `x` — freshly built and holding the audit
// session `s` created while it was valid, then a FIFO at one path no glob
// matches. Every invocation once the FIFO stands runs under `--json`,
// bounded (`runBounded`): a product opening the FIFO with no writer blocks
// until its own guard ends it, a diagnosed failure; T10.1-6's sweeps, which
// (d) runs on their default guards, run under `promptly`, which turns the
// hang-guard kill alone into a diagnosed failure (S-3: termination, with
// the FIFO's state afterward, is all "promptly" and "no FIFO opened"
// assert; H-8). After
// each invocation the FIFO is still a FIFO in place (`assertFifosIntact`)
// unless a `build` replaced or removed it ((e), (h)), and a whole-root
// compare around each invocation but a `build` that succeeds finds nothing
// modified (H-6 leaving out the lock path alone where a mutating command
// acquired it); (d)'s sweeps make their own compares, the FIFO checked once
// each sweep has run. First, a FIFO-free twin — the arm staging alone, then
// `rename specs/A.mdx a a2 --json`, exit 0 — the premise that (a)'s, (b)'s,
// and (i)'s `rename` is an operation succeeding there.
// - (a) The configuration path (SPEC 7, 14.14): the root's
//   `xspec.config.ts` replaced by a FIFO, and, on a workspace of its own,
//   `alt.config.ts` a FIFO beside the valid root configuration, named by
//   `--config alt.config.ts`: `build`, `check`, `ids`, `view`, `inventory`,
//   and the `rename` (given that `--config` on the second) each exit 2 with
//   the error document — `code` `"configuration-error"`, `path` the FIFO's
//   path as found or named, `locations` [] (the occupant never read: no
//   in-source location; T12.7-3, T7-1) — and `version`, so given, exits 0
//   with its document (12.6: it loads no configuration).
// - (b) The journal path (SPEC 13.4, 14.13): `.xspec/journal` a FIFO —
//   `build`, `check`, and `ids` each report exactly one finding, condition
//   13 form-exact (`journal-error`, `.xspec/journal`, `locations` [];
//   T6.1-3's assertion), exit 1, `ids` answering nothing (the findings-only
//   report, 13.3), and the `rename` is refused with that finding alone
//   (6.4's precondition), exit 1; `inventory` reports `journal` exactly
//   `{"path": ".xspec/journal", "occupied": true}`, finding-free, exit 0
//   (11.6: occupancy by presence alone, nothing read); and `occurrences`,
//   `view specs/A.mdx`, and `at specs/A.mdx 0` each answer finding-free,
//   exit 0 (11.2: the journal's condition accompanies no answer).
// - (c) A session file (SPEC 13.4, 10.1, 14.21): `.xspec/reviews/s.json` a
//   FIFO — `check`, `review status s`, and `review list` each report `s`
//   corrupt, exit 1: at least one finding, every one condition 21
//   concerning `.xspec/reviews/s.json` with `locations` [] (T10.1-4's rule;
//   `check` reporting nothing else, the workspace otherwise valid and
//   freshly built), `review list` listing `s` corrupt in place of its
//   fields; `inventory` lists `.xspec/reviews/s.json`, its one session,
//   finding-free, exit 0 (11.6: sessions selected by name alone).
// - (d) The session directory and the area's own path (SPEC 10.1, 11.6,
//   13.4): `.xspec/reviews` a FIFO, and separately `.xspec` a FIFO, each on
//   its workspace, run the commands T10.1-6's plain-file arm for that path
//   runs, judged by that arm's own sweeps (section-10.1.ts
//   `assertSessionDirectoryOccupied`; `assertAreaOccupied` and
//   `assertMutatingCommandsFailAtAcquisition` on `stageT1016AreaWorkspace`'s
//   staging, a git repository holding `c1`), so each answers exactly as
//   there — T10.1-6's stale-twin runs aside.
// - (e) A derived file's path (SPEC 13.4, 14.10): the generated module
//   `specs/A.xspec.ts` (13.1) — a plain file once the staging's `build` has
//   run, a premise — replaced by a FIFO: `check` reports exactly one
//   finding, condition 10 in the per-file form, form-exact
//   (`stale-output`, `specs/A.xspec.ts`, `locations` []) and instructing
//   rebuilding, exit 1; `build --json` exits 0 finding-free, replacing the
//   FIFO with a plain file byte-equal to the module a FIFO-free twin's
//   `build` generates (the arm staging, then `build --json`, on a workspace
//   of its own: 12.0's byte-determinism); and `check` is then clean.
// - (f) A write path's directory component (SPEC 13.4, 14.22, 11.2): under
//   `markdown: { emit: true, outDir: "out" }`, built — `out/specs/A.md` a
//   plain file, a premise — the directory `out` with all it holds replaced
//   by a FIFO: `build` and `check` each report exactly one finding,
//   condition 22 form-exact (`obstructed-write-path`, `out`, `locations`
//   []), exit 1, modifying nothing (T13.4-6's assertion); and (b)'s
//   surfaces of 11.2 each answer finding-free, exit 0 (the write path's
//   condition accompanying no answer).
// - (g) A move's destination and its components (SPEC 6.5): under the spec
//   glob `specs/**/*.mdx`, `specs/A.mdx` holding a section `x` beside `a`
//   and `a.k`, each staging on a workspace of its own: `other/` staged
//   empty and `other/B.mdx` a FIFO in no spec group — `move specs/A.mdx
//   other/B.mdx` and `move specs/A.mdx#x other/B.mdx#x` each exit 1 with
//   exactly two findings, `refused-destination-exists` and
//   `refused-invalid-destination`, each concerning `other/B.mdx` (T6.5-4's
//   two-reason arm); `specs/sub` a FIFO — `move specs/A.mdx
//   specs/sub/B.mdx`; and, under (f)'s configuration once built
//   (`out/specs` a directory, a premise), `out/specs/new` a FIFO, a
//   component of the destination's emit path — `move specs/A.mdx
//   specs/new/B.mdx`: each exit 1 with exactly one finding,
//   `refused-invalid-destination` concerning the destination, a refused
//   operation reporting refusal reasons alone.
// - (h) A recorded derived path no longer generated (SPEC 13.4, 14.10):
//   built with emission next to sources (`markdown: { emit: true }`) —
//   `specs/A.md` a plain file, a premise — `specs/A.md` replaced by a FIFO,
//   then emission disabled (`markdown: { emit: false }`, a staged record):
//   `check` reports exactly one condition-10 finding concerning
//   `specs/A.md`, the recorded-file form, form-exact and instructing
//   rebuilding, and no other finding but, tolerated unasserted, one in the
//   graph-data unit form (concerning the area, `.xspec`; T13.4-11(a)), exit
//   1; `build --json` exits 0 finding-free, nothing at `specs/A.md`
//   afterward; and `check` is then clean.
// - (i) The hold path (SPEC 13.5): a FIFO staged outside the workspace, in
//   a directory of its own in the workspace's temporary directory, then
//   `rename specs/A.mdx a a2 --test-hold <that FIFO> --json` — an
//   operation succeeding on the FIFO-free twin — exits 2 with the error
//   document, `code` and `path` `null` (13.5's usage error, a plain one:
//   12.7, never 14.24's write failure), nothing modified, the FIFO still a
//   FIFO in place, and `.xspec/lock` absent afterwards (T13.5-11).
//
// CERTIFICATIONS.md places T13.4-13 in no fixture's scope; its stagings
// verify themselves on the harness before use, an ineffective staging a
// harness error (E-1, H-11), never a pass or a skip.

import { Buffer } from "node:buffer";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import {
  decodeAtReport,
  decodeFindingsReport,
  decodeInventoryDocument,
  decodeOccurrencesReport,
  decodePreviewReport,
  decodeVersionDocument,
  decodeViewReport,
} from "../../helpers/adapters/forms.js";
import type { DecodedDatum } from "../../helpers/adapters/forms.js";
import type { Finding, PathValue } from "../../helpers/adapters/model.js";
import { decodeSessionListReport } from "../../helpers/adapters/review.js";
import {
  assertBytesEqual,
  assertExitCode,
  fail,
  HarnessAssertionError,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { isHangGuardKill } from "../../helpers/hang-guards.js";
import { EXCLUDE_LOCK_PATH, LOCK_PATH } from "../../helpers/lock-path.js";
import type {
  DeadRun,
  LeftoverNode,
  StagedLeftover,
} from "../../helpers/lock-staging.js";
import {
  assertFifosIntact,
  assertOutsideTargetsUntouched,
  killHeldRun,
  stageFifo,
  stageLeftover,
} from "../../helpers/lock-staging.js";
import type {
  LockDirectoryExpectation,
  LockPathCapture,
} from "../../helpers/lock-state.js";
import {
  assertLockDirectoryEntries,
  assertLockPathAbsent,
  assertLockPathAsCaptured,
  assertLockPathHolds,
  captureLockPath,
} from "../../helpers/lock-state.js";
import type { PermissionStaging } from "../../helpers/permissions.js";
import {
  stageReadRefusalOfDirectory,
  stageReadRefusalOfFile,
} from "../../helpers/permissions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import {
  assertLeavesUnchanged,
  assertSnapshotsEqual,
  snapshotDirectory,
} from "../../helpers/snapshot.js";
import { stagedMdx } from "../../helpers/staged-mdx.js";
import { stagedTs } from "../../helpers/staged-ts.js";
import type { ProductBinding, RunResult } from "../../helpers/subprocess.js";
import {
  rethrowHarnessError,
  summarizeResult,
} from "../../helpers/subprocess.js";
import type { EntryKind, WorkspaceDecl } from "../../helpers/workspace.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import {
  assertAreaOccupied,
  assertMutatingCommandsFailAtAcquisition,
  assertSessionDirectoryOccupied,
  CORE_FILES as T10_1_CORE_FILES,
  stageT1016AreaWorkspace,
} from "./section-10.1.js";
import type { Obstruction } from "./section-13.5-ii.js";
import {
  OBSTRUCTIONS,
  obstructArea,
  RENAME_A,
  stageArmWorkspace,
} from "./section-13.5-ii.js";
import {
  assertCleanCheckReport,
  CORE_A_STAGED,
  CORE_DECL,
  runBounded,
} from "./section-13.5.js";
import {
  assertConditionCounts,
  assertFindingConcernsPath,
  assertFindingInstructsRebuilding,
  assertSameJson,
  expectErrorDocument,
} from "./support.js";
import { holdPathFor } from "./write-refusal-staging.js";

/** The stable code of 14.25, the read failure. */
const READ_FAILURE_CODE = "read-failure";

/** The rule every lock-path inclusion below cites. */
const INCLUSION_RULE =
  "the lock path holds exactly what was staged — kind, name, content, and " +
  "a link's target alike — nothing added beside it: a lock directory " +
  "exactly its staged occupants, its staged directory exactly the file " +
  "staged in it (H-6; SPEC 13.4: the lock path is transient, no write but " +
  "acquisition and release touching it)";

/**
 * The rule every count half below cites, wherever a directory occupies the
 * lock path around a command that acquires nothing.
 */
const COUNT_RULE =
  "the count half — the lock directory holds exactly the entries it held " +
  "once staged, beside any occupants the harness staged there, no entry " +
  "added and none removed: a command that acquires nothing adds no entry " +
  "there and removes none (H-6; SPEC 13.4: no write but acquisition and " +
  "release touches the lock path; 13.5)";

/** The staleness edit's spelling: `g`'s text in CORE_DECL's `specs/A.mdx`. */
const GAMMA_TEXT = "Gamma text.";

/** CORE_DECL's `specs/A.mdx` as text, for the staleness edit below. */
function coreSourceText(): string {
  const source = CORE_A_STAGED.source;
  return typeof source === "string"
    ? source
    : Buffer.from(source).toString("utf8");
}

/**
 * The staleness edit (TEST-SPEC T13.4-12: "a section's text edited"): `g`'s
 * text changed, structure and identities kept — the graph data the earlier
 * `build` wrote no longer matches the sources (SPEC 13.3), the workspace
 * staying valid. Staged after product invocations, so a ledger record (S-9's
 * before-any-product clause; helpers/staged-mdx.ts).
 */
const T13_4_12_A_EDITED = stagedMdx(
  "T13.4-12 stale arms: specs/A.mdx with g's text edited",
  (() => {
    const text = coreSourceText();
    if (!text.includes(GAMMA_TEXT)) {
      throw new Error(
        `T13.4-12: CORE_DECL's specs/A.mdx no longer spells ${JSON.stringify(GAMMA_TEXT)}`,
      );
    }
    return text.replace(GAMMA_TEXT, "Gamma text, edited.");
  })(),
);

/** `inventory --json` (SPEC 11.6). */
const INVENTORY: readonly string[] = ["inventory", "--json"];
/** `check --json` (SPEC 12.2). */
const CHECK: readonly string[] = ["check", "--json"];
/** `ids --json`, a refreshing read (SPEC 13.3). */
const IDS: readonly string[] = ["ids", "--json"];
/** `build` (SPEC 12.1). */
const BUILD: readonly string[] = ["build"];
/**
 * `move specs/A.mdx specs/B.mdx --preview --json`: a preview of an
 * operation succeeding on the twin (SPEC 6.6: it acquires nothing).
 */
const MOVE_PREVIEW: readonly string[] = [
  "move",
  "specs/A.mdx",
  "specs/B.mdx",
  "--preview",
  "--json",
];

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

/**
 * Run `argv` bounded in the workspace and assert exit 0, `rule` naming why.
 */
async function runOk(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  context: string,
  rule: string,
): Promise<RunResult> {
  const result = await runBounded(product, workspace.root, argv, context);
  assertExitCode(result, 0, `${context}: ${rule}`);
  return result;
}

/**
 * A freshly built valid workspace: `build` on CORE_DECL's staging, exit 0,
 * and — leftover-free — nothing at `.xspec/lock` once it has run (SPEC 13.4:
 * the lock path is no write path of `build`'s).
 */
async function buildFresh(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
): Promise<void> {
  await runOk(
    product,
    workspace,
    BUILD,
    `${context} staging \`build\``,
    "`build` succeeds on a valid workspace (SPEC 12.1)",
  );
  await assertLockPathAbsent(
    workspace.root,
    `${context}: once \`build\` has run, before anything is staged (SPEC ` +
      `13.4: no write but acquisition and release touches the lock path)`,
  );
}

/**
 * `inventory --json`'s findings and `recorded` datum, the whole document
 * decoded form-exactly (H-3; SPEC 11.6, 12.7: `lock` among its members).
 */
function inventoryRecorded(
  result: RunResult,
  context: string,
): {
  readonly findings: readonly Finding[];
  readonly recorded: DecodedDatum<readonly PathValue[]>;
} {
  const document = decodeInventoryDocument(
    parseJsonStdout(result, context),
    context,
  );
  return { findings: document.findings, recorded: document.recorded };
}

/** `check --json`'s exit code and decoded findings (a 12.7 findings report). */
interface CheckAnswer {
  readonly result: RunResult;
  readonly findings: readonly Finding[];
}

/** The leftover-free twin's answers (module header). */
interface LeftoverFreeTwin {
  /** `inventory --json`'s `recorded` paths on the freshly built workspace. */
  readonly recorded: readonly PathValue[];
  /** `ids --json` on the freshly built workspace. */
  readonly ids: RunResult;
  /** The preview of `move specs/A.mdx specs/B.mdx` there. */
  readonly preview: RunResult;
  /** `check --json` once a section's text is edited. */
  readonly staleCheck: CheckAnswer;
  /** `ids --json` then. */
  readonly staleIds: RunResult;
}

/** A `check --json` run's exit code and report: exit 0 or 1, else failed. */
function checkAnswer(result: RunResult, context: string): CheckAnswer {
  if (
    result.signal !== null ||
    (result.exitCode !== 0 && result.exitCode !== 1)
  ) {
    fail(
      `${context}: \`check\` reports findings, exit 0 or 1 (SPEC 12.2, ` +
        `12.0), got ${summarizeResult(result)}`,
    );
  }
  const { findings } = decodeFindingsReport(
    parseJsonStdout(result, context),
    context,
  );
  return { result, findings };
}

/**
 * The leftover-free twin (module header): a fresh workspace, freshly built,
 * then `inventory`, `ids`, the preview, `build`, the staleness edit,
 * `check`, and `ids`, each bounded.
 */
async function leftoverFreeTwin(
  product: ProductBinding,
): Promise<LeftoverFreeTwin> {
  return await withWorkspace(CORE_DECL, async (workspace) => {
    const context = "T13.4-12 the leftover-free twin";
    await buildFresh(product, workspace, context);
    const inventoryContext = `${context} \`inventory --json\``;
    const inventory = inventoryRecorded(
      await runOk(
        product,
        workspace,
        INVENTORY,
        inventoryContext,
        "`inventory` answers whatever the sources' validity (SPEC 11.6)",
      ),
      inventoryContext,
    );
    assertSameJson(
      inventory.findings,
      [],
      `${inventoryContext}: finding-free on a freshly built valid workspace ` +
        `(SPEC 11.6, 14.23)`,
    );
    if (inventory.recorded.state !== "value") {
      fail(
        `${inventoryContext}: staging premise — on a freshly built valid ` +
          `workspace \`recorded\` is available, the paths \`build\` ` +
          `generated (SPEC 11.6, 13.3); got ${inventory.recorded.state}`,
      );
    }
    const ids = await runOk(
      product,
      workspace,
      IDS,
      `${context} \`ids --json\``,
      "a read on a valid workspace answers (SPEC 13.3)",
    );
    const previewContext = `${context} \`${MOVE_PREVIEW.join(" ")}\``;
    const preview = await runOk(
      product,
      workspace,
      MOVE_PREVIEW,
      previewContext,
      "staging premise — the preview of an operation succeeding there " +
        "succeeds (SPEC 6.6, 6.5)",
    );
    assertDeltaAvailable(preview, previewContext);
    await runOk(
      product,
      workspace,
      BUILD,
      `${context} \`build\` again`,
      "`build` succeeds on a valid workspace (SPEC 12.1)",
    );
    await workspace.file("specs/A.mdx", T13_4_12_A_EDITED);
    const staleCheckContext = `${context} \`check --json\` once stale`;
    const staleCheck = checkAnswer(
      await runBounded(product, workspace.root, CHECK, staleCheckContext),
      staleCheckContext,
    );
    const staleIds = await runOk(
      product,
      workspace,
      IDS,
      `${context} \`ids --json\` once stale`,
      "a refreshing read on a valid workspace answers (SPEC 13.3)",
    );
    await assertLockPathAbsent(
      workspace.root,
      `${context}: once its commands have run (SPEC 13.4)`,
    );
    return {
      recorded: inventory.recorded.value,
      ids,
      preview,
      staleCheck,
      staleIds,
    };
  });
}

/**
 * A preview's `delta` available — neither `null` nor the unavailability
 * marker (SPEC 6.6, 14.23: the lock path is no part of the record, so its
 * state never makes the record unreadable).
 */
function assertDeltaAvailable(result: RunResult, context: string): void {
  const report = decodePreviewReport(parseJsonStdout(result, context), context);
  if (report.delta === null || "unavailable" in report.delta) {
    fail(
      `${context}: the preview's \`delta\` is available — never \`null\` ` +
        `(a successful preview's plan, 12.7) nor unavailable (14.23: the ` +
        `lock path with everything under it is no part of the record, its ` +
        `state never making the record unreadable; SPEC 13.4, 6.6); got ` +
        `${JSON.stringify(report.delta)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Readable leftovers and obstructions
// ---------------------------------------------------------------------------

/** What each plain file the harness stages in a leftover holds. */
const LEFTOVER_BYTES = "A leftover the harness staged.\n";

/**
 * The garbage a plain file at `.xspec/lock` holds: `garbage `, then
 * ill-formed UTF-8 (a lone continuation byte, an overlong lead and its
 * continuation, a truncated three-byte sequence) around a NUL — no entry's
 * form and no record's (SPEC 13.4: the lock path bears on no record).
 */
const GARBAGE_BYTES = Buffer.from([
  0x67, 0x61, 0x72, 0x62, 0x61, 0x67, 0x65, 0x20, 0x80, 0xc0, 0xaf, 0x00, 0xe2,
  0x82, 0x0a,
]);

/** One occupant of the last readable staging's lock directory. */
interface LockDirectoryLeftover {
  /** Its name in the lock directory: staged at `.xspec/lock/<name>`. */
  readonly name: string;
  readonly node: LeftoverNode;
}

/**
 * The occupants of the last readable staging's lock directory, each staged
 * in turn at `.xspec/lock/<name>`, beside what the lock directory already
 * holds (`stageLeftover`, the first creating it; each staging verified on
 * the harness itself): a symbolic link to a directory outside the workspace
 * holding a file, a FIFO, and a directory holding a file — no plain file of
 * the harness's own naming at its top level (the entry form is the
 * product's own, 13.5; helpers/lock-staging.ts refuses one). Each is a
 * record of its own, so the count half stands each beside the entries
 * (helpers/lock-state.ts `assertLockDirectoryEntries` takes occupants
 * staged at `.xspec/lock/<name>` alone).
 */
const LOCK_DIRECTORY_LEFTOVERS: readonly LockDirectoryLeftover[] = [
  {
    name: "leftover-link",
    node: { kind: "symlink", target: { kind: "dir" } },
  },
  { name: "leftover-fifo", node: { kind: "fifo" } },
  {
    name: "leftover-directory",
    node: {
      kind: "dir",
      entries: [
        { name: "file", node: { kind: "file", content: LEFTOVER_BYTES } },
      ],
    },
  },
];

/** One readable leftover or obstruction (module header). */
interface ReadableStaging {
  readonly what: string;
  /**
   * Where the staging leaves a directory at the lock path: the number of
   * entries it holds beside the occupants the harness staged there — the
   * dead run's one, or none — which the count half asserts after each
   * command. Absent where no directory occupies the lock path (a plain
   * file, a symbolic link, or a FIFO at it).
   */
  readonly lockDirectoryEntries?: number;
  /**
   * Stage it on a freshly built valid workspace. Returns the stagings whose
   * outside targets and FIFOs are judged beside the inclusion check — in a
   * lock directory, the occupants the count half stands beside the entries —
   * none for a dead run's entry, which the capture holds by name and
   * content.
   */
  readonly stage: (
    product: ProductBinding,
    workspace: TestWorkspace,
    context: string,
  ) => Promise<readonly StagedLeftover[]>;
}

/** The held command whose kill leaves a dead run's entry. */
const KILLED_RENAME: readonly string[] = ["rename", "specs/A.mdx", "a", "a2"];

/**
 * A dead run's entry: a held `rename specs/A.mdx a a2` killed under
 * T13.5-3's discipline (`killHeldRun`: its own process group, SIGKILL, its
 * exit collected, the group confirmed gone), the lock directory's one entry
 * left; the workspace otherwise as before the run — 13.5's hold precedes
 * every modification, the compare leaving out the lock path the run acted
 * on (H-6) — so the staging is the freshly built valid workspace holding a
 * dead run's entry.
 */
async function stageDeadEntry(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
): Promise<DeadRun> {
  const before = await snapshotDirectory(workspace.root);
  const dead = await killHeldRun(product, {
    root: workspace.root,
    argv: KILLED_RENAME,
    holdPath: holdPathFor(workspace, "hold-killed.tmp"),
    context: `${context}: the held \`rename specs/A.mdx a a2\``,
  });
  assertSnapshotsEqual(
    before,
    await snapshotDirectory(workspace.root),
    `${context}: the held \`rename\`, killed while held, modified nothing — ` +
      `the hold precedes every modification (SPEC 13.5) — so the workspace ` +
      `is the freshly built one, holding the dead run's entry (H-6: the ` +
      `lock path aside)`,
  );
  return dead;
}

/**
 * The readable leftovers and obstructions, staged in turn (module header):
 * a lock directory — the dead run's entry alone, or the staged occupants
 * and no entry — under the count half after each command, then the
 * inclusion check; a plain file, a symbolic link, or a FIFO at the lock
 * path itself under the inclusion check alone (no directory occupies it).
 */
const READABLE_STAGINGS: readonly ReadableStaging[] = [
  {
    what: "a dead run's entry (a held `rename` killed under T13.5-3's discipline)",
    lockDirectoryEntries: 1,
    stage: async (product, workspace, context) => {
      await stageDeadEntry(product, workspace, context);
      return [];
    },
  },
  {
    what: "a plain file at `.xspec/lock` holding garbage",
    stage: async (_product, workspace) => [
      await stageLeftover(workspace, LOCK_PATH, {
        kind: "file",
        content: GARBAGE_BYTES,
      }),
    ],
  },
  {
    what:
      "a symbolic link at `.xspec/lock` to a directory outside the " +
      "workspace holding a file",
    stage: async (_product, workspace) => [
      await stageLeftover(workspace, LOCK_PATH, {
        kind: "symlink",
        target: { kind: "dir" },
      }),
    ],
  },
  {
    what: "a FIFO at `.xspec/lock`",
    stage: async (_product, workspace) => [
      await stageLeftover(workspace, LOCK_PATH, { kind: "fifo" }),
    ],
  },
  {
    what:
      "a lock directory holding a symbolic link (to a directory outside the " +
      "workspace holding a file), a FIFO, and a directory holding a file",
    lockDirectoryEntries: 0,
    stage: async (_product, workspace) => {
      const staged: StagedLeftover[] = [];
      for (const leftover of LOCK_DIRECTORY_LEFTOVERS) {
        staged.push(
          await stageLeftover(
            workspace,
            `${LOCK_PATH}/${leftover.name}`,
            leftover.node,
          ),
        );
      }
      return staged;
    },
  },
];

/**
 * A readable arm's command: bounded; then, wherever a directory occupies the
 * lock path (`lockDirectory` given), the count half first — the lock
 * directory holding exactly `lockDirectory`'s entries beside the occupants
 * the harness staged there, each in place, nothing else
 * (helpers/lock-state.ts `assertLockDirectoryEntries`, the half
 * VIOL-CORE-READERENTRY's certification exercises); then the inclusion
 * check (H-6: the lock path as captured once the staging was made, nothing
 * added beside it), every staged link's target untouched, and every staged
 * FIFO in place.
 */
async function includedRun(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  capture: LockPathCapture,
  staged: readonly StagedLeftover[],
  lockDirectory: LockDirectoryExpectation | undefined,
  context: string,
): Promise<RunResult> {
  const result = await runBounded(product, workspace.root, argv, context);
  if (lockDirectory !== undefined) {
    await assertLockDirectoryEntries(
      workspace.root,
      lockDirectory,
      `${context}, once it has exited: ${COUNT_RULE}`,
    );
  }
  await assertLockPathAsCaptured(
    capture,
    `${context}, once it has exited: ${INCLUSION_RULE}`,
  );
  await assertOutsideTargetsUntouched(
    staged,
    `${context}: nothing written, removed, or added through a link (SPEC ` +
      `13.4: writes never traverse symbolic links)`,
  );
  await assertFifosIntact(staged, `${context}: the staged FIFO stays in place`);
  return result;
}

/**
 * `inventory --json` answering as on the leftover-free twin (exit 0 asserted
 * by the caller): finding-free, `recorded` available and equal to the
 * twin's — the lock path bears on no record (SPEC 13.4, 11.6, 14.23).
 */
function judgeInventory(
  result: RunResult,
  twin: LeftoverFreeTwin,
  context: string,
): void {
  const { findings, recorded } = inventoryRecorded(result, context);
  assertSameJson(
    findings,
    [],
    `${context}: finding-free — never a condition-23 finding (the lock path ` +
      `with everything under it is no part of the record: SPEC 13.4, 14.23)`,
  );
  if (recorded.state !== "value") {
    fail(
      `${context}: \`recorded\` is available — never unavailable (14.23: ` +
        `the lock path is no part of the record, so its state never makes ` +
        `the record unreadable; SPEC 13.4, 11.6); got ${recorded.state}`,
    );
  }
  assertSameJson(
    recorded.value,
    twin.recorded,
    `${context}: \`recorded\` equals the leftover-free twin's (SPEC 13.4: ` +
      `the lock path bears on no record; 11.6)`,
  );
}

/**
 * `check --json` on the stale workspace reporting exactly the leftover-free
 * stale twin's findings: the same exit code and the same decoded report
 * (SPEC 13.4: the lock path bears on no comparison of graph data; 14.10).
 */
function judgeStaleCheck(
  result: RunResult,
  twin: LeftoverFreeTwin,
  context: string,
): void {
  const expected = twin.staleCheck;
  if (result.signal !== null || result.exitCode !== expected.result.exitCode) {
    fail(
      `${context}: \`check\` reports exactly the leftover-free stale twin's ` +
        `findings, exiting as it does (SPEC 13.4: the lock path bears on no ` +
        `comparison of graph data; 14.10) — got ${summarizeResult(result)}; ` +
        `the twin's: ${summarizeResult(expected.result)}`,
    );
  }
  const { findings } = decodeFindingsReport(
    parseJsonStdout(result, context),
    context,
  );
  assertSameJson(
    findings,
    expected.findings,
    `${context}: exactly the leftover-free stale twin's findings (SPEC ` +
      `13.4: the lock path bears on no comparison of graph data; 14.10)`,
  );
}

/**
 * One readable arm (module header): on a fresh workspace, freshly built,
 * `staging` staged, the lock path captured; then `check`, `inventory`,
 * `build`, the staleness edit, `check`, and `ids`, each judged and followed
 * — wherever a directory occupies the lock path — by the count half, then by
 * the inclusion check.
 */
async function readableArm(
  product: ProductBinding,
  twin: LeftoverFreeTwin,
  staging: ReadableStaging,
): Promise<void> {
  await withWorkspace(CORE_DECL, async (workspace) => {
    const context = `T13.4-12 ${staging.what}`;
    await buildFresh(product, workspace, context);
    const staged = await staging.stage(product, workspace, context);
    const lockDirectory: LockDirectoryExpectation | undefined =
      staging.lockDirectoryEntries === undefined
        ? undefined
        : { entries: staging.lockDirectoryEntries, staged };
    const capture = await captureLockPath(workspace.root);
    const run = async (
      argv: readonly string[],
      label: string,
    ): Promise<RunResult> =>
      await includedRun(
        product,
        workspace,
        argv,
        capture,
        staged,
        lockDirectory,
        label,
      );

    const checkContext = `${context}: \`check --json\``;
    const check = await run(CHECK, checkContext);
    assertExitCode(
      check,
      0,
      `${checkContext}: clean, exit 0 — neither condition 10 (the lock ` +
        `path bears on no comparison of graph data and on no record: SPEC ` +
        `13.4, 13.3, 14.10) nor condition 22 (graph data lies beside it, so ` +
        `it is no write path of \`build\`'s: 14.22, 7.3)`,
    );
    assertCleanCheckReport(check, checkContext);

    const inventoryContext = `${context}: \`inventory --json\``;
    const inventory = await run(INVENTORY, inventoryContext);
    assertExitCode(
      inventory,
      0,
      `${inventoryContext}: \`recorded\` available and equal to the ` +
        `leftover-free twin's, finding-free, exit 0 — never \`recorded\` ` +
        `unavailable or a condition-23 finding (SPEC 13.4: the lock path ` +
        `bears on no record; 11.6, 14.23)`,
    );
    judgeInventory(inventory, twin, inventoryContext);

    const buildContext = `${context}: \`build\``;
    const build = await run(BUILD, buildContext);
    assertExitCode(
      build,
      0,
      `${buildContext}: exits 0 — the lock path is no write path of ` +
        `\`build\`'s, graph data lying beside it (SPEC 13.4, 14.22, 7.3), ` +
        `and \`build\` writes nothing there (13.4)`,
    );

    await workspace.file("specs/A.mdx", T13_4_12_A_EDITED);
    const staleCheckContext = `${context}: \`check --json\` once stale`;
    judgeStaleCheck(
      await run(CHECK, staleCheckContext),
      twin,
      staleCheckContext,
    );

    const staleIdsContext = `${context}: \`ids --json\` once stale`;
    const staleIds = await run(IDS, staleIdsContext);
    assertExitCode(
      staleIds,
      0,
      `${staleIdsContext}: a refreshing read answers exit 0 with the ` +
        `leftover-free stale twin's answer (SPEC 13.3, 13.4)`,
    );
    assertBytesEqual(
      staleIds.stdoutBytes,
      twin.staleIds.stdoutBytes,
      `${staleIdsContext}: the leftover-free stale twin's answer (SPEC ` +
        `13.3, 13.4; 12.0)`,
    );
  });
}

// ---------------------------------------------------------------------------
// Clean path
// ---------------------------------------------------------------------------

/** `review create --strategy audit --name s --json` (SPEC 10.7). */
const CREATE_S: readonly string[] = [
  "review",
  "create",
  "--strategy",
  "audit",
  "--name",
  "s",
  "--json",
];

/** `review status s --json`, a refreshing read (SPEC 10.7, 13.3). */
const REVIEW_STATUS_S: readonly string[] = ["review", "status", "s", "--json"];

/** One clean-path command once `s` exists: its description and arguments. */
interface CleanPathCommand {
  readonly what: string;
  readonly argv: readonly string[];
}

/** The clean path's commands once `s` exists, in turn (module header). */
const CLEAN_PATH_COMMANDS: readonly CleanPathCommand[] = [
  { what: "`build`", argv: BUILD },
  { what: "`check --json`", argv: CHECK },
  { what: "`inventory --json`", argv: INVENTORY },
  {
    what:
      "`rename specs/A.mdx a a2 --preview --json` (the preview of an " +
      "operation succeeding there)",
    argv: ["rename", "specs/A.mdx", "a", "a2", "--preview", "--json"],
  },
  { what: "`ids --json`", argv: IDS },
  { what: "`review status s --json`", argv: REVIEW_STATUS_S },
  { what: "`version`", argv: ["version"] },
];

/**
 * The clean path (module header): each command exits 0 and leaves nothing
 * at `.xspec/lock`.
 */
async function cleanPath(product: ProductBinding): Promise<void> {
  await withWorkspace(CORE_DECL, async (workspace) => {
    const step = async (
      argv: readonly string[],
      what: string,
    ): Promise<void> => {
      const context = `T13.4-12 clean path: ${what}`;
      await runOk(
        product,
        workspace,
        argv,
        context,
        "it succeeds on this valid workspace (SPEC 12.0)",
      );
      await assertLockPathAbsent(
        workspace.root,
        `${context}, once it has exited: nothing is left at the lock path — ` +
          `transient, present only while a mutating command acquires or ` +
          `holds exclusivity or as a leftover, no write but acquisition and ` +
          `release touching it, release on every normal end (SPEC 13.4, ` +
          `13.5)`,
      );
    };
    await step(BUILD, "`build` on an unbuilt valid workspace");
    await step(CREATE_S, "`review create --strategy audit --name s --json`");
    for (const command of CLEAN_PATH_COMMANDS) {
      await step(command.argv, command.what);
    }
    await workspace.file("specs/A.mdx", T13_4_12_A_EDITED);
    await step(
      IDS,
      "`ids --json` once `g`'s text is edited (graph data stale, refreshed " +
        "before answering: SPEC 13.3)",
    );
    await workspace.file("specs/A.mdx", CORE_A_STAGED);
    await step(
      REVIEW_STATUS_S,
      "`review status s --json` once the edit is undone (graph data stale " +
        "again, refreshed before answering: SPEC 13.3)",
    );
  });
}

// ---------------------------------------------------------------------------
// Unreadable leftovers
// ---------------------------------------------------------------------------

/** One unreadable staging over a dead run's entry (module header). */
interface UnreadableStaging {
  readonly what: string;
  /** Stage it on the workspace at `root` (verified on the harness itself). */
  readonly stage: (root: string, dead: DeadRun) => Promise<PermissionStaging>;
}

/** The dead run's entry in the workspace at `root`, absolute bytes. */
function deadEntryAbs(root: string, dead: DeadRun): Buffer {
  return Buffer.concat([
    Buffer.from(`${path.join(root, LOCK_PATH)}/`),
    dead.entry.name,
  ]);
}

/** T14-10's disciplines over the dead run's entry (module header). */
const UNREADABLE_STAGINGS: readonly UnreadableStaging[] = [
  {
    what: "the lock directory made unlistable (`--x`)",
    stage: async (root) =>
      await stageReadRefusalOfDirectory(path.join(root, LOCK_PATH)),
  },
  {
    what: "the entry made unreadable (`-w-------`)",
    stage: async (root, dead) =>
      await stageReadRefusalOfFile(deadEntryAbs(root, dead)),
  },
];

/** One read over an unreadable leftover: its arguments and its twin rule. */
interface UnreadableRead {
  readonly what: string;
  readonly argv: readonly string[];
  /** The exit-0 outcome, as the diagnosis names it. */
  readonly answer: string;
  /** Judge the exit-0 outcome: exactly as on the leftover-free twin. */
  readonly judge: (
    result: RunResult,
    twin: LeftoverFreeTwin,
    context: string,
  ) => void;
}

/** The reads over an unreadable leftover, in turn (module header). */
const UNREADABLE_READS: readonly UnreadableRead[] = [
  {
    what: "`inventory --json`",
    argv: INVENTORY,
    answer:
      "`recorded` available and equal to the twin's, finding-free — never " +
      "`recorded` unavailable or a condition-23 finding (14.23)",
    judge: judgeInventory,
  },
  {
    what: "`check --json`",
    argv: CHECK,
    answer:
      "clean — never a finding, condition 10's unit form among them " +
      "(14.10, 14.23)",
    judge: (result, _twin, context) => {
      assertCleanCheckReport(result, context);
    },
  },
  {
    what: "`ids --json`",
    argv: IDS,
    answer: "the twin's answer",
    judge: (result, twin, context) => {
      assertBytesEqual(
        result.stdoutBytes,
        twin.ids.stdoutBytes,
        `${context}: the leftover-free twin's answer (SPEC 13.4; 12.0)`,
      );
    },
  },
];

/** Run `action` with `permission` staged, restoring it however it ends. */
async function whileStaged<T>(
  permission: PermissionStaging,
  action: () => Promise<T>,
): Promise<T> {
  try {
    return await action();
  } finally {
    await permission.restore();
  }
}

/**
 * After each command over an unreadable leftover, its permission restored:
 * the count half first — the lock directory holding exactly one entry, a
 * plain file, and nothing beside it (helpers/lock-state.ts
 * `assertLockDirectoryEntries`, the half VIOL-CORE-READERENTRY's
 * certification exercises) — then the dead run's entry byte-identical, name
 * and content, the lock directory's only occupant (H-6; SPEC 13.4).
 */
async function assertDeadEntryAlone(
  root: string,
  dead: DeadRun,
  context: string,
): Promise<void> {
  await assertLockDirectoryEntries(
    root,
    { entries: 1 },
    `${context}, its permissions restored to inspect it: ${COUNT_RULE}`,
  );
  await assertLockPathHolds(
    root,
    { entries: [dead.entry] },
    `${context}, its permissions restored to inspect it: the dead run's ` +
      `entry stays byte-identical, name and content, the lock directory's ` +
      `only occupant (H-6; SPEC 13.4: no write but acquisition and release ` +
      `touches the lock path)`,
  );
}

/**
 * One read over an unreadable leftover (module header): either exactly the
 * twin's answer, exit 0, or exit 2 with the read failure at the lock path,
 * nothing modified; then the dead entry alone.
 */
async function unreadableReadRun(
  product: ProductBinding,
  workspace: TestWorkspace,
  twin: LeftoverFreeTwin,
  dead: DeadRun,
  staging: UnreadableStaging,
  read: UnreadableRead,
  context: string,
): Promise<void> {
  // The lock path is pruned from both walks — an unlistable lock directory
  // admits none — and judged once its permissions are restored
  // (assertDeadEntryAlone); a staging changes modes alone, no bytes.
  const before = await snapshotDirectory(workspace.root, EXCLUDE_LOCK_PATH);
  const permission = await staging.stage(workspace.root, dead);
  const result = await whileStaged(
    permission,
    async () => await runBounded(product, workspace.root, read.argv, context),
  );
  if (result.signal === null && result.exitCode === 2) {
    const finding = expectErrorDocument(result, context);
    assertSameJson(
      { code: finding.code, path: finding.path },
      { code: READ_FAILURE_CODE, path: LOCK_PATH },
      `${context}: exit 2 is admitted only as the read failure at the lock ` +
        `path — the error document's \`code\` "${READ_FAILURE_CODE}", ` +
        `\`path\` "${LOCK_PATH}" (SPEC 14.25: SPEC.md states no read of the ` +
        `lock path by this command, yet makes any refused read there that ` +
        `read failure; 12.7) — message: ${JSON.stringify(finding.message)}`,
    );
    // The lock path first: a product moving the unlistable lock directory
    // elsewhere fails here, diagnosed, before a walk could meet it.
    await assertDeadEntryAlone(workspace.root, dead, context);
    assertSnapshotsEqual(
      before,
      await snapshotDirectory(workspace.root, EXCLUDE_LOCK_PATH),
      `${context}: the read failure modifies nothing (SPEC 14.25, 12.0; the ` +
        `lock path pruned from both walks, judged with its permissions ` +
        `restored)`,
    );
    return;
  }
  assertExitCode(
    result,
    0,
    `${context}: it either answers exactly as on the leftover-free twin, ` +
      `exit 0 — ${read.answer} — or exits 2 with the read failure at the ` +
      `lock path (SPEC 14.25: the lock path with everything under it is no ` +
      `part of condition 23's state, a refused read there a read failure; ` +
      `13.4)`,
  );
  read.judge(result, twin, context);
  await assertDeadEntryAlone(workspace.root, dead, context);
}

/**
 * The preview over an unreadable leftover (module header): exit 0, `delta`
 * available, stdout byte-identical to the twin's; then the dead entry alone.
 */
async function unreadablePreviewRun(
  product: ProductBinding,
  workspace: TestWorkspace,
  twin: LeftoverFreeTwin,
  dead: DeadRun,
  staging: UnreadableStaging,
  context: string,
): Promise<void> {
  const permission = await staging.stage(workspace.root, dead);
  const result = await whileStaged(
    permission,
    async () =>
      await runBounded(product, workspace.root, MOVE_PREVIEW, context),
  );
  assertExitCode(
    result,
    0,
    `${context}: the preview answers as on the leftover-free twin, exit 0 — ` +
      `never the read failure: a preview acquires nothing (SPEC 6.6, 13.5), ` +
      `its answer the real operation's once holding exclusivity, which no ` +
      `state of the lock path decides (T6.6-3(a)); never \`delta\` ` +
      `unavailable (14.23)`,
  );
  assertDeltaAvailable(result, context);
  assertBytesEqual(
    result.stdoutBytes,
    twin.preview.stdoutBytes,
    `${context}: its answer byte-identical to the same preview's on the ` +
      `leftover-free twin (SPEC 6.6, 13.4; 12.0)`,
  );
  await assertDeadEntryAlone(workspace.root, dead, context);
}

/**
 * One unreadable staging (module header): on a fresh workspace, freshly
 * built, a dead run's entry; then each read and the preview in turn, each
 * over the staging made afresh and restored once it ends.
 */
async function unreadableArm(
  product: ProductBinding,
  twin: LeftoverFreeTwin,
  staging: UnreadableStaging,
): Promise<void> {
  await withWorkspace(CORE_DECL, async (workspace) => {
    const context =
      `T13.4-12 an unreadable leftover: a dead run's entry, ` + staging.what;
    await buildFresh(product, workspace, context);
    const dead = await stageDeadEntry(product, workspace, context);
    for (const read of UNREADABLE_READS) {
      await unreadableReadRun(
        product,
        workspace,
        twin,
        dead,
        staging,
        read,
        `${context}: ${read.what}`,
      );
    }
    await unreadablePreviewRun(
      product,
      workspace,
      twin,
      dead,
      staging,
      `${context}: \`${MOVE_PREVIEW.join(" ")}\``,
    );
  });
}

// ---------------------------------------------------------------------------
// Manual remedy
// ---------------------------------------------------------------------------

/**
 * One obstruction of T13.5-10(a) deleted by hand (module header): staged on
 * its session staging, the occupant itself removed while no mutating
 * command runs — a symbolic link itself, never its target — then the next
 * `rename` proceeds, exit 0.
 */
async function manualRemedyRun(
  product: ProductBinding,
  obstruction: Obstruction,
): Promise<void> {
  await withWorkspace(CORE_DECL, async (workspace) => {
    const context = `T13.4-12 manual remedy: ${obstruction.what}`;
    const items = await stageArmWorkspace(product, workspace, context);
    await obstruction.stage(workspace);
    await fsp.unlink(path.join(workspace.root, obstruction.path));
    const renameContext =
      `${context}, deleted by hand while no mutating command runs, then ` +
      `${RENAME_A.what} --json`;
    const result = await runBounded(
      product,
      workspace.root,
      [...RENAME_A.argv(items), "--json"],
      renameContext,
    );
    assertExitCode(
      result,
      0,
      `${renameContext}: the next \`rename\` proceeds — the occupant of the ` +
        `lock path, or anything but a directory at \`.xspec\`, MAY be ` +
        `deleted manually while no mutating command runs, the remedy for an ` +
        `occupant obstructing acquisition (SPEC 13.4, 13.5)`,
    );
  });
}

// ---------------------------------------------------------------------------
// T13.4-12
// ---------------------------------------------------------------------------

const T13_4_12 = defineProductTest({
  id: "T13.4-12",
  title:
    "the transient lock path: on a freshly built valid workspace, each readable leftover or obstruction staged in turn — a dead run's entry (a held `rename` killed under T13.5-3's discipline), a plain file at `.xspec/lock` holding garbage, a symbolic link there to a directory outside the workspace holding a file, a FIFO there, and a lock directory holding a symbolic link, a FIFO, and a directory holding a file — `check` is clean, exit 0 (neither condition 10 nor condition 22), `inventory` reports `recorded` available and equal to a leftover-free twin's, finding-free, exit 0, and `build` exits 0; with a section's text then edited, `check` reports exactly the leftover-free stale twin's findings and `ids` answers exit 0 with the twin's answer; each command prompt, the staging byte-untouched — kind, name, content, and a link's target alike — the lock path holding after each command exactly what was staged, nothing added beside it (H-6); clean path: `build` on an unbuilt valid workspace, `review create` of an audit session `s`, then `build`, `check`, `inventory`, `rename --preview` of an operation succeeding there, `ids`, `review status s`, and `version`, and `ids` and `review status s` each on stale graph data (refreshing it before answering) — each exits 0 and leaves nothing at `.xspec/lock`; unreadable leftovers — a dead run's entry with the lock directory unlistable (`--x`) and, separately, the entry unreadable (`-w-------`), each verified on the harness itself: `inventory`, `check`, and `ids` each answer exactly as on the leftover-free twin, exit 0, or exit 2 with the error document's `code` `\"read-failure\"`, `path` `\".xspec/lock\"`, nothing modified; a `move --preview` of an operation succeeding on the twin answers byte-identically to the twin's, its `delta` available, exit 0 — never `recorded` or `delta` unavailable, a condition-23 finding, or `check`'s unit form; the entry byte-identical, name and content, and the lock directory's only occupant (permissions restored to inspect it); manual remedy: each obstruction of T13.5-10(a) deleted by hand while no mutating command runs, the next `rename` exits 0 (SPEC 13.4, 13.5, 13.3, 11.6, 6.6, 14.10, 14.22, 14.23, 14.25)",
  run: async (product) => {
    const twin = await leftoverFreeTwin(product);
    // Readable leftovers and obstructions, each on a fresh workspace.
    for (const staging of READABLE_STAGINGS) {
      await readableArm(product, twin, staging);
    }
    // The clean path.
    await cleanPath(product);
    // Unreadable leftovers over a dead run's entry, each on a fresh
    // workspace, staged afresh for each command.
    for (const staging of UNREADABLE_STAGINGS) {
      await unreadableArm(product, twin, staging);
    }
    // The manual remedy: each obstruction of T13.5-10(a) deleted by hand.
    for (const obstruction of OBSTRUCTIONS) {
      await manualRemedyRun(product, obstruction);
    }
  },
});

// ---------------------------------------------------------------------------
// T13.4-13 — any other occupant: FIFOs
// ---------------------------------------------------------------------------

/**
 * Every T13.4-13 workspace but (f)'s, (g)'s, and (h)'s: T10.1-6's
 * (section-10.1.ts `CORE_FILES` — one spec group over the `.mdx` files
 * under `specs/`, `specs/A.mdx` holding `a` with its child `a.k`), so (d)
 * runs T10.1-6's plain-file arms' sweeps on the workspace shape they were
 * written for; the others vary its configuration or `specs/A.mdx` alone.
 */
const FIFO_ARM_DECL: WorkspaceDecl = { files: T10_1_CORE_FILES };

/** The root's configuration file, the upward search's entry (SPEC 7). */
const ROOT_CONFIG = "xspec.config.ts";
/** The path (a)'s second staging names through `--config` (SPEC 7). */
const ALT_CONFIG = "alt.config.ts";
/** The journal path (SPEC 6.1). */
const JOURNAL = ".xspec/journal";
/** The session directory (SPEC 10.1). */
const SESSION_DIRECTORY = ".xspec/reviews";
/** The audit session `s`'s file, `.xspec/reviews/<name>.json` (SPEC 10.1). */
const SESSION_S_FILE = ".xspec/reviews/s.json";

/** Condition 13's stable code (SPEC 14, 14.13, 12.7). */
const JOURNAL_ERROR_CODE = "journal-error";
/** Condition 14's stable code (SPEC 14, 14.14, 12.7; T12.7-3). */
const CONFIGURATION_ERROR_CODE = "configuration-error";
/** Condition 21's stable code (SPEC 14, 14.21, 12.7). */
const CORRUPT_SESSION_CODE = "corrupt-session";

/**
 * `rename specs/A.mdx a a2`: (a)'s, (b)'s, and (i)'s `rename`, an operation
 * succeeding on the FIFO-free twin (`fifoFreeTwin`, a premise).
 */
const FIFO_ARM_RENAME: readonly string[] = ["rename", "specs/A.mdx", "a", "a2"];

/**
 * Run `action` — T10.1-6's sweeps (section-10.1.ts), whose invocations
 * carry the driver's default guard and convert nothing — turning the
 * hang-guard kill, and it alone, into a diagnosed failure: every invocation
 * of a T13.4-13 arm completes promptly, and a product opening a FIFO with no
 * writer blocks until its own guard ends it (TEST-SPEC T13.4-13, S-3:
 * termination is all "promptly" asserts; H-8: hangs become diagnosed
 * failures). A diagnosed failure and a harness error propagate as
 * themselves (H-11).
 */
async function promptly<T>(
  context: string,
  action: () => Promise<T>,
): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof HarnessAssertionError) throw error;
    rethrowHarnessError(error);
    if (!isHangGuardKill(error)) throw error;
    return fail(
      `${context}: every invocation completes promptly, the FIFO never ` +
        `opened — an open of a FIFO with no writer blocks, and this one ` +
        `ran until its own guard ended it (TEST-SPEC S-3; SPEC 13.4, 10.1, ` +
        `11.6; H-8: hangs become diagnosed failures) — ` +
        `${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * T13.4-13's arm staging ("a freshly built valid workspace holding an
 * `audit` session `s` created while it was valid"): on a fresh
 * `FIFO_ARM_DECL` workspace, `build`, then `review create --strategy audit
 * --name s --json`, each bounded, exit 0.
 */
async function stageFifoArm(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
): Promise<void> {
  await runOk(
    product,
    workspace,
    BUILD,
    `${context} staging \`build\``,
    "`build` succeeds on a valid workspace (SPEC 12.1)",
  );
  await runOk(
    product,
    workspace,
    CREATE_S,
    `${context} staging \`${CREATE_S.join(" ")}\``,
    "an audit session is created on a valid workspace (SPEC 10.7)",
  );
}

/**
 * Stage a FIFO at `rel` in place of whatever occupies it (TEST-SPEC
 * T13.4-13: "a FIFO at one path"): its parent must be a directory once the
 * arm's staging has run — one the workspace declaration stages, or one the
 * staging's `build` and `review create` write (the graph-data area, the
 * session directory holding `s`, an emit directory), else a diagnosed
 * failure (SPEC 13.3, 10.1, 13.2) — its occupant, product-written or none,
 * is removed with all it holds, and the FIFO is made by `stageFifo`
 * (helpers/lock-staging.ts: `mkfifo`, never opened by the harness, verified
 * on the harness itself as a FIFO in place, E-1). Returns the record
 * `assertFifosIntact` takes.
 */
async function replaceWithFifo(
  workspace: TestWorkspace,
  rel: string,
  context: string,
): Promise<StagedLeftover> {
  const parent = path.posix.dirname(rel);
  if (parent !== ".") {
    const held = await workspace.kind(parent);
    if (held !== "dir") {
      fail(
        `${context}: staging premise — once the arm's staging has run ` +
          `(\`build\`, then \`review create --strategy audit --name s\`), ` +
          `${parent}, the FIFO's parent, is a directory: one the workspace ` +
          `declaration stages, or the graph-data area, the session ` +
          `directory holding \`s\`, or an emit directory the staging wrote ` +
          `(SPEC 13.3, 10.1, 13.2); found ${held}`,
      );
    }
  }
  await fsp.rm(workspace.path(rel), { recursive: true, force: true });
  return await stageFifo(workspace, rel);
}

/**
 * One invocation of a FIFO arm (TEST-SPEC T13.4-13) — every one but a
 * `build` that succeeds (`buildSucceeds`): `argv`, its `--json` included,
 * run bounded — a product opening the FIFO with no writer blocks until its
 * own guard ends it, a diagnosed failure (`runBounded`; S-3, H-8) — inside
 * a whole-root compare: nothing modified (H-6 leaving out the lock path
 * alone, where a mutating command acquired it); `judge` asserts the
 * answer, given the run's context (the arm's `context` and the argv), then
 * the FIFO `staged` names is still a FIFO in place (`assertFifosIntact`:
 * with termination, all "no FIFO opened" asserts, S-3) — `staged`
 * `undefined` once a `build` of (e) or (h) has replaced or removed it.
 */
async function fifoRun(
  product: ProductBinding,
  workspace: TestWorkspace,
  staged: StagedLeftover | undefined,
  argv: readonly string[],
  context: string,
  judge: (result: RunResult, runContext: string) => void,
): Promise<void> {
  const runContext = `${context}: \`${argv.join(" ")}\``;
  await assertLeavesUnchanged(
    workspace.root,
    async () => {
      const result = await runBounded(
        product,
        workspace.root,
        argv,
        runContext,
      );
      judge(result, runContext);
      if (staged !== undefined) {
        await assertFifosIntact(
          staged,
          `${runContext}: no FIFO opened — the FIFO still a FIFO in place ` +
            `afterward (TEST-SPEC T13.4-13, S-3; SPEC 13.4, 7)`,
        );
      }
    },
    `${runContext}: nothing modified — no invocation but a \`build\` that ` +
      `succeeds modifies anything, and this is none (TEST-SPEC T13.4-13; ` +
      `SPEC 12.0, 13.4)`,
  );
}

/**
 * `build --json` that succeeds (TEST-SPEC T13.4-13(e), (h), and (e)'s
 * twin): bounded — a product opening the FIFO with no writer blocks until
 * its own guard ends it, a diagnosed failure (`runBounded`; S-3, H-8) —
 * exit 0 with the finding-free report, `rule` naming why (SPEC 12.1, 12.7,
 * 12.0). No compare brackets it: a `build` that succeeds is the one
 * invocation of these arms that modifies — it writes derived files and
 * graph data, replacing or removing the FIFO — whose fate the caller judges.
 */
async function buildSucceeds(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
  rule: string,
): Promise<void> {
  const argv = ["build", "--json"];
  const runContext = `${context}: \`${argv.join(" ")}\``;
  const result = await runBounded(product, workspace.root, argv, runContext);
  assertExitCode(result, 0, `${runContext}: ${rule}`);
  assertSameJson(
    decodeFindingsReport(parseJsonStdout(result, runContext), runContext)
      .findings,
    [],
    `${runContext}: a \`build\` that succeeds reports exactly ` +
      `{"findings": []} — any finding would exit 1 (SPEC 12.7, 12.0)`,
  );
}

/**
 * What occupies `rel` is `expected` (`TestWorkspace.kind`: never following
 * a link, never opening a FIFO), else a diagnosed failure naming what is
 * there instead, `why` saying what the arm expects and why.
 */
async function assertKindAt(
  workspace: TestWorkspace,
  rel: string,
  expected: EntryKind,
  context: string,
  why: string,
): Promise<void> {
  const held = await workspace.kind(rel);
  if (held === expected) return;
  fail(`${context}: ${why}; found ${held} at ${rel}`);
}

/**
 * The FIFO-free twin (module header): the arm staging alone, then
 * `rename specs/A.mdx a a2 --json`, bounded, exit 0 — the premise that the
 * `rename` (a), (b), and (i) run is an operation succeeding there.
 */
async function fifoFreeTwin(product: ProductBinding): Promise<void> {
  await withWorkspace(FIFO_ARM_DECL, async (workspace) => {
    const context = "T13.4-13 the FIFO-free twin";
    await stageFifoArm(product, workspace, context);
    const argv = [...FIFO_ARM_RENAME, "--json"];
    await runOk(
      product,
      workspace,
      argv,
      `${context} \`${argv.join(" ")}\``,
      "staging premise — the `rename` (a), (b), and (i) run is an " +
        "operation succeeding on a FIFO-free twin (SPEC 6.4)",
    );
  });
}

// --- (a) The configuration path ---------------------------------------------

/** One of (a)'s two stagings (module header). */
interface ConfigurationFifo {
  readonly what: string;
  /** The FIFO's path: the root's configuration, or the path `--config` names. */
  readonly at: string;
  /** `--config <path>` where the staging names its path, else nothing. */
  readonly configArgs: readonly string[];
}

/** (a)'s stagings (module header), each on a workspace of its own. */
const CONFIGURATION_FIFOS: readonly ConfigurationFifo[] = [
  {
    what: "the root's `xspec.config.ts` a FIFO",
    at: ROOT_CONFIG,
    configArgs: [],
  },
  {
    what:
      "`alt.config.ts` a FIFO beside the valid root configuration, named by " +
      "`--config alt.config.ts`",
    at: ALT_CONFIG,
    configArgs: ["--config", ALT_CONFIG],
  },
];

/**
 * (a)'s configuration-loading commands, as TEST-SPEC T13.4-13(a) names
 * them (SPEC 14.14: every command but `version` loads the configuration),
 * the `rename` an operation succeeding on the FIFO-free twin.
 */
const CONFIGURATION_LOADING: readonly (readonly string[])[] = [
  ["build"],
  ["check"],
  ["ids"],
  ["view"],
  ["inventory"],
  FIFO_ARM_RENAME,
];

/**
 * One of (a)'s stagings (module header): each configuration-loading command
 * exits 2 with the error document — `code` `"configuration-error"`, `path`
 * the FIFO's path as found or named, `locations` [] — and `version` exits 0
 * with its document, each under `fifoRun`.
 */
async function configurationArm(
  product: ProductBinding,
  staging: ConfigurationFifo,
): Promise<void> {
  await withWorkspace(FIFO_ARM_DECL, async (workspace) => {
    const context = `T13.4-13 (a) ${staging.what}`;
    await stageFifoArm(product, workspace, context);
    const staged = await replaceWithFifo(workspace, staging.at, context);
    for (const command of CONFIGURATION_LOADING) {
      const argv = [...command, ...staging.configArgs, "--json"];
      await fifoRun(
        product,
        workspace,
        staged,
        argv,
        context,
        (result, runContext) => {
          assertExitCode(
            result,
            2,
            `${runContext}: the configuration path found or named holds a ` +
              `FIFO — any occupant but a plain file is missing or invalid ` +
              `configuration, never read through — reported at configuration ` +
              `load as a usage error, exit 2 (SPEC 7, 14.14, 12.0)`,
          );
          const error = expectErrorDocument(result, runContext);
          assertSameJson(
            { code: error.code, path: error.path, locations: error.locations },
            {
              code: CONFIGURATION_ERROR_CODE,
              path: staging.at,
              locations: [],
            },
            `${runContext}: the error document carries condition 14 — the ` +
              `stable code "${CONFIGURATION_ERROR_CODE}", the concerned path ` +
              `the FIFO's as found or named (${JSON.stringify(staging.at)}), ` +
              `and no locations, the occupant never read (SPEC 14, 12.7, 7; ` +
              `T12.7-3, T7-1) — message: ${JSON.stringify(error.message)}`,
          );
        },
      );
    }
    const versionArgv = ["version", ...staging.configArgs, "--json"];
    await fifoRun(
      product,
      workspace,
      staged,
      versionArgv,
      context,
      (result, runContext) => {
        assertExitCode(
          result,
          0,
          `${runContext}: \`version\` loads no configuration, so the FIFO ` +
            `is never met: exit 0 with its answer (SPEC 12.6, 14.14)`,
        );
        decodeVersionDocument(parseJsonStdout(result, runContext), runContext);
      },
    );
  });
}

// --- (b) The journal path ----------------------------------------------------

/**
 * A findings-only report holding exactly one finding, the journal error
 * form-exact — `code` `"journal-error"`, `path` `".xspec/journal"`,
 * `locations` `[]` (T6.1-3's assertion) — exit 1: the FIFO at the journal
 * path is a journal error (SPEC 13.4, 14.13), the workspace's one defect.
 */
function judgeJournalErrorAlone(
  result: RunResult,
  context: string,
  why: string,
): void {
  assertExitCode(result, 1, `${context}: ${why}`);
  const { findings } = decodeFindingsReport(
    parseJsonStdout(result, context),
    context,
  );
  assertConditionCounts(
    findings,
    { "14.13": 1 },
    `${context} — exactly the journal error, the workspace's one defect ` +
      `(SPEC 14, 14.13)`,
  );
  const finding = findings[0]!;
  assertSameJson(
    { code: finding.code, path: finding.path, locations: finding.locations },
    { code: JOURNAL_ERROR_CODE, path: JOURNAL, locations: [] },
    `${context} — the journal error's finding, form-exact: code ` +
      `"${JOURNAL_ERROR_CODE}", the journal path ${JOURNAL} as its ` +
      `concerned path, and empty locations (SPEC 12.7, 14, 14.13; T6.1-3) — ` +
      `message: ${JSON.stringify(finding.message)}`,
  );
}

/** One of (b)'s answering surfaces: its arguments and its decoder. */
interface AnsweringSurface {
  readonly argv: readonly string[];
  /** Decode the answer form-exactly, returning its findings (12.7). */
  readonly findings: (doc: unknown, context: string) => readonly Finding[];
}

/**
 * (b)'s surfaces of 11.2 (module header), which (f) runs as well:
 * `occurrences`, and `view` and `at … 0` of the discovered spec source
 * `specs/A.mdx`.
 */
const ANSWERING_SURFACES: readonly AnsweringSurface[] = [
  {
    argv: ["occurrences", "--json"],
    findings: (doc, context) => decodeOccurrencesReport(doc, context).findings,
  },
  {
    argv: ["view", "specs/A.mdx", "--json"],
    findings: (doc, context) =>
      decodeViewReport(doc, { text: false }, context).findings,
  },
  {
    argv: ["at", "specs/A.mdx", "0", "--json"],
    findings: (doc, context) => decodeAtReport(doc, context).findings,
  },
];

/**
 * A gate condition that is a finding of no domain file (SPEC 11.2): the
 * read the surfaces' judgement makes for it, its condition as named in a
 * diagnosis, and its SPEC 14 subsection.
 */
interface GateConditionBeside {
  readonly read: string;
  readonly condition: string;
  readonly cite: string;
}

/** (b)'s: the journal's condition 13 (SPEC 14.13). */
const JOURNAL_GATE: GateConditionBeside = {
  read: "the journal's",
  condition: "the journal's condition",
  cite: "14.13",
};

/** (f)'s: a write path's condition 22 (SPEC 14.22). */
const WRITE_PATH_GATE: GateConditionBeside = {
  read: "the kinds of `build`'s write-path directory components",
  condition: "the write path's condition 22",
  cite: "14.22",
};

/**
 * One of the surfaces of 11.2 (`ANSWERING_SURFACES`) answering beside
 * `gate`: finding-free, exit 0 — their judgement of `build`'s validations
 * makes every read the gate makes, `gate`'s included, and that condition
 * accompanies no answer (SPEC 11.2; TEST-SPEC T13.4-13(b), (f)).
 */
function judgeSurfaceFindingFree(
  surface: AnsweringSurface,
  result: RunResult,
  runContext: string,
  gate: GateConditionBeside,
): void {
  assertExitCode(
    result,
    0,
    `${runContext}: the surfaces of 11.2 answer, their judgement of ` +
      `\`build\`'s validations making every read the gate makes, ` +
      `${gate.read} included, whose condition accompanies no answer: ` +
      `finding-free, exit 0 (SPEC 11.2, 11.3, 11.4, 11.5)`,
  );
  assertSameJson(
    surface.findings(parseJsonStdout(result, runContext), runContext),
    [],
    `${runContext}: finding-free — ${gate.condition} accompanies no answer ` +
      `(SPEC 11.2, ${gate.cite})`,
  );
}

/**
 * (b) (module header): `.xspec/journal` a FIFO — `build`, `check`, and
 * `ids` each the journal error alone, exit 1, and the `rename` refused with
 * it alone; `inventory`'s `journal` exactly occupied, finding-free, exit 0;
 * the surfaces of 11.2 finding-free, exit 0 — each under `fifoRun`.
 */
async function journalArm(product: ProductBinding): Promise<void> {
  await withWorkspace(FIFO_ARM_DECL, async (workspace) => {
    const context = "T13.4-13 (b) `.xspec/journal` a FIFO";
    await stageFifoArm(product, workspace, context);
    const staged = await replaceWithFifo(workspace, JOURNAL, context);
    const run = async (
      argv: readonly string[],
      judge: (result: RunResult, runContext: string) => void,
    ): Promise<void> => {
      await fifoRun(product, workspace, staged, argv, context, judge);
    };
    for (const argv of [
      ["build", "--json"],
      ["check", "--json"],
      ["ids", "--json"],
    ]) {
      await run(argv, (result, runContext) => {
        judgeJournalErrorAlone(
          result,
          runContext,
          "a journal path occupied by anything other than a plain file is a " +
            "journal error — a finding at `build`, at `check`, and at the " +
            "gate of `ids`, which answers nothing: exit 1, the findings-only " +
            "report (SPEC 13.4, 14.13, 13.3, 12.7)",
        );
      });
    }
    await run([...FIFO_ARM_RENAME, "--json"], (result, runContext) => {
      judgeJournalErrorAlone(
        result,
        runContext,
        "the workspace fails `build`'s validations, so the `rename` — an " +
          "operation succeeding on the FIFO-free twin — is refused before " +
          "modifying anything, reporting the workspace's findings alone, " +
          "exit 1 (SPEC 6.4, 14)",
      );
    });
    await run(INVENTORY, (result, runContext) => {
      assertExitCode(
        result,
        0,
        `${runContext}: \`inventory\` answers whatever the sources' ` +
          `validity, finding-free, exit 0 (SPEC 11.6)`,
      );
      const inventory = decodeInventoryDocument(
        parseJsonStdout(result, runContext),
        runContext,
      );
      assertSameJson(
        inventory.findings,
        [],
        `${runContext}: finding-free — the inventory reports occupancy by ` +
          `presence alone, reading no journal content, so no condition 13 ` +
          `(SPEC 11.6, 14.13)`,
      );
      assertSameJson(
        inventory.journal,
        { path: JOURNAL, occupied: true },
        `${runContext}: the journal member is exactly {"path": ` +
          `"${JOURNAL}", "occupied": true} — a FIFO occupies the journal ` +
          `path (SPEC 11.6, 12.7, 13.4)`,
      );
    });
    for (const surface of ANSWERING_SURFACES) {
      await run(surface.argv, (result, runContext) => {
        judgeSurfaceFindingFree(surface, result, runContext, JOURNAL_GATE);
      });
    }
  });
}

// --- (c) A session file -------------------------------------------------------

/**
 * A report's findings holding `s`'s corruption (T10.1-4's rule): at least
 * one finding, and every one condition 21 — the stable code
 * `"corrupt-session"` — concerning `.xspec/reviews/s.json` with `locations`
 * `[]` (SPEC 14, 14.21, 12.7, 10.1).
 */
function assertSessionSCorrupt(
  findings: readonly Finding[],
  context: string,
): void {
  if (findings.length === 0) {
    fail(
      `${context}: \`s\` is reported corrupt — a session file that is not a ` +
        `plain file is corrupt (SPEC 13.4, 10.1, 14.21); got no finding`,
    );
  }
  for (const finding of findings) {
    assertSameJson(
      { code: finding.code, path: finding.path, locations: finding.locations },
      { code: CORRUPT_SESSION_CODE, path: SESSION_S_FILE, locations: [] },
      `${context}: every finding is \`s\`'s corruption — condition 21, the ` +
        `stable code "${CORRUPT_SESSION_CODE}", concerning ` +
        `${SESSION_S_FILE}, no in-source location — never a read failure ` +
        `in its place, the occupant never read (SPEC 14, 14.21, 12.7, ` +
        `13.4, 14.25) — message: ${JSON.stringify(finding.message)}`,
    );
  }
}

/**
 * (c) (module header): `.xspec/reviews/s.json` a FIFO — `check`, `review
 * status s`, and `review list` each report `s` corrupt, exit 1; `inventory`
 * lists `.xspec/reviews/s.json`, finding-free, exit 0 — each under
 * `fifoRun`.
 */
async function sessionFileArm(product: ProductBinding): Promise<void> {
  await withWorkspace(FIFO_ARM_DECL, async (workspace) => {
    const context = "T13.4-13 (c) `.xspec/reviews/s.json` a FIFO";
    await stageFifoArm(product, workspace, context);
    const staged = await replaceWithFifo(workspace, SESSION_S_FILE, context);
    const run = async (
      argv: readonly string[],
      judge: (result: RunResult, runContext: string) => void,
    ): Promise<void> => {
      await fifoRun(product, workspace, staged, argv, context, judge);
    };
    for (const argv of [CHECK, REVIEW_STATUS_S]) {
      await run(argv, (result, runContext) => {
        assertExitCode(
          result,
          1,
          `${runContext}: \`s\`'s file is a FIFO, so \`s\` is corrupt — ` +
            `reported by \`check\` and by a \`review\` subcommand naming it, ` +
            `exit 1 (SPEC 13.4, 10.1, 14.21, 12.0)`,
        );
        assertSessionSCorrupt(
          decodeFindingsReport(parseJsonStdout(result, runContext), runContext)
            .findings,
          runContext,
        );
      });
    }
    await run(["review", "list", "--json"], (result, runContext) => {
      assertExitCode(
        result,
        1,
        `${runContext}: \`list\` exits 1 when a corrupt session exists ` +
          `(SPEC 10.7, 14.21)`,
      );
      const list = decodeSessionListReport(
        parseJsonStdout(result, runContext),
        runContext,
      );
      assertSameJson(
        list.sessions.map(({ name, corrupt }) => ({ name, corrupt })),
        [{ name: "s", corrupt: true }],
        `${runContext}: \`s\` is listed corrupt in place of its fields (SPEC ` +
          `10.1, 10.7, 14.21)`,
      );
      if (list.findings === undefined) {
        fail(
          `${runContext}: the listing carries \`s\`'s condition 21 under its ` +
            `"findings" member (SPEC 14.21, 12.7); the decoded document ` +
            `carries no such member`,
        );
      }
      assertSessionSCorrupt(list.findings, `${runContext} — its findings`);
    });
    await run(INVENTORY, (result, runContext) => {
      assertExitCode(
        result,
        0,
        `${runContext}: \`inventory\` selects sessions by name alone, ` +
          `reading none: finding-free, exit 0 (SPEC 11.6)`,
      );
      const inventory = decodeInventoryDocument(
        parseJsonStdout(result, runContext),
        runContext,
      );
      assertSameJson(
        inventory.findings,
        [],
        `${runContext}: finding-free — no condition 21 from the inventory, ` +
          `which reads no session (SPEC 11.6, 14.21)`,
      );
      assertSameJson(
        inventory.sessions,
        [SESSION_S_FILE],
        `${runContext}: the session file listed by name alone, whatever ` +
          `occupies it (SPEC 11.6, 10.1)`,
      );
    });
  });
}

// --- (d) The session directory and the area's own path -----------------------

/**
 * (d)'s session-directory staging (module header): `.xspec/reviews` — the
 * directory holding `s.json` — a FIFO, then T10.1-6's plain-file sweep for
 * that path (`assertSessionDirectoryOccupied`) under `promptly`, then the
 * FIFO still in place.
 */
async function sessionDirectoryArm(product: ProductBinding): Promise<void> {
  await withWorkspace(FIFO_ARM_DECL, async (workspace) => {
    const label = "T13.4-13 (d) [.xspec/reviews: a FIFO]";
    await stageFifoArm(product, workspace, label);
    const staged = await replaceWithFifo(workspace, SESSION_DIRECTORY, label);
    await promptly(label, async () => {
      await assertSessionDirectoryOccupied(product, workspace, label);
    });
    await assertFifosIntact(
      staged,
      `${label}: no FIFO opened — the FIFO at ${SESSION_DIRECTORY} still a ` +
        `FIFO in place once T10.1-6's plain-file sweep has run (TEST-SPEC ` +
        `T13.4-13, S-3; SPEC 13.4, 10.1)`,
    );
  });
}

/**
 * (d)'s area staging (module header): T10.1-6's `.xspec` plain-file
 * staging up to its occupant (`stageT1016AreaWorkspace`: a git repository
 * holding `c1`, built, holding `s`, its items read), `.xspec` then a FIFO
 * in the plain file's place (section-13.5-ii.ts `obstructArea`), then
 * T10.1-6's sweeps for that path (`assertAreaOccupied`,
 * `assertMutatingCommandsFailAtAcquisition`) under `promptly`, then the
 * FIFO still in place.
 */
async function areaArm(product: ProductBinding): Promise<void> {
  await withWorkspace(FIFO_ARM_DECL, async (workspace) => {
    const label = "T13.4-13 (d) [.xspec: a FIFO]";
    const staging = await stageT1016AreaWorkspace(product, workspace, label);
    const staged = await obstructArea(workspace, { kind: "fifo" }, label);
    await promptly(label, async () => {
      await assertAreaOccupied(product, workspace, staging.c1, label);
      await assertMutatingCommandsFailAtAcquisition(
        product,
        workspace,
        staging.items,
        label,
      );
    });
    await assertFifosIntact(
      staged,
      `${label}: no FIFO opened — the FIFO at .xspec still a FIFO in place ` +
        `once T10.1-6's plain-file sweeps have run (TEST-SPEC T13.4-13, ` +
        `S-3; SPEC 13.4, 13.5)`,
    );
  });
}

// --- (e) A derived file's path ------------------------------------------------

/**
 * `specs/A.mdx`'s generated module (SPEC 13.1: `NAME.mdx` generates
 * `NAME.xspec.ts` in the source file's directory).
 */
const A_MODULE = "specs/A.xspec.ts";
/** Condition 10's stable code (SPEC 14, 14.10, 12.7). */
const STALE_OUTPUT_CODE = "stale-output";

/**
 * A condition-10 finding concerning the derived path `rel`, form-exact —
 * `code` `"stale-output"`, `path` `rel`, `locations` `[]` (a path-level
 * condition, located in no source: SPEC 14, 12.7) — instructing rebuilding
 * (support.ts `assertFindingInstructsRebuilding`: SPEC 14.10's correction
 * wherever no recorded file obstructs a path the rebuild writes, as none
 * does in (e) or (h)).
 */
function assertStaleOutputAt(
  finding: Finding,
  rel: string,
  context: string,
): void {
  assertSameJson(
    { code: finding.code, path: finding.path, locations: finding.locations },
    { code: STALE_OUTPUT_CODE, path: rel, locations: [] },
    `${context} — condition 10's finding, form-exact: code ` +
      `"${STALE_OUTPUT_CODE}", the derived path ${rel} as its concerned ` +
      `path, and empty locations (SPEC 14.10, 14, 12.7) — message: ` +
      `${JSON.stringify(finding.message)}`,
  );
  assertFindingInstructsRebuilding(
    finding,
    `${context} — the finding concerning ${rel} (SPEC 14.10)`,
  );
}

/**
 * (e)'s FIFO-free twin (module header): the arm staging alone, on a
 * workspace of its own, then `build --json`, exit 0 finding-free; returns
 * the module it generates at `specs/A.xspec.ts` — a plain file, else a
 * diagnosed failure (SPEC 13.1) — which the arm's `build` must reproduce in
 * the FIFO's place (SPEC 13.4, 12.0: derived files are reproducible and
 * byte-deterministic).
 */
async function derivedFileTwinModule(
  product: ProductBinding,
): Promise<Uint8Array> {
  return await withWorkspace(FIFO_ARM_DECL, async (workspace) => {
    const context = "T13.4-13 (e) the FIFO-free twin";
    await stageFifoArm(product, workspace, context);
    await buildSucceeds(
      product,
      workspace,
      context,
      "`build` succeeds on a valid workspace (SPEC 12.1)",
    );
    await assertKindAt(
      workspace,
      A_MODULE,
      "file",
      context,
      `\`build\` generates specs/A.mdx's module at ${A_MODULE} as a plain ` +
        `file (SPEC 13.1, 13.4: every file xspec writes is a plain file)`,
    );
    return await workspace.readBytes(A_MODULE);
  });
}

/**
 * (e) (module header): the generated module `specs/A.xspec.ts` a FIFO —
 * `check` exactly the per-file condition-10 finding concerning it, exit 1;
 * `build` exits 0, the FIFO replaced by a plain file byte-equal to the
 * FIFO-free twin's module; `check` then clean.
 */
async function derivedFileArm(product: ProductBinding): Promise<void> {
  const twinModule = await derivedFileTwinModule(product);
  await withWorkspace(FIFO_ARM_DECL, async (workspace) => {
    const context =
      "T13.4-13 (e) the generated module `specs/A.xspec.ts` a FIFO";
    await stageFifoArm(product, workspace, context);
    await assertKindAt(
      workspace,
      A_MODULE,
      "file",
      context,
      `staging premise — the staging's \`build\` generates specs/A.mdx's ` +
        `module at ${A_MODULE} as a plain file (SPEC 13.1, 12.1)`,
    );
    const staged = await replaceWithFifo(workspace, A_MODULE, context);
    await fifoRun(product, workspace, staged, CHECK, context, (result, rc) => {
      assertExitCode(
        result,
        1,
        `${rc}: a derived file's path holding a FIFO — any non-plain-file ` +
          `occupant — is stale, judged by the occupant itself, never ` +
          `opened: a finding, exit 1 (SPEC 14.10, 13.4, 12.2)`,
      );
      const { findings } = decodeFindingsReport(
        parseJsonStdout(result, rc),
        rc,
      );
      assertConditionCounts(
        findings,
        { "14.10": 1 },
        `${rc} — exactly one finding, the module's condition 10 in the ` +
          `per-file form: the workspace is otherwise valid and freshly ` +
          `built, its graph data unchanged (SPEC 14.10, 13.3)`,
      );
      assertStaleOutputAt(findings[0]!, A_MODULE, rc);
    });
    await buildSucceeds(
      product,
      workspace,
      context,
      "writing a derived file replaces whatever exists at its path — a " +
        "FIFO included, never opened — so `build` succeeds, no 14.22 (exit " +
        "1) and no 14.24 or 14.25 (exit 2) (SPEC 13.4, 12.1, 12.0)",
    );
    await assertKindAt(
      workspace,
      A_MODULE,
      "file",
      `${context}, once \`build\` has run`,
      `the write replaced the FIFO with the generated plain file (SPEC ` +
        `13.4: writing a derived file replaces whatever exists at its path; ` +
        `every file xspec writes is a plain file)`,
    );
    assertBytesEqual(
      await workspace.readBytes(A_MODULE),
      twinModule,
      `${context}, once \`build\` has run: ${A_MODULE} holds exactly the ` +
        `module the FIFO-free twin's \`build\` generates (SPEC 13.4, 12.0: ` +
        `derived files are reproducible, byte-deterministic)`,
    );
    await fifoRun(
      product,
      workspace,
      undefined,
      CHECK,
      `${context}, once \`build\` has run`,
      (result, rc) => {
        assertExitCode(
          result,
          0,
          `${rc}: the module regenerated, nothing is stale (SPEC 14.10, ` +
            `12.2)`,
        );
        assertCleanCheckReport(result, rc);
      },
    );
  });
}

// --- (f) A write path's directory component ----------------------------------

/**
 * (f)'s configuration, and (g)'s for its last staging: T10.1-6's one spec
 * group with Markdown emitted under `outDir: "out"` (SPEC 7.3, 13.2). Every
 * workspace staging it is created after the body's first product
 * invocation (the FIFO-free twin's), so it is a TypeScript staged-source
 * record (helpers/staged-ts.ts; S-9's TypeScript and timing clauses).
 */
const FIFO_EMIT_OUT_CONFIG = stagedTs(
  "T13.4-13 (f)/(g) xspec.config.ts — one spec group, Markdown emission under outDir out",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  markdown: { emit: true, outDir: "out" }
})
`,
);

/** (f)'s workspace: T10.1-6's under FIFO_EMIT_OUT_CONFIG. */
const FIFO_EMIT_OUT_DECL: WorkspaceDecl = {
  files: { ...T10_1_CORE_FILES, "xspec.config.ts": FIFO_EMIT_OUT_CONFIG },
};

/** The emit directory `outDir` names (SPEC 7.3). */
const OUT_DIR = "out";
/** `specs/A.mdx`'s emit destination under FIFO_EMIT_OUT_CONFIG (SPEC 13.2). */
const OUT_A_MARKDOWN = "out/specs/A.md";
/** Condition 22's stable code (SPEC 14, 14.22, 12.7). */
const OBSTRUCTED_WRITE_PATH_CODE = "obstructed-write-path";

/**
 * A findings-only report holding exactly one finding, condition 22
 * form-exact — `code` `"obstructed-write-path"`, `path` `"out"`,
 * `locations` `[]` (T13.4-6's assertion) — exit 1: `out`, a directory
 * component of every emit destination, holds a FIFO, the workspace's one
 * defect (SPEC 14.22; on a workspace failing `build`'s validations 14.10's
 * mismatch forms go unreported, and the record lists no path the current
 * sources no longer generate).
 */
function judgeOutObstructedAlone(
  result: RunResult,
  context: string,
  why: string,
): void {
  assertExitCode(result, 1, `${context}: ${why}`);
  const { findings } = decodeFindingsReport(
    parseJsonStdout(result, context),
    context,
  );
  assertConditionCounts(
    findings,
    { "14.22": 1 },
    `${context} — exactly the obstruction, the workspace's one defect: ` +
      `\`build\` cannot observe staleness, and on a workspace failing ` +
      `\`build\`'s validations \`check\` leaves 14.10's mismatch forms ` +
      `unreported, the record listing no path the sources no longer ` +
      `generate (SPEC 14, 14.22, 14.10, 12.1)`,
  );
  const finding = findings[0]!;
  assertSameJson(
    { code: finding.code, path: finding.path, locations: finding.locations },
    { code: OBSTRUCTED_WRITE_PATH_CODE, path: OUT_DIR, locations: [] },
    `${context} — condition 22's finding, form-exact: code ` +
      `"${OBSTRUCTED_WRITE_PATH_CODE}", the offending component ${OUT_DIR} ` +
      `as its concerned path, and empty locations (SPEC 14.22, 14, 12.7; ` +
      `T13.4-6) — message: ${JSON.stringify(finding.message)}`,
  );
}

/**
 * (f) (module header): under FIFO_EMIT_OUT_CONFIG, built, `out` with all it
 * holds replaced by a FIFO — `build` and `check` each exactly condition 22
 * concerning `out`, exit 1, modifying nothing; the surfaces of 11.2
 * finding-free, exit 0 — each under `fifoRun`.
 */
async function writePathComponentArm(product: ProductBinding): Promise<void> {
  await withWorkspace(FIFO_EMIT_OUT_DECL, async (workspace) => {
    const context =
      'T13.4-13 (f) under `outDir: "out"`, `out` with all it holds a FIFO';
    await stageFifoArm(product, workspace, context);
    await assertKindAt(
      workspace,
      OUT_A_MARKDOWN,
      "file",
      context,
      `staging premise — the staging's \`build\` emits specs/A.mdx's ` +
        `Markdown at ${OUT_A_MARKDOWN} as a plain file, so ${OUT_DIR} is a ` +
        `directory holding it (SPEC 13.2, 7.3, 13.4)`,
    );
    const staged = await replaceWithFifo(workspace, OUT_DIR, context);
    const run = async (
      argv: readonly string[],
      judge: (result: RunResult, runContext: string) => void,
    ): Promise<void> => {
      await fifoRun(product, workspace, staged, argv, context, judge);
    };
    await run(["build", "--json"], (result, rc) => {
      judgeOutObstructedAlone(
        result,
        rc,
        "a directory component of a write path occupied by anything but a " +
          "directory — a FIFO included — refuses the write: `build` reports " +
          "condition 22 before any write of its own, exit 1 (SPEC 14.22, " +
          "13.4, 12.1)",
      );
    });
    await run(CHECK, (result, rc) => {
      judgeOutObstructedAlone(
        result,
        rc,
        "`check` reports the obstructed write path without writing, exit 1 " +
          "(SPEC 14.22, 12.2)",
      );
    });
    for (const surface of ANSWERING_SURFACES) {
      await run(surface.argv, (result, rc) => {
        judgeSurfaceFindingFree(surface, result, rc, WRITE_PATH_GATE);
      });
    }
  });
}

// --- (g) A move's destination and its components ------------------------------

/**
 * (g)'s `specs/A.mdx`: T10.1-6's `a` with its child `a.k`, then the
 * top-level section `x` the section-form move names. Staged in workspaces
 * created after the body's first product invocation, so a staged-source
 * record (helpers/staged-mdx.ts; S-9's before-any-product clause).
 */
const FIFO_MOVE_A_MDX = stagedMdx(
  "T13.4-13 (g) specs/A.mdx — a with its child a.k, then the section x",
  [
    '<S id="a">',
    "Alpha text.",
    '<S id="a.k">',
    "Kid text.",
    "</S>",
    "</S>",
    '<S id="x">',
    "Ex text.",
    "</S>",
    "",
  ].join("\n"),
);

/** One refusal reason a (g) move reports: its stable code and concerned path. */
interface MoveRefusalReason {
  readonly code: string;
  readonly path: string;
}

/** One of (g)'s stagings: its workspace, its FIFO, and the moves it runs. */
interface MoveDestinationStaging {
  readonly what: string;
  readonly decl: WorkspaceDecl;
  /** The FIFO's workspace-relative path. */
  readonly fifo: string;
  /** What must occupy `premise.at` once the arm's staging has run, and why. */
  readonly premise?: { readonly at: string; readonly why: string };
  readonly moves: readonly {
    readonly argv: readonly string[];
    readonly reasons: readonly MoveRefusalReason[];
    readonly why: string;
  }[];
}

/** `refused-destination-exists` (SPEC 6.5, 14). */
const DESTINATION_EXISTS = "refused-destination-exists";
/** `refused-invalid-destination` (SPEC 6.5, 14). */
const INVALID_DESTINATION = "refused-invalid-destination";

/** (g)'s stagings (module header), each on a workspace of its own. */
const MOVE_DESTINATION_STAGINGS: readonly MoveDestinationStaging[] = [
  {
    what: "`other/B.mdx` a FIFO in no spec group",
    decl: {
      files: { ...T10_1_CORE_FILES, "specs/A.mdx": FIFO_MOVE_A_MDX },
      dirs: ["other"],
    },
    fifo: "other/B.mdx",
    moves: [
      {
        argv: ["move", "specs/A.mdx", "other/B.mdx", "--json"],
        reasons: [
          { code: DESTINATION_EXISTS, path: "other/B.mdx" },
          { code: INVALID_DESTINATION, path: "other/B.mdx" },
        ],
        why:
          "a file-form destination occupied by whatever kind of filesystem " +
          "object — a FIFO included — is refused-destination-exists, and a " +
          "destination in no spec group refused-invalid-destination, each " +
          "concerning the destination, every applicable reason reported " +
          "(SPEC 6.5, 14; T6.5-4's two-reason arm)",
      },
      {
        argv: ["move", "specs/A.mdx#x", "other/B.mdx#x", "--json"],
        reasons: [
          { code: DESTINATION_EXISTS, path: "other/B.mdx" },
          { code: INVALID_DESTINATION, path: "other/B.mdx" },
        ],
        why:
          "a section-form target path occupied by anything discovery does " +
          "not yield as a spec source — a FIFO included — is " +
          "refused-destination-exists, and a target in no spec group " +
          "refused-invalid-destination, each concerning the target path, " +
          "every applicable reason reported (SPEC 6.5, 14; T6.5-4's " +
          "two-reason arm)",
      },
    ],
  },
  {
    what: "`specs/sub` a FIFO",
    decl: { files: { ...T10_1_CORE_FILES, "specs/A.mdx": FIFO_MOVE_A_MDX } },
    fifo: "specs/sub",
    moves: [
      {
        argv: ["move", "specs/A.mdx", "specs/sub/B.mdx", "--json"],
        reasons: [{ code: INVALID_DESTINATION, path: "specs/sub/B.mdx" }],
        why:
          "a directory component of the destination path occupied by " +
          "anything other than a directory — a FIFO included — is " +
          "refused-invalid-destination, concerning the destination, never " +
          "14.22 (SPEC 6.5, 14, 13.4)",
      },
    ],
  },
  {
    what:
      'under `outDir: "out"`, `out/specs/new` a FIFO — a component of the ' +
      "destination's emit path",
    decl: {
      files: {
        ...T10_1_CORE_FILES,
        "xspec.config.ts": FIFO_EMIT_OUT_CONFIG,
        "specs/A.mdx": FIFO_MOVE_A_MDX,
      },
    },
    fifo: "out/specs/new",
    premise: {
      at: OUT_A_MARKDOWN,
      why:
        `staging premise — the staging's \`build\` emits specs/A.mdx's ` +
        `Markdown at ${OUT_A_MARKDOWN} as a plain file, so out/specs is a ` +
        `directory holding it (SPEC 13.2, 7.3, 13.4)`,
    },
    moves: [
      {
        argv: ["move", "specs/A.mdx", "specs/new/B.mdx", "--json"],
        reasons: [{ code: INVALID_DESTINATION, path: "specs/new/B.mdx" }],
        why:
          "a directory component of a derived path the destination would " +
          "generate — its emit path out/specs/new/B.md — occupied by " +
          "anything other than a directory, a FIFO included, is " +
          "refused-invalid-destination, concerning the destination, never " +
          "14.22 (SPEC 6.5, 14, 13.2, 7.3)",
      },
    ],
  },
];

/**
 * A refused move's answer (SPEC 6.5): exit 1, the form-exact findings-only
 * report holding exactly one finding per reason in `reasons` — its exact
 * stable code — and none beside, each concerning its path (SPEC 14, 12.7:
 * a refused operation reports refusal reasons alone; T6.5-4's assertion).
 */
function judgeMoveRefusal(
  result: RunResult,
  context: string,
  reasons: readonly MoveRefusalReason[],
  why: string,
): void {
  assertExitCode(
    result,
    1,
    `${context}: ${why} — a refusal is a validation failure, exit 1 (SPEC ` +
      `6.5, 12.0)`,
  );
  const { findings } = decodeFindingsReport(
    parseJsonStdout(result, context),
    context,
  );
  const counts: Record<string, number> = {};
  for (const reason of reasons) {
    counts[reason.code] = (counts[reason.code] ?? 0) + 1;
  }
  assertConditionCounts(
    findings,
    counts,
    `${context} — exactly one finding per applicable refusal reason, each ` +
      `with its exact stable code, and none beside: ${why}`,
  );
  for (const reason of reasons) {
    const finding = findings.find((candidate) => {
      return candidate.code === reason.code;
    })!;
    assertFindingConcernsPath(
      finding,
      reason.path,
      `${context}: the ${reason.code} refusal concerns ${reason.path} ` +
        `(SPEC 14: a reason concerning a path carries it as the finding's ` +
        `path)`,
    );
  }
}

/**
 * One of (g)'s stagings (module header): the arm staging, its premise where
 * it has one, the FIFO, then each move refused under `fifoRun`.
 */
async function moveDestinationArm(
  product: ProductBinding,
  staging: MoveDestinationStaging,
): Promise<void> {
  await withWorkspace(staging.decl, async (workspace) => {
    const context = `T13.4-13 (g) ${staging.what}`;
    await stageFifoArm(product, workspace, context);
    if (staging.premise !== undefined) {
      await assertKindAt(
        workspace,
        staging.premise.at,
        "file",
        context,
        staging.premise.why,
      );
    }
    const staged = await replaceWithFifo(workspace, staging.fifo, context);
    for (const move of staging.moves) {
      await fifoRun(
        product,
        workspace,
        staged,
        move.argv,
        context,
        (result, rc) => {
          judgeMoveRefusal(result, rc, move.reasons, move.why);
        },
      );
    }
  });
}

// --- (h) A recorded derived path no longer generated -------------------------

/**
 * (h)'s configuration as built: T10.1-6's one spec group with Markdown
 * emitted next to sources (SPEC 7.3, 13.2). Staged in a workspace created
 * after the body's first product invocation: a TypeScript staged-source
 * record (helpers/staged-ts.ts; S-9's TypeScript and timing clauses).
 */
const FIFO_EMIT_BESIDE_CONFIG = stagedTs(
  "T13.4-13 (h) xspec.config.ts — one spec group, Markdown emission next to sources (the build)",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  markdown: { emit: true }
})
`,
);

/**
 * (h)'s configuration once emission is disabled (`emit: false`, SPEC 7.3),
 * written over FIFO_EMIT_BESIDE_CONFIG after product invocations: a
 * TypeScript staged-source record (S-9).
 */
const FIFO_EMIT_DISABLED_CONFIG = stagedTs(
  "T13.4-13 (h) xspec.config.ts — one spec group, emission disabled by emit false",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  markdown: { emit: false }
})
`,
);

/** (h)'s workspace: T10.1-6's under FIFO_EMIT_BESIDE_CONFIG. */
const FIFO_EMIT_BESIDE_DECL: WorkspaceDecl = {
  files: { ...T10_1_CORE_FILES, "xspec.config.ts": FIFO_EMIT_BESIDE_CONFIG },
};

/** `specs/A.mdx`'s emit destination next to it (SPEC 13.2, 7.3). */
const A_MARKDOWN = "specs/A.md";
/**
 * The graph-data area (SPEC 11.6, 13.3): the concerned path of 14.10's
 * unit form, which (h)'s first `check` may report beside the recorded-file
 * finding, unasserted (TEST-SPEC T13.4-11(a)).
 */
const GRAPH_DATA_AREA = ".xspec";

/**
 * (h)'s first `check`: exit 1; exactly one condition-10 finding concerning
 * `specs/A.md` — the recorded-file form, form-exact, instructing
 * rebuilding — and no other finding but, tolerated unasserted, one
 * condition-10 finding in the graph-data unit form, concerning the area
 * (TEST-SPEC T13.4-13(h), T13.4-11(a): whether disabling emission leaves
 * graph data stale is unpinned, SPEC 13.3, 14.10).
 */
function judgeRecordedFifoCheck(result: RunResult, context: string): void {
  assertExitCode(
    result,
    1,
    `${context}: the recorded derived path ${A_MARKDOWN}, no longer ` +
      `generated, holds a FIFO — anything but a directory or a discovered ` +
      `source, so 13.4's removal would remove it, and the recorded-file ` +
      `form reports it: a finding, exit 1 (SPEC 13.4, 14.10, 12.2)`,
  );
  const { findings } = decodeFindingsReport(
    parseJsonStdout(result, context),
    context,
  );
  const recorded = findings.filter((finding) => {
    return finding.condition === "14.10" && finding.path === A_MARKDOWN;
  });
  const unitForm = findings.filter((finding) => {
    return finding.condition === "14.10" && finding.path === GRAPH_DATA_AREA;
  });
  const others = findings.filter((finding) => {
    return !recorded.includes(finding) && !unitForm.includes(finding);
  });
  if (recorded.length !== 1 || unitForm.length > 1 || others.length > 0) {
    fail(
      `${context}: exactly one condition-10 finding concerning ` +
        `${A_MARKDOWN} — the recorded-file form — and no other finding ` +
        `but, unasserted, one in the graph-data unit form concerning ` +
        `${GRAPH_DATA_AREA} (SPEC 14.10: one finding per such path, the unit ` +
        `form one finding either way; 13.4; TEST-SPEC T13.4-11(a)); got ` +
        JSON.stringify(
          findings.map((finding) => ({
            code: finding.code,
            path: finding.path,
            message: finding.message,
          })),
        ),
    );
  }
  assertStaleOutputAt(recorded[0]!, A_MARKDOWN, context);
}

/**
 * (h) (module header): built with emission next to sources, `specs/A.md`
 * replaced by a FIFO, then emission disabled — `check` the recorded-file
 * finding concerning it and nothing else but the unit form, unasserted;
 * `build` exits 0, the FIFO removed; `check` then clean.
 */
async function recordedPathArm(product: ProductBinding): Promise<void> {
  await withWorkspace(FIFO_EMIT_BESIDE_DECL, async (workspace) => {
    const context =
      "T13.4-13 (h) the recorded `specs/A.md` a FIFO, emission then disabled";
    await stageFifoArm(product, workspace, context);
    await assertKindAt(
      workspace,
      A_MARKDOWN,
      "file",
      context,
      `staging premise — the staging's \`build\` emits specs/A.mdx's ` +
        `Markdown next to it, at ${A_MARKDOWN}, as a plain file, recording ` +
        `it (SPEC 13.2, 7.3, 13.3)`,
    );
    const staged = await replaceWithFifo(workspace, A_MARKDOWN, context);
    await workspace.file("xspec.config.ts", FIFO_EMIT_DISABLED_CONFIG);
    await fifoRun(product, workspace, staged, CHECK, context, (result, rc) => {
      judgeRecordedFifoCheck(result, rc);
    });
    await buildSucceeds(
      product,
      workspace,
      context,
      "removing a recorded derived file no longer generated removes its " +
        "path's occupant when that is anything but a directory or a " +
        "discovered source — a FIFO included, never opened — so `build` " +
        "succeeds, no 14.24 or 14.25 (exit 2) (SPEC 13.4, 12.1, 12.0)",
    );
    await assertKindAt(
      workspace,
      A_MARKDOWN,
      "absent",
      `${context}, once \`build\` has run`,
      `\`build\` removed the FIFO, the occupant of a recorded derived path ` +
        `no longer generated (SPEC 13.4, 12.1)`,
    );
    await fifoRun(
      product,
      workspace,
      undefined,
      CHECK,
      `${context}, once \`build\` has run`,
      (result, rc) => {
        assertExitCode(
          result,
          0,
          `${rc}: the rebuilt record no longer lists ${A_MARKDOWN}, and ` +
            `nothing is stale (SPEC 13.3, 13.4, 14.10, 12.2)`,
        );
        assertCleanCheckReport(result, rc);
      },
    );
  });
}

// --- (i) The hold path --------------------------------------------------------

/** The hold FIFO's name in its own directory outside the workspace. */
const HOLD_FIFO_NAME = "hold";

/**
 * (i)'s staging: a FIFO named `hold` in a fresh directory of its own in the
 * workspace's temporary directory — outside the workspace root (H-1),
 * disposed with it — made by `stageFifo` with that directory as the
 * staging's root and the temporary directory beside it holding its
 * scratch, so verified on the harness itself as a FIFO in place (E-1).
 * Returns the record `assertFifosIntact` takes and the FIFO's absolute
 * path, the `--test-hold` value.
 */
async function stageHoldFifo(
  workspace: TestWorkspace,
): Promise<{ readonly staged: StagedLeftover; readonly abs: string }> {
  const dir = await fsp.mkdtemp(path.join(workspace.tempRoot, "hold-fifo-"));
  const staged = await stageFifo(
    { root: dir, tempRoot: workspace.tempRoot },
    HOLD_FIFO_NAME,
  );
  return { staged, abs: path.join(dir, HOLD_FIFO_NAME) };
}

/**
 * (i) (module header): `rename specs/A.mdx a a2 --test-hold <FIFO> --json`
 * — exit 2, the error document's `code` and `path` `null`, under `fifoRun`
 * (nothing modified, the FIFO in place) — then nothing at `.xspec/lock`.
 */
async function holdPathArm(product: ProductBinding): Promise<void> {
  await withWorkspace(FIFO_ARM_DECL, async (workspace) => {
    const context = "T13.4-13 (i) the hold path a FIFO outside the workspace";
    await stageFifoArm(product, workspace, context);
    const hold = await stageHoldFifo(workspace);
    const argv = [...FIFO_ARM_RENAME, "--test-hold", hold.abs, "--json"];
    await fifoRun(
      product,
      workspace,
      hold.staged,
      argv,
      context,
      (result, rc) => {
        assertExitCode(
          result,
          2,
          `${rc}: the hold file's creation fails if anything — a FIFO ` +
            `included — already exists at the path, so the command fails ` +
            `with a usage error, exit 2, without modifying anything (SPEC ` +
            `13.5, 12.0)`,
        );
        const error = expectErrorDocument(result, rc);
        assertSameJson(
          { code: error.code, path: error.path },
          { code: null, path: null },
          `${rc}: 13.5's usage error is a plain one — no stable code, no ` +
            `concerned path — never the write failure (14.24) or another ` +
            `condition in its place (SPEC 13.5, 12.7, 14.24) — message: ` +
            `${JSON.stringify(error.message)}`,
        );
      },
    );
    await assertLockPathAbsent(
      workspace.root,
      `${context}: after the usage error past acquisition (SPEC 13.5: ` +
        `release as every normal end comes; TEST-SPEC T13.5-11(a))`,
    );
  });
}

const T13_4_13 = defineProductTest({
  id: "T13.4-13",
  title:
    'any other occupant: FIFOs — on the Linux leg, each arm on a freshly built valid workspace holding an audit session `s` created while it was valid, a FIFO staged at one path no glob matches (never opened by the harness), every invocation under `--json` completing promptly, the FIFO never opened and still in place afterward unless a `build` replaces or removes it, nothing else modified but by a `build` that succeeds: (a) the root\'s `xspec.config.ts` a FIFO — `build`, `check`, `ids`, `view`, `inventory`, and a `rename` succeeding on a FIFO-free twin each exit 2 with the error document\'s `code` `"configuration-error"`, `path` `"xspec.config.ts"`, `locations` [], and `version` exits 0 — and, beside the valid root configuration, `alt.config.ts` a FIFO, each of those commands given `--config alt.config.ts` exits 2 likewise, `path` `"alt.config.ts"`, and `version` so given exits 0; (b) `.xspec/journal` a FIFO — `build`, `check`, and `ids` (answering nothing) each report exactly condition 13 (`journal-error`, `.xspec/journal`, `locations` []), exit 1, and the `rename` is refused with that finding alone, exit 1; `inventory` reports `journal` exactly `{"path": ".xspec/journal", "occupied": true}`, finding-free, exit 0; `occurrences`, `view specs/A.mdx`, and `at specs/A.mdx 0` each answer finding-free, exit 0; (c) `.xspec/reviews/s.json` a FIFO — `check`, `review status s`, and `review list` (`s` listed corrupt) each report `s` corrupt, condition 21 concerning `.xspec/reviews/s.json`, exit 1, and `inventory` lists `.xspec/reviews/s.json`, finding-free, exit 0; (d) `.xspec/reviews` a FIFO, and separately `.xspec` a FIFO — every command T10.1-6\'s plain-file arm for that path runs answers exactly as there, its stale-twin runs aside; (e) the generated module `specs/A.xspec.ts` a FIFO — `check` reports exactly one finding, condition 10 in the per-file form concerning it (`stale-output`, `locations` []), exit 1; `build` exits 0, replacing the FIFO with the generated plain file, byte-equal to a FIFO-free twin\'s; `check` then clean; (f) under `markdown: { emit: true, outDir: "out" }`, built, the directory `out` with all it holds replaced by a FIFO — `build` and `check` each exit 1 with exactly the condition-22 finding concerning `out` (`obstructed-write-path`, `locations` []), modifying nothing, and `occurrences`, `view specs/A.mdx`, and `at specs/A.mdx 0` each answer finding-free, exit 0; (g) under `specs/**/*.mdx`, `specs/A.mdx` holding a section `x` — `move specs/A.mdx other/B.mdx` and `move specs/A.mdx#x other/B.mdx#x`, `other/B.mdx` a FIFO in no spec group, each exit 1 with exactly `refused-destination-exists` and `refused-invalid-destination`, each concerning `other/B.mdx`; `move specs/A.mdx specs/sub/B.mdx`, `specs/sub` a FIFO, and, under (f)\'s configuration, `move specs/A.mdx specs/new/B.mdx`, the component `out/specs/new` of its emit path a FIFO, each exit 1 with exactly one finding, `refused-invalid-destination` concerning the destination; (h) built with emission next to sources, `specs/A.md` replaced by a FIFO, then emission disabled — `check` reports the condition-10 recorded-file finding concerning `specs/A.md` and no other finding but, unasserted, the unit form, exit 1; `build` exits 0, removing the FIFO; `check` then clean; (i) a `rename` succeeding on the FIFO-free twin given `--test-hold` naming a FIFO outside the workspace — exit 2 with the error document\'s `code` and `path` `null`, nothing modified, the FIFO in place, `.xspec/lock` absent afterwards (SPEC 13.4, 6.5, 7, 10.1, 11.2, 11.6, 12.7, 13.3, 13.5, 14.10, 14.13, 14.14, 14.21–14.24)',
  run: async (product) => {
    // The premise: the `rename` (a), (b), and (i) run succeeds on a
    // FIFO-free twin.
    await fifoFreeTwin(product);
    // (a) The configuration path found, then named, each on its workspace.
    for (const staging of CONFIGURATION_FIFOS) {
      await configurationArm(product, staging);
    }
    // (b) The journal path.
    await journalArm(product);
    // (c) A session file.
    await sessionFileArm(product);
    // (d) The session directory, then the area's own path.
    await sessionDirectoryArm(product);
    await areaArm(product);
    // (e) A derived file's path, after its FIFO-free twin.
    await derivedFileArm(product);
    // (f) A write path's directory component.
    await writePathComponentArm(product);
    // (g) A move's destination and its components, each on its workspace.
    for (const staging of MOVE_DESTINATION_STAGINGS) {
      await moveDestinationArm(product, staging);
    }
    // (h) A recorded derived path no longer generated.
    await recordedPathArm(product);
    // (i) The hold path, outside the workspace.
    await holdPathArm(product);
  },
});

/** TEST-SPEC §13.4, part ii, in canonical ID order (SUITE-47). */
export const section134iiTests: readonly ProductTestEntry[] = [
  T13_4_12,
  T13_4_13,
];
