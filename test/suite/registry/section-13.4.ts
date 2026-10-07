// TEST-SPEC §13.4 (derived and durable files) — SUITE-47: T13.4-1 (plain
// committable files + sorted keys), T13.4-2 (derived reproducibility),
// T13.4-3 (orphan knowledge boundary), T13.4-4 (derived paths belong to
// xspec), T13.4-5 (durable protection), T13.4-6 (symlink write rules),
// T13.4-8 (writes create missing directories), T13.4-9 (derived paths above
// sources and other derived paths), T13.4-10 (rebuild-obstructing orphans),
// T13.4-11 (removing recorded paths no longer generated).
// T13.4-7 registers no test body: its TEST-SPEC entry is a cross-reference —
// T7-6 (section-7-discovery.ts) carries the `.xspec.` / `.xspec/` /
// emit-destination source exclusion. (A registered no-op body would pass
// against the stub product and violate the S-7 red-green sweep, H-8; the H-7
// traceability map routes §13.4's source-exclusion passage to T7-6.)
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), decodes output through the H-3 adapters,
// and rejects a product only via diagnosed assertion failures (H-8).
//
// Conservative operationalizations (noted per H-3/H-4):
// - "Every file xspec writes is a plain file" (T13.4-1): the harness stages
//   only regular files, so the scan asserts that no entry outside `.git/`
//   anywhere in the workspace is a symlink or other non-plain kind — any
//   such entry is product-written.
// - The T13.4-1 git round trip compares regular-file entries byte-exactly
//   (git does not represent empty directories; 13.4 constrains files) and
//   asserts the round-tripped behavior directly: after commit, worktree
//   wipe, and clean checkout, `check` stays clean, reads answer
//   byte-identically (12.0: byte-deterministic output for byte-identical
//   input), and a rebuild reproduces the same fixed point.
// - Byte-exact restoration compares (T13.4-2, T13.4-3, T13.4-4) are the H-4
//   self-comparison carve-out: product output compared against the product's
//   own output for identical build input. In T13.4-4 the reference is a
//   second workspace whose staged difference is confined to derived-file
//   paths — occupants of derived paths are never sources (13.4) and derived
//   output is a function of sources, configuration, and the journal alone
//   (13.4), so conforming builds of both workspaces yield byte-identical
//   trees.
// - Product-chosen names (a companion's suffix, 13.1; graph data's layout,
//   13.3) are acted on by their exact bytes: wherever T13.4-2, T13.4-3, or
//   T13.4-4 turns a snapshot key into a filesystem path — T13.4-2's
//   deletions and overwrites, T13.4-3's manual deletion, T13.4-4's links
//   and their kind checks — it goes through `snapshotKeyBytes` to a byte
//   path, never through the key's characters read as a UTF-8 path, and
//   T13.4-3's missing-record half deletes the graph data through T13.3-2's
//   `deleteGraphData`, which lists `.xspec/` by raw name bytes. Diagnoses
//   render a key with `displaySnapshotPath`.
// - T13.4-4's link arm and T13.4-11(c) stage their links through one
//   function, `stageLinkToOutsideFile`: a symbolic link at a derived file's
//   own path resolving to a plain file outside the workspace root (in the
//   workspace's temporary directory, beside the root), the target's bytes
//   captured before the product runs and compared after. CERTIFICATIONS.md
//   certifies that staging through T13.4-11(c) (VIOL-ORPHAN-LINKTARGET), and
//   T13.4-4's link arm rides the certification insofar as it shares the
//   staging (its Exclusions entry "T13.4-4's link arm"). Outside the root,
//   the targets take no part in T13.4-4's whole-workspace compare.
// - T13.4-4's directory arms stage a directory at each of the two derived
//   paths SPEC pins for `specs/A.mdx` — the module (13.1) and the Markdown
//   emitted next to it (13.2, 7.3) — before any build, in two workspaces:
//   empty, and each holding `notes.txt`, which no group matches. Neither
//   path is a directory component of a discovered source's or another
//   derived path, so 14.22 does not reach it (T13.4-9 stages the paths it
//   does). "Replaced by the derived file" is asserted as the plain-file
//   kind and the whole-workspace compare against the pristine reference
//   (above), so nothing of a directory survives; `check` clean is the
//   finding-free report.
// - T13.4-3's two halves — the record missing (deleted per T13.3-2's
//   operational definition) and unreadable (corrupted shape-blind through
//   the H-3 record-staging adapter, T6.6-6's staging, before the
//   configuration change) — walk one procedure, so their assertions mirror
//   each other exactly. "`build` replaces the record" (13.3, 14.23) is
//   asserted at the record-consulting surfaces — `check` exits 0 (the record
//   readable and current: no condition-23 unit form, no graph-data
//   staleness; the orphan, recorded nowhere, names no stale file) and
//   `inventory`'s `recorded` datum is the plain current generation, naming
//   A's module and no B path (13.3: the paths most recently generated) —
//   and, whole and opaque (H-4), by the cross-half byte compare of the graph
//   data the narrowed `build` wrote: derived output is a function of
//   sources, configuration, and the journal alone (13.4), identical across
//   the halves, so the garbage-overwritten and the deleted record are
//   replaced with the same bytes — a product leaving garbage beside a fresh
//   record fails it. The unreadable half's staging premise is read through
//   `inventory` inside a whole-root compare (exit 1 with `recorded`
//   explicitly unavailable — T11.6-4's pin; 11.6: neither refreshing nor
//   writing), so the configuration change is known to find the record
//   unreadable and untouched.
// - T13.4-5 stays inside CERTIFICATIONS.md §CONF-CORE's scope (the test is
//   in-scope there): one spec group of importless, tagless `.mdx` sources;
//   no `code`, `markdown`, `coverage`, or `policy` keys; no git; mutating
//   commands drawn from `rename` and `review` under `--strategy audit`. In
//   this git-less scope `impact --base HEAD` is the exit-2
//   unreadable-baseline case (SPEC 6.3, 12.0) — asserted as such, durables
//   still untouched. Staging constraint (§VIOL-CORE-PERSISTREADS): the
//   fixture session holds no stale resolution while the `build`-and-read
//   byte-compares run — the one resolve is the last staging step and no
//   source changes afterward, so read-time invalidation computes nothing.
// - T13.4-6 refusal arm: the symlinked write-path component is staged as
//   `markdown.outDir` naming a symlink to a real directory inside the
//   workspace root (no outside-root confound, 14.14). With one source file,
//   exactly one write path (`out/specs/A.md`) traverses the link, so `build
//   --json` must report exactly one 14.22 and nothing else (the sources are
//   valid, and build cannot observe 14.10, 12.1). `check` must report
//   exactly the same 14.22 without writing: a workspace whose `build` is
//   refused fails `build`'s validations (SPEC 13.3), so 14.10's mismatch
//   forms — the never-generated derived files, the absent graph data — are
//   undetectable and go unreported (SPEC 14.10), and no record exists for
//   its two whatever-validity forms (an unreadable record, 14.23; a
//   recorded path no longer generated); any other condition fails.
// - T13.4-6 plain-file occupant and cardinality arms: every staging is a
//   first emission — no build has ever run and the occupant is staged in the
//   workspace declaration — and no move operand is involved (a plain-file
//   component under a move's destination or its derived paths is the move's
//   `refused-invalid-destination` instead, SPEC 6.5, 14.22; T6.5-4). Under
//   OUT_CONFIG emission preserves workspace-relative paths (SPEC 7.3), so
//   each staged component is a workspace-relative directory component of a
//   `build` write path and the staged occupants are exactly the offending
//   components: the arms assert the complete condition-22 finding set with
//   each finding's concerned path equal to its component (SPEC 14.22 — one
//   finding per distinct offending component, whatever write paths it
//   refuses; a product refusing at a different component, once per refused
//   write, or per occupant kind rather than per component fails the count
//   or the path equality). The `build`-side finding set is exact (sources
//   valid; `build` cannot observe 14.10, 12.1), and so is the `check`
//   side's (as above: 14.10's mismatch forms go unreported on a workspace
//   failing `build`'s validations, SPEC 14.10, 13.3). The cardinality
//   arms — one occupant under which two derived
//   files would be written yields one finding; two distinct offending
//   components yield two — are asserted via `check`, where TEST-SPEC pins
//   them; among equal-code findings with empty locations the pinned 12.7
//   order is concerned-path byte order, fixing the per-index comparison.
// - T13.4-6 durable arms: the journal occupant's link target is an empty
//   plain file — a valid empty journal — and the session occupant's link
//   target is the product's own healthy session file beside it, so a product
//   that reads or writes through the link sees a valid durable file and
//   proceeds; the exit-code and whole-workspace byte-compares then fail it
//   ("never read, appended, or replaced"). The mutating attempt's refusal
//   report content is unasserted (the section-6.4 precedent: TEST-SPEC pins
//   no report content for refusals), while the 14.13/14.21 condition
//   identities are asserted through `build --json` / `check --json` /
//   /corrupt/i vocabulary, leniently per the T6.1-3 and T10.1-4 precedents
//   (the staged condition present; cascades unpinned).
// - T13.4-6 positive arm: the product is driven with its working directory
//   given as a symbolic link (created beside the workspace root) resolving
//   to the real root, with `PWD` naming the link path — path components
//   above the workspace root are unrestricted (13.4), so `build`, a
//   journaled `rename`, and `check` must behave normally and land their
//   effects in the real root.
// - T13.4-8 stagings are import- and reference-free, so the file-form
//   relocation changes no bytes of the moved file (SPEC 6.5: beyond the
//   stated edits a move changes no bytes, and none applies) and the created
//   target file's entire initial content is the moved section construct's
//   own characters followed by one U+000A (SPEC 6.5: the target file is
//   created empty; a top-level `new-id` inserts at the end of the file —
//   the start of a line in an empty file, so no preceding terminator — and
//   no import addition is required); both are asserted byte-exactly per H-4
//   ("6.5 move edits"). "Present as real directories afterward" is asserted
//   via lstat kind — a symbolic link at a fresh component would violate
//   13.4's writes-never-traverse-links rule. The "regenerated derived files
//   under the fresh directories" are asserted as the two SPEC-pinned
//   per-source paths — the module `NAME.xspec.ts` in the source's directory
//   (13.1) and the emitted `NAME.md` (13.2; next to the source by default,
//   under `outDir` in the emission arm) — companion sets being
//   implementation latitude (13.1) and content another test's subject
//   (T13.1-*, T13.2-1, T3-*).
// - T13.4-9 (the relation between derived paths, SPEC 13.4 and 14.22's
//   second sentence): each staging is one fresh workspace on which
//   `build --json`, `check --json`, and the gated read `ids --json`
//   (T13.3-3) run in turn, each inside a whole-root compare (the
//   compare-around machinery CERTIFICATIONS.md's VIOL-CORE-CHATTYREADS note
//   names this test under) — `build` writing and removing nothing, `check`
//   reporting without writing, the gated read modifying nothing — and each
//   exiting 1 with the form-exact 12.7 findings-only report ("answering
//   nothing" for `ids`) holding exactly one finding: condition 22
//   concerning the offending derived path, `locations` `[]`, nothing beside
//   it. The set is exact on all three: each workspace otherwise passes
//   `build`'s validations, the gate judges exactly `build`'s findings
//   (13.3), and `check`, on a workspace failing `build`'s validations,
//   leaves 14.10's mismatch forms unreported while neither whatever-validity
//   form is staged — no record exists before any build, and (f)'s names
//   `a.mdx`'s derived paths, every one still generated (SPEC 14.10).
//   TEST-SPEC states each staging's emission settings and code groups and
//   nothing more: the one spec group globs `specs/**/*.mdx` — `**/*.mdx` in
//   (b) and (f), whose sources lie at the workspace root — (c) and (e)'s
//   spec-source leg configure nothing else, and (e)'s code-source leg is
//   configured as (d) is (emission next to sources, a code group globbing
//   `specs/**/*.ts`). (e)'s companion paths are read per leg under that
//   leg's configuration — "the staging's configuration" — through
//   support.ts `readRecordedCompanionPaths` (a scratch twin holding
//   `specs/A.mdx`'s bytes at that path alone, built, its `inventory`
//   `recorded` set read), one staging per companion path in each leg.
//   "Staged before any build" is verified before each of those stagings'
//   first invocation — the offending path a directory ((a), (c), (d), (e))
//   or nothing ((b)), a miss being a harness error — and (f)'s premise is
//   re-pinned after its `build` of `a.mdx` alone: `out/a.md` the plain file
//   that build emitted, a product writing none there failing diagnosed.
// - T13.4-10 (rebuild-obstructing orphans, SPEC 13.4, 14.22, and 14.10's
//   correction): two arms, each in a fresh workspace — the recorded orphan,
//   and the unrecorded twin, its graph data deleted before the
//   reconfiguration (T13.3-2's operational definition, section-13.3.ts
//   `deleteGraphData`). Each builds under one spec group globbing
//   `specs/*.mdx` and `markdown: { emit: true, outDir: "out" }` — the
//   staging's emission settings and nothing more — premising
//   `out/specs/A.md` the plain file that build emitted, then reconfigures
//   `outDir` to "out/specs/A.md". The refused `build --json` and the
//   following `check --json` each run inside a whole-root compare (the
//   compare-around machinery CERTIFICATIONS.md's VIOL-CORE-CHATTYREADS note
//   names this test under): `build` modifies nothing, and `check`, which
//   never refreshes (13.3), writes nothing either, so the orphan stays,
//   byte-identical, until it is deleted by hand. The finding sets are
//   exact: `build`'s one condition 22 concerning `out/specs/A.md`;
//   `check`'s that finding beside one condition 10 concerning the same
//   path (the recorded arm) or alone (the twin) — a condition-10 finding
//   concerning a path no longer generated is the recorded-file form, and a
//   mismatch form would be a further finding. The recorded-file finding's
//   correction, "its manual deletion" (14.10), never a rebuild, is asserted
//   by H-3's robust matching over its `message` — required information,
//   never wording — judged by the pure `judgeManualDeletionCorrection` of
//   the human-report adapter (`test/helpers/adapters/human.ts`, driven by
//   S-5 vectors). The manual deletion is present in either form: a
//   deletion or removal word beside its manual character ("manual", "by
//   hand", or "yourself"), or an instruction to the reader to delete or
//   remove the file — a clause opening with "delete" or "remove" at the
//   message's start or after a clause boundary (`;`, `:`, `.`, `,`, an em
//   dash, "then", "and", "please", among others) and naming
//   `out/specs/A.md`, "it", or "the file" — so "delete it, then rebuild"
//   passes as "delete it manually" does. No clause may present a build or
//   xspec itself as what removes the file, unless it negates that removal:
//   a build "to remove" it, a build or xspec that "removes" or "will
//   remove" it, a removal "by" a build or xspec, a removal whose means is a
//   build ("remove it: run `xspec build`"), or a build offered as the
//   alternative ("or run `xspec build`"). So the generic correction
//   instructing rebuilding fails, while a message naming the refused
//   rebuild beside the manual deletion passes. After the manual
//   deletion, `build` exits 0, `out/specs/A.md/specs/A.md` is a plain file,
//   and `check` is clean, in both arms.
// - T13.4-11 stays inside CERTIFICATIONS.md §CONF-ORPHAN's scope (the test
//   is in-scope there): one spec group of trivial single-section `.mdx`
//   sources whose glob matches `.mdx` names alone; `markdown` emitting next
//   to sources (under `outDir: "out"` in (d) and (e)), then reconfigured —
//   emission disabled by `markdown` absent in (a) and (c) and by
//   `emit: false` in (b) and (f), both spellings 7.3 admits, or `outDir`
//   changed to `"md"`; (b)'s code group `specs/*.md` alone; commands
//   `build` and `check --json` alone. "No condition-10 finding concerning
//   P" is asserted over the 12.7 `path` member of the `stale-output`
//   findings, the first `check`'s other findings left unasserted — the
//   graph-data unit form unpinned (13.3, 14.10), and in (d) and (e) the
//   per-file form of the fresh emit destination `md/specs/A.md` — so that
//   `check` may exit 0 or 1, consistently with its findings (12.0). Every
//   "byte-identical" compares against a capture taken once the staging is
//   complete, before the first `check`. (e)'s inside staging puts the
//   link's target directory at `foreign/` in the root, under no group's
//   globs; its outside staging, beside the root in the workspace's
//   temporary directory; both links store a relative target. The
//   order-independence arm's "exactly the regenerated one" is H-6's
//   two-directory compare of the whole workspace against a twin holding
//   the same sources and configuration, freshly built — never `inventory`
//   (§CONF-ORPHAN's staging constraint).

import { Buffer } from "node:buffer";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import type {
  Finding,
  SessionStatusReport,
  SessionStatusRow,
} from "../../helpers/adapters/index.js";
import {
  assertJsonKeysByteSorted,
  assertReportMentions,
  corruptGraphDataShapeBlind,
  decodeFindingsReport,
  decodeInventoryRecordedDatum,
  decodeSessionStatusReport,
  judgeManualDeletionCorrection,
  renderPathValue,
} from "../../helpers/adapters/index.js";
import {
  assertBytesEqual,
  assertExitCode,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import type {
  DirectorySnapshot,
  SnapshotEntry,
} from "../../helpers/snapshot.js";
import {
  assertDirectoriesEqual,
  assertLeavesUnchanged,
  assertSnapshotsEqual,
  displaySnapshotPath,
  snapshotDirectory,
  snapshotKeyBytes,
} from "../../helpers/snapshot.js";
import { stagedMdx } from "../../helpers/staged-mdx.js";
import type { StagedMdx } from "../../helpers/staged-mdx.js";
import { stagedTs } from "../../helpers/staged-ts.js";
import type { StagedTs } from "../../helpers/staged-ts.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import { runProduct, summarizeResult } from "../../helpers/subprocess.js";
import type {
  InitialFileContents,
  WorkspaceDecl,
} from "../../helpers/workspace.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import { STREAMS_VALID_SOURCE } from "./section-12.0-i.js";
import { deleteGraphData } from "./section-13.3.js";
import { CORE_A_STAGED } from "./section-13.5.js";
import {
  assertConditionCounts,
  assertFindingConcernsPath,
  buildOk,
  expectExit,
  expectFindingFreeReport,
  readRecordedCompanionPaths,
  runCli,
  runFindingsReport,
  runJson,
} from "./support.js";

// Minimal declarative configuration (SPEC 7): exactly one spec group, no
// other keys — the CONF-CORE workspace shape (CERTIFICATIONS.md). T13.4-3's
// second half and T13.4-6's journal-occupant, session-occupant, and
// linked-working-directory arms stage it in workspaces created after their
// body's first product invocation, so S-7's sweep never reaches those
// stagings against the stub: a TypeScript staged-source record
// (helpers/staged-ts.ts; S-9's TypeScript and timing clauses), staged at
// every site.
const SPECS_ONLY_CONFIG = stagedTs(
  "T13.4-3/T13.4-6 xspec.config.ts — one spec group (T13.4-3's second half; T13.4-6's journal-occupant, session-occupant, and linked-working-directory arms)",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
);

// One spec group plus Markdown emission next to each source (SPEC 7.3), so
// all four derived-file classes exist: module, companions, emitted Markdown,
// graph data (SPEC 13.1–13.3).
const MARKDOWN_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  markdown: { emit: true }
})
`;

// Importless, tagless `.mdx` sources (the CONF-CORE shape; fine everywhere
// else too): `a` carries a child so `rename` exercises descendant rewriting;
// `g` is a second top-level leaf whose audit item is unblocked (SPEC 10.6).
// Byte for byte section-13.5.ts's CONF-CORE-shaped source, and staged here in
// workspaces created after a body's first invocation too (T13.4-3's second
// half, T13.4-6's later arms): that module's staged-source record (S-9's
// before-any-product clause; helpers/staged-mdx.ts), staged at every site.
const A_MDX = CORE_A_STAGED;

const A_ROOT = "specs/A.mdx";
const JOURNAL_REL = ".xspec/journal";
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

/** Snapshot exclusion pruning the top-level `.git` subtree. */
function excludeGitDir(relPathBytes: Uint8Array): boolean {
  return Buffer.from(relPathBytes).toString("latin1") === ".git";
}

/**
 * Whether a snapshot key (a `/`-separated workspace-relative path) is graph
 * data: under `.xspec/`, excluding the durable `.xspec/journal` and
 * `.xspec/reviews/` (SPEC 13.3, 13.4; TEST-SPEC T13.3-2's operational
 * definition, binding for T13.4-3 too).
 */
function isGraphDataKey(key: string): boolean {
  if (!key.startsWith(".xspec/")) return false;
  if (key === JOURNAL_REL) return false;
  if (key === REVIEWS_REL || key.startsWith(`${REVIEWS_REL}/`)) return false;
  return true;
}

/** Whether a snapshot key is a durable path: the journal or a session. */
function isDurableKey(key: string): boolean {
  return (
    key === JOURNAL_REL ||
    key === REVIEWS_REL ||
    key.startsWith(`${REVIEWS_REL}/`)
  );
}

/**
 * Remove the entry a snapshot key names, at the key's exact bytes
 * (`snapshotKeyBytes`, through `TestWorkspace.bytePath`); an absent entry is
 * no error. The keys the T13.4 bodies remove name derived files, whose
 * names the product may choose — a companion's suffix (SPEC 13.1), graph
 * data's layout (13.3) — so a name that is not ASCII, or not valid UTF-8, is
 * reached exactly; the key's characters read as a UTF-8 path would miss it
 * without an error.
 */
async function removeAtKey(
  workspace: TestWorkspace,
  key: string,
): Promise<void> {
  await fsp.rm(workspace.bytePath(snapshotKeyBytes(key)), { force: true });
}

/**
 * Overwrite the plain file a snapshot key names with `bytes`, at the key's
 * exact bytes (as `removeAtKey`). A raw write judging no staged-source
 * declaration: a derived file is no source — no discovery reaches it (SPEC
 * 13.4) — and the bytes are an edit of the product's own output at a path
 * the product chose, which S-9 never judges.
 */
async function overwriteAtKey(
  workspace: TestWorkspace,
  key: string,
  bytes: Uint8Array,
): Promise<void> {
  await fsp.writeFile(workspace.bytePath(snapshotKeyBytes(key)), bytes);
}

/** The entries of a snapshot satisfying `keep`, as a fresh map. */
function filteredEntries(
  entries: ReadonlyMap<string, SnapshotEntry>,
  keep: (key: string, entry: SnapshotEntry) => boolean,
): Map<string, SnapshotEntry> {
  const kept = new Map<string, SnapshotEntry>();
  for (const [key, entry] of entries) {
    if (keep(key, entry)) kept.set(key, entry);
  }
  return kept;
}

/** View a filtered entry map as a snapshot for `assertSnapshotsEqual`. */
function asSnapshot(
  root: string,
  entries: ReadonlyMap<string, SnapshotEntry>,
): DirectorySnapshot {
  return { root, entries };
}

/** A snapshot's regular-file entries (the T13.4-1 round-trip compare set). */
function fileEntries(snapshot: DirectorySnapshot): Map<string, SnapshotEntry> {
  return filteredEntries(snapshot.entries, (_key, entry) => {
    return entry.kind === "file";
  });
}

/**
 * Assert every entry of a snapshot is a regular file or a directory — the
 * harness staged only regular files, so a symlink or other non-plain entry is
 * product-written and violates "every file xspec writes is a plain file"
 * (SPEC 13.4).
 */
function assertAllEntriesPlain(
  snapshot: DirectorySnapshot,
  context: string,
): void {
  for (const [key, entry] of snapshot.entries) {
    if (entry.kind !== "file" && entry.kind !== "dir") {
      fail(
        `${context}: the entry at ${key} is a ${entry.kind} — every file ` +
          `xspec writes is a plain file suitable for committing (SPEC ` +
          `13.4), and the harness staged only regular files, so this ` +
          `entry is product-written`,
      );
    }
  }
}

/** Read a file's bytes, failing diagnosed when the path is not a file. */
async function readFileDiagnosed(
  workspace: TestWorkspace,
  rel: string,
  context: string,
): Promise<Uint8Array> {
  const kind = await workspace.kind(rel);
  if (kind !== "file") {
    fail(
      `${context}: expected a plain file at ${rel} (SPEC 13.4); found ${kind}`,
    );
  }
  return await workspace.readBytes(rel);
}

/** Assert the filesystem kind at a workspace-relative path, diagnosed. */
async function assertKindIs(
  workspace: TestWorkspace,
  rel: string,
  expected: "file" | "dir" | "absent",
  context: string,
): Promise<void> {
  const kind = await workspace.kind(rel);
  if (kind !== expected) {
    fail(`${context}; expected ${expected} at ${rel}, found ${kind}`);
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
// T13.4-1 — plain committable files, git round trip, sorted keys
// ---------------------------------------------------------------------------

const T13_4_1 = defineProductTest({
  id: "T13.4-1",
  title:
    "every file xspec writes is a plain file; committing the workspace into git and checking it back out round-trips builds and reads; every JSON object in the product-written session file — after `create` and again after a `resolve` rewrites it — has byte-sorted keys, shape- and value-blind (SPEC 13.4, 12.0, 10.4)",
  run: async (product) => {
    await withWorkspace(
      { files: { "xspec.config.ts": MARKDOWN_CONFIG, "specs/A.mdx": A_MDX } },
      async (workspace) => {
        const options = { exclude: excludeGitDir };
        await workspace.gitInit();

        // Staging: every written-file class comes into existence — derived
        // files via `build`, the journal via a journaled `rename` (SPEC
        // 6.1; the rename finishes by regenerating derived files, 6.4), a
        // session via `review create`.
        await buildOk(product, workspace, "T13.4-1 `build` (SPEC 12.1)");
        await expectExit(
          product,
          workspace,
          ["rename", A_ROOT, "a", "a2"],
          0,
          "T13.4-1 `rename specs/A.mdx a a2` — creates the journal (SPEC " +
            "6.1, 6.4)",
        );
        await expectExit(
          product,
          workspace,
          ["review", "create", "--strategy", "audit", "--name", "s"],
          0,
          "T13.4-1 `review create --strategy audit --name s` (SPEC 10.7)",
        );

        // Sorted keys, read #1: the session file as `create` wrote it. The
        // assertion is shape- and value-blind — every JSON object in the
        // document, whatever its keys (H-3).
        const afterCreate = await readFileDiagnosed(
          workspace,
          sessionRel("s"),
          "T13.4-1 the session file after `create` (SPEC 10.1)",
        );
        assertJsonKeysByteSorted(
          afterCreate,
          "T13.4-1 the session file after `create` — written with sorted " +
            "keys (SPEC 13.4, 12.0)",
        );

        // Resolve an unblocked leaf item so the session file is rewritten
        // (SPEC 10.4: `current` is rewritten at each resolve).
        const staged = await sessionStatus(product, workspace, "s", "T13.4-1");
        const gItem = requireRowByScope(
          staged,
          "specs/A.mdx#g",
          "T13.4-1 staging item lookup",
        );
        await expectExit(
          product,
          workspace,
          ["review", "resolve", "s", gItem.id, "--status", "no-change"],
          0,
          "T13.4-1 `review resolve s <leaf item> --status no-change` (SPEC " +
            "10.7)",
        );

        // Sorted keys, read #2: the session file as the resolve rewrote it.
        const afterResolve = await readFileDiagnosed(
          workspace,
          sessionRel("s"),
          "T13.4-1 the session file after `resolve` (SPEC 10.1, 10.4)",
        );
        assertJsonKeysByteSorted(
          afterResolve,
          "T13.4-1 the session file after a `resolve` rewrote it — still " +
            "sorted keys (SPEC 13.4, 10.4)",
        );

        // Plain-file scan over the fully staged workspace: modules,
        // companions, Markdown, graph data, journal, and session are all
        // present; none may be a symlink or other non-plain entry.
        const w1 = await snapshotDirectory(workspace.root, options);
        assertAllEntriesPlain(w1, "T13.4-1 after staging every file class");

        // Reads before the round trip, for the byte-identical comparison
        // after it (SPEC 12.0: byte-deterministic output for byte-identical
        // input).
        await expectExit(
          product,
          workspace,
          ["check"],
          0,
          "T13.4-1 `check` before the round trip — the staged workspace is " +
            "clean (SPEC 12.2)",
        );
        const idsBefore = await runCli(product, workspace, ["ids", "--json"]);
        assertExitCode(
          idsBefore,
          0,
          "T13.4-1 `ids --json` before the round trip",
        );
        const statusBefore = await runCli(product, workspace, [
          "review",
          "status",
          "s",
          "--json",
        ]);
        assertExitCode(
          statusBefore,
          0,
          "T13.4-1 `review status s --json` before the round trip",
        );

        // The round trip: commit everything, wipe the worktree, and check it
        // back out clean.
        await workspace.gitCommitAll("the workspace as built");
        for (const name of await workspace.readdirNames(".")) {
          if (name === ".git") continue;
          await fsp.rm(workspace.path(name), { recursive: true, force: true });
        }
        await workspace.git(["checkout", "--", "."]);

        // Every product-written plain file round-trips byte-exactly (git
        // preserves plain-file bytes; empty directories are not files and
        // are outside the compare — SPEC 13.4 constrains files).
        const w2 = await snapshotDirectory(workspace.root, options);
        assertSnapshotsEqual(
          asSnapshot(workspace.root, fileEntries(w1)),
          asSnapshot(workspace.root, fileEntries(w2)),
          "T13.4-1: the workspace's regular files after commit + clean " +
            "checkout vs before — every file xspec writes survives a git " +
            "round trip byte-exactly (SPEC 13.4)",
        );

        // Reads round-trip: byte-identical input, byte-identical answers.
        await expectExit(
          product,
          workspace,
          ["check"],
          0,
          "T13.4-1 `check` after the round trip — the checked-out " +
            "workspace is as clean as the committed one (SPEC 13.4, 12.2)",
        );
        const idsAfter = await runCli(product, workspace, ["ids", "--json"]);
        assertExitCode(
          idsAfter,
          0,
          "T13.4-1 `ids --json` after the round trip",
        );
        assertBytesEqual(
          idsAfter.stdoutBytes,
          idsBefore.stdoutBytes,
          "T13.4-1 `ids --json` output after vs before the git round trip " +
            "— reads round-trip (SPEC 13.4, 12.0)",
        );
        const statusAfter = await runCli(product, workspace, [
          "review",
          "status",
          "s",
          "--json",
        ]);
        assertExitCode(
          statusAfter,
          0,
          "T13.4-1 `review status s --json` after the round trip",
        );
        assertBytesEqual(
          statusAfter.stdoutBytes,
          statusBefore.stdoutBytes,
          "T13.4-1 `review status s --json` output after vs before the git " +
            "round trip — reads round-trip (SPEC 13.4, 12.0)",
        );

        // Builds round-trip: rebuilding the checked-out workspace lands on
        // the same fixed point, and everything stays plain.
        await buildOk(
          product,
          workspace,
          "T13.4-1 `build` after the round trip (SPEC 12.1)",
        );
        const w3 = await snapshotDirectory(workspace.root, options);
        assertSnapshotsEqual(
          asSnapshot(workspace.root, fileEntries(w1)),
          asSnapshot(workspace.root, fileEntries(w3)),
          "T13.4-1: the workspace's regular files after the post-checkout " +
            "rebuild vs before the round trip — builds round-trip (SPEC " +
            "13.4, 12.0, 12.1)",
        );
        assertAllEntriesPlain(w3, "T13.4-1 after the post-checkout rebuild");
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T13.4-2 — derived reproducibility
// ---------------------------------------------------------------------------

// Deliberately non-derived bytes, invalid UTF-8 included, for the
// garbage-overwrite round (derived-file content is product-defined, so the
// garbage need only differ from any plausible generated content).
const GARBAGE_BYTES = Buffer.concat([
  Buffer.from("?? harness garbage overwriting a derived file ??\n", "utf8"),
  Buffer.from([0x00, 0xff, 0xfe, 0x80, 0x0d]),
]);

const T13_4_2 = defineProductTest({
  id: "T13.4-2",
  title:
    "deleting, truncating, and garbage-overwriting each class of derived file (module, companions, Markdown, graph data) is repaired by `build`, which restores all of them byte-exactly (SPEC 13.4, 12.1)",
  run: async (product) => {
    await withWorkspace(
      { files: { "xspec.config.ts": MARKDOWN_CONFIG, "specs/A.mdx": A_MDX } },
      async (workspace) => {
        await buildOk(product, workspace, "T13.4-2 initial `build`");
        const s0 = await snapshotDirectory(workspace.root);

        // The mutation targets: every derived file of every class. Module
        // and companions all carry the `A.xspec.` stem (SPEC 13.1), the
        // emitted Markdown is specs/A.md (SPEC 13.2, 7.3), graph data is
        // everything under .xspec/ (SPEC 13.3; no journal or session exists
        // here).
        const targets = [
          ...filteredEntries(s0.entries, (key, entry) => {
            if (entry.kind !== "file") return false;
            return (
              key.startsWith("specs/A.xspec.") ||
              key === "specs/A.md" ||
              isGraphDataKey(key)
            );
          }).keys(),
        ].sort();
        const classPresent = (predicate: (key: string) => boolean): boolean =>
          targets.some(predicate);
        if (
          !classPresent((key) => key === "specs/A.xspec.ts") ||
          !classPresent((key) => key === "specs/A.md") ||
          !classPresent(isGraphDataKey)
        ) {
          fail(
            "T13.4-2: staging premise — after `build`, the generated module " +
              "specs/A.xspec.ts, the emitted Markdown specs/A.md, and graph " +
              "data under .xspec/ must all exist (SPEC 13.1, 13.2, 13.3); " +
              `found targets: ${JSON.stringify(targets.map(displaySnapshotPath))}`,
          );
        }

        const bytesOf = (key: string): Uint8Array => {
          const entry = s0.entries.get(key);
          // Targets were selected from s0's file entries, so this cannot miss.
          if (entry === undefined || entry.kind !== "file") {
            throw new Error(
              `T13.4-2 internal error: no file entry for ${displaySnapshotPath(key)}`,
            );
          }
          return entry.bytes;
        };

        // Each round acts on each target at its exact bytes (`removeAtKey`,
        // `overwriteAtKey`): companions' suffixes and graph data's names
        // are the product's (SPEC 13.1, 13.3). The truncation and the
        // garbage are raw writes judging no S-9 declaration — a derived
        // file is no source (13.4), and these are edits of product-written
        // bytes.
        const rounds: readonly (readonly [
          string,
          (key: string) => Promise<void>,
        ])[] = [
          [
            "delete",
            async (key) => {
              await removeAtKey(workspace, key);
            },
          ],
          [
            "truncate",
            async (key) => {
              const bytes = bytesOf(key);
              await overwriteAtKey(
                workspace,
                key,
                bytes.subarray(0, Math.floor(bytes.length / 2)),
              );
            },
          ],
          [
            "garbage-overwrite",
            async (key) => {
              await overwriteAtKey(workspace, key, GARBAGE_BYTES);
            },
          ],
        ];

        for (const [name, mutate] of rounds) {
          for (const key of targets) {
            await mutate(key);
          }
          await buildOk(
            product,
            workspace,
            `T13.4-2 (${name}) \`build\` over the damaged derived files — a ` +
              `conflicted, corrupted, deleted, or orphaned derived file is ` +
              `correctly resolved by rebuilding (SPEC 13.4, 12.1)`,
          );
          const after = await snapshotDirectory(workspace.root);
          assertSnapshotsEqual(
            s0,
            after,
            `T13.4-2 (${name}): the workspace after the repairing \`build\` ` +
              `vs the clean fixed point — every derived-file class is ` +
              `restored byte-exactly (SPEC 13.4, 12.0; H-4 self-comparison)`,
          );
        }
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T13.4-3 — orphan knowledge boundary
// ---------------------------------------------------------------------------

// The narrowed configuration: B.mdx no longer belongs to any group, so B's
// derived files are no longer generated (a literal path is a valid glob,
// SPEC 7). Staged by `file()` after each half's initial build: a TypeScript
// staged-source record (helpers/staged-ts.ts; S-9's TypeScript and timing
// clauses).
const A_ONLY_CONFIG = stagedTs(
  "T13.4-3 xspec.config.ts — narrowed to specs/A.mdx (each half's configuration change after its build)",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/A.mdx"]
  }
})
`,
);

const A_MODULE_REL = "specs/A.xspec.ts";
const B_DERIVED_PREFIX = "specs/B.xspec.";

/** A snapshot's graph-data entries (T13.3-2's operational path set). */
function graphDataEntries(
  snapshot: DirectorySnapshot,
): Map<string, SnapshotEntry> {
  return filteredEntries(snapshot.entries, (key) => isGraphDataKey(key));
}

/**
 * One half of the orphan knowledge boundary (SPEC 13.4: a derived file
 * orphaned while the record was itself missing or unreadable, 14.23): how
 * the product-written record is put out of xspec's knowledge after the
 * initial `build` and before the configuration change.
 */
interface OrphanBoundaryHalf {
  readonly label: string;
  readonly disturbRecord: (
    workspace: TestWorkspace,
    tag: string,
  ) => Promise<void>;
}

/**
 * The record is replaced by the successful `build` (SPEC 13.3, 14.23):
 * asserted at the record-consulting surfaces — `check` exits 0 (the record
 * readable and current: no condition-23 or graph-data staleness, and the
 * orphan, unrecorded, names no stale file) and `inventory`'s `recorded`
 * datum is the plain current generation, naming A's module and no B path
 * (13.3: the paths of the derived files most recently generated) — both
 * reads modifying nothing (13.3, 11.6).
 */
async function assertRecordReplaced(
  product: ProductBinding,
  workspace: TestWorkspace,
  tag: string,
): Promise<void> {
  await assertLeavesUnchanged(
    workspace.root,
    async () => {
      await expectExit(
        product,
        workspace,
        ["check"],
        0,
        `${tag} \`check\` after the narrowed build — clean: the successful ` +
          `build replaced the record, so it is readable and current (no ` +
          `condition-23 unit form, no graph-data staleness), and the ` +
          `orphan, recorded nowhere, is outside \`check\`'s knowledge too ` +
          `— no stale-file finding names it (SPEC 13.3, 13.4, 14.10, ` +
          `14.23, 12.2)`,
      );
      const context = `${tag} \`inventory\` after the narrowed build`;
      const recorded = decodeInventoryRecordedDatum(
        await runJson(product, workspace, ["inventory"], context),
        context,
      );
      if (recorded.state !== "value") {
        fail(
          `${context}: the successful \`build\` replaces the record, so ` +
            `the record-supplied datum is the plain recorded derived-file ` +
            `paths again — never unavailability, never null (SPEC 13.3, ` +
            `14.23, 11.6, 12.7); got state ${JSON.stringify(recorded.state)}`,
        );
      }
      // ASCII paths are plain strings in every 12.7 path value (the decoder
      // rejects a valid-UTF-8 path in byte form), so the string compares
      // are exact.
      const paths = recorded.value;
      if (!paths.some((p) => typeof p === "string" && p === A_MODULE_REL)) {
        fail(
          `${context}: the replaced record is the current generation — it ` +
            `names A's generated module ${JSON.stringify(A_MODULE_REL)} ` +
            `(SPEC 13.3, 13.1, 11.6); got ${JSON.stringify(paths)}`,
        );
      }
      const strays = paths.filter(
        (p) => typeof p === "string" && p.startsWith(B_DERIVED_PREFIX),
      );
      if (strays.length > 0) {
        fail(
          `${context}: the replaced record holds the paths of the derived ` +
            `files most recently generated — B.mdx is no longer a ` +
            `configured source, so no B-derived path is recorded (the ` +
            `orphans are outside xspec's knowledge, SPEC 13.3, 13.4); got ` +
            JSON.stringify(strays),
        );
      }
    },
    `${tag}: \`check\` and \`inventory\` after the narrowed build modify ` +
      `nothing — \`check\` never refreshes and \`inventory\` never writes ` +
      `(SPEC 13.3, 11.6)`,
  );
}

/**
 * Walk one half of the boundary: build so B's derived files exist and are
 * recorded; disturb the record; narrow the configuration so B's files are no
 * longer generated; `build` — the record is replaced (`assertRecordReplaced`)
 * and B's orphaned files, outside xspec's knowledge, survive byte-exactly; a
 * subsequent `build` leaves them alone; deleted manually, they stay gone.
 * Returns the graph data as the narrowed `build` wrote it, for the
 * cross-half byte compare.
 */
async function walkOrphanBoundary(
  product: ProductBinding,
  half: OrphanBoundaryHalf,
): Promise<DirectorySnapshot> {
  const tag = `T13.4-3 (${half.label})`;
  return await withWorkspace(
    {
      files: {
        "xspec.config.ts": SPECS_ONLY_CONFIG,
        "specs/A.mdx": A_MDX,
        // The second half's workspace follows the first half's invocations:
        // the staged-source record of these bytes (`B_MDX`, below).
        "specs/B.mdx": B_MDX,
      },
    },
    async (workspace) => {
      // Build so B's derived files exist and are recorded (SPEC 13.3).
      await buildOk(product, workspace, `${tag} initial \`build\``);
      const s1 = await snapshotDirectory(workspace.root);
      const bDerived = [
        ...filteredEntries(s1.entries, (key, entry) => {
          return entry.kind === "file" && key.startsWith(B_DERIVED_PREFIX);
        }).keys(),
      ].sort();
      if (!bDerived.includes("specs/B.xspec.ts")) {
        fail(
          `${tag}: staging premise — after \`build\`, B.mdx's generated ` +
            `module specs/B.xspec.ts exists as a plain file (SPEC 13.1); ` +
            `found B-derived files: ${JSON.stringify(bDerived.map(displaySnapshotPath))}`,
        );
      }

      // Put the record out of xspec's knowledge — missing or unreadable —
      // before the configuration change (SPEC 13.4, 14.23).
      await half.disturbRecord(workspace, tag);

      // Narrow the configuration so B's files are no longer generated, then
      // build: B's former derived files are orphaned, but the record that
      // would identify them was missing or unreadable — they are outside
      // xspec's knowledge and must not be removed; the build replaces the
      // record.
      await workspace.file("xspec.config.ts", A_ONLY_CONFIG);
      await buildOk(
        product,
        workspace,
        `${tag} \`build\` under the narrowed configuration (SPEC 12.1)`,
      );
      const s2 = await snapshotDirectory(workspace.root);
      for (const key of bDerived) {
        const before = s1.entries.get(key);
        const after = s2.entries.get(key);
        const shown = displaySnapshotPath(key);
        if (before === undefined || before.kind !== "file") {
          throw new Error(`${tag} internal error: no file entry for ${shown}`);
        }
        if (after === undefined || after.kind !== "file") {
          fail(
            `${tag}: the orphaned derived file ${shown} must survive the ` +
              `build — it was orphaned while the recorded derived-file ` +
              `paths were ${half.label === "missing record" ? "missing" : "unreadable"}, ` +
              `so it is outside xspec's knowledge and is not removed ` +
              `(SPEC 13.4, 13.3, 14.23); found ` +
              `${after === undefined ? "absent" : after.kind}`,
          );
        }
        assertBytesEqual(
          after.bytes,
          before.bytes,
          `${tag}: the orphaned derived file ${shown} after the build — ` +
            `left alone byte-exactly (SPEC 13.4)`,
        );
      }
      if (s2.entries.get(A_MODULE_REL)?.kind !== "file") {
        fail(
          `${tag}: ${A_MODULE_REL} must exist after the build — A.mdx is ` +
            `still a configured source (SPEC 13.1, 12.1)`,
        );
      }
      await assertRecordReplaced(product, workspace, tag);

      // A subsequent build leaves the stray files (and everything else at
      // the fixed point) alone.
      await buildOk(product, workspace, `${tag} subsequent \`build\``);
      const s3 = await snapshotDirectory(workspace.root);
      assertSnapshotsEqual(
        s2,
        s3,
        `${tag}: the workspace after a subsequent build vs before it — ` +
          `subsequent builds leave the stray files alone (SPEC 13.4, 12.0)`,
      );

      // The orphans may be deleted manually; builds do not resurrect them
      // (they are not generated by the current configuration and not
      // recorded). Each goes at its exact bytes — a companion's suffix is
      // the product's (SPEC 13.1) — through T13.4-2's byte-path removal.
      for (const key of bDerived) {
        await removeAtKey(workspace, key);
      }
      await buildOk(
        product,
        workspace,
        `${tag} \`build\` after the manual deletion (SPEC 12.1)`,
      );
      const s4 = await snapshotDirectory(workspace.root);
      const expected = filteredEntries(s3.entries, (key) => {
        return !bDerived.includes(key);
      });
      assertSnapshotsEqual(
        asSnapshot(workspace.root, expected),
        s4,
        `${tag}: the workspace after deleting the strays and rebuilding — ` +
          `the manually deleted orphans stay gone and nothing else changes ` +
          `(SPEC 13.4, 12.0)`,
      );
      return asSnapshot(workspace.root, graphDataEntries(s2));
    },
  );
}

const T13_4_3 = defineProductTest({
  id: "T13.4-3",
  title:
    "a derived file orphaned while the recorded derived-file paths were missing (deleted) or unreadable (corrupted shape-blind before the configuration change) is outside xspec's knowledge: `build` under the narrowed configuration replaces the record — `check` clean, `recorded` the current generation, the graph data byte-identical across the two halves — and leaves the orphan alone byte-exactly, subsequent builds likewise, and after manual deletion it stays gone (SPEC 13.4, 13.3, 14.23, 12.1)",
  run: async (product) => {
    // The missing half: destroy the graph data — and with it the recorded
    // derived-file paths (T13.3-2's operational definition: everything
    // under .xspec/ except the durable journal and reviews/; neither
    // exists here) — through T13.3-2's own `deleteGraphData`, which lists
    // .xspec/ by raw name bytes and removes each entry at its exact bytes,
    // so every name the product chose goes (SPEC 13.3).
    const missing = await walkOrphanBoundary(product, {
      label: "missing record",
      disturbRecord: async (workspace, tag) => {
        const xspecKind = await workspace.kind(".xspec");
        if (xspecKind !== "dir") {
          fail(
            `${tag}: staging premise — after \`build\`, the .xspec/ ` +
              `directory exists (SPEC 13.3); found ${xspecKind}`,
          );
        }
        await deleteGraphData(workspace, `${tag} staging`);
      },
    });

    // The unreadable half: corrupt the product-written record shape-blind
    // (T6.6-6's staging; H-3 record-staging adapter — garbage over
    // T13.3-2's operational path set, files present but readable as no
    // record, SPEC 14.23). Premise, read through the record-consulting
    // surface inside a whole-root compare: `inventory` exits 1 with
    // `recorded` explicitly unavailable (T11.6-4's pin) and leaves the
    // state intact (11.6: it neither refreshes nor writes), so the
    // configuration change finds the record unreadable.
    const unreadable = await walkOrphanBoundary(product, {
      label: "unreadable record",
      disturbRecord: async (workspace, tag) => {
        await corruptGraphDataShapeBlind(workspace.root, `${tag} staging`);
        const context =
          `${tag} premise \`inventory\` with the record corrupted ` +
          `shape-blind before the configuration change`;
        await assertLeavesUnchanged(
          workspace.root,
          async () => {
            const result = await expectExit(
              product,
              workspace,
              ["inventory"],
              1,
              `${context} — an answer carrying the condition-23 finding ` +
                `exits 1, emitted in full (SPEC 14.23, 12.0)`,
            );
            const recorded = decodeInventoryRecordedDatum(
              parseJsonStdout(
                result,
                `${context} — inventory is JSON-only: a single JSON ` +
                  `document as the entire stdout (SPEC 11, 12.0)`,
              ),
              context,
            );
            if (recorded.state !== "unavailable") {
              fail(
                `${context}: staging premise — recorded state that exists ` +
                  `but cannot be read as a record reports \`recorded\` ` +
                  `explicitly unavailable (SPEC 14.23, 11.6, 12.7); got ` +
                  `state ${JSON.stringify(recorded.state)}`,
              );
            }
          },
          `${context}: modifies nothing — the corrupt state is neither ` +
            `read, repaired, nor replaced by \`inventory\` (SPEC 11.6, 13.3)`,
        );
      },
    });

    // Cross-half compare, whole and opaque (H-4 self-comparison): derived
    // output is a function of sources, configuration, and the journal alone
    // (SPEC 13.4), identical across the halves — so the graph data the
    // narrowed `build` wrote over the garbage is byte-identical to what it
    // wrote over nothing: the record replaced with exactly what `build`
    // writes, no garbage left beside it (13.3, 12.0).
    assertSnapshotsEqual(
      missing,
      unreadable,
      "T13.4-3: the graph data the narrowed `build` wrote over the " +
        "unreadable record vs over the missing one — byte-identical: " +
        "derived files are reproducible from sources, configuration, and " +
        "the journal alone, identical across the halves, so a successful " +
        "build replaces the unreadable record with exactly what it writes " +
        "(SPEC 13.4, 13.3, 14.23, 12.0; H-4 self-comparison)",
    );
  },
});

// ---------------------------------------------------------------------------
// T13.4-4 — derived paths belong to xspec
// ---------------------------------------------------------------------------

// The common staging of the dirty workspace and its pristine reference
// (module-header rationale: derived output is a function of sources,
// configuration, and the journal alone, SPEC 13.4). The link arm's targets
// lie outside the workspace root (`stageLinkToOutsideFile`, below), so they
// take no part in the whole-workspace compare.
const T13_4_4_COMMON: Readonly<Record<string, InitialFileContents>> = {
  "xspec.config.ts": MARKDOWN_CONFIG,
  "specs/A.mdx": A_MDX,
};

// Where the shared link staging puts its targets: a directory beside the
// workspace root, in the workspace's own temporary directory (`tempRoot`,
// whose `work/` is the root), disposed with it.
const OUTSIDE_LINK_TARGETS_DIR = "outside-link-targets";

/**
 * A symbolic link the harness staged at a derived file's own path, resolving
 * to a plain file outside the workspace root, with the target's bytes as
 * captured before any product invocation over the staging. Exported with the
 * staging for T6.5-21(d) (section-6.5-iv.ts).
 */
export interface OutsideFileLink {
  /**
   * The link's workspace-relative path as its exact bytes (`/`-separated):
   * a derived file's own path.
   */
  readonly linkRelBytes: Uint8Array;
  /** The target's absolute path, beside the workspace root. */
  readonly targetAbs: string;
  /** The target's bytes, captured once the staging was complete. */
  readonly targetBefore: Uint8Array;
}

/** A byte path rendered for a diagnosis, as `displaySnapshotPath` renders. */
function displayBytePath(bytes: Uint8Array): string {
  return displaySnapshotPath(Buffer.from(bytes).toString("latin1"));
}

/**
 * The one link staging T13.4-4's link arm and T13.4-11(c) share: the
 * occupant at a derived file's own path (the file a build put there) is
 * replaced by a symbolic link resolving to a fresh plain file outside the
 * workspace root, and the target's bytes are captured before the product
 * runs over the staging; `assertOutsideLinkTargetUnchanged` compares them
 * afterward. CERTIFICATIONS.md certifies this staging through T13.4-11(c)
 * (VIOL-ORPHAN-LINKTARGET), and T13.4-4's link arm rides that certification
 * insofar as it shares this staging (the Exclusions entry "T13.4-4's link
 * arm" and the violator's note) — so both stage through this one function,
 * and so does T6.5-21(d)'s link occupant (section-6.5-iv.ts), which rides
 * the certification likewise, insofar as it shares this staging and its
 * after-compare. The staging verifies itself — the path holds a symbolic
 * link resolving to the target — and a staging that misses is an internal
 * harness error, never a product verdict. The link stores a relative
 * target; `targetName` names the target file, unique within the workspace.
 *
 * `linkRel` is the link's workspace-relative path as its exact bytes — a
 * byte path, `/`-separated and validated like every byte path
 * (`TestWorkspace.bytePath`): an ASCII path's bytes (T13.4-11(c),
 * T6.5-21(d)) or a snapshot key's `snapshotKeyBytes` (T13.4-4, whose
 * graph-data link stands at a name the product chose, SPEC 13.3). The
 * occupant is cleared, the link created, and the staging verified at those
 * bytes, so a final name that is not ASCII, or not valid UTF-8, is linked
 * exactly; diagnoses render the path with `displaySnapshotPath`. Only the
 * final name may be the product's: the link's directory, which every
 * caller names in ASCII (`specs/`, `.xspec/`), must be valid UTF-8 — an
 * internal error otherwise — for the relative target is computed from it
 * as a native path.
 */
export async function stageLinkToOutsideFile(
  workspace: TestWorkspace,
  linkRel: Uint8Array,
  targetName: string,
): Promise<OutsideFileLink> {
  const linkRelBytes = Buffer.from(linkRel);
  // `bytePath` validates the byte path (relative, no NUL, no `.`, `..`, or
  // empty segment); the link's directory is its bytes before the last `/`.
  const linkAbs = workspace.bytePath(linkRelBytes);
  const shown = displayBytePath(linkRelBytes);
  const slash = linkRelBytes.lastIndexOf(0x2f);
  const dirBytes = linkRelBytes.subarray(0, Math.max(slash, 0));
  const dirRel = dirBytes.toString("utf8");
  if (!Buffer.from(dirRel, "utf8").equals(dirBytes)) {
    throw new Error(
      `internal error: the directory of the symbolic link to stage at ` +
        `${shown} is not valid UTF-8 — only the link's final name may be ` +
        `a name the product chose`,
    );
  }
  const linkDirAbs = dirRel === "" ? workspace.root : workspace.path(dirRel);
  const targetAbs = path.join(
    workspace.tempRoot,
    OUTSIDE_LINK_TARGETS_DIR,
    targetName,
  );
  await fsp.mkdir(path.dirname(targetAbs), { recursive: true });
  await fsp.writeFile(
    targetAbs,
    `harness-owned link target outside the workspace root, linked from ` +
      `${shown}: never written through, never removed\n`,
    { flag: "wx" },
  );
  await fsp.rm(linkAbs, { force: true });
  await fsp.mkdir(linkDirAbs, { recursive: true });
  await fsp.symlink(path.relative(linkDirAbs, targetAbs), linkAbs, "file");
  if ((await workspace.kind(linkRelBytes)) !== "symlink") {
    throw new Error(
      `internal error: failed to stage a symbolic link at ${shown}`,
    );
  }
  const [resolved, expected] = await Promise.all([
    fsp.realpath(linkAbs),
    fsp.realpath(targetAbs),
  ]);
  if (resolved !== expected) {
    throw new Error(
      `internal error: the symbolic link staged at ${shown} resolves to ` +
        `${resolved}, not to its target ${expected}`,
    );
  }
  return {
    linkRelBytes,
    targetAbs,
    targetBefore: await fsp.readFile(targetAbs),
  };
}

/**
 * The shared link staging's after-compare: the target outside the workspace
 * root is still a plain file holding exactly the bytes captured before the
 * product ran — nothing written through the link, and the target never
 * removed in the link's place (SPEC 13.4: writes never traverse symbolic
 * links; a removal removes a symbolic link itself, never its target).
 */
export async function assertOutsideLinkTargetUnchanged(
  link: OutsideFileLink,
  context: string,
): Promise<void> {
  let kind: "file" | "dir" | "symlink" | "other" | "absent";
  try {
    const stats = await fsp.lstat(link.targetAbs);
    kind = stats.isSymbolicLink()
      ? "symlink"
      : stats.isFile()
        ? "file"
        : stats.isDirectory()
          ? "dir"
          : "other";
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    kind = "absent";
  }
  const shown = displayBytePath(link.linkRelBytes);
  if (kind !== "file") {
    fail(
      `${context}: the target of the symbolic link staged at ` +
        `${shown} — a plain file outside the workspace root, at ` +
        `${link.targetAbs} — must still be that plain file, byte-identical ` +
        `(SPEC 13.4: a symbolic link itself, never its target; nothing is ` +
        `ever written through a link); found ${kind}`,
    );
  }
  assertBytesEqual(
    await fsp.readFile(link.targetAbs),
    link.targetBefore,
    `${context}: the target of the symbolic link staged at ` +
      `${shown}, outside the workspace root, byte-identical (SPEC ` +
      `13.4: nothing is ever written through a link, and a removal removes ` +
      `the link itself, never its target)`,
  );
}

// The directory-occupant stagings (T13.4-4's arm 3): a directory at each of
// the two derived paths SPEC pins for `specs/A.mdx` — the generated module's
// (13.1: `NAME.xspec.ts` in the source's directory) and the emitted
// Markdown's (13.2, 7.3: next to the source under MARKDOWN_CONFIG) —
// holding nothing xspec discovers or generates: empty in one workspace, and
// in a second each holding `notes.txt`, a file no group matches (the one
// spec group globs `.mdx` names, no code group is configured, and the name
// holds no `.xspec.`, so no exclusion is involved either, 13.4). Neither
// path is a directory component of a discovered source's path or of another
// derived path, so 14.22's refusal does not reach it (T13.4-9 stages the
// paths it does reach): writing the derived file replaces the directory
// (13.4). Both workspaces are staged before the body's first product
// invocation, so their plain configuration is no undeclared staging (S-9's
// timing clause).
const T13_4_4_DIRECTORY_PATHS = ["specs/A.xspec.ts", "specs/A.md"] as const;

/** One directory-occupant staging of T13.4-4's arm 3. */
interface DirectoryOccupantStaging {
  /** The staging's tag in assertion contexts. */
  readonly tag: string;
  /** The common staging plus the directories at the derived paths. */
  readonly decl: WorkspaceDecl;
  /** The one file each directory holds, by name; none when empty. */
  readonly held: string | undefined;
}

const T13_4_4_HELD_NAME = "notes.txt";

const T13_4_4_DIRECTORY_STAGINGS: readonly DirectoryOccupantStaging[] = [
  {
    tag: "empty directories",
    decl: { files: T13_4_4_COMMON, dirs: T13_4_4_DIRECTORY_PATHS },
    held: undefined,
  },
  {
    tag: "directories each holding a file no group matches",
    decl: {
      files: {
        ...T13_4_4_COMMON,
        ...Object.fromEntries(
          T13_4_4_DIRECTORY_PATHS.map((dir) => [
            `${dir}/${T13_4_4_HELD_NAME}`,
            `user notes in the directory at ${dir}: no group matches them\n`,
          ]),
        ),
      },
    },
    held: T13_4_4_HELD_NAME,
  },
];

/**
 * A directory-occupant staging verifies itself before any product
 * invocation: each derived path holds a real directory holding exactly the
 * staged plain file, or nothing. A staging that misses is an internal
 * harness error, never a product verdict.
 */
async function verifyDirectoryOccupants(
  workspace: TestWorkspace,
  staging: DirectoryOccupantStaging,
): Promise<void> {
  const expected = staging.held === undefined ? [] : [staging.held];
  for (const dir of T13_4_4_DIRECTORY_PATHS) {
    const names =
      (await workspace.kind(dir)) === "dir"
        ? await workspace.readdirNames(dir)
        : undefined;
    const heldKinds = await Promise.all(
      expected.map((name) => workspace.kind(`${dir}/${name}`)),
    );
    if (
      names === undefined ||
      names.join("/") !== expected.join("/") ||
      heldKinds.some((kind) => kind !== "file")
    ) {
      throw new Error(
        `internal error: failed to stage ${staging.tag} at ${dir}`,
      );
    }
  }
}

const T13_4_4 = defineProductTest({
  id: "T13.4-4",
  title:
    "a user-created file at a derived path is replaced by `build`; a symbolic link at a derived file's own path is replaced as the occupant — nothing is written through it: link target byte-identical after the build, link gone, plain file present, no error; and a directory at a derived path holding nothing xspec discovers or generates — empty, and separately holding a file no group matches — is replaced by the derived file: `build` exits 0, a plain file there, `check` clean (SPEC 13.4, 12.1; 14.22's refusal reaching only a directory component of a discovered source's or another derived path)",
  run: async (product) => {
    const reference = await TestWorkspace.create({ files: T13_4_4_COMMON });
    const dirty = await TestWorkspace.create({
      files: {
        ...T13_4_4_COMMON,
        // User-created files at derived paths, present before any build.
        "specs/A.xspec.ts": "user content at the generated module's path\n",
        "specs/A.md": "user content at the emitted Markdown's path\n",
      },
      // S-9: the noise at the generated module's path is no code source —
      // a derived path no discovery reaches (13.4), its well-formedness
      // undeclared.
      ts: { unchecked: ["specs/A.xspec.ts"] },
    });
    const directoryArms: {
      readonly staging: DirectoryOccupantStaging;
      readonly workspace: TestWorkspace;
    }[] = [];
    try {
      // Arm 3's workspaces, staged and verified before the body's first
      // product invocation (S-9's timing clause).
      for (const staging of T13_4_4_DIRECTORY_STAGINGS) {
        const workspace = await TestWorkspace.create(staging.decl);
        directoryArms.push({ staging, workspace });
        await verifyDirectoryOccupants(workspace, staging);
      }

      // The pristine reference build fixes the expected byte tree.
      await buildOk(product, reference, "T13.4-4 reference `build`");
      const sr = await snapshotDirectory(reference.root);
      const module = sr.entries.get("specs/A.xspec.ts");
      if (module === undefined || module.kind !== "file") {
        fail(
          "T13.4-4: staging premise — the reference build generates " +
            "specs/A.xspec.ts as a plain file (SPEC 13.1)",
        );
      }
      if (sr.entries.get("specs/A.md")?.kind !== "file") {
        fail(
          "T13.4-4: staging premise — the reference build emits specs/A.md " +
            "(SPEC 13.2, 7.3)",
        );
      }
      const graphFiles = [
        ...filteredEntries(sr.entries, (key, entry) => {
          return entry.kind === "file" && isGraphDataKey(key);
        }).keys(),
      ].sort();
      const graphKey = graphFiles[0];
      if (graphKey === undefined) {
        fail(
          "T13.4-4: staging premise — the reference build writes graph " +
            "data under .xspec/ (SPEC 13.3)",
        );
      }
      // Discrimination premise: the generated module must differ from the
      // staged user content, or replacement would be unobservable.
      if (
        Buffer.compare(
          module.bytes,
          Buffer.from("user content at the generated module's path\n", "utf8"),
        ) === 0
      ) {
        fail(
          "T13.4-4: staging premise — the generated module's content must " +
            "differ from the staged user content (SPEC 4: generated modules " +
            "begin with the generated-file header)",
        );
      }

      // Arm 1 — user-created files at derived paths: the first build of the
      // dirty workspace replaces them; the result equals the pristine
      // reference byte-for-byte (occupants of derived paths are not sources,
      // SPEC 13.4).
      await buildOk(
        product,
        dirty,
        "T13.4-4 `build` over user-created files at the derived paths — " +
          "replaced, not an error (SPEC 13.4, 12.1)",
      );
      const sw = await snapshotDirectory(dirty.root);
      assertSnapshotsEqual(
        sr,
        sw,
        "T13.4-4 (user files): the dirty workspace after `build` vs the " +
          "pristine reference — a user-created file at a derived path is " +
          "replaced, and it never enters the build's input (SPEC 13.4, 12.0)",
      );

      // Arm 2 — symbolic links at derived files' own paths: one per derived
      // class, each through the shared link staging (T13.4-11(c)'s), so
      // each resolves to its own plain file outside the workspace root; a
      // product writing through a link modifies its target, a product
      // refusing errors out, and a conforming product replaces the link
      // itself. The links stand at the keys' exact bytes — the graph-data
      // file's name is the product's (SPEC 13.3) — and are read back so.
      const linkKeys = ["specs/A.xspec.ts", "specs/A.md", graphKey] as const;
      const links: OutsideFileLink[] = [];
      for (const [index, key] of linkKeys.entries()) {
        links.push(
          await stageLinkToOutsideFile(
            dirty,
            snapshotKeyBytes(key),
            `T13.4-4-target-${String(index)}.txt`,
          ),
        );
      }
      await buildOk(
        product,
        dirty,
        "T13.4-4 `build` over symbolic links at derived files' own paths — " +
          "the link is an occupant like any other, not an error (SPEC 13.4)",
      );
      for (const key of linkKeys) {
        const kind = await dirty.kind(snapshotKeyBytes(key));
        if (kind !== "file") {
          fail(
            `T13.4-4 (symlink occupants): after \`build\`, ` +
              `${displaySnapshotPath(key)} must be ` +
              `a plain file — the write replaces the link itself (link ` +
              `gone, plain file present; SPEC 13.4); found ${kind}`,
          );
        }
      }
      for (const link of links) {
        await assertOutsideLinkTargetUnchanged(
          link,
          "T13.4-4 (symlink occupants): the link target after `build` — " +
            "nothing is ever written through the link (SPEC 13.4)",
        );
      }
      const sw2 = await snapshotDirectory(dirty.root);
      assertSnapshotsEqual(
        sr,
        sw2,
        "T13.4-4 (symlink occupants): the workspace after `build` vs the " +
          "pristine reference — every derived path holds its generated " +
          "plain file (SPEC 13.4, 12.0)",
      );

      // Arm 3 — a directory at each derived path SPEC pins, holding nothing
      // xspec discovers or generates: empty, and separately each holding a
      // file no group matches. The first `build` replaces each directory
      // with the derived file and exits 0 (13.4: writing a derived file
      // replaces whatever exists at its path; 14.22's refusal reaches only
      // a path that is a directory component of a discovered source's path
      // or of another derived path, T13.4-9); a plain file stands there,
      // the workspace equals the pristine reference — nothing of the
      // directory left — and `check` is clean.
      for (const { staging, workspace } of directoryArms) {
        const tag = `T13.4-4 (${staging.tag})`;
        await buildOk(
          product,
          workspace,
          `${tag}: \`build\` over directories at the derived paths ` +
            `${T13_4_4_DIRECTORY_PATHS.join(" and ")}, holding nothing ` +
            `xspec discovers or generates — each replaced by the derived ` +
            `file, not refused (SPEC 13.4; 14.22 reaches only a directory ` +
            `component of a discovered source's or another derived path)`,
        );
        for (const key of T13_4_4_DIRECTORY_PATHS) {
          const kind = await workspace.kind(key);
          if (kind !== "file") {
            fail(
              `${tag}: after \`build\`, ${key} must be a plain file — the ` +
                `derived file replaces the directory staged there (SPEC ` +
                `13.4: writing a derived file replaces whatever exists at ` +
                `its path); found ${kind}`,
            );
          }
        }
        assertSnapshotsEqual(
          sr,
          await snapshotDirectory(workspace.root),
          `${tag}: the workspace after \`build\` vs the pristine reference ` +
            `— each directory replaced by the derived file, nothing of it ` +
            `left (SPEC 13.4, 12.0)`,
        );
        await expectFindingFreeReport(
          product,
          workspace,
          ["check", "--json"],
          `${tag}: \`check --json\` after the build — clean (SPEC 13.4, ` +
            `14.10)`,
        );
      }
    } finally {
      await reference.dispose();
      await dirty.dispose();
      for (const { workspace } of directoryArms) {
        await workspace.dispose();
      }
    }
  },
});

// ---------------------------------------------------------------------------
// T13.4-5 — durable protection (CONF-CORE in-scope)
// ---------------------------------------------------------------------------

const T13_4_5 = defineProductTest({
  id: "T13.4-5",
  title:
    "`build` and the read commands never modify or delete the journal or session files (byte-compare around each command), and durable files are never regenerated: a deleted session file stays absent — `review` naming it exits 2 unknown session — and a deleted journal stays absent (SPEC 13.4, 6.1, 10.1, 12.0)",
  run: async (product) => {
    await withWorkspace(
      { files: { "xspec.config.ts": SPECS_ONLY_CONFIG, "specs/A.mdx": A_MDX } },
      async (workspace) => {
        // Staging (inside CONF-CORE's scope; see the module header): build,
        // one journaled rename, an audit session, one resolve of an
        // unblocked leaf — the last staging step, so no resolution is stale
        // when the byte-compares below run (§VIOL-CORE-PERSISTREADS).
        await buildOk(product, workspace, "T13.4-5 `build` (SPEC 12.1)");
        await expectExit(
          product,
          workspace,
          ["rename", A_ROOT, "a", "a2"],
          0,
          "T13.4-5 `rename specs/A.mdx a a2` — the journal comes into " +
            "existence with the first journaled operation (SPEC 6.1)",
        );
        await readFileDiagnosed(
          workspace,
          JOURNAL_REL,
          "T13.4-5 the journal after the rename (SPEC 6.1)",
        );
        await expectExit(
          product,
          workspace,
          ["review", "create", "--strategy", "audit", "--name", "s"],
          0,
          "T13.4-5 `review create --strategy audit --name s` (SPEC 10.7)",
        );
        const staged = await sessionStatus(product, workspace, "s", "T13.4-5");
        const gItem = requireRowByScope(
          staged,
          "specs/A.mdx#g",
          "T13.4-5 staging item lookup",
        );
        await expectExit(
          product,
          workspace,
          ["review", "resolve", "s", gItem.id, "--status", "no-change"],
          0,
          "T13.4-5 `review resolve s <leaf item> --status no-change` (SPEC " +
            "10.7)",
        );

        // The durable byte state under protection: the journal plus
        // everything under .xspec/reviews/.
        const durablesBefore = filteredEntries(
          (await snapshotDirectory(workspace.root)).entries,
          (key) => isDurableKey(key),
        );
        const journalEntry = durablesBefore.get(JOURNAL_REL);
        const sessionEntry = durablesBefore.get(sessionRel("s"));
        if (journalEntry?.kind !== "file" || sessionEntry?.kind !== "file") {
          fail(
            "T13.4-5: staging premise — the journal and the session file " +
              "both exist as plain files before the byte-compares (SPEC " +
              "6.1, 10.1)",
          );
        }

        // `build` and every read command: exact exit codes (H-5), and the
        // durable files byte-identical after each command. In this git-less
        // scope `impact --base HEAD` is the exit-2 unreadable-baseline case
        // (SPEC 6.3, 12.0) — even a refused command touches no durable.
        const probes: readonly {
          readonly argv: readonly string[];
          readonly exit: number;
          readonly what: string;
        }[] = [
          { argv: ["build"], exit: 0, what: "`build` (SPEC 12.1)" },
          { argv: ["check"], exit: 0, what: "`check` (SPEC 12.2)" },
          { argv: ["ids", "--json"], exit: 0, what: "`ids --json`" },
          {
            argv: ["show", "specs/A.mdx#a2", "--json"],
            exit: 0,
            what: "`show specs/A.mdx#a2 --json`",
          },
          {
            argv: ["coverage", "--json"],
            exit: 0,
            what: "`coverage --json` (zero configured profiles, SPEC 8.2)",
          },
          { argv: ["query", "nodes"], exit: 0, what: "`query nodes`" },
          {
            argv: ["impact", "--base", "HEAD"],
            exit: 2,
            what:
              "`impact --base HEAD` — no git repository, so the baseline " +
              "cannot be read: a usage error (SPEC 6.3, 12.0)",
          },
          {
            argv: ["review", "list", "--json"],
            exit: 0,
            what: "`review list --json`",
          },
          {
            argv: ["review", "status", "s", "--json"],
            exit: 0,
            what: "`review status s --json`",
          },
          {
            argv: ["review", "next", "s", "--json"],
            exit: 0,
            what: "`review next s --json`",
          },
          {
            argv: ["review", "show", "s", gItem.id],
            exit: 0,
            what: "`review show s <item>`",
          },
          {
            argv: ["review", "export", "s", "--json"],
            exit: 0,
            what: "`review export s --json`",
          },
        ];
        for (const probe of probes) {
          const context = `T13.4-5 ${probe.what}`;
          const result = await runCli(product, workspace, probe.argv);
          assertExitCode(result, probe.exit, context);
          const durablesNow = filteredEntries(
            (await snapshotDirectory(workspace.root)).entries,
            (key) => isDurableKey(key),
          );
          assertSnapshotsEqual(
            asSnapshot(workspace.root, durablesBefore),
            asSnapshot(workspace.root, durablesNow),
            `${context}: the journal and session files after the command — ` +
              `never modified, deleted, or added to by \`build\` or a read ` +
              `command (SPEC 13.4, 6.1, 10.4)`,
          );
        }

        // Durable files are never regenerated. Deleting the session file:
        // xspec does not recreate it, and `review` naming it is exit 2
        // (unknown session, SPEC 10.1/12.0).
        await fsp.rm(workspace.path(sessionRel("s")));
        await expectExit(
          product,
          workspace,
          ["review", "status", "s"],
          2,
          "T13.4-5 `review status s` after deleting the session file — an " +
            "unknown session name in a review command's arguments is a " +
            "usage error (SPEC 10.1, 12.0)",
        );
        await buildOk(
          product,
          workspace,
          "T13.4-5 `build` after deleting the session file (SPEC 12.1)",
        );
        const sessionKind = await workspace.kind(sessionRel("s"));
        if (sessionKind !== "absent") {
          fail(
            "T13.4-5: the deleted session file must stay absent — durable " +
              "files are not reproducible and are never regenerated (SPEC " +
              `13.4); found ${sessionKind} at ${sessionRel("s")}`,
          );
        }
        assertBytesEqual(
          await readFileDiagnosed(
            workspace,
            JOURNAL_REL,
            "T13.4-5 the journal after the session-deletion arm",
          ),
          journalEntry.bytes,
          "T13.4-5: the journal across the session-deletion arm — still " +
            "byte-identical (SPEC 13.4, 6.1)",
        );

        // Deleting the journal: also never regenerated (an absent journal
        // is a valid empty journal, SPEC 6.1).
        await fsp.rm(workspace.path(JOURNAL_REL));
        await buildOk(
          product,
          workspace,
          "T13.4-5 `build` after deleting the journal (SPEC 12.1, 6.1)",
        );
        const journalKind = await workspace.kind(JOURNAL_REL);
        if (journalKind !== "absent") {
          fail(
            "T13.4-5: the deleted journal must stay absent — the journal " +
              "cannot be regenerated from source and comes into existence " +
              "only with a journaled operation (SPEC 13.4, 6.1); found " +
              journalKind,
          );
        }
        await expectExit(
          product,
          workspace,
          ["check"],
          0,
          "T13.4-5 `check` after the deletion arms — the rebuilt, " +
            "sessionless workspace with an empty journal is clean (SPEC " +
            "12.2, 6.1)",
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T13.4-6 — symlink write rules
// ---------------------------------------------------------------------------

// Markdown redirected into `out`, which the fixture stages as a symbolic
// link to a real directory inside the workspace (SPEC 7.3; module header).
// The arms after the first stage it in workspaces created after the body's
// first product invocation: a TypeScript staged-source record
// (helpers/staged-ts.ts; S-9's TypeScript and timing clauses), staged at
// every site.
const OUT_CONFIG = stagedTs(
  "T13.4-6 xspec.config.ts — Markdown emission under outDir out (the occupant and cardinality arms)",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  markdown: { emit: true, outDir: "out" }
})
`,
);

// A second minimal source (the cardinality arms): under OUT_CONFIG it adds
// the emit write path `out/specs/B.md` — or, staged nested, another emit
// path under its own `out/…` directory chain (SPEC 7.3, 13.2). Every staging
// of it — the cardinality arms, T13.4-3's orphan-boundary halves, T13.4-8's
// emission arm, T13.4-11's order-independence arm and its twin — is in a
// workspace created after its body's first invocation (T13.4-3's first half
// aside), or added after an invocation in its own, so it is one
// staged-source record (S-9's before-any-product clause;
// helpers/staged-mdx.ts).
const B_MDX = stagedMdx(
  "T13.4-3/T13.4-6/T13.4-8/T13.4-11 the minimal section b (specs/B.mdx, T13.4-11's order-independence arm and its twin included; T13.4-6's specs/two/B.mdx; T13.4-8's specs/sub/B.mdx)",
  ['<S id="b">', "Beta text.", "</S>", ""].join("\n"),
);

// The non-directory occupant staged at write-path components (SPEC 14.22's
// plain-file kind; content arbitrary — the occupant is never read).
const OCCUPANT = "not a directory\n";

/**
 * Decode a findings report from an exit-1 `--json` run and assert at least
 * one finding carries the given condition; every finding is returned.
 */
function requireCondition(
  findings: readonly Finding[],
  condition: string,
  context: string,
): void {
  if (!findings.some((finding) => finding.condition === condition)) {
    fail(
      `${context}: a condition-${condition} finding must be reported (SPEC ` +
        `14); reported conditions: ` +
        JSON.stringify(findings.map((finding) => finding.condition)),
    );
  }
}

/**
 * Assert a findings report carries exactly one condition-22 finding per
 * staged offending component, each finding's concerned path that component's
 * workspace-relative path (SPEC 14.22: one finding per distinct offending
 * component, whatever write paths it refuses). `components` is given in
 * concerned-path byte order — the pinned 12.7 findings order among
 * equal-code findings whose locations are empty (module header) — so the
 * comparison is per index. The set is exact on both sides: `build` cannot
 * observe 14.10 (SPEC 12.1), and `check`, on a workspace whose `build` is
 * refused — one failing `build`'s validations (SPEC 13.3) — leaves 14.10's
 * mismatch forms unreported and has no record for its whatever-validity
 * forms (SPEC 14.10; module header); `command` picks the failure wording.
 */
function assertObstructionFindings(
  findings: readonly Finding[],
  components: readonly string[],
  command: "build" | "check",
  context: string,
): void {
  const obstructions = findings.filter(
    (finding) => finding.condition === "14.22",
  );
  if (obstructions.length !== components.length) {
    fail(
      `${context}: exactly ${String(components.length)} condition-22 ` +
        `finding(s) — one per distinct offending component, whatever write ` +
        `paths it refuses (SPEC 14.22); reported conditions: ` +
        JSON.stringify(findings.map((finding) => finding.condition)),
    );
  }
  components.forEach((component, index) => {
    assertFindingConcernsPath(
      obstructions[index]!,
      component,
      `${context}: the concerned path is the offending component's ` +
        `workspace-relative path (SPEC 14.22, 13.4)`,
    );
  });
  for (const finding of findings) {
    if (finding.condition === "14.22") continue;
    fail(
      `${context}: beside the staged condition-22 finding(s), ` +
        (command === "check"
          ? `nothing else is reportable: the refused write fails ` +
            `\`build\`'s validations, so 14.10's mismatch forms — the ` +
            `never-generated derived files, the absent graph data — go ` +
            `unreported, and no record exists for its whatever-validity ` +
            `forms (SPEC 14.10, 13.3, 12.2)`
          : `nothing else is stageable (the sources are valid, and ` +
            `\`build\` cannot observe 14.10; SPEC 14.22, 12.1)`) +
        `; got ${JSON.stringify(finding.condition)} (message: ` +
        `${JSON.stringify(finding.message)})`,
    );
  }
}

/**
 * Run `build --json` or `check --json` on a workspace staging non-directory
 * occupants at write-path directory components and assert the SPEC 14.22
 * contract: exit 1; the form-exact findings report carrying exactly the
 * staged obstructions per {@link assertObstructionFindings}; and nothing
 * modified — `build` refuses before anything is modified, `check` reports
 * without writing (SPEC 14.22, 13.4, 12.1, 12.2).
 */
async function expectObstructionReport(
  product: ProductBinding,
  workspace: TestWorkspace,
  command: "build" | "check",
  components: readonly string[],
  what: string,
): Promise<void> {
  const context = `${what} \`${command} --json\``;
  await assertLeavesUnchanged(
    workspace.root,
    async () => {
      const result = await runCli(product, workspace, [command, "--json"]);
      assertExitCode(
        result,
        1,
        `${context}: the obstructed write is a condition-22 finding, never ` +
          `a crash or a success (SPEC 14.22, 12.0)`,
      );
      assertObstructionFindings(
        decodeFindingsReport(parseJsonStdout(result, context), context)
          .findings,
        components,
        command,
        context,
      );
    },
    command === "build"
      ? `${context}: \`build\` refuses before anything is modified — no ` +
          `module, Markdown, or graph data appears and the occupants are ` +
          `untouched (SPEC 14.22, 13.4, 12.1)`
      : `${context}: \`check\` reports without writing (SPEC 14.22, 12.2)`,
  );
}

const T13_4_6 = defineProductTest({
  id: "T13.4-6",
  title:
    "a write path with a symbolic link at a workspace-relative directory component is refused before anything is modified (14.22, exit 1, workspace byte-identical; `check` reports it without writing); a plain file occupying a directory component of a `build` write path — a first emission's `outDir` component, and a deeper component below it, no move operand involved — is refused identically, concerned path that component; one occupant under which two derived files would be written is one finding and two distinct offending components are two, via `check`; a durable path occupied by a symlink or non-plain file is a journal error (14.13) / corrupt session (14.21), never read, appended, or replaced; path components above the workspace root are unrestricted — a root reached through a symlink builds, mutates, and `check`s normally (SPEC 13.4, 14.13, 14.21, 14.22)",
  run: async (product) => {
    // --- Refusal arm: the Markdown emit destination's directory component
    // is a symbolic link (module header: exactly one write path traverses
    // it) ---
    await withWorkspace(
      {
        files: { "xspec.config.ts": OUT_CONFIG, "specs/A.mdx": A_MDX },
        dirs: ["real-out"],
        symlinks: { out: "real-out" },
      },
      async (workspace) => {
        // One write path (out/specs/A.md) traverses the link at `out` — the
        // one offending component, so the finding set is exactly one 14.22
        // concerning `out` on both sides (module header).
        await expectObstructionReport(
          product,
          workspace,
          "build",
          ["out"],
          "T13.4-6 (write-path symlink)",
        );
        await expectObstructionReport(
          product,
          workspace,
          "check",
          ["out"],
          "T13.4-6 (write-path symlink)",
        );
      },
    );

    // --- Occupant kinds, plain file at a first emission's `outDir`
    // component: no build has ever run, no move operand is involved (a
    // plain-file component under a move's destination or its derived paths
    // is the move's `refused-invalid-destination` instead, SPEC 6.5, 14.22;
    // T6.5-4) — refused identically to the symlink kind: `build` exits 1
    // with the condition-22 finding, concerned path that component,
    // modifying nothing, and `check` reports it without writing ---
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": OUT_CONFIG,
          "specs/A.mdx": A_MDX,
          out: OCCUPANT,
        },
      },
      async (workspace) => {
        await expectObstructionReport(
          product,
          workspace,
          "build",
          ["out"],
          "T13.4-6 (outDir plain-file occupant)",
        );
        await expectObstructionReport(
          product,
          workspace,
          "check",
          ["out"],
          "T13.4-6 (outDir plain-file occupant)",
        );
      },
    );

    // --- Occupant kinds, plain file at a deeper directory component of the
    // `build` write path: `out` is a real directory and the occupant sits at
    // `out/specs` — the emit path out/specs/A.md's other workspace-relative
    // component (SPEC 7.3 path preservation) — discriminating a product
    // that vets only the `outDir` component itself (SPEC 14.22, 13.4) ---
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": OUT_CONFIG,
          "specs/A.mdx": A_MDX,
          "out/specs": OCCUPANT,
        },
      },
      async (workspace) => {
        await expectObstructionReport(
          product,
          workspace,
          "build",
          ["out/specs"],
          "T13.4-6 (deeper-component plain-file occupant)",
        );
        await expectObstructionReport(
          product,
          workspace,
          "check",
          ["out/specs"],
          "T13.4-6 (deeper-component plain-file occupant)",
        );
      },
    );

    // --- Finding cardinality, one component refusing two writes: with two
    // sources both emitting under the occupied `out` (out/specs/A.md and
    // out/specs/B.md), the one non-directory occupant yields ONE finding,
    // concerned path that component — never one per refused write (SPEC
    // 14.22); asserted via `check` per TEST-SPEC (module header) ---
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": OUT_CONFIG,
          "specs/A.mdx": A_MDX,
          "specs/B.mdx": B_MDX,
          out: OCCUPANT,
        },
      },
      async (workspace) => {
        await expectObstructionReport(
          product,
          workspace,
          "check",
          ["out"],
          "T13.4-6 (one component, two refused writes)",
        );
      },
    );

    // --- Finding cardinality, two distinct offending components: nested
    // sources emit at out/specs/one/A.md and out/specs/two/B.md (SPEC 7.3);
    // with `out` and `out/specs` real directories and plain files at
    // `out/specs/one` and `out/specs/two`, each refused write has its own
    // offending component — TWO findings, each concerning its component, in
    // concerned-path byte order (SPEC 14.22, 12.7); via `check` ---
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": OUT_CONFIG,
          "specs/one/A.mdx": A_MDX,
          "specs/two/B.mdx": B_MDX,
          "out/specs/one": OCCUPANT,
          "out/specs/two": OCCUPANT,
        },
      },
      async (workspace) => {
        await expectObstructionReport(
          product,
          workspace,
          "check",
          ["out/specs/one", "out/specs/two"],
          "T13.4-6 (two offending components)",
        );
      },
    );

    // --- Durable arm, journal: the journal path occupied by a symbolic
    // link (target: a valid empty journal), then by a directory ---
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          "specs/A.mdx": A_MDX,
          // An empty plain file is a valid empty journal (SPEC 6.1): a
          // product that follows the link sees nothing wrong and proceeds —
          // failing the exit-code or byte-compare below.
          "journal-target": "",
        },
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T13.4-6 (journal occupant) `build` before occupying the journal " +
            "path",
        );
        await workspace.symlink(JOURNAL_REL, "../journal-target");

        const occupantProbe = async (occupant: string): Promise<void> => {
          const renameContext = `T13.4-6 (journal ${occupant}) \`rename specs/A.mdx a a2\``;
          await assertLeavesUnchanged(
            workspace.root,
            async () => {
              await expectExit(
                product,
                workspace,
                ["rename", A_ROOT, "a", "a2"],
                1,
                `${renameContext}: a journal path occupied by anything ` +
                  `other than a plain file is a journal error — the ` +
                  `journaled operation is refused (SPEC 13.4, 14.13, 6.4)`,
              );
            },
            `${renameContext}: the occupied journal is never read, ` +
              `appended to, or replaced, and nothing else is modified — ` +
              `occupant and target byte-identical (SPEC 13.4)`,
          );
          for (const argv of [
            ["build", "--json"],
            ["check", "--json"],
          ] as const) {
            const context = `T13.4-6 (journal ${occupant}) \`${argv.join(" ")}\``;
            await assertLeavesUnchanged(
              workspace.root,
              async () => {
                const result = await runCli(product, workspace, argv);
                assertExitCode(
                  result,
                  1,
                  `${context}: the journal error is a finding (SPEC 14.13, ` +
                    `12.0)`,
                );
                requireCondition(
                  decodeFindingsReport(
                    parseJsonStdout(result, context),
                    context,
                  ).findings,
                  "14.13",
                  context,
                );
              },
              `${context}: reports without modifying anything (SPEC 13.4, ` +
                `12.1, 12.2)`,
            );
          }
        };

        await occupantProbe("symlink");
        await fsp.rm(workspace.path(JOURNAL_REL));
        await workspace.dir(JOURNAL_REL);
        await occupantProbe("directory");
      },
    );

    // --- Durable arm, session: a session path occupied by a symbolic link
    // whose target is the product's own healthy session file beside it ---
    await withWorkspace(
      { files: { "xspec.config.ts": SPECS_ONLY_CONFIG, "specs/A.mdx": A_MDX } },
      async (workspace) => {
        await buildOk(product, workspace, "T13.4-6 (session occupant) `build`");
        await expectExit(
          product,
          workspace,
          ["review", "create", "--strategy", "audit", "--name", "real"],
          0,
          "T13.4-6 (session occupant) `review create --strategy audit " +
            "--name real`",
        );
        const staged = await sessionStatus(
          product,
          workspace,
          "real",
          "T13.4-6 (session occupant)",
        );
        const itemId = requireRowByScope(
          staged,
          "specs/A.mdx#g",
          "T13.4-6 (session occupant) item lookup",
        ).id;
        await workspace.symlink(sessionRel("fake"), "real.json");

        const statusContext = "T13.4-6 (session occupant) `review status fake`";
        await assertLeavesUnchanged(
          workspace.root,
          async () => {
            const result = await runCli(product, workspace, [
              "review",
              "status",
              "fake",
            ]);
            assertExitCode(
              result,
              1,
              `${statusContext}: a session path occupied by a symbolic ` +
                `link is a corrupt session — never read through (a ` +
                `link-follower sees the healthy target session and ` +
                `answers exit 0) (SPEC 13.4, 10.1, 14.21)`,
            );
            assertReportMentions(
              result,
              [/corrupt/i],
              `${statusContext}: the report identifies the session as ` +
                `corrupt (SPEC 10.1/14.21 vocabulary; information ` +
                `presence, never exact wording, H-3)`,
            );
          },
          `${statusContext}: modifies nothing — link and target ` +
            `byte-identical (SPEC 13.4, 10.1)`,
        );

        const resolveContext =
          "T13.4-6 (session occupant) `review resolve fake <item> --status " +
          "no-change`";
        await assertLeavesUnchanged(
          workspace.root,
          async () => {
            await expectExit(
              product,
              workspace,
              ["review", "resolve", "fake", itemId, "--status", "no-change"],
              1,
              `${resolveContext}: the mutating subcommand naming the ` +
                `corrupt session reports and exits 1 (SPEC 10.1, 14.21)`,
            );
          },
          `${resolveContext}: the occupied session path is never appended ` +
            `to or replaced, and nothing is written through the link — the ` +
            `healthy target session included (SPEC 13.4, 10.1)`,
        );

        const checkContext = "T13.4-6 (session occupant) `check --json`";
        await assertLeavesUnchanged(
          workspace.root,
          async () => {
            const result = await runCli(product, workspace, [
              "check",
              "--json",
            ]);
            assertExitCode(
              result,
              1,
              `${checkContext}: the corrupt session is a finding (SPEC ` +
                `12.2, 14.21)`,
            );
            requireCondition(
              decodeFindingsReport(
                parseJsonStdout(result, checkContext),
                checkContext,
              ).findings,
              "14.21",
              checkContext,
            );
          },
          `${checkContext}: \`check\` never writes (SPEC 12.2)`,
        );
      },
    );

    // --- Positive arm: path components above the workspace root are
    // unrestricted — the root reached through a symbolic link builds,
    // mutates, and checks normally ---
    await withWorkspace(
      { files: { "xspec.config.ts": SPECS_ONLY_CONFIG, "specs/A.mdx": A_MDX } },
      async (workspace) => {
        // The link lives beside the real root (outside the workspace) and
        // resolves to it; the product is invoked with the link path as its
        // working directory and as PWD (module header).
        const linkCwd = path.join(workspace.tempRoot, "link-work");
        await fsp.symlink("work", linkCwd, "dir");

        const runViaLink = async (
          argv: readonly string[],
          what: string,
        ): Promise<void> => {
          const result = await runProduct(product, {
            cwd: linkCwd,
            argv,
            env: { PWD: linkCwd },
          });
          assertExitCode(
            result,
            0,
            `T13.4-6 (above-root symlink) ${what}: path components above ` +
              `the workspace root are unrestricted — the command behaves ` +
              `normally (SPEC 13.4)`,
          );
        };

        await runViaLink(["build"], "`build`");
        if ((await workspace.kind("specs/A.xspec.ts")) !== "file") {
          fail(
            "T13.4-6 (above-root symlink): `build` through the linked " +
              "working directory must land the generated module in the " +
              "real workspace root (SPEC 13.4, 13.1)",
          );
        }
        await runViaLink(
          ["rename", A_ROOT, "a", "a2"],
          "`rename specs/A.mdx a a2`",
        );
        if ((await workspace.kind(JOURNAL_REL)) !== "file") {
          fail(
            "T13.4-6 (above-root symlink): the journaled rename through " +
              "the linked working directory must append the journal in the " +
              "real workspace root (SPEC 13.4, 6.1)",
          );
        }
        await runViaLink(["check"], "`check`");
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T13.4-8 — writes create missing directories
// ---------------------------------------------------------------------------

// File-form move arm: the destination `new/deep/b.mdx` lies in a configured
// spec group (SPEC 6.5's not-out-of-the-workspace refusal must not apply)
// while `new/` is absent — nothing stages it and no source lives there, so
// the premise build cannot create it either.
const NEW_GROUP_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx", "new/**/*.mdx"]
  },
  markdown: { emit: true }
})
`;

// Section-form move arm: the created target path `fresh/sub/T.mdx` lies in a
// configured spec group, `fresh/` absent (as above). The arm's workspace
// follows the body's first product invocation: a TypeScript staged-source
// record (helpers/staged-ts.ts; S-9's TypeScript and timing clauses).
const FRESH_GROUP_CONFIG = stagedTs(
  "T13.4-8 section-form move arm xspec.config.ts — spec groups specs/** and fresh/**, Markdown emission on",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx", "fresh/**/*.mdx"]
  },
  markdown: { emit: true }
})
`,
);

// Emission arm: a nested `markdown.outDir` whose whole chain is nonexistent
// (`out/` absent; SPEC 7.3 — resolves within the root, workspace-relative
// paths preserved beneath it). The arm's workspace follows the body's first
// product invocation: a TypeScript staged-source record (S-9).
const NESTED_OUT_CONFIG = stagedTs(
  "T13.4-8 emission arm xspec.config.ts — Markdown emission under the nonexistent nested outDir out/md",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  markdown: { emit: true, outDir: "out/md" }
})
`,
);

// The relocated file: import- and reference-free, so relocation rewrites
// nothing and the moved file is byte-identical at its destination (module
// header; SPEC 6.5). Byte for byte section-12.0-i.ts's minimal section a,
// and the emission arm's workspace staging it follows the file-form move's
// invocations: that staged-source record (S-9's before-any-product clause;
// helpers/staged-mdx.ts), its bytes compared through `.source`.
const RELOCATED_MDX = STREAMS_VALID_SOURCE;

// The section-form origin: `mv` is the moved subtree (kept-ID cross-file
// move, valid per SPEC 6.5), `stay` keeps the origin file non-empty. Its
// workspace follows the file-form move's invocations: a staged-source record.
const MOVED_CONSTRUCT = ['<S id="mv">', "Moved text.", "</S>"].join("\n");
const SECTION_ORIGIN_MDX = stagedMdx(
  "T13.4-8 specs/S.mdx (the section-form move's origin: stay, then the moved mv)",
  ['<S id="stay">', "Stay text.", "</S>", "", MOVED_CONSTRUCT, ""].join("\n"),
);
// The created target file's entire initial content (module header; SPEC 6.5).
const CREATED_TARGET_BYTES = `${MOVED_CONSTRUCT}\n`;

const T13_4_8 = defineProductTest({
  id: "T13.4-8",
  title:
    "a missing intermediate directory never refuses or fails a write — the nonexistent workspace-relative directory components of a written path come into existence as real directories, each case staged with its directories absent beforehand: a file-form move to `new/deep/b.mdx` (destination in a configured spec group, `new/` absent) succeeds with the moved file byte-identical and its regenerated derived files under the fresh directories; a section-form move whose created target file lies under an absent directory succeeds likewise; a first emission under the nested nonexistent `markdown.outDir` writes every destination, creating the chain (SPEC 13.4, 6.5, 7.3, 13.1, 13.2)",
  run: async (product) => {
    // --- File-form move: destination directories `new/deep/` absent ---
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": NEW_GROUP_CONFIG,
          "specs/A.mdx": RELOCATED_MDX,
        },
      },
      async (workspace) => {
        await buildOk(product, workspace, "T13.4-8 (file-form move) `build`");
        await assertKindIs(
          workspace,
          "new",
          "absent",
          "T13.4-8 (file-form move): staging premise — the destination's " +
            "directory components do not exist before the move (TEST-SPEC " +
            "13.4: staged with its directories absent beforehand)",
        );
        await expectExit(
          product,
          workspace,
          ["move", A_ROOT, "new/deep/b.mdx"],
          0,
          "T13.4-8 (file-form move) `move specs/A.mdx new/deep/b.mdx` — a " +
            "missing intermediate directory never refuses or fails a " +
            "write: a nonexistent component is never a refusal cause (SPEC " +
            "13.4, 6.5)",
        );
        for (const dir of ["new", "new/deep"]) {
          await assertKindIs(
            workspace,
            dir,
            "dir",
            "T13.4-8 (file-form move): the fresh destination directory " +
              "components come into existence as real directories (SPEC " +
              "13.4)",
          );
        }
        assertBytesEqual(
          await readFileDiagnosed(
            workspace,
            "new/deep/b.mdx",
            "T13.4-8 (file-form move): the moved file under the fresh " +
              "directories (SPEC 13.4, 6.5)",
          ),
          RELOCATED_MDX.source,
          "T13.4-8 (file-form move): the moved file at its destination — " +
            "import- and reference-free, so relocation changes none of its " +
            "bytes (SPEC 6.5; H-4)",
        );
        await assertKindIs(
          workspace,
          A_ROOT,
          "absent",
          "T13.4-8 (file-form move): the origin path after the relocation " +
            "(SPEC 6.5)",
        );
        await assertKindIs(
          workspace,
          "new/deep/b.xspec.ts",
          "file",
          "T13.4-8 (file-form move): the regenerated module under the " +
            "fresh directories — generated in the source file's directory " +
            "(SPEC 13.4, 13.1, 6.5)",
        );
        await assertKindIs(
          workspace,
          "new/deep/b.md",
          "file",
          "T13.4-8 (file-form move): the re-emitted Markdown under the " +
            "fresh directories — emitted next to the source (SPEC 13.4, " +
            "13.2, 7.3)",
        );
      },
    );

    // --- Section-form move: the created target file (SPEC 6.5) lies under
    // the absent directory `fresh/sub/` ---
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": FRESH_GROUP_CONFIG,
          "specs/S.mdx": SECTION_ORIGIN_MDX,
        },
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T13.4-8 (section-form move) `build`",
        );
        await assertKindIs(
          workspace,
          "fresh",
          "absent",
          "T13.4-8 (section-form move): staging premise — the created " +
            "target file's directory components do not exist before the " +
            "move (TEST-SPEC 13.4)",
        );
        await expectExit(
          product,
          workspace,
          ["move", "specs/S.mdx#mv", "fresh/sub/T.mdx#mv"],
          0,
          "T13.4-8 (section-form move) `move specs/S.mdx#mv " +
            "fresh/sub/T.mdx#mv` — the created target file's missing " +
            "directories never refuse or fail the write (SPEC 13.4, 6.5; " +
            "a cross-file section move keeping its ID is valid)",
        );
        for (const dir of ["fresh", "fresh/sub"]) {
          await assertKindIs(
            workspace,
            dir,
            "dir",
            "T13.4-8 (section-form move): the created target file's fresh " +
              "directory components come into existence as real " +
              "directories (SPEC 13.4)",
          );
        }
        assertBytesEqual(
          await readFileDiagnosed(
            workspace,
            "fresh/sub/T.mdx",
            "T13.4-8 (section-form move): the created target file under " +
              "the fresh directories (SPEC 13.4, 6.5)",
          ),
          CREATED_TARGET_BYTES,
          "T13.4-8 (section-form move): the created target file's entire " +
            "initial content — created empty, the moved construct inserted " +
            "at the start of the new file followed by one U+000A, no " +
            "import additions required (SPEC 6.5; H-4)",
        );
        await assertKindIs(
          workspace,
          "fresh/sub/T.xspec.ts",
          "file",
          "T13.4-8 (section-form move): the created target's regenerated " +
            "module under the fresh directories (SPEC 13.4, 13.1)",
        );
        await assertKindIs(
          workspace,
          "fresh/sub/T.md",
          "file",
          "T13.4-8 (section-form move): the created target's emitted " +
            "Markdown under the fresh directories (SPEC 13.4, 13.2, 7.3)",
        );
      },
    );

    // --- First emission under a nested nonexistent `markdown.outDir`: no
    // build has ever run and the whole `out/md/…` chain is absent; the
    // nested source pins the chain below the outDir too (SPEC 7.3 preserves
    // workspace-relative paths) ---
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": NESTED_OUT_CONFIG,
          "specs/A.mdx": RELOCATED_MDX,
          "specs/sub/B.mdx": B_MDX,
        },
      },
      async (workspace) => {
        await assertKindIs(
          workspace,
          "out",
          "absent",
          "T13.4-8 (first emission): staging premise — the `outDir` chain " +
            "does not exist before the first emission (TEST-SPEC 13.4)",
        );
        await buildOk(
          product,
          workspace,
          "T13.4-8 (first emission) `build` — a first emission under a " +
            "nested nonexistent `markdown.outDir` never refuses or fails " +
            "(SPEC 13.4, 7.3)",
        );
        for (const dir of [
          "out",
          "out/md",
          "out/md/specs",
          "out/md/specs/sub",
        ]) {
          await assertKindIs(
            workspace,
            dir,
            "dir",
            "T13.4-8 (first emission): every directory component of the " +
              "emit destinations comes into existence as a real directory " +
              "— the chain is created (SPEC 13.4, 7.3)",
          );
        }
        for (const destination of [
          "out/md/specs/A.md",
          "out/md/specs/sub/B.md",
        ]) {
          await assertKindIs(
            workspace,
            destination,
            "file",
            "T13.4-8 (first emission): every destination is written under " +
              "the created chain, workspace-relative paths preserved (SPEC " +
              "13.4, 13.2, 7.3)",
          );
        }
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T13.4-9 — derived paths above sources and other derived paths
// ---------------------------------------------------------------------------

// T13.4-9's configurations (module header): one spec group, then a code
// group and Markdown emission where the staging states them. Every
// workspace but the body's first is created after a product invocation —
// the companion legs' after their scratch twins' builds as well — so each
// configuration is a TypeScript staged-source record (helpers/staged-ts.ts;
// S-9's TypeScript and timing clauses), staged at every site.
const RELATION_EMIT_CONFIG = stagedTs(
  "T13.4-9 xspec.config.ts — specs/**/*.mdx, Markdown emitted next to sources ((a))",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  markdown: { emit: true }
})
`,
);
const RELATION_ROOT_OUT_CONFIG = stagedTs(
  'T13.4-9 xspec.config.ts — **/*.mdx, Markdown emitted under outDir "out" ((b) and (f), the sources at the workspace root)',
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["**/*.mdx"]
  },
  markdown: { emit: true, outDir: "out" }
})
`,
);
const RELATION_SPECS_CONFIG = stagedTs(
  "T13.4-9 xspec.config.ts — specs/**/*.mdx alone, no Markdown emission ((c), (e)'s spec-source leg, and that leg's companion twin)",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
);
const RELATION_CODE_CONFIG = stagedTs(
  "T13.4-9 xspec.config.ts — specs/**/*.mdx, a code group globbing specs/**/*.ts, Markdown emitted next to sources ((d), (e)'s code-source leg, and that leg's companion twin)",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: {
    app: ["specs/**/*.ts"]
  },
  markdown: { emit: true }
})
`,
);

// T13.4-9's sources: minimal single-section spec sources — the relation
// reads paths alone, so their content is immaterial — and the code source
// TEST-SPEC states, `export const v = 1` (followed by U+000A, as
// T13.4-11(b)'s and T6.5-20's are), each the only file beneath the
// offending path where (d) and (e) stage it.
const RELATION_UPPER_MDX = stagedMdx(
  "T13.4-9 the upper source — (a)'s and (d)'s specs/a.mdx, (b)'s and (f)'s a.mdx, (c)'s and (e)'s specs/A.mdx (and the companion twins')",
  ['<S id="a">', "Alpha text.", "</S>", ""].join("\n"),
);
const RELATION_BENEATH_MDX = stagedMdx(
  "T13.4-9 the source beneath the offending path — (a)'s specs/a.md/b.mdx, (b)'s and (f)'s a.md/b.mdx, (c)'s specs/A.xspec.ts/B.mdx, (e)'s specs/A.xspec.<suffix>/B.mdx",
  ['<S id="b">', "Beta text.", "</S>", ""].join("\n"),
);
const RELATION_CODE_SOURCE = stagedTs(
  "T13.4-9 the code source beneath the offending path, the only file there — (d)'s specs/a.md/x.ts, (e)'s specs/A.xspec.<suffix>/c.ts — export const v = 1",
  "export const v = 1\n",
);

/** One T13.4-9 staging (module header). */
interface RelationStaging {
  /** The staging's tag in assertion contexts. */
  readonly tag: string;
  readonly config: StagedTs;
  /** The initial files beside the configuration. */
  readonly files: Readonly<Record<string, InitialFileContents>>;
  /**
   * What occupies the offending path once the staging is complete: for the
   * five stagings made before any build, the directory over what lies
   * beneath it, or nothing ((b): no build has emitted anything); for (f),
   * the plain file its premise `build` of `files` emitted.
   */
  readonly occupant: "dir" | "absent" | "built-file";
  /** (f) alone: the sources staged after the premise `build`. */
  readonly added: Readonly<Record<string, StagedMdx>>;
  /** The offending derived path: the one finding's concerned path. */
  readonly offending: string;
}

/** (a) through (d), each staged before any build. */
const RELATION_STAGINGS_A_TO_D: readonly RelationStaging[] = [
  {
    tag: "(a) emission next to sources, specs/a.mdx beside specs/a.md/b.mdx — a.mdx's emit path specs/a.md a directory component of a discovered source's path (and of b.mdx's derived paths)",
    config: RELATION_EMIT_CONFIG,
    files: {
      "specs/a.mdx": RELATION_UPPER_MDX,
      "specs/a.md/b.mdx": RELATION_BENEATH_MDX,
    },
    occupant: "dir",
    added: {},
    offending: "specs/a.md",
  },
  {
    tag: '(b) emission under outDir "out", a.mdx and a.md/b.mdx at the workspace root — the emit path out/a.md a directory component of the emit path out/a.md/b.md',
    config: RELATION_ROOT_OUT_CONFIG,
    files: { "a.mdx": RELATION_UPPER_MDX, "a.md/b.mdx": RELATION_BENEATH_MDX },
    occupant: "absent",
    added: {},
    offending: "out/a.md",
  },
  {
    tag: "(c) specs/A.mdx beside a discovered specs/A.xspec.ts/B.mdx — the module path specs/A.xspec.ts a directory component of a source's path",
    config: RELATION_SPECS_CONFIG,
    files: {
      "specs/A.mdx": RELATION_UPPER_MDX,
      "specs/A.xspec.ts/B.mdx": RELATION_BENEATH_MDX,
    },
    occupant: "dir",
    added: {},
    offending: "specs/A.xspec.ts",
  },
  {
    tag: "(d) emission next to sources, specs/a.mdx beside a discovered code source specs/a.md/x.ts, the only file beneath — the emit path specs/a.md a directory component of that source's path and of no derived path",
    config: RELATION_CODE_CONFIG,
    files: {
      "specs/a.mdx": RELATION_UPPER_MDX,
      "specs/a.md/x.ts": RELATION_CODE_SOURCE,
    },
    occupant: "dir",
    added: {},
    offending: "specs/a.md",
  },
];

/**
 * (e)'s stagings, the companion leg, each staged before any build: per
 * leg, the companion paths a build of `specs/A.mdx` records under that
 * leg's configuration (`readRecordedCompanionPaths`: a scratch twin holding
 * `specs/A.mdx`'s bytes at that path alone, built, its `inventory`
 * `recorded` set read; none for a product writing no companions), one
 * staging per companion path — beside a discovered `<companion>/B.mdx`, as
 * (c) stages the module path, and beside a discovered code source
 * `<companion>/c.ts`, the only file beneath, as (d) stages the emit path.
 */
async function relationCompanionStagings(
  product: ProductBinding,
): Promise<readonly RelationStaging[]> {
  const sourceLeg = await readRecordedCompanionPaths(
    product,
    RELATION_SPECS_CONFIG,
    "specs/A.mdx",
    RELATION_UPPER_MDX,
    "T13.4-9 (e)'s companion paths of specs/A.mdx under (c)'s configuration",
  );
  const codeLeg = await readRecordedCompanionPaths(
    product,
    RELATION_CODE_CONFIG,
    "specs/A.mdx",
    RELATION_UPPER_MDX,
    "T13.4-9 (e)'s companion paths of specs/A.mdx under (d)'s configuration",
  );
  return [
    ...sourceLeg.map((companion): RelationStaging => ({
      tag: `(e) specs/A.mdx beside a discovered ${companion}/B.mdx — the companion path ${companion} a directory component of a source's path and of B.mdx's derived paths`,
      config: RELATION_SPECS_CONFIG,
      files: {
        "specs/A.mdx": RELATION_UPPER_MDX,
        [`${companion}/B.mdx`]: RELATION_BENEATH_MDX,
      },
      occupant: "dir",
      added: {},
      offending: companion,
    })),
    ...codeLeg.map((companion): RelationStaging => ({
      tag: `(e) specs/A.mdx beside a discovered code source ${companion}/c.ts, the only file beneath — the companion path ${companion} a directory component of that source's path`,
      config: RELATION_CODE_CONFIG,
      files: {
        "specs/A.mdx": RELATION_UPPER_MDX,
        [`${companion}/c.ts`]: RELATION_CODE_SOURCE,
      },
      occupant: "dir",
      added: {},
      offending: companion,
    })),
  ];
}

/**
 * (f): (b)'s staging after a `build` of `a.mdx` alone, `a.md/b.mdx` added
 * after it — `out/a.md`, the plain file that build emitted, occupies a
 * directory component of the write path `out/a.md/b.md` (T13.4-6's
 * relation) while being the derived path the relation between derived
 * paths names: one offending component under both (14.22).
 */
const RELATION_STAGING_F: RelationStaging = {
  tag: "(f) (b)'s staging after a build of a.mdx alone, a.md/b.mdx added after it — out/a.md the plain file that build emitted, offending under both relations at one component",
  config: RELATION_ROOT_OUT_CONFIG,
  files: { "a.mdx": RELATION_UPPER_MDX },
  occupant: "built-file",
  added: { "a.md/b.mdx": RELATION_BENEATH_MDX },
  offending: "out/a.md",
};

/** The commands T13.4-9 drives on every staging, in order. */
const RELATION_COMMANDS = ["build", "check", "ids"] as const;
type RelationCommand = (typeof RELATION_COMMANDS)[number];

/** Each command's part in the contract, for the exit-code failure. */
const RELATION_ROLE: Readonly<Record<RelationCommand, string>> = {
  build: "`build` refuses the write and reports it before making any write",
  check: "`check` reports it without writing",
  ids: "the gated read reports it and answers nothing (T13.3-3)",
};

/** Why nothing beside the one finding is reportable, per command. */
const RELATION_EXACTNESS: Readonly<Record<RelationCommand, string>> = {
  build:
    "the workspace otherwise passes `build`'s validations, and `build` " +
    "cannot observe 14.10 (SPEC 12.1)",
  check:
    "on a workspace failing `build`'s validations 14.10's mismatch forms " +
    "go unreported, and neither whatever-validity form is staged — no " +
    "record exists before any build, and (f)'s names `a.mdx`'s derived " +
    "paths, every one still generated (SPEC 14.10, 13.3)",
  ids:
    "the gate is over exactly the findings a `build` would report (SPEC " +
    "13.3)",
};

/** What the whole-root compare around each command pins. */
const RELATION_UNCHANGED: Readonly<Record<RelationCommand, string>> = {
  build:
    "`build` refuses before any write — no module, companion, Markdown, " +
    "or graph data written or removed, the directory and everything " +
    "beneath it untouched (SPEC 14.22, 13.4, 12.1)",
  check: "`check` reports without writing (SPEC 14.22, 12.2)",
  ids: "the gated read modifies nothing (SPEC 13.3)",
};

/**
 * T13.4-9's contract for one command on a completed staging (module
 * header): inside a whole-root compare, exit 1 and the form-exact 12.7
 * findings-only report holding exactly one finding — condition 22
 * concerning the offending derived path, `locations` `[]` — and nothing
 * beside it (SPEC 14.22, 13.4, 13.3, 12.7).
 */
async function expectRelationReport(
  product: ProductBinding,
  workspace: TestWorkspace,
  command: RelationCommand,
  offending: string,
  what: string,
): Promise<void> {
  const context = `${what}: \`${command} --json\``;
  await assertLeavesUnchanged(
    workspace.root,
    async () => {
      const result = await runCli(product, workspace, [command, "--json"]);
      assertExitCode(
        result,
        1,
        `${context} — a derived path above a source or another derived ` +
          `path is a condition-22 finding: ${RELATION_ROLE[command]}, exit ` +
          `1, never a success or a crash (SPEC 14.22, 13.4, 13.3, 12.0)`,
      );
      const findings = decodeFindingsReport(
        parseJsonStdout(result, context),
        `${context} — the form-exact 12.7 findings-only report, answering ` +
          `nothing (SPEC 12.7, 13.3, H-3)`,
      ).findings;
      assertConditionCounts(
        findings,
        { "14.22": 1 },
        `${context} — exactly one condition-22 finding and nothing beside ` +
          `it: one finding per distinct offending path, whatever write ` +
          `paths it refuses and whichever relations it meets (SPEC 14.22); ` +
          RELATION_EXACTNESS[command],
      );
      const finding = findings[0]!;
      assertFindingConcernsPath(
        finding,
        offending,
        `${context} — the finding concerns the offending derived path ` +
          `(SPEC 14.22, 13.4)`,
      );
      if (finding.locations.length !== 0) {
        fail(
          `${context} — the condition-22 finding concerns a path, so its ` +
            `\`locations\` is [] (SPEC 14.22, 12.7); got ` +
            JSON.stringify(
              finding.locations.map((location) => ({
                file: renderPathValue(location.file),
                range: location.range,
              })),
            ),
        );
      }
    },
    `${context} — ${RELATION_UNCHANGED[command]}`,
  );
}

/**
 * Stage one T13.4-9 staging in a fresh workspace (H-1) and drive `build`,
 * `check`, and `ids` on it. A staging made before any build is verified
 * before the first invocation — the offending path holding a directory or
 * nothing, a miss being a harness error; (f)'s premise is re-pinned after
 * its `build` — `out/a.md` the plain file that build emitted, a product
 * writing none there failing diagnosed — before `added` is staged.
 */
async function runRelationStaging(
  product: ProductBinding,
  staging: RelationStaging,
): Promise<void> {
  const context = `T13.4-9 ${staging.tag}`;
  await withWorkspace(
    { files: { "xspec.config.ts": staging.config, ...staging.files } },
    async (workspace) => {
      if (staging.occupant === "built-file") {
        await buildOk(
          product,
          workspace,
          `${context}: the premise \`build\`, before ` +
            `${Object.keys(staging.added).join(", ")} is added — the ` +
            `staged workspace passes \`build\`'s validations, exit 0 (SPEC ` +
            `12.1)`,
        );
        const kind = await workspace.kind(staging.offending);
        if (kind !== "file") {
          fail(
            `${context}: staging premise — after the premise \`build\`, ` +
              `${staging.offending} is the plain file that build emitted ` +
              `(SPEC 7.3, 13.2, 13.4); found ${kind}`,
          );
        }
        for (const [rel, source] of Object.entries(staging.added)) {
          await workspace.file(rel, source);
        }
      } else {
        const kind = await workspace.kind(staging.offending);
        if (kind !== staging.occupant) {
          throw new Error(
            `internal error: ${context} — staged before any build, ` +
              `${staging.offending} must hold ` +
              `${staging.occupant === "dir" ? "a directory" : "nothing"}; ` +
              `found ${kind}`,
          );
        }
      }
      for (const command of RELATION_COMMANDS) {
        await expectRelationReport(
          product,
          workspace,
          command,
          staging.offending,
          context,
        );
      }
    },
  );
}

const T13_4_9 = defineProductTest({
  id: "T13.4-9",
  title:
    "derived paths above sources and other derived paths: a module, companion, or emitted Markdown path that is a directory component of a discovered source's path or of another such path xspec writes, occupied or not, is refused before any write — six stagings, each otherwise passing `build`'s validations, the first five staged before any build: (a) emission next to sources, `specs/a.mdx` beside `specs/a.md/b.mdx`; (b) under `outDir: \"out\"`, `a.mdx` and `a.md/b.mdx` at the workspace root, `out/a.md` above `out/a.md/b.md`; (c) `specs/A.mdx` beside `specs/A.xspec.ts/B.mdx`; (d) `specs/a.mdx` beside a code source `specs/a.md/x.ts`, the only file beneath; (e) per companion path `specs/A.xspec.<suffix>` a build of `specs/A.mdx` records (read from a scratch twin's `inventory`), `specs/A.mdx` beside `<companion>/B.mdx` and, separately, beside a code source `<companion>/c.ts`; (f) (b)'s staging after a `build` of `a.mdx` alone, `out/a.md` then the plain file it emitted — in each, `build` exits 1 with exactly one condition-22 finding concerning the offending derived path (`specs/a.md`, `out/a.md`, `specs/A.xspec.ts`, `specs/a.md`, the companion path, `out/a.md`), `locations` `[]`, writing and removing nothing; `check` reports the same finding without writing; `ids` reports it, exit 1, answering nothing (SPEC 13.4, 14.22, 13.3)",
  run: async (product) => {
    for (const staging of RELATION_STAGINGS_A_TO_D) {
      await runRelationStaging(product, staging);
    }
    for (const staging of await relationCompanionStagings(product)) {
      await runRelationStaging(product, staging);
    }
    await runRelationStaging(product, RELATION_STAGING_F);
  },
});

// ---------------------------------------------------------------------------
// T13.4-10 — rebuild-obstructing orphans
// ---------------------------------------------------------------------------

// T13.4-10's configurations (module header): one spec group globbing
// `specs/*.mdx`, Markdown emitted under `outDir: "out"`, then `outDir`
// reconfigured to "out/specs/A.md". Each arm's reconfiguration is staged
// after its initial `build`, and the unrecorded twin's workspace is created
// after the body's first product invocation, so the configurations and the
// source are staged-source records (helpers/staged-ts.ts,
// helpers/staged-mdx.ts; S-9's TypeScript and timing clauses), staged at
// every site.
const OBSTRUCTION_OUT_CONFIG = stagedTs(
  'T13.4-10 xspec.config.ts — specs/*.mdx, Markdown emitted under outDir "out" (the initial build of the recorded arm and of the unrecorded twin)',
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/*.mdx"]
  },
  markdown: { emit: true, outDir: "out" }
})
`,
);
const OBSTRUCTION_RECONFIGURED_CONFIG = stagedTs(
  'T13.4-10 xspec.config.ts — specs/*.mdx, outDir reconfigured to "out/specs/A.md" (both arms, staged after the initial build)',
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/*.mdx"]
  },
  markdown: { emit: true, outDir: "out/specs/A.md" }
})
`,
);
const OBSTRUCTION_A_MDX = stagedMdx(
  "T13.4-10 specs/A.mdx (the trivial single-section a: the recorded arm and the unrecorded twin)",
  ['<S id="a">', "Alpha text.", "</S>", ""].join("\n"),
);

/** The orphan: the initial build's emit path, no longer generated. */
const OBSTRUCTION_ORPHAN = "out/specs/A.md";
/** The reconfigured emit path, below the orphan (SPEC 7.3, 13.2). */
const OBSTRUCTION_EMIT = "out/specs/A.md/specs/A.md";

/**
 * The recorded-file finding concerning the obstructing orphan instructs its
 * manual deletion, never a rebuild: the rebuild that removes a recorded
 * file no longer generated is the very write the orphan obstructs, refused
 * (SPEC 14.10, 13.4, 14.22; H-3's robust matching, judged by the pure
 * `judgeManualDeletionCorrection` of the human-report adapter, whose S-5
 * vectors drive it apart from any product).
 */
function assertManualDeletionCorrection(
  finding: Finding,
  context: string,
): void {
  const judged = judgeManualDeletionCorrection(
    finding.message,
    OBSTRUCTION_ORPHAN,
  );
  if (judged.verdict === "rebuild-remedy") {
    fail(
      `${context} — the recorded-file finding concerning ` +
        `${OBSTRUCTION_ORPHAN} instructs its manual deletion, never a ` +
        `rebuild: the rebuild is refused while the orphan obstructs its ` +
        `write, so it removes nothing (SPEC 14.10, 13.4, 14.22; H-3's ` +
        `robust matching: no clause presenting a build as what removes the ` +
        `file, ${judged.pattern} matched ${JSON.stringify(judged.clause)}); ` +
        `got ${JSON.stringify(finding.message)}`,
    );
  }
  if (judged.verdict === "absent") {
    fail(
      `${context} — the recorded-file finding concerning ` +
        `${OBSTRUCTION_ORPHAN} instructs the file's manual deletion, a ` +
        `rebuild being refused while it obstructs the write (SPEC 14.10, ` +
        `13.4, 14.22): required information missing from the human report ` +
        `(H-3: information presence, never exact wording) — neither a ` +
        `deletion or removal word beside its manual character nor an ` +
        `instruction to the reader to delete or remove the file; got ` +
        `${JSON.stringify(finding.message)}`,
    );
  }
}

/** One T13.4-10 arm: the recorded orphan, or its unrecorded twin. */
interface ObstructionArm {
  /** Diagnostic tag. */
  readonly tag: string;
  /**
   * Whether the record lists the orphan: graph data as the initial build
   * wrote it, or deleted before the reconfiguration (T13.3-2's operational
   * definition) — the orphan then outside xspec's knowledge (T13.4-3).
   */
  readonly recorded: boolean;
}

const OBSTRUCTION_ARMS: readonly ObstructionArm[] = [
  { tag: "T13.4-10 (the recorded orphan)", recorded: true },
  {
    tag: "T13.4-10 (the unrecorded twin: graph data deleted before the reconfiguration)",
    recorded: false,
  },
];

/**
 * Walk one arm in a fresh workspace (H-1): build under `outDir: "out"`
 * (`out/specs/A.md` premised the plain file that build emitted), delete the
 * graph data in the twin, reconfigure `outDir`, then `build` and `check` —
 * each inside a whole-root compare — delete the orphan by hand, `build`,
 * and `check` again (module header).
 */
async function walkObstructionArm(
  product: ProductBinding,
  arm: ObstructionArm,
): Promise<void> {
  await withWorkspace(
    {
      files: {
        "xspec.config.ts": OBSTRUCTION_OUT_CONFIG,
        "specs/A.mdx": OBSTRUCTION_A_MDX,
      },
    },
    async (workspace) => {
      await buildOk(
        product,
        workspace,
        `${arm.tag} initial \`build\` under outDir "out" (SPEC 12.1)`,
      );
      await assertKindIs(
        workspace,
        OBSTRUCTION_ORPHAN,
        "file",
        `${arm.tag}: staging premise — the initial build emits ` +
          `specs/A.mdx's Markdown at ${OBSTRUCTION_ORPHAN} as a plain file, ` +
          `recording it (SPEC 13.2, 7.3, 13.3)`,
      );
      if (!arm.recorded) {
        await deleteGraphData(
          workspace,
          `${arm.tag}: deleting the graph data before the reconfiguration ` +
            `(T13.3-2's operational definition)`,
        );
      }
      await workspace.file("xspec.config.ts", OBSTRUCTION_RECONFIGURED_CONFIG);

      const buildContext = `${arm.tag} \`build --json\` after the reconfiguration`;
      await assertLeavesUnchanged(
        workspace.root,
        async () => {
          const findings = await runFindingsReport(
            product,
            workspace,
            ["build", "--json"],
            1,
            `${buildContext} — the orphan ${OBSTRUCTION_ORPHAN} occupies a ` +
              `directory component of the emit path ${OBSTRUCTION_EMIT}, ` +
              `obstructing that write: the rebuild is refused, exit 1 (SPEC ` +
              `13.4, 14.22, 12.1, 12.0)`,
          );
          assertConditionCounts(
            findings,
            { "14.22": 1 },
            `${buildContext} — exactly one condition-22 finding and nothing ` +
              `beside it: the workspace otherwise passes \`build\`'s ` +
              `validations, and \`build\` cannot observe 14.10 (SPEC 14.22, ` +
              `12.1)`,
          );
          assertFindingConcernsPath(
            findings[0]!,
            OBSTRUCTION_ORPHAN,
            `${buildContext} — the condition-22 finding concerns the ` +
              `obstructing orphan (SPEC 14.22, 13.4)`,
          );
        },
        `${buildContext} — the rebuild is refused before any write or ` +
          `removal: the orphan, every other derived file, and graph data ` +
          `byte-identical (SPEC 13.4, 14.22, 12.1)`,
      );

      const checkContext = `${arm.tag} \`check --json\` after the refused rebuild`;
      await assertLeavesUnchanged(
        workspace.root,
        async () => {
          const findings = await runFindingsReport(
            product,
            workspace,
            ["check", "--json"],
            1,
            `${checkContext} — \`check\` performs \`build\`'s validations, ` +
              `the refused write among them, and exits 1 on any finding ` +
              `(SPEC 12.2, 14.22, 12.0)`,
          );
          assertConditionCounts(
            findings,
            arm.recorded ? { "14.22": 1, "14.10": 1 } : { "14.22": 1 },
            arm.recorded
              ? `${checkContext} — the condition-22 finding and, beside it, ` +
                  `exactly one condition-10 finding, and nothing else: the ` +
                  `recorded-file form compares the record against the ` +
                  `generated paths on any workspace, while the mismatch ` +
                  `forms are undetectable on a workspace failing \`build\`'s ` +
                  `validations (SPEC 14.10, 14.22, 12.2)`
              : `${checkContext} — the condition-22 finding alone: no ` +
                  `record lists ${OBSTRUCTION_ORPHAN}, so no recorded-file ` +
                  `finding, and the missing graph data is a mismatch form, ` +
                  `undetectable on a workspace failing \`build\`'s ` +
                  `validations (SPEC 14.10, 14.22, 13.4)`,
          );
          assertFindingConcernsPath(
            findings.find((finding) => finding.condition === "14.22")!,
            OBSTRUCTION_ORPHAN,
            `${checkContext} — the condition-22 finding concerns the ` +
              `obstructing orphan (SPEC 14.22, 13.4)`,
          );
          if (arm.recorded) {
            const stale = findings.find(
              (finding) => finding.condition === "14.10",
            )!;
            assertFindingConcernsPath(
              stale,
              OBSTRUCTION_ORPHAN,
              `${checkContext} — the condition-10 finding is the ` +
                `recorded-file form concerning ${OBSTRUCTION_ORPHAN}, a ` +
                `recorded derived file remaining at a path no longer ` +
                `generated, never a mismatch form (SPEC 14.10, 12.7)`,
            );
            assertManualDeletionCorrection(stale, checkContext);
          }
        },
        `${checkContext} — \`check\` reports without writing, so the ` +
          `orphan stays until it is deleted manually (SPEC 13.3, 13.4, 12.2)`,
      );

      await fsp.rm(workspace.path(OBSTRUCTION_ORPHAN));
      await buildOk(
        product,
        workspace,
        `${arm.tag} \`build\` after ${OBSTRUCTION_ORPHAN} is deleted by hand ` +
          `— nothing obstructs the write, exit 0 (SPEC 13.4, 12.1)`,
      );
      await assertKindIs(
        workspace,
        OBSTRUCTION_EMIT,
        "file",
        `${arm.tag}: after the manual deletion, \`build\` writes ` +
          `specs/A.mdx's Markdown at the reconfigured emit path ` +
          `${OBSTRUCTION_EMIT} as a plain file (SPEC 13.2, 7.3, 13.4)`,
      );
      await expectFindingFreeReport(
        product,
        workspace,
        ["check", "--json"],
        `${arm.tag} \`check --json\` after the manual deletion and the ` +
          `\`build\` — clean (SPEC 13.4, 14.10)`,
      );
    },
  );
}

const T13_4_10 = defineProductTest({
  id: "T13.4-10",
  title:
    'rebuild-obstructing orphans: an orphan, recorded or not, occupying a workspace-relative directory component of a path the rebuild writes obstructs that write — `build` with `markdown: { emit: true, outDir: "out" }` emits `specs/A.mdx`\'s Markdown at `out/specs/A.md`, then `outDir` is reconfigured to `"out/specs/A.md"`: `build` exits 1 with exactly one condition-22 finding concerning `out/specs/A.md`, modifying nothing; `check` exits 1 reporting that finding and exactly one condition-10 finding in the recorded-file form concerning `out/specs/A.md` whose correction is the file\'s manual deletion, never a rebuild, and no mismatch form; once the file is deleted by hand, `build` exits 0 writing `out/specs/A.md/specs/A.md` and `check` is clean; the unrecorded twin — graph data deleted before the reconfiguration — obstructs identically, and its `check` reports the condition-22 finding alone (SPEC 13.4, 14.22, 14.10, 12.1, 12.2, 13.5)',
  run: async (product) => {
    for (const arm of OBSTRUCTION_ARMS) {
      await walkObstructionArm(product, arm);
    }
  },
});

// ---------------------------------------------------------------------------
// T13.4-11 — removing recorded paths no longer generated
// ---------------------------------------------------------------------------

// CERTIFICATIONS.md §CONF-ORPHAN's staging constraints: one spec group whose
// glob matches `.mdx` names alone, so no glob reaches a derived path while
// it is one and 13.4's source exclusion stays dormant; `markdown` emitting
// next to sources (under `outDir: "out"` in (d) and (e)), then reconfigured
// — emission disabled under either spelling 7.3 admits, or `outDir`
// changed; the code group arriving only in (b), as emission is disabled.
//
// Every configuration below is staged after the body's first product
// invocation — the later arms' initial ones in workspaces created after it,
// each arm's changed one by `file()` after its build, the
// order-independence arm's in both its workspaces — so S-7's sweep never
// reaches those stagings against the stub (T13.4-11 failing diagnosed
// against a product, its later arms are first reached in certification):
// TypeScript staged-source records (helpers/staged-ts.ts; S-9's TypeScript
// and timing clauses), staged at every site, `OrphanArm` typing its
// configuration fields `StagedTs`.
const ORPHAN_EMIT_CONFIG = stagedTs(
  "T13.4-11 xspec.config.ts — specs/*.mdx, Markdown emission next to sources (arms (a), (b), (c), and (f) build under it)",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/*.mdx"]
  },
  markdown: { emit: true }
})
`,
);

// Emission disabled by `markdown` absent (SPEC 7.3): arms (a) and (c).
const ORPHAN_NO_MARKDOWN_CONFIG = stagedTs(
  "T13.4-11 (a)/(c) xspec.config.ts — emission disabled by markdown absent",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/*.mdx"]
  }
})
`,
);

// Emission disabled by `emit: false` (SPEC 7.3): arm (f).
const ORPHAN_EMIT_FALSE_CONFIG = stagedTs(
  "T13.4-11 (f) xspec.config.ts — emission disabled by emit false",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/*.mdx"]
  },
  markdown: { emit: false }
})
`,
);

// Arm (b): emission disabled as a code group globbing `specs/*.md` is added
// (SPEC 7.2), so the recorded `specs/A.md` is a discovered code source once
// it is no emit destination (7.3, 13.4).
const ORPHAN_CODE_GROUP_CONFIG = stagedTs(
  "T13.4-11 (b) xspec.config.ts — emission disabled as a code group globbing specs/*.md is added",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/*.mdx"]
  },
  code: {
    app: ["specs/*.md"]
  },
  markdown: { emit: false }
})
`,
);

// Arms (d) and (e): built under `outDir: "out"`, recording `out/specs/A.md`,
// then `outDir` changed to `"md"`.
const ORPHAN_OUT_CONFIG = stagedTs(
  "T13.4-11 (d)/(e) xspec.config.ts — Markdown emission under outDir out (the initial build)",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/*.mdx"]
  },
  markdown: { emit: true, outDir: "out" }
})
`,
);
const ORPHAN_MD_CONFIG = stagedTs(
  "T13.4-11 (d)/(e) xspec.config.ts — outDir changed to md",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/*.mdx"]
  },
  markdown: { emit: true, outDir: "md" }
})
`,
);

// The order-independence arm: `specs/**/*.mdx` reaches the nested source
// `specs/B.md/C.mdx` — still `.mdx` names alone.
const ORPHAN_NESTED_CONFIG = stagedTs(
  "T13.4-11 order-independence arm xspec.config.ts — specs/**/*.mdx, Markdown emission next to sources (the arm's workspace and its twin)",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  markdown: { emit: true }
})
`,
);

// Trivial single-section sources (CERTIFICATIONS.md §CONF-ORPHAN: no
// imports, embeddings, comments, or props beyond `id`). Every arm after the
// first stages them in a workspace created after the body's first product
// invocation: staged-source records (S-9's before-any-product clause;
// helpers/staged-mdx.ts). The order-independence arm's `specs/B.mdx` is
// B_MDX, above.
const ORPHAN_A_MDX = stagedMdx(
  "T13.4-11 specs/A.mdx (the trivial single-section a: arms (a) to (f))",
  ['<S id="a">', "Alpha text.", "</S>", ""].join("\n"),
);
const ORPHAN_C_MDX = stagedMdx(
  "T13.4-11 specs/B.md/C.mdx (the trivial single-section c: the order-independence arm's first build)",
  ['<S id="c">', "Gamma text.", "</S>", ""].join("\n"),
);

// Arm (b)'s well-formed TypeScript, overwriting the emitted `specs/A.md` after
// the body's first product invocation: a TypeScript staged-source record
// (S-9) — a discovered code source whose name the default does not reach
// (the code group globs `specs/*.md`), declared well-formed by the record,
// which makes the path judged.
const ORPHAN_CODE_SOURCE = stagedTs(
  "T13.4-11 (b) specs/A.md — a discovered code source (export const n = 1) over the emitted Markdown",
  "export const n = 1\n",
);
// Arm (a)'s file inside the directory replacing `specs/A.md` — no glob
// matches it.
const ORPHAN_DIR_FILE_REL = "specs/A.md/kept.txt";
const ORPHAN_DIR_FILE_BYTES = "a file inside a directory at a recorded path\n";
// Arm (e)'s foreign plain file `A.md` in the directory the link targets.
const ORPHAN_FOREIGN_BYTES =
  "a foreign plain file no build wrote: nothing reads or removes it\n";

/**
 * `check --json` where T13.4-11 leaves the accompanying findings unasserted
 * — the graph-data unit form, unpinned (13.3, 14.10), and in (d) and (e)
 * the per-file form of the fresh emit destination `md/specs/A.md`: exit 0
 * with the finding-free report or exit 1 with at least one finding (SPEC
 * 12.2, 12.0: `check` exits 1 on any finding), the report decoded
 * form-exact either way (H-3). Returns the findings.
 */
async function orphanCheckFindings(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
): Promise<readonly Finding[]> {
  const result = await runCli(product, workspace, ["check", "--json"]);
  if (
    result.signal !== null ||
    (result.exitCode !== 0 && result.exitCode !== 1)
  ) {
    fail(
      `${context}: \`check\` on a workspace passing \`build\`'s validations ` +
        `exits 0 when clean and 1 on any finding — never another code ` +
        `(SPEC 12.2, 12.0); got ${summarizeResult(result)}`,
    );
  }
  const findings = decodeFindingsReport(
    parseJsonStdout(result, context),
    context,
  ).findings;
  if ((result.exitCode === 0) !== (findings.length === 0)) {
    fail(
      `${context}: \`check\` exits 1 exactly when it reports a finding ` +
        `(SPEC 12.2, 12.0); got exit ${String(result.exitCode)} with ` +
        `${String(findings.length)} finding(s)`,
    );
  }
  return findings;
}

/** The condition-10 findings concerning one workspace-relative path. */
function staleFindingsConcerning(
  findings: readonly Finding[],
  rel: string,
): Finding[] {
  return findings.filter((finding) => {
    return finding.condition === "14.10" && finding.path === rel;
  });
}

/**
 * One of T13.4-11's arms (a)–(f): the build it starts from, the recorded
 * path its change leaves no longer generated, the change itself, and what
 * the first `check` reports concerning that path.
 */
interface OrphanArm {
  /** Diagnostic tag, e.g. "T13.4-11 (a) a directory". */
  readonly tag: string;
  /** The configuration of the initial build (a staged-source record). */
  readonly builtConfig: StagedTs;
  /** The recorded derived path the change leaves no longer generated. */
  readonly recordedRel: string;
  /** The configuration the change installs (a staged-source record). */
  readonly changedConfig: StagedTs;
  /**
   * Stage the change's occupant — before the configuration change is
   * written, before the first `check` — capturing what the arm compares,
   * and return the judgment of the occupant after `build`.
   */
  readonly stage: (
    workspace: TestWorkspace,
  ) => Promise<(context: string) => Promise<void>>;
  /** The first `check`: the recorded-file finding (c), or no finding. */
  readonly firstCheck: "recorded-file-finding" | "no-finding";
  /** What the first `check`'s expectation rests on (diagnostics). */
  readonly why: string;
}

/**
 * Walk one arm: build (the recorded path premised a plain file — emitted
 * Markdown, SPEC 13.2, 7.3), stage the change, then `check`, `build`, and
 * `check` again — the first `check` judged concerning the recorded path,
 * `build` exiting 0 (so no 14.22, exit 1, and no 14.24, exit 2: SPEC 12.0),
 * the occupant judged after it, and the last `check` clean.
 */
async function walkOrphanArm(
  product: ProductBinding,
  arm: OrphanArm,
): Promise<void> {
  await withWorkspace(
    {
      files: {
        "xspec.config.ts": arm.builtConfig,
        "specs/A.mdx": ORPHAN_A_MDX,
      },
    },
    async (workspace) => {
      await buildOk(product, workspace, `${arm.tag} initial \`build\``);
      await assertKindIs(
        workspace,
        arm.recordedRel,
        "file",
        `${arm.tag}: staging premise — the initial build emits specs/A.mdx's ` +
          `Markdown at ${arm.recordedRel} as a plain file, recording it ` +
          `(SPEC 13.2, 7.3, 13.3)`,
      );
      const judgeAfterBuild = await arm.stage(workspace);
      await workspace.file("xspec.config.ts", arm.changedConfig);

      const firstContext = `${arm.tag} first \`check --json\``;
      if (arm.firstCheck === "recorded-file-finding") {
        const findings = await runFindingsReport(
          product,
          workspace,
          ["check", "--json"],
          1,
          `${firstContext} — ${arm.why}`,
        );
        const concerning = staleFindingsConcerning(findings, arm.recordedRel);
        if (concerning.length !== 1) {
          fail(
            `${firstContext}: exactly one condition-10 finding in the ` +
              `recorded-file form concerning ${arm.recordedRel} — ${arm.why} ` +
              `(SPEC 14.10: one finding per such path, its derived path the ` +
              `finding's path, 12.7); got ${String(concerning.length)} among ` +
              JSON.stringify(
                findings.map((finding) => ({
                  code: finding.code,
                  path: finding.path,
                })),
              ),
          );
        }
      } else {
        const findings = await orphanCheckFindings(
          product,
          workspace,
          firstContext,
        );
        const concerning = staleFindingsConcerning(findings, arm.recordedRel);
        if (concerning.length > 0) {
          fail(
            `${firstContext}: no condition-10 finding concerns ` +
              `${arm.recordedRel} — ${arm.why} (SPEC 13.4, 14.10: the ` +
              `recorded-file form reports exactly the occupants the removal ` +
              `would remove); got ` +
              JSON.stringify(concerning.map((finding) => finding.message)),
          );
        }
      }

      await buildOk(
        product,
        workspace,
        `${arm.tag} \`build\` — the removal of the recorded path no longer ` +
          `generated succeeds, no 14.22 (exit 1) and no 14.24 (exit 2) ` +
          `(SPEC 13.4, 12.1, 12.0)`,
      );
      await judgeAfterBuild(`${arm.tag} after \`build\``);
      await expectFindingFreeReport(
        product,
        workspace,
        ["check", "--json"],
        `${arm.tag} last \`check --json\` — clean: the rebuilt record no ` +
          `longer lists the path (SPEC 13.3, 13.4, 14.10)`,
      );
    },
  );
}

/**
 * A directory's byte state after the product ran: still a real directory,
 * entry for entry byte-identical to the snapshot taken once the staging was
 * complete (H-4) — checked as a directory first, so a removed or replaced
 * directory is a diagnosed failure rather than a snapshot error.
 */
async function assertDirectoryUnchanged(
  before: DirectorySnapshot,
  what: string,
  context: string,
): Promise<void> {
  let kind: "dir" | "absent" | "other";
  try {
    const stats = await fsp.lstat(before.root);
    kind = stats.isDirectory() ? "dir" : "other";
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    kind = "absent";
  }
  if (kind !== "dir") {
    fail(
      `${context}: ${what} must still be a directory, byte-identical with ` +
        `its content (SPEC 13.4); found ${kind === "other" ? "a non-directory" : "nothing"} at ${before.root}`,
    );
  }
  assertSnapshotsEqual(
    before,
    await snapshotDirectory(before.root),
    `${context}: ${what} and its content byte-identical (SPEC 13.4)`,
  );
}

/** Arm (a): a directory holding a file at the recorded path. */
const ORPHAN_ARM_DIRECTORY: OrphanArm = {
  tag: "T13.4-11 (a) a directory",
  builtConfig: ORPHAN_EMIT_CONFIG,
  recordedRel: "specs/A.md",
  changedConfig: ORPHAN_NO_MARKDOWN_CONFIG,
  stage: async (workspace) => {
    await fsp.rm(workspace.path("specs/A.md"));
    await workspace.file(ORPHAN_DIR_FILE_REL, ORPHAN_DIR_FILE_BYTES);
    const before = await snapshotDirectory(workspace.path("specs/A.md"));
    return async (context) => {
      await assertDirectoryUnchanged(
        before,
        "the directory at the recorded specs/A.md — a path holding a " +
          "directory is left as it is, the removal making no write",
        context,
      );
    };
  },
  firstCheck: "no-finding",
  why:
    "the recorded path holds a directory, which the removal leaves as it " +
    "is (whether the graph-data unit form accompanies it is unasserted)",
};

/** Arm (b): a discovered code source at the recorded path. */
const ORPHAN_ARM_SOURCE: OrphanArm = {
  tag: "T13.4-11 (b) a discovered source",
  builtConfig: ORPHAN_EMIT_CONFIG,
  recordedRel: "specs/A.md",
  changedConfig: ORPHAN_CODE_GROUP_CONFIG,
  stage: async (workspace) => {
    // S-9: a discovered code source whose name the default does not reach
    // (the code group globs `specs/*.md`), declared well-formed by its
    // record.
    await workspace.file("specs/A.md", ORPHAN_CODE_SOURCE);
    return async (context) => {
      assertBytesEqual(
        await readFileDiagnosed(
          workspace,
          "specs/A.md",
          `${context}: the discovered code source at the recorded ` +
            `specs/A.md is left in place — a source is never derived`,
        ),
        ORPHAN_CODE_SOURCE.source,
        `${context}: the discovered code source at the recorded specs/A.md ` +
          `byte-identical — a source is never derived (SPEC 13.4)`,
      );
    };
  },
  firstCheck: "no-finding",
  why:
    "once no emit destination, the recorded path is a discovered code " +
    "source, which the removal leaves in place (SPEC 7.2, 7.3)",
};

/** Arm (c): a symbolic link to a file outside the workspace. */
const ORPHAN_ARM_LINK: OrphanArm = {
  tag: "T13.4-11 (c) a symbolic link",
  builtConfig: ORPHAN_EMIT_CONFIG,
  recordedRel: "specs/A.md",
  changedConfig: ORPHAN_NO_MARKDOWN_CONFIG,
  stage: async (workspace) => {
    const link = await stageLinkToOutsideFile(
      workspace,
      Buffer.from("specs/A.md", "utf8"),
      "T13.4-11-c-target.md",
    );
    return async (context) => {
      await assertKindIs(
        workspace,
        "specs/A.md",
        "absent",
        `${context}: the recorded specs/A.md held a symbolic link, which ` +
          `the removal removes as the link itself, never its target, and ` +
          `with emission disabled nothing is written there (SPEC 13.4, 7.3)`,
      );
      await assertOutsideLinkTargetUnchanged(link, context);
    };
  },
  firstCheck: "recorded-file-finding",
  why:
    "a symbolic link at the recorded path is an occupant the removal " +
    "removes, judged as itself",
};

/** Arm (d): the recorded path below a plain-file component. */
const ORPHAN_ARM_PLAIN_COMPONENT: OrphanArm = {
  tag: "T13.4-11 (d) nothing to remove",
  builtConfig: ORPHAN_OUT_CONFIG,
  recordedRel: "out/specs/A.md",
  changedConfig: ORPHAN_MD_CONFIG,
  stage: async (workspace) => {
    await fsp.rm(workspace.path("out/specs"), { recursive: true });
    await workspace.file("out/specs", OCCUPANT);
    return async (context) => {
      assertBytesEqual(
        await readFileDiagnosed(
          workspace,
          "out/specs",
          `${context}: the plain file at out/specs, above the recorded ` +
            `out/specs/A.md, is left as it is`,
        ),
        OCCUPANT,
        `${context}: out/specs byte-identical — the recorded path below it ` +
          `holds nothing, and its removal makes no write (SPEC 13.4)`,
      );
    };
  },
  firstCheck: "no-finding",
  why:
    "the recorded path lies below a non-directory component and holds " +
    "nothing — nothing is read there",
};

/**
 * Arm (e): the recorded path below a symbolic link to a real directory
 * holding a foreign plain file `A.md` — staged inside the workspace, under
 * no group's globs, and outside the workspace root.
 */
function orphanArmLinkComponent(where: "inside" | "outside"): OrphanArm {
  return {
    tag: `T13.4-11 (e) nothing to remove below a symbolic link (its target ${where} the workspace root)`,
    builtConfig: ORPHAN_OUT_CONFIG,
    recordedRel: "out/specs/A.md",
    changedConfig: ORPHAN_MD_CONFIG,
    stage: async (workspace) => {
      await fsp.rm(workspace.path("out/specs"), { recursive: true });
      const targetAbs =
        where === "inside"
          ? workspace.path("foreign")
          : path.join(workspace.tempRoot, "foreign");
      await fsp.mkdir(targetAbs, { recursive: true });
      await fsp.writeFile(path.join(targetAbs, "A.md"), ORPHAN_FOREIGN_BYTES);
      const linkAbs = workspace.path("out/specs");
      const linkTarget = path.relative(path.dirname(linkAbs), targetAbs);
      await workspace.symlink("out/specs", linkTarget, "dir");
      if ((await workspace.kind("out/specs")) !== "symlink") {
        throw new Error(
          "internal error: failed to stage a symbolic link at out/specs",
        );
      }
      const [resolved, expected] = await Promise.all([
        fsp.realpath(linkAbs),
        fsp.realpath(targetAbs),
      ]);
      if (resolved !== expected) {
        throw new Error(
          `internal error: the symbolic link staged at out/specs resolves ` +
            `to ${resolved}, not to its target directory ${expected}`,
        );
      }
      const before = await snapshotDirectory(targetAbs);
      return async (context) => {
        const kind = await workspace.kind("out/specs");
        if (kind !== "symlink") {
          fail(
            `${context}: the symbolic link at out/specs — a directory ` +
              `component of the recorded out/specs/A.md — is left as it is ` +
              `(SPEC 13.4); found ${kind}`,
          );
        }
        const stored = await workspace.linkTarget("out/specs");
        if (stored !== linkTarget) {
          fail(
            `${context}: the symbolic link at out/specs byte-identical — ` +
              `its stored target ${JSON.stringify(linkTarget)} (SPEC 13.4); ` +
              `got ${JSON.stringify(stored)}`,
          );
        }
        await assertDirectoryUnchanged(
          before,
          `the link's target directory (${where} the workspace root), ` +
            `holding the foreign A.md — nothing below a symbolic-link ` +
            `component is read or removed, whatever the link targets`,
          context,
        );
      };
    },
    firstCheck: "no-finding",
    why:
      "the recorded path lies below a component a symbolic link occupies, " +
      "where nothing is read whatever the link targets",
  };
}

/** Arm (f): no occupant at the recorded path. */
const ORPHAN_ARM_NO_OCCUPANT: OrphanArm = {
  tag: "T13.4-11 (f) no occupant",
  builtConfig: ORPHAN_EMIT_CONFIG,
  recordedRel: "specs/A.md",
  changedConfig: ORPHAN_EMIT_FALSE_CONFIG,
  stage: async (workspace) => {
    await fsp.rm(workspace.path("specs/A.md"));
    return async (context) => {
      await assertKindIs(
        workspace,
        "specs/A.md",
        "absent",
        `${context}: the recorded specs/A.md held nothing, and with ` +
          `emission disabled nothing is written there (SPEC 13.4, 7.3)`,
      );
    };
  },
  firstCheck: "no-finding",
  why:
    "the recorded path holds nothing (whether the graph-data unit form " +
    "accompanies it is unasserted)",
};

/**
 * The order-independence arm (SPEC 13.4: a completed regeneration's outcome
 * does not depend on the order of its writes and removals): `build` with
 * `specs/B.md/C.mdx`, recording `specs/B.md/C.md` and `C.mdx`'s module and
 * companions; then `C.mdx` deleted and `specs/B.mdx` added, whose emit path
 * `specs/B.md` is the directory holding those recorded orphans. `build`
 * exits 0, and the workspace is exactly the regenerated one — its files
 * compared with a twin holding the same sources and configuration, freshly
 * built (H-6's two-directory protocol; CERTIFICATIONS.md §CONF-ORPHAN's
 * staging constraint: never `inventory`) — `check` clean.
 */
async function walkOrphanOrderIndependence(
  product: ProductBinding,
): Promise<void> {
  const tag = "T13.4-11 (order independence)";
  await withWorkspace(
    {
      files: {
        "xspec.config.ts": ORPHAN_NESTED_CONFIG,
        "specs/B.md/C.mdx": ORPHAN_C_MDX,
      },
    },
    async (workspace) => {
      await buildOk(product, workspace, `${tag} initial \`build\``);
      for (const rel of ["specs/B.md/C.md", "specs/B.md/C.xspec.ts"]) {
        await assertKindIs(
          workspace,
          rel,
          "file",
          `${tag}: staging premise — the initial build writes C.mdx's ` +
            `emitted Markdown and module under specs/B.md/, recording them ` +
            `(SPEC 13.1, 13.2, 13.3)`,
        );
      }
      await fsp.rm(workspace.path("specs/B.md/C.mdx"));
      await workspace.file("specs/B.mdx", B_MDX);
      await buildOk(
        product,
        workspace,
        `${tag} \`build\` — the write replacing the directory specs/B.md, ` +
          `each recorded orphan's removal finding nothing below the replaced ` +
          `path or removing its file first alike; no 14.24, and no 14.22 on ` +
          `a removal (SPEC 13.4, 12.1)`,
      );
      await assertKindIs(
        workspace,
        "specs/B.md",
        "file",
        `${tag}: specs/B.md is a plain file holding B.mdx's Markdown and ` +
          `nothing under it (SPEC 13.4, 13.2)`,
      );
      await withWorkspace(
        {
          files: {
            "xspec.config.ts": ORPHAN_NESTED_CONFIG,
            "specs/B.mdx": B_MDX,
          },
        },
        async (twin) => {
          await buildOk(product, twin, `${tag} the twin's \`build\``);
          await assertDirectoriesEqual(
            workspace.root,
            twin.root,
            `${tag}: the workspace after \`build\` vs a twin holding the ` +
              `same sources and configuration, freshly built — exactly the ` +
              `regenerated one (SPEC 13.4, 12.1, 12.0; H-6)`,
          );
        },
      );
      await expectFindingFreeReport(
        product,
        workspace,
        ["check", "--json"],
        `${tag} \`check --json\` after the build — clean (SPEC 13.4, 14.10)`,
      );
    },
  );
}

const T13_4_11 = defineProductTest({
  id: "T13.4-11",
  title:
    'removing recorded paths no longer generated: 13.4 removes a recorded derived path\'s occupant only where it is neither a directory nor a discovered source — a symbolic link as the link itself — leaving a directory, a discovered source, or nothing as it is, making no write, and 14.10\'s recorded-file form reports exactly what that removal would remove; each arm builds with emission next to sources (under `outDir: "out"` in (d) and (e)), stages its change, then runs `check`, `build`, `check`: (a) a directory holding a file, emission disabled — no condition-10 finding concerning `specs/A.md`, the directory byte-identical; (b) a discovered code source `export const n = 1` under a code group globbing `specs/*.md`, emission disabled — no finding, the file byte-identical; (c) a symbolic link to a file outside the workspace, emission disabled — the recorded-file finding, `build` removing the link itself, its target byte-identical; (d) `out/specs` a plain file and `outDir` changed to `"md"` — no finding, `build` exits 0, `out/specs` byte-identical; (e) `out/specs` a symbolic link to a directory holding a foreign `A.md`, inside the workspace and outside its root — no finding, `build` exits 0, link, directory, and `A.md` byte-identical; (f) `specs/A.md` deleted, emission disabled — no finding, `build` exits 0, nothing there; every last `check` clean; and order independence — `specs/B.mdx` added as the orphaned `specs/B.md/C.mdx` is deleted, its emit path the directory holding the recorded orphans: `build` exits 0, the workspace equal to a freshly built twin, `check` clean (SPEC 13.4, 14.10, 12.1, 12.2)',
  run: async (product) => {
    await walkOrphanArm(product, ORPHAN_ARM_DIRECTORY);
    await walkOrphanArm(product, ORPHAN_ARM_SOURCE);
    await walkOrphanArm(product, ORPHAN_ARM_LINK);
    await walkOrphanArm(product, ORPHAN_ARM_PLAIN_COMPONENT);
    await walkOrphanArm(product, orphanArmLinkComponent("inside"));
    await walkOrphanArm(product, orphanArmLinkComponent("outside"));
    await walkOrphanArm(product, ORPHAN_ARM_NO_OCCUPANT);
    await walkOrphanOrderIndependence(product);
  },
});

/** TEST-SPEC §13.4, in canonical ID order (SUITE-47). */
export const section134Tests: readonly ProductTestEntry[] = [
  T13_4_1,
  T13_4_2,
  T13_4_3,
  T13_4_4,
  T13_4_5,
  T13_4_6,
  T13_4_8,
  T13_4_9,
  T13_4_10,
  T13_4_11,
];
