// Environment refusals — a write (SPEC 14.24) or a read (SPEC 14.25) the
// environment refuses, carried from the operation that meets it to the
// CLI's exit-2 report.
//
// SPEC 14.24: a write xspec makes — a file's creation, replacement, append,
// relocation, or removal (13.4, 12.1) — that the environment refuses
// (permission denied, a read-only filesystem, exhausted storage, or any
// other failure the filesystem reports for a write the rules of 13.4
// permit) is reported by the command making the write as a usage error
// (12.0), not a finding: the command stops at the refused write, attempting
// no later one and leaving every write already made, each complete (13.5),
// and exits 2.
//
// SPEC 14.25: so is a read the environment refuses (permission denied, an
// I/O error, any other failure the filesystem reports for a read) wherever
// the object read has no condition of its own — a directory discovery lists
// (7), the session directory (10.1), the directories the upward search
// examines (7), and a path occupant's kind wherever else xspec examines one
// (6.5, 7, 11.6, 13.4), the journal's, a session file's, and the
// configuration path's included: the command stops at the read, attempting
// nothing further, and exits 2. An object's nonexistence is never this
// condition — each reader reads absence as its own section states. The
// refused content reads that have conditions of their own (a source's 14.20,
// the journal's 14.13, a session file's 14.21, the configuration file's
// 14.14, a derived file's 14.10 to `check`, graph data's 14.23 state) are
// their readers' to report, never raised through here.
//
// Either refusal travels as the typed error below, thrown at the operation
// itself so nothing after it runs, and carrying the condition as data — the
// 12.7 finding form with its stable code and concerned path (IMPLEMENTATION
// cross-cutting rules) — which the CLI renders once, as the stderr
// diagnostic and, with JSON output in effect, the 12.0/12.7 error document
// (cli/main.ts, cli/report.ts).
//
// Messages stay byte-deterministic (SPEC 12.0): the concerned path, the
// filesystem's error code (`EACCES`, `EROFS`, `ENOSPC`, `EIO`, …), and
// static text — never the filesystem's own message, which carries absolute
// and temporary paths.

import type { Finding } from "../core/findings.js";
import { pathFinding } from "../core/findings.js";
import type { PathText } from "../core/path-text.js";
import { renderPathText } from "../core/path-text.js";

/**
 * A write (SPEC 14.24) or a read (SPEC 14.25) the environment refused, as
 * the one finding of the exit-2 error document (SPEC 12.7): stable code,
 * message, and concerned path, no locations.
 */
export class EnvironmentRefusal extends Error {
  readonly finding: Finding;

  constructor(finding: Finding) {
    super(finding.message);
    this.name = "EnvironmentRefusal";
    this.finding = finding;
  }
}

/**
 * Whether `error` is a failure the filesystem reported — a system error
 * carrying the errno code and the failed call (SPEC 14.24, 14.25: "any
 * other failure the filesystem reports"), as opposed to a defect of the
 * product's own, which carries no system call.
 */
export function isFilesystemFailure(
  error: unknown,
): error is NodeJS.ErrnoException {
  if (!(error instanceof Error)) return false;
  const { code, syscall } = error as NodeJS.ErrnoException;
  return typeof code === "string" && typeof syscall === "string";
}

/**
 * The write a refusal stopped, as its diagnostic names it (SPEC 14.24):
 * creating or replacing a file, appending to a durable file, removing a
 * file, or writing graph data, which concerns the graph-data area.
 */
export type RefusedWrite = "write" | "append" | "remove" | "graph-data";

/**
 * The SPEC 14.24 write failure for one refused write: its concerned path is
 * the workspace-relative path of the file the write would have produced or
 * removed — each of a relocation's two writes concerning its own path — or,
 * for a graph-data write, the graph-data area itself, no path inside it
 * named (SPEC 14.24, 11.6).
 */
export function writeFailure(
  concerned: string,
  write: RefusedWrite,
  cause: NodeJS.ErrnoException,
): EnvironmentRefusal {
  const code = cause.code ?? "an unknown error";
  let what: string;
  switch (write) {
    case "write":
      what = `to write ${concerned}`;
      break;
    case "append":
      what = `an append to ${concerned}`;
      break;
    case "remove":
      what = `the removal of ${concerned}`;
      break;
    case "graph-data":
      what = `a graph-data write in the graph-data area ${concerned}`;
      break;
  }
  return new EnvironmentRefusal(
    pathFinding(
      24,
      `the environment refused ${what} (${code}); the command stopped at ` +
        `this write, every earlier write complete and no later one made — ` +
        `make the path writable, then rerun the command (SPEC 14.24, 13.5)`,
      concerned,
    ),
  );
}

/**
 * Whether a failed read found nothing to read: no entry of that name, or a
 * path component that is not a directory. SPEC 14.25: an object's
 * nonexistence is never a read failure — an absent object reads as its own
 * section states (an absent journal is empty, 6.1; an absent session
 * directory holds no sessions, 10.1; an absent configuration path is
 * missing configuration, 14.14; an absent path is matched by no glob, 7).
 */
export function isAbsenceFailure(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | null)?.code;
  return code === "ENOENT" || code === "ENOTDIR";
}

/**
 * The read a refusal stopped, as its diagnostic names it (SPEC 14.25): a
 * directory's entries — a listing, or a lookup the upward search makes in
 * a directory it examines (7) — or a path occupant's kind (7, 13.4).
 */
export type RefusedRead = "listing" | "kind";

/**
 * The SPEC 14.25 read failure for one refused read: its concerned path is
 * the object's workspace-relative path — for a directory above the
 * workspace root, or examined before the root is known (7), its anchoring
 * form (11.6); a caller passes whichever the object has.
 */
export function readFailure(
  concerned: PathText,
  read: RefusedRead,
  cause: NodeJS.ErrnoException,
): EnvironmentRefusal {
  const code = cause.code ?? "an unknown error";
  const spelled = renderPathText(concerned);
  const what =
    read === "listing"
      ? `to read the entries of the directory ${spelled}`
      : `to read what occupies ${spelled}`;
  return new EnvironmentRefusal(
    pathFinding(
      25,
      `the environment refused ${what} (${code}); the command stopped at ` +
        `this read, attempting nothing further — make the path readable, ` +
        `then rerun the command (SPEC 14.25)`,
      concerned,
    ),
  );
}

/**
 * SPEC 14.25: run one read that has no condition of its own, turning a
 * failure the filesystem reports into the read failure concerning
 * `concerned`, thrown so the command stops at this read. A read that found
 * nothing (`isAbsenceFailure`) is never refused: `absent` supplies the
 * answer absence reads as, the caller's own section deciding it. Anything
 * else — a defect of the product's own — propagates unchanged.
 */
export async function performRead<T>(
  concerned: PathText,
  read: RefusedRead,
  reading: () => Promise<T>,
  absent: () => T,
): Promise<T> {
  try {
    return await reading();
  } catch (error) {
    if (isAbsenceFailure(error)) return absent();
    if (isFilesystemFailure(error)) throw readFailure(concerned, read, error);
    throw error;
  }
}
