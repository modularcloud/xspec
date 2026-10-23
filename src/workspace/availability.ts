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
// files, no record consulted. Either way the answer itself comes from the
// fresh analysis, so the caller's answer never depends on the store;
// refresh participation is the 13.3 side effect alone.
//
// SPEC 11.2: past their argument checks, these surfaces judge those
// validations "exactly as the gate of 13.3 does, making every read it
// makes whatever findings the sources carry — the journal's (14.13) and
// the kinds of `build`'s write-path directory components (14.22)
// included". So the judgement is the gate's own assessment
// (`assessWorkspaceRead`, ./refresh.ts, over ./build-validation.ts), run
// whole on either side: every analysis reads the journal (./pipeline.ts),
// and the write-path kind reads are made whatever the sources' findings. A
// read the environment refuses there (14.25), or a refresh write it
// refuses (14.24), alone stops these surfaces — thrown at the read or the
// write, a usage error before any answer (SPEC 12.0, 13.3).
//
// Unlike the gated reads, a failing workspace is not a report here: its
// gate findings reach the answer only through the SPEC 11.2
// consulted-domain selection (core/availability.ts) — a journal or
// write-path condition is no domain file's finding and accompanies no
// answer. Configuration errors keep their exit-2 precedence (SPEC 14.14).
//
// IMPLEMENTATION (Architecture): this workspace-layer module owns the I/O
// of the step — the analysis pipeline (./pipeline.ts) and, through the
// gate's assessment (./refresh.ts), the write-path examination, the store
// load, and the one refresh write (./graph-data.ts) over the pure
// derivation of core/build.ts — so refresh and build agree byte for byte
// (SPEC 12.0).

import type { Finding } from "../core/findings.js";
import type { LoadedWorkspace } from "./config.js";
import type { WorkspaceAnalysis } from "./pipeline.js";
import { analyzeWorkspace } from "./pipeline.js";
import { assessWorkspaceRead } from "./refresh.js";

/** The outcome of the SPEC 11.2 pre-answer step. */
export type AvailabilityPreparation =
  | {
      /**
       * Answer from `analysis` per SPEC 11.2 — on a passing workspace the
       * stored graph data now matches the current sources and configuration
       * (refreshed if it did not, SPEC 13.3); on a failing one nothing was
       * modified and no record consulted. The caller selects the consulted
       * domain's findings itself (core/availability.ts) — a failing
       * workspace is not a report on these surfaces.
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
 * workspace — a pure read of the sources and the journal, nothing modified
 * — failing only with configuration-error precedence (SPEC 14.14).
 * Callers whose argument checks consult discovery (`view`'s operand
 * membership, SPEC 11.4) run them between this and
 * `finishAvailabilityRefresh`: the checks precede the judgement and the
 * answer (SPEC 11.2, 12.0), and a failing invocation writes nothing.
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
 * The judgement-and-refresh half of the SPEC 11.2 pre-answer step: judge
 * `build`'s validations exactly as the gate of 13.3 does
 * (`assessWorkspaceRead`), making every read it makes whatever findings
 * the sources carry — a refused one stops the surface with the read
 * failure (SPEC 14.25) — then, on a workspace failing them (source
 * findings, journal errors, and refused writes alike, SPEC 13.3), write
 * nothing and consult no record; on a passing one participate in read-time
 * refresh exactly as the reads of 13.3 do, a refused write stopping the
 * surface with the write failure (SPEC 14.24). The answer itself always
 * comes from `analysis`, never from the store.
 */
export async function finishAvailabilityRefresh(
  workspace: LoadedWorkspace,
  analysis: WorkspaceAnalysis,
): Promise<void> {
  // SPEC 11.2, 13.3: the gate's judgement, whole — the kinds of `build`'s
  // write-path directory components (14.22) read on the failing side too.
  // Its findings are no report here: the surface selects its consulted
  // domain's findings from `analysis` itself (core/availability.ts).
  const assessed = await assessWorkspaceRead(workspace, analysis);
  if (assessed.kind === "findings") {
    // SPEC 11.2/13.3: the workspace fails `build`'s validations — answer
    // from the current sources; no store read, no write.
    return;
  }

  // Passing workspace: read-time refresh participation (SPEC 13.3), the
  // gated reads' own commit — matching graph data is served as is;
  // missing, mismatched, or unreadable graph data is rewritten as `build`
  // would write it, the snapshot file alone. The record is left unchanged
  // in every state (SPEC 13.3, 14.23): absent stays absent, readable stays
  // byte-for-byte, and recorded state that exists but cannot be read as a
  // record is neither read, repaired, nor replaced, no finding reported
  // for it, until a successful `build` or a finishing `rename`/`move`
  // regeneration replaces the record.
  await assessed.commit();
}

/**
 * The SPEC 11.2 pre-answer step: analyze the current workspace; on
 * configuration errors fail with exit-2 precedence; judge `build`'s
 * validations exactly as the gate of 13.3 does; on a workspace failing
 * them answer from the analysis, writing nothing; on a passing one
 * participate in read-time refresh exactly as the reads of 13.3 do, then
 * answer from the same analysis.
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
