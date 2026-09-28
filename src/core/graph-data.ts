// Graph data — the serializable store model (SPEC 13.3).
//
// Pure core (IMPLEMENTATION Architecture: serialization is core —
// deterministic, I/O-free; storage I/O is the workspace layer's,
// src/workspace/graph-data.ts): xspec maintains graph data under `.xspec/`,
// containing requirement nodes, code locations, edges by kind, reference
// occurrences (SPEC 5.7), source ranges (SPEC 1.7), all four hashes
// (SPEC 5.5), coverage attributes (SPEC 2.5), tags (SPEC 2.6), and the
// paths of the derived files most recently generated (SPEC 13.3, 13.4).
// This module defines that content:
//
// - the stored model — a plain-data snapshot of the assembled workspace
//   graph (./graph.ts) with its derivation inputs, and, apart from it, the
//   recorded derived-file paths;
// - `buildGraphSnapshot` — the pure derivation of the snapshot from the
//   graph and its computed hashes (./hashes.ts);
// - `serializeGraphData`/`parseGraphData` and
//   `serializeDerivedFileRecord`/`parseDerivedFileRecord` — the byte
//   encodings of the two parts through the one canonical serializer
//   (./canonical-json.ts; IMPLEMENTATION: stored JSON goes through one
//   canonical serializer — sorted keys, stable ordering, trailing newline),
//   byte-deterministic for a given workspace (SPEC 12.0: no wall-clock
//   values, no randomness, no absolute paths — every stored path is
//   workspace-relative, SPEC 1.5);
// - the compare-with-current predicate `graphDataMatchesCurrent` — shared
//   by refresh-on-read (SPEC 13.3) and `check`'s staleness finding
//   (SPEC 14.10), so both judge the store by one rule.
//
// The two parts age differently (SPEC 13.3), so each has its own file in
// the graph-data area (the layout is the product's own, deliberately
// unenumerated to consumers, SPEC 13.3, 11.6): the snapshot with its
// inputs (`GRAPH_DATA_PATH`) is a pure function of the current sources,
// configuration, and journal, and "graph data does not match the current
// sources and configuration" exactly when its stored bytes differ from the
// serialization of the current snapshot — the comparison of 13.3, from
// which the recorded derived-file paths are excluded by construction. The
// record (`DERIVED_FILE_RECORD_PATH`) is written only by generation
// (`xspec build`, and the commands that regenerate as `build` does) and
// legitimately outlives the generation set (that is what makes orphan
// removal and 14.10's recorded-orphan arm possible, SPEC 13.3, 13.4, 12.1).
// A refresh writes exactly what `xspec build` would write except that the
// record is left unchanged (SPEC 13.3): it writes the snapshot file alone
// and never the record's, so the record keeps whatever state it has — an
// absent record stays absent, the empty record (11.6), whatever graph data
// the refresh writes beside it; a readable one stays byte-for-byte; and
// recorded state that exists but cannot be read as a record — malformed
// bytes, a non-plain occupant (workspace/graph-data.ts's "unreadable"
// state) — is neither read, repaired, nor replaced by any refresh
// (SPEC 13.3, 14.23): only `build` and the finishing `rename`/`move`
// regeneration replace it, and `check` reports it as staleness
// (SPEC 14.10).
//
// The content is otherwise opaque (SPEC 13.3): its observable contract is
// its location under `.xspec/`, its classification as a derived file
// (SPEC 13.4), and the refresh, failure, and staleness behaviors — the
// concrete JSON shape here is an implementation choice, versioned so a
// future shape change reads as "does not match" rather than misparsing.

import type { ByteRange } from "./bytes.js";
import { compareBytes } from "./bytes.js";
import type { JsonValue } from "./canonical-json.js";
import { canonicalJson } from "./canonical-json.js";
import type { Finding } from "./findings.js";
import { pathFinding } from "./findings.js";
import type {
  DependencyEdgeKind,
  GraphEdge,
  GraphEdgeKind,
  WorkspaceGraph,
} from "./graph.js";
import type { NodeHashes } from "./hashes.js";
import type { WorkspaceTextModel } from "./text-model.js";

/**
 * SPEC 13.3/11.6: the graph-data area — the location under which graph
 * data is kept, spelled as its workspace-relative path with no trailing
 * separator. The record's layout under it is deliberately unenumerated, so
 * the area itself is the concerned path of every condition-23 finding
 * (SPEC 14.23) and of 14.10's unit forms — no path inside it is named.
 */
export const GRAPH_DATA_AREA = ".xspec";

/**
 * SPEC 13.3/13.4: the workspace-relative path of the graph data proper —
 * the snapshot with its derivation inputs, the part a refresh writes.
 */
export const GRAPH_DATA_PATH = ".xspec/graph.json";

/**
 * SPEC 13.3/13.4: the workspace-relative path of the recorded derived-file
 * paths — the record, written by generation alone and never by a refresh,
 * so the record is left unchanged in every state (SPEC 13.3). Nothing
 * occupying it — the area absent, or a directory without it, whatever else
 * the area holds, graph data a refresh wrote included — is the empty
 * record (SPEC 11.6, 14.23).
 */
export const DERIVED_FILE_RECORD_PATH = ".xspec/record.json";

/**
 * The graph data's own paths, both derived files (SPEC 13.4) that `build`
 * writes (its write set, SPEC 12.1, 14.22). Graph data records no paths of
 * its own (SPEC 13.3): neither is ever a recorded derived-file path, so
 * neither is ever an orphan.
 */
export const GRAPH_DATA_OWN_PATHS: readonly string[] = [
  GRAPH_DATA_PATH,
  DERIVED_FILE_RECORD_PATH,
];

/**
 * The one condition-23 finding (SPEC 14.23): recorded generation state that
 * exists but cannot be read as a record, reported by the surfaces that
 * consult the record without refreshing it — `inventory` (SPEC 11.6) and
 * the `rename`/`move` preview delta (SPEC 6.6) — beside their explicitly
 * unavailable record-supplied datum. The concerned path is the graph-data
 * area itself: the record's layout is deliberately unenumerated (SPEC
 * 13.3), so no path inside it is named and the finding has no in-source
 * locations.
 */
export function unreadableRecordFinding(): Finding {
  return pathFinding(
    23,
    `the recorded generation state under the graph-data area exists but ` +
      `cannot be read as a record, so the recorded derived-file paths are ` +
      `unavailable — a successful \`xspec build\` (or a finishing ` +
      `rename/move regeneration) replaces the record (SPEC 14.23, 13.3)`,
    GRAPH_DATA_AREA,
  );
}

/**
 * The stored graph-data format version: a parsed file of any other version
 * is malformed (parse yields null) — graph data that does not match the
 * current sources and configuration: the refreshing reads rewrite it,
 * `check` reports it as staleness, and a `build` (or finishing
 * regeneration) replaces it (SPEC 13.3, 14.10). Version 3 added the
 * reference occurrences (SPEC 5.7, 13.3); version 4 added the
 * code-location source ranges (SPEC 1.7); version 5 moved the recorded
 * derived-file paths to their own file (`DERIVED_FILE_RECORD_PATH`), which
 * no refresh writes (SPEC 13.3).
 */
const GRAPH_DATA_VERSION = 5;

/**
 * The derived-file record's format version: a record file of any other
 * version is malformed (parse yields null) — recorded state that exists but
 * cannot be read as a record (SPEC 14.23).
 */
const DERIVED_FILE_RECORD_VERSION = 1;

/** One recorded derivation input: a discovered source and its fingerprint. */
export interface StoredSourceInput {
  /** Workspace-relative `/`-separated path (SPEC 1.5). */
  readonly path: string;
  /** SHA-256 (hex) of the source's exact bytes. */
  readonly hash: string;
}

/**
 * The recorded derivation inputs (SPEC 13.3). The snapshot is a pure
 * function of the current sources, configuration, and journal (SPEC 12.0
 * determinism), so these fingerprints — the configuration file's content
 * hash with its parsed form, the journal's content hash, and every
 * discovered source's content hash — certify the stored snapshot for
 * byte-identical current inputs. The store-backed read fast path
 * (workspace/fast-read.ts) answers from a store whose recorded inputs all
 * match without re-deriving; any mismatch falls back to the full pipeline,
 * whose compare-and-refresh behavior is unchanged.
 */
export interface StoredInputs {
  /** SHA-256 (hex) of the configuration file's exact bytes. */
  readonly configHash: string;
  /**
   * The parsed configuration's plain form (core/config-data.ts) — the
   * recorded parse the fast path recovers instead of re-parsing.
   */
  readonly config: JsonValue;
  /**
   * SHA-256 (hex) of the journal file's exact bytes — null when the
   * journal is absent (an empty journal, SPEC 6.1). The journal is a
   * derivation input (SPEC 5.4).
   */
  readonly journalHash: string | null;
  /**
   * Every discovered source with its content fingerprint, in byte order of
   * path (SPEC 12.0). The discovered set itself is part of the record: a
   * current discovery yielding any other path set is a mismatch.
   */
  readonly sources: readonly StoredSourceInput[];
}

/** One stored requirement node (SPEC 13.3, 5.1). */
export interface StoredRequirementNode {
  /** SPEC 1.5: `path#id`, or the bare path for the root node. */
  readonly identity: string;
  /** Workspace-relative `/`-separated source file path (SPEC 1.5). */
  readonly path: string;
  /** The requirement ID — null exactly for the root node (SPEC 1.2). */
  readonly id: string | null;
  /** SPEC 1.7: the construct's byte range; the entire file for a root. */
  readonly range: ByteRange;
  /** SPEC 2.5: the effective coverage attribute — null for a root. */
  readonly coverage: "required" | "none" | null;
  /**
   * SPEC 2.6, 12.7: the node's tags — a tag set, in byte order (SPEC 12.0),
   * duplicates collapsed; `[]` for a section carrying none and for a root.
   */
  readonly tags: readonly string[];
  /** SPEC 5.5: the node's four hashes. */
  readonly hashes: NodeHashes;
  /** SPEC 1.6: the node's own text, fully expanded (SPEC 11, 12.4). */
  readonly ownText: string;
  /** SPEC 1.6: the node's subtree text, fully expanded (SPEC 11, 12.4). */
  readonly subtreeText: string;
}

/** One stored code location (SPEC 13.3, 5.1, 4.6). */
export interface StoredCodeLocation {
  /** SPEC 4.6: `path`, `path#unit`, or `path#unit@N`. */
  readonly identity: string;
  /** Workspace-relative `/`-separated code file path (SPEC 1.5). */
  readonly path: string;
  /**
   * SPEC 1.7: the location's source range — the entire file for a
   * whole-file location, the construct binding the unit's name for a
   * named unit.
   */
  readonly range: ByteRange;
}

/**
 * One stored reference occurrence (SPEC 13.3, 5.7). The snapshot is built
 * only over workspaces passing `build`'s validations (core/build.ts), so
 * the referencing file's path is always a plain string (SPEC 14.19) and
 * the source graph node's identity is always defined (SPEC 11.2) — the
 * null arm is carried for shape totality. The source node's own range
 * (the reported datum's other half, SPEC 5.7) travels with the stored
 * node itself.
 */
export interface StoredOccurrence {
  /** Workspace-relative `/`-separated referencing file path (SPEC 1.5). */
  readonly file: string;
  /** SPEC 5.7: the occurrence's own span, exact per kind. */
  readonly range: ByteRange;
  /** The recorded edge kind (SPEC 5.2): depends, embeds, or references. */
  readonly kind: DependencyEdgeKind;
  /** The source graph node's identity — null where undefined (SPEC 11.2). */
  readonly source: string | null;
  /** The resolved target's identity (SPEC 1.5). */
  readonly target: string;
}

/**
 * The graph-content part of the store: a pure function of the current
 * sources, configuration, and journal (SPEC 13.3) — the part the
 * compare-with-current predicate judges.
 */
export interface GraphSnapshot {
  /** In graph order: files in byte order, document order within a file. */
  readonly requirements: readonly StoredRequirementNode[];
  /** In graph order: files in byte order, whole file before its units. */
  readonly codeLocations: readonly StoredCodeLocation[];
  /** The collapsed edge set in (source, kind, target) order (SPEC 5.2). */
  readonly edges: readonly GraphEdge[];
  /**
   * Every reference occurrence (SPEC 5.7, 13.3) in occurrence order:
   * referencing file path bytes, then range start, then range end.
   */
  readonly occurrences: readonly StoredOccurrence[];
}

/**
 * The stored graph data proper (SPEC 13.3), the part a refresh writes: the
 * snapshot with its derivation inputs. The recorded derived-file paths —
 * the paths of the derived files most recently generated (SPEC 13.3,
 * 13.4), on which orphan removal (12.1) and 14.10's recorded-orphan form
 * rely — are stored apart (`serializeDerivedFileRecord`), written by
 * generation alone.
 */
export interface GraphData {
  readonly snapshot: GraphSnapshot;
  /** The recorded derivation inputs of the snapshot (see `StoredInputs`). */
  readonly inputs: StoredInputs;
}

/**
 * Derive the storable snapshot from the assembled graph and its computed
 * hashes (SPEC 13.3): every requirement node with its source range,
 * coverage attribute, tags, four hashes, and fully expanded own and
 * subtree text (SPEC 1.6 — recorded so the store answers the node report
 * of SPEC 11/12.4 without re-deriving); every code location; every edge;
 * every reference occurrence (SPEC 5.7).
 * Deterministic: everything is emitted in the graph's own fixed order
 * (SPEC 12.0). `hashes` must be the computation over this same graph
 * (./hashes.ts covers every requirement node), `textModel` the model over
 * the same documents.
 */
export function buildGraphSnapshot(
  graph: WorkspaceGraph,
  hashes: ReadonlyMap<string, NodeHashes>,
  textModel: WorkspaceTextModel,
): GraphSnapshot {
  const requirements = graph.requirementNodes.map(
    (node): StoredRequirementNode => {
      const nodeHashes = hashes.get(node.identity);
      if (nodeHashes === undefined) {
        throw new Error(
          `xspec internal error: no hashes computed for ${node.identity}`,
        );
      }
      return {
        identity: node.identity,
        path: node.path,
        id: node.id,
        range: { start: node.section.range.start, end: node.section.range.end },
        coverage: node.section.coverage,
        tags: node.section.tags,
        hashes: nodeHashes,
        ownText: textModel.ownText(node.document, node.section),
        subtreeText: textModel.subtreeText(node.document, node.section),
      };
    },
  );
  const codeLocations = graph.codeLocations.map((node): StoredCodeLocation => ({
    identity: node.identity,
    path: node.path,
    range: { start: node.range.start, end: node.range.end },
  }));
  const edges = graph.edges.map((edge): GraphEdge => ({
    kind: edge.kind,
    source: edge.source,
    target: edge.target,
  }));
  // SPEC 5.7/13.3: the reference occurrences, already in occurrence order.
  // Only valid workspaces reach this derivation (core/build.ts), so every
  // referencing file's path is a plain string (SPEC 14.19).
  const occurrences = graph.occurrences.map((occurrence): StoredOccurrence => {
    if (typeof occurrence.file !== "string") {
      throw new Error(
        `xspec internal error: an invalid-path file's occurrence reached ` +
          `a stored snapshot (SPEC 14.19 fails build validation)`,
      );
    }
    return {
      file: occurrence.file,
      range: { start: occurrence.range.start, end: occurrence.range.end },
      kind: occurrence.kind,
      source: occurrence.source,
      target: occurrence.target,
    };
  });
  return { requirements, codeLocations, edges, occurrences };
}

/**
 * The compare-with-current predicate (SPEC 13.3, 14.10): whether the
 * stored graph data matches the current sources and configuration —
 * operationally, whether the stored bytes are exactly the serialization of
 * `build`, the graph data `xspec build` would write for the current
 * sources and configuration (core/build.ts, `BuildOutputs.graphData`),
 * which is exactly what a refresh writes: the recorded derived-file paths
 * are stored apart (`DERIVED_FILE_RECORD_PATH`), so the comparison
 * excludes them by construction and a lagging record alone is never
 * staleness (SPEC 13.3, 14.10). False when no plain file's bytes were read
 * (`storedBytes` null — missing, or occupied by anything else). The
 * refreshing reads refresh exactly when this is false (SPEC 13.3);
 * `check`, which never refreshes, reports the graph data mismatched
 * exactly when this is false and the record is readable or absent
 * (SPEC 14.10: an unreadable record reports under its own unit form
 * alone) — the same rule for both.
 */
export function graphDataMatchesCurrent(
  storedBytes: Uint8Array | null,
  build: GraphData,
): boolean {
  if (storedBytes === null) {
    return false;
  }
  return bytesEqual(storedBytes, utf8Encoder.encode(serializeGraphData(build)));
}

// ---------------------------------------------------------------------------
// Serialization (the canonical byte encoding)
// ---------------------------------------------------------------------------

const utf8Encoder = new TextEncoder();

/** Exact byte equality of two byte sequences (SPEC 12.0 comparisons). */
function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return false;
    }
  }
  return true;
}

/**
 * Serialize graph data to its stored text: the canonical serializer over
 * the versioned shape (IMPLEMENTATION: one canonical serializer — sorted
 * keys, stable ordering, trailing newline). Byte-deterministic for a given
 * workspace (SPEC 13.3, 12.0): the snapshot enters in the graph's fixed
 * order. The recorded derived-file paths are no part of it (they are
 * stored apart, `serializeDerivedFileRecord`).
 */
export function serializeGraphData(data: GraphData): string {
  const value: JsonValue = {
    version: GRAPH_DATA_VERSION,
    inputs: {
      configHash: data.inputs.configHash,
      config: data.inputs.config,
      journalHash: data.inputs.journalHash,
      // Byte order of path (SPEC 12.0); collection order is discovery
      // order, already byte-ordered — sorting keeps the serialization
      // order-independent of its inputs.
      sources: [...data.inputs.sources]
        .sort((a, b) => compareBytes(a.path, b.path))
        .map((source): JsonValue => ({
          path: source.path,
          hash: source.hash,
        })),
    },
    requirements: data.snapshot.requirements.map(requirementToJson),
    codeLocations: data.snapshot.codeLocations.map((location): JsonValue => ({
      identity: location.identity,
      path: location.path,
      range: { start: location.range.start, end: location.range.end },
    })),
    edges: data.snapshot.edges.map((edge): JsonValue => ({
      kind: edge.kind,
      source: edge.source,
      target: edge.target,
    })),
    occurrences: data.snapshot.occurrences.map((occurrence): JsonValue => ({
      file: occurrence.file,
      range: { start: occurrence.range.start, end: occurrence.range.end },
      kind: occurrence.kind,
      source: occurrence.source,
      target: occurrence.target,
    })),
  };
  return canonicalJson(value);
}

function requirementToJson(node: StoredRequirementNode): JsonValue {
  return {
    identity: node.identity,
    path: node.path,
    id: node.id,
    range: { start: node.range.start, end: node.range.end },
    coverage: node.coverage,
    // SPEC 12.7: a tag set — byte order (SPEC 12.0), duplicates collapsed.
    // The snapshot already carries it (core/mdx.ts forms the set);
    // serializing the normal form also makes a store that records tags in
    // any other order non-canonical, so the store-backed fast path
    // (workspace/fast-read.ts, step 1) falls back instead of serving it.
    tags: [...new Set(node.tags)].sort(compareBytes),
    hashes: {
      ownHash: node.hashes.ownHash,
      subtreeHash: node.hashes.subtreeHash,
      effectiveHash: node.hashes.effectiveHash,
      metadataHash: node.hashes.metadataHash,
    },
    ownText: node.ownText,
    subtreeText: node.subtreeText,
  };
}

// ---------------------------------------------------------------------------
// Parsing (structural validation; anything else is malformed)
// ---------------------------------------------------------------------------

/** SPEC 5.2: the four edge kinds, for runtime validation. */
const EDGE_KINDS: ReadonlySet<string> = new Set([
  "contains",
  "depends",
  "embeds",
  "references",
]);

/**
 * Parse stored graph-data text. Returns null — malformed — for anything
 * that is not the versioned shape `serializeGraphData` writes: not JSON,
 * a different version, or structurally invalid fields. Malformed graph
 * data is graph data that does not match the current sources and
 * configuration (SPEC 13.3): the refreshing reads rewrite it, `check`
 * reports it as staleness (SPEC 14.10) — under the unreadable-record unit
 * form alone where the record cannot be read either — and a successful
 * `build` or finishing regeneration replaces it. The record it sits beside
 * is judged on its own (`parseDerivedFileRecord`).
 */
export function parseGraphData(text: string): GraphData | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(raw) || raw["version"] !== GRAPH_DATA_VERSION) {
    return null;
  }
  const inputs = parseInputs(raw["inputs"]);
  const requirements = parseArray(raw["requirements"], parseRequirement);
  const codeLocations = parseArray(raw["codeLocations"], parseCodeLocation);
  const edges = parseArray(raw["edges"], parseEdge);
  const occurrences = parseArray(raw["occurrences"], parseOccurrence);
  if (
    inputs === null ||
    requirements === null ||
    codeLocations === null ||
    edges === null ||
    occurrences === null
  ) {
    return null;
  }
  return {
    snapshot: { requirements, codeLocations, edges, occurrences },
    inputs,
  };
}

/**
 * Serialize the recorded derived-file paths (SPEC 13.3, 13.4) — the paths
 * of the derived files most recently generated: generated TypeScript
 * modules and companions (13.1) and emitted Markdown (13.2) — to the
 * record's stored text through the one canonical serializer, the paths
 * deduplicated in byte order (SPEC 12.0). Written by generation alone
 * (`xspec build` and the finishing regeneration of `rename`/`move`), never
 * by a refresh (SPEC 13.3).
 */
export function serializeDerivedFileRecord(paths: readonly string[]): string {
  return canonicalJson({
    version: DERIVED_FILE_RECORD_VERSION,
    derivedFiles: [...new Set(paths)].sort(compareBytes),
  });
}

/**
 * Parse the record's stored text: the recorded derived-file paths, or null
 * — malformed — for anything that is not the versioned shape
 * `serializeDerivedFileRecord` writes. A malformed record is recorded state
 * that exists but cannot be read as a record (SPEC 14.23): the
 * record-consulting surfaces report their record-supplied datum explicitly
 * unavailable beside the condition-23 finding (SPEC 11.6, 6.6), `check`
 * reports it under 14.10's unreadable-record unit form, the refreshing
 * reads neither read, repair, nor replace it (SPEC 13.3), and a successful
 * `build` or finishing regeneration replaces it; the paths it held are
 * unrecoverable, leaving any orphans outside xspec's knowledge (SPEC 13.4).
 */
export function parseDerivedFileRecord(text: string): readonly string[] | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(raw) || raw["version"] !== DERIVED_FILE_RECORD_VERSION) {
    return null;
  }
  return parseStringArray(raw["derivedFiles"]);
}

function parseSourceInput(value: unknown): StoredSourceInput | null {
  if (!isRecord(value)) {
    return null;
  }
  const path = value["path"];
  const hash = value["hash"];
  if (typeof path !== "string" || typeof hash !== "string") {
    return null;
  }
  return { path, hash };
}

function parseInputs(value: unknown): StoredInputs | null {
  if (!isRecord(value)) {
    return null;
  }
  const configHash = value["configHash"];
  const journalHash = value["journalHash"];
  const sources = parseArray(value["sources"], parseSourceInput);
  if (
    typeof configHash !== "string" ||
    (journalHash !== null && typeof journalHash !== "string") ||
    sources === null ||
    !("config" in value)
  ) {
    return null;
  }
  // The recorded parse (`config`) is structurally validated at use
  // (core/config-data.ts `configurationFromStored`); here it must only be
  // JSON data, which a parsed JSON document's field always is.
  return {
    configHash,
    config: value["config"] as JsonValue,
    journalHash,
    sources,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A non-negative safe integer (SPEC 1.7 byte offsets). */
function isOffset(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function parseArray<T>(
  value: unknown,
  parseItem: (item: unknown) => T | null,
): T[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const items: T[] = [];
  for (const raw of value) {
    const item = parseItem(raw);
    if (item === null) {
      return null;
    }
    items.push(item);
  }
  return items;
}

function parseStringArray(value: unknown): string[] | null {
  return parseArray(value, (item) => (typeof item === "string" ? item : null));
}

function parseRange(value: unknown): ByteRange | null {
  if (!isRecord(value)) {
    return null;
  }
  const start = value["start"];
  const end = value["end"];
  if (!isOffset(start) || !isOffset(end) || end < start) {
    return null;
  }
  return { start, end };
}

function parseHashes(value: unknown): NodeHashes | null {
  if (!isRecord(value)) {
    return null;
  }
  const ownHash = value["ownHash"];
  const subtreeHash = value["subtreeHash"];
  const effectiveHash = value["effectiveHash"];
  const metadataHash = value["metadataHash"];
  if (
    typeof ownHash !== "string" ||
    typeof subtreeHash !== "string" ||
    typeof effectiveHash !== "string" ||
    typeof metadataHash !== "string"
  ) {
    return null;
  }
  return { ownHash, subtreeHash, effectiveHash, metadataHash };
}

function parseRequirement(value: unknown): StoredRequirementNode | null {
  if (!isRecord(value)) {
    return null;
  }
  const identity = value["identity"];
  const path = value["path"];
  const id = value["id"];
  const coverage = value["coverage"];
  if (typeof identity !== "string" || typeof path !== "string") {
    return null;
  }
  if (id !== null && typeof id !== "string") {
    return null;
  }
  if (coverage !== "required" && coverage !== "none" && coverage !== null) {
    return null;
  }
  const range = parseRange(value["range"]);
  const tags = parseStringArray(value["tags"]);
  const hashes = parseHashes(value["hashes"]);
  const ownText = value["ownText"];
  const subtreeText = value["subtreeText"];
  if (
    range === null ||
    tags === null ||
    hashes === null ||
    typeof ownText !== "string" ||
    typeof subtreeText !== "string"
  ) {
    return null;
  }
  return {
    identity,
    path,
    id,
    range,
    coverage,
    tags,
    hashes,
    ownText,
    subtreeText,
  };
}

function parseCodeLocation(value: unknown): StoredCodeLocation | null {
  if (!isRecord(value)) {
    return null;
  }
  const identity = value["identity"];
  const path = value["path"];
  const range = parseRange(value["range"]);
  if (
    typeof identity !== "string" ||
    typeof path !== "string" ||
    range === null
  ) {
    return null;
  }
  return { identity, path, range };
}

function parseEdge(value: unknown): GraphEdge | null {
  if (!isRecord(value)) {
    return null;
  }
  const kind = value["kind"];
  const source = value["source"];
  const target = value["target"];
  if (
    typeof kind !== "string" ||
    !EDGE_KINDS.has(kind) ||
    typeof source !== "string" ||
    typeof target !== "string"
  ) {
    return null;
  }
  return { kind: kind as GraphEdgeKind, source, target };
}

/** SPEC 5.7: the dependency edge kinds occurrences record. */
const OCCURRENCE_KINDS: ReadonlySet<string> = new Set([
  "depends",
  "embeds",
  "references",
]);

function parseOccurrence(value: unknown): StoredOccurrence | null {
  if (!isRecord(value)) {
    return null;
  }
  const file = value["file"];
  const kind = value["kind"];
  const source = value["source"];
  const target = value["target"];
  const range = parseRange(value["range"]);
  if (
    typeof file !== "string" ||
    typeof kind !== "string" ||
    !OCCURRENCE_KINDS.has(kind) ||
    (source !== null && typeof source !== "string") ||
    typeof target !== "string" ||
    range === null
  ) {
    return null;
  }
  return { file, range, kind: kind as DependencyEdgeKind, source, target };
}
