// Configuration location (SPEC 7) — the I/O-light head of workspace
// loading, separated from parsing so commands can locate and read the
// configuration file without loading the TypeScript-based parser
// (core/config.ts): every command locates the configuration by upward
// search for `xspec.config.ts` from the working directory, or uses the
// path given by the global `--config <path>` option — a filesystem path
// resolved against the working directory (SPEC 12.0). The configuration
// file's directory is the workspace root. A missing configuration is a
// configuration error (14.14), reported by every command as a usage error
// (exit 2, 12.0) preceding all source analysis.
//
// SPEC 14: a configuration error's concerned path is reported in the
// anchoring form of 11.6, identified relative to the invocation working
// directory — the configuration file the upward search found or `--config`
// named, or `.` for a failed upward search with no `--config`. This module
// computes that spelling once (./anchor.ts) and hands it to every consumer:
// the located workspace carries it for later parse and discovery errors,
// and a locate failure's findings carry it directly.
//
// The store-backed read fast path (./fast-read.ts) starts from this
// module's result: with the configuration file's exact bytes in hand, a
// stored parse recorded under the same content hash substitutes for
// re-parsing (SPEC 12.0 determinism — identical bytes parse identically),
// which is what lets a fresh-store read skip the parser module entirely.

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
       * SPEC 14: the concerned path of the failure in the 11.6 anchoring
       * form — the `--config`-named file, the found-but-unreadable file, or
       * `.` for a failed upward search with no `--config`.
       */
      readonly configAnchor: string;
    };

function failure(message: string, configAnchor: string): WorkspaceLocateResult {
  // SPEC 14: configuration errors carry the file or path they concern —
  // the anchored configuration path (or `.`) — with no in-source location.
  return {
    ok: false,
    findings: [pathFinding(14, message, configAnchor)],
    configAnchor,
  };
}

/** Whether a plain-stat of the path reaches a regular file. */
async function isFile(candidate: string): Promise<boolean> {
  try {
    return (await fsp.stat(candidate)).isFile();
  } catch {
    return false;
  }
}

/**
 * SPEC 7: upward search for `xspec.config.ts` from the working directory.
 * Returns the found file's absolute path, or undefined when the search
 * exhausts at the filesystem root.
 */
async function searchUpward(startDir: string): Promise<string | undefined> {
  let dir = startDir;
  for (;;) {
    const candidate = path.join(dir, CONFIG_FILE_NAME);
    if (await isFile(candidate)) return candidate;
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
  if (configFlag !== undefined) {
    configPath = path.resolve(cwd, configFlag);
    configFileName = path.basename(configPath);
    if (!(await isFile(configPath))) {
      // SPEC 14: missing configuration WITH `--config` given concerns the
      // named file (never `.` — that is the failed upward search's case).
      return failure(
        `--config ${configFlag}: no configuration file exists at this ` +
          `path, resolved against the working directory (SPEC 7, 12.0)`,
        anchoredPathSpelling(cwd, configPath),
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
    configPath = found;
    configFileName = CONFIG_FILE_NAME;
  }

  const configAnchor = anchoredPathSpelling(cwd, configPath);
  let bytes: Uint8Array;
  try {
    bytes = await fsp.readFile(configPath);
  } catch {
    return failure(
      `the configuration file cannot be read (SPEC 7)`,
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
