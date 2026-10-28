// H-6's classification of the harness's compares: which mutating commands'
// runs acted on which lock paths, and when (TEST-SPEC H-6; SPEC 13.5, 13.4,
// 7, 12.0). Harness machinery only: no product imports, no test framework
// dependence.
//
// H-6 excludes the lock path `.xspec/lock`, and everything under it, from
// every comparison of a mutating command's run against its own
// pre-invocation state — acquisition's and release's writes there counting
// as no modification — and keeps it in every comparison around commands that
// acquire nothing, no other run acquiring, releasing, or being killed
// meanwhile. A same-workspace compare therefore excludes it exactly when a
// mutating command's run acted on it between the compare's two snapshots,
// and this module is what records that:
//
// - The subprocess driver (helpers/subprocess.ts `startProduct`, the one path
//   every invocation takes) notes every invocation that is a mutating
//   command's run (`invocationAcquires`, helpers/invocation-grammar.ts:
//   `rename` and `move` without `--preview`, `review create`, `resolve`,
//   `split`), right before spawning it, with the lock path of the workspace
//   it runs against: `.xspec/lock` under the directory SPEC 7 makes the
//   workspace root — the directory of the `--config` path, else the nearest
//   directory, the working directory itself first, holding an entry named
//   `xspec.config.ts`, searched upward from the working directory's real
//   path, as the product's own working directory is. The note is an event —
//   the run's start, which may acquire — and the run's end, recorded once
//   the driver sees it exit however it ended (a completion, a refusal, a
//   kill), is a second: its release or its leftover.
// - A snapshot (helpers/snapshot.ts) records the event count when its walk
//   begins (`acquisitionMark`), so two snapshots of one directory bound an
//   interval, and the lock paths acted on in it are those of the events it
//   holds (`lockPathsActedOnBetween`). A run held throughout a compare —
//   started before its first snapshot, ending after its second — contributes
//   no event to it: its entry stands unchanged meanwhile, and a compare
//   around a command acquiring nothing then includes it, as H-6 requires
//   (T13.5-4).
//
// An invocation whose workspace cannot be placed — no configuration found
// upward, a `--config` value given as bytes or naming a directory that does
// not exist, a working directory or an ancestor whose entry the harness
// cannot examine — records no lock path: such a run fails before acquisition
// (a configuration error, 7, 14.14), so it writes at no lock path. Events
// are kept for the life of the process: compares of any two snapshots taken
// in it are classified exactly, concurrent bodies of the certification
// runner included (each event names its own workspace's lock path).

import { Buffer } from "node:buffer";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import {
  configPathArgument,
  invocationAcquires,
} from "./invocation-grammar.js";
import type { ArgvValue } from "./subprocess.js";

/** One event of a mutating command's run: its start or its end. */
interface AcquisitionEvent {
  /** The event's position in the process-wide count (1-based). */
  readonly sequence: number;
  /** The absolute real path of the run's lock path. */
  readonly lockPath: string;
}

let eventCount = 0;
const events: AcquisitionEvent[] = [];

/** A noted mutating command's run; its end is recorded through `ended`. */
export interface AcquiringRun {
  /** The absolute real lock path the run acts on, if its workspace is placed. */
  readonly lockPath: string | undefined;
  /** Record the run's end (idempotent): its release, or a kill's leftover. */
  ended(): void;
}

/**
 * The process-wide count of acquisition events so far: a snapshot records it
 * as its walk begins (helpers/snapshot.ts).
 */
export function acquisitionMark(): number {
  return eventCount;
}

/**
 * Note an invocation about to be spawned with working directory `cwd` and
 * arguments `argv` (the product's own, after the binding's prefix): when it
 * is a mutating command's run (SPEC 13.5), record its start against the lock
 * path of its workspace and return the run, whose `ended` the driver calls
 * once it exits; otherwise undefined (it acquires nothing).
 */
export async function noteAcquiringRun(
  cwd: string,
  argv: readonly ArgvValue[],
): Promise<AcquiringRun | undefined> {
  if (!invocationAcquires(argv)) return undefined;
  const root = await invocationWorkspaceRoot(cwd, argv);
  const lockPath =
    root === undefined ? undefined : path.join(root, ".xspec", "lock");
  record(lockPath);
  let open = true;
  return {
    lockPath,
    ended: () => {
      if (!open) return;
      open = false;
      record(lockPath);
    },
  };
}

function record(lockPath: string | undefined): void {
  eventCount += 1;
  if (lockPath !== undefined) events.push({ sequence: eventCount, lockPath });
}

/**
 * The lock paths (absolute, real) some mutating command's run acted on —
 * started or ended — between two marks: the events after the earlier mark
 * up to the later one, in either order of the arguments, each path once.
 */
export function lockPathsActedOnBetween(
  firstMark: number,
  secondMark: number,
): readonly string[] {
  const from = Math.min(firstMark, secondMark);
  const to = Math.max(firstMark, secondMark);
  // Events are recorded in sequence order: find the first after `from`.
  let low = 0;
  let high = events.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if ((events[middle] as AcquisitionEvent).sequence <= from) low = middle + 1;
    else high = middle;
  }
  const paths = new Set<string>();
  for (let index = low; index < events.length; index += 1) {
    const event = events[index] as AcquisitionEvent;
    if (event.sequence > to) break;
    paths.add(event.lockPath);
  }
  return [...paths];
}

/**
 * The workspace root SPEC 7 places an invocation in — the real path of the
 * directory of its `--config` path, else of the nearest directory holding an
 * entry named `xspec.config.ts`, whatever occupies it, searched upward from
 * the working directory's real path — or undefined where none is found or
 * the search cannot proceed (module header).
 */
async function invocationWorkspaceRoot(
  cwd: string,
  argv: readonly ArgvValue[],
): Promise<string | undefined> {
  let start: string;
  try {
    start = await fsp.realpath(cwd);
  } catch {
    return undefined;
  }
  const config = configPathArgument(argv);
  if (config !== undefined) {
    if (typeof config !== "string") return undefined;
    try {
      return await fsp.realpath(path.dirname(path.resolve(start, config)));
    } catch {
      return undefined;
    }
  }
  for (let dir = start; ;) {
    try {
      await fsp.lstat(path.join(dir, "xspec.config.ts"));
      return dir;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT" && code !== "ENOTDIR") return undefined;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/**
 * Where a lock path lies relative to a snapshot root (both absolute, real):
 * `"all"` when the root is the lock path or lies under it, every entry then
 * under it; the lock path's relative path as a snapshot key (its exact
 * UTF-8 bytes, one latin1 character per byte, `/`-separated) when it lies
 * under the root; undefined when it lies elsewhere.
 */
export function lockPathKeyUnder(
  realRoot: string,
  lockPath: string,
): string | "all" | undefined {
  const rel = path.relative(realRoot, lockPath);
  if (rel === "") return "all";
  if (isOutside(rel)) {
    return isOutside(path.relative(lockPath, realRoot)) ? undefined : "all";
  }
  return Buffer.from(rel.split(path.sep).join("/"), "utf8").toString("latin1");
}

function isOutside(rel: string): boolean {
  return (
    rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)
  );
}
