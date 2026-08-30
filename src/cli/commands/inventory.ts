// `xspec inventory` (SPEC 11.6).
//
// Reports the machine-readable shape of the workspace — anchoring, resolved
// configuration, discovered sources, the derived-file map, the recorded
// derived paths, the graph-data area, and the durable files — as a single
// JSON document in the 12.7 inventory form. JSON-only (SPEC 11): the
// document is its only output form, with or without `--json`.
//
// The inventory parses no sources, so it answers whatever the sources'
// validity: it runs discovery (the walk and classification — glob-driven,
// never parse-driven) but no per-file analysis, reads no journal or session
// content, and never refreshes or writes anything (SPEC 11.6, 13.3).
// Configuration errors keep their precedence (SPEC 14.14): a missing or
// invalid configuration exits 2 upstream of this handler, and a
// discovery-level configuration error (a file matched by both a spec and a
// code group, SPEC 7.2) exits 2 here, before any answer. The findings a
// listed file or path may bear — an invalid source path (14.19), a journal
// error (14.13), a corrupt session (14.21) — are reported where their
// conditions assign them, never here: the one finding an inventory answer
// ever carries is condition 23 (SPEC 14.23), met in the record-supplied
// datum, with the answer's every other member emitted in full at exit 1.

import type { JsonObject, JsonValue } from "../../core/canonical-json.js";
import { canonicalJson } from "../../core/canonical-json.js";
import type { Configuration, PolicySelector } from "../../core/config.js";
import { specSourceDerivedPaths } from "../../core/discovery.js";
import type { SourceClassification } from "../../core/discovery.js";
import type { ExitCode } from "../../core/findings.js";
import { codeExitClass, orderFindings } from "../../core/findings.js";
import {
  GRAPH_DATA_AREA,
  unreadableRecordFinding,
} from "../../core/graph-data.js";
import { JOURNAL_PATH } from "../../core/journal.js";
import type { PathText } from "../../core/path-text.js";
import { comparePathTexts, pathTextJson } from "../../core/path-text.js";
import { anchoredPathSpelling } from "../../workspace/anchor.js";
import { discoverSources } from "../../workspace/discovery.js";
import { readDerivedFileRecord } from "../../workspace/graph-data.js";
import { journalOccupied } from "../../workspace/journal.js";
import { listSessionFilePaths } from "../../workspace/reviews.js";
import type { Invocation } from "../args.js";
import { jsonOutputInEffect } from "../args.js";
import type { CommandContext } from "../io.js";
import {
  emitConfigurationErrors,
  findingToJson,
  unavailableJson,
} from "../report.js";

/**
 * One discovered file as the inventory lists it (SPEC 11.6): its path as
 * data, its exact bytes (the ordering and derived-path space), the kind of
 * its memberships, and the matching group names in configuration order.
 */
interface ListedSource {
  readonly path: PathText;
  readonly bytes: Uint8Array;
  readonly kind: "spec" | "code";
  readonly groups: readonly string[];
}

/**
 * Every discovered source file — valid spec and code sources and the files
 * 14.19 rejects alike: discovery is glob-driven, never parse-driven (SPEC
 * 7, 11.6) — in byte order of workspace-relative path (SPEC 11.6).
 */
function listDiscoveredSources(
  classification: SourceClassification,
): ListedSource[] {
  const utf8Encoder = new TextEncoder();
  const listed: ListedSource[] = [
    ...classification.specSources.map((source): ListedSource => ({
      path: source.path,
      bytes: utf8Encoder.encode(source.path),
      kind: "spec",
      groups: source.groups,
    })),
    ...classification.codeSources.map((source): ListedSource => ({
      path: source.path,
      bytes: utf8Encoder.encode(source.path),
      kind: "code",
      groups: source.groups,
    })),
    ...classification.invalidSources.map((source): ListedSource => ({
      path: source.path,
      bytes: source.bytes,
      kind: source.kind,
      groups: source.groups,
    })),
  ];
  listed.sort((a, b) => comparePathTexts(a.path, b.path));
  return listed;
}

/** One group definition of the resolved view: `{"name", "globs"}` (12.7). */
function groupDefJson(group: {
  readonly name: string;
  readonly patterns: readonly string[];
}): JsonObject {
  return { name: group.name, globs: [...group.patterns] };
}

/**
 * A resolved policy selector (SPEC 7.5, 12.7): `{"group", "kind"}` with the
 * kind explicit though inferred, `{"files"}`, or `{"tags"}`.
 */
function policySelectorJson(selector: PolicySelector): JsonObject {
  switch (selector.selector) {
    case "group":
      return { group: selector.group, kind: selector.groupKind };
    case "files":
      return { files: selector.pattern };
    case "tags":
      return { tags: [...selector.tags] };
  }
}

/**
 * The resolved configuration view (SPEC 11.6, 12.7): every default and
 * inferred kind explicit — an absent `markdown` key resolves to
 * `{"emit": false, "outDir": null}` (7.3), `targetTags` null where absent —
 * groups, profiles, and rules in configuration order, each carried with its
 * complete definition; group references stay the configured group names,
 * resolving against the group lists this same view reports.
 */
function configurationViewJson(configuration: Configuration): JsonObject {
  return {
    specs: configuration.specGroups.map(groupDefJson),
    code: configuration.codeGroups.map(groupDefJson),
    markdown: {
      emit: configuration.markdown?.emit ?? false,
      outDir: configuration.markdown?.outDir ?? null,
    },
    coverage: configuration.coverage.map((profile): JsonObject => ({
      name: profile.name,
      target: profile.target,
      targetTags:
        profile.targetTags === undefined ? null : [...profile.targetTags],
      targets: profile.targets,
      boundary: profile.boundary,
      boundaryKind: profile.boundaryKind,
      mode: profile.mode,
      edgeKinds: [...profile.edgeKinds],
    })),
    policy: configuration.policy.map((rule): JsonObject => ({
      name: rule.name,
      type: rule.type,
      from: policySelectorJson(rule.from),
      to: policySelectorJson(rule.to),
      kinds: [...rule.kinds],
    })),
  };
}

/** The `inventory` command handler (SPEC 11.6). */
export async function inventoryCommand(
  invocation: Invocation,
  context: CommandContext,
): Promise<ExitCode> {
  const { workspace } = context;
  const { configuration } = workspace;

  // SPEC 11.6: discovery — the walk and glob classification, no parsing.
  const classification = await discoverSources(workspace.root, configuration);

  // SPEC 14.14: configuration errors keep their precedence — a
  // discovery-level configuration error (a file matched by both a spec and
  // a code group, SPEC 7.2) is usage-class, exit 2, no inventory. The
  // finding-class conditions of discovery (14.19) are reported where their
  // conditions assign them (build/check), never here (SPEC 11.6).
  const configurationErrors = classification.findings.filter(
    (finding) => codeExitClass(finding.code) === 2,
  );
  if (configurationErrors.length > 0) {
    emitConfigurationErrors(
      context,
      jsonOutputInEffect(invocation),
      workspace.configAnchor,
      configurationErrors,
    );
    return 2;
  }

  // SPEC 11.6: the record-supplied datum (13.3, 14.23), durable-file
  // presence (6.1: occupancy alone, no content read), and the session
  // files by name alone (10.1) — no journal or session content is read.
  const record = await readDerivedFileRecord(workspace.root);
  const occupied = await journalOccupied(workspace.root);
  const sessions = await listSessionFilePaths(workspace.root);

  const sources = listDiscoveredSources(classification);
  const derivedEntries: JsonValue[] = [];
  for (const source of sources) {
    if (source.kind !== "spec") continue;
    // SPEC 11.6/13.1: per discovered spec source, the derived paths
    // determined by configuration and discovery alone — the non-`.mdx`
    // file's members the stated structural-absence null (12.7).
    const derived = specSourceDerivedPaths(source.bytes, configuration);
    derivedEntries.push({
      source: pathTextJson(source.path),
      module: derived.module === null ? null : pathTextJson(derived.module),
      markdown:
        derived.markdown === null ? null : pathTextJson(derived.markdown),
    });
  }

  // SPEC 14.23: an unreadable record is the one finding an inventory
  // answer ever carries — the datum explicitly unavailable, never
  // fabricated and never read as an empty record; everything else in full.
  const findings = orderFindings(
    record.state === "unreadable" ? [unreadableRecordFinding()] : [],
  );
  const recorded: JsonValue =
    record.state === "readable"
      ? [...record.paths]
      : record.state === "absent"
        ? [] // SPEC 11.6: a missing store is an empty record.
        : unavailableJson();

  // SPEC 12.7: the ten-member inventory document form. The anchoring is
  // pure invocation input (SPEC 11.6, 12.0): the workspace root and the
  // configuration file relative to the invocation working directory in the
  // canonical spelling (workspace/anchor.ts).
  const document: JsonValue = {
    findings: findings.map(findingToJson),
    root: anchoredPathSpelling(context.cwd, workspace.root),
    config: workspace.configAnchor,
    configuration: configurationViewJson(configuration),
    sources: sources.map((source): JsonObject => ({
      path: pathTextJson(source.path),
      groups: source.groups.map((name): JsonObject => ({
        name,
        kind: source.kind,
      })),
    })),
    derived: derivedEntries,
    recorded,
    graphData: GRAPH_DATA_AREA,
    journal: { path: JOURNAL_PATH, occupied },
    sessions,
  };
  context.stdout.write(canonicalJson(document));
  // SPEC 12.0/11.6: an answer carrying a finding or explicitly-unavailable
  // data exits 1, emitted in full; a complete, finding-free answer exits 0.
  return findings.length > 0 ? 1 : 0;
}
