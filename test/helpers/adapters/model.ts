// The information model the test suite asserts against (TEST-SPEC §0 H-3).
//
// SPEC.md fixes the information content of reports and JSON documents but not
// their concrete shape; TEST-SPEC's assertions are written against the types
// in this file. This module is the *fixed* side of the adapter layer: it
// mirrors what the tests assert (nodes, hashes, edges, categories, counts,
// paths, findings, items, …) and changes only when TEST-SPEC does. The
// decoders beside it (query.ts, reports.ts, review.ts) are the *adjustable*
// side — aware of the product's concrete output shape, adjustable to shape,
// never to values.
//
// Vocabularies below are spec-fixed tokens (they appear literally in SPEC.md
// as configuration values, CLI flag values, category names, statuses, and
// item kinds), so adapters validate membership rather than passing unknown
// tokens through.

/** Edge kinds (SPEC.md 5.2; CLI `--kinds` values, T11-4/T12.0-4). */
export const EDGE_KINDS = [
  "contains",
  "depends",
  "embeds",
  "references",
] as const;
export type EdgeKind = (typeof EDGE_KINDS)[number];

/** The three dependency kinds — `reachable`'s domain (SPEC.md 11, T11-5). */
export const DEPENDENCY_EDGE_KINDS = [
  "depends",
  "embeds",
  "references",
] as const;
export type DependencyEdgeKind = (typeof DEPENDENCY_EDGE_KINDS)[number];

/** Change categories of SPEC.md 5.6 (T5.6-*, T9.1-1). */
export const CHANGE_CATEGORIES = [
  "changed",
  "descendant-changed",
  "upstream-changed",
  "metadata-changed",
] as const;
export type ChangeCategory = (typeof CHANGE_CATEGORIES)[number];

/**
 * Review item statuses (SPEC.md 10.3/10.4): the stored resolve statuses plus
 * `unresolved` and the read-time `invalidated`.
 */
export const ITEM_STATUSES = [
  "unresolved",
  "invalidated",
  "updated",
  "no-change",
  "skipped",
] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

/** Built-in review item kinds (SPEC.md 10.4–10.6, 10.7 coverage sessions). */
export const ITEM_KINDS = [
  "subtree-coherence",
  "parent-consistency",
  "dependency-consistency",
  "metadata-consistency",
  "code-impact",
  "uncovered-requirement",
] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

/** A source range: zero-based byte offsets into the source file (SPEC.md 1.7). */
export interface SourceRange {
  readonly start: number;
  readonly end: number;
}

/** One graph edge: canonical graph-node identities plus kind (SPEC.md 5.2). */
export interface GraphEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: EdgeKind;
}

/** The four hashes of a requirement node (SPEC.md 5.5). Values are opaque. */
export interface NodeHashes {
  readonly ownHash: string;
  readonly subtreeHash: string;
  readonly effectiveHash: string;
  readonly metadataHash: string;
}

/** Full node report: `query node` / `show` (T11-1, T12.4-1). */
export interface NodeReport {
  readonly identity: string;
  readonly sourceRange: SourceRange;
  readonly ownText: string;
  readonly subtreeText: string;
  readonly hashes: NodeHashes;
  readonly tags: readonly string[];
  /** Coverage attribute; absent for root nodes (T1.2-3, T11-1). */
  readonly coverage?: string;
  readonly incomingEdges: readonly GraphEdge[];
  readonly outgoingEdges: readonly GraphEdge[];
}

/** One row of `query nodes`/`subtree`/`ancestors` (T11-2, T11-3). */
export interface NodeRow {
  readonly identity: string;
  readonly sourceRange: SourceRange;
  readonly tags: readonly string[];
  /** Coverage attribute; absent for root nodes. */
  readonly coverage?: string;
}

/**
 * Identity-and-tags summary of a `query node` document — the minimal decoding
 * for tests certified against fixtures whose scoped query surface reports
 * only identity, tags, and metadataHash (CERTIFICATIONS.md §CONF-VALID:
 * T1.4-2, T1.4-4).
 */
export interface NodeSummary {
  readonly identity: string;
  readonly tags: readonly string[];
}

/**
 * Identity/tags/metadataHash summary of a `query node` document — the full
 * CONF-VALID-scoped query surface (CERTIFICATIONS.md §CONF-VALID: fixtures
 * within that scope promise exactly identity, tags, and metadataHash), for
 * the tests comparing tag spellings through the metadata hash (T2.6-1,
 * T2.6-2; SPEC.md 5.5).
 */
export interface NodeMetadataSummary {
  readonly identity: string;
  readonly tags: readonly string[];
  readonly metadataHash: string;
}

/**
 * Own/subtree text summary of a `query node` document — the CONF-MD-scoped
 * query surface (CERTIFICATIONS.md §CONF-MD: fixtures within that scope
 * promise `query node` reporting own and subtree text, SPEC.md 1.6), for the
 * text-algebra property (P-2/P-3). Either text MAY be empty (an empty leaf
 * section, SPEC.md 1.1).
 */
export interface NodeTextSummary {
  readonly ownText: string;
  readonly subtreeText: string;
}

/** `query reachable` (T11-5): existence plus one shortest witness path. */
export interface ReachableReport {
  readonly reachable: boolean;
  /** Node-identity sequence; present exactly when `reachable`. */
  readonly path?: readonly string[];
}

/** `ids` flat form (T12.3-1): files in byte order, IDs in document order. */
export interface IdsReport {
  readonly files: readonly IdsFileEntry[];
}
export interface IdsFileEntry {
  readonly file: string;
  readonly ids: readonly string[];
}

/** `ids --tree` (T12.3-1): per-file nesting. */
export interface IdsTreeReport {
  readonly files: readonly IdsTreeFileEntry[];
}
export interface IdsTreeFileEntry {
  readonly file: string;
  readonly nodes: readonly IdsTreeNode[];
}
export interface IdsTreeNode {
  readonly id: string;
  readonly children: readonly IdsTreeNode[];
}

/**
 * SPEC.md 14's numbered-condition stable code tokens, in ordinal order:
 * index N-1 holds condition 14.N's token. The numeral is the condition's
 * ordinal — it orders findings (SPEC 12.7) and is no part of the code's
 * value, which is the token string alone (SPEC 14, T14-6).
 */
export const CONDITION_CODE_TOKENS = [
  "missing-id", // 14.1
  "invalid-structural-id", // 14.2
  "duplicate-id", // 14.3
  "invalid-segment-or-tag", // 14.4
  "unknown-dependency", // 14.5
  "unknown-text-target", // 14.6
  "unknown-ts-reference", // 14.7
  "invalid-argument", // 14.8
  "cycle", // 14.9
  "stale-output", // 14.10
  "cross-module-text", // 14.11
  "policy-violation", // 14.12
  "journal-error", // 14.13
  "configuration-error", // 14.14
  "invalid-import", // 14.15
  "invalid-construct", // 14.16
  "invalid-prop", // 14.17
  "unsupported-node-usage", // 14.18
  "invalid-source-path", // 14.19
  "unparseable-source", // 14.20
  "corrupt-session", // 14.21
  "obstructed-write-path", // 14.22
  "unreadable-record", // 14.23
] as const;
export type ConditionCodeToken = (typeof CONDITION_CODE_TOKENS)[number];

/**
 * SPEC.md 14's refusal-reason stable codes, in the order 14 lists them —
 * the findings order after the numbered conditions (SPEC 12.7, T14-7).
 */
export const REFUSAL_CODE_TOKENS = [
  "refused-invalid-id",
  "refused-identity-unchanged",
  "refused-id-collision",
  "refused-structural-parent",
  "refused-unresolvable-reference",
  "refused-cycle",
  "refused-destination-exists",
  "refused-missing-target-parent",
  "refused-invalid-destination",
] as const;
export type RefusalCodeToken = (typeof REFUSAL_CODE_TOKENS)[number];

/**
 * The harness-pinned SPEC.md 14 token→condition table: the `14.N` condition
 * identity of a numbered-condition code token, `null` for refusal reasons
 * and code-less findings. The `14.N` spelling is harness vocabulary derived
 * from the token — the reported value is always the token string (12.7) —
 * so condition-identity assertions are assertions against tokens.
 */
export function conditionIdentityOf(code: string | null): string | null {
  if (code === null) return null;
  const index = (CONDITION_CODE_TOKENS as readonly string[]).indexOf(code);
  return index === -1 ? null : `14.${String(index + 1)}`;
}

/**
 * A SPEC.md 12.7 path value: a string where the path's bytes are valid
 * UTF-8, and otherwise the marked byte form of 12.0 — `{"bytes": "…"}`,
 * lowercase hexadecimal, two digits per byte, an object equal to no path
 * string.
 */
export type PathValue = string | MarkedBytePath;
export interface MarkedBytePath {
  readonly bytes: string;
}

/** One finding location: an offending construct's file and range (12.7). */
export interface FindingLocation {
  readonly file: PathValue;
  readonly range: SourceRange;
}

/**
 * One finding in the literal SPEC.md 12.7 form (a form-exact surface, H-3):
 * `code` is the stable token 14 assigns (`null` where 14 assigns none);
 * `message` the human-readable description; `locations` one `{file, range}`
 * per offending construct, ordered by file path bytes, then range start,
 * then range end, empty for conditions without in-source locations; `path`
 * the concerned file or path (`null` for located conditions); `identities`
 * the identities or other context strings the condition names, empty where
 * none. `condition` is NOT a document member: it is the derived `14.N`
 * condition identity of a numbered-condition token (`conditionIdentityOf`),
 * `null` for refusal reasons and code-less findings, kept so existing
 * condition-identity assertions are expressed against the decoded token.
 */
export interface Finding {
  readonly code: string | null;
  readonly message: string;
  readonly locations: readonly FindingLocation[];
  readonly path: PathValue | null;
  readonly identities: readonly string[];
  /** Derived via the pinned token table — never read from the document. */
  readonly condition: string | null;
}

/**
 * A findings-only report — `{"findings": […]}` exactly (SPEC 12.7): a
 * failing `build`'s validation errors, `check`'s findings, the findings of
 * refusing reads (13.3) and refused operations (6.4, 6.5, 10.7).
 */
export interface FindingsReport {
  readonly findings: readonly Finding[];
}

/**
 * The exit-2 error document — `{"error": …}` exactly, holding one finding
 * form (SPEC 12.0, 12.7): with JSON output in effect, an invocation failing
 * with a usage or configuration error emits this document as its entire
 * stdout. For a configuration error the finding carries the stable code and
 * concerned path (14); for a plain usage error `code` and `path` are `null`.
 */
export interface ErrorDocument {
  readonly error: Finding;
}

/**
 * An occurrence record's source graph node — one datum: the node's identity
 * together with that node's own source range (SPEC.md 5.7, 1.7, 12.7).
 */
export interface OccurrenceSourceNode {
  readonly identity: string;
  readonly range: SourceRange;
}

/**
 * The source datum of an occurrence record: the node, or explicitly
 * unavailable as one datum — identity and range withheld together — where
 * 11.2 leaves the source node's identity undefined. Never `null` (12.7).
 */
export type OccurrenceSource =
  OccurrenceSourceNode | { readonly unavailable: true };

/**
 * One reference occurrence record in the literal SPEC.md 12.7 form (a
 * form-exact surface, H-3): `{"file", "range", "kind", "source", "target"}`
 * — the referencing file (a path value: the marked byte form where the
 * path's bytes are not valid UTF-8, 12.0); the occurrence's own range; its
 * edge kind (`"depends"`, `"embeds"`, or `"references"`, 5.2 — `contains`
 * is no reference kind); its source graph node per 11.2; and the resolved
 * target's identity (a string — no identity carries a non-UTF-8 path, 12.0).
 */
export interface OccurrenceRecord {
  readonly file: PathValue;
  readonly range: SourceRange;
  readonly kind: DependencyEdgeKind;
  readonly source: OccurrenceSource;
  readonly target: string;
}

/**
 * The `occurrences` document (SPEC.md 11.3) — `{"findings", "occurrences"}`
 * exactly (12.7): the consulted domain's findings, and one record per
 * occurrence in occurrence order (5.7: by referencing file path bytes, then
 * range start, then range end).
 */
export interface OccurrencesReport {
  readonly findings: readonly Finding[];
  readonly occurrences: readonly OccurrenceRecord[];
}

/** `coverage` (T8.2-1): all profiles by default, one when named. */
export interface CoverageReport {
  readonly profiles: readonly CoverageProfileReport[];
}
export interface CoverageProfileReport {
  readonly name: string;
  readonly counts: CoverageCounts;
  readonly covered: readonly CoveredNode[];
  readonly uncovered: readonly string[];
  readonly ignored: readonly IgnoredNode[];
}
export interface CoverageCounts {
  readonly required: number;
  readonly covered: number;
  readonly uncovered: number;
  readonly ignored: number;
}
export interface CoveredNode {
  readonly identity: string;
  /** One shortest covering path, boundary to target (12.0 tie-break). */
  readonly path: readonly string[];
}
export interface IgnoredNode {
  readonly identity: string;
  /** All applicable reasons, in the fixed order (T8.2-1, `root node` incl.). */
  readonly reasons: readonly string[];
}

/**
 * `impact --base` (SPEC.md 5.6, 9; T9.1-1, T9.2-*, T9.3-*).
 * A requirement entry may cover a collapsed ancestor chain (T9.3-1), so it
 * carries one or more node identities. Deleted nodes report under their
 * (journal-mapped) baseline identities with `deleted` set (T5.6-6, T9.3-3).
 */
export interface ImpactReport {
  /** The resolved baseline commit, when the product echoes it (E-6, H-3). */
  readonly baseline?: string;
  readonly requirements: readonly ImpactRequirementEntry[];
  readonly code: ImpactedCode;
}
export interface ImpactRequirementEntry {
  readonly nodes: readonly string[];
  readonly deleted: boolean;
  readonly categories: readonly ImpactCategoryEntry[];
}
export interface ImpactCategoryEntry {
  readonly category: ChangeCategory;
  /** Attribution identities (T5.6-1/2/3; may be empty for `changed`). */
  readonly attributedTo: readonly string[];
}
export interface ImpactedCode {
  readonly direct: readonly ImpactedCodeEntry[];
  readonly transitive: readonly ImpactedCodeEntry[];
}
export interface ImpactedCodeEntry {
  readonly location: string;
  /** The minimized witness edge (T9.3-2: kind is asserted — `embeds` wins). */
  readonly edge: GraphEdge;
  /** The witness path from the edge's target (T9.3-2). */
  readonly path: readonly string[];
}

/**
 * One identity pair of a successful `rename`/`move`'s applied-mapping report
 * (SPEC.md 6.4, 6.5; T6.4-1, T6.5-1): the operation's report is the complete
 * identity mapping it journaled — the information of the preview's `mapping`
 * (6.6) — carried in JSON per 12.0. The successful operation's report shape
 * is unpinned (H-3), so pair order is a shape choice: tests assert the pairs
 * as a complete set (adapters/operations.ts).
 */
export interface AppliedMappingPair {
  readonly from: string;
  readonly to: string;
}

/** `review list` (T10.7-5): sessions in byte order of name. */
export interface SessionListReport {
  readonly sessions: readonly SessionListEntry[];
}
export type SessionListEntry =
  | { readonly name: string; readonly corrupt: true }
  | {
      readonly name: string;
      readonly corrupt: false;
      readonly strategy: string;
      /** Item counts by stored status (no read-time invalidation). */
      readonly counts: Readonly<Record<string, number>>;
    };

/** `review status` (T10.7-6): rows in item order plus totals by status. */
export interface SessionStatusReport {
  readonly items: readonly SessionStatusRow[];
  /** Totals by status, read-time invalidation applied. */
  readonly totals: Readonly<Record<string, number>>;
}
export interface SessionStatusRow {
  readonly id: string;
  readonly kind: ItemKind;
  readonly scope: string;
  readonly status: ItemStatus;
  readonly blocked: boolean;
}

/**
 * A node presented inside an item payload: identity, presence, and — where
 * the kind's payload contract supplies one — text: read from the current
 * graph for a present node, and for an absent node the recorded value under
 * SPEC.md 10.7's provenance rule (a node contained in no recorded state, and
 * a `code-impact` scope, carries none; T10.2-3, T10.7-12). A source range
 * exists only for a present node (10.7, 1.7).
 */
export interface NodeTextState {
  readonly node: string;
  readonly present: boolean;
  readonly text?: string;
  readonly sourceRange?: SourceRange;
}

/** One side of an origin before/after pair (T10.7-12). */
export type OriginTextSide =
  | { readonly present: false }
  | { readonly present: true; readonly text: string };

/** One origin entry: a node's own text before and after (T10.7-12). */
export interface OriginEntry {
  readonly node: string;
  readonly before: OriginTextSide;
  readonly after: OriginTextSide;
}

/**
 * A full review item as presented by `next --json`, `show`, and `export`
 * (SPEC.md 10.2, 10.7; T10.2-1, T10.7-7/8/12). `baseline` and `current` carry
 * the recorded relevant state; their inner structure is product-shaped and
 * compared whole (as decoded JSON) by the tests that assert them.
 */
export interface ReviewItem {
  readonly id: string;
  readonly kind: ItemKind;
  readonly status: ItemStatus;
  readonly blocked: boolean;
  readonly blockedBy: readonly string[];
  readonly reason: string;
  readonly note?: string;
  readonly scope: NodeTextState;
  readonly context: readonly NodeTextState[];
  readonly origin: readonly OriginEntry[];
  readonly baseline: unknown;
  readonly current: unknown;
}

/** `review next` (T10.7-7): fully resolved, or the first actionable item. */
export interface NextReport {
  readonly fullyResolved: boolean;
  /** Present exactly when not fully resolved. */
  readonly item?: ReviewItem;
}

/** `review export` (T10.7-8): the whole session, one JSON document. */
export interface ExportReport {
  readonly name: string;
  readonly strategy: string;
  /** Recorded creation parameters — product-shaped, compared whole. */
  readonly creationParameters: unknown;
  /** Recorded decompositions — product-shaped, compared whole. */
  readonly decompositions: unknown;
  readonly items: readonly ReviewItem[];
}
