// TEST-SPEC §10.7 (review commands), third part: T10.7-13 (the metadata
// pair) and T10.7-14 (the refusal finding form). T10.7-1…T10.7-6 are
// section-10.7-i.ts's business, and T10.7-7…T10.7-12 section-10.7-ii.ts's.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), decodes output through the H-3 adapters,
// and rejects a product only via diagnosed assertion failures (H-8).
//
// SPEC 10.7 (T10.7-13): a `metadata-consistency` item's payload — `next
// --json`, and identically `show` and `export` — carries its scope node's
// metadata pair, a before/after pair under the origin-text rule: before,
// the node's `d` targets, coverage attribute, and tags (5.5) in the item's
// baseline state (10.2: in a baseline session the recorded baseline graph);
// after, in the current graph; each `d` target under its current identity
// (10.4); a side whose graph state lacks the node presented absent, carrying
// no metadata. The coverage attribute and the tags take 12.7's value forms.
//
// Conservative operationalizations for T10.7-13 (noted per H-3/H-4):
// - The pair decodes through the review adapter (helpers/adapters/review.ts:
//   required on every `metadata-consistency` item, failing loudly when
//   absent; its member layout the adapter's assumed shape, H-3), the
//   coverage attribute and the tags decoded literally there — the string
//   "required" or "none", a tag set in byte order with duplicates collapsed
//   (12.7; T12.7-1) — so a product carrying either in another form fails at
//   the decode. Each side is then asserted exactly: its presence, its `d`
//   targets compared as a set (10.7 fixes no order for them), its coverage
//   attribute, and its tags.
// - Each item is asserted identically through the three surfaces: `export`
//   (the item found by kind and scope node), `show` of that item's id, and
//   `next --json`. Where an arm's session holds two items (b), `next` is
//   walked: whichever item it returns is asserted and resolved `no-change`
//   (which never re-derives, SPEC 10.5), and the next read must return the
//   other — so no item order is assumed (10.5's business).
// - Each arm first asserts, from `export`, the item set its one edit yields —
//   a staging premise (SPEC 5.5, 5.6, 10.5: metadata-changed nodes alone; no
//   node changed; no dependency edge to a target whose effectiveHash
//   changed; a coverage- or tags-only edit propagating nothing) — so `next`
//   can only return the arm's items.
// - Three path-blocks workspaces (`review create --base <baseline commit>`),
//   one session `s` each; every edit is followed by an explicit `build`
//   before any read, so no read relies on the 13.3 refresh path; (c)'s
//   `rename` finishes by regenerating derived files as `build` does (6.4).
//   (a) and (d) share specs/M.mdx's workspace, (d) after (a)'s assertions;
//   the context is asserted where the entry states it — (a), (b), (c) — and
//   (d) asserts the pair alone.
// - Staged-source records (helpers/staged-mdx.ts, helpers/staged-ts.ts;
//   S-9): the configuration shared by the three workspaces (`M13_CONFIG`),
//   (d)'s deletion of m's section, and the (b) and (c) workspaces' initial
//   sources and edits — all staged after the body's first invocation, or as
//   initial files of a workspace created after it. The first workspace's
//   initial spec source and (a)'s edit, staged before any invocation (git
//   staging invokes no product), stay plain strings.
//
// SPEC 10.7 (T10.7-14): `review create` with the name of an existing
// session — a name matching one ignoring ASCII case counting, at `create`,
// as that session's (10.1) — `resolve` of a blocked item, and `split` of an
// item of any other kind or of a `subtree-coherence` item whose scope root
// has no children are refused, each refusal one finding, exit 1, modifying
// nothing (13.5). SPEC 14: a review-operation refusal carries no stable
// code, and neither location nor concerned path — `locations` empty, `path`
// `null` (12.7); a refused operation's report is the findings-only form
// `{"findings": […]}` (12.7).
//
// Conservative operationalizations for T10.7-14 (noted per H-3/H-4):
// - Every refusal runs through the shared check (support.ts
//   `expectReviewRefusal`), the one each of the refusal's home tests runs
//   too (T10.1-2, T10.1-6, T10.3-2, T10.7-1, T10.7-9, T10.7-10): the command
//   run with `--json`, exit 1, standard output exactly `{"findings": [f]}`
//   decoded form-exact (H-3: the one member; `f` exactly the five members
//   `code`, `message`, `locations`, `path`, `identities`), `code` `null`,
//   `locations` `[]`, `path` `null`, and `identities` an array of strings
//   (the decode's) whose content is informational (12.7) and not asserted;
//   the session file the refusal names byte-identical around the run. That
//   is T10.7-14's whole compare: the whole-root "nothing modified" is its
//   home tests' (the sites above pass the shared check's option).
// - One audit session `s` (no baseline, so no git) over one file carries
//   every refusal the entry lists, each staged as its home test stages it:
//   `create` naming `s` exactly and as `S` (ASCII case alone; T10.7-1,
//   T10.1-2); `resolve` of p's item, blocked by p.a's unresolved item
//   (audit blocking, SPEC 10.6; T10.7-10), and of p's `parent-consistency`
//   item, blocked by p.a's resolved item once that item reads `invalidated`
//   (re-blocking, SPEC 10.3, 10.4; T10.3-2); `split` of p.a's item, a
//   leaf's (no children), of p's `parent-consistency` item (another kind),
//   and of t's item once t's only child t.u has been deleted by manual edit
//   after `create` (no children now; T10.7-9). p's `parent-consistency` item
//   comes from splitting p's item (SPEC 10.7: the scope root's
//   `parent-consistency` item, blocked by the child items). Each premise the
//   staging relies on — the blocked states and the decomposition's item — is
//   asserted from `review status --json` before the refusal it serves
//   (diagnosed, H-8).
// - The one edit (p.a's text, and t.u deleted) is followed by an explicit
//   `build` before any read, so no read or refusal meets stale graph data
//   (the refresh path is T13.3's business, and refusals beside it T10.1-6's).
//   It is staged after the body's first invocation, so it is a staged-source
//   record (helpers/staged-mdx.ts, S-9); the initial file and configuration
//   of the body's one workspace, created before any invocation, stay plain
//   strings.

import type {
  CoverageAttributeValue,
  ExportReport,
  ItemKind,
  MetadataSide,
  NextReport,
  ReviewItem,
  SessionStatusReport,
  SessionStatusRow,
} from "../../helpers/adapters/index.js";
import {
  decodeExportReport,
  decodeItemReport,
  decodeNextReport,
  decodeSessionStatusReport,
} from "../../helpers/adapters/index.js";
import { fail } from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { stagedMdx } from "../../helpers/staged-mdx.js";
import { stagedTs } from "../../helpers/staged-ts.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { InitialFileContents } from "../../helpers/workspace.js";
import {
  assertSameJson,
  buildOk,
  expectExit,
  expectReviewRefusal,
  runJson,
} from "./support.js";

// ---------------------------------------------------------------------------
// T10.7-13 — metadata pair
// ---------------------------------------------------------------------------

// Minimal declarative configuration (SPEC 7): exactly one spec group. A
// staged-source record (S-9): the (b) and (c) workspaces are created after
// the body's first invocation.
const M13_CONFIG = stagedTs(
  "T10.7-13 xspec.config.ts — one spec group",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
);

/** The session every arm creates, one per workspace (SPEC 10.1). */
const M13_SESSION = "s";

// Arms (a) and (d): specs/M.mdx — `m` and the unedited targets t1, t2, t3.
const M13_M_FILE = "specs/M.mdx";
const M13_M = "specs/M.mdx#m";
const M13_M_T1 = "specs/M.mdx#t1";
const M13_M_T2 = "specs/M.mdx#t2";
const M13_M_T3 = "specs/M.mdx#t3";

/**
 * specs/M.mdx: at the baseline `m`'s `d` names t1 and t2, and `m` spells no
 * `coverage` attribute and spells `tags="b a"`; (a)'s one edit makes it name
 * t2 and t3, spell `coverage="none"`, and spell `tags="c b"` — each tag list
 * spelled out of byte order; (d) deletes m's section, nothing referencing
 * it. The targets stay unedited throughout.
 */
function m13MSpec(state: "baseline" | "edited" | "deleted"): string {
  const opening =
    state === "baseline"
      ? '<S id="m" d={["t1", "t2"]} tags="b a">'
      : '<S id="m" d={["t2", "t3"]} coverage="none" tags="c b">';
  return [
    ...(state === "deleted" ? [] : [opening, "Em own line.", "</S>", ""]),
    '<S id="t1">',
    "Tee one line.",
    "</S>",
    "",
    '<S id="t2">',
    "Tee two line.",
    "</S>",
    "",
    '<S id="t3">',
    "Tee three line.",
    "</S>",
    "",
  ].join("\n");
}

// (d)'s deletion follows the body's first invocation: a staged-source record
// (helpers/staged-mdx.ts, S-9).
const M13_M_DELETED = stagedMdx(
  "T10.7-13 specs/M.mdx with m's section deleted by manual edit (arm (d))",
  m13MSpec("deleted"),
);

// Arm (b): specs/GH.mdx — `g` (its `d` naming the unedited t1 on both
// sides), `h`, and t1.
const M13_GH_FILE = "specs/GH.mdx";
const M13_G = "specs/GH.mdx#g";
const M13_H = "specs/GH.mdx#h";
const M13_GH_T1 = "specs/GH.mdx#t1";

/** specs/GH.mdx: (b)'s edit retags g (`x` to `y`) and gives h `coverage="none"`. */
function m13GhSpec(edited: boolean): string {
  return [
    edited ? '<S id="g" d={"t1"} tags="y">' : '<S id="g" d={"t1"} tags="x">',
    "Gee own line.",
    "</S>",
    "",
    edited ? '<S id="h" coverage="none">' : '<S id="h">',
    "Aitch own line.",
    "</S>",
    "",
    '<S id="t1">',
    "Tee one line.",
    "</S>",
    "",
  ].join("\n");
}

// The (b) workspace is created after the body's first invocation, so its
// initial source and its edit are staged-source records (S-9).
const M13_GH_BASELINE = stagedMdx(
  "T10.7-13 specs/GH.mdx at the baseline (arm (b): g tagged x, h spelling no coverage attribute)",
  m13GhSpec(false),
);
const M13_GH_EDITED = stagedMdx(
  "T10.7-13 specs/GH.mdx after arm (b)'s edit (g tagged y, h spelling coverage none)",
  m13GhSpec(true),
);

// Arm (c): specs/K.mdx — `k` and t4, renamed t9 after `create`.
const M13_K_FILE = "specs/K.mdx";
const M13_K = "specs/K.mdx#k";
const M13_K_T9 = "specs/K.mdx#t9";

/** specs/K.mdx: at the baseline k's `d` names t4; (c)'s edit removes it. */
function m13KSpec(withReference: boolean): string {
  return [
    withReference ? '<S id="k" d={"t4"}>' : '<S id="k">',
    "Kay own line.",
    "</S>",
    "",
    '<S id="t4">',
    "Tee four line.",
    "</S>",
    "",
  ].join("\n");
}

// The (c) workspace is created after the body's first invocation: its
// initial source and its edit are staged-source records (S-9).
const M13_K_BASELINE = stagedMdx(
  "T10.7-13 specs/K.mdx at the baseline (arm (c): k's d naming t4)",
  m13KSpec(true),
);
const M13_K_EDITED = stagedMdx(
  "T10.7-13 specs/K.mdx with k's reference to t4 removed (arm (c), before create)",
  m13KSpec(false),
);

/** What one side of a metadata pair must present (SPEC 10.7; T10.7-13). */
type M13SideExpectation =
  | { readonly present: false }
  | {
      readonly present: true;
      readonly d: readonly string[];
      readonly coverage: CoverageAttributeValue;
      readonly tags: readonly string[];
    };

/** One `metadata-consistency` item's expected pair (and context). */
interface M13Expectation {
  /** The item, for diagnoses (`m`); the context names the arm. */
  readonly label: string;
  /** The item's scope node — its current identity (SPEC 10.4). */
  readonly scope: string;
  /** The context identity set, where the entry states it (SPEC 10.5). */
  readonly context?: readonly string[];
  readonly before: M13SideExpectation;
  readonly after: M13SideExpectation;
}

/** A `d` target list as a set (SPEC 10.7 fixes no order for them). */
function m13TargetSet(targets: readonly string[]): readonly string[] {
  return [...new Set(targets)].sort();
}

/** Assert one side of a decoded metadata pair exactly (SPEC 10.7, 12.7). */
function m13AssertSide(
  side: MetadataSide,
  expected: M13SideExpectation,
  label: "before" | "after",
  scope: string,
  where: string,
): void {
  const state =
    label === "before" ? "the item's baseline state" : "the current graph";
  const what = `the ${label} side of ${scope}'s metadata pair`;
  if (!expected.present) {
    if (side.present) {
      fail(
        `${where}: ${what} is the absent side — ${state} lacks the node, so ` +
          `the side is presented absent, carrying no metadata (SPEC 10.7); ` +
          `got ${JSON.stringify(side)}`,
      );
    }
    return;
  }
  if (!side.present) {
    fail(
      `${where}: ${what} must be present, carrying the node's metadata in ` +
        `${state}, which contains the node (SPEC 10.7); got the absent side`,
    );
  }
  assertSameJson(
    m13TargetSet(side.d),
    m13TargetSet(expected.d),
    `${where}: ${what} — the node's \`d\` targets in ${state}, each under ` +
      `its current identity, compared as a set (SPEC 10.7, 10.4: 10.7 fixes ` +
      `no order for them)`,
  );
  assertSameJson(
    side.coverage,
    expected.coverage,
    `${where}: ${what} — the node's coverage attribute in ${state}, in ` +
      `12.7's value form: "required" for a section spelling no \`coverage\` ` +
      `attribute, "none" for one spelling coverage="none" (SPEC 2.5, 10.7, ` +
      `12.7)`,
  );
  assertSameJson(
    side.tags,
    expected.tags,
    `${where}: ${what} — the node's tags in ${state}, a 12.7 tag set in ` +
      `byte order whatever the spelled order (SPEC 2.6, 10.7, 12.7)`,
  );
}

/**
 * Assert a decoded item is the expected `metadata-consistency` item and
 * presents the expected context (where stated) and metadata pair, read
 * through `surface` (SPEC 10.7: one payload rule for `next --json`, `show`,
 * and `export`).
 */
function m13AssertItem(
  item: ReviewItem,
  expected: M13Expectation,
  surface: string,
  context: string,
): void {
  const where = `${context} ${expected.label} [${surface}]`;
  if (
    item.kind !== "metadata-consistency" ||
    item.scope.node !== expected.scope
  ) {
    fail(
      `${where}: expected ${expected.scope}'s metadata-consistency item ` +
        `(SPEC 10.5: one per metadata-changed node); got the ${item.kind} ` +
        `item ${item.id} scoped at ${item.scope.node}`,
    );
  }
  if (expected.context !== undefined) {
    assertSameJson(
      item.context.map((state) => state.node).sort(),
      [...expected.context].sort(),
      `${where}: the item's context — the added and removed \`d\` targets, ` +
        `each presented under its current identity (SPEC 10.5, 10.7, 10.4)`,
    );
  }
  const pair = item.metadata;
  if (pair === undefined) {
    // Unreachable through the adapter, which requires the pair on this kind.
    fail(
      `${where}: a metadata-consistency item's payload carries its scope ` +
        `node's metadata pair (SPEC 10.7)`,
    );
  }
  m13AssertSide(pair.before, expected.before, "before", expected.scope, where);
  m13AssertSide(pair.after, expected.after, "after", expected.scope, where);
}

/** `review export s --json`, decoded (SPEC 10.7). */
async function m13Export(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
): Promise<ExportReport> {
  const label = `${context} \`review export ${M13_SESSION} --json\``;
  return decodeExportReport(
    await runJson(
      product,
      workspace,
      ["review", "export", M13_SESSION, "--json"],
      label,
    ),
    label,
  );
}

/** `review next s --json`, decoded (SPEC 10.7). */
async function m13Next(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
): Promise<NextReport> {
  const label = `${context} \`review next ${M13_SESSION} --json\``;
  return decodeNextReport(
    await runJson(
      product,
      workspace,
      ["review", "next", M13_SESSION, "--json"],
      label,
    ),
    label,
  );
}

/**
 * Assert every expected item through `export` and `show`, then through a
 * `next --json` walk, after asserting from `export` that the session holds
 * exactly the expected items (the staging premise). The walk asserts
 * whichever expected item `next` returns and, while another remains,
 * resolves it `no-change` — which never re-derives (SPEC 10.5) — so no item
 * order is assumed; the last item returned stays as it was.
 */
async function m13AssertSurfaces(
  product: ProductBinding,
  workspace: TestWorkspace,
  expectations: readonly M13Expectation[],
  premise: string,
  context: string,
): Promise<void> {
  const exported = await m13Export(product, workspace, context);
  assertSameJson(
    exported.items.map((item) => `${item.kind} ${item.scope.node}`).sort(),
    expectations
      .map((expected) => `metadata-consistency ${expected.scope}`)
      .sort(),
    `${context} staging premise: the session's items — ${premise}`,
  );
  const ids = new Map<string, M13Expectation>();
  for (const expected of expectations) {
    const item = exported.items.find(
      (candidate) => candidate.scope.node === expected.scope,
    );
    if (item === undefined) {
      // Unreachable past the premise, which found every expected item.
      fail(`${context}: no item scoped at ${expected.scope} in \`export\``);
    }
    m13AssertItem(item, expected, "`review export --json`", context);
    const showLabel = `${context} \`review show ${M13_SESSION} ${item.id} --json\``;
    m13AssertItem(
      decodeItemReport(
        await runJson(
          product,
          workspace,
          ["review", "show", M13_SESSION, item.id, "--json"],
          showLabel,
        ),
        showLabel,
      ),
      expected,
      "`review show --json`",
      context,
    );
    ids.set(item.id, expected);
  }
  for (let step = 1; ids.size > 0; step += 1) {
    const label = `${context} (\`next\` read ${String(step)})`;
    const next = await m13Next(product, workspace, label);
    if (next.fullyResolved || next.item === undefined) {
      fail(
        `${label}: the session still holds needing-review unblocked items ` +
          `${JSON.stringify([...ids.keys()])} — metadata-consistency items, ` +
          `unresolved and blocked by nothing — so \`next\` returns one ` +
          `(SPEC 10.3, 10.5, 10.7); got the fully-resolved report`,
      );
    }
    const expected = ids.get(next.item.id);
    if (expected === undefined) {
      fail(
        `${label}: \`next\` returned item ${next.item.id}, not one of the ` +
          `items still needing review ${JSON.stringify([...ids.keys()])} ` +
          `(SPEC 10.7)`,
      );
    }
    m13AssertItem(next.item, expected, "`review next --json`", context);
    ids.delete(next.item.id);
    if (ids.size > 0) {
      await expectExit(
        product,
        workspace,
        [
          "review",
          "resolve",
          M13_SESSION,
          next.item.id,
          "--status",
          "no-change",
        ],
        0,
        `${label} \`review resolve ${M13_SESSION} ${next.item.id} --status ` +
          `no-change\` — unblocked, so resolved (SPEC 10.7)`,
      );
    }
  }
}

/**
 * Stage a git workspace holding `xspec.config.ts` and one spec source,
 * commit it as the baseline, apply the arm's one edit, `build`, and create
 * the path-blocks session `s` against the baseline commit (SPEC 10.7); run
 * `body`, then dispose (H-1).
 */
async function withM13Session(
  product: ProductBinding,
  file: string,
  baseline: InitialFileContents,
  edit: (workspace: TestWorkspace) => Promise<void>,
  context: string,
  body: (workspace: TestWorkspace) => Promise<void>,
): Promise<void> {
  const workspace = await TestWorkspace.create({
    files: { "xspec.config.ts": M13_CONFIG, [file]: baseline },
  });
  try {
    await workspace.gitInit();
    const base = await workspace.gitCommitAll("baseline");
    await edit(workspace);
    await buildOk(product, workspace, `${context} \`build\` after the edit`);
    await expectExit(
      product,
      workspace,
      ["review", "create", "--base", base, "--name", M13_SESSION],
      0,
      `${context} \`review create --base <baseline> --name ${M13_SESSION}\``,
    );
    await body(workspace);
  } finally {
    await workspace.dispose();
  }
}

/** m's expected before side — its metadata at the baseline — in (a) and (d). */
const M13_M_BEFORE: M13SideExpectation = {
  present: true,
  d: [M13_M_T1, M13_M_T2],
  coverage: "required",
  tags: ["a", "b"],
};

const T10_7_13 = defineProductTest({
  id: "T10.7-13",
  title:
    'metadata pair: a `metadata-consistency` item\'s payload — `next --json`, and identically `show` and `export` — carries its scope node\'s metadata pair, a before/after pair under the origin-text rule: before, the node\'s `d` targets, coverage attribute, and tags in the item\'s baseline state; after, in the current graph; each `d` target under its current identity; a side whose graph state lacks the node presented absent, carrying no metadata; the coverage attribute `"required"` or `"none"` and the tags a tag set in byte order (12.7\'s value forms), the `d` targets compared as a set — (a) m\'s `d` t1 and t2 → t2 and t3, no `coverage` → `coverage="none"`, `tags="b a"` → `tags="c b"`: context exactly {t1, t3}, before `d` {t1, t2}, `"required"`, `["a", "b"]`, after `d` {t2, t3}, `"none"`, `["b", "c"]`; (b) a tags-only edit on g and a coverage-only edit on h: each context empty, g\'s sides differing in tags alone, h\'s in coverage alone; (c) k\'s reference to t4 removed before `create`, t4 then renamed t9 by a journaled `rename`: k\'s context and its before-side `d` targets present t9, never t4; (d) after (a)\'s assertions m\'s section deleted by manual edit: its before side as in (a), its after side absent (SPEC 2.5, 2.6, 5.5, 10.4, 10.5, 10.7, 12.7)',
  run: async (product) => {
    // --- (a) and (d): specs/M.mdx --------------------------------------
    await withM13Session(
      product,
      M13_M_FILE,
      m13MSpec("baseline"),
      async (workspace) => {
        // Staged before the body's first invocation (git staging invokes
        // no product), so a plain string the workspace builder judges.
        await workspace.file(M13_M_FILE, m13MSpec("edited"));
      },
      "T10.7-13 (a)",
      async (workspace) => {
        await m13AssertSurfaces(
          product,
          workspace,
          [
            {
              label: "m",
              scope: M13_M,
              context: [M13_M_T1, M13_M_T3],
              before: M13_M_BEFORE,
              after: {
                present: true,
                d: [M13_M_T2, M13_M_T3],
                coverage: "none",
                tags: ["b", "c"],
              },
            },
          ],
          "m's metadata-consistency item alone: the one edit makes m " +
            "metadata-changed and changes no node's own content, and no " +
            "dependency edge reaches a target whose effectiveHash changed " +
            "(SPEC 5.5, 5.6, 10.5)",
          "T10.7-13 (a)",
        );

        // (d): m's section deleted by manual edit, nothing referencing it.
        await workspace.file(M13_M_FILE, M13_M_DELETED);
        await buildOk(
          product,
          workspace,
          "T10.7-13 (d) `build` after m's deletion",
        );
        await m13AssertSurfaces(
          product,
          workspace,
          [
            {
              label: "m, deleted",
              scope: M13_M,
              before: M13_M_BEFORE,
              after: { present: false },
            },
          ],
          "still m's metadata-consistency item alone: the session changes " +
            "only through mutating subcommands, re-derived at an `updated` " +
            "resolve or a `split` alone (SPEC 10.4, 10.5)",
          "T10.7-13 (d)",
        );
      },
    );

    // --- (b): specs/GH.mdx ---------------------------------------------
    await withM13Session(
      product,
      M13_GH_FILE,
      M13_GH_BASELINE,
      async (workspace) => {
        await workspace.file(M13_GH_FILE, M13_GH_EDITED);
      },
      "T10.7-13 (b)",
      async (workspace) => {
        await m13AssertSurfaces(
          product,
          workspace,
          [
            {
              label: "g",
              scope: M13_G,
              context: [],
              before: {
                present: true,
                d: [M13_GH_T1],
                coverage: "required",
                tags: ["x"],
              },
              after: {
                present: true,
                d: [M13_GH_T1],
                coverage: "required",
                tags: ["y"],
              },
            },
            {
              label: "h",
              scope: M13_H,
              context: [],
              before: {
                present: true,
                d: [],
                coverage: "required",
                tags: [],
              },
              after: {
                present: true,
                d: [],
                coverage: "none",
                tags: [],
              },
            },
          ],
          "g's and h's metadata-consistency items alone: a tags-only and a " +
            "coverage-only edit make each metadata-changed and propagate no " +
            "category (SPEC 5.5, 5.6, 10.5)",
          "T10.7-13 (b)",
        );
      },
    );

    // --- (c): specs/K.mdx ----------------------------------------------
    await withM13Session(
      product,
      M13_K_FILE,
      M13_K_BASELINE,
      async (workspace) => {
        await workspace.file(M13_K_FILE, M13_K_EDITED);
      },
      "T10.7-13 (c)",
      async (workspace) => {
        await expectExit(
          product,
          workspace,
          ["rename", M13_K_FILE, "t4", "t9"],
          0,
          "T10.7-13 (c) `rename specs/K.mdx t4 t9` after `create` — a " +
            "journaled rename, regenerating derived files as `build` does " +
            "(SPEC 6.1, 6.4)",
        );
        await m13AssertSurfaces(
          product,
          workspace,
          [
            {
              label: "k",
              scope: M13_K,
              context: [M13_K_T9],
              before: {
                present: true,
                d: [M13_K_T9],
                coverage: "required",
                tags: [],
              },
              after: {
                present: true,
                d: [],
                coverage: "required",
                tags: [],
              },
            },
          ],
          "k's metadata-consistency item alone: the removed reference makes " +
            "k metadata-changed, and the journaled rename changes no hash and " +
            "re-derives nothing (SPEC 5.6, 6.2, 10.5)",
          "T10.7-13 (c)",
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T10.7-14 — refusal finding form
// ---------------------------------------------------------------------------

// Minimal declarative configuration (SPEC 7): exactly one spec group.
const R14_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`;

const R14_FILE = "specs/A.mdx";
const R14_ROOT = "specs/A.mdx";
const R14_P = "specs/A.mdx#p";
const R14_PA = "specs/A.mdx#p.a";
const R14_T = "specs/A.mdx#t";
const R14_TU = "specs/A.mdx#t.u";

/** The session every refusal names, and its file (SPEC 10.1). */
const R14_SESSION = "s";
const R14_SESSION_REL = `.xspec/reviews/${R14_SESSION}.json`;

/**
 * `specs/A.mdx`: top-level `p` holding the leaf `p.a`, and top-level `t`
 * holding the leaf `t.u`; `edited` gives p.a its v2 text and deletes t.u.
 */
function r14Spec(edited: boolean): string {
  return [
    '<S id="p">',
    "Parent text.",
    "",
    '<S id="p.a">',
    edited ? "Kid text v2." : "Kid text.",
    "</S>",
    "</S>",
    "",
    '<S id="t">',
    "Holder text.",
    ...(edited ? [] : ["", '<S id="t.u">', "Lost text.", "</S>"]),
    "</S>",
    "",
  ].join("\n");
}

// The body's one edit, staged after its first invocation: a staged-source
// record (helpers/staged-mdx.ts; S-9's before-any-product clause).
const R14_EDITED = stagedMdx(
  "T10.7-14 specs/A.mdx with p.a's text at v2 and t.u deleted",
  r14Spec(true),
);

/** `review status s --json`, decoded (SPEC 10.7). */
async function r14Status(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
): Promise<SessionStatusReport> {
  const label = `${context} \`review status ${R14_SESSION} --json\``;
  return decodeSessionStatusReport(
    await runJson(
      product,
      workspace,
      ["review", "status", R14_SESSION, "--json"],
      label,
    ),
    label,
  );
}

/**
 * The unique status row for a kind and scope node, diagnosed loudly when
 * missing or duplicated (SPEC 10.1, 10.5: at most one item per kind and
 * scope node).
 */
function r14Row(
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
  return rows[0]!;
}

/** A staging premise on one row's status and blocked state (diagnosed). */
function r14ExpectRowState(
  row: SessionStatusRow,
  expected: { readonly status: string; readonly blocked: boolean },
  why: string,
  context: string,
): void {
  assertSameJson(
    { status: row.status, blocked: row.blocked },
    expected,
    `${context} staging premise: the ${row.kind} item scoped at ` +
      `${row.scope} — ${why}`,
  );
}

const T10_7_14 = defineProductTest({
  id: "T10.7-14",
  title:
    'refusal finding form: each review-operation refusal — `create` naming an existing session exactly, and matching it ignoring ASCII case alone; `resolve` of a blocked item, its blocker unresolved and, re-blocked, `invalidated`; `split` of an item of another kind, and of a `subtree-coherence` item whose scope root has no children, a leaf\'s and one whose only child was deleted by manual edit after `create` — run with `--json` exits 1 with standard output exactly `{"findings": [f]}`, `f` exactly `{"code", "message", "locations", "path", "identities"}` with `code` `null`, `locations` `[]`, `path` `null`, and `identities` an array of strings, its content not asserted; the session file stays byte-identical (SPEC 10.1, 10.3, 10.4, 10.6, 10.7, 12.7, 14)',
  run: async (product) => {
    const workspace = await TestWorkspace.create({
      files: { "xspec.config.ts": R14_CONFIG, [R14_FILE]: r14Spec(false) },
    });
    try {
      const prefix = "T10.7-14";
      await buildOk(product, workspace, `${prefix} \`build\``);
      await expectExit(
        product,
        workspace,
        ["review", "create", "--strategy", "audit", "--name", R14_SESSION],
        0,
        `${prefix} \`review create --strategy audit --name ${R14_SESSION}\``,
      );
      const initial = await r14Status(product, workspace, prefix);
      const pRow = r14Row(initial, "subtree-coherence", R14_P, prefix);
      const paRow = r14Row(initial, "subtree-coherence", R14_PA, prefix);
      const tRow = r14Row(initial, "subtree-coherence", R14_T, prefix);
      r14Row(initial, "subtree-coherence", R14_ROOT, prefix);
      r14Row(initial, "subtree-coherence", R14_TU, prefix);
      r14ExpectRowState(
        pRow,
        { status: "unresolved", blocked: true },
        "blocked by its child section's unresolved item, p.a's (SPEC 10.3, " +
          "10.6)",
        prefix,
      );
      r14ExpectRowState(
        paRow,
        { status: "unresolved", blocked: false },
        "a leaf's item, blocked by nothing (SPEC 10.6)",
        prefix,
      );

      // `create` naming the existing session — exactly, then matching it
      // ignoring ASCII case alone (SPEC 10.1, 10.7).
      await expectReviewRefusal(
        product,
        workspace,
        ["review", "create", "--strategy", "audit", "--name", R14_SESSION],
        R14_SESSION_REL,
        `${prefix} [create naming the existing session s exactly]`,
      );
      await expectReviewRefusal(
        product,
        workspace,
        ["review", "create", "--strategy", "audit", "--name", "S"],
        R14_SESSION_REL,
        `${prefix} [create naming S, matching the existing session s ` +
          `ignoring ASCII case alone]`,
      );

      // `resolve` of a blocked item: p's, its blocker p.a's item unresolved.
      await expectReviewRefusal(
        product,
        workspace,
        ["review", "resolve", R14_SESSION, pRow.id, "--status", "no-change"],
        R14_SESSION_REL,
        `${prefix} [resolve of p's item, blocked by p.a's unresolved item]`,
      );

      // `split` of a subtree-coherence item whose scope root has no
      // children: p.a's, a leaf's.
      await expectReviewRefusal(
        product,
        workspace,
        ["review", "split", R14_SESSION, paRow.id],
        R14_SESSION_REL,
        `${prefix} [split of p.a's item, a leaf's: its scope root has no ` +
          `children]`,
      );

      // Splitting p's item yields p's parent-consistency item, blocked by
      // the per-child item — p.a's, reused (SPEC 10.7).
      await expectExit(
        product,
        workspace,
        ["review", "split", R14_SESSION, pRow.id],
        0,
        `${prefix} \`review split ${R14_SESSION} <p's item>\` — p has a ` +
          `child, so the split is performed (SPEC 10.7)`,
      );
      const afterSplit = await r14Status(
        product,
        workspace,
        `${prefix} after p's split`,
      );
      const pcRow = r14Row(
        afterSplit,
        "parent-consistency",
        R14_P,
        `${prefix} after p's split`,
      );
      r14ExpectRowState(
        pcRow,
        { status: "unresolved", blocked: true },
        "the decomposition's parent-consistency item, entering unresolved " +
          "and blocked by the per-child item, p.a's (SPEC 10.2, 10.7)",
        `${prefix} after p's split`,
      );

      // `split` of an item of another kind: p's parent-consistency item.
      await expectReviewRefusal(
        product,
        workspace,
        ["review", "split", R14_SESSION, pcRow.id],
        R14_SESSION_REL,
        `${prefix} [split of p's parent-consistency item: an item of ` +
          `another kind]`,
      );

      // Re-blocking (SPEC 10.3, 10.4): p.a's item resolved, then
      // invalidated by its text's edit, re-blocks p's parent-consistency
      // item. The same edit deletes t's only child t.u.
      await expectExit(
        product,
        workspace,
        ["review", "resolve", R14_SESSION, paRow.id, "--status", "no-change"],
        0,
        `${prefix} \`review resolve ${R14_SESSION} <p.a's item> --status ` +
          `no-change\` — unblocked, so resolved (SPEC 10.7)`,
      );
      await workspace.file(R14_FILE, R14_EDITED);
      await buildOk(
        product,
        workspace,
        `${prefix} \`build\` after p.a's edit and t.u's deletion`,
      );
      const afterEdit = await r14Status(
        product,
        workspace,
        `${prefix} after the edit`,
      );
      r14ExpectRowState(
        r14Row(
          afterEdit,
          "subtree-coherence",
          R14_PA,
          `${prefix} after the edit`,
        ),
        { status: "invalidated", blocked: false },
        "resolved, then its scope's subtreeHash changed by the edit " +
          "(SPEC 10.4)",
        `${prefix} after the edit`,
      );
      r14ExpectRowState(
        r14Row(
          afterEdit,
          "parent-consistency",
          R14_P,
          `${prefix} after the edit`,
        ),
        { status: "unresolved", blocked: true },
        "re-blocked by p.a's item, which is invalidated, no resolved status " +
          "(SPEC 10.3)",
        `${prefix} after the edit`,
      );

      // `resolve` of a blocked item: p's parent-consistency item, its
      // blocker resolved and then invalidated.
      await expectReviewRefusal(
        product,
        workspace,
        ["review", "resolve", R14_SESSION, pcRow.id, "--status", "no-change"],
        R14_SESSION_REL,
        `${prefix} [resolve of p's parent-consistency item, re-blocked by ` +
          `p.a's invalidated item]`,
      );

      // `split` of a subtree-coherence item whose scope root has no
      // children now: t's, its only child t.u deleted by manual edit after
      // `create`, though its scope as last assigned still lists t.u.
      await expectReviewRefusal(
        product,
        workspace,
        ["review", "split", R14_SESSION, tRow.id],
        R14_SESSION_REL,
        `${prefix} [split of t's item, its only child t.u deleted after ` +
          `create: its scope root has no children]`,
      );
    } finally {
      await workspace.dispose();
    }
  },
});

/** TEST-SPEC §10.7, third part, in canonical ID order. */
export const section107iiiTests: readonly ProductTestEntry[] = [
  T10_7_13,
  T10_7_14,
];
