// Journal storage — the I/O half (SPEC 6.1, 13.4; IMPLEMENTATION
// Architecture: journal storage is workspace-layer I/O).
//
// The journal lives at `.xspec/journal` under the workspace root. It is a
// durable file (SPEC 13.4): written only by `xspec rename` and `xspec move`
// — every other command at most reads it — never regenerated, and never
// modified or deleted by other commands. An absent file is an empty journal
// (SPEC 6.1). A journal path occupied by anything other than a plain file —
// a symbolic link included — is never read, appended to, or replaced: it is
// a journal error (SPEC 13.4 → 14.13), and so is a journal whose content
// the environment refuses to read (SPEC 14.25 → 14.13), while a refused
// read of the journal path's kind is the read failure of condition 25
// (SPEC 14.25). Below an area path `.xspec` holding no directory — a plain
// file, or a symbolic link whatever it targets — nothing is read: the
// journal so placed is empty (SPEC 6.1) and unoccupied to the inventory
// (SPEC 11.6), never a journal error (13.4).
//
// Parsing, validation, and the canonical-identity walk are the pure core's
// (src/core/journal.ts); this module classifies the occupant and reads
// bytes, and its one write goes through the workspace write layer
// (writes.ts), like every product file write.

import * as fsp from "node:fs/promises";
import * as path from "node:path";
import type { Finding } from "../core/findings.js";
import { pathFinding } from "../core/findings.js";
import type { JournalEntry, PositionedJournalEntry } from "../core/journal.js";
import {
  Journal,
  JOURNAL_PATH,
  parseJournal,
  serializeJournalEntry,
} from "../core/journal.js";
import {
  isAbsenceFailure,
  isFilesystemFailure,
} from "./environment-refusal.js";
import type { PathOccupant } from "./writes.js";
import {
  appendDurableFile,
  describeOccupant,
  readableOccupant,
} from "./writes.js";

/**
 * What occupies the journal's path (SPEC 6.1, 13.4), and whether its
 * content could be read: "refused" is a plain file whose content the
 * environment refuses to read (SPEC 14.25 → 14.13).
 */
export type JournalFileState = "absent" | "plain" | "occupied" | "refused";

/** The loaded journal: parse results plus the file-state classification. */
export interface LoadedJournal {
  readonly fileState: JournalFileState;
  /**
   * The walkable journal over the parsed entries. Meaningful for canonical
   * identities and replay only when `findings` is empty — a journal error
   * fails workspace validation before identities are ever used (SPEC 14).
   */
  readonly journal: Journal;
  readonly entries: readonly PositionedJournalEntry[];
  /**
   * The journal's 14.13 findings: bad lines, a non-plain-file occupant, or
   * content the environment refuses to read (SPEC 14.25).
   */
  readonly findings: readonly Finding[];
  /**
   * The exact bytes the journal was loaded from — null for an absent file
   * (an empty journal, SPEC 6.1), for a non-plain occupant (never read,
   * SPEC 13.4), and for refused content (SPEC 14.25). The journal is a
   * derivation input (SPEC 5.4), so its
   * content fingerprint enters the graph data's recorded inputs
   * (SPEC 13.3; core/graph-data.ts).
   */
  readonly rawBytes: Uint8Array | null;
}

/** The journal's absolute path under the workspace root. */
function journalAbsolutePath(root: string): string {
  return path.join(root, ".xspec", "journal");
}

/**
 * What occupies the journal's path as reads see it (SPEC 6.1, 13.4) — the
 * one classification every current-journal read derives from: the path's
 * own occupant, judged by lstat so a link there is judged itself, never
 * probed through; and "absent" below an area path holding no directory —
 * `.xspec` a plain file, a symbolic link whatever it targets, or any other
 * non-directory occupant — where nothing is read, so the journal so placed
 * is empty (SPEC 6.1) and unoccupied to the inventory (SPEC 11.6), never a
 * journal error (`readableOccupant`, writes.ts).
 */
export async function journalOccupant(root: string): Promise<PathOccupant> {
  return readableOccupant(root, JOURNAL_PATH);
}

/**
 * SPEC 11.6: whether anything presently occupies the journal's path —
 * occupancy is presence alone, whatever kind of filesystem object occupies
 * it (a plain file, a directory, a symbolic link broken or not), judged by
 * lstat so a link is never probed through (SPEC 13.4) — none below an area
 * path holding no directory (`journalOccupant`). No content is read: an
 * absent journal is an empty journal (SPEC 6.1), and the inventory reports
 * no 14.13 for whatever the occupant holds.
 */
export async function journalOccupied(root: string): Promise<boolean> {
  return (await journalOccupant(root)) !== "absent";
}

/**
 * The journal loaded from raw file bytes (`null` = the file is absent, an
 * empty journal, SPEC 6.1) — the I/O-free tail of `loadJournal`, shared
 * with baseline reconstruction (SPEC 6.3), which reads the journal content
 * as it stood at a git ref instead of from the filesystem.
 */
export function journalFromBytes(bytes: Uint8Array | null): LoadedJournal {
  if (bytes === null) {
    return {
      fileState: "absent",
      journal: new Journal([]),
      entries: [],
      findings: [],
      rawBytes: null,
    };
  }
  const parsed = parseJournal(bytes);
  return {
    fileState: "plain",
    journal: new Journal(parsed.entries),
    entries: parsed.entries,
    findings: parsed.findings,
    rawBytes: bytes,
  };
}

/**
 * The journal whose path is occupied by something other than a plain file
 * (SPEC 6.1, 13.4 → 14.13): never read — one 14.13 finding, no entries.
 * Shared with baseline reconstruction (SPEC 6.3), where the occupant is a
 * git tree entry (a symbolic link or a directory at the journal's path at
 * the ref) instead of a filesystem occupant.
 */
export function occupiedJournal(occupant: PathOccupant): LoadedJournal {
  const finding: Finding = pathFinding(
    13,
    `journal error: the journal path ${JOURNAL_PATH} is occupied by ` +
      `${describeOccupant(occupant)}, not a plain file — a durable file's ` +
      `path occupied by anything other than a plain file is never read, ` +
      `appended to, or replaced (SPEC 6.1, 13.4); remove the occupant ` +
      `and restore the journal as a plain file from version control ` +
      `(SPEC 14.13)`,
    JOURNAL_PATH,
  );
  return {
    fileState: "occupied",
    journal: new Journal([]),
    entries: [],
    findings: [finding],
    rawBytes: null,
  };
}

/**
 * The journal whose content the environment refuses to read — permission
 * denied, an I/O error, any other failure the filesystem reports for the
 * read (SPEC 14.25 → 14.13: "a journal the environment refuses to read"):
 * one 14.13 finding concerning the journal, no entries, exactly as a
 * journal that cannot be read for any other reason fails the workspace's
 * validation (SPEC 14.13, 13.3). The message carries the filesystem's
 * error code, never its own text, which names absolute paths (SPEC 12.0).
 */
export function refusedJournal(cause: NodeJS.ErrnoException): LoadedJournal {
  const code = cause.code ?? "an unknown error";
  const finding: Finding = pathFinding(
    13,
    `journal error: the environment refused to read the journal ` +
      `${JOURNAL_PATH} (${code}) — its entries cannot be read, so no ` +
      `identity it maps can be resolved (SPEC 6.1, 14.25); make the ` +
      `journal readable, then rerun the command (SPEC 14.13)`,
    JOURNAL_PATH,
  );
  return {
    fileState: "refused",
    journal: new Journal([]),
    entries: [],
    findings: [finding],
    rawBytes: null,
  };
}

/**
 * The current journal's content as one read finds it (SPEC 6.1, 13.4,
 * 14.25) — the one content read every current-journal reader shares:
 * `absent` where nothing occupies the path as reads see it
 * (`journalOccupant`: below an area path holding no directory included),
 * or where the file vanished between classification and read (SPEC 13.5);
 * `occupied` where anything but a plain file occupies it, never read
 * (SPEC 13.4 → 14.13); `refused` where the environment refuses the content
 * read (SPEC 14.25 → 14.13); and `read`, the file's exact bytes. A refused
 * kind read is the read failure of condition 25 (`journalOccupant`), thrown.
 */
export type JournalContent =
  | { readonly state: "absent" }
  | { readonly state: "occupied"; readonly occupant: PathOccupant }
  | { readonly state: "refused"; readonly cause: NodeJS.ErrnoException }
  | { readonly state: "read"; readonly bytes: Uint8Array };

/** Read the current journal's content (`JournalContent`). */
export async function readJournalContent(
  root: string,
): Promise<JournalContent> {
  const occupant = await journalOccupant(root);
  if (occupant === "absent") {
    return { state: "absent" };
  }
  if (occupant !== "file") {
    return { state: "occupied", occupant };
  }
  try {
    return {
      state: "read",
      bytes: await fsp.readFile(journalAbsolutePath(root)),
    };
  } catch (error) {
    if (isAbsenceFailure(error)) return { state: "absent" };
    if (isFilesystemFailure(error)) return { state: "refused", cause: error };
    throw error;
  }
}

/**
 * Load the workspace's journal (SPEC 6.1): an absent file is an empty
 * journal; a plain file is parsed and validated (core); anything else at the
 * path — symbolic link, directory, or other non-plain occupant — is never
 * read and reports a journal error (SPEC 13.4 → 14.13), as does content the
 * environment refuses to read (SPEC 14.25 → 14.13, `refusedJournal`).
 * Classification uses lstat (writes.ts), so a symbolic link is judged
 * itself, never through its target; below an area path holding no
 * directory the journal is absent, so empty (SPEC 13.4, `journalOccupant`).
 */
export async function loadJournal(root: string): Promise<LoadedJournal> {
  const content = await readJournalContent(root);
  switch (content.state) {
    case "absent":
      return journalFromBytes(null);
    case "occupied":
      return occupiedJournal(content.occupant);
    case "refused":
      return refusedJournal(content.cause);
    case "read":
      return journalFromBytes(content.bytes);
  }
}

/**
 * Append one entry to the journal as its canonical line (SPEC 6.1:
 * append-only, one entry per line, byte-deterministic; the file comes into
 * existence with the first journaled operation). The write goes through the
 * workspace write layer (writes.ts): one O_APPEND write of the whole line,
 * atomic in its observable effect (SPEC 13.5) and merging textually with
 * concurrent additions (SPEC 13.4). Callers are `rename` and `move` only,
 * running under workspace exclusivity (SPEC 13.5) and after full workspace
 * validation (SPEC 6.4) — an occupied journal path or an obstructed
 * `.xspec` component has already refused the operation as a finding (14.13,
 * 14.22), and the layer's own guards are the terminal defense, thrown as
 * errors.
 */
export async function appendJournalEntry(
  root: string,
  entry: JournalEntry,
): Promise<void> {
  await appendDurableFile(
    root,
    JOURNAL_PATH,
    serializeJournalEntry(entry) + "\n",
  );
}
