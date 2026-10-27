// Source discovery — the I/O half: the symlink-free directory walk
// (SPEC 7; IMPLEMENTATION Architecture: source discovery is workspace-layer
// I/O, and the walk is in-repo — no glob library, no walker dependency).
//
// SPEC 7: discovery never follows symbolic links — a symbolic link, to a
// file or to a directory, broken or not, is never a discovered source and
// is never traversed, so symlinked, cyclic, or workspace-external content
// never enters the discovered set. SPEC 7: discovery reads only what
// deciding that set takes — it lists a directory exactly when some
// configured spec or code glob matches a path below it, paths under
// `.xspec/` (13.4) counting for none. So the walk starts at the workspace
// root (the configuration file's directory, SPEC 7) only when some glob
// matches a path below the root outside `.xspec/`, judged from the globs
// alone, and enters each directory below only when some glob matches a
// path below that directory, never entering the root-level `.xspec/`.
// SPEC 7: and it examines the kind of exactly those entries of a listed
// directory whose paths such a glob matches or that it would list were
// they directories. So the walk takes every kind the listing reports from
// the listing, a read already made, and examines a kind separately (an
// lstat) only for an entry of unreported kind that a glob matches or that
// it would list were it a directory, leaving every other entry unexamined.
// Matching is against workspace-relative paths as their UTF-8 bytes, so
// directory entries are read with buffer encoding and never decoded
// before matching — a name the filesystem reports is matched verbatim
// (byte-wise, case-sensitive, SPEC 7/12.0), never re-derived through
// filesystem lookups.
//
// SPEC 14.25: a directory the walk lists, or an entry whose kind it must
// examine, that the environment refuses to read — permission denied, an
// I/O error — stops the command at that read with the exit-2 read failure
// (./environment-refusal.ts), concerning the directory's or entry's
// workspace-relative path, the root itself in its anchoring form (11.6).
// Nonexistence is never that condition: a directory or entry gone since
// its parent was listed holds and is nothing — an absent path is matched
// by no glob (SPEC 7, 14.25).
//
// Group matching, derived-file exclusion (SPEC 13.4), and path validation
// (14.14/14.19) are the pure core's (src/core/discovery.ts).

import { Buffer } from "node:buffer";
import type { Dirent, Stats } from "node:fs";
import * as fsp from "node:fs/promises";
import type { Configuration } from "../core/config.js";
import type { SourceClassification } from "../core/discovery.js";
import { classifySources } from "../core/discovery.js";
import type { CompiledGlob } from "../core/glob.js";
import type { PathText } from "../core/path-text.js";
import { pathTextOf } from "../core/path-text.js";
import { isFilesystemFailure, performRead } from "./environment-refusal.js";

const SLASH = Buffer.from("/");
/** SPEC 13.4/13.3: the workspace-root graph-data directory name. */
const XSPEC_DIR = Buffer.from(".xspec");

/**
 * Discover the workspace's spec and code sources (SPEC 7): walk the
 * workspace root without following symbolic links — when some configured
 * glob matches a path below it outside `.xspec/`, else listing nothing —
 * then classify every plain file found against the configured groups
 * (core/discovery.ts), exclusions (13.4) and path conditions (14.14,
 * 14.19) included. `root` is the workspace root's absolute filesystem path
 * (SPEC 7: the configuration file's directory; the walk is independent of
 * the working directory), and `rootAnchor` the root in its anchoring form
 * (SPEC 11.6) — the concerned path of a refused listing of the root itself
 * (SPEC 14.25).
 */
export async function discoverSources(
  root: string,
  configuration: Configuration,
  rootAnchor: string,
): Promise<SourceClassification> {
  const globs: readonly CompiledGlob[] = [
    ...configuration.specGroups,
    ...configuration.codeGroups,
  ].flatMap((group) => group.globs);
  const files: Uint8Array[] = [];
  // SPEC 7: discovery lists the workspace root exactly when some configured
  // spec or code glob matches a path below it, paths under `.xspec/` — which
  // 13.4 excludes from every group — counting for none (core/glob.ts). So
  // with no configured glob, or only globs matching no path (a `.`, `..`,
  // or empty segment: `./specs/*.mdx`) or none outside `.xspec/`
  // (`.xspec/*.mdx`), discovery yields zero sources without touching the
  // filesystem: the root's listing is never made, so never refused (14.25).
  if (globs.some((glob) => glob.mayMatchBelowRoot(XSPEC_DIR))) {
    await walk(Buffer.from(root), null, rootAnchor, globs, files);
  }
  return classifySources(files, configuration);
}

/**
 * What occupies a directory entry, as discovery tells occupants apart
 * (SPEC 7): a plain file, a directory, a symbolic link (never followed),
 * or anything else — a FIFO, a socket, or a device, which is neither a
 * source file nor a directory holding any.
 */
type EntryKind = "file" | "directory" | "symbolic-link" | "other";

/**
 * One entry of a listed directory: its name as the filesystem reports it,
 * and its kind as the listing reports it — null where the listing reports
 * none, so that only a separate examination could tell it.
 */
interface ListedEntry {
  readonly name: Buffer;
  readonly kind: EntryKind | null;
}

/** The kind a typed listing reports for an entry, or null for none. */
function listedKind(dirent: Dirent<Buffer>): EntryKind | null {
  if (dirent.isFile()) return "file";
  if (dirent.isDirectory()) return "directory";
  if (dirent.isSymbolicLink()) return "symbolic-link";
  if (
    dirent.isFIFO() ||
    dirent.isSocket() ||
    dirent.isBlockDevice() ||
    dirent.isCharacterDevice()
  ) {
    return "other";
  }
  return null;
}

/**
 * The kind an `lstat` of the entry tells: the entry's own, never a
 * symbolic link's target's (SPEC 7).
 */
function examinedKind(stats: Stats): EntryKind {
  if (stats.isSymbolicLink()) return "symbolic-link";
  if (stats.isFile()) return "file";
  if (stats.isDirectory()) return "directory";
  return "other";
}

/**
 * List one directory (SPEC 7), each entry with the kind the listing
 * reports. SPEC 14.25: a listing the environment refuses stops the command
 * here, concerning `concerned`; a directory gone since its parent was
 * listed lists nothing (SPEC 7, 14.25).
 *
 * Node's typed listing examines on its own — an `lstat` — every entry
 * whose type the filesystem leaves unreported (one without `d_type`
 * support), and fails the whole listing when one such examination fails.
 * That examination is a kind read SPEC 7 may forbid (the entry may lie
 * outside every glob), and its failure — refused, or the entry gone — is
 * no failure of the listing itself. So when the typed listing fails at
 * such an examination (its error names `lstat`, a listing's `scandir`),
 * the directory is listed again by name alone, every entry's kind left
 * unreported, for `walk` to examine only where SPEC 7 examines it.
 */
async function listDirectory(
  absolute: Buffer,
  concerned: PathText,
): Promise<ListedEntry[]> {
  const typed = await performRead(
    concerned,
    "listing",
    async () => {
      try {
        return await fsp.readdir(absolute, {
          withFileTypes: true,
          encoding: "buffer",
        });
      } catch (error) {
        if (isFilesystemFailure(error) && error.syscall === "lstat") {
          return null;
        }
        throw error;
      }
    },
    () => [],
  );
  if (typed !== null) {
    return typed.map((dirent) => ({
      name: dirent.name,
      kind: listedKind(dirent),
    }));
  }
  const names = await performRead(
    concerned,
    "listing",
    () => fsp.readdir(absolute, { encoding: "buffer" }),
    () => [],
  );
  return names.map((name) => ({ name, kind: null }));
}

/**
 * SPEC 7: whether discovery would list the entry were it a directory —
 * exactly when some configured glob matches a path below it, paths under
 * `.xspec/` counting for none. So never the root-level `.xspec`, the
 * workspace-root graph-data directory (13.3), every file under which 13.4
 * excludes from every group; elsewhere `mayMatchWithin` decides (exact for
 * a plain glob: some path below the entry matches exactly when pattern
 * segments remain once the entry's own are matched). SPEC 7's dot rule
 * keeps wildcard-only patterns out of dot-directories (`.git`, caches)
 * unless a pattern spells the segment with its leading dot.
 */
function wouldList(
  parent: Buffer | null,
  name: Buffer,
  entryRelative: Buffer,
  globs: readonly CompiledGlob[],
): boolean {
  if (parent === null && Buffer.compare(name, XSPEC_DIR) === 0) return false;
  return globs.some((glob) => glob.mayMatchWithin(entryRelative));
}

/**
 * Recursive walk of one directory. `relative` is the directory's
 * workspace-relative byte path (null for the root, whose concerned path is
 * `rootAnchor`). Entries are visited in byte order of their names, each
 * kind taken from the listing wherever it reports one, and plain files are
 * collected as workspace-relative byte paths.
 */
async function walk(
  absolute: Buffer,
  relative: Buffer | null,
  rootAnchor: string,
  globs: readonly CompiledGlob[],
  files: Uint8Array[],
): Promise<void> {
  const concerned: PathText =
    relative === null ? rootAnchor : pathTextOf(relative);
  const entries = await listDirectory(absolute, concerned);
  entries.sort((a, b) => Buffer.compare(a.name, b.name));
  for (const entry of entries) {
    const name: Buffer = entry.name;
    const entryAbsolute = Buffer.concat([absolute, SLASH, name]);
    const entryRelative =
      relative === null
        ? Buffer.from(name)
        : Buffer.concat([relative, SLASH, name]);
    let kind = entry.kind;
    if (kind === null) {
      // SPEC 7: discovery examines the kind of exactly those entries of a
      // listed directory whose paths some configured glob matches or that
      // it would list were they directories. Any other entry is never a
      // source — a plain file no glob matches is dropped by
      // classification anyway — and is never listed, so it stays
      // unexamined, a refusal to examine it never met (14.25).
      const examined =
        globs.some((glob) => glob.matches(entryRelative)) ||
        wouldList(relative, name, entryRelative, globs);
      if (!examined) continue;
      // The examination is an lstat, which never follows a symbolic link
      // (SPEC 7) — stat would. An entry gone since the listing is no
      // source (SPEC 7, 14.25: an absent path is matched by no glob); a
      // kind read the environment refuses is the read failure concerning
      // the entry (SPEC 14.25).
      const stats = await performRead(
        pathTextOf(entryRelative),
        "kind",
        () => fsp.lstat(entryAbsolute),
        () => null,
      );
      if (stats === null) continue;
      kind = examinedKind(stats);
    }
    switch (kind) {
      case "file":
        files.push(entryRelative);
        break;
      case "directory":
        if (wouldList(relative, name, entryRelative, globs)) {
          await walk(entryAbsolute, entryRelative, rootAnchor, globs, files);
        }
        break;
      case "symbolic-link":
      case "other":
        // SPEC 7: a symbolic link — to a file or to a directory, broken or
        // not — is never a discovered source and is never traversed; a
        // FIFO, a socket, or a device is no source file and holds none.
        break;
    }
  }
}
