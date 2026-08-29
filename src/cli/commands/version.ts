// The `xspec version` command (SPEC 12.6).
//
// Reports the product version and the machine-interface version as a single
// JSON document — the surface is JSON-only: the 12.7 version form
// `{"product", "interface"}` is its only output form, with or without
// `--json` (SPEC 12.0). Both values are fixed per build: the
// machine-interface version is the literal string "1" (SPEC 12.6, 12.7),
// and the product version is read from the package's own metadata
// (package.json, resolved relative to this module — never the working
// directory), so the answer is byte-identical in any working directory
// (SPEC 12.0). The command is workspace-independent: it consults no
// workspace and no configuration — `--config` is accepted and not consulted,
// and configuration-error precedence (SPEC 14.14) never reaches it — so
// `main` dispatches it before configuration location.

import { readFileSync } from "node:fs";
import { canonicalJson } from "../../core/canonical-json.js";
import type { ExitCode } from "../../core/findings.js";
import type { CliWriter } from "../io.js";

/**
 * SPEC 12.6/12.7: the machine-interface version — the string form of 12.6's
 * stated value `1`, naming the JSON contract of 12.0 and 12.7 that this
 * build implements.
 */
const MACHINE_INTERFACE_VERSION = "1";

/**
 * The product version from the package's own metadata (SPEC 12.6 "fixed per
 * build"): the `version` field of the package.json this module ships in —
 * three directory levels above `cli/commands/` in the source and compiled
 * layouts alike. Resolved relative to the module, never the working
 * directory or any environment value, so one build reports one value
 * wherever it runs (SPEC 12.0: no environment-dependent content).
 */
function productVersion(): string {
  const packageJsonUrl = new URL("../../../package.json", import.meta.url);
  const metadata: unknown = JSON.parse(readFileSync(packageJsonUrl, "utf8"));
  if (
    typeof metadata !== "object" ||
    metadata === null ||
    typeof (metadata as { readonly version?: unknown }).version !== "string"
  ) {
    // The package's own metadata is part of the build: a missing version
    // string is a broken installation, an internal error outside the SPEC
    // 12.0 exit partition (the bin maps it out of 0/1/2), never a defined
    // workspace or configuration failure (SPEC 12.6).
    throw new Error("xspec package metadata carries no version string");
  }
  return (metadata as { readonly version: string }).version;
}

/**
 * `xspec version` (SPEC 12.6): emit the 12.7 version document as the entire
 * standard output and succeed — an informational report, exit 0 (SPEC
 * 12.0). It cannot fail for workspace or configuration reasons; usage
 * errors (exit 2) are the parser's, upstream of this handler.
 */
export function versionCommand(stdout: CliWriter): ExitCode {
  stdout.write(
    canonicalJson({
      product: productVersion(),
      interface: MACHINE_INTERFACE_VERSION,
    }),
  );
  return 0;
}
