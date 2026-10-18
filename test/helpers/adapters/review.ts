// H-3 output adapters — the `review` command family: `list`, `status`,
// `next`, `show`, `export` (SPEC.md 10; TEST-SPEC §10).
//
// Shape-aware, value-blind, fail-loud (H-3) — see query.ts for the layer's
// contract: every document entry runs the 12.7 unavailability-marker walk
// over the whole raw document first (`documentRootSite`, forms.ts), every
// source range decodes through the literal 12.7 range form
// (`decodeSourceRange`), and a metadata pair's coverage attribute and tags
// through 12.7's coverage-attribute and tag-set forms (the string
// "required" or "none"; `decodeTagSet`) — value forms are never adapted
// (T12.7-1, T10.7-13). Adjust the ASSUMED SHAPE below when the real
// product's output shape legitimately differs; never adjust values.
// `baseline`, `current`, `creationParameters`, and `decompositions` are
// recorded, product-shaped data: the adapter requires their presence and
// passes their decoded JSON through whole for the tests to compare
// (T10.2-2/4, T10.7-2).
//
// ASSUMED SHAPE:
//   review list →
//     { "sessions": [ { "name", "corrupt": true }
//                   | { "name", "corrupt": false, "strategy",
//                       "counts": { <status>: n, ... } } ],
//       "findings"?: [Finding] }
//     ("findings" required while any session is listed corrupt: `list`
//     reports each corrupt session's condition 21 (SPEC 14.21) with its
//     stable code (14), and wherever a document carries findings they form
//     the array member "findings" (12.7). Its top-level placement is the
//     assumed shape here; its member name, the 12.7 finding form, and the
//     pinned findings order are universal value forms (H-3), decoded
//     literally — `decodeFindingsArray`, forms.ts — never adapted. A
//     listing with no corrupt session may omit it. The findings' content —
//     count, code, concerned path, locations — is the tests' to assert.)
//   review status →
//     { "items": [ { "id", "kind", "scope", "status", "blocked" } ],
//       "totals": { <status>: n, ... } }
//   review next →
//     { "fullyResolved": bool, "item"?: Item }   ("item" iff not fully resolved)
//   review show → Item (the document is the item)
//   review export →
//     { "name", "strategy", "creationParameters", "decompositions",
//       "items": [Item] }
//   Item = { "id", "kind", "status", "blocked", "blockedBy": [id...],
//            "reason", "note"?,
//            "scope": NodeState, "context": [NodeState],
//            "origin": [ { "node", "before": Side, "after": Side,
//                          "sourceRange"? } ],
//            "metadata"?: { "before": MetaSide, "after": MetaSide },
//            "baseline", "current" }
//     ("metadata" required on a metadata-consistency item — its scope
//     node's metadata pair, SPEC 10.7, T10.7-13 — and never read on another
//     kind)
//   NodeState = { "node", "present": bool, "text"?, "sourceRange"? }
//     (text optional either way: a present node's text is read from the
//     current graph, an absent node's is the recorded value of SPEC 10.7's
//     provenance rule — only a node contained in no recorded state, and a
//     code-impact scope, carries none; sourceRange only when present, since
//     an absent node has no current source)
//   Side = { "present": bool, "text"? }   (text required iff present — the
//     absent side of an origin before/after pair carries no text, SPEC 10.7)
//   MetaSide = { "present": false }
//            | { "present": true, "d": [identity...],
//                "coverage": "required" | "none", "tags": [tag...] }
//     (the scope node's metadata, 5.5, in the side's graph state — the
//     item's baseline state before, the current graph after; a side whose
//     state lacks the node is the absent side, carrying no metadata, SPEC
//     10.7. "d" lists the `d` targets, each under its current identity,
//     10.4, in any order: 10.7 fixes none, so the tests compare them as a
//     set; "coverage" and "tags" are 12.7 value forms, decoded literally)
//   An origin entry's "sourceRange" is the node's CURRENT range: the after
//     side is read from the current graph, so its presence is the node's
//     current presence, and only a currently-present origin node may carry a
//     range — every payload node, origin nodes included, enters with its
//     source range when present and none when absent (SPEC 10.7, 1.7;
//     T10.7-7).

import type {
  ExportReport,
  MetadataPair,
  MetadataSide,
  NextReport,
  NodeTextState,
  OriginEntry,
  OriginTextSide,
  ReviewItem,
  SessionListEntry,
  SessionListReport,
  SessionStatusReport,
  SessionStatusRow,
} from "./model.js";
import {
  COVERAGE_ATTRIBUTE_VALUES,
  ITEM_KINDS,
  ITEM_STATUSES,
} from "./model.js";
import type { DecodeSite } from "./decode.js";
import {
  at,
  decodeFail,
  expectArray,
  expectBoolean,
  expectNonEmptyString,
  expectNonEmptyStringArray,
  expectNonNegativeInteger,
  expectObject,
  expectString,
  expectToken,
  forbiddenKey,
  optionalKey,
  requiredKey,
  requiredMember,
} from "./decode.js";
import {
  decodeFindingsArray,
  decodeTagSet,
  documentRootSite,
} from "./forms.js";
import { decodeSourceRange } from "./query.js";

/** Counts keyed by status: every value a non-negative integer. */
function decodeCounts(
  value: unknown,
  site: DecodeSite,
): Record<string, number> {
  const obj = expectObject(value, site);
  const counts: Record<string, number> = {};
  for (const [key, count] of Object.entries(obj)) {
    counts[key] = expectNonNegativeInteger(count, at(site, key));
  }
  return counts;
}

function decodeSessionListEntry(
  value: unknown,
  site: DecodeSite,
): SessionListEntry {
  const obj = expectObject(value, site);
  const name = expectNonEmptyString(
    requiredKey(obj, "name", site),
    at(site, "name"),
  );
  const corrupt = expectBoolean(
    requiredKey(obj, "corrupt", site),
    at(site, "corrupt"),
  );
  if (corrupt) {
    // T10.1-4: a corrupt session is reported by name, corrupt in place of
    // its fields — a document carrying fields anyway is contradictory.
    forbiddenKey(obj, "strategy", site, "a corrupt session has no fields");
    forbiddenKey(obj, "counts", site, "a corrupt session has no fields");
    return { name, corrupt };
  }
  return {
    name,
    corrupt,
    strategy: expectNonEmptyString(
      requiredKey(obj, "strategy", site),
      at(site, "strategy"),
    ),
    counts: decodeCounts(requiredKey(obj, "counts", site), at(site, "counts")),
  };
}

/**
 * `review list` (T10.7-5): every session in byte order of name — name,
 * strategy, and item counts by stored status; corrupt sessions by name as
 * corrupt — plus the listing's findings. `list` reports each corrupt
 * session's condition 21 (SPEC 14.21, exit 1) with the stable code SPEC 14
 * requires, and wherever a document carries findings they form the array
 * member `"findings"` (12.7): the member's name, the finding form, and the
 * findings order are universal value forms (H-3), so whenever the key
 * exists its value — `null` included, which never encodes emptiness (12.7)
 * — is decoded literally as a 12.7 findings array (`decodeFindingsArray`:
 * every finding form-exact, no usage-error code, the pinned order), never
 * adapted; and the key is required while any session is listed corrupt,
 * since the listing then withholds the condition-21 finding — required
 * information absent, which fails loudly (H-3). Only the member's top-level
 * placement is assumed shape (the module header). A listing with no corrupt
 * session may omit the member — SPEC fixes no member for this unpinned 10.7
 * payload with nothing to report — and the decoded `findings` is then
 * absent: present exactly when the document carries the member. Value-blind
 * (H-3): the findings' content — count, code, concerned path, locations —
 * is the tests' to assert, never this adapter's.
 */
export function decodeSessionListReport(
  doc: unknown,
  context?: string,
): SessionListReport {
  const site = documentRootSite(doc, "review list", context);
  const obj = expectObject(doc, site);
  const sessionsSite = at(site, "sessions");
  const sessions = expectArray(
    requiredKey(obj, "sessions", site),
    sessionsSite,
  ).map((element, index) =>
    decodeSessionListEntry(element, at(sessionsSite, index)),
  );
  const findingsSite = at(site, "findings");
  if (Object.hasOwn(obj, "findings")) {
    return {
      sessions,
      findings: decodeFindingsArray(obj["findings"], findingsSite),
    };
  }
  const corrupt = sessions.find((entry) => entry.corrupt);
  if (corrupt !== undefined) {
    decodeFail(
      findingsSite,
      `a "findings" member while session ${JSON.stringify(corrupt.name)} ` +
        `is listed corrupt — \`review list\` reports each corrupt ` +
        `session's condition 21 (SPEC 14.21) with its stable code (SPEC ` +
        `14), and wherever a document carries findings they form the array ` +
        `member "findings" in the 12.7 finding form (SPEC 12.7, TEST-SPEC ` +
        `H-3: required information absent)`,
      undefined,
    );
  }
  return { sessions };
}

function decodeStatusRow(value: unknown, site: DecodeSite): SessionStatusRow {
  const obj = expectObject(value, site);
  return {
    id: expectNonEmptyString(requiredKey(obj, "id", site), at(site, "id")),
    kind: expectToken(
      requiredKey(obj, "kind", site),
      ITEM_KINDS,
      at(site, "kind"),
    ),
    scope: expectNonEmptyString(
      requiredKey(obj, "scope", site),
      at(site, "scope"),
    ),
    status: expectToken(
      requiredKey(obj, "status", site),
      ITEM_STATUSES,
      at(site, "status"),
    ),
    blocked: expectBoolean(
      requiredKey(obj, "blocked", site),
      at(site, "blocked"),
    ),
  };
}

/**
 * `review status` (T10.7-6): items in item order with id, kind, scope,
 * status, and blocked state, plus totals by status (read-time invalidation
 * applied).
 */
export function decodeSessionStatusReport(
  doc: unknown,
  context?: string,
): SessionStatusReport {
  const site = documentRootSite(doc, "review status", context);
  const obj = expectObject(doc, site);
  const itemsSite = at(site, "items");
  return {
    items: expectArray(requiredKey(obj, "items", site), itemsSite).map(
      (element, index) => decodeStatusRow(element, at(itemsSite, index)),
    ),
    totals: decodeCounts(requiredKey(obj, "totals", site), at(site, "totals")),
  };
}

/**
 * A node presented in a payload: identity plus presence; text is optional for
 * present and absent nodes alike (SPEC 10.7: a present node's text comes from
 * the current graph, an absent node's is the recorded value under the
 * provenance rule — a node contained in no recorded state, and a
 * `code-impact` scope, carries none; T10.2-3, T10.7-12), while a source range
 * exists only for a present node (SPEC 10.7, 1.7: an absent node has no
 * current source).
 */
function decodeNodeTextState(value: unknown, site: DecodeSite): NodeTextState {
  const obj = expectObject(value, site);
  const state: {
    node: string;
    present: boolean;
    text?: string;
    sourceRange?: NodeTextState["sourceRange"];
  } = {
    node: expectNonEmptyString(
      requiredKey(obj, "node", site),
      at(site, "node"),
    ),
    present: expectBoolean(
      requiredKey(obj, "present", site),
      at(site, "present"),
    ),
  };
  const text = optionalKey(obj, "text");
  if (text !== undefined) {
    state.text = expectString(text, at(site, "text"));
  }
  if (!state.present) {
    forbiddenKey(
      obj,
      "sourceRange",
      site,
      "an absent node has no current source, so it is presented without a source range (SPEC 10.7, 1.7)",
    );
    return state;
  }
  const sourceRange = optionalKey(obj, "sourceRange");
  if (sourceRange !== undefined) {
    state.sourceRange = decodeSourceRange(sourceRange, at(site, "sourceRange"));
  }
  return state;
}

/** One side of an origin before/after pair: text required iff present. */
function decodeOriginSide(value: unknown, site: DecodeSite): OriginTextSide {
  const obj = expectObject(value, site);
  const present = expectBoolean(
    requiredKey(obj, "present", site),
    at(site, "present"),
  );
  if (!present) {
    forbiddenKey(obj, "text", site, "an absent side carries no text");
    return { present };
  }
  return {
    present,
    text: expectString(requiredKey(obj, "text", site), at(site, "text")),
  };
}

function decodeOriginEntry(value: unknown, site: DecodeSite): OriginEntry {
  const obj = expectObject(value, site);
  const entry: {
    node: string;
    before: OriginTextSide;
    after: OriginTextSide;
    sourceRange?: OriginEntry["sourceRange"];
  } = {
    node: expectNonEmptyString(
      requiredKey(obj, "node", site),
      at(site, "node"),
    ),
    before: decodeOriginSide(
      requiredKey(obj, "before", site),
      at(site, "before"),
    ),
    after: decodeOriginSide(requiredKey(obj, "after", site), at(site, "after")),
  };
  if (!entry.after.present) {
    // The after side is the node's current presence (SPEC 10.7: after from
    // the current graph), so a currently-absent origin node has no current
    // source and carries no source range (SPEC 10.7, 1.7).
    forbiddenKey(
      obj,
      "sourceRange",
      site,
      "a currently-absent origin node (absent after side) has no current source, so it carries no source range (SPEC 10.7, 1.7)",
    );
    return entry;
  }
  const sourceRange = optionalKey(obj, "sourceRange");
  if (sourceRange !== undefined) {
    entry.sourceRange = decodeSourceRange(sourceRange, at(site, "sourceRange"));
  }
  return entry;
}

/** The members a present metadata side carries; an absent side carries none. */
const METADATA_SIDE_MEMBERS = ["d", "coverage", "tags"] as const;

/**
 * One side of a `metadata-consistency` item's metadata pair (SPEC 10.7,
 * T10.7-13): the scope node's metadata (5.5) in that side's graph state —
 * its `d` targets, each under its current identity (10.4), its coverage
 * attribute, and its tags — all three required while the side is present,
 * none while it is absent (a side whose graph state lacks the node is
 * presented absent, carrying no metadata). The coverage attribute and the
 * tags take 12.7's value forms, decoded literally and never adapted (H-3,
 * T12.7-1): the string `"required"` or `"none"`, and a tag set in byte
 * order with duplicates collapsed (`decodeTagSet`, forms.ts), `[]` for a
 * tagless section. The `d` targets are identities, strings (12.7), passed
 * through in the product's order — 10.7 fixes none, so the tests compare
 * them as a set — an empty set the empty array.
 */
function decodeMetadataSide(value: unknown, site: DecodeSite): MetadataSide {
  const obj = expectObject(value, site);
  const present = expectBoolean(
    requiredKey(obj, "present", site),
    at(site, "present"),
  );
  if (!present) {
    for (const member of METADATA_SIDE_MEMBERS) {
      forbiddenKey(
        obj,
        member,
        site,
        "an absent side carries no metadata (SPEC 10.7: a side whose graph state lacks the node is presented absent)",
      );
    }
    return { present };
  }
  return {
    present,
    d: expectNonEmptyStringArray(requiredKey(obj, "d", site), at(site, "d")),
    coverage: expectToken(
      requiredKey(obj, "coverage", site),
      COVERAGE_ATTRIBUTE_VALUES,
      at(site, "coverage"),
    ),
    tags: decodeTagSet(requiredKey(obj, "tags", site), at(site, "tags")),
  };
}

/**
 * A `metadata-consistency` item's metadata pair (SPEC 10.7, T10.7-13): a
 * before/after pair, both sides required — required information, failing
 * loudly when absent (H-3).
 */
function decodeMetadataPair(value: unknown, site: DecodeSite): MetadataPair {
  const obj = expectObject(value, site);
  return {
    before: decodeMetadataSide(
      requiredKey(obj, "before", site),
      at(site, "before"),
    ),
    after: decodeMetadataSide(
      requiredKey(obj, "after", site),
      at(site, "after"),
    ),
  };
}

/**
 * Decode one full review item (10.2 fields plus the payload of 10.7): a
 * `metadata-consistency` item's payload carries its scope node's metadata
 * pair (SPEC 10.7; T10.7-7, T10.7-13), required on that kind alone — every
 * `next --json`, `show`, and `export` decode of such an item fails loudly
 * without it — and never read on another kind.
 */
export function decodeReviewItemValue(
  value: unknown,
  site: DecodeSite,
): ReviewItem {
  const obj = expectObject(value, site);
  const contextSite = at(site, "context");
  const originSite = at(site, "origin");
  const item: {
    id: string;
    kind: ReviewItem["kind"];
    status: ReviewItem["status"];
    blocked: boolean;
    blockedBy: readonly string[];
    reason: string;
    note?: string;
    scope: NodeTextState;
    context: readonly NodeTextState[];
    origin: readonly OriginEntry[];
    metadata?: MetadataPair;
    baseline: unknown;
    current: unknown;
  } = {
    id: expectNonEmptyString(requiredKey(obj, "id", site), at(site, "id")),
    kind: expectToken(
      requiredKey(obj, "kind", site),
      ITEM_KINDS,
      at(site, "kind"),
    ),
    status: expectToken(
      requiredKey(obj, "status", site),
      ITEM_STATUSES,
      at(site, "status"),
    ),
    blocked: expectBoolean(
      requiredKey(obj, "blocked", site),
      at(site, "blocked"),
    ),
    blockedBy: expectNonEmptyStringArray(
      requiredKey(obj, "blockedBy", site),
      at(site, "blockedBy"),
    ),
    reason: expectNonEmptyString(
      requiredKey(obj, "reason", site),
      at(site, "reason"),
    ),
    scope: decodeNodeTextState(
      requiredKey(obj, "scope", site),
      at(site, "scope"),
    ),
    context: expectArray(requiredKey(obj, "context", site), contextSite).map(
      (element, index) => decodeNodeTextState(element, at(contextSite, index)),
    ),
    origin: expectArray(requiredKey(obj, "origin", site), originSite).map(
      (element, index) => decodeOriginEntry(element, at(originSite, index)),
    ),
    // Recorded relevant state (10.2, 10.4): product-shaped, required to be
    // present, passed through whole for the tests to compare.
    baseline: requiredMember(obj, "baseline", site),
    current: requiredMember(obj, "current", site),
  };
  const note = optionalKey(obj, "note");
  if (note !== undefined) {
    item.note = expectString(note, at(site, "note"));
  }
  if (item.kind === "metadata-consistency") {
    const metadataSite = at(site, "metadata");
    const pair = optionalKey(obj, "metadata");
    if (pair === undefined) {
      decodeFail(
        metadataSite,
        `the scope node's metadata pair — a "metadata" member holding its ` +
          `before and after sides — which a metadata-consistency item's ` +
          `payload carries (SPEC 10.7; T10.7-7, T10.7-13: required ` +
          `information absent, H-3)`,
        obj["metadata"],
      );
    }
    item.metadata = decodeMetadataPair(pair, metadataSite);
  }
  return item;
}

/** `review show <name> <item-id>` (T10.7-8): the full item. */
export function decodeItemReport(doc: unknown, context?: string): ReviewItem {
  return decodeReviewItemValue(
    doc,
    documentRootSite(doc, "review show", context),
  );
}

/**
 * `review next` (T10.7-7): the first needing-review unblocked item in item
 * order with its self-contained payload, or the fully-resolved report with
 * no item. A document claiming both (or neither) is contradictory.
 */
export function decodeNextReport(doc: unknown, context?: string): NextReport {
  const site = documentRootSite(doc, "review next", context);
  const obj = expectObject(doc, site);
  const fullyResolved = expectBoolean(
    requiredKey(obj, "fullyResolved", site),
    at(site, "fullyResolved"),
  );
  if (fullyResolved) {
    forbiddenKey(
      obj,
      "item",
      site,
      "a fully-resolved session reports no item (T10.7-7)",
    );
    return { fullyResolved };
  }
  return {
    fullyResolved,
    item: decodeReviewItemValue(
      requiredKey(obj, "item", site),
      at(site, "item"),
    ),
  };
}

/**
 * `review export` (T10.7-8): one JSON document with name, strategy, the
 * recorded creation parameters and decompositions (product-shaped, passed
 * through whole), and every item in item order.
 */
export function decodeExportReport(
  doc: unknown,
  context?: string,
): ExportReport {
  const site = documentRootSite(doc, "review export", context);
  const obj = expectObject(doc, site);
  const itemsSite = at(site, "items");
  return {
    name: expectNonEmptyString(
      requiredKey(obj, "name", site),
      at(site, "name"),
    ),
    strategy: expectNonEmptyString(
      requiredKey(obj, "strategy", site),
      at(site, "strategy"),
    ),
    creationParameters: requiredMember(obj, "creationParameters", site),
    decompositions: requiredMember(obj, "decompositions", site),
    items: expectArray(requiredKey(obj, "items", site), itemsSite).map(
      (element, index) => decodeReviewItemValue(element, at(itemsSite, index)),
    ),
  };
}
