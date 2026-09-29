// The invocation-anchored path spelling of SPEC 11.6 — shared by every
// output that identifies a file relative to the invocation working
// directory: configuration-error concerned paths (SPEC 14) and the
// inventory's `root`/`config` anchoring (SPEC 11.6).
//
// SPEC 11.6: the spelling is canonical — the segments ascending from the
// working directory to the nearest common ancestor, each spelled `..`, then
// the segments descending to the identified file or directory, joined with
// `/` on every platform; no `.` segments, no trailing separator; the
// working directory itself spelled `.`. Only when the platform admits no
// relative path between the two (roots on different Windows drives) is the
// anchoring the platform's absolute drive-qualified form — the sole
// absolute-path case and the sole output spelling whose separator is the
// platform's (SPEC 12.0). The result is a pure function of the invocation
// input (SPEC 12.0: invocation-anchored content, deterministic per
// invocation).
//
// SPEC 11.6: "The working directory and the workspace root enter this
// spelling as physical directory paths, every symbolic link among their
// components resolved, and the configuration file as its own name under
// the root so spelled." `physicalDirectory` below is that resolution — the
// anchoring resolution of SPEC 14.25, whose examined directories a refused
// read concerns — walked component by component as the filesystem resolves
// a path, so a `--config` value (a filesystem path resolved against the
// working directory, 12.0) names the entry the filesystem finds there and
// is spelled by the physical relation.

import type { Stats } from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import {
  isAbsenceFailure,
  isFilesystemFailure,
} from "./environment-refusal.js";

/**
 * Spell `target` relative to the invocation working directory `cwd` in the
 * canonical anchoring form of SPEC 11.6. Both arguments are filesystem
 * paths; relative ones resolve against the process semantics of
 * `path.resolve` (callers pass absolute paths in practice).
 */
export function anchoredPathSpelling(cwd: string, target: string): string {
  const from = path.resolve(cwd);
  const to = path.resolve(target);
  const relative = path.relative(from, to);
  // The working directory itself is spelled `.` (SPEC 11.6).
  if (relative === "") return ".";
  // SPEC 11.6: where the platform admits no relative path (different
  // Windows drives), `path.relative` yields the target's absolute form —
  // reported drive-qualified in the platform's own spelling.
  if (path.isAbsolute(relative)) return to;
  // `path.relative` is exactly the `..`-ascend-then-descend segment walk of
  // SPEC 11.6, in the platform's separator; the canonical spelling joins
  // the segments with `/` on every platform.
  return relative.split(path.sep).join("/");
}

/**
 * The separators a path spelling's segments are split on: `/` on every
 * platform, and the platform's own separator — a `--config` value is a
 * filesystem path (SPEC 12.0), spelled as the platform reads one.
 */
const SEPARATORS: ReadonlySet<string> = new Set(["/", path.sep]);

/**
 * The segments of a path spelling in order, `.` and `..` kept as spelled
 * and empty segments (a doubled or trailing separator) dropped. The
 * spelling carries no root: callers split an absolute path's root off
 * first (`path.parse`).
 */
export function pathSegments(spelling: string): string[] {
  const segments: string[] = [];
  let segment = "";
  for (const character of spelling) {
    if (SEPARATORS.has(character)) {
      if (segment !== "") segments.push(segment);
      segment = "";
    } else {
      segment += character;
    }
  }
  if (segment !== "") segments.push(segment);
  return segments;
}

/**
 * The most symbolic links one physical resolution follows before it meets
 * the loop the filesystem itself reports (ELOOP) — Linux's own bound.
 */
const LINK_FOLLOW_LIMIT = 40;

/**
 * A physical resolution's outcome: the directory's physical path, or
 * nothing there — a component missing, not a directory, or a symbolic link
 * whose target is either, the absence every reader of SPEC 14.25 reads as
 * its own section states (never a refused read).
 */
export type PhysicalDirectory =
  { readonly found: true; readonly path: string } | { readonly found: false };

/**
 * SPEC 11.6: resolve the directory `segments` reach from the physical
 * directory `start`, every symbolic link among the components resolved —
 * as the filesystem resolves a path: each `.` the directory itself, each
 * `..` its physical parent (the directory reached so far, links already
 * resolved, never the lexical parent of the spelling), and each link
 * followed where it stands, a relative target read against the directory
 * holding the link and an absolute one from its own root. Component
 * spellings are otherwise kept as given: nothing but a symbolic link is
 * resolved.
 *
 * SPEC 14.25: a lookup the environment refuses in a directory the
 * resolution examines — the directory's entry, or the link found there —
 * throws `refused(examined, cause)`, the examined directory's physical
 * path beside the filesystem's failure; a loop of links is the failure the
 * filesystem reports for one (ELOOP). Nonexistence is never refused: it is
 * the `found: false` outcome.
 */
export async function physicalDirectory(
  start: string,
  segments: readonly string[],
  refused: (examined: string, cause: NodeJS.ErrnoException) => Error,
): Promise<PhysicalDirectory> {
  let resolved = start;
  const pending = [...segments];
  let followed = 0;
  for (;;) {
    const segment = pending.shift();
    if (segment === undefined) return { found: true, path: resolved };
    if (segment === ".") continue;
    if (segment === "..") {
      resolved = path.dirname(resolved);
      continue;
    }
    const examined = resolved;
    const candidate = path.join(examined, segment);
    const stats: Stats | undefined = await examine(
      () => fsp.lstat(candidate),
      examined,
      refused,
    );
    if (stats === undefined) return { found: false };
    if (stats.isSymbolicLink()) {
      followed += 1;
      if (followed > LINK_FOLLOW_LIMIT) {
        throw refused(examined, linkLoopFailure(candidate));
      }
      const target = await examine(
        () => fsp.readlink(candidate),
        examined,
        refused,
      );
      if (target === undefined) return { found: false };
      let rest = target;
      if (path.isAbsolute(target)) {
        resolved = path.parse(target).root;
        rest = target.slice(resolved.length);
      }
      pending.unshift(...pathSegments(rest));
      continue;
    }
    // Only a directory has entries to descend into: a plain file or any
    // other object here leaves nothing below it (ENOTDIR, absence).
    if (!stats.isDirectory()) return { found: false };
    resolved = candidate;
  }
}

/**
 * One read of the physical resolution: absence (`isAbsenceFailure`) is
 * `undefined`, a failure the filesystem reports is the refusal of the
 * examined directory (SPEC 14.25), and anything else — a defect of the
 * product's own — propagates unchanged.
 */
async function examine<T>(
  read: () => Promise<T>,
  examined: string,
  refused: (examined: string, cause: NodeJS.ErrnoException) => Error,
): Promise<T | undefined> {
  try {
    return await read();
  } catch (error) {
    if (isAbsenceFailure(error)) return undefined;
    if (isFilesystemFailure(error)) throw refused(examined, error);
    throw error;
  }
}

/**
 * The failure the filesystem reports for a path whose resolution follows
 * more symbolic links than it allows — a loop among them included.
 */
function linkLoopFailure(link: string): NodeJS.ErrnoException {
  const failure: NodeJS.ErrnoException = new Error(
    "ELOOP: too many symbolic links encountered",
  );
  failure.code = "ELOOP";
  failure.syscall = "lstat";
  failure.path = link;
  return failure;
}
