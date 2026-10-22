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
 * The environment for a spawned git, normalized for the platform: on
 * Windows, a `GIT_CONFIG_GLOBAL` naming the null device by Node's spelling
 * (`os.devNull` = `\\.\nul`) is translated to `nul` — git accepts the
 * classic device name (and `/dev/null`) where a configuration file path is
 * expected, but its config access dies on the `\\.\nul` spelling, which
 * would fail every git invocation with an unrelated fatal error. The
 * intent of such a value — read no global configuration — is preserved
 * exactly; nothing else is changed (SPEC 6.3: git is a read-only content
 * store, and the caller's environment otherwise applies as is).
 */
function gitEnvironment(): NodeJS.ProcessEnv {
  if (
    process.platform === "win32" &&
    process.env["GIT_CONFIG_GLOBAL"] === os.devNull
  ) {
    return { ...process.env, GIT_CONFIG_GLOBAL: "nul" };
  }
  return process.env;
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
       * or repository state does not exist or cannot be read.
       */
      readonly kind: "unavailable" | "failed";
    };

/**
 * Run one read-only git plumbing command with the given working directory,
 * feeding `stdin` when given (the `cat-file --batch` protocol) and
 * capturing standard output as exact bytes. Standard error is discarded
 * (see the module header). Never throws for git-level failures — only for
 * harness-level stream errors Node itself raises.
 */
export function runGit(
  cwd: string,
  args: readonly string[],
  stdin?: Buffer,
): Promise<GitResult> {
  return new Promise((resolve) => {
    const child = spawn("git", args, {
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
