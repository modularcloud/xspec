// The SPEC 11.2 pre-answer step — the workspace side of the availability
// surfaces `occurrences` (11.3), `view` (11.4), and `at` (11.5).
//
// SPEC 11.2 (never stale; writing nothing on a failing workspace): these
// surfaces never answer from stale graph data. On a workspace that passes
// the validations of `xspec build` (SPEC 12.1) they participate in
// read-time refresh exactly as the reads of 13.3 do — the stored graph data
// is refreshed, writing exactly what `build` would write except that no
// TypeScript or Markdown is generated or removed and the recorded
// derived-file paths are left unchanged. On one that fails them — source
// validation errors, journal errors (14.13), and refused writes (14.22)
// alike (SPEC 13.3): the findings a `build` would now report — they answer
// from the current sources and modify nothing: no graph data, no derived
// files, no journal consulted, no record consulted. Either way the answer
// itself comes from the fresh analysis, so the caller's answer never
// depends on the store; refresh participation is the 13.3 side effect
// alone.
//
// Unlike the gated reads' step (./refresh.ts), a failing workspace is not a
// report here: its gate findings reach the answer only through the SPEC
// 11.2 consulted-domain selection (core/availability.ts) — a journal or
// write-path condition is no domain file's finding and accompanies no
// answer. Configuration errors keep their exit-2 precedence (SPEC 14.14).
//
// IMPLEMENTATION (Architecture): this workspace-layer module owns the I/O —
// the analysis pipeline (./pipeline.ts), the store load and the one
// refresh write (./graph-data.ts) — over the pure derivation of
// core/build.ts, exactly as ./refresh.ts composes them, so refresh and
// build agree byte for byte (SPEC 12.0).

import * as fsp from "node:fs/promises";
import * as path from "node:path";

import { computeBuildOutputs } from "../core/build.js";
import type { Finding } from "../core/findings.js";
import {
  graphDataMatchesCurrent,
  refreshedGraphData,
} from "../core/graph-data.js";
import type { LoadedWorkspace } from "./config.js";
import { loadGraphData, writeGraphData } from "./graph-data.js";
import type { WorkspaceAnalysis } from "./pipeline.js";
import { analyzeWorkspace, workspaceInputsOf } from "./pipeline.js";
import { obstructedWritePathFindings } from "./writes.js";

/** The outcome of the SPEC 11.2 pre-answer step. */
export type AvailabilityPreparation =
  | {
      /**
       * Answer from `analysis` per SPEC 11.2 — on a passing workspace the
       * stored graph data now matches the current sources and configuration
       * (refreshed if it did not, SPEC 13.3); on a failing one nothing was
       * consulted or modified. The caller selects the consulted domain's
       * findings itself (core/availability.ts) — a failing workspace is not
       * a report on these surfaces.
       */
      readonly kind: "answer";
      readonly analysis: WorkspaceAnalysis;
    }
  | {
      /**
       * SPEC 14.14/12.0: discovery-level configuration errors — usage
       * class, exit 2, nothing modified; configuration errors keep their
       * precedence over every answer (SPEC 11.2).
       */
      readonly kind: "configuration";
      readonly errors: readonly Finding[];
    };

/**
 * The analysis half of the SPEC 11.2 pre-answer step: analyze the current
 * workspace — a pure read, nothing consulted beyond the sources and
 * nothing modified — failing only with configuration-error precedence
 * (SPEC 14.14). Callers whose argument checks consult discovery (`view`'s
 * operand membership, SPEC 11.4) run them between this and
 * `finishAvailabilityRefresh`: the checks precede answering (SPEC 11.2,
 * 12.0), and a failing invocation writes nothing.
 */
export async function analyzeWorkspaceForAvailability(
  workspace: LoadedWorkspace,
): Promise<AvailabilityPreparation> {
  const analysis = await analyzeWorkspace(workspace);
  if (analysis.configurationErrors.length > 0) {
    return { kind: "configuration", errors: analysis.configurationErrors };
  }
  return { kind: "answer", analysis };
}

/**
 * The refresh half of the SPEC 11.2 pre-answer step: on a workspace whose
 * current sources fail `build`'s validations — source findings, journal
 * errors, and refused writes alike (SPEC 13.3) — do nothing (no store
 * read, no journal consequence, no write); on a passing one participate in
 * read-time refresh exactly as the reads of 13.3 do. The answer itself
 * always comes from `analysis`, never from the store.
 */
export async function finishAvailabilityRefresh(
  workspace: LoadedWorkspace,
  analysis: WorkspaceAnalysis,
): Promise<void> {
  if (analysis.findings.length > 0) {
    // SPEC 11.2/13.3: the current sources fail build validation — answer
    // from them; no store read, no journal consequence, no write.
    return;
  }

  // What `xspec build` would write for the current sources and
  // configuration (SPEC 13.3): the same pure derivation `build` runs
  // (SPEC 12.1). Its graph data and write set are independent of the
  // stored record (`stored` feeds orphan removal alone, which no refresh
  // performs), so the store stays unconsulted until the workspace has
  // passed the complete gate below.
  const build = computeBuildOutputs(
    workspace.configuration,
    analysis.specs,
    analysis.graph,
    analysis.textModel,
    analysis.hashes,
    null,
    workspaceInputsOf(workspace, analysis),
  );

  // SPEC 13.3: refused writes (14.22) fail `build`'s validations alike —
  // judged over build's complete write set, exactly the findings a `build`
  // would now report. On that failing side these surfaces write nothing
  // and consult no record (SPEC 11.2); the condition itself is no domain
  // file's finding and accompanies no answer.
  const writeFindings = await obstructedWritePathFindings(
    workspace.root,
    build.writePaths,
  );
  if (writeFindings.length > 0) {
    return;
  }

  // Passing workspace: read-time refresh participation (SPEC 13.3), as in
  // ./refresh.ts — matching data is served as is; mismatched or missing
  // data is rewritten as `build` would write it, the recorded derived-file
  // paths left unchanged.
  const stored = await loadGraphData(workspace.root);
  if (!graphDataMatchesCurrent(stored.bytes, stored.data, build.graphData)) {
    await writeGraphData(
      workspace.root,
      refreshedGraphData(stored.data, build.graphData),
    );
  }
}

/**
 * The byte length of one discovered source, read from the filesystem — for
 * a named file the analysis holds no parse for (an unparseable source,
 * SPEC 14.20): `at`'s out-of-range offset check (SPEC 11.5) is judged
 * against the file's bytes, a property of the bytes and not of the parse,
 * so the check runs on unparseable files too. Null when the content cannot
 * be read (the unreadable 14.20 case): no byte length exists to judge
 * against, and the resolution is explicitly unavailable regardless.
 */
export async function readSourceByteLength(
  workspace: LoadedWorkspace,
  rel: string,
): Promise<number | null> {
  try {
    const bytes = await fsp.readFile(
      path.join(workspace.root, ...rel.split("/")),
    );
    return bytes.length;
  } catch {
    return null;
  }
}

/**
 * The SPEC 11.2 pre-answer step: analyze the current workspace; on
 * configuration errors fail with exit-2 precedence; on a workspace failing
 * `build`'s validations answer from the analysis consulting nothing and
 * writing nothing; on a passing one participate in read-time refresh
 * exactly as the reads of 13.3 do, then answer from the same analysis.
 */
export async function prepareWorkspaceForAvailability(
  workspace: LoadedWorkspace,
): Promise<AvailabilityPreparation> {
  const prepared = await analyzeWorkspaceForAvailability(workspace);
  if (prepared.kind === "answer") {
    await finishAvailabilityRefresh(workspace, prepared.analysis);
  }
  return prepared;
}
