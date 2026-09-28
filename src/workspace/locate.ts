// Configuration location (SPEC 7) — the I/O-light head of workspace
// loading, separated from parsing so commands can locate and read the
// configuration file without loading the TypeScript-based parser
// (core/config.ts): every command locates the configuration by upward
// search for `xspec.config.ts` from the working directory, or uses the
// path given by the global `--config <path>` option — a filesystem path
// resolved against the working directory (SPEC 12.0). The configuration
// file's directory is the workspace root. The configuration file is the
// occupant of the path so found or named, read only when it is a plain
// file: a missing configuration, or any other occupant — a directory, a
// symbolic link whatever it targets — is a configuration error (14.14),
// reported by every command as a usage error (exit 2, 12.0) preceding all
// source analysis.
//
// SPEC 14: a configuration error's concerned path is reported in the
// anchoring form of 11.6, identified relative to the invocation working
// directory — the configuration path the upward search found or `--config`
// named, whatever occupies it, or `.` for a failed upward search with no
// `--config` — except that a `--config` path nothing occupies is reported
// as the argument value exactly as given (12.0). This module computes that
// spelling once (./anchor.ts) and hands it to every consumer: the located
// workspace carries it for later parse and discovery errors, and a locate
// failure's findings carry it directly.
//
// The store-backed read fast path (./fast-read.ts) starts from this
// module's result: with the configuration file's exact bytes in hand, a
// stored parse recorded under the same content hash substitutes for
// re-parsing (SPEC 12.0 determinism — identical bytes parse identically),
// which is what lets a fresh-store read skip the parser module entirely.

import type { Stats } from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import type { Finding } from "../core/findings.js";
import { pathFinding } from "../core/findings.js";
import { anchoredPathSpelling } from "./anchor.js";

/** SPEC 7: the configuration file name the upward search looks for. */
export const CONFIG_FILE_NAME = "xspec.config.ts";

/** A located workspace: the configuration file found and read, unparsed. */
export interface LocatedWorkspace {
  /**
   * Absolute filesystem path of the workspace root — the configuration
   * file's directory (SPEC 7). Never rendered into output (SPEC 12.0).
   */
  readonly root: string;
  /** The configuration file's base name, for workspace-relative reads. */
  readonly configFileName: string;
  /**
   * The configuration file in the anchoring form of 11.6, relative to the
   * invocation working directory (SPEC 14: a configuration error's
   * concerned path) — a pure function of invocation input (SPEC 12.0).
   */
  readonly configAnchor: string;
  /** The configuration file's exact bytes. */
  readonly configBytes: Uint8Array;
}

export type WorkspaceLocateResult =
  | { readonly ok: true; readonly located: LocatedWorkspace }
  | {
      readonly ok: false;
      readonly findings: readonly Finding[];
      /**
       * SPEC 14: the concerned path of the failure — the found or named
       * configuration path in the 11.6 anchoring form, whatever occupies it
       * (7); `.` for a failed upward search with no `--config`; and a
       * `--config` path nothing occupies as the argument value exactly as
       * given (12.0).
       */
      readonly concernedPath: string;
    };

function failure(
  message: string,
  concernedPath: string,
): WorkspaceLocateResult {
  // SPEC 14: configuration errors carry the file or path they concern —
  // the anchored configuration path, `.`, or an unoccupied `--config`
  // value as given — with no in-source location.
  return {
    ok: false,
    findings: [pathFinding(14, message, concernedPath)],
    concernedPath,
  };
}

/**
 * What occupies a configuration path (SPEC 7): nothing, a plain file — the
 * one occupant ever read — or any other filesystem object, described for
 * the diagnostic.
 */
type ConfigOccupant =
  | { readonly kind: "absent" }
  | { readonly kind: "file" }
  | { readonly kind: "other"; readonly description: string };

/**
 * Whether a failed kind read found nothing at the path: no entry of that
 * name, or a path component that is not a directory. SPEC 14.25: an
 * object's nonexistence is never a read failure — an absent configuration
 * path is missing configuration (14.14).
 */
function isAbsence(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | null)?.code;
  return code === "ENOENT" || code === "ENOTDIR";
}

/**
 * SPEC 7: classify the occupant of a configuration path by the entry
 * itself, never by what a symbolic link at that path targets — `lstat`
 * follows no link in the final component. Any other refused read — of the
 * occupant's kind, or of a directory holding it that the upward search
 * examines (permission denied, an I/O error) — propagates: it is condition
 * 25 (SPEC 14.25), never absence, so the search never continues past it.
 */
async function occupantOf(candidate: string): Promise<ConfigOccupant> {
  let stats: Stats;
  try {
    stats = await fsp.lstat(candidate);
  } catch (error) {
    if (isAbsence(error)) return { kind: "absent" };
    throw error;
  }
  if (stats.isFile()) return { kind: "file" };
  const description = stats.isSymbolicLink()
    ? "a symbolic link"
    : stats.isDirectory()
      ? "a directory"
      : "a filesystem object other than a plain file";
  return { kind: "other", description };
}

/**
 * SPEC 7: upward search for `xspec.config.ts` from the working directory —
 * the working directory itself first. The search stops at the nearest
 * directory holding an entry of that name, whatever occupies it, so a
 * directory or a symbolic link of that name ends the search as surely as a
 * plain file does (the caller reads only a plain file). Returns the entry's
 * absolute path and occupant, or undefined when the search exhausts at the
 * filesystem root.
 */
async function searchUpward(
  startDir: string,
): Promise<
  { readonly configPath: string; readonly occupant: ConfigOccupant } | undefined
> {
  let dir = startDir;
  for (;;) {
    const configPath = path.join(dir, CONFIG_FILE_NAME);
    const occupant = await occupantOf(configPath);
    if (occupant.kind !== "absent") return { configPath, occupant };
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/**
 * Locate and read the project configuration file (SPEC 7, 14.14) without
 * parsing it. `configFlag` is the `--config <path>` value when given,
 * resolved against `cwd` (SPEC 12.0); otherwise the upward search from
 * `cwd` applies.
 */
export async function locateWorkspace(
  cwd: string,
  configFlag: string | undefined,
): Promise<WorkspaceLocateResult> {
  let configPath: string;
  let configFileName: string;
  let occupant: ConfigOccupant;
  if (configFlag !== undefined) {
    configPath = path.resolve(cwd, configFlag);
    configFileName = path.basename(configPath);
    occupant = await occupantOf(configPath);
    if (occupant.kind === "absent") {
      // SPEC 14: missing configuration WITH `--config` given concerns the
      // named path (never `.` — that is the failed upward search's case).
      // A path nothing occupies is the one concerned path no physical
      // resolution (11.6) can spell, so it is reported as the argument
      // value exactly as given (12.0) — never canonicalized, and an
      // absolute value stays absolute: `./../cfg//xspec.config.ts` is
      // reported byte-for-byte, never `../cfg/xspec.config.ts`. Once the
      // path is occupied, whatever occupies it, the anchoring form below
      // applies: existence, not spelling, decides the form.
      return failure(
        `--config ${configFlag}: no configuration file exists at this ` +
          `path, resolved against the working directory (SPEC 7, 12.0)`,
        configFlag,
      );
    }
  } else {
    const found = await searchUpward(path.resolve(cwd));
    if (found === undefined) {
      // SPEC 14: a failed upward search with no `--config` concerns the
      // directory it started from — the invocation working directory,
      // spelled `.` (11.6).
      return failure(
        `no ${CONFIG_FILE_NAME} found by upward search from the working ` +
          `directory — create one in the project root or pass --config ` +
          `<path> (SPEC 7)`,
        ".",
      );
    }
    configPath = found.configPath;
    configFileName = CONFIG_FILE_NAME;
    occupant = found.occupant;
  }

  // SPEC 14: the concerned path of every configuration error from here on
  // is the found or named configuration path itself, whatever occupies it
  // (7) — the entry, never what a symbolic link there targets.
  const configAnchor = anchoredPathSpelling(cwd, configPath);
  if (occupant.kind === "other") {
    // SPEC 7, 14.14: the configuration file is read only when it is a plain
    // file; any other occupant — a directory, a symbolic link whatever it
    // targets, or anything else — is missing or invalid configuration,
    // never read through, and the upward search never continues past it.
    return failure(
      (configFlag === undefined
        ? `the upward search from the working directory stops at the ` +
          `nearest entry named ${CONFIG_FILE_NAME}, and this one is `
        : `--config ${configFlag}: this path holds `) +
        `${occupant.description}, not a plain file — the configuration ` +
        `file is read only as a plain file, never through a directory or ` +
        `a symbolic link; put the configuration file itself at this path ` +
        `(SPEC 7)`,
      configAnchor,
    );
  }
  let bytes: Uint8Array;
  try {
    bytes = await fsp.readFile(configPath);
  } catch {
    // SPEC 7, 14.25: a plain configuration file the environment refuses to
    // read is invalid configuration (14.14).
    return failure(
      `the configuration file cannot be read (SPEC 7, 14.25)`,
      configAnchor,
    );
  }
  return {
    ok: true,
    located: {
      root: path.dirname(configPath),
      configFileName,
      configAnchor,
      configBytes: bytes,
    },
  };
}
