// TEST-SPEC §13.3 (graph data) — SUITE-46: T13.3-1 (serving reads),
// T13.3-2 (refresh), T13.3-3 (failed refresh), T13.3-4 (determinism).
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), decodes output through the H-3 adapters,
// and rejects a product only via diagnosed assertion failures (H-8). Graph
// data content is opaque (H-4): these tests assert only its stated observable
// contract — location under `.xspec/`, the refresh/failure/staleness
// behaviors, and byte determinism — and byte-compare it only against the
// product's own output for identical input (the H-4 self-comparison carve-out).
//
// Operational definitions and conservative choices (noted per H-3/H-4):
// - "The graph data", operationally (T13.3-2, binding here and for T13.4-3):
//   every path under `.xspec/` except the durable `.xspec/journal` and
//   `.xspec/reviews/` (SPEC 13.4). Tests only ever remove or compare it whole.
// - "Rewritten as `build` would write it" is asserted as byte equality
//   against graph data an actual `build` of the identical workspace state
//   wrote (12.0/13.3 byte determinism makes that reference exact). The
//   reference build runs *after* all durable staging (session creation and
//   resolves), so the compare never conflates refresh output with any
//   build-input difference. In the source-edit arm the staged edit keeps the
//   generated file set identical (content-only edits to one existing source),
//   so "recorded derived-file paths are left unchanged" cannot make a
//   conforming refresh's bytes differ from the reference build's; the
//   record-survival clause itself is asserted behaviorally in the
//   set-changing sub-arm (delete a source; the refresh leaves the stale
//   module in place, `check` reports 14.10 against the recorded orphan, and
//   the next `build` removes it — removal is possible only if the refresh
//   left the recorded paths unchanged, SPEC 13.3/13.4/12.1). In that
//   sub-arm's `check`, graph data itself is expected among no findings:
//   after the refresh it matches the current sources and configuration, and
//   the retained derived-file record cannot itself make it "stale" — 13.3
//   mandates the record be left unchanged, and 14.10's recorded-orphan arm
//   exists precisely because the record legitimately outlives the
//   generation set.
// - "Answers nothing" (T13.3-3) is operationalized as: exit 1 (an answering
//   read exits 0, SPEC 12.0) with the single stdout JSON document decodable
//   as the findings report (H-3) — the same report shape a failing `build`
//   emits ("report the validation errors ... like a failed build", 13.3).
// - T13.3-3 probes the six refreshing reads with the exact staged findings
//   multiset (one 14.1, naming the broken file): a failed refresh reports
//   build validation errors, and `build` over these sources yields exactly
//   that finding. `check` (a read command per 13.3, though it never
//   refreshes) is probed leniently — exit 1, the 14.1 finding present,
//   modifies nothing — because with invalid sources the detectability of
//   staleness findings (14.10) beside the validation error is
//   reporter-matrix territory (T14-4), not 13.3's.
// - "Modifies nothing" is everywhere the compare-around-command protocol
//   over the whole workspace root, `.git/` included (SPEC 13.3, 12.1;
//   `.git/` byte-identity around git-reading invocations is also T12.0-11's
//   subject).
// - The T13.3-1/T13.3-2 sweeps include the 11.2 surfaces (`occurrences`,
//   `view`, `at`) per their TEST-SPEC command lists. Their answers are
//   asserted at the identity/membership level — complete record sets with
//   endpoints, resolved section identities, the scoped per-file list of the
//   view document — because byte-precise span and per-file view semantics
//   are T11.3-*/T11.4-*/T11.5-*'s home; this section owns the
//   serving/refresh behaviors those answers demonstrate.
// - T13.3-3's whole-gate arms (SPEC 13.3: the gate is over every finding a
//   `build` would report — source validation errors, journal errors, and
//   refused writes alike): each staging holds an `audit` session created
//   while the workspace was valid — no baseline to resolve, so the gate
//   alone stands between `review status` and an answer. The garbage journal
//   line rides line 2 behind one legitimate journaled entry (T6.1-3's
//   staging, so "naming the line" has teeth and refresh really must consume
//   the journal for canonical identities, SPEC 5.4); that staging drives the
//   five reads `ids`, `show`, `coverage`, `review status`, and `query` only
//   — `impact` is absent from it by necessity, not oversight (TEST-SPEC
//   T13.3-3): `impact` always takes `--base` (SPEC 9), baseline resolution
//   precedes the gate (12.0), and no journal-error staging reaches the gate
//   at `impact` — a garbage line appended after the baseline commit meets
//   6.3's suffix replay as an unresolvable mapping (exit 2, the usage error
//   T6.3-4 pins), and a garbage line already committed at the baseline ref
//   makes a baseline that cannot be validated as a workspace (exit 2 again,
//   6.3); neither verdict is asserted here. The obstructed write path
//   stages a plain file over the emptied `markdown.outDir` directory after
//   a successful build: the emit write path's workspace-relative component
//   `mdout` is then occupied by a non-directory (13.4) — the workspace's
//   one offending component, nonexistent deeper components never being the
//   condition — so `build` would report exactly the one condition-22
//   finding (14.22: one finding per distinct offending component); this
//   staging alone also drives `impact --base`, against a commit taken
//   before the obstruction was staged — the baseline's sources and
//   configuration validate and the journal is absent on both sides (an
//   empty journal is a prefix of every journal, 6.3) — so its baseline
//   resolves and 14.22 is the operative gate finding (12.0). 14.13
//   line naming follows T6.1-3's H-4 operationalization: the message
//   echoing the garbage text or citing line/entry 2, or (tolerated) a
//   location within the garbage line's byte window — a journal condition
//   carries the concerned journal path, no in-source location (SPEC 14,
//   12.7). The never-gated contrast (`occurrences`, `view`, `at` answering
//   per 11.2, `inventory` answering whatever the sources' validity, SPEC
//   11.6) is asserted at this module's identity/membership altitude, each
//   probe inside its own whole-root compare: a gate condition is a finding
//   of no domain file — the journal and a write-path component are never
//   domain files — so those answers are complete and finding-free at exit
//   0, whatever journal or write-path state the workspace holds (SPEC
//   11.2), and nothing is modified.
// - T13.3-2's record-discipline arm (record corrupted shape-blind, T6.6-6's
//   staging via the H-3 record-staging adapter): SPEC 13.3 pins the record —
//   the recorded derived-file paths — as neither read, repaired, nor
//   replaced by a refresh, while the record's location inside the graph-data
//   area is deliberately unenumerated (13.3, 11.6), so the harness cannot
//   byte-pin which files under `.xspec/` a conforming refresh may rewrite
//   around the preserved record state. The arm therefore asserts persistence
//   through the record-consulting surface TEST-SPEC names: after every
//   refreshing read, `inventory` still reports `recorded` explicitly
//   unavailable (exit 1, the 14.23 outcome; the finding's full form is
//   T11.6-4's home), while outside the graph data the workspace stays
//   byte-identical (no TypeScript or Markdown generated or removed, sources
//   and durable files untouched); a successful `build` then replaces the
//   state (`recorded` a plain list again at exit 0, SPEC 13.3, 14.10, 12.1).

import { Buffer } from "node:buffer";
import * as fsp from "node:fs/promises";
import type {
  AtReport,
  Finding,
  OccurrenceRecord,
  PathValue,
  SessionStatusReport,
  SessionStatusRow,
} from "../../helpers/adapters/index.js";
import {
  corruptGraphDataShapeBlind,
  decodeAtReport,
  decodeCoverageReport,
  decodeFindingsReport,
  decodeIdsReport,
  decodeImpactReport,
  decodeInventoryRecordedDatum,
  decodeNodeReport,
  decodeNodeRowsReport,
  decodeOccurrencesReport,
  decodeSessionListReport,
  decodeSessionStatusReport,
  decodeViewFilesReport,
  isGraphDataKey,
} from "../../helpers/adapters/index.js";
import {
  assertBytesEqual,
  assertExitCode,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import {
  assertAcrossDirectoriesDeterministic,
  assertRunTwiceDeterministic,
} from "../../helpers/determinism.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import type {
  DirectorySnapshot,
  SnapshotEntry,
} from "../../helpers/snapshot.js";
import {
  assertLeavesUnchanged,
  assertSnapshotsEqual,
  snapshotDirectory,
} from "../../helpers/snapshot.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import {
  assertConditionCounts,
  assertFindingConcernsPath,
  assertFindingLocated,
  assertSameJson,
  buildOk,
  expectExit,
  runCli,
  runJson,
} from "./support.js";

// One spec group plus one coverage profile (SPEC 7, 7.4): `coverage` and
// `review create --coverage` need a configured profile, and `targets: "all"`
// keeps the required set at every non-root node (SPEC 8.1).
const GRAPH_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  coverage: [
    {
      name: "p",
      target: "main",
      targets: "all",
      boundary: "main",
      mode: "direct"
    }
  ]
})
`;

/** Stage a fresh workspace with the given files, run `body`, dispose (H-1). */
async function withWorkspace<T>(
  files: Readonly<Record<string, string>>,
  body: (workspace: TestWorkspace) => Promise<T>,
): Promise<T> {
  const workspace = await TestWorkspace.create({ files });
  try {
    return await body(workspace);
  } finally {
    await workspace.dispose();
  }
}

// ---------------------------------------------------------------------------
// Graph-data machinery (the T13.3-2 operational definition)
// ---------------------------------------------------------------------------

// Whether a snapshot key (a `/`-separated workspace-relative path) is graph
// data: under `.xspec/`, excluding the durable `.xspec/journal` and
// `.xspec/reviews/` (SPEC 13.3, 13.4; TEST-SPEC T13.3-2). The predicate's
// home is the H-3 adapter layer (record-staging.ts, whose shape-blind
// corruption shares the operational path set); re-exported here for the
// suite modules sharing T13.3-2's operational definition — T6.6-5's
// record-deleted arm and T6.6-6's corrupt-record staging (section-6.6.ts).
export { isGraphDataKey };

/** The entries of a snapshot whose keys satisfy `keep`. */
function filteredEntries(
  entries: ReadonlyMap<string, SnapshotEntry>,
  keep: (key: string) => boolean,
): Map<string, SnapshotEntry> {
  const kept = new Map<string, SnapshotEntry>();
  for (const [key, entry] of entries) {
    if (keep(key)) kept.set(key, entry);
  }
  return kept;
}

/** A snapshot's graph-data entries (see {@link isGraphDataKey}). */
function graphDataEntries(
  snapshot: DirectorySnapshot,
): Map<string, SnapshotEntry> {
  return filteredEntries(snapshot.entries, isGraphDataKey);
}

/** View a filtered entry map as a snapshot for `assertSnapshotsEqual`. */
function asSnapshot(
  root: string,
  entries: ReadonlyMap<string, SnapshotEntry>,
): DirectorySnapshot {
  return { root, entries };
}

/**
 * Assert a snapshot holds at least one graph-data entry — after `build`,
 * graph data lives under `.xspec/` (SPEC 13.3), so an empty set means the
 * product maintains it elsewhere or not at all. Exported for T6.6-5's
 * record-staging premise (section-6.6.ts).
 */
export function assertGraphDataPresent(
  snapshot: DirectorySnapshot,
  context: string,
): void {
  if (graphDataEntries(snapshot).size === 0) {
    fail(
      `${context}: expected graph data under .xspec/ (SPEC 13.3: xspec ` +
        `maintains graph data under .xspec/, and \`build\` writes it, ` +
        `12.1); found no entry under .xspec/ outside the durable journal ` +
        `and reviews/ paths`,
    );
  }
}

/**
 * Delete the graph data per the T13.3-2 operational definition: every path
 * under `.xspec/` except `.xspec/journal` and `.xspec/reviews/`. Exported
 * for T6.6-5's record-deleted arm (section-6.6.ts).
 */
export async function deleteGraphData(
  workspace: TestWorkspace,
  context: string,
): Promise<void> {
  const kind = await workspace.kind(".xspec");
  if (kind !== "dir") {
    fail(
      `${context}: expected the .xspec/ directory to exist before deleting ` +
        `graph data (SPEC 13.3); found ${kind}`,
    );
  }
  for (const name of await workspace.readdirNames(".xspec")) {
    if (name === "journal" || name === "reviews") continue;
    await fsp.rm(workspace.path(`.xspec/${name}`), {
      recursive: true,
      force: true,
    });
  }
}

/**
 * Restore previously captured graph-data bytes (deleting whatever graph data
 * currently exists first) — the stale-graph staging of T13.3-2's source-edit
 * arm. Only plain files and directories are restorable: anything else under
 * `.xspec/` violates SPEC 13.4 (every file xspec writes is a plain file) and
 * fails diagnosed.
 */
async function restoreGraphData(
  workspace: TestWorkspace,
  entries: ReadonlyMap<string, SnapshotEntry>,
  context: string,
): Promise<void> {
  await deleteGraphData(workspace, context);
  for (const key of [...entries.keys()].sort()) {
    // The key set comes from the map itself, so `get` cannot miss.
    const entry = entries.get(key) as SnapshotEntry;
    if (!/^[\x20-\x7e]+$/.test(key)) {
      fail(
        `${context}: graph-data path ${JSON.stringify(key)} is not plain ` +
          `ASCII — the harness stages stale graph data by path string, so ` +
          `it cannot faithfully restore this entry (and a product writing ` +
          `such paths under .xspec/ defeats the workspace-relative path ` +
          `contract of SPEC 1.5/13.3)`,
      );
    }
    if (entry.kind === "dir") {
      await workspace.dir(key);
    } else if (entry.kind === "file") {
      await workspace.file(key, entry.bytes);
    } else {
      fail(
        `${context}: graph data at ${key} is a ${entry.kind} — every file ` +
          `xspec writes is a plain file (SPEC 13.4), so the harness cannot ` +
          `restore it as staged stale graph data`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Review-session helpers (SPEC 10.6, 10.7)
// ---------------------------------------------------------------------------

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

/**
 * The unique status row scoped at `scope`, diagnosed loudly when missing or
 * duplicated (SPEC 10.1: at most one item per kind and scope node — audit
 * items are all `subtree-coherence`, so scope alone is unique here).
 */
function requireRowByScope(
  report: SessionStatusReport,
  scope: string,
  context: string,
): SessionStatusRow {
  const rows = report.items.filter((row) => row.scope === scope);
  if (rows.length !== 1) {
    fail(
      `${context}: expected exactly one item scoped at ${scope} ` +
        `(SPEC 10.1, 10.6); found ${String(rows.length)} among ` +
        JSON.stringify(
          report.items.map((row) => ({ scope: row.scope, kind: row.kind })),
        ),
    );
  }
  return rows[0] as SessionStatusRow;
}

/** Expected observable state of one session item in a `status` report. */
interface ExpectedRow {
  readonly scope: string;
  readonly status: string;
  readonly blocked: boolean;
}

/** Assert the exact row set of a `status` report by scope (SPEC 10.7, 10.4). */
function assertStatusRows(
  report: SessionStatusReport,
  expected: readonly ExpectedRow[],
  context: string,
): void {
  if (report.items.length !== expected.length) {
    fail(
      `${context}: expected exactly ${String(expected.length)} items ` +
        `(reads never add or remove items, SPEC 10.4/10.7); got ` +
        JSON.stringify(
          report.items.map((row) => ({
            scope: row.scope,
            status: row.status,
            blocked: row.blocked,
          })),
        ),
    );
  }
  for (const want of expected) {
    const row = requireRowByScope(report, want.scope, context);
    if (row.status !== want.status || row.blocked !== want.blocked) {
      fail(
        `${context}: the item scoped at ${want.scope} must report status ` +
          `${JSON.stringify(want.status)} and blocked=${String(want.blocked)} ` +
          `(read-time invalidation against the current graph, SPEC 10.4, ` +
          `10.3); got status ${JSON.stringify(row.status)}, blocked=` +
          String(row.blocked),
      );
    }
  }
}

/** `review resolve <s> <item> --status no-change` must succeed (SPEC 10.7). */
async function resolveNoChange(
  product: ProductBinding,
  workspace: TestWorkspace,
  session: string,
  itemId: string,
  context: string,
): Promise<void> {
  await expectExit(
    product,
    workspace,
    ["review", "resolve", session, itemId, "--status", "no-change"],
    0,
    `${context} \`review resolve ${session} ${itemId} --status no-change\``,
  );
}

// ---------------------------------------------------------------------------
// §11.2-surface sweep helpers (SPEC 11.3, 11.5) — the identity-level scope
// this module's sweeps assert (see the header note)
// ---------------------------------------------------------------------------

/** One sweep probe: a labeled read invocation with its answer assertions. */
interface SweepProbe {
  readonly label: string;
  readonly run: () => Promise<void>;
}

/**
 * Identity-level projection of occurrence records: referencing file, edge
 * kind, source graph-node identity (or the unavailability marker), resolved
 * target identity. Ranges stay unprojected — the decoder validates their
 * form and order, and byte-precise span semantics are T11.3-*'s home
 * (SPEC 5.7, 11.3).
 */
function occurrenceIdentitySummaries(records: readonly OccurrenceRecord[]): {
  file: PathValue;
  kind: string;
  source: string | { readonly unavailable: true };
  target: string;
}[] {
  return records.map((record) => ({
    file: record.file,
    kind: record.kind,
    source:
      "identity" in record.source ? record.source.identity : record.source,
    target: record.target,
  }));
}

/**
 * Assert an `at` answer at this module's identity level: finding-free, the
 * resolution present (only an unparseable file's resolution is unavailable,
 * and these fixtures are parseable), resolving to the expected section
 * identity with no containing occurrence (SPEC 11.5, 11.2; construct-range
 * byte precision is T11.5-*'s home).
 */
function assertAtAnswer(
  report: AtReport,
  expectedIdentity: string,
  context: string,
): void {
  if ("unavailable" in report.resolution) {
    fail(
      `${context}: the resolution must be present — the named file is ` +
        `parseable, and only an unparseable file's resolution is reported ` +
        `explicitly unavailable (SPEC 11.5, 11.2); got the unavailability ` +
        `marker`,
    );
  }
  assertSameJson(
    {
      findings: report.findings,
      identity: report.resolution.section.identity,
      occurrence: report.resolution.occurrence,
    },
    { findings: [], identity: expectedIdentity, occurrence: null },
    `${context}: a finding-free answer resolving the offset to the ` +
      `innermost enclosing section construct, the offset lying within no ` +
      `occurrence (SPEC 11.5, 11.2)`,
  );
}

// ---------------------------------------------------------------------------
// T13.3-1 — serving reads
// ---------------------------------------------------------------------------

const T13_3_1_A = [
  '<S id="alpha" d={["beta"]}>',
  "Alpha depends on beta.",
  "</S>",
  "",
  '<S id="beta">',
  "Beta text.",
  "</S>",
  "",
].join("\n");

const T13_3_1 = defineProductTest({
  id: "T13.3-1",
  title:
    "after `build`, the read commands (check, ids, show, coverage, impact, review, query, occurrences, view, at) answer without error, and graph data lives under .xspec/ (SPEC 13.3, 12.0)",
  run: async (product) => {
    await withWorkspace(
      { "xspec.config.ts": GRAPH_CONFIG, "specs/A.mdx": T13_3_1_A },
      async (workspace) => {
        const A_ROOT = "specs/A.mdx";
        const ALPHA = "specs/A.mdx#alpha";
        const BETA = "specs/A.mdx#beta";

        // Baseline commit of the pristine sources, so `impact --base` has a
        // resolvable, reconstructable baseline equal to the current sources.
        await workspace.gitInit();
        const base = await workspace.gitCommitAll("baseline");
        await buildOk(product, workspace, "T13.3-1 `build` (SPEC 12.1)");

        // Graph data lives under `.xspec/` (SPEC 13.3): after `build`, the
        // directory exists and holds graph data (content opaque, H-4). No
        // journal or session exists yet, so everything under it is graph
        // data by the T13.3-2 operational definition.
        const afterBuild = await snapshotDirectory(workspace.root);
        assertGraphDataPresent(afterBuild, "T13.3-1 after `build`");

        // An audit session, so `review` has a session to answer about
        // (SPEC 10.6, 10.7).
        await expectExit(
          product,
          workspace,
          ["review", "create", "--strategy", "audit", "--name", "s"],
          0,
          "T13.3-1 `review create --strategy audit --name s` (SPEC 10.7)",
        );

        // Every read answers without error — and, serving from the graph
        // data `build` wrote, modifies nothing (compare-around protocol; a
        // conforming rewrite of identical bytes still passes, H-4).
        await assertLeavesUnchanged(
          workspace.root,
          async () => {
            await expectExit(
              product,
              workspace,
              ["check"],
              0,
              "T13.3-1 `check` after a clean build — no findings, exit 0 " +
                "(SPEC 12.2, 13.3)",
            );

            const idsLabel = "T13.3-1 `ids --json`";
            const ids = decodeIdsReport(
              await runJson(product, workspace, ["ids", "--json"], idsLabel),
              idsLabel,
            );
            assertSameJson(
              ids.files,
              [{ file: A_ROOT, ids: ["alpha", "beta"] }],
              `${idsLabel}: the staged IDs, served after \`build\` (SPEC ` +
                `13.3, 12.3)`,
            );

            const showLabel = `T13.3-1 \`show ${ALPHA} --json\``;
            const alpha = decodeNodeReport(
              await runJson(
                product,
                workspace,
                ["show", ALPHA, "--json"],
                showLabel,
              ),
              showLabel,
            );
            assertSameJson(
              alpha.identity,
              ALPHA,
              `${showLabel}: identity of the addressed node (SPEC 12.4)`,
            );
            assertBytesEqual(
              alpha.subtreeText,
              "Alpha depends on beta.\n",
              `${showLabel}: subtree text served from the built graph ` +
                `(SPEC 12.4, 1.6)`,
            );

            const coverageLabel = "T13.3-1 `coverage --json`";
            const coverage = decodeCoverageReport(
              await runJson(
                product,
                workspace,
                ["coverage", "--json"],
                coverageLabel,
              ),
              coverageLabel,
            );
            if (
              coverage.profiles.length !== 1 ||
              coverage.profiles[0]?.name !== "p"
            ) {
              fail(
                `${coverageLabel}: expected exactly the one configured ` +
                  `profile "p" (SPEC 8.2); got ` +
                  JSON.stringify(
                    coverage.profiles.map((profile) => profile.name),
                  ),
              );
            }
            const profile = coverage.profiles[0];
            assertSameJson(
              profile.counts,
              { required: 2, covered: 1, uncovered: 1, ignored: 1 },
              `${coverageLabel}: counts — required {alpha, beta}, beta ` +
                `covered by alpha's d edge, the root ignored (SPEC 8.1, 8.2)`,
            );
            assertSameJson(
              profile.covered,
              [{ identity: BETA, path: [ALPHA, BETA] }],
              `${coverageLabel}: the covered node and its covering path ` +
                `(SPEC 8.2)`,
            );
            assertSameJson(
              profile.uncovered,
              [ALPHA],
              `${coverageLabel}: the uncovered node (SPEC 8.2)`,
            );

            const impactLabel = `T13.3-1 \`impact --base ${base} --json\``;
            const impact = decodeImpactReport(
              await runJson(
                product,
                workspace,
                ["impact", "--base", base, "--json"],
                impactLabel,
              ),
              impactLabel,
            );
            assertSameJson(
              {
                requirements: impact.requirements,
                direct: impact.code.direct,
                transitive: impact.code.transitive,
              },
              { requirements: [], direct: [], transitive: [] },
              `${impactLabel}: current sources equal the baseline, so no ` +
                `node receives a category and no code is impacted (SPEC ` +
                `5.6, 9.3; informational, exit 0)`,
            );

            const listLabel = "T13.3-1 `review list --json`";
            const list = decodeSessionListReport(
              await runJson(
                product,
                workspace,
                ["review", "list", "--json"],
                listLabel,
              ),
              listLabel,
            );
            if (list.sessions.length !== 1) {
              fail(
                `${listLabel}: expected exactly the one created session ` +
                  `(SPEC 10.7); got ` +
                  JSON.stringify(list.sessions.map((entry) => entry.name)),
              );
            }
            const entry = list.sessions[0];
            if (entry.name !== "s" || entry.corrupt) {
              fail(
                `${listLabel}: expected the session "s", not corrupt ` +
                  `(SPEC 10.7); got ${JSON.stringify(entry)}`,
              );
            }
            assertSameJson(
              entry.strategy,
              "audit",
              `${listLabel}: the session's strategy (SPEC 10.7)`,
            );

            const status = await sessionStatus(
              product,
              workspace,
              "s",
              "T13.3-1",
            );
            assertStatusRows(
              status,
              [
                // Audit: one subtree-coherence item per node, roots
                // included; the root's blockedBy is its child sections'
                // items (SPEC 10.6).
                { scope: A_ROOT, status: "unresolved", blocked: true },
                { scope: ALPHA, status: "unresolved", blocked: false },
                { scope: BETA, status: "unresolved", blocked: false },
              ],
              "T13.3-1 `review status s --json` (SPEC 10.6, 10.7)",
            );

            const queryLabel = "T13.3-1 `query nodes`";
            const rows = decodeNodeRowsReport(
              await runJson(product, workspace, ["query", "nodes"], queryLabel),
              queryLabel,
            );
            for (const identity of [ALPHA, BETA]) {
              if (!rows.some((row) => row.identity === identity)) {
                fail(
                  `${queryLabel}: expected ${identity} among the reported ` +
                    `rows (SPEC 11); got ` +
                    JSON.stringify(rows.map((row) => row.identity).sort()),
                );
              }
            }

            // The 11.2 surfaces are read commands of 13.3 too — JSON-only,
            // answering one document when invoked bare (SPEC 11, 11.2).
            const occurrencesLabel = "T13.3-1 `occurrences`";
            const occurrences = decodeOccurrencesReport(
              await runJson(
                product,
                workspace,
                ["occurrences"],
                occurrencesLabel,
              ),
              occurrencesLabel,
            );
            assertSameJson(
              {
                findings: occurrences.findings,
                occurrences: occurrenceIdentitySummaries(
                  occurrences.occurrences,
                ),
              },
              {
                findings: [],
                occurrences: [
                  {
                    file: A_ROOT,
                    kind: "depends",
                    source: ALPHA,
                    target: BETA,
                  },
                ],
              },
              `${occurrencesLabel}: the staged d entry is the workspace's ` +
                `one reference occurrence — alpha's depends reference to ` +
                `beta, finding-free (SPEC 11.3, 5.7, 13.3)`,
            );

            const viewLabel = "T13.3-1 `view`";
            const view = decodeViewFilesReport(
              await runJson(product, workspace, ["view"], viewLabel),
              viewLabel,
            );
            assertSameJson(
              view,
              { findings: [], files: [A_ROOT] },
              `${viewLabel}: with neither operands nor --file, the request ` +
                `covers every discovered spec source — one per-file view, ` +
                `finding-free (SPEC 11.4, 12.7)`,
            );

            // Byte 30 lies inside "Alpha depends on beta." — within alpha's
            // construct (bytes 0..55), outside beta's (starting at 57) and
            // outside the d entry's occurrence span ("beta" at bytes
            // 18..24) (SPEC 11.5, 1.7).
            const atLabel = "T13.3-1 `at specs/A.mdx 30`";
            assertAtAnswer(
              decodeAtReport(
                await runJson(
                  product,
                  workspace,
                  ["at", A_ROOT, "30"],
                  atLabel,
                ),
                atLabel,
              ),
              ALPHA,
              atLabel,
            );
          },
          "T13.3-1 the read commands serve from the graph data `build` " +
            "wrote without modifying anything in the workspace (SPEC 13.3, " +
            "10.4, 12.0)",
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T13.3-2 — refresh
// ---------------------------------------------------------------------------

const T13_3_2_A_V0 = [
  '<S id="alpha">',
  "Alpha original text.",
  "</S>",
  "",
].join("\n");
// The edit adds a section carrying a same-file d reference: the edited
// sources hold exactly one reference occurrence where the pre-edit sources
// hold none, so `occurrences` (and `coverage`, via the new edge) answer
// values stale graph data cannot produce (SPEC 5.7, 8.2, 13.3).
const T13_3_2_A_V1 = [
  '<S id="alpha">',
  "Alpha revised text.",
  "</S>",
  "",
  '<S id="added" d={["alpha"]}>',
  "Added section text.",
  "</S>",
  "",
].join("\n");
const T13_3_2_B = ['<S id="beta">', "Beta text.", "</S>", ""].join("\n");

// The record-discipline arm's one source: a d reference makes every
// surface's answer contentful (the one occurrence; beta covered through it),
// and the workspace is otherwise clean — a successful `build` precedes the
// corruption, so nothing but the corrupt record is wrong (SPEC 13.3, 14.23).
const T13_3_2_RECORD_A = [
  '<S id="alpha" d={["beta"]}>',
  "Alpha depends on beta.",
  "</S>",
  "",
  '<S id="beta">',
  "Beta text.",
  "</S>",
  "",
].join("\n");

const T13_3_2 = defineProductTest({
  id: "T13.3-2",
  title:
    "deleting the graph data (every path under .xspec/ except the durable journal and reviews/) or editing a source makes each of ids, show, coverage, impact, review status, query, occurrences, view, at answer from current sources and rewrite graph data as `build` would write it — while no TypeScript or Markdown is generated or removed and the recorded derived-file paths stay unchanged (a stale module stays stale, `check` reports 14.10; a later `build` removes the recorded orphan); with the record corrupted shape-blind instead, each refreshing read answers finding-free at exit 0, leaving the corrupt state neither read, repaired, nor replaced — `inventory` still reports `recorded` unavailable — until a successful `build` replaces the state (SPEC 13.3, 13.4, 12.1, 14.23)",
  run: async (product) => {
    await withWorkspace(
      {
        "xspec.config.ts": GRAPH_CONFIG,
        "specs/A.mdx": T13_3_2_A_V0,
        "specs/B.mdx": T13_3_2_B,
      },
      async (workspace) => {
        const A_ROOT = "specs/A.mdx";
        const ALPHA = "specs/A.mdx#alpha";
        const ADDED = "specs/A.mdx#added";
        const B_ROOT = "specs/B.mdx";
        const BETA = "specs/B.mdx#beta";

        // --- Staging: baseline commit, build, an audit session with three
        // resolved items, then a fixed-point rebuild so the on-disk graph
        // data is exactly what `build` writes for this workspace state.
        await workspace.gitInit();
        const base = await workspace.gitCommitAll("baseline");
        await buildOk(product, workspace, "T13.3-2 staging `build`");
        await expectExit(
          product,
          workspace,
          ["review", "create", "--strategy", "audit", "--name", "s"],
          0,
          "T13.3-2 staging `review create --strategy audit --name s`",
        );
        const staged = await sessionStatus(
          product,
          workspace,
          "s",
          "T13.3-2 staging",
        );
        const alphaItem = requireRowByScope(
          staged,
          ALPHA,
          "T13.3-2 staging item lookup",
        ).id;
        const betaItem = requireRowByScope(
          staged,
          BETA,
          "T13.3-2 staging item lookup",
        ).id;
        const aRootItem = requireRowByScope(
          staged,
          A_ROOT,
          "T13.3-2 staging item lookup",
        ).id;
        // Leaves first (audit blocking is bottom-up, SPEC 10.6), then A's
        // root; B's root item stays unresolved.
        await resolveNoChange(product, workspace, "s", alphaItem, "T13.3-2");
        await resolveNoChange(product, workspace, "s", betaItem, "T13.3-2");
        await resolveNoChange(product, workspace, "s", aRootItem, "T13.3-2");
        await buildOk(
          product,
          workspace,
          "T13.3-2 staging fixed-point rebuild — the on-disk graph data is " +
            "exactly what `build` writes for the current workspace state " +
            "(SPEC 12.0/13.3 determinism)",
        );
        const w0 = await snapshotDirectory(workspace.root);
        assertGraphDataPresent(w0, "T13.3-2 after the staging builds");
        const staleGraph = graphDataEntries(w0);

        // The nine refreshing reads (SPEC 13.3; `review` represented by
        // `status` per the T13.3-2 command list), with per-arm answer
        // assertions supplied by each arm below.
        const armAProbes: readonly SweepProbe[] = [
          {
            label: "`ids --json`",
            run: async () => {
              const label = "T13.3-2 (deleted graph data) `ids --json`";
              const ids = decodeIdsReport(
                await runJson(product, workspace, ["ids", "--json"], label),
                label,
              );
              assertSameJson(
                ids.files,
                [
                  { file: A_ROOT, ids: ["alpha"] },
                  { file: B_ROOT, ids: ["beta"] },
                ],
                `${label}: the current sources' IDs (SPEC 13.3, 12.3)`,
              );
            },
          },
          {
            label: "`show`",
            run: async () => {
              const label = `T13.3-2 (deleted graph data) \`show ${ALPHA} --json\``;
              const node = decodeNodeReport(
                await runJson(
                  product,
                  workspace,
                  ["show", ALPHA, "--json"],
                  label,
                ),
                label,
              );
              assertBytesEqual(
                node.subtreeText,
                "Alpha original text.\n",
                `${label}: subtree text from the current sources (SPEC 13.3)`,
              );
            },
          },
          {
            label: "`coverage --json`",
            run: async () => {
              const label = "T13.3-2 (deleted graph data) `coverage --json`";
              const coverage = decodeCoverageReport(
                await runJson(
                  product,
                  workspace,
                  ["coverage", "--json"],
                  label,
                ),
                label,
              );
              const profile = coverage.profiles.find((p) => p.name === "p");
              if (profile === undefined) {
                fail(
                  `${label}: the configured profile "p" must be reported ` +
                    `(SPEC 8.2); got ` +
                    JSON.stringify(coverage.profiles.map((p) => p.name)),
                );
              }
              assertSameJson(
                [...profile.uncovered].sort(),
                [ALPHA, BETA],
                `${label}: the current sources' uncovered nodes (SPEC 8.2, ` +
                  `13.3)`,
              );
            },
          },
          {
            label: "`impact --base`",
            run: async () => {
              const label = `T13.3-2 (deleted graph data) \`impact --base ${base} --json\``;
              const impact = decodeImpactReport(
                await runJson(
                  product,
                  workspace,
                  ["impact", "--base", base, "--json"],
                  label,
                ),
                label,
              );
              assertSameJson(
                {
                  requirements: impact.requirements,
                  direct: impact.code.direct,
                  transitive: impact.code.transitive,
                },
                { requirements: [], direct: [], transitive: [] },
                `${label}: current sources equal the baseline — no ` +
                  `categories (SPEC 5.6, 9.3, 13.3)`,
              );
            },
          },
          {
            label: "`review status`",
            run: async () => {
              const status = await sessionStatus(
                product,
                workspace,
                "s",
                "T13.3-2 (deleted graph data)",
              );
              assertStatusRows(
                status,
                [
                  { scope: A_ROOT, status: "no-change", blocked: false },
                  { scope: ALPHA, status: "no-change", blocked: false },
                  { scope: B_ROOT, status: "unresolved", blocked: false },
                  { scope: BETA, status: "no-change", blocked: false },
                ],
                "T13.3-2 (deleted graph data) `review status s --json` — " +
                  "sources unchanged, so nothing is invalidated (SPEC 10.4)",
              );
            },
          },
          {
            label: "`query nodes`",
            run: async () => {
              const label = "T13.3-2 (deleted graph data) `query nodes`";
              const rows = decodeNodeRowsReport(
                await runJson(product, workspace, ["query", "nodes"], label),
                label,
              );
              for (const identity of [ALPHA, BETA]) {
                if (!rows.some((row) => row.identity === identity)) {
                  fail(
                    `${label}: expected ${identity} among the rows (SPEC ` +
                      `11, 13.3); got ` +
                      JSON.stringify(rows.map((row) => row.identity).sort()),
                  );
                }
              }
            },
          },
          {
            label: "`occurrences`",
            run: async () => {
              const label = "T13.3-2 (deleted graph data) `occurrences`";
              const report = decodeOccurrencesReport(
                await runJson(product, workspace, ["occurrences"], label),
                label,
              );
              assertSameJson(
                report,
                { findings: [], occurrences: [] },
                `${label}: no reference spelling exists in these sources — ` +
                  `the definitive empty, finding-free enumeration, answered ` +
                  `from the current sources (SPEC 11.3, 5.7, 13.3)`,
              );
            },
          },
          {
            label: "`view`",
            run: async () => {
              const label = "T13.3-2 (deleted graph data) `view`";
              const view = decodeViewFilesReport(
                await runJson(product, workspace, ["view"], label),
                label,
              );
              assertSameJson(
                view,
                { findings: [], files: [A_ROOT, B_ROOT] },
                `${label}: with neither operands nor --file the request ` +
                  `covers every discovered spec source, finding-free ` +
                  `(SPEC 11.4, 12.7, 13.3)`,
              );
            },
          },
          {
            label: "`at`",
            run: async () => {
              // Byte 20 lies inside "Alpha original text." — within
              // alpha's construct (bytes 0..40 of the pre-edit source),
              // and the source spells no occurrence (SPEC 11.5, 1.7).
              const label = "T13.3-2 (deleted graph data) `at specs/A.mdx 20`";
              assertAtAnswer(
                decodeAtReport(
                  await runJson(
                    product,
                    workspace,
                    ["at", A_ROOT, "20"],
                    label,
                  ),
                  label,
                ),
                ALPHA,
                label,
              );
            },
          },
        ];

        // --- Arm A: deletion trigger. Before each command the graph data is
        // deleted whole; the command answers from current sources and must
        // leave the workspace byte-identical to the fixed point W0: graph
        // data rewritten exactly as `build` wrote it (12.0/13.3
        // determinism), durables untouched, no TypeScript or Markdown
        // generated or removed.
        for (const probe of armAProbes) {
          await deleteGraphData(
            workspace,
            `T13.3-2 (deleted graph data) before ${probe.label}`,
          );
          await probe.run();
          const after = await snapshotDirectory(workspace.root);
          assertSnapshotsEqual(
            w0,
            after,
            `T13.3-2 (deleted graph data) after ${probe.label}: the ` +
              `workspace must be byte-identical to the post-build state — ` +
              `graph data rewritten exactly as \`build\` would write it, ` +
              `no TypeScript or Markdown generated or removed, journal and ` +
              `session files untouched (SPEC 13.3, 13.4)`,
          );
        }

        // --- Arm B: source-edit trigger, content-only edit (the generated
        // file set is unchanged, so the reference build below is exact; see
        // the module header). Before each command the stale pre-edit graph
        // data is restored, so every command individually faces
        // stale-but-present graph data and must answer from the edited
        // sources.
        await workspace.file("specs/A.mdx", T13_3_2_A_V1);
        const expectedNonGraph = filteredEntries(
          w0.entries,
          (key) => !isGraphDataKey(key),
        );
        expectedNonGraph.set("specs/A.mdx", {
          kind: "file",
          bytes: Buffer.from(T13_3_2_A_V1, "utf8"),
        });

        const armBProbes: readonly SweepProbe[] = [
          {
            label: "`ids --json`",
            run: async () => {
              const label = "T13.3-2 (edited source) `ids --json`";
              const ids = decodeIdsReport(
                await runJson(product, workspace, ["ids", "--json"], label),
                label,
              );
              assertSameJson(
                ids.files,
                [
                  { file: A_ROOT, ids: ["alpha", "added"] },
                  { file: B_ROOT, ids: ["beta"] },
                ],
                `${label}: the edited sources' IDs — never stale data ` +
                  `(SPEC 13.3, 12.3)`,
              );
            },
          },
          {
            label: "`show`",
            run: async () => {
              // The added node exists only in the edited sources: a product
              // serving stale graph data reports an unknown node (exit 2)
              // instead of answering.
              const label = `T13.3-2 (edited source) \`show ${ADDED} --json\``;
              const node = decodeNodeReport(
                await runJson(
                  product,
                  workspace,
                  ["show", ADDED, "--json"],
                  label,
                ),
                label,
              );
              assertSameJson(
                node.identity,
                ADDED,
                `${label}: the newly added node answers (SPEC 13.3, 12.4)`,
              );
              assertBytesEqual(
                node.subtreeText,
                "Added section text.\n",
                `${label}: subtree text from the edited source (SPEC 13.3)`,
              );
            },
          },
          {
            label: "`coverage --json`",
            run: async () => {
              const label = "T13.3-2 (edited source) `coverage --json`";
              const coverage = decodeCoverageReport(
                await runJson(
                  product,
                  workspace,
                  ["coverage", "--json"],
                  label,
                ),
                label,
              );
              const profile = coverage.profiles.find((p) => p.name === "p");
              if (profile === undefined) {
                fail(
                  `${label}: the configured profile "p" must be reported ` +
                    `(SPEC 8.2); got ` +
                    JSON.stringify(coverage.profiles.map((p) => p.name)),
                );
              }
              assertSameJson(
                [...profile.uncovered].sort(),
                [ADDED, BETA],
                `${label}: the added node is required and uncovered while ` +
                  `alpha is covered through its new d edge — the answer ` +
                  `reflects the edited sources (SPEC 8.1, 8.2, 13.3)`,
              );
              assertSameJson(
                profile.covered,
                [{ identity: ALPHA, path: [ADDED, ALPHA] }],
                `${label}: alpha's covering path exists only in the edited ` +
                  `sources — the stale graph holds no dependency edge at ` +
                  `all (SPEC 8.2, 13.3)`,
              );
            },
          },
          {
            label: "`impact --base`",
            run: async () => {
              const label = `T13.3-2 (edited source) \`impact --base ${base} --json\``;
              const impact = decodeImpactReport(
                await runJson(
                  product,
                  workspace,
                  ["impact", "--base", base, "--json"],
                  label,
                ),
                label,
              );
              const findChanged = (identity: string): void => {
                const entry = impact.requirements.find((candidate) =>
                  candidate.nodes.includes(identity),
                );
                if (
                  entry === undefined ||
                  !entry.categories.some(
                    (category) => category.category === "changed",
                  ) ||
                  entry.deleted
                ) {
                  fail(
                    `${label}: expected a present-node entry for ${identity} ` +
                      `carrying the \`changed\` category (edited/added since ` +
                      `the baseline, SPEC 5.6) — stale graph data would ` +
                      `report no difference; got ` +
                      JSON.stringify(impact.requirements),
                  );
                }
              };
              findChanged(ALPHA);
              findChanged(ADDED);
            },
          },
          {
            label: "`review status`",
            run: async () => {
              const status = await sessionStatus(
                product,
                workspace,
                "s",
                "T13.3-2 (edited source)",
              );
              assertStatusRows(
                status,
                [
                  // alpha's subtree changed and A's root subtree changed:
                  // both resolved items are reported invalidated against the
                  // current graph (SPEC 10.4); the invalidated alpha item
                  // re-blocks the root item (SPEC 10.3, 10.6). B is
                  // untouched, so beta's resolution stands — a product
                  // serving stale graph data would report all three still
                  // resolved.
                  { scope: A_ROOT, status: "invalidated", blocked: true },
                  { scope: ALPHA, status: "invalidated", blocked: false },
                  { scope: B_ROOT, status: "unresolved", blocked: false },
                  { scope: BETA, status: "no-change", blocked: false },
                ],
                "T13.3-2 (edited source) `review status s --json` (SPEC " +
                  "10.4, 13.3)",
              );
            },
          },
          {
            label: "`query nodes`",
            run: async () => {
              const label = "T13.3-2 (edited source) `query nodes`";
              const rows = decodeNodeRowsReport(
                await runJson(product, workspace, ["query", "nodes"], label),
                label,
              );
              for (const identity of [ALPHA, ADDED, BETA]) {
                if (!rows.some((row) => row.identity === identity)) {
                  fail(
                    `${label}: expected ${identity} among the rows — the ` +
                      `answer reflects the edited sources (SPEC 11, 13.3); ` +
                      `got ` +
                      JSON.stringify(rows.map((row) => row.identity).sort()),
                  );
                }
              }
            },
          },
          {
            label: "`occurrences`",
            run: async () => {
              const label = "T13.3-2 (edited source) `occurrences`";
              const report = decodeOccurrencesReport(
                await runJson(product, workspace, ["occurrences"], label),
                label,
              );
              assertSameJson(
                {
                  findings: report.findings,
                  occurrences: occurrenceIdentitySummaries(report.occurrences),
                },
                {
                  findings: [],
                  occurrences: [
                    {
                      file: A_ROOT,
                      kind: "depends",
                      source: ADDED,
                      target: ALPHA,
                    },
                  ],
                },
                `${label}: the edited source's d entry is the workspace's ` +
                  `one reference occurrence — the pre-edit sources spell ` +
                  `none, so stale graph data cannot produce this answer ` +
                  `(SPEC 11.3, 5.7, 13.3)`,
              );
            },
          },
          {
            label: "`view`",
            run: async () => {
              const label = "T13.3-2 (edited source) `view`";
              const view = decodeViewFilesReport(
                await runJson(product, workspace, ["view"], label),
                label,
              );
              assertSameJson(
                view,
                { findings: [], files: [A_ROOT, B_ROOT] },
                `${label}: the whole-domain request answers finding-free ` +
                  `over the edited, valid sources (SPEC 11.4, 12.7, 13.3)`,
              );
            },
          },
          {
            label: "`at`",
            run: async () => {
              // Byte 75 lies inside "Added section text." — within the
              // added section's construct (bytes 41..94 of the edited
              // source) and outside its d entry's occurrence span ("alpha"
              // at bytes 59..66); the section exists only in the edited
              // source, so a stale answer cannot name it (SPEC 11.5, 13.3).
              const label = "T13.3-2 (edited source) `at specs/A.mdx 75`";
              assertAtAnswer(
                decodeAtReport(
                  await runJson(
                    product,
                    workspace,
                    ["at", A_ROOT, "75"],
                    label,
                  ),
                  label,
                ),
                ADDED,
                label,
              );
            },
          },
        ];

        let refreshedGraph: Map<string, SnapshotEntry> | undefined;
        for (const probe of armBProbes) {
          await restoreGraphData(
            workspace,
            staleGraph,
            `T13.3-2 (edited source) staging stale graph data before ${probe.label}`,
          );
          await probe.run();
          const after = await snapshotDirectory(workspace.root);
          assertSnapshotsEqual(
            asSnapshot(workspace.root, expectedNonGraph),
            asSnapshot(
              workspace.root,
              filteredEntries(after.entries, (key) => !isGraphDataKey(key)),
            ),
            `T13.3-2 (edited source) after ${probe.label}: outside the ` +
              `graph data, only the harness's own source edit may differ ` +
              `from the pre-edit state — no TypeScript or Markdown is ` +
              `generated or removed (the stale generated module stays ` +
              `stale) and durable files are untouched (SPEC 13.3, 13.4)`,
          );
          const graphNow = graphDataEntries(after);
          if (refreshedGraph === undefined) {
            refreshedGraph = graphNow;
            assertGraphDataPresent(
              after,
              `T13.3-2 (edited source) after ${probe.label}`,
            );
          } else {
            assertSnapshotsEqual(
              asSnapshot(workspace.root, refreshedGraph),
              asSnapshot(workspace.root, graphNow),
              `T13.3-2 (edited source) after ${probe.label}: every ` +
                `refreshing read rewrites the same graph-data bytes for ` +
                `the same workspace state (SPEC 13.3, 12.0)`,
            );
          }
        }

        // The stale generated module stays stale: `check` never refreshes
        // derived TypeScript and reports 14.10 for A's module (SPEC 13.3,
        // 14.10) — and reports it against the module the refresh left
        // untouched, without modifying anything (SPEC 12.2).
        await assertLeavesUnchanged(
          workspace.root,
          async () => {
            const label = "T13.3-2 (edited source) `check --json`";
            const result = await runCli(product, workspace, [
              "check",
              "--json",
            ]);
            assertExitCode(
              result,
              1,
              `${label} — the stale generated module is a finding (SPEC ` +
                `14.10, 12.2)`,
            );
            const findings = decodeFindingsReport(
              parseJsonStdout(result, label),
              label,
            ).findings;
            assertStaleModuleFindings(
              findings,
              "specs/A.xspec.",
              "specs/A.xspec.ts",
              label,
            );
          },
          "T13.3-2 (edited source) `check` reports the staleness the " +
            "refresh left behind",
        );

        // The reference build: `build` regenerates everything for the edited
        // sources; its graph data is by definition "what build would write",
        // and the refreshing reads must have written exactly those bytes
        // (the content-only edit keeps the recorded derived-file path set
        // identical; see the module header).
        await buildOk(
          product,
          workspace,
          "T13.3-2 (edited source) reference `build` (SPEC 12.1)",
        );
        const afterReferenceBuild = await snapshotDirectory(workspace.root);
        if (refreshedGraph === undefined) {
          throw new Error("T13.3-2 internal error: no arm-B probe ran");
        }
        assertSnapshotsEqual(
          asSnapshot(workspace.root, refreshedGraph),
          asSnapshot(workspace.root, graphDataEntries(afterReferenceBuild)),
          "T13.3-2 (edited source): the graph data the refreshing reads " +
            "wrote vs the graph data `build` writes for the identical " +
            "workspace state — the refresh writes exactly what `xspec " +
            "build` would write (SPEC 13.3, 12.0)",
        );

        // --- Arm B, set-changing sub-arm: deleting a source is also a
        // source edit; the refresh must leave the orphaned module in place
        // (no TypeScript removed) and the recorded derived-file paths
        // unchanged — observed through 14.10's recorded-orphan arm and
        // through the next `build` removing the orphan (SPEC 13.3, 13.4,
        // 12.1: orphan removal relies on the recorded paths, so removal
        // proves the record survived the refresh).
        const beforeDelete = await snapshotDirectory(workspace.root);
        if (beforeDelete.entries.get("specs/B.xspec.ts")?.kind !== "file") {
          fail(
            "T13.3-2 (deleted source): staging premise — after `build`, " +
              "B.mdx's generated module specs/B.xspec.ts exists as a plain " +
              "file (SPEC 13.1)",
          );
        }
        await fsp.rm(workspace.path("specs/B.mdx"));

        const label = "T13.3-2 (deleted source) `ids --json`";
        const ids = decodeIdsReport(
          await runJson(product, workspace, ["ids", "--json"], label),
          label,
        );
        assertSameJson(
          ids.files,
          [{ file: A_ROOT, ids: ["alpha", "added"] }],
          `${label}: the deleted source is gone from the answer (SPEC 13.3, ` +
            `12.3)`,
        );
        const bKind = await workspace.kind("specs/B.xspec.ts");
        if (bKind !== "file") {
          fail(
            "T13.3-2 (deleted source): after the refreshing read, " +
              "specs/B.xspec.ts must still exist — a refresh generates and " +
              "removes no TypeScript (SPEC 13.3); found " +
              bKind,
          );
        }
        const afterDeleteRead = await snapshotDirectory(workspace.root);
        const expectedAfterDelete = filteredEntries(
          beforeDelete.entries,
          (key) => !isGraphDataKey(key),
        );
        expectedAfterDelete.delete("specs/B.mdx");
        assertSnapshotsEqual(
          asSnapshot(workspace.root, expectedAfterDelete),
          asSnapshot(
            workspace.root,
            filteredEntries(
              afterDeleteRead.entries,
              (key) => !isGraphDataKey(key),
            ),
          ),
          "T13.3-2 (deleted source) after `ids`: outside graph data, only " +
            "the harness's own deletion of specs/B.mdx differs — the " +
            "refresh removed no TypeScript or Markdown and touched no " +
            "durable file (SPEC 13.3, 13.4)",
        );

        await assertLeavesUnchanged(
          workspace.root,
          async () => {
            const checkLabel = "T13.3-2 (deleted source) `check --json`";
            const result = await runCli(product, workspace, [
              "check",
              "--json",
            ]);
            assertExitCode(
              result,
              1,
              `${checkLabel} — B's recorded derived files remain at paths ` +
                `the current sources no longer generate (SPEC 14.10)`,
            );
            const findings = decodeFindingsReport(
              parseJsonStdout(result, checkLabel),
              checkLabel,
            ).findings;
            assertStaleModuleFindings(
              findings,
              "specs/B.xspec.",
              "specs/B.xspec.ts",
              checkLabel,
            );
          },
          "T13.3-2 (deleted source) `check` reports the recorded orphans",
        );

        await buildOk(
          product,
          workspace,
          "T13.3-2 (deleted source) `build` after the refresh (SPEC 12.1)",
        );
        const leftovers = (await workspace.readdirNames("specs")).filter(
          (name) => name.startsWith("B.xspec."),
        );
        if (leftovers.length > 0) {
          fail(
            "T13.3-2 (deleted source): `build` after the refreshing read " +
              "must remove B's orphaned module and companions — orphan " +
              "removal relies on the recorded derived-file paths (SPEC " +
              "13.4, 12.1), so the refresh must have left that record " +
              "unchanged (SPEC 13.3); left over: " +
              JSON.stringify(leftovers),
          );
        }
        const aKind = await workspace.kind("specs/A.xspec.ts");
        if (aKind !== "file") {
          fail(
            "T13.3-2 (deleted source): specs/A.xspec.ts must survive the " +
              "orphan-removing rebuild — A's source still generates it " +
              "(SPEC 12.1, 13.1); found " +
              aKind,
          );
        }
      },
    );

    // --- Record discipline (SPEC 13.3, 14.23): with the record corrupted
    // shape-blind (T6.6-6's staging), each refreshing read answers
    // finding-free at exit 0 on the otherwise clean workspace, reporting
    // nothing for the record and leaving the corrupt state neither read,
    // repaired, nor replaced — `inventory` still reports `recorded`
    // explicitly unavailable after every read (the record-consulting
    // surface; see the module header for why graph-data bytes are not
    // pinned here) — until a successful `build` replaces the state.
    await withWorkspace(
      { "xspec.config.ts": GRAPH_CONFIG, "specs/A.mdx": T13_3_2_RECORD_A },
      async (workspace) => {
        const A_ROOT = "specs/A.mdx";
        const ALPHA = "specs/A.mdx#alpha";
        const BETA = "specs/A.mdx#beta";

        // Staging: a resolvable baseline for `impact --base`, a successful
        // `build` (the corruption applies only to record files the product
        // itself wrote, H-3), and an audit session for `review status`.
        await workspace.gitInit();
        const base = await workspace.gitCommitAll("baseline");
        await buildOk(product, workspace, "T13.3-2 (corrupt record) `build`");
        await expectExit(
          product,
          workspace,
          ["review", "create", "--strategy", "audit", "--name", "s"],
          0,
          "T13.3-2 (corrupt record) staging `review create --strategy " +
            "audit --name s` (SPEC 10.7)",
        );
        await corruptGraphDataShapeBlind(
          workspace.root,
          "T13.3-2 (corrupt record) staging",
        );
        const corrupted = await snapshotDirectory(workspace.root);
        const outsideGraph = filteredEntries(
          corrupted.entries,
          (key) => !isGraphDataKey(key),
        );

        const recordProbes: readonly SweepProbe[] = [
          {
            label: "`ids --json`",
            run: async () => {
              const label = "T13.3-2 (corrupt record) `ids --json`";
              const ids = decodeIdsReport(
                await runJson(product, workspace, ["ids", "--json"], label),
                label,
              );
              assertSameJson(
                ids.files,
                [{ file: A_ROOT, ids: ["alpha", "beta"] }],
                `${label}: the current sources' IDs, answered finding-free ` +
                  `(SPEC 13.3, 12.3)`,
              );
            },
          },
          {
            label: "`show`",
            run: async () => {
              const label = `T13.3-2 (corrupt record) \`show ${ALPHA} --json\``;
              const node = decodeNodeReport(
                await runJson(
                  product,
                  workspace,
                  ["show", ALPHA, "--json"],
                  label,
                ),
                label,
              );
              assertBytesEqual(
                node.subtreeText,
                "Alpha depends on beta.\n",
                `${label}: subtree text from the current sources (SPEC ` +
                  `13.3, 12.4)`,
              );
            },
          },
          {
            label: "`coverage --json`",
            run: async () => {
              const label = "T13.3-2 (corrupt record) `coverage --json`";
              const coverage = decodeCoverageReport(
                await runJson(
                  product,
                  workspace,
                  ["coverage", "--json"],
                  label,
                ),
                label,
              );
              const profile = coverage.profiles.find((p) => p.name === "p");
              if (profile === undefined) {
                fail(
                  `${label}: the configured profile "p" must be reported ` +
                    `(SPEC 8.2); got ` +
                    JSON.stringify(coverage.profiles.map((p) => p.name)),
                );
              }
              assertSameJson(
                {
                  covered: profile.covered,
                  uncovered: profile.uncovered,
                },
                {
                  covered: [{ identity: BETA, path: [ALPHA, BETA] }],
                  uncovered: [ALPHA],
                },
                `${label}: beta covered through alpha's d edge, alpha ` +
                  `uncovered (SPEC 8.2, 13.3)`,
              );
            },
          },
          {
            label: "`impact --base`",
            run: async () => {
              const label = `T13.3-2 (corrupt record) \`impact --base ${base} --json\``;
              const impact = decodeImpactReport(
                await runJson(
                  product,
                  workspace,
                  ["impact", "--base", base, "--json"],
                  label,
                ),
                label,
              );
              assertSameJson(
                {
                  requirements: impact.requirements,
                  direct: impact.code.direct,
                  transitive: impact.code.transitive,
                },
                { requirements: [], direct: [], transitive: [] },
                `${label}: current sources equal the baseline — no ` +
                  `categories, no impacted code (SPEC 5.6, 9.3, 13.3)`,
              );
            },
          },
          {
            label: "`review status`",
            run: async () => {
              const status = await sessionStatus(
                product,
                workspace,
                "s",
                "T13.3-2 (corrupt record)",
              );
              assertStatusRows(
                status,
                [
                  { scope: A_ROOT, status: "unresolved", blocked: true },
                  { scope: ALPHA, status: "unresolved", blocked: false },
                  { scope: BETA, status: "unresolved", blocked: false },
                ],
                "T13.3-2 (corrupt record) `review status s --json` — the " +
                  "session answers on the passing workspace (SPEC 10.6, " +
                  "10.7, 13.3)",
              );
            },
          },
          {
            label: "`query nodes`",
            run: async () => {
              const label = "T13.3-2 (corrupt record) `query nodes`";
              const rows = decodeNodeRowsReport(
                await runJson(product, workspace, ["query", "nodes"], label),
                label,
              );
              for (const identity of [ALPHA, BETA]) {
                if (!rows.some((row) => row.identity === identity)) {
                  fail(
                    `${label}: expected ${identity} among the rows (SPEC ` +
                      `11, 13.3); got ` +
                      JSON.stringify(rows.map((row) => row.identity).sort()),
                  );
                }
              }
            },
          },
          {
            label: "`occurrences`",
            run: async () => {
              const label = "T13.3-2 (corrupt record) `occurrences`";
              const report = decodeOccurrencesReport(
                await runJson(product, workspace, ["occurrences"], label),
                label,
              );
              assertSameJson(
                {
                  findings: report.findings,
                  occurrences: occurrenceIdentitySummaries(report.occurrences),
                },
                {
                  findings: [],
                  occurrences: [
                    {
                      file: A_ROOT,
                      kind: "depends",
                      source: ALPHA,
                      target: BETA,
                    },
                  ],
                },
                `${label}: the one staged occurrence, finding-free — no ` +
                  `condition-23 finding accompanies a refreshing read's ` +
                  `answer (SPEC 11.3, 13.3, 14.23)`,
              );
            },
          },
          {
            label: "`view`",
            run: async () => {
              const label = "T13.3-2 (corrupt record) `view`";
              const view = decodeViewFilesReport(
                await runJson(product, workspace, ["view"], label),
                label,
              );
              assertSameJson(
                view,
                { findings: [], files: [A_ROOT] },
                `${label}: the whole-domain request answers finding-free — ` +
                  `nothing is reported for the record (SPEC 11.4, 13.3, ` +
                  `14.23)`,
              );
            },
          },
          {
            label: "`at`",
            run: async () => {
              // Byte 30 lies inside "Alpha depends on beta." — within
              // alpha's construct (bytes 0..55), outside the d entry's
              // occurrence span ("beta" at bytes 18..24) (SPEC 11.5, 1.7).
              const label = "T13.3-2 (corrupt record) `at specs/A.mdx 30`";
              assertAtAnswer(
                decodeAtReport(
                  await runJson(
                    product,
                    workspace,
                    ["at", A_ROOT, "30"],
                    label,
                  ),
                  label,
                ),
                ALPHA,
                label,
              );
            },
          },
        ];

        for (const probe of recordProbes) {
          await probe.run();

          // The corrupt state persists — neither read, repaired, nor
          // replaced (SPEC 13.3): the record-consulting surface still
          // reports the record-supplied datum explicitly unavailable, with
          // the 14.23 outcome's exit 1 (the finding's full form is
          // T11.6-4's home).
          const invLabel = `T13.3-2 (corrupt record) \`inventory\` after ${probe.label}`;
          const invResult = await runCli(product, workspace, ["inventory"]);
          assertExitCode(
            invResult,
            1,
            `${invLabel} — an inventory answer carrying the condition-23 ` +
              `finding exits 1 (SPEC 14.23, 11.6, 12.0)`,
          );
          const recorded = decodeInventoryRecordedDatum(
            parseJsonStdout(invResult, invLabel),
            invLabel,
          );
          if (recorded.state !== "unavailable") {
            fail(
              `${invLabel}: the record-supplied datum must still be ` +
                `explicitly unavailable — a refreshing read leaves the ` +
                `corrupt record state neither read, repaired, nor ` +
                `replaced, and it is never read as an empty record (SPEC ` +
                `13.3, 14.23, 11.6); got state ` +
                JSON.stringify(recorded.state),
            );
          }

          // Outside the graph data, nothing changed: no TypeScript or
          // Markdown generated or removed, sources and durable files
          // untouched (SPEC 13.3, 13.4; graph-data bytes stay unpinned —
          // module header).
          const after = await snapshotDirectory(workspace.root);
          assertSnapshotsEqual(
            asSnapshot(workspace.root, outsideGraph),
            asSnapshot(
              workspace.root,
              filteredEntries(after.entries, (key) => !isGraphDataKey(key)),
            ),
            `T13.3-2 (corrupt record) after ${probe.label} and its ` +
              `inventory probe: outside the graph data the workspace must ` +
              `be byte-identical — no TypeScript or Markdown generated or ` +
              `removed, journal, session, and source files untouched ` +
              `(SPEC 13.3, 13.4)`,
          );
        }

        // Until a successful `build` replaces the state (SPEC 13.3, 14.10,
        // 12.1): afterwards the record-supplied datum is the plain recorded
        // derived-file paths again, at exit 0 on the clean workspace.
        await buildOk(
          product,
          workspace,
          "T13.3-2 (corrupt record) `build` over the corrupt-record state " +
            "— a successful build replaces the record (SPEC 12.1, 13.4, " +
            "14.10)",
        );
        const recoveredLabel =
          "T13.3-2 (corrupt record) `inventory` after the rebuild";
        const recovered = decodeInventoryRecordedDatum(
          await runJson(product, workspace, ["inventory"], recoveredLabel),
          recoveredLabel,
        );
        if (recovered.state !== "value") {
          fail(
            `${recoveredLabel}: after a successful \`build\` replaces the ` +
              `corrupt record, the record-supplied datum is the plain ` +
              `recorded derived-file paths again — never unavailability, ` +
              `never null (SPEC 13.3, 14.23, 11.6, 12.7); got state ` +
              JSON.stringify(recovered.state),
          );
        }
        if (!recovered.value.includes("specs/A.xspec.ts")) {
          fail(
            `${recoveredLabel}: the recorded derived-file paths — the ` +
              `paths as last generated, companions included — must name ` +
              `the generated module specs/A.xspec.ts (SPEC 11.6, 13.1, ` +
              `13.3); got ${JSON.stringify(recovered.value)}`,
          );
        }
      },
    );
  },
});

/**
 * Assert a `check` findings report consists solely of 14.10 staleness
 * findings against one source's generated module and companions: every
 * finding carries condition 14.10 and a file under `<prefix>`, and the
 * module `<module>` itself is among the named files (SPEC 14.10, 13.1).
 */
function assertStaleModuleFindings(
  findings: readonly Finding[],
  prefix: string,
  module: string,
  context: string,
): void {
  if (findings.length === 0) {
    fail(
      `${context}: expected at least one 14.10 staleness finding (SPEC ` +
        `14.10); got none`,
    );
  }
  for (const finding of findings) {
    if (finding.condition !== "14.10") {
      fail(
        `${context}: every finding here must be condition 14.10 — the only ` +
          `staged condition is the stale/orphaned generated output (SPEC ` +
          `14.10); got ${JSON.stringify(finding.condition)} (message: ` +
          `${JSON.stringify(finding.message)})`,
      );
    }
    if (typeof finding.path !== "string" || !finding.path.startsWith(prefix)) {
      fail(
        `${context}: a 14.10 finding must name the stale derived file as ` +
          `its concerned path, all of which are ${prefix}* here (SPEC ` +
          `14.10, 13.1, 12.7); got ${JSON.stringify(finding.path)} ` +
          `(message: ${JSON.stringify(finding.message)})`,
      );
    }
  }
  if (!findings.some((finding) => finding.path === module)) {
    fail(
      `${context}: the generated module ${module} must be among the named ` +
        `stale files (SPEC 14.10, 13.1); named: ` +
        JSON.stringify(findings.map((finding) => finding.path)),
    );
  }
}

// ---------------------------------------------------------------------------
// T13.3-3 — failed refresh
// ---------------------------------------------------------------------------

const T13_3_3_A = [
  '<S id="alpha">',
  "Alpha intro.",
  '<S id="alpha.one">',
  "Alpha-one text.",
  "</S>",
  "</S>",
  "",
  '<S id="gamma">',
  "Gamma text.",
  "</S>",
  "",
].join("\n");
const T13_3_3_B_VALID = ['<S id="beta">', "Beta text.", "</S>", ""].join("\n");
// A non-root section without `id` — build validation condition 14.1.
const T13_3_3_B_INVALID = ["<S>", "Beta text.", "</S>", ""].join("\n");

// --- Whole-gate arm fixtures (SPEC 13.3; see the module header) ---

const JOURNAL_PATH = ".xspec/journal";
const LF = 0x0a;

// Deliberately structureless bytes no conforming entry format accepts — the
// TEST-SPEC-sanctioned malformed-journal staging (T6.1-3's shape, H-4).
const GATE_GARBAGE_LINE = "?? harness-injected garbage: not a journal entry ??";

// One reference occurrence (alpha's d entry to beta) keeps every never-gated
// answer contentful; the sources are otherwise finding-free, so the staged
// journal/write-path state is the workspace's only build-failing condition.
const T13_3_3_GATE_A = [
  '<S id="alpha" d={["beta"]}>',
  "Alpha depends on beta.",
  "</S>",
  "",
  '<S id="beta">',
  "Beta text.",
  "</S>",
  "",
].join("\n");
// An unreferenced section for the legitimate journaled rename (line 1).
const T13_3_3_GATE_T = ['<S id="tmp">', "Tmp text.", "</S>", ""].join("\n");

// The obstructed-write-path workspace: emission redirected under
// `markdown.outDir`, so a plain file at `mdout` obstructs the emit write
// path `mdout/specs/A.md` at its first component (SPEC 7.3, 13.2, 13.4).
const T13_3_3_OUTDIR_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  markdown: { emit: true, outDir: "mdout" },
  coverage: [
    {
      name: "p",
      target: "main",
      targets: "all",
      boundary: "main",
      mode: "direct"
    }
  ]
})
`;

/** Lines in a line-oriented file, either final-line convention (T6.1-3). */
function journalLineCount(bytes: Uint8Array): number {
  if (bytes.length === 0) return 0;
  let count = 0;
  for (const byte of bytes) {
    if (byte === LF) count += 1;
  }
  if (bytes[bytes.length - 1] !== LF) count += 1;
  return count;
}

/**
 * Does a 14.13 finding name the garbage line (line 2)? T6.1-3's H-4
 * operationalization: the message echoing the garbage line's text or citing
 * line/entry 2 — a journal condition carries the journal path it concerns
 * and no in-source location (SPEC 14, 12.7), so the lines are named in the
 * message — or, tolerated, a location within the garbage line's byte window
 * in `.xspec/journal`.
 */
function findingNamesGarbageLine(
  finding: Finding,
  window: { readonly start: number; readonly end: number },
): boolean {
  if (finding.message.includes(GATE_GARBAGE_LINE)) return true;
  if (/\b(?:line|entry)\s*#?\s*2\b/i.test(finding.message)) return true;
  if (finding.message.includes("journal:2")) return true;
  return finding.locations.some(
    (location) =>
      location.file === JOURNAL_PATH &&
      location.range.start >= window.start &&
      location.range.end <= window.end + 1,
  );
}

/**
 * The gated reads' whole-gate invocations (SPEC 13.3; `review` represented
 * by `status`, the read subcommand — the mutating subcommands are the
 * invalid-sources workspace's subject): the five reads taking no baseline,
 * plus `impact --base <impactBase>` when a baseline is supplied — the
 * obstructed-write staging alone, against a commit taken before the
 * obstruction was staged; the journal-error staging supplies none, `impact`
 * being absent from it by necessity (TEST-SPEC T13.3-3; module header).
 */
function gatedReadInvocations(
  alpha: string,
  impactBase?: string,
): readonly { readonly argv: readonly string[]; readonly what: string }[] {
  const impact =
    impactBase === undefined
      ? []
      : [
          {
            argv: ["impact", "--base", impactBase, "--json"],
            what: "`impact --base <ref> --json`",
          },
        ];
  return [
    { argv: ["ids", "--json"], what: "`ids --json`" },
    { argv: ["show", alpha, "--json"], what: `\`show ${alpha} --json\`` },
    { argv: ["coverage", "--json"], what: "`coverage --json`" },
    ...impact,
    {
      argv: ["review", "status", "s", "--json"],
      what: "`review status s --json`",
    },
    { argv: ["query", "nodes"], what: "`query nodes`" },
  ];
}

/**
 * One whole-gate probe (SPEC 13.3): the gated read reports exactly the
 * staged gate finding, exits 1, answers nothing (stdout is the findings
 * report, like a failed build — the module's T13.3-3 operationalization),
 * and modifies nothing: journal, sessions, derived files, graph data, and
 * `.git/` byte-identical around the invocation.
 */
async function probeWholeGate(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  counts: Readonly<Record<string, number>>,
  verifyFinding: (finding: Finding, context: string) => void,
  context: string,
): Promise<void> {
  await assertLeavesUnchanged(
    workspace.root,
    async () => {
      const result = await runCli(product, workspace, argv);
      assertExitCode(
        result,
        1,
        `${context} — the gate is over every finding a \`build\` would ` +
          `report, source validity or not: the gated read reports it and ` +
          `exits 1 without answering (SPEC 13.3, 12.0)`,
      );
      const findings = decodeFindingsReport(
        parseJsonStdout(result, context),
        context,
      ).findings;
      assertConditionCounts(
        findings,
        counts,
        `${context} — exactly the staged gate finding is reported, like a ` +
          `failed build (SPEC 13.3, 14)`,
      );
      verifyFinding(findings[0] as Finding, context);
    },
    `${context} — journal, sessions, derived files, and graph data must be ` +
      `byte-identical around the gated read (SPEC 13.3)`,
  );
}

/**
 * The never-gated contrast (SPEC 13.3, 11.2, 11.6) on a whole-gate
 * workspace staged with `T13_3_3_GATE_A` as its one occurrence-bearing spec
 * source: `occurrences`, `view`, and `at` answer per file — complete and
 * finding-free at exit 0, the gate condition being no domain file's finding
 * — and `inventory` answers whatever the sources' validity, none of them
 * modifying anything (whole-root byte compare per probe).
 */
async function assertNeverGatedAnswers(
  product: ProductBinding,
  workspace: TestWorkspace,
  viewFiles: readonly string[],
  context: string,
): Promise<void> {
  const A_ROOT = "specs/A.mdx";
  const ALPHA = "specs/A.mdx#alpha";
  const BETA = "specs/A.mdx#beta";

  const occurrencesLabel = `${context} \`occurrences\``;
  await assertLeavesUnchanged(
    workspace.root,
    async () => {
      const report = decodeOccurrencesReport(
        await runJson(product, workspace, ["occurrences"], occurrencesLabel),
        occurrencesLabel,
      );
      assertSameJson(
        {
          findings: report.findings,
          occurrences: occurrenceIdentitySummaries(report.occurrences),
        },
        {
          findings: [],
          occurrences: [
            { file: A_ROOT, kind: "depends", source: ALPHA, target: BETA },
          ],
        },
        `${occurrencesLabel}: the staged occurrence, finding-free at exit 0 ` +
          `— the gate condition is no domain file's finding, so it ` +
          `accompanies no answer of this surface (SPEC 11.2, 11.3, 13.3)`,
      );
    },
    `${occurrencesLabel} answers from the current sources and modifies ` +
      `nothing — no graph data, no derived files (SPEC 11.2, 13.3)`,
  );

  const viewLabel = `${context} \`view\``;
  await assertLeavesUnchanged(
    workspace.root,
    async () => {
      const view = decodeViewFilesReport(
        await runJson(product, workspace, ["view"], viewLabel),
        viewLabel,
      );
      assertSameJson(
        view,
        { findings: [], files: viewFiles },
        `${viewLabel}: the whole-domain request answers every discovered ` +
          `spec source, finding-free at exit 0, whatever journal or ` +
          `write-path state the workspace holds (SPEC 11.2, 11.4, 13.3)`,
      );
    },
    `${viewLabel} answers from the current sources and modifies nothing ` +
      `(SPEC 11.2, 13.3)`,
  );

  // Byte 30 lies inside "Alpha depends on beta." — within alpha's construct
  // (bytes 0..55), outside the d entry's occurrence span ("beta" at bytes
  // 18..24) (SPEC 11.5, 1.7).
  const atLabel = `${context} \`at specs/A.mdx 30\``;
  await assertLeavesUnchanged(
    workspace.root,
    async () => {
      assertAtAnswer(
        decodeAtReport(
          await runJson(product, workspace, ["at", A_ROOT, "30"], atLabel),
          atLabel,
        ),
        ALPHA,
        atLabel,
      );
    },
    `${atLabel} answers from the current sources and modifies nothing ` +
      `(SPEC 11.2, 11.5, 13.3)`,
  );

  const inventoryLabel = `${context} \`inventory\``;
  await assertLeavesUnchanged(
    workspace.root,
    async () => {
      const recorded = decodeInventoryRecordedDatum(
        await runJson(product, workspace, ["inventory"], inventoryLabel),
        inventoryLabel,
      );
      if (recorded.state !== "value") {
        fail(
          `${inventoryLabel}: the inventory parses no sources and reads no ` +
            `journal content — it answers whatever the workspace's gate ` +
            `state, and with the record intact the record-supplied datum ` +
            `is the plain recorded derived-file paths (SPEC 11.6, 13.3, ` +
            `14.23); got state ${JSON.stringify(recorded.state)}`,
        );
      }
      if (!recorded.value.includes("specs/A.xspec.ts")) {
        fail(
          `${inventoryLabel}: the recorded derived-file paths must name ` +
            `the generated module specs/A.xspec.ts (SPEC 11.6, 13.1); got ` +
            JSON.stringify(recorded.value),
        );
      }
    },
    `${inventoryLabel} neither refreshes nor writes anything (SPEC 11.6)`,
  );
}

const T13_3_3 = defineProductTest({
  id: "T13.3-3",
  title:
    "with invalid sources, each read command and each mutating review subcommand (create under --base/--strategy audit/--coverage, resolve, split) reports the validation errors, exits 1, answers nothing, and modifies nothing — no session created, and session file, journal, derived files, and graph data byte-identical; the gate is over every finding a `build` would report: with a garbage journal line staged, ids, show, coverage, review status, and query each report exactly the journal error (14.13) naming the line — `impact` absent from that staging by necessity, a garbage line meeting baseline resolution first (exit 2, T6.3-4) — and with an obstructed write path staged, the same five and `impact --base` against a commit taken before the obstruction (its baseline resolving) each report exactly the refused write (14.22) naming its offending component — exit 1, answer nothing, and modify nothing, while on the same workspaces occurrences, view, and at answer per file finding-free at exit 0 and inventory answers, none of them modifying anything (SPEC 13.3, 11.2, 11.6, 12.0, 14)",
  run: async (product) => {
    await withWorkspace(
      {
        "xspec.config.ts": GRAPH_CONFIG,
        "specs/A.mdx": T13_3_3_A,
        "specs/B.mdx": T13_3_3_B_VALID,
      },
      async (workspace) => {
        const ALPHA = "specs/A.mdx#alpha";
        const ALPHA_ONE = "specs/A.mdx#alpha.one";
        const GAMMA = "specs/A.mdx#gamma";

        // --- Staging while the sources are valid: a resolvable commit, a
        // build, and a session holding a resolved leaf so that `alpha`'s
        // subtree-coherence item is unblocked (its scope root has a child,
        // so `split` would apply) and `gamma`'s leaf item is unblocked and
        // unresolved (so `resolve` would apply).
        await workspace.gitInit();
        const base = await workspace.gitCommitAll("valid baseline");
        await buildOk(product, workspace, "T13.3-3 staging `build`");
        await expectExit(
          product,
          workspace,
          ["review", "create", "--strategy", "audit", "--name", "s"],
          0,
          "T13.3-3 staging `review create --strategy audit --name s`",
        );
        const initial = await sessionStatus(
          product,
          workspace,
          "s",
          "T13.3-3 staging",
        );
        const alphaOneItem = requireRowByScope(
          initial,
          ALPHA_ONE,
          "T13.3-3 staging item lookup",
        ).id;
        await resolveNoChange(product, workspace, "s", alphaOneItem, "T13.3-3");
        const staged = await sessionStatus(
          product,
          workspace,
          "s",
          "T13.3-3 staging (after resolving the alpha.one leaf)",
        );
        const alphaRow = requireRowByScope(
          staged,
          ALPHA,
          "T13.3-3 staging item lookup",
        );
        const gammaRow = requireRowByScope(
          staged,
          GAMMA,
          "T13.3-3 staging item lookup",
        );
        if (alphaRow.kind !== "subtree-coherence" || alphaRow.blocked) {
          fail(
            "T13.3-3 staging premise: alpha's item must be an unblocked " +
              "subtree-coherence item whose scope root has a child (its " +
              "alpha.one blocker is resolved, SPEC 10.6, 10.3), so `split` " +
              "names an item it would otherwise decompose (SPEC 10.7); got " +
              JSON.stringify(alphaRow),
          );
        }
        if (gammaRow.status !== "unresolved" || gammaRow.blocked) {
          fail(
            "T13.3-3 staging premise: gamma's leaf item must be unblocked " +
              "and unresolved (SPEC 10.6), so `resolve` names an item it " +
              "would otherwise resolve (SPEC 10.7); got " +
              JSON.stringify(gammaRow),
          );
        }

        // --- The invalidating edit: B.mdx now fails build validation with
        // exactly one condition (14.1, missing id). The baseline commit
        // predates it, so baseline resolution succeeds and the refresh
        // failure is the operative error (SPEC 12.0, 6.3).
        await workspace.file("specs/B.mdx", T13_3_3_B_INVALID);

        /**
         * Run one probe: exit 1, stdout is the findings report carrying
         * exactly the staged validation error (naming specs/B.mdx), and the
         * whole workspace — session file, journal, derived files, graph
         * data, `.git/` — is byte-identical around the command.
         */
        const probeFailedRefresh = async (
          argv: readonly string[],
          what: string,
        ): Promise<void> => {
          const context = `T13.3-3 ${what}`;
          await assertLeavesUnchanged(
            workspace.root,
            async () => {
              const result = await runCli(product, workspace, argv);
              assertExitCode(
                result,
                1,
                `${context} — a failed refresh reports the validation ` +
                  `errors and exits 1 without answering (SPEC 13.3, 12.0)`,
              );
              const findings = decodeFindingsReport(
                parseJsonStdout(result, context),
                context,
              ).findings;
              assertConditionCounts(
                findings,
                { "14.1": 1 },
                `${context} — exactly the staged validation error is ` +
                  `reported, like a failed build (SPEC 13.3, 14.1)`,
              );
              const finding = findings[0] as Finding;
              assertFindingLocated(
                finding,
                { file: "specs/B.mdx" },
                `${context} — the validation error identifies the broken ` +
                  `source (SPEC 14)`,
              );
            },
            context,
          );
        };

        // The six refreshing reads (SPEC 13.3).
        await probeFailedRefresh(["ids", "--json"], "`ids --json`");
        await probeFailedRefresh(
          ["show", ALPHA, "--json"],
          `\`show ${ALPHA} --json\``,
        );
        await probeFailedRefresh(["coverage", "--json"], "`coverage --json`");
        await probeFailedRefresh(
          ["impact", "--base", base, "--json"],
          "`impact --base <valid-ref> --json` (baseline resolution " +
            "succeeds, so the refresh failure is the operative error)",
        );
        await probeFailedRefresh(
          ["review", "status", "s", "--json"],
          "`review status s --json`",
        );
        await probeFailedRefresh(["query", "nodes"], "`query nodes`");

        // `check` — a read command of 13.3, though it never refreshes:
        // exit 1 with the validation error among its findings, modifying
        // nothing. Lenient on the findings multiset (whether staleness
        // findings are detectable beside the validation error is T14-4's
        // reporter-matrix business, not 13.3's).
        await assertLeavesUnchanged(
          workspace.root,
          async () => {
            const label = "T13.3-3 `check --json`";
            const result = await runCli(product, workspace, [
              "check",
              "--json",
            ]);
            assertExitCode(
              result,
              1,
              `${label} — invalid sources are findings (SPEC 12.2)`,
            );
            const findings = decodeFindingsReport(
              parseJsonStdout(result, label),
              label,
            ).findings;
            if (
              !findings.some(
                (finding) =>
                  finding.condition === "14.1" &&
                  finding.locations.some(
                    (location) => location.file === "specs/B.mdx",
                  ),
              )
            ) {
              fail(
                `${label}: the staged validation error (14.1 in ` +
                  `specs/B.mdx) must be reported (SPEC 12.2, 14.1); got ` +
                  JSON.stringify(
                    findings.map((finding) => ({
                      condition: finding.condition,
                      locations: finding.locations,
                    })),
                  ),
              );
            }
          },
          "T13.3-3 `check` with invalid sources modifies nothing",
        );

        // The mutating review subcommands observe the same rule — 13.3
        // binds `review` whole, and create/resolve/split all consult the
        // current graph (SPEC 13.3, 10.7): no session file is created, no
        // status recorded, no decomposition.
        await probeFailedRefresh(
          ["review", "create", "--base", base, "--name", "nb", "--json"],
          "`review create --base <valid-ref> --name nb --json` (baseline " +
            "resolution precedes source validation, 12.0, so the refresh " +
            "failure is the operative error — exit 1, not 2)",
        );
        await probeFailedRefresh(
          ["review", "create", "--strategy", "audit", "--name", "na", "--json"],
          "`review create --strategy audit --name na --json`",
        );
        await probeFailedRefresh(
          ["review", "create", "--coverage", "p", "--name", "nc", "--json"],
          "`review create --coverage p --name nc --json`",
        );
        await probeFailedRefresh(
          [
            "review",
            "resolve",
            "s",
            gammaRow.id,
            "--status",
            "no-change",
            "--json",
          ],
          "`review resolve s <unblocked item> --status no-change --json` " +
            "(no status recorded)",
        );
        await probeFailedRefresh(
          ["review", "split", "s", alphaRow.id, "--json"],
          "`review split s <unblocked splittable item> --json` (no " +
            "decomposition)",
        );
      },
    );

    // --- Whole-gate arm 1: garbage journal line (14.13). The gate is over
    // every finding a `build` would report, source validity or not (SPEC
    // 13.3); the staging is explained in the module header. The five reads
    // taking no baseline are driven — `impact` is absent from this staging
    // by necessity (a garbage line meets baseline resolution first, exit 2,
    // T6.3-4; module header) — so no git repository is staged: no baseline
    // to resolve, the gate alone standing between each invocation and an
    // answer. Discriminates a product that gates on source validity alone
    // and answers `query` from a broken journal with exit 0 (refresh
    // consumes the journal for canonical identities, SPEC 5.4).
    await withWorkspace(
      {
        "xspec.config.ts": GRAPH_CONFIG,
        "specs/A.mdx": T13_3_3_GATE_A,
        "specs/T.mdx": T13_3_3_GATE_T,
      },
      async (workspace) => {
        const context = "T13.3-3 (garbage journal)";
        const ALPHA = "specs/A.mdx#alpha";

        await buildOk(product, workspace, `${context} staging \`build\``);
        // Journal line 1: one legitimate journaled operation — the rename
        // of the unreferenced tmp section — so the garbage lands on line 2
        // ("naming the line" has teeth, T6.1-3) and the journal really
        // participates in canonical identities (SPEC 6.1, 6.4, 5.4).
        await expectExit(
          product,
          workspace,
          ["rename", "specs/T.mdx", "tmp", "tmp2"],
          0,
          `${context} staging \`rename specs/T.mdx tmp tmp2\` — the ` +
            `legitimate journal entry (SPEC 6.4, 6.1)`,
        );
        await expectExit(
          product,
          workspace,
          ["review", "create", "--strategy", "audit", "--name", "s"],
          0,
          `${context} staging \`review create --strategy audit --name s\` ` +
            `(SPEC 10.7)`,
        );

        // Append the garbage as its own line 2 (whole-line append under
        // either final-line convention; shape-independent, H-4).
        const journalKind = await workspace.kind(JOURNAL_PATH);
        if (journalKind !== "file") {
          fail(
            `${context}: staging premise — the journaled rename brings the ` +
              `journal into existence as a plain file at ${JOURNAL_PATH} ` +
              `(SPEC 6.1, 13.4); found ${journalKind}`,
          );
        }
        const legitimate = await workspace.readBytes(JOURNAL_PATH);
        if (journalLineCount(legitimate) !== 1) {
          fail(
            `${context}: staging premise — one journaled operation yields ` +
              `a one-line journal (SPEC 6.1), so the garbage lands on line ` +
              `2; found ${String(journalLineCount(legitimate))} line(s)`,
          );
        }
        const needsTerminator =
          legitimate.length > 0 && legitimate[legitimate.length - 1] !== LF;
        const garbageStart = legitimate.length + (needsTerminator ? 1 : 0);
        await workspace.file(
          JOURNAL_PATH,
          Buffer.concat([
            legitimate,
            Buffer.from(
              (needsTerminator ? "\n" : "") + GATE_GARBAGE_LINE + "\n",
              "utf8",
            ),
          ]),
        );
        const window = {
          start: garbageStart,
          end: garbageStart + Buffer.byteLength(GATE_GARBAGE_LINE, "utf8"),
        };

        for (const probe of gatedReadInvocations(ALPHA)) {
          await probeWholeGate(
            product,
            workspace,
            probe.argv,
            { "14.13": 1 },
            (finding, findingContext) => {
              assertFindingConcernsPath(
                finding,
                JOURNAL_PATH,
                `${findingContext} — a journal condition carries the ` +
                  `journal path it concerns (SPEC 14, 12.7)`,
              );
              if (!findingNamesGarbageLine(finding, window)) {
                fail(
                  `${findingContext}: the 14.13 finding must name the ` +
                    `malformed line — the garbage on line 2 (SPEC 14.13 ` +
                    `"naming the lines"): the garbage line's text, a ` +
                    `line/entry-2 citation, or a location within bytes ` +
                    `[${String(window.start)}, ${String(window.end)}] of ` +
                    `${JOURNAL_PATH}; got ${JSON.stringify(finding)}`,
                );
              }
            },
            `${context} ${probe.what}`,
          );
        }

        // Never-gated contrast on the same workspace (SPEC 11.2, 11.6).
        await assertNeverGatedAnswers(
          product,
          workspace,
          ["specs/A.mdx", "specs/T.mdx"],
          context,
        );
      },
    );

    // --- Whole-gate arm 2: obstructed write path (14.22). After a
    // successful build (and a session for `review status`), the
    // `markdown.outDir` directory is replaced by a plain file: the emit
    // write path `mdout/specs/A.md` then has its workspace-relative
    // component `mdout` occupied by a non-directory — the one offending
    // component, so `build` would report exactly the one condition-22
    // finding (SPEC 13.4, 14.22; module header). This staging alone drives
    // `impact --base` beside the five other reads, against the commit taken
    // before the obstruction was staged (TEST-SPEC T13.3-3).
    await withWorkspace(
      {
        "xspec.config.ts": T13_3_3_OUTDIR_CONFIG,
        "specs/A.mdx": T13_3_3_GATE_A,
      },
      async (workspace) => {
        const context = "T13.3-3 (obstructed write path)";
        const ALPHA = "specs/A.mdx#alpha";

        await workspace.gitInit();
        // The commit taken before the obstruction is staged — `impact
        // --base`'s baseline: pristine valid sources and configuration at
        // the ref, the journal absent on both sides (an empty journal is a
        // prefix of every journal), so the baseline resolves and 14.22 is
        // the operative gate finding (SPEC 6.3, 12.0).
        const base = await workspace.gitCommitAll(
          "baseline (valid sources, before the obstruction)",
        );
        await buildOk(
          product,
          workspace,
          `${context} staging \`build\` — emits under markdown.outDir ` +
            `(SPEC 7.3, 13.2, 12.1)`,
        );
        await expectExit(
          product,
          workspace,
          ["review", "create", "--strategy", "audit", "--name", "s"],
          0,
          `${context} staging \`review create --strategy audit --name s\` ` +
            `(SPEC 10.7)`,
        );

        // Staging premises: emission landed under mdout/ preserving
        // workspace-relative paths (SPEC 7.3, 13.2), so mdout is a
        // component of a path `build` writes.
        const mdoutKind = await workspace.kind("mdout");
        if (mdoutKind !== "dir") {
          fail(
            `${context}: staging premise — \`build\` with emission enabled ` +
              `under markdown.outDir creates the mdout/ directory (SPEC ` +
              `7.3, 13.2, 13.4); found ${mdoutKind}`,
          );
        }
        const emittedKind = await workspace.kind("mdout/specs/A.md");
        if (emittedKind !== "file") {
          fail(
            `${context}: staging premise — emission under outDir preserves ` +
              `workspace-relative paths, so specs/A.mdx emits ` +
              `mdout/specs/A.md (SPEC 7.3, 13.2); found ${emittedKind}`,
          );
        }

        // Obstruct: replace the directory with a plain file (the emitted
        // Markdown goes with it — staleness is invisible here: 14.10 is
        // `check`-only, and `build` would refuse at the obstruction).
        await fsp.rm(workspace.path("mdout"), { recursive: true, force: true });
        await workspace.file("mdout", "not a directory\n");

        for (const probe of gatedReadInvocations(ALPHA, base)) {
          await probeWholeGate(
            product,
            workspace,
            probe.argv,
            { "14.22": 1 },
            (finding, findingContext) => {
              assertFindingConcernsPath(
                finding,
                "mdout",
                `${findingContext} — the refused write's concerned path is ` +
                  `the offending component's workspace-relative path ` +
                  `(SPEC 14.22, 13.4)`,
              );
            },
            `${context} ${probe.what}`,
          );
        }

        // Never-gated contrast on the same workspace (SPEC 11.2, 11.6).
        await assertNeverGatedAnswers(
          product,
          workspace,
          ["specs/A.mdx"],
          context,
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T13.3-4 — determinism
// ---------------------------------------------------------------------------

// A workspace exercising the enumerated graph-data content (SPEC 13.3):
// nested sections, a dependency edge, tags, a coverage attribute, a
// subdirectory source, and a configured coverage profile. No git: graph data
// derives from sources and configuration alone.
const T13_3_4_FILES: Readonly<Record<string, string>> = {
  "xspec.config.ts": GRAPH_CONFIG,
  "specs/A.mdx": [
    '<S id="alpha" d={["beta"]} tags="core deep">',
    "Alpha depends on beta.",
    '<S id="alpha.one" coverage="none">',
    "Alpha-one text.",
    "</S>",
    "</S>",
    "",
    '<S id="beta">',
    "Beta text.",
    "</S>",
    "",
  ].join("\n"),
  "specs/sub/C.mdx": [
    '<S id="gamma" tags="edge">',
    "Gamma text.",
    "</S>",
    "",
  ].join("\n"),
};

const T13_3_4 = defineProductTest({
  id: "T13.3-4",
  title:
    "graph data files are byte-deterministic across rebuilds of an identical workspace — same-workspace rebuilds and the two-directory protocol (content otherwise unasserted, H-4) (SPEC 13.3, 12.0)",
  run: async (product) => {
    // Same-workspace form: build once, then rebuild twice via the H-6
    // run-twice protocol; the graph data written by every rebuild is
    // byte-identical to the first build's.
    await withWorkspace(T13_3_4_FILES, async (workspace) => {
      await buildOk(product, workspace, "T13.3-4 initial `build`");
      const first = await snapshotDirectory(workspace.root);
      assertGraphDataPresent(first, "T13.3-4 after the initial `build`");
      const pair = await assertRunTwiceDeterministic({
        binding: product,
        run: { cwd: workspace.root, argv: ["build"] },
        context:
          "T13.3-4 H-6 run-twice determinism of `build` over the identical " +
          "workspace",
      });
      assertExitCode(
        pair.first,
        0,
        "T13.3-4 rebuilding the identical workspace succeeds (SPEC 12.1)",
      );
      const afterRebuilds = await snapshotDirectory(workspace.root);
      assertSnapshotsEqual(
        asSnapshot(workspace.root, graphDataEntries(first)),
        asSnapshot(workspace.root, graphDataEntries(afterRebuilds)),
        "T13.3-4: graph data after the rebuilds vs after the initial " +
          "`build` — byte-deterministic across rebuilds of an identical " +
          "workspace (SPEC 13.3, 12.0; H-4 self-comparison)",
      );
    });

    // Two-directory form (H-6): the identical workspace built in two
    // separate directories yields byte-identical graph data (workspace-
    // relative paths make the compare well-defined across directories).
    const made: TestWorkspace[] = [];
    try {
      const result = await assertAcrossDirectoriesDeterministic({
        makeWorkspace: async () => {
          const workspace = await TestWorkspace.create({
            files: T13_3_4_FILES,
          });
          made.push(workspace);
          return workspace;
        },
        binding: product,
        makeRun: (workspace) => ({ cwd: workspace.root, argv: ["build"] }),
        context:
          "T13.3-4 H-6 two-directory determinism of `build` over identical " +
          "workspaces",
      });
      assertExitCode(
        result.first,
        0,
        "T13.3-4 `build` succeeds in the two-directory protocol (SPEC 12.1)",
      );
      const snapshotFirst = await snapshotDirectory(result.firstWorkspace.root);
      const snapshotSecond = await snapshotDirectory(
        result.secondWorkspace.root,
      );
      assertGraphDataPresent(
        snapshotFirst,
        "T13.3-4 after `build` in directory 1",
      );
      assertSnapshotsEqual(
        asSnapshot(result.firstWorkspace.root, graphDataEntries(snapshotFirst)),
        asSnapshot(
          result.secondWorkspace.root,
          graphDataEntries(snapshotSecond),
        ),
        "T13.3-4: graph data of the two directories' builds — " +
          "byte-deterministic for identical workspaces (SPEC 13.3, 12.0)",
      );
    } finally {
      for (const workspace of made) {
        await workspace.dispose();
      }
    }
  },
});

/** TEST-SPEC §13.3, in canonical ID order (SUITE-46). */
export const section133Tests: readonly ProductTestEntry[] = [
  T13_3_1,
  T13_3_2,
  T13_3_3,
  T13_3_4,
];
