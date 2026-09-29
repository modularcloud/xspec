// `xspec check`'s staleness verification — the I/O half (SPEC 12.2, 14.10;
// IMPLEMENTATION Architecture: all filesystem access lives in the workspace
// layer).
//
// SPEC 12.2/14.10: `check` verifies that generated files are
// content-identical to what the current sources and configuration generate,
// and that no recorded derived file remains at a path no longer generated;
// each deviation is a 14.10 finding naming the file and instructing
// rebuilding. SPEC 13.3: `check` never refreshes — this module only reads
// and compares, writing nothing; the graph data itself is judged by the
// same compare-with-current predicate the refreshing reads use
// (core/graph-data.ts, `graphDataMatchesCurrent`), over the snapshot file
// alone, so the retained derived-file record — lagging, or absent where a
// refresh wrote graph data beside no record — never reads as staleness.
//
// The comparison is against the pure build derivation (core/build.ts). The
// mismatch forms — per file and graph data — are consulted on a workspace
// passing `build`'s validations alone: with source validation errors,
// journal errors, or refused writes (14.22) alike, "what the current
// sources and configuration generate" is undefined, and those forms go
// unreported (SPEC 14.10, 13.3, 14). The two forms consulting no generated
// content — the unreadable-record unit form and the recorded-file form —
// are reported whatever the sources' validity (SPEC 14.10).

import * as fsp from "node:fs/promises";
import * as path from "node:path";
import type { BuildOutputs } from "../core/build.js";
import type { Finding } from "../core/findings.js";
import { pathFinding } from "../core/findings.js";
import {
  GRAPH_DATA_AREA,
  graphDataMatchesCurrent,
} from "../core/graph-data.js";
import { isFilesystemFailure } from "./environment-refusal.js";
import type { DerivedFileRecord, LoadedGraphData } from "./graph-data.js";
import type { PathOccupant } from "./writes.js";
import { classifyOccupant, describeOccupant, readsReach } from "./writes.js";

const utf8Encoder = new TextEncoder();

/** The absolute filesystem path of a workspace-relative `/`-path. */
function absoluteOf(root: string, rel: string): string {
  return path.join(root, ...rel.split("/"));
}

/** Exact byte equality (SPEC 12.0: comparisons are byte-wise). */
function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return false;
  }
  return true;
}

/**
 * What occupies a derived-file path `check` compares (SPEC 14.10), judged
 * by `lstat` (`classifyOccupant`), or "refused" where the environment
 * refuses the kind read: SPEC 14.25 makes a derived file's content or kind
 * that `check` compares condition 10, the path stale — never the read
 * failure of condition 25, and never an internal error.
 */
async function comparedOccupant(
  absolute: string,
): Promise<PathOccupant | "refused"> {
  try {
    return await classifyOccupant(absolute);
  } catch (error) {
    if (isFilesystemFailure(error)) return "refused";
    throw error;
  }
}

/** SPEC 14.10: a stale generated file — names the file, instructs rebuild. */
function staleFinding(rel: string, state: string): Finding {
  return pathFinding(
    10,
    `stale generated output: ${rel} ${state} what the current sources ` +
      `and configuration generate; run \`xspec build\` to regenerate every ` +
      `derived file (SPEC 14.10)`,
    rel,
  );
}

/** SPEC 14.10: a recorded derived file at a no-longer-generated path. */
function orphanFinding(rel: string): Finding {
  return pathFinding(
    10,
    `stale generated output: the recorded derived file ${rel} remains at ` +
      `a path the current sources and configuration no longer generate; ` +
      `run \`xspec build\` to remove it (SPEC 14.10)`,
    rel,
  );
}

/**
 * SPEC 14.10's mismatch/missing unit form: graph data that is missing or
 * does not match the current sources and configuration (the comparison of
 * 13.3, the recorded derived-file paths excluded) — one condition-10
 * finding instructing rebuilding, concerned path the graph-data area
 * itself (the record's layout is deliberately unenumerated, SPEC
 * 13.3/11.6, so no path inside it is named), never the per-file message
 * shape.
 */
function mismatchedGraphDataStaleFinding(): Finding {
  return pathFinding(
    10,
    `stale generated output: the graph data under the graph-data area is ` +
      `missing or does not match the current sources and configuration; ` +
      `run \`xspec build\` to regenerate every derived file (SPEC 14.10, ` +
      `13.3)`,
    GRAPH_DATA_AREA,
  );
}

/**
 * SPEC 14.10's unreadable-record unit form: recorded generation state that
 * exists but cannot be read as a record (14.23) is staleness — one
 * condition-10 finding instructing rebuilding, concerned path the
 * graph-data area itself (the record's layout is deliberately
 * unenumerated, SPEC 13.3/11.6, so no path inside it is named).
 */
function unreadableRecordStaleFinding(): Finding {
  return pathFinding(
    10,
    `stale generated output: the recorded generation state under the ` +
      `graph-data area exists but cannot be read as a record; run ` +
      `\`xspec build\` to regenerate every derived file and replace the ` +
      `record (SPEC 14.10, 14.23)`,
    GRAPH_DATA_AREA,
  );
}

/**
 * SPEC 14.10's mismatch forms — per file and graph data — the findings of
 * `check` (SPEC 12.2) that compare against the content the current sources
 * and configuration generate, reading and comparing only (nothing is
 * written):
 *
 * - each derived file the current sources and configuration generate whose
 *   path holds different bytes, no plain file, or nothing at all;
 * - the graph data's missing-or-mismatch unit form, one finding whose
 *   concerned path is the graph-data area itself, no path inside it named,
 *   by the shared compare-with-current predicate over the snapshot file
 *   (SPEC 13.3 — the record, stored apart, is never staleness: lagging, or
 *   absent beside graph data a refresh wrote). The unit forms are
 *   exclusive (SPEC 14.10): while the record cannot be read as a record
 *   (SPEC 14.23) the unreadable-record form alone reports
 *   (`recordStalenessFindings`), never this one beside it.
 *
 * Detectable only on a workspace passing `build`'s validations (SPEC
 * 14.10, 13.3): with source validation errors, journal errors, or refused
 * writes (14.22) alike, "what the current sources and configuration
 * generate" is undefined, and these forms go unreported (SPEC 14) — the
 * caller consults them on a passing workspace alone. `outputs` is the pure
 * build derivation over the current workspace, `stored` the loaded graph
 * data, and `record` the loaded derived-file record. Deterministic order:
 * generated files in the build's output order, then the graph data (SPEC
 * 12.0).
 */
export async function mismatchStalenessFindings(
  root: string,
  outputs: BuildOutputs,
  stored: LoadedGraphData,
  record: DerivedFileRecord,
): Promise<Finding[]> {
  const findings: Finding[] = [];

  for (const file of outputs.files) {
    const absolute = absoluteOf(root, file.path);
    const occupant = await comparedOccupant(absolute);
    if (occupant === "refused") {
      // SPEC 14.25 → 14.10: a refused kind read leaves the path stale.
      findings.push(
        staleFinding(file.path, "cannot be examined — it does not match"),
      );
      continue;
    }
    if (occupant === "absent") {
      findings.push(staleFinding(file.path, "is missing — it does not match"));
      continue;
    }
    if (occupant !== "file") {
      // SPEC 13.4: generation writes a plain file (a symbolic link at the
      // path would be replaced as itself) — any other occupant cannot be
      // content-identical to the generated file.
      findings.push(
        staleFinding(
          file.path,
          `is ${describeOccupant(occupant)}, not the plain file holding`,
        ),
      );
      continue;
    }
    let bytes: Uint8Array;
    try {
      bytes = await fsp.readFile(absolute);
    } catch {
      // SPEC 14.25 → 14.10: content the environment refuses to read leaves
      // the path stale — as does a file gone between classification and
      // read (SPEC 13.5 concurrency): it no longer matches.
      findings.push(
        staleFinding(file.path, "cannot be read — it does not match"),
      );
      continue;
    }
    if (!bytesEqual(bytes, utf8Encoder.encode(file.content))) {
      findings.push(staleFinding(file.path, "does not match"));
    }
  }

  // SPEC 14.10's mismatch unit form: `check` reports the graph data stale
  // exactly when the refreshing reads would refresh it — the shared
  // predicate (SPEC 13.3) — unless the record is unreadable, whose own
  // form reports alone (the unit forms are exclusive).
  if (
    record.state !== "unreadable" &&
    !graphDataMatchesCurrent(stored.bytes, outputs.graphData)
  ) {
    findings.push(mismatchedGraphDataStaleFinding());
  }

  return findings;
}

/**
 * SPEC 14.10's two forms consulting no generated content, reported by
 * `check` (SPEC 12.2) whatever the sources' validity — reading only,
 * nothing written:
 *
 * - the unreadable-record unit form: recorded generation state that exists
 *   but cannot be read as a record (SPEC 14.23), one finding whose
 *   concerned path is the graph-data area itself (exclusive with the
 *   mismatch unit form of `mismatchStalenessFindings`);
 * - the recorded-file form: each recorded derived file remaining (anything
 *   occupying its path) at a path the current sources and configuration no
 *   longer generate — `orphans`, the record's paths outside the set of
 *   generated paths that discovery and configuration define on any
 *   workspace, in byte order (core/build.ts: `orphanedRecordedPaths` over
 *   `discoveredGeneratedPaths`); one whose path is vacant remains nowhere,
 *   no finding. Each path is judged by the read side of SPEC 13.4
 *   (`readsReach`): its workspace-relative directory components shallowest
 *   first, so below a component that is absent or occupied by anything
 *   other than a directory — a plain file, or a symbolic link whatever it
 *   targets, never read through — the path holds nothing and remains
 *   nowhere (14.25's absence, never its refusal), as `build`'s removal
 *   leaves such a path untouched (`removeDerivedFile`). A component's kind
 *   read the environment refuses is the read failure concerning that
 *   component (SPEC 14.25: a path occupant's kind examined under 13.4, no
 *   derived file's), thrown so `check` stops at it, exit 2 — as the same
 *   refusal among a generated path's components stops it at the 14.22
 *   examination. While the unreadable-record state holds this form is
 *   undetectable (SPEC 14.10): it consults no readable record, and an
 *   unreadable record records nothing (`orphans` is empty by
 *   construction, `recordedPathsOf`). A path reached whose own kind the
 *   environment refuses to read is stale all the same (SPEC 14.25 → 14.10:
 *   a derived file's kind that `check` compares, `comparedOccupant`).
 *
 * Deterministic order: the graph data, then the orphans (SPEC 12.0).
 */
export async function recordStalenessFindings(
  root: string,
  record: DerivedFileRecord,
  orphans: readonly string[],
): Promise<Finding[]> {
  const findings: Finding[] = [];
  if (record.state === "unreadable") {
    findings.push(unreadableRecordStaleFinding());
  }
  for (const rel of orphans) {
    // SPEC 13.4: reads traverse no non-directory component — below one the
    // recorded path holds nothing, and no derived file remains there.
    if (!(await readsReach(root, rel))) continue;
    if ((await comparedOccupant(absoluteOf(root, rel))) !== "absent") {
      findings.push(orphanFinding(rel));
    }
  }
  return findings;
}
