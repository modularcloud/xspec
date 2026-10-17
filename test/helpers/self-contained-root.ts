// H-1's ancestor precondition (TEST-SPEC H-1, H-11, H-9; CERTIFICATIONS.md
// §CONF-CORE's staging constraint on T13.5-8's baseline arms). Harness
// machinery only: this module never imports product code and runs no
// product.
//
// TEST-SPEC H-1: self-containment reaches above the workspace wherever an
// arm turns on it — an arm presuming nothing above its staging root (a
// failed upward search and its `.` concerned path, or a workspace directory
// that is no repository and lies inside none) runs only once the harness has
// verified, under the environment it runs the product in, that no ancestor
// of that root holds an entry named `xspec.config.ts` and that the root
// lies inside no git working tree; an unmet precondition is a harness error
// (H-11), never a pass, a product failure, or a skip (H-9).
// `assertSelfContainedRoot` is that verification, one check for every such
// arm, both halves always, called before the arm's first product invocation
// on the root it judges:
//
// - The configuration half: every ancestor directory of the root — its
//   parent up to the filesystem root, along the root as spelled and along
//   its physical path alike (a product's upward search may walk either: up
//   from the working directory its process holds, or up a spelling of it;
//   SPEC 7), each directory once — holds no entry named `xspec.config.ts` of
//   any kind, judged by `lstat`: a plain file, a directory, or a symbolic
//   link, a dangling one included (SPEC 7's search stops at the nearest
//   entry of that name, whatever occupies it). An examination that fails —
//   the root's physical path unreadable, an entry's examination refused —
//   leaves the half unverified (a product's search meeting a refused
//   examination reports a read failure, never absence: T7-1, T14-10(k)), an
//   unmet precondition too. The root itself is the arm's own staging — the
//   `xspec.config.ts` it declares, or none — and so are the directories
//   between a nested working directory and the root (T12.7-3's
//   `nested/inner`): only the directories above the root are judged.
// - The repository half: git itself judges whether the root lies inside a
//   working tree — `git -C <root> rev-parse --show-toplevel` — under the
//   environment the subprocess driver gives the product
//   (`productEnvironment`, helpers/subprocess.ts: ambient `GIT_*` dropped,
//   the isolated git configuration pinned, the binding's own environment
//   merged), with the locale alone pinned to `C`, so that git's answer
//   reads the same on every machine (no locale variable bears on
//   discovery). Only git's positive answer that no repository encloses the
//   root ("not a git repository") verifies the half; a working tree found
//   is named, and every other answer — git refusing a repository it finds,
//   the root inside a repository's git directory, a missing root, git
//   missing from PATH — leaves it unverified.
// - An unmet precondition throws `HarnessStagingError` (mode
//   `self-contained-root`, helpers/permissions.ts) naming the offending
//   entry or working tree, or what left a half unverified — never a
//   `HarnessAssertionError`: nothing here is a product verdict. A `git`
//   killed at its guard is that harness step's tripped guard
//   (`HarnessStepTimeoutError`, helpers/step-guards.ts), never a verdict
//   either way.

import { execFile } from "node:child_process";
import type { Stats } from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { promisify } from "node:util";
import { HarnessStagingError } from "./permissions.js";
import { execFileGuardTrip } from "./step-guards.js";
import type { ProductBinding } from "./subprocess.js";
import { productEnvironment } from "./subprocess.js";

const execFileAsync = promisify(execFile);

/** The entry name SPEC 7's upward search stops at. */
export const CONFIGURATION_FILE_NAME = "xspec.config.ts";

/**
 * The guard of the repository half's `git rev-parse` (TEST-SPEC S-3: a
 * harness step's own guard, helpers/step-guards.ts): `execFile`'s timeout,
 * which kills it — the 60 s the builder's own git steps take
 * (helpers/workspace.ts).
 */
const GIT_STEP_GUARD_MS = 60_000;

/** Git's answer, under the C locale, that no repository encloses a path. */
const NO_REPOSITORY_ANSWER = /^fatal: not a git repository\b/m;

const PRECONDITION =
  "an arm presuming nothing above its staging root runs only once the " +
  "harness has verified, under the environment it runs the product in, " +
  "that no ancestor of the root holds an entry named xspec.config.ts and " +
  "that the root lies inside no git working tree — a harness error, never " +
  "a pass, a product failure, or a skip (TEST-SPEC H-1, H-11, H-9)";

/**
 * Verify H-1's ancestor precondition for the staging root `root` (absolute)
 * of an arm presuming nothing above it, under the environment the driver
 * gives `product` (module header): no ancestor directory of `root` holds an
 * entry named `xspec.config.ts`, and `root` lies inside no git working tree.
 * Resolves when both halves are verified; otherwise throws
 * `HarnessStagingError` (mode `self-contained-root`) naming the offending
 * entry or working tree, or what left a half unverified, `context` leading
 * its detail. Runs no product.
 */
export async function assertSelfContainedRoot(
  product: ProductBinding,
  root: string,
  context: string,
): Promise<void> {
  const unmet = (detail: string): HarnessStagingError =>
    new HarnessStagingError(
      "self-contained-root",
      root,
      `${context}: H-1's ancestor precondition is unmet — ${detail}; ` +
        PRECONDITION,
    );
  if (!path.isAbsolute(root)) {
    throw unmet(
      `the staging root must be an absolute path, got ${JSON.stringify(root)}`,
    );
  }
  for (const ancestor of await ancestorDirectories(root, unmet)) {
    await judgeAncestor(ancestor, unmet);
  }
  await judgeWorkingTree(product, root, context, unmet);
}

type Unmet = (detail: string) => HarnessStagingError;

/**
 * The directories above `root`, nearest first: its parent up to the
 * filesystem root along the root as spelled, then along its physical path,
 * each directory once (module header).
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
      `the staging root's physical path cannot be read (${describeError(error)}), ` +
        `so the directories above it go unexamined`,
    );
  }
  const ancestors: string[] = [];
  const seen = new Set<string>();
  for (const start of [path.resolve(root), physical]) {
    let dir = start;
    for (;;) {
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
      if (seen.has(dir)) continue;
      seen.add(dir);
      ancestors.push(dir);
    }
  }
  return ancestors;
}

/** The configuration half at one ancestor directory (module header). */
async function judgeAncestor(ancestor: string, unmet: Unmet): Promise<void> {
  const entry = path.join(ancestor, CONFIGURATION_FILE_NAME);
  let stats: Stats;
  try {
    stats = await fsp.lstat(entry);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw unmet(
      `the examination of ${entry} failed (${describeError(error)}), so ` +
        `whether the ancestor directory ${ancestor} holds an entry named ` +
        `${CONFIGURATION_FILE_NAME} is unverified — a product's upward ` +
        `search meeting a refused examination reports a read failure, never ` +
        `absence (SPEC 7; TEST-SPEC T7-1, T14-10(k))`,
    );
  }
  throw unmet(
    `the ancestor directory ${ancestor} holds an entry named ` +
      `${CONFIGURATION_FILE_NAME} (${entryKind(stats)}, ${entry}), at which ` +
      `a product's upward search from the root stops, whatever occupies it ` +
      `(SPEC 7)`,
  );
}

/** The repository half: git's own judgement (module header). */
async function judgeWorkingTree(
  product: ProductBinding,
  root: string,
  context: string,
  unmet: Unmet,
): Promise<void> {
  const args = ["-C", root, "rev-parse", "--show-toplevel"];
  const command = `git ${args.join(" ")}`;
  const env = { ...productEnvironment(product), LC_ALL: "C" };
  let toplevel: string;
  try {
    const { stdout } = await execFileAsync("git", args, {
      env,
      timeout: GIT_STEP_GUARD_MS,
    });
    toplevel = stdout.trim();
  } catch (error) {
    const tripped = execFileGuardTrip(
      `${context}: H-1's precondition check \`${command}\``,
      GIT_STEP_GUARD_MS,
      error,
    );
    if (tripped !== undefined) throw tripped;
    const failure = error as {
      readonly code?: unknown;
      readonly stderr?: unknown;
    };
    if (failure.code === "ENOENT") {
      throw unmet(
        `\`${command}\` could not be run — git is not on PATH ` +
          `(${describeError(error)}; AGENTS.md: running tests requires the ` +
          `system git) — so whether the root lies inside a git working tree ` +
          `is unverified`,
      );
    }
    const stderr = typeof failure.stderr === "string" ? failure.stderr : "";
    if (NO_REPOSITORY_ANSWER.test(stderr)) return;
    throw unmet(
      `\`${command}\` answered neither a working tree nor that no ` +
        `repository encloses the root (${describeExit(failure.code)}, ` +
        `standard error ${JSON.stringify(stderr.trim())}), so whether the ` +
        `root lies inside a git working tree is unverified`,
    );
  }
  throw unmet(
    `the root lies inside the git working tree ${toplevel}, as git judges ` +
      `it under the environment the product runs in (\`${command}\`)`,
  );
}

function entryKind(stats: Stats): string {
  if (stats.isSymbolicLink()) return "a symbolic link";
  if (stats.isDirectory()) return "a directory";
  if (stats.isFile()) return "a plain file";
  return "an entry of another kind";
}

function describeExit(code: unknown): string {
  return typeof code === "number" ? `exit ${String(code)}` : String(code);
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
