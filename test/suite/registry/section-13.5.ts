// TEST-SPEC §13.5 (concurrency and isolation) — SUITE-48: T13.5-1 (hold-seam
// basics: five held mutating-command arms, each leaving nothing at
// `.xspec/lock` once complete and compared byte-identically against its
// no-seam twin, the lock path aside (seam neutrality; H-6), the
// stale-workspace arm — the hold precedes the 13.3 refresh, graph data
// byte-identical while held — the occupied-hold-path exit-2 arms (a file, a
// directory, a symbolic link to a file, and a dangling symbolic link whose
// target lies in a writable directory outside the workspace: each occupant
// unchanged, `.xspec/lock` absent, nothing at the dangling link's target),
// the non-mutating unknown-flag arm, and `build --test-hold --json`
// consuming `--json` as the hold path — the flag value-taking by name on
// every command, JSON out of effect, stdout empty),
// T13.5-2 (mutual exclusion: while command 1 holds — the held-state
// comparison against its pre-invocation state — each other mutating command
// refused promptly with exit 2, modifying nothing, once under `--json` with
// the busy error document of 14.26 and once without, stdout empty, command
// 1's entry standing alone after each refusal; each refused operation
// succeeding on an unheld twin and once command 1 has completed; the
// refused `--json` runs repeated on fresh content-identical workspaces held
// by separate holder processes — recreated at the same absolute path, and
// at a different one — byte-identically),
// T13.5-3 (exclusivity ends with the process: each mutating command in turn
// held and killed under the exit-collection discipline — its group killed
// with SIGKILL, its exit collected, no process of the group listed — the
// dead run's entry the lock directory's one entry, then taken over by a
// later, different mutating command exiting 0, a busy refusal meeting the
// reuse check; and past the hold, each command killed after its lift at
// fixed fractions of its twin's lift-to-exit span, on fresh copies of one
// built workspace, a kill short of the twin's final state finding the dead
// run's entry and a run exiting first ending as its twin), T13.5-4 (readers
// during mutation: while a `rename` holds, each read from the 13.3 read
// surface exits 0 with its pre-hold stdout, `check --json` clean with
// nothing for the lock path, no read reporting `workspace-busy`, and once
// each has exited the held-state comparison and the inclusion check — the
// holder's entry alone, byte-identical; `build` during a hold, on a
// workspace of its own, exiting 0 while it stands — awaited before the lift
// — followed by the same two checks, the rename then ending exactly as on a
// twin held and lifted alike with no concurrent `build`; then the
// build/query storm),
// T13.5-5 (atomic visibility via a polling reader), T13.5-7 (interrupted or
// write-refused mutation: the pinned write order — the refusal arms (a)–(h)
// composed from write-refusal-staging.ts, release's state after each, and
// the kill arm), T13.5-8
// (acquisition's place in the order: the acquisition-first arms — each
// invocation a later check refuses, on a valid workspace whose code group
// discovers a code source and on two failing ones, one failed by a BOM-led
// source and one by a garbage journal line, run under `--json` beside a
// held `review resolve`, the busy refusal of 14.26, and with `.xspec/lock` a
// symbolic link to an outside directory, acquisition's write failure — the
// acquisition-after arms in the same two settings — the syntax class, a
// configuration made invalid, a file both groups match met by the first
// discovery, and an unlistable discovered directory, each reported in
// acquisition's place — the hold seam engaging on invocations the 12.0
// argument checks, baseline resolution (its journal read included), or the
// 13.3 gate refuse, and the non-mutating preview boundary). T13.5-6
// (workspace isolation: sibling and nested workspace pairs) lives in
// section-13.5-vii.ts.
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
//   (the section form only in T13.5-8's acquisition-first arms, to its
//   argument checks), or a mutating `review` subcommand with `create` under
//   `--strategy audit` (`--base` and `--coverage` only in T13.5-8's arms)
//   (§CONF-CORE), and the in-scope fixtures stay in CONF-CORE's workspace
//   shape: one spec group of importless, tagless `.mdx` sources; no `code`
//   key but in T13.5-8's valid workspaces, whose code group discovers one
//   code source, the wrong-kind origin, and matches beside the spec group a
//   path nothing occupies until the first-discovery arm creates a file
//   there (T13.5-12(d)'s configuration); no `markdown`, `coverage`, or
//   `policy` keys; no git.
// - T13.5-1's seam-neutrality twin drives the exact command sequence of the
//   held workspace — the staging `build` and the `review status` item
//   lookup included — with the seam flag alone removed, no `build` or read
//   command between the mutating command's start and the final compare,
//   and its whole-tree compare includes the journal, the lock path alone
//   left out (H-6; §VIOL-CORE-CHATTYREADS's passing analysis leans on
//   exactly that sequence equality).
// - T13.5-1's stale-workspace arm is the only in-scope mutating command
//   started on stale graph data (§CONF-CORE's freshness constraint, which
//   §VIOL-CORE-EARLYREFRESH's passing side leans on): it stages its own
//   workspaces, and every other mutating command these tests start —
//   T13.5-1's basic arms, T13.5-2's held and excluded commands, T13.5-3's
//   killed and subsequent commands and its past-the-hold runs with their
//   twins (copies of one freshly built workspace), T13.5-4's held mutators —
//   the reads arm's, and the `build` arm's with its twin's — starts on a
//   freshly built workspace with no refresh pending (T10.1-1).
// - T13.5-1's dangling-link arm stages the link's target in a directory of
//   its own outside the workspace, verified writable by the harness's own
//   process before the run (§CONF-CORE's justification: with that directory
//   missing or unwritable, a product creating the hold file through the
//   link fails that creation and exits 2 exactly as a conforming product
//   does), and its bounded run turns a product holding at the link's target
//   into a diagnosed failure (S-3; §VIOL-CORE-HOLDLINK).
// - T13.5-2's excluded commands carry no `--test-hold` (§VIOL-CORE-NOLOCK),
//   and its modifies-nothing compare brackets each excluded command alone,
//   with the baseline snapshot taken while command 1 is already held
//   (§VIOL-CORE-EARLYWRITE); the held-state comparison while command 1
//   holds is the only ground on which §VIOL-CORE-EARLYWRITE fails it; its
//   items are learned by a read before anything is held, and no `build` or
//   read runs on any of its workspaces while a lock directory stands
//   (§CONF-CORE; §VIOL-CORE-READERENTRY's and §VIOL-CORE-BUILDWAIT's passing
//   sides); and its second commands start once command 1 has exited
//   (§VIOL-CORE-EARLYRELEASE's passing side).
// - T13.5-8's two failing workspaces each stage one condition, added after
//   the valid `build` and the audit session's creation: a second spec
//   source beginning with a byte-order mark (14.20 at offset 0), masked and
//   never an operand; and, separately, T6.3-6(a)'s garbage line appended to
//   the journal a staging `rename` wrote before the session's creation (the
//   journal error of 14.13, among `build`'s findings, 13.3); the `build`
//   establishing each runs outside every bracket and before anything is
//   held (§CONF-CORE; §VIOL-CORE-READERENTRY's and §VIOL-CORE-BUILDWAIT's
//   passing sides — §VIOL-CORE-CHATTYREADS appends at `check` alone, so
//   never there). Its acquisition-first arms' holders — `review
//   resolve` on session `s`, created while the workspace was valid — start
//   on a freshly built valid workspace or on a failing one, where the
//   gate writes nothing; the held-state comparison is made against each
//   holder's pre-invocation state while it holds (the byte half the only
//   ground on which §VIOL-CORE-EARLYWRITE fails it, the holder's resolution
//   written before its hold); each holder is awaited to exit, `.xspec/lock`
//   absent, before the next mutating command starts
//   (§VIOL-CORE-EARLYRELEASE); the arms' runs carry no `--test-hold` but
//   the occupied-hold-path arm's, at a path no holder uses
//   (§VIOL-CORE-NOLOCK); every modifies-nothing compare brackets one
//   refused invocation alone (§VIOL-CORE-EARLYWRITE); the sessions' items
//   are learned by reads before anything is held, and no `build` or read
//   runs during a hold or while a lock directory stands (§CONF-CORE;
//   §VIOL-CORE-CHATTYREADS's, §VIOL-CORE-READERENTRY's,
//   §VIOL-CORE-BUILDWAIT's, and §VIOL-CORE-PERSISTREADS's passing sides);
//   the code source its wrong-kind arms name is a staged-source record S-9
//   judges well-formed, spelling no marker, `text` call, or specifier
//   naming a spec module, so nothing in scope presents a finding; and
//   session `c` stands corrupt only while the run naming it executes, no
//   other command starting and no hold lifted meanwhile (§CONF-CORE). Its
//   acquisition-after arms stage only what §CONF-CORE's scope serves — a
//   configuration made invalid by an unknown top-level key, a file created
//   at the path both groups match, and a discovered directory made
//   unlistable (verified on the harness, E-1) — each made just before its
//   run and undone before anything else starts or any hold is lifted. Its
//   refused valid-workspace commands start on freshly built workspaces,
//   and its journal-staged baseline runs on the journal-failing one, each
//   lying in no repository and inside none, where every `--base` ref is
//   unresolvable, H-1's precondition verified before its baseline arms run
//   (§CONF-CORE; `assertSelfContainedRoot`,
//   helpers/self-contained-root.ts); and its waits for a refused
//   invocation's hold file fail loud, never proceeding on the command's
//   exit or on a timeout (§VIOL-CORE-LATEHOLD).
// - T13.5-3's subsequent mutating command after each kill while held is a
//   different operation, succeeding whether or not the killed operation's
//   writes landed, never a retry of it (§VIOL-CORE-EARLYWRITE: its held
//   kills leave the completed operation) — each command in
//   T13_5_3_OPERATIONS followed by the next; no `build` or read runs on its
//   workspaces while a lock directory stands, between the kill and the later
//   command included, nor on the copies its past-the-hold arm takes, whose
//   items are learned on the base before copying (§CONF-CORE); its later
//   commands start only once the killed run's group is gone, its
//   past-the-hold runs start none (§VIOL-CORE-NOLOCK's,
//   §VIOL-CORE-STALELOCK's, and §VIOL-CORE-EARLYRELEASE's analyses); and its
//   past-the-hold arm asserts, of a run its kill stops short of the twin's
//   final state, the lock path's state alone — a derived file the kill left
//   partial is no part of it (§VIOL-CORE-PARTIALWRITE).
// - T13.5-4's storm arm asserts termination only — the storm commands' exit
//   codes are deliberately unasserted — plus the final `build`'s
//   byte-equality to a clean build; its held-phase reads run while the
//   mutator is held, one at a time, none overlapping a `build`
//   (§VIOL-CORE-PARTIALWRITE's expected-failure analysis depends on exactly
//   this shape), each drawn from §CONF-CORE's read surface — no `inventory`
//   and no preview — over a session holding no resolution
//   (§VIOL-CORE-PERSISTREADS), and each followed, once it has exited, by
//   the held-state comparison — whose byte half covers the journal, where
//   §VIOL-CORE-CHATTYREADS fails T13.5-4, and whose count half covers the
//   lock directory, where §VIOL-CORE-READERENTRY does — and the inclusion
//   check (H-6). Its `build` during a hold runs on a workspace of its own,
//   overlapping no read (§VIOL-CORE-PARTIALWRITE), bounded, and is awaited
//   before the hold is lifted — the order §VIOL-CORE-BUILDWAIT pins: a
//   harness lifting the hold first passes a product whose `build` waits the
//   hold out — its twin running the same sequence with the concurrent
//   `build` alone left out. Its reads during a hold run on a workspace of
//   their own, and no `check` runs on the `build` arm's workspace or its
//   twin, nor on the storm's workspace or the clean reference it compares
//   against (§VIOL-CORE-CHATTYREADS: nothing appends to the journal
//   there). The storm's clean-build compare covers the whole tree, the
//   journal included, leaving out H-6's lock-path exclusion alone — the
//   lock path `.xspec/lock` and everything under it; the exclusion reaches
//   no further (H-6).
//
// Conservative operationalizations (noted per H-3/H-4):
// - "Proceeds only once the file is deleted" (T13.5-1): the deterministic
//   check is the held-state comparison while held (TEST-SPEC §13.5's
//   preamble; helpers/lock-state.ts `assertHeldState`: every workspace path
//   but the lock path byte-identical to the pre-invocation state — nothing
//   modified — and `.xspec/lock` holding the held run's one entry) —
//   certified via VIOL-CORE-EARLYWRITE — plus: the process is still running
//   after that comparison's reads complete, and exits 0 only after the
//   harness deletes the hold file. T13.5-8's seam-ordering arms
//   (`refusedSeamArm`) make the same comparison while held.
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
//   input, H-10; the driver's own timeout, unconverted, would end the test a
//   hang, which the certification runner counts as `hang`, C-1) — and for
//   T13.5-2 the excluded command's exit is observed while command 1 is
//   still held (asserted: command 1 has not exited).
// - T13.5-3's past-the-hold kills (E-5): a kill's landing is read from the
//   collected exit — SIGKILL where the kill, not a normal exit, ended the
//   run — and "some path the twin's run changed did not yet hold the twin's
//   final state" from snapshots: the twin's changed paths are the keys at
//   which its pre-invocation and final snapshots differ (added, removed, or
//   changed; the lock path aside, H-6), each compared, kind and bytes,
//   between the killed run's copy and the twin's final state. The spread is
//   fixed: PAST_THE_HOLD_KILL_FRACTIONS of the twin's measured lift-to-exit
//   span, each delay counted from the run's own lift — scheduling only, never
//   an assertion input (H-10). The copies are byte copies of the base's
//   whole tree (directories, plain files with their modes, links verbatim),
//   checked against the base before use, a difference a harness error.
// - "Observe the prior state" (T13.5-4): each read command's exit code and
//   stdout bytes while the rename is held equal the same invocation's from
//   before the rename started (SPEC 12.0 byte-determinism: identical
//   workspace bytes, identical answers). "Reporting nothing for the lock
//   path": `check --json`'s report clean, and, where it holds findings, none
//   concerning `.xspec/lock` or a path under it (its `path` or a location's
//   `file`). "No read command reporting the busy condition": no read's
//   stdout — its report, answer, or error document — carries 14.26's
//   stable code `workspace-busy` (T14-4: 14.26 delivered by the refused
//   mutating command alone), stderr's wording left free (H-3).
// - "`build` exits 0 while the hold stands" (T13.5-4): `build --json` run
//   bounded while the `rename` holds and awaited before the harness deletes
//   the hold file — a `build` waiting the hold out fails diagnosed at the
//   bound (H-8) — the `rename` confirmed still running as it exits; "no
//   `workspace-busy`": its stdout, where `--json` would put the busy error
//   document, carries no such token, and it exits 0. "A twin with no
//   concurrent `build`": a second fresh CONF-CORE workspace staged alike,
//   the same `rename` held and lifted as soon as its hold file appears — the
//   seam used alike on both sides, the concurrent `build` the one
//   difference — its run's exit code, stdout, and stderr, and its final
//   workspace (H-6 across directories: the lock path aside), equal to the
//   arm's.
// - "Never a partial file" (T13.5-5): every distinct content the polling
//   reader observes must byte-equal one of the completed builds' contents
//   for the polled path (the set of post-build reads), and no absence may
//   be observed after content has been observed or after the first build
//   completed. A build's "new content" is thus its completed content — the
//   only enumerable reading of "prior content, complete new content, or
//   absence-before-first-write" from the observer side.
// - T13.5-7's refusal arms stage each 14.24 refusal by permission removal
//   while the command is held at the seam (after acquisition, before any
//   modification — seam neutrality) and read every rewritten-byte
//   expectation from a twin on which the same operation ran unrefused
//   (H-6); the states are asserted entry by entry against 13.5's pinned
//   per-command write order (write-refusal-staging.ts), each arm then
//   asserting release's state: (b)'s residue — the emptied lock directory
//   its read-only `.xspec` keeps, until a later mutating command removes it
//   — and every other arm's absence of `.xspec/lock`. Its kills follow
//   T13.5-3's exit-collection discipline without the reuse check (the
//   group gone before `check` runs, no mutating command following); its
//   kill-timing spread is a fixed delay list — kill scheduling is
//   choreography, never an assertion input (H-10); the operative assertions
//   are delay-independent and disjunctive exactly as 13.5 admits: after a
//   post-lift kill, the lock path is in T13.5-3's past-the-hold state
//   (helpers/lock-state.ts `assertLockPathAfterKill`, the shared machinery)
//   and `check` exits 0 or 1 (never a signal death, never another code —
//   the configuration is intact, so the exit-2 class is not stageable) with
//   condition 5–7 findings alone or condition 10 findings alone, and after
//   a held-point kill the dead run's entry stands and `check` exits 0 (the
//   hold precedes all modification).

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
  pathValueBytes,
  renderPathValue,
} from "../../helpers/adapters/index.js";
import {
  GRAPH_DATA_AREA_PATH,
  isGraphDataKey,
} from "../../helpers/adapters/record-staging.js";
import {
  assertBytesEqual,
  assertExitCode,
  describeByteDifference,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { assertRunOutcomesEqual } from "../../helpers/determinism.js";
import {
  applyReuseCheck,
  runVoidableTrial,
} from "../../helpers/kill-discipline.js";
import { isLockPathBytes, LOCK_PATH } from "../../helpers/lock-path.js";
import { PathPoller, polledStateKey } from "../../helpers/path-poller.js";
import type { LockEntry, StagedLeftover } from "../../helpers/lock-staging.js";
import {
  assertOutsideTargetsUntouched,
  assertStagingInPlace,
  killHeldRun,
  stageLeftover,
} from "../../helpers/lock-staging.js";
import type { KilledRunTwin } from "../../helpers/lock-state.js";
import {
  assertHeldState,
  assertLockPathAbsent,
  assertLockPathAfterKill,
  assertLockPathAsCaptured,
  assertOnlyEntry,
  captureLockPath,
} from "../../helpers/lock-state.js";
import { stageReadRefusalOfDirectory } from "../../helpers/permissions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { assertSelfContainedRoot } from "../../helpers/self-contained-root.js";
import { stagedMdx } from "../../helpers/staged-mdx.js";
import { stagedTs } from "../../helpers/staged-ts.js";
import type {
  DirectorySnapshot,
  SnapshotOptions,
} from "../../helpers/snapshot.js";
import {
  assertDirectoriesEqual,
  assertLeavesUnchanged,
  assertSnapshotsEqual,
  diffSnapshots,
  snapshotDirectory,
} from "../../helpers/snapshot.js";
import type {
  KilledGroup,
  ProductBinding,
  RunGuards,
  RunningProduct,
  RunResult,
} from "../../helpers/subprocess.js";
import {
  pathExists,
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
  assertFindingLocated,
  assertSameJson,
  buildFindings,
  buildOk,
  expectErrorDocument,
  expectExit,
  runCli,
  runJson,
} from "./support.js";
import {
  awaitHoldFile,
  holdPathFor,
  JOURNAL_PATH,
  renameTwin,
  runKillArm,
  runWriteRefusalArms,
  startHeldAndLift,
  WRITE_FAILURE_CODE,
  WRITE_REFUSALS_STAGED,
} from "./write-refusal-staging.js";

// Minimal declarative configuration (SPEC 7): exactly one spec group, no
// other keys — the CONF-CORE workspace shape (CERTIFICATIONS.md). A
// staged-source record: T11.6-3, T12.7-3, T13.4-12, T13.5-1, T13.5-4,
// T13.5-6, T13.5-8, T13.5-10, T13.5-11, T13.5-13, T14-6, T14-9, T14-10, and
// P-15 stage it in workspaces created after a product invocation (CORE_DECL,
// section-13.5-vii.ts's ISO_TWO_DECL and NESTED_DECL — at both of its
// roots — section-13.5-vi.ts's T13_5_13_DECL), as T6.6-3's scheduling and
// acquisition arms do (S-9's timing clause;
// test/self/s9-staged-sources.test.ts).
export const SPECS_ONLY_CONFIG = stagedTs(
  "T6.6-3/T11.6-3/T12.7-3/T13.4-12/T13.5-1/T13.5-4/T13.5-6/T13.5-8/T13.5-10/T13.5-11/T13.5-13/T14-6/T14-9/T14-10/P-15 xspec.config.ts — exactly one spec group, the CONF-CORE workspace shape (CORE_DECL's, ISO_TWO_DECL's, NESTED_DECL's at both roots, and T13_5_13_DECL's)",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
);

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
// The source is staged in workspaces created after a body's first product
// invocation (T13.5-1's stale arm, T13.5-4's storm pair, T13.5-6's pairs —
// the outer root's source in its nested pair — in section-13.5-vii.ts,
// T13.5-8's valid-workspace arms, T13.5-10's,
// T13.5-11's, and T13.5-12's per-arm workspaces and twins — T13.5-12(c)
// creating it in one during a hold — T6.6-3's scheduling workspace, its
// acquisition arms' workspaces and their unobstructed twin,
// T13.4-12's per-arm workspaces and twin, T13.5-13's trial and twin
// workspaces, T11.6-3's lock-path arms' workspaces, the busy arms' of
// T12.7-3 and T14-6, `judgeBusyRefusal`, T14-9's acquisition-write arms'
// workspaces, T14-10's arm (i)'s, P-15's draw and twin workspaces) and,
// byte for byte, by
// section-13.4.ts's tests (its later workspaces included), so it is one
// staged-source record made from the string (S-9's before-any-product
// clause; helpers/staged-mdx.ts) — the string stays for the staleness edit
// below — staged wherever the bytes are.
export const CORE_A_STAGED = stagedMdx(
  "T6.6-3/T11.6-3/T12.7-3/T13.4-1/T13.4-2/T13.4-3/T13.4-4/T13.4-5/T13.4-6/T13.4-12/T13.5-1/T13.5-2/T13.5-3/T13.5-4/T13.5-6/T13.5-8/T13.5-10/T13.5-11/T13.5-12/T13.5-13/T14-6/T14-9/T14-10/P-15 specs/A.mdx (the CONF-CORE-shaped source: a holding a.k, then g; T13.4-6's specs/one/A.mdx too; T13.5-12(c)'s, created during a hold)",
  A_MDX,
);

/**
 * The CONF-CORE-shaped staging shared by the 13.5 lock tests — and by
 * T6.6-3's runs-while-held arm, which per CERTIFICATIONS.md shares this
 * drive-during-hold choreography (T13.5-2's staging), and its acquisition
 * arms.
 */
export const CORE_DECL: WorkspaceDecl = {
  files: { "xspec.config.ts": SPECS_ONLY_CONFIG, "specs/A.mdx": CORE_A_STAGED },
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
// seam-held staging choreography shared with T14-9); the hold path's is
// re-exported here for T6.6-3, which shares this module's drive-during-hold
// choreography (`whileCommand1Holds`, `nonMutatingRunWhileHeld`;
// CERTIFICATIONS.md).
export { holdPathFor };

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

/**
 * One-line outcome of a settled run, for premature-exit diagnoses. A
 * harness error — an exhausted capture limit, a failure of the driver's
 * in-run evaluation (T6.5-22(a)'s check) — is never folded into one: it
 * propagates as itself (H-11).
 */
export async function describeExit(running: RunningProduct): Promise<string> {
  try {
    return summarizeResult(await running.waitForExit());
  } catch (error) {
    rethrowHarnessError(error);
    return error instanceof Error ? error.message : String(error);
  }
}

/**
 * Run a command to completion under a bound, converting a rejection (a
 * product that blocks or hangs instead of exiting, killed at the bound) into
 * a diagnosed assertion failure (H-8). The bound is a hang guard, never an
 * assertion input (H-10). A harness error — an exhausted capture limit, a
 * failure of the driver's in-run evaluation (T6.5-22(a)'s check) — is never
 * converted: it propagates as itself (H-11). `guards` lower the bound or
 * the capture limit for S-8's vector alone.
 */
export async function runBounded(
  product: ProductBinding,
  cwd: string,
  argv: readonly string[],
  context: string,
  guards: RunGuards = {},
): Promise<RunResult> {
  try {
    return await runProduct(product, {
      cwd,
      argv,
      timeoutMs: guards.timeoutMs ?? 15_000,
      maxOutputBytes: guards.maxOutputBytes,
    });
  } catch (error) {
    rethrowHarnessError(error);
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
// The staleness edit is staged after each of the three workspaces' `build`,
// so it is a ledger record (S-9's before-any-product clause;
// helpers/staged-mdx.ts) — the same constant, one record for all three.
const T13_5_1_A_EDITED = stagedMdx(
  "T13.5-1 stale arm: specs/A.mdx with Kid text edited",
  A_MDX_EDITED,
);

/**
 * Snapshot scope "graph data alone" — T13.3-2's operational path set, judged
 * by the suite's one graph-data predicate (`isGraphDataKey`): everything
 * under `.xspec/` but the durable files there — the journal
 * (`.xspec/journal`, SPEC 6.1) and the review sessions (`.xspec/reviews/`,
 * SPEC 10.1) — and the transient lock path `.xspec/lock` with everything
 * under it (SPEC 13.4: no graph data), with everything outside `.xspec/`
 * pruned; the area's directory itself is kept, so the walk descends into
 * it. SPEC 13.3 leaves graph data's layout unenumerated, so the scope is the
 * graph-data area (11.6) minus its durable and transient occupants; in a
 * harness-staged workspace nothing foreign lives there.
 */
const GRAPH_DATA_ALONE: SnapshotOptions = Object.freeze({
  exclude: (relPathBytes: Uint8Array): boolean => {
    const key = Buffer.from(relPathBytes).toString("latin1");
    return key !== GRAPH_DATA_AREA_PATH && !isGraphDataKey(key);
  },
});

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
          await staged.file("specs/A.mdx", T13_5_1_A_EDITED);
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
        const staleGraphData = await snapshotDirectory(
          workspace.root,
          GRAPH_DATA_ALONE,
        );
        const builtGraphData = await snapshotDirectory(
          twinBuild.root,
          GRAPH_DATA_ALONE,
        );
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

        // Pre-invocation state, the held-state comparison's baseline: a
        // snapshot of the whole root, `.xspec/` included — graph data among
        // it (TEST-SPEC §13.5's preamble; helpers/lock-state.ts).
        const before = await snapshotDirectory(workspace.root);
        const hold = holdPathFor(workspace, "hold-stale.tmp");
        const running = await startProduct(product, {
          cwd: workspace.root,
          argv: [...create, "--test-hold", hold],
        });
        try {
          await awaitHoldFile(running, hold, context);
          await assertEmptyHoldFile(hold, context);
          // The held-state comparison: its byte half excludes the lock path
          // alone, so graph data (.xspec/graph.json, the one file the
          // pending 13.3 refresh changes) is compared like every other
          // path — the hold is created after acquiring exclusivity and
          // before every modification, the refresh included, so a product
          // that refreshes before acquiring exclusivity fails here — and its
          // count half finds the held run's one entry (SPEC 13.5, 13.3).
          await assertHeldState(
            workspace.root,
            { baseline: before, heldRuns: 1 },
            `${context} while held, against the workspace before the ` +
              `command started`,
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
            rethrowHarnessError(error);
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
          // Release (SPEC 13.5; T13.5-11), as on the basic arms: nothing at
          // the lock path once the run has completed.
          await assertLockPathAbsent(
            workspace.root,
            `${context}: after completing normally`,
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
        // final trees are compared whole but for the lock path, which H-6
        // leaves out across directories (absent on the held side, asserted
        // above) — sources, journal, sessions, derived files, and graph data
        // (both refresh, to the same state).
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
            `under .xspec/ but the journal, .xspec/reviews/, and the lock ` +
            `path .xspec/lock): after release the 13.3 refresh has run, ` +
            `writing exactly what \`build\` writes on an identically edited ` +
            `twin — the recorded derived-file paths, which the edit leaves ` +
            `unchanged, excepted (SPEC 13.3, 13.5; T10.1-1; a ` +
            `product-to-itself comparison under H-4/H-6)`,
          GRAPH_DATA_ALONE,
        );
      });
    });
  });
}

// T13.5-1's occupied hold path (SPEC 13.5: creation fails if anything, a
// symbolic link included, already exists at the path).

/** The bytes T13.5-1's plain-file occupant is staged with. */
const HOLD_OCCUPANT_BYTES = "occupant bytes\n";
/** The bytes of the file T13.5-1's link-to-a-file occupant points to. */
const HOLD_LINK_TARGET_BYTES = "hold-path link target bytes\n";

type OccupantKind = "absent" | "file" | "directory" | "symbolic link" | "other";

/** What occupies an absolute path, judged by `lstat` (a link never followed). */
async function occupantKindAt(abs: string): Promise<OccupantKind> {
  let stats;
  try {
    stats = await fsp.lstat(abs);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "absent";
    throw error;
  }
  if (stats.isFile()) return "file";
  if (stats.isDirectory()) return "directory";
  if (stats.isSymbolicLink()) return "symbolic link";
  return "other";
}

/** A plain file at `abs` — never a link to one — holding exactly `bytes`. */
async function assertPlainFileHolds(
  abs: string,
  bytes: string,
  context: string,
): Promise<void> {
  const kind = await occupantKindAt(abs);
  if (kind !== "file") {
    fail(`${context}: expected a plain file at ${abs}; found ${kind}`);
  }
  assertBytesEqual(await fsp.readFile(abs), bytes, context);
}

/** A symbolic link at `abs` whose target is exactly `target`. */
async function assertLinkTo(
  abs: string,
  target: string,
  context: string,
): Promise<void> {
  const kind = await occupantKindAt(abs);
  if (kind !== "symbolic link") {
    fail(
      `${context}: the occupant after the refusal must still be a symbolic ` +
        `link — creation fails if anything, a symbolic link included, ` +
        `already exists at the path (SPEC 13.5); found ${kind}`,
    );
  }
  const actual = await fsp.readlink(abs);
  if (actual !== target) {
    fail(
      `${context}: the link's target after the refusal — untouched (SPEC ` +
        `13.5); expected ${JSON.stringify(target)}, got ` +
        `${JSON.stringify(actual)}`,
    );
  }
}

/** A directory at `abs` holding exactly the entries `names`. */
async function assertDirectoryNames(
  abs: string,
  names: readonly string[],
  context: string,
): Promise<void> {
  const kind = await occupantKindAt(abs);
  if (kind !== "directory") {
    fail(`${context}: expected a directory at ${abs}; found ${kind}`);
  }
  const actual = [...(await fsp.readdir(abs))].sort();
  const expected = [...names].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(
      `${context}: ${abs} must hold exactly ${JSON.stringify(expected)}; ` +
        `found ${JSON.stringify(actual)}`,
    );
  }
}

/**
 * A fresh directory of its own for an occupant link's target, in the
 * workspace's tempRoot beside the root — outside the workspace — and
 * verified writable by this process, the identity every product run takes
 * (H-2): a probe file created there and removed, the directory left empty.
 * A product creating the hold file through a link exposes itself only where
 * the link's target lies in a writable directory; with the directory
 * missing or unwritable that creation fails and the product exits 2,
 * nothing at the target, exactly as a conforming product does
 * (CERTIFICATIONS.md §CONF-CORE's justification, §VIOL-CORE-HOLDLINK) — so
 * a directory failing the probe is a staging the harness never runs on, a
 * harness error (H-11), never a product verdict.
 */
async function stageHoldLinkTargetDirectory(
  workspace: TestWorkspace,
): Promise<string> {
  const dir = await fsp.mkdtemp(path.join(workspace.tempRoot, "hold-target-"));
  await fsp.chmod(dir, 0o755);
  const fromRoot = path.relative(workspace.root, dir);
  if (fromRoot !== ".." && !fromRoot.startsWith(`..${path.sep}`)) {
    throw new Error(
      `T13.5-1 staging: the link target's directory ${dir} lies inside the ` +
        `workspace ${workspace.root}; it must lie outside it (H-11)`,
    );
  }
  const probe = path.join(dir, "probe");
  try {
    await fsp.writeFile(probe, "", { flag: "wx" });
    await fsp.unlink(probe);
  } catch (error) {
    throw new Error(
      `T13.5-1 staging: the link target's directory ${dir} must be writable ` +
        `by this process, the identity the product runs as — a link into ` +
        `an unwritable directory discriminates nothing (H-11) — ` +
        `${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const left = await fsp.readdir(dir);
  if (left.length !== 0) {
    throw new Error(
      `T13.5-1 staging: the link target's directory ${dir} must hold ` +
        `nothing once probed; found ${JSON.stringify(left)} (H-11)`,
    );
  }
  return dir;
}

/**
 * One occupant of T13.5-1's occupied hold path: `stage` places it at the
 * hold path `abs`, with the outside target a link needs, and returns the
 * check made once the command has been refused — the occupant unchanged
 * and, for the dangling link, nothing at its target.
 */
interface HoldPathOccupant {
  /** What occupies the path, as the arm's context names it. */
  readonly kind: string;
  /** The hold path's name in the workspace's tempRoot (holdPathFor). */
  readonly name: string;
  readonly stage: (
    workspace: TestWorkspace,
    abs: string,
  ) => Promise<(context: string) => Promise<void>>;
}

const HOLD_PATH_OCCUPANTS: readonly HoldPathOccupant[] = [
  {
    kind: "file",
    name: "occupied-file",
    stage: async (_workspace, abs) => {
      await fsp.writeFile(abs, HOLD_OCCUPANT_BYTES, { flag: "wx" });
      return async (context) => {
        await assertPlainFileHolds(
          abs,
          HOLD_OCCUPANT_BYTES,
          `${context}: the occupant after the refusal — untouched (SPEC ` +
            `13.5: creation fails; nothing is modified)`,
        );
      };
    },
  },
  {
    kind: "directory",
    name: "occupied-directory",
    stage: async (_workspace, abs) => {
      await fsp.mkdir(abs);
      return async (context) => {
        await assertDirectoryNames(
          abs,
          [],
          `${context}: the occupant after the refusal — still an empty ` +
            `directory (SPEC 13.5: creation fails; nothing is modified)`,
        );
      };
    },
  },
  {
    kind: "symbolic link to a file",
    name: "occupied-link-to-file",
    stage: async (workspace, abs) => {
      const dir = await stageHoldLinkTargetDirectory(workspace);
      const target = path.join(dir, "target");
      await fsp.writeFile(target, HOLD_LINK_TARGET_BYTES, { flag: "wx" });
      await fsp.symlink(target, abs);
      return async (context) => {
        await assertLinkTo(abs, target, context);
        await assertPlainFileHolds(
          target,
          HOLD_LINK_TARGET_BYTES,
          `${context}: the link's target file after the refusal — ` +
            `untouched, nothing written through the link (SPEC 13.5, 13.4)`,
        );
        await assertDirectoryNames(
          dir,
          ["target"],
          `${context}: the link target's directory after the refusal — ` +
            `nothing created beside the target (SPEC 13.5, 13.4)`,
        );
      };
    },
  },
  {
    kind: "dangling symbolic link",
    name: "occupied-dangling-link",
    stage: async (workspace, abs) => {
      const dir = await stageHoldLinkTargetDirectory(workspace);
      const target = path.join(dir, "absent");
      await fsp.symlink(target, abs);
      return async (context) => {
        await assertLinkTo(abs, target, context);
        const atTarget = await occupantKindAt(target);
        if (atTarget !== "absent") {
          fail(
            `${context}: after the dangling link's arm nothing may exist at ` +
              `the link's target ${target} — creation fails on the link ` +
              `itself, never writing through it (SPEC 13.5: creation fails ` +
              `if anything, a symbolic link included, already exists at the ` +
              `path; 13.4); found ${atTarget}`,
          );
        }
        await assertDirectoryNames(
          dir,
          [],
          `${context}: the link target's directory after the refusal — ` +
            `nothing created in it (SPEC 13.5, 13.4)`,
        );
      };
    },
  },
];

/**
 * T13.5-1's occupied-hold-path arms: each occupant staged at the hold path,
 * `rename specs/Moved.mdx a2 a3 --test-hold <path>` fails exit 2 without
 * modifying anything (H-6 leaving out the lock path the run acted on), the
 * occupant unchanged, `.xspec/lock` absent afterwards (T13.5-11: release as
 * every normal end comes, a refusal included), and — after the dangling
 * link's arm — nothing at the link's target. Each run is bounded
 * (`runBounded`): a product creating the hold file through the dangling
 * link holds at its target instead of exiting 2, and the bound's expiry is
 * that arm's diagnosed failure (H-8, S-3) — the driver's own timeout,
 * unconverted, would end the test a hang, which the certification runner
 * counts as `hang`, never a certified failure (C-1; §VIOL-CORE-HOLDLINK).
 */
async function occupiedHoldPathArms(
  product: ProductBinding,
  workspace: TestWorkspace,
): Promise<void> {
  for (const occupant of HOLD_PATH_OCCUPANTS) {
    const abs = holdPathFor(workspace, occupant.name);
    const verifyOccupant = await occupant.stage(workspace, abs);
    const context =
      `T13.5-1 (hold path occupied by a ${occupant.kind}) ` +
      "`rename specs/Moved.mdx a2 a3 --test-hold <occupied>`";
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
    await verifyOccupant(context);
    await assertLockPathAbsent(
      workspace.root,
      `${context}: after the refusal (SPEC 13.5: release as every normal ` +
        `end comes, a refusal included)`,
    );
  }
}

const T13_5_1 = defineProductTest({
  id: "T13.5-1",
  title:
    "each mutating command (`rename`, file-form `move`, `review create/resolve/split`) with `--test-hold` creates an empty file at the path after acquiring exclusivity and before modifying anything (the held-state comparison holding while held: every workspace path but the lock path `.xspec/lock` byte-identical to the pre-invocation state, and `.xspec/lock` a directory holding exactly the held run's entry, a plain file), proceeds only once the file is deleted, and completes normally, `.xspec/lock` absent afterwards (T13.5-11), the held-then-released run's final workspace state — sources, journal, sessions, derived files, and graph data — byte-identical to the same operation run without `--test-hold` on an identical twin workspace (seam neutrality: the seam changes no other behavior; H-4, and H-6 leaving out the lock path across directories); on a workspace whose graph data is stale (a section's text edited after `build`, the workspace still valid) `review create --strategy audit --test-hold` leaves graph data and every other workspace file but the lock path byte-identical while held — the hold precedes the 13.3 refresh too — and after release creates the session, refreshes the graph data to what `build` writes on an identical twin, and leaves nothing at `.xspec/lock`; anything at the hold path — a file, a directory, a symbolic link to a file, or a dangling symbolic link whose target lies in a writable directory outside the workspace — fails the command exit 2 without modifying anything, the occupant unchanged, `.xspec/lock` absent afterwards, and nothing at the dangling link's target (creation fails on the link itself, never writing through it); `build` and `query` given `--test-hold` fail exit 2 as an unknown flag, and `build --test-hold --json` — the flag value-taking by name on every command — consumes `--json` as the hold path and leaves JSON out of effect: exit 2, stdout empty, no hold file (SPEC 13.5, 13.3, 13.4, 12.0)",
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
            // The held-state comparison (TEST-SPEC §13.5's preamble): the
            // hold file is created after acquiring exclusivity and before
            // modifying anything, so every path but the lock path is
            // byte-identical while held, and the lock directory holds the
            // held run's one entry (SPEC 13.5).
            await assertHeldState(
              workspace.root,
              { baseline: before, heldRuns: 1 },
              `${context} while held, against the workspace before the ` +
                `command started`,
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
              rethrowHarnessError(error);
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
            // Release (SPEC 13.5; T13.5-11): the completed run deleted its
            // entry, then the emptied lock directory — the seam-neutrality
            // compare below leaves the lock path out (H-6 across
            // directories), so its absence is asserted here.
            await assertLockPathAbsent(
              workspace.root,
              `${context}: after completing normally`,
            );
            await onCompleted();
          } finally {
            running.kill();
            await releaseHoldFile(hold);
          }

          // Seam neutrality: the twin runs the same operation without
          // `--test-hold`, and the final workspace states are compared
          // whole but for the lock path, which H-6 leaves out across
          // directories (absent on the held side, asserted above) — the
          // journal included.
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

      // Occupied hold path (SPEC 13.5: creation fails if anything, a
      // symbolic link included, already exists at the path): a file, a
      // directory, a symbolic link to a file, and a dangling symbolic link
      // whose target lies in a writable directory outside the workspace —
      // see occupiedHoldPathArms. `rename` is the representative mutating
      // command; every refusal leaves the workspace untouched, so the arms
      // chain on this workspace.
      await occupiedHoldPathArms(product, workspace);

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

/** T13.5-2's command 1: `rename specs/A.mdx a a2`, held at the seam. */
const T13_5_2_COMMAND_1: readonly string[] = [
  "rename",
  "specs/A.mdx",
  "a",
  "a2",
];

/**
 * The audit session `s`'s two items the `resolve` and `split` of T13.5-2 and
 * T13.5-3 name.
 */
export interface SessionItems {
  /** `g`'s item, unblocked, so `resolve` applies (SPEC 10.6, 10.7). */
  readonly leaf: string;
  /** `a`'s item, its scope root holding a child, so `split` applies (10.7). */
  readonly parent: string;
}

/**
 * A mutating command on the session staging (`stageSessionWorkspace`): its
 * description, and its arguments, naming the session's items where it needs
 * them.
 */
export interface SessionOperation {
  readonly what: string;
  /** Its arguments, naming the session's items where it needs them. */
  readonly argv: (items: SessionItems) => readonly string[];
}

/**
 * T13.5-2's five other mutating commands (SPEC 13.5: `rename`, `move`, and
 * the mutating `review` subcommands), each from CONF-CORE's surface —
 * file-form `move`, `review create` under `--strategy audit` (§CONF-CORE) —
 * in the order they run. Each is an operation valid in its own right on the
 * staged workspace — succeeding on an unheld twin — and composing with
 * command 1 — succeeding once command 1 has run — so that its exit 2 while
 * command 1 holds is the exclusion's alone (TEST-SPEC T13.5-2, as in
 * T13.5-10(e)). Once command 1 has run, each also composes with those before
 * it: the session's items stay addressable by their `id`s across `g`'s
 * rename and the file's move (SPEC 10.2: an item stays actionable after its
 * nodes are moved), the leaf's item is resolved before the parent's split,
 * and the parent's scope root keeps its child (10.7). None carries
 * `--test-hold` (§VIOL-CORE-NOLOCK's staging constraint: given one at the
 * holding command's hold path, that violator's runs would fail exit 2 on the
 * occupied path, modifying nothing, and its expected failure would never
 * materialize).
 */
const T13_5_2_EXCLUDED: readonly SessionOperation[] = [
  {
    what: "`rename specs/A.mdx g g2`",
    argv: () => ["rename", "specs/A.mdx", "g", "g2"],
  },
  {
    what: "`move specs/A.mdx specs/B.mdx`",
    argv: () => ["move", "specs/A.mdx", "specs/B.mdx"],
  },
  {
    what: "`review create --strategy audit --name t`",
    argv: () => ["review", "create", "--strategy", "audit", "--name", "t"],
  },
  {
    what: "`review resolve s <leaf item> --status no-change`",
    argv: (items) => [
      "review",
      "resolve",
      "s",
      items.leaf,
      "--status",
      "no-change",
    ],
  },
  {
    what: "`review split s <parent item>`",
    argv: (items) => ["review", "split", "s", items.parent],
  },
];

/** One refused `--json` run of T13.5-2's first round, kept for determinism. */
interface RefusedRun {
  readonly what: string;
  /** The operation's arguments, `--json` aside. */
  readonly argv: readonly string[];
  readonly result: RunResult;
}

/**
 * The session staging of T13.5-2 and T13.5-3, the same command sequence on
 * every workspace either test stages — T13.5-2's held one, its determinism
 * repeats, and its unheld twins; each of T13.5-3's kill-while-held trials,
 * and the base its past-the-hold arm copies — so that they are
 * content-identical: a fresh CONF-CORE-shaped workspace, `build`, `review
 * create --strategy audit --name s` (the audit session `s` created while the
 * workspace is valid), and the session's items learned by `review status s
 * --json`, a read run before anything is held, no lock directory standing
 * (§CONF-CORE: on T13.5-2 and T13.5-3 no `build` or read command runs inside
 * a bracket or while a lock directory stands — between T13.5-3's kill and its
 * later command included — nor on the copies T13.5-3's past-the-hold arm
 * takes, whose items are learned here, before copying: the quiet
 * §VIOL-CORE-CHATTYREADS's, §VIOL-CORE-READERENTRY's, and
 * §VIOL-CORE-BUILDWAIT's passing sides lean on); every mutating command
 * either test starts then starts on a freshly built workspace with no
 * refresh pending (§CONF-CORE's freshness constraint, which
 * §VIOL-CORE-EARLYREFRESH's passing side leans on). T13.5-10 stages each of
 * its arms, and each unstaged twin, on the same sequence
 * (section-13.5-ii.ts: "a freshly built valid workspace holding an `audit`
 * session `s` created while it was valid").
 */
export async function stageSessionWorkspace(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
): Promise<SessionItems> {
  await buildOk(product, workspace, `${context} staging \`build\``);
  await expectExit(
    product,
    workspace,
    ["review", "create", "--strategy", "audit", "--name", "s"],
    0,
    `${context} staging \`review create --strategy audit --name s\``,
  );
  const status = await sessionStatus(
    product,
    workspace,
    "s",
    `${context} staging`,
  );
  return {
    leaf: requireRowByScope(
      status,
      "specs/A.mdx#g",
      `${context} staging (leaf item)`,
    ).id,
    parent: requireRowByScope(
      status,
      "specs/A.mdx#a",
      `${context} staging (parent item)`,
    ).id,
  };
}

/**
 * Run `body` while T13.5-2's command 1 holds `workspace` — `rename
 * specs/A.mdx a a2 --test-hold <path>`, the hold path outside the workspace,
 * its hold file awaited — then lift the hold and require command 1 to
 * complete normally, exit 0 (SPEC 13.5), so the refusals `body` observed are
 * attributable to the held command alone. A wait the run never ends is a
 * diagnosed failure (H-8); a harness error propagates as itself (H-11).
 * Shared with T6.6-3's runs-while-held arm (section-6.6.ts; CERTIFICATIONS.md's
 * Exclusions entry on previews: T13.5-2's staging and drive-during-hold
 * choreography), whose `body` runs a preview to completion while command 1
 * holds.
 */
export async function whileCommand1Holds<T>(
  product: ProductBinding,
  workspace: TestWorkspace,
  holdName: string,
  context: string,
  body: (command1: RunningProduct) => Promise<T>,
): Promise<T> {
  const hold = holdPathFor(workspace, holdName);
  const command1 = await startProduct(product, {
    cwd: workspace.root,
    argv: [...T13_5_2_COMMAND_1, "--test-hold", hold],
  });
  try {
    await awaitHoldFile(command1, hold, context);
    const value = await body(command1);
    await releaseHoldFile(hold);
    let result: RunResult;
    try {
      result = await command1.waitForExit();
    } catch (error) {
      rethrowHarnessError(error);
      return fail(
        `${context}: command 1 must complete normally once its hold file is ` +
          `deleted (SPEC 13.5) — ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
    assertExitCode(
      result,
      0,
      `${context}: completes normally once its hold is lifted, so what ran ` +
        `while it held met a workspace it held — the refusals then ` +
        `attributable to it alone (SPEC 13.5)`,
    );
    return value;
  } finally {
    command1.kill();
    await releaseHoldFile(hold);
  }
}

/**
 * One run of an excluded operation while command 1 holds (T13.5-2): it fails
 * promptly — bounded (the hang guard of `runBounded`, never an assertion
 * input, H-10), and exiting while command 1 still holds — with exit 2 (SPEC
 * 13.5: the busy refusal of 14.26, a usage error, 12.0); under `--json` its
 * stdout is exactly the 12.7 error document, `code` `"workspace-busy"`,
 * `path` `".xspec/lock"`, `locations` `[]` (`message` and `identities`
 * informational, 12.7; the decode form-exact), and without it stdout is
 * empty (12.0); it modifies nothing — the compare bracketing this run alone,
 * its baseline taken while command 1 already holds (§CONF-CORE's bracketing
 * constraint, which §VIOL-CORE-EARLYWRITE's passing side leans on), the lock
 * path left out (H-6: the run reaches acquisition, whose writes and
 * release's count as no modification) — and command 1's entry stands
 * byte-identical, name and content, the lock directory's only entry (SPEC
 * 13.5: no acquisition or release removes or alters a live run's entry, and
 * the refused run's release deletes its own). Returns the run.
 */
async function assertRefusedWhileHeld(
  product: ProductBinding,
  workspace: TestWorkspace,
  command1: RunningProduct,
  holder: LockEntry,
  argv: readonly string[],
  json: boolean,
  context: string,
): Promise<RunResult> {
  const before = await snapshotDirectory(workspace.root);
  const result = await runBounded(
    product,
    workspace.root,
    json ? [...argv, "--json"] : argv,
    context,
  );
  assertExitCode(
    result,
    2,
    `${context}: a mutating command meeting another live run's entry at ` +
      `acquisition fails there promptly, modifying nothing, with the usage ` +
      `error of 14.26 (SPEC 13.5, 14.26, 12.0)`,
  );
  if (command1.hasExited()) {
    fail(
      `${context}: command 1 must still hold when the excluded command ` +
        `exits — the refusal is prompt, never a wait for command 1's ` +
        `exclusivity to end (SPEC 13.5) — ${await describeExit(command1)}`,
    );
  }
  if (json) {
    const finding = expectErrorDocument(result, context);
    assertSameJson(
      { code: finding.code, path: finding.path, locations: finding.locations },
      { code: "workspace-busy", path: LOCK_PATH, locations: [] },
      `${context}: the busy refusal's error document carries the stable ` +
        `code "workspace-busy", the concerned path "${LOCK_PATH}", and no ` +
        `locations (SPEC 14.26, 12.7; \`message\` and \`identities\` ` +
        `informational) — message: ${JSON.stringify(finding.message)}`,
    );
  } else if (result.stdoutBytes.length !== 0) {
    fail(
      `${context}: without --json a usage error's stdout is empty (SPEC ` +
        `12.0); got ${String(result.stdoutBytes.length)} bytes — ` +
        summarizeResult(result),
    );
  }
  assertSnapshotsEqual(
    before,
    await snapshotDirectory(workspace.root),
    `${context}: modifies nothing — journal, sessions, and sources ` +
      `byte-identical, the compare bracketing this command alone, its ` +
      `baseline taken while command 1 already held (SPEC 13.5)`,
  );
  await assertOnlyEntry(
    workspace.root,
    holder,
    `${context}: after the refusal, command 1's entry`,
  );
  return result;
}

/**
 * Recreate `workspace` at its own absolute path — T13.5-2's determinism arm,
 * "the workspace recreated there": its root removed whole and made again,
 * holding the CONF-CORE staging's own files afresh (CORE_DECL's records),
 * ready for the staging commands the original ran.
 */
async function recreateAtSamePath(workspace: TestWorkspace): Promise<void> {
  await fsp.rm(workspace.root, { recursive: true, force: true });
  await fsp.mkdir(workspace.root);
  for (const [rel, contents] of Object.entries(CORE_DECL.files ?? {})) {
    await workspace.file(rel, contents);
  }
}

/**
 * T13.5-2's determinism arm on one repeat workspace (12.0; 12.7: `message`
 * and `identities` deterministic, informational though they are; H-6):
 * staged as the held workspace was, and held by a separate holder process —
 * command 1 started afresh, whose entry therefore records another process
 * identifier (cyclic allocation, T13.5-3) — each refused command's `--json`
 * run repeated with the first run's arguments (the busy refusal precedes the
 * item checks, SPEC 13.5, 12.0: the same invocation, whatever the repeat's
 * own items), its exit, standard output, and standard error byte-identical to
 * the first run's: failing a product whose diagnostic names a process
 * identifier, an entry, or the workspace's absolute path.
 */
async function repeatRefusals(
  product: ProductBinding,
  workspace: TestWorkspace,
  where: string,
  holdName: string,
  firstRuns: readonly RefusedRun[],
): Promise<void> {
  const context = `T13.5-2 determinism (${where})`;
  await stageSessionWorkspace(product, workspace, context);
  await whileCommand1Holds(
    product,
    workspace,
    holdName,
    `${context} command 1 \`rename specs/A.mdx a a2 --test-hold <path>\``,
    async () => {
      for (const first of firstRuns) {
        const label = `${context} ${first.what} --json while command 1 holds`;
        const result = await runBounded(
          product,
          workspace.root,
          [...first.argv, "--json"],
          label,
        );
        assertRunOutcomesEqual(
          result,
          first.result,
          `${label}: repeated on a fresh content-identical workspace held ` +
            `by a separate holder process, ${where}, it answers ` +
            `byte-identically — no process identifier, entry, or absolute ` +
            `path in its diagnostic (SPEC 12.0, 12.7, 13.4; H-6)`,
          `the repeat ${where}`,
          "the first run",
        );
      }
    },
  );
}

/**
 * The operation the busy refusal staged for tests outside §13.5 refuses
 * (`judgeBusyRefusal`): T13.5-2's first excluded operation, `rename
 * specs/A.mdx g g2` — succeeding on CORE_DECL's staging and composing with
 * command 1, `g` a top-level leaf apart from command 1's `a` (SPEC 6.4).
 */
const BUSY_OPERATION: readonly string[] = ["rename", "specs/A.mdx", "g", "g2"];

/**
 * The busy refusal (SPEC 13.5, 14.26) staged as T13.5-2 stages it, for the
 * tests asserting its answer outside §13.5 — T12.7-3's error document ("a
 * busy workspace → `code` `"workspace-busy"` and `path` `".xspec/lock"`
 * (T13.5-2)") and T14-6's stable code. On a fresh CONF-CORE-shaped
 * workspace (CORE_DECL), freshly built, T13.5-2's command 1 (`rename
 * specs/A.mdx a a2`) is held at the seam (`whileCommand1Holds`, its hold
 * path outside the workspace) and `rename specs/A.mdx g g2 --json` runs
 * once while it holds, bounded (`runBounded`: a product waiting for the
 * exclusivity to end fails diagnosed at the hang guard, H-8, H-10). Command
 * 1 must still be running as that run exits, so the answer `judge` then
 * receives — while command 1 still holds — met a workspace another run
 * held; once the hold is lifted command 1 must complete normally (exit 0)
 * and the same operation, run again, must succeed (exit 0): the run judged
 * was refused for the busy workspace alone, never for a defect of its own
 * operation (the T7-2 attribution discipline). The exclusion's full
 * contract — every mutating command, the refused run modifying nothing,
 * the holder's entry untouched, determinism — is T13.5-2's.
 */
export async function judgeBusyRefusal(
  product: ProductBinding,
  context: string,
  judge: (result: RunResult) => void | Promise<void>,
): Promise<void> {
  const operation = `\`${BUSY_OPERATION.join(" ")}\``;
  await withWorkspace(CORE_DECL, async (workspace) => {
    await buildOk(product, workspace, `${context} staging \`build\``);
    await whileCommand1Holds(
      product,
      workspace,
      "hold-busy.tmp",
      `${context} command 1 \`rename specs/A.mdx a a2 --test-hold <path>\``,
      async (command1) => {
        const label = `${context} ${operation} under --json while command 1 holds`;
        const result = await runBounded(
          product,
          workspace.root,
          [...BUSY_OPERATION, "--json"],
          label,
        );
        if (command1.hasExited()) {
          fail(
            `${label}: command 1, held at the seam, must still be running ` +
              `as the run exits — a held run proceeds only once its hold is ` +
              `lifted (SPEC 13.5) — so the answer met a workspace another ` +
              `run held; command 1 ended: ${await describeExit(command1)}`,
          );
        }
        await judge(result);
      },
    );
    await expectExit(
      product,
      workspace,
      BUSY_OPERATION,
      0,
      `${context} ${operation} once command 1 has completed — the ` +
        `operation succeeds there (SPEC 13.5, 6.4), so its refusal while ` +
        `command 1 held was the busy workspace's alone`,
    );
  });
}

const T13_5_2 = defineProductTest({
  id: "T13.5-2",
  title:
    'while command 1 (`rename specs/A.mdx a a2 --test-hold <path>`) holds — the held-state comparison holding against its pre-invocation state — each other mutating command (`rename`, file-form `move`, `review create/resolve/split`), each an operation succeeding on an unheld twin and composing with command 1, fails promptly, exiting while command 1 still holds, with exit 2 and modifies nothing (journal, sessions, and sources byte-identical, the compare bracketing each excluded command alone, its baseline taken while command 1 already holds); each is run once under `--json`, its stdout exactly the error document with `code` `"workspace-busy"`, `path` `".xspec/lock"`, and `locations` `[]`, and once without, stdout empty; after each refusal command 1\'s entry is byte-identical, name and content, and the lock directory\'s only entry; after command 1 completes, each second command succeeds; determinism: each refused `--json` run is repeated on a fresh content-identical workspace held by a separate holder process — recreated at the same absolute path, and at a different one — its stdout and stderr byte-identical across the three runs (SPEC 13.5, 14.26, 12.7, 12.0, H-6)',
  run: async (product) => {
    const firstRuns: RefusedRun[] = [];
    await withWorkspace(CORE_DECL, async (workspace) => {
      const items = await stageSessionWorkspace(product, workspace, "T13.5-2");
      // Command 1's pre-invocation state: the held-state comparison's
      // baseline (TEST-SPEC §13.5's preamble).
      const preInvocation = await snapshotDirectory(workspace.root);
      await whileCommand1Holds(
        product,
        workspace,
        "hold-primary.tmp",
        "T13.5-2 command 1 `rename specs/A.mdx a a2 --test-hold <path>`",
        async (command1) => {
          // The held-state comparison while command 1 holds, against its
          // pre-invocation state: every path but the lock path
          // byte-identical, `.xspec/lock` holding command 1's one entry — on
          // T13.5-2 the only ground on which §VIOL-CORE-EARLYWRITE, command
          // 1's operation written before its hold, fails (CERTIFICATIONS.md
          // §CONF-CORE's justification).
          const [holder] = await assertHeldState(
            workspace.root,
            { baseline: preInvocation, heldRuns: 1 },
            "T13.5-2 while command 1 holds, against its pre-invocation state",
          );
          if (holder === undefined) {
            throw new Error(
              "T13.5-2: assertHeldState returned no entry for one held run",
            );
          }
          for (const operation of T13_5_2_EXCLUDED) {
            const argv = operation.argv(items);
            const context = `T13.5-2 excluded ${operation.what} while command 1 holds`;
            const result = await assertRefusedWhileHeld(
              product,
              workspace,
              command1,
              holder,
              argv,
              true,
              `${context} (under --json)`,
            );
            firstRuns.push({ what: operation.what, argv, result });
            await assertRefusedWhileHeld(
              product,
              workspace,
              command1,
              holder,
              argv,
              false,
              `${context} (without --json)`,
            );
          }
        },
      );

      // After command 1 completes, the second command succeeds (SPEC 13.5:
      // exclusivity ends with command 1's normal completion): each excluded
      // operation in turn, started once command 1 has exited
      // (§VIOL-CORE-EARLYRELEASE's passing side leans on that), exits 0 —
      // each composing with command 1 and with those before it.
      for (const operation of T13_5_2_EXCLUDED) {
        await expectExit(
          product,
          workspace,
          operation.argv(items),
          0,
          `T13.5-2 ${operation.what} once command 1 has completed — the ` +
            `second command succeeds, exclusivity having ended with command ` +
            `1's normal completion (SPEC 13.5)`,
        );
      }

      // Determinism: the workspace recreated at the same absolute path, then
      // a content-identical one at a different path — made while this one
      // still exists, so the two paths differ. Each repeat workspace, like
      // the first round's one held workspace, serves all five refused
      // commands under its own fresh holder: a refused run modifies nothing
      // (asserted above for each), so each command's repeat meets a fresh
      // content-identical workspace held by a separate holder process.
      await recreateAtSamePath(workspace);
      await repeatRefusals(
        product,
        workspace,
        "at the same absolute path, the workspace recreated there",
        "hold-repeat-same-path.tmp",
        firstRuns,
      );
      await withWorkspace(CORE_DECL, async (other) => {
        await repeatRefusals(
          product,
          other,
          "at a different absolute path",
          "hold-repeat-other-path.tmp",
          firstRuns,
        );
      });
    });

    // The unheld twins: each excluded operation, on a fresh workspace staged
    // as the held one with nothing held, exits 0 — in the state it met while
    // command 1 held (the hold precedes every modification, SPEC 13.5), so
    // its exit 2 then was the exclusion's alone. Its operands name the twin's
    // own items — the same operation by item scope, never an assumed
    // cross-directory identifier equality (H-4).
    for (const operation of T13_5_2_EXCLUDED) {
      await withWorkspace(CORE_DECL, async (twin) => {
        const context = `T13.5-2 unheld twin for ${operation.what}`;
        const twinItems = await stageSessionWorkspace(product, twin, context);
        await expectExit(
          product,
          twin,
          operation.argv(twinItems),
          0,
          `${context}: the operation succeeds where nothing is held (SPEC ` +
            `13.5), so its exit 2 while command 1 held is the exclusion's ` +
            `alone`,
        );
      });
    }
  },
});

// ---------------------------------------------------------------------------
// T13.5-3 — exclusivity ends with the process
// ---------------------------------------------------------------------------

/**
 * T13.5-3's mutating commands, each in turn killed while held and, past the
 * hold, killed after its lift — every one an operation succeeding on the
 * session staging (`stageSessionWorkspace`), from CONF-CORE's surface:
 * file-form `move` (never the section form), `review create` under
 * `--strategy audit` (§CONF-CORE). The command killed while held at index
 * `i` is followed by the one at `i + 1` (the last by the first): a
 * different operation, succeeding whether or not the killed one's writes
 * landed — never a retry of it (§VIOL-CORE-EARLYWRITE's staging
 * constraint, its kills at the held point leaving the completed operation).
 * `move` takes the file `rename` rewrote or did not; `review create --name
 * t` meets the file moved or not; `resolve` names `g`'s item of `s` beside a
 * session `t` or none; `split` names `a`'s item of `s`, `g`'s resolved or
 * not (a separate item, SPEC 10.7); and `rename` renames `a`, its item
 * split or not — a split touches no source.
 */
const T13_5_3_OPERATIONS: readonly SessionOperation[] = [
  {
    what: "`rename specs/A.mdx a a2`",
    argv: () => ["rename", "specs/A.mdx", "a", "a2"],
  },
  {
    what: "`move specs/A.mdx specs/B.mdx`",
    argv: () => ["move", "specs/A.mdx", "specs/B.mdx"],
  },
  {
    what: "`review create --strategy audit --name t`",
    argv: () => ["review", "create", "--strategy", "audit", "--name", "t"],
  },
  {
    what: "`review resolve s <leaf item> --status no-change`",
    argv: (items) => [
      "review",
      "resolve",
      "s",
      items.leaf,
      "--status",
      "no-change",
    ],
  },
  {
    what: "`review split s <parent item>`",
    argv: (items) => ["review", "split", "s", items.parent],
  },
];

/** An error's message, for a diagnosis. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * T13.5-3's kill while held, for one operation, as a voidable trial (E-5):
 * on a fresh session staging, `operation` is held and killed under the
 * exit-collection discipline — `killHeldRun` (helpers/lock-staging.ts):
 * started in a process group of its own, its hold file awaited, the whole
 * group killed with SIGKILL (a catchable signal would let a product release
 * on it, as SPEC 13.5 allows an interrupted command), the started process's
 * exit collected, and no process of the group listed in the process list
 * before anything follows — after which `.xspec/lock` holds exactly one
 * entry, a plain file: the dead run's, a leftover (13.5: an abnormal
 * termination leaves its entry; `killHeldRun` asserts it). No `build` or
 * read runs then (§CONF-CORE). The later command, `later` under `--json`,
 * takes that entry over: it exits 0, and `.xspec/lock` is absent once it
 * ends (T13.5-11). Refused `workspace-busy` (14.26, told by its error
 * document), it meets the reuse check: an identifier of the killed group
 * listed again voids the trial — rerun on a fresh workspace by
 * `runVoidableTrial`, a bounded number of times, exhaustion a harness error
 * (H-11) — while a refusal with none listed fails the test, diagnosed
 * (§VIOL-CORE-STALELOCK).
 */
async function killWhileHeld(
  product: ProductBinding,
  operation: SessionOperation,
  later: SessionOperation,
): Promise<void> {
  const label = `T13.5-3 ${operation.what} killed while held, then ${later.what}`;
  await runVoidableTrial(label, async (attempt) => {
    await withWorkspace(CORE_DECL, async (workspace) => {
      const context = `${label} (trial ${String(attempt)})`;
      const items = await stageSessionWorkspace(product, workspace, context);
      const dead = await killHeldRun(product, {
        root: workspace.root,
        argv: operation.argv(items),
        holdPath: holdPathFor(workspace, "hold-killed.tmp"),
        context: `${context}: the held ${operation.what}`,
      });
      const laterContext =
        `${context}: the later ${later.what} --json, started once no ` +
        `process of the killed group was listed`;
      const result = await runBounded(
        product,
        workspace.root,
        [...later.argv(items), "--json"],
        laterContext,
      );
      if (
        result.exitCode === 2 &&
        expectErrorDocument(result, laterContext).code === "workspace-busy"
      ) {
        // TEST-SPEC T13.5-3's reuse check: the trial void where an
        // identifier of the killed group is listed again (13.5's gap), a
        // diagnosed failure where none is.
        await applyReuseCheck(
          dead.killed.identifiers,
          `${laterContext} — ${summarizeResult(result)}`,
        );
      }
      assertExitCode(
        result,
        0,
        `${laterContext}: a terminated holder never blocks — the later ` +
          `mutating command takes the dead run's entry over and succeeds, ` +
          `never refused workspace-busy (14.26) outside 13.5's gap, whether ` +
          `or not the killed operation's writes landed (SPEC 13.5: an entry ` +
          `whose run has terminated is a leftover, removed at acquisition)`,
      );
      await assertLockPathAbsent(
        workspace.root,
        `${laterContext}: once it has ended, the dead run's entry taken ` +
          `over and its own released`,
      );
    });
  });
}

/**
 * The fixed fractions of a twin's lift-to-exit span at which T13.5-3's
 * past-the-hold kills land, each after its own run's lift — one fixed rule,
 * spread, and count per command, in CI as everywhere (E-5). Scheduling
 * choreography only, never an assertion input (H-10): every assertion of a
 * kill is conditioned on what the kill found, and holds for a conforming
 * product under every timing.
 */
const PAST_THE_HOLD_KILL_FRACTIONS: readonly number[] = [
  0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1,
];

/**
 * A past-the-hold twin: its operation held, lifted, and run to its end —
 * its final state and the paths its run changed being the basis of the
 * shared post-kill judgement (helpers/lock-state.ts
 * `assertLockPathAfterKill`, T13.5-7's kill arm's too).
 */
interface PastTheHoldTwin extends KilledRunTwin {
  /** Its run: exit 0. */
  readonly result: RunResult;
  /** The span from its lift to its exit, in milliseconds. */
  readonly spanMs: number;
}

/**
 * Run `body` on a fresh workspace holding a byte copy of the whole tree
 * `base` snapshots — T13.5-3's past-the-hold copies: each kill lands "on a
 * fresh copy of that workspace", and the twin runs on "an identical
 * workspace" — then dispose of it. The copy is helpers/tree-copy.ts's
 * `copyTreeBytes`, checked against `base` before `body` runs (a difference
 * is a harness error, never a product verdict). Nothing judges it as a
 * staging: its sources were staged, and judged, in the base (S-9), the rest
 * being the product's own state; and no command runs on it but the run
 * under test (§CONF-CORE: no `build` or read on these copies, their items
 * learned on the base before copying).
 */
async function withCopyOf<T>(
  base: DirectorySnapshot,
  body: (copy: TestWorkspace) => Promise<T>,
): Promise<T> {
  return await withWorkspace({}, async (copy) => {
    await copyTreeBytes(Buffer.from(base.root), Buffer.from(copy.root));
    const differences = diffSnapshots(base, await snapshotDirectory(copy.root));
    if (differences.length > 0) {
      throw new Error(
        `harness error: T13.5-3's copy of ${base.root} at ${copy.root} ` +
          `differs from it: ` +
          differences
            .slice(0, 10)
            .map((change) => `${change.change} ${change.path}`)
            .join(", "),
      );
    }
    return await body(copy);
  });
}

/**
 * The past-the-hold twin of `operation` (TEST-SPEC T13.5-3: "the same
 * operation held and lifted alike on an identical workspace, that span
 * measured on it"): on a fresh copy of the base, held, lifted as soon as
 * its hold file appears — as each kill's run is — and run to its end: exit
 * 0, an operation succeeding there, `.xspec/lock` absent once it ends (SPEC
 * 13.5: release on every normal end; T13.5-11). The span from its lift to
 * its exit is measured and the paths its run changed recorded.
 */
async function measurePastTheHoldTwin(
  product: ProductBinding,
  base: DirectorySnapshot,
  operation: SessionOperation,
  items: SessionItems,
): Promise<PastTheHoldTwin> {
  const context = `T13.5-3 past the hold: the twin ${operation.what}, held and lifted`;
  return await withCopyOf(base, async (twin) => {
    const before = await snapshotDirectory(twin.root);
    const { running, liftedAt } = await startHeldAndLift(
      product,
      twin,
      operation.argv(items),
      "hold-twin.tmp",
      context,
    );
    let result: RunResult;
    try {
      result = await running.waitForExit();
    } catch (error) {
      // Whatever still runs of the group goes before any verdict.
      await running.killGroup().catch((kill: unknown) => {
        rethrowHarnessError(kill);
      });
      rethrowHarnessError(error);
      return fail(
        `${context}: once its hold is lifted the command must proceed and ` +
          `end on its own (SPEC 13.5; H-8: a hang is a diagnosed failure) — ` +
          messageOf(error),
      );
    }
    const spanMs = performance.now() - liftedAt;
    assertExitCode(
      result,
      0,
      `${context}: an operation succeeding on the base workspace (TEST-SPEC ` +
        `T13.5-3) completes normally once its hold is lifted (SPEC 13.5)`,
    );
    await assertLockPathAbsent(
      twin.root,
      `${context}: once it has ended (SPEC 13.5: release on every normal ` +
        `end; T13.5-11)`,
    );
    const final = await snapshotDirectory(twin.root);
    return {
      result,
      final,
      changed: diffSnapshots(before, final).map((change) => change.key),
      spanMs,
    };
  });
}

/**
 * One past-the-hold kill (TEST-SPEC T13.5-3): on a fresh copy of the base,
 * `operation` is held, lifted, and — `fraction` of its twin's lift-to-exit
 * span after the lift — killed under the exit-collection discipline
 * (`killGroup`: the whole group killed with SIGKILL, the started process's
 * exit collected, no process of the group listed), its group confirmed
 * gone before the lock path is inspected; no later command runs, the reuse
 * check aside. The lock path is judged by the shared post-kill judgement
 * (helpers/lock-state.ts `assertLockPathAfterKill`, T13.5-7's kill arm's
 * too): the collected exit tells the kill's landing, SIGKILL where the
 * kill, not a normal exit, ended the run. Where it did, while some path
 * the twin's run changed — a source, the journal, a session file, a derived
 * file, or graph data — did not yet hold the twin's final state, the run
 * had not made its last write, so had not released: `.xspec/lock` holds
 * exactly one entry, a plain file — the dead run's, a leftover (SPEC 13.5:
 * a run's entry stands until its release, which comes as the command ends,
 * after its last write; an abnormal termination leaves it). A kill ending
 * the run with every such path already in its final state is judged no
 * further: the run may then have been releasing. A run that exited before
 * the kill landed has `.xspec/lock` absent (T13.5-11) and ends exactly as
 * its twin — exit code, output, and workspace byte-equal (H-6: the lock
 * path aside).
 */
async function pastTheHoldKill(
  product: ProductBinding,
  base: DirectorySnapshot,
  operation: SessionOperation,
  items: SessionItems,
  twin: PastTheHoldTwin,
  fraction: number,
): Promise<void> {
  const delayMs = fraction * twin.spanMs;
  const context =
    `T13.5-3 past the hold: ${operation.what} killed ` +
    `${delayMs.toFixed(1)} ms after its lift (${String(fraction)} of its ` +
    `twin's ${twin.spanMs.toFixed(1)} ms lift-to-exit span)`;
  await withCopyOf(base, async (copy) => {
    const { running, liftedAt } = await startHeldAndLift(
      product,
      copy,
      operation.argv(items),
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
        `${context}: the run must end on its own or by the kill, its exit ` +
          `collected (SPEC 13.5; H-8) — ${messageOf(error)}`,
      );
    }
    const { result } = killed;
    const after = await snapshotDirectory(copy.root);
    const landing = await assertLockPathAfterKill(
      copy.root,
      result,
      after,
      twin,
      context,
    );
    if (landing !== "exited") return;
    assertRunOutcomesEqual(
      result,
      twin.result,
      `${context}: the run exited before the kill landed, so it ends ` +
        `exactly as its twin (TEST-SPEC T13.5-3; H-6)`,
      "the run",
      "its twin",
    );
    assertSnapshotsEqual(
      twin.final,
      after,
      `${context}: the run exited before the kill landed, so its workspace ` +
        `is byte-equal to its twin's final state (TEST-SPEC T13.5-3; H-6: ` +
        `the lock path aside)`,
    );
  });
}

/**
 * T13.5-3's past-the-hold arm (SPEC 13.5: a run's entry stands until its
 * release, which comes as the command ends, after its last write, so its
 * exclusion spans every write it makes): one base workspace — a fresh
 * session staging, freshly built and valid, holding the audit session `s`
 * created while it was valid, its items learned, and nothing at
 * `.xspec/lock` once its staging runs have ended — copied afresh for every
 * run; for each mutating command in turn, its twin measured, then one kill
 * at each fixed fraction of the twin's span, each on a fresh copy.
 * Unsynchronized by design (E-5): it asserts only what a conforming product
 * meets under every timing, and fails a product releasing at its lift — or
 * anywhere short of its last write — on the runs whose kills land in that
 * window (§VIOL-CORE-EARLYRELEASE: on every run).
 */
async function pastTheHoldArm(product: ProductBinding): Promise<void> {
  await withWorkspace(CORE_DECL, async (workspace) => {
    const context = "T13.5-3 past the hold: the base workspace";
    const items = await stageSessionWorkspace(product, workspace, context);
    await assertLockPathAbsent(
      workspace.root,
      `${context}, once its staging runs have ended (SPEC 13.5: release on ` +
        `every normal end; T13.5-11)`,
    );
    const base = await snapshotDirectory(workspace.root);
    for (const operation of T13_5_3_OPERATIONS) {
      const twin = await measurePastTheHoldTwin(
        product,
        base,
        operation,
        items,
      );
      for (const fraction of PAST_THE_HOLD_KILL_FRACTIONS) {
        await pastTheHoldKill(product, base, operation, items, twin, fraction);
      }
    }
  });
}

const T13_5_3 = defineProductTest({
  id: "T13.5-3",
  title:
    "each mutating command in turn (`rename`, file-form `move`, `review create/resolve/split`), held and killed under the exit-collection discipline — started in a process group of its own, the whole group killed with SIGKILL, the started process's exit collected, and no process of the group listed before anything follows — leaves `.xspec/lock` holding exactly one entry, a plain file (the dead run's leftover), which a subsequent mutating command — a different operation, succeeding whether or not the killed operation's writes landed, never a retry of it — takes over, exiting 0, never refused `workspace-busy` outside 13.5's gap, `.xspec/lock` absent once it ends (a busy refusal voids the trial, rerun on a fresh workspace a bounded number of times, where an identifier of the killed group is listed again, and fails the test where none is); past the hold, each command, on fresh copies of a freshly built valid workspace holding an audit session `s`, is held, lifted, and killed at fixed fractions of its twin's lift-to-exit span (the same operation held and lifted alike on an identical copy), its group confirmed gone before the lock path is inspected and no later command running: where the kill ended the run while some path the twin's run changed did not yet hold the twin's final state, `.xspec/lock` holds exactly one entry, a plain file — the dead run's, release coming only after a run's last write — and a run that exited before the kill landed ends exactly as its twin (exit code, output, and workspace byte-equal, H-6), `.xspec/lock` absent (SPEC 13.5, 14.26; E-5)",
  run: async (product) => {
    // Kills while held: each mutating command in turn, followed by the next
    // one in T13_5_3_OPERATIONS (the last by the first).
    for (const [index, operation] of T13_5_3_OPERATIONS.entries()) {
      const later = T13_5_3_OPERATIONS[(index + 1) % T13_5_3_OPERATIONS.length];
      if (later === undefined) {
        throw new Error("T13.5-3: T13_5_3_OPERATIONS is empty");
      }
      await killWhileHeld(product, operation, later);
    }
    // Past the hold: kills spread across each twin's lift-to-exit span.
    await pastTheHoldArm(product);
  },
});

// ---------------------------------------------------------------------------
// T13.5-4 — readers during mutation; build/query storm
// ---------------------------------------------------------------------------

/** How many of each command the storm launches concurrently. */
const STORM_BUILDS = 4;
const STORM_QUERIES = 4;

/**
 * A read command T13.5-4 runs before the hold and again while the `rename`
 * holds: drawn from §CONF-CORE's read surface — no `inventory` and no
 * preview, whose busy-free answers during a hold T11.6-3 and T6.6-3 assert
 * (the scope's staging constraint) — over the workspace's one spec group
 * and its audit session `s`, which holds no resolution, so no read meets a
 * stale one (§VIOL-CORE-PERSISTREADS's constraint); none overlaps a `build`
 * (§VIOL-CORE-PARTIALWRITE's constraint).
 */
interface HeldRead {
  readonly argv: readonly string[];
  readonly what: string;
  /** `check --json`: its findings report clean, nothing for the lock path. */
  readonly checkReport?: true;
}

const T13_5_4_READS: readonly HeldRead[] = [
  { argv: ["check"], what: "`check`" },
  { argv: ["check", "--json"], what: "`check --json`", checkReport: true },
  { argv: ["ids", "--json"], what: "`ids --json`" },
  {
    argv: ["show", "specs/A.mdx#a", "--json"],
    what: "`show specs/A.mdx#a --json`",
  },
  { argv: ["query", "nodes"], what: "`query nodes`" },
  { argv: ["coverage", "--json"], what: "`coverage --json`" },
  { argv: ["review", "list", "--json"], what: "`review list --json`" },
  {
    argv: ["review", "status", "s", "--json"],
    what: "`review status s --json`",
  },
];

/** 14.26's stable code (SPEC 14): the busy condition's token. */
const WORKSPACE_BUSY = "workspace-busy";

/** Whether a finding concerns the lock path or a path under it. */
function concernsLockPath(finding: Finding): boolean {
  const paths = [finding.path, ...finding.locations.map((at) => at.file)];
  return paths.some(
    (value) => value !== null && isLockPathBytes(pathValueBytes(value)),
  );
}

/**
 * `check --json`'s findings report names nothing at or under the lock path
 * (TEST-SPEC T13.5-4: `check` clean on a clean workspace, "reporting
 * nothing for the lock path"): judged on an exit-1 report, the only exit
 * whose report holds findings — a clean one (exit 0) is asserted empty by
 * `assertCleanCheckReport`, any other exit diagnosed by the exit check.
 */
function assertNoLockPathFinding(result: RunResult, context: string): void {
  if (result.exitCode !== 1) return;
  const { findings } = decodeFindingsReport(
    parseJsonStdout(result, context),
    context,
  );
  const there = findings.filter(concernsLockPath);
  if (there.length === 0) return;
  fail(
    `${context}: \`check\` reports nothing for the lock path ${LOCK_PATH} — ` +
      `coordination state, transient, and no workspace content (SPEC 13.4, ` +
      `13.5; TEST-SPEC T13.5-4) — yet ${String(there.length)} of its ` +
      `${String(findings.length)} finding(s) concern it: ` +
      there
        .map(
          (finding) =>
            `${finding.code ?? "<no code>"} at ` +
            `${renderPathValue(finding.path)}: ${finding.message}`,
        )
        .join("; "),
  );
}

/**
 * `check --json` clean: exactly `{"findings": []}` (SPEC 12.7: a
 * finding-free report's array is empty; 12.0: exit 0, asserted by the
 * caller first). Shared with T13.5-10(h) (section-13.5-ii.ts).
 */
export function assertCleanCheckReport(
  result: RunResult,
  context: string,
): void {
  const { findings } = decodeFindingsReport(
    parseJsonStdout(result, context),
    context,
  );
  assertSameJson(
    findings,
    [],
    `${context}: \`check\` is clean on a clean workspace — exactly ` +
      `{"findings": []} (SPEC 12.7, 12.0; TEST-SPEC T13.5-4, T13.5-10(h))`,
  );
}

/**
 * One read while T13.5-4's `rename` holds, judged once it has exited
 * (TEST-SPEC T13.5-4). It runs bounded — a read waiting the hold out fails
 * diagnosed at the bound (H-8; the bound a hang guard, H-10); its stdout
 * carries no busy condition — 14.26's stable code, which the refused
 * mutating command alone reports (T14-4) — and it exits 0; for `check
 * --json`, no finding concerns the lock path and the report is clean; its
 * stdout is byte-identical to the same read's before the `rename` started:
 * it observes the prior state (SPEC 12.0 byte-determinism: identical
 * workspace bytes, identical answers). Then the held-state comparison
 * against the `rename`'s pre-invocation state — every path but the lock
 * path byte-identical (the journal, sessions, and graph data among them),
 * `.xspec/lock` holding the holder's entry alone — and the inclusion check
 * (H-6; the machinery every lock-path inclusion shares): whatever occupied
 * the lock path as the read started — the holder's entry — occupies it
 * byte-identical, name and content, nothing added beside it, a read
 * acquiring nothing and writing nothing there (SPEC 13.4). The step is
 * `nonMutatingRunWhileHeld`'s, which `build` during the hold and T6.6-3's
 * preview while held share.
 */
async function readWhileHeld(
  product: ProductBinding,
  workspace: TestWorkspace,
  read: HeldRead,
  reference: RunResult,
  preInvocation: DirectorySnapshot,
): Promise<void> {
  const context = `T13.5-4 ${read.what} while the rename is held`;
  await nonMutatingRunWhileHeld(product, workspace, {
    argv: read.argv,
    context,
    busyRule:
      `no read command reports the busy condition — the stable code ` +
      `"${WORKSPACE_BUSY}" of 14.26, which the refused mutating command ` +
      `alone reports (SPEC 13.5, 14.26; TEST-SPEC T14-4)`,
    judge: (result) => {
      if (read.checkReport === true) assertNoLockPathFinding(result, context);
      assertExitCode(
        result,
        0,
        `${context}: read commands still run while a mutating command is ` +
          `held, exiting as they did before it (SPEC 13.5: every command ` +
          `but the mutating ones may run concurrently with them)`,
      );
      if (read.checkReport === true) assertCleanCheckReport(result, context);
      assertBytesEqual(
        result.stdoutBytes,
        reference.stdoutBytes,
        `${context}: observes the prior state — stdout byte-identical to ` +
          `the same read before the mutation started (SPEC 13.5; 12.0 ` +
          `byte-determinism: identical workspace bytes, identical answers)`,
      );
    },
    held: "the rename",
    preInvocation,
    heldNote: "a read acquires nothing and writes nothing: SPEC 13.5, 13.4",
  });
}

/**
 * One non-mutating command — a read, `build`, or a preview (SPEC 6.6: a
 * preview invocation is a non-mutating command under 13.5) — run while a
 * mutating command holds the workspace, as `nonMutatingRunWhileHeld` runs
 * it.
 */
export interface NonMutatingRunWhileHeld {
  /** Its arguments. */
  readonly argv: readonly string[];
  /** Its diagnostic context. */
  readonly context: string;
  /**
   * Why its stdout carries no busy condition: 14.26's stable code is the
   * refused mutating command's alone (TEST-SPEC T14-4).
   */
  readonly busyRule: string;
  /**
   * Its outcome judged once it has exited, before the held run and the
   * workspace are inspected; a failure diagnosed (H-8).
   */
  readonly judge: (result: RunResult) => void | Promise<void>;
  /** The held run's name in diagnoses, e.g. "the rename" or "command 1". */
  readonly held: string;
  /**
   * The held run, where the command is awaited while the hold stands — it
   * must still be running as the command exits (§VIOL-CORE-BUILDWAIT's
   * pin) — or `undefined` where no such check is made.
   */
  readonly holder?: RunningProduct;
  /** The held run's pre-invocation state: the held-state comparison's baseline. */
  readonly preInvocation: DirectorySnapshot;
  /** Why the workspace stands as before: the held-state comparison's note. */
  readonly heldNote: string;
}

/**
 * T13.5-4's drive-during-hold step — each of its reads and its `build` alike
 * — shared with T6.6-3's preview while a mutating command is held
 * (section-6.6.ts; CERTIFICATIONS.md's Exclusions entry on previews: the
 * same staging and choreography, the wait for the command's exit while the
 * hold stands certified via VIOL-CORE-BUILDWAIT). The lock path captured as
 * the command starts; the command run bounded and awaited while the hold
 * stands — one waiting the hold out fails diagnosed at the bound (H-8; the
 * bound a hang guard, H-10); its stdout carrying no busy condition
 * (`busyRule`); `judge`; the held run, where given, still running as the
 * command exits; then the held-state comparison against the held run's
 * pre-invocation state — every path but the lock path byte-identical,
 * `.xspec/lock` holding the holder's entry alone — and the inclusion check
 * (H-6; the machinery every lock-path inclusion shares, VIOL-CORE-READERENTRY's
 * note): whatever occupied the lock path as the command started — the
 * holder's entry — occupies it byte-identical, name and content, nothing
 * added beside it, a command acquiring nothing writing nothing there (SPEC
 * 13.4). Returns the command's run.
 */
export async function nonMutatingRunWhileHeld(
  product: ProductBinding,
  workspace: TestWorkspace,
  run: NonMutatingRunWhileHeld,
): Promise<RunResult> {
  const { context } = run;
  const lockPath = await captureLockPath(workspace.root);
  const result = await runBounded(product, workspace.root, run.argv, context);
  if (Buffer.from(result.stdoutBytes).includes(WORKSPACE_BUSY)) {
    fail(
      `${context}: ${run.busyRule} — yet its stdout carries it: ` +
        summarizeResult(result),
    );
  }
  await run.judge(result);
  if (run.holder !== undefined && run.holder.hasExited()) {
    fail(
      `${context}: ${run.held} must still hold when the command exits — its ` +
        `hold file is deleted only once the command has exited (SPEC 13.5) ` +
        `— ${await describeExit(run.holder)}`,
    );
  }
  await assertHeldState(
    workspace.root,
    { baseline: run.preInvocation, heldRuns: 1 },
    `${context}, once it has exited, against ${run.held}'s pre-invocation ` +
      `state (${run.heldNote})`,
  );
  await assertLockPathAsCaptured(
    lockPath,
    `${context}, once it has exited: the holder's entry byte-identical, name ` +
      `and content, nothing added beside it`,
  );
  return result;
}

/** The `rename` T13.5-4's `build` arm holds, and its twin holds alike. */
const T13_5_4_BUILD_ARM_RENAME: readonly string[] = [
  "rename",
  "specs/A.mdx",
  "a",
  "a2",
];

/**
 * The `build` T13.5-4 runs while that `rename` holds: under `--json`, so a
 * busy refusal would carry 14.26's code on stdout (SPEC 12.7).
 */
const T13_5_4_HELD_BUILD: readonly string[] = ["build", "--json"];

/**
 * `build` while T13.5-4's `rename` holds (TEST-SPEC T13.5-4: "`build` runs
 * during a hold too"), judged before the hold is lifted. It runs bounded and
 * is awaited while the hold stands — a `build` waiting the hold out never
 * exits there and fails diagnosed at the bound (H-8; the bound a hang guard,
 * H-10). The order is the arm's pin (§CONF-CORE's justification;
 * §VIOL-CORE-BUILDWAIT): a harness lifting the hold before it awaits
 * `build`'s exit passes a product serializing `build` behind mutating
 * commands, whose `build`, proceeding once the holder releases, still exits
 * 0. Its stdout carries no busy condition, it exits 0 — neither refused nor
 * waiting — and the `rename` still holds as it exits; once it has exited,
 * the held-state comparison against the `rename`'s pre-invocation state
 * holds — its regeneration reproducing the workspace's bytes, `.xspec/lock`
 * holding the holder's entry alone — and the inclusion check: the holder's
 * entry byte-identical, name and content, nothing added beside it (H-6;
 * SPEC 13.4: `build` acquires nothing and writes nothing at the lock path).
 * The step is `nonMutatingRunWhileHeld`'s, shared with the reads and with
 * T6.6-3's preview while held.
 */
async function buildWhileHeld(
  product: ProductBinding,
  workspace: TestWorkspace,
  holder: RunningProduct,
  preInvocation: DirectorySnapshot,
): Promise<void> {
  const context = "T13.5-4 `build --json` while the rename is held";
  await nonMutatingRunWhileHeld(product, workspace, {
    argv: T13_5_4_HELD_BUILD,
    context,
    busyRule:
      `\`build\` is never refused for a held mutating command — the stable ` +
      `code "${WORKSPACE_BUSY}" of 14.26 is the refused mutating command's ` +
      `alone (SPEC 13.5, 14.26; TEST-SPEC T14-4)`,
    judge: (result) => {
      assertExitCode(
        result,
        0,
        `${context}: \`build\` runs during a hold, exiting 0 while the hold ` +
          `stands, neither refused nor waiting the hold out (SPEC 13.5: ` +
          `every command but the mutating ones may run concurrently with ` +
          `them)`,
      );
    },
    held: "the rename",
    holder,
    preInvocation,
    heldNote:
      "its regeneration reproducing the workspace's bytes; `build` acquires " +
      "nothing and writes nothing at the lock path: SPEC 13.5, 13.4",
  });
}

/** A held `rename`'s outcome and its workspace's final state. */
interface HeldRenameEnd {
  readonly result: RunResult;
  readonly final: DirectorySnapshot;
}

/**
 * T13.5-4's `build` arm, or its twin (TEST-SPEC T13.5-4: "the `rename`, its
 * hold lifted, ends exactly as on a twin with no concurrent `build`"): on a
 * fresh CONF-CORE workspace, freshly built and valid (no refresh pending,
 * §CONF-CORE's freshness constraint), its pre-invocation state taken, `rename
 * specs/A.mdx a a2 --test-hold <path>` is held, and — on the arm, not on
 * its twin — `build` runs while it holds (buildWhileHeld), on a workspace no
 * read runs on (§VIOL-CORE-PARTIALWRITE's constraint); then the hold is
 * lifted and the `rename` must end on its own. The twin runs this same
 * sequence, the concurrent `build` alone left out — the seam used alike on
 * both sides. Returns the `rename`'s outcome and the workspace's final
 * state.
 */
async function heldRenameEnd(
  product: ProductBinding,
  concurrentBuild: boolean,
): Promise<HeldRenameEnd> {
  const context =
    "T13.5-4 held `rename specs/A.mdx a a2 --test-hold <path>` " +
    (concurrentBuild
      ? "beside a concurrent `build`"
      : "on its twin, with no concurrent `build`");
  return await withWorkspace(CORE_DECL, async (workspace) => {
    await buildOk(product, workspace, `${context}: the staging \`build\``);
    const preInvocation = await snapshotDirectory(workspace.root);
    const hold = holdPathFor(workspace, "hold-build.tmp");
    const running = await startProduct(product, {
      cwd: workspace.root,
      argv: [...T13_5_4_BUILD_ARM_RENAME, "--test-hold", hold],
    });
    try {
      await awaitHoldFile(running, hold, context);
      if (concurrentBuild) {
        await buildWhileHeld(product, workspace, running, preInvocation);
      }
      await releaseHoldFile(hold);
      let result: RunResult;
      try {
        result = await running.waitForExit();
      } catch (error) {
        rethrowHarnessError(error);
        return fail(
          `${context}: once its hold is lifted the rename must proceed and ` +
            `end on its own (SPEC 13.5; H-8: a hang is a diagnosed failure) ` +
            `— ${messageOf(error)}`,
        );
      }
      return { result, final: await snapshotDirectory(workspace.root) };
    } finally {
      running.kill();
      await releaseHoldFile(hold);
    }
  });
}

/**
 * T13.5-4's `build` during a hold, whole (TEST-SPEC T13.5-4): the arm —
 * `build` exiting 0 while the `rename` holds, judged before the lift — and
 * its twin; the twin's `rename` completes normally (an operation succeeding
 * on a freshly built valid workspace, SPEC 6.4, 13.5), and the arm's
 * `rename`, its hold lifted, ends exactly as the twin's: exit code, stdout,
 * and stderr byte-equal, and the final workspace byte-equal, the lock path
 * aside (H-6 across directories).
 */
async function buildDuringHoldArm(product: ProductBinding): Promise<void> {
  const arm = await heldRenameEnd(product, true);
  const twin = await heldRenameEnd(product, false);
  assertExitCode(
    twin.result,
    0,
    "T13.5-4 the twin's held `rename specs/A.mdx a a2 --test-hold <path>`, " +
      "with no concurrent `build`: an operation succeeding on a freshly " +
      "built valid workspace completes normally once its hold is lifted " +
      "(SPEC 6.4, 13.5)",
  );
  assertRunOutcomesEqual(
    arm.result,
    twin.result,
    "T13.5-4: the rename held beside a concurrent `build`, its hold lifted, " +
      "ends exactly as on a twin with no concurrent `build` (TEST-SPEC " +
      "T13.5-4; H-6)",
    "the rename beside the build",
    "its twin's",
  );
  assertSnapshotsEqual(
    twin.final,
    arm.final,
    "T13.5-4: the final workspace of the rename held beside a concurrent " +
      "`build` vs its twin's, with no concurrent `build` — sources, " +
      "journal, derived files, and graph data byte-equal (TEST-SPEC " +
      "T13.5-4; H-6: the lock path aside)",
  );
}

const T13_5_4 = defineProductTest({
  id: "T13.5-4",
  title:
    "while a mutating command (`rename specs/A.mdx a a2 --test-hold <path>`, on a freshly built valid workspace) is held, read commands drawn from the 13.3 read surface — no `inventory`, no preview — still run and observe the prior state: each exits 0 with stdout byte-identical to the same read's before the hold, `check --json` clean with no finding concerning the lock path, and no read's stdout carrying the busy condition's code `workspace-busy` (14.26); once each has exited, the held-state comparison holds against the rename's pre-invocation state — every path but the lock path byte-identical, `.xspec/lock` holding the holder's entry alone — and the lock path is byte-identical to its state as the read started, the holder's entry unchanged in name and content, nothing added beside it; `build` runs during a hold too — on another freshly built valid workspace while that `rename` is held, `build --json` exits 0 while the hold stands, awaited before the hold is lifted, neither refused (no `workspace-busy` on its stdout) nor waiting the hold out, so once it exits the held-state comparison still holds and the holder's entry is byte-identical, name and content, nothing added beside it; and that `rename`, its hold lifted, ends exactly as on a twin held and lifted alike with no concurrent `build` — exit code, stdout, stderr, and final workspace byte-equal, the lock path aside; non-mutating commands run concurrently with each other — a parallel build/query storm on one workspace terminates, and one final `build` resolves any derived-file inconsistency, byte-equal to a clean build, the journal included and the lock path aside (SPEC 13.5, 13.4, 14.26, 12.0, H-6)",
  run: async (product) => {
    // --- Held-phase reads: prior state; held-state comparison after each ---
    await withWorkspace(CORE_DECL, async (workspace) => {
      await buildOk(product, workspace, "T13.5-4 staging `build`");
      await expectExit(
        product,
        workspace,
        ["review", "create", "--strategy", "audit", "--name", "s"],
        0,
        "T13.5-4 staging `review create --strategy audit --name s`",
      );

      const before = new Map<string, RunResult>();
      for (const read of T13_5_4_READS) {
        const context = `T13.5-4 pre-hold ${read.what}`;
        const result = await runCli(product, workspace, read.argv);
        assertExitCode(result, 0, context);
        if (read.checkReport === true) {
          assertCleanCheckReport(
            result,
            `${context} on the freshly built valid workspace`,
          );
        }
        before.set(read.what, result);
      }
      // The held rename's pre-invocation state: the held-state comparison's
      // baseline (TEST-SPEC §13.5's preamble), taken once every pre-hold read
      // has exited.
      const preInvocation = await snapshotDirectory(workspace.root);

      const hold = holdPathFor(workspace, "hold-reads.tmp");
      const contextHeld =
        "T13.5-4 held `rename specs/A.mdx a a2 --test-hold <path>`";
      const running = await startProduct(product, {
        cwd: workspace.root,
        argv: ["rename", "specs/A.mdx", "a", "a2", "--test-hold", hold],
      });
      try {
        await awaitHoldFile(running, hold, contextHeld);
        for (const read of T13_5_4_READS) {
          const reference = before.get(read.what);
          if (reference === undefined) {
            throw new Error(`T13.5-4 internal error: no pre-hold ${read.what}`);
          }
          await readWhileHeld(
            product,
            workspace,
            read,
            reference,
            preInvocation,
          );
        }
        await releaseHoldFile(hold);
        let result: RunResult;
        try {
          result = await running.waitForExit();
        } catch (error) {
          rethrowHarnessError(error);
          return fail(
            `${contextHeld}: the held rename must complete normally once ` +
              `the hold file is deleted (SPEC 13.5) — ` +
              `${error instanceof Error ? error.message : String(error)}`,
          );
        }
        assertExitCode(
          result,
          0,
          `${contextHeld}: completes normally once its hold is lifted, so ` +
            `the held-phase observations are attributable to the hold (SPEC ` +
            `13.5)`,
        );
      } finally {
        running.kill();
        await releaseHoldFile(hold);
      }
    });

    // --- `build` during a hold; the rename's end against its twin's ---
    await buildDuringHoldArm(product);

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
        // A harness error anywhere in the storm — an exhausted capture
        // limit, a failed in-run evaluation — is the harness's own failure
        // (H-11), reported ahead of any diagnosed one.
        for (const outcome of settled) {
          if (outcome.status === "rejected") {
            rethrowHarnessError(outcome.reason);
          }
        }
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
      // two-directory style): the whole tree — sources, journal, derived
      // files, and graph data — compared, the lock path `.xspec/lock` and
      // everything under it alone left out, the exclusion the snapshot
      // compare applies across directories itself (helpers/snapshot.ts
      // `lockPathExclusion`) and reaching no further (H-6). No `check` runs
      // on either workspace (§VIOL-CORE-CHATTYREADS' staging constraint),
      // so nothing appends to the journal on either side.
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
          "is resolved, byte-equal to a clean build, the journal included " +
          "(SPEC 13.5, 12.0; H-6: the lock path .xspec/lock alone left out)",
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

// The alternating states are staged after the first `build`, so they are
// ledger records (S-9's before-any-product clause; helpers/staged-mdx.ts):
// the loop's two versions, enumerated — state two, then state one — and
// picked by the same alternation. State one is the workspace's initial
// source too, which stages the record rather than a second spelling of its
// bytes.
const T13_5_5_POLL_STATE_TWO = stagedMdx(
  "T13.5-5 specs/P.mdx in state two",
  pollSource(POLL_TEXT_TWO),
);
const T13_5_5_POLL_STATE_ONE = stagedMdx(
  "T13.5-5 specs/P.mdx in state one (the initial source; the alternation's state one)",
  pollSource(POLL_TEXT_ONE),
);

const T13_5_5 = defineProductTest({
  id: "T13.5-5",
  title:
    "a concurrent reader polling a derived file during repeated builds only ever observes prior content, complete new content, or absence-before-first-write — never a partial file (SPEC 13.5; property-style loop, TEST-SPEC 16)",
  run: async (product) => {
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          [POLL_FILE]: T13_5_5_POLL_STATE_ONE,
        },
      },
      async (workspace) => {
        const moduleAbs = workspace.path(POLL_MODULE);

        // The polling reader (helpers/path-poller.ts, shared with P-10): a
        // tight read loop over the derived file, one observation per cycle,
        // recording every distinct observed state (contents deduplicated
        // byte-exactly) and the absence bookkeeping the validation rules
        // need. It never throws — errors are recorded and diagnosed after
        // the loop (H-8).
        const poller = new PathPoller([moduleAbs]);
        poller.start();

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
            legit.set(polledStateKey({ kind: "content", bytes }), bytes);
          };

          await buildAndRecord("T13.5-5 `build` #1 (state one)");
          buildOneDoneCount = poller.cycles;
          for (let i = 0; i < POLL_ALTERNATIONS; i += 1) {
            const stateTwo = i % 2 === 0;
            await workspace.file(
              POLL_FILE,
              stateTwo ? T13_5_5_POLL_STATE_TWO : T13_5_5_POLL_STATE_ONE,
            );
            await buildAndRecord(
              `T13.5-5 \`build\` #${String(i + 2)} (state ${stateTwo ? "two" : "one"})`,
            );
          }
        } finally {
          await poller.stop();
        }

        const pollError = poller.error;
        const observationCount = poller.cycles;
        const firstContentIndex = poller.firstContentIndex(moduleAbs);
        const lastAbsentIndex = poller.lastAbsentIndex(moduleAbs);
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
        for (const [key, { state, firstIndex }] of poller.distinct(moduleAbs)) {
          if (state.kind === "absent" || legit.has(key)) continue;
          const observed = { bytes: state.bytes, firstIndex };
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
// T13.5-7 — interrupted or write-refused mutation: the pinned write order
// ---------------------------------------------------------------------------

// The refusal arms (a)–(h), their fixtures, stagings, twins, and the
// pinned-state laws live in write-refusal-staging.ts (shared with T14-9);
// this entry composes them: the rename twin once (arms (a), (b), and the
// kill arm read their expectations from it; (c)'s rename, on the rename
// fixture's emitted-Markdown variant, (e), (f), each of (g)'s byte orders,
// and each of (h)'s two operations build twins of their own), the refusal
// arms on the Linux
// leg (E-1: permission stagings are Linux-only; elsewhere they are not
// staged — the NU3_STAGED pattern of section-11.5 — and the Windows subset
// selects T13.5-7 nowhere), each ending with release's state asserted —
// (b)'s residue, the emptied lock directory its read-only `.xspec` keeps
// until a later mutating command removes it, and every other arm's absence
// of `.xspec/lock` — then the kill arm, its kills under T13.5-3's
// exit-collection discipline and the lock path after each judged by
// T13.5-3's past-the-hold machinery (helpers/lock-state.ts
// `assertLockPathAfterKill`; CERTIFICATIONS.md's Exclusions).
const T13_5_7 = defineProductTest({
  id: "T13.5-7",
  title:
    "interrupted or write-refused mutation: a write the environment refuses stops the command at that write — exit 2 with the error document (`write-failure`, the concerned path) — leaving every earlier write of 13.5's pinned per-command order complete and no later one attempted, each state read from a twin on which the same operation ran unrefused: (a) source edits first in preview `files` order, (b) the journal append as the commit point, `check` then reporting the graph-data unit form and one per-file finding for each derived path whose occupant differs from the one a `build` leaves on a copy of the stopped state, permissions restored — a set computed by comparison, never from the twin's derived files, the twin's journal holding the entry the stopped state lacks — (c) the identity effect complete once appended — the file-form move, and a rename stopped alike at its finishing regeneration's one owed Markdown write (`out/specs/b/B.md`'s creation, the file deleted beforehand), each reporting the write failure alone, no `mapping`, `impact` against the pre-operation ref reporting no change categories once restored — (d) a relocation's two writes, (e) `review` mutators writing the session file once, last, after the refresh, (f) `build` and a refresh each file complete with the order unpinned — every derived file present afterwards byte-equal either to its bytes before the invocation or to the twin's file at that path, none partial, `check` reporting exactly the derived paths whose occupant differs from the twin's, B's module certainly among them, its companions as the comparison finds them — and a refreshing read refused at its graph-data write under T14-9's graph-data staging (`.xspec` and every directory of T13.3-2's operational path set read-only, every file of it unwritable, the journal, the session directory, and the lock path keeping their modes), (g) a created target file a source edit, made in its `files` place — `move specs/a/A.mdx#x specs/n/N.mdx#x` with the empty `specs/n` unwritable leaving the origin rewritten, nothing at `specs/n/N.mdx`, and no journal entry, its error document alone, no `mapping`, `check` reporting the graph-data unit form and one per-file finding for each derived path whose occupant differs from the one a `build` leaves on a copy of the stopped state, A's module certainly among them, and, the byte order reversed (`specs/z/Z.mdx`, the creation listed first), nothing written and `check` clean — (h) a removal owed alone: emission disabled on (c)'s built workspace and `out/specs` unwritable, `build` and a held rename each stopped at `out/specs/A.md`'s refused removal, the error document alone, no `mapping`, the file byte-identical in place, the rename's source edits and journal append made, each file complete; release: (b)'s read-only `.xspec` refuses the deletion of the emptied lock directory, which remains, empty — no outcome changed, no write failure reported — until a mutating command run once the permissions are restored proceeds unrefused and removes it, and every other arm ends with `.xspec/lock` absent; the kill arm, each kill under T13.5-3's exit-collection discipline (the group killed with SIGKILL, its exit collected, and no process of it listed before `check` runs; no reuse check, no mutating command following): `check` never crashes and reports exactly a state 13.5 admits, the journal holds its prior bytes or the twin's, and the lock path is in T13.5-3's past-the-hold state — one plain-file entry, the dead run's, where the kill stopped the run short of its twin's final state (or at the held point), nothing where the run ended first (SPEC 13.5, 14.24, 12.0, 12.1, 12.7, 6.2, 6.4, 6.5, 6.7, 13.3, 13.4)",
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
// T13.5-8 — acquisition's place in the order
// ---------------------------------------------------------------------------

// The one condition the first of CONF-CORE's two failing workspaces stages —
// the source validation error TEST-SPEC T13.5-8 leaves open (CERTIFICATIONS.md
// §CONF-CORE's staging constraint on T13.5-8; the second workspace's, the
// garbage journal line, is staged below assertGateFindings): a second spec
// source beginning with a UTF-8 byte-order mark — unparseable (SPEC 1.6,
// 14.20), its finding the zero-length range at offset 0 (SPEC 14), the file
// masked and never an operand of any arm's command — added after the workspace
// was built valid and after the session the held `review resolve` names was
// created under `--strategy audit`. U+FEFF encodes to EF BB BF; the workspace
// builder writes string contents with BOMs kept (S-2). The code point is
// spelled numerically so the source carries no escape sequence to misread.
const BOM_FILE = "specs/B.mdx";
const BOM_MDX =
  String.fromCodePoint(0xfeff) + '<S id="b">\nBom content.\n</S>\n';
// Staged after the session was created, so a ledger record (S-9's
// before-any-product clause; helpers/staged-mdx.ts) — the same constant under
// the call's former `unparseable` declaration (14.20). The certification
// fixtures' grammar guard (test/self/certification-fixture-grammar.test.ts)
// stages the same bytes at the same path after a `build`, for its CONF-CORE
// rows on §CONF-CORE's failing workspace: one record per byte sequence.
// T13.5-11(a) stages it too, for the gate's refusal of `review create`
// (section-13.5-iii.ts).
export const T13_5_8_BOM = stagedMdx(
  "T13.5-8/T13.5-11 specs/B.mdx beginning with a byte-order mark (also the certification fixtures' grammar guard's CONF-CORE failing workspace)",
  BOM_MDX,
  "unparseable",
);

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

// The one condition the second of CONF-CORE's failing workspaces stages
// (TEST-SPEC T13.5-8: "and separately by that garbage journal line alone
// (14.13: a journal error is among `build`'s findings, 13.3)";
// CERTIFICATIONS.md §CONF-CORE's staging constraint on T13.5-8):
// T6.3-6(a)'s staging, a garbage line appended to the current journal —
// the journal the staging rename below wrote, the workspace's one journaled
// operation, run once the workspace was built valid and before the session
// the held `review resolve` names was created under `--strategy audit` —
// appended after that creation, as the BOM-led source is. The rename's
// subject, `g`, is a section no arm names (`rename specs/A.mdx a b` names
// `a`), so `g2` holds the leaf item the holder resolves. The line is
// deliberately structureless bytes no conforming entry format accepts —
// T6.1-3's garbage line, shape-independent (H-4): never a duplicate or
// recombination of product-written entries, whose acceptance would be
// product-dependent.
const JOURNAL_STAGING_RENAME: readonly string[] = [
  "rename",
  "specs/A.mdx",
  "g",
  "g2",
];
const JOURNAL_GARBAGE_LINE =
  "?? harness-injected garbage: not a journal entry ??";
const LF = 0x0a;

/** Lines in a line-oriented file, either final-line convention (T6.1-3). */
function journalLineCount(bytes: Uint8Array): number {
  if (bytes.length === 0) return 0;
  let count = 0;
  for (const byte of bytes) {
    if (byte === LF) count += 1;
  }
  if (bytes[bytes.length - 1] !== LF) count += 1;
  return count;
}

/**
 * Append the garbage line to the journal the staging rename wrote
 * (T6.3-6(a)'s staging, T6.1-3's shape): the journal a plain file holding
 * the one line that rename appended — staging premises, diagnosed — then
 * the garbage appended as its own line, the product's final line
 * terminated first if it left the terminator off, so the tampering is a
 * whole-line append under either line convention.
 */
async function appendJournalGarbageLine(
  workspace: TestWorkspace,
  context: string,
): Promise<void> {
  const kind = await workspace.kind(JOURNAL_PATH);
  if (kind !== "file") {
    fail(
      `${context}: staging premise — the staging \`` +
        `${JOURNAL_STAGING_RENAME.join(" ")}\` brings the journal into ` +
        `existence as a plain file at ${JOURNAL_PATH} (SPEC 6.1, 13.4); ` +
        `found ${kind}`,
    );
  }
  const journal = await workspace.readBytes(JOURNAL_PATH);
  const lines = journalLineCount(journal);
  if (lines !== 1) {
    fail(
      `${context}: staging premise — the one journaled operation yields a ` +
        `one-line journal (SPEC 6.1), so the garbage lands on line 2; found ` +
        `${String(lines)} line(s)`,
    );
  }
  const needsTerminator = journal[journal.length - 1] !== LF;
  await workspace.file(
    JOURNAL_PATH,
    Buffer.concat([
      journal,
      Buffer.from(
        (needsTerminator ? "\n" : "") + JOURNAL_GARBAGE_LINE + "\n",
        "utf8",
      ),
    ]),
  );
}

/**
 * The journal error's finding, form-exact as T6.1-3 and T6.3-6(a) pin it:
 * condition 13's stable code `journal-error`, the journal path as its
 * concerned path, and no locations — a journal condition has no in-source
 * location (SPEC 14, 12.7, 14.13). Its message's naming of the offending
 * line is T6.1-3's subject, not this test's.
 */
function assertJournalErrorFinding(
  finding: Finding,
  what: string,
  context: string,
): void {
  assertSameJson(
    { code: finding.code, path: finding.path, locations: finding.locations },
    { code: "journal-error", path: JOURNAL_PATH, locations: [] },
    `${context}: ${what} — \`code\` "journal-error", the journal path ` +
      `"${JOURNAL_PATH}" as its concerned path, and no locations (SPEC ` +
      `14.13, 14, 12.7; T6.1-3, T6.3-6) — message: ` +
      JSON.stringify(finding.message),
  );
}

/**
 * The journal-failing workspace's findings as `build` and the gate of 13.3
 * report them: exactly one finding, condition 13 — the garbage line's
 * journal error, among `build`'s findings (13.3) — form-exact
 * (assertJournalErrorFinding): the one condition the staging presents
 * (§CONF-CORE).
 */
function assertJournalGateFindings(
  findings: readonly Finding[],
  context: string,
): void {
  assertConditionCounts(
    findings,
    { "14.13": 1 },
    `${context}: exactly the one condition the journal-failing workspace ` +
      `stages — the garbage journal line's journal error (SPEC 14.13, 13.3)`,
  );
  assertJournalErrorFinding(
    findings[0]!,
    "the condition-13 finding, form-exact",
    context,
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
 * timeout) — the held-state comparison holds while held (every path but the
 * lock path byte-identical, the held run's one entry in `.xspec/lock`), the
 * command is still running after it, and only once the harness
 * deletes the hold file does it exit, with `expectedExit`, the workspace
 * then byte-identical to its pre-invocation state (the lock path aside,
 * H-6) and `.xspec/lock` gone (SPEC 13.5: release deletes the run's entry,
 * then the emptied lock directory). Returns the run for the caller's own
 * report assertions.
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
    // The held-state comparison (TEST-SPEC §13.5's preamble): the hold
    // precedes every later check and every modification, and a refused
    // invocation modifies nothing, so every path but the lock path is
    // byte-identical while held, the lock directory holding the held run's
    // one entry (SPEC 13.5).
    await assertHeldState(
      workspace.root,
      { baseline: before, heldRuns: 1 },
      `${context} while held, against the workspace before the command ` +
        `started`,
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
      rethrowHarnessError(error);
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
    await assertLockPathAbsent(
      workspace.root,
      `${context}, once it has exited`,
    );
    return result;
  } finally {
    running.kill();
    await releaseHoldFile(hold);
  }
}

/**
 * A seam-ordering run's own usage error (TEST-SPEC T13.5-8: "with their own
 * errors"): under `--json`, the 12.7 error document as the entire stdout,
 * its finding a plain usage error — `code` `null` and `path` `null` (12.7;
 * T12.7-3), never acquisition's busy refusal or write failure, whose codes
 * a product refusing at acquisition after the hold would report (`message`,
 * `locations`, and `identities` informational).
 */
function assertSeamUsageError(
  result: RunResult,
  what: string,
  context: string,
): void {
  const finding = expectErrorDocument(result, context);
  assertSameJson(
    { code: finding.code, path: finding.path },
    { code: null, path: null },
    `${context}: its own error — ${what}, a plain usage error: \`code\` ` +
      `null and \`path\` null (SPEC 12.0, 12.7) — message: ` +
      `${JSON.stringify(finding.message)}`,
  );
}

/**
 * The journal-staged baseline's own error in its seam-ordering run
 * (TEST-SPEC T13.5-8: "the journal-staged baseline's error `code`
 * `"journal-error"` with `path` `".xspec/journal"` (T6.3-6(b): the journal
 * read before the ref's resolution)"): under `--json`, the 12.7 error
 * document as the entire stdout, its finding the journal error form-exact
 * (assertJournalErrorFinding; SPEC 6.3: a given baseline's resolution reads
 * the current journal before any other cause can fail it, the error
 * reported that condition with its stable code and concerned path) — never
 * the unresolvable ref's code-less usage error, which a product resolving
 * the ref before reading the journal returns, nor acquisition's busy
 * refusal or write failure (`message` and `identities` informational).
 */
function assertSeamJournalError(result: RunResult, context: string): void {
  assertJournalErrorFinding(
    expectErrorDocument(result, context),
    "its own error, the journal error baseline resolution's journal read " +
      "meets before the ref's resolution (SPEC 6.3), never the unresolvable " +
      "ref's code-less usage error",
    context,
  );
}

// T13.5-8's acquisition-first arms: each invocation a later check refuses
// — an argument check of 12.0, baseline resolution (6.3, its journal read
// included), the item check, the gate of 13.3 (a journal error among its
// findings, 13.3), the valid-workspace precondition of `rename`/`move`
// (6.4, 6.5), the hold-file seam — runs under `--json` twice, each run
// exiting 2 and modifying nothing: once while a `review resolve` holds its
// workspace, meeting the busy refusal of 14.26, and once with no holder and
// `.xspec/lock` a symbolic link to a directory outside the workspace
// (T13.5-10(a)), meeting acquisition's write failure (14.24) — each with
// `path` `".xspec/lock"`, never the later check's outcome (SPEC 13.5, 12.0:
// acquisition's outcomes precede every later check's).

/**
 * Where an acquisition-first run meets acquisition (TEST-SPEC T13.5-8): a
 * live holder — the held `review resolve`, its entry, and the workspace's
 * state just before it started, the held-state comparison's baseline — or
 * an obstructed lock path, `.xspec/lock` a symbolic link to a directory
 * outside the workspace, as staged.
 */
type AcquisitionSetting =
  | {
      readonly kind: "held";
      readonly holder: RunningProduct;
      readonly entry: LockEntry;
      readonly baseline: DirectorySnapshot;
    }
  | { readonly kind: "obstructed"; readonly staged: StagedLeftover };

/** One acquisition-first invocation of T13.5-8. */
interface AcquisitionFirstArm {
  /** The invocation as diagnoses name it, with what its arm stages. */
  readonly what: string;
  /** What a product making the later check before acquiring returns. */
  readonly later: string;
  /** Its arguments, `--json` aside. */
  readonly argv: readonly string[];
  /**
   * A session made corrupt (unparseable bytes, T10.1-4) for this run alone:
   * corrupted just before the run, restored just after it (§CONF-CORE).
   */
  readonly corruptSession?: string;
  /** The absolute path its `--test-hold` names, a plain file occupying it. */
  readonly occupiedHoldPath?: string;
}

/**
 * The unparseable bytes a session made corrupt for one run holds (T10.1-4's
 * garbage-bytes state: no JSON document parses from them).
 */
const CORRUPT_SESSION_BYTES = "this is deliberately not a JSON document ][}{\n";

/**
 * Make the session `name` corrupt for one run (§CONF-CORE: `c` stands
 * corrupt only while the run naming it executes — no other command
 * starting and no hold lifted meanwhile — so no in-scope command but that
 * run meets it): its product-written file overwritten in place with
 * unparseable bytes. Returns the restoration, writing the file's exact
 * prior bytes back in place. Shared with T13.5-11(a)'s `resolve` and
 * `split` naming a corrupt session (section-13.5-iii.ts).
 */
export async function corruptSessionForRun(
  workspace: TestWorkspace,
  name: string,
  context: string,
): Promise<() => Promise<void>> {
  const abs = workspace.path(sessionRel(name));
  const kind = await occupantKindAt(abs);
  if (kind !== "file") {
    fail(
      `${context}: staging premise — session ${name}, created under ` +
        `\`--strategy audit\` while the workspace was valid, is a plain ` +
        `file at ${sessionRel(name)} (SPEC 10.1) before it is made ` +
        `corrupt; found ${kind}`,
    );
  }
  const original = await fsp.readFile(abs);
  await fsp.writeFile(abs, CORRUPT_SESSION_BYTES);
  return async () => {
    await fsp.writeFile(abs, original);
  };
}

/**
 * What an acquisition-first or acquisition-after run leaves of its setting
 * once it has exited and its arm's own staging is undone (TEST-SPEC
 * T13.5-8): beside a holder, the holder's entry the lock directory's only
 * one, byte-identical, and the held-state comparison holding against the
 * workspace's state before the holder started — the run neither altered
 * nor joined the holder's exclusivity; at the obstruction, the link
 * byte-identical in place and its target untouched, nothing written or
 * removed through it (T13.5-10(a); SPEC 13.4).
 */
async function assertSettingStands(
  workspace: TestWorkspace,
  setting: AcquisitionSetting,
  after: string,
  context: string,
): Promise<void> {
  if (setting.kind === "held") {
    await assertOnlyEntry(
      workspace.root,
      setting.entry,
      `${context}: after ${after}, the holder's entry`,
    );
    await assertHeldState(
      workspace.root,
      { baseline: setting.baseline, heldRuns: 1 },
      `${context}: once it has exited, the held-state comparison against ` +
        `the workspace before the holder started`,
    );
  } else {
    await assertStagingInPlace(
      setting.staged,
      `${context}: the obstruction stays in place, acquisition removing ` +
        `nothing (SPEC 13.5; T13.5-10(a))`,
    );
    await assertOutsideTargetsUntouched(
      setting.staged,
      `${context}: nothing written or removed through the link (SPEC 13.4)`,
    );
  }
}

/**
 * One acquisition-first run (TEST-SPEC T13.5-8): `arm`'s invocation under
 * `--json`, bounded (`runBounded`: a product blocking instead fails
 * diagnosed, H-8), on a workspace whose lock path `setting` occupies. It
 * exits 2 with the 12.7 error document whose one finding carries
 * acquisition's outcome — the busy refusal of 14.26 beside a live holder,
 * the write failure of 14.24 at the obstruction — with `path`
 * `".xspec/lock"` and `locations` `[]` (`message` and `identities`
 * informational, 12.7), never the later check's outcome, which a product
 * making that check before acquiring returns; and it modifies nothing, the
 * compare bracketing this run alone (§CONF-CORE's bracketing constraint;
 * the lock path left out, H-6: the run reaches acquisition, whose writes
 * and release's count as no modification), the arm's own staging made
 * before the bracket and undone after it. Beside a holder: the holder still
 * holds as the run exits (the refusal prompt, never a wait), its entry the
 * lock directory's only one, byte-identical, and — the staging undone —
 * the held-state comparison holds against the workspace's state before the
 * holder started. At the obstruction: the link byte-identical in place and
 * its target untouched, nothing written or removed through it (T13.5-10(a);
 * SPEC 13.4). An occupied `--test-hold` path keeps its occupant unchanged.
 */
async function acquisitionFirstRun(
  product: ProductBinding,
  workspace: TestWorkspace,
  setting: AcquisitionSetting,
  arm: AcquisitionFirstArm,
  where: string,
): Promise<void> {
  const held = setting.kind === "held";
  const expected = held ? WORKSPACE_BUSY : WRITE_FAILURE_CODE;
  const condition = held ? "14.26" : "14.24";
  const context =
    `T13.5-8 acquisition first: ${arm.what} --json ${where}, ` +
    (held
      ? "while the held `review resolve` holds"
      : `with no holder and ${LOCK_PATH} a symbolic link to a directory ` +
        `outside the workspace`);
  const outcome = held
    ? "the busy refusal of 14.26"
    : "acquisition's write failure (14.24)";
  const restore =
    arm.corruptSession === undefined
      ? undefined
      : await corruptSessionForRun(workspace, arm.corruptSession, context);
  try {
    const before = await snapshotDirectory(workspace.root);
    const result = await runBounded(
      product,
      workspace.root,
      [...arm.argv, "--json"],
      context,
    );
    assertExitCode(
      result,
      2,
      `${context}: acquisition precedes ${arm.later}, so its outcome is ` +
        `${outcome} — a usage error, exit 2 (SPEC 13.5, 12.0, ${condition})`,
    );
    if (setting.kind === "held" && setting.holder.hasExited()) {
      fail(
        `${context}: the holder must still hold when the refused run exits ` +
          `— the refusal is prompt, never a wait for the holder's ` +
          `exclusivity to end (SPEC 13.5) — ` +
          (await describeExit(setting.holder)),
      );
    }
    const finding = expectErrorDocument(result, context);
    assertSameJson(
      { code: finding.code, path: finding.path, locations: finding.locations },
      { code: expected, path: LOCK_PATH, locations: [] },
      `${context}: the error document carries acquisition's outcome — the ` +
        `stable code "${expected}", the concerned path "${LOCK_PATH}", and ` +
        `no locations — never ${arm.later}, which a product making that ` +
        `check before acquiring returns (SPEC 13.5, 12.0, 12.7, ` +
        `${condition}; \`message\` and \`identities\` informational) — ` +
        `message: ${JSON.stringify(finding.message)}`,
    );
    assertSnapshotsEqual(
      before,
      await snapshotDirectory(workspace.root),
      `${context}: modifies nothing — sources, journal, sessions, and ` +
        `graph data byte-identical, the compare bracketing this run alone ` +
        `(SPEC 13.5, 12.0; H-6)`,
    );
  } finally {
    if (restore !== undefined) await restore();
  }
  await assertSettingStands(workspace, setting, "the refusal", context);
  if (arm.occupiedHoldPath !== undefined) {
    await assertPlainFileHolds(
      arm.occupiedHoldPath,
      HOLD_OCCUPANT_BYTES,
      `${context}: the plain file occupying its --test-hold path stays ` +
        `byte-identical (SPEC 13.5: hold-file creation fails on an occupied ` +
        `path, never replacing the occupant)`,
    );
  }
}

// T13.5-8's acquisition-after arms: each invocation an error acquisition
// follows refuses — the syntax class of 12.0, judged from the arguments
// alone; the configuration error of 14.14, met where configuration is
// loaded; and the configuration error of a file both groups match (7.2,
// 14.14) and a refused listing (14.25), each met by the first discovery —
// runs under `--json` in the same two settings, each run exiting 2 with
// that error, never acquisition's, and modifying nothing (SPEC 13.5, 12.0:
// a mutating command acquires once its configuration is loaded and its
// sources discovered; of the configuration errors, only one the rediscovery
// alone meets follows acquisition's).

/**
 * The change one acquisition-after run is staged on (TEST-SPEC T13.5-8):
 * made just before the run — in the held setting during the hold, the
 * holder having started without it — and undone just after it, before
 * anything else starts and before any hold is lifted. T13.5-11(a) makes
 * two of them during a mutating command's own hold, undone once that
 * command has ended (section-13.5-iii.ts).
 */
export interface AcquisitionAfterStaging {
  /** Make the change; returns its undoing, restoring the prior state. */
  readonly make: (
    workspace: TestWorkspace,
    context: string,
  ) => Promise<() => Promise<void>>;
  /**
   * The change refuses the harness's own snapshot walk (a directory made
   * unlistable), so the run's modifies-nothing compare brackets the change
   * and its undoing too — which restore a directory's mode alone, never a
   * byte, and leave nothing the run might have written masked.
   */
  readonly unlistable?: true;
}

/** One acquisition-after invocation of T13.5-8. */
interface AcquisitionAfterArm {
  /** The invocation as diagnoses name it, with what its arm stages. */
  readonly what: string;
  /** The error preceding acquisition that the run meets, for diagnoses. */
  readonly error: string;
  /** Its arguments, `--json` aside. */
  readonly argv: readonly string[];
  /**
   * The error document's finding members the arm pins (SPEC 12.7; T12.7-3):
   * `code` and `path` on every arm, and `locations` `[]` where the
   * condition carries a concerned path instead of an in-source location
   * (SPEC 14; a plain usage error's locations stay unpinned, T12.7-3).
   */
  readonly finding: {
    readonly code: string | null;
    readonly path: string | null;
    readonly locations?: readonly [];
  };
  /** The change the run is staged on, where the arm stages one. */
  readonly staging?: AcquisitionAfterStaging;
}

/**
 * One acquisition-after run (TEST-SPEC T13.5-8): `arm`'s invocation under
 * `--json`, bounded (`runBounded`: a product blocking instead fails
 * diagnosed, H-8), its staging made just before it, on a workspace whose
 * lock path `setting` occupies. It exits 2 with the 12.7 error document
 * whose one finding carries the arm's own error — the syntax class, the
 * configuration error, or discovery's read failure — never acquisition's
 * busy refusal (beside a live holder) or write failure (at the
 * obstruction), which a product acquiring before the check returns; and it
 * modifies nothing, the compare bracketing this run alone (§CONF-CORE's
 * bracketing constraint; the lock path left out, H-6: a mutating
 * command's run), the staging made before the bracket and undone after it
 * — or, for a staging the snapshot walk cannot list, made and undone
 * within it. Beside a holder: the holder still holds as the run exits, and
 * — the staging undone — the setting stands (assertSettingStands).
 */
async function acquisitionAfterRun(
  product: ProductBinding,
  workspace: TestWorkspace,
  setting: AcquisitionSetting,
  arm: AcquisitionAfterArm,
  where: string,
): Promise<void> {
  const held = setting.kind === "held";
  const context =
    `T13.5-8 acquisition after: ${arm.what} --json ${where}, ` +
    (held
      ? "while the held `review resolve` holds"
      : `with no holder and ${LOCK_PATH} a symbolic link to a directory ` +
        `outside the workspace`);
  const acquisitionOutcome = held
    ? `the busy refusal of 14.26 ("${WORKSPACE_BUSY}")`
    : `acquisition's write failure (14.24, "${WRITE_FAILURE_CODE}")`;
  const outer =
    arm.staging?.unlistable === true
      ? await snapshotDirectory(workspace.root)
      : undefined;
  const undo =
    arm.staging === undefined
      ? undefined
      : await arm.staging.make(workspace, context);
  try {
    const before = outer ?? (await snapshotDirectory(workspace.root));
    const result = await runBounded(
      product,
      workspace.root,
      [...arm.argv, "--json"],
      context,
    );
    assertExitCode(
      result,
      2,
      `${context}: ${arm.error} precedes acquisition, so the run exits 2 ` +
        `with it — never ${acquisitionOutcome} (SPEC 13.5, 12.0)`,
    );
    if (setting.kind === "held" && setting.holder.hasExited()) {
      fail(
        `${context}: the holder must still hold when the run exits — the ` +
          `run meets ${arm.error} before any acquisition, never waiting ` +
          `on the holder (SPEC 13.5, 12.0) — ` +
          (await describeExit(setting.holder)),
      );
    }
    const finding = expectErrorDocument(result, context);
    assertSameJson(
      arm.finding.locations === undefined
        ? { code: finding.code, path: finding.path }
        : {
            code: finding.code,
            path: finding.path,
            locations: finding.locations,
          },
      arm.finding,
      `${context}: the error document carries ${arm.error}, never ` +
        `${acquisitionOutcome} — a mutating command acquires only once its ` +
        `configuration is loaded and its sources discovered (SPEC 13.5, ` +
        `12.0, 12.7; \`message\` and \`identities\` informational) — ` +
        `message: ${JSON.stringify(finding.message)}`,
    );
    if (outer === undefined) {
      assertSnapshotsEqual(
        before,
        await snapshotDirectory(workspace.root),
        `${context}: modifies nothing — sources, configuration, journal, ` +
          `sessions, and graph data byte-identical, the compare bracketing ` +
          `this run alone (SPEC 13.5, 12.0; H-6)`,
      );
    }
  } finally {
    if (undo !== undefined) await undo();
  }
  if (outer !== undefined) {
    assertSnapshotsEqual(
      outer,
      await snapshotDirectory(workspace.root),
      `${context}: modifies nothing — sources, configuration, journal, ` +
        `sessions, and graph data byte-identical, the compare bracketing ` +
        `this run alone with its staging and the staging's undoing, which ` +
        `restore a directory's mode alone (SPEC 13.5, 12.0; H-6)`,
    );
  }
  await assertSettingStands(workspace, setting, "the run", context);
}

/** The held `review resolve` of an acquisition arm's workspace. */
interface ResolveHolder {
  /** The item of session `s` it resolves, `--status skipped`. */
  readonly item: string;
  /** Its hold file's name in the workspace's temporary directory. */
  readonly holdName: string;
  /** Names the holder in every diagnosis. */
  readonly context: string;
  /** Its exit once lifted: 0, the resolution performed; 1, the gate's. */
  readonly exit: 0 | 1;
  /** Why it exits so, for the diagnosis. */
  readonly outcome: string;
  /**
   * Where its lifted run writes nothing (the gate turning it back, SPEC
   * 13.3): the diagnosis of the compare, once it has exited, against the
   * workspace's state before it started (the lock path aside, H-6).
   */
  readonly writesNothing?: string;
}

/**
 * Run `body` while `review resolve s <item> --status skipped --test-hold
 * <path>` holds the workspace (TEST-SPEC T13.5-8's held setting, session
 * `s` created while the workspace was valid): the workspace's state taken
 * just before the holder starts, its hold file awaited — the wait failing
 * loud, diagnosed, when the command exits without creating it — and
 * verified empty, and the held-state comparison made against that state
 * while it holds (on a valid workspace the only ground on which
 * §VIOL-CORE-EARLYWRITE, the holder's resolution written before its hold,
 * fails T13.5-8: §CONF-CORE's justification); then the hold lifted and the
 * holder awaited to exit with `holder.exit` before anything else starts
 * (§VIOL-CORE-EARLYRELEASE's passing side: no mutating command starts while
 * another run is past its release and short of its end), nothing left at
 * `.xspec/lock` (SPEC 13.5: release deletes the entry, then the emptied lock
 * directory) — and, where `holder.writesNothing` says so, the workspace
 * byte-identical to that pre-invocation state.
 */
async function whileResolveHolds(
  product: ProductBinding,
  workspace: TestWorkspace,
  holder: ResolveHolder,
  body: (setting: AcquisitionSetting) => Promise<void>,
): Promise<void> {
  const hold = holdPathFor(workspace, holder.holdName);
  const baseline = await snapshotDirectory(workspace.root);
  const running = await startProduct(product, {
    cwd: workspace.root,
    argv: [
      "review",
      "resolve",
      "s",
      holder.item,
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
      holder.exit === 1
        ? `${holder.context}: exclusivity is acquired before the gate of ` +
            `13.3, so the hold file is created before the gate turns the ` +
            `command back — a product running the gate first exits 1 there ` +
            `without ever creating it`
        : holder.context,
    );
    await assertEmptyHoldFile(hold, holder.context);
    const [entry] = await assertHeldState(
      workspace.root,
      { baseline, heldRuns: 1 },
      `${holder.context} while held, against the workspace before it started`,
    );
    if (entry === undefined) {
      throw new Error(
        "T13.5-8: assertHeldState returned no entry for one held run",
      );
    }
    await body({ kind: "held", holder: running, entry, baseline });
    await releaseHoldFile(hold);
    let result: RunResult;
    try {
      result = await running.waitForExit();
    } catch (error) {
      rethrowHarnessError(error);
      return fail(
        `${holder.context}: once its hold file is deleted the holder must ` +
          `proceed and exit (SPEC 13.5) — ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
    assertExitCode(
      result,
      holder.exit,
      `${holder.context}: once its hold is lifted, ${holder.outcome}`,
    );
    await assertLockPathAbsent(
      workspace.root,
      `${holder.context}, once it has exited`,
    );
    if (holder.writesNothing !== undefined) {
      assertSnapshotsEqual(
        baseline,
        await snapshotDirectory(workspace.root),
        `${holder.context}: ${holder.writesNothing}`,
      );
    }
  } finally {
    running.kill();
    await releaseHoldFile(hold);
  }
}

/**
 * Run `body` with no holder and `.xspec/lock` a symbolic link to a
 * directory outside the workspace holding a plain file (TEST-SPEC
 * T13.5-8's obstructed setting, staged as T13.5-10(a) stages it: acquisition
 * fails there with the write failure of 14.24, removing nothing and writing
 * nothing through the link) — staged on the area the workspace's `build`
 * made and verified as staged (helpers/lock-staging.ts) — then remove the
 * link itself, never following it, so the arms after it meet no
 * obstruction.
 */
async function withObstructedLockPath(
  workspace: TestWorkspace,
  body: (setting: AcquisitionSetting) => Promise<void>,
): Promise<void> {
  const staged = await stageLeftover(workspace, LOCK_PATH, {
    kind: "symlink",
    target: { kind: "dir" },
  });
  await body({ kind: "obstructed", staged });
  await fsp.unlink(path.join(workspace.root, LOCK_PATH));
}

/**
 * Run each arm in both of T13.5-8's settings on `workspace`: while
 * `holder` holds, then — the holder having exited — at the obstructed lock
 * path; in each setting the acquisition-first arms (`first`), then the
 * acquisition-after arms (`after`).
 */
async function acquisitionSettings(
  product: ProductBinding,
  workspace: TestWorkspace,
  holder: ResolveHolder,
  first: readonly AcquisitionFirstArm[],
  after: readonly AcquisitionAfterArm[],
  where: string,
): Promise<void> {
  const runArms = async (setting: AcquisitionSetting): Promise<void> => {
    for (const arm of first) {
      await acquisitionFirstRun(product, workspace, setting, arm, where);
    }
    for (const arm of after) {
      await acquisitionAfterRun(product, workspace, setting, arm, where);
    }
  };
  await whileResolveHolds(product, workspace, holder, runArms);
  await withObstructedLockPath(workspace, runArms);
}

/**
 * One of T13.5-8's two failing workspaces (TEST-SPEC T13.5-8: "on a
 * workspace failing `build`'s validations — by a source validation error,
 * and separately by that garbage journal line alone (14.13: a journal error
 * is among `build`'s findings, 13.3)"): CORE_DECL's workspace built valid,
 * its audit session `s` created, and only then failed by its one condition
 * (§CONF-CORE's staging constraint on T13.5-8), the BOM-led second source
 * or the garbage journal line.
 */
interface FailingWorkspace {
  /** Names the workspace in diagnoses ("on the failing workspace"). */
  readonly where: string;
  /** Names its staging's runs and premises ("T13.5-8 staging"). */
  readonly staging: string;
  /**
   * The staging's journaled operation, run once the workspace is built
   * valid and before `s` is created, where its condition needs one: the
   * rename writing the journal the garbage line joins (T6.3-6(a)'s
   * staging).
   */
  readonly journaled?: readonly string[];
  /** The scope of `s`'s leaf item, which the holder and an arm resolve. */
  readonly leafScope: string;
  /** The failing condition, as the premise's label names it. */
  readonly condition: string;
  /** Adds the failing condition, once `s` exists and its items are known. */
  readonly stage: (workspace: TestWorkspace, context: string) => Promise<void>;
  /** The one condition's findings as `build` and the gate report them. */
  readonly assertFindings: (
    findings: readonly Finding[],
    context: string,
  ) => void;
  /**
   * Whether the garbage journal line stands: then a product judging the
   * journal before acquiring returns a `journal-error` beside the gate's and
   * the precondition's exit 1, and the journal-staged baseline arms run
   * here — acquisition first and, under `--test-hold`, the seam ordering —
   * the workspace lying in no repository and inside none, H-1's
   * precondition verified before they run (§CONF-CORE's staging
   * constraint).
   */
  readonly journal: boolean;
}

/** The workspace failed by a source validation error (§CONF-CORE). */
const BOM_FAILING_WORKSPACE: FailingWorkspace = {
  where: "on the failing workspace",
  staging: "T13.5-8 staging",
  leafScope: "specs/A.mdx#g",
  condition: `${BOM_FILE} begins with a byte-order mark`,
  stage: async (workspace) => {
    await workspace.file(BOM_FILE, T13_5_8_BOM);
  },
  assertFindings: assertGateFindings,
  journal: false,
};

/** The workspace failed by the garbage journal line alone (§CONF-CORE). */
const JOURNAL_FAILING_WORKSPACE: FailingWorkspace = {
  where: "on the journal-failing workspace",
  staging: "T13.5-8 journal-failing workspace staging",
  journaled: JOURNAL_STAGING_RENAME,
  leafScope: "specs/A.mdx#g2",
  condition: `a garbage line appended to ${JOURNAL_PATH}`,
  stage: appendJournalGarbageLine,
  assertFindings: assertJournalGateFindings,
  journal: true,
};

/**
 * The acquisition-first arms on a failing workspace (TEST-SPEC T13.5-8):
 * `review create --strategy audit --name n`, `review resolve s <item>
 * --status skipped`, `rename specs/A.mdx a b`, and `move specs/A.mdx
 * specs/C.mdx` — each a mutating command valid in its own right, carrying no
 * `--test-hold` (§VIOL-CORE-NOLOCK's staging constraint) — never the gate's
 * or the precondition's exit 1 (6.5: `move`'s validation mirrors `rename`'s,
 * the valid-workspace precondition included) or, beside the garbage journal
 * line, a `journal-error`, which a product judging the gate, the
 * precondition, or the journal before acquiring returns; and, beside that
 * line, `review create --base <unresolvable-ref> --name n` never the
 * `journal-error` its baseline resolution's journal read meets first — 6.3's
 * journal read is one of baseline resolution's reads, all of which follow
 * acquisition (13.5; 12.0: the acquisition errors precede a given
 * baseline) — which a product reading the journal as it loads the
 * workspace, ahead of acquisition, returns.
 */
function failingAcquisitionFirstArms(
  item: string,
  failing: FailingWorkspace,
): readonly AcquisitionFirstArm[] {
  const orJournal = failing.journal ? " or a `journal-error` (14.13)" : "";
  const arms: AcquisitionFirstArm[] = [
    {
      what: "`review create --strategy audit --name n`",
      later: `the gate of 13.3's exit 1${orJournal}`,
      argv: ["review", "create", "--strategy", "audit", "--name", "n"],
    },
    {
      what: "`review resolve s <leaf item> --status skipped`",
      later: `the gate of 13.3's exit 1${orJournal}`,
      argv: ["review", "resolve", "s", item, "--status", "skipped"],
    },
    {
      what: "`rename specs/A.mdx a b`",
      later: `rename's valid-workspace precondition's exit 1 (6.4)${orJournal}`,
      argv: ["rename", "specs/A.mdx", "a", "b"],
    },
    {
      what: "`move specs/A.mdx specs/C.mdx`",
      later:
        "move's valid-workspace precondition's exit 1 (6.5: move's " +
        `validation mirrors rename's)${orJournal}`,
      argv: ["move", "specs/A.mdx", "specs/C.mdx"],
    },
  ];
  if (failing.journal) {
    arms.push({
      what:
        "`review create --base no-such-ref --name n` (an unresolvable " +
        "baseline, 6.3: the workspace in no repository) beside the garbage " +
        "journal line (T6.3-6(a)'s staging)",
      later:
        "the `journal-error` baseline resolution's journal read meets " +
        "first (6.3, 14.13; T6.3-6(b))",
      argv: ["review", "create", "--base", "no-such-ref", "--name", "n"],
    });
  }
  return arms;
}

/**
 * The failing-workspace arms — acquisition first, beside the held `review
 * resolve` and then at the obstructed lock path, then the seam ordering —
 * on one workspace built valid, its audit session created, and only then
 * failed by `failing`'s condition (§CONF-CORE): the gate writes nothing on
 * it (SPEC 13.3), so every command here starts where no refresh is pending
 * (§VIOL-CORE-EARLYREFRESH's passing side). The `build` that establishes
 * the failing workspace runs outside every bracket and before anything is
 * held (§CONF-CORE's staging constraint, which §VIOL-CORE-READERENTRY's and
 * §VIOL-CORE-BUILDWAIT's passing sides lean on; §VIOL-CORE-CHATTYREADS,
 * appending at `check` alone, appends nothing there). Where the garbage
 * journal line stands, the journal-staged baseline runs too, H-1's
 * precondition verified first (§CONF-CORE's staging constraint).
 */
async function failingWorkspaceArms(
  product: ProductBinding,
  failing: FailingWorkspace,
): Promise<void> {
  const { where, staging } = failing;
  await withWorkspace(CORE_DECL, async (workspace) => {
    await buildOk(product, workspace, `${staging} \`build\``);
    if (failing.journaled !== undefined) {
      await expectExit(
        product,
        workspace,
        failing.journaled,
        0,
        `${staging} \`${failing.journaled.join(" ")}\` (the journaled ` +
          `operation writing the journal the garbage line joins, SPEC 6.1)`,
      );
    }
    await expectExit(
      product,
      workspace,
      ["review", "create", "--strategy", "audit", "--name", "s"],
      0,
      `${staging} \`review create --strategy audit --name s\``,
    );
    const status = await sessionStatus(product, workspace, "s", staging);
    const leafItem = requireRowByScope(
      status,
      failing.leafScope,
      `${staging} (leaf item)`,
    );

    // The workspace now fails `build`'s validations: the staging premise,
    // established through `build --json` itself — exit 1, exactly the one
    // condition staged — before any command is held and outside every
    // bracket.
    await failing.stage(workspace, staging);
    const premise =
      `${staging} premise \`build --json\` ${where} ` +
      `(${failing.condition})`;
    failing.assertFindings(
      await buildFindings(product, workspace, premise),
      premise,
    );
    if (failing.journal) {
      // H-1's precondition before the journal-staged baseline arms
      // (§CONF-CORE's staging constraint: a workspace in no repository and
      // inside none).
      await assertSelfContainedRoot(
        product,
        workspace.root,
        `${staging} (\`review create --base <unresolvable-ref>\` beside ` +
          `the garbage journal line)`,
      );
    }

    // Acquisition first on the failing workspace (SPEC 13.5, 12.0: the
    // busy refusal and acquisition's write failure precede the gate's
    // findings, the precondition's, and a given baseline's resolution): the
    // holder is `review resolve s <leaf item> --status skipped --test-hold
    // <path>` — exclusivity is acquired before the gate of 13.3, so it holds
    // rather than exiting 1 at the gate, writing nothing (13.3) — and each
    // arm's command is refused exit 2 while it holds, `code`
    // `"workspace-busy"`, and then, the holder having exited, with
    // `.xspec/lock` a symbolic link to an outside directory, `code`
    // `"write-failure"` (failingAcquisitionFirstArms) — each modifying
    // nothing, the compare bracketing each refused run alone (§CONF-CORE,
    // §VIOL-CORE-EARLYWRITE).
    await acquisitionSettings(
      product,
      workspace,
      {
        item: leafItem.id,
        holdName: "hold-resolve.tmp",
        context:
          "T13.5-8 holder `review resolve s <leaf item> --status skipped " +
          `--test-hold <path>\` ${where}`,
        exit: 1,
        outcome:
          "the gate of 13.3 turns it back with the failing workspace's " +
          "findings, exit 1 (SPEC 13.3, 13.5)",
        writesNothing:
          "the gate writes nothing — the workspace byte-identical to its " +
          "state before the holder started, the session file unchanged, no " +
          "refresh on a failing workspace, the lock path aside (SPEC 13.3, " +
          "13.5; H-6)",
      },
      failingAcquisitionFirstArms(leafItem.id, failing),
      [],
      where,
    );

    if (failing.journal) {
      // Seam ordering beside the garbage journal line (SPEC 13.5, 6.3: a
      // given baseline's resolution, whose first read is the current
      // journal's, follows acquisition): with no other holder and no
      // obstruction, `review create --base no-such-ref --name n` creates the
      // hold file first, the held-state comparison holding while it holds,
      // and only after the hold's deletion exits 2 with the journal error,
      // never the unresolvable ref's code-less error (T6.3-6(b): the
      // journal read before the ref's resolution), creating no session.
      const journalContext =
        "T13.5-8 (seam ordering: `review create --base no-such-ref --name n " +
        "--json --test-hold <path>`, an unresolvable baseline beside the " +
        `garbage journal line, ${where})`;
      assertSeamJournalError(
        await refusedSeamArm(
          product,
          workspace,
          [
            "review",
            "create",
            "--base",
            "no-such-ref",
            "--name",
            "n",
            "--json",
          ],
          "hold-base-journal.tmp",
          2,
          journalContext,
          "exclusivity is acquired, and the hold engaged, before baseline " +
            "resolution, whose first read is the current journal's — a " +
            "journal error there fails it as a usage error carrying " +
            "condition 13's stable code and concerned path (6.3)",
        ),
        journalContext,
      );
    }

    // Seam ordering at the gate (SPEC 13.3: for a mutating `review`
    // subcommand, exclusivity acquisition precedes the gate's report; 13.5):
    // with no other holder, `review create --strategy audit --name n` on the
    // failing workspace creates the hold file first, the held-state
    // comparison holding while it holds, and only after the hold's deletion
    // exits 1 with the gate's finding — the one condition staged — creating
    // no session.
    const gateContext =
      "T13.5-8 (seam ordering at the gate: `review create --strategy audit " +
      `--name n --json --test-hold <path>\` ${where})`;
    const gateResult = await refusedSeamArm(
      product,
      workspace,
      ["review", "create", "--strategy", "audit", "--name", "n", "--json"],
      "hold-gate.tmp",
      1,
      gateContext,
      "exclusivity is acquired before the gate of 13.3",
    );
    failing.assertFindings(
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

// The valid workspace of T13.5-8's acquisition arms and seam ordering
// (TEST-SPEC T13.5-8; §CONF-CORE's scope: no code group but in T13.5-8's
// workspaces, as its wrong-kind and first-discovery arms stage one):
// CORE_DECL's source and a second spec source under `specs/sub`, the
// discovered directory the read-failure arm makes unlistable (T14-10(g)'s
// staging), configured as T13.5-12(d)'s — the spec group matches
// `specs/**/*.mdx` and `src/*.mdx`, the code group every file directly under
// `src`, so both match any `.mdx` path directly under `src`, a path nothing
// occupies until the first-discovery arm creates `src/both.mdx` there (7.2:
// a file both match is a configuration error, 14.14). The code group
// discovers `src/c.ts`, the wrong-kind origin — well-formed TypeScript
// (14.20) spelling no marker, `text` call, or module-linking form whose
// specifier names a spec module (SPEC 4, 14.15): a discovered code source,
// an edgeless whole-file code location (4.6), so nothing in scope presents
// a finding (§CONF-CORE's staging constraint). Every file here is staged in
// a workspace created after the body's first product invocation, or by an
// arm after one, so each is a staged-source record S-9 judges before any
// product exists (helpers/staged-ts.ts, helpers/staged-mdx.ts; S-9's timing
// clause). T13.5-11(a) stages the same workspace, session-staged, for its
// failures past acquisition, making the same two changes during a mutating
// command's hold instead, where the rediscovery meets them
// (section-13.5-iii.ts; TEST-SPEC T13.5-12(d), (e)); T13.5-12 stages it for
// every arm, those two changes during each command's hold among them
// (section-13.5-iv.ts); and T14-10 stages it, session-staged, for arm (i)'s
// second-discovery arm, `specs/sub` made unlistable during a hold
// (section-14-ii.ts).
export const CONFIG_PATH = "xspec.config.ts";
const CODE_SOURCE_PATH = "src/c.ts";
export const SUB_DIR = "specs/sub";
export const DOUBLY_MATCHED_PATH = "src/both.mdx";
const T13_5_8_CONFIG = stagedTs(
  "T13.5-8/T13.5-11/T13.5-12/T14-10 xspec.config.ts — one spec group and one code group, both matching the unoccupied src/*.mdx paths (T13.5-12(d)'s configuration), the code group discovering src/c.ts",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx", "src/*.mdx"]
  },
  code: {
    app: ["src/*"]
  }
})
`,
);
const T13_5_8_INVALID_CONFIG = stagedTs(
  "T13.5-8 xspec.config.ts made invalid by an unknown top-level key (14.14; the acquisition-after arm's staging, §CONF-CORE's constraint)",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx", "src/*.mdx"]
  },
  code: {
    app: ["src/*"]
  },
  bogus: true
})
`,
);
const T13_5_8_CODE_SOURCE = stagedTs(
  "T13.5-8/T13.5-11/T13.5-12/T14-10 src/c.ts — a discovered code source spelling no marker, text call, or specifier naming a spec module (the wrong-kind origin of T13.5-8's acquisition-first arms' rename and move and of its seam-ordering move)",
  "export const c = 1\n",
);
const T13_5_8_SUB_SOURCE = stagedMdx(
  "T13.5-8/T13.5-11/T13.5-12/T14-10 specs/sub/S.mdx (the source under specs/sub, the discovered directory T13.5-8's acquisition-after read-failure arm, and T13.5-11(a)'s, T13.5-12(e)'s, and T14-10(i)'s read failures past acquisition during a hold, make unlistable)",
  ['<S id="sub">', "Sub text.", "</S>", ""].join("\n"),
);
const T13_5_8_DOUBLY_MATCHED = stagedMdx(
  "T13.5-8/T13.5-11/T13.5-12 src/both.mdx (created at a path both groups match: T13.5-8's acquisition-after configuration error, met by the first discovery, and T13.5-11(a)'s and T13.5-12(d)'s, created during a hold and met by the rediscovery)",
  ['<S id="both">', "Both text.", "</S>", ""].join("\n"),
);
export const ACQUISITION_DECL: WorkspaceDecl = {
  files: {
    [CONFIG_PATH]: T13_5_8_CONFIG,
    "specs/A.mdx": CORE_A_STAGED,
    [`${SUB_DIR}/S.mdx`]: T13_5_8_SUB_SOURCE,
    [CODE_SOURCE_PATH]: T13_5_8_CODE_SOURCE,
  },
};

/**
 * The item ID `review resolve s <unknown-item>` names: harness-prefixed, and
 * checked absent from `s` before it is named (a staging premise).
 */
const NO_SUCH_ITEM = "xspec-harness-no-such-item";

/**
 * The acquisition-first arms on a valid workspace (TEST-SPEC T13.5-8), each
 * an invocation a later check refuses — the checks whose inputs exist
 * before acquisition (the old or origin ID among the parsed sources, the
 * profile against the loaded configuration, the origin's kind against the
 * first discovery, the baseline), which a product making them as soon as
 * those inputs exist returns (12.0: for a mutating command, acquisition's
 * errors precede the unknown and wrong-kind names and files of the usage
 * class); the item check, consulting the session's content (12.0); and the
 * hold-file seam's own usage error. `cItem` is an item of session `c`, made
 * corrupt for its arm's run alone; `occupied` is the plain file occupying
 * the last arm's `--test-hold` path.
 */
function validAcquisitionFirstArms(
  cItem: string,
  occupied: string,
): readonly AcquisitionFirstArm[] {
  return [
    {
      what: "`rename specs/A.mdx nope x` (a nonexistent old ID, 12.0)",
      later: "the unknown-ID usage error (`code` `null`)",
      argv: ["rename", "specs/A.mdx", "nope", "x"],
    },
    {
      what: "`move specs/A.mdx#nope specs/B.mdx#x` (a nonexistent origin ID, 6.5)",
      later: "the unknown-ID usage error (`code` `null`)",
      argv: ["move", "specs/A.mdx#nope", "specs/B.mdx#x"],
    },
    {
      what:
        "`review create --base no-such-ref --name n` (an unresolvable " +
        "baseline, 6.3: the workspace in no repository)",
      later: "the baseline error (`code` `null`)",
      argv: ["review", "create", "--base", "no-such-ref", "--name", "n"],
    },
    {
      what: "`review create --coverage nope --name n` (an unknown profile)",
      later: "the unknown-profile usage error (`code` `null`)",
      argv: ["review", "create", "--coverage", "nope", "--name", "n"],
    },
    {
      what: `\`rename ${CODE_SOURCE_PATH} a b\` (a discovered code source, a wrong-kind origin, 6.4)`,
      later: "the wrong-kind usage error (`code` `null`)",
      argv: ["rename", CODE_SOURCE_PATH, "a", "b"],
    },
    {
      what: `\`move ${CODE_SOURCE_PATH} specs/C.mdx\` (a discovered code source, a wrong-kind origin, 6.5)`,
      later: "the wrong-kind usage error (`code` `null`)",
      argv: ["move", CODE_SOURCE_PATH, "specs/C.mdx"],
    },
    {
      what: "`review resolve s <unknown item> --status skipped`",
      later: "the unknown-item usage error (`code` `null`)",
      argv: ["review", "resolve", "s", NO_SUCH_ITEM, "--status", "skipped"],
    },
    {
      what:
        "`review resolve c <item> --status skipped` (session `c` made " +
        "corrupt for this run alone, unparseable bytes, T10.1-4)",
      later:
        "the unknown-item usage error (`code` `null`) or the corruption's " +
        "exit 1 (14.21)",
      argv: ["review", "resolve", "c", cItem, "--status", "skipped"],
      corruptSession: "c",
    },
    {
      what:
        "`rename specs/A.mdx a a2 --test-hold <path>` (its hold path " +
        "already occupied by a plain file)",
      later: "the hold-file usage error (`code` `null`)",
      argv: ["rename", "specs/A.mdx", "a", "a2", "--test-hold", occupied],
      occupiedHoldPath: occupied,
    },
  ];
}

/**
 * The configuration file made invalid for one run — by an unknown key in
 * its top-level object (§CONF-CORE's staging constraint; 7, 14.14) — and
 * restored after it to the record the workspace was staged from.
 */
const INVALID_CONFIGURATION: AcquisitionAfterStaging = {
  make: async (workspace) => {
    await workspace.file(CONFIG_PATH, T13_5_8_INVALID_CONFIG);
    return async () => {
      await workspace.file(CONFIG_PATH, T13_5_8_CONFIG);
    };
  },
};

/**
 * A file created for one run at a path both groups match (T13.5-12(d)'s
 * configuration) — nothing occupying it before, a staging premise checked
 * here, so in the held setting the holder started with the path unoccupied
 * — and deleted after it. Shared with T13.5-11(a) (section-13.5-iii.ts)
 * and T13.5-12(d) (section-13.5-iv.ts), which create it during a mutating
 * command's hold: the configuration error the rediscovery meets.
 */
export const DOUBLY_MATCHED_FILE: AcquisitionAfterStaging = {
  make: async (workspace, context) => {
    const abs = workspace.path(DOUBLY_MATCHED_PATH);
    const kind = await occupantKindAt(abs);
    if (kind !== "absent") {
      fail(
        `${context}: staging premise — nothing occupies ` +
          `${DOUBLY_MATCHED_PATH}, the path both groups match, before the ` +
          `arm creates a file there (T13.5-12(d)'s configuration); found ` +
          `${kind}`,
      );
    }
    await workspace.file(DOUBLY_MATCHED_PATH, T13_5_8_DOUBLY_MATCHED);
    return async () => {
      await fsp.unlink(abs);
    };
  },
};

/**
 * `specs/sub` — a directory the discovery of 7 lists under the glob
 * `specs/**\/*.mdx` — made unlistable for one run (T14-10(g)'s staging:
 * mode 0o100, its search permission kept, verified on the harness's own
 * process first, E-1; a privileged runner is a harness error, H-11) and
 * its mode restored after it. Shared with T13.5-11(a) (section-13.5-iii.ts),
 * T13.5-12(e) (section-13.5-iv.ts), and T14-10(i) (section-14-ii.ts), which
 * make it unlistable during a mutating command's hold: a read failure past
 * acquisition, met by the rediscovery.
 */
export const UNLISTABLE_SUB_DIR: AcquisitionAfterStaging = {
  make: async (workspace) => {
    const staging = await stageReadRefusalOfDirectory(workspace.path(SUB_DIR));
    return async () => {
      await staging.restore();
    };
  },
  unlistable: true,
};

/**
 * The acquisition-after arms (TEST-SPEC T13.5-8), each an invocation an
 * error acquisition follows refuses — never acquisition's error: a surplus
 * operand, the syntax class of 12.0, judged from the arguments alone; the
 * configuration made invalid, the configuration error of 14.14 met where
 * configuration is loaded; a file created at a path both groups match, the
 * configuration error the first discovery meets (7.2, 14.14; 12.0: of the
 * configuration errors, only one the rediscovery alone meets follows
 * acquisition's, T13.5-12(d)), which fails a product checking for such a
 * file only once it has acquired; and a discovered directory made
 * unlistable, discovery's read failure (14.25; T14-10(g)). The staged arms
 * run `rename specs/A.mdx a b`, performable on the workspace as it stands
 * unstaged, so the staged change is the run's one defect.
 */
function acquisitionAfterArms(): readonly AcquisitionAfterArm[] {
  const performable = ["rename", "specs/A.mdx", "a", "b"];
  return [
    {
      what: "`rename specs/A.mdx a b c` (a surplus operand)",
      error: "the syntax-class usage error (12.0)",
      argv: ["rename", "specs/A.mdx", "a", "b", "c"],
      finding: { code: null, path: null },
    },
    {
      what:
        `\`rename specs/A.mdx a b\` with ${CONFIG_PATH} made invalid by an ` +
        `unknown top-level key`,
      error:
        "the configuration error of 14.14, concerning the configuration " +
        "file",
      argv: performable,
      finding: {
        code: "configuration-error",
        path: CONFIG_PATH,
        locations: [],
      },
      staging: INVALID_CONFIGURATION,
    },
    {
      what:
        `\`rename specs/A.mdx a b\` with ${DOUBLY_MATCHED_PATH} created, a ` +
        `path both the spec group and the code group match`,
      error:
        "the configuration error of a file both groups match (7.2, 14.14), " +
        "met by the first discovery and concerning the configuration file " +
        "(T12.7-3)",
      argv: performable,
      finding: {
        code: "configuration-error",
        path: CONFIG_PATH,
        locations: [],
      },
      staging: DOUBLY_MATCHED_FILE,
    },
    {
      what:
        `\`rename specs/A.mdx a b\` with ${SUB_DIR} made unlistable (mode ` +
        `0o100, T14-10(g)'s staging)`,
      error: `discovery's read failure (14.25) at ${SUB_DIR}`,
      argv: performable,
      finding: { code: "read-failure", path: SUB_DIR, locations: [] },
      staging: UNLISTABLE_SUB_DIR,
    },
  ];
}

/**
 * The acquisition-first and acquisition-after arms on a valid workspace
 * (TEST-SPEC T13.5-8): a freshly built ACQUISITION_DECL workspace lying in
 * no repository (§CONF-CORE's staging constraint on the baseline arm: every
 * ref is unresolvable there, whatever its spelling), holding the audit
 * sessions `s` and `c`, each created while it was valid, their items
 * learned by reads before anything is held (§CONF-CORE: no `build` or read
 * inside a bracket, during a hold, or while a lock directory stands — the
 * quiet §VIOL-CORE-CHATTYREADS's, §VIOL-CORE-READERENTRY's, and
 * §VIOL-CORE-BUILDWAIT's passing sides lean on); then each arm beside the
 * held `review resolve s <leaf item> --status skipped`, which, the
 * workspace freshly built with no refresh pending (§CONF-CORE's freshness
 * constraint) and every acquisition-after staging undone before its hold
 * is lifted, resolves once lifted, exit 0; then each arm again at the
 * obstructed lock path.
 */
async function validWorkspaceAcquisitionArms(
  product: ProductBinding,
): Promise<void> {
  await withWorkspace(ACQUISITION_DECL, async (workspace) => {
    const label = "T13.5-8 acquisition-arm staging (valid workspace)";
    await buildOk(product, workspace, `${label} \`build\``);
    for (const name of ["s", "c"]) {
      await expectExit(
        product,
        workspace,
        ["review", "create", "--strategy", "audit", "--name", name],
        0,
        `${label} \`review create --strategy audit --name ${name}\``,
      );
    }
    const sStatus = await sessionStatus(product, workspace, "s", label);
    const sLeaf = requireRowByScope(
      sStatus,
      "specs/A.mdx#g",
      `${label} (s's leaf item)`,
    ).id;
    if (sStatus.items.some((row) => row.id === NO_SUCH_ITEM)) {
      fail(
        `${label}: staging premise — the item ID ${NO_SUCH_ITEM} names no ` +
          `item of session s, so \`review resolve s ${NO_SUCH_ITEM}\` names ` +
          `an unknown item; s holds ` +
          JSON.stringify(sStatus.items.map((row) => row.id)),
      );
    }
    const cItem = requireRowByScope(
      await sessionStatus(product, workspace, "c", label),
      "specs/A.mdx#g",
      `${label} (c's leaf item)`,
    ).id;
    // H-1's precondition before the baseline arm (§CONF-CORE's staging
    // constraint: a workspace in no repository and inside none).
    await assertSelfContainedRoot(
      product,
      workspace.root,
      `${label} (\`review create --base <unresolvable-ref>\`)`,
    );
    const occupied = holdPathFor(workspace, "hold-occupied.tmp");
    await fsp.writeFile(occupied, HOLD_OCCUPANT_BYTES, { flag: "wx" });
    await acquisitionSettings(
      product,
      workspace,
      {
        item: sLeaf,
        holdName: "hold-resolve-valid.tmp",
        context:
          "T13.5-8 holder `review resolve s <leaf item> --status skipped " +
          "--test-hold <path>` on the valid workspace",
        exit: 0,
        outcome:
          "it resolves the item on the valid workspace, exit 0 — so the " +
          "refusals while it held are attributable to it alone (SPEC 13.5)",
      },
      validAcquisitionFirstArms(cItem, occupied),
      acquisitionAfterArms(),
      "on the valid workspace",
    );
  });
}

/** One seam-ordering invocation of T13.5-8 that a usage-class check refuses. */
interface SeamOrderingArm {
  /** Its arguments, `--json` and `--test-hold` aside. */
  readonly argv: readonly string[];
  /** What it names that the check refuses, for diagnoses. */
  readonly why: string;
  /** The check's ordering against acquisition and the hold. */
  readonly ordering: string;
  /** Its own error, for diagnoses. */
  readonly error: string;
  /** Its hold file's name in the workspace's temporary directory. */
  readonly holdName: string;
}

/**
 * The seam-ordering invocations a check of the usage class refuses
 * (TEST-SPEC T13.5-8): the unknown and wrong-kind names and files of 12.0
 * and baseline resolution (6.3) — each judged after acquisition and the
 * hold, so each creates the hold file first, which a product judging it
 * before acquiring exclusivity, or creating its hold file only once it has
 * passed, never does (§VIOL-CORE-LATEHOLD). The fifth, the baseline arm
 * again beside the garbage journal line, its journal read refusing it, runs
 * on the journal-failing workspace (failingWorkspaceArms).
 */
const SEAM_ORDERING_USAGE_ARMS: readonly SeamOrderingArm[] = [
  {
    argv: ["rename", "specs/A.mdx", "nope", "x"],
    why: "a nonexistent old ID",
    ordering:
      "exclusivity is acquired, and the hold engaged, before the argument " +
      "checks of 12.0 — a nonexistent old ID's usage error (6.4)",
    error: "the nonexistent old ID's usage error (12.0, 6.4)",
    holdName: "hold-nope.tmp",
  },
  {
    argv: ["review", "create", "--base", "no-such-ref", "--name", "n"],
    why: "an unresolvable baseline, the workspace in no repository",
    ordering:
      "exclusivity is acquired, and the hold engaged, before baseline " +
      "resolution — a baseline that cannot be read is a usage error (6.3)",
    error: "the unreadable baseline's usage error (6.3, 12.0)",
    holdName: "hold-base.tmp",
  },
  {
    argv: ["review", "create", "--coverage", "nope", "--name", "n"],
    why: "an unknown profile, none configured",
    ordering:
      "exclusivity is acquired, and the hold engaged, before the profile " +
      "is judged against the loaded configuration — an unknown profile's " +
      "usage error (12.0)",
    error: "the unknown profile's usage error (12.0)",
    holdName: "hold-coverage.tmp",
  },
  {
    argv: ["move", CODE_SOURCE_PATH, "specs/C.mdx"],
    why: `a wrong-kind origin, ${CODE_SOURCE_PATH} a discovered code source`,
    ordering:
      "exclusivity is acquired, and the hold engaged, before the origin's " +
      "kind is judged against the discovered sources — a wrong-kind " +
      "origin's usage error (6.5, 12.0)",
    error: "the wrong-kind origin's usage error (6.5, 12.0)",
    holdName: "hold-wrong-kind.tmp",
  },
];

/**
 * The valid-workspace arms: the seam ordering of the usage class's unknown
 * and wrong-kind names and files (12.0) and of baseline resolution (6.3),
 * then the non-mutating boundary of 6.6 — each refused invocation started
 * on a freshly built ACQUISITION_DECL workspace, its code group discovering
 * the wrong-kind origin, with no refresh pending (§CONF-CORE's freshness
 * constraint) that lies in no repository and inside none, H-1's
 * precondition verified before the baseline arm runs (§CONF-CORE's staging
 * constraint on it: every ref is unresolvable there, whatever its
 * spelling).
 */
async function validWorkspaceArms(product: ProductBinding): Promise<void> {
  await withWorkspace(ACQUISITION_DECL, async (workspace) => {
    await buildOk(
      product,
      workspace,
      "T13.5-8 staging `build` (valid workspace)",
    );
    // H-1's precondition before the baseline arm (§CONF-CORE's staging
    // constraint: a workspace in no repository and inside none).
    await assertSelfContainedRoot(
      product,
      workspace.root,
      "T13.5-8 (seam ordering: `review create --base <unresolvable-ref>`)",
    );

    // Each invocation a usage-class check refuses, under `--json` and
    // `--test-hold` with no other holder and no obstruction: the hold file
    // created first, the held-state comparison holding while held, and only
    // after the hold's deletion exit 2 with its own usage error — `code`
    // `null` — the workspace then byte-identical to its pre-invocation
    // state, `.xspec/lock` gone (refusedSeamArm).
    for (const arm of SEAM_ORDERING_USAGE_ARMS) {
      const context =
        `T13.5-8 (seam ordering: \`${arm.argv.join(" ")} --json ` +
        `--test-hold <path>\`, ${arm.why})`;
      assertSeamUsageError(
        await refusedSeamArm(
          product,
          workspace,
          [...arm.argv, "--json"],
          arm.holdName,
          2,
          context,
          arm.ordering,
        ),
        arm.error,
        context,
      );
    }

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
    "acquisition's place in the order (SPEC 13.5, 12.0): once configuration is loaded and sources discovered, before every later check — each acquisition-first invocation, run under `--json` once while `review resolve s <item> --status skipped --test-hold <path>` holds its workspace (an `audit` session `s` created while the workspace was valid; the held-state comparison holding against the workspace before the holder started, while it holds and after each run) and once with no holder and `.xspec/lock` a symbolic link to a directory outside the workspace (the link byte-identical in place and its target untouched after each run), exits 2 promptly with the error document's `code` `\"workspace-busy\"` beside the holder — the holder still holding, its entry the lock directory's only one, byte-identical — and `\"write-failure\"` at the obstruction, each with `path` `\".xspec/lock\"` and `locations` `[]`, modifying nothing (the compare bracketing each run alone), never the later check's outcome: on a valid workspace lying in no repository, whose code group discovers `src/c.ts`, `rename specs/A.mdx nope x` (a nonexistent old ID) and `move specs/A.mdx#nope specs/B.mdx#x` (a nonexistent origin ID) never the unknown-ID usage error, `review create --base <unresolvable-ref> --name n` never the baseline error, `review create --coverage nope --name n` never the unknown-profile usage error, `rename src/c.ts a b` and `move src/c.ts specs/C.mdx` (a wrong-kind origin) never the wrong-kind usage error (`code` `null` each), `review resolve s <unknown-item> --status skipped` never the unknown-item usage error, `review resolve c <item> --status skipped` (session `c` made corrupt — unparseable bytes — for that run alone) never the unknown-item usage error or the corruption's exit 1 (14.21), and `rename specs/A.mdx a a2 --test-hold <occupied path>` never the hold-file usage error, its occupant unchanged; on each of two workspaces failing `build`'s validations — by a second spec source beginning with a byte-order mark (14.20), and separately by a garbage line appended to the journal a staging `rename specs/A.mdx g g2` wrote (T6.3-6(a)'s staging, 14.13), each added after the valid `build` and `s`'s creation — `review create --strategy audit --name n`, `review resolve s <item> --status skipped`, `rename specs/A.mdx a b`, and `move specs/A.mdx specs/C.mdx` never the gate's or the precondition's exit 1 or a `journal-error`, and, beside the garbage journal line on a workspace lying in no repository, `review create --base <unresolvable-ref> --name n` never the `journal-error` its baseline resolution's journal read meets first, each holder turned back by the gate once lifted, exit 1, writing nothing; each acquisition-after invocation, run on the valid workspace in the same two settings, exits 2 with its own error, never acquisition's, modifying nothing, the holder still holding and the setting standing as above: `rename specs/A.mdx a b c` (a surplus operand) the syntax-class usage error (`code` and `path` `null`), and `rename specs/A.mdx a b` with `xspec.config.ts` made invalid by an unknown top-level key `code` `\"configuration-error\"` at `xspec.config.ts`, with `src/both.mdx` created at a path both the spec and the code group match (T13.5-12(d)'s configuration; in the held setting during the hold, the holder having started with the path unoccupied) `code` `\"configuration-error\"` at the configuration file's path `xspec.config.ts`, and with `specs/sub` made unlistable (mode 0o100, verified on the harness) `code` `\"read-failure\"` at `specs/sub` (`locations` `[]` each) — each staged change made just before its run and undone before the holder's hold is lifted; each holder awaited to exit, `.xspec/lock` then absent, before the next mutating command; under `--test-hold` with no other holder and no obstruction, `rename specs/A.mdx nope x` (a nonexistent old ID, 12.0), `review create --base <unresolvable-ref> --name n` (6.3, the workspace in no repository), that `review create` again beside the garbage journal line (6.3's journal read, on the journal-failing workspace), `review create --coverage nope --name n` (an unknown profile), and `move src/c.ts specs/C.mdx` (a wrong-kind origin), each under `--json`, and, on each failing workspace, `review create --strategy audit --name n` (13.3's gate) each create the hold file first — the wait failing loud when the command exits without creating it — the held-state comparison holding while held (every workspace path but the lock path `.xspec/lock` byte-identical, `.xspec/lock` holding the held run's one entry), and exit 2, 2, 2, 2, 2, and 1 with their own usage error (`code` `null`, `path` `null`), the journal-staged baseline's `code` `\"journal-error\"` with `path` `\".xspec/journal\"` and `locations` `[]` (the journal read before the ref's resolution), or the condition-20 or condition-13 finding only after the hold's deletion, nothing modified and `.xspec/lock` then gone; the non-mutating boundary: `rename specs/A.mdx nope x --preview` exits 2 at once acquiring nothing, and `--test-hold` beside `--preview` is exit 2 creating no hold file (SPEC 13.5, 13.3, 12.0, 12.7, 7, 7.2, 6.3, 6.4, 6.5, 6.6, 10.1, 14.13, 14.14, 14.24, 14.25, 14.26, 14)",
  run: async (product) => {
    await failingWorkspaceArms(product, BOM_FAILING_WORKSPACE);
    await validWorkspaceAcquisitionArms(product);
    await validWorkspaceArms(product);
    // The journal-failing workspace's arms run last: a test ends at its
    // first failing arm, so a product failing one of them hides no other.
    await failingWorkspaceArms(product, JOURNAL_FAILING_WORKSPACE);
  },
});

export const section135Tests: readonly ProductTestEntry[] = [
  T13_5_1,
  T13_5_2,
  T13_5_3,
  T13_5_4,
  T13_5_5,
  T13_5_7,
  T13_5_8,
];
