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

import * as path from "node:path";

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
