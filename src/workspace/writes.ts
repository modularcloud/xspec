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
// `readableOccupant`, over it, of what a read finds at a file's path, and
// `readableDirectoryEntries` the listing itself.
//
// SPEC 14.25: every one of those reads — a path occupant's kind wherever
// xspec examines one (6.5, 7, 11.6, 13.4), a directory's entries — is made
// through `probeOccupant` or `readableDirectoryEntries`, which read absence
// as absence and turn any other failure the filesystem reports into the
// typed read failure (./environment-refusal.ts) concerning the object's
// workspace-relative path, thrown so the command stops at that read (exit
// 2, SPEC 12.0). `classifyOccupant` stays the raw judgement beneath them,
// for the readers whose refused read is a condition of their own — among
// them the graph-data area's own path, whose refused kind read is the
// state of condition 23 (`graphDataAreaOccupant`): the record unreadable,
// nothing read below the area, no obstruction established there; only a
// write under the area, examining it first, stops at that read.
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
import { GRAPH_DATA_AREA } from "../core/graph-data.js";
import type { PathBytes, PathText } from "../core/path-text.js";
import {
  comparePathTexts,
  pathTextKey,
  pathTextOf,
  renderPathText,
} from "../core/path-text.js";
import type { RefusedWrite } from "./environment-refusal.js";
import {
  isFilesystemFailure,
  performRead,
  readFailure,
  writeFailure,
} from "./environment-refusal.js";

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
 * `nonDirectoryComponents`) — never a crash on the classifying read. Any
 * other failure is thrown as the filesystem reported it: the raw judgement,
 * for the readers whose refused kind read is a condition of their own
 * (SPEC 14.25: a derived file's kind that `check` compares, 14.10; the
 * graph-data area's, 14.23); every other kind read goes through
 * `probeOccupant`, which makes the refusal condition 25.
 */
export async function classifyOccupant(
  absolute: string | Buffer,
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
 * Classify the occupant of a workspace-relative path (SPEC 13.4) — every
 * kind read xspec makes of a path in the workspace, the `rename`/`move`
 * destination probes' included (SPEC 6.5, core/refusal.ts). A path
 * unreachable through a non-directory or looping component classifies as
 * "absent" like every classification; the offending component reports
 * separately (SPEC 6.5 `nonDirectoryComponents`, 14.22). SPEC 14.25: a kind
 * read the environment refuses — permission denied, an I/O error — is the
 * read failure concerning `rel`, thrown so the command stops at the read.
 */
export async function probeOccupant(
  root: string,
  rel: string,
): Promise<PathOccupant> {
  try {
    return await classifyOccupant(absoluteOf(root, rel));
  } catch (error) {
    if (isFilesystemFailure(error)) throw readFailure(rel, "kind", error);
    throw error;
  }
}

/**
 * What occupies the graph-data area's own path `.xspec` (SPEC 11.6, 13.3)
 * as a read judges it: its occupant by `lstat` (`classifyOccupant`), or
 * "refused" where the environment refuses the kind read. SPEC 14.25: a
 * refused read of the area's own occupant is the state of condition 23,
 * never the read failure of condition 25 — no record can be read under it
 * (14.23; `readStoredFile`, graph-data.ts), and, as below an area path
 * holding no directory, nothing below it is read (13.4): the journal is
 * empty and unoccupied to the inventory, the session directory holds no
 * sessions (`readableDirectory`; SPEC 11.6: "a refused read of the area's
 * own occupant is condition 23"), and no obstruction is established there
 * (`obstructedComponentOf`). A write under the area still examines it
 * first and stops at the refused read (`assertUnobstructedParent`: a write
 * never passes through a component it cannot judge, SPEC 13.4).
 */
export async function graphDataAreaOccupant(
  root: string,
): Promise<PathOccupant | "refused"> {
  try {
    return await classifyOccupant(absoluteOf(root, GRAPH_DATA_AREA));
  } catch (error) {
    if (isFilesystemFailure(error)) return "refused";
    throw error;
  }
}

/**
 * The occupant of a workspace-relative directory component as a read, or
 * the 14.22 examination of a write path, judges it: the graph-data area's
 * own path by `graphDataAreaOccupant`, its refused kind read "refused"
 * (the state of condition 23, SPEC 14.25); every other component by
 * `probeOccupant`, a refused kind read there the read failure (SPEC 14.25).
 */
async function componentOccupant(
  root: string,
  component: string,
): Promise<PathOccupant | "refused"> {
  return component === GRAPH_DATA_AREA
    ? graphDataAreaOccupant(root)
    : probeOccupant(root, component);
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
  /**
   * The component's workspace-relative path — the concerned path; in the
   * byte form where it has no plain string form (SPEC 12.0, 12.7).
   */
  readonly component: PathText;
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
 * unrestricted (SPEC 13.4) and never examined. A kind read the environment
 * refuses is the read failure concerning the component (SPEC 14.25) —
 * except the graph-data area's own path, whose refused kind read is the
 * state of condition 23 (SPEC 14.25; `graphDataAreaOccupant`), which
 * establishes no obstruction: examination stops there, and a write under
 * the area meets the refusal at its own examination
 * (`assertUnobstructedParent`).
 */
export async function obstructedComponentOf(
  root: string,
  rel: string,
): Promise<ObstructedComponent | null> {
  for (const component of directoryComponents(rel)) {
    const occupant = await componentOccupant(root, component);
    if (occupant === "absent" || occupant === "refused") return null;
    if (occupant !== "directory") return { component, occupant };
  }
  return null;
}

/** The `/` separating workspace-relative path segments, as a byte. */
const SLASH_BYTE = 0x2f;

/**
 * `obstructedComponentOf` over a write path with no plain string form
 * (SPEC 12.0) — a derived path of a discovered spec source whose own path
 * is not valid UTF-8 (14.19; `discoveredWritePaths`, core/build.ts): its
 * workspace-relative directory components, the byte prefixes ending before
 * each `/`, examined alike, shallowest first, stopping at the first
 * non-directory or missing one. A component with a string form is judged
 * exactly as `obstructedComponentOf` judges it; one without is addressed
 * by its exact bytes (`/`-separated, as discovery's walk addresses such a
 * path) and, obstructed, concerned in the byte form (SPEC 12.7), its
 * refused kind read the read failure concerning it (SPEC 14.25).
 */
async function obstructedByteComponentOf(
  root: string,
  bytes: Uint8Array,
): Promise<ObstructedComponent | null> {
  for (
    let end = bytes.indexOf(SLASH_BYTE);
    end !== -1;
    end = bytes.indexOf(SLASH_BYTE, end + 1)
  ) {
    const component = pathTextOf(bytes.subarray(0, end));
    const occupant =
      typeof component === "string"
        ? await componentOccupant(root, component)
        : await probeByteOccupant(root, component);
    if (occupant === "absent" || occupant === "refused") return null;
    if (occupant !== "directory") return { component, occupant };
  }
  return null;
}

/**
 * `probeOccupant` for a workspace-relative path with no plain string form,
 * addressed by its exact bytes: a kind read the environment refuses is the
 * read failure concerning the path in the byte form (SPEC 14.25, 12.7).
 */
async function probeByteOccupant(
  root: string,
  rel: PathBytes,
): Promise<PathOccupant> {
  try {
    return await classifyOccupant(
      Buffer.concat([
        Buffer.from(root),
        Buffer.from("/"),
        Buffer.from(rel.bytes),
      ]),
    );
  } catch (error) {
    if (isFilesystemFailure(error)) throw readFailure(rel, "kind", error);
    throw error;
  }
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
 * workspace root are unrestricted (SPEC 13.4) and never examined. A kind
 * read the environment refuses is the read failure concerning the
 * component read (SPEC 14.25, `probeOccupant`) — except the graph-data
 * area's own path, whose refused kind read is the state of condition 23
 * (SPEC 14.25, `graphDataAreaOccupant`): nothing below it is read, as
 * below an area path holding no directory (SPEC 13.4).
 */
export async function readableDirectory(
  root: string,
  rel: string,
): Promise<boolean> {
  for (const component of [...directoryComponents(rel), rel]) {
    const occupant = await componentOccupant(root, component);
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
 * `lstat` (`probeOccupant`). For `.xspec/journal`, that is the journal
 * below an area path holding no directory: empty (SPEC 6.1) and unoccupied
 * to the inventory (SPEC 11.6). A kind read the environment refuses — the
 * path's own or a component's — is the read failure concerning the path
 * read (SPEC 14.25: the journal's and a session file's kind included),
 * the graph-data area's own path excepted (`readableDirectory`: the state
 * of condition 23, nothing below it read).
 */
export async function readableOccupant(
  root: string,
  rel: string,
): Promise<PathOccupant> {
  if (!(await readsReach(root, rel))) return "absent";
  return probeOccupant(root, rel);
}

/**
 * SPEC 13.4, the read side, for one path: whether reads reach the
 * workspace-relative path `rel` — true exactly when every
 * workspace-relative directory component of `rel` is occupied by a
 * directory, each judged by `lstat` shallowest first (`readableDirectory`
 * over its parent), so a symbolic link is judged itself and never
 * traversed, whatever it targets. False below a component that is absent
 * or occupied by anything other than a directory — a plain file, a
 * symbolic link, any other non-directory occupant: nothing is read there,
 * and the path holds nothing (14.25's absence, never its refusal). The
 * path's own occupant is not examined; a top-level path has no directory
 * component and is always reached. A kind read the environment refuses
 * is `readableDirectory`'s: the read failure concerning the component
 * (SPEC 14.25) — the graph-data area's own path excepted (the state of
 * condition 23, nothing below it read).
 */
export async function readsReach(root: string, rel: string): Promise<boolean> {
  const components = directoryComponents(rel);
  const parent = components[components.length - 1];
  return parent === undefined || (await readableDirectory(root, parent));
}

/**
 * SPEC 13.4, 14.25: the entry names of the workspace directory at `rel`,
 * as a read lists them — the caller has judged the directory listable
 * (`readableDirectory`). A directory gone since lists nothing: its
 * nonexistence is absence, never a refusal. A listing the environment
 * refuses — permission denied, an I/O error — is the read failure
 * concerning `rel`, thrown so the command stops at the read.
 */
export async function readableDirectoryEntries(
  root: string,
  rel: string,
): Promise<string[]> {
  return performRead(
    rel,
    "listing",
    () => fsp.readdir(absoluteOf(root, rel)),
    () => [],
  );
}

/** The SPEC 14.22 finding for one obstructed directory component. */
export function obstructionFinding(obstructed: ObstructedComponent): Finding {
  const occupant =
    obstructed.occupant === "symlink"
      ? `a symbolic link — writes never traverse symbolic links, whatever ` +
        `the link targets (SPEC 13.4)`
      : `${describeOccupant(obstructed.occupant)}, not a directory ` +
        `(SPEC 13.4)`;
  const component = renderPathText(obstructed.component);
  return pathFinding(
    22,
    `obstructed write path: the workspace-relative directory component ` +
      `${component} of a path xspec writes is occupied by ` +
      `${occupant}; replace ${component} with a real directory, ` +
      `or redirect the writes so no path xspec writes passes through it ` +
      `(SPEC 14.22)`,
    obstructed.component,
  );
}

/**
 * SPEC 14.22's occupied-component relation over a set of workspace-relative
 * write paths, as data: each distinct offending component once, whatever
 * write paths it refuses, with its occupant. Deterministic — paths are
 * deduplicated and examined in byte order, components returned in byte
 * order (SPEC 12.0), a path with no plain string form (a derived path of a
 * source whose path is not valid UTF-8, 14.19) examined by its exact bytes
 * in the same order (`obstructedByteComponentOf`). The data form of
 * `obstructedWritePathFindings`, for `build`'s validations, which merge it
 * with 14.22's relation between derived paths (./build-validation.ts).
 */
export async function obstructedWriteComponents(
  root: string,
  rels: Iterable<PathText>,
): Promise<ObstructedComponent[]> {
  const unique = new Map<string, PathText>();
  for (const rel of rels) unique.set(pathTextKey(rel), rel);
  const obstructions = new Map<string, ObstructedComponent>();
  for (const rel of [...unique.values()].sort(comparePathTexts)) {
    const obstructed =
      typeof rel === "string"
        ? await obstructedComponentOf(root, rel)
        : await obstructedByteComponentOf(root, rel.bytes);
    if (obstructed === null) continue;
    const key = pathTextKey(obstructed.component);
    if (!obstructions.has(key)) obstructions.set(key, obstructed);
  }
  return [...obstructions.values()].sort((a, b) =>
    comparePathTexts(a.component, b.component),
  );
}

/**
 * SPEC 14.22 findings over a set of workspace-relative write paths: one
 * finding per distinct offending component, whatever write paths it
 * refuses, each finding's concerned path the component's workspace-relative
 * path, in byte order of component (`obstructedWriteComponents`). Callers
 * run this over their complete write set before modifying anything ("a
 * command refuses the write and reports it before modifying anything");
 * `check` reports the same findings without writing (SPEC 14.22). `build`'s
 * own write set is judged by ./build-validation.ts, which adds the relation
 * between derived paths.
 */
export async function obstructedWritePathFindings(
  root: string,
  rels: Iterable<PathText>,
): Promise<Finding[]> {
  return (await obstructedWriteComponents(root, rels)).map(obstructionFinding);
}

/**
 * Terminal defense shared by the write primitives: verify no
 * workspace-relative directory component of `rel` is a symbolic link
 * (callers report SPEC 14.22 gracefully before ever calling a write).
 * Throws on a symlinked component and on a component occupied by a
 * non-directory, which no directory creation can cure; the missing
 * components below the last existing one are the write's own to create
 * (`createParentDirectories`). Every component is judged by `probeOccupant`
 * — the graph-data area's own path included: a write never passes through
 * a component it cannot judge (SPEC 13.4), so a refused kind read here is
 * the read failure, the command stopping at it (SPEC 14.25).
 */
async function assertUnobstructedParent(
  root: string,
  rel: string,
): Promise<void> {
  for (const component of directoryComponents(rel)) {
    const occupant = await probeOccupant(root, component);
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
 * SPEC 13.4: whether removing a recorded derived file the current sources
 * and configuration no longer generate removes an occupant of this kind —
 * "its path's occupant when that is anything but a directory or a
 * discovered source — a symbolic link itself, never its target": a plain
 * file, a symbolic link, or any other non-directory occupant. A directory
 * is left as it is, and so is nothing (no occupant), the removal making no
 * write: every derived file is a plain file. A discovered source never
 * reaches this judgement — core/build.ts `orphanedRecordedPaths` keeps
 * every discovered source's path out of the removal's domain ("a source is
 * never derived"). The one judgement behind the removal
 * (`removeDerivedFile`) and 14.10's recorded-file form, which reports
 * exactly "an occupant the removal of 13.4 would remove"
 * (workspace/check.ts `recordStalenessFindings`), so the two move
 * together.
 */
export function orphanRemovalRemoves(occupant: PathOccupant): boolean {
  return occupant !== "absent" && occupant !== "directory";
}

/**
 * Remove a derived file at a recorded path (orphan removal, SPEC 13.3/13.4:
 * a recorded derived file no longer generated is removed via its recorded
 * path — `rel` one of core/build.ts's orphans, never a discovered source's
 * path). Its occupant is removed when `orphanRemovalRemoves` judges it so:
 * a symbolic-link occupant is removed as itself, never through the link;
 * a directory occupant is left as it is, with everything under it, and an
 * absent one leaves nothing to remove — either way the removal makes no
 * write (SPEC 13.4). A recorded path with a symbolic link at a
 * workspace-relative directory component is skipped untouched: removal
 * never traverses a link (SPEC 13.4), so the path no longer denotes a
 * location xspec may touch — like an orphan whose record is missing, it is
 * outside xspec's knowledge; below any other non-directory component the
 * recorded path holds nothing (SPEC 13.4), so the removal is equally
 * complete without touching anything. A refused removal is the write
 * failure concerning `rel` (SPEC 14.24).
 */
export async function removeDerivedFile(
  root: string,
  rel: string,
): Promise<void> {
  if ((await obstructedComponentOf(root, rel)) !== null) return;
  const absolute = absoluteOf(root, rel);
  const occupant = await probeOccupant(root, rel);
  if (!orphanRemovalRemoves(occupant)) return;
  // Never recursive: the occupant is no directory (SPEC 13.4), and a
  // symbolic link is unlinked as itself, whatever it targets.
  await performWrite(rel, "remove", () => fsp.rm(absolute, { force: true }));
}

/**
 * Refuse a durable write when `absolute` is occupied by anything other
 * than a plain file (SPEC 13.4: such a path is never read, appended to, or
 * replaced). Callers detect and report the occupant gracefully on the read
 * side (journal → 14.13, session → 14.21) before ever writing; this throw
 * is the terminal defense.
 */
async function requireDurableWritable(
  root: string,
  rel: string,
): Promise<void> {
  const occupant = await probeOccupant(root, rel);
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
  await requireDurableWritable(root, rel);
  await performWrite(rel, "write", () => replaceWithFile(absolute, content));
}

/**
 * Append `addition` to a line-oriented durable file (SPEC 6.1: the journal
 * is append-only and comes into existence with the first append; SPEC 13.4:
 * line-oriented so concurrent additions merge textually), atomic in its
 * observable effect (SPEC 13.5): the file's content after the append —
 * `prior`, the content the caller validated (null: the file absent), then
 * `addition` — replaces the file as one complete file, the temp file beside
 * it and then one rename (`replaceWithFile`), the first append's creation
 * and every later append alike. So at every moment a concurrent reader
 * observes the prior state or the complete new content, and an append the
 * environment refuses — exhausted storage cutting the temp file's write
 * short included — or an interrupted command leaves the file byte-for-byte
 * as it was, never a partial line (SPEC 13.5, 14.24; the journal append
 * is the operation's commit point, so an operation stopped there leaves
 * no entry, 13.5). Writing the addition in place would not be: an
 * O_APPEND write that exhausted storage cuts short leaves part of the
 * line, and a reader can observe it partly written.
 * The content is composed from `prior`, not read again: appending callers
 * run under workspace exclusivity (SPEC 13.5), so no rival appender changes
 * what they validated — "the workspace it validates is the one it
 * rewrites" — and the append makes no read the environment could refuse
 * past the operation's earlier writes. The same non-plain-occupant refusal
 * applies as for `writeDurableFile`, and an append the environment refuses
 * is the write failure concerning `rel` (SPEC 14.24).
 */
export async function appendDurableFile(
  root: string,
  rel: string,
  prior: Uint8Array | null,
  addition: Uint8Array | string,
): Promise<void> {
  await assertUnobstructedParent(root, rel);
  const absolute = absoluteOf(root, rel);
  await performWrite(rel, "append", () => createParentDirectories(absolute));
  await requireDurableWritable(root, rel);
  const added = contentBytes(addition);
  const bytes = prior === null ? added : Buffer.concat([prior, added]);
  await performWrite(rel, "append", () => replaceWithFile(absolute, bytes));
}
