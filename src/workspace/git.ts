// Read-only git invocation (SPEC 6.3; IMPLEMENTATION Key libraries: git
// baseline reads use the system `git` executable via read-only plumbing
// subcommands — no git library, no git write operations).
//
// The product's only git consumer is baseline reconstruction
// (./baseline.ts), and the only subcommands ever run are the plumbing
// readers `rev-parse`, `ls-tree`, and `cat-file`: nothing here writes to
// the repository, takes locks, or touches the index — the product treats
// git as a read-only content store.
//
// SPEC preamble: "xspec performs no network access", and git data is read
// locally alone. In a partial clone (`--filter=blob:none`, `tree:0`) those
// same readers would fetch an object missing locally from the promisor
// remote — a network access, and a write of the fetched pack into the
// repository — so every git spawned here runs with lazy fetching disabled
// (`GIT_NO_LAZY_FETCH=1`) and with no transport allowed: `GIT_ALLOW_PROTOCOL`
// set to the empty list, which overrides every `protocol.*` configuration
// and any inherited list, and `-c protocol.allow=never` beside it, for an
// environment that does not deliver the variable. A read of an object the
// repository does not hold then fails — the reader exits nonzero or
// answers `missing` — and the baseline is unreadable, the usage error of
// SPEC 6.3 and 12.0 (./baseline.ts), with no connection attempted and
// `.git` untouched.
//
// SPEC 6.3: the repository is the one whose working tree contains the
// current configuration file — the innermost — whatever repository the
// working directory lies in; and SPEC 12.0 admits no environment-dependent
// content in output or stored data. git, though, lets its environment
// choose the repository: `GIT_DIR` names one outright (git exports it to
// hooks, and `git submodule foreach` to its command), `GIT_WORK_TREE` and
// `GIT_COMMON_DIR` relocate its parts, `GIT_OBJECT_DIRECTORY` and its kin
// swap its stored data, configuration that `GIT_CONFIG_PARAMETERS` or the
// `GIT_CONFIG_COUNT` pairs carry reconfigures it (`core.useReplaceRefs`
// set false turns its replacement refs off, and with them the content
// read), and `GIT_CEILING_DIRECTORIES` stops discovery short of it. So
// every git spawned here runs without those variables — git's own list of
// the variables local to the repository (`git rev-parse --local-env-vars`)
// and the discovery controls, each compared case-insensitively — and with
// discovery crossing filesystem boundaries (`GIT_DISCOVERY_ACROSS_FILESYSTEM`
// set; git's default stops at one, while SPEC 6.3 names the repository by
// containment alone): the baseline's repository, ref resolution, tree
// listing, and blob reads are those of that innermost repository, the same
// whatever git variables the caller's environment holds. The variables
// naming git's own configuration files (`GIT_CONFIG_GLOBAL`,
// `GIT_CONFIG_SYSTEM`, `GIT_CONFIG_NOSYSTEM`) pass through with the rest of
// the caller's environment: they choose no repository.
//
// Diagnostics never render git's own stderr: its wording varies by git
// version and can carry absolute paths, both of which SPEC 12.0's
// byte-determinism rules exclude from output. Callers compose their own
// actionable messages from the failure kind.
//
// SPEC 6.3: the repository is the innermost whose working tree contains
// the current configuration file, and its discovery is git data, a refused
// read of which leaves the baseline unreadable. git's own discovery passes
// by a `.git` entry it is refused to examine — a check failing for want of
// permission reads to git as "no repository here" — and walks on upward, so
// an inner repository whose `.git` the environment refuses would silently
// yield to an enclosing one. `refusedDiscovery` closes that gap: it makes,
// on every `.git` entry git passed by on its way to the top level it
// reported, the reads git's discovery makes there, and reports the first
// one the environment refuses. It reads the filesystem only (Node's `fs`,
// on absolute paths, the same on every platform); git is not invoked.

import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
  isAbsenceFailure,
  isFilesystemFailure,
} from "./environment-refusal.js";

/**
 * SPEC preamble ("xspec performs no network access"), 6.3: what keeps a
 * spawned git from fetching (module header) — lazy fetching disabled, and
 * the empty list of allowed transports. The keys are spelled in upper case:
 * where the platform's environment names are case-insensitive, Node passes
 * the first of a name's spellings in sort order, and the upper-case one
 * sorts first.
 */
const NO_FETCH_ENVIRONMENT: Readonly<Record<string, string>> = {
  GIT_NO_LAZY_FETCH: "1",
  GIT_ALLOW_PROTOCOL: "",
};

/** SPEC preamble, 6.3: the transport guard git reads as configuration,
 * placed before the subcommand (module header). */
const NO_FETCH_ARGUMENTS: readonly string[] = ["-c", "protocol.allow=never"];

/**
 * SPEC 6.3, 12.0: the variables that select or relocate the repository, or
 * steer its discovery (module header), upper-cased — never passed to a
 * spawned git. First the variables git lists as local to the repository
 * (`git rev-parse --local-env-vars`, as of git 2.43.0), which name,
 * relocate, or configure it; then the discovery controls: a ceiling stops
 * the upward search short of the repository whose working tree contains
 * the configuration file, and so does a filesystem boundary unless
 * crossing is allowed (`DISCOVERY_ENVIRONMENT` allows it).
 */
const REPOSITORY_SELECTION_VARIABLES: ReadonlySet<string> = new Set([
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_CONFIG",
  "GIT_CONFIG_PARAMETERS",
  "GIT_CONFIG_COUNT",
  "GIT_OBJECT_DIRECTORY",
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_IMPLICIT_WORK_TREE",
  "GIT_GRAFT_FILE",
  "GIT_INDEX_FILE",
  "GIT_NO_REPLACE_OBJECTS",
  "GIT_REPLACE_REF_BASE",
  "GIT_PREFIX",
  "GIT_SHALLOW_FILE",
  "GIT_COMMON_DIR",
  "GIT_CEILING_DIRECTORIES",
  "GIT_DISCOVERY_ACROSS_FILESYSTEM",
]);

/** SPEC 6.3, 12.0: the configuration pairs `GIT_CONFIG_COUNT` indexes —
 * `GIT_CONFIG_KEY_<n>` and `GIT_CONFIG_VALUE_<n>` — upper-cased, dropped
 * with it (`REPOSITORY_SELECTION_VARIABLES`). */
const CONFIGURATION_PAIR_VARIABLE = /^GIT_CONFIG_(?:KEY|VALUE)_[0-9]+$/;

/**
 * SPEC 6.3, 12.0: whether the caller's variable `name` selects or relocates
 * the repository, or steers its discovery — dropped from a spawned git's
 * environment. Names are compared upper-cased, so a differently-cased
 * spelling goes too: where the platform's environment names are
 * case-insensitive, it is the same variable; elsewhere it is one git never
 * reads, and dropping it changes nothing.
 */
function selectsRepository(name: string): boolean {
  const upper = name.toUpperCase();
  return (
    REPOSITORY_SELECTION_VARIABLES.has(upper) ||
    CONFIGURATION_PAIR_VARIABLE.test(upper)
  );
}

/**
 * SPEC 6.3: discovery reaches the innermost repository whose working tree
 * contains the configuration file across a filesystem boundary too — git's
 * default stops there, and SPEC 6.3 names the repository by containment
 * alone — whatever the caller's environment says (module header). The key
 * is spelled in upper case, as `NO_FETCH_ENVIRONMENT`'s are.
 */
const DISCOVERY_ENVIRONMENT: Readonly<Record<string, string>> = {
  GIT_DISCOVERY_ACROSS_FILESYSTEM: "1",
};

/**
 * The environment for a spawned git (module header): the caller's, less
 * every variable that selects or relocates the repository or steers its
 * discovery (`selectsRepository`), with discovery crossing filesystem
 * boundaries (`DISCOVERY_ENVIRONMENT`) and with lazy fetching disabled and
 * no transport allowed (`NO_FETCH_ENVIRONMENT`), these set over any caller
 * value — so git reads the innermost repository whose working tree
 * contains the configuration file, whatever git variables the caller's
 * environment holds (SPEC 6.3, 12.0) — normalized for the platform: on
 * Windows, a `GIT_CONFIG_GLOBAL` naming the null device by Node's spelling
 * (`os.devNull` = `\\.\nul`) is translated to `nul` — git accepts the
 * classic device name (and `/dev/null`) where a configuration file path is
 * expected, but its config access dies on the `\\.\nul` spelling, which
 * would fail every git invocation with an unrelated fatal error. The
 * intent of such a value — read no global configuration — is preserved
 * exactly. Beyond these, the caller's environment applies as is, the
 * variables naming git's own configuration files (`GIT_CONFIG_GLOBAL`,
 * `GIT_CONFIG_SYSTEM`, `GIT_CONFIG_NOSYSTEM`) included: they choose no
 * repository.
 */
function gitEnvironment(): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (!selectsRepository(name)) environment[name] = value;
  }
  Object.assign(environment, DISCOVERY_ENVIRONMENT, NO_FETCH_ENVIRONMENT);
  if (
    process.platform === "win32" &&
    process.env["GIT_CONFIG_GLOBAL"] === os.devNull
  ) {
    environment["GIT_CONFIG_GLOBAL"] = "nul";
  }
  return environment;
}

/** The outcome of one git invocation. */
export type GitResult =
  | { readonly ok: true; readonly stdout: Buffer }
  | {
      readonly ok: false;
      /**
       * `unavailable`: the `git` executable could not be started at all
       * (not installed, not on PATH). `failed`: git ran and exited
       * nonzero — for the plumbing readers used here, the queried object
       * or repository state does not exist or cannot be read, an object a
       * partial clone does not hold locally included (never fetched).
       */
      readonly kind: "unavailable" | "failed";
    };

/**
 * Run one read-only git plumbing command with the given working directory,
 * feeding `stdin` when given (the `cat-file --batch` protocol) and
 * capturing standard output as exact bytes. git never fetches: lazy
 * fetching is disabled and no transport is allowed (module header), so an
 * object the repository does not hold fails the command. Standard error is
 * discarded (see the module header). Never throws for git-level failures —
 * only for harness-level stream errors Node itself raises.
 */
export function runGit(
  cwd: string,
  args: readonly string[],
  stdin?: Buffer,
): Promise<GitResult> {
  return new Promise((resolve) => {
    const child = spawn("git", [...NO_FETCH_ARGUMENTS, ...args], {
      cwd,
      env: gitEnvironment(),
      stdio: ["pipe", "pipe", "ignore"],
      windowsHide: true,
    });
    const chunks: Buffer[] = [];
    let settled = false;
    const settle = (result: GitResult): void => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };
    child.on("error", () => {
      // Spawn failure (ENOENT and kin): git never ran.
      settle({ ok: false, kind: "unavailable" });
    });
    child.stdout.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    child.on("close", (code) => {
      settle(
        code === 0
          ? { ok: true, stdout: Buffer.concat(chunks) }
          : { ok: false, kind: "failed" },
      );
    });
    // A process that exits before consuming its input surfaces EPIPE on
    // the stdin stream; swallow it — the exit code alone decides.
    child.stdin.on("error", () => {});
    child.stdin.end(stdin);
  });
}

/**
 * A read of git's discovery the environment refused (SPEC 6.3): the path
 * read, relative to the workspace root and `/`-joined (`.git/HEAD`,
 * `../.git`) — never absolute (SPEC 12.0) — and the filesystem's error code
 * (`EACCES`, …), never its message.
 */
export interface DiscoveryRefusal {
  readonly path: string;
  readonly code: string;
}

/** One examination read: what it found, or that it found nothing, or the
 * refusal it met. */
type Examined<T> =
  | { readonly kind: "found"; readonly value: T }
  | { readonly kind: "absent" }
  | { readonly kind: "refused"; readonly refusal: DiscoveryRefusal };

/**
 * Make one read of the examination. Absence (SPEC 14.25: an object's
 * nonexistence is never a refusal) and a refusal — any other failure the
 * filesystem reports — are outcomes; a defect of the product's own
 * propagates unchanged.
 */
async function examine<T>(
  spelled: string,
  reading: () => Promise<T>,
): Promise<Examined<T>> {
  try {
    return { kind: "found", value: await reading() };
  } catch (error) {
    if (isAbsenceFailure(error)) return { kind: "absent" };
    if (isFilesystemFailure(error)) {
      const code = error.code ?? "an unknown error";
      return { kind: "refused", refusal: { path: spelled, code } };
    }
    throw error;
  }
}

/** How much of `HEAD` or a gitfile the examination reads: whether the read
 * is permitted is all it learns, so the file's opening suffices. */
const OPENING_BYTES = 256;

/** Open a plain file and read its opening — the read git's discovery
 * makes of `HEAD` and of a gitfile; the content is not judged. */
async function readOpening(file: string): Promise<void> {
  const handle = await fsp.open(file, "r");
  try {
    await handle.read(Buffer.alloc(OPENING_BYTES), 0, OPENING_BYTES, 0);
  } finally {
    await handle.close();
  }
}

/**
 * A repository directory's object store or refs directory, as git's
 * discovery examines it: its kind, then its search permission. Found when
 * it is a directory git may search; absent when nothing — or no directory —
 * is there, no repository being there then.
 */
async function examineSearchable(
  directory: string,
  spelled: string,
): Promise<Examined<true>> {
  const stats = await examine(spelled, () => fsp.stat(directory));
  if (stats.kind !== "found") return stats;
  if (!stats.value.isDirectory()) return { kind: "absent" };
  return examine(spelled, async () => {
    await fsp.access(directory, fsp.constants.X_OK);
    return true as const;
  });
}

/**
 * Examine one `.git` entry git's discovery passed by (SPEC 6.3), making
 * the reads git makes there, in its order: the entry's kind (a symbolic
 * link followed); a plain file's — a gitfile's — opening; a directory's
 * `HEAD` (a symbolic link's target, a plain file's opening), then its
 * `objects` and `refs` directories' kinds and search permission. Absence of
 * any of them ends the examination — no repository there, by git's own
 * judgement — and so does an entry of any other kind; no content is
 * judged. Returns the first read the environment refuses, or undefined.
 */
async function examineGitEntry(
  entry: string,
  spelled: string,
): Promise<DiscoveryRefusal | undefined> {
  const linkStats = await examine(spelled, () => fsp.lstat(entry));
  if (linkStats.kind === "refused") return linkStats.refusal;
  if (linkStats.kind === "absent") return undefined;
  let stats = linkStats.value;
  if (stats.isSymbolicLink()) {
    const followed = await examine(spelled, () => fsp.stat(entry));
    if (followed.kind === "refused") return followed.refusal;
    if (followed.kind === "absent") return undefined;
    stats = followed.value;
  }
  if (stats.isFile()) {
    const opening = await examine(spelled, () => readOpening(entry));
    return opening.kind === "refused" ? opening.refusal : undefined;
  }
  if (!stats.isDirectory()) return undefined;

  const head = path.join(entry, "HEAD");
  const headSpelled = `${spelled}/HEAD`;
  const headStats = await examine(headSpelled, () => fsp.lstat(head));
  if (headStats.kind === "refused") return headStats.refusal;
  if (headStats.kind === "absent") return undefined;
  let headRead: Examined<unknown>;
  if (headStats.value.isSymbolicLink()) {
    headRead = await examine(headSpelled, () => fsp.readlink(head));
  } else if (headStats.value.isFile()) {
    headRead = await examine(headSpelled, () => readOpening(head));
  } else {
    return undefined;
  }
  if (headRead.kind === "refused") return headRead.refusal;
  if (headRead.kind === "absent") return undefined;

  for (const name of ["objects", "refs"]) {
    const examined = await examineSearchable(
      path.join(entry, name),
      `${spelled}/${name}`,
    );
    if (examined.kind === "refused") return examined.refusal;
    if (examined.kind === "absent") return undefined;
  }
  return undefined;
}

/**
 * SPEC 6.3: confirm git's discovery of the repository whose working tree
 * contains the configuration file — the innermost, never an enclosing one
 * reached past a `.git` the environment refused git to examine. `root` is
 * the workspace root (absolute), the directory git was run in; `levels` is
 * the number of directories from it upward that lie strictly below the top
 * level git reported — `rev-parse --show-prefix`'s segment count, so no
 * path spellings are compared. git discovers from its physical working
 * directory, so the walk starts at the root's real path; in each of those
 * directories the `.git` entry, where one exists, is one git passed by, and
 * is examined as git's discovery examines it (`examineGitEntry`). Returns
 * the first read the environment refuses — the repository's discovery
 * refused, which leaves the baseline unreadable (6.3) — or undefined when
 * every such entry examines cleanly: no repository there, by git's own
 * judgement. A failed real-path resolution of the root, the directory git
 * has just run in, leaves the discovery unconfirmed: it is reported as
 * that refusal, concerning the root (`.`). Reads only; modifies nothing.
 */
export async function refusedDiscovery(
  root: string,
  levels: number,
): Promise<DiscoveryRefusal | undefined> {
  if (levels === 0) return undefined;
  let directory: string;
  try {
    directory = await fsp.realpath(root);
  } catch (error) {
    if (!isFilesystemFailure(error)) throw error;
    return { path: ".", code: error.code ?? "an unknown error" };
  }
  for (let level = 0; level < levels; level += 1) {
    const refusal = await examineGitEntry(
      path.join(directory, ".git"),
      `${"../".repeat(level)}.git`,
    );
    if (refusal !== undefined) return refusal;
    const parent = path.dirname(directory);
    if (parent === directory) break; // the filesystem root
    directory = parent;
  }
  return undefined;
}
