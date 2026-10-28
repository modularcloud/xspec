// TEST-SPEC §5.5 (hashes) — SUITE-19: T5.5-1…T5.5-7.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), decodes output through the H-3 adapters,
// and rejects a product only via diagnosed assertion failures (H-8).
//
// SPEC 5.5: every requirement node has four hashes, deterministic for
// identical input. ownHash hashes the own content sequence of 1.6 — byte
// runs (empty runs included) alternating with node references, each
// reference entering as its target's canonical identity (5.4), child and
// embedding references distinguished. subtreeHash = hash(ownHash, child
// subtreeHashes in document order). effectiveHash = hash(ownHash, child
// effectiveHashes, the node's dependency edges as (canonical identity,
// effectiveHash) pairs sorted by canonical identity — one pair per EDGE, not
// per distinct target). metadataHash = hash(`d`-declared target set sorted
// the same way, coverage attribute, sorted tags). The inputs are framed, so
// distinct sequences of components — runs, identities, hashes — never yield
// the same input (T5.5-7).
//
// Hash values themselves are opaque: every assertion is a self-comparison —
// changed / byte-identical across a staged edit, or equal across identically
// staged inputs (H-4). Where SPEC.md fixes bytes (the 1.6/3 text values that
// anchor the line-drop-toggle arm), the expectation is the hand-derived byte
// string from the fixture's known source.
//
// Conservative operationalizations (noted per H-4):
// - "Repositioned between runs" (T5.5-2) is staged as the sharpest instance:
//   two embeddings of distinct targets exchange positions around
//   byte-identical runs, so the own-content byte runs and the reference
//   multiset are both unchanged and only the positions differ — a product
//   hashing references position-insensitively reports no change.
// - Impact entries follow the suite's fixed T1.5-1 interpretation (SPEC 9.3
//   groups output by category): "no change categories" is asserted as an
//   empty `requirements` list; the kind-distinction arm (T5.5-2) and
//   T5.5-7's edits assert that the edited node carries its category
//   (`changed`, `metadata-changed`) in some entry naming it, none reporting
//   it deleted, without pinning the 9.3 entry-collapsing conventions
//   (SUITE-32's business).
// - T5.5-4's twin fixture asserts its stated precondition as a control: two
//   byte-identical dependency-free targets have equal effectiveHash
//   (deterministic hash of identical input, SPEC 5.5), so the retarget
//   comparison isolates the identity component of the target pairs.
// - T5.5-5's tie-break arm runs on T5.4-1's first fixture, from
//   section-5.4.ts's own constants: its baseline, the journaled
//   `rename specs/A.mdx a b` vacating `a`, and then the file as that fixture
//   stands after N2 is authored — a conforming rename's minimal in-place
//   rewrite (SPEC 6.4) and T5.4-1's manual edits, composed — beside a node
//   `h` declaring `d={["b", "a"]}`, one spelling per bearer of the identity
//   string `a`. Like T5.5-2's kind arm after its move, the arm stages that
//   file whole, a staged-source record, rather than editing the product's
//   rewrite, so the reorder that follows is a record too (S-9: judged before
//   any product exists); the journal entry, opaque (SPEC 6.1), is the
//   rename's own. Every node's hashes are compared, the node set pinned by
//   `query nodes`, `h`'s first: a product breaking the identity-string tie
//   by source order changes `h`'s metadataHash and effectiveHash, and its
//   ancestors' effectiveHashes after them.

import type {
  ImpactReport,
  NodeHashes,
  NodeReport,
} from "../../helpers/adapters/index.js";
import {
  decodeImpactReport,
  decodeNodeReport,
  decodeNodeRowsReport,
} from "../../helpers/adapters/index.js";
import {
  assertBytesEqual,
  assertExitCode,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { assertAcrossDirectoriesDeterministic } from "../../helpers/determinism.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { stagedMdx } from "../../helpers/staged-mdx.js";
import type { StagedMdx } from "../../helpers/staged-mdx.js";
import { stagedTs } from "../../helpers/staged-ts.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { InitialFileContents } from "../../helpers/workspace.js";
import {
  REINTRO_APPENDED,
  REINTRO_BASELINE,
  REINTRO_DEP,
  REINTRO_E,
  REINTRO_F,
  REINTRO_G,
  REINTRO_N1,
  REINTRO_N2,
  REINTRO_ROOT,
} from "./section-5.4.js";
import {
  assertSameJson,
  buildOk,
  expectExit,
  runJson,
  sortedIdentities,
} from "./support.js";

// Minimal declarative configuration (SPEC 7): exactly one spec group. No code
// groups exist in any fixture here, so impacted code never enters play.
// T5.5-2, T5.5-5, and T5.5-7 stage it again in workspaces created after
// their first invocations — T5.5-2's kind-distinction workspace, T5.5-5's
// tie-break workspace, T5.5-7's arm (b) — so it is a staged-source record
// (S-9's timing clause; test/self/s9-staged-sources.test.ts).
const SPECS_ONLY_CONFIG = stagedTs(
  "T5.5-2/T5.5-5/T5.5-7 xspec.config.ts — exactly one spec group, every workspace's",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
);

// Every `.mdx` source a body below stages after its base-state `build` — an
// arm's variant, an edited fixture — is a staged-source record created at
// module load from the same template call the staging used, so that the S-9
// self-test (test/self/s9-staged-sources.test.ts) judges it well-formed
// before any product exists; the initial `files` of each workspace stay
// plain contents (S-7's sweep reaches them against the stub).

/** An arm's variant as a staged-source record, named with the arm's label. */
interface StagedArm {
  readonly label: string;
  readonly source: StagedMdx;
}

/** Stage a fresh spec-only workspace, run `body`, dispose (H-1). */
async function withWorkspace<T>(
  files: Readonly<Record<string, InitialFileContents>>,
  body: (workspace: TestWorkspace) => Promise<T>,
): Promise<T> {
  const workspace = await TestWorkspace.create({
    files: { "xspec.config.ts": SPECS_ONLY_CONFIG, ...files },
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

/** The four hashes of one node via `query node` (SPEC 5.5, 11). */
async function queryHashes(
  product: ProductBinding,
  workspace: TestWorkspace,
  identity: string,
  context: string,
): Promise<NodeHashes> {
  return (await queryNode(product, workspace, identity, context)).hashes;
}

/** All four hashes of several nodes, keyed by identity. */
async function queryHashesOf(
  product: ProductBinding,
  workspace: TestWorkspace,
  identities: readonly string[],
  context: string,
): Promise<Record<string, NodeHashes>> {
  const hashes: Record<string, NodeHashes> = {};
  for (const identity of identities) {
    hashes[identity] = await queryHashes(product, workspace, identity, context);
  }
  return hashes;
}

/** Assert an opaque hash value changed across an edit (H-4: self-compare). */
function assertHashChanged(
  before: string,
  after: string,
  what: string,
  context: string,
): void {
  if (before === after) {
    fail(
      `${context}: ${what} must change across the edit (SPEC 5.5), but it is ` +
        `byte-identical: ${JSON.stringify(before)}`,
    );
  }
}

/** Assert an opaque hash value is byte-identical across an edit. */
function assertHashStable(
  before: string,
  after: string,
  what: string,
  context: string,
): void {
  if (before !== after) {
    fail(
      `${context}: ${what} must be byte-identical across the edit (SPEC 5.5), ` +
        `but it changed: ${JSON.stringify(before)} -> ${JSON.stringify(after)}`,
    );
  }
}

/**
 * `impact --base <ref> --json`: exit 0 (impact is informational, SPEC 9.3;
 * H-5) with exactly one JSON document, decoded as the impact report (H-3).
 */
async function impactAgainst(
  product: ProductBinding,
  workspace: TestWorkspace,
  ref: string,
  context: string,
): Promise<ImpactReport> {
  const result = await expectExit(
    product,
    workspace,
    ["impact", "--base", ref, "--json"],
    0,
    context,
  );
  return decodeImpactReport(parseJsonStdout(result, context), context);
}

/**
 * Assert the workspace's full node-identity set via `query nodes` (SPEC 11) —
 * the guard that makes a "full-workspace" hash comparison genuine: the
 * comparison walks exactly the enumerated nodes, so none escapes it, and a
 * rename/move producing unexpected identities fails diagnosed here.
 */
async function assertIdentitySet(
  product: ProductBinding,
  workspace: TestWorkspace,
  expected: readonly string[],
  context: string,
): Promise<void> {
  const label = `${context} \`query nodes\``;
  const rows = decodeNodeRowsReport(
    await runJson(product, workspace, ["query", "nodes"], label),
    label,
  );
  assertSameJson(
    sortedIdentities(rows),
    [...expected].sort(),
    `${context} the workspace's full node-identity set (SPEC 1.5, 11)`,
  );
}

// ---------------------------------------------------------------------------
// Shared rich fixture (T5.5-1, T5.5-6): three cross-referencing files
// exercising every hash input — children, embeddings, `d` references in both
// external and local form, tags, a coverage attribute, and imports.
// ---------------------------------------------------------------------------

const RICH_FILES: Readonly<Record<string, string>> = {
  "specs/A.mdx": [
    'import B from "./B.xspec"',
    "",
    '<S id="a" tags="alpha beta">',
    "Alpha intro.",
    "",
    '<S id="a.kid" d={[B.tgt, "solo"]}>',
    "Kid text. {text(B.tgt)}",
    "</S>",
    "</S>",
    "",
    '<S id="solo" coverage="none">',
    "Solo text.",
    "</S>",
    "",
  ].join("\n"),
  "specs/B.mdx": ['<S id="tgt">', "Target text.", "</S>", ""].join("\n"),
  "specs/C.mdx": [
    'import A from "./A.xspec"',
    "",
    '<S id="ref" d={A.a}>',
    "Refers. {text(A.a.kid)}",
    "</S>",
    "",
  ].join("\n"),
};

/** Every node of the rich fixture (two roots would be too few: all 8). */
const RICH_IDENTITIES: readonly string[] = [
  "specs/A.mdx",
  "specs/A.mdx#a",
  "specs/A.mdx#a.kid",
  "specs/A.mdx#solo",
  "specs/B.mdx",
  "specs/B.mdx#tgt",
  "specs/C.mdx",
  "specs/C.mdx#ref",
];

// ---------------------------------------------------------------------------
// T5.5-1 — reporting and determinism
// ---------------------------------------------------------------------------

const T5_5_1 = defineProductTest({
  id: "T5.5-1",
  title:
    "`query node` reports all four hashes for every node, and rebuilding the identical workspace in a fresh directory yields identical hashes — the H-6 two-directory protocol over a fixture exercising children, embeddings, `d` references, tags, and coverage (SPEC 5.5, 11)",
  run: async (product) => {
    const created: TestWorkspace[] = [];
    try {
      const { first, second, firstWorkspace, secondWorkspace } =
        await assertAcrossDirectoriesDeterministic({
          makeWorkspace: async () => {
            const workspace = await TestWorkspace.create({
              files: { "xspec.config.ts": SPECS_ONLY_CONFIG, ...RICH_FILES },
            });
            created.push(workspace);
            return workspace;
          },
          binding: product,
          makeRun: (workspace) => ({ cwd: workspace.root, argv: ["build"] }),
          context: "T5.5-1 H-6 two-directory `build` determinism",
        });
      assertExitCode(first, 0, "T5.5-1 `build` in directory 1");
      assertExitCode(second, 0, "T5.5-1 `build` in directory 2");

      // Reporting: the adapter requires all four hashes on every report
      // (SPEC 5.5, 11) — a missing or empty hash fails decoding, diagnosed.
      // Determinism: identical workspaces hash identically, per node.
      for (const identity of RICH_IDENTITIES) {
        const inFirst = await queryHashes(
          product,
          firstWorkspace,
          identity,
          "T5.5-1 directory 1:",
        );
        const inSecond = await queryHashes(
          product,
          secondWorkspace,
          identity,
          "T5.5-1 directory 2:",
        );
        assertSameJson(
          inSecond,
          inFirst,
          `T5.5-1 all four hashes of ${identity} are identical across the two ` +
            `directories — hashes are deterministic for identical input ` +
            `(SPEC 5.5, H-6)`,
        );
      }
    } finally {
      for (const workspace of created) {
        await workspace.dispose();
      }
    }
  },
});

// ---------------------------------------------------------------------------
// T5.5-2 — ownHash
// ---------------------------------------------------------------------------

// The ownHash-matrix fixture: parent `p` with an embedding between two runs,
// an own-line embedding of the empty-subtree target `t3` (the line-drop
// toggle), a child to edit/remove, a run flanked by two embeddings of
// distinct targets (the reposition arm), two children with byte-identical
// text (the reorder arm), and a trailing run for edits and additions.
interface OwnHashShape {
  readonly firstRun?: string;
  readonly withC1?: boolean;
  readonly c1Text?: string;
  readonly middleRun?: string;
  readonly twinOrder?: readonly [string, string];
  readonly withExtraChild?: boolean;
  readonly tailRun?: string;
  readonly targetText?: string;
  /** `t3`'s body line; omitted = the empty-subtree base state. */
  readonly toggleTargetText?: string;
}

function ownHashSource(shape: OwnHashShape = {}): string {
  const lines: string[] = [
    '<S id="p">',
    shape.firstRun ?? 'run0 {text("t")} run1',
    '{text("t3")}',
  ];
  if (shape.withC1 ?? true) {
    lines.push('<S id="p.c1">', shape.c1Text ?? "Child one.", "</S>");
  }
  lines.push(shape.middleRun ?? 'L {text("t")} M {text("t2")} R');
  for (const twin of shape.twinOrder ?? ["p.c2", "p.c3"]) {
    lines.push(`<S id="${twin}">`, "Twin text.", "</S>");
  }
  if (shape.withExtraChild ?? false) {
    lines.push('<S id="p.c4">', "New child.", "</S>");
  }
  lines.push(shape.tailRun ?? "tail run", "</S>");
  lines.push("", '<S id="t">', shape.targetText ?? "Target one.", "</S>");
  lines.push("", '<S id="t2">', "Target two.", "</S>");
  lines.push("", '<S id="t3">');
  if (shape.toggleTargetText !== undefined) {
    lines.push(shape.toggleTargetText);
  }
  lines.push("</S>", "");
  return lines.join("\n");
}

const OWN_P = "specs/A.mdx#p";
const OWN_C1 = "specs/A.mdx#p.c1";
const OWN_T3 = "specs/A.mdx#t3";

// Hand-derived from ownHashSource() and the removal/replacement/line-drop
// rules of SPEC 3 (both text values are exact bytes, 1.6; H-4). In the base
// state `t3`'s subtree text is empty, so the own-line `{text("t3")}`
// replacement leaves its line empty and the line drops with its terminator.
const OWN_P_SUBTREE_BASE =
  "run0 Target one.\n run1\n" +
  "Child one.\n" +
  "L Target one.\n M Target two.\n R\n" +
  "Twin text.\nTwin text.\n" +
  "tail run\n";

// Toggled: `t3` expands to "Now present.\n", so the embedding line keeps its
// (spliced) content plus its own terminator — the drop no longer applies.
const OWN_P_SUBTREE_TOGGLED =
  "run0 Target one.\n run1\n" +
  "Now present.\n\n" +
  "Child one.\n" +
  "L Target one.\n M Target two.\n R\n" +
  "Twin text.\nTwin text.\n" +
  "tail run\n";

// The changed arms, each staged after the base-state build — a staged-source
// record per row, named with the row's label (S-9).
const ownHashArm = (label: string, shape: OwnHashShape): StagedArm => ({
  label,
  source: stagedMdx(`T5.5-2 ${label}`, ownHashSource(shape)),
});
const OWNHASH_CHANGED_ARMS: readonly StagedArm[] = [
  ownHashArm("an own-text run is edited", { tailRun: "tail run, edited" }),
  ownHashArm("a child is added", { withExtraChild: true }),
  ownHashArm("a child is removed", { withC1: false }),
  ownHashArm(
    "two byte-identical children are reordered (identical text, distinct " +
      "canonical identities at the excision points)",
    { twinOrder: ["p.c3", "p.c2"] },
  ),
  ownHashArm("an embedded reference is added", {
    tailRun: 'tail run {text("t2")}',
  }),
  ownHashArm("an embedded reference is removed", { firstRun: "run0  run1" }),
  ownHashArm("an embedded reference is retargeted", {
    firstRun: 'run0 {text("t2")} run1',
  }),
  ownHashArm(
    "an embedded reference is repositioned between runs (the two " +
      "embeddings exchange positions around byte-identical runs — the run " +
      "bytes and the reference multiset are unchanged, only positions differ)",
    { middleRun: 'L {text("t2")} M {text("t")} R' },
  ),
];

// The unchanged arms and the line-drop toggle, staged after the changed arms
// — staged-source records.
const T5_5_2_CHILD_EDITED = stagedMdx(
  "T5.5-2 specs/A.mdx with the child p.c1's text edited (the unchanged arm)",
  ownHashSource({ c1Text: "Child one, edited." }),
);
const T5_5_2_TARGET_EDITED = stagedMdx(
  "T5.5-2 specs/A.mdx with the embedded target t's text edited (the unchanged arm)",
  ownHashSource({ targetText: "Target one, edited." }),
);
const T5_5_2_TOGGLED = stagedMdx(
  "T5.5-2 specs/A.mdx with the toggle target t3 made non-empty (the line-drop-toggle arm)",
  ownHashSource({ toggleTargetText: "Now present." }),
);

// Kind-distinction fixture, in TEST-SPEC T5.5-2's pinned geometry: the child
// construct and its replacement are in-line — within one line of `p`, flanked
// by content on that line (`foo <S id="p.k">Kid text.</S> baz` at the
// baseline, `foo {text(B.k)} baz` after). A journaled section move relocates
// the child to another file — its own characters deleted in place, the line
// left holding `foo ` and ` baz` (SPEC 6.5) — and a manual edit embeds the
// moved node (imported form) at the child's exact former position. Both
// states compose `p` from the same line head and tail (`kindParent`), so
// every other byte of `p` is identical; the import stands at the file's top,
// outside `p`. The own-content sequences of the two states are then the
// byte-identical runs `foo ` and ` baz` (with the line's terminator) around
// one reference of the same canonical identity (the journal walks B.mdx#k
// back to A.mdx#p.k, SPEC 5.4), differing only in reference kind: child vs
// embedding (SPEC 1.6, 5.5). The geometry is what keeps the arm live: on its
// own lines a construct's straddling lines drop with their terminators
// (SPEC 3), while an own-line `{text(...)}` keeps its line in own content
// (the excised expression counts as remaining line content, SPEC 1.6), so
// the runs would differ as well and a product hashing references
// kind-blindly would pass the arm vacuously.
const KIND_P = "specs/A.mdx#p";
const KIND_LINE_HEAD = "foo ";
const KIND_LINE_TAIL = " baz";
const KIND_CHILD_TEXT = "Kid text.";

/** `specs/A.mdx`'s section `p`, `construct` standing in-line in its one line. */
function kindParent(construct: string): string {
  return [
    '<S id="p">',
    `${KIND_LINE_HEAD}${construct}${KIND_LINE_TAIL}`,
    "</S>",
    "",
  ].join("\n");
}

// `p`'s subtree text in both states (SPEC 1.6 and 3 fix these bytes): its tag
// lines drop with their terminators, and at the construct's position stands
// the child's contribution at the baseline and the embedding's expansion —
// the moved node's subtree text, the same characters — after.
const KIND_P_SUBTREE = `${KIND_LINE_HEAD}${KIND_CHILD_TEXT}${KIND_LINE_TAIL}\n`;
// The kind arm's workspace is created after the matrix workspace's
// invocations: its baseline is a staged-source record (S-9,
// test/self/s9-staged-sources.test.ts).
const KIND_BASELINE = stagedMdx(
  "T5.5-2 specs/A.mdx with the in-line child construct at its position (the kind arm's baseline)",
  kindParent(`<S id="p.k">${KIND_CHILD_TEXT}</S>`),
);
const KIND_MANUAL = stagedMdx(
  "T5.5-2 specs/A.mdx with the moved child embedded in imported form at its former in-line position (the kind arm)",
  ['import B from "./B.xspec"', "", kindParent("{text(B.k)}")].join("\n"),
);

const T5_5_2 = defineProductTest({
  id: "T5.5-2",
  title:
    "ownHash changes when an own-text run is edited, a child is added/removed, two byte-identical children are reordered, or an embedded reference is added/removed/retargeted/repositioned between runs; it is byte-identical when a child's text is edited (only the child's hashes change) and when an embedded target's text is edited — including the own-line embedding whose target toggles between empty and non-empty subtree text, flipping the Markdown line-drop outcome (3) while the excised expression counts as remaining line content (1.6); and a child construct replaced at its exact position by a text(...) embedding of the same canonical identity (journaled move, then imported-form embedding) changes the parent's ownHash and makes it `changed` — child and embedding reference kinds are distinguished (SPEC 1.6, 3, 5.4, 5.5, 5.6)",
  run: async (product) => {
    // --- The ownHash change/no-change matrix ---
    await withWorkspace(
      { "specs/A.mdx": ownHashSource() },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T5.5-2 `build` over the ownHash-matrix base state",
        );
        const base = await queryNode(
          product,
          workspace,
          OWN_P,
          "T5.5-2 base state:",
        );
        // Fixture anchors (SPEC 3, 1.6 fix these bytes): the empty-expansion
        // line-drop applies in the base state, and `t3` is genuinely empty.
        assertBytesEqual(
          base.subtreeText,
          OWN_P_SUBTREE_BASE,
          "T5.5-2 base subtree text of `p` — the own-line embedding of the " +
            "empty-subtree target drops its line (SPEC 3)",
        );
        const t3Base = await queryNode(
          product,
          workspace,
          OWN_T3,
          "T5.5-2 base state:",
        );
        assertBytesEqual(
          t3Base.subtreeText,
          "",
          "T5.5-2 the toggle target `t3` has empty subtree text in the base " +
            "state (SPEC 1.6, 3)",
        );
        const c1Base = await queryHashes(
          product,
          workspace,
          OWN_C1,
          "T5.5-2 base state:",
        );

        // Changed arms: each variant differs from the base in exactly the
        // staged way; the parent's ownHash must differ from the base's.
        for (const arm of OWNHASH_CHANGED_ARMS) {
          await workspace.file("specs/A.mdx", arm.source);
          const after = await queryHashes(
            product,
            workspace,
            OWN_P,
            `T5.5-2 changed arm (${arm.label}):`,
          );
          assertHashChanged(
            base.hashes.ownHash,
            after.ownHash,
            `the parent's ownHash when ${arm.label}`,
            "T5.5-2",
          );
        }

        // Unchanged: a child's text is edited — only the child's hashes
        // change; the parent's own content holds the child as an identity at
        // an excision point, not its text (SPEC 1.6, 5.5).
        await workspace.file("specs/A.mdx", T5_5_2_CHILD_EDITED);
        const childEditContext = "T5.5-2 unchanged arm (child's text edited)";
        const pAfterChildEdit = await queryHashes(
          product,
          workspace,
          OWN_P,
          `${childEditContext}:`,
        );
        assertHashStable(
          base.hashes.ownHash,
          pAfterChildEdit.ownHash,
          "the parent's ownHash when a child's text is edited",
          childEditContext,
        );
        const c1AfterEdit = await queryHashes(
          product,
          workspace,
          OWN_C1,
          `${childEditContext}:`,
        );
        assertHashChanged(
          c1Base.ownHash,
          c1AfterEdit.ownHash,
          "the edited child's ownHash",
          childEditContext,
        );
        assertHashChanged(
          c1Base.subtreeHash,
          c1AfterEdit.subtreeHash,
          "the edited child's subtreeHash",
          childEditContext,
        );

        // Unchanged: an embedded target's text is edited (non-empty to
        // non-empty) — the target's text is no part of the embedder's own
        // content (SPEC 1.6).
        await workspace.file("specs/A.mdx", T5_5_2_TARGET_EDITED);
        const targetEditAfter = await queryHashes(
          product,
          workspace,
          OWN_P,
          "T5.5-2 unchanged arm (embedded target's text edited):",
        );
        assertHashStable(
          base.hashes.ownHash,
          targetEditAfter.ownHash,
          "the embedder's ownHash when an embedded target's text is edited",
          "T5.5-2 unchanged arm (embedded target's text edited)",
        );

        // The mandated line-drop-toggle arm: `t3` toggles empty →
        // non-empty, flipping the Markdown line-drop outcome of the own-line
        // embedding (SPEC 3) — visible in `p`'s subtree text — while `p`'s
        // ownHash is byte-identical: for own content the excised expression
        // counts as remaining line content and the target's text is no part
        // of it (SPEC 1.6).
        await workspace.file("specs/A.mdx", T5_5_2_TOGGLED);
        const toggleContext = "T5.5-2 line-drop-toggle arm";
        const t3Toggled = await queryNode(
          product,
          workspace,
          OWN_T3,
          `${toggleContext}:`,
        );
        assertBytesEqual(
          t3Toggled.subtreeText,
          "Now present.\n",
          `${toggleContext}: the toggle target's subtree text is non-empty ` +
            `after the edit (SPEC 1.6, 3)`,
        );
        const pToggled = await queryNode(
          product,
          workspace,
          OWN_P,
          `${toggleContext}:`,
        );
        assertBytesEqual(
          pToggled.subtreeText,
          OWN_P_SUBTREE_TOGGLED,
          `${toggleContext}: the embedding line is kept (content plus its ` +
            `terminator) once the expansion is non-empty — the line-drop ` +
            `outcome flipped (SPEC 3)`,
        );
        assertHashStable(
          base.hashes.ownHash,
          pToggled.hashes.ownHash,
          "the embedder's ownHash across the empty/non-empty toggle of its " +
            "own-line embedding's target",
          toggleContext,
        );
      },
    );

    // --- Kind distinction: child vs embedding reference ---
    await withWorkspace({ "specs/A.mdx": KIND_BASELINE }, async (workspace) => {
      await workspace.gitInit();
      const baseRef = await workspace.gitCommitAll("baseline");
      await buildOk(
        product,
        workspace,
        "T5.5-2 kind arm: `build` over the in-line child-construct baseline",
      );
      const before = await queryNode(
        product,
        workspace,
        KIND_P,
        "T5.5-2 kind arm, baseline:",
      );
      // Fixture anchor (SPEC 1.6, 3): the child's contribution stands in-line
      // between the runs `foo ` and ` baz`.
      assertBytesEqual(
        before.subtreeText,
        KIND_P_SUBTREE,
        "T5.5-2 kind arm: baseline subtree text of `p` — the in-line child's " +
          "contribution between the line's head and tail (SPEC 1.6, 3)",
      );

      await expectExit(
        product,
        workspace,
        ["move", "specs/A.mdx#p.k", "specs/B.mdx#k"],
        0,
        "T5.5-2 kind arm: journaled `move specs/A.mdx#p.k specs/B.mdx#k` " +
          "(relocating the child so its canonical identity survives the " +
          "journal walk, SPEC 5.4, 6.5)",
      );
      await workspace.file("specs/A.mdx", KIND_MANUAL);
      await buildOk(
        product,
        workspace,
        "T5.5-2 kind arm: `build` after embedding the moved node (imported " +
          "form) at the child's former in-line position",
      );

      const after = await queryNode(
        product,
        workspace,
        KIND_P,
        "T5.5-2 kind arm, after the replacement:",
      );
      // Fixture anchor: the embedding expands at the child's exact former
      // position, every surrounding byte identical, so `p`'s subtree text is
      // byte-identical across the replacement (SPEC 1.6, 3, 6.5).
      assertBytesEqual(
        after.subtreeText,
        KIND_P_SUBTREE,
        "T5.5-2 kind arm: subtree text of `p` after the replacement — the " +
          "embedding expands to the moved node's subtree text at the child's " +
          "exact former position (SPEC 1.6, 3, 6.5)",
      );
      assertHashChanged(
        before.hashes.ownHash,
        after.hashes.ownHash,
        "the parent's ownHash — its own-content sequences are equal runs " +
          "around one reference of the same canonical identity differing " +
          "only in kind (child vs embedding, SPEC 1.6, 5.4, 5.5)",
        "T5.5-2 kind arm",
      );

      const impactLabel =
        "T5.5-2 kind arm: `impact --base <baseline>` after the child→embedding replacement";
      const impact = await impactAgainst(
        product,
        workspace,
        baseRef,
        impactLabel,
      );
      const pEntries = impact.requirements.filter((entry) =>
        entry.nodes.includes(KIND_P),
      );
      if (pEntries.some((entry) => entry.deleted)) {
        fail(
          `${impactLabel}: ${KIND_P} is present on both sides and must not be ` +
            `reported deleted (SPEC 5.6, 9.3); got entries ` +
            JSON.stringify(pEntries),
        );
      }
      if (
        !pEntries.some((entry) =>
          entry.categories.some((category) => category.category === "changed"),
        )
      ) {
        fail(
          `${impactLabel}: the parent ${KIND_P} must be \`changed\` — its ownHash ` +
            `changed because child and embedding references are distinguished ` +
            `in own content (SPEC 1.6, 5.5, 5.6); a product hashing references ` +
            `kind-blindly reports it unchanged; got entries ` +
            JSON.stringify(pEntries),
        );
      }
    });
  },
});

// ---------------------------------------------------------------------------
// T5.5-3 — subtreeHash
// ---------------------------------------------------------------------------

// `s1` holds a child `s1.a` (embedding a target inside the sibling subtree
// `s2`) and a child `s1.b` with two grandchildren — the depth-2 sites for the
// added/removed/reordered/edited arms, all leaving `s1`'s own content (and so
// its ownHash) untouched.
interface SubtreeShape {
  readonly grandchildren?: readonly (readonly [string, string])[];
  readonly s2Intro?: string;
  readonly embedTargetText?: string;
}

function subtreeSource(shape: SubtreeShape = {}): string {
  const grandchildren = shape.grandchildren ?? [
    ["g1", "Gamma one."],
    ["g2", "Gamma two."],
  ];
  const lines: string[] = [
    '<S id="s1">',
    "S1 intro.",
    '<S id="s1.a">',
    'Alpha child. {text("s2.t")}',
    "</S>",
    '<S id="s1.b">',
    "Beta child.",
  ];
  for (const [suffix, text] of grandchildren) {
    lines.push(`<S id="s1.b.${suffix}">`, text, "</S>");
  }
  lines.push(
    "</S>",
    "</S>",
    "",
    '<S id="s2">',
    shape.s2Intro ?? "S2 intro.",
    '<S id="s2.t">',
    shape.embedTargetText ?? "Embed target original.",
    "</S>",
    "</S>",
    "",
  );
  return lines.join("\n");
}

const SUB_S1 = "specs/A.mdx#s1";
const SUB_S1A = "specs/A.mdx#s1.a";
const SUB_S2 = "specs/A.mdx#s2";
const SUB_S2T = "specs/A.mdx#s2.t";

// The changed arms — each at depth 2 so `s1`'s own content is untouched: the
// subtreeHash change travels through the descendant chain alone — staged
// after the base-state build: a staged-source record per row, named with the
// row's label (S-9).
const subtreeArm = (label: string, shape: SubtreeShape): StagedArm => ({
  label,
  source: stagedMdx(`T5.5-3 ${label}`, subtreeSource(shape)),
});
const SUBTREE_CHANGED_ARMS: readonly StagedArm[] = [
  subtreeArm("a descendant is added", {
    grandchildren: [
      ["g1", "Gamma one."],
      ["g2", "Gamma two."],
      ["g3", "Gamma three."],
    ],
  }),
  subtreeArm("a descendant is removed", {
    grandchildren: [["g2", "Gamma two."]],
  }),
  subtreeArm("descendants are reordered", {
    grandchildren: [
      ["g2", "Gamma two."],
      ["g1", "Gamma one."],
    ],
  }),
  subtreeArm("an in-subtree own-content change (a grandchild's run edited)", {
    grandchildren: [
      ["g1", "Gamma one, edited."],
      ["g2", "Gamma two."],
    ],
  }),
];

// The unchanged arms, staged after the changed arms — staged-source records.
const T5_5_3_SIBLING_EDITED = stagedMdx(
  "T5.5-3 specs/A.mdx with the sibling subtree s2's intro edited (the unchanged arm)",
  subtreeSource({ s2Intro: "S2 intro, edited." }),
);
const T5_5_3_TARGET_EDITED = stagedMdx(
  "T5.5-3 specs/A.mdx with the embedded target s2.t's text edited (the unchanged arm)",
  subtreeSource({ embedTargetText: "Embed target original, edited." }),
);

const T5_5_3 = defineProductTest({
  id: "T5.5-3",
  title:
    "subtreeHash changes exactly under the 5.5 conditions — a descendant added, removed, or reordered, or any in-subtree own-content change (each staged at depth 2, leaving the queried ancestor's ownHash byte-identical) — and is byte-identical for sibling-subtree edits and for edits to an embedded target outside the subtree (SPEC 5.5)",
  run: async (product) => {
    await withWorkspace(
      { "specs/A.mdx": subtreeSource() },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T5.5-3 `build` over the subtree-matrix base state",
        );
        const base = await queryHashes(
          product,
          workspace,
          SUB_S1,
          "T5.5-3 base state:",
        );
        const baseS1a = await queryHashes(
          product,
          workspace,
          SUB_S1A,
          "T5.5-3 base state:",
        );
        const baseS2 = await queryHashes(
          product,
          workspace,
          SUB_S2,
          "T5.5-3 base state:",
        );
        const baseS2t = await queryHashes(
          product,
          workspace,
          SUB_S2T,
          "T5.5-3 base state:",
        );

        // Changed arms — each at depth 2 so `s1`'s own content is untouched:
        // the subtreeHash change travels through the descendant chain alone.
        for (const arm of SUBTREE_CHANGED_ARMS) {
          await workspace.file("specs/A.mdx", arm.source);
          const after = await queryHashes(
            product,
            workspace,
            SUB_S1,
            `T5.5-3 changed arm (${arm.label}):`,
          );
          assertHashChanged(
            base.subtreeHash,
            after.subtreeHash,
            `the ancestor's subtreeHash when ${arm.label}`,
            "T5.5-3",
          );
          assertHashStable(
            base.ownHash,
            after.ownHash,
            `the ancestor's ownHash when ${arm.label} (the edit is two levels ` +
              `down; s1's own content is untouched)`,
            "T5.5-3",
          );
        }

        // Unchanged: a sibling-subtree edit. Control: the sibling's own
        // subtreeHash changed, so the edit demonstrably registered.
        await workspace.file("specs/A.mdx", T5_5_3_SIBLING_EDITED);
        const siblingContext = "T5.5-3 unchanged arm (sibling-subtree edit)";
        const s1AfterSibling = await queryHashes(
          product,
          workspace,
          SUB_S1,
          `${siblingContext}:`,
        );
        assertHashStable(
          base.subtreeHash,
          s1AfterSibling.subtreeHash,
          "s1's subtreeHash when the sibling subtree s2 is edited",
          siblingContext,
        );
        const s2AfterSibling = await queryHashes(
          product,
          workspace,
          SUB_S2,
          `${siblingContext}:`,
        );
        assertHashChanged(
          baseS2.subtreeHash,
          s2AfterSibling.subtreeHash,
          "the edited sibling s2's subtreeHash (control: the edit registered)",
          siblingContext,
        );

        // Unchanged: an embedded target outside the subtree is edited — the
        // embedder's subtree carries the target as an identity, not its text
        // (SPEC 1.6, 5.5). Control: the target's subtreeHash changed.
        await workspace.file("specs/A.mdx", T5_5_3_TARGET_EDITED);
        const targetContext =
          "T5.5-3 unchanged arm (embedded target outside the subtree edited)";
        const s1AfterTarget = await queryHashes(
          product,
          workspace,
          SUB_S1,
          `${targetContext}:`,
        );
        assertHashStable(
          base.subtreeHash,
          s1AfterTarget.subtreeHash,
          "s1's subtreeHash when the embedded target inside s2 is edited",
          targetContext,
        );
        const s1aAfterTarget = await queryHashes(
          product,
          workspace,
          SUB_S1A,
          `${targetContext}:`,
        );
        assertHashStable(
          baseS1a.subtreeHash,
          s1aAfterTarget.subtreeHash,
          "the embedder s1.a's subtreeHash when its embedded target is edited",
          targetContext,
        );
        const s2tAfterTarget = await queryHashes(
          product,
          workspace,
          SUB_S2T,
          `${targetContext}:`,
        );
        assertHashChanged(
          baseS2t.subtreeHash,
          s2tAfterTarget.subtreeHash,
          "the edited target's subtreeHash (control: the edit registered)",
          targetContext,
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T5.5-4 — effectiveHash
// ---------------------------------------------------------------------------

// `q` holds `q.inner`, whose `d` prop the edge arms vary — `d` edits never
// touch own content (props are removed wholesale, SPEC 3), so ownHash and
// subtreeHash are byte-identical controls while effectiveHash moves. `t1`
// depends on `chain` for the transitive arm; `twinA`/`twinB` are
// byte-identical dependency-free targets for the equal-effectiveHash
// retarget; `dual` bears both `d={"t1"}` and `{text("t1")}` for the
// per-edge-pairs arms; `unrelated` is the no-change control.
interface EffectiveShape {
  /** `q.inner`'s attributes after `id` (leading space included), or "". */
  readonly innerAttrs?: string;
  readonly chainText?: string;
  /** `dual`'s attributes after `id` (leading space included), or "". */
  readonly dualAttrs?: string;
  readonly dualLine?: string;
  readonly unrelatedText?: string;
}

function effectiveSource(shape: EffectiveShape = {}): string {
  return [
    '<S id="q">',
    "Q intro.",
    `<S id="q.inner"${shape.innerAttrs ?? ' d={"t1"}'}>`,
    "Inner text.",
    "</S>",
    "</S>",
    "",
    '<S id="t1" d={"chain"}>',
    "Target one.",
    "</S>",
    "",
    '<S id="t2">',
    "Target two.",
    "</S>",
    "",
    '<S id="twinA">',
    "Twin text.",
    "</S>",
    "",
    '<S id="twinB">',
    "Twin text.",
    "</S>",
    "",
    '<S id="chain">',
    shape.chainText ?? "Chain tail.",
    "</S>",
    "",
    `<S id="dual"${shape.dualAttrs ?? ' d={"t1"}'}>`,
    shape.dualLine ?? 'Dual intro. {text("t1")} tail.',
    "</S>",
    "",
    '<S id="unrelated">',
    shape.unrelatedText ?? "Unrelated text.",
    "</S>",
    "",
  ].join("\n");
}

const EFF_Q = "specs/A.mdx#q";
const EFF_INNER = "specs/A.mdx#q.inner";
const EFF_DUAL = "specs/A.mdx#dual";
const EFF_TWIN_A = "specs/A.mdx#twinA";
const EFF_TWIN_B = "specs/A.mdx#twinB";

// The edge arms — the `d` edit sits on the child `q.inner` — staged after the
// base-state build: a staged-source record per row, named with the row's
// label (S-9).
const effectiveArm = (label: string, shape: EffectiveShape): StagedArm => ({
  label,
  source: stagedMdx(`T5.5-4 ${label}`, effectiveSource(shape)),
});
const EFFECTIVE_EDGE_ARMS: readonly StagedArm[] = [
  effectiveArm("a dependency edge is added in the subtree", {
    innerAttrs: ' d={["t1", "t2"]}',
  }),
  effectiveArm("a dependency edge is removed in the subtree", {
    innerAttrs: "",
  }),
  effectiveArm("a dependency edge is retargeted in the subtree", {
    innerAttrs: ' d={"t2"}',
  }),
];

// The remaining arms, staged in this order after the edge arms —
// staged-source records.
const T5_5_4_CHAIN_EDITED = stagedMdx(
  "T5.5-4 specs/A.mdx with the dependency target chain's text edited (the transitive arm)",
  effectiveSource({ chainText: "Chain tail, edited." }),
);
const T5_5_4_TWIN_A = stagedMdx(
  "T5.5-4 specs/A.mdx with q.inner retargeted to twinA (the twin-retarget arm)",
  effectiveSource({ innerAttrs: ' d={"twinA"}' }),
);
const T5_5_4_TWIN_B = stagedMdx(
  "T5.5-4 specs/A.mdx with q.inner retargeted to twinB (the twin-retarget arm)",
  effectiveSource({ innerAttrs: ' d={"twinB"}' }),
);
const T5_5_4_UNRELATED_EDITED = stagedMdx(
  "T5.5-4 specs/A.mdx with the unrelated node's text edited (the unchanged arm)",
  effectiveSource({ unrelatedText: "Unrelated text, edited." }),
);
const T5_5_4_DUAL_MINUS_D = stagedMdx(
  "T5.5-4 specs/A.mdx with dual's `d` reference removed, the embedding kept (the per-edge-pairs arm)",
  effectiveSource({ dualAttrs: "" }),
);
const T5_5_4_DUAL_MINUS_EMBED = stagedMdx(
  "T5.5-4 specs/A.mdx with dual's embedding removed, the `d` reference kept (the per-edge-pairs arm)",
  effectiveSource({ dualLine: "Dual intro.  tail." }),
);

const T5_5_4 = defineProductTest({
  id: "T5.5-4",
  title:
    "effectiveHash changes when a dependency edge is added, removed, or retargeted anywhere in the subtree (staged via `d` on a child, leaving the ancestor's ownHash and subtreeHash byte-identical), when a dependency target's effectiveHash changes transitively, and on retarget between two byte-identical twin targets with equal effectiveHash; it is byte-identical when an unrelated node changes; and pairs enter per edge, not per distinct target — on a node bearing both d={T} and {text(T)}, removing the `d` reference alone changes effectiveHash while ownHash stays byte-identical, and removing the embedding alone changes it too (SPEC 5.5)",
  run: async (product) => {
    await withWorkspace(
      { "specs/A.mdx": effectiveSource() },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T5.5-4 `build` over the effectiveHash-matrix base state",
        );
        const baseQ = await queryHashes(
          product,
          workspace,
          EFF_Q,
          "T5.5-4 base state:",
        );
        const baseInner = await queryHashes(
          product,
          workspace,
          EFF_INNER,
          "T5.5-4 base state:",
        );
        const baseDual = await queryHashes(
          product,
          workspace,
          EFF_DUAL,
          "T5.5-4 base state:",
        );

        // Twin-fixture control (the arm's stated precondition): byte-identical
        // dependency-free targets hash identically, effectiveHash included
        // (SPEC 5.5: deterministic for identical input) — so the retarget
        // comparison below can only be told apart by the identity in the pair.
        const twinA = await queryHashes(
          product,
          workspace,
          EFF_TWIN_A,
          "T5.5-4 twin control:",
        );
        const twinB = await queryHashes(
          product,
          workspace,
          EFF_TWIN_B,
          "T5.5-4 twin control:",
        );
        if (twinA.effectiveHash !== twinB.effectiveHash) {
          fail(
            `T5.5-4 twin control: the byte-identical dependency-free twin ` +
              `targets must have equal effectiveHash — identical own content, ` +
              `no children, no dependency edges, and hashes are deterministic ` +
              `for identical input (SPEC 5.5); got ` +
              `${JSON.stringify(twinA.effectiveHash)} vs ${JSON.stringify(twinB.effectiveHash)}`,
          );
        }

        // Edge added / removed / retargeted anywhere in the subtree: the `d`
        // edit sits on the child `q.inner`; the ancestor `q` must see its
        // effectiveHash change while its ownHash and subtreeHash stay
        // byte-identical (`d` props are no part of own content, SPEC 1.6, 3).
        for (const arm of EFFECTIVE_EDGE_ARMS) {
          await workspace.file("specs/A.mdx", arm.source);
          const context = `T5.5-4 edge arm (${arm.label})`;
          const inner = await queryHashes(
            product,
            workspace,
            EFF_INNER,
            `${context}:`,
          );
          assertHashChanged(
            baseInner.effectiveHash,
            inner.effectiveHash,
            "the edge-bearing child's effectiveHash",
            context,
          );
          assertHashStable(
            baseInner.ownHash,
            inner.ownHash,
            "the edge-bearing child's ownHash (a `d` edit is no own-content " +
              "edit)",
            context,
          );
          const q = await queryHashes(product, workspace, EFF_Q, `${context}:`);
          assertHashChanged(
            baseQ.effectiveHash,
            q.effectiveHash,
            "the ancestor's effectiveHash (dependency edges anywhere in the " +
              "subtree enter it)",
            context,
          );
          assertHashStable(
            baseQ.ownHash,
            q.ownHash,
            "the ancestor's ownHash",
            context,
          );
          assertHashStable(
            baseQ.subtreeHash,
            q.subtreeHash,
            "the ancestor's subtreeHash (no own-content change anywhere)",
            context,
          );
        }

        // Transitive: editing `chain`'s text changes chain's effectiveHash,
        // hence t1's (dependency target), hence q.inner's, hence q's — while
        // q's own content and subtree are untouched.
        await workspace.file("specs/A.mdx", T5_5_4_CHAIN_EDITED);
        const transitiveContext =
          "T5.5-4 transitive arm (a dependency target's dependency edited)";
        const qTransitive = await queryHashes(
          product,
          workspace,
          EFF_Q,
          `${transitiveContext}:`,
        );
        assertHashChanged(
          baseQ.effectiveHash,
          qTransitive.effectiveHash,
          "the ancestor's effectiveHash (a dependency target's effectiveHash " +
            "change propagates transitively: chain -> t1 -> q.inner -> q)",
          transitiveContext,
        );
        assertHashStable(
          baseQ.ownHash,
          qTransitive.ownHash,
          "the ancestor's ownHash",
          transitiveContext,
        );
        assertHashStable(
          baseQ.subtreeHash,
          qTransitive.subtreeHash,
          "the ancestor's subtreeHash (chain is outside q's subtree)",
          transitiveContext,
        );

        // Retarget between the equal-effectiveHash twins: identities enter
        // the target pairs, so the two variants' hashes differ even though
        // the targets' effectiveHashes are equal.
        await workspace.file("specs/A.mdx", T5_5_4_TWIN_A);
        const twinContext = "T5.5-4 twin-retarget arm";
        const innerOnA = await queryHashes(
          product,
          workspace,
          EFF_INNER,
          `${twinContext}, targeting twinA:`,
        );
        const qOnA = await queryHashes(
          product,
          workspace,
          EFF_Q,
          `${twinContext}, targeting twinA:`,
        );
        await workspace.file("specs/A.mdx", T5_5_4_TWIN_B);
        const innerOnB = await queryHashes(
          product,
          workspace,
          EFF_INNER,
          `${twinContext}, targeting twinB:`,
        );
        const qOnB = await queryHashes(
          product,
          workspace,
          EFF_Q,
          `${twinContext}, targeting twinB:`,
        );
        assertHashStable(
          innerOnA.ownHash,
          innerOnB.ownHash,
          "the retargeting node's ownHash across the twin retarget (control: " +
            "only the `d` target differs)",
          twinContext,
        );
        assertHashChanged(
          innerOnA.effectiveHash,
          innerOnB.effectiveHash,
          "the retargeting node's effectiveHash between targets with equal " +
            "effectiveHash (identities enter the pairs; a product hashing " +
            "pairs by target hash alone reports no change)",
          twinContext,
        );
        assertHashChanged(
          qOnA.effectiveHash,
          qOnB.effectiveHash,
          "the ancestor's effectiveHash between the twin-retarget variants",
          twinContext,
        );

        // Unchanged: an unrelated node changes.
        await workspace.file("specs/A.mdx", T5_5_4_UNRELATED_EDITED);
        const unrelatedContext = "T5.5-4 unchanged arm (unrelated node edited)";
        assertSameJson(
          await queryHashes(product, workspace, EFF_Q, `${unrelatedContext}:`),
          baseQ,
          `${unrelatedContext}: all four hashes of ${EFF_Q} are byte-identical ` +
            `when an unrelated node changes (SPEC 5.5)`,
        );

        // Per-edge pairs on `dual` (d={"t1"} plus {text("t1")}): removing the
        // `d` reference alone changes effectiveHash while ownHash is
        // byte-identical — the discriminating arm: a product deduplicating
        // pairs per distinct target sees {(t1, h)} on both sides and reports
        // no change. Removing the embedding alone changes it too.
        await workspace.file("specs/A.mdx", T5_5_4_DUAL_MINUS_D);
        const minusDContext =
          "T5.5-4 per-edge-pairs arm (the `d` reference removed, the embedding kept)";
        const dualMinusD = await queryHashes(
          product,
          workspace,
          EFF_DUAL,
          `${minusDContext}:`,
        );
        assertHashStable(
          baseDual.ownHash,
          dualMinusD.ownHash,
          "dual's ownHash (removing `d` touches no own content)",
          minusDContext,
        );
        assertHashChanged(
          baseDual.effectiveHash,
          dualMinusD.effectiveHash,
          "dual's effectiveHash — one pair enters per dependency edge, not " +
            "per distinct target: two identical (t1, hash) pairs became one",
          minusDContext,
        );
        await workspace.file("specs/A.mdx", T5_5_4_DUAL_MINUS_EMBED);
        const minusEmbedContext =
          "T5.5-4 per-edge-pairs arm (the embedding removed, the `d` reference kept)";
        const dualMinusEmbed = await queryHashes(
          product,
          workspace,
          EFF_DUAL,
          `${minusEmbedContext}:`,
        );
        assertHashChanged(
          baseDual.effectiveHash,
          dualMinusEmbed.effectiveHash,
          "dual's effectiveHash when the embedding edge alone is removed",
          minusEmbedContext,
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T5.5-5 — metadataHash
// ---------------------------------------------------------------------------

interface MetadataShape {
  /** `m`'s attributes after `id` (leading space included). */
  readonly mAttrs?: string;
  readonly mLine?: string;
}

function metadataSource(shape: MetadataShape = {}): string {
  return [
    `<S id="m"${shape.mAttrs ?? ' d={["t1", "t2"]} tags="beta alpha"'}>`,
    shape.mLine ?? "Meta node text.",
    "</S>",
    "",
    '<S id="t1">',
    "Target one.",
    "</S>",
    "",
    '<S id="t2">',
    "Target two.",
    "</S>",
    "",
    '<S id="t3">',
    "Target three.",
    "</S>",
    "",
  ].join("\n");
}

const META_M = "specs/A.mdx#m";
const META_OTHER_FILE = ['<S id="other">', "Other file text.", "</S>", ""].join(
  "\n",
);

// The arms, each staged after the base-state build in the body's order —
// changed, unchanged, order-insensitivity — a staged-source record per row,
// named with the row's label (S-9).
const metadataArm = (label: string, shape: MetadataShape): StagedArm => ({
  label,
  source: stagedMdx(`T5.5-5 ${label}`, metadataSource(shape)),
});
// Changed arms: `d` target set, coverage attribute, tags.
const METADATA_CHANGED_ARMS: readonly StagedArm[] = [
  metadataArm("the `d` target set changes", {
    mAttrs: ' d={["t1"]} tags="beta alpha"',
  }),
  metadataArm("the coverage attribute changes", {
    mAttrs: ' d={["t1", "t2"]} coverage="none" tags="beta alpha"',
  }),
  metadataArm("the tags change", {
    mAttrs: ' d={["t1", "t2"]} tags="beta gamma"',
  }),
];
// Unchanged arms (the iff's other direction): a text edit, and an added
// embedded reference — own content (1.6), surfacing through ownHash.
const METADATA_UNCHANGED_ARMS: readonly StagedArm[] = [
  metadataArm("the node's text is edited", {
    mLine: "Meta node text, edited.",
  }),
  metadataArm("an embedded text(...) reference is added", {
    mLine: 'Meta node text. {text("t3")}',
  }),
];
// Order-insensitivity arms: each differs from the committed baseline in
// exactly the reordering.
const METADATA_REORDER_ARMS: readonly StagedArm[] = [
  metadataArm("the references within one multi-element `d` array reordered", {
    mAttrs: ' d={["t2", "t1"]} tags="beta alpha"',
  }),
  metadataArm("a multi-tag `tags` list reordered", {
    mAttrs: ' d={["t1", "t2"]} tags="alpha beta"',
  }),
];

/**
 * `text` with its one occurrence of `from` replaced by `to` — a module-load
 * composition step over another test's fixture constant: an anchor that is
 * missing or ambiguous throws at load, a harness defect, never a verdict.
 */
function replacedOnce(text: string, from: string, to: string): string {
  const at = text.indexOf(from);
  if (at === -1 || text.includes(from, at + from.length)) {
    throw new Error(
      `section-5.5.ts: the composition anchor ${JSON.stringify(from)} must ` +
        `occur exactly once in ${JSON.stringify(text)}`,
    );
  }
  return text.slice(0, at) + to + text.slice(at + from.length);
}

// The tie-break arm (5.5: target sets sort by canonical identity — identity
// string first, then journal position, earliest first). Two targets share an
// identity string only where an identity a journaled rename vacated is borne
// anew (5.4): on T5.4-1's first fixture, N1 (`b`, renamed from `a`, canonical
// at the journal's start) and N2 (`a`, authored after the rename, canonical
// after its entry). Its workspace is created after the matrix workspace's
// invocations, so its baseline is a staged-source record (S-9).
const TIE_BASELINE = stagedMdx(
  "T5.5-5 specs/A.mdx T5.4-1's first fixture, its baseline (the tie-break arm's workspace)",
  REINTRO_BASELINE,
);
// The file after N2 is authored, as T5.4-1 leaves it: its baseline as a
// conforming `rename specs/A.mdx a b` rewrites it — minimal in-place edits
// preserving quote style (SPEC 6.4): the bearer's `id`, `dep`'s `d`
// reference, and both embeddings spelled "b" — then T5.4-1's manual edits:
// `e`'s embedding re-spelled "a" (its baseline bytes again) and N2 and `g`
// appended (REINTRO_APPENDED).
const TIE_AUTHORED_BASE =
  replacedOnce(
    replacedOnce(
      replacedOnce(REINTRO_BASELINE, '<S id="a">', '<S id="b">'),
      'd={"a"}',
      'd={"b"}',
    ),
    'Twin: {text("a")} end.',
    'Twin: {text("b")} end.',
  ) + REINTRO_APPENDED;
// The node `h`, appended after N2 and `g`: its `d` array spells one
// reference per bearer — "b" N1, "a" N2 — in the order given.
const TIE_NODE = "specs/A.mdx#h";
const tieAuthored = (dArray: string): string =>
  TIE_AUTHORED_BASE +
  ["", `<S id="h" d={${dArray}}>`, "Depends on both bearers.", "</S>", ""].join(
    "\n",
  );
const TIE_AUTHORED = stagedMdx(
  'T5.5-5 specs/A.mdx T5.4-1\'s first fixture after N2 is authored, with `h` declaring d={["b", "a"]} (the tie-break arm)',
  tieAuthored('["b", "a"]'),
);
const TIE_REORDERED = stagedMdx(
  'T5.5-5 specs/A.mdx with `h`\'s d reordered to d={["a", "b"]} (the tie-break arm)',
  tieAuthored('["a", "b"]'),
);
// Every node of the arm's file, `h` first: a product breaking the
// identity-string tie by source order changes `h`'s metadataHash and
// effectiveHash, and through it its root's effectiveHash, so the first
// diagnosis names the node whose `d` array was reordered.
const TIE_IDENTITIES: readonly string[] = [
  TIE_NODE,
  REINTRO_ROOT,
  REINTRO_N1,
  REINTRO_DEP,
  REINTRO_E,
  REINTRO_F,
  REINTRO_N2,
  REINTRO_G,
];

const T5_5_5 = defineProductTest({
  id: "T5.5-5",
  title:
    'metadataHash changes iff the `d` target set, `coverage`, or tags change — text edits and added embedded text(...) references leave it byte-identical; root nodes report a metadataHash computed from empty inputs (two roots hash identically); reordering the references within one multi-element `d` array or reordering a multi-tag `tags` list changes no hash — all four compared, metadataHash and effectiveHash included — and yields no change categories against a baseline; and the tie-break: on T5.4-1\'s first fixture after N2 is authored, a node declaring `d={["b", "a"]}` — one spelling per bearer of the identity string `a`, "b" N1 and "a" N2 — reordered to `d={["a", "b"]}` against a baseline committed just before the reorder changes no hash on any node (every node\'s four compared) and yields no categories, target sets sorting by canonical identity — identity string, then journal position — never by source order (SPEC 5.4, 5.5, 5.6, 11)',
  run: async (product) => {
    await withWorkspace(
      { "specs/A.mdx": metadataSource(), "specs/B.mdx": META_OTHER_FILE },
      async (workspace) => {
        await workspace.gitInit();
        const baseRef = await workspace.gitCommitAll("baseline");
        await buildOk(
          product,
          workspace,
          "T5.5-5 `build` over the metadata-matrix base state",
        );
        const baseM = await queryHashes(
          product,
          workspace,
          META_M,
          "T5.5-5 base state:",
        );

        // Root nodes have a metadataHash, reported by `query node` (presence
        // is enforced by the adapter) and computed from empty inputs — no `d`
        // targets, no coverage attribute, no tags — so two roots' values are
        // identical (deterministic hash of identical input, SPEC 5.5).
        const rootContext = "T5.5-5 root arm:";
        const rootA = await queryHashes(
          product,
          workspace,
          "specs/A.mdx",
          rootContext,
        );
        const rootB = await queryHashes(
          product,
          workspace,
          "specs/B.mdx",
          rootContext,
        );
        if (rootA.metadataHash !== rootB.metadataHash) {
          fail(
            `T5.5-5 root arm: a root node's metadataHash is computed from ` +
              `empty inputs — no \`d\` targets, no coverage attribute, no tags ` +
              `(SPEC 5.5) — so the two roots' metadataHashes must be ` +
              `identical; got ${JSON.stringify(rootA.metadataHash)} vs ` +
              JSON.stringify(rootB.metadataHash),
          );
        }

        // Changed arms: `d` target set, coverage attribute, tags.
        for (const arm of METADATA_CHANGED_ARMS) {
          await workspace.file("specs/A.mdx", arm.source);
          const after = await queryHashes(
            product,
            workspace,
            META_M,
            `T5.5-5 changed arm (${arm.label}):`,
          );
          assertHashChanged(
            baseM.metadataHash,
            after.metadataHash,
            `metadataHash when ${arm.label}`,
            "T5.5-5",
          );
        }

        // Unchanged (the iff's other direction): a text edit — and an added
        // embedded reference, which is own content (1.6) and surfaces through
        // ownHash, never metadataHash. The ownHash change is the control that
        // each edit registered.
        for (const arm of METADATA_UNCHANGED_ARMS) {
          await workspace.file("specs/A.mdx", arm.source);
          const context = `T5.5-5 unchanged arm (${arm.label})`;
          const after = await queryHashes(
            product,
            workspace,
            META_M,
            `${context}:`,
          );
          assertHashStable(
            baseM.metadataHash,
            after.metadataHash,
            `metadataHash when ${arm.label}`,
            context,
          );
          assertHashChanged(
            baseM.ownHash,
            after.ownHash,
            "ownHash (control: the edit registered, and embedded references " +
              "surface through ownHash)",
            context,
          );
        }

        // Order-insensitivity: each reorder variant differs from the
        // committed baseline in exactly the reordering, so `impact --base`
        // over it must report no categories at all (target sets enter sorted
        // by canonical identity, tags sorted, SPEC 5.5) — no requirement
        // entries, per the suite's fixed T1.5-1 interpretation of 9.3.
        for (const arm of METADATA_REORDER_ARMS) {
          await workspace.file("specs/A.mdx", arm.source);
          const context = `T5.5-5 order-insensitivity arm (${arm.label})`;
          assertSameJson(
            await queryHashes(product, workspace, META_M, `${context}:`),
            baseM,
            `${context}: all four hashes of ${META_M} are byte-identical — ` +
              `metadataHash and effectiveHash included (SPEC 5.5)`,
          );
          const impact = await impactAgainst(
            product,
            workspace,
            baseRef,
            `${context}: \`impact --base <baseline>\``,
          );
          if (impact.requirements.length !== 0) {
            fail(
              `${context}: the reordering is the only difference from the ` +
                `baseline and changes no hash, so impact reports no change ` +
                `categories — no requirement entries (SPEC 5.5, 5.6, 9.3); ` +
                `got ${JSON.stringify(impact.requirements)}`,
            );
          }
        }
      },
    );

    // --- The tie-break arm, on T5.4-1's first fixture ---
    await withWorkspace({ [REINTRO_ROOT]: TIE_BASELINE }, async (workspace) => {
      await workspace.gitInit();
      await expectExit(
        product,
        workspace,
        ["rename", REINTRO_ROOT, "a", "b"],
        0,
        "T5.5-5 tie-break arm: `rename specs/A.mdx a b` (T5.4-1's first " +
          "fixture: vacating the identity `a` through the journal)",
      );
      // The file after N2 is authored, staged whole (the module header's
      // note): N1 now bears `b`, N2 bears `a` anew, and `h` declares
      // `d={["b", "a"]}`, one spelling per bearer.
      await workspace.file(REINTRO_ROOT, TIE_AUTHORED);
      await buildOk(
        product,
        workspace,
        "T5.5-5 tie-break arm: `build` after N2 and `h` are authored",
      );
      const beforeLabel = "T5.5-5 tie-break arm, before the reorder:";
      await assertIdentitySet(product, workspace, TIE_IDENTITIES, beforeLabel);
      const before = await queryHashesOf(
        product,
        workspace,
        TIE_IDENTITIES,
        beforeLabel,
      );
      // The baseline, committed just before the reorder: its tree holds the
      // journal the rename wrote, so the baseline's canonical identities are
      // the current ones (SPEC 6.3: no entry to apply; baseline hashes
      // computed with the journal content at the ref).
      const baseRef = await workspace.gitCommitAll("tie-break baseline");

      // The reorder: `h`'s two references exchange positions, nothing else
      // changing. Both bearers walk back to the string `a`, so only the
      // journal position orders them (N1, at the journal's start, first):
      // `h`'s target set enters its metadataHash and its dependency pairs
      // enter its effectiveHash in the same order whatever the spelling
      // order (SPEC 5.4, 5.5).
      await workspace.file(REINTRO_ROOT, TIE_REORDERED);
      const afterLabel = "T5.5-5 tie-break arm, after the reorder:";
      await assertIdentitySet(product, workspace, TIE_IDENTITIES, afterLabel);
      const after = await queryHashesOf(
        product,
        workspace,
        TIE_IDENTITIES,
        afterLabel,
      );
      for (const identity of TIE_IDENTITIES) {
        assertSameJson(
          after[identity],
          before[identity],
          `T5.5-5 tie-break arm: all four hashes of ${identity} are ` +
            `byte-identical across the reorder of ${TIE_NODE}'s ` +
            `\`d={["b", "a"]}\` to \`d={["a", "b"]}\` — metadataHash and ` +
            `effectiveHash included: target sets sort by canonical identity, ` +
            `identity string first, then journal position, earliest first, ` +
            `so two bearers of the string "a" (N1 ${REINTRO_N1}, N2 ` +
            `${REINTRO_N2}) order alike in either spelling order; a product ` +
            `breaking the identity-string tie by source order changes ` +
            `${TIE_NODE}'s metadataHash and effectiveHash (SPEC 5.4, 5.5)`,
        );
      }
      const impactContext =
        "T5.5-5 tie-break arm: `impact --base <committed just before the reorder>`";
      const impact = await impactAgainst(
        product,
        workspace,
        baseRef,
        impactContext,
      );
      if (impact.requirements.length !== 0) {
        fail(
          `${impactContext}: the reorder of ${TIE_NODE}'s two references — one ` +
            `per bearer of the identity string "a" — is the only difference ` +
            `from the baseline and changes no hash, so impact reports no ` +
            `change categories — no requirement entries (SPEC 5.4, 5.5, 5.6, ` +
            `9.3); a product breaking the tie by source order reports ` +
            `${TIE_NODE} \`metadata-changed\`; got ` +
            JSON.stringify(impact.requirements),
        );
      }
    });
  },
});

// ---------------------------------------------------------------------------
// T5.5-6 — purity link
// ---------------------------------------------------------------------------

/** Identity mapping performed by `rename specs/A.mdx a b` (SPEC 6.4). */
function mapRename(identity: string): string {
  if (identity === "specs/A.mdx#a") return "specs/A.mdx#b";
  if (identity.startsWith("specs/A.mdx#a.")) {
    return `specs/A.mdx#b.${identity.slice("specs/A.mdx#a.".length)}`;
  }
  return identity;
}

/** Identity mapping performed by the file-form move of A.mdx (SPEC 6.5). */
function mapMove(identity: string): string {
  if (identity === "specs/A.mdx" || identity.startsWith("specs/A.mdx#")) {
    return `specs/sub/Amoved.mdx${identity.slice("specs/A.mdx".length)}`;
  }
  return identity;
}

const T5_5_6 = defineProductTest({
  id: "T5.5-6",
  title:
    "journaled rename and journaled file-form move change no hash on any node — full-workspace hash comparison: every node enumerated via `query nodes`, all four hashes compared under the operation's identity mapping (SPEC 5.5, 6.2, 6.4, 6.5)",
  run: async (product) => {
    await withWorkspace(RICH_FILES, async (workspace) => {
      await buildOk(
        product,
        workspace,
        "T5.5-6 `build` over the cross-referencing fixture",
      );
      const label0 = "T5.5-6 before any operation:";
      await assertIdentitySet(product, workspace, RICH_IDENTITIES, label0);
      const stage0 = await queryHashesOf(
        product,
        workspace,
        RICH_IDENTITIES,
        label0,
      );

      // Journaled rename: `a` -> `b`, descendant `a.kid` -> `b.kid` by prefix
      // replacement; the external references in C.mdx are rewritten (6.4).
      await expectExit(
        product,
        workspace,
        ["rename", "specs/A.mdx", "a", "b"],
        0,
        "T5.5-6 journaled `rename specs/A.mdx a b`",
      );
      const renamedIdentities = RICH_IDENTITIES.map(mapRename);
      const label1 = "T5.5-6 after the rename:";
      await assertIdentitySet(product, workspace, renamedIdentities, label1);
      const stage1 = await queryHashesOf(
        product,
        workspace,
        renamedIdentities,
        label1,
      );
      for (const identity of RICH_IDENTITIES) {
        const renamed = mapRename(identity);
        assertSameJson(
          stage1[renamed],
          stage0[identity],
          `T5.5-6 all four hashes of ${identity}` +
            (renamed === identity ? "" : ` (now ${renamed})`) +
            ` are byte-identical across the journaled rename (SPEC 5.5, 6.2)`,
        );
      }

      // Journaled file-form move: every A.mdx identity changes only in its
      // file part; import specifiers in A.mdx and C.mdx are rewritten (6.5).
      await expectExit(
        product,
        workspace,
        ["move", "specs/A.mdx", "specs/sub/Amoved.mdx"],
        0,
        "T5.5-6 journaled file-form `move specs/A.mdx specs/sub/Amoved.mdx`",
      );
      const movedIdentities = renamedIdentities.map(mapMove);
      const label2 = "T5.5-6 after the file move:";
      await assertIdentitySet(product, workspace, movedIdentities, label2);
      const stage2 = await queryHashesOf(
        product,
        workspace,
        movedIdentities,
        label2,
      );
      for (const identity of renamedIdentities) {
        const moved = mapMove(identity);
        assertSameJson(
          stage2[moved],
          stage1[identity],
          `T5.5-6 all four hashes of ${identity}` +
            (moved === identity ? "" : ` (now ${moved})`) +
            ` are byte-identical across the journaled file move (SPEC 5.5, 6.2)`,
        );
      }
    });
  },
});

// ---------------------------------------------------------------------------
// T5.5-7 — framing
// ---------------------------------------------------------------------------

// Collision lures, each pair staged in one valid workspace: the two nodes of
// a pair differ in the components their hash frames, yet a plain
// concatenation of those components reads the same for both.
//
// Arm (a), a run boundary meeting an identity: `e` and `f` each hold one run,
// one embedded reference, and one run of own content (SPEC 1.6) — `e` the
// runs "x" and "" around `a.b`, `f` the runs "x" and ".b" around `a` — so a
// product hashing a plain concatenation of runs and identity strings reads
// "xspecs/A.mdx#a.b" for both. The workspace is the body's first, so its
// initial files stay plain contents (S-7's sweep reaches them against the
// stub); the edit, `e`'s content re-spelled as `f`'s, is a staged-source
// record (S-9).
const FRAME_A_SOURCE = [
  '<S id="a">',
  "Alpha text.",
  "",
  '<S id="a.b">',
  "Beta text.",
  "</S>",
  "</S>",
  "",
].join("\n");
const FRAME_E = "specs/B.mdx#e";
const FRAME_F = "specs/B.mdx#f";
const FRAME_F_CONTENT = "x{text(A.a)}.b";
const frameEmbeddingsSource = (eContent: string): string =>
  [
    'import A from "./A.xspec"',
    "",
    `<S id="e">${eContent}</S>`,
    "",
    `<S id="f">${FRAME_F_CONTENT}</S>`,
    "",
  ].join("\n");
const FRAME_B_SOURCE = frameEmbeddingsSource("x{text(A.a.b)}");
const FRAME_B_EDITED = stagedMdx(
  "T5.5-7 specs/B.mdx with `e`'s content edited into `f`'s spelling, x{text(A.a)}.b (arm (a)'s edit)",
  frameEmbeddingsSource(FRAME_F_CONTENT),
);

// Arm (b), tag boundaries: `g` and `h` are alike but for the tag sets {ab}
// and {a, b} (SPEC 2.6), so a product hashing a plain concatenation of the
// sorted tags reads "ab" for both. Its workspace is created after arm (a)'s
// invocations: its initial file and its edit are staged-source records (S-9).
const FRAME_G = "specs/A.mdx#g";
const FRAME_H = "specs/A.mdx#h";
const frameTagsSource = (gTags: string): string =>
  [
    `<S id="g" tags="${gTags}">t</S>`,
    "",
    '<S id="h" tags="a b">t</S>',
    "",
  ].join("\n");
const FRAME_TAGS_SOURCE = stagedMdx(
  'T5.5-7 specs/A.mdx `g` tagged "ab" beside `h` tagged "a b" (arm (b)\'s workspace)',
  frameTagsSource("ab"),
);
const FRAME_TAGS_EDITED = stagedMdx(
  'T5.5-7 specs/A.mdx with `g`\'s tags="ab" edited into tags="a b" (arm (b)\'s edit)',
  frameTagsSource("a b"),
);

/**
 * Assert that `impact` reports `identity` with `category` — in some entry
 * naming it, no entry naming it deleted (the node is present on both sides,
 * SPEC 5.6, 9.3) — the 9.3 entry-collapsing conventions left unpinned (the
 * module header's note).
 */
function assertCategorized(
  impact: ImpactReport,
  identity: string,
  category: "changed" | "metadata-changed",
  why: string,
  context: string,
): void {
  const entries = impact.requirements.filter((entry) =>
    entry.nodes.includes(identity),
  );
  if (entries.some((entry) => entry.deleted)) {
    fail(
      `${context}: ${identity} is present on both sides and must not be ` +
        `reported deleted (SPEC 5.6, 9.3); got entries ` +
        JSON.stringify(entries),
    );
  }
  if (
    !entries.some((entry) =>
      entry.categories.some((reported) => reported.category === category),
    )
  ) {
    fail(
      `${context}: ${identity} must be \`${category}\` — ${why}; got entries ` +
        JSON.stringify(entries),
    );
  }
}

const T5_5_7 = defineProductTest({
  id: "T5.5-7",
  title:
    'framing: hash inputs are framed so that distinct sequences of components never yield the same input, each collision lure\'s pair staged in one valid workspace, its two hashes asserted different (`query node`) and the edit from the first spelling to the second categorized by `impact --base` against a commit holding the first — (a) a run boundary meeting an identity: `<S id="e">x{text(A.a.b)}</S>` and `<S id="f">x{text(A.a)}.b</S>` (one run, one embedded reference, one run each) have differing ownHashes, and editing `e`\'s content into `f`\'s spelling reports `e` `changed`; (b) tag boundaries: `<S id="g" tags="ab">t</S>` and `<S id="h" tags="a b">t</S>` (tag sets {ab} and {a, b}) have differing metadataHashes, and editing `g`\'s `tags="ab"` into `tags="a b"` reports `g` `metadata-changed` (SPEC 1.6, 2.6, 5.5, 5.6)',
  run: async (product) => {
    // --- Arm (a): a run boundary meeting an identity ---
    await withWorkspace(
      { "specs/A.mdx": FRAME_A_SOURCE, "specs/B.mdx": FRAME_B_SOURCE },
      async (workspace) => {
        await workspace.gitInit();
        const baseRef = await workspace.gitCommitAll("baseline");
        await buildOk(
          product,
          workspace,
          "T5.5-7 arm (a): `build` over the run-boundary lure",
        );
        const context = "T5.5-7 arm (a), a run boundary meeting an identity";
        const e = await queryHashes(product, workspace, FRAME_E, `${context}:`);
        const f = await queryHashes(product, workspace, FRAME_F, `${context}:`);
        if (e.ownHash === f.ownHash) {
          fail(
            `${context}: ${FRAME_E} (the runs "x" and "" around an embedding ` +
              `of specs/A.mdx#a.b) and ${FRAME_F} (the runs "x" and ".b" around ` +
              `an embedding of specs/A.mdx#a) differ in their own content ` +
              `sequences, and hash inputs are framed so that distinct sequences ` +
              `of runs and identities never yield the same input — their ` +
              `ownHashes must differ (SPEC 1.6, 5.5); a product hashing a plain ` +
              `concatenation of runs and identity strings gives both one hash; ` +
              `both reported ${JSON.stringify(e.ownHash)}`,
          );
        }

        // The edit from the first spelling to the second: `e`'s content
        // re-spelled as `f`'s retargets its embedding (a.b → a) and moves the
        // run boundary, so `e`'s ownHash changes and `e` is `changed`.
        await workspace.file("specs/B.mdx", FRAME_B_EDITED);
        const impactContext =
          `${context}: \`impact --base <baseline>\` after editing ` +
          `\`e\`'s content into \`f\`'s spelling`;
        assertCategorized(
          await impactAgainst(product, workspace, baseRef, impactContext),
          FRAME_E,
          "changed",
          "the edit retargets its embedded reference (specs/A.mdx#a.b → " +
            "specs/A.mdx#a) and moves a run boundary, so its ownHash changes " +
            "(SPEC 1.6, 5.5, 5.6); a product hashing a plain concatenation of " +
            "runs and identity strings sees the same input on both sides and " +
            "reports no category",
          impactContext,
        );
      },
    );

    // --- Arm (b): tag boundaries ---
    await withWorkspace(
      { "specs/A.mdx": FRAME_TAGS_SOURCE },
      async (workspace) => {
        await workspace.gitInit();
        const baseRef = await workspace.gitCommitAll("baseline");
        await buildOk(
          product,
          workspace,
          "T5.5-7 arm (b): `build` over the tag-boundary lure",
        );
        const context = "T5.5-7 arm (b), tag boundaries";
        const g = await queryHashes(product, workspace, FRAME_G, `${context}:`);
        const h = await queryHashes(product, workspace, FRAME_H, `${context}:`);
        if (g.metadataHash === h.metadataHash) {
          fail(
            `${context}: ${FRAME_G} (tags="ab", the tag set {ab}) and ` +
              `${FRAME_H} (tags="a b", the tag set {a, b}) are alike but for ` +
              `their tag sets, and hash inputs are framed so that distinct ` +
              `sequences of components never yield the same input — their ` +
              `metadataHashes must differ (SPEC 2.6, 5.5); a product hashing a ` +
              `plain concatenation of the sorted tags gives both one hash; both ` +
              `reported ${JSON.stringify(g.metadataHash)}`,
          );
        }

        // The edit from the first spelling to the second: `g`'s tag set
        // becomes {a, b}, so its metadataHash changes and `g` is
        // `metadata-changed`.
        await workspace.file("specs/A.mdx", FRAME_TAGS_EDITED);
        const impactContext =
          `${context}: \`impact --base <baseline>\` after editing \`g\`'s ` +
          `tags="ab" into tags="a b"`;
        assertCategorized(
          await impactAgainst(product, workspace, baseRef, impactContext),
          FRAME_G,
          "metadata-changed",
          "the edit changes its tag set from {ab} to {a, b}, so its " +
            "metadataHash changes (SPEC 2.6, 5.5, 5.6); a product hashing a " +
            "plain concatenation of the sorted tags sees the same input on both " +
            "sides and reports no category",
          impactContext,
        );
      },
    );
  },
});

/** TEST-SPEC §5.5, in canonical ID order (SUITE-19). */
export const section55Tests: readonly ProductTestEntry[] = [
  T5_5_1,
  T5_5_2,
  T5_5_3,
  T5_5_4,
  T5_5_5,
  T5_5_6,
  T5_5_7,
];
