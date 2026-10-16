// CERTIFICATIONS.md fixture products: the fixture manifest (TEST-SPEC 17
// C-1, C-2). Each fixture is a harness-owned executable under test/fixtures/,
// driven by the certification runner through the identical ProductBinding
// shape as the built product — an executable/workspace binding and nothing
// else (C-2), so certifying and testing use one code path and fixtures are
// invocable in CI without network or a build step (plain Node ESM programs).
//
// CERTIFICATION_FIXTURES lists every CERTIFICATIONS.md fixture in document
// order: each conformer with its in-scope test IDs and each violator with the
// IDs it certifies, verbatim from the document. The whole-document C-1 gate
// (certification-document.test.ts) asserts this manifest equals the parsed
// document, and every per-fixture verification (certification.test.ts) is
// generated from it — so a fixture entering the document without wiring here,
// or wired here without being exercised, fails loudly instead of letting
// certification pass while silently covering less.

import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { ProductBinding } from "../helpers/subprocess.js";

const fixturesRoot = path.resolve(
  fileURLToPath(new URL("../fixtures", import.meta.url)),
);

/** Binding for a plain-Node fixture executable under test/fixtures/. */
function nodeFixtureBinding(label: string, relBin: string): ProductBinding {
  const bin = path.join(fixturesRoot, relBin);
  return {
    label,
    command: process.execPath,
    prefixArgs: [bin],
    requiredFiles: [bin],
  };
}

/**
 * One CERTIFICATIONS.md violator: its conformer plus exactly one specified
 * behavioral deviation.
 */
export interface CertificationViolator {
  /** The document's `### VIOL-…` heading name. */
  readonly name: string;
  /** Fresh C-2 binding for the violator's executable. */
  readonly binding: () => ProductBinding;
  /** The tests the violator certifies, verbatim from CERTIFICATIONS.md. */
  readonly certifies: readonly string[];
}

/** One CERTIFICATIONS.md conformer entry with its violators. */
export interface CertificationConformer {
  /** The document's `## CONF-…` heading name. */
  readonly name: string;
  /** Fresh C-2 binding for the conformer's executable. */
  readonly binding: () => ProductBinding;
  /** The entry's in-scope tests, verbatim from CERTIFICATIONS.md. */
  readonly inScope: readonly string[];
  /** The conformer's violators, in document order. */
  readonly violators: readonly CertificationViolator[];
}

function conformer(
  name: string,
  relBin: string,
  inScope: readonly string[],
  violators: readonly CertificationViolator[],
): CertificationConformer {
  return {
    name,
    binding: () => nodeFixtureBinding(`${name} conformer`, relBin),
    inScope,
    violators,
  };
}

function violator(
  name: string,
  relBin: string,
  certifies: readonly string[],
): CertificationViolator {
  return {
    name,
    binding: () => nodeFixtureBinding(`${name} violator`, relBin),
    certifies,
  };
}

/**
 * Every CERTIFICATIONS.md fixture, in document order (C-1: "for each fixture
 * in specs/CERTIFICATIONS.md"). Deviation summaries are inlined per violator;
 * the document's entries are authoritative.
 */
export const CERTIFICATION_FIXTURES: readonly CertificationConformer[] = [
  // CONF-CORE (§CONF-CORE): operational core — exclusion seam, journal,
  // durable files, review reads.
  conformer(
    "CONF-CORE",
    "conf-core/bin.mjs",
    [
      "T6.1-2",
      "T10.4-5",
      "T13.5-1",
      "T13.5-2",
      "T13.5-3",
      "T13.5-4",
      "T13.5-5",
      "T13.5-8",
    ],
    [
      // VIOL-CORE-NOLOCK: a live run's entry does not refuse acquisition —
      // acquisition adds its own entry and lists the lock directory as SPEC
      // 13.5 directs, but leaves every entry recording an identifier its
      // process list lists in place, unaltered, removes the other leftovers,
      // and acquires, so mutating commands never exclude one another (the
      // busy refusal of 14.26 dropped); entries, the hold file (still
      // created before any modification and honored), leftover removal,
      // acquisition's write and read failures, and release are unchanged.
      violator("VIOL-CORE-NOLOCK", "conf-core/bin-nolock.mjs", [
        "T13.5-2",
        "T13.5-8",
      ]),
      // VIOL-CORE-EARLYWRITE: a mutating command given `--test-hold`
      // performs its workspace modifications before creating the hold file —
      // it acquires exclusivity, completes the operation's writes (journal
      // append included), then creates the hold file (creation failing on an
      // occupied path as 13.5 states, the exit-2 refusal then following the
      // completed writes), waits for its deletion, and exits normally,
      // releasing as it ends; without `--test-hold` it creates no hold file
      // and behaves as the conformer does. The second discovery, the
      // argument checks of 12.0, baseline resolution (6.3), the gate of 13.3,
      // and the valid-workspace precondition of rename/move (6.4, 6.5) are
      // judged after acquisition and before the writes they gate, while the
      // exit they refuse with is deferred as the writes' completion is: an
      // invocation they refuse creates the hold file having written nothing,
      // waits for its deletion, and only then exits with its error. Fails
      // T13.5-1 (the held-state comparison while held, and its
      // occupied-hold-path arms, the writes landing before hold creation
      // fails), T13.5-2 (the held-state comparison while command 1 holds),
      // T13.5-4 (reads during the hold observe the operation's result), and
      // T13.5-8 (wherever its arms run beside the held `review resolve` on a
      // valid workspace, that holder's resolution, written before its hold,
      // fails the held-state comparison made while it holds).
      violator("VIOL-CORE-EARLYWRITE", "conf-core/bin-earlywrite.mjs", [
        "T13.5-1",
        "T13.5-2",
        "T13.5-4",
        "T13.5-8",
      ]),
      // VIOL-CORE-EARLYREFRESH: the 13.3 refresh a mutating `review`
      // subcommand performs on a stale workspace runs before workspace
      // exclusivity is acquired, so stale graph data is rewritten before the
      // hold file is created — one ordering rule of 13.5 (the hold precedes
      // every modification, the refresh included) broken for the refresh
      // alone; the hold file is still created after exclusivity and before
      // every other write (the session write, rename/move's edits, journal
      // appends, and the finishing regeneration of 6.4/6.5), and a workspace
      // whose graph data is current is refreshed by nothing, as one failing
      // `build`'s validations is (13.3) — the deviation unobservable on
      // both. Fails T13.5-1 on its stale-workspace arm's while-held
      // comparison alone.
      violator("VIOL-CORE-EARLYREFRESH", "conf-core/bin-earlyrefresh.mjs", [
        "T13.5-1",
      ]),
      // VIOL-CORE-STALELOCK: abnormal termination does not end exclusivity —
      // an entry whose run has terminated refuses acquisition as a live
      // run's entry does (14.26), its presence alone judged, whatever
      // identifier its name records, so once a mutating command's process
      // is killed every later mutating command in that workspace is refused
      // `workspace-busy` while the dead run's entry stands — 13.5's liveness
      // judgment dropped. Release on every normal end, and the removal of
      // every leftover that is no entry, are unchanged.
      violator("VIOL-CORE-STALELOCK", "conf-core/bin-stalelock.mjs", [
        "T13.5-3",
      ]),
      // VIOL-CORE-PARTIALWRITE: derived-file writes are not atomic in their
      // observable effect — while a derived file is being written, its path
      // holds a strict prefix of the new content for a sustained interval
      // (long relative to a concurrent reader's polling cadence, short of
      // S-3's hang detection) before the complete content appears; every
      // `build` performs its derived-file writes through this interval,
      // content already byte-identical on disk rewritten, never skipped, so
      // each build of T13.5-5's polling loop exposes the partial state, on
      // an unchanged workspace too. Durable files are unaffected.
      violator("VIOL-CORE-PARTIALWRITE", "conf-core/bin-partialwrite.mjs", [
        "T13.5-5",
      ]),
      // VIOL-CORE-CHATTYREADS: `check` modifies the journal — each `check`
      // invocation that is not refused as a usage or configuration error
      // (exit 2) appends one fixed line to `.xspec/journal`, creating the
      // file when absent. The line is inert to the fixture's own journal
      // handling — read back as neither an identity mapping (5.4) nor a
      // malformed entry (no 14.13, so no later command is gated by it),
      // graph data and every other derived byte independent of how many
      // such lines the journal holds (13.4) — 6.1's rule that the journal
      // is written by `rename` and `move` alone broken for `check`;
      // `build`, every other read command, mutating commands, and the
      // entries `rename`/`move` append are unchanged. Fails T13.5-4 alone,
      // on one ground: the held-state comparison made once its reads during
      // the hold, `check` among them, have exited, the journal grown — at
      // its first read during the hold (`check`); its `build` arm and its
      // storm, on whose workspaces and twins no `check` runs, meet no
      // appended line.
      violator("VIOL-CORE-CHATTYREADS", "conf-core/bin-chattyreads.mjs", [
        "T13.5-4",
      ]),
      // VIOL-CORE-PERSISTREADS: review reads persist read-time invalidation —
      // when `status`, `next`, `show`, or `export` computes that a resolved
      // item's recorded state differs from the current graph (SPEC 10.4), it
      // rewrites that item's stored status to `invalidated` in the session
      // file. Reads over sessions with no stale resolution write nothing.
      // Fails T10.4-5 alone, at its first read's session-file byte-compare
      // (`review status`), the one ground: once a read has computed
      // invalidation, T10.4-5 runs no `review list` and never undoes the
      // staleness while that resolution stands (the entry's staging
      // constraint), so a compare made before the reads ran passes it.
      violator("VIOL-CORE-PERSISTREADS", "conf-core/bin-persistreads.mjs", [
        "T10.4-5",
      ]),
      // VIOL-CORE-LATEHOLD: the hold seam engages late — a mutating command
      // acquires exclusivity where 13.5 places it (once configuration is
      // loaded and sources discovered, before every later check) but creates
      // its hold file only once the unknown and wrong-kind names and files
      // of the usage class and baseline resolution (12.0, 6.3) have passed,
      // its second discovery preceding them, instead of immediately after
      // acquiring; the gate and refresh of 13.3, the item check, the
      // valid-workspace precondition of rename/move (6.4, 6.5), the
      // operation's own validation, and every modification still follow the
      // hold, acquisition's outcomes — the busy refusal and its write and
      // read failures — still precede every check, and the hold file still
      // precedes every write. An invocation those checks refuse exits 2
      // having acquired and released but created no hold file, `--test-hold`
      // or not — T13.5-8's four seam-ordering arms (`rename specs/A.mdx nope
      // x`, `review create --base <ref> --name n`, `review create
      // --coverage nope --name n`, `move <code> specs/C.mdx` under
      // `--test-hold`), where the wait for a hold file never created fails
      // loud — while every other arm meets acquisition, or the error
      // preceding it, exactly as the conformer's does.
      violator("VIOL-CORE-LATEHOLD", "conf-core/bin-latehold.mjs", ["T13.5-8"]),
      // VIOL-CORE-EARLYRELEASE: a run releases at its hold point instead of
      // as it ends — a mutating command given `--test-hold` releases once its
      // hold is lifted (its entry, then the emptied lock directory and an
      // emptied area directory its acquisition created), one without the
      // seam straight after acquiring — then dwells for a sustained interval
      // (long relative to the time the rest of the run otherwise takes,
      // short of S-3's hang detection) and proceeds with the rest of the
      // command as the conformer does, outside exclusivity, releasing
      // nothing further; acquisition, the hold file, every check,
      // every write and its order, and every run's outcome are unchanged.
      // Fails T13.5-3 on its past-the-hold arm alone: kills landing in the
      // interval find every path the twin's run changes still in its prior
      // state and `.xspec/lock` absent.
      violator("VIOL-CORE-EARLYRELEASE", "conf-core/bin-earlyrelease.mjs", [
        "T13.5-3",
      ]),
      // VIOL-CORE-HOLDLINK: hold-file creation follows a symbolic link at
      // the hold path — the path's occupancy judged through the link, so a
      // dangling link reads as nothing there and the empty hold file is
      // created at the link's target (a write through the link), the run
      // proceeding only once the hold path, judged through the link, holds
      // nothing; a link to an existing file or directory reads as occupied,
      // so creation fails there with the seam's usage error as the
      // conformer's does, and a path holding no link is judged alike on both
      // sides. The creation through the link — a write that traverses a
      // symbolic link (13.4) — is that single deviation itself, not a
      // second. Fails T13.5-1 on its dangling-link arm alone, through the
      // arm's hang detection (S-3).
      violator("VIOL-CORE-HOLDLINK", "conf-core/bin-holdlink.mjs", ["T13.5-1"]),
      // VIOL-CORE-READERENTRY: while a directory — never a symbolic link to
      // one — occupies the lock path, `build` and the read commands each add
      // to it an entry of their own (a plain file named as a mutating run's
      // entry is, recording the reader's process identifier) and leave it
      // there as they end, a dead run's leftover once the reader has exited;
      // where no directory occupies the lock path, they add nothing. One
      // rule of 13.4 (no write but acquisition and release touches the lock
      // path) broken for `build` and the reads: they acquire nothing — list
      // no lock directory, judge no entry, are refused by none — and a
      // mutating command's acquisition removes a reader's entry as any dead
      // run's, though one meeting a reader still running refuses on its
      // entry as on any live run's. Fails T13.5-4: once each
      // read, and the `build`, run during a hold has exited, the lock
      // directory holds its entry beside the holder's, where the held-state
      // comparison's count half asserts the holder's entry alone (at the
      // first read during the hold, before the `build` arm).
      violator("VIOL-CORE-READERENTRY", "conf-core/bin-readerentry.mjs", [
        "T13.5-4",
      ]),
      // VIOL-CORE-BUILDWAIT: `build` waits out other runs' exclusivity —
      // once its configuration is loaded and its sources discovered, while
      // a directory occupies the lock path, it lists it and, while that
      // holds another live run's entry (judged as acquisition judges one),
      // polls, proceeding as the conformer does once none stands; anything
      // else at the lock path, nothing there, or a refused listing never
      // holds it back. It adds no entry, removes nothing, writes nothing at
      // the lock path (13.4), and is refused by nothing, and once it
      // proceeds its outputs, writes, and exit are the conformer's; the read
      // commands are unchanged. Fails T13.5-4: the
      // `build` it runs during a `rename`'s hold never exits while the hold
      // stands, so the arm — awaiting that exit before it lifts the hold —
      // fails by its hang detection (S-3); its reads arm passes.
      violator("VIOL-CORE-BUILDWAIT", "conf-core/bin-buildwait.mjs", [
        "T13.5-4",
      ]),
    ],
  ),
  // CONF-RACE (§CONF-RACE): overlapping acquisitions — CONF-CORE's
  // workspaces, behavior, and command surface as T13.5-13 drives them, run
  // from an executable of its own (conf-race/bin.mjs runs the CONF-CORE
  // product deviation-free): its unheld arm has no deterministic outcome
  // under VIOL-CORE-EARLYRELEASE, so T13.5-13 could not join CONF-CORE's
  // in-scope set.
  conformer(
    "CONF-RACE",
    "conf-race/bin.mjs",
    ["T13.5-13"],
    [
      // VIOL-RACE-LISTFIRST: acquisition judges the lock directory before
      // adding its entry — it lists the lock directory (a missing area or
      // lock directory holding nothing), is refused by another live run's
      // entry there (14.26) as the conformer is, and otherwise, after a
      // sustained interval (long against the spread of runs started
      // together, far short of every hang guard), adds its entry, removes
      // the leftovers its listing found, and acquires, never listing again —
      // 13.5's order of addition and listing inverted; the liveness
      // judgment, leftover removal, the hold seam, and release unchanged. Fails
      // T13.5-13's held arm on every trial: runs started together each list
      // within the others' intervals, so each acquires and more than one
      // hold file stands where the arm asserts at most one.
      violator("VIOL-RACE-LISTFIRST", "conf-race/bin-listfirst.mjs", [
        "T13.5-13",
      ]),
    ],
  ),
  // CONF-READERS (§CONF-READERS): readers at a mutating command's
  // acquisition — CONF-CORE's workspaces, behavior, and command surface as
  // P-10 drives them, run from an executable of its own
  // (conf-readers/bin.mjs runs the CONF-CORE product deviation-free): P-10's
  // kills past the hold have no deterministic outcome under
  // VIOL-CORE-EARLYRELEASE, so P-10 could not join CONF-CORE's in-scope set.
  conformer(
    "CONF-READERS",
    "conf-readers/bin.mjs",
    ["P-10"],
    [
      // VIOL-READERS-CLAIM: `build` and the read commands each hold a claim
      // while they run — having located the configuration file, each adds an
      // entry of its own to the lock directory (a plain file named as a
      // mutating run's entry is, recording the reader's process identifier)
      // where the area's path and the lock path each hold a directory or
      // nothing, the area's directory and the lock directory brought into
      // existence where absent, and nothing where either holds anything
      // else; dwells for a sustained interval (3000 ms, long against a later
      // command's start-up, short of S-3's hang detection); proceeds as the
      // conformer does; and as it ends deletes its entry, then the emptied
      // lock directory and an emptied area directory it brought into
      // existence, as release does. Acquisition judges a reader's entry as
      // any run's: a live reader's refuses it (14.26). Readers still list no
      // lock directory, judge no entry, remove no leftover, and are refused
      // by none, their answers, other writes, and exits the conformer's.
      // Fails P-10 on every run: a command started while a claiming
      // reader runs is refused `workspace-busy` where P-10 asserts it never
      // refused (and a lock path inspected after a kill holds the reader's
      // entry beside the dead run's).
      violator("VIOL-READERS-CLAIM", "conf-readers/bin-claim.mjs", ["P-10"]),
    ],
  ),
  // CONF-LEFTOVER (§CONF-LEFTOVER): acquisition's removal of leftover trees —
  // CONF-CORE's workspaces, behavior, and mutating surface as P-15 drives
  // them, without the seam, run from an executable of its own
  // (conf-leftover/bin.mjs runs the CONF-CORE product deviation-free): P-15's
  // runs must complete promptly, and VIOL-CORE-EARLYRELEASE's unheld runs sit
  // through its sustained interval, so P-15 could not join CONF-CORE's
  // in-scope set.
  conformer(
    "CONF-LEFTOVER",
    "conf-leftover/bin.mjs",
    ["P-15"],
    [
      // VIOL-LEFTOVER-FOLLOWLINK: acquisition's removal of a leftover
      // symbolic link to a directory, at any depth, follows the link — it
      // removes everything the targeted directory holds, recursing through
      // the link at every depth, then the link itself, the target left in
      // place, empty; a link to a file and a dangling link are removed
      // themselves, every other leftover as the conformer removes it, and
      // the deletion through the link (a write that traverses a link, 13.4)
      // is that single deviation itself. Fails P-15 on each draw holding a
      // link to a directory
      // outside the workspace: the target's content deleted, the command
      // still exiting 0 with its twin's result and `.xspec/lock` absent.
      violator("VIOL-LEFTOVER-FOLLOWLINK", "conf-leftover/bin-followlink.mjs", [
        "P-15",
      ]),
      // VIOL-LEFTOVER-DOTNAMES: acquisition's listings — of the lock
      // directory and of each directory it removes — hide names beginning
      // with `.`, so a leftover so named, at any depth, is never removed;
      // links, FIFOs, unreadable files, depth, and a write the environment
      // refuses are handled as the conformer handles them. Fails P-15 on
      // each draw holding one: `.xspec/lock` stands once the command ends
      // (its release unable to delete the lock directory while it holds the
      // leftover); where the name lies in a directory acquisition lists to
      // remove, the directory's removal is refused besides —
      // `write-failure` at `.xspec/lock`, exit 2.
      violator("VIOL-LEFTOVER-DOTNAMES", "conf-leftover/bin-dotnames.mjs", [
        "P-15",
      ]),
      // VIOL-LEFTOVER-BYTENAMES: acquisition's listings decode names as
      // UTF-8 text (U+FFFD for each ill-formed sequence) and its removals
      // address each leftover by its decoded name, so a leftover whose name
      // is not valid UTF-8, at any depth, is addressed by a name that
      // designates nothing — the removal finding nothing there taken for
      // done, as the conformer takes one (14.24) — and stays; every other
      // name is handled as the conformer handles it. Fails P-15 on each draw
      // holding one, as DOTNAMES fails it on names beginning with `.`.
      violator("VIOL-LEFTOVER-BYTENAMES", "conf-leftover/bin-bytenames.mjs", [
        "P-15",
      ]),
    ],
  ),
  // CONF-VALID (§CONF-VALID): segment and tag validity — `build` with the
  // 14.1–14.4 error reporting and `query node`/`query nodes` reporting
  // identity, tags, and metadataHash, over `.mdx` workspaces whose sections
  // carry `id`/`tags` props.
  conformer(
    "CONF-VALID",
    "conf-valid/bin.mjs",
    [
      "T1.3-1",
      "T1.3-2",
      "T1.3-3",
      "T1.3-4",
      "T1.3-5",
      "T1.3-6",
      "T1.4-1",
      "T1.4-2",
      "T1.4-4",
      "T2.6-1",
      "T2.6-2",
      "P-1",
    ],
    [
      // VIOL-VALID-CTRL: the control-character rule of SPEC 1.4 is not
      // enforced for code points outside the whitespace class — segments and
      // tags containing U+0000–U+0008, U+000E–U+001F, or U+007F are accepted
      // as valid. Whitespace characters (U+0009–U+000D, U+0020) remain
      // rejected in segments, and tag splitting is unchanged.
      violator("VIOL-VALID-CTRL", "conf-valid/bin-ctrl.mjs", [
        "T1.4-1",
        "T1.4-4",
        "P-1",
      ]),
      // VIOL-VALID-WIDE: U+00A0 and U+0085, exactly, are treated as
      // whitespace for SPEC 1.4 validity — a segment or tag containing
      // either is rejected with 14.4. Tag splitting and all other
      // classifications are unchanged.
      violator("VIOL-VALID-WIDE", "conf-valid/bin-wide.mjs", [
        "T1.4-2",
        "T1.4-4",
        "P-1",
      ]),
      // VIOL-VALID-SEP: SPEC 1.4's bar on U+2028 and U+2029 is not
      // enforced — a segment or tag containing either is accepted as valid.
      // One clause of 1.4's quote-and-escape bullet dropped: the quote,
      // escape, and character-reference characters stay barred, and neither
      // code point joins the whitespace class, so tag splitting is unchanged.
      violator("VIOL-VALID-SEP", "conf-valid/bin-sep.mjs", [
        "T1.4-1",
        "T1.4-4",
        "P-1",
      ]),
    ],
  ),
  // CONF-MD (§CONF-MD): Markdown compilation — `build` with byte-exact
  // Markdown output per SPEC 3 (removal, replacement, the line-drop rule,
  // line terminators, the parse-not-pattern grammar boundary), `query node`
  // reporting identity, source range (SPEC 1.7), own and subtree text (1.6),
  // and its `contains` edges (5.2) — the outgoing ones naming its children,
  // whence P-3 takes them — `check` exiting 0 and
  // `query nodes`/`query edges` reporting no node and no edge for
  // construct-like bytes inside fences and code spans (T3-1's
  // grammar-boundary arm), and the emission scope of SPEC 7.3, over
  // spec-group workspaces with imports, embeddings, comments, mixed line
  // terminators, fenced code blocks and inline code spans carrying
  // construct-like bytes, and the full 2.7 prop set.
  conformer(
    "CONF-MD",
    "conf-md/bin.mjs",
    ["T3-1", "T3-2", "T3-3", "T3-4", "T3-5", "T3-6", "P-2", "P-3"],
    [
      // VIOL-MD-CLASS: the line-drop rule classifies U+00A0, U+0085, and
      // U+2028 as whitespace when deciding whether a line is left empty or
      // whitespace-only — consistently in Markdown output and, through SPEC
      // 1.6, in own and subtree text. A line left holding only those code
      // points after removals is dropped with its terminator. The judgement
      // of what brace and ESM-block content is whitespace and comments
      // (14.20) and the ESM block's line terminators are unchanged.
      violator("VIOL-MD-CLASS", "conf-md/bin-class.mjs", ["T3-3", "P-2"]),
      // VIOL-MD-CR: a lone U+000D is not recognized as a line terminator by
      // the line model of SPEC 3 — consistently in Markdown output and,
      // through SPEC 1.6, in own and subtree text. CRLF and lone U+000A
      // remain terminators; a lone U+000D is an ordinary in-line character.
      // The deletion judgement of 14.20, which ends a line comment at U+000A
      // or U+000D alike, and the ESM block's line terminators are unchanged.
      violator("VIOL-MD-CR", "conf-md/bin-cr.mjs", ["T3-4", "P-2"]),
    ],
  ),
  // CONF-DISC (§CONF-DISC): configuration-driven discovery — `build` and
  // `ids` as the observation of the discovered set, over the glob semantics
  // of SPEC 7 (byte-wise case-sensitive matching, the dot-segment rule,
  // every character outside `*`/`?`/`**` a literal), discovery's refusal to
  // follow symbolic links, and the source exclusion of SPEC 13.4, with
  // 14.14 for outside-root patterns and 14.15 for import errors.
  conformer(
    "CONF-DISC",
    "conf-disc/bin.mjs",
    ["T7-4", "T7-5", "T7-6"],
    [
      // VIOL-DISC-DIALECT: glob patterns are interpreted in a common dialect
      // in which `[ ]` bracket expressions and `{ }` brace alternations are
      // active metacharacters, instead of the literals SPEC 7 requires. `*`,
      // `?`, `**`, case sensitivity, and the dot-segment rule are unchanged.
      violator("VIOL-DISC-DIALECT", "conf-disc/bin-dialect.mjs", ["T7-4"]),
      // VIOL-DISC-SYMLINK: discovery follows symbolic links to existing
      // files — a symbolic link to an existing file, at a workspace-relative
      // path a spec-group glob matches, is discovered as a source (read
      // through the link). Broken links remain ignored, and symbolic links
      // to directories remain untraversed, so discovery still terminates
      // (T7-5 fails by assertion, not by hang).
      violator("VIOL-DISC-SYMLINK", "conf-disc/bin-symlink.mjs", ["T7-5"]),
      // VIOL-DISC-DERIVED: discovery does not apply the source exclusion of
      // SPEC 13.4 — a path whose file name contains `.xspec.`, a file under
      // `.xspec/`, or a file at an enabled Markdown emit destination, when
      // matched by a spec-group or code-group glob, is treated as an ordinary
      // match of its group's kind: on the spec side an `.mdx` name parsed as
      // MDX and any other name reported as 14.19; on the code side a
      // discovered code source parsed as plain TypeScript (14.20: the
      // grammar its name selects), an edgeless whole-file location where it
      // parses (4.6) and a condition-20 finding where it does not. Glob
      // semantics, the dot-segment rule, link behavior, 14.19 for non-`.mdx`
      // matches, the parse of a discovered source (14.20), the gate of 13.3,
      // and the import and empty-map rules are unchanged.
      violator("VIOL-DISC-DERIVED", "conf-disc/bin-derived.mjs", ["T7-6"]),
    ],
  ),
  // CONF-AVAIL (§CONF-AVAIL): availability answers and JSON datum forms —
  // `view` (with and without `--text`) and `occurrences` over spec-only
  // `.mdx` workspaces, answering in the form-exact 12.7 document forms with
  // the three-state datums (plain value / stated `null` / the unavailability
  // marker), the 11.2 availability rules (spelled-identity definedness,
  // chain conditions, resolution through defined identities, whole-value
  // expansion poisoning, removal classification by form), occurrence
  // records per SPEC 5.7/11.3, the `--file`/`--to` domain rules of 11.3,
  // the raw attribute and import data of 11.4, findings with stable codes
  // for the staged conditions, and the 11.2 exit discipline.
  conformer(
    "CONF-AVAIL",
    "conf-avail/bin.mjs",
    ["T11.2-2", "T11.2-4", "T11.3-4", "T11.4-3", "T11.4-4"],
    [
      // VIOL-AVAIL-NULLMARKER: the unavailability marker is never emitted —
      // every datum the rules of SPEC 11.2 leave undefined is carried as
      // `null` in place of {"unavailable": true} (12.7). Which data are
      // undefined, all defined values, findings, exit codes, and every
      // other document member are unchanged.
      violator("VIOL-AVAIL-NULLMARKER", "conf-avail/bin-nullmarker.mjs", [
        "T11.2-2",
        "T11.2-4",
        "T11.4-3",
        "T11.4-4",
      ]),
      // VIOL-AVAIL-OMIT: `null`-valued members are omitted — every member
      // whose value an answer would carry as the stated `null` (12.7) is
      // absent from the emitted document (a viewed root's `tags` and
      // `coverage` and a located finding's `path` among them). Members with
      // plain, marker, or list values, which findings exist, and exit codes
      // are unchanged.
      violator("VIOL-AVAIL-OMIT", "conf-avail/bin-omit.mjs", [
        "T11.2-2",
        "T11.2-4",
        "T11.4-3",
        "T11.4-4",
      ]),
      // VIOL-AVAIL-NOFILE: `occurrences` does not apply the `--file`
      // restriction — the flag and its argument checks behave as specified
      // (11.3), but the consulted domain is the entire discovered set,
      // exactly as with the flag absent — the enumeration and the findings
      // accompanying it (11.2) follow that widened domain. `--to` selection,
      // `view`, and every other behavior are unchanged.
      violator("VIOL-AVAIL-NOFILE", "conf-avail/bin-nofile.mjs", ["T11.3-4"]),
    ],
  ),
  // CONF-ORPHAN (§CONF-ORPHAN): removal of recorded derived paths — `build`
  // and `check` over one spec group of trivial single-section `.mdx`
  // sources, `markdown` emitting next to sources or under an `outDir` and
  // then reconfigured (`outDir` changed, or emission disabled by `markdown`
  // absent or `emit: false`), a code group globbing `specs/*.md` of
  // `export const n = 1`; graph data recording the derived paths generated
  // (13.3); 13.4's removal of each recorded path no longer generated — its
  // occupant judged at the path itself, a directory or a discovered source
  // left in place, anything else removed (a symbolic link as the link),
  // nothing read below a non-directory component — and 14.10's per-file,
  // graph-data, and recorded-file forms, the last reporting exactly what
  // that removal would remove.
  conformer(
    "CONF-ORPHAN",
    "conf-orphan/bin.mjs",
    ["T13.4-11"],
    [
      // VIOL-ORPHAN-THROUGHLINK: the removal of a recorded path no longer
      // generated — and 14.10's recorded-file form, reporting exactly what
      // it would remove — resolves the path's workspace-relative directory
      // components through symbolic links to directories inside the
      // workspace root, judging, reporting, and removing the entry the
      // link's target holds under the remaining components as if it stood
      // at the recorded path. The occupant at the recorded path itself is
      // still judged as itself; a plain-file component, or a link to a
      // directory outside the root, still leaves the path holding nothing;
      // derived-file writes still traverse no link.
      violator("VIOL-ORPHAN-THROUGHLINK", "conf-orphan/bin-throughlink.mjs", [
        "T13.4-11",
      ]),
      // VIOL-ORPHAN-LINKTARGET: the removal of a recorded path no longer
      // generated, where the path's occupant is a symbolic link, deletes the
      // plain file the link resolves to (nothing where it resolves to no
      // plain file) in place of the link, and leaves the link standing. The
      // occupant is still judged as itself, so 14.10's recorded-file form is
      // unchanged; nothing is read below a non-directory component;
      // derived-file writes still replace a link as the occupant.
      violator("VIOL-ORPHAN-LINKTARGET", "conf-orphan/bin-linktarget.mjs", [
        "T13.4-11",
      ]),
    ],
  ),
];
