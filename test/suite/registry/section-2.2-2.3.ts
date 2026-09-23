// TEST-SPEC §2.2 (dependency prop) and §2.3 (embedding requirement text) —
// SUITE-07: T2.2-1 … T2.2-5, T2.3-1, T2.3-2, T2.3-3.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5) and exact bytes where SPEC.md fixes bytes
// (H-4) — Markdown output is fixed by SPEC 3, so every emitted-file
// expectation below is a hand-derived byte string from the fixture's known
// source and the removal/replacement/line-drop rules — decodes output through
// the H-3 adapters, and rejects a product only via diagnosed assertion
// failures (H-8).
//
// SPEC 2.2: `d` accepts a single reference or an array literal of references,
// each either external (a static property chain rooted at an imported module
// — the bare module itself included, targeting that file's root node) or
// local (a static string literal naming a same-file ID), mixable in one
// array; duplicate references to one target collapse to a single edge (5.2);
// `d={[]}` declares no dependencies and is equivalent to omitting the prop;
// the prop records `depends` edges and does not render into Markdown (3).
// SPEC 2.3: `{text(...)}` replaces the expression with the target's compiled
// subtree text in Markdown output and records an `embeds` edge from the
// containing section, with the same external/local duality as `d`, targeting
// any depth, whole files via the module binding included.

import type {
  Finding,
  GraphEdge,
  NodeReport,
} from "../../helpers/adapters/index.js";
import {
  decodeEdgesReport,
  decodeNodeReport,
  decodeViewReport,
} from "../../helpers/adapters/index.js";
import {
  assertFileBytes,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { UnparseableStaging } from "./support.js";
import {
  assertConditionCounts,
  assertEdgeSetEqual,
  assertSameJson,
  buildFindings,
  buildOk,
  expectExit,
  expectFindingFreeReport,
  runJson,
} from "./support.js";

// Minimal declarative configuration (SPEC 7): exactly one spec group.
const SPECS_ONLY_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`;

// As above with Markdown emission enabled (default destination: next to each
// source file, `specs/A.mdx` → `specs/A.md`; SPEC 7.3, 13.2). The spec-group
// globs match only `.mdx` files, so no glob matches an emit destination and
// the discovered set is unaffected by emission (13.4).
const EMIT_TRUE_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  markdown: { emit: true }
})
`;

/** Stage a fresh workspace (config plus `files`), run `body`, dispose (H-1). */
async function withWorkspace<T>(
  config: string,
  files: Readonly<Record<string, string>>,
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

/**
 * The workspace's complete edge set of one dependency kind, via
 * `query edges --kinds <kind>` (SPEC 11: `edges --kinds` filters over the
 * edge kinds). Asserted against an exact expected set, this pins every
 * recorded edge of the kind — none missing, none phantom, no duplicates
 * (edges of each kind form a set, SPEC 5.2).
 */
async function queryEdgesOfKind(
  product: ProductBinding,
  workspace: TestWorkspace,
  kind: "depends" | "embeds",
  context: string,
): Promise<readonly GraphEdge[]> {
  const label = `${context} \`query edges --kinds ${kind}\``;
  return decodeEdgesReport(
    await runJson(
      product,
      workspace,
      ["query", "edges", "--kinds", kind],
      label,
    ),
    label,
  );
}

/**
 * `query node <identity>` decoded through the H-3 adapter, with the resolved
 * identity checked so a mis-addressed report cannot satisfy the assertions.
 */
async function queryNodeReport(
  product: ProductBinding,
  workspace: TestWorkspace,
  identity: string,
  context: string,
): Promise<NodeReport> {
  const label = `${context} \`query node ${identity}\``;
  const node = decodeNodeReport(
    await runJson(product, workspace, ["query", "node", identity], label),
    label,
  );
  if (node.identity !== identity) {
    fail(
      `${label}: expected the report to be about ${JSON.stringify(identity)} (SPEC 1.5), ` +
        `got identity ${JSON.stringify(node.identity)}`,
    );
  }
  return node;
}

// ---------------------------------------------------------------------------
// T2.2-1
// ---------------------------------------------------------------------------

// One workspace holding each accepted `d` form (SPEC 2.2): a single external
// reference, a single local string (braced, per 2.7 — a quoted `d` is
// invalid), and an array mixing both. `alpha` is the local target; `BASE.core`
// the external one.
const T2_2_1_BASE = '<S id="core">\nCore behavior.\n</S>\n';

const T2_2_1_SOURCE = [
  'import BASE from "./BASE.xspec"',
  "",
  '<S id="alpha">',
  "Alpha behavior.",
  "</S>",
  "",
  '<S id="one" d={BASE.core}>',
  "Single external reference.",
  "</S>",
  "",
  '<S id="two" d={"alpha"}>',
  "Single local string.",
  "</S>",
  "",
  '<S id="three" d={[BASE.core, "alpha"]}>',
  "Array mixing external and local references.",
  "</S>",
  "",
].join("\n");

const T2_2_1 = defineProductTest({
  id: "T2.2-1",
  title:
    "a single external reference, a single local string, and an array mixing both each record `depends` edges observable via `query edges --kinds depends` (SPEC 2.2, 5.2)",
  run: async (product) => {
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { "specs/BASE.mdx": T2_2_1_BASE, "specs/A.mdx": T2_2_1_SOURCE },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T2.2-1 `build` with all three accepted `d` forms",
        );
        // These declarations are the workspace's complete `depends` edge set:
        // the external form resolves through the import binding, the local
        // string within the declaring file, and the array records one edge
        // per reference.
        assertEdgeSetEqual(
          await queryEdgesOfKind(product, workspace, "depends", "T2.2-1"),
          [
            {
              from: "specs/A.mdx#one",
              to: "specs/BASE.mdx#core",
              kind: "depends",
            },
            {
              from: "specs/A.mdx#two",
              to: "specs/A.mdx#alpha",
              kind: "depends",
            },
            {
              from: "specs/A.mdx#three",
              to: "specs/BASE.mdx#core",
              kind: "depends",
            },
            {
              from: "specs/A.mdx#three",
              to: "specs/A.mdx#alpha",
              kind: "depends",
            },
          ],
          "T2.2-1 the complete `depends` edge set — one edge per declared reference, " +
            "each form resolved to its target (SPEC 2.2, 5.2)",
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T2.2-2
// ---------------------------------------------------------------------------

// The bare imported module as a `d` target (SPEC 2.2: an external reference
// MAY be the module itself, with no property segments, targeting that file's
// root node). `BASE.mdx` has a section, so a product mis-targeting the file's
// first (or only) section instead of the root — identified by the path alone,
// SPEC 1.5 — is discriminated by the exact `to` identity.
const T2_2_2_BASE = '<S id="core">\nCore behavior.\n</S>\n';

const T2_2_2_SOURCE = [
  'import BASE from "./BASE.xspec"',
  "",
  '<S id="whole" d={BASE}>',
  "Depends on the imported file as a whole.",
  "</S>",
  "",
].join("\n");

const T2_2_2 = defineProductTest({
  id: "T2.2-2",
  title:
    "`d={BASE}` (bare imported module) records a `depends` edge to the imported file's root node (SPEC 2.2, 1.5)",
  run: async (product) => {
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { "specs/BASE.mdx": T2_2_2_BASE, "specs/A.mdx": T2_2_2_SOURCE },
      async (workspace) => {
        await buildOk(product, workspace, "T2.2-2 `build` with `d={BASE}`");
        assertEdgeSetEqual(
          await queryEdgesOfKind(product, workspace, "depends", "T2.2-2"),
          [
            {
              from: "specs/A.mdx#whole",
              to: "specs/BASE.mdx",
              kind: "depends",
            },
          ],
          "T2.2-2 the complete `depends` edge set — exactly one edge, to the imported " +
            "file's root node (the path alone, SPEC 1.5), not to any section of it",
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T2.2-3
// ---------------------------------------------------------------------------

// The TEST-SPEC's exact duplicated array: `[BASE.a.b, BASE.a.b, "x.y", "x.y"]`
// — each target referenced twice in one `d` array. Exactly one edge per
// target must be recorded (SPEC 2.2, 5.2: edges of each kind form a set).
const T2_2_3_BASE = [
  '<S id="a">',
  "A text.",
  "",
  '<S id="a.b">',
  "B text.",
  "</S>",
  "</S>",
  "",
].join("\n");

const T2_2_3_SOURCE = [
  'import BASE from "./BASE.xspec"',
  "",
  '<S id="x">',
  "X text.",
  "",
  '<S id="x.y">',
  "Y text.",
  "</S>",
  "</S>",
  "",
  '<S id="dup" d={[BASE.a.b, BASE.a.b, "x.y", "x.y"]}>',
  "Duplicate references to each of two targets.",
  "</S>",
  "",
].join("\n");

const T2_2_3 = defineProductTest({
  id: "T2.2-3",
  title:
    "duplicate references to one target in a single `d` array collapse to exactly one edge per target (SPEC 2.2, 5.2)",
  run: async (product) => {
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { "specs/BASE.mdx": T2_2_3_BASE, "specs/A.mdx": T2_2_3_SOURCE },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T2.2-3 `build` with duplicated references in one `d` array",
        );
        // The exact-set comparison rejects both a product recording one edge
        // per declaration (four edges) and a query surface reporting the
        // collapsed edges more than once.
        assertEdgeSetEqual(
          await queryEdgesOfKind(product, workspace, "depends", "T2.2-3"),
          [
            {
              from: "specs/A.mdx#dup",
              to: "specs/BASE.mdx#a.b",
              kind: "depends",
            },
            { from: "specs/A.mdx#dup", to: "specs/A.mdx#x.y", kind: "depends" },
          ],
          "T2.2-3 the complete `depends` edge set — exactly one edge per target of " +
            '`d={[BASE.a.b, BASE.a.b, "x.y", "x.y"]}` (SPEC 2.2, 5.2)',
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T2.2-4
// ---------------------------------------------------------------------------

// Two variants of one file, differing only in `d={[]}` versus no `d` prop.
// SPEC 2.2: an empty array declares no dependencies and is equivalent to
// omitting the prop — no edges either way, and the node's metadataHash (the
// hash of its `d` target set, coverage attribute, and tags, SPEC 5.5) must be
// byte-identical across the variants. Both variants are built in the same
// workspace directory, so nothing but the prop's presence varies.
const T2_2_4_EMPTY_ARRAY = '<S id="node" d={[]}>\nNode behavior.\n</S>\n';
const T2_2_4_OMITTED = '<S id="node">\nNode behavior.\n</S>\n';
const T2_2_4_NODE = "specs/A.mdx#node";

const T2_2_4 = defineProductTest({
  id: "T2.2-4",
  title:
    "`d={[]}` builds like omitting the prop: no edges recorded, and the node's metadataHash equals the omitted-prop variant's (SPEC 2.2, 5.5)",
  run: async (product) => {
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { "specs/A.mdx": T2_2_4_EMPTY_ARRAY },
      async (workspace) => {
        await buildOk(product, workspace, "T2.2-4 `build` with `d={[]}`");
        assertEdgeSetEqual(
          await queryEdgesOfKind(
            product,
            workspace,
            "depends",
            "T2.2-4 with `d={[]}`:",
          ),
          [],
          "T2.2-4 `d={[]}` declares no dependencies — the workspace has no `depends` " +
            "edge (SPEC 2.2)",
        );
        const emptyArray = await queryNodeReport(
          product,
          workspace,
          T2_2_4_NODE,
          "T2.2-4 with `d={[]}`:",
        );

        await workspace.file("specs/A.mdx", T2_2_4_OMITTED);
        await buildOk(
          product,
          workspace,
          "T2.2-4 `build` with the `d` prop omitted",
        );
        assertEdgeSetEqual(
          await queryEdgesOfKind(
            product,
            workspace,
            "depends",
            "T2.2-4 with the prop omitted:",
          ),
          [],
          "T2.2-4 the omitted-prop variant records no `depends` edge either (SPEC 2.2)",
        );
        const omitted = await queryNodeReport(
          product,
          workspace,
          T2_2_4_NODE,
          "T2.2-4 with the prop omitted:",
        );

        assertSameJson(
          emptyArray.hashes.metadataHash,
          omitted.hashes.metadataHash,
          `T2.2-4 metadataHash of ${T2_2_4_NODE} — \`d={[]}\` is equivalent to omitting ` +
            "the prop, so both variants hash the same empty `d` target set (with the " +
            "same coverage attribute and tags, SPEC 2.2, 5.5)",
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T2.2-5
// ---------------------------------------------------------------------------

// Every accepted `d` form under Markdown emission (SPEC 3: the output removes
// `<S>`/`<Spec>` tags together with their props — `d` included — and the `d`
// prop does not render, SPEC 2.2). The in-line section is the sharpest probe:
// its line is kept (non-whitespace content remains after tag removal), so any
// surviving byte of the `d` prop lands in the kept line and fails the byte
// comparison.
const T2_2_5_BASE = '<S id="core">\nCore behavior.\n</S>\n';

const T2_2_5_SOURCE = [
  'import BASE from "./BASE.xspec"',
  "",
  '<S id="alpha">',
  "Alpha behavior.",
  "</S>",
  "",
  '<S id="one" d={BASE.core}>',
  "One behavior.",
  "</S>",
  "",
  '<S id="two" d={[BASE.core, "alpha"]}>',
  "Two behavior.",
  "</S>",
  "",
  '<S id="three" d={BASE}>',
  "Three behavior.",
  "</S>",
  "",
  '<S id="inline" d={"alpha"}>Inline: kept text.</S>',
  "",
].join("\n");

// Hand-derived per SPEC 3: the import line and every tag-only line are
// emptied purely by removals and drop with their terminators; the blank
// separator lines were already empty in the source and are kept; the in-line
// section's line keeps its remaining content and terminator. No byte of any
// `d` form (external chain, array, bare module, local string) survives.
const T2_2_5_COMPILED =
  "\nAlpha behavior.\n\nOne behavior.\n\nTwo behavior.\n\nThree behavior.\n\nInline: kept text.\n";

const T2_2_5 = defineProductTest({
  id: "T2.2-5",
  title:
    "Markdown output contains no trace of the `d` prop in any of its forms (SPEC 2.2, 3)",
  run: async (product) => {
    await withWorkspace(
      EMIT_TRUE_CONFIG,
      { "specs/BASE.mdx": T2_2_5_BASE, "specs/A.mdx": T2_2_5_SOURCE },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T2.2-5 `build` with emission enabled over every `d` form",
        );
        await assertFileBytes(
          workspace.path("specs/A.md"),
          T2_2_5_COMPILED,
          "T2.2-5 emitted Markdown (SPEC 3) — byte equality of the whole output, so " +
            "no trace of any `d` prop form can survive (SPEC 2.2)",
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T2.3-1
// ---------------------------------------------------------------------------

// The TEST-SPEC's exact expression, `{text(BASE.auth.login)}`. The target has
// a child, so its subtree text ("Login behavior.\n\nMFA required.\n") differs
// from its own text ("Login behavior.\n\n") — a product embedding own text
// instead of compiled subtree text fails the byte comparison (SPEC 2.3, 1.6).
const T2_3_1_BASE = [
  '<S id="auth">',
  "Auth intro.",
  "",
  '<S id="auth.login">',
  "Login behavior.",
  "",
  '<S id="auth.login.mfa">',
  "MFA required.",
  "</S>",
  "</S>",
  "</S>",
  "",
].join("\n");

const T2_3_1_SOURCE = [
  'import BASE from "./BASE.xspec"',
  "",
  '<S id="summary">',
  "As specified:",
  "",
  "{text(BASE.auth.login)}",
  "</S>",
  "",
].join("\n");

// The target's compiled subtree text (SPEC 1.6, 3): within its construct the
// tag-only lines drop with their terminators; the prose lines and the blank
// separator are kept byte-for-byte.
const T2_3_1_TARGET_SUBTREE = "Login behavior.\n\nMFA required.\n";

// The embedding file's compiled output: import line and tag-only lines drop;
// the embedding line's expression is replaced in place by the target's
// subtree text, and the line — non-empty after replacement — keeps its
// remaining content and its own terminator (SPEC 3).
const T2_3_1_COMPILED = `\nAs specified:\n\n${T2_3_1_TARGET_SUBTREE}\n`;

const T2_3_1 = defineProductTest({
  id: "T2.3-1",
  title:
    "`{text(BASE.auth.login)}` replaces the expression with the target's compiled subtree text in Markdown output (byte-asserted) and records an `embeds` edge from the containing section (SPEC 2.3, 3, 1.6)",
  run: async (product) => {
    await withWorkspace(
      EMIT_TRUE_CONFIG,
      { "specs/BASE.mdx": T2_3_1_BASE, "specs/A.mdx": T2_3_1_SOURCE },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T2.3-1 `build` with a `{text(...)}` embedding",
        );
        await assertFileBytes(
          workspace.path("specs/A.md"),
          T2_3_1_COMPILED,
          "T2.3-1 emitted Markdown — the expression replaced by the target's compiled " +
            "subtree text, its child's contribution included (SPEC 2.3, 3, 1.6)",
        );
        assertEdgeSetEqual(
          await queryEdgesOfKind(product, workspace, "embeds", "T2.3-1"),
          [
            {
              from: "specs/A.mdx#summary",
              to: "specs/BASE.mdx#auth.login",
              kind: "embeds",
            },
          ],
          "T2.3-1 the complete `embeds` edge set — exactly one edge, from the " +
            "containing section to the embedded target (SPEC 2.3, 5.2)",
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T2.3-2
// ---------------------------------------------------------------------------

// Both argument forms at depth, plus a whole-file embedding (SPEC 2.3, 2.2):
// - `{text("x.y")}` — string form, resolved within the same file. BASE also
//   contains a node `x.y` (the decoy): a product resolving the local string
//   in the imported file records the wrong edge and embeds "Decoy deep
//   text.", failing both assertions.
// - `{text(BASE.a.b.c)}` — node form, three segments deep.
// - `{text(BASE)}` — the bare module binding: embeds the whole file, i.e. the
//   root's subtree text, which is the entire compiled output (SPEC 1.6) —
//   byte-anchored below against BASE's own emitted Markdown.
const T2_3_2_BASE = [
  '<S id="a">',
  "A text.",
  "",
  '<S id="a.b">',
  "B text.",
  "",
  '<S id="a.b.c">',
  "C text.",
  "</S>",
  "</S>",
  "</S>",
  "",
  '<S id="x">',
  "Decoy x.",
  "",
  '<S id="x.y">',
  "Decoy deep text.",
  "</S>",
  "</S>",
  "",
].join("\n");

const T2_3_2_SOURCE = [
  'import BASE from "./BASE.xspec"',
  "",
  '<S id="x">',
  "X intro.",
  "",
  '<S id="x.y">',
  "Deep local text.",
  "</S>",
  "</S>",
  "",
  '<S id="summary">',
  'Local: {text("x.y")}',
  "Deep: {text(BASE.a.b.c)}",
  "Whole:",
  "",
  "{text(BASE)}",
  "</S>",
  "",
].join("\n");

// Hand-derived per SPEC 3 (tag-only and import lines drop with terminators;
// prose and blank source lines are kept; replacements are in place).
const T2_3_2_LOCAL_TARGET_SUBTREE = "Deep local text.\n";
const T2_3_2_DEEP_TARGET_SUBTREE = "C text.\n";
// BASE's entire compiled output — the root's subtree text (SPEC 1.6).
const T2_3_2_BASE_COMPILED =
  "A text.\n\nB text.\n\nC text.\n\nDecoy x.\n\nDecoy deep text.\n";
// The embedding file: each embedding line keeps its remaining content — the
// prefix plus the expansion — and its own terminator.
const T2_3_2_COMPILED =
  `\nX intro.\n\n${T2_3_2_LOCAL_TARGET_SUBTREE}\n` +
  `Local: ${T2_3_2_LOCAL_TARGET_SUBTREE}\n` +
  `Deep: ${T2_3_2_DEEP_TARGET_SUBTREE}\n` +
  `Whole:\n\n${T2_3_2_BASE_COMPILED}\n`;

const T2_3_2 = defineProductTest({
  id: "T2.3-2",
  title:
    "string-form `text(...)` resolves within the same file; both forms target any depth, including a whole file via the module binding (root target) (SPEC 2.3, 2.2, 1.6)",
  run: async (product) => {
    await withWorkspace(
      EMIT_TRUE_CONFIG,
      { "specs/BASE.mdx": T2_3_2_BASE, "specs/A.mdx": T2_3_2_SOURCE },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T2.3-2 `build` with string-form, deep, and whole-file embeddings",
        );
        // BASE's own emitted Markdown first: the whole-file expansion below
        // is anchored to the target file's actual compiled output.
        await assertFileBytes(
          workspace.path("specs/BASE.md"),
          T2_3_2_BASE_COMPILED,
          "T2.3-2 emitted Markdown of the embedded file (SPEC 3)",
        );
        await assertFileBytes(
          workspace.path("specs/A.md"),
          T2_3_2_COMPILED,
          "T2.3-2 emitted Markdown of the embedding file — the local string expands " +
            "to the same-file node's text (not the decoy's), the deep node form to " +
            "the depth-three target's subtree text, and `{text(BASE)}` to the whole " +
            "file's compiled output (SPEC 2.3, 3, 1.6)",
        );
        assertEdgeSetEqual(
          await queryEdgesOfKind(product, workspace, "embeds", "T2.3-2"),
          [
            {
              from: "specs/A.mdx#summary",
              to: "specs/A.mdx#x.y",
              kind: "embeds",
            },
            {
              from: "specs/A.mdx#summary",
              to: "specs/BASE.mdx#a.b.c",
              kind: "embeds",
            },
            {
              from: "specs/A.mdx#summary",
              to: "specs/BASE.mdx",
              kind: "embeds",
            },
          ],
          "T2.3-2 the complete `embeds` edge set — the string form resolved within " +
            "the same file (specs/A.mdx#x.y, not the decoy specs/BASE.mdx#x.y), the " +
            "node form at depth three, and the bare module binding targeting the " +
            "imported file's root node (SPEC 2.3, 2.2, 1.5)",
        );
      },
    );
  },
});

/** TEST-SPEC §2.2–2.3, in canonical ID order (SUITE-07). */
// ---------------------------------------------------------------------------
// T2.3-3
// ---------------------------------------------------------------------------

// SPEC 2.3 fixes what an embedding is: an expression container, in flow or
// text position, whose one expression (14.20) is a call — optional chaining
// excluded — whose callee is the identifier `text` itself, spelled plainly,
// neither parenthesized nor escaped (2.4), whatever whitespace and comments
// stand beside the call; a container holding any other expression is an
// invalid construct (14.16), and one whose content the grammar derives as no
// expression leaves the file unparseable (14.20, 2.7). Every staging below is
// one file: the target `a` as an in-line section — its subtree text exactly
// `Alpha text.` (SPEC 3: the tag pair deleted in place, the line's terminator
// lying outside the construct) — a blank line, then a section holding the
// form under test alone on its line(s), in flow position. Everything staged
// is ASCII, so string lengths are byte counts (SPEC 1.7), and every range is
// computed from the staged bytes. The line terminator and the backslash are
// built from code points, never spelled as escapes in this source.
const T2_3_3_LF = String.fromCharCode(0x0a); // U+000A
const T2_3_3_BACKSLASH = String.fromCharCode(0x5c); // U+005C
const T2_3_3_FILE = "specs/A.mdx";
const T2_3_3_TARGET_TAG = '<S id="a">Alpha text.</S>';
const T2_3_3_TARGET_SUBTREE = "Alpha text.";
/** The file's head: the target's line and a blank line. */
const T2_3_3_HEAD = `${T2_3_3_TARGET_TAG}${T2_3_3_LF}${T2_3_3_LF}`;

interface T233Staging {
  readonly source: string;
  /** The form's container: opening brace through closing brace (SPEC 5.7). */
  readonly container: { readonly start: number; readonly end: number };
  /** The enclosing section's construct range (SPEC 1.7). */
  readonly section: { readonly start: number; readonly end: number };
}

/** The head, then `<S id="…">` LF `<form>` LF `</S>` LF, with both ranges. */
function stageT233(sectionId: string, form: string): T233Staging {
  const opening = `<S id="${sectionId}">${T2_3_3_LF}`;
  const closing = `${T2_3_3_LF}</S>`;
  const sectionStart = Buffer.byteLength(T2_3_3_HEAD, "utf8");
  const containerStart = sectionStart + Buffer.byteLength(opening, "utf8");
  const containerEnd = containerStart + Buffer.byteLength(form, "utf8");
  return {
    source: `${T2_3_3_HEAD}${opening}${form}${closing}${T2_3_3_LF}`,
    container: { start: containerStart, end: containerEnd },
    section: {
      start: sectionStart,
      end: containerEnd + Buffer.byteLength(closing, "utf8"),
    },
  };
}

// The embedding forms (SPEC 2.3; TEST-SPEC T2.3-3): each an embedding whatever
// whitespace and comments stand beside the call — what follows the one
// expression being whitespace and comments alone (14.20); the two-line forms'
// line comment ended by the interior terminator under 14.20's deletion
// judgement; and the run-on form's first `}` lying on the commented-out line,
// closing nothing, the container running to the second `}` at which its
// content derives as the call (14.20, 2.7; the empty twin is T2.7-4's). A
// product ending every container at its first `}`, recognizing the run-on
// for empty containers alone, or stripping only leading trivia when
// classifying the callee fails one of these arms.
const T2_3_3_EMBEDDING_FORMS: readonly {
  readonly label: string;
  readonly form: string;
}[] = [
  { label: "whitespace around the call", form: '{ text("a") }' },
  { label: "a block comment before the call", form: '{/* n */ text("a")}' },
  { label: "a block comment after the call", form: '{text("a") /* n */}' },
  {
    label: "a line comment before the call, ended by the interior terminator",
    form: `{// n${T2_3_3_LF}text("a")}`,
  },
  {
    label: "the run-on form, its first brace on the commented-out line",
    form: `{// c}${T2_3_3_LF}text("a")}`,
  },
];

// Hand-derived per SPEC 3, the same for every embedding staging: the target's
// line keeps `Alpha text.` and its terminator (the tags deleted in place); the
// blank line stays; the section's tag-only lines drop with their terminators;
// the container — comment, whitespace, and interior terminator included — is
// replaced whole by the target's subtree text, the (joined) line keeping its
// remaining content and its last terminator.
const T2_3_3_EMBEDDING_COMPILED =
  `${T2_3_3_TARGET_SUBTREE}${T2_3_3_LF}${T2_3_3_LF}` +
  `${T2_3_3_TARGET_SUBTREE}${T2_3_3_LF}`;

// The invalid-container forms (SPEC 2.3, 2.4, 2.7; 14.16): each derives as one
// expression that is no plain `text(...)` call — one condition-16 finding
// located brace through brace, no edge, no occurrence, never 14.6 and never
// 14.8 — and its bytes are content under 11.2's by-form classification:
// preserved byte-for-byte in the enclosing section's text and located by the
// finding (T11.2-4). The escaped callee spells `te`, a backslash, `u0078t`:
// read as spelled, it is not `text` (SPEC 2.4).
const T2_3_3_INVALID_FORMS: readonly {
  readonly label: string;
  readonly form: string;
}[] = [
  { label: "a parenthesized callee", form: '{(text)("a")}' },
  {
    label: "an escaped callee — spelled escaped, not `text` (SPEC 2.4)",
    form: `{te${T2_3_3_BACKSLASH}u0078t("a")}`,
  },
  { label: "an optional call", form: '{text?.("a")}' },
  {
    label: "a comma sequence — one expression, not a call (SPEC 14.20)",
    form: '{text("a"), 1}',
  },
  {
    label: "`await` before the call — `await` derives (SPEC 14.20)",
    form: '{await text("a")}',
  },
];

// `{text("a") text("b")}`: no expression the grammar derives — 14.20 (SPEC
// 2.7), never 14.16 — its zero-length range at the offset SPEC 14's
// syntax-failure rule fixes: the byte length of the longest whole-character
// prefix of the file with which some well-formed file begins. The prefix
// through the space after the first call begins one (`{text("a") }` continues
// it); no well-formed file continues a complete expression with an
// identifier; so the offset is the second `text`'s (T14-11 re-asserts it;
// T14-12). Authoring note: the stock MDX parser positions its rejection one
// byte earlier, at that space (acorn's "Unexpected content after expression"
// points at the end of the parsed expression) — the rule of 14, not the
// parser's message, fixes the offset.
const T2_3_3_UNPARSEABLE_PREFIX = '{text("a") ';
const T2_3_3_UNPARSEABLE_FORM = `${T2_3_3_UNPARSEABLE_PREFIX}text("b")}`;

/**
 * The unparseable staging and its pinned offset — the very bytes the arm
 * below drives, staged alone in section `u`, the offset the container's
 * start plus the byte length of the prefix through the space after the
 * first call — exported for T14-11's re-assertion of the offset the same
 * way (TEST-SPEC T14-11's closing clause; the S-9 `unparseable` declaration
 * accompanies it wherever it is staged).
 */
export const T2_3_3_UNPARSEABLE_STAGING: UnparseableStaging = (() => {
  const staging = stageT233("u", T2_3_3_UNPARSEABLE_FORM);
  return {
    name:
      `\`${T2_3_3_UNPARSEABLE_FORM}\` — no expression the grammar derives, ` +
      "the zero-length range at the offset of the second `text` (T2.3-3)",
    kind: "spec-source",
    file: T2_3_3_FILE,
    files: { [T2_3_3_FILE]: staging.source },
    offset:
      staging.container.start +
      Buffer.byteLength(T2_3_3_UNPARSEABLE_PREFIX, "utf8"),
  };
})();

/** The one finding of `condition` (its count asserted beforehand). */
function t233FindingOf(
  findings: readonly Finding[],
  condition: string,
  context: string,
): Finding {
  const matches = findings.filter((finding) => finding.condition === condition);
  if (matches.length !== 1) {
    fail(
      `${context}: expected exactly one ${condition} finding, got ` +
        `${String(matches.length)}`,
    );
  }
  return matches[0]!;
}

/**
 * Assert a located finding's concern exactly (SPEC 14, 12.7): `path` null,
 * and exactly one location — in specs/A.mdx, at exactly `range`.
 */
function assertT233FindingRange(
  finding: Finding,
  range: { readonly start: number; readonly end: number },
  context: string,
): void {
  assertSameJson(
    finding.path,
    null,
    `${context} — a located condition's concerned path is null (SPEC 12.7)`,
  );
  assertSameJson(
    finding.locations.map((location) => ({
      file: location.file,
      range: { start: location.range.start, end: location.range.end },
    })),
    [{ file: T2_3_3_FILE, range: { start: range.start, end: range.end } }],
    `${context} (message: ${JSON.stringify(finding.message)})`,
  );
}

const T2_3_3 = defineProductTest({
  id: "T2.3-3",
  title:
    'an embedding is a container whose one expression is a plain `text(...)` call, whatever whitespace and comments stand beside it: five forms (the run-on `{// c}` form included) each build clean, record their `embeds` edge and a full-container occurrence with no `comments` entry, and compile to the target\'s subtree text (byte-asserted); five invalid-container forms are each one 14.16 finding brace through brace — never 14.6 or 14.8 — with no occurrence, their bytes content under `view --text`; and `{text("a") text("b")}` is 14.20 at the offset of the second `text` (SPEC 2.3, 2.4, 2.7, 3, 5.7, 11.2, 11.4, 14.16, 14.20)',
  run: async (product) => {
    // --- the embedding forms, each staged alone in section `p` ---------------
    for (const { label, form } of T2_3_3_EMBEDDING_FORMS) {
      const staging = stageT233("p", form);
      const arm = `T2.3-3 embedding form ${JSON.stringify(form)} (${label})`;
      await withWorkspace(
        EMIT_TRUE_CONFIG,
        { [T2_3_3_FILE]: staging.source },
        async (workspace) => {
          await expectFindingFreeReport(
            product,
            workspace,
            ["build", "--json"],
            `${arm} — \`build\` exit 0 with no finding: the container is an ` +
              `embedding, the whitespace and comments beside its call ` +
              `notwithstanding (SPEC 2.3, 14.20)`,
          );
          await assertFileBytes(
            workspace.path("specs/A.md"),
            T2_3_3_EMBEDDING_COMPILED,
            `${arm} — emitted Markdown: the whole container — comment, ` +
              `whitespace, and interior terminator included — replaced by ` +
              `the target's subtree text (SPEC 3, 2.3)`,
          );
          assertEdgeSetEqual(
            await queryEdgesOfKind(product, workspace, "embeds", arm),
            [{ from: "specs/A.mdx#p", to: "specs/A.mdx#a", kind: "embeds" }],
            `${arm} — the complete \`embeds\` edge set: the one edge from the ` +
              `containing section to the target (SPEC 2.3, 5.2)`,
          );
          const viewContext = `${arm} \`view ${T2_3_3_FILE}\``;
          const report = decodeViewReport(
            await runJson(
              product,
              workspace,
              ["view", T2_3_3_FILE],
              viewContext,
            ),
            { text: false },
            viewContext,
          );
          assertSameJson(
            report.findings,
            [],
            `${viewContext} — the consulted domain is finding-free (SPEC 11.2)`,
          );
          if (report.views.length !== 1) {
            fail(
              `${viewContext}: expected exactly one per-file view (SPEC 11.4), ` +
                `got ${String(report.views.length)}`,
            );
          }
          const view = report.views[0]!;
          assertSameJson(
            view.comments,
            [],
            `${viewContext} — an embedding is no MDX comment: no \`comments\` ` +
              `entry, the comment beside its call notwithstanding (SPEC 11.4, 2.7)`,
          );
          assertSameJson(
            view.occurrences,
            [
              {
                file: T2_3_3_FILE,
                range: staging.container,
                kind: "embeds",
                source: { identity: "specs/A.mdx#p", range: staging.section },
                target: "specs/A.mdx#a",
              },
            ],
            `${viewContext} — exactly one occurrence, spanning the full ` +
              `container, opening brace through closing brace — the interior ` +
              `terminator included for a two-line form — with its source ` +
              `section and its target (SPEC 5.7, 11.4, 1.7)`,
          );
        },
      );
    }

    // --- the invalid-container forms, each staged alone in section `n` ------
    for (const { label, form } of T2_3_3_INVALID_FORMS) {
      const staging = stageT233("n", form);
      const arm = `T2.3-3 invalid container ${JSON.stringify(form)} (${label})`;
      await withWorkspace(
        SPECS_ONLY_CONFIG,
        { [T2_3_3_FILE]: staging.source },
        async (workspace) => {
          const buildContext = `${arm} \`build --json\``;
          const findings = await buildFindings(
            product,
            workspace,
            buildContext,
          );
          assertConditionCounts(
            findings,
            { "14.16": 1 },
            `${buildContext} — exactly one finding, condition 16: the ` +
              `container is no embedding, so never 14.6 and never 14.8 ` +
              `(SPEC 2.3, 14.16)`,
          );
          assertT233FindingRange(
            t233FindingOf(findings, "14.16", buildContext),
            staging.container,
            `${buildContext} — the invalid container located from its ` +
              `opening brace through its closing brace (SPEC 14)`,
          );

          // 11.2's by-form classification: the container's bytes are
          // content, preserved byte-for-byte in the enclosing section's text
          // and located by the finding; no occurrence, no comments entry.
          const viewContext = `${arm} \`view --text ${T2_3_3_FILE}\``;
          const result = await expectExit(
            product,
            workspace,
            ["view", "--text", T2_3_3_FILE],
            1,
            `${viewContext} — the finding accompanies, so exit 1 with the ` +
              `full answer (SPEC 11.2)`,
          );
          const report = decodeViewReport(
            parseJsonStdout(result, viewContext),
            { text: true },
            viewContext,
          );
          assertConditionCounts(
            report.findings,
            { "14.16": 1 },
            `${viewContext} — the domain file's one finding accompanies the ` +
              `answer (SPEC 11.2)`,
          );
          assertT233FindingRange(
            t233FindingOf(report.findings, "14.16", viewContext),
            staging.container,
            `${viewContext} — the container located by its finding (SPEC 11.2, 14)`,
          );
          if (report.views.length !== 1) {
            fail(
              `${viewContext}: expected exactly one per-file view (SPEC 11.4), ` +
                `got ${String(report.views.length)}`,
            );
          }
          const view = report.views[0]!;
          assertSameJson(
            [view.occurrences, view.comments],
            [[], []],
            `${viewContext} — no occurrence and no \`comments\` entry: the ` +
              `container is neither an embedding nor a comment (SPEC 5.7, 11.4, 2.7)`,
          );
          const enclosingText = `${form}${T2_3_3_LF}`;
          assertSameJson(
            {
              identity: view.root.identity,
              subtreeText: view.root.subtreeText,
              children: view.root.children.map((child) => ({
                identity: child.identity,
                ownText: child.ownText,
                subtreeText: child.subtreeText,
                children: child.children.length,
              })),
            },
            {
              identity: T2_3_3_FILE,
              subtreeText:
                `${T2_3_3_TARGET_SUBTREE}${T2_3_3_LF}${T2_3_3_LF}` +
                enclosingText,
              children: [
                {
                  identity: "specs/A.mdx#a",
                  ownText: T2_3_3_TARGET_SUBTREE,
                  subtreeText: T2_3_3_TARGET_SUBTREE,
                  children: 0,
                },
                {
                  identity: "specs/A.mdx#n",
                  ownText: enclosingText,
                  subtreeText: enclosingText,
                  children: 0,
                },
              ],
            },
            `${viewContext} — the container matches no removal rule's form, so ` +
              `its bytes are content: preserved byte-for-byte, with its line's ` +
              `terminator, as the enclosing section's whole text (the tag-only ` +
              `lines dropped), and in the root's subtree text — the file's ` +
              `compiled output — after the target's line and the blank line; ` +
              `the target's text defined and exact (SPEC 11.2, 1.6, 3)`,
          );
        },
      );
    }

    // --- `{text("a") text("b")}`: unparseable, at the second `text` -----------
    const { offset } = T2_3_3_UNPARSEABLE_STAGING;
    const workspace = await TestWorkspace.create({
      files: {
        "xspec.config.ts": SPECS_ONLY_CONFIG,
        ...T2_3_3_UNPARSEABLE_STAGING.files,
      },
      // S-9: the one form TEST-SPEC declares unparseable (14.20).
      mdx: { unparseable: [T2_3_3_FILE] },
    });
    try {
      const context = `T2.3-3 \`build --json\` over ${JSON.stringify(T2_3_3_UNPARSEABLE_FORM)}`;
      const findings = await buildFindings(product, workspace, context);
      assertConditionCounts(
        findings,
        { "14.20": 1 },
        `${context} — no expression the grammar derives: the file is ` +
          `unparseable, 14.20 alone and never 14.16 (SPEC 2.7, 14.20)`,
      );
      assertT233FindingRange(
        t233FindingOf(findings, "14.20", context),
        { start: offset, end: offset },
        `${context} — the one zero-length range at the offset of the second ` +
          `\`text\`: the byte length of the longest whole-character prefix ` +
          `with which some well-formed file begins — through the space after ` +
          `the first call (SPEC 14; T14-11, T14-12)`,
      );
    } finally {
      await workspace.dispose();
    }
  },
});

export const section22to23Tests: readonly ProductTestEntry[] = [
  T2_2_1,
  T2_2_2,
  T2_2_3,
  T2_2_4,
  T2_2_5,
  T2_3_1,
  T2_3_2,
  T2_3_3,
];
