// The shared `--preview` completion for `rename` and `move` (SPEC 6.6).
//
// A preview performs the full validation and planning of the operation and
// reports its consequences while modifying nothing — no sources, no
// journal, no derived files, no graph data. The command handlers share the
// operation's own validation and plan derivation (SPEC 6.6: refused exactly
// when the real operation would be; the plan is one plan) and finish here:
// the derived-file delta over the recorded derived-file paths (SPEC 6.6,
// 13.3) and the preview report in both output forms (SPEC 12.0, 12.7).
//
// The delta (SPEC 6.6): `generated` is the derived paths the operation
// would newly generate — paths where nothing is currently recorded as
// generated — and `removed` the recorded derived paths the operation would
// leave no longer generated. Both directions consult the record alone; a
// preview, writing nothing, never refreshes it. Recorded state that exists
// but cannot be read as a record is condition 23 (SPEC 14.23): the delta is
// reported explicitly unavailable — never fabricated, never read as an
// empty record — one `unreadable-record` finding accompanies (concerned
// path the graph-data area), the invocation exits 1, and every other part
// of the preview is emitted in full. A refused preview consults no record —
// the refusal findings alone, `mapping`/`files`/`delta` null (SPEC 12.7) —
// so no condition-23 finding ever accompanies a refusal.

import { generatedDerivedPaths } from "../../core/build.js";
import type { ExitCode, Finding } from "../../core/findings.js";
import {
  GRAPH_DATA_PATH,
  unreadableRecordFinding,
} from "../../core/graph-data.js";
import type { IdentityMapping } from "../../core/journal.js";
import type { PreviewFileEdits } from "../../core/preview.js";
import { derivedFileDelta } from "../../core/preview.js";
import type { LoadedWorkspace } from "../../workspace/config.js";
import { readDerivedFileRecord } from "../../workspace/graph-data.js";
import type { CliWriter } from "../io.js";
import { emitPreviewReport } from "../report.js";

/**
 * SPEC 6.6/12.7: a refused preview keeps the preview document form — the
 * refusal findings (workspace-precondition findings and refusal-reason
 * findings alike, exactly what the real operation would report) with
 * `mapping`, `files`, and `delta` null — and exits 1. No record is
 * consulted (SPEC 6.6).
 */
export function emitRefusedPreview(
  json: boolean,
  stdout: CliWriter,
  findings: readonly Finding[],
): ExitCode {
  emitPreviewReport(json, stdout, findings, null);
  return 1;
}

/**
 * Complete a preview whose operation would proceed (SPEC 6.6): read the
 * recorded derived-file paths (the one record consult, SPEC 13.3, 14.23),
 * derive the delta against the post-operation generation set over
 * `postSpecPaths` (the spec source paths as they would stand after the
 * operation), and emit the full preview report. Exit 0 for the complete,
 * finding-free answer; exit 1 with everything emitted in full where the
 * record exists but cannot be read (SPEC 14.23, 12.0).
 */
export async function emitSuccessfulPreview(
  json: boolean,
  stdout: CliWriter,
  workspace: LoadedWorkspace,
  mapping: readonly IdentityMapping[],
  files: readonly PreviewFileEdits[],
  postSpecPaths: readonly string[],
): Promise<ExitCode> {
  const record = await readDerivedFileRecord(workspace.root);
  if (record.state === "unreadable") {
    emitPreviewReport(json, stdout, [unreadableRecordFinding()], {
      mapping,
      files,
      delta: "unavailable",
    });
    return 1;
  }
  // SPEC 6.6: an absent record records nothing — the empty-record success
  // path, never condition 23. The graph-data path is never recorded
  // (SPEC 13.3); a record naming it anyway is dropped defensively, as the
  // build's orphan domain drops it.
  const recorded =
    record.state === "readable"
      ? record.paths.filter((path) => path !== GRAPH_DATA_PATH)
      : [];
  emitPreviewReport(json, stdout, [], {
    mapping,
    files,
    delta: derivedFileDelta(
      recorded,
      generatedDerivedPaths(workspace.configuration, postSpecPaths),
    ),
  });
  return 0;
}
