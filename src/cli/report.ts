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

import type { ResolvedOccurrence } from "../core/availability.js";
import { canonicalJson } from "../core/canonical-json.js";
import type { JsonObject, JsonValue } from "../core/canonical-json.js";
import type { Finding, FindingLocation } from "../core/findings.js";
import { orderFindings } from "../core/findings.js";
import type { IdentityMapping } from "../core/journal.js";
import { pathTextJson, renderPathText } from "../core/path-text.js";
import type { CliWriter, CommandIo } from "./io.js";

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
 * The applied-mapping report of a successful `rename`/`move` (SPEC 6.4,
 * 6.5): the complete identity mapping the operation journaled — the
 * information of the preview's `mapping` (6.6), carried in JSON per 12.0.
 * The JSON document carries the mapping under the preview's pinned
 * `mapping` member encoding (SPEC 12.7): one `{"from", "to"}` per mapped
 * identity, ordered by `from` bytes — exactly the journal entry's canonical
 * order (core/journal.ts) — beside the consulted domain's (empty) findings.
 * The human form presents the same information (SPEC 12.0): one
 * `FROM -> TO` line per pair in the same order, closed by a one-line count.
 * Identities and paths are workspace-relative and the mapping order is
 * canonical, so both forms are byte-deterministic (SPEC 12.0).
 */
export function emitAppliedMappingReport(
  json: boolean,
  stdout: CliWriter,
  mapping: readonly IdentityMapping[],
): void {
  if (json) {
    const document: JsonValue = {
      findings: [],
      mapping: mapping.map((pair) => ({ from: pair.from, to: pair.to })),
    };
    stdout.write(canonicalJson(document));
    return;
  }
  const lines = mapping.map((pair) => `${pair.from} -> ${pair.to}\n`);
  const count = mapping.length;
  lines.push(`${String(count)} identit${count === 1 ? "y" : "ies"} mapped\n`);
  stdout.write(lines.join(""));
}

/** The SPEC 12.7 unavailability marker — the one explicit-absence form. */
export function unavailableJson(): JsonObject {
  return { unavailable: true };
}

/**
 * One reference occurrence record as JSON data — exactly the five-member
 * record form of SPEC 12.7: `{"file", "range", "kind", "source", "target"}`
 * — the referencing file through the shared path-value renderer (marked
 * byte form for a non-UTF-8 path, SPEC 12.0), the occurrence's own range,
 * its edge kind, the source graph node as `{"identity", "range"}` or the
 * unavailability marker (one datum per SPEC 11.2 — never `null`), and the
 * resolved target's identity. Shared by every emitter of occurrence
 * records (SPEC 11.3, 11.4, 11.5).
 */
export function occurrenceRecordJson(record: ResolvedOccurrence): JsonObject {
  return {
    file: pathTextJson(record.file),
    range: { start: record.range.start, end: record.range.end },
    kind: record.kind,
    source:
      record.source === null
        ? unavailableJson()
        : {
            identity: record.source.identity,
            range: {
              start: record.source.range.start,
              end: record.source.range.end,
            },
          },
    target: record.target,
  };
}

/**
 * A plain usage error as the finding form of SPEC 12.7: `code` and `path`
 * null — SPEC 14 assigns usage errors no stable code and no concerned
 * workspace path (they describe the invocation the consuming tool itself
 * composed) — locations and identities empty, the diagnostic as the
 * message.
 */
export function usageErrorFinding(message: string): Finding {
  return { code: null, message, locations: [], path: null, identities: [] };
}

/**
 * The exit-2 error document of SPEC 12.0/12.7 — `{"error": …}` holding one
 * finding form — as the entire standard output. Emitted exactly when JSON
 * output is in effect (`--json` among the arguments, or a JSON-only
 * surface); the caller writes the stderr diagnostics and exits 2 either
 * way.
 */
export function emitErrorDocument(stdout: CliWriter, finding: Finding): void {
  const document: JsonValue = { error: findingToJson(finding) };
  stdout.write(canonicalJson(document));
}

/**
 * The one condition-14 finding of an exit-2 configuration error (SPEC 12.7:
 * "One invocation reports one error" — a configuration file with several
 * distinct defects is a single finding, its message deterministic but
 * otherwise unpinned). The concerned path is the configuration file in the
 * anchoring form of 11.6, relative to the invocation working directory, or
 * `.` for a failed upward search with no `--config` (SPEC 14); locations
 * stay empty — a configuration error is an unlocated condition (SPEC 14).
 */
export function configurationErrorFinding(
  findings: readonly Finding[],
  configAnchor: string,
): Finding {
  // The per-defect messages joined in the pinned findings order (SPEC 12.7)
  // keep the merged message deterministic (SPEC 12.0).
  const message = orderFindings(findings)
    .map((finding) => finding.message)
    .join("; ");
  return {
    code: "configuration-error",
    message,
    locations: [],
    path: configAnchor,
    identities: [],
  };
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
 * defect as a standard-error diagnostic line and, when JSON output is in
 * effect, the exit-2 error document of 12.0/12.7 as the entire standard
 * output — one finding however many defects, its concerned path the
 * anchored configuration path (SPEC 14). The caller exits 2; stderr
 * diagnostics are identical whatever the output form (SPEC 12.0).
 */
export function emitConfigurationErrors(
  io: CommandIo,
  jsonInEffect: boolean,
  configAnchor: string,
  findings: readonly Finding[],
): void {
  for (const finding of findings) {
    io.stderr.write(renderConfigurationError(finding));
  }
  if (jsonInEffect) {
    emitErrorDocument(
      io.stdout,
      configurationErrorFinding(findings, configAnchor),
    );
  }
}
