// The shared SPEC 11.2 availability machinery — the per-file layer behind
// the query surfaces `occurrences` (11.3), `view` (11.4), and `at` (11.5).
//
// Pure core (IMPLEMENTATION Architecture): these surfaces answer per file,
// from parsing alone, never gated on workspace-wide validity (SPEC 11.2).
// Every answer has a consulted domain of files, and the findings of every
// domain file — and those alone — accompany the answer: a finding is a
// domain file's exactly when one of its locations lies in that file or that
// file is its concerned path (SPEC 14.19), which makes a condition several
// files jointly violate (a cross-file cycle, 14.9 — one finding locating
// every participating construct, SPEC 14) accompany whole whenever any
// participating file lies in the domain. A gate condition that is no domain
// file's finding — the journal's (14.13), a write path's (14.22) —
// accompanies no answer of these surfaces (SPEC 11.2).
//
// An invocation whose answer carries any finding or any explicitly-
// unavailable datum exits 1 with the full answer still emitted; a complete,
// finding-free answer exits 0 (SPEC 11.2, 12.0). The workspace-layer
// pre-answer step (src/workspace/availability.ts) supplies the analysis
// these functions select from; the CLI renders the 12.7 document forms.

import type { ByteRange } from "./bytes.js";
import type { SourceClassification } from "./discovery.js";
import type { Finding } from "./findings.js";
import type { CompiledGlob } from "./glob.js";
import type { DependencyEdgeKind, WorkspaceGraph } from "./graph.js";
import type { PathText } from "./path-text.js";
import { pathTextKey } from "./path-text.js";
import {
  containsControl,
  containsWhitespace,
  FORBIDDEN_SEGMENT_NAMES,
} from "./text.js";

/**
 * The consulted domain of one availability answer (SPEC 11.2): a set of
 * discovered files, membership by exact path bytes (SPEC 12.0 — one byte
 * space over both path presentation forms, so an invalid-path file's marked
 * byte form and a plain string never collide or diverge).
 */
export class ConsultedDomain {
  private readonly keys: ReadonlySet<string>;

  constructor(files: Iterable<PathText>) {
    const keys = new Set<string>();
    for (const file of files) {
      keys.add(pathTextKey(file));
    }
    this.keys = keys;
  }

  /** Whether `path` names a domain file (exact byte membership). */
  has(path: PathText): boolean {
    return this.keys.has(pathTextKey(path));
  }
}

/**
 * The discovered files a `--file` restriction admits (SPEC 11.3): the
 * discovered source files — spec and code alike, invalid-path (14.19)
 * members included: they are discovered files (SPEC 11.2) — that the glob
 * matches, under the glob rules of 7 (byte-wise against the
 * workspace-relative path). Without a glob, the entire discovered set. A
 * glob admitting nothing admits the empty set — a set restriction, not an
 * existence assertion (SPEC 11.3); discovery is controlled exclusively by
 * configuration (SPEC 7), so an on-disk file no group discovers is never
 * admitted, whatever patterns match it.
 */
export function discoveredDomain(
  classification: SourceClassification,
  glob?: CompiledGlob,
): ConsultedDomain {
  const files: PathText[] = [];
  for (const source of classification.specSources) {
    if (glob === undefined || glob.matches(source.path)) {
      files.push(source.path);
    }
  }
  for (const source of classification.codeSources) {
    if (glob === undefined || glob.matches(source.path)) {
      files.push(source.path);
    }
  }
  for (const source of classification.invalidSources) {
    // SPEC 7: matching is byte-wise against the workspace-relative path —
    // an invalid path's exact bytes, which may have no plain string form.
    if (glob === undefined || glob.matches(source.bytes)) {
      files.push(source.path);
    }
  }
  return new ConsultedDomain(files);
}

/**
 * The findings accompanying an answer over `domain` (SPEC 11.2): every
 * finding one of whose locations lies in a domain file or whose concerned
 * path is a domain file. A jointly-violated condition carries a location
 * for every participating construct (SPEC 14), so it accompanies whole
 * whenever any participant is in the domain; a condition with neither an
 * in-domain location nor an in-domain concerned path — the journal's 14.13,
 * a write path's 14.22, a policy violation's 14.12 — accompanies no answer.
 * Input order is preserved (the emitters re-order per SPEC 12.7).
 */
export function accompanyingFindings(
  findings: readonly Finding[],
  domain: ConsultedDomain,
): Finding[] {
  return findings.filter(
    (finding) =>
      finding.locations.some((location) => domain.has(location.file)) ||
      (finding.path !== null && domain.has(finding.path)),
  );
}

/**
 * Why `spelling` is not a syntactically well-formed requirement-node
 * identity — `path#id`, or a bare `path` for a root (SPEC 1.5) — or null
 * when it is (SPEC 11.3): well-formed exactly when it contains at most one
 * `#`, its path part (the whole spelling, or the part before the `#`) is
 * non-empty, and, when a `#` is present, the part after it is one or more
 * non-empty segments joined by `.`, each satisfying the segment rules of
 * 1.4. Acceptance is syntactic: whether the named identity resolves is no
 * part of this check (SPEC 11.3, 12.0).
 */
export function nodeSpellingProblem(spelling: string): string | null {
  const firstHash = spelling.indexOf("#");
  if (firstHash !== -1 && spelling.indexOf("#", firstHash + 1) !== -1) {
    return 'it contains more than one "#" (SPEC 12.0: at most one is well-formed)';
  }
  const pathPart = firstHash === -1 ? spelling : spelling.slice(0, firstHash);
  if (pathPart.length === 0) {
    return "its path part is empty";
  }
  if (firstHash === -1) {
    return null;
  }
  const idPart = spelling.slice(firstHash + 1);
  for (const segment of idPart.split(".")) {
    if (segment.length === 0) {
      return idPart.length === 0
        ? 'its id part after "#" is empty (one or more segments required)'
        : "its id part has an empty segment";
    }
    if (FORBIDDEN_SEGMENT_NAMES.has(segment)) {
      return (
        `its id segment ${JSON.stringify(segment)} is one of the forbidden ` +
        `names ("$", "__proto__", "prototype", "constructor", "then") ` +
        `(SPEC 1.4)`
      );
    }
    if (containsWhitespace(segment)) {
      return `its id segment ${JSON.stringify(segment)} contains whitespace (SPEC 1.4)`;
    }
    if (containsControl(segment)) {
      return `its id segment ${JSON.stringify(segment)} contains a control character (SPEC 1.4)`;
    }
    // SPEC 1.4's no-"." rule is structural under the split; a "#" inside a
    // segment is impossible under the at-most-one-"#" rule above.
  }
  return null;
}

/**
 * A reference occurrence as answered (SPEC 5.7, 11.3): every datum of 5.7
 * with the source graph node resolved to its one-datum form — the node's
 * identity together with that node's own source range (SPEC 1.7), or null
 * exactly where 11.2 leaves the source node's identity undefined (a section
 * without a usable identity; every node of an invalid-path file), the datum
 * then reported explicitly unavailable (SPEC 12.7).
 */
export interface ResolvedOccurrence {
  readonly file: PathText;
  readonly range: ByteRange;
  readonly kind: DependencyEdgeKind;
  readonly source: {
    readonly identity: string;
    readonly range: ByteRange;
  } | null;
  readonly target: string;
}

/**
 * The occurrence records of an answer (SPEC 11.3): the graph's occurrences
 * — already in occurrence order (SPEC 5.7) — whose referencing file lies in
 * the domain and, with `to` given, whose resolved target it names (the two
 * filters combine conjunctively). `to` selection is by exact identity
 * (byte-wise, SPEC 12.0): an unknown or unresolving identity is no record's
 * target and selects nothing (SPEC 11.3). Each record's source datum joins
 * the source node's own range through the graph node itself — a requirement
 * node's section construct range (the entire file for a root) or a code
 * location's range (SPEC 1.7, 5.7).
 */
export function selectOccurrences(
  graph: WorkspaceGraph,
  domain: ConsultedDomain,
  to?: string,
): ResolvedOccurrence[] {
  const records: ResolvedOccurrence[] = [];
  for (const occurrence of graph.occurrences) {
    if (!domain.has(occurrence.file)) continue;
    if (to !== undefined && occurrence.target !== to) continue;
    records.push({
      file: occurrence.file,
      range: occurrence.range,
      kind: occurrence.kind,
      source: resolveOccurrenceSource(graph, occurrence.source),
      target: occurrence.target,
    });
  }
  return records;
}

/**
 * The source datum's range half (SPEC 5.7): identity and range travel
 * together as one datum, the range read from the identified graph node —
 * `RequirementNode.section.range` (the entire file for a root, SPEC 1.7) or
 * `CodeLocationNode.range`. Null stays null (explicitly unavailable).
 */
function resolveOccurrenceSource(
  graph: WorkspaceGraph,
  source: string | null,
): { readonly identity: string; readonly range: ByteRange } | null {
  if (source === null) return null;
  const node = graph.node(source);
  if (node === undefined) {
    // Unreachable: every occurrence's source identity is a node of the same
    // graph (core/graph.ts records occurrences beside edge recording).
    throw new Error(
      `xspec internal error: occurrence source ${source} names no graph node`,
    );
  }
  return {
    identity: source,
    range: node.kind === "requirement" ? node.section.range : node.range,
  };
}

/**
 * The SPEC 11.2 exit of an availability answer: 1 when the answer carries
 * any finding or any explicitly-unavailable datum — emitted in full either
 * way — and 0 for a complete, finding-free answer (SPEC 12.0).
 */
export function availabilityExit(
  findings: readonly Finding[],
  carriesUnavailable: boolean,
): 0 | 1 {
  return findings.length > 0 || carriesUnavailable ? 1 : 0;
}
