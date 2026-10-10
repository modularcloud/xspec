// Permission-based stagings of environment refusals (TEST-SPEC T14-9, T14-10,
// T13.5-7; E-1). Harness machinery only: no product imports, no test
// framework dependence.
//
// - T14-9 (write refusals): an environment refusal is staged by permission
//   removal alone — the directory holding the path made read-only and, where
//   the path is occupied, its occupant made unwritable — so that creation,
//   replacement in place or by renaming, appending, and removal are all
//   refused whatever write strategy the product uses (14.24 pins the effect,
//   never the mechanism). `stageWriteRefusal` is that discipline for one
//   path; `stageWriteRefusalUnder` applies it to every path beneath a
//   directory whose contents the harness does not know by name (graph data
//   under `.xspec`, the derived files under `specs/b/`) while leaving the
//   directory's own parent untouched, so a product's exclusivity state,
//   wherever in the workspace it keeps it, never meets the staging.
// - T14-10 (read refusals): a refused content read is the file's read
//   permission removed with its write permission kept (mode `-w-------`,
//   0o200), so a regeneration that replaces or rewrites the object is never
//   itself refused; a refused directory listing is the directory's read
//   permission removed with search kept (`--x------`, 0o100), so its entries
//   stay reachable by name. Nonexistence is never staged as a refusal, and
//   symbolic links and non-directory components are never involved: a
//   staging naming an absent, symlinked, or otherwise unstageable object is a
//   staging error, not a refusal.
// - E-1 self-verification: before returning, every staging verifies itself
//   in the harness's own process — its own attempt at the staged object must
//   be refused (`EACCES`/`EPERM`), and the permission it keeps must still be
//   granted — and reports an ineffective one as `HarnessStagingError`. That
//   error is deliberately NOT a `HarnessAssertionError` (H-8): a privileged
//   runner, whose CAP_DAC_OVERRIDE writes into a read-only directory and
//   reads a mode-0o200 file, is a harness error (H-11), never a diagnosed
//   product failure, a pass, or a skip (H-9). CI makes the runner
//   unprivileged through .github/scripts/run-without-network.sh; a root
//   sandbox reproduces its inner stage with
//   `unshare --map-user=<uid> --map-group=<gid> -- <command>` (AGENTS.md).
// - Names (SPEC 13.1, 13.3): the names in a product-written area are the
//   product's to choose — graph data under `.xspec`, a companion's suffix
//   under `specs/b` — and need be neither ASCII nor even valid UTF-8 (Linux).
//   So wherever a staging reaches entries the harness does not name (the
//   area form's walk, a listing refusal's by-name probe) it lists them as
//   raw bytes and acts on each at its exact byte path, never through a UTF-8
//   decode, which would misname such an entry and so skip or miss it; a
//   caller holding such a path passes it as bytes (`StagedPath`). A
//   diagnosis renders a path segment that is not valid UTF-8 as its hex.
// - Platform: the Linux leg's (E-1). On any other platform every staging
//   throws `HarnessStagingError` at once; the Linux-leg tests are never
//   selected into the Windows subset (E-6).
//
// Every staging records the modes it changes and returns a `restore()` that
// reinstates them (idempotent). The workspace builder's disposal chmods its
// tree writable before removal regardless, so a staging left unrestored by a
// failing test never blocks cleanup.

import { Buffer } from "node:buffer";
import { randomBytes } from "node:crypto";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

/**
 * The staging modes, named in every `HarnessStagingError`: the permission
 * stagings of this module, the workspace builder's S-9 derivability check
 * of a staged MDX source (`mdx-derivability`, helpers/workspace.ts), its
 * TypeScript check of a staged code source or configuration file
 * (`ts-derivability`, helpers/workspace.ts and helpers/ts-derivability.ts),
 * the builder's undeclared-staging guard (`undeclared-staging`: a plain `.mdx`
 * staging after a product invocation, which S-7's sweep never reaches and
 * so must be a staged-source record; helpers/workspace.ts,
 * helpers/product-invocations.ts), the lock-path leftover and
 * obstruction stagings (`lock-path-leftover`, helpers/lock-staging.ts: a
 * staged tree not reading back as declared, a permission removal on a
 * leftover file the harness's own read reaches, `mkfifo` failing, a platform
 * that is not the Linux leg's), and 13.5's machine-wide stagings
 * (helpers/machine-staging.ts; TEST-SPEC E-1, T13.5-9): the administrative
 * access they are made with (`administrative-access`: `sudo` missing,
 * refusing, or not silent), the second user (`second-user`: its creation, a
 * launch through it, or its verification failing), the shared group's
 * access to a workspace (`group-access`), and the second mount
 * (`second-mount`: not made, not verified, or not removed).
 */
export type StagingMode =
  | "write-refusal"
  | "write-refusal-under"
  | "read-refusal-of-file"
  | "read-refusal-of-directory"
  | "mdx-derivability"
  | "ts-derivability"
  | "undeclared-staging"
  | "lock-path-leftover"
  | "administrative-access"
  | "second-user"
  | "group-access"
  | "second-mount";

/**
 * An ineffective or impossible staging: a permission staging (E-1, H-11)
 * whose object the harness's own attempt reached unrefused (a privileged
 * runner), a kept permission not granted, an object that cannot be staged
 * (absent, symlinked, wrong kind), a platform that is not the Linux leg's —
 * or a staged MDX source contradicting its S-9 declaration (declared
 * well-formed yet rejected by the stock parser, or declared unparseable yet
 * deriving; helpers/workspace.ts), a staged code source or configuration
 * file contradicting its S-9 TypeScript declaration or accepted read one way
 * only (`ts-derivability`, helpers/workspace.ts), or an MDX source staged
 * with plain contents after a product invocation, outside the staged-source
 * ledger the S-9 self-test judges before any product exists
 * (`undeclared-staging`, helpers/workspace.ts), or a lock-path leftover or
 * obstruction staging that did not take effect as declared
 * (`lock-path-leftover`, helpers/lock-staging.ts), or one of 13.5's
 * machine-wide stagings not made or not verified — a runner withholding
 * administrative access among them (helpers/machine-staging.ts; E-1). Never a
 * `HarnessAssertionError`: nothing here is a product verdict — it is a
 * harness error, never a diagnosed product failure and never a skip.
 */
export class HarnessStagingError extends Error {
  readonly mode: StagingMode;
  /** The staged object's path: a path string as given, a byte path rendered. */
  readonly path: string;

  constructor(mode: StagingMode, stagedPath: string, detail: string) {
    super(`${mode} staging of ${stagedPath}: ${detail}`);
    this.name = "HarnessStagingError";
    this.mode = mode;
    this.path = stagedPath;
  }
}

/** A staging in effect: what it staged, and how to undo it. */
export interface PermissionStaging {
  readonly mode: StagingMode;
  /** The staged object as given: a path string, or its exact bytes. */
  readonly path: string | Buffer;
  /** Reinstate every recorded mode, in reverse order of change; idempotent. */
  restore(): Promise<void>;
}

/**
 * A path a staging takes, absolute: a path string (Node hands it to the
 * filesystem as UTF-8), or exact path bytes — the form for a name the
 * product chose that is not valid UTF-8 (module header: Names), e.g.
 * `TestWorkspace.bytePath`'s.
 */
export type StagedPath = string | Uint8Array;

/** A path as this module hands it to `fs`: a string, or exact bytes. */
type FsPath = string | Buffer;

const WRITE_BITS = 0o222;
const MODE_BITS = 0o7777;
const CONTENT_UNREADABLE = 0o200; // -w-------
const LISTING_UNREADABLE = 0o100; // --x------

const PRIVILEGED_HINT =
  "the harness's own attempt succeeded, so the staging is ineffective — a " +
  "privileged runner (E-1 requires an unprivileged identity: CI runs through " +
  ".github/scripts/run-without-network.sh; as root, run under " +
  "`unshare --map-user=<uid> --map-group=<gid>`, see AGENTS.md)";

interface ModeRecord {
  readonly path: FsPath;
  readonly mode: number;
}

const SLASH = 0x2f;

/** A staged path as `fs` takes it: a string as given, bytes as a `Buffer`. */
function toFsPath(target: StagedPath): FsPath {
  return typeof target === "string" ? target : Buffer.from(target);
}

/** A path's exact bytes: a byte path's own, a string's UTF-8 (as `fs`'s). */
function pathBytes(target: FsPath): Buffer {
  return typeof target === "string" ? Buffer.from(target, "utf8") : target;
}

/** The entry `name` of the directory `dir`, byte for byte (no decode). */
function joinBytes(dir: Buffer, name: Buffer): Buffer {
  return Buffer.concat([dir, Buffer.from([SLASH]), name]);
}

/** `name` within `dir`: `path.join` for two strings, else the bytes joined. */
function joinPath(dir: FsPath, name: FsPath): FsPath {
  if (typeof dir === "string" && typeof name === "string") {
    return path.join(dir, name);
  }
  return joinBytes(pathBytes(dir), pathBytes(name));
}

/** Whether a path is absolute (bytes: a leading `/`). */
function isAbsolutePath(target: FsPath): boolean {
  return typeof target === "string"
    ? path.isAbsolute(target)
    : target[0] === SLASH;
}

/**
 * A path rendered for a diagnosis: a string as itself; a byte path segment
 * by segment, each valid UTF-8 segment as its text and any other as
 * `<bytes HEX>` (the hex of its exact bytes) — so the bytes of a path string
 * render as that string.
 */
function displayPath(target: FsPath): string {
  if (typeof target === "string") return target;
  const segments: string[] = [];
  let start = 0;
  for (let end = 0; end <= target.length; end++) {
    if (end < target.length && target[end] !== SLASH) continue;
    const segment = target.subarray(start, end);
    const text = segment.toString("utf8");
    segments.push(
      Buffer.from(text, "utf8").equals(segment)
        ? text
        : `<bytes ${segment.toString("hex")}>`,
    );
    start = end + 1;
  }
  return segments.join("/");
}

function errorCode(thrown: unknown): string | undefined {
  if (typeof thrown === "object" && thrown !== null && "code" in thrown) {
    const code = (thrown as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

function describeError(thrown: unknown): string {
  return errorCode(thrown) ?? (thrown instanceof Error ? thrown.message : "");
}

function freshName(): string {
  return `.xspec-harness-probe-${randomBytes(6).toString("hex")}`;
}

/** A probe attempt: resolves to an undo of its effect when not refused. */
type Attempt = () => Promise<() => Promise<void>>;

/**
 * Run an attempt that the staging must refuse. A resolved attempt is undone
 * (best effort) and reported as an ineffective staging; a rejection other
 * than `EACCES`/`EPERM` is reported as a staging error too — it proves
 * nothing about the permission.
 */
async function expectRefused(
  mode: StagingMode,
  stagedPath: string,
  description: string,
  attempt: Attempt,
): Promise<void> {
  let undo: (() => Promise<void>) | undefined;
  try {
    undo = await attempt();
  } catch (thrown) {
    const code = errorCode(thrown);
    if (code === "EACCES" || code === "EPERM") return;
    throw new HarnessStagingError(
      mode,
      stagedPath,
      `${description} failed with ${describeError(thrown) || String(thrown)} rather than a permission refusal`,
    );
  }
  await undo().catch(() => undefined);
  throw new HarnessStagingError(
    mode,
    stagedPath,
    `${description} was not refused: ${PRIVILEGED_HINT}`,
  );
}

/** Run an attempt the staging must still permit (the kept permission). */
async function expectAllowed(
  mode: StagingMode,
  stagedPath: string,
  description: string,
  attempt: Attempt,
): Promise<void> {
  let undo: () => Promise<void>;
  try {
    undo = await attempt();
  } catch (thrown) {
    throw new HarnessStagingError(
      mode,
      stagedPath,
      `${description} failed with ${describeError(thrown) || String(thrown)}: the staging removed more than it may`,
    );
  }
  await undo();
}

function assertLinux(mode: StagingMode, target: FsPath): void {
  if (process.platform !== "linux") {
    throw new HarnessStagingError(
      mode,
      displayPath(target),
      `permission-based stagings belong to the Linux leg (E-1); this platform is ${process.platform}`,
    );
  }
  if (!isAbsolutePath(target)) {
    throw new HarnessStagingError(
      mode,
      displayPath(target),
      "the staged path must be absolute",
    );
  }
}

type EntryKind = "absent" | "file" | "directory" | "symlink" | "other";

async function kindOf(target: FsPath): Promise<EntryKind> {
  let stats: fs.Stats;
  try {
    stats = await fsp.lstat(target);
  } catch (thrown) {
    if (errorCode(thrown) === "ENOENT") return "absent";
    throw thrown;
  }
  if (stats.isSymbolicLink()) return "symlink";
  if (stats.isFile()) return "file";
  if (stats.isDirectory()) return "directory";
  return "other";
}

async function assertPlainDirectory(
  mode: StagingMode,
  stagedPath: string,
  dir: FsPath,
  role: string,
): Promise<void> {
  const kind = await kindOf(dir);
  if (kind !== "directory") {
    throw new HarnessStagingError(
      mode,
      stagedPath,
      `${role} ${displayPath(dir)} is ${kind}, not a directory (symbolic links and non-directory components are never involved)`,
    );
  }
}

async function modeOf(target: FsPath): Promise<number> {
  return (await fsp.stat(target)).mode & MODE_BITS;
}

/** Record `target`'s mode bits, then set them to `next`. */
async function setMode(
  records: ModeRecord[],
  target: FsPath,
  next: (prior: number) => number,
): Promise<void> {
  const prior = await modeOf(target);
  records.push({ path: target, mode: prior });
  await fsp.chmod(target, next(prior));
}

function makeStaging(
  mode: StagingMode,
  staged: FsPath,
  records: readonly ModeRecord[],
): PermissionStaging {
  let restored = false;
  return {
    mode,
    path: staged,
    async restore(): Promise<void> {
      if (restored) return;
      restored = true;
      for (let i = records.length - 1; i >= 0; i--) {
        const record = records[i]!;
        try {
          await fsp.chmod(record.path, record.mode);
        } catch (thrown) {
          throw new HarnessStagingError(
            mode,
            displayPath(staged),
            `restoring mode ${record.mode.toString(8)} of ${displayPath(record.path)} failed with ${describeError(thrown) || String(thrown)}`,
          );
        }
      }
    },
  };
}

/** Verify, then hand the staging out — or undo it and rethrow. */
async function verified(
  staging: PermissionStaging,
  verify: () => Promise<void>,
): Promise<PermissionStaging> {
  try {
    await verify();
  } catch (thrown) {
    await staging.restore().catch(() => undefined);
    throw thrown;
  }
  return staging;
}

// --- write-refusal probes ---------------------------------------------------

/** Creation in `dir`: a fresh file (`wx`) and a fresh directory. */
async function probeCreation(
  mode: StagingMode,
  stagedPath: string,
  dir: FsPath,
): Promise<void> {
  const file = joinPath(dir, freshName());
  await expectRefused(
    mode,
    stagedPath,
    `creating ${displayPath(file)}`,
    async () => {
      const handle = await fsp.open(file, "wx");
      return async () => {
        await handle.close();
        await fsp.unlink(file);
      };
    },
  );
  const sub = joinPath(dir, freshName());
  await expectRefused(
    mode,
    stagedPath,
    `creating directory ${displayPath(sub)}`,
    async () => {
      await fsp.mkdir(sub);
      return () => fsp.rmdir(sub);
    },
  );
}

/** Opening `file` for writing (`r+`, no truncation) and for appending. */
async function probeWriteOpen(
  mode: StagingMode,
  stagedPath: string,
  file: FsPath,
): Promise<void> {
  for (const flags of ["r+", "a"] as const) {
    await expectRefused(
      mode,
      stagedPath,
      `opening ${displayPath(file)} with ${JSON.stringify(flags)}`,
      async () => {
        const handle = await fsp.open(file, flags);
        return () => handle.close();
      },
    );
  }
}

/**
 * Renaming a fresh sibling over `target` (absent or a file), and — when the
 * occupant is a file — unlinking it. The sibling lives in a scratch
 * directory under the OS temp directory, where every `TestWorkspace` is
 * created (one filesystem, so the rename reaches the permission check rather
 * than `EXDEV`); it carries the occupant's bytes so an unrefused rename
 * leaves them in place, and it backs an unrefused unlink.
 */
async function probeReplaceAndRemove(
  mode: StagingMode,
  stagedPath: string,
  target: FsPath,
  occupied: boolean,
): Promise<void> {
  const scratch = await fsp.mkdtemp(
    path.join(os.tmpdir(), "xspec-harness-probe-"),
  );
  const sibling = path.join(scratch, "sibling");
  try {
    if (occupied) {
      await fsp
        .copyFile(target, sibling)
        .catch(() => fsp.writeFile(sibling, ""));
    } else {
      await fsp.writeFile(sibling, "");
    }
    await expectRefused(
      mode,
      stagedPath,
      `renaming ${sibling} over ${displayPath(target)}`,
      async () => {
        await fsp.rename(sibling, target);
        return async () => {
          if (occupied) await fsp.copyFile(target, sibling);
          else await fsp.unlink(target);
        };
      },
    );
    if (occupied) {
      await expectRefused(
        mode,
        stagedPath,
        `unlinking ${displayPath(target)}`,
        async () => {
          await fsp.unlink(target);
          return () => fsp.copyFile(sibling, target);
        },
      );
    }
  } finally {
    await fsp.rm(scratch, { recursive: true, force: true });
  }
}

/**
 * E-1 verification of a path-form write refusal (exported for the harness
 * self-test, which runs it on an unstaged path to see the ineffective-staging
 * report fire): every write the discipline refuses is attempted in this
 * process and must be refused.
 */
export async function verifyWriteRefusal(target: string): Promise<void> {
  const mode: StagingMode = "write-refusal";
  const dir = path.dirname(target);
  await probeCreation(mode, target, dir);
  const occupied = (await kindOf(target)) === "file";
  if (occupied) await probeWriteOpen(mode, target, target);
  await probeReplaceAndRemove(mode, target, target, occupied);
}

/**
 * Stage a write refusal at `target` (T14-9's discipline): the directory
 * holding it made read-only and, where `target` is a regular file, that
 * occupant made unwritable. `target` may be absent (a creation the product
 * owes) but never a directory (`stageWriteRefusalUnder`), a symbolic link, or
 * any other kind. Verified on this process before returning (E-1).
 */
export async function stageWriteRefusal(
  target: string,
): Promise<PermissionStaging> {
  const mode: StagingMode = "write-refusal";
  assertLinux(mode, target);
  const dir = path.dirname(target);
  await assertPlainDirectory(mode, target, dir, "the holding directory");
  const kind = await kindOf(target);
  if (kind === "directory") {
    throw new HarnessStagingError(
      mode,
      target,
      "the target is a directory; stage every path beneath it with stageWriteRefusalUnder",
    );
  }
  if (kind !== "absent" && kind !== "file") {
    throw new HarnessStagingError(
      mode,
      target,
      `the target is ${kind} (symbolic links and non-directory components are never involved)`,
    );
  }
  const records: ModeRecord[] = [];
  await setMode(records, dir, (prior) => prior & ~WRITE_BITS);
  if (kind === "file") {
    await setMode(records, target, (prior) => prior & ~WRITE_BITS);
  }
  return verified(makeStaging(mode, target, records), () =>
    verifyWriteRefusal(target),
  );
}

interface Subtree {
  readonly dirs: Buffer[];
  readonly files: Buffer[];
}

/**
 * Every directory (the root first) and regular file beneath `root`, each as
 * its exact byte path: names are listed as raw bytes in byte order and each
 * entry classified by `lstat` at its exact bytes (module header: Names), so
 * a name that is not valid UTF-8 is reached like any other; symbolic links
 * and other kinds are left out.
 */
async function walkSubtree(root: FsPath): Promise<Subtree> {
  const dirs = [pathBytes(root)];
  const files: Buffer[] = [];
  for (let i = 0; i < dirs.length; i++) {
    const dir = dirs[i]!;
    const names = (await fsp.readdir(dir, { encoding: "buffer" })).sort(
      Buffer.compare,
    );
    for (const name of names) {
      const entry = joinBytes(dir, name);
      const kind = await kindOf(entry);
      if (kind === "directory") dirs.push(entry);
      else if (kind === "file") files.push(entry);
    }
  }
  return { dirs, files };
}

/**
 * E-1 verification of an area write refusal (exported for the self-test):
 * creation is attempted in every directory beneath `directory`, a write-open
 * on every regular file, a rename into `directory`, and the removal of its
 * first regular file — each entry reached at its exact bytes.
 */
export async function verifyWriteRefusalUnder(
  directory: StagedPath,
): Promise<void> {
  const mode: StagingMode = "write-refusal-under";
  const area = toFsPath(directory);
  const shown = displayPath(area);
  const { dirs, files } = await walkSubtree(area);
  for (const dir of dirs) await probeCreation(mode, shown, dir);
  for (const file of files) await probeWriteOpen(mode, shown, file);
  await probeReplaceAndRemove(mode, shown, joinPath(area, freshName()), false);
  if (files.length > 0) {
    await probeReplaceAndRemove(mode, shown, files[0]!, true);
  }
}

/**
 * Stage a write refusal of every path beneath `directory` — T14-9's
 * discipline for an area whose write paths the harness cannot name (`.xspec`,
 * `specs/b`): the directory and every directory beneath it made read-only,
 * every regular file beneath made unwritable, symbolic links left alone, and
 * the directory's own parent untouched. Every entry is reached at its exact
 * bytes, whatever name the product chose (module header: Names). Verified
 * before returning (E-1).
 */
export async function stageWriteRefusalUnder(
  directory: StagedPath,
): Promise<PermissionStaging> {
  const mode: StagingMode = "write-refusal-under";
  const area = toFsPath(directory);
  assertLinux(mode, area);
  const shown = displayPath(area);
  await assertPlainDirectory(mode, shown, area, "the staged area");
  const { dirs, files } = await walkSubtree(area);
  const records: ModeRecord[] = [];
  for (const entry of [...dirs, ...files]) {
    await setMode(records, entry, (prior) => prior & ~WRITE_BITS);
  }
  return verified(makeStaging(mode, area, records), () =>
    verifyWriteRefusalUnder(area),
  );
}

// --- read-refusal probes ----------------------------------------------------

/**
 * E-1 verification of a file read refusal (exported for the self-test): the
 * read must be refused, a write-open (append, no bytes written) must succeed.
 */
export async function verifyReadRefusalOfFile(
  target: StagedPath,
): Promise<void> {
  const mode: StagingMode = "read-refusal-of-file";
  const file = toFsPath(target);
  const shown = displayPath(file);
  await expectRefused(mode, shown, `reading ${shown}`, async () => {
    const handle = await fsp.open(file, "r");
    return () => handle.close();
  });
  await expectAllowed(mode, shown, `opening ${shown} for writing`, async () => {
    const handle = await fsp.open(file, "a");
    return () => handle.close();
  });
}

/**
 * Stage a refused content read of the regular file `target` (T14-10): mode
 * 0o200, its write permission kept so a regeneration replacing or rewriting
 * it is never refused. Nonexistence is never staged as a refusal. A file
 * whose name the product chose is passed as its exact bytes (module header:
 * Names). Verified before returning (E-1).
 */
export async function stageReadRefusalOfFile(
  target: StagedPath,
): Promise<PermissionStaging> {
  const mode: StagingMode = "read-refusal-of-file";
  const file = toFsPath(target);
  assertLinux(mode, file);
  const kind = await kindOf(file);
  if (kind !== "file") {
    throw new HarnessStagingError(
      mode,
      displayPath(file),
      `the target is ${kind}, not a regular file (nonexistence is never staged as a refusal; symbolic links are never involved)`,
    );
  }
  const records: ModeRecord[] = [];
  await setMode(records, file, () => CONTENT_UNREADABLE);
  return verified(makeStaging(mode, file, records), () =>
    verifyReadRefusalOfFile(file),
  );
}

/**
 * E-1 verification of a directory read refusal (exported for the self-test):
 * the listing must be refused; search must be kept — the directory passes an
 * execute-access check and, when `knownEntry` names one of its entries (a
 * name string, or its exact bytes), that entry is reachable by name.
 */
export async function verifyReadRefusalOfDirectory(
  target: StagedPath,
  knownEntry?: StagedPath,
): Promise<void> {
  const mode: StagingMode = "read-refusal-of-directory";
  const dir = toFsPath(target);
  const shown = displayPath(dir);
  await expectRefused(mode, shown, `listing ${shown}`, async () => {
    await fsp.readdir(dir);
    return async () => undefined;
  });
  await expectAllowed(mode, shown, `searching ${shown}`, async () => {
    await fsp.access(dir, fs.constants.X_OK);
    return async () => undefined;
  });
  if (knownEntry !== undefined) {
    const entry = joinPath(dir, toFsPath(knownEntry));
    await expectAllowed(
      mode,
      shown,
      `reaching ${displayPath(entry)} by name`,
      async () => {
        await fsp.lstat(entry);
        return async () => undefined;
      },
    );
  }
}

/**
 * Stage a refused listing of the directory `target` (T14-10): mode 0o100,
 * its search permission kept so its entries stay reachable by name.
 * Verified before returning (E-1), the by-name probe using the entry listed
 * first (bytewise) before the staging, at its exact bytes (module header:
 * Names), when the directory holds one.
 */
export async function stageReadRefusalOfDirectory(
  target: StagedPath,
): Promise<PermissionStaging> {
  const mode: StagingMode = "read-refusal-of-directory";
  const dir = toFsPath(target);
  assertLinux(mode, dir);
  await assertPlainDirectory(mode, displayPath(dir), dir, "the target");
  const knownEntry = (await fsp.readdir(dir, { encoding: "buffer" })).sort(
    Buffer.compare,
  )[0];
  const records: ModeRecord[] = [];
  await setMode(records, dir, () => LISTING_UNREADABLE);
  return verified(makeStaging(mode, dir, records), () =>
    verifyReadRefusalOfDirectory(dir, knownEntry),
  );
}
