// E-1's Node.js releases, read on the harness side (TEST-SPEC E-1, H-11,
// H-9, S-10; H-2's module channel; SPEC 7.6; T7.6-6, T7.6-7, P-17). Harness
// machinery only: this module never imports product code, and it runs
// nothing — neither the product nor a release.
//
// TEST-SPEC E-1: the Node.js releases on which the module channel loads the
// `defineConfig` module are each provisioned by the environment before the
// run — in CI, at setup — beside the one the suite runs on, and no test
// downloads a runtime; a listed release the environment has not provisioned
// is a harness error (H-11) for every run needing it, never a skip (H-9)
// and never a product failure. The list follows E-1's rule and is pinned by
// exact version, so consecutive runs exercise the same releases (E-5).
//
// - The list: `test/node-releases.json` is the one copy of it that CI's
//   provisioning (.github/scripts/provision-node-releases.sh) and the
//   harness both read, so the releases provisioned and the releases
//   exercised cannot drift. The harness finds it relative to this module,
//   never to the working directory ({@link NODE_RELEASE_LIST_PATH}), and
//   reads it strictly ({@link parseNodeReleaseList}): one JSON object
//   holding a `releases` array of exact `major.minor.patch` versions — each
//   part a decimal numeral without a leading zero, nothing before or after
//   — at least one, none listed twice, beside which only a string
//   `comment` may stand. Anything else is {@link NodeReleaseError} of fault
//   `list`, naming the list's path: never a shorter list, a skipped
//   release, or a default.
// - The releases: the directory the environment variable
//   `XSPEC_NODE_RELEASES_DIR` names holds each release as the provisioning
//   script installs it, its executable at `<directory>/v<version>/bin/node`.
//   {@link resolveNodeRelease} resolves one listed release there, and
//   {@link resolveNodeReleases} every one, in list order. The variable is
//   read by the call resolving a release — when a run needs one, never when
//   this module is imported — so a test needing no release never fails for
//   its absence. The variable unset, empty, not an absolute path, or naming
//   no directory is {@link NodeReleaseError} of fault `directory`, naming
//   the variable (and the path looked at); a listed release whose executable
//   is absent there, not a file, or not executable by this process is one of
//   fault `release`, naming each such release and the path looked at; and a
//   version the list does not hold is refused (fault `list`), so no run
//   exercises a release E-1 does not list.
// - Each such error is a harness error (H-11): never a
//   `HarnessAssertionError`, so never a diagnosed product failure; thrown,
//   never an empty answer or a skip; and let through unchanged by every
//   helper converting a run's rejection into a diagnosed failure
//   (`rethrowHarnessError`, helpers/subprocess.ts).
// - Whether an executable is the release its directory names — the version
//   the running process reports — is S-10's check, made by running it; this
//   module runs nothing.
// - Reading the list and examining the directory are harness steps, each
//   under its own guard (TEST-SPEC S-3, helpers/step-guards.ts).

import type { Stats } from "node:fs";
import { constants as fsConstants } from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { guardStep } from "./step-guards.js";

/** The environment variable naming the directory of E-1's releases. */
export const NODE_RELEASES_DIR_VARIABLE = "XSPEC_NODE_RELEASES_DIR";

/**
 * `test/node-releases.json`, E-1's list: found relative to this module,
 * never to the working directory (module header).
 */
export const NODE_RELEASE_LIST_PATH = fileURLToPath(
  new URL("../node-releases.json", import.meta.url),
);

/**
 * What a {@link NodeReleaseError} found wanting: E-1's list itself, or a
 * version it does not hold (`list`); the variable naming the releases'
 * directory, or that directory (`directory`); or a listed release's
 * executable there (`release`).
 */
export type NodeReleaseFault = "list" | "directory" | "release";

/** E-1's rule, closing every {@link NodeReleaseError}. */
const PROVISIONING_RULE =
  "E-1's Node.js releases, those test/node-releases.json lists, are " +
  "provisioned by the environment before the run, each release's " +
  "executable at <directory>/v<version>/bin/node where " +
  `${NODE_RELEASES_DIR_VARIABLE} names <directory> (in CI at setup; ` +
  "locally with .github/scripts/provision-node-releases.sh <directory>, " +
  "AGENTS.md); a listed release the environment has not provisioned is a " +
  "harness error for every run needing it, never a skip and never a " +
  "product failure (TEST-SPEC E-1, H-11, H-9)";

/**
 * E-1's list unreadable or malformed, a version it does not hold, the
 * releases' directory unnamed or unusable, or a listed release not
 * provisioned there (module header): a harness error (H-11), never a
 * `HarnessAssertionError` — so never a diagnosed product failure — and
 * never a skip (H-9).
 */
export class NodeReleaseError extends Error {
  /** What was found wanting ({@link NodeReleaseFault}). */
  readonly fault: NodeReleaseFault;
  /**
   * The releases it names: each listed release found unprovisioned (fault
   * `release`), or each version refused as unlisted; empty otherwise.
   */
  readonly releases: readonly string[];

  constructor(
    fault: NodeReleaseFault,
    detail: string,
    releases: readonly string[] = [],
  ) {
    super(`harness error (H-11): ${detail}; ${PROVISIONING_RULE}`);
    this.name = "NodeReleaseError";
    this.fault = fault;
    this.releases = Object.freeze([...releases]);
  }
}

/** One release E-1 lists, where the environment provisioned it. */
export interface NodeRelease {
  /** Its exact version, as listed (`22.0.0`). */
  readonly version: string;
  /**
   * Its executable, absolute, as spelled from the variable's directory:
   * `<XSPEC_NODE_RELEASES_DIR>/v<version>/bin/node`.
   */
  readonly executable: string;
}

/** Where releases are looked for ({@link resolveNodeReleases}). */
export interface NodeReleaseLookup {
  /**
   * The environment `XSPEC_NODE_RELEASES_DIR` is read from, when the call
   * runs: `process.env` unless given.
   */
  readonly environment?: Readonly<Record<string, string | undefined>>;
  /** E-1's list: {@link NODE_RELEASE_LIST_PATH} unless given. */
  readonly listPath?: string;
}

/** The list's own keys (module header): `releases`, and `comment` beside. */
const LIST_KEYS: readonly string[] = ["comment", "releases"];

/** An exact version: three decimal numerals, none with a leading zero. */
const EXACT_VERSION =
  /^(?:0|[1-9][0-9]*)[.](?:0|[1-9][0-9]*)[.](?:0|[1-9][0-9]*)$/;

/**
 * Read E-1's list from its text `text`, as found at `source` (module
 * header): the listed versions, in list order. Anything but the list's
 * exact shape throws {@link NodeReleaseError} of fault `list` naming
 * `source`.
 */
export function parseNodeReleaseList(
  text: string,
  source: string,
): readonly string[] {
  const refused = (detail: string): NodeReleaseError =>
    new NodeReleaseError("list", `E-1's release list ${source} ${detail}`);
  let list: unknown;
  try {
    list = JSON.parse(text);
  } catch (error) {
    throw refused(`is not JSON (${describeError(error)})`);
  }
  if (typeof list !== "object" || list === null || Array.isArray(list)) {
    throw refused(`holds ${describeJson(list)}, not a JSON object`);
  }
  const record = list as Readonly<Record<string, unknown>>;
  for (const key of Object.keys(record)) {
    if (!LIST_KEYS.includes(key)) {
      throw refused(
        `holds the key ${JSON.stringify(key)}, beside which only ` +
          `"releases" and "comment" may stand`,
      );
    }
  }
  if ("comment" in record && typeof record["comment"] !== "string") {
    throw refused(
      `holds ${describeJson(record["comment"])} as its "comment", not a ` +
        `string`,
    );
  }
  if (!("releases" in record)) throw refused(`holds no "releases"`);
  const releases = record["releases"];
  if (!Array.isArray(releases)) {
    throw refused(
      `holds ${describeJson(releases)} as its "releases", not an array`,
    );
  }
  if (releases.length === 0) throw refused(`lists no release`);
  const versions: string[] = [];
  for (const [index, release] of (releases as readonly unknown[]).entries()) {
    if (typeof release !== "string" || !EXACT_VERSION.test(release)) {
      throw refused(
        `lists ${describeJson(release)} as release ${String(index + 1)}, ` +
          `not an exact major.minor.patch version`,
      );
    }
    if (versions.includes(release)) {
      throw refused(`lists the release ${release} twice`);
    }
    versions.push(release);
  }
  return Object.freeze(versions);
}

/**
 * Read E-1's list at `listPath` ({@link NODE_RELEASE_LIST_PATH} unless
 * given; module header), one harness step under its own guard: the listed
 * versions, in list order, or {@link NodeReleaseError} of fault `list`.
 */
export async function readNodeReleaseList(
  listPath: string = NODE_RELEASE_LIST_PATH,
): Promise<readonly string[]> {
  return guardStep(`reading E-1's release list ${listPath}`, async () => {
    let text: string;
    try {
      text = await fsp.readFile(listPath, "utf8");
    } catch (error) {
      throw new NodeReleaseError(
        "list",
        `E-1's release list ${listPath} cannot be read ` +
          `(${describeError(error)})`,
      );
    }
    return parseNodeReleaseList(text, listPath);
  });
}

/**
 * Resolve the listed release `version` where the environment provisioned
 * it (module header), for a run needing it: reads E-1's list and the
 * variable now. Throws {@link NodeReleaseError} — fault `list` for a version
 * the list does not hold, `directory` for the variable or its directory,
 * `release` for the release's executable — never an empty answer.
 */
export async function resolveNodeRelease(
  version: string,
  lookup: NodeReleaseLookup = {},
): Promise<NodeRelease> {
  const [release] = await resolveVersions([version], lookup);
  return release;
}

/**
 * Resolve every release E-1 lists where the environment provisioned it, in
 * list order (module header), for runs needing them all: reads E-1's list
 * and the variable now. Throws {@link NodeReleaseError} — fault `directory`
 * for the variable or its directory, `release` naming each listed release
 * whose executable is not provisioned there — never a shorter list.
 */
export async function resolveNodeReleases(
  lookup: NodeReleaseLookup = {},
): Promise<readonly NodeRelease[]> {
  return resolveVersions(null, lookup);
}

/** Resolve `wanted` (every listed release where null), in its own order. */
async function resolveVersions(
  wanted: readonly string[] | null,
  lookup: NodeReleaseLookup,
): Promise<readonly NodeRelease[]> {
  const listPath = lookup.listPath ?? NODE_RELEASE_LIST_PATH;
  const listed = await readNodeReleaseList(listPath);
  const versions = wanted ?? listed;
  const unlisted = versions.filter((version) => !listed.includes(version));
  if (unlisted.length > 0) {
    throw new NodeReleaseError(
      "list",
      `${describeReleases(unlisted)} ${isOrAre(unlisted)} not listed in ` +
        `E-1's release list ` +
        `${listPath} (${listed.join(", ")}): no run exercises a release ` +
        `E-1 does not list`,
      unlisted,
    );
  }
  const needed = describeReleases(versions);
  const directory = releasesDirectory(
    lookup.environment ?? process.env,
    needed,
  );
  return guardStep(
    `resolving ${needed} under ${NODE_RELEASES_DIR_VARIABLE}=${directory}`,
    async () => {
      await examineDirectory(directory, needed);
      const releases: NodeRelease[] = [];
      const unprovisioned: string[] = [];
      const wanting: string[] = [];
      for (const version of versions) {
        const executable = path.join(directory, `v${version}`, "bin", "node");
        const problem = await examineExecutable(executable);
        if (problem === null) {
          releases.push(Object.freeze({ version, executable }));
        } else {
          unprovisioned.push(version);
          wanting.push(`${version}: ${executable} ${problem}`);
        }
      }
      if (unprovisioned.length > 0) {
        throw new NodeReleaseError(
          "release",
          `${describeReleases(unprovisioned)} ${isOrAre(unprovisioned)} ` +
            `not provisioned under ` +
            `${NODE_RELEASES_DIR_VARIABLE}=${directory} — ` +
            wanting.join("; "),
          unprovisioned,
        );
      }
      return Object.freeze(releases);
    },
  );
}

/**
 * The releases' directory, as the variable names it in `environment`: an
 * absolute path, or {@link NodeReleaseError} of fault `directory` naming
 * the variable.
 */
function releasesDirectory(
  environment: Readonly<Record<string, string | undefined>>,
  needed: string,
): string {
  const value = environment[NODE_RELEASES_DIR_VARIABLE];
  const refused = (detail: string): NodeReleaseError =>
    new NodeReleaseError(
      "directory",
      `${needed} cannot be found: ${NODE_RELEASES_DIR_VARIABLE} ${detail}`,
    );
  if (value === undefined) {
    throw refused(
      "is unset, so the environment provisioned no release for this run",
    );
  }
  if (value === "") {
    throw refused(
      "is empty, so the environment provisioned no release for this run",
    );
  }
  if (!path.isAbsolute(value)) {
    throw refused(
      `is ${JSON.stringify(value)}, not an absolute path: the ` +
        `directory of E-1's releases is never found from the working ` +
        `directory`,
    );
  }
  return value;
}

/**
 * Throw {@link NodeReleaseError} of fault `directory` unless `directory`
 * is a directory (a symbolic link to one followed).
 */
async function examineDirectory(
  directory: string,
  needed: string,
): Promise<void> {
  const refused = (detail: string): NodeReleaseError =>
    new NodeReleaseError(
      "directory",
      `${needed} cannot be found: ${NODE_RELEASES_DIR_VARIABLE}=` +
        `${directory} ${detail}`,
    );
  let stats: Stats;
  try {
    stats = await fsp.stat(directory);
  } catch (error) {
    throw refused(
      isAbsence(error)
        ? `names no directory (${describeError(error)})`
        : `names a directory that cannot be examined ` +
            `(${describeError(error)})`,
    );
  }
  if (!stats.isDirectory()) {
    throw refused(`names ${entryKind(stats)}, not a directory`);
  }
}

/**
 * What is wanting of a release's executable at `executable`, or null when
 * it is provisioned: a file (a symbolic link to one followed) this process
 * may execute.
 */
async function examineExecutable(executable: string): Promise<string | null> {
  let stats: Stats;
  try {
    stats = await fsp.stat(executable);
  } catch (error) {
    return isAbsence(error)
      ? `is absent (${describeError(error)})`
      : `cannot be examined (${describeError(error)})`;
  }
  if (!stats.isFile()) return `is ${entryKind(stats)}, not a file`;
  try {
    await fsp.access(executable, fsConstants.X_OK);
  } catch (error) {
    return `is not executable by this process (${describeError(error)})`;
  }
  return null;
}

/**
 * Releases, for a diagnosis: `the Node.js release 22.0.0`, or `the Node.js
 * releases 22.0.0, 24.22.2`.
 */
function describeReleases(versions: readonly string[]): string {
  return versions.length === 1
    ? `the Node.js release ${versions.join(", ")}`
    : `the Node.js releases ${versions.join(", ")}`;
}

/** The verb agreeing with {@link describeReleases}' subject. */
function isOrAre(versions: readonly string[]): string {
  return versions.length === 1 ? "is" : "are";
}

/** Whether `stat` failed for want of the entry: `ENOENT` or `ENOTDIR`. */
function isAbsence(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | null)?.code;
  return code === "ENOENT" || code === "ENOTDIR";
}

/** A filesystem entry's kind, for a diagnosis (`stat` followed links). */
function entryKind(stats: Stats): string {
  if (stats.isDirectory()) return "a directory";
  if (stats.isFIFO()) return "a FIFO";
  if (stats.isSocket()) return "a socket";
  if (stats.isBlockDevice()) return "a block device";
  if (stats.isCharacterDevice()) return "a character device";
  if (stats.isFile()) return "a file";
  return "an entry of another kind";
}

/** A JSON value, for a diagnosis. */
function describeJson(value: unknown): string {
  if (value === undefined) return "nothing";
  const text = JSON.stringify(value);
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

/** An error, for a diagnosis: its code where it has one, else its message. */
function describeError(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as NodeJS.ErrnoException).code;
    return typeof code === "string"
      ? `${code}: ${error.message}`
      : `${error.name}: ${error.message}`;
  }
  return String(error);
}
