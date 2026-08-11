// H-3 adapter layer — corrupt-record staging for T6.6-6 (TEST-SPEC §0 H-3,
// §6.6), shared by the other 14.23 stagings that reuse "T6.6-6's staging"
// (T12.2-2's unreadable-record arm, T13.3-2's record discipline, T11.6-4).
//
// Graph-data content is opaque (H-4) and its layout deliberately unenumerated
// (SPEC 13.3, 11.6), so the only shape knowledge that exists for the record
// is T13.3-2's operational path set: every path under `.xspec/` except the
// durable `.xspec/journal` and `.xspec/reviews/`. That predicate lives here
// (`isGraphDataKey`; the T13.3-2 machinery in
// test/suite/registry/section-13.3.ts re-exports it), and the corruption is
// shape-blind — TEST-SPEC T6.6-6: "truncation or garbage over T13.3-2's
// operational path set" — realized as a garbage overwrite of every
// product-written plain file in the set, staging "recorded state that exists
// but cannot be read as a record" (SPEC 14.23): the files stay present (an
// absent record is the different, nothing-recorded success path, T6.6-5)
// while their bytes can be read as no structured record at all (not even
// valid UTF-8).
//
// H-3 staging discipline (as T10.1-4's session-staging.ts): the
// transformation applies only to files the product itself wrote — it never
// creates a path, so the harness never fabricates a record file from an
// assumed layout — and fails loudly (diagnosed test error, nothing modified)
// when the workspace holds nothing to corrupt: no graph-data area, no
// graph-data file in it (the caller must run a successful `build` first), or
// a non-plain-file entry in the set (every file xspec writes is a plain file
// and its writes never traverse a symbolic link, SPEC 13.4 — such an
// occupant is not a product-written record file, and writing through it
// could escape the workspace).

import { Buffer } from "node:buffer";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { fail } from "../assertions.js";

/**
 * The graph-data area: the location under which graph data is kept, spelled
 * as its workspace-relative path with no trailing separator (SPEC 11.6) —
 * the concerned path of every condition-23 finding and of the 14.10 unit
 * form ("no path inside the area is named").
 */
export const GRAPH_DATA_AREA_PATH = ".xspec";

/**
 * Whether a workspace-relative, `/`-separated path is graph data: under
 * `.xspec/`, excluding the durable `.xspec/journal` and `.xspec/reviews/`
 * (SPEC 13.3, 13.4; TEST-SPEC T13.3-2's operational definition — the whole
 * shape SPEC.md gives the record). One home for the predicate: the suite's
 * graph-data machinery (section-13.3.ts) re-exports it.
 */
export function isGraphDataKey(key: string): boolean {
  if (!key.startsWith(`${GRAPH_DATA_AREA_PATH}/`)) return false;
  if (key === `${GRAPH_DATA_AREA_PATH}/journal`) return false;
  if (
    key === `${GRAPH_DATA_AREA_PATH}/reviews` ||
    key.startsWith(`${GRAPH_DATA_AREA_PATH}/reviews/`)
  ) {
    return false;
  }
  return true;
}

/**
 * The deterministic garbage a corrupted record file holds: readable as no
 * record — not one JSON document, not even valid UTF-8 (0xFF and 0xFE occur
 * in no UTF-8 sequence; 0xC3 0x28 is a truncated one) — while the file stays
 * present, so the staged state is "exists but cannot be read as a record"
 * (SPEC 14.23), never the absent-record success path.
 */
export const RECORD_GARBAGE_BYTES: Uint8Array = Uint8Array.from([
  ...Buffer.from("xspec-harness: not a record ", "utf8"),
  0x00,
  0xff,
  0xfe,
  0xc3,
  0x28,
]);

function stagingFail(context: string, problem: string): never {
  fail(
    `${context}: corrupt-record staging: ${problem}. H-3: the shape-blind ` +
      `corruption applies only to record files the product itself wrote ` +
      `(truncation or garbage over T13.3-2's operational path set) and ` +
      `fails loudly otherwise — the harness never fabricates a record file ` +
      `from an assumed layout. Nothing was modified.`,
  );
}

/** Recursively collect the graph-data plain files under `rel` (see above). */
async function collectGraphDataFiles(
  rootAbs: string,
  rel: string,
  context: string,
): Promise<string[]> {
  const collected: string[] = [];
  const entries = await fsp.readdir(path.join(rootAbs, rel), {
    withFileTypes: true,
  });
  for (const entry of entries) {
    const key = `${rel}/${entry.name}`;
    // The durable journal and reviews paths are no part of the record
    // (T13.3-2): skipped entirely, whatever occupies them.
    if (!isGraphDataKey(key)) continue;
    if (entry.isDirectory()) {
      collected.push(...(await collectGraphDataFiles(rootAbs, key, context)));
    } else if (entry.isFile()) {
      collected.push(key);
    } else {
      stagingFail(
        context,
        `${key} is not a plain file or directory — every file xspec writes ` +
          `is a plain file and its writes never traverse a symbolic link ` +
          `(SPEC 13.4), so this occupant is not a product-written record ` +
          `file and the harness will not write through it`,
      );
    }
  }
  return collected;
}

/**
 * Corrupt the product-written graph data shape-blind (TEST-SPEC T6.6-6):
 * overwrite every plain file of T13.3-2's operational path set — every path
 * under `.xspec/` except the durable journal and reviews paths — with
 * {@link RECORD_GARBAGE_BYTES}, leaving every path present (no path is
 * created or removed; directories keep their structure). Fails loudly, with
 * nothing modified, when the graph-data area is missing or not a real
 * directory, when the set holds no plain file (nothing product-written to
 * corrupt — run a successful `build` first), or when it holds a
 * non-plain-file entry (SPEC 13.4). Returns the corrupted files'
 * workspace-relative paths in byte order.
 */
export async function corruptGraphDataShapeBlind(
  rootAbs: string,
  context: string,
): Promise<readonly string[]> {
  const areaAbs = path.join(rootAbs, GRAPH_DATA_AREA_PATH);
  let areaStats;
  try {
    areaStats = await fsp.lstat(areaAbs);
  } catch {
    stagingFail(
      context,
      `no ${GRAPH_DATA_AREA_PATH} directory exists — the product has ` +
        `written no graph data here (SPEC 13.3: xspec maintains graph data ` +
        `under .xspec/)`,
    );
  }
  if (!areaStats.isDirectory()) {
    stagingFail(
      context,
      `${GRAPH_DATA_AREA_PATH} is not a real directory — the graph-data ` +
        `area the product writes is one (SPEC 13.3, 13.4)`,
    );
  }
  const files = (
    await collectGraphDataFiles(rootAbs, GRAPH_DATA_AREA_PATH, context)
  ).sort();
  if (files.length === 0) {
    stagingFail(
      context,
      `found no graph-data file to corrupt under ${GRAPH_DATA_AREA_PATH}/ ` +
        `(outside the durable journal and reviews paths) — the corruption ` +
        `applies to record files the product itself wrote, so run a ` +
        `successful \`build\` first (SPEC 12.1, 13.3)`,
    );
  }
  for (const key of files) {
    await fsp.writeFile(path.join(rootAbs, key), RECORD_GARBAGE_BYTES);
  }
  return files;
}
