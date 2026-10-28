// TEST-SPEC §10.2 (review items) and §10.3 (statuses and blocking) —
// SUITE-34: T10.2-1…T10.2-4, T10.3-1, T10.3-2.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), decodes output through the H-3 adapters,
// and rejects a product only via diagnosed assertion failures (H-8).
//
// SPEC 10.2: an item carries `id`, `kind`, `scope`, `context`, `reason`,
// `origin`, `baseline`, `current`, `status`, optional `note`, `blockedBy`.
// `baseline` is fixed when the item enters the session — at `create`, at a
// re-derivation (10.5), or at a `split` — from its baseline state
// (baseline-commit values in a `--base` session; current-graph values at
// entry in audit and coverage sessions), a node joining the item later
// gaining no entry in it; `current` is written at creation and rewritten at
// each resolve, and reads report both as recorded — read-time invalidation
// compares `current` against the current graph and never rewrites it.
// SPEC 10.3: `updated`/`no-change`/`skipped` are the resolved statuses;
// `unresolved` and `invalidated` need review; a blocker that becomes
// invalidated re-blocks its dependents.
//
// Conservative operationalizations (noted per H-3/H-4):
// - `baseline` and `current` are recorded, product-shaped values, passed
//   through the adapter whole. "Holds the values" (T10.2-2, T10.2-4) is
//   realized against `query node` captures at each staged moment (the
//   protocol T10.2-4's TEST-SPEC text itself prescribes): the expected
//   moment's relevant hash values (SPEC 10.4 per kind) must appear among the
//   record's string leaves, and the wrong moments' pairwise-distinct hash
//   values must appear nowhere in it. Distinctness of every discriminating
//   value is asserted as a staging premise first.
// - The re-derivation arms (T10.2-2's newly visited p.q, authored section,
//   absent-marker, and joined-node arms; T10.2-4's newly visited p.q) read
//   the recorded state entry by entry instead, through the review adapter's
//   `decodeRecordedState` (review.ts; its assumed RecordedState shape): a
//   node's entry, its presence, and its hashes or the explicit absent marker
//   (SPEC 10.2, 10.4). A scope node's entry must present it present, its
//   subtreeHash and metadataHash each equal to the expected moment's capture
//   (`assertRecordedEntryAt`), a value equal to a wrong moment's diagnosed as
//   that moment's product; T10.5-8's d must have an entry presenting it
//   absent with the marker and none of its current hashes; and T10.4-7's d2
//   must have no entry in x's `baseline` and a present one in its `current`.
//   These arms run over the exported stagings of T10.4-7(a)
//   (section-10.4.ts `stageT1047Session`, `stageT1047State`), T10.5-5's
//   newly visited p.q (section-10.5.ts `stageT1055NewlyVisitedQ`, whose
//   `query node` captures at the baseline and at p's `updated` resolve they
//   compare against), and T10.5-8's four-edit staging (`stageT1058Session`),
//   each in a fresh workspace of its own; the stagings assert staging
//   premises alone.
// - "Fixed"/"still carries the recording" across reads is canonical-JSON
//   equality of the recorded member between reads (key order normalized:
//   SPEC.md fixes the information, not the concrete shape or member order,
//   H-3/H-4).
// - `context` and `origin` are asserted as identity sets (sorted): SPEC 10.5
//   fixes their membership; the payload's entry order is not pinned by the
//   §10.2–10.3 tests (byte-level payload contracts are T10.7-12's business,
//   as is text provenance — T10.2-3 byte-asserts the lost node's text against
//   the create-time capture because that state is the item's sole recorded
//   state, so provenance there is unambiguous).
// - `status` totals are compared as `totals[status] ?? 0` per defined status:
//   whether zero-count statuses appear as explicit entries is concrete-shape
//   territory (H-3).
// - Item IDs (T10.2-1; SPEC 10.2, 12.0): the review adapter decodes every
//   item ID it meets — each `status` row's, each item's at `next`, `show`,
//   and `export`, each `blockedBy` entry — as a well-formed argument value,
//   failing loudly on U+FFFD or an unpaired surrogate (review.ts
//   `decodeItemId`), so every ID any test observes is checked, P-9's draws
//   included. T10.2-1 then names each representative item by its own `id`
//   (`showRepresentativeItem`): `review show <name> <id>` exits 0 and
//   presents that item — the id, kind, and scope node its `status` row
//   reports.
// - A refused `resolve` on a blocked item (T10.3-2) goes through T10.7-14's
//   shared check (support.ts `expectReviewRefusal`): run with `--json`, exit
//   1 (a refused review operation is a findings-class outcome, SPEC
//   12.0/10.7) with standard output exactly one code-less finding — `code`
//   and `path` `null`, `locations` `[]` (SPEC 14, 12.7), `identities`
//   informational and unasserted — and the session file and the whole
//   workspace byte-identical: a refusal resolves nothing and sessions change
//   only through effective mutations (SPEC 10.1, 10.4, 13.4, 13.5) — the
//   compares run against freshly built graph data, so no 13.3 refresh
//   legitimately intervenes.
// - Fixture hash captures run right after an explicit `build` at each staged
//   moment, so no read relies on the 13.3 refresh path except where the
//   TEST-SPEC text stages it (T10.2-3 reads directly after the deletion).
//
// Sources staged after a body's first product invocation — every edit of a
// built workspace's spec source in T10.2-2, T10.2-4, T10.3-1, and T10.3-2,
// T10.2-2's authored section b and its edit, and T10.2-4's further p.q edit
// (spelled by section-10.5.ts's `t1055PqSource`) — are staged-source records
// (helpers/staged-mdx.ts, S-9: judged before any product exists), the same
// template calls moved to module level; so are the initial sources of every
// workspace a body creates after its first invocation — this module's, and
// the exported stagings' `T10_4_7_INITIAL_FILES`, `T10_5_5_PQ_INITIAL_FILES`,
// and `T10_5_8_INITIAL_FILES`, each staged beside `SPECS_ONLY_CONFIG`.
// T10.2-1's edit precedes its first `build` (staged between `gitCommitAll`
// and the build), so S-7's sweep reaches it against the stub and it stays
// plain.

import * as fsp from "node:fs/promises";
import type {
  ItemKind,
  ItemStatus,
  NodeHashes,
  NodeReport,
  RecordedNodeEntry,
  ReviewItem,
  SessionStatusReport,
  SessionStatusRow,
} from "../../helpers/adapters/index.js";
import {
  ITEM_STATUSES,
  decodeExportReport,
  decodeItemReport,
  decodeNextReport,
  decodeNodeReport,
  decodeRecordedState,
  decodeSessionStatusReport,
} from "../../helpers/adapters/index.js";
import { fail } from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { assertLeavesUnchanged } from "../../helpers/snapshot.js";
import { stagedMdx } from "../../helpers/staged-mdx.js";
import { type StagedTs, stagedTs } from "../../helpers/staged-ts.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { InitialFileContents } from "../../helpers/workspace.js";
import {
  T10_4_7_INITIAL_FILES,
  T10_4_7_NODES,
  stageT1047Session,
  stageT1047State,
} from "./section-10.4.js";
import {
  T10_5_5_PQ_FILE,
  T10_5_5_PQ_INITIAL_FILES,
  T10_5_5_PQ_NODES,
  T10_5_8_INITIAL_FILES,
  T10_5_8_NODES,
  T10_5_8_STAGINGS,
  stageT1055NewlyVisitedQ,
  stageT1058Session,
  t1055PqSource,
} from "./section-10.5.js";
import {
  assertSameJson,
  buildOk,
  expectErrorDocument,
  expectExit,
  expectReviewRefusal,
  runJson,
} from "./support.js";

// Minimal declarative configuration (SPEC 7): exactly one spec group.
// T10.2-2's later arms and T10.2-4's re-derivation arm stage it in
// workspaces created after the body's first invocations, so it is one
// TypeScript staged-source record (helpers/staged-ts.ts; S-9's TypeScript and
// timing clauses), well-formed, staged wherever this configuration is.
const SPECS_ONLY_CONFIG = stagedTs(
  "T10.2-2/T10.2-4 xspec.config.ts — one spec group",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
);

// One spec group plus a direct coverage profile over it (SPEC 7.4) — the
// coverage-session fixtures: a leaf with no incoming dependency edge is
// uncovered and yields an `uncovered-requirement` item (SPEC 10.7).
// T10.2-2's coverage arm stages it in a workspace created after the body's
// first invocations, so it is a TypeScript staged-source record
// (helpers/staged-ts.ts; S-9's TypeScript and timing clauses), well-formed.
const COVERAGE_CONFIG = stagedTs(
  "T10.2-2 xspec.config.ts — one spec group and the coverage profile p",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  coverage: [
    {
      name: "p",
      target: "main",
      boundary: "main",
      mode: "direct"
    }
  ]
})
`,
);

// Spec group, code group (SPEC 7.2), and the coverage profile together — the
// T10.2-1 fixture needs a `code-impact` item (a code location, SPEC 9.2) and
// an `uncovered-requirement` item beside the four requirement-scoped kinds.
const FULL_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: {
    app: ["src/**/*.ts"]
  },
  coverage: [
    {
      name: "p",
      target: "main",
      boundary: "main",
      mode: "direct"
    }
  ]
})
`;

/** Stage a fresh workspace (config plus `files`), run `body`, dispose (H-1). */
async function withWorkspace<T>(
  config: string | StagedTs,
  files: Readonly<Record<string, InitialFileContents>>,
  body: (workspace: TestWorkspace) => Promise<T>,
): Promise<T> {
  const workspace = await TestWorkspace.create({
    files: { "xspec.config.ts": config, ...files },
  });
  try {
    return await body(workspace);
  } finally {
    await workspace.dispose();
  }
}

/** Full `query node` report (SPEC 11, JSON-only; H-3). */
async function queryNode(
  product: ProductBinding,
  workspace: TestWorkspace,
  identity: string,
  context: string,
): Promise<NodeReport> {
  const label = `${context} \`query node ${identity}\``;
  return decodeNodeReport(
    await runJson(product, workspace, ["query", "node", identity], label),
    label,
  );
}

/** `review status <name> --json`, decoded (SPEC 10.7). */
async function sessionStatus(
  product: ProductBinding,
  workspace: TestWorkspace,
  name: string,
  context: string,
): Promise<SessionStatusReport> {
  const label = `${context} \`review status ${name} --json\``;
  return decodeSessionStatusReport(
    await runJson(
      product,
      workspace,
      ["review", "status", name, "--json"],
      label,
    ),
    label,
  );
}

/** `review show <name> <item-id> --json`, decoded as the full item. */
async function showItem(
  product: ProductBinding,
  workspace: TestWorkspace,
  name: string,
  itemId: string,
  context: string,
): Promise<ReviewItem> {
  const label = `${context} \`review show ${name} ${itemId} --json\``;
  return decodeItemReport(
    await runJson(
      product,
      workspace,
      ["review", "show", name, itemId, "--json"],
      label,
    ),
    label,
  );
}

/**
 * The unique status row for a kind and scope node, diagnosed loudly when
 * missing or duplicated (SPEC 10.5: at most one item per kind and scope
 * node).
 */
function requireRow(
  report: SessionStatusReport,
  kind: ItemKind,
  scope: string,
  context: string,
): SessionStatusRow {
  const rows = report.items.filter(
    (row) => row.kind === kind && row.scope === scope,
  );
  if (rows.length !== 1) {
    fail(
      `${context}: expected exactly one ${kind} item scoped at ${scope} ` +
        `(SPEC 10.5: a session never contains two items with the same kind ` +
        `and scope node); found ${String(rows.length)} among ` +
        JSON.stringify(report.items.map((row) => `${row.kind} ${row.scope}`)),
    );
  }
  return rows[0];
}

/** The export/next item with the given id, diagnosed when absent. */
function requireItem(
  items: readonly ReviewItem[],
  id: string,
  context: string,
): ReviewItem {
  const matches = items.filter((item) => item.id === id);
  if (matches.length !== 1) {
    fail(
      `${context}: expected exactly one item with id ${JSON.stringify(id)} ` +
        `(SPEC 10.2: item ids are unique within the session); found ` +
        `${String(matches.length)} among ${JSON.stringify(items.map((item) => item.id))}`,
    );
  }
  return matches[0];
}

/**
 * Canonical rendering of a JSON-safe value with object keys sorted
 * recursively — equality of information content where concrete member order
 * is shape territory (H-3/H-4).
 */
export function canonicalJson(value: unknown): string {
  // H-11: an explicit stack, never native recursion per nesting level.
  type Item = { readonly render: unknown } | { readonly text: string };
  const pieces: string[] = [];
  const stack: Item[] = [{ render: value }];
  while (stack.length > 0) {
    const item = stack.pop();
    if (item === undefined) break;
    if ("text" in item) {
      pieces.push(item.text);
      continue;
    }
    const current = item.render;
    if (Array.isArray(current)) {
      pieces.push("[");
      stack.push({ text: "]" });
      for (let index = current.length - 1; index >= 0; index -= 1) {
        stack.push({ render: current[index] });
        if (index > 0) stack.push({ text: "," });
      }
    } else if (current !== null && typeof current === "object") {
      const entries = Object.entries(current as Record<string, unknown>)
        .filter(([, member]) => member !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
      pieces.push("{");
      stack.push({ text: "}" });
      let remaining = entries.length;
      for (const [key, member] of entries.reverse()) {
        stack.push({ render: member });
        stack.push({ text: `${JSON.stringify(key)}:` });
        remaining -= 1;
        if (remaining > 0) stack.push({ text: "," });
      }
    } else {
      pieces.push(JSON.stringify(current) ?? "null");
    }
  }
  return pieces.join("");
}

/** Diagnosed canonical-JSON (key-order-insensitive) deep equality. */
function assertSameInformation(
  actual: unknown,
  expected: unknown,
  context: string,
): void {
  const actualRendered = canonicalJson(actual);
  const expectedRendered = canonicalJson(expected);
  if (actualRendered === expectedRendered) return;
  fail(
    `${context}: values differ (canonical JSON, key order normalized)\n` +
      `  actual:   ${actualRendered}\n` +
      `  expected: ${expectedRendered}`,
  );
}

/** Every string leaf of a decoded JSON value (array elements and members). */
export function collectStringLeaves(
  value: unknown,
  into: string[] = [],
): string[] {
  // H-11: an explicit stack, never native recursion per nesting level.
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const current = stack.pop();
    if (typeof current === "string") {
      into.push(current);
    } else if (Array.isArray(current)) {
      for (let index = current.length - 1; index >= 0; index -= 1) {
        stack.push(current[index]);
      }
    } else if (current !== null && typeof current === "object") {
      const members = Object.values(current);
      for (let index = members.length - 1; index >= 0; index -= 1) {
        stack.push(members[index]);
      }
    }
  }
  return into;
}

/**
 * The recorded state must hold the given hash value among its string leaves
 * (SPEC 10.2/10.4: `baseline`/`current` hold the item's relevant hashes; the
 * value is the one `query node` reported at the expected moment).
 */
function assertRecordedHolds(
  recorded: unknown,
  hash: string,
  what: string,
  context: string,
): void {
  if (collectStringLeaves(recorded).includes(hash)) return;
  fail(
    `${context}: the recorded state must hold ${what} — the value ` +
      `${JSON.stringify(hash)} captured via \`query node\` at that moment ` +
      `(SPEC 10.2, 10.4; H-4: opaque shape, spec-fixed values) — but it ` +
      `appears nowhere in ${canonicalJson(recorded)}`,
  );
}

/**
 * The recorded state must NOT hold the given hash value — the discriminator
 * against records taken (or recomputed) at the wrong moment (T10.2-2,
 * T10.2-4; the value's distinctness from every legitimately recorded value is
 * asserted as a staging premise before this runs).
 */
function assertRecordedLacks(
  recorded: unknown,
  hash: string,
  what: string,
  context: string,
): void {
  if (!collectStringLeaves(recorded).includes(hash)) return;
  fail(
    `${context}: the recorded state must not hold ${what} — the value ` +
      `${JSON.stringify(hash)} belongs to a different moment than the one ` +
      `the record was written at (SPEC 10.2, 10.4: reads report the recorded ` +
      `state, never values recomputed from the live graph) — but it appears ` +
      `in ${canonicalJson(recorded)}`,
  );
}

/** Staging premise: the listed values are pairwise distinct (diagnosed). */
function assertPairwiseDistinct(
  values: readonly (readonly [string, string])[],
  context: string,
): void {
  for (let i = 0; i < values.length; i += 1) {
    for (let j = i + 1; j < values.length; j += 1) {
      if (values[i][1] === values[j][1]) {
        fail(
          `${context}: staging premise — ${values[i][0]} and ${values[j][0]} ` +
            `must be distinct values for the recorded-state discrimination ` +
            `to be meaningful (SPEC 5.5: distinct inputs hash distinctly); ` +
            `both are ${JSON.stringify(values[i][1])}`,
        );
      }
    }
  }
}

/**
 * One node's hashes in a `query node` capture map — an exported staging's
 * captures (section-10.4.ts, section-10.5.ts) — diagnosed where the capture
 * lacks the node: a harness staging defect, never a product verdict.
 */
function capturedNodeHashes(
  captures: ReadonlyMap<string, NodeHashes>,
  node: string,
  context: string,
): NodeHashes {
  const hashes = captures.get(node);
  if (hashes === undefined) {
    fail(
      `${context}: harness staging defect — no \`query node\` capture ` +
        `exists for ${node}, so its recorded values cannot be checked`,
    );
  }
  return hashes;
}

/** A node's entry in a decoded recorded state, or undefined where none. */
function recordedEntryOf(
  entries: readonly RecordedNodeEntry[],
  node: string,
): RecordedNodeEntry | undefined {
  return entries.find((entry) => entry.node === node);
}

/** The nodes a decoded recorded state holds entries for (diagnoses). */
function recordedNodes(entries: readonly RecordedNodeEntry[]): string {
  return JSON.stringify(entries.map((entry) => entry.node));
}

/** A moment whose values a recorded entry must not hold (diagnoses). */
interface WrongMoment {
  /** The moment, as a diagnosis names it ("at the re-derivation"). */
  readonly moment: string;
  /** The node's hashes `query node` reported at that moment. */
  readonly hashes: NodeHashes;
  /** The failing product whose record holds them. */
  readonly product: string;
}

/**
 * Assert `node`'s entry in an item's recorded state — its `baseline` or its
 * `current` (SPEC 10.2, 10.4), read entry by entry through the review
 * adapter's `decodeRecordedState` — presents it present and holds the
 * subtreeHash and metadataHash `query node` reported at the expected moment,
 * a subtree-coherence item's relevant hashes for its scope node (10.4); `why`
 * names the rule. A recorded value equal to a wrong moment's is diagnosed as
 * that moment's product: the caller first asserts, as a staging premise, that
 * the wrong moments' subtreeHashes differ from the expected one.
 */
function assertRecordedEntryAt(
  item: ReviewItem,
  field: "baseline" | "current",
  node: string,
  expected: NodeHashes,
  wrong: readonly WrongMoment[],
  why: string,
  context: string,
): void {
  const label = `${context}: \`${field}\``;
  const entries = decodeRecordedState(item, field, context);
  const entry = recordedEntryOf(entries, node);
  if (entry === undefined) {
    fail(
      `${label} holds no entry for ${node} — ${why}; it holds entries for ` +
        recordedNodes(entries),
    );
  }
  if (!entry.present || entry.absentMarker) {
    fail(
      `${label}: ${node}'s entry must present it present, with its hashes — ` +
        `${why}; got ${JSON.stringify(entry)}`,
    );
  }
  for (const hash of ["subtreeHash", "metadataHash"] as const) {
    const recorded = entry.hashes[hash];
    if (recorded === expected[hash]) continue;
    const match = wrong.find((moment) => moment.hashes[hash] === recorded);
    fail(
      `${label}: ${node}'s ${hash} must be ${JSON.stringify(expected[hash])}, ` +
        `the value \`query node\` reported at the expected moment — ${why}; ` +
        `got ` +
        (recorded === undefined
          ? "none recorded"
          : match !== undefined
            ? `${JSON.stringify(recorded)}, its value ${match.moment} — ` +
              match.product
            : JSON.stringify(recorded)),
    );
  }
}

/** Totals by status, compared as `totals[status] ?? 0` per defined status. */
function assertTotals(
  report: SessionStatusReport,
  expected: Readonly<Record<ItemStatus, number>>,
  context: string,
): void {
  for (const status of ITEM_STATUSES) {
    const actual = report.totals[status] ?? 0;
    if (actual !== expected[status]) {
      fail(
        `${context}: \`review status\` totals must count ${String(expected[status])} ` +
          `item(s) with status ${status} (read-time invalidation applied, ` +
          `SPEC 10.4, 10.7); got ${String(actual)}`,
      );
    }
  }
}

/** Sorted node-identity set of a payload node list (module header). */
function identitySet(
  states: readonly { readonly node: string }[],
): readonly string[] {
  return states.map((state) => state.node).sort();
}

// ---------------------------------------------------------------------------
// T10.2-1 — fields
// ---------------------------------------------------------------------------

// The T10.2-1 workspace: one spec file, one code file. Relative to the
// baseline commit, `a.k`'s text is edited (a.k `changed`) and `m` gains a tag
// (m `metadata-changed`), so a `--base` session derives one item of each of
// the four requirement-scoped kinds plus a `code-impact` item (SPEC 10.5),
// and the coverage profile leaves `dep` and `m` uncovered for the
// `uncovered-requirement` items (SPEC 10.7).
const T1_SPEC = "specs/A.mdx";
const T1_ROOT = "specs/A.mdx";
const T1_A = "specs/A.mdx#a";
const T1_AK = "specs/A.mdx#a.k";
const T1_DEP = "specs/A.mdx#dep";
const T1_M = "specs/A.mdx#m";
const T1_CODE = "src/ref.ts";

function t1Spec(kidText: string, mAttrs: string): string {
  return [
    '<S id="a">',
    "Parent text.",
    "",
    '<S id="a.k">',
    kidText,
    "</S>",
    "</S>",
    "",
    '<S id="dep" d={"a.k"}>',
    "Depends on the kid.",
    "</S>",
    "",
    `<S id="m"${mAttrs}>`,
    "Metadata node text.",
    "</S>",
    "",
  ].join("\n");
}

// A whole-file code location (SPEC 4.6): the bare-reference marker sits at
// the top level, so the `references` edge runs from `src/ref.ts` itself.
const T1_CODE_SOURCE = [
  'import A from "../specs/A.xspec";',
  "",
  "A.a.k;",
  "",
].join("\n");

const T1_NOTE = "reviewed against the v2 kid edit";

/** What T10.2-1 asserts on one shown item (fields of SPEC 10.2). */
interface ExpectedItemFields {
  readonly kind: ItemKind;
  readonly scope: string;
  /** Expected context node identities (as a set). */
  readonly context: readonly string[];
  /** Expected origin node identities (as a set). */
  readonly origin: readonly string[];
  /** Exact expected `blockedBy` ids (sorted). */
  readonly blockedBy: readonly string[];
  readonly status: ItemStatus;
  readonly blocked: boolean;
  /** Exact note text, when a `--note` resolve set one. */
  readonly note?: string;
}

function assertItemFields(
  item: ReviewItem,
  expected: ExpectedItemFields,
  context: string,
): void {
  assertSameJson(
    {
      kind: item.kind,
      scope: item.scope.node,
      scopePresent: item.scope.present,
      context: identitySet(item.context),
      origin: identitySet(item.origin),
      blockedBy: [...item.blockedBy].sort(),
      status: item.status,
      blocked: item.blocked,
    },
    {
      kind: expected.kind,
      scope: expected.scope,
      scopePresent: true,
      context: [...expected.context].sort(),
      origin: [...expected.origin].sort(),
      blockedBy: [...expected.blockedBy].sort(),
      status: expected.status,
      blocked: expected.blocked,
    },
    `${context}: the 10.2 fields — kind, scope (present), context and origin ` +
      `identity sets, blockedBy, status, blocked state (SPEC 10.2, 10.5, 10.7)`,
  );
  if (expected.note !== undefined && item.note !== expected.note) {
    fail(
      `${context}: after a \`--note\` resolve the item's note is the given ` +
        `text (SPEC 10.2, 10.7); expected ${JSON.stringify(expected.note)}, ` +
        `got ${JSON.stringify(item.note)}`,
    );
  }
  // `id`, `reason`, `baseline`, and `current` presence is enforced by the
  // adapter decode itself (H-3 fails loudly when required information is
  // absent), the `id`'s and each `blockedBy` entry's well-formed argument
  // value (SPEC 10.2, 12.0) with it; `showRepresentativeItem` matches the
  // `id` to the item named. The recorded states' semantic content is
  // T10.2-2/T10.2-4 business.
}

/**
 * T10.2-1's naming arm: the representative item of the `status` row `row`,
 * named by its own `id` — `review show <name> <id>`, exit 0 (`runJson`) —
 * presents that item: the `id`, kind, and scope node its row reports (SPEC
 * 10.2: every item is nameable as an `<item-id>` operand, 12.0; SPEC 10.7:
 * `show` reports the full item). The row's `id` already decoded as a
 * well-formed argument value (12.0), as every item ID the review adapter
 * meets does (review.ts `decodeItemId`).
 */
async function showRepresentativeItem(
  product: ProductBinding,
  workspace: TestWorkspace,
  name: string,
  row: SessionStatusRow,
  context: string,
): Promise<ReviewItem> {
  const item = await showItem(product, workspace, name, row.id, context);
  assertSameJson(
    { id: item.id, kind: item.kind, scope: item.scope.node },
    { id: row.id, kind: row.kind, scope: row.scope },
    `${context}: \`review show ${name} <id>\`, named by the item's own ` +
      `\`id\`, presents that item — the id, kind, and scope node \`review ` +
      `status\` reports for it (SPEC 10.2: every item is nameable as an ` +
      `<item-id> operand, 12.0; SPEC 10.7)`,
  );
  return item;
}

const T10_2_1 = defineProductTest({
  id: "T10.2-1",
  title:
    "`show` and `export` present every 10.2 field — id, kind, scope, context, reason, origin, baseline, current, status, note (after a `--note` resolve), blockedBy — for representative items of every built-in kind: a `--base` session deriving subtree-coherence, parent-consistency, metadata-consistency, dependency-consistency, and code-impact items, plus a coverage session's uncovered-requirement items; per item the kind, scope, context/origin identity sets, blockedBy, status, and blocked state are the spec-derived values, and `export`'s items carry the same information as `show`'s; every item `id` observed — `status` rows, items, `blockedBy` entries, as in every `review` decode, P-9's draws included — is a well-formed argument value, free of U+FFFD and of unpaired surrogates, and each representative item is named by its `id`: `review show <name> <id>` presents that item, exit 0 (SPEC 10.2, 10.5, 10.7, 12.0)",
  run: async (product) => {
    await withWorkspace(
      FULL_CONFIG,
      {
        [T1_SPEC]: t1Spec("Kid text v1.", ""),
        [T1_CODE]: T1_CODE_SOURCE,
      },
      async (workspace) => {
        await workspace.gitInit();
        const base = await workspace.gitCommitAll("baseline");

        // The staged differences: a.k `changed`, m `metadata-changed`.
        await workspace.file(
          T1_SPEC,
          t1Spec("Kid text v2.", ' tags="reviewed"'),
        );
        await buildOk(product, workspace, "T10.2-1 `build` after the edits");

        await expectExit(
          product,
          workspace,
          ["review", "create", "--base", base, "--name", "pb"],
          0,
          "T10.2-1 `review create --base <baseline> --name pb`",
        );

        // Exactly the five expected (kind, scope) items (SPEC 10.5), all
        // created `unresolved` (SPEC 10.2), with only the parent-consistency
        // item blocked (its blockedBy holds the changed branch's
        // subtree-coherence item).
        const status = await sessionStatus(product, workspace, "pb", "T10.2-1");
        assertSameJson(
          status.items.map((row) => `${row.kind} ${row.scope}`).sort(),
          [
            `code-impact ${T1_CODE}`,
            `dependency-consistency ${T1_DEP}`,
            `metadata-consistency ${T1_M}`,
            `parent-consistency ${T1_A}`,
            `subtree-coherence ${T1_AK}`,
          ].sort(),
          "T10.2-1: the --base session derives exactly one item per staged " +
            "kind — subtree-coherence for the changed leaf, " +
            "parent-consistency for its non-root ancestor, " +
            "metadata-consistency for the tag edit, dependency-consistency " +
            "for the depender, code-impact for the impacted location " +
            "(SPEC 10.5)",
        );
        const scRow = requireRow(status, "subtree-coherence", T1_AK, "T10.2-1");
        const pcRow = requireRow(status, "parent-consistency", T1_A, "T10.2-1");
        const mcRow = requireRow(
          status,
          "metadata-consistency",
          T1_M,
          "T10.2-1",
        );
        const dcRow = requireRow(
          status,
          "dependency-consistency",
          T1_DEP,
          "T10.2-1",
        );
        const ciRow = requireRow(status, "code-impact", T1_CODE, "T10.2-1");
        const ids = [scRow.id, pcRow.id, mcRow.id, dcRow.id, ciRow.id];
        if (new Set(ids).size !== ids.length) {
          fail(
            `T10.2-1: item ids must be unique within the session ` +
              `(SPEC 10.2); got ${JSON.stringify(ids)}`,
          );
        }
        for (const row of status.items) {
          const expectBlocked = row.id === pcRow.id;
          if (row.status !== "unresolved" || row.blocked !== expectBlocked) {
            fail(
              `T10.2-1: before any resolve, every item is unresolved ` +
                `(SPEC 10.2) and only the parent-consistency item is blocked ` +
                `(SPEC 10.5); got status ${row.status}, blocked ` +
                `${String(row.blocked)} for ${row.kind} ${row.scope}`,
            );
          }
        }

        // `--note` resolve on the unblocked subtree-coherence item
        // (`no-change` — no re-derivation, SPEC 10.5).
        await expectExit(
          product,
          workspace,
          [
            "review",
            "resolve",
            "pb",
            scRow.id,
            "--status",
            "no-change",
            "--note",
            T1_NOTE,
          ],
          0,
          "T10.2-1 `review resolve pb <subtree-coherence item> --status no-change --note <text>`",
        );

        // Every field, per item, via `show` (SPEC 10.2, 10.5, 10.7).
        const expectations: readonly (readonly [
          SessionStatusRow,
          ExpectedItemFields,
        ])[] = [
          [
            scRow,
            {
              kind: "subtree-coherence",
              scope: T1_AK,
              context: [T1_A, T1_ROOT], // N's ancestor chain
              origin: [T1_AK], // the changed nodes in scope
              blockedBy: [],
              status: "no-change",
              blocked: false,
              note: T1_NOTE,
            },
          ],
          [
            pcRow,
            {
              kind: "parent-consistency",
              scope: T1_A,
              context: [T1_AK], // A's child on the changed branch
              origin: [T1_AK], // the changed branches' changed nodes
              blockedBy: [scRow.id], // that child's subtree-coherence item
              status: "unresolved",
              blocked: false, // its one blocker just resolved
            },
          ],
          [
            mcRow,
            {
              kind: "metadata-consistency",
              scope: T1_M,
              context: [], // a tags change adds/removes no d target
              origin: [T1_M], // scope and origin: that node
              blockedBy: [],
              status: "unresolved",
              blocked: false,
            },
          ],
          [
            dcRow,
            {
              kind: "dependency-consistency",
              scope: T1_DEP,
              context: [T1_AK], // the changed dependency targets
              origin: [T1_AK], // originating nodes of the targets' changes
              blockedBy: [],
              status: "unresolved",
              blocked: false,
            },
          ],
          [
            ciRow,
            {
              kind: "code-impact",
              scope: T1_CODE,
              context: [T1_AK], // the impact-edge targets that changed
              origin: [T1_AK],
              blockedBy: [],
              status: "unresolved",
              blocked: false,
            },
          ],
        ];
        // Each item named by its own `id` (SPEC 10.2, 12.0): `show`
        // presents that item, exit 0.
        const shown = new Map<string, ReviewItem>();
        for (const [row, expected] of expectations) {
          const context = `T10.2-1 \`review show pb\` of the ${expected.kind} item`;
          const decoded = await showRepresentativeItem(
            product,
            workspace,
            "pb",
            row,
            context,
          );
          assertItemFields(decoded, expected, context);
          shown.set(row.id, decoded);
        }

        // `export` presents the same items with the same information
        // (SPEC 10.7: every field of 10.2, blocked state, and the same
        // payload, read-time invalidation applied — as in `show`).
        const exportLabel = "T10.2-1 `review export pb --json`";
        const exported = decodeExportReport(
          await runJson(
            product,
            workspace,
            ["review", "export", "pb", "--json"],
            exportLabel,
          ),
          exportLabel,
        );
        assertSameJson(
          exported.items.map((item) => item.id).sort(),
          [...ids].sort(),
          `${exportLabel}: export carries exactly the session's items (SPEC 10.7)`,
        );
        for (const [id, fromShow] of shown) {
          assertSameInformation(
            requireItem(exported.items, id, exportLabel),
            fromShow,
            `${exportLabel}: the exported item ${id} carries the same ` +
              `information as \`show\` (SPEC 10.7: every field of 10.2, ` +
              `blocked state, and the same self-contained payload)`,
          );
        }

        // Coverage session: `uncovered-requirement` items for the two
        // uncovered required leaves (SPEC 10.7 — scope: the node; context:
        // its ancestor chain; origin and blockedBy empty).
        await expectExit(
          product,
          workspace,
          ["review", "create", "--coverage", "p", "--name", "cov"],
          0,
          "T10.2-1 `review create --coverage p --name cov`",
        );
        const covStatus = await sessionStatus(
          product,
          workspace,
          "cov",
          "T10.2-1 coverage session",
        );
        assertSameJson(
          covStatus.items.map((row) => `${row.kind} ${row.scope}`).sort(),
          [
            `uncovered-requirement ${T1_DEP}`,
            `uncovered-requirement ${T1_M}`,
          ].sort(),
          "T10.2-1: the coverage session holds one uncovered-requirement " +
            "item per uncovered required node — dep and m (a.k is covered " +
            "by dep's d edge; a is a non-leaf) (SPEC 8.1, 10.7)",
        );
        const covShown = new Map<string, ReviewItem>();
        for (const scope of [T1_DEP, T1_M]) {
          const row = requireRow(
            covStatus,
            "uncovered-requirement",
            scope,
            "T10.2-1 coverage session",
          );
          const context = `T10.2-1 \`review show cov\` of the uncovered-requirement item for ${scope}`;
          const decoded = await showRepresentativeItem(
            product,
            workspace,
            "cov",
            row,
            context,
          );
          assertItemFields(
            decoded,
            {
              kind: "uncovered-requirement",
              scope,
              context: [T1_ROOT], // the node's ancestor chain
              origin: [],
              blockedBy: [],
              status: "unresolved",
              blocked: false,
            },
            context,
          );
          covShown.set(row.id, decoded);
        }
        const covExportLabel = "T10.2-1 `review export cov --json`";
        const covExported = decodeExportReport(
          await runJson(
            product,
            workspace,
            ["review", "export", "cov", "--json"],
            covExportLabel,
          ),
          covExportLabel,
        );
        assertSameJson(
          covExported.items.map((item) => item.id).sort(),
          [...covShown.keys()].sort(),
          `${covExportLabel}: export carries exactly the session's items (SPEC 10.7)`,
        );
        for (const [id, fromShow] of covShown) {
          assertSameInformation(
            requireItem(covExported.items, id, covExportLabel),
            fromShow,
            `${covExportLabel}: the exported item ${id} carries the same information as \`show\``,
          );
        }
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T10.2-2 — baseline fixing
// ---------------------------------------------------------------------------

const T2_SPEC = "specs/A.mdx";
const T2_AK = "specs/A.mdx#a.k";

function t2Spec(kidText: string): string {
  return [
    '<S id="a">',
    "Parent text.",
    "",
    '<S id="a.k">',
    kidText,
    "</S>",
    "</S>",
    "",
  ].join("\n");
}

const T2_COV_SPEC = "specs/U.mdx";
const T2_U = "specs/U.mdx#u";

function t2CovSpec(text: string): string {
  return ['<S id="u">', text, "</S>", ""].join("\n");
}

// T10.2-2's edits of built workspaces — the `--base` arm's v1 and v2 kid
// texts, the audit arm's e1, the coverage arm's e1 leaf — are staged-source
// records (helpers/staged-mdx.ts; S-9's before-any-product clause), the same
// template calls moved to module level; so are the audit and coverage arms'
// initial files (e0), staged after the `--base` arm's invocations. The
// `--base` arm's own v0 entry, the body's first workspace, stays plain.
const T10_2_2_KID_V1 = stagedMdx(
  "T10.2-2 specs/A.mdx with the kid text at v1 (--base arm)",
  t2Spec("Kid text v1."),
);
const T10_2_2_KID_V2 = stagedMdx(
  "T10.2-2 specs/A.mdx with the kid text at v2 (--base arm)",
  t2Spec("Kid text v2."),
);
const T10_2_2_KID_E0 = stagedMdx(
  "T10.2-2 specs/A.mdx with the kid text at e0 (audit arm)",
  t2Spec("Kid text e0."),
);
const T10_2_2_KID_E1 = stagedMdx(
  "T10.2-2 specs/A.mdx with the kid text at e1 (audit arm)",
  t2Spec("Kid text e1."),
);
const T10_2_2_UNCOVERED_E0 = stagedMdx(
  "T10.2-2 specs/U.mdx with the uncovered leaf at e0 (coverage arm)",
  t2CovSpec("Uncovered leaf e0."),
);
const T10_2_2_UNCOVERED_E1 = stagedMdx(
  "T10.2-2 specs/U.mdx with the uncovered leaf at e1 (coverage arm)",
  t2CovSpec("Uncovered leaf e1."),
);

// T10.2-2's audit re-derivation arm: a top-level section b authored after
// `create`, after a — specs/A.mdx's kid kept at e0 — and b's text edited
// once its item has entered.
const T2_B = "specs/A.mdx#b";

/** specs/A.mdx with the kid text at e0 and a top-level b holding `bText`. */
function t2AuthoredSpec(bText: string): string {
  return `${t2Spec("Kid text e0.")}\n<S id="b">\n${bText}\n</S>\n`;
}

// Both staged into a workspace already built, so staged-source records (S-9).
const T10_2_2_AUTHORED_R0 = stagedMdx(
  "T10.2-2 specs/A.mdx with a top-level b authored after `create`, b at r0 (audit re-derivation arm)",
  t2AuthoredSpec("Bee text r0."),
);
const T10_2_2_AUTHORED_R1 = stagedMdx(
  "T10.2-2 specs/A.mdx with b's text at r1, after b's item entered (audit re-derivation arm)",
  t2AuthoredSpec("Bee text r1."),
);

// The nodes the re-derivation arms over exported stagings read: T10.5-5's
// newly visited p.q, T10.5-8's d, and T10.4-7's d1 and d2.
const PQ_Q = T10_5_5_PQ_NODES.q;
const R8_ROOT = T10_5_8_NODES.rRoot;
const R8_D = T10_5_8_NODES.d;
const J7_D1 = T10_4_7_NODES.d1;
const J7_D2 = T10_4_7_NODES.d2;

/**
 * Premises and expectations shared by T10.2-2's `--base`, audit, and
 * coverage arms at `create` (its re-derivation arms read entries through
 * `assertRecordedEntryAt` instead): `entry` is the moment whose values
 * `baseline` must hold; `others` are the later moments whose subtreeHash
 * values must appear nowhere in it. The relevant hashes of a
 * `subtree-coherence`/`uncovered-requirement` item scoped at a childless
 * node are its subtreeHash and metadataHash (SPEC 10.4).
 */
function assertBaselineRecord(
  baseline: unknown,
  entry: NodeReport,
  others: readonly (readonly [string, NodeReport])[],
  context: string,
): void {
  assertRecordedHolds(
    baseline,
    entry.hashes.subtreeHash,
    "the scope node's subtreeHash at the fixed moment",
    context,
  );
  assertRecordedHolds(
    baseline,
    entry.hashes.metadataHash,
    "the scope node's metadataHash at the fixed moment",
    context,
  );
  for (const [label, report] of others) {
    assertRecordedLacks(
      baseline,
      report.hashes.subtreeHash,
      `the subtreeHash of the ${label} state`,
      context,
    );
  }
}

/**
 * T10.2-2's `--base` re-derivation arm (TEST-SPEC T10.2-2; SPEC 10.2): 10.2
 * fixes `baseline` from the item's baseline state wherever the item enters,
 * so an item a re-derivation adds holds the recorded baseline commit's
 * values too. T10.5-5's newly visited p.q (`stageT1055NewlyVisitedQ`, in a
 * fresh workspace holding `T10_5_5_PQ_INITIAL_FILES`): its text edited
 * before `create --base` and again before p's `updated` resolve, whose
 * re-derivation adds p.q's subtree-coherence item; that item's `baseline`
 * holds p.q's subtreeHash and metadataHash at the baseline commit, never
 * those of the graph at the re-derivation — each captured via `query node`
 * at its moment, their subtreeHashes differing (a staging premise).
 */
async function runT1022NewlyVisitedArm(product: ProductBinding): Promise<void> {
  await withWorkspace(
    SPECS_ONLY_CONFIG,
    T10_5_5_PQ_INITIAL_FILES,
    async (workspace) => {
      const label =
        "T10.2-2 --base re-derivation arm (T10.5-5's newly visited p.q)";
      const staged = await stageT1055NewlyVisitedQ(product, workspace, label);
      const atBase = capturedNodeHashes(staged.baseline, PQ_Q, label);
      const atReDerivation = capturedNodeHashes(
        staged.atReDerivation,
        PQ_Q,
        label,
      );
      assertPairwiseDistinct(
        [
          ["p.q's subtreeHash at the baseline commit", atBase.subtreeHash],
          [
            "p.q's subtreeHash at the re-derivation",
            atReDerivation.subtreeHash,
          ],
          ["p.q's constant metadataHash", atBase.metadataHash],
        ],
        label,
      );
      const qId = requireRow(
        await sessionStatus(product, workspace, "s", label),
        "subtree-coherence",
        PQ_Q,
        `${label} after the re-derivation`,
      ).id;
      assertRecordedEntryAt(
        await showItem(product, workspace, "s", qId, label),
        "baseline",
        PQ_Q,
        atBase,
        [
          {
            moment: "at the re-derivation",
            hashes: atReDerivation,
            product:
              "a baseline filled from the graph at the re-derivation that " +
              "added the item",
          },
        ],
        "a `--base` session fixes `baseline` from the graph at the recorded " +
          "baseline commit wherever the item enters, a re-derivation included " +
          "(SPEC 10.2)",
        `${label} \`review show s <p.q item>\``,
      );
    },
  );
}

/**
 * T10.2-2's audit re-derivation arm (TEST-SPEC T10.2-2; SPEC 10.2): in a
 * session without a baseline an item's `baseline` holds the current graph's
 * values at the moment it enters — for a section authored after `create`,
 * the re-derivation that adds its item. Over the audit arm's fixture (a
 * holding a.k, e0), a top-level b is authored after `create --strategy
 * audit` and a.k's item resolved `updated` (the re-derivation, 10.5): b's
 * subtree-coherence item's `baseline` holds b's subtreeHash and metadataHash
 * captured via `query node` right before that resolve, b present — never
 * absent, as a baseline taken from the graph at `create`, which lacked b,
 * records it — and still holds them, the same information, after a further
 * edit to b's text, never the live values.
 */
async function runT1022AuthoredSectionArm(
  product: ProductBinding,
): Promise<void> {
  await withWorkspace(
    SPECS_ONLY_CONFIG,
    { [T2_SPEC]: T10_2_2_KID_E0 },
    async (workspace) => {
      const label =
        "T10.2-2 audit re-derivation arm (b authored after `create`)";
      await buildOk(product, workspace, `${label} \`build\` at e0`);
      await expectExit(
        product,
        workspace,
        ["review", "create", "--strategy", "audit", "--name", "s"],
        0,
        `${label} \`review create --strategy audit --name s\``,
      );
      const kId = requireRow(
        await sessionStatus(product, workspace, "s", label),
        "subtree-coherence",
        T2_AK,
        label,
      ).id;
      await workspace.file(T2_SPEC, T10_2_2_AUTHORED_R0);
      await buildOk(
        product,
        workspace,
        `${label} \`build\` once b is authored`,
      );
      const atReDerivation = await queryNode(
        product,
        workspace,
        T2_B,
        `${label}, the re-derivation moment (r0)`,
      );
      await expectExit(
        product,
        workspace,
        ["review", "resolve", "s", kId, "--status", "updated"],
        0,
        `${label} \`review resolve s <a.k item> --status updated\` — the ` +
          `re-derivation adding b's item (SPEC 10.5)`,
      );
      const bId = requireRow(
        await sessionStatus(product, workspace, "s", label),
        "subtree-coherence",
        T2_B,
        `${label} after the re-derivation`,
      ).id;
      const why =
        "in a session without a baseline, `baseline` holds the values of the " +
        "current graph at the moment the item enters — for b, authored after " +
        "`create`, the re-derivation that added its item (SPEC 10.2); a " +
        "baseline taken from the graph at `create`, which lacked b, records " +
        "it absent";
      const firstLabel = `${label}, first read`;
      const first = await showItem(product, workspace, "s", bId, firstLabel);
      assertRecordedEntryAt(
        first,
        "baseline",
        T2_B,
        atReDerivation.hashes,
        [],
        why,
        `${firstLabel} \`review show s <b item>\``,
      );

      await workspace.file(T2_SPEC, T10_2_2_AUTHORED_R1);
      await buildOk(product, workspace, `${label} \`build\` at r1`);
      const afterEdit = await queryNode(
        product,
        workspace,
        T2_B,
        `${label}, post-entry edit moment (r1)`,
      );
      assertPairwiseDistinct(
        [
          ["b's r0 subtreeHash", atReDerivation.hashes.subtreeHash],
          ["b's r1 subtreeHash", afterEdit.hashes.subtreeHash],
          ["b's constant metadataHash", atReDerivation.hashes.metadataHash],
        ],
        label,
      );
      const secondLabel = `${label}, second read (after the edit)`;
      const second = await showItem(product, workspace, "s", bId, secondLabel);
      assertRecordedEntryAt(
        second,
        "baseline",
        T2_B,
        atReDerivation.hashes,
        [
          {
            moment: "after the post-entry edit (r1)",
            hashes: afterEdit.hashes,
            product: "a baseline recomputed from the live graph",
          },
        ],
        why,
        `${secondLabel} \`review show s <b item>\``,
      );
      assertSameInformation(
        second.baseline,
        first.baseline,
        `${label}: \`baseline\` is fixed at item entry — the same ` +
          `information across reads bracketing a further edit (SPEC 10.2)`,
      );
    },
  );
}

/**
 * T10.2-2's absent-marker arm (TEST-SPEC T10.2-2; SPEC 10.2, 10.4): a scope
 * node the item's baseline state lacks has an entry there presenting it
 * absent, its hashes the explicit absent marker. T10.5-8's item (3) — R's
 * root's subtree-coherence item, its scope holding d, added since the
 * baseline (`stageT1058Session` over the four-edit staging, in a fresh
 * workspace holding `T10_5_8_INITIAL_FILES`): its `baseline`, read through
 * `decodeRecordedState`, holds an entry for d presenting it absent, the
 * marker in place of hashes — never d's current hashes, and never no entry,
 * which 10.2 leaves to a node joining the item later.
 */
async function runT1022AbsentMarkerArm(product: ProductBinding): Promise<void> {
  const staging = T10_5_8_STAGINGS[0];
  await withWorkspace(
    SPECS_ONLY_CONFIG,
    T10_5_8_INITIAL_FILES,
    async (workspace) => {
      const label = `T10.2-2 absent-marker arm (T10.5-8's item (3), ${staging.name})`;
      const session = await stageT1058Session(
        product,
        workspace,
        staging,
        label,
      );
      const rootId = requireRow(
        await sessionStatus(product, workspace, "s", label),
        "subtree-coherence",
        R8_ROOT,
        label,
      ).id;
      const context = `${label} \`review show s <R's root item>\``;
      const entries = decodeRecordedState(
        await showItem(product, workspace, "s", rootId, label),
        "baseline",
        context,
      );
      const recorded = `${context}: \`baseline\``;
      const d = recordedEntryOf(entries, R8_D);
      if (d === undefined) {
        fail(
          `${recorded} holds no entry for d — d is in item (3)'s scope, ` +
            `added since the baseline (T10.5-8: the root and every section ` +
            `of its file), so the item's baseline state lacks it and its ` +
            `entry presents it absent, its hashes the explicit absent marker ` +
            `(SPEC 10.2, 10.4); 10.2 leaves an entry out only for a node ` +
            `joining the item later, and a product entering only the nodes ` +
            `the baseline graph holds gives d none; it holds entries for ` +
            recordedNodes(entries),
        );
      }
      const dCurrent = capturedNodeHashes(session.atCreate, R8_D, label);
      const dHeld = Object.values(d.hashes).filter(
        (hash): hash is string => hash !== undefined,
      );
      if (
        dHeld.some(
          (hash) =>
            hash === dCurrent.subtreeHash || hash === dCurrent.metadataHash,
        )
      ) {
        fail(
          `${recorded}: d's entry holds d's current hashes — never: the ` +
            `baseline state lacks d, so its entry presents it absent, its ` +
            `hashes the explicit absent marker (SPEC 10.2, 10.4); got ` +
            JSON.stringify(d),
        );
      }
      if (d.present) {
        fail(
          `${recorded}: d's entry must present it absent — the baseline ` +
            `state lacks d (SPEC 10.2, 10.4); got ${JSON.stringify(d)}`,
        );
      }
      if (!d.absentMarker || dHeld.length > 0) {
        fail(
          `${recorded}: d's entry must record the explicit absent marker in ` +
            `place of hashes, as an absent node's hashes are recorded (SPEC ` +
            `10.2, 10.4); got ${JSON.stringify(d)}`,
        );
      }
    },
  );
}

/**
 * T10.2-2's joined-node arm (TEST-SPEC T10.2-2; SPEC 10.2, 10.4): a node
 * that joins an item later gains no entry in `baseline`. T10.4-7(a)'s
 * staging (`stageT1047Session`, `stageT1047State`, in a fresh workspace
 * holding `T10_4_7_INITIAL_FILES`): d2's text edited after `create --base`,
 * then x's dependency-consistency item resolved `updated` — the
 * re-derivation it triggers makes d2 join x's origin ({d1, d2}, a premise
 * from `show`), and the resolve assigns and records once that re-derivation
 * is done, against the item as re-derived (10.4). Read through
 * `decodeRecordedState`, x's `baseline`, fixed when x entered at `create`,
 * holds no entry for d2, while its `current` records d2 present — the
 * resolve records every scope, context, and origin node's presence; a
 * product recording before the re-derivation never records d2.
 */
async function runT1022JoinedNodeArm(product: ProductBinding): Promise<void> {
  await withWorkspace(
    SPECS_ONLY_CONFIG,
    T10_4_7_INITIAL_FILES,
    async (workspace) => {
      const label = "T10.2-2 joined-node arm (T10.4-7(a)'s d2)";
      const { baseline, xId } = await stageT1047Session(
        product,
        workspace,
        label,
      );
      await stageT1047State(
        product,
        workspace,
        baseline,
        "d2-edited",
        `${label} after d2's edit`,
      );
      await expectExit(
        product,
        workspace,
        ["review", "resolve", "s", xId, "--status", "updated"],
        0,
        `${label} \`review resolve s <x item> --status updated\` after d2's ` +
          `edit — the re-derivation making d2 join x's origin (SPEC 10.5)`,
      );
      const context = `${label} after x's \`updated\` resolve`;
      const x = await showItem(product, workspace, "s", xId, context);
      const shown = `${context} \`review show s <x item>\``;
      assertSameJson(
        identitySet(x.origin),
        [J7_D1, J7_D2].sort(),
        `${shown}: staging premise — the re-derivation x's \`updated\` ` +
          `resolve triggers makes d2 join x's origin, presented {d1, d2} ` +
          `(SPEC 5.6, 10.5; T10.4-7(a))`,
      );
      const baselineEntries = decodeRecordedState(x, "baseline", shown);
      const inBaseline = recordedEntryOf(baselineEntries, J7_D2);
      if (inBaseline !== undefined) {
        fail(
          `${shown}: \`baseline\` holds an entry for d2, ` +
            `${JSON.stringify(inBaseline)} — a node that joins the item later ` +
            `gains no entry in \`baseline\` (SPEC 10.2): x's \`baseline\` was ` +
            `fixed when x entered the session at \`create\`, and d2 joined ` +
            `its origin only at the re-derivation; it holds entries for ` +
            recordedNodes(baselineEntries),
        );
      }
      const currentEntries = decodeRecordedState(x, "current", shown);
      const inCurrent = recordedEntryOf(currentEntries, J7_D2);
      if (inCurrent === undefined) {
        fail(
          `${shown}: \`current\` holds no entry for d2 — an \`updated\` ` +
            `resolve assigns and records once the re-derivation it triggers ` +
            `is done, against the item as re-derived, recording every scope, ` +
            `context, and origin node's presence (SPEC 10.2, 10.4), so d2, ` +
            `joined to x's origin by that re-derivation, is recorded present; ` +
            `a product recording before the re-derivation never records d2; ` +
            `it holds entries for ${recordedNodes(currentEntries)}`,
        );
      }
      if (!inCurrent.present || inCurrent.absentMarker) {
        fail(
          `${shown}: \`current\`'s entry for d2 must record it present — d2 ` +
            `is present when the resolve records it, and only an absent ` +
            `node's hashes are recorded as the explicit absent marker (SPEC ` +
            `10.2, 10.4); got ${JSON.stringify(inCurrent)}`,
        );
      }
    },
  );
}

const T10_2_2 = defineProductTest({
  id: "T10.2-2",
  title:
    "item `baseline` is fixed when the item enters the session: in a `--base` session it holds the scope node's relevant-hash values at the recorded baseline commit — not at creation time, and unchanged by further edits (byte-distinct `query node` captures at each moment discriminate); in audit and coverage sessions it holds the values of the current graph at item entry, likewise untouched by later edits; items entering by re-derivation too: in a `--base` session T10.5-5's newly visited p.q — its text edited before `create` and again before p's `updated` resolve, whose re-derivation adds its item — has a `baseline` holding p.q's subtreeHash and metadataHash at the recorded baseline commit, never those of the graph at the re-derivation; in an audit session a section b authored after `create` enters at an `updated` resolve's re-derivation with the values of the graph at it, b present, unchanged by a further edit to b; a scope node the item's baseline state lacks has an entry presenting it absent, its hashes the explicit absent marker — T10.5-8's item (3), whose scope holds d, added since the baseline — never d's current hashes, never no entry; and a node joining an item later gains no entry in `baseline` — T10.4-7(a)'s d2, joining x's origin at x's `updated` resolve's re-derivation, has none in x's `baseline`, while x's `current` records d2 present once that resolve records it; the re-derivation arms read each recorded state entry by entry (SPEC 10.2, 10.4, 10.5, 10.7)",
  run: async (product) => {
    // --- `--base` arm: baseline-commit values, not creation-time values ---
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [T2_SPEC]: t2Spec("Kid text v0.") },
      async (workspace) => {
        await workspace.gitInit();
        const base = await workspace.gitCommitAll("baseline");
        await buildOk(product, workspace, "T10.2-2 --base arm `build` at v0");
        const atBase = await queryNode(
          product,
          workspace,
          T2_AK,
          "T10.2-2 --base arm, baseline moment (v0)",
        );

        await workspace.file(T2_SPEC, T10_2_2_KID_V1);
        await buildOk(product, workspace, "T10.2-2 --base arm `build` at v1");
        const atCreate = await queryNode(
          product,
          workspace,
          T2_AK,
          "T10.2-2 --base arm, creation moment (v1)",
        );

        await expectExit(
          product,
          workspace,
          ["review", "create", "--base", base, "--name", "s"],
          0,
          "T10.2-2 `review create --base <baseline> --name s` at v1",
        );
        const scId = requireRow(
          await sessionStatus(product, workspace, "s", "T10.2-2 --base arm"),
          "subtree-coherence",
          T2_AK,
          "T10.2-2 --base arm",
        ).id;

        const first = await showItem(
          product,
          workspace,
          "s",
          scId,
          "T10.2-2 --base arm, first read",
        );

        // Further edit after the item entered the session.
        await workspace.file(T2_SPEC, T10_2_2_KID_V2);
        await buildOk(product, workspace, "T10.2-2 --base arm `build` at v2");
        const afterEdit = await queryNode(
          product,
          workspace,
          T2_AK,
          "T10.2-2 --base arm, post-create edit moment (v2)",
        );
        assertPairwiseDistinct(
          [
            ["the v0 subtreeHash", atBase.hashes.subtreeHash],
            ["the v1 subtreeHash", atCreate.hashes.subtreeHash],
            ["the v2 subtreeHash", afterEdit.hashes.subtreeHash],
            ["the constant metadataHash", atBase.hashes.metadataHash],
          ],
          "T10.2-2 --base arm",
        );
        const second = await showItem(
          product,
          workspace,
          "s",
          scId,
          "T10.2-2 --base arm, second read (after the further edit)",
        );

        assertBaselineRecord(
          first.baseline,
          atBase,
          [
            ["creation-time (v1)", atCreate],
            ["post-create (v2)", afterEdit],
          ],
          "T10.2-2 --base arm, first read: `baseline` holds the values at " +
            "the recorded baseline commit, not the creation-time graph's " +
            "(SPEC 10.2)",
        );
        assertBaselineRecord(
          second.baseline,
          atBase,
          [
            ["creation-time (v1)", atCreate],
            ["post-create (v2)", afterEdit],
          ],
          "T10.2-2 --base arm, second read: `baseline` still holds the " +
            "baseline-commit values after further edits (SPEC 10.2)",
        );
        assertSameInformation(
          second.baseline,
          first.baseline,
          "T10.2-2 --base arm: `baseline` is fixed when the item enters the " +
            "session — byte-stable information across reads bracketing a " +
            "further edit (SPEC 10.2)",
        );
      },
    );

    // --- audit arm: values of the current graph at item entry ---
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [T2_SPEC]: T10_2_2_KID_E0 },
      async (workspace) => {
        await buildOk(product, workspace, "T10.2-2 audit arm `build` at e0");
        const atEntry = await queryNode(
          product,
          workspace,
          T2_AK,
          "T10.2-2 audit arm, entry moment (e0)",
        );
        await expectExit(
          product,
          workspace,
          ["review", "create", "--strategy", "audit", "--name", "s"],
          0,
          "T10.2-2 `review create --strategy audit --name s`",
        );
        const scId = requireRow(
          await sessionStatus(product, workspace, "s", "T10.2-2 audit arm"),
          "subtree-coherence",
          T2_AK,
          "T10.2-2 audit arm",
        ).id;
        const first = await showItem(
          product,
          workspace,
          "s",
          scId,
          "T10.2-2 audit arm, first read",
        );

        await workspace.file(T2_SPEC, T10_2_2_KID_E1);
        await buildOk(product, workspace, "T10.2-2 audit arm `build` at e1");
        const afterEdit = await queryNode(
          product,
          workspace,
          T2_AK,
          "T10.2-2 audit arm, post-entry edit moment (e1)",
        );
        assertPairwiseDistinct(
          [
            ["the e0 subtreeHash", atEntry.hashes.subtreeHash],
            ["the e1 subtreeHash", afterEdit.hashes.subtreeHash],
            ["the constant metadataHash", atEntry.hashes.metadataHash],
          ],
          "T10.2-2 audit arm",
        );
        const second = await showItem(
          product,
          workspace,
          "s",
          scId,
          "T10.2-2 audit arm, second read (after the edit)",
        );

        assertBaselineRecord(
          second.baseline,
          atEntry,
          [["post-entry (e1)", afterEdit]],
          "T10.2-2 audit arm: in a session without a baseline, `baseline` " +
            "holds the current graph's values at item entry, untouched by " +
            "later edits (SPEC 10.2)",
        );
        assertSameInformation(
          second.baseline,
          first.baseline,
          "T10.2-2 audit arm: `baseline` is fixed at item entry (SPEC 10.2)",
        );
      },
    );

    // --- coverage arm: values of the current graph at item entry ---
    await withWorkspace(
      COVERAGE_CONFIG,
      { [T2_COV_SPEC]: T10_2_2_UNCOVERED_E0 },
      async (workspace) => {
        await buildOk(product, workspace, "T10.2-2 coverage arm `build` at e0");
        const atEntry = await queryNode(
          product,
          workspace,
          T2_U,
          "T10.2-2 coverage arm, entry moment (e0)",
        );
        await expectExit(
          product,
          workspace,
          ["review", "create", "--coverage", "p", "--name", "c"],
          0,
          "T10.2-2 `review create --coverage p --name c`",
        );
        const itemId = requireRow(
          await sessionStatus(product, workspace, "c", "T10.2-2 coverage arm"),
          "uncovered-requirement",
          T2_U,
          "T10.2-2 coverage arm",
        ).id;
        const first = await showItem(
          product,
          workspace,
          "c",
          itemId,
          "T10.2-2 coverage arm, first read",
        );

        await workspace.file(T2_COV_SPEC, T10_2_2_UNCOVERED_E1);
        await buildOk(product, workspace, "T10.2-2 coverage arm `build` at e1");
        const afterEdit = await queryNode(
          product,
          workspace,
          T2_U,
          "T10.2-2 coverage arm, post-entry edit moment (e1)",
        );
        assertPairwiseDistinct(
          [
            ["the e0 subtreeHash", atEntry.hashes.subtreeHash],
            ["the e1 subtreeHash", afterEdit.hashes.subtreeHash],
            ["the constant metadataHash", atEntry.hashes.metadataHash],
          ],
          "T10.2-2 coverage arm",
        );
        const second = await showItem(
          product,
          workspace,
          "c",
          itemId,
          "T10.2-2 coverage arm, second read (after the edit)",
        );

        assertBaselineRecord(
          second.baseline,
          atEntry,
          [["post-entry (e1)", afterEdit]],
          "T10.2-2 coverage arm: `baseline` holds the current graph's " +
            "values at item entry, untouched by later edits (SPEC 10.2)",
        );
        assertSameInformation(
          second.baseline,
          first.baseline,
          "T10.2-2 coverage arm: `baseline` is fixed at item entry (SPEC 10.2)",
        );
      },
    );

    // --- items entering by re-derivation; absent and joined nodes ---
    await runT1022NewlyVisitedArm(product);
    await runT1022AuthoredSectionArm(product);
    await runT1022AbsentMarkerArm(product);
    await runT1022JoinedNodeArm(product);
  },
});

// ---------------------------------------------------------------------------
// T10.2-3 — actionability after loss
// ---------------------------------------------------------------------------

const T3_A_SPEC = "specs/A.mdx";
const T3_A_ROOT = "specs/A.mdx";
const T3_A = "specs/A.mdx#a";
const T3_AK = "specs/A.mdx#a.k";

const T3_A_SOURCE = [
  '<S id="a">',
  "Parent alpha text.",
  "",
  '<S id="a.k">',
  "Kid keeps this recorded text.",
  "</S>",
  "</S>",
  "",
].join("\n");

const T3_B_SOURCE = ['<S id="b">', "Bravo text.", "</S>", ""].join("\n");

const T10_2_3 = defineProductTest({
  id: "T10.2-3",
  title:
    "actionability after loss: delete a scoped node's file, then `show` and `next --json` still present the node's identity (scope under its recorded identity, present: false) and its recorded text — byte-equal to the create-time subtree text, the item's sole recorded state — sufficient to act on the self-contained payload; the never-resolved item stays `unresolved` (SPEC 10.2, 10.4, 10.7; full text-provenance matrix in T10.7-12)",
  run: async (product) => {
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [T3_A_SPEC]: T3_A_SOURCE, "specs/B.mdx": T3_B_SOURCE },
      async (workspace) => {
        await buildOk(product, workspace, "T10.2-3 `build`");
        await expectExit(
          product,
          workspace,
          ["review", "create", "--strategy", "audit", "--name", "s"],
          0,
          "T10.2-3 `review create --strategy audit --name s`",
        );
        // The recorded text: the create-time state is the only state a
        // mutating subcommand derived the item under, so the payload's
        // provenance is unambiguous (SPEC 10.7).
        const recorded = await queryNode(
          product,
          workspace,
          T3_AK,
          "T10.2-3 create-time capture",
        );
        const akId = requireRow(
          await sessionStatus(product, workspace, "s", "T10.2-3"),
          "subtree-coherence",
          T3_AK,
          "T10.2-3",
        ).id;

        // The loss: the scoped node's whole file.
        await fsp.rm(workspace.path(T3_A_SPEC));

        const assertLostScopePayload = (
          item: ReviewItem,
          context: string,
        ): void => {
          if (item.scope.node !== T3_AK || item.scope.present !== false) {
            fail(
              `${context}: the item presents the lost node under its ` +
                `identity with current presence (SPEC 10.2, 10.4, 10.7); ` +
                `expected scope {node: ${JSON.stringify(T3_AK)}, present: ` +
                `false}, got ${JSON.stringify(item.scope)}`,
            );
          }
          if (item.scope.text !== recorded.subtreeText) {
            fail(
              `${context}: the item still presents the node's recorded text ` +
                `— its subtree text in the most recent graph state that ` +
                `contained it, here the create-time state (SPEC 10.2, 10.7; ` +
                `MUST remain actionable after deletion); expected ` +
                `${JSON.stringify(recorded.subtreeText)}, got ` +
                `${JSON.stringify(item.scope.text)}`,
            );
          }
          if (item.scope.sourceRange !== undefined) {
            fail(
              `${context}: an absent node has no current source, so no ` +
                `source range is presented (SPEC 10.7, 1.7); got ` +
                `${JSON.stringify(item.scope.sourceRange)}`,
            );
          }
          if (item.status !== "unresolved") {
            fail(
              `${context}: a never-resolved item stays unresolved — ` +
                `invalidation applies to resolved items alone (SPEC 10.3, ` +
                `10.4); got ${item.status}`,
            );
          }
          assertSameJson(
            identitySet(item.context),
            [T3_A_ROOT, T3_A].sort(),
            `${context}: the recorded context (the ancestor chain) is still ` +
              `presented under its identities (SPEC 10.2, 10.6)`,
          );
          for (const state of item.context) {
            if (state.present !== false) {
              fail(
                `${context}: the deleted file's context nodes are presented ` +
                  `absent under current presence (SPEC 10.4, 10.7); got ` +
                  `present ${String(state.present)} for ${state.node}`,
              );
            }
          }
        };

        const shownItem = await showItem(
          product,
          workspace,
          "s",
          akId,
          "T10.2-3 `review show` after the file deletion",
        );
        assertLostScopePayload(
          shownItem,
          "T10.2-3 `review show s <item>` after deleting specs/A.mdx",
        );

        const nextLabel = "T10.2-3 `review next s --json` after the deletion";
        const next = decodeNextReport(
          await runJson(
            product,
            workspace,
            ["review", "next", "s", "--json"],
            nextLabel,
          ),
          nextLabel,
        );
        if (next.fullyResolved || next.item === undefined) {
          fail(
            `${nextLabel}: the session still needs review, so \`next\` ` +
              `returns an item (SPEC 10.7); got fully-resolved`,
          );
        }
        if (next.item.id !== akId) {
          fail(
            `${nextLabel}: the first needing-review unblocked item in audit ` +
              `order is the lost leaf's item — specs/A.mdx sorts first and ` +
              `its root and parent items are blocked (SPEC 10.6, 10.7); ` +
              `expected ${akId}, got ${next.item.id}`,
          );
        }
        assertLostScopePayload(next.item, nextLabel);
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T10.2-4 — `current` reported as recorded
// ---------------------------------------------------------------------------

const T4_SPEC = "specs/A.mdx";
const T4_AK = "specs/A.mdx#a.k";
const T4_AN = "specs/A.mdx#a.n";

function t4Spec(kidText: string, controlText: string): string {
  return [
    '<S id="a">',
    "Parent text.",
    "",
    '<S id="a.k">',
    kidText,
    "</S>",
    "",
    '<S id="a.n">',
    controlText,
    "</S>",
    "</S>",
    "",
  ].join("\n");
}

/** The fixture after the presence-arm deletion of the a.k section. */
function t4SpecWithoutK(controlText: string): string {
  return [
    '<S id="a">',
    "Parent text.",
    "",
    '<S id="a.n">',
    controlText,
    "</S>",
    "</S>",
    "",
  ].join("\n");
}

// T10.2-4's edits of the built workspace — both leaves at v2, then v3, then
// the a.k section deleted — are staged-source records
// (helpers/staged-mdx.ts; S-9's before-any-product clause), the same template
// calls moved to module level.
const T10_2_4_V2 = stagedMdx(
  "T10.2-4 specs/A.mdx with both leaves at v2",
  t4Spec("Resolved kid v2.", "Control kid v2."),
);
const T10_2_4_V3 = stagedMdx(
  "T10.2-4 specs/A.mdx with both leaves at v3",
  t4Spec("Resolved kid v3.", "Control kid v3."),
);
const T10_2_4_WITHOUT_K_V3 = stagedMdx(
  "T10.2-4 specs/A.mdx with a.k deleted and the control kid at v3",
  t4SpecWithoutK("Control kid v3."),
);

// T10.2-4's re-derivation arm: p.q's text edited once more after its item
// entered at the re-derivation, p's own text still reverted — spelled by
// T10.5-5's exported `t1055PqSource`, a staged-source record (S-9).
const T10_2_4_PQ_FURTHER_EDIT = stagedMdx(
  "T10.2-4 specs/P.mdx with p.q's text at v3 after its item entered at the re-derivation (p's own text still reverted)",
  t1055PqSource("Pee own v0.", "Cue text v3."),
);

/**
 * Read p.q's item through `show` and `export` (T10.2-4's re-derivation arm;
 * SPEC 10.2, 10.4, 10.7): each reports its `current` holding p.q's
 * subtreeHash and metadataHash captured at p's `updated` resolve, and the
 * item `unresolved` — created so (10.2) and never resolved, so never
 * invalidated (10.4: invalidation applies to resolved items alone).
 */
async function assertT1024NewlyVisitedReads(
  product: ProductBinding,
  workspace: TestWorkspace,
  qId: string,
  atResolve: NodeHashes,
  wrong: readonly WrongMoment[],
  context: string,
): Promise<void> {
  const why =
    "an item a re-derivation adds is created there, its `current` written " +
    "then — 10.2: written at item creation; 10.5: new items are added with " +
    "current state — and reads report it as recorded, never recomputed " +
    "from the live graph (SPEC 10.2, 10.4); a product writing `current` " +
    "only at `create`, `split`, and resolve, or copying `baseline` into it, " +
    "fails";
  const shownLabel = `${context} \`review show s <p.q item>\``;
  const shown = await showItem(product, workspace, "s", qId, context);
  const exportLabel = `${context} \`review export s --json\``;
  const exported = requireItem(
    decodeExportReport(
      await runJson(
        product,
        workspace,
        ["review", "export", "s", "--json"],
        exportLabel,
      ),
      exportLabel,
    ).items,
    qId,
    exportLabel,
  );
  for (const [item, label] of [
    [shown, shownLabel],
    [exported, `${exportLabel}, the p.q item`],
  ] as const) {
    assertRecordedEntryAt(item, "current", PQ_Q, atResolve, wrong, why, label);
    if (item.status !== "unresolved") {
      fail(
        `${label}: p.q's item, created \`unresolved\` at the re-derivation ` +
          `and never resolved, stays \`unresolved\` — invalidation applies to ` +
          `resolved items alone (SPEC 10.2, 10.4); got ${item.status}`,
      );
    }
  }
}

/**
 * T10.2-4's re-derivation arm (TEST-SPEC T10.2-4; SPEC 10.2, 10.5): an item
 * a re-derivation adds is created there, its `current` written then.
 * T10.5-5's newly visited p.q (`stageT1055NewlyVisitedQ`, in a fresh
 * workspace holding `T10_5_5_PQ_INITIAL_FILES`): its item enters at p's
 * `updated` resolve, and `show` and `export` report its `current` holding
 * p.q's subtreeHash and metadataHash captured via `query node` at that
 * resolve — never its `baseline` values, the baseline commit's, which
 * differ (T10.2-2) — and still after a further edit to p.q's text, the item
 * staying `unresolved`; a product reporting `current` recomputed from the
 * live graph fails at that later read.
 */
async function runT1024NewlyVisitedArm(product: ProductBinding): Promise<void> {
  await withWorkspace(
    SPECS_ONLY_CONFIG,
    T10_5_5_PQ_INITIAL_FILES,
    async (workspace) => {
      const label = "T10.2-4 re-derivation arm (T10.5-5's newly visited p.q)";
      const staged = await stageT1055NewlyVisitedQ(product, workspace, label);
      const atBase = capturedNodeHashes(staged.baseline, PQ_Q, label);
      const atResolve = capturedNodeHashes(staged.atReDerivation, PQ_Q, label);
      assertPairwiseDistinct(
        [
          ["p.q's subtreeHash at the baseline commit", atBase.subtreeHash],
          ["p.q's subtreeHash at p's `updated` resolve", atResolve.subtreeHash],
          ["p.q's constant metadataHash", atBase.metadataHash],
        ],
        label,
      );
      const qId = requireRow(
        await sessionStatus(product, workspace, "s", label),
        "subtree-coherence",
        PQ_Q,
        `${label} after the re-derivation`,
      ).id;
      const copiedBaseline: WrongMoment = {
        moment: "at the baseline commit, its `baseline` value",
        hashes: atBase,
        product: "a product copying `baseline` into `current`",
      };
      await assertT1024NewlyVisitedReads(
        product,
        workspace,
        qId,
        atResolve,
        [copiedBaseline],
        `${label}, right after the resolve`,
      );

      await workspace.file(T10_5_5_PQ_FILE, T10_2_4_PQ_FURTHER_EDIT);
      await buildOk(
        product,
        workspace,
        `${label} \`build\` after p.q's further edit`,
      );
      const afterEdit = await queryNode(
        product,
        workspace,
        PQ_Q,
        `${label}, after p.q's further edit`,
      );
      assertPairwiseDistinct(
        [
          ["p.q's subtreeHash at the baseline commit", atBase.subtreeHash],
          ["p.q's subtreeHash at p's `updated` resolve", atResolve.subtreeHash],
          [
            "p.q's subtreeHash after the further edit",
            afterEdit.hashes.subtreeHash,
          ],
          ["p.q's constant metadataHash", atBase.metadataHash],
        ],
        label,
      );
      await assertT1024NewlyVisitedReads(
        product,
        workspace,
        qId,
        atResolve,
        [
          copiedBaseline,
          {
            moment: "after the further edit",
            hashes: afterEdit.hashes,
            product:
              "a product reporting `current` recomputed from the live graph",
          },
        ],
        `${label}, after p.q's further edit`,
      );
    },
  );
}

const T10_2_4 = defineProductTest({
  id: "T10.2-4",
  title:
    "`current` is reported as recorded, never recomputed: an item recording R1 at creation, resolved `no-change` at R2, then edited to R3 (R1/R2/R3 pairwise-distinct `query node` captures) is reported `invalidated` by `show`, `next --json`, and `export` with `current` holding R2's relevant hashes — not R1, not R3; a never-resolved sibling receiving the same edits stays `unresolved` with `current` equal to its create-time R1; after a re-resolve, deleting the scope node presents it absent while `current` still carries the resolve-time recording unchanged; an item a re-derivation adds is created there, its `current` written then: T10.5-5's newly visited p.q, whose item enters at p's `updated` resolve, is reported by `show` and `export` with `current` holding p.q's subtreeHash and metadataHash captured via `query node` at that resolve — never its `baseline` values, which differ — and still after a further edit to p.q's text, its item staying `unresolved`, read entry by entry (SPEC 10.2, 10.4, 10.5, 10.7)",
  run: async (product) => {
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [T4_SPEC]: t4Spec("Resolved kid v1.", "Control kid v1.") },
      async (workspace) => {
        await buildOk(product, workspace, "T10.2-4 `build` at v1");
        await expectExit(
          product,
          workspace,
          ["review", "create", "--strategy", "audit", "--name", "s"],
          0,
          "T10.2-4 `review create --strategy audit --name s`",
        );
        const r1 = await queryNode(product, workspace, T4_AK, "T10.2-4 R1");
        const rn1 = await queryNode(product, workspace, T4_AN, "T10.2-4 Rn1");
        const status = await sessionStatus(product, workspace, "s", "T10.2-4");
        const akId = requireRow(
          status,
          "subtree-coherence",
          T4_AK,
          "T10.2-4",
        ).id;
        const anId = requireRow(
          status,
          "subtree-coherence",
          T4_AN,
          "T10.2-4",
        ).id;

        // Edit both leaves: live relevant hashes become R2 / Rn2.
        await workspace.file(T4_SPEC, T10_2_4_V2);
        await buildOk(product, workspace, "T10.2-4 `build` at v2");
        const r2 = await queryNode(product, workspace, T4_AK, "T10.2-4 R2");
        const rn2 = await queryNode(product, workspace, T4_AN, "T10.2-4 Rn2");

        // Resolve the a.k item: every resolve records the current relevant
        // state (SPEC 10.4), rewriting `current` to R2. `no-change` — no
        // re-derivation (SPEC 10.5).
        await expectExit(
          product,
          workspace,
          ["review", "resolve", "s", akId, "--status", "no-change"],
          0,
          "T10.2-4 `review resolve s <a.k item> --status no-change` at R2",
        );

        // Further edit: live values become R3 / Rn3.
        await workspace.file(T4_SPEC, T10_2_4_V3);
        await buildOk(product, workspace, "T10.2-4 `build` at v3");
        const r3 = await queryNode(product, workspace, T4_AK, "T10.2-4 R3");
        const rn3 = await queryNode(product, workspace, T4_AN, "T10.2-4 Rn3");

        assertPairwiseDistinct(
          [
            ["R1 subtreeHash", r1.hashes.subtreeHash],
            ["R2 subtreeHash", r2.hashes.subtreeHash],
            ["R3 subtreeHash", r3.hashes.subtreeHash],
            ["a.k metadataHash", r1.hashes.metadataHash],
          ],
          "T10.2-4 (a.k moments)",
        );
        assertPairwiseDistinct(
          [
            ["Rn1 subtreeHash", rn1.hashes.subtreeHash],
            ["Rn2 subtreeHash", rn2.hashes.subtreeHash],
            ["Rn3 subtreeHash", rn3.hashes.subtreeHash],
            ["a.n metadataHash", rn1.hashes.metadataHash],
          ],
          "T10.2-4 (a.n moments)",
        );

        const assertResolvedItemAtR2 = (
          item: ReviewItem,
          context: string,
        ): void => {
          if (item.status !== "invalidated") {
            fail(
              `${context}: the resolved item whose recorded state (R2) ` +
                `differs from the live graph (R3) is reported invalidated ` +
                `(SPEC 10.4); got ${item.status}`,
            );
          }
          assertRecordedHolds(
            item.current,
            r2.hashes.subtreeHash,
            "the resolve-time (R2) subtreeHash",
            context,
          );
          assertRecordedHolds(
            item.current,
            r2.hashes.metadataHash,
            "the scope node's metadataHash",
            context,
          );
          assertRecordedLacks(
            item.current,
            r1.hashes.subtreeHash,
            "the creation-time (R1) subtreeHash — a product that never rewrites the creation-time record fails",
            context,
          );
          assertRecordedLacks(
            item.current,
            r3.hashes.subtreeHash,
            "the live (R3) subtreeHash — a product reporting values recomputed from the current graph fails",
            context,
          );
        };
        const assertControlItemAtR1 = (
          item: ReviewItem,
          context: string,
        ): void => {
          if (item.status !== "unresolved") {
            fail(
              `${context}: the never-resolved control item stays unresolved ` +
                `— invalidation applies to resolved items alone (SPEC 10.4); ` +
                `got ${item.status}`,
            );
          }
          assertRecordedHolds(
            item.current,
            rn1.hashes.subtreeHash,
            "the create-time (Rn1) subtreeHash — `current` is written at item creation",
            context,
          );
          assertRecordedLacks(
            item.current,
            rn2.hashes.subtreeHash,
            "the mid-sequence (Rn2) subtreeHash",
            context,
          );
          assertRecordedLacks(
            item.current,
            rn3.hashes.subtreeHash,
            "the live (Rn3) subtreeHash",
            context,
          );
        };

        assertResolvedItemAtR2(
          await showItem(product, workspace, "s", akId, "T10.2-4 show at R3"),
          "T10.2-4 `review show s <a.k item>` at live R3",
        );
        assertControlItemAtR1(
          await showItem(
            product,
            workspace,
            "s",
            anId,
            "T10.2-4 control show at R3",
          ),
          "T10.2-4 `review show s <a.n item>` (creation arm) at live R3",
        );

        const nextLabel = "T10.2-4 `review next s --json` at live R3";
        const next = decodeNextReport(
          await runJson(
            product,
            workspace,
            ["review", "next", "s", "--json"],
            nextLabel,
          ),
          nextLabel,
        );
        if (next.fullyResolved || next.item === undefined) {
          fail(`${nextLabel}: the invalidated item needs review (SPEC 10.3)`);
        }
        if (next.item.id !== akId) {
          fail(
            `${nextLabel}: the a.k item is the first needing-review ` +
              `unblocked item in audit order (SPEC 10.6, 10.7); expected ` +
              `${akId}, got ${next.item.id}`,
          );
        }
        assertResolvedItemAtR2(next.item, nextLabel);

        const exportLabel = "T10.2-4 `review export s --json` at live R3";
        const exported = decodeExportReport(
          await runJson(
            product,
            workspace,
            ["review", "export", "s", "--json"],
            exportLabel,
          ),
          exportLabel,
        );
        assertResolvedItemAtR2(
          requireItem(exported.items, akId, exportLabel),
          `${exportLabel}, the a.k item`,
        );
        assertControlItemAtR1(
          requireItem(exported.items, anId, exportLabel),
          `${exportLabel}, the a.n control item`,
        );

        // --- Presence arm: after a resolve, delete the scope node ---
        await expectExit(
          product,
          workspace,
          ["review", "resolve", "s", akId, "--status", "no-change"],
          0,
          "T10.2-4 presence arm: re-resolve `--status no-change` at R3",
        );
        const resolvedRead = await showItem(
          product,
          workspace,
          "s",
          akId,
          "T10.2-4 presence arm, post-resolve read",
        );
        if (resolvedRead.status !== "no-change") {
          fail(
            `T10.2-4 presence arm: the re-resolved item reports its ` +
              `resolved status while the recording matches the graph ` +
              `(SPEC 10.3, 10.4); got ${resolvedRead.status}`,
          );
        }
        // "Rewritten at each resolve", once more: the record moved to R3.
        assertRecordedHolds(
          resolvedRead.current,
          r3.hashes.subtreeHash,
          "the re-resolve-time (R3) subtreeHash",
          "T10.2-4 presence arm, post-resolve read",
        );
        assertRecordedLacks(
          resolvedRead.current,
          r2.hashes.subtreeHash,
          "the previous resolve's (R2) subtreeHash",
          "T10.2-4 presence arm, post-resolve read",
        );
        const recordedAtResolve = canonicalJson(resolvedRead.current);

        // Delete the scope node (the a.k section construct).
        await workspace.file(T4_SPEC, T10_2_4_WITHOUT_K_V3);
        await buildOk(product, workspace, "T10.2-4 `build` after the deletion");
        const afterLoss = await showItem(
          product,
          workspace,
          "s",
          akId,
          "T10.2-4 presence arm, post-deletion read",
        );
        const lossContext =
          "T10.2-4 presence arm `review show s <a.k item>` after deleting the scope node";
        if (
          afterLoss.scope.node !== T4_AK ||
          afterLoss.scope.present !== false
        ) {
          fail(
            `${lossContext}: reads present the node absent under its ` +
              `current presence (SPEC 10.4, 10.7); got ` +
              JSON.stringify(afterLoss.scope),
          );
        }
        if (afterLoss.status !== "invalidated") {
          fail(
            `${lossContext}: the recorded-vs-graph presence divergence ` +
              `invalidates the resolved item (SPEC 10.4); got ${afterLoss.status}`,
          );
        }
        if (canonicalJson(afterLoss.current) !== recordedAtResolve) {
          fail(
            `${lossContext}: the reported \`current\` still carries the ` +
              `resolve-time recording — presence marker and hashes — after ` +
              `the deletion; read-time invalidation compares and reports, ` +
              `it never rewrites (SPEC 10.2, 10.4)\n` +
              `  actual:   ${canonicalJson(afterLoss.current)}\n` +
              `  expected: ${recordedAtResolve}`,
          );
        }
      },
    );

    // --- Re-derivation arm: `current` written where a re-derivation adds
    // the item ---
    await runT1024NewlyVisitedArm(product);
  },
});

// ---------------------------------------------------------------------------
// T10.3-1 — statuses
// ---------------------------------------------------------------------------

const T5_SPEC = "specs/A.mdx";
const T5_ROOT = "specs/A.mdx";
const T5_X = "specs/A.mdx#x";
const T5_Y = "specs/A.mdx#y";
const T5_Z = "specs/A.mdx#z";

function t5Spec(xText: string): string {
  return [
    '<S id="x">',
    xText,
    "</S>",
    "",
    '<S id="y">',
    "Wye text.",
    "</S>",
    "",
    '<S id="z">',
    "Zed text.",
    "</S>",
    "",
  ].join("\n");
}

// T10.3-1's edit of the built workspace (x's text at v2) — a staged-source
// record (helpers/staged-mdx.ts; S-9's before-any-product clause), the same
// template call moved to module level.
const T10_3_1_X_V2 = stagedMdx(
  "T10.3-1 specs/A.mdx with x's text at v2",
  t5Spec("Ex text v2."),
);

const T10_3_1 = defineProductTest({
  id: "T10.3-1",
  title:
    "`resolve --status` accepts exactly `updated`, `no-change`, `skipped`; any other value (unknown token, wrong case, the non-resolve statuses `unresolved`/`invalidated`, empty) is a usage error — exit 2, the 12.7 error document as the entire stdout under `--json`, nothing modified; items with `unresolved` or `invalidated` status need review and appear in `next`, resolved ones do not (`next` walks the audit items to fully-resolved, and an edit re-surfaces the invalidated item) (SPEC 10.3, 10.4, 10.7, 12.0)",
  run: async (product) => {
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [T5_SPEC]: t5Spec("Ex text v1.") },
      async (workspace) => {
        await buildOk(product, workspace, "T10.3-1 `build`");
        await expectExit(
          product,
          workspace,
          ["review", "create", "--strategy", "audit", "--name", "s"],
          0,
          "T10.3-1 `review create --strategy audit --name s`",
        );
        const initial = await sessionStatus(product, workspace, "s", "T10.3-1");
        const rootId = requireRow(
          initial,
          "subtree-coherence",
          T5_ROOT,
          "T10.3-1",
        ).id;
        const xId = requireRow(
          initial,
          "subtree-coherence",
          T5_X,
          "T10.3-1",
        ).id;
        const yId = requireRow(
          initial,
          "subtree-coherence",
          T5_Y,
          "T10.3-1",
        ).id;
        const zId = requireRow(
          initial,
          "subtree-coherence",
          T5_Z,
          "T10.3-1",
        ).id;

        // Any other `--status` value is a usage error: exit 2, the 12.7
        // error document as the entire stdout under --json (12.0, H-5),
        // nothing modified (SPEC 10.7, 12.0). The
        // non-resolve statuses of 10.3 are values too — `resolve` accepts
        // exactly the three resolved statuses.
        const invalidValues: readonly (readonly [string, string])[] = [
          ["resolved", "an unknown status token"],
          ["Updated", "a case variant (values compare byte-wise, SPEC 12.0)"],
          ["unresolved", "a 10.3 status that is not a resolve status"],
          ["invalidated", "a 10.3 status that is not a resolve status"],
          ["", "the empty value"],
        ];
        for (const [value, why] of invalidValues) {
          const context = `T10.3-1 \`review resolve s <x item> --status ${JSON.stringify(value)} --json\` (${why})`;
          await assertLeavesUnchanged(
            workspace.root,
            async () => {
              const result = await expectExit(
                product,
                workspace,
                ["review", "resolve", "s", xId, "--status", value, "--json"],
                2,
                `${context} — any value other than updated/no-change/skipped is a usage error (SPEC 10.7, 12.0)`,
              );
              expectErrorDocument(
                result,
                `${context} — under --json, the exit-2 error document is ` +
                  `the entire stdout (SPEC 12.0, 12.7, H-5)`,
              );
            },
            `${context} — a usage error modifies nothing`,
          );
        }

        // `next` returns unresolved unblocked items in order; each accepted
        // status resolves its item out of `next`.
        const expectNext = async (
          expectedId: string,
          expectedStatus: ItemStatus,
          context: string,
        ): Promise<void> => {
          const label = `${context} \`review next s --json\``;
          const next = decodeNextReport(
            await runJson(
              product,
              workspace,
              ["review", "next", "s", "--json"],
              label,
            ),
            label,
          );
          if (next.fullyResolved || next.item === undefined) {
            fail(
              `${label}: an item with status ${expectedStatus} needs review ` +
                `and appears in \`next\` (SPEC 10.3, 10.7); got fully-resolved`,
            );
          }
          if (
            next.item.id !== expectedId ||
            next.item.status !== expectedStatus
          ) {
            fail(
              `${label}: expected item ${expectedId} with status ` +
                `${expectedStatus} (SPEC 10.3, 10.6, 10.7); got ${next.item.id} ` +
                `with status ${next.item.status}`,
            );
          }
        };

        await expectNext(xId, "unresolved", "T10.3-1 before any resolve —");
        for (const [id, status, label] of [
          [xId, "updated", "x"],
          [yId, "no-change", "y"],
          [zId, "skipped", "z"],
        ] as const) {
          await expectExit(
            product,
            workspace,
            ["review", "resolve", "s", id, "--status", status],
            0,
            `T10.3-1 \`review resolve s <${label} item> --status ${status}\` — an accepted resolve status (SPEC 10.3, 10.7)`,
          );
        }
        // The three leaves are resolved and no longer appear; the root item
        // is now unblocked and unresolved — it appears.
        await expectNext(
          rootId,
          "unresolved",
          "T10.3-1 after resolving the leaves —",
        );
        await expectExit(
          product,
          workspace,
          ["review", "resolve", "s", rootId, "--status", "no-change"],
          0,
          "T10.3-1 `review resolve s <root item> --status no-change`",
        );
        const doneLabel =
          "T10.3-1 `review next s --json` with every item resolved";
        const done = decodeNextReport(
          await runJson(
            product,
            workspace,
            ["review", "next", "s", "--json"],
            doneLabel,
          ),
          doneLabel,
        );
        if (!done.fullyResolved) {
          fail(
            `${doneLabel}: resolved items do not need review — with every ` +
              `item resolved the session reports fully resolved (SPEC 10.3, 10.7)`,
          );
        }
        const resolvedStatus = await sessionStatus(
          product,
          workspace,
          "s",
          "T10.3-1 fully resolved",
        );
        assertSameJson(
          resolvedStatus.items.map((row) => [row.id, row.status, row.blocked]),
          [
            [rootId, "no-change", false],
            [xId, "updated", false],
            [yId, "no-change", false],
            [zId, "skipped", false],
          ],
          "T10.3-1: stored statuses after the resolves, in audit item order " +
            "(SPEC 10.3, 10.6, 10.7)",
        );
        assertTotals(
          resolvedStatus,
          {
            unresolved: 0,
            invalidated: 0,
            updated: 1,
            "no-change": 2,
            skipped: 1,
          },
          "T10.3-1 fully resolved",
        );

        // Invalidated items need review: edit x — its item (and the root's,
        // whose scope includes x) become invalidated; the root re-blocks
        // (SPEC 10.3), so `next` returns x's item.
        await workspace.file(T5_SPEC, T10_3_1_X_V2);
        await buildOk(product, workspace, "T10.3-1 `build` after the x edit");
        const invalidated = await sessionStatus(
          product,
          workspace,
          "s",
          "T10.3-1 after the x edit",
        );
        assertSameJson(
          invalidated.items.map((row) => [row.id, row.status, row.blocked]),
          [
            [rootId, "invalidated", true],
            [xId, "invalidated", false],
            [yId, "no-change", false],
            [zId, "skipped", false],
          ],
          "T10.3-1: the edit invalidates the resolved items whose relevant " +
            "state it changed — x's and the root's (its scope spans every " +
            "descendant) — and the root re-blocks while x is not resolved " +
            "(SPEC 10.3, 10.4)",
        );
        assertTotals(
          invalidated,
          {
            unresolved: 0,
            invalidated: 2,
            updated: 0,
            "no-change": 1,
            skipped: 1,
          },
          "T10.3-1 after the x edit",
        );
        await expectNext(xId, "invalidated", "T10.3-1 after the x edit —");
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T10.3-2 — re-blocking
// ---------------------------------------------------------------------------

const T6_SPEC = "specs/A.mdx";
const T6_A = "specs/A.mdx#a";
const T6_AK = "specs/A.mdx#a.k";
const T6_ROOT = "specs/A.mdx";

function t6Spec(kidText: string): string {
  return [
    '<S id="a">',
    "Parent text.",
    "",
    '<S id="a.k">',
    kidText,
    "</S>",
    "</S>",
    "",
  ].join("\n");
}

// T10.3-2's edit of the built workspace (the kid text at v2) — a
// staged-source record (helpers/staged-mdx.ts; S-9's before-any-product
// clause), the same template call moved to module level.
const T10_3_2_KID_V2 = stagedMdx(
  "T10.3-2 specs/A.mdx with the kid text at v2",
  t6Spec("Kid text v2."),
);

const T10_3_2 = defineProductTest({
  id: "T10.3-2",
  title:
    "re-blocking: a resolved blocker that becomes `invalidated` re-blocks its dependents — the dependent's blocked state flips back to blocked in `status`, `resolve` on the dependent is refused while the blocker is invalidated — exit 1 with exactly one code-less finding in T10.7-14's form, `code` and `path` `null`, `locations` `[]`, nothing modified — and succeeds again once the blocker is re-resolved (SPEC 10.3, 10.4, 10.7, 12.0, 12.7, 14)",
  run: async (product) => {
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [T6_SPEC]: t6Spec("Kid text v1.") },
      async (workspace) => {
        await buildOk(product, workspace, "T10.3-2 `build`");
        await expectExit(
          product,
          workspace,
          ["review", "create", "--strategy", "audit", "--name", "s"],
          0,
          "T10.3-2 `review create --strategy audit --name s`",
        );
        const initial = await sessionStatus(product, workspace, "s", "T10.3-2");
        const aId = requireRow(
          initial,
          "subtree-coherence",
          T6_A,
          "T10.3-2",
        ).id;
        const akId = requireRow(
          initial,
          "subtree-coherence",
          T6_AK,
          "T10.3-2",
        ).id;
        const rootId = requireRow(
          initial,
          "subtree-coherence",
          T6_ROOT,
          "T10.3-2",
        ).id;

        const expectBlockedStates = async (
          expected: Readonly<Record<string, readonly [ItemStatus, boolean]>>,
          context: string,
        ): Promise<void> => {
          const report = await sessionStatus(product, workspace, "s", context);
          assertSameJson(
            Object.fromEntries(
              report.items.map((row) => [row.id, [row.status, row.blocked]]),
            ),
            expected,
            `${context}: per-item status and blocked state (SPEC 10.3)`,
          );
        };

        await expectBlockedStates(
          {
            [rootId]: ["unresolved", true],
            [aId]: ["unresolved", true],
            [akId]: ["unresolved", false],
          },
          "T10.3-2 initial state — a is blocked by its child's item",
        );

        // Resolve the blocker: the dependent unblocks.
        await expectExit(
          product,
          workspace,
          ["review", "resolve", "s", akId, "--status", "no-change"],
          0,
          "T10.3-2 `review resolve s <a.k item> --status no-change`",
        );
        await expectBlockedStates(
          {
            [rootId]: ["unresolved", true],
            [aId]: ["unresolved", false],
            [akId]: ["no-change", false],
          },
          "T10.3-2 after resolving the blocker — the dependent is unblocked",
        );

        // Invalidate the blocker: the dependent's blocked state flips back.
        await workspace.file(T6_SPEC, T10_3_2_KID_V2);
        await buildOk(product, workspace, "T10.3-2 `build` after the kid edit");
        await expectBlockedStates(
          {
            [rootId]: ["unresolved", true],
            [aId]: ["unresolved", true],
            [akId]: ["invalidated", false],
          },
          "T10.3-2 after the kid edit — invalidated is not a resolved " +
            "status, so the blocker re-blocks its dependent (SPEC 10.3, 10.4)",
        );

        // Resolving the re-blocked dependent is refused in T10.7-14's
        // finding form — exit 1, one code-less finding, `code` and `path`
        // `null`, `locations` `[]` (a refused review operation, SPEC 10.7,
        // 12.0, 12.7, 14) — nothing modified: the session file and the
        // whole workspace stay byte-identical (SPEC 10.1, 13.4, 13.5).
        await expectReviewRefusal(
          product,
          workspace,
          ["review", "resolve", "s", aId, "--status", "no-change"],
          ".xspec/reviews/s.json",
          "T10.3-2 [a's item while its blocker is invalidated: resolving a " +
            "blocked item is refused, SPEC 10.3, 10.7, 12.0]",
          { nothingModified: true },
        );

        // Re-resolve the blocker (`resolve` applies to any unblocked item
        // regardless of current status, SPEC 10.7): the dependent unblocks
        // and resolves.
        await expectExit(
          product,
          workspace,
          ["review", "resolve", "s", akId, "--status", "no-change"],
          0,
          "T10.3-2 re-resolve of the invalidated blocker (unblocked, so " +
            "resolvable regardless of status, SPEC 10.7)",
        );
        await expectBlockedStates(
          {
            [rootId]: ["unresolved", true],
            [aId]: ["unresolved", false],
            [akId]: ["no-change", false],
          },
          "T10.3-2 after re-resolving the blocker — the dependent is " +
            "unblocked again",
        );
        await expectExit(
          product,
          workspace,
          ["review", "resolve", "s", aId, "--status", "no-change"],
          0,
          "T10.3-2 `review resolve s <a item> --status no-change` once the " +
            "blocker is re-resolved — no longer refused (SPEC 10.3)",
        );
      },
    );
  },
});

/** TEST-SPEC §10.2–§10.3, in canonical ID order (SUITE-34). */
export const section102to103Tests: readonly ProductTestEntry[] = [
  T10_2_1,
  T10_2_2,
  T10_2_3,
  T10_2_4,
  T10_3_1,
  T10_3_2,
];
