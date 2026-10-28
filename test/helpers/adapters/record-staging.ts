// H-3 adapter layer — corrupt-record staging for T6.6-6 (TEST-SPEC §0 H-3,
// §6.6), shared by the other 14.23 stagings that reuse "T6.6-6's staging"
// (T12.2-2's unreadable-record arm, T13.3-2's record discipline, T11.6-4).
//
// Graph-data content is opaque (H-4) and its layout deliberately unenumerated
// (SPEC 13.3, 11.6), so the only shape knowledge that exists for the record
// is T13.3-2's operational path set: every path under `.xspec/` except the
// durable `.xspec/journal` and `.xspec/reviews/` and the transient lock path
// `.xspec/lock` with everything under it (13.4: no graph data). That
// predicate lives here (`isGraphDataKey`, the lock path judged by
// helpers/lock-path.ts; the T13.3-2 machinery in
// test/suite/registry/section-13.3.ts re-exports it), beside the one walk
// of the set (`collectGraphDataEntries`: its plain files and its
// directories, for T14-10(f)'s unreadable staging; `collectGraphDataFiles`:
// its plain files alone), and the corruption is shape-blind —
// TEST-SPEC T6.6-6: "truncation or garbage over T13.3-2's operational path
// set" — realized as a garbage overwrite of every
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
import { isLockPathKey } from "../lock-path.js";
import { displaySnapshotPath, snapshotKeyBytes } from "../snapshot.js";

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
 * and the transient lock path `.xspec/lock` with everything under it (SPEC
 * 13.3, 13.4: the lock directory is no graph data, bearing on no comparison
 * of graph data; TEST-SPEC T13.3-2's operational definition, binding for
 * T13.4-3 and T14-10(f) — the whole shape SPEC.md gives the record). One
 * home for the predicate: the suite's graph-data machinery
 * (section-13.3.ts) re-exports it, and every graph-data classifier of the
 * suite judges a path through it.
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
  if (isLockPathKey(key)) return false;
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

/**
 * The absolute byte path of a workspace-relative snapshot key: the root's
 * bytes, a `/`, and the key's exact bytes (`snapshotKeyBytes`), so a name the
 * product chose that is not ASCII, or not valid UTF-8, is reached exactly.
 */
function keyPath(rootBytes: Buffer, key: string): Buffer {
  return Buffer.concat([rootBytes, Buffer.from([0x2f]), snapshotKeyBytes(key)]);
}

/**
 * T13.3-2's operational path set as one walk finds it: its plain files and
 * its directories, each as snapshot keys in byte order.
 */
export interface GraphDataEntries {
  readonly files: readonly string[];
  /**
   * Every directory of the set — a directory under `.xspec/` that is
   * neither the session directory nor at or under the lock path; never the
   * area's own directory `.xspec`, which is no path under it.
   */
  readonly directories: readonly string[];
}

/**
 * Every plain file and every directory of T13.3-2's operational path set
 * (`isGraphDataKey`) in the workspace rooted at `rootAbs`, walked
 * recursively from the graph-data area, as snapshot keys in byte order
 * (helpers/snapshot.ts: the exact relative path bytes, held latin1-encoded
 * — for an ASCII name, the workspace-relative path itself). Names are listed
 * as raw bytes and each entry classified by `lstat` at its exact byte path
 * — graph data's layout is the product's (SPEC 13.3: files directly in the
 * area or in directories of its own below it), so a name that is not
 * ASCII, or not valid UTF-8, is collected like any other, where a UTF-8
 * listing would misname it. A path outside the set — the durable journal
 * and reviews paths, the transient lock path — is skipped entirely,
 * whatever occupies it, and nothing under it is listed. An entry in the set
 * that is neither a plain file nor a directory (a symbolic link, never
 * followed) is handed to `onOther` — the corruption refuses it there — or,
 * with no handler, skipped. The area and every directory of the set must be
 * listable (the caller's premise); a listing the environment refuses throws
 * as is.
 */
export async function collectGraphDataEntries(
  rootAbs: string,
  onOther?: (key: string) => void,
): Promise<GraphDataEntries> {
  const files: string[] = [];
  const directories: string[] = [];
  await walkGraphData(
    Buffer.from(rootAbs),
    GRAPH_DATA_AREA_PATH,
    onOther,
    files,
    directories,
  );
  return { files: files.sort(), directories: directories.sort() };
}

/**
 * Every plain file of T13.3-2's operational path set, as
 * {@link collectGraphDataEntries} walks it — the same keys, order, `onOther`
 * calls, and refusals — its directories left out.
 */
export async function collectGraphDataFiles(
  rootAbs: string,
  onOther?: (key: string) => void,
): Promise<string[]> {
  return [...(await collectGraphDataEntries(rootAbs, onOther)).files];
}

async function walkGraphData(
  rootBytes: Buffer,
  rel: string,
  onOther: ((key: string) => void) | undefined,
  files: string[],
  directories: string[],
): Promise<void> {
  const names = (
    await fsp.readdir(keyPath(rootBytes, rel), { encoding: "buffer" })
  ).sort(Buffer.compare);
  for (const name of names) {
    const key = `${rel}/${name.toString("latin1")}`;
    // The durable journal and reviews paths and the transient lock path are
    // no part of the record (T13.3-2): skipped entirely, whatever occupies
    // them.
    if (!isGraphDataKey(key)) continue;
    const stats = await fsp.lstat(keyPath(rootBytes, key));
    if (stats.isDirectory()) {
      directories.push(key);
      await walkGraphData(rootBytes, key, onOther, files, directories);
    } else if (stats.isFile()) {
      files.push(key);
    } else {
      onOther?.(key);
    }
  }
}

/**
 * Corrupt the product-written graph data shape-blind (TEST-SPEC T6.6-6):
 * overwrite every plain file of T13.3-2's operational path set — every path
 * under `.xspec/` except the durable journal and reviews paths and the
 * transient lock path with everything under it, which stay untouched
 * whatever occupies them — with {@link RECORD_GARBAGE_BYTES}, leaving every
 * path present (no path is created or removed; directories keep their
 * structure). Fails loudly, with nothing modified, when the graph-data area
 * is missing or not a real directory, when the set holds no plain file
 * (nothing product-written to corrupt — run a successful `build` first), or
 * when it holds a non-plain-file entry (SPEC 13.4). Every file is reached and overwritten
 * at its exact name bytes, whatever the name the product chose (SPEC 13.3:
 * graph data's layout is unenumerated). Returns the corrupted files as
 * snapshot keys in byte order (helpers/snapshot.ts: the exact relative path
 * bytes, held latin1-encoded — for an ASCII name, the workspace-relative
 * path itself).
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
  const rootBytes = Buffer.from(rootAbs);
  const files = await collectGraphDataFiles(rootAbs, (key) =>
    stagingFail(
      context,
      `${displaySnapshotPath(key)} is not a plain file or directory — ` +
        `every file xspec writes is a plain file and its writes never ` +
        `traverse a symbolic link (SPEC 13.4), so this occupant is not a ` +
        `product-written record file and the harness will not write ` +
        `through it`,
    ),
  );
  if (files.length === 0) {
    stagingFail(
      context,
      `found no graph-data file to corrupt under ${GRAPH_DATA_AREA_PATH}/ ` +
        `(outside the durable journal and reviews paths and the lock ` +
        `path) — the corruption applies to record files the product ` +
        `itself wrote, so run a successful \`build\` first (SPEC 12.1, 13.3)`,
    );
  }
  for (const key of files) {
    await fsp.writeFile(keyPath(rootBytes, key), RECORD_GARBAGE_BYTES);
  }
  return files;
}
