// Graph-data storage — the I/O half (SPEC 13.3, 13.4; IMPLEMENTATION
// Architecture: storage is workspace-layer I/O).
//
// The graph data lives at `.xspec/graph.json` under the workspace root
// (SPEC 13.3: under `.xspec/`; content otherwise opaque). It is a derived
// file (SPEC 13.4): fully reproducible from sources, configuration, and the
// journal via `xspec build`; its path belongs to xspec, so a write replaces
// whatever occupies it — a symbolic link is replaced as itself and never
// written through — and a conflicted, corrupted, deleted, or orphaned store
// is correctly resolved by rebuilding. Only the reading side is here plus
// the one write, through the workspace write layer (writes.ts) like every
// product file write, so it is atomic in its observable effect (SPEC 13.5).
//
// Serialization, parsing, and the compare-with-current predicate are the
// pure core's (src/core/graph-data.ts). Loading classifies the occupant
// with lstat and yields one of three states (SPEC 13.3, 14.23): absent
// (nothing recorded — the refreshing reads write build's data whole),
// readable (the parsed model — compared, and refreshed on mismatch with
// the record preserved), or unreadable — recorded state that exists but
// cannot be read as a record: a non-plain occupant, or bytes that are not
// valid UTF-8 or not the stored shape. The unreadable state is neither
// read, repaired, nor replaced by any refreshing read and no finding is
// reported for it (SPEC 13.3); it persists — met by the record-consulting
// surfaces (SPEC 11.6, 6.6 → 14.23) and reported as staleness by `check`
// (SPEC 14.10) — until a successful `build` or a finishing `rename`/`move`
// regeneration replaces the record.

import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { compareBytes } from "../core/bytes.js";
import type { GraphData } from "../core/graph-data.js";
import {
  GRAPH_DATA_PATH,
  parseGraphData,
  serializeGraphData,
} from "../core/graph-data.js";
import { classifyOccupant, writeDerivedFile } from "./writes.js";

const strictUtf8Decoder = new TextDecoder("utf-8", { fatal: true });

/**
 * The loaded store's three-way state (SPEC 13.3, 14.23) — the same
 * classification `readDerivedFileRecord` makes for the record-consulting
 * surfaces: nothing recorded, a readable record, or recorded state that
 * exists but cannot be read as a record.
 */
export type GraphDataState = "absent" | "readable" | "unreadable";

/** The loaded store: its state, raw bytes and, when they parse, the model. */
export interface LoadedGraphData {
  /**
   * SPEC 13.3/14.23: "absent" — nothing occupies the store's path (the
   * refreshing reads write build's data whole, SPEC 13.3); "readable" —
   * a plain file parsing as the stored shape (`data` non-null);
   * "unreadable" — recorded state that exists but cannot be read as a
   * record: a non-plain occupant, or bytes that are not valid UTF-8, not
   * JSON, or not the stored shape. A refresh neither reads, repairs, nor
   * replaces the unreadable state and reports no finding for it; only a
   * successful `build` or a finishing `rename`/`move` regeneration
   * replaces it, and `check` reports it as staleness (SPEC 14.10).
   */
  readonly state: GraphDataState;
  /**
   * The stored file's exact bytes — null when no plain file is readable:
   * the path is absent or occupied by anything other than a plain file
   * (SPEC 13.4: a derived path's occupant is resolved by rebuilding).
   */
  readonly bytes: Uint8Array | null;
  /**
   * The parsed model — non-null exactly in the "readable" state. Feed this
   * with `bytes` to `graphDataMatchesCurrent` (core) for the staleness
   * predicate, and to `recordedDerivedFiles` (core) for orphan handling
   * (an unreadable record recovers nothing — such orphans are outside
   * xspec's knowledge, SPEC 13.4).
   */
  readonly data: GraphData | null;
}

/** The graph-data file's absolute path under the workspace root. */
function graphDataAbsolutePath(root: string): string {
  return path.join(root, ...GRAPH_DATA_PATH.split("/"));
}

/**
 * Load the workspace's graph data (SPEC 13.3). Never throws on the
 * expected states — each loads as its `GraphDataState`, and the refresh,
 * failure, and staleness behaviors are the callers' (SPEC 13.3, 14.10,
 * 14.23). The occupant classification mirrors `readDerivedFileRecord`:
 * only a plain file is read; anything else at the record's path exists but
 * is no readable record, while a path below a non-directory classifies
 * absent (writes.ts — nothing occupies it).
 */
export async function loadGraphData(root: string): Promise<LoadedGraphData> {
  const absolute = graphDataAbsolutePath(root);
  const occupant = await classifyOccupant(absolute);
  if (occupant === "absent") {
    return { state: "absent", bytes: null, data: null };
  }
  if (occupant !== "file") {
    return { state: "unreadable", bytes: null, data: null };
  }
  let bytes: Uint8Array;
  try {
    bytes = await fsp.readFile(absolute);
  } catch {
    // Vanished between classification and read (SPEC 13.5: concurrent
    // commands, last-write-wins): nothing exists to read as a record.
    return { state: "absent", bytes: null, data: null };
  }
  let text: string;
  try {
    text = strictUtf8Decoder.decode(bytes);
  } catch {
    return { state: "unreadable", bytes, data: null };
  }
  const data = parseGraphData(text);
  if (data === null) {
    return { state: "unreadable", bytes, data: null };
  }
  return { state: "readable", bytes, data };
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
       * record — a non-plain-file occupant, or bytes that are not the
       * stored shape (corrupt, merge-conflicted or otherwise). The
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
 * unreadable-record staleness arm, 14.10). Never repairs, replaces, or
 * otherwise writes: the state persists until a successful `build` or a
 * finishing regeneration replaces the record (SPEC 13.3). The three-way
 * state is `loadGraphData`'s — one classification rule for the record
 * readers and the refreshing reads alike.
 */
export async function readDerivedFileRecord(
  root: string,
): Promise<DerivedFileRecord> {
  const loaded = await loadGraphData(root);
  if (loaded.state !== "readable" || loaded.data === null) {
    return { state: loaded.state === "absent" ? "absent" : "unreadable" };
  }
  // SPEC 11.6/12.0: the recorded paths as one byte-ordered, duplicate-free
  // list (the canonical serialization already writes them so; sorting here
  // keeps the datum canonical whatever bytes parsed).
  return {
    state: "readable",
    paths: [...new Set(loaded.data.derivedFiles)].sort(compareBytes),
  };
}

/**
 * Write the graph data (SPEC 13.3): the canonical serialization (core) at
 * `.xspec/graph.json`, through the derived-file write primitive — atomic
 * in its observable effect (SPEC 13.5), replacing whatever occupies the
 * path (SPEC 13.4). Byte-deterministic for a given workspace (SPEC 12.0).
 * Callers validate the write path first (SPEC 14.22,
 * `obstructedWritePathFindings`) and write only for workspaces that pass
 * build validation — a failed build or refresh writes nothing (SPEC 12.1,
 * 13.3).
 */
export async function writeGraphData(
  root: string,
  data: GraphData,
): Promise<void> {
  await writeDerivedFile(root, GRAPH_DATA_PATH, serializeGraphData(data));
}
