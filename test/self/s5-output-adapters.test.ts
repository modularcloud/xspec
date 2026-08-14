// S-5 Output adapters self-test (TEST-SPEC 17). Each H-3 adapter rejects
// documents missing required information — fed synthetic wrong-shape
// documents — rather than defaulting: rejection is a diagnosed
// HarnessAssertionError (the failure shape product-facing tests must produce
// against a stub product, H-8), never a decoded value with fabricated
// content, and never a harness crash. Every adapter also has a positive
// control (a well-shaped document decodes to exactly the modeled
// information), because an adapter that rejected everything would be equally
// wrong and certification depends on these decoders passing conforming
// output through.
//
// The same S-5 discipline covers the rest of the H-3 layer this harness
// owns: the human-report required-information matcher, the T10.1-4
// session-corruption staging transformations (shape-aware, value-blind,
// failing loudly — file untouched — on shape mismatch), and the T13.4-1
// byte-sorted-keys assertion (which must judge the *written* key order, not
// JavaScript object key order, and byte order, not UTF-16 order).

import { Buffer } from "node:buffer";
import { expect, onTestFinished, test } from "vitest";
import { HarnessAssertionError } from "../helpers/assertions.js";
import type { RunResult } from "../helpers/subprocess.js";
import type { Finding, ViewReport } from "../helpers/adapters/index.js";
import {
  GRAPH_DATA_AREA_PATH,
  ITEM_STATUSES,
  RECORD_GARBAGE_BYTES,
  assertBareEdgeEndpoints,
  assertJsonKeysByteSorted,
  assertNodeEdgeListsBare,
  assertReportMentions,
  assertUnavailabilityMarkerForms,
  classifyIgnoredReasons,
  compareFindings,
  conditionMention,
  corruptGraphDataShapeBlind,
  decodeAppliedMappingReport,
  decodeAtReport,
  decodeCoverageReport,
  decodeDatum,
  decodeEdgesReport,
  decodeErrorDocument,
  decodeExportReport,
  decodeFindingsReport,
  decodeIdsReport,
  decodeIdsTreeReport,
  decodeImpactReport,
  decodeInventoryAnchoring,
  decodeInventoryFindings,
  decodeInventoryRecordedDatum,
  decodeItemReport,
  decodeNextReport,
  decodeNodeMetadataSummary,
  decodeNodeReport,
  decodeNodeIdentityRowsReport,
  decodeOccurrencesReport,
  decodeNodeRowsReport,
  decodeNodeSummary,
  decodeNodeSummaryRowsReport,
  decodeNodeTextSummary,
  decodePreviewReport,
  decodeReachableReport,
  decodeSessionListReport,
  decodeSessionStatusReport,
  decodeViewFilesReport,
  decodeViewReport,
  expectNonNegativeInteger,
  isGraphDataKey,
  rootSite,
  stageBlockedByAbsentItem,
  stageBlockedByCycle,
  stageDeleteItemField,
  stageDuplicateItemEntry,
  stageGarbleCreationParameters,
  stageGarbleDecompositions,
  stageUnknownItemStatus,
} from "../helpers/adapters/index.js";
import { TestWorkspace } from "../helpers/workspace.js";

// --- shared machinery -------------------------------------------------------

/** Deep-clone a JSON document, remove the member at the path, return it. */
function omit(doc: unknown, ...steps: (string | number)[]): unknown {
  const copy = structuredClone(doc);
  const last = steps[steps.length - 1];
  let cursor: unknown = copy;
  for (const step of steps.slice(0, -1)) {
    cursor = (cursor as Record<string | number, unknown>)[step];
  }
  if (Array.isArray(cursor) && typeof last === "number") {
    cursor.splice(last, 1);
  } else {
    delete (cursor as Record<string | number, unknown>)[last as string];
  }
  return copy;
}

/** Deep-clone a JSON document, replace the member at the path, return it. */
function put(
  doc: unknown,
  value: unknown,
  ...steps: (string | number)[]
): unknown {
  const copy = structuredClone(doc);
  const last = steps[steps.length - 1];
  let cursor: unknown = copy;
  for (const step of steps.slice(0, -1)) {
    cursor = (cursor as Record<string | number, unknown>)[step];
  }
  (cursor as Record<string | number, unknown>)[last as string | number] = value;
  return copy;
}

function describeOutcome(value: unknown): string {
  let rendered: string;
  try {
    rendered = JSON.stringify(value) ?? String(value);
  } catch {
    rendered = String(value);
  }
  return rendered.length > 200 ? `${rendered.slice(0, 200)}…` : rendered;
}

/**
 * The call must fail as a diagnosed HarnessAssertionError (S-5: reject,
 * never default). Success and any other exception are self-test failures.
 */
function expectDiagnosed(
  label: string,
  run: () => unknown,
): HarnessAssertionError {
  let result: unknown;
  try {
    result = run();
  } catch (error) {
    if (error instanceof HarnessAssertionError) return error;
    throw new Error(
      `${label}: expected a diagnosed HarnessAssertionError, but a harness error escaped: ${String(error)}`,
    );
  }
  throw new Error(
    `${label}: expected a diagnosed HarnessAssertionError (H-3/S-5: adapters reject wrong shapes rather than defaulting), but the call succeeded with ${describeOutcome(result)}`,
  );
}

async function expectDiagnosedAsync(
  label: string,
  run: () => Promise<unknown>,
): Promise<HarnessAssertionError> {
  let result: unknown;
  try {
    result = await run();
  } catch (error) {
    if (error instanceof HarnessAssertionError) return error;
    throw new Error(
      `${label}: expected a diagnosed HarnessAssertionError, but a harness error escaped: ${String(error)}`,
    );
  }
  throw new Error(
    `${label}: expected a diagnosed HarnessAssertionError (H-3/S-5: reject, never default), but the call succeeded with ${describeOutcome(result)}`,
  );
}

// --- well-shaped documents (positive controls) ------------------------------

const EDGE_IN = {
  from: "src/login.ts#handler",
  to: "specs/A.mdx#login",
  kind: "references",
};
const EDGE_OUT = {
  from: "specs/A.mdx#login",
  to: "specs/B.mdx#account",
  kind: "depends",
};

const GOOD_NODE = {
  identity: "specs/A.mdx#login",
  sourceRange: { start: 12, end: 96 },
  ownText: "Login must work.\n",
  subtreeText: "Login must work.\n\nDetails.\n",
  hashes: {
    ownHash: "own-1",
    subtreeHash: "sub-1",
    effectiveHash: "eff-1",
    metadataHash: "meta-1",
  },
  tags: ["auth", "v2"],
  coverage: "none",
  edges: { incoming: [EDGE_IN], outgoing: [EDGE_OUT] },
};

const GOOD_ROWS = {
  nodes: [
    {
      identity: "specs/A.mdx#login",
      sourceRange: { start: 12, end: 96 },
      tags: ["auth"],
      coverage: "none",
    },
    // A root row: coverage attribute absent (T1.2-3, T11-3).
    { identity: "specs/A.mdx", sourceRange: { start: 0, end: 120 }, tags: [] },
  ],
};

const GOOD_EDGES = { edges: [EDGE_IN, EDGE_OUT] };

const GOOD_REACHABLE = {
  reachable: true,
  path: ["specs/A.mdx#login", "specs/B.mdx#account"],
};

const GOOD_IDS = {
  files: [
    { file: "specs/A.mdx", ids: ["login", "login.validCredentials"] },
    { file: "specs/B.mdx", ids: ["account"] },
  ],
};

const GOOD_IDS_TREE = {
  files: [
    {
      file: "specs/A.mdx",
      nodes: [
        {
          id: "login",
          children: [{ id: "login.validCredentials", children: [] }],
        },
      ],
    },
  ],
};

// A findings-only report in the literal SPEC 12.7 form (a form-exact
// surface, H-3): entries deliberately span a located condition, a
// multi-location cycle, a policy finding (locations [] / path null /
// contractual identities), a path-level condition, a refusal reason, and a
// code-less finding — in the pinned findings order (numbered conditions in
// numeric order, then refusal reasons, then code-less).
const GOOD_FINDINGS = {
  findings: [
    {
      code: "invalid-structural-id", // 14.2
      message: 'expected <S id="login.validCredentials"> nested inside login',
      locations: [{ file: "specs/A.mdx", range: { start: 40, end: 78 } }],
      path: null,
      identities: [],
    },
    {
      code: "cycle", // 14.9 — one finding locating every participant (T14-8)
      message: "dependency cycle",
      locations: [
        { file: "specs/A.mdx", range: { start: 10, end: 30 } },
        { file: "specs/B.mdx", range: { start: 5, end: 25 } },
      ],
      path: null,
      identities: ["specs/A.mdx#a", "specs/B.mdx#b"],
    },
    {
      code: "policy-violation", // 14.12 — no locations, no path, identities
      message: "policy rule violated",
      locations: [],
      path: null,
      identities: [
        "no-derived-to-base",
        "specs/A.mdx#login",
        "depends",
        "specs/B.mdx#account",
      ],
    },
    {
      code: "unreadable-record", // 14.23 — a path-level condition
      message: "graph data cannot be read as a record; rebuild",
      locations: [],
      path: ".xspec",
      identities: [],
    },
    {
      code: "refused-id-collision", // refusal reasons sort after 14.1–14.23
      message: "the new id collides with a remaining bearer",
      locations: [{ file: "specs/A.mdx", range: { start: 3, end: 9 } }],
      path: null,
      identities: ["specs/A.mdx#login"],
    },
    {
      code: null, // code-less findings sort last (12.7)
      message: "refused: the review operation names a blocked item",
      locations: [],
      path: null,
      identities: [],
    },
  ],
};

// An `occurrences` document in the literal SPEC 12.7 form (a form-exact
// surface, H-3): `{"findings", "occurrences"}`, each record
// `{"file", "range", "kind", "source", "target"}` in occurrence order (5.7 —
// file path bytes, then range start, then range end). Records deliberately
// span the three reference kinds and both source states: a defined
// `{"identity", "range"}` node and the one-datum unavailability marker
// (11.2).
const GOOD_OCCURRENCES = {
  findings: [],
  occurrences: [
    {
      file: "specs/B.mdx",
      range: { start: 30, end: 47 },
      kind: "depends",
      source: {
        identity: "specs/B.mdx#intro",
        range: { start: 10, end: 90 },
      },
      target: "specs/A.mdx#login",
    },
    {
      file: "src/app.ts",
      range: { start: 120, end: 128 },
      kind: "references",
      source: {
        identity: "src/app.ts#entry",
        range: { start: 80, end: 140 },
      },
      target: "specs/A.mdx#login",
    },
    {
      file: "src/app.ts",
      range: { start: 200, end: 216 },
      kind: "embeds",
      source: { unavailable: true },
      target: "specs/A.mdx#login",
    },
  ],
};

const GOOD_AT = {
  findings: [],
  resolution: {
    section: {
      identity: "specs/A.mdx#login",
      range: { start: 10, end: 90 },
    },
    occurrence: null,
  },
};

// The scoped view decode reads the top level, each wrapper's form, and the
// `file` members; `root`/`imports`/`occurrences`/`comments` are
// presence-checked placeholders here (their values stay unread by design).
const GOOD_VIEWS = {
  findings: [],
  views: [
    {
      file: "specs/A.mdx",
      root: { placeholder: true },
      imports: [],
      occurrences: [],
      comments: [],
    },
    {
      file: "specs/B.mdx",
      root: { placeholder: true },
      imports: [],
      occurrences: [],
      comments: [],
    },
  ],
};

// The FULL view decode (11.4, 12.7; decodeViewReport): one per-file view
// carrying a complete positional tree — root with the stated-`null`
// tags/coverage, a paired child with a named and a spread attribute, a
// self-closing child with identity/tags unavailable — imports in both target
// states, the file's own occurrence records in document order, and comment
// ranges. Attribute text lengths equal their ranges (the decoder's 1.7
// invariant). Without `--text` the node text members are absent (the stated
// conditional presence); GOOD_VIEW_FULL_TEXT is the `--text` twin.
const GOOD_VIEW_FULL = {
  findings: [],
  views: [
    {
      file: "specs/A.mdx",
      root: {
        identity: "specs/A.mdx",
        range: { start: 0, end: 200 },
        opening: null,
        closing: null,
        attributes: [],
        tags: null,
        coverage: null,
        children: [
          {
            identity: "specs/A.mdx#login",
            range: { start: 40, end: 120 },
            opening: { start: 40, end: 62 },
            closing: { start: 116, end: 120 },
            attributes: [
              {
                name: "id",
                range: { start: 43, end: 53 },
                text: 'id="login"',
              },
              { name: null, range: { start: 54, end: 60 }, text: "{...p}" },
            ],
            tags: ["auth", "v2"],
            coverage: "required",
            children: [],
          },
          {
            identity: { unavailable: true },
            range: { start: 130, end: 146 },
            opening: { start: 130, end: 146 },
            closing: null,
            attributes: [
              {
                name: "id",
                range: { start: 133, end: 142 },
                text: 'id="du.p"',
              },
            ],
            tags: { unavailable: true },
            coverage: "none",
            children: [],
          },
        ],
      },
      imports: [
        { range: { start: 0, end: 31 }, name: "BASE", target: "specs/B.mdx" },
        {
          range: { start: 32, end: 39 },
          name: null,
          target: { unavailable: true },
        },
      ],
      occurrences: [
        {
          file: "specs/A.mdx",
          range: { start: 70, end: 84 },
          kind: "embeds",
          source: {
            identity: "specs/A.mdx#login",
            range: { start: 40, end: 120 },
          },
          target: "specs/B.mdx#base",
        },
        {
          file: "specs/A.mdx",
          range: { start: 90, end: 104 },
          kind: "depends",
          source: { unavailable: true },
          target: "specs/B.mdx#base",
        },
      ],
      comments: [
        { start: 150, end: 170 },
        { start: 175, end: 195 },
      ],
    },
  ],
};

// The `--text` twin: every node additionally carries ownText/subtreeText —
// a plain string (empty legitimate: an empty leaf, SPEC 1.1) or the
// unavailability marker (whole-value poisoning, 11.2), never `null`.
const GOOD_VIEW_FULL_TEXT = {
  findings: [],
  views: [
    {
      file: "specs/A.mdx",
      root: {
        identity: "specs/A.mdx",
        range: { start: 0, end: 100 },
        opening: null,
        closing: null,
        attributes: [],
        tags: null,
        coverage: null,
        children: [
          {
            identity: "specs/A.mdx#login",
            range: { start: 10, end: 90 },
            opening: { start: 10, end: 24 },
            closing: { start: 86, end: 90 },
            attributes: [
              {
                name: "id",
                range: { start: 13, end: 23 },
                text: 'id="login"',
              },
            ],
            tags: [],
            coverage: "required",
            children: [],
            ownText: "",
            subtreeText: { unavailable: true },
          },
        ],
        ownText: "Prose.\n",
        subtreeText: { unavailable: true },
      },
      imports: [],
      occurrences: [],
      comments: [],
    },
  ],
};

const GOOD_COVERAGE = {
  profiles: [
    {
      name: "core",
      counts: { required: 3, covered: 1, uncovered: 1, ignored: 1 },
      covered: [
        {
          identity: "specs/B.mdx#account",
          path: ["specs/A.mdx#login", "specs/B.mdx#account"],
        },
      ],
      uncovered: ["specs/B.mdx#account.close"],
      ignored: [{ identity: "specs/B.mdx", reasons: ["root node"] }],
    },
  ],
};

const GOOD_IMPACT = {
  baseline: "a1b2c3d",
  requirements: [
    {
      nodes: ["specs/A.mdx#login"],
      deleted: false,
      categories: [{ category: "changed", attributedTo: [] }],
    },
    {
      // A collapsed ancestor chain (T9.3-1) and a deleted entry (T9.3-3).
      nodes: ["specs/A.mdx", "specs/A.mdx#login"],
      deleted: true,
      categories: [
        { category: "descendant-changed", attributedTo: ["specs/A.mdx#login"] },
      ],
    },
  ],
  code: {
    direct: [
      {
        location: "src/login.ts#handler",
        edge: EDGE_IN,
        path: ["specs/A.mdx#login"],
      },
    ],
    transitive: [],
  },
};

// A successful rename/move's applied-mapping report (SPEC 6.4/6.5; T6.4-1,
// T6.5-1). The report shape is unpinned (H-3): the assumed shape mirrors the
// preview's pinned `mapping` member, and members beside it (here `findings`)
// are passed over by the decoder.
const GOOD_APPLIED_MAPPING = {
  findings: [],
  mapping: [
    { from: "specs/A.mdx#login", to: "specs/A.mdx#signin" },
    { from: "specs/A.mdx#login.form", to: "specs/A.mdx#signin.form" },
  ],
};

// A successful rename/move preview in the literal SPEC 12.7 form (a
// form-exact surface, H-3): `{"findings", "mapping", "files", "delta"}` —
// mapping ordered by `from` bytes, file entries by file path bytes, edits by
// range start, then range end, then class-name bytes (the zero-length
// insertion coincidence deliberately staged: `import-addition` sorts before
// `target-insertion` at one offset, T6.6-4's tie-break), delta directions in
// path byte order.
const GOOD_PREVIEW = {
  findings: [],
  mapping: [
    { from: "specs/A.mdx#login", to: "specs/B.mdx#login" },
    { from: "specs/A.mdx#login.form", to: "specs/B.mdx#login.form" },
  ],
  files: [
    {
      file: "specs/A.mdx",
      edits: [
        { class: "origin-deletion", range: { start: 40, end: 160 } },
        // Nested inside the deletion range — containment is geometry, each
        // edit under its own class (SPEC 6.6).
        { class: "id-rewrite", range: { start: 48, end: 58 } },
        { class: "reference-rewrite", range: { start: 200, end: 216 } },
      ],
    },
    {
      file: "specs/B.mdx",
      edits: [
        { class: "import-addition", range: { start: 90, end: 90 } },
        { class: "target-insertion", range: { start: 90, end: 90 } },
      ],
    },
  ],
  delta: {
    generated: ["specs/B.md", "specs/B.xspec.ts"],
    removed: ["specs/A.md", "specs/A.xspec.ts"],
  },
};

// A refused preview keeps the preview document form: the refusal findings
// alone, `mapping`, `files`, and `delta` null together (SPEC 6.6, 12.7).
const REFUSED_PREVIEW = {
  findings: [
    {
      code: "refused-identity-unchanged",
      message: "the new identity equals the old",
      locations: [],
      path: null,
      identities: ["specs/A.mdx#login"],
    },
  ],
  mapping: null,
  files: null,
  delta: null,
};

const GOOD_SESSION_LIST = {
  sessions: [
    {
      name: "B",
      corrupt: false,
      strategy: "audit",
      counts: { unresolved: 2, updated: 1 },
    },
    { name: "a", corrupt: true },
  ],
};

const GOOD_SESSION_STATUS = {
  items: [
    {
      id: "item-1",
      kind: "subtree-coherence",
      scope: "specs/A.mdx#login",
      status: "unresolved",
      blocked: false,
    },
  ],
  totals: { unresolved: 1 },
};

const GOOD_ITEM = {
  id: "item-1",
  kind: "parent-consistency",
  status: "invalidated",
  blocked: true,
  blockedBy: ["item-0"],
  reason: "changed branches under the scope node",
  note: "checked once",
  scope: {
    node: "specs/A.mdx#login",
    present: true,
    text: "Login must work.\n",
    sourceRange: { start: 12, end: 96 },
  },
  context: [
    {
      node: "specs/A.mdx#login.validCredentials",
      present: true,
      text: "Branch.\n",
    },
    // An absent node: presented with identity and presence alone (T10.7-12).
    { node: "specs/A.mdx#login.badCredentials", present: false },
  ],
  origin: [
    {
      node: "specs/A.mdx#login.validCredentials",
      before: { present: true, text: "old text\n" },
      after: { present: false },
    },
  ],
  baseline: { recorded: ["opaque", "product-shaped"] },
  current: null, // opaque member: null is a legitimate "none recorded"
};

const GOOD_NEXT = { fullyResolved: false, item: GOOD_ITEM };
const GOOD_NEXT_RESOLVED = { fullyResolved: true };

const GOOD_EXPORT = {
  name: "review-1",
  strategy: "audit",
  creationParameters: null,
  decompositions: [],
  items: [GOOD_ITEM],
};

// --- decoder table -----------------------------------------------------------

interface BadCase {
  readonly label: string;
  readonly doc: unknown;
}

interface DecoderSpec {
  readonly name: string;
  readonly decode: (doc: unknown) => unknown;
  readonly good: unknown;
  readonly verify: (decoded: never) => void;
  readonly alsoGood?: readonly {
    label: string;
    doc: unknown;
    verify?: (decoded: never) => void;
  }[];
  readonly bad: readonly BadCase[];
}

const GENERIC_BAD: readonly BadCase[] = [
  { label: "null document", doc: null },
  { label: "array document", doc: [] },
  { label: "string document", doc: "not a report" },
  { label: "number document", doc: 42 },
];

const DECODERS: readonly DecoderSpec[] = [
  {
    name: "query node/show",
    decode: decodeNodeReport,
    good: GOOD_NODE,
    verify: (decoded: ReturnType<typeof decodeNodeReport>) => {
      expect(decoded.identity).toBe("specs/A.mdx#login");
      expect(decoded.sourceRange).toEqual({ start: 12, end: 96 });
      expect(decoded.ownText).toBe("Login must work.\n");
      expect(decoded.hashes.metadataHash).toBe("meta-1");
      expect(decoded.tags).toEqual(["auth", "v2"]);
      expect(decoded.coverage).toBe("none");
      expect(decoded.incomingEdges).toEqual([EDGE_IN]);
      expect(decoded.outgoingEdges).toEqual([EDGE_OUT]);
    },
    alsoGood: [
      {
        label: "root node: coverage attribute absent",
        doc: omit(GOOD_NODE, "coverage"),
        verify: (decoded: ReturnType<typeof decodeNodeReport>) => {
          expect(decoded.coverage).toBeUndefined();
        },
      },
      {
        label: "null coverage reads as absent (never as a fabricated value)",
        doc: put(GOOD_NODE, null, "coverage"),
        verify: (decoded: ReturnType<typeof decodeNodeReport>) => {
          expect(decoded.coverage).toBeUndefined();
        },
      },
    ],
    bad: [
      { label: "missing identity", doc: omit(GOOD_NODE, "identity") },
      { label: "empty identity", doc: put(GOOD_NODE, "", "identity") },
      { label: "missing sourceRange", doc: omit(GOOD_NODE, "sourceRange") },
      {
        label: "negative offset",
        doc: put(GOOD_NODE, -1, "sourceRange", "start"),
      },
      {
        label: "stringly-typed offset",
        doc: put(GOOD_NODE, "12", "sourceRange", "start"),
      },
      {
        label: "range with end < start",
        doc: put(GOOD_NODE, 5, "sourceRange", "end"),
      },
      { label: "missing ownText", doc: omit(GOOD_NODE, "ownText") },
      { label: "non-string ownText", doc: put(GOOD_NODE, 7, "ownText") },
      { label: "missing subtreeText", doc: omit(GOOD_NODE, "subtreeText") },
      { label: "missing hashes", doc: omit(GOOD_NODE, "hashes") },
      {
        label: "missing metadataHash",
        doc: omit(GOOD_NODE, "hashes", "metadataHash"),
      },
      { label: "empty ownHash", doc: put(GOOD_NODE, "", "hashes", "ownHash") },
      { label: "missing tags", doc: omit(GOOD_NODE, "tags") },
      { label: "non-string tag", doc: put(GOOD_NODE, [3], "tags") },
      {
        label: "wrong-typed coverage (must reject, not default to absent)",
        doc: put(GOOD_NODE, 42, "coverage"),
      },
      { label: "missing edges", doc: omit(GOOD_NODE, "edges") },
      {
        label: "missing incoming edges",
        doc: omit(GOOD_NODE, "edges", "incoming"),
      },
      {
        label: "outgoing edges not an array",
        doc: put(GOOD_NODE, {}, "edges", "outgoing"),
      },
      {
        label: "unknown edge kind",
        doc: put(GOOD_NODE, "dependz", "edges", "outgoing", 0, "kind"),
      },
      {
        label: "edge missing its target",
        doc: omit(GOOD_NODE, "edges", "incoming", 0, "to"),
      },
    ],
  },
  {
    name: "query node (identity/tags summary)",
    decode: decodeNodeSummary,
    good: GOOD_NODE,
    verify: (decoded: ReturnType<typeof decodeNodeSummary>) => {
      expect(decoded.identity).toBe("specs/A.mdx#login");
      expect(decoded.tags).toEqual(["auth", "v2"]);
    },
    alsoGood: [
      {
        // The point of the summary decoder: a document carrying only the
        // CONF-VALID-scoped query surface decodes — nothing beyond identity
        // and tags is demanded of the fixture product (CERTIFICATIONS.md
        // §CONF-VALID; T1.4-2, T1.4-4).
        label: "a document carrying only the scoped summary fields",
        doc: { identity: "specs/A.mdx#root-only", tags: [] },
        verify: (decoded: ReturnType<typeof decodeNodeSummary>) => {
          expect(decoded.identity).toBe("specs/A.mdx#root-only");
          expect(decoded.tags).toEqual([]);
        },
      },
    ],
    bad: [
      { label: "missing identity", doc: omit(GOOD_NODE, "identity") },
      { label: "empty identity", doc: put(GOOD_NODE, "", "identity") },
      { label: "missing tags", doc: omit(GOOD_NODE, "tags") },
      { label: "non-string tag", doc: put(GOOD_NODE, [3], "tags") },
    ],
  },
  {
    name: "query node (identity/tags/metadataHash summary)",
    decode: decodeNodeMetadataSummary,
    good: GOOD_NODE,
    verify: (decoded: ReturnType<typeof decodeNodeMetadataSummary>) => {
      expect(decoded.identity).toBe("specs/A.mdx#login");
      expect(decoded.tags).toEqual(["auth", "v2"]);
      expect(decoded.metadataHash).toBe("meta-1");
    },
    alsoGood: [
      {
        // The point of this summary decoder: a document carrying only the
        // CONF-VALID-scoped query surface — identity, tags, and metadataHash,
        // no other hash — decodes (CERTIFICATIONS.md §CONF-VALID; T2.6-1,
        // T2.6-2).
        label: "a document carrying only the scoped summary fields",
        doc: {
          identity: "specs/A.mdx#tagged",
          tags: ["a", "b"],
          hashes: { metadataHash: "meta-9" },
        },
        verify: (
          decoded: ReturnType<typeof decodeNodeMetadataSummary>,
        ): void => {
          expect(decoded.identity).toBe("specs/A.mdx#tagged");
          expect(decoded.tags).toEqual(["a", "b"]);
          expect(decoded.metadataHash).toBe("meta-9");
        },
      },
    ],
    bad: [
      { label: "missing identity", doc: omit(GOOD_NODE, "identity") },
      { label: "missing tags", doc: omit(GOOD_NODE, "tags") },
      { label: "missing hashes", doc: omit(GOOD_NODE, "hashes") },
      {
        label: "missing metadataHash",
        doc: omit(GOOD_NODE, "hashes", "metadataHash"),
      },
      {
        label: "empty metadataHash",
        doc: put(GOOD_NODE, "", "hashes", "metadataHash"),
      },
    ],
  },
  {
    name: "query node (own/subtree text summary)",
    decode: decodeNodeTextSummary,
    good: GOOD_NODE,
    verify: (decoded: ReturnType<typeof decodeNodeTextSummary>) => {
      expect(decoded.ownText).toBe("Login must work.\n");
      expect(decoded.subtreeText).toBe("Login must work.\n\nDetails.\n");
    },
    alsoGood: [
      {
        // The point of this summary decoder: a document carrying only the
        // CONF-MD-scoped query surface — own and subtree text, nothing else
        // — decodes (CERTIFICATIONS.md §CONF-MD; P-2, P-3), and empty texts
        // are legitimate values (an empty leaf section, SPEC.md 1.1), never
        // rejected and never defaulted.
        label: "a document carrying only the scoped text fields (both empty)",
        doc: { ownText: "", subtreeText: "" },
        verify: (decoded: ReturnType<typeof decodeNodeTextSummary>): void => {
          expect(decoded.ownText).toBe("");
          expect(decoded.subtreeText).toBe("");
        },
      },
    ],
    bad: [
      { label: "missing ownText", doc: omit(GOOD_NODE, "ownText") },
      { label: "non-string ownText", doc: put(GOOD_NODE, 7, "ownText") },
      { label: "null ownText", doc: put(GOOD_NODE, null, "ownText") },
      { label: "missing subtreeText", doc: omit(GOOD_NODE, "subtreeText") },
      {
        label: "non-string subtreeText",
        doc: put(GOOD_NODE, ["x"], "subtreeText"),
      },
    ],
  },
  {
    name: "query nodes (identity/tags summary rows)",
    decode: decodeNodeSummaryRowsReport,
    good: GOOD_ROWS,
    verify: (decoded: ReturnType<typeof decodeNodeSummaryRowsReport>) => {
      expect(decoded).toEqual([
        { identity: "specs/A.mdx#login", tags: ["auth"] },
        { identity: "specs/A.mdx", tags: [] },
      ]);
    },
    alsoGood: [
      {
        // Rows carrying only the CONF-VALID-scoped surface decode: no source
        // range is demanded of a scoped fixture product (CERTIFICATIONS.md
        // §CONF-VALID; T2.6-1).
        label: "rows carrying only the scoped summary fields",
        doc: { nodes: [{ identity: "specs/A.mdx#tagged", tags: ["a", "b"] }] },
        verify: (
          decoded: ReturnType<typeof decodeNodeSummaryRowsReport>,
        ): void => {
          expect(decoded).toEqual([
            { identity: "specs/A.mdx#tagged", tags: ["a", "b"] },
          ]);
        },
      },
    ],
    bad: [
      { label: "missing nodes list", doc: {} },
      { label: "nodes not an array", doc: { nodes: {} } },
      { label: "row not an object", doc: { nodes: [7] } },
      {
        label: "row missing identity",
        doc: omit(GOOD_ROWS, "nodes", 0, "identity"),
      },
      { label: "row missing tags", doc: omit(GOOD_ROWS, "nodes", 1, "tags") },
      {
        label: "row with a non-string tag",
        doc: put(GOOD_ROWS, [3], "nodes", 0, "tags"),
      },
    ],
  },
  {
    name: "query nodes (identity-only rows)",
    decode: decodeNodeIdentityRowsReport,
    good: GOOD_ROWS,
    verify: (decoded: ReturnType<typeof decodeNodeIdentityRowsReport>) => {
      expect(decoded).toEqual(["specs/A.mdx#login", "specs/A.mdx"]);
    },
    alsoGood: [
      {
        // The point of this decoder: rows carrying only an identity decode —
        // no tags, coverage, or source range is demanded of a fixture product
        // scoped to the no-node observation (CERTIFICATIONS.md §CONF-MD;
        // T3-1's grammar-boundary arm).
        label: "rows carrying only identities",
        doc: { nodes: [{ identity: "specs/A.mdx#alpha" }] },
        verify: (
          decoded: ReturnType<typeof decodeNodeIdentityRowsReport>,
        ): void => {
          expect(decoded).toEqual(["specs/A.mdx#alpha"]);
        },
      },
    ],
    bad: [
      { label: "missing nodes list", doc: {} },
      { label: "nodes not an array", doc: { nodes: {} } },
      { label: "row not an object", doc: { nodes: [7] } },
      {
        label: "row missing identity",
        doc: omit(GOOD_ROWS, "nodes", 0, "identity"),
      },
      {
        label: "row with an empty identity",
        doc: put(GOOD_ROWS, "", "nodes", 1, "identity"),
      },
    ],
  },
  {
    name: "query nodes/subtree/ancestors",
    decode: decodeNodeRowsReport,
    good: GOOD_ROWS,
    verify: (decoded: ReturnType<typeof decodeNodeRowsReport>) => {
      expect(decoded).toHaveLength(2);
      expect(decoded[0].identity).toBe("specs/A.mdx#login");
      expect(decoded[0].coverage).toBe("none");
      expect(decoded[1].identity).toBe("specs/A.mdx");
      expect(decoded[1].coverage).toBeUndefined();
      expect(decoded[1].tags).toEqual([]);
    },
    bad: [
      { label: "missing nodes list", doc: {} },
      { label: "nodes not an array", doc: { nodes: {} } },
      { label: "row not an object", doc: { nodes: [7] } },
      {
        label: "row missing identity",
        doc: omit(GOOD_ROWS, "nodes", 0, "identity"),
      },
      {
        label: "row missing sourceRange",
        doc: omit(GOOD_ROWS, "nodes", 0, "sourceRange"),
      },
      { label: "row missing tags", doc: omit(GOOD_ROWS, "nodes", 1, "tags") },
      {
        label: "row with wrong-typed coverage",
        doc: put(GOOD_ROWS, false, "nodes", 0, "coverage"),
      },
    ],
  },
  {
    name: "query edges",
    decode: decodeEdgesReport,
    good: GOOD_EDGES,
    verify: (decoded: ReturnType<typeof decodeEdgesReport>) => {
      expect(decoded).toEqual([EDGE_IN, EDGE_OUT]);
    },
    bad: [
      { label: "missing edges list", doc: {} },
      { label: "edge not an object", doc: { edges: [null] } },
      { label: "edge missing from", doc: omit(GOOD_EDGES, "edges", 0, "from") },
      {
        label: "edge with empty from",
        doc: put(GOOD_EDGES, "", "edges", 0, "from"),
      },
      { label: "edge missing kind", doc: omit(GOOD_EDGES, "edges", 1, "kind") },
      {
        label: "unknown edge kind",
        doc: put(GOOD_EDGES, "linked", "edges", 1, "kind"),
      },
    ],
  },
  {
    name: "query reachable",
    decode: decodeReachableReport,
    good: GOOD_REACHABLE,
    verify: (decoded: ReturnType<typeof decodeReachableReport>) => {
      expect(decoded.reachable).toBe(true);
      expect(decoded.path).toEqual([
        "specs/A.mdx#login",
        "specs/B.mdx#account",
      ]);
    },
    alsoGood: [
      {
        label: "unreachable: no witness path",
        doc: { reachable: false },
        verify: (decoded: ReturnType<typeof decodeReachableReport>) => {
          expect(decoded.reachable).toBe(false);
          expect(decoded.path).toBeUndefined();
        },
      },
    ],
    bad: [
      { label: "missing reachable flag", doc: { path: ["a"] } },
      {
        label: "stringly-typed reachable",
        doc: put(GOOD_REACHABLE, "yes", "reachable"),
      },
      { label: "reachable without a path", doc: omit(GOOD_REACHABLE, "path") },
      {
        label: "reachable with an empty path",
        doc: put(GOOD_REACHABLE, [], "path"),
      },
      {
        label: "path with an empty identity",
        doc: put(GOOD_REACHABLE, ["a", ""], "path"),
      },
      {
        label: "unreachable yet carrying a path (contradiction)",
        doc: { reachable: false, path: ["a"] },
      },
    ],
  },
  {
    name: "ids",
    decode: decodeIdsReport,
    good: GOOD_IDS,
    verify: (decoded: ReturnType<typeof decodeIdsReport>) => {
      expect(decoded.files.map((f) => f.file)).toEqual([
        "specs/A.mdx",
        "specs/B.mdx",
      ]);
      expect(decoded.files[0].ids).toEqual(["login", "login.validCredentials"]);
    },
    bad: [
      { label: "missing files list", doc: {} },
      { label: "entry missing file", doc: omit(GOOD_IDS, "files", 0, "file") },
      { label: "entry missing ids", doc: omit(GOOD_IDS, "files", 1, "ids") },
      {
        label: "ids not an array",
        doc: put(GOOD_IDS, "login", "files", 0, "ids"),
      },
      {
        label: "empty id",
        doc: put(GOOD_IDS, ["login", ""], "files", 0, "ids"),
      },
    ],
  },
  {
    name: "ids --tree",
    decode: decodeIdsTreeReport,
    good: GOOD_IDS_TREE,
    verify: (decoded: ReturnType<typeof decodeIdsTreeReport>) => {
      expect(decoded.files[0].nodes[0].id).toBe("login");
      expect(decoded.files[0].nodes[0].children[0].id).toBe(
        "login.validCredentials",
      );
      expect(decoded.files[0].nodes[0].children[0].children).toEqual([]);
    },
    bad: [
      { label: "missing files list", doc: {} },
      {
        label: "node missing id",
        doc: omit(GOOD_IDS_TREE, "files", 0, "nodes", 0, "id"),
      },
      {
        label: "node missing children",
        doc: omit(GOOD_IDS_TREE, "files", 0, "nodes", 0, "children"),
      },
      {
        label: "nested node missing children",
        doc: omit(
          GOOD_IDS_TREE,
          "files",
          0,
          "nodes",
          0,
          "children",
          0,
          "children",
        ),
      },
      {
        label: "children not an array",
        doc: put(GOOD_IDS_TREE, {}, "files", 0, "nodes", 0, "children"),
      },
    ],
  },
  {
    name: "12.7 findings report",
    decode: decodeFindingsReport,
    good: GOOD_FINDINGS,
    verify: (decoded: ReturnType<typeof decodeFindingsReport>) => {
      expect(decoded.findings).toHaveLength(6);
      // The document members decode literally (form-exact, H-3) …
      expect(decoded.findings[0].code).toBe("invalid-structural-id");
      expect(decoded.findings[0].locations).toEqual([
        { file: "specs/A.mdx", range: { start: 40, end: 78 } },
      ]);
      expect(decoded.findings[0].path).toBeNull();
      expect(decoded.findings[0].identities).toEqual([]);
      // … and the 14.N condition identity is DERIVED through the pinned
      // token table (model.ts), never read from the document.
      expect(decoded.findings[0].condition).toBe("14.2");
      expect(decoded.findings[1].condition).toBe("14.9");
      expect(decoded.findings[1].locations).toHaveLength(2);
      expect(decoded.findings[2].condition).toBe("14.12");
      expect(decoded.findings[2].identities).toEqual([
        "no-derived-to-base",
        "specs/A.mdx#login",
        "depends",
        "specs/B.mdx#account",
      ]);
      expect(decoded.findings[3].path).toBe(".xspec");
      expect(decoded.findings[4].code).toBe("refused-id-collision");
      expect(decoded.findings[4].condition).toBeNull(); // refusal: no 14.N
      expect(decoded.findings[5].code).toBeNull();
      expect(decoded.findings[5].condition).toBeNull();
    },
    alsoGood: [
      {
        label: "an empty findings array (a finding-free report)",
        doc: { findings: [] },
        verify: (decoded: ReturnType<typeof decodeFindingsReport>): void => {
          expect(decoded.findings).toEqual([]);
        },
      },
      {
        label:
          "a non-UTF-8 concerned path in the marked byte form (SPEC 12.0/12.7)",
        doc: {
          findings: [
            {
              code: "invalid-source-path",
              message: "a discovered source path is not valid UTF-8",
              locations: [],
              path: { bytes: "ff2f61" },
              identities: [],
            },
          ],
        },
        verify: (decoded: ReturnType<typeof decodeFindingsReport>): void => {
          expect(decoded.findings[0]!.path).toEqual({ bytes: "ff2f61" });
        },
      },
    ],
    bad: [
      { label: "missing findings list", doc: {} },
      {
        label: "null findings (null never encodes emptiness, SPEC 12.7)",
        doc: { findings: null },
      },
      {
        label: "an extra member on the report (12.7: exactly {findings})",
        doc: { findings: [], summary: "3 errors" },
      },
      {
        label: "finding missing its code member (null is never omitted)",
        doc: omit(GOOD_FINDINGS, "findings", 0, "code"),
      },
      {
        label: "unknown code token",
        doc: put(GOOD_FINDINGS, "oops", "findings", 0, "code"),
      },
      {
        label:
          'the condition ordinal spelled as the code ("14.2" is no token — ' +
          "the numeral is no part of the value, SPEC 14)",
        doc: put(GOOD_FINDINGS, "14.2", "findings", 0, "code"),
      },
      {
        label: "the retired pre-12.7 finding shape (condition/file/location)",
        doc: {
          findings: [
            {
              condition: "14.2",
              message: "old shape",
              file: "specs/A.mdx",
              location: { start: 40, end: 78 },
            },
          ],
        },
      },
      {
        label: "an extra member on a finding (12.7: exactly the five)",
        doc: put(GOOD_FINDINGS, "extra", "findings", 0, "hint"),
      },
      {
        label: "finding missing message",
        doc: omit(GOOD_FINDINGS, "findings", 1, "message"),
      },
      {
        label: "empty message",
        doc: put(GOOD_FINDINGS, "", "findings", 1, "message"),
      },
      {
        label: "finding missing locations",
        doc: omit(GOOD_FINDINGS, "findings", 0, "locations"),
      },
      {
        label: "null locations (a list-valued member is [] when empty)",
        doc: put(GOOD_FINDINGS, null, "findings", 0, "locations"),
      },
      {
        label: "location missing its range",
        doc: omit(GOOD_FINDINGS, "findings", 0, "locations", 0, "range"),
      },
      {
        label: "location with an extra member",
        doc: put(GOOD_FINDINGS, 3, "findings", 0, "locations", 0, "line"),
      },
      {
        label: "malformed range (end < start)",
        doc: put(
          GOOD_FINDINGS,
          { start: 78, end: 40 },
          "findings",
          0,
          "locations",
          0,
          "range",
        ),
      },
      {
        label: "range with an extra member (12.7: exactly {start, end})",
        doc: put(
          GOOD_FINDINGS,
          { start: 40, end: 78, length: 38 },
          "findings",
          0,
          "locations",
          0,
          "range",
        ),
      },
      {
        label:
          "locations out of order within a finding (12.7: file bytes, " +
          "then start, then end)",
        doc: put(
          GOOD_FINDINGS,
          [
            { file: "specs/B.mdx", range: { start: 5, end: 25 } },
            { file: "specs/A.mdx", range: { start: 10, end: 30 } },
          ],
          "findings",
          1,
          "locations",
        ),
      },
      {
        label: "finding missing its path member (null is never omitted)",
        doc: omit(GOOD_FINDINGS, "findings", 3, "path"),
      },
      {
        label: "wrong-typed path",
        doc: put(GOOD_FINDINGS, 9, "findings", 3, "path"),
      },
      {
        label: "byte-form path with uppercase hex",
        doc: put(GOOD_FINDINGS, { bytes: "FF2F61" }, "findings", 3, "path"),
      },
      {
        label: "byte-form path with odd-length hex",
        doc: put(GOOD_FINDINGS, { bytes: "ff2" }, "findings", 3, "path"),
      },
      {
        label:
          "byte-form path whose bytes are valid UTF-8 (12.7: such a path " +
          "is a plain string)",
        doc: put(GOOD_FINDINGS, { bytes: "612f62" }, "findings", 3, "path"),
      },
      {
        label: "byte-form path with an extra member",
        doc: put(
          GOOD_FINDINGS,
          { bytes: "ff", hint: "raw" },
          "findings",
          3,
          "path",
        ),
      },
      {
        label: "path string carrying a lone surrogate (no UTF-8 bytes)",
        doc: put(GOOD_FINDINGS, "\ud800", "findings", 3, "path"),
      },
      {
        label: "finding missing identities",
        doc: omit(GOOD_FINDINGS, "findings", 2, "identities"),
      },
      {
        label: "identities with an empty string",
        doc: put(GOOD_FINDINGS, [""], "findings", 2, "identities"),
      },
      {
        label: "identities not an array",
        doc: put(
          GOOD_FINDINGS,
          "no-derived-to-base",
          "findings",
          2,
          "identities",
        ),
      },
      {
        label:
          "findings out of the pinned order (numeric condition order: " +
          "14.9 may not precede 14.2)",
        doc: {
          findings: [
            structuredClone(GOOD_FINDINGS.findings[1]),
            structuredClone(GOOD_FINDINGS.findings[0]),
          ],
        },
      },
      {
        label:
          "lexicographic code-ordinal order passed off as numeric " +
          "(14.10 sorts after 14.2, not before)",
        doc: {
          findings: [
            {
              code: "stale-output", // 14.10
              message: "stale module",
              locations: [],
              path: "specs/A.xspec.ts",
              identities: [],
            },
            structuredClone(GOOD_FINDINGS.findings[0]), // 14.2
          ],
        },
      },
      {
        label: "a code-less finding sorted before a coded one",
        doc: {
          findings: [
            structuredClone(GOOD_FINDINGS.findings[5]),
            structuredClone(GOOD_FINDINGS.findings[0]),
          ],
        },
      },
      {
        label: "findings identical in every member (12.7 collapses duplicates)",
        doc: {
          findings: [
            structuredClone(GOOD_FINDINGS.findings[0]),
            structuredClone(GOOD_FINDINGS.findings[0]),
          ],
        },
      },
    ],
  },
  {
    name: "12.7 occurrences document",
    decode: decodeOccurrencesReport,
    good: GOOD_OCCURRENCES,
    verify: (decoded: ReturnType<typeof decodeOccurrencesReport>) => {
      expect(decoded.findings).toEqual([]);
      expect(decoded.occurrences).toHaveLength(3);
      // The record members decode literally (form-exact, H-3) …
      expect(decoded.occurrences[0]).toEqual({
        file: "specs/B.mdx",
        range: { start: 30, end: 47 },
        kind: "depends",
        source: {
          identity: "specs/B.mdx#intro",
          range: { start: 10, end: 90 },
        },
        target: "specs/A.mdx#login",
      });
      expect(decoded.occurrences[1]!.kind).toBe("references");
      expect(decoded.occurrences[1]!.source).toEqual({
        identity: "src/app.ts#entry",
        range: { start: 80, end: 140 },
      });
      // … and the marker decodes as the one-datum unavailability state,
      // never as a defaulted node (11.2, 12.7).
      expect(decoded.occurrences[2]!.source).toEqual({ unavailable: true });
    },
    alsoGood: [
      {
        label: "an empty enumeration (a finding-free empty answer, 11.3)",
        doc: { findings: [], occurrences: [] },
        verify: (decoded: ReturnType<typeof decodeOccurrencesReport>): void => {
          expect(decoded.findings).toEqual([]);
          expect(decoded.occurrences).toEqual([]);
        },
      },
      {
        label: "the consulted domain's findings accompany the answer (11.2)",
        doc: {
          findings: [structuredClone(GOOD_FINDINGS.findings[0])],
          occurrences: [structuredClone(GOOD_OCCURRENCES.occurrences[0])],
        },
        verify: (decoded: ReturnType<typeof decodeOccurrencesReport>): void => {
          expect(decoded.findings).toHaveLength(1);
          expect(decoded.findings[0]!.code).toBe("invalid-structural-id");
        },
      },
      {
        label:
          "a non-UTF-8 referencing file in the marked byte form (SPEC 12.0)",
        doc: {
          findings: [],
          occurrences: [
            {
              file: { bytes: "ff2f61" },
              range: { start: 4, end: 12 },
              kind: "depends",
              source: { unavailable: true },
              target: "specs/A.mdx#login",
            },
          ],
        },
        verify: (decoded: ReturnType<typeof decodeOccurrencesReport>): void => {
          expect(decoded.occurrences[0]!.file).toEqual({ bytes: "ff2f61" });
        },
      },
      {
        label:
          "same-start ranges break the tie by range end (5.7's stated order)",
        doc: {
          findings: [],
          occurrences: [
            structuredClone(GOOD_OCCURRENCES.occurrences[1]),
            {
              ...structuredClone(GOOD_OCCURRENCES.occurrences[2]),
              range: { start: 120, end: 140 },
            },
          ],
        },
      },
    ],
    bad: [
      {
        label: "missing findings member",
        doc: omit(GOOD_OCCURRENCES, "findings"),
      },
      {
        label: "null findings (a list-valued member is [] when empty)",
        doc: put(GOOD_OCCURRENCES, null, "findings"),
      },
      {
        label: "missing occurrences member",
        doc: omit(GOOD_OCCURRENCES, "occurrences"),
      },
      {
        label: "null occurrences (null never encodes emptiness, SPEC 12.7)",
        doc: put(GOOD_OCCURRENCES, null, "occurrences"),
      },
      {
        label: "occurrences not an array",
        doc: put(GOOD_OCCURRENCES, {}, "occurrences"),
      },
      {
        label:
          "an extra member on the document (12.7: exactly " +
          "{findings, occurrences})",
        doc: put(GOOD_OCCURRENCES, 3, "count"),
      },
      {
        label: "record missing its file",
        doc: omit(GOOD_OCCURRENCES, "occurrences", 0, "file"),
      },
      {
        label: "record missing its range",
        doc: omit(GOOD_OCCURRENCES, "occurrences", 0, "range"),
      },
      {
        label: "record missing its kind",
        doc: omit(GOOD_OCCURRENCES, "occurrences", 0, "kind"),
      },
      {
        label: "record missing its source (one datum, never omitted)",
        doc: omit(GOOD_OCCURRENCES, "occurrences", 0, "source"),
      },
      {
        label: "record missing its target",
        doc: omit(GOOD_OCCURRENCES, "occurrences", 0, "target"),
      },
      {
        label: "empty target identity",
        doc: put(GOOD_OCCURRENCES, "", "occurrences", 0, "target"),
      },
      {
        label: "an extra member on a record (12.7: exactly the five)",
        doc: put(GOOD_OCCURRENCES, "hint", "occurrences", 0, "note"),
      },
      {
        label:
          '"contains" as a record kind (5.2: no reference occurrence ' +
          "carries it)",
        doc: put(GOOD_OCCURRENCES, "contains", "occurrences", 0, "kind"),
      },
      {
        label:
          "null source (the datum is defined or explicitly unavailable, " +
          "never null)",
        doc: put(GOOD_OCCURRENCES, null, "occurrences", 1, "source"),
      },
      {
        label: "source node missing its identity",
        doc: omit(GOOD_OCCURRENCES, "occurrences", 1, "source", "identity"),
      },
      {
        label: "source node missing its range (one datum: both together)",
        doc: omit(GOOD_OCCURRENCES, "occurrences", 1, "source", "range"),
      },
      {
        label: "source node with an extra member",
        doc: put(GOOD_OCCURRENCES, 1, "occurrences", 1, "source", "n"),
      },
      {
        label:
          "a widened unavailability marker (12.7: the marker is exactly " +
          '{"unavailable": true})',
        doc: put(
          GOOD_OCCURRENCES,
          { unavailable: true, identity: "src/app.ts" },
          "occurrences",
          2,
          "source",
        ),
      },
      {
        label: "a bare-identity source (12.7 fixes the object form)",
        doc: put(
          GOOD_OCCURRENCES,
          "src/app.ts#entry",
          "occurrences",
          1,
          "source",
        ),
      },
      {
        label: "negative range offset",
        doc: put(GOOD_OCCURRENCES, -1, "occurrences", 0, "range", "start"),
      },
      {
        label:
          "records out of occurrence order (5.7: file path bytes, then " +
          "range start, then range end)",
        doc: {
          findings: [],
          occurrences: [
            structuredClone(GOOD_OCCURRENCES.occurrences[1]),
            structuredClone(GOOD_OCCURRENCES.occurrences[0]),
          ],
        },
      },
      {
        label:
          "two records over one (file, range) key (5.7: distinct " +
          "occurrences occupy distinct spans)",
        doc: {
          findings: [],
          occurrences: [
            structuredClone(GOOD_OCCURRENCES.occurrences[0]),
            structuredClone(GOOD_OCCURRENCES.occurrences[0]),
          ],
        },
      },
      {
        label: "findings out of the pinned order inside the document",
        doc: put(
          GOOD_OCCURRENCES,
          [
            structuredClone(GOOD_FINDINGS.findings[1]),
            structuredClone(GOOD_FINDINGS.findings[0]),
          ],
          "findings",
        ),
      },
    ],
  },
  {
    name: "12.7 at document",
    decode: decodeAtReport,
    good: GOOD_AT,
    verify: (decoded: ReturnType<typeof decodeAtReport>) => {
      expect(decoded.findings).toEqual([]);
      // The resolution decodes literally (form-exact, H-3): the innermost
      // enclosing section construct with its defined identity, and no
      // containing occurrence (`null` is spelled, never omitted).
      expect(decoded.resolution).toEqual({
        section: {
          identity: "specs/A.mdx#login",
          range: { start: 10, end: 90 },
        },
        occurrence: null,
      });
    },
    alsoGood: [
      {
        label:
          "the resolution explicitly unavailable on an unparseable file " +
          "(11.5) — never a defaulted section",
        doc: { findings: [], resolution: { unavailable: true } },
        verify: (decoded: ReturnType<typeof decodeAtReport>): void => {
          expect(decoded.resolution).toEqual({ unavailable: true });
        },
      },
      {
        label:
          "the section's identity unavailable per 11.2 while its " +
          "construct range stays on view",
        doc: {
          findings: [],
          resolution: {
            section: {
              identity: { unavailable: true },
              range: { start: 0, end: 40 },
            },
            occurrence: null,
          },
        },
        verify: (decoded: ReturnType<typeof decodeAtReport>): void => {
          expect(decoded.resolution).toEqual({
            section: {
              identity: { unavailable: true },
              range: { start: 0, end: 40 },
            },
            occurrence: null,
          });
        },
      },
      {
        label: "a containing occurrence's record decodes literally (5.7, 12.7)",
        doc: put(
          GOOD_AT,
          structuredClone(GOOD_OCCURRENCES.occurrences[0]),
          "resolution",
          "occurrence",
        ),
        verify: (decoded: ReturnType<typeof decodeAtReport>): void => {
          const resolution = decoded.resolution;
          if ("unavailable" in resolution) {
            throw new Error("resolution unexpectedly unavailable");
          }
          expect(resolution.occurrence).toEqual(
            GOOD_OCCURRENCES.occurrences[0],
          );
        },
      },
    ],
    bad: [
      { label: "missing findings member", doc: omit(GOOD_AT, "findings") },
      {
        label: "missing resolution member (null is never omission, SPEC 12.7)",
        doc: omit(GOOD_AT, "resolution"),
      },
      {
        label:
          "null resolution (a value or the unavailability marker, never null)",
        doc: put(GOOD_AT, null, "resolution"),
      },
      {
        label:
          "an extra member on the document (12.7: exactly " +
          "{findings, resolution})",
        doc: put(GOOD_AT, 20, "offset"),
      },
      {
        label: "resolution missing its section",
        doc: omit(GOOD_AT, "resolution", "section"),
      },
      {
        label:
          "resolution missing its occurrence member (null is spelled, " +
          "never omitted, SPEC 12.7)",
        doc: omit(GOOD_AT, "resolution", "occurrence"),
      },
      {
        label: "an extra member on the resolution",
        doc: put(GOOD_AT, 1, "resolution", "extra"),
      },
      {
        label: "section missing its range",
        doc: omit(GOOD_AT, "resolution", "section", "range"),
      },
      {
        label: "section missing its identity",
        doc: omit(GOOD_AT, "resolution", "section", "identity"),
      },
      {
        label:
          "null section identity (defined or explicitly unavailable, " +
          "never null — SPEC 11.2, 12.7)",
        doc: put(GOOD_AT, null, "resolution", "section", "identity"),
      },
      {
        label: "an extra member on the section",
        doc: put(GOOD_AT, "x", "resolution", "section", "note"),
      },
      {
        label:
          "a widened unavailability marker as the resolution (12.7: the " +
          'marker is exactly {"unavailable": true})',
        doc: put(GOOD_AT, { unavailable: true, section: null }, "resolution"),
      },
    ],
  },
  {
    name: "12.7 view document (files)",
    decode: decodeViewFilesReport,
    good: GOOD_VIEWS,
    verify: (decoded: ReturnType<typeof decodeViewFilesReport>) => {
      expect(decoded.findings).toEqual([]);
      // The per-file `file` members in the reported (path-byte) order; the
      // unread wrapper members are presence-checked only (module scope).
      expect(decoded.files).toEqual(["specs/A.mdx", "specs/B.mdx"]);
    },
    alsoGood: [
      {
        label:
          "an empty request (a glob admitting none — an empty, " +
          "finding-free answer, 11.4)",
        doc: { findings: [], views: [] },
        verify: (decoded: ReturnType<typeof decodeViewFilesReport>): void => {
          expect(decoded.findings).toEqual([]);
          expect(decoded.files).toEqual([]);
        },
      },
      {
        label: "a non-UTF-8 view file in the marked byte form (SPEC 12.0)",
        doc: {
          findings: [],
          views: [
            {
              file: { bytes: "ff2e6d6478" },
              root: { placeholder: true },
              imports: [],
              occurrences: [],
              comments: [],
            },
          ],
        },
        verify: (decoded: ReturnType<typeof decodeViewFilesReport>): void => {
          expect(decoded.files).toEqual([{ bytes: "ff2e6d6478" }]);
        },
      },
    ],
    bad: [
      { label: "missing findings member", doc: omit(GOOD_VIEWS, "findings") },
      { label: "missing views member", doc: omit(GOOD_VIEWS, "views") },
      {
        label: "null views (null never encodes emptiness, SPEC 12.7)",
        doc: put(GOOD_VIEWS, null, "views"),
      },
      {
        label:
          "an extra member on the document (12.7: exactly {findings, views})",
        doc: put(GOOD_VIEWS, 2, "count"),
      },
      {
        label: "a per-file view missing its file",
        doc: omit(GOOD_VIEWS, "views", 0, "file"),
      },
      {
        label:
          "a per-file view missing its root member (every wrapper member " +
          "is present, SPEC 12.7)",
        doc: omit(GOOD_VIEWS, "views", 0, "root"),
      },
      {
        label: "a per-file view missing its comments member",
        doc: omit(GOOD_VIEWS, "views", 1, "comments"),
      },
      {
        label:
          "an extra member on a per-file view (12.7: exactly " +
          "{file, root, imports, occurrences, comments})",
        doc: put(GOOD_VIEWS, 1, "views", 0, "extra"),
      },
      {
        label: "per-file views out of file-path byte order (SPEC 11.4, 12.7)",
        doc: {
          findings: [],
          views: [
            structuredClone(GOOD_VIEWS.views[1]),
            structuredClone(GOOD_VIEWS.views[0]),
          ],
        },
      },
      {
        label:
          "duplicate per-file views (11.4: the requested files form a set)",
        doc: {
          findings: [],
          views: [
            structuredClone(GOOD_VIEWS.views[0]),
            structuredClone(GOOD_VIEWS.views[0]),
          ],
        },
      },
    ],
  },
  {
    name: "12.7 view document (full)",
    decode: (doc: unknown) => decodeViewReport(doc, { text: false }),
    good: GOOD_VIEW_FULL,
    verify: (decoded: ViewReport) => {
      expect(decoded.findings).toEqual([]);
      expect(decoded.views).toHaveLength(1);
      const view = decoded.views[0]!;
      expect(view.file).toBe("specs/A.mdx");
      // The tree decodes literally: root with the stated-null tags/coverage
      // and no tag ranges; the paired child with both tag ranges, the named
      // and the spread attribute entry; the self-closing child with
      // identity/tags as the one-datum unavailability state (11.2, 12.7).
      expect(view.root.identity).toBe("specs/A.mdx");
      expect(view.root.tags).toBeNull();
      expect(view.root.coverage).toBeNull();
      expect(view.root.opening).toBeNull();
      expect(view.root.attributes).toEqual([]);
      expect(view.root.children).toHaveLength(2);
      const paired = view.root.children[0]!;
      expect(paired.identity).toBe("specs/A.mdx#login");
      expect(paired.opening).toEqual({ start: 40, end: 62 });
      expect(paired.closing).toEqual({ start: 116, end: 120 });
      expect(paired.attributes).toEqual([
        { name: "id", range: { start: 43, end: 53 }, text: 'id="login"' },
        { name: null, range: { start: 54, end: 60 }, text: "{...p}" },
      ]);
      expect(paired.tags).toEqual(["auth", "v2"]);
      expect(paired.coverage).toBe("required");
      // Without --text the text members are absent (12.7's stated
      // conditional presence), never defaulted in.
      expect("ownText" in paired).toBe(false);
      expect("subtreeText" in paired).toBe(false);
      const selfClosing = view.root.children[1]!;
      expect(selfClosing.identity).toEqual({ unavailable: true });
      expect(selfClosing.closing).toBeNull();
      expect(selfClosing.tags).toEqual({ unavailable: true });
      // Imports decode in both target states; the file's occurrence records
      // and comment ranges decode literally.
      expect(view.imports).toHaveLength(2);
      expect(view.imports[0]!.name).toBe("BASE");
      expect(view.imports[0]!.target).toBe("specs/B.mdx");
      expect(view.imports[1]!.name).toBeNull();
      expect(view.imports[1]!.target).toEqual({ unavailable: true });
      expect(view.occurrences).toHaveLength(2);
      expect(view.occurrences[0]!.kind).toBe("embeds");
      expect(view.occurrences[1]!.source).toEqual({ unavailable: true });
      expect(view.comments).toEqual([
        { start: 150, end: 170 },
        { start: 175, end: 195 },
      ]);
    },
    alsoGood: [
      {
        label:
          "an empty request with findings accompanying (a masked domain: " +
          "every requested file unparseable contributes no entry, 11.4)",
        doc: {
          findings: [structuredClone(GOOD_FINDINGS.findings[0])],
          views: [],
        },
        verify: (decoded: ViewReport): void => {
          expect(decoded.findings).toHaveLength(1);
          expect(decoded.views).toEqual([]);
        },
      },
    ],
    bad: [
      {
        label: "ownText present without --text (12.7 conditional presence)",
        doc: put(GOOD_VIEW_FULL, "x", "views", 0, "root", "ownText"),
      },
      {
        label: "node missing its identity member",
        doc: omit(GOOD_VIEW_FULL, "views", 0, "root", "identity"),
      },
      {
        label:
          "null node identity (defined or explicitly unavailable, never " +
          "null — SPEC 11.2, 12.7)",
        doc: put(GOOD_VIEW_FULL, null, "views", 0, "root", "identity"),
      },
      {
        label:
          "a widened unavailability marker as a node identity (12.7: the " +
          'marker is exactly {"unavailable": true})',
        doc: put(
          GOOD_VIEW_FULL,
          { unavailable: true, id: "x" },
          "views",
          0,
          "root",
          "children",
          1,
          "identity",
        ),
      },
      {
        label: "node missing its range",
        doc: omit(GOOD_VIEW_FULL, "views", 0, "root", "range"),
      },
      {
        label: "node missing its opening member (null is never omission)",
        doc: omit(GOOD_VIEW_FULL, "views", 0, "root", "opening"),
      },
      {
        label: "node missing its attributes member",
        doc: omit(GOOD_VIEW_FULL, "views", 0, "root", "attributes"),
      },
      {
        label: "null attributes (a root's empty list is [], SPEC 12.7)",
        doc: put(GOOD_VIEW_FULL, null, "views", 0, "root", "attributes"),
      },
      {
        label: "an extra member on a node",
        doc: put(GOOD_VIEW_FULL, 1, "views", 0, "root", "note"),
      },
      {
        label: "attribute entry missing its text",
        doc: omit(
          GOOD_VIEW_FULL,
          "views",
          0,
          "root",
          "children",
          0,
          "attributes",
          0,
          "text",
        ),
      },
      {
        label:
          "attribute text whose byte length differs from its range " +
          "(11.4: the attribute's own characters)",
        doc: put(
          GOOD_VIEW_FULL,
          'id="log"',
          "views",
          0,
          "root",
          "children",
          0,
          "attributes",
          0,
          "text",
        ),
      },
      {
        label: "an extra member on an attribute entry",
        doc: put(
          GOOD_VIEW_FULL,
          true,
          "views",
          0,
          "root",
          "children",
          0,
          "attributes",
          0,
          "spread",
        ),
      },
      {
        label: "non-string attribute name (null only for a spread)",
        doc: put(
          GOOD_VIEW_FULL,
          7,
          "views",
          0,
          "root",
          "children",
          0,
          "attributes",
          0,
          "name",
        ),
      },
      {
        label: "a non-string tag element",
        doc: put(
          GOOD_VIEW_FULL,
          [3],
          "views",
          0,
          "root",
          "children",
          0,
          "tags",
        ),
      },
      {
        label:
          'coverage outside the defined values ("required"/"none" — an ' +
          "invalid-valued prop is the unavailability marker instead, 11.2)",
        doc: put(
          GOOD_VIEW_FULL,
          "optional",
          "views",
          0,
          "root",
          "children",
          0,
          "coverage",
        ),
      },
      {
        label: "node missing its children member",
        doc: omit(GOOD_VIEW_FULL, "views", 0, "root", "children"),
      },
      {
        label: "children out of document order (SPEC 11.4)",
        doc: put(
          GOOD_VIEW_FULL,
          [
            structuredClone(GOOD_VIEW_FULL.views[0]!.root.children[1]),
            structuredClone(GOOD_VIEW_FULL.views[0]!.root.children[0]),
          ],
          "views",
          0,
          "root",
          "children",
        ),
      },
      {
        label:
          "an occurrence record whose file differs from the view's file " +
          "(11.4: the file's own occurrence records)",
        doc: put(
          GOOD_VIEW_FULL,
          "specs/Z.mdx",
          "views",
          0,
          "occurrences",
          0,
          "file",
        ),
      },
      {
        label: "occurrence records out of document order (SPEC 5.7, 11.4)",
        doc: put(
          GOOD_VIEW_FULL,
          [
            structuredClone(GOOD_VIEW_FULL.views[0]!.occurrences[1]),
            structuredClone(GOOD_VIEW_FULL.views[0]!.occurrences[0]),
          ],
          "views",
          0,
          "occurrences",
        ),
      },
      {
        label: "comment ranges out of document order (SPEC 11.4)",
        doc: put(
          GOOD_VIEW_FULL,
          [
            structuredClone(GOOD_VIEW_FULL.views[0]!.comments[1]),
            structuredClone(GOOD_VIEW_FULL.views[0]!.comments[0]),
          ],
          "views",
          0,
          "comments",
        ),
      },
      {
        label: "import entry missing its name member (null is never omission)",
        doc: omit(GOOD_VIEW_FULL, "views", 0, "imports", 0, "name"),
      },
      {
        label:
          "null import target (a path value or the unavailability marker, " +
          "never null — SPEC 11.4, 12.7)",
        doc: put(GOOD_VIEW_FULL, null, "views", 0, "imports", 1, "target"),
      },
    ],
  },
  {
    name: "12.7 view document (full, --text)",
    decode: (doc: unknown) => decodeViewReport(doc, { text: true }),
    good: GOOD_VIEW_FULL_TEXT,
    verify: (decoded: ViewReport) => {
      const root = decoded.views[0]!.root;
      // With --text both text members are present per node: plain strings
      // (empty legitimate) and the marker decode as distinct states,
      // never collapsed (11.2, 12.7).
      expect(root.ownText).toBe("Prose.\n");
      expect(root.subtreeText).toEqual({ unavailable: true });
      const child = root.children[0]!;
      expect(child.ownText).toBe("");
      expect(child.subtreeText).toEqual({ unavailable: true });
    },
    bad: [
      {
        label:
          "text members absent under --text (12.7 conditional presence: " +
          "present exactly when the flag is given)",
        doc: structuredClone(GOOD_VIEW_FULL),
      },
      {
        label: "node missing its subtreeText under --text",
        doc: omit(
          GOOD_VIEW_FULL_TEXT,
          "views",
          0,
          "root",
          "children",
          0,
          "subtreeText",
        ),
      },
      {
        label:
          "null ownText (a plain string or the unavailability marker, " +
          "never null — SPEC 11.2, 12.7)",
        doc: put(GOOD_VIEW_FULL_TEXT, null, "views", 0, "root", "ownText"),
      },
      {
        label: "a widened unavailability marker as subtreeText",
        doc: put(
          GOOD_VIEW_FULL_TEXT,
          { unavailable: true, partial: "x" },
          "views",
          0,
          "root",
          "subtreeText",
        ),
      },
    ],
  },
  {
    name: "12.7 preview document",
    decode: decodePreviewReport,
    good: GOOD_PREVIEW,
    verify: (decoded: ReturnType<typeof decodePreviewReport>) => {
      expect(decoded.findings).toEqual([]);
      // The plan members decode literally (form-exact, H-3) …
      expect(decoded.mapping).toEqual([
        { from: "specs/A.mdx#login", to: "specs/B.mdx#login" },
        { from: "specs/A.mdx#login.form", to: "specs/B.mdx#login.form" },
      ]);
      expect(decoded.files).toHaveLength(2);
      expect(decoded.files![0]).toEqual({
        file: "specs/A.mdx",
        edits: [
          { class: "origin-deletion", range: { start: 40, end: 160 } },
          { class: "id-rewrite", range: { start: 48, end: 58 } },
          { class: "reference-rewrite", range: { start: 200, end: 216 } },
        ],
      });
      // … the coinciding zero-length insertion points pass in class-byte
      // order (import-addition before target-insertion, SPEC 12.7) …
      expect(decoded.files![1]!.edits.map((edit) => edit.class)).toEqual([
        "import-addition",
        "target-insertion",
      ]);
      // … and the delta is the two-direction datum.
      expect(decoded.delta).toEqual({
        generated: ["specs/B.md", "specs/B.xspec.ts"],
        removed: ["specs/A.md", "specs/A.xspec.ts"],
      });
    },
    alsoGood: [
      {
        label:
          "a refused preview: refusal findings alone, mapping/files/delta " +
          "null together (SPEC 6.6, 12.7)",
        doc: REFUSED_PREVIEW,
        verify: (decoded: ReturnType<typeof decodePreviewReport>): void => {
          expect(decoded.findings).toHaveLength(1);
          expect(decoded.findings[0]!.code).toBe("refused-identity-unchanged");
          expect(decoded.mapping).toBeNull();
          expect(decoded.files).toBeNull();
          expect(decoded.delta).toBeNull();
        },
      },
      {
        label:
          "delta explicitly unavailable as one datum beside a full plan " +
          "(the unreadable-record state, SPEC 6.6, 14.23)",
        doc: put(GOOD_PREVIEW, { unavailable: true }, "delta"),
        verify: (decoded: ReturnType<typeof decodePreviewReport>): void => {
          expect(decoded.delta).toEqual({ unavailable: true });
          expect(decoded.mapping).not.toBeNull();
        },
      },
      {
        label: "empty plan lists ([] is emptiness, never null — SPEC 12.7)",
        doc: {
          findings: [],
          mapping: [],
          files: [],
          delta: { generated: [], removed: [] },
        },
        verify: (decoded: ReturnType<typeof decodePreviewReport>): void => {
          expect(decoded.mapping).toEqual([]);
          expect(decoded.files).toEqual([]);
          expect(decoded.delta).toEqual({ generated: [], removed: [] });
        },
      },
    ],
    bad: [
      {
        label: "missing findings member",
        doc: omit(GOOD_PREVIEW, "findings"),
      },
      {
        label: "null findings (a list-valued member is [] when empty)",
        doc: put(GOOD_PREVIEW, null, "findings"),
      },
      {
        label: "missing mapping member (null is never omitted, SPEC 12.7)",
        doc: omit(GOOD_PREVIEW, "mapping"),
      },
      {
        label: "missing files member",
        doc: omit(GOOD_PREVIEW, "files"),
      },
      {
        label: "missing delta member",
        doc: omit(GOOD_PREVIEW, "delta"),
      },
      {
        label:
          "an extra member on the document (12.7: exactly " +
          "{findings, mapping, files, delta})",
        doc: put(GOOD_PREVIEW, "rename", "operation"),
      },
      {
        label:
          "mixed nullity: mapping null beside a present plan (null marks " +
          "the refusal encoding, all three together — SPEC 6.6, 12.7)",
        doc: put(GOOD_PREVIEW, null, "mapping"),
      },
      {
        label: "mixed nullity: a refusal document carrying a delta",
        doc: put(REFUSED_PREVIEW, { generated: [], removed: [] }, "delta"),
      },
      {
        label: "mapping entries out of `from`-byte order",
        doc: put(
          GOOD_PREVIEW,
          [...structuredClone(GOOD_PREVIEW.mapping)].reverse(),
          "mapping",
        ),
      },
      {
        label:
          "two mapping entries for one identity (one {from, to} per " +
          "mapped identity)",
        doc: put(
          GOOD_PREVIEW,
          [
            { from: "specs/A.mdx#login", to: "specs/B.mdx#login" },
            { from: "specs/A.mdx#login", to: "specs/B.mdx#other" },
          ],
          "mapping",
        ),
      },
      {
        label: "mapping pair missing its to",
        doc: omit(GOOD_PREVIEW, "mapping", 0, "to"),
      },
      {
        label: "mapping pair with an extra member",
        doc: put(GOOD_PREVIEW, "rename", "mapping", 0, "via"),
      },
      {
        label: "empty from identity",
        doc: put(GOOD_PREVIEW, "", "mapping", 0, "from"),
      },
      {
        label: "file entries out of path-byte order",
        doc: put(
          GOOD_PREVIEW,
          [...structuredClone(GOOD_PREVIEW.files)].reverse(),
          "files",
        ),
      },
      {
        label: "two file entries for one path (one {file, edits} per file)",
        doc: put(
          GOOD_PREVIEW,
          [
            structuredClone(GOOD_PREVIEW.files[0]),
            structuredClone(GOOD_PREVIEW.files[0]),
          ],
          "files",
        ),
      },
      {
        label: "file entry missing its edits",
        doc: omit(GOOD_PREVIEW, "files", 0, "edits"),
      },
      {
        label: "null edits (a list-valued member is [] when empty)",
        doc: put(GOOD_PREVIEW, null, "files", 0, "edits"),
      },
      {
        label: "file entry with an extra member",
        doc: put(GOOD_PREVIEW, "hint", "files", 0, "note"),
      },
      {
        label: "an edit class outside the ten 12.7 names",
        doc: put(
          GOOD_PREVIEW,
          "text-replacement",
          "files",
          0,
          "edits",
          0,
          "class",
        ),
      },
      {
        label:
          "an edit carrying replacement text (class-plus-range only, " +
          "SPEC 6.6, 12.7)",
        doc: put(GOOD_PREVIEW, "new bytes", "files", 0, "edits", 0, "text"),
      },
      {
        label: "edit missing its range",
        doc: omit(GOOD_PREVIEW, "files", 0, "edits", 0, "range"),
      },
      {
        label: "edits out of range-start order",
        doc: put(
          GOOD_PREVIEW,
          [...structuredClone(GOOD_PREVIEW.files[0]!.edits)].reverse(),
          "files",
          0,
          "edits",
        ),
      },
      {
        label:
          "coinciding zero-length insertion points out of class-byte order " +
          "(target-insertion may not precede import-addition, SPEC 12.7)",
        doc: put(
          GOOD_PREVIEW,
          [...structuredClone(GOOD_PREVIEW.files[1]!.edits)].reverse(),
          "files",
          1,
          "edits",
        ),
      },
      {
        label: "delta missing a direction (12.7: exactly {generated, removed})",
        doc: omit(GOOD_PREVIEW, "delta", "removed"),
      },
      {
        label: "delta with an extra member",
        doc: put(GOOD_PREVIEW, [], "delta", "changed"),
      },
      {
        label: "null delta direction (a list-valued member is [] when empty)",
        doc: put(GOOD_PREVIEW, null, "delta", "generated"),
      },
      {
        label: "delta paths out of byte order",
        doc: put(
          GOOD_PREVIEW,
          ["specs/B.xspec.ts", "specs/B.md"],
          "delta",
          "generated",
        ),
      },
      {
        label: "one derived path listed twice in a direction",
        doc: put(
          GOOD_PREVIEW,
          ["specs/B.md", "specs/B.md"],
          "delta",
          "generated",
        ),
      },
      {
        label:
          "a widened unavailability marker as delta (12.7: the marker is " +
          'exactly {"unavailable": true})',
        doc: put(GOOD_PREVIEW, { unavailable: true, note: "x" }, "delta"),
      },
      {
        label: "findings out of the pinned order inside the document",
        doc: put(
          GOOD_PREVIEW,
          [
            structuredClone(GOOD_FINDINGS.findings[1]),
            structuredClone(GOOD_FINDINGS.findings[0]),
          ],
          "findings",
        ),
      },
    ],
  },
  {
    name: "12.7 error document",
    decode: decodeErrorDocument,
    good: {
      error: {
        code: "configuration-error", // 14.14
        message: "unknown key `bogus` in xspec.config.ts",
        locations: [],
        path: "xspec.config.ts",
        identities: [],
      },
    },
    verify: (decoded: ReturnType<typeof decodeErrorDocument>) => {
      // {"error": …} holding one literal finding form (SPEC 12.0, 12.7):
      // a configuration error carries the stable code and concerned path.
      expect(decoded.error.code).toBe("configuration-error");
      expect(decoded.error.condition).toBe("14.14");
      expect(decoded.error.path).toBe("xspec.config.ts");
      expect(decoded.error.locations).toEqual([]);
      expect(decoded.error.identities).toEqual([]);
    },
    alsoGood: [
      {
        label: "a plain usage error: code and path null (SPEC 12.7)",
        doc: {
          error: {
            code: null,
            message: "unknown flag --definitely-not-a-flag",
            locations: [],
            path: null,
            identities: [],
          },
        },
        verify: (decoded: ReturnType<typeof decodeErrorDocument>): void => {
          expect(decoded.error.code).toBeNull();
          expect(decoded.error.condition).toBeNull();
          expect(decoded.error.path).toBeNull();
        },
      },
      {
        label:
          "a missing-configuration error concerning the working directory " +
          '(anchoring form "." for a failed upward search, SPEC 14)',
        doc: {
          error: {
            code: "configuration-error",
            message: "no xspec.config.ts found by upward search",
            locations: [],
            path: ".",
            identities: [],
          },
        },
        verify: (decoded: ReturnType<typeof decodeErrorDocument>): void => {
          expect(decoded.error.path).toBe(".");
        },
      },
    ],
    bad: [
      { label: "missing error member", doc: {} },
      {
        label: "null error member (the finding form is an object)",
        doc: { error: null },
      },
      {
        label: "an extra member beside error (12.7: exactly {error})",
        doc: {
          error: {
            code: null,
            message: "unknown flag",
            locations: [],
            path: null,
            identities: [],
          },
          findings: [],
        },
      },
      {
        label:
          "the findings-only report shape passed off as the error document",
        doc: { findings: [] },
      },
      { label: "error as a bare string", doc: { error: "unknown flag" } },
      {
        label: "error finding missing its code member (null is never omitted)",
        doc: {
          error: {
            message: "unknown flag",
            locations: [],
            path: null,
            identities: [],
          },
        },
      },
      {
        label: "error finding with an unknown code token",
        doc: {
          error: {
            code: "usage-error",
            message: "unknown flag",
            locations: [],
            path: null,
            identities: [],
          },
        },
      },
      {
        label: "error finding with an extra member (12.7: exactly the five)",
        doc: {
          error: {
            code: null,
            message: "unknown flag",
            locations: [],
            path: null,
            identities: [],
            hint: "try --help",
          },
        },
      },
    ],
  },
  {
    // The scoped inventory decode (SPEC 11.6, 12.7): exactly the `recorded`
    // member as a three-state datum — a plain list of path values, `null`,
    // or the unavailability marker (14.23) — with every other member unread
    // (the full inventory form is T11.6-*'s subject). Which states a
    // conforming inventory may report is the caller's value assertion; the
    // decoder's job is that no state ever collapses into a defaulted or
    // fabricated value (S-5).
    name: "11.6 inventory (recorded datum)",
    decode: decodeInventoryRecordedDatum,
    good: {
      findings: [],
      recorded: ["specs/A.md", "specs/A.xspec.ts"],
      graphData: ".xspec",
    },
    verify: (decoded: ReturnType<typeof decodeInventoryRecordedDatum>) => {
      expect(decoded).toEqual({
        state: "value",
        value: ["specs/A.md", "specs/A.xspec.ts"],
      });
    },
    alsoGood: [
      {
        label:
          "explicit unavailability (14.23) decodes as the marker state — " +
          "never as an empty or fabricated record",
        doc: { recorded: { unavailable: true } },
        verify: (
          decoded: ReturnType<typeof decodeInventoryRecordedDatum>,
        ): void => {
          expect(decoded).toEqual({ state: "unavailable" });
        },
      },
      {
        label:
          "an empty recorded list stays [] (empty before any generation, " +
          "SPEC 11.6; [] is never null, 12.7)",
        doc: { recorded: [] },
        verify: (
          decoded: ReturnType<typeof decodeInventoryRecordedDatum>,
        ): void => {
          expect(decoded).toEqual({ state: "value", value: [] });
        },
      },
      {
        label: "a non-UTF-8 recorded path arrives in the marked byte form",
        doc: { recorded: [{ bytes: "ff2e6d64" }] },
        verify: (
          decoded: ReturnType<typeof decodeInventoryRecordedDatum>,
        ): void => {
          expect(decoded).toEqual({
            state: "value",
            value: [{ bytes: "ff2e6d64" }],
          });
        },
      },
    ],
    bad: [
      {
        label: "absent recorded member (null is never omission, SPEC 12.7)",
        doc: { findings: [], graphData: ".xspec" },
      },
      {
        label: "a non-marker object carrying `unavailable` (SPEC 12.7)",
        doc: { recorded: { unavailable: false } },
      },
      {
        label: "the marker with an extra member (SPEC 12.7: exactly one)",
        doc: { recorded: { unavailable: true, paths: [] } },
      },
      {
        label: "a non-array plain value",
        doc: { recorded: "specs/A.xspec.ts" },
      },
      {
        label: "a non-path element",
        doc: { recorded: [42] },
      },
      {
        label: "a valid-UTF-8 path in the byte form (SPEC 12.7 forbids it)",
        doc: { recorded: [{ bytes: "612e6d64" }] },
      },
    ],
  },
  {
    // The scoped inventory findings decode (SPEC 11.6, 12.7): exactly the
    // pinned `findings` member — the literal finding form in the pinned
    // findings order — with every other member unread (the full inventory
    // form is T11.6-*'s subject; T14-4's 14.23 row reads the condition-23
    // finding through this decode).
    name: "11.6 inventory (findings)",
    decode: decodeInventoryFindings,
    good: {
      findings: [
        {
          code: "unreadable-record",
          message: "recorded generation state cannot be read as a record",
          locations: [],
          path: ".xspec",
          identities: [],
        },
      ],
      recorded: { unavailable: true },
      graphData: ".xspec",
    },
    verify: (decoded: ReturnType<typeof decodeInventoryFindings>) => {
      expect(decoded).toHaveLength(1);
      expect(decoded[0]!.code).toBe("unreadable-record");
      expect(decoded[0]!.condition).toBe("14.23");
      expect(decoded[0]!.path).toBe(".xspec");
    },
    alsoGood: [
      {
        label:
          "a finding-free inventory answer carries findings [] — the empty " +
          "array, never null (SPEC 12.7)",
        doc: { findings: [], recorded: [] },
        verify: (decoded: ReturnType<typeof decodeInventoryFindings>): void => {
          expect(decoded).toEqual([]);
        },
      },
    ],
    bad: [
      {
        label:
          "absent findings member (SPEC 12.7: wherever a document carries " +
          'findings they form the array member "findings")',
        doc: { recorded: [], graphData: ".xspec" },
      },
      {
        label:
          "null findings (SPEC 12.7: a list-valued member with no elements " +
          "is the empty array, never null)",
        doc: { findings: null, recorded: [] },
      },
      {
        label:
          "an old-shape finding element (condition/file members instead of " +
          "the literal 12.7 finding form)",
        doc: {
          findings: [
            { condition: "14.23", file: ".xspec", message: "corrupt" },
          ],
          recorded: { unavailable: true },
        },
      },
    ],
  },
  {
    // The scoped inventory anchoring decode (SPEC 11.6, 12.7): exactly the
    // `root` and `config` members, each a 12.7 path value, with every other
    // member unread (the full inventory form is T11.6-*'s subject; T11.6-1
    // pins the canonical relative spellings byte-exactly as its value
    // assertions — the decoder's job is that neither member is ever absent
    // or mis-formed).
    name: "11.6 inventory (anchoring)",
    decode: decodeInventoryAnchoring,
    good: {
      findings: [],
      root: ".",
      config: "xspec.config.ts",
      graphData: ".xspec",
    },
    verify: (decoded: ReturnType<typeof decodeInventoryAnchoring>) => {
      expect(decoded).toEqual({ root: ".", config: "xspec.config.ts" });
    },
    alsoGood: [
      {
        label:
          "ascent-then-descent relative spellings decode as plain path " +
          "strings (SPEC 11.6)",
        doc: { root: "../../work", config: "../../work/xspec.config.ts" },
        verify: (
          decoded: ReturnType<typeof decodeInventoryAnchoring>,
        ): void => {
          expect(decoded).toEqual({
            root: "../../work",
            config: "../../work/xspec.config.ts",
          });
        },
      },
    ],
    bad: [
      {
        label:
          "absent root member (12.7: each object carries exactly the " +
          "members its form names — null is never omission)",
        doc: { findings: [], config: "xspec.config.ts" },
      },
      {
        label: "absent config member",
        doc: { findings: [], root: "." },
      },
      {
        label: "null root (a path value is a string or the byte form)",
        doc: { root: null, config: "xspec.config.ts" },
      },
      {
        label: "a non-path root",
        doc: { root: 42, config: "xspec.config.ts" },
      },
      {
        label:
          "a valid-UTF-8 anchoring path in the marked byte form (SPEC 12.7 " +
          "forbids the byte form for a valid-UTF-8 path)",
        doc: { root: { bytes: "2e" }, config: "xspec.config.ts" },
      },
    ],
  },
  {
    name: "coverage",
    decode: decodeCoverageReport,
    good: GOOD_COVERAGE,
    verify: (decoded: ReturnType<typeof decodeCoverageReport>) => {
      const profile = decoded.profiles[0];
      expect(profile.name).toBe("core");
      expect(profile.counts).toEqual({
        required: 3,
        covered: 1,
        uncovered: 1,
        ignored: 1,
      });
      expect(profile.covered[0].path).toEqual([
        "specs/A.mdx#login",
        "specs/B.mdx#account",
      ]);
      expect(profile.uncovered).toEqual(["specs/B.mdx#account.close"]);
      expect(profile.ignored[0].reasons).toEqual(["root node"]);
    },
    alsoGood: [
      {
        label: "zero profiles (T7-3: an empty report is valid)",
        doc: { profiles: [] },
        verify: (decoded: ReturnType<typeof decodeCoverageReport>) => {
          expect(decoded.profiles).toEqual([]);
        },
      },
    ],
    bad: [
      { label: "missing profiles list", doc: {} },
      {
        label: "profile missing name",
        doc: omit(GOOD_COVERAGE, "profiles", 0, "name"),
      },
      {
        label: "profile missing counts",
        doc: omit(GOOD_COVERAGE, "profiles", 0, "counts"),
      },
      {
        label: "counts missing uncovered",
        doc: omit(GOOD_COVERAGE, "profiles", 0, "counts", "uncovered"),
      },
      {
        label: "negative count",
        doc: put(GOOD_COVERAGE, -1, "profiles", 0, "counts", "covered"),
      },
      {
        label: "stringly-typed count",
        doc: put(GOOD_COVERAGE, "1", "profiles", 0, "counts", "covered"),
      },
      {
        label: "covered node missing its path",
        doc: omit(GOOD_COVERAGE, "profiles", 0, "covered", 0, "path"),
      },
      {
        label: "empty covering path",
        doc: put(GOOD_COVERAGE, [], "profiles", 0, "covered", 0, "path"),
      },
      {
        label: "ignored node missing reasons",
        doc: omit(GOOD_COVERAGE, "profiles", 0, "ignored", 0, "reasons"),
      },
      {
        label: "ignored node with zero reasons",
        doc: put(GOOD_COVERAGE, [], "profiles", 0, "ignored", 0, "reasons"),
      },
      {
        label: "uncovered entry not a string",
        doc: put(GOOD_COVERAGE, [3], "profiles", 0, "uncovered"),
      },
    ],
  },
  {
    name: "impact",
    decode: decodeImpactReport,
    good: GOOD_IMPACT,
    verify: (decoded: ReturnType<typeof decodeImpactReport>) => {
      expect(decoded.baseline).toBe("a1b2c3d");
      expect(decoded.requirements[0].categories[0].category).toBe("changed");
      expect(decoded.requirements[1].nodes).toEqual([
        "specs/A.mdx",
        "specs/A.mdx#login",
      ]);
      expect(decoded.requirements[1].deleted).toBe(true);
      expect(decoded.code.direct[0].edge).toEqual(EDGE_IN);
      expect(decoded.code.transitive).toEqual([]);
    },
    alsoGood: [
      {
        label: "no baseline echo",
        doc: omit(GOOD_IMPACT, "baseline"),
        verify: (decoded: ReturnType<typeof decodeImpactReport>) => {
          expect(decoded.baseline).toBeUndefined();
        },
      },
    ],
    bad: [
      { label: "missing requirements", doc: omit(GOOD_IMPACT, "requirements") },
      { label: "missing code groups", doc: omit(GOOD_IMPACT, "code") },
      {
        label: "code missing direct group",
        doc: omit(GOOD_IMPACT, "code", "direct"),
      },
      {
        label: "entry with zero nodes",
        doc: put(GOOD_IMPACT, [], "requirements", 0, "nodes"),
      },
      {
        label: "entry missing deleted flag",
        doc: omit(GOOD_IMPACT, "requirements", 0, "deleted"),
      },
      {
        label: "stringly-typed deleted flag",
        doc: put(GOOD_IMPACT, "no", "requirements", 0, "deleted"),
      },
      {
        label: "unknown category",
        doc: put(
          GOOD_IMPACT,
          "renamed",
          "requirements",
          0,
          "categories",
          0,
          "category",
        ),
      },
      {
        label: "category missing attribution",
        doc: omit(
          GOOD_IMPACT,
          "requirements",
          1,
          "categories",
          0,
          "attributedTo",
        ),
      },
      {
        label: "code entry missing edge",
        doc: omit(GOOD_IMPACT, "code", "direct", 0, "edge"),
      },
      {
        label: "code entry with empty path",
        doc: put(GOOD_IMPACT, [], "code", "direct", 0, "path"),
      },
      {
        label: "wrong-typed baseline (must reject, not default)",
        doc: put(GOOD_IMPACT, 7, "baseline"),
      },
    ],
  },
  {
    name: "applied mapping (rename/move success report)",
    decode: decodeAppliedMappingReport,
    good: GOOD_APPLIED_MAPPING,
    verify: (decoded: ReturnType<typeof decodeAppliedMappingReport>) => {
      expect(decoded).toEqual([
        { from: "specs/A.mdx#login", to: "specs/A.mdx#signin" },
        { from: "specs/A.mdx#login.form", to: "specs/A.mdx#signin.form" },
      ]);
    },
    bad: [
      {
        label:
          "mapping absent (a findings-only shape reports no applied mapping)",
        doc: omit(GOOD_APPLIED_MAPPING, "mapping"),
      },
      {
        label: "null mapping (required information, never defaulted)",
        doc: put(GOOD_APPLIED_MAPPING, null, "mapping"),
      },
      {
        label: "mapping not an array",
        doc: put(
          GOOD_APPLIED_MAPPING,
          { "specs/A.mdx#login": "specs/A.mdx#signin" },
          "mapping",
        ),
      },
      {
        label: "pair missing from",
        doc: omit(GOOD_APPLIED_MAPPING, "mapping", 0, "from"),
      },
      {
        label: "pair missing to",
        doc: omit(GOOD_APPLIED_MAPPING, "mapping", 1, "to"),
      },
      {
        label: "pair with empty identity",
        doc: put(GOOD_APPLIED_MAPPING, "", "mapping", 0, "to"),
      },
      {
        label: "pair not an object",
        doc: put(
          GOOD_APPLIED_MAPPING,
          "specs/A.mdx#login -> specs/A.mdx#signin",
          "mapping",
          1,
        ),
      },
    ],
  },
  {
    name: "review list",
    decode: decodeSessionListReport,
    good: GOOD_SESSION_LIST,
    verify: (decoded: ReturnType<typeof decodeSessionListReport>) => {
      expect(decoded.sessions).toHaveLength(2);
      const first = decoded.sessions[0];
      expect(first).toEqual({
        name: "B",
        corrupt: false,
        strategy: "audit",
        counts: { unresolved: 2, updated: 1 },
      });
      expect(decoded.sessions[1]).toEqual({ name: "a", corrupt: true });
    },
    bad: [
      { label: "missing sessions list", doc: {} },
      {
        label: "session missing name",
        doc: omit(GOOD_SESSION_LIST, "sessions", 0, "name"),
      },
      {
        label: "session missing corrupt flag",
        doc: omit(GOOD_SESSION_LIST, "sessions", 0, "corrupt"),
      },
      {
        label: "stringly-typed corrupt flag",
        doc: put(GOOD_SESSION_LIST, "no", "sessions", 0, "corrupt"),
      },
      {
        label: "healthy session missing strategy",
        doc: omit(GOOD_SESSION_LIST, "sessions", 0, "strategy"),
      },
      {
        label: "healthy session missing counts",
        doc: omit(GOOD_SESSION_LIST, "sessions", 0, "counts"),
      },
      {
        label: "negative count",
        doc: put(GOOD_SESSION_LIST, -2, "sessions", 0, "counts", "unresolved"),
      },
      {
        label: "corrupt session carrying fields (contradiction)",
        doc: put(GOOD_SESSION_LIST, "audit", "sessions", 1, "strategy"),
      },
    ],
  },
  {
    name: "review status",
    decode: decodeSessionStatusReport,
    good: GOOD_SESSION_STATUS,
    verify: (decoded: ReturnType<typeof decodeSessionStatusReport>) => {
      expect(decoded.items[0]).toEqual({
        id: "item-1",
        kind: "subtree-coherence",
        scope: "specs/A.mdx#login",
        status: "unresolved",
        blocked: false,
      });
      expect(decoded.totals).toEqual({ unresolved: 1 });
    },
    bad: [
      { label: "missing items list", doc: omit(GOOD_SESSION_STATUS, "items") },
      { label: "missing totals", doc: omit(GOOD_SESSION_STATUS, "totals") },
      {
        label: "row missing id",
        doc: omit(GOOD_SESSION_STATUS, "items", 0, "id"),
      },
      {
        label: "unknown item kind",
        doc: put(GOOD_SESSION_STATUS, "vibe-check", "items", 0, "kind"),
      },
      {
        label: "unknown status",
        doc: put(GOOD_SESSION_STATUS, "resolvedish", "items", 0, "status"),
      },
      {
        label: "row missing blocked state",
        doc: omit(GOOD_SESSION_STATUS, "items", 0, "blocked"),
      },
      {
        label: "stringly-typed total",
        doc: put(GOOD_SESSION_STATUS, "1", "totals", "unresolved"),
      },
    ],
  },
  {
    name: "review show (full item)",
    decode: decodeItemReport,
    good: GOOD_ITEM,
    verify: (decoded: ReturnType<typeof decodeItemReport>) => {
      expect(decoded.id).toBe("item-1");
      expect(decoded.kind).toBe("parent-consistency");
      expect(decoded.status).toBe("invalidated");
      expect(decoded.blockedBy).toEqual(["item-0"]);
      expect(decoded.note).toBe("checked once");
      expect(decoded.scope.text).toBe("Login must work.\n");
      expect(decoded.context[1]).toEqual({
        node: "specs/A.mdx#login.badCredentials",
        present: false,
      });
      expect(decoded.origin[0].before).toEqual({
        present: true,
        text: "old text\n",
      });
      expect(decoded.origin[0].after).toEqual({ present: false });
      expect(decoded.baseline).toEqual({
        recorded: ["opaque", "product-shaped"],
      });
      expect(decoded.current).toBeNull();
    },
    alsoGood: [
      {
        label: "no note (never resolved with one)",
        doc: omit(GOOD_ITEM, "note"),
        verify: (decoded: ReturnType<typeof decodeItemReport>) => {
          expect(decoded.note).toBeUndefined();
        },
      },
      {
        label: "code-impact scope: identity and presence alone (T10.7-12)",
        doc: put(
          put(
            omit(omit(GOOD_ITEM, "scope", "text"), "scope", "sourceRange"),
            "code-impact",
            "kind",
          ),
          "src/login.ts#handler",
          "scope",
          "node",
        ),
        verify: (decoded: ReturnType<typeof decodeItemReport>) => {
          expect(decoded.scope).toEqual({
            node: "src/login.ts#handler",
            present: true,
          });
        },
      },
      {
        label:
          "absent context node carrying recorded text (SPEC 10.7 provenance, T10.2-3)",
        doc: put(GOOD_ITEM, "recorded branch text\n", "context", 1, "text"),
        verify: (decoded: ReturnType<typeof decodeItemReport>) => {
          expect(decoded.context[1]).toEqual({
            node: "specs/A.mdx#login.badCredentials",
            present: false,
            text: "recorded branch text\n",
          });
        },
      },
      {
        label:
          "currently-present origin node carrying its source range (SPEC 10.7, 1.7; T10.7-7)",
        doc: put(
          put(
            GOOD_ITEM,
            { present: true, text: "new text\n" },
            "origin",
            0,
            "after",
          ),
          { start: 40, end: 90 },
          "origin",
          0,
          "sourceRange",
        ),
        verify: (decoded: ReturnType<typeof decodeItemReport>) => {
          expect(decoded.origin[0].after).toEqual({
            present: true,
            text: "new text\n",
          });
          expect(decoded.origin[0].sourceRange).toEqual({
            start: 40,
            end: 90,
          });
        },
      },
    ],
    bad: [
      { label: "missing id", doc: omit(GOOD_ITEM, "id") },
      { label: "missing kind", doc: omit(GOOD_ITEM, "kind") },
      { label: "unknown kind", doc: put(GOOD_ITEM, "vibe-check", "kind") },
      { label: "missing status", doc: omit(GOOD_ITEM, "status") },
      { label: "unknown status", doc: put(GOOD_ITEM, "done", "status") },
      { label: "missing blocked state", doc: omit(GOOD_ITEM, "blocked") },
      { label: "missing blockedBy", doc: omit(GOOD_ITEM, "blockedBy") },
      {
        label: "blockedBy with empty id",
        doc: put(GOOD_ITEM, [""], "blockedBy"),
      },
      { label: "missing reason", doc: omit(GOOD_ITEM, "reason") },
      { label: "missing scope", doc: omit(GOOD_ITEM, "scope") },
      {
        label: "scope missing presence",
        doc: omit(GOOD_ITEM, "scope", "present"),
      },
      {
        label: "absent context node carrying a source range (contradiction)",
        doc: put(GOOD_ITEM, { start: 3, end: 9 }, "context", 1, "sourceRange"),
      },
      { label: "missing context", doc: omit(GOOD_ITEM, "context") },
      { label: "missing origin", doc: omit(GOOD_ITEM, "origin") },
      {
        label: "origin side present without text",
        doc: omit(GOOD_ITEM, "origin", 0, "before", "text"),
      },
      {
        label: "origin absent side carrying text (contradiction)",
        doc: put(GOOD_ITEM, "ghost", "origin", 0, "after", "text"),
      },
      {
        label:
          "currently-absent origin node carrying a source range (contradiction)",
        doc: put(GOOD_ITEM, { start: 3, end: 9 }, "origin", 0, "sourceRange"),
      },
      { label: "missing baseline record", doc: omit(GOOD_ITEM, "baseline") },
      { label: "missing current record", doc: omit(GOOD_ITEM, "current") },
      {
        label: "wrong-typed note (must reject, not default)",
        doc: put(GOOD_ITEM, 42, "note"),
      },
    ],
  },
  {
    name: "review next",
    decode: decodeNextReport,
    good: GOOD_NEXT,
    verify: (decoded: ReturnType<typeof decodeNextReport>) => {
      expect(decoded.fullyResolved).toBe(false);
      expect(decoded.item?.id).toBe("item-1");
    },
    alsoGood: [
      {
        label: "fully resolved: no item in the payload (T10.7-7)",
        doc: GOOD_NEXT_RESOLVED,
        verify: (decoded: ReturnType<typeof decodeNextReport>) => {
          expect(decoded.fullyResolved).toBe(true);
          expect(decoded.item).toBeUndefined();
        },
      },
    ],
    bad: [
      { label: "missing fullyResolved flag", doc: { item: GOOD_ITEM } },
      {
        label: "not fully resolved yet no item",
        doc: { fullyResolved: false },
      },
      {
        label: "fully resolved yet carrying an item (contradiction)",
        doc: { fullyResolved: true, item: GOOD_ITEM },
      },
      { label: "item missing its id", doc: omit(GOOD_NEXT, "item", "id") },
    ],
  },
  {
    name: "review export",
    decode: decodeExportReport,
    good: GOOD_EXPORT,
    verify: (decoded: ReturnType<typeof decodeExportReport>) => {
      expect(decoded.name).toBe("review-1");
      expect(decoded.strategy).toBe("audit");
      expect(decoded.creationParameters).toBeNull();
      expect(decoded.decompositions).toEqual([]);
      expect(decoded.items).toHaveLength(1);
      expect(decoded.items[0].id).toBe("item-1");
    },
    bad: [
      { label: "missing name", doc: omit(GOOD_EXPORT, "name") },
      { label: "missing strategy", doc: omit(GOOD_EXPORT, "strategy") },
      {
        label: "missing creationParameters member",
        doc: omit(GOOD_EXPORT, "creationParameters"),
      },
      {
        label: "missing decompositions member",
        doc: omit(GOOD_EXPORT, "decompositions"),
      },
      { label: "missing items", doc: omit(GOOD_EXPORT, "items") },
      {
        label: "item missing status",
        doc: omit(GOOD_EXPORT, "items", 0, "status"),
      },
    ],
  },
];

for (const spec of DECODERS) {
  test(`S-5: ${spec.name} adapter decodes well-shaped documents to the asserted information`, () => {
    spec.verify(spec.decode(spec.good) as never);
    for (const variant of spec.alsoGood ?? []) {
      const decoded = spec.decode(variant.doc);
      variant.verify?.(decoded as never);
    }
  });

  test(`S-5: ${spec.name} adapter rejects wrong-shape documents rather than defaulting`, () => {
    for (const bad of [...GENERIC_BAD, ...spec.bad]) {
      const failure = expectDiagnosed(`${spec.name}: ${bad.label}`, () =>
        spec.decode(bad.doc),
      );
      // Every rejection names the adapter and is a test error, not a default.
      expect(failure.message).toContain("adapter");
    }
  });
}

test("S-5: decoder context labels surface in diagnoses (two-document compares stay tellable-apart)", () => {
  const failure = expectDiagnosed("labelled decode", () =>
    decodeNodeReport(null, "second run"),
  );
  expect(failure.message).toContain("second run");
});

// --- the pinned 12.7 findings-order comparator ---------------------------------

/** A decoded finding literal for comparator vectors (condition is derived
 * information the comparator never reads). */
function findingWith(over: Partial<Finding>): Finding {
  return {
    code: null,
    condition: null,
    message: "m",
    locations: [],
    path: null,
    identities: [],
    ...over,
  };
}

test("S-5: the findings comparator orders codes numerically, refusals in 14's order, code-less last", () => {
  const c14_2 = findingWith({ code: "invalid-structural-id" });
  const c14_10 = findingWith({ code: "stale-output" });
  // Numeric condition order, not lexicographic: 14.2 before 14.10 even
  // though "14.10" < "14.2" as strings.
  expect(compareFindings(c14_2, c14_10)).toBeLessThan(0);
  // Refusal reasons sort after every numbered condition, in 14's own order.
  const refusalFirst = findingWith({ code: "refused-invalid-id" });
  const refusalLater = findingWith({ code: "refused-cycle" });
  expect(
    compareFindings(findingWith({ code: "unreadable-record" }), refusalFirst),
  ).toBeLessThan(0);
  expect(compareFindings(refusalFirst, refusalLater)).toBeLessThan(0);
  // Code-less findings sort last.
  expect(
    compareFindings(refusalLater, findingWith({ code: null })),
  ).toBeLessThan(0);
});

test("S-5: the findings comparator compares locations, paths, and identities byte-wise with the prefix rule", () => {
  const locA = { file: "specs/A.mdx", range: { start: 10, end: 30 } };
  const locB = { file: "specs/B.mdx", range: { start: 5, end: 25 } };
  // Element-wise location order, proper prefix first.
  expect(
    compareFindings(
      findingWith({ locations: [locA] }),
      findingWith({ locations: [locA, locB] }),
    ),
  ).toBeLessThan(0);
  expect(
    compareFindings(
      findingWith({ locations: [locA] }),
      findingWith({ locations: [locB] }),
    ),
  ).toBeLessThan(0);
  // A null concerned path sorts before any path.
  expect(
    compareFindings(findingWith({ path: null }), findingWith({ path: "a" })),
  ).toBeLessThan(0);
  // Paths compare byte-wise whatever their presentation form: the marked
  // byte form 0xFF sorts after the string "a" (0x61) in one byte order.
  expect(
    compareFindings(
      findingWith({ path: "a" }),
      findingWith({ path: { bytes: "ff" } }),
    ),
  ).toBeLessThan(0);
  // Identities compare by UTF-8 bytes, not UTF-16 code units: U+FFFD
  // (EF BF BD) sorts before U+10000 (F0 90 80 80), while UTF-16 compares
  // them the other way around.
  expect(
    compareFindings(
      findingWith({ identities: ["�"] }),
      findingWith({ identities: ["\u{10000}"] }),
    ),
  ).toBeLessThan(0);
  expect("�" < "\u{10000}").toBe(false); // the UTF-16 trap being guarded
  // The message is the final tie-break; full equality is 0 (a duplicate).
  expect(
    compareFindings(
      findingWith({ message: "a" }),
      findingWith({ message: "b" }),
    ),
  ).toBeLessThan(0);
  expect(compareFindings(findingWith({}), findingWith({}))).toBe(0);
});

// --- the three-state datum decode (11.4, 12.7) ---------------------------------

test("S-5: the datum decode separates plain value, null, and the unavailability marker", () => {
  const site = rootSite("datum self-test");
  expect(decodeDatum(5, site, expectNonNegativeInteger)).toEqual({
    state: "value",
    value: 5,
  });
  expect(decodeDatum(null, site, expectNonNegativeInteger)).toEqual({
    state: "null",
  });
  // The marker never reaches the value decoder — a decoder that throws
  // proves the marker (and null) are recognized structurally, not defaulted.
  const neverCalled = (): never => {
    throw new Error("the value decoder must not run for null or the marker");
  };
  expect(decodeDatum({ unavailable: true }, site, neverCalled)).toEqual({
    state: "unavailable",
  });
  expect(decodeDatum(null, site, neverCalled)).toEqual({ state: "null" });
});

test("S-5: the datum decode rejects omission, malformed markers, and malformed plain values", () => {
  const site = rootSite("datum self-test");
  // An absent member is never a state: null is never omission (12.7).
  expectDiagnosed("omitted member", () =>
    decodeDatum(undefined, site, expectNonNegativeInteger),
  );
  // An object carrying "unavailable" must be exactly the marker.
  expectDiagnosed("unavailable: false", () =>
    decodeDatum({ unavailable: false }, site, expectNonNegativeInteger),
  );
  expectDiagnosed("marker with an extra member", () =>
    decodeDatum(
      { unavailable: true, reason: "x" },
      site,
      expectNonNegativeInteger,
    ),
  );
  expectDiagnosed('unavailable: "true" (not the boolean)', () =>
    decodeDatum({ unavailable: "true" }, site, expectNonNegativeInteger),
  );
  // A plain value still decodes through the value decoder, fail-loud.
  expectDiagnosed("plain value failing its decoder", () =>
    decodeDatum("five", site, expectNonNegativeInteger),
  );
});

// --- the unavailability-marker structural walk (T12.7-1) ------------------------

test("S-5: the marker walk accepts documents whose only unavailable-bearing objects are exact markers", () => {
  assertUnavailabilityMarkerForms(
    {
      findings: [],
      views: [
        {
          root: {
            identity: { unavailable: true },
            tags: null,
            children: [{ identity: "a", tags: ["x"] }],
          },
        },
      ],
      delta: { unavailable: true },
    },
    "clean document",
  );
  // The marker itself at top level is a legitimate document value.
  assertUnavailabilityMarkerForms({ unavailable: true }, "bare marker");
  // Scalars and arrays carry no objects to offend.
  assertUnavailabilityMarkerForms([1, "two", null], "scalar array");
});

test("S-5: the marker walk rejects near-markers anywhere in the tree, naming the path", () => {
  const wrongValue = expectDiagnosed("unavailable: false", () =>
    assertUnavailabilityMarkerForms(
      { resolution: { unavailable: false } },
      "wrong value",
    ),
  );
  expect(wrongValue.message).toContain("$.resolution");
  const extraMember = expectDiagnosed("marker with a sibling member", () =>
    assertUnavailabilityMarkerForms(
      { views: [{ source: { unavailable: true, identity: "a" } }] },
      "extra member",
    ),
  );
  expect(extraMember.message).toContain("$.views[0].source");
  expectDiagnosed("unavailable as an ordinary member", () =>
    assertUnavailabilityMarkerForms(
      { node: { unavailable: "soon", other: 1 } },
      "ordinary member",
    ),
  );
});

// --- the bare edge-endpoint walk (T1.7-1) ------------------------------------

test("S-5: the bare edge-endpoint walk accepts edge surfaces carrying identities alone", () => {
  assertBareEdgeEndpoints(GOOD_EDGES, "edges document");
  assertBareEdgeEndpoints(GOOD_REACHABLE, "reachable document");
  assertBareEdgeEndpoints({ reachable: false }, "unreachable document");
  // A node report's own sourceRange is contract (SPEC 11, T11-1): the walk
  // scoped to the edge lists tolerates it while guarding the lists.
  assertNodeEdgeListsBare(GOOD_NODE, "node report");
});

test("S-5: the bare edge-endpoint walk rejects range data beside endpoints, naming the path", () => {
  const rowRange = expectDiagnosed("edge row carrying a range member", () =>
    assertBareEdgeEndpoints(
      put(GOOD_EDGES, { start: 0, end: 4 }, "edges", 0, "range"),
      "row range",
    ),
  );
  expect(rowRange.message).toContain("$.edges[0].range");
  const endpointObject = expectDiagnosed(
    "endpoint as an identity-plus-range object",
    () =>
      assertBareEdgeEndpoints(
        put(
          GOOD_EDGES,
          {
            identity: "src/login.ts#handler",
            sourceRange: { start: 0, end: 4 },
          },
          "edges",
          0,
          "from",
        ),
        "endpoint object",
      ),
  );
  expect(endpointObject.message).toContain("$.edges[0].from.sourceRange");
  const pathEntry = expectDiagnosed(
    "witness-path entry carrying start/end data",
    () =>
      assertBareEdgeEndpoints(
        put(
          GOOD_REACHABLE,
          { node: "specs/A.mdx#login", start: 0, end: 4 },
          "path",
          0,
        ),
        "path entry",
      ),
  );
  expect(pathEntry.message).toContain("$.path[0]");
  const nodeEdgeRange = expectDiagnosed("node edge list carrying a range", () =>
    assertNodeEdgeListsBare(
      put(GOOD_NODE, { start: 1, end: 2 }, "edges", "incoming", 0, "range"),
      "node edge range",
    ),
  );
  expect(nodeEdgeRange.message).toContain("$.edges.incoming[0].range");
  // The scoped walk still fails loudly when the edge lists are absent
  // entirely (S-5: reject, never default).
  expectDiagnosed("node report missing its edges member", () =>
    assertNodeEdgeListsBare(omit(GOOD_NODE, "edges"), "missing edges"),
  );
});

// --- human-report matcher ----------------------------------------------------

function syntheticResult(stdout: string, stderr = ""): RunResult {
  const stdoutBytes = Buffer.from(stdout, "utf8");
  const stderrBytes = Buffer.from(stderr, "utf8");
  return {
    exitCode: 1,
    signal: null,
    stdout,
    stderr,
    stdoutBytes,
    stderrBytes,
    commandLine: "`stand-in check` [synthetic result]",
  };
}

test("S-5: human-report matcher accepts a report carrying all required information", () => {
  const report =
    'error 14.2 in specs/A.mdx at 40..78: expected <S id="validCredentials"> nested inside login\n';
  assertReportMentions(
    report,
    ["specs/A.mdx", "validCredentials", conditionMention("14.2")],
    "well-formed report",
  );
  // RunResult form reads stdout (12.0: findings are stdout content).
  assertReportMentions(
    syntheticResult(report, "unrelated stderr noise"),
    ["specs/A.mdx"],
    "RunResult form",
  );
});

test("S-5: human-report matcher rejects reports missing required information", () => {
  const failure = expectDiagnosed("missing mention", () =>
    assertReportMentions(
      "something failed somewhere\n",
      ["specs/A.mdx", conditionMention("14.2")],
      "incomplete report",
    ),
  );
  expect(failure.message).toContain("specs/A.mdx");
  expect(failure.message).toContain("incomplete report");

  // Matching stderr content must not satisfy a stdout assertion.
  expectDiagnosed("mention only on stderr", () =>
    assertReportMentions(
      syntheticResult("ok\n", "specs/A.mdx\n"),
      ["specs/A.mdx"],
      "stderr is not the report stream",
    ),
  );

  // A mention-less assertion checks nothing and is itself a defect.
  expectDiagnosed("empty mention list", () =>
    assertReportMentions("anything", [], "empty assertion"),
  );
});

test("S-5: conditionMention distinguishes 14.2 from 14.20 in both directions", () => {
  expect(conditionMention("14.2").test("error 14.2: bad structure")).toBe(true);
  expect(conditionMention("14.2").test("ends with 14.2.")).toBe(true);
  expect(conditionMention("14.2").test("error 14.20: encoding")).toBe(false);
  expect(conditionMention("14.2").test("version 114.2")).toBe(false);
  expect(conditionMention("14.20").test("error 14.20: encoding")).toBe(true);
  expect(conditionMention("14.20").test("error 14.2: structure")).toBe(false);
  expectDiagnosed("not a condition identity", () => conditionMention("15.1"));
});

test("S-5: ignored-reason classifier maps SPEC 8.2 reason spellings in order and rejects the unrecognizable", () => {
  // SPEC.md 8.2's own phrasings classify, order-preserving (the fixed order
  // is the tests' value assertion, T8.2-1).
  expect(
    classifyIgnoredReasons(
      [
        "root node",
        'coverage="none"',
        'non-leaf under targets: "leaves"',
        "lacking every targetTags tag",
      ],
      "spec phrasings",
    ),
  ).toEqual(["root", "coverage-none", "non-leaf", "lacking-tags"]);

  // A reason matching no pattern is unrecognizable required information —
  // rejected loudly, never defaulted (H-3).
  const unknown = expectDiagnosed("unclassifiable reason", () =>
    classifyIgnoredReasons(["excluded"], "unknown token"),
  );
  expect(unknown.message).toContain("unknown token");

  // A reason matching more than one pattern is ambiguous — equally rejected.
  expectDiagnosed("ambiguous reason", () =>
    classifyIgnoredReasons(["root has none"], "ambiguous token"),
  );
});

// --- T10.1-4 session-corruption staging ---------------------------------------

const SESSION_REL = ".xspec/reviews/s.json";

/** A synthetic well-shaped stored session (per the layer's assumed shape). */
const WELL_SHAPED_SESSION = {
  creationParameters: { strategy: "audit" },
  decompositions: [{ kind: "subtree-coherence", scope: "specs/A.mdx#a" }],
  items: [
    {
      blockedBy: [],
      id: "i1",
      kind: "subtree-coherence",
      scope: "specs/A.mdx#a",
      status: "unresolved",
    },
    {
      blockedBy: ["i1"],
      id: "i2",
      kind: "subtree-coherence",
      scope: "specs/A.mdx",
      status: "updated",
    },
  ],
  name: "s",
};

async function sessionWorkspace(doc: unknown): Promise<{
  workspace: TestWorkspace;
  file: string;
  read: () => Promise<Record<string, unknown>>;
}> {
  const workspace = await TestWorkspace.create({
    files: { [SESSION_REL]: `${JSON.stringify(doc, null, 2)}\n` },
  });
  onTestFinished(() => workspace.dispose());
  const file = workspace.path(SESSION_REL);
  return {
    workspace,
    file,
    read: async () => {
      const bytes = await workspace.readBytes(SESSION_REL);
      return JSON.parse(Buffer.from(bytes).toString("utf8")) as Record<
        string,
        unknown
      >;
    },
  };
}

type SessionItems = Record<string, unknown>[];
const itemsOf = (doc: Record<string, unknown>): SessionItems =>
  doc["items"] as SessionItems;

test("S-5: staging duplicates an item entry (duplicate ids; distinct-id variant for same kind and scope)", async () => {
  const duplicated = await sessionWorkspace(WELL_SHAPED_SESSION);
  await stageDuplicateItemEntry(duplicated.file);
  const withDuplicate = itemsOf(await duplicated.read());
  expect(withDuplicate).toHaveLength(3);
  expect(withDuplicate[2]).toEqual(withDuplicate[0]); // same id, same fields

  const fresh = await sessionWorkspace(WELL_SHAPED_SESSION);
  await stageDuplicateItemEntry(fresh.file, { distinctId: true });
  const withFreshId = itemsOf(await fresh.read());
  expect(withFreshId).toHaveLength(3);
  expect(withFreshId[2]["id"]).not.toBe(withFreshId[0]["id"]);
  const ids = withFreshId.map((item) => item["id"]);
  expect(new Set(ids).size).toBe(ids.length); // no duplicate-id state staged
  expect({ ...withFreshId[2], id: withFreshId[0]["id"] }).toEqual(
    withFreshId[0],
  );
});

test("S-5: staging rewrites a status to an unknown value (value-blind)", async () => {
  const { file, read } = await sessionWorkspace(WELL_SHAPED_SESSION);
  await stageUnknownItemStatus(file);
  const items = itemsOf(await read());
  const status = items[0]["status"];
  expect(typeof status).toBe("string");
  expect(status).not.toBe("unresolved");
  expect(ITEM_STATUSES as readonly string[]).not.toContain(status);
  expect(items[1]["status"]).toBe("updated"); // only the staged item changed
});

test("S-5: staging redirects blockedBy into a cycle, using only ids the session bears", async () => {
  const twoItems = await sessionWorkspace(WELL_SHAPED_SESSION);
  await stageBlockedByCycle(twoItems.file);
  const items = itemsOf(await twoItems.read());
  expect(items[0]["blockedBy"]).toEqual(["i2"]);
  expect(items[1]["blockedBy"]).toEqual(["i1"]);

  const single = await sessionWorkspace({
    ...WELL_SHAPED_SESSION,
    items: [structuredClone(WELL_SHAPED_SESSION.items[0])],
  });
  await stageBlockedByCycle(single.file);
  const selfCycle = itemsOf(await single.read());
  expect(selfCycle[0]["blockedBy"]).toEqual(["i1"]);
});

test("S-5: staging redirects blockedBy at an id no item bears", async () => {
  const { file, read } = await sessionWorkspace(WELL_SHAPED_SESSION);
  await stageBlockedByAbsentItem(file);
  const items = itemsOf(await read());
  const blockedBy = items[0]["blockedBy"] as string[];
  expect(blockedBy).toHaveLength(1);
  const ids = items.map((item) => item["id"]);
  expect(ids).not.toContain(blockedBy[0]);
});

test("S-5: staging deletes a named item field", async () => {
  const { file, read } = await sessionWorkspace(WELL_SHAPED_SESSION);
  await stageDeleteItemField(file, "status");
  const items = itemsOf(await read());
  expect(Object.hasOwn(items[0], "status")).toBe(false);
  expect(items[0]["id"]).toBe("i1"); // the rest of the entry is intact
  expect(Object.hasOwn(items[1], "status")).toBe(true);
});

test("S-5: staging garbles recorded creation parameters by structural type flip", async () => {
  const objectRecorded = await sessionWorkspace(WELL_SHAPED_SESSION);
  await stageGarbleCreationParameters(objectRecorded.file);
  const flippedToScalar = await objectRecorded.read();
  expect(typeof flippedToScalar["creationParameters"]).toBe("string");

  const scalarRecorded = await sessionWorkspace({
    ...WELL_SHAPED_SESSION,
    creationParameters: "abc123",
  });
  await stageGarbleCreationParameters(scalarRecorded.file);
  const flippedToObject = await scalarRecorded.read();
  expect(typeof flippedToObject["creationParameters"]).toBe("object");
  expect(flippedToObject["creationParameters"]).not.toBeNull();
});

test("S-5: staging garbles recorded decompositions by structural type flip", async () => {
  // The natural recorded form is an array (`typeof [] === "object"`), so the
  // flip lands on a scalar; the rest of the session is untouched.
  const arrayRecorded = await sessionWorkspace(WELL_SHAPED_SESSION);
  await stageGarbleDecompositions(arrayRecorded.file);
  const flippedToScalar = await arrayRecorded.read();
  expect(typeof flippedToScalar["decompositions"]).toBe("string");
  expect(flippedToScalar["creationParameters"]).toEqual(
    WELL_SHAPED_SESSION.creationParameters,
  );
  expect(itemsOf(flippedToScalar)).toEqual(WELL_SHAPED_SESSION.items);

  const scalarRecorded = await sessionWorkspace({
    ...WELL_SHAPED_SESSION,
    decompositions: "abc123",
  });
  await stageGarbleDecompositions(scalarRecorded.file);
  const flippedToObject = await scalarRecorded.read();
  expect(typeof flippedToObject["decompositions"]).toBe("object");
  expect(flippedToObject["decompositions"]).not.toBeNull();
});

test("S-5: every staged corruption leaves the file one well-formed JSON document", async () => {
  // Unparseable bytes are a separate, shape-independent corrupt state staged
  // directly by tests — these transformations must each inject exactly their
  // one corruption, so the staged file stays parseable (checked by `read`).
  for (const stage of [
    stageDuplicateItemEntry,
    stageUnknownItemStatus,
    stageBlockedByCycle,
    stageBlockedByAbsentItem,
    (file: string) => stageDeleteItemField(file, "kind"),
    stageGarbleCreationParameters,
    stageGarbleDecompositions,
  ]) {
    const { file, read } = await sessionWorkspace(WELL_SHAPED_SESSION);
    await stage(file);
    await read(); // throws if the staged file is not one JSON document
  }
});

interface StagingRejection {
  readonly label: string;
  /** Raw file contents; undefined = no file at the path. */
  readonly contents: string | Uint8Array | undefined;
  readonly stage: (file: string) => Promise<void>;
}

const STAGING_REJECTIONS: readonly StagingRejection[] = [
  {
    label: "no session file at the path (the product never wrote one)",
    contents: undefined,
    stage: stageDuplicateItemEntry,
  },
  {
    label: "invalid UTF-8 bytes",
    contents: Uint8Array.from([0x7b, 0xff, 0xfe, 0x7d]),
    stage: stageUnknownItemStatus,
  },
  {
    label: "unparseable JSON",
    contents: '{"items": [',
    stage: stageBlockedByCycle,
  },
  {
    label: "top-level array instead of an object",
    contents: "[]",
    stage: stageDuplicateItemEntry,
  },
  {
    label: "no items member",
    contents: '{"name": "s"}',
    stage: stageUnknownItemStatus,
  },
  {
    label: "items not an array",
    contents: '{"items": {}}',
    stage: stageBlockedByAbsentItem,
  },
  {
    label: "zero items where the transformation needs one",
    contents: '{"items": []}',
    stage: stageDuplicateItemEntry,
  },
  {
    label: "item entry not an object",
    contents: '{"items": [7]}',
    stage: stageDuplicateItemEntry,
  },
  {
    label: "item without a string id",
    contents: '{"items": [{"status": "unresolved", "blockedBy": []}]}',
    stage: stageDuplicateItemEntry,
  },
  {
    label: "item without a status member",
    contents: '{"items": [{"id": "i1", "blockedBy": []}]}',
    stage: stageUnknownItemStatus,
  },
  {
    label: "item without a blockedBy member",
    contents: '{"items": [{"id": "i1", "status": "unresolved"}]}',
    stage: stageBlockedByCycle,
  },
  {
    label: "blockedBy not an array",
    contents:
      '{"items": [{"id": "i1", "status": "unresolved", "blockedBy": "i2"}]}',
    stage: stageBlockedByAbsentItem,
  },
  {
    label: "deleting a field the entry does not carry",
    contents:
      '{"items": [{"id": "i1", "status": "unresolved", "blockedBy": []}]}',
    stage: (file) => stageDeleteItemField(file, "note"),
  },
  {
    label: "no creationParameters member to garble",
    contents: '{"items": []}',
    stage: stageGarbleCreationParameters,
  },
  {
    label: "no decompositions member to garble",
    contents: '{"items": []}',
    stage: stageGarbleDecompositions,
  },
];

test("S-5: staging fails loudly on shape mismatch and leaves the file untouched", async () => {
  for (const rejection of STAGING_REJECTIONS) {
    const workspace = await TestWorkspace.create(
      rejection.contents === undefined
        ? { dirs: [".xspec/reviews"] }
        : { files: { [SESSION_REL]: rejection.contents } },
    );
    onTestFinished(() => workspace.dispose());
    const file = workspace.path(SESSION_REL);
    const failure = await expectDiagnosedAsync(rejection.label, () =>
      rejection.stage(file),
    );
    expect(failure.message).toContain("session-corruption staging");
    if (rejection.contents !== undefined) {
      const after = await workspace.readBytes(SESSION_REL);
      const before =
        typeof rejection.contents === "string"
          ? Buffer.from(rejection.contents, "utf8")
          : Buffer.from(rejection.contents);
      expect(Buffer.compare(Buffer.from(after), before)).toBe(0);
    }
  }
});

// --- T6.6-6 corrupt-record staging (record-staging.ts) ------------------------
// Shape-blind by design (graph-data content is opaque, H-4): the staging's
// only shape knowledge is T13.3-2's operational path set, so the guards
// cover the H-3 discipline — product-written files only, never fabricated,
// loud with nothing modified when there is nothing to corrupt.

test("S-5: corrupt-record staging garbles every graph-data file shape-blind, durables and structure untouched", async () => {
  const workspace = await TestWorkspace.create({
    files: {
      "xspec.config.ts": "// outside the area — untouched",
      ".xspec/journal": '{"op": 1}\n',
      ".xspec/reviews/s1.json": '{"items": []}\n',
      ".xspec/graph.json": '{"nodes": []}\n',
      ".xspec/cache/part-b.bin": "bb",
      ".xspec/cache/part-a.bin": "aa",
    },
  });
  onTestFinished(() => workspace.dispose());
  const corrupted = await corruptGraphDataShapeBlind(
    workspace.root,
    "S-5 record staging",
  );
  // Exactly the operational path set's plain files, byte-ordered — the
  // durable journal and reviews paths are no part of the record (T13.3-2).
  expect(corrupted).toEqual([
    ".xspec/cache/part-a.bin",
    ".xspec/cache/part-b.bin",
    ".xspec/graph.json",
  ]);
  for (const key of corrupted) {
    const bytes = await workspace.readBytes(key);
    expect(
      Buffer.compare(Buffer.from(bytes), Buffer.from(RECORD_GARBAGE_BYTES)),
    ).toBe(0);
    expect(isGraphDataKey(key)).toBe(true);
  }
  // The staged state is "exists but cannot be read as a record" (SPEC
  // 14.23): the files stay present while the garbage decodes as no UTF-8
  // text at all — so no structured read of any kind can succeed.
  expect(() =>
    new TextDecoder("utf-8", { fatal: true }).decode(RECORD_GARBAGE_BYTES),
  ).toThrow();
  // Durables and out-of-area files byte-untouched; directory structure
  // kept; no path created or removed.
  const utf8 = async (rel: string): Promise<string> =>
    Buffer.from(await workspace.readBytes(rel)).toString("utf8");
  expect(await utf8(".xspec/journal")).toBe('{"op": 1}\n');
  expect(await utf8(".xspec/reviews/s1.json")).toBe('{"items": []}\n');
  expect(await utf8("xspec.config.ts")).toBe("// outside the area — untouched");
  expect((await workspace.readdirNames(GRAPH_DATA_AREA_PATH)).sort()).toEqual([
    "cache",
    "graph.json",
    "journal",
    "reviews",
  ]);
  expect((await workspace.readdirNames(".xspec/cache")).sort()).toEqual([
    "part-a.bin",
    "part-b.bin",
  ]);
});

test("S-5: corrupt-record staging fails loudly with nothing product-written to corrupt", async () => {
  // No graph-data area at all: the product never wrote graph data here.
  const bare = await TestWorkspace.create({
    files: { "xspec.config.ts": "// no build ran" },
  });
  onTestFinished(() => bare.dispose());
  const missing = await expectDiagnosedAsync("no .xspec directory", () =>
    corruptGraphDataShapeBlind(bare.root, "no .xspec directory"),
  );
  expect(missing.message).toContain("corrupt-record staging");

  // The area holds only the durable paths: nothing in the operational set.
  const durablesOnly = await TestWorkspace.create({
    files: {
      ".xspec/journal": "j\n",
      ".xspec/reviews/s1.json": "{}",
    },
  });
  onTestFinished(() => durablesOnly.dispose());
  const durablesFailure = await expectDiagnosedAsync("durables only", () =>
    corruptGraphDataShapeBlind(durablesOnly.root, "durables only"),
  );
  expect(durablesFailure.message).toContain("no graph-data file");
  // Nothing modified: the durables keep their bytes.
  expect(
    Buffer.from(await durablesOnly.readBytes(".xspec/journal")).toString(
      "utf8",
    ),
  ).toBe("j\n");
  expect(
    Buffer.from(
      await durablesOnly.readBytes(".xspec/reviews/s1.json"),
    ).toString("utf8"),
  ).toBe("{}");

  // A directory alone is no record file either.
  const dirOnly = await TestWorkspace.create({ dirs: [".xspec/cache"] });
  onTestFinished(() => dirOnly.dispose());
  const dirFailure = await expectDiagnosedAsync("empty directory only", () =>
    corruptGraphDataShapeBlind(dirOnly.root, "empty directory only"),
  );
  expect(dirFailure.message).toContain("no graph-data file");
});

test("S-5: corrupt-record staging fails loudly on non-plain-file occupants, files untouched", async () => {
  // A symbolic link inside the operational set: not a product-written
  // record file (SPEC 13.4) — refuse, and touch nothing, the plain file
  // beside it included.
  const linked = await TestWorkspace.create({
    files: { ".xspec/graph.json": '{"nodes": []}' },
    symlinks: { ".xspec/link.json": "graph.json" },
  });
  onTestFinished(() => linked.dispose());
  const linkFailure = await expectDiagnosedAsync("symlink in the set", () =>
    corruptGraphDataShapeBlind(linked.root, "symlink in the set"),
  );
  expect(linkFailure.message).toContain("corrupt-record staging");
  expect(linkFailure.message).toContain(".xspec/link.json");
  expect(
    Buffer.from(await linked.readBytes(".xspec/graph.json")).toString("utf8"),
  ).toBe('{"nodes": []}');

  // The area itself occupied by a symlink: not the directory the product
  // writes — refuse, and write nothing through it.
  const areaLink = await TestWorkspace.create({
    files: { "real-area/graph.json": '{"nodes": []}' },
    symlinks: { ".xspec": "real-area" },
  });
  onTestFinished(() => areaLink.dispose());
  const areaFailure = await expectDiagnosedAsync(".xspec is a symlink", () =>
    corruptGraphDataShapeBlind(areaLink.root, ".xspec is a symlink"),
  );
  expect(areaFailure.message).toContain("not a real directory");
  expect(
    Buffer.from(await areaLink.readBytes("real-area/graph.json")).toString(
      "utf8",
    ),
  ).toBe('{"nodes": []}');
});

// --- T13.4-1 sorted-keys assertion --------------------------------------------

test("S-5: sorted-keys assertion accepts byte-sorted documents of any shape", () => {
  const sorted = [
    "{}",
    "[]",
    '"scalar"',
    "42",
    "null",
    '{"a": 1, "b": {"a": [{"x": 0, "y": {}}], "b": -1.5e3}, "c": true}',
    // Byte order, not numeric order: "1" (0x31) sorts before "9" (0x39), so
    // "10" precedes "9" — JavaScript objects would reorder these keys
    // numerically, which is exactly why the check scans the document text.
    '{"10": 0, "9": 1}',
    // Escaped spellings resolve before comparing: "a" is "a" < "b".
    '{"\\u0061": 0, "b": 1}',
    // UTF-8 byte order, not UTF-16 code-unit order: U+FFFD (EF BF BD) sorts
    // before U+10000 (F0 90 80 80), while UTF-16 compares them the other way
    // around (FFFD > D800 DC00).
    '{"\\ufffd": 0, "\\ud800\\udc00": 1}',
    ' \t\r\n {"a": 0} \n',
    '[{"a": 0, "b": 1}, {"a": 2}]',
  ];
  for (const doc of sorted) {
    assertJsonKeysByteSorted(doc, `sorted vector ${JSON.stringify(doc)}`);
  }
  // Byte input decodes as UTF-8 first.
  assertJsonKeysByteSorted(
    Buffer.from('{"a": 0, "é": 1}', "utf8"),
    "byte input",
  );
});

test("S-5: sorted-keys assertion rejects out-of-order keys wherever they nest", () => {
  const unsorted: readonly { label: string; doc: string }[] = [
    { label: "top-level swap", doc: '{"b": 0, "a": 1}' },
    { label: "nested object", doc: '{"a": {"z": 0, "b": 1}}' },
    { label: "object inside an array", doc: '[{"b": 0, "a": 1}]' },
    {
      label: "integer-like keys in numeric (not byte) order",
      doc: '{"9": 0, "10": 1}', // JSON.parse would report these sorted
    },
    {
      label: "escaped spelling hiding the real order",
      doc: '{"\\u0062": 0, "a": 1}', // raw "\\u0062" < "a", decoded "b" > "a"
    },
    {
      label: "UTF-16 order passed off as byte order",
      doc: '{"\\ud800\\udc00": 0, "\\ufffd": 1}',
    },
    { label: "duplicate key", doc: '{"a": 0, "a": 1}' },
  ];
  for (const { label, doc } of unsorted) {
    const failure = expectDiagnosed(label, () =>
      assertJsonKeysByteSorted(doc, label),
    );
    expect(failure.message).toContain(label);
    expect(failure.message).toContain("T13.4-1");
  }
  // The diagnosis names where the offense sits.
  const located = expectDiagnosed("path in diagnosis", () =>
    assertJsonKeysByteSorted('{"a": {"z": 0, "b": 1}}', "path check"),
  );
  expect(located.message).toContain("$.a");
});

test("S-5: sorted-keys assertion fails loudly on anything but one JSON document", () => {
  const malformed: readonly { label: string; doc: string | Uint8Array }[] = [
    { label: "empty input", doc: "" },
    { label: "whitespace only", doc: " \n\t" },
    { label: "truncated object", doc: '{"a": 0' },
    { label: "two concatenated documents", doc: '{"a": 0}{"b": 1}' },
    { label: "single-quoted key", doc: "{'a': 0}" },
    { label: "unquoted key", doc: "{a: 0}" },
    { label: "trailing comma", doc: '{"a": 0,}' },
    { label: "bad escape", doc: '{"a": "\\q"}' },
    { label: "bad \\u escape", doc: '{"a": "\\u00g0"}' },
    { label: "unescaped control character", doc: '{"a": "\u0001"}' },
    { label: "leading-zero number", doc: '{"a": 01}' },
    { label: "bare word", doc: "nope" },
    { label: "invalid UTF-8 bytes", doc: Uint8Array.from([0x22, 0xff, 0x22]) },
  ];
  for (const { label, doc } of malformed) {
    expectDiagnosed(label, () => assertJsonKeysByteSorted(doc, label));
  }
});
