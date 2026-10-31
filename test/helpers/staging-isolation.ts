// H-1's isolation of a staging from what TypeScript and Node.js read above
// it (TEST-SPEC H-1, H-2, H-11, H-9, T13.1-2; SPEC 7.6, 13.1). Harness
// machinery only: this module never imports product code and runs no
// product.
//
// TEST-SPEC H-1: the verification reaches what TypeScript and Node.js read
// above a staging too — an arm staging the `defineConfig` module (SPEC 7.6;
// P-17, P-18) or compiling or running a consumer program (H-2) runs only
// once the harness has verified, under the environment those tools run in —
// TypeScript taking a directory inside the staging as its current one,
// Node.js run with no `NODE_PATH` and a fresh `HOME` — that no ancestor of
// the staging root holds a `package.json` or a `node_modules` entry and that
// none of Node.js's global module folders holds a package, so that no
// manifest outside the staging decides a project's module kind, names a
// self-reference, or breaks Reach's manifest condition (SPEC 7.6), and no
// `@types` package, library replacement (`@typescript/lib-…`), or copy of
// the product's package enters a program or a module search from above; an
// unmet precondition is a harness error (H-11), never a pass, a product
// failure, or a skip (H-9). `verifyStagingIsolation` is that verification,
// one check for every such staging — H-2's consumer programs
// (helpers/tooling.ts: a project's root before TypeScript serves it, the
// runtime output directory before the compiler writes into it and again
// before each run) and the module channel's stagings alike
// (helpers/module-channel.ts: a staging as it is made, and again wherever a
// driver asks before a Node.js run, with that run's exact environment,
// working directory, and release executables) — called before
// the tools read the staging, by a caller that keeps TypeScript's current
// directory inside the staging and gives each Node.js run exactly the
// environment verified:
//
// - The ancestor half: every ancestor directory of the staging root — its
//   parent up to the filesystem root, along the root as spelled and along
//   its physical path alike, each directory once — holds no entry named
//   `package.json` or `node_modules` of any kind, judged by `lstat`: a plain
//   file, a directory, or a symbolic link, a dangling one included. Both
//   tools read up the tree: TypeScript's module resolution, its automatic
//   inclusion of `@types` packages, and its lookup of library replacements
//   search the `node_modules` directories above its current directory or an
//   importing file, as Node.js's resolver searches those above an importing
//   file; and both read the nearest `package.json` above a file for its
//   module kind and a package's self-reference, SPEC 7.6's Reach every
//   manifest above it. The root's own entries are the staging's; a staging
//   holding nothing installed in it either (T13.1-2's consumer project:
//   "nothing installed in or above it") has its root refuse an entry named
//   `node_modules` too (`nothingInstalledInRoot`).
// - The global half, for a staging Node.js runs on (`run`): none of
//   Node.js's global module folders under the environment the run will
//   have — its `NODE_PATH` entries, if it has any, each resolved from the
//   run's working directory; `.node_modules` and `.node_libraries` under its
//   own `HOME` (`USERPROFILE` on Windows); and `lib/node` under the prefix
//   of each Node.js executable that will run there (the directory above its
//   `bin/`, the executable's own directory on Windows), for the executable
//   as spelled and along its physical path, the path Node.js's
//   `process.execPath` reports — holds any entry. A folder that exists and
//   holds an entry of any name or kind counts as holding a package, the
//   conservative reading: Node.js's resolver finds a module there by the
//   entry's name, a package may be installed under any name (SPEC 7.6), and
//   H-2 keeps "no copy of the product's package under any name" from a
//   consumer's reach. A folder that is absent, or is no directory (read as
//   the resolver reads it, a symbolic link followed), holds none.
// - An examination failing otherwise than by absence (`ENOENT`, `ENOTDIR`)
//   — the root's or an executable's physical path unreadable, an entry's
//   `lstat`, a folder's `stat` or listing refused — leaves the precondition
//   unverified, an unmet precondition too.
// - Unmet or unverified throws `HarnessStagingError` (helpers/permissions.ts)
//   of the caller's mode — `consumer-isolation` for H-2's consumer programs,
//   `module-channel` for the module channel's stagings — naming the
//   offending entry or what left it unverified, `context`
//   leading its detail and the caller's statement of the rule closing it:
//   never a `HarnessAssertionError`, since nothing here is a product verdict.
//   Each half is one harness step under its own guard (TEST-SPEC S-3,
//   helpers/step-guards.ts).

import type { Stats } from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import type { StagingMode } from "./permissions.js";
import { HarnessStagingError } from "./permissions.js";
import { guardStep } from "./step-guards.js";

/** The manifest both tools read up the tree (module header). */
export const PACKAGE_MANIFEST_NAME = "package.json";

/** The directory both tools search up the tree for installed packages. */
export const NODE_MODULES_NAME = "node_modules";

/** H-1's statement of the precondition, closing a refusal by default. */
export const STAGING_ISOLATION_RULE =
  "an arm whose staging TypeScript or Node.js reads runs only once the " +
  "harness has verified, under the environment those tools run in, that no " +
  "ancestor of the staging root holds a package.json or a node_modules " +
  "entry and that none of Node.js's global module folders holds a package " +
  "— an unmet precondition a harness error, never a pass, a product " +
  "failure, or a skip (TEST-SPEC H-1, H-11, H-9)";

/** What each ancestor entry H-1 refuses is read for (module header). */
const READ_ABOVE: Readonly<Record<string, string>> = {
  [PACKAGE_MANIFEST_NAME]:
    "which TypeScript and Node.js read as the manifest deciding a file's " +
    "module kind and naming a package's self-reference, and SPEC 7.6's " +
    "Reach as a manifest above the importing file",
  [NODE_MODULES_NAME]:
    "from which TypeScript's module resolution, its automatic @types " +
    "inclusion, and its library-replacement lookup, and Node.js's " +
    "resolver, read installed packages",
};

/** The Node.js runs a staging will see (`StagingIsolation.run`). */
export interface StagedNodeRun {
  /**
   * The environment each run will have, exactly as it is spawned with
   * (`productEnvironment`, helpers/subprocess.ts, the run's own overrides
   * merged).
   */
  readonly environment: Readonly<Record<string, string>>;
  /** The runs' working directory, absolute: relative paths resolve from it. */
  readonly cwd: string;
  /** Each Node.js executable that will run there, absolute. */
  readonly executables: readonly string[];
}

/** One verification of H-1's isolation (`verifyStagingIsolation`). */
export interface StagingIsolation {
  /** The staging root, absolute. */
  readonly root: string;
  /** What the root is, for diagnoses (e.g. `the consumer project root`). */
  readonly role: string;
  /** Leads every diagnosis: the arm or step the verification serves. */
  readonly context: string;
  /** The mode every refusal names (helpers/permissions.ts). */
  readonly mode: StagingMode;
  /** The rule a refusal closes with: H-1's statement unless given. */
  readonly rule?: string;
  /** Whether the root refuses an entry named `node_modules` of its own too. */
  readonly nothingInstalledInRoot?: boolean;
  /** The Node.js runs on the staging, if any: the global half's inputs. */
  readonly run?: StagedNodeRun;
}

type Unmet = (detail: string) => HarnessStagingError;

/**
 * Verify H-1's isolation of a staging (module header): no ancestor directory
 * of `root` holds an entry named `package.json` or `node_modules`, the root
 * itself none named `node_modules` where `nothingInstalledInRoot` is set,
 * and, where `run` is given, none of Node.js's global module folders under
 * its environment, for its executables, holds an entry. Resolves when every
 * half asked for is verified; otherwise throws `HarnessStagingError` of
 * `mode` naming the offending entry or what left a half unverified. Runs no
 * product.
 */
export async function verifyStagingIsolation(
  isolation: StagingIsolation,
): Promise<void> {
  const rule = isolation.rule ?? STAGING_ISOLATION_RULE;
  const unmet: Unmet = (detail) =>
    new HarnessStagingError(
      isolation.mode,
      isolation.root,
      `${isolation.context}: H-1's isolation of ${isolation.role} is unmet ` +
        `— ${detail}; ${rule}`,
    );
  if (!path.isAbsolute(isolation.root)) {
    throw unmet(
      `the staging root must be an absolute path, got ` +
        JSON.stringify(isolation.root),
    );
  }
  await guardStep(
    `verifying that nothing in or above ${isolation.role} ` +
      `${isolation.root} is read as a manifest or an installed package ` +
      `(${isolation.context})`,
    () => verifyAncestorHalf(isolation, unmet),
  );
  const run = isolation.run;
  if (run !== undefined) {
    await guardStep(
      `verifying that none of Node.js's global module folders holds a ` +
        `package for a run on ${isolation.root} (${isolation.context})`,
      () => verifyGlobalHalf(run, unmet),
    );
  }
}

/** The ancestor half, and the root's own `node_modules` (module header). */
async function verifyAncestorHalf(
  isolation: StagingIsolation,
  unmet: Unmet,
): Promise<void> {
  const { root } = isolation;
  if (isolation.nothingInstalledInRoot === true) {
    const entry = path.join(root, NODE_MODULES_NAME);
    const stats = await examineEntry(entry, unmet);
    if (stats !== undefined) {
      throw unmet(
        `${isolation.role} ${root} itself holds an entry named ` +
          `${NODE_MODULES_NAME} (${entryKind(stats)}, ${entry}), though ` +
          `nothing is installed in it or above it (TEST-SPEC T13.1-2)`,
      );
    }
  }
  for (const ancestor of await ancestorDirectories(root, unmet)) {
    for (const name of [PACKAGE_MANIFEST_NAME, NODE_MODULES_NAME]) {
      const entry = path.join(ancestor, name);
      const stats = await examineEntry(entry, unmet);
      if (stats !== undefined) {
        throw unmet(
          `the ancestor directory ${ancestor} holds an entry named ${name} ` +
            `(${entryKind(stats)}, ${entry}), ${READ_ABOVE[name] ?? ""}`,
        );
      }
    }
  }
}

/** The global half (module header). */
async function verifyGlobalHalf(
  run: StagedNodeRun,
  unmet: Unmet,
): Promise<void> {
  for (const folder of await globalFolders(run, unmet)) {
    await judgeGlobalFolder(folder, unmet);
  }
}

/**
 * Node.js's global module folders for `run`, each once, in the order its
 * CommonJS resolver searches them after the `node_modules` directories
 * (Node.js's documented GLOBAL_FOLDERS, after `NODE_PATH`'s entries): the
 * `NODE_PATH` entries; `.node_modules` and `.node_libraries` under `HOME`
 * (`USERPROFILE` on Windows); `lib/node` under each executable's prefix, as
 * spelled and along its physical path.
 */
async function globalFolders(
  run: StagedNodeRun,
  unmet: Unmet,
): Promise<readonly string[]> {
  const windows = process.platform === "win32";
  const folders: string[] = [];
  const seen = new Set<string>();
  const add = (folder: string): void => {
    if (seen.has(folder)) return;
    seen.add(folder);
    folders.push(folder);
  };
  const nodePath = environmentValue(run.environment, "NODE_PATH", windows);
  for (const entry of (nodePath ?? "").split(path.delimiter)) {
    if (entry !== "") add(path.resolve(run.cwd, entry));
  }
  const home = environmentValue(
    run.environment,
    windows ? "USERPROFILE" : "HOME",
    windows,
  );
  if (home !== undefined && home !== "") {
    add(path.resolve(run.cwd, home, ".node_modules"));
    add(path.resolve(run.cwd, home, ".node_libraries"));
  }
  for (const executable of run.executables) {
    if (!path.isAbsolute(executable)) {
      throw unmet(
        `a Node.js executable that will run there must be named by an ` +
          `absolute path, got ${JSON.stringify(executable)}`,
      );
    }
    let physical: string;
    try {
      physical = await fsp.realpath(executable);
    } catch (error) {
      throw unmet(
        `the physical path of the Node.js executable ${executable} cannot ` +
          `be read (${describeError(error)}), so the global folder under ` +
          `its prefix goes unexamined`,
      );
    }
    for (const spelling of [path.resolve(executable), physical]) {
      const prefix = windows
        ? path.dirname(spelling)
        : path.dirname(path.dirname(spelling));
      add(path.join(prefix, "lib", "node"));
    }
  }
  return folders;
}

/**
 * A variable of `environment` as the run reads it: by its exact name, or on
 * Windows, whose environment names ignore case, by any spelling of it.
 */
function environmentValue(
  environment: Readonly<Record<string, string>>,
  name: string,
  windows: boolean,
): string | undefined {
  if (!windows) return environment[name];
  const key = Object.keys(environment).find(
    (candidate) => candidate.toUpperCase() === name,
  );
  return key === undefined ? undefined : environment[key];
}

/** One global folder: absent, no directory, or empty, or the half is unmet. */
async function judgeGlobalFolder(folder: string, unmet: Unmet): Promise<void> {
  let stats: Stats;
  try {
    stats = await fsp.stat(folder);
  } catch (error) {
    if (isAbsence(error)) return;
    throw unmet(
      `the examination of the global folder ${folder} failed ` +
        `(${describeError(error)}), so whether it holds a package is ` +
        `unverified`,
    );
  }
  if (!stats.isDirectory()) return;
  let names: string[];
  try {
    names = await fsp.readdir(folder);
  } catch (error) {
    throw unmet(
      `the listing of the global folder ${folder} failed ` +
        `(${describeError(error)}), so whether it holds a package is ` +
        `unverified`,
    );
  }
  if (names.length > 0) {
    throw unmet(
      `the global folder ${folder}, which Node.js's resolver searches for a ` +
        `bare specifier under the run's environment, holds ` +
        `${describeEntries(names)} — any entry there a module the resolver ` +
        `finds by its name — so the folder counts as holding a package`,
    );
  }
}

/**
 * The directories above `root`, nearest first: its parent up to the
 * filesystem root along the root as spelled, then along its physical path,
 * each directory once. A physical path that cannot be read leaves the
 * isolation unverified.
 */
async function ancestorDirectories(
  root: string,
  unmet: Unmet,
): Promise<readonly string[]> {
  let physical: string;
  try {
    physical = await fsp.realpath(root);
  } catch (error) {
    throw unmet(
      `the staging root's physical path cannot be read ` +
        `(${describeError(error)}), so the directories above it go ` +
        `unexamined`,
    );
  }
  const ancestors: string[] = [];
  const seen = new Set<string>();
  for (const start of [path.resolve(root), physical]) {
    let current = start;
    for (;;) {
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
      if (seen.has(current)) continue;
      seen.add(current);
      ancestors.push(current);
    }
  }
  return ancestors;
}

/**
 * `lstat` of `entry`: its stats, or `undefined` when it is absent (`ENOENT`,
 * `ENOTDIR`). Any other failure leaves the isolation unverified.
 */
async function examineEntry(
  entry: string,
  unmet: Unmet,
): Promise<Stats | undefined> {
  try {
    return await fsp.lstat(entry);
  } catch (error) {
    if (isAbsence(error)) return undefined;
    throw unmet(
      `the examination of ${entry} failed (${describeError(error)}), ` +
        `leaving it unverified`,
    );
  }
}

function isAbsence(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === "ENOENT" || code === "ENOTDIR";
}

/** The entries of a folder, for a diagnosis: the first few, by name. */
function describeEntries(names: readonly string[]): string {
  const sorted = [...names].sort();
  const shown = sorted.slice(0, 5).map((name) => JSON.stringify(name));
  const more = sorted.length - shown.length;
  return (
    `${sorted.length === 1 ? "the entry" : `${String(sorted.length)} entries,`} ` +
    shown.join(", ") +
    (more > 0 ? `, and ${String(more)} more` : "")
  );
}

function entryKind(stats: Stats): string {
  if (stats.isSymbolicLink()) return "a symbolic link";
  if (stats.isDirectory()) return "a directory";
  if (stats.isFile()) return "a plain file";
  return "an entry of another kind";
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
