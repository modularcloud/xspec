// The review session model and stored form (SPEC 10.1–10.3).
//
// SPEC 10.1: a review session is stored at `.xspec/reviews/<session-name>.json`
// as a plain, deterministic file — a durable task ledger (13.4), written only
// by the mutating `review` subcommands and never regenerated. A session name
// is one or more characters of `A–Z a–z 0–9 . _ -`, never beginning with `.`;
// names are case-sensitive, with `review create` alone refusing a name that
// matches an existing session's ignoring ASCII case (10.7). A session file
// that is not a plain file, cannot be parsed, or violates a session invariant
// is corrupt (14.21).
//
// Stored document (this implementation's design; SPEC.md fixes the
// information, not the concrete shape) — one canonical-JSON document
// (canonical-json.ts: sorted keys, two-space indentation, trailing
// newline), its `decompositions` and `items` laid out one element per line
// ("Stored layout", below):
//
//   {
//     "creationParameters": {"base": <commit>} | {} | {"profile": {…}},
//     "decompositions": [
//       null
//
//       ,{"kind":"subtree-coherence","scope":<ref>}
//
//     ],
//     "items": [
//       <item>
//
//       ,<item>
//
//     ],
//     "journalLength": <n>,
//     "references": [<ref>, …],
//     "states": [<node state>, …],
//     "strategy": "path-blocks" | "audit" | "coverage",
//     "texts": [<text>, …],
//     "version": 5
//   }
//
// where every node reference <ref> is a canonical identity key (identity
// policy below). The three tables hold what the items record when the
// session is created, each value once (`SessionTables`; later records,
// below): `references` every canonical reference an item
// holds, `states` every distinct recorded node state (`{"hashes": {…},
// "present": true}` or `{"hashes": "absent", "present": false}`, SPEC
// 10.4), and `texts` every distinct snapshot text. An item refers to them
// by index, so a node's identity — whose spelling grows with its depth —
// is spelled once per session, not once per item and role, and a hash
// pair or text recorded by many items is stored once: a session grows
// with what its items record, never with how often they repeat it (an
// n-deep section chain's audit items, each recording ~n nodes, are index
// runs over a table of n + 1 references rather than O(n³) bytes of
// spelled identities). An index list is a string of space-separated
// tokens — `i`, `i-j` for the ascending run i … j, and, in a state or
// text list, `i*k` for i repeated k times (`encodeIndexList`) — so runs
// of consecutive indices, which document-order numbering makes common,
// take one token.
//
// Stably keyed (SPEC 13.4: durable files "are line-oriented or stably
// keyed so that concurrent additions merge textually"): the tables are
// fixed by the write that creates the session (`creationTables`), and
// every later write stores them byte for byte unchanged — no entry
// appended, reordered, or dropped, even one no item names any more. No
// write after creation assigns a table position, so every copy of a
// session, on every branch, holds the same tables, and an index names the
// same value in all of them. Whatever an item comes to record that the
// tables lack — a reference first met after creation (a node joining the
// item's scope, context, or origin), a node state (SPEC 10.4), a snapshot
// text (10.7) — is kept inside that item's own entry, in its own
// `references`, `states`, and `texts` members (each omitted when empty),
// which its index lists address past the session tables' lengths: index i
// names entry i of the session's table while i is below that table's
// length n, and entry i − n of the item's own table from n on. An item's
// own tables are built in an order that is a function of its value alone
// (`itemEntry`), so a write stores every item it leaves unchanged with
// unchanged bytes: a `no-change` or `skipped` resolve rewrites the
// resolved item's entry alone (with `journalLength`, when the journal
// grew), an `updated` resolve's re-derivation and a `split` the entries of
// the items they add or reassign (with, for a `split`, the original's
// entry and the decomposition's). Writes changing different items —
// resolutions on different branches, each recording new node states and
// texts after source edits — therefore change disjoint item entries, each
// on a line of its own ("Stored layout", below), and merge textually. An
// item changed on both sides conflicts on its own line alone: either
// side's line, taken whole, reads back that side's resolution, and both
// sides' lines kept side by side read as corrupt (duplicate `id`, SPEC
// 10.1), never as a silently different resolution. The cost, accepted: a
// value that many items record anew after creation (a node's state after
// an edit, recorded by each item resolved over it) is stored once per
// recording item rather than once per session.
//
// Stored layout (SPEC 13.4: durable files "are line-oriented or stably
// keyed so that concurrent additions merge textually"; 10.1: "a plain,
// deterministic file"): each element of `items` and of `decompositions`
// stands on a line of its own — compact canonical JSON, keys sorted, no
// newline inside (`CanonicalJsonOptions.lineArrays` of canonical-json.ts)
// — the first bare and every later one led by its comma, and an empty line
// follows each; every other member keeps the pretty layout. So an item or
// decomposition a write adds is one line, unique by the id or scope it
// holds, which git's conflict refinement can neither split nor fuse with
// another; lines two branches append after the last element merge cleanly
// where git's diff sets them apart (one side's sliding onto its own change
// of the last element, an empty line between them), and otherwise meet as
// a conflict whose keep-both resolution — `git merge-file --union`, or a
// `merge=union` attribute: ours' lines, then theirs' — is still a valid
// array, every appended line bringing its own comma; and a change to one
// element never stands on a line next to a change to another (git meets
// changes to adjacent lines as a conflict), an empty line lying between.
// `decompositions` opens with a fixed head element, `null`, so that every
// recorded decomposition is a comma-led line even where the session
// recorded none before; the head is read as exactly that, never as a
// decomposition (`parseDecompositions`). Items keep their stored order: a
// re-derivation (SPEC 10.5) keeps every existing item where it stands,
// rewriting a matched item's line only where its entry changes, and
// appends new items after the last; a `split` (10.7) appends its
// decomposition last, puts the scope root's `parent-consistency` item on
// the original's line where the split creates that item, and removes the
// original's line only where that item already existed
// (src/core/review-derive.ts, `splitItemDecomposition`). Two branches'
// additions to one session therefore merge — cleanly, or by that
// keep-both resolution — into a valid session holding both sides'
// additions, as the journal's lines do (SPEC 6.1), while resolutions of
// different items, changing different lines, merge cleanly. What cannot
// merge is never silently different: an item changed on both branches
// conflicts on its own line, its keep-both holding the item twice
// (duplicate `id`, SPEC 10.1); an item's line removed beside a change of
// the line after it conflicts, its keep-both corrupt (that item twice) or
// unparseable (the removed line the first, its successor's comma kept).
// Reading is layout-free — any JSON whitespace reads alike — so a session
// staged or rewritten in another layout reads as the same session.
//
// Item ids (SPEC 10.2: unique within the session, never containing
// U+FFFD; 10.7: a `split` original's id is never reused; 13.4: concurrent
// additions merge textually): every item a write adds — at `create`, by a
// re-derivation (10.5), or by a `split` (10.7) — takes an id derived from
// what is added, never from a counter both branches of a history advance
// alike: `r` and the first 16 lowercase hex digits of the SHA-256 of the
// item's kind and its scope node's stored canonical reference, under the
// injective framing of src/core/hash.ts (`ItemIdAllocator`). The at-most-one
// invariant makes that pair unique within a session (10.1), a decomposed
// pair never enters it again (10.5, 10.7), and a canonical reference never
// changes as the journal grows (identity policy below) — so a derived id is
// unique, never reused, and the same on every branch that adds the same
// item, while two branches adding different items assign different keys,
// whose lines a keep-both resolution holds side by side as a valid session
// ("Stored layout"). Should a derived id already name another item of the
// session, or equal one a recorded decomposition's kind and scope node
// derive (the removed original's, which stays retired), it extends
// deterministically by further digest digits. The session stores no id
// counter, so an addition rewrites no member beyond the item entries it
// adds or reassigns (and, as every write may, `journalLength`; a `split`,
// the original's entry and the decomposition it appends). Stored ids are
// opaque — nothing checks an id against its derivation: formats 1–3 hold
// their counter's `item-<n>` ids, which every later write keeps, and the
// leading `r`, outside the hex digits, keeps every derived id distinct
// from those and from every hash value.
//
// Each item carries exactly the fields of SPEC 10.2 — `id`, `kind`,
// `scope` (stored as its root, `scope`, and the scope nodes beneath the
// root as last assigned, `scopeDescendants`, SPEC 10.4), `context`,
// `reason`, `origin`, `baseline`, `current`, `status`, optional `note`,
// `blockedBy` — plus the recorded context set
// (`recordedContext`: the context nodes recorded with `current`, SPEC 10.4)
// and the recorded text snapshots (`baselineTexts`, `derivedTexts`) that
// keep items actionable after the referenced nodes are edited, moved, or
// deleted (SPEC 10.2, 10.7: an absent node's text is its value in the most
// recent graph state that contained it, among the item's `baseline` state
// and the states under which mutating subcommands derived or resolved the
// item with that node among its nodes). A snapshot holds, per node, only
// the text kinds the payload rule of SPEC 10.7 presents for the node's
// roles in the item (`scopeTextKind`, `contextTextKind`; an origin's own
// text, its before side, in `baselineTexts` alone) — never both kinds of
// every node, and nothing for the scope nodes beneath a root, which carry
// no text — so a session stays proportionate to what its payloads present.
// Stored, an item's `scope` is a reference index; `scopeDescendants`,
// `context`, `origin`, and `recordedContext` are reference lists in their
// own order; `baseline` and `current` are `{"nodes": <reference list>,
// "states": <state list>}`, the node at each position holding the state
// at the same position; and each text table is `{"ownText": <entries>,
// "subtreeText": <entries>}`, entries `{"nodes": <reference list>,
// "texts": <text list>}` aligned the same way. A state or text table's
// nodes are distinct and stored in byte order of their references (SPEC
// 12.0), the order the in-memory tables take them in — the order a
// format-1 file's sorted keys gave them, which human renderings follow.
//
// Earlier formats are still read (`validateSessionDocument`), so sessions
// written before format 5 stay valid; every write stores format 5, so a
// session's first write after an earlier format's changes its whole
// layout once. Format 4 — format 5's document at `version` 4, its
// `decompositions` the recorded ones alone, with no head, and every member
// laid out pretty (each item spread over many lines) — is read as stored.
// Format 3 — format 4's document at `version` 3 with one member more,
// `nextItemId`, the counter its writes took `item-<n>` ids from — is read
// with that member checked as before and then unused: its items keep their
// ids, and every item added later takes a derived one (above). Format 2 —
// format 3's document at `version` 2, with no item tables of its own,
// whose writes extended the tables — is read with its tables as stored,
// which every later write keeps, fixed from then on. Format 1 — format 2's
// document without the tables, every reference spelled out and
// `baseline`/`current` and the text tables keyed by reference — is read
// with the tables its items would have had at creation, built by the
// creating traversal over its items as read (`creationTables`), so two
// copies of one format-1 file first written apart store identical tables
// and differ only inside the items each write changed.
//
// Identity policy: every stored node reference — an item's `scope` and
// `scopeDescendants` entries, its `recordedContext`, `context`, and
// `origin` entries, the nodes of `baseline`/`current` and
// of `baselineTexts`/`derivedTexts` (each, in formats 2 to 5, the
// reference its index names), and each recorded decomposition's
// `scope` — is a canonical identity (SPEC 5.4) in the injective key
// encoding of src/core/journal.ts (`<position>:<identity>`,
// `encodeCanonicalIdentity`). A node's canonical identity never changes as
// the journal grows (SPEC 6.1: append-only), so byte equality of stored
// references IS the canonical comparison SPEC 10.4 requires wherever review
// compares or matches recorded nodes — item matching, decomposition
// matching, and the at-most-one invariant (10.1, 10.5) are checked
// byte-wise here, journal-free. Two canonically distinct nodes may come to
// share one forward-mapped spelling (a spelling vacated by a manual
// deletion, SPEC 6.6, and later recaptured by a journaled rename), which is
// exactly why spellings are never the stored or matching key. Reads derive
// each reference's current spelling — the recorded identity mapped forward
// through the journal (SPEC 10.4, 6.3) — for presentation and graph
// lookups only (src/core/review-state.ts).
//
// `journalLength` records the journal's entry count when the session was
// last written — the write-moment bound: every stored reference's canonical
// position is <= it (positions come from walks over that journal or a
// prefix of it), and parsing enforces the bound as a session invariant. It
// plays no identity-mapping role.
//
// This module is pure (IMPLEMENTATION Architecture): the model, name rules,
// status semantics, parsing, validation, and serialization take bytes and
// values. File I/O — reading `.xspec/reviews/`, classifying occupants,
// writing session files — lives in src/workspace/reviews.ts.

import { isWellFormedArgumentValue } from "./argument-value.js";
import { byteOrderedSet, compareBytes } from "./bytes.js";
import { canonicalJson, compactJson } from "./canonical-json.js";
import type { JsonObject, JsonValue } from "./canonical-json.js";
import { parseCanonicalIdentity } from "./journal.js";
import type {
  Configuration,
  ConfiguredGroup,
  CoverageProfile,
  DependencyEdgeKind,
} from "./config.js";
import { DEPENDENCY_EDGE_KINDS, dependencyKindSet } from "./config.js";
import type { Finding } from "./findings.js";
import { pathFinding } from "./findings.js";
import { compileGlob } from "./glob.js";
import { hashComponents } from "./hash.js";

/** SPEC 10.1: the reviews directory under the workspace root. */
export const REVIEWS_DIRECTORY = ".xspec/reviews";

/** The session file's workspace-relative path (SPEC 10.1). */
export function sessionFilePath(name: string): string {
  return `${REVIEWS_DIRECTORY}/${name}.json`;
}

// ---------------------------------------------------------------------------
// Session names (SPEC 10.1)
// ---------------------------------------------------------------------------

// The session-name form itself (`isValidSessionName`, `sessionNameProblem`)
// lives in ./session-name.ts, import-free, so the argument parser judges it
// without loading this module (SPEC 12.0 syntax class).

/** ASCII case folding (A–Z → a–z); no other character is touched. */
export function asciiCaseFold(text: string): string {
  let folded = "";
  for (const character of text) {
    const code = character.charCodeAt(0);
    folded +=
      code >= 0x41 && code <= 0x5a
        ? String.fromCharCode(code + 0x20)
        : character;
  }
  return folded;
}

/**
 * SPEC 10.1: every existing session name that `candidate` matches ignoring
 * ASCII case — the byte-identical name included, when it exists — in the
 * order `existing` lists them. `review create` treats `candidate` as the
 * name of each such existing session (10.1: "of each, where several
 * sessions so match"; 10.7); every other subcommand matches names exactly,
 * byte-wise (SPEC 12.0).
 */
export function sessionNamesMatchingIgnoringAsciiCase(
  existing: Iterable<string>,
  candidate: string,
): string[] {
  const folded = asciiCaseFold(candidate);
  const matches: string[] = [];
  for (const name of existing) {
    if (asciiCaseFold(name) === folded) {
      matches.push(name);
    }
  }
  return matches;
}

// ---------------------------------------------------------------------------
// Statuses (SPEC 10.3) and item kinds (SPEC 10.2, 10.4–10.7)
// ---------------------------------------------------------------------------

/** SPEC 10.3: the five item statuses. */
export const ITEM_STATUSES = [
  "unresolved",
  "updated",
  "no-change",
  "skipped",
  "invalidated",
] as const;

export type ItemStatus = (typeof ITEM_STATUSES)[number];

/** SPEC 10.7: the statuses `resolve --status` accepts. */
export const RESOLVE_STATUSES = ["updated", "no-change", "skipped"] as const;

export type ResolveStatus = (typeof RESOLVE_STATUSES)[number];

/**
 * SPEC 10.3: an item is resolved when its status is `updated`, `no-change`,
 * or `skipped`; `unresolved` and `invalidated` items need review.
 */
export function isResolvedStatus(status: ItemStatus): boolean {
  return status === "updated" || status === "no-change" || status === "skipped";
}

/** SPEC 10.3: `unresolved` and `invalidated` items need review. */
export function statusNeedsReview(status: ItemStatus): boolean {
  return !isResolvedStatus(status);
}

/** The built-in item kinds (SPEC 10.4–10.6, 10.7 coverage sessions). */
export const ITEM_KINDS = [
  "subtree-coherence",
  "parent-consistency",
  "dependency-consistency",
  "metadata-consistency",
  "code-impact",
  "uncovered-requirement",
] as const;

export type ItemKind = (typeof ITEM_KINDS)[number];

/**
 * Whether a kind's scope is a code location (SPEC 10.2: scope holds
 * requirement nodes or code locations; only `code-impact` scopes the
 * latter, 10.5).
 */
export function kindScopesCodeLocation(kind: ItemKind): boolean {
  return kind === "code-impact";
}

/**
 * A text value of SPEC 1.6, named by the `RecordedTexts` member that
 * stores it: a node's own text or its subtree text.
 */
export type TextKind = "ownText" | "subtreeText";

/**
 * SPEC 10.7: the text an item's scope presents — the scope root's subtree
 * text for `subtree-coherence`, the scope node's subtree text for
 * `uncovered-requirement`, and the scope node's own text for
 * `parent-consistency`, `dependency-consistency`, and
 * `metadata-consistency` — or null for a `code-impact` scope, a code
 * location, which has no text value. The scope nodes beneath a
 * `subtree-coherence` root present none: scope text is the root's.
 */
export function scopeTextKind(kind: ItemKind): TextKind | null {
  switch (kind) {
    case "subtree-coherence":
    case "uncovered-requirement":
      return "subtreeText";
    case "parent-consistency":
    case "dependency-consistency":
    case "metadata-consistency":
      return "ownText";
    case "code-impact":
      return null;
  }
}

/**
 * SPEC 10.7: the text an item's context nodes present — own text where the
 * context is an ancestor chain (`subtree-coherence`,
 * `uncovered-requirement`), subtree text otherwise (the scope node's
 * children for `parent-consistency`; the targets for
 * `dependency-consistency`, `metadata-consistency`, and `code-impact`).
 * An origin node presents its own text instead, as a before/after pair.
 */
export function contextTextKind(kind: ItemKind): TextKind {
  return kind === "subtree-coherence" || kind === "uncovered-requirement"
    ? "ownText"
    : "subtreeText";
}

// ---------------------------------------------------------------------------
// The item model (SPEC 10.2)
// ---------------------------------------------------------------------------

/** The recordable hash names (SPEC 5.5 → 10.4 relevant-hash table). */
export const RECORDED_HASH_NAMES = [
  "ownHash",
  "subtreeHash",
  "effectiveHash",
  "metadataHash",
] as const;

export type RecordedHashName = (typeof RECORDED_HASH_NAMES)[number];

/** A node's recorded relevant hashes, by hash name (SPEC 10.4). */
export type RecordedHashes = Readonly<
  Partial<Record<RecordedHashName, string>>
>;

/**
 * One node's recorded state (SPEC 10.4): whether it was present, and — for a
 * present node — its relevant hash values per the item kind's table; an
 * absent node's hashes are recorded as the explicit `"absent"` marker.
 */
export type RecordedNodeState =
  | { readonly present: true; readonly hashes: RecordedHashes }
  | { readonly present: false; readonly hashes: "absent" };

/**
 * A recorded state of SPEC 10.4 — the value of an item's `baseline` and
 * `current` fields (10.2): per scope, context, and origin node (and, for
 * `code-impact`, per impact-edge target), keyed by the node's identity as
 * stored (the identity policy of the module header).
 */
export interface RecordedState {
  readonly nodes: Readonly<Record<string, RecordedNodeState>>;
}

/**
 * A node's recorded text snapshot in one graph state (SPEC 10.2: items
 * carry enough baseline text to remain actionable after the referenced
 * nodes are edited, moved, or deleted; SPEC 10.7 fixes which value each
 * payload role presents). It holds only the kinds the node's roles in the
 * item present — the scope root's `scopeTextKind`, a context node's
 * `contextTextKind`, an origin node's own text (its before side, in
 * `ReviewItem.baselineTexts` alone) — so a missing member says only that
 * no role of the node presents it. Code locations have no text value
 * (10.7) and get no entry; neither do the scope nodes beneath a
 * `subtree-coherence` root, which present none.
 */
export interface RecordedTexts {
  /** The node's own text — the expanded value of SPEC 1.6. */
  readonly ownText?: string;
  /** The node's subtree text — the expanded value of SPEC 1.6. */
  readonly subtreeText?: string;
}

/** A per-node text snapshot table, keyed like `RecordedState.nodes`. */
export type RecordedTextTable = Readonly<Record<string, RecordedTexts>>;

/** One review item (SPEC 10.2). */
export interface ReviewItem {
  /**
   * Unique within the session (SPEC 10.2); never reused after removal
   * (10.7). Derived from the item's kind and scope node when the item
   * enters the session (`ItemIdAllocator`, module header "Item ids"), and
   * opaque once stored.
   */
  readonly id: string;
  /** Assigned by the strategy (SPEC 10.2). */
  readonly kind: ItemKind;
  /**
   * The scope node: the requirement node (subtree root for
   * `subtree-coherence`, SPEC 10.5) or the scoped code location
   * (`code-impact`) under review.
   */
  readonly scope: string;
  /**
   * The scope nodes beneath the scope root, as last assigned (SPEC 10.4:
   * reads present `scope` as last assigned — by `create`, a re-derivation
   * (10.5), or a `split` (10.7); a resolve assigns the context alone), by
   * identity, in generated order: a `subtree-coherence` item's scope is
   * "N and all descendants" (SPEC 10.5, 10.6), so these are the
   * descendants its strategy generated with it — in a baseline session
   * over 10.5's links, deleted ones included. `current` records the
   * relevant hashes over the scope root and these nodes, at creation and
   * at each resolve (SPEC 10.4, src/core/review-state.ts). Empty for a
   * leaf and for every other kind, whose scope is its scope node alone
   * (SPEC 10.2).
   */
  readonly scopeDescendants: readonly string[];
  /** Nodes whose text frames the review (SPEC 10.2), by identity. */
  readonly context: readonly string[];
  /** Why the item exists — human-readable (SPEC 10.2). */
  readonly reason: string;
  /** The originating nodes (SPEC 5.6), when applicable, by identity. */
  readonly origin: readonly string[];
  /**
   * SPEC 10.2: fixed when the item enters the session — baseline-graph
   * values in a baseline session, current-graph values at entry in `audit`
   * and `coverage` sessions.
   */
  readonly baseline: RecordedState;
  /**
   * SPEC 10.2/10.4: the recorded state — written at item creation,
   * rewritten at each resolve; read-time invalidation compares it against
   * the current graph and never rewrites it.
   */
  readonly current: RecordedState;
  /**
   * SPEC 10.4: the recorded context set — the context nodes recorded with
   * `current` (whose `nodes` record each one's presence), written wherever
   * `current` is: the item's context at creation, and at each resolve the
   * current context set that resolve assigns as `context`. Part of the
   * recorded state, so it is never rewritten where `current` is not: a
   * re-derivation matching the item (10.5) and a `split` reusing it (10.7)
   * keep it while reassigning `context`, and read-time invalidation
   * compares the item's current context set against it.
   */
  readonly recordedContext: readonly string[];
  readonly status: ItemStatus;
  /** SPEC 10.2/10.7: the optional `--note` text of the last resolve. */
  readonly note?: string;
  /** Item IDs that must resolve first (SPEC 10.2, 10.3). */
  readonly blockedBy: readonly string[];
  /**
   * Text snapshots at the item's baseline state (SPEC 10.2, 10.7), taken
   * when the item enters the session; entries exist only for the item's
   * nodes present in that state, each holding the kinds its roles present
   * (`RecordedTexts`): the scope root's scope text, each context node's
   * context text, and each origin node's own text. They keep absent nodes'
   * texts actionable and, in a session without a baseline (`audit`,
   * `coverage`), whose baseline state is the current graph at entry, stand
   * for that state — a baseline session's reads take origin before-texts
   * from the recorded-baseline graph they reconstruct instead (10.7:
   * whether or not the node has an entry in `baseline`).
   */
  readonly baselineTexts: RecordedTextTable;
  /**
   * Text snapshots from the most recent state under which a mutating
   * subcommand derived or resolved the item with the node among its nodes
   * and found it present (SPEC 10.7) — `create`, a re-derivation, a
   * `split`, or a resolve of any status: rewritten per node at each such
   * state (src/core/review-derive.ts `snapshotCurrentTexts`). Each entry
   * holds the kind the node presents as the scope root or a context node
   * (`RecordedTexts`); origin nodes get none, an origin's after side being
   * the current graph's. A state whose values the node's `baselineTexts`
   * entry already holds leaves no entry here — none is written and an
   * earlier one is removed, reads then taking those same values there —
   * and no entry is removed otherwise. So an unchanged text is stored
   * once, and in a session without a baseline, whose baseline state is the
   * entry-moment current graph, the table starts empty.
   */
  readonly derivedTexts: RecordedTextTable;
}

// ---------------------------------------------------------------------------
// The session model (SPEC 10.1, 10.7)
// ---------------------------------------------------------------------------

export type ReviewStrategy = "path-blocks" | "audit" | "coverage";

/**
 * SPEC 10.7: a recorded group reference — the group name replaced by the
 * group's configured glob list and kind at `create` time.
 */
export interface RecordedGroup {
  readonly kind: "spec" | "code";
  /** The group's configured glob patterns, as written (SPEC 7.1, 7.2). */
  readonly globs: readonly string[];
}

/**
 * SPEC 10.7: a coverage session's recorded profile definition — its 7.4
 * fields, fully resolved, with each group name replaced by that group's
 * configured glob list and kind.
 */
export interface RecordedProfile {
  readonly name: string;
  readonly target: RecordedGroup;
  /** When present, never empty (SPEC 7.4). */
  readonly targetTags?: readonly string[];
  readonly targets: "leaves" | "all";
  readonly boundary: RecordedGroup;
  readonly mode: "direct" | "transitive";
  /** Never empty (SPEC 7.4: defaults to all three). */
  readonly edgeKinds: readonly DependencyEdgeKind[];
}

/**
 * SPEC 10.7: the session's fully resolved creation parameters — the
 * resolved commit identity for a baseline session, the resolved profile
 * definition for a `coverage` session, and nothing for `audit`.
 */
export type SessionParameters =
  | { readonly strategy: "path-blocks"; readonly baseCommit: string }
  | { readonly strategy: "audit" }
  | { readonly strategy: "coverage"; readonly profile: RecordedProfile };

/**
 * SPEC 10.7: resolve a configured coverage profile into the recorded form a
 * `coverage` session's `create` stores — the profile's 7.4 fields with each
 * group name replaced by that group's configured glob list and kind.
 * Renaming or editing refs, profiles, or groups after `create` never changes
 * the recorded parameters the session runs with. The configuration is
 * validated (SPEC 14.14), so the referenced groups exist and are of the
 * required kinds; a miss is an internal error, never a user-facing state.
 */
export function recordCoverageProfile(
  configuration: Configuration,
  profile: CoverageProfile,
): RecordedProfile {
  const groupOf = (kind: "spec" | "code", name: string): ConfiguredGroup => {
    const groups =
      kind === "spec" ? configuration.specGroups : configuration.codeGroups;
    const group = groups.find((candidate) => candidate.name === name);
    if (group === undefined) {
      throw new Error(
        `xspec internal error: the validated configuration names no ` +
          `${kind} group ${JSON.stringify(name)} (SPEC 7.4, 14.14)`,
      );
    }
    return group;
  };
  // SPEC 7.4: `target` is a spec group; `boundary`'s kind was resolved at
  // configuration load (inferred when unambiguous, else as given).
  const target = groupOf("spec", profile.target);
  const boundary = groupOf(profile.boundaryKind, profile.boundary);
  return {
    name: profile.name,
    target: { kind: "spec", globs: [...target.patterns] },
    targetTags:
      profile.targetTags === undefined ? undefined : [...profile.targetTags],
    targets: profile.targets,
    boundary: { kind: profile.boundaryKind, globs: [...boundary.patterns] },
    mode: profile.mode,
    edgeKinds: [...profile.edgeKinds],
  };
}

/**
 * SPEC 10.7: one recorded `split` decomposition — the original item's kind
 * and scope node; the replacement (per-child `subtree-coherence` items plus
 * the scope node's `parent-consistency` item) is computed against the
 * current workspace — and, in a baseline session, the recorded baseline,
 * whose deleted nodes are children of their baseline parents (10.5) — on
 * every re-derivation (10.5), so only the decomposed (kind, scope) is
 * durable.
 */
export interface RecordedDecomposition {
  readonly kind: "subtree-coherence";
  readonly scope: string;
}

/** One review session (SPEC 10.1, 10.2, 10.7). */
export interface ReviewSession {
  readonly parameters: SessionParameters;
  /** In the order the `split`s were recorded (SPEC 10.7). */
  readonly decompositions: readonly RecordedDecomposition[];
  /**
   * The journal's entry count when the session was last written (module
   * header identity policy): the write-moment bound every stored canonical
   * position stays within. Mutating subcommands advance it to the current
   * entry count on every write.
   */
  readonly journalLength: number;
  /**
   * In stored order (module header, "Stored layout"): existing items keep
   * their places, items a write adds follow the last, and a `split` puts
   * the `parent-consistency` item it creates in the original's place.
   * Presentation order is derived at read (SPEC 10.5–10.7).
   */
  readonly items: readonly ReviewItem[];
  /**
   * The session's tables (module header, "Stored document"), fixed by the
   * write that created the session: every later write stores them byte
   * for byte unchanged, keeping whatever its items record beyond them in
   * the recording item's own entry, so no write after creation assigns a
   * table position (SPEC 13.4: stably keyed). Storage state alone,
   * carrying no SPEC 10.2 information: absent only for a session not yet
   * written, whose creating write builds them (`creationTables`); read
   * from a file, the tables it stores — for a format-1 file, which stores
   * none, the tables its creating traversal builds over its items as read.
   */
  readonly tables?: SessionTables;
}

/**
 * A session's tables (module header, "Stored document"): every canonical
 * reference, recorded node state (SPEC 10.4), and snapshot text (SPEC
 * 10.7) its items held when it was created, each once, in the order the
 * creating write's traversal met them — a format-2 file's, every one its
 * writes met, in the order they appended them. Whatever an item records
 * beyond them later, its own entry keeps.
 */
export interface SessionTables {
  readonly references: readonly string[];
  readonly states: readonly RecordedNodeState[];
  readonly texts: readonly string[];
}

/** The session's strategy (stored top-level beside the parameters). */
export function sessionStrategy(session: ReviewSession): ReviewStrategy {
  return session.parameters.strategy;
}

// ---------------------------------------------------------------------------
// Item ids (module header, "Item ids"; SPEC 10.2, 10.7, 13.4)
// ---------------------------------------------------------------------------

/**
 * The lead of every derived item id: one ASCII letter outside the hex
 * digits, so no derived id equals a format-1–3 `item-<n>` id or occurs
 * inside a hex hash value.
 */
const ITEM_ID_LEAD = "r";

/** The digest digits a derived item id takes first: 64 bits. */
const ITEM_ID_DIGITS = 16;

/**
 * The digest an item id derives from: the SHA-256, hex-encoded, of the
 * item's kind and its scope node's stored canonical reference under
 * injective framing (`hashComponents`; IMPLEMENTATION "Hashing") — a
 * function of what is added alone (module header, "Item ids").
 */
function itemIdDigest(kind: ItemKind, scope: string): string {
  return hashComponents([kind, scope]);
}

/**
 * The ids of the items one write adds (module header, "Item ids"; SPEC
 * 10.2, 10.5, 10.7, 13.4): an item's id is `r` and the first 16 hex digits
 * of its kind and scope node's digest (`itemIdDigest`), extended digit by
 * digit while that id names an item of the session, one this allocator
 * gave earlier, or one a recorded decomposition's kind and scope node
 * derive at the same length — so the removed original of a `split` keeps
 * its id retired, whatever length it took (SPEC 10.7: never reused). Past
 * the whole digest (every digit shared), a numeric suffix keeps the id
 * unique. Deterministic: a function of the session's item ids, its
 * recorded decompositions, and the order of the requests.
 */
export class ItemIdAllocator {
  private readonly taken: Set<string>;
  /** The recorded decompositions' digests (their kinds and scope nodes). */
  private readonly retired: readonly string[];
  /** Their first `ITEM_ID_DIGITS` digits, for the common first check. */
  private readonly retiredHeads: ReadonlySet<string>;

  constructor(
    items: readonly { readonly id: string }[],
    decompositions: readonly RecordedDecomposition[],
  ) {
    this.taken = new Set(items.map((item) => item.id));
    this.retired = decompositions.map((decomposition) =>
      itemIdDigest(decomposition.kind, decomposition.scope),
    );
    this.retiredHeads = new Set(
      this.retired.map((digest) => digest.slice(0, ITEM_ID_DIGITS)),
    );
  }

  /** The id of a new item of `kind` over the scope node `scope` (its stored
   * canonical reference), recorded as taken. */
  allocate(kind: ItemKind, scope: string): string {
    const digest = itemIdDigest(kind, scope);
    for (let digits = ITEM_ID_DIGITS; digits <= digest.length; digits += 1) {
      const head = digest.slice(0, digits);
      const id = ITEM_ID_LEAD + head;
      if (!this.taken.has(id) && !this.isRetired(head)) {
        this.taken.add(id);
        return id;
      }
    }
    for (let suffix = 2; ; suffix += 1) {
      const id = `${ITEM_ID_LEAD}${digest}-${String(suffix)}`;
      if (!this.taken.has(id)) {
        this.taken.add(id);
        return id;
      }
    }
  }

  /** Whether a recorded decomposition's digest begins with `head`. */
  private isRetired(head: string): boolean {
    return (
      this.retiredHeads.has(head.slice(0, ITEM_ID_DIGITS)) &&
      this.retired.some((digest) => digest.startsWith(head))
    );
  }
}

// ---------------------------------------------------------------------------
// Blocking (SPEC 10.3)
// ---------------------------------------------------------------------------

/**
 * SPEC 10.3: an item is blocked while any item in its `blockedBy` is not
 * resolved. `statusOf` supplies each blocker's effective status — stored
 * statuses, or statuses with read-time invalidation applied (10.4): because
 * `invalidated` is not a resolved status, a blocker that becomes invalidated
 * re-blocks its dependents until it is resolved again.
 */
export function isItemBlocked(
  item: ReviewItem,
  statusOf: (itemId: string) => ItemStatus,
): boolean {
  return item.blockedBy.some((blocker) => !isResolvedStatus(statusOf(blocker)));
}

/** Item counts by stored status (SPEC 10.7 `list`: no read-time invalidation). */
export function countsByStoredStatus(
  session: ReviewSession,
): Readonly<Record<ItemStatus, number>> {
  const counts: Record<ItemStatus, number> = {
    unresolved: 0,
    updated: 0,
    "no-change": 0,
    skipped: 0,
    invalidated: 0,
  };
  for (const item of session.items) {
    counts[item.status] += 1;
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Corruption findings (SPEC 10.1 → 14.21)
// ---------------------------------------------------------------------------

/**
 * The SPEC 14.21 finding for a session file that cannot be parsed or
 * violates a session invariant (SPEC 10.1). `problems` are the specific
 * violations, all reported (SPEC 14: each present condition is reported).
 */
export function corruptSessionFinding(
  name: string,
  problems: readonly string[],
): Finding {
  return pathFinding(
    21,
    `corrupt review session ${JSON.stringify(name)}: ` +
      problems.join("; ") +
      ` (SPEC 10.1) — the session file ${sessionFilePath(name)} was ` +
      `modified outside xspec or damaged; sessions are durable files ` +
      `changed only by their owning commands (SPEC 13.4) — restore the ` +
      `file from version control, or delete it and create the session ` +
      `again (SPEC 14.21)`,
    sessionFilePath(name),
  );
}

/**
 * The SPEC 14.21 finding for a session path occupied by anything other than
 * a plain file (SPEC 13.4: such a path is never read, appended to, or
 * replaced — the session is corrupt). `occupant` is the human description
 * ("a directory", "a symbolic link", …).
 */
export function corruptSessionOccupantFinding(
  name: string,
  occupant: string,
): Finding {
  return pathFinding(
    21,
    `corrupt review session ${JSON.stringify(name)}: the session path ` +
      `${sessionFilePath(name)} is occupied by ${occupant}, not a plain ` +
      `file — a durable file's path occupied by anything other than a ` +
      `plain file is never read, appended to, or replaced (SPEC 13.4, ` +
      `10.1); remove the occupant and restore the session as a plain file ` +
      `from version control, or delete it and create the session again ` +
      `(SPEC 14.21)`,
    sessionFilePath(name),
  );
}

// ---------------------------------------------------------------------------
// Serialization (SPEC 10.1: plain, deterministic; 13.4: stably keyed)
// ---------------------------------------------------------------------------

/**
 * A recorded state (SPEC 10.4) as JSON data — the stored form, also the
 * `baseline`/`current` members of the read payloads (SPEC 10.7: reads
 * report both fields as recorded).
 */
export function recordedStateToJson(state: RecordedState): JsonValue {
  const nodes: Record<string, JsonValue> = {};
  for (const [identity, node] of Object.entries(state.nodes)) {
    nodes[identity] = recordedNodeStateToJson(node);
  }
  return { nodes };
}

/** One recorded node state (SPEC 10.4) as JSON data — a `states` table
 * entry, and each node's value in `recordedStateToJson`. */
function recordedNodeStateToJson(node: RecordedNodeState): JsonObject {
  return node.present
    ? { present: true, hashes: { ...node.hashes } }
    : { present: false, hashes: "absent" };
}

/** A content key of a recorded node state: equal exactly for equal states. */
function recordedNodeStateKey(node: RecordedNodeState): string {
  return compactJson(recordedNodeStateToJson(node));
}

/**
 * An index list's stored spelling (module header, "Stored document"):
 * space-separated tokens in list order — `i` for one index, `i-j` (i < j)
 * for the ascending run i, i+1, …, j, and, in a state or text list
 * (`repeats`), `i*k` (k ≥ 2) for i repeated k times — taken greedily from
 * the left, so the spelling is a function of the list alone (SPEC 12.0);
 * the empty list is the empty string.
 */
function encodeIndexList(indices: readonly number[], repeats: boolean): string {
  const tokens: string[] = [];
  let at = 0;
  while (at < indices.length) {
    const first = indices[at];
    let end = at + 1;
    if (repeats && indices[end] === first) {
      while (indices[end] === first) end += 1;
      tokens.push(`${String(first)}*${String(end - at)}`);
    } else {
      while (end < indices.length && indices[end] === indices[end - 1] + 1) {
        end += 1;
      }
      tokens.push(
        end - at === 1
          ? String(first)
          : `${String(first)}-${String(indices[end - 1])}`,
      );
    }
    at = end;
  }
  return tokens.join(" ");
}

/** The text kinds of a snapshot (`RecordedTexts`), in stored order. */
const TEXT_KINDS: readonly TextKind[] = ["ownText", "subtreeText"];

/**
 * Per position of the distinct `references`, its rank in their byte order
 * (SPEC 12.0) — the order of a state or text table's nodes (module
 * header), compared once per reference rather than once per sort.
 */
function byteOrderRanks(references: readonly string[]): number[] {
  const order = references.map((_, index) => index);
  order.sort((a, b) => compareBytes(references[a], references[b]));
  const ranks = new Array<number>(order.length);
  order.forEach((index, rank) => {
    ranks[index] = rank;
  });
  return ranks;
}

/**
 * A recorded node state table's lookup: the index of a state equal to the
 * one asked for, found by object first — a decoded or memoized state is
 * the table's own object (`TableReader`, src/core/review-state.ts) — and
 * by content otherwise, the answer then kept for the object.
 */
class StateLookup {
  private readonly byObject = new Map<RecordedNodeState, number | null>();
  private readonly byContent = new Map<string, number>();

  constructor(states: readonly RecordedNodeState[]) {
    states.forEach((state, index) => {
      this.add(state, index);
    });
  }

  /** The index of a state equal to `state`, or undefined. */
  find(state: RecordedNodeState): number | undefined {
    const known = this.byObject.get(state);
    if (known !== undefined) return known ?? undefined;
    const index = this.byContent.get(recordedNodeStateKey(state));
    this.byObject.set(state, index ?? null);
    return index;
  }

  /**
   * Record `state` at `index`: its object keeps the first index recorded
   * for it, its content the first index any equal state was recorded at —
   * so a decoded state keeps the very index it was stored at.
   */
  add(state: RecordedNodeState, index: number): void {
    this.byObject.set(state, this.byObject.get(state) ?? index);
    const key = recordedNodeStateKey(state);
    if (!this.byContent.has(key)) this.byContent.set(key, index);
  }
}

/**
 * The tables a session's creating write builds over its items (module
 * header, "Stored document"), each value once, in first-use order:
 * references in a first pass (each item's scope, the scope nodes beneath
 * it, its context, origin, and recorded context, then its recorded
 * states' and text tables' nodes), so a document-order generation numbers
 * them in document order; recorded node states next (each item's
 * `baseline`, then its `current`, nodes in byte order of their
 * references); texts last (every own text, then every subtree text, each
 * pass over the items' `baselineTexts`, then their `derivedTexts`, nodes
 * in byte order). This is the traversal format 2 made of a new session,
 * so a created session's tables, and its items' index lists over them,
 * are format 2's. It also gives a format-1 file its tables, built over
 * its items as read (`validateSessionDocument`) — a function of the file
 * alone. Beside the tables comes each traversed map's nodes as table
 * indices in byte order, which the creating write's encoding reuses.
 */
function createTables(items: readonly ReviewItem[]): {
  readonly tables: SessionTables;
  readonly orderedNodes: Map<object, readonly number[]>;
} {
  const references: string[] = [];
  const referenceIndex = new Map<string, number>();
  const addReference = (reference: string): void => {
    if (!referenceIndex.has(reference)) {
      referenceIndex.set(reference, references.length);
      references.push(reference);
    }
  };
  for (const item of items) {
    addReference(item.scope);
    for (const list of [
      item.scopeDescendants,
      item.context,
      item.origin,
      item.recordedContext,
      Object.keys(item.baseline.nodes),
      Object.keys(item.current.nodes),
      Object.keys(item.baselineTexts),
      Object.keys(item.derivedTexts),
    ]) {
      for (const reference of list) addReference(reference);
    }
  }
  const ranks = byteOrderRanks(references);
  // Equal in-memory states and text tables (an audit item's `baseline` and
  // `current`, say) are one object, ordered once.
  const orderedNodes = new Map<object, readonly number[]>();
  const byteOrdered = (
    map: Readonly<Record<string, unknown>>,
  ): readonly number[] => {
    let nodes = orderedNodes.get(map);
    if (nodes === undefined) {
      nodes = Object.keys(map)
        .map((reference) => referenceIndex.get(reference) as number)
        .sort((a, b) => ranks[a] - ranks[b]);
      orderedNodes.set(map, nodes);
    }
    return nodes;
  };

  const states: RecordedNodeState[] = [];
  const stateLookup = new StateLookup([]);
  const visited = new Set<RecordedState>();
  for (const item of items) {
    for (const state of [item.baseline, item.current]) {
      if (visited.has(state)) continue;
      visited.add(state);
      for (const index of byteOrdered(state.nodes)) {
        const node = state.nodes[references[index]];
        if (stateLookup.find(node) === undefined) {
          stateLookup.add(node, states.length);
          states.push(node);
        }
      }
    }
  }

  const texts: string[] = [];
  const textIndex = new Set<string>();
  for (const kind of TEXT_KINDS) {
    for (const item of items) {
      for (const table of [item.baselineTexts, item.derivedTexts]) {
        for (const index of byteOrdered(table)) {
          const text = table[references[index]][kind];
          if (text !== undefined && !textIndex.has(text)) {
            textIndex.add(text);
            texts.push(text);
          }
        }
      }
    }
  }
  return { tables: { references, states, texts }, orderedNodes };
}

/** The tables `createTables` builds over `items` (a format-1 file's). */
function creationTables(items: readonly ReviewItem[]): SessionTables {
  return createTables(items).tables;
}

/**
 * The fixed tables a write stores (module header, "Stored document") and
 * their lookups: each value's index — by content the first, should a
 * format-2 file's tables hold a state or text twice, while a decoded state
 * keeps its own (`StateLookup`) — or undefined for a value they lack;
 * and, per map object whose nodes the tables all hold, its nodes as table
 * indices in byte order (`orderedNodes`), shared by every item holding it.
 */
class FixedTables {
  /** Per reference index, its rank in byte order (SPEC 12.0). */
  readonly ranks: readonly number[];
  private readonly referenceIndex = new Map<string, number>();
  private readonly stateLookup: StateLookup;
  private readonly textIndex = new Map<string, number>();

  constructor(
    readonly tables: SessionTables,
    readonly orderedNodes = new Map<object, readonly number[]>(),
  ) {
    tables.references.forEach((reference, index) => {
      if (!this.referenceIndex.has(reference)) {
        this.referenceIndex.set(reference, index);
      }
    });
    this.ranks = byteOrderRanks(tables.references);
    this.stateLookup = new StateLookup(tables.states);
    tables.texts.forEach((text, index) => {
      if (!this.textIndex.has(text)) this.textIndex.set(text, index);
    });
  }

  reference(reference: string): number | undefined {
    return this.referenceIndex.get(reference);
  }

  state(state: RecordedNodeState): number | undefined {
    return this.stateLookup.find(state);
  }

  text(text: string): number | undefined {
    return this.textIndex.get(text);
  }
}

/**
 * One item's stored entry (module header, "Stored document"): every member
 * by index — into the session's fixed tables wherever they hold the value,
 * and otherwise into the item's own `references`, `states`, and `texts`,
 * addressed past the fixed tables' lengths and stored with the entry, each
 * omitted when empty. The own tables' order is a function of the item's
 * value alone, never of how its in-memory maps were built: own references
 * as the item's lists first name them — its scope, the scope nodes beneath
 * it, its context, origin, and recorded context — then, map by map
 * (`baseline`, `current`, `baselineTexts`, `derivedTexts`), the ones only a
 * map's nodes name, in byte order; own states as `baseline`, then
 * `current`, first holds them, nodes in byte order; own texts as the text
 * tables first hold them — every own text, then every subtree text, each
 * pass over `baselineTexts`, then `derivedTexts`, nodes in byte order. So
 * an item a write leaves unchanged — read back from the file the write
 * replaces, its maps rebuilt in stored order — is stored with the same
 * bytes (SPEC 13.4).
 */
function itemEntry(item: ReviewItem, fixed: FixedTables): JsonObject {
  const shared = fixed.tables;
  const sharedReferences = shared.references.length;
  const ownReferences: string[] = [];
  const ownReferenceIndex = new Map<string, number>();
  const known = (reference: string): number | undefined =>
    fixed.reference(reference) ?? ownReferenceIndex.get(reference);
  const addOwnReference = (reference: string): number => {
    const index = sharedReferences + ownReferences.length;
    ownReferenceIndex.set(reference, index);
    ownReferences.push(reference);
    return index;
  };
  // The lists are encoded first, in this order, so their own references
  // are numbered as the lists first name them.
  const listIndex = (reference: string): number =>
    known(reference) ?? addOwnReference(reference);
  const listJson = (references: readonly string[]): string =>
    encodeIndexList(references.map(listIndex), false);
  const scope = listIndex(item.scope);
  const scopeDescendants = listJson(item.scopeDescendants);
  const context = listJson(item.context);
  const origin = listJson(item.origin);
  const recordedContext = listJson(item.recordedContext);

  const referenceAt = (index: number): string =>
    index < sharedReferences
      ? shared.references[index]
      : ownReferences[index - sharedReferences];
  // Byte order of the references (SPEC 12.0): by rank within the fixed
  // table, by comparison wherever an own reference takes part.
  const compare = (a: number, b: number): number =>
    a < sharedReferences && b < sharedReferences
      ? fixed.ranks[a] - fixed.ranks[b]
      : compareBytes(referenceAt(a), referenceAt(b));
  const orderedNodes = new Map<object, readonly number[]>();
  const byteOrdered = (
    map: Readonly<Record<string, unknown>>,
  ): readonly number[] => {
    let nodes = fixed.orderedNodes.get(map) ?? orderedNodes.get(map);
    if (nodes === undefined) {
      const keys = Object.keys(map);
      const unknown = keys.filter(
        (reference) => known(reference) === undefined,
      );
      unknown.sort(compareBytes).forEach(addOwnReference);
      const indices = keys.map((reference) => known(reference) as number);
      indices.sort(compare);
      // A map whose nodes the fixed tables all hold orders alike in every
      // item holding it.
      const allShared = indices.every((index) => index < sharedReferences);
      (allShared ? fixed.orderedNodes : orderedNodes).set(map, indices);
      nodes = indices;
    }
    return nodes;
  };

  const sharedStates = shared.states.length;
  const ownStates: RecordedNodeState[] = [];
  const ownStateLookup = new StateLookup([]);
  const stateIndexOf = (state: RecordedNodeState): number => {
    let index = fixed.state(state) ?? ownStateLookup.find(state);
    if (index === undefined) {
      index = sharedStates + ownStates.length;
      ownStateLookup.add(state, index);
      ownStates.push(state);
    }
    return index;
  };
  // Equal in-memory states and text tables (an audit item's `baseline` and
  // `current`, say) are one object, stored by one encoding.
  const stateMaps = new Map<RecordedState, JsonObject>();
  const stateMapJson = (state: RecordedState): JsonObject => {
    let json = stateMaps.get(state);
    if (json === undefined) {
      const nodes = byteOrdered(state.nodes);
      const states = nodes.map((index) =>
        stateIndexOf(state.nodes[referenceAt(index)]),
      );
      json = {
        nodes: encodeIndexList(nodes, false),
        states: encodeIndexList(states, true),
      };
      stateMaps.set(state, json);
    }
    return json;
  };
  const baseline = stateMapJson(item.baseline);
  const current = stateMapJson(item.current);

  const sharedTexts = shared.texts.length;
  const ownTexts: string[] = [];
  const ownTextIndex = new Map<string, number>();
  const textIndexOf = (text: string): number => {
    let index = fixed.text(text) ?? ownTextIndex.get(text);
    if (index === undefined) {
      index = sharedTexts + ownTexts.length;
      ownTextIndex.set(text, index);
      ownTexts.push(text);
    }
    return index;
  };
  const kindJson = new Map<RecordedTextTable, Map<TextKind, JsonObject>>();
  for (const kind of TEXT_KINDS) {
    for (const table of [item.baselineTexts, item.derivedTexts]) {
      let kinds = kindJson.get(table);
      if (kinds === undefined) {
        kinds = new Map<TextKind, JsonObject>();
        kindJson.set(table, kinds);
      }
      if (kinds.has(kind)) continue;
      const nodes: number[] = [];
      const texts: number[] = [];
      for (const index of byteOrdered(table)) {
        const text = table[referenceAt(index)][kind];
        if (text !== undefined) {
          nodes.push(index);
          texts.push(textIndexOf(text));
        }
      }
      kinds.set(kind, {
        nodes: encodeIndexList(nodes, false),
        texts: encodeIndexList(texts, true),
      });
    }
  }
  const textMapJson = (table: RecordedTextTable): JsonObject => {
    const kinds = kindJson.get(table) as Map<TextKind, JsonObject>;
    return {
      ownText: kinds.get("ownText"),
      subtreeText: kinds.get("subtreeText"),
    };
  };

  return {
    id: item.id,
    kind: item.kind,
    scope,
    scopeDescendants,
    context,
    reason: item.reason,
    origin,
    baseline,
    current,
    recordedContext,
    status: item.status,
    note: item.note,
    blockedBy: [...item.blockedBy],
    baselineTexts: textMapJson(item.baselineTexts),
    derivedTexts: textMapJson(item.derivedTexts),
    references: ownReferences.length === 0 ? undefined : ownReferences,
    states:
      ownStates.length === 0
        ? undefined
        : ownStates.map(recordedNodeStateToJson),
    texts: ownTexts.length === 0 ? undefined : ownTexts,
  };
}

/**
 * The format-5 document of a session (module header, "Stored document"):
 * the session's fixed tables — for a session its creating write is
 * storing, the tables `createTables` builds over its items — stored as
 * they are, every item stored by index (`itemEntry`), and the recorded
 * decompositions after the fixed head element (`DECOMPOSITIONS_HEAD`).
 */
function sessionDocument(session: ReviewSession): JsonObject {
  const created =
    session.tables === undefined ? createTables(session.items) : undefined;
  const tables = created?.tables ?? (session.tables as SessionTables);
  const fixed = new FixedTables(tables, created?.orderedNodes);
  return {
    creationParameters: parametersToJson(session.parameters),
    decompositions: [
      DECOMPOSITIONS_HEAD,
      ...session.decompositions.map((decomposition) => ({
        kind: decomposition.kind,
        scope: decomposition.scope,
      })),
    ],
    items: session.items.map((item) => itemEntry(item, fixed)),
    journalLength: session.journalLength,
    references: tables.references,
    states: tables.states.map(recordedNodeStateToJson),
    strategy: session.parameters.strategy,
    texts: tables.texts,
    version: SESSION_VERSION,
  };
}

/**
 * The recorded creation parameters as JSON data (SPEC 10.7) — the stored
 * form, also `export`'s `creationParameters` member: the resolved commit
 * for a baseline session, the resolved profile definition for a `coverage`
 * session, nothing for `audit`.
 */
export function parametersToJson(parameters: SessionParameters): JsonObject {
  switch (parameters.strategy) {
    case "path-blocks":
      // SPEC 10.7: the commit identity `--base` resolved to at creation.
      return { base: parameters.baseCommit };
    case "audit":
      // SPEC 10.7: an audit session records none.
      return {};
    case "coverage": {
      // SPEC 10.7: the named profile's definition — its 7.4 fields, group
      // names replaced by the groups' configured glob lists and kinds.
      const profile = parameters.profile;
      return {
        profile: {
          name: profile.name,
          target: {
            kind: profile.target.kind,
            globs: [...profile.target.globs],
          },
          targetTags: profile.targetTags ? [...profile.targetTags] : undefined,
          targets: profile.targets,
          boundary: {
            kind: profile.boundary.kind,
            globs: [...profile.boundary.globs],
          },
          mode: profile.mode,
          edgeKinds: [...profile.edgeKinds],
        },
      };
    }
  }
}

/** The stored format every write produces (module header). */
const SESSION_VERSION = 5;

/** The earlier stored formats, still read (module header): any version
 * other than these and format 5 is corrupt (unintelligible). */
const FORMAT_4_VERSION = 4;
const FORMAT_3_VERSION = 3;
const FORMAT_2_VERSION = 2;
const FORMAT_1_VERSION = 1;

/**
 * The fixed head element of a format-5 document's `decompositions` (module
 * header, "Stored layout"): stored first, bare, so that every recorded
 * decomposition after it is a comma-led line; read as exactly that and
 * never as a decomposition (`parseDecompositions`).
 */
const DECOMPOSITIONS_HEAD = null;

/** The members a format-5 document lays out one element per line (module
 * header, "Stored layout"). */
const LINE_MEMBERS = ["decompositions", "items"] as const;

/**
 * Serialize a session to its stored form: one canonical JSON document in
 * format 5, its `decompositions` and `items` one element per line (module
 * header; SPEC 10.1 "plain, deterministic"; 13.4 "stable ordering and
 * sorted keys", "line-oriented or stably keyed so that concurrent
 * additions merge textually"; 12.0 byte determinism — the text is a pure
 * function of the session value and its fixed tables).
 */
export function serializeSession(session: ReviewSession): string {
  return canonicalJson(sessionDocument(session), { lineArrays: LINE_MEMBERS });
}

// ---------------------------------------------------------------------------
// Parsing and invariant validation (SPEC 10.1 → 14.21)
// ---------------------------------------------------------------------------

/** The outcome of parsing and validating a session file's bytes. */
export type SessionParseResult =
  | { readonly ok: true; readonly session: ReviewSession }
  | {
      /**
       * SPEC 10.1: the file cannot be parsed or violates a session
       * invariant — the session is corrupt (14.21). Every detected problem
       * is listed.
       */
      readonly ok: false;
      readonly problems: readonly string[];
    };

/** A problem collector that keeps validation total. */
class Problems {
  readonly list: string[] = [];

  add(problem: string): void {
    this.list.push(problem);
  }

  get empty(): boolean {
    return this.list.length === 0;
  }
}

function isPlainJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describeType(value: unknown): string {
  if (value === undefined) return "nothing";
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  return typeof value === "object" ? "an object" : `a ${typeof value}`;
}

/**
 * Verify `object` carries every `required` key and no key outside
 * `required` ∪ `optional` (the stored shape is exact: the product writes
 * these files, so any deviation is external modification).
 */
function checkKeys(
  object: Record<string, unknown>,
  where: string,
  required: readonly string[],
  optional: readonly string[],
  problems: Problems,
): boolean {
  let complete = true;
  for (const key of required) {
    if (!Object.hasOwn(object, key)) {
      problems.add(
        `${where} is missing the required field ${JSON.stringify(key)}`,
      );
      complete = false;
    }
  }
  for (const key of Object.keys(object)) {
    if (!required.includes(key) && !optional.includes(key)) {
      problems.add(`${where} carries the unknown field ${JSON.stringify(key)}`);
      complete = false;
    }
  }
  return complete;
}

function requireString(
  value: unknown,
  where: string,
  problems: Problems,
): value is string {
  if (typeof value === "string") return true;
  problems.add(`${where} must be a string, found ${describeType(value)}`);
  return false;
}

function requireNonEmptyString(
  value: unknown,
  where: string,
  problems: Problems,
): value is string {
  if (!requireString(value, where, problems)) return false;
  if (value.length === 0) {
    problems.add(`${where} must be a non-empty string`);
    return false;
  }
  return true;
}

function parseIdentityList(
  value: unknown,
  where: string,
  problems: Problems,
): string[] {
  if (!Array.isArray(value)) {
    problems.add(`${where} must be an array, found ${describeType(value)}`);
    return [];
  }
  const identities: string[] = [];
  value.forEach((element, index) => {
    if (
      requireNonEmptyString(element, `${where}[${String(index)}]`, problems)
    ) {
      identities.push(element);
    }
  });
  return identities;
}

function parseRecordedNodeState(
  value: unknown,
  where: string,
  problems: Problems,
): RecordedNodeState | null {
  if (!isPlainJsonObject(value)) {
    problems.add(`${where} must be an object, found ${describeType(value)}`);
    return null;
  }
  if (!checkKeys(value, where, ["present", "hashes"], [], problems)) {
    return null;
  }
  const present = value["present"];
  if (typeof present !== "boolean") {
    problems.add(
      `${where}.present must be a boolean, found ${describeType(present)}`,
    );
    return null;
  }
  const hashes = value["hashes"];
  if (!present) {
    // SPEC 10.4: an absent node's hashes are an explicit absent marker.
    if (hashes !== "absent") {
      problems.add(
        `${where}.hashes must be the explicit "absent" marker for an ` +
          `absent node (SPEC 10.4), found ${describeType(hashes)}`,
      );
      return null;
    }
    return { present: false, hashes: "absent" };
  }
  if (!isPlainJsonObject(hashes)) {
    problems.add(
      `${where}.hashes must be an object of recorded hash values for a ` +
        `present node (SPEC 10.4), found ${describeType(hashes)}`,
    );
    return null;
  }
  const recorded: Partial<Record<RecordedHashName, string>> = {};
  let wellFormed = true;
  for (const [hashName, hashValue] of Object.entries(hashes)) {
    if (!(RECORDED_HASH_NAMES as readonly string[]).includes(hashName)) {
      problems.add(
        `${where}.hashes carries the unknown hash name ${JSON.stringify(hashName)}`,
      );
      wellFormed = false;
      continue;
    }
    if (
      !requireNonEmptyString(hashValue, `${where}.hashes.${hashName}`, problems)
    ) {
      wellFormed = false;
      continue;
    }
    recorded[hashName as RecordedHashName] = hashValue;
  }
  return wellFormed ? { present: true, hashes: recorded } : null;
}

function parseRecordedState(
  value: unknown,
  where: string,
  problems: Problems,
): RecordedState {
  const empty: RecordedState = { nodes: {} };
  if (!isPlainJsonObject(value)) {
    problems.add(`${where} must be an object, found ${describeType(value)}`);
    return empty;
  }
  if (!checkKeys(value, where, ["nodes"], [], problems)) {
    return empty;
  }
  const nodesValue = value["nodes"];
  if (!isPlainJsonObject(nodesValue)) {
    problems.add(
      `${where}.nodes must be an object keyed by node identity, found ` +
        describeType(nodesValue),
    );
    return empty;
  }
  const nodes: Record<string, RecordedNodeState> = {};
  for (const [identity, nodeValue] of Object.entries(nodesValue)) {
    if (identity.length === 0) {
      problems.add(`${where}.nodes carries an empty node identity`);
      continue;
    }
    const state = parseRecordedNodeState(
      nodeValue,
      `${where}.nodes[${JSON.stringify(identity)}]`,
      problems,
    );
    if (state !== null) {
      nodes[identity] = state;
    }
  }
  return { nodes };
}

function parseTextTable(
  value: unknown,
  where: string,
  problems: Problems,
): RecordedTextTable {
  if (!isPlainJsonObject(value)) {
    problems.add(`${where} must be an object, found ${describeType(value)}`);
    return {};
  }
  const table: Record<string, RecordedTexts> = {};
  for (const [identity, entry] of Object.entries(value)) {
    const entryWhere = `${where}[${JSON.stringify(identity)}]`;
    if (identity.length === 0) {
      problems.add(`${where} carries an empty node identity`);
      continue;
    }
    if (!isPlainJsonObject(entry)) {
      problems.add(
        `${entryWhere} must be an object, found ${describeType(entry)}`,
      );
      continue;
    }
    if (
      !checkKeys(entry, entryWhere, [], ["ownText", "subtreeText"], problems)
    ) {
      continue;
    }
    const texts: { ownText?: string; subtreeText?: string } = {};
    let wellFormed = true;
    for (const key of ["ownText", "subtreeText"] as const) {
      if (!Object.hasOwn(entry, key)) continue;
      const text = entry[key];
      if (requireString(text, `${entryWhere}.${key}`, problems)) {
        texts[key] = text;
      } else {
        wellFormed = false;
      }
    }
    if (wellFormed) {
      table[identity] = texts;
    }
  }
  return table;
}

/**
 * U+FFFD (REPLACEMENT CHARACTER), which no item `id` contains (SPEC 10.2,
 * 12.0). Built from its code point, never spelled literally.
 */
const REPLACEMENT_CHARACTER = String.fromCodePoint(0xfffd);

const ITEM_REQUIRED_KEYS = [
  "id",
  "kind",
  "scope",
  "scopeDescendants",
  "context",
  "reason",
  "origin",
  "baseline",
  "current",
  "recordedContext",
  "status",
  "blockedBy",
  "baselineTexts",
  "derivedTexts",
] as const;

/** A format-1 or format-2 item's optional member: the `note` (SPEC 10.2). */
const ITEM_OPTIONAL_KEYS = ["note"] as const;

/** A format-3, format-4, or format-5 item's optional members (module
 * header): the `note`, and the item's own tables, each omitted when
 * empty. */
const OWN_TABLE_ITEM_OPTIONAL_KEYS = [
  ...ITEM_OPTIONAL_KEYS,
  "references",
  "states",
  "texts",
] as const;

/**
 * How a stored format spells an item's node-bearing members (module
 * header): format 1 spells each reference out and keys recorded states and
 * text tables by reference; formats 2 to 5 index into the session's
 * tables and, in formats 3 to 5, the item's own (`TableReader`). Each
 * decoder reports what it finds malformed.
 */
interface ItemMemberDecoder {
  /** The scope node's stored reference, or null (reported). */
  scope(value: unknown, where: string, problems: Problems): string | null;
  /** An ordered reference list — scope nodes, context, origin. */
  references(value: unknown, where: string, problems: Problems): string[];
  /** A recorded state (SPEC 10.4): `baseline` or `current`. */
  state(value: unknown, where: string, problems: Problems): RecordedState;
  /** A text snapshot table (SPEC 10.7). */
  texts(value: unknown, where: string, problems: Problems): RecordedTextTable;
}

/** Format 1's member spellings (module header). */
const FORMAT_1_MEMBERS: ItemMemberDecoder = {
  scope: (value, where, problems) =>
    requireNonEmptyString(value, where, problems) ? value : null,
  references: parseIdentityList,
  state: parseRecordedState,
  texts: parseTextTable,
};

/**
 * One stored item (SPEC 10.2): its members decoded by `members`, the
 * stored format's spellings, and none beyond the fields of 10.2 and the
 * format's `optional` members. Null, reported, when anything is malformed.
 */
function parseItem(
  value: unknown,
  where: string,
  problems: Problems,
  members: ItemMemberDecoder,
  optional: readonly string[],
): ReviewItem | null {
  if (!isPlainJsonObject(value)) {
    problems.add(`${where} must be an object, found ${describeType(value)}`);
    return null;
  }
  const before = problems.list.length;
  // SPEC 10.1: the fields of 10.2 present and well-formed.
  checkKeys(value, where, ITEM_REQUIRED_KEYS, optional, problems);

  const id = value["id"];
  if (
    requireNonEmptyString(id, `${where}.id`, problems) &&
    !isWellFormedArgumentValue(id)
  ) {
    // SPEC 10.2: an `id` never contains U+FFFD, so every item is nameable
    // as an `<item-id>` operand — and 12.0 admits as an argument value only
    // valid UTF-8 free of U+FFFD, so an `id` holding a lone surrogate (which
    // a JSON escape in the file can spell, and no UTF-8 encodes) is as
    // unnameable. Either is a malformed 10.2 field: the session is corrupt
    // (SPEC 10.1 → 14.21).
    problems.add(
      `${where}.id ${JSON.stringify(id)} contains ` +
        (id.includes(REPLACEMENT_CHARACTER)
          ? "U+FFFD (REPLACEMENT CHARACTER)"
          : "a lone surrogate, which no valid UTF-8 encodes") +
        `, so no <item-id> operand can name the item — an item id never ` +
        `contains U+FFFD, so every item is nameable as an <item-id> ` +
        `operand, whose value must be valid UTF-8 free of U+FFFD ` +
        `(SPEC 10.2, 12.0)`,
    );
  }

  const kind = value["kind"];
  if (
    typeof kind !== "string" ||
    !(ITEM_KINDS as readonly string[]).includes(kind)
  ) {
    problems.add(
      `${where}.kind must be one of ${ITEM_KINDS.join(", ")}, found ` +
        (typeof kind === "string" ? JSON.stringify(kind) : describeType(kind)),
    );
  }

  const scope = members.scope(value["scope"], `${where}.scope`, problems);
  // SPEC 10.2, 10.4: the scope nodes beneath the root, as last assigned.
  const scopeDescendants = members.references(
    value["scopeDescendants"],
    `${where}.scopeDescendants`,
    problems,
  );

  const context = members.references(
    value["context"],
    `${where}.context`,
    problems,
  );
  const origin = members.references(
    value["origin"],
    `${where}.origin`,
    problems,
  );

  const reason = value["reason"];
  requireString(reason, `${where}.reason`, problems);

  const baseline = members.state(
    value["baseline"],
    `${where}.baseline`,
    problems,
  );
  const current = members.state(value["current"], `${where}.current`, problems);
  // SPEC 10.4: the recorded context set, written with `current`.
  const recordedContext = members.references(
    value["recordedContext"],
    `${where}.recordedContext`,
    problems,
  );

  // SPEC 10.1: statuses drawn from 10.3.
  const status = value["status"];
  if (
    typeof status !== "string" ||
    !(ITEM_STATUSES as readonly string[]).includes(status)
  ) {
    problems.add(
      `${where}.status must be one of ${ITEM_STATUSES.join(", ")} ` +
        `(SPEC 10.3), found ` +
        (typeof status === "string"
          ? JSON.stringify(status)
          : describeType(status)),
    );
  }

  let note: string | undefined;
  if (Object.hasOwn(value, "note")) {
    const noteValue = value["note"];
    if (requireString(noteValue, `${where}.note`, problems)) {
      note = noteValue;
    }
  }

  const blockedBy = parseIdentityList(
    value["blockedBy"],
    `${where}.blockedBy`,
    problems,
  );
  const baselineTexts = members.texts(
    value["baselineTexts"],
    `${where}.baselineTexts`,
    problems,
  );
  const derivedTexts = members.texts(
    value["derivedTexts"],
    `${where}.derivedTexts`,
    problems,
  );

  if (problems.list.length > before) {
    return null;
  }
  return {
    id: id as string,
    kind: kind as ItemKind,
    scope: scope as string,
    scopeDescendants,
    context,
    reason: reason as string,
    origin,
    baseline,
    current,
    recordedContext,
    status: status as ItemStatus,
    note,
    blockedBy,
    baselineTexts,
    derivedTexts,
  };
}

/**
 * Whether `value` holds a lone surrogate: a UTF-16 code unit that no valid
 * UTF-8 encodes — which a JSON escape in a session file can spell, though
 * no configuration file, valid UTF-8 with its literals read as spelled
 * (SPEC 7, 2.4), ever holds one. (`String.prototype.isWellFormed` lies
 * beyond the es2023 library the product compiles against.)
 */
function holdsLoneSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = index + 1 < value.length ? value.charCodeAt(index + 1) : 0;
      if (next < 0xdc00 || next > 0xdfff) return true;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return true;
    }
  }
  return false;
}

/**
 * SPEC 10.1, 10.7: a recorded group reference is well-formed when it is
 * one `create` can record — the group's configured kind and glob list. A
 * profile's `target` is a spec group, its `boundary` a spec or code group
 * (SPEC 7.4); and every recorded glob is one a configuration may hold:
 * none lies outside the workspace root (SPEC 7, 14.14), and none holds a
 * lone surrogate, which has no UTF-8 bytes to match as (SPEC 7: globs
 * match byte-wise, as UTF-8). Any other recorded group makes the session
 * corrupt (14.21).
 */
function parseRecordedGroup(
  value: unknown,
  where: string,
  role: "target" | "boundary",
  problems: Problems,
): RecordedGroup | null {
  if (!isPlainJsonObject(value)) {
    problems.add(`${where} must be an object, found ${describeType(value)}`);
    return null;
  }
  if (!checkKeys(value, where, ["kind", "globs"], [], problems)) {
    return null;
  }
  const kind = value["kind"];
  if (kind !== "spec" && kind !== "code") {
    problems.add(
      `${where}.kind must be "spec" or "code", found ${describeType(kind)}`,
    );
    return null;
  }
  if (role === "target" && kind !== "spec") {
    // SPEC 7.4: `target` is the "spec group whose requirements must be
    // covered", recorded with its kind at `create` (10.7).
    problems.add(
      `${where}.kind must be "spec", found ${JSON.stringify(kind)} — a ` +
        `coverage profile's target is a spec group, recorded with its ` +
        `configured kind at creation (SPEC 7.4, 10.7)`,
    );
    return null;
  }
  const globsValue = value["globs"];
  if (!Array.isArray(globsValue)) {
    problems.add(
      `${where}.globs must be an array, found ${describeType(globsValue)}`,
    );
    return null;
  }
  const globs: string[] = [];
  let wellFormed = true;
  globsValue.forEach((glob, index) => {
    const globWhere = `${where}.globs[${String(index)}]`;
    if (!requireString(glob, globWhere, problems)) {
      wellFormed = false;
    } else if (holdsLoneSurrogate(glob)) {
      problems.add(
        `${globWhere} ${JSON.stringify(glob)} holds a lone surrogate, ` +
          `which no valid UTF-8 encodes — no configured glob holds one, ` +
          `and globs match as UTF-8 bytes (SPEC 7, 10.7)`,
      );
      wellFormed = false;
    } else if (!compileGlob(glob, "plain").ok) {
      // Plain mode's one compile error is outside-root (SPEC 7).
      problems.add(
        `${globWhere}: the glob ${JSON.stringify(glob)} resolves outside ` +
          `the workspace root, which no configured glob does (SPEC 7, ` +
          `14.14, 10.7)`,
      );
      wellFormed = false;
    } else {
      globs.push(glob);
    }
  });
  return wellFormed ? { kind, globs } : null;
}

function parseRecordedProfile(
  value: unknown,
  where: string,
  problems: Problems,
): RecordedProfile | null {
  if (!isPlainJsonObject(value)) {
    problems.add(`${where} must be an object, found ${describeType(value)}`);
    return null;
  }
  const complete = checkKeys(
    value,
    where,
    ["name", "target", "targets", "boundary", "mode", "edgeKinds"],
    ["targetTags"],
    problems,
  );
  const before = problems.list.length;

  const name = value["name"];
  if (
    requireNonEmptyString(name, `${where}.name`, problems) &&
    !isWellFormedArgumentValue(name)
  ) {
    // SPEC 7, 14.14: no configured profile name contains U+FFFD, since
    // configured names are named in arguments — and 12.0 admits as an
    // argument value only valid UTF-8 free of U+FFFD, so a name holding a
    // lone surrogate (which a JSON escape in the file can spell) is no
    // more one `create` can record (10.7). Either makes the session
    // corrupt (SPEC 10.1 → 14.21).
    problems.add(
      `${where}.name ${JSON.stringify(name)} contains ` +
        (name.includes(REPLACEMENT_CHARACTER)
          ? "U+FFFD (REPLACEMENT CHARACTER)"
          : "a lone surrogate, which no valid UTF-8 encodes") +
        ` — no configured profile name does, since configured names are ` +
        `named in arguments, whose values are valid UTF-8 free of U+FFFD ` +
        `(SPEC 7, 12.0, 10.7)`,
    );
  }

  const target = parseRecordedGroup(
    value["target"],
    `${where}.target`,
    "target",
    problems,
  );
  const boundary = parseRecordedGroup(
    value["boundary"],
    `${where}.boundary`,
    "boundary",
    problems,
  );

  const targets = value["targets"];
  if (targets !== "leaves" && targets !== "all") {
    problems.add(
      `${where}.targets must be "leaves" or "all", found ${describeType(targets)}`,
    );
  }

  const mode = value["mode"];
  if (mode !== "direct" && mode !== "transitive") {
    problems.add(
      `${where}.mode must be "direct" or "transitive", found ${describeType(mode)}`,
    );
  }

  const edgeKindsValue = value["edgeKinds"];
  const edgeKinds: DependencyEdgeKind[] = [];
  if (!Array.isArray(edgeKindsValue) || edgeKindsValue.length === 0) {
    problems.add(
      `${where}.edgeKinds must be a non-empty array of dependency edge ` +
        `kinds (SPEC 7.4), found ${describeType(edgeKindsValue)}`,
    );
  } else {
    edgeKindsValue.forEach((edgeKind, index) => {
      if (
        typeof edgeKind !== "string" ||
        !(DEPENDENCY_EDGE_KINDS as readonly string[]).includes(edgeKind)
      ) {
        problems.add(
          `${where}.edgeKinds[${String(index)}] must be one of ` +
            `${DEPENDENCY_EDGE_KINDS.join(", ")}, found ` +
            describeType(edgeKind),
        );
      } else {
        edgeKinds.push(edgeKind as DependencyEdgeKind);
      }
    });
  }

  let targetTags: string[] | undefined;
  if (Object.hasOwn(value, "targetTags")) {
    const tagsValue = value["targetTags"];
    if (!Array.isArray(tagsValue) || tagsValue.length === 0) {
      problems.add(
        `${where}.targetTags must be a non-empty array of tags when ` +
          `present (SPEC 7.4), found ${describeType(tagsValue)}`,
      );
    } else {
      targetTags = [];
      tagsValue.forEach((tag, index) => {
        if (
          requireNonEmptyString(
            tag,
            `${where}.targetTags[${String(index)}]`,
            problems,
          )
        ) {
          targetTags?.push(tag);
        }
      });
    }
  }

  if (!complete || problems.list.length > before) {
    return null;
  }
  // SPEC 7.4: `targetTags` and `edgeKinds` are read as sets — a recorded
  // list in any order, a repeated element included, means its set, held in
  // the 12.7 value forms (tag sets in byte order, kind sets in 5.2's order)
  // like the configured lists a `create` records (core/config.ts).
  return {
    name: name as string,
    target: target as RecordedGroup,
    targetTags:
      targetTags === undefined ? undefined : byteOrderedSet(targetTags),
    targets: targets as "leaves" | "all",
    boundary: boundary as RecordedGroup,
    mode: mode as "direct" | "transitive",
    edgeKinds: dependencyKindSet(edgeKinds),
  };
}

/**
 * SPEC 10.7: the form of a recorded baseline commit — a full commit object
 * name, the identity git's `rev-parse` prints for the commit `--base`
 * resolved to: 40 hexadecimal digits (SHA-1) or 64 (SHA-256). The product
 * records lowercase; git reads either case.
 */
const RECORDED_COMMIT = /^(?:[0-9a-fA-F]{40}|[0-9a-fA-F]{64})$/;

/**
 * SPEC 10.1: the recorded creation parameters well-formed, per strategy
 * (SPEC 10.7): `{base}` for `path-blocks`, nothing for `audit`, `{profile}`
 * for `coverage` — each in the form `create` records. A baseline session
 * records the commit identity `--base` resolved to, never a ref spelling,
 * so its baseline never moves with a ref (10.7): the recorded identity's
 * form is part of well-formedness, and a ref name, an abbreviation, or any
 * other text makes the session corrupt (14.21). Whether a well-formed
 * identity still resolves and reconstructs stays a use-time concern, never
 * corruption: a usage error at its place in the order of 10.7 (6.3, 12.0).
 */
function parseParameters(
  strategy: ReviewStrategy,
  value: unknown,
  problems: Problems,
): SessionParameters | null {
  const where = "the recorded creation parameters (creationParameters)";
  if (!isPlainJsonObject(value)) {
    problems.add(`${where} must be an object, found ${describeType(value)}`);
    return null;
  }
  switch (strategy) {
    case "path-blocks": {
      if (!checkKeys(value, where, ["base"], [], problems)) return null;
      const base = value["base"];
      if (
        !requireNonEmptyString(
          base,
          `${where}.base (the resolved baseline commit, SPEC 10.7)`,
          problems,
        )
      ) {
        return null;
      }
      if (!RECORDED_COMMIT.test(base)) {
        problems.add(
          `${where}.base ${JSON.stringify(base)} is not a full commit ` +
            `object name (40 or 64 hexadecimal digits) — a baseline ` +
            `session records the commit identity --base resolved to at ` +
            `creation, never a ref name or an abbreviation, so its ` +
            `baseline never moves with a ref (SPEC 10.1, 10.7)`,
        );
        return null;
      }
      return { strategy, baseCommit: base };
    }
    case "audit": {
      // SPEC 10.7: an audit session records none.
      if (!checkKeys(value, where, [], [], problems)) return null;
      return { strategy };
    }
    case "coverage": {
      if (!checkKeys(value, where, ["profile"], [], problems)) return null;
      const profile = parseRecordedProfile(
        value["profile"],
        `${where}.profile`,
        problems,
      );
      return profile === null ? null : { strategy, profile };
    }
  }
}

/**
 * The recorded decompositions (SPEC 10.7) a document stores: in format 5
 * (`headed`), the entries after the fixed head element, which must open
 * the array and appear nowhere else (module header, "Stored layout");
 * in formats 1 to 4, every entry.
 */
function parseDecompositions(
  value: unknown,
  headed: boolean,
  problems: Problems,
): RecordedDecomposition[] {
  const where = "the recorded decompositions (decompositions)";
  if (!Array.isArray(value)) {
    problems.add(`${where} must be an array, found ${describeType(value)}`);
    return [];
  }
  if (headed && (value.length === 0 || value[0] !== DECOMPOSITIONS_HEAD)) {
    problems.add(
      `${where} must open with the head element null, found ` +
        (value.length === 0 ? "an empty array" : describeType(value[0])),
    );
    return [];
  }
  const decompositions: RecordedDecomposition[] = [];
  const seen = new Set<string>();
  value.forEach((entry, index) => {
    if (headed && index === 0) return;
    const entryWhere = `${where}[${String(index)}]`;
    if (!isPlainJsonObject(entry)) {
      problems.add(
        `${entryWhere} must be an object, found ${describeType(entry)}`,
      );
      return;
    }
    if (!checkKeys(entry, entryWhere, ["kind", "scope"], [], problems)) {
      return;
    }
    const kind = entry["kind"];
    if (kind !== "subtree-coherence") {
      // SPEC 10.7: only subtree-coherence items are ever split.
      problems.add(
        `${entryWhere}.kind must be "subtree-coherence" (SPEC 10.7), found ` +
          (typeof kind === "string"
            ? JSON.stringify(kind)
            : describeType(kind)),
      );
      return;
    }
    const scope = entry["scope"];
    if (!requireNonEmptyString(scope, `${entryWhere}.scope`, problems)) {
      return;
    }
    const key = `${kind} ${scope}`;
    if (seen.has(key)) {
      problems.add(
        `${entryWhere} records the already-decomposed scope node ` +
          `${JSON.stringify(scope)} a second time`,
      );
      return;
    }
    seen.add(key);
    decompositions.push({ kind, scope });
  });
  return decompositions;
}

function requireCount(
  value: unknown,
  where: string,
  minimum: number,
  problems: Problems,
): number | null {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum
  ) {
    problems.add(
      `${where} must be an integer >= ${String(minimum)}, found ` +
        (typeof value === "number" ? String(value) : describeType(value)),
    );
    return null;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Formats 2 and 3: the stored tables and index lists (module header)
// ---------------------------------------------------------------------------

/** One index-list token (module header, `encodeIndexList`): an index, an
 * ascending run `i-j`, or a repeat `i*k`, numbers in canonical decimal. */
const INDEX_TOKEN = /^(0|[1-9][0-9]{0,15})(?:([*-])(0|[1-9][0-9]{0,15}))?$/;

/**
 * Decode one stored index list (`encodeIndexList`): every index below
 * `bound` (its table's length), the list at most `limit` long — a run's or
 * repeat's length judged before it expands, so no list outgrows the limit
 * — and `i*k` accepted only where `repeats`. Null, reported, otherwise.
 */
function decodeIndexList(
  value: unknown,
  where: string,
  bound: number,
  limit: number,
  repeats: boolean,
  problems: Problems,
): number[] | null {
  if (typeof value !== "string") {
    problems.add(
      `${where} must be an index list (a string), found ${describeType(value)}`,
    );
    return null;
  }
  const indices: number[] = [];
  if (value === "") return indices;
  for (const token of value.split(" ")) {
    const match = INDEX_TOKEN.exec(token);
    if (match === null || (match[2] === "*" && !repeats)) {
      problems.add(
        `${where} holds the malformed token ${JSON.stringify(token)} — an ` +
          `index list's tokens are "i", "i-j"` +
          (repeats ? `, and "i*k"` : "") +
          ` in canonical decimal, separated by single spaces`,
      );
      return null;
    }
    const first = Number(match[1]);
    const operator = match[2];
    const second = Number(match[3]);
    let count = 1;
    if (operator === "-") {
      if (!(second > first)) {
        problems.add(
          `${where} holds the run ${JSON.stringify(token)}, which does not ` +
            `ascend — a run "i-j" has i < j`,
        );
        return null;
      }
      count = second - first + 1;
    } else if (operator === "*") {
      if (!(second >= 2)) {
        problems.add(
          `${where} holds the repeat ${JSON.stringify(token)} — a repeat ` +
            `"i*k" has k >= 2`,
        );
        return null;
      }
      count = second;
    }
    const last = operator === "-" ? second : first;
    if (!Number.isSafeInteger(last) || last >= bound) {
      problems.add(
        `${where} holds the index ${String(last)}, beyond the ` +
          `${String(bound)} entries of the table it indexes`,
      );
      return null;
    }
    if (!Number.isSafeInteger(count) || indices.length + count > limit) {
      problems.add(`${where} lists more than ${String(limit)} entries`);
      return null;
    }
    if (operator === "-") {
      for (let index = first; index <= second; index += 1) {
        indices.push(index);
      }
    } else {
      for (let repeat = 0; repeat < count; repeat += 1) indices.push(first);
    }
  }
  return indices;
}

/**
 * The tables of a document of formats 2 to 5 (module header):
 * `references` — each a canonical reference (`checkCanonicalReference`),
 * none repeated, so an index names one node — `states`, each a recorded
 * node state (SPEC 10.4), and `texts`, each a string. Null, reported, when
 * any entry is malformed: the items' indices then have nothing sound to
 * resolve against.
 */
function parseSessionTables(
  document: Record<string, unknown>,
  journalLength: number | null,
  problems: Problems,
): SessionTables | null {
  const before = problems.list.length;
  const entries = (key: string): readonly unknown[] => {
    const value = document[key];
    if (!Array.isArray(value)) {
      problems.add(
        `the session document's ${key} must be an array, found ` +
          describeType(value),
      );
      return [];
    }
    return value;
  };
  const references: string[] = [];
  const seen = new Set<string>();
  entries("references").forEach((value, index) => {
    const where = `references[${String(index)}]`;
    if (!requireString(value, where, problems)) return;
    if (!checkCanonicalReference(value, where, journalLength, problems)) {
      return;
    }
    if (seen.has(value)) {
      problems.add(
        `${where} repeats the stored reference ${JSON.stringify(value)} — ` +
          `the table holds each reference once`,
      );
      return;
    }
    seen.add(value);
    references.push(value);
  });
  const states: RecordedNodeState[] = [];
  entries("states").forEach((value, index) => {
    const state = parseRecordedNodeState(
      value,
      `states[${String(index)}]`,
      problems,
    );
    if (state !== null) states.push(state);
  });
  const texts: string[] = [];
  entries("texts").forEach((value, index) => {
    if (requireString(value, `texts[${String(index)}]`, problems)) {
      texts.push(value);
    }
  });
  return problems.list.length > before ? null : { references, states, texts };
}

/** No tables: an item recording nothing beyond the session's tables. */
const NO_TABLES: SessionTables = { references: [], states: [], texts: [] };

/**
 * Formats 3 to 5: one item's own tables (module header, "Stored
 * document") — its `references`, `states`, and `texts` members, each
 * optional (a write omits an empty one, so an empty one is malformed) and
 * otherwise an array: each reference canonical (`checkCanonicalReference`)
 * and neither in the session's tables nor repeated, so an index still
 * names one node; each state a recorded node state (SPEC 10.4); each text
 * a string. Null, reported, when any is malformed: the item's indices then
 * have nothing sound to resolve against.
 */
function parseItemTables(
  value: Record<string, unknown>,
  where: string,
  sessionReferences: ReadonlySet<string>,
  journalLength: number | null,
  problems: Problems,
): SessionTables | null {
  const before = problems.list.length;
  const entries = (key: string): readonly unknown[] => {
    if (!Object.hasOwn(value, key)) return [];
    const member = value[key];
    if (!Array.isArray(member)) {
      problems.add(
        `${where}.${key} must be an array, found ${describeType(member)}`,
      );
      return [];
    }
    if (member.length === 0) {
      problems.add(
        `${where}.${key} is an empty array — an item's own table is ` +
          `stored only when it holds an entry`,
      );
    }
    return member;
  };
  const references: string[] = [];
  const seen = new Set<string>();
  entries("references").forEach((entry, index) => {
    const entryWhere = `${where}.references[${String(index)}]`;
    if (!requireString(entry, entryWhere, problems)) return;
    if (!checkCanonicalReference(entry, entryWhere, journalLength, problems)) {
      return;
    }
    if (sessionReferences.has(entry) || seen.has(entry)) {
      problems.add(
        `${entryWhere} repeats the stored reference ` +
          `${JSON.stringify(entry)}, which ` +
          (seen.has(entry)
            ? "the item's own references already hold"
            : "the session's references hold") +
          ` — each reference is stored once`,
      );
      return;
    }
    seen.add(entry);
    references.push(entry);
  });
  const states: RecordedNodeState[] = [];
  entries("states").forEach((entry, index) => {
    const state = parseRecordedNodeState(
      entry,
      `${where}.states[${String(index)}]`,
      problems,
    );
    if (state !== null) states.push(state);
  });
  const texts: string[] = [];
  entries("texts").forEach((entry, index) => {
    if (requireString(entry, `${where}.texts[${String(index)}]`, problems)) {
      texts.push(entry);
    }
  });
  if (problems.list.length > before) return null;
  return references.length + states.length + texts.length === 0
    ? NO_TABLES
    : { references, states, texts };
}

/**
 * The member spellings of formats 2 to 5 (module header): indices into
 * the session's tables, extended — for an item of formats 3 to 5 with
 * tables of its own — by the item's, index i naming the session table's
 * entry i below that table's length n and the item table's entry i − n
 * from it. Every index resolves to its table's own value — so a canonical
 * reference is one string however many items hold it, and a recorded node
 * state one object — and identically spelled recorded states and text
 * entries decode to one shared value, as the in-memory model, readonly
 * throughout, allows (a reader serves one item when its tables are the
 * item's, so no spelling is shared across tables that differ).
 */
class TableReader implements ItemMemberDecoder {
  private readonly stateMaps = new Map<string, RecordedState>();
  private readonly textEntries = new Map<string, RecordedTexts>();
  private readonly referenceCount: number;
  private readonly stateCount: number;
  private readonly textCount: number;

  constructor(
    private readonly tables: SessionTables,
    private readonly own: SessionTables = NO_TABLES,
  ) {
    this.referenceCount = tables.references.length + own.references.length;
    this.stateCount = tables.states.length + own.states.length;
    this.textCount = tables.texts.length + own.texts.length;
  }

  private referenceAt(index: number): string {
    const shared = this.tables.references;
    return index < shared.length
      ? shared[index]
      : this.own.references[index - shared.length];
  }

  private stateAt(index: number): RecordedNodeState {
    const shared = this.tables.states;
    return index < shared.length
      ? shared[index]
      : this.own.states[index - shared.length];
  }

  private textAt(index: number): string {
    const shared = this.tables.texts;
    return index < shared.length
      ? shared[index]
      : this.own.texts[index - shared.length];
  }

  scope(value: unknown, where: string, problems: Problems): string | null {
    if (
      typeof value !== "number" ||
      !Number.isSafeInteger(value) ||
      value < 0 ||
      value >= this.referenceCount
    ) {
      problems.add(
        `${where} must be the index of one of the ` +
          `${String(this.referenceCount)} stored references it can name, ` +
          `found ` +
          (typeof value === "number" ? String(value) : describeType(value)),
      );
      return null;
    }
    return this.referenceAt(value);
  }

  references(value: unknown, where: string, problems: Problems): string[] {
    const indices = decodeIndexList(
      value,
      where,
      this.referenceCount,
      this.referenceCount,
      false,
      problems,
    );
    return indices === null
      ? []
      : indices.map((index) => this.referenceAt(index));
  }

  state(value: unknown, where: string, problems: Problems): RecordedState {
    const empty: RecordedState = { nodes: {} };
    if (!isPlainJsonObject(value)) {
      problems.add(`${where} must be an object, found ${describeType(value)}`);
      return empty;
    }
    if (!checkKeys(value, where, ["nodes", "states"], [], problems)) {
      return empty;
    }
    const nodesValue = value["nodes"];
    const statesValue = value["states"];
    const key =
      typeof nodesValue === "string" && typeof statesValue === "string"
        ? `${nodesValue}|${statesValue}`
        : null;
    const known = key === null ? undefined : this.stateMaps.get(key);
    if (known !== undefined) return known;
    const nodes = this.distinctNodes(nodesValue, `${where}.nodes`, problems);
    if (nodes === null) return empty;
    const states = decodeIndexList(
      statesValue,
      `${where}.states`,
      this.stateCount,
      nodes.length,
      true,
      problems,
    );
    if (states === null) return empty;
    if (states.length !== nodes.length) {
      problems.add(
        `${where}.states lists ${String(states.length)} states for ` +
          `${String(nodes.length)} nodes — one recorded state per node`,
      );
      return empty;
    }
    const recorded: Record<string, RecordedNodeState> = {};
    nodes.forEach((index, at) => {
      recorded[this.referenceAt(index)] = this.stateAt(states[at]);
    });
    const state: RecordedState = { nodes: recorded };
    if (key !== null) this.stateMaps.set(key, state);
    return state;
  }

  texts(value: unknown, where: string, problems: Problems): RecordedTextTable {
    if (!isPlainJsonObject(value)) {
      problems.add(`${where} must be an object, found ${describeType(value)}`);
      return {};
    }
    if (!checkKeys(value, where, TEXT_KINDS, [], problems)) return {};
    const table: Record<string, RecordedTexts> = {};
    const ownTextOf = new Map<string, number>();
    for (const kind of TEXT_KINDS) {
      const kindWhere = `${where}.${kind}`;
      const entries = value[kind];
      if (!isPlainJsonObject(entries)) {
        problems.add(
          `${kindWhere} must be an object, found ${describeType(entries)}`,
        );
        return {};
      }
      if (!checkKeys(entries, kindWhere, ["nodes", "texts"], [], problems)) {
        return {};
      }
      const nodes = this.distinctNodes(
        entries["nodes"],
        `${kindWhere}.nodes`,
        problems,
      );
      if (nodes === null) return {};
      const texts = decodeIndexList(
        entries["texts"],
        `${kindWhere}.texts`,
        this.textCount,
        nodes.length,
        true,
        problems,
      );
      if (texts === null) return {};
      if (texts.length !== nodes.length) {
        problems.add(
          `${kindWhere}.texts lists ${String(texts.length)} texts for ` +
            `${String(nodes.length)} nodes — one text per node`,
        );
        return {};
      }
      nodes.forEach((index, at) => {
        const reference = this.referenceAt(index);
        if (kind === "ownText") {
          ownTextOf.set(reference, texts[at]);
          table[reference] = this.textEntry(texts[at], null);
        } else {
          table[reference] = this.textEntry(
            ownTextOf.get(reference) ?? null,
            texts[at],
          );
        }
      });
    }
    return table;
  }

  /** A state or text table's nodes: a reference list naming no node twice. */
  private distinctNodes(
    value: unknown,
    where: string,
    problems: Problems,
  ): number[] | null {
    const indices = decodeIndexList(
      value,
      where,
      this.referenceCount,
      this.referenceCount,
      false,
      problems,
    );
    if (indices === null) return null;
    const seen = new Set<number>();
    for (const index of indices) {
      if (seen.has(index)) {
        problems.add(
          `${where} lists the node ` +
            `${JSON.stringify(this.referenceAt(index))} twice`,
        );
        return null;
      }
      seen.add(index);
    }
    return indices;
  }

  /** The snapshot of the given text indices, one object per pair. */
  private textEntry(own: number | null, subtree: number | null): RecordedTexts {
    const key = `${own === null ? "" : String(own)}|${subtree === null ? "" : String(subtree)}`;
    let entry = this.textEntries.get(key);
    if (entry === undefined) {
      entry =
        subtree === null
          ? { ownText: this.textAt(own as number) }
          : own === null
            ? { subtreeText: this.textAt(subtree) }
            : { ownText: this.textAt(own), subtreeText: this.textAt(subtree) };
      this.textEntries.set(key, entry);
    }
    return entry;
  }
}

/**
 * SPEC 10.1: one stored node reference parses as the canonical identity
 * key encoding of the module header — a reference that does not is a
 * session-invariant violation (the product only ever writes canonical
 * references) — and its canonical position stays within the session's
 * write-moment bound (`journalLength`) when that bound itself parsed.
 * Whether the reference parsed (a position beyond the bound is reported
 * all the same).
 */
function checkCanonicalReference(
  reference: string,
  where: string,
  journalLength: number | null,
  problems: Problems,
): boolean {
  const canonical = parseCanonicalIdentity(reference);
  if (canonical === null || canonical.identity.length === 0) {
    problems.add(
      `${where} must be a canonical identity reference of the form ` +
        `"<position>:<identity>" (SPEC 5.4, 10.4), found ` +
        JSON.stringify(reference),
    );
    return false;
  }
  if (journalLength !== null && canonical.position > journalLength) {
    problems.add(
      `${where} records the canonical position ` +
        `${String(canonical.position)}, beyond the session's journalLength ` +
        `${String(journalLength)} — a stored position never exceeds the ` +
        `journal's entry count at the write that stored it (SPEC 5.4, 10.1)`,
    );
  }
  return true;
}

/**
 * SPEC 10.1: every node reference a format-1 item spells out, and every
 * recorded decomposition's, passes `checkCanonicalReference` (the items of
 * formats 2 to 5 index the reference tables, checked whole by
 * `parseSessionTables` and, for an item's own, `parseItemTables`).
 */
function checkCanonicalReferences(
  items: readonly ReviewItem[],
  decompositions: readonly RecordedDecomposition[],
  journalLength: number | null,
  problems: Problems,
): void {
  const check = (reference: string, where: string): void => {
    checkCanonicalReference(reference, where, journalLength, problems);
  };
  items.forEach((item, index) => {
    const where = `items[${String(index)}]`;
    check(item.scope, `${where}.scope`);
    item.scopeDescendants.forEach((reference, at) => {
      check(reference, `${where}.scopeDescendants[${String(at)}]`);
    });
    item.context.forEach((reference, at) => {
      check(reference, `${where}.context[${String(at)}]`);
    });
    item.origin.forEach((reference, at) => {
      check(reference, `${where}.origin[${String(at)}]`);
    });
    item.recordedContext.forEach((reference, at) => {
      check(reference, `${where}.recordedContext[${String(at)}]`);
    });
    for (const [which, state] of [
      ["baseline", item.baseline],
      ["current", item.current],
    ] as const) {
      for (const reference of Object.keys(state.nodes)) {
        check(reference, `a ${where}.${which}.nodes key`);
      }
    }
    for (const [which, table] of [
      ["baselineTexts", item.baselineTexts],
      ["derivedTexts", item.derivedTexts],
    ] as const) {
      for (const reference of Object.keys(table)) {
        check(reference, `a ${where}.${which} key`);
      }
    }
  });
  decompositions.forEach((decomposition, index) => {
    check(decomposition.scope, `decompositions[${String(index)}].scope`);
  });
}

/**
 * SPEC 10.1: item `id`s unique within the session; `blockedBy` naming only
 * item `id`s present in the session and containing no cycle; at most one
 * item per kind and scope node, and none whose kind and scope node are
 * recorded as decomposed (10.5, 10.7) — both byte-wise over the stored
 * canonical references, which is canonical comparison (SPEC 10.4, module
 * header).
 */
function checkSessionInvariants(
  items: readonly ReviewItem[],
  decompositions: readonly RecordedDecomposition[],
  problems: Problems,
): void {
  const byId = new Map<string, ReviewItem>();
  for (const item of items) {
    if (byId.has(item.id)) {
      problems.add(
        `duplicate item id ${JSON.stringify(item.id)} — item ids must be ` +
          `unique within the session (SPEC 10.2)`,
      );
    } else {
      byId.set(item.id, item);
    }
  }

  const byKindAndScope = new Set<string>();
  for (const item of items) {
    const key = `${item.kind} ${item.scope}`;
    if (byKindAndScope.has(key)) {
      problems.add(
        `two items share kind ${JSON.stringify(item.kind)} and scope node ` +
          `${JSON.stringify(item.scope)} — a session never contains two ` +
          `items with the same kind and scope node (SPEC 10.5)`,
      );
    } else {
      byKindAndScope.add(key);
    }
  }

  // SPEC 10.1, 10.5, 10.7: a kind and scope node recorded as decomposed is
  // never added back — its decomposition's items stand in its place — so an
  // item carrying one violates the session's invariants. One problem per
  // offending item, in stored item order.
  const decomposed = new Set(
    decompositions.map(
      (decomposition) => `${decomposition.kind} ${decomposition.scope}`,
    ),
  );
  for (const item of items) {
    if (decomposed.has(`${item.kind} ${item.scope}`)) {
      problems.add(
        `item ${JSON.stringify(item.id)} has kind ` +
          `${JSON.stringify(item.kind)} and scope node ` +
          `${JSON.stringify(item.scope)}, which the session records as ` +
          `decomposed — a decomposed kind and scope node is never added ` +
          `back, its decomposition's items standing in its place ` +
          `(SPEC 10.1, 10.5, 10.7)`,
      );
    }
  }

  for (const item of items) {
    for (const blocker of item.blockedBy) {
      if (!byId.has(blocker)) {
        problems.add(
          `item ${JSON.stringify(item.id)} is blocked by ` +
            `${JSON.stringify(blocker)}, which names no item of the session ` +
            `(SPEC 10.1)`,
        );
      }
    }
  }

  // Cycle detection over the blockedBy graph (SPEC 10.1: no item
  // transitively blocks itself). Iterative coloring keeps validation total
  // whatever the graph size.
  const colors = new Map<string, "visiting" | "done">();
  const reportCycle = (stack: readonly string[], repeated: string): void => {
    const start = stack.indexOf(repeated);
    const cycle = [...stack.slice(start), repeated];
    problems.add(
      `blockedBy contains a cycle: ${cycle.map((id) => JSON.stringify(id)).join(" -> ")} ` +
        `— no item may transitively block itself (SPEC 10.1)`,
    );
  };
  let cycleReported = false;
  for (const root of items) {
    if (colors.has(root.id) || cycleReported) continue;
    // Explicit stack of (id, next blocker index) frames.
    const stack: { id: string; next: number }[] = [{ id: root.id, next: 0 }];
    colors.set(root.id, "visiting");
    while (stack.length > 0 && !cycleReported) {
      const frame = stack[stack.length - 1];
      const item = byId.get(frame.id);
      const blockers = item ? item.blockedBy : [];
      if (frame.next >= blockers.length) {
        colors.set(frame.id, "done");
        stack.pop();
        continue;
      }
      const blocker = blockers[frame.next];
      frame.next += 1;
      if (!byId.has(blocker)) continue; // reported above
      const color = colors.get(blocker);
      if (color === "visiting") {
        reportCycle(
          stack.map((entry) => entry.id),
          blocker,
        );
        cycleReported = true;
      } else if (color === undefined) {
        colors.set(blocker, "visiting");
        stack.push({ id: blocker, next: 0 });
      }
    }
  }
}

/**
 * Parse and validate a session file's bytes (SPEC 10.1): strict UTF-8, one
 * JSON document, the stored shape of this module's header, and every listed
 * session invariant. Any failure yields the collected problems — the
 * session is corrupt (14.21).
 */
export function parseSessionBytes(bytes: Uint8Array): SessionParseResult {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return {
      ok: false,
      problems: ["the session file is not valid UTF-8, so it cannot be parsed"],
    };
  }
  let document: unknown;
  try {
    document = JSON.parse(text);
  } catch (error) {
    return {
      ok: false,
      problems: [
        `the session file cannot be parsed as one JSON document: ` +
          (error as Error).message,
      ],
    };
  }
  return validateSessionDocument(document);
}

/**
 * Validate a parsed session document against the stored shape and the
 * session invariants of SPEC 10.1.
 */
export function validateSessionDocument(document: unknown): SessionParseResult {
  const problems = new Problems();
  if (!isPlainJsonObject(document)) {
    problems.add(
      `the session document must be a JSON object, found ${describeType(document)}`,
    );
    return { ok: false, problems: problems.list };
  }
  // Module header: formats 1 to 4 are read beside format 5, every
  // write's; a document of any other version is judged against format 5's
  // shape.
  const version = document["version"];
  const format1 = version === FORMAT_1_VERSION;
  const format2 = version === FORMAT_2_VERSION;
  const format3 = version === FORMAT_3_VERSION;
  const format4 = version === FORMAT_4_VERSION;
  checkKeys(
    document,
    "the session document",
    format1
      ? FORMAT_1_DOCUMENT_KEYS
      : format2 || format3
        ? TABLE_DOCUMENT_KEYS
        : DOCUMENT_KEYS,
    [],
    problems,
  );
  if (
    version !== SESSION_VERSION &&
    !format1 &&
    !format2 &&
    !format3 &&
    !format4
  ) {
    problems.add(
      `the session document's version must be ${String(SESSION_VERSION)} ` +
        `(or ${String(FORMAT_4_VERSION)}, ${String(FORMAT_3_VERSION)}, ` +
        `${String(FORMAT_2_VERSION)}, or ${String(FORMAT_1_VERSION)}, the ` +
        `earlier formats), found ` +
        (typeof version === "number" ? String(version) : describeType(version)),
    );
  }

  const strategyValue = document["strategy"];
  let strategy: ReviewStrategy | null = null;
  if (
    strategyValue === "path-blocks" ||
    strategyValue === "audit" ||
    strategyValue === "coverage"
  ) {
    strategy = strategyValue;
  } else {
    problems.add(
      `the session document's strategy must be "path-blocks", "audit", or ` +
        `"coverage", found ` +
        (typeof strategyValue === "string"
          ? JSON.stringify(strategyValue)
          : describeType(strategyValue)),
    );
  }

  const parameters =
    strategy === null
      ? null
      : parseParameters(strategy, document["creationParameters"], problems);

  // Format 5 opens its decompositions with the fixed head element (module
  // header, "Stored layout"); formats 1 to 4 store the recorded ones alone.
  const decompositions = parseDecompositions(
    document["decompositions"],
    !format1 && !format2 && !format3 && !format4,
    problems,
  );

  const journalLength = requireCount(
    document["journalLength"],
    "the session document's journalLength",
    0,
    problems,
  );
  // Formats 1 to 3 store the counter their writes took `item-<n>` ids
  // from (module header): checked as those formats were, then unused —
  // formats 4 and 5 store none, every id they add being derived.
  if (format1 || format2 || format3) {
    requireCount(
      document["nextItemId"],
      "the session document's nextItemId",
      1,
      problems,
    );
  }

  // The items of formats 2 to 5 index the tables, decoded first; with a
  // malformed table they have nothing to resolve against, and the session
  // is already corrupt.
  const tables = format1
    ? undefined
    : parseSessionTables(document, journalLength, problems);
  const members: ItemMemberDecoder | null =
    tables === undefined
      ? FORMAT_1_MEMBERS
      : tables === null
        ? null
        : new TableReader(tables);
  // Formats 3 to 5: an item's own tables extend the session's for that item
  // alone (module header); a reference the session's tables hold is never
  // an item's own.
  const sessionReferences =
    tables === undefined || tables === null || format2
      ? null
      : new Set(tables.references);
  const itemMembers = (
    value: unknown,
    where: string,
  ): ItemMemberDecoder | null => {
    if (sessionReferences === null || !isPlainJsonObject(value)) {
      return members;
    }
    const own = parseItemTables(
      value,
      where,
      sessionReferences,
      journalLength,
      problems,
    );
    if (own === null || own === NO_TABLES) {
      return own === null ? null : members;
    }
    return new TableReader(tables as SessionTables, own);
  };

  const itemsValue = document["items"];
  const items: ReviewItem[] = [];
  if (!Array.isArray(itemsValue)) {
    problems.add(
      `the session document's items must be an array, found ` +
        describeType(itemsValue),
    );
  } else if (members !== null) {
    const optional =
      sessionReferences === null
        ? ITEM_OPTIONAL_KEYS
        : OWN_TABLE_ITEM_OPTIONAL_KEYS;
    itemsValue.forEach((value, index) => {
      const where = `items[${String(index)}]`;
      const decoder = itemMembers(value, where);
      if (decoder === null) return;
      const item = parseItem(value, where, problems, decoder, optional);
      if (item !== null) {
        items.push(item);
      }
    });
    // The invariants are meaningful only over well-formed items; a
    // malformed item has already made the session corrupt above.
    checkSessionInvariants(items, decompositions, problems);
  }
  checkCanonicalReferences(
    format1 ? items : [],
    decompositions,
    journalLength,
    problems,
  );

  if (!problems.empty || parameters === null || tables === null) {
    return { ok: false, problems: problems.list };
  }
  return {
    ok: true,
    session: {
      parameters,
      decompositions,
      journalLength: journalLength as number,
      items,
      // Module header: a format-1 file's tables are those its creating
      // traversal builds over its items as read — a function of the file
      // alone, so every copy's first write stores the same tables.
      tables: tables ?? creationTables(items),
    },
  };
}

/** A format-1 document's members (module header). */
const FORMAT_1_DOCUMENT_KEYS = [
  "creationParameters",
  "decompositions",
  "items",
  "journalLength",
  "nextItemId",
  "strategy",
  "version",
] as const;

/** A format-2 or format-3 document's members (module header): format
 * 1's and the tables. */
const TABLE_DOCUMENT_KEYS = [
  ...FORMAT_1_DOCUMENT_KEYS,
  "references",
  "states",
  "texts",
] as const;

/** A format-4 or format-5 document's members (module header): format 3's
 * but the id counter `nextItemId`, which formats 4 and 5 store no longer. */
const DOCUMENT_KEYS: readonly string[] = TABLE_DOCUMENT_KEYS.filter(
  (key) => key !== "nextItemId",
);

/** Session names in byte order (SPEC 10.7 `list`; 12.0). */
export function sortSessionNames(names: readonly string[]): string[] {
  return [...names].sort(compareBytes);
}
