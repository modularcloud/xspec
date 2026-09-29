// Refresh-on-read — the shared pre-answer step of the graph-data-consuming
// commands (SPEC 13.3): `ids`, `show`, `coverage`, `impact`, `review`
// (every subcommand), and `query`.
//
// SPEC 13.3: read results never come from stale data. When graph data is
// missing or does not match the current sources and configuration, these
// commands refresh it — writing exactly what `xspec build` would write,
// except that no TypeScript or Markdown is generated or removed and the
// recorded derived-file paths are left unchanged — before answering. The
// record is left unchanged in every state — an absent record stays absent,
// the empty record (11.6), whatever graph data the refresh writes beside
// it — and recorded state that exists but cannot be read as a record
// (SPEC 14.23) is neither read, repaired, nor replaced: the refresh writes
// the snapshot file alone and never the record's (./graph-data.ts), never
// consults the record, and reports no finding for it, the unreadable state
// persisting until a successful `build` or a finishing `rename`/`move`
// regeneration replaces the record (`check` reports it as staleness,
// SPEC 14.10). When
// the current workspace fails the validations of `xspec build` — source
// validation errors, journal errors (14.13), and refused writes over
// build's complete write set (14.22) alike, reported together (SPEC 14):
// the findings a `build` would now report (./build-validation.ts) — they
// report exactly those findings and exit 1 without
// answering and without modifying anything: a failed refresh, like a failed
// build (SPEC 12.1), leaves every derived file and all graph data
// unmodified.
//
// `check` never uses this step: it never refreshes and reports staleness
// instead (SPEC 13.3, 14.10) — it composes `analyzeWorkspace` and the
// core predicate itself. `build` regenerates rather than refreshes
// (SPEC 12.1). `rename`/`move` carry their own precedence rules (SPEC
// 12.0) and regenerate as `build` does (SPEC 6.4, 6.5).
//
// IMPLEMENTATION (Architecture): this workspace-layer module owns the I/O —
// the analysis pipeline (./pipeline.ts), the store load and the one write
// (./graph-data.ts) — and takes the refresh content and the staleness
// predicate from the pure core (core/graph-data.ts over core/build.ts:
// "what `xspec build` would write" is `computeBuildOutputs`' graph data,
// so refresh and build agree by construction, byte for byte — SPEC 12.0).

import { computeBuildOutputs } from "../core/build.js";
import type { SourceClassification } from "../core/discovery.js";
import type { Finding } from "../core/findings.js";
import type { GraphData } from "../core/graph-data.js";
import { graphDataMatchesCurrent } from "../core/graph-data.js";
import { buildValidationFindings } from "./build-validation.js";
import type { LoadedWorkspace } from "./config.js";
import { loadGraphData, writeGraphData } from "./graph-data.js";
import type { WorkspaceAnalysis } from "./pipeline.js";
import { analyzeWorkspace, workspaceInputsOf } from "./pipeline.js";

/** The outcome of the SPEC 13.3 pre-answer step. */
export type WorkspacePreparation =
  | {
      /**
       * The workspace is valid and the stored graph data now matches the
       * current sources and configuration — refreshed if it did not
       * (SPEC 13.3); the record, whatever its state, left unchanged
       * (SPEC 13.3, 14.23). Answer from `analysis`.
       */
      readonly kind: "ready";
      readonly analysis: WorkspaceAnalysis;
      /**
       * The stored graph data — the current snapshot with its derivation
       * inputs (the answer's source is `analysis`).
       */
      readonly graphData: GraphData;
    }
  | {
      /**
       * SPEC 13.3: the current workspace fails `build`'s validations —
       * source validation errors, journal errors, and refused writes over
       * build's complete write set alike (SPEC 14.22), reported together
       * (SPEC 14) — the command reports
       * these findings as its report (standard output, SPEC 12.0) and
       * exits 1 without answering; nothing was modified.
       */
      readonly kind: "findings";
      readonly findings: readonly Finding[];
    }
  | {
      /**
       * SPEC 14.14/12.0: discovery-level configuration errors — usage
       * class, diagnostics on standard error, exit 2, nothing modified,
       * and with `--json` an empty standard output.
       */
      readonly kind: "configuration";
      readonly errors: readonly Finding[];
    };

/** The analysis half of the pre-answer step: pure, nothing modified. */
export type ReadAnalysis =
  | { readonly kind: "analysis"; readonly analysis: WorkspaceAnalysis }
  | { readonly kind: "configuration"; readonly errors: readonly Finding[] };

/**
 * Analyze the current workspace for a gated read (SPEC 13.3) — a pure
 * read, nothing consulted beyond the sources and nothing modified —
 * failing only with configuration-error precedence (SPEC 14.14). The
 * gated reads' argument checks that consult discovery or the named files'
 * parses (SPEC 12.0: a requirement-node or graph-node identity judged
 * parse-local; a session name against the session directory) run between
 * this and `assessWorkspaceRead`: configuration errors precede those
 * checks, the checks precede the invalid-workspace report (SPEC 12.0),
 * and a failing invocation modifies nothing. `discovered` is the
 * classification a mutating `review` subcommand made before acquiring
 * exclusivity (SPEC 13.5; `analyzeWorkspace`), its configuration errors
 * already reported.
 */
export async function analyzeWorkspaceForRead(
  workspace: LoadedWorkspace,
  discovered?: SourceClassification,
): Promise<ReadAnalysis> {
  const analysis = await analyzeWorkspace(workspace, discovered);
  if (analysis.configurationErrors.length > 0) {
    return { kind: "configuration", errors: analysis.configurationErrors };
  }
  return { kind: "analysis", analysis };
}

/**
 * The gate-and-refresh assessment (SPEC 13.3), decision separated from
 * write: `findings` is the invalid-workspace report — validation findings
 * and refused writes over build's complete write set (SPEC 14.22)
 * together: the findings a `build` would now report — with nothing
 * modified;
 * `ready` carries the graph data the read answers beside and a `commit`
 * that performs the one refresh write, the snapshot file's (a no-op when
 * the stored graph data already matches; the record, which no refresh
 * reads, repairs, or replaces, is never written, SPEC 13.3, 14.23). The
 * caller commits only once every remaining argument check
 * has passed, so a usage-error invocation writes nothing — and the
 * decision itself never writes, so a report that must precede other
 * evaluation (the corrupt-session report of 10.1 behind this gate) can be
 * sequenced after it without a write having happened.
 */
export type ReadRefreshAssessment =
  | { readonly kind: "findings"; readonly findings: readonly Finding[] }
  | {
      readonly kind: "ready";
      readonly graphData: GraphData;
      readonly commit: () => Promise<void>;
    };

export async function assessWorkspaceRead(
  workspace: LoadedWorkspace,
  analysis: WorkspaceAnalysis,
): Promise<ReadRefreshAssessment> {
  // SPEC 13.3: the current workspace fails `build`'s validations — source
  // validation errors, journal errors (14.13), and refused writes (14.22)
  // alike: the findings a `build` would now report, each condition beside
  // the others (SPEC 14), refused writes judged over the write paths
  // discovery and configuration define whatever the sources' validity
  // (./build-validation.ts). The gated read reports them and exits 1
  // without answering; evaluation only — nothing is modified and the store
  // stays unread on this failing side.
  const findings = await buildValidationFindings(workspace, analysis);
  if (findings.length > 0) {
    return { kind: "findings", findings };
  }

  // What `xspec build` would write for the current sources and
  // configuration (SPEC 13.3): the same pure derivation `build` runs
  // (SPEC 12.1), so the refreshed bytes match a real build's byte for byte
  // (SPEC 12.0 determinism). Its graph data is independent of the stored
  // record (the record feeds orphan removal alone, which no refresh
  // performs), so the record is never consulted. The refresh generates and
  // removes no TypeScript or Markdown — only the snapshot file is ever
  // written.
  const build = computeBuildOutputs(
    workspace.configuration,
    analysis.specs,
    analysis.graph,
    analysis.textModel,
    analysis.hashes,
    [],
    workspaceInputsOf(workspace, analysis),
  );

  // SPEC 13.3: graph data missing or not matching the current sources and
  // configuration — nothing stored, a stale snapshot, or something stored
  // that cannot be read as graph data — is rewritten as `build` would
  // write it; matching data is served as is, nothing to commit. The record
  // is left unchanged in every state (SPEC 13.3, 14.23): the refresh
  // writes the snapshot file alone, so an absent record stays absent (the
  // empty record, 11.6), a readable one stays byte-for-byte, and recorded
  // state that cannot be read as a record is neither read, repaired, nor
  // replaced, no finding reported for it — met by the record-consulting
  // surfaces (SPEC 11.6, 6.6 → 14.23) and reported as staleness by `check`
  // (SPEC 14.10) until a successful `build` or a finishing `rename`/`move`
  // regeneration replaces it.
  const stored = await loadGraphData(workspace.root);
  const graphData = build.graphData;
  if (graphDataMatchesCurrent(stored.bytes, graphData)) {
    return { kind: "ready", graphData, commit: async () => {} };
  }
  return {
    kind: "ready",
    graphData,
    commit: () => writeGraphData(workspace.root, graphData),
  };
}

/**
 * The shared pre-answer step (SPEC 13.3): analyze the current workspace;
 * on validation findings or configuration errors, fail without modifying
 * anything; otherwise ensure the stored graph data matches the current
 * sources and configuration — refreshing it if missing or mismatched,
 * writing exactly what `xspec build` would write except that no TypeScript
 * or Markdown is generated or removed and the recorded derived-file paths
 * are left unchanged — and hand back the analysis to answer from. The
 * composition of `analyzeWorkspaceForRead` and `assessWorkspaceRead` for
 * callers whose argument checks all precede the analysis.
 */
export async function prepareWorkspaceForRead(
  workspace: LoadedWorkspace,
): Promise<WorkspacePreparation> {
  const analyzed = await analyzeWorkspaceForRead(workspace);
  if (analyzed.kind === "configuration") {
    return analyzed;
  }
  const assessed = await assessWorkspaceRead(workspace, analyzed.analysis);
  if (assessed.kind === "findings") {
    return assessed;
  }
  await assessed.commit();
  return {
    kind: "ready",
    analysis: analyzed.analysis,
    graphData: assessed.graphData,
  };
}
