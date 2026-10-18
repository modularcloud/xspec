// TEST-SPEC §10.4 (relevant hashes and invalidation) — SUITE-35:
// T10.4-1…T10.4-6.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), decodes output through the H-3 adapters,
// and rejects a product only via diagnosed assertion failures (H-8).
//
// SPEC 10.4: resolving an item records its relevant hashes (per kind) and
// every scope/context/origin node's presence; a resolved item becomes
// `invalidated` when that recorded state differs from the current graph — a
// recorded hash changed, a presence changed in either direction, or the
// item's generator-derived context set changed. Recorded nodes compare as
// canonical identities (5.4), so journaled renames and moves duplicate no
// item, discard no status, and by themselves invalidate nothing; reads
// present recorded nodes under current identities and never write the
// session file.
//
// Conservative operationalizations (noted per H-3/H-4):
// - Invalidation is observed through `review status --json` rows (read-time
//   invalidation applies to every read, SPEC 10.4); T10.4-2's journal arm
//   also reads `show` and `export`, whose payloads present the scope node's
//   absence; T10.4-3 also reads `show`, `next --json`, and `export`, whose
//   payloads present the current context set as `context` and `origin`,
//   `blockedBy`, and `reason` as last assigned, byte-comparing the session
//   file around each read after its context-set edit; T10.4-5 pins all
//   four reads — `status`, `next`, `show`, `export` — on both the
//   invalidated reporting and session-file byte-identity; and T10.4-6 also
//   reads `show` and `export`, whose payloads present an item the
//   generators no longer produce with its `context` as last assigned, and
//   its `reason` as last assigned.
// - `reason`'s composition is unpinned (SPEC 10.2): T10.4-3 and T10.4-6
//   compare it byte for byte between captures from the same surface, its
//   content never asserted.
// - Every sensitivity arm asserts its staging premises via `query node`
//   captures bracketing the edit: the hashes the arm targets must change and
//   the hashes it must isolate must not (SPEC 5.5), and every control edit
//   must demonstrably change the edited node — so no arm passes or fails for
//   the wrong reason (H-8). T10.4-6 checks its hash premises at every
//   staged state against a capture at the baseline.
// - Re-resolves between arms use `--status no-change` (no re-derivation,
//   SPEC 10.5), so each arm starts from a freshly recorded state matching the
//   graph; T10.4-2's journal arm, T10.4-4's reintroduction and
//   decomposition arms, and T10.4-6's (b) are the places `--status updated`
//   (re-derivation) is staged, exactly as their TEST-SPEC texts prescribe.
// - T10.4-4's decomposition arm reads the recorded decomposition from
//   `export`'s recorded decompositions, which the review adapter decodes to
//   each one's kind and scope node (helpers/adapters/review.ts), and its
//   split's outcome from `status` and `export` as staging premises; it
//   resolves the decomposition's two items with distinct statuses before the
//   rename (`no-change`, `skipped`), so that keeping their statuses is
//   discriminating, as the rename arm's distinct statuses are, and asserts
//   the rename's purity (6.2: every hash byte-identical) as a premise, so no
//   status it asserts turns on a hash.
// - "Recorded state intact" across a journaled rename/move (T10.4-4) is
//   asserted as: statuses preserved and not invalidated, plus the reported
//   `current` record still holding the pre-operation hash values captured via
//   `query node` among its string leaves (H-4: opaque record shape,
//   spec-fixed values) — meaningful because 6.2 purity keeps those hash
//   values byte-identical across the operation, asserted as a premise.
// - T10.4-5 byte-compares exactly the session file
//   (`.xspec/reviews/<name>.json`, SPEC 10.1) around each read — the object
//   whose byte-identity SPEC 10.4 pins ("reads never write the session
//   file") — not the whole workspace, whose other files are governed by
//   other tests (T6.1-1, T13.4-5, T12.0-11). Those byte-compares are its one
//   observation that the reads persist nothing (CERTIFICATIONS.md
//   §VIOL-CORE-PERSISTREADS's staging constraint): once a read has computed
//   invalidation, no `review list` runs — its counts read stored statuses
//   (SPEC 10.7) — and the staleness stands until the closing mutating
//   `resolve`, so no answer turns on the stored status.
// - Fixture edits — T10.4-2's manual deletion of `.xspec/journal` included —
//   are followed by an explicit `build` before any read, so no read relies
//   on the 13.3 refresh path (that path is T13.3-*'s business).
//
// Sources staged after a body's first product invocation — T10.4-1's
// sensitivity edits (each scenario's former `write()` closure over mutable
// version variables enumerated into its successive states, in staging order,
// every state carrying the earlier edits forward), T10.4-2's presence flips,
// T10.4-3's context-set edit, T10.4-4's post-rename deletion, T10.4-5's
// staleness edit, T10.4-6's upstream edits and reverts — are staged-source
// records (helpers/staged-mdx.ts, S-9: judged before any product exists),
// the same template calls moved to module level. A staging that precedes a
// body's first invocation stays plain (S-7's sweep reaches it against the
// stub): T10.4-1's subtree-coherence pre-`create` edit and T10.4-3's a.k1
// edit, each between `gitCommitAll` and the first `build`, and each body's
// first workspace's initial files. The initial `.mdx` files of every later
// workspace — T10.4-1's five later scenarios, T10.4-2's context, origin, and
// journal arms, T10.4-4's move, reintroduction, and decomposition arms,
// T10.4-6's twin — are records too, passed as the `files` entries (S-9's
// before-any-product clause covers a workspace created after the body's
// first invocation).
// T10.4-4's reintroduction and decomposition arms append a new section a to
// bytes the rename wrote — no harness constant equals them — so each append
// is an anchored `workspace.edit()` (the tail's uniqueness and end position
// diagnosed first, SPEC 6.4).
//
// The configurations and the code source of those later workspaces are
// TypeScript staged-source records (helpers/staged-ts.ts; S-9's TypeScript
// and timing clauses), every one well-formed and staged wherever it is
// used: `SPECS_ONLY_CONFIG` (T10.4-1's, T10.4-2's, T10.4-4's, and
// T10.4-6's later workspaces), `SPECS_CODE_CONFIG` and `CI_CODE_SOURCE`
// (T10.4-1's code-impact scenario), and `COVERAGE_CONFIG` (T10.4-1's
// uncovered-requirement scenario).

import { Buffer } from "node:buffer";
import * as fsp from "node:fs/promises";
import type {
  ExportReport,
  ItemStatus,
  NodeHashes,
  NodeReport,
  ReviewItem,
  SessionListEntry,
  SessionStatusReport,
  SessionStatusRow,
} from "../../helpers/adapters/index.js";
import {
  ITEM_STATUSES,
  decodeExportReport,
  decodeItemReport,
  decodeNextReport,
  decodeNodeReport,
  decodeSessionListReport,
  decodeSessionStatusReport,
} from "../../helpers/adapters/index.js";
import {
  assertBytesEqual,
  bytesEqual,
  fail,
} from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { type StagedMdx, stagedMdx } from "../../helpers/staged-mdx.js";
import { type StagedTs, stagedTs } from "../../helpers/staged-ts.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { InitialFileContents } from "../../helpers/workspace.js";
import { assertSameJson, buildOk, expectExit, runJson } from "./support.js";

// Minimal declarative configuration (SPEC 7): exactly one spec group.
const SPECS_ONLY_CONFIG = stagedTs(
  "T10.4-1/T10.4-2/T10.4-4/T10.4-6 xspec.config.ts — one spec group",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
);

// Spec group plus a code group (SPEC 7.2) — the `code-impact` scenario needs
// an impacted code location (SPEC 9.2, 10.5).
const SPECS_CODE_CONFIG = stagedTs(
  "T10.4-1 code-impact xspec.config.ts — one spec group and the code group app",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: {
    app: ["src/**/*.ts"]
  }
})
`,
);

// Spec group plus a direct coverage profile over it (SPEC 7.4) — the
// `uncovered-requirement` scenario: an uncovered required leaf yields an
// `uncovered-requirement` item in a coverage session (SPEC 10.7).
const COVERAGE_CONFIG = stagedTs(
  "T10.4-1 uncovered-requirement xspec.config.ts — one spec group and the coverage profile p",
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

/** Stage a fresh workspace (config plus `files`), run `body`, dispose (H-1). */
async function withWorkspace<T>(
  config: StagedTs,
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

/** `review export <name> --json`, decoded (SPEC 10.7). */
async function exportSession(
  product: ProductBinding,
  workspace: TestWorkspace,
  name: string,
  context: string,
): Promise<ExportReport> {
  const label = `${context} \`review export ${name} --json\``;
  return decodeExportReport(
    await runJson(
      product,
      workspace,
      ["review", "export", name, "--json"],
      label,
    ),
    label,
  );
}

/** `review resolve <name> <item-id> --status <status>` must succeed. */
async function resolveOk(
  product: ProductBinding,
  workspace: TestWorkspace,
  name: string,
  itemId: string,
  status: ItemStatus,
  context: string,
): Promise<void> {
  await expectExit(
    product,
    workspace,
    ["review", "resolve", name, itemId, "--status", status],
    0,
    context,
  );
}

/**
 * The unique status row for a kind and scope node, diagnosed loudly when
 * missing or duplicated (SPEC 10.5: at most one item per kind and scope
 * node).
 */
function requireRow(
  report: SessionStatusReport,
  kind: SessionStatusRow["kind"],
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

/** The unique status row with the given item id, diagnosed when absent. */
function requireRowById(
  report: SessionStatusReport,
  id: string,
  context: string,
): SessionStatusRow {
  const rows = report.items.filter((row) => row.id === id);
  if (rows.length !== 1) {
    fail(
      `${context}: expected exactly one item with id ${JSON.stringify(id)} ` +
        `(SPEC 10.2: item ids are unique within the session); found ` +
        `${String(rows.length)} among ` +
        JSON.stringify(report.items.map((row) => row.id)),
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

/** Read `status` and assert one item's reported status (SPEC 10.4). */
async function expectItemStatus(
  product: ProductBinding,
  workspace: TestWorkspace,
  session: string,
  itemId: string,
  expected: ItemStatus,
  context: string,
): Promise<void> {
  const report = await sessionStatus(product, workspace, session, context);
  const row = requireRowById(report, itemId, context);
  if (row.status !== expected) {
    fail(
      `${context}: expected the item to be reported ${expected}, got ` +
        `${row.status} (SPEC 10.4: a resolved item invalidates iff a ` +
        `recorded relevant hash changed, a recorded node's presence ` +
        `changed, or its generator-derived context set changed — and only ` +
        `then; reads apply this without persisting anything)`,
    );
  }
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
 * (SPEC 10.2/10.4: `current` holds the item's relevant hashes; the value is
 * the one `query node` reported at the recorded moment).
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
      `appears nowhere in ${JSON.stringify(recorded)}`,
  );
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

/** Sorted node-identity set of a payload node list. */
function identitySet(
  states: readonly { readonly node: string }[],
): readonly string[] {
  return states.map((state) => state.node).sort();
}

/** Sorted `kind scope` rendering of a session's items (staging sanity). */
function kindScopeSet(report: SessionStatusReport): readonly string[] {
  return report.items.map((row) => `${row.kind} ${row.scope}`).sort();
}

/** Assert `firstId` precedes `secondId` in a reported item sequence. */
function assertPrecedes(
  items: readonly { readonly id: string }[],
  firstId: string,
  secondId: string,
  context: string,
): void {
  const firstIndex = items.findIndex((item) => item.id === firstId);
  const secondIndex = items.findIndex((item) => item.id === secondId);
  if (firstIndex === -1 || secondIndex === -1) {
    fail(
      `${context}: both items must be present — ${firstId} at index ` +
        `${String(firstIndex)}, ${secondId} at index ${String(secondIndex)} ` +
        `among ${JSON.stringify(items.map((item) => item.id))}`,
    );
  }
  if (firstIndex >= secondIndex) {
    fail(
      `${context}: item ${firstId} (index ${String(firstIndex)}) must ` +
        `precede item ${secondId} (index ${String(secondIndex)}) — item ` +
        `order compares scope nodes under their current identities ` +
        `(SPEC 10.4, 10.5, 10.6)`,
    );
  }
}

// ---------------------------------------------------------------------------
// T10.4-1 — per-kind sensitivity machinery
// ---------------------------------------------------------------------------

/** One hash of one node, probed as a staging premise (SPEC 5.5). */
interface HashProbe {
  readonly node: string;
  readonly hash: keyof NodeHashes;
}

/** One sensitivity arm: a single staged edit and its expected effect. */
interface SensitivityArm {
  /** Which relevant hash (or control) the arm exercises. */
  readonly label: string;
  /** Stage the arm's edit (rewrites fixture files; `build` follows). */
  readonly apply: () => Promise<void>;
  /** Whether the edit must invalidate the resolved item (SPEC 10.4). */
  readonly invalidates: boolean;
  /** Hashes the edit must change (staging premise, SPEC 5.5). */
  readonly changed: readonly HashProbe[];
  /** Hashes the edit must leave unchanged (isolation premise, SPEC 5.5). */
  readonly unchanged: readonly HashProbe[];
  /**
   * Item ids to re-resolve (in order, `--status no-change`) after an
   * invalidating arm, ending with the item under test; defaults to the item
   * under test alone. Blockers invalidated by the same edit come first
   * (SPEC 10.3: an invalidated blocker re-blocks its dependents).
   */
  readonly reresolve?: readonly string[];
}

/** The four hashes of each probed node, captured via `query node`. */
async function captureHashes(
  product: ProductBinding,
  workspace: TestWorkspace,
  nodes: readonly string[],
  context: string,
): Promise<ReadonlyMap<string, NodeHashes>> {
  const captured = new Map<string, NodeHashes>();
  for (const node of nodes) {
    captured.set(
      node,
      (await queryNode(product, workspace, node, context)).hashes,
    );
  }
  return captured;
}

/**
 * Assert the hash premises bracketing a staged edit (SPEC 5.5): every
 * `changed` probe must differ between the two captures and every `unchanged`
 * probe must not, so no arm passes or fails for the wrong reason (H-8). A
 * probe whose node was not captured on both sides fails loudly as a harness
 * staging defect.
 */
function assertHashPremises(
  before: ReadonlyMap<string, NodeHashes>,
  after: ReadonlyMap<string, NodeHashes>,
  changed: readonly HashProbe[],
  unchanged: readonly HashProbe[],
  context: string,
): void {
  const probeValue = (
    captures: ReadonlyMap<string, NodeHashes>,
    probe: HashProbe,
    side: "pre-edit" | "post-edit",
  ): string => {
    const hashes = captures.get(probe.node);
    if (hashes === undefined) {
      fail(
        `${context}: harness staging defect — no ${side} \`query node\` ` +
          `capture exists for ${probe.node}, so its ${probe.hash} premise ` +
          `cannot be checked`,
      );
    }
    return hashes[probe.hash];
  };
  for (const probe of changed) {
    const beforeValue = probeValue(before, probe, "pre-edit");
    const afterValue = probeValue(after, probe, "post-edit");
    if (beforeValue === afterValue) {
      fail(
        `${context}: staging premise — the edit must change ${probe.node}'s ` +
          `${probe.hash} (SPEC 5.5) for this arm to exercise it; both ` +
          `captures report ${JSON.stringify(afterValue)}`,
      );
    }
  }
  for (const probe of unchanged) {
    const beforeValue = probeValue(before, probe, "pre-edit");
    const afterValue = probeValue(after, probe, "post-edit");
    if (beforeValue !== afterValue) {
      fail(
        `${context}: staging premise — the edit must leave ${probe.node}'s ` +
          `${probe.hash} unchanged (SPEC 5.5) so the arm isolates its ` +
          `intended sensitivity; got ${JSON.stringify(beforeValue)} -> ` +
          JSON.stringify(afterValue),
      );
    }
  }
}

/**
 * Run one kind's sensitivity arms against its resolved item: per arm, assert
 * the staged edit's hash premises (SPEC 5.5), then that the item is reported
 * `invalidated` exactly when the arm touches relevant state (SPEC 10.4), and
 * re-resolve so the next arm starts from a freshly recorded state.
 */
async function runSensitivityArms(
  product: ProductBinding,
  workspace: TestWorkspace,
  session: string,
  itemId: string,
  arms: readonly SensitivityArm[],
  contextPrefix: string,
): Promise<void> {
  for (const arm of arms) {
    const context = `${contextPrefix} — ${arm.label}`;
    const probedNodes = [
      ...new Set([...arm.changed, ...arm.unchanged].map((probe) => probe.node)),
    ];
    // The pre-edit capture equals the state the last resolve recorded: no
    // edit intervenes between a resolve and the next arm's `apply`.
    const before = await captureHashes(
      product,
      workspace,
      probedNodes,
      `${context}, pre-edit capture`,
    );
    await arm.apply();
    await buildOk(product, workspace, `${context} — \`build\` after the edit`);
    const after = await captureHashes(
      product,
      workspace,
      probedNodes,
      `${context}, post-edit capture`,
    );
    assertHashPremises(before, after, arm.changed, arm.unchanged, context);
    await expectItemStatus(
      product,
      workspace,
      session,
      itemId,
      arm.invalidates ? "invalidated" : "no-change",
      `${context} — read after the edit`,
    );
    if (arm.invalidates) {
      for (const id of arm.reresolve ?? [itemId]) {
        await resolveOk(
          product,
          workspace,
          session,
          id,
          "no-change",
          `${context} — re-resolve item ${id} --status no-change to ` +
            `re-record its current relevant state (SPEC 10.4, 10.7; ` +
            `no-change: no re-derivation, SPEC 10.5)`,
        );
      }
      await expectItemStatus(
        product,
        workspace,
        session,
        itemId,
        "no-change",
        `${context} — after the re-resolve (the freshly recorded state ` +
          `matches the graph again)`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// T10.4-1 — per-kind sensitivity fixtures
// ---------------------------------------------------------------------------

// subtree-coherence (--base session; SPEC 10.4: subtreeHash and metadataHash
// of each scope node). One top-level changed parent p with descendant p.c and
// an outside sibling o — the session holds exactly p's item (p has no
// non-root ancestor, so no parent-consistency items arise).
const SC_FILE = "specs/S.mdx";
const SC_P = "specs/S.mdx#p";
const SC_PC = "specs/S.mdx#p.c";
const SC_O = "specs/S.mdx#o";

function scSpec(
  pOwn: string,
  pAttrs: string,
  cText: string,
  cAttrs: string,
  oText: string,
): string {
  return [
    `<S id="p"${pAttrs}>`,
    pOwn,
    "",
    `<S id="p.c"${cAttrs}>`,
    cText,
    "</S>",
    "</S>",
    "",
    '<S id="o">',
    oText,
    "</S>",
    "",
  ].join("\n");
}

// The scenario's successive states of specs/S.mdx, in staging order — the
// former `write()` closure over mutable version variables enumerated, every
// state carrying the earlier edits forward. The pre-`create` edit (p's own
// text at v1, staged between `gitCommitAll` and the body's first `build`)
// precedes every product invocation and stays plain contents; the four arms'
// states follow it and are staged-source records (helpers/staged-mdx.ts,
// S-9: judged before any product exists), indexed by arm.
const T10_4_1_SC_PRE_CREATE = scSpec(
  "Parent own v1.",
  "",
  "Child text v0.",
  "",
  "Outside v0.",
);
const T10_4_1_SC_STATES = [
  stagedMdx(
    "T10.4-1 subtree-coherence specs/S.mdx after arm 1's edit: the child text at v1",
    scSpec("Parent own v1.", "", "Child text v1.", "", "Outside v0."),
  ),
  stagedMdx(
    "T10.4-1 subtree-coherence specs/S.mdx after arm 2's edit: p tagged pt",
    scSpec("Parent own v1.", ' tags="pt"', "Child text v1.", "", "Outside v0."),
  ),
  stagedMdx(
    "T10.4-1 subtree-coherence specs/S.mdx after arm 3's edit: p.c tagged ct",
    scSpec(
      "Parent own v1.",
      ' tags="pt"',
      "Child text v1.",
      ' tags="ct"',
      "Outside v0.",
    ),
  ),
  stagedMdx(
    "T10.4-1 subtree-coherence specs/S.mdx after arm 4's edit: the outside text at v1 (control)",
    scSpec(
      "Parent own v1.",
      ' tags="pt"',
      "Child text v1.",
      ' tags="ct"',
      "Outside v1.",
    ),
  ),
] as const;

// parent-consistency (--base; SPEC 10.4: ownHash and metadataHash of the
// scope node; subtreeHash of each context node). A deep leaf edit under
// a > a.k > a.k.d makes a's item's context node a.k, with the changed branch
// two levels down; o is the sibling-subtree control.
const PC_FILE = "specs/P.mdx";
const PC_A = "specs/P.mdx#a";
const PC_AK = "specs/P.mdx#a.k";
const PC_AKD = "specs/P.mdx#a.k.d";
const PC_O = "specs/P.mdx#o";

function pcSpec(
  aOwn: string,
  aAttrs: string,
  dText: string,
  oText: string,
): string {
  return [
    `<S id="a"${aAttrs}>`,
    aOwn,
    "",
    '<S id="a.k">',
    "Branch child own text.",
    "",
    '<S id="a.k.d">',
    dText,
    "</S>",
    "</S>",
    "</S>",
    "",
    '<S id="o">',
    oText,
    "</S>",
    "",
  ].join("\n");
}

// The scenario's initial specs/P.mdx: its workspace is created after the
// body's first `build` (the subtree-coherence scenario's), so the initial
// file is a staged-source record too (S-9's before-any-product clause), the
// same template call moved to module level.
const T10_4_1_PC_INITIAL = stagedMdx(
  "T10.4-1 parent-consistency specs/P.mdx at the baseline (the scenario's initial source)",
  pcSpec("Alpha own v0.", "", "Deep leaf v0.", "Other v0."),
);

// The scenario's successive states of specs/P.mdx, in staging order (the
// former `write()` closure enumerated, each state carrying the earlier edits
// forward) — every one, the pre-`create` edit included, follows the body's
// first `build` (the subtree-coherence scenario's), so all are records:
// index 0 the pre-`create` edit, then one per arm.
const T10_4_1_PC_STATES = [
  stagedMdx(
    "T10.4-1 parent-consistency specs/P.mdx after the pre-create edit: the deep leaf at v1",
    pcSpec("Alpha own v0.", "", "Deep leaf v1.", "Other v0."),
  ),
  stagedMdx(
    "T10.4-1 parent-consistency specs/P.mdx after arm 1's edit: the deep leaf at v2",
    pcSpec("Alpha own v0.", "", "Deep leaf v2.", "Other v0."),
  ),
  stagedMdx(
    "T10.4-1 parent-consistency specs/P.mdx after arm 2's edit: a tagged at",
    pcSpec("Alpha own v0.", ' tags="at"', "Deep leaf v2.", "Other v0."),
  ),
  stagedMdx(
    "T10.4-1 parent-consistency specs/P.mdx after arm 3's edit: a's own text at v1",
    pcSpec("Alpha own v1.", ' tags="at"', "Deep leaf v2.", "Other v0."),
  ),
  stagedMdx(
    "T10.4-1 parent-consistency specs/P.mdx after arm 4's edit: the sibling text at v1 (control)",
    pcSpec("Alpha own v1.", ' tags="at"', "Deep leaf v2.", "Other v1."),
  ),
] as const;

// dependency-consistency (--base; SPEC 10.4: ownHash and metadataHash of the
// scope node; subtreeHash of each upstream target in context). dep depends on
// t (whose staged own-text edit generates the item); t.c is the deep-edit
// handle under the target; u is the unrelated-node control.
const DC_FILE = "specs/D.mdx";
const DC_DEP = "specs/D.mdx#dep";
const DC_T = "specs/D.mdx#t";
const DC_U = "specs/D.mdx#u";

function dcSpec(
  depOwn: string,
  depAttrs: string,
  tOwn: string,
  tcText: string,
  uText: string,
): string {
  return [
    `<S id="dep" d={"t"}${depAttrs}>`,
    depOwn,
    "</S>",
    "",
    '<S id="t">',
    tOwn,
    "",
    '<S id="t.c">',
    tcText,
    "</S>",
    "</S>",
    "",
    '<S id="u">',
    uText,
    "</S>",
    "",
  ].join("\n");
}

// The scenario's initial specs/D.mdx — a workspace created after the body's
// first `build`, so a record too (the same template call moved here).
const T10_4_1_DC_INITIAL = stagedMdx(
  "T10.4-1 dependency-consistency specs/D.mdx at the baseline (the scenario's initial source)",
  dcSpec(
    "Dep own v0.",
    "",
    "Target own v0.",
    "Target child v0.",
    "Unrelated v0.",
  ),
);

// The scenario's successive states of specs/D.mdx, in staging order (the
// former `write()` closure enumerated, each state carrying the earlier edits
// forward), all after the body's first `build`: index 0 the pre-`create`
// edit, then one per arm.
const T10_4_1_DC_STATES = [
  stagedMdx(
    "T10.4-1 dependency-consistency specs/D.mdx after the pre-create edit: the target's own text at v1",
    dcSpec(
      "Dep own v0.",
      "",
      "Target own v1.",
      "Target child v0.",
      "Unrelated v0.",
    ),
  ),
  stagedMdx(
    "T10.4-1 dependency-consistency specs/D.mdx after arm 1's edit: dep's own text at v1",
    dcSpec(
      "Dep own v1.",
      "",
      "Target own v1.",
      "Target child v0.",
      "Unrelated v0.",
    ),
  ),
  stagedMdx(
    "T10.4-1 dependency-consistency specs/D.mdx after arm 2's edit: dep tagged dt",
    dcSpec(
      "Dep own v1.",
      ' tags="dt"',
      "Target own v1.",
      "Target child v0.",
      "Unrelated v0.",
    ),
  ),
  stagedMdx(
    "T10.4-1 dependency-consistency specs/D.mdx after arm 3's edit: the target's child text at v1",
    dcSpec(
      "Dep own v1.",
      ' tags="dt"',
      "Target own v1.",
      "Target child v1.",
      "Unrelated v0.",
    ),
  ),
  stagedMdx(
    "T10.4-1 dependency-consistency specs/D.mdx after arm 4's edit: the unrelated text at v1 (control)",
    dcSpec(
      "Dep own v1.",
      ' tags="dt"',
      "Target own v1.",
      "Target child v1.",
      "Unrelated v1.",
    ),
  ),
] as const;

// metadata-consistency (--base; SPEC 10.4: metadataHash of the scope node
// only). m's staged tag change generates the item; the control is a text
// edit of m itself — subtreeHash moves, metadataHash does not.
const MC_FILE = "specs/M.mdx";
const MC_M = "specs/M.mdx#m";

function mcSpec(mTags: string, mText: string): string {
  return [`<S id="m" tags="${mTags}">`, mText, "</S>", ""].join("\n");
}

// The scenario's initial specs/M.mdx — a workspace created after the body's
// first `build`, so a record too (the same template call moved here).
const T10_4_1_MC_INITIAL = stagedMdx(
  "T10.4-1 metadata-consistency specs/M.mdx at the baseline (the scenario's initial source)",
  mcSpec("m0", "Em text v0."),
);

// The scenario's successive states of specs/M.mdx, in staging order (the
// former `write()` closure enumerated), all after the body's first `build`:
// index 0 the pre-`create` edit, then one per arm.
const T10_4_1_MC_STATES = [
  stagedMdx(
    "T10.4-1 metadata-consistency specs/M.mdx after the pre-create edit: m tagged m1",
    mcSpec("m1", "Em text v0."),
  ),
  stagedMdx(
    "T10.4-1 metadata-consistency specs/M.mdx after arm 1's edit: m tagged m2",
    mcSpec("m2", "Em text v0."),
  ),
  stagedMdx(
    "T10.4-1 metadata-consistency specs/M.mdx after arm 2's edit: m's text at v1 (control)",
    mcSpec("m2", "Em text v1."),
  ),
] as const;

// code-impact (--base; SPEC 10.4: subtreeHash and effectiveHash of each node
// targeted by the scoped location's impact edges). src/ref.ts references t;
// t depends on up (the effectiveHash-only upstream handle); w is the control
// node — no impact-edge target, upstream of nothing.
const CI_FILE = "specs/C.mdx";
const CI_T = "specs/C.mdx#t";
const CI_UP = "specs/C.mdx#up";
const CI_W = "specs/C.mdx#w";
const CI_CODE = "src/ref.ts";

function ciSpec(tText: string, upText: string, wText: string): string {
  return [
    '<S id="t" d={"up"}>',
    tText,
    "</S>",
    "",
    '<S id="up">',
    upText,
    "</S>",
    "",
    '<S id="w">',
    wText,
    "</S>",
    "",
  ].join("\n");
}

// A whole-file code location (SPEC 4.6): the bare-reference marker sits at
// the top level, so the `references` edge runs from `src/ref.ts` itself. The
// scenario's workspace follows the body's first `build`, so the code source
// is a TypeScript staged-source record (module header), well-formed.
const CI_CODE_SOURCE = stagedTs(
  "T10.4-1 code-impact src/ref.ts (a whole-file code location referencing t)",
  ['import C from "../specs/C.xspec";', "", "C.t;", ""].join("\n"),
);

// The scenario's initial specs/C.mdx — a workspace created after the body's
// first `build`, so a record too (the same template call moved here); the
// code source beside it is a TypeScript record (`CI_CODE_SOURCE`).
const T10_4_1_CI_INITIAL = stagedMdx(
  "T10.4-1 code-impact specs/C.mdx at the baseline (the scenario's initial source)",
  ciSpec("Target v0.", "Upstream v0.", "Watcher v0."),
);

// The scenario's successive states of specs/C.mdx, in staging order (the
// former `write()` closure enumerated, each state carrying the earlier edits
// forward), all after the body's first `build`: index 0 the pre-`create`
// edit, then one per arm.
const T10_4_1_CI_STATES = [
  stagedMdx(
    "T10.4-1 code-impact specs/C.mdx after the pre-create edit: the target text at v1",
    ciSpec("Target v1.", "Upstream v0.", "Watcher v0."),
  ),
  stagedMdx(
    "T10.4-1 code-impact specs/C.mdx after arm 1's edit: the target text at v2",
    ciSpec("Target v2.", "Upstream v0.", "Watcher v0."),
  ),
  stagedMdx(
    "T10.4-1 code-impact specs/C.mdx after arm 2's edit: the upstream text at v1",
    ciSpec("Target v2.", "Upstream v1.", "Watcher v0."),
  ),
  stagedMdx(
    "T10.4-1 code-impact specs/C.mdx after arm 3's edit: the watcher text at v1 (control)",
    ciSpec("Target v2.", "Upstream v1.", "Watcher v1."),
  ),
] as const;

// uncovered-requirement (coverage session; SPEC 10.4: subtreeHash and
// metadataHash of the scope node). Uncovered leaves u (under test) and e
// (the elsewhere-edit control), both required by the direct profile.
const UR_FILE = "specs/U.mdx";
const UR_U = "specs/U.mdx#u";
const UR_E = "specs/U.mdx#e";

function urSpec(uAttrs: string, uText: string, eText: string): string {
  return [
    `<S id="u"${uAttrs}>`,
    uText,
    "</S>",
    "",
    '<S id="e">',
    eText,
    "</S>",
    "",
  ].join("\n");
}

// The scenario's initial specs/U.mdx — a workspace created after the body's
// first `build`, so a record too (the same template call moved here).
const T10_4_1_UR_INITIAL = stagedMdx(
  "T10.4-1 uncovered-requirement specs/U.mdx at the baseline (the scenario's initial source)",
  urSpec("", "You leaf v0.", "Elsewhere v0."),
);

// The scenario's successive states of specs/U.mdx, in staging order (the
// former `write()` closure enumerated, each state carrying the earlier edits
// forward), all after the body's first `build` — one per arm (a coverage
// session stages no pre-`create` edit).
const T10_4_1_UR_STATES = [
  stagedMdx(
    "T10.4-1 uncovered-requirement specs/U.mdx after arm 1's edit: u's text at v1",
    urSpec("", "You leaf v1.", "Elsewhere v0."),
  ),
  stagedMdx(
    "T10.4-1 uncovered-requirement specs/U.mdx after arm 2's edit: u tagged ut",
    urSpec(' tags="ut"', "You leaf v1.", "Elsewhere v0."),
  ),
  stagedMdx(
    "T10.4-1 uncovered-requirement specs/U.mdx after arm 3's edit: the elsewhere text at v1 (control)",
    urSpec(' tags="ut"', "You leaf v1.", "Elsewhere v1."),
  ),
] as const;

const T10_4_1 = defineProductTest({
  id: "T10.4-1",
  title:
    "per-kind relevant-hash sensitivity: for each built-in kind every relevant hash of SPEC 10.4 is exercised as an invalidating case with query-node hash premises bracketing the edit, plus a non-invalidating control touching none of the item's relevant state — subtree-coherence (subtree text edit; metadata-only edit on the scope root and, separately, on a descendant, which changes no subtreeHash and MUST still invalidate; control outside the subtree), parent-consistency (own-text and metadata edits of the scope node; deep text edit under a context child; sibling-subtree control), dependency-consistency (own-text and metadata edits of the scope node; text edit under the upstream target in context; unrelated-node control), metadata-consistency (metadata edit invalidates; a text edit of the scope node does not), code-impact (target text edit; upstream edit changing only the target's effectiveHash; control on a node that is no impact-edge target and upstream of none), uncovered-requirement (scope-subtree text edit; scope metadata edit; control elsewhere) (SPEC 5.5, 10.4, 10.5, 10.7)",
  run: async (product) => {
    // --- subtree-coherence -------------------------------------------------
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      {
        [SC_FILE]: scSpec(
          "Parent own v0.",
          "",
          "Child text v0.",
          "",
          "Outside v0.",
        ),
      },
      async (workspace) => {
        const prefix = "T10.4-1 subtree-coherence";

        await workspace.gitInit();
        const base = await workspace.gitCommitAll("baseline");
        // p `changed` relative to the baseline — staged before the body's
        // first product invocation, so plain contents (S-7 reaches it).
        await workspace.file(SC_FILE, T10_4_1_SC_PRE_CREATE);
        await buildOk(product, workspace, `${prefix} \`build\` after the edit`);
        await expectExit(
          product,
          workspace,
          ["review", "create", "--base", base, "--name", "s"],
          0,
          `${prefix} \`review create --base <baseline> --name s\``,
        );
        const status = await sessionStatus(product, workspace, "s", prefix);
        assertSameJson(
          kindScopeSet(status),
          [`subtree-coherence ${SC_P}`],
          `${prefix}: the top-level changed parent yields exactly its ` +
            `subtree-coherence item — no non-root ancestor exists for ` +
            `parent-consistency items (SPEC 10.5)`,
        );
        const itemId = requireRow(status, "subtree-coherence", SC_P, prefix).id;
        await resolveOk(
          product,
          workspace,
          "s",
          itemId,
          "no-change",
          `${prefix} initial \`review resolve s <item> --status no-change\``,
        );

        await runSensitivityArms(
          product,
          workspace,
          "s",
          itemId,
          [
            {
              label:
                "text edit inside the scope subtree (a scope node's subtreeHash)",
              apply: async () => {
                await workspace.file(SC_FILE, T10_4_1_SC_STATES[0]);
              },
              invalidates: true,
              changed: [
                { node: SC_PC, hash: "subtreeHash" },
                { node: SC_P, hash: "subtreeHash" },
              ],
              unchanged: [
                { node: SC_P, hash: "metadataHash" },
                { node: SC_PC, hash: "metadataHash" },
              ],
            },
            {
              label: "metadata-only edit on the scope root (its metadataHash)",
              apply: async () => {
                await workspace.file(SC_FILE, T10_4_1_SC_STATES[1]);
              },
              invalidates: true,
              changed: [{ node: SC_P, hash: "metadataHash" }],
              unchanged: [
                { node: SC_P, hash: "subtreeHash" },
                { node: SC_PC, hash: "subtreeHash" },
                { node: SC_PC, hash: "metadataHash" },
              ],
            },
            {
              label:
                "metadata-only edit on a descendant scope node — it changes " +
                "no subtreeHash and MUST still invalidate (the relevant " +
                "metadataHash is each scope node's)",
              apply: async () => {
                await workspace.file(SC_FILE, T10_4_1_SC_STATES[2]);
              },
              invalidates: true,
              changed: [{ node: SC_PC, hash: "metadataHash" }],
              unchanged: [
                { node: SC_P, hash: "subtreeHash" },
                { node: SC_PC, hash: "subtreeHash" },
                { node: SC_P, hash: "metadataHash" },
              ],
            },
            {
              label: "control: an edit outside the scope subtree",
              apply: async () => {
                await workspace.file(SC_FILE, T10_4_1_SC_STATES[3]);
              },
              invalidates: false,
              changed: [{ node: SC_O, hash: "subtreeHash" }],
              unchanged: [
                { node: SC_P, hash: "subtreeHash" },
                { node: SC_P, hash: "metadataHash" },
                { node: SC_PC, hash: "subtreeHash" },
                { node: SC_PC, hash: "metadataHash" },
              ],
            },
          ],
          prefix,
        );
      },
    );

    // --- parent-consistency ------------------------------------------------
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      {
        [PC_FILE]: T10_4_1_PC_INITIAL,
      },
      async (workspace) => {
        const prefix = "T10.4-1 parent-consistency";

        await workspace.gitInit();
        const base = await workspace.gitCommitAll("baseline");
        // a.k.d `changed`
        await workspace.file(PC_FILE, T10_4_1_PC_STATES[0]);
        await buildOk(product, workspace, `${prefix} \`build\` after the edit`);
        await expectExit(
          product,
          workspace,
          ["review", "create", "--base", base, "--name", "s"],
          0,
          `${prefix} \`review create --base <baseline> --name s\``,
        );
        const status = await sessionStatus(product, workspace, "s", prefix);
        assertSameJson(
          kindScopeSet(status),
          [
            `parent-consistency ${PC_A}`,
            `parent-consistency ${PC_AK}`,
            `subtree-coherence ${PC_AKD}`,
          ].sort(),
          `${prefix}: the deep leaf edit yields its subtree-coherence item ` +
            `plus one parent-consistency item per non-root ancestor ` +
            `(SPEC 10.5)`,
        );
        const dId = requireRow(status, "subtree-coherence", PC_AKD, prefix).id;
        const kId = requireRow(status, "parent-consistency", PC_AK, prefix).id;
        const aId = requireRow(status, "parent-consistency", PC_A, prefix).id;
        // Bottom-up resolves: each parent-consistency item is blocked by the
        // item of its child on the changed branch (SPEC 10.5).
        for (const [id, label] of [
          [dId, "a.k.d subtree-coherence"],
          [kId, "a.k parent-consistency"],
          [aId, "a parent-consistency"],
        ] as const) {
          await resolveOk(
            product,
            workspace,
            "s",
            id,
            "no-change",
            `${prefix} initial resolve of the ${label} item (bottom-up, SPEC 10.5)`,
          );
        }

        await runSensitivityArms(
          product,
          workspace,
          "s",
          aId,
          [
            {
              label:
                "deep text edit under the context child (a context node's subtreeHash)",
              apply: async () => {
                await workspace.file(PC_FILE, T10_4_1_PC_STATES[1]);
              },
              invalidates: true,
              changed: [{ node: PC_AK, hash: "subtreeHash" }],
              unchanged: [
                { node: PC_A, hash: "ownHash" },
                { node: PC_A, hash: "metadataHash" },
              ],
              // The same edit invalidates the chain below a; an invalidated
              // blocker re-blocks its dependents (SPEC 10.3), so re-resolve
              // bottom-up.
              reresolve: [dId, kId, aId],
            },
            {
              label: "metadata edit of the scope node (its metadataHash)",
              apply: async () => {
                await workspace.file(PC_FILE, T10_4_1_PC_STATES[2]);
              },
              invalidates: true,
              changed: [{ node: PC_A, hash: "metadataHash" }],
              unchanged: [
                { node: PC_A, hash: "ownHash" },
                { node: PC_AK, hash: "subtreeHash" },
              ],
            },
            {
              label: "own-text edit of the scope node (its ownHash)",
              apply: async () => {
                await workspace.file(PC_FILE, T10_4_1_PC_STATES[3]);
              },
              invalidates: true,
              changed: [{ node: PC_A, hash: "ownHash" }],
              unchanged: [
                { node: PC_A, hash: "metadataHash" },
                { node: PC_AK, hash: "subtreeHash" },
              ],
            },
            {
              label: "control: an edit in a sibling subtree of the scope node",
              apply: async () => {
                await workspace.file(PC_FILE, T10_4_1_PC_STATES[4]);
              },
              invalidates: false,
              changed: [{ node: PC_O, hash: "subtreeHash" }],
              unchanged: [
                { node: PC_A, hash: "ownHash" },
                { node: PC_A, hash: "metadataHash" },
                { node: PC_AK, hash: "subtreeHash" },
              ],
            },
          ],
          prefix,
        );
      },
    );

    // --- dependency-consistency --------------------------------------------
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      {
        [DC_FILE]: T10_4_1_DC_INITIAL,
      },
      async (workspace) => {
        const prefix = "T10.4-1 dependency-consistency";

        await workspace.gitInit();
        const base = await workspace.gitCommitAll("baseline");
        // t `changed`: dep's target effectiveHash moves
        await workspace.file(DC_FILE, T10_4_1_DC_STATES[0]);
        await buildOk(product, workspace, `${prefix} \`build\` after the edit`);
        await expectExit(
          product,
          workspace,
          ["review", "create", "--base", base, "--name", "s"],
          0,
          `${prefix} \`review create --base <baseline> --name s\``,
        );
        const status = await sessionStatus(product, workspace, "s", prefix);
        assertSameJson(
          kindScopeSet(status),
          [
            `dependency-consistency ${DC_DEP}`,
            `subtree-coherence ${DC_T}`,
          ].sort(),
          `${prefix}: the target's own-text edit yields its ` +
            `subtree-coherence item and the depender's ` +
            `dependency-consistency item (SPEC 10.5)`,
        );
        const itemId = requireRow(
          status,
          "dependency-consistency",
          DC_DEP,
          prefix,
        ).id;
        await resolveOk(
          product,
          workspace,
          "s",
          itemId,
          "no-change",
          `${prefix} initial \`review resolve s <item> --status no-change\` ` +
            `(dependency-consistency items have empty blockedBy, SPEC 10.5)`,
        );

        await runSensitivityArms(
          product,
          workspace,
          "s",
          itemId,
          [
            {
              label: "own-text edit of the scope node (its ownHash)",
              apply: async () => {
                await workspace.file(DC_FILE, T10_4_1_DC_STATES[1]);
              },
              invalidates: true,
              changed: [{ node: DC_DEP, hash: "ownHash" }],
              unchanged: [
                { node: DC_DEP, hash: "metadataHash" },
                { node: DC_T, hash: "subtreeHash" },
              ],
            },
            {
              label: "metadata edit of the scope node (its metadataHash)",
              apply: async () => {
                await workspace.file(DC_FILE, T10_4_1_DC_STATES[2]);
              },
              invalidates: true,
              changed: [{ node: DC_DEP, hash: "metadataHash" }],
              unchanged: [
                { node: DC_DEP, hash: "ownHash" },
                { node: DC_T, hash: "subtreeHash" },
              ],
            },
            {
              label:
                "text edit under the upstream target in context (target subtreeHash)",
              apply: async () => {
                await workspace.file(DC_FILE, T10_4_1_DC_STATES[3]);
              },
              invalidates: true,
              changed: [{ node: DC_T, hash: "subtreeHash" }],
              unchanged: [
                { node: DC_DEP, hash: "ownHash" },
                { node: DC_DEP, hash: "metadataHash" },
              ],
            },
            {
              label: "control: an edit to an unrelated node",
              apply: async () => {
                await workspace.file(DC_FILE, T10_4_1_DC_STATES[4]);
              },
              invalidates: false,
              changed: [{ node: DC_U, hash: "subtreeHash" }],
              unchanged: [
                { node: DC_DEP, hash: "ownHash" },
                { node: DC_DEP, hash: "metadataHash" },
                { node: DC_T, hash: "subtreeHash" },
              ],
            },
          ],
          prefix,
        );
      },
    );

    // --- metadata-consistency ----------------------------------------------
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [MC_FILE]: T10_4_1_MC_INITIAL },
      async (workspace) => {
        const prefix = "T10.4-1 metadata-consistency";

        await workspace.gitInit();
        const base = await workspace.gitCommitAll("baseline");
        // m `metadata-changed`
        await workspace.file(MC_FILE, T10_4_1_MC_STATES[0]);
        await buildOk(
          product,
          workspace,
          `${prefix} \`build\` after the tag edit`,
        );
        await expectExit(
          product,
          workspace,
          ["review", "create", "--base", base, "--name", "s"],
          0,
          `${prefix} \`review create --base <baseline> --name s\``,
        );
        const status = await sessionStatus(product, workspace, "s", prefix);
        assertSameJson(
          kindScopeSet(status),
          [`metadata-consistency ${MC_M}`],
          `${prefix}: a tags-only change yields exactly the ` +
            `metadata-consistency item — no node is changed (SPEC 5.6, 10.5)`,
        );
        const itemId = requireRow(
          status,
          "metadata-consistency",
          MC_M,
          prefix,
        ).id;
        await resolveOk(
          product,
          workspace,
          "s",
          itemId,
          "no-change",
          `${prefix} initial \`review resolve s <item> --status no-change\``,
        );

        await runSensitivityArms(
          product,
          workspace,
          "s",
          itemId,
          [
            {
              label: "metadata edit of the scope node (metadataHash only)",
              apply: async () => {
                await workspace.file(MC_FILE, T10_4_1_MC_STATES[1]);
              },
              invalidates: true,
              changed: [{ node: MC_M, hash: "metadataHash" }],
              unchanged: [{ node: MC_M, hash: "subtreeHash" }],
            },
            {
              label:
                "control: a text edit of the scope node does not invalidate " +
                "(only the metadataHash is relevant to this kind)",
              apply: async () => {
                await workspace.file(MC_FILE, T10_4_1_MC_STATES[2]);
              },
              invalidates: false,
              changed: [{ node: MC_M, hash: "subtreeHash" }],
              unchanged: [{ node: MC_M, hash: "metadataHash" }],
            },
          ],
          prefix,
        );
      },
    );

    // --- code-impact --------------------------------------------------------
    await withWorkspace(
      SPECS_CODE_CONFIG,
      {
        [CI_FILE]: T10_4_1_CI_INITIAL,
        [CI_CODE]: CI_CODE_SOURCE,
      },
      async (workspace) => {
        const prefix = "T10.4-1 code-impact";

        await workspace.gitInit();
        const base = await workspace.gitCommitAll("baseline");
        // t `changed`: src/ref.ts directly impacted
        await workspace.file(CI_FILE, T10_4_1_CI_STATES[0]);
        await buildOk(product, workspace, `${prefix} \`build\` after the edit`);
        await expectExit(
          product,
          workspace,
          ["review", "create", "--base", base, "--name", "s"],
          0,
          `${prefix} \`review create --base <baseline> --name s\``,
        );
        const status = await sessionStatus(product, workspace, "s", prefix);
        assertSameJson(
          kindScopeSet(status),
          [`code-impact ${CI_CODE}`, `subtree-coherence ${CI_T}`].sort(),
          `${prefix}: the target's edit yields its subtree-coherence item ` +
            `and one code-impact item for the impacted location (SPEC 9.2, 10.5)`,
        );
        const itemId = requireRow(status, "code-impact", CI_CODE, prefix).id;
        await resolveOk(
          product,
          workspace,
          "s",
          itemId,
          "no-change",
          `${prefix} initial \`review resolve s <item> --status no-change\` ` +
            `(code-impact items have empty blockedBy, SPEC 10.5)`,
        );

        await runSensitivityArms(
          product,
          workspace,
          "s",
          itemId,
          [
            {
              label: "text edit of an impact-edge target (target subtreeHash)",
              apply: async () => {
                await workspace.file(CI_FILE, T10_4_1_CI_STATES[1]);
              },
              invalidates: true,
              changed: [{ node: CI_T, hash: "subtreeHash" }],
              unchanged: [{ node: CI_T, hash: "metadataHash" }],
            },
            {
              label:
                "upstream edit changing only the target's effectiveHash " +
                "(its subtreeHash stays put)",
              apply: async () => {
                await workspace.file(CI_FILE, T10_4_1_CI_STATES[2]);
              },
              invalidates: true,
              changed: [{ node: CI_T, hash: "effectiveHash" }],
              unchanged: [{ node: CI_T, hash: "subtreeHash" }],
            },
            {
              label:
                "control: an edit to a node that is no impact-edge target " +
                "and upstream of none",
              apply: async () => {
                await workspace.file(CI_FILE, T10_4_1_CI_STATES[3]);
              },
              invalidates: false,
              changed: [{ node: CI_W, hash: "subtreeHash" }],
              unchanged: [
                { node: CI_T, hash: "subtreeHash" },
                { node: CI_T, hash: "effectiveHash" },
              ],
            },
          ],
          prefix,
        );
      },
    );

    // --- uncovered-requirement ----------------------------------------------
    await withWorkspace(
      COVERAGE_CONFIG,
      { [UR_FILE]: T10_4_1_UR_INITIAL },
      async (workspace) => {
        const prefix = "T10.4-1 uncovered-requirement";

        await buildOk(product, workspace, `${prefix} \`build\``);
        await expectExit(
          product,
          workspace,
          ["review", "create", "--coverage", "p", "--name", "s"],
          0,
          `${prefix} \`review create --coverage p --name s\``,
        );
        const status = await sessionStatus(product, workspace, "s", prefix);
        assertSameJson(
          kindScopeSet(status),
          [
            `uncovered-requirement ${UR_E}`,
            `uncovered-requirement ${UR_U}`,
          ].sort(),
          `${prefix}: both uncovered required leaves get an ` +
            `uncovered-requirement item (SPEC 8.1, 10.7)`,
        );
        const itemId = requireRow(
          status,
          "uncovered-requirement",
          UR_U,
          prefix,
        ).id;
        await resolveOk(
          product,
          workspace,
          "s",
          itemId,
          "no-change",
          `${prefix} initial \`review resolve s <item> --status no-change\` ` +
            `(uncovered-requirement items have empty blockedBy, SPEC 10.7)`,
        );

        await runSensitivityArms(
          product,
          workspace,
          "s",
          itemId,
          [
            {
              label: "text edit in the scope node's subtree (its subtreeHash)",
              apply: async () => {
                await workspace.file(UR_FILE, T10_4_1_UR_STATES[0]);
              },
              invalidates: true,
              changed: [{ node: UR_U, hash: "subtreeHash" }],
              unchanged: [{ node: UR_U, hash: "metadataHash" }],
            },
            {
              label: "metadata edit of the scope node (its metadataHash)",
              apply: async () => {
                await workspace.file(UR_FILE, T10_4_1_UR_STATES[1]);
              },
              invalidates: true,
              changed: [{ node: UR_U, hash: "metadataHash" }],
              unchanged: [{ node: UR_U, hash: "subtreeHash" }],
            },
            {
              label: "control: an edit elsewhere",
              apply: async () => {
                await workspace.file(UR_FILE, T10_4_1_UR_STATES[2]);
              },
              invalidates: false,
              changed: [{ node: UR_E, hash: "subtreeHash" }],
              unchanged: [
                { node: UR_U, hash: "subtreeHash" },
                { node: UR_U, hash: "metadataHash" },
              ],
            },
          ],
          prefix,
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T10.4-2 — presence changes
// ---------------------------------------------------------------------------

const T2_FILE = "specs/X.mdx";
const T2_X = "specs/X.mdx#x";
const T2_Y = "specs/X.mdx#y";
const T2_ROOT = "specs/X.mdx";

function t2Spec(withX: boolean, yText: string): string {
  const lines = withX ? ['<S id="x">', "Ex text.", "</S>", ""] : [];
  return [...lines, '<S id="y">', yText, "</S>", ""].join("\n");
}

// Non-scope presence recordings (SPEC 10.4: presence is recorded for every
// scope, context, and origin node). Each arm is pure — no recorded relevant
// hash of the item changes (query-node brackets assert it) and the generated
// context set stays put — so only the named node's presence divergence can
// invalidate, and a product recording presence for scope nodes alone reports
// the item still resolved.

// Context arm (`metadata-consistency`): baseline D bears a `d` reference to
// sibling T; one edit removes the reference and deletes T's section, so
// `review create --base` derives D's item with the removed target T as its
// one context node (SPEC 10.5), currently absent.
const T2C_FILE = "specs/C.mdx";
const T2C_ROOT = "specs/C.mdx";
const T2C_D = "specs/C.mdx#dd";
const T2C_T = "specs/C.mdx#tt";

function t2cSpec(dAttrs: string, withT: boolean): string {
  const t = withT ? ["", '<S id="tt">', "Tee text.", "</S>"] : [];
  return [`<S id="dd"${dAttrs}>`, "Dee own text.", "</S>", ...t, ""].join("\n");
}

// Origin arm (`dependency-consistency`): X depends on T, T depends on D — a
// section in its own file, beside sibling `e`, the target D's staged d-list
// edit gains. That edit leaves D `metadata-changed` and nothing `changed`
// (SPEC 5.6), so X's item derives as scope X, context {T} (the
// dependency-edge target whose effectiveHash changed), origin {D} (the
// originating node of T's change) (SPEC 10.5).
const T2O_X_FILE = "specs/X.mdx";
const T2O_T_FILE = "specs/T.mdx";
const T2O_D_FILE = "specs/O.mdx";
const T2O_X = "specs/X.mdx#x";
const T2O_T = "specs/T.mdx#t";
const T2O_D = "specs/O.mdx#d";

// The origin arm's initial X: a workspace created after the body's first
// `build`, so a record too, wrapped in place.
const T2O_X_SOURCE = stagedMdx(
  "T10.4-2 specs/X.mdx with x depending on T.t (the origin arm's initial source)",
  [
    'import T from "./T.xspec"',
    "",
    '<S id="x" d={T.t}>',
    "Ex own text.",
    "</S>",
    "",
  ].join("\n"),
);

// The import stays when the `d` reference goes: an import whose binding is
// never used is valid and records no edges (SPEC 2.1), so the reference
// removal is a pure d-prop edit.
function t2oTSpec(withD: boolean): string {
  return [
    'import O from "./O.xspec"',
    "",
    withD ? '<S id="t" d={O.d}>' : '<S id="t">',
    "Tee own text.",
    "</S>",
    "",
  ].join("\n");
}

// `dAttrs === null` deletes D's section; sibling `e` remains, so the file
// keeps its root and the deletion touches no other source.
function t2oDSpec(dAttrs: string | null): string {
  const d =
    dAttrs === null ? [] : [`<S id="d"${dAttrs}>`, "Dee own text.", "</S>", ""];
  return [...d, '<S id="e">', "Ee text.", "</S>", ""].join("\n");
}

// Journal arm (SPEC 10.4: a node is also absent when its identity ceases to
// resolve through the journal): an audit session over top-level leaves `a`
// and `s`. `rename` a→b journals the mapping (6.1, 6.4), and a's item —
// presented under b thereafter (10.4) — is resolved `no-change`, recording
// its scope node as the canonical identity (a, the journal's start) (5.4).
// Deleting `.xspec/journal` by hand then leaves a valid workspace with an
// empty journal (6.1), under which b's canonical identity is (b, the
// journal's start) and the recorded one resolves to no node: reads present
// the item `invalidated`, its scope node absent under `a` — the recorded
// identity mapped forward through the now-empty journal (10.4) — and the
// `updated` resolve of s's item re-derives the session (10.5, 10.6), adding
// a distinct item scoped at b beside the original, which keeps its id and
// its stored `no-change` (`list` counts stored statuses, 10.7). A product
// recording the node by its spelled identity at the resolve (b) reads the
// item still resolved and adds no item for b. The deletion is a fixture
// edit like the others, an explicit `build` following it.
const T2J_FILE = "specs/J.mdx";
const T2J_ROOT = "specs/J.mdx";
const T2J_A = "specs/J.mdx#a";
const T2J_B = "specs/J.mdx#b";
const T2J_S = "specs/J.mdx#s";
const T2J_JOURNAL = ".xspec/journal";

// T10.4-2's presence flips — every one staged after the body's first
// `build` — are staged-source records (helpers/staged-mdx.ts, S-9: judged
// before any product exists), the same template calls moved to module level;
// the context, origin, and journal arms' initial files (below) are records
// too, the first arm's X — the body's first workspace — a plain `files`
// entry.
const T10_4_2_X_DELETED = stagedMdx(
  "T10.4-2 specs/X.mdx with the scope node x deleted (y at v0)",
  t2Spec(false, "Wye text v0."),
);
const T10_4_2_X_ABSENT_Y_EDITED = stagedMdx(
  "T10.4-2 specs/X.mdx with x still absent across the unrelated y edit (y at v1)",
  t2Spec(false, "Wye text v1."),
);
const T10_4_2_X_RESTORED = stagedMdx(
  "T10.4-2 specs/X.mdx with x restored (y at v1)",
  t2Spec(true, "Wye text v1."),
);
const T10_4_2_C_REFERENCE_REMOVED = stagedMdx(
  "T10.4-2 specs/C.mdx with dd's d reference removed and tt deleted (context arm)",
  t2cSpec("", false),
);
const T10_4_2_C_T_REAUTHORED = stagedMdx(
  "T10.4-2 specs/C.mdx with tt re-authored, dd still bearing no d reference (context arm)",
  t2cSpec("", true),
);
const T10_4_2_O_D_LIST_EDITED = stagedMdx(
  "T10.4-2 specs/O.mdx with the d-list edit on d (origin arm)",
  t2oDSpec(' d={"e"}'),
);
const T10_4_2_T_REFERENCE_REMOVED = stagedMdx(
  "T10.4-2 specs/T.mdx with t's reference to D removed (origin arm)",
  t2oTSpec(false),
);
const T10_4_2_O_D_DELETED = stagedMdx(
  "T10.4-2 specs/O.mdx with d's section deleted (origin arm)",
  t2oDSpec(null),
);
const T10_4_2_C_INITIAL = stagedMdx(
  "T10.4-2 specs/C.mdx with dd referencing tt (the context arm's initial source)",
  t2cSpec(' d={"tt"}', true),
);
const T10_4_2_T_INITIAL = stagedMdx(
  "T10.4-2 specs/T.mdx with t referencing O.d (the origin arm's initial source)",
  t2oTSpec(true),
);
const T10_4_2_O_INITIAL = stagedMdx(
  "T10.4-2 specs/O.mdx with d beside e (the origin arm's initial source)",
  t2oDSpec(""),
);
const T10_4_2_J_INITIAL = stagedMdx(
  "T10.4-2 specs/J.mdx with top-level leaves a and s (the journal arm's initial source)",
  [
    '<S id="a">',
    "Aye text.",
    "</S>",
    "",
    '<S id="s">',
    "Ess text.",
    "</S>",
    "",
  ].join("\n"),
);

/** Assert an item's context is exactly one node with the given presence. */
function assertSoleContext(
  item: ReviewItem,
  node: string,
  present: boolean,
  context: string,
): void {
  const summary = item.context.map((state) => ({
    node: state.node,
    present: state.present,
  }));
  if (
    summary.length === 1 &&
    summary[0].node === node &&
    summary[0].present === present
  ) {
    return;
  }
  fail(
    `${context}: the item's context must be exactly ` +
      `[{node: ${JSON.stringify(node)}, present: ${String(present)}}] — the ` +
      `strategy-derived context node presented under its current identity ` +
      `and presence (SPEC 10.4, 10.5, 10.7); got ${JSON.stringify(summary)}`,
  );
}

/**
 * Assert an item's origin is exactly one node whose after side carries the
 * given presence (the after side reads the current graph, SPEC 10.7).
 */
function assertSoleOrigin(
  item: ReviewItem,
  node: string,
  afterPresent: boolean,
  context: string,
): void {
  const summary = item.origin.map((entry) => ({
    node: entry.node,
    afterPresent: entry.after.present,
  }));
  if (
    summary.length === 1 &&
    summary[0].node === node &&
    summary[0].afterPresent === afterPresent
  ) {
    return;
  }
  fail(
    `${context}: the item's origin must be exactly one entry for ` +
      `${JSON.stringify(node)} with its after side ` +
      `${afterPresent ? "present" : "absent"} — the originating node of the ` +
      `reviewed change (SPEC 5.6, 10.5), its after side read from the ` +
      `current graph (SPEC 10.7); got ${JSON.stringify(summary)}`,
  );
}

/**
 * The journal arm's `show` and `export` observation: the item reported
 * `invalidated`, its scope node presented absent under `node` — the
 * recorded canonical identity, which no longer resolves, mapped forward
 * through the now-empty journal (SPEC 5.4, 6.1, 10.4, 10.7).
 */
function assertInvalidatedAbsentScope(
  item: ReviewItem,
  node: string,
  context: string,
): void {
  if (
    item.status === "invalidated" &&
    item.scope.node === node &&
    item.scope.present === false
  ) {
    return;
  }
  fail(
    `${context}: expected the item reported invalidated with its scope ` +
      `node presented absent under ${JSON.stringify(node)} — the identity ` +
      `its resolve recorded, (a, the journal's start), resolves to no node ` +
      `once the journal is empty, and reads present it mapped forward ` +
      `through that journal (SPEC 5.4, 6.1, 10.4, 10.7); got status ` +
      `${item.status} with scope ${JSON.stringify({
        node: item.scope.node,
        present: item.scope.present,
      })} — a product recording the node by its spelled identity at the ` +
      `resolve (b) reads the item still resolved`,
  );
}

/**
 * Assert a `status` row's presented scope identity and reported status
 * (SPEC 10.4, 10.7), `why` naming the rule the expectation follows.
 */
function assertRowPresented(
  report: SessionStatusReport,
  id: string,
  scope: string,
  status: ItemStatus,
  why: string,
  context: string,
): void {
  const row = requireRowById(report, id, context);
  if (row.scope === scope && row.status === status) return;
  fail(
    `${context}: expected item ${id} reported ${status} with its scope ` +
      `node presented as ${scope} (${why}); got ${row.status} with scope ` +
      row.scope,
  );
}

/** `review list --json`'s entry for one healthy session (SPEC 10.7). */
async function listedSession(
  product: ProductBinding,
  workspace: TestWorkspace,
  name: string,
  context: string,
): Promise<Extract<SessionListEntry, { corrupt: false }>> {
  const label = `${context} \`review list --json\``;
  const report = decodeSessionListReport(
    await runJson(product, workspace, ["review", "list", "--json"], label),
    label,
  );
  const entries = report.sessions.filter((entry) => entry.name === name);
  if (entries.length !== 1) {
    fail(
      `${label}: expected exactly one listed session named ` +
        `${JSON.stringify(name)} (SPEC 10.7: \`list\` reports every ` +
        `session); found ${String(entries.length)} among ` +
        JSON.stringify(report.sessions.map((entry) => entry.name)),
    );
  }
  const entry = entries[0];
  if (entry.corrupt) {
    fail(
      `${label}: session ${JSON.stringify(name)} is listed corrupt; the ` +
        `product wrote it and nothing else touched it, so it must be listed ` +
        `with its strategy and counts (SPEC 10.1, 10.7)`,
    );
  }
  return entry;
}

/**
 * A healthy `list` entry's counts, compared as `counts[status] ?? 0` per
 * defined status — stored statuses, no read-time invalidation (SPEC 10.4,
 * 10.7).
 */
function assertStoredCounts(
  entry: Extract<SessionListEntry, { corrupt: false }>,
  expected: Readonly<Record<ItemStatus, number>>,
  context: string,
): void {
  for (const status of ITEM_STATUSES) {
    const actual = entry.counts[status] ?? 0;
    if (actual !== expected[status]) {
      fail(
        `${context}: \`review list\` counts session ${entry.name}'s items ` +
          `by stored status — no read-time invalidation applied (SPEC 10.4, ` +
          `10.7) — expected ${String(expected[status])} item(s) stored ` +
          `${status}, got ${String(actual)}`,
      );
    }
  }
}

const T10_4_2 = defineProductTest({
  id: "T10.4-2",
  title:
    "presence changes: deleting a scope node after resolve invalidates the resolution (presence recorded present, node now absent); the item stays resolvable against absence, and a node already absent at resolve time does not invalidate by remaining absent across an unrelated edit — deletion review stays resolvable; restoring the node invalidates the resolution recorded against absence (presence changed in the other direction); non-scope presence recordings (presence is recorded for every scope, context, and origin node), each arm pure — no recorded relevant hash of the item and no generated context set changes, so only the named node's presence divergence can invalidate and a product recording presence for scope nodes alone reports the item still resolved: context arm (metadata-consistency) — baseline D bears a `d` reference to sibling T, one edit removes the reference and deletes T's section, `review create --base` derives D's item with the removed target T as context, recorded absent at resolve; re-authoring T reads the item `invalidated` through the context node's absent-to-present flip alone (D's metadataHash and the context set unchanged); origin arm (dependency-consistency) — baseline X depends on T, T depends on D (a section in its own file); a d-list edit on D derives X's item (scope X, context {T}, origin {D}); after resolve, one edit removes T's reference to D and deletes D's section — X's ownHash and metadataHash and T's subtreeHash unchanged (d-prop edits touch no own content, SPEC 1.6/5.5) and the context set stays {T} (T's effectiveHash still changed against the baseline), so the item reads `invalidated` through the origin node's present-to-absent flip alone; journal arm (a node is also absent when its identity ceases to resolve through the journal) — in an audit session over top-level leaves a and s, `xspec rename` a→b, a's item (presented under b thereafter) resolved `no-change`, then `.xspec/journal` deleted by hand, leaving a valid workspace with an empty journal under which b's canonical identity is (b, the journal's start) and the recorded one, (a, the journal's start), resolves to no node: `status`, `show`, and `export` present the item `invalidated`, its scope node absent under a — the recorded identity mapped forward through the now-empty journal; once s's item is resolved `updated`, a distinct item scoped at b enters, `unresolved`, the original keeping its id and stored status (`list` counting it `no-change`) — a product recording the node by its spelled identity at the resolve (b) reads the item still resolved and adds no item for b (SPEC 1.6, 5.4, 5.5, 5.6, 6.1, 6.4, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7)",
  run: async (product) => {
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [T2_FILE]: t2Spec(true, "Wye text v0.") },
      async (workspace) => {
        await buildOk(product, workspace, "T10.4-2 `build`");
        await expectExit(
          product,
          workspace,
          ["review", "create", "--strategy", "audit", "--name", "s"],
          0,
          "T10.4-2 `review create --strategy audit --name s`",
        );
        const status = await sessionStatus(product, workspace, "s", "T10.4-2");
        assertSameJson(
          kindScopeSet(status),
          [
            `subtree-coherence ${T2_ROOT}`,
            `subtree-coherence ${T2_X}`,
            `subtree-coherence ${T2_Y}`,
          ].sort(),
          "T10.4-2: audit creates one subtree-coherence item per node, " +
            "root included (SPEC 10.6)",
        );
        const xId = requireRow(status, "subtree-coherence", T2_X, "T10.4-2").id;

        await resolveOk(
          product,
          workspace,
          "s",
          xId,
          "no-change",
          "T10.4-2 `review resolve s <x item> --status no-change` (present)",
        );
        await expectItemStatus(
          product,
          workspace,
          "s",
          xId,
          "no-change",
          "T10.4-2 sanity — the fresh resolution matches the graph",
        );

        // Deleting the scope node after resolve invalidates.
        await workspace.file(T2_FILE, T10_4_2_X_DELETED);
        await buildOk(product, workspace, "T10.4-2 `build` after deleting x");
        await expectItemStatus(
          product,
          workspace,
          "s",
          xId,
          "invalidated",
          "T10.4-2 after the deletion — a presence change in either " +
            "direction invalidates (SPEC 10.4)",
        );
        const afterLoss = await showItem(
          product,
          workspace,
          "s",
          xId,
          "T10.4-2 post-deletion read",
        );
        if (
          afterLoss.scope.node !== T2_X ||
          afterLoss.scope.present !== false
        ) {
          fail(
            `T10.4-2 post-deletion \`review show\`: the deleted scope node ` +
              `is presented under its identity with current presence ` +
              `(SPEC 10.4, 10.7); expected {node: ${JSON.stringify(T2_X)}, ` +
              `present: false}, got ${JSON.stringify(afterLoss.scope)}`,
          );
        }

        // Deletion review stays resolvable: resolve against absence.
        await resolveOk(
          product,
          workspace,
          "s",
          xId,
          "no-change",
          "T10.4-2 `review resolve s <x item> --status no-change` against " +
            "absence — deletion review stays resolvable (SPEC 10.4)",
        );
        await expectItemStatus(
          product,
          workspace,
          "s",
          xId,
          "no-change",
          "T10.4-2 after resolving against absence",
        );

        // Remaining absent does not invalidate — even across an unrelated
        // edit that moves the graph.
        await workspace.file(T2_FILE, T10_4_2_X_ABSENT_Y_EDITED);
        await buildOk(product, workspace, "T10.4-2 `build` after the y edit");
        await expectItemStatus(
          product,
          workspace,
          "s",
          xId,
          "no-change",
          "T10.4-2 after an unrelated edit with x still absent — a node " +
            "already absent at resolve time does not invalidate by " +
            "remaining absent (SPEC 10.4)",
        );

        // Restoring the node invalidates the resolution recorded against
        // absence.
        await workspace.file(T2_FILE, T10_4_2_X_RESTORED);
        await buildOk(product, workspace, "T10.4-2 `build` after restoring x");
        await expectItemStatus(
          product,
          workspace,
          "s",
          xId,
          "invalidated",
          "T10.4-2 after restoring x — restoring a node invalidates a " +
            "resolution recorded against absence (SPEC 10.4)",
        );
        const afterRestore = await showItem(
          product,
          workspace,
          "s",
          xId,
          "T10.4-2 post-restore read",
        );
        if (
          afterRestore.scope.node !== T2_X ||
          afterRestore.scope.present !== true
        ) {
          fail(
            `T10.4-2 post-restore \`review show\`: the restored scope node ` +
              `is presented under its identity with current presence ` +
              `(SPEC 10.4, 10.7); expected {node: ${JSON.stringify(T2_X)}, ` +
              `present: true}, got ${JSON.stringify(afterRestore.scope)}`,
          );
        }
      },
    );

    // --- context arm: a context node's absent-to-present flip --------------
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [T2C_FILE]: T10_4_2_C_INITIAL },
      async (workspace) => {
        const prefix = "T10.4-2 context arm (metadata-consistency)";
        await workspace.gitInit();
        const base = await workspace.gitCommitAll("baseline");
        await buildOk(product, workspace, `${prefix} \`build\` at baseline`);
        const atBase = await captureHashes(
          product,
          workspace,
          [T2C_D],
          `${prefix}, baseline capture`,
        );

        // One edit removes D's `d` reference and deletes T's section.
        await workspace.file(T2C_FILE, T10_4_2_C_REFERENCE_REMOVED);
        await buildOk(
          product,
          workspace,
          `${prefix} \`build\` after the reference-removing edit`,
        );
        const atCreate = await captureHashes(
          product,
          workspace,
          [T2C_D],
          `${prefix}, creation-moment capture`,
        );
        assertHashPremises(
          atBase,
          atCreate,
          // D `metadata-changed` (SPEC 5.6) — the item generates.
          [{ node: T2C_D, hash: "metadataHash" }],
          // d-prop edits touch no own content (SPEC 1.6, 5.5).
          [
            { node: T2C_D, hash: "ownHash" },
            { node: T2C_D, hash: "subtreeHash" },
          ],
          `${prefix}, staging the metadata-changed premise`,
        );

        await expectExit(
          product,
          workspace,
          ["review", "create", "--base", base, "--name", "s"],
          0,
          `${prefix} \`review create --base <baseline> --name s\``,
        );
        const status = await sessionStatus(product, workspace, "s", prefix);
        assertSameJson(
          kindScopeSet(status),
          [
            `metadata-consistency ${T2C_D}`,
            `subtree-coherence ${T2C_ROOT}`,
          ].sort(),
          `${prefix}: the one edit yields D's metadata-consistency item ` +
            `plus the changed root's subtree-coherence item — the deleted T ` +
            `is skipped for its changed ancestor (SPEC 10.5)`,
        );
        const dId = requireRow(
          status,
          "metadata-consistency",
          T2C_D,
          prefix,
        ).id;
        assertSoleContext(
          await showItem(product, workspace, "s", dId, `${prefix} at create`),
          T2C_T,
          false,
          `${prefix} at create — the item's context is the removed ` +
            `\`d\` target, currently absent`,
        );

        await resolveOk(
          product,
          workspace,
          "s",
          dId,
          "no-change",
          `${prefix} \`review resolve s <D item> --status no-change\` ` +
            `(context node T absent — its presence recorded so, SPEC 10.4)`,
        );
        await expectItemStatus(
          product,
          workspace,
          "s",
          dId,
          "no-change",
          `${prefix} sanity — the fresh resolution matches the graph`,
        );

        // Re-author T. The item's only relevant hash (D's metadataHash) and
        // its generated context set are untouched; only the context node's
        // presence diverges from the recorded state.
        await workspace.file(T2C_FILE, T10_4_2_C_T_REAUTHORED);
        await buildOk(
          product,
          workspace,
          `${prefix} \`build\` after re-authoring T`,
        );
        const afterRestore = await captureHashes(
          product,
          workspace,
          [T2C_D],
          `${prefix}, post-restore capture`,
        );
        assertHashPremises(
          atCreate,
          afterRestore,
          [],
          // The item's one relevant hash is unchanged across the edit (the
          // pre-edit capture equals the state the resolve recorded: no edit
          // intervened).
          [{ node: T2C_D, hash: "metadataHash" }],
          `${prefix}, purity of the re-authoring edit`,
        );
        assertHashPremises(
          atBase,
          afterRestore,
          // D still `metadata-changed` against the baseline, and metadataHash
          // equality tracks the `d` target set exactly (SPEC 5.5), so the
          // generators still derive the item with context {T} (SPEC 10.5).
          [{ node: T2C_D, hash: "metadataHash" }],
          [],
          `${prefix}, the generated context set stays the removed target`,
        );
        await expectItemStatus(
          product,
          workspace,
          "s",
          dId,
          "invalidated",
          `${prefix} after re-authoring T — presence is recorded for the ` +
            `context node, and its absent-to-present flip alone invalidates ` +
            `(SPEC 10.4); a product recording presence for scope nodes ` +
            `alone reports the item still resolved`,
        );
        const restored = await showItem(
          product,
          workspace,
          "s",
          dId,
          `${prefix} post-restore read`,
        );
        assertSoleContext(
          restored,
          T2C_T,
          true,
          `${prefix} post-restore — the recorded-absent context node is ` +
            `presented under its current presence`,
        );
      },
    );

    // --- origin arm: an origin node's present-to-absent flip ---------------
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      {
        [T2O_X_FILE]: T2O_X_SOURCE,
        [T2O_T_FILE]: T10_4_2_T_INITIAL,
        [T2O_D_FILE]: T10_4_2_O_INITIAL,
      },
      async (workspace) => {
        const prefix = "T10.4-2 origin arm (dependency-consistency)";
        await workspace.gitInit();
        const base = await workspace.gitCommitAll("baseline");
        await buildOk(product, workspace, `${prefix} \`build\` at baseline`);
        const atBase = await captureHashes(
          product,
          workspace,
          [T2O_X, T2O_T, T2O_D],
          `${prefix}, baseline capture`,
        );

        // The d-list edit on D: D `metadata-changed`, nothing `changed`; T
        // and X are upstream-changed, attributed to D (SPEC 5.6).
        await workspace.file(T2O_D_FILE, T10_4_2_O_D_LIST_EDITED);
        await buildOk(
          product,
          workspace,
          `${prefix} \`build\` after the d-list edit on D`,
        );
        const atCreate = await captureHashes(
          product,
          workspace,
          [T2O_X, T2O_T, T2O_D],
          `${prefix}, creation-moment capture`,
        );
        assertHashPremises(
          atBase,
          atCreate,
          [
            // The edit lands on D's metadata...
            { node: T2O_D, hash: "metadataHash" },
            // ...and cascades into T's effectiveHash, deriving X's item with
            // context {T} (SPEC 10.5).
            { node: T2O_T, hash: "effectiveHash" },
          ],
          [
            // T itself is untouched — its change is upstream only, so the
            // item's origin is D, not T (SPEC 5.6).
            { node: T2O_T, hash: "ownHash" },
            { node: T2O_T, hash: "subtreeHash" },
            { node: T2O_T, hash: "metadataHash" },
            { node: T2O_X, hash: "ownHash" },
            { node: T2O_X, hash: "metadataHash" },
          ],
          `${prefix}, staging the upstream-change premise`,
        );

        await expectExit(
          product,
          workspace,
          ["review", "create", "--base", base, "--name", "s"],
          0,
          `${prefix} \`review create --base <baseline> --name s\``,
        );
        const status = await sessionStatus(product, workspace, "s", prefix);
        assertSameJson(
          kindScopeSet(status),
          [
            `dependency-consistency ${T2O_T}`,
            `dependency-consistency ${T2O_X}`,
            `metadata-consistency ${T2O_D}`,
          ].sort(),
          `${prefix}: the d-list edit yields D's metadata-consistency item ` +
            `plus one dependency-consistency item per dependent of a ` +
            `changed-effectiveHash target — no node is \`changed\`, so no ` +
            `subtree-coherence item exists (SPEC 5.6, 10.5)`,
        );
        const xId = requireRow(
          status,
          "dependency-consistency",
          T2O_X,
          prefix,
        ).id;
        const created = await showItem(
          product,
          workspace,
          "s",
          xId,
          `${prefix} at create`,
        );
        assertSoleContext(
          created,
          T2O_T,
          true,
          `${prefix} at create — the item's context is the dependency-edge ` +
            `target whose effectiveHash changed`,
        );
        assertSoleOrigin(
          created,
          T2O_D,
          true,
          `${prefix} at create — the item's origin is the originating node ` +
            `of T's change`,
        );

        await resolveOk(
          product,
          workspace,
          "s",
          xId,
          "no-change",
          `${prefix} \`review resolve s <X item> --status no-change\` ` +
            `(D present — every origin node's presence recorded, SPEC 10.4)`,
        );
        await expectItemStatus(
          product,
          workspace,
          "s",
          xId,
          "no-change",
          `${prefix} sanity — the fresh resolution matches the graph`,
        );

        // One edit removes T's reference to D and deletes D's section. The
        // item's relevant hashes (X's ownHash and metadataHash, T's
        // subtreeHash) and its generated context set are untouched; only the
        // origin node's presence diverges from the recorded state.
        await workspace.file(T2O_T_FILE, T10_4_2_T_REFERENCE_REMOVED);
        await workspace.file(T2O_D_FILE, T10_4_2_O_D_DELETED);
        await buildOk(
          product,
          workspace,
          `${prefix} \`build\` after deleting D's section`,
        );
        const afterLoss = await captureHashes(
          product,
          workspace,
          [T2O_X, T2O_T],
          `${prefix}, post-deletion capture (D's identity no longer resolves)`,
        );
        assertHashPremises(
          atCreate,
          afterLoss,
          // The reference removal lands on T's metadata (the pre-edit
          // capture equals the state the resolve recorded).
          [{ node: T2O_T, hash: "metadataHash" }],
          // The item's relevant hashes stay put: d-prop edits touch no own
          // content (SPEC 1.6, 5.5), and X is untouched.
          [
            { node: T2O_X, hash: "ownHash" },
            { node: T2O_X, hash: "metadataHash" },
            { node: T2O_T, hash: "subtreeHash" },
          ],
          `${prefix}, purity of the deletion edit`,
        );
        assertHashPremises(
          atBase,
          afterLoss,
          // T's effectiveHash still changed against the baseline, so the
          // generators still derive X's item with context {T} (SPEC 10.5).
          [{ node: T2O_T, hash: "effectiveHash" }],
          [],
          `${prefix}, the generated context set stays {T}`,
        );
        await expectItemStatus(
          product,
          workspace,
          "s",
          xId,
          "invalidated",
          `${prefix} after deleting D's section — presence is recorded for ` +
            `every origin node, and its present-to-absent flip alone ` +
            `invalidates (SPEC 10.4); a product recording presence for ` +
            `scope (or scope and context) nodes alone reports the item ` +
            `still resolved`,
        );
        const afterShow = await showItem(
          product,
          workspace,
          "s",
          xId,
          `${prefix} post-deletion read`,
        );
        if (
          afterShow.scope.node !== T2O_X ||
          afterShow.scope.present !== true
        ) {
          fail(
            `${prefix} post-deletion \`review show\`: the scope node must ` +
              `still be the present X — the flip under test is the origin ` +
              `node's alone (SPEC 10.4, 10.7); expected {node: ` +
              `${JSON.stringify(T2O_X)}, present: true}, got ` +
              JSON.stringify(afterShow.scope),
          );
        }
        assertSoleContext(
          afterShow,
          T2O_T,
          true,
          `${prefix} post-deletion — the context node T stays present and ` +
            `recorded-matching`,
        );
        assertSoleOrigin(
          afterShow,
          T2O_D,
          false,
          `${prefix} post-deletion — the origin node is presented under ` +
            `its current (absent) presence`,
        );
      },
    );

    // --- journal arm: a recorded identity that ceases to resolve -----------
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [T2J_FILE]: T10_4_2_J_INITIAL },
      async (workspace) => {
        const prefix = "T10.4-2 journal arm";
        await buildOk(product, workspace, `${prefix} \`build\``);
        await expectExit(
          product,
          workspace,
          ["review", "create", "--strategy", "audit", "--name", "s"],
          0,
          `${prefix} \`review create --strategy audit --name s\``,
        );
        const created = await sessionStatus(product, workspace, "s", prefix);
        assertSameJson(
          kindScopeSet(created),
          [
            `subtree-coherence ${T2J_ROOT}`,
            `subtree-coherence ${T2J_A}`,
            `subtree-coherence ${T2J_S}`,
          ].sort(),
          `${prefix}: audit creates one subtree-coherence item per node, ` +
            `root included (SPEC 10.6)`,
        );
        const rootId = requireRow(
          created,
          "subtree-coherence",
          T2J_ROOT,
          prefix,
        ).id;
        const aId = requireRow(created, "subtree-coherence", T2J_A, prefix).id;
        const sId = requireRow(created, "subtree-coherence", T2J_S, prefix).id;

        // The journaled rename a→b: a's item is presented under b thereafter.
        await expectExit(
          product,
          workspace,
          ["rename", T2J_FILE, "a", "b"],
          0,
          `${prefix} \`rename specs/J.mdx a b\``,
        );
        const journalKind = await workspace.kind(T2J_JOURNAL);
        if (journalKind !== "file") {
          fail(
            `${prefix}: staging premise — after the rename \`.xspec/journal\` ` +
              `must be a plain file holding its entry (SPEC 6.1: the file ` +
              `comes into existence with the first journaled operation; ` +
              `SPEC 6.4: rename appends the mapping to the journal), so ` +
              `deleting it empties the journal; found ${journalKind}`,
          );
        }
        const afterRename = `${prefix} after the rename`;
        assertRowPresented(
          await sessionStatus(product, workspace, "s", afterRename),
          aId,
          T2J_B,
          "unresolved",
          "reads present a recorded node under its current identity, and a " +
            "journaled rename by itself changes no status (SPEC 10.4)",
          afterRename,
        );

        // Resolve a's item: its scope node recorded as the canonical
        // identity (a, the journal's start) (SPEC 5.4, 10.4).
        await resolveOk(
          product,
          workspace,
          "s",
          aId,
          "no-change",
          `${prefix} \`review resolve s <a's item, presented under b> ` +
            `--status no-change\``,
        );
        const afterResolve = `${prefix} sanity after the resolve`;
        assertRowPresented(
          await sessionStatus(product, workspace, "s", afterResolve),
          aId,
          T2J_B,
          "no-change",
          "the fresh resolution matches the graph, its scope node still " +
            "presented under b (SPEC 10.4)",
          afterResolve,
        );

        // Delete the journal by hand: a workspace without the journal file
        // has an empty journal and stays valid (SPEC 6.1).
        await fsp.rm(workspace.path(T2J_JOURNAL));
        await buildOk(
          product,
          workspace,
          `${prefix} \`build\` after deleting \`.xspec/journal\` — an ` +
            `empty journal, the workspace valid (SPEC 6.1)`,
        );

        const afterDeletion = `${prefix} after deleting the journal`;
        const deleted = await sessionStatus(
          product,
          workspace,
          "s",
          afterDeletion,
        );
        assertRowPresented(
          deleted,
          aId,
          T2J_A,
          "invalidated",
          "the identity its resolve recorded, (a, the journal's start), " +
            "resolves to no node once the journal is empty — a recorded " +
            "presence that changed — and reads present it mapped forward " +
            "through that journal (SPEC 5.4, 6.1, 10.4); a product recording " +
            "the node by its spelled identity at the resolve (b) reads the " +
            "item still resolved",
          `${afterDeletion} \`review status\``,
        );
        assertSameJson(
          deleted.items.map((row) => [row.id, row.scope, row.status]).sort(),
          (
            [
              [rootId, T2J_ROOT, "unresolved"],
              [aId, T2J_A, "invalidated"],
              [sId, T2J_S, "unresolved"],
            ] as const
          )
            .map((row) => [...row])
            .sort(),
          `${afterDeletion}: still the three items — new items enter only ` +
            `through re-derivation (SPEC 10.5), so b has no item of its own ` +
            `yet`,
        );
        assertInvalidatedAbsentScope(
          await showItem(product, workspace, "s", aId, afterDeletion),
          T2J_A,
          `${afterDeletion} \`review show\``,
        );
        const exportLabel = `${afterDeletion} \`review export s --json\``;
        const exported = decodeExportReport(
          await runJson(
            product,
            workspace,
            ["review", "export", "s", "--json"],
            exportLabel,
          ),
          exportLabel,
        );
        assertInvalidatedAbsentScope(
          requireItem(exported.items, aId, exportLabel),
          T2J_A,
          exportLabel,
        );

        // The re-derivation: resolve s's item `updated` (SPEC 10.5, 10.6).
        await resolveOk(
          product,
          workspace,
          "s",
          sId,
          "updated",
          `${prefix} \`review resolve s <s item> --status updated\` — ` +
            `re-derivation`,
        );
        const afterRederive = `${prefix} after the updated-resolve`;
        const rederived = await sessionStatus(
          product,
          workspace,
          "s",
          afterRederive,
        );
        // b's generated item matches no existing item — the original's
        // recorded identity no longer resolves — so a distinct item enters.
        // A product matching by the spelled identity it recorded (b) finds
        // the original here and adds no item for b.
        const bRow = requireRow(
          rederived,
          "subtree-coherence",
          T2J_B,
          afterRederive,
        );
        if ([rootId, aId, sId].includes(bRow.id)) {
          fail(
            `${afterRederive}: the item scoped at b must be a distinct item ` +
              `that entered at the re-derivation — the original's recorded ` +
              `identity, (a, the journal's start), matches no generated item ` +
              `once the journal is empty (SPEC 5.4, 10.4, 10.5) — but the ` +
              `item scoped at b carries the existing id ${bRow.id}; a ` +
              `product recording the node by its spelled identity at the ` +
              `resolve (b) adds no item for b`,
          );
        }
        if (bRow.status !== "unresolved") {
          fail(
            `${afterRederive}: the item scoped at b enters unresolved (SPEC ` +
              `10.2, 10.5); got ${bRow.status}`,
          );
        }
        assertSameJson(
          rederived.items.map((row) => [row.id, row.scope, row.status]).sort(),
          (
            [
              [rootId, T2J_ROOT, "unresolved"],
              [aId, T2J_A, "invalidated"],
              [sId, T2J_S, "updated"],
              [bRow.id, T2J_B, "unresolved"],
            ] as const
          )
            .map((row) => [...row])
            .sort(),
          `${afterRederive}: exactly four items — the original keeps its id, ` +
            `still presented invalidated under a, beside the new item for b ` +
            `(items that no longer generate remain in the session, SPEC 10.4, ` +
            `10.5)`,
        );
        assertStoredCounts(
          await listedSession(product, workspace, "s", afterRederive),
          {
            unresolved: 2,
            updated: 1,
            "no-change": 1,
            skipped: 0,
            invalidated: 0,
          },
          `${afterRederive}: the original keeps its stored status — \`list\` ` +
            `counts it no-change beside the root's and b's unresolved items ` +
            `and s's updated one`,
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T10.4-3 — context-set change
// ---------------------------------------------------------------------------

// Path-blocks fixture — TEST-SPEC's A, K1, and K2 as the top-level section
// `a` and its children `a.k1` and `a.k2`. a.k1's text is edited before
// `create --base`, so the session holds a.k1's subtree-coherence item and
// a's parent-consistency item — context and origin {a.k1}, blockedBy a.k1's
// item (SPEC 10.5) — and both are resolved `no-change` (no re-derivation,
// 10.5). a.k2's text is then edited: a new changed branch under a, with no
// re-derivation, so the generators' context set for a's item becomes
// {a.k1, a.k2} while no hash the item records changes (10.4). Reads present
// that current context set as the item's `context` and its other assigned
// fields — `origin`, `blockedBy`, `reason` — as last assigned at `create`
// (10.4), though the generators would now give the origin {a.k1, a.k2}.
// `reason`'s composition is unpinned (10.2): it is compared byte for byte
// between captures, its content never asserted.
const T3_FILE = "specs/A.mdx";
const T3_A = "specs/A.mdx#a";
const T3_AK1 = "specs/A.mdx#a.k1";
const T3_AK2 = "specs/A.mdx#a.k2";
const T3_SESSION_FILE = ".xspec/reviews/s.json";

function t3Spec(k1Text: string, k2Text: string): string {
  return [
    '<S id="a">',
    "Alpha own text.",
    "",
    '<S id="a.k1">',
    k1Text,
    "</S>",
    "",
    '<S id="a.k2">',
    k2Text,
    "</S>",
    "</S>",
    "",
  ].join("\n");
}

// T10.4-3's context-set change — the a.k2 edit, staged after the body's
// first `build` — is a staged-source record (helpers/staged-mdx.ts, S-9:
// judged before any product exists); the a.k1 edit precedes that `build`
// (staged between `gitCommitAll` and it) and stays plain.
const T10_4_3_K2_EDITED = stagedMdx(
  "T10.4-3 specs/A.mdx with the second branch a.k2 at v1 (the context-set change)",
  t3Spec("Kay one text v1.", "Kay two text v1."),
);

/**
 * Run one `review` read after the a.k2 edit and return its document, the
 * session file byte-identical around it (SPEC 10.4: reads never write the
 * session file — the current context set and read-time invalidation are
 * computed and reported, never persisted; TEST-SPEC T10.4-3, T10.4-5).
 */
async function t3ReadKeepingSession(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  label: string,
): Promise<unknown> {
  const before = await workspace.readBytes(T3_SESSION_FILE);
  const doc = await runJson(product, workspace, argv, label);
  assertBytesEqual(
    await workspace.readBytes(T3_SESSION_FILE),
    before,
    `${label} — the read must leave the session file byte-identical: the ` +
      `current context set and read-time invalidation are computed and ` +
      `reported, never persisted (SPEC 10.4)`,
  );
  return doc;
}

/** An item's `reason` as `review export s --json` presents it (SPEC 10.7). */
async function t3ExportedReason(
  product: ProductBinding,
  workspace: TestWorkspace,
  itemId: string,
  context: string,
): Promise<string> {
  const label = `${context} \`review export s --json\``;
  const exported = decodeExportReport(
    await runJson(
      product,
      workspace,
      ["review", "export", "s", "--json"],
      label,
    ),
    label,
  );
  return requireItem(exported.items, itemId, label).reason;
}

/**
 * a's item as `show`, `next --json`, or `export` presents it after the a.k2
 * edit (SPEC 10.4): reported `invalidated`, its `context` the current
 * context set — exactly {a.k1, a.k2}, the new branch head included — while
 * its `origin` and `blockedBy` stay as last assigned at `create`: {a.k1}
 * and a.k1's item alone.
 */
function assertT3Presentation(
  item: ReviewItem,
  k1Id: string,
  context: string,
): void {
  if (item.status !== "invalidated") {
    fail(
      `${context}: a's item must be reported invalidated — its current ` +
        `context set {a.k1, a.k2} differs from its recorded context set ` +
        `{a.k1}, though no recorded hash changed (SPEC 10.4); got ` +
        item.status,
    );
  }
  assertSameJson(
    identitySet(item.context),
    [T3_AK1, T3_AK2].sort(),
    `${context}: a's item's context must be exactly {a.k1, a.k2} — reads ` +
      `present the item's current context set, the context the generators ` +
      `assign it against the current workspace, the new branch head a.k2 ` +
      `included (SPEC 10.4, 10.5); a product presenting the recorded ` +
      `context set shows {a.k1}`,
  );
  assertSameJson(
    identitySet(item.origin),
    [T3_AK1],
    `${context}: a's item's origin must stay {a.k1} — reads present ` +
      `origin as last assigned, at \`create\` (no re-derivation has run), ` +
      `though the generators would now give {a.k1, a.k2} (SPEC 10.4); a ` +
      `product presenting every field as the generators now give them ` +
      `shows {a.k1, a.k2}`,
  );
  assertSameJson(
    item.blockedBy,
    [k1Id],
    `${context}: a's item's blockedBy must stay a.k1's item alone — reads ` +
      `present blockedBy as last assigned, at \`create\` (SPEC 10.4)`,
  );
}

/**
 * A surface's `reason` for a's item must be byte-identical to that
 * surface's capture, taken once both resolves were done (SPEC 10.4: reads
 * present `reason` as last assigned, and a resolve assigns `context`
 * alone; 10.2: its composition unpinned, so it is compared, never read).
 */
function assertT3ReasonAsCaptured(
  presented: string,
  captured: string,
  context: string,
): void {
  if (presented === captured) return;
  fail(
    `${context}: a's item's reason must be presented byte-identical to ` +
      `this surface's capture, taken once both resolves were done — reads ` +
      `present reason as last assigned (at \`create\`; no re-derivation or ` +
      `split since), and a resolve assigns context alone (SPEC 10.4; its ` +
      `composition unpinned, 10.2); a product recomputing reason from the ` +
      `current graph when the item is read fails wherever its text ` +
      `reflects a.k2's edit. Captured: ${JSON.stringify(captured)}; ` +
      `presented: ${JSON.stringify(presented)}`,
  );
}

const T10_4_3 = defineProductTest({
  id: "T10.4-3",
  title:
    "context-set change: a change that alters an item's generator-derived context set invalidates it without any recorded hash changing, and reads present the current context set as the item's `context` while presenting its other assigned fields as last assigned — path-blocks fixture: top-level A with children K1 and K2, K1's text edited before `create --base`; K1's subtree-coherence item and then A's parent-consistency item (context and origin {K1}, blockedBy K1's item) resolved `no-change`; then K2's text edited — a new changed branch under A — with no re-derivation: A's item reads `invalidated` though A's ownHash and metadataHash and K1's subtreeHash are byte-unchanged (premises via `query node`), K1's item staying resolved; `show`, `next --json`, and `export` present A's context as exactly {K1, K2}, the new branch head included, while its origin stays {K1} and its blockedBy K1's item alone — as last assigned, though the generators would now give the origin {K1, K2} — each read leaving the session file byte-identical; A's item's `reason`, captured from `show` and from `export` once both resolves are done, is presented byte-identical by each surface after K2's edit and again once A's item is resolved `no-change` (a resolve assigns `context` alone), its composition unasserted (SPEC 5.5, 5.6, 10.2, 10.4, 10.5, 10.7)",
  run: async (product) => {
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [T3_FILE]: t3Spec("Kay one text v0.", "Kay two text v0.") },
      async (workspace) => {
        await workspace.gitInit();
        const base = await workspace.gitCommitAll("baseline");
        await workspace.file(
          T3_FILE,
          t3Spec("Kay one text v1.", "Kay two text v0."),
        );
        await buildOk(
          product,
          workspace,
          "T10.4-3 `build` after the a.k1 edit",
        );
        await expectExit(
          product,
          workspace,
          ["review", "create", "--base", base, "--name", "s"],
          0,
          "T10.4-3 `review create --base <baseline> --name s`",
        );
        const status = await sessionStatus(product, workspace, "s", "T10.4-3");
        assertSameJson(
          kindScopeSet(status),
          [`parent-consistency ${T3_A}`, `subtree-coherence ${T3_AK1}`].sort(),
          "T10.4-3: the single changed branch yields a.k1's " +
            "subtree-coherence item and a's parent-consistency item " +
            "(SPEC 10.5)",
        );
        const k1Id = requireRow(
          status,
          "subtree-coherence",
          T3_AK1,
          "T10.4-3",
        ).id;
        const aId = requireRow(
          status,
          "parent-consistency",
          T3_A,
          "T10.4-3",
        ).id;
        await resolveOk(
          product,
          workspace,
          "s",
          k1Id,
          "no-change",
          "T10.4-3 resolve of the a.k1 subtree-coherence item (the blocker)",
        );
        await resolveOk(
          product,
          workspace,
          "s",
          aId,
          "no-change",
          "T10.4-3 resolve of the a parent-consistency item",
        );

        // Premise: a's item as `create` assigned it — context and origin
        // {a.k1}, blockedBy a.k1's item (SPEC 10.5) — its context the
        // recorded context set its resolve wrote (10.4). The `reason`
        // captures, once both resolves are done: `show`'s here, `export`'s
        // next.
        const resolved = await showItem(
          product,
          workspace,
          "s",
          aId,
          "T10.4-3 post-resolve read",
        );
        assertSameJson(
          {
            context: identitySet(resolved.context),
            origin: identitySet(resolved.origin),
            blockedBy: resolved.blockedBy,
          },
          { context: [T3_AK1], origin: [T3_AK1], blockedBy: [k1Id] },
          "T10.4-3 staging premise: the resolved parent-consistency item's " +
            "context is the one changed branch — a's child on it — its " +
            "origin the changed node in a's subtree, and its blockedBy " +
            "a.k1's subtree-coherence item (SPEC 10.5)",
        );
        const shownReason = resolved.reason;
        const exportedReason = await t3ExportedReason(
          product,
          workspace,
          aId,
          "T10.4-3 post-resolve read",
        );

        // Captures of every recorded relevant hash (SPEC 10.4:
        // parent-consistency = ownHash and metadataHash of the scope node,
        // subtreeHash of each context node).
        const before = await captureHashes(
          product,
          workspace,
          [T3_A, T3_AK1, T3_AK2],
          "T10.4-3 pre-edit capture",
        );

        // The context-set change: a new changed branch under a, with no
        // re-derivation.
        await workspace.file(T3_FILE, T10_4_3_K2_EDITED);
        await buildOk(
          product,
          workspace,
          "T10.4-3 `build` after the a.k2 edit",
        );
        const after = await captureHashes(
          product,
          workspace,
          [T3_A, T3_AK1, T3_AK2],
          "T10.4-3 post-edit capture",
        );
        for (const [node, hash] of [
          [T3_A, "ownHash"],
          [T3_A, "metadataHash"],
          [T3_AK1, "subtreeHash"],
        ] as const) {
          const beforeValue = before.get(node)?.[hash];
          const afterValue = after.get(node)?.[hash];
          if (beforeValue !== afterValue) {
            fail(
              `T10.4-3 staging premise: the a.k2 edit must leave ` +
                `${node}'s ${hash} unchanged (SPEC 5.5) so the invalidation ` +
                `can only come from the context-set change; got ` +
                `${JSON.stringify(beforeValue)} -> ${JSON.stringify(afterValue)}`,
            );
          }
        }
        if (
          before.get(T3_AK2)?.subtreeHash === after.get(T3_AK2)?.subtreeHash
        ) {
          fail(
            "T10.4-3 staging premise: the a.k2 edit must change a.k2's " +
              "subtreeHash (SPEC 5.5) — otherwise no new changed branch " +
              "exists and the arm is vacuous",
          );
        }

        // `status`: a's item is invalidated purely by the generator-derived
        // context set gaining the new branch (SPEC 10.4); a.k1's item — its
        // recorded state and context (its ancestor chain) untouched by the
        // edit — stays resolved, so a's item stays unblocked.
        const statusLabel =
          "T10.4-3 after the a.k2 edit `review status s --json`";
        const edited = decodeSessionStatusReport(
          await t3ReadKeepingSession(
            product,
            workspace,
            ["review", "status", "s", "--json"],
            statusLabel,
          ),
          statusLabel,
        );
        const aRow = requireRowById(edited, aId, statusLabel);
        if (aRow.status !== "invalidated") {
          fail(
            `${statusLabel}: a change that alters the item's ` +
              `generator-derived context set invalidates it without any ` +
              `recorded hash changing (SPEC 10.4) — a's item must be ` +
              `reported invalidated; got ${aRow.status}`,
          );
        }
        const k1Row = requireRowById(edited, k1Id, statusLabel);
        if (k1Row.status !== "no-change") {
          fail(
            `${statusLabel}: a.k1's item's recorded state and context (its ` +
              `ancestor chain) are untouched by the a.k2 edit, so it stays ` +
              `resolved (SPEC 10.4, 10.5); got ${k1Row.status}`,
          );
        }

        // `show`, `next --json`, and `export`: the current context set as
        // `context`; `origin`, `blockedBy`, and `reason` as last assigned.
        const showLabel =
          "T10.4-3 after the a.k2 edit `review show s <a item> --json`";
        const shown = decodeItemReport(
          await t3ReadKeepingSession(
            product,
            workspace,
            ["review", "show", "s", aId, "--json"],
            showLabel,
          ),
          showLabel,
        );
        assertT3Presentation(shown, k1Id, showLabel);
        assertT3ReasonAsCaptured(shown.reason, shownReason, showLabel);

        const nextLabel = "T10.4-3 after the a.k2 edit `review next s --json`";
        const next = decodeNextReport(
          await t3ReadKeepingSession(
            product,
            workspace,
            ["review", "next", "s", "--json"],
            nextLabel,
          ),
          nextLabel,
        );
        if (next.item?.id !== aId) {
          fail(
            `${nextLabel}: next must present a's item — the first item in ` +
              `item order that needs review and is unblocked: it reads ` +
              `invalidated, and its one blocker, a.k1's item, stays resolved ` +
              `(SPEC 10.3, 10.4, 10.5, 10.7); got ` +
              (next.item === undefined
                ? "the fully-resolved report"
                : `item ${next.item.id}`),
          );
        }
        assertT3Presentation(next.item, k1Id, nextLabel);

        const exportLabel =
          "T10.4-3 after the a.k2 edit `review export s --json`";
        const exported = decodeExportReport(
          await t3ReadKeepingSession(
            product,
            workspace,
            ["review", "export", "s", "--json"],
            exportLabel,
          ),
          exportLabel,
        );
        const exportedItem = requireItem(exported.items, aId, exportLabel);
        assertT3Presentation(exportedItem, k1Id, exportLabel);
        assertT3ReasonAsCaptured(
          exportedItem.reason,
          exportedReason,
          exportLabel,
        );

        // A resolve assigns `context` alone (SPEC 10.4): a's item — unblocked,
        // a.k1's item resolved — resolved `no-change` runs no re-derivation
        // (10.5), and no `split` intervenes, so each surface still presents
        // the captured `reason`.
        await resolveOk(
          product,
          workspace,
          "s",
          aId,
          "no-change",
          "T10.4-3 resolve of the invalidated a item --status no-change " +
            "(a resolve assigns context alone)",
        );
        const reresolved = "T10.4-3 after a's re-resolve";
        assertT3ReasonAsCaptured(
          (await showItem(product, workspace, "s", aId, reresolved)).reason,
          shownReason,
          `${reresolved} \`review show s <a item> --json\``,
        );
        assertT3ReasonAsCaptured(
          await t3ExportedReason(product, workspace, aId, reresolved),
          exportedReason,
          `${reresolved} \`review export s --json\``,
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T10.4-4 — rename immunity
// ---------------------------------------------------------------------------

// Part 1 (rename): p with descendant p.c, plus q — rename p -> pp maps the
// scoped node of p's item and both a scope and a context node of p.c's item.
// Parts 2–4 below: the file-move order flip, the reintroduction arm, and
// the decomposition arm.
const T4R_FILE = "specs/R.mdx";
const T4R_ROOT = "specs/R.mdx";
const T4R_P = "specs/R.mdx#p";
const T4R_PC = "specs/R.mdx#p.c";
const T4R_Q = "specs/R.mdx#q";
const T4R_PP = "specs/R.mdx#pp";
const T4R_PPC = "specs/R.mdx#pp.c";

const T4R_SOURCE = [
  '<S id="p">',
  "Parent own text.",
  "",
  '<S id="p.c">',
  "Child text.",
  "</S>",
  "</S>",
  "",
  '<S id="q">',
  "Cue text.",
  "</S>",
  "",
].join("\n");

// The manual deletion of pp.c after the rename (SPEC 6.6: a plain edit) — a
// staged-source record (helpers/staged-mdx.ts, S-9: judged before any
// product exists), staged after the arm's `build` and `rename`.
const T4R_WITHOUT_CHILD = stagedMdx(
  "T10.4-4 specs/R.mdx with pp.c deleted after the rename (rename arm)",
  [
    '<S id="pp">',
    "Parent own text.",
    "</S>",
    "",
    '<S id="q">',
    "Cue text.",
    "</S>",
    "",
  ].join("\n"),
);

// Part 2 (file-move order flip): specs/b.mdx before specs/d.mdx in byte
// order; moving d.mdx to a.mdx flips which file sorts first.
const T4M_B_FILE = "specs/b.mdx";
const T4M_D_FILE = "specs/d.mdx";
const T4M_A_FILE = "specs/a.mdx";
const T4M_M = "specs/b.mdx#m";
const T4M_R = "specs/b.mdx#r";
const T4M_N = "specs/d.mdx#n";
const T4M_W = "specs/d.mdx#w";
const T4M_AN = "specs/a.mdx#n";
const T4M_AW = "specs/a.mdx#w";

// The move and reintroduction arms follow the rename arm's invocations, so
// their initial sources are staged-source records (S-9's before-any-product
// clause), wrapped in place; the rename arm's `T4R_SOURCE`, the body's first
// workspace, stays plain.
const T4M_B_SOURCE = stagedMdx(
  "T10.4-4 move arm specs/b.mdx",
  [
    '<S id="m">',
    "Emm text.",
    "</S>",
    "",
    '<S id="r">',
    "Arr text.",
    "</S>",
    "",
  ].join("\n"),
);

const T4M_D_SOURCE = stagedMdx(
  "T10.4-4 move arm specs/d.mdx",
  [
    '<S id="n">',
    "Enn text.",
    "</S>",
    "",
    '<S id="w">',
    "Dub text.",
    "</S>",
    "",
  ].join("\n"),
);

// Part 3 (reintroduction): top-level leaves a and s; rename a -> b, then a
// new section reintroduces the identity `a` (a fresh canonical chain, 5.4).
const T4I_FILE = "specs/E.mdx";
const T4I_ROOT = "specs/E.mdx";
const T4I_A = "specs/E.mdx#a";
const T4I_B = "specs/E.mdx#b";
const T4I_S = "specs/E.mdx#s";

const T4I_SOURCE = stagedMdx(
  "T10.4-4 reintroduction arm specs/E.mdx",
  [
    '<S id="a">',
    "Aye original text.",
    "</S>",
    "",
    '<S id="s">',
    "Ess text.",
    "</S>",
    "",
  ].join("\n"),
);

const T4I_NEW_SECTION = [
  "",
  '<S id="a">',
  "Fresh reintroduced text.",
  "</S>",
  "",
].join("\n");

// The rename-rewritten file's tail — s's closing run, which the rename's
// minimal in-place edits leave as the file's end (SPEC 6.4) — the anchor the
// reintroduction's append extends through `workspace.edit()`: the appended
// bytes follow the product's, which no harness constant equals, so the
// staging is judged at staging time, not a staged-source record.
const T4I_TAIL = ['<S id="s">', "Ess text.", "</S>", ""].join("\n");

// Part 4 (decomposition): top-level a holding a.x, and a top-level leaf s;
// a's item split (the decomposition recorded against a), a renamed to b,
// then a new top-level section reintroducing the identity `a` — a fresh
// canonical chain the recorded decomposition never applies to (5.4, 10.4).
const T4D_FILE = "specs/F.mdx";
const T4D_ROOT = "specs/F.mdx";
const T4D_A = "specs/F.mdx#a";
const T4D_AX = "specs/F.mdx#a.x";
const T4D_B = "specs/F.mdx#b";
const T4D_BX = "specs/F.mdx#b.x";
const T4D_S = "specs/F.mdx#s";

const T4D_SOURCE = stagedMdx(
  "T10.4-4 decomposition arm specs/F.mdx with top-level a holding a.x and a top-level leaf s",
  [
    '<S id="a">',
    "Aye own text.",
    "",
    '<S id="a.x">',
    "Ex text.",
    "</S>",
    "</S>",
    "",
    '<S id="s">',
    "Ess text.",
    "</S>",
    "",
  ].join("\n"),
);

// The new top-level leaf section a and the anchor its append extends: the
// rename-rewritten file's tail, s's closing run (SPEC 6.4: minimal in-place
// edits leave it the file's end) — an anchored `workspace.edit()` of the
// product's bytes, as the reintroduction arm's.
const T4D_NEW_SECTION = [
  "",
  '<S id="a">',
  "Fresh reintroduced text.",
  "</S>",
  "",
].join("\n");
const T4D_TAIL = ['<S id="s">', "Ess text.", "</S>", ""].join("\n");

/**
 * Diagnose that `search` occurs exactly once in the product-rewritten
 * `content` before `edit()` stages the append at it: SPEC 6.4 fixes the
 * rewritten form (minimal in-place edits), so a missing or ambiguous anchor
 * is a diagnosed assertion failure about the product's rewriting, never
 * `edit()`'s plain refusal (H-8).
 */
function anchorOnce(content: string, search: string, context: string): void {
  const first = content.indexOf(search);
  if (first === -1) {
    fail(
      `${context}: expected the rewritten source to contain ` +
        `${JSON.stringify(search)} exactly once (SPEC 6.4 fixes the rewritten ` +
        `form), but it does not appear; source: ${JSON.stringify(content)}`,
    );
  }
  if (content.includes(search, first + search.length)) {
    fail(
      `${context}: the anchor ${JSON.stringify(search)} appears more than once, ` +
        `so the manual edit cannot be staged unambiguously; source: ` +
        JSON.stringify(content),
    );
  }
}

/** A `status` report's rows as `[id, kind, scope, status]`, sorted. */
function statusRowTuples(report: SessionStatusReport): string[][] {
  return report.items
    .map((row) => [row.id, row.kind, row.scope, row.status])
    .sort();
}

/**
 * The decomposition arm's recorded decomposition as `export` presents it:
 * exactly one, a's `subtree-coherence` item's, its scope node under the
 * current identity `scope` (SPEC 10.4: reads present every recorded node
 * under its current identity, mapped forward through the journal; 10.7: the
 * decomposition is the original's kind and scope node, recorded durably) —
 * read through the review adapter's decode of each recorded decomposition's
 * kind and scope node.
 */
function assertT4dSoleDecomposition(
  report: ExportReport,
  scope: string,
  context: string,
): void {
  assertSameJson(
    report.decompositions,
    [{ kind: "subtree-coherence", scope }],
    `${context}: \`export\` presents the session's one recorded ` +
      `decomposition — a's subtree-coherence item's, recorded by \`split\` — ` +
      `its scope node under the current identity ${scope} (SPEC 10.4: every ` +
      `recorded node under its current identity; 10.7)`,
  );
}

/**
 * No `subtree-coherence` item scoped at b: the decomposition recorded
 * against old-a applies to b, the same canonical identity renamed (SPEC 5.4;
 * 10.4: decomposition matching compares canonical identities; 10.5: a
 * generated item whose kind and scope node are recorded as decomposed is
 * never added back).
 */
function assertT4dNoItemAtB(
  report: SessionStatusReport,
  context: string,
): void {
  const readded = report.items.filter(
    (row) => row.kind === "subtree-coherence" && row.scope === T4D_B,
  );
  if (readded.length === 0) return;
  fail(
    `${context}: no subtree-coherence item scoped at b enters — the ` +
      `decomposition \`split\` recorded against old-a applies to b, the same ` +
      `canonical identity renamed (SPEC 5.4; 10.4: decomposition matching ` +
      `compares canonical identities, never spellings; 10.5: a generated ` +
      `item whose kind and scope node are recorded as decomposed is never ` +
      `added back) — a product matching decompositions by spelling re-adds ` +
      `one; found ${JSON.stringify(readded)}`,
  );
}

/**
 * The decomposition's two items as `export` presents them once a is renamed
 * b: b.x's `subtree-coherence` item (a.x's, reused by the split) scoped at
 * b.x with context the ancestor chain {root, b}, and b's
 * `parent-consistency` item scoped at b with context b's children {b.x} —
 * every recorded node under its current identity, present (SPEC 10.4, 10.6,
 * 10.7).
 */
function assertT4dDecompositionItems(
  report: ExportReport,
  axId: string,
  pcId: string,
  context: string,
): void {
  const bx = requireItem(report.items, axId, context);
  assertSameJson(
    [bx.scope.node, bx.scope.present, identitySet(bx.context)],
    [T4D_BX, true, [T4D_ROOT, T4D_B].sort()],
    `${context}: b.x's item (a.x's, reused by the split) is presented under ` +
      `the current identities — scope b.x, present, its context the ` +
      `ancestor chain {root, b} (SPEC 10.4, 10.6, 10.7)`,
  );
  const pc = requireItem(report.items, pcId, context);
  assertSameJson(
    [pc.scope.node, pc.scope.present, identitySet(pc.context)],
    [T4D_B, true, [T4D_BX]],
    `${context}: b's parent-consistency item (a's, created by the split) is ` +
      `presented under the current identities — scope b, present, its ` +
      `context b's children {b.x} (SPEC 10.4, 10.7)`,
  );
}

const T10_4_4 = defineProductTest({
  id: "T10.4-4",
  title:
    "rename immunity: `xspec rename` on scoped and context nodes duplicates no item, loses no status, and invalidates nothing by the identity mapping alone — reads present recorded nodes under current identities, mapped forward through the journal, for present and absent nodes alike (a post-rename manual deletion presents the recorded node absent under its mapped identity); a journaled file `move` that flips which of two same-kind items' scope file paths sorts first flips their order in `status`, `next`, and `export` with statuses and recorded state intact; reintroduction arm: after resolving a's item, renaming a to b, authoring a new top-level section a, and resolving s's item `updated` (re-derivation), the item recorded against old-a keeps its id and resolved status under scope b, new-a's item enters as a distinct unresolved item, and the root item's blockedBy gains it — canonical identities with the journal-position pairing, never walked-back identity strings; decomposition arm: after splitting a's item (a holding a.x), renaming a to b, and resolving s's item `updated`, no subtree-coherence item scoped at b enters — the decomposition recorded against old-a applies to b, its items (b.x's and b's parent-consistency item) keeping their ids and statuses under the current identities, and `export` presents the recorded decomposition's scope node as b — and once a new top-level section a is authored and s's item resolved `updated` again, new-a's subtree-coherence item enters unresolved and the root item's blockedBy gains it — decompositions matched as canonical identities, never by spelling (SPEC 5.4, 6.2, 6.4, 6.5, 10.2, 10.4, 10.5, 10.6, 10.7)",
  run: async (product) => {
    // --- rename on scoped and context nodes, present and absent -------------
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [T4R_FILE]: T4R_SOURCE },
      async (workspace) => {
        const prefix = "T10.4-4 rename arm";
        await buildOk(product, workspace, `${prefix} \`build\``);
        await expectExit(
          product,
          workspace,
          ["review", "create", "--strategy", "audit", "--name", "s"],
          0,
          `${prefix} \`review create --strategy audit --name s\``,
        );
        const status = await sessionStatus(product, workspace, "s", prefix);
        assertSameJson(
          kindScopeSet(status),
          [
            `subtree-coherence ${T4R_ROOT}`,
            `subtree-coherence ${T4R_P}`,
            `subtree-coherence ${T4R_PC}`,
            `subtree-coherence ${T4R_Q}`,
          ].sort(),
          `${prefix}: audit creates one item per node (SPEC 10.6)`,
        );
        const rootId = requireRow(
          status,
          "subtree-coherence",
          T4R_ROOT,
          prefix,
        ).id;
        const pId = requireRow(status, "subtree-coherence", T4R_P, prefix).id;
        const pcId = requireRow(status, "subtree-coherence", T4R_PC, prefix).id;
        const qId = requireRow(status, "subtree-coherence", T4R_Q, prefix).id;

        // Resolve bottom-up (audit blocking, SPEC 10.6) with two distinct
        // resolved statuses so status preservation is discriminating.
        await resolveOk(
          product,
          workspace,
          "s",
          pcId,
          "no-change",
          `${prefix} resolve of p.c's item`,
        );
        await resolveOk(
          product,
          workspace,
          "s",
          pId,
          "no-change",
          `${prefix} resolve of p's item (unblocked once p.c resolved)`,
        );
        await resolveOk(
          product,
          workspace,
          "s",
          qId,
          "skipped",
          `${prefix} resolve of q's item`,
        );

        // Recorded hash values, for the recorded-state-intact check: 6.2
        // purity keeps them byte-identical across the rename.
        const pcHashBefore = (
          await queryNode(product, workspace, T4R_PC, `${prefix} pre-rename`)
        ).hashes.subtreeHash;

        await expectExit(
          product,
          workspace,
          ["rename", T4R_FILE, "p", "pp"],
          0,
          `${prefix} \`rename specs/R.mdx p pp\` (SPEC 6.4)`,
        );

        // Purity premise (SPEC 6.2): the renamed node's hashes are
        // byte-identical under its new identity.
        const pcHashAfter = (
          await queryNode(product, workspace, T4R_PPC, `${prefix} post-rename`)
        ).hashes.subtreeHash;
        if (pcHashAfter !== pcHashBefore) {
          fail(
            `${prefix}: cross-check with SPEC 6.2 — \`rename\` is pure and ` +
              `must leave every hash byte-identical; p.c's subtreeHash was ` +
              `${JSON.stringify(pcHashBefore)}, pp.c reports ` +
              JSON.stringify(pcHashAfter),
          );
        }

        // No duplicates, no lost statuses, nothing invalidated; scopes are
        // presented under current identities.
        const afterRename = await sessionStatus(
          product,
          workspace,
          "s",
          `${prefix} post-rename`,
        );
        assertSameJson(
          afterRename.items
            .map((row) => [row.id, row.kind, row.scope, row.status])
            .sort(),
          (
            [
              [rootId, "subtree-coherence", T4R_ROOT, "unresolved"],
              [pId, "subtree-coherence", T4R_PP, "no-change"],
              [pcId, "subtree-coherence", T4R_PPC, "no-change"],
              [qId, "subtree-coherence", T4R_Q, "skipped"],
            ] as const
          )
            .map((row) => [...row])
            .sort(),
          `${prefix} post-rename \`status\`: the identity mapping duplicates ` +
            `no item, discards no status, and by itself invalidates nothing; ` +
            `reads present recorded nodes under current identities ` +
            `(SPEC 10.4, 6.2)`,
        );

        // The context chain is mapped forward too, and the recorded state
        // still holds the (unchanged) recorded hash value.
        const shownAfterRename = await showItem(
          product,
          workspace,
          "s",
          pcId,
          `${prefix} post-rename`,
        );
        if (
          shownAfterRename.scope.node !== T4R_PPC ||
          shownAfterRename.scope.present !== true
        ) {
          fail(
            `${prefix} post-rename \`show\`: the recorded scope node is ` +
              `presented under its current identity (SPEC 10.4); expected ` +
              `{node: ${JSON.stringify(T4R_PPC)}, present: true}, got ` +
              JSON.stringify(shownAfterRename.scope),
          );
        }
        assertSameJson(
          identitySet(shownAfterRename.context),
          [T4R_ROOT, T4R_PP].sort(),
          `${prefix} post-rename \`show\`: the recorded context (the ` +
            `ancestor chain) is presented under current identities, the ` +
            `renamed parent mapped forward (SPEC 10.4, 10.6)`,
        );
        assertRecordedHolds(
          shownAfterRename.current,
          pcHashBefore,
          "the recorded subtreeHash of the (renamed) scope node",
          `${prefix} post-rename \`show\` — recorded state intact`,
        );

        // Absent node under a mapped identity: delete pp.c manually
        // (SPEC 6.6), then reads present the recorded node absent under its
        // current (journal-mapped) identity.
        await workspace.file(T4R_FILE, T4R_WITHOUT_CHILD);
        await buildOk(
          product,
          workspace,
          `${prefix} \`build\` after the manual deletion of pp.c`,
        );
        const shownAfterLoss = await showItem(
          product,
          workspace,
          "s",
          pcId,
          `${prefix} post-deletion`,
        );
        if (
          shownAfterLoss.scope.node !== T4R_PPC ||
          shownAfterLoss.scope.present !== false
        ) {
          fail(
            `${prefix} post-deletion \`show\`: reads present recorded nodes ` +
              `under current identities, for present and absent nodes alike ` +
              `(SPEC 10.4) — the node recorded as p.c maps forward to pp.c ` +
              `and is now absent; expected {node: ${JSON.stringify(T4R_PPC)}, ` +
              `present: false}, got ${JSON.stringify(shownAfterLoss.scope)}`,
          );
        }
        await expectItemStatus(
          product,
          workspace,
          "s",
          pcId,
          "invalidated",
          `${prefix} post-deletion — the presence change (not the earlier ` +
            `identity mapping) invalidates (SPEC 10.4)`,
        );
      },
    );

    // --- journaled file move flips item order --------------------------------
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [T4M_B_FILE]: T4M_B_SOURCE, [T4M_D_FILE]: T4M_D_SOURCE },
      async (workspace) => {
        const prefix = "T10.4-4 move arm";
        await buildOk(product, workspace, `${prefix} \`build\``);
        await expectExit(
          product,
          workspace,
          ["review", "create", "--strategy", "audit", "--name", "s"],
          0,
          `${prefix} \`review create --strategy audit --name s\``,
        );
        const status = await sessionStatus(product, workspace, "s", prefix);
        const mId = requireRow(status, "subtree-coherence", T4M_M, prefix).id;
        const rId = requireRow(status, "subtree-coherence", T4M_R, prefix).id;
        const nId = requireRow(status, "subtree-coherence", T4M_N, prefix).id;
        const wId = requireRow(status, "subtree-coherence", T4M_W, prefix).id;
        const bRootId = requireRow(
          status,
          "subtree-coherence",
          T4M_B_FILE,
          prefix,
        ).id;
        const dRootId = requireRow(
          status,
          "subtree-coherence",
          T4M_D_FILE,
          prefix,
        ).id;

        // Distinct resolved statuses on the second leaf of each file; m and
        // n stay unresolved as the `next` order witnesses.
        await resolveOk(
          product,
          workspace,
          "s",
          rId,
          "no-change",
          `${prefix} resolve of r's item`,
        );
        await resolveOk(
          product,
          workspace,
          "s",
          wId,
          "skipped",
          `${prefix} resolve of w's item`,
        );

        const nHash = (
          await queryNode(product, workspace, T4M_N, `${prefix} pre-move`)
        ).hashes.subtreeHash;
        const wHash = (
          await queryNode(product, workspace, T4M_W, `${prefix} pre-move`)
        ).hashes.subtreeHash;

        // Pre-move order: b.mdx sorts before d.mdx (byte order, SPEC 10.6).
        const preStatus = await sessionStatus(
          product,
          workspace,
          "s",
          `${prefix} pre-move`,
        );
        assertPrecedes(
          preStatus.items,
          mId,
          nId,
          `${prefix} pre-move \`status\`: specs/b.mdx sorts before specs/d.mdx`,
        );
        const preExportLabel = `${prefix} pre-move \`review export s --json\``;
        const preExport = decodeExportReport(
          await runJson(
            product,
            workspace,
            ["review", "export", "s", "--json"],
            preExportLabel,
          ),
          preExportLabel,
        );
        assertPrecedes(preExport.items, mId, nId, preExportLabel);
        const preNextLabel = `${prefix} pre-move \`review next s --json\``;
        const preNext = decodeNextReport(
          await runJson(
            product,
            workspace,
            ["review", "next", "s", "--json"],
            preNextLabel,
          ),
          preNextLabel,
        );
        if (preNext.fullyResolved || preNext.item === undefined) {
          fail(`${preNextLabel}: unresolved items remain (SPEC 10.7)`);
        }
        if (preNext.item.id !== mId) {
          fail(
            `${preNextLabel}: the first needing-review unblocked item is m's ` +
              `— specs/b.mdx sorts first, its root item is blocked, and m ` +
              `precedes r in document order (SPEC 10.6, 10.7); expected ` +
              `${mId}, got ${preNext.item.id}`,
          );
        }

        // The journaled file move: specs/d.mdx -> specs/a.mdx flips which
        // scope file path sorts first.
        await expectExit(
          product,
          workspace,
          ["move", T4M_D_FILE, T4M_A_FILE],
          0,
          `${prefix} \`move specs/d.mdx specs/a.mdx\` (SPEC 6.5, file form)`,
        );

        // Purity premise (SPEC 6.2): hashes byte-identical under the moved
        // identities.
        const nHashAfter = (
          await queryNode(product, workspace, T4M_AN, `${prefix} post-move`)
        ).hashes.subtreeHash;
        const wHashAfter = (
          await queryNode(product, workspace, T4M_AW, `${prefix} post-move`)
        ).hashes.subtreeHash;
        if (nHashAfter !== nHash || wHashAfter !== wHash) {
          fail(
            `${prefix}: cross-check with SPEC 6.2 — the file form of ` +
              `\`move\` is pure and must leave every hash byte-identical; ` +
              `n: ${JSON.stringify(nHash)} -> ${JSON.stringify(nHashAfter)}, ` +
              `w: ${JSON.stringify(wHash)} -> ${JSON.stringify(wHashAfter)}`,
          );
        }

        // Statuses and recorded state intact; scopes mapped forward; order
        // flipped in status, next, and export.
        const postStatus = await sessionStatus(
          product,
          workspace,
          "s",
          `${prefix} post-move`,
        );
        assertSameJson(
          postStatus.items.map((row) => [row.id, row.scope, row.status]).sort(),
          (
            [
              [bRootId, T4M_B_FILE, "unresolved"],
              [mId, T4M_M, "unresolved"],
              [rId, T4M_R, "no-change"],
              [dRootId, T4M_A_FILE, "unresolved"],
              [nId, T4M_AN, "unresolved"],
              [wId, T4M_AW, "skipped"],
            ] as const
          )
            .map((row) => [...row])
            .sort(),
          `${prefix} post-move \`status\`: same six items, statuses intact, ` +
            `nothing invalidated, the moved file's scopes presented under ` +
            `their current identities (SPEC 10.4, 6.2, 6.5)`,
        );
        assertPrecedes(
          postStatus.items,
          nId,
          mId,
          `${prefix} post-move \`status\`: specs/a.mdx now sorts before ` +
            `specs/b.mdx — item order follows current identities (SPEC 10.5, 10.6)`,
        );
        const postExportLabel = `${prefix} post-move \`review export s --json\``;
        const postExport = decodeExportReport(
          await runJson(
            product,
            workspace,
            ["review", "export", "s", "--json"],
            postExportLabel,
          ),
          postExportLabel,
        );
        assertPrecedes(postExport.items, nId, mId, postExportLabel);
        const nItem = requireItem(postExport.items, nId, postExportLabel);
        const wItem = requireItem(postExport.items, wId, postExportLabel);
        assertRecordedHolds(
          nItem.current,
          nHash,
          "n's recorded subtreeHash (creation-time record)",
          `${postExportLabel} — recorded state intact across the move`,
        );
        assertRecordedHolds(
          wItem.current,
          wHash,
          "w's recorded subtreeHash (resolve-time record)",
          `${postExportLabel} — recorded state intact across the move`,
        );
        if (wItem.scope.node !== T4M_AW || wItem.scope.present !== true) {
          fail(
            `${postExportLabel}: w's item presents its scope under the ` +
              `current identity (SPEC 10.4); expected {node: ` +
              `${JSON.stringify(T4M_AW)}, present: true}, got ` +
              JSON.stringify(wItem.scope),
          );
        }
        const postNextLabel = `${prefix} post-move \`review next s --json\``;
        const postNext = decodeNextReport(
          await runJson(
            product,
            workspace,
            ["review", "next", "s", "--json"],
            postNextLabel,
          ),
          postNextLabel,
        );
        if (postNext.fullyResolved || postNext.item === undefined) {
          fail(`${postNextLabel}: unresolved items remain (SPEC 10.7)`);
        }
        if (postNext.item.id !== nId) {
          fail(
            `${postNextLabel}: the flip shows in \`next\` too — specs/a.mdx ` +
              `now sorts first, so n's item leads (SPEC 10.5, 10.6, 10.7); ` +
              `expected ${nId}, got ${postNext.item.id}`,
          );
        }
      },
    );

    // --- reintroduction arm ---------------------------------------------------
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [T4I_FILE]: T4I_SOURCE },
      async (workspace) => {
        const prefix = "T10.4-4 reintroduction arm";
        await buildOk(product, workspace, `${prefix} \`build\``);
        await expectExit(
          product,
          workspace,
          ["review", "create", "--strategy", "audit", "--name", "s"],
          0,
          `${prefix} \`review create --strategy audit --name s\``,
        );
        const status = await sessionStatus(product, workspace, "s", prefix);
        const rootId = requireRow(
          status,
          "subtree-coherence",
          T4I_ROOT,
          prefix,
        ).id;
        const aId = requireRow(status, "subtree-coherence", T4I_A, prefix).id;
        const sId = requireRow(status, "subtree-coherence", T4I_S, prefix).id;

        await resolveOk(
          product,
          workspace,
          "s",
          aId,
          "no-change",
          `${prefix} resolve of a's item`,
        );
        await expectExit(
          product,
          workspace,
          ["rename", T4I_FILE, "a", "b"],
          0,
          `${prefix} \`rename specs/E.mdx a b\``,
        );

        // Author a new top-level leaf section `a` — appended to what the
        // rename left on disk, so the reintroduced identity starts a new
        // canonical chain after the journal entry that vacated it (SPEC 5.4).
        // The bytes are the product's, so the append is an `edit()` extending
        // the file's tail — s's closing run, which the rename's minimal
        // in-place edits leave as the file's end (SPEC 6.4) — its uniqueness
        // and end position diagnosed first (H-8).
        const renamed = Buffer.from(
          await workspace.readBytes(T4I_FILE),
        ).toString("utf8");
        const appendContext = `${prefix} appending the new section a after the rename-rewritten s`;
        anchorOnce(renamed, T4I_TAIL, appendContext);
        if (!renamed.endsWith(T4I_TAIL)) {
          fail(
            `${appendContext}: expected the rewritten source to end with ` +
              `${JSON.stringify(T4I_TAIL)} (SPEC 6.4: minimal in-place edits ` +
              `leave the file's tail in place); source: ` +
              JSON.stringify(renamed),
          );
        }
        await workspace.edit(T4I_FILE, T4I_TAIL, T4I_TAIL + T4I_NEW_SECTION);
        await buildOk(
          product,
          workspace,
          `${prefix} \`build\` after authoring the new section a`,
        );

        // Premises before the re-derivation: still three items — new items
        // enter only through re-derivation (SPEC 10.5) — the resolved item
        // presented under scope b, and the root blocked by exactly the two
        // recorded child items.
        const beforeRederive = await sessionStatus(
          product,
          workspace,
          "s",
          `${prefix} before the updated-resolve`,
        );
        assertSameJson(
          beforeRederive.items
            .map((row) => [row.id, row.scope, row.status])
            .sort(),
          (
            [
              [rootId, T4I_ROOT, "unresolved"],
              [aId, T4I_B, "no-change"],
              [sId, T4I_S, "unresolved"],
            ] as const
          )
            .map((row) => [...row])
            .sort(),
          `${prefix} before the updated-resolve: three items — the rename ` +
            `maps a's item to scope b without invalidating it, and new-a has ` +
            `no item yet (sibling subtrees enter only through re-derivation, ` +
            `SPEC 10.4, 10.5)`,
        );
        const rootBefore = await showItem(
          product,
          workspace,
          "s",
          rootId,
          `${prefix} root item before the updated-resolve`,
        );
        assertSameJson(
          [...rootBefore.blockedBy].sort(),
          [aId, sId].sort(),
          `${prefix}: the root item's blockedBy is still its recorded child ` +
            `items — blockedBy is recomputed only at re-derivation (SPEC 10.5, 10.6)`,
        );

        // The re-derivation: resolve s's item `updated` (SPEC 10.5, 10.6).
        await resolveOk(
          product,
          workspace,
          "s",
          sId,
          "updated",
          `${prefix} \`review resolve s <s item> --status updated\` — re-derivation`,
        );

        const after = await sessionStatus(
          product,
          workspace,
          "s",
          `${prefix} after the updated-resolve`,
        );
        // The recorded-against-old-a item keeps its id and resolved status,
        // presented under scope b; new-a's item is a distinct unresolved
        // item. A product matching by walked-back identity string collapses
        // both bearers onto `a` and loses one of these rows.
        const bRow = requireRow(
          after,
          "subtree-coherence",
          T4I_B,
          `${prefix} after the updated-resolve`,
        );
        const newARow = requireRow(
          after,
          "subtree-coherence",
          T4I_A,
          `${prefix} after the updated-resolve`,
        );
        if (bRow.id !== aId || bRow.status !== "no-change") {
          fail(
            `${prefix}: the item recorded against old-a keeps its id and ` +
              `resolved status, presented under scope b (SPEC 5.4, 10.4, ` +
              `10.5); expected id ${aId} with status no-change, got id ` +
              `${bRow.id} with status ${bRow.status}`,
          );
        }
        if ([rootId, aId, sId].includes(newARow.id)) {
          fail(
            `${prefix}: new-a's item enters as a distinct item (SPEC 5.4: ` +
              `the reintroduced identity starts a new canonical chain, so ` +
              `the two bearers never match); got the existing id ${newARow.id}`,
          );
        }
        if (newARow.status !== "unresolved") {
          fail(
            `${prefix}: new-a's item is created unresolved (SPEC 10.2); got ` +
              newARow.status,
          );
        }
        assertSameJson(
          after.items.map((row) => [row.id, row.scope, row.status]).sort(),
          (
            [
              [rootId, T4I_ROOT, "unresolved"],
              [aId, T4I_B, "no-change"],
              [sId, T4I_S, "updated"],
              [newARow.id, T4I_A, "unresolved"],
            ] as const
          )
            .map((row) => [...row])
            .sort(),
          `${prefix} after the updated-resolve: exactly four items — no ` +
            `duplicates, no lost statuses (SPEC 10.4, 10.5)`,
        );
        const rootAfter = await showItem(
          product,
          workspace,
          "s",
          rootId,
          `${prefix} root item after the updated-resolve`,
        );
        assertSameJson(
          [...rootAfter.blockedBy].sort(),
          [aId, sId, newARow.id].sort(),
          `${prefix}: the root item's recomputed blockedBy gains new-a's ` +
            `item (SPEC 10.5, 10.6)`,
        );
      },
    );

    // --- decomposition arm ------------------------------------------------------
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [T4D_FILE]: T4D_SOURCE },
      async (workspace) => {
        const prefix = "T10.4-4 decomposition arm";
        await buildOk(product, workspace, `${prefix} \`build\``);
        await expectExit(
          product,
          workspace,
          ["review", "create", "--strategy", "audit", "--name", "s"],
          0,
          `${prefix} \`review create --strategy audit --name s\``,
        );
        const created = await sessionStatus(product, workspace, "s", prefix);
        assertSameJson(
          kindScopeSet(created),
          [
            `subtree-coherence ${T4D_ROOT}`,
            `subtree-coherence ${T4D_A}`,
            `subtree-coherence ${T4D_AX}`,
            `subtree-coherence ${T4D_S}`,
          ].sort(),
          `${prefix}: audit creates one item per node (SPEC 10.6)`,
        );
        const rootId = requireRow(
          created,
          "subtree-coherence",
          T4D_ROOT,
          prefix,
        ).id;
        const aId = requireRow(created, "subtree-coherence", T4D_A, prefix).id;
        const axId = requireRow(
          created,
          "subtree-coherence",
          T4D_AX,
          prefix,
        ).id;
        const sId = requireRow(created, "subtree-coherence", T4D_S, prefix).id;

        // Split a's item (SPEC 10.7): a.x's item reused, a's
        // parent-consistency item created, the decomposition recorded —
        // staging premises, read from `status` and `export`.
        await expectExit(
          product,
          workspace,
          ["review", "split", "s", aId],
          0,
          `${prefix} \`review split s <a's item>\``,
        );
        const splitContext = `${prefix} after the split`;
        const afterSplit = await sessionStatus(
          product,
          workspace,
          "s",
          splitContext,
        );
        const pcId = requireRow(
          afterSplit,
          "parent-consistency",
          T4D_A,
          splitContext,
        ).id;
        if ([rootId, aId, axId, sId].includes(pcId)) {
          fail(
            `${splitContext}: staging premise — a's parent-consistency item ` +
              `enters as a new item (SPEC 10.7: the split original's id is ` +
              `never reused); got the existing id ${pcId}`,
          );
        }
        assertSameJson(
          statusRowTuples(afterSplit),
          [
            [rootId, "subtree-coherence", T4D_ROOT, "unresolved"],
            [pcId, "parent-consistency", T4D_A, "unresolved"],
            [axId, "subtree-coherence", T4D_AX, "unresolved"],
            [sId, "subtree-coherence", T4D_S, "unresolved"],
          ].sort(),
          `${splitContext}: staging premise — the split replaced a's ` +
            `subtree-coherence item by a.x's item, reused, and a's new ` +
            `parent-consistency item (SPEC 10.7)`,
        );
        assertT4dSoleDecomposition(
          await exportSession(product, workspace, "s", splitContext),
          T4D_A,
          `${splitContext} (staging premise)`,
        );

        // Distinct resolved statuses on the decomposition's two items, so
        // that keeping them is discriminating: a.x's item (a leaf,
        // unblocked), then a's parent-consistency item, unblocked once its
        // one blocker resolved (SPEC 10.3, 10.7).
        await resolveOk(
          product,
          workspace,
          "s",
          axId,
          "no-change",
          `${prefix} resolve of a.x's item`,
        );
        await resolveOk(
          product,
          workspace,
          "s",
          pcId,
          "skipped",
          `${prefix} resolve of a's parent-consistency item (unblocked once ` +
            `a.x's resolved)`,
        );

        // The rename, with its purity premise (SPEC 6.2: every hash
        // byte-identical under the new identities), so no status asserted
        // below turns on a hash.
        const aHashes = (
          await queryNode(product, workspace, T4D_A, `${prefix} pre-rename`)
        ).hashes;
        const axHashes = (
          await queryNode(product, workspace, T4D_AX, `${prefix} pre-rename`)
        ).hashes;
        await expectExit(
          product,
          workspace,
          ["rename", T4D_FILE, "a", "b"],
          0,
          `${prefix} \`rename specs/F.mdx a b\` (SPEC 6.4)`,
        );
        const bHashes = (
          await queryNode(product, workspace, T4D_B, `${prefix} post-rename`)
        ).hashes;
        const bxHashes = (
          await queryNode(product, workspace, T4D_BX, `${prefix} post-rename`)
        ).hashes;
        assertSameJson(
          [bHashes, bxHashes],
          [aHashes, axHashes],
          `${prefix}: cross-check with SPEC 6.2 — \`rename\` is pure and ` +
            `leaves every hash byte-identical: b's and b.x's hashes are a's ` +
            `and a.x's`,
        );

        // The first re-derivation: resolve s's item `updated` (SPEC 10.5).
        await resolveOk(
          product,
          workspace,
          "s",
          sId,
          "updated",
          `${prefix} \`review resolve s <s item> --status updated\` — ` +
            `re-derivation`,
        );
        const firstContext = `${prefix} after the first updated-resolve`;
        const afterFirst = await sessionStatus(
          product,
          workspace,
          "s",
          firstContext,
        );
        assertT4dNoItemAtB(afterFirst, firstContext);
        const keptRows = [
          [rootId, "subtree-coherence", T4D_ROOT, "unresolved"],
          [pcId, "parent-consistency", T4D_B, "skipped"],
          [axId, "subtree-coherence", T4D_BX, "no-change"],
          [sId, "subtree-coherence", T4D_S, "updated"],
        ];
        assertSameJson(
          statusRowTuples(afterFirst),
          [...keptRows].sort(),
          `${firstContext}: exactly the four items — the decomposition's ` +
            `items, b.x's and b's parent-consistency item, keep their ids ` +
            `and statuses, presented under the current identities, nothing ` +
            `invalidated by the identity mapping (SPEC 10.4, 10.5, 10.7)`,
        );
        const firstExport = await exportSession(
          product,
          workspace,
          "s",
          firstContext,
        );
        assertT4dSoleDecomposition(firstExport, T4D_B, firstContext);
        assertT4dDecompositionItems(firstExport, axId, pcId, firstContext);
        const rootBlockers = [axId, pcId, sId].sort();
        assertSameJson(
          [
            ...requireItem(firstExport.items, rootId, firstContext).blockedBy,
          ].sort(),
          rootBlockers,
          `${firstContext}: the root item's recomputed blockedBy is its ` +
            `child sections' items, b's replaced by all items of its ` +
            `decomposition (SPEC 10.5, 10.6)`,
        );

        // Author a new top-level leaf section `a`, appended to what the
        // rename left on disk — a new canonical chain after the journal
        // entry that vacated the identity (SPEC 5.4) — through an anchored
        // `edit()` of the product's bytes, the tail's uniqueness and end
        // position diagnosed first (SPEC 6.4; H-8).
        const renamed = Buffer.from(
          await workspace.readBytes(T4D_FILE),
        ).toString("utf8");
        const appendContext = `${prefix} appending the new section a after the rename-rewritten s`;
        anchorOnce(renamed, T4D_TAIL, appendContext);
        if (!renamed.endsWith(T4D_TAIL)) {
          fail(
            `${appendContext}: expected the rewritten source to end with ` +
              `${JSON.stringify(T4D_TAIL)} (SPEC 6.4: minimal in-place edits ` +
              `leave the file's tail in place); source: ` +
              JSON.stringify(renamed),
          );
        }
        await workspace.edit(T4D_FILE, T4D_TAIL, T4D_TAIL + T4D_NEW_SECTION);
        await buildOk(
          product,
          workspace,
          `${prefix} \`build\` after authoring the new section a`,
        );
        const premiseContext = `${prefix} before the second updated-resolve`;
        assertSameJson(
          statusRowTuples(
            await sessionStatus(product, workspace, "s", premiseContext),
          ),
          [...keptRows].sort(),
          `${premiseContext}: staging premise — still the four items, ` +
            `statuses unchanged: new items enter only through re-derivation ` +
            `(SPEC 10.5), and authoring a changes no recorded state of the ` +
            `four (SPEC 10.4)`,
        );

        // The second re-derivation: resolve s's item `updated` again.
        await resolveOk(
          product,
          workspace,
          "s",
          sId,
          "updated",
          `${prefix} second \`review resolve s <s item> --status updated\` — ` +
            `re-derivation`,
        );
        const secondContext = `${prefix} after the second updated-resolve`;
        const afterSecond = await sessionStatus(
          product,
          workspace,
          "s",
          secondContext,
        );
        const newARows = afterSecond.items.filter(
          (row) => row.kind === "subtree-coherence" && row.scope === T4D_A,
        );
        if (newARows.length !== 1) {
          fail(
            `${secondContext}: new-a's subtree-coherence item enters at the ` +
              `re-derivation, exactly one item scoped at a — the ` +
              `decomposition recorded against old-a never applies to new-a, ` +
              `a distinct canonical identity (SPEC 5.4, 10.4, 10.5); a ` +
              `product matching decompositions by spelling withholds it; ` +
              `found ${String(newARows.length)} among ` +
              JSON.stringify(
                afterSecond.items.map((row) => `${row.kind} ${row.scope}`),
              ),
          );
        }
        const newARow = newARows[0];
        if ([rootId, aId, axId, pcId, sId].includes(newARow.id)) {
          fail(
            `${secondContext}: new-a's item enters as a distinct item (SPEC ` +
              `5.4: the reintroduced identity starts a new canonical chain; ` +
              `10.7: the split original's id is never reused); got the ` +
              `existing id ${newARow.id}`,
          );
        }
        if (newARow.status !== "unresolved") {
          fail(
            `${secondContext}: new-a's item is created unresolved (SPEC ` +
              `10.2); got ${newARow.status}`,
          );
        }
        assertT4dNoItemAtB(afterSecond, secondContext);
        assertSameJson(
          statusRowTuples(afterSecond),
          [
            ...keptRows,
            [newARow.id, "subtree-coherence", T4D_A, "unresolved"],
          ].sort(),
          `${secondContext}: exactly five items — the four as they were, ` +
            `plus new-a's (SPEC 10.4, 10.5)`,
        );
        const secondExport = await exportSession(
          product,
          workspace,
          "s",
          secondContext,
        );
        assertT4dSoleDecomposition(secondExport, T4D_B, secondContext);
        assertSameJson(
          [
            ...requireItem(secondExport.items, rootId, secondContext).blockedBy,
          ].sort(),
          [...rootBlockers, newARow.id].sort(),
          `${secondContext}: the root item's recomputed blockedBy gains ` +
            `new-a's item (SPEC 10.5, 10.6)`,
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T10.4-5 — reads never write
// ---------------------------------------------------------------------------

const T5_FILE = "specs/W.mdx";
const T5_X = "specs/W.mdx#x";
const T5_ROOT = "specs/W.mdx";
const T5_Y = "specs/W.mdx#y";
const T5_SESSION_FILE = ".xspec/reviews/s.json";

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
  ].join("\n");
}

// T10.4-5's staleness edit — staged after the body's first `build` — is a
// staged-source record (helpers/staged-mdx.ts, S-9: judged before any
// product exists).
const T10_4_5_X_EDITED = stagedMdx(
  "T10.4-5 specs/W.mdx with the resolved scope node x at v1 (the staleness edit)",
  t5Spec("Ex text v1."),
);

const T10_4_5 = defineProductTest({
  id: "T10.4-5",
  title:
    "reads never write: with a stale resolution in an audit session (the resolved scope node edited and rebuilt), `status`, `next`, `show`, and `export` each report the item `invalidated` while leaving the session file byte-identical — read-time invalidation is computed and reported, never persisted, as those byte-compares alone observe — and the stored status and record are rewritten only by a mutating subcommand, whose `resolve` changes the session file's bytes and cures the staleness (SPEC 10.1, 10.4, 10.7)",
  run: async (product) => {
    // Staged within CONF-CORE's scope (CERTIFICATIONS.md): one importless
    // spec group, no tags/d/embeddings, no git, an audit-strategy session.
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [T5_FILE]: t5Spec("Ex text v0.") },
      async (workspace) => {
        await buildOk(product, workspace, "T10.4-5 `build`");
        await expectExit(
          product,
          workspace,
          ["review", "create", "--strategy", "audit", "--name", "s"],
          0,
          "T10.4-5 `review create --strategy audit --name s`",
        );
        const status = await sessionStatus(product, workspace, "s", "T10.4-5");
        assertSameJson(
          kindScopeSet(status),
          [
            `subtree-coherence ${T5_ROOT}`,
            `subtree-coherence ${T5_X}`,
            `subtree-coherence ${T5_Y}`,
          ].sort(),
          "T10.4-5: audit creates one item per node (SPEC 10.6)",
        );
        const xId = requireRow(status, "subtree-coherence", T5_X, "T10.4-5").id;
        await resolveOk(
          product,
          workspace,
          "s",
          xId,
          "no-change",
          "T10.4-5 `review resolve s <x item> --status no-change`",
        );

        // The staleness: edit the resolved scope node and rebuild, so every
        // subsequent read computes and reports invalidation (SPEC 10.4).
        await workspace.file(T5_FILE, T10_4_5_X_EDITED);
        await buildOk(product, workspace, "T10.4-5 `build` after the x edit");

        /** Run one read; assert the session file's bytes did not move. */
        const readLeavesSessionUntouched = async (
          argv: readonly string[],
          label: string,
        ): Promise<unknown> => {
          const before = await workspace.readBytes(T5_SESSION_FILE);
          const doc = await runJson(product, workspace, argv, label);
          const after = await workspace.readBytes(T5_SESSION_FILE);
          assertBytesEqual(
            after,
            before,
            `${label} — the read computed and reported invalidation yet ` +
              `must leave the session file byte-identical: read-time ` +
              `invalidation is never persisted (SPEC 10.4)`,
          );
          return doc;
        };

        // `status`: the stale resolution reports invalidated; totals apply
        // read-time invalidation.
        const statusLabel = "T10.4-5 `review status s --json`";
        const staleStatus = decodeSessionStatusReport(
          await readLeavesSessionUntouched(
            ["review", "status", "s", "--json"],
            statusLabel,
          ),
          statusLabel,
        );
        const staleRow = requireRowById(staleStatus, xId, statusLabel);
        if (staleRow.status !== "invalidated") {
          fail(
            `${statusLabel}: a stale resolution is never reported as ` +
              `resolved — the item is reported invalidated on read ` +
              `(SPEC 10.4); got ${staleRow.status}`,
          );
        }
        assertTotals(
          staleStatus,
          {
            unresolved: 2,
            invalidated: 1,
            updated: 0,
            "no-change": 0,
            skipped: 0,
          },
          statusLabel,
        );

        // `next`: the invalidated item needs review and leads (x precedes y
        // in document order; the root item is blocked, SPEC 10.6).
        const nextLabel = "T10.4-5 `review next s --json`";
        const next = decodeNextReport(
          await readLeavesSessionUntouched(
            ["review", "next", "s", "--json"],
            nextLabel,
          ),
          nextLabel,
        );
        if (next.fullyResolved || next.item === undefined) {
          fail(
            `${nextLabel}: the invalidated item needs review (SPEC 10.3, 10.4)`,
          );
        }
        if (next.item.id !== xId || next.item.status !== "invalidated") {
          fail(
            `${nextLabel}: expected the x item reported invalidated ` +
              `(SPEC 10.4, 10.6, 10.7); got ${next.item.id} with status ` +
              next.item.status,
          );
        }

        // `show`: same report, same byte-identity.
        const showLabel = "T10.4-5 `review show s <x item> --json`";
        const shown = decodeItemReport(
          await readLeavesSessionUntouched(
            ["review", "show", "s", xId, "--json"],
            showLabel,
          ),
          showLabel,
        );
        if (shown.status !== "invalidated") {
          fail(
            `${showLabel}: the stale resolution is reported invalidated ` +
              `(SPEC 10.4); got ${shown.status}`,
          );
        }

        // `export`: read-time invalidation applied, nothing persisted.
        const exportLabel = "T10.4-5 `review export s --json`";
        const exported = decodeExportReport(
          await readLeavesSessionUntouched(
            ["review", "export", "s", "--json"],
            exportLabel,
          ),
          exportLabel,
        );
        const exportedItem = requireItem(exported.items, xId, exportLabel);
        if (exportedItem.status !== "invalidated") {
          fail(
            `${exportLabel}: export applies read-time invalidation ` +
              `(SPEC 10.4, 10.7); got ${exportedItem.status}`,
          );
        }

        // The four byte-compares above are the one observation that the reads
        // rewrote nothing (CERTIFICATIONS.md §VIOL-CORE-PERSISTREADS, a
        // staging constraint): once a read has computed invalidation, nothing
        // here reads the stored statuses while that resolution stands — no
        // `review list` runs, its counts reading stored statuses (SPEC 10.7),
        // and the staleness is never undone, so no later answer or blocked
        // state turns on the stored status. A product persisting read-time
        // invalidation thus fails this test at a read's byte-compare alone.

        // The stored status is rewritten only by mutating subcommands: a
        // `resolve` re-records the current relevant state — the session
        // file's bytes change and the staleness is cured.
        const beforeResolve = await workspace.readBytes(T5_SESSION_FILE);
        await resolveOk(
          product,
          workspace,
          "s",
          xId,
          "no-change",
          "T10.4-5 `review resolve s <x item> --status no-change` — the " +
            "mutating subcommand that rewrites the stored state (SPEC 10.4)",
        );
        const afterResolve = await workspace.readBytes(T5_SESSION_FILE);
        if (bytesEqual(afterResolve, beforeResolve)) {
          fail(
            "T10.4-5: the mutating `resolve` records the current relevant " +
              "state over the stale record (SPEC 10.4, 10.7), so the " +
              "session file's bytes must change — they are byte-identical",
          );
        }
        await expectItemStatus(
          product,
          workspace,
          "s",
          xId,
          "no-change",
          "T10.4-5 after the mutating resolve — the freshly recorded state " +
            "matches the graph, so the read reports the stored resolved " +
            "status again (SPEC 10.4)",
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T10.4-6 — context as last assigned
// ---------------------------------------------------------------------------

// Path-blocks fixture — TEST-SPEC's X, T1, T2, U1, and U2 as the top-level
// sections x, t1, t2, u1, and u2 of one file: x's `d` names t1 and t2, t1
// depends on u1 and t2 on u2 (local references, SPEC 2.2). u1's text is
// edited before `create --base`: u1 is `changed`, t1 and x
// `upstream-changed` (5.6), so the session holds u1's subtree-coherence item
// and the dependency-consistency items of t1 and of x — x's context {t1},
// the one dependency-edge target of x whose effectiveHash changed (10.5).
// u2's text is edited after it, with no re-derivation: t2's effectiveHash
// changes too, so the generators' context set for x's item becomes
// {t1, t2}, while no hash x's item records changes — x's ownHash and
// metadataHash and each target's subtreeHash (10.4). Reverting both edits
// restores the baseline bytes: no target's effectiveHash differs from the
// baseline, and the generators no longer produce x's item, whose current
// context set is then its `context` as last assigned (10.4). The hash
// premises are checked via `query node` at every state, against a capture
// at the baseline. (a) assigns the context at a resolve, after u2's edit;
// (b), on a twin, resolves x's item before u2's edit and assigns the context
// through the re-derivation of u1's `updated` resolve (10.5), which also
// assigns `reason` — compared byte for byte between captures from the same
// surface, its composition unpinned (10.2).
const T6_FILE = "specs/G.mdx";
const T6_X = "specs/G.mdx#x";
const T6_T1 = "specs/G.mdx#t1";
const T6_T2 = "specs/G.mdx#t2";
const T6_U1 = "specs/G.mdx#u1";

function t6Spec(u1Text: string, u2Text: string): string {
  return [
    '<S id="x" d={["t1", "t2"]}>',
    "Ex own text.",
    "</S>",
    "",
    '<S id="t1" d={"u1"}>',
    "Tee one text.",
    "</S>",
    "",
    '<S id="t2" d={"u2"}>',
    "Tee two text.",
    "</S>",
    "",
    '<S id="u1">',
    u1Text,
    "</S>",
    "",
    '<S id="u2">',
    u2Text,
    "</S>",
    "",
  ].join("\n");
}

// T10.4-6's states staged after the body's first `build` — u1's edit, u2's
// edit, (b)'s first revert (u1's), and the baseline bytes both reverts
// restore, which are also the twin's initial source — are staged-source
// records (helpers/staged-mdx.ts, S-9: judged before any product exists);
// (a)'s workspace's initial source precedes every invocation and stays
// plain.
const T10_4_6_BASELINE = stagedMdx(
  "T10.4-6 specs/G.mdx with u1 and u2 at v0 (the baseline bytes both reverts restore; the twin's initial source)",
  t6Spec("You one text v0.", "You two text v0."),
);
const T10_4_6_U1_EDITED = stagedMdx(
  "T10.4-6 specs/G.mdx with u1 at v1 (the edit before `create --base`)",
  t6Spec("You one text v1.", "You two text v0."),
);
const T10_4_6_U2_EDITED = stagedMdx(
  "T10.4-6 specs/G.mdx with u1 and u2 at v1 (u2's edit after `create --base`)",
  t6Spec("You one text v1.", "You two text v1."),
);
const T10_4_6_U1_REVERTED = stagedMdx(
  "T10.4-6 specs/G.mdx with u1 reverted to v0 and u2 still at v1 ((b)'s first revert)",
  t6Spec("You one text v0.", "You two text v1."),
);

/** Which of T10.4-6's two upstream edits stand at a staged state. */
interface T6Edits {
  readonly u1: boolean;
  readonly u2: boolean;
}

/** x's, t1's, and t2's hashes, captured via `query node` (SPEC 5.5). */
async function t6Capture(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
): Promise<ReadonlyMap<string, NodeHashes>> {
  return await captureHashes(product, workspace, [T6_X, T6_T1, T6_T2], context);
}

/**
 * T10.4-6's hash premises at one state, against the capture at the baseline
 * (SPEC 5.5): x's ownHash and metadataHash and t1's and t2's subtreeHash —
 * every hash x's item records, whichever targets its context holds (10.4) —
 * keep their baseline values, and t1's and t2's effectiveHash differ from
 * theirs exactly while u1's and u2's edits stand. The generators thus give
 * x's item exactly the targets whose upstream edit stands as its context,
 * and produce no item for x once neither stands (10.5), so no assertion
 * turns on a hash (H-8).
 */
function assertT6HashPremises(
  baseline: ReadonlyMap<string, NodeHashes>,
  current: ReadonlyMap<string, NodeHashes>,
  edits: T6Edits,
  context: string,
): void {
  const value = (
    captures: ReadonlyMap<string, NodeHashes>,
    node: string,
    hash: keyof NodeHashes,
    side: string,
  ): string => {
    const hashes = captures.get(node);
    if (hashes === undefined) {
      fail(
        `${context}: harness staging defect — no ${side} \`query node\` ` +
          `capture exists for ${node}, so its ${hash} premise cannot be ` +
          `checked`,
      );
    }
    return hashes[hash];
  };
  for (const [node, hash] of [
    [T6_X, "ownHash"],
    [T6_X, "metadataHash"],
    [T6_T1, "subtreeHash"],
    [T6_T2, "subtreeHash"],
  ] as const) {
    const before = value(baseline, node, hash, "baseline");
    const now = value(current, node, hash, "current");
    if (before !== now) {
      fail(
        `${context}: staging premise — ${node}'s ${hash} must keep its ` +
          `baseline value (SPEC 5.5): x's item records it (10.4), and only ` +
          `its context set may change; got ${JSON.stringify(before)} -> ` +
          JSON.stringify(now),
      );
    }
  }
  for (const [node, upstream, stands] of [
    [T6_T1, "u1", edits.u1],
    [T6_T2, "u2", edits.u2],
  ] as const) {
    const before = value(baseline, node, "effectiveHash", "baseline");
    const now = value(current, node, "effectiveHash", "current");
    if ((before !== now) !== stands) {
      fail(
        `${context}: staging premise — ${node}'s effectiveHash must ` +
          (stands
            ? `differ from its baseline value while ${upstream}'s edit ` +
              `stands (SPEC 5.5), making ${node} a dependency-edge target ` +
              `of x whose effectiveHash changed (10.5)`
            : `equal its baseline value while ${upstream}'s edit does not ` +
              `stand (SPEC 5.5), so ${node} is no dependency-edge target ` +
              `of x whose effectiveHash changed (10.5)`) +
          `; baseline ${JSON.stringify(before)}, now ${JSON.stringify(now)}`,
      );
    }
  }
}

/** Write one T10.4-6 state, `build` it, and check its hash premises. */
async function t6Stage(
  product: ProductBinding,
  workspace: TestWorkspace,
  baseline: ReadonlyMap<string, NodeHashes>,
  source: StagedMdx,
  edits: T6Edits,
  label: string,
): Promise<void> {
  await workspace.file(T6_FILE, source);
  await buildOk(product, workspace, `${label} \`build\``);
  assertT6HashPremises(
    baseline,
    await t6Capture(product, workspace, `${label} capture`),
    edits,
    label,
  );
}

/** The session T10.4-6's two arms share, and the ids they act on. */
interface T6Session {
  readonly baseline: ReadonlyMap<string, NodeHashes>;
  readonly xId: string;
  readonly u1Id: string;
}

/**
 * Stage T10.4-6's session in a fresh workspace holding the baseline source
 * (SPEC 10.5): the baseline committed, built, and captured; u1's text
 * edited and built; then `review create --base <baseline> --name s`, whose
 * session holds exactly u1's subtree-coherence item and the
 * dependency-consistency items of t1 and of x — x's context exactly {t1}
 * (staging premises from `status` and `show`).
 */
async function t6CreateSession(
  product: ProductBinding,
  workspace: TestWorkspace,
  label: string,
): Promise<T6Session> {
  await workspace.gitInit();
  const base = await workspace.gitCommitAll("baseline");
  await buildOk(product, workspace, `${label} \`build\` at the baseline`);
  const baseline = await t6Capture(
    product,
    workspace,
    `${label} baseline capture`,
  );
  await t6Stage(
    product,
    workspace,
    baseline,
    T10_4_6_U1_EDITED,
    { u1: true, u2: false },
    `${label} after u1's edit`,
  );
  await expectExit(
    product,
    workspace,
    ["review", "create", "--base", base, "--name", "s"],
    0,
    `${label} \`review create --base <baseline> --name s\``,
  );
  const status = await sessionStatus(product, workspace, "s", label);
  assertSameJson(
    kindScopeSet(status),
    [
      `dependency-consistency ${T6_T1}`,
      `dependency-consistency ${T6_X}`,
      `subtree-coherence ${T6_U1}`,
    ].sort(),
    `${label} staging premise: u1's edit yields u1's subtree-coherence ` +
      `item and the dependency-consistency items of t1 (its target u1 ` +
      `changed) and of x (its target t1's effectiveHash changed), and ` +
      `nothing else (SPEC 5.6, 10.5)`,
  );
  const xId = requireRow(status, "dependency-consistency", T6_X, label).id;
  const u1Id = requireRow(status, "subtree-coherence", T6_U1, label).id;
  const created = await showItem(
    product,
    workspace,
    "s",
    xId,
    `${label} after \`create\``,
  );
  assertSameJson(
    identitySet(created.context),
    [T6_T1],
    `${label} staging premise: x's dependency-consistency item's context ` +
      `is exactly {t1}, the one dependency-edge target of x whose ` +
      `effectiveHash changed (SPEC 10.5)`,
  );
  return { baseline, xId, u1Id };
}

/**
 * x's item as `show` or `export` presents it (SPEC 10.4, 10.7): reported
 * `status`, its context exactly `contextNodes`, `why` naming the rule.
 */
function assertT6Presented(
  item: ReviewItem,
  status: ItemStatus,
  contextNodes: readonly string[],
  why: string,
  context: string,
): void {
  if (item.status !== status) {
    fail(
      `${context}: x's item must be reported ${status} — ${why}; got ` +
        item.status,
    );
  }
  assertSameJson(
    identitySet(item.context),
    [...contextNodes].sort(),
    `${context}: x's item's context must be exactly ` +
      `${JSON.stringify(contextNodes)} — ${why}`,
  );
}

/**
 * Read x's item through `status`, `show`, and `export` (SPEC 10.4, 10.7):
 * each must report it `status`, and `show` and `export` present its context
 * as exactly `contextNodes`. Returns the item as `show` and as `export`
 * present it, for the caller's `reason` captures and compares.
 */
async function t6ReadX(
  product: ProductBinding,
  workspace: TestWorkspace,
  xId: string,
  status: ItemStatus,
  contextNodes: readonly string[],
  why: string,
  label: string,
): Promise<{ readonly shown: ReviewItem; readonly exported: ReviewItem }> {
  const report = await sessionStatus(product, workspace, "s", label);
  const statusLabel = `${label} \`review status s --json\``;
  const row = requireRowById(report, xId, statusLabel);
  if (row.status !== status) {
    fail(
      `${statusLabel}: x's item must be reported ${status} — ${why}; got ` +
        row.status,
    );
  }
  const shown = await showItem(product, workspace, "s", xId, label);
  assertT6Presented(
    shown,
    status,
    contextNodes,
    why,
    `${label} \`review show s <x item> --json\``,
  );
  const exportLabel = `${label} \`review export s --json\``;
  const exported = requireItem(
    (await exportSession(product, workspace, "s", label)).items,
    xId,
    exportLabel,
  );
  assertT6Presented(exported, status, contextNodes, why, exportLabel);
  return { shown, exported };
}

/**
 * A surface's `reason` for x's item must be byte-identical to that
 * surface's capture, taken right after u1's `updated` resolve (SPEC 10.4:
 * reads present `reason` as last assigned — here by that re-derivation,
 * 10.5 — whether or not the generators still produce the item; 10.2: its
 * composition unpinned, so it is compared, never read).
 */
function assertT6ReasonAsCaptured(
  presented: string,
  captured: string,
  context: string,
): void {
  if (presented === captured) return;
  fail(
    `${context}: x's item's reason must be presented byte-identical to ` +
      `this surface's capture, taken right after u1's \`updated\` resolve ` +
      `— reads present reason as last assigned, by that re-derivation, ` +
      `whether or not the generators still produce the item (SPEC 10.4, ` +
      `10.5; its composition unpinned, 10.2); a product recomputing reason ` +
      `when the item is read fails wherever its text reflects the reverted ` +
      `graph. Captured: ${JSON.stringify(captured)}; presented: ` +
      JSON.stringify(presented),
  );
}

const T10_4_6 = defineProductTest({
  id: "T10.4-6",
  title:
    "context as last assigned: for an item the generators no longer produce, reads present its `context` as last assigned — by `create`, a re-derivation, a `split`, or a resolve — and a resolve assigns the item its current context set as `context` — path-blocks fixture: X's `d` names T1 and T2, T1 depends on U1 and T2 on U2, U1's text edited before `create --base` (X's dependency-consistency item: context {T1}) and U2's after it, with no re-derivation, X's ownHash and metadataHash and T1's and T2's subtreeHash never changing and T1's and T2's effectiveHash differing from the baseline exactly while U1's and U2's edits stand (premises via `query node` at every state); (a) X's item resolved `no-change` reads `no-change` in `status`, `show`, and `export`, `show` and `export` presenting its context as exactly {T1, T2}, and still does once both upstream edits are reverted and the generators no longer produce it; (b) on a twin, X's item resolved `no-change` before U2's edit (context {T1}), then U1's subtree-coherence item resolved `updated` after it — the re-derivation assigning X's item context {T1, T2} — X's item reads `invalidated`, context {T1, T2}, and once both upstream edits are reverted, one at a time, it still reads `invalidated` with context exactly {T1, T2}, never its recorded context set {T1}; its `reason`, captured from `show` and from `export` right after the `updated` resolve, is presented byte-identical by each surface after each revert, its composition unasserted (SPEC 5.5, 5.6, 10.2, 10.4, 10.5)",
  run: async (product) => {
    // (a) Resolve assignment.
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [T6_FILE]: t6Spec("You one text v0.", "You two text v0.") },
      async (workspace) => {
        const label = "T10.4-6 (a)";
        const { baseline, xId } = await t6CreateSession(
          product,
          workspace,
          label,
        );
        await t6Stage(
          product,
          workspace,
          baseline,
          T10_4_6_U2_EDITED,
          { u1: true, u2: true },
          `${label} after u2's edit`,
        );
        await resolveOk(
          product,
          workspace,
          "s",
          xId,
          "no-change",
          `${label} resolve of x's item --status no-change after u2's edit ` +
            `(no re-derivation, SPEC 10.5)`,
        );
        await t6ReadX(
          product,
          workspace,
          xId,
          "no-change",
          [T6_T1, T6_T2],
          "the resolve assigned the item its current context set, {t1, t2} " +
            "— the generators' since u2's edit — as its `context`, and " +
            "recorded the same set as its recorded context set (SPEC 10.4); " +
            "a product that never assigns context at a resolve presents " +
            "{t1} or reads invalidated",
          `${label} after x's resolve`,
        );
        // Both upstream edits reverted at once: the generators no longer
        // produce x's item.
        await t6Stage(
          product,
          workspace,
          baseline,
          T10_4_6_BASELINE,
          { u1: false, u2: false },
          `${label} after both reverts`,
        );
        await t6ReadX(
          product,
          workspace,
          xId,
          "no-change",
          [T6_T1, T6_T2],
          "the generators no longer produce x's item, so its current " +
            "context set is its `context` as last assigned — by the " +
            "resolve, {t1, t2}, which is its recorded context set — and no " +
            "recorded hash or presence changed (SPEC 10.4); a product that " +
            "never assigns context at a resolve presents {t1} or reads " +
            "invalidated",
          `${label} after both reverts`,
        );
      },
    );

    // (b) Re-derivation assignment, on a twin.
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [T6_FILE]: T10_4_6_BASELINE },
      async (workspace) => {
        const label = "T10.4-6 (b)";
        const { baseline, xId, u1Id } = await t6CreateSession(
          product,
          workspace,
          label,
        );
        await resolveOk(
          product,
          workspace,
          "s",
          xId,
          "no-change",
          `${label} resolve of x's item --status no-change before u2's edit`,
        );
        const resolved = await showItem(
          product,
          workspace,
          "s",
          xId,
          `${label} after x's resolve`,
        );
        assertT6Presented(
          resolved,
          "no-change",
          [T6_T1],
          "staging premise: the resolve assigned and recorded x's current " +
            "context set, {t1} (SPEC 10.4)",
          `${label} after x's resolve \`review show s <x item> --json\``,
        );
        await t6Stage(
          product,
          workspace,
          baseline,
          T10_4_6_U2_EDITED,
          { u1: true, u2: true },
          `${label} after u2's edit`,
        );
        await resolveOk(
          product,
          workspace,
          "s",
          u1Id,
          "updated",
          `${label} resolve of u1's subtree-coherence item --status updated ` +
            `(the re-derivation, SPEC 10.5)`,
        );
        const { shown, exported } = await t6ReadX(
          product,
          workspace,
          xId,
          "invalidated",
          [T6_T1, T6_T2],
          "u1's `updated` resolve re-derived the session, the matched x " +
            "item taking the generated context {t1, t2} and keeping its " +
            "recorded state (SPEC 10.5), so its current context set {t1, t2} " +
            "differs from its recorded context set {t1} (SPEC 10.4)",
          `${label} after u1's \`updated\` resolve`,
        );
        const shownReason = shown.reason;
        const exportedReason = exported.reason;

        // The reverts, one at a time: u1's (x's item still generated, its
        // context set {t2}), then u2's (x's item no longer generated).
        const u1Label = `${label} after u1's revert`;
        await t6Stage(
          product,
          workspace,
          baseline,
          T10_4_6_U1_REVERTED,
          { u1: false, u2: true },
          u1Label,
        );
        assertT6ReasonAsCaptured(
          (await showItem(product, workspace, "s", xId, u1Label)).reason,
          shownReason,
          `${u1Label} \`review show s <x item> --json\``,
        );
        assertT6ReasonAsCaptured(
          requireItem(
            (await exportSession(product, workspace, "s", u1Label)).items,
            xId,
            `${u1Label} \`review export s --json\``,
          ).reason,
          exportedReason,
          `${u1Label} \`review export s --json\``,
        );

        const bothLabel = `${label} after both reverts`;
        await t6Stage(
          product,
          workspace,
          baseline,
          T10_4_6_BASELINE,
          { u1: false, u2: false },
          bothLabel,
        );
        const reverted = await t6ReadX(
          product,
          workspace,
          xId,
          "invalidated",
          [T6_T1, T6_T2],
          "the generators no longer produce x's item, so its current " +
            "context set is its `context` as last assigned — by the " +
            "re-derivation, {t1, t2} — which differs from its recorded " +
            "context set {t1} (SPEC 10.4); a product presenting the " +
            "recorded context set shows {t1}, reading no-change",
          bothLabel,
        );
        assertT6ReasonAsCaptured(
          reverted.shown.reason,
          shownReason,
          `${bothLabel} \`review show s <x item> --json\``,
        );
        assertT6ReasonAsCaptured(
          reverted.exported.reason,
          exportedReason,
          `${bothLabel} \`review export s --json\``,
        );
      },
    );
  },
});

/** TEST-SPEC §10.4, in canonical ID order (SUITE-35). */
export const section104Tests: readonly ProductTestEntry[] = [
  T10_4_1,
  T10_4_2,
  T10_4_3,
  T10_4_4,
  T10_4_5,
  T10_4_6,
];
