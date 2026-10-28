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
// `baseline`, `current`, and `creationParameters` are recorded,
// product-shaped data: the adapter requires their presence and passes their
// decoded JSON through whole for the tests to compare (T10.2-2/4, T10.7-2).
// A test asserting a recorded state's node entries — which nodes it holds,
// each one's presence, and its hashes or the explicit absent marker (SPEC
// 10.2, 10.4; T10.5-8) — reads `baseline` or `current` further through
// `decodeRecordedState`, which decodes the RecordedState shape below and
// fails loudly on any other (H-3), never reading a state as empty.
// The recorded decompositions are decoded one level further: each one's kind
// and scope node, both required (SPEC 10.7: a decomposition is "the
// original's kind and scope node"; T10.4-4, T10.7-8), any other member a
// product records beside them passed over unread.
//
// Item IDs (SPEC 10.2, 12.0; T10.2-1): every item ID the family presents —
// a `status` row's `id`, an item's `id` at `next`, `show`, and `export`,
// and each `blockedBy` entry — decodes through `decodeItemId`, which
// requires a well-formed argument value (12.0): valid UTF-8, so no
// unpaired surrogate (no UTF-8 encodes one), and free of U+FFFD — the two
// things 12.0's argument-value rule bars, and 10.2 bounds every item ID by
// it so that every item is nameable as an `<item-id>` operand. That bound
// is SPEC's, never a fixture value (H-3), so every test observing an item
// ID — P-9's draws included — fails loudly on one outside it.
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
//     { "name", "strategy", "creationParameters",
//       "decompositions": [ { "kind", "scope" } ] | null,
//       "items": [Item] }
//     (each recorded decomposition the decomposed original's item kind and
//     its scope node's identity, under the current identity (10.4), in the
//     product's order — 10.7 fixes none; `null`, like `[]`, none recorded —
//     decode.ts's `requiredMember` convention for recorded data)
//   Item = { "id", "kind", "status", "blocked", "blockedBy": [id...],
//            "reason", "note"?,
//            "scope": NodeState, "scopeNodes"?: [NodeState],
//            "context": [NodeState],
//            "origin": [ { "node", "before": Side, "after": Side,
//                          "sourceRange"? } ],
//            "metadata"?: { "before": MetaSide, "after": MetaSide },
//            "baseline", "current" }
//     ("metadata" required on a metadata-consistency item — its scope
//     node's metadata pair, SPEC 10.7, T10.7-13 — and never read on another
//     kind. "scope" is the scope root, the one scope node 10.7 gives a
//     text; "scopeNodes" lists every node of the item's scope — SPEC 10.7:
//     the payload presents every scope, context, and origin node, under its
//     current identity and presence (10.4), a present one with its source
//     range — as last assigned (10.4): the scope root and, for a
//     subtree-coherence item, each node beneath it in its scope (10.5, 10.6),
//     in any order (10.7 fixes none; tests compare a set). Decoded wherever
//     a document carries it; a test asserting an item's scope set reads it
//     through `requireScopeNodes`, which fails loudly where it is absent —
//     required information, H-3 — while a test asserting none passes it by)
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
//   RecordedState — an item's "baseline" and "current", as
//   `decodeRecordedState` reads them =
//     { "nodes": { <identity>: { "present": bool,
//                                "hashes": { <hash name>: hash, ... }
//                                        | "absent" } } }
//     (one member per recorded node — every scope, context, and origin node
//     the state records, 10.4 — keyed by its current identity, 10.4, in the
//     product's order: 10.7 fixes none, so tests look entries up by node;
//     "hashes" holds the recorded hashes under 5.5's four names — the
//     item's relevant hashes, 10.4, `{}` for a node whose presence alone is
//     recorded, any other member passed over unread — or is the explicit
//     absent marker an absent node's hashes are recorded as, 10.4, spelled
//     "absent". Value-blind: an absent node's hashes recorded as values, or
//     a present node's as the marker, decodes as recorded, for the tests to
//     judge.)

import type {
  ExportReport,
  MetadataPair,
  MetadataSide,
  NextReport,
  NodeHashes,
  NodeTextState,
  OriginEntry,
  OriginTextSide,
  RecordedDecomposition,
  RecordedNodeEntry,
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
  NODE_HASH_NAMES,
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
import { fail } from "../assertions.js";

/**
 * U+FFFD (REPLACEMENT CHARACTER), built from its code point so no tool
 * layer can decode or normalize the spelling on the way into this file.
 */
const REPLACEMENT_CHARACTER = String.fromCodePoint(0xfffd);

/**
 * The UTF-16 index of the first unpaired surrogate in `text` — a code unit
 * no UTF-8 byte sequence encodes — or `undefined` when every surrogate
 * belongs to a pair.
 */
function firstUnpairedSurrogate(text: string): number | undefined {
  for (let index = 0; index < text.length; index += 1) {
    const unit = text.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = text.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        index += 1;
        continue;
      }
      return index;
    }
    if (unit >= 0xdc00 && unit <= 0xdfff) return index;
  }
  return undefined;
}

/**
 * An item ID wherever a `review` output presents one — a `status` row's
 * `id`, an item's `id`, a `blockedBy` entry (SPEC 10.2; T10.2-1): a
 * non-empty string that is a well-formed argument value (12.0) — its bytes
 * valid UTF-8, so no unpaired surrogate, and free of U+FFFD, the two things
 * 12.0's argument-value rule bars — so that every item is nameable as an
 * `<item-id>` operand. 10.2 bounds every item ID by that rule, a spec-fixed
 * bound and not a fixture value (H-3), so an ID outside it fails loudly at
 * every decode, whichever test observes it.
 */
function decodeItemId(value: unknown, site: DecodeSite): string {
  const id = expectNonEmptyString(value, site);
  const defects: string[] = [];
  const replacement = id.indexOf(REPLACEMENT_CHARACTER);
  if (replacement !== -1) {
    defects.push(`U+FFFD at UTF-16 index ${String(replacement)}`);
  }
  const unpaired = firstUnpairedSurrogate(id);
  if (unpaired !== undefined) {
    defects.push(
      `an unpaired surrogate at UTF-16 index ${String(unpaired)}, which no ` +
        `UTF-8 encodes`,
    );
  }
  if (defects.length === 0) return id;
  decodeFail(
    site,
    `an item ID that is a well-formed argument value (SPEC 10.2, 12.0: ` +
      `valid UTF-8 and free of U+FFFD, so that every item is nameable as ` +
      `an <item-id> operand; TEST-SPEC T10.2-1), not one holding ` +
      defects.join(" and "),
    value,
  );
}

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
    id: decodeItemId(requiredKey(obj, "id", site), at(site, "id")),
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
 * applied). Each row's id is an item ID in 12.0's well-formed form
 * (`decodeItemId`; T10.2-1).
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
 * without it — and never read on another kind. The item's `id` and each
 * `blockedBy` entry are item IDs in 12.0's well-formed form
 * (`decodeItemId`; SPEC 10.2, T10.2-1).
 */
export function decodeReviewItemValue(
  value: unknown,
  site: DecodeSite,
): ReviewItem {
  const obj = expectObject(value, site);
  const blockedBySite = at(site, "blockedBy");
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
    scopeNodes?: readonly NodeTextState[];
    context: readonly NodeTextState[];
    origin: readonly OriginEntry[];
    metadata?: MetadataPair;
    baseline: unknown;
    current: unknown;
  } = {
    id: decodeItemId(requiredKey(obj, "id", site), at(site, "id")),
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
    blockedBy: expectArray(
      requiredKey(obj, "blockedBy", site),
      blockedBySite,
    ).map((element, index) => decodeItemId(element, at(blockedBySite, index))),
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
  // Every scope node (SPEC 10.7), each in the payload node form — identity,
  // presence, a source range only when present — decoded wherever the
  // document carries the list; `requireScopeNodes` makes it required where
  // a test asserts an item's scope set.
  const scopeNodes = optionalKey(obj, "scopeNodes");
  if (scopeNodes !== undefined) {
    const scopeNodesSite = at(site, "scopeNodes");
    item.scopeNodes = expectArray(scopeNodes, scopeNodesSite).map(
      (element, index) =>
        decodeNodeTextState(element, at(scopeNodesSite, index)),
    );
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

/**
 * Every node of a decoded item's scope as its payload presents it — the
 * scope as last assigned (SPEC 10.4), each under its current identity and
 * presence, a present one with its source range (10.7: the payload presents
 * every scope, context, and origin node) — required information for a test
 * asserting an item's scope set (TEST-SPEC T10.5-5: a matched item's scope
 * presented without a child authored after its last assignment until the
 * re-derivation takes the generated scope, and with it after). The list is
 * the assumed member "scopeNodes" (the module header); a payload carrying
 * none fails loudly here (H-3), never read as the scope root alone — which
 * the separate `scope` member presents with its text.
 */
export function requireScopeNodes(
  item: ReviewItem,
  context: string,
): readonly NodeTextState[] {
  if (item.scopeNodes !== undefined) return item.scopeNodes;
  return fail(
    `${context}: item ${item.id}'s payload must present every node of its ` +
      `scope — the scope root ${JSON.stringify(item.scope.node)} and, for ` +
      `a subtree-coherence item, each node beneath it in its scope as last ` +
      `assigned — under its current identity and presence, a present one ` +
      `with its source range (SPEC 10.4, 10.7: every scope, context, and ` +
      `origin node); the review adapter reads that list from the member ` +
      `"scopeNodes" (its assumed shape), which this payload lacks — ` +
      `required information absent (H-3: adapters fail loudly, never ` +
      `reading the scope root alone as the scope)`,
  );
}

/**
 * The explicit absent marker an absent node's hashes are recorded as (SPEC
 * 10.4) — SPEC fixes no spelling; this is the assumed shape's (the module
 * header's RecordedState).
 */
const RECORDED_ABSENT_MARKER = "absent";

/**
 * Every node entry of a decoded item's recorded state — its `baseline` or
 * its `current` (SPEC 10.2, 10.4) — read from the assumed RecordedState
 * shape (the module header): one `RecordedNodeEntry` per member of the
 * state's `"nodes"` object, in the product's order (10.7 fixes none; tests
 * look entries up by node), its key the node's current identity (10.4), a
 * non-empty string; its `"present"` a boolean; and its `"hashes"` either an
 * object holding the recorded hashes under 5.5's four names, each a
 * non-empty string — any other member passed over unread — or the explicit
 * absent marker (10.4). Required information for a test asserting a
 * recorded state's node entries (T10.5-8: item (3)'s `baseline`, `d`'s
 * entry the absent marker): a state in any other shape fails loudly here
 * (H-3), never read as one holding no entries. Value-blind: which nodes
 * have entries, their presence, and their hashes or marker are the tests'
 * to assert — an absent node's hashes recorded as values, or a present
 * node's as the marker, decodes as recorded.
 */
export function decodeRecordedState(
  item: ReviewItem,
  field: "baseline" | "current",
  context: string,
): readonly RecordedNodeEntry[] {
  const site: DecodeSite = {
    adapter: `review item ${field} (${context}: item ${item.id})`,
    path: `$.${field}`,
  };
  const recorded = expectObject(item[field], site);
  const nodesSite = at(site, "nodes");
  const nodes = expectObject(requiredKey(recorded, "nodes", site), nodesSite);
  return Object.entries(nodes).map(([node, value]): RecordedNodeEntry => {
    const entrySite = at(nodesSite, JSON.stringify(node));
    if (node.length === 0) {
      decodeFail(
        entrySite,
        `a recorded node's identity, a non-empty string (12.7), as its ` +
          `entry's key`,
        node,
      );
    }
    const entry = expectObject(value, entrySite);
    const present = expectBoolean(
      requiredKey(entry, "present", entrySite),
      at(entrySite, "present"),
    );
    const hashesSite = at(entrySite, "hashes");
    const hashes = requiredKey(entry, "hashes", entrySite);
    if (hashes === RECORDED_ABSENT_MARKER) {
      return { node, present, absentMarker: true, hashes: {} };
    }
    if (typeof hashes !== "object" || Array.isArray(hashes)) {
      decodeFail(
        hashesSite,
        `the recorded hashes — an object holding them under 5.5's names — ` +
          `or the explicit absent marker an absent node's hashes are ` +
          `recorded as, ${JSON.stringify(RECORDED_ABSENT_MARKER)} (SPEC ` +
          `10.4; the assumed RecordedState shape)`,
        hashes,
      );
    }
    const held: { -readonly [Name in keyof NodeHashes]?: string } = {};
    for (const name of NODE_HASH_NAMES) {
      const hash = optionalKey(hashes as Record<string, unknown>, name);
      if (hash !== undefined) {
        held[name] = expectNonEmptyString(hash, at(hashesSite, name));
      }
    }
    return { node, present, absentMarker: false, hashes: held };
  });
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
 * One recorded decomposition (SPEC 10.7; T10.4-4, T10.7-8): the decomposed
 * original's kind — an item kind, the spec-fixed vocabulary of 10.4–10.7 —
 * and its scope node's identity, a non-empty string (12.7: an identity is a
 * string), presented under the current identity (10.4). Both are required
 * information, failing loudly when absent (H-3); any other member the
 * product records beside them is passed over, never read. Value-blind: which
 * kind and which node are the tests' to assert.
 */
function decodeRecordedDecomposition(
  value: unknown,
  site: DecodeSite,
): RecordedDecomposition {
  const obj = expectObject(value, site);
  return {
    kind: expectToken(
      requiredKey(obj, "kind", site),
      ITEM_KINDS,
      at(site, "kind"),
    ),
    scope: expectNonEmptyString(
      requiredKey(obj, "scope", site),
      at(site, "scope"),
    ),
  };
}

/**
 * The recorded decompositions `export` presents (SPEC 10.7): a list, each
 * entry decoded by `decodeRecordedDecomposition`, in the product's order
 * (10.7 fixes none) — or `null`, none recorded, the encoding decode.ts's
 * `requiredMember` admits for recorded data, decoded as the empty list.
 * Any other value fails loudly (H-3).
 */
function decodeRecordedDecompositions(
  value: unknown,
  site: DecodeSite,
): readonly RecordedDecomposition[] {
  if (value === null) return [];
  return expectArray(value, site).map((element, index) =>
    decodeRecordedDecomposition(element, at(site, index)),
  );
}

/**
 * `review export` (T10.7-8): one JSON document with name, strategy, the
 * recorded creation parameters (product-shaped, passed through whole) and
 * decompositions (each decoded to its kind and scope node), and every item
 * in item order.
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
    decompositions: decodeRecordedDecompositions(
      requiredMember(obj, "decompositions", site),
      at(site, "decompositions"),
    ),
    items: expectArray(requiredKey(obj, "items", site), itemsSite).map(
      (element, index) => decodeReviewItemValue(element, at(itemsSite, index)),
    ),
  };
}
