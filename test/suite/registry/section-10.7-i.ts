// TEST-SPEC §10.7 (review commands), first half — SUITE-38:
// T10.7-1…T10.7-6 (create flag exclusivity; recorded creation parameters;
// unresolvable baseline; coverage sessions; `list`; `status`). T10.7-7…12
// are SUITE-39's business.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), decodes output through the H-3 adapters,
// and rejects a product only via diagnosed assertion failures (H-8).
//
// SPEC 10.7: `create` requires exactly one of `--base`, `--strategy audit`,
// `--coverage` and records the creation parameters fully resolved (baseline
// commit identity; the coverage profile's definition with group names
// replaced by glob lists and kind; nothing for audit); later generator runs
// use the recorded parameters while discovery follows the current
// configuration. A baseline that cannot be resolved or reconstructed fails
// per 6.3 as a usage error, modifying nothing. A coverage session holds one
// `uncovered-requirement` item per uncovered required node, ordered by file
// path then document order. `list` reports every session in byte order of
// name with stored-status counts (no read-time invalidation) and corrupt
// sessions by name, exit 1 iff any is corrupt. `status` reports items in
// item order with id, kind, scope, status, and blocked state plus totals by
// status (read-time invalidation applied).
//
// Conservative operationalizations (noted per H-3/H-4):
// - `context` and `origin` are asserted as sorted identity sets: SPEC 10.7
//   fixes their membership, not a payload order; texts and byte-level
//   payload contracts are T10.7-12's business.
// - Item order is asserted as the exact row sequence of `status` and
//   `export`.
// - `status` totals and `list` counts are compared as `record[status] ?? 0`
//   per defined status: whether zero-count statuses appear as explicit
//   entries is concrete-shape territory (H-3).
// - `list`'s `strategy` field is byte-asserted against the strategy names
//   SPEC 10 itself fixes (`path-blocks`, `audit`, `coverage`): the built-in
//   strategies are named by the specification, so the name is required
//   information, not concrete shape.
// - Recorded creation parameters are product-shaped and opaque (H-4):
//   "records the profile definition with group names replaced by glob
//   lists" is asserted behaviorally (the discriminating arms of T10.7-2)
//   plus a string-leaf containment check — the recorded definition must hold
//   the group's configured glob (a spec-fixed value) — and "the recorded
//   parameters the session runs with never change" as canonical-JSON
//   equality of the reported member across the configuration edit (the
//   §10.2/§10.6 operationalization).
// - T10.7-1's foreign `--strategy` values — `path-blocks` and `coverage`,
//   the strategies `--base` and `--coverage` alone select (10.5, 10.7), and
//   `bogus` — are each a usage error of the syntax class (SPEC 12.0: a
//   fixed vocabulary decides them, the invocation's arguments alone): the
//   shared discipline (support.ts `expectSyntaxClassUsageError`, T12.0-10's)
//   runs each on the configured workspace and on its configuration-state
//   twins (`stageConfigurationStateTwins`: `specs/W.mdx` beside the invalid
//   configuration `UNKNOWN_KEY_CONFIG`, and beside none) — the plain usage
//   error, `code` and `path` `null`, its document byte-identical across the
//   three, each twin unchanged — so a product loading configuration first
//   answers 14.14 on the invalid twin and fails at the plain-error pin. The
//   other flag arms keep their exit-2 error-document check.
// - The T10.7-4 absent-scope ordering keys exercised are presence grouping
//   and scope-node identity, staged discriminatingly (recorded document
//   order opposite to identity order), and the final item `id` tiebreak.
//   The tiebreak needs two same-kind absent items with equal identity
//   strings: same kind forces distinct scope nodes (10.5: at most one item
//   per kind and scope node), and distinct nodes present one identity only
//   through reintroduction after a journaled rename or move (5.4: the
//   reintroducing node starts a new canonical chain; 10.4: reads map each
//   recorded identity forward through the journal). T10.7-4's item-id tie
//   sub-fixture stages it with two leaves of one file: the original a,
//   renamed to b by a journaled `rename` and deleted by manual edit, and a
//   new leaf a — authored after that rename, its item entering through an
//   `updated` resolve's re-derivation, which re-runs the generators with the
//   session's recorded profile (10.5, 10.7) — renamed to b in turn and
//   deleted. Both items then present their scope absent under
//   specs/A.mdx#b, and the sub-fixture asserts them after the file's
//   present-scope item in item-id byte order (12.0) in `status`, `export`,
//   and the `next` walk, reading the ids from the product. In coverage, as
//   in audit (T10.6-2), a section carries the tie — every uncovered required
//   node has its item, so the new leaf's enters in its own right — where
//   path-blocks needs two file roots (T10.5-4).
// - "Modifying nothing" (T10.7-3) is the compare-around-command protocol
//   over the whole workspace root, `.git/` included: the failing command
//   reads git but writes nothing anywhere (SPEC 6.3, 10.7; the `.git/`
//   byte-compare is also SPEC.md-preamble territory, T12.0-11).
// - Corrupt-session staging (T10.7-5) uses the shape-independent state
//   (unparseable bytes written over a session file the product itself
//   wrote), per the T10.1-4 staging conventions — no session file is ever
//   fabricated from an assumed layout. T10.7-1's existing-corrupt-session
//   arms stage T10.1-4's states the same way: unparseable bytes, a
//   directory, and a symbolic link (to a valid session the product wrote)
//   directly; an invariant violation (an unknown item status) through the
//   H-3 adapter over the product-written file. `create` naming the corrupt
//   session then reports condition 21 in the code-less refusal's place —
//   exactly one finding, exit 1, nothing modified (SPEC 10.1, 10.7, 14.21):
//   identity, count, and empty locations, and its concerned path, which is
//   pinned — a session condition carries the file it concerns (SPEC 14,
//   12.7), the session's own file `.xspec/reviews/s.json` (10.1), for a
//   symbolic link there the link's own path, never its target's (13.4).
//   So it does where the name matches the corrupt session's ignoring ASCII
//   case alone (SPEC 10.1: such a name is treated at `create` as that
//   existing session's): `create --name Foo` beside a corrupt `foo.json`
//   (T10.1-4's garbage bytes) reports exactly that finding, concerning the
//   stored file's own path `.xspec/reviews/foo.json`, and writes no
//   `Foo.json` — the whole-root compare's (a new entry on a case-sensitive
//   filesystem, changed bytes on a case-insensitive one) — so a product
//   matching names case-insensitively against readable sessions alone
//   creates the session and fails at the exit code. A name matching
//   several sessions ignoring ASCII case names each (10.1), the corruption
//   one finding per corrupt session it matches and the refusal not beside
//   them (10.7): on the Linux leg (`CASE_PAIR_STAGED`: only there are
//   `foo.json` and `FOO.json` two directory entries; a case-insensitive
//   filesystem holds one file under both casings), three case-pair arms,
//   each a fresh workspace holding both — a valid `foo.json` written by
//   its own `create`, a valid `FOO.json` written by `create` in an
//   identical twin workspace and copied in byte for byte
//   (`TestWorkspace.copyFrom`; the workspace's own `create --name FOO` is
//   refused), a corrupt one the garbage bytes: (i) both corrupt — `--name
//   Foo` reports exactly two condition-21 findings, `FOO.json`'s then
//   `foo.json`'s (12.7: equal codes and empty locations, so by concerned
//   path bytes, `F` before `f`); (ii) `foo.json` valid, `FOO.json` corrupt
//   — `--name Foo`, and `--name foo`, whose exact match is the valid
//   session, each exactly `FOO.json`'s finding, no refusal; (iii) both
//   valid — `--name Foo` exactly one code-less refusal through the shared
//   check below. Every `create` there runs inside a whole-root compare: no
//   `Foo.json` created, both files byte-unchanged — failing a product that
//   reports the first match alone, a refusal beside the corruption, or one
//   refusal per match.
//   The code-less existing-name refusal itself is asserted in T10.7-14's
//   finding form through the shared check (support.ts
//   `expectReviewRefusal`): exactly one finding, `code` `null`, `locations`
//   `[]`, and `path` `null` — 14 gives a review-operation refusal neither
//   location nor concerned path (SPEC 14, 12.7) — its `identities`
//   informational and unasserted, the session file byte-identical and the
//   whole root unchanged around the run. T10.7-5's corrupt listing asks
//   its condition-21 finding the same way — identity (its exact stable code
//   `corrupt-session`, TEST-SPEC line 9), count, empty locations, and
//   concerned path, the session's own file `.xspec/reviews/c.json` — with
//   no invocation of its own: `list` reports condition 21 for each corrupt
//   session (14.21, exit 1) under the listing's `"findings"` member (12.7),
//   which the decoder requires while a session is listed corrupt (H-3).
//   Exactly one finding, where T10.1-4 reads at least one across its
//   states: the unparseable bytes violate nothing but parseability — no
//   invariant is read from bytes that do not parse, so no second violation
//   stands beside it as a distinct finding (T14-4's reading of its garbage
//   session) — and the three other sessions are healthy.
// - T10.7-5's human form (T12.0-1's information parity; SPEC 12.0: the JSON
//   form carries the same information as the human report): after each of
//   its two `--json` listings and their assertions, at the same state, the
//   same argv without `--json` exits alike — 0 for the clean listing, 1 with
//   `c` corrupt — and its report mentions what the decoded listing carries
//   (a product-to-itself comparison, H-4; `assertHumanSessionList`, through
//   helpers/adapters/human.ts): every session's name (a session-name
//   boundary, so `a` never counts inside `a2`), each healthy session's
//   strategy and every status it has a nonzero stored count under
//   (SPEC-named tokens), each nonzero count (a whole number, matched with the
//   digit-holding names — `a2` — blanked out), and `corrupt` for the corrupt
//   session (robust matching, H-3: presence, never wording). Limits: no
//   mention is associated with another, so which count belongs to which
//   session and status, and that a corrupt session's fields are absent, stay
//   with the JSON assertions; at the corrupt state the report also carries
//   condition 21's finding (14.21), which may itself name the session, say
//   "corrupt", and hold digits, so those mentions do not tell the session's
//   own entry from the finding — which session is corrupt is the JSON
//   listing's assertion too.
// - T10.7-6's human form (T12.0-1's information parity; SPEC 12.0): after
//   each of its four stages' `--json` status reads and their assertions, at
//   the same state, `review status s` without `--json` exits 0 as well, and
//   its report mentions what the decoded report carries (a product-to-itself
//   comparison, H-4; `assertHumanSessionStatus`, through
//   helpers/adapters/human.ts): every row's id (an item-id boundary, so
//   `item-1` never counts inside `item-10`) and scope (an identity boundary,
//   so the root's `specs/T.mdx` never counts inside `specs/T.mdx#p`), its
//   kind and status (SPEC-named tokens), `blocked` wherever some row is
//   blocked (10.3), every status with a nonzero total, and each nonzero total
//   (a whole number, matched with the digit-holding ids and scopes blanked
//   out: item ids are the product's own and may hold digits). A datum that
//   is itself a whole number — an id `4` — stays unblanked here, as in
//   T10.7-5's count check (`digitHoldingData`): substring blanking cannot
//   tell it from a total of its value, so blanking it would fail a
//   conforming report that prints both; such an id and a total of its value
//   may then stand in for each other. Limits: no mention is associated
//   with another, so which row has which id, scope, kind, and status, which
//   row is blocked (a report may spell the token for unblocked rows too),
//   and which total labels which status stay with the JSON assertions — a
//   status token found on a row also satisfies a total's, and a report may
//   name every status beside a zero count.
// - T12.0-15's stagings (section-12.0-iv.ts; TEST-SPEC T12.0-15's `review`
//   fixtures `list` (T10.7-5), `status` (T10.7-6), and the refusals of
//   T10.7-1): T10.7-5's body is `runT1075Listings(product, visit)`, each of
//   its two `review list` reads — the clean listing, then the one with c
//   corrupt — handed to `visit` with its pinned exit and the home test's
//   own read, assertions, and human parity check as `home`; T10.7-6's is
//   `runT1076Stages(product, visit)`, each of its four stages' `review
//   status s` reads handed so, stage A's `home` asserting over the
//   staging's own read (its rows' ids are the items the staging resolves,
//   its item order the staging's premise). The home tests pass `home`
//   through; T12.0-15 hands its human twin in its place, the staging
//   between the reads the home test's own. T10.7-1's body is
//   `runT1071Stagings(product, visitor)`, over support.ts' refusal
//   protocol (`ReviewRefusalVisitor`, which T10.7-9's and T10.7-10's
//   stagings share, section-10.7-ii.ts): each refused `create` — the
//   existing valid session's, each corrupt state's, the case-fold arm's,
//   and on the Linux leg the case pairs' four — handed to
//   `visitor.refusal` with its argv and the home test's own check of it
//   (`expectReviewRefusal`, or `expectCreateCorruptionReported`, which
//   pins the corruption findings) as `home`, and the flag arms
//   (`runT1071FlagArms`) run where `visitor.home` holds. T10.7-1 passes
//   `REVIEW_REFUSAL_HOME`, so every assertion runs as before; T12.0-15 a
//   visitor whose `home` is false, its human twin at each refusal, the
//   staging's workspaces, sessions, and corrupt states kept.
// - Workspaces are git-less wherever no baseline is involved (T10.7-2,
//   T10.7-4, T10.7-6): coverage and audit sessions require no git.
// - Every fixture edit is followed by an explicit `build` before any read,
//   so no read relies on the 13.3 refresh path (T13.3-*'s business).
// - Staged-source records (helpers/staged-mdx.ts, S-9: judged before any
//   product exists): every `.mdx` edit a body stages after its first product
//   invocation over the harness's own bytes — T10.7-2's B.mdx and
//   extra/N.mdx additions (N.mdx is the same call in both arms: one
//   record), T10.7-3's par edit, T10.7-4's two deletions, T10.7-5's w edit,
//   T10.7-6's p.a edit — is the same template call moved to module level as
//   a record, as are the initial `.mdx` files of the workspaces created
//   after a body's first invocation — T10.7-1's configuration-state twins
//   and its corrupt-session, case-fold, and case-pair workspaces with the
//   case pair's identical twin (`W1_SOURCE`, the one record serving the
//   body's first workspace too), T10.7-2's audit arm (leaf a, the coverage
//   arm's same call: one record staged in both), T10.7-4's item-id tie
//   sub-fixture (its specs/A.mdx), and T10.7-5's and T10.7-6's first
//   workspaces' sources (specs/W.mdx and specs/T.mdx: T12.0-15 runs those
//   two stagings after its body's first invocation, below); every other
//   initial `files` entry, a body's first workspace's, stays plain;
//   T10.7-1's and T10.7-5's corrupt-session bytes stage no `.mdx` path.
//   Each record T12.0-15 stages names it (`W1_SOURCE` among them: it
//   stages T10.7-1's every workspace). The tie sub-fixture's three edits
//   follow a `rename` and change bytes the product rewrote, which no
//   harness constant equals, so each is an anchored `workspace.edit()`, its
//   anchor's uniqueness diagnosed first (SPEC 6.4 fixes the rewritten
//   form), as T10.4-4's reintroduction arm stages.
// - TypeScript staged-source records (helpers/staged-ts.ts; S-9's TypeScript
//   and timing clauses), every one well-formed: the configurations of those
//   later workspaces — `COVERAGE_CONFIG` (T10.7-1's corrupt-session,
//   case-fold, and case-pair workspaces and the case pair's twin,
//   T10.7-4's item-id tie sub-fixture, and T10.7-1's and T10.7-5's
//   workspaces as T12.0-15 stages them) and `SPECS_ONLY_CONFIG` (T10.7-2's
//   audit arm, and T10.7-6's workspace as T12.0-15 stages it), each staged
//   wherever that configuration is — and T10.7-2's two post-create
//   configuration edits (`C2_CONFIG_EDITED`, `A2_CONFIG_EDITED`); T10.7-1's
//   invalid configuration-state twin stages support.ts's record
//   `UNKNOWN_KEY_CONFIG`.

import { Buffer } from "node:buffer";
import * as fsp from "node:fs/promises";
import type {
  ExportReport,
  Finding,
  ItemKind,
  ItemStatus,
  Mention,
  NodeReport,
  ReviewItem,
  SessionListEntry,
  SessionListReport,
  SessionStatusReport,
  SessionStatusRow,
} from "../../helpers/adapters/index.js";
import {
  ITEM_STATUSES,
  assertReportMentions,
  decodeExportReport,
  decodeNextReport,
  decodeNodeReport,
  decodeSessionListReport,
  decodeSessionStatusReport,
  identityMention,
  nameMention,
  numberMention,
  specTokenMention,
  stageUnknownItemStatus,
} from "../../helpers/adapters/index.js";
import {
  assertExitCode,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { assertLeavesUnchanged } from "../../helpers/snapshot.js";
import { stagedMdx } from "../../helpers/staged-mdx.js";
import { type StagedTs, stagedTs } from "../../helpers/staged-ts.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { InitialFileContents } from "../../helpers/workspace.js";
import type { ReviewRefusalVisitor } from "./support.js";
import {
  REVIEW_REFUSAL_HOME,
  assertConditionCounts,
  assertFindingConcernsPath,
  assertSameJson,
  buildOk,
  expectErrorDocument,
  expectExit,
  expectSyntaxClassUsageError,
  runCli,
  runFindingsReport,
  runJson,
  stageConfigurationStateTwins,
  visitReviewRefusal,
} from "./support.js";

// Minimal declarative configuration (SPEC 7): exactly one spec group.
const SPECS_ONLY_CONFIG = stagedTs(
  "T10.7-2/T12.0-15 xspec.config.ts — one spec group",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
);

// One spec group plus a direct coverage profile over it (SPEC 7.4): with the
// group serving as its own boundary, a leaf is covered exactly when some
// non-root node has a single dependency edge to it (SPEC 8).
const COVERAGE_CONFIG = stagedTs(
  "T10.7-1/T10.7-4/T12.0-15 xspec.config.ts — one spec group and the coverage profile p",
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

/** `review list --json` expecting exit 0 (no corrupt session), decoded. */
async function listSessions(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
): Promise<SessionListReport> {
  const label = `${context} \`review list --json\``;
  return decodeSessionListReport(
    await runJson(product, workspace, ["review", "list", "--json"], label),
    label,
  );
}

/** `review create --strategy audit --name <name>` must succeed (SPEC 10.7). */
async function createAuditSession(
  product: ProductBinding,
  workspace: TestWorkspace,
  name: string,
  context: string,
): Promise<void> {
  await expectExit(
    product,
    workspace,
    ["review", "create", "--strategy", "audit", "--name", name],
    0,
    `${context} \`review create --strategy audit --name ${name}\``,
  );
}

/** `review create --coverage <profile> --name <name>` must succeed. */
async function createCoverageSession(
  product: ProductBinding,
  workspace: TestWorkspace,
  profile: string,
  name: string,
  context: string,
): Promise<void> {
  await expectExit(
    product,
    workspace,
    ["review", "create", "--coverage", profile, "--name", name],
    0,
    `${context} \`review create --coverage ${profile} --name ${name}\``,
  );
}

/** `review create --base <ref> --name <name>` must succeed (SPEC 10.7). */
async function createBaseSession(
  product: ProductBinding,
  workspace: TestWorkspace,
  ref: string,
  name: string,
  context: string,
): Promise<void> {
  await expectExit(
    product,
    workspace,
    ["review", "create", "--base", ref, "--name", name],
    0,
    `${context} \`review create --base ${ref} --name ${name}\``,
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
 * missing or duplicated (SPEC 10.1, 10.5: at most one item per kind and
 * scope node — the invariant holds for every strategy).
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
        `(SPEC 10.1, 10.5: a session never contains two items with the same ` +
        `kind and scope node); found ${String(rows.length)} among ` +
        JSON.stringify(report.items.map((row) => `${row.kind} ${row.scope}`)),
    );
  }
  return rows[0];
}

/** The unique full item for a kind and scope node in an export item list. */
function requireItem(
  items: readonly ReviewItem[],
  kind: ItemKind,
  scope: string,
  context: string,
): ReviewItem {
  const matches = items.filter(
    (item) => item.kind === kind && item.scope.node === scope,
  );
  if (matches.length !== 1) {
    fail(
      `${context}: expected exactly one ${kind} item scoped at ${scope} ` +
        `(SPEC 10.1, 10.5: at most one item per kind and scope node); found ` +
        `${String(matches.length)} among ` +
        JSON.stringify(items.map((item) => `${item.kind} ${item.scope.node}`)),
    );
  }
  return matches[0];
}

/** In-order `kind scope status` rendering of status rows (order compare). */
function rowSequence(report: SessionStatusReport): readonly string[] {
  return report.items.map((row) => `${row.kind} ${row.scope} ${row.status}`);
}

/** In-order `kind scope` rendering of export items (order compare). */
function exportKindScopeSequence(
  items: readonly ReviewItem[],
): readonly string[] {
  return items.map((item) => `${item.kind} ${item.scope.node}`);
}

/** Sorted node-identity set of a payload node list (membership compare). */
function identitySet(
  states: readonly { readonly node: string }[],
): readonly string[] {
  return states.map((state) => state.node).sort();
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

/**
 * A non-corrupt `list` entry's counts, compared as `counts[status] ?? 0` per
 * defined status — stored statuses, no read-time invalidation (SPEC 10.7).
 */
function assertStoredCounts(
  entry: SessionListEntry,
  expected: Readonly<Record<ItemStatus, number>>,
  context: string,
): void {
  if (entry.corrupt) {
    fail(
      `${context}: expected a non-corrupt list entry for session ` +
        `${entry.name} (SPEC 10.7); the product reports it corrupt`,
    );
  }
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

/**
 * The data a human-form check blanks out of a report before matching its
 * whole numbers (helpers/adapters/human.ts' `blank` option): each datum that
 * holds a digit, save one that is itself a whole number — substring blanking
 * cannot tell such a datum (an item id `4`, which SPEC 10.2 leaves to the
 * product) from a count of its value, so blanking it would erase that count
 * wherever the report prints it and fail a conforming report (the module
 * header). Exported for section-10.7-ii.ts' human `show` check (T10.7-8,
 * T10.7-12), section-6.6.ts' human preview check (T6.6-4, T6.6-5, T6.6-6),
 * section-8.ts' human coverage check (T8.2-1), section-12.3-12.5.ts' human
 * `show` check (T12.4-1), and human-findings.ts' shared human-findings
 * check (T14-1's human `build` and `check`).
 */
export function digitHoldingData(data: readonly string[]): readonly string[] {
  return data.filter((datum) => /[0-9]/.test(datum) && !/^[0-9]+$/.test(datum));
}

/**
 * The human `review list` at the state of a decoded `review list --json`
 * listing, after that listing's own assertions — T12.0-1's information
 * parity (SPEC 12.0: the JSON form carries the same information as the
 * human report; the module header): the same argv without `--json` exits
 * with the listing's exit code, and its report mentions, for every entry of
 * the decoded listing, the session's name (a session-name boundary) and
 * either its strategy, each status it stores items under, and each nonzero
 * stored count (a whole number, matched with the listing's digit-holding
 * session names blanked out), or — a corrupt session — the token `corrupt`
 * (SPEC 10.7, 14.21). Robust matching (H-3): presence, never wording, and no
 * mention associated with another. A listing with no entries asserts the
 * exit code alone.
 */
async function assertHumanSessionList(
  product: ProductBinding,
  workspace: TestWorkspace,
  listing: SessionListReport,
  exitCode: number,
  context: string,
): Promise<void> {
  const label = `${context} \`review list\` (human report)`;
  const human = await expectExit(
    product,
    workspace,
    ["review", "list"],
    exitCode,
    `${label} — the same exit code as the \`--json\` listing at this ` +
      `state: 1 iff a session is corrupt, else 0 (SPEC 10.7, 12.0, 14.21)`,
  );
  const names: Mention[] = [];
  const tokens = new Set<string>();
  const counts = new Set<number>();
  for (const entry of listing.sessions) {
    names.push(nameMention(entry.name));
    if (entry.corrupt) {
      tokens.add("corrupt");
      continue;
    }
    tokens.add(entry.strategy);
    for (const status of ITEM_STATUSES) {
      const count = entry.counts[status] ?? 0;
      if (count > 0) {
        tokens.add(status);
        counts.add(count);
      }
    }
  }
  if (names.length > 0) {
    assertReportMentions(
      human,
      [...names, ...[...tokens].map(specTokenMention)],
      `${label}: every session's name, each healthy session's strategy and ` +
        `every status it stores items under, and \`corrupt\` for a corrupt ` +
        `session — the information of the JSON listing (SPEC 10.7, 12.0, ` +
        `14.21)`,
    );
  }
  if (counts.size > 0) {
    assertReportMentions(
      human,
      [...counts].map(numberMention),
      `${label}: each nonzero stored count, a whole number, matched with ` +
        `the listing's digit-holding session names blanked out (SPEC 10.7, ` +
        `12.0)`,
      { blank: digitHoldingData(listing.sessions.map((entry) => entry.name)) },
    );
  }
}

/**
 * The human `review status <name>` at the state of a decoded `review status
 * <name> --json` report, after that report's own assertions — T12.0-1's
 * information parity (SPEC 12.0: the JSON form carries the same information
 * as the human report; the module header): the same argv without `--json`
 * exits 0, and its report mentions, for every row of the decoded report, the
 * item's id (an item-id boundary), its scope (an identity boundary), and its
 * kind and status (SPEC-named tokens); the token `blocked` wherever some row
 * is blocked (SPEC 10.3); and every status with a nonzero total (a
 * SPEC-named token) and each nonzero total (a whole number, matched with the
 * digit-holding ids and scopes — and the session's name, should it hold a
 * digit — blanked out, since item ids are the product's own and may hold
 * digits; `digitHoldingData` leaves a datum that is itself a whole number
 * unblanked). Robust matching (H-3): presence, never wording, and no mention
 * associated with another. A report with no rows and no nonzero total
 * asserts the exit code alone.
 */
async function assertHumanSessionStatus(
  product: ProductBinding,
  workspace: TestWorkspace,
  name: string,
  report: SessionStatusReport,
  context: string,
): Promise<void> {
  const label = `${context} \`review status ${name}\` (human report)`;
  const human = await expectExit(
    product,
    workspace,
    ["review", "status", name],
    0,
    `${label} — the same exit code as the \`--json\` report at this state ` +
      `(SPEC 10.7, 12.0)`,
  );
  const data: Mention[] = [];
  const tokens = new Set<string>();
  for (const row of report.items) {
    data.push(nameMention(row.id), identityMention(row.scope));
    tokens.add(row.kind);
    tokens.add(row.status);
    if (row.blocked) tokens.add("blocked");
  }
  const totals = new Set<number>();
  for (const status of ITEM_STATUSES) {
    const total = report.totals[status] ?? 0;
    if (total > 0) {
      tokens.add(status);
      totals.add(total);
    }
  }
  const mentions = [...data, ...[...tokens].map(specTokenMention)];
  if (mentions.length > 0) {
    assertReportMentions(
      human,
      mentions,
      `${label}: every row's id, scope, kind, and status, \`blocked\` where ` +
        `a row is blocked, and every status with a nonzero total — the ` +
        `information of the JSON report (SPEC 10.3, 10.7, 12.0)`,
    );
  }
  if (totals.size > 0) {
    assertReportMentions(
      human,
      [...totals].map(numberMention),
      `${label}: each nonzero total by status, a whole number, matched with ` +
        `the digit-holding ids, scopes, and session name blanked out, save ` +
        `a datum that is itself a whole number (SPEC 10.7, 12.0)`,
      {
        blank: digitHoldingData([
          name,
          ...report.items.flatMap((row) => [row.id, row.scope]),
        ]),
      },
    );
  }
}

/**
 * Canonical JSON rendering: object members sorted by key, arrays in order,
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
 * Run `review create` with `--json` appended, expecting a usage error: exact
 * exit 2 with the single 12.7 error document as the entire stdout (SPEC
 * 12.0, 12.7; H-5).
 */
async function expectCreateUsageError(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  context: string,
): Promise<void> {
  const result = await expectExit(
    product,
    workspace,
    [...argv, "--json"],
    2,
    `${context} — a usage error (SPEC 10.7, 12.0)`,
  );
  expectErrorDocument(
    result,
    `${context} — under --json, the exit-2 error document is the entire ` +
      `stdout (SPEC 12.0, 12.7, H-5)`,
  );
}

// ---------------------------------------------------------------------------
// T10.7-1 — create flags
// ---------------------------------------------------------------------------

const W1_FILE = "specs/W.mdx";
// Staged by the body's first workspace and, after its invocations, by its
// configuration-state twins and by every later workspace — each
// corrupt-session state's, the case-fold arm's, each case-pair arm's, and
// the case pair's identical twin — and by T12.0-15, which runs the staging
// (`runT1071Stagings`) after its own body's earlier invocations: one
// staged-source record (S-9's before-any-product and timing clauses),
// wrapped in place.
const W1_SOURCE = stagedMdx(
  "T10.7-1/T12.0-15 specs/W.mdx (the flag-exclusivity workspace's initial source, its configuration-state twins', and every later workspace's: each corrupt-session state's, the case-fold and case-pair arms', and the case pair's identical twin's)",
  ['<S id="w">', "Dub text.", "</S>", ""].join("\n"),
);

/** A session's file under the session directory (SPEC 10.1). */
function sessionRelOf(name: string): string {
  return `.xspec/reviews/${name}.json`;
}

/** The session every existing-session arm of T10.7-1 names, and its file. */
const W1_SESSION = "s";
const W1_SESSION_REL = sessionRelOf(W1_SESSION);

/**
 * The values `--strategy` refuses, each a usage error of the syntax class
 * (SPEC 10.7: the flag accepts `audit` alone; 12.0: a fixed vocabulary
 * decides it, from the arguments alone): `path-blocks` and `coverage`, the
 * strategies `--base` and `--coverage` alone select (10.5, 10.7), and
 * `bogus` (TEST-SPEC T10.7-1; T12.0-10 covers `bogus` alone).
 */
const W1_FOREIGN_STRATEGIES: readonly string[] = [
  "path-blocks",
  "coverage",
  "bogus",
];

/**
 * T10.1-4's garbage-bytes corruption: unparseable, so shape-independent and
 * staged directly, no product-written session needed.
 */
const W1_GARBAGE = "this is deliberately not a JSON document ][}{\n";

/**
 * The case-fold names (SPEC 10.1): `foo` and `FOO` name the stored
 * sessions; `Foo`, matching each ignoring ASCII case alone and neither
 * exactly, is the name the case-fold `create`s are given.
 */
const FOLD_LOWER = "foo";
const FOLD_UPPER = "FOO";
const FOLD_MIXED = "Foo";

/**
 * Whether T10.7-1's case-pair arms are staged: `foo.json` and `FOO.json`
 * stand as two directory entries only where file names' case tells entries
 * apart — the Linux leg (TEST-SPEC T10.7-1); a case-insensitive filesystem
 * holds one file under both casings.
 */
const CASE_PAIR_STAGED = process.platform === "linux";

/**
 * The staged occupant of a session path must be what the arm claims — a
 * harness staging check (a plain error, never a diagnosed failure, H-8).
 */
async function requireStagedKind(
  workspace: TestWorkspace,
  rel: string,
  expected: "file" | "dir" | "symlink",
  context: string,
): Promise<void> {
  const staged = await workspace.kind(rel);
  if (staged !== expected) {
    throw new Error(
      `${context} staging: expected ${rel} to hold a ${expected} once ` +
        `staged; found ${staged} (a harness staging error, not a product ` +
        `observation)`,
    );
  }
}

/** Stage T10.1-4's garbage bytes as session `name`'s file. */
async function stageGarbageSession(
  workspace: TestWorkspace,
  name: string,
  context: string,
): Promise<void> {
  const rel = sessionRelOf(name);
  await workspace.file(rel, W1_GARBAGE);
  await requireStagedKind(workspace, rel, "file", context);
}

/**
 * After `review create --strategy audit --name <name>` exited 0, the session
 * is stored at its own path as a plain file (SPEC 10.1) — a product
 * observation, diagnosed (H-8).
 */
async function requireCreatedSessionFile(
  workspace: TestWorkspace,
  name: string,
  context: string,
): Promise<void> {
  const rel = sessionRelOf(name);
  const kind = await workspace.kind(rel);
  if (kind !== "file") {
    fail(
      `${context}: after \`review create --strategy audit --name ${name}\` ` +
        `exited 0, the session is stored at ${rel} as a plain file (SPEC ` +
        `10.1); found ${kind}`,
    );
  }
}

/**
 * Stage a valid session `name` the product itself writes: `create` in an
 * identical twin workspace — this workspace's configuration and sources,
 * built — and its file copied in byte for byte (TEST-SPEC T10.7-1: the
 * workspace's own `create` refuses a name matching one of its sessions
 * ignoring ASCII case; T10.1-4's rule: no session file is ever fabricated
 * from an assumed layout). The twin is disposed once the copy is made.
 */
async function copyTwinCreatedSession(
  product: ProductBinding,
  workspace: TestWorkspace,
  name: string,
  context: string,
): Promise<void> {
  await withWorkspace(
    COVERAGE_CONFIG,
    { [W1_FILE]: W1_SOURCE },
    async (twin) => {
      const twinContext = `${context} [identical twin workspace]`;
      await buildOk(product, twin, `${twinContext} \`build\``);
      await createAuditSession(product, twin, name, twinContext);
      await requireCreatedSessionFile(twin, name, twinContext);
      await workspace.copyFrom(twin, sessionRelOf(name));
    },
  );
  await requireStagedKind(workspace, sessionRelOf(name), "file", context);
}

/**
 * `review create --strategy audit --name <name>` — the command line every
 * `create` arm of T10.7-1 past the flag checks runs (`--json` added).
 */
function createAuditArgv(name: string): readonly string[] {
  return ["review", "create", "--strategy", "audit", "--name", name];
}

/** The existing-session arms' command line, naming `s`. */
const W1_CREATE_S = createAuditArgv(W1_SESSION);

/**
 * `review create --strategy audit --name <name> --json` where the name
 * matches existing corrupt sessions — exactly, or ignoring ASCII case alone,
 * which `create` treats as naming that existing session (SPEC 10.1) —
 * `corruptRels` their files in 12.7 order, beside any valid session the name
 * also matches (SPEC 10.7, 14.21): the corruption is reported in the
 * refusal's place — exit 1 with the findings-only report holding exactly
 * one finding per corrupt session matched, condition 21 `corrupt-session`,
 * and no code-less refusal beside them — each with no in-source location
 * (locations [], SPEC 12.7), and nothing modified anywhere under the root
 * (the whole-root compare: no session written, `<name>.json` included; the
 * snapshot never follows links, so a link occupant and its target are both
 * covered). Each finding carries the session file it concerns as its 12.7
 * `path` — the corrupt session's own, as stored (SPEC 14, 12.7, 10.1: for
 * `--name Foo` beside `foo.json`, `.xspec/reviews/foo.json`), in the
 * symbolic-link state the link's own path, never its target `real.json`
 * (13.4) — the findings ordered by concerned path bytes (12.7: equal codes,
 * empty locations). The existing-name refusal itself, the name matching
 * valid sessions alone, is the shared T10.7-14 check's (support.ts
 * `expectReviewRefusal`).
 */
async function expectCreateCorruptionReported(
  product: ProductBinding,
  workspace: TestWorkspace,
  name: string,
  corruptRels: readonly string[],
  context: string,
): Promise<void> {
  const argv = [...createAuditArgv(name), "--json"];
  const label = `${context} \`${argv.join(" ")}\``;
  const count = corruptRels.length;
  const counted =
    count === 1
      ? "exactly one finding: the name matches a corrupt session"
      : `exactly ${String(count)} findings: the name matches ` +
        `${String(count)} corrupt sessions`;
  await assertLeavesUnchanged(
    workspace.root,
    async () => {
      const findings = await runFindingsReport(
        product,
        workspace,
        argv,
        1,
        `${label} — a refused review operation exits 1 with the ` +
          `findings-only report as the entire stdout (SPEC 10.7, 12.0, 12.7)`,
      );
      assertConditionCounts(
        findings,
        { "14.21": count },
        `${label} — ${counted} (${corruptRels.join(", ")}) — exactly, or ` +
          `ignoring ASCII case alone, which \`create\` treats as naming the ` +
          `existing session — so the corruption is reported in the ` +
          `refusal's place: one finding per corrupt session matched, ` +
          `condition 21 \`corrupt-session\`, no code-less refusal beside ` +
          `${count === 1 ? "it" : "them"} (SPEC 10.1, 10.7, 14.21)`,
      );
      findings.forEach((finding, index) => {
        const rel = corruptRels[index]!;
        const which = `finding ${String(index + 1)} of ${String(count)}`;
        assertSameJson(
          finding.locations,
          [],
          `${label}: ${which} has no in-source location — locations [] ` +
            `(SPEC 12.7)`,
        );
        assertFindingConcernsPath(
          finding,
          rel,
          `${label}: ${which} — a session condition carries the session ` +
            `file it concerns, the corrupt session's own path as stored, ` +
            `${rel} (a symbolic link there by its own path, never its ` +
            `target's), the findings ordered by concerned path bytes ` +
            `(SPEC 14, 12.7, 10.1, 13.4)`,
        );
      });
    },
    `${label} — the refused create modifies nothing: no session written ` +
      `(no ${sessionRelOf(name)} created), every existing session's file, ` +
      `occupant, and link target byte-unchanged (SPEC 10.1, 10.7)`,
  );
}

/**
 * One corrupt state of the existing session `s`, staged T10.1-4's way on a
 * built workspace: the shape-independent states directly, the invariant
 * violation through the H-3 adapter over a session file the product wrote.
 */
interface CorruptCreateArm {
  readonly state: string;
  readonly stage: (
    product: ProductBinding,
    workspace: TestWorkspace,
    context: string,
  ) => Promise<void>;
}

const CORRUPT_CREATE_ARMS: readonly CorruptCreateArm[] = [
  {
    // Cannot be parsed (SPEC 10.1, 14.21): garbage bytes at the session
    // path — shape-independent, so no product-written session is needed.
    state: "unparseable JSON (garbage bytes)",
    stage: async (_product, workspace, context) => {
      await stageGarbageSession(workspace, W1_SESSION, context);
    },
  },
  {
    // Violates a session invariant (SPEC 10.1: statuses drawn from 10.3)
    // while staying one well-formed JSON document — the state a `create`
    // that merely checks the name's existence, without reading the session,
    // cannot tell from a valid one.
    state: "unknown item status (H-3 adapter over the product-written file)",
    stage: async (product, workspace, context) => {
      await createAuditSession(product, workspace, W1_SESSION, context);
      await stageUnknownItemStatus(workspace.path(W1_SESSION_REL));
      await requireStagedKind(workspace, W1_SESSION_REL, "file", context);
    },
  },
  {
    // Not a plain file (SPEC 13.4): a directory at the session path.
    state: "session path occupied by a directory",
    stage: async (_product, workspace, context) => {
      await workspace.dir(W1_SESSION_REL);
      await requireStagedKind(workspace, W1_SESSION_REL, "dir", context);
    },
  },
  {
    // Not a plain file (SPEC 13.4): a symbolic link at the session path,
    // targeting the valid session `real` the product wrote beside it — a
    // product reading through the link sees a healthy existing session and
    // answers the code-less refusal instead of condition 21.
    state: "session path occupied by a symbolic link to a valid session",
    stage: async (product, workspace, context) => {
      await createAuditSession(product, workspace, "real", context);
      await workspace.symlink(W1_SESSION_REL, "real.json");
      await requireStagedKind(workspace, W1_SESSION_REL, "symlink", context);
    },
  },
];

/**
 * `review create --strategy audit --name <name>` beside the corrupt sessions
 * the name matches, handed to `visitor` at the state it runs on, labelled
 * `context`: its `home` the home test's check that the corruption stands in
 * the refusal's place (`expectCreateCorruptionReported`, `corruptRels` the
 * corrupt matches' files in 12.7 order).
 */
async function visitCreateCorruption(
  product: ProductBinding,
  visitor: ReviewRefusalVisitor,
  workspace: TestWorkspace,
  name: string,
  corruptRels: readonly string[],
  context: string,
): Promise<void> {
  await visitor.refusal(
    workspace,
    { label: context, argv: createAuditArgv(name) },
    () =>
      expectCreateCorruptionReported(
        product,
        workspace,
        name,
        corruptRels,
        context,
      ),
  );
}

/**
 * T10.7-1's flag arms on the flag-exclusivity workspace, git-backed and
 * built, before any session exists — the home test's own assertions
 * (`runT1071Stagings` runs them where its visitor's `home` holds): the
 * unknown profile, nothing created and `list` reporting no session; the
 * exclusivity arms; the foreign `--strategy` values on the
 * configuration-state twins; and the missing `--name` — each a usage error.
 */
async function runT1071FlagArms(
  product: ProductBinding,
  workspace: TestWorkspace,
  prefix: string,
): Promise<void> {
  // Unknown profile first — before any session exists, so "nothing
  // created" is exactly observable: no session file, and `list`
  // reports no session at all (SPEC 10.7: `create` records the
  // profile's resolved definition, so an unknown profile leaves
  // nothing to record; 12.0: an unknown profile named in arguments is
  // a usage error).
  await expectCreateUsageError(
    product,
    workspace,
    ["review", "create", "--coverage", "nope", "--name", "c"],
    `${prefix} \`review create --coverage nope --name c\` — no ` +
      `configured profile is named "nope" (the configured profile is ` +
      `"p")`,
  );
  const sessionKind = await workspace.kind(".xspec/reviews/c.json");
  if (sessionKind !== "absent") {
    fail(
      `${prefix}: \`create --coverage nope\` failed (exit 2), so no ` +
        `session file may exist at .xspec/reviews/c.json (SPEC 10.1, ` +
        `10.7: nothing created); found ${sessionKind}`,
    );
  }
  const list = await listSessions(
    product,
    workspace,
    `${prefix} after the unknown-profile create`,
  );
  assertSameJson(
    list.sessions.map((entry) => entry.name),
    [],
    `${prefix}: \`list\` reports no such session — nothing was ` +
      `created by the failed create, and no other session exists yet ` +
      `(SPEC 10.7)`,
  );

  // Exactly one of --base / --strategy audit / --coverage (SPEC 10.7):
  // none, each pair, and all three are usage errors.
  const exclusivityArms: readonly (readonly [readonly string[], string])[] = [
    [
      ["review", "create", "--name", "x"],
      "none of --base/--strategy/--coverage",
    ],
    [
      [
        "review",
        "create",
        "--base",
        "main",
        "--strategy",
        "audit",
        "--name",
        "x",
      ],
      "--base and --strategy together",
    ],
    [
      ["review", "create", "--base", "main", "--coverage", "p", "--name", "x"],
      "--base and --coverage together",
    ],
    [
      [
        "review",
        "create",
        "--strategy",
        "audit",
        "--coverage",
        "p",
        "--name",
        "x",
      ],
      "--strategy and --coverage together",
    ],
    [
      [
        "review",
        "create",
        "--base",
        "main",
        "--strategy",
        "audit",
        "--coverage",
        "p",
        "--name",
        "x",
      ],
      "all three together",
    ],
  ];
  for (const [argv, why] of exclusivityArms) {
    await expectCreateUsageError(
      product,
      workspace,
      argv,
      `${prefix} \`${argv.join(" ")}\` (${why}) — exactly one of ` +
        `--base, --strategy audit, --coverage is required`,
    );
  }

  // --strategy accepts only `audit` (SPEC 10.7): any other value —
  // path-blocks and coverage, which --base and --coverage alone
  // select, and bogus — is a usage error of the syntax class (12.0:
  // a fixed vocabulary decides it, from the arguments alone),
  // reported without loading configuration: the plain usage error,
  // `code` and `path` null, byte-identical on the configuration-state
  // twins holding specs/W.mdx under an invalid and under no
  // configuration (T12.0-10's discipline; each twin unchanged).
  const twins = await stageConfigurationStateTwins({
    [W1_FILE]: W1_SOURCE,
  });
  try {
    for (const value of W1_FOREIGN_STRATEGIES) {
      const argv = [
        "review",
        "create",
        "--strategy",
        value,
        "--name",
        "x",
        "--json",
      ];
      await expectSyntaxClassUsageError(
        product,
        workspace,
        twins,
        argv,
        `${prefix} \`${argv.join(" ")}\` — the only accepted ` +
          `--strategy value is "audit"`,
      );
    }
  } finally {
    await twins.dispose();
  }

  // Missing --name (SPEC 10.7: a missing required flag is a usage
  // error, 12.0).
  await expectCreateUsageError(
    product,
    workspace,
    ["review", "create", "--strategy", "audit"],
    `${prefix} \`review create --strategy audit\` — missing --name`,
  );
}

/**
 * T10.7-1's staging, each refused `create` handed to `visitor.refusal` with
 * the home test's own check of it as `home` (exported for T12.0-15,
 * section-12.0-iv.ts): the flag-exclusivity workspace — `COVERAGE_CONFIG`
 * and specs/W.mdx, git-backed and built — its flag arms where
 * `visitor.home` holds (`runT1071FlagArms`), then the audit session s and
 * `create --name s` (`expectReviewRefusal`: one code-less refusal); one
 * workspace per corrupt state of s (`CORRUPT_CREATE_ARMS`, T10.1-4's
 * stagings), `create --name s` (`expectCreateCorruptionReported`: the
 * corruption in the refusal's place); the case-fold workspace, a corrupt
 * foo.json, `create --name Foo`; and on the Linux leg the three case-pair
 * workspaces — (i) both corrupt, `--name Foo`; (ii) foo.json valid and
 * FOO.json corrupt, `--name Foo`, then `--name foo`; (iii) both valid,
 * `--name Foo`, one code-less refusal. `prefix` leads every staging step's
 * diagnosis.
 */
export async function runT1071Stagings(
  product: ProductBinding,
  visitor: ReviewRefusalVisitor,
  prefix = "T10.7-1",
): Promise<void> {
  await withWorkspace(
    COVERAGE_CONFIG,
    { [W1_FILE]: W1_SOURCE },
    async (workspace) => {
      // A resolvable ref for the pair arms, so flag exclusivity is the
      // only usage-error cause staged in them.
      await workspace.gitInit();
      await workspace.gitCommitAll("baseline");
      await buildOk(product, workspace, `${prefix} \`build\``);
      if (visitor.home) await runT1071FlagArms(product, workspace, prefix);

      // An existing name is refused: exit 1, a refused review operation —
      // exactly one code-less finding in T10.7-14's form, nothing modified
      // (SPEC 10.7, 12.0, 12.7, 14; the ASCII-case-fold variant is
      // T10.1-2's business — this arm stages the exact name).
      await createAuditSession(product, workspace, W1_SESSION, prefix);
      await visitReviewRefusal(
        product,
        visitor,
        workspace,
        W1_CREATE_S,
        W1_SESSION_REL,
        `${prefix} [existing valid session: \`create\` with its exact ` +
          `name is refused, SPEC 10.1, 10.7]`,
      );
    },
  );

  // Naming an existing corrupt session (SPEC 10.7, 14.21): the corruption
  // stands in the refusal's place. One fresh workspace per state, so no
  // other session's state can enter the report: each is built, the
  // session `s` staged corrupt T10.1-4's way, then `create --name s`
  // driven against it.
  for (const arm of CORRUPT_CREATE_ARMS) {
    await withWorkspace(
      COVERAGE_CONFIG,
      { [W1_FILE]: W1_SOURCE },
      async (workspace) => {
        const context = `${prefix} [existing corrupt session: ${arm.state}]`;
        await buildOk(product, workspace, `${context} \`build\``);
        await arm.stage(product, workspace, context);
        await visitCreateCorruption(
          product,
          visitor,
          workspace,
          W1_SESSION,
          [W1_SESSION_REL],
          context,
        );
      },
    );
  }

  // A name matching the corrupt session's ignoring ASCII case alone is
  // treated at `create` as that existing session's (SPEC 10.1), so the
  // corruption stands in the refusal's place there too (10.7): `--name
  // Foo` beside a corrupt foo.json reports foo.json's finding, concerning
  // the stored file's own path, and writes no Foo.json — a product
  // matching names case-insensitively against readable sessions alone
  // finds no match, creates the session, and fails at the exit code.
  await withWorkspace(
    COVERAGE_CONFIG,
    { [W1_FILE]: W1_SOURCE },
    async (workspace) => {
      const context = `${prefix} [case-fold: a corrupt foo.json, \`create --name Foo\`]`;
      await buildOk(product, workspace, `${context} \`build\``);
      await stageGarbageSession(workspace, FOLD_LOWER, context);
      await visitCreateCorruption(
        product,
        visitor,
        workspace,
        FOLD_MIXED,
        [sessionRelOf(FOLD_LOWER)],
        context,
      );
    },
  );

  // A name matching several sessions ignoring ASCII case names each of
  // them (SPEC 10.1): the corruption is one finding per corrupt session
  // it matches, the refusal not beside them (10.7). Only on the Linux leg
  // do foo.json and FOO.json stand side by side (CASE_PAIR_STAGED), each
  // arm a fresh workspace holding both, every `create` inside a
  // whole-root compare: no Foo.json created, both files byte-unchanged.
  if (CASE_PAIR_STAGED) {
    // (i) Both corrupt: two condition-21 findings, FOO.json's then
    // foo.json's — equal codes and empty locations, so by concerned path
    // bytes (12.7: `F`, 0x46, before `f`, 0x66) — failing a product that
    // reports the first match alone.
    await withWorkspace(
      COVERAGE_CONFIG,
      { [W1_FILE]: W1_SOURCE },
      async (workspace) => {
        const context = `${prefix} [case pair (i): foo.json and FOO.json both corrupt]`;
        await buildOk(product, workspace, `${context} \`build\``);
        await stageGarbageSession(workspace, FOLD_LOWER, context);
        await stageGarbageSession(workspace, FOLD_UPPER, context);
        await visitCreateCorruption(
          product,
          visitor,
          workspace,
          FOLD_MIXED,
          [sessionRelOf(FOLD_UPPER), sessionRelOf(FOLD_LOWER)],
          context,
        );
      },
    );

    // (ii) foo.json valid — written by this workspace's own `create`,
    // made before FOO.json is staged, which that `create` would meet —
    // and FOO.json corrupt: `--name Foo`, and `--name foo`, whose exact
    // match is the valid session, each report FOO.json's corruption
    // alone — failing a product that answers a refusal beside it, or in
    // its place where the name matches a valid session exactly.
    await withWorkspace(
      COVERAGE_CONFIG,
      { [W1_FILE]: W1_SOURCE },
      async (workspace) => {
        const context = `${prefix} [case pair (ii): foo.json valid, FOO.json corrupt]`;
        await buildOk(product, workspace, `${context} \`build\``);
        await createAuditSession(product, workspace, FOLD_LOWER, context);
        await requireCreatedSessionFile(workspace, FOLD_LOWER, context);
        await stageGarbageSession(workspace, FOLD_UPPER, context);
        await visitCreateCorruption(
          product,
          visitor,
          workspace,
          FOLD_MIXED,
          [sessionRelOf(FOLD_UPPER)],
          context,
        );
        await visitCreateCorruption(
          product,
          visitor,
          workspace,
          FOLD_LOWER,
          [sessionRelOf(FOLD_UPPER)],
          `${context} [\`foo\`: its exact match is the valid session]`,
        );
      },
    );

    // (iii) Both valid — foo.json written by this workspace's `create`,
    // FOO.json by `create` in an identical twin workspace and copied in:
    // `--name Foo` is refused with exactly one code-less finding (10.7:
    // each refusal one finding) — failing a product answering one
    // refusal per match — the shared check's whole-root compare covering
    // FOO.json beside the foo.json it names.
    await withWorkspace(
      COVERAGE_CONFIG,
      { [W1_FILE]: W1_SOURCE },
      async (workspace) => {
        const context = `${prefix} [case pair (iii): foo.json and FOO.json both valid]`;
        await buildOk(product, workspace, `${context} \`build\``);
        await createAuditSession(product, workspace, FOLD_LOWER, context);
        await requireCreatedSessionFile(workspace, FOLD_LOWER, context);
        await copyTwinCreatedSession(product, workspace, FOLD_UPPER, context);
        await visitReviewRefusal(
          product,
          visitor,
          workspace,
          createAuditArgv(FOLD_MIXED),
          sessionRelOf(FOLD_LOWER),
          `${context} [\`Foo\` matches both ignoring ASCII case: one ` +
            `refusal, SPEC 10.1, 10.7]`,
        );
      },
    );
  }
}

const T10_7_1 = defineProductTest({
  id: "T10.7-1",
  title:
    "`review create` flag exclusivity: exactly one of `--base`, `--strategy audit`, `--coverage` is required — supplying none, any two, or all three is a usage error, exit 2, as is a missing `--name`, and `--strategy` with any other value — `path-blocks` and `coverage`, the strategies `--base` and `--coverage` alone select, and `bogus` — is a usage error of the syntax class: exit 2 with the plain usage error (`code` and `path` `null`), byte-identical with the configuration file invalid or missing; `--coverage` naming no configured profile is exit 2 (an unknown profile named in arguments) with nothing created — no session file exists and `list` reports no such session; `create` with an existing session's exact name is refused: exit 1 with exactly one code-less finding in T10.7-14's form — standard output exactly `{\"findings\": [f]}`, `code` and `path` `null`, `locations` `[]` — nothing modified; naming an existing corrupt session — unparseable bytes, an invariant violation staged through the H-3 adapter over the product-written file, a directory or a symbolic link at the session path (T10.1-4's stagings) — reports the corruption in the refusal's place: exactly one finding, condition 21 `corrupt-session`, no code-less refusal beside it, exit 1, nothing modified; and so does a name matching the corrupt session's ignoring ASCII case alone: `--name Foo` beside a corrupt `foo.json` reports exactly that finding, concerning `.xspec/reviews/foo.json`, and writes no `Foo.json`; on the Linux leg, beside both `foo.json` and `FOO.json` — each written by the product (`FOO.json` in an identical twin workspace, copied in) or T10.1-4's garbage bytes — the corruption is one finding per corrupt session the name matches, the refusal not beside them: both corrupt, `--name Foo` reports exactly two condition-21 findings, `FOO.json`'s then `foo.json`'s (by concerned path bytes); `foo.json` valid and `FOO.json` corrupt, `--name Foo` and `--name foo` each exactly `FOO.json`'s; both valid, `--name Foo` exactly one code-less refusal — each exit 1, nothing written (SPEC 10.1, 10.7, 12.0, 12.7, 13.4, 14, 14.21)",
  run: async (product) => {
    await runT1071Stagings(product, REVIEW_REFUSAL_HOME);
  },
});

// ---------------------------------------------------------------------------
// T10.7-2 — recorded parameters
// ---------------------------------------------------------------------------

// Coverage arm. Create-time configuration: profile `p` over group `main` =
// ["specs/**/*.mdx"]; sources A.mdx (leaf a) and G.mdx (leaf g), both
// uncovered. Post-create configuration: the profile is renamed to `q` and
// main's glob list is edited to ["specs/A.mdx", "specs/B.mdx",
// "extra/**/*.mdx"] — G.mdx now belongs to no configured group — while
// specs/B.mdx (leaf b) and extra/N.mdx (leaf n) are added. The recorded
// definition (globs ["specs/**/*.mdx"]) matched against the currently
// discovered sources (A, B, N) selects exactly A and B: b enters on
// re-derivation, n never does, g is out of view (as if deleted).
const C2_A = "specs/A.mdx";
const C2_A_NODE = "specs/A.mdx#a";
const C2_G = "specs/G.mdx";
const C2_G_NODE = "specs/G.mdx#g";
const C2_B = "specs/B.mdx";
const C2_B_NODE = "specs/B.mdx#b";
const C2_N = "extra/N.mdx";

const C2_CONFIG_EDITED = stagedTs(
  "T10.7-2 coverage arm xspec.config.ts after create (profile renamed to q, main's globs edited)",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/A.mdx", "specs/B.mdx", "extra/**/*.mdx"]
  },
  coverage: [
    {
      name: "q",
      target: "main",
      boundary: "main",
      mode: "direct"
    }
  ]
})
`,
);

function leafSpec(id: string, text: string): string {
  return [`<S id="${id}">`, text, "</S>", ""].join("\n");
}

// Audit arm. Create-time configuration: main = ["specs/**/*.mdx"], one
// source A.mdx (leaf a). Post-create configuration: main gains
// "extra/**/*.mdx" and extra/N.mdx (leaf n) is added — audit records no
// creation parameters, so its generators run against the whole current
// workspace under the current configuration and the extra items enter on
// re-derivation.
const A2_CONFIG_EDITED = stagedTs(
  "T10.7-2 audit arm xspec.config.ts after create (main gains extra/**/*.mdx)",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx", "extra/**/*.mdx"]
  }
})
`,
);

// Leaf a is the same call in the coverage arm's workspace (the body's first)
// and the audit arm's (created after the coverage arm's invocations): one
// staged-source record (S-9's before-any-product clause), staged at both.
const T10_7_2_A_LEAF = stagedMdx(
  "T10.7-2 specs/A.mdx with leaf a (the coverage arm's initial source and the audit arm's)",
  leafSpec("a", "Aye text."),
);

// Both arms' post-create additions follow the arm's first `build`, so they
// are staged-source records (helpers/staged-mdx.ts, S-9: judged before any
// product exists); extra/N.mdx is the same call in both arms — one record.
const T10_7_2_B_LEAF = stagedMdx(
  "T10.7-2 specs/B.mdx with leaf b (added by the coverage arm's post-create configuration edit)",
  leafSpec("b", "Bee text."),
);
const T10_7_2_N_LEAF = stagedMdx(
  "T10.7-2 extra/N.mdx with leaf n (added after create in the coverage and audit arms)",
  leafSpec("n", "Enn text."),
);

const T10_7_2 = defineProductTest({
  id: "T10.7-2",
  title:
    "recorded creation parameters: a coverage session records the profile definition with group names replaced by glob lists (the recorded definition holds the group's configured glob, and the reported record is unchanged by later configuration edits) — after `create`, renaming the profile away and editing its group's glob list change nothing about session behavior: reads and the `updated`-resolve re-derivation still run the recorded globs against the currently discovered sources, so a new file matching the recorded globs enters on re-derivation while a newly-grouped file outside them never does, and a file no longer in any configured group leaves the session's view exactly as if deleted (its item's scope presents absent, the item is retained); an audit session records none — its generators run against the current workspace under the current configuration, so a configuration edit adding sources is reflected in its re-derivation (a baseline session's recorded commit is T10.5-6's business) (SPEC 7, 10.2, 10.4, 10.5, 10.7)",
  run: async (product) => {
    // --- coverage arm: the profile definition is recorded, resolved ---------
    await withWorkspace(
      COVERAGE_CONFIG,
      {
        [C2_A]: T10_7_2_A_LEAF,
        [C2_G]: leafSpec("g", "Gee text."),
      },
      async (workspace) => {
        const prefix = "T10.7-2 coverage arm";
        await buildOk(product, workspace, `${prefix} \`build\``);
        await createCoverageSession(product, workspace, "p", "c", prefix);

        const initial = await sessionStatus(product, workspace, "c", prefix);
        assertSameJson(
          rowSequence(initial),
          [
            `uncovered-requirement ${C2_A_NODE} unresolved`,
            `uncovered-requirement ${C2_G_NODE} unresolved`,
          ],
          `${prefix}: the session holds one uncovered-requirement item per ` +
            `uncovered required node of the profile — the two uncovered ` +
            `leaves, in file path order (SPEC 10.7)`,
        );
        const idA = requireRow(
          initial,
          "uncovered-requirement",
          C2_A_NODE,
          prefix,
        ).id;
        const idG = requireRow(
          initial,
          "uncovered-requirement",
          C2_G_NODE,
          prefix,
        ).id;

        // The recorded definition replaces the group name with the group's
        // configured glob list (SPEC 10.7): the create-time glob is a
        // spec-fixed value the record must hold (H-4: opaque shape,
        // spec-fixed values — the §10.2/§10.6 operationalization).
        const exportPre = await exportSession(product, workspace, "c", prefix);
        if (
          !collectStringLeaves(exportPre.creationParameters).includes(
            "specs/**/*.mdx",
          )
        ) {
          fail(
            `${prefix}: the recorded creation parameters must hold the ` +
              `profile definition with each group name replaced by that ` +
              `group's configured glob list (SPEC 10.7) — the create-time ` +
              `glob "specs/**/*.mdx" appears nowhere in ` +
              canonicalJson(exportPre.creationParameters),
          );
        }

        // Post-create configuration edit: profile renamed p → q, main's
        // globs edited; B.mdx and extra/N.mdx added.
        await workspace.file("xspec.config.ts", C2_CONFIG_EDITED);
        await workspace.file(C2_B, T10_7_2_B_LEAF);
        await workspace.file(C2_N, T10_7_2_N_LEAF);
        await buildOk(
          product,
          workspace,
          `${prefix} \`build\` after the configuration edit`,
        );

        // Control read: session behavior is unchanged by the configuration
        // edit alone — reads still work with the profile renamed away (a
        // product re-resolving the recorded profile by name fails here), no
        // item was added or removed without a re-derivation (SPEC 10.5),
        // and G.mdx — in no configured group — is out of view: its item's
        // scope presents absent, exactly as if the file were deleted
        // (SPEC 10.4, 10.7).
        const control = await sessionStatus(product, workspace, "c", prefix);
        assertSameJson(
          rowSequence(control),
          [
            `uncovered-requirement ${C2_A_NODE} unresolved`,
            `uncovered-requirement ${C2_G_NODE} unresolved`,
          ],
          `${prefix} control after the configuration edit: the item set is ` +
            `unchanged — renaming the profile and editing the group's ` +
            `globs change no recorded parameter, and new items enter only ` +
            `through re-derivation (SPEC 10.5, 10.7)`,
        );
        const controlExport = await exportSession(
          product,
          workspace,
          "c",
          prefix,
        );
        const gControl = requireItem(
          controlExport.items,
          "uncovered-requirement",
          C2_G_NODE,
          prefix,
        );
        if (gControl.scope.present !== false) {
          fail(
            `${prefix}: specs/G.mdx belongs to no configured group, so g is ` +
              `out of the session's view exactly as if deleted — its item's ` +
              `scope presents absent (SPEC 10.4, 10.7); got ` +
              JSON.stringify(gControl.scope),
          );
        }
        const aControl = requireItem(
          controlExport.items,
          "uncovered-requirement",
          C2_A_NODE,
          prefix,
        );
        if (aControl.scope.present !== true) {
          fail(
            `${prefix}: specs/A.mdx is still discovered and matches the ` +
              `recorded globs — a's item scope presents present ` +
              `(SPEC 10.4, 10.7); got ${JSON.stringify(aControl.scope)}`,
          );
        }
        // The reported record never changes: the recorded parameters the
        // session runs with are fixed at create (SPEC 10.7).
        assertSameInformation(
          controlExport.creationParameters,
          exportPre.creationParameters,
          `${prefix}: the reported recorded creation parameters are ` +
            `unchanged by the configuration edit (SPEC 10.7: renaming or ` +
            `editing refs, profiles, or groups after create never changes ` +
            `the recorded parameters)`,
        );

        // The updated resolve triggers re-derivation with the recorded
        // definition against the currently discovered sources (SPEC 10.5,
        // 10.7): b (new file, discovered, matches the recorded globs)
        // enters unresolved; n (discovered, outside the recorded globs)
        // never enters — a product running the current group definition
        // would generate an item for it; g stays retained and absent.
        await resolveOk(
          product,
          workspace,
          "c",
          idA,
          "updated",
          `${prefix} \`resolve --status updated\` of a's item — triggers ` +
            `re-derivation with the recorded parameters (SPEC 10.5, 10.7)`,
        );
        const derived = await sessionStatus(product, workspace, "c", prefix);
        assertSameJson(
          rowSequence(derived),
          [
            `uncovered-requirement ${C2_A_NODE} updated`,
            `uncovered-requirement ${C2_B_NODE} unresolved`,
            `uncovered-requirement ${C2_G_NODE} unresolved`,
          ],
          `${prefix} after the updated resolve: the recorded globs matched ` +
            `against the currently discovered sources admit exactly A and ` +
            `B — b's item enters unresolved in coverage item order, no item ` +
            `for extra/N.mdx#n exists (its file is outside the recorded ` +
            `globs), g's item is retained (SPEC 10.5, 10.7)`,
        );
        const bRow = requireRow(
          derived,
          "uncovered-requirement",
          C2_B_NODE,
          prefix,
        );
        if (bRow.id === idA || bRow.id === idG) {
          fail(
            `${prefix}: b's new item takes a fresh id (SPEC 10.2); got ` +
              `${bRow.id}, colliding with an existing item id`,
          );
        }
        if (
          requireRow(derived, "uncovered-requirement", C2_A_NODE, prefix).id !==
            idA ||
          requireRow(derived, "uncovered-requirement", C2_G_NODE, prefix).id !==
            idG
        ) {
          fail(
            `${prefix}: the existing items keep their ids across the ` +
              `re-derivation (SPEC 10.5)`,
          );
        }
        const derivedExport = await exportSession(
          product,
          workspace,
          "c",
          prefix,
        );
        if (
          requireItem(
            derivedExport.items,
            "uncovered-requirement",
            C2_G_NODE,
            prefix,
          ).scope.present !== false
        ) {
          fail(
            `${prefix}: after the re-derivation g's retained item still ` +
              `presents its scope absent — the file is in no configured ` +
              `group (SPEC 10.4, 10.5, 10.7)`,
          );
        }
      },
    );

    // --- audit arm: no creation parameters are recorded ---------------------
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [C2_A]: T10_7_2_A_LEAF },
      async (workspace) => {
        const prefix = "T10.7-2 audit arm";
        await buildOk(product, workspace, `${prefix} \`build\``);
        await createAuditSession(product, workspace, "s", prefix);

        const initial = await sessionStatus(product, workspace, "s", prefix);
        assertSameJson(
          rowSequence(initial),
          [
            `subtree-coherence ${C2_A} unresolved`,
            `subtree-coherence ${C2_A_NODE} unresolved`,
          ],
          `${prefix}: the audit items at create — one per requirement node ` +
            `of the workspace (SPEC 10.6)`,
        );
        const idA = requireRow(
          initial,
          "subtree-coherence",
          C2_A_NODE,
          prefix,
        ).id;

        // Configuration edit after create: main gains extra/**/*.mdx and
        // extra/N.mdx appears. An audit session records no creation
        // parameters (SPEC 10.7), so nothing shields it from the current
        // configuration: its generators run against the current workspace.
        await workspace.file("xspec.config.ts", A2_CONFIG_EDITED);
        await workspace.file(C2_N, T10_7_2_N_LEAF);
        await buildOk(
          product,
          workspace,
          `${prefix} \`build\` after the configuration edit`,
        );

        // Control: no re-derivation, no new items (SPEC 10.5).
        assertSameJson(
          rowSequence(await sessionStatus(product, workspace, "s", prefix)),
          [
            `subtree-coherence ${C2_A} unresolved`,
            `subtree-coherence ${C2_A_NODE} unresolved`,
          ],
          `${prefix} control after the configuration edit: new items enter ` +
            `only through re-derivation (SPEC 10.5)`,
        );

        // The updated resolve re-derives: with nothing recorded, the
        // generators cover the newly configured extra/N.mdx — its root and
        // leaf items enter, in audit item order (file path bytes put
        // extra/N.mdx before specs/A.mdx), created unresolved. A coverage-
        // style product that recorded the create-time group globs would
        // still generate items for specs/A.mdx alone.
        await resolveOk(
          product,
          workspace,
          "s",
          idA,
          "updated",
          `${prefix} \`resolve --status updated\` of a's item — triggers ` +
            `re-derivation against the current workspace (SPEC 10.5, 10.6, ` +
            `10.7)`,
        );
        assertSameJson(
          rowSequence(await sessionStatus(product, workspace, "s", prefix)),
          [
            `subtree-coherence ${C2_N} unresolved`,
            `subtree-coherence extra/N.mdx#n unresolved`,
            `subtree-coherence ${C2_A} unresolved`,
            `subtree-coherence ${C2_A_NODE} updated`,
          ],
          `${prefix} after the updated resolve: an audit session records no ` +
            `creation parameters, so the re-derivation runs against the ` +
            `current workspace under the current configuration — the newly ` +
            `configured extra/N.mdx's items enter unresolved at their ` +
            `places in audit item order (SPEC 10.5, 10.6, 10.7)`,
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T10.7-3 — unresolvable baseline
// ---------------------------------------------------------------------------

const C3_FILE = "specs/C.mdx";
const C3_PAR = "specs/C.mdx#par";

function c3Spec(parText: string): string {
  return [
    '<S id="par">',
    parText,
    "",
    '<S id="par.k">',
    "Kay text.",
    "</S>",
    "</S>",
    "",
  ].join("\n");
}

// The healthy session's edit follows the body's first `build`, so it is a
// staged-source record (helpers/staged-mdx.ts, S-9: judged before any
// product exists).
const T10_7_3_C_PAR_EDITED = stagedMdx(
  "T10.7-3 specs/C.mdx with par's own text at v1 (the healthy session's edit against the real baseline)",
  c3Spec("Par own text v1."),
);

/** Remove the workspace's `.git` directory entirely (staging, T10.7-3). */
async function removeGitDir(
  workspace: TestWorkspace,
  context: string,
): Promise<void> {
  await fsp.rm(workspace.path(".git"), {
    recursive: true,
    force: true,
    maxRetries: 3,
  });
  const kind = await workspace.kind(".git");
  if (kind !== "absent") {
    fail(
      `${context} staging: .git must be removed before the repository is ` +
        `re-created; found ${kind}`,
    );
  }
}

const T10_7_3 = defineProductTest({
  id: "T10.7-3",
  title:
    "unresolvable baseline: `review create --base` with an unresolvable ref (a nonexistent branch name; a full hex commit id absent from the repository) fails per 6.3 as exit 2, modifying nothing — the whole workspace, `.git/` included, stays byte-identical and no session file appears; and once a session's recorded baseline commit can no longer be reconstructed (the repository is re-created, so the recorded commit's objects are gone while the old `--base` spelling resolves to a different commit), every later `review` command that runs the session — `status`, `next`, `show`, `export`, `resolve`, `split`, each staged so the baseline is its only failure — fails as exit 2, modifying nothing, while `list`, which reports stored statuses without the read-time invalidation, still exits 0 and reports the session with its fields (an unresolvable recorded baseline is a usage error, not the 14.21 corruption) (SPEC 6.3, 10.4, 10.7, 12.0)",
  run: async (product) => {
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [C3_FILE]: c3Spec("Par own text v0.") },
      async (workspace) => {
        const prefix = "T10.7-3";
        await workspace.gitInit();
        const baseline = await workspace.gitCommitAll("baseline");
        await buildOk(product, workspace, `${prefix} \`build\``);

        // Arm 1: create with an unresolvable ref — exit 2, the 12.7 error
        // document as the entire stdout under --json, and nothing modified
        // anywhere (SPEC 6.3, 10.7, 12.0; the compare includes .git/ and
        // .xspec/).
        for (const [ref, why] of [
          ["no-such-ref", "a nonexistent branch name"],
          [
            "0123456789abcdef0123456789abcdef01234567",
            "a full hex commit id absent from the repository",
          ],
        ] as const) {
          const context = `${prefix} \`review create --base ${ref} --name s --json\` (${why})`;
          await assertLeavesUnchanged(
            workspace.root,
            async () => {
              await expectCreateUsageError(
                product,
                workspace,
                ["review", "create", "--base", ref, "--name", "s"],
                context,
              );
            },
            `${context} — an unresolvable baseline fails per 6.3, ` +
              `modifying nothing (SPEC 6.3, 10.7)`,
          );
        }

        // A healthy session against the real baseline: par's own text is
        // edited, so the session holds exactly par's subtree-coherence item
        // (par has no non-root ancestor, SPEC 10.5) — unblocked, and its
        // scope root has a child, so `resolve` and `split` would both be
        // legal if the baseline stayed reconstructable: the destroyed
        // baseline is each later command's only failure cause.
        await workspace.file(C3_FILE, T10_7_3_C_PAR_EDITED);
        await buildOk(
          product,
          workspace,
          `${prefix} \`build\` after the par edit`,
        );
        await createBaseSession(product, workspace, "main", "s", prefix);
        const healthy = await sessionStatus(
          product,
          workspace,
          "s",
          `${prefix} healthy-session premise`,
        );
        assertSameJson(
          rowSequence(healthy),
          [`subtree-coherence ${C3_PAR} unresolved`],
          `${prefix} staging premise: the session holds exactly par's ` +
            `subtree-coherence item (SPEC 10.5)`,
        );
        const idPar = healthy.items[0].id;

        // Destroy the recorded baseline: re-create the repository. The
        // recorded commit identity's objects are gone; the old --base
        // spelling ("main") resolves again, but to a different commit — a
        // product that recorded the ref spelling instead of the resolved
        // commit identity (SPEC 10.7) would happily proceed here.
        await removeGitDir(workspace, prefix);
        await workspace.gitInit();
        const replacement = await workspace.gitCommitAll("replacement");
        if (replacement === baseline) {
          fail(
            `${prefix} staging premise: the replacement commit must differ ` +
              `from the recorded baseline commit`,
          );
        }
        let baselineGone = true;
        try {
          await workspace.git(["cat-file", "-e", `${baseline}^{commit}`]);
          baselineGone = false;
        } catch {
          // Expected: the recorded commit's objects no longer exist.
        }
        if (!baselineGone) {
          fail(
            `${prefix} staging premise: the recorded baseline commit ` +
              `${baseline} must no longer exist in the re-created repository`,
          );
        }

        // Every later review command that runs the session fails per 6.3 as
        // exit 2, modifying nothing (SPEC 6.3, 10.7: a review command that
        // cannot reconstruct the recorded baseline fails as a usage error;
        // reads compute read-time invalidation by running the generators
        // with the recorded parameters, so they need the baseline too,
        // SPEC 10.4).
        const laterCommands: readonly (readonly string[])[] = [
          ["review", "status", "s"],
          ["review", "next", "s"],
          ["review", "show", "s", idPar],
          ["review", "export", "s"],
          ["review", "resolve", "s", idPar, "--status", "no-change"],
          ["review", "split", "s", idPar],
        ];
        for (const argv of laterCommands) {
          const context = `${prefix} \`${argv.join(" ")} --json\` with the recorded baseline unreconstructable`;
          await assertLeavesUnchanged(
            workspace.root,
            async () => {
              const result = await expectExit(
                product,
                workspace,
                [...argv, "--json"],
                2,
                `${context} — fails per 6.3 as a usage error (SPEC 6.3, ` +
                  `10.7, 12.0)`,
              );
              expectErrorDocument(
                result,
                `${context} — under --json, the exit-2 error document is ` +
                  `the entire stdout (SPEC 12.0, 12.7, H-5)`,
              );
            },
            `${context} — modifying nothing (SPEC 6.3, 10.7)`,
          );
        }

        // `list` reports stored statuses without read-time invalidation
        // (SPEC 10.7), so it needs no baseline: the session is listed with
        // its fields, not as corrupt — an unresolvable recorded baseline is
        // a usage error of the commands that need it, not the 14.21
        // corruption — and `list` exits 0.
        const listed = await listSessions(
          product,
          workspace,
          `${prefix} with the recorded baseline unreconstructable`,
        );
        assertSameJson(
          listed.sessions.map((entry) => ({
            name: entry.name,
            corrupt: entry.corrupt,
          })),
          [{ name: "s", corrupt: false }],
          `${prefix}: \`list\` needs no baseline — it reports the session ` +
            `by name with its fields, not as corrupt (SPEC 10.1, 10.7, ` +
            `14.21), and exits 0 since no session is corrupt`,
        );
        assertStoredCounts(
          listed.sessions[0],
          {
            unresolved: 1,
            invalidated: 0,
            updated: 0,
            "no-change": 0,
            skipped: 0,
          },
          `${prefix} \`list\``,
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T10.7-4 — coverage sessions
// ---------------------------------------------------------------------------

// Three source files. B.mdx's `src` covers K.mdx's `par.c` with a single
// dependency edge (direct mode), so par.c is the covered control; `src`,
// `par.u2`, `par.u1`, and `z` are uncovered leaves; `par` is a branch (not a
// leaf, so never required under the default `targets: "leaves"`), and root
// nodes are never required (SPEC 8.1). Inside K.mdx the uncovered leaves are
// declared u2-then-u1 — document order opposite to identity order — so the
// absent-scope identity key is distinguishable from stale document order
// after deletions; Z.mdx follows K.mdx in file path order so an absent
// K item ordering "after the same file's present ones" is distinguishable
// from ordering last globally.
const C4_B = "specs/B.mdx";
const C4_SRC = "specs/B.mdx#src";
const C4_K = "specs/K.mdx";
const C4_U2 = "specs/K.mdx#par.u2";
const C4_U1 = "specs/K.mdx#par.u1";
const C4_KPAR = "specs/K.mdx#par";
const C4_Z = "specs/Z.mdx";
const C4_Z_NODE = "specs/Z.mdx#z";

const C4_B_SOURCE = [
  'import K from "./K.xspec"',
  "",
  '<S id="src" d={K.par.c}>',
  "Source text.",
  "</S>",
  "",
].join("\n");

function c4KSpec(withU2: boolean, withU1: boolean): string {
  const u2 = withU2 ? ["", '<S id="par.u2">', "U-two text.", "</S>"] : [];
  const u1 = withU1 ? ["", '<S id="par.u1">', "U-one text.", "</S>"] : [];
  return [
    '<S id="par">',
    "Par own text.",
    ...u2,
    ...u1,
    "",
    '<S id="par.c">',
    "Covered text.",
    "</S>",
    "</S>",
    "",
  ].join("\n");
}

// Both deletions follow the body's first `build`, so they are staged-source
// records (helpers/staged-mdx.ts, S-9: judged before any product exists).
const T10_7_4_K_WITHOUT_U2 = stagedMdx(
  "T10.7-4 specs/K.mdx without par.u2's section (par.u1 kept)",
  c4KSpec(false, true),
);
const T10_7_4_K_WITHOUT_U2_U1 = stagedMdx(
  "T10.7-4 specs/K.mdx without par.u2's and par.u1's sections",
  c4KSpec(false, false),
);

const C4_Z_SOURCE = ['<S id="z">', "Zee text.", "</S>", ""].join("\n");

// The item-id tie sub-fixture (SPEC 10.5's last ordering key, which the
// coverage order inherits, 10.7): two leaves of one file that come to share
// one identity. specs/A.mdx holds uncovered top-level leaves a and s, and
// the coverage session gives each its `uncovered-requirement` item. A
// journaled `rename` takes a to b; a new leaf a authored after it is a new
// node starting a new canonical chain (SPEC 5.4) — uncovered and required
// like the original — and enters the session through an `updated` resolve's
// re-derivation, which re-runs the generators with the session's recorded
// profile (SPEC 10.5, 10.7); b — the original a — is deleted by manual edit;
// a second journaled `rename` takes the new a to b, which is deleted too.
// Both items' scope nodes are then absent and presented under
// specs/A.mdx#b — recorded identities mapped forward through the journal
// (SPEC 10.4) — tied on file path, presence, and scope-node identity, so
// only the item `id` key orders them. The workspace is created after the
// body's first `build`, so its initial specs/A.mdx is a staged-source record
// (helpers/staged-mdx.ts, S-9), as is its configuration (COVERAGE_CONFIG);
// the edits after the renames change bytes the product rewrote, which no
// harness constant equals, so each is an anchored `workspace.edit()`
// (`editRewritten`).
const C4_TIE_FILE = "specs/A.mdx";
const C4_TIE_A = "specs/A.mdx#a";
const C4_TIE_B = "specs/A.mdx#b";
const C4_TIE_S = "specs/A.mdx#s";

const T10_7_4_TIE_INITIAL = stagedMdx(
  "T10.7-4 item-id tie sub-fixture specs/A.mdx (uncovered top-level leaves a and s, the sub-fixture's initial source)",
  [
    '<S id="a">',
    "Alpha text.",
    "</S>",
    "",
    '<S id="s">',
    "Ess text.",
    "</S>",
    "",
  ].join("\n"),
);

// The three edits' anchors: byte runs as SPEC 6.4's minimal in-place
// rewrites leave them — in this file a rename rewrites the renamed section's
// `id` attribute and nothing else. s's run, after which the new leaf a is
// authored; the original a's run as the first rename leaves it (`id="b"`),
// with the blank line after it, deleted; the new a's run as the second
// rename leaves it, with the blank line before it, deleted.
const C4_TIE_S_RUN = ['<S id="s">', "Ess text.", "</S>", ""].join("\n");
const C4_TIE_NEW_A_SECTION = [
  "",
  '<S id="a">',
  "New alpha text.",
  "</S>",
  "",
].join("\n");
const C4_TIE_FIRST_B_RUN = ['<S id="b">', "Alpha text.", "</S>", "", ""].join(
  "\n",
);
const C4_TIE_SECOND_B_RUN = [
  "",
  '<S id="b">',
  "New alpha text.",
  "</S>",
  "",
].join("\n");

/** UTF-8 byte order of two strings (SPEC 12.0: IDs compare byte-wise). */
function compareUtf8Bytes(a: string, b: string): number {
  return Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

/**
 * Diagnose that `search` occurs exactly once in the product-rewritten
 * `content` before `edit()` stages a manual edit at it: SPEC 6.4 fixes the
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

/**
 * Stage a manual edit of bytes the product rewrote (a rename's output, SPEC
 * 6.4): `anchor` replaced by `replacement` through `workspace.edit()` — the
 * staging of product-written bytes, judged at staging time — once the
 * anchor's uniqueness is diagnosed (`anchorOnce`).
 */
async function editRewritten(
  workspace: TestWorkspace,
  rel: string,
  anchor: string,
  replacement: string,
  context: string,
): Promise<void> {
  const current = Buffer.from(await workspace.readBytes(rel)).toString("utf8");
  anchorOnce(current, anchor, context);
  await workspace.edit(rel, anchor, replacement);
}

const T10_7_4 = defineProductTest({
  id: "T10.7-4",
  title:
    "coverage sessions: `create --coverage` derives one `uncovered-requirement` item per uncovered required node of the recorded profile — the covered leaf, the branch node, and the root nodes get none — each item scoping exactly the node with the node's ancestor chain as context and empty origin and blockedBy (so every item is unblocked); item order is scope-node file path then document order (u2 before u1, their declaration order, not identity order); after deleting an uncovered node's section the absent-scope item orders after the same file's present-scope items — not last globally: the later file's item still follows it — and after deleting both, the two absent items order by scope-node identity, u1 before u2, the reverse of their former document order; items keep their ids and the deletions alone change no membership; and two absent-scope items tied on every earlier key — the uncovered-requirement items of an original leaf a, renamed to b by a journaled `rename` and deleted by manual edit, and of a new leaf a authored after that rename (a new node on a new canonical chain, its item entering through an `updated` resolve's re-derivation under the recorded profile), renamed to b in turn and deleted, both presented absent under specs/A.mdx#b — order after the file's present-scope item by item `id` bytes, the ids the product's own, in `status`, `export`, and the `next` walk (SPEC 5.4, 6.4, 8, 8.1, 10.2, 10.4, 10.5, 10.7, 12.0)",
  run: async (product) => {
    await withWorkspace(
      COVERAGE_CONFIG,
      {
        [C4_B]: C4_B_SOURCE,
        [C4_K]: c4KSpec(true, true),
        [C4_Z]: C4_Z_SOURCE,
      },
      async (workspace) => {
        const prefix = "T10.7-4";
        await buildOk(product, workspace, `${prefix} \`build\``);
        await createCoverageSession(product, workspace, "p", "c", prefix);

        // One item per uncovered required node, in file path then document
        // order — u2 before u1 within K.mdx, their document order and the
        // reverse of their identity order (SPEC 10.7). The exact sequence
        // also pins the exclusions: no item for the covered par.c, the
        // branch par, or any root node (SPEC 8.1).
        const initial = await sessionStatus(product, workspace, "c", prefix);
        assertSameJson(
          rowSequence(initial),
          [
            `uncovered-requirement ${C4_SRC} unresolved`,
            `uncovered-requirement ${C4_U2} unresolved`,
            `uncovered-requirement ${C4_U1} unresolved`,
            `uncovered-requirement ${C4_Z_NODE} unresolved`,
          ],
          `${prefix}: one uncovered-requirement item per uncovered required ` +
            `node — covered par.c, branch par, and roots excluded — in file ` +
            `path then document order (SPEC 8.1, 10.7)`,
        );
        for (const row of initial.items) {
          if (row.blocked) {
            fail(
              `${prefix}: a coverage item's blockedBy is empty, so every ` +
                `item is unblocked (SPEC 10.3, 10.7); the ${row.scope} item ` +
                `reports blocked`,
            );
          }
        }
        const ids: Record<string, string> = {};
        for (const scope of [C4_SRC, C4_U2, C4_U1, C4_Z_NODE]) {
          ids[scope] = requireRow(
            initial,
            "uncovered-requirement",
            scope,
            prefix,
          ).id;
        }

        const exported = await exportSession(product, workspace, "c", prefix);
        assertSameJson(
          exportKindScopeSequence(exported.items),
          [
            `uncovered-requirement ${C4_SRC}`,
            `uncovered-requirement ${C4_U2}`,
            `uncovered-requirement ${C4_U1}`,
            `uncovered-requirement ${C4_Z_NODE}`,
          ],
          `${prefix}: \`export\` presents the same item order (SPEC 10.5, ` +
            `10.7)`,
        );
        const expectations: readonly {
          readonly scope: string;
          readonly ancestors: readonly string[];
        }[] = [
          { scope: C4_SRC, ancestors: [C4_B] },
          { scope: C4_U2, ancestors: [C4_K, C4_KPAR] },
          { scope: C4_U1, ancestors: [C4_K, C4_KPAR] },
          { scope: C4_Z_NODE, ancestors: [C4_Z] },
        ];
        for (const expected of expectations) {
          const item = requireItem(
            exported.items,
            "uncovered-requirement",
            expected.scope,
            prefix,
          );
          if (item.scope.node !== expected.scope || !item.scope.present) {
            fail(
              `${prefix}: the item's scope is the uncovered node itself, ` +
                `present (SPEC 10.7); expected {node: ` +
                `${JSON.stringify(expected.scope)}, present: true}, got ` +
                JSON.stringify(item.scope),
            );
          }
          assertSameJson(
            identitySet(item.context),
            [...expected.ancestors].sort(),
            `${prefix}: the ${expected.scope} item's context is the node's ` +
              `ancestor chain (SPEC 10.7)`,
          );
          assertSameJson(
            identitySet(item.origin),
            [],
            `${prefix}: a coverage item's origin is empty (SPEC 10.7)`,
          );
          assertSameJson(
            [...item.blockedBy],
            [],
            `${prefix}: a coverage item's blockedBy is empty (SPEC 10.7)`,
          );
        }

        // Delete par.u2's section (a manual edit, SPEC 6.6): its item's
        // scope goes absent, and the absent-scope item orders after the
        // same file's present-scope items — before Z.mdx's item, so it
        // stays within its file group rather than dropping to the end
        // (SPEC 10.5's ordering rule applied to the coverage order, 10.7).
        await workspace.file(C4_K, T10_7_4_K_WITHOUT_U2);
        await buildOk(
          product,
          workspace,
          `${prefix} \`build\` after deleting par.u2`,
        );
        const afterU2 = await sessionStatus(product, workspace, "c", prefix);
        assertSameJson(
          rowSequence(afterU2),
          [
            `uncovered-requirement ${C4_SRC} unresolved`,
            `uncovered-requirement ${C4_U1} unresolved`,
            `uncovered-requirement ${C4_U2} unresolved`,
            `uncovered-requirement ${C4_Z_NODE} unresolved`,
          ],
          `${prefix} after deleting par.u2: the absent-scope item orders ` +
            `after the same file's present ones (u1 now precedes u2) and ` +
            `before the next file's items — membership is unchanged by the ` +
            `deletion (SPEC 10.4, 10.5, 10.7)`,
        );
        const afterU2Export = await exportSession(
          product,
          workspace,
          "c",
          prefix,
        );
        assertSameJson(
          exportKindScopeSequence(afterU2Export.items),
          [
            `uncovered-requirement ${C4_SRC}`,
            `uncovered-requirement ${C4_U1}`,
            `uncovered-requirement ${C4_U2}`,
            `uncovered-requirement ${C4_Z_NODE}`,
          ],
          `${prefix}: \`export\` presents the same order after the deletion ` +
            `(SPEC 10.5, 10.7)`,
        );
        const u2State = requireItem(
          afterU2Export.items,
          "uncovered-requirement",
          C4_U2,
          prefix,
        ).scope;
        if (u2State.present !== false) {
          fail(
            `${prefix}: after the deletion, par.u2's item scope presents ` +
              `absent under its identity (SPEC 10.4); got ` +
              JSON.stringify(u2State),
          );
        }

        // Delete par.u1's section too: both scopes absent, ordered by
        // scope-node identity — u1 before u2, the reverse of their former
        // document order, so a product ordering absents by recorded
        // document position fails (SPEC 10.5, 10.7). The final item-id
        // tiebreak needs two absent items with equal identity strings,
        // which only arise through reintroduction after a journaled rename
        // or move (SPEC 5.4): the item-id tie sub-fixture below stages it.
        await workspace.file(C4_K, T10_7_4_K_WITHOUT_U2_U1);
        await buildOk(
          product,
          workspace,
          `${prefix} \`build\` after deleting par.u1`,
        );
        const afterBoth = await sessionStatus(product, workspace, "c", prefix);
        assertSameJson(
          rowSequence(afterBoth),
          [
            `uncovered-requirement ${C4_SRC} unresolved`,
            `uncovered-requirement ${C4_U1} unresolved`,
            `uncovered-requirement ${C4_U2} unresolved`,
            `uncovered-requirement ${C4_Z_NODE} unresolved`,
          ],
          `${prefix} after deleting both: the two absent-scope items order ` +
            `by scope-node identity — u1 before u2, the reverse of their ` +
            `former document order (SPEC 10.5, 10.7)`,
        );
        for (const scope of [C4_SRC, C4_U2, C4_U1, C4_Z_NODE]) {
          const row = requireRow(
            afterBoth,
            "uncovered-requirement",
            scope,
            prefix,
          );
          if (row.id !== ids[scope]) {
            fail(
              `${prefix}: ${scope}'s item keeps its id across the manual ` +
                `deletions — no re-derivation ran (SPEC 10.2, 10.5); ` +
                `expected ${ids[scope]}, got ${row.id}`,
            );
          }
        }
      },
    );

    // --- the absent-scope item-id tie: two leaves renamed onto one identity -
    // SPEC 10.5's last key, which the coverage order inherits (10.7):
    // absent-scope items tied on file path, presence, and scope-node
    // identity order by item `id`, byte-wise (12.0). The ids are the
    // product's own: the expected order is read from them, never spelled.
    await withWorkspace(
      COVERAGE_CONFIG,
      { [C4_TIE_FILE]: T10_7_4_TIE_INITIAL },
      async (workspace) => {
        const prefix = "T10.7-4 item-id tie";
        await buildOk(product, workspace, `${prefix} \`build\``);
        await createCoverageSession(product, workspace, "p", "c", prefix);
        const created = await sessionStatus(
          product,
          workspace,
          "c",
          `${prefix} after \`create\``,
        );
        assertSameJson(
          rowSequence(created),
          [
            `uncovered-requirement ${C4_TIE_A} unresolved`,
            `uncovered-requirement ${C4_TIE_S} unresolved`,
          ],
          `${prefix} staging premise after \`create\`: one ` +
            `uncovered-requirement item per uncovered required node — the ` +
            `two leaves, the root never required — in document order (SPEC ` +
            `8.1, 10.7)`,
        );
        const firstAId = requireRow(
          created,
          "uncovered-requirement",
          C4_TIE_A,
          prefix,
        ).id;
        const sId = requireRow(
          created,
          "uncovered-requirement",
          C4_TIE_S,
          prefix,
        ).id;

        // The original a leaves its identity through a journaled rename; a
        // new leaf a authored after it is a new node on a new canonical
        // chain (SPEC 5.4), uncovered and required, and enters the session
        // through an `updated` resolve's re-derivation — the generators
        // re-run with the recorded profile (SPEC 10.5, 10.7).
        await expectExit(
          product,
          workspace,
          ["rename", C4_TIE_FILE, "a", "b"],
          0,
          `${prefix} the first \`rename ${C4_TIE_FILE} a b\``,
        );
        await editRewritten(
          workspace,
          C4_TIE_FILE,
          C4_TIE_S_RUN,
          C4_TIE_S_RUN + C4_TIE_NEW_A_SECTION,
          `${prefix} authoring the new leaf a after the rename-rewritten s`,
        );
        await buildOk(
          product,
          workspace,
          `${prefix} \`build\` after authoring the new leaf a`,
        );
        await resolveOk(
          product,
          workspace,
          "c",
          sId,
          "updated",
          `${prefix} \`resolve c ${sId} --status updated\` (the ` +
            `re-derivation adding the new leaf a's item under the recorded ` +
            `profile, SPEC 10.5, 10.7)`,
        );
        const rederived = await sessionStatus(
          product,
          workspace,
          "c",
          `${prefix} after the re-derivation`,
        );
        const newAId = requireRow(
          rederived,
          "uncovered-requirement",
          C4_TIE_A,
          `${prefix} after the re-derivation`,
        ).id;
        if ([firstAId, sId].includes(newAId)) {
          fail(
            `${prefix} staging premise after the \`updated\` resolve: the ` +
              `new leaf a's item enters as a distinct item with a fresh id ` +
              `(SPEC 5.4: the reintroduced identity starts a new canonical ` +
              `chain, so the original a's item never matches it; 10.2); got ` +
              `the existing id ${newAId}`,
          );
        }
        assertSameJson(
          rederived.items
            .map((row) => [row.id, row.kind, row.scope, row.status])
            .sort(),
          [
            [firstAId, "uncovered-requirement", C4_TIE_B, "unresolved"],
            [sId, "uncovered-requirement", C4_TIE_S, "updated"],
            [newAId, "uncovered-requirement", C4_TIE_A, "unresolved"],
          ].sort(),
          `${prefix} staging premise after the \`updated\` resolve: exactly ` +
            `three items — the original a's item keeping its id, presented ` +
            `under ${C4_TIE_B} (its recorded identity mapped forward through ` +
            `the journal), and the new leaf a's item entering unresolved ` +
            `beside it (SPEC 5.4, 10.2, 10.4, 10.5, 10.7)`,
        );

        // The original a — now b — is deleted by manual edit; a second
        // journaled rename takes the new a to b, which is deleted too. Both
        // scope nodes are now absent, each presented under specs/A.mdx#b —
        // its recorded identity mapped forward through the journal (SPEC
        // 10.4).
        await editRewritten(
          workspace,
          C4_TIE_FILE,
          C4_TIE_FIRST_B_RUN,
          "",
          `${prefix} deleting b's section (the original a, renamed)`,
        );
        await buildOk(
          product,
          workspace,
          `${prefix} \`build\` after deleting the renamed original a`,
        );
        await expectExit(
          product,
          workspace,
          ["rename", C4_TIE_FILE, "a", "b"],
          0,
          `${prefix} the second \`rename ${C4_TIE_FILE} a b\``,
        );
        await editRewritten(
          workspace,
          C4_TIE_FILE,
          C4_TIE_SECOND_B_RUN,
          "",
          `${prefix} deleting b's section (the new leaf a, renamed)`,
        );
        await buildOk(
          product,
          workspace,
          `${prefix} \`build\` after deleting the renamed new leaf a`,
        );

        const tiedLabel = `${prefix} after both deletions`;
        const tiedStatus = await sessionStatus(
          product,
          workspace,
          "c",
          tiedLabel,
        );
        const tiedExport = await exportSession(
          product,
          workspace,
          "c",
          tiedLabel,
        );
        assertSameJson(
          tiedExport.items
            .map((item) => [
              item.id,
              item.kind,
              item.scope.node,
              item.scope.present,
            ])
            .sort(),
          [
            [sId, "uncovered-requirement", C4_TIE_S, true],
            [firstAId, "uncovered-requirement", C4_TIE_B, false],
            [newAId, "uncovered-requirement", C4_TIE_B, false],
          ].sort(),
          `${tiedLabel} staging premise (\`export\`): exactly the three ` +
            `items — items that no longer generate remain, and only an ` +
            `\`updated\` resolve re-derives, none having followed the one ` +
            `above (SPEC 10.5) — s's scope node present, and exactly two ` +
            `items scoped ${C4_TIE_B}, both uncovered-requirement, both ` +
            `absent: the original a's and the new leaf a's, each recorded ` +
            `identity mapped forward through the journal (SPEC 10.4), so ` +
            `they tie on file path, presence, and scope-node identity (SPEC ` +
            `10.5, 10.7)`,
        );

        const [lowId, highId] = [firstAId, newAId].sort(compareUtf8Bytes);
        const tieKey =
          `SPEC 10.5: among items tied on every earlier key, those with ` +
          `absent scope nodes follow, ordered by scope-node identity, then by ` +
          `item \`id\`; 12.0: IDs compare byte-wise — ${lowId} before ` +
          `${highId}; ${firstAId} is the original a's item, ${newAId} the ` +
          `new leaf a's`;
        const tiedOrder = [
          [sId, "uncovered-requirement", C4_TIE_S],
          [lowId, "uncovered-requirement", C4_TIE_B],
          [highId, "uncovered-requirement", C4_TIE_B],
        ];
        assertSameJson(
          tiedStatus.items.map((row) => [row.id, row.kind, row.scope]),
          tiedOrder,
          `${tiedLabel} \`status\`: the file's present-scope item — s's — ` +
            `and then the two tied absent-scope items in item-id byte order ` +
            `(the 10.5 absent-scope rule applies to the coverage order, ` +
            `SPEC 10.7; ${tieKey})`,
        );
        assertSameJson(
          tiedExport.items.map((item) => [item.id, item.kind, item.scope.node]),
          tiedOrder,
          `${tiedLabel} \`export\` presents the same item order (${tieKey}; ` +
            `SPEC 10.7)`,
        );

        // `next` presents the tie as its walk order. Premise: s's item is
        // resolved (the trigger's `updated`) and both tied items need review
        // unblocked — a coverage item's blockedBy is empty, and neither tied
        // item was ever resolved (SPEC 10.3, 10.7).
        assertSameJson(
          tiedStatus.items
            .map((row) => [row.id, row.status, row.blocked])
            .sort(),
          [
            [sId, "updated", false],
            [firstAId, "unresolved", false],
            [newAId, "unresolved", false],
          ].sort(),
          `${tiedLabel} staging premise for the walk (compared as a set, ` +
            `the order asserted above and by the walk itself): s's item ` +
            `resolved and both tied items needing review unblocked, so ` +
            `\`next\` must choose between them by item order (SPEC 10.3, ` +
            `10.7)`,
        );
        const walk = [lowId, highId];
        for (let index = 0; index < walk.length; index += 1) {
          const stepLabel =
            `${prefix} \`review next c --json\` walk step ` +
            `${String(index + 1)} of ${String(walk.length)}`;
          const next = decodeNextReport(
            await runJson(
              product,
              workspace,
              ["review", "next", "c", "--json"],
              stepLabel,
            ),
            stepLabel,
          );
          if (next.fullyResolved || next.item === undefined) {
            fail(
              `${stepLabel}: needing-review items remain, so \`next\` must ` +
                `return one (SPEC 10.7)`,
            );
          }
          if (next.item.id !== walk[index]) {
            fail(
              `${stepLabel}: \`next\` returns the first needing-review ` +
                `unblocked item in item order (SPEC 10.7; ${tieKey}) — ` +
                `expected ${walk[index]}, got ${next.item.id} ` +
                `(${next.item.kind} ${next.item.scope.node})` +
                (index === 1 && next.item.id === lowId
                  ? ` — the item just resolved \`no-change\` with its scope ` +
                    `node absent, which stays resolved while the node stays ` +
                    `absent (SPEC 10.4)`
                  : ""),
            );
          }
          await resolveOk(
            product,
            workspace,
            "c",
            next.item.id,
            "no-change",
            `${stepLabel} — \`resolve --status no-change\` to advance the walk`,
          );
        }
        const doneLabel = `${prefix} \`review next c --json\` after the walk`;
        const done = decodeNextReport(
          await runJson(
            product,
            workspace,
            ["review", "next", "c", "--json"],
            doneLabel,
          ),
          doneLabel,
        );
        if (!done.fullyResolved) {
          fail(
            `${doneLabel}: every item is resolved — s's \`updated\`, both ` +
              `tied items \`no-change\` — so \`next\` reports the session ` +
              `fully resolved (SPEC 10.7)`,
          );
        }
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T10.7-5 — list
// ---------------------------------------------------------------------------

const C5_FILE = "specs/W.mdx";
const C5_W = "specs/W.mdx#w";

function c5Spec(text: string): string {
  return ['<S id="w">', text, "</S>", ""].join("\n");
}

// The workspace's initial specs/W.mdx: T12.0-15 (section-12.0-iv.ts) runs
// this staging after its body's first invocation, so it is a staged-source
// record (helpers/staged-mdx.ts, S-9's timing clause) — the same expression,
// moved into the record. The edit of w after a2's resolution follows the
// body's first `build`, so it is one too (S-9: judged before any product
// exists); the corrupt session's bytes stage no `.mdx` path.
const T10_7_5_W_INITIAL = stagedMdx(
  "T10.7-5/T12.0-15 specs/W.mdx with w's text at v0 (the listing fixture's initial source)",
  c5Spec("Dub text v0."),
);
const T10_7_5_W_EDITED = stagedMdx(
  "T10.7-5/T12.0-15 specs/W.mdx with w's text at v1 (the edit after a2's resolution)",
  c5Spec("Dub text v1."),
);

/** Condition 21's stable code (SPEC 14: 21 `corrupt-session`; 12.7). */
const CORRUPT_SESSION_CODE = "corrupt-session";

/**
 * The corrupt listing's condition 21 (T10.7-5; TEST-SPEC line 9's rule for
 * an error report): `review list` reports condition 21 for each corrupt
 * session (SPEC 14.21, exit 1) under the listing's `"findings"` member
 * (12.7), which the decoder requires while a session is listed corrupt.
 * With one session's file overwritten by unparseable bytes and every other
 * session healthy, the listing holds exactly one finding (the module
 * header), asked as T10.7-1's refusals ask theirs: its exact stable code
 * `corrupt-session` (SPEC 14; the derived condition 14.21), the corrupt
 * session's own file `.xspec/reviews/<name>.json` as its 12.7 `path` (SPEC
 * 14, 12.7, 10.1), and no in-source location (`locations` []). `label`
 * names the listing; each diagnosis adds every offending finding's code,
 * path, and message.
 */
function assertListingCorruptFinding(
  listing: SessionListReport,
  concernedPath: string,
  label: string,
): void {
  const findings = listing.findings;
  if (findings === undefined) {
    fail(
      `${label}: the listing must carry the corrupt session's condition 21 ` +
        `under its "findings" member (SPEC 14.21, 12.7); the decoded ` +
        `document carries no such member`,
    );
  }
  const describe = (finding: Finding): string =>
    `code ${JSON.stringify(finding.code)}, path ` +
    `${JSON.stringify(finding.path)}, message ` +
    JSON.stringify(finding.message);
  if (findings.length !== 1) {
    fail(
      `${label}: the listing's findings must hold the corrupt session's ` +
        `condition 21 as exactly one finding \`${CORRUPT_SESSION_CODE}\` — ` +
        `one session's file holds unparseable bytes, every other session ` +
        `is healthy (SPEC 10.7, 14, 14.21, 12.7); got ` +
        (findings.length === 0
          ? "no findings"
          : `${String(findings.length)}: ` +
            findings
              .map(
                (finding, index) =>
                  `(${String(index + 1)}) ${describe(finding)}`,
              )
              .join("; ")),
    );
  }
  const finding = findings[0];
  const which = `${label}: the listing's finding (${describe(finding)})`;
  if (finding.code !== CORRUPT_SESSION_CODE) {
    fail(
      `${which}: a corrupt session is condition 21, carrying its exact ` +
        `stable code ${JSON.stringify(CORRUPT_SESSION_CODE)} (TEST-SPEC line ` +
        `9: the exact code string; SPEC 14, 14.21, 12.7)`,
    );
  }
  if (finding.path !== concernedPath) {
    fail(
      `${which}: a session condition carries the session file it concerns ` +
        `as its 12.7 path — the corrupt session's own path ` +
        `${JSON.stringify(concernedPath)} (SPEC 14, 12.7, 10.1)`,
    );
  }
  if (finding.locations.length !== 0) {
    fail(
      `${which}: a session condition has no in-source location — ` +
        `locations [] (SPEC 14, 12.7); got ` +
        JSON.stringify(finding.locations),
    );
  }
}

/**
 * One `review list` read T10.7-5's staging reaches — the listing with no
 * corrupt session, then the one with session c corrupt — handed to the
 * staging's visitor at the state it reads: its label, the exit the home
 * test pins there (SPEC 10.7: 1 iff any corrupt session exists, else 0),
 * and the home test's own `review list --json` read with its assertions and
 * the human form's parity check (`home`). Exported for T12.0-15
 * (section-12.0-iv.ts), which hands its human twin of the read in their
 * place.
 */
export interface T1075Listing {
  readonly label: string;
  readonly expectedExit: 0 | 1;
  readonly home: () => Promise<void>;
}

/** A visitor of T10.7-5's listings, each at the state it reads. */
export type T1075ListingVisitor = (
  workspace: TestWorkspace,
  listing: T1075Listing,
) => Promise<void>;

/**
 * T10.7-5's staging, its two listings handed to `visit` (exported for
 * T12.0-15): a git-backed workspace of `COVERAGE_CONFIG` and specs/W.mdx,
 * built; the audit session a2, w's item resolved `no-change` and then made
 * stale by w's edit (rebuilt, `status` reading it invalidated — the
 * premise); the path-blocks session a and the coverage session B, each
 * holding one item (`status`); the clean listing; the audit session c, its
 * file then overwritten by unparseable bytes; the corrupt listing. `prefix`
 * leads every staging step's diagnosis.
 */
export async function runT1075Listings(
  product: ProductBinding,
  visit: T1075ListingVisitor,
  prefix = "T10.7-5",
): Promise<void> {
  await withWorkspace(
    COVERAGE_CONFIG,
    { [C5_FILE]: T10_7_5_W_INITIAL },
    async (workspace) => {
      await workspace.gitInit();
      await workspace.gitCommitAll("baseline");
      await buildOk(product, workspace, `${prefix} \`build\``);

      // Session a2 (audit) first: two items (the root's and w's). w's
      // item is resolved no-change, then w is edited so the resolution
      // goes stale — the read-time invalidation discriminator for the
      // stored-status counting below.
      await createAuditSession(product, workspace, "a2", prefix);
      const a2Initial = await sessionStatus(product, workspace, "a2", prefix);
      assertSameJson(
        rowSequence(a2Initial),
        [
          `subtree-coherence ${C5_FILE} unresolved`,
          `subtree-coherence ${C5_W} unresolved`,
        ],
        `${prefix}: a2's audit items (SPEC 10.6)`,
      );
      const idW = requireRow(a2Initial, "subtree-coherence", C5_W, prefix).id;
      await resolveOk(
        product,
        workspace,
        "a2",
        idW,
        "no-change",
        `${prefix} \`resolve a2 <w's item> --status no-change\``,
      );
      await workspace.file(C5_FILE, T10_7_5_W_EDITED);
      await buildOk(product, workspace, `${prefix} \`build\` after the w edit`);
      // Staging premise: the resolution is stale — `status` (read-time
      // invalidation applied, SPEC 10.4) reports w's item invalidated
      // while its stored status stays no-change.
      const a2Stale = await sessionStatus(product, workspace, "a2", prefix);
      const staleRow = requireRow(a2Stale, "subtree-coherence", C5_W, prefix);
      if (staleRow.status !== "invalidated") {
        fail(
          `${prefix} staging premise: after the w edit, w's resolved item ` +
            `must read invalidated (SPEC 10.4) so the list counts below ` +
            `discriminate stored statuses from invalidation-applied ones; ` +
            `got ${staleRow.status}`,
        );
      }

      // Sessions a (path-blocks: w changed against the baseline gives one
      // subtree-coherence item; w's only ancestor is the root, so no
      // parent-consistency item, SPEC 10.5) and B (coverage: the one
      // uncovered leaf w). Creation order a2, a, B.
      await createBaseSession(product, workspace, "main", "a", prefix);
      assertSameJson(
        rowSequence(await sessionStatus(product, workspace, "a", prefix)),
        [`subtree-coherence ${C5_W} unresolved`],
        `${prefix}: a's path-blocks item (SPEC 10.5)`,
      );
      await createCoverageSession(product, workspace, "p", "B", prefix);
      assertSameJson(
        rowSequence(await sessionStatus(product, workspace, "B", prefix)),
        [`uncovered-requirement ${C5_W} unresolved`],
        `${prefix}: B's coverage item (SPEC 10.7)`,
      );

      await visit(workspace, {
        label: `${prefix} the listing with no corrupt session`,
        expectedExit: 0,
        home: async () => {
          // No corrupt session: exit 0; byte order of name — "B" (0x42) <
          // "a" (0x61) < "a2" — differing from creation order (a2, a, B) and
          // from ASCII-case-folded order (a, a2, B). Strategy names are the
          // ones SPEC 10 fixes.
          const clean = await listSessions(product, workspace, prefix);
          assertSameJson(
            clean.sessions.map((entry) => ({
              name: entry.name,
              corrupt: entry.corrupt,
              strategy: entry.corrupt ? undefined : entry.strategy,
            })),
            [
              { name: "B", corrupt: false, strategy: "coverage" },
              { name: "a", corrupt: false, strategy: "path-blocks" },
              { name: "a2", corrupt: false, strategy: "audit" },
            ],
            `${prefix}: \`list\` reports every session in byte order of name ` +
              `with its strategy (SPEC 10, 10.7, 12.0)`,
          );
          assertStoredCounts(
            clean.sessions[0],
            {
              unresolved: 1,
              invalidated: 0,
              updated: 0,
              "no-change": 0,
              skipped: 0,
            },
            `${prefix} session B`,
          );
          assertStoredCounts(
            clean.sessions[1],
            {
              unresolved: 1,
              invalidated: 0,
              updated: 0,
              "no-change": 0,
              skipped: 0,
            },
            `${prefix} session a`,
          );
          // The discriminator: w's stale resolution still counts under its
          // stored no-change — a product applying read-time invalidation to
          // `list` would report it invalidated (SPEC 10.4, 10.7).
          assertStoredCounts(
            clean.sessions[2],
            {
              unresolved: 1,
              invalidated: 0,
              updated: 0,
              "no-change": 1,
              skipped: 0,
            },
            `${prefix} session a2 (stored statuses, no read-time invalidation)`,
          );
          // The human form at the same state carries the listing's
          // information: names, strategies, stored statuses, and counts
          // (T12.0-1, SPEC 12.0; the module header).
          await assertHumanSessionList(product, workspace, clean, 0, prefix);
        },
      });

      // A fourth session, then corrupt it: unparseable bytes written over
      // the session file the product itself wrote — the shape-independent
      // corrupt state, staged directly per the T10.1-4 conventions.
      await createAuditSession(product, workspace, "c", prefix);
      const sessionRel = ".xspec/reviews/c.json";
      const kind = await workspace.kind(sessionRel);
      if (kind !== "file") {
        fail(
          `${prefix} staging premise: after \`create --name c\`, expected ` +
            `the product-written session file at ${sessionRel} ` +
            `(SPEC 10.1); found ${kind}`,
        );
      }
      await workspace.file(sessionRel, "{ this is not JSON");

      await visit(workspace, {
        label: `${prefix} the listing with session c corrupt`,
        expectedExit: 1,
        home: async () => {
          const corruptContext = `${prefix} \`review list --json\` with session c corrupt`;
          const result = await runCli(product, workspace, [
            "review",
            "list",
            "--json",
          ]);
          assertExitCode(
            result,
            1,
            `${corruptContext} — \`list\` exits 1 iff any corrupt session ` +
              `exists (SPEC 10.7, 14.21)`,
          );
          const corrupt = decodeSessionListReport(
            parseJsonStdout(result, corruptContext),
            corruptContext,
          );
          assertSameJson(
            corrupt.sessions.map((entry) => ({
              name: entry.name,
              corrupt: entry.corrupt,
            })),
            [
              { name: "B", corrupt: false },
              { name: "a", corrupt: false },
              { name: "a2", corrupt: false },
              { name: "c", corrupt: true },
            ],
            `${corruptContext}: the corrupt session is reported by name as ` +
              `corrupt in place of its fields — the adapter refuses strategy ` +
              `and counts on a corrupt entry — while the healthy sessions ` +
              `keep theirs, all in byte order of name (SPEC 10.1, 10.7)`,
          );
          // The listing's condition 21, with no invocation of its own: `list`
          // reports the corrupt session (SPEC 14.21, exit 1) and carries its
          // finding under the document's "findings" member (12.7), which the
          // decoder requires while a session is listed corrupt — as `c` now
          // is. Exactly one finding, `corrupt-session` concerning c's own
          // file with `locations` [] (the module header: one session holds
          // unparseable bytes, the three others are healthy).
          assertListingCorruptFinding(
            corrupt,
            sessionRel,
            `${corruptContext} — the listing's findings`,
          );
          assertStoredCounts(
            corrupt.sessions[2],
            {
              unresolved: 1,
              invalidated: 0,
              updated: 0,
              "no-change": 1,
              skipped: 0,
            },
            `${corruptContext} session a2 — fields unchanged beside the ` +
              `corrupt entry`,
          );
          // The human form at the same state: exit 1 as well, the healthy
          // sessions' information, and the corrupt session's name beside the
          // token `corrupt` (T12.0-1, SPEC 12.0; the module header).
          await assertHumanSessionList(
            product,
            workspace,
            corrupt,
            1,
            `${prefix} (session c corrupt)`,
          );
        },
      });
    },
  );
}

const T10_7_5 = defineProductTest({
  id: "T10.7-5",
  title:
    "`review list`: every session is reported in byte order of session name — created `a2`, then `a`, then `B`, listed `B`, `a`, `a2`, an order differing from both creation order and ASCII-case-folded order — each with its name, strategy (the spec-fixed strategy names `coverage`, `path-blocks`, `audit`), and item counts by stored status with no read-time invalidation applied: a resolved item whose scope was edited afterward reads as invalidated in `status` yet still counts under its stored `no-change`; a corrupt session (unparseable bytes over a product-written session file) is reported by name as corrupt in place of those fields, the corrupt listing carrying condition 21's one finding — `corrupt-session`, concerning the session's own file `.xspec/reviews/c.json`, with no location (`locations` []); `list` exits 1 iff any corrupt session exists, else 0; and the human `review list` at each listing's state exits alike and carries the listing's information — every session's name, each healthy session's strategy, the statuses it stores items under, and its nonzero counts, and `corrupt` beside the corrupt session's name (robust matching, H-3) (SPEC 10.1, 10.4, 10.7, 12.0, 12.7, 14, 14.21)",
  run: async (product) => {
    await runT1075Listings(product, (_workspace, listing) => listing.home());
  },
});

// ---------------------------------------------------------------------------
// T10.7-6 — status
// ---------------------------------------------------------------------------

const C6_FILE = "specs/T.mdx";
const C6_P = "specs/T.mdx#p";
const C6_PA = "specs/T.mdx#p.a";
const C6_PB = "specs/T.mdx#p.b";

function c6Spec(paText: string): string {
  return [
    '<S id="p">',
    "Pee own text.",
    "",
    '<S id="p.a">',
    paText,
    "</S>",
    "",
    '<S id="p.b">',
    "Pab text.",
    "</S>",
    "</S>",
    "",
  ].join("\n");
}

/** Full `id|kind|scope|status|blocked` row rendering (order compare). */
function fullRowSequence(report: SessionStatusReport): readonly string[] {
  return report.items.map(
    (row) =>
      `${row.id}|${row.kind}|${row.scope}|${row.status}|blocked=${String(row.blocked)}`,
  );
}

// The workspace's initial specs/T.mdx: T12.0-15 (section-12.0-iv.ts) runs
// this staging after its body's first invocation, so it is a staged-source
// record (helpers/staged-mdx.ts, S-9's timing clause) — the same expression,
// moved into the record. Stage D's edit follows the body's first `build`, so
// it is one too (S-9: judged before any product exists).
const T10_7_6_T_INITIAL = stagedMdx(
  "T10.7-6/T12.0-15 specs/T.mdx with p.a's text at v0 (the status fixture's initial source)",
  c6Spec("Paa text v0."),
);
const T10_7_6_T_PA_EDITED = stagedMdx(
  "T10.7-6/T12.0-15 specs/T.mdx with p.a's text at v1 (stage D's edit under two resolved scopes)",
  c6Spec("Paa text v1."),
);

/**
 * One `review status s` read T10.7-6's staging reaches — stages A through
 * D — handed to the staging's visitor at the state it reads: its label,
 * the session it reads, and the home test's own assertions there with the
 * human form's parity check (`home`; stage A's over the staging's own
 * read, which yields the item ids, each later stage's over a read of its
 * own). Exported for T12.0-15 (section-12.0-iv.ts), which hands its human
 * twin of the read in their place.
 */
export interface T1076Stage {
  readonly label: string;
  readonly session: string;
  readonly home: () => Promise<void>;
}

/** A visitor of T10.7-6's stages, each at the state its read sees. */
export type T1076StageVisitor = (
  workspace: TestWorkspace,
  stage: T1076Stage,
) => Promise<void>;

/**
 * T10.7-6's staging, its four stages handed to `visit` (exported for
 * T12.0-15): a workspace of `SPECS_ONLY_CONFIG` and specs/T.mdx (p holding
 * p.a and p.b), built; the audit session s, read by `status` — its item
 * order the staging's premise and its rows' ids the items it resolves —
 * at stage A; p.a's item resolved `no-change` and p.b's `skipped` (stage
 * B); p's item `updated` (stage C); then p.a's text edited under the two
 * resolved scopes, the edit's hash premises read by `query node` around
 * it, and rebuilt (stage D). `prefix` leads every staging step's
 * diagnosis.
 */
export async function runT1076Stages(
  product: ProductBinding,
  visit: T1076StageVisitor,
  prefix = "T10.7-6",
): Promise<void> {
  await withWorkspace(
    SPECS_ONLY_CONFIG,
    { [C6_FILE]: T10_7_6_T_INITIAL },
    async (workspace) => {
      await buildOk(product, workspace, `${prefix} \`build\``);
      await createAuditSession(product, workspace, "s", prefix);

      // Stage A — fresh: items in audit item order (root first, then
      // document order), every field present per row; the items with
      // child sections report blocked (SPEC 10.3, 10.6).
      const fresh = await sessionStatus(product, workspace, "s", prefix);
      assertSameJson(
        rowSequence(fresh),
        [
          `subtree-coherence ${C6_FILE} unresolved`,
          `subtree-coherence ${C6_P} unresolved`,
          `subtree-coherence ${C6_PA} unresolved`,
          `subtree-coherence ${C6_PB} unresolved`,
        ],
        `${prefix} stage A: items in item order (SPEC 10.6, 10.7)`,
      );
      const idRoot = requireRow(fresh, "subtree-coherence", C6_FILE, prefix).id;
      const idP = requireRow(fresh, "subtree-coherence", C6_P, prefix).id;
      const idPA = requireRow(fresh, "subtree-coherence", C6_PA, prefix).id;
      const idPB = requireRow(fresh, "subtree-coherence", C6_PB, prefix).id;
      const expectRows = (
        rows: readonly (readonly [string, string, ItemStatus, boolean])[],
      ): readonly string[] =>
        rows.map(
          ([id, scope, status, blocked]) =>
            `${id}|subtree-coherence|${scope}|${status}|blocked=${String(blocked)}`,
        );
      await visit(workspace, {
        label: `${prefix} stage A (fresh: every item unresolved, the parents blocked)`,
        session: "s",
        home: async () => {
          assertSameJson(
            fullRowSequence(fresh),
            expectRows([
              [idRoot, C6_FILE, "unresolved", true],
              [idP, C6_P, "unresolved", true],
              [idPA, C6_PA, "unresolved", false],
              [idPB, C6_PB, "unresolved", false],
            ]),
            `${prefix} stage A: every row carries id, kind, scope, status, ` +
              `and blocked state — the parent items blocked while their ` +
              `children's items are unresolved, the leaves unblocked ` +
              `(SPEC 10.3, 10.6, 10.7)`,
          );
          assertTotals(
            fresh,
            {
              unresolved: 4,
              invalidated: 0,
              updated: 0,
              "no-change": 0,
              skipped: 0,
            },
            `${prefix} stage A`,
          );
          // The human form at the same state carries the report's
          // information — rows, blocked state, and totals — at every stage
          // (T12.0-1, SPEC 12.0; the module header).
          await assertHumanSessionStatus(
            product,
            workspace,
            "s",
            fresh,
            `${prefix} stage A`,
          );
        },
      });

      // Stage B — the leaves resolve (no-change and skipped are both
      // resolved statuses, SPEC 10.3): p unblocks, the root stays blocked
      // by unresolved p.
      await resolveOk(
        product,
        workspace,
        "s",
        idPA,
        "no-change",
        `${prefix} \`resolve s <p.a's item> --status no-change\``,
      );
      await resolveOk(
        product,
        workspace,
        "s",
        idPB,
        "skipped",
        `${prefix} \`resolve s <p.b's item> --status skipped\``,
      );
      await visit(workspace, {
        label: `${prefix} stage B (both leaves resolved)`,
        session: "s",
        home: async () => {
          const stageB = await sessionStatus(product, workspace, "s", prefix);
          assertSameJson(
            fullRowSequence(stageB),
            expectRows([
              [idRoot, C6_FILE, "unresolved", true],
              [idP, C6_P, "unresolved", false],
              [idPA, C6_PA, "no-change", false],
              [idPB, C6_PB, "skipped", false],
            ]),
            `${prefix} stage B: with both leaves resolved p's item unblocks ` +
              `while the root stays blocked by unresolved p (SPEC 10.3)`,
          );
          assertTotals(
            stageB,
            {
              unresolved: 2,
              invalidated: 0,
              updated: 0,
              "no-change": 1,
              skipped: 1,
            },
            `${prefix} stage B`,
          );
          await assertHumanSessionStatus(
            product,
            workspace,
            "s",
            stageB,
            `${prefix} stage B`,
          );
        },
      });

      // Stage C — p resolves `updated`: the re-derivation over the
      // unchanged workspace changes nothing, every id survives, and the
      // root unblocks (SPEC 10.5, 10.6).
      await resolveOk(
        product,
        workspace,
        "s",
        idP,
        "updated",
        `${prefix} \`resolve s <p's item> --status updated\``,
      );
      await visit(workspace, {
        label: `${prefix} stage C (p resolved updated)`,
        session: "s",
        home: async () => {
          const stageC = await sessionStatus(product, workspace, "s", prefix);
          assertSameJson(
            fullRowSequence(stageC),
            expectRows([
              [idRoot, C6_FILE, "unresolved", false],
              [idP, C6_P, "updated", false],
              [idPA, C6_PA, "no-change", false],
              [idPB, C6_PB, "skipped", false],
            ]),
            `${prefix} stage C: p resolved updated — the re-derivation over ` +
              `the unchanged workspace keeps every item and id, and the root ` +
              `unblocks (SPEC 10.3, 10.5, 10.6)`,
          );
          assertTotals(
            stageC,
            {
              unresolved: 1,
              invalidated: 0,
              updated: 1,
              "no-change": 1,
              skipped: 1,
            },
            `${prefix} stage C`,
          );
          await assertHumanSessionStatus(
            product,
            workspace,
            "s",
            stageC,
            `${prefix} stage C`,
          );
        },
      });

      // Stage D — an edit under two resolved items' scopes: p.a's text
      // changes, so p.a's item (scope p.a) and p's item (p.a is in its
      // scope) hold stale recorded state, while p.b's relevant hashes are
      // untouched (SPEC 5.5, 10.4). Hash premises via `query node`
      // bracket the edit.
      const paBefore = await queryNode(product, workspace, C6_PA, prefix);
      const pBefore = await queryNode(product, workspace, C6_P, prefix);
      const pbBefore = await queryNode(product, workspace, C6_PB, prefix);
      await workspace.file(C6_FILE, T10_7_6_T_PA_EDITED);
      await buildOk(
        product,
        workspace,
        `${prefix} \`build\` after the p.a edit`,
      );
      const paAfter = await queryNode(product, workspace, C6_PA, prefix);
      const pAfter = await queryNode(product, workspace, C6_P, prefix);
      const pbAfter = await queryNode(product, workspace, C6_PB, prefix);
      if (
        paAfter.hashes.subtreeHash === paBefore.hashes.subtreeHash ||
        pAfter.hashes.subtreeHash === pBefore.hashes.subtreeHash
      ) {
        fail(
          `${prefix} staging premise: the p.a edit must change p.a's and ` +
            `p's subtreeHash (SPEC 5.5) so both resolved items go stale`,
        );
      }
      if (
        pbAfter.hashes.subtreeHash !== pbBefore.hashes.subtreeHash ||
        pbAfter.hashes.metadataHash !== pbBefore.hashes.metadataHash
      ) {
        fail(
          `${prefix} staging premise: the p.a edit must leave p.b's ` +
            `relevant hashes untouched (SPEC 5.5) so p.b's resolution ` +
            `stays standing`,
        );
      }

      await visit(workspace, {
        label: `${prefix} stage D (an edit under two resolved scopes)`,
        session: "s",
        home: async () => {
          // Read-time invalidation applied to rows and totals (SPEC 10.4,
          // 10.7): the two stale resolutions read invalidated — their stored
          // updated/no-change no longer appear in the totals — the
          // invalidated p re-blocks the root and invalidated p.a re-blocks p
          // (SPEC 10.3), p.b keeps skipped, and the unresolved root cannot
          // invalidate.
          const stageD = await sessionStatus(product, workspace, "s", prefix);
          assertSameJson(
            fullRowSequence(stageD),
            expectRows([
              [idRoot, C6_FILE, "unresolved", true],
              [idP, C6_P, "invalidated", true],
              [idPA, C6_PA, "invalidated", false],
              [idPB, C6_PB, "skipped", false],
            ]),
            `${prefix} stage D: read-time invalidation applied — the stale ` +
              `resolutions read invalidated, the invalidated blockers ` +
              `re-block their dependents, the untouched p.b keeps skipped ` +
              `(SPEC 10.3, 10.4, 10.7)`,
          );
          assertTotals(
            stageD,
            {
              unresolved: 1,
              invalidated: 2,
              updated: 0,
              "no-change": 0,
              skipped: 1,
            },
            `${prefix} stage D (totals with read-time invalidation applied — ` +
              `the stored updated and no-change count under invalidated)`,
          );
          await assertHumanSessionStatus(
            product,
            workspace,
            "s",
            stageD,
            `${prefix} stage D`,
          );
        },
      });
    },
  );
}

const T10_7_6 = defineProductTest({
  id: "T10.7-6",
  title:
    "`review status`: items are reported in item order, each with id, kind, scope, status, and blocked state, plus totals by status — asserted through an audit session's lifecycle: all-unresolved with the parent items blocked; after resolving the leaves the parent unblocks; after resolving the parent `updated` (a re-derivation that changes nothing) the root unblocks and every id survives; and after an edit under two resolved items' scopes the read-time invalidation is applied to rows and totals alike — the stale resolutions read `invalidated` (their stored statuses no longer appear in the totals), the invalidated blocker re-blocks its dependents, and the untouched resolved item keeps its status; and at every stage the human `review status` at the same state exits 0 and carries the report's information — every row's id, scope, kind, and status, `blocked` where a row is blocked, and each status with a nonzero total and that total (robust matching, H-3) (SPEC 10.3, 10.4, 10.6, 10.7, 12.0)",
  run: async (product) => {
    await runT1076Stages(product, (_workspace, stage) => stage.home());
  },
});

/** TEST-SPEC §10.7 first half, in canonical ID order (SUITE-38). */
export const section107iTests: readonly ProductTestEntry[] = [
  T10_7_1,
  T10_7_2,
  T10_7_3,
  T10_7_4,
  T10_7_5,
  T10_7_6,
];
