// Environment refusals — a write the environment refuses (SPEC 14.24),
// carried from the write that meets it to the CLI's exit-2 report.
//
// SPEC 14.24: a write xspec makes — a file's creation, replacement, append,
// relocation, or removal (13.4, 12.1) — that the environment refuses
// (permission denied, a read-only filesystem, exhausted storage, or any
// other failure the filesystem reports for a write the rules of 13.4
// permit) is reported by the command making the write as a usage error
// (12.0), not a finding: the command stops at the refused write, attempting
// no later one and leaving every write already made, each complete (13.5),
// and exits 2. The refusal travels as the typed error below, thrown at the
// write itself so nothing after it runs, and carrying the condition as data
// — the 12.7 finding form with its stable code and concerned path
// (IMPLEMENTATION cross-cutting rules) — which the CLI renders once, as
// the stderr diagnostic and, with JSON output in effect, the 12.0/12.7
// error document (cli/main.ts, cli/report.ts).
//
// Messages stay byte-deterministic (SPEC 12.0): the concerned
// workspace-relative path, the filesystem's error code (`EACCES`, `EROFS`,
// `ENOSPC`, …), and static text — never the filesystem's own message, which
// carries absolute and temporary paths.

import type { Finding } from "../core/findings.js";
import { pathFinding } from "../core/findings.js";

/**
 * A write (SPEC 14.24) the environment refused, as the one finding of the
 * exit-2 error document (SPEC 12.7): stable code, message, and concerned
 * path, no locations.
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
 * carrying the errno code and the failed call (SPEC 14.24: "any other
 * failure the filesystem reports"), as opposed to a defect of the product's
 * own, which carries no system call.
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
