// The workspace write layer — every product file write goes through here
// (IMPLEMENTATION Architecture: derived-file writes are atomic — temp file +
// rename in the same directory; the workspace layer owns all I/O).
//
// SPEC 13.5: file writes are atomic in their observable effect — at every
// moment, concurrent readers and interrupted commands included, a path xspec
// writes holds either its prior state (the previous content, or absence) or
// the complete new content, never a partial write. Temp-file-plus-rename in
// the target's own directory gives exactly that: the temp file carries the
// complete bytes before the rename, and the rename replaces the target in
// one atomic step.
//
// SPEC 13.4: every file xspec writes is a plain file suitable for
// committing (temp + rename only ever creates regular files; stable
// ordering and sorted keys are the canonical serializer's, core/
// canonical-json.ts). Derived-file paths belong to xspec: writing a derived
// file replaces whatever occupies its path — a symbolic link included,
// which is replaced as itself and never written through. A durable file's
// path occupied by anything other than a plain file is never read, appended
// to, or replaced: the read side reports it (journal → 14.13, session →
// 14.21), and the write primitives here refuse it as a terminal defense.
//
// SPEC 13.4 → 14.22: a write path having a workspace-relative directory
// component occupied by anything other than a directory — a plain file, a
// symbolic link (whatever it targets: writes never traverse one), or any
// other non-directory occupant — is refused, reported before anything is
// modified; `check` reports it without writing. One finding per distinct
// offending component, concerned path the component's workspace-relative
// path, however many write paths it refuses.
// `obstructedWritePathFindings` is that report's producer — callers (build,
// and every command that writes) run it over their complete write set
// before touching the workspace, and the write primitives re-check as a
// terminal defense. Path components above the workspace root are
// unrestricted (SPEC 13.4).
//
// SPEC 13.4's read side shares the occupant classification: reads traverse
// no non-directory component either, and `readableDirectory` is the one
// judge of whether a read may list a workspace directory at all —
// `readableOccupant`, over it, of what a read finds at a file's path.
//
// SPEC 14.24: a write the environment refuses — a file's creation,
// replacement, append, relocation, or removal — stops the command making
// it. Every write primitive here runs its filesystem mutations through
// `performWrite`, which turns any failure the filesystem reports into the
// typed write failure (./environment-refusal.ts) concerning the file the
// write would have produced or removed, or the graph-data area for graph
// data; thrown at the write, it leaves every earlier write complete and
// attempts no later one (SPEC 13.5), and the CLI reports it as the exit-2
// usage error (SPEC 12.0, 12.7).

import { Buffer } from "node:buffer";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import * as process from "node:process";
import { compareBytes } from "../core/bytes.js";
import type { SourceWrite } from "../core/edits.js";
import type { Finding } from "../core/findings.js";
import { pathFinding } from "../core/findings.js";
import type { RefusedWrite } from "./environment-refusal.js";
import { isFilesystemFailure, writeFailure } from "./environment-refusal.js";

/**
 * What occupies a filesystem path, judged by `lstat` — a symbolic link is
 * always judged itself, never through its target (SPEC 13.4).
 */
export type PathOccupant =
  "absent" | "file" | "directory" | "symlink" | "other";

/**
 * Classify the occupant of an absolute path (SPEC 13.4). A path unreachable
 * through a non-directory or looping component classifies as "absent" —
 * nothing occupies the path itself; the offending component is judged and
 * reported separately (SPEC 14.22, `obstructedWritePathFindings`; SPEC 6.5,
 * `nonDirectoryComponents`) — never a crash on the classifying read.
 */
export async function classifyOccupant(
  absolute: string,
): Promise<PathOccupant> {
  let stats;
  try {
    stats = await fsp.lstat(absolute);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR" || code === "ELOOP") {
      return "absent";
    }
    throw error;
  }
  if (stats.isSymbolicLink()) return "symlink";
  if (stats.isFile()) return "file";
  if (stats.isDirectory()) return "directory";
  return "other";
}

/**
 * Classify the occupant of a workspace-relative path — the `rename`/`move`
 * destination probes' entry (SPEC 6.5, core/refusal.ts). A path unreachable
 * through a non-directory or looping component classifies as "absent" like
 * every classification; the offending component reports separately through
 * `nonDirectoryComponents` (SPEC 6.5: `refused-invalid-destination`).
 */
export async function probeOccupant(
  root: string,
  rel: string,
): Promise<PathOccupant> {
  return classifyOccupant(absoluteOf(root, rel));
}

/**
 * SPEC 6.5: the workspace-relative directory components of `rels` occupied
 * by anything other than a directory — a plain file, a symbolic link
 * (whatever it targets: writes never traverse one, SPEC 13.4), or any
 * other non-directory occupant. Distinct components, probed once each, in
 * byte order; nonexistent components are never listed (writes create
 * those, SPEC 13.4). The `refused-invalid-destination` evaluation
 * (core/refusal.ts) consumes this for the destination path and the
 * derived paths it would generate.
 */
export async function nonDirectoryComponents(
  root: string,
  rels: readonly string[],
): Promise<string[]> {
  const components = new Set<string>();
  for (const rel of rels) {
    for (const component of directoryComponents(rel)) {
      components.add(component);
    }
  }
  const obstructed: string[] = [];
  for (const component of [...components].sort(compareBytes)) {
    const occupant = await probeOccupant(root, component);
    if (occupant !== "absent" && occupant !== "directory") {
      obstructed.push(component);
    }
  }
  return obstructed;
}

/** Human words for an occupant kind, for diagnostics. */
export function describeOccupant(occupant: PathOccupant): string {
  switch (occupant) {
    case "absent":
      return "nothing";
    case "file":
      return "a plain file";
    case "directory":
      return "a directory";
    case "symlink":
      return "a symbolic link";
    case "other":
      return "a non-plain file";
  }
}

/** The absolute filesystem path of a `/`-separated workspace-relative path. */
function absoluteOf(root: string, rel: string): string {
  return path.join(root, ...rel.split("/"));
}

/**
 * The proper workspace-relative directory components of `rel`, shallowest
 * first: for `out/specs/A.md`, `["out", "out/specs"]`. The leaf itself is
 * not a directory component — a symbolic link there is an occupant, not a
 * traversal (SPEC 13.4, 14.22).
 */
function directoryComponents(rel: string): string[] {
  const segments = rel.split("/");
  const components: string[] = [];
  for (let i = 1; i < segments.length; i += 1) {
    components.push(segments.slice(0, i).join("/"));
  }
  return components;
}

/** An offending directory component and what occupies it (SPEC 14.22). */
export interface ObstructedComponent {
  /** The component's workspace-relative path — the concerned path. */
  readonly component: string;
  /** Its non-directory occupant, judged by `lstat` (SPEC 13.4). */
  readonly occupant: PathOccupant;
}

/**
 * The first workspace-relative directory component of `rel` occupied by
 * anything other than a directory — a plain file, a symbolic link (whatever
 * it targets: writes never traverse one, SPEC 13.4), or any other
 * non-directory occupant — or null when every existing component is a real
 * directory (SPEC 14.22). Components are examined shallowest first and
 * examination stops at the first non-directory or missing component: below
 * a non-directory nothing exists to examine (deeper conditions are
 * undetectable, SPEC 14, and an `lstat` through a symbolic link would
 * itself traverse it), and below a missing component nothing exists —
 * writes create those as directories, so a nonexistent component is never
 * this condition (SPEC 13.4). Components above the workspace root are
 * unrestricted (SPEC 13.4) and never examined.
 */
export async function obstructedComponentOf(
  root: string,
  rel: string,
): Promise<ObstructedComponent | null> {
  for (const component of directoryComponents(rel)) {
    const occupant = await classifyOccupant(absoluteOf(root, component));
    if (occupant === "absent") return null;
    if (occupant !== "directory") return { component, occupant };
  }
  return null;
}

/**
 * SPEC 13.4, the read side ("Reads traverse none either"): whether reads
 * may list the directory at the workspace-relative path `rel` — true
 * exactly when `rel` itself and every workspace-relative directory
 * component above it are occupied by directories, each judged by `lstat`
 * shallowest first, so a symbolic link is judged itself and never
 * traversed, whatever it targets. Absent, occupied by anything other than
 * a directory — a plain file, a symbolic link, any other non-directory
 * occupant — or lying below such an occupant, the directory holds nothing
 * (14.25's absence, never its refusal): no read lists through it, and the
 * caller reads nothing there. For `.xspec/reviews`, that is the session
 * directory holding no sessions (SPEC 10.1). Components above the
 * workspace root are unrestricted (SPEC 13.4) and never examined.
 */
export async function readableDirectory(
  root: string,
  rel: string,
): Promise<boolean> {
  for (const component of [...directoryComponents(rel), rel]) {
    const occupant = await classifyOccupant(absoluteOf(root, component));
    if (occupant !== "directory") return false;
  }
  return true;
}

/**
 * SPEC 13.4, the read side, for one file: what occupies the
 * workspace-relative path `rel` as reads see it. Below a workspace-relative
 * directory component occupied by anything other than a directory — a
 * plain file, a symbolic link whatever it targets, any other non-directory
 * occupant — nothing is read and the path holds nothing (14.25's absence,
 * never its refusal), so it classifies "absent" without being probed
 * through the component; otherwise the path's own occupant, judged by
 * `lstat` (`classifyOccupant`). For `.xspec/journal`, that is the journal
 * below an area path holding no directory: empty (SPEC 6.1) and unoccupied
 * to the inventory (SPEC 11.6).
 */
export async function readableOccupant(
  root: string,
  rel: string,
): Promise<PathOccupant> {
  const components = directoryComponents(rel);
  const parent = components[components.length - 1];
  if (parent !== undefined && !(await readableDirectory(root, parent))) {
    return "absent";
  }
  return classifyOccupant(absoluteOf(root, rel));
}

/** The SPEC 14.22 finding for one obstructed directory component. */
function obstructionFinding(obstructed: ObstructedComponent): Finding {
  const occupant =
    obstructed.occupant === "symlink"
      ? `a symbolic link — writes never traverse symbolic links, whatever ` +
        `the link targets (SPEC 13.4)`
      : `${describeOccupant(obstructed.occupant)}, not a directory ` +
        `(SPEC 13.4)`;
  return pathFinding(
    22,
    `obstructed write path: the workspace-relative directory component ` +
      `${obstructed.component} of a path xspec writes is occupied by ` +
      `${occupant}; replace ${obstructed.component} with a real directory, ` +
      `or redirect the writes so no path xspec writes passes through it ` +
      `(SPEC 14.22)`,
    obstructed.component,
  );
}

/**
 * SPEC 14.22 findings over a set of workspace-relative write paths: one
 * finding per distinct offending component, whatever write paths it
 * refuses, each finding's concerned path the component's workspace-relative
 * path. Deterministic — paths are deduplicated and examined in byte order,
 * findings in byte order of component (SPEC 12.0). Callers run this over
 * their complete write set before modifying anything ("a command refuses
 * the write and reports it before modifying anything"); `check` reports the
 * same findings without writing (SPEC 14.22).
 */
export async function obstructedWritePathFindings(
  root: string,
  rels: Iterable<string>,
): Promise<Finding[]> {
  const unique = [...new Set(rels)].sort(compareBytes);
  const obstructions = new Map<string, ObstructedComponent>();
  for (const rel of unique) {
    const obstructed = await obstructedComponentOf(root, rel);
    if (obstructed !== null && !obstructions.has(obstructed.component)) {
      obstructions.set(obstructed.component, obstructed);
    }
  }
  return [...obstructions.values()]
    .sort((a, b) => compareBytes(a.component, b.component))
    .map(obstructionFinding);
}

/**
 * Terminal defense shared by the write primitives: verify no
 * workspace-relative directory component of `rel` is a symbolic link
 * (callers report SPEC 14.22 gracefully before ever calling a write).
 * Throws on a symlinked component and on a component occupied by a
 * non-directory, which no directory creation can cure; the missing
 * components below the last existing one are the write's own to create
 * (`createParentDirectories`).
 */
async function assertUnobstructedParent(
  root: string,
  rel: string,
): Promise<void> {
  for (const component of directoryComponents(rel)) {
    const occupant = await classifyOccupant(absoluteOf(root, component));
    if (occupant === "absent") break; // mkdir supplies the rest
    if (occupant === "symlink") {
      throw new Error(
        `cannot write ${rel}: the workspace-relative directory component ` +
          `${component} is a symbolic link — writes never traverse ` +
          `symbolic links (SPEC 13.4, 14.22)`,
      );
    }
    if (occupant !== "directory") {
      throw new Error(
        `cannot write ${rel}: the workspace-relative directory component ` +
          `${component} is ${describeOccupant(occupant)}, not a directory`,
      );
    }
  }
}

/**
 * Bring the nonexistent directory components of a write path into
 * existence as directories (SPEC 13.4: a missing intermediate directory
 * never refuses or fails a write) — part of the write itself, so a refused
 * creation is the write's own failure (SPEC 14.24).
 */
async function createParentDirectories(absolute: string): Promise<void> {
  await fsp.mkdir(path.dirname(absolute), { recursive: true });
}

/**
 * SPEC 14.24: perform one write's filesystem mutations, turning any failure
 * the filesystem reports for them — permission denied, a read-only
 * filesystem, exhausted storage, any other — into the write failure
 * concerning `concerned`, thrown so the command stops at this write: no
 * later write is attempted, and every earlier one stays complete (SPEC
 * 13.5). The occupant classifications around a write are reads, never run
 * through here. Anything else — a defect of the product's own — propagates
 * unchanged.
 */
async function performWrite<T>(
  concerned: string,
  write: RefusedWrite,
  mutation: () => Promise<T>,
): Promise<T> {
  try {
    return await mutation();
  } catch (error) {
    if (isFilesystemFailure(error)) {
      throw writeFailure(concerned, write, error);
    }
    throw error;
  }
}

let temporaryCounter = 0;

/**
 * A fresh temp-file path in the same directory as `absolute` (rename is
 * atomic only within one filesystem, so the temp file lives beside its
 * target; IMPLEMENTATION). The name starts with `.` and contains `.xspec.`,
 * so even mid-write it is never discovered as a source: paths whose file
 * name contains `.xspec.` are excluded from every group (SPEC 13.4), and
 * the leading dot keeps it out of wildcard glob segments (SPEC 7).
 */
function temporaryPathBeside(absolute: string): string {
  temporaryCounter += 1;
  const name = `.xspec.tmp-${String(process.pid)}-${String(temporaryCounter)}`;
  return path.join(path.dirname(absolute), name);
}

/** The write's bytes: strings are UTF-8 (SPEC 12.0 byte determinism). */
function contentBytes(content: Uint8Array | string): Uint8Array {
  return typeof content === "string" ? Buffer.from(content, "utf8") : content;
}

/**
 * Atomically replace whatever occupies `absolute` with a plain file holding
 * `content`: the complete bytes land in a temp file beside the target, then
 * one rename replaces the occupant (SPEC 13.5). A symbolic-link occupant is
 * replaced as itself — rename never follows the destination — and nothing
 * is ever written through it (SPEC 13.4). A directory occupant, which
 * rename cannot replace, is removed and the rename retried: derived-file
 * paths belong to xspec, whatever exists at them (SPEC 13.4). On any
 * failure — the temp file's own write included, which exhausted storage
 * can cut short — the temp file is removed, best effort, and the failure
 * rethrown: the target keeps its prior state (SPEC 13.5), and the failure
 * is the write's to report (SPEC 14.24).
 */
async function replaceWithFile(
  absolute: string,
  content: Uint8Array | string,
): Promise<void> {
  const temporary = temporaryPathBeside(absolute);
  try {
    await fsp.writeFile(temporary, contentBytes(content));
    await renameOnto(temporary, absolute);
  } catch (error) {
    // Never leave the temp behind; where even its removal is refused, the
    // write's own failure is still the one reported.
    await fsp.rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

/**
 * Rename the complete temp file onto its target (SPEC 13.5), replacing a
 * directory occupant — which rename cannot replace — by removing it and
 * retrying. Where the target's occupant cannot even be classified, the
 * rename's own failure stands.
 */
async function renameOnto(temporary: string, absolute: string): Promise<void> {
  try {
    await fsp.rename(temporary, absolute);
  } catch (renameError) {
    const occupant = await classifyOccupant(absolute).catch(() => null);
    if (occupant !== "directory") throw renameError;
    await fsp.rm(absolute, { recursive: true, force: true });
    await fsp.rename(temporary, absolute);
  }
}

/**
 * Write a derived file (SPEC 13.4: generated TypeScript modules and
 * companions, emitted Markdown, graph data): atomic in its observable
 * effect (SPEC 13.5), replacing whatever occupies the path — a symbolic
 * link included, never writing through it (SPEC 13.4). Missing parent
 * directories are created. Callers have already validated the write path
 * (SPEC 14.22, `obstructedWritePathFindings`); an obstructed component here
 * is a terminal defense and throws. A write the environment refuses is the
 * write failure concerning `rel` — or, for a graph-data file, the
 * graph-data area `area` it lies in, no path inside the area named (SPEC
 * 14.24, 11.6).
 */
export async function writeDerivedFile(
  root: string,
  rel: string,
  content: Uint8Array | string,
  area?: string,
): Promise<void> {
  await assertUnobstructedParent(root, rel);
  const absolute = absoluteOf(root, rel);
  await performWrite(
    area ?? rel,
    area === undefined ? "write" : "graph-data",
    async () => {
      await createParentDirectories(absolute);
      await replaceWithFile(absolute, content);
    },
  );
}

/**
 * Rewrite a source file in place (SPEC 6.4, 6.5: `rename` and `move`
 * rewrite references across configured spec and code sources). Atomic in
 * its observable effect (SPEC 13.5), like every product write. The path
 * holds a discovered source — a plain file — and its rewritten content
 * replaces it; callers have validated the write path (SPEC 14.22) and run
 * under workspace exclusivity (SPEC 13.5). A refused write is the write
 * failure concerning `rel` (SPEC 14.24).
 */
export async function writeSourceFile(
  root: string,
  rel: string,
  content: Uint8Array | string,
): Promise<void> {
  await assertUnobstructedParent(root, rel);
  const absolute = absoluteOf(root, rel);
  await performWrite(rel, "write", async () => {
    await createParentDirectories(absolute);
    await replaceWithFile(absolute, content);
  });
}

/**
 * Remove a source file at its workspace-relative path (SPEC 6.5: the file
 * form of `xspec move` relocates the source file, so the origin path ceases
 * to exist). The occupant is a discovered source — a plain file reached
 * through real directories (discovery never follows symbolic links, SPEC 7)
 * — and removal never traverses a symlinked component (SPEC 13.4): a path
 * whose directory component became a symbolic link — or any other
 * non-directory, below which the source cannot exist — is skipped
 * untouched, as in orphan removal. An absent occupant is a completed
 * removal. A refused removal is the write failure concerning `rel` — a
 * relocation's second write, concerning the origin (SPEC 14.24, 13.5).
 */
export async function removeSourceFile(
  root: string,
  rel: string,
): Promise<void> {
  if ((await obstructedComponentOf(root, rel)) !== null) return;
  const absolute = absoluteOf(root, rel);
  await performWrite(rel, "remove", () => fsp.rm(absolute, { force: true }));
}

/**
 * Perform a rewriting operation's source writes (SPEC 6.4, 6.5) in the
 * order SPEC 13.5 pins (core/edits.ts `orderSourceWrites`), each atomic in
 * its observable effect (SPEC 13.5); a write the environment refuses stops
 * the operation there, the writes before it complete and none after it
 * attempted (SPEC 14.24).
 */
export async function performSourceWrites(
  root: string,
  writes: readonly SourceWrite[],
): Promise<void> {
  for (const write of writes) {
    if (write.kind === "write") {
      await writeSourceFile(root, write.path, write.content);
    } else {
      await removeSourceFile(root, write.path);
    }
  }
}

/**
 * Remove a derived file at a recorded path (orphan removal, SPEC 13.3/13.4:
 * a recorded derived file no longer generated is removed via its recorded
 * path). An absent occupant is a completed removal; a symbolic-link
 * occupant is removed as itself, never through the link; a directory
 * occupant is removed whole (the path belongs to xspec, SPEC 13.4). A
 * recorded path with a symbolic link at a workspace-relative directory
 * component is skipped untouched: removal never traverses a link (SPEC
 * 13.4), so the path no longer denotes a location xspec may touch — like an
 * orphan whose record is missing, it is outside xspec's knowledge; below
 * any other non-directory component the recorded path cannot exist, so the
 * removal is equally complete without touching anything. A refused removal
 * is the write failure concerning `rel` (SPEC 14.24).
 */
export async function removeDerivedFile(
  root: string,
  rel: string,
): Promise<void> {
  if ((await obstructedComponentOf(root, rel)) !== null) return;
  const absolute = absoluteOf(root, rel);
  const occupant = await classifyOccupant(absolute);
  if (occupant === "absent") return;
  await performWrite(rel, "remove", () =>
    fsp.rm(absolute, {
      recursive: occupant === "directory",
      force: true,
    }),
  );
}

/**
 * Refuse a durable write when `absolute` is occupied by anything other
 * than a plain file (SPEC 13.4: such a path is never read, appended to, or
 * replaced). Callers detect and report the occupant gracefully on the read
 * side (journal → 14.13, session → 14.21) before ever writing; this throw
 * is the terminal defense.
 */
async function requireDurableWritable(
  absolute: string,
  rel: string,
): Promise<void> {
  const occupant = await classifyOccupant(absolute);
  if (occupant !== "absent" && occupant !== "file") {
    throw new Error(
      `cannot write the durable file ${rel}: its path is occupied by ` +
        `${describeOccupant(occupant)} — a durable file's path occupied by ` +
        `anything other than a plain file is never read, appended to, or ` +
        `replaced (SPEC 13.4)`,
    );
  }
}

/**
 * Write a durable file (SPEC 13.4: the journal, review sessions) atomically
 * (SPEC 13.5), by its owning command only. The path must hold a plain file
 * or nothing: any other occupant refuses the write (SPEC 13.4; terminal
 * defense — the read side reports it as 14.13/14.21 first). A write the
 * environment refuses is the write failure concerning `rel` (SPEC 14.24).
 */
export async function writeDurableFile(
  root: string,
  rel: string,
  content: Uint8Array | string,
): Promise<void> {
  await assertUnobstructedParent(root, rel);
  const absolute = absoluteOf(root, rel);
  await performWrite(rel, "write", () => createParentDirectories(absolute));
  await requireDurableWritable(absolute, rel);
  await performWrite(rel, "write", () => replaceWithFile(absolute, content));
}

/**
 * Append to a line-oriented durable file (SPEC 6.1: the journal is
 * append-only and comes into existence with the first append; SPEC 13.4:
 * line-oriented so concurrent additions merge textually). Atomic in its
 * observable effect (SPEC 13.5): the first append — the file absent —
 * creates it as a complete file (temp beside the target, one rename), so a
 * concurrent reader only ever observes absence or the complete first entry,
 * never an empty or partial file (opening with O_CREAT and then writing
 * would expose an empty file between the two). Appending callers run under
 * workspace exclusivity (SPEC 13.5), so no concurrent appender races the
 * absence classification. Later appends are one O_APPEND write of the
 * complete bytes. The same non-plain-occupant refusal applies as for
 * `writeDurableFile`, and an append the environment refuses is the write
 * failure concerning `rel` (SPEC 14.24).
 */
export async function appendDurableFile(
  root: string,
  rel: string,
  content: Uint8Array | string,
): Promise<void> {
  await assertUnobstructedParent(root, rel);
  const absolute = absoluteOf(root, rel);
  await performWrite(rel, "append", () => createParentDirectories(absolute));
  await requireDurableWritable(absolute, rel);
  const bytes = Buffer.from(contentBytes(content));
  if ((await classifyOccupant(absolute)) === "absent") {
    await performWrite(rel, "append", () => replaceWithFile(absolute, bytes));
    return;
  }
  await performWrite(rel, "append", async () => {
    const handle = await fsp.open(absolute, "a");
    try {
      let written = 0;
      while (written < bytes.length) {
        const result = await handle.write(bytes, written);
        written += result.bytesWritten;
      }
    } finally {
      await handle.close();
    }
  });
}
