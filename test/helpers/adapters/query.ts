// H-3 output adapters — query-surface commands: `query node`, `show`,
// `query nodes`/`subtree`/`ancestors`, `query edges`, `query reachable`, and
// `ids` (TEST-SPEC §11, T12.3-1, T12.4-1) — plus the SPEC 1.7 bare
// edge-endpoint walk (T1.7-1).
//
// This module is shape-aware and value-blind: it maps the product's concrete
// JSON output onto the information model in model.ts, failing loudly
// (diagnosed test error, never a default) when required information is
// absent or malformed. It is one of the only places aware of concrete output
// shape (H-3); adjust the ASSUMED SHAPE below when the real product's shape
// legitimately differs — never adjust values. Every document entry first runs
// the 12.7 unavailability-marker walk over the whole raw document
// (`documentRootSite`, forms.ts), and every source range decodes through the
// literal 12.7 range form (`decodeSourceRange` below): 12.7's value forms are
// universal, so they are never adapted here (H-3, T12.7-1).
//
// ASSUMED SHAPE (per command; `?` marks optional-per-model information):
//   query node / show →
//     { "identity", "sourceRange": {"start","end"}, "ownText", "subtreeText",
//       "hashes": {"ownHash","subtreeHash","effectiveHash","metadataHash"},
//       "tags": [..], "coverage"?, "edges": {"incoming": [Edge], "outgoing": [Edge]} }
//     Edge = { "from", "to", "kind" }
//   query nodes / subtree / ancestors →
//     { "nodes": [ { "identity", "sourceRange", "tags", "coverage"? } ] }
//   query edges → { "edges": [Edge] }
//   query reachable → { "reachable": bool, "path"?: [identity...] }
//     ("path" present exactly when reachable)
//   ids → { "files": [ { "file", "ids": [id...] } ] }
//   ids --tree → { "files": [ { "file", "nodes": [ { "id", "children": [...] } ] } ] }
//   "tags" on every node surface above is a 12.7 tag set — byte order,
//   duplicates collapsed — decoded form-exact through forms.ts's decodeTagSet
//   and never re-sorted here: the value forms are universal (H-3, T12.7-1;
//   T2.6-1's `query node` tags, T12.4-1's `show`). A section's tags are
//   required (`[]` when tagless, 12.7). A root node's tags are absent (SPEC
//   11.1, 12.4, 5.5): for a root (an identity without `#`, 1.5) "tags" may
//   be `null` or omitted, as its "coverage" may, and decodes to `null`
//   (`decodeNodeTags` below); a root's present "tags" still decodes as a tag
//   set and reaches the body unjudged.

import type {
  GraphEdge,
  IdsFileEntry,
  IdsReport,
  IdsTreeFileEntry,
  IdsTreeNode,
  IdsTreeReport,
  NodeHashes,
  NodeMetadataSummary,
  NodeReport,
  NodeRow,
  NodeSummary,
  NodeTextAlgebraSummary,
  ReachableReport,
  SourceRange,
} from "./model.js";
import { EDGE_KINDS } from "./model.js";
import type { DecodeSite } from "./decode.js";
import {
  at,
  decodeFail,
  expectArray,
  expectBoolean,
  expectNonEmptyString,
  expectNonEmptyStringArray,
  expectObject,
  expectString,
  expectToken,
  forbiddenKey,
  optionalKey,
  requiredKey,
} from "./decode.js";
import { decodeRangeForm, decodeTagSet, documentRootSite } from "./forms.js";

/**
 * Decode a source range (SPEC.md 1.7: zero-based byte offsets) in the
 * literal 12.7 value form — `{"start", "end"}` exactly, non-negative
 * integers, no other member. 12.7's value forms bind every JSON output
 * (H-3), so this adapter's latitude over its surrounding unpinned shape
 * never reaches the range itself: a range carried as `[start, end]`,
 * `{"from", "to"}`, or with an extra member fails the form decode here, and
 * the decode is never adjusted to admit it (T12.7-1's unpinned-surface
 * arms).
 */
export function decodeSourceRange(
  value: unknown,
  site: DecodeSite,
): SourceRange {
  return decodeRangeForm(value, site);
}

/** Decode one edge: from/to graph-node identities plus a spec-fixed kind. */
export function decodeEdge(value: unknown, site: DecodeSite): GraphEdge {
  const obj = expectObject(value, site);
  return {
    from: expectNonEmptyString(
      requiredKey(obj, "from", site),
      at(site, "from"),
    ),
    to: expectNonEmptyString(requiredKey(obj, "to", site), at(site, "to")),
    kind: expectToken(
      requiredKey(obj, "kind", site),
      EDGE_KINDS,
      at(site, "kind"),
    ),
  };
}

function decodeEdgeArray(value: unknown, site: DecodeSite): GraphEdge[] {
  return expectArray(value, site).map((element, index) =>
    decodeEdge(element, at(site, index)),
  );
}

function decodeHashes(value: unknown, site: DecodeSite): NodeHashes {
  const obj = expectObject(value, site);
  const hash = (key: string): string =>
    expectNonEmptyString(requiredKey(obj, key, site), at(site, key));
  return {
    ownHash: hash("ownHash"),
    subtreeHash: hash("subtreeHash"),
    effectiveHash: hash("effectiveHash"),
    metadataHash: hash("metadataHash"),
  };
}

/** Coverage attribute: absent (root) or a non-empty string. */
function decodeCoverage(
  obj: Record<string, unknown>,
  site: DecodeSite,
): string | undefined {
  const value = optionalKey(obj, "coverage");
  if (value === undefined) return undefined;
  return expectNonEmptyString(value, at(site, "coverage"));
}

/**
 * A node's tags, given its already-decoded identity: a 12.7 tag set, or `null`
 * for a root node's absent tags. SPEC 11.1: "for a root node the tags and
 * the coverage attribute are both reported as absent (5.5)", its rows
 * carrying "tags and coverage attribute both absent for roots"; 12.4 prints
 * them "both absent for a root node"; 12.7's `null` marks a datum whose
 * absence its defining section states, while `[]` is a tagless section's
 * value. On these unpinned-shape surfaces (H-3) a root's absent tags may
 * therefore be `null` or an omitted member, as its coverage attribute may
 * ({@link decodeCoverage}): both decode to `null`, never to `[]`. In every
 * other case the decode stays form-exact: a section's tags (an identity with
 * `#`, 1.5) are required information, so a missing or `null` member fails
 * loudly; a root whose `tags` member holds a value must hold a tag set, and
 * that value — `[]` included — reaches the body unjudged (value-blind, H-3).
 */
function decodeNodeTags(
  obj: Record<string, unknown>,
  identity: string,
  site: DecodeSite,
): string[] | null {
  if (!identity.includes("#") && optionalKey(obj, "tags") === undefined) {
    return null;
  }
  return decodeTagSet(requiredKey(obj, "tags", site), at(site, "tags"));
}

/**
 * `query node` / `show` (T11-1, T12.4-1): identity, source range, own and
 * subtree text, all four hashes, tags, coverage attribute, and incoming and
 * outgoing edges by kind — a root's tags and coverage attribute both absent
 * (SPEC 11.1, 12.4: `null` or omitted; {@link decodeNodeTags}).
 */
export function decodeNodeReport(doc: unknown, context?: string): NodeReport {
  const site = documentRootSite(doc, "query node/show", context);
  const obj = expectObject(doc, site);
  const edgesSite = at(site, "edges");
  const edges = expectObject(requiredKey(obj, "edges", site), edgesSite);
  const identity = expectNonEmptyString(
    requiredKey(obj, "identity", site),
    at(site, "identity"),
  );
  return {
    identity,
    sourceRange: decodeSourceRange(
      requiredKey(obj, "sourceRange", site),
      at(site, "sourceRange"),
    ),
    ownText: expectString(
      requiredKey(obj, "ownText", site),
      at(site, "ownText"),
    ),
    subtreeText: expectString(
      requiredKey(obj, "subtreeText", site),
      at(site, "subtreeText"),
    ),
    hashes: decodeHashes(requiredKey(obj, "hashes", site), at(site, "hashes")),
    tags: decodeNodeTags(obj, identity, site),
    coverage: decodeCoverage(obj, site),
    incomingEdges: decodeEdgeArray(
      requiredKey(edges, "incoming", edgesSite),
      at(edgesSite, "incoming"),
    ),
    outgoingEdges: decodeEdgeArray(
      requiredKey(edges, "outgoing", edgesSite),
      at(edgesSite, "outgoing"),
    ),
  };
}

/**
 * Minimal `query node` decoding — identity and tags only (T1.4-2, T1.4-4).
 * Those tests are in CERTIFICATIONS.md §CONF-VALID's scope, which pins the
 * fixture product's query surface to reporting identity, tags, and
 * metadataHash: decoding the full node report would demand information the
 * scoped fixture never promises. The two keys read here are the `query node`
 * shape's own (see the ASSUMED SHAPE above); everything else in the document
 * is ignored, not validated. A root's tags are absent (SPEC 11.1: `null` or
 * omitted; {@link decodeNodeTags}).
 */
export function decodeNodeSummary(doc: unknown, context?: string): NodeSummary {
  const site = documentRootSite(
    doc,
    "query node (identity/tags summary)",
    context,
  );
  const obj = expectObject(doc, site);
  const identity = expectNonEmptyString(
    requiredKey(obj, "identity", site),
    at(site, "identity"),
  );
  return { identity, tags: decodeNodeTags(obj, identity, site) };
}

/**
 * `query node` decoded to the full CONF-VALID-scoped surface — identity,
 * tags, and metadataHash (T2.6-1, T2.6-2). Within `hashes`, only
 * `metadataHash` is demanded: a scoped fixture product promises no other
 * hash (CERTIFICATIONS.md §CONF-VALID), so requiring the full four-hash
 * object would reject a document the scope permits. Everything else in the
 * document is ignored, not validated. A root's tags are absent (SPEC 11.1:
 * `null` or omitted; {@link decodeNodeTags}).
 */
export function decodeNodeMetadataSummary(
  doc: unknown,
  context?: string,
): NodeMetadataSummary {
  const site = documentRootSite(
    doc,
    "query node (identity/tags/metadataHash)",
    context,
  );
  const obj = expectObject(doc, site);
  const hashesSite = at(site, "hashes");
  const hashes = expectObject(requiredKey(obj, "hashes", site), hashesSite);
  const identity = expectNonEmptyString(
    requiredKey(obj, "identity", site),
    at(site, "identity"),
  );
  return {
    identity,
    tags: decodeNodeTags(obj, identity, site),
    metadataHash: expectNonEmptyString(
      requiredKey(hashes, "metadataHash", hashesSite),
      at(hashesSite, "metadataHash"),
    ),
  };
}

/**
 * `query node` decoded to the four things the SPEC.md 1.6 text algebra reads
 * from one answer (P-3): own and subtree text, the source range (1.7), and
 * the targets of the outgoing `contains` edges (5.2) — the node's children,
 * in the answer's order. CERTIFICATIONS.md §CONF-MD pins the fixture
 * product's `query node` to identity, source range, own and subtree text,
 * and its `contains` edges, leaving hashes, tags, the coverage attribute,
 * and dependency edges out of scope: demanding them would reject a
 * document the scope permits. So every outgoing edge's `kind` is decoded
 * (the SPEC.md 5.2 vocabulary, to tell `contains` edges apart) and a
 * `contains` edge's `to` is demanded, while an edge of a dependency kind is
 * passed over unread, and so are the incoming edges and every other member.
 * Both texts may legitimately be empty (an empty leaf section, SPEC.md 1.1),
 * so plain strings are demanded; an absent or malformed text, range,
 * `edges.outgoing`, edge kind, or `contains` target fails loudly (H-3). The
 * range decodes through the literal 12.7 form (`decodeSourceRange`), never
 * adapted.
 */
export function decodeNodeTextAlgebraSummary(
  doc: unknown,
  context?: string,
): NodeTextAlgebraSummary {
  const site = documentRootSite(
    doc,
    "query node (text-algebra summary)",
    context,
  );
  const obj = expectObject(doc, site);
  const edgesSite = at(site, "edges");
  const edges = expectObject(requiredKey(obj, "edges", site), edgesSite);
  const outgoingSite = at(edgesSite, "outgoing");
  const containsTargets: string[] = [];
  expectArray(requiredKey(edges, "outgoing", edgesSite), outgoingSite).forEach(
    (element, index) => {
      const edgeSite = at(outgoingSite, index);
      const edge = expectObject(element, edgeSite);
      const kind = expectToken(
        requiredKey(edge, "kind", edgeSite),
        EDGE_KINDS,
        at(edgeSite, "kind"),
      );
      if (kind !== "contains") return; // a dependency edge: out of scope
      containsTargets.push(
        expectNonEmptyString(
          requiredKey(edge, "to", edgeSite),
          at(edgeSite, "to"),
        ),
      );
    },
  );
  return {
    ownText: expectString(
      requiredKey(obj, "ownText", site),
      at(site, "ownText"),
    ),
    subtreeText: expectString(
      requiredKey(obj, "subtreeText", site),
      at(site, "subtreeText"),
    ),
    sourceRange: decodeSourceRange(
      requiredKey(obj, "sourceRange", site),
      at(site, "sourceRange"),
    ),
    containsTargets,
  };
}

/**
 * `query nodes` rows decoded to identity and tags only (T2.6-1) — the row
 * counterpart of {@link decodeNodeSummary}, for tests certified against
 * fixtures whose scoped query surface reports only identity, tags, and
 * metadataHash (CERTIFICATIONS.md §CONF-VALID): the full row contract's
 * source range is not demanded. The `nodes` key is the `query nodes` shape's
 * own (see the ASSUMED SHAPE above); other row members are ignored. A root
 * row's tags are absent (SPEC 11.1: `null` or omitted; {@link
 * decodeNodeTags}).
 */
export function decodeNodeSummaryRowsReport(
  doc: unknown,
  context?: string,
): NodeSummary[] {
  const site = documentRootSite(
    doc,
    "query nodes (identity/tags summary rows)",
    context,
  );
  const obj = expectObject(doc, site);
  const rowsSite = at(site, "nodes");
  return expectArray(requiredKey(obj, "nodes", site), rowsSite).map(
    (element, index) => {
      const rowSite = at(rowsSite, index);
      const row = expectObject(element, rowSite);
      const identity = expectNonEmptyString(
        requiredKey(row, "identity", rowSite),
        at(rowSite, "identity"),
      );
      return { identity, tags: decodeNodeTags(row, identity, rowSite) };
    },
  );
}

/**
 * `query nodes` rows decoded to identities alone (T3-1's grammar-boundary
 * arm). That arm is in CERTIFICATIONS.md §CONF-MD's scope, which pins the
 * fixture product's `query nodes` surface to the no-node observation for
 * construct-like bytes inside fences and code spans: demanding tags,
 * coverage, or source-range semantics would reject a document the scope
 * permits (the row counterpart of {@link decodeNodeTextAlgebraSummary}'s
 * scoping).
 * The `nodes` key and per-row `identity` are the `query nodes` shape's own
 * (see the ASSUMED SHAPE above); other row members are ignored, not
 * validated. Absent or malformed identities still fail loudly (H-3).
 */
export function decodeNodeIdentityRowsReport(
  doc: unknown,
  context?: string,
): string[] {
  const site = documentRootSite(
    doc,
    "query nodes (identity-only rows)",
    context,
  );
  const obj = expectObject(doc, site);
  const rowsSite = at(site, "nodes");
  return expectArray(requiredKey(obj, "nodes", site), rowsSite).map(
    (element, index) => {
      const rowSite = at(rowsSite, index);
      const row = expectObject(element, rowSite);
      return expectNonEmptyString(
        requiredKey(row, "identity", rowSite),
        at(rowSite, "identity"),
      );
    },
  );
}

function decodeNodeRow(value: unknown, site: DecodeSite): NodeRow {
  const obj = expectObject(value, site);
  const identity = expectNonEmptyString(
    requiredKey(obj, "identity", site),
    at(site, "identity"),
  );
  return {
    identity,
    sourceRange: decodeSourceRange(
      requiredKey(obj, "sourceRange", site),
      at(site, "sourceRange"),
    ),
    tags: decodeNodeTags(obj, identity, site),
    coverage: decodeCoverage(obj, site),
  };
}

/**
 * `query nodes` / `query subtree` / `query ancestors` (T11-2, T11-3): rows in
 * the reported order, each with the one row contract — identity, source
 * range, tags, coverage attribute (tags and coverage attribute both absent
 * for roots, SPEC 11.1: `null` or omitted; {@link decodeNodeTags}).
 */
export function decodeNodeRowsReport(
  doc: unknown,
  context?: string,
): NodeRow[] {
  const site = documentRootSite(doc, "query nodes/subtree/ancestors", context);
  const obj = expectObject(doc, site);
  const rowsSite = at(site, "nodes");
  return expectArray(requiredKey(obj, "nodes", site), rowsSite).map(
    (element, index) => decodeNodeRow(element, at(rowsSite, index)),
  );
}

/** `query edges` (T11-4): the edge list in the reported order. */
export function decodeEdgesReport(doc: unknown, context?: string): GraphEdge[] {
  const site = documentRootSite(doc, "query edges", context);
  const obj = expectObject(doc, site);
  return decodeEdgeArray(requiredKey(obj, "edges", site), at(site, "edges"));
}

/**
 * `query reachable` (T11-5): whether a dependency path exists, and — exactly
 * when one does — one shortest witness path as a node-identity sequence. A
 * document claiming reachability without a path, or a path without
 * reachability, is contradictory and rejected.
 */
export function decodeReachableReport(
  doc: unknown,
  context?: string,
): ReachableReport {
  const site = documentRootSite(doc, "query reachable", context);
  const obj = expectObject(doc, site);
  const reachable = expectBoolean(
    requiredKey(obj, "reachable", site),
    at(site, "reachable"),
  );
  if (!reachable) {
    forbiddenKey(obj, "path", site, "no witness path exists when unreachable");
    return { reachable };
  }
  const pathSite = at(site, "path");
  const path = expectNonEmptyStringArray(
    requiredKey(obj, "path", site),
    pathSite,
  );
  if (path.length === 0) {
    decodeFail(
      pathSite,
      "a non-empty witness path when reachable",
      obj["path"],
    );
  }
  return { reachable, path };
}

// --- the bare edge-endpoint walk (T1.7-1) ----------------------------------

/**
 * Walk a query document and assert SPEC.md 1.7's bare-endpoint contract: a
 * code location is presented with its source range in exactly two outputs —
 * occurrence records (5.7, 11.3) and review payloads (10.7) — so everywhere
 * a graph node appears as an edge endpoint (`edges` rows, a `reachable`
 * witness path, `query node`'s incoming and outgoing edge lists) the
 * reported endpoint is an identity alone, no range datum accompanying it,
 * requirement node and code location alike. The walk fails loudly on any
 * source-range-shaped datum anywhere in the given subtree: an object
 * carrying a member named `range` or `sourceRange`, or carrying both `start`
 * and `end` members — the range spellings of SPEC.md 1.7/12.7 and of the
 * ASSUMED SHAPE above. Like the ASSUMED SHAPE, the detection is shape-aware
 * and adapter-owned: if the real product legitimately spells ranges
 * differently, adjust the detection with it — never to admit a range datum
 * beside an edge endpoint. Callers pass whole `query edges` and
 * `query reachable` documents; node reports go through
 * {@link assertNodeEdgeListsBare}, which scopes the walk to the report's
 * `edges` member (the queried node's own source range is contract, T11-1).
 */
export function assertBareEdgeEndpoints(doc: unknown, context?: string): void {
  walkForRangeData(
    doc,
    documentRootSite(doc, "1.7 bare edge-endpoint walk", context),
  );
}

/**
 * {@link assertBareEdgeEndpoints} scoped to a `query node`/`show` report's
 * incoming and outgoing edge lists: the report's own `sourceRange` (the
 * queried node's, SPEC.md 11/12.4) lies outside the walk, while a range
 * datum anywhere within the edge lists — beside an endpoint, or as an
 * endpoint's member — fails loudly.
 */
export function assertNodeEdgeListsBare(doc: unknown, context?: string): void {
  const site = documentRootSite(
    doc,
    "1.7 bare edge-endpoint walk (query node/show edge lists)",
    context,
  );
  const obj = expectObject(doc, site);
  walkForRangeData(requiredKey(obj, "edges", site), at(site, "edges"));
}

function walkForRangeData(root: unknown, rootSite: DecodeSite): void {
  // H-11: an explicit stack, never native recursion per nesting level — the
  // suite stages documents past V8's frame budget (P-8, P-11), and no depth
  // cap of any kind. Children are pushed last-first so each datum is checked
  // in exactly the order a recursive descent checks it: a value's own members
  // first, then each element or member completely (subtree included), in
  // index and then property-enumeration order — the first failure reported
  // is the same one.
  const stack: { readonly value: unknown; readonly site: DecodeSite }[] = [
    { value: root, site: rootSite },
  ];
  while (stack.length > 0) {
    const { value, site } = stack.pop()!;
    if (Array.isArray(value)) {
      for (let index = value.length - 1; index >= 0; index -= 1) {
        stack.push({ value: value[index], site: at(site, index) });
      }
      continue;
    }
    if (typeof value !== "object" || value === null) continue;
    const obj = value as Record<string, unknown>;
    for (const name of ["range", "sourceRange"]) {
      if (Object.hasOwn(obj, name)) {
        decodeFail(
          at(site, name),
          "no range datum on an edge surface — everywhere a graph node " +
            "appears as an edge endpoint it is a bare identity, requirement " +
            "node and code location alike; a code location's source range is " +
            "presented in exactly two outputs, occurrence records and review " +
            "payloads (SPEC 1.7)",
          obj[name],
        );
      }
    }
    if (Object.hasOwn(obj, "start") && Object.hasOwn(obj, "end")) {
      decodeFail(
        site,
        'no range-shaped {"start", "end"} datum on an edge surface — edge ' +
          "endpoints are bare identities with no range datum accompanying " +
          "them (SPEC 1.7)",
        value,
      );
    }
    const entries = Object.entries(obj);
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const [key, member] = entries[index]!;
      stack.push({ value: member, site: at(site, key) });
    }
  }
}

/** `ids` (T12.3-1): files in byte order, IDs within a file in document order. */
export function decodeIdsReport(doc: unknown, context?: string): IdsReport {
  const site = documentRootSite(doc, "ids", context);
  const obj = expectObject(doc, site);
  const filesSite = at(site, "files");
  const files: IdsFileEntry[] = expectArray(
    requiredKey(obj, "files", site),
    filesSite,
  ).map((element, index) => {
    const entrySite = at(filesSite, index);
    const entry = expectObject(element, entrySite);
    return {
      file: expectNonEmptyString(
        requiredKey(entry, "file", entrySite),
        at(entrySite, "file"),
      ),
      ids: expectNonEmptyStringArray(
        requiredKey(entry, "ids", entrySite),
        at(entrySite, "ids"),
      ),
    };
  });
  return { files };
}

/**
 * One `ids --tree` node per section nesting level, decoded through an
 * explicit stack.
 *
 * H-11: never native recursion per nesting level — the suite stages section
 * towers 2048 and 4096 deep (P-8, P-11, T1.3-7), past V8's frame budget —
 * and no depth cap of any kind. The checks run per node in exactly the order
 * a recursive descent runs them: the node's own members first (`id`, then
 * the array form of `children`), then each child completely (subtree
 * included) in document order.
 */
function decodeIdsTreeNode(value: unknown, site: DecodeSite): IdsTreeNode {
  const stack: IdsTreeFrame[] = [enterIdsTreeNode(value, site)];
  for (;;) {
    const top = stack[stack.length - 1]!;
    if (top.nextChild < top.rawChildren.length) {
      const index = top.nextChild;
      top.nextChild += 1;
      stack.push(
        enterIdsTreeNode(top.rawChildren[index], at(top.childrenSite, index)),
      );
      continue;
    }
    const node: IdsTreeNode = { id: top.id, children: top.children };
    stack.pop();
    const parent = stack[stack.length - 1];
    if (parent === undefined) return node;
    parent.children.push(node);
  }
}

/** One node's decode in flight: its own members decoded, children pending. */
interface IdsTreeFrame {
  readonly id: string;
  readonly childrenSite: DecodeSite;
  readonly rawChildren: readonly unknown[];
  /** The children decoded so far, in document order. */
  readonly children: IdsTreeNode[];
  /** The index of the next raw child to decode. */
  nextChild: number;
}

/** A node's own members, in form order — everything before its children. */
function enterIdsTreeNode(value: unknown, site: DecodeSite): IdsTreeFrame {
  const obj = expectObject(value, site);
  const childrenSite = at(site, "children");
  const id = expectNonEmptyString(requiredKey(obj, "id", site), at(site, "id"));
  const rawChildren = expectArray(
    requiredKey(obj, "children", site),
    childrenSite,
  );
  return { id, childrenSite, rawChildren, children: [], nextChild: 0 };
}

/** `ids --tree` (T12.3-1): per-file nesting in file and document order. */
export function decodeIdsTreeReport(
  doc: unknown,
  context?: string,
): IdsTreeReport {
  const site = documentRootSite(doc, "ids --tree", context);
  const obj = expectObject(doc, site);
  const filesSite = at(site, "files");
  const files: IdsTreeFileEntry[] = expectArray(
    requiredKey(obj, "files", site),
    filesSite,
  ).map((element, index) => {
    const entrySite = at(filesSite, index);
    const entry = expectObject(element, entrySite);
    const nodesSite = at(entrySite, "nodes");
    return {
      file: expectNonEmptyString(
        requiredKey(entry, "file", entrySite),
        at(entrySite, "file"),
      ),
      nodes: expectArray(requiredKey(entry, "nodes", entrySite), nodesSite).map(
        (node, nodeIndex) => decodeIdsTreeNode(node, at(nodesSite, nodeIndex)),
      ),
    };
  });
  return { files };
}
