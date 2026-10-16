// Byte copies of directory trees for the xspec test harness (TEST-SPEC H-4,
// H-6). Harness machinery only: no product imports.
//
// The tests that run a command on "a copy" of a workspace's state make it
// here, then check it against the original with a snapshot compare
// (helpers/snapshot.ts) before anything runs there — a difference is a
// harness error, never a product verdict: T13.5-3's past-the-hold copies
// (section-13.5.ts `withCopyOf`), T6.4-1's human-form byte copy
// (section-6.4.ts `withByteCopyOf`), P-10's reader-free twins
// (section-16-p10.ts), P-14's kept built state (section-16-p14.ts), and the
// rebuilt copy of a stopped state whose `build` says what `check` must find
// stale there (TEST-SPEC T13.5-7 (b); write-refusal-staging.ts
// `stalenessAgainstRebuiltCopy`). A copy composes no source text, so S-9
// has nothing to judge: its sources were staged, and judged, where they
// were written, the rest being the product's own state.

import { Buffer } from "node:buffer";
import * as fsp from "node:fs/promises";

/** `name` within `dir`, byte for byte. */
function joinPathBytes(dir: Buffer, name: Buffer): Buffer {
  return Buffer.concat([dir, Buffer.from("/"), name]);
}

/**
 * Copy the tree under `from` into the existing empty directory `to`, byte
 * for byte: directories (each given its mode once filled), plain files
 * (bytes and mode), and symbolic links (targets verbatim), names as bytes.
 * Anything else is a harness error: no such entry is the product's state
 * here. `exclude`, judged on each entry's relative byte path
 * (`/`-separated, as `SnapshotOptions.exclude` is), leaves an entry out —
 * a directory's whole subtree unread: P-10's reader-free twins leave the
 * lock path out (`isLockPathBytes`; TEST-SPEC P-10: copied "the lock path
 * aside"), whose entries a product may make unreadable (H-4).
 */
export async function copyTreeBytes(
  from: Buffer,
  to: Buffer,
  exclude?: (relPathBytes: Uint8Array) => boolean,
  rel: Buffer = Buffer.alloc(0),
): Promise<void> {
  const names = (await fsp.readdir(from, { encoding: "buffer" })).sort(
    Buffer.compare,
  );
  for (const name of names) {
    const childRel = rel.length === 0 ? name : joinPathBytes(rel, name);
    if (exclude?.(childRel) === true) continue;
    const source = joinPathBytes(from, name);
    const destination = joinPathBytes(to, name);
    const stats = await fsp.lstat(source);
    if (stats.isDirectory()) {
      await fsp.mkdir(destination);
      await copyTreeBytes(source, destination, exclude, childRel);
      await fsp.chmod(destination, stats.mode & 0o7777);
    } else if (stats.isFile()) {
      await fsp.copyFile(source, destination, fsp.constants.COPYFILE_EXCL);
      await fsp.chmod(destination, stats.mode & 0o7777);
    } else if (stats.isSymbolicLink()) {
      await fsp.symlink(
        await fsp.readlink(source, { encoding: "buffer" }),
        destination,
      );
    } else {
      throw new Error(
        `harness error: a workspace copy meets ${source.toString()}, ` +
          `neither a directory, a plain file, nor a symbolic link`,
      );
    }
  }
}
