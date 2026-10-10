// The lock path's state as the tests inspect it: the held-state comparison
// and the lock-state assertions, as shared machinery (TEST-SPEC §13.5's
// preamble, H-4, H-6; SPEC 13.4, 13.5; CERTIFICATIONS.md: CONF-CORE's
// justification — both halves of the held-state comparison, its byte half
// excluding the lock path alone, never the area whole — VIOL-CORE-READERENTRY's
// note, and the Exclusions entry for T13.5-9 through T13.5-12 and T13.4-12:
// one comparison machinery for every held inspection and every lock-path
// inclusion, T13.4-12, T11.6-3's held arm, and T6.6-3(c) among them). Harness
// machinery only: no product imports, no test framework dependence.
//
// - The held-state comparison (`assertHeldState`), wherever a test inspects
//   a workspace while a run is held. Byte half: every workspace path but the
//   lock path `.xspec/lock` and everything under it — and `.xspec` itself, a
//   directory, where the invocation found none, acquisition then creating it
//   — byte-identical to the caller's baseline: its pre-invocation snapshot of
//   the root, retaken or adjusted as the harness's own stagings during the
//   hold and the writes of another run completing meanwhile changed it.
//   Whether the invocation found `.xspec` is read from that baseline, a
//   snapshot of the whole root (nothing pruned but, at most, the lock path,
//   whatever it holds there ignored). The exclusion is fixed — the root's
//   lock path alone, never the area whole (graph data beside it is what
//   T13.5-1's stale arm must see), a nested root's lock path compared like
//   any path — and classifies by no run; the walk prunes the lock path, so
//   nothing there need be listable for this half. Count half
//   (`assertLockDirectoryEntries`): `.xspec/lock` a directory holding,
//   besides the occupants the harness staged there — each byte-identical in
//   place, as staged — exactly one entry, a plain file, per held run whose
//   entry stands; anything else in it is no entry, and stands beside the
//   entries as a failure. The entries are returned — name bytes, content
//   read under H-4's grant, mode — for later identity checks.
// - Entries across a span (H-4: an entry's name, content, and permissions
//   are the product's own, opaque; a test observes their kind and count, one
//   entry's byte-identity across a span, and that two runs' entries bear
//   different names): `assertEntryUnchanged` (still there under its name, a
//   plain file of byte-identical content, its mode aside), `assertOnlyEntry`
//   (that, and the lock directory's only entry), `assertEntriesNamedApart`.
// - The lock path's state: `assertLockPathAbsent` (nothing at `.xspec/lock`:
//   release complete, T13.5-11) and `assertLockPathHolds` (exactly a given
//   tree — stagings as staged and entries by name and content, nothing added
//   beside them: T13.4-12, T13.5-10(c), (d), T13.5-11).
// - The inclusion check for commands that acquire nothing (H-6): around
//   `build`, `check`, `version`, a preview, or a read command, no other run
//   acquiring, releasing, or being killed meanwhile, whatever occupied the
//   lock path before — nothing, a leftover, or a held run's entry — occupies
//   it afterwards byte-identical, nothing added beside it: `captureLockPath`
//   then `assertLockPathAsCaptured`, or `assertLockPathUntouchedAround`.
// Every reading of the lock path goes through the reader the stagings'
// records use (helpers/lock-staging.ts `readLockPathTree`), or through H-4's
// grant for an entry's content (helpers/lock-path.ts `readLockPathFile`):
// never following a link, never opening a FIFO, a plain file whose own mode
// refuses the harness's read granted that read alone, its mode restored at
// once. Byte state throughout — kinds, names, contents, link targets — modes
// aside (H-4: an entry's permissions unpinned, the harness's own staging of
// permissions aside). Every failure is a diagnosed `HarnessAssertionError`
// rendering byte names readably (a segment that is not UTF-8 as hex); a
// misuse, or a listing the environment refuses (a test restores its own
// staging's permissions before inspecting the lock path), is a harness error.

import { Buffer } from "node:buffer";
import type { Stats } from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { describeByteDifference, fail } from "./assertions.js";
import {
  EXCLUDE_LOCK_PATH,
  isLockPathBytes,
  isLockPathKey,
  LOCK_PATH,
  readLockPathFile,
} from "./lock-path.js";
import type {
  LeftoverState,
  LeftoverTree,
  LockEntry,
  StagedLeftover,
} from "./lock-staging.js";
import {
  AREA_PATH,
  assertStagingInPlace,
  describeTreeDifferences,
  readLockPathTree,
  renderLines,
  renderRel,
} from "./lock-staging.js";
import type { DirectorySnapshot } from "./snapshot.js";
import {
  describeEntry,
  describeEntryDifference,
  displaySnapshotPath,
  snapshotDirectory,
} from "./snapshot.js";

const SLASH = 0x2f;
const NUL = 0x00;
const DOT = 0x2e;
const LOCK_BYTES = Buffer.from(LOCK_PATH, "latin1");
const LOCK_PREFIX = Buffer.from(`${LOCK_PATH}/`, "latin1");
const MAX_RENDERED_LINES = 25;
const MAX_NAMED_ENTRIES = 10;
/** The lock directory's own state in an expected tree (modes are aside). */
const LOCK_DIRECTORY: LeftoverState = { kind: "dir", mode: 0o755 };

// ---------------------------------------------------------------------------
// The held-state comparison

/** What the held-state comparison expects of a workspace a run is held in. */
export interface HeldStateExpectation {
  /**
   * The expected state of every workspace path but the lock path: the
   * caller's pre-invocation snapshot of the root, retaken or adjusted as the
   * harness's own stagings during the hold, and the writes of another run
   * completing meanwhile, changed it — a snapshot of the whole root, nothing
   * pruned but, at most, the lock path, whatever it holds there ignored.
   * Whether it holds `.xspec` says whether the invocation found the area.
   */
  readonly baseline: DirectorySnapshot;
  /**
   * The held runs whose entries stand: the held run's, until its release,
   * unless the harness deleted or replaced it or a run on another machine
   * took it over (TEST-SPEC §13.5's preamble).
   */
  readonly heldRuns: number;
  /**
   * The occupants the harness staged in the lock directory that stand there
   * now (each at `.xspec/lock/<name>`: `stageLeftover`, `copyEntryIn`):
   * counted apart from the entries, each byte-identical in place.
   */
  readonly staged?: readonly StagedLeftover[];
}

/**
 * The held-state comparison (TEST-SPEC §13.5's preamble; module header):
 * its byte half against `expected.baseline`, then its count half — the lock
 * directory holding, besides `expected.staged`, exactly `expected.heldRuns`
 * entries, each a plain file. Returns the entries, in byte order of name:
 * name bytes, content read under H-4's grant, and mode.
 */
export async function assertHeldState(
  root: string,
  expected: HeldStateExpectation,
  context: string,
): Promise<readonly LockEntry[]> {
  const plan = planLockDirectory(
    root,
    expected.heldRuns,
    expected.staged ?? [],
    "assertHeldState",
  );
  await assertHeldBytes(root, expected.baseline, context);
  return await checkLockDirectory(
    root,
    plan,
    `${context} (the held-state comparison's count half)`,
    `one per held run whose entry stands (TEST-SPEC §13.5's preamble; ` +
      `SPEC 13.5: acquisition adds the run's entry, which stands until ` +
      `its release)`,
  );
}

/** The byte half: every path but the lock path as the baseline has it. */
async function assertHeldBytes(
  root: string,
  baseline: DirectorySnapshot,
  context: string,
): Promise<void> {
  const current = await snapshotDirectory(root, EXCLUDE_LOCK_PATH);
  if (current.realRoot !== baseline.realRoot) {
    throw new Error(
      `assertHeldState: the baseline is a snapshot of ${baseline.root}, ` +
        `not of the workspace ${root} the run is held in`,
    );
  }
  const areaFound = baseline.entries.has(AREA_PATH);
  const keys = [
    ...new Set([...baseline.entries.keys(), ...current.entries.keys()]),
  ]
    .filter((key) => !isLockPathKey(key))
    .sort();
  const lines: string[] = [];
  for (const key of keys) {
    const was = baseline.entries.get(key);
    const now = current.entries.get(key);
    // Acquisition brings the area's directory into existence where the
    // invocation found none (SPEC 13.5): that directory itself, nothing more.
    if (key === AREA_PATH && !areaFound && now?.kind === "dir") continue;
    const shown = displaySnapshotPath(key);
    if (was === undefined && now !== undefined) {
      lines.push(`added ${shown}: ${describeEntry(now)}`);
    } else if (was !== undefined && now === undefined) {
      lines.push(`removed ${shown}: was ${describeEntry(was)}`);
    } else if (was !== undefined && now !== undefined) {
      const detail = describeEntryDifference(was, now);
      if (detail !== undefined) lines.push(`changed ${shown}: ${detail}`);
    }
  }
  if (lines.length === 0) return;
  const area = areaFound
    ? ""
    : ` — and ${AREA_PATH} itself, a directory, which the invocation found ` +
      `absent and acquisition creates`;
  fail(
    `${context}: the held-state comparison's byte half — every workspace ` +
      `path but the lock path ${LOCK_PATH} and everything under it${area} ` +
      `— must be byte-identical to its pre-invocation state, as the ` +
      `harness's own stagings and another run's completed writes changed ` +
      `it (TEST-SPEC §13.5's preamble; SPEC 13.5: the hold comes once ` +
      `exclusivity is held and before any modification); ` +
      `${String(lines.length)} difference(s), the graph-data area compared ` +
      `like every other path:\n${renderCapped(lines)}`,
  );
}

// ---------------------------------------------------------------------------
// The lock directory's entries

/** What the lock directory holds besides the harness's own stagings. */
export interface LockDirectoryExpectation {
  /** The number of entries: plain files the harness did not stage. */
  readonly entries: number;
  /**
   * The occupants the harness staged in the lock directory (each at
   * `.xspec/lock/<name>`), standing beside the entries, each byte-identical
   * in place.
   */
  readonly staged?: readonly StagedLeftover[];
}

/**
 * `.xspec/lock` a directory holding, besides `expected.staged` — each in
 * place, byte-identical as staged — exactly `expected.entries` entries,
 * each a plain file, and nothing else (the held-state comparison's count
 * half, and a residue's entries, T13.5-11). Returns the entries, in byte
 * order of name: name bytes, content read under H-4's grant, and mode.
 */
export async function assertLockDirectoryEntries(
  root: string,
  expected: LockDirectoryExpectation,
  context: string,
): Promise<readonly LockEntry[]> {
  const plan = planLockDirectory(
    root,
    expected.entries,
    expected.staged ?? [],
    "assertLockDirectoryEntries",
  );
  return await checkLockDirectory(
    root,
    plan,
    context,
    `SPEC 13.5: each run's entry is a plain file in the lock directory; ` +
      `anything else there is no entry`,
  );
}

interface LockDirectoryPlan {
  readonly entries: number;
  readonly staged: readonly StagedLeftover[];
  /** Each staged occupant's name in the lock directory, keyed latin1. */
  readonly stagedNames: ReadonlyMap<string, Buffer>;
}

/** Judge an expectation before anything is read: a misuse throws. */
function planLockDirectory(
  root: string,
  entries: number,
  staged: readonly StagedLeftover[],
  caller: string,
): LockDirectoryPlan {
  if (!Number.isInteger(entries) || entries < 0) {
    throw new Error(`${caller}: ${String(entries)} is no number of entries`);
  }
  const stagedNames = new Map<string, Buffer>();
  for (const one of staged) {
    requireSameRoot(one, root, caller);
    const name = occupantName(one.at);
    if (name === undefined) {
      throw new Error(
        `${caller}: the staging at ${renderRel(one.at)} is no occupant of ` +
          `the lock directory (${LOCK_PATH}/<name>), and only such an ` +
          `occupant stands beside entries`,
      );
    }
    const key = name.toString("latin1");
    if (stagedNames.has(key)) {
      throw new Error(`${caller}: ${renderRel(one.at)} is declared twice`);
    }
    stagedNames.set(key, name);
  }
  return { entries, staged, stagedNames };
}

async function checkLockDirectory(
  root: string,
  plan: LockDirectoryPlan,
  context: string,
  rule: string,
): Promise<LockEntry[]> {
  const count = plan.entries;
  const stagedShown = [...plan.stagedNames.values()]
    .sort(Buffer.compare)
    .map((name) => renderRel(entryRel(name)));
  const besides =
    stagedShown.length === 0
      ? ""
      : `, besides the occupants the harness staged there ` +
        `(${stagedShown.join(", ")}),`;
  const expectation =
    `${LOCK_PATH} must be a directory holding${besides} exactly ` +
    `${String(count)} ${count === 1 ? "entry" : "entries"}, each a plain ` +
    `file, and nothing else — ${rule}`;
  const lockAbs = joinBytes(Buffer.from(root), LOCK_BYTES);
  const lock = await lstatOrNothing(lockAbs);
  if (lock === undefined) {
    fail(`${context}: ${expectation}; found nothing at ${LOCK_PATH}`);
  }
  if (!lock.isDirectory()) {
    fail(`${context}: ${expectation}; found ${kindName(lock)} at ${LOCK_PATH}`);
  }
  const names = (await fsp.readdir(lockAbs, { encoding: "buffer" })).sort(
    Buffer.compare,
  );
  const found: { readonly name: Buffer; readonly mode: number }[] = [];
  const beside: string[] = [];
  for (const name of names) {
    if (plan.stagedNames.has(name.toString("latin1"))) continue;
    const stats = await lstatOrNothing(joinBytes(lockAbs, name));
    // Gone since the listing: no longer in the lock directory.
    if (stats === undefined) continue;
    if (stats.isFile()) {
      found.push({ name: Buffer.from(name), mode: stats.mode & 0o7777 });
    } else {
      beside.push(
        `${renderRel(entryRel(name))}: ${kindName(stats)} — no entry (an ` +
          `entry is a plain file), and nothing the harness staged`,
      );
    }
  }
  if (found.length !== count || beside.length > 0) {
    const named = found
      .slice(0, MAX_NAMED_ENTRIES)
      .map((entry) => renderRel(entryRel(entry.name)));
    if (found.length > named.length) {
      named.push(`… and ${String(found.length - named.length)} more`);
    }
    const listed =
      found.length === 0
        ? "no entry"
        : `${String(found.length)} ${found.length === 1 ? "entry" : "entries"} ` +
          `(${named.join(", ")})`;
    fail(
      `${context}: ${expectation}; found ${listed}` +
        (beside.length === 0
          ? ""
          : `, and beside the entries:\n${renderCapped(beside)}`),
    );
  }
  if (plan.staged.length > 0) await assertStagingInPlace(plan.staged, context);
  const entries: LockEntry[] = [];
  for (const entry of found) {
    entries.push({
      name: entry.name,
      content: await readStandingEntry(
        root,
        entry.name,
        context,
        `the entry ${renderRel(entryRel(entry.name))} must stand while the ` +
          `harness reads it — ${rule}`,
      ),
      mode: entry.mode,
    });
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Entries across a span

/**
 * The entry `entry` records still stands: a plain file under the same name
 * in the lock directory, its content byte-identical — its mode aside (H-4:
 * one entry's byte-identity, name and content, across a span acquisition and
 * release alone may touch; SPEC 13.5: no acquisition or release removes or
 * alters a live run's entry).
 */
export async function assertEntryUnchanged(
  root: string,
  entry: LockEntry,
  context: string,
): Promise<void> {
  const expectation =
    `the entry ${renderRel(entryRel(entry.name))} must stand unchanged — a ` +
    `plain file under the same name, its content byte-identical (H-4: one ` +
    `entry's byte-identity, name and content, across a span acquisition ` +
    `and release alone may touch, its mode aside; SPEC 13.5: no ` +
    `acquisition or release removes or alters a live run's entry)`;
  const content = await readStandingEntry(
    root,
    entry.name,
    context,
    expectation,
  );
  if (!content.equals(entry.content)) {
    fail(
      `${context}: ${expectation}; its content changed:\n` +
        describeByteDifference(content, entry.content, "now", "recorded"),
    );
  }
}

/**
 * The entry `entry` records stands unchanged (`assertEntryUnchanged`) and is
 * the lock directory's only entry — nothing beside it but, where given, the
 * occupants the harness staged there (SPEC 13.5: no acquisition or release
 * removes or alters a live run's entry, and a refused run's release deletes
 * its own).
 */
export async function assertOnlyEntry(
  root: string,
  entry: LockEntry,
  context: string,
  options: { readonly staged?: readonly StagedLeftover[] } = {},
): Promise<void> {
  const shown = renderRel(entryRel(entry.name));
  const plan = planLockDirectory(
    root,
    1,
    options.staged ?? [],
    "assertOnlyEntry",
  );
  const rule =
    `the entry ${shown} its only one (SPEC 13.5: no acquisition or release ` +
    `removes or alters a live run's entry, and a refused run's release ` +
    `deletes its own)`;
  const [only] = await checkLockDirectory(root, plan, context, rule);
  if (only === undefined || !only.name.equals(entry.name)) {
    fail(
      `${context}: ${LOCK_PATH}'s one entry must be ${shown}, standing ` +
        `under the same name (${rule}); its one entry is ` +
        `${only === undefined ? "missing" : renderRel(entryRel(only.name))}`,
    );
  }
  if (!only.content.equals(entry.content)) {
    fail(
      `${context}: the entry ${shown}, ${LOCK_PATH}'s one entry, must keep ` +
        `its content byte-identical (H-4; SPEC 13.5: no acquisition or ` +
        `release alters a live run's entry); its content changed:\n` +
        describeByteDifference(only.content, entry.content, "now", "recorded"),
    );
  }
}

/**
 * Two runs' entries bear byte-different names (SPEC 13.5: an entry's name
 * distinguishes its run, no other run's entry ever bearing it; H-4's one
 * comparison across runs — an inequality, pinning no name).
 */
export function assertEntriesNamedApart(
  first: LockEntry | Uint8Array,
  second: LockEntry | Uint8Array,
  context: string,
): void {
  const firstName = nameOf(first);
  if (!firstName.equals(nameOf(second))) return;
  fail(
    `${context}: two runs' entries must bear byte-different names (SPEC ` +
      `13.5: an entry's name distinguishes its run, no other run's entry ` +
      `ever bearing it), but both are named ${renderRel(entryRel(firstName))}`,
  );
}

// ---------------------------------------------------------------------------
// The lock path's state

/**
 * Nothing at `.xspec/lock` — `.xspec` itself absent or no directory included
 * (SPEC 13.5: release deletes the run's entry, then the emptied lock
 * directory; 13.4: the lock path is transient; T13.5-11).
 */
export async function assertLockPathAbsent(
  root: string,
  context: string,
): Promise<void> {
  const stats = await lstatOrNothing(joinBytes(Buffer.from(root), LOCK_BYTES));
  if (stats === undefined) return;
  fail(
    `${context}: nothing must be at ${LOCK_PATH} once every run has ended ` +
      `(SPEC 13.5: release deletes the run's entry, then the emptied lock ` +
      `directory; 13.4: the lock path is transient; T13.5-11), but ` +
      `${await describeLockPath(root, stats)}`,
  );
}

/** What the lock path holds, beside the stagings' records. */
export interface LockPathContents {
  /**
   * Stagings at the lock path itself or in the lock directory, each to be
   * found exactly as staged (its record's tree).
   */
  readonly staged?: readonly StagedLeftover[];
  /**
   * Entries to be found in the lock directory, each a plain file under its
   * name, its content byte-identical (a dead run's, `killHeldRun`).
   */
  readonly entries?: readonly LockEntry[];
}

/**
 * The lock path holds exactly `expected` — each staging as staged and each
 * entry by name and content, kind, name, content, and a link's target alike,
 * the lock directory where either lies in it, and nothing added beside them;
 * modes aside (H-4, H-6; SPEC 13.4, 13.5: T13.4-12's untouched leftover,
 * T13.5-10(c)'s staged leftovers after the holder's release, T13.5-11's
 * residues).
 */
export async function assertLockPathHolds(
  root: string,
  expected: LockPathContents,
  context: string,
): Promise<void> {
  const tree = expectedTree(root, expected, "assertLockPathHolds");
  await compareLockPath(
    root,
    tree,
    context,
    `${LOCK_PATH} must hold exactly what is expected there — each staging ` +
      `as staged, each entry by name and content — kind, name, content, and ` +
      `a link's target alike, nothing added beside it (H-4, H-6; SPEC 13.4, ` +
      `13.5), modes aside`,
    "expected",
  );
}

function expectedTree(
  root: string,
  expected: LockPathContents,
  caller: string,
): Map<string, LeftoverState> {
  const tree = new Map<string, LeftoverState>();
  const put = (key: string, state: LeftoverState): void => {
    const prior = tree.get(key);
    if (
      prior !== undefined &&
      !(prior.kind === "dir" && state.kind === "dir")
    ) {
      throw new Error(`${caller}: ${renderRel(key)} is expected twice`);
    }
    tree.set(key, state);
  };
  for (const one of expected.staged ?? []) {
    requireSameRoot(one, root, caller);
    if (!isLockPathBytes(one.at)) {
      throw new Error(
        `${caller}: the staging at ${renderRel(one.at)} lies outside the ` +
          `lock path ${LOCK_PATH}`,
      );
    }
    if (occupantName(one.at) !== undefined) put(LOCK_PATH, LOCK_DIRECTORY);
    for (const [key, state] of one.tree) put(key, state);
  }
  for (const entry of expected.entries ?? []) {
    put(LOCK_PATH, LOCK_DIRECTORY);
    put(entryRel(entry.name).toString("latin1"), {
      kind: "file",
      bytes: Buffer.from(entry.content),
      mode: entry.mode,
    });
  }
  if (tree.size === 0) {
    throw new Error(
      `${caller}: nothing is expected at the lock path (assertLockPathAbsent ` +
        `asserts that)`,
    );
  }
  return tree;
}

// ---------------------------------------------------------------------------
// The inclusion check (H-6)

/** The lock path's state at one moment, for the inclusion check. */
export interface LockPathCapture {
  /** The workspace root. */
  readonly root: string;
  /** The lock path and everything under it (`readLockPathTree`). */
  readonly tree: LeftoverTree;
}

/**
 * The lock path's state now — nothing, a leftover, or a held run's entry —
 * read under H-4's grant, for `assertLockPathAsCaptured` after a command
 * that acquires nothing.
 */
export async function captureLockPath(root: string): Promise<LockPathCapture> {
  return { root, tree: await readLockPathTree(root) };
}

/**
 * The inclusion check (H-6): whatever occupied the lock path when `capture`
 * was taken occupies it now byte-identical — kind, name, content, and a
 * link's target alike, modes aside — nothing added beside it, nothing taken
 * away: a command that acquires nothing makes no write there (SPEC 13.4: no
 * write but acquisition and release touches the lock path), no other run
 * acquiring, releasing, or being killed meanwhile.
 */
export async function assertLockPathAsCaptured(
  capture: LockPathCapture,
  context: string,
): Promise<void> {
  const before =
    capture.tree.size === 0
      ? `nothing occupied the lock path ${LOCK_PATH} before, so nothing may ` +
        `occupy it afterwards`
      : `whatever occupied the lock path ${LOCK_PATH} before — a leftover or ` +
        `a held run's entry — must occupy it afterwards byte-identical, kind, ` +
        `name, content, and a link's target alike, nothing added beside it`;
  await compareLockPath(
    capture.root,
    capture.tree,
    context,
    `${before}: a command that acquires nothing makes no write there (H-6; ` +
      `SPEC 13.4: no write but acquisition and release touches the lock ` +
      `path), modes aside`,
    "captured",
  );
}

/**
 * `captureLockPath`, `action` — a command acquiring nothing, no other run
 * acquiring, releasing, or being killed meanwhile — then
 * `assertLockPathAsCaptured`; returns the action's result.
 */
export async function assertLockPathUntouchedAround<T>(
  root: string,
  action: () => Promise<T> | T,
  context: string,
): Promise<T> {
  const capture = await captureLockPath(root);
  const result = await action();
  await assertLockPathAsCaptured(capture, context);
  return result;
}

async function compareLockPath(
  root: string,
  expected: LeftoverTree,
  context: string,
  expectation: string,
  label: string,
): Promise<void> {
  const actual = await readLockPathTree(root);
  const lines = describeTreeDifferences(expected, actual, label);
  if (lines.length === 0) return;
  fail(`${context}: ${expectation}:\n${renderCapped(lines)}`);
}

// ---------------------------------------------------------------------------
// Shared pieces

/** An entry's content, or a diagnosed failure when it no longer stands. */
async function readStandingEntry(
  root: string,
  name: Buffer,
  context: string,
  expectation: string,
): Promise<Buffer> {
  const rel = entryRel(name);
  const stats = await lstatOrNothing(joinBytes(Buffer.from(root), rel));
  if (stats === undefined) {
    fail(
      `${context}: ${expectation}; nothing is there now — ` +
        `${await describeLockPath(root)}`,
    );
  }
  if (!stats.isFile()) {
    fail(`${context}: ${expectation}; ${kindName(stats)} is there now`);
  }
  try {
    return await readLockPathFile(root, rel);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") {
      fail(`${context}: ${expectation}; it vanished as the harness read it`);
    }
    throw error;
  }
}

/** What occupies the lock path, for a diagnosis. */
async function describeLockPath(root: string, known?: Stats): Promise<string> {
  const lockAbs = joinBytes(Buffer.from(root), LOCK_BYTES);
  const stats = known ?? (await lstatOrNothing(lockAbs));
  if (stats === undefined) return `nothing is at ${LOCK_PATH}`;
  if (!stats.isDirectory()) return `${kindName(stats)} is at ${LOCK_PATH}`;
  let names: Buffer[];
  try {
    names = (await fsp.readdir(lockAbs, { encoding: "buffer" })).sort(
      Buffer.compare,
    );
  } catch (error) {
    return (
      `a directory is at ${LOCK_PATH}, its listing refused to the harness ` +
      `(${(error as NodeJS.ErrnoException).code ?? String(error)})`
    );
  }
  if (names.length === 0) return `an empty directory is at ${LOCK_PATH}`;
  const shown = names
    .slice(0, MAX_NAMED_ENTRIES)
    .map((name) => renderRel(entryRel(name)));
  if (names.length > shown.length) {
    shown.push(`… and ${String(names.length - shown.length)} more`);
  }
  return `a directory is at ${LOCK_PATH}, holding ${shown.join(", ")}`;
}

/** The lock directory's name a staging at `at` occupies, if it is one. */
function occupantName(at: Uint8Array): Buffer | undefined {
  const bytes = Buffer.from(at);
  if (
    bytes.length <= LOCK_PREFIX.length ||
    !bytes.subarray(0, LOCK_PREFIX.length).equals(LOCK_PREFIX)
  ) {
    return undefined;
  }
  const name = bytes.subarray(LOCK_PREFIX.length);
  return name.includes(SLASH) ? undefined : Buffer.from(name);
}

/** `.xspec/lock/<name>`, refusing (a misuse) anything that is no name. */
function entryRel(name: Uint8Array): Buffer {
  const bytes = Buffer.from(name);
  const invalid =
    bytes.length === 0 ||
    bytes.includes(SLASH) ||
    bytes.includes(NUL) ||
    (bytes.length === 1 && bytes[0] === DOT) ||
    (bytes.length === 2 && bytes[0] === DOT && bytes[1] === DOT);
  if (invalid) {
    throw new Error(
      `lock-state: <name bytes ${bytes.toString("hex")}> is no name in the ` +
        `lock directory`,
    );
  }
  return Buffer.concat([LOCK_PREFIX, bytes]);
}

function nameOf(entry: LockEntry | Uint8Array): Buffer {
  return entry instanceof Uint8Array
    ? Buffer.from(entry)
    : Buffer.from(entry.name);
}

function requireSameRoot(
  staged: StagedLeftover,
  root: string,
  caller: string,
): void {
  if (path.resolve(staged.root) !== path.resolve(root)) {
    throw new Error(
      `${caller}: a staging in ${staged.root} lies outside the workspace ` +
        `${root}`,
    );
  }
}

/** `name` within `dir`, byte for byte. */
function joinBytes(dir: Buffer, name: Buffer): Buffer {
  return Buffer.concat([dir, Buffer.from([SLASH]), name]);
}

/** What occupies `abs`, never following a final link; nothing there, none. */
async function lstatOrNothing(abs: Buffer): Promise<Stats | undefined> {
  try {
    return await fsp.lstat(abs);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    // ENOTDIR: a parent is no directory, so nothing lies at `abs`.
    if (code === "ENOENT" || code === "ENOTDIR") return undefined;
    throw error;
  }
}

function kindName(stats: Stats): string {
  if (stats.isSymbolicLink()) return "a symbolic link";
  if (stats.isDirectory()) return "a directory";
  if (stats.isFile()) return "a plain file";
  if (stats.isFIFO()) return "a FIFO";
  return "another kind";
}

function renderCapped(lines: readonly string[]): string {
  const shown = lines.slice(0, MAX_RENDERED_LINES);
  if (lines.length > shown.length) {
    shown.push(`… and ${String(lines.length - shown.length)} more`);
  }
  return renderLines(shown);
}
