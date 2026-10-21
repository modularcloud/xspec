// H-3 output adapters — the human-report decoders (TEST-SPEC H-3 "Report
// forms", H-5, T12.0-15, S-5; SPEC 12.0, 14). Harness machinery only: no
// product imports.
//
// H-3: "the human report of every command that has one … is asserted,
// decoded by a human-report adapter held to the rules above (shape-aware,
// value-blind, failing loudly when required information is absent)". Where
// the mention matcher beside this module (human.ts) asks only that each
// datum appear somewhere, associating nothing, these decoders take a human
// report onto the information model the `--json` assertions use — each
// finding's stable code, its locations, its concerned path, and its
// identities, one finding per finding (model.ts `FindingInformation`), and
// an exit-2 error's stable code and concerned path (`ErrorInformation`) —
// so a comparison against the `--json` twin's decoded document can tell
// which datum belongs to which finding and which the human report omits
// (T12.0-15: "a datum the `--json` document carries and the human report
// omits fails"). The preview decoder beside them takes a `rename`/`move
// --preview` report onto the preview model the form-exact `--json` decode
// produces (model.ts `PreviewReport`): its findings as above, and its plan
// — the mapping's pairs, each file with its edits' classes and ranges, and
// the delta's two directions or its unavailability (TEST-SPEC T6.6-7). The
// performed-report decoder takes a successful `rename`/`move` report onto
// the applied mapping the form-exact `--json` decode produces (model.ts
// `PerformedOperationReport`): every pair the operation journaled, its
// `from` and `to` identity (TEST-SPEC T12.0-15; SPEC 6.4, 6.5). The
// impact-report decoder takes an `impact --base <ref>` report onto the
// impact model the `--json` adapter produces (model.ts `ImpactReport`):
// each category of each requirement entry with its attribution, the nodes
// the entry covers — a collapsed ancestor chain's several — and its
// deletion, and each impacted location of each code group with its
// witness edge and path (TEST-SPEC T12.0-15; SPEC 5.6, 9.1–9.3). The
// review-report decoders take a `review list` report onto the listing
// model the review adapter produces (model.ts `SessionListReport`): each
// session's name with its strategy and its item counts by stored status,
// or its corruption in their place, and the listing's findings; and a
// `review status` report onto the status model (`SessionStatusReport`):
// each item's id, kind, scope, status, and blocked state, and the totals
// by status (TEST-SPEC T12.0-15; SPEC 10.7). A refusal or a corrupt
// session's report — `review create`, `resolve`, or `split` refused, a
// subcommand naming a corrupt session — is a findings report (14, 14.21).
// Like every adapter here they are the one place aware of the report's
// concrete shape: adjustable to shape, never to values, and failing loudly
// — a diagnosed `HarnessAssertionError` naming the line and the datum —
// when a report's text fits none of the layout below or lacks what the
// layout carries. Later decoders for the other human reports (`review
// next` and `review show`, coverage, ids, show) go beside these.
//
// The layout, fitted to what the built product emits (observed by running
// it on T14-11's per-condition fixtures, T1.5-2's arms, T12.7-3's stagings,
// and hand-staged 14.11, 14.12, 14.13, 14.21, refusal, and code-less
// findings, the previews of T6.6-2 through T6.6-6, the performed reports
// of T6.4-1's rename and T6.5-1's file moves, the impact reports of
// T5.6-1 through T5.6-6 and T9-1 through T9.3-3, and the `review` reports
// of T10.7-1, T10.7-5 through T10.7-10, and T10.1-4 — never by reading its
// source):
//
// - A findings report — a failing `build`'s validation errors, `check`'s
//   findings, a gated read's report (13.3), a refused operation's refusal
//   reasons (6.4–6.6, 10.7) — is empty when there is no finding, and is
//   otherwise one line per finding, in any order, then an optional count
//   line (`3 findings`, `1 finding`), which must then equal the number of
//   finding lines. A finding line is
//     `[<head>: ]<code>: <message>[ (also at <loc>, …)][ [<identity>, …]]`
//   where `<head>` is the first location `<path>:<start>-<end>` of a
//   located finding, the concerned `<path>` of a path-level one, or absent
//   (a policy violation, a refusal concerning an identity, a code-less
//   finding); `<code>` is the stable code (SPEC 14) or, for a code-less
//   finding (10.7), the word `finding`; the parenthesized list holds every
//   further location in the same `<path>:<start>-<end>` form; and the
//   bracketed list holds the identities, in their order. The message is
//   free wording (H-3; T12.0-15: never asked) and is never decoded. A
//   datum the built product prints as it stands may hold a line feed
//   (U+000A) — T6.5-4's barred destination `specs/a<U+000A>b.mdx`, the
//   concerned path of its refusal, a valid-UTF-8 path with no marked form
//   (12.0) — which then breaks its finding line in two: a line holding no
//   `: ` at all is no finding line by itself, so it is read together with
//   the line after it, joined by the line feed, until the text holds a
//   `: ` (never joined with the count line ending the report, nor in a
//   preview with a section header or a section's item). SPEC fixes no
//   human spelling for such a path: a product printing the line feed
//   escaped or quoted reads here as another path, failing the comparison —
//   a layout this adapter would be adjusted to, as to any other shape,
//   never a value.
// - An exit-2 error's standard-error message (12.0: with JSON output not
//   in effect, its only report) opens with the diagnostic prefix
//   `xspec: `; a coded error continues `<code>: <path>: <message>`, with
//   one such line per defect where a condition reports several (a
//   configuration file's distinct defects), each repeating the code and
//   the path; a plain usage error continues with its message alone.
// - A preview report — `rename … --preview` or `move … --preview` without
//   `--json` (SPEC 6.6) — is, for a refused preview, the findings report of
//   its refusal findings alone (above, its count line ending it). Any other
//   preview prints its plan: three sections, each opened by a header line
//   at the margin — `mapping:`, `files:`, and `delta:`, in that order as
//   the built product prints them, read in any order, each exactly once —
//   after the finding lines of an answer carrying a finding (14.23's
//   unavailable delta beside its condition-23 finding; the built product
//   prints no count line there, and one ending the finding lines is read).
//   Beneath `mapping:`, one line per mapped identity, indented two spaces:
//   `<from> -> <to>`. Beneath `files:`, each file's path indented two
//   spaces, and beneath it one line per edit indented four:
//   `<start>-<end> <class>` — the range's two pre-operation byte offsets
//   (1.7; a creation's `0-0`, the new file's start) and its class, one of
//   the ten 12.7 class names, read as a code is (below). Beneath `delta:`,
//   one line per derived path, indented two spaces: `generated <path>` or
//   `removed <path>`, nothing beneath it where both directions are empty —
//   or, the delta unavailable (14.23), the header `delta: unavailable` with
//   nothing beneath it. A finding line may stand at the margin between
//   sections too; it closes the section above it.
// - A performed report — a successful `rename …` or `move …` without
//   `--json` (SPEC 6.4: a successful rename's report is the applied
//   mapping, and a move reports its own as rename does, 6.5) — is one line
//   per mapped identity at the margin, `<from> -> <to>`, in any order, then
//   an optional count line (`2 identities mapped`, `1 identity mapped`),
//   which must then equal the number of pair lines. A successful operation
//   carries no finding (12.7: `findings` `[]`), so no finding line belongs
//   there: a line holding no pair fits no layout.
// - An impact report — `impact --base <ref>` without `--json` (SPEC 9.3) —
//   is a line naming the resolved baseline, `baseline <commit>` (read once,
//   never compared: 9.3 defines no such datum for the report), then its
//   sections, each opened by a header line at the margin, each at most once
//   (9.3: output is grouped by category), in any order: one per change
//   category (5.6), `<category>:` — the category spelled as a code is
//   (below) — and `directly impacted code:` and `transitively impacted
//   code:` (9.2), each printed only where it holds an entry, so a report
//   without differences is the baseline line alone. Beneath a category, one
//   line per entry carrying it, indented two spaces:
//   `<node>[, <node>…][ (deleted)] — attributed to: <identity>[, …]` — the
//   nodes the entry covers (several for a collapsed ancestor chain, 9.3),
//   the mark of a deleted node reported under its baseline identity mapped
//   forward (9.3), and the category's attribution (5.6, 9.1), an entry
//   printing no attribution clause read as attributed to none; a node
//   carrying several categories stands under each. Beneath a code group,
//   one line per impacted location, indented two spaces:
//   `<location> — via <kind> <target>; path: <node>[ -> <node>…]` — the
//   location, its witness edge's kind (5.2, spelled as a code is) and
//   target, the edge running from the location itself (9.2: a location's
//   impact edges are its own `references` and `embeds` edges, the reported
//   one targeting the path's first node, 9.3), and the witness path in
//   order from the edge's target.
// - A listing — `review list` without `--json` (SPEC 10.7) — is empty with
//   no session, and is otherwise one line per session, in the order 10.7
//   fixes: `<name> <strategy> <status>=<n> …` for a healthy session — its
//   strategy, then its item counts by stored status, each `<status>=<n>`
//   (the built product prints all five statuses of 10.3, zeros included)
//   — or `<name> corrupt` for a corrupt one, reported by name in place of
//   those fields; then each corrupt session's condition-21 finding (14.21)
//   as a finding line of the findings report above, and that report's
//   count line. A line holding a `: ` is a finding line, any other a
//   session line; a strategy word spelling a built-in strategy (SPEC 10:
//   `path-blocks`, `audit`, `coverage`) reads as its name, any other word
//   as printed.
// - A status report — `review status <name>` without `--json` (SPEC 10.7)
//   — is one row per item, in the order 10.7 fixes:
//   `<id> <kind> <scope> <status> blocked=<true|false>` — the scope every
//   word between the kind and the status — then the totals line
//   `totals: <status>=<n> …` (the built product prints all five statuses,
//   zeros included), the line a session holding no item prints alone.
// - A code is recognized at the position the layout gives it, spelled as
//   human.ts's `codeMention` spells one, over the whole segment: its words
//   case-insensitive, joined by one character that is neither letter nor
//   digit or by nothing — the findings report prints `missing-id`, the
//   standard-error message `configuration error`. A segment spelling no
//   stable code is no code. An item status, an item kind, and a built-in
//   strategy's name — closed vocabularies — are read the same way.
// - A path is a plain path as it stands, or the marked byte form 12.0
//   requires for a non-UTF-8 path — `<bytes <hex>>`, the path's exact
//   bytes as lowercase hexadecimal, two digits per byte — recognized by
//   that mark alone, whatever the bytes are (T12.0-15: "telling it from a
//   plain path string by that mark alone and recovering from it the path's
//   exact bytes"), and decoded to the same model value the `--json` marked
//   form decodes to (`{ bytes }`), so the comparison below holds the two
//   presentations to the same bytes and the same form: a valid-UTF-8 path
//   presented marked, or a non-UTF-8 path presented plain — lossily
//   decoded (U+FFFD-substituted) or otherwise unmarked — differs from its
//   twin. A report whose bytes are not valid UTF-8 fails at once: every
//   datum a report carries has a UTF-8 spelling (identities and plain
//   paths are valid UTF-8, and a non-UTF-8 path has no plain form, 12.0),
//   so such bytes are a path printed raw.
//
// Conservative operationalizations (noted per H-3):
// - The layout's separators are its own: a datum spelling one cannot be
//   told from the layout. A path holding a `: `-bounded segment that spells
//   a stable code before its finding's code, or ending in `:<n>-<n>`, a
//   location path or identity holding `, `, an identity holding ` [`, a
//   concerned path holding `: ` in a standard-error message, a message
//   ending in `)` after ` (also at ` or in `]` after ` [`, and a line
//   feed (U+000A) anywhere but in a finding's head — or in a head whose
//   part before it holds `: ` — would mis-decode — never into a pass:
//   the decoded finding then differs from its twin, or the line fits no
//   layout, and the comparison or the decode fails diagnosed. The data of
//   T14-11's fixtures, T1.5-2's arms, T12.7-3's stagings, and T6.6-3's
//   refused previews hold none.
//   Likewise in a preview's plan: an identity holding ` -> ` (a pair line
//   holding it twice fails as ambiguous), and an identity or path
//   beginning with a space, which the indentation absorbs — the data of
//   T6.6-2's, T6.6-4's, T6.6-5's, and T6.6-6's stagings hold none, and
//   the refused previews of T6.6-3 print no plan. In a performed report,
//   an identity holding ` -> ` likewise, or one spelling the count line's
//   form as the report's last line — the performed operations of T6.4-1
//   and T6.5-1 map none. In an impact report, an identity holding `, `,
//   ` -> `, ` — attributed to:`, ` — via `, or `; path: `, or ending in
//   ` (deleted)`, a location holding ` — via `, an identity beginning with
//   a space, and an edge kind holding one — the data of T5.6-*, T9-*, and
//   T9.x-* hold none. In a listing, a session line holding `: ` reads as a
//   finding line and a finding line holding none as a session line (no
//   line-feed continuation is read there: a condition-21 finding concerns
//   `.xspec/reviews/<name>.json`, whose valid session name holds no line
//   feed, 10.1), and a name holding a space cannot be told from its
//   strategy — 10.1's session names hold neither. In a status report, an
//   item id holding a space or spelling `totals:` mis-decodes, and a scope
//   holding two spaces in a row fails the decode — the item ids and
//   identities of T10.7-6's and T10.1-4's sessions hold none.
// - A code's words at the code's position are the code — human.ts's
//   convention, under which `missing ID` carries `missing-id` — so a line
//   whose code token is gone but whose message opens with its own code's
//   words up to a `: ` (the built product's `unknown dependency: …`)
//   reads as carrying the code; a message opening with another code's
//   words reads as that code, and fails the comparison.
// - The comparison is exact on the information model: the human report's
//   findings, as a multiset, equal the `--json` document's — one human
//   finding per JSON finding, findings equal in every datum included (two
//   14.13 findings on different journal lines differ in their messages
//   alone) — each finding's locations as a multiset (their order the JSON
//   form's alone, 12.7), its identities as a sequence (their positions
//   carry their roles: 14.12's rule, source, kind, and target; a
//   refusal's bearers in location order), and every path compared in form
//   and bytes.
// - A preview's comparison is exact on the preview model, its order free
//   (SPEC fixes none for the human report; 12.7's orders are the JSON
//   form's, T12.0-15): its findings as above; a plan exactly where the
//   `--json` twin reports one — none beside a refusal's findings (6.6) —
//   its mapping as a multiset of `from`/`to` pairs, its files as a set of
//   paths in form and bytes (a path listed twice reads as one file, its
//   edits merged), each file's edits as a multiset of class and range, and
//   the delta reported unavailable exactly where the twin's is (14.23),
//   else each direction's paths as a multiset in form and bytes, a path
//   under the other direction named as such.
// - A performed report's comparison is exact on the applied mapping, its
//   order free (12.7's `from`-byte order is the JSON form's, T12.0-15): its
//   pairs as a multiset of `from`/`to` pairs, a pair the human report
//   omits, changes, or lists beside the twin's named as such.
// - A listing's comparison is exact on the listing model: its sessions
//   matched by name, every session once, corrupt exactly where the twin's
//   is, a healthy one's strategy equal and its counts by stored status
//   equal under each status of 10.3 — a status a line or the twin's
//   record holds no count for reading as 0, the review adapter's own
//   convention (whether a zero count appears is concrete shape, H-3) — and
//   the sessions in the twin's order: T12.0-15 lists 10.7's `list` among
//   the orders SPEC fixes for the report itself (byte order of session
//   name; the twin's order the home test asserts); its findings compared
//   as a findings report's are, order free. A status report's comparison
//   likewise: its rows matched by id, every row once, kind, scope, status,
//   and blocked state equal, in the twin's order (10.7's item order), and
//   its totals equal under each status, a status with no total reading as
//   0 — a report printing no totals line reads as all zeros, which fails
//   wherever the twin totals any item.
// - An impact report's comparison is exact on the impact model, its order
//   free (T12.0-15 lists none for `impact`: SPEC fixes no order for the
//   report itself). Its unit is one category of one requirement entry —
//   the category, the nodes the entry covers as a multiset (a collapsed
//   chain's members, their order free), the deletion, and the category's
//   attribution as a multiset — the human report's lines and the `--json`
//   entries' categories compared as multisets of such data: the `--json`
//   form gathers a node's several categories into one entry, the human
//   report stands it under each category (9.3: grouped by category), and
//   neither grouping is a datum. A `--json` entry carrying no category is
//   a datum no line under a category carries, so it never matches. Each
//   impacted location of each group is one datum — the group, the
//   location, its witness edge's source, target, and kind, and its witness
//   path as a sequence — the two forms' data compared as multisets. The
//   resolved baseline either form may echo is not compared. A datum the
//   human report omits, changes, misplaces, or lists beside its twin's is
//   named as such.

import { Buffer } from "node:buffer";
import { fail } from "../assertions.js";
import { guardSyncStep } from "../step-guards.js";
import type { RunResult } from "../subprocess.js";
import { pathValueBytes, renderPathValue } from "./forms.js";
import { STABLE_CODES } from "./human.js";
import type {
  AppliedMappingPair,
  ChangeCategory,
  EdgeKind,
  ErrorInformation,
  Finding,
  FindingInformation,
  FindingLocation,
  GraphEdge,
  ImpactReport,
  ItemKind,
  ItemStatus,
  PathValue,
  PerformedOperationReport,
  PreviewDeltaDatum,
  PreviewEdit,
  PreviewEditClass,
  PreviewReport,
  SessionListEntry,
  SessionListReport,
  SessionStatusReport,
  SessionStatusRow,
} from "./model.js";
import {
  CHANGE_CATEGORIES,
  EDGE_KINDS,
  ITEM_KINDS,
  ITEM_STATUSES,
  PREVIEW_EDIT_CLASSES,
} from "./model.js";

// --- the decoded forms ---------------------------------------------------------

/** One finding decoded from a human findings report, with where it stood. */
export interface HumanFinding extends FindingInformation {
  /** The report line it was decoded from, 1-based. */
  readonly line: number;
  /** That line's text. */
  readonly text: string;
}

/** A human findings report decoded onto the information model. */
export interface HumanFindingsReport {
  /** Every finding, in the report's own order (free, T12.0-15). */
  readonly findings: readonly HumanFinding[];
}

/** An exit-2 standard-error message decoded onto the information model. */
export interface HumanErrorMessage extends ErrorInformation {
  /** The message's text. */
  readonly text: string;
}

/**
 * One identity pair of a human preview's mapping or of a performed report's
 * applied mapping, with where it stood.
 */
export interface HumanMappingPair extends AppliedMappingPair {
  /** The report line it was decoded from, 1-based. */
  readonly line: number;
  /** That line's text. */
  readonly text: string;
}

/** One edit a human preview lists beneath its file, with where it stood. */
export interface HumanPreviewEdit extends PreviewEdit {
  /** The report line it was decoded from, 1-based. */
  readonly line: number;
  /** That line's text. */
  readonly text: string;
}

/** One file a human preview lists, with the edits beneath it. */
export interface HumanPreviewFile {
  /** The file's path, plain or in the marked byte form's model value. */
  readonly file: PathValue;
  /** Its edits, in the report's own order (free, T12.0-15). */
  readonly edits: readonly HumanPreviewEdit[];
  /** The report line its path stood on, 1-based. */
  readonly line: number;
  /** That line's text. */
  readonly text: string;
}

/** One derived path a human preview's delta lists, with where it stood. */
export interface HumanDeltaPath {
  /** The path, plain or in the marked byte form's model value. */
  readonly path: PathValue;
  /** The report line it was decoded from, 1-based. */
  readonly line: number;
  /** That line's text. */
  readonly text: string;
}

/**
 * A human preview's delta: its two directions, each in the report's own
 * order, or reported unavailable as one datum (SPEC 6.6, 14.23).
 */
export type HumanPreviewDelta =
  | {
      readonly generated: readonly HumanDeltaPath[];
      readonly removed: readonly HumanDeltaPath[];
    }
  | {
      readonly unavailable: true;
      /** The report line of the `delta: unavailable` header, 1-based. */
      readonly line: number;
    };

/** A human preview's plan: its mapping, files, and delta (SPEC 6.6). */
export interface HumanPreviewPlan {
  readonly mapping: readonly HumanMappingPair[];
  readonly files: readonly HumanPreviewFile[];
  readonly delta: HumanPreviewDelta;
}

/**
 * A human preview report decoded onto the preview model (TEST-SPEC
 * T6.6-7): its findings, and its plan — `null` where the report prints none,
 * as a refused preview's does (SPEC 6.6).
 */
export interface HumanPreviewReport {
  /** Every finding, in the report's own order (free, T12.0-15). */
  readonly findings: readonly HumanFinding[];
  readonly plan: HumanPreviewPlan | null;
  /** The report's text, for diagnoses. */
  readonly text: string;
}

/**
 * A human performed report decoded onto the applied mapping (TEST-SPEC
 * T12.0-15; SPEC 6.4, 6.5): every pair the report lists.
 */
export interface HumanPerformedReport {
  /** Every mapped pair, in the report's own order (free, T12.0-15). */
  readonly mapping: readonly HumanMappingPair[];
  /** The report's text, for diagnoses. */
  readonly text: string;
}

/** The two impacted-code groups (SPEC 9.2), as the impact model names them. */
export type ImpactCodeGroup = "direct" | "transitive";

/**
 * One requirement-level line of a human impact report: one category of one
 * entry (SPEC 5.6, 9.1, 9.3), with where it stood.
 */
export interface HumanImpactCategoryLine {
  /** The category its section's header names (SPEC 5.6). */
  readonly category: ChangeCategory;
  /** The nodes the entry covers — several for a collapsed chain (9.3). */
  readonly nodes: readonly string[];
  /** Whether it is marked deleted, under its baseline identity (9.3). */
  readonly deleted: boolean;
  /** The category's attribution (5.6, 9.1), empty where none is printed. */
  readonly attributedTo: readonly string[];
  /** The report line it was decoded from, 1-based. */
  readonly line: number;
  /** That line's text. */
  readonly text: string;
}

/**
 * One impacted-code line of a human impact report: one location of one
 * group with its witness edge and path (SPEC 9.2, 9.3), with where it
 * stood.
 */
export interface HumanImpactedCodeLine {
  /** The group its section's header names (SPEC 9.2). */
  readonly group: ImpactCodeGroup;
  /** The impacted code location's identity. */
  readonly location: string;
  /** The witness edge: from the location itself, its kind and target. */
  readonly edge: GraphEdge;
  /** The witness path, in order from the edge's target (9.3). */
  readonly path: readonly string[];
  /** The report line it was decoded from, 1-based. */
  readonly line: number;
  /** That line's text. */
  readonly text: string;
}

/**
 * A human impact report decoded onto the impact model (TEST-SPEC T12.0-15;
 * SPEC 9.3): every category line and every impacted-code line, each in the
 * report's own order (free, T12.0-15).
 */
export interface HumanImpactReport {
  /** The `baseline <commit>` line's commit, `null` where none is printed. */
  readonly baseline: string | null;
  readonly categories: readonly HumanImpactCategoryLine[];
  readonly code: readonly HumanImpactedCodeLine[];
  /** The report's text, for diagnoses. */
  readonly text: string;
}

/**
 * Counts by item status as a human report prints them (SPEC 10.3, 10.7):
 * one per count printed — a status the report prints no count for reads as
 * 0 in the comparison (the module header).
 */
export type HumanStatusCounts = Readonly<Partial<Record<ItemStatus, number>>>;

/**
 * One session line of a human `review list` report (SPEC 10.7), with where
 * it stood: the session's name and, for a healthy session, its strategy
 * and its item counts by stored status — or, for a corrupt one, the mark
 * printed in their place.
 */
export interface HumanSessionListEntry {
  readonly name: string;
  readonly corrupt: boolean;
  /**
   * A healthy session's strategy — a built-in strategy's name (SPEC 10)
   * where the line spells one, else the word as printed — `null` for a
   * corrupt session.
   */
  readonly strategy: string | null;
  /** A healthy session's counts by stored status; none for a corrupt one. */
  readonly counts: HumanStatusCounts;
  /** The report line it was decoded from, 1-based. */
  readonly line: number;
  /** That line's text. */
  readonly text: string;
}

/**
 * A human `review list` report decoded onto the listing model (TEST-SPEC
 * T12.0-15; SPEC 10.7): its session lines in the report's own order — the
 * order 10.7 fixes for the report itself, byte order of session name — and
 * its findings, each corrupt session's condition 21 (14.21), order free.
 */
export interface HumanSessionListReport {
  readonly sessions: readonly HumanSessionListEntry[];
  readonly findings: readonly HumanFinding[];
  /** The report's text, for diagnoses. */
  readonly text: string;
}

/**
 * One item row of a human `review status` report (SPEC 10.7), with where
 * it stood: the item's id, kind, scope node, status (read-time
 * invalidation applied, 10.4), and blocked state (10.3).
 */
export interface HumanStatusRow {
  readonly id: string;
  readonly kind: ItemKind;
  /** The scope node's identity, as the row prints it. */
  readonly scope: string;
  readonly status: ItemStatus;
  readonly blocked: boolean;
  /** The report line it was decoded from, 1-based. */
  readonly line: number;
  /** That line's text. */
  readonly text: string;
}

/**
 * A human `review status` report decoded onto the status model (TEST-SPEC
 * T12.0-15; SPEC 10.7): its item rows in the report's own order — the
 * order 10.7 fixes for the report itself, item order — and its totals by
 * status.
 */
export interface HumanSessionStatusReport {
  readonly items: readonly HumanStatusRow[];
  /** The totals line's totals, `null` where the report prints none. */
  readonly totals: HumanStatusCounts | null;
  /** The report's text, for diagnoses. */
  readonly text: string;
}

// --- diagnoses -------------------------------------------------------------------

const EXCERPT_LIMIT = 2048;

function excerpt(text: string): string {
  if (text.length === 0) return "<empty>";
  const clipped = text.slice(0, EXCERPT_LIMIT);
  return text.length > EXCERPT_LIMIT
    ? `${JSON.stringify(clipped)}… (${String(text.length)} chars total)`
    : JSON.stringify(clipped);
}

/** Render raw bytes for a diagnosis: hexadecimal, bounded. */
function renderBytes(bytes: Uint8Array): string {
  const LIMIT = 512;
  const hex = Buffer.from(bytes.subarray(0, LIMIT)).toString("hex");
  return bytes.length > LIMIT
    ? `hex ${hex}… (${String(bytes.length)} bytes total)`
    : `hex ${hex}`;
}

/** The adapter's name in a diagnosis, the caller's context beside it. */
function adapterName(kind: string, context: string | undefined): string {
  return context === undefined
    ? `human ${kind} adapter`
    : `human ${kind} adapter (${context})`;
}

/**
 * Fail a decode loudly (H-3: a test error, never a pass), naming the
 * adapter, the line, and what the layout expected there.
 */
function decodeFail(
  adapter: string,
  where: string,
  expected: string,
  report: string,
): never {
  fail(
    `${adapter}: ${where}: expected ${expected}. ` +
      `H-3: the human-report adapter is fitted to the product's report layout and fails loudly ` +
      `when required information is absent or unparseable, never defaulting; if the product's ` +
      `real layout legitimately differs, adjust this adapter's shape — never its values.\n` +
      `Report: ${excerpt(report)}`,
  );
}

/** A line of the report, quoted for a diagnosis. */
function atLine(line: number, text: string): string {
  return `line ${String(line)} (${excerpt(text)})`;
}

// --- shared readings -------------------------------------------------------------

/**
 * The report's text, its bytes valid UTF-8 — else the decode fails: such
 * bytes are a path printed raw (the module header).
 */
function utf8Text(bytes: Uint8Array, adapter: string, stream: string): string {
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      bytes,
    );
  } catch {
    return fail(
      `${adapter}: the ${stream} is not valid UTF-8 — every datum a report carries has a UTF-8 ` +
        `spelling and a non-UTF-8 path has no plain form, so these bytes are a path printed raw ` +
        `(SPEC 12.0: such a path is presented in an explicitly marked byte form wherever an ` +
        `output carries one; TEST-SPEC T12.0-15): ${renderBytes(bytes)}`,
    );
  }
}

/** The report's lines, a final line break ending the last one. */
function reportLines(text: string): string[] {
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/** One separator character between a code's words, or none (human.ts). */
const CODE_WORD_SEPARATOR = "[^A-Za-z0-9]?";

/** The whole-segment spelling of each stable code (the module header). */
const CODE_SPELLINGS: readonly {
  readonly code: string;
  readonly pattern: RegExp;
}[] = STABLE_CODES.map((code) => ({
  code,
  pattern: new RegExp(`^${code.split("-").join(CODE_WORD_SEPARATOR)}$`, "i"),
}));

/** The word a findings report prints in a code-less finding's code position. */
const CODE_LESS_WORD = /^finding$/i;

/**
 * The stable code a whole segment spells (the module header), `null` for
 * the code-less word, or `undefined` for a segment spelling neither.
 */
function codeSpelledBy(segment: string): string | null | undefined {
  if (CODE_LESS_WORD.test(segment)) return null;
  const spelled = CODE_SPELLINGS.filter(({ pattern }) => pattern.test(segment));
  if (spelled.length > 1) {
    throw new Error(
      `harness defect: the segment ${JSON.stringify(segment)} spells the stable codes ` +
        `${spelled.map(({ code }) => code).join(", ")} at once — SPEC 14's codes are a closed ` +
        `vocabulary no two of whose spellings coincide (human.ts STABLE_CODES)`,
    );
  }
  return spelled[0]?.code;
}

/** The marked byte form of a non-UTF-8 path, the whole token (the module header). */
const BYTE_MARK = /^<bytes ((?:[0-9a-f]{2})+)>$/;

/**
 * A path token as a human report presents it (the module header): the
 * marked byte form, recognized by its mark alone and decoded to its exact
 * bytes (`{ bytes }`, the model value of the `--json` marked form), or a
 * plain path string as it stands. An empty token is no path.
 */
function decodeHumanPathToken(
  token: string,
  adapter: string,
  where: string,
  report: string,
): PathValue {
  if (token.length === 0) {
    decodeFail(adapter, where, "a path, never an empty token", report);
  }
  const mark = BYTE_MARK.exec(token);
  return mark === null ? token : { bytes: mark[1]! };
}

/**
 * A location token: its path — whatever it holds, a line feed included
 * (the module header) — then its offsets, each decimal as the layout
 * spells it: no sign, no leading zero.
 */
const LOCATION_TOKEN = /^([\s\S]+):(0|[1-9][0-9]*)-(0|[1-9][0-9]*)$/;

/**
 * A location token `<path>:<start>-<end>` (the module header), or
 * `undefined` where the token has no such form; a malformed range — an
 * end before its start, an offset past the safe integers — fails.
 */
function decodeLocationToken(
  token: string,
  adapter: string,
  where: string,
  report: string,
): FindingLocation | undefined {
  const match = LOCATION_TOKEN.exec(token);
  if (match === null) return undefined;
  const start = Number(match[2]);
  const end = Number(match[3]);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
    decodeFail(
      adapter,
      where,
      `byte offsets within the safe integers (SPEC 1.7), got ${match[2]!}-${match[3]!}`,
      report,
    );
  }
  if (end < start) {
    decodeFail(
      adapter,
      where,
      `a range whose end is not before its start (SPEC 1.7), got ${match[2]!}-${match[3]!}`,
      report,
    );
  }
  return {
    file: decodeHumanPathToken(match[1]!, adapter, where, report),
    range: { start, end },
  };
}

// --- the findings report -----------------------------------------------------------

/** The layout's separator between a line's head, its code, and its message. */
const SEGMENT_SEPARATOR = ": ";

/** The further locations' list, opening (the module header). */
const ALSO_AT_OPENING = " (also at ";

/** The identities' list, opening (the module header). */
const IDENTITIES_OPENING = " [";

/** The count line ending a report that lists any finding. */
const COUNT_LINE = /^(0|[1-9][0-9]*) findings?$/;

/**
 * A finding line's head, its code, and the rest of it: the first segment
 * spelling a stable code or the code-less word, everything before it the
 * head — `undefined` where no segment does.
 */
function splitAtCode(text: string):
  | {
      readonly head: string;
      readonly code: string | null;
      readonly rest: string;
    }
  | undefined {
  let start = 0;
  for (;;) {
    const end = text.indexOf(SEGMENT_SEPARATOR, start);
    const segment = end === -1 ? text.slice(start) : text.slice(start, end);
    const code = codeSpelledBy(segment);
    if (code !== undefined) {
      return {
        head:
          start === 0 ? "" : text.slice(0, start - SEGMENT_SEPARATOR.length),
        code,
        rest: end === -1 ? "" : text.slice(end + SEGMENT_SEPARATOR.length),
      };
    }
    if (end === -1) return undefined;
    start = end + SEGMENT_SEPARATOR.length;
  }
}

/** One finding line decoded onto the information model (the module header). */
function decodeFindingLine(
  text: string,
  line: number,
  adapter: string,
  report: string,
): HumanFinding {
  const where = atLine(line, text);
  const split = splitAtCode(text);
  if (split === undefined) {
    decodeFail(
      adapter,
      where,
      "a finding line — `[<head>: ]<code>: <message>`, its code a stable code SPEC 14 lists " +
        "or the code-less word `finding` — or the count line ending the report; no segment " +
        "of this line spells a stable code",
      report,
    );
  }
  let body = split.rest;
  let identities: string[] = [];
  if (body.endsWith("]")) {
    const opening = body.lastIndexOf(IDENTITIES_OPENING);
    if (opening !== -1) {
      const listed = body.slice(opening + IDENTITIES_OPENING.length, -1);
      identities = listed.length === 0 ? [] : listed.split(", ");
      body = body.slice(0, opening);
      if (identities.some((identity) => identity.length === 0)) {
        decodeFail(
          adapter,
          where,
          "an identities list `[<identity>, …]` of non-empty identities",
          report,
        );
      }
    }
  }
  const further: FindingLocation[] = [];
  if (body.endsWith(")")) {
    const opening = body.lastIndexOf(ALSO_AT_OPENING);
    if (opening !== -1) {
      const listed = body.slice(opening + ALSO_AT_OPENING.length, -1);
      for (const token of listed.split(", ")) {
        const location = decodeLocationToken(token, adapter, where, report);
        if (location === undefined) {
          decodeFail(
            adapter,
            where,
            `every further location in the \`(also at …)\` list as \`<path>:<start>-<end>\`, ` +
              `its two byte offsets included (SPEC 1.7, 14), got ${JSON.stringify(token)}`,
            report,
          );
        }
        further.push(location);
      }
    }
  }
  if (split.head.length === 0) {
    if (further.length > 0) {
      decodeFail(
        adapter,
        where,
        "a first location `<path>:<start>-<end>` heading a line that lists further locations",
        report,
      );
    }
    return {
      code: split.code,
      locations: [],
      path: null,
      identities,
      line,
      text,
    };
  }
  const first = decodeLocationToken(split.head, adapter, where, report);
  if (first !== undefined) {
    return {
      code: split.code,
      locations: [first, ...further],
      path: null,
      identities,
      line,
      text,
    };
  }
  if (further.length > 0) {
    decodeFail(
      adapter,
      where,
      "a first location `<path>:<start>-<end>`, its two byte offsets included, heading a " +
        `line that lists further locations (SPEC 1.7, 14), got ${JSON.stringify(split.head)}`,
      report,
    );
  }
  return {
    code: split.code,
    locations: [],
    path: decodeHumanPathToken(split.head, adapter, where, report),
    identities,
    line,
    text,
  };
}

/**
 * The finding line opening at `index`, with every line a line feed broke
 * off it (the module header): a line holding no `: ` separator is no
 * finding line by itself — a datum holding a line feed (U+000A), printed
 * as it stands, ends it there — so it is read together with the line after
 * it, joined by the line feed, while the text holds no separator and that
 * line may continue it (`continues`: never the count line ending the
 * report, a section header, or a section's item). Returns the text and the
 * index of its last line.
 */
function findingLineAt(
  lines: readonly string[],
  index: number,
  continues: (next: number) => boolean,
): { readonly text: string; readonly last: number } {
  let text = lines[index]!;
  let last = index;
  while (
    !text.includes(SEGMENT_SEPARATOR) &&
    last + 1 < lines.length &&
    continues(last + 1)
  ) {
    last += 1;
    text = `${text}\n${lines[last]!}`;
  }
  return { text, last };
}

/** The decode of a findings report's bytes, under its guard. */
function decodeFindingsBytes(
  bytes: Uint8Array,
  context: string | undefined,
): HumanFindingsReport {
  const adapter = adapterName("findings report", context);
  const report = utf8Text(bytes, adapter, "report");
  const lines = reportLines(report);
  const findings: HumanFinding[] = [];
  let counted: number | undefined = undefined;
  const endsReport = (index: number): boolean =>
    index === lines.length - 1 && COUNT_LINE.test(lines[index]!);
  for (let index = 0; index < lines.length; index += 1) {
    const text = lines[index]!;
    const line = index + 1;
    if (endsReport(index)) {
      counted = Number(COUNT_LINE.exec(text)![1]);
      continue;
    }
    if (text.length === 0) {
      decodeFail(
        adapter,
        atLine(line, text),
        "a finding line, never an empty line",
        report,
      );
    }
    const run = findingLineAt(lines, index, (next) => !endsReport(next));
    findings.push(decodeFindingLine(run.text, line, adapter, report));
    index = run.last;
  }
  if (counted !== undefined && counted !== findings.length) {
    decodeFail(
      adapter,
      atLine(lines.length, lines[lines.length - 1]!),
      `a count line equal to the ${String(findings.length)} finding line(s) the report lists — ` +
        `it counts ${String(counted)}`,
      report,
    );
  }
  return { findings };
}

/**
 * Decode a human findings report — the standard output of a failing
 * `build`, of `check`, of a gated read's report, or of a refused
 * operation (SPEC 12.0, 13.3, 14) — onto the information model, one
 * {@link HumanFinding} per finding line (the module header's layout).
 * Takes a run (its stdout bytes: reports are standard-output content,
 * 12.0) or the report's bytes. Fails diagnosed on bytes that are not
 * valid UTF-8, on a line fitting no layout, on a malformed location or
 * identities list, and on a count line disagreeing with the lines. A
 * harness step under its own guard (TEST-SPEC S-3): synchronous, bounded
 * by the capture limit, measured.
 */
export function decodeHumanFindingsReport(
  output: RunResult | Uint8Array,
  context?: string,
): HumanFindingsReport {
  const bytes = output instanceof Uint8Array ? output : output.stdoutBytes;
  const step =
    output instanceof Uint8Array
      ? "decoding a human findings report (decodeHumanFindingsReport)"
      : `decoding the human findings report of ${output.commandLine} (decodeHumanFindingsReport)`;
  return guardSyncStep(step, () => decodeFindingsBytes(bytes, context));
}

// --- the exit-2 standard-error message ----------------------------------------------

/** The product's diagnostic prefix opening a standard-error message line. */
const DIAGNOSTIC_PREFIX = "xspec: ";

/**
 * A prefixed line's head (the module header): the code its first segment
 * spells and the path its second holds before the message — the code
 * `null` where the first segment spells none (a plain usage error), the
 * path `null` where no message follows it.
 */
function errorHead(
  body: string,
  adapter: string,
  where: string,
  report: string,
): ErrorInformation {
  const first = body.indexOf(SEGMENT_SEPARATOR);
  const code = codeSpelledBy(first === -1 ? body : body.slice(0, first));
  if (code === undefined || code === null) return { code: null, path: null };
  if (first === -1) return { code, path: null };
  const rest = body.slice(first + SEGMENT_SEPARATOR.length);
  const second = rest.indexOf(SEGMENT_SEPARATOR);
  if (second === -1) return { code, path: null };
  return {
    code,
    path: decodeHumanPathToken(rest.slice(0, second), adapter, where, report),
  };
}

/** Whether two path values are the same path in the same form (the module header). */
function samePath(a: PathValue | null, b: PathValue | null): boolean {
  if (a === null || b === null) return a === b;
  if ((typeof a === "string") !== (typeof b === "string")) return false;
  return Buffer.compare(pathValueBytes(a), pathValueBytes(b)) === 0;
}

/** The decode of a standard-error message's bytes, under its guard. */
function decodeErrorBytes(
  bytes: Uint8Array,
  context: string | undefined,
): HumanErrorMessage {
  const adapter = adapterName("standard-error message", context);
  const report = utf8Text(bytes, adapter, "standard-error message");
  const lines = reportLines(report);
  if (lines.length === 0) {
    decodeFail(
      adapter,
      "the whole stream",
      "the exit-2 error's message — without JSON output in effect it is the error's only " +
        "report (SPEC 12.0; TEST-SPEC T12.0-15) — but standard error is empty",
      report,
    );
  }
  let heads = 0;
  let decoded: (ErrorInformation & { readonly where: string }) | undefined =
    undefined;
  for (const [index, text] of lines.entries()) {
    if (!text.startsWith(DIAGNOSTIC_PREFIX)) continue;
    heads += 1;
    const where = atLine(index + 1, text);
    const head = errorHead(
      text.slice(DIAGNOSTIC_PREFIX.length),
      adapter,
      where,
      report,
    );
    if (head.code === null) continue;
    if (decoded === undefined) {
      decoded = { ...head, where };
      continue;
    }
    if (head.code !== decoded.code || !samePath(head.path, decoded.path)) {
      decodeFail(
        adapter,
        where,
        `every coded line naming the one error's code and concerned path — ${decoded.where} ` +
          `names ${describeError(decoded)}, this line ${describeError(head)}, so which the ` +
          `error's are is ambiguous`,
        report,
      );
    }
  }
  if (heads === 0) {
    decodeFail(
      adapter,
      "the whole stream",
      `a message opening with the product's diagnostic prefix ${JSON.stringify(DIAGNOSTIC_PREFIX)}`,
      report,
    );
  }
  return {
    code: decoded?.code ?? null,
    path: decoded?.path ?? null,
    text: report,
  };
}

/**
 * Decode an exit-2 error's standard-error message — its only report when
 * JSON output is not in effect (SPEC 12.0; TEST-SPEC H-5, T12.0-15) — onto
 * `{ code, path }` (the module header's layout): the stable code and
 * concerned path its coded lines name, or neither where no line carries a
 * code (a plain usage error, 14). Takes a run (its stderr bytes) or the
 * message's bytes. Fails diagnosed on an empty stream, bytes that are not
 * valid UTF-8, no line opening with the diagnostic prefix, an empty path
 * token, and coded lines naming different codes or paths. A harness step
 * under its own guard (TEST-SPEC S-3).
 */
export function decodeHumanErrorMessage(
  output: RunResult | Uint8Array,
  context?: string,
): HumanErrorMessage {
  const bytes = output instanceof Uint8Array ? output : output.stderrBytes;
  const step =
    output instanceof Uint8Array
      ? "decoding a standard-error message (decodeHumanErrorMessage)"
      : `decoding the standard-error message of ${output.commandLine} (decodeHumanErrorMessage)`;
  return guardSyncStep(step, () => decodeErrorBytes(bytes, context));
}

// --- the preview report ------------------------------------------------------------

/** The plan's three sections, by the word of each header line. */
type PreviewSection = "mapping" | "files" | "delta";

/** The plan's sections, in the order the built product prints them. */
const PREVIEW_SECTIONS: readonly PreviewSection[] = [
  "mapping",
  "files",
  "delta",
];

/** The word after `delta: ` where the delta is unavailable (14.23). */
const UNAVAILABLE_WORD = /^unavailable$/i;

/**
 * A line at the margin opening one of the plan's sections (the module
 * header): `mapping:`, `files:`, `delta:`, or `delta: unavailable` — or
 * `undefined` for any other line.
 */
function previewSectionHeader(
  text: string,
):
  | { readonly section: PreviewSection; readonly unavailable: boolean }
  | undefined {
  if (text === "mapping:") return { section: "mapping", unavailable: false };
  if (text === "files:") return { section: "files", unavailable: false };
  if (text === "delta:") return { section: "delta", unavailable: false };
  const opening = "delta: ";
  if (
    text.startsWith(opening) &&
    UNAVAILABLE_WORD.test(text.slice(opening.length))
  ) {
    return { section: "delta", unavailable: true };
  }
  return undefined;
}

/** The indentation of a section's item lines (the module header). */
const ITEM_INDENT = "  ";

/** The indentation of an edit beneath its file (the module header). */
const EDIT_INDENT = "    ";

/** The separator between a mapping pair's two identities. */
const MAPPING_ARROW = " -> ";

/** An edit's range as the layout spells it — no sign, no leading zero — then its class. */
const EDIT_LINE = /^(0|[1-9][0-9]*)-(0|[1-9][0-9]*) (.+)$/;

/** The whole-segment spelling of each edit class, as a stable code's (the module header). */
const EDIT_CLASS_SPELLINGS: readonly {
  readonly editClass: PreviewEditClass;
  readonly pattern: RegExp;
}[] = PREVIEW_EDIT_CLASSES.map((editClass) => ({
  editClass,
  pattern: new RegExp(
    `^${editClass.split("-").join(CODE_WORD_SEPARATOR)}$`,
    "i",
  ),
}));

/** The delta's two direction words, opening each of its lines. */
const DELTA_DIRECTIONS: readonly {
  readonly direction: "generated" | "removed";
  readonly pattern: RegExp;
}[] = [
  { direction: "generated", pattern: /^generated$/i },
  { direction: "removed", pattern: /^removed$/i },
];

/**
 * A mapping line's pair (the module header): `<from> -> <to>`, both
 * present, after `indent` — a preview's item indentation beneath its
 * `mapping:` header, nothing for a performed report's pair at the margin.
 */
function decodeMappingLine(
  text: string,
  indent: string,
  line: number,
  adapter: string,
  report: string,
): HumanMappingPair {
  const where = atLine(line, text);
  const body = text.slice(indent.length);
  const arrow = body.indexOf(MAPPING_ARROW);
  if (arrow === -1) {
    decodeFail(
      adapter,
      where,
      `a mapping line \`${indent}<from> -> <to>\` — both identities of the pair present, the ` +
        "arrow between them (SPEC 6.6: the mapping's every `from` and `to` identity; 6.4, " +
        "6.5: the applied mapping a performed operation reports)",
      report,
    );
  }
  if (body.indexOf(MAPPING_ARROW, arrow + 1) !== -1) {
    decodeFail(
      adapter,
      where,
      `one ${JSON.stringify(MAPPING_ARROW)} between a pair's two identities — this line holds ` +
        "several, so where the `from` identity ends is ambiguous",
      report,
    );
  }
  const from = body.slice(0, arrow);
  const to = body.slice(arrow + MAPPING_ARROW.length);
  if (from.length === 0 || to.length === 0) {
    decodeFail(
      adapter,
      where,
      `both identities of a mapping pair, never an empty one — its ${from.length === 0 ? "`from`" : "`to`"} ` +
        "identity is absent (SPEC 6.6)",
      report,
    );
  }
  return { from, to, line, text };
}

/** An edit line beneath its file (the module header): `<start>-<end> <class>`. */
function decodeEditLine(
  text: string,
  line: number,
  adapter: string,
  report: string,
): HumanPreviewEdit {
  const where = atLine(line, text);
  const match = EDIT_LINE.exec(text.slice(EDIT_INDENT.length));
  if (match === null) {
    decodeFail(
      adapter,
      where,
      "an edit line `    <start>-<end> <class>` — the edit's range as its two pre-operation " +
        "byte offsets (SPEC 1.7, 6.6; a creation's at the new file's start), then its class",
      report,
    );
  }
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
    decodeFail(
      adapter,
      where,
      `byte offsets within the safe integers (SPEC 1.7), got ${match[1]!}-${match[2]!}`,
      report,
    );
  }
  if (end < start) {
    decodeFail(
      adapter,
      where,
      `a range whose end is not before its start (SPEC 1.7), got ${match[1]!}-${match[2]!}`,
      report,
    );
  }
  const spelled = EDIT_CLASS_SPELLINGS.filter(({ pattern }) =>
    pattern.test(match[3]!),
  );
  if (spelled.length > 1) {
    throw new Error(
      `harness defect: the segment ${JSON.stringify(match[3]!)} spells the edit classes ` +
        `${spelled.map(({ editClass }) => editClass).join(", ")} at once — 12.7's ten class ` +
        `names are a closed vocabulary no two of whose spellings coincide`,
    );
  }
  const editClass = spelled[0]?.editClass;
  if (editClass === undefined) {
    decodeFail(
      adapter,
      where,
      `the edit's class, one of the ten class names SPEC 12.7 lists (${PREVIEW_EDIT_CLASSES.join(", ")}), ` +
        `after its range — got ${JSON.stringify(match[3]!)}`,
      report,
    );
  }
  return { class: editClass, range: { start, end }, line, text };
}

/**
 * A delta line (the module header): `<direction> <path>`, the direction
 * `generated` or `removed`.
 */
function decodeDeltaLine(
  text: string,
  line: number,
  adapter: string,
  report: string,
): {
  readonly direction: "generated" | "removed";
  readonly path: HumanDeltaPath;
} {
  const where = atLine(line, text);
  const body = text.slice(ITEM_INDENT.length);
  const space = body.indexOf(" ");
  const word = space === -1 ? body : body.slice(0, space);
  const direction = DELTA_DIRECTIONS.find(({ pattern }) =>
    pattern.test(word),
  )?.direction;
  if (direction === undefined || space === -1) {
    decodeFail(
      adapter,
      where,
      "a delta line `  <direction> <path>` — the direction `generated` or `removed`, then " +
        "the derived path (SPEC 6.6: the delta's paths in both directions, one datum)",
      report,
    );
  }
  return {
    direction,
    path: {
      path: decodeHumanPathToken(body.slice(space + 1), adapter, where, report),
      line,
      text,
    },
  };
}

/** A file being read, its edits still gathering beneath it. */
interface GatheringFile {
  readonly file: PathValue;
  readonly edits: HumanPreviewEdit[];
  readonly line: number;
  readonly text: string;
}

/** The decode of a preview report's bytes, under its guard. */
function decodePreviewBytes(
  bytes: Uint8Array,
  context: string | undefined,
): HumanPreviewReport {
  const adapter = adapterName("preview report", context);
  const report = utf8Text(bytes, adapter, "report");
  const lines = reportLines(report);
  const findings: HumanFinding[] = [];
  let counted: { readonly count: number; readonly line: number } | undefined =
    undefined;
  const opened = new Map<PreviewSection, number>();
  let unavailable: number | undefined = undefined;
  let section: PreviewSection | undefined = undefined;
  let file: GatheringFile | undefined = undefined;
  const mapping: HumanMappingPair[] = [];
  const files: GatheringFile[] = [];
  const generated: HumanDeltaPath[] = [];
  const removed: HumanDeltaPath[] = [];
  // The count line ending the finding lines: the report's last line, or
  // one a section header follows.
  const endsFindings = (index: number): boolean => {
    const next = lines[index + 1];
    return (
      COUNT_LINE.test(lines[index]!) &&
      (next === undefined || previewSectionHeader(next) !== undefined)
    );
  };
  for (let index = 0; index < lines.length; index += 1) {
    const text = lines[index]!;
    const line = index + 1;
    const where = atLine(line, text);
    if (text.length === 0) {
      decodeFail(
        adapter,
        where,
        "a line of the preview layout — a finding, a section header, or a section's " +
          "item — never an empty line",
        report,
      );
    }
    const header = previewSectionHeader(text);
    if (header !== undefined) {
      const first = opened.get(header.section);
      if (first !== undefined) {
        decodeFail(
          adapter,
          where,
          `each of the plan's sections once — the ${header.section} section opened on line ` +
            `${String(first)} opens again here`,
          report,
        );
      }
      opened.set(header.section, line);
      if (header.unavailable) unavailable = line;
      section = header.section;
      file = undefined;
      continue;
    }
    if (!text.startsWith(ITEM_INDENT)) {
      // At the margin: the count line ending the finding lines, or a
      // finding line — which closes the section above it.
      section = undefined;
      file = undefined;
      if (endsFindings(index)) {
        if (counted !== undefined) {
          decodeFail(
            adapter,
            where,
            `one count line ending the finding lines — line ${String(counted.line)} counts them ` +
              "already",
            report,
          );
        }
        counted = { count: Number(COUNT_LINE.exec(text)![1]), line };
        continue;
      }
      const run = findingLineAt(
        lines,
        index,
        (next) =>
          previewSectionHeader(lines[next]!) === undefined &&
          !lines[next]!.startsWith(ITEM_INDENT) &&
          !endsFindings(next),
      );
      findings.push(decodeFindingLine(run.text, line, adapter, report));
      index = run.last;
      continue;
    }
    if (section === undefined) {
      decodeFail(
        adapter,
        where,
        "an indented line inside one of the plan's sections, a header line at the margin " +
          "— `mapping:`, `files:`, or `delta:` — opening it",
        report,
      );
    }
    switch (section) {
      case "mapping":
        mapping.push(
          decodeMappingLine(text, ITEM_INDENT, line, adapter, report),
        );
        break;
      case "files":
        if (text.startsWith(EDIT_INDENT)) {
          if (file === undefined) {
            decodeFail(
              adapter,
              where,
              "an edit line beneath the file it edits — a file line `  <path>` above it",
              report,
            );
          }
          file.edits.push(decodeEditLine(text, line, adapter, report));
        } else {
          file = {
            file: decodeHumanPathToken(
              text.slice(ITEM_INDENT.length),
              adapter,
              where,
              report,
            ),
            edits: [],
            line,
            text,
          };
          files.push(file);
        }
        break;
      case "delta": {
        if (unavailable !== undefined) {
          decodeFail(
            adapter,
            where,
            "nothing beneath `delta: unavailable` — the delta is reported unavailable as one " +
              "datum (SPEC 6.6, 14.23), never beside paths",
            report,
          );
        }
        const decoded = decodeDeltaLine(text, line, adapter, report);
        (decoded.direction === "generated" ? generated : removed).push(
          decoded.path,
        );
        break;
      }
    }
  }
  if (counted !== undefined && counted.count !== findings.length) {
    decodeFail(
      adapter,
      atLine(counted.line, lines[counted.line - 1]!),
      `a count line equal to the ${String(findings.length)} finding line(s) the report lists — ` +
        `it counts ${String(counted.count)}`,
      report,
    );
  }
  if (opened.size === 0) return { findings, plan: null, text: report };
  for (const expected of PREVIEW_SECTIONS) {
    if (!opened.has(expected)) {
      decodeFail(
        adapter,
        "the whole report",
        `the plan's three sections — \`mapping:\`, \`files:\`, and \`delta:\` — each once ` +
          `(SPEC 6.6: the mapping, every file with its edits, and the delta); the ${expected} ` +
          "section is missing",
        report,
      );
    }
  }
  return {
    findings,
    plan: {
      mapping,
      files,
      delta:
        unavailable === undefined
          ? { generated, removed }
          : { unavailable: true, line: unavailable },
    },
    text: report,
  };
}

/**
 * Decode a human preview report — the standard output of `rename …
 * --preview` or `move … --preview` without `--json` (SPEC 6.6, 12.0) —
 * onto the preview model (the module header's layout): its findings, one
 * {@link HumanFinding} per finding line, and its plan, `null` where the
 * report prints none (a refused preview's findings report). Takes a run
 * (its stdout bytes) or the report's bytes. Fails diagnosed on bytes that
 * are not valid UTF-8, an empty line, a finding line fitting no layout, a
 * count line disagreeing with the finding lines, a section opened twice or
 * missing beside the others, an indented line outside every section, a
 * mapping line without both identities, an edit line without its range or
 * its class or above every file, a delta line without its direction, and
 * a path beneath `delta: unavailable`. A harness step under its own guard
 * (TEST-SPEC S-3).
 */
export function decodeHumanPreviewReport(
  output: RunResult | Uint8Array,
  context?: string,
): HumanPreviewReport {
  const bytes = output instanceof Uint8Array ? output : output.stdoutBytes;
  const step =
    output instanceof Uint8Array
      ? "decoding a human preview report (decodeHumanPreviewReport)"
      : `decoding the human preview report of ${output.commandLine} (decodeHumanPreviewReport)`;
  return guardSyncStep(step, () => decodePreviewBytes(bytes, context));
}

// --- the performed report ------------------------------------------------------------

/** The count line ending a performed report (the module header). */
const MAPPED_COUNT_LINE = /^(0|[1-9][0-9]*) identit(?:y|ies) mapped$/;

/** The decode of a performed report's bytes, under its guard. */
function decodePerformedBytes(
  bytes: Uint8Array,
  context: string | undefined,
): HumanPerformedReport {
  const adapter = adapterName("performed report", context);
  const report = utf8Text(bytes, adapter, "report");
  const lines = reportLines(report);
  const mapping: HumanMappingPair[] = [];
  let counted: number | undefined = undefined;
  for (const [index, text] of lines.entries()) {
    const line = index + 1;
    if (index === lines.length - 1 && MAPPED_COUNT_LINE.test(text)) {
      counted = Number(MAPPED_COUNT_LINE.exec(text)![1]);
      continue;
    }
    if (text.length === 0) {
      decodeFail(
        adapter,
        atLine(line, text),
        "a mapping line `<from> -> <to>`, never an empty line",
        report,
      );
    }
    mapping.push(decodeMappingLine(text, "", line, adapter, report));
  }
  if (counted !== undefined && counted !== mapping.length) {
    decodeFail(
      adapter,
      atLine(lines.length, lines[lines.length - 1]!),
      `a count line equal to the ${String(mapping.length)} mapping line(s) the report lists — ` +
        `it counts ${String(counted)}`,
      report,
    );
  }
  return { mapping, text: report };
}

/**
 * Decode a human performed report — the standard output of a successful
 * `rename …` or `move …` without `--json` (SPEC 6.4, 6.5, 12.0) — onto the
 * applied mapping (the module header's layout), one
 * {@link HumanMappingPair} per pair line. Takes a run (its stdout bytes)
 * or the report's bytes. Fails diagnosed on bytes that are not valid
 * UTF-8, an empty line, a line holding no pair or a pair without both
 * identities, a line holding the arrow twice, and a count line disagreeing
 * with the pair lines. A harness step under its own guard (TEST-SPEC S-3).
 */
export function decodeHumanPerformedReport(
  output: RunResult | Uint8Array,
  context?: string,
): HumanPerformedReport {
  const bytes = output instanceof Uint8Array ? output : output.stdoutBytes;
  const step =
    output instanceof Uint8Array
      ? "decoding a human performed report (decodeHumanPerformedReport)"
      : `decoding the human performed report of ${output.commandLine} (decodeHumanPerformedReport)`;
  return guardSyncStep(step, () => decodePerformedBytes(bytes, context));
}

// --- the impact report ----------------------------------------------------------------

/** One of the impact report's sections: a change category or a code group. */
type ImpactSection =
  | { readonly kind: "category"; readonly category: ChangeCategory }
  | { readonly kind: "code"; readonly group: ImpactCodeGroup };

/**
 * The whole-segment spelling of a phrase's words, as a stable code's is
 * spelled (the module header): its words case-insensitive, joined by one
 * character that is neither letter nor digit or by nothing.
 */
function phrasePattern(phrase: string): RegExp {
  return new RegExp(`^${phrase.split(/[- ]/).join(CODE_WORD_SEPARATOR)}$`, "i");
}

/** Each section's header words and their spelling (the module header). */
const IMPACT_SECTION_SPELLINGS: readonly {
  readonly section: ImpactSection;
  /** The header's words, naming the section in a diagnosis. */
  readonly words: string;
  readonly pattern: RegExp;
}[] = [
  ...CHANGE_CATEGORIES.map((category) => ({
    section: { kind: "category" as const, category },
    words: category,
    pattern: phrasePattern(category),
  })),
  {
    section: { kind: "code", group: "direct" },
    words: "directly impacted code",
    pattern: phrasePattern("directly impacted code"),
  },
  {
    section: { kind: "code", group: "transitive" },
    words: "transitively impacted code",
    pattern: phrasePattern("transitively impacted code"),
  },
];

/**
 * A line at the margin opening one of the impact report's sections (the
 * module header): `<words>:`, the words a change category's or a code
 * group's — or `undefined` for any other line.
 */
function impactSectionHeader(
  text: string,
): (typeof IMPACT_SECTION_SPELLINGS)[number] | undefined {
  if (!text.endsWith(":")) return undefined;
  const words = text.slice(0, -1);
  const spelled = IMPACT_SECTION_SPELLINGS.filter(({ pattern }) =>
    pattern.test(words),
  );
  if (spelled.length > 1) {
    throw new Error(
      `harness defect: the header ${JSON.stringify(text)} spells the impact sections ` +
        `${spelled.map((spelling) => spelling.words).join(", ")} at once — SPEC 5.6's four ` +
        `categories and 9.2's two groups are a closed vocabulary no two of whose spellings ` +
        `coincide`,
    );
  }
  return spelled[0];
}

/** The line naming the resolved baseline (the module header). */
const BASELINE_LINE = /^baseline (\S+)$/i;

/** U+2014 EM DASH, the layout's separator, built from its code point. */
const EM_DASH = String.fromCodePoint(0x2014);

/** The attribution clause's opening on a category line (the module header). */
const ATTRIBUTION_OPENING = ` ${EM_DASH} attributed to:`;

/** The mark of a deleted node's entry (the module header). */
const DELETED_MARK = " (deleted)";

/** The separator between a list's identities. */
const LIST_SEPARATOR = ", ";

/** The witness edge's opening on an impacted-code line (the module header). */
const VIA_OPENING = ` ${EM_DASH} via `;

/** The witness path's opening on an impacted-code line (the module header). */
const PATH_OPENING = "; path: ";

/** The separator between a witness path's nodes. */
const PATH_ARROW = " -> ";

/** The whole-segment spelling of each edge kind, as a stable code's (the module header). */
const EDGE_KIND_SPELLINGS: readonly {
  readonly kind: EdgeKind;
  readonly pattern: RegExp;
}[] = EDGE_KINDS.map((kind) => ({ kind, pattern: phrasePattern(kind) }));

/**
 * A category line beneath its header (the module header):
 * `<node>[, <node>…][ (deleted)] — attributed to: <identity>[, …]`, the
 * attribution clause optional (its absence an empty attribution).
 */
function decodeImpactCategoryLine(
  text: string,
  category: ChangeCategory,
  line: number,
  adapter: string,
  report: string,
): HumanImpactCategoryLine {
  const where = atLine(line, text);
  const body = text.slice(ITEM_INDENT.length);
  const opening = body.indexOf(ATTRIBUTION_OPENING);
  let covered = opening === -1 ? body : body.slice(0, opening);
  let attributedTo: string[] = [];
  if (opening !== -1) {
    const clause = body.slice(opening + ATTRIBUTION_OPENING.length);
    if (clause.includes(ATTRIBUTION_OPENING)) {
      decodeFail(
        adapter,
        where,
        `one attribution clause ${JSON.stringify(ATTRIBUTION_OPENING.trim())} per entry line — ` +
          "this line holds several, so where the entry's nodes end is ambiguous",
        report,
      );
    }
    if (clause.length > 0) {
      if (!clause.startsWith(" ")) {
        decodeFail(
          adapter,
          where,
          "the attribution's identities after `attributed to: ` (SPEC 5.6: every category " +
            "attributed to its originating nodes)",
          report,
        );
      }
      attributedTo = clause.slice(1).split(LIST_SEPARATOR);
      if (attributedTo.some((identity) => identity.length === 0)) {
        decodeFail(
          adapter,
          where,
          "an attribution of non-empty identities, `, `-separated (SPEC 5.6, 9.1)",
          report,
        );
      }
    }
  }
  const deleted = covered.endsWith(DELETED_MARK);
  if (deleted) covered = covered.slice(0, -DELETED_MARK.length);
  const nodes = covered.split(LIST_SEPARATOR);
  if (nodes.some((node) => node.length === 0)) {
    decodeFail(
      adapter,
      where,
      "a category line `  <node>[, <node>…][ (deleted)] — attributed to: <identity>[, …]` — " +
        "the entry's node identities, `, `-separated, never an empty one (SPEC 9.3: an entry " +
        "covers one node or a collapsed chain)",
      report,
    );
  }
  return { category, nodes, deleted, attributedTo, line, text };
}

/**
 * An impacted-code line beneath its header (the module header):
 * `<location> — via <kind> <target>; path: <node>[ -> <node>…]`.
 */
function decodeImpactedCodeLine(
  text: string,
  group: ImpactCodeGroup,
  line: number,
  adapter: string,
  report: string,
): HumanImpactedCodeLine {
  const where = atLine(line, text);
  const layout =
    "an impacted-code line `  <location> — via <kind> <target>; path: <node>[ -> <node>…]` — " +
    "the location, its witness edge's kind and target, then its witness path (SPEC 9.3: each " +
    "impacted location with one impact edge that makes it impacted and one shortest " +
    "propagation path witnessing it)";
  const body = text.slice(ITEM_INDENT.length);
  const via = body.indexOf(VIA_OPENING);
  if (via === -1 || via === 0) {
    decodeFail(adapter, where, layout, report);
  }
  const location = body.slice(0, via);
  const rest = body.slice(via + VIA_OPENING.length);
  const opening = rest.indexOf(PATH_OPENING);
  if (opening === -1) {
    decodeFail(
      adapter,
      where,
      `${layout}; the witness path after ${JSON.stringify(PATH_OPENING.trim())} is absent`,
      report,
    );
  }
  const edge = rest.slice(0, opening);
  const space = edge.indexOf(" ");
  if (space === -1 || space === edge.length - 1) {
    decodeFail(
      adapter,
      where,
      `${layout}; the witness edge is not \`<kind> <target>\`, got ${JSON.stringify(edge)}`,
      report,
    );
  }
  const word = edge.slice(0, space);
  const spelled = EDGE_KIND_SPELLINGS.filter(({ pattern }) =>
    pattern.test(word),
  );
  if (spelled.length > 1) {
    throw new Error(
      `harness defect: the segment ${JSON.stringify(word)} spells the edge kinds ` +
        `${spelled.map(({ kind }) => kind).join(", ")} at once — SPEC 5.2's four kinds are a ` +
        `closed vocabulary no two of whose spellings coincide`,
    );
  }
  const kind = spelled[0]?.kind;
  if (kind === undefined) {
    decodeFail(
      adapter,
      where,
      `the witness edge's kind, one of the edge kinds SPEC 5.2 lists (${EDGE_KINDS.join(", ")}), ` +
        `after \`via\` — got ${JSON.stringify(word)}`,
      report,
    );
  }
  const listed = rest.slice(opening + PATH_OPENING.length);
  if (listed.includes(PATH_OPENING)) {
    decodeFail(
      adapter,
      where,
      `one witness path per line — this line opens ${JSON.stringify(PATH_OPENING.trim())} ` +
        "several times, so where the edge's target ends is ambiguous",
      report,
    );
  }
  const path = listed.split(PATH_ARROW);
  if (path.some((node) => node.length === 0)) {
    decodeFail(
      adapter,
      where,
      "a witness path of node identities joined by ` -> `, never an empty one (SPEC 9.3: a " +
        "sequence of nodes from the edge's target to a node whose own edit explains the change)",
      report,
    );
  }
  return {
    group,
    location,
    edge: { from: location, to: edge.slice(space + 1), kind },
    path,
    line,
    text,
  };
}

/** The decode of an impact report's bytes, under its guard. */
function decodeImpactBytes(
  bytes: Uint8Array,
  context: string | undefined,
): HumanImpactReport {
  const adapter = adapterName("impact report", context);
  const report = utf8Text(bytes, adapter, "report");
  const lines = reportLines(report);
  let baseline: { readonly commit: string; readonly line: number } | undefined =
    undefined;
  const opened = new Map<string, number>();
  let section: ImpactSection | undefined = undefined;
  const categories: HumanImpactCategoryLine[] = [];
  const code: HumanImpactedCodeLine[] = [];
  for (const [index, text] of lines.entries()) {
    const line = index + 1;
    const where = atLine(line, text);
    if (text.length === 0) {
      decodeFail(
        adapter,
        where,
        "a line of the impact layout — the baseline line, a section header, or a section's " +
          "entry — never an empty line",
        report,
      );
    }
    if (!text.startsWith(ITEM_INDENT)) {
      const header = impactSectionHeader(text);
      if (header !== undefined) {
        const first = opened.get(header.words);
        if (first !== undefined) {
          decodeFail(
            adapter,
            where,
            `each section once — the report is grouped by category (SPEC 9.3) — the ` +
              `${header.words} section opened on line ${String(first)} opens again here`,
            report,
          );
        }
        opened.set(header.words, line);
        section = header.section;
        continue;
      }
      const named = BASELINE_LINE.exec(text);
      if (named !== null) {
        if (baseline !== undefined) {
          decodeFail(
            adapter,
            where,
            `one baseline line — line ${String(baseline.line)} names the baseline already`,
            report,
          );
        }
        baseline = { commit: named[1]!, line };
        section = undefined;
        continue;
      }
      decodeFail(
        adapter,
        where,
        "a section header at the margin — a change category of SPEC 5.6 (`changed:`, " +
          "`metadata-changed:`, `descendant-changed:`, `upstream-changed:`), " +
          "`directly impacted code:`, or `transitively impacted code:` (9.2) — or the " +
          "`baseline <commit>` line",
        report,
      );
    }
    if (section === undefined) {
      decodeFail(
        adapter,
        where,
        "an indented entry line inside one of the report's sections, a header line at the " +
          "margin opening it",
        report,
      );
    }
    if (section.kind === "category") {
      categories.push(
        decodeImpactCategoryLine(text, section.category, line, adapter, report),
      );
    } else {
      code.push(
        decodeImpactedCodeLine(text, section.group, line, adapter, report),
      );
    }
  }
  return {
    baseline: baseline?.commit ?? null,
    categories,
    code,
    text: report,
  };
}

/**
 * Decode a human impact report — the standard output of `impact --base
 * <ref>` without `--json` (SPEC 9.3, 12.0) — onto the impact model (the
 * module header's layout): one {@link HumanImpactCategoryLine} per entry
 * line beneath a category, one {@link HumanImpactedCodeLine} per line
 * beneath a code group. Takes a run (its stdout bytes) or the report's
 * bytes. Fails diagnosed on bytes that are not valid UTF-8, an empty line,
 * a margin line that is neither a section header nor the baseline line, a
 * section opened twice, a second baseline line, an indented line outside
 * every section, a category line with an empty node or attribution
 * identity or two attribution clauses, and an impacted-code line without
 * its location, its witness edge's kind or target, or its witness path. A
 * harness step under its own guard (TEST-SPEC S-3).
 */
export function decodeHumanImpactReport(
  output: RunResult | Uint8Array,
  context?: string,
): HumanImpactReport {
  const bytes = output instanceof Uint8Array ? output : output.stdoutBytes;
  const step =
    output instanceof Uint8Array
      ? "decoding a human impact report (decodeHumanImpactReport)"
      : `decoding the human impact report of ${output.commandLine} (decodeHumanImpactReport)`;
  return guardSyncStep(step, () => decodeImpactBytes(bytes, context));
}

// --- the review list and status reports -----------------------------------------------

/** One entry of a closed vocabulary with its words and their spelling. */
interface VocabularySpelling<T> {
  readonly entry: T;
  /** The entry's words, naming it in a diagnosis. */
  readonly words: string;
  readonly pattern: RegExp;
}

/** Each entry's spelling, as a stable code's (the module header). */
function vocabularySpellings<T extends string>(
  entries: readonly T[],
): readonly VocabularySpelling<T>[] {
  return entries.map((entry) => ({
    entry,
    words: entry,
    pattern: phrasePattern(entry),
  }));
}

/**
 * The entry of a closed vocabulary a whole word spells (the module
 * header), or `undefined` for a word spelling none.
 */
function spelledEntry<T>(
  word: string,
  spellings: readonly VocabularySpelling<T>[],
  vocabulary: string,
): T | undefined {
  const spelled = spellings.filter(({ pattern }) => pattern.test(word));
  if (spelled.length > 1) {
    throw new Error(
      `harness defect: the word ${JSON.stringify(word)} spells the ${vocabulary} ` +
        `${spelled.map(({ words }) => words).join(", ")} at once — a closed vocabulary no ` +
        `two of whose spellings coincide`,
    );
  }
  return spelled[0]?.entry;
}

/** The item statuses' spellings (SPEC 10.3). */
const ITEM_STATUS_SPELLINGS = vocabularySpellings(ITEM_STATUSES);

/** The item kinds' spellings (SPEC 10.4–10.7). */
const ITEM_KIND_SPELLINGS = vocabularySpellings(ITEM_KINDS);

/** The built-in strategies' names (SPEC 10) and their spellings. */
const STRATEGY_SPELLINGS = vocabularySpellings([
  "path-blocks",
  "audit",
  "coverage",
] as const);

/** A count as the list and status reports print one: `<status>=<n>`. */
const COUNT_TOKEN = /^([^=]+)=(0|[1-9][0-9]*)$/;

/**
 * Counts by status from their tokens (the module header): each
 * `<status>=<n>`, the status spelled as a code is and counted once, the
 * count decimal as the layout spells it — no sign, no leading zero.
 */
function decodeStatusCounts(
  tokens: readonly string[],
  what: string,
  adapter: string,
  where: string,
  report: string,
): HumanStatusCounts {
  const counts: Partial<Record<ItemStatus, number>> = {};
  for (const token of tokens) {
    const match = COUNT_TOKEN.exec(token);
    if (match === null) {
      decodeFail(
        adapter,
        where,
        `${what} each \`<status>=<n>\` — a status SPEC 10.3 lists and its count in ` +
          `decimal — got ${JSON.stringify(token)}`,
        report,
      );
    }
    const status = spelledEntry(
      match[1]!,
      ITEM_STATUS_SPELLINGS,
      "item statuses",
    );
    if (status === undefined) {
      decodeFail(
        adapter,
        where,
        `${what} each \`<status>=<n>\`, the status one SPEC 10.3 lists ` +
          `(${ITEM_STATUSES.join(", ")}) — got ${JSON.stringify(match[1])}`,
        report,
      );
    }
    if (counts[status] !== undefined) {
      decodeFail(
        adapter,
        where,
        `${what} each status counted once — ${status} is counted twice, so which ` +
          "count is its is ambiguous",
        report,
      );
    }
    const count = Number(match[2]);
    if (!Number.isSafeInteger(count)) {
      decodeFail(
        adapter,
        where,
        `${what} counts within the safe integers, got ${match[2]!}`,
        report,
      );
    }
    counts[status] = count;
  }
  return counts;
}

/** The word a listing prints in a corrupt session's fields' place (the module header). */
const CORRUPT_WORD = /^corrupt$/i;

/**
 * One session line of a listing (the module header): `<name> corrupt`, or
 * `<name> <strategy>` and the session's counts `<status>=<n>`.
 */
function decodeSessionLine(
  text: string,
  line: number,
  adapter: string,
  report: string,
): HumanSessionListEntry {
  const where = atLine(line, text);
  const layout =
    "a session line `<name> <strategy> <status>=<n> …` — the session's name, its strategy, " +
    "and its item counts by stored status — or `<name> corrupt`, a corrupt session reported " +
    "by name as corrupt in place of those fields (SPEC 10.7)";
  const tokens = text.split(" ");
  if (tokens.length < 2 || tokens.some((token) => token.length === 0)) {
    decodeFail(
      adapter,
      where,
      `${layout}, its words separated by single spaces`,
      report,
    );
  }
  const [name, second, ...rest] = tokens as [string, string, ...string[]];
  if (CORRUPT_WORD.test(second)) {
    if (rest.length > 0) {
      decodeFail(
        adapter,
        where,
        `${layout} — nothing after \`corrupt\`: a corrupt session has no fields to print`,
        report,
      );
    }
    return { name, corrupt: true, strategy: null, counts: {}, line, text };
  }
  if (COUNT_TOKEN.test(second)) {
    decodeFail(
      adapter,
      where,
      `${layout} — the session's strategy before its counts, got the count ` +
        `${JSON.stringify(second)} in its place`,
      report,
    );
  }
  return {
    name,
    corrupt: false,
    strategy:
      spelledEntry(second, STRATEGY_SPELLINGS, "built-in strategies") ?? second,
    counts: decodeStatusCounts(
      rest,
      "a session line's counts:",
      adapter,
      where,
      report,
    ),
    line,
    text,
  };
}

/** The decode of a listing's bytes, under its guard. */
function decodeSessionListBytes(
  bytes: Uint8Array,
  context: string | undefined,
): HumanSessionListReport {
  const adapter = adapterName("review list report", context);
  const report = utf8Text(bytes, adapter, "report");
  const lines = reportLines(report);
  const sessions: HumanSessionListEntry[] = [];
  const findings: HumanFinding[] = [];
  let counted: number | undefined = undefined;
  for (const [index, text] of lines.entries()) {
    const line = index + 1;
    if (index === lines.length - 1 && COUNT_LINE.test(text)) {
      counted = Number(COUNT_LINE.exec(text)![1]);
      continue;
    }
    if (text.length === 0) {
      decodeFail(
        adapter,
        atLine(line, text),
        "a session line or a finding line, never an empty line",
        report,
      );
    }
    if (text.includes(SEGMENT_SEPARATOR)) {
      findings.push(decodeFindingLine(text, line, adapter, report));
    } else {
      sessions.push(decodeSessionLine(text, line, adapter, report));
    }
  }
  if (counted !== undefined && counted !== findings.length) {
    decodeFail(
      adapter,
      atLine(lines.length, lines[lines.length - 1]!),
      `a count line equal to the ${String(findings.length)} finding line(s) the report lists — ` +
        `it counts ${String(counted)}`,
      report,
    );
  }
  return { sessions, findings, text: report };
}

/**
 * Decode a human `review list` report — its standard output without
 * `--json` (SPEC 10.7, 12.0) — onto the listing model (the module header's
 * layout): one {@link HumanSessionListEntry} per session line, in the
 * report's order, and one {@link HumanFinding} per finding line. Takes a
 * run (its stdout bytes) or the report's bytes. Fails diagnosed on bytes
 * that are not valid UTF-8, an empty line, a session line without its
 * strategy or with words after `corrupt`, a count that is not `<status>=<n>`
 * over a status SPEC 10.3 lists or that counts a status twice, a finding
 * line fitting no layout, and a count line disagreeing with the finding
 * lines. A harness step under its own guard (TEST-SPEC S-3).
 */
export function decodeHumanSessionListReport(
  output: RunResult | Uint8Array,
  context?: string,
): HumanSessionListReport {
  const bytes = output instanceof Uint8Array ? output : output.stdoutBytes;
  const step =
    output instanceof Uint8Array
      ? "decoding a human review list report (decodeHumanSessionListReport)"
      : `decoding the human review list report of ${output.commandLine} (decodeHumanSessionListReport)`;
  return guardSyncStep(step, () => decodeSessionListBytes(bytes, context));
}

/** A status row's blocked state as the layout prints it (the module header). */
const BLOCKED_TOKEN = /^blocked=(true|false)$/i;

/** The totals line's opening (the module header). */
const TOTALS_OPENING = /^totals:/i;

/**
 * One item row of a status report (the module header):
 * `<id> <kind> <scope> <status> blocked=<true|false>`, the scope every word
 * between the kind and the status.
 */
function decodeStatusRowLine(
  text: string,
  line: number,
  adapter: string,
  report: string,
): HumanStatusRow {
  const where = atLine(line, text);
  const layout =
    "an item row `<id> <kind> <scope> <status> blocked=<true|false>` — the item's id, kind, " +
    "scope node, status, and blocked state (SPEC 10.7) — or the totals line " +
    "`totals: <status>=<n> …`";
  const tokens = text.split(" ");
  if (tokens.length < 5 || tokens.some((token) => token.length === 0)) {
    decodeFail(
      adapter,
      where,
      `${layout}, its words separated by single spaces`,
      report,
    );
  }
  const kindWord = tokens[1]!;
  const kind = spelledEntry(kindWord, ITEM_KIND_SPELLINGS, "item kinds");
  if (kind === undefined) {
    decodeFail(
      adapter,
      where,
      `${layout} — the item's kind after its id, one SPEC 10.4–10.7 names ` +
        `(${ITEM_KINDS.join(", ")}), got ${JSON.stringify(kindWord)}`,
      report,
    );
  }
  const statusWord = tokens[tokens.length - 2]!;
  const status = spelledEntry(
    statusWord,
    ITEM_STATUS_SPELLINGS,
    "item statuses",
  );
  if (status === undefined) {
    decodeFail(
      adapter,
      where,
      `${layout} — the item's status before its blocked state, one SPEC 10.3 lists ` +
        `(${ITEM_STATUSES.join(", ")}), got ${JSON.stringify(statusWord)}`,
      report,
    );
  }
  const blocked = BLOCKED_TOKEN.exec(tokens[tokens.length - 1]!);
  if (blocked === null) {
    decodeFail(
      adapter,
      where,
      `${layout} — the item's blocked state last, \`blocked=true\` or \`blocked=false\` ` +
        `(SPEC 10.3), got ${JSON.stringify(tokens[tokens.length - 1])}`,
      report,
    );
  }
  return {
    id: tokens[0]!,
    kind,
    scope: tokens.slice(2, -2).join(" "),
    status,
    blocked: blocked[1]!.toLowerCase() === "true",
    line,
    text,
  };
}

/** The decode of a status report's bytes, under its guard. */
function decodeSessionStatusBytes(
  bytes: Uint8Array,
  context: string | undefined,
): HumanSessionStatusReport {
  const adapter = adapterName("review status report", context);
  const report = utf8Text(bytes, adapter, "report");
  const lines = reportLines(report);
  const items: HumanStatusRow[] = [];
  let totals:
    { readonly counts: HumanStatusCounts; readonly line: number } | undefined =
    undefined;
  for (const [index, text] of lines.entries()) {
    const line = index + 1;
    const where = atLine(line, text);
    if (text.length === 0) {
      decodeFail(
        adapter,
        where,
        "an item row or the totals line, never an empty line",
        report,
      );
    }
    const opening = TOTALS_OPENING.exec(text);
    if (opening === null) {
      items.push(decodeStatusRowLine(text, line, adapter, report));
      continue;
    }
    if (totals !== undefined) {
      decodeFail(
        adapter,
        where,
        `one totals line — line ${String(totals.line)} prints the totals already, so which ` +
          "are the session's is ambiguous",
        report,
      );
    }
    const rest = text.slice(opening[0].length);
    if (rest.length > 0 && !rest.startsWith(" ")) {
      decodeFail(
        adapter,
        where,
        "the totals line `totals: <status>=<n> …`, a space after its opening",
        report,
      );
    }
    totals = {
      counts: decodeStatusCounts(
        rest.length === 0 ? [] : rest.slice(1).split(" "),
        "the totals line's totals:",
        adapter,
        where,
        report,
      ),
      line,
    };
  }
  return { items, totals: totals?.counts ?? null, text: report };
}

/**
 * Decode a human `review status <name>` report — its standard output
 * without `--json` (SPEC 10.7, 12.0) — onto the status model (the module
 * header's layout): one {@link HumanStatusRow} per item row, in the
 * report's order, and the totals line's totals. Takes a run (its stdout
 * bytes) or the report's bytes. Fails diagnosed on bytes that are not
 * valid UTF-8, an empty line, a row without its kind, status, or blocked
 * state where the layout places them, a totals line printed twice or
 * malformed, and a total that is not `<status>=<n>` over a status SPEC 10.3
 * lists or that counts a status twice. A harness step under its own guard
 * (TEST-SPEC S-3).
 */
export function decodeHumanSessionStatusReport(
  output: RunResult | Uint8Array,
  context?: string,
): HumanSessionStatusReport {
  const bytes = output instanceof Uint8Array ? output : output.stdoutBytes;
  const step =
    output instanceof Uint8Array
      ? "decoding a human review status report (decodeHumanSessionStatusReport)"
      : `decoding the human review status report of ${output.commandLine} (decodeHumanSessionStatusReport)`;
  return guardSyncStep(step, () => decodeSessionStatusBytes(bytes, context));
}

// --- the comparisons with the --json twin ---------------------------------------------

/**
 * A decoded `--json` finding's information (model.ts): its code,
 * locations, concerned path, and identities — its message and derived
 * condition left out.
 */
export function findingInformation(
  finding: FindingInformation,
): FindingInformation {
  return {
    code: finding.code,
    locations: finding.locations,
    path: finding.path,
    identities: finding.identities,
  };
}

/** A path's form and bytes, as a key part. */
function pathKey(path: PathValue): string {
  return `${typeof path === "string" ? "plain" : "marked"}:${pathValueBytes(path).toString("hex")}`;
}

/** A location as a key part. */
function locationKey(location: FindingLocation): string {
  return `${pathKey(location.file)}@${String(location.range.start)}-${String(location.range.end)}`;
}

/**
 * A finding's information as one comparable key: the code, the locations
 * as a sorted multiset, the path in form and bytes, and the identities in
 * order (the module header).
 */
function informationKey(finding: FindingInformation): string {
  return JSON.stringify([
    finding.code,
    finding.locations.map(locationKey).sort(),
    finding.path === null ? null : pathKey(finding.path),
    finding.identities,
  ]);
}

function describePath(path: PathValue): string {
  return typeof path === "string"
    ? JSON.stringify(path)
    : `the marked byte form of ${renderPathValue(path)}`;
}

function describeLocation(location: FindingLocation): string {
  return `${describePath(location.file)} ${String(location.range.start)}-${String(location.range.end)}`;
}

/** A finding's information, rendered for a diagnosis. */
function describeInformation(finding: FindingInformation): string {
  const code = finding.code === null ? "code-less" : `code ${finding.code}`;
  const locations =
    finding.locations.length === 0
      ? "no location"
      : `locations [${finding.locations.map(describeLocation).join(", ")}]`;
  const path =
    finding.path === null
      ? "no concerned path"
      : `concerned path ${describePath(finding.path)}`;
  const identities =
    finding.identities.length === 0
      ? "no identity"
      : `identities ${JSON.stringify(finding.identities)}`;
  return `${code}; ${locations}; ${path}; ${identities}`;
}

function describeError(error: ErrorInformation): string {
  const code = error.code === null ? "no stable code" : `code ${error.code}`;
  const path =
    error.path === null
      ? "no concerned path"
      : `concerned path ${describePath(error.path)}`;
  return `${code}, ${path}`;
}

/** The locations of `of` missing from `from`, as multisets. */
function missingLocations(
  of: readonly FindingLocation[],
  from: readonly FindingLocation[],
): FindingLocation[] {
  const left = from.map(locationKey);
  const missing: FindingLocation[] = [];
  for (const location of of) {
    const at = left.indexOf(locationKey(location));
    if (at === -1) missing.push(location);
    else left.splice(at, 1);
  }
  return missing;
}

/** How alike two findings are: shared locations, path, and identities. */
function overlap(a: FindingInformation, b: FindingInformation): number {
  const shared =
    a.locations.length - missingLocations(a.locations, b.locations).length;
  const path = a.path !== null && samePath(a.path, b.path) ? 1 : 0;
  const identities = a.identities.filter((identity) =>
    b.identities.includes(identity),
  ).length;
  return shared + path + identities;
}

/** What the human finding lacks or holds beside the `--json` one, named. */
function describeDifference(
  json: FindingInformation,
  human: HumanFinding,
): string {
  const parts: string[] = [];
  const missing = missingLocations(json.locations, human.locations);
  const extra = missingLocations(human.locations, json.locations);
  if (missing.length > 0) {
    parts.push(
      `missing location(s) ${missing.map(describeLocation).join(", ")}`,
    );
  }
  if (extra.length > 0) {
    parts.push(
      `location(s) the --json finding lacks ${extra.map(describeLocation).join(", ")}`,
    );
  }
  if (!samePath(json.path, human.path)) {
    parts.push(
      json.path === null
        ? `a concerned path the --json finding lacks, ${describePath(human.path!)}`
        : human.path === null
          ? `missing concerned path ${describePath(json.path)}`
          : `concerned path ${describePath(human.path)} where the --json finding carries ${describePath(json.path)}`,
    );
  }
  if (JSON.stringify(json.identities) !== JSON.stringify(human.identities)) {
    const absent = json.identities.filter(
      (identity) => !human.identities.includes(identity),
    );
    parts.push(
      absent.length > 0
        ? `missing identit${absent.length === 1 ? "y" : "ies"} ${JSON.stringify(absent)} (it carries ${JSON.stringify(human.identities)}, the --json finding ${JSON.stringify(json.identities)})`
        : `identities ${JSON.stringify(human.identities)} where the --json finding carries ${JSON.stringify(json.identities)}`,
    );
  }
  return parts.join("; ");
}

/**
 * Assert a decoded human findings report carries the information of the
 * `--json` twin's findings (TEST-SPEC T12.0-15, H-3; the module header's
 * comparison): as multisets, one human finding per JSON finding, equal in
 * code, locations, concerned path, and identities — messages never
 * compared, order free. Fails diagnosed, naming for every JSON finding
 * without a counterpart the nearest human finding and the datum it omits
 * or differs in, and every human finding without one.
 */
export function assertHumanFindingsCarry(
  human: HumanFindingsReport,
  findings: readonly FindingInformation[],
  context: string,
): void {
  // Each human finding's key computed once, its line indices queued by key,
  // so the multiset match is linear in the report.
  const byKey = new Map<string, number[]>();
  human.findings.forEach((candidate, index) => {
    const key = informationKey(candidate);
    const queued = byKey.get(key);
    if (queued === undefined) byKey.set(key, [index]);
    else queued.push(index);
  });
  const matched = new Set<number>();
  const unmatchedJson: FindingInformation[] = [];
  for (const finding of findings) {
    const at = byKey.get(informationKey(finding))?.shift();
    if (at === undefined) unmatchedJson.push(finding);
    else matched.add(at);
  }
  const unmatchedHuman = human.findings.filter(
    (_candidate, index) => !matched.has(index),
  );
  if (unmatchedJson.length === 0 && unmatchedHuman.length === 0) return;
  const lines: string[] = [];
  for (const finding of unmatchedJson) {
    const sameCode = unmatchedHuman.filter(
      (candidate) => candidate.code === finding.code,
    );
    if (sameCode.length === 0) {
      lines.push(
        `- the --json finding (${describeInformation(finding)}) has no counterpart: the human ` +
          `report carries no further finding with its ${finding.code === null ? "code-less form" : `code ${finding.code}`}`,
      );
      continue;
    }
    const nearest = sameCode.reduce((best, candidate) =>
      overlap(finding, candidate) > overlap(finding, best) ? candidate : best,
    );
    lines.push(
      `- the --json finding (${describeInformation(finding)}) has no counterpart; the nearest ` +
        `human finding, line ${String(nearest.line)} (${describeInformation(nearest)}), has ` +
        `${describeDifference(finding, nearest)}`,
    );
  }
  for (const finding of unmatchedHuman) {
    lines.push(
      `- the human finding on line ${String(finding.line)} (${describeInformation(finding)}) ` +
        `matches no --json finding`,
    );
  }
  fail(
    `${context}: the human report does not carry the information its --json twin carries ` +
      `(TEST-SPEC T12.0-15: every finding's code, locations, concerned path, and identities, ` +
      `decoded by the human-report adapter, H-3 — wording, layout, and order free; a datum the ` +
      `--json document carries and the human report omits fails):\n${lines.join("\n")}\n` +
      `Human report lines: ${excerpt(human.findings.map((finding) => finding.text).join("\n"))}`,
  );
}

/**
 * Decode a run's human findings report and assert it carries the
 * information of its `--json` twin's decoded findings (TEST-SPEC
 * T12.0-15): `decodeHumanFindingsReport`, then `assertHumanFindingsCarry`.
 * Returns the decoded report.
 */
export function assertHumanFindingsReportCarries(
  human: RunResult,
  findings: readonly Finding[],
  context: string,
): HumanFindingsReport {
  const decoded = decodeHumanFindingsReport(human, context);
  assertHumanFindingsCarry(decoded, findings.map(findingInformation), context);
  return decoded;
}

/**
 * Assert a decoded exit-2 standard-error message carries the stable code
 * and the concerned path its `--json` twin's error document carries
 * (TEST-SPEC T12.0-15, H-5): equal code, and the same path in form and
 * bytes. A twin carrying no code — a plain usage error — is asserted for
 * neither (T12.0-15: it carries no code and concerns no path). Fails
 * diagnosed, naming the datum the message omits or differs in.
 */
export function assertHumanErrorCarries(
  human: HumanErrorMessage,
  error: ErrorInformation,
  context: string,
): void {
  if (error.code === null) return;
  const problems: string[] = [];
  if (human.code !== error.code) {
    problems.push(
      human.code === null
        ? `it carries no stable code where the --json twin's error document carries ${error.code}`
        : `it carries the code ${human.code} where the --json twin's error document carries ${error.code}`,
    );
  }
  if (!samePath(human.path, error.path)) {
    problems.push(
      error.path === null
        ? `it carries the concerned path ${describePath(human.path!)} the --json twin's error document lacks`
        : human.path === null
          ? `it carries no concerned path where the --json twin's error document carries ${describePath(error.path)}`
          : `it carries the concerned path ${describePath(human.path)} where the --json twin's error document carries ${describePath(error.path)}`,
    );
  }
  if (problems.length === 0) return;
  fail(
    `${context}: the exit-2 standard-error message does not carry the stable code and concerned ` +
      `path its --json twin carries (TEST-SPEC T12.0-15, H-5: without JSON output in effect the ` +
      `message is the error's only report, wording free; a message omitting either fails): ` +
      `${problems.join("; ")}.\nStandard error: ${excerpt(human.text)}`,
  );
}

/**
 * Decode a run's exit-2 standard-error message and assert it carries the
 * stable code and concerned path of its `--json` twin's error document
 * (TEST-SPEC T12.0-15): for a twin carrying a code,
 * `decodeHumanErrorMessage`, then `assertHumanErrorCarries`; a twin
 * carrying none — a plain usage error — asserts nothing of the message
 * (14).
 */
export function assertHumanErrorMessageCarries(
  human: RunResult,
  error: ErrorInformation,
  context: string,
): void {
  if (error.code === null) return;
  assertHumanErrorCarries(
    decodeHumanErrorMessage(human, context),
    error,
    context,
  );
}

// --- the preview comparison with the --json twin --------------------------------------

/**
 * The multiset difference of two lists by key (the module header): the
 * `--json` elements with no human counterpart, and the human elements left
 * over once each `--json` element has taken its counterpart — linear in
 * both.
 */
function multisetDifference<J, H>(
  json: readonly J[],
  human: readonly H[],
  jsonKey: (element: J) => string,
  humanKey: (element: H) => string,
): { readonly missing: J[]; readonly extra: H[] } {
  const queued = new Map<string, number[]>();
  human.forEach((element, index) => {
    const key = humanKey(element);
    const indices = queued.get(key);
    if (indices === undefined) queued.set(key, [index]);
    else indices.push(index);
  });
  const matched = new Set<number>();
  const missing: J[] = [];
  for (const element of json) {
    const at = queued.get(jsonKey(element))?.shift();
    if (at === undefined) missing.push(element);
    else matched.add(at);
  }
  return {
    missing,
    extra: human.filter((_element, index) => !matched.has(index)),
  };
}

/** A mapping pair as one comparable key. */
function pairKey(pair: AppliedMappingPair): string {
  return JSON.stringify([pair.from, pair.to]);
}

/** A mapping pair, rendered for a diagnosis. */
function describePair(pair: AppliedMappingPair): string {
  return `${JSON.stringify(pair.from)} -> ${JSON.stringify(pair.to)}`;
}

/** An edit's class and range as one comparable key. */
function editKey(edit: PreviewEdit): string {
  return `${edit.class}@${String(edit.range.start)}-${String(edit.range.end)}`;
}

/** An edit, rendered for a diagnosis. */
function describeEdit(edit: PreviewEdit): string {
  return `${edit.class} ${String(edit.range.start)}-${String(edit.range.end)}`;
}

/** What the human mapping omits, misplaces, or holds beside the `--json` one. */
function mappingProblems(
  json: readonly AppliedMappingPair[],
  human: readonly HumanMappingPair[],
): string[] {
  const { missing, extra } = multisetDifference(json, human, pairKey, pairKey);
  const problems: string[] = [];
  const left = [...extra];
  for (const pair of missing) {
    const sameFrom = left.findIndex(
      (candidate) => candidate.from === pair.from,
    );
    const at =
      sameFrom !== -1
        ? sameFrom
        : left.findIndex((candidate) => candidate.to === pair.to);
    if (at === -1) {
      problems.push(`the mapping pair ${describePair(pair)} is missing`);
      continue;
    }
    const [near] = left.splice(at, 1);
    problems.push(
      `the mapping pair ${describePair(pair)} is missing — line ${String(near!.line)} pairs ` +
        `${describePair(near!)} instead`,
    );
  }
  for (const pair of left) {
    problems.push(
      `line ${String(pair.line)} lists the mapping pair ${describePair(pair)}, which the ` +
        "--json twin's mapping lacks",
    );
  }
  return problems;
}

/** A file's edits gathered under its path, every listing of it merged. */
interface FileEdits<E extends PreviewEdit> {
  readonly file: PathValue;
  readonly edits: E[];
  readonly lines: number[];
}

/** Files gathered by path in form and bytes (the module header). */
function filesByPath<E extends PreviewEdit>(
  entries: readonly {
    readonly file: PathValue;
    readonly edits: readonly E[];
    readonly line?: number;
  }[],
): Map<string, FileEdits<E>> {
  const byPath = new Map<string, FileEdits<E>>();
  for (const entry of entries) {
    const key = pathKey(entry.file);
    let gathered = byPath.get(key);
    if (gathered === undefined) {
      gathered = { file: entry.file, edits: [], lines: [] };
      byPath.set(key, gathered);
    }
    gathered.edits.push(...entry.edits);
    if (entry.line !== undefined) gathered.lines.push(entry.line);
  }
  return byPath;
}

/** What the human files omit, misplace, or hold beside the `--json` ones. */
function filesProblems(
  json: readonly {
    readonly file: PathValue;
    readonly edits: readonly PreviewEdit[];
  }[],
  human: readonly HumanPreviewFile[],
): string[] {
  const problems: string[] = [];
  const humanFiles = filesByPath(human);
  const jsonFiles = filesByPath(json);
  for (const [key, entry] of jsonFiles) {
    const listed = humanFiles.get(key);
    if (listed === undefined) {
      problems.push(
        `the file ${describePath(entry.file)} is missing, with its ${String(entry.edits.length)} ` +
          `edit(s) ${entry.edits.map(describeEdit).join(", ")}`,
      );
      continue;
    }
    const { missing, extra } = multisetDifference(
      entry.edits,
      listed.edits,
      editKey,
      editKey,
    );
    const left = [...extra];
    for (const edit of missing) {
      let at = -1;
      let distance = Number.POSITIVE_INFINITY;
      left.forEach((candidate, index) => {
        if (candidate.class !== edit.class) return;
        const apart =
          Math.abs(candidate.range.start - edit.range.start) +
          Math.abs(candidate.range.end - edit.range.end);
        if (apart < distance) {
          at = index;
          distance = apart;
        }
      });
      if (at === -1) {
        problems.push(
          `in ${describePath(entry.file)}, the edit ${describeEdit(edit)} is missing`,
        );
        continue;
      }
      const [near] = left.splice(at, 1);
      problems.push(
        `in ${describePath(entry.file)}, the edit ${describeEdit(edit)} is missing — the ` +
          `nearest ${edit.class} edit there, line ${String(near!.line)}, spans ` +
          `${String(near!.range.start)}-${String(near!.range.end)}`,
      );
    }
    for (const edit of left) {
      problems.push(
        `in ${describePath(entry.file)}, line ${String(edit.line)} lists the edit ` +
          `${describeEdit(edit)}, which the --json twin lacks`,
      );
    }
  }
  for (const [key, entry] of humanFiles) {
    if (jsonFiles.has(key)) continue;
    problems.push(
      `line ${String(entry.lines[0] ?? 0)} lists the file ${describePath(entry.file)}, which ` +
        "the --json twin's files lack",
    );
  }
  return problems;
}

/** A derived path of the human delta as a key part. */
function deltaPathKey(path: HumanDeltaPath): string {
  return pathKey(path.path);
}

/** What the human delta omits, misplaces, or holds beside the `--json` one. */
function deltaProblems(
  json: PreviewDeltaDatum,
  human: HumanPreviewDelta,
): string[] {
  if ("unavailable" in json) {
    if ("unavailable" in human) return [];
    return [
      `the --json twin reports the delta unavailable (SPEC 6.6, 14.23), but the human ` +
        `report lists it as a value — ${String(human.generated.length)} generated and ` +
        `${String(human.removed.length)} removed path(s) — never \`delta: unavailable\``,
    ];
  }
  if ("unavailable" in human) {
    return [
      `line ${String(human.line)} reports the delta unavailable where the --json twin ` +
        `carries its two directions — ${String(json.generated.length)} generated and ` +
        `${String(json.removed.length)} removed path(s) (SPEC 6.6, 14.23)`,
    ];
  }
  const problems: string[] = [];
  const generated = multisetDifference(
    json.generated,
    human.generated,
    pathKey,
    deltaPathKey,
  );
  const removed = multisetDifference(
    json.removed,
    human.removed,
    pathKey,
    deltaPathKey,
  );
  const directions = [
    { name: "generated", own: generated, other: removed, otherName: "removed" },
    { name: "removed", own: removed, other: generated, otherName: "generated" },
  ];
  for (const { name, own, other, otherName } of directions) {
    for (const path of own.missing) {
      const at = other.extra.findIndex(
        (candidate) => deltaPathKey(candidate) === pathKey(path),
      );
      if (at === -1) {
        problems.push(`the ${name} path ${describePath(path)} is missing`);
        continue;
      }
      const [misplaced] = other.extra.splice(at, 1);
      problems.push(
        `the path ${describePath(path)}, ${name} in the --json twin, is listed under ` +
          `${otherName} on line ${String(misplaced!.line)}`,
      );
    }
  }
  for (const { name, own } of directions) {
    for (const path of own.extra) {
      problems.push(
        `line ${String(path.line)} lists the ${name} path ${describePath(path.path)}, which ` +
          "the --json twin's delta lacks",
      );
    }
  }
  return problems;
}

/**
 * Assert a decoded human preview report carries the information of its
 * `--json` twin's decoded preview document (TEST-SPEC T6.6-7, T12.0-15;
 * the module header's comparison): its findings as
 * `assertHumanFindingsCarry` compares them, then its plan — none beside a
 * refusal's findings, and otherwise the mapping's every `from` and `to`
 * identity, every file with each of its edits' class and range, and the
 * delta's paths in both directions or its unavailability, order free.
 * Fails diagnosed, naming every datum the human report omits, misplaces,
 * or holds beside its twin's.
 */
export function assertHumanPreviewCarries(
  human: HumanPreviewReport,
  json: PreviewReport,
  context: string,
): void {
  assertHumanFindingsCarry(
    human,
    json.findings.map(findingInformation),
    context,
  );
  const problems: string[] = [];
  const { mapping, files, delta } = json;
  if (mapping === null || files === null || delta === null) {
    if (human.plan !== null) {
      problems.push(
        "the --json twin is a refused preview, reporting its refusal findings alone — " +
          "`mapping`, `files`, and `delta` null (SPEC 6.6, 12.7) — but the human report " +
          `prints a plan (${String(human.plan.mapping.length)} mapping pair(s), ` +
          `${String(human.plan.files.length)} file(s))`,
      );
    }
  } else if (human.plan === null) {
    problems.push(
      "the human report prints no plan — no `mapping:`, `files:`, or `delta:` section — " +
        `where the --json twin reports ${String(mapping.length)} mapping pair(s), ` +
        `${String(files.length)} file(s), and its delta (SPEC 6.6)`,
    );
  } else {
    problems.push(
      ...mappingProblems(mapping, human.plan.mapping),
      ...filesProblems(files, human.plan.files),
      ...deltaProblems(delta, human.plan.delta),
    );
  }
  if (problems.length === 0) return;
  fail(
    `${context}: the human preview report does not carry the information its --json twin ` +
      "carries (TEST-SPEC T6.6-7: the mapping's every `from` and `to` identity; every file " +
      "the operation would rewrite, relocate, or create, with each of its edits' class and " +
      "range as its two pre-operation byte offsets; and the delta's paths in both " +
      "directions, or the delta reported unavailable beside the condition-23 finding — " +
      "decoded by the human-report adapter, H-3; wording, layout, and order free):\n" +
      `${problems.map((problem) => `- ${problem}`).join("\n")}\n` +
      `Human report: ${excerpt(human.text)}`,
  );
}

/**
 * Decode a run's human preview report and assert it carries the
 * information of its `--json` twin's decoded preview document (TEST-SPEC
 * T6.6-7): `decodeHumanPreviewReport`, then `assertHumanPreviewCarries`.
 * Returns the decoded report.
 */
export function assertHumanPreviewReportCarries(
  human: RunResult,
  json: PreviewReport,
  context: string,
): HumanPreviewReport {
  const decoded = decodeHumanPreviewReport(human, context);
  assertHumanPreviewCarries(decoded, json, context);
  return decoded;
}

// --- the performed-report comparison with the --json twin ---------------------------

/**
 * Assert a decoded human performed report carries the applied mapping of
 * its `--json` twin's form-exact performed-operation document (TEST-SPEC
 * T12.0-15; SPEC 6.4, 6.5; the module header's comparison): its pairs as
 * a multiset of `from`/`to` pairs, order free. Fails diagnosed, naming
 * every pair the human report omits or changes and every pair it lists
 * that the twin's mapping lacks.
 */
export function assertHumanPerformedCarries(
  human: HumanPerformedReport,
  json: PerformedOperationReport,
  context: string,
): void {
  const problems = mappingProblems(json.mapping, human.mapping);
  if (problems.length === 0) return;
  fail(
    `${context}: the human report of the performed operation does not carry the applied ` +
      "mapping its --json twin carries (TEST-SPEC T12.0-15: every pair the operation " +
      "journaled, its `from` and `to` identity — SPEC 6.4: a successful rename's report is " +
      "the applied mapping, and a move reports its own as rename does, 6.5 — decoded by the " +
      "human-report adapter, H-3; wording, layout, and order free):\n" +
      `${problems.map((problem) => `- ${problem}`).join("\n")}\n` +
      `Human report: ${excerpt(human.text)}`,
  );
}

/**
 * Decode a run's human performed report and assert it carries the applied
 * mapping of its `--json` twin's decoded performed-operation document
 * (TEST-SPEC T12.0-15): `decodeHumanPerformedReport`, then
 * `assertHumanPerformedCarries`. Returns the decoded report.
 */
export function assertHumanPerformedReportCarries(
  human: RunResult,
  json: PerformedOperationReport,
  context: string,
): HumanPerformedReport {
  const decoded = decodeHumanPerformedReport(human, context);
  assertHumanPerformedCarries(decoded, json, context);
  return decoded;
}

// --- the impact-report comparison with the --json twin ------------------------------

/**
 * One category of one requirement entry, the impact comparison's unit (the
 * module header): the category — `null` for a `--json` entry carrying none
 * — the nodes the entry covers, its deletion, and the category's
 * attribution.
 */
interface ImpactCategoryDatum {
  readonly category: ChangeCategory | null;
  readonly nodes: readonly string[];
  readonly deleted: boolean;
  readonly attributedTo: readonly string[];
}

/**
 * One impacted location of one code group, the impact comparison's other
 * unit (the module header): its witness edge and path.
 */
interface ImpactedCodeDatum {
  readonly group: ImpactCodeGroup;
  readonly location: string;
  readonly edge: GraphEdge;
  readonly path: readonly string[];
}

/**
 * The `--json` twin's category data: one per category of each entry, one
 * category-less datum for an entry carrying none (the module header).
 */
function jsonCategoryData(json: ImpactReport): ImpactCategoryDatum[] {
  return json.requirements.flatMap((entry): ImpactCategoryDatum[] =>
    entry.categories.length === 0
      ? [
          {
            category: null,
            nodes: entry.nodes,
            deleted: entry.deleted,
            attributedTo: [],
          },
        ]
      : entry.categories.map((category) => ({
          category: category.category,
          nodes: entry.nodes,
          deleted: entry.deleted,
          attributedTo: category.attributedTo,
        })),
  );
}

/** The `--json` twin's impacted-code data, both groups. */
function jsonCodeData(json: ImpactReport): ImpactedCodeDatum[] {
  return (["direct", "transitive"] as const).flatMap((group) =>
    json.code[group].map((entry) => ({
      group,
      location: entry.location,
      edge: entry.edge,
      path: entry.path,
    })),
  );
}

/** A multiset of strings as a key part: its elements sorted. */
function multisetKey(values: readonly string[]): string[] {
  return [...values].sort();
}

/**
 * A category datum as one comparable key: the category, the nodes and the
 * attribution as multisets, the deletion (the module header).
 */
function categoryDatumKey(datum: ImpactCategoryDatum): string {
  return JSON.stringify([
    datum.category,
    multisetKey(datum.nodes),
    datum.deleted,
    multisetKey(datum.attributedTo),
  ]);
}

/**
 * An impacted-code datum as one comparable key: the group, the location,
 * the witness edge's source, target, and kind, and the witness path in
 * order (the module header).
 */
function codeDatumKey(datum: ImpactedCodeDatum): string {
  return JSON.stringify([
    datum.group,
    datum.location,
    datum.edge.from,
    datum.edge.to,
    datum.edge.kind,
    datum.path,
  ]);
}

/** The strings of `of` missing from `from`, as multisets. */
function missingStrings(
  of: readonly string[],
  from: readonly string[],
): string[] {
  const left = [...from];
  const missing: string[] = [];
  for (const value of of) {
    const at = left.indexOf(value);
    if (at === -1) missing.push(value);
    else left.splice(at, 1);
  }
  return missing;
}

/** A category datum, rendered for a diagnosis. */
function describeCategoryDatum(datum: ImpactCategoryDatum): string {
  const entry =
    `the ${datum.nodes.length === 1 ? "entry" : "collapsed entry"} ` +
    `${JSON.stringify(datum.nodes)}${datum.deleted ? " (deleted)" : ""}`;
  return datum.category === null
    ? `${entry}, carrying no category`
    : `the ${datum.category} category of ${entry}, attributed to ` +
        JSON.stringify(datum.attributedTo);
}

/** What the human category line holds differently from the `--json` datum, named. */
function describeCategoryDifference(
  json: ImpactCategoryDatum,
  human: HumanImpactCategoryLine,
): string {
  const parts: string[] = [];
  if (json.category !== human.category) {
    parts.push(
      `the category ${human.category} where the --json twin carries ${String(json.category)}`,
    );
  }
  const missingNodes = missingStrings(json.nodes, human.nodes);
  const extraNodes = missingStrings(human.nodes, json.nodes);
  if (missingNodes.length > 0) {
    parts.push(`missing node(s) ${JSON.stringify(missingNodes)}`);
  }
  if (extraNodes.length > 0) {
    parts.push(`node(s) the --json entry lacks ${JSON.stringify(extraNodes)}`);
  }
  if (json.deleted !== human.deleted) {
    parts.push(
      json.deleted
        ? "no deletion mark where the --json entry is deleted, reported under its baseline identity"
        : "a deletion mark the --json entry lacks",
    );
  }
  const missingAttribution = missingStrings(
    json.attributedTo,
    human.attributedTo,
  );
  const extraAttribution = missingStrings(
    human.attributedTo,
    json.attributedTo,
  );
  if (missingAttribution.length > 0) {
    parts.push(`missing attribution ${JSON.stringify(missingAttribution)}`);
  }
  if (extraAttribution.length > 0) {
    parts.push(
      `attribution the --json category lacks ${JSON.stringify(extraAttribution)}`,
    );
  }
  return parts.join("; ");
}

/**
 * What the human category lines omit, change, misplace, or hold beside the
 * `--json` twin's category data (the module header).
 */
function categoryProblems(
  json: readonly ImpactCategoryDatum[],
  human: readonly HumanImpactCategoryLine[],
): string[] {
  const { missing, extra } = multisetDifference(
    json,
    human,
    categoryDatumKey,
    categoryDatumKey,
  );
  const problems: string[] = [];
  const left = [...extra];
  for (const datum of missing) {
    if (datum.category === null) {
      problems.push(
        `the --json twin reports ${describeCategoryDatum(datum)}, which no line beneath a ` +
          "category — the human report's grouping (SPEC 9.3) — can carry",
      );
      continue;
    }
    // The nearest line: one of the same category sharing the most nodes,
    // else one covering the same nodes under another category.
    let at = -1;
    let shared = 0;
    left.forEach((candidate, index) => {
      if (candidate.category !== datum.category) return;
      const common =
        candidate.nodes.length -
        missingStrings(candidate.nodes, datum.nodes).length;
      if (common > shared) {
        at = index;
        shared = common;
      }
    });
    if (at === -1) {
      const nodes = JSON.stringify(multisetKey(datum.nodes));
      at = left.findIndex(
        (candidate) => JSON.stringify(multisetKey(candidate.nodes)) === nodes,
      );
    }
    if (at === -1) {
      problems.push(`${describeCategoryDatum(datum)} is missing`);
      continue;
    }
    const [near] = left.splice(at, 1);
    problems.push(
      `${describeCategoryDatum(datum)} is missing — line ${String(near!.line)} lists ` +
        `${describeCategoryDatum(near!)} instead: ${describeCategoryDifference(datum, near!)}`,
    );
  }
  for (const line of left) {
    problems.push(
      `line ${String(line.line)} lists ${describeCategoryDatum(line)}, which the --json twin lacks`,
    );
  }
  return problems;
}

/** An impacted-code datum, rendered for a diagnosis. */
function describeCodeDatum(datum: ImpactedCodeDatum): string {
  return (
    `the ${datum.group === "direct" ? "directly" : "transitively"} impacted location ` +
    `${JSON.stringify(datum.location)} via its ${datum.edge.kind} edge ` +
    `${JSON.stringify(datum.edge.from)} -> ${JSON.stringify(datum.edge.to)}, witness path ` +
    JSON.stringify(datum.path)
  );
}

/** What the human impacted-code line holds differently from the `--json` datum, named. */
function describeCodeDifference(
  json: ImpactedCodeDatum,
  human: HumanImpactedCodeLine,
): string {
  const parts: string[] = [];
  if (json.group !== human.group) {
    parts.push(
      `listed in the ${human.group === "direct" ? "directly" : "transitively"} impacted group ` +
        `where the --json twin lists it in the ${json.group === "direct" ? "directly" : "transitively"} impacted one`,
    );
  }
  if (json.edge.kind !== human.edge.kind) {
    parts.push(
      `the edge kind ${human.edge.kind} where the --json twin carries ${json.edge.kind}`,
    );
  }
  if (json.edge.from !== human.edge.from) {
    parts.push(
      `the edge from ${JSON.stringify(human.edge.from)} (the location itself, as the layout ` +
        `prints it) where the --json twin's runs from ${JSON.stringify(json.edge.from)}`,
    );
  }
  if (json.edge.to !== human.edge.to) {
    parts.push(
      `the edge target ${JSON.stringify(human.edge.to)} where the --json twin carries ` +
        JSON.stringify(json.edge.to),
    );
  }
  if (JSON.stringify(json.path) !== JSON.stringify(human.path)) {
    parts.push(
      `the witness path ${JSON.stringify(human.path)} where the --json twin carries ` +
        JSON.stringify(json.path),
    );
  }
  return parts.join("; ");
}

/**
 * What the human impacted-code lines omit, change, misplace, or hold beside
 * the `--json` twin's impacted-code data (the module header).
 */
function codeProblems(
  json: readonly ImpactedCodeDatum[],
  human: readonly HumanImpactedCodeLine[],
): string[] {
  const { missing, extra } = multisetDifference(
    json,
    human,
    codeDatumKey,
    codeDatumKey,
  );
  const problems: string[] = [];
  const left = [...extra];
  for (const datum of missing) {
    let at = left.findIndex(
      (candidate) =>
        candidate.group === datum.group &&
        candidate.location === datum.location,
    );
    if (at === -1) {
      at = left.findIndex((candidate) => candidate.location === datum.location);
    }
    if (at === -1) {
      problems.push(`${describeCodeDatum(datum)} is missing`);
      continue;
    }
    const [near] = left.splice(at, 1);
    problems.push(
      `${describeCodeDatum(datum)} is missing — line ${String(near!.line)} lists ` +
        `${describeCodeDatum(near!)} instead: ${describeCodeDifference(datum, near!)}`,
    );
  }
  for (const line of left) {
    problems.push(
      `line ${String(line.line)} lists ${describeCodeDatum(line)}, which the --json twin lacks`,
    );
  }
  return problems;
}

/**
 * Assert a decoded human impact report carries the information of its
 * `--json` twin's decoded impact report (TEST-SPEC T12.0-15; SPEC 5.6,
 * 9.1–9.3; the module header's comparison): each category of each entry —
 * the nodes the entry covers, its deletion, and the category's attribution
 * — and each impacted location of each group with its witness edge and
 * path, as multisets, order free. Fails diagnosed, naming every datum the
 * human report omits, changes, misplaces, or lists beside its twin's.
 */
export function assertHumanImpactCarries(
  human: HumanImpactReport,
  json: ImpactReport,
  context: string,
): void {
  const problems = [
    ...categoryProblems(jsonCategoryData(json), human.categories),
    ...codeProblems(jsonCodeData(json), human.code),
  ];
  if (problems.length === 0) return;
  fail(
    `${context}: the human impact report does not carry the information its --json twin ` +
      "carries (TEST-SPEC T12.0-15: each category with its attribution, the collapsed " +
      "chains, deleted nodes under their baseline identities, and each impacted location " +
      "with its witness edge and path — SPEC 5.6, 9.1, 9.3 — decoded by the human-report " +
      "adapter, H-3; wording, layout, and order free):\n" +
      `${problems.map((problem) => `- ${problem}`).join("\n")}\n` +
      `Human report: ${excerpt(human.text)}`,
  );
}

/**
 * Decode a run's human impact report and assert it carries the information
 * of its `--json` twin's decoded impact report (TEST-SPEC T12.0-15):
 * `decodeHumanImpactReport`, then `assertHumanImpactCarries`. Returns the
 * decoded report.
 */
export function assertHumanImpactReportCarries(
  human: RunResult,
  json: ImpactReport,
  context: string,
): HumanImpactReport {
  const decoded = decodeHumanImpactReport(human, context);
  assertHumanImpactCarries(decoded, json, context);
  return decoded;
}

// --- the review list and status comparisons with the --json twin --------------------

/**
 * A count by `status` (SPEC 10.3), a status a record or a report holds no
 * count for reading as 0 (the module header).
 */
function countOf(
  counts: Readonly<Partial<Record<string, number>>> | null,
  status: ItemStatus,
): number {
  return counts?.[status] ?? 0;
}

/** Every status whose count the two differ in, named. */
function countDifferences(
  json: Readonly<Record<string, number>>,
  human: HumanStatusCounts | null,
  what: string,
): string[] {
  return ITEM_STATUSES.flatMap((status) => {
    const expected = countOf(json, status);
    const printed = countOf(human, status);
    return expected === printed
      ? []
      : [
          `${what} under ${status} is ${String(printed)} where the --json twin's is ` +
            String(expected),
        ];
  });
}

/** A listed session, rendered for a diagnosis. */
function describeSession(entry: {
  readonly name: string;
  readonly corrupt: boolean;
  readonly strategy?: string | null;
  readonly counts?: Readonly<Partial<Record<string, number>>>;
}): string {
  if (entry.corrupt)
    return `the session ${JSON.stringify(entry.name)} (corrupt)`;
  const counts = ITEM_STATUSES.map(
    (status) => `${status} ${String(countOf(entry.counts ?? null, status))}`,
  ).join(", ");
  return (
    `the session ${JSON.stringify(entry.name)} (${String(entry.strategy)}; ` +
    `${counts})`
  );
}

/**
 * The matches of the `--json` twin's elements among the human report's,
 * each the first unmatched one bearing its key — linear in both — the
 * twin's elements without one, and the human elements left over.
 */
function matchByKey<J, H>(
  json: readonly J[],
  human: readonly H[],
  jsonKey: (element: J) => string,
  humanKey: (element: H) => string,
): {
  readonly pairs: readonly { readonly json: J; readonly human: H }[];
  readonly missing: readonly J[];
  readonly extra: readonly H[];
} {
  const queued = new Map<string, number[]>();
  human.forEach((element, index) => {
    const key = humanKey(element);
    const indices = queued.get(key);
    if (indices === undefined) queued.set(key, [index]);
    else indices.push(index);
  });
  const matched = new Set<number>();
  const pairs: { readonly json: J; readonly human: H }[] = [];
  const missing: J[] = [];
  for (const element of json) {
    const at = queued.get(jsonKey(element))?.shift();
    if (at === undefined) {
      missing.push(element);
      continue;
    }
    matched.add(at);
    pairs.push({ json: element, human: human[at]! });
  }
  return {
    pairs,
    missing,
    extra: human.filter((_element, index) => !matched.has(index)),
  };
}

/**
 * Where the matched elements' order in the human report — by the lines
 * they stand on — differs from the `--json` twin's, named (the module
 * header: 10.7 fixes the order of a listing and of a status report for the
 * report itself).
 */
function orderProblem<J, H extends { readonly line: number }>(
  pairs: readonly { readonly json: J; readonly human: H }[],
  key: (element: J) => string,
  what: string,
  order: string,
): string[] {
  const jsonOrder = pairs.map((pair) => key(pair.json));
  const humanOrder = [...pairs]
    .sort((a, b) => a.human.line - b.human.line)
    .map((pair) => key(pair.json));
  if (JSON.stringify(humanOrder) === JSON.stringify(jsonOrder)) return [];
  return [
    `the human report lists the ${what} in the order ${JSON.stringify(humanOrder)} where ` +
      `the --json twin lists them in the order ${JSON.stringify(jsonOrder)} — SPEC 10.7 fixes ` +
      `the order for the report itself, ${order}`,
  ];
}

/**
 * What the human listing's session lines omit, change, misorder, or list
 * beside the `--json` twin's sessions (the module header).
 */
function sessionListProblems(
  json: readonly SessionListEntry[],
  human: readonly HumanSessionListEntry[],
): string[] {
  const { pairs, missing, extra } = matchByKey(
    json,
    human,
    (entry) => entry.name,
    (entry) => entry.name,
  );
  const problems: string[] = missing.map(
    (entry) =>
      `${describeSession(entry)} is missing — no session line names it (SPEC 10.7: \`list\` ` +
      "reports every session)",
  );
  for (const pair of pairs) {
    const where = `line ${String(pair.human.line)} (the session ${JSON.stringify(pair.json.name)})`;
    if (pair.json.corrupt !== pair.human.corrupt) {
      problems.push(
        pair.json.corrupt
          ? `${where} lists the session with fields where the --json twin reports it corrupt, ` +
              "by name in place of its fields (SPEC 10.7)"
          : `${where} reports the session corrupt where the --json twin lists it with its ` +
              "strategy and counts",
      );
      continue;
    }
    if (pair.json.corrupt) continue;
    if (pair.json.strategy !== pair.human.strategy) {
      problems.push(
        `${where} lists the strategy ${JSON.stringify(pair.human.strategy)} where the --json ` +
          `twin's is ${JSON.stringify(pair.json.strategy)}`,
      );
    }
    problems.push(
      ...countDifferences(
        pair.json.counts,
        pair.human.counts,
        `${where}: its item count by stored status`,
      ),
    );
  }
  for (const entry of extra) {
    problems.push(
      `line ${String(entry.line)} lists ${describeSession(entry)}, which the --json twin lacks`,
    );
  }
  problems.push(
    ...orderProblem(
      pairs,
      (entry) => entry.name,
      "sessions",
      "byte order of session name",
    ),
  );
  return problems;
}

/**
 * Assert a decoded human `review list` report carries the information of
 * its `--json` twin's decoded listing (TEST-SPEC T12.0-15; SPEC 10.7,
 * 14.21; the module header's comparison): every session, matched by name,
 * corrupt exactly where the twin's is, and a healthy one's strategy and
 * item counts by stored status, each status's count equal (one printed or
 * recorded with none reading as 0); the sessions in the twin's order (10.7
 * fixes it: byte order of session name); and the listing's findings — each
 * corrupt session's condition 21 — as `assertHumanFindingsCarry` compares
 * findings, order free. Fails diagnosed, naming every datum the human
 * report omits, changes, misorders, or lists beside its twin's.
 */
export function assertHumanSessionListCarries(
  human: HumanSessionListReport,
  json: SessionListReport,
  context: string,
): void {
  const problems = sessionListProblems(json.sessions, human.sessions);
  if (problems.length > 0) {
    fail(
      `${context}: the human \`review list\` report does not carry the listing its --json ` +
        "twin carries (TEST-SPEC T12.0-15: every session's name with its strategy and item " +
        "counts by stored status, or its corruption in their place, in the order 10.7 fixes, " +
        "and each corrupt session's condition-21 finding — SPEC 10.7, 14.21 — decoded by the " +
        "human-report adapter, H-3; wording and layout free):\n" +
        `${problems.map((problem) => `- ${problem}`).join("\n")}\n` +
        `Human report: ${excerpt(human.text)}`,
    );
  }
  assertHumanFindingsCarry(
    { findings: human.findings },
    (json.findings ?? []).map(findingInformation),
    `${context} — the listing's findings`,
  );
}

/**
 * Decode a run's human `review list` report and assert it carries the
 * information of its `--json` twin's decoded listing (TEST-SPEC T12.0-15):
 * `decodeHumanSessionListReport`, then `assertHumanSessionListCarries`.
 * Returns the decoded report.
 */
export function assertHumanSessionListReportCarries(
  human: RunResult,
  json: SessionListReport,
  context: string,
): HumanSessionListReport {
  const decoded = decodeHumanSessionListReport(human, context);
  assertHumanSessionListCarries(decoded, json, context);
  return decoded;
}

/** A status row, rendered for a diagnosis. */
function describeStatusRow(row: SessionStatusRow): string {
  return (
    `the item ${JSON.stringify(row.id)} (${row.kind} of ${JSON.stringify(row.scope)}, ` +
    `${row.status}, ${row.blocked ? "blocked" : "unblocked"})`
  );
}

/**
 * What the human status report's rows omit, change, misorder, or list
 * beside the `--json` twin's rows (the module header).
 */
function statusRowProblems(
  json: readonly SessionStatusRow[],
  human: readonly HumanStatusRow[],
): string[] {
  const { pairs, missing, extra } = matchByKey(
    json,
    human,
    (row) => row.id,
    (row) => row.id,
  );
  const problems: string[] = missing.map(
    (row) =>
      `${describeStatusRow(row)} is missing — no row names it (SPEC 10.7: \`status\` reports ` +
      "the session's items)",
  );
  for (const pair of pairs) {
    const where = `line ${String(pair.human.line)} (the item ${JSON.stringify(pair.json.id)})`;
    if (pair.json.kind !== pair.human.kind) {
      problems.push(
        `${where} prints the kind ${pair.human.kind} where the --json twin's is ${pair.json.kind}`,
      );
    }
    if (pair.json.scope !== pair.human.scope) {
      problems.push(
        `${where} prints the scope ${JSON.stringify(pair.human.scope)} where the --json ` +
          `twin's is ${JSON.stringify(pair.json.scope)}`,
      );
    }
    if (pair.json.status !== pair.human.status) {
      problems.push(
        `${where} prints the status ${pair.human.status} where the --json twin's is ` +
          `${pair.json.status} (read-time invalidation applied, SPEC 10.4)`,
      );
    }
    if (pair.json.blocked !== pair.human.blocked) {
      problems.push(
        `${where} prints the item ${pair.human.blocked ? "blocked" : "unblocked"} where the ` +
          `--json twin reports it ${pair.json.blocked ? "blocked" : "unblocked"} (SPEC 10.3)`,
      );
    }
  }
  for (const row of extra) {
    problems.push(
      `line ${String(row.line)} prints a row for the item ${JSON.stringify(row.id)}, which ` +
        "the --json twin lacks",
    );
  }
  problems.push(
    ...orderProblem(pairs, (row) => row.id, "items", "item order (10.5, 10.6)"),
  );
  return problems;
}

/**
 * Assert a decoded human `review status` report carries the information of
 * its `--json` twin's decoded status report (TEST-SPEC T12.0-15; SPEC 10.7;
 * the module header's comparison): every item row, matched by id, with its
 * kind, scope node, status, and blocked state equal; the rows in the twin's
 * order (10.7 fixes it: item order); and the totals by status, each
 * status's total equal (one printed or reported with none reading as 0).
 * Fails diagnosed, naming every datum the human report omits, changes,
 * misorders, or lists beside its twin's.
 */
export function assertHumanSessionStatusCarries(
  human: HumanSessionStatusReport,
  json: SessionStatusReport,
  context: string,
): void {
  const problems = [
    ...statusRowProblems(json.items, human.items),
    ...countDifferences(
      json.totals,
      human.totals,
      human.totals === null
        ? "the report prints no totals line, so its total"
        : "the total",
    ),
  ];
  if (problems.length === 0) return;
  fail(
    `${context}: the human \`review status\` report does not carry the information its ` +
      "--json twin carries (TEST-SPEC T12.0-15: every item's id, kind, scope, status, and " +
      "blocked state in the order 10.7 fixes, and the totals by status — SPEC 10.7 — " +
      "decoded by the human-report adapter, H-3; wording and layout free):\n" +
      `${problems.map((problem) => `- ${problem}`).join("\n")}\n` +
      `Human report: ${excerpt(human.text)}`,
  );
}

/**
 * Decode a run's human `review status` report and assert it carries the
 * information of its `--json` twin's decoded status report (TEST-SPEC
 * T12.0-15): `decodeHumanSessionStatusReport`, then
 * `assertHumanSessionStatusCarries`. Returns the decoded report.
 */
export function assertHumanSessionStatusReportCarries(
  human: RunResult,
  json: SessionStatusReport,
  context: string,
): HumanSessionStatusReport {
  const decoded = decodeHumanSessionStatusReport(human, context);
  assertHumanSessionStatusCarries(decoded, json, context);
  return decoded;
}
