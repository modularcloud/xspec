// TEST-SPEC §10.1 (review sessions) — SUITE-33: T10.1-1…T10.1-6.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), and rejects a product only via diagnosed
// assertion failures (H-8).
//
// SPEC 10.1: a session lives at `.xspec/reviews/<name>.json` as a plain,
// deterministic file; names are one or more of `A–Z a–z 0–9 . _ -`, never
// beginning with `.`; names are case-sensitive everywhere except `create`'s
// ASCII-case-insensitive existing-name refusal; only a file directly under
// `.xspec/reviews/` named `<valid-name>.json` is a session — anything else
// there is ignored by every command; a session file that is not a plain file,
// cannot be parsed, or violates a session invariant is corrupt (14.21).
//
// Conservative operationalizations (noted per H-3/H-4):
// - "writes exactly `.xspec/reviews/<name>.json` and nothing else" is a
//   whole-workspace byte-state diff around `create` (H-4): the only tolerated
//   additions besides the session file are its parent directory entries
//   (`.xspec`, `.xspec/reviews`), which must exist for the file to. On the
//   stale-workspace arm the tolerated set widens to entries under `.xspec/`
//   outside `.xspec/reviews/` — the 13.3 graph-data refresh, whose content is
//   opaque (H-4) — while everything outside `.xspec/` (generated TypeScript
//   and Markdown included) and every other session must stay byte-identical.
// - "reports the corruption" (T10.1-4): 12.0 classes `review` subcommands
//   naming a corrupt session as exit-1 findings, and findings are reports —
//   standard-output content; SPEC.md's fixed vocabulary for the state is
//   "corrupt" (10.1, 10.7, 14.21). Each naming subcommand runs twice inside
//   one modifies-nothing compare, flag-less and then with `--json`. The
//   `--json` run is decoded as the form-exact findings-only report (12.7;
//   H-3, H-5), and so is `export`'s flag-less run: `export`'s only output
//   form is that single JSON document, with or without `--json` (SPEC
//   10.7; H-5's JSON-only clause), and its two decoded documents are
//   deep-equal, array order significant (T12.0-1's JSON-only parity).
//   `review list --json` reports the session corrupt in place of its
//   fields (10.7) and carries its condition 21 (14.21: reported by `review
//   list`, exit 1) under the listing's `"findings"` member (12.7: wherever
//   a document carries findings they form that member; the decoder
//   requires it while a session is listed corrupt, H-3): the listing's
//   findings are judged as the naming subcommands' reports are, with no
//   invocation of their own. Every decoded report — the listing's findings
//   included — holds at least one finding, and every finding carries what
//   TEST-SPEC line 9 asks of an error report: condition 21's exact stable
//   code `corrupt-session` (SPEC 14), the session file itself as its 12.7
//   `path` — a symbolic link there by its own path, never its target's
//   (10.1, 13.4) — and `locations` [] (a session condition has no
//   in-source location; SPEC 14, 12.7). The staged session is the only
//   corrupt one (the symbolic-link state's `real` beside the link is valid
//   and reports none), so every finding of the listing concerns it. At
//   least one finding, not exactly one, from a naming subcommand and from
//   `list` alike: SPEC pins one finding for `create`'s refusal alone
//   (10.7), and a state violating two invariants at once (the
//   duplicate-item-ids state: unique item ids, and one item per kind and
//   scope node) may be reported as two distinct condition-21 findings (12.7
//   collapses only findings identical in every member). The flag-less runs
//   of the other five subcommands are human reports, asserted as exit 1
//   with stdout matching /corrupt/i (information presence, never exact
//   wording, H-3): the human parity of a findings report is asked at the
//   findings sites (T14-1, T14-7, T13.3-3), not per staging. Each state's
//   `check --json` arm asserts the same concern information over its
//   condition-21 findings.
// - "modifies nothing" is a whole-workspace snapshot compare around each
//   command — for T10.1-4's naming subcommands, one compare around both of
//   a subcommand's runs, flag-less and with `--json` (H-4); the compares
//   run with fresh graph data, so no 13.3 refresh legitimately intervenes.
// - The directory/symlink occupant states name a placeholder item id in
//   `show`/`resolve`/`split`: 10.1 is categorical — every `review` subcommand
//   naming a corrupt session reports the corruption and exits 1 — and an
//   unreadable session has no item list to resolve an id against.
// - Single-casing probes (`status Foo` against only `foo` on disk; `status
//   NAME` against only `NAME.JSON`) stage exactly one casing, so the
//   Windows-leg rerun (E-6; implemented by CI-01 in test/windows/) meets a
//   case-insensitive filesystem with the discriminating state intact.
// - T10.1-5's gate probes (SPEC 13.3): "report exactly the gate's findings"
//   is exit 1 with stdout the single form-exact 12.7 findings report holding
//   exactly the staged validation finding — for `review list`, that same
//   one-member decode realizes "the gate's report replaces the per-session
//   report whole" (SPEC 10.7): a document carrying session rows fails it.
//   The `show`/`resolve`/`split` probes pass an item ID no session ever
//   held: an item ID is judged only against its session's content (SPEC
//   12.0), which no gated command reads on a failing workspace (13.3), so
//   the probes must gate identically whatever the ID.
//
// T10.1-4 staging is blackbox (H-3): every shape-dependent corrupt fixture
// starts from a session file the product itself wrote and is corrupted
// through the adapter layer's shape-aware, value-blind transformations
// (helpers/adapters/session-staging.ts); only shape-independent states —
// unparseable bytes, truncation, a directory or symlink at the path — are
// staged directly. The harness never writes a session file from an assumed
// layout. A missing 10.2 field is staged twice — an item's `status`, and
// separately its `kind`, fields every item carries (SPEC 10.2) — never
// `note`, which is optional, or `origin`, carried when applicable. The
// malformed-creation-parameters state uses a `coverage` session:
// it records the profile's resolved definition, where an `audit` session
// records none (SPEC 10.7), so there is a recorded value to garble. The
// malformed-recorded-decompositions state first has the product perform a
// `split` — the decomposition is recorded durably in the session (SPEC 10.7)
// — so the garbled member holds a genuine product-recorded decomposition.
// The decomposed-item state (an item whose kind and scope node are recorded
// as decomposed, SPEC 10.1) is a path-blocks session's file as the product
// wrote it after a `split`, with the original item's entry, copied from the
// pre-`split` file the product wrote, re-inserted: in a baseline session
// the original's `blockedBy` is empty (10.5, 10.7), its `id` is retired and
// so unique, and no item names it or shares its kind and scope node — each
// premise read from the product's exports — so the state violates that one
// invariant alone. It is the one baseline session among the states: its
// workspace is a git repository holding the baseline commit, and the
// modifies-nothing compares cover `.git/` with the rest of the root. The
// states are one exported table, `T10_1_4_CORRUPT_STATES`, each entry
// staging its state on a fresh workspace of its own: T10.1-4 runs its
// contract on each, and T12.0-10's past-the-gate arm (section-12.0-ii.ts)
// stages the same states for `resolve`, `show`, and `split` naming an
// item ID the session never held — every staging returns the item IDs the
// product-written session held, read before the corruption, for that
// arm's premise (SPEC 12.0, 10.7).
//
// T10.1-6 (session-directory and area occupancy; `create`'s ordering):
// - The absent session directory (SPEC 10.1, 13.4, 14.25): a freshly built
//   valid workspace holds no `.xspec/reviews` — `build` brings none into
//   existence, asserted first — and `review list` reports no sessions, exit
//   0, while `status`, `next`, `show`, `export`, `resolve`, and `split`
//   naming `x` (with an item ID where they take one, any serving: 12.0
//   judges the session name against the session directory among the
//   argument checks, an item ID only against its session's content) each
//   exit 2 as an unknown session — a plain usage error, the error
//   document's `code` and `path` `null` (12.0, 12.7), never condition 25's
//   `read-failure`: nonexistence is never a refused read. After each
//   command `.xspec/reviews` is still absent — none brings it into
//   existence, `create`'s write alone does (T10.1-1) — inside one
//   whole-root compare around the sweep (the workspace is fresh, so no
//   refresh of 13.3 legitimately intervenes; H-6 leaves out the lock path
//   `resolve` and `split` acquire).
// - Non-directory occupants are staged at `.xspec/reviews` and at `.xspec`
//   as a plain file and, separately, as a symbolic link to a real directory
//   holding product-written content — the valid session `s.json` and,
//   beside it, a corrupt `c.json`; a journal, graph data, and, under
//   `reviews/`, the valid sessions `s` and `t` beside a corrupt `c.json` —
//   the staging the product must not list, read, or write through (SPEC
//   10.1, 13.4). Each corrupt session is T10.1-4's unparseable state and
//   the journal holds a garbage line appended to the one entry the
//   product's journaled `rename` wrote (T6.1-3's malformed journal), each
//   shape-independent and staged directly (H-4), so a read through the
//   link would surface as 14.21 at the sessions and 14.13 at the journal —
//   never reported, nothing being read below the occupant (13.4). The
//   link's target lives inside the workspace root, outside the area, so
//   one whole-root snapshot compare covers the occupant, the link, and its
//   target at once (H-4: "byte-unchanged", "byte-identical", "nothing
//   written through it"). Symbolic links are never followed by the
//   snapshot (helpers/snapshot.ts), so a product writing through the link
//   changes the target's entries.
// - `create`'s ordering on a stale twin (SPEC 10.7, 13.5: `create` examines
//   the session directory past the gate and before any write, the refresh
//   of 13.3 included, and the outcome it meets there ends it, modifying
//   nothing — stale graph data stays stale): one whole-root compare around
//   the refused `create` admits no change at all, H-6 leaving out the lock
//   path alone (acquisition's and release's writes there counting as no
//   modification). T13.3-2's operational path set is compared with the
//   rest — graph-data bytes only against the product's own bytes of a
//   moment before, never pinned (H-4) — and a change there is diagnosed as
//   the refresh a product makes before it examines the session directory
//   (`isGraphDataKey`, the record-staging adapter layer's one predicate).
//   `check` afterwards braces the compare the way SPEC.md defines
//   staleness (13.3, 14.10): graph data still stale, so the graph-data unit
//   form is reported — exactly one condition-10 finding concerning
//   `.xspec`, locations [] — beside the edited source's per-file staleness:
//   every other 14.10 finding concerns a derived path of `specs/A.mdx` —
//   `specs/A.xspec.` plus a suffix, the module and its companions (SPEC
//   13.1) — and the module itself is among them, since it embeds the edited
//   text (SPEC 4.2). Each finding, the unit form included, instructs
//   rebuilding — its message names `build` (SPEC 14.10): a text edit leaves
//   no recorded file obstructing a path the rebuild writes.
// - `review status s` against the occupied session directory is an unknown
//   session — a plain usage error, so the exit-2 error document's `code` and
//   `path` are `null` (SPEC 12.0, 12.7).
// - The condition-21 finding reported in the existing-name refusal's place
//   is asserted by identity, count, empty locations, and its concerned
//   path, which is pinned — a session condition carries the file it
//   concerns (SPEC 14, 12.7), the session's own file
//   `.xspec/reviews/s.json` (10.1). The code-less existing-name refusal
//   itself is asserted in T10.7-14's finding form through the shared check
//   (support.ts `expectReviewRefusal`): exactly one finding, `code` and
//   `path` `null` — 14 gives a review-operation refusal neither location
//   nor concerned path (SPEC 14, 12.7) — `locations` `[]`, `identities`
//   informational and unasserted, and the existing session's file
//   byte-identical; the stale twin's whole-root compare brackets it.
// - Every mutating command fails at acquisition first on each `.xspec`
//   staging (SPEC 10.1, 13.5, 14.24; T13.5-10(a)): `rename`, file-form
//   `move`, `review create --strategy audit`, and `resolve` and `split`
//   naming the items of the session `s` created while the area was a
//   directory (read by `review status s --json` before it is occupied; the
//   plain-file staging creates `s` too, its occupant replacing the area
//   whole), each an operation valid on the staging as it stood before, so
//   the refusal is the occupied area's alone. Each runs under `--json`:
//   exit 2, the error document's `code` `"write-failure"`, `path`
//   `".xspec"`, `locations` `[]`, and a whole-root compare bracketing that
//   run alone (H-6 leaves out `.xspec/lock`, which no snapshot meets while
//   `.xspec` is a plain file or a link: the walk never follows a link, and
//   the link's target `elsewhere-area` is compared whole).
// - On each `.xspec` staging, nothing is read below the occupant (SPEC
//   13.4): `inventory`'s `journal` member is exactly `{"path":
//   ".xspec/journal", "occupied": false}` (11.6, 12.7), and the journal is
//   empty (6.1). Each staging's workspace is a git repository whose commit
//   `c1`, made first — before its `build` — holds the configuration and
//   `specs/A.mdx` alone, no journal (its tree checked on the harness as a
//   staging step), so `impact --base c1` resolves the baseline first, its
//   journal and the current one both empty (6.3: a given baseline's
//   resolution reads the current journal before any other cause can fail
//   it), and the gate then reports exactly the condition-22 finding
//   concerning `.xspec`, exit 1 (13.3) — never `journal-error`'s exit 2,
//   which a product reading the journal through the link meets at its
//   garbage line. The sweep's whole-root compare covers `.git/` with the
//   rest of the root.
//
// Sources staged after a body's first product invocation — the stale arm's
// and stale twins' edited `specs/A.mdx` (T10.1-1, T10.1-6), the
// decomposed-item state's `specs/A.mdx` with `a`'s own text edited since
// the baseline (T10.1-4, and T12.0-10 through T10.1-4's states), and
// T10.1-5's invalidating `specs/B.mdx` — are
// staged-source records
// (helpers/staged-mdx.ts, S-9: judged before any product exists); the other
// stagings here are session files, journal lines, and occupants, which S-9
// does not judge, and initial workspace files.

import * as fsp from "node:fs/promises";
import type {
  ExportReport,
  Finding,
  SessionStatusRow,
} from "../../helpers/adapters/index.js";
import {
  GRAPH_DATA_AREA_PATH,
  assertReportMentions,
  decodeExportReport,
  decodeFindingsReport,
  decodeIdsReport,
  decodeInventoryDocument,
  decodeSessionListReport,
  decodeSessionStatusReport,
  decodeViewReport,
  isGraphDataKey,
  stageBlockedByAbsentItem,
  stageBlockedByCycle,
  stageDeleteItemKind,
  stageDeleteItemStatus,
  stageDuplicateItemEntry,
  stageGarbleCreationParameters,
  stageGarbleDecompositions,
  stageReinsertItemEntry,
  stageUnknownItemStatus,
} from "../../helpers/adapters/index.js";
import {
  assertBytesEqual,
  assertExitCode,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import {
  assertLeavesUnchanged,
  diffSnapshots,
  snapshotDirectory,
} from "../../helpers/snapshot.js";
import { stagedMdx } from "../../helpers/staged-mdx.js";
import { stagedTs } from "../../helpers/staged-ts.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { InitialFileContents } from "../../helpers/workspace.js";
import {
  assertConditionCounts,
  assertFindingConcernsPath,
  assertFindingInstructsRebuilding,
  assertFindingLocated,
  assertSameJson,
  buildOk,
  expectErrorDocument,
  expectExit,
  expectFindingFreeReport,
  expectReviewRefusal,
  runCli,
  runFindingsReport,
  runJson,
} from "./support.js";
import { WRITE_FAILURE_CODE } from "./write-refusal-staging.js";

// Minimal declarative configuration (SPEC 7): exactly one spec group. Every
// `CORE_FILES` workspace stages it, and T10.1-1's determinism twins, T10.1-4's
// per-state workspaces (T12.0-10's past-the-gate arm stages the same
// states), T10.1-6's occupancy twins, and T13.4-13's arm workspaces and
// FIFO-free twin (section-13.4-ii.ts, which stages `CORE_FILES`) follow
// their bodies' first invocations, so it is one TypeScript staged-source
// record (helpers/staged-ts.ts; S-9's TypeScript and timing clauses),
// well-formed, staged wherever this configuration is (T10.1-5's workspace
// too).
const SPECS_ONLY_CONFIG = stagedTs(
  "T10.1-1/T10.1-4/T10.1-6/T12.0-10/T13.4-13 xspec.config.ts — one spec group",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
);

// The same spec group plus one coverage profile (SPEC 7.4) for the
// coverage-session arm of T10.1-4 (and T12.0-10's, which stages T10.1-4's
// states): `main`'s one leaf has no incoming
// dependency edge, so the profile leaves it uncovered and `create --coverage`
// derives at least one item while recording the profile definition. That
// workspace follows the body's first invocations, so the configuration is a
// TypeScript staged-source record (helpers/staged-ts.ts; S-9's TypeScript and
// timing clauses), well-formed.
const COVERAGE_CONFIG = stagedTs(
  "T10.1-4/T12.0-10 xspec.config.ts — one spec group and the coverage profile p",
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

const A_MDX = [
  '<S id="a">',
  "Alpha text.",
  '<S id="a.k">',
  "Kid text.",
  "</S>",
  "</S>",
  "",
].join("\n");

// The staleness edit for T10.1-1's stale arm and T10.1-6's stale twins: same
// structure, different leaf text — the graph data written by the earlier
// `build` no longer matches the sources. Every staging of it follows the
// body's `build`, so it is one staged-source record shared by both tests
// (helpers/staged-mdx.ts; S-9's before-any-product clause) — the same
// expression, moved into the record.
const A_MDX_EDITED = stagedMdx(
  "T10.1-1/T10.1-6 specs/A.mdx with a.k's text edited (the staleness edit)",
  A_MDX.replace("Kid text.", "Kid text, edited."),
);

// T10.1-4's decomposed-item state (staged by T12.0-10's past-the-gate arm
// too): `a`'s own text edited since the baseline
// commit, `a.k` untouched, so `a` is `changed` (its ownHash, SPEC 5.6) and
// the one visited node of the path-blocks session (10.5) — its
// subtree-coherence item has a child for `split` to decompose (10.7). The
// edit follows the body's first invocations, so it is a staged-source
// record (helpers/staged-mdx.ts; S-9's before-any-product clause).
const A_MDX_OWN_TEXT_EDITED = stagedMdx(
  "T10.1-4/T12.0-10 specs/A.mdx with a's own text edited (the decomposed-item state's change since the baseline)",
  A_MDX.replace("Alpha text.", "Alpha text, edited."),
);

// The initial `specs/A.mdx` of every `CORE_FILES` / `COVERAGE_FILES`
// workspace and of T10.1-5's: one staged-source record made from `A_MDX`
// (the string stays for the staleness edit above), named with every
// staging test — T10.1-1's determinism twins, T10.1-4's per-state
// workspaces (T12.0-10's past-the-gate arm stages the same states),
// T10.1-6's occupancy twins, and T13.4-13's arm workspaces and FIFO-free
// twin follow their bodies' first invocations (helpers/staged-mdx.ts; S-9's
// before-any-product clause).
const A_MDX_STAGED = stagedMdx(
  "T10.1-1/T10.1-2/T10.1-3/T10.1-4/T10.1-5/T10.1-6/T12.0-10/T13.4-13 specs/A.mdx",
  A_MDX,
);

/**
 * The workspace most §10.1 bodies stage: the one-group configuration and
 * `specs/A.mdx` holding `a` with its child `a.k`. Exported for T13.4-13
 * (section-13.4-ii.ts), whose arms stage it so that its (d) runs T10.1-6's
 * plain-file arms' commands on the workspace shape they were written for.
 */
export const CORE_FILES: Readonly<Record<string, InitialFileContents>> = {
  "xspec.config.ts": SPECS_ONLY_CONFIG,
  "specs/A.mdx": A_MDX_STAGED,
};

const COVERAGE_FILES: Readonly<Record<string, InitialFileContents>> = {
  "xspec.config.ts": COVERAGE_CONFIG,
  "specs/A.mdx": A_MDX_STAGED,
};

const REVIEWS_DIR = ".xspec/reviews";

/** The session file's workspace-relative path (SPEC 10.1). */
function sessionRel(name: string): string {
  return `${REVIEWS_DIR}/${name}.json`;
}

/** Stage a fresh workspace, run `body`, dispose (H-1). */
async function withWorkspace<T>(
  files: Readonly<Record<string, InitialFileContents>>,
  body: (workspace: TestWorkspace) => Promise<T>,
): Promise<T> {
  const workspace = await TestWorkspace.create({ files });
  try {
    return await body(workspace);
  } finally {
    await workspace.dispose();
  }
}

/**
 * Read a session file's exact bytes, failing diagnosed (H-8) when the path
 * does not hold a plain file (SPEC 10.1, 13.4: a session is a plain file).
 */
async function readSessionBytes(
  workspace: TestWorkspace,
  name: string,
  context: string,
): Promise<Uint8Array> {
  const rel = sessionRel(name);
  const kind = await workspace.kind(rel);
  if (kind !== "file") {
    fail(
      `${context}: expected the session as a plain file at ${rel} ` +
        `(SPEC 10.1, 13.4); found ${kind}`,
    );
  }
  return await workspace.readBytes(rel);
}

/**
 * Assert the session file is plain and parseable as exactly one JSON document
 * (SPEC 10.1) — the whole file is one `JSON.parse` input, so concatenated
 * documents or trailing garbage fail.
 */
async function assertSessionIsOneJsonDocument(
  workspace: TestWorkspace,
  name: string,
  context: string,
): Promise<void> {
  const bytes = await readSessionBytes(workspace, name, context);
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail(
      `${context}: the session file at ${sessionRel(name)} is not valid ` +
        `UTF-8, so it is not parseable as a single JSON document (SPEC 10.1)`,
    );
  }
  try {
    JSON.parse(text);
  } catch (error) {
    fail(
      `${context}: the session file at ${sessionRel(name)} must be ` +
        `parseable as a single JSON document (SPEC 10.1): ` +
        `${(error as Error).message}`,
    );
  }
}

// ---------------------------------------------------------------------------
// T10.1-1 — storage
// ---------------------------------------------------------------------------

const T10_1_1 = defineProductTest({
  id: "T10.1-1",
  title:
    "`review create` on a freshly built workspace writes exactly `.xspec/reviews/<name>.json` and nothing else (whole-workspace byte-state diff); on a stale workspace it additionally performs the 13.3 graph-data refresh — writes confined to `.xspec/` outside `.xspec/reviews/`, no TypeScript or Markdown regenerated; the file is plain, parseable as one JSON document, and deterministic across two identical fixtures (SPEC 10.1, 13.3, 13.4)",
  run: async (product) => {
    await withWorkspace(CORE_FILES, async (workspace) => {
      await buildOk(product, workspace, "T10.1-1 `build`");

      // Fresh arm: the diff around `create` holds the session file and, at
      // most, its parent directory entries — nothing else (SPEC 10.1; the
      // workspace is freshly built, so no 13.3 refresh applies).
      const sessionKey = sessionRel("r1");
      const preFresh = await snapshotDirectory(workspace.root);
      await expectExit(
        product,
        workspace,
        ["review", "create", "--strategy", "audit", "--name", "r1"],
        0,
        "T10.1-1 `review create --strategy audit --name r1` on the freshly built workspace",
      );
      const postFresh = await snapshotDirectory(workspace.root);
      const freshChanges = diffSnapshots(preFresh, postFresh);
      const allowedAdditions = new Set([".xspec", REVIEWS_DIR, sessionKey]);
      for (const change of freshChanges) {
        if (change.change !== "added" || !allowedAdditions.has(change.key)) {
          fail(
            `T10.1-1: on a freshly built workspace \`review create\` writes ` +
              `exactly ${sessionKey} and nothing else — its parent directory ` +
              `entries are the only tolerated additions (SPEC 10.1; H-4 ` +
              `byte-state diff); found ${change.change} ${change.path}: ` +
              change.detail,
          );
        }
      }
      if (!freshChanges.some((change) => change.key === sessionKey)) {
        fail(
          `T10.1-1: \`review create --name r1\` exited 0 but created no ` +
            `entry at ${sessionKey} (SPEC 10.1: a session is stored at ` +
            `.xspec/reviews/<session-name>.json)`,
        );
      }
      await assertSessionIsOneJsonDocument(
        workspace,
        "r1",
        "T10.1-1 the created session file",
      );

      // Stale arm: edit a source so the graph data no longer matches, then
      // create again. The additional writes are the 13.3 graph-data refresh —
      // confined to `.xspec/` outside `.xspec/reviews/` (graph-data content
      // is opaque, H-4): no TypeScript or Markdown is generated or removed
      // (everything outside `.xspec/` stays byte-identical) and the existing
      // session r1 is untouched.
      await workspace.file("specs/A.mdx", A_MDX_EDITED);
      const session2Key = sessionRel("r2");
      const preStale = await snapshotDirectory(workspace.root);
      await expectExit(
        product,
        workspace,
        ["review", "create", "--strategy", "audit", "--name", "r2"],
        0,
        "T10.1-1 `review create --strategy audit --name r2` on the stale workspace",
      );
      const postStale = await snapshotDirectory(workspace.root);
      const staleChanges = diffSnapshots(preStale, postStale);
      let session2Added = false;
      for (const change of staleChanges) {
        if (change.key === session2Key) {
          if (change.change !== "added") {
            fail(
              `T10.1-1 stale arm: expected ${session2Key} to be added, ` +
                `found ${change.change}: ${change.detail}`,
            );
          }
          session2Added = true;
          continue;
        }
        const underXspec =
          change.key === ".xspec" || change.key.startsWith(".xspec/");
        const underReviews =
          change.key === REVIEWS_DIR ||
          change.key.startsWith(`${REVIEWS_DIR}/`);
        if (!underXspec || underReviews) {
          fail(
            `T10.1-1 stale arm: \`review create\` on a stale workspace ` +
              `writes the session file plus the 13.3 graph-data refresh — ` +
              `refresh writes are confined to .xspec/ outside ` +
              `.xspec/reviews/: no TypeScript or Markdown is generated or ` +
              `removed and no other session is touched (SPEC 10.1, 13.3); ` +
              `found ${change.change} ${change.path}: ${change.detail}`,
          );
        }
      }
      if (!session2Added) {
        fail(
          `T10.1-1 stale arm: \`review create --name r2\` exited 0 but ` +
            `created no entry at ${session2Key} (SPEC 10.1)`,
        );
      }
      await assertSessionIsOneJsonDocument(
        workspace,
        "r2",
        "T10.1-1 the second session file (stale-workspace arm)",
      );
    });

    // Determinism arm (H-6, two-directory form): two identical fixtures,
    // identically built and created — the session files are byte-identical
    // (SPEC 10.1 "plain, deterministic"; 12.0: no wall clock, no randomness,
    // no absolute paths in stored data).
    const first = await TestWorkspace.create({ files: CORE_FILES });
    const second = await TestWorkspace.create({ files: CORE_FILES });
    try {
      const directories: readonly (readonly [string, TestWorkspace])[] = [
        ["directory 1", first],
        ["directory 2", second],
      ];
      for (const [label, workspace] of directories) {
        await buildOk(
          product,
          workspace,
          `T10.1-1 determinism arm \`build\` in ${label}`,
        );
        await expectExit(
          product,
          workspace,
          ["review", "create", "--strategy", "audit", "--name", "r1"],
          0,
          `T10.1-1 determinism arm \`review create --strategy audit --name r1\` in ${label}`,
        );
      }
      assertBytesEqual(
        await readSessionBytes(
          second,
          "r1",
          "T10.1-1 determinism arm, directory 2",
        ),
        await readSessionBytes(
          first,
          "r1",
          "T10.1-1 determinism arm, directory 1",
        ),
        "T10.1-1: two identical fixtures yield byte-identical session files " +
          "(SPEC 10.1 deterministic; H-6 two-directory protocol — the " +
          "directories differ only in their absolute paths, which never " +
          "enter stored data, SPEC 12.0)",
      );
    } finally {
      await first.dispose();
      await second.dispose();
    }
  },
});

// ---------------------------------------------------------------------------
// T10.1-2 — names
// ---------------------------------------------------------------------------

/**
 * T10.1-2's single-casing session-name probe over an already-built workspace
 * where the name `foo` is free — one shared code path, called by the
 * registered T10.1-2 body on the suite leg and by the Windows-leg wrapper
 * (TEST-SPEC E-6; test/windows/e6-subset.test.ts). Only `foo` ever exists on
 * disk, so the fixture stages identically on any filesystem; on a
 * case-insensitive one it exposes a product matching session names via
 * filesystem lookup (`status Foo` must be exit 2, SPEC 10.1, 12.0).
 */
export async function probeSessionNameCasing(
  product: ProductBinding,
  workspace: TestWorkspace,
): Promise<void> {
  await expectExit(
    product,
    workspace,
    ["review", "create", "--strategy", "audit", "--name", "foo"],
    0,
    "T10.1-2 `review create --strategy audit --name foo`",
  );
  await expectExit(
    product,
    workspace,
    ["review", "status", "foo"],
    0,
    "T10.1-2 control: `review status foo` finds the session under its exact name (SPEC 10.1)",
  );
  const probeContext =
    "T10.1-2 `review status Foo --json` — names are case-sensitive for " +
    "all subcommands, so `Foo` names no session: an unknown session is " +
    "a usage error (SPEC 10.1, 12.0; single-casing probe, rerun on the " +
    "Windows leg per E-6/CI-01)";
  const probe = await expectExit(
    product,
    workspace,
    ["review", "status", "Foo", "--json"],
    2,
    probeContext,
  );
  expectErrorDocument(
    probe,
    `${probeContext} — under --json, the exit-2 error document is the ` +
      `entire stdout (SPEC 12.0, 12.7, H-5)`,
  );
}

/**
 * Self-contained staging of {@link probeSessionNameCasing} for the Windows
 * leg (E-6/CI-01): fresh workspace, `build`, then the shared probe.
 */
export async function runT1012SessionNameCasingProbe(
  product: ProductBinding,
): Promise<void> {
  await withWorkspace(CORE_FILES, async (workspace) => {
    await buildOk(product, workspace, "T10.1-2 casing probe `build`");
    await probeSessionNameCasing(product, workspace);
  });
}

const T10_1_2 = defineProductTest({
  id: "T10.1-2",
  title:
    'session names: the full `A–Z a–z 0–9 . _ -` alphabet is accepted; `/`, whitespace, empty, leading `.`, and non-ASCII names are usage errors (exit 2, nothing created); names are case-sensitive for every subcommand (`status Foo` does not find `foo` — single-casing probe, rerun on the Windows leg via CI-01) while `create` refuses a name matching an existing session ignoring ASCII case (exit 1 with exactly one code-less finding in T10.7-14\'s form — standard output exactly `{"findings": [f]}`, `code` and `path` `null`, `locations` `[]` — nothing created) (SPEC 10.1, 10.7, 12.0, 12.7, 14)',
  run: async (product) => {
    await withWorkspace(CORE_FILES, async (workspace) => {
      await buildOk(product, workspace, "T10.1-2 `build`");

      // Invalid names: usage error, exit 2, nothing created (SPEC 10.1,
      // 12.0). Byte-state compare around each attempt realizes "nothing
      // created"; with --json, exit 2 emits no JSON document (H-5).
      const invalidNames: readonly (readonly [string, string])[] = [
        ["a/b", "a path separator"],
        ["a b", "whitespace"],
        ["", "the empty name"],
        [".a", "a leading `.`"],
        ["é", "a non-ASCII character (U+00E9)"],
      ];
      for (const [name, why] of invalidNames) {
        const context = `T10.1-2 \`review create --strategy audit --name ${JSON.stringify(name)} --json\` (invalid name: ${why})`;
        await assertLeavesUnchanged(
          workspace.root,
          async () => {
            const result = await expectExit(
              product,
              workspace,
              [
                "review",
                "create",
                "--strategy",
                "audit",
                "--name",
                name,
                "--json",
              ],
              2,
              `${context} — an invalid session name is a usage error (SPEC 10.1, 12.0)`,
            );
            expectErrorDocument(
              result,
              `${context} — under --json, the exit-2 error document is the ` +
                `entire stdout (SPEC 12.0, 12.7, H-5)`,
            );
          },
          `${context} — nothing created`,
        );
      }

      // Valid names: one name drawing on all four character classes (and
      // interior `.`), one bare digit. Each create succeeds and stores the
      // session at .xspec/reviews/<name>.json as a plain file.
      for (const name of ["Az09._-", "0"]) {
        await expectExit(
          product,
          workspace,
          ["review", "create", "--strategy", "audit", "--name", name],
          0,
          `T10.1-2 \`review create --strategy audit --name ${name}\` (valid name)`,
        );
        const kind = await workspace.kind(sessionRel(name));
        if (kind !== "file") {
          fail(
            `T10.1-2: after \`create --name ${name}\`, expected a plain ` +
              `session file at ${sessionRel(name)} (SPEC 10.1); found ${kind}`,
          );
        }
      }

      // Case rules. Single-casing probe: only `foo` ever exists on disk in
      // this workspace (the refused creates below create nothing), so the
      // Windows-leg rerun (E-6, CI-01) meets a case-insensitive filesystem
      // with exactly one casing present — exposing a product that matches
      // session names via filesystem lookup. Shared code path with that
      // rerun.
      await probeSessionNameCasing(product, workspace);

      // `create` alone folds ASCII case when checking for an existing
      // session: `FOO` matches `foo`, is treated as an existing session, and
      // is refused — exit 1, one code-less finding in T10.7-14's form (a
      // refused operation, SPEC 10.7, 12.0, 12.7, 14), nothing created: no
      // FOO.json appears and `foo`'s file stays byte-identical (the shared
      // check's session-file and whole-root compares).
      await expectReviewRefusal(
        product,
        workspace,
        ["review", "create", "--strategy", "audit", "--name", "FOO"],
        sessionRel("foo"),
        "T10.1-2 [existing `foo`: a name matching it ignoring ASCII case is " +
          "treated as an existing session's and refused, SPEC 10.1, 10.7, " +
          "12.0]",
        { nothingModified: true },
      );
    });
  },
});

// ---------------------------------------------------------------------------
// T10.1-3 — non-session files
// ---------------------------------------------------------------------------

// Deliberately unparseable content for every staged non-session file: a
// product that wrongly treats one as a session would classify it corrupt —
// caught by the list/check assertions below.
const NON_SESSION_GARBAGE = "not a session { this is deliberately not JSON [\n";

// The wrong-case-extension non-session (T10.1-3): staged in exactly this one
// casing — no NAME.json exists anywhere — so the fixture stages identically
// on any filesystem (E-6).
const WRONG_CASE_SESSION_FILE = `${REVIEWS_DIR}/NAME.JSON`;

/**
 * T10.1-3's wrong-case-extension probe over a workspace where
 * {@link WRONG_CASE_SESSION_FILE} is staged — one shared code path, called by
 * the registered T10.1-3 body on the suite leg and by the Windows-leg wrapper
 * (TEST-SPEC E-6; test/windows/e6-subset.test.ts). Only a file named
 * `<valid-name>.json` is a session and paths compare byte-wise (SPEC 10.1,
 * 12.0), so `NAME.JSON` is not one: `status NAME` is exit 2 (unknown session)
 * even where a case-insensitive filesystem lookup would find the file.
 */
export async function probeWrongCaseExtensionSession(
  product: ProductBinding,
  workspace: TestWorkspace,
): Promise<void> {
  const context =
    'T10.1-3 `review status "NAME" --json` — exit 2 unknown session: ' +
    "NAME.JSON is not a session, paths compare byte-wise (SPEC 10.1, 12.0; " +
    "single-casing probe, rerun on the Windows leg per E-6/CI-01)";
  const result = await expectExit(
    product,
    workspace,
    ["review", "status", "NAME", "--json"],
    2,
    context,
  );
  expectErrorDocument(
    result,
    `${context} — under --json, the exit-2 error document is the entire ` +
      `stdout (SPEC 12.0, 12.7, H-5)`,
  );
}

/**
 * Self-contained staging of {@link probeWrongCaseExtensionSession} for the
 * Windows leg (E-6/CI-01): fresh workspace, `build`, a real session as the
 * served-session control, the staged `NAME.JSON` stray, then the shared
 * probe.
 */
export async function runT1013WrongCaseExtensionProbe(
  product: ProductBinding,
): Promise<void> {
  await withWorkspace(CORE_FILES, async (workspace) => {
    await buildOk(product, workspace, "T10.1-3 wrong-case probe `build`");
    await expectExit(
      product,
      workspace,
      ["review", "create", "--strategy", "audit", "--name", "real"],
      0,
      "T10.1-3 wrong-case probe `review create --strategy audit --name real`",
    );
    await workspace.file(WRONG_CASE_SESSION_FILE, NON_SESSION_GARBAGE);
    await expectExit(
      product,
      workspace,
      ["review", "status", "real"],
      0,
      "T10.1-3 wrong-case probe control: `review status real` — sessions " +
        "resolve with the stray present, so the probe's exit 2 below is " +
        "attributable to the extension's casing alone (SPEC 10.1)",
    );
    await probeWrongCaseExtensionSession(product, workspace);
  });
}

const T10_1_3 = defineProductTest({
  id: "T10.1-3",
  title:
    'non-session files under `.xspec/reviews/` — a stray `notes.txt`, a subdirectory (with a nested .json), invalid-stem `.foo.json` and `a b.json`, and wrong-case `NAME.JSON` — are ignored by `list` (neither sessions nor corrupt, exit 0), `check` (no 14.21), and every subcommand; naming them finds no session: `status .foo`/`status "a b"` exit 2 invalid name, `status NAME` exit 2 unknown session (single-casing probe, rerun on the Windows leg via CI-01) (SPEC 10.1, 12.0, 14.21)',
  run: async (product) => {
    await withWorkspace(CORE_FILES, async (workspace) => {
      await buildOk(product, workspace, "T10.1-3 `build`");
      await expectExit(
        product,
        workspace,
        ["review", "create", "--strategy", "audit", "--name", "real"],
        0,
        "T10.1-3 `review create --strategy audit --name real`",
      );

      // Stage the non-session entries beside the real session. NAME.JSON is
      // staged in a single casing — no NAME.json exists anywhere (E-6).
      await workspace.file(`${REVIEWS_DIR}/notes.txt`, NON_SESSION_GARBAGE);
      await workspace.dir(`${REVIEWS_DIR}/sub`);
      await workspace.file(
        `${REVIEWS_DIR}/sub/inner.json`,
        NON_SESSION_GARBAGE,
      );
      await workspace.file(`${REVIEWS_DIR}/.foo.json`, NON_SESSION_GARBAGE);
      await workspace.file(`${REVIEWS_DIR}/a b.json`, NON_SESSION_GARBAGE);
      await workspace.file(WRONG_CASE_SESSION_FILE, NON_SESSION_GARBAGE);

      // `list`: exactly the one real session — the strays are reported
      // neither as sessions nor as corrupt — and exit 0, since exit 1 is
      // reserved for an existing corrupt session (SPEC 10.1, 10.7).
      const listLabel = "T10.1-3 `review list --json`";
      const listResult = await expectExit(
        product,
        workspace,
        ["review", "list", "--json"],
        0,
        `${listLabel} — no session is corrupt (non-session files are ignored), so \`list\` exits 0 (SPEC 10.1, 10.7)`,
      );
      const list = decodeSessionListReport(
        parseJsonStdout(listResult, listLabel),
        listLabel,
      );
      assertSameJson(
        list.sessions.map(({ name, corrupt }) => ({ name, corrupt })),
        [{ name: "real", corrupt: false }],
        `${listLabel}: exactly the one real session — the stray file, ` +
          `subdirectory, nested .json, invalid-stem .json files, and ` +
          `wrong-case NAME.JSON are neither sessions nor corrupt (SPEC 10.1)`,
      );

      // `check`: no 14.21 — the workspace is freshly built and otherwise
      // clean, so with every stray correctly ignored `check` has no finding
      // at all and exits 0 (SPEC 10.1, 12.2, 14.21).
      await expectExit(
        product,
        workspace,
        ["check", "--json"],
        0,
        "T10.1-3 `check --json` — non-session files under .xspec/reviews/ " +
          "are no 14.21 finding (SPEC 10.1, 14.21); the workspace is " +
          "otherwise clean, so `check` exits 0",
      );

      // Naming the non-sessions finds no session (SPEC 10.1, 12.0): invalid
      // names are usage errors before any lookup; `NAME` is a valid name but
      // names no session, since NAME.JSON's extension differs byte-wise —
      // that arm is the shared single-casing probe rerun on the Windows leg
      // (E-6/CI-01).
      const namingProbes: readonly (readonly [string, string])[] = [
        [".foo", "exit 2 invalid session name (leading `.`)"],
        ["a b", "exit 2 invalid session name (whitespace)"],
      ];
      for (const [name, why] of namingProbes) {
        const context = `T10.1-3 \`review status ${JSON.stringify(name)} --json\` — ${why}`;
        const result = await expectExit(
          product,
          workspace,
          ["review", "status", name, "--json"],
          2,
          context,
        );
        expectErrorDocument(
          result,
          `${context} — under --json, the exit-2 error document is the ` +
            `entire stdout (SPEC 12.0, 12.7, H-5)`,
        );
      }
      await probeWrongCaseExtensionSession(product, workspace);

      // Ignored by every subcommand: the real session is served unaffected,
      // and a session named after the stray's stem is creatable — notes.txt
      // is not a session, so the name `notes` is free (SPEC 10.1).
      await expectExit(
        product,
        workspace,
        ["review", "status", "real"],
        0,
        "T10.1-3 `review status real` — the real session is served unaffected by the strays",
      );
      await expectExit(
        product,
        workspace,
        ["review", "export", "real"],
        0,
        "T10.1-3 `review export real` — unaffected by the strays",
      );
      await expectExit(
        product,
        workspace,
        ["review", "create", "--strategy", "audit", "--name", "notes"],
        0,
        "T10.1-3 `review create --strategy audit --name notes` — " +
          "notes.txt is not a session, so the name is free (SPEC 10.1)",
      );
      const list2Label = "T10.1-3 `review list --json` after creating `notes`";
      const list2Result = await expectExit(
        product,
        workspace,
        ["review", "list", "--json"],
        0,
        list2Label,
      );
      const list2 = decodeSessionListReport(
        parseJsonStdout(list2Result, list2Label),
        list2Label,
      );
      assertSameJson(
        list2.sessions.map(({ name, corrupt }) => ({ name, corrupt })),
        [
          { name: "notes", corrupt: false },
          { name: "real", corrupt: false },
        ],
        `${list2Label}: both real sessions in byte order of name, strays still ignored (SPEC 10.1, 10.7)`,
      );
    });
  },
});

// ---------------------------------------------------------------------------
// T10.1-4 — corruption
// ---------------------------------------------------------------------------

// Item id passed to `show`/`resolve`/`split` for the occupant states, whose
// session cannot be read at all: 10.1's contract is categorical (corruption
// is reported whatever item the arguments name), so any plausible id serves.
const PLACEHOLDER_ITEM_ID = "item-1";

/** The corrupt session's name in every T10.1-4 staging. */
const CORRUPT_NAME = "cor";

/**
 * Decode `review status <cor> --json` and require at least one item — the
 * pre-corruption read of a product-written session.
 */
async function readSessionItems(
  product: ProductBinding,
  workspace: TestWorkspace,
  label: string,
): Promise<readonly SessionStatusRow[]> {
  const status = decodeSessionStatusReport(
    await runJson(
      product,
      workspace,
      ["review", "status", CORRUPT_NAME, "--json"],
      label,
    ),
    label,
  );
  if (status.items.length === 0) {
    fail(
      `${label}: staging premise — the session must hold at least one item ` +
        `for the corruption transformations and the item-naming subcommands ` +
        `(SPEC 10.5–10.7); got none`,
    );
  }
  return status.items;
}

/**
 * Decode `review export <cor> --json` (SPEC 10.7: every item with every
 * field of 10.2) — a staging-premise read of a product-written session.
 */
async function exportCorruptNamedSession(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
): Promise<ExportReport> {
  const argv = ["review", "export", CORRUPT_NAME, "--json"];
  const label = `${context} \`${argv.join(" ")}\``;
  return decodeExportReport(
    await runJson(product, workspace, argv, label),
    label,
  );
}

/** The distinct ids of the given items, in first-seen order. */
function distinctItemIds(
  items: readonly { readonly id: string }[],
): readonly string[] {
  return [...new Set(items.map((item) => item.id))];
}

/**
 * Build, create the session via the given argv, and capture its items from
 * `status --json` before the file is corrupted (at least one).
 */
async function stageProductSession(
  product: ProductBinding,
  workspace: TestWorkspace,
  createArgv: readonly string[],
  context: string,
): Promise<readonly SessionStatusRow[]> {
  await buildOk(product, workspace, `${context} \`build\``);
  await expectExit(
    product,
    workspace,
    createArgv,
    0,
    `${context} \`${createArgv.join(" ")}\``,
  );
  return await readSessionItems(
    product,
    workspace,
    `${context} \`review status ${CORRUPT_NAME} --json\` (pre-corruption item-id capture)`,
  );
}

/**
 * T10.1-4's decomposed-item state — an item whose kind and scope node are
 * recorded as decomposed (SPEC 10.1) — staged in a fresh `CORE_FILES`
 * workspace: a path-blocks session (10.5) in a git repository, where `a`'s
 * own text edited since the baseline commit makes `a` the one visited
 * node, so the session holds `a`'s subtree-coherence item, its `blockedBy`
 * empty (a baseline session's subtree-coherence item carries no blockers,
 * 10.5, 10.7). `split` replaces it by a.k's subtree-coherence item and
 * `a`'s parent-consistency item, records the decomposition durably, and
 * retires the original's `id` (10.7). The original's entry, copied from
 * the pre-`split` file the product wrote, is then re-inserted into the
 * post-`split` file through the adapter layer (H-3): a state violating
 * 10.1's decomposed-item invariant alone — the original's `id` unique,
 * being retired; its `blockedBy` empty; no item naming it or sharing its
 * kind and scope node — each premise read from the product's own exports
 * before the re-insertion. Returns an item id the post-`split` session
 * holds, for the item-naming subcommands, and every item id the two
 * exports showed the session holding, the retired original's included.
 */
async function stageDecomposedItemState(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
): Promise<{
  readonly itemId: string;
  readonly heldItemIds: readonly string[];
}> {
  await workspace.gitInit();
  const base = await workspace.gitCommitAll("baseline");
  await workspace.file("specs/A.mdx", A_MDX_OWN_TEXT_EDITED);
  await buildOk(product, workspace, `${context} \`build\``);
  await expectExit(
    product,
    workspace,
    ["review", "create", "--base", base, "--name", CORRUPT_NAME],
    0,
    `${context} \`review create --base <baseline> --name ${CORRUPT_NAME}\``,
  );
  const preSplit = await exportCorruptNamedSession(
    product,
    workspace,
    `${context} (pre-split premise read)`,
  );
  // The split target: `a`'s subtree-coherence item — `a` has the child
  // `a.k`, so the split is not refused (SPEC 10.7).
  const splitScope = "specs/A.mdx#a";
  const original = preSplit.items.find(
    (item) =>
      item.kind === "subtree-coherence" && item.scope.node === splitScope,
  );
  if (original === undefined) {
    fail(
      `${context}: staging premise — \`a\`'s own text changed since the ` +
        `baseline, so \`a\` is a visited node of the path-blocks session ` +
        `and its subtree-coherence item, scoped at ${splitScope}, exists ` +
        `(SPEC 5.6, 10.5); items (kind, scope): ` +
        JSON.stringify(
          preSplit.items.map((item) => [item.kind, item.scope.node]),
        ),
    );
  }
  if (original.blockedBy.length !== 0) {
    fail(
      `${context}: staging premise — a baseline session's ` +
        `subtree-coherence item carries no blockers (SPEC 10.5, 10.7), ` +
        `so the re-inserted original names no item; ${original.id}'s ` +
        `blockedBy is ${JSON.stringify(original.blockedBy)}`,
    );
  }
  const earlier = await readSessionBytes(
    workspace,
    CORRUPT_NAME,
    `${context} the pre-split session file the product wrote`,
  );
  await expectExit(
    product,
    workspace,
    ["review", "split", CORRUPT_NAME, original.id],
    0,
    `${context} \`review split ${CORRUPT_NAME} ${original.id}\` — the ` +
      `product-performed split removes the original, retires its id, ` +
      `and records the decomposition durably (SPEC 10.7)`,
  );
  const postSplit = await exportCorruptNamedSession(
    product,
    workspace,
    `${context} (post-split premise read)`,
  );
  if (postSplit.items.length === 0) {
    fail(
      `${context}: staging premise — the decomposition's items stand in ` +
        `the original's place (SPEC 10.7), so the post-split session ` +
        `holds items for the item-naming subcommands; got none`,
    );
  }
  for (const item of postSplit.items) {
    const which = `${context}: staging premise — post-split item ${item.id} (${item.kind} ${item.scope.node})`;
    if (item.id === original.id) {
      fail(
        `${which}: the original is removed from the session and its id ` +
          `never reused (SPEC 10.7), so the re-inserted id is unique`,
      );
    }
    if (item.kind === original.kind && item.scope.node === splitScope) {
      fail(
        `${which}: the decomposed kind and scope node are never added ` +
          `back (SPEC 10.5, 10.7), so no item shares the re-inserted ` +
          `original's`,
      );
    }
    if (item.blockedBy.includes(original.id)) {
      fail(
        `${which}: every item the original blocked is blocked by the ` +
          `decomposition's items instead (SPEC 10.7), so no item names ` +
          `the re-inserted original; its blockedBy is ` +
          JSON.stringify(item.blockedBy),
      );
    }
  }
  await stageReinsertItemEntry(
    workspace.path(sessionRel(CORRUPT_NAME)),
    earlier,
    original.id,
  );
  return {
    itemId: postSplit.items[0].id,
    heldItemIds: distinctItemIds([...preSplit.items, ...postSplit.items]),
  };
}

/** What `review list` must report for a staged corrupt state. */
export interface ExpectedSessionEntry {
  readonly name: string;
  readonly corrupt: boolean;
}

/** Condition 21's stable code (SPEC 14: 21 `corrupt-session`; 12.7). */
const CORRUPT_SESSION_CODE = "corrupt-session";

/**
 * A decoded corruption report's findings (T10.1-4; TEST-SPEC line 9's rule
 * for an error report) — a naming subcommand's report, the listing's
 * `"findings"` member, or `check`'s condition-21 findings: at least one
 * finding, and every one condition 21 — its exact stable code
 * `corrupt-session` (SPEC 14; the derived condition 14.21) — concerning
 * the corrupt session's own file `.xspec/reviews/<name>.json` as its 12.7
 * `path` (for a symbolic link occupying it, the link's own path, never its
 * target's: an occupant is judged, never read through; SPEC 10.1, 13.4),
 * with no in-source location (`locations` []; SPEC 14, 12.7). At least
 * one, not exactly one: see the module header. `label` names the state and
 * the argv; each diagnosis adds the offending finding's code, path, and
 * message.
 */
function assertCorruptSessionReport(
  findings: readonly Finding[],
  label: string,
): void {
  if (findings.length === 0) {
    fail(
      `${label}: the report must hold the corruption — at least one ` +
        `finding, condition 21 \`${CORRUPT_SESSION_CODE}\` (SPEC 10.1, ` +
        `14.21, 12.7); got no findings`,
    );
  }
  const concernedPath = sessionRel(CORRUPT_NAME);
  for (const [index, finding] of findings.entries()) {
    const which =
      `${label}: finding ${String(index + 1)} of ` +
      `${String(findings.length)} (code ${JSON.stringify(finding.code)}, ` +
      `path ${JSON.stringify(finding.path)}, message ` +
      `${JSON.stringify(finding.message)})`;
    if (finding.code !== CORRUPT_SESSION_CODE) {
      fail(
        `${which}: every finding of a corrupt session's report is ` +
          `condition 21, carrying its exact stable code ` +
          `${JSON.stringify(CORRUPT_SESSION_CODE)} (TEST-SPEC line 9: the ` +
          `exact code string; SPEC 14, 14.21, 12.7)`,
      );
    }
    if (finding.path !== concernedPath) {
      fail(
        `${which}: a session condition carries the session file it ` +
          `concerns as its 12.7 path — the corrupt session's own path ` +
          `${JSON.stringify(concernedPath)}, a symbolic link there by its ` +
          `own path, never its target's (SPEC 14, 12.7, 10.1, 13.4)`,
      );
    }
    if (finding.locations.length !== 0) {
      fail(
        `${which}: a session condition has no in-source location — ` +
          `locations [] (SPEC 14, 12.7, 10.1); got ` +
          JSON.stringify(finding.locations),
      );
    }
  }
}

/**
 * The full T10.1-4 contract for one staged corrupt state: every `review`
 * subcommand naming the session reports the corruption, exits 1, and
 * modifies nothing — one whole-workspace snapshot compare around both of
 * its runs, flag-less and with `--json`. The `--json` run's stdout, and
 * `export`'s flag-less stdout (its only output form, SPEC 10.7), is the
 * form-exact findings-only report whose every finding is condition 21
 * concerning the session file (`assertCorruptSessionReport`), `export`'s
 * two documents the same (T12.0-1's JSON-only parity); the other flag-less
 * runs match /corrupt/i (see the module header). `list` reports the
 * session corrupt in place of its fields and exits 1, and the listing's
 * findings — its `"findings"` member, which carries condition 21 (SPEC
 * 14.21, 12.7) — are judged as the naming subcommands' reports are
 * (`assertCorruptSessionReport`: at least one finding, every one condition
 * 21 concerning the session file); `check` reports condition 14.21, every
 * condition-21 finding carrying the same concern information (TEST-SPEC
 * line 9's rule): `locations` [] and, as its 12.7 `path`, the session file
 * `.xspec/reviews/<name>.json` itself — for a symbolic link occupying it,
 * the link's own path, never its target's (SPEC 14, 12.7, 10.1, 13.4).
 * Each failure names the state.
 */
async function assertCorruptSessionContract(
  product: ProductBinding,
  workspace: TestWorkspace,
  state: string,
  itemId: string,
  expectedSessions: readonly ExpectedSessionEntry[],
): Promise<void> {
  const namingSubcommands: readonly (readonly string[])[] = [
    ["review", "status", CORRUPT_NAME],
    ["review", "next", CORRUPT_NAME],
    ["review", "show", CORRUPT_NAME, itemId],
    ["review", "export", CORRUPT_NAME],
    ["review", "resolve", CORRUPT_NAME, itemId, "--status", "updated"],
    ["review", "split", CORRUPT_NAME, itemId],
  ];
  for (const argv of namingSubcommands) {
    const context = `T10.1-4 [${state}] \`${argv.join(" ")}\``;
    const jsonArgv = [...argv, "--json"];
    const jsonContext = `T10.1-4 [${state}] \`${jsonArgv.join(" ")}\``;
    // `review export` is the JSON-only `review` subcommand (SPEC 10.7).
    const jsonOnly = argv[1] === "export";
    await assertLeavesUnchanged(
      workspace.root,
      async () => {
        const result = await runCli(product, workspace, argv);
        assertExitCode(
          result,
          1,
          `${context} — every review subcommand naming a corrupt session ` +
            `reports the corruption and exits 1 (SPEC 10.1, 14.21; ` +
            `findings-class outcome, 12.0)`,
        );
        let flaglessFindings: readonly Finding[] | undefined;
        if (jsonOnly) {
          // `export` emits a single JSON document with or without `--json`
          // (SPEC 10.7; H-5's JSON-only clause): its flag-less report is
          // the same form-exact findings-only document.
          flaglessFindings = decodeFindingsReport(
            parseJsonStdout(
              result,
              `${context} — \`export\`'s only output form is a single ` +
                `JSON document, with or without --json, so its corruption ` +
                `report is the findings-only document as the entire ` +
                `stdout (SPEC 10.7, 12.7, 14.21; H-5)`,
            ),
            context,
          ).findings;
          assertCorruptSessionReport(flaglessFindings, context);
        } else {
          assertReportMentions(
            result,
            [/corrupt/i],
            `${context} — the report identifies the session as corrupt ` +
              `(SPEC 10.1/14.21 vocabulary; findings are standard-output ` +
              `content, 12.0; information presence, never exact wording, ` +
              `H-3)`,
          );
        }
        const jsonFindings = await runFindingsReport(
          product,
          workspace,
          jsonArgv,
          1,
          `${jsonContext} — every review subcommand naming a corrupt ` +
            `session reports the corruption and exits 1, under --json the ` +
            `form-exact findings-only report as the entire stdout (SPEC ` +
            `10.1, 14.21, 12.0, 12.7; H-5)`,
        );
        assertCorruptSessionReport(jsonFindings, jsonContext);
        if (flaglessFindings !== undefined) {
          assertSameJson(
            flaglessFindings,
            jsonFindings,
            `${context} against \`${jsonArgv.join(" ")}\` — the JSON-only ` +
              `surfaces of 10.7, 11, and 12.6 emit the same single ` +
              `document with the flag as without: the two decoded ` +
              `findings arrays carry the same information, array order ` +
              `significant (SPEC 10.7; T12.0-1)`,
          );
        }
      },
      `${context}, then with --json — a review subcommand naming a ` +
        `corrupt session modifies nothing (SPEC 10.1)`,
    );
  }

  const listContext = `T10.1-4 [${state}] \`review list --json\``;
  await assertLeavesUnchanged(
    workspace.root,
    async () => {
      const result = await runCli(product, workspace, [
        "review",
        "list",
        "--json",
      ]);
      assertExitCode(
        result,
        1,
        `${listContext} — \`list\` exits 1 when any corrupt session exists (SPEC 10.7, 14.21)`,
      );
      const report = decodeSessionListReport(
        parseJsonStdout(result, listContext),
        listContext,
      );
      assertSameJson(
        report.sessions.map(({ name, corrupt }) => ({ name, corrupt })),
        expectedSessions,
        `${listContext} — the corrupt session is reported by name as ` +
          `corrupt in place of its fields, sessions in byte order of name ` +
          `(SPEC 10.1, 10.7; the adapter refuses fields on a corrupt entry)`,
      );
      // The listing's findings: `review list` reports condition 21 (SPEC
      // 14.21, exit 1) under the document's "findings" member (12.7), which
      // the decoder requires while a session is listed corrupt — as the
      // staged one now is — so the member is present here. They are judged
      // as the naming subcommands' reports are (TEST-SPEC line 9's rule):
      // at least one finding (a state breaking two invariants may report
      // two, see the module header), every one condition 21 concerning the
      // corrupt session's own file — the link's own path in the
      // symbolic-link state, whose valid `real` reports none — with
      // `locations` [].
      const listFindings = report.findings;
      if (listFindings === undefined) {
        fail(
          `${listContext}: the listing must carry the corrupt session's ` +
            `condition 21 under its "findings" member (SPEC 14.21, 12.7); ` +
            `the decoded document carries no such member`,
        );
      }
      assertCorruptSessionReport(
        listFindings,
        `${listContext} — the listing's findings`,
      );
    },
    `${listContext} — a read leaves the workspace unchanged (SPEC 10.4, 13.5)`,
  );

  const checkContext = `T10.1-4 [${state}] \`check --json\``;
  await assertLeavesUnchanged(
    workspace.root,
    async () => {
      const result = await runCli(product, workspace, ["check", "--json"]);
      assertExitCode(
        result,
        1,
        `${checkContext} — a corrupt review session is a check finding (SPEC 12.2, 14.21)`,
      );
      const findings = decodeFindingsReport(
        parseJsonStdout(result, checkContext),
        checkContext,
      ).findings;
      const corrupt = findings.filter(
        (finding) => finding.condition === "14.21",
      );
      if (corrupt.length === 0) {
        fail(
          `${checkContext}: \`check\` must report the corrupt session with ` +
            `condition 14.21 (SPEC 12.2, 14.21); reported conditions: ` +
            JSON.stringify(findings.map((finding) => finding.condition)),
        );
      }
      // The concern information SPEC 14 requires of a session condition
      // (TEST-SPEC line 9's rule): no in-source location, and the concerned
      // path is the corrupt session's own file (SPEC 10.1) — for a symbolic
      // link occupying it, the link's own path, never its target's: an
      // occupant is judged, never read through (13.4). Every condition-21
      // finding concerns it, since the staged session is the only corrupt
      // one (the symbolic-link state's `real` beside it is valid). The
      // naming subcommands' reports and the listing's findings are judged
      // by the same helper.
      assertCorruptSessionReport(
        corrupt,
        `${checkContext} — its condition-21 findings`,
      );
    },
    `${checkContext} — \`check\` never writes (SPEC 12.2, 13.3)`,
  );
}

/**
 * One staged corrupt state of T10.1-4: the corrupt session and its file,
 * an item ID for the item-naming subcommands, the item IDs the session
 * held, and the listing `review list` must give.
 */
export interface StagedCorruptSession {
  /** The corrupt session's name (SPEC 10.1). */
  readonly session: string;
  /**
   * Its file `.xspec/reviews/<name>.json` — every condition-21 finding's
   * concerned path (SPEC 14, 12.7, 10.1), a symbolic link there by its own
   * path (13.4).
   */
  readonly path: string;
  /**
   * The item ID T10.1-4's `show`, `resolve`, and `split` name: one the
   * product-written session held before the corruption, or the placeholder
   * for a state no readable session precedes (module header).
   */
  readonly itemId: string;
  /**
   * Every item ID the session held as the product wrote it, read from the
   * product's own reports before the corruption — empty where no
   * product-written session of that name preceded the state.
   */
  readonly heldItemIds: readonly string[];
  /** The sessions `review list` reports, in byte order of name (SPEC 10.7). */
  readonly sessions: readonly ExpectedSessionEntry[];
}

/**
 * One corrupt state of T10.1-4 (SPEC 10.1, 14.21), staged on a fresh
 * workspace of its own passing `build`'s validations (H-1). T10.1-4 runs
 * its contract on each state, and T12.0-10's past-the-gate arm runs
 * `resolve`, `show`, and `split` naming an item ID the session never held
 * on each (SPEC 12.0, 10.7: the session read, meeting the corruption,
 * precedes the unknown item ID) — one staging per state, shared.
 */
export interface CorruptSessionState {
  /** The state's name, bracketed in every diagnosis (`T10.1-4 [<state>]`). */
  readonly state: string;
  /** The fresh workspace's initial files. */
  readonly files: Readonly<Record<string, InitialFileContents>>;
  /**
   * Stage the state on the fresh workspace: every invocation and staging
   * step it takes, `context` leading each diagnosis.
   */
  readonly stage: (
    product: ProductBinding,
    workspace: TestWorkspace,
    context: string,
  ) => Promise<StagedCorruptSession>;
}

/**
 * The staged corrupt session `cor` — alone in the session directory unless
 * `sessions` lists more.
 */
function stagedCorruptSession(
  itemId: string,
  heldItemIds: readonly string[],
  sessions: readonly ExpectedSessionEntry[] = [
    { name: CORRUPT_NAME, corrupt: true },
  ],
): StagedCorruptSession {
  return {
    session: CORRUPT_NAME,
    path: sessionRel(CORRUPT_NAME),
    itemId,
    heldItemIds,
    sessions,
  };
}

// The shape-dependent corrupt states, each staged through the H-3 adapter
// layer over a session file the product itself wrote (session-staging.ts).
// A missing 10.2 field is staged twice, once per field every item carries
// (SPEC 10.2) — its `status`, and separately its `kind` — each deletion
// naming the field by the adapter's assumed shape and failing loudly if the
// product's stored shape differs (H-3); `note`, which is optional, and
// `origin`, carried when applicable, are never deleted.
const ADAPTER_STATES: readonly (readonly [
  string,
  (sessionAbsPath: string) => Promise<void>,
])[] = [
  ["missing 10.2 field: an item's status", (abs) => stageDeleteItemStatus(abs)],
  ["missing 10.2 field: an item's kind", (abs) => stageDeleteItemKind(abs)],
  ["unknown status", (abs) => stageUnknownItemStatus(abs)],
  ["duplicate item ids", (abs) => stageDuplicateItemEntry(abs)],
  [
    "two items with same kind and scope node",
    (abs) => stageDuplicateItemEntry(abs, { distinctId: true }),
  ],
  ["blockedBy naming an absent item", (abs) => stageBlockedByAbsentItem(abs)],
  ["blockedBy cycle", (abs) => stageBlockedByCycle(abs)],
];

/**
 * A shape-dependent state (`ADAPTER_STATES`): an audit session the product
 * writes, transformed through the adapter.
 */
function adapterState(
  state: string,
  corrupt: (sessionAbsPath: string) => Promise<void>,
): CorruptSessionState {
  return {
    state,
    files: CORE_FILES,
    stage: async (product, workspace, context) => {
      const items = await stageProductSession(
        product,
        workspace,
        ["review", "create", "--strategy", "audit", "--name", CORRUPT_NAME],
        context,
      );
      await corrupt(workspace.path(sessionRel(CORRUPT_NAME)));
      return stagedCorruptSession(items[0].id, distinctItemIds(items));
    },
  };
}

/**
 * Every corrupt state of T10.1-4, in its order: the shape-dependent states
 * via the adapter, malformed recorded creation parameters and
 * decompositions, unparseable JSON (garbage bytes, then a truncated
 * product-written file), the session path occupied by a directory and by
 * a symbolic link, and the decomposed item.
 */
export const T10_1_4_CORRUPT_STATES: readonly CorruptSessionState[] = [
  ...ADAPTER_STATES.map(([state, corrupt]) => adapterState(state, corrupt)),
  {
    // A coverage session records the profile's resolved definition (an
    // audit session records none, SPEC 10.7), so there is a recorded value
    // for the value-blind adapter transformation to garble.
    state: "malformed recorded creation parameters",
    files: COVERAGE_FILES,
    stage: async (product, workspace, context) => {
      const items = await stageProductSession(
        product,
        workspace,
        ["review", "create", "--coverage", "p", "--name", CORRUPT_NAME],
        context,
      );
      await stageGarbleCreationParameters(
        workspace.path(sessionRel(CORRUPT_NAME)),
      );
      return stagedCorruptSession(items[0].id, distinctItemIds(items));
    },
  },
  {
    // A `split` records its decomposition — the original's kind and scope
    // node — durably in the session (SPEC 10.7), so the product itself is
    // made to perform one before the recorded value is garbled: the
    // corrupted file starts as one the product wrote holding a genuine
    // recorded decomposition (an unsplit session may record none).
    state: "malformed recorded decompositions",
    files: CORE_FILES,
    stage: async (product, workspace, context) => {
      await buildOk(product, workspace, `${context} \`build\``);
      await expectExit(
        product,
        workspace,
        ["review", "create", "--strategy", "audit", "--name", CORRUPT_NAME],
        0,
        `${context} \`review create --strategy audit --name ${CORRUPT_NAME}\``,
      );
      const items = await readSessionItems(
        product,
        workspace,
        `${context} \`review status ${CORRUPT_NAME} --json\` (split-target selection)`,
      );
      // The split target: the subtree-coherence item scoped at the one
      // section with a child (`a` contains `a.k`), so the split is not
      // refused (SPEC 10.7: a childless scope root refuses).
      const splitScope = "specs/A.mdx#a";
      const splitTarget = items.find(
        (item) =>
          item.kind === "subtree-coherence" && item.scope === splitScope,
      );
      if (splitTarget === undefined) {
        fail(
          `${context}: staging premise — the audit session holds one ` +
            `subtree-coherence item per requirement node (SPEC 10.6), so an ` +
            `item scoped at ${splitScope} must exist for \`split\` to ` +
            `decompose; item scopes: ` +
            JSON.stringify(items.map((item) => item.scope)),
        );
      }
      await expectExit(
        product,
        workspace,
        ["review", "split", CORRUPT_NAME, splitTarget.id],
        0,
        `${context} \`review split ${CORRUPT_NAME} ${splitTarget.id}\` — ` +
          `the product-performed split records the decomposition durably ` +
          `(SPEC 10.7)`,
      );
      const postSplit = await readSessionItems(
        product,
        workspace,
        `${context} \`review status ${CORRUPT_NAME} --json\` (post-split item-id capture)`,
      );
      if (postSplit.some((item) => item.id === splitTarget.id)) {
        fail(
          `${context}: staging premise — after \`split\`, the original item ` +
            `is removed from the session and its id (${splitTarget.id}) ` +
            `never reused (SPEC 10.7), so its decomposition is genuinely ` +
            `recorded; the id is still present`,
        );
      }
      await stageGarbleDecompositions(workspace.path(sessionRel(CORRUPT_NAME)));
      return stagedCorruptSession(
        postSplit[0].id,
        distinctItemIds([...items, ...postSplit]),
      );
    },
  },
  {
    // Unparseable JSON: garbage bytes (shape-independent, staged directly
    // — no assumed session layout is involved).
    state: "unparseable JSON (garbage bytes)",
    files: CORE_FILES,
    stage: async (product, workspace, context) => {
      await buildOk(product, workspace, `${context} \`build\``);
      await workspace.file(
        sessionRel(CORRUPT_NAME),
        "this is deliberately not a JSON document ][}{\n",
      );
      return stagedCorruptSession(PLACEHOLDER_ITEM_ID, []);
    },
  },
  {
    // Unparseable JSON: truncation of the product-written file.
    state: "unparseable JSON (truncated product-written file)",
    files: CORE_FILES,
    stage: async (product, workspace, context) => {
      const items = await stageProductSession(
        product,
        workspace,
        ["review", "create", "--strategy", "audit", "--name", CORRUPT_NAME],
        context,
      );
      const bytes = await readSessionBytes(
        workspace,
        CORRUPT_NAME,
        `${context} the product-written session file`,
      );
      const truncated = bytes.subarray(0, Math.floor(bytes.length / 2));
      // Staging premise: the front half of the product's single JSON
      // document must itself not parse as one (a JSON object loses its
      // closing brace); verify rather than assume.
      let stillParses = false;
      try {
        JSON.parse(new TextDecoder("utf-8").decode(truncated));
        stillParses = true;
      } catch {
        // Expected: the truncation is unparseable.
      }
      if (truncated.length === 0 || stillParses) {
        fail(
          `${context}: staging premise — truncating the ` +
            `product-written session file (${String(bytes.length)} bytes) to ` +
            `its front half must yield a non-empty, unparseable document; ` +
            `adjust the staging if the product's stored form legitimately ` +
            `defeats this (H-3)`,
        );
      }
      await workspace.file(sessionRel(CORRUPT_NAME), truncated);
      return stagedCorruptSession(items[0].id, distinctItemIds(items));
    },
  },
  {
    // The session path occupied by a directory (SPEC 13.4: a durable
    // file's path occupied by anything other than a plain file is corrupt).
    state: "session path occupied by a directory",
    files: CORE_FILES,
    stage: async (product, workspace, context) => {
      await buildOk(product, workspace, `${context} \`build\``);
      await workspace.dir(sessionRel(CORRUPT_NAME));
      return stagedCorruptSession(PLACEHOLDER_ITEM_ID, []);
    },
  },
  {
    // The session path occupied by a symbolic link. The link's target is a
    // *valid* session file (the real session beside it), so a product that
    // follows the link instead of treating the occupied path as corrupt
    // (13.4: never read through it) sees a perfectly healthy session and
    // fails every arm.
    state: "session path occupied by a symbolic link",
    files: CORE_FILES,
    stage: async (product, workspace, context) => {
      await buildOk(product, workspace, `${context} \`build\``);
      await expectExit(
        product,
        workspace,
        ["review", "create", "--strategy", "audit", "--name", "real"],
        0,
        `${context} \`review create --strategy audit --name real\` (the link's valid target)`,
      );
      await workspace.symlink(sessionRel(CORRUPT_NAME), "real.json");
      return stagedCorruptSession(
        PLACEHOLDER_ITEM_ID,
        [],
        [
          { name: CORRUPT_NAME, corrupt: true },
          { name: "real", corrupt: false },
        ],
      );
    },
  },
  {
    // An item whose kind and scope node are recorded as decomposed — the
    // one baseline session among the states (stageDecomposedItemState): a
    // path-blocks session's post-`split` file with the original item's
    // entry, copied from the pre-`split` file, re-inserted.
    state: "an item whose kind and scope node are recorded as decomposed",
    files: CORE_FILES,
    stage: async (product, workspace, context) => {
      const { itemId, heldItemIds } = await stageDecomposedItemState(
        product,
        workspace,
        context,
      );
      return stagedCorruptSession(itemId, heldItemIds);
    },
  },
];

const T10_1_4 = defineProductTest({
  id: "T10.1-4",
  title:
    "each corrupt session state — unparseable bytes (garbage and truncation), a missing 10.2 field (an item's status, and separately its kind), unknown status, duplicate item ids, blockedBy at an absent item, a blockedBy cycle, duplicate kind+scope, an item whose kind and scope node are recorded as decomposed (a path-blocks session's original item, copied from the pre-`split` file the product wrote, re-inserted into the post-`split` file), malformed recorded creation parameters, malformed recorded decompositions (garbled over a product-performed `split`'s durable record), and a directory or symlink at the session path — makes every review subcommand naming the session report corruption, exit 1, and modify nothing, its report under `--json` (and `export`'s without the flag, its only output form, the same document) the findings-only document of at least one finding, every one condition 21 `corrupt-session` concerning the session's own file (a symlink there by its own path) with `locations` []; `list` reports it corrupt in place of its fields (exit 1), the listing's findings likewise at least one, every one condition 21 `corrupt-session` concerning the session's own file with `locations` []; `check` reports 14.21; shape-dependent states are staged via the H-3 adapter over product-written files (SPEC 10.1, 10.7, 12.7, 13.4, 14.21)",
  run: async (product) => {
    // Each state on a fresh workspace of its own, staged by its entry of
    // `T10_1_4_CORRUPT_STATES` (T12.0-10's past-the-gate arm stages the
    // same states), then the full contract.
    for (const corrupt of T10_1_4_CORRUPT_STATES) {
      await withWorkspace(corrupt.files, async (workspace) => {
        const staged = await corrupt.stage(
          product,
          workspace,
          `T10.1-4 [${corrupt.state}]`,
        );
        await assertCorruptSessionContract(
          product,
          workspace,
          corrupt.state,
          staged.itemId,
          staged.sessions,
        );
      });
    }
  },
});

// ---------------------------------------------------------------------------
// T10.1-5 — failing workspace: gate precedence over corruption
// ---------------------------------------------------------------------------

// The invalidating edit's target: valid at staging, then overwritten with a
// non-root section carrying no `id` — after the edit the workspace's one
// `build` validation finding is that 14.1 (the section has no children, so
// condition 2's masking never enters), making "exactly the gate's findings"
// a one-element multiset (SPEC 13.3, 14.1). A.mdx — the session's item
// source — is never touched, so the gate alone flips every subcommand's
// behavior.
const T10_1_5_B_VALID = ['<S id="b">', "Beta text.", "</S>", ""].join("\n");
// The invalidating edit is staged after the body's `build` and `review
// create`, so it is a staged-source record (helpers/staged-mdx.ts; S-9's
// before-any-product clause): well-formed MDX — the file derives; only 14.1
// fails it.
const T10_1_5_B_INVALID = stagedMdx(
  "T10.1-5 specs/B.mdx with the section's id removed (derives; fails 14.1)",
  ["<S>", "Beta text.", "</S>", ""].join("\n"),
);

// T10.1-4's shape-independent garbage-bytes corruption: staged directly, no
// assumed session layout — the bytes parse as no JSON document (SPEC 10.1,
// 14.21).
const T10_1_5_GARBAGE = "this is deliberately not a JSON document ][}{\n";

// Item ID for the gated `show`/`resolve`/`split` probes: deliberately one no
// session ever held. An item ID is judged only against its session's content
// (SPEC 12.0), which no gated command reads on a failing workspace (13.3) —
// and the corruption would withhold anyway — so the probes must report the
// gate's findings whatever the ID: a product judging the ID before the gate
// (exit 2, unknown item) or opening the session to judge it (a corruption
// report) fails the exact-findings assertions below.
const T10_1_5_ITEM_ID = "no-such-item";

const T10_1_5 = defineProductTest({
  id: "T10.1-5",
  title:
    "failing workspace: gate precedence over corruption — a session created on a valid build is corrupted shape-independently (garbage bytes), then a source edited to fail build validation: `status`, `next`, `show`, `export`, `resolve` and `split` with an item ID no session held, and `review list` each report exactly the gate's findings as the form-exact findings report — the one staged 14.1, no condition-21 finding beside it — exit 1 and modify nothing, the corrupt session's bytes untouched (no session file is read; for `list` the gate's report replaces the per-session report whole), while `check` reports 14.21 concerning the session file together with the validation finding — the discriminating pair (SPEC 10.1, 10.7, 13.3, 14.21, 12.0)",
  run: async (product) => {
    await withWorkspace(
      {
        "xspec.config.ts": SPECS_ONLY_CONFIG,
        "specs/A.mdx": A_MDX_STAGED,
        "specs/B.mdx": T10_1_5_B_VALID,
      },
      async (workspace) => {
        // --- Staging, in TEST-SPEC's order: session on a valid build,
        // shape-independent corruption, then the invalidating source edit.
        await buildOk(product, workspace, "T10.1-5 staging `build`");
        await expectExit(
          product,
          workspace,
          ["review", "create", "--strategy", "audit", "--name", CORRUPT_NAME],
          0,
          `T10.1-5 staging \`review create --strategy audit --name ${CORRUPT_NAME}\``,
        );
        await workspace.file(sessionRel(CORRUPT_NAME), T10_1_5_GARBAGE);
        const corruptBytes = await readSessionBytes(
          workspace,
          CORRUPT_NAME,
          "T10.1-5 staging (the corrupted session file)",
        );
        await workspace.file("specs/B.mdx", T10_1_5_B_INVALID);

        // --- The gate reference: `build` itself reports exactly the staged
        // validation error — "the findings a `build` would now report" is
        // what every gated probe below must reproduce (SPEC 13.3) — and the
        // exact one-element count doubles as condition 21's not-by-build
        // half: `build` reads no sessions (SPEC 14 condition 21). A failing
        // build modifies nothing (SPEC 12.1).
        const buildContext = "T10.1-5 `build --json` (the gate reference)";
        await assertLeavesUnchanged(
          workspace.root,
          async () => {
            const result = await expectExit(
              product,
              workspace,
              ["build", "--json"],
              1,
              `${buildContext} — the edited source fails build validation (SPEC 12.1, 14.1)`,
            );
            const findings = decodeFindingsReport(
              parseJsonStdout(result, buildContext),
              buildContext,
            ).findings;
            assertConditionCounts(
              findings,
              { "14.1": 1 },
              `${buildContext} — exactly the staged validation error, and ` +
                `never 14.21: \`build\` does not read sessions (SPEC 14 ` +
                `condition 21)`,
            );
            assertFindingLocated(
              findings[0] as Finding,
              { file: "specs/B.mdx" },
              `${buildContext} — the validation error identifies the broken source (SPEC 14)`,
            );
          },
          `${buildContext} — a failing build modifies nothing (SPEC 12.1)`,
        );

        /**
         * One gated probe (SPEC 13.3, 10.1): exit 1 with stdout the single
         * form-exact findings report holding exactly the gate's findings —
         * the staged 14.1 alone, so no condition-21 finding beside it — and
         * nothing modified: sources, graph data, and the corrupt session's
         * bytes byte-identical around the invocation.
         */
        const probeGate = async (
          argv: readonly string[],
          what: string,
        ): Promise<void> => {
          const context = `T10.1-5 ${what}`;
          await assertLeavesUnchanged(
            workspace.root,
            async () => {
              const result = await runCli(product, workspace, argv);
              assertExitCode(
                result,
                1,
                `${context} — on a workspace failing \`build\`'s ` +
                  `validations the gate's findings are reported and the ` +
                  `command exits 1; no session file is read, so the ` +
                  `corruption is not the outcome (SPEC 13.3, 10.1, 12.0)`,
              );
              const findings = decodeFindingsReport(
                parseJsonStdout(result, context),
                context,
              ).findings;
              assertConditionCounts(
                findings,
                { "14.1": 1 },
                `${context} — exactly the gate's findings: the staged ` +
                  `validation error alone, no condition-21 finding beside ` +
                  `it (SPEC 13.3, 14.21)`,
              );
              assertFindingLocated(
                findings[0] as Finding,
                { file: "specs/B.mdx" },
                `${context} — the gate's finding identifies the broken source (SPEC 14)`,
              );
            },
            `${context} — nothing modified: sources, graph data, and the ` +
              `corrupt session's bytes stay byte-identical (SPEC 13.3, 10.1)`,
          );
        };

        // Every `review` subcommand naming the session (TEST-SPEC's list).
        await probeGate(
          ["review", "status", CORRUPT_NAME, "--json"],
          `\`review status ${CORRUPT_NAME} --json\``,
        );
        await probeGate(
          ["review", "next", CORRUPT_NAME, "--json"],
          `\`review next ${CORRUPT_NAME} --json\``,
        );
        await probeGate(
          ["review", "show", CORRUPT_NAME, T10_1_5_ITEM_ID, "--json"],
          `\`review show ${CORRUPT_NAME} ${T10_1_5_ITEM_ID} --json\``,
        );
        await probeGate(
          ["review", "export", CORRUPT_NAME, "--json"],
          `\`review export ${CORRUPT_NAME} --json\``,
        );
        await probeGate(
          [
            "review",
            "resolve",
            CORRUPT_NAME,
            T10_1_5_ITEM_ID,
            "--status",
            "updated",
            "--json",
          ],
          `\`review resolve ${CORRUPT_NAME} ${T10_1_5_ITEM_ID} --status updated --json\``,
        );
        await probeGate(
          ["review", "split", CORRUPT_NAME, T10_1_5_ITEM_ID, "--json"],
          `\`review split ${CORRUPT_NAME} ${T10_1_5_ITEM_ID} --json\``,
        );
        // `review list`: the gate's report replaces the per-session report
        // whole (SPEC 10.7) — realized by the same form-exact one-member
        // decode, which no session-row-carrying document passes.
        await probeGate(["review", "list", "--json"], "`review list --json`");

        // --- The discriminating pair's other half: `check` reports 14.21
        // together with the validation findings (SPEC 14 condition 21:
        // beside a failing workspace's other findings; 12.2).
        // Presence-based beside the two staged conditions: with invalid
        // sources, the detectability of staleness findings (14.10) beside
        // them is T14-4's reporter-matrix business (the T13.3-3 precedent).
        const checkContext = "T10.1-5 `check --json`";
        await assertLeavesUnchanged(
          workspace.root,
          async () => {
            const result = await expectExit(
              product,
              workspace,
              ["check", "--json"],
              1,
              `${checkContext} — the workspace carries findings (SPEC 12.2)`,
            );
            const findings = decodeFindingsReport(
              parseJsonStdout(result, checkContext),
              checkContext,
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
                `${checkContext}: the staged validation error (14.1 in ` +
                  `specs/B.mdx) must be reported (SPEC 12.2, 14.1); got ` +
                  JSON.stringify(
                    findings.map((finding) => ({
                      condition: finding.condition,
                      locations: finding.locations,
                    })),
                  ),
              );
            }
            const corrupt = findings.filter(
              (finding) => finding.condition === "14.21",
            );
            if (corrupt.length === 0) {
              fail(
                `${checkContext}: \`check\` must report 14.21 together ` +
                  `with the validation findings — beside a failing ` +
                  `workspace's other findings, the discriminating half ` +
                  `against a product dropping 14.21 on the failing side ` +
                  `(SPEC 14 condition 21, 12.2); reported conditions: ` +
                  JSON.stringify(findings.map((finding) => finding.condition)),
              );
            }
            if (
              !corrupt.some(
                (finding) => finding.path === sessionRel(CORRUPT_NAME),
              )
            ) {
              fail(
                `${checkContext}: the 14.21 finding carries the corrupt ` +
                  `session file it concerns, ${sessionRel(CORRUPT_NAME)}, ` +
                  `as its 12.7 path member (SPEC 14: session conditions ` +
                  `carry the file they concern); got paths ` +
                  JSON.stringify(corrupt.map((finding) => finding.path)),
              );
            }
          },
          `${checkContext} — \`check\` never writes (SPEC 12.2, 13.3)`,
        );

        // --- Pointed restatement of "the corrupt session's bytes
        // untouched" across the whole sweep (each probe's whole-root
        // compare already covers its own invocation).
        assertBytesEqual(
          await readSessionBytes(
            workspace,
            CORRUPT_NAME,
            "T10.1-5 (after every probe)",
          ),
          corruptBytes,
          "T10.1-5: the corrupt session's bytes are untouched by the whole " +
            "probe sweep — no session file is read or written on a failing " +
            "workspace (SPEC 13.3, 10.1)",
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T10.1-6 — session-directory and area occupancy; `create`'s ordering
// ---------------------------------------------------------------------------

// The non-directory occupant staged at `.xspec/reviews` and at `.xspec`
// (SPEC 14.22's plain-file kind; content arbitrary — the occupant is never
// read).
const T10_1_6_OCCUPANT = "not a directory\n";

// The derived paths of `specs/A.mdx`: its module and companions are
// `specs/A.xspec.` plus a suffix (SPEC 13.1); the module itself embeds the
// node text (SPEC 4.2), so a text edit makes it stale for certain.
const T10_1_6_A_DERIVED_PREFIX = "specs/A.xspec.";
const T10_1_6_A_MODULE = "specs/A.xspec.ts";

/** The product-written session every staging starts from (`s`). */
const T10_1_6_SESSION = "s";
/** The name `create` is refused for on every occupied session directory. */
const T10_1_6_NEW_SESSION = "n";
/** The `.xspec` link staging's second valid product-written session. */
const T10_1_6_SECOND_SESSION = "t";
/** The corrupt session staged beside the valid ones behind each link. */
const T10_1_6_CORRUPT_SESSION = "c";

const T10_1_6_CREATE_S: readonly string[] = [
  "review",
  "create",
  "--strategy",
  "audit",
  "--name",
  T10_1_6_SESSION,
];

/** The journal's path (SPEC 6.1), as `inventory` reports it (11.6, 12.7). */
const T10_1_6_JOURNAL_PATH = `${GRAPH_DATA_AREA_PATH}/journal`;

// T6.1-3's malformed-journal line: deliberately structureless bytes no
// conforming entry format accepts, appended to a journal the product wrote
// (shape-independent, H-4) — never a duplicate or recombination of
// product-written entries.
const T10_1_6_JOURNAL_GARBAGE_LINE =
  "?? harness-injected garbage: not a journal entry ??";

/** The session name the absent-directory sweep names: no session holds it. */
const T10_1_6_UNKNOWN_SESSION = "x";

/**
 * The item ID `show`, `resolve`, and `split` pass beside `x`: any plausible
 * ID serves — 12.0 judges a session name against the session directory
 * among the argument checks, and an item ID only against its session's
 * content, past the gate (10.7): an unknown session has none.
 */
const T10_1_6_ITEM_ID = "item-1";

/**
 * The `review` subcommands naming a session, each naming `x` (TEST-SPEC
 * T10.1-6's absent-directory list), with an item ID where it takes one and
 * `resolve`'s required status (SPEC 10.7).
 */
const T10_1_6_NAMING_X: readonly (readonly string[])[] = [
  ["review", "status", T10_1_6_UNKNOWN_SESSION],
  ["review", "next", T10_1_6_UNKNOWN_SESSION],
  ["review", "show", T10_1_6_UNKNOWN_SESSION, T10_1_6_ITEM_ID],
  ["review", "export", T10_1_6_UNKNOWN_SESSION],
  [
    "review",
    "resolve",
    T10_1_6_UNKNOWN_SESSION,
    T10_1_6_ITEM_ID,
    "--status",
    "no-change",
  ],
  ["review", "split", T10_1_6_UNKNOWN_SESSION, T10_1_6_ITEM_ID],
];

/** How a path comes to hold a non-directory (SPEC 13.4). */
type T1016Occupant =
  | { readonly kind: "plain-file" }
  | {
      readonly kind: "symlink";
      /** Where the relocated product-written directory goes (root-relative). */
      readonly targetRel: string;
      /** The link's stored target, spelled relative to the link's directory. */
      readonly linkTarget: string;
    };

const T10_1_6_PLAIN_FILE: T1016Occupant = { kind: "plain-file" };
// `.xspec/reviews` → `../elsewhere-reviews`: a real directory inside the
// workspace root, outside the area, holding the product-written `s.json`
// and, beside it, the corrupt `c.json`.
const T10_1_6_REVIEWS_LINK: T1016Occupant = {
  kind: "symlink",
  targetRel: "elsewhere-reviews",
  linkTarget: "../elsewhere-reviews",
};
// `.xspec` → `elsewhere-area`: the relocated area — the journal with its
// garbage line appended, graph data, and the valid sessions `s` and `t`
// beside the corrupt `c` — beside the link.
const T10_1_6_AREA_LINK: T1016Occupant = {
  kind: "symlink",
  targetRel: "elsewhere-area",
  linkTarget: "elsewhere-area",
};

/**
 * Stage a non-directory occupant at `rel` (SPEC 13.4): `plain-file`
 * replaces whatever the path holds with a plain file; `symlink` relocates
 * the directory the path holds to `targetRel` and leaves a symbolic link
 * spelled `linkTarget` in its place, so the link's target holds exactly what
 * the product wrote there. The staging is verified on the harness's own
 * process before any product runs: a wrong occupant kind is machinery
 * misuse, thrown as a plain `Error` — never a diagnosed failure (H-11).
 */
async function stageNonDirectoryOccupant(
  workspace: TestWorkspace,
  rel: string,
  occupant: T1016Occupant,
): Promise<void> {
  if (occupant.kind === "plain-file") {
    await fsp.rm(workspace.path(rel), { recursive: true, force: true });
    await workspace.file(rel, T10_1_6_OCCUPANT);
  } else {
    const held = await workspace.kind(rel);
    if (held !== "dir") {
      throw new Error(
        `T10.1-6 staging: ${rel} must hold the product-written directory ` +
          `to relocate to ${occupant.targetRel}; found ${held}`,
      );
    }
    await fsp.rename(workspace.path(rel), workspace.path(occupant.targetRel));
    await workspace.symlink(rel, occupant.linkTarget, "dir");
  }
  const expected = occupant.kind === "plain-file" ? "file" : "symlink";
  const staged = await workspace.kind(rel);
  if (staged !== expected) {
    throw new Error(
      `T10.1-6 staging: expected ${rel} to hold a ${expected} once staged; ` +
        `found ${staged} (a harness staging error, not a product observation)`,
    );
  }
}

/**
 * Exactly one finding, of the given counting identity — a condition token of
 * 14 — with no in-source location (locations [], SPEC 12.7) and the path it
 * concerns (SPEC 14, 12.7). The code-less refusal of 10.7 is the shared
 * T10.7-14 check's (support.ts `expectReviewRefusal`).
 */
function assertExactlyOneFinding(
  findings: readonly Finding[],
  identity: string,
  concernedPath: string,
  context: string,
): Finding {
  assertConditionCounts(findings, { [identity]: 1 }, context);
  const finding = findings[0]!;
  assertFindingConcernsPath(finding, concernedPath, context);
  assertSameJson(
    finding.locations,
    [],
    `${context}: the finding has no in-source location — locations [] ` +
      `(SPEC 12.7)`,
  );
  return finding;
}

/**
 * `check`'s report once a refused `create` has left the edited-source twin
 * as it found it (SPEC 10.7, 13.5: stale graph data stays stale). Graph
 * data is still stale, so exactly one condition-10 finding is the
 * graph-data unit form — concerned path the area `.xspec`, no path inside
 * it named, locations [] (SPEC 14.10, 11.6, 13.3) — where a product
 * refreshing before it examines the session directory leaves graph data
 * refreshed and no unit form reported. Every other condition-10 finding is
 * per file, concerning a derived path of `specs/A.mdx` — `specs/A.xspec.`
 * plus a suffix (SPEC 13.1) — with the module itself among them (it embeds
 * the edited text, SPEC 4.2). Every condition-10 finding, the unit form
 * included, instructs rebuilding (`assertFindingInstructsRebuilding`: its
 * message names `build`), the correction SPEC 14.10 requires of the unit
 * form and of a per-file finding: each twin's state is a text edit, so
 * every stale derived file is one the rebuild regenerates in place, and no
 * recorded file obstructs a path the rebuild writes — the one condition-10
 * form whose correction is its manual deletion instead (SPEC 14.10, 13.4,
 * 14.22; T13.4-10's judge). Beside the staleness, exactly `beside` (counted
 * by identity) and nothing else.
 */
function assertStaleTwinStillStale(
  findings: readonly Finding[],
  beside: Readonly<Record<string, number>>,
  context: string,
): void {
  const stale = findings.filter((finding) => finding.condition === "14.10");
  assertConditionCounts(
    findings.filter((finding) => finding.condition !== "14.10"),
    beside,
    `${context} — beside the staleness, exactly the expected findings and ` +
      `nothing else (SPEC 14, 12.2)`,
  );
  const unitForms = stale.filter(
    (finding) => finding.path === GRAPH_DATA_AREA_PATH,
  );
  if (unitForms.length !== 1) {
    fail(
      `${context}: the refused \`create\` modified nothing, so graph data is ` +
        `still stale and \`check\` reports the graph-data unit form — ` +
        `exactly one condition-10 finding concerning the area ` +
        `${GRAPH_DATA_AREA_PATH} (SPEC 10.7, 13.5, 13.3, 14.10) — where a ` +
        `product refreshing before it examines the session directory ` +
        `leaves graph data refreshed and no unit form reported; got ` +
        `${String(unitForms.length)} among the condition-10 findings ` +
        `concerning ${JSON.stringify(stale.map((finding) => finding.path))}`,
    );
  }
  const unitForm = unitForms[0]!;
  assertSameJson(
    unitForm.locations,
    [],
    `${context}: the graph-data unit form names no path inside the area — ` +
      `the record's layout is unenumerated (SPEC 14.10, 13.3) — and a ` +
      `path-concerned condition is unlocated: locations [] (SPEC 12.7)`,
  );
  assertFindingInstructsRebuilding(
    unitForm,
    `${context}: the graph-data unit form — stale graph data, which the ` +
      `rebuild regenerates — instructs rebuilding (SPEC 14.10)`,
  );
  const perFile = stale.filter((finding) => finding !== unitForm);
  if (perFile.length === 0) {
    fail(
      `${context}: the edited source's generated module no longer matches ` +
        `what the current sources generate — its documentation comment ` +
        `embeds the edited text (SPEC 4.2) — so \`check\` reports per-file ` +
        `staleness beside the unit form (SPEC 14.10, 12.2); got no per-file ` +
        `condition-10 finding`,
    );
  }
  for (const finding of perFile) {
    if (
      typeof finding.path !== "string" ||
      !finding.path.startsWith(T10_1_6_A_DERIVED_PREFIX)
    ) {
      fail(
        `${context}: beside the graph-data unit form every condition-10 ` +
          `finding is per file, concerning a derived path of specs/A.mdx — ` +
          `${T10_1_6_A_DERIVED_PREFIX}* (SPEC 13.1, 14.10); got a ` +
          `condition-10 finding concerning ` +
          `${JSON.stringify(finding.path)} (message: ` +
          `${JSON.stringify(finding.message)})`,
      );
    }
    assertSameJson(
      finding.locations,
      [],
      `${context}: a per-file staleness finding names its path and has no ` +
        `in-source location — locations [] (SPEC 14.10, 12.7)`,
    );
    assertFindingInstructsRebuilding(
      finding,
      `${context}: the per-file staleness finding concerning ` +
        `${JSON.stringify(finding.path)} — a derived file of the edited ` +
        `source, which the rebuild regenerates in place; the twin's state ` +
        `is a text edit, so no recorded file obstructs a rebuild write and ` +
        `the finding instructs rebuilding (SPEC 14.10)`,
    );
  }
  if (!perFile.some((finding) => finding.path === T10_1_6_A_MODULE)) {
    fail(
      `${context}: the module ${T10_1_6_A_MODULE} itself is stale — it ` +
        `embeds the edited text (SPEC 4.2, 13.1) — so a condition-10 ` +
        `finding concerns it (SPEC 14.10); got ` +
        JSON.stringify(stale.map((finding) => finding.path)),
    );
  }
}

/**
 * `.xspec/reviews` holds nothing — no entry at its path — else a diagnosed
 * failure: absent is every workspace's state before its first `review
 * create`, whose write alone brings it into existence (SPEC 10.1, 13.4;
 * T10.1-1).
 */
async function assertReviewsDirectoryAbsent(
  workspace: TestWorkspace,
  context: string,
): Promise<void> {
  const held = await workspace.kind(REVIEWS_DIR);
  if (held !== "absent") {
    fail(
      `${context}: ${REVIEWS_DIR} must be absent — every workspace's state ` +
        `before its first \`review create\`, whose write alone brings it ` +
        `into existence (SPEC 10.1, 13.4; T10.1-1); found ${held}`,
    );
  }
}

/**
 * The session directory absent (SPEC 10.1, 13.4, 14.25): on a freshly built
 * valid workspace — `build` bringing no `.xspec/reviews` into existence,
 * asserted first — it holds no sessions, and its nonexistence is never a
 * refused read: `review list` reports no sessions, exit 0, and `status`,
 * `next`, `show`, `export`, `resolve`, and `split` naming `x`
 * (`T10_1_6_NAMING_X`) each exit 2 as an unknown session — a plain usage
 * error, so the error document's `code` and `path` are `null` (12.0, 12.7),
 * never condition 25's `read-failure`. After each command `.xspec/reviews`
 * is still absent: none brings it into existence (`create`'s write alone
 * does, T10.1-1). One whole-root compare around the sweep: the workspace is
 * fresh, so no refresh of 13.3 legitimately intervenes, and H-6 leaves out
 * the lock path `resolve` and `split` acquire (13.5) — nothing is written.
 */
async function assertSessionDirectoryAbsent(
  product: ProductBinding,
  workspace: TestWorkspace,
  label: string,
): Promise<void> {
  await assertReviewsDirectoryAbsent(
    workspace,
    `${label} after \`build\` — a freshly built valid workspace holds no ` +
      `${REVIEWS_DIR}: \`build\` brings none into existence`,
  );
  await assertLeavesUnchanged(
    workspace.root,
    async () => {
      const listContext =
        `${label} \`review list --json\` — the absent session directory ` +
        `holds no sessions, and its nonexistence is never a refused read: ` +
        `no sessions, exit 0 (SPEC 10.1, 10.7, 14.25)`;
      const list = decodeSessionListReport(
        await runJson(
          product,
          workspace,
          ["review", "list", "--json"],
          listContext,
        ),
        listContext,
      );
      assertSameJson(list.sessions, [], `${listContext}: sessions`);
      await assertReviewsDirectoryAbsent(
        workspace,
        `${listContext} — none of the sweep's commands brings it into ` +
          `existence`,
      );

      for (const argv of T10_1_6_NAMING_X) {
        const jsonArgv = [...argv, "--json"];
        const context =
          `${label} \`${jsonArgv.join(" ")}\` — ` +
          `\`${T10_1_6_UNKNOWN_SESSION}\` names no session while the ` +
          `session directory is absent: exit 2, an unknown session (SPEC ` +
          `10.1, 12.0)`;
        const error = expectErrorDocument(
          await expectExit(product, workspace, jsonArgv, 2, context),
          context,
        );
        assertSameJson(
          { code: error.code, path: error.path },
          { code: null, path: null },
          `${context} — a plain usage error's document carries code and ` +
            `path null (SPEC 12.7), never condition 25's "read-failure": ` +
            `the session directory's nonexistence is never a refused read ` +
            `(SPEC 10.1, 14.25)`,
        );
        await assertReviewsDirectoryAbsent(
          workspace,
          `${context} — none of the sweep's commands brings it into ` +
            `existence`,
        );
      }
    },
    `${label}: nothing is written — no ${REVIEWS_DIR} brought into ` +
      `existence, nothing else changed (SPEC 10.1, 13.4, 12.0)`,
  );
}

/**
 * The session directory holds sessions only while a directory occupies its
 * path (SPEC 10.1, 13.4): on a freshly built valid workspace whose
 * `.xspec/reviews` holds a non-directory — a plain file, or a symbolic link
 * to a directory holding the valid `s.json` beside the corrupt `c.json`,
 * which a read of sessions through the link surfaces as 14.21 — no command
 * lists through the occupant: `review list` reports no sessions, `review
 * status s` is an unknown session, `inventory` reports `sessions` [] —
 * `check` is clean and the gate carries nothing (14.22 is `create`'s
 * finding there, never `check`'s or the gate's), `ids` answers, and
 * `create` refuses its own obstructed write path with one condition-22
 * finding concerning `.xspec/reviews`. One whole-root compare around the
 * sweep (the workspace is fresh, so no 13.3 refresh legitimately
 * intervenes): nothing written — the occupant byte-unchanged, the link and
 * its target byte-identical. Exported for T13.4-13(d) (section-13.4-ii.ts),
 * which runs this sweep with a FIFO at `.xspec/reviews` (SPEC 13.4: any
 * other non-directory occupant).
 */
export async function assertSessionDirectoryOccupied(
  product: ProductBinding,
  workspace: TestWorkspace,
  label: string,
): Promise<void> {
  await assertLeavesUnchanged(
    workspace.root,
    async () => {
      const listContext =
        `${label} \`review list --json\` — no command lists through the ` +
        `occupant: no sessions, exit 0 (SPEC 10.1, 13.4, 10.7)`;
      const list = decodeSessionListReport(
        await runJson(
          product,
          workspace,
          ["review", "list", "--json"],
          listContext,
        ),
        listContext,
      );
      assertSameJson(list.sessions, [], `${listContext}: sessions`);

      const statusContext =
        `${label} \`review status s --json\` — \`s\` names no session ` +
        `through the occupant: exit 2, unknown session (SPEC 10.1, 12.0)`;
      const status = await expectExit(
        product,
        workspace,
        ["review", "status", T10_1_6_SESSION, "--json"],
        2,
        statusContext,
      );
      const error = expectErrorDocument(status, statusContext);
      assertSameJson(
        { code: error.code, path: error.path },
        { code: null, path: null },
        `${statusContext} — a plain usage error's document carries code ` +
          `and path null (SPEC 12.7)`,
      );

      await expectFindingFreeReport(
        product,
        workspace,
        ["check", "--json"],
        `${label} \`check --json\` — the occupied session directory is ` +
          `\`create\`'s condition-22 finding, never \`check\`'s or the ` +
          `gate's, and it holds no session to find corrupt (SPEC 14.22, ` +
          `12.2, 10.1)`,
      );

      const inventoryContext =
        `${label} \`inventory --json\` — sessions [] while the session ` +
        `directory holds no directory, and no finding (SPEC 11.6, 13.4)`;
      const inventory = decodeInventoryDocument(
        await runJson(
          product,
          workspace,
          ["inventory", "--json"],
          inventoryContext,
        ),
        inventoryContext,
      );
      assertSameJson(inventory.findings, [], `${inventoryContext}: findings`);
      assertSameJson(inventory.sessions, [], `${inventoryContext}: sessions`);

      const idsContext =
        `${label} \`ids --json\` — the gate carries no finding, so \`ids\` ` +
        `answers, exit 0 (SPEC 13.3, 14.22)`;
      decodeIdsReport(
        await runJson(product, workspace, ["ids", "--json"], idsContext),
        idsContext,
      );

      const createContext =
        `${label} \`review create --strategy audit --name n --json\` — the ` +
        `occupant obstructs the session write: exit 1, exactly one ` +
        `condition-22 finding concerning .xspec/reviews, locations [] ` +
        `(SPEC 10.1, 14.22)`;
      assertExactlyOneFinding(
        await runFindingsReport(
          product,
          workspace,
          [
            "review",
            "create",
            "--strategy",
            "audit",
            "--name",
            T10_1_6_NEW_SESSION,
            "--json",
          ],
          1,
          createContext,
        ),
        "14.22",
        REVIEWS_DIR,
        createContext,
      );
    },
    `${label}: nothing is written — the occupant byte-unchanged, the link ` +
      `and its target byte-identical, nothing written through it, and no ` +
      `session file anywhere (SPEC 10.1, 13.4, 14.22)`,
  );
}

/**
 * The one refusal finding a stale twin's `create` reports: a condition of
 * 14 with the path it concerns — condition 22's obstructed session
 * directory `.xspec/reviews` (14.22), condition 21's corrupt session file
 * `.xspec/reviews/<name>.json` (SPEC 14, 12.7, 10.1) — or the code-less
 * existing-name refusal of 10.7, asserted in T10.7-14's finding form
 * through the shared check (support.ts `expectReviewRefusal`): `code` and
 * `path` `null` — 14 gives a review-operation refusal neither location nor
 * concerned path — `locations` `[]`, and the existing session's file
 * byte-identical around the run.
 */
type ExpectedRefusal =
  | { readonly identity: "14.21" | "14.22"; readonly concernedPath: string }
  | { readonly identity: "(code-less)" };

/**
 * Where a change around a refused `create` falls, for its diagnosis: graph
 * data — T13.3-2's operational path set (`isGraphDataKey`, the
 * record-staging adapter layer's one predicate), which the refresh of 13.3
 * writes — the session directory (a session file written or changed, or
 * the occupant altered), or the rest of the workspace.
 */
function refusedCreateChangeClass(key: string): string {
  if (isGraphDataKey(key)) {
    return (
      "graph data (T13.3-2's operational path set): the refresh of 13.3, " +
      "made before the examination of the session directory"
    );
  }
  if (key === REVIEWS_DIR || key.startsWith(`${REVIEWS_DIR}/`)) {
    return (
      "the session directory: a session file written or changed, or the " +
      "occupant altered"
    );
  }
  return "outside graph data and the session directory";
}

/**
 * `create`'s ordering on a stale twin (SPEC 10.7, 13.5, 14.22): a section's
 * text is edited after `build`, no read run since, then `create --name
 * <name>` is refused — the one finding of `expected` (condition 22, the
 * code-less existing-name refusal in T10.7-14's finding form, or condition
 * 21 in its place), exit 1.
 * `create` examines the session directory past the gate and before any
 * write, the refresh of 13.3 included, and the outcome it meets there ends
 * it, modifying nothing: the whole-root compare around `create` admits no
 * change, H-6 leaving out the lock path alone — graph data (T13.3-2's
 * operational path set) byte-identical and so still stale, no session file
 * written or changed, the occupant byte-unchanged — each change diagnosed
 * by where it falls (`refusedCreateChangeClass`), a graph-data change as
 * the refresh a product makes before it examines the session directory.
 * `check` afterwards reports the graph-data unit form, the edited source's
 * per-file staleness, and exactly `besideStaleness` beside them, exit 1
 * (`assertStaleTwinStillStale`) — where a product refreshing before it
 * examines the session directory leaves graph data refreshed (no unit form
 * then reported).
 */
async function assertCreateRefusedStaleStaysStale(
  product: ProductBinding,
  workspace: TestWorkspace,
  name: string,
  expected: ExpectedRefusal,
  besideStaleness: Readonly<Record<string, number>>,
  label: string,
): Promise<void> {
  await workspace.file("specs/A.mdx", A_MDX_EDITED);
  const argv = ["review", "create", "--strategy", "audit", "--name", name];
  const onTwin =
    `on the stale twin — exit 1 with the one refusal finding, met at the ` +
    `examination of the session directory past the gate and before any ` +
    `write (SPEC 10.7, 14.22, 14.21, 10.1)`;
  const before = await snapshotDirectory(workspace.root);
  if (expected.identity === "(code-less)") {
    await expectReviewRefusal(
      product,
      workspace,
      argv,
      sessionRel(name),
      `${label} [${onTwin}]`,
    );
  } else {
    const createContext = `${label} \`${[...argv, "--json"].join(" ")}\` ${onTwin}`;
    assertExactlyOneFinding(
      await runFindingsReport(
        product,
        workspace,
        [...argv, "--json"],
        1,
        createContext,
      ),
      expected.identity,
      expected.concernedPath,
      createContext,
    );
  }
  const after = await snapshotDirectory(workspace.root);
  const changes = diffSnapshots(before, after);
  if (changes.length > 0) {
    const refreshed = changes.some((change) => isGraphDataKey(change.key));
    fail(
      `${label}: the refused \`create\` on a stale twin modifies nothing — ` +
        `it examines the session directory past the gate and before any ` +
        `write, the refresh of 13.3 included, and the outcome it meets ` +
        `there ends it (SPEC 10.7, 13.5, 13.3, 14.22): graph data ` +
        `(T13.3-2's operational path set) byte-identical and still stale, ` +
        `no session file written or changed, the occupant byte-unchanged` +
        (refreshed
          ? ` — graph data changed: a product refreshing before it ` +
            `examines the session directory leaves graph data refreshed`
          : "") +
        `; found ${String(changes.length)} change(s), H-6 leaving out the ` +
        `lock path alone:\n` +
        changes
          .map(
            (change) =>
              `  ${change.change} ${change.path} ` +
              `[${refusedCreateChangeClass(change.key)}]: ${change.detail}`,
          )
          .join("\n"),
    );
  }
  const checkContext = `${label} \`check --json\` after the refused \`create\``;
  assertStaleTwinStillStale(
    await runFindingsReport(
      product,
      workspace,
      ["check", "--json"],
      1,
      `${checkContext} — graph data and the edited source's generated ` +
        `module are stale, so \`check\` exits 1 (SPEC 12.2, 14.10)`,
    ),
    besideStaleness,
    checkContext,
  );
}

/**
 * The graph-data area's own path occupied by a non-directory (SPEC 13.4,
 * 14.22, 14.23), nothing being read below it — the link staging's journal
 * garbage line (14.13) and corrupt session (14.21) never surfacing:
 * `inventory` meets condition 23 in its record-supplied datum — `recorded`
 * explicitly unavailable, `journal` exactly `{"path": ".xspec/journal",
 * "occupied": false}` and `sessions` [], that one finding concerning
 * `.xspec`, exit 1 (11.6, 12.7); `build`, `ids`, and `review list` each
 * refuse on `build`'s obstructed graph-data write path — exactly one
 * condition-22 finding concerning `.xspec`, the gate's report for the reads
 * (13.3), exit 1; `check` reports that finding beside condition 10 in the
 * unreadable-record unit form and nothing else (14.10, 14.23: reported
 * whatever the workspace's validity); `impact --base c1` resolves the
 * baseline first — `c1`'s tree holds no journal and the current journal
 * below the occupant is empty (6.1, 6.3, 13.4) — and the gate then reports
 * exactly that condition-22 finding, exit 1, never `journal-error`'s exit 2
 * (6.3, 12.0, 13.3); and `view` of a clean file answers finding-free (11.2,
 * T11.2-6). One whole-root compare around the sweep, `.git/` included:
 * nothing written, the link's target byte-identical. Exported for
 * T13.4-13(d) (section-13.4-ii.ts), which runs this sweep with a FIFO at
 * `.xspec` on `stageT1016AreaWorkspace`'s staging (SPEC 13.4: any other
 * non-directory occupant).
 */
export async function assertAreaOccupied(
  product: ProductBinding,
  workspace: TestWorkspace,
  c1: string,
  label: string,
): Promise<void> {
  await assertLeavesUnchanged(
    workspace.root,
    async () => {
      const inventoryContext =
        `${label} \`inventory --json\` — the area's own path holds no ` +
        `directory: recorded unavailable with the one condition-23 ` +
        `finding, exit 1 (SPEC 11.6, 14.23, 13.4)`;
      const inventoryRun = await expectExit(
        product,
        workspace,
        ["inventory", "--json"],
        1,
        inventoryContext,
      );
      const inventory = decodeInventoryDocument(
        parseJsonStdout(inventoryRun, inventoryContext),
        inventoryContext,
      );
      assertExactlyOneFinding(
        inventory.findings,
        "14.23",
        GRAPH_DATA_AREA_PATH,
        `${inventoryContext} — that finding alone, concerning the area`,
      );
      assertSameJson(
        inventory.recorded,
        { state: "unavailable" },
        `${inventoryContext} — the record-supplied datum is reported ` +
          `explicitly unavailable, never read as an empty record (SPEC ` +
          `14.23, 11.6)`,
      );
      assertSameJson(
        inventory.journal,
        { path: T10_1_6_JOURNAL_PATH, occupied: false },
        `${inventoryContext} — the journal member is exactly ` +
          `{"path": "${T10_1_6_JOURNAL_PATH}", "occupied": false}: the ` +
          `journal path, unoccupied to the inventory below an area path ` +
          `holding no directory, its content never read (SPEC 11.6, 12.7, ` +
          `13.4)`,
      );
      assertSameJson(
        inventory.sessions,
        [],
        `${inventoryContext} — no session while the area's own path holds ` +
          `no directory (SPEC 11.6, 10.1)`,
      );

      for (const argv of [["build"], ["ids"], ["review", "list"]] as const) {
        const context =
          `${label} \`${argv.join(" ")} --json\` — a directory component ` +
          `of graph data's write path is occupied by a non-directory: ` +
          `exactly one condition-22 finding concerning .xspec, exit 1, ` +
          `nothing written (SPEC 14.22, 13.3, 13.4)`;
        assertExactlyOneFinding(
          await runFindingsReport(
            product,
            workspace,
            [...argv, "--json"],
            1,
            context,
          ),
          "14.22",
          GRAPH_DATA_AREA_PATH,
          context,
        );
      }

      const checkContext =
        `${label} \`check --json\` — the obstructed graph-data write path ` +
        `beside condition 10 in the unreadable-record unit form, and ` +
        `nothing else (SPEC 14.22, 14.10, 14.23, 12.2)`;
      const checkFindings = await runFindingsReport(
        product,
        workspace,
        ["check", "--json"],
        1,
        checkContext,
      );
      assertConditionCounts(
        checkFindings,
        { "14.22": 1, "14.10": 1 },
        checkContext,
      );
      for (const finding of checkFindings) {
        assertFindingConcernsPath(
          finding,
          GRAPH_DATA_AREA_PATH,
          finding.condition === "14.22"
            ? `${checkContext}: the offending component's ` +
                `workspace-relative path (SPEC 14.22, 13.4)`
            : `${checkContext}: the unit form's concerned path is the ` +
                `graph-data area, no path inside it named (SPEC 14.10, ` +
                `14.23, 11.6)`,
        );
        assertSameJson(
          finding.locations,
          [],
          `${checkContext}: a path-concerned condition is unlocated — ` +
            `locations [] (SPEC 12.7)`,
        );
        if (finding.condition === "14.10" && !/build/i.test(finding.message)) {
          fail(
            `${checkContext}: the unit form instructs rebuilding (SPEC ` +
              `14.10) — any message naming \`build\` qualifies (H-3); got ` +
              JSON.stringify(finding.message),
          );
        }
      }

      const impactContext =
        `${label} \`impact --base c1 --json\` — the baseline resolves ` +
        `first, its journal and the current one both empty: c1's tree ` +
        `holds none, and below the area's occupant nothing is read, the ` +
        `journal there empty (SPEC 6.3, 6.1, 13.4) — so the gate then ` +
        `reports exactly that condition-22 finding concerning .xspec, exit ` +
        `1, nothing written (SPEC 13.3, 14.22), never journal-error's exit ` +
        `2 (a given baseline's resolution reads the current journal before ` +
        `any other cause can fail it, 6.3)`;
      assertExactlyOneFinding(
        await runFindingsReport(
          product,
          workspace,
          ["impact", "--base", c1, "--json"],
          1,
          impactContext,
        ),
        "14.22",
        GRAPH_DATA_AREA_PATH,
        impactContext,
      );

      const viewContext =
        `${label} \`view specs/A.mdx --json\` — \`view\` answers from the ` +
        `current sources: the clean file finding-free, exit 0 (SPEC 11.2, ` +
        `T11.2-6)`;
      const view = decodeViewReport(
        await runJson(
          product,
          workspace,
          ["view", "specs/A.mdx", "--json"],
          viewContext,
        ),
        { text: false },
        viewContext,
      );
      assertSameJson(view.findings, [], `${viewContext}: findings`);
    },
    `${label}: nothing is written — the occupant byte-unchanged, the link ` +
      `and its target byte-identical, nothing written through it (SPEC ` +
      `14.22, 13.4)`,
  );
}

/**
 * The audit session `s`'s two items the area stagings' `resolve` and
 * `split` name (SPEC 10.6: one `subtree-coherence` item per requirement
 * node, each blocked by its child sections' items).
 */
export interface T1016Items {
  /** The leaf section's item, unblocked, so `resolve` applies (10.6, 10.7). */
  readonly leaf: string;
  /** `a`'s item, its scope root holding a child, so `split` applies (10.7). */
  readonly parent: string;
}

/**
 * `review status s --json` while the area is still a directory: the items
 * of `s` scoped at `specs/A.mdx#<leafId>` and at `specs/A.mdx#a`, each
 * exactly one (SPEC 10.6: audit items are all `subtree-coherence`, so scope
 * alone is unique), else a diagnosed failure.
 */
async function readT1016Items(
  product: ProductBinding,
  workspace: TestWorkspace,
  leafId: string,
  label: string,
): Promise<T1016Items> {
  const context =
    `${label} \`review status s --json\` — the items \`resolve\` and ` +
    `\`split\` name, read while the area is a directory (SPEC 10.7)`;
  const status = decodeSessionStatusReport(
    await runJson(
      product,
      workspace,
      ["review", "status", T10_1_6_SESSION, "--json"],
      context,
    ),
    context,
  );
  const itemScopedAt = (scope: string): string => {
    const rows = status.items.filter((row) => row.scope === scope);
    if (rows.length !== 1) {
      fail(
        `${context}: expected exactly one item scoped at ${scope} — audit ` +
          `creates one per requirement node (SPEC 10.6); found ` +
          `${String(rows.length)} among ` +
          JSON.stringify(status.items.map((row) => row.scope)),
      );
    }
    return rows[0]!.id;
  };
  return {
    leaf: itemScopedAt(`specs/A.mdx#${leafId}`),
    parent: itemScopedAt("specs/A.mdx#a"),
  };
}

/** What each `.xspec` staging hands its arms. */
export interface T1016AreaStaging {
  /** The audit session `s`'s items `resolve` and `split` name. */
  readonly items: T1016Items;
  /**
   * The commit `c1`, made before the staging — before the workspace's
   * first `build` — whose tree holds the configuration and `specs/A.mdx`
   * alone, no journal (`impact --base c1`, SPEC 6.3).
   */
  readonly c1: string;
}

/**
 * Make the fresh `CORE_FILES` workspace a git repository and commit `c1`
 * before any product runs, so its tree holds the configuration and sources
 * alone — no journal, no derived file. The tree is checked on the harness
 * before any product runs: anything else in it is machinery misuse, thrown
 * as a plain `Error` — never a diagnosed failure (H-11).
 */
async function commitT1016C1(workspace: TestWorkspace): Promise<string> {
  await workspace.gitInit();
  const c1 = await workspace.gitCommitAll(
    "c1: the configuration and sources alone, no journal",
  );
  const { stdout } = await workspace.git(["ls-tree", "-r", "--name-only", c1]);
  const tree = stdout.split("\n").filter((line) => line !== "");
  const expected = Object.keys(CORE_FILES).sort();
  if (JSON.stringify(tree) !== JSON.stringify(expected)) {
    throw new Error(
      `T10.1-6 staging: c1's tree must hold the configuration and sources ` +
        `alone, no journal — ${JSON.stringify(expected)}; found ` +
        `${JSON.stringify(tree)} (a harness staging error, not a product ` +
        `observation)`,
    );
  }
  return c1;
}

/**
 * Append T6.1-3's garbage line, as its own line, to the journal the
 * product's journaled operation wrote — read as a plain file first, its
 * final line terminated first if the product left the terminator off, so
 * the tampering is a whole-line append under either line convention
 * (shape-independent, H-4). A journal that is not a plain file holding at
 * least one entry fails diagnosed: the operation brings the journal into
 * existence with its entry (SPEC 6.1, 13.4).
 */
async function appendJournalGarbageLine(
  workspace: TestWorkspace,
  context: string,
): Promise<void> {
  const held = await workspace.kind(T10_1_6_JOURNAL_PATH);
  if (held !== "file") {
    fail(
      `${context}: the journaled operation brings the journal into ` +
        `existence as a plain file at ${T10_1_6_JOURNAL_PATH} (SPEC 6.1, ` +
        `13.4); found ${held}`,
    );
  }
  const written = Buffer.from(await workspace.readBytes(T10_1_6_JOURNAL_PATH));
  if (written.length === 0) {
    fail(
      `${context}: the journaled operation appends its entry, one line, to ` +
        `the journal (SPEC 6.1); ${T10_1_6_JOURNAL_PATH} is empty`,
    );
  }
  const needsTerminator = written[written.length - 1] !== 0x0a;
  await workspace.file(
    T10_1_6_JOURNAL_PATH,
    Buffer.concat([
      written,
      Buffer.from(
        `${needsTerminator ? "\n" : ""}${T10_1_6_JOURNAL_GARBAGE_LINE}\n`,
        "utf8",
      ),
    ]),
  );
}

/**
 * The plain-file staging of the graph-data area's own path up to its
 * occupant (`withT1016AreaStagings`), on a fresh `CORE_FILES` workspace: a
 * git repository holding `c1` first (`commitT1016C1`), then built, then
 * holding the audit session `s`, created while the area is a directory, its
 * items read (`readT1016Items`). Returns the items and `c1`. Exported for
 * T13.4-13(d) (section-13.4-ii.ts), which stages a FIFO at `.xspec` in the
 * plain file's place and runs this arm's commands there.
 */
export async function stageT1016AreaWorkspace(
  product: ProductBinding,
  workspace: TestWorkspace,
  label: string,
): Promise<T1016AreaStaging> {
  const c1 = await commitT1016C1(workspace);
  await buildOk(product, workspace, `${label} \`build\``);
  await expectExit(
    product,
    workspace,
    T10_1_6_CREATE_S,
    0,
    `${label} \`review create --strategy audit --name s\` — the session ` +
      `whose items \`resolve\` and \`split\` name (SPEC 10.1)`,
  );
  const items = await readT1016Items(product, workspace, "a.k", label);
  return { items, c1 };
}

/**
 * T10.1-6's two stagings of the graph-data area's own path, each on a fresh
 * `CORE_FILES` workspace made a git repository holding `c1` first
 * (`commitT1016C1`), then built — the derived files exist and match, so
 * `check` meets no per-file staleness beside the two findings the staging
 * pins — and holding the audit session `s`, created while the area was a
 * directory, its items read before the area is occupied:
 * - `.xspec` a plain file, replacing the area's directory and all it held
 *   (`stageT1016AreaWorkspace`, then the occupant);
 * - `.xspec` a symbolic link to a directory holding a journal the product
 *   wrote with a garbage line appended and, under `reviews/`, valid
 *   sessions beside a corrupt one: a journaled rename (`a.k` to `a.k2`)
 *   brings the journal into existence (SPEC 6.1) and regenerates, `create`
 *   writes `s` and `t`, the items are read, the garbage line is appended
 *   (`appendJournalGarbageLine`, T6.1-3's malformed journal) and a corrupt
 *   `c.json` of garbage bytes staged beside the sessions (T10.1-4's
 *   unparseable state), and the area is then relocated beside the link,
 *   inside the root (`elsewhere-area`) — so a read through the link would
 *   meet 14.13 and, at `check`, 14.21.
 * `arms` runs on each, given the staging's items and `c1` and its label.
 * Exported for scratch probes that run one arm alone (the CONF-CORE
 * reference serves the mutating commands but not `inventory` or `view`).
 */
export async function withT1016AreaStagings(
  product: ProductBinding,
  arms: (
    workspace: TestWorkspace,
    staging: T1016AreaStaging,
    label: string,
  ) => Promise<void>,
): Promise<void> {
  await withWorkspace(CORE_FILES, async (workspace) => {
    const label = "T10.1-6 [.xspec: plain file]";
    const staging = await stageT1016AreaWorkspace(product, workspace, label);
    await stageNonDirectoryOccupant(
      workspace,
      GRAPH_DATA_AREA_PATH,
      T10_1_6_PLAIN_FILE,
    );
    await arms(workspace, staging, label);
  });
  await withWorkspace(CORE_FILES, async (workspace) => {
    const label =
      "T10.1-6 [.xspec: symbolic link to a directory holding a journal with a garbage line appended and, under reviews/, s.json and t.json beside a corrupt c.json]";
    const c1 = await commitT1016C1(workspace);
    await buildOk(product, workspace, `${label} \`build\``);
    await expectExit(
      product,
      workspace,
      ["rename", "specs/A.mdx", "a.k", "a.k2"],
      0,
      `${label} \`rename specs/A.mdx a.k a.k2\` — the journal the link's ` +
        `target then holds (SPEC 6.1, 6.4)`,
    );
    await expectExit(
      product,
      workspace,
      T10_1_6_CREATE_S,
      0,
      `${label} \`review create --strategy audit --name s\` — a valid ` +
        `session the link's target then holds (SPEC 10.1)`,
    );
    await expectExit(
      product,
      workspace,
      [
        "review",
        "create",
        "--strategy",
        "audit",
        "--name",
        T10_1_6_SECOND_SESSION,
      ],
      0,
      `${label} \`review create --strategy audit --name ` +
        `${T10_1_6_SECOND_SESSION}\` — the other valid session the link's ` +
        `target then holds (SPEC 10.1)`,
    );
    const items = await readT1016Items(product, workspace, "a.k2", label);
    await appendJournalGarbageLine(
      workspace,
      `${label} staging the journal's garbage line`,
    );
    // Shape-independent corruption (module header): unparseable bytes at a
    // session-named path beside the valid sessions (SPEC 10.1, 14.21).
    await workspace.file(
      sessionRel(T10_1_6_CORRUPT_SESSION),
      NON_SESSION_GARBAGE,
    );
    await stageNonDirectoryOccupant(
      workspace,
      GRAPH_DATA_AREA_PATH,
      T10_1_6_AREA_LINK,
    );
    await arms(workspace, { items, c1 }, label);
  });
}

/** One of T10.1-6's mutating commands: its description and arguments. */
interface T1016MutatingCommand {
  readonly what: string;
  readonly argv: (items: T1016Items) => readonly string[];
}

/**
 * Every mutating command (SPEC 13.5: `rename` and `move`, previews
 * excepted, and the mutating `review` subcommands `create`, `resolve`, and
 * `split`), each an operation valid on its staging as it stood before the
 * area was occupied — `rename` of `a` and the file form of `move` of
 * `specs/A.mdx`, an audit session `n` no session holds, and `resolve` and
 * `split` naming `s`'s leaf and parent items — so that each refusal is the
 * occupied area's alone, met at acquisition before any argument check, the
 * gate, and the refresh (13.5, 12.0).
 */
const T10_1_6_MUTATING: readonly T1016MutatingCommand[] = [
  {
    what: "`rename specs/A.mdx a a2`",
    argv: () => ["rename", "specs/A.mdx", "a", "a2"],
  },
  {
    what: "`move specs/A.mdx specs/B.mdx`",
    argv: () => ["move", "specs/A.mdx", "specs/B.mdx"],
  },
  {
    what: "`review create --strategy audit --name n`",
    argv: () => [
      "review",
      "create",
      "--strategy",
      "audit",
      "--name",
      T10_1_6_NEW_SESSION,
    ],
  },
  {
    what: "`review resolve s <leaf item> --status no-change`",
    argv: (items) => [
      "review",
      "resolve",
      T10_1_6_SESSION,
      items.leaf,
      "--status",
      "no-change",
    ],
  },
  {
    what: "`review split s <parent item>`",
    argv: (items) => ["review", "split", T10_1_6_SESSION, items.parent],
  },
];

/**
 * Every mutating command fails at acquisition first on an area path holding
 * no directory (SPEC 10.1, 13.5: where the area's own path holds anything
 * but a directory, a symbolic link included, whatever it targets,
 * acquisition removes nothing but fails with the write failure of 14.24,
 * leaving the occupant for manual deletion, 13.4; TEST-SPEC T13.5-10(a)):
 * each of `T10_1_6_MUTATING` under `--json` exits 2 with the error
 * document's `code` `"write-failure"`, `path` `".xspec"`, `locations` `[]`,
 * and writes nothing — a whole-root compare bracketing that run alone: the
 * plain file byte-unchanged, the link and its target (inside the root)
 * byte-identical, nothing written through the link. Exported with
 * `withT1016AreaStagings` for scratch probes.
 */
export async function assertMutatingCommandsFailAtAcquisition(
  product: ProductBinding,
  workspace: TestWorkspace,
  items: T1016Items,
  label: string,
): Promise<void> {
  for (const command of T10_1_6_MUTATING) {
    const context =
      `${label} ${command.what} --json — every mutating command fails at ` +
      `acquisition first on the area's own path holding no directory ` +
      `(SPEC 10.1, 13.5, 14.24; T13.5-10(a))`;
    await assertLeavesUnchanged(
      workspace.root,
      async () => {
        const result = await expectExit(
          product,
          workspace,
          [...command.argv(items), "--json"],
          2,
          `${context}: acquisition removes nothing and fails with the write ` +
            `failure of 14.24 — a usage error, exit 2 — before the argument ` +
            `checks, the gate, and the refresh, so no mutating command ` +
            `proceeds without exclusivity (SPEC 13.5, 12.0)`,
        );
        const finding = expectErrorDocument(result, context);
        assertSameJson(
          {
            code: finding.code,
            path: finding.path,
            locations: finding.locations,
          },
          {
            code: WRITE_FAILURE_CODE,
            path: GRAPH_DATA_AREA_PATH,
            locations: [],
          },
          `${context}: the error document carries acquisition's write ` +
            `failure — the stable code "${WRITE_FAILURE_CODE}", the ` +
            `concerned path "${GRAPH_DATA_AREA_PATH}" (the area's own ` +
            `path), and no locations (SPEC 13.5, 12.7, 14.24; \`message\` ` +
            `and \`identities\` informational) — message: ` +
            JSON.stringify(finding.message),
        );
      },
      `${context}: nothing written — the plain file byte-unchanged, the ` +
        `link and its target byte-identical, nothing written through the ` +
        `link (SPEC 13.5, 13.4; the compare bracketing this run alone)`,
    );
  }
}

const T10_1_6 = defineProductTest({
  id: "T10.1-6",
  title:
    "session-directory and area occupancy; `create`'s ordering: `.xspec/reviews` absent on a freshly built valid workspace (`build` bringing none into existence) holds no sessions and its nonexistence is never a refused read — `list` none, exit 0, and `status`, `next`, `show`, `export`, `resolve`, and `split` naming `x` each exit 2 as an unknown session (`code` and `path` `null`, never `read-failure`), none bringing `.xspec/reviews` into existence; `.xspec/reviews` occupied by a plain file, or by a symbolic link to a directory holding a valid session `s.json` beside a corrupt `c.json` of garbage bytes, holds no sessions (`list` none, `status s` exit 2, `check` clean, `inventory` sessions [], `ids` answers) and `create` is refused with one condition-22 finding concerning `.xspec/reviews`, nothing written; on stale twins the refused `create` — condition 22, the code-less existing-name refusal (in T10.7-14's finding form: `code` and `path` `null`, `locations` `[]`), or condition 21 in its place — is met at the examination of the session directory past the gate and before any write, the refresh included, and modifies nothing: stale graph data stays stale (graph data byte-identical around it, `check` then reporting the edited source's per-file staleness beside the graph-data unit form; no session written or changed); `.xspec` occupied by a plain file, or by a symbolic link to a directory holding a journal the product wrote with a garbage line appended and, under `reviews/`, valid sessions beside a corrupt one, each workspace a git repository whose commit `c1` holds the configuration and sources alone: nothing read below the occupant — `inventory` `journal` exactly `.xspec/journal` unoccupied, `sessions` [], and recorded unavailable with the one condition-23 finding, `build`/`ids`/`review list` one condition-22 finding concerning `.xspec`, `check` that finding beside the unreadable-record unit form, `impact --base c1` exit 1 with exactly that condition-22 finding, the baseline resolving first with both journals empty, never `journal-error`'s exit 2, `view` finding-free — and every mutating command — `rename`, `move`, `review create`, `resolve`, `split` — failing at acquisition first: exit 2, the error document's `code` `write-failure`, `path` `.xspec`, nothing written, the plain file byte-unchanged, the link and its target byte-identical (6.1, 6.3, 10.1, 10.7, 11.6, 12.7, 13.3–13.5, 14, 14.10, 14.13, 14.21–14.25)",
  run: async (product) => {
    // --- The session directory absent on a freshly built valid workspace:
    // no session has been created, so `build` leaves `.xspec/reviews`
    // absent (SPEC 10.1); `x` names no session, its nonexistence never a
    // refused read (14.25).
    await withWorkspace(CORE_FILES, async (workspace) => {
      const label = "T10.1-6 [.xspec/reviews: absent]";
      await buildOk(product, workspace, `${label} \`build\``);
      await assertSessionDirectoryAbsent(product, workspace, label);
    });

    // --- Session-directory occupancy on a freshly built valid workspace --
    // Plain file: no session has been created, so `.xspec/reviews` is
    // absent after `build` (SPEC 10.1) and the plain file takes its path.
    await withWorkspace(CORE_FILES, async (workspace) => {
      const label = "T10.1-6 [.xspec/reviews: plain file]";
      await buildOk(product, workspace, `${label} \`build\``);
      await stageNonDirectoryOccupant(
        workspace,
        REVIEWS_DIR,
        T10_1_6_PLAIN_FILE,
      );
      await assertSessionDirectoryOccupied(product, workspace, label);
    });
    // Symbolic link: the product writes `s` first and a corrupt `c.json`
    // of garbage bytes is staged beside it (T10.1-4's unparseable state,
    // shape-independent, staged directly); the session directory is then
    // relocated outside the area and linked from its path, so the link's
    // target holds the valid product-written `s.json` beside `c.json` — a
    // read of sessions through the link would surface `c` as 14.21.
    await withWorkspace(CORE_FILES, async (workspace) => {
      const label =
        "T10.1-6 [.xspec/reviews: symbolic link to a directory holding s.json beside a corrupt c.json]";
      await buildOk(product, workspace, `${label} \`build\``);
      await expectExit(
        product,
        workspace,
        T10_1_6_CREATE_S,
        0,
        `${label} \`review create --strategy audit --name s\` — the valid ` +
          `session the link's target then holds (SPEC 10.1)`,
      );
      await workspace.file(
        sessionRel(T10_1_6_CORRUPT_SESSION),
        NON_SESSION_GARBAGE,
      );
      await stageNonDirectoryOccupant(
        workspace,
        REVIEWS_DIR,
        T10_1_6_REVIEWS_LINK,
      );
      await assertSessionDirectoryOccupied(product, workspace, label);
    });

    // --- Ordering: `create` examines the session directory past the gate
    // and before any write, the refresh of 13.3 included, and the outcome
    // it meets there ends it, modifying nothing (SPEC 10.7, 13.5) — three
    // stale twins, each one's graph data staying stale.
    await withWorkspace(CORE_FILES, async (workspace) => {
      const label = "T10.1-6 [stale twin, .xspec/reviews: plain file]";
      await buildOk(product, workspace, `${label} \`build\``);
      await stageNonDirectoryOccupant(
        workspace,
        REVIEWS_DIR,
        T10_1_6_PLAIN_FILE,
      );
      await assertCreateRefusedStaleStaysStale(
        product,
        workspace,
        T10_1_6_NEW_SESSION,
        { identity: "14.22", concernedPath: REVIEWS_DIR },
        {},
        label,
      );
    });
    await withWorkspace(CORE_FILES, async (workspace) => {
      const label = "T10.1-6 [stale twin holding a valid s]";
      await buildOk(product, workspace, `${label} \`build\``);
      await expectExit(
        product,
        workspace,
        T10_1_6_CREATE_S,
        0,
        `${label} \`review create --strategy audit --name s\` (SPEC 10.1)`,
      );
      await assertCreateRefusedStaleStaysStale(
        product,
        workspace,
        T10_1_6_SESSION,
        { identity: "(code-less)" },
        {},
        label,
      );
    });
    await withWorkspace(CORE_FILES, async (workspace) => {
      const label = "T10.1-6 [stale twin holding a corrupt s]";
      await buildOk(product, workspace, `${label} \`build\``);
      await expectExit(
        product,
        workspace,
        T10_1_6_CREATE_S,
        0,
        `${label} \`review create --strategy audit --name s\` (SPEC 10.1)`,
      );
      // Shape-independent corruption (module header): unparseable bytes
      // over the product-written session (SPEC 14.21).
      await workspace.file(sessionRel(T10_1_6_SESSION), NON_SESSION_GARBAGE);
      await assertCreateRefusedStaleStaysStale(
        product,
        workspace,
        T10_1_6_SESSION,
        { identity: "14.21", concernedPath: sessionRel(T10_1_6_SESSION) },
        { "14.21": 1 },
        label,
      );
    });

    // --- The graph-data area's own path (SPEC 6.3, 13.4, 13.5,
    // 14.22–14.24) --- Each staging (`withT1016AreaStagings`, each
    // workspace a git repository holding `c1`: a plain file, and a
    // symbolic link to the relocated area holding the journal with its
    // garbage line and the sessions `s` and `t` beside the corrupt `c`):
    // the reads', `build`'s, and `impact --base c1`'s sweep, then every
    // mutating command refused at acquisition first.
    await withT1016AreaStagings(product, async (workspace, staging, label) => {
      await assertAreaOccupied(product, workspace, staging.c1, label);
      await assertMutatingCommandsFailAtAcquisition(
        product,
        workspace,
        staging.items,
        label,
      );
    });
  },
});

/** TEST-SPEC §10.1, in canonical ID order (SUITE-33). */
export const section101Tests: readonly ProductTestEntry[] = [
  T10_1_1,
  T10_1_2,
  T10_1_3,
  T10_1_4,
  T10_1_5,
  T10_1_6,
];
