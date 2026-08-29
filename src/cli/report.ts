// Findings-report rendering (SPEC 12.0, 12.7, 14).
//
// IMPLEMENTATION (cross-cutting rules): reports are built as data (the
// Finding model, core/findings.ts) and rendered once per output form —
// human and JSON — by this CLI layer. SPEC 12.0: the report, findings
// included (a failing `build`'s validation errors and `check` findings are
// reports), is standard-output content; with `--json` the single JSON
// document is the entire standard output. Usage and configuration error
// messages (exit 2) are standard-error content; the exit-2 renderer for
// them lives here too so every command reports them identically.
//
// Every emitter applies the SPEC 12.7 findings-array discipline through one
// choke point (core/findings.ts `orderFindings`): the pinned total order and
// duplicate collapse, identically in the human and JSON forms. The JSON
// finding is exactly the five-member 12.7 finding form; the human line
// presents the same information — code, every location, concerned path,
// context identities, message (SPEC 14, 12.0).
//
// All rendering is byte-deterministic for identical findings (SPEC 12.0):
// static text, workspace-relative paths, and byte offsets only — no
// absolute paths, no wall clock, no environment-dependent content.

import { canonicalJson } from "../core/canonical-json.js";
import type { JsonObject, JsonValue } from "../core/canonical-json.js";
import type { Finding, FindingLocation } from "../core/findings.js";
import { orderFindings } from "../core/findings.js";
import { pathTextJson, renderPathText } from "../core/path-text.js";
import type { CliWriter } from "./io.js";

/**
 * A location as human text: `FILE:START-END` — the file through the shared
 * deterministic path spelling (core/path-text.ts): a non-UTF-8 path (SPEC
 * 14.19) renders as its exact bytes, never lossily (SPEC 12.0).
 */
function renderLocation(location: FindingLocation): string {
  return `${renderPathText(location.file)}:${String(location.range.start)}-${String(location.range.end)}`;
}

/**
 * One finding as a human report line, presenting the same information as
 * the 12.7 JSON finding form (SPEC 14, 12.0): the primary location (or the
 * concerned path) as the prefix, the stable code as the label, the
 * actionable message, any further locations, and the context identities.
 */
function renderFindingLine(finding: Finding): string {
  let prefix = "";
  if (finding.locations.length > 0) {
    prefix = `${renderLocation(finding.locations[0]!)}: `;
  } else if (finding.path !== null) {
    prefix = `${renderPathText(finding.path)}: `;
  }
  const label = finding.code ?? "finding";
  const more =
    finding.locations.length > 1
      ? ` (also at ${finding.locations
          .slice(1)
          .map(renderLocation)
          .join(", ")})`
      : "";
  const identities =
    finding.identities.length > 0 ? ` [${finding.identities.join(", ")}]` : "";
  return `${prefix}${label}: ${finding.message}${more}${identities}\n`;
}

/**
 * The human findings report: the SPEC 12.7 order and collapse, one line per
 * finding, closed by a one-line count. Standard-output content (SPEC 12.0).
 */
export function renderFindingsHuman(findings: readonly Finding[]): string {
  const ordered = orderFindings(findings);
  const lines = ordered.map(renderFindingLine);
  const count = ordered.length;
  lines.push(`${String(count)} finding${count === 1 ? "" : "s"}\n`);
  return lines.join("");
}

/**
 * One finding as JSON data — exactly the five-member finding form of SPEC
 * 12.7: `{"code", "message", "locations", "path", "identities"}`, `null`
 * never omitted, empty lists `[]`. Location files and the concerned path go
 * through the one shared path-value renderer (core/path-text.ts): a plain
 * JSON string, or the marked byte form for a non-UTF-8 path (SPEC 12.0,
 * 12.7, 14.19).
 */
export function findingToJson(finding: Finding): JsonObject {
  return {
    code: finding.code,
    message: finding.message,
    locations: finding.locations.map((location) => ({
      file: pathTextJson(location.file),
      range: { start: location.range.start, end: location.range.end },
    })),
    path: finding.path === null ? null : pathTextJson(finding.path),
    identities: [...finding.identities],
  };
}

/**
 * The findings report as the single JSON document of `--json` (SPEC 12.0,
 * 12.7: `{"findings": […]}` in the pinned order, duplicates collapsed; the
 * canonical serializer keeps it byte-deterministic). An empty findings list
 * is the exit-0 document of a command whose report is its findings
 * (`build`, `check`).
 */
export function findingsReportJson(findings: readonly Finding[]): string {
  const document: JsonValue = {
    findings: orderFindings(findings).map(findingToJson),
  };
  return canonicalJson(document);
}

/**
 * Emit the findings report in the invocation's output form (SPEC 12.0): the
 * whole report on standard output — with `--json`, exactly one JSON
 * document.
 */
export function emitFindingsReport(
  json: boolean,
  stdout: CliWriter,
  findings: readonly Finding[],
): void {
  stdout.write(
    json ? findingsReportJson(findings) : renderFindingsHuman(findings),
  );
}

/**
 * SPEC 12.0/14.14: render one configuration-error finding as a diagnostic
 * line. Configuration errors are usage errors: the message is
 * standard-error content.
 */
export function renderConfigurationError(finding: Finding): string {
  const location =
    finding.path === null ? "" : `${renderPathText(finding.path)}: `;
  return `xspec: configuration error: ${location}${finding.message}\n`;
}

/**
 * Report configuration errors (SPEC 14.14) the way every command must: each
 * as a standard-error diagnostic line. The caller exits 2. (The exit-2 JSON
 * error document of 12.0/12.7 — the standard-output half when JSON output
 * is in effect — is emitted by the caller's error path, not here; stderr
 * diagnostics are identical either way.)
 */
export function emitConfigurationErrors(
  stderr: CliWriter,
  findings: readonly Finding[],
): void {
  for (const finding of findings) {
    stderr.write(renderConfigurationError(finding));
  }
}
