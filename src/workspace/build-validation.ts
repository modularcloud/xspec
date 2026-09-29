// The validations of `xspec build` (SPEC 12.1) as one report — the
// findings a `build` would now report (SPEC 13.3).
//
// SPEC 13.3: a workspace fails `build`'s validations on "source validation
// errors, journal errors (14.13), and refused writes (14.22) alike". SPEC
// 14: "When several error conditions are present, they MUST report each
// of them, not only the first; a condition goes unreported only where
// another error makes it undetectable". A refused write is detectable on a
// workspace whose sources or journal fail: 14.22 judges paths, never
// generated content — `build`'s write paths are "the derived files the
// current sources and configuration generate (13.1, 13.2) and graph data
// (13.3)", per-source derived paths "defined by this `NAME.mdx` name shape
// alone" (13.1), a set discovery and configuration define on any
// workspace (14.10; `discoveredWritePaths`, core/build.ts). So the refused
// writes are judged over that set whatever the sources' validity and
// reported beside the analysis's findings.
//
// Shared by every surface reporting or gating on `build`'s validations:
// `build` itself (12.1), `check` (12.2, which judges exactly `build`'s
// write paths, 14.22), the gate of 13.3 (./refresh.ts), and the
// invalid-workspace refusal of `rename` and `move` (6.4, 6.5: "the
// workspace's findings alone", 14). The examination makes kind reads only
// — nothing is modified (SPEC 12.1: a failing `build` modifies nothing) —
// and a kind read the environment refuses stops the command at that read
// (SPEC 14.25, ./writes.ts).

import { discoveredWritePaths } from "../core/build.js";
import type { Finding } from "../core/findings.js";
import type { LoadedWorkspace } from "./config.js";
import type { WorkspaceAnalysis } from "./pipeline.js";
import { obstructedWritePathFindings } from "./writes.js";

/**
 * The findings a `build` would now report over `analysis` (SPEC 13.3,
 * 12.1): its source validation findings and journal errors, then the
 * refused writes (SPEC 14.22) over `build`'s write paths as discovery and
 * configuration define them — one finding per distinct offending
 * component. Empty exactly when the workspace passes `build`'s
 * validations. Unordered: every findings emitter applies 12.7's order.
 */
export async function buildValidationFindings(
  workspace: LoadedWorkspace,
  analysis: WorkspaceAnalysis,
): Promise<readonly Finding[]> {
  const refusedWrites = await obstructedWritePathFindings(
    workspace.root,
    discoveredWritePaths(workspace.configuration, analysis.classification),
  );
  return [...analysis.findings, ...refusedWrites];
}
