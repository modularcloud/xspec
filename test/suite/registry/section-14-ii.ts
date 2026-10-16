// TEST-SPEC §14 II (the environment refusals: the reporting contract of a
// refused write, and the outcomes of a refused read) — SUITE-49: T14-9,
// T14-10.
//
// T14-9 (write failures, 14.24) is the reporting-contract test of a write the
// environment refuses: a usage error — exit 2, the 12.7 error document as
// stdout (`code` `"write-failure"`, `path` the concerned path), the
// diagnostic on stderr, never a finding — from every command that makes the
// write and from none that writes nothing, met only at the write it refuses
// (12.0: after every check and validation). The per-command states a refused
// write leaves are T13.5-7's subject (section-13.5.ts); the stagings,
// fixtures, twins, and seam choreography are shared through
// write-refusal-staging.ts, and every arm here is contract and recovery:
// stage, refuse, decode, then — the permissions restored — `build` exits 0
// and `check` is clean (12.1, 13.4).
//
// Staging discipline (E-1, Linux leg): permission removal alone, applied at
// the seam of 13.5 for a mutating command (`runHeldWithStaging`: after
// acquisition, before any modification) and before the invocation for
// `build` and the reads (`runStaged`) — and for acquisition's own writes,
// whose stagings precede the invocation too (T13.5-10(a), (d): the shared
// stagings of helpers/acquisition-staging.ts and section-13.5-ii.ts's area
// obstruction) — each staging verified on the harness's own process first —
// an ineffective one, a privileged runner, is a `HarnessStagingError`
// (H-11), never a pass or a skip (H-9). Elsewhere the arms are not staged
// (the NU3_STAGED pattern of section-11.5, here `WRITE_REFUSALS_STAGED`),
// and the Windows subset (E-6) selects T14-9 nowhere.
//
// Conservative operationalizations (H-3):
// - Arm (a)'s rename is `b.k` → `b.k2` in `specs/b/B.mdx` — the child
//   identity, referenced nowhere — so the refused source rewrite is the
//   operation's first write: the state 13.5 pins is "nothing written", and
//   the recovery clause ("after every arm ... `build` exits 0") holds on it.
//   The staging is (a)'s (`specs/b` unwritable) and the concerned path the
//   same `specs/b/B.mdx`; T13.5-7 (a) drives the multi-file rename whose
//   partly applied rewrite leaves the workspace failing validation.
// - "stderr the diagnostic": wording is free, so the assertion is presence —
//   a non-empty stderr beside the error document on stdout (12.0: usage
//   error messages and diagnostics are standard-error content).
// - The reporter sweep pins every refreshing read's concerned path to the
//   graph-data area `.xspec` exactly: a refresh writes graph data alone
//   (13.3: no TypeScript or Markdown is generated or removed), and the
//   mutating `review create` refreshes before its session write (13.5), so
//   on the stale workspace with `.xspec` unwritable — T14-9's graph-data
//   staging (write-refusal-staging.ts `graphDataRefusal`: `.xspec` itself
//   and every directory of T13.3-2's operational path set read-only and
//   every file of it unwritable, whatever layout graph data takes; the
//   journal, the session directory, and the lock path keeping their modes)
//   — the area is the first refused write of each, never a path inside it
//   (14.24, 11.6). The reads take no hold and meet the staging from their
//   invocation on; `review create`, a mutating command, meets it at the
//   seam, after acquisition — staged before its invocation, the read-only
//   `.xspec` would refuse acquisition's creation of the lock directory
//   first, the lock path then concerned (13.5). The lock directory and the
//   held run's entry keep their modes, so release deletes the entry; its
//   deletion of the emptied lock directory, an entry of the read-only area,
//   is refused, which changes no outcome (13.5, 14.24); the empty lock
//   directory left behind is a leftover, bearing on neither the recovery
//   `build` nor `check` (13.4: the lock path bears on no comparison of
//   graph data, and neither acquires).
// - Acquisition's writes, one arm each (T14-9: the entry's addition, a
//   leftover's removal, and the lock directory's creation concerning
//   `.xspec/lock`, no entry ever named; the area directory's creation and
//   an occupant of the area's own path concerning `.xspec`), run on
//   T13.5-10's session staging — a fresh CONF-CORE-shaped workspace, built,
//   holding the audit session `s` — or, for the area directory's creation,
//   an unbuilt one, so the CONF-CORE reference can run them; each with one
//   of T13.5-10's five mutating commands, in turn (the sixth arm's wrapping
//   to the first), so every mutating command reports one of acquisition's
//   refused writes — each an operation succeeding on T13.5-10's unstaged
//   twin, but for `review split` on the unbuilt workspace, which names the
//   absent session `s`, acquisition preceding that check (12.0). A
//   leftover's removal is staged both ways T13.5-10(d) stages it: a
//   subdirectory refusing writes in a writable lock directory, and a plain
//   file at the lock path under T14-9's full discipline. Beyond the
//   contract each arm asserts nothing modified — every path but the lock
//   path byte-identical, H-6 leaving out the lock path a mutating run
//   touched (its residue is T13.5-10(d)'s subject), `.xspec` itself
//   compared — and recovery: the permissions restored, or, for the
//   occupant of the area's own path, the occupant deleted by hand (13.4:
//   the remedy for an occupant obstructing acquisition), `build` exits 0
//   and `check` is clean.
// - The never-reporter `check` on that state asserts condition 10 alone,
//   every finding concerning a path with `locations` `[]` and instructing
//   rebuilding — its message names `build` (14.10; no recorded file
//   obstructs a rebuild write there) — and B's generated module
//   `specs/b/B.xspec.ts` among the paths — the edited text changes it
//   (4.2, 13.1) — membership alone, since which companions and other
//   derived files also differ is the product's
//   (`assertEditedBStalenessConcerns`, shared with T13.5-7 (f)).
// - The validation refusal's one finding asserts its concerned identity
//   exactly — the unchanged `specs/b/B.mdx#b` as the sole `identities`
//   element — with `locations` `[]` and `path` null (14, 1.5, 12.7).
// - The refused writes of the precedence arms and the state assertions
//   beyond the contract (nothing written where the refused write is the
//   operation's first; the journal or the session file byte-unchanged) are
//   whole-entry byte compares against the workspace's own pre-invocation
//   snapshot, never harness-composed content (H-6).
//
// T14-10 (read failures, 14.25): the object read decides the outcome, one
// arm per row of 14.25, each refusal staged by permission removal alone
// (E-1, Linux leg; `stageReadRefusalOfFile`: mode 0o200, the write
// permission kept so a regeneration replacing or rewriting the object is
// never itself refused; `stageReadRefusalOfDirectory`: mode 0o100, search
// kept so entries stay reachable by name; nonexistence never staged as a
// refusal), each staging verified on the harness's own process first —
// arm (f)'s graph-data directories taking mode 0o300 instead
// (`stageDirectoryMode`, `-wx`: the listing refused, write and search kept,
// so a regeneration's writes there are never refused), and arm (i)'s
// acquisition arms T13.5-10(d)'s stagings (helpers/acquisition-staging.ts:
// the lock directory, or a subdirectory under it, unlistable but writable,
// `-wx`; `.xspec` or the lock directory unsearchable, `rw-`), each verified
// on the harness itself alike.
// Snapshots for the "nothing modified" laws are taken outside the staging
// windows (a staged object cannot be snapshotted), before staging and after
// restoring.
//
// Conservative operationalizations (H-3):
// - Arm (a)'s fixture: `specs/A.mdx` → `specs/B.mdx` → `specs/C.mdx` ←
//   `specs/D.mdx`, plus the code source `src/app.ts` marking A's section.
//   A premise asserts that B's `d` reference and the marker each record an
//   occurrence when readable, so "no record for its spellings" under the
//   refusal is the masking of 14.25, not an absence; D's record stays as
//   the per-file answer the surface keeps.
// - "`ids` exits 1 answering nothing" (b) and "`review status` reports
//   exactly one finding" (c) are the findings-only document `{"findings":
//   […]}` (12.7: a report whose defined content is findings alone), decoded
//   form-exact.
// - Arm (c)'s three reporters assert one concern contract (TEST-SPEC line
//   9's rule for an error report): `check`'s and `review status s`'s
//   reports and the `review list` listing each hold exactly one finding,
//   condition 21 — its exact stable code `corrupt-session`, which the
//   condition count reads — concerning the session file
//   `.xspec/reviews/s.json` as its 12.7 `path`, with no in-source location
//   (`locations` []: a session condition has none; SPEC 14, 12.7). The
//   listing's finding comes from the decoded listing's `"findings"` member,
//   with no invocation of its own: `list` reports condition 21 for each
//   corrupt session (14.21, exit 1) under that member (12.7), which the
//   decoder requires while a session is listed corrupt (H-3). Exactly one
//   from each reporter: the one staged corruption is a refused content
//   read — no session content is read, so no invariant violation stands
//   beside it as a distinct finding — and `s` is the workspace's only
//   session.
// - Arm (f)'s "every path under `.xspec/` other than the journal, the
//   session directory, and the lock path staged unreadable" is T13.3-2's
//   operational path set (`isGraphDataKey`, walked by the adapter layer's
//   `collectGraphDataEntries`: the lock path and everything under it never
//   staged, 13.4), recursively, each path reached at its exact name bytes
//   (the names are the product's, 13.3): every plain file at mode 0o200
//   (`-w-------`) and every directory by its read permission alone removed
//   (0o300, `-wx`: its listing refused, its write and search kept — never
//   the discipline's `--x`), so only reads are refused and the
//   regeneration `ids` owes (13.3) is never itself refused, whatever the
//   product's layout; `.xspec` itself is no path under it and keeps its
//   mode. Where graph data holds no directory, files alone are staged, and
//   the staging's description — quoted by every diagnosis under it — says
//   so. A staged path the regeneration has since removed is not restored
//   (nothing to reinstate). After `build` exits 0 nothing is asserted about
//   the record it wrote, neither an `inventory` nor a recovery `check`:
//   what a later read meets turns on the modes `build`'s writes leave,
//   which SPEC.md fixes nowhere (a successful build's replacement of an
//   unreadable record is T12.2-2's, staged shape-blind). The preview is the
//   file-form `move specs/c/C.mdx specs/c/D.mdx` — same directory, C
//   imported nowhere — a plan valid on the readable record.
// - Arm (g)'s "a malformed value" is `at specs/a/A.mdx zz` (an offset
//   spelled as anything but decimal digits, 11.5 — a syntax-class member,
//   12.0); "nothing modified" is the whole-tree snapshot around the sweep.
// - Arm (i)'s acquisition arms run on T13.5-10's session staging — a fresh
//   CONF-CORE-shaped workspace (`CORE_DECL`), built, holding the audit
//   session `s`, so the CONF-CORE reference can run them — one of
//   T13.5-10's five mutating commands each, in turn, so every mutating
//   command reports one of acquisition's refused reads: the lock directory
//   unlistable (`rename`), a subdirectory under it unlistable (`move`),
//   `.xspec` unsearchable holding no `lock` (`review create`) and,
//   separately, an empty lock directory (`resolve`) — T13.5-10(d)'s two
//   stagings of it — and the lock directory unsearchable, holding a
//   directory that holds a file (`split`). "The nested path never named" is
//   the error document's `path` exactly `.xspec/lock` and its `locations`
//   `[]` (12.7: none for a condition without in-source locations), the
//   message's wording free. "Nothing modified" is every path but the lock
//   path byte-identical, the lock path pruned from both walks (H-6:
//   acquisition and release touch it; the residue each staging leaves there
//   is T13.5-10(d)'s subject). The second-discovery arm holds `rename
//   specs/A.mdx a a2` — the next command in turn, one representative,
//   T13.5-12(e) running each — on a session staging of T13.5-8's valid
//   workspace (`ACQUISITION_DECL`), makes `specs/sub` unlistable during the
//   hold as T13.5-12(e) does, and asserts arm (g)'s contract at that
//   directory and nothing modified from the state during the hold on.
// - Unstageable, recorded here as T14-10 records them (and as T6.5-6
//   records its unstageable clauses): a refused read of a path occupant's
//   kind — the area's own occupant's at acquisition included (13.5), though
//   not the lock path's there, which arm (i) stages, a conforming
//   acquisition taking that kind from no listing (T13.5-10(h)); whether a
//   product learns a kind by a separate examination the environment can
//   refuse or from a listing it already made is its own (7, 13.4) — and a
//   refused read of a directory above the workspace root, which the working
//   directory lies beneath and cannot be entered without traversing.
//   Neither is asserted.

import { Buffer } from "node:buffer";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import type { AcquisitionStaging } from "../../helpers/acquisition-staging.js";
import {
  stageReadOnlyArea,
  stageReadOnlyRoot,
  stageUnlistableLeftoverDirectory,
  stageUnlistableLockDirectory,
  stageUnremovableLockFile,
  stageUnsearchableArea,
  stageUnsearchableLockDirectory,
  stageUnwritableLeftoverDirectory,
  stageUnwritableLockDirectory,
} from "../../helpers/acquisition-staging.js";
import type {
  Finding,
  OccurrencesReport,
} from "../../helpers/adapters/index.js";
import {
  collectGraphDataEntries,
  decodeAtReport,
  decodeFindingsReport,
  decodeIdsReport,
  decodeInventoryDocument,
  decodeOccurrencesReport,
  decodePreviewReport,
  decodeSessionListReport,
  decodeViewReport,
} from "../../helpers/adapters/index.js";
import {
  assertExitCode,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { EXCLUDE_LOCK_PATH, LOCK_PATH } from "../../helpers/lock-path.js";
import { AREA_PATH } from "../../helpers/lock-staging.js";
import type { PermissionStaging } from "../../helpers/permissions.js";
import {
  HarnessStagingError,
  stageDirectoryMode,
  stageReadRefusalOfDirectory,
  stageReadRefusalOfFile,
  stageWriteRefusal,
} from "../../helpers/permissions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import type { DirectorySnapshot } from "../../helpers/snapshot.js";
import {
  assertSnapshotsEqual,
  displaySnapshotPath,
  snapshotDirectory,
  snapshotKeyBytes,
} from "../../helpers/snapshot.js";
import { stagedMdx } from "../../helpers/staged-mdx.js";
import { stagedTs } from "../../helpers/staged-ts.js";
import type { ProductBinding, RunResult } from "../../helpers/subprocess.js";
import { pathExists } from "../../helpers/subprocess.js";
import type { WorkspaceDecl } from "../../helpers/workspace.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { SessionOperation } from "./section-13.5.js";
import {
  ACQUISITION_DECL,
  CORE_DECL,
  SUB_DIR as SECOND_DISCOVERY_DIR,
  UNLISTABLE_SUB_DIR,
} from "./section-13.5.js";
import {
  ABSENT_SESSION_ITEMS,
  T13_5_10_OPERATIONS,
  obstructArea,
  stageArmWorkspace,
} from "./section-13.5-ii.js";
import { liftAndWait, withHeldRun } from "./section-13.5-iii.js";
import {
  assertConditionCounts,
  assertFindingConcernsPath,
  assertFindingLocated,
  assertRefusalIdentities,
  assertSameJson,
  buildOk,
  expectConfigurationError,
  expectErrorDocument,
  expectExit,
  runJson,
} from "./support.js";
import type { RefusalFixture } from "./write-refusal-staging.js";
import {
  GRAPH_DATA_AREA,
  JOURNAL_PATH,
  MOVE_ARGV,
  MOVE_DESTINATION,
  MOVE_DESTINATION_DIR,
  MOVE_FIXTURE,
  MOVE_MARKDOWN_DIR,
  MOVE_MARKDOWN_WRITES,
  MOVE_ORIGIN,
  RENAME_A_PATH,
  RENAME_B_DIR,
  RENAME_B_MODULE,
  RENAME_B_PATH,
  RENAME_C_PATH,
  RENAME_FIXTURE,
  RENAME_OLD_IDENTITY,
  REVIEWS_DIR,
  WRITE_FAILURE_CODE,
  WRITE_REFUSALS_STAGED,
  assertEditedBStalenessConcerns,
  assertStalenessAlone,
  expectWriteFailure,
  graphDataRefusal,
  isDerivedFile,
  prepareRefusalWorkspace,
  refusalAt,
  refusalUnder,
  requireItemByScope,
  runHeldWithStaging,
  runSettled,
  runStaged,
  sessionStatus,
  snapshotWorkspace,
} from "./write-refusal-staging.js";

// ---------------------------------------------------------------------------
// Shared constants and helpers
// ---------------------------------------------------------------------------

/** The arms' full rename, `b` → `b2` in `specs/b/B.mdx` (SPEC 6.4). */
const RENAME_B_TO_B2: readonly string[] = [
  "rename",
  RENAME_B_PATH,
  "b",
  "b2",
  "--json",
];
/** Arm (a)'s rename: the child identity `b.k`, referenced nowhere. */
const RENAME_CHILD: readonly string[] = [
  "rename",
  RENAME_B_PATH,
  "b.k",
  "b.k2",
  "--json",
];
const MOVE_JSON: readonly string[] = [...MOVE_ARGV, "--json"];

// Text-only staleness edits of built sources: the workspace stays valid, its
// graph data and the edited source's derived files stale (SPEC 13.3).
const B_EDIT_FROM = "Beta text.";
const B_EDIT_TO = "Beta text, edited.";
const A_EDIT_FROM = "Alpha text.";
const A_EDIT_TO = "Alpha text, edited.";
/** A's `d` reference into B after the fixture's prior rename (`b0` → `b`). */
const A_REFERENCE = "d={B.b}";
/** The same reference respelled to resolve nowhere (SPEC 14.5). */
const A_UNRESOLVED = "d={B.nope}";

const SESSION = "s";
const NEW_SESSION = "n";
const SESSION_FILE = `${REVIEWS_DIR}/${SESSION}.json`;
/** An unblocked leaf item's scope (SPEC 10.6) — not the edited source's. */
const RESOLVE_SCOPE = "specs/c/C.mdx#c";
/** A requirement node of the built rename fixture, `show`'s operand. */
const SHOW_IDENTITY = "specs/b/B.mdx#b";

/**
 * A refused write's 14.24 contract with its diagnostic: exit 2, the error
 * document as stdout (`write-failure`, a concerned path — `expectWriteFailure`,
 * whose admissible paths are snapshot keys compared with the reported path
 * by bytes), and a non-empty stderr (12.0: the diagnostic is
 * standard-error content).
 */
function expectRefusal(
  result: RunResult,
  concerned: readonly string[],
  context: string,
): Finding {
  const finding = expectWriteFailure(result, concerned, context);
  if (result.stderr.trim().length === 0) {
    fail(
      `${context} — the diagnostic accompanies the error document on ` +
        `standard error (SPEC 14.24, 12.0: usage-error messages are ` +
        `standard-error content); got an empty stderr beside ` +
        `${JSON.stringify(finding.message)}`,
    );
  }
  return finding;
}

/**
 * Recovery (SPEC 12.1, 13.4): with the permissions restored — every staging
 * is restored the moment its command exits — the next `build` exits 0 and
 * `check` is clean.
 */
async function assertRecovers(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
): Promise<void> {
  await buildOk(
    product,
    workspace,
    `${context}: recovery — the permissions restored, the next \`build\` ` +
      `exits 0 (SPEC 12.1, 13.4)`,
  );
  await expectExit(
    product,
    workspace,
    ["check"],
    0,
    `${context}: recovery — after the next \`build\`, \`check\` is clean ` +
      `(SPEC 12.2, 13.4)`,
  );
}

/** The bytes of the snapshot's plain file at `rel`. */
function fileBytes(
  snapshot: DirectorySnapshot,
  rel: string,
  context: string,
): Uint8Array {
  const entry = snapshot.entries.get(rel);
  if (entry === undefined || entry.kind !== "file") {
    return fail(
      `${context}: ${rel} must be a plain file (SPEC 13.4); found ` +
        (entry === undefined ? "absent" : entry.kind),
    );
  }
  return entry.bytes;
}

/** One plain file byte-unchanged between two snapshots. */
function assertFileUnchanged(
  before: DirectorySnapshot,
  after: DirectorySnapshot,
  rel: string,
  context: string,
): void {
  const prior = fileBytes(before, rel, context);
  const current = fileBytes(after, rel, context);
  if (Buffer.compare(Buffer.from(prior), Buffer.from(current)) !== 0) {
    fail(`${context}: ${rel} must be byte-unchanged; found it rewritten`);
  }
}

// ---------------------------------------------------------------------------
// The concerned paths, one arm each (T13.5-7's stagings)
// ---------------------------------------------------------------------------

/**
 * (a) A rewritten source: `rename specs/b/B.mdx b.k b.k2` with `specs/b`
 * staged unwritable at the seam — the error document concerns
 * `specs/b/B.mdx`; the refused rewrite being the operation's first write
 * (the child identity is referenced nowhere), nothing is written: no
 * journal entry, nothing regenerated (13.5).
 */
async function rewrittenSourceArm(product: ProductBinding): Promise<void> {
  const context =
    "T14-9 (a) `rename specs/b/B.mdx b.k b.k2 --json` with specs/b unwritable";
  const prepared = await prepareRefusalWorkspace(
    product,
    RENAME_FIXTURE,
    context,
  );
  const { workspace } = prepared;
  try {
    const result = await runHeldWithStaging(
      product,
      workspace,
      RENAME_CHILD,
      "hold-t14-9-a.tmp",
      refusalUnder(RENAME_B_DIR),
      context,
    );
    expectRefusal(
      result,
      [RENAME_B_PATH],
      `${context} — the rewritten source is the concerned path (SPEC 14.24, 6.4)`,
    );
    assertSnapshotsEqual(
      prepared.before,
      await snapshotWorkspace(workspace.root),
      `${context}: nothing written — the child identity \`b.k\` is ` +
        `referenced nowhere, so B's refused rewrite is the operation's ` +
        `first write and the command stops there: no journal entry (the ` +
        `append follows every source edit), nothing regenerated (SPEC ` +
        `13.5, 14.24)`,
    );
    await assertRecovers(product, workspace, context);
  } finally {
    await workspace.dispose();
  }
}

/**
 * (b) The journal: the full rename with `.xspec/journal` staged unwritable
 * (`.xspec` read-only, its occupant unwritable) — the error document
 * concerns `.xspec/journal`, the journal byte-unchanged (no entry); restored,
 * the consistently rewritten sources build clean (T13.5-7 (b)).
 */
async function journalArm(product: ProductBinding): Promise<void> {
  const context =
    "T14-9 (b) `rename specs/b/B.mdx b b2 --json` with .xspec/journal unwritable";
  const prepared = await prepareRefusalWorkspace(
    product,
    RENAME_FIXTURE,
    context,
  );
  const { workspace } = prepared;
  try {
    const result = await runHeldWithStaging(
      product,
      workspace,
      RENAME_B_TO_B2,
      "hold-t14-9-b.tmp",
      refusalAt(JOURNAL_PATH),
      context,
    );
    expectRefusal(
      result,
      [JOURNAL_PATH],
      `${context} — the journal is the concerned path (SPEC 14.24, 6.1)`,
    );
    assertFileUnchanged(
      prepared.before,
      await snapshotWorkspace(workspace.root),
      JOURNAL_PATH,
      `${context}: the refused append leaves no entry (SPEC 13.5, 6.1)`,
    );
    await assertRecovers(product, workspace, context);
  } finally {
    await workspace.dispose();
  }
}

/**
 * (c) An emitted Markdown file's creation or removal: the file-form move
 * with `out/specs` staged unwritable — the error document concerns one of
 * the two Markdown writes the finishing regeneration owes there,
 * `out/specs/sub/B.md`'s creation (the directory it needs is part of that
 * write, 13.4) or `out/specs/A.md`'s removal, the order among a
 * regeneration's derived-file writes being unpinned (13.5).
 */
async function markdownArm(product: ProductBinding): Promise<void> {
  const context =
    "T14-9 (c) `move specs/A.mdx specs/sub/B.mdx --json` with out/specs unwritable";
  const prepared = await prepareRefusalWorkspace(
    product,
    MOVE_FIXTURE,
    context,
  );
  const { workspace } = prepared;
  try {
    const result = await runHeldWithStaging(
      product,
      workspace,
      MOVE_JSON,
      "hold-t14-9-c.tmp",
      refusalUnder(MOVE_MARKDOWN_DIR),
      context,
    );
    expectRefusal(
      result,
      MOVE_MARKDOWN_WRITES,
      `${context} — an emitted Markdown file's creation or removal under ` +
        `${MOVE_MARKDOWN_DIR} is the concerned path (SPEC 14.24, 13.2, 13.5)`,
    );
    await assertRecovers(product, workspace, context);
  } finally {
    await workspace.dispose();
  }
}

/**
 * (d) A relocation's second write, the origin's removal: the file-form move
 * with `specs/sub` present and writable and `specs` staged unwritable — the
 * destination produced, the origin's removal refused, the error document
 * concerning `specs/A.mdx`, the origin's own path (14.24: each of a
 * relocation's two writes concerns its own path).
 */
async function originRemovalArm(product: ProductBinding): Promise<void> {
  const context =
    "T14-9 (d) `move specs/A.mdx specs/sub/B.mdx --json` with specs unwritable, specs/sub present and writable";
  const prepared = await prepareRefusalWorkspace(
    product,
    MOVE_FIXTURE,
    context,
  );
  const { workspace } = prepared;
  try {
    await workspace.dir(MOVE_DESTINATION_DIR);
    const result = await runHeldWithStaging(
      product,
      workspace,
      MOVE_JSON,
      "hold-t14-9-d.tmp",
      refusalAt(MOVE_ORIGIN),
      context,
    );
    expectRefusal(
      result,
      [MOVE_ORIGIN],
      `${context} — the origin's removal, the relocation's second write, ` +
        `concerns the origin's own path (SPEC 14.24, 13.5)`,
    );
    await assertRecovers(product, workspace, context);
  } finally {
    await workspace.dispose();
  }
}

/**
 * (d) A relocation's first write, the destination's production: the same
 * move with `specs/sub` the directory staged unwritable instead — the error
 * document concerns `specs/sub/B.mdx`, the origin still present and nothing
 * relocated: the relocation's entry precedes `src/` in `files` order (6.6,
 * 12.7), so its refused first write leaves the whole workspace
 * byte-unchanged (13.5).
 */
async function destinationProductionArm(
  product: ProductBinding,
): Promise<void> {
  const context =
    "T14-9 (d) `move specs/A.mdx specs/sub/B.mdx --json` with specs/sub unwritable";
  const prepared = await prepareRefusalWorkspace(
    product,
    MOVE_FIXTURE,
    context,
  );
  const { workspace } = prepared;
  try {
    await workspace.dir(MOVE_DESTINATION_DIR);
    const staged = await snapshotWorkspace(workspace.root);
    const result = await runHeldWithStaging(
      product,
      workspace,
      MOVE_JSON,
      "hold-t14-9-d2.tmp",
      refusalUnder(MOVE_DESTINATION_DIR),
      context,
    );
    expectRefusal(
      result,
      [MOVE_DESTINATION],
      `${context} — the destination's production, the relocation's first ` +
        `write, concerns the destination's own path (SPEC 14.24, 13.5)`,
    );
    assertSnapshotsEqual(
      staged,
      await snapshotWorkspace(workspace.root),
      `${context}: the origin still present, nothing relocated — the ` +
        `relocation's entry precedes src/ in files order (SPEC 6.6, 12.7), ` +
        `so its refused first write leaves every source, the journal, ` +
        `derived files, and graph data byte-unchanged (SPEC 13.5, 14.24)`,
    );
    await assertRecovers(product, workspace, context);
  } finally {
    await workspace.dispose();
  }
}

/**
 * (e) A session file: on a stale, valid workspace holding an audit session,
 * `review resolve s <item> --status no-change` with `.xspec/reviews` and the
 * session file staged unwritable at the seam (`.xspec` itself writable, so
 * the refresh preceding the session write succeeds, 13.5) — the error
 * document concerns `.xspec/reviews/s.json`, the session file
 * byte-unchanged.
 */
async function sessionFileArm(product: ProductBinding): Promise<void> {
  const context =
    "T14-9 (e) `review resolve s <item> --status no-change --json` with .xspec/reviews and the session file unwritable";
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
    const item = requireItemByScope(
      await sessionStatus(product, workspace, SESSION, `${context} staging`),
      RESOLVE_SCOPE,
      `${context} staging`,
    );
    await workspace.edit(RENAME_A_PATH, A_EDIT_FROM, A_EDIT_TO);
    const staged = await snapshotWorkspace(workspace.root);
    const result = await runHeldWithStaging(
      product,
      workspace,
      [
        "review",
        "resolve",
        SESSION,
        item.id,
        "--status",
        "no-change",
        "--json",
      ],
      "hold-t14-9-e.tmp",
      refusalAt(SESSION_FILE),
      context,
    );
    expectRefusal(
      result,
      [SESSION_FILE],
      `${context} — the session file is the concerned path (SPEC 14.24, 10.7)`,
    );
    assertFileUnchanged(
      staged,
      await snapshotWorkspace(workspace.root),
      SESSION_FILE,
      `${context}: the session write, the mutator's last write, refused ` +
        `(SPEC 13.5, 14.24)`,
    );
    await assertRecovers(product, workspace, context);
  } finally {
    await workspace.dispose();
  }
}

/**
 * (f) A generated module or companion: `build` on the B-edited workspace
 * with `specs/b` staged unwritable before the invocation (`build` takes no
 * hold) — the error document concerns a derived path under `specs/b/`, the
 * first `specs/b/` write in the product's order: the set a regeneration
 * writes there is the set the prior build left (12.1 rewrites every derived
 * file; the edit changes content, not the set). The set is the prior
 * snapshot's keys, so a companion whose suffix the product chose (13.1)
 * matches the reported path by its exact bytes, whatever they are.
 */
async function derivedPathArm(product: ProductBinding): Promise<void> {
  const context =
    "T14-9 (f) `build --json` with specs/b unwritable on the B-edited workspace";
  const prepared = await prepareRefusalWorkspace(
    product,
    RENAME_FIXTURE,
    context,
  );
  const { workspace } = prepared;
  try {
    const derivedUnderB = [...prepared.before.entries.keys()].filter(
      (rel) =>
        isDerivedFile(rel, prepared.before.entries.get(rel)) &&
        rel.startsWith(`${RENAME_B_DIR}/`),
    );
    if (derivedUnderB.length === 0) {
      fail(
        `${context}: the built workspace holds B's generated module and ` +
          `companions beside its source under ${RENAME_B_DIR}/ (SPEC 13.1, ` +
          `13.2); found none among ` +
          JSON.stringify(
            [...prepared.before.entries.keys()].map(displaySnapshotPath),
          ),
      );
    }
    await workspace.edit(RENAME_B_PATH, B_EDIT_FROM, B_EDIT_TO);
    const result = await runStaged(
      product,
      workspace,
      ["build", "--json"],
      refusalUnder(RENAME_B_DIR),
      context,
    );
    expectRefusal(
      result,
      derivedUnderB,
      `${context} — a generated module or companion under ${RENAME_B_DIR}/, ` +
        `the first ${RENAME_B_DIR}/ write in the product's order, is the ` +
        `concerned path (SPEC 14.24, 12.1, 13.1)`,
    );
    await assertRecovers(product, workspace, context);
  } finally {
    await workspace.dispose();
  }
}

// ---------------------------------------------------------------------------
// The reporter set, the never-reporters, and precedence (SPEC 14.24, 12.0)
// ---------------------------------------------------------------------------

// The precedence fixture: the rename fixture plus a code group — `app`, one
// code source importing A's generated module — so that `query nodes --group
// app` names a code group, an invalid flag value (SPEC 11.1: `--group`
// accepts only a configured spec group's name). The prior journaled rename
// is the rename fixture's; the code source references nothing it rewrites.
// T14-9 prepares it after its first product invocation, so its
// configuration and code source are TypeScript staged-source records
// (helpers/staged-ts.ts; S-9's TypeScript and timing clauses).
const CODE_GROUP = "app";
const PRECEDENCE_CONFIG = stagedTs(
  "T14-9 the precedence fixture xspec.config.ts (one spec group, the code group app, Markdown emission next to sources)",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: {
    ${CODE_GROUP}: ["src/**/*.ts"]
  },
  markdown: { emit: true }
})
`,
);
const PRECEDENCE_APP = stagedTs(
  "T14-9 the precedence fixture src/app.ts (importing specs/a/A.mdx's module)",
  ['import A from "../specs/a/A.xspec";', "", "A.a;", ""].join("\n"),
);
const PRECEDENCE_FIXTURE: RefusalFixture = {
  decl: {
    files: {
      ...RENAME_FIXTURE.decl.files,
      "xspec.config.ts": PRECEDENCE_CONFIG,
      "src/app.ts": PRECEDENCE_APP,
    },
  },
  priorRename: RENAME_FIXTURE.priorRename,
};

/** An exit-2 error the checks of 12.0 report with no stable code. */
function expectPlainUsageError(
  result: RunResult,
  why: string,
  context: string,
): void {
  assertExitCode(
    result,
    2,
    `${context} — ${why} is a usage error, exit 2, reported before any ` +
      `write: a write failure is met only at the write it refuses, after ` +
      `every check and validation, so a product attempting the refresh ` +
      `first fails here (SPEC 12.0, 14.24)`,
  );
  const finding = expectErrorDocument(result, context);
  if (finding.code !== null) {
    fail(
      `${context} — ${why} carries no stable code: \`code\` is null where ` +
        `14 assigns none, never \`write-failure\` (SPEC 14, 12.7); got ` +
        `${JSON.stringify(finding.code)} (message: ` +
        `${JSON.stringify(finding.message)})`,
    );
  }
}

/**
 * Graph data, the reporter set, the never-reporters, and the check-first
 * precedence, all on one state: the built precedence fixture holding an
 * audit session and a git baseline, B text-edited (stale, valid), `.xspec`
 * staged unwritable by T14-9's graph-data staging (`graphDataRefusal`: the
 * area and every path of T13.3-2's operational path set, the journal, the
 * session directory, and the lock path keeping their modes) before each
 * read's invocation (the reads take no hold) and, for the mutating `review
 * create`, at the seam of 13.5 — after acquisition, before any
 * modification (T14-9; `runHeldWithStaging`), the staging otherwise
 * refusing acquisition's creation of the lock directory first. Every
 * refreshing read of 13.3 and `review create` exit 2 with the
 * error document concerning `.xspec` (14.24: a graph-data write concerns
 * the area); `check` exits 1 with the staleness alone — every finding
 * condition 10 concerning a path with `locations` `[]` and instructing
 * rebuilding, B's generated module `specs/b/B.xspec.ts` among them (14.10,
 * 14, 12.7; `assertEditedBStalenessConcerns`) — `inventory` and
 * `version` exit 0, a `rename --preview` exits 0 writing nothing; the
 * invalid-flag-value and unknown-node usage errors precede the refresh
 * (`code` null); nothing in the workspace changes around the sweep.
 */
async function reportersArm(product: ProductBinding): Promise<void> {
  const context =
    "T14-9 reporters: the stale, session-bearing workspace with .xspec unwritable";
  const prepared = await prepareRefusalWorkspace(
    product,
    PRECEDENCE_FIXTURE,
    context,
  );
  const { workspace, baseline } = prepared;
  try {
    await expectExit(
      product,
      workspace,
      ["review", "create", "--strategy", "audit", "--name", SESSION],
      0,
      `${context} staging \`review create --strategy audit --name s\` (SPEC 10.7)`,
    );
    await workspace.edit(RENAME_B_PATH, B_EDIT_FROM, B_EDIT_TO);
    const staged = await snapshotWorkspace(workspace.root);
    const staging = await graphDataRefusal()(workspace.root);
    try {
      const reporters: readonly (readonly string[])[] = [
        ["ids", "--json"],
        ["show", SHOW_IDENTITY, "--json"],
        ["coverage", "--json"],
        ["impact", "--base", baseline, "--json"],
        ["review", "status", SESSION, "--json"],
        ["query", "nodes"],
        ["occurrences"],
        ["view", RENAME_A_PATH],
        ["at", RENAME_A_PATH, "0"],
      ];
      for (const argv of reporters) {
        const label = `${context} \`${argv.join(" ")}\``;
        expectRefusal(
          await runSettled(product, workspace, argv, label),
          [GRAPH_DATA_AREA],
          `${label} — a refreshing read of 13.3 whose graph-data write the ` +
            `environment refuses reports the write failure concerning the ` +
            `graph-data area, never a path inside it, and answers nothing ` +
            `(SPEC 14.24, 11.6, 13.3)`,
        );
      }

      // Never-reporters on the same state (14.24: never `check` or any other
      // command that writes nothing; 6.6: a preview writes nothing).
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
        `${checkLabel} — \`check\` writes nothing, so it is never a 14.24 ` +
          `reporter: on the same state it exits 1 with the staleness ` +
          `(SPEC 14.24, 12.2)`,
      );
      const checkFindings = decodeFindingsReport(
        parseJsonStdout(checkResult, checkLabel),
        checkLabel,
      ).findings;
      if (checkFindings.length === 0) {
        fail(
          `${checkLabel}: exit 1 carries the staleness findings (SPEC 12.2, 14.10)`,
        );
      }
      for (const finding of checkFindings) {
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
        checkFindings,
        `${checkLabel} — the staleness of B's edited text`,
      );
      await runJson(
        product,
        workspace,
        ["inventory"],
        `${context} \`inventory\` — \`inventory\` parses no sources and ` +
          `writes nothing: exit 0 with its answer on the stale workspace ` +
          `whose graph-data area is unwritable (SPEC 14.24, 11.6)`,
      );
      await runJson(
        product,
        workspace,
        ["version"],
        `${context} \`version\` — \`version\` writes nothing and loads no ` +
          `configuration: exit 0 (SPEC 14.24, 12.6)`,
      );
      const previewArgv = [
        "rename",
        RENAME_B_PATH,
        "b",
        "b2",
        "--preview",
        "--json",
      ];
      const previewLabel = `${context} \`${previewArgv.join(" ")}\``;
      const preview = await runSettled(
        product,
        workspace,
        previewArgv,
        previewLabel,
      );
      assertExitCode(
        preview,
        0,
        `${previewLabel} — a preview writes nothing — no sources, no ` +
          `journal, no derived files, no graph data — so it exits 0 on the ` +
          `valid, stale workspace, refreshing nothing (SPEC 6.6, 14.24)`,
      );

      // Precedence: the checks of 12.0 precede the write (and the refresh).
      expectPlainUsageError(
        await runSettled(
          product,
          workspace,
          ["query", "nodes", "--group", CODE_GROUP],
          `${context} \`query nodes --group ${CODE_GROUP}\``,
        ),
        `an invalid flag value — a code group's name under \`--group\` (SPEC 11.1)`,
        `${context} \`query nodes --group ${CODE_GROUP}\``,
      );
      const missing = `${RENAME_A_PATH}#missing`;
      expectPlainUsageError(
        await runSettled(
          product,
          workspace,
          ["query", "node", missing],
          `${context} \`query node ${missing}\``,
        ),
        "an unknown node identity named in an argument (SPEC 12.0)",
        `${context} \`query node ${missing}\``,
      );
    } finally {
      await staging.restore();
    }

    // The mutating `review create` on the same state, the same staging
    // applied at the seam (T14-9: after acquisition, before any
    // modification), restored once it exits.
    const createArgv = [
      "review",
      "create",
      "--strategy",
      "audit",
      "--name",
      NEW_SESSION,
      "--json",
    ];
    const createLabel = `${context} \`${createArgv.join(" ")}\` held at the seam`;
    expectRefusal(
      await runHeldWithStaging(
        product,
        workspace,
        createArgv,
        "hold-t14-9-reporters.tmp",
        graphDataRefusal(),
        createLabel,
      ),
      [GRAPH_DATA_AREA],
      `${createLabel} — a review mutator refreshes before its session write ` +
        `(13.5): with \`.xspec\` staged unwritable once it has acquired, its ` +
        `refused graph-data write reports the write failure concerning the ` +
        `graph-data area, never a path inside it — nor the lock path, ` +
        `release's refused deletion of the emptied lock directory changing ` +
        `no outcome — and no session is created (SPEC 14.24, 11.6, 13.3, ` +
        `13.5)`,
    );
    assertSnapshotsEqual(
      staged,
      await snapshotWorkspace(workspace.root),
      `${context}: nothing in the workspace changes around the sweep and ` +
        `the held \`review create\` — a refresh writes graph data alone ` +
        `(refused), a preview writes nothing, the usage errors precede every ` +
        `write, and a session is written last, never once a write is refused ` +
        `(SPEC 13.3, 6.6, 12.0, 13.5; H-6: the lock path, which the held ` +
        `run's acquisition and release touch, left out)`,
    );
    await assertRecovers(product, workspace, context);
  } finally {
    await workspace.dispose();
  }
}

/**
 * Precedence, the failing twin: an identically prepared workspace whose
 * sources also fail validation (A's `d` reference respelled to resolve
 * nowhere, 14.5) beside the staleness edit — with `.xspec` staged
 * unwritable by T14-9's graph-data staging (`graphDataRefusal`), `ids`
 * exits 1 with the findings: nothing is written on a failing workspace
 * (13.3), so no write is refused, and a product attempting the refresh
 * first fails here.
 */
async function failingTwinArm(product: ProductBinding): Promise<void> {
  const context =
    "T14-9 precedence: `ids --json` on the failing, stale twin with .xspec unwritable";
  const prepared = await prepareRefusalWorkspace(
    product,
    PRECEDENCE_FIXTURE,
    context,
  );
  const { workspace } = prepared;
  try {
    await workspace.edit(RENAME_B_PATH, B_EDIT_FROM, B_EDIT_TO);
    await workspace.edit(RENAME_A_PATH, A_REFERENCE, A_UNRESOLVED);
    const staged = await snapshotWorkspace(workspace.root);
    const result = await runStaged(
      product,
      workspace,
      ["ids", "--json"],
      graphDataRefusal(),
      context,
    );
    assertExitCode(
      result,
      1,
      `${context} — the gate of 13.3 turns the read back with the ` +
        `workspace's findings, exit 1: nothing is written on a failing ` +
        `workspace, so no write is refused (SPEC 13.3, 14.24, 12.0)`,
    );
    assertConditionCounts(
      decodeFindingsReport(parseJsonStdout(result, context), context).findings,
      { "14.5": 1 },
      `${context} — exactly the staged condition, A's unresolved \`d\` ` +
        `reference (SPEC 14.5, 13.3)`,
    );
    assertSnapshotsEqual(
      staged,
      await snapshotWorkspace(workspace.root),
      `${context}: nothing written on the failing workspace (SPEC 13.3)`,
    );
    // Recovery: the harness's own invalidity reverted, then `build`/`check`.
    await workspace.edit(RENAME_A_PATH, A_UNRESOLVED, A_REFERENCE);
    await assertRecovers(product, workspace, context);
  } finally {
    await workspace.dispose();
  }
}

/**
 * Precedence, a validation refusal under (a)'s staging: an
 * identity-unchanged rename (T6.4-3) with `specs/b` staged unwritable at the
 * seam exits 1 with its refusal reported alone — exactly one finding,
 * `refused-identity-unchanged`, concerning the unchanged identity: its
 * `identities` exactly `["specs/b/B.mdx#b"]`, `locations` `[]`, `path`
 * null (14, 1.5, 12.7) — and attempts no write: the workspace
 * byte-unchanged (6.4, 13.5).
 */
async function validationRefusalArm(product: ProductBinding): Promise<void> {
  const context =
    "T14-9 precedence: `rename specs/b/B.mdx b b --json` refused by validation with specs/b unwritable";
  const prepared = await prepareRefusalWorkspace(
    product,
    RENAME_FIXTURE,
    context,
  );
  const { workspace } = prepared;
  try {
    const result = await runHeldWithStaging(
      product,
      workspace,
      ["rename", RENAME_B_PATH, "b", "b", "--json"],
      "hold-t14-9-refused.tmp",
      refusalUnder(RENAME_B_DIR),
      context,
    );
    assertExitCode(
      result,
      1,
      `${context} — an identity-unchanged rename is refused by validation: ` +
        `exit 1 with its refusal, before any write (SPEC 6.4, 12.0, 14.24)`,
    );
    const findings = decodeFindingsReport(
      parseJsonStdout(result, context),
      context,
    ).findings;
    const codes = findings.map((finding) => finding.code);
    if (codes.length !== 1 || codes[0] !== "refused-identity-unchanged") {
      fail(
        `${context} — the refusal is reported alone: exactly one finding, ` +
          `its stable code \`refused-identity-unchanged\`, never a write ` +
          `failure beside it (SPEC 6.4, 14); got ${JSON.stringify(codes)}`,
      );
    }
    // The reason concerns the unchanged identity alone: the sole element of
    // its `identities`, in 1.5's form over the rename's file, with no
    // in-source location and no concerned path (SPEC 14, 1.5, 6.4; 12.7).
    const refusal = findings[0]!;
    const concern =
      `${context} — the identity-unchanged refusal concerns the unchanged ` +
      `identity ${RENAME_OLD_IDENTITY}`;
    assertRefusalIdentities(
      refusal,
      "refused-identity-unchanged",
      [RENAME_OLD_IDENTITY],
      `${concern}, carried as the sole element of its \`identities\` in ` +
        `1.5's form over the rename's file, \`<file>#id\` (SPEC 14, 1.5, 6.4)`,
    );
    assertSameJson(
      refusal.locations,
      [],
      `${concern}, locating nothing in source: \`locations\` [] (SPEC 14, ` +
        `1.5, 6.4; 12.7)`,
    );
    if (refusal.path !== null) {
      fail(
        `${concern}, never a path: \`path\` null (SPEC 14, 1.5, 6.4; 12.7); ` +
          `got ${JSON.stringify(refusal.path)} (message: ` +
          `${JSON.stringify(refusal.message)})`,
      );
    }
    assertSnapshotsEqual(
      prepared.before,
      await snapshotWorkspace(workspace.root),
      `${context}: no write attempted — the refused rename modifies ` +
        `nothing (SPEC 6.4, 13.5)`,
    );
    await assertRecovers(product, workspace, context);
  } finally {
    await workspace.dispose();
  }
}

/**
 * Precedence, the hold file: `--test-hold` naming a path in a read-only
 * directory (staged under T14-9's path-form discipline, beside the
 * workspace) — the hold file cannot be created, 13.5's usage error: exit 2,
 * the error document with `code` null, never this condition; nothing
 * modified.
 */
async function holdFileArm(product: ProductBinding): Promise<void> {
  const context =
    "T14-9 precedence: `rename specs/b/B.mdx b b2 --test-hold <read-only directory>/hold.tmp --json`";
  const prepared = await prepareRefusalWorkspace(
    product,
    RENAME_FIXTURE,
    context,
  );
  const { workspace } = prepared;
  try {
    const holdDir = path.join(workspace.tempRoot, "t14-9-read-only");
    await fsp.mkdir(holdDir);
    const hold = path.join(holdDir, "hold.tmp");
    const staging = await stageWriteRefusal(hold);
    try {
      expectPlainUsageError(
        await runSettled(
          product,
          workspace,
          [...RENAME_B_TO_B2, "--test-hold", hold],
          context,
        ),
        "a hold file that cannot be created — the usage error of 13.5, " +
          "never a write of 14.24 (SPEC 13.5, 14.24)",
        context,
      );
    } finally {
      await staging.restore();
    }
    assertSnapshotsEqual(
      prepared.before,
      await snapshotWorkspace(workspace.root),
      `${context}: nothing modified — the hold file is created before any ` +
        `modification, and its failure stops the command (SPEC 13.5)`,
    );
    await assertRecovers(product, workspace, context);
  } finally {
    await workspace.dispose();
  }
}

// ---------------------------------------------------------------------------
// Acquisition's writes (SPEC 13.5, 14.24), staged before the invocation
// ---------------------------------------------------------------------------

/** What the plain file an arm stages at `.xspec` holds. */
const AREA_OCCUPANT_BYTES =
  "Not the graph-data area: an occupant T14-9 deletes by hand.\n";

/**
 * One of acquisition's writes refused (TEST-SPEC T14-9; SPEC 13.5, 14.24):
 * the write, the staging refusing it — T13.5-10(a)'s or (d)'s, applied
 * before the invocation and verified on the harness itself — the concerned
 * path, and the mutating command run against it.
 */
interface AcquisitionWriteArm {
  /** The write the staging refuses, as T14-9 names it. */
  readonly write: string;
  /** The staging, as T13.5-10 words it. */
  readonly staging: string;
  /**
   * The concerned path (SPEC 14.24): the lock path for a write of
   * acquisition, never an entry's or a leftover's own path; the area's own
   * path for the write producing the area's directory and for one its
   * occupant obstructs.
   */
  readonly path: typeof LOCK_PATH | typeof AREA_PATH;
  /** The mutating command run against it: its index in T13.5-10's five. */
  readonly operation: number;
  /**
   * Staged on an unbuilt workspace — no `.xspec`, no session — rather than
   * on T13.5-10's session staging (`stageArmWorkspace`).
   */
  readonly unbuilt?: true;
  /**
   * Stage it before the invocation, verified on the harness itself; its
   * `restore()` reinstates every mode the staging changed (idempotent).
   */
  readonly stage: (
    workspace: TestWorkspace,
    context: string,
  ) => Promise<AcquisitionStaging>;
  /**
   * Its undoing beyond the permissions, before recovery: the occupant of
   * the area's own path deleted by hand (SPEC 13.4: the remedy for an
   * occupant obstructing acquisition, T13.4-12).
   */
  readonly remedy?: (workspace: TestWorkspace) => Promise<void>;
}

/**
 * T14-9's acquisition-write arms, one per write (two stagings for a
 * leftover's removal, as T13.5-10(d) stages it), each with the next of
 * T13.5-10's mutating commands — `rename`, `move`, `review create`,
 * `resolve`, `split`, the sixth arm's wrapping to `rename` — so that each
 * reports one of acquisition's refused writes.
 */
const ACQUISITION_WRITE_ARMS: readonly AcquisitionWriteArm[] = [
  {
    write: "the entry's addition",
    staging: "an empty leftover lock directory refusing writes (`r-x`)",
    path: LOCK_PATH,
    operation: 0,
    stage: (workspace) => stageUnwritableLockDirectory(workspace),
  },
  {
    write: "a leftover's removal",
    staging:
      "a lock directory holding a subdirectory that holds a file, the " +
      "subdirectory refusing writes (`r-x`)",
    path: LOCK_PATH,
    operation: 1,
    stage: (workspace) => stageUnwritableLeftoverDirectory(workspace),
  },
  {
    write: "a leftover's removal",
    staging:
      "a plain file at `.xspec/lock` with `.xspec` read-only and the file " +
      "unwritable (T14-9's full discipline)",
    path: LOCK_PATH,
    operation: 2,
    stage: (workspace) => stageUnremovableLockFile(workspace),
  },
  {
    write: "the lock directory's creation",
    staging: "a read-only `.xspec` holding no `lock`",
    path: LOCK_PATH,
    operation: 3,
    stage: (workspace) => stageReadOnlyArea(workspace),
  },
  {
    write: "the area directory's creation",
    staging:
      "an unbuilt workspace, its root read-only (`review split` naming the " +
      "absent session `s`, acquisition preceding that check, 12.0)",
    path: AREA_PATH,
    operation: 4,
    unbuilt: true,
    stage: (workspace) => stageReadOnlyRoot(workspace),
  },
  {
    write: "an occupant of the area's own path",
    staging: "`.xspec` a plain file",
    path: AREA_PATH,
    operation: 0,
    stage: async (workspace, context) => {
      await obstructArea(
        workspace,
        { kind: "file", content: AREA_OCCUPANT_BYTES },
        context,
      );
      // No mode changed: nothing to restore or reapply.
      return {
        restore: async () => undefined,
        reapply: async () => undefined,
      };
    },
    remedy: async (workspace) => {
      await fsp.unlink(path.join(workspace.root, AREA_PATH));
    },
  },
];

/**
 * T13.5-10's mutating command at `index` (a harness error where none):
 * T14-9's acquisition-write arms and T14-10's arm (i) each name theirs so.
 */
function acquisitionOperation(index: number): SessionOperation {
  const operation = T13_5_10_OPERATIONS[index];
  if (operation === undefined) {
    throw new Error(
      `acquisitionOperation: T13.5-10 runs no mutating command at index ` +
        String(index),
    );
  }
  return operation;
}

/**
 * One acquisition-write arm (TEST-SPEC T14-9): on a fresh CONF-CORE-shaped
 * workspace — T13.5-10's session staging, or unbuilt where the arm says so
 * (`resolve` and `split` then naming the absent session `s`) — the arm
 * staged before the invocation, verified on the harness itself; its
 * command under `--json`, settled; the staging's modes restored once it
 * exits → the 14.24 contract (`expectRefusal`: exit 2, the error document
 * as stdout, `code` `"write-failure"`, `path` the arm's concerned path
 * exactly, a non-empty stderr); nothing modified — every path but the lock
 * path byte-identical, the compare bracketing this run alone (H-6: the lock
 * path a mutating run touched left out, its residue T13.5-10(d)'s subject;
 * `.xspec` itself compared); and recovery — the arm's remedy where it has
 * one, then `build` exits 0 and `check` is clean (12.1, 13.4).
 */
async function acquisitionWriteRun(
  product: ProductBinding,
  arm: AcquisitionWriteArm,
): Promise<void> {
  const operation = acquisitionOperation(arm.operation);
  const context =
    `T14-9 acquisition's writes: ${operation.what} --json with ` +
    `${arm.staging} — ${arm.write} refused`;
  const workspace = await TestWorkspace.create(CORE_DECL);
  try {
    const items =
      arm.unbuilt === true
        ? ABSENT_SESSION_ITEMS
        : await stageArmWorkspace(product, workspace, context);
    const staging = await arm.stage(workspace, context);
    let before: DirectorySnapshot;
    let result: RunResult;
    try {
      before = await snapshotWorkspace(workspace.root);
      result = await runSettled(
        product,
        workspace,
        [...operation.argv(items), "--json"],
        context,
      );
    } finally {
      await staging.restore();
    }
    expectRefusal(
      result,
      [arm.path],
      arm.path === LOCK_PATH
        ? `${context} — a write of acquisition the environment refuses ` +
            `concerns the lock path \`${LOCK_PATH}\`, never an entry's or ` +
            `a leftover's own path, its entries' names being opaque (SPEC ` +
            `14.24, 13.5, 13.4)`
        : `${context} — a write of acquisition producing the area's ` +
            `directory, or obstructed by the area's own path holding ` +
            `anything but a directory, concerns that path, ` +
            `\`${AREA_PATH}\` (SPEC 14.24, 13.5)`,
    );
    assertSnapshotsEqual(
      before,
      await snapshotWorkspace(workspace.root),
      `${context}: modifies nothing — acquisition precedes every ` +
        `modification and the command stops at the refused write, so every ` +
        `path but the lock path is byte-identical, the area's own path ` +
        `included (SPEC 13.5, 14.24; H-6: the lock path, which acquisition ` +
        `and release touch, left out)`,
    );
    if (arm.remedy !== undefined) await arm.remedy(workspace);
    await assertRecovers(product, workspace, context);
  } finally {
    await workspace.dispose();
  }
}

/**
 * T14-9's acquisition-write arms, in turn (TEST-SPEC T14-9: acquisition's
 * writes, staged before the invocation, T13.5-10(a), (d)). Exported so
 * scratch probes can run them alone, against the CONF-CORE reference among
 * others; Linux leg only, as T14-9's other arms (E-1).
 */
export async function runT149AcquisitionArms(
  product: ProductBinding,
): Promise<void> {
  for (const arm of ACQUISITION_WRITE_ARMS) {
    await acquisitionWriteRun(product, arm);
  }
}

// ---------------------------------------------------------------------------
// T14-9 — write failures (14.24)
// ---------------------------------------------------------------------------

const T14_9 = defineProductTest({
  id: "T14-9",
  title:
    "write failures (14.24): a write the environment refuses is a usage error — exit 2, the error document (`code` `write-failure`, `path` the concerned path) on stdout, the diagnostic on stderr, never a finding — from every command making the write and met only at the write it refuses; one arm per concerned path through T13.5-7's stagings: a derived path under specs/b/ (`build`), an emitted Markdown file under out/specs (`move`), the rewritten source specs/b/B.mdx and the journal (`rename`), the session file (`review resolve`), a relocation's origin removal and destination production (`move`), and the graph-data area `.xspec` from every refreshing read of 13.3 and `review create` (staged at the seam) on a stale workspace under the graph-data staging (`.xspec` and every directory of T13.3-2's operational path set read-only, every file of it unwritable, the journal, the session directory, and the lock path keeping their modes) — while `check` exits 1 with the staleness, `inventory` and `version` exit 0, and a `--preview` exits 0 writing nothing; acquisition's writes through T13.5-10's stagings, each staged before the invocation, each mutating command in turn: the entry's addition, a leftover's removal (an `r-x` leftover directory; a plain file at the lock path under the full discipline), and the lock directory's creation concerning `.xspec/lock`, never an entry's path, and the area directory's creation (an unbuilt workspace, its root read-only) and an occupant of the area's own path (`.xspec` a plain file) concerning `.xspec`, each modifying nothing; precedence: the invalid-flag-value and unknown-node usage errors (`code` null), the failing twin's findings (`ids` exit 1), a validation refusal under (a)'s staging (exit 1, no write), and a hold file in a read-only directory (13.5's usage error, `code` null); after every arm, permissions restored (an occupant of the area's own path deleted by hand), `build` exits 0 and `check` is clean (SPEC 14.24, 12.0, 12.7, 13.3, 13.5)",
  run: async (product) => {
    // E-1: permission stagings belong to the Linux leg; elsewhere the arms
    // are not staged (the NU3_STAGED pattern of section-11.5) and no other
    // leg selects T14-9 (E-6).
    if (!WRITE_REFUSALS_STAGED) return;
    await rewrittenSourceArm(product);
    await journalArm(product);
    await markdownArm(product);
    await originRemovalArm(product);
    await destinationProductionArm(product);
    await sessionFileArm(product);
    await derivedPathArm(product);
    await reportersArm(product);
    await failingTwinArm(product);
    await validationRefusalArm(product);
    await holdFileArm(product);
    await runT149AcquisitionArms(product);
  },
});

// ---------------------------------------------------------------------------
// T14-10 — read failures (14.25): fixtures and shared helpers
// ---------------------------------------------------------------------------

/** E-1: the read-refusal stagings belong to the same Linux leg (T14-9's gate). */
const READ_REFUSALS_STAGED = WRITE_REFUSALS_STAGED;

/** 14.25's stable code, carried only by the exit-2 error document (SPEC 14). */
const READ_FAILURE_CODE = "read-failure";
/** The configuration path in the anchoring form, from the root (SPEC 11.6). */
const CONFIG_PATH = "xspec.config.ts";
/** Arm (f)'s file-form move of C within its own directory (SPEC 6.5, 6.6). */
const MOVE_C_DESTINATION = "specs/c/D.mdx";

// Arm (a)'s fixture: `specs/A.mdx` references `specs/B.mdx` (a `d`
// reference — the one 14.5 the masking leaves), B references `specs/C.mdx`
// (B's own spelling, the occurrence the masking hides), `specs/D.mdx`
// references C too (the record that stays on view), and the code source
// `src/app.ts` marks A's section (the marker's occurrence, hidden when the
// code source is the refused one). No cycle: A → B → C ← D.
const SOURCE_A_PATH = "specs/A.mdx";
const SOURCE_B_PATH = "specs/B.mdx";
const SOURCE_C_PATH = "specs/C.mdx";
const SOURCE_D_PATH = "specs/D.mdx";
const SOURCE_CODE_PATH = "src/app.ts";
const SOURCE_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: {
    ${CODE_GROUP}: ["src/**/*.ts"]
  }
})
`;
const SOURCE_DECL: WorkspaceDecl = {
  files: {
    [CONFIG_PATH]: SOURCE_CONFIG,
    [SOURCE_A_PATH]: [
      'import B from "./B.xspec"',
      "",
      '<S id="a" d={B.b}>',
      "Alpha text.",
      "</S>",
      "",
    ].join("\n"),
    [SOURCE_B_PATH]: [
      'import C from "./C.xspec"',
      "",
      '<S id="b" d={C.c}>',
      "Beta text.",
      "</S>",
      "",
    ].join("\n"),
    [SOURCE_C_PATH]: ['<S id="c">', "Ceta text.", "</S>", ""].join("\n"),
    [SOURCE_D_PATH]: [
      'import C from "./C.xspec"',
      "",
      '<S id="d" d={C.c}>',
      "Delta text.",
      "</S>",
      "",
    ].join("\n"),
    [SOURCE_CODE_PATH]: [
      'import A from "../specs/A.xspec";',
      "",
      "A.a;",
      "",
    ].join("\n"),
  },
};

// Arm (g)'s fixture: the rename fixture plus a source under `specs/sub`, a
// directory the discovery of SPEC 7 lists under the glob `specs/**/*.mdx`.
// Arm (g) follows T14-10's earlier arms' invocations, so the source is a
// staged-source record (S-9, test/self/s9-staged-sources.test.ts), staged
// by the prepared workspace and the invalid-configuration one alike.
const SUB_DIR = "specs/sub";
const SUB_PATH = `${SUB_DIR}/S.mdx`;
const LISTING_FIXTURE: RefusalFixture = {
  decl: {
    files: {
      ...RENAME_FIXTURE.decl.files,
      [SUB_PATH]: stagedMdx(
        "T14-10 specs/sub/S.mdx (arm (g)'s listing fixture: the source under the unlistable directory)",
        ['<S id="s">', "Sub text.", "</S>", ""].join("\n"),
      ),
    },
  },
  priorRename: RENAME_FIXTURE.priorRename,
};
/**
 * The rename fixture's configuration with an unknown top-level key (14.14):
 * a staged-source record (S-9), since arm (g)'s invalid-configuration
 * workspace follows the body's first product invocation.
 */
const INVALID_CONFIG = stagedTs(
  "T14-10 (g) xspec.config.ts (the rename fixture's configuration with an unknown top-level key, 14.14)",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  bogus: true
})
`,
);

/** A freshly built, valid workspace and its pre-staging snapshot. */
interface BuiltWorkspace {
  readonly workspace: TestWorkspace;
  readonly before: DirectorySnapshot;
}

/** Stage a declared workspace, `build` it, and see `check` clean (SPEC 12.1, 12.2). */
async function prepareBuiltWorkspace(
  product: ProductBinding,
  decl: WorkspaceDecl,
  context: string,
): Promise<BuiltWorkspace> {
  const workspace = await TestWorkspace.create(decl);
  try {
    await buildOk(
      product,
      workspace,
      `${context} staging \`build\` (SPEC 12.1)`,
    );
    await expectExit(
      product,
      workspace,
      ["check"],
      0,
      `${context} staging \`check\` — a freshly built, valid workspace (SPEC 12.2)`,
    );
    return { workspace, before: await snapshotWorkspace(workspace.root) };
  } catch (error) {
    await workspace.dispose();
    throw error;
  }
}

/**
 * A refused read's 14.25 contract: exit 2; the error document as the entire
 * stdout, its finding's stable code `read-failure` and `path` the object's
 * workspace-relative path; the diagnostic on stderr (12.0).
 */
function expectReadFailure(
  result: RunResult,
  concerned: string,
  context: string,
): Finding {
  assertExitCode(
    result,
    2,
    `${context} — a read the environment refuses is a usage error: the ` +
      `command stops at that read, attempting nothing further, and exits ` +
      `2 — never a finding, never an internal error (SPEC 14.25, 12.0)`,
  );
  const finding = expectErrorDocument(result, context);
  if (finding.code !== READ_FAILURE_CODE) {
    fail(
      `${context} — the error document's finding carries the stable code ` +
        `${JSON.stringify(READ_FAILURE_CODE)} (SPEC 14.25, 14, 12.7); got ` +
        `${JSON.stringify(finding.code)} (message: ` +
        `${JSON.stringify(finding.message)})`,
    );
  }
  if (finding.path !== concerned) {
    fail(
      `${context} — the concerned path is the refused object's ` +
        `workspace-relative path ${JSON.stringify(concerned)} (SPEC 14.25, ` +
        `12.7); got ${JSON.stringify(finding.path)} (message: ` +
        `${JSON.stringify(finding.message)})`,
    );
  }
  if (result.stderr.trim().length === 0) {
    fail(
      `${context} — the diagnostic accompanies the error document on ` +
        `standard error (SPEC 14.25, 12.0: usage-error messages are ` +
        `standard-error content); got an empty stderr beside ` +
        `${JSON.stringify(finding.message)}`,
    );
  }
  return finding;
}

/** An exit-2 error of the syntax class: `code` null, no configuration loaded. */
function expectSyntaxClassError(
  result: RunResult,
  why: string,
  context: string,
): void {
  assertExitCode(
    result,
    2,
    `${context} — ${why} is a syntax-class usage error, exit 2, reported ` +
      `without loading configuration and so before the discovery read the ` +
      `environment refuses (SPEC 12.0, 14.25)`,
  );
  const finding = expectErrorDocument(result, context);
  if (finding.code !== null) {
    fail(
      `${context} — ${why} carries no stable code: \`code\` is null where ` +
        `14 assigns none, never \`read-failure\` (SPEC 14, 12.7, 12.0); got ` +
        `${JSON.stringify(finding.code)} (message: ` +
        `${JSON.stringify(finding.message)})`,
    );
  }
}

/**
 * A findings-report surface under a staging: the exact exit code (a hang
 * becomes a diagnosed failure), the findings-only document `{"findings":
 * […]}` as the entire stdout, decoded form-exact (SPEC 12.7).
 */
async function stagedFindings(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  exitCode: number,
  context: string,
): Promise<readonly Finding[]> {
  const result = await runSettled(product, workspace, argv, context);
  assertExitCode(result, exitCode, context);
  return decodeFindingsReport(parseJsonStdout(result, context), context)
    .findings;
}

/** A staged run expected to exit `exitCode`, its stdout parsed as one document. */
async function stagedDocument(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  exitCode: number,
  context: string,
): Promise<unknown> {
  const result = await runSettled(product, workspace, argv, context);
  assertExitCode(result, exitCode, context);
  return parseJsonStdout(result, context);
}

/**
 * The one condition-20 finding for the refused source `file`: its one
 * location the zero-length range at offset 0 (SPEC 14: an unparseable
 * source carries one zero-length range at the failure's offset — for a
 * refused read, 0; 14.25).
 */
function requireRefusedSourceFinding(
  findings: readonly Finding[],
  file: string,
  context: string,
): Finding {
  const matching = findings.filter((finding) => finding.condition === "14.20");
  const finding = matching[0];
  if (matching.length !== 1 || finding === undefined) {
    return fail(
      `${context}: exactly one condition-20 finding — the refused source, ` +
        `masked exactly as an unparseable one (SPEC 14.25, 14.20); got ` +
        `${String(matching.length)}: ` +
        JSON.stringify(
          matching.map(({ code, message }) => ({ code, message })),
        ),
    );
  }
  assertSameJson(
    finding.locations,
    [{ file, range: { start: 0, end: 0 } }],
    `${context}: the refused read's one location is the zero-length range ` +
      `at offset 0 in ${file} — content that cannot be read parses as ` +
      `nothing (SPEC 14, 14.20, 14.25, 12.7)`,
  );
  return finding;
}

/** Nothing inside the refused source reports: no other finding locates in it. */
function assertMaskedFile(
  findings: readonly Finding[],
  file: string,
  context: string,
): void {
  for (const finding of findings) {
    if (finding.condition === "14.20") continue;
    if (finding.locations.some((location) => location.file === file)) {
      fail(
        `${context}: nothing inside the refused source reports — its ` +
          `content parses as nothing, so the file is masked exactly as an ` +
          `unparseable one (SPEC 14.20, 14.25, 11.2); got ` +
          `${JSON.stringify(finding.code)} located in ${file} (message: ` +
          `${JSON.stringify(finding.message)})`,
      );
    }
  }
}

/** The occurrence records a report lists for `file`. */
function recordsIn(report: OccurrencesReport, file: string): number {
  return report.occurrences.filter((record) => record.file === file).length;
}

/**
 * Restore each staging whose object still exists — a regeneration may have
 * replaced or removed a staged file or directory: a path occupied again
 * gets its recorded mode back, an absent one has nothing to reinstate.
 * Reverse order of staging.
 */
async function restoreSurviving(
  stagings: readonly PermissionStaging[],
): Promise<void> {
  for (let i = stagings.length - 1; i >= 0; i--) {
    const staging = stagings[i]!;
    if (await pathExists(staging.path)) await staging.restore();
  }
}

/**
 * Arm (f)'s directory mode, `-wx`: a graph-data directory's read permission
 * alone removed — its listing refused, its write and search permission kept
 * (TEST-SPEC T14-10(f): never the discipline's `--x`).
 */
const GRAPH_DATA_DIRECTORY_MODE = 0o300;

/** How many staged paths of each kind arm (f)'s description names. */
const STAGED_PATHS_NAMED = 6;

/** Arm (f)'s staging in effect: its stagings, and what it staged. */
interface GraphDataUnreadable {
  /** Every file's staging, then every directory's, each kind in byte order. */
  readonly stagings: readonly PermissionStaging[];
  /** What was staged, quoted by every diagnosis made under the staging. */
  readonly staged: string;
}

/** A count of staged paths and their names — the first few, then a count. */
function describeStagedPaths(
  keys: readonly string[],
  noun: readonly [one: string, many: string],
  mode: string,
): string {
  const named = keys.slice(0, STAGED_PATHS_NAMED).map(displaySnapshotPath);
  const rest = keys.length - named.length;
  return (
    `${String(keys.length)} ${keys.length === 1 ? noun[0] : noun[1]} at ` +
    `${mode} (${named.join(", ")}${rest > 0 ? `, and ${String(rest)} more` : ""})`
  );
}

/**
 * Arm (f)'s staging: every path under `.xspec/` other than the journal, the
 * session directory, and the lock path unreadable — T13.3-2's operational
 * path set, walked by the adapter layer's `collectGraphDataEntries`
 * (anything but a plain file or a directory in the set is skipped, the
 * lock path and everything under it never staged: no graph data, 13.4).
 * Every plain file at mode 0o200 (`-w-------`, its write permission kept)
 * and then every directory of the set by its read permission alone removed
 * ({@link GRAPH_DATA_DIRECTORY_MODE}, `-wx`: the harness's own listing of it
 * refused, its own creation and removal of a file in it kept), so only
 * reads are refused and the regeneration a refreshing read owes (13.3) is
 * never itself refused, whatever layout graph data takes; `.xspec` itself
 * is no path under it and keeps its mode. Every staging is verified on the
 * harness itself (E-1) and reaches its object at its exact name bytes,
 * whatever the name the product chose (SPEC 13.3). Where graph data holds
 * no directory, files alone are staged, and the description says so. At
 * least one file must exist: the staging applies to record files the
 * product itself wrote (H-3), and staging nothing would be no staging
 * (H-11). A staging that fails restores every one made before it.
 */
async function stageGraphDataUnreadable(
  workspace: TestWorkspace,
  context: string,
): Promise<GraphDataUnreadable> {
  const { files, directories } = await collectGraphDataEntries(workspace.root);
  if (files.length === 0) {
    throw new HarnessStagingError(
      "read-refusal-of-file",
      workspace.path(GRAPH_DATA_AREA),
      `${context}: no graph-data file found under ${GRAPH_DATA_AREA}/ ` +
        `outside the journal, the session directory, and the lock path — ` +
        `the staging applies to record files the product itself wrote ` +
        `after a successful build (SPEC 13.3, 12.1)`,
    );
  }
  const stagings: PermissionStaging[] = [];
  try {
    for (const key of files) {
      stagings.push(
        await stageReadRefusalOfFile(workspace.bytePath(snapshotKeyBytes(key))),
      );
    }
    for (const key of directories) {
      stagings.push(
        await stageDirectoryMode(
          workspace.bytePath(snapshotKeyBytes(key)),
          GRAPH_DATA_DIRECTORY_MODE,
          [
            { attempt: "list", refused: true },
            { attempt: "create", refused: false },
          ],
        ),
      );
    }
  } catch (error) {
    await restoreSurviving(stagings).catch(() => undefined);
    throw error;
  }
  const fileText = describeStagedPaths(files, ["file", "files"], "-w-------");
  const staged =
    directories.length === 0
      ? `graph data unreadable: ${fileText}; graph data holds no directory ` +
        `under ${GRAPH_DATA_AREA}/, so files alone are staged`
      : `graph data unreadable: ${fileText} and ` +
        describeStagedPaths(directories, ["directory", "directories"], "-wx");
  return { stagings, staged };
}

// ---------------------------------------------------------------------------
// (a) A discovered source's content — condition 20 (SPEC 14.25, 14.20, 11.2)
// ---------------------------------------------------------------------------

/**
 * The spec source `specs/B.mdx` staged unreadable: `build` and `check`
 * report the one condition-20 finding at offset 0 beside A's unresolved
 * reference (14.5) and nothing from inside B; `view` serves A's view, B
 * contributing none; `occurrences` lists no record for B's spelling while
 * D's stays; `at` on B reports the resolution explicitly unavailable at 0,
 * 7, and 999999 — never the out-of-range usage error. Nothing is modified;
 * restored, the workspace builds clean.
 */
async function specSourceSubArm(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
): Promise<void> {
  const before = await snapshotWorkspace(workspace.root);
  const staging = await stageReadRefusalOfFile(workspace.path(SOURCE_B_PATH));
  try {
    for (const argv of [
      ["build", "--json"],
      ["check", "--json"],
    ] as const) {
      const label = `${context} \`${argv.join(" ")}\` with ${SOURCE_B_PATH} unreadable`;
      const findings = await stagedFindings(
        product,
        workspace,
        argv,
        1,
        `${label} — a discovered source whose content the environment ` +
          `refuses is condition 20, a finding: exit 1 (SPEC 14.25, 14.20, ` +
          `12.0)`,
      );
      assertConditionCounts(
        findings,
        { "14.20": 1, "14.5": 1 },
        `${label} — the refused source is one condition-20 finding and A's ` +
          `reference into it reports as unresolved, nothing else (SPEC ` +
          `14.25, 14.20, 14.5)`,
      );
      requireRefusedSourceFinding(findings, SOURCE_B_PATH, label);
      const unresolved = findings.find(
        (finding) => finding.condition === "14.5",
      )!;
      assertFindingLocated(
        unresolved,
        { file: SOURCE_A_PATH },
        `${label} — the unresolved reference locates in ${SOURCE_A_PATH}, ` +
          `the referencing file (SPEC 14, 14.5)`,
      );
      assertMaskedFile(findings, SOURCE_B_PATH, label);
    }

    const viewArgv = ["view", SOURCE_A_PATH, SOURCE_B_PATH];
    const viewLabel = `${context} \`${viewArgv.join(" ")}\` with ${SOURCE_B_PATH} unreadable`;
    const view = decodeViewReport(
      await stagedDocument(
        product,
        workspace,
        viewArgv,
        1,
        `${viewLabel} — an answer carrying a finding exits 1 with the full ` +
          `answer document still emitted (SPEC 11.2, 12.0)`,
      ),
      { text: false },
      viewLabel,
    );
    assertSameJson(
      view.views.map((fileView) => fileView.file),
      [SOURCE_A_PATH],
      `${viewLabel} — the surface still answers per file: A's view is ` +
        `served and the refused B contributes none (SPEC 11.2, 11.4, 14.25)`,
    );
    assertConditionCounts(
      view.findings,
      { "14.20": 1, "14.5": 1 },
      `${viewLabel} — the findings of every domain file accompany the ` +
        `answer: B's condition-20 finding and A's unresolved reference ` +
        `(SPEC 11.2, 14.25)`,
    );
    requireRefusedSourceFinding(view.findings, SOURCE_B_PATH, viewLabel);

    const occLabel = `${context} \`occurrences\` with ${SOURCE_B_PATH} unreadable`;
    const occurrences = decodeOccurrencesReport(
      await stagedDocument(
        product,
        workspace,
        ["occurrences"],
        1,
        `${occLabel} — the domain's findings accompany the answer, exit 1 ` +
          `(SPEC 11.3, 11.2)`,
      ),
      occLabel,
    );
    if (recordsIn(occurrences, SOURCE_B_PATH) !== 0) {
      fail(
        `${occLabel} — no record for B's spellings: a spelling inside the ` +
          `refused source is hidden with the rest of it, pointed to only ` +
          `by the condition-20 finding (SPEC 11.2, 5.7, 14.25); got ` +
          `${String(recordsIn(occurrences, SOURCE_B_PATH))} record(s)`,
      );
    }
    if (recordsIn(occurrences, SOURCE_D_PATH) === 0) {
      fail(
        `${occLabel} — the surface still answers per file: D's resolving ` +
          `reference keeps its record while B is masked (SPEC 11.2, 11.3)`,
      );
    }
    assertConditionCounts(
      occurrences.findings,
      { "14.20": 1, "14.5": 1 },
      `${occLabel} — the entire discovered set's findings accompany the ` +
        `answer (SPEC 11.3, 11.2)`,
    );

    for (const offset of ["0", "7", "999999"]) {
      const atArgv = ["at", SOURCE_B_PATH, offset];
      const atLabel = `${context} \`${atArgv.join(" ")}\` with ${SOURCE_B_PATH} unreadable`;
      const report = decodeAtReport(
        await stagedDocument(
          product,
          workspace,
          atArgv,
          1,
          `${atLabel} — the resolution is reported explicitly unavailable ` +
            `beside the condition-20 finding, exit 1 — never the ` +
            `out-of-range usage error: the offset bound is judged only ` +
            `where the content was read (SPEC 11.5, 14.25)`,
        ),
        atLabel,
      );
      assertSameJson(
        report.resolution,
        { unavailable: true },
        `${atLabel} — the resolution is exactly the unavailability marker: ` +
          `never null, never a fabricated root resolution (SPEC 11.5, 11.2, ` +
          `12.7)`,
      );
      assertConditionCounts(
        report.findings,
        { "14.20": 1 },
        `${atLabel} — the consulted domain is the named file alone, its ` +
          `condition-20 finding accompanying (SPEC 11.5, 11.2)`,
      );
      requireRefusedSourceFinding(report.findings, SOURCE_B_PATH, atLabel);
    }
  } finally {
    await staging.restore();
  }
  assertSnapshotsEqual(
    before,
    await snapshotWorkspace(workspace.root),
    `${context}: nothing modified — a failing build and check, and the ` +
      `surfaces of 11.2 on a failing workspace, write nothing (SPEC 12.1, ` +
      `13.3, 11.2)`,
  );
  await assertRecovers(product, workspace, context);
}

/**
 * Separately, the code source `src/app.ts` staged unreadable: `build` and
 * `check` report its one condition-20 finding at offset 0 alone (no spec
 * source references a code source), and `occurrences` lists no record for
 * its marker while D's record stays. Nothing is modified; restored, the
 * workspace builds clean.
 */
async function codeSourceSubArm(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
): Promise<void> {
  const before = await snapshotWorkspace(workspace.root);
  const staging = await stageReadRefusalOfFile(
    workspace.path(SOURCE_CODE_PATH),
  );
  try {
    for (const argv of [
      ["build", "--json"],
      ["check", "--json"],
    ] as const) {
      const label = `${context} \`${argv.join(" ")}\` with ${SOURCE_CODE_PATH} unreadable`;
      const findings = await stagedFindings(
        product,
        workspace,
        argv,
        1,
        `${label} — a discovered code source whose content the environment ` +
          `refuses is condition 20, a finding: exit 1 (SPEC 14.25, 14.20, ` +
          `12.0)`,
      );
      assertConditionCounts(
        findings,
        { "14.20": 1 },
        `${label} — the refused code source is one condition-20 finding ` +
          `and nothing else: nothing inside it reports, and no spec source ` +
          `references a code source (SPEC 14.25, 14.20)`,
      );
      requireRefusedSourceFinding(findings, SOURCE_CODE_PATH, label);
    }
    const occLabel = `${context} \`occurrences\` with ${SOURCE_CODE_PATH} unreadable`;
    const occurrences = decodeOccurrencesReport(
      await stagedDocument(
        product,
        workspace,
        ["occurrences"],
        1,
        `${occLabel} — the entire discovered set is the domain, the code ` +
          `source's condition-20 finding accompanying: exit 1 (SPEC 11.3, ` +
          `11.2)`,
      ),
      occLabel,
    );
    if (recordsIn(occurrences, SOURCE_CODE_PATH) !== 0) {
      fail(
        `${occLabel} — no record for the refused code source's marker: a ` +
          `spelling inside a masked file is hidden with the rest of it ` +
          `(SPEC 11.2, 5.7, 14.25); got ` +
          `${String(recordsIn(occurrences, SOURCE_CODE_PATH))} record(s)`,
      );
    }
    if (recordsIn(occurrences, SOURCE_D_PATH) === 0) {
      fail(
        `${occLabel} — the surface still answers per file: D's resolving ` +
          `reference keeps its record (SPEC 11.2, 11.3)`,
      );
    }
    assertConditionCounts(
      occurrences.findings,
      { "14.20": 1 },
      `${occLabel} — the domain's findings are the code source's ` +
        `condition-20 finding alone (SPEC 11.3, 11.2)`,
    );
  } finally {
    await staging.restore();
  }
  assertSnapshotsEqual(
    before,
    await snapshotWorkspace(workspace.root),
    `${context}: nothing modified on the failing workspace (SPEC 12.1, 13.3, 11.2)`,
  );
  await assertRecovers(product, workspace, context);
}

/**
 * (a) A discovered source's content: the fixture built and clean, the
 * premise that B's `d` reference and the code source's marker each record an
 * occurrence when readable (so "no record" below is a masking, not an
 * absence), then the spec source and the code source each refused in turn.
 */
async function sourceContentArm(product: ProductBinding): Promise<void> {
  const context = "T14-10 (a) a discovered source's content";
  const { workspace } = await prepareBuiltWorkspace(
    product,
    SOURCE_DECL,
    context,
  );
  try {
    const premiseLabel = `${context} premise \`occurrences\` on the readable workspace`;
    const premise = decodeOccurrencesReport(
      await runJson(product, workspace, ["occurrences"], premiseLabel),
      premiseLabel,
    );
    for (const file of [SOURCE_B_PATH, SOURCE_CODE_PATH, SOURCE_D_PATH]) {
      if (recordsIn(premise, file) === 0) {
        fail(
          `${premiseLabel}: ${file}'s resolving reference records an ` +
            `occurrence — a \`d\` reference or a dependency marker whose ` +
            `target resolves (SPEC 5.7, 4.5) — so that its absence under ` +
            `the refusal below is the masking of 14.25, not an absence`,
        );
      }
    }
    await specSourceSubArm(product, workspace, `${context}, the spec source`);
    await codeSourceSubArm(product, workspace, `${context}, the code source`);
  } finally {
    await workspace.dispose();
  }
}

// ---------------------------------------------------------------------------
// (b) The journal's content — condition 13 (SPEC 14.25, 14.13, 13.3, 6.4)
// ---------------------------------------------------------------------------

/**
 * `.xspec/journal` staged unreadable on the journal-bearing rename fixture:
 * `build`, `check`, the gated `ids` (answering nothing), and the `rename`
 * (refused) each report the one condition-13 finding concerning the journal
 * and exit 1; `inventory` reports `journal.occupied` true, finding-free,
 * exit 0 — the kind read, permitted, is the only read it makes there.
 * Nothing is modified; restored, the workspace builds clean.
 */
async function journalContentArm(product: ProductBinding): Promise<void> {
  const context = "T14-10 (b) the journal's content";
  const prepared = await prepareRefusalWorkspace(
    product,
    RENAME_FIXTURE,
    context,
  );
  const { workspace } = prepared;
  try {
    const staging = await stageReadRefusalOfFile(workspace.path(JOURNAL_PATH));
    try {
      const reporters: readonly (readonly string[])[] = [
        ["build", "--json"],
        ["check", "--json"],
        ["ids", "--json"],
        RENAME_B_TO_B2,
      ];
      for (const argv of reporters) {
        const label = `${context} \`${argv.join(" ")}\` with ${JOURNAL_PATH} unreadable`;
        const findings = await stagedFindings(
          product,
          workspace,
          argv,
          1,
          `${label} — a journal the environment refuses to read is ` +
            `condition 13, a finding the workspace fails on: \`build\` and ` +
            `\`check\` report it, a gated read answers nothing but the ` +
            `findings, and a \`rename\` is refused — exit 1 with the ` +
            `findings-only document (SPEC 14.25, 14.13, 13.3, 6.4, 12.7)`,
        );
        assertConditionCounts(
          findings,
          { "14.13": 1 },
          `${label} — the journal error alone (SPEC 14.13, 14.25)`,
        );
        assertFindingConcernsPath(
          findings[0]!,
          JOURNAL_PATH,
          `${label} — the journal is the concerned path (SPEC 14, 14.13)`,
        );
      }
      const invLabel = `${context} \`inventory\` with ${JOURNAL_PATH} unreadable`;
      const inventory = decodeInventoryDocument(
        await stagedDocument(
          product,
          workspace,
          ["inventory"],
          0,
          `${invLabel} — the inventory reads the journal path's kind alone, ` +
            `permitted, never its content: a complete, finding-free ` +
            `answer, exit 0 (SPEC 11.6, 14.25)`,
        ),
        invLabel,
      );
      assertSameJson(
        inventory.findings,
        [],
        `${invLabel} — finding-free: the inventory reads no journal ` +
          `content, so it meets no condition-13 (SPEC 11.6, 14.25)`,
      );
      if (inventory.journal.occupied !== true) {
        fail(
          `${invLabel} — \`journal.occupied\` is true: occupancy by ` +
            `presence alone, the content unread (SPEC 11.6); got ` +
            `${String(inventory.journal.occupied)}`,
        );
      }
    } finally {
      await staging.restore();
    }
    assertSnapshotsEqual(
      prepared.before,
      await snapshotWorkspace(workspace.root),
      `${context}: nothing modified — a failing build, a gated read, a ` +
        `refused rename, and the inventory write nothing (SPEC 12.1, 13.3, ` +
        `6.4, 11.6)`,
    );
    await assertRecovers(product, workspace, context);
  } finally {
    await workspace.dispose();
  }
}

// ---------------------------------------------------------------------------
// (c) A session file's content — condition 21 (SPEC 14.25, 14.21, 10.1, 10.7)
// ---------------------------------------------------------------------------

/**
 * Arm (c)'s one corruption report, asked of each of its three reporters
 * (TEST-SPEC line 9's rule for an error report; the module header): exactly
 * one finding, condition 21 — its exact stable code `corrupt-session`, which
 * the condition count reads (the derived 14.21) — concerning the session
 * file `.xspec/reviews/s.json` as its 12.7 `path`, with no in-source
 * location (`locations` []; SPEC 14, 12.7). `label` names the reporter and
 * the staging.
 */
function assertSessionCorruptionAlone(
  findings: readonly Finding[],
  label: string,
): void {
  assertConditionCounts(
    findings,
    { "14.21": 1 },
    `${label} — exactly one finding, \`corrupt-session\` (SPEC 14.21, 10.1)`,
  );
  const finding = findings[0]!;
  assertFindingConcernsPath(
    finding,
    SESSION_FILE,
    `${label} — the session file is the concerned path (SPEC 14, 14.21)`,
  );
  assertSameJson(
    finding.locations,
    [],
    `${label} — a session condition has no in-source location: ` +
      `\`locations\` [] (SPEC 14, 12.7)`,
  );
}

/**
 * The audit session `s` created, its file staged unreadable: `check` and
 * `review status s` each report exactly one condition-21 finding concerning
 * the session file with no location, exit 1, nothing modified; `review
 * list` reports the session corrupt by name, exit 1, its listing carrying
 * that one `corrupt-session` finding likewise; `inventory` lists the
 * session, finding-free, exit 0 (selected by name alone, content unread).
 * Each of the three reports is judged by `assertSessionCorruptionAlone`.
 */
async function sessionContentArm(product: ProductBinding): Promise<void> {
  const context = "T14-10 (c) a session file's content";
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
    const before = await snapshotWorkspace(workspace.root);
    const staging = await stageReadRefusalOfFile(workspace.path(SESSION_FILE));
    try {
      for (const argv of [
        ["check", "--json"],
        ["review", "status", SESSION, "--json"],
      ] as const) {
        const label = `${context} \`${argv.join(" ")}\` with ${SESSION_FILE} unreadable`;
        const findings = await stagedFindings(
          product,
          workspace,
          argv,
          1,
          `${label} — a session file the environment refuses to read is ` +
            `corrupt, condition 21: reported by \`check\` and by the ` +
            `\`review\` subcommand naming it, exit 1, the findings-only ` +
            `document (SPEC 14.25, 14.21, 10.1, 12.7)`,
        );
        assertSessionCorruptionAlone(findings, label);
      }
      const listLabel = `${context} \`review list --json\` with ${SESSION_FILE} unreadable`;
      const list = decodeSessionListReport(
        await stagedDocument(
          product,
          workspace,
          ["review", "list", "--json"],
          1,
          `${listLabel} — \`list\` exits 1 when any session is corrupt ` +
            `(SPEC 10.7, 14.21)`,
        ),
        listLabel,
      );
      assertSameJson(
        list.sessions,
        [{ name: SESSION, corrupt: true }],
        `${listLabel} — the session reported corrupt by name, in place of ` +
          `its fields (SPEC 10.7, 14.21)`,
      );
      // The listing's condition 21, with no invocation of its own: `list`
      // reports the corrupt session (SPEC 14.21, exit 1) and carries its
      // finding under the document's "findings" member (12.7), which the
      // decoder requires while a session is listed corrupt — as `s` now
      // is. Exactly one finding, `corrupt-session` concerning the session
      // file with `locations` [], as `check` and `review status` report it
      // (the module header).
      const listFindings = list.findings;
      if (listFindings === undefined) {
        fail(
          `${listLabel} — the listing must carry the corrupt session's ` +
            `condition 21 under its "findings" member (SPEC 14.21, 12.7); ` +
            `the decoded document carries no such member`,
        );
      }
      assertSessionCorruptionAlone(
        listFindings,
        `${listLabel} — the listing's findings`,
      );
      const invLabel = `${context} \`inventory\` with ${SESSION_FILE} unreadable`;
      const inventory = decodeInventoryDocument(
        await stagedDocument(
          product,
          workspace,
          ["inventory"],
          0,
          `${invLabel} — the inventory lists sessions by name alone, ` +
            `reading no session content: finding-free, exit 0 (SPEC 11.6, ` +
            `14.25)`,
        ),
        invLabel,
      );
      assertSameJson(
        inventory.findings,
        [],
        `${invLabel} — finding-free (SPEC 11.6)`,
      );
      assertSameJson(
        inventory.sessions,
        [SESSION_FILE],
        `${invLabel} — the session listed by its file path (SPEC 11.6)`,
      );
    } finally {
      await staging.restore();
    }
    assertSnapshotsEqual(
      before,
      await snapshotWorkspace(workspace.root),
      `${context}: nothing modified — a corrupt session is reported, never ` +
        `repaired or replaced, and the reads write nothing (SPEC 14.21, ` +
        `10.1, 11.6)`,
    );
    await assertRecovers(product, workspace, context);
  } finally {
    await workspace.dispose();
  }
}

// ---------------------------------------------------------------------------
// (d) The configuration file's content — condition 14 (SPEC 14.25, 14.14, 7)
// ---------------------------------------------------------------------------

/**
 * `xspec.config.ts` staged unreadable: `build`, `ids`, `inventory`, and
 * `view` (representatives of every command but `version`) exit 2 with the
 * error document — `code` `configuration-error`, `path` the configuration
 * path in the anchoring form — while `version` answers, exit 0. Nothing is
 * modified; restored, the workspace builds clean.
 */
async function configurationContentArm(product: ProductBinding): Promise<void> {
  const context = "T14-10 (d) the configuration file's content";
  const prepared = await prepareRefusalWorkspace(
    product,
    RENAME_FIXTURE,
    context,
  );
  const { workspace } = prepared;
  try {
    const staging = await stageReadRefusalOfFile(workspace.path(CONFIG_PATH));
    try {
      const loaders: readonly (readonly string[])[] = [
        ["build"],
        ["ids"],
        ["inventory"],
        ["view", RENAME_A_PATH],
      ];
      for (const argv of loaders) {
        const label = `${context} \`${argv.join(" ")} --json\` with ${CONFIG_PATH} unreadable`;
        const result = await expectConfigurationError(
          product,
          workspace,
          argv,
          `${label} — a configuration file the environment refuses to read ` +
            `is invalid configuration, condition 14, from every command ` +
            `that loads it (SPEC 14.25, 14.14, 7)`,
        );
        const finding = expectErrorDocument(result, label);
        if (finding.path !== CONFIG_PATH) {
          fail(
            `${label} — the concerned path is the configuration path in ` +
              `the anchoring form, ${JSON.stringify(CONFIG_PATH)} from the ` +
              `root (SPEC 14, 11.6); got ${JSON.stringify(finding.path)} ` +
              `(message: ${JSON.stringify(finding.message)})`,
          );
        }
      }
      const versionLabel = `${context} \`version\` with ${CONFIG_PATH} unreadable`;
      await stagedDocument(
        product,
        workspace,
        ["version"],
        0,
        `${versionLabel} — \`version\` loads no configuration, so the ` +
          `refused read never occurs: exit 0 with its answer (SPEC 12.6, ` +
          `14.14, 14.25)`,
      );
    } finally {
      await staging.restore();
    }
    assertSnapshotsEqual(
      prepared.before,
      await snapshotWorkspace(workspace.root),
      `${context}: nothing modified — a configuration error precedes every ` +
        `write (SPEC 14.14, 12.0)`,
    );
    await assertRecovers(product, workspace, context);
  } finally {
    await workspace.dispose();
  }
}

// ---------------------------------------------------------------------------
// (e) A derived file's content — condition 10 (SPEC 14.25, 14.10, 12.1, 13.4)
// ---------------------------------------------------------------------------

/**
 * B's generated module staged unreadable: `check` reports exactly one
 * condition-10 finding, the per-file form concerning that path (the graph
 * data matches, so no unit form), exit 1; `build` exits 0 — it reads no
 * derived file, and its write replaces the occupant; afterwards `check` is
 * clean.
 */
async function derivedContentArm(product: ProductBinding): Promise<void> {
  const context = "T14-10 (e) a derived file's content";
  const prepared = await prepareRefusalWorkspace(
    product,
    RENAME_FIXTURE,
    context,
  );
  const { workspace } = prepared;
  try {
    const kind = await workspace.kind(RENAME_B_MODULE);
    if (kind !== "file") {
      fail(
        `${context}: the built workspace holds B's generated module as a ` +
          `plain file at ${RENAME_B_MODULE} (SPEC 13.1, 13.4); found ${kind}`,
      );
    }
    const staging = await stageReadRefusalOfFile(
      workspace.path(RENAME_B_MODULE),
    );
    try {
      const checkLabel = `${context} \`check --json\` with ${RENAME_B_MODULE} unreadable`;
      const findings = await stagedFindings(
        product,
        workspace,
        ["check", "--json"],
        1,
        `${checkLabel} — a derived file whose content the environment ` +
          `refuses to deliver is stale: condition 10, exit 1 (SPEC 14.25, ` +
          `14.10, 12.2)`,
      );
      assertStalenessAlone(
        findings,
        { perFile: [RENAME_B_MODULE], unit: false },
        `${checkLabel} — exactly one condition-10 finding, the per-file ` +
          `form concerning the unreadable module; the graph data matches, ` +
          `so no unit form (SPEC 14.10, 14.25)`,
      );
      const buildLabel = `${context} \`build\` with ${RENAME_B_MODULE} unreadable`;
      assertExitCode(
        await runSettled(product, workspace, ["build"], buildLabel),
        0,
        `${buildLabel} — \`build\` reads no derived file: its write ` +
          `replaces the occupant, so the refused content read never occurs ` +
          `and the build exits 0 (SPEC 14.25, 12.1, 13.4)`,
      );
    } finally {
      await staging.restore();
    }
    await expectExit(
      product,
      workspace,
      ["check"],
      0,
      `${context}: after the build, \`check\` is clean — the module ` +
        `regenerated (SPEC 12.2, 13.4)`,
    );
  } finally {
    await workspace.dispose();
  }
}

// ---------------------------------------------------------------------------
// (f) Graph data — the state of condition 23 (SPEC 14.25, 14.23, 14.10, 13.3)
// ---------------------------------------------------------------------------

/**
 * Graph data staged unreadable (`stageGraphDataUnreadable`: its files
 * `-w-------`, its directories `-wx`): `inventory` reports `recorded`
 * unavailable with the condition-23 finding concerning `.xspec`, exit 1; a
 * `move --preview` reports its `delta` unavailable likewise; `check`
 * reports one condition-10 finding in the unit form alone; `ids` exits 0
 * with its answer, regenerating the data rather than failing; and `build`
 * exits 0 — nothing asserted about the record it wrote, neither under the
 * staging nor after it: what a later read meets turns on the modes
 * `build`'s writes leave, which SPEC.md fixes nowhere (a successful
 * build's replacement of an unreadable record is T12.2-2's, staged
 * shape-blind).
 */
async function graphDataArm(product: ProductBinding): Promise<void> {
  const context = "T14-10 (f) graph data";
  const prepared = await prepareRefusalWorkspace(
    product,
    RENAME_FIXTURE,
    context,
  );
  const { workspace } = prepared;
  try {
    const intactLabel = `${context} premise \`inventory\` on the readable record`;
    const intact = decodeInventoryDocument(
      await runJson(product, workspace, ["inventory"], intactLabel),
      intactLabel,
    );
    if (intact.recorded.state !== "value") {
      fail(
        `${intactLabel}: on the freshly built workspace the record is ` +
          `readable and \`recorded\` lists the recorded derived paths ` +
          `(SPEC 11.6, 13.3); got state ${intact.recorded.state}`,
      );
    }
    const { stagings, staged } = await stageGraphDataUnreadable(
      workspace,
      context,
    );
    try {
      const invLabel = `${context} \`inventory\` [${staged}]`;
      const inventory = decodeInventoryDocument(
        await stagedDocument(
          product,
          workspace,
          ["inventory"],
          1,
          `${invLabel} — a refused read of graph data is the state of ` +
            `condition 23 to a surface consulting the record: the finding ` +
            `accompanies the answer, exit 1 (SPEC 14.25, 14.23, 11.6)`,
        ),
        invLabel,
      );
      assertConditionCounts(
        inventory.findings,
        { "14.23": 1 },
        `${invLabel} — exactly the one condition-23 finding (SPEC 14.23, 11.6)`,
      );
      assertFindingConcernsPath(
        inventory.findings[0]!,
        GRAPH_DATA_AREA,
        `${invLabel} — the concerned path is the graph-data area (SPEC 14.23, 11.6)`,
      );
      assertSameJson(
        inventory.findings[0]!.locations,
        [],
        `${invLabel} — no path inside the area is named (SPEC 14.23, 13.3, 12.7)`,
      );
      assertSameJson(
        inventory.recorded,
        { state: "unavailable" },
        `${invLabel} — \`recorded\` is explicitly unavailable, never ` +
          `fabricated and never read as an empty record (SPEC 14.23, 11.6, ` +
          `12.7)`,
      );

      const previewArgv = [
        "move",
        RENAME_C_PATH,
        MOVE_C_DESTINATION,
        "--preview",
        "--json",
      ];
      const previewLabel = `${context} \`${previewArgv.join(" ")}\` [${staged}]`;
      const preview = decodePreviewReport(
        await stagedDocument(
          product,
          workspace,
          previewArgv,
          1,
          `${previewLabel} — a preview consulting the record reports its ` +
            `delta unavailable beside the condition-23 finding, exit 1, ` +
            `the full preview still emitted (SPEC 14.23, 6.6, 12.0)`,
        ),
        previewLabel,
      );
      assertConditionCounts(
        preview.findings,
        { "14.23": 1 },
        `${previewLabel} — exactly the one condition-23 finding (SPEC 14.23, 6.6)`,
      );
      assertFindingConcernsPath(
        preview.findings[0]!,
        GRAPH_DATA_AREA,
        `${previewLabel} — the concerned path is the graph-data area (SPEC 14.23, 11.6)`,
      );
      if (
        preview.mapping === null ||
        preview.files === null ||
        preview.delta === null
      ) {
        fail(
          `${previewLabel} — the plan is reported: \`mapping\`, \`files\`, ` +
            `and \`delta\` are null exactly on refusal, and this move is ` +
            `not refused (SPEC 6.6, 12.7)`,
        );
      }
      if (!("unavailable" in preview.delta)) {
        fail(
          `${previewLabel} — the record-supplied datum, the delta, is ` +
            `reported explicitly unavailable as one datum, never read as ` +
            `an empty record (SPEC 14.23, 6.6, 12.7); got ` +
            `${JSON.stringify(preview.delta)}`,
        );
      }

      const checkLabel = `${context} \`check --json\` [${staged}]`;
      assertStalenessAlone(
        await stagedFindings(
          product,
          workspace,
          ["check", "--json"],
          1,
          `${checkLabel} — unreadable recorded state is staleness to ` +
            `\`check\`: exit 1 (SPEC 14.25, 14.10)`,
        ),
        { perFile: [], unit: true },
        `${checkLabel} — one condition-10 finding in the unit form alone: ` +
          `the unreadable-record form, never the mismatch form beside it, ` +
          `and no per-file form — every derived file is intact (SPEC ` +
          `14.10, 14.25)`,
      );

      const idsLabel = `${context} \`ids --json\` [${staged}]`;
      decodeIdsReport(
        await stagedDocument(
          product,
          workspace,
          ["ids", "--json"],
          0,
          `${idsLabel} — to a refreshing read, graph data it cannot read ` +
            `is graph data that does not match: it regenerates the data ` +
            `and answers, exit 0, never a failure (SPEC 14.25, 13.3)`,
        ),
        idsLabel,
      );

      // The arm's last assertion: no read of the record `build` writes is
      // asserted, under the staging or after it — what that read meets
      // turns on the modes `build`'s writes leave, which SPEC.md fixes
      // nowhere (a successful build's replacement of an unreadable record
      // is T12.2-2's, staged shape-blind).
      const buildLabel = `${context} \`build\` after the refreshing read [${staged}]`;
      assertExitCode(
        await runSettled(product, workspace, ["build"], buildLabel),
        0,
        `${buildLabel} — \`build\` regenerates graph data whatever state it ` +
          `finds there, and the staging refuses reads alone, every write ` +
          `and search kept, so the regeneration is never itself refused: ` +
          `exit 0 (SPEC 12.1, 13.4, 14.25)`,
      );
    } finally {
      await restoreSurviving(stagings);
    }
  } finally {
    await workspace.dispose();
  }
}

// ---------------------------------------------------------------------------
// (g) A directory discovery lists — a usage error (SPEC 14.25, 7, 12.0)
// ---------------------------------------------------------------------------

/**
 * `specs/sub` staged unlistable under the glob `specs/**\/*.mdx`: every
 * command that loads the configuration — `build`, `check`, `ids`, `view`,
 * `inventory`, `review list`, and a `rename` — exits 2 with the error
 * document (`code` `read-failure`, `path` `specs/sub`), nothing modified.
 * Precedence, at the read in read order: with A also failing validation,
 * `build` still exits 2 with the read failure; `coverage <unknown-profile>`
 * reports the read failure; the syntax class — a surplus operand, a
 * `--file` pattern outside the root, a malformed offset — is reported
 * without loading configuration (`code` null); and with the configuration
 * file itself invalid the configuration error precedes the read.
 */
async function discoveryListingArm(product: ProductBinding): Promise<void> {
  const context = "T14-10 (g) a directory discovery lists";
  const prepared = await prepareRefusalWorkspace(
    product,
    LISTING_FIXTURE,
    context,
  );
  const { workspace } = prepared;
  try {
    const staging = await stageReadRefusalOfDirectory(workspace.path(SUB_DIR));
    try {
      const loaders: readonly (readonly string[])[] = [
        ["build", "--json"],
        ["check", "--json"],
        ["ids", "--json"],
        ["view", RENAME_A_PATH],
        ["inventory"],
        ["review", "list", "--json"],
        RENAME_B_TO_B2,
      ];
      for (const argv of loaders) {
        const label = `${context} \`${argv.join(" ")}\` with ${SUB_DIR} unlistable`;
        expectReadFailure(
          await runSettled(product, workspace, argv, label),
          SUB_DIR,
          `${label} — a directory the discovery of 7 lists, refused: every ` +
            `command that loads the configuration stops at the read (SPEC ` +
            `14.25, 7, 12.0)`,
        );
      }
      const coverageArgv = ["coverage", "no-such-profile", "--json"];
      const coverageLabel = `${context} \`${coverageArgv.join(" ")}\` with ${SUB_DIR} unlistable`;
      expectReadFailure(
        await runSettled(product, workspace, coverageArgv, coverageLabel),
        SUB_DIR,
        `${coverageLabel} — discovery precedes every error consulting the ` +
          `configuration: the unknown profile is judged after the reads ` +
          `its load makes, so the read failure is reported (SPEC 12.0, ` +
          `14.25, 7.4)`,
      );
      const syntaxClass: readonly (readonly [readonly string[], string])[] = [
        [["ids", "extra", "--json"], "a surplus operand"],
        [
          ["ids", "--file", "../x", "--json"],
          "a `--file` pattern outside the workspace root, decided by its spelling alone",
        ],
        [
          ["at", RENAME_A_PATH, "zz"],
          "an offset spelled as anything but decimal digits — a malformed value",
        ],
      ];
      for (const [argv, why] of syntaxClass) {
        const label = `${context} \`${argv.join(" ")}\` with ${SUB_DIR} unlistable`;
        expectSyntaxClassError(
          await runSettled(product, workspace, argv, label),
          why,
          label,
        );
      }
    } finally {
      await staging.restore();
    }
    assertSnapshotsEqual(
      prepared.before,
      await snapshotWorkspace(workspace.root),
      `${context}: nothing modified — every command stops at the refused ` +
        `read, attempting nothing further, the rename included (SPEC ` +
        `14.25, 13.5)`,
    );

    // The failing twin on the same workspace: A's reference respelled to
    // resolve nowhere (14.5) — the read failure is still what `build`
    // reports, never the findings.
    await workspace.edit(RENAME_A_PATH, A_REFERENCE, A_UNRESOLVED);
    const twinStaging = await stageReadRefusalOfDirectory(
      workspace.path(SUB_DIR),
    );
    try {
      const label = `${context} \`build --json\` with ${SUB_DIR} unlistable and ${RENAME_A_PATH} failing validation`;
      expectReadFailure(
        await runSettled(product, workspace, ["build", "--json"], label),
        SUB_DIR,
        `${label} — a read failure is met at the read, in read order: the ` +
          `discovery of 7 precedes every validation consulting it, so the ` +
          `findings are never reported (SPEC 12.0, 14.25)`,
      );
    } finally {
      await twinStaging.restore();
    }
    await workspace.edit(RENAME_A_PATH, A_UNRESOLVED, A_REFERENCE);
    await assertRecovers(product, workspace, context);
  } finally {
    await workspace.dispose();
  }

  // With the configuration file itself invalid, the configuration error
  // precedes the read: the configuration is read before discovery (14.14).
  const invalid = await TestWorkspace.create({
    files: { ...LISTING_FIXTURE.decl.files, [CONFIG_PATH]: INVALID_CONFIG },
  });
  try {
    const staging = await stageReadRefusalOfDirectory(invalid.path(SUB_DIR));
    try {
      const label = `${context} \`build --json\` with the configuration invalid and ${SUB_DIR} unlistable`;
      const finding = expectErrorDocument(
        await expectConfigurationError(
          product,
          invalid,
          ["build"],
          `${label} — a configuration error precedes every other error of ` +
            `exit class 2, the read failure included: the configuration is ` +
            `read before the discovery it defines (SPEC 14.14, 12.0, 14.25)`,
        ),
        label,
      );
      assertFindingConcernsPath(
        finding,
        CONFIG_PATH,
        `${label} — the configuration path is the concerned path (SPEC 14, 14.14)`,
      );
    } finally {
      await staging.restore();
    }
  } finally {
    await invalid.dispose();
  }
}

// ---------------------------------------------------------------------------
// (h) The session directory's listing — a usage error (SPEC 14.25, 10.1)
// ---------------------------------------------------------------------------

/**
 * `.xspec/reviews` staged unlistable on a valid workspace holding a session:
 * `review list`, `inventory`, and `check` each exit 2 with the error
 * document concerning `.xspec/reviews`, while `build` (reading no session)
 * and `ids` exit 0. `review status <name>`, which may find its session by
 * name without listing, is asserted nowhere.
 */
async function sessionDirectoryArm(product: ProductBinding): Promise<void> {
  const context = "T14-10 (h) the session directory's listing";
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
    const staging = await stageReadRefusalOfDirectory(
      workspace.path(REVIEWS_DIR),
    );
    try {
      const listers: readonly (readonly string[])[] = [
        ["review", "list", "--json"],
        ["inventory"],
        ["check", "--json"],
      ];
      for (const argv of listers) {
        const label = `${context} \`${argv.join(" ")}\` with ${REVIEWS_DIR} unlistable`;
        expectReadFailure(
          await runSettled(product, workspace, argv, label),
          REVIEWS_DIR,
          `${label} — the session directory's listing, refused, is a usage ` +
            `error from every command making it (SPEC 14.25, 10.1, 11.6, ` +
            `14.21)`,
        );
      }
      const buildLabel = `${context} \`build\` with ${REVIEWS_DIR} unlistable`;
      assertExitCode(
        await runSettled(product, workspace, ["build"], buildLabel),
        0,
        `${buildLabel} — \`build\` reads no session, so the refused listing ` +
          `never occurs: exit 0 (SPEC 14.21, 12.1, 14.25)`,
      );
      const idsLabel = `${context} \`ids --json\` with ${REVIEWS_DIR} unlistable`;
      decodeIdsReport(
        await stagedDocument(
          product,
          workspace,
          ["ids", "--json"],
          0,
          `${idsLabel} — a refreshing read lists no session: exit 0 with ` +
            `its answer (SPEC 13.3, 14.25)`,
        ),
        idsLabel,
      );
    } finally {
      await staging.restore();
    }
    await expectExit(
      product,
      workspace,
      ["check"],
      0,
      `${context}: recovery — the listing permitted again, \`check\` is ` +
        `clean and the session intact (SPEC 12.2, 14.21)`,
    );
  } finally {
    await workspace.dispose();
  }
}

// ---------------------------------------------------------------------------
// (i) At acquisition, and at the second discovery of 13.5 — usage errors
// (SPEC 14.25, 14.24, 13.5)
// ---------------------------------------------------------------------------

/**
 * One of acquisition's refused reads (TEST-SPEC T14-10(i)): the staging —
 * T13.5-10(d)'s, applied before the invocation on T13.5-10's session
 * staging and verified on the harness itself (helpers/acquisition-
 * staging.ts) — what it refuses, the codes a conforming acquisition
 * reports there, and the mutating command run against it.
 */
interface AcquisitionReadArm {
  /** The staging, as T13.5-10(d) words it. */
  readonly staging: string;
  /** What the staging refuses, as T14-10(i) words it. */
  readonly refused: string;
  /**
   * The codes a conforming acquisition reports: `read-failure` alone, or
   * `write-failure` beside it where the product may meet the refusal first
   * at a write (SPEC 14.24, 14.25).
   */
  readonly codes: readonly string[];
  /** The mutating command run against it: its index in T13.5-10's five. */
  readonly operation: number;
  /**
   * Stage it before the invocation, verified on the harness itself; its
   * `restore()` reinstates every mode the staging changed (idempotent).
   */
  readonly stage: (workspace: TestWorkspace) => Promise<AcquisitionStaging>;
}

/**
 * T14-10(i)'s refused reads at acquisition, the lock path's occupant and
 * everything under it — the lock directory unlistable, a subdirectory under
 * it unlistable; `.xspec` unsearchable (holding no `lock` and, separately,
 * an empty lock directory: T13.5-10(d)'s two stagings of it); the lock
 * directory unsearchable — each with the next of T13.5-10's mutating
 * commands (`rename`, `move`, `review create`, `resolve`, `split`), so that
 * every mutating command reports one of acquisition's refused reads.
 */
const ACQUISITION_READ_ARMS: readonly AcquisitionReadArm[] = [
  {
    staging:
      "an empty leftover lock directory unlistable but writable (mode `-wx`)",
    refused: "the lock directory's listing",
    codes: [READ_FAILURE_CODE],
    operation: 0,
    stage: (workspace) => stageUnlistableLockDirectory(workspace),
  },
  {
    staging:
      "a lock directory holding a subdirectory that holds a file, the " +
      "subdirectory unlistable (`-wx`)",
    refused: "the listing of a subdirectory under the lock directory",
    codes: [READ_FAILURE_CODE],
    operation: 1,
    stage: (workspace) => stageUnlistableLeftoverDirectory(workspace),
  },
  {
    staging: "`.xspec` unsearchable (mode `rw-`) holding no `lock`",
    refused: "the lock path's kind and every write there",
    codes: [READ_FAILURE_CODE, WRITE_FAILURE_CODE],
    operation: 2,
    stage: (workspace) => stageUnsearchableArea(workspace, "nothing"),
  },
  {
    staging:
      "`.xspec` unsearchable (mode `rw-`) holding an empty lock directory",
    refused: "the lock path's kind and every write there",
    codes: [READ_FAILURE_CODE, WRITE_FAILURE_CODE],
    operation: 3,
    stage: (workspace) =>
      stageUnsearchableArea(workspace, "an empty lock directory"),
  },
  {
    staging:
      "a lock directory unsearchable (`rw-`) holding a directory that holds " +
      "a file",
    refused: "its occupants' kinds and every route below it",
    codes: [READ_FAILURE_CODE, WRITE_FAILURE_CODE],
    operation: 4,
    stage: (workspace) => stageUnsearchableLockDirectory(workspace),
  },
];

/**
 * Acquisition's refused read's contract (TEST-SPEC T14-10(i); SPEC 14.25,
 * 14.24, 13.5): exit 2; the error document as the entire stdout, its
 * finding's `code` among `codes`, its `path` the lock path `.xspec/lock`
 * exactly — the lock path's occupant or anything under it concerning the
 * lock path, so the nested path is never named — and its `locations` `[]`
 * (12.7: empty for a condition without in-source locations, so no location
 * names a nested path either); the diagnostic on stderr (12.0).
 */
function expectAcquisitionReadFailure(
  result: RunResult,
  codes: readonly string[],
  context: string,
): Finding {
  assertExitCode(
    result,
    2,
    `${context} — a read the environment refuses at acquisition is a ` +
      `usage error: the command stops at that read, attempting nothing ` +
      `further but release, and exits 2 — never a finding, never an ` +
      `internal error (SPEC 14.25, 14.24, 13.5, 12.0)`,
  );
  const finding = expectErrorDocument(result, context);
  const admitted = codes.map((code) => JSON.stringify(code)).join(" or ");
  assertSameJson(
    { code: finding.code, path: finding.path, locations: finding.locations },
    {
      code: codes.find((code) => code === finding.code) ?? codes[0],
      path: LOCK_PATH,
      locations: [],
    },
    `${context} — the error document's finding carries the stable code ` +
      `${admitted}` +
      (codes.length > 1
        ? ` (SPEC 14.25; 14.24: a write failure where the product meets ` +
          `the refusal first at a write)`
        : ` (SPEC 14.25)`) +
      `, the concerned path the lock path "${LOCK_PATH}" — for the lock ` +
      `path's occupant or anything under it the lock path, the nested path ` +
      `never named (SPEC 14.25, 13.5) — and no locations (SPEC 12.7: none ` +
      `for a condition without in-source locations); message: ` +
      JSON.stringify(finding.message),
  );
  if (result.stderr.trim().length === 0) {
    fail(
      `${context} — the diagnostic accompanies the error document on ` +
        `standard error (SPEC 14.25, 12.0: usage-error messages are ` +
        `standard-error content); got an empty stderr beside ` +
        `${JSON.stringify(finding.message)}`,
    );
  }
  return finding;
}

/**
 * One of (i)'s refused reads at acquisition (TEST-SPEC T14-10(i)): on a
 * fresh CONF-CORE-shaped workspace — T13.5-10's session staging
 * (`stageArmWorkspace`: built, holding the audit session `s`, nothing at
 * `.xspec/lock`) — the arm staged before the invocation, verified on the
 * harness itself; its command under `--json`, settled; the staging's modes
 * restored once it exits → the contract (`expectAcquisitionReadFailure`),
 * and nothing modified — every path but the lock path byte-identical once
 * the modes are restored, `.xspec` itself compared, the compare bracketing
 * this run and its staging alone (H-6: the lock path, which acquisition
 * and release touch and the staging occupies, pruned from both walks; its
 * residue T13.5-10(d)'s subject).
 */
async function acquisitionReadRun(
  product: ProductBinding,
  arm: AcquisitionReadArm,
): Promise<void> {
  const operation = acquisitionOperation(arm.operation);
  const context =
    `T14-10 (i) at acquisition: ${operation.what} --json with ` +
    `${arm.staging} — ${arm.refused} refused`;
  const workspace = await TestWorkspace.create(CORE_DECL);
  try {
    const items = await stageArmWorkspace(product, workspace, context);
    const before = await snapshotDirectory(workspace.root, EXCLUDE_LOCK_PATH);
    const staging = await arm.stage(workspace);
    let result: RunResult;
    try {
      result = await runSettled(
        product,
        workspace,
        [...operation.argv(items), "--json"],
        context,
      );
    } finally {
      await staging.restore();
    }
    expectAcquisitionReadFailure(result, arm.codes, context);
    assertSnapshotsEqual(
      before,
      await snapshotDirectory(workspace.root, EXCLUDE_LOCK_PATH),
      `${context}: modifies nothing — acquisition precedes every ` +
        `modification and the command stops at the refused read, ` +
        `attempting nothing further but release, so every path but the ` +
        `lock path is byte-identical once the staging's modes are ` +
        `restored, \`.xspec\` itself compared (SPEC 13.5, 14.25, 14.24; ` +
        `H-6: the lock path, which acquisition and release touch, left ` +
        `out — its residue T13.5-10(d)'s subject)`,
    );
  } finally {
    await workspace.dispose();
  }
}

/**
 * (i)'s second-discovery arm (TEST-SPEC T14-10(i), T13.5-12(e)): on a fresh
 * session staging of T13.5-8's valid workspace (section-13.5.ts
 * `ACQUISITION_DECL`, whose `specs/sub` the discovery of 7 lists),
 * `rename specs/A.mdx a a2 --json` — an operation otherwise succeeding
 * there, the next of T13.5-10's commands after (i)'s fifth — held at the
 * seam (section-13.5-iii.ts `withHeldRun`: its hold path outside the
 * workspace, the held-state comparison once it holds); `specs/sub` made
 * unlistable during the hold (`UNLISTABLE_SUB_DIR`: mode `--x`, T14-10's
 * discipline, verified on the harness itself), the hold lifted, and the
 * mode restored once the run has ended → the 14.25 contract at that
 * directory (`expectReadFailure`: exit 2, the error document, `code`
 * `"read-failure"`, `path` `"specs/sub"`, a non-empty stderr) — the
 * discovery 13.5 makes again holding exclusivity meeting the refusal, which
 * the first discovery, before the hold, did not — and nothing modified: the
 * workspace once the run has ended and the mode is restored byte-identical
 * to its state during the hold before the change (the change and its
 * undoing restore a directory's mode alone, never a byte; H-6: the run's
 * lock path pruned from both walks, the held-state comparison having
 * judged it once the run held).
 */
async function secondDiscoveryRun(product: ProductBinding): Promise<void> {
  const operation = acquisitionOperation(0);
  const context =
    `T14-10 (i) at the second discovery of 13.5: ${operation.what} --json ` +
    `--test-hold <path> on a freshly built valid workspace holding an ` +
    `\`audit\` session \`s\`, with ${SECOND_DISCOVERY_DIR}, a directory ` +
    `discovery lists, made unlistable during the hold (mode \`--x\`)`;
  const workspace = await TestWorkspace.create(ACQUISITION_DECL);
  try {
    const items = await stageArmWorkspace(product, workspace, context);
    await withHeldRun(
      product,
      workspace,
      [...operation.argv(items), "--json"],
      context,
      async (held) => {
        const before = await snapshotDirectory(
          workspace.root,
          EXCLUDE_LOCK_PATH,
        );
        const undo = await UNLISTABLE_SUB_DIR.make(workspace, context);
        let result: RunResult;
        try {
          result = await liftAndWait(held, context);
        } finally {
          await undo();
        }
        expectReadFailure(
          result,
          SECOND_DISCOVERY_DIR,
          `${context} — holding exclusivity, past its hold, the command ` +
            `discovers its sources again, and that discovery's refused ` +
            `listing of a directory it lists is a read failure concerning ` +
            `that directory (SPEC 13.5, 14.25, 7)`,
        );
        assertSnapshotsEqual(
          before,
          await snapshotDirectory(workspace.root, EXCLUDE_LOCK_PATH),
          `${context}: modifies nothing — the command stops at the ` +
            `refused read, attempting nothing further but release, so the ` +
            `workspace once the run has ended and the mode is restored is ` +
            `byte-identical to its state during the hold before the change, ` +
            `which with its undoing restores a directory's mode alone (SPEC ` +
            `14.25, 13.5; H-6: the run's lock path left out)`,
        );
      },
    );
  } finally {
    await workspace.dispose();
  }
}

/**
 * T14-10's arm (i), in turn: acquisition's refused reads, each staged
 * before the invocation (T13.5-10(d)'s stagings), then the second
 * discovery's (T13.5-12(e)'s staging, during a hold). Exported so scratch
 * probes can run the arm alone, against the CONF-CORE reference among
 * others; Linux leg only, as T14-10's other arms (E-1).
 */
export async function runT1410ArmI(product: ProductBinding): Promise<void> {
  for (const arm of ACQUISITION_READ_ARMS) {
    await acquisitionReadRun(product, arm);
  }
  await secondDiscoveryRun(product);
}

// ---------------------------------------------------------------------------
// T14-10 — read failures (14.25)
// ---------------------------------------------------------------------------

const T14_10 = defineProductTest({
  id: "T14-10",
  title:
    "read failures (14.25): the object read decides the outcome, one arm per row, each refusal staged by permission removal alone (a file's content: mode 0o200, its write permission kept; a directory's listing: mode 0o100, search kept; nonexistence never a refusal) — (a) a discovered source's content is condition 20 at `build` and `check`, exit 1, its one location the zero-length range at offset 0, the file masked exactly as an unparseable one (A's reference reports 14.5, nothing inside reports) while `view` serves the other requested file, `occurrences` lists no record for its spellings, and `at` at 0, 7, and 999999 reports the resolution explicitly unavailable, never the out-of-range usage error — a spec source and, separately, a code source; (b) the journal's content is condition 13 concerning .xspec/journal from `build`, `check`, `ids` (answering nothing), and a refused `rename`, while `inventory` reports `journal.occupied` true, finding-free; (c) a session file's content is condition 21 from `check`, `review status` (nothing modified), and `review list` (the session reported corrupt), each reporting one `corrupt-session` finding concerning the session file with no location, `inventory` listing the session; (d) the configuration file's content is condition 14 from `build`, `ids`, `inventory`, and `view` (`code` configuration-error, `path` xspec.config.ts), `version` exiting 0; (e) a generated module's content is one per-file condition-10 finding to `check` while `build` exits 0; (f) graph data unreadable — every file under .xspec/ but the journal, the session directory, and the lock path at mode 0o200 and every directory among them at 0o300 (`-wx`, its write and search kept) — is the state of condition 23: `inventory` and a `move --preview` report their record-supplied datum unavailable beside the finding, `check` one unit-form condition-10 finding alone, `ids` regenerates and answers (exit 0), and `build` exits 0, no later read of the record it wrote asserted; (g) a directory discovery lists, unlistable: `build`, `check`, `ids`, `view`, `inventory`, `review list`, and a `rename` each exit 2 with the error document (`code` read-failure, `path` specs/sub), nothing modified, the read failure preceding a failing source's findings and an unknown profile, the syntax class (`code` null) and an invalid configuration preceding it; (h) the session directory unlistable: `review list`, `inventory`, and `check` exit 2 concerning .xspec/reviews while `build` and `ids` exit 0; (i) at acquisition, the lock path's occupant and everything under it refused, each staged before the invocation on a freshly built workspace holding an `audit` session `s`, with `rename`, `move`, `review create`, `resolve`, and `split` in turn — an empty lock directory unlistable (`-wx`) and a subdirectory under it unlistable (`-wx`), each `read-failure`; `.xspec` unsearchable (`rw-`; holding no `lock` and, separately, an empty lock directory) and the lock directory unsearchable (`rw-`, holding a directory that holds a file), each `read-failure` or `write-failure` — each exit 2 with the error document, `path` .xspec/lock, never a nested path, `locations` [], nothing modified; and specs/sub, a directory the second discovery of 13.5 lists, made unlistable (`--x`) during the hold of `rename specs/A.mdx a a2`: exit 2, `code` read-failure, `path` specs/sub, nothing modified; two clauses — a refused read of a path occupant's kind (the area's own occupant's at acquisition included, the lock path's there excepted, which (i) stages), and of a directory above the workspace root — admit no product-independent staging and are recorded so (SPEC 14.25, 14, 11.2, 11.5, 11.6, 13.3, 13.5, 10.7, 12.0, 12.7)",
  run: async (product) => {
    // E-1: permission stagings belong to the Linux leg; elsewhere the arms
    // are not staged (the NU3_STAGED pattern of section-11.5) and no other
    // leg selects T14-10 (E-6).
    if (!READ_REFUSALS_STAGED) return;
    await sourceContentArm(product);
    await journalContentArm(product);
    await sessionContentArm(product);
    await configurationContentArm(product);
    await derivedContentArm(product);
    await graphDataArm(product);
    await discoveryListingArm(product);
    await sessionDirectoryArm(product);
    await runT1410ArmI(product);
  },
});

/** TEST-SPEC §14 II — T14-9 and T14-10, in canonical ID order (SUITE-49). */
export const section14iiTests: readonly ProductTestEntry[] = [T14_9, T14_10];
