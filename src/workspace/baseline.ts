// Baseline reconstruction from git (SPEC 6.3).
//
// SPEC 6.3: when a command takes a baseline git ref, the baseline graph is
// reconstructed from the workspace content at that ref — sources and
// configuration alike, so group membership reflects the configuration as
// it stood at the ref. The journal content at the ref is the baseline
// journal (absent = empty; an empty journal is a prefix of every journal),
// and baseline hashes are computed with it. The journal entries present in
// the current journal but absent from the journal content at the baseline
// ref are applied, in file order, to map baseline identities to current
// identities — chained mappings compose (core/journal.ts,
// `computeJournalReplay`). If replay produces an ambiguous or unresolvable
// mapping, if the baseline journal is not a prefix of the current journal,
// or if the baseline content cannot be parsed and validated as a
// workspace, resolution fails with an actionable error naming the
// offending entries or files; a baseline that cannot be read or
// reconstructed is a usage error — exit 2 (SPEC 12.0).
//
// `resolveBaseline`, the module's one entry point, is the whole
// resolution, in two stages:
//
// - `readBaseline` — everything up to and including the journal
//   prefix/replay. Its first step judges the current journal (SPEC 6.3: a
//   given baseline's resolution "reads the current journal before any
//   other cause can fail it"): the journal as the caller's analysis of the
//   current workspace loaded it (workspace/journal.ts `loadJournal`), read
//   once — when it carries any condition-13 finding, exactly what `build`
//   would report for it (offending lines, a path holding anything but a
//   plain file, 13.4, or content the environment refuses to deliver,
//   14.25), resolution fails with that condition, before any git
//   invocation: a usage error carrying its stable code `journal-error` and
//   concerned path `.xspec/journal` (SPEC 6.3, 14.13, 12.7), never the
//   gate's finding. Then it locates the workspace in its repository — the
//   innermost whose working tree contains the configuration file (SPEC
//   6.3): git's discovery, confirmed on every `.git` entry git passed by
//   below the top level it reported (./git.ts `refusedDiscovery`), since
//   git walks on past a `.git` it is refused to examine; such a refusal,
//   like every refused read of git data, leaves the baseline unreadable,
//   a plain usage error (`code` and `path` null, 12.7), never a read
//   failure (14.25) and never an answer from an enclosing repository —
//   then resolves the ref, lists the tree at it, reads the configuration
//   and journal blobs, and computes the replay against the loaded current
//   journal's bytes.
// - `validateBaselineContent` — parse and validate the baseline content as
//   a workspace (configuration, sources, and the journal at the ref): a
//   baseline that cannot be parsed and validated is the same usage error
//   (exit 2), its message naming the offending files.
//
// Every failure of either stage is a usage error, exit 2 (SPEC 12.0): the
// current journal's error with its stable code and concerned path, every
// other a plain one. Its place in a command's order (SPEC 6.3, 12.0,
// 13.3, 10.7): a given baseline — `impact --base` (9), `review create
// --base` (10.7) — is resolved whole ahead of the gate of 13.3, its
// content's validation included: these usage errors "are reported, and
// the command exits 2, even when the current workspace also fails the
// validations of `xspec build`" (12.0), and nothing is modified, the
// refresh write never reached. A session's recorded baseline is resolved
// past the gate, where 10.7 orders it (cli/commands/review-session.ts),
// so the current journal carries no condition-13 error there.
//
// IMPLEMENTATION (Key libraries, Architecture): the system `git`
// executable via read-only plumbing subcommands only — `rev-parse`,
// `ls-tree`, `cat-file` (./git.ts), the discovery's confirmation reading
// the filesystem alone and writing nothing — and the same pure core the
// filesystem pipeline composes (classification, parsing, validation,
// hashing), over bytes read from the ref's tree (pipeline.ts
// `analyzeWorkspaceContent`): the baseline analysis and the current
// analysis can never drift apart.

import { Buffer } from "node:buffer";
import { classifySources } from "../core/discovery.js";
import type { Finding } from "../core/findings.js";
import { pathFinding } from "../core/findings.js";
import type { Journal } from "../core/journal.js";
import { renderPathText } from "../core/path-text.js";
import { computeJournalReplay, JOURNAL_PATH } from "../core/journal.js";
import type { LoadedWorkspace } from "./config.js";
import { parseConfigurationBytes } from "./config.js";
import { refusedDiscovery, runGit } from "./git.js";
import type { LoadedJournal } from "./journal.js";
import { journalFromBytes, occupiedJournal } from "./journal.js";
import type { WorkspaceAnalysis } from "./pipeline.js";
import { analyzeWorkspaceContent } from "./pipeline.js";
import type { PathOccupant } from "./writes.js";

/** A successfully reconstructed baseline (SPEC 6.3). */
export interface ResolvedBaseline {
  /** The full hash of the commit the ref resolved to. */
  readonly commit: string;
  /**
   * The baseline workspace's analysis — graph, text model, and hashes
   * computed with the baseline journal (SPEC 6.3). Validated: `findings`
   * and `configurationErrors` are empty.
   */
  readonly analysis: WorkspaceAnalysis;
  /**
   * SPEC 6.3: the journal entries present in the current journal but
   * absent from the journal content at the baseline ref, as a walkable
   * Journal — `mapForward` maps a baseline identity to its current
   * identity, composing chained mappings.
   */
  readonly replay: Journal;
}

/**
 * A failed baseline resolution (SPEC 6.3 → 12.0): a usage error, exit 2,
 * in one of two forms, which callers report through one helper
 * (cli/commands/common.ts `reportBaselineFailure`).
 */
export type BaselineFailure =
  | {
      /**
       * SPEC 6.3 → 12.0: the baseline cannot be read or reconstructed — a
       * plain usage error, its error document's `code` and `path` null
       * (12.7). `message` is the actionable diagnostic naming the
       * offending entries or files; callers report it on standard error
       * and exit 2.
       */
      readonly ok: false;
      readonly kind: "usage";
      readonly message: string;
    }
  | {
      /**
       * SPEC 6.3, 14.13, 12.7: the current journal carries a journal error,
       * which fails a given baseline's resolution before any other cause
       * can — that condition, as the exit-2 error document's one finding:
       * stable code `journal-error`, concerned path `.xspec/journal`, no
       * locations. Callers report it as a coded usage error
       * (cli/report.ts `emitCodedRefusal`) and exit 2.
       */
      readonly ok: false;
      readonly kind: "journal-error";
      readonly finding: Finding;
    };

/** The outcome of baseline resolution (SPEC 6.3). */
export type BaselineResolution =
  { readonly ok: true; readonly baseline: ResolvedBaseline } | BaselineFailure;

/**
 * A read baseline (SPEC 6.3): the ref resolved to a commit, the workspace
 * tree at it listed, and the journal prefix/replay computed — everything
 * of baseline resolution except the content's parse and validation, which
 * `validateBaselineContent` performs on this value next (`resolveBaseline`).
 */
interface BaselineRead {
  /** The full hash of the commit the ref resolved to. */
  readonly commit: string;
  /** SPEC 6.3: the replay Journal (see `ResolvedBaseline.replay`). */
  readonly replay: Journal;
  /** The content-validation continuation's inputs (internal to this
   * module — consumed by `validateBaselineContent` verbatim). */
  readonly content: BaselineContentInputs;
}

/** What `validateBaselineContent` consumes — read once by `readBaseline`
 * so the content stage re-reads nothing but the source blobs. */
interface BaselineContentInputs {
  readonly ref: string;
  readonly root: string;
  readonly configFileName: string;
  /** The configuration blob's bytes at the ref — undefined when no regular
   * file occupies the configuration path there (`configIrregular` says
   * whether a non-regular tree entry does). */
  readonly configBytes: Uint8Array | undefined;
  readonly configIrregular: boolean;
  /** Every regular file at the ref, as raw path bytes. */
  readonly files: readonly Buffer[];
  /** Blob object name per file, keyed by `byteKey` of the path bytes. */
  readonly oidByPath: ReadonlyMap<string, string>;
  /** The journal content at the ref as a loaded journal (absent = empty;
   * a non-plain occupant carries its 14.13 finding, never read). */
  readonly journal: LoadedJournal;
}

/**
 * The outcome of the read half of baseline resolution (SPEC 6.3). A
 * failure — the current journal's error, an unreadable baseline, or a
 * failed journal prefix/replay, each naming the offending entries or
 * files — ends the resolution there, the content never parsed
 * (`resolveBaseline`).
 */
type BaselineReadResolution =
  { readonly ok: true; readonly read: BaselineRead } | BaselineFailure;

/** A plain usage-error failure (`BaselineFailure`, kind `usage`). */
function failure(message: string): BaselineFailure {
  return { ok: false, kind: "usage", message };
}

/**
 * SPEC 6.3, 14.13, 12.7: the failure of a baseline's resolution on a
 * current journal carrying a journal error — `findings` exactly the
 * condition-13 findings `build` reports for that journal (`loadJournal`,
 * workspace/journal.ts: one per offending line, or the one for a non-plain
 * occupant or refused content) — folded into the error document's single
 * finding, one invocation reporting one error (12.7): stable code
 * `journal-error`, concerned path `.xspec/journal`, no locations (a
 * journal condition names its lines, never locating them, 14), and a
 * message naming the baseline ref and carrying every finding's message in
 * the journal's file order, deterministic (12.0).
 */
function journalErrorFailure(
  ref: string,
  findings: readonly Finding[],
): BaselineFailure {
  const messages = findings.map((finding) => finding.message).join("; ");
  return {
    ok: false,
    kind: "journal-error",
    finding: pathFinding(
      13,
      `the baseline at ref '${ref}' cannot be resolved: the current ` +
        `journal carries a journal error, which a given baseline's ` +
        `resolution meets before any other cause (SPEC 6.3) — ${messages}`,
      JOURNAL_PATH,
    ),
  };
}

const LF = 0x0a;
const NUL = 0x00;
const TAB = 0x09;

/** One `git ls-tree -r` record: mode, object name, and raw path bytes. */
interface TreeEntry {
  readonly mode: string;
  readonly oid: string;
  readonly path: Buffer;
}

/**
 * Parse `git ls-tree -r -z` output: NUL-terminated records of
 * `<mode> SP <type> SP <oid> TAB <path>`, the path as raw bytes (`-z`
 * disables quoting).
 */
function parseTreeListing(stdout: Buffer): TreeEntry[] {
  const entries: TreeEntry[] = [];
  let offset = 0;
  while (offset < stdout.length) {
    const terminator = stdout.indexOf(NUL, offset);
    const end = terminator === -1 ? stdout.length : terminator;
    if (end > offset) {
      const record = stdout.subarray(offset, end);
      const tab = record.indexOf(TAB);
      if (tab === -1) {
        throw new Error("xspec internal error: malformed git ls-tree record");
      }
      const header = record.subarray(0, tab).toString("utf8").split(" ");
      if (header.length < 3) {
        throw new Error("xspec internal error: malformed git ls-tree header");
      }
      entries.push({
        mode: header[0],
        oid: header[2],
        path: record.subarray(tab + 1),
      });
    }
    offset = end + 1;
  }
  return entries;
}

/**
 * Read blob objects by name through one `git cat-file --batch` run — a
 * read-only plumbing bulk read. Returns the content bytes per object name,
 * or `null` when any object cannot be read as a blob (repository
 * corruption, a shallow clone missing objects).
 */
async function readBlobs(
  cwd: string,
  oids: readonly string[],
): Promise<Map<string, Uint8Array> | null> {
  const unique = [...new Set(oids)];
  const blobs = new Map<string, Uint8Array>();
  if (unique.length === 0) return blobs;
  const result = await runGit(
    cwd,
    ["cat-file", "--batch"],
    Buffer.from(unique.join("\n") + "\n", "utf8"),
  );
  if (!result.ok) return null;
  // Batch response per requested name: `<oid> SP <type> SP <size> LF`
  // followed by <size> raw content bytes and a closing LF; a missing
  // object answers `<name> SP missing LF` instead.
  const stdout = result.stdout;
  let offset = 0;
  for (const oid of unique) {
    const headerEnd = stdout.indexOf(LF, offset);
    if (headerEnd === -1) return null;
    const header = stdout.subarray(offset, headerEnd).toString("utf8");
    const parts = header.split(" ");
    if (parts.length !== 3 || parts[1] !== "blob") return null;
    const size = Number(parts[2]);
    if (!Number.isSafeInteger(size) || size < 0) return null;
    const start = headerEnd + 1;
    if (start + size > stdout.length) return null;
    blobs.set(oid, stdout.subarray(start, start + size));
    offset = start + size + 1; // past the content's closing LF
  }
  return blobs;
}

/** An injective per-byte string key for raw path bytes (never rendered). */
function byteKey(bytes: Buffer): string {
  return bytes.toString("latin1");
}

function bufferStartsWith(bytes: Buffer, prefix: Buffer): boolean {
  return (
    bytes.length >= prefix.length &&
    bytes.subarray(0, prefix.length).equals(prefix)
  );
}

/**
 * SPEC 6.3: "cannot be parsed and validated as a workspace" — the baseline
 * content's findings rendered into one actionable usage-error message
 * naming the offending files (SPEC 12.0: standard-error content, so the
 * rendering is local to this diagnostic, not the report renderer's).
 */
function invalidBaselineMessage(
  ref: string,
  findings: readonly Finding[],
): string {
  const lines = findings.map((finding) => {
    const concerned = finding.locations[0]?.file ?? finding.path;
    const file = concerned === null ? "" : `${renderPathText(concerned)}: `;
    return `\n  ${file}${finding.message}`;
  });
  return (
    `the workspace content at baseline ref '${ref}' cannot be parsed and ` +
    `validated as a workspace (SPEC 6.3, 12.0):${lines.join("")}`
  );
}

/** The blob-read failure message (repository corruption, shallow clone). */
function unreadableMessage(ref: string): string {
  return (
    `the workspace content at baseline ref '${ref}' cannot be read from ` +
    `the repository — git object reads failed; the repository may be ` +
    `corrupt or a shallow clone missing the ref's objects (SPEC 6.3)`
  );
}

/**
 * The read half of baseline resolution (SPEC 6.3): judge the current
 * journal first, then discover the repository — the innermost whose
 * working tree contains the configuration file, a refused read of its
 * discovery leaving the baseline unreadable — resolve the ref to a commit,
 * list the workspace tree at it, read the configuration and journal blobs,
 * and compute the journal prefix/replay against the current journal.
 * `currentJournal` is the current journal as the caller's analysis of the
 * current workspace loaded it (`WorkspaceAnalysis.journal`), so the
 * journal is read once: its findings are what `build` reports for it, and
 * its bytes the replay's current side. Reads the repository through
 * read-only git plumbing, and the `.git` entries git's discovery passed by
 * through the filesystem; modifies nothing, and parses no baseline source
 * content — `validateBaselineContent` does, next (`resolveBaseline`).
 * Each failure is a usage error (exit 2, SPEC 12.0): the current journal's
 * error with its stable code and concerned path, every other a plain one
 * with `message` as the standard-error diagnostic.
 */
async function readBaseline(
  workspace: LoadedWorkspace,
  ref: string,
  currentJournal: LoadedJournal,
): Promise<BaselineReadResolution> {
  const { root, configFileName } = workspace;

  // --- the current journal, before any other cause (SPEC 6.3, 12.0) -----
  // SPEC 6.3: a given baseline's resolution "reads the current journal
  // before any other cause can fail it, and a journal error (14.13) there,
  // whatever its form — offending entries, a path holding anything but a
  // plain file (13.4), or content the environment refuses to deliver
  // (14.25) — fails it as this usage error, never as the gate's finding:
  // the error reported is that condition, with its stable code and
  // concerned path (14.13, 12.7)". No git invocation precedes this.
  if (currentJournal.findings.length > 0) {
    return journalErrorFailure(ref, currentJournal.findings);
  }

  // --- locate the workspace within its repository -----------------------
  const prefixResult = await runGit(root, ["rev-parse", "--show-prefix"]);
  if (!prefixResult.ok) {
    if (prefixResult.kind === "unavailable") {
      return failure(
        `cannot reconstruct the baseline at ref '${ref}': the 'git' ` +
          `executable was not found — the baseline is the workspace ` +
          `content at the ref, read through git (SPEC 6.3); install git ` +
          `and re-run`,
      );
    }
    return failure(
      `cannot reconstruct the baseline at ref '${ref}': the workspace ` +
        `root is not inside a git work tree — the baseline is the ` +
        `workspace content at the ref, read from the repository ` +
        `containing the workspace (SPEC 6.3)`,
    );
  }
  const prefix = prefixResult.stdout
    .toString("utf8")
    .replace(/\n$/, "")
    .replace(/\/$/, "");

  // --- confirm the discovery: the innermost repository (SPEC 6.3) -------
  // SPEC 6.3: the repository is the innermost whose working tree contains
  // the configuration file, and its discovery is git data: a read of it the
  // environment refuses leaves the baseline unreadable — this plain usage
  // error, never a read failure (14.25), never an answer from an enclosing
  // repository git reached by passing that `.git` by. The directories git
  // walked through below its top level number the prefix's segments.
  const refusal = await refusedDiscovery(
    root,
    prefix === "" ? 0 : prefix.split("/").length,
  );
  if (refusal !== undefined) {
    return failure(
      `cannot reconstruct the baseline at ref '${ref}': the environment ` +
        `refused a read of '${refusal.path}' (${refusal.code}; the path is ` +
        `relative to the workspace root) while discovering the repository ` +
        `whose working tree contains the configuration file — that ` +
        `innermost repository, never an enclosing one, holds the baseline, ` +
        `so the baseline is unreadable (SPEC 6.3); restore read and search ` +
        `permission on that path and the directories leading to it, then ` +
        `re-run`,
    );
  }

  // --- resolve the ref to a commit (SPEC 6.3, 12.0) ---------------------
  const commitResult = await runGit(root, [
    "rev-parse",
    "--verify",
    "--quiet",
    "--end-of-options",
    `${ref}^{commit}`,
  ]);
  if (!commitResult.ok) {
    return failure(
      `the baseline ref '${ref}' does not resolve to a commit in the ` +
        `repository containing the workspace — pass a git ref naming a ` +
        `commit (a branch, tag, or commit hash) whose workspace content ` +
        `should serve as the baseline (SPEC 6.3, 12.0)`,
    );
  }
  const commit = commitResult.stdout.toString("utf8").trim();

  // --- the workspace directory's tree at that commit --------------------
  const treeResult = await runGit(root, [
    "rev-parse",
    "--verify",
    "--quiet",
    "--end-of-options",
    prefix === "" ? `${commit}^{tree}` : `${commit}:${prefix}`,
  ]);
  if (!treeResult.ok) {
    return failure(
      `the workspace directory '${prefix}' does not exist at baseline ` +
        `ref '${ref}' — the baseline is reconstructed from the workspace ` +
        `content at the ref (SPEC 6.3)`,
    );
  }
  const tree = treeResult.stdout.toString("utf8").trim();
  // `--full-tree` keeps the listing complete regardless of the working
  // directory git infers a pathspec prefix from.
  const listing = await runGit(root, [
    "ls-tree",
    "-r",
    "-z",
    "--full-tree",
    tree,
  ]);
  if (!listing.ok) {
    return failure(
      `the workspace content at baseline ref '${ref}' cannot be listed — ` +
        `'${prefix === "" ? "." : prefix}' is not a directory at that ref ` +
        `(SPEC 6.3)`,
    );
  }

  // --- classify the ref's tree entries ----------------------------------
  const entries = parseTreeListing(listing.stdout);
  const configPathBytes = Buffer.from(configFileName, "utf8");
  const journalPathBytes = Buffer.from(JOURNAL_PATH, "utf8");
  const journalDirBytes = Buffer.from(JOURNAL_PATH + "/", "utf8");
  const files: Buffer[] = [];
  const oidByPath = new Map<string, string>();
  let configOid: string | undefined;
  let configIrregular = false;
  let journalOid: string | undefined;
  let journalOccupant: PathOccupant | undefined;
  for (const entry of entries) {
    // SPEC 7: discovery never follows symbolic links — a symlink entry
    // (mode 120000), like a submodule (160000), is never a source; only
    // regular blobs (100644/100755) are candidate files.
    const regular = entry.mode === "100644" || entry.mode === "100755";
    if (entry.path.equals(configPathBytes)) {
      if (regular) configOid = entry.oid;
      else configIrregular = true;
    }
    if (entry.path.equals(journalPathBytes)) {
      // SPEC 6.1/13.4 → 14.13: a journal path occupied by anything other
      // than a plain file is never read.
      if (regular) journalOid = entry.oid;
      else journalOccupant = entry.mode === "120000" ? "symlink" : "other";
    } else if (bufferStartsWith(entry.path, journalDirBytes)) {
      journalOccupant = "directory";
    }
    if (regular) {
      files.push(entry.path);
      oidByPath.set(byteKey(entry.path), entry.oid);
    }
  }

  // A missing or irregular configuration at the ref is a fact about the
  // baseline content's validity as a workspace, not about reading the ref
  // — `validateBaselineContent` reports it (module header).

  const primer = await readBlobs(root, [
    ...(configOid === undefined ? [] : [configOid]),
    ...(journalOid === undefined ? [] : [journalOid]),
  ]);
  if (primer === null) return failure(unreadableMessage(ref));
  const configBytes =
    configOid === undefined ? undefined : primer.get(configOid);
  if (configOid !== undefined && configBytes === undefined) {
    return failure(unreadableMessage(ref));
  }

  // SPEC 6.3: the journal content at the ref; absent = empty journal.
  const baselineJournalBytes =
    journalOid === undefined ? null : (primer.get(journalOid) ?? null);
  if (journalOid !== undefined && baselineJournalBytes === null) {
    return failure(unreadableMessage(ref));
  }
  const journal =
    journalOccupant !== undefined
      ? occupiedJournal(journalOccupant)
      : journalFromBytes(baselineJournalBytes);

  // --- replay: current journal entries absent at the ref (SPEC 6.3) -----
  // Against the current journal's bytes as loaded and judged above — free
  // of condition-13 errors, so a plain file read whole or an absent one:
  // SPEC 6.3, a journal file absent in the current workspace is read as an
  // empty journal, and so is one below an area path holding no directory,
  // where nothing is read (SPEC 13.4).
  const replay = computeJournalReplay(
    baselineJournalBytes ?? new Uint8Array(0),
    currentJournal.rawBytes ?? new Uint8Array(0),
  );
  if (!replay.ok) {
    return failure(
      `cannot map baseline identities at ref '${ref}' to current ` +
        `identities: ${replay.problem}`,
    );
  }

  return {
    ok: true,
    read: {
      commit,
      replay: replay.replay,
      content: {
        ref,
        root,
        configFileName,
        configBytes,
        configIrregular,
        files,
        oidByPath,
        journal,
      },
    },
  };
}

/**
 * The validation half of baseline resolution (SPEC 6.3): parse and
 * validate the read baseline's content as a workspace — configuration,
 * sources, and journal findings, through the same pure core the current
 * workspace's pipeline composes. A baseline that cannot be parsed and
 * validated is a plain usage error (exit 2, SPEC 12.0) naming the
 * offending files — for a given baseline, met ahead of the SPEC 13.3 gate
 * whatever the current workspace's validity (module header). Reads git
 * blobs alone; modifies nothing.
 */
async function validateBaselineContent(
  read: BaselineRead,
): Promise<BaselineResolution> {
  const {
    ref,
    root,
    configFileName,
    configBytes,
    configIrregular,
    files,
    oidByPath,
    journal,
  } = read.content;

  if (configBytes === undefined) {
    return failure(
      configIrregular
        ? `the configuration file '${configFileName}' is not a regular ` +
            `file in the workspace content at baseline ref '${ref}' ` +
            `(SPEC 6.3, 7)`
        : `the configuration file '${configFileName}' does not exist in ` +
            `the workspace content at baseline ref '${ref}' — the ` +
            `baseline graph is reconstructed with the configuration as ` +
            `it stood at the ref (SPEC 6.3, 7)`,
    );
  }

  // SPEC 6.3: the baseline configuration is the configuration content at
  // the ref — group membership reflects it, not the current configuration.
  const configParse = parseConfigurationBytes(configBytes, configFileName);
  if (!configParse.ok) {
    return failure(invalidBaselineMessage(ref, configParse.findings));
  }
  const classification = classifySources(files, configParse.configuration);

  // --- analyze the baseline workspace (the shared pipeline body) --------
  const sourcePaths = [
    ...classification.specSources,
    ...classification.codeSources,
  ].map((source) => source.path);
  const oidForSource = new Map<string, string>();
  for (const sourcePath of sourcePaths) {
    const oid = oidByPath.get(byteKey(Buffer.from(sourcePath, "utf8")));
    if (oid === undefined) {
      // Impossible: classified sources come from the same listing.
      throw new Error(
        `xspec internal error: baseline source without a blob: ${sourcePath}`,
      );
    }
    oidForSource.set(sourcePath, oid);
  }
  // SPEC 14.19/11.2: invalid-path sources at the ref are analyzed too —
  // their findings make the baseline fail resolution like any others —
  // addressed by their exact path bytes.
  const oidForInvalidSource = new Map<string, string>();
  for (const source of classification.invalidSources) {
    const oid = oidByPath.get(byteKey(Buffer.from(source.bytes)));
    if (oid === undefined) {
      // Impossible: classified sources come from the same listing.
      throw new Error(
        "xspec internal error: baseline invalid-path source without a blob",
      );
    }
    oidForInvalidSource.set(byteKey(Buffer.from(source.bytes)), oid);
  }
  const sourceBlobs = await readBlobs(root, [
    ...oidForSource.values(),
    ...oidForInvalidSource.values(),
  ]);
  if (sourceBlobs === null) return failure(unreadableMessage(ref));

  const analysis = await analyzeWorkspaceContent(configParse.configuration, {
    classification,
    readSource: (rel) => {
      const oid = oidForSource.get(rel);
      const bytes = oid === undefined ? undefined : sourceBlobs.get(oid);
      if (bytes === undefined) {
        throw new Error(
          `xspec internal error: baseline blob not preloaded: ${rel}`,
        );
      }
      return Promise.resolve(bytes);
    },
    readInvalidSource: (pathBytes) => {
      const oid = oidForInvalidSource.get(byteKey(Buffer.from(pathBytes)));
      const bytes = oid === undefined ? undefined : sourceBlobs.get(oid);
      if (bytes === undefined) {
        throw new Error(
          "xspec internal error: baseline invalid-path blob not preloaded",
        );
      }
      return Promise.resolve(bytes);
    },
    loadJournal: () => Promise.resolve(journal),
  });
  // SPEC 6.3: baseline content that cannot be parsed and validated as a
  // workspace fails resolution — configuration errors (14.14 class) and
  // validation findings alike are usage errors here (SPEC 12.0).
  if (analysis.configurationErrors.length > 0) {
    return failure(invalidBaselineMessage(ref, analysis.configurationErrors));
  }
  if (analysis.findings.length > 0) {
    return failure(invalidBaselineMessage(ref, analysis.findings));
  }

  return {
    ok: true,
    baseline: { commit: read.commit, analysis, replay: read.replay },
  };
}

/**
 * Resolve a baseline git ref whole (SPEC 6.3): `readBaseline` — the
 * current journal first, then git — composed with
 * `validateBaselineContent`, over the current journal as the caller's
 * analysis of the current workspace loaded it (`WorkspaceAnalysis.journal`,
 * read once). Every failure is a usage error (exit 2, SPEC 12.0), reported
 * through cli/commands/common.ts `reportBaselineFailure`; nothing is
 * modified. A given baseline (`impact --base`, `review create --base`) is
 * resolved here before the SPEC 13.3 gate judges the current workspace,
 * so its failures — baseline content that cannot be parsed and validated
 * among them — exit 2 even when the current workspace also fails
 * `build`'s validations (SPEC 6.3, 12.0); a session's recorded baseline is
 * resolved past the gate (review-session.ts, SPEC 10.7), where the current
 * journal carries no condition-13 error and every failure is a plain usage
 * error (module header).
 */
export async function resolveBaseline(
  workspace: LoadedWorkspace,
  ref: string,
  currentJournal: LoadedJournal,
): Promise<BaselineResolution> {
  const read = await readBaseline(workspace, ref, currentJournal);
  if (!read.ok) {
    return read;
  }
  return validateBaselineContent(read.read);
}
