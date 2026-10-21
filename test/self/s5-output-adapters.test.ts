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
// owns: the human-report required-information matchers (with the parity
// checks' token-bounded data, whole numbers matched after blanking,
// SPEC-named tokens, and stable codes, each rejecting an input it cannot
// form), the T10.1-4 session-corruption staging transformations
// (shape-aware, value-blind, failing loudly — file untouched — on shape
// mismatch), and the T13.4-1
// byte-sorted-keys assertion (which must judge the *written* key order, not
// JavaScript object key order, and byte order, not UTF-16 order).

import { Buffer } from "node:buffer";
import { expect, onTestFinished, test } from "vitest";
import {
  HarnessAssertionError,
  parseJsonStdout,
} from "../helpers/assertions.js";
import type { RunResult } from "../helpers/subprocess.js";
import type {
  ErrorInformation,
  Finding,
  ManualDeletionVerdict,
  Mention,
  PreviewReport,
  ViewReport,
} from "../helpers/adapters/index.js";
import {
  CONDITION_CODE_TOKENS,
  GRAPH_DATA_AREA_PATH,
  ITEM_STATUSES,
  RECORD_GARBAGE_BYTES,
  REFUSAL_CODE_TOKENS,
  SPEC_NAMED_TOKENS,
  STABLE_CODES,
  assertBareEdgeEndpoints,
  assertHumanErrorCarries,
  assertHumanErrorMessageCarries,
  assertHumanFindingsCarry,
  assertHumanFindingsReportCarries,
  assertHumanPerformedCarries,
  assertHumanPerformedReportCarries,
  assertHumanPreviewCarries,
  assertHumanPreviewReportCarries,
  assertJsonKeysByteSorted,
  assertNodeEdgeListsBare,
  assertReportMentions,
  assertReportOmits,
  assertUnavailabilityMarkerForms,
  blankReportData,
  classifyIgnoredReasons,
  codeMention,
  collectGraphDataEntries,
  collectGraphDataFiles,
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
  decodeHumanErrorMessage,
  decodeHumanFindingsReport,
  decodeHumanPerformedReport,
  decodeHumanPreviewReport,
  decodeIdsReport,
  decodeIdsTreeReport,
  decodeImpactReport,
  decodeInventoryAnchoring,
  decodeInventoryDocument,
  decodeInventoryFindings,
  decodeInventoryRecordedDatum,
  decodeInventoryResolvedMap,
  decodeItemReport,
  decodeNextReport,
  decodeNodeMetadataSummary,
  decodeNodeReport,
  decodeNodeIdentityRowsReport,
  decodeOccurrencesReport,
  decodeNodeRowsReport,
  decodeNodeSummary,
  decodeNodeSummaryRowsReport,
  decodeNodeTextAlgebraSummary,
  decodePerformedOperationReport,
  decodePreviewReport,
  decodeReachableReport,
  decodeRecordedState,
  decodeSessionListReport,
  decodeSessionStatusReport,
  decodeVersionDocument,
  decodeViewFilesReport,
  decodeViewReport,
  expectNonNegativeInteger,
  findingInformation,
  identityMention,
  isGraphDataKey,
  judgeManualDeletionCorrection,
  nameMention,
  numberMention,
  requireScopeNodes,
  rootSite,
  specTokenMention,
  spellingMention,
  stageBlockedByAbsentItem,
  stageBlockedByCycle,
  stageDeleteItemField,
  stageDeleteItemKind,
  stageDeleteItemStatus,
  stageDuplicateItemEntry,
  stageGarbleCreationParameters,
  stageGarbleDecompositions,
  stageReinsertItemEntry,
  stageUnknownItemStatus,
} from "../helpers/adapters/index.js";
import type { SnapshotEntry } from "../helpers/snapshot.js";
import {
  describeEntryDifference,
  snapshotDirectory,
  snapshotKeyBytes,
} from "../helpers/snapshot.js";
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

/** A `contains` edge from GOOD_NODE's section to a child (SPEC.md 5.2). */
const CONTAINS_DETAILS = {
  from: "specs/A.mdx#login",
  to: "specs/A.mdx#login.details",
  kind: "contains",
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

/**
 * GOOD_NODE recast as a file's root node (identity `specs/A.mdx`, no `#`,
 * SPEC 1.5), its tags and coverage attribute both absent (SPEC 11.1, 12.4,
 * 5.5) — here as omitted members; the vectors below also spell the tags
 * `null` and `[]`.
 */
const GOOD_ROOT_NODE = omit(
  omit(put(GOOD_NODE, "specs/A.mdx", "identity"), "coverage"),
  "tags",
);

const GOOD_ROWS = {
  nodes: [
    {
      identity: "specs/A.mdx#login",
      sourceRange: { start: 12, end: 96 },
      tags: ["auth"],
      coverage: "none",
    },
    // A root row: coverage attribute absent (T1.2-3, T11-3), tags spelled
    // `[]` — a present value, decoded as the tag set it is and passed to the
    // body unjudged (H-3); the vectors spell the root's absent tags `null` or
    // omitted (SPEC 11.1).
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
      code: "refused-id-collision", // refusal reasons sort after the numbered conditions
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

// The two findings T6.5-21's multi-reason arm reports, in SPEC 14's listed
// order (12.7, T12.7-2): `move specs/A.mdx "specs/a'b.mdx"` refused
// `refused-invalid-destination` (T6.5-4's barred character) then
// `refused-exposed-derived-file` (the origin's emit destination `specs/A.md`
// exposed to a `specs/*.md` glob) — each a reason concerning a path, carried
// as the finding's `path` with `locations` [] (SPEC 14), `identities` []
// as T6.5-21 states it.
const INVALID_DESTINATION_FINDING = {
  code: "refused-invalid-destination",
  message: "the destination path would not be a valid discovered spec source",
  locations: [],
  path: "specs/a'b.mdx",
  identities: [],
};
const EXPOSED_DERIVED_FILE_FINDING = {
  code: "refused-exposed-derived-file",
  message: "the origin's emit destination holds a file discovery would yield",
  locations: [],
  path: "specs/A.md",
  identities: [],
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

// A listing of a healthy and a corrupt session: the corrupt session's
// condition-21 finding in the listing's `findings` member, in the 12.7
// finding form — `path` the session file, `locations` [] (a session
// condition has no in-source location; SPEC 10.1, 14.21, 12.7).
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
  findings: [
    {
      code: "corrupt-session", // 14.21
      message: "review session a cannot be parsed",
      locations: [],
      path: ".xspec/reviews/a.json",
      identities: [],
    },
  ],
};

/** The healthy session alone — a listing with nothing to report. */
const CLEAN_SESSION_LIST = omit(
  omit(GOOD_SESSION_LIST, "findings"),
  "sessions",
  1,
);

/**
 * Two corrupt sessions, their condition-21 findings — equal in code and
 * locations — in the pinned 12.7 order: by concerned path bytes.
 */
const TWO_CORRUPT_SESSION_LIST = {
  sessions: [
    { name: "a", corrupt: true },
    { name: "c", corrupt: true },
  ],
  findings: [
    GOOD_SESSION_LIST.findings[0],
    {
      code: "corrupt-session", // 14.21
      message: "review session c is not a plain file",
      locations: [],
      path: ".xspec/reviews/c.json",
      identities: [],
    },
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

// A metadata-consistency item (SPEC 10.7; T10.7-13): its payload carries its
// scope node's metadata pair — `d` targets (any order: 10.7 fixes none), the
// coverage attribute, and the tags (12.7's value forms: "required"/"none",
// a tag set in byte order) before and after. The member layout is the
// adapter's assumed shape (review.ts).
const GOOD_METADATA_ITEM = {
  id: "item-7",
  kind: "metadata-consistency",
  status: "unresolved",
  blocked: false,
  blockedBy: [],
  reason: "the metadata of the scope node changed",
  scope: {
    node: "specs/A.mdx#m",
    present: true,
    text: "Em line.\n",
    sourceRange: { start: 0, end: 60 },
  },
  context: [
    { node: "specs/A.mdx#t1", present: true, text: "Tee one.\n" },
    { node: "specs/A.mdx#t3", present: true, text: "Tee three.\n" },
  ],
  origin: [
    {
      node: "specs/A.mdx#m",
      before: { present: true, text: "Em line.\n" },
      after: { present: true, text: "Em line.\n" },
      sourceRange: { start: 0, end: 60 },
    },
  ],
  metadata: {
    before: {
      present: true,
      d: ["specs/A.mdx#t2", "specs/A.mdx#t1"],
      coverage: "required",
      tags: ["a", "b"],
    },
    after: {
      present: true,
      d: ["specs/A.mdx#t2", "specs/A.mdx#t3"],
      coverage: "none",
      tags: ["b", "c"],
    },
  },
  baseline: { recorded: ["opaque"] },
  current: { recorded: ["opaque"] },
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

// An inventory document's configuration/sources/derived projection in the
// literal SPEC 12.7 member forms (11.6): the resolved view with every
// default and inferred kind explicit — `markdown` unset resolving to
// emit-false/outDir-null, `targetTags` the stated null, `boundaryKind` and
// selector kinds explicit — one `{"path","groups"}` per discovered file in
// byte order, one `{"source","module","markdown"}` per discovered spec
// source. The two selector forms beyond the group form and the derived-map
// nulls appear so the positive control spans the shape space T11.6-2
// asserts.
const GOOD_RESOLVED_INVENTORY = {
  findings: [],
  root: ".",
  config: "xspec.config.ts",
  configuration: {
    specs: [
      {
        name: "core",
        globs: ["specs/core/**/*.mdx", "specs/shared/**/*.mdx"],
      },
      { name: "aux", globs: ["specs/aux/**/*.mdx"] },
    ],
    code: [{ name: "impl", globs: ["src/**/*.ts"] }],
    markdown: { emit: false, outDir: null },
    coverage: [
      {
        name: "socle",
        target: "core",
        targetTags: null,
        targets: "leaves",
        boundary: "impl",
        boundaryKind: "code",
        mode: "direct",
        edgeKinds: ["depends", "embeds", "references"],
      },
    ],
    policy: [
      {
        name: "cloison",
        type: "forbidden",
        from: { group: "aux", kind: "spec" },
        to: { files: "specs/core/**" },
        kinds: ["depends"],
      },
    ],
  },
  sources: [
    { path: "specs/aux/b.mdx", groups: [{ name: "aux", kind: "spec" }] },
    { path: "specs/core/a.mdx", groups: [{ name: "core", kind: "spec" }] },
    { path: "src/app.ts", groups: [{ name: "impl", kind: "code" }] },
  ],
  derived: [
    {
      source: "specs/aux/b.mdx",
      module: "specs/aux/b.xspec.ts",
      markdown: null,
    },
    {
      source: "specs/core/a.mdx",
      module: "specs/core/a.xspec.ts",
      markdown: "specs/core/a.md",
    },
  ],
  recorded: [],
  graphData: ".xspec",
};

// The full eleven-member inventory document (SPEC 12.7; T11.6-3's frame):
// the resolved-map control plus a non-empty byte-ordered record, the journal
// status, session file paths in byte order of file name ("S.json" before
// "ancien.json": 0x53 < 0x61 — inverted by case folding), and the lock path
// (SPEC 11.6, 13.5).
const GOOD_INVENTORY_DOCUMENT = {
  ...GOOD_RESOLVED_INVENTORY,
  recorded: ["specs/core/a.md", "specs/core/a.xspec.ts"],
  journal: { path: ".xspec/journal", occupied: false },
  sessions: [".xspec/reviews/S.json", ".xspec/reviews/ancien.json"],
  lock: ".xspec/lock",
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

/** A decoded node record's identity and tags (the five node-tags decoders). */
interface DecodedNodeTags {
  readonly identity: string;
  readonly tags: readonly string[] | null;
}

/**
 * The root-node `alsoGood` vectors the five node-tags decoders share. SPEC
 * 11.1: "for a root node the tags and the coverage attribute are both
 * reported as absent (5.5)"; on these unpinned-shape surfaces (H-3) the
 * absent tags may be `null` or an omitted member, and both decode to `null`
 * — never to `[]`, a tagless section's value (12.7). A root's present `[]`
 * decodes to `[]`, passed to the body unjudged (value-blind, H-3).
 * `rootDoc(tags)` stages the document with the root's `tags` member set to
 * `tags`, or omitted when `tags` is `undefined`; `pick` selects the root's
 * decoded record.
 */
function rootTagsGood(
  rootDoc: (tags: unknown) => unknown,
  pick: (decoded: never) => DecodedNodeTags,
): NonNullable<DecoderSpec["alsoGood"]> {
  const cases: [string, unknown, readonly string[] | null][] = [
    [
      "root node: tags omitted — absent (SPEC 11.1) — decode to null",
      undefined,
      null,
    ],
    ["root node: tags null — absent (SPEC 11.1) — decode to null", null, null],
    [
      "root node: a present tags [] decodes to [], never read as absent (H-3)",
      [],
      [],
    ],
  ];
  return cases.map(([label, tags, want]) => ({
    label,
    doc: rootDoc(tags),
    verify: (decoded: never) => {
      const root = pick(decoded);
      expect(root.identity).toBe("specs/A.mdx");
      if (want === null) expect(root.tags).toBeNull();
      else expect(root.tags).toEqual(want);
    },
  }));
}

/**
 * The `bad` vectors the five node-tags decoders share: a section's tags are
 * required information (`[]` when tagless, SPEC 12.7), so a `null` member
 * fails loudly (an omitted one is each table's "missing tags" vector); and a
 * root whose `tags` member holds a value must hold a 12.7 tag set.
 * `sectionDoc(tags)` and `rootDoc(tags)` stage the section and the root
 * with their `tags` member set to `tags`.
 */
function nodeTagsBad(
  sectionDoc: (tags: unknown) => unknown,
  rootDoc: (tags: unknown) => unknown,
): BadCase[] {
  return [
    {
      label: "a section's tags null (required: [] when tagless, SPEC 12.7)",
      doc: sectionDoc(null),
    },
    {
      label: "a root's present tags out of byte order (a 12.7 tag set still)",
      doc: rootDoc(["v2", "auth"]),
    },
    {
      label: "a root's present tags holding a non-string element",
      doc: rootDoc([3]),
    },
    { label: "a root's present tags not an array", doc: rootDoc("auth") },
  ];
}

/** GOOD_ROOT_NODE with its `tags` member set, or omitted for `undefined`. */
const rootNodeWithTags = (tags: unknown): unknown =>
  tags === undefined ? GOOD_ROOT_NODE : put(GOOD_ROOT_NODE, tags, "tags");

/** GOOD_NODE (a section) with its `tags` member set. */
const sectionNodeWithTags = (tags: unknown): unknown =>
  put(GOOD_NODE, tags, "tags");

/** GOOD_ROWS with its root row's `tags` member set, or omitted. */
const rootRowWithTags = (tags: unknown): unknown =>
  tags === undefined
    ? omit(GOOD_ROWS, "nodes", 1, "tags")
    : put(GOOD_ROWS, tags, "nodes", 1, "tags");

/** GOOD_ROWS with its section row's `tags` member set. */
const sectionRowWithTags = (tags: unknown): unknown =>
  put(GOOD_ROWS, tags, "nodes", 0, "tags");

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
      {
        // The 12.7 tag set is byte-ordered, never case-folded (T11.4-3's
        // `tags="z A"` → ["A", "z"]): 0x5a sorts before 0x61.
        label: "a tag set in byte order across cases (SPEC 12.7, 12.0)",
        doc: put(GOOD_NODE, ["Zed", "auth"], "tags"),
        verify: (decoded: ReturnType<typeof decodeNodeReport>) => {
          expect(decoded.tags).toEqual(["Zed", "auth"]);
        },
      },
      ...rootTagsGood(
        rootNodeWithTags,
        (decoded: ReturnType<typeof decodeNodeReport>) => decoded,
      ),
      {
        label: "root node: tags and coverage attribute both absent (SPEC 12.4)",
        doc: GOOD_ROOT_NODE,
        verify: (decoded: ReturnType<typeof decodeNodeReport>) => {
          expect(decoded.tags).toBeNull();
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
      {
        label:
          "range carrying an extra member (12.7 value form: exactly start and end)",
        doc: put(GOOD_NODE, { start: 12, end: 96, from: 12 }, "sourceRange"),
      },
      {
        label: "range as an array [start, end] (never re-mapped, H-3)",
        doc: put(GOOD_NODE, [12, 96], "sourceRange"),
      },
      {
        label: 'range as {"from", "to"} (never re-mapped, H-3)',
        doc: put(GOOD_NODE, { from: 12, to: 96 }, "sourceRange"),
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
        label:
          "tags out of byte order (12.7 tag-set form: byte order, never " +
          "re-sorted by the harness, H-3)",
        doc: put(GOOD_NODE, ["v2", "auth"], "tags"),
      },
      {
        label: "a repeated tag (12.7 tag-set form: duplicates collapsed)",
        doc: put(GOOD_NODE, ["auth", "auth"], "tags"),
      },
      {
        label:
          "tags in case-folded order (12.7: byte order, never case-folded — " +
          "0x5a sorts before 0x61)",
        doc: put(GOOD_NODE, ["auth", "Zed"], "tags"),
      },
      {
        label: "wrong-typed coverage (must reject, not default to absent)",
        doc: put(GOOD_NODE, 42, "coverage"),
      },
      ...nodeTagsBad(sectionNodeWithTags, rootNodeWithTags),
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
      ...rootTagsGood(
        rootNodeWithTags,
        (decoded: ReturnType<typeof decodeNodeSummary>) => decoded,
      ),
    ],
    bad: [
      { label: "missing identity", doc: omit(GOOD_NODE, "identity") },
      { label: "empty identity", doc: put(GOOD_NODE, "", "identity") },
      { label: "missing tags", doc: omit(GOOD_NODE, "tags") },
      { label: "non-string tag", doc: put(GOOD_NODE, [3], "tags") },
      {
        label:
          "tags out of byte order (12.7 tag-set form: byte order, never " +
          "re-sorted by the harness, H-3)",
        doc: put(GOOD_NODE, ["v2", "auth"], "tags"),
      },
      {
        label: "a repeated tag (12.7 tag-set form: duplicates collapsed)",
        doc: put(GOOD_NODE, ["auth", "auth"], "tags"),
      },
      {
        label:
          "tags in case-folded order (12.7: byte order, never case-folded — " +
          "0x5a sorts before 0x61)",
        doc: put(GOOD_NODE, ["auth", "Zed"], "tags"),
      },
      ...nodeTagsBad(sectionNodeWithTags, rootNodeWithTags),
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
      ...rootTagsGood(
        rootNodeWithTags,
        (decoded: ReturnType<typeof decodeNodeMetadataSummary>) => decoded,
      ),
    ],
    bad: [
      { label: "missing identity", doc: omit(GOOD_NODE, "identity") },
      { label: "missing tags", doc: omit(GOOD_NODE, "tags") },
      {
        label:
          "tags out of byte order (12.7 tag-set form: byte order, never " +
          "re-sorted by the harness, H-3)",
        doc: put(GOOD_NODE, ["v2", "auth"], "tags"),
      },
      {
        label: "a repeated tag (12.7 tag-set form: duplicates collapsed)",
        doc: put(GOOD_NODE, ["auth", "auth"], "tags"),
      },
      {
        label:
          "tags in case-folded order (12.7: byte order, never case-folded — " +
          "0x5a sorts before 0x61)",
        doc: put(GOOD_NODE, ["auth", "Zed"], "tags"),
      },
      { label: "missing hashes", doc: omit(GOOD_NODE, "hashes") },
      {
        label: "missing metadataHash",
        doc: omit(GOOD_NODE, "hashes", "metadataHash"),
      },
      {
        label: "empty metadataHash",
        doc: put(GOOD_NODE, "", "hashes", "metadataHash"),
      },
      ...nodeTagsBad(sectionNodeWithTags, rootNodeWithTags),
    ],
  },
  {
    name: "query node (text-algebra summary)",
    decode: decodeNodeTextAlgebraSummary,
    // GOOD_NODE with a `contains` edge to a child beside its dependency
    // edge: the child's identity decodes, the dependency edge is passed over.
    good: put(GOOD_NODE, [EDGE_OUT, CONTAINS_DETAILS], "edges", "outgoing"),
    verify: (decoded: ReturnType<typeof decodeNodeTextAlgebraSummary>) => {
      expect(decoded.ownText).toBe("Login must work.\n");
      expect(decoded.subtreeText).toBe("Login must work.\n\nDetails.\n");
      expect(decoded.sourceRange).toEqual({ start: 12, end: 96 });
      expect(decoded.containsTargets).toEqual(["specs/A.mdx#login.details"]);
    },
    alsoGood: [
      {
        // The point of this summary decoder: a document carrying only the
        // CONF-MD-scoped members it reads — own and subtree text, source
        // range, outgoing edges; no identity, hashes, tags, coverage, or
        // incoming edges — decodes (CERTIFICATIONS.md §CONF-MD; P-3), and
        // empty texts and an empty edge list are legitimate values (an
        // empty leaf section, SPEC.md 1.1), never rejected and never
        // defaulted.
        label:
          "a document carrying only the scoped members (empty texts, no children)",
        doc: {
          ownText: "",
          subtreeText: "",
          sourceRange: { start: 3, end: 3 },
          edges: { outgoing: [] },
        },
        verify: (
          decoded: ReturnType<typeof decodeNodeTextAlgebraSummary>,
        ): void => {
          expect(decoded.ownText).toBe("");
          expect(decoded.subtreeText).toBe("");
          expect(decoded.sourceRange).toEqual({ start: 3, end: 3 });
          expect(decoded.containsTargets).toEqual([]);
        },
      },
      {
        // Several children keep the answer's own order — ordering them by
        // their reported ranges is P-3's step, not the adapter's — and an
        // edge of a dependency kind is passed over unread: its
        // out-of-scope content (here no `to`) is never decoded.
        label:
          "contains targets in answer order beside an unread dependency edge",
        doc: put(
          GOOD_NODE,
          [
            { ...CONTAINS_DETAILS, to: "specs/A.mdx#login.b" },
            { from: "specs/A.mdx#login", kind: "embeds" },
            { ...CONTAINS_DETAILS, to: "specs/A.mdx#login.a" },
          ],
          "edges",
          "outgoing",
        ),
        verify: (
          decoded: ReturnType<typeof decodeNodeTextAlgebraSummary>,
        ): void => {
          expect(decoded.containsTargets).toEqual([
            "specs/A.mdx#login.b",
            "specs/A.mdx#login.a",
          ]);
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
      { label: "missing sourceRange", doc: omit(GOOD_NODE, "sourceRange") },
      {
        label: "sourceRange as a pair (12.7: {start, end} exactly)",
        doc: put(GOOD_NODE, [12, 96], "sourceRange"),
      },
      {
        label: "sourceRange with an extra member (12.7: no other member)",
        doc: put(GOOD_NODE, { start: 12, end: 96, length: 84 }, "sourceRange"),
      },
      { label: "missing edges", doc: omit(GOOD_NODE, "edges") },
      {
        label: "missing outgoing edges",
        doc: omit(GOOD_NODE, "edges", "outgoing"),
      },
      {
        label: "outgoing edges not an array",
        doc: put(GOOD_NODE, {}, "edges", "outgoing"),
      },
      {
        label: "an outgoing edge that is a bare identity, not an edge object",
        doc: put(GOOD_NODE, ["specs/A.mdx#login.details"], "edges", "outgoing"),
      },
      {
        label: "an outgoing edge without a kind",
        doc: put(
          GOOD_NODE,
          [{ from: "specs/A.mdx#login", to: "specs/A.mdx#login.details" }],
          "edges",
          "outgoing",
        ),
      },
      {
        label: "an outgoing edge of a kind outside SPEC.md 5.2's vocabulary",
        doc: put(
          GOOD_NODE,
          [{ ...CONTAINS_DETAILS, kind: "child" }],
          "edges",
          "outgoing",
        ),
      },
      {
        label: "a contains edge without a target",
        doc: put(
          GOOD_NODE,
          [{ from: "specs/A.mdx#login", kind: "contains" }],
          "edges",
          "outgoing",
        ),
      },
      {
        label: "a contains edge with an empty target",
        doc: put(
          GOOD_NODE,
          [{ ...CONTAINS_DETAILS, to: "" }],
          "edges",
          "outgoing",
        ),
      },
      {
        label: "a contains edge with a non-string target",
        doc: put(
          GOOD_NODE,
          [{ ...CONTAINS_DETAILS, to: 7 }],
          "edges",
          "outgoing",
        ),
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
      ...rootTagsGood(
        rootRowWithTags,
        (decoded: ReturnType<typeof decodeNodeSummaryRowsReport>) => decoded[1],
      ),
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
        label: "section row missing tags (required: [] when tagless, 12.7)",
        doc: omit(GOOD_ROWS, "nodes", 0, "tags"),
      },
      {
        label:
          "tags out of byte order (12.7 tag-set form: byte order, never " +
          "re-sorted by the harness, H-3)",
        doc: put(GOOD_ROWS, ["v2", "auth"], "nodes", 0, "tags"),
      },
      {
        label: "a repeated tag (12.7 tag-set form: duplicates collapsed)",
        doc: put(GOOD_ROWS, ["auth", "auth"], "nodes", 0, "tags"),
      },
      {
        label:
          "tags in case-folded order (12.7: byte order, never case-folded — " +
          "0x5a sorts before 0x61)",
        doc: put(GOOD_ROWS, ["auth", "Zed"], "nodes", 0, "tags"),
      },
      {
        label: "row with a non-string tag",
        doc: put(GOOD_ROWS, [3], "nodes", 0, "tags"),
      },
      ...nodeTagsBad(sectionRowWithTags, rootRowWithTags),
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
    alsoGood: [
      ...rootTagsGood(
        rootRowWithTags,
        (decoded: ReturnType<typeof decodeNodeRowsReport>) => decoded[1],
      ),
      {
        label: "root row: tags and coverage attribute both absent (SPEC 11.1)",
        doc: rootRowWithTags(undefined),
        verify: (decoded: ReturnType<typeof decodeNodeRowsReport>) => {
          expect(decoded[0].tags).toEqual(["auth"]);
          expect(decoded[1].tags).toBeNull();
          expect(decoded[1].coverage).toBeUndefined();
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
        label: "row missing sourceRange",
        doc: omit(GOOD_ROWS, "nodes", 0, "sourceRange"),
      },
      {
        label: "row range carrying an extra member (12.7 value form)",
        doc: put(
          GOOD_ROWS,
          { start: 12, end: 96, length: 84 },
          "nodes",
          0,
          "sourceRange",
        ),
      },
      {
        label: "row range as an array [start, end] (never re-mapped, H-3)",
        doc: put(GOOD_ROWS, [0, 120], "nodes", 1, "sourceRange"),
      },
      {
        label: "section row missing tags (required: [] when tagless, 12.7)",
        doc: omit(GOOD_ROWS, "nodes", 0, "tags"),
      },
      {
        label:
          "tags out of byte order (12.7 tag-set form: byte order, never " +
          "re-sorted by the harness, H-3)",
        doc: put(GOOD_ROWS, ["v2", "auth"], "nodes", 0, "tags"),
      },
      {
        label: "a repeated tag (12.7 tag-set form: duplicates collapsed)",
        doc: put(GOOD_ROWS, ["auth", "auth"], "nodes", 0, "tags"),
      },
      {
        label:
          "tags in case-folded order (12.7: byte order, never case-folded — " +
          "0x5a sorts before 0x61)",
        doc: put(GOOD_ROWS, ["auth", "Zed"], "nodes", 0, "tags"),
      },
      {
        label: "row with wrong-typed coverage",
        doc: put(GOOD_ROWS, false, "nodes", 0, "coverage"),
      },
      ...nodeTagsBad(sectionRowWithTags, rootRowWithTags),
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
      {
        label:
          "the two refusal codes SPEC 14 lists last: refused-invalid-rewrite " +
          "(locating the moved construct, identities the concerned files' " +
          "paths in byte order) then refused-moved-import (locating the " +
          "moved declaration, identities empty) (SPEC 14; T6.5-16, T6.5-17, " +
          "T14-7)",
        doc: {
          findings: [
            {
              code: "refused-invalid-rewrite",
              message: "the exact edits would leave specs/B.mdx unparseable",
              locations: [
                { file: "specs/A.mdx", range: { start: 12, end: 60 } },
              ],
              path: null,
              identities: ["specs/B.mdx", "specs/new.mdx"],
            },
            {
              code: "refused-moved-import",
              message: "the moved text holds an import declaration",
              locations: [
                { file: "specs/A.mdx", range: { start: 20, end: 48 } },
              ],
              path: null,
              identities: [],
            },
          ],
        },
        verify: (decoded: ReturnType<typeof decodeFindingsReport>): void => {
          expect(decoded.findings.map((finding) => finding.code)).toEqual([
            "refused-invalid-rewrite",
            "refused-moved-import",
          ]);
          // Refusal reasons derive no 14.N condition identity.
          expect(decoded.findings.map((finding) => finding.condition)).toEqual([
            null,
            null,
          ]);
          expect(decoded.findings[0]!.identities).toEqual([
            "specs/B.mdx",
            "specs/new.mdx",
          ]);
          expect(decoded.findings[1]!.identities).toEqual([]);
        },
      },
      {
        label:
          "refused-exposed-derived-file after refused-invalid-destination, " +
          "each concerning its path with locations [] (T6.5-21's " +
          "multi-reason arm; SPEC 14's listed order, T12.7-2)",
        doc: {
          findings: [
            structuredClone(INVALID_DESTINATION_FINDING),
            structuredClone(EXPOSED_DERIVED_FILE_FINDING),
          ],
        },
        verify: (decoded: ReturnType<typeof decodeFindingsReport>): void => {
          expect(decoded.findings.map((finding) => finding.code)).toEqual([
            "refused-invalid-destination",
            "refused-exposed-derived-file",
          ]);
          // Refusal reasons derive no 14.N condition identity.
          expect(decoded.findings.map((finding) => finding.condition)).toEqual([
            null,
            null,
          ]);
          expect(decoded.findings.map((finding) => finding.path)).toEqual([
            "specs/a'b.mdx",
            "specs/A.md",
          ]);
          expect(decoded.findings[1]!.locations).toEqual([]);
          expect(decoded.findings[1]!.identities).toEqual([]);
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
          "the retired refused-unresolvable-reference code (a code 14 does " +
          "not list never appears in any report: no reason exists for a " +
          "rewritten reference failing to resolve, SPEC 6.4, 6.5, 14; T14-7)",
        doc: put(
          GOOD_FINDINGS,
          "refused-unresolvable-reference",
          "findings",
          4,
          "code",
        ),
      },
      {
        label:
          "a write failure inside a findings array (14.24 is a usage error " +
          "carried only as the exit-2 error document's code, SPEC 14, 12.7)",
        doc: {
          findings: [
            {
              code: "write-failure",
              message: "cannot write .xspec: permission denied",
              locations: [],
              path: ".xspec",
              identities: [],
            },
          ],
        },
      },
      {
        label:
          "a read failure inside a findings array (14.25 is a usage error " +
          "carried only as the exit-2 error document's code, SPEC 14, 12.7)",
        doc: {
          findings: [
            {
              code: "read-failure",
              message: "cannot list specs/sub: permission denied",
              locations: [],
              path: "specs/sub",
              identities: [],
            },
          ],
        },
      },
      {
        label:
          "a busy workspace inside a findings array (14.26 is a usage error " +
          "carried only as the exit-2 error document's code, SPEC 14, 12.7)",
        doc: {
          findings: [
            {
              code: "workspace-busy",
              message: "workspace busy: another run holds .xspec/lock",
              locations: [],
              path: ".xspec/lock",
              identities: [],
            },
          ],
        },
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
        label:
          "refused-exposed-derived-file before refused-invalid-destination " +
          "(14 lists it after: T6.5-21's multi-reason pair reversed)",
        doc: {
          findings: [
            structuredClone(EXPOSED_DERIVED_FILE_FINDING),
            structuredClone(INVALID_DESTINATION_FINDING),
          ],
        },
      },
      {
        label:
          "refused-invalid-rewrite before refused-exposed-derived-file " +
          "(14 lists refused-exposed-derived-file before it)",
        doc: {
          findings: [
            {
              code: "refused-invalid-rewrite",
              message: "the exact edits would leave specs/B.mdx unparseable",
              locations: [
                { file: "specs/A.mdx", range: { start: 12, end: 60 } },
              ],
              path: null,
              identities: ["specs/B.mdx"],
            },
            structuredClone(EXPOSED_DERIVED_FILE_FINDING),
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
        label:
          "tags out of byte order (12.7 tag-set form: byte order, never " +
          "re-sorted by the harness, H-3)",
        doc: put(
          GOOD_VIEW_FULL,
          ["v2", "auth"],
          "views",
          0,
          "root",
          "children",
          0,
          "tags",
        ),
      },
      {
        label: "a repeated tag (12.7 tag-set form: duplicates collapsed)",
        doc: put(
          GOOD_VIEW_FULL,
          ["auth", "auth"],
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
          "tags in case-folded order (12.7: byte order, never case-folded — " +
          "0x5a sorts before 0x61)",
        doc: put(
          GOOD_VIEW_FULL,
          ["auth", "Zed"],
          "views",
          0,
          "root",
          "children",
          0,
          "tags",
        ),
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
        label:
          "tags out of byte order (12.7 tag-set form: byte order, never " +
          "re-sorted by the harness, H-3)",
        doc: put(
          GOOD_VIEW_FULL_TEXT,
          ["v2", "auth"],
          "views",
          0,
          "root",
          "children",
          0,
          "tags",
        ),
      },
      {
        label: "a repeated tag (12.7 tag-set form: duplicates collapsed)",
        doc: put(
          GOOD_VIEW_FULL_TEXT,
          ["auth", "auth"],
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
          "tags in case-folded order (12.7: byte order, never case-folded — " +
          "0x5a sorts before 0x61)",
        doc: put(
          GOOD_VIEW_FULL_TEXT,
          ["auth", "Zed"],
          "views",
          0,
          "root",
          "children",
          0,
          "tags",
        ),
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
      {
        label:
          "a write failure: code write-failure concerning the graph-data " +
          "area (SPEC 14.24, 12.7)",
        doc: {
          error: {
            code: "write-failure",
            message: "cannot write .xspec: permission denied",
            locations: [],
            path: ".xspec",
            identities: [],
          },
        },
        verify: (decoded: ReturnType<typeof decodeErrorDocument>): void => {
          expect(decoded.error.code).toBe("write-failure");
          expect(decoded.error.condition).toBe("14.24");
          expect(decoded.error.path).toBe(".xspec");
        },
      },
      {
        label:
          "a read failure: code read-failure concerning the unlistable " +
          "directory (SPEC 14.25, 12.7)",
        doc: {
          error: {
            code: "read-failure",
            message: "cannot list specs/sub: permission denied",
            locations: [],
            path: "specs/sub",
            identities: [],
          },
        },
        verify: (decoded: ReturnType<typeof decodeErrorDocument>): void => {
          expect(decoded.error.code).toBe("read-failure");
          expect(decoded.error.condition).toBe("14.25");
          expect(decoded.error.path).toBe("specs/sub");
        },
      },
      {
        label:
          "a busy workspace: code workspace-busy concerning the lock path " +
          "(SPEC 14.26, 12.7)",
        doc: {
          error: {
            code: "workspace-busy",
            message: "workspace busy: another run holds .xspec/lock",
            locations: [],
            path: ".xspec/lock",
            identities: [],
          },
        },
        verify: (decoded: ReturnType<typeof decodeErrorDocument>): void => {
          expect(decoded.error.code).toBe("workspace-busy");
          expect(decoded.error.condition).toBe("14.26");
          expect(decoded.error.path).toBe(".xspec/lock");
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
    // The version document (SPEC 12.6, 12.7): {"product", "interface"}
    // exactly, both strings. Form-exact (H-3); value contracts — `interface`
    // exactly "1", per-build fixedness — stay with T12.6-1/2, so the decoder
    // admits any string values (the empty informational `product` included:
    // 12.6 places no requirement on it beyond per-build fixedness).
    name: "12.7 version document",
    decode: decodeVersionDocument,
    good: { product: "xspec 1.2.3", interface: "1" },
    verify: (decoded: ReturnType<typeof decodeVersionDocument>) => {
      expect(decoded.product).toBe("xspec 1.2.3");
      expect(decoded.interface).toBe("1");
    },
    alsoGood: [
      {
        label:
          "an empty informational product version (12.6: no requirement " +
          "beyond per-build fixedness) — the value contract on `interface` " +
          "is the caller's",
        doc: { product: "", interface: "2" },
        verify: (decoded: ReturnType<typeof decodeVersionDocument>): void => {
          expect(decoded.product).toBe("");
          expect(decoded.interface).toBe("2");
        },
      },
    ],
    bad: [
      { label: "missing product member", doc: { interface: "1" } },
      { label: "missing interface member", doc: { product: "xspec 1.2.3" } },
      {
        label: "null product (the form carries two strings, 12.7)",
        doc: { product: null, interface: "1" },
      },
      {
        label:
          "numeric interface (the string form of 12.6's stated value, " +
          "never the number)",
        doc: { product: "xspec 1.2.3", interface: 1 },
      },
      {
        label: 'an extra member (12.7: exactly {"product", "interface"})',
        doc: { product: "xspec 1.2.3", interface: "1", commit: "abc123" },
      },
      {
        label: "the error document passed off as the version document",
        doc: {
          error: {
            code: null,
            message: "unknown flag",
            locations: [],
            path: null,
            identities: [],
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
      {
        label:
          "recorded paths out of byte order (SPEC 11.6, 12.7: the recorded " +
          "derived-file paths in byte order)",
        doc: { recorded: ["specs/A.xspec.ts", "specs/A.md"] },
      },
      {
        label:
          "a duplicate recorded path (SPEC 11.6: a deterministically " +
          "ordered path list)",
        doc: { recorded: ["specs/A.md", "specs/A.md"] },
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
    // The scoped inventory resolved-map decode (SPEC 11.6, 12.7; T11.6-2's
    // subject): exactly the `configuration`, `sources`, and `derived`
    // members in the 12.7 member forms — every default and inferred kind
    // explicit, `null` never omission, sources/derived in byte order — with
    // every other member unread (the full inventory form is T11.6-*'s
    // subject).
    name: "11.6 inventory (resolved map)",
    decode: decodeInventoryResolvedMap,
    good: GOOD_RESOLVED_INVENTORY,
    verify: (decoded: ReturnType<typeof decodeInventoryResolvedMap>) => {
      expect(decoded.configuration.specs.map((g) => g.name)).toEqual([
        "core",
        "aux",
      ]);
      expect(decoded.configuration.markdown).toEqual({
        emit: false,
        outDir: null,
      });
      const profile = decoded.configuration.coverage[0]!;
      expect(profile.targetTags).toBeNull();
      expect(profile.targets).toBe("leaves");
      expect(profile.boundaryKind).toBe("code");
      expect(profile.edgeKinds).toEqual(["depends", "embeds", "references"]);
      const rule = decoded.configuration.policy[0]!;
      expect(rule.from).toEqual({ group: "aux", kind: "spec" });
      expect(rule.to).toEqual({ files: "specs/core/**" });
      expect(decoded.sources.map((s) => s.path)).toEqual([
        "specs/aux/b.mdx",
        "specs/core/a.mdx",
        "src/app.ts",
      ]);
      expect(decoded.sources[2]!.groups).toEqual([
        { name: "impl", kind: "code" },
      ]);
      expect(decoded.derived[0]!.markdown).toBeNull();
      expect(decoded.derived[1]!).toEqual({
        source: "specs/core/a.mdx",
        module: "specs/core/a.xspec.ts",
        markdown: "specs/core/a.md",
      });
    },
    alsoGood: [
      {
        label:
          "a tags selector, a non-UTF-8 source path in the marked byte " +
          "form, and a non-generating source's null module/markdown all " +
          "decode as stated (SPEC 12.7, 11.6)",
        doc: put(
          put(
            put(
              GOOD_RESOLVED_INVENTORY,
              { tags: ["stable", "v2"] },
              "configuration",
              "policy",
              0,
              "to",
            ),
            [
              ...GOOD_RESOLVED_INVENTORY.sources,
              // 0xff… sorts after every ASCII path: byte order holds.
              {
                path: { bytes: "ff2e6d64" },
                groups: [{ name: "core", kind: "spec" }],
              },
            ],
            "sources",
          ),
          [
            ...GOOD_RESOLVED_INVENTORY.derived,
            { source: { bytes: "ff2e6d64" }, module: null, markdown: null },
          ],
          "derived",
        ),
        verify: (
          decoded: ReturnType<typeof decodeInventoryResolvedMap>,
        ): void => {
          expect(decoded.configuration.policy[0]!.to).toEqual({
            tags: ["stable", "v2"],
          });
          expect(decoded.sources[3]!.path).toEqual({ bytes: "ff2e6d64" });
          expect(decoded.derived[2]!).toEqual({
            source: { bytes: "ff2e6d64" },
            module: null,
            markdown: null,
          });
        },
      },
      {
        label:
          "configured sets in their 12.7 value forms decode literally — a " +
          'tag set in byte order ("Z" before "a": 0x5a < 0x61, inverted by ' +
          "case folding) and kind sets in 5.2's order as proper subsets " +
          "(SPEC 12.7, 7.4, 7.5, 11.6)",
        doc: put(
          put(
            put(
              put(
                GOOD_RESOLVED_INVENTORY,
                ["Z", "a"],
                "configuration",
                "coverage",
                0,
                "targetTags",
              ),
              ["depends", "references"],
              "configuration",
              "coverage",
              0,
              "edgeKinds",
            ),
            { tags: ["a", "b"] },
            "configuration",
            "policy",
            0,
            "to",
          ),
          ["depends", "embeds"],
          "configuration",
          "policy",
          0,
          "kinds",
        ),
        verify: (
          decoded: ReturnType<typeof decodeInventoryResolvedMap>,
        ): void => {
          const profile = decoded.configuration.coverage[0]!;
          expect(profile.targetTags).toEqual(["Z", "a"]);
          expect(profile.edgeKinds).toEqual(["depends", "references"]);
          const rule = decoded.configuration.policy[0]!;
          expect(rule.to).toEqual({ tags: ["a", "b"] });
          expect(rule.kinds).toEqual(["depends", "embeds"]);
        },
      },
    ],
    bad: [
      {
        label:
          "absent configuration member (null is never omission, SPEC 12.7)",
        doc: omit(GOOD_RESOLVED_INVENTORY, "configuration"),
      },
      {
        label:
          "an extra member inside configuration (the form carries exactly " +
          "specs/code/markdown/coverage/policy, SPEC 12.7)",
        doc: put(GOOD_RESOLVED_INVENTORY, true, "configuration", "extra"),
      },
      {
        label:
          "markdown without outDir (unset is the stated null, never " +
          "omission, SPEC 12.7)",
        doc: omit(
          GOOD_RESOLVED_INVENTORY,
          "configuration",
          "markdown",
          "outDir",
        ),
      },
      {
        label: "a non-boolean emit",
        doc: put(
          GOOD_RESOLVED_INVENTORY,
          "false",
          "configuration",
          "markdown",
          "emit",
        ),
      },
      {
        label:
          "a group carried as a bare name instead of its complete " +
          "definition (SPEC 11.6: never as a bare name)",
        doc: put(GOOD_RESOLVED_INVENTORY, ["core"], "configuration", "specs"),
      },
      {
        label:
          "a profile without targetTags (an absent targetTags is the " +
          "stated null — every default explicit, SPEC 11.6, 12.7)",
        doc: omit(
          GOOD_RESOLVED_INVENTORY,
          "configuration",
          "coverage",
          0,
          "targetTags",
        ),
      },
      {
        label:
          "a profile without boundaryKind (explicit though inferred, SPEC " +
          "11.6, 7.4)",
        doc: omit(
          GOOD_RESOLVED_INVENTORY,
          "configuration",
          "coverage",
          0,
          "boundaryKind",
        ),
      },
      {
        label:
          'edgeKinds carrying "contains" (no dependency edge kind, SPEC ' +
          "5.2, 7.4)",
        doc: put(
          GOOD_RESOLVED_INVENTORY,
          ["contains"],
          "configuration",
          "coverage",
          0,
          "edgeKinds",
        ),
      },
      {
        label:
          'edgeKinds out of 5.2\'s order (["references", "depends"]: a kind ' +
          "set lists its tokens in the order 5.2 lists them, however " +
          "configured; SPEC 12.7, 7.4)",
        doc: put(
          GOOD_RESOLVED_INVENTORY,
          ["references", "depends"],
          "configuration",
          "coverage",
          0,
          "edgeKinds",
        ),
      },
      {
        label:
          "edgeKinds with a repeated token (a kind set collapses a repeated " +
          "element; SPEC 12.7, 7.4)",
        doc: put(
          GOOD_RESOLVED_INVENTORY,
          ["depends", "depends", "embeds"],
          "configuration",
          "coverage",
          0,
          "edgeKinds",
        ),
      },
      {
        label:
          'targetTags out of byte order (["z", "a"]: a tag set is in byte ' +
          "order; SPEC 12.7, 12.0)",
        doc: put(
          GOOD_RESOLVED_INVENTORY,
          ["z", "a"],
          "configuration",
          "coverage",
          0,
          "targetTags",
        ),
      },
      {
        label:
          'targetTags in case-folded rather than byte order (["a", "Z"]: ' +
          "0x5a sorts before 0x61; SPEC 12.7, 12.0)",
        doc: put(
          GOOD_RESOLVED_INVENTORY,
          ["a", "Z"],
          "configuration",
          "coverage",
          0,
          "targetTags",
        ),
      },
      {
        label:
          "targetTags with a repeated tag (a tag set collapses duplicates; " +
          "SPEC 12.7, 7.4)",
        doc: put(
          GOOD_RESOLVED_INVENTORY,
          ["a", "a"],
          "configuration",
          "coverage",
          0,
          "targetTags",
        ),
      },
      {
        label: 'a tags selector out of byte order (["b", "a"]; SPEC 12.7, 7.5)',
        doc: put(
          GOOD_RESOLVED_INVENTORY,
          { tags: ["b", "a"] },
          "configuration",
          "policy",
          0,
          "to",
        ),
      },
      {
        label:
          'a tags selector with a repeated tag (["a", "a"]; SPEC 12.7, 7.5)',
        doc: put(
          GOOD_RESOLVED_INVENTORY,
          { tags: ["a", "a"] },
          "configuration",
          "policy",
          0,
          "to",
        ),
      },
      {
        label:
          'a rule\'s kinds out of 5.2\'s order (["embeds", "depends"]; SPEC ' +
          "12.7, 7.5)",
        doc: put(
          GOOD_RESOLVED_INVENTORY,
          ["embeds", "depends"],
          "configuration",
          "policy",
          0,
          "kinds",
        ),
      },
      {
        label:
          "a group selector without kind (explicit though inferred, SPEC " +
          "7.5, 12.7)",
        doc: omit(
          GOOD_RESOLVED_INVENTORY,
          "configuration",
          "policy",
          0,
          "from",
          "kind",
        ),
      },
      {
        label: "a selector of no 7.5 form",
        doc: put(
          GOOD_RESOLVED_INVENTORY,
          { unit: "x" },
          "configuration",
          "policy",
          0,
          "from",
        ),
      },
      {
        label: "a selector mixing the group and files forms",
        doc: put(
          GOOD_RESOLVED_INVENTORY,
          { group: "aux", kind: "spec", files: "src/**" },
          "configuration",
          "policy",
          0,
          "from",
        ),
      },
      {
        label:
          "source entries out of byte order (SPEC 11.6: files and paths " +
          "in byte order of workspace-relative path)",
        doc: put(
          GOOD_RESOLVED_INVENTORY,
          [
            GOOD_RESOLVED_INVENTORY.sources[1],
            GOOD_RESOLVED_INVENTORY.sources[0],
            GOOD_RESOLVED_INVENTORY.sources[2],
          ],
          "sources",
        ),
      },
      {
        label: "duplicate source entries (one entry per discovered file)",
        doc: put(
          GOOD_RESOLVED_INVENTORY,
          [
            GOOD_RESOLVED_INVENTORY.sources[0],
            GOOD_RESOLVED_INVENTORY.sources[0],
          ],
          "sources",
        ),
      },
      {
        label: "a membership without kind",
        doc: omit(GOOD_RESOLVED_INVENTORY, "sources", 0, "groups", 0, "kind"),
      },
      {
        label:
          "a valid-UTF-8 source path in the marked byte form (SPEC 12.7 " +
          "forbids it)",
        doc: put(
          GOOD_RESOLVED_INVENTORY,
          { bytes: "612e6d64" },
          "sources",
          0,
          "path",
        ),
      },
      {
        label:
          "a derived entry without markdown (structural absence is the " +
          "stated null, never omission, SPEC 11.6, 12.7)",
        doc: omit(GOOD_RESOLVED_INVENTORY, "derived", 0, "markdown"),
      },
      {
        label:
          "a derived module as the unavailability marker (the projection " +
          "is configuration- and discovery-determined, never " +
          "record-supplied, SPEC 11.6)",
        doc: put(
          GOOD_RESOLVED_INVENTORY,
          { unavailable: true },
          "derived",
          0,
          "module",
        ),
      },
    ],
  },
  {
    // The full inventory document decode (SPEC 11.6, 12.7; T11.6-3's
    // frame): the top level carries exactly the eleven pinned members,
    // decoded through the scoped decoders plus the recorded/graphData/
    // journal/sessions/lock forms — `recorded` a three-state datum in byte
    // order, `journal` {"path","occupied"} exactly, `sessions` in byte order
    // of file name, `lock` a required path value.
    name: "11.6 inventory (document)",
    decode: decodeInventoryDocument,
    good: GOOD_INVENTORY_DOCUMENT,
    verify: (decoded: ReturnType<typeof decodeInventoryDocument>) => {
      expect(decoded.root).toBe(".");
      expect(decoded.config).toBe("xspec.config.ts");
      expect(decoded.configuration.specs.map((g) => g.name)).toEqual([
        "core",
        "aux",
      ]);
      expect(decoded.findings).toEqual([]);
      expect(decoded.recorded).toEqual({
        state: "value",
        value: ["specs/core/a.md", "specs/core/a.xspec.ts"],
      });
      expect(decoded.graphData).toBe(".xspec");
      expect(decoded.journal).toEqual({
        path: ".xspec/journal",
        occupied: false,
      });
      expect(decoded.sessions).toEqual([
        ".xspec/reviews/S.json",
        ".xspec/reviews/ancien.json",
      ]);
      expect(decoded.lock).toBe(".xspec/lock");
    },
    alsoGood: [
      {
        label:
          "recorded unavailable (14.23) beside an occupied journal decodes " +
          "as stated — never as an empty record or a defaulted occupancy",
        doc: put(
          put(GOOD_INVENTORY_DOCUMENT, { unavailable: true }, "recorded"),
          true,
          "journal",
          "occupied",
        ),
        verify: (decoded: ReturnType<typeof decodeInventoryDocument>): void => {
          expect(decoded.recorded).toEqual({ state: "unavailable" });
          expect(decoded.journal.occupied).toBe(true);
        },
      },
      {
        label: "no sessions is the empty array (SPEC 12.7)",
        doc: put(GOOD_INVENTORY_DOCUMENT, [], "sessions"),
        verify: (decoded: ReturnType<typeof decodeInventoryDocument>): void => {
          expect(decoded.sessions).toEqual([]);
        },
      },
    ],
    bad: [
      {
        label:
          "an extra top-level member (the form carries exactly the eleven " +
          "pinned members, SPEC 12.7)",
        doc: put(GOOD_INVENTORY_DOCUMENT, ".xspec", "area"),
      },
      {
        label:
          "absent lock member (the lock path is reported unconditionally, " +
          "SPEC 11.6, 12.7)",
        doc: omit(GOOD_INVENTORY_DOCUMENT, "lock"),
      },
      {
        label:
          "null lock (reported unconditionally: null never stands for the " +
          "lock path, SPEC 11.6, 12.7)",
        doc: put(GOOD_INVENTORY_DOCUMENT, null, "lock"),
      },
      {
        label:
          "a non-string lock (a 12.7 path value is a string or the marked " +
          "byte form, SPEC 12.7)",
        doc: put(GOOD_INVENTORY_DOCUMENT, 7, "lock"),
      },
      {
        label: "absent graphData member (null is never omission, SPEC 12.7)",
        doc: omit(GOOD_INVENTORY_DOCUMENT, "graphData"),
      },
      {
        label: "absent journal member",
        doc: omit(GOOD_INVENTORY_DOCUMENT, "journal"),
      },
      {
        label:
          'journal without occupied (the member form is {"path", ' +
          '"occupied"} exactly, SPEC 12.7)',
        doc: omit(GOOD_INVENTORY_DOCUMENT, "journal", "occupied"),
      },
      {
        label: "journal with an extra member",
        doc: put(GOOD_INVENTORY_DOCUMENT, 3, "journal", "lines"),
      },
      {
        label: "a stringly-typed occupied",
        doc: put(GOOD_INVENTORY_DOCUMENT, "false", "journal", "occupied"),
      },
      {
        label: "absent sessions member",
        doc: omit(GOOD_INVENTORY_DOCUMENT, "sessions"),
      },
      {
        label: "null sessions (an empty list is [], never null, SPEC 12.7)",
        doc: put(GOOD_INVENTORY_DOCUMENT, null, "sessions"),
      },
      {
        label:
          "sessions out of byte order of file name (the case-folded order, " +
          "SPEC 11.6)",
        doc: put(
          GOOD_INVENTORY_DOCUMENT,
          [".xspec/reviews/ancien.json", ".xspec/reviews/S.json"],
          "sessions",
        ),
      },
      {
        label: "absent recorded member",
        doc: omit(GOOD_INVENTORY_DOCUMENT, "recorded"),
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
    name: "performed rename/move document (12.7: {findings, mapping})",
    decode: decodePerformedOperationReport,
    good: GOOD_APPLIED_MAPPING,
    verify: (decoded: ReturnType<typeof decodePerformedOperationReport>) => {
      expect(decoded).toEqual({
        findings: [],
        mapping: [
          { from: "specs/A.mdx#login", to: "specs/A.mdx#signin" },
          { from: "specs/A.mdx#login.form", to: "specs/A.mdx#signin.form" },
        ],
      });
    },
    bad: [
      {
        label: "a member beside findings and mapping (form-exact member set)",
        doc: put(GOOD_APPLIED_MAPPING, [], "files"),
      },
      {
        label: "findings absent (never omission)",
        doc: omit(GOOD_APPLIED_MAPPING, "findings"),
      },
      {
        label: "null findings (an empty list is [], never null)",
        doc: put(GOOD_APPLIED_MAPPING, null, "findings"),
      },
      {
        label: "findings not an array",
        doc: put(GOOD_APPLIED_MAPPING, {}, "findings"),
      },
      {
        label:
          "non-empty findings (a refused operation reports the " +
          "findings-only form, never a mapping beside findings)",
        doc: put(GOOD_APPLIED_MAPPING, [GOOD_FINDINGS.findings[0]], "findings"),
      },
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
        label: "mapping entries out of `from`-byte order",
        doc: put(
          GOOD_APPLIED_MAPPING,
          [...structuredClone(GOOD_APPLIED_MAPPING.mapping)].reverse(),
          "mapping",
        ),
      },
      {
        label:
          "two mapping entries for one identity (one {from, to} per " +
          "mapped identity)",
        doc: put(
          GOOD_APPLIED_MAPPING,
          [
            { from: "specs/A.mdx#login", to: "specs/A.mdx#signin" },
            { from: "specs/A.mdx#login", to: "specs/A.mdx#other" },
          ],
          "mapping",
        ),
      },
      {
        label: "pair with a member beside from and to",
        doc: put(GOOD_APPLIED_MAPPING, "rename", "mapping", 0, "via"),
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
    name: "applied mapping entry point (thin alias of the performed decoder)",
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
        label: "a member beside findings and mapping is not ignored",
        doc: put(GOOD_APPLIED_MAPPING, [], "files"),
      },
      {
        label: "non-empty findings",
        doc: put(GOOD_APPLIED_MAPPING, [GOOD_FINDINGS.findings[0]], "findings"),
      },
      {
        label: "mapping entries out of `from`-byte order",
        doc: put(
          GOOD_APPLIED_MAPPING,
          [...structuredClone(GOOD_APPLIED_MAPPING.mapping)].reverse(),
          "mapping",
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
      // The listing's findings decode in the literal 12.7 form, the
      // condition identity derived from the stable code (H-3).
      expect(decoded.findings).toEqual([
        {
          code: "corrupt-session",
          message: "review session a cannot be parsed",
          locations: [],
          path: ".xspec/reviews/a.json",
          identities: [],
          condition: "14.21",
        },
      ]);
    },
    alsoGood: [
      {
        label:
          "a clean listing omitting findings — SPEC fixes no member for " +
          "this unpinned listing with nothing to report — decodes no findings",
        doc: CLEAN_SESSION_LIST,
        verify: (decoded: ReturnType<typeof decodeSessionListReport>) => {
          expect(decoded.sessions).toEqual([
            {
              name: "B",
              corrupt: false,
              strategy: "audit",
              counts: { unresolved: 2, updated: 1 },
            },
          ]);
          expect(Object.hasOwn(decoded, "findings")).toBe(false);
        },
      },
      {
        label: "a clean listing carrying findings [] decodes to []",
        doc: put(CLEAN_SESSION_LIST, [], "findings"),
        verify: (decoded: ReturnType<typeof decodeSessionListReport>) => {
          expect(decoded.sessions).toHaveLength(1);
          expect(decoded.findings).toEqual([]);
        },
      },
      {
        label: "no session at all, no findings member",
        doc: { sessions: [] },
        verify: (decoded: ReturnType<typeof decodeSessionListReport>) => {
          expect(decoded.sessions).toEqual([]);
          expect(Object.hasOwn(decoded, "findings")).toBe(false);
        },
      },
      {
        label:
          "two corrupt sessions: two condition-21 findings in the 12.7 " +
          "order (equal code and locations: by concerned path bytes)",
        doc: TWO_CORRUPT_SESSION_LIST,
        verify: (decoded: ReturnType<typeof decodeSessionListReport>) => {
          expect(decoded.sessions).toEqual([
            { name: "a", corrupt: true },
            { name: "c", corrupt: true },
          ]);
          expect(
            decoded.findings?.map((finding) => [
              finding.code,
              finding.condition,
              finding.path,
            ]),
          ).toEqual([
            ["corrupt-session", "14.21", ".xspec/reviews/a.json"],
            ["corrupt-session", "14.21", ".xspec/reviews/c.json"],
          ]);
        },
      },
    ],
    bad: [
      { label: "missing sessions list", doc: {} },
      {
        label:
          "a session listed corrupt without findings (its condition-21 " +
          "finding withheld: SPEC 14.21, 14, 12.7; required information " +
          "absent, H-3)",
        doc: omit(GOOD_SESSION_LIST, "findings"),
      },
      {
        label:
          "null findings on the corrupt listing (null never encodes " +
          "emptiness, SPEC 12.7)",
        doc: put(GOOD_SESSION_LIST, null, "findings"),
      },
      {
        label:
          "null findings on a clean listing (judged as a findings array, " +
          "never read as absent)",
        doc: put(CLEAN_SESSION_LIST, null, "findings"),
      },
      {
        label: "findings an object keyed by session (never adapted, H-3)",
        doc: put(
          GOOD_SESSION_LIST,
          { a: GOOD_SESSION_LIST.findings[0] },
          "findings",
        ),
      },
      {
        label: "a finding missing its path member (12.7: null, never omitted)",
        doc: omit(GOOD_SESSION_LIST, "findings", 0, "path"),
      },
      {
        label: "a finding whose code is no SPEC 14 token",
        doc: put(GOOD_SESSION_LIST, "session-corrupt", "findings", 0, "code"),
      },
      {
        label:
          "a read-failure finding (a usage error's code, carried in no " +
          "findings array: SPEC 14, 12.7)",
        doc: put(GOOD_SESSION_LIST, "read-failure", "findings", 0, "code"),
      },
      {
        label:
          "two findings out of the 12.7 order (equal code and locations, " +
          "concerned paths descending)",
        doc: put(
          TWO_CORRUPT_SESSION_LIST,
          [...structuredClone(TWO_CORRUPT_SESSION_LIST.findings)].reverse(),
          "findings",
        ),
      },
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
      // No scope-node list carried: decoded as none, never fabricated from
      // the scope root (requireScopeNodes then fails loudly, below).
      expect(decoded.scopeNodes).toBeUndefined();
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
        label:
          "every scope node presented — a subtree-coherence item's scope root and a node beneath it, one present with its range, one absent with none (SPEC 10.7; T10.5-5)",
        doc: put(
          put(GOOD_ITEM, "subtree-coherence", "kind"),
          [
            {
              node: "specs/A.mdx#login",
              present: true,
              sourceRange: { start: 12, end: 96 },
            },
            { node: "specs/A.mdx#login.badCredentials", present: false },
          ],
          "scopeNodes",
        ),
        verify: (decoded: ReturnType<typeof decodeItemReport>) => {
          expect(decoded.scopeNodes).toEqual([
            {
              node: "specs/A.mdx#login",
              present: true,
              sourceRange: { start: 12, end: 96 },
            },
            { node: "specs/A.mdx#login.badCredentials", present: false },
          ]);
        },
      },
      {
        label: "a null scope-node list, read as none carried (optionalKey)",
        doc: put(GOOD_ITEM, null, "scopeNodes"),
        verify: (decoded: ReturnType<typeof decodeItemReport>) => {
          expect(decoded.scopeNodes).toBeUndefined();
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
      {
        label:
          "present scope node's range carrying an extra member (12.7 value form)",
        doc: put(
          GOOD_ITEM,
          { start: 12, end: 96, unit: "bytes" },
          "scope",
          "sourceRange",
        ),
      },
      {
        label:
          'present scope node\'s range as {"from", "to"} (never re-mapped, H-3)',
        doc: put(GOOD_ITEM, { from: 12, to: 96 }, "scope", "sourceRange"),
      },
      {
        label: "scope nodes an object, not a list",
        doc: put(
          GOOD_ITEM,
          { node: "specs/A.mdx#login", present: true },
          "scopeNodes",
        ),
      },
      {
        label: "a scope node missing its presence",
        doc: put(GOOD_ITEM, [{ node: "specs/A.mdx#login" }], "scopeNodes"),
      },
      {
        label: "an absent scope node carrying a source range (contradiction)",
        doc: put(
          GOOD_ITEM,
          [
            {
              node: "specs/A.mdx#login.badCredentials",
              present: false,
              sourceRange: { start: 3, end: 9 },
            },
          ],
          "scopeNodes",
        ),
      },
      {
        label:
          'a present scope node\'s range as {"from", "to"} in the scope-node list (never re-mapped, H-3)',
        doc: put(
          GOOD_ITEM,
          [
            {
              node: "specs/A.mdx#login",
              present: true,
              sourceRange: { from: 12, to: 96 },
            },
          ],
          "scopeNodes",
        ),
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
    name: "review show (metadata-consistency item: the metadata pair)",
    decode: decodeItemReport,
    good: GOOD_METADATA_ITEM,
    verify: (decoded: ReturnType<typeof decodeItemReport>) => {
      expect(decoded.kind).toBe("metadata-consistency");
      // `d` passes through in the product's order (10.7 fixes none).
      expect(decoded.metadata).toEqual({
        before: {
          present: true,
          d: ["specs/A.mdx#t2", "specs/A.mdx#t1"],
          coverage: "required",
          tags: ["a", "b"],
        },
        after: {
          present: true,
          d: ["specs/A.mdx#t2", "specs/A.mdx#t3"],
          coverage: "none",
          tags: ["b", "c"],
        },
      });
    },
    alsoGood: [
      {
        label:
          "after side absent: the scope node deleted, the side carrying no metadata (SPEC 10.7; T10.7-13(d))",
        doc: put(
          put(
            omit(GOOD_METADATA_ITEM, "scope", "sourceRange"),
            false,
            "scope",
            "present",
          ),
          { present: false },
          "metadata",
          "after",
        ),
        verify: (decoded: ReturnType<typeof decodeItemReport>) => {
          expect(decoded.metadata?.after).toEqual({ present: false });
          expect(decoded.metadata?.before.present).toBe(true);
        },
      },
      {
        label:
          "empty `d` set and tagless sides: the empty arrays (SPEC 12.7: `[]` for a tagless section)",
        doc: put(
          put(
            put(GOOD_METADATA_ITEM, [], "metadata", "before", "d"),
            [],
            "metadata",
            "before",
            "tags",
          ),
          [],
          "metadata",
          "after",
          "tags",
        ),
        verify: (decoded: ReturnType<typeof decodeItemReport>) => {
          expect(decoded.metadata?.before).toEqual({
            present: true,
            d: [],
            coverage: "required",
            tags: [],
          });
        },
      },
      {
        label:
          "another kind: no metadata member required, and one carried is never read (SPEC 10.7: the pair is a metadata-consistency item's)",
        doc: put(GOOD_ITEM, { before: 42 }, "metadata"),
        verify: (decoded: ReturnType<typeof decodeItemReport>) => {
          expect(decoded.kind).toBe("parent-consistency");
          expect(decoded.metadata).toBeUndefined();
        },
      },
    ],
    bad: [
      {
        label: "metadata-consistency item without its metadata pair",
        doc: omit(GOOD_METADATA_ITEM, "metadata"),
      },
      {
        label: "metadata pair null (required information, never defaulted)",
        doc: put(GOOD_METADATA_ITEM, null, "metadata"),
      },
      {
        label: "metadata pair missing its before side",
        doc: omit(GOOD_METADATA_ITEM, "metadata", "before"),
      },
      {
        label: "metadata pair missing its after side",
        doc: omit(GOOD_METADATA_ITEM, "metadata", "after"),
      },
      {
        label: "metadata side missing its presence",
        doc: omit(GOOD_METADATA_ITEM, "metadata", "after", "present"),
      },
      {
        label: "present side missing its `d` targets",
        doc: omit(GOOD_METADATA_ITEM, "metadata", "before", "d"),
      },
      {
        label: "present side's `d` targets holding a non-identity",
        doc: put(GOOD_METADATA_ITEM, [7], "metadata", "before", "d"),
      },
      {
        label: "present side missing its coverage attribute",
        doc: omit(GOOD_METADATA_ITEM, "metadata", "after", "coverage"),
      },
      {
        label:
          'coverage attribute outside the two tokens (12.7: "required" or "none", asserted literally)',
        doc: put(
          GOOD_METADATA_ITEM,
          "optional",
          "metadata",
          "after",
          "coverage",
        ),
      },
      {
        label: 'coverage attribute in another casing ("None", never adapted)',
        doc: put(GOOD_METADATA_ITEM, "None", "metadata", "after", "coverage"),
      },
      {
        label: "coverage attribute as a boolean (never adapted, H-3)",
        doc: put(GOOD_METADATA_ITEM, false, "metadata", "after", "coverage"),
      },
      {
        label: "present side missing its tags",
        doc: omit(GOOD_METADATA_ITEM, "metadata", "before", "tags"),
      },
      {
        label:
          "tag set out of byte order (12.7: a tag set in byte order, never re-sorted)",
        doc: put(GOOD_METADATA_ITEM, ["b", "a"], "metadata", "before", "tags"),
      },
      {
        label:
          "tag set repeating a tag (12.7: duplicates collapsed, never de-duplicated)",
        doc: put(
          GOOD_METADATA_ITEM,
          ["b", "b", "c"],
          "metadata",
          "after",
          "tags",
        ),
      },
      {
        label: "tags null (12.7: null never encodes emptiness)",
        doc: put(GOOD_METADATA_ITEM, null, "metadata", "after", "tags"),
      },
      {
        label: "absent side carrying `d` targets (contradiction)",
        doc: put(
          GOOD_METADATA_ITEM,
          { present: false, d: ["specs/A.mdx#t2"] },
          "metadata",
          "after",
        ),
      },
      {
        label: "absent side carrying a coverage attribute (contradiction)",
        doc: put(
          GOOD_METADATA_ITEM,
          { present: false, coverage: "required" },
          "metadata",
          "after",
        ),
      },
      {
        label: "absent side carrying tags (contradiction)",
        doc: put(
          GOOD_METADATA_ITEM,
          { present: false, tags: [] },
          "metadata",
          "before",
        ),
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
      {
        label:
          "a metadata-consistency item carrying its metadata pair (SPEC 10.7; T10.7-7, T10.7-13)",
        doc: { fullyResolved: false, item: GOOD_METADATA_ITEM },
        verify: (decoded: ReturnType<typeof decodeNextReport>) => {
          expect(decoded.item?.metadata?.after).toEqual({
            present: true,
            d: ["specs/A.mdx#t2", "specs/A.mdx#t3"],
            coverage: "none",
            tags: ["b", "c"],
          });
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
      {
        label:
          "metadata-consistency item without its metadata pair (SPEC 10.7; T10.7-7, T10.7-13)",
        doc: {
          fullyResolved: false,
          item: omit(GOOD_METADATA_ITEM, "metadata"),
        },
      },
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
    alsoGood: [
      {
        label:
          "a metadata-consistency item carrying its metadata pair beside another kind's item (SPEC 10.7; T10.7-13)",
        doc: put(GOOD_EXPORT, [GOOD_ITEM, GOOD_METADATA_ITEM], "items"),
        verify: (decoded: ReturnType<typeof decodeExportReport>) => {
          expect(decoded.items[0].metadata).toBeUndefined();
          expect(decoded.items[1].metadata?.before).toEqual({
            present: true,
            d: ["specs/A.mdx#t2", "specs/A.mdx#t1"],
            coverage: "required",
            tags: ["a", "b"],
          });
        },
      },
      {
        label:
          "recorded decompositions decoded to each one's kind and scope node, in the product's order, another product-shaped member passed over (SPEC 10.7; T10.4-4)",
        doc: put(
          GOOD_EXPORT,
          [
            {
              kind: "subtree-coherence",
              scope: "specs/A.mdx#b",
              recordedAt: 3,
            },
            { kind: "subtree-coherence", scope: "specs/A.mdx#a" },
          ],
          "decompositions",
        ),
        verify: (decoded: ReturnType<typeof decodeExportReport>) => {
          expect(decoded.decompositions).toEqual([
            { kind: "subtree-coherence", scope: "specs/A.mdx#b" },
            { kind: "subtree-coherence", scope: "specs/A.mdx#a" },
          ]);
        },
      },
      {
        label:
          "recorded decompositions null: none recorded, decoded as the empty list",
        doc: put(GOOD_EXPORT, null, "decompositions"),
        verify: (decoded: ReturnType<typeof decodeExportReport>) => {
          expect(decoded.decompositions).toEqual([]);
        },
      },
    ],
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
      {
        label: "recorded decompositions an object, not a list",
        doc: put(
          GOOD_EXPORT,
          { kind: "subtree-coherence", scope: "specs/A.mdx#a" },
          "decompositions",
        ),
      },
      {
        label: "recorded decompositions a string",
        doc: put(GOOD_EXPORT, "specs/A.mdx#a", "decompositions"),
      },
      {
        label: "a recorded decomposition that is a bare identity, no object",
        doc: put(GOOD_EXPORT, ["specs/A.mdx#a"], "decompositions"),
      },
      {
        label: "a recorded decomposition without its scope node (SPEC 10.7)",
        doc: put(
          GOOD_EXPORT,
          [{ kind: "subtree-coherence" }],
          "decompositions",
        ),
      },
      {
        label: "a recorded decomposition whose scope node is null",
        doc: put(
          GOOD_EXPORT,
          [{ kind: "subtree-coherence", scope: null }],
          "decompositions",
        ),
      },
      {
        label: "a recorded decomposition whose scope node is no string",
        doc: put(
          GOOD_EXPORT,
          [{ kind: "subtree-coherence", scope: ["specs/A.mdx#a"] }],
          "decompositions",
        ),
      },
      {
        label: "a recorded decomposition whose scope node is empty",
        doc: put(
          GOOD_EXPORT,
          [{ kind: "subtree-coherence", scope: "" }],
          "decompositions",
        ),
      },
      {
        label: "a recorded decomposition without its kind (SPEC 10.7)",
        doc: put(GOOD_EXPORT, [{ scope: "specs/A.mdx#a" }], "decompositions"),
      },
      {
        label: "a recorded decomposition whose kind is no item kind",
        doc: put(
          GOOD_EXPORT,
          [{ kind: "subtree", scope: "specs/A.mdx#a" }],
          "decompositions",
        ),
      },
      {
        label:
          "a well-formed recorded decomposition beside one lacking its scope node",
        doc: put(
          GOOD_EXPORT,
          [
            { kind: "subtree-coherence", scope: "specs/A.mdx#a" },
            { kind: "subtree-coherence", node: "specs/A.mdx#b" },
          ],
          "decompositions",
        ),
      },
      { label: "missing items", doc: omit(GOOD_EXPORT, "items") },
      {
        label: "item missing status",
        doc: omit(GOOD_EXPORT, "items", 0, "status"),
      },
      {
        label:
          "metadata-consistency item without its metadata pair (SPEC 10.7; T10.7-13)",
        doc: put(
          GOOD_EXPORT,
          [GOOD_ITEM, omit(GOOD_METADATA_ITEM, "metadata")],
          "items",
        ),
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

// --- review item IDs: 12.0's well-formed argument values (T10.2-1) ----------

/**
 * Every place the `review` family presents an item ID (SPEC 10.2; the
 * adapter's assumed shape, review.ts): `decode(id)` stages `id` there in a
 * well-shaped document, decodes it, and returns the decoded value at that
 * place; `path` is the JSON path a rejection names.
 */
const ITEM_ID_SITES: readonly {
  readonly label: string;
  readonly path: string;
  readonly decode: (id: string) => string | undefined;
}[] = [
  {
    label: "a `review status` row's id",
    path: "$.items[0].id",
    decode: (id) =>
      decodeSessionStatusReport(put(GOOD_SESSION_STATUS, id, "items", 0, "id"))
        .items[0]?.id,
  },
  {
    label: "a `review show` item's id",
    path: "$.id",
    decode: (id) => decodeItemReport(put(GOOD_ITEM, id, "id")).id,
  },
  {
    label: "a `review show` item's second blockedBy entry",
    path: "$.blockedBy[1]",
    decode: (id) =>
      decodeItemReport(put(GOOD_ITEM, ["item-0", id], "blockedBy"))
        .blockedBy[1],
  },
  {
    label: "a `review next` item's id",
    path: "$.item.id",
    decode: (id) => decodeNextReport(put(GOOD_NEXT, id, "item", "id")).item?.id,
  },
  {
    label: "a `review next` item's blockedBy entry",
    path: "$.item.blockedBy[0]",
    decode: (id) =>
      decodeNextReport(put(GOOD_NEXT, [id], "item", "blockedBy")).item
        ?.blockedBy[0],
  },
  {
    label: "a `review export` item's id",
    path: "$.items[0].id",
    decode: (id) =>
      decodeExportReport(put(GOOD_EXPORT, id, "items", 0, "id")).items[0]?.id,
  },
  {
    label: "a `review export` item's blockedBy entry",
    path: "$.items[0].blockedBy[0]",
    decode: (id) =>
      decodeExportReport(put(GOOD_EXPORT, [id], "items", 0, "blockedBy"))
        .items[0]?.blockedBy[0],
  },
];

// The exotic characters, built from their code points (no escape in this
// file's text): U+FFFD, and the two halves of U+1F600's surrogate pair.
const ID_REPLACEMENT = String.fromCodePoint(0xfffd);
const ID_HIGH_SURROGATE = String.fromCharCode(0xd83d);
const ID_LOW_SURROGATE = String.fromCharCode(0xde00);

/** Item IDs 12.0's argument-value rule bars, each with the defect named. */
const MALFORMED_ITEM_IDS: readonly {
  readonly label: string;
  readonly id: string;
  readonly defect: string;
}[] = [
  {
    label: "U+FFFD alone",
    id: ID_REPLACEMENT,
    defect: "U+FFFD at UTF-16 index 0",
  },
  {
    label: "U+FFFD inside",
    id: `item-${ID_REPLACEMENT}1`,
    defect: "U+FFFD at UTF-16 index 5",
  },
  {
    label: "a lone high surrogate at the end",
    id: `item-1${ID_HIGH_SURROGATE}`,
    defect: "an unpaired surrogate at UTF-16 index 6",
  },
  {
    label: "a lone low surrogate at the start",
    id: `${ID_LOW_SURROGATE}item-1`,
    defect: "an unpaired surrogate at UTF-16 index 0",
  },
  {
    label: "a surrogate pair's halves reversed",
    id: `item-${ID_LOW_SURROGATE}${ID_HIGH_SURROGATE}`,
    defect: "an unpaired surrogate at UTF-16 index 5",
  },
  {
    label: "U+FFFD and a lone surrogate",
    id: `${ID_REPLACEMENT}${ID_HIGH_SURROGATE}`,
    defect:
      "U+FFFD at UTF-16 index 0 and an unpaired surrogate at UTF-16 index 1",
  },
];

/** Item IDs that are well-formed argument values, however exotic. */
const WELL_FORMED_ITEM_IDS: readonly {
  readonly label: string;
  readonly id: string;
}[] = [
  {
    label: "an astral character, a surrogate pair",
    id: `item-${ID_HIGH_SURROGATE}${ID_LOW_SURROGATE}`,
  },
  {
    label: "the noncharacter U+FFFF",
    id: `item-${String.fromCodePoint(0xffff)}`,
  },
  {
    label: "U+FFFC, U+FFFD's neighbor",
    id: `item-${String.fromCodePoint(0xfffc)}`,
  },
];

test("S-5: every review decode of an item ID — a status row's, an item's at show, next, and export, and each blockedBy entry — rejects one that is no well-formed argument value (U+FFFD, an unpaired surrogate) and passes every other through (SPEC 10.2, 12.0; T10.2-1)", () => {
  for (const site of ITEM_ID_SITES) {
    for (const { label, id } of WELL_FORMED_ITEM_IDS) {
      expect(site.decode(id), `${site.label}: ${label}`).toBe(id);
    }
    for (const { label, id, defect } of MALFORMED_ITEM_IDS) {
      const failure = expectDiagnosed(`${site.label}: ${label}`, () =>
        site.decode(id),
      );
      expect(failure.message).toContain(
        `at ${site.path}: expected an item ID that is a well-formed ` +
          `argument value (SPEC 10.2, 12.0`,
      );
      expect(failure.message).toContain(`not one holding ${defect}`);
    }
  }
});

test("S-5: requireScopeNodes returns every scope node an item's payload presents at show, next, and export, and fails diagnosed — naming the item and the member — where a payload presents none, never reading the scope root alone as the scope (SPEC 10.4, 10.7; T10.5-5)", () => {
  const scopeNodes = [
    {
      node: "specs/A.mdx#login",
      present: true,
      sourceRange: { start: 12, end: 96 },
    },
    {
      node: "specs/A.mdx#login.validCredentials",
      present: true,
      sourceRange: { start: 30, end: 60 },
    },
  ];
  const withNodes = put(
    put(GOOD_ITEM, "subtree-coherence", "kind"),
    scopeNodes,
    "scopeNodes",
  );
  const presenting = [
    decodeItemReport(withNodes),
    decodeNextReport(put(GOOD_NEXT, withNodes, "item")).item,
    decodeExportReport(put(GOOD_EXPORT, [withNodes], "items")).items[0],
  ];
  for (const item of presenting) {
    expect(item).toBeDefined();
    expect(requireScopeNodes(item!, "S-5 probe")).toEqual(scopeNodes);
  }
  const lacking = [
    decodeItemReport(GOOD_ITEM),
    decodeNextReport(GOOD_NEXT).item,
    decodeExportReport(GOOD_EXPORT).items[0],
  ];
  for (const item of lacking) {
    expect(item).toBeDefined();
    const failure = expectDiagnosed("a payload presenting no scope nodes", () =>
      requireScopeNodes(item!, "S-5 probe"),
    );
    expect(failure.message).toContain("S-5 probe: item item-1's payload");
    expect(failure.message).toContain('"scopeNodes"');
  }
});

test("S-5: decodeRecordedState reads an item's baseline and current as node entries — each node's identity, presence, and hashes under 5.5's names or the explicit absent marker — from the assumed RecordedState shape at show, next, and export, value-blind, and fails diagnosed on any other shape, naming the item and the offending member, never reading a state as holding no entries (SPEC 10.2, 10.4; T10.5-8)", () => {
  // The assumed shape (review.ts): one member per recorded node under
  // "nodes", keyed by identity — a present node with its relevant hashes, a
  // node whose presence alone is recorded (`{}`), an absent node with the
  // marker "absent" — and a hash object's other members passed over.
  const state = {
    nodes: {
      "specs/A.mdx": {
        present: true,
        hashes: { subtreeHash: "sub-r", metadataHash: "meta-r" },
      },
      "specs/A.mdx#login": { present: true, hashes: {} },
      "specs/A.mdx#gone": { present: false, hashes: "absent" },
      "specs/A.mdx#odd": {
        present: true,
        hashes: { ownHash: "own-o", effectiveHash: "eff-o", extra: 7 },
      },
    },
  };
  const entries = [
    {
      node: "specs/A.mdx",
      present: true,
      absentMarker: false,
      hashes: { subtreeHash: "sub-r", metadataHash: "meta-r" },
    },
    {
      node: "specs/A.mdx#login",
      present: true,
      absentMarker: false,
      hashes: {},
    },
    {
      node: "specs/A.mdx#gone",
      present: false,
      absentMarker: true,
      hashes: {},
    },
    {
      node: "specs/A.mdx#odd",
      present: true,
      absentMarker: false,
      hashes: { ownHash: "own-o", effectiveHash: "eff-o" },
    },
  ];
  const recordedItem = put(put(GOOD_ITEM, state, "baseline"), state, "current");
  const presenting = [
    decodeItemReport(recordedItem),
    decodeNextReport(put(GOOD_NEXT, recordedItem, "item")).item,
    decodeExportReport(put(GOOD_EXPORT, [recordedItem], "items")).items[0],
  ];
  for (const item of presenting) {
    expect(item).toBeDefined();
    for (const field of ["baseline", "current"] as const) {
      expect(decodeRecordedState(item!, field, "S-5 probe")).toEqual(entries);
    }
  }
  // Value-blind: contradictory entries — an absent node's hashes recorded
  // as values, a present node's as the marker — decode as recorded, for the
  // tests to judge (T10.5-8: never d's current hashes).
  const contradictory = {
    nodes: {
      "specs/A.mdx#d": { present: false, hashes: { subtreeHash: "sub-d" } },
      "specs/A.mdx#e": { present: true, hashes: "absent" },
    },
  };
  expect(
    decodeRecordedState(
      decodeItemReport(put(GOOD_ITEM, contradictory, "baseline")),
      "baseline",
      "S-5 probe",
    ),
  ).toEqual([
    {
      node: "specs/A.mdx#d",
      present: false,
      absentMarker: false,
      hashes: { subtreeHash: "sub-d" },
    },
    { node: "specs/A.mdx#e", present: true, absentMarker: true, hashes: {} },
  ]);
  const gone = ["nodes", "specs/A.mdx#gone"] as const;
  const root = ["nodes", "specs/A.mdx"] as const;
  const rejected: readonly {
    readonly label: string;
    readonly item: unknown;
    readonly field: "baseline" | "current";
    readonly at: string;
  }[] = [
    {
      label: "an opaque state holding no nodes member",
      item: GOOD_ITEM,
      field: "baseline",
      at: "$.baseline.nodes",
    },
    {
      label: "a null state",
      item: put(GOOD_ITEM, state, "baseline"),
      field: "current",
      at: "$.current",
    },
    {
      label: "nodes an array",
      item: put(GOOD_ITEM, { nodes: [] }, "baseline"),
      field: "baseline",
      at: "$.baseline.nodes",
    },
    {
      label: "an entry lacking its presence",
      item: put(GOOD_ITEM, omit(state, ...gone, "present"), "baseline"),
      field: "baseline",
      at: '$.baseline.nodes."specs/A.mdx#gone".present',
    },
    {
      label: "a stringly-typed presence",
      item: put(GOOD_ITEM, put(state, "false", ...gone, "present"), "baseline"),
      field: "baseline",
      at: '$.baseline.nodes."specs/A.mdx#gone".present',
    },
    {
      label: "an absent entry lacking its hashes",
      item: put(GOOD_ITEM, omit(state, ...gone, "hashes"), "baseline"),
      field: "baseline",
      at: '$.baseline.nodes."specs/A.mdx#gone".hashes',
    },
    {
      label: "null hashes in place of the marker",
      item: put(GOOD_ITEM, put(state, null, ...gone, "hashes"), "baseline"),
      field: "baseline",
      at: '$.baseline.nodes."specs/A.mdx#gone".hashes',
    },
    {
      label: "another marker spelling",
      item: put(GOOD_ITEM, put(state, "gone", ...gone, "hashes"), "baseline"),
      field: "baseline",
      at: '$.baseline.nodes."specs/A.mdx#gone".hashes',
    },
    {
      label: "hashes an array",
      item: put(
        GOOD_ITEM,
        put(state, ["sub-r"], ...root, "hashes"),
        "baseline",
      ),
      field: "baseline",
      at: '$.baseline.nodes."specs/A.mdx".hashes',
    },
    {
      label: "an empty hash",
      item: put(
        GOOD_ITEM,
        put(state, "", ...root, "hashes", "subtreeHash"),
        "baseline",
      ),
      field: "baseline",
      at: '$.baseline.nodes."specs/A.mdx".hashes.subtreeHash',
    },
    {
      label: "a numeric hash",
      item: put(
        GOOD_ITEM,
        put(state, 7, ...root, "hashes", "metadataHash"),
        "baseline",
      ),
      field: "baseline",
      at: '$.baseline.nodes."specs/A.mdx".hashes.metadataHash',
    },
    {
      label: "an entry not an object",
      item: put(GOOD_ITEM, put(state, true, ...root), "baseline"),
      field: "baseline",
      at: '$.baseline.nodes."specs/A.mdx"',
    },
    {
      label: "an empty identity",
      item: put(
        GOOD_ITEM,
        { nodes: { "": { present: true, hashes: {} } } },
        "baseline",
      ),
      field: "baseline",
      at: '$.baseline.nodes.""',
    },
  ];
  for (const { label, item, field, at: where } of rejected) {
    const decoded = decodeItemReport(item);
    const failure = expectDiagnosed(label, () =>
      decodeRecordedState(decoded, field, "S-5 probe"),
    );
    expect(failure.message).toContain(
      `review item ${field} (S-5 probe: item item-1) adapter`,
    );
    expect(failure.message).toContain(`at ${where}:`);
  }
});

test("S-5: the usage-error conditions 14.24–14.26 decode as the error document's code and are rejected in a findings array as usage errors, never as unknown tokens", () => {
  // SPEC 14.24–14.26 are usage errors (12.0): each stable code is carried
  // only as the exit-2 error document's `code` (12.7; T14-6, T12.7-3), in
  // no findings array. The findings-array rejection must be the
  // usage-error rule's — a decoder not knowing the token at all rejects it
  // too, but as an unknown code, and would then also reject the error
  // document carrying it.
  const cases = [
    { code: "write-failure", condition: "14.24", path: ".xspec" },
    { code: "read-failure", condition: "14.25", path: "specs/sub" },
    { code: "workspace-busy", condition: "14.26", path: ".xspec/lock" },
  ] as const;
  for (const { code, condition, path } of cases) {
    const finding = {
      code,
      message: `a ${code} usage error`,
      locations: [],
      path,
      identities: [],
    };
    const decoded = decodeErrorDocument({ error: finding });
    expect(decoded.error.code).toBe(code);
    expect(decoded.error.condition).toBe(condition);
    expect(decoded.error.path).toBe(path);
    const failure = expectDiagnosed(`${code} in a findings array`, () =>
      decodeFindingsReport({ findings: [finding] }),
    );
    expect(failure.message).toContain("at $.findings[0].code:");
    expect(failure.message).toContain(
      "are usage errors carried only as the exit-2 error document's code",
    );
    expect(failure.message).toContain(`${code} (${condition})`);
  }
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
  // 14's listed order, not lexicographic: refused-missing-target-parent
  // (7th listed) precedes refused-invalid-destination (8th) although "m"
  // sorts after "i"; refused-exposed-derived-file (9th) follows
  // refused-invalid-destination and precedes refused-invalid-rewrite (10th)
  // although "e" sorts before "i" (T6.5-21's multi-reason order, T12.7-2);
  // the two codes 14 lists last follow in its order, refused-invalid-rewrite
  // (10th) then refused-moved-import (11th).
  const refusalSeventh = findingWith({
    code: "refused-missing-target-parent",
  });
  const refusalEighth = findingWith({ code: "refused-invalid-destination" });
  const refusalNinth = findingWith({ code: "refused-exposed-derived-file" });
  const refusalTenth = findingWith({ code: "refused-invalid-rewrite" });
  const refusalEleventh = findingWith({ code: "refused-moved-import" });
  expect(compareFindings(refusalLater, refusalSeventh)).toBeLessThan(0);
  expect(compareFindings(refusalSeventh, refusalEighth)).toBeLessThan(0);
  expect(compareFindings(refusalEighth, refusalNinth)).toBeLessThan(0);
  expect(compareFindings(refusalNinth, refusalTenth)).toBeLessThan(0);
  expect(compareFindings(refusalTenth, refusalEleventh)).toBeLessThan(0);
  // The reversed pairs around refused-exposed-derived-file rank the other
  // way, and it ranks after the last numbered condition (14.26's token —
  // never in a findings array, but the comparator's rank is total).
  expect(compareFindings(refusalNinth, refusalEighth)).toBeGreaterThan(0);
  expect(compareFindings(refusalTenth, refusalNinth)).toBeGreaterThan(0);
  expect(
    compareFindings(findingWith({ code: "read-failure" }), refusalNinth),
  ).toBeLessThan(0);
  expect(
    compareFindings(findingWith({ code: "workspace-busy" }), refusalNinth),
  ).toBeLessThan(0);
  // The usage-error conditions rank in numeric order like every numbered
  // condition: 14.23, then 14.24, 14.25, and 14.26 — the last numbered
  // condition, `workspace-busy` — then the first refusal reason.
  const c14_25 = findingWith({ code: "read-failure" });
  const c14_26 = findingWith({ code: "workspace-busy" });
  expect(
    compareFindings(
      findingWith({ code: "unreadable-record" }),
      findingWith({ code: "write-failure" }),
    ),
  ).toBeLessThan(0);
  expect(
    compareFindings(findingWith({ code: "write-failure" }), c14_25),
  ).toBeLessThan(0);
  expect(compareFindings(c14_25, c14_26)).toBeLessThan(0);
  expect(compareFindings(c14_26, c14_25)).toBeGreaterThan(0);
  expect(compareFindings(c14_26, refusalFirst)).toBeLessThan(0);
  // Code-less findings sort last, after the last listed refusal reason.
  expect(
    compareFindings(refusalLater, findingWith({ code: null })),
  ).toBeLessThan(0);
  expect(
    compareFindings(refusalNinth, findingWith({ code: null })),
  ).toBeLessThan(0);
  expect(
    compareFindings(refusalEleventh, findingWith({ code: null })),
  ).toBeLessThan(0);
  // A code 14 does not list takes no rank: handed to the comparator outside
  // decode (which admits only 14's codes), the retired
  // refused-unresolvable-reference is a harness defect, thrown — never
  // ranked beside a listed code.
  expect(() =>
    compareFindings(
      findingWith({ code: "refused-unresolvable-reference" }),
      refusalEighth,
    ),
  ).toThrow(/harness defect/);
});

test("S-5: the findings decode admits refused-exposed-derived-file and rejects it out of 14's listed order by the order rule", () => {
  // One of 14's codes: admitted alone, a refusal reason deriving no 14.N.
  const alone = decodeFindingsReport({
    findings: [structuredClone(EXPOSED_DERIVED_FILE_FINDING)],
  });
  expect(alone.findings[0]!.code).toBe("refused-exposed-derived-file");
  expect(alone.findings[0]!.condition).toBeNull();
  expect(alone.findings[0]!.path).toBe("specs/A.md");
  // Each reversed pair around it is rejected by the pinned 12.7 order —
  // never as an unknown code, so the rejection is the order's own.
  const invalidRewrite = {
    code: "refused-invalid-rewrite",
    message: "the exact edits would leave specs/B.mdx unparseable",
    locations: [{ file: "specs/A.mdx", range: { start: 12, end: 60 } }],
    path: null,
    identities: ["specs/B.mdx"],
  };
  const reversed = [
    {
      label: "refused-exposed-derived-file before refused-invalid-destination",
      findings: [EXPOSED_DERIVED_FILE_FINDING, INVALID_DESTINATION_FINDING],
    },
    {
      label: "refused-invalid-rewrite before refused-exposed-derived-file",
      findings: [invalidRewrite, EXPOSED_DERIVED_FILE_FINDING],
    },
  ];
  for (const { label, findings } of reversed) {
    const failure = expectDiagnosed(label, () =>
      decodeFindingsReport({ findings: structuredClone(findings) }),
    );
    expect(failure.message).toContain("findings in the pinned 12.7 order");
    expect(failure.message).not.toContain("a stable code");
  }
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

test("S-5: the 12.7 document decoders run the marker walk over the whole document (T12.7-1)", () => {
  // The walk is integrated at every forms.ts document-decode entry point, so
  // it covers members a SCOPED decode otherwise leaves unread — the cases a
  // per-member decode alone can never reject. The inventory recorded-datum
  // decode reads only `recorded`; a near-marker in the unread `journal`
  // member must still reject.
  expectDiagnosed(
    "scoped inventory decode, near-marker in an unread member",
    () =>
      decodeInventoryRecordedDatum(
        { recorded: [], journal: { unavailable: "soon", note: 1 } },
        "walk integration",
      ),
  );
  // The scoped view decode reads each per-file wrapper's `file` and member
  // presence only; a near-marker inside the unread `root` tree must still
  // reject.
  expectDiagnosed("scoped view decode, near-marker in an unread subtree", () =>
    decodeViewFilesReport(
      {
        findings: [],
        views: [
          {
            file: "specs/A.mdx",
            root: { identity: { unavailable: false } },
            imports: [],
            occurrences: [],
            comments: [],
          },
        ],
      },
      "walk integration",
    ),
  );
  // Positive control: a scoped decode over a document whose only
  // unavailable-bearing object is an exact marker passes the integrated walk
  // (the marker is a legitimate value, never a rejection).
  expect(
    decodeInventoryRecordedDatum(
      { recorded: { unavailable: true }, extra: { fine: true } },
      "walk integration",
    ),
  ).toEqual({ state: "unavailable" });
});

// The adjustable adapters' document entries (T12.7-1): the DECODERS entries
// decoding an unpinned-shape surface — query, review, reports, operations;
// everything that is not a form-exact 12.7 or 11.6 document decoder. Each
// runs the marker walk over the whole raw document first
// (`documentRootSite`, forms.ts), so a near-marker in a member the adapter
// never reads — or passes through whole — still rejects, while an exact
// marker there is a legitimate value and decodes.
const UNPINNED_ADAPTER_NAMES: readonly string[] = [
  "query node/show",
  "query node (identity/tags summary)",
  "query node (identity/tags/metadataHash summary)",
  "query node (text-algebra summary)",
  "query nodes (identity/tags summary rows)",
  "query nodes (identity-only rows)",
  "query nodes/subtree/ancestors",
  "query edges",
  "query reachable",
  "ids",
  "ids --tree",
  "coverage",
  "impact",
  "review list",
  "review status",
  "review show (full item)",
  "review next",
  "review export",
];

test("S-5: every adjustable adapter runs the marker walk over the whole document at its entry (T12.7-1)", () => {
  const covered = DECODERS.filter((spec) =>
    UNPINNED_ADAPTER_NAMES.includes(spec.name),
  );
  // Every listed adapter is a DECODERS entry (a renamed entry is caught).
  expect(covered.map((spec) => spec.name).sort()).toEqual(
    [...UNPINNED_ADAPTER_NAMES].sort(),
  );
  for (const spec of covered) {
    // A near-marker in a top-level member no adapter reads: only the walk
    // can reject it, and its diagnosis names the JSON path.
    const nearMarker = expectDiagnosed(
      `${spec.name}: near-marker in an unread member`,
      () =>
        spec.decode(
          put(spec.good, { unavailable: "soon", note: 1 }, "unreadByAdapter"),
        ),
    );
    expect(nearMarker.message).toContain("adapter");
    expect(nearMarker.message).toContain("$.unreadByAdapter");
    expectDiagnosed(`${spec.name}: unavailable false in an unread member`, () =>
      spec.decode(put(spec.good, { unavailable: false }, "unreadByAdapter")),
    );
    // Positive control: an exact marker there is a legitimate value — the
    // adapter decodes the document as before.
    spec.decode(put(spec.good, { unavailable: true }, "unreadByAdapter"));
  }
  // A member passed through whole (an item's recorded `baseline`,
  // product-shaped and opaque, T10.2-2) is walked too: only the walk can
  // reject a near-marker inside it.
  const opaque = expectDiagnosed(
    "review export: near-marker inside the opaque baseline record",
    () =>
      decodeExportReport(
        put(GOOD_EXPORT, { unavailable: 1 }, "items", 0, "baseline"),
        "walk integration",
      ),
  );
  expect(opaque.message).toContain("$.items[0].baseline");
  // The two 1.7 walks take captured documents at their entries as well.
  expectDiagnosed("bare edge-endpoint walk: near-marker in the document", () =>
    assertBareEdgeEndpoints(
      put(GOOD_EDGES, { unavailable: "x" }, "meta"),
      "walk integration",
    ),
  );
  expectDiagnosed(
    "node edge-list walk: near-marker outside the edge lists",
    () =>
      assertNodeEdgeListsBare(
        put(GOOD_NODE, { unavailable: "x" }, "meta"),
        "walk integration",
      ),
  );
  assertBareEdgeEndpoints(
    put(GOOD_EDGES, { unavailable: true }, "meta"),
    "walk integration",
  );
  assertNodeEdgeListsBare(
    put(GOOD_NODE, { unavailable: true }, "meta"),
    "walk integration",
  );
});

// `parseJsonStdout` (helpers/assertions.ts) runs the marker walk over every
// document it parses, decoded by an adapter or not — beside the subprocess
// driver's walk over the captured stdout of every run with JSON output in
// effect (helpers/capture-walk.ts, guarded by S-3), the two integrations by
// which the walk covers every JSON document the suite captures (T12.7-1): a
// near-marker in a document no decoder reads — a `review create` success
// document, say — still rejects, the diagnosis naming the JSON path and the
// command line.
test("S-5: parseJsonStdout runs the marker walk over every document it parses (T12.7-1)", () => {
  const nearMarkers: readonly {
    readonly label: string;
    readonly value: unknown;
  }[] = [
    { label: "unavailable false", value: { unavailable: false } },
    { label: "marker with a sibling", value: { unavailable: true, x: 1 } },
  ];
  const placements: readonly {
    readonly label: string;
    readonly document: (value: unknown) => unknown;
    readonly path: string;
  }[] = [
    {
      label: "nested in an object member",
      document: (value) => ({ created: { item: { source: value } } }),
      path: "$.created.item.source",
    },
    {
      label: "an array element",
      document: (value) => ({ nodes: [{ identity: "specs/A.mdx" }, value] }),
      path: "$.nodes[1]",
    },
  ];
  const stdoutOf = (document: unknown): RunResult =>
    syntheticResult(`${JSON.stringify(document, null, 2)}\n`);
  for (const near of nearMarkers) {
    for (const place of placements) {
      const failure = expectDiagnosed(`${near.label}, ${place.label}`, () =>
        parseJsonStdout(stdoutOf(place.document(near.value)), "walk vector"),
      );
      expect(failure.message).toContain(`at ${place.path}: expected`);
      expect(failure.message).toContain("`stand-in check` [synthetic result]");
      expect(failure.message).toContain("walk vector");
    }
  }
  // A stray member on the document itself, no caller context given.
  const topLevel = expectDiagnosed("stray top-level member", () =>
    parseJsonStdout(stdoutOf({ created: { name: "r" }, unavailable: false })),
  );
  expect(topLevel.message).toContain("at $: expected");
  expect(topLevel.message).toContain("`stand-in check` [synthetic result]");
  // Positive control: an exact marker in the same places is a legitimate
  // value, and the parsed document is returned.
  for (const place of placements) {
    const document = place.document({ unavailable: true });
    expect(parseJsonStdout(stdoutOf(document), "walk vector")).toEqual(
      document,
    );
  }
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

test("S-5: human-report omission matcher accepts a report without the named information and rejects one carrying it", () => {
  // An empty listing in free wording, naming its glob but no file (H-3).
  const emptyListing = "No requirement IDs in files matching --json.\n";
  assertReportOmits(
    emptyListing,
    ["specs/A.mdx", conditionMention("14.2")],
    "string form",
  );
  // RunResult form reads stdout alone (12.0: reports are stdout content):
  // a mention on stderr only is not in the report.
  assertReportOmits(
    syntheticResult(emptyListing),
    ["specs/A.mdx"],
    "RunResult form",
  );
  assertReportOmits(
    syntheticResult(emptyListing, "note: specs/A.mdx\n"),
    ["specs/A.mdx", conditionMention("14.2")],
    "stderr is not the report stream",
  );
  // An empty report carries no information at all.
  assertReportOmits("", ["specs/A.mdx"], "empty report text");
  assertReportOmits(syntheticResult(""), ["specs/A.mdx"], "empty stdout");

  // A string mention present: the message names it and the context.
  const literal = expectDiagnosed("string mention present", () =>
    assertReportOmits(
      "specs/A.mdx\n  a\n",
      ["specs/A.mdx"],
      "restricted listing",
    ),
  );
  expect(literal.message).toContain('Present: "specs/A.mdx"');
  expect(literal.message).toContain("restricted listing");

  // A pattern mention matched, in the RunResult form: only the present
  // mention is listed, with the run's command line.
  const condition = conditionMention("14.2");
  const pattern = expectDiagnosed("pattern mention present", () =>
    assertReportOmits(
      syntheticResult("error 14.2 in specs/B.mdx\n"),
      ["specs/A.mdx", condition],
      "pattern report",
    ),
  );
  expect(pattern.message).toContain(`Present: pattern ${condition.toString()}`);
  expect(pattern.message).not.toContain('"specs/A.mdx"');
  expect(pattern.message).toContain("pattern report");
  expect(pattern.message).toContain("stand-in check");

  // Every present mention is listed.
  const both = expectDiagnosed("two mentions present", () =>
    assertReportOmits(
      "specs/A.mdx#a\n",
      ["specs/A.mdx", /#a\b/],
      "two present",
    ),
  );
  expect(both.message).toContain('Present: "specs/A.mdx", pattern /#a\\b/');

  // A mention-less assertion checks nothing and is itself a defect.
  expectDiagnosed("empty mention list", () =>
    assertReportOmits("anything", [], "empty assertion"),
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

// The human-report parity matchers (test/helpers/adapters/human.ts's
// header; TEST-SPEC T12.0-1, H-3): token-bounded literal data, whole numbers
// matched after blanking, SPEC-named tokens, and stable codes. Every vector
// runs through assertReportMentions itself — found, the call returns; not
// found, it fails diagnosed — and each table reports every vector it gets
// wrong at once, so a broken boundary rule names each vector it flips.

/** One matcher vector: a report text, a mention, and whether it is found. */
interface MentionVector {
  readonly text: string;
  readonly mention: Mention;
  readonly found: boolean;
  readonly blank?: readonly string[];
}

/** One mention's vectors: the texts it is found in, and those it is not. */
function mentionVectors(
  mention: Mention,
  foundIn: readonly string[],
  notFoundIn: readonly string[],
  blank?: readonly string[],
): MentionVector[] {
  return [
    ...foundIn.map((text) => ({ text, mention, found: true, blank })),
    ...notFoundIn.map((text) => ({ text, mention, found: false, blank })),
  ];
}

function mentionLabel(mention: Mention): string {
  if (typeof mention === "string") return JSON.stringify(mention);
  if (mention instanceof RegExp) return mention.toString();
  return mention.description;
}

/** Every vector whose outcome differs from its expectation, described. */
function wrongVectors(vectors: readonly MentionVector[]): string[] {
  const wrong: string[] = [];
  for (const vector of vectors) {
    let found = true;
    try {
      assertReportMentions(
        vector.text,
        [vector.mention],
        "matcher vector",
        vector.blank === undefined ? {} : { blank: vector.blank },
      );
    } catch (error) {
      if (!(error instanceof HarnessAssertionError)) throw error;
      found = false;
    }
    if (found !== vector.found) {
      wrong.push(
        `${mentionLabel(vector.mention)} ${found ? "found" : "not found"} in ` +
          JSON.stringify(vector.text) +
          (vector.blank === undefined
            ? ""
            : ` with ${JSON.stringify(vector.blank)} blanked`),
      );
    }
  }
  return wrong;
}

/** Assert every vector's outcome, the failure listing each wrong one. */
function expectVectors(vectors: readonly MentionVector[]): void {
  const wrong = wrongVectors(vectors);
  expect(wrong, `wrong vectors:\n${wrong.join("\n")}`).toEqual([]);
}

test("S-5: identityMention bounds an identity or path — never inside a longer identity or path", () => {
  expectVectors([
    ...mentionVectors(
      identityMention("specs/T.mdx#p"),
      [
        "x specs/T.mdx#p y",
        "(specs/T.mdx#p)",
        // A sentence may end on an identity.
        "specs/T.mdx#p.",
        "the scope is specs/T.mdx#p.",
        "specs/T.mdx#p",
        "[specs/T.mdx#p]",
        "specs/T.mdx#p: changed",
        "scope: specs/T.mdx#p (present)\n",
        "specs/T.mdx#p, specs/T.mdx#q",
        // A bounded occurrence after an unbounded one still counts.
        "specs/T.mdx#pa specs/T.mdx#p",
      ],
      [
        // A descendant's identity, a sibling segment's.
        "specs/T.mdx#p.a",
        "specs/T.mdx#p-b",
        "specs/T.mdx#pa",
        "specs/T.mdx#p_a",
        "specs/T.mdx#p9",
        "specs/T.mdx#p/x",
        "specs/T.mdx#p#x",
        // Inside a longer path or word.
        "xspecs/T.mdx#p",
        "out/specs/T.mdx#p",
        ".specs/T.mdx#p",
        "-specs/T.mdx#p",
        "_specs/T.mdx#p",
        "9specs/T.mdx#p",
        "",
      ],
    ),
    ...mentionVectors(
      identityMention("specs/T.mdx"),
      [
        "specs/T.mdx:",
        "specs/T.mdx:40-78: message",
        "root specs/T.mdx\n",
        '"specs/T.mdx"',
      ],
      [
        // A root's bare path inside its sections' identities.
        "specs/T.mdx#p",
        "out/specs/T.mdx",
        "specs/T.mdx/x",
        "specs/T.mdx.bak",
        "specs/T.mdx-x",
        "specs/T.mdxx",
      ],
    ),
  ]);
});

test("S-5: nameMention bounds a session name or item id — never inside a longer name or id", () => {
  expectVectors([
    ...mentionVectors(
      nameMention("a"),
      [
        "a audit",
        "a",
        "(a)",
        "a: corrupt",
        "name=a",
        "session a.",
        "B\na\na2\n",
      ],
      [
        "a2",
        "ba",
        "path",
        "a-b",
        "b-a",
        "a_b",
        "_a",
        "a.b",
        "audit path-blocks",
      ],
    ),
    ...mentionVectors(
      nameMention("item-1"),
      [
        "item-1",
        "item item-1\n",
        "blockedBy: item-1, item-2",
        "[item-1]",
        "item-1.",
      ],
      ["item-10", "item-12", "xitem-1", "item-1-2", "item-1.5", "item-1_x"],
    ),
  ]);
});

test("S-5: spellingMention bounds a quoted spelling by letters and digits", () => {
  expectVectors([
    ...mentionVectors(
      spellingMention("div"),
      ["<div>", "element div.", "`div`", "div"],
      ["divide", "adiv", "div2", "2div", "Xdiv"],
    ),
    ...mentionVectors(
      spellingMention("two seg"),
      ['segment "two seg" holds whitespace', "two seg"],
      ["two segs", "atwo seg", "two seg2"],
    ),
    ...mentionVectors(
      spellingMention("absent.dep"),
      ["target absent.dep is not found", "(absent.dep)"],
      ["absent.depth", "xabsent.dep", "absent.dep1"],
    ),
    ...mentionVectors(
      spellingMention("OK.absent"),
      ["text(OK.absent)"],
      ["BOOK.absent", "OK.absently"],
    ),
  ]);
});

test("S-5: numberMention matches a whole number, after blanking the data that hold digits", () => {
  expectVectors([
    ...mentionVectors(
      numberMention(4),
      ["unresolved=4", "(4)", "4", "range: 4-12", "4 items"],
      ["14", "40", "404", "", "four"],
    ),
    ...mentionVectors(
      numberMention(0),
      ["no-change=0", "0-7"],
      ["10", "01", "100"],
    ),
    // A digit inside a blanked datum never stands in for the number.
    ...mentionVectors(
      numberMention(4),
      ["item-4 unresolved=4"],
      ["item-4 unresolved"],
      ["item-4"],
    ),
    // Longest datum first: `item-10` is blanked whole, never as `item-1`
    // leaving its `0`.
    ...mentionVectors(
      numberMention(0),
      ["item-10 updated=0"],
      ["item-10 unresolved"],
      ["item-1", "item-10"],
    ),
    // One space per occurrence: the text on either side stays apart, so
    // no two digits join into one number.
    ...mentionVectors(numberMention(12), ["12"], ["1a2"], ["a"]),
  ]);

  // The pure blanking: every occurrence one space, longest datum first.
  expect(blankReportData("item-10 item-1 x", ["item-1", "item-10"])).toBe(
    "    x",
  );
  expect(blankReportData("a1 b a1", ["a1"])).toBe("  b  ");
  expect(blankReportData("unchanged", [])).toBe("unchanged");

  // The diagnosis names the run, the data blanked, and the report as given.
  const blanked = expectDiagnosed("a count only inside a blanked id", () =>
    assertReportMentions(
      syntheticResult("item-4 unresolved\n"),
      [numberMention(4)],
      "blanked count",
      { blank: ["item-4"] },
    ),
  );
  expect(blanked.message).toContain("blanked count");
  expect(blanked.message).toContain("Missing: number 4");
  expect(blanked.message).toContain('1 datum ("item-4") blanked out');
  expect(blanked.message).toContain(JSON.stringify("item-4 unresolved\n"));
  expect(blanked.message).toContain("stand-in check");
});

test("S-5: specTokenMention matches a SPEC-named token across case and separators — never inside a longer word or token", () => {
  expectVectors([
    ...mentionVectors(
      specTokenMention("no-change"),
      [
        "no-change",
        "No change",
        "no_change",
        "NOCHANGE",
        "no-change=0",
        "status: No-Change",
      ],
      ["ano-change", "no--change", "no  change", "no-chang", "on-change"],
    ),
    ...mentionVectors(
      specTokenMention("blocked"),
      ["blocked=true", "Blocked:", "(blocked)", "blocked"],
      ["unblocked", "isblocked", "block"],
    ),
    ...mentionVectors(
      specTokenMention("changed"),
      [
        "changed:",
        "Changed",
        "descendant-changed, changed",
        "changed, upstream-changed",
      ],
      [
        "descendant-changed",
        "metadata changed",
        "upstream_changed",
        "unchanged",
        "Metadata-Changed:",
        "DescendantChanged",
      ],
    ),
    ...mentionVectors(
      specTokenMention("direct"),
      ["directly impacted", "direct"],
      ["indirectly"],
    ),
    ...mentionVectors(
      specTokenMention("transitive"),
      ["transitively impacted code:"],
      ["intransitive"],
    ),
    ...mentionVectors(
      specTokenMention("subtree-coherence"),
      [
        "subtree coherence",
        "subtree-coherence",
        "SubtreeCoherence",
        "subtree_coherence",
      ],
      ["subtree", "coherence", "subtree: coherence"],
    ),
    ...mentionVectors(
      specTokenMention("metadata-changed"),
      ["metadata changed", "metadata-changed: specs/T.mdx#p"],
      ["metadata", "changed"],
    ),
  ]);
});

test("S-5: SPEC_NAMED_TOKENS is a closed vocabulary — distinct, well-formed tokens, none counting inside another's spelling", () => {
  expect(new Set(SPEC_NAMED_TOKENS).size).toBe(SPEC_NAMED_TOKENS.length);
  const vectors: MentionVector[] = [];
  for (const token of SPEC_NAMED_TOKENS) {
    expect(token).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
    vectors.push(
      ...mentionVectors(
        specTokenMention(token),
        [token, `${token.toUpperCase()}:`],
        SPEC_NAMED_TOKENS.filter((other) => other !== token),
      ),
    );
  }
  expectVectors(vectors);
});

test("S-5: codeMention matches a stable code across case and separators — never inside a longer word or code", () => {
  expectVectors([
    ...mentionVectors(
      codeMention("refused-invalid-id"),
      [
        "refused-invalid-id:",
        "Refused invalid id",
        "REFUSED_INVALID_ID",
        "[refused-invalid-id]",
        // Its words joined by nothing.
        "RefusedInvalidId",
      ],
      [
        "invalid-id",
        "unrefused-invalid-id",
        "refused-invalid",
        "refused--invalid-id",
      ],
    ),
    ...mentionVectors(
      codeMention("cycle"),
      ["cycle:", "Cycle", "cycles"],
      // Where it ends the longer code refused-cycle, and inside a word.
      ["refused-cycle", "refused cycle", "Refused_Cycle", "recycle"],
    ),
    ...mentionVectors(
      codeMention("missing-id"),
      ["missing ID"],
      ["dismissing-id"],
    ),
  ]);
});

test("S-5: STABLE_CODES is a closed vocabulary — the numbered conditions' codes, then the refusal reasons', distinct, well-formed, none counting inside another's spelling", () => {
  expect(STABLE_CODES).toEqual([
    ...CONDITION_CODE_TOKENS,
    ...REFUSAL_CODE_TOKENS,
  ]);
  expect(STABLE_CODES).toHaveLength(37);
  expect(new Set(STABLE_CODES).size).toBe(STABLE_CODES.length);
  const vectors: MentionVector[] = [];
  for (const code of STABLE_CODES) {
    expect(code).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
    vectors.push(
      ...mentionVectors(
        codeMention(code),
        [code, `${code.toUpperCase()}:`],
        STABLE_CODES.filter((other) => other !== code),
      ),
    );
  }
  expectVectors(vectors);
});

test("S-5: a report missing a stable code fails diagnosed, naming it", () => {
  // A 14.9 cycle finding's report asked for the refusal reason
  // refused-cycle: the shorter code never stands in for the longer.
  const report = syntheticResult(
    "specs/T.mdx:12-20: cycle: specs/T.mdx#p depends on itself\n1 finding\n",
  );
  const failure = expectDiagnosed('stable code "refused-cycle"', () =>
    assertReportMentions(
      report,
      [codeMention("cycle"), codeMention("refused-cycle")],
      "cycle finding",
    ),
  );
  expect(failure.message).toContain('Missing: stable code "refused-cycle"\n');
  expect(failure.message).toContain("cycle finding");
  expect(failure.message).toContain("stand-in check");
  // Present, the code passes beside a datum.
  assertReportMentions(
    report,
    [codeMention("cycle"), identityMention("specs/T.mdx#p")],
    "cycle finding",
  );
  // The omission matcher reads a code the same way: refused-cycle spells
  // no 14.9 cycle, and the cycle finding's report does.
  assertReportOmits(
    syntheticResult("specs/T.mdx:12-20: refused-cycle: specs/T.mdx#p\n"),
    [codeMention("cycle")],
    "refusal report",
  );
  const present = expectDiagnosed("a stable code present", () =>
    assertReportOmits(report, [codeMention("cycle")], "cycle finding"),
  );
  expect(present.message).toContain('Present: stable code "cycle"');
});

test("S-5: codeMention rejects inputs it cannot form", () => {
  // Each input, and the problem its diagnosis must name; every input formed
  // or misdiagnosed is reported.
  const inputs: readonly (readonly [string, string])[] = [
    ["", "an empty code"],
    ["Cycle", "is malformed"],
    ["refused--cycle", "is malformed"],
    ["14.1", "is malformed"],
    // SPEC-named tokens, never stable codes: 14.21's word is `corrupt`, its
    // code `corrupt-session`.
    ["no-change", "is no stable code"],
    ["corrupt", "is no stable code"],
    ["frobnicated", "is no stable code"],
  ];
  const wrong: string[] = [];
  for (const [code, problem] of inputs) {
    const label = `codeMention(${JSON.stringify(code)})`;
    try {
      codeMention(code);
      wrong.push(`${label} formed`);
    } catch (error) {
      if (!(error instanceof HarnessAssertionError)) throw error;
      if (!error.message.includes(problem)) {
        wrong.push(`${label} diagnosed without "${problem}": ${error.message}`);
      }
    }
  }
  expect(wrong, `wrong inputs:\n${wrong.join("\n")}`).toEqual([]);
});

test("S-5: a report missing a formed mention fails diagnosed, naming it", () => {
  const report = syntheticResult(
    "item-2 subtree-coherence specs/T.mdx#q unresolved\n",
  );
  const cases: readonly (readonly [Mention, string])[] = [
    [identityMention("specs/T.mdx#p"), 'identity or path "specs/T.mdx#p"'],
    [nameMention("item-1"), 'session name or item id "item-1"'],
    [spellingMention("div"), 'spelling "div"'],
    [numberMention(4), "number 4"],
    [specTokenMention("no-change"), 'SPEC-named token "no-change"'],
  ];
  for (const [mention, named] of cases) {
    const failure = expectDiagnosed(named, () =>
      assertReportMentions(
        report,
        [identityMention("specs/T.mdx#q"), mention],
        "item row",
      ),
    );
    expect(failure.message).toContain(`Missing: ${named}\n`);
    expect(failure.message).toContain("item row");
    expect(failure.message).toContain("stand-in check");
  }
  // Present, every formed kind passes beside the others.
  assertReportMentions(
    report,
    [
      identityMention("specs/T.mdx#q"),
      nameMention("item-2"),
      spellingMention("item"),
      numberMention(2),
      specTokenMention("subtree-coherence"),
      specTokenMention("unresolved"),
    ],
    "item row",
  );
  // The omission matcher reads formed mentions the same way.
  assertReportOmits(report, [identityMention("specs/T.mdx")], "root unnamed");
  const present = expectDiagnosed("a formed mention present", () =>
    assertReportOmits(report, [specTokenMention("subtree-coherence")], "kind"),
  );
  expect(present.message).toContain(
    'Present: SPEC-named token "subtree-coherence"',
  );
});

test("S-5: the parity matchers reject inputs they cannot form", () => {
  // Each malformed input, the matcher call on it, and the problem its
  // diagnosis must name; every input formed or misdiagnosed is reported.
  const inputs: (readonly [string, () => unknown, string])[] = [
    ['identityMention("")', () => identityMention(""), "an empty datum"],
    ['nameMention("")', () => nameMention(""), "an empty datum"],
    ['spellingMention("")', () => spellingMention(""), "an empty datum"],
  ];
  for (const value of [
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    2 ** 53,
  ]) {
    inputs.push([
      `numberMention(${String(value)})`,
      () => numberMention(value),
      "is not a non-negative integer",
    ]);
  }
  inputs.push([
    'specTokenMention("")',
    () => specTokenMention(""),
    "an empty token",
  ]);
  for (const token of [
    "No-Change",
    "no--change",
    "-blocked",
    "blocked-",
    "no change",
    "no_change",
    "blocked2",
  ]) {
    inputs.push([
      `specTokenMention(${JSON.stringify(token)})`,
      () => specTokenMention(token),
      "is malformed",
    ]);
  }
  inputs.push(
    [
      'specTokenMention("frobnicated")',
      () => specTokenMention("frobnicated"),
      "is no token SPEC.md names",
    ],
    [
      "the blank option holding an empty datum",
      () =>
        assertReportMentions(
          "unresolved=4",
          [numberMention(4)],
          "blank option",
          { blank: ["item-4", ""] },
        ),
      "datum 1 is empty",
    ],
    [
      'blankReportData("x", [""])',
      () => blankReportData("x", [""]),
      "datum 0 is empty",
    ],
  );
  const wrong: string[] = [];
  for (const [label, run, problem] of inputs) {
    try {
      run();
      wrong.push(`${label} formed`);
    } catch (error) {
      if (!(error instanceof HarnessAssertionError)) throw error;
      if (!error.message.includes(problem)) {
        wrong.push(`${label} diagnosed without "${problem}": ${error.message}`);
      }
    }
  }
  expect(wrong, `wrong inputs:\n${wrong.join("\n")}`).toEqual([]);
});

// T13.4-10's correction judge (TEST-SPEC T13.4-10, §0 H-3; SPEC 14.10):
// the recorded-file finding concerning `out/specs/A.md` has "the file's
// manual deletion, never a rebuild" as its correction, matched for its
// information, never its wording. Every vector is a complete message.

/** The obstructing orphan T13.4-10 stages, the path the judge is given. */
const OBSTRUCTING_ORPHAN = "out/specs/A.md";

/** U+2014 EM DASH and U+2019 RIGHT SINGLE QUOTATION MARK, by code point. */
const EM_DASH = String.fromCodePoint(0x2014);
const APOSTROPHE = String.fromCodePoint(0x2019);

/** A recorded-file finding's account of the file, before its correction. */
const STALE_HEAD =
  "stale generated output: the recorded derived file out/specs/A.md " +
  "remains at a path the current sources and configuration no longer " +
  "generate";

/** Messages carrying the correction, each with the form that carries it. */
const MANUAL_DELETION_ACCEPTED: readonly {
  readonly message: string;
  readonly form: "manual-marker" | "instruction";
}[] = [
  // The reviewers' three plain imperatives, each without a manual marker.
  {
    message: `${STALE_HEAD} and obstructs the rebuild's write of out/specs/A.md/specs/A.md; delete it, then rebuild (SPEC 14.10)`,
    form: "instruction",
  },
  {
    message:
      "Delete out/specs/A.md: it is a recorded derived file the current sources and configuration no longer generate, and it obstructs the rebuild's write of out/specs/A.md/specs/A.md (SPEC 14.10, 14.22)",
    form: "instruction",
  },
  {
    message: `${STALE_HEAD}; remove it (a rebuild is refused while it obstructs the write of out/specs/A.md/specs/A.md) (SPEC 14.10, 14.22)`,
    form: "instruction",
  },
  // Further instructions to the reader: other openers and objects.
  {
    message: `${STALE_HEAD}; the rebuild is refused ${EM_DASH} delete it, then rebuild (SPEC 14.10)`,
    form: "instruction",
  },
  {
    message: `${STALE_HEAD}; please remove out/specs/A.md and rebuild (SPEC 14.10)`,
    form: "instruction",
  },
  {
    message: `${STALE_HEAD}; it obstructs the rebuild, so remove \`out/specs/A.md\` and rebuild (SPEC 14.10)`,
    form: "instruction",
  },
  {
    message: `${STALE_HEAD}; a rebuild does not remove it, so delete it (SPEC 14.10)`,
    form: "instruction",
  },
  {
    message: `${STALE_HEAD}; you must delete it before the rebuild can write out/specs/A.md/specs/A.md (SPEC 14.10)`,
    form: "instruction",
  },
  {
    message: `${STALE_HEAD}; xspec won${APOSTROPHE}t remove it: delete it (SPEC 14.10)`,
    form: "instruction",
  },
  {
    message: `${STALE_HEAD}; first remove the stale orphan, then rebuild (SPEC 14.10)`,
    form: "instruction",
  },
  {
    message: "Remove the obstructing file out/specs/A.md, then rebuild.",
    form: "instruction",
  },
  { message: `${STALE_HEAD}.\nDelete it.`, form: "instruction" },
  // The manual marker beside a deletion or removal word.
  {
    message: `${STALE_HEAD}; delete out/specs/A.md manually (SPEC 14.10)`,
    form: "manual-marker",
  },
  {
    message: `${STALE_HEAD}; remove it by hand: a rebuild is refused while it obstructs the write of out/specs/A.md/specs/A.md (SPEC 14.10)`,
    form: "manual-marker",
  },
  {
    message: `${STALE_HEAD}; delete the file yourself, then rebuild (SPEC 14.10)`,
    form: "manual-marker",
  },
  // A negated or general mention of a build or xspec presents no remover.
  {
    message: `${STALE_HEAD}; delete it by hand: it is not removed by a rebuild, which is refused while it obstructs the write of out/specs/A.md/specs/A.md (SPEC 14.10)`,
    form: "manual-marker",
  },
  {
    message: `${STALE_HEAD}; delete it manually ${EM_DASH} xspec will not remove it (SPEC 14.10)`,
    form: "manual-marker",
  },
  {
    message: `${STALE_HEAD}; do not run \`xspec build\` to remove it: delete it by hand (SPEC 14.10)`,
    form: "manual-marker",
  },
  {
    message: `${STALE_HEAD}; any build or rebuild is refused while it obstructs the write; delete it by hand.`,
    form: "manual-marker",
  },
  {
    message:
      "xspec removes recorded files no longer generated only when a rebuild succeeds, and this one is refused; delete out/specs/A.md by hand.",
    form: "manual-marker",
  },
];

/** Messages presenting a build or xspec as what removes the file. */
const MANUAL_DELETION_REBUILD_REMEDIES: readonly string[] = [
  // The built product's message, and the task's other two remedies.
  `${STALE_HEAD}; run \`xspec build\` to remove it (SPEC 14.10)`,
  "stale generated output: out/specs/A.md is a recorded derived file the current sources and configuration no longer generate; rebuild; xspec will remove out/specs/A.md (SPEC 14.10)",
  "stale generated output: the recorded derived file out/specs/A.md is no longer generated; rebuilding removes it (SPEC 14.10)",
  // xspec presented as the remover, beside a manual marker or alone.
  `${STALE_HEAD}; xspec will remove out/specs/A.md, so you need not delete it by hand (SPEC 14.10)`,
  `${STALE_HEAD}; it is removed by xspec, never by hand (SPEC 14.10)`,
  `${STALE_HEAD}; xspec will then remove it (SPEC 14.10)`,
  `${STALE_HEAD}; let xspec remove it (SPEC 14.10)`,
  // A removal instruction whose means is a build.
  `${STALE_HEAD}; remove it: run \`xspec build\` (SPEC 14.10)`,
  `${STALE_HEAD}; remove it ${EM_DASH} run \`xspec build\` (SPEC 14.10)`,
  `${STALE_HEAD}; remove it (by running \`xspec build\`)`,
  `${STALE_HEAD}; remove out/specs/A.md by running \`xspec build\` (SPEC 14.10)`,
  `${STALE_HEAD}; delete it using \`xspec build\` (SPEC 14.10)`,
  `${STALE_HEAD}; remove it by rerunning the build (SPEC 14.10)`,
  // A build offered as the alternative to the deletion.
  `${STALE_HEAD}; delete it, or run \`xspec build\` (SPEC 14.10)`,
  `${STALE_HEAD}; delete it by hand, or rebuild.`,
  `${STALE_HEAD}; remove it by hand or by rerunning \`xspec build\` (SPEC 14.10)`,
];

/** Messages carrying no instruction to delete the file. */
const MANUAL_DELETION_ABSENT: readonly string[] = [
  `${STALE_HEAD} (SPEC 14.10)`,
  `${STALE_HEAD}; delete out/specs/A.md/specs/A.md, then rebuild (SPEC 14.10)`,
  `${STALE_HEAD}; do not delete it (SPEC 14.10)`,
];

test("S-5: T13.4-10's correction judge accepts the manual deletion in either form, a manual marker or an instruction to the reader (H-3: information, never wording)", () => {
  const mismatches = MANUAL_DELETION_ACCEPTED.flatMap(({ message, form }) => {
    const verdict: ManualDeletionVerdict = judgeManualDeletionCorrection(
      message,
      OBSTRUCTING_ORPHAN,
    );
    return verdict.verdict === "manual-deletion" && verdict.form === form
      ? []
      : [{ message, expected: form, verdict }];
  });
  expect(mismatches).toEqual([]);
});

test("S-5: T13.4-10's correction judge rejects every clause presenting a build or xspec as what removes the file (never a rebuild)", () => {
  const mismatches = MANUAL_DELETION_REBUILD_REMEDIES.flatMap((message) => {
    const verdict = judgeManualDeletionCorrection(message, OBSTRUCTING_ORPHAN);
    return verdict.verdict === "rebuild-remedy" ? [] : [{ message, verdict }];
  });
  expect(mismatches).toEqual([]);
});

test("S-5: T13.4-10's correction judge finds the correction absent from a message carrying no instruction to delete the file", () => {
  const mismatches = MANUAL_DELETION_ABSENT.flatMap((message) => {
    const verdict = judgeManualDeletionCorrection(message, OBSTRUCTING_ORPHAN);
    return verdict.verdict === "absent" ? [] : [{ message, verdict }];
  });
  expect(mismatches).toEqual([]);
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

// --- human-report decoders (human-reports.ts) ---------------------------------
//
// TEST-SPEC H-3's report forms and T12.0-15: a human findings report and an
// exit-2 standard-error message decoded onto the information model — each
// finding's code, locations, concerned path, and identities; an error's
// code and concerned path — and compared with the `--json` twin's decoded
// document. The synthetic reports below take the built product's layout
// (human-reports.ts' header); every one either decodes to exactly the
// modeled information or fails diagnosed — a report missing a code, a
// location's offsets, a concerned path, or an identity, and a non-UTF-8
// path printed raw or unmarked, each rejected loudly (S-5).

/** U+FFFD REPLACEMENT CHARACTER, built from its code point. */
const REPLACEMENT = String.fromCodePoint(0xfffd);

/** The bytes of `specs/A<FF>.mdx`, a non-UTF-8 path (SPEC 12.0, 14.19). */
const NON_UTF8_PATH_BYTES = Buffer.concat([
  Buffer.from("specs/A", "utf8"),
  Buffer.from([0xff]),
  Buffer.from(".mdx", "utf8"),
]);
const NON_UTF8_PATH_HEX = NON_UTF8_PATH_BYTES.toString("hex");

/** The built product's mark for that path (human-reports.ts' header). */
const NON_UTF8_PATH_MARK = `<bytes ${NON_UTF8_PATH_HEX}>`;

/** A synthetic run whose streams are the given bytes, exactly. */
function syntheticBytesResult(
  stdoutBytes: Uint8Array,
  stderrBytes: Uint8Array,
  exitCode: number,
): RunResult {
  return {
    exitCode,
    signal: null,
    stdout: Buffer.from(stdoutBytes).toString("utf8"),
    stderr: Buffer.from(stderrBytes).toString("utf8"),
    stdoutBytes,
    stderrBytes,
    commandLine: "`stand-in build` [synthetic result]",
  };
}

/** One decoded `--json` finding's members (12.7), for the twin documents. */
function jsonFinding(
  code: string | null,
  locations: readonly {
    readonly file: string | { readonly bytes: string };
    readonly start: number;
    readonly end: number;
  }[],
  path: string | { readonly bytes: string } | null,
  identities: readonly string[],
): Record<string, unknown> {
  return {
    code,
    message: "a free-text message, never asked (H-3)",
    locations: locations.map(({ file, start, end }) => ({
      file,
      range: { start, end },
    })),
    path,
    identities,
  };
}

/**
 * The `--json` twin of HUMAN_FINDINGS_REPORT: one finding of every kind a
 * build or check report carries — located, located several times, at a
 * concerned path, with identities, with identities alone, at a marked
 * location file and a marked concerned path, at a plain U+FFFD path — in
 * the pinned 12.7 order, decoded form-exact.
 */
const JSON_FINDINGS_TWIN = decodeFindingsReport(
  {
    findings: [
      jsonFinding(
        "missing-id",
        [{ file: "specs/A.mdx", start: 18, end: 21 }],
        null,
        [],
      ),
      jsonFinding(
        "missing-id",
        [{ file: { bytes: NON_UTF8_PATH_HEX }, start: 17, end: 20 }],
        null,
        [],
      ),
      jsonFinding(
        "duplicate-id",
        [
          { file: "specs/A.mdx", start: 123, end: 131 },
          { file: "specs/A.mdx", start: 146, end: 154 },
        ],
        null,
        [],
      ),
      jsonFinding("stale-output", [], ".xspec", []),
      jsonFinding(
        "cross-module-text",
        [{ file: "src/app.ts", start: 97, end: 115 }],
        null,
        ["specs/bravo.mdx"],
      ),
      jsonFinding("policy-violation", [], null, [
        "no-hi-to-lo",
        "hi/H.mdx#h1",
        "depends",
        "lo/L.mdx#l1",
      ]),
      jsonFinding("invalid-source-path", [], { bytes: NON_UTF8_PATH_HEX }, []),
      jsonFinding("invalid-source-path", [], `specs/B${REPLACEMENT}.mdx`, []),
    ],
  },
  "the human decoders' --json twin",
).findings;

/** The human report's lines, in an order of their own (T12.0-15). */
const HUMAN_FINDING_LINES: readonly string[] = [
  'specs/A.mdx:123-131: duplicate-id: duplicate ID "dup": 2 sections bear this ID — rename all but one (SPEC 1.3, 14.3) (also at specs/A.mdx:146-154)',
  `${NON_UTF8_PATH_MARK}:17-20: missing-id: missing ID: every non-root section must have an id prop (SPEC 1.3, 14.1)`,
  "specs/A.mdx:18-21: missing-id: missing ID: every non-root section must have an id prop (SPEC 1.3, 14.1)",
  ".xspec: stale-output: stale generated output: run `xspec build` (SPEC 14.10, 13.3)",
  'src/app.ts:97-115: cross-module-text: cross-module text call: the argument is a node of module "specs/alpha.mdx" (SPEC 4.4, 14.11) [specs/bravo.mdx]',
  'policy-violation: policy violation: rule "no-hi-to-lo": the depends edge hi/H.mdx#h1 -> lo/L.mdx#l1 violates the rule (SPEC 14.12) [no-hi-to-lo, hi/H.mdx#h1, depends, lo/L.mdx#l1]',
  `${NON_UTF8_PATH_MARK}: invalid-source-path: the workspace-relative path is not valid UTF-8 (SPEC 7, 14.19)`,
  `specs/B${REPLACEMENT}.mdx: invalid-source-path: the workspace-relative path contains U+FFFD (SPEC 7, 12.0, 14.19)`,
];

function humanReport(lines: readonly string[], count?: string): Buffer {
  const counted = count ?? `${String(lines.length)} findings`;
  return Buffer.from(
    [...lines, ...(lines.length === 0 ? [] : [counted])]
      .map((line) => `${line}\n`)
      .join(""),
    "utf8",
  );
}

/** The well-formed synthetic report: every line, then its count line. */
const HUMAN_FINDINGS_REPORT = humanReport(HUMAN_FINDING_LINES);

/** HUMAN_FINDING_LINES with line `index` replaced by `line`. */
function withLine(index: number, line: string): string[] {
  return HUMAN_FINDING_LINES.map((original, at) =>
    at === index ? line : original,
  );
}

test("S-5: the human findings decoder decodes a well-formed report onto the information model, order free", () => {
  const decoded = decodeHumanFindingsReport(
    HUMAN_FINDINGS_REPORT,
    "well-formed",
  );
  expect(
    decoded.findings.map(({ code, locations, path, identities, line }) => ({
      code,
      locations,
      path,
      identities,
      line,
    })),
  ).toEqual([
    {
      code: "duplicate-id",
      locations: [
        { file: "specs/A.mdx", range: { start: 123, end: 131 } },
        { file: "specs/A.mdx", range: { start: 146, end: 154 } },
      ],
      path: null,
      identities: [],
      line: 1,
    },
    {
      code: "missing-id",
      locations: [
        { file: { bytes: NON_UTF8_PATH_HEX }, range: { start: 17, end: 20 } },
      ],
      path: null,
      identities: [],
      line: 2,
    },
    {
      code: "missing-id",
      locations: [{ file: "specs/A.mdx", range: { start: 18, end: 21 } }],
      path: null,
      identities: [],
      line: 3,
    },
    {
      code: "stale-output",
      locations: [],
      path: ".xspec",
      identities: [],
      line: 4,
    },
    {
      code: "cross-module-text",
      locations: [{ file: "src/app.ts", range: { start: 97, end: 115 } }],
      path: null,
      identities: ["specs/bravo.mdx"],
      line: 5,
    },
    {
      code: "policy-violation",
      locations: [],
      path: null,
      identities: ["no-hi-to-lo", "hi/H.mdx#h1", "depends", "lo/L.mdx#l1"],
      line: 6,
    },
    {
      code: "invalid-source-path",
      locations: [],
      path: { bytes: NON_UTF8_PATH_HEX },
      identities: [],
      line: 7,
    },
    {
      code: "invalid-source-path",
      locations: [],
      path: `specs/B${REPLACEMENT}.mdx`,
      identities: [],
      line: 8,
    },
  ]);
  // The report carries its twin's information, its own order free.
  assertHumanFindingsCarry(
    decoded,
    JSON_FINDINGS_TWIN.map(findingInformation),
    "well-formed",
  );
  // The run form reads stdout (12.0: reports are standard-output content),
  // decoding and comparing in one call; stderr is never read.
  assertHumanFindingsReportCarries(
    syntheticBytesResult(
      HUMAN_FINDINGS_REPORT,
      Buffer.from("specs/A.mdx:1-2: cycle: noise on stderr\n", "utf8"),
      1,
    ),
    JSON_FINDINGS_TWIN,
    "run form",
  );
  // An empty report is no finding; the count line is optional, and any
  // case or separator spelling of a code decodes to it (human.ts's rule).
  expect(decodeHumanFindingsReport(Buffer.alloc(0)).findings).toEqual([]);
  const uncounted = Buffer.from(
    HUMAN_FINDING_LINES.map((line) => `${line}\n`).join(""),
    "utf8",
  );
  assertHumanFindingsCarry(
    decodeHumanFindingsReport(uncounted),
    JSON_FINDINGS_TWIN,
    "no count line",
  );
  // Its words at the code's position are the code (human.ts's convention:
  // `missing ID` carries `missing-id`), so a message opening with its own
  // code's words up to a `: ` reads as carrying the code (human-reports.ts'
  // header).
  const respelled = decodeHumanFindingsReport(
    humanReport([
      "specs/A.mdx:18-21: MISSING_ID: missing ID (SPEC 14.1)",
      "Policy Violation: rule (SPEC 14.12) [r]",
      "specs/A.mdx:53-62: unknown dependency: the d reference (SPEC 14.5)",
    ]),
  );
  expect(respelled.findings.map(({ code }) => code)).toEqual([
    "missing-id",
    "policy-violation",
    "unknown-dependency",
  ]);
  // A path holding ": " before its finding's code still heads its line.
  const colon = decodeHumanFindingsReport(
    humanReport(["specs/a: b.mdx:3-9: missing-id: missing ID (SPEC 14.1)"]),
  );
  expect(colon.findings[0]!.locations).toEqual([
    { file: "specs/a: b.mdx", range: { start: 3, end: 9 } },
  ]);
});

test("S-5: the human findings decoder decodes refusals and code-less findings: locations with identities, a concerned path, and the code-less word", () => {
  const twin = decodeFindingsReport(
    {
      findings: [
        jsonFinding(
          "refused-id-collision",
          [
            { file: "specs/A.mdx", start: 66, end: 116 },
            { file: "specs/A.mdx", start: 88, end: 111 },
          ],
          null,
          ["specs/A.mdx#a.c", "specs/A.mdx#a.c.x"],
        ),
        jsonFinding("refused-destination-exists", [], "specs/B.mdx", []),
        jsonFinding(null, [], null, ["s", "item-1"]),
      ],
    },
    "refusal twin",
  ).findings;
  const report = humanReport([
    "finding: item 'item-1' of session 's' is blocked (SPEC 10.3, 10.7) [s, item-1]",
    'specs/B.mdx: refused-destination-exists: destination exists: the destination path "specs/B.mdx" is occupied (SPEC 6.5, 14)',
    'specs/A.mdx:66-116: refused-id-collision: ID collision: the operation would produce "a.c", "a.c.x" (SPEC 6.4, 6.5, 14) (also at specs/A.mdx:88-111) [specs/A.mdx#a.c, specs/A.mdx#a.c.x]',
  ]);
  const decoded = decodeHumanFindingsReport(report, "refusals");
  expect(decoded.findings.map(({ code }) => code)).toEqual([
    null,
    "refused-destination-exists",
    "refused-id-collision",
  ]);
  assertHumanFindingsCarry(decoded, twin, "refusals");
});

test("S-5: the human findings comparison rejects a report missing a code, a location's offsets, a concerned path, an identity, or a finding — naming the datum", () => {
  const twin = JSON_FINDINGS_TWIN;
  const rejected = (
    label: string,
    report: Buffer,
    ...fragments: readonly string[]
  ): void => {
    const failure = expectDiagnosed(label, () =>
      assertHumanFindingsCarry(
        decodeHumanFindingsReport(report, label),
        twin,
        label,
      ),
    );
    for (const fragment of fragments) {
      expect(failure.message, label).toContain(fragment);
    }
    expect(failure.message, label).toContain(label);
  };
  // A code: absent from the line, which then fits no layout.
  rejected(
    "no code",
    humanReport(
      withLine(
        2,
        "specs/A.mdx:18-21: every non-root section must have an id prop (SPEC 1.3, 14.1)",
      ),
    ),
    "no segment of this line spells a stable code",
    "line 3",
  );
  // A code: another one.
  rejected(
    "another code",
    humanReport(
      withLine(
        2,
        "specs/A.mdx:18-21: duplicate-id: missing ID (SPEC 1.3, 14.1)",
      ),
    ),
    "matches no --json finding",
    "code missing-id",
  );
  // A location's offsets: the head names the file alone, or one offset.
  rejected(
    "a location without its offsets",
    humanReport(
      withLine(2, "specs/A.mdx: missing-id: missing ID (SPEC 1.3, 14.1)"),
    ),
    'missing location(s) "specs/A.mdx" 18-21',
    'a concerned path the --json finding lacks, "specs/A.mdx"',
  );
  rejected(
    "a location with one offset",
    humanReport(
      withLine(2, "specs/A.mdx:18: missing-id: missing ID (SPEC 1.3, 14.1)"),
    ),
    'missing location(s) "specs/A.mdx" 18-21',
  );
  rejected(
    "a further location without its offsets",
    humanReport(
      withLine(
        0,
        'specs/A.mdx:123-131: duplicate-id: duplicate ID "dup" (SPEC 1.3, 14.3) (also at specs/A.mdx)',
      ),
    ),
    "every further location in the `(also at …)` list",
  );
  rejected(
    "a further location dropped",
    humanReport(
      withLine(
        0,
        'specs/A.mdx:123-131: duplicate-id: duplicate ID "dup" (SPEC 1.3, 14.3)',
      ),
    ),
    'missing location(s) "specs/A.mdx" 146-154',
  );
  rejected(
    "a located line listing further locations under a bare path",
    humanReport(
      withLine(
        0,
        'specs/A.mdx: duplicate-id: duplicate ID "dup" (SPEC 1.3, 14.3) (also at specs/A.mdx:146-154)',
      ),
    ),
    "a first location `<path>:<start>-<end>`",
  );
  rejected(
    "an offset changed",
    humanReport(
      withLine(2, "specs/A.mdx:18-22: missing-id: missing ID (SPEC 1.3, 14.1)"),
    ),
    'missing location(s) "specs/A.mdx" 18-21',
    'location(s) the --json finding lacks "specs/A.mdx" 18-22',
  );
  rejected(
    "a range ending before it starts",
    humanReport(
      withLine(2, "specs/A.mdx:21-18: missing-id: missing ID (SPEC 1.3, 14.1)"),
    ),
    "a range whose end is not before its start",
  );
  // A concerned path: absent from the line.
  rejected(
    "no concerned path",
    humanReport(
      withLine(3, "stale-output: stale generated output (SPEC 14.10, 13.3)"),
    ),
    'missing concerned path ".xspec"',
  );
  rejected(
    "another concerned path",
    humanReport(
      withLine(
        3,
        ".xspec/graph: stale-output: stale generated output (SPEC 14.10)",
      ),
    ),
    'concerned path ".xspec/graph" where the --json finding carries ".xspec"',
  );
  // An identity: one dropped, all dropped, or reordered (their positions
  // carry their roles, 14.12).
  rejected(
    "an identity dropped",
    humanReport(
      withLine(
        5,
        'policy-violation: policy violation: rule "no-hi-to-lo" (SPEC 14.12) [no-hi-to-lo, hi/H.mdx#h1, depends]',
      ),
    ),
    'missing identity ["lo/L.mdx#l1"]',
  );
  rejected(
    "the identities dropped",
    humanReport(
      withLine(
        4,
        "src/app.ts:97-115: cross-module-text: cross-module text call (SPEC 4.4, 14.11)",
      ),
    ),
    'missing identity ["specs/bravo.mdx"]',
  );
  rejected(
    "the identities reordered",
    humanReport(
      withLine(
        5,
        "policy-violation: policy violation (SPEC 14.12) [no-hi-to-lo, lo/L.mdx#l1, depends, hi/H.mdx#h1]",
      ),
    ),
    'identities ["no-hi-to-lo","lo/L.mdx#l1","depends","hi/H.mdx#h1"] where the --json finding carries',
  );
  // A finding: dropped (the count line kept true), or one too many.
  rejected(
    "a finding dropped",
    humanReport(HUMAN_FINDING_LINES.filter((_line, at) => at !== 3)),
    "has no counterpart: the human report carries no further finding with its code stale-output",
  );
  rejected(
    "a finding too many",
    humanReport([
      ...HUMAN_FINDING_LINES,
      "specs/C.mdx:1-2: missing-id: missing ID (SPEC 14.1)",
    ]),
    "matches no --json finding",
    'locations ["specs/C.mdx" 1-2]',
  );
  // Two findings equal in every datum but their messages (two garbage
  // journal lines, 14.13) are two findings: printed once, one is missing.
  const journalTwin = decodeFindingsReport(
    {
      findings: [1, 2].map((line) => ({
        ...jsonFinding("journal-error", [], ".xspec/journal", []),
        message: `journal error: the entry on line ${String(line)} is not well-formed`,
      })),
    },
    "two journal errors",
  ).findings;
  const journalLine = (line: number): string =>
    `.xspec/journal: journal-error: journal error: the entry on line ${String(line)} is not well-formed (SPEC 14.13)`;
  assertHumanFindingsCarry(
    decodeHumanFindingsReport(humanReport([journalLine(2), journalLine(1)])),
    journalTwin,
    "two journal errors printed twice",
  );
  const once = expectDiagnosed("two equal findings printed once", () =>
    assertHumanFindingsCarry(
      decodeHumanFindingsReport(humanReport([journalLine(1)])),
      journalTwin,
      "two journal errors printed once",
    ),
  );
  expect(once.message).toContain(
    "the human report carries no further finding with its code journal-error",
  );
  // The count line disagreeing with the lines, an empty line, an
  // identities list holding an empty identity.
  rejected(
    "a count line disagreeing",
    humanReport(HUMAN_FINDING_LINES, "9 findings"),
    "it counts 9",
  );
  rejected(
    "an empty line",
    humanReport(withLine(3, "")),
    "never an empty line",
  );
  rejected(
    "an empty identity",
    humanReport(
      withLine(
        4,
        "src/app.ts:97-115: cross-module-text: cross-module text call (SPEC 14.11) [specs/bravo.mdx, ]",
      ),
    ),
    "non-empty identities",
  );
});

test("S-5: the human findings decoder tells the marked byte form from a plain path by its mark alone — a non-UTF-8 path printed raw or unmarked rejected", () => {
  const twin = JSON_FINDINGS_TWIN;
  const rejected = (label: string, report: Buffer, fragment: string): void => {
    const failure = expectDiagnosed(label, () =>
      assertHumanFindingsCarry(
        decodeHumanFindingsReport(report, label),
        twin,
        label,
      ),
    );
    expect(failure.message, label).toContain(fragment);
  };
  // Raw: the path's own bytes in the report, which is then no UTF-8 text.
  const raw = Buffer.from(
    HUMAN_FINDINGS_REPORT.toString("latin1").replace(
      NON_UTF8_PATH_MARK,
      NON_UTF8_PATH_BYTES.toString("latin1"),
    ),
    "latin1",
  );
  expect(raw.includes(NON_UTF8_PATH_BYTES)).toBe(true);
  rejected("printed raw", raw, "so these bytes are a path printed raw");
  // Lossily decoded: U+FFFD substituted for the ill-formed byte, a plain
  // string where the twin carries the marked form.
  const lossy = `specs/A${REPLACEMENT}.mdx`;
  rejected(
    "printed lossily at a location",
    humanReport(
      withLine(1, `${lossy}:17-20: missing-id: missing ID (SPEC 1.3, 14.1)`),
    ),
    `missing location(s) the marked byte form of bytes:${NON_UTF8_PATH_HEX} 17-20`,
  );
  rejected(
    "printed lossily as a concerned path",
    humanReport(
      withLine(
        6,
        `${lossy}: invalid-source-path: not valid UTF-8 (SPEC 7, 14.19)`,
      ),
    ),
    `concerned path ${JSON.stringify(lossy)} where the --json finding carries the marked byte form of bytes:${NON_UTF8_PATH_HEX}`,
  );
  // Otherwise unmarked: an escape spelled as text, or a mark the layout
  // does not use (uppercase digits, an odd digit count) — plain paths all.
  for (const unmarked of [
    "specs/A\\xff.mdx",
    `<bytes ${NON_UTF8_PATH_HEX.toUpperCase()}>`,
    `<bytes ${NON_UTF8_PATH_HEX}0>`,
    `bytes:${NON_UTF8_PATH_HEX}`,
  ]) {
    rejected(
      `unmarked as ${unmarked}`,
      humanReport(
        withLine(
          6,
          `${unmarked}: invalid-source-path: not valid UTF-8 (SPEC 7, 14.19)`,
        ),
      ),
      `concerned path ${JSON.stringify(unmarked)} where the --json finding carries the marked byte form`,
    );
  }
  // A valid-UTF-8 path presented marked differs from its plain twin.
  const markedPlain = `<bytes ${Buffer.from("specs/A.mdx", "utf8").toString("hex")}>`;
  rejected(
    "a valid-UTF-8 path presented marked",
    humanReport(
      withLine(
        2,
        `${markedPlain}:18-21: missing-id: missing ID (SPEC 1.3, 14.1)`,
      ),
    ),
    'missing location(s) "specs/A.mdx" 18-21',
  );
  // The U+FFFD path, valid UTF-8, stays plain: marking it differs too.
  rejected(
    "a U+FFFD path presented marked",
    humanReport(
      withLine(
        7,
        `<bytes ${Buffer.from(`specs/B${REPLACEMENT}.mdx`, "utf8").toString("hex")}>: invalid-source-path: U+FFFD (SPEC 14.19)`,
      ),
    ),
    `where the --json finding carries ${JSON.stringify(`specs/B${REPLACEMENT}.mdx`)}`,
  );
  // A marked path decodes to its exact bytes: the model value the --json
  // marked form decodes to.
  const marked = decodeHumanFindingsReport(
    humanReport([`${NON_UTF8_PATH_MARK}: invalid-source-path: x (SPEC 14.19)`]),
  ).findings[0]!.path;
  expect(marked).toEqual({ bytes: NON_UTF8_PATH_HEX });
});

/** The `--json` twin of a configuration error found by the upward search. */
const JSON_CONFIGURATION_ERROR = decodeErrorDocument(
  {
    error: jsonFinding("configuration-error", [], "xspec.config.ts", []),
  },
  "configuration-error twin",
).error;

const CONFIGURATION_ERROR_MESSAGE =
  "xspec: configuration error: xspec.config.ts: line 7: unknown key " +
  '"definitelyUnknownKey" in the defineConfig argument (SPEC 7, 14.14)\n';

test("S-5: the exit-2 decoder decodes a standard-error message onto its code and concerned path — or neither, for a plain usage error", () => {
  const decode = (message: string | Buffer): unknown => {
    const { code, path } = decodeHumanErrorMessage(
      typeof message === "string" ? Buffer.from(message, "utf8") : message,
    );
    return { code, path };
  };
  expect(decode(CONFIGURATION_ERROR_MESSAGE)).toEqual({
    code: "configuration-error",
    path: "xspec.config.ts",
  });
  // Several defects, one line each, each repeating the code and the path.
  expect(
    decode(
      CONFIGURATION_ERROR_MESSAGE +
        "xspec: configuration error: xspec.config.ts: line 9: unknown key (SPEC 7.3, 14.14)\n",
    ),
  ).toEqual({ code: "configuration-error", path: "xspec.config.ts" });
  expect(
    decode(
      "xspec: configuration error: .: no xspec.config.ts found by upward search (SPEC 7)\n",
    ),
  ).toEqual({ code: "configuration-error", path: "." });
  expect(
    decode(
      "xspec: configuration error: ./../cfg//xspec.config.ts: --config ./../cfg//xspec.config.ts: no configuration file exists at this path (SPEC 7, 12.0)\n",
    ),
  ).toEqual({ code: "configuration-error", path: "./../cfg//xspec.config.ts" });
  expect(
    decode(
      "xspec: workspace busy: .xspec/lock: another mutating command holds this workspace (SPEC 14.26)\n",
    ),
  ).toEqual({ code: "workspace-busy", path: ".xspec/lock" });
  expect(
    decode(
      "xspec: write failure: .xspec: the environment refused a graph-data write (SPEC 14.24)\n",
    ),
  ).toEqual({ code: "write-failure", path: ".xspec" });
  expect(
    decode(
      "xspec: journal error: .xspec/journal: the entry on line 1 is not well-formed (SPEC 14.13)\n",
    ),
  ).toEqual({ code: "journal-error", path: ".xspec/journal" });
  // A marked path decodes to its exact bytes.
  expect(
    decode(
      `xspec: read failure: ${NON_UTF8_PATH_MARK}: the environment refused to read ${NON_UTF8_PATH_MARK} (SPEC 14.25)\n`,
    ),
  ).toEqual({ code: "read-failure", path: { bytes: NON_UTF8_PATH_HEX } });
  // A plain usage error carries neither, whatever its message names after
  // its head; a code first spelled on a later prefixed line still counts.
  expect(decode("xspec: ids: unexpected argument 'extra'\n")).toEqual({
    code: null,
    path: null,
  });
  expect(
    decode(
      "xspec: impact: cannot map baseline identities — journal error: the entry on line 1 of .xspec/journal is not well-formed (SPEC 14.13)\n",
    ),
  ).toEqual({ code: null, path: null });
  expect(
    decode(
      "xspec: impact: the baseline cannot be resolved\nxspec: journal error: .xspec/journal: line 1 (SPEC 14.13)\n",
    ),
  ).toEqual({ code: "journal-error", path: ".xspec/journal" });
  // The comparison: the twin's code and path carried; a code-less twin
  // asserts neither, whatever the message carries.
  assertHumanErrorCarries(
    decodeHumanErrorMessage(Buffer.from(CONFIGURATION_ERROR_MESSAGE, "utf8")),
    JSON_CONFIGURATION_ERROR,
    "configuration error",
  );
  assertHumanErrorCarries(
    decodeHumanErrorMessage(Buffer.from(CONFIGURATION_ERROR_MESSAGE, "utf8")),
    { code: null, path: null },
    "a plain usage error's twin",
  );
  // The run form reads stderr, never stdout.
  assertHumanErrorMessageCarries(
    syntheticBytesResult(
      Buffer.from("xspec: cycle: specs/A.mdx: on stdout\n", "utf8"),
      Buffer.from(CONFIGURATION_ERROR_MESSAGE, "utf8"),
      2,
    ),
    JSON_CONFIGURATION_ERROR,
    "run form",
  );
  assertHumanErrorMessageCarries(
    syntheticBytesResult(Buffer.alloc(0), Buffer.alloc(0), 2),
    { code: null, path: null },
    "a code-less twin decodes nothing",
  );
  // A marked twin path: the same bytes in the same form.
  assertHumanErrorCarries(
    decodeHumanErrorMessage(
      Buffer.from(
        `xspec: read failure: ${NON_UTF8_PATH_MARK}: refused (SPEC 14.25)\n`,
        "utf8",
      ),
    ),
    { code: "read-failure", path: { bytes: NON_UTF8_PATH_HEX } },
    "marked path",
  );
});

test("S-5: the exit-2 comparison rejects a standard-error message missing the code or the concerned path, naming another, or unparseable", () => {
  const rejected = (
    label: string,
    message: Buffer | string,
    fragment: string,
    twin: ErrorInformation = JSON_CONFIGURATION_ERROR,
  ): void => {
    const failure = expectDiagnosed(label, () =>
      assertHumanErrorCarries(
        decodeHumanErrorMessage(
          typeof message === "string" ? Buffer.from(message, "utf8") : message,
          label,
        ),
        twin,
        label,
      ),
    );
    expect(failure.message, label).toContain(fragment);
  };
  rejected(
    "no code",
    "xspec: xspec.config.ts: line 7: unknown key (SPEC 7, 14.14)\n",
    "it carries no stable code where the --json twin's error document carries configuration-error",
  );
  rejected(
    "another code",
    "xspec: read failure: xspec.config.ts: refused (SPEC 14.25)\n",
    "it carries the code read-failure where the --json twin's error document carries configuration-error",
  );
  rejected(
    "no concerned path, the message after the code",
    "xspec: configuration error: line 7: unknown key (SPEC 7, 14.14)\n",
    'it carries the concerned path "line 7" where the --json twin\'s error document carries "xspec.config.ts"',
  );
  rejected(
    "no concerned path, nothing after the code",
    "xspec: configuration error\n",
    'it carries no concerned path where the --json twin\'s error document carries "xspec.config.ts"',
  );
  rejected(
    "another concerned path",
    "xspec: configuration error: ../xspec.config.ts: line 7 (SPEC 7, 14.14)\n",
    'it carries the concerned path "../xspec.config.ts"',
  );
  rejected(
    "two coded lines disagreeing",
    CONFIGURATION_ERROR_MESSAGE +
      "xspec: configuration error: other.config.ts: line 1 (SPEC 14.14)\n",
    "so which the error's are is ambiguous",
  );
  rejected("an empty message", Buffer.alloc(0), "standard error is empty");
  rejected(
    "no diagnostic prefix",
    "configuration error: xspec.config.ts: line 7 (SPEC 14.14)\n",
    'opening with the product\'s diagnostic prefix "xspec: "',
  );
  rejected(
    "an empty path token",
    "xspec: configuration error: : line 7 (SPEC 14.14)\n",
    "a path, never an empty token",
  );
  // A non-UTF-8 concerned path printed raw, lossily, or unmarked.
  const twin: ErrorInformation = {
    code: "read-failure",
    path: { bytes: NON_UTF8_PATH_HEX },
  };
  rejected(
    "a non-UTF-8 path printed raw",
    Buffer.concat([
      Buffer.from("xspec: read failure: ", "utf8"),
      NON_UTF8_PATH_BYTES,
      Buffer.from(": refused (SPEC 14.25)\n", "utf8"),
    ]),
    "so these bytes are a path printed raw",
    twin,
  );
  rejected(
    "a non-UTF-8 path printed lossily",
    `xspec: read failure: specs/A${REPLACEMENT}.mdx: refused (SPEC 14.25)\n`,
    `it carries the concerned path ${JSON.stringify(`specs/A${REPLACEMENT}.mdx`)} where the --json twin's error document carries the marked byte form of bytes:${NON_UTF8_PATH_HEX}`,
    twin,
  );
  rejected(
    "a non-UTF-8 path unmarked",
    "xspec: read failure: specs/A\\xff.mdx: refused (SPEC 14.25)\n",
    'it carries the concerned path "specs/A\\\\xff.mdx"',
    twin,
  );
});

// --- the human preview decoder (human-reports.ts) --------------------------------
//
// TEST-SPEC T6.6-7 and H-3's report forms: a `rename`/`move --preview`
// report decoded onto the preview model the form-exact `--json` decode
// produces — its findings, and its plan: the mapping's pairs, every file
// with each of its edits' class and range, the delta's two directions or
// its unavailability — and compared with the `--json` twin's decoded
// document, order free. The synthetic reports take the built product's
// layout (human-reports.ts' header); every one either decodes to exactly
// the modeled information or fails diagnosed — an edit without its range,
// a delta line without its direction, a mapping pair half absent, and
// every datum a report omits or misplaces each rejected loudly (S-5).

/** One decoded `--json` preview document (12.7), for the twins. */
function jsonPreview(document: Record<string, unknown>): PreviewReport {
  return decodePreviewReport(
    { findings: [], ...document },
    "the human preview decoder's --json twin",
  );
}

/** A preview edit's `--json` form. */
function jsonEdit(
  editClass: string,
  start: number,
  end: number,
): Record<string, unknown> {
  return { class: editClass, range: { start, end } };
}

/**
 * A section move into an existing target file (T6.6-4(b)'s shape): two
 * mapping pairs, three files whose edits span seven classes — a nested
 * `id-rewrite` and a zero-length coincidence among them — and an empty
 * delta, in the pinned 12.7 orders.
 */
const JSON_SECTION_MOVE_TWIN = jsonPreview({
  mapping: [
    { from: "specs/Origin.mdx#org.mv", to: "specs/Target.mdx#tp.nw" },
    { from: "specs/Origin.mdx#org.mv.kid", to: "specs/Target.mdx#tp.nw.kid" },
  ],
  files: [
    {
      file: "specs/Origin.mdx",
      edits: [
        jsonEdit("import-removal", 0, 33),
        jsonEdit("origin-deletion", 69, 182),
        jsonEdit("id-rewrite", 74, 85),
        jsonEdit("reference-rewrite", 90, 98),
      ],
    },
    {
      file: "specs/Target.mdx",
      edits: [
        jsonEdit("target-parent-rewrite", 40, 53),
        jsonEdit("import-addition", 53, 53),
        jsonEdit("target-insertion", 53, 53),
      ],
    },
    {
      file: "specs/Third.mdx",
      edits: [
        jsonEdit("import-addition", 33, 33),
        jsonEdit("reference-rewrite", 85, 99),
      ],
    },
  ],
  delta: { generated: [], removed: [] },
});

/** Its human report as the built product prints it. */
const HUMAN_SECTION_MOVE_LINES: readonly string[] = [
  "mapping:",
  "  specs/Origin.mdx#org.mv -> specs/Target.mdx#tp.nw",
  "  specs/Origin.mdx#org.mv.kid -> specs/Target.mdx#tp.nw.kid",
  "files:",
  "  specs/Origin.mdx",
  "    0-33 import-removal",
  "    69-182 origin-deletion",
  "    74-85 id-rewrite",
  "    90-98 reference-rewrite",
  "  specs/Target.mdx",
  "    40-53 target-parent-rewrite",
  "    53-53 target-insertion",
  "    53-53 import-addition",
  "  specs/Third.mdx",
  "    33-33 import-addition",
  "    85-99 reference-rewrite",
  "delta:",
];

/**
 * A file-form move (T6.6-5's shape): the moved file's root and section
 * mapped, its relocation beside the specifier rewrites, and the delta's
 * two directions.
 */
const JSON_FILE_MOVE_TWIN = jsonPreview({
  mapping: [
    { from: "specs/Mv.mdx", to: "specs/sub/Mv2.mdx" },
    { from: "specs/Mv.mdx#mv", to: "specs/sub/Mv2.mdx#mv" },
  ],
  files: [
    {
      file: "specs/Mv.mdx",
      edits: [
        jsonEdit("file-relocation", 0, 78),
        jsonEdit("import-specifier-rewrite", 16, 29),
      ],
    },
    {
      file: "specs/User.mdx",
      edits: [jsonEdit("import-specifier-rewrite", 15, 27)],
    },
  ],
  delta: {
    generated: ["specs/sub/Mv2.md", "specs/sub/Mv2.xspec.ts"],
    removed: ["specs/Mv.md", "specs/Mv.xspec.ts"],
  },
});

const HUMAN_FILE_MOVE_LINES: readonly string[] = [
  "mapping:",
  "  specs/Mv.mdx -> specs/sub/Mv2.mdx",
  "  specs/Mv.mdx#mv -> specs/sub/Mv2.mdx#mv",
  "files:",
  "  specs/Mv.mdx",
  "    0-78 file-relocation",
  "    16-29 import-specifier-rewrite",
  "  specs/User.mdx",
  "    15-27 import-specifier-rewrite",
  "delta:",
  "  generated specs/sub/Mv2.md",
  "  generated specs/sub/Mv2.xspec.ts",
  "  removed specs/Mv.md",
  "  removed specs/Mv.xspec.ts",
];

/** The condition-23 finding's human line (T6.6-6's corrupt record). */
const UNREADABLE_RECORD_LINE =
  ".xspec: unreadable-record: the recorded generation state under the graph-data area exists but cannot be read as a record, so the recorded derived-file paths are unavailable (SPEC 14.23, 13.3)";

/**
 * A move preview on a corrupt record (T6.6-6's shape): the condition-23
 * finding beside the full plan, the delta unavailable as one datum, exit 1.
 */
const JSON_CORRUPT_RECORD_TWIN = decodePreviewReport(
  {
    findings: [jsonFinding("unreadable-record", [], ".xspec", [])],
    mapping: [{ from: "specs/Origin.mdx#org.mv", to: "specs/Target.mdx#tm" }],
    files: [
      {
        file: "specs/Origin.mdx",
        edits: [
          jsonEdit("origin-deletion", 34, 124),
          jsonEdit("id-rewrite", 37, 48),
        ],
      },
      {
        file: "specs/Target.mdx",
        edits: [jsonEdit("target-insertion", 31, 31)],
      },
    ],
    delta: { unavailable: true },
  },
  "the corrupt-record --json twin",
);

const HUMAN_CORRUPT_RECORD_LINES: readonly string[] = [
  UNREADABLE_RECORD_LINE,
  "mapping:",
  "  specs/Origin.mdx#org.mv -> specs/Target.mdx#tm",
  "files:",
  "  specs/Origin.mdx",
  "    34-124 origin-deletion",
  "    37-48 id-rewrite",
  "  specs/Target.mdx",
  "    31-31 target-insertion",
  "delta: unavailable",
];

/** A refused preview (T6.6-3's): the refusal findings alone, plans null. */
const JSON_REFUSED_TWIN = decodePreviewReport(
  {
    findings: [
      jsonFinding(
        "refused-id-collision",
        [{ file: "specs/M.mdx", start: 33, end: 75 }],
        null,
        ["specs/M.mdx#keep.mv"],
      ),
      jsonFinding(
        "refused-cycle",
        [{ file: "specs/M.mdx", start: 96, end: 102 }],
        null,
        [],
      ),
    ],
    mapping: null,
    files: null,
    delta: null,
  },
  "the refused --json twin",
);

const HUMAN_REFUSED_LINES: readonly string[] = [
  'specs/M.mdx:33-75: refused-id-collision: ID collision: the operation would produce "keep.mv" (SPEC 6.4, 6.5, 14) [specs/M.mdx#keep.mv]',
  "specs/M.mdx:96-102: refused-cycle: the move would create a dependency cycle (SPEC 6.5, 14)",
  "2 findings",
];

/** A report's bytes: each line ended by a line feed. */
function previewReport(lines: readonly string[]): Buffer {
  return Buffer.from(lines.map((line) => `${line}\n`).join(""), "utf8");
}

/** `lines` with line `index` replaced by `line`, or dropped for `null`. */
function previewWithLine(
  lines: readonly string[],
  index: number,
  line: string | null,
): string[] {
  return lines.flatMap((original, at) =>
    at === index ? (line === null ? [] : [line]) : [original],
  );
}

test("S-5: the human preview decoder decodes a well-formed preview onto the preview model, order free", () => {
  const decoded = decodeHumanPreviewReport(
    previewReport(HUMAN_SECTION_MOVE_LINES),
    "section move",
  );
  expect(decoded.findings).toEqual([]);
  expect(
    decoded.plan?.mapping.map(({ from, to, line }) => ({ from, to, line })),
  ).toEqual([
    {
      from: "specs/Origin.mdx#org.mv",
      to: "specs/Target.mdx#tp.nw",
      line: 2,
    },
    {
      from: "specs/Origin.mdx#org.mv.kid",
      to: "specs/Target.mdx#tp.nw.kid",
      line: 3,
    },
  ]);
  expect(
    decoded.plan?.files.map(({ file, edits, line }) => ({
      file,
      line,
      edits: edits.map((edit) => [
        edit.class,
        edit.range.start,
        edit.range.end,
        edit.line,
      ]),
    })),
  ).toEqual([
    {
      file: "specs/Origin.mdx",
      line: 5,
      edits: [
        ["import-removal", 0, 33, 6],
        ["origin-deletion", 69, 182, 7],
        ["id-rewrite", 74, 85, 8],
        ["reference-rewrite", 90, 98, 9],
      ],
    },
    {
      file: "specs/Target.mdx",
      line: 10,
      edits: [
        ["target-parent-rewrite", 40, 53, 11],
        ["target-insertion", 53, 53, 12],
        ["import-addition", 53, 53, 13],
      ],
    },
    {
      file: "specs/Third.mdx",
      line: 14,
      edits: [
        ["import-addition", 33, 33, 15],
        ["reference-rewrite", 85, 99, 16],
      ],
    },
  ]);
  expect(decoded.plan?.delta).toEqual({ generated: [], removed: [] });
  assertHumanPreviewCarries(decoded, JSON_SECTION_MOVE_TWIN, "section move");
  assertHumanPreviewReportCarries(
    syntheticBytesResult(
      previewReport(HUMAN_SECTION_MOVE_LINES),
      Buffer.alloc(0),
      0,
    ),
    JSON_SECTION_MOVE_TWIN,
    "section move, as a run",
  );

  // Order free: the pairs, the files, the edits, and the sections in
  // another order, the delta's directions interleaved; a class spelled in
  // another case with a space, as a code is read.
  const reordered = [
    "delta:",
    "  removed specs/Mv.xspec.ts",
    "  generated specs/sub/Mv2.xspec.ts",
    "  removed specs/Mv.md",
    "  generated specs/sub/Mv2.md",
    "files:",
    "  specs/User.mdx",
    "    15-27 Import Specifier Rewrite",
    "  specs/Mv.mdx",
    "    16-29 import-specifier-rewrite",
    "    0-78 file-relocation",
    "mapping:",
    "  specs/Mv.mdx#mv -> specs/sub/Mv2.mdx#mv",
    "  specs/Mv.mdx -> specs/sub/Mv2.mdx",
  ];
  assertHumanPreviewCarries(
    decodeHumanPreviewReport(previewReport(HUMAN_FILE_MOVE_LINES), "file move"),
    JSON_FILE_MOVE_TWIN,
    "file move",
  );
  const shuffled = decodeHumanPreviewReport(
    previewReport(reordered),
    "file move reordered",
  );
  expect(shuffled.plan?.delta).toMatchObject({
    generated: [
      { path: "specs/sub/Mv2.xspec.ts", line: 3 },
      { path: "specs/sub/Mv2.md", line: 5 },
    ],
    removed: [
      { path: "specs/Mv.xspec.ts", line: 2 },
      { path: "specs/Mv.md", line: 4 },
    ],
  });
  assertHumanPreviewCarries(
    shuffled,
    JSON_FILE_MOVE_TWIN,
    "file move reordered",
  );

  // A file listed twice reads as one file, its edits merged.
  assertHumanPreviewCarries(
    decodeHumanPreviewReport(
      previewReport([
        ...HUMAN_FILE_MOVE_LINES.slice(0, 6),
        "  specs/User.mdx",
        "    15-27 import-specifier-rewrite",
        "  specs/Mv.mdx",
        "    16-29 import-specifier-rewrite",
        ...HUMAN_FILE_MOVE_LINES.slice(9),
      ]),
      "a file listed twice",
    ),
    JSON_FILE_MOVE_TWIN,
    "a file listed twice",
  );

  // A creation's edit at the new file's start (T6.6-4(d)'s shape).
  const created = decodeHumanPreviewReport(
    previewReport([
      "mapping:",
      "  specs/Solo.mdx#hold.out -> specs/Made.mdx#made",
      "files:",
      "  specs/Made.mdx",
      "    0-0 file-creation",
      "delta:",
      "  generated specs/Made.xspec.ts",
    ]),
    "created target",
  );
  expect(created.plan?.files[0]?.edits[0]).toMatchObject({
    class: "file-creation",
    range: { start: 0, end: 0 },
  });
});

test("S-5: the human preview decoder decodes a refused preview's findings and an answer's finding beside its unavailable delta", () => {
  // A refused preview: the findings report, its count line ending it, and
  // no plan — carrying its refused twin, plans null.
  const refused = decodeHumanPreviewReport(
    previewReport(HUMAN_REFUSED_LINES),
    "refused",
  );
  expect(refused.plan).toBeNull();
  expect(refused.findings.map(findingInformation)).toEqual([
    {
      code: "refused-id-collision",
      locations: [{ file: "specs/M.mdx", range: { start: 33, end: 75 } }],
      path: null,
      identities: ["specs/M.mdx#keep.mv"],
    },
    {
      code: "refused-cycle",
      locations: [{ file: "specs/M.mdx", range: { start: 96, end: 102 } }],
      path: null,
      identities: [],
    },
  ]);
  assertHumanPreviewCarries(refused, JSON_REFUSED_TWIN, "refused");

  // The corrupt record: the condition-23 finding at the margin, then the
  // plan, `delta: unavailable` its delta — no count line, and with one.
  const corrupt = decodeHumanPreviewReport(
    previewReport(HUMAN_CORRUPT_RECORD_LINES),
    "corrupt record",
  );
  expect(corrupt.findings.map(findingInformation)).toEqual([
    {
      code: "unreadable-record",
      locations: [],
      path: ".xspec",
      identities: [],
    },
  ]);
  expect(corrupt.plan?.delta).toEqual({ unavailable: true, line: 10 });
  assertHumanPreviewCarries(corrupt, JSON_CORRUPT_RECORD_TWIN, "corrupt");
  assertHumanPreviewCarries(
    decodeHumanPreviewReport(
      previewReport([
        UNREADABLE_RECORD_LINE,
        "1 finding",
        ...HUMAN_CORRUPT_RECORD_LINES.slice(1),
      ]),
      "corrupt record, counted",
    ),
    JSON_CORRUPT_RECORD_TWIN,
    "corrupt record, counted",
  );

  // A concerned path holding a line feed (T6.5-4's barred destination),
  // printed as it stands: the line it breaks off is read with the next.
  const broken = "specs/a\nb.mdx";
  const brokenTwin = decodePreviewReport(
    {
      findings: [jsonFinding("refused-invalid-destination", [], broken, [])],
      mapping: null,
      files: null,
      delta: null,
    },
    "a line-fed path's twin",
  );
  const brokenReport = previewReport([
    `${broken}: refused-invalid-destination: invalid destination "specs/a\\nb.mdx" (SPEC 6.5)`,
    "1 finding",
  ]);
  assertHumanPreviewCarries(
    decodeHumanPreviewReport(brokenReport, "a line-fed path"),
    brokenTwin,
    "a line-fed path",
  );
  assertHumanFindingsCarry(
    decodeHumanFindingsReport(brokenReport, "a line-fed path"),
    brokenTwin.findings,
    "a line-fed path, as a findings report",
  );
  assertHumanFindingsCarry(
    decodeHumanFindingsReport(
      previewReport([
        `${broken}:3-4: missing-id: missing ID (SPEC 14.1)`,
        "1 finding",
      ]),
      "a line-fed location file",
    ),
    decodeFindingsReport(
      {
        findings: [
          jsonFinding(
            "missing-id",
            [{ file: broken, start: 3, end: 4 }],
            null,
            [],
          ),
        ],
      },
      "a line-fed location file's twin",
    ).findings,
    "a line-fed location file",
  );
});

test("S-5: the human preview decoder rejects an edit without its range, a delta line without its direction, a mapping pair half absent, and every line outside its layout", () => {
  const rejected = (
    label: string,
    report: Buffer,
    ...fragments: readonly string[]
  ): void => {
    const failure = expectDiagnosed(label, () =>
      decodeHumanPreviewReport(report, label),
    );
    for (const fragment of fragments) {
      expect(failure.message, label).toContain(fragment);
    }
    expect(failure.message, label).toContain(label);
  };
  const lines = HUMAN_SECTION_MOVE_LINES;
  // An edit: without its range, with one offset, its range reversed, its
  // class unknown or absent, above every file.
  rejected(
    "an edit without its range",
    previewReport(previewWithLine(lines, 7, "    id-rewrite")),
    "an edit line `    <start>-<end> <class>`",
    "line 8",
  );
  rejected(
    "an edit with one offset",
    previewReport(previewWithLine(lines, 7, "    74 id-rewrite")),
    "an edit line `    <start>-<end> <class>`",
  );
  rejected(
    "an edit's range reversed",
    previewReport(previewWithLine(lines, 7, "    85-74 id-rewrite")),
    "a range whose end is not before its start",
  );
  rejected(
    "an edit's class unknown",
    previewReport(previewWithLine(lines, 7, "    74-85 id-rename")),
    "the edit's class, one of the ten class names SPEC 12.7 lists",
  );
  rejected(
    "an edit's class absent",
    previewReport(previewWithLine(lines, 7, "    74-85")),
    "an edit line `    <start>-<end> <class>`",
  );
  rejected(
    "an edit above every file",
    previewReport(previewWithLine(lines, 4, null)),
    "an edit line beneath the file it edits",
  );
  // A mapping pair: its arrow or either identity absent, or ambiguous.
  rejected(
    "a mapping pair without its arrow",
    previewReport(previewWithLine(lines, 1, "  specs/Origin.mdx#org.mv")),
    "a mapping line `  <from> -> <to>`",
  );
  rejected(
    "a mapping pair without its to identity",
    previewReport(previewWithLine(lines, 1, "  specs/Origin.mdx#org.mv -> ")),
    "its `to` identity is absent",
  );
  rejected(
    "a mapping pair without its from identity",
    previewReport(previewWithLine(lines, 1, "   -> specs/Target.mdx#tp.nw")),
    "its `from` identity is absent",
  );
  rejected(
    "an ambiguous mapping pair",
    previewReport(previewWithLine(lines, 1, "  specs/a -> specs/b -> specs/c")),
    "this line holds several",
  );
  // A delta line: its direction absent or unknown; a path beneath an
  // unavailable delta.
  rejected(
    "a delta line without its direction",
    previewReport([...lines, "  specs/Target.md"]),
    "a delta line `  <direction> <path>`",
  );
  rejected(
    "a delta line with another direction",
    previewReport([...lines, "  added specs/Target.md"]),
    "a delta line `  <direction> <path>`",
  );
  rejected(
    "a delta line without its path",
    previewReport([...lines, "  generated "]),
    "a path, never an empty token",
  );
  rejected(
    "a path beneath an unavailable delta",
    previewReport([
      ...HUMAN_CORRUPT_RECORD_LINES,
      "  generated specs/Target.xspec.ts",
    ]),
    "nothing beneath `delta: unavailable`",
  );
  // The sections: one opened twice, one missing; an indented line outside
  // every section; an empty line; a count line disagreeing; a line fitting
  // no layout; bytes that are not UTF-8.
  rejected(
    "a section opened twice",
    previewReport([...lines, "files:"]),
    "each of the plan's sections once",
  );
  rejected(
    "the delta section missing",
    previewReport(lines.slice(0, -1)),
    "the delta section is missing",
  );
  rejected(
    "the mapping section missing",
    previewReport(lines.slice(3)),
    "the mapping section is missing",
  );
  rejected(
    "an indented line outside every section",
    previewReport(["  specs/Origin.mdx#org.mv -> specs/Target.mdx#tm"]),
    "an indented line inside one of the plan's sections",
  );
  rejected(
    "an empty line",
    previewReport(previewWithLine(lines, 3, "")),
    "never an empty line",
  );
  rejected(
    "a count line disagreeing",
    previewReport([
      UNREADABLE_RECORD_LINE,
      "2 findings",
      ...HUMAN_CORRUPT_RECORD_LINES.slice(1),
    ]),
    "it counts 2",
  );
  rejected(
    "a line fitting no layout",
    previewReport(["plan:", ...lines.slice(1)]),
    "no segment of this line spells a stable code",
  );
  rejected(
    "bytes that are not UTF-8",
    Buffer.concat([
      previewReport(lines.slice(0, 4)),
      Buffer.from("  ", "utf8"),
      NON_UTF8_PATH_BYTES,
      Buffer.from("\n", "utf8"),
      previewReport(lines.slice(5)),
    ]),
    "so these bytes are a path printed raw",
  );
});

test("S-5: the human preview comparison rejects a report omitting or misplacing a mapping pair, a file, an edit's class or range, a delta path or direction, the delta's unavailability, a finding, or the plan — naming the datum", () => {
  const rejected = (
    label: string,
    lines: readonly string[],
    twin: PreviewReport,
    ...fragments: readonly string[]
  ): void => {
    const failure = expectDiagnosed(label, () =>
      assertHumanPreviewCarries(
        decodeHumanPreviewReport(previewReport(lines), label),
        twin,
        label,
      ),
    );
    for (const fragment of fragments) {
      expect(failure.message, label).toContain(fragment);
    }
    expect(failure.message, label).toContain(label);
  };
  const section = HUMAN_SECTION_MOVE_LINES;
  const file = HUMAN_FILE_MOVE_LINES;
  // The mapping: a pair dropped, its `to` another, a pair too many.
  rejected(
    "a mapping pair dropped",
    previewWithLine(section, 2, null),
    JSON_SECTION_MOVE_TWIN,
    'the mapping pair "specs/Origin.mdx#org.mv.kid" -> "specs/Target.mdx#tp.nw.kid" is missing',
  );
  rejected(
    "a mapping pair's to identity another",
    previewWithLine(
      section,
      2,
      "  specs/Origin.mdx#org.mv.kid -> specs/Target.mdx#tp.kid",
    ),
    JSON_SECTION_MOVE_TWIN,
    'line 3 pairs "specs/Origin.mdx#org.mv.kid" -> "specs/Target.mdx#tp.kid" instead',
  );
  rejected(
    "a mapping pair too many",
    [
      ...section.slice(0, 3),
      "  specs/Origin.mdx#org -> specs/Target.mdx#tp",
      ...section.slice(3),
    ],
    JSON_SECTION_MOVE_TWIN,
    "which the --json twin's mapping lacks",
  );
  // The files: one dropped with its edits, one too many.
  rejected(
    "a file dropped",
    section.slice(0, 13).concat(section.slice(16)),
    JSON_SECTION_MOVE_TWIN,
    'the file "specs/Third.mdx" is missing, with its 2 edit(s) import-addition 33-33, reference-rewrite 85-99',
  );
  rejected(
    "a file too many",
    [
      ...section.slice(0, 16),
      "  specs/Fourth.mdx",
      "    1-2 reference-rewrite",
      "delta:",
    ],
    JSON_SECTION_MOVE_TWIN,
    'line 17 lists the file "specs/Fourth.mdx", which the --json twin\'s files lack',
  );
  // The edits: one dropped, an offset moved, a class another, one under
  // another file, a zero-length coincidence printed once.
  rejected(
    "an edit dropped",
    previewWithLine(section, 15, null),
    JSON_SECTION_MOVE_TWIN,
    'in "specs/Third.mdx", the edit reference-rewrite 85-99 is missing',
  );
  rejected(
    "an edit's offset moved",
    previewWithLine(section, 15, "    85-100 reference-rewrite"),
    JSON_SECTION_MOVE_TWIN,
    'in "specs/Third.mdx", the edit reference-rewrite 85-99 is missing — the nearest reference-rewrite edit there, line 16, spans 85-100',
  );
  rejected(
    "an edit's class another",
    previewWithLine(section, 7, "    74-85 reference-rewrite"),
    JSON_SECTION_MOVE_TWIN,
    'in "specs/Origin.mdx", the edit id-rewrite 74-85 is missing',
    "line 8 lists the edit reference-rewrite 74-85, which the --json twin lacks",
  );
  rejected(
    "an edit under another file",
    [
      ...section.slice(0, 9),
      "    85-99 reference-rewrite",
      ...section.slice(9, 15),
      ...section.slice(16),
    ],
    JSON_SECTION_MOVE_TWIN,
    'in "specs/Third.mdx", the edit reference-rewrite 85-99 is missing',
    'in "specs/Origin.mdx", line 10 lists the edit reference-rewrite 85-99',
  );
  rejected(
    "a coincidence printed once",
    previewWithLine(section, 12, null),
    JSON_SECTION_MOVE_TWIN,
    'in "specs/Target.mdx", the edit import-addition 53-53 is missing',
  );
  // The delta: a path dropped, a path under the other direction, a path
  // too many, the delta unavailable on either side alone.
  rejected(
    "a delta path dropped",
    previewWithLine(file, 11, null),
    JSON_FILE_MOVE_TWIN,
    'the generated path "specs/sub/Mv2.xspec.ts" is missing',
  );
  rejected(
    "a delta path under the other direction",
    previewWithLine(file, 12, "  generated specs/Mv.md"),
    JSON_FILE_MOVE_TWIN,
    'the path "specs/Mv.md", removed in the --json twin, is listed under generated on line 13',
  );
  rejected(
    "a delta path too many",
    [...file, "  removed specs/Pal.md"],
    JSON_FILE_MOVE_TWIN,
    'line 15 lists the removed path "specs/Pal.md", which the --json twin\'s delta lacks',
  );
  rejected(
    "the delta unavailable where the twin carries it",
    [...file.slice(0, 9), "delta: unavailable"],
    JSON_FILE_MOVE_TWIN,
    "line 10 reports the delta unavailable where the --json twin carries its two directions",
  );
  rejected(
    "the delta a value where the twin's is unavailable",
    [...HUMAN_CORRUPT_RECORD_LINES.slice(0, -1), "delta:"],
    JSON_CORRUPT_RECORD_TWIN,
    "the --json twin reports the delta unavailable",
  );
  // The findings: the condition-23 finding dropped beside the plan; a
  // refusal's finding dropped.
  rejected(
    "the condition-23 finding dropped",
    HUMAN_CORRUPT_RECORD_LINES.slice(1),
    JSON_CORRUPT_RECORD_TWIN,
    "has no counterpart: the human report carries no further finding with its code unreadable-record",
  );
  rejected(
    "a refusal's finding dropped",
    [HUMAN_REFUSED_LINES[0]!, "1 finding"],
    JSON_REFUSED_TWIN,
    "the human report carries no further finding with its code refused-cycle",
  );
  // The plan: none printed for a successful preview, one printed beside a
  // refusal's findings.
  rejected(
    "nothing printed",
    [],
    JSON_SECTION_MOVE_TWIN,
    "the human report prints no plan",
  );
  rejected(
    "a plan beside a refusal's findings",
    [...HUMAN_REFUSED_LINES.slice(0, 2), ...section],
    JSON_REFUSED_TWIN,
    "but the human report prints a plan (2 mapping pair(s), 3 file(s))",
  );
  // A path in another form: a plain file path presented marked.
  rejected(
    "a plain path presented marked",
    previewWithLine(
      section,
      13,
      `  <bytes ${Buffer.from("specs/Third.mdx", "utf8").toString("hex")}>`,
    ),
    JSON_SECTION_MOVE_TWIN,
    'the file "specs/Third.mdx" is missing',
    "lists the file the marked byte form of",
  );
});

// --- the human performed-report decoder (T12.0-15) ------------------------------

/** T6.4-1's rename: the renamed node and its descendant, form-exact. */
const JSON_RENAME_PERFORMED_TWIN = decodePerformedOperationReport(
  {
    findings: [],
    mapping: [
      { from: "specs/Core.mdx#core.mid", to: "specs/Core.mdx#core.hub" },
      {
        from: "specs/Core.mdx#core.mid.leaf",
        to: "specs/Core.mdx#core.hub.leaf",
      },
    ],
  },
  "the performed rename's --json twin",
);

/** The built product's human report of that rename (the module header's layout). */
const HUMAN_RENAME_PERFORMED_LINES: readonly string[] = [
  "specs/Core.mdx#core.mid -> specs/Core.mdx#core.hub",
  "specs/Core.mdx#core.mid.leaf -> specs/Core.mdx#core.hub.leaf",
  "2 identities mapped",
];

/** T6.5-1's file move: the root's bare paths, then every section. */
const JSON_FILE_MOVE_PERFORMED_TWIN = decodePerformedOperationReport(
  {
    findings: [],
    mapping: [
      { from: "specs/A.mdx", to: "specs/sub/A.mdx" },
      { from: "specs/A.mdx#a", to: "specs/sub/A.mdx#a" },
      { from: "specs/A.mdx#a.mid", to: "specs/sub/A.mdx#a.mid" },
      { from: "specs/A.mdx#a.mid.leaf", to: "specs/sub/A.mdx#a.mid.leaf" },
    ],
  },
  "the performed file move's --json twin",
);

const HUMAN_FILE_MOVE_PERFORMED_LINES: readonly string[] = [
  "specs/A.mdx -> specs/sub/A.mdx",
  "specs/A.mdx#a -> specs/sub/A.mdx#a",
  "specs/A.mdx#a.mid -> specs/sub/A.mdx#a.mid",
  "specs/A.mdx#a.mid.leaf -> specs/sub/A.mdx#a.mid.leaf",
  "4 identities mapped",
];

test("S-5: the human performed-report decoder decodes a well-formed report onto the applied mapping, order free", () => {
  const decoded = decodeHumanPerformedReport(
    previewReport(HUMAN_RENAME_PERFORMED_LINES),
    "rename",
  );
  expect(
    decoded.mapping.map(({ from, to, line }) => ({ from, to, line })),
  ).toEqual([
    {
      from: "specs/Core.mdx#core.mid",
      to: "specs/Core.mdx#core.hub",
      line: 1,
    },
    {
      from: "specs/Core.mdx#core.mid.leaf",
      to: "specs/Core.mdx#core.hub.leaf",
      line: 2,
    },
  ]);
  assertHumanPerformedCarries(decoded, JSON_RENAME_PERFORMED_TWIN, "rename");
  expect(
    assertHumanPerformedReportCarries(
      syntheticBytesResult(
        previewReport(HUMAN_RENAME_PERFORMED_LINES),
        Buffer.alloc(0),
        0,
      ),
      JSON_RENAME_PERFORMED_TWIN,
      "rename, as a run",
    ).mapping,
  ).toHaveLength(2);
  assertHumanPerformedCarries(
    decodeHumanPerformedReport(
      previewReport(HUMAN_FILE_MOVE_PERFORMED_LINES),
      "file move",
    ),
    JSON_FILE_MOVE_PERFORMED_TWIN,
    "file move",
  );

  // Order free: the pairs in another order; no count line; the count line
  // in the singular for one pair.
  assertHumanPerformedCarries(
    decodeHumanPerformedReport(
      previewReport([
        HUMAN_FILE_MOVE_PERFORMED_LINES[3]!,
        HUMAN_FILE_MOVE_PERFORMED_LINES[1]!,
        HUMAN_FILE_MOVE_PERFORMED_LINES[0]!,
        HUMAN_FILE_MOVE_PERFORMED_LINES[2]!,
        "4 identities mapped",
      ]),
      "file move reordered",
    ),
    JSON_FILE_MOVE_PERFORMED_TWIN,
    "file move reordered",
  );
  assertHumanPerformedCarries(
    decodeHumanPerformedReport(
      previewReport(HUMAN_RENAME_PERFORMED_LINES.slice(0, 2)),
      "rename without its count line",
    ),
    JSON_RENAME_PERFORMED_TWIN,
    "rename without its count line",
  );
  const single = decodeHumanPerformedReport(
    previewReport(["specs/C.mdx#c -> specs/C.mdx#c2", "1 identity mapped"]),
    "one pair",
  );
  assertHumanPerformedCarries(
    single,
    decodePerformedOperationReport(
      {
        findings: [],
        mapping: [{ from: "specs/C.mdx#c", to: "specs/C.mdx#c2" }],
      },
      "one pair's twin",
    ),
    "one pair",
  );
  // A report with no line decodes to no pair (the comparison names what
  // the twin carries).
  expect(decodeHumanPerformedReport(Buffer.alloc(0), "empty").mapping).toEqual(
    [],
  );
});

test("S-5: the human performed-report decoder rejects a pair half absent, an ambiguous pair, a disagreeing count, an empty line, and every line outside its layout", () => {
  const rejected = (
    label: string,
    report: Buffer,
    ...fragments: readonly string[]
  ): void => {
    const failure = expectDiagnosed(label, () =>
      decodeHumanPerformedReport(report, label),
    );
    for (const fragment of fragments) {
      expect(failure.message, label).toContain(fragment);
    }
    expect(failure.message, label).toContain(label);
  };
  const lines = HUMAN_RENAME_PERFORMED_LINES;
  rejected(
    "a pair without its arrow",
    previewReport(previewWithLine(lines, 1, "specs/Core.mdx#core.mid.leaf")),
    "a mapping line `<from> -> <to>`",
    "line 2",
  );
  rejected(
    "a pair without its to identity",
    previewReport(
      previewWithLine(lines, 1, "specs/Core.mdx#core.mid.leaf -> "),
    ),
    "its `to` identity is absent",
  );
  rejected(
    "a pair without its from identity",
    previewReport(previewWithLine(lines, 0, " -> specs/Core.mdx#core.hub")),
    "its `from` identity is absent",
  );
  rejected(
    "an ambiguous pair",
    previewReport(previewWithLine(lines, 0, "specs/a -> specs/b -> specs/c")),
    "this line holds several",
  );
  rejected(
    "a count line disagreeing",
    previewReport(previewWithLine(lines, 2, "3 identities mapped")),
    "a count line equal to the 2 mapping line(s) the report lists — it counts 3",
  );
  rejected(
    "a count line before a pair",
    previewReport([lines[0]!, lines[2]!, lines[1]!]),
    "a mapping line `<from> -> <to>`",
    "line 2",
  );
  rejected(
    "an empty line",
    previewReport(previewWithLine(lines, 1, "")),
    "never an empty line",
  );
  rejected(
    "a finding line",
    previewReport(HUMAN_REFUSED_LINES.slice(0, 1)),
    "a mapping line `<from> -> <to>`",
  );
  rejected(
    "bytes that are not UTF-8",
    Buffer.concat([
      Buffer.from("specs/A.mdx -> ", "utf8"),
      NON_UTF8_PATH_BYTES,
      Buffer.from("\n", "utf8"),
    ]),
    "so these bytes are a path printed raw",
  );
});

test("S-5: the human performed-report comparison rejects a report omitting or changing a pair, or listing one the twin lacks — naming the pair", () => {
  const rejected = (
    label: string,
    lines: readonly string[],
    ...fragments: readonly string[]
  ): void => {
    const failure = expectDiagnosed(label, () =>
      assertHumanPerformedCarries(
        decodeHumanPerformedReport(previewReport(lines), label),
        JSON_RENAME_PERFORMED_TWIN,
        label,
      ),
    );
    for (const fragment of fragments) {
      expect(failure.message, label).toContain(fragment);
    }
    expect(failure.message, label).toContain(label);
  };
  const lines = HUMAN_RENAME_PERFORMED_LINES;
  rejected(
    "a pair dropped",
    [lines[0]!, "1 identity mapped"],
    'the mapping pair "specs/Core.mdx#core.mid.leaf" -> "specs/Core.mdx#core.hub.leaf" is missing',
  );
  rejected(
    "a pair's to identity another",
    previewWithLine(
      lines,
      1,
      "specs/Core.mdx#core.mid.leaf -> specs/Core.mdx#core.hub.leaf2",
    ),
    'line 2 pairs "specs/Core.mdx#core.mid.leaf" -> "specs/Core.mdx#core.hub.leaf2" instead',
  );
  rejected(
    "a pair's from identity another",
    previewWithLine(
      lines,
      0,
      "specs/Core.mdx#core.mid2 -> specs/Core.mdx#core.hub",
    ),
    'line 1 pairs "specs/Core.mdx#core.mid2" -> "specs/Core.mdx#core.hub" instead',
  );
  rejected(
    "a pair's identities swapped",
    previewWithLine(
      lines,
      0,
      "specs/Core.mdx#core.hub -> specs/Core.mdx#core.mid",
    ),
    'the mapping pair "specs/Core.mdx#core.mid" -> "specs/Core.mdx#core.hub" is missing',
    'line 1 lists the mapping pair "specs/Core.mdx#core.hub" -> "specs/Core.mdx#core.mid", which the --json twin\'s mapping lacks',
  );
  rejected(
    "a pair too many",
    [...lines.slice(0, 2), "specs/Core.mdx#core -> specs/Core.mdx#hub"],
    'line 3 lists the mapping pair "specs/Core.mdx#core" -> "specs/Core.mdx#hub", which the --json twin\'s mapping lacks',
  );
  rejected(
    "a pair listed twice",
    [lines[0]!, lines[0]!, lines[1]!],
    'line 2 lists the mapping pair "specs/Core.mdx#core.mid" -> "specs/Core.mdx#core.hub", which the --json twin\'s mapping lacks',
  );
  rejected(
    "nothing printed",
    [],
    'the mapping pair "specs/Core.mdx#core.mid" -> "specs/Core.mdx#core.hub" is missing',
    'the mapping pair "specs/Core.mdx#core.mid.leaf" -> "specs/Core.mdx#core.hub.leaf" is missing',
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

test("S-5: staging deletes an item's status, and separately its kind, by the assumed shape (a missing 10.2 field)", async () => {
  for (const [field, stage] of [
    ["status", stageDeleteItemStatus],
    ["kind", stageDeleteItemKind],
  ] as const) {
    const { file, read } = await sessionWorkspace(WELL_SHAPED_SESSION);
    await stage(file);
    const doc = await read();
    const items = itemsOf(doc);
    const { [field]: deleted, ...kept } = WELL_SHAPED_SESSION.items[0];
    expect(deleted).toBeDefined(); // the synthetic entry carried the field
    expect(items[0]).toEqual(kept); // that one field gone, nothing else
    expect(items[1]).toEqual(WELL_SHAPED_SESSION.items[1]);
    expect({ ...doc, items: WELL_SHAPED_SESSION.items }).toEqual(
      WELL_SHAPED_SESSION,
    );
  }
});

// The pre-`split` file of a session and the post-`split` file the product
// wrote after it (synthetic, per the layer's assumed shape, keys sorted as
// SPEC 13.4 writes them): `split` removed the original `i1` — its id never
// reused — recorded its kind and scope node as decomposed, and added the
// per-child item `i2` and the scope root's parent-consistency item `i3`.
const PRE_SPLIT_SESSION = {
  creationParameters: { base: "c0ffee" },
  decompositions: [],
  items: [
    {
      baseline: {
        nodes: { "specs/A.mdx#a": { hashes: { subtreeHash: "h1" } } },
      },
      blockedBy: [],
      id: "i1",
      kind: "subtree-coherence",
      note: "kept as written",
      scope: "specs/A.mdx#a",
      status: "unresolved",
    },
  ],
};
const POST_SPLIT_SESSION = {
  creationParameters: { base: "c0ffee" },
  decompositions: [{ kind: "subtree-coherence", scope: "specs/A.mdx#a" }],
  items: [
    {
      blockedBy: [],
      id: "i2",
      kind: "subtree-coherence",
      scope: "specs/A.mdx#a.k",
      status: "unresolved",
    },
    {
      blockedBy: ["i2"],
      id: "i3",
      kind: "parent-consistency",
      scope: "specs/A.mdx#a",
      status: "unresolved",
    },
  ],
};
const sessionBytes = (doc: unknown): Uint8Array =>
  Buffer.from(`${JSON.stringify(doc, null, 2)}\n`, "utf8");

test("S-5: staging re-inserts an item entry copied from an earlier file of the same session, whole and unchanged, keys still byte-sorted", async () => {
  const { workspace, file, read } = await sessionWorkspace(POST_SPLIT_SESSION);
  const earlier = sessionBytes(PRE_SPLIT_SESSION);
  const earlierCopy = Buffer.from(earlier);
  await stageReinsertItemEntry(file, earlier, "i1");
  const doc = await read();
  // The entry appended whole; every other member of the later file as it
  // was written; the earlier bytes untouched.
  expect(itemsOf(doc)).toEqual([
    ...POST_SPLIT_SESSION.items,
    PRE_SPLIT_SESSION.items[0],
  ]);
  expect({ ...doc, items: POST_SPLIT_SESSION.items }).toEqual(
    POST_SPLIT_SESSION,
  );
  expect(Buffer.compare(Buffer.from(earlier), earlierCopy)).toBe(0);
  // Key order kept as the product wrote it: the staged file is still
  // written with byte-sorted keys (SPEC 13.4), the re-inserted entry's
  // members included, so the one corruption is the re-inserted entry.
  assertJsonKeysByteSorted(
    await workspace.readBytes(SESSION_REL),
    "S-5 re-inserted session file",
  );
  // Recorded creation parameters compare whole, as values: the same members
  // written in another order record the same parameters.
  const reordered = await sessionWorkspace({
    ...POST_SPLIT_SESSION,
    creationParameters: { boundary: "main", mode: "direct", target: "main" },
  });
  await stageReinsertItemEntry(
    reordered.file,
    sessionBytes({
      ...PRE_SPLIT_SESSION,
      creationParameters: { target: "main", mode: "direct", boundary: "main" },
    }),
    "i1",
  );
  expect(itemsOf(await reordered.read())).toEqual([
    ...POST_SPLIT_SESSION.items,
    PRE_SPLIT_SESSION.items[0],
  ]);
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
    stageDeleteItemStatus,
    stageDeleteItemKind,
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
    label: "deleting a status the entry does not carry",
    contents:
      '{"items": [{"id": "i1", "kind": "subtree-coherence", "blockedBy": []}]}',
    stage: stageDeleteItemStatus,
  },
  {
    label: "deleting a kind the entry does not carry",
    contents:
      '{"items": [{"id": "i1", "status": "unresolved", "blockedBy": []}]}',
    stage: stageDeleteItemKind,
  },
  {
    label: "re-inserting from earlier bytes that are no JSON document",
    contents: JSON.stringify(POST_SPLIT_SESSION),
    stage: (file) =>
      stageReinsertItemEntry(file, Buffer.from('{"items": [', "utf8"), "i1"),
  },
  {
    label: "re-inserting from earlier bytes that are not valid UTF-8",
    contents: JSON.stringify(POST_SPLIT_SESSION),
    stage: (file) =>
      stageReinsertItemEntry(file, Uint8Array.from([0x7b, 0xff, 0x7d]), "i1"),
  },
  {
    label: "re-inserting from an earlier file holding no item list",
    contents: JSON.stringify(POST_SPLIT_SESSION),
    stage: (file) =>
      stageReinsertItemEntry(
        file,
        sessionBytes({ creationParameters: { base: "c0ffee" } }),
        "i1",
      ),
  },
  {
    label: "re-inserting an id no entry of the earlier file bears",
    contents: JSON.stringify(POST_SPLIT_SESSION),
    stage: (file) =>
      stageReinsertItemEntry(file, sessionBytes(PRE_SPLIT_SESSION), "i9"),
  },
  {
    label: "re-inserting an id two entries of the earlier file bear",
    contents: JSON.stringify(POST_SPLIT_SESSION),
    stage: (file) =>
      stageReinsertItemEntry(
        file,
        sessionBytes({
          ...PRE_SPLIT_SESSION,
          items: [PRE_SPLIT_SESSION.items[0], PRE_SPLIT_SESSION.items[0]],
        }),
        "i1",
      ),
  },
  {
    label: "re-inserting from an earlier entry without a string id",
    contents: JSON.stringify(POST_SPLIT_SESSION),
    stage: (file) =>
      stageReinsertItemEntry(
        file,
        sessionBytes({
          ...PRE_SPLIT_SESSION,
          items: [{ ...PRE_SPLIT_SESSION.items[0], id: 1 }],
        }),
        "i1",
      ),
  },
  {
    label: "re-inserting an id the later file already bears",
    contents: JSON.stringify(PRE_SPLIT_SESSION),
    stage: (file) =>
      stageReinsertItemEntry(file, sessionBytes(PRE_SPLIT_SESSION), "i1"),
  },
  {
    label:
      "re-inserting from another session's file (other creation parameters)",
    contents: JSON.stringify(POST_SPLIT_SESSION),
    stage: (file) =>
      stageReinsertItemEntry(
        file,
        sessionBytes({
          ...PRE_SPLIT_SESSION,
          creationParameters: { base: "beef" },
        }),
        "i1",
      ),
  },
  {
    label: "re-inserting from an earlier file recording no creation parameters",
    contents: JSON.stringify(POST_SPLIT_SESSION),
    stage: (file) =>
      stageReinsertItemEntry(
        file,
        sessionBytes({ items: PRE_SPLIT_SESSION.items }),
        "i1",
      ),
  },
  {
    label: "re-inserting into a later file recording no creation parameters",
    contents: JSON.stringify({ items: POST_SPLIT_SESSION.items }),
    stage: (file) =>
      stageReinsertItemEntry(file, sessionBytes(PRE_SPLIT_SESSION), "i1"),
  },
  {
    label: "re-inserting into a later file whose items are not an array",
    contents: JSON.stringify({ ...POST_SPLIT_SESSION, items: {} }),
    stage: (file) =>
      stageReinsertItemEntry(file, sessionBytes(PRE_SPLIT_SESSION), "i1"),
  },
  {
    label: "re-inserting into a path holding no session file",
    contents: undefined,
    stage: (file) =>
      stageReinsertItemEntry(file, sessionBytes(PRE_SPLIT_SESSION), "i1"),
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
// loud with nothing modified when there is nothing to corrupt — and every
// file in the set is reached at its exact name bytes, whatever the name
// (the set's layout is the product's, SPEC 13.3).

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

test.runIf(process.platform === "linux")(
  "S-5: corrupt-record staging reaches every graph-data file at its exact name bytes, a name that is not valid UTF-8 included (Linux)",
  async () => {
    // Graph data's layout is the product's (SPEC 13.3), so its file names
    // may be anything: a name that is not ASCII, and — where file names are
    // byte strings — one that is not valid UTF-8 (a UTF-8 listing would
    // leave such a file intact and write a stray at its U+FFFD spelling).
    const area = Buffer.from(`${GRAPH_DATA_AREA_PATH}/`);
    const nonAsciiName = Buffer.concat([
      Buffer.from("graph"),
      Buffer.from(String.fromCodePoint(0xe9), "utf8"),
      Buffer.from(".json"),
    ]);
    const invalidName = Buffer.from([0x61, 0xff, 0x2e, 0x6a, 0x73, 0x6f, 0x6e]);
    const invalidDir = Buffer.from([0x64, 0xfe]);
    const productWritten = [
      Buffer.concat([area, nonAsciiName]),
      Buffer.concat([area, invalidName]),
      Buffer.concat([area, invalidDir, Buffer.from("/"), invalidName]),
    ];
    const workspace = await TestWorkspace.create({
      files: {
        ".xspec/journal": '{"op": 1}\n',
        ".xspec/reviews/s1.json": '{"items": []}\n',
        ".xspec/graph.json": '{"nodes": []}\n',
      },
    });
    onTestFinished(() => workspace.dispose());
    for (const rel of productWritten) {
      await workspace.file(rel, '{"nodes": []}\n');
    }
    const before = await snapshotDirectory(workspace.root);
    const corrupted = await corruptGraphDataShapeBlind(
      workspace.root,
      "S-5 record staging (byte names)",
    );
    // Snapshot keys — the exact path bytes, latin1-held — in byte order.
    expect(corrupted).toEqual(
      [Buffer.from(".xspec/graph.json"), ...productWritten]
        .sort(Buffer.compare)
        .map((rel) => rel.toString("latin1")),
    );
    // Every one of them now holds exactly the garbage; everything else —
    // the durables, the directories, the file set itself — is untouched.
    const after = await snapshotDirectory(workspace.root);
    expect([...after.entries.keys()]).toEqual([...before.entries.keys()]);
    for (const [key, entry] of after.entries) {
      if (corrupted.includes(key)) {
        expect(entry.kind).toBe("file");
        expect(
          Buffer.compare(
            Buffer.from(await workspace.readBytes(snapshotKeyBytes(key))),
            Buffer.from(RECORD_GARBAGE_BYTES),
          ),
        ).toBe(0);
      } else {
        expect(
          describeEntryDifference(
            before.entries.get(key) as SnapshotEntry,
            entry,
          ),
        ).toBeUndefined();
      }
    }
  },
);

test("S-5: T13.3-2's operational path set is every path under .xspec/ but the durable journal and reviews paths and the transient lock path with everything under it", () => {
  // Graph data (SPEC 13.3): under the area, near misses of the excluded
  // names included — the lock path's exclusion reaches `.xspec/lock` and
  // the paths beginning `.xspec/lock/`, nothing beside them.
  for (const key of [
    ".xspec/graph.json",
    ".xspec/cache/part-a.bin",
    ".xspec/lockx",
    ".xspec/lock.tmp",
    ".xspec/locks/a",
    ".xspec/journal.tmp",
    ".xspec/reviewsx",
  ]) {
    expect(isGraphDataKey(key), key).toBe(true);
  }
  // No graph data: the area's own path, the durable journal and session
  // directory (SPEC 13.4), the transient lock path and everything under it
  // (13.4: no graph data, bearing on no comparison of graph data), and any
  // path outside the area (keys are workspace-relative, so a nested
  // workspace's area is no part of this one's).
  for (const key of [
    ".xspec",
    ".xspec/journal",
    ".xspec/reviews",
    ".xspec/reviews/s1.json",
    ".xspec/lock",
    ".xspec/lock/x",
    ".xspec/lock/d/f",
    "x/.xspec/lock",
    "x/.xspec/graph.json",
    ".xspecx/graph.json",
    "specs/A.mdx",
  ]) {
    expect(isGraphDataKey(key), key).toBe(false);
  }
});

test("S-5: corrupt-record staging spares the transient lock path — entries under the lock directory, and a plain file or a symbolic link at the lock path, untouched and never refused", async () => {
  // A run's entries in the lock directory (SPEC 13.5: coordination state,
  // 13.4: no graph data): neither corrupted nor listed.
  const held = await TestWorkspace.create({
    files: {
      ".xspec/graph.json": '{"nodes": []}\n',
      ".xspec/lock/x": "entry\n",
      ".xspec/lock/d/f": "nested\n",
    },
  });
  onTestFinished(() => held.dispose());
  const heldBefore = await snapshotDirectory(held.root);
  expect(
    await corruptGraphDataShapeBlind(held.root, "S-5 record staging (lock)"),
  ).toEqual([".xspec/graph.json"]);
  const heldAfter = await snapshotDirectory(held.root);
  expect([...heldAfter.entries.keys()]).toEqual([...heldBefore.entries.keys()]);
  for (const key of [
    ".xspec/lock",
    ".xspec/lock/x",
    ".xspec/lock/d",
    ".xspec/lock/d/f",
  ]) {
    expect(
      describeEntryDifference(
        heldBefore.entries.get(key) as SnapshotEntry,
        heldAfter.entries.get(key) as SnapshotEntry,
      ),
      key,
    ).toBeUndefined();
  }

  // Whatever occupies the lock path is skipped, as the durable paths are: a
  // plain file there (13.4: a leftover acquisition removes) is never
  // corrupted, and a symbolic link there is no occupant of the record's set
  // — never a loud refusal, its target never reached.
  const occupants: readonly {
    label: string;
    files: Readonly<Record<string, string>>;
    symlinks?: Readonly<Record<string, string>>;
  }[] = [
    {
      label: "a plain file at the lock path",
      files: { ".xspec/lock": "leftover\n" },
    },
    {
      label: "a symbolic link at the lock path",
      files: { "elsewhere/f": "target\n" },
      symlinks: { ".xspec/lock": "../elsewhere" },
    },
  ];
  for (const { label, files, symlinks } of occupants) {
    const workspace = await TestWorkspace.create({
      files: { ...files, ".xspec/graph.json": '{"nodes": []}\n' },
      symlinks,
    });
    onTestFinished(() => workspace.dispose());
    const before = await snapshotDirectory(workspace.root);
    expect(
      await corruptGraphDataShapeBlind(workspace.root, `S-5 (${label})`),
      label,
    ).toEqual([".xspec/graph.json"]);
    const after = await snapshotDirectory(workspace.root);
    expect([...after.entries.keys()], label).toEqual([
      ...before.entries.keys(),
    ]);
    for (const [key, entry] of after.entries) {
      if (key === ".xspec/graph.json") continue;
      expect(
        describeEntryDifference(
          before.entries.get(key) as SnapshotEntry,
          entry,
        ),
        `${label}: ${key}`,
      ).toBeUndefined();
    }
  }
});

test("S-5: the graph-data collector lists the operational path set's plain files, and beside them its directories, in byte order, nothing at or under the lock path, any other occupant handed to the caller or skipped", async () => {
  // The one walk behind the corruption and T14-10(f)'s unreadable staging:
  // the durable paths and the lock path are no part of the set, a symbolic
  // link in the set is neither a plain file nor a directory, whatever it
  // points at — the corruption refuses it through `onOther`, a caller
  // passing no handler skips it — and the set's directories, nested and
  // empty ones included, come beside its files (T14-10(f) stages each
  // `-wx`), never the area's own directory or one at or under an excluded
  // path.
  const workspace = await TestWorkspace.create({
    files: {
      ".xspec/journal": "j\n",
      ".xspec/reviews/s1.json": "{}",
      ".xspec/graph.json": "{}",
      ".xspec/cache/b": "b",
      ".xspec/cache/a": "a",
      ".xspec/cache/deep/c": "c",
      ".xspec/lock/x": "entry\n",
      ".xspec/lock/d/f": "nested\n",
    },
    dirs: [".xspec/empty", ".xspec/reviews/sub"],
    symlinks: { ".xspec/link.json": "graph.json", ".xspec/linkdir": "cache" },
  });
  onTestFinished(() => workspace.dispose());
  const expected = [
    ".xspec/cache/a",
    ".xspec/cache/b",
    ".xspec/cache/deep/c",
    ".xspec/graph.json",
  ];
  expect(await collectGraphDataFiles(workspace.root)).toEqual(expected);
  const others: string[] = [];
  expect(
    await collectGraphDataFiles(workspace.root, (key) => {
      others.push(key);
    }),
  ).toEqual(expected);
  expect(others).toEqual([".xspec/link.json", ".xspec/linkdir"]);
  const entries = await collectGraphDataEntries(workspace.root);
  expect(entries.files).toEqual(expected);
  expect(entries.directories).toEqual([
    ".xspec/cache",
    ".xspec/cache/deep",
    ".xspec/empty",
  ]);
  for (const key of [...entries.files, ...entries.directories]) {
    expect(isGraphDataKey(key), key).toBe(true);
  }
  // A layout with no directory below the area: files alone, an empty
  // directory list (T14-10(f) then stages files alone).
  const flat = await TestWorkspace.create({
    files: {
      ".xspec/journal": "j\n",
      ".xspec/b.json": "{}",
      ".xspec/a.json": "{}",
    },
  });
  onTestFinished(() => flat.dispose());
  expect(await collectGraphDataEntries(flat.root)).toEqual({
    files: [".xspec/a.json", ".xspec/b.json"],
    directories: [],
  });
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
