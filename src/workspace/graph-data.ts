// Graph-data storage — the I/O half (SPEC 13.3, 13.4; IMPLEMENTATION
// Architecture: storage is workspace-layer I/O).
//
// Graph data lives in the graph-data area `.xspec` under the workspace root
// (SPEC 13.3: under `.xspec/`; content otherwise opaque), in two files that
// age differently (core/graph-data.ts): the snapshot with its derivation
// inputs at `.xspec/graph.json` — what a refresh writes — and the recorded
// derived-file paths at `.xspec/record.json` — the record, written by
// generation alone, so a refresh leaves it unchanged in every state
// (SPEC 13.3). Both are derived files (SPEC 13.4): fully reproducible from
// sources, configuration, and the journal via `xspec build`; their paths
// belong to xspec, so a write replaces whatever occupies them — a symbolic
// link is replaced as itself and never written through — and a conflicted,
// corrupted, deleted, or orphaned store is correctly resolved by
// rebuilding. Only the reading side is here plus the writes, through the
// workspace write layer (writes.ts) like every product file write, so each
// is atomic in its observable effect (SPEC 13.5).
//
// Serialization, parsing, and the compare-with-current predicate are the
// pure core's (src/core/graph-data.ts). Each file loads by one occupant
// classification (`readStoredFile`), with lstat, the area's own path
// first, into one of three states (SPEC 13.3, 14.23): absent — nothing
// occupies the path, the area absent included; readable — a plain file
// holding the stored shape; or unreadable — a non-plain occupant, bytes
// that are not valid UTF-8 or not the stored shape, or the area's own path
// `.xspec` occupied by a non-directory, below which nothing is read
// (SPEC 13.4). For the record, absent is the empty record (SPEC 11.6,
// 14.23: never a condition, whatever else the area holds — graph data a
// refresh wrote included) and unreadable is recorded state that exists but
// cannot be read as a record (14.23 — never an empty record): the
// record-consulting surfaces meet it (SPEC 11.6, 6.6), `check` reports it
// as staleness (SPEC 14.10), and no refreshing read reads, repairs, or
// replaces it (SPEC 13.3) — it persists until a successful `build` or a
// finishing `rename`/`move` regeneration replaces the record. For the
// snapshot file, absent and unreadable alike are graph data that is
// missing or does not match: the refreshing reads rewrite it (SPEC 13.3).

import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { compareBytes } from "../core/bytes.js";
import type { GraphData } from "../core/graph-data.js";
import {
  DERIVED_FILE_RECORD_PATH,
  GRAPH_DATA_AREA,
  GRAPH_DATA_PATH,
  parseDerivedFileRecord,
  parseGraphData,
  serializeDerivedFileRecord,
  serializeGraphData,
} from "../core/graph-data.js";
import { classifyOccupant, writeDerivedFile } from "./writes.js";

const strictUtf8Decoder = new TextDecoder("utf-8", { fatal: true });

/** The absolute filesystem path of a workspace-relative `/`-path. */
function absoluteOf(root: string, rel: string): string {
  return path.join(root, ...rel.split("/"));
}

/**
 * One stored file of the graph-data area as read: nothing there, something
 * there that cannot be read as stored text (its bytes, where a plain file
 * held them), or its text, strictly UTF-8-decoded.
 */
type StoredFileRead =
  | { readonly state: "absent" }
  | { readonly state: "unreadable"; readonly bytes: Uint8Array | null }
  | {
      readonly state: "text";
      readonly bytes: Uint8Array;
      readonly text: string;
    };

/**
 * Read one stored file of the graph-data area (`GRAPH_DATA_PATH` or
 * `DERIVED_FILE_RECORD_PATH`), classifying occupants by lstat — the
 * record's container first, then the file's own path (SPEC 13.4, 14.23):
 *
 * - the graph-data area's own path `.xspec` — absent, nothing is stored
 *   (SPEC 14.23: "the area absent"); occupied by anything other than a
 *   directory — a plain file, a symbolic link whatever it targets, any
 *   other non-directory occupant — the file, whose container the area is,
 *   is unreadable (SPEC 13.4, 14.23): nothing is read below the occupant;
 * - under a directory, the file's own path: nothing there is absent; only
 *   a plain file is read, anything else there existing but unreadable; and
 *   bytes that are not valid UTF-8 are unreadable.
 */
async function readStoredFile(
  root: string,
  rel: string,
): Promise<StoredFileRead> {
  const area = await classifyOccupant(absoluteOf(root, GRAPH_DATA_AREA));
  if (area === "absent") {
    return { state: "absent" };
  }
  if (area !== "directory") {
    return { state: "unreadable", bytes: null };
  }
  const absolute = absoluteOf(root, rel);
  const occupant = await classifyOccupant(absolute);
  if (occupant === "absent") {
    return { state: "absent" };
  }
  if (occupant !== "file") {
    return { state: "unreadable", bytes: null };
  }
  let bytes: Uint8Array;
  try {
    bytes = await fsp.readFile(absolute);
  } catch {
    // Vanished between classification and read (SPEC 13.5: concurrent
    // commands, last-write-wins): nothing exists to read.
    return { state: "absent" };
  }
  try {
    return { state: "text", bytes, text: strictUtf8Decoder.decode(bytes) };
  } catch {
    return { state: "unreadable", bytes };
  }
}

/**
 * The loaded graph data's three-way state (SPEC 13.3): nothing stored, the
 * stored snapshot readable, or something stored that cannot be read as
 * graph data — which, like absence, does not match the current sources and
 * configuration.
 */
export type GraphDataState = "absent" | "readable" | "unreadable";

/** The loaded graph data: its state, raw bytes and, when they parse, the model. */
export interface LoadedGraphData {
  /**
   * SPEC 13.3: "absent" — nothing occupies the snapshot file's path (graph
   * data missing); "readable" — a plain file parsing as the stored shape
   * (`data` non-null); "unreadable" — something that cannot be read as
   * graph data: a non-plain occupant, bytes that are not valid UTF-8, not
   * JSON, or not the stored shape, or the area's own path occupied by a
   * non-directory (graph data that does not match). The refreshing reads
   * rewrite the file in both non-readable states (SPEC 13.3) and `check`
   * reports them as the graph data's staleness (SPEC 14.10).
   */
  readonly state: GraphDataState;
  /**
   * The stored file's exact bytes — null when no plain file is readable:
   * the path is absent or occupied by anything other than a plain file
   * (SPEC 13.4: a derived path's occupant is resolved by rebuilding).
   */
  readonly bytes: Uint8Array | null;
  /**
   * The parsed model — non-null exactly in the "readable" state. Feed
   * `bytes` to `graphDataMatchesCurrent` (core) for the staleness
   * predicate.
   */
  readonly data: GraphData | null;
}

/**
 * Load the workspace's graph data — the snapshot with its derivation
 * inputs (SPEC 13.3). Never throws on the expected states — each loads as
 * its `GraphDataState` (`readStoredFile`'s classification), and the
 * refresh, failure, and staleness behaviors are the callers' (SPEC 13.3,
 * 14.10). The record is read apart (`readDerivedFileRecord`).
 */
export async function loadGraphData(root: string): Promise<LoadedGraphData> {
  const read = await readStoredFile(root, GRAPH_DATA_PATH);
  if (read.state === "absent") {
    return { state: "absent", bytes: null, data: null };
  }
  if (read.state === "unreadable") {
    return { state: "unreadable", bytes: read.bytes, data: null };
  }
  const data = parseGraphData(read.text);
  if (data === null) {
    return { state: "unreadable", bytes: read.bytes, data: null };
  }
  return { state: "readable", bytes: read.bytes, data };
}

/**
 * The record-supplied datum's three-way outcome (SPEC 13.3, 14.23): the
 * recorded generation state is absent (an empty record — nothing has been
 * generated, or the record was removed), readable as a record (the recorded
 * derived-file paths), or exists but cannot be read as a record — condition
 * 23 for the surfaces that consult the record without refreshing it
 * (`inventory`, 11.6; `rename`/`move` previews' delta, 6.6). The refreshing
 * reads of 13.3 never use this: they never consult the record and report no
 * finding for it.
 */
export type DerivedFileRecord =
  | { readonly state: "absent" }
  | {
      /** The recorded derived-file paths, in byte order (SPEC 11.6, 12.0). */
      readonly state: "readable";
      readonly paths: readonly string[];
    }
  | {
      /**
       * SPEC 14.23: recorded state that exists but cannot be read as a
       * record — a non-plain-file occupant, bytes that are not the stored
       * shape (corrupt, merge-conflicted or otherwise), or the area's own
       * path occupied by a non-directory (SPEC 13.4). The
       * consulting surface reports its record-supplied datum explicitly
       * unavailable beside one condition-23 finding whose concerned path is
       * the graph-data area, and exits 1 with everything else in full.
       */
      readonly state: "unreadable";
    };

/**
 * Read the recorded derived-file paths as a record (SPEC 13.3, 14.23) —
 * the shared record read of the surfaces that consult the record without
 * refreshing it (`inventory`, 11.6; preview deltas, 6.6; `check`'s
 * unreadable-record staleness form and recorded-file form, 14.10) and of
 * generation's orphan removal (`build`, the finishing regeneration of
 * `rename`/`move`; SPEC 12.1, 13.4). Never repairs, replaces, or otherwise
 * writes: the state persists until a successful `build` or a finishing
 * regeneration replaces the record (SPEC 13.3).
 */
export async function readDerivedFileRecord(
  root: string,
): Promise<DerivedFileRecord> {
  const read = await readStoredFile(root, DERIVED_FILE_RECORD_PATH);
  if (read.state === "absent") {
    return { state: "absent" };
  }
  const paths =
    read.state === "text" ? parseDerivedFileRecord(read.text) : null;
  if (paths === null) {
    return { state: "unreadable" };
  }
  // SPEC 11.6/12.0: the recorded paths as one byte-ordered, duplicate-free
  // list (the canonical serialization already writes them so; sorting here
  // keeps the datum canonical whatever bytes parsed).
  return {
    state: "readable",
    paths: [...new Set(paths)].sort(compareBytes),
  };
}

/**
 * The recorded derived-file paths generation's orphan removal and 14.10's
 * recorded-file form consult (SPEC 12.1, 13.3, 13.4): a readable record's
 * paths; none where the record is absent or cannot be read as a record —
 * files orphaned then are outside xspec's knowledge (SPEC 13.4), and the
 * recorded-file form is undetectable while the record is unreadable
 * (SPEC 14.10).
 */
export function recordedPathsOf(record: DerivedFileRecord): readonly string[] {
  return record.state === "readable" ? record.paths : [];
}

/**
 * Write the graph data (SPEC 13.3) — the snapshot with its derivation
 * inputs, the refresh's one write — as the canonical serialization (core)
 * at `.xspec/graph.json`, through the derived-file write primitive: atomic
 * in its observable effect (SPEC 13.5), replacing whatever occupies the
 * path (SPEC 13.4). Byte-deterministic for a given workspace (SPEC 12.0).
 * Callers validate the write path first (SPEC 14.22,
 * `obstructedWritePathFindings`) and write only for workspaces that pass
 * build validation — a failed build or refresh writes nothing (SPEC 12.1,
 * 13.3). A write the environment refuses concerns the graph-data area, no
 * path inside it named (SPEC 14.24, 11.6).
 */
export async function writeGraphData(
  root: string,
  data: GraphData,
): Promise<void> {
  await writeDerivedFile(
    root,
    GRAPH_DATA_PATH,
    serializeGraphData(data),
    GRAPH_DATA_AREA,
  );
}

/**
 * Write the derived-file record (SPEC 13.3, 13.4) — generation's write
 * alone (`xspec build`, the finishing regeneration of `rename`/`move`),
 * never a refresh's — as the canonical serialization (core) at
 * `.xspec/record.json`, through the derived-file write primitive like the
 * graph data, replacing whatever occupies the path, an unreadable record
 * included (SPEC 14.23). The record is graph data (SPEC 13.3), so a refused
 * write of it concerns the graph-data area (SPEC 14.24).
 */
export async function writeDerivedFileRecord(
  root: string,
  paths: readonly string[],
): Promise<void> {
  await writeDerivedFile(
    root,
    DERIVED_FILE_RECORD_PATH,
    serializeDerivedFileRecord(paths),
    GRAPH_DATA_AREA,
  );
}
