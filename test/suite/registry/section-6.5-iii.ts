// TEST-SPEC §6.5 (move), third part — SUITE-25 (continued): T6.5-12, the
// target file's own references to moved nodes, T6.5-13, admissible offsets
// and composition in pre-operation coordinates, T6.5-14, a created target
// file's fixed content, T6.5-15, joint import removals over an ESM block,
// and T6.5-16, `refused-invalid-rewrite`. T6.5-1…T6.5-10 are
// section-6.5.ts's business and T6.5-11 section-6.5-ii.ts's; this module
// keeps both files' edits bounded (the section-10.7-i/-ii precedent).
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), decodes output through the H-3 adapters,
// and rejects a product only via diagnosed assertion failures (H-8).
//
// SPEC 6.5 (reference spellings): the operation roots each reference
// spelling whose target's identity the mapping changes at the form in which
// it resolves in the file where it will stand after the operation — local
// form where that file is the source of the module its target then belongs
// to, "as is the target file's own reference, through a binding of the
// origin module, to a node of the moved subtree" (the fourth conversion
// direction; T6.5-7 pins imported→local inside the moved text, T6.5-8 the
// two local→imported directions). SPEC 6.4 pins a converted reference's
// spelling: a double-quoted string literal carrying the identity's
// characters verbatim. SPEC 6.5 (import edits): an existing spec module
// import is removed exactly when an occurrence used a binding of its before
// the rewrite and none uses any binding of its after it; a removal deletes
// the declaration's own characters in place, and a line left empty purely
// by that deletion is dropped with its terminator (3) — a block every line
// of which is dropped is headed by nothing, its first declaration removed
// with the rest — while an import a use remains for stays byte-for-byte.
// SPEC 6.5 (created target file): a created target file's initial content
// is fixed instead of chosen — the declarations it needs, each followed by
// U+000A, in an order the implementation fixes deterministically, then,
// when there is at least one, one further U+000A (the empty line ending the
// ESM block), then the moved text and its terminator; an added declaration
// is spelled `import X from "…"`, the specifier double-quoted in the
// canonical relative spelling, its identifier fresh: colliding with no
// binding already in the file, distinct from the others added there, and
// none of the compiler-provided names (2.1).
//
// Conservative operationalizations (noted per H-4):
// - T6.5-12 stages no import addition (no reference the moved text carries
//   needs a binding the target lacks), so the target's post-move bytes are
//   composed whole from 6.4/6.5 and 3 with no latitude and asserted
//   byte-equal: the moved text landing at end of file after a terminated
//   final line (no preceding U+000A, T6.5-2), the target's own two
//   references rewritten in 6.4's pinned spellings (`d={"y"}`,
//   `{text("y")}`), and, in the removal arm, the origin-module
//   declaration's line dropped with its terminator while the blank line
//   that followed it — blank before the deletion — stays, so the file
//   opens with that terminator (T6.5-7's exact extent); in the retention
//   arm the declaration and its line are untouched.
// - T6.5-14's fresh identifiers and the two declarations' order are the
//   only unpinned runs. The identifiers are read off the moved text's
//   rewritten references — the one place 6.4's pinned spellings make them
//   observable: exactly one `d={<O>.s}` and exactly one `{text(<X>.q)}` in
//   the created file — and the whole file is then composed byte-exactly for
//   each of the two orders, each declaration `import <I> from "<canonical
//   specifier>"` (6.5's spelling; the specifier through
//   `canonicalSpecifier`), the actual bytes accepted when equal to either.
//   The identifiers must be distinct and none of the compiler-provided
//   names (SPEC 2.1, 6.5); a product binding the origin's own `X` again is
//   admissible (the created file held no binding to collide with).
// - "`build` and `check` are clean" is each command's `--json` report
//   decoded as exactly `{"findings": []}` at exit 0.
// - T6.5-14's category expectation (SPEC 5.6; P-5's added-node convention)
//   is asserted against `impact --base <pre-move ref> --json` over a
//   baseline committed before the move: the created file's root carries
//   exactly `changed` — an added node receives no category through its own
//   hashes — its attribution bounded by the fixture's originating nodes,
//   the departed/arrived child tolerated as T6.2-3 tolerates it and the
//   empty list accepted (the SUITE-20 convention); the moved subtree, the
//   referenced sibling leaf, and the third module's nodes appear in no
//   entry; the origin root carries `changed` (its own content lost a child,
//   5.5) and at most the two-sided `descendant-changed` T6.2-3 tolerates,
//   attributed to the moved node; no entry is `deleted`; no code location
//   is impacted (no code group is configured).
// - T6.5-13 (arms (a) through (f)) composes the receiving file whole for
//   each arm, value-blind in the fresh identifier alone, read from the
//   added declaration line (exactly one `import <X> from "./x.xspec"`);
//   the cross-file origin keeps a second use of `X` in a sibling, so its
//   declaration stays and the origin's expectation is the deletion's
//   alone (the removal side is T6.5-10's and T6.5-14's business). The
//   preview is taken before the real move and its edits for the
//   receiving file are asserted exactly afterwards (12.7's order, the
//   class-name tie-break included); for the same-file arms (e)/(f) the
//   `target-insertion` is admitted at the insertion point or at the
//   collapsed deletion's start (two pre-operation offsets, one composed
//   position: T6.6-4(b)'s latitude). The root's own content is observed
//   through `query node` (own text and ownHash) — (d)'s `changed` root
//   through its ownHash changing. Each composed expectation is checked to
//   derive (S-9's premise) before the move — a `HarnessStagingError`,
//   never a verdict — and again, diagnosed, with the product's
//   identifiers substituted.
// - T6.5-13 (arms (g) through (l)) keeps the same shape: the receiving
//   file — the target, or in (i) the origin and in (k) the third file
//   `specs/c.mdx` — is composed value-blind in the fresh identifiers of the
//   declarations it gains, one line per lacked module read off the bytes
//   (distinct, none reserved); (g)'s two declarations are admitted in
//   either order (6.5 leaves it to the implementation) and the move is
//   repeated in a fresh workspace for byte-identical bytes (H-6); (i)'s
//   and (k)'s `import-addition` is admitted at the collapsed deletion's
//   or removal's start or at the file's byte length (6.5's latitude, as
//   the entry allows); (h), (j), and (k) assert `impact --base` over a
//   baseline committed after the pre-move `build` with T6.5-14's pin
//   convention — the parents `changed` within the SUITE-20 bound, their
//   `descendant-changed` tolerated within the departed or arrived child,
//   (j)'s root tolerated `upstream-changed` through its embedding of `p`,
//   the dependent file's root tolerated `upstream-changed` as a
//   dependent's ancestor (5.6), the `d={B}` dependent required
//   `upstream-changed` with the target root among its attribution, and
//   every other node named by no entry; (j)'s own text carries the
//   `{text("p")}` embedding fully expanded (1.6: `p`'s subtree text, the
//   moved body line's `{text(<X>.a)}` replaced by `a`'s); (l) and its
//   indented twin assert the pre-move `build --json` clean and `view`'s
//   `imports` empty before, the added declaration alone after (its range
//   the declaration's own characters, as T11.4-4 pins an import's).
// - T6.5-15 stages its target already binding, under the origin's own
//   identifiers, every module the moved text references, so no import is
//   added and no spelling rewritten (each moved spelling is rooted at a
//   binding the target holds, 6.5) and both files compose whole with no
//   latitude; the preview assertion is over the origin entry's
//   `import-removal` edits alone — the class the entry pins — each spanning
//   the declaration plus the terminator of the line its deletion leaves
//   empty (6.5's extent, 6.6's range rule), compared in the preview's order;
//   the compiled Markdown is read from `specs/o.md` after `check --json` and
//   `build --json`, `markdown.emit` on (7.3); each composed expectation is
//   checked to derive (S-9) before its move, a `HarnessStagingError`, never
//   a verdict.
// - T6.5-16 composes every rewritten file's would-be text from 6.5's exact
//   edits and 3's line drops — the deletion, the insertion before the target
//   parent's closing tag or at the file's end with its terminators, the
//   self-closing parent's paired-form rewrite — and verifies in the test
//   that each concerned file's text does not derive and every other
//   rewritten file's does (S-9; a `HarnessStagingError` either way, never a
//   verdict); "nothing modified" is the whole-root byte snapshot around the
//   `move … --json` (sources, derived files, the journal absent or
//   byte-unchanged); the refusal report holds exactly one finding per
//   applicable reason, its codes compared as a set, and the
//   `refused-invalid-rewrite` finding's `locations`, `identities`, and
//   `path` exactly; the controls the entry composes here — the in-line
//   section into each of (c)'s three parents (T6.5-2's fourth geometry
//   stages the first alone), (d)'s prose remainder, (e)'s block-ending empty
//   line — are performed and byte-asserted with `check` and `build` clean,
//   those it names by ID (T6.2-3(a), (b), (c), (e)) being that test's
//   stagings. Arms (f)–(i), the applicability arms, and the created-target
//   arm are still to be registered; the preview twins are T6.6-3's.

import { Buffer } from "node:buffer";
import type {
  ChangeCategory,
  Finding,
  GraphEdge,
  ImpactReport,
  NodeReport,
  PreviewEdit,
  PreviewEditClass,
  PreviewFileEntry,
} from "../../helpers/adapters/index.js";
import {
  decodeEdgesReport,
  decodeImpactReport,
  decodeNodeReport,
  decodePreviewReport,
  decodeViewReport,
  renderPathValue,
} from "../../helpers/adapters/index.js";
import { assertFileBytes, fail } from "../../helpers/assertions.js";
import { canonicalSpecifier } from "../../helpers/import-insertion.js";
import { deriveMdx } from "../../helpers/mdx-derivability.js";
import { HarnessStagingError } from "../../helpers/permissions.js";
import { defineProductTest } from "../../helpers/registry.js";
import { assertLeavesUnchanged } from "../../helpers/snapshot.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import {
  assertEdgeSetEqual,
  assertFindingIdentities,
  assertSameJson,
  buildOk,
  expectExit,
  expectFindingFreeReport,
  runFindingsReport,
  runJson,
} from "./support.js";

// One spec group (SPEC 7.1), no code group: every staged `.mdx` under
// `specs/` is a discovered spec source.
const CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`;

/** The compiler-provided names a spec source's added import may not bind (SPEC 2.1). */
const MDX_RESERVED_NAMES: readonly string[] = ["S", "Spec", "text"];

/** Stage a fresh workspace (config plus `files`), run `body`, dispose (H-1). */
async function withWorkspace<T>(
  files: Readonly<Record<string, string>>,
  body: (workspace: TestWorkspace) => Promise<T>,
): Promise<T> {
  const workspace = await TestWorkspace.create({
    files: { "xspec.config.ts": CONFIG, ...files },
  });
  try {
    return await body(workspace);
  } finally {
    await workspace.dispose();
  }
}

/**
 * Read a workspace source file as UTF-8 text, failing diagnosed (H-8) when
 * the path does not hold a plain file.
 */
async function readSourceText(
  workspace: TestWorkspace,
  rel: string,
  context: string,
): Promise<string> {
  const kind = await workspace.kind(rel);
  if (kind !== "file") {
    fail(`${context}: expected a plain file at ${rel}; found ${kind}`);
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(
    await workspace.readBytes(rel),
  );
}

/**
 * The workspace's complete edge set of one dependency kind, via
 * `query edges --kinds <kind>` (SPEC 11), for exact-set comparison (5.2).
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

/** The complete `depends` and `embeds` edge sets after a move (SPEC 6.5, 5.2). */
async function assertEdgeSets(
  product: ProductBinding,
  workspace: TestWorkspace,
  expected: { depends: readonly GraphEdge[]; embeds: readonly GraphEdge[] },
  reason: string,
  context: string,
): Promise<void> {
  assertEdgeSetEqual(
    await queryEdgesOfKind(product, workspace, "depends", context),
    expected.depends,
    `${context}: the complete \`depends\` edge set after the move — ${reason} (SPEC 6.5, 5.2)`,
  );
  assertEdgeSetEqual(
    await queryEdgesOfKind(product, workspace, "embeds", context),
    expected.embeds,
    `${context}: the complete \`embeds\` edge set after the move — ${reason} (SPEC 6.5, 5.2, 2.3)`,
  );
}

/** `check --json` and `build --json` clean: exactly `{"findings": []}` at exit 0. */
async function assertCleanAfterMove(
  product: ProductBinding,
  workspace: TestWorkspace,
  reason: string,
  context: string,
): Promise<void> {
  await expectFindingFreeReport(
    product,
    workspace,
    ["check", "--json"],
    `${context} \`check --json\` after the move — clean: ${reason}; no ` +
      `staleness after the finishing regeneration (SPEC 6.5, 6.4, 12.2, 14.10)`,
  );
  await expectFindingFreeReport(
    product,
    workspace,
    ["build", "--json"],
    `${context} \`build --json\` after the move — clean: the rewritten ` +
      `workspace is valid, the embedding's expansion included (SPEC 6.5, 12.1, 3)`,
  );
}

/**
 * A spec file the move wrote derives under the stock MDX 3 grammar (S-9,
 * `deriveMdx`): 6.5 fixes a created file's content so that it derives
 * exactly when the moved text alone at a line's start would, and a product's
 * own `check` cannot judge that where its grammar is wider than 14.20's.
 */
async function assertSpecDerives(
  workspace: TestWorkspace,
  rel: string,
  reason: string,
  context: string,
): Promise<void> {
  const bytes = await workspace.readBytes(rel);
  const verdict = deriveMdx(bytes);
  if (verdict.derives) return;
  const where =
    verdict.position === undefined
      ? ""
      : ` at line ${String(verdict.position.line)}, column ${String(verdict.position.column)} (offset ${String(verdict.position.offset)})`;
  fail(
    `${context}: ${rel} after the move is not well-formed under the stock ` +
      `MDX 3 grammar (S-9)${where}: ${verdict.reason} — ${reason} (SPEC 6.5, ` +
      `14.20); the file reads ${JSON.stringify(Buffer.from(bytes).toString("utf8"))}`,
  );
}

// ---------------------------------------------------------------------------
// T6.5-12 The target file's own references to moved nodes
// ---------------------------------------------------------------------------

const R12_ORIGIN = "specs/a.mdx";
const R12_TARGET = "specs/b.mdx";
const R12_MOVE_ARGV = ["move", "specs/a.mdx#x", "specs/b.mdx#y"] as const;

/** The target's binding of the origin module (SPEC 2.1). */
const R12_IMPORT = 'import A from "./a.xspec"';

// The origin: `w` stays, `x` is moved. The construct's tags stand alone on
// their lines, so its deletion in place leaves one merged empty line, dropped
// with its terminator (SPEC 6.5, 3); the blank line before it, blank already,
// stays — the origin ends with `</S>`, U+000A, U+000A.
const R12_ORIGIN_BEFORE = [
  '<S id="w">',
  "W text.",
  "</S>",
  "",
  '<S id="x">',
  "X text.",
  "</S>",
  "",
].join("\n");
const R12_ORIGIN_AFTER = ['<S id="w">', "W text.", "</S>", "", ""].join("\n");

// The target's own section, before and after: `d={A.x}` and `{text(A.x)}`
// — references through the origin binding to the moved node — become
// local-form references to `y`, in 6.4's pinned spelling for converted
// references (double-quoted string literals).
const R12_OWN_LINES_BEFORE = [
  '<S id="b" d={A.x}>',
  "Bee text.",
  "",
  "{text(A.x)}",
  "</S>",
];
const R12_OWN_LINES_AFTER = [
  '<S id="b" d={"y"}>',
  "Bee text.",
  "",
  '{text("y")}',
  "</S>",
];
// The retention arm's further use of `A`: a `d` reference to the unmoved `w`.
const R12_OTHER_LINES = ['<S id="c" d={A.w}>', "Cee text.", "</S>"];
// The moved text after re-identification (`x` → `y`), landing at the end of
// the file (top-level `<new-id>`): the file's final line is terminated, so
// the insertion point is at the start of a line and no U+000A precedes it;
// one follows (SPEC 6.5; T6.5-2).
const R12_MOVED_LINES_AFTER = ['<S id="y">', "X text.", "</S>"];

const R12_B_TO_Y_DEPENDS: GraphEdge = {
  from: `${R12_TARGET}#b`,
  to: `${R12_TARGET}#y`,
  kind: "depends",
};
const R12_B_TO_Y_EMBEDS: GraphEdge = {
  from: `${R12_TARGET}#b`,
  to: `${R12_TARGET}#y`,
  kind: "embeds",
};

interface R12Arm {
  readonly name: string;
  readonly targetBefore: string;
  /** Composed from SPEC 6.4/6.5 and 3 — never from product output. */
  readonly targetAfter: string;
  readonly importFate: string;
  readonly depends: readonly GraphEdge[];
  readonly embeds: readonly GraphEdge[];
}

const R12_ARMS: readonly R12Arm[] = [
  {
    name: "last uses — import removed",
    targetBefore: [R12_IMPORT, "", ...R12_OWN_LINES_BEFORE, ""].join("\n"),
    // The two rewritten references were the `A` binding's last uses, so the
    // declaration's own characters are deleted in place and its line, left
    // empty purely by that deletion, is dropped with its terminator — the
    // block it alone made up is left with no line, so its first declaration
    // goes with the rest (SPEC 6.5, 3); the blank line that followed it was
    // blank before the deletion and stays, so the file now opens with that
    // terminator (T6.5-7's exact extent).
    targetAfter: [
      "",
      ...R12_OWN_LINES_AFTER,
      ...R12_MOVED_LINES_AFTER,
      "",
    ].join("\n"),
    importFate:
      "the `A` import, its binding's last uses rewritten, removed with " +
      "6.5's exact extent — its own characters deleted in place and its " +
      "emptied line dropped with its terminator, the blank line that " +
      "followed kept",
    depends: [R12_B_TO_Y_DEPENDS],
    embeds: [R12_B_TO_Y_EMBEDS],
  },
  {
    name: "a use remains — import kept",
    targetBefore: [
      R12_IMPORT,
      "",
      ...R12_OWN_LINES_BEFORE,
      "",
      ...R12_OTHER_LINES,
      "",
    ].join("\n"),
    // `c`'s `d={A.w}` still uses the binding after the rewrite, so the
    // declaration and its line are untouched (SPEC 6.5).
    targetAfter: [
      R12_IMPORT,
      "",
      ...R12_OWN_LINES_AFTER,
      "",
      ...R12_OTHER_LINES,
      ...R12_MOVED_LINES_AFTER,
      "",
    ].join("\n"),
    importFate:
      "the `A` import kept byte-for-byte with its line — `d={A.w}` still " +
      "uses its binding after the rewrite",
    depends: [
      R12_B_TO_Y_DEPENDS,
      { from: `${R12_TARGET}#c`, to: `${R12_ORIGIN}#w`, kind: "depends" },
    ],
    embeds: [R12_B_TO_Y_EMBEDS],
  },
];

/** A stale or misrooted spelling of the target's own references, loosely read — for the diagnosis alone. */
const R12_STALE = /\bA\.x\b/;
const R12_MISROOTED = /(?:d=\{|text\()\s*([A-Za-z_$][A-Za-z0-9_$]*)\.y\b/;

/**
 * Name the headline deviation of a target that is not byte-equal to its
 * composed expectation, when one of the two forms TEST-SPEC names shows.
 */
function r12Deviation(actual: string): string {
  if (R12_STALE.test(actual)) {
    return (
      "the target still spells `A.x`, naming a vacated identity — an " +
      "unresolved reference behind a reported success"
    );
  }
  const misrooted = R12_MISROOTED.exec(actual);
  if (misrooted !== null) {
    return (
      `the target roots its own reference to the moved node at a binding ` +
      `(\`${misrooted[1] ?? ""}\`) of its own module instead of local form`
    );
  }
  return "";
}

async function runR12Arm(
  product: ProductBinding,
  arm: R12Arm,
  context: string,
): Promise<void> {
  await withWorkspace(
    { [R12_ORIGIN]: R12_ORIGIN_BEFORE, [R12_TARGET]: arm.targetBefore },
    async (workspace) => {
      // Premise: the staging is valid — every reference resolves through
      // the target's `A` binding — so a later failure is the move's.
      await buildOk(
        product,
        workspace,
        `${context} \`build\` over the staging`,
      );

      await expectExit(
        product,
        workspace,
        [...R12_MOVE_ARGV],
        0,
        `${context} \`move specs/a.mdx#x specs/b.mdx#y\``,
      );

      const deviation = r12Deviation(
        await readSourceText(workspace, R12_TARGET, context),
      );
      await assertFileBytes(
        workspace.path(R12_TARGET),
        arm.targetAfter,
        `${context}: ${R12_TARGET} after the move — ` +
          (deviation === "" ? "" : `${deviation}; `) +
          `the target's own references through its origin-module binding ` +
          `to the moved node are rooted in local form, in 6.4's pinned ` +
          `spellings for converted references (\`d={"y"}\`, ` +
          `\`{text("y")}\`); ${arm.importFate}; the moved text lands at ` +
          `the end of the file plus U+000A with no preceding terminator ` +
          `(the final line was terminated); every other byte is unchanged ` +
          `(SPEC 6.5, 6.4, 3; H-4, normalizing nothing)`,
      );
      await assertFileBytes(
        workspace.path(R12_ORIGIN),
        R12_ORIGIN_AFTER,
        `${context}: ${R12_ORIGIN} after the move — the moved construct ` +
          `deleted in place, its merged empty line dropped with its ` +
          `terminator, the blank line before it kept, \`w\` untouched ` +
          `(SPEC 6.5, 3)`,
      );

      await assertEdgeSets(
        product,
        workspace,
        { depends: arm.depends, embeds: arm.embeds },
        `the target's own section reports its \`depends\` and \`embeds\` ` +
          `edges to ${R12_TARGET}#y, the moved node's new identity` +
          (arm.depends.length > 1
            ? `, and \`c\`'s retained reference its edge to ${R12_ORIGIN}#w`
            : ""),
        context,
      );
      await assertCleanAfterMove(
        product,
        workspace,
        "every rewritten reference resolves in local form and every kept " +
          "spelling through its binding",
        context,
      );
    },
  );
}

const T6_5_12 = defineProductTest({
  id: "T6.5-12",
  title:
    "the target file's own references to moved nodes (the fourth conversion direction): the target imports the origin module as `A` and spells `d={A.x}` and `{text(A.x)}` in a section of its own; after `move specs/a.mdx#x specs/b.mdx#y` they read `d={\"y\"}` and `{text(\"y\")}` (6.4's double-quoted string literals), the `A` import removed with its line when those were its binding's last uses (one arm) and kept byte-for-byte when a `d={A.w}` to an unmoved node remains (the other), the target otherwise byte-identical apart from the moved text's landing and its own rewrites, each file byte-equal to expected bytes composed from 6.4/6.5 and 3; `query edges` reports the section's `depends` and `embeds` edges to `specs/b.mdx#y`; `build` and `check` are clean — a product leaving `A.x` naming a vacated identity or rooting the reference at a binding of the target's own module fails (SPEC 6.5, 6.4, 3; H-4)",
  run: async (product) => {
    for (const arm of R12_ARMS) {
      await runR12Arm(product, arm, `T6.5-12 (${arm.name})`);
    }
  },
});

// ---------------------------------------------------------------------------
// T6.5-14 Created target file's fixed content
// ---------------------------------------------------------------------------

const F14_ORIGIN = "specs/a.mdx";
const F14_ORIGIN_MODULE = "specs/a.xspec";
const F14_CREATED = "specs/new.mdx";
const F14_THIRD = "specs/x.mdx";
const F14_THIRD_MODULE = "specs/x.xspec";
const F14_MOVE_ARGV = ["move", "specs/a.mdx#m", "specs/new.mdx#m"] as const;

// The referenced sibling leaf of the moved section: a top-level section
// beside `m` under the origin's root, none of its bytes on the moved
// construct's boundary lines (both stand alone on their lines with a blank
// line between the constructs), depending on and embedding nothing — so the
// move leaves its canonical identity and effectiveHash unchanged (SPEC 5.5)
// and the moved node, whose `d` reference targets it, is never
// `upstream-changed` (5.6).
const F14_SIBLING_LINES = ['<S id="s">', "Sib text.", "</S>"];
const F14_THIRD_SOURCE = ['<S id="q">', "Q text.", "</S>", ""].join("\n");

// Arm (i): no declaration needed — the moved subtree's one reference is
// local to it (`m.b` depends on `m.a`), and the move keeps the ID, so no
// `id` attribute and no local-form reference is rewritten (SPEC 6.5): the
// created file is exactly the moved text — the construct's own characters,
// opening `<` through the closing tag's `>` — followed by U+000A.
const F14_LOCAL_MOVED_LINES = [
  '<S id="m">',
  "Moved text.",
  "",
  '<S id="m.a">',
  "A text.",
  "</S>",
  "",
  '<S id="m.b" d={"m.a"}>',
  "B text.",
  "</S>",
  "</S>",
];
const F14_LOCAL_MOVED_TEXT = F14_LOCAL_MOVED_LINES.join("\n");
const F14_LOCAL_ORIGIN_BEFORE = [
  ...F14_SIBLING_LINES,
  "",
  ...F14_LOCAL_MOVED_LINES,
  "",
].join("\n");
const F14_LOCAL_CREATED = `${F14_LOCAL_MOVED_TEXT}\n`;
// The origin after either arm's deletion: the moved construct deleted in
// place, its merged empty line dropped with its terminator, the blank line
// before it (blank already) kept — `</S>`, U+000A, U+000A (SPEC 6.5, 3).
const F14_LOCAL_ORIGIN_AFTER = [...F14_SIBLING_LINES, "", ""].join("\n");

const F14_LOCAL_DEPENDS: readonly GraphEdge[] = [
  { from: `${F14_CREATED}#m.b`, to: `${F14_CREATED}#m.a`, kind: "depends" },
];

// Arm (ii): two declarations needed. The moved text carries a local `d`
// reference to the sibling `s` — converted to imported form through the
// created file's declaration of the origin module, `d={<O>.s}` (6.4: dot
// access, the segment being identifier-valid) — and a `{text(X.q)}`
// embedding through the origin's binding of the third module, rooted after
// the move at the created file's own fresh binding `<X>` of that module
// (T6.5-10's shape).
function f14ImportedMovedLines(
  originRoot: string,
  thirdRoot: string,
): string[] {
  return [
    `<S id="m" d={${originRoot}.s}>`,
    "Moved text.",
    "",
    `{text(${thirdRoot}.q)}`,
    "</S>",
  ];
}
const F14_DECL_ORIGIN_BEFORE = [
  'import X from "./x.xspec"',
  "",
  ...F14_SIBLING_LINES,
  "",
  '<S id="m" d={"s"}>',
  "Moved text.",
  "",
  "{text(X.q)}",
  "</S>",
  "",
].join("\n");
// The origin's `X` binding loses its only use with the moved text, so its
// declaration is deleted in place and its emptied line dropped with its
// terminator — the block it alone made up left with no line — while the
// blank line that followed it stays: the file opens with that terminator
// (SPEC 6.5, 3; T6.5-7's exact extent, T6.5-10 (a)).
const F14_DECL_ORIGIN_AFTER = ["", ...F14_SIBLING_LINES, "", ""].join("\n");

const F14_REWRITTEN_DEPENDS = /d=\{([A-Za-z_$][A-Za-z0-9_$]*)\.s\}/g;
const F14_REWRITTEN_EMBEDS = /\{text\(([A-Za-z_$][A-Za-z0-9_$]*)\.q\)\}/g;

const F14_DECL_DEPENDS: readonly GraphEdge[] = [
  { from: `${F14_CREATED}#m`, to: `${F14_ORIGIN}#s`, kind: "depends" },
];
const F14_DECL_EMBEDS: readonly GraphEdge[] = [
  { from: `${F14_CREATED}#m`, to: `${F14_THIRD}#q`, kind: "embeds" },
];

/**
 * The identifier one of the created file's rewritten references is rooted
 * at, read off 6.4's pinned spelling; diagnosed when the reference is not
 * spelled as 6.4 pins it, or is present more or less than once.
 */
function f14ReferenceRoot(
  text: string,
  pattern: RegExp,
  form: string,
  context: string,
): string {
  const matches = [...text.matchAll(pattern)];
  const root = matches.length === 1 ? matches[0]?.[1] : undefined;
  if (root === undefined) {
    fail(
      `${context}: ${F14_CREATED} must hold exactly one ${form} — the moved ` +
        `reference rooted at the created file's binding of its target's ` +
        `module, in 6.4's pinned spelling (SPEC 6.5, 6.4); found ` +
        `${String(matches.length)} in ${JSON.stringify(text)}`,
    );
  }
  return root;
}

/**
 * Name the headline deviation of a created file that is not byte-equal to
 * either composed expectation, when one of the forms TEST-SPEC names shows.
 */
function f14DeclDeviation(
  actual: string,
  declarations: readonly string[],
  movedText: string,
): string {
  if (actual.startsWith(movedText)) {
    return "the moved text stands first — the declarations must precede it";
  }
  const heads = [
    declarations.join("\n"),
    [...declarations].reverse().join("\n"),
  ];
  for (const head of heads) {
    if (actual === `${head}\n${movedText}\n`) {
      return "no empty line ends the ESM block before the moved text";
    }
    if (actual === `${head}\n\n\n${movedText}\n`) {
      return "two empty lines stand between the ESM block and the moved text";
    }
  }
  if (!heads.some((head) => actual.startsWith(`${head}\n`))) {
    return "the declarations do not stand contiguous at the start of the file";
  }
  return "";
}

/** Categories one node must carry, and may carry, after the move (SPEC 5.6). */
interface CategoryPin {
  readonly identity: string;
  /** Categories the node must carry; empty = named by no entry. */
  readonly required: readonly ChangeCategory[];
  /** Attribution bound of `changed` (the SUITE-20 convention). */
  readonly changedWithin?: readonly string[];
  /** Categories tolerated beside the required ones, with their attribution bound. */
  readonly optional?: readonly {
    readonly category: ChangeCategory;
    readonly within: readonly string[];
  }[];
  /**
   * Attribution of required categories other than `changed`: bounded by
   * `within`, and, where given, including each of `mustInclude` (SPEC 5.6:
   * every category is attributed to its originating nodes).
   */
  readonly attributed?: readonly {
    readonly category: ChangeCategory;
    readonly within: readonly string[];
    readonly mustInclude?: readonly string[];
  }[];
}

/**
 * Assert an `impact` report's requirement-level content against the pinned
 * expectations (SPEC 5.6, 6.2, 9.1): every identity named is a current,
 * journal-mapped one; no entry is `deleted`; a pinned node carries exactly
 * its required categories plus at most the tolerated ones, each attributed
 * within its bound; no code location is impacted.
 */
function assertImpactPins(
  report: ImpactReport,
  known: readonly string[],
  pins: readonly CategoryPin[],
  context: string,
): void {
  const merged = new Map<string, Map<ChangeCategory, string[]>>();
  for (const entry of report.requirements) {
    for (const identity of entry.nodes) {
      if (!known.includes(identity)) {
        fail(
          `${context}: the report names ${JSON.stringify(identity)}, which is ` +
            `no current node of the workspace (in the workspace-relative ` +
            `identity form of SPEC 1.5) — a pre-operation identity here means ` +
            `the product failed to unify identities through the journal ` +
            `(SPEC 6.2, 6.3, 9.2); entry: ${JSON.stringify(entry)}`,
        );
      }
      if (entry.deleted) {
        fail(
          `${context}: an entry names ${JSON.stringify(identity)} as deleted — ` +
            `a journaled move deletes nothing: the moved subtree keeps its ` +
            `identity through the journal mapping (SPEC 6.2, 6.3, 9.3); ` +
            `entry: ${JSON.stringify(entry)}`,
        );
      }
      let categories = merged.get(identity);
      if (categories === undefined) {
        categories = new Map();
        merged.set(identity, categories);
      }
      for (const category of entry.categories) {
        const attributed = categories.get(category.category) ?? [];
        attributed.push(...category.attributedTo);
        categories.set(category.category, attributed);
      }
    }
  }

  const checkAttribution = (
    identity: string,
    category: ChangeCategory,
    attributed: readonly string[],
    within: readonly string[],
  ): void => {
    for (const source of [...new Set(attributed)].sort()) {
      if (!within.includes(source)) {
        fail(
          `${context}: the ${category} category of ${identity} is attributed ` +
            `to ${JSON.stringify(source)}, outside its originating-node bound ` +
            `${JSON.stringify([...within].sort())} (SPEC 5.6: every category ` +
            `is attributed to its originating nodes)`,
        );
      }
    }
  };

  for (const pin of pins) {
    const actual =
      merged.get(pin.identity) ?? new Map<ChangeCategory, string[]>();
    const names = [...actual.keys()].sort();
    if (pin.required.length === 0 && names.length > 0) {
      fail(
        `${context}: ${pin.identity} must receive no category — its hashes ` +
          `are unchanged and its identity maps through the journal (SPEC 5.5, ` +
          `5.6, 6.2) — and so appear in no requirement entry (SPEC 9.3 groups ` +
          `output by category; the T1.5-1 convention), but the report names ` +
          `it with categories ${JSON.stringify(names)}`,
      );
    }
    const tolerated = new Set<ChangeCategory>([
      ...pin.required,
      ...(pin.optional ?? []).map((entry) => entry.category),
    ]);
    for (const name of names) {
      if (!tolerated.has(name)) {
        fail(
          `${context}: ${pin.identity} carries the category ${name}, which ` +
            `SPEC 5.6 gives it no ground for — expected exactly ` +
            `${JSON.stringify([...pin.required].sort())}` +
            (pin.optional === undefined
              ? ""
              : ` (${JSON.stringify(pin.optional.map((entry) => entry.category).sort())} tolerated)`) +
            ` (SPEC 5.6, 6.2)`,
        );
      }
    }
    for (const name of pin.required) {
      if (!actual.has(name)) {
        fail(
          `${context}: ${pin.identity} must carry ${name} (SPEC 5.6, 6.2), ` +
            `but the report gives it ` +
            (names.length === 0
              ? "no category"
              : `only ${JSON.stringify(names)}`),
        );
      }
    }
    const changed = actual.get("changed");
    if (changed !== undefined && pin.changedWithin !== undefined) {
      checkAttribution(pin.identity, "changed", changed, pin.changedWithin);
    }
    for (const entry of pin.optional ?? []) {
      const attributed = actual.get(entry.category);
      if (attributed !== undefined) {
        checkAttribution(
          pin.identity,
          entry.category,
          attributed,
          entry.within,
        );
      }
    }
    for (const entry of pin.attributed ?? []) {
      const attributed = actual.get(entry.category) ?? [];
      checkAttribution(pin.identity, entry.category, attributed, entry.within);
      for (const source of entry.mustInclude ?? []) {
        if (!attributed.includes(source)) {
          fail(
            `${context}: the ${entry.category} category of ${pin.identity} ` +
              `is attributed to ${JSON.stringify([...new Set(attributed)].sort())}, ` +
              `which omits ${JSON.stringify(source)}, an originating node of ` +
              `the change it cascades from (SPEC 5.6: every category is ` +
              `attributed to its originating nodes)`,
          );
        }
      }
    }
  }

  assertSameJson(
    report.code,
    { direct: [], transitive: [] },
    `${context}: no code location is impacted — the workspace configures no ` +
      `code group (SPEC 9.2)`,
  );
}

/**
 * The category expectation TEST-SPEC T6.5-14 states, against the baseline
 * committed before the move: the created file's root `changed` by addition
 * alone, carrying no other category; the clean-boundary moved subtree, the
 * referenced sibling leaf, and the third module's nodes carrying none; the
 * origin root `changed` (its own content lost a child) with T6.2-3's
 * two-sided `descendant-changed` tolerated, attributed to the moved node.
 */
async function assertF14Categories(
  product: ProductBinding,
  workspace: TestWorkspace,
  base: string,
  movedSubtree: readonly string[],
  bystanders: readonly string[],
  context: string,
): Promise<void> {
  const label = `${context} \`impact --base <pre-move ref> --json\``;
  const report = decodeImpactReport(
    await runJson(
      product,
      workspace,
      ["impact", "--base", base, "--json"],
      label,
    ),
    label,
  );
  const movedRoot = `${F14_CREATED}#m`;
  const originating = [F14_ORIGIN, F14_CREATED, movedRoot];
  assertImpactPins(
    report,
    [F14_ORIGIN, F14_CREATED, ...movedSubtree, ...bystanders],
    [
      {
        identity: F14_CREATED,
        required: ["changed"],
        changedWithin: originating,
      },
      {
        identity: F14_ORIGIN,
        required: ["changed"],
        changedWithin: originating,
        optional: [{ category: "descendant-changed", within: [movedRoot] }],
      },
      ...movedSubtree.map((identity) => ({ identity, required: [] })),
      ...bystanders.map((identity) => ({ identity, required: [] })),
    ],
    `${label} — the created file's root is \`changed\` by addition alone, ` +
      `carrying no other category (an added node receives none through its ` +
      `own hashes; SPEC 5.6, P-5's convention); the clean-boundary moved ` +
      `subtree carries none — the moved node's metadataHash its target's ` +
      `canonical identity, preserved, and its effectiveHash the target's, ` +
      `unchanged (SPEC 5.5; T6.2-3); the referenced sibling leaf and the ` +
      `third module's nodes carry none`,
  );
}

/** Arm (i): a created target needing no declaration. */
async function runF14LocalArm(product: ProductBinding): Promise<void> {
  const context = "T6.5-14 (no declaration)";
  await withWorkspace(
    { [F14_ORIGIN]: F14_LOCAL_ORIGIN_BEFORE },
    async (workspace) => {
      await buildOk(
        product,
        workspace,
        `${context} \`build\` over the staging`,
      );
      await workspace.gitInit();
      const base = await workspace.gitCommitAll("pre-move baseline");

      await expectExit(
        product,
        workspace,
        [...F14_MOVE_ARGV],
        0,
        `${context} \`move specs/a.mdx#m specs/new.mdx#m\` onto an absent ` +
          `target path — created (SPEC 6.5)`,
      );

      const actual = await readSourceText(workspace, F14_CREATED, context);
      let deviation = "";
      if (actual === `\n${F14_LOCAL_CREATED}`) {
        deviation = "a leading empty line was added";
      } else if (actual === `${F14_LOCAL_CREATED}\n`) {
        deviation = "a trailing empty line was added";
      } else if (actual === F14_LOCAL_MOVED_TEXT) {
        deviation = "no terminator follows the moved text";
      }
      await assertFileBytes(
        workspace.path(F14_CREATED),
        F14_LOCAL_CREATED,
        `${context}: ${F14_CREATED} as the move created it — ` +
          (deviation === "" ? "" : `${deviation}; `) +
          `needing no declaration (the moved text's one reference is local ` +
          `to its subtree and the ID is kept, so nothing in it is rewritten), ` +
          `the created content is exactly the moved text followed by U+000A: ` +
          `no leading empty line, no trailing one, a terminator present ` +
          `(SPEC 6.5; H-4, normalizing nothing)`,
      );
      await assertSpecDerives(
        workspace,
        F14_CREATED,
        "the created content derives exactly when the moved text alone at a " +
          "line's start would",
        context,
      );
      await assertFileBytes(
        workspace.path(F14_ORIGIN),
        F14_LOCAL_ORIGIN_AFTER,
        `${context}: ${F14_ORIGIN} after the move — the moved construct ` +
          `deleted in place, its merged empty line dropped with its ` +
          `terminator, the blank line before it kept, the sibling untouched ` +
          `(SPEC 6.5, 3)`,
      );

      await assertEdgeSets(
        product,
        workspace,
        { depends: F14_LOCAL_DEPENDS, embeds: [] },
        `the moved subtree's local reference reported under the new ` +
          `identities, ${F14_CREATED}#m.b to ${F14_CREATED}#m.a`,
        context,
      );
      await assertCleanAfterMove(
        product,
        workspace,
        "the kept local reference resolves within the created file",
        context,
      );
      await assertF14Categories(
        product,
        workspace,
        base,
        [`${F14_CREATED}#m`, `${F14_CREATED}#m.a`, `${F14_CREATED}#m.b`],
        [`${F14_ORIGIN}#s`],
        context,
      );
    },
  );
}

/** Arm (ii): a created target needing exactly two declarations. */
async function runF14DeclarationsArm(product: ProductBinding): Promise<void> {
  const context = "T6.5-14 (two declarations)";
  await withWorkspace(
    { [F14_ORIGIN]: F14_DECL_ORIGIN_BEFORE, [F14_THIRD]: F14_THIRD_SOURCE },
    async (workspace) => {
      await buildOk(
        product,
        workspace,
        `${context} \`build\` over the staging`,
      );
      await workspace.gitInit();
      const base = await workspace.gitCommitAll("pre-move baseline");

      await expectExit(
        product,
        workspace,
        [...F14_MOVE_ARGV],
        0,
        `${context} \`move specs/a.mdx#m specs/new.mdx#m\` onto an absent ` +
          `target path — created with the two declarations it needs (SPEC 6.5)`,
      );

      // The two unpinned identifiers, read off the rewritten references.
      const actual = await readSourceText(workspace, F14_CREATED, context);
      const originRoot = f14ReferenceRoot(
        actual,
        F14_REWRITTEN_DEPENDS,
        '`d={<O>.s}` (the local `d={"s"}` converted to imported form)',
        context,
      );
      const thirdRoot = f14ReferenceRoot(
        actual,
        F14_REWRITTEN_EMBEDS,
        "`{text(<X>.q)}` (the embedding re-rooted at the created file's own binding)",
        context,
      );
      for (const [role, root] of [
        ["origin-module", originRoot],
        ["third-module", thirdRoot],
      ] as const) {
        if (MDX_RESERVED_NAMES.includes(root)) {
          fail(
            `${context}: the ${role} declaration binds \`${root}\`, one of the ` +
              `compiler-provided names an added import in a spec source may ` +
              `not bind (SPEC 6.5, 2.1)`,
          );
        }
      }
      if (originRoot === thirdRoot) {
        fail(
          `${context}: both added declarations bind \`${originRoot}\` — the ` +
            `identifiers added to one file must be distinct (SPEC 6.5, 2.1, ` +
            `14.15)`,
        );
      }

      // The whole file, composed byte-exactly for each order the product
      // may fix: each declaration followed by U+000A, then one further
      // U+000A, then the moved text (its references rooted at the two
      // bindings) followed by U+000A.
      const declarations = [
        `import ${originRoot} from "${canonicalSpecifier("specs", F14_ORIGIN_MODULE)}"`,
        `import ${thirdRoot} from "${canonicalSpecifier("specs", F14_THIRD_MODULE)}"`,
      ];
      const movedText = f14ImportedMovedLines(originRoot, thirdRoot).join("\n");
      const candidates = [declarations, [...declarations].reverse()].map(
        (order) => `${order.join("\n")}\n\n${movedText}\n`,
      );
      if (!candidates.includes(actual)) {
        const deviation = f14DeclDeviation(actual, declarations, movedText);
        fail(
          `${context}: ${F14_CREATED} as the move created it — ` +
            (deviation === "" ? "" : `${deviation}; `) +
            `a created target's content is fixed: the declarations it needs ` +
            `(\`${declarations[0] ?? ""}\` and \`${declarations[1] ?? ""}\`, ` +
            `in either order), each followed by U+000A, then one further ` +
            `U+000A — the empty line ending the ESM block — then the moved ` +
            `text and its terminator (SPEC 6.5; H-4, normalizing nothing)\n` +
            `  actual:   ${JSON.stringify(actual)}\n` +
            `  expected: ${JSON.stringify(candidates[0])}\n` +
            `        or: ${JSON.stringify(candidates[1])}`,
        );
      }
      await assertSpecDerives(
        workspace,
        F14_CREATED,
        "the empty line ends the ESM block, so the content derives exactly " +
          "when the moved text alone at a line's start would",
        context,
      );
      await assertFileBytes(
        workspace.path(F14_ORIGIN),
        F14_DECL_ORIGIN_AFTER,
        `${context}: ${F14_ORIGIN} after the move — the moved construct ` +
          `deleted in place with its merged empty line, and the \`X\` ` +
          `import, its only use gone with the moved text, removed with 6.5's ` +
          `exact extent (its emptied line dropped with its terminator, the ` +
          `blank line that followed kept), the sibling untouched (SPEC 6.5, 3)`,
      );
      await assertFileBytes(
        workspace.path(F14_THIRD),
        F14_THIRD_SOURCE,
        `${context}: ${F14_THIRD} after the move — the third module, whose ` +
          `node is embedded but not moved, untouched (SPEC 6.5; H-4)`,
      );

      await assertEdgeSets(
        product,
        workspace,
        { depends: F14_DECL_DEPENDS, embeds: F14_DECL_EMBEDS },
        `the moved node's converted \`d\` reference reported to ` +
          `${F14_ORIGIN}#s and its re-rooted embedding to ${F14_THIRD}#q, ` +
          `under its new identity`,
        context,
      );
      await assertCleanAfterMove(
        product,
        workspace,
        "every rewritten reference resolves through the created file's " +
          "bindings, the fresh identifiers colliding with nothing (14.15)",
        context,
      );
      await assertF14Categories(
        product,
        workspace,
        base,
        [`${F14_CREATED}#m`],
        [`${F14_ORIGIN}#s`, F14_THIRD, `${F14_THIRD}#q`],
        context,
      );
    },
  );
}

const T6_5_14 = defineProductTest({
  id: "T6.5-14",
  title:
    "created target file's fixed content: a section moved onto an absent target path creates the file with content 6.5 fixes instead of leaving chosen — byte-asserted with the fresh identifiers and the declarations' order alone unpinned: needing no declaration (the moved text's one reference local to its subtree, the ID kept), the created file is exactly the moved text followed by U+000A (a leading empty line, a trailing one, or no terminator failing); needing declarations — the moved text carrying a local `d` reference to a sibling leaf outside the subtree, converted to imported form through the created file's declaration of the origin module, and a `{text(X.q)}` embedding through the origin's binding of a third module — it is exactly `import <O> from \"./a.xspec\"` and `import <X> from \"./x.xspec\"` in either order, each followed by U+000A, then U+000A, then the moved text with its references rooted at `<O>` and `<X>`, followed by U+000A (no empty line, two, the moved text first, or the declarations elsewhere failing), the identifiers distinct and none of the compiler-provided names; the created content derives (S-9), `build` and `check` are clean, `query edges` reports the moved node's edges under its new identity, the origin and the third module are byte-equal to their composed expectations, and against a baseline committed before the move the created file's root is `changed` by addition alone, carrying no other category, the clean-boundary moved subtree and the referenced sibling leaf carrying none (SPEC 6.5, 6.4, 2.1, 3, 5.5, 5.6; H-4)",
  run: async (product) => {
    await runF14LocalArm(product);
    await runF14DeclarationsArm(product);
  },
});

// ---------------------------------------------------------------------------
// T6.5-13 Admissible offsets, the line-start preference, and composition in
// pre-operation coordinates — arms (a) through (l), the entry's variants
// included, in the table A13_ARMS.
// ---------------------------------------------------------------------------

const A13_ORIGIN = "specs/a.mdx";
const A13_TARGET = "specs/b.mdx";
const A13_THIRD = "specs/x.mdx";
const A13_THIRD_MODULE = "specs/x.xspec";
const A13_THIRD_SOURCE = ['<S id="a">', "A text.", "</S>", ""].join("\n");
/** The canonical specifier the receiving file's added declaration carries (SPEC 6.5, 2.1). */
const A13_THIRD_SPECIFIER = canonicalSpecifier("specs", A13_THIRD_MODULE);
/** (g)'s second third module, `specs/y.mdx`, and its canonical specifier. */
const A13_FOURTH = "specs/y.mdx";
const A13_FOURTH_MODULE = "specs/y.xspec";
const A13_FOURTH_SPECIFIER = canonicalSpecifier("specs", A13_FOURTH_MODULE);
/** The target file's module — the declaration (i) and (k) assert is of it. */
const A13_TARGET_MODULE = "specs/b.xspec";
const A13_TARGET_SPECIFIER = canonicalSpecifier("specs", A13_TARGET_MODULE);

/**
 * The moved section of the cross-file arms — a clean-boundary flow-form
 * section (T6.2-3's shape: opening and closing tags each alone on their
 * lines) whose one body line carries, beside prose, the `{text(X.a)}`
 * embedding through the origin's binding of the third module (T6.5-10's
 * shape) — spelled with the ID it bears and the binding its embedding is
 * rooted at.
 */
function a13MovedLines(id: string, root: string): string[] {
  return [`<S id="${id}">`, `Moved {text(${root}.a)} text.`, "</S>"];
}

// The cross-file origin: the `X` declaration heads the file and the sibling
// `s` keeps a use of `X`, so the declaration stays after the move (SPEC 6.5:
// an import is removed exactly when no occurrence uses a binding of its
// after the rewrite) and the origin's post-move bytes are the deletion's
// alone — the construct deleted in place, its three lines joined into one
// empty line dropped with its terminator, the blank line before it kept
// (SPEC 6.5, 3).
const A13_ORIGIN_HEAD: readonly string[] = [
  'import X from "./x.xspec"',
  "",
  '<S id="s">',
  "Sib {text(X.a)} text.",
  "</S>",
  "",
];
const A13_ORIGIN_BEFORE = [
  ...A13_ORIGIN_HEAD,
  ...a13MovedLines("m", "X"),
  "",
].join("\n");
const A13_ORIGIN_AFTER = [...A13_ORIGIN_HEAD, ""].join("\n");

/** 6.5's exact spelling of the declaration the receiving file needs (the third module's unless `specifier` says otherwise). */
function a13Declaration(
  ident: string,
  specifier: string = A13_THIRD_SPECIFIER,
): string {
  return `import ${ident} from "${specifier}"`;
}

/** A zero-length preview edit at `offset` (SPEC 6.6: an insertion point). */
function a13At(cls: PreviewEditClass, offset: number): PreviewEdit {
  return { class: cls, range: { start: offset, end: offset } };
}

/** A preview edit spanning `[start, end)` in pre-operation coordinates. */
function a13Span(
  cls: PreviewEditClass,
  start: number,
  end: number,
): PreviewEdit {
  return { class: cls, range: { start, end } };
}

/** One other file's expected post-move bytes, with the reason they are what they are. */
interface A13Other {
  readonly rel: string;
  readonly bytes: string;
  readonly reason: string;
}

/**
 * The category expectation of an arm asserting `impact --base <pre-move
 * ref> --json` (SPEC 5.6, 6.2): every current identity the report may name,
 * the pins, and the reason the enumeration is what it is.
 */
interface A13ImpactExpectation {
  readonly known: readonly string[];
  readonly pins: readonly CategoryPin[];
  readonly reason: string;
}

/** One byte-asserted arm of T6.5-13. */
interface A13Arm {
  /** The entry's letter, e.g. `(a)`, `(b, terminated)`. */
  readonly key: string;
  /** The placement 6.5 fixes here, for diagnoses. */
  readonly summary: string;
  /** The staging beside the configuration. */
  readonly files: Readonly<Record<string, string>>;
  /** The move's argv. */
  readonly argv: readonly string[];
  /** The receiving file: the one whose post-move bytes the arm composes value-blind. */
  readonly receiving: string;
  /**
   * The canonical specifiers of the declarations the receiving file gains —
   * one per module it lacks a binding of (SPEC 6.5); `compose` takes the
   * fresh identifiers they bind in this order. Empty where none is needed.
   */
  readonly added: readonly string[];
  /**
   * The receiving file's admissible post-move byte forms given the fresh
   * identifiers, in `added`'s order: one form, or one per order the
   * implementation may fix among several added declarations (SPEC 6.5).
   */
  readonly compose: (idents: readonly string[]) => readonly string[];
  /** Every other file's expected post-move bytes. */
  readonly others: readonly A13Other[];
  /** The admissible edit lists of the receiving file's preview entry, each in 12.7's order. */
  readonly previewEdits: readonly (readonly PreviewEdit[])[];
  /** The receiving file's root: its own text before and after, and whether its ownHash changes. */
  readonly root: {
    readonly identity: string;
    readonly ownTextBefore: string;
    readonly ownTextAfter: string;
    readonly ownHashChanges: boolean;
  };
  /** `build --json` exactly `{"findings": []}` over the staging too, not exit 0 alone. */
  readonly cleanBefore?: boolean;
  /**
   * The receiving file's `view` (SPEC 11.4): `imports` empty before the
   * move and, after it, exactly the added declarations — each `name` the
   * identifier read off the bytes, each `target` the module's source, each
   * range the declaration's own characters.
   */
  readonly viewImports?: boolean;
  /** The `impact --base` expectation against a baseline committed before the move. */
  readonly impact?: (idents: readonly string[]) => A13ImpactExpectation;
  /** Repeat the move in a fresh workspace and require byte-identical receiving bytes (H-6). */
  readonly repeatable?: boolean;
}

/** The source each added declaration's canonical specifier designates (SPEC 2.1, 11.4). */
const A13_MODULE_SOURCES: Readonly<Record<string, string>> = {
  [A13_THIRD_SPECIFIER]: A13_THIRD,
  [A13_FOURTH_SPECIFIER]: A13_FOURTH,
  [A13_TARGET_SPECIFIER]: A13_TARGET,
};

/** The shared origin after a cross-file arm's move (SPEC 6.5, 3). */
const A13_ORIGIN_REASON =
  "the moved construct deleted in place, its emptied line dropped with its " +
  "terminator, the blank line before it kept, the `X` declaration kept for " +
  "the sibling's use";
/** A module embedded but not moved (SPEC 6.5). */
const A13_BYSTANDER_REASON =
  "the third module, embedded but not moved, untouched";

/** A cross-file arm: `m` moved out of the shared origin into a target file. */
function a13CrossArm(spec: {
  readonly key: string;
  readonly summary: string;
  readonly target: string;
  readonly newId: string;
  readonly compose: (ident: string) => string;
  readonly previewEdits: readonly PreviewEdit[];
  readonly ownTextBefore: string;
  readonly ownTextAfter: string;
  readonly ownHashChanges: boolean;
}): A13Arm {
  return {
    key: spec.key,
    summary: spec.summary,
    files: {
      [A13_ORIGIN]: A13_ORIGIN_BEFORE,
      [A13_THIRD]: A13_THIRD_SOURCE,
      [A13_TARGET]: spec.target,
    },
    argv: ["move", `${A13_ORIGIN}#m`, `${A13_TARGET}#${spec.newId}`],
    receiving: A13_TARGET,
    added: [A13_THIRD_SPECIFIER],
    compose: (idents) => [spec.compose(idents[0] ?? "")],
    others: [
      { rel: A13_ORIGIN, bytes: A13_ORIGIN_AFTER, reason: A13_ORIGIN_REASON },
      { rel: A13_THIRD, bytes: A13_THIRD_SOURCE, reason: A13_BYSTANDER_REASON },
    ],
    previewEdits: [spec.previewEdits],
    root: {
      identity: A13_TARGET,
      ownTextBefore: spec.ownTextBefore,
      ownTextAfter: spec.ownTextAfter,
      ownHashChanges: spec.ownHashChanges,
    },
  };
}

/**
 * A same-file arm's admissible preview entries: the origin deletion
 * spanning the moved construct's own characters extended to `deletionEnd`
 * (over the terminator of a line the deletion leaves empty, when one is
 * there to drop), the `id-rewrite` of the moved section's own `id`
 * attribute nested inside it, and the target insertion zero-length at the
 * insertion point — or at the deletion's start: the two pre-operation
 * offsets a collapsed deletion makes one composed position, the bytes the
 * same either way (T6.6-4(b)'s latitude) — each list in 12.7's order.
 */
function a13SameFileEdits(
  source: string,
  movedText: string,
  idAttribute: string,
  insertion: number,
  deletionEnd: number,
): readonly (readonly PreviewEdit[])[] {
  const start = source.indexOf(movedText);
  const idStart = start + movedText.indexOf(idAttribute);
  const deletion = a13Span("origin-deletion", start, deletionEnd);
  const rewrite = a13Span("id-rewrite", idStart, idStart + idAttribute.length);
  return [
    [deletion, rewrite, a13At("target-insertion", insertion)],
    [a13At("target-insertion", start), deletion, rewrite],
  ];
}

// (a): the target holds two admissible offsets — the file's end after its
// final terminator (a line start) and the end of the `</S>` line before that
// terminator (mid-line, which would leave a kept empty line).
const A13_A_TARGET = ['<S id="p">', "x", "</S>", ""].join("\n");
// (a)'s sibling: the only line-start admissible offset is the start of the
// empty line after the `</S>` line — an added line at the file's end would
// follow a paragraph line as paragraph text, and one at the start of the
// `trailing` line would absorb it.
const A13_A_SIBLING_TARGET = ['<S id="p">', "x", "</S>", "", "trailing"].join(
  "\n",
);
// (b): 6.5's worked self-closing case, the tag's line lacking a terminator.
const A13_B_TARGET = '<S id="p" />';
// (c): no final terminator, so the file's end — mid-line — is the only
// admissible offset (offset 0 absorbs the tag line; every other line start
// lies inside the section).
const A13_C_TARGET = ['<S id="p">', "x", "</S>"].join("\n");
// (d): a paragraph line alone, unterminated; the target parent of a
// top-level `new-id` is the root.
const A13_D_TARGET = "para";

/** (a)/(c)'s composition: the moved text before `</S>`, then the declaration. */
function a13ComposeIntoP(ident: string, tail: readonly string[]): string {
  return [
    '<S id="p">',
    "x",
    ...a13MovedLines("p.n", ident),
    "</S>",
    a13Declaration(ident),
    ...tail,
  ].join("\n");
}

/** (b)'s composition, both variants: the paired form around the moved text, then the declaration. */
function a13ComposeSelfClosing(ident: string): string {
  return [
    '<S id="p">',
    ...a13MovedLines("p.n", ident),
    "</S>",
    a13Declaration(ident),
    "",
  ].join("\n");
}

/** (d)'s composition, both variants: `para`, the moved text, the declaration. */
function a13ComposeAfterPara(ident: string): string {
  return ["para", ...a13MovedLines("n", ident), a13Declaration(ident), ""].join(
    "\n",
  );
}

// (e): a same-file move inside a text-position parent; the origin
// deletion's range ends exactly at the insertion point.
const A13_E_MOVED = '<S id="p.m">x</S>';
const A13_E_BEFORE = ['foo <S id="p">', `${A13_E_MOVED}</S> baz`, ""].join(
  "\n",
);
const A13_E_AFTER = [
  'foo <S id="p">',
  '<S id="p.n">x</S>',
  "</S> baz",
  "",
].join("\n");
// (f): a same-file top-level move of the file's last section, whose
// unterminated last line the deletion drops.
const A13_F_MOVED = ['<S id="m">', "y", "</S>"].join("\n");
const A13_F_BEFORE = ['<S id="a">x</S>', A13_F_MOVED].join("\n");
const A13_F_AFTER = ['<S id="a">x</S>', '<S id="n">', "y", "</S>", ""].join(
  "\n",
);

// (g): two declarations added to one spec file — the moved text carries
// embeddings through two third-module bindings the target lacks, into (b)'s
// self-closing target; the origin's sibling keeps a use of each, so both
// declarations stay there (SPEC 6.5).
const A13_FOURTH_SOURCE = ['<S id="b">', "B text.", "</S>", ""].join("\n");

/** The moved section of (g): one body line embedding through both third-module bindings. */
function a13TwiceMovedLines(id: string, x: string, y: string): string[] {
  return [
    `<S id="${id}">`,
    `Moved {text(${x}.a)} and {text(${y}.b)} text.`,
    "</S>",
  ];
}

const A13_G_ORIGIN_HEAD: readonly string[] = [
  'import X from "./x.xspec"',
  'import Y from "./y.xspec"',
  "",
  '<S id="s">',
  "Sib {text(X.a)} and {text(Y.b)} text.",
  "</S>",
  "",
];
const A13_G_ORIGIN_BEFORE = [
  ...A13_G_ORIGIN_HEAD,
  ...a13TwiceMovedLines("m", "X", "Y"),
  "",
].join("\n");
const A13_G_ORIGIN_AFTER = [...A13_G_ORIGIN_HEAD, ""].join("\n");

/**
 * (g)'s composition: the paired form around the moved text, the appended
 * closing tag, then the two declarations contiguous — in either order, the
 * one the implementation fixes read from the result (SPEC 6.5).
 */
function a13ComposeTwoDeclarations(
  idents: readonly string[],
): readonly string[] {
  const [x = "", y = ""] = idents;
  const declarations = [
    a13Declaration(x),
    a13Declaration(y, A13_FOURTH_SPECIFIER),
  ];
  return [declarations, [...declarations].reverse()].map((order) =>
    [
      '<S id="p">',
      ...a13TwiceMovedLines("p.n", x, y),
      "</S>",
      ...order,
      "",
    ].join("\n"),
  );
}

// (i): the third line-start kind 6.2 names — the origin deletion drops the
// file's unterminated last line, so the composed file's end, line 1's
// terminator preceding it, is a line start; the declaration asserted is
// the origin's own, its `d={"m"}` converting to imported form through the
// target module's declaration (T6.5-8's origin direction). The target is an
// existing file ending in a terminator, needing no declaration.
const A13_I_MOVED = ['<S id="m">', "y", "</S>"].join("\n");
const A13_I_ORIGIN_BEFORE = ['<S id="a" d={"m"} />', A13_I_MOVED].join("\n");
const A13_EXISTING_TARGET = '<S id="k">z</S>\n';
const A13_I_TARGET_AFTER = `${A13_EXISTING_TARGET}${A13_I_MOVED}\n`;
const A13_I_LINE_2 = A13_I_ORIGIN_BEFORE.indexOf(A13_I_MOVED);
const A13_I_REFERENCE = A13_I_ORIGIN_BEFORE.indexOf('"m"');

/** (i)'s composition: the converted reference, then the target module's declaration at the composed file's end. */
function a13ComposeOriginDeclaration(
  idents: readonly string[],
): readonly string[] {
  const [t = ""] = idents;
  return [
    [
      `<S id="a" d={${t}.m} />`,
      a13Declaration(t, A13_TARGET_SPECIFIER),
      "",
    ].join("\n"),
  ];
}

// (l): the admissibility exclusion for lines that were no ESM block's
// before the edit — the target's first two lines are one paragraph (an ESM
// block cannot interrupt a paragraph, 14.20), so its `import B …` line is
// content: `specs/B.mdx` is absent and the pre-move `build` is clean all
// the same; the indented twin heads the file with a paragraph line likewise.
const A13_L_HEAD: readonly string[] = [
  "// note",
  'import B from "./B.xspec"',
  "",
];
const A13_L_INDENTED_HEAD: readonly string[] = [
  '  import B from "./B.xspec"',
  "",
];

/** A paragraph-headed (l) arm: the head's lines, then (a)'s target; the root's own text the head verbatim. */
function a13ParagraphHeadedArm(
  key: string,
  summary: string,
  head: readonly string[],
): A13Arm {
  const target = [...head, '<S id="p">', "x", "</S>", ""].join("\n");
  const ownText = `${head.join("\n")}\n`;
  return {
    ...a13CrossArm({
      key,
      summary,
      target,
      newId: "p.n",
      compose: (ident) => [...head, a13ComposeIntoP(ident, [""])].join("\n"),
      previewEdits: [
        a13At("target-insertion", target.indexOf("</S>")),
        a13At("import-addition", target.length),
      ],
      ownTextBefore: ownText,
      ownTextAfter: ownText,
      ownHashChanges: false,
    }),
    cleanBefore: true,
    viewImports: true,
  };
}

// (h)/(j): a dependent of the target root in another file — `d={B}`, the
// bare imported module (T2.2-2) — so the root's `changed` cascades to it as
// `upstream-changed` (SPEC 5.6) though the move touched no requirement of
// that file; the move leaves the file untouched (the root's identity, its
// target, is unchanged).
const A13_DEPENDENT = "specs/dep.mdx";
const A13_DEPENDENT_SOURCE = [
  'import B from "./b.xspec"',
  "",
  '<S id="k" d={B}>',
  "Dep text.",
  "</S>",
  "",
].join("\n");

// (h): the mid-line addition off the file's end — the end of the `</S>`
// line before its terminator is the only admissible offset (offset 0 would
// absorb the tag's line, every line start from `x` through `</S>` lies
// inside `p`, the start of the `trailing` line would absorb that line, and
// the file's end follows a paragraph line).
const A13_H_TARGET = ['<S id="p">', "x", "</S>", "trailing"].join("\n");

// (j): the file's-end addition whose ended line is kept — the closing
// tag's line a flow line holding a tag and an expression container alone
// (14.20; T3-3's constraint), the root embedding its own child, no cycle
// (5.3); own text carries the embedding fully expanded (SPEC 1.6): `p`'s
// subtree text before the move, `p`'s grown subtree text — the moved body
// line with `{text(<X>.a)}` replaced by `a`'s subtree text — then the added
// terminator after it.
const A13_J_TARGET = ['<S id="p">', "x", '</S>{text("p")}'].join("\n");
const A13_A_SUBTREE_TEXT = "A text.\n";
const A13_J_OWN_BEFORE = "x\n";
const A13_J_OWN_AFTER = `x\nMoved ${A13_A_SUBTREE_TEXT} text.\n\n`;

/** (j)'s composition: the moved text before the closing tag, the tag's line ended, then the declaration. */
function a13ComposeBeforeEmbeddingLine(ident: string): string {
  return [
    '<S id="p">',
    "x",
    ...a13MovedLines("p.n", ident),
    '</S>{text("p")}',
    a13Declaration(ident),
    "",
  ].join("\n");
}

/**
 * (h)/(j)'s category expectation against the pre-move baseline (SPEC 5.6,
 * 6.2): the target root `changed` beside `p` and the origin parent, with
 * their ordinary cascades (T6.2-3's tolerances: `descendant-changed`
 * attributed within the child that departed or arrived, and, where the
 * root embeds `p`, `upstream-changed` through that embedding); the
 * other-file dependent `upstream-changed` with the root among the nodes it
 * is attributed to, its own root tolerated `upstream-changed` as a
 * dependent's ancestor (5.6); the moved node, the sibling, and the third
 * module's nodes carrying none; no other node `changed`.
 */
function a13DependentImpact(rootEmbedsChild: boolean): A13ImpactExpectation {
  const parent = `${A13_TARGET}#p`;
  const moved = `${A13_TARGET}#p.n`;
  const dependent = `${A13_DEPENDENT}#k`;
  const originating = [A13_TARGET, parent, A13_ORIGIN, moved];
  return {
    known: [
      A13_ORIGIN,
      `${A13_ORIGIN}#s`,
      A13_TARGET,
      parent,
      moved,
      A13_THIRD,
      `${A13_THIRD}#a`,
      A13_DEPENDENT,
      dependent,
    ],
    pins: [
      {
        identity: A13_TARGET,
        required: ["changed"],
        changedWithin: originating,
        optional: [
          { category: "descendant-changed", within: [parent, moved] },
          ...(rootEmbedsChild
            ? [{ category: "upstream-changed" as const, within: originating }]
            : []),
        ],
      },
      {
        identity: parent,
        required: ["changed"],
        changedWithin: [parent, moved],
        optional: [{ category: "descendant-changed", within: [moved] }],
      },
      {
        identity: A13_ORIGIN,
        required: ["changed"],
        changedWithin: [A13_ORIGIN, moved],
        optional: [{ category: "descendant-changed", within: [moved] }],
      },
      {
        identity: dependent,
        required: ["upstream-changed"],
        attributed: [
          {
            category: "upstream-changed",
            within: originating,
            mustInclude: [A13_TARGET],
          },
        ],
      },
      {
        identity: A13_DEPENDENT,
        required: [],
        optional: [{ category: "upstream-changed", within: originating }],
      },
      { identity: moved, required: [] },
      { identity: `${A13_ORIGIN}#s`, required: [] },
      { identity: A13_THIRD, required: [] },
      { identity: `${A13_THIRD}#a`, required: [] },
    ],
    reason:
      "the target root is `changed` — the addition, elsewhere than at a " +
      "line's start, splits a line of its own content (SPEC 6.2) — beside " +
      "`p` and the origin parent `changed` with their ordinary cascades " +
      "(T6.2-3); its other-file dependent (`d={B}`) is `upstream-changed` " +
      "with the root among the originating nodes it is attributed to (SPEC " +
      "5.6); the moved node carries no category — its runs, its embedding's " +
      "canonical identity, and its metadataHash unchanged (5.5); no other " +
      "node is `changed`",
  };
}

/** (h)/(j): a cross-file arm with the dependent file staged beside and the category expectation asserted. */
function a13DependentArm(
  spec: Parameters<typeof a13CrossArm>[0],
  rootEmbedsChild: boolean,
): A13Arm {
  const arm = a13CrossArm(spec);
  return {
    ...arm,
    files: { ...arm.files, [A13_DEPENDENT]: A13_DEPENDENT_SOURCE },
    others: [
      ...arm.others,
      {
        rel: A13_DEPENDENT,
        bytes: A13_DEPENDENT_SOURCE,
        reason:
          "the dependent file untouched — its `d={B}` names the target " +
          "root, whose identity the move keeps",
      },
    ],
    impact: () => a13DependentImpact(rootEmbedsChild),
  };
}

// (k): the removal-side line start — a third spec source `specs/c.mdx`
// referencing the moved section through its origin-module binding, the
// declaration the block's only line and the file's unterminated last: the
// reference re-roots to the target module, the declaration's last use is
// gone, and the removal drops the unterminated last line, so over the
// composed text the file's end — line 1's terminator preceding it — is a
// line start. The moved section is local to its subtree, beside a sibling;
// neither the origin nor the existing target needs a declaration.
const A13_SPEC_C = "specs/c.mdx";
const A13_K_ORIGIN_HEAD: readonly string[] = [
  '<S id="s">',
  "Sib text.",
  "</S>",
  "",
];
const A13_K_MOVED = ['<S id="m">', "Moved text.", "</S>"].join("\n");
const A13_K_ORIGIN_BEFORE = [...A13_K_ORIGIN_HEAD, A13_K_MOVED, ""].join("\n");
const A13_K_ORIGIN_AFTER = [...A13_K_ORIGIN_HEAD, ""].join("\n");
const A13_K_TARGET_AFTER = `${A13_EXISTING_TARGET}${A13_K_MOVED}\n`;
const A13_K_C_BEFORE = [
  '<S id="q" d={A.m} />',
  'import A from "./a.xspec"',
].join("\n");
const A13_K_C_LINE_2 = A13_K_C_BEFORE.indexOf("import A");
const A13_K_C_REFERENCE = A13_K_C_BEFORE.indexOf("A.m");

/** (k)'s composition: the re-rooted reference, then the target module's declaration at the composed file's end. */
function a13ComposeThirdFileDeclaration(
  idents: readonly string[],
): readonly string[] {
  const [t = ""] = idents;
  return [
    [
      `<S id="q" d={${t}.m} />`,
      a13Declaration(t, A13_TARGET_SPECIFIER),
      "",
    ].join("\n"),
  ];
}

/**
 * (k)'s category expectation (SPEC 5.6, 6.2, 5.5): `c.mdx`'s root keeps
 * its own content and `q` carries no category — its `d` target's canonical
 * identity, mapped through the journal, and its effectiveHash unchanged;
 * the two parents, the origin's and the target's roots, `changed` with
 * their ordinary cascades (T6.2-3); the clean-boundary moved node, the
 * sibling, and the target's existing child carrying none.
 */
function a13ThirdFileImpact(): A13ImpactExpectation {
  const moved = `${A13_TARGET}#m`;
  return {
    known: [
      A13_ORIGIN,
      `${A13_ORIGIN}#s`,
      A13_TARGET,
      `${A13_TARGET}#k`,
      moved,
      A13_SPEC_C,
      `${A13_SPEC_C}#q`,
    ],
    pins: [
      {
        identity: A13_ORIGIN,
        required: ["changed"],
        changedWithin: [A13_ORIGIN, moved],
        optional: [{ category: "descendant-changed", within: [moved] }],
      },
      {
        identity: A13_TARGET,
        required: ["changed"],
        changedWithin: [A13_TARGET, moved],
        optional: [{ category: "descendant-changed", within: [moved] }],
      },
      { identity: A13_SPEC_C, required: [] },
      { identity: `${A13_SPEC_C}#q`, required: [] },
      { identity: moved, required: [] },
      { identity: `${A13_ORIGIN}#s`, required: [] },
      { identity: `${A13_TARGET}#k`, required: [] },
    ],
    reason:
      "`c.mdx`'s root keeps its own content — the removal and the addition " +
      "each drop a whole line (SPEC 6.2, 3) — and `q` carries no category, " +
      "its `d` target's canonical identity, mapped through the journal, and " +
      "its effectiveHash unchanged (5.5); the two parents, the origin's and " +
      "the target's roots, are `changed` with their ordinary cascades " +
      "(T6.2-3); no other node is `changed`",
  };
}

const A13_ARMS: readonly A13Arm[] = [
  a13CrossArm({
    key: "(a)",
    summary:
      "the preference — of the target's two admissible offsets, the file's " +
      "end after its final terminator (a line start) is taken over the end " +
      "of the `</S>` line before that terminator (mid-line, which would " +
      "leave a kept empty line): the moved text and its terminator inserted " +
      "before `</S>`, the declaration plus U+000A appended after the final " +
      "terminator, nothing else",
    target: A13_A_TARGET,
    newId: "p.n",
    compose: (ident) => a13ComposeIntoP(ident, [""]),
    previewEdits: [
      a13At("target-insertion", A13_A_TARGET.indexOf("</S>")),
      a13At("import-addition", A13_A_TARGET.length),
    ],
    ownTextBefore: "",
    ownTextAfter: "",
    ownHashChanges: false,
  }),
  a13CrossArm({
    key: "(a, sibling)",
    summary:
      "the only line-start admissible offset is the start of the empty line " +
      "after the `</S>` line — the file's end would follow a paragraph line " +
      "as paragraph text, and the start of the `trailing` line would absorb " +
      "it — so the declaration stands at that empty line's start, the empty " +
      "line kept after it",
    target: A13_A_SIBLING_TARGET,
    newId: "p.n",
    compose: (ident) => a13ComposeIntoP(ident, ["", "trailing"]),
    previewEdits: [
      a13At("target-insertion", A13_A_SIBLING_TARGET.indexOf("</S>")),
      a13At("import-addition", A13_A_SIBLING_TARGET.indexOf("\n\n") + 1),
    ],
    ownTextBefore: "\ntrailing",
    ownTextAfter: "\ntrailing",
    ownHashChanges: false,
  }),
  a13CrossArm({
    key: "(b)",
    summary:
      "6.5's worked self-closing case — an addition at offset 0 would absorb " +
      "the tag's line into its ESM block, so the tag's end is the only " +
      "admissible offset: the parent rewritten to the paired form, the moved " +
      "text between its tags, the declaration after the appended closing " +
      "tag, each preceded by the terminator a tag's `>` requires",
    target: A13_B_TARGET,
    newId: "p.n",
    compose: a13ComposeSelfClosing,
    previewEdits: [
      a13Span("target-parent-rewrite", 0, A13_B_TARGET.length),
      a13At("import-addition", A13_B_TARGET.length),
      a13At("target-insertion", A13_B_TARGET.length),
    ],
    ownTextBefore: "",
    ownTextAfter: "",
    ownHashChanges: false,
  }),
  a13CrossArm({
    key: "(b, terminated)",
    summary:
      "the self-closing case with a final terminator after the tag — the " +
      "same bytes result, the addition at the file's end, a line start, " +
      "taken over the tag's end",
    target: `${A13_B_TARGET}\n`,
    newId: "p.n",
    compose: a13ComposeSelfClosing,
    previewEdits: [
      a13Span("target-parent-rewrite", 0, A13_B_TARGET.length),
      a13At("target-insertion", A13_B_TARGET.length),
      a13At("import-addition", A13_B_TARGET.length + 1),
    ],
    ownTextBefore: "",
    ownTextAfter: "",
    ownHashChanges: false,
  }),
  a13CrossArm({
    key: "(c)",
    summary:
      "the forced mid-line case — offset 0 absorbs the tag line and every " +
      "other line start lies inside the section, so the file's end, " +
      "mid-line, is the only admissible offset: the added terminator ends " +
      "the `</S>` line, which drops as it did before, then the declaration " +
      "and its terminator",
    target: A13_C_TARGET,
    newId: "p.n",
    compose: (ident) => a13ComposeIntoP(ident, [""]),
    previewEdits: [
      a13At("target-insertion", A13_C_TARGET.indexOf("</S>")),
      a13At("import-addition", A13_C_TARGET.length),
    ],
    ownTextBefore: "",
    ownTextAfter: "",
    ownHashChanges: false,
  }),
  a13CrossArm({
    key: "(d)",
    summary:
      "a top-level `new-id` at the end of a file whose unterminated last " +
      "line is a paragraph line — the moved text, preceded by a terminator, " +
      "then the declaration at the same offset, admissible after the flow " +
      "closing tag's line where the reverse order would make it paragraph " +
      "text; no empty line between",
    target: A13_D_TARGET,
    newId: "n",
    compose: a13ComposeAfterPara,
    previewEdits: [
      a13At("import-addition", A13_D_TARGET.length),
      a13At("target-insertion", A13_D_TARGET.length),
    ],
    ownTextBefore: "para",
    ownTextAfter: "para\n",
    ownHashChanges: true,
  }),
  a13CrossArm({
    key: "(d, terminated)",
    summary:
      "the terminated variant — the target insertion at a line start, so no " +
      "terminator is added before the moved text, and the declaration's " +
      "only line-start admissible offset is the file's end again (offset 0 " +
      "would absorb `para` into the block; the end of the `para` line " +
      "before its terminator would leave the declaration paragraph text)",
    target: `${A13_D_TARGET}\n`,
    newId: "n",
    compose: a13ComposeAfterPara,
    previewEdits: [
      a13At("import-addition", A13_D_TARGET.length + 1),
      a13At("target-insertion", A13_D_TARGET.length + 1),
    ],
    ownTextBefore: "para\n",
    ownTextAfter: "para\n",
    ownHashChanges: true,
  }),
  {
    key: "(e)",
    summary:
      "the target insertion judged over the composed text — the origin " +
      "deletion's range ends exactly at the insertion point, which line 1's " +
      "terminator precedes once the deletion is composed, so no terminator " +
      "is added; a product judging the pre-operation text (the point " +
      "preceded by `>`) emits an empty line before the moved text, ending " +
      "the paragraph with `p` unclosed",
    files: { [A13_ORIGIN]: A13_E_BEFORE },
    argv: ["move", `${A13_ORIGIN}#p.m`, `${A13_ORIGIN}#p.n`],
    receiving: A13_ORIGIN,
    added: [],
    compose: () => [A13_E_AFTER],
    others: [],
    previewEdits: a13SameFileEdits(
      A13_E_BEFORE,
      A13_E_MOVED,
      'id="p.m"',
      A13_E_BEFORE.indexOf("</S> baz"),
      A13_E_BEFORE.indexOf(A13_E_MOVED) + A13_E_MOVED.length,
    ),
    root: {
      identity: A13_ORIGIN,
      ownTextBefore: "foo  baz\n",
      ownTextAfter: "foo  baz\n",
      ownHashChanges: false,
    },
  },
  {
    key: "(f)",
    summary:
      "an insertion at the end of a file whose unterminated last line the " +
      "origin deletion drops — what the deletion leaves before the file's " +
      "end is line 1's terminator, so none is added: T6.2-4's " +
      "pure-in-effect final-position move",
    files: { [A13_ORIGIN]: A13_F_BEFORE },
    argv: ["move", `${A13_ORIGIN}#m`, `${A13_ORIGIN}#n`],
    receiving: A13_ORIGIN,
    added: [],
    compose: () => [A13_F_AFTER],
    others: [],
    previewEdits: a13SameFileEdits(
      A13_F_BEFORE,
      A13_F_MOVED,
      'id="m"',
      A13_F_BEFORE.length,
      A13_F_BEFORE.length,
    ),
    root: {
      identity: A13_ORIGIN,
      ownTextBefore: "\n",
      ownTextAfter: "\n",
      ownHashChanges: false,
    },
  },
  {
    key: "(g)",
    summary:
      "two declarations added to one spec file — after the appended closing " +
      "tag, U+000A, then the two declarations on contiguous lines, each " +
      "followed by U+000A alone, one ESM block with no empty line between " +
      "them, in an order the product fixes, the first preceded by the " +
      "terminator the tag's `>` requires; the preview holds exactly two " +
      "`import-addition` entries, one per added declaration, both " +
      "zero-length at the tag's end and ordered before the " +
      "`target-insertion` there",
    files: {
      [A13_ORIGIN]: A13_G_ORIGIN_BEFORE,
      [A13_THIRD]: A13_THIRD_SOURCE,
      [A13_FOURTH]: A13_FOURTH_SOURCE,
      [A13_TARGET]: A13_B_TARGET,
    },
    argv: ["move", `${A13_ORIGIN}#m`, `${A13_TARGET}#p.n`],
    receiving: A13_TARGET,
    added: [A13_THIRD_SPECIFIER, A13_FOURTH_SPECIFIER],
    compose: a13ComposeTwoDeclarations,
    others: [
      {
        rel: A13_ORIGIN,
        bytes: A13_G_ORIGIN_AFTER,
        reason:
          "the moved construct deleted in place, its emptied line dropped " +
          "with its terminator, the blank line before it kept, both " +
          "declarations kept for the sibling's uses",
      },
      { rel: A13_THIRD, bytes: A13_THIRD_SOURCE, reason: A13_BYSTANDER_REASON },
      {
        rel: A13_FOURTH,
        bytes: A13_FOURTH_SOURCE,
        reason: A13_BYSTANDER_REASON,
      },
    ],
    previewEdits: [
      [
        a13Span("target-parent-rewrite", 0, A13_B_TARGET.length),
        a13At("import-addition", A13_B_TARGET.length),
        a13At("import-addition", A13_B_TARGET.length),
        a13At("target-insertion", A13_B_TARGET.length),
      ],
    ],
    root: {
      identity: A13_TARGET,
      ownTextBefore: "",
      ownTextAfter: "",
      ownHashChanges: false,
    },
    repeatable: true,
  },
  a13DependentArm(
    {
      key: "(h)",
      summary:
        "the mid-line addition off the file's end — offset 0 would absorb " +
        "the tag's line into the block, every line start from `x` through " +
        "`</S>` lies inside `p`, the start of the `trailing` line would " +
        "absorb that line, and the file's end follows a paragraph line, so " +
        "the end of the `</S>` line before its terminator is the only " +
        "admissible offset: the added terminator ends the `</S>` line, " +
        "which drops as it did before, the declaration's line drops whole, " +
        "and the `</S>` line's original terminator is left an empty line, " +
        "kept",
      target: A13_H_TARGET,
      newId: "p.n",
      compose: (ident) => a13ComposeIntoP(ident, ["", "trailing"]),
      previewEdits: [
        a13At("target-insertion", A13_H_TARGET.indexOf("</S>")),
        a13At("import-addition", A13_H_TARGET.indexOf("</S>") + 4),
      ],
      ownTextBefore: "trailing",
      ownTextAfter: "\ntrailing",
      ownHashChanges: true,
    },
    false,
  ),
  {
    key: "(i)",
    summary:
      "the third line-start kind — the deletion's range runs from the start " +
      'of line 2 to the file\'s end, leaving the converted `<S id="a" ' +
      "d={<T>.m} />` line and its terminator; offset 0 would absorb the " +
      "tag's line into the block, so the composed file's end — line 1's " +
      "terminator preceding it, a line start — is taken with no terminator " +
      "added: an insertion where the origin deletion's range ends reads " +
      "what the deletion leaves",
    files: {
      [A13_ORIGIN]: A13_I_ORIGIN_BEFORE,
      [A13_TARGET]: A13_EXISTING_TARGET,
    },
    argv: ["move", `${A13_ORIGIN}#m`, `${A13_TARGET}#m`],
    receiving: A13_ORIGIN,
    added: [A13_TARGET_SPECIFIER],
    compose: a13ComposeOriginDeclaration,
    others: [
      {
        rel: A13_TARGET,
        bytes: A13_I_TARGET_AFTER,
        reason:
          "the moved text appended at the file's end after its final " +
          "terminator — a line start, so none is added before it — followed " +
          "by its own, the ID kept",
      },
    ],
    previewEdits: [
      [
        a13Span("reference-rewrite", A13_I_REFERENCE, A13_I_REFERENCE + 3),
        a13At("import-addition", A13_I_LINE_2),
        a13Span("origin-deletion", A13_I_LINE_2, A13_I_ORIGIN_BEFORE.length),
      ],
      [
        a13Span("reference-rewrite", A13_I_REFERENCE, A13_I_REFERENCE + 3),
        a13Span("origin-deletion", A13_I_LINE_2, A13_I_ORIGIN_BEFORE.length),
        a13At("import-addition", A13_I_ORIGIN_BEFORE.length),
      ],
    ],
    root: {
      identity: A13_ORIGIN,
      ownTextBefore: "",
      ownTextAfter: "",
      ownHashChanges: true,
    },
  },
  a13DependentArm(
    {
      key: "(j)",
      summary:
        "the file's-end addition whose ended line is kept — offset 0 would " +
        "absorb the tag's line into the block and every other line start " +
        "lies inside `p`, so the file's end, mid-line, is the only " +
        "admissible offset: the added terminator ends the " +
        '`</S>{text("p")}` line, which is kept, its excised embedding ' +
        "counting as remaining line content (1.6) so that the drop rule of " +
        "3 spares it, unlike (c)'s bare `</S>` line",
      target: A13_J_TARGET,
      newId: "p.n",
      compose: a13ComposeBeforeEmbeddingLine,
      previewEdits: [
        a13At("target-insertion", A13_J_TARGET.indexOf("</S>")),
        a13At("import-addition", A13_J_TARGET.length),
      ],
      ownTextBefore: A13_J_OWN_BEFORE,
      ownTextAfter: A13_J_OWN_AFTER,
      ownHashChanges: true,
    },
    true,
  ),
  {
    key: "(k)",
    summary:
      "the removal-side line start — `A.m` re-roots to `<T>.m`, `A`'s " +
      "declaration, its last use gone, is removed with its unterminated " +
      "last line, and over the composed text offset 0 would absorb the " +
      "tag's line into the block, so the composed file's end — line 1's " +
      "terminator preceding it, a line start — is the only admissible " +
      "offset, taken with no terminator added: an insertion where a " +
      "removal's range ends reads what the removal leaves",
    files: {
      [A13_ORIGIN]: A13_K_ORIGIN_BEFORE,
      [A13_TARGET]: A13_EXISTING_TARGET,
      [A13_SPEC_C]: A13_K_C_BEFORE,
    },
    argv: ["move", `${A13_ORIGIN}#m`, `${A13_TARGET}#m`],
    receiving: A13_SPEC_C,
    added: [A13_TARGET_SPECIFIER],
    compose: a13ComposeThirdFileDeclaration,
    others: [
      {
        rel: A13_ORIGIN,
        bytes: A13_K_ORIGIN_AFTER,
        reason:
          "the moved construct deleted in place, its emptied line dropped " +
          "with its terminator, the blank line before it kept, the sibling " +
          "untouched",
      },
      {
        rel: A13_TARGET,
        bytes: A13_K_TARGET_AFTER,
        reason:
          "the moved text appended at the file's end after its final " +
          "terminator — a line start, so none is added before it — followed " +
          "by its own, the ID kept",
      },
    ],
    previewEdits: [
      [
        a13Span("reference-rewrite", A13_K_C_REFERENCE, A13_K_C_REFERENCE + 3),
        a13At("import-addition", A13_K_C_LINE_2),
        a13Span("import-removal", A13_K_C_LINE_2, A13_K_C_BEFORE.length),
      ],
      [
        a13Span("reference-rewrite", A13_K_C_REFERENCE, A13_K_C_REFERENCE + 3),
        a13Span("import-removal", A13_K_C_LINE_2, A13_K_C_BEFORE.length),
        a13At("import-addition", A13_K_C_BEFORE.length),
      ],
    ],
    root: {
      identity: A13_SPEC_C,
      ownTextBefore: "",
      ownTextAfter: "",
      ownHashChanges: false,
    },
    impact: () => a13ThirdFileImpact(),
  },
  a13ParagraphHeadedArm(
    "(l)",
    "the admissibility exclusion for lines that were no ESM block's before " +
      "the edit — offset 0 heads a block joining the paragraph's lines, " +
      "deriving yet inadmissible; the start of line 2, the start of the " +
      "empty line, and every mid-line offset of the paragraph leave the " +
      'added line paragraph text; every line start from `<S id="p">` on ' +
      "absorbs the tag's line or lies inside `p`; so the file's end after " +
      "the final terminator is the only admissible offset: the moved text " +
      "and its terminator inserted before `</S>`, the declaration plus " +
      "U+000A appended, the paragraph's bytes untouched",
    A13_L_HEAD,
  ),
  a13ParagraphHeadedArm(
    "(l, indented)",
    'the indented twin — `  import B from "./B.xspec"` heading the file ' +
      "in the paragraph's place, a paragraph line likewise: offset 0 and " +
      "the offset after its two spaces each head a block absorbing that " +
      "line, deriving yet inadmissible, so the file's end is again the " +
      "only admissible offset, the expectations the same",
    A13_L_INDENTED_HEAD,
  ),
];

/**
 * S-9's premise: a composed expectation derives under the stock MDX 3
 * grammar. A failure here is the arm's own defect — a harness error, never
 * a product verdict.
 */
function a13AssertPremiseDerives(text: string, arm: A13Arm): void {
  const verdict = deriveMdx(text);
  if (verdict.derives) return;
  throw new HarnessStagingError(
    "mdx-derivability",
    arm.receiving,
    `T6.5-13 ${arm.key}: the composed expectation does not derive under ` +
      `the stock MDX 3 grammar (${verdict.reason}) — the arm's premise, not ` +
      `a product verdict; the text reads ${JSON.stringify(text)}`,
  );
}

/**
 * The fresh identifiers the receiving file's added declarations bind, read
 * off the declaration lines — for each lacked module exactly one line
 * `import <X> from "<specifier>"`, its other characters T6.5-8's (SPEC 6.5,
 * 2.1) — distinct from one another and none of the compiler-provided names.
 */
function a13ReadAddedIdentifiers(
  actual: string,
  arm: A13Arm,
  context: string,
): readonly string[] {
  const idents: string[] = [];
  for (const specifier of arm.added) {
    const escaped = specifier.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
    const pattern = new RegExp(
      `^import ([A-Za-z_$][A-Za-z0-9_$]*) from "${escaped}"$`,
      "gm",
    );
    const matches = [...actual.matchAll(pattern)];
    const ident = matches.length === 1 ? matches[0]?.[1] : undefined;
    if (ident === undefined) {
      fail(
        `${context}: ${arm.receiving} after the move holds exactly one added ` +
          `declaration of the module "${specifier}" — a line of its own ` +
          `spelled \`import <X> from "${specifier}"\`, single spaces, no ` +
          `statement terminator, the specifier double-quoted in its ` +
          `canonical spelling — the one binding the spellings rooted at it ` +
          `(SPEC 6.5, 2.1); found ${String(matches.length)} in ${JSON.stringify(actual)}`,
      );
    }
    if (MDX_RESERVED_NAMES.includes(ident)) {
      fail(
        `${context}: the added declaration binds \`${ident}\`, one of the ` +
          `compiler-provided names an added import in a spec source may not ` +
          `bind (SPEC 6.5, 2.1)`,
      );
    }
    if (idents.includes(ident)) {
      fail(
        `${context}: the added declarations bind \`${ident}\` twice — each ` +
          `binds a fresh identifier distinct from the others added there ` +
          `(SPEC 6.5)`,
      );
    }
    idents.push(ident);
  }
  return idents;
}

/** Name the headline deviation of a receiving file byte-equal to none of its composed forms. */
function a13Deviation(
  actual: string,
  expected: readonly string[],
  added: number,
): string {
  if (added > 0 && actual.startsWith("import ")) {
    return (
      "a declaration heads the file at offset 0 — an inadmissible offset: " +
      "the ESM block it begins absorbs the line after it (14.20), and 6.5 " +
      "takes the admissible line-start offset the arm names"
    );
  }
  if (expected.some((form) => actual === `${form}\n`)) {
    return (
      "a kept empty line follows the declaration — the mid-line offset " +
      "before the closing-tag line's terminator was taken over the " +
      "line-start offset at the file's end"
    );
  }
  return "";
}

/** `query node <root>` decoded, for the root's own text and ownHash (SPEC 1.6, 5.5). */
async function a13QueryRoot(
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
      `${label}: the report is about ${JSON.stringify(node.identity)}, not ` +
        `the root ${JSON.stringify(identity)} (SPEC 1.5, 11.1)`,
    );
  }
  return node;
}

/** The receiving file's entry of the move's preview (SPEC 6.6, 12.7). */
async function a13PreviewEntry(
  product: ProductBinding,
  workspace: TestWorkspace,
  arm: A13Arm,
  context: string,
): Promise<PreviewFileEntry> {
  const label = `${context} \`${arm.argv.join(" ")} --preview --json\``;
  const report = decodePreviewReport(
    await runJson(
      product,
      workspace,
      [...arm.argv, "--preview", "--json"],
      label,
    ),
    label,
  );
  if (report.files === null) {
    fail(
      `${label}: a preview exiting 0 succeeds as the real operation would ` +
        `and reports its \`files\` — \`null\` is a refused preview's form ` +
        `(SPEC 6.6, 12.7); findings: ${JSON.stringify(report.findings)}`,
    );
  }
  const entry = report.files.find(
    (candidate) => candidate.file === arm.receiving,
  );
  if (entry === undefined) {
    fail(
      `${label}: \`files\` holds an entry for ${arm.receiving}, a file the ` +
        `operation rewrites — its insertion or deletion` +
        (arm.added.length > 0 ? " and import addition" : "") +
        ` (SPEC 6.6, 12.7); got ` +
        `[${report.files.map((candidate) => JSON.stringify(candidate.file)).join(", ")}]`,
    );
  }
  return entry;
}

/**
 * The preview's edits for the receiving file are exactly one of the arm's
 * admissible lists: each class plus a range in current, pre-operation
 * coordinates, the insertion points zero-length at the offsets the real
 * operation then uses, in 12.7's order — class-name bytes breaking the
 * tie between coinciding insertion points (SPEC 6.6, 12.7; T6.6-4(b)).
 */
function a13AssertPreviewEdits(
  entry: PreviewFileEntry,
  arm: A13Arm,
  context: string,
): void {
  const actual = entry.edits.map((edit) => ({
    class: edit.class,
    range: { start: edit.range.start, end: edit.range.end },
  }));
  const shown = JSON.stringify(actual);
  if (
    arm.previewEdits.some((candidate) => JSON.stringify(candidate) === shown)
  ) {
    return;
  }
  fail(
    `${context} preview: ${arm.receiving}'s edits are exactly ` +
      arm.previewEdits
        .map((candidate) => JSON.stringify(candidate))
        .join(" or ") +
      ` — each class plus a range in current, pre-operation coordinates, ` +
      `the insertion points zero-length at the offsets the real operation ` +
      `then uses (the bytes above agree with them), ordered by range start, ` +
      `then range end, then class-name bytes (SPEC 6.6, 12.7; T6.6-4(b)); ` +
      `got ${shown}`,
  );
}

/**
 * The receiving file's `view` entry lists under `imports` exactly the
 * declarations `idents` names (SPEC 11.4): none before the move — the
 * paragraph's `import B …` line being content, no ESM block's (14.20) —
 * and afterwards the added declaration alone, its range the declaration's
 * own characters in the rewritten bytes, its name the fresh identifier, its
 * target the module's source.
 */
async function a13AssertViewImports(
  product: ProductBinding,
  workspace: TestWorkspace,
  arm: A13Arm,
  idents: readonly string[],
  actual: string,
  context: string,
  when: "before" | "after",
): Promise<void> {
  const label = `${context} \`view ${arm.receiving}\` ${when} the move`;
  const report = decodeViewReport(
    await runJson(product, workspace, ["view", arm.receiving], label),
    { text: false },
    label,
  );
  const view = report.views.find(
    (candidate) => candidate.file === arm.receiving,
  );
  if (view === undefined) {
    fail(
      `${label}: \`views\` holds the requested file's view — a parseable ` +
        `discovered spec source (SPEC 11.4); got ` +
        `[${report.views.map((candidate) => JSON.stringify(candidate.file)).join(", ")}]`,
    );
  }
  const expected = idents.map((ident, index) => {
    const specifier = arm.added[index] ?? "";
    const line = `import ${ident} from "${specifier}"`;
    const start = actual.indexOf(line);
    return {
      range: { start, end: start + line.length },
      name: ident,
      target: A13_MODULE_SOURCES[specifier] ?? "",
    };
  });
  assertSameJson(
    view.imports,
    expected,
    `${label}: \`imports\` lists ` +
      (when === "before"
        ? "no declaration — the file's `import B …` line is a paragraph's, " +
          "content and no ESM block's (SPEC 14.20, 11.4; T3-1's grammar boundary)"
        : "the added declaration alone — its range the declaration's own " +
          "characters, its name the fresh identifier, its target the third " +
          "module's source; the paragraph's line still content (SPEC 11.4, 6.5)"),
  );
}

/** `impact --base <pre-move ref> --json` against the arm's pins (SPEC 5.6, 6.2). */
async function a13AssertImpact(
  product: ProductBinding,
  workspace: TestWorkspace,
  base: string,
  expectation: A13ImpactExpectation,
  context: string,
): Promise<void> {
  const label = `${context} \`impact --base <pre-move ref> --json\``;
  const report = decodeImpactReport(
    await runJson(
      product,
      workspace,
      ["impact", "--base", base, "--json"],
      label,
    ),
    label,
  );
  assertImpactPins(
    report,
    expectation.known,
    expectation.pins,
    `${label} — ${expectation.reason}`,
  );
}

/**
 * H-6: the order the implementation fixes among several added declarations
 * is byte-identical across repeated runs — the move performed again in a
 * fresh workspace of the same staging yields the same receiving bytes.
 */
async function a13AssertRepeatable(
  product: ProductBinding,
  arm: A13Arm,
  first: string,
): Promise<void> {
  const context = `T6.5-13 ${arm.key} (repeated run)`;
  await withWorkspace(arm.files, async (workspace) => {
    await buildOk(product, workspace, `${context} \`build\` over the staging`);
    await expectExit(
      product,
      workspace,
      [...arm.argv],
      0,
      `${context} \`${arm.argv.join(" ")}\` — a performable move (SPEC 6.5)`,
    );
    const again = await readSourceText(workspace, arm.receiving, context);
    if (again !== first) {
      fail(
        `${context}: ${arm.receiving} after the same move in a fresh ` +
          `workspace is byte-identical to the first run's — the order the ` +
          `implementation fixes among the added declarations, and their ` +
          `identifiers, are deterministic for a given operation and ` +
          `workspace state (SPEC 6.5, 6.1; H-6)\n` +
          `  first: ${JSON.stringify(first)}\n` +
          `  again: ${JSON.stringify(again)}`,
      );
    }
  });
}

/** The placeholder identifiers the premise check composes with (any valid identifiers serve). */
const A13_PLACEHOLDER_IDENTS: readonly string[] = ["X", "Y", "Z"];

/**
 * Run one arm: preview, move, bytes, preview agreement, the root's own
 * content, clean `check`/`build`, and the arm's `view` and `impact`
 * expectations where it states them; returns the receiving file's bytes.
 */
async function runA13Arm(
  product: ProductBinding,
  arm: A13Arm,
): Promise<string> {
  const context = `T6.5-13 ${arm.key}`;
  for (const form of arm.compose(
    A13_PLACEHOLDER_IDENTS.slice(0, arm.added.length),
  )) {
    a13AssertPremiseDerives(form, arm);
  }
  return await withWorkspace(arm.files, async (workspace) => {
    await buildOk(product, workspace, `${context} \`build\` over the staging`);
    if (arm.cleanBefore === true) {
      await expectFindingFreeReport(
        product,
        workspace,
        ["build", "--json"],
        `${context} \`build --json\` over the staging — clean: the target's ` +
          `paragraph-headed \`import B …\` line is content, no declaration ` +
          `of an absent module (SPEC 14.20, 12.1; T3-1's grammar boundary)`,
      );
    }
    let base = "";
    if (arm.impact !== undefined) {
      await workspace.gitInit();
      base = await workspace.gitCommitAll("pre-move baseline");
    }
    const before = await a13QueryRoot(
      product,
      workspace,
      arm.root.identity,
      context,
    );
    if (before.ownText !== arm.root.ownTextBefore) {
      fail(
        `${context}: before the move, the root ${arm.root.identity}'s own ` +
          `text is ${JSON.stringify(arm.root.ownTextBefore)} — its runs ` +
          `outside the child constructs joined at the excision points, the ` +
          `lines the removals leave empty dropped with their terminators ` +
          `(SPEC 1.6, 3); \`query node\` reports ${JSON.stringify(before.ownText)}`,
      );
    }
    if (arm.viewImports === true) {
      await a13AssertViewImports(
        product,
        workspace,
        arm,
        [],
        "",
        context,
        "before",
      );
    }
    const entry = await a13PreviewEntry(product, workspace, arm, context);
    await expectExit(
      product,
      workspace,
      [...arm.argv],
      0,
      `${context} \`${arm.argv.join(" ")}\` — a performable move (SPEC 6.5)`,
    );

    const actual = await readSourceText(workspace, arm.receiving, context);
    const idents = a13ReadAddedIdentifiers(actual, arm, context);
    const expected = arm.compose(idents);
    for (const form of idents.length > 0 ? expected : []) {
      const verdict = deriveMdx(form);
      if (!verdict.derives) {
        fail(
          `${context}: composed with the identifiers the product bound, ` +
            `${JSON.stringify(idents)}, the expected ${arm.receiving} does ` +
            `not derive under the stock MDX 3 grammar (${verdict.reason}) — ` +
            `an added declaration binds no admissible identifier (SPEC 6.5, ` +
            `2.1, 14.20)`,
        );
      }
    }
    if (!expected.includes(actual)) {
      const deviation = a13Deviation(actual, expected, arm.added.length);
      fail(
        `${context}: ${arm.receiving} after the move — ` +
          (deviation === "" ? "" : `${deviation}; `) +
          `${arm.summary} (SPEC 6.5, 6.4, 3; H-4, normalizing nothing)\n` +
          `  actual:   ${JSON.stringify(actual)}\n` +
          expected
            .map((form) => `  expected: ${JSON.stringify(form)}`)
            .join("\n"),
      );
    }
    for (const other of arm.others) {
      await assertFileBytes(
        workspace.path(other.rel),
        other.bytes,
        `${context}: ${other.rel} after the move — ${other.reason} (SPEC 6.5, 3; H-4)`,
      );
    }
    a13AssertPreviewEdits(entry, arm, context);

    const after = await a13QueryRoot(
      product,
      workspace,
      arm.root.identity,
      context,
    );
    if (after.ownText !== arm.root.ownTextAfter) {
      fail(
        `${context}: after the move, the root ${arm.root.identity}'s own ` +
          `text is ${JSON.stringify(arm.root.ownTextAfter)} — ` +
          (arm.root.ownTextAfter === arm.root.ownTextBefore
            ? "unchanged: an added line at a line's start is dropped whole, " +
              "and a boundary line the drop rule decides as before " +
              "contributes as before"
            : "changed as 6.2's file's-end exception and its qualifier " +
              "decide: the previously unterminated paragraph line, or the " +
              "ended line whose excised embedding counts as content, kept " +
              "with the added terminator, or the remainder line kept where " +
              "the whole line was dropped") +
          ` (SPEC 6.2, 1.6, 3); \`query node\` reports ${JSON.stringify(after.ownText)}`,
      );
    }
    const changed = after.hashes.ownHash !== before.hashes.ownHash;
    if (changed !== arm.root.ownHashChanges) {
      fail(
        `${context}: the root ${arm.root.identity}'s ownHash ` +
          (arm.root.ownHashChanges
            ? "changes — the gained child reference enters its own content " +
              "at its position (SPEC 5.5, 6.2)"
            : "is unchanged — its own content sequence keeps the same runs " +
              "around the same child references by canonical identity " +
              "(SPEC 6.2, 5.5, 5.4)") +
          `; before ${before.hashes.ownHash}, after ${after.hashes.ownHash}`,
      );
    }
    if (arm.viewImports === true) {
      await a13AssertViewImports(
        product,
        workspace,
        arm,
        idents,
        actual,
        context,
        "after",
      );
    }
    await assertCleanAfterMove(product, workspace, arm.summary, context);
    if (arm.impact !== undefined) {
      await a13AssertImpact(
        product,
        workspace,
        base,
        arm.impact(idents),
        context,
      );
    }
    return actual;
  });
}

const T6_5_13 = defineProductTest({
  id: "T6.5-13",
  title:
    "admissible offsets, the line-start preference, and composition in pre-operation coordinates: byte-asserted section-move arms whose receiving file is composed whole from 6.4/6.5 and 3, value-blind in the fresh identifier alone (read from the added declaration, whose other characters are T6.5-8's), the moved text carrying `{text(X.a)}` through the origin's binding of a third module the target lacks so that exactly `import <X> from \"./x.xspec\"` is added — (a) the preference: a target holding a line-start admissible offset (the file's end after its final terminator) and a mid-line one takes the line start, the declaration appended after the final terminator; its sibling, whose only line-start admissible offset is the start of an empty line after the `</S>` line, places the declaration there with the empty line kept; (b) the self-closing target parent, its line unterminated: the tag's end the only admissible offset, the result `<S id=\"p\">`, U+000A, the moved text, U+000A, `</S>`, U+000A, the declaration, U+000A, the preview's `target-parent-rewrite` spanning the tag and `target-insertion` and `import-addition` both zero-length at the tag's end in 12.7's tie-break order; with a final terminator the same bytes, the addition at the file's end; (c) the forced mid-line case, the file's end the only admissible offset, the added terminator ending the `</S>` line; (d) a top-level `new-id` at the end of a paragraph-ended file, terminated or not: `para`, U+000A, the moved text, U+000A, the declaration, U+000A, `target-insertion` and `import-addition` both zero-length at the file's byte length; (e) a same-file move in `foo <S id=\"p\">` / `<S id=\"p.m\">x</S></S> baz`, the insertion judged over the composed text so that no terminator is added; (f) a same-file top-level move of a file's last section whose unterminated last line the deletion drops, no terminator added; (g) two declarations added to (b)'s self-closing target — after the appended closing tag, U+000A, the two declarations contiguous, each followed by U+000A alone, in an order the product fixes, byte-identical across a repeated run (H-6), the preview holding exactly two `import-addition` entries zero-length at the tag's end before the `target-insertion` there; (h) the mid-line addition off the file's end — a target ending in an unterminated `trailing` paragraph line, the end of the `</S>` line before its terminator the only admissible offset, the `</S>` line's original terminator left an empty line, kept, the root's own text going from `trailing` to U+000A, `trailing` and its ownHash with it, `impact --base` against a commit made immediately before the move reporting the target root `changed` beside `p` and the origin parent, an other-file `d={B}` dependent `upstream-changed` with the root among its attribution, the moved node carrying no category, no other node `changed`; (i) the origin deletion dropping the file's unterminated last line — the origin's own `d={\"m\"}` converting to `d={<T>.m}` through the target module's declaration added at the composed file's end with no terminator, the `import-addition` at the deletion's start or the file's byte length, the origin root `changed` by its lost child alone, its own text empty before and after; (j) the file's-end addition whose ended `</S>{text(\"p\")}` line is kept, its excised embedding counting as content — the root's own text, the embedding fully expanded, gaining a trailing U+000A beside the moved text's arrival, its ownHash with it, `impact --base` reporting (h)'s enumeration; (k) the removal-side line start — a third file `<S id=\"q\" d={A.m} />`, U+000A, `import A from \"./a.xspec\"` with no final terminator, `A.m` re-rooted to `<T>.m`, `A`'s declaration removed with its unterminated last line and the target module's declaration added at the composed file's end, the preview's `reference-rewrite` spanning `A.m`, `import-removal` spanning line 2, `import-addition` at the removal's start or the file's byte length, the third file's root keeping its own content and `q` carrying no category, the two parents `changed`; (l) the admissibility exclusion for lines that were no ESM block's — a target headed by the paragraph `// note`, `import B from \"./B.xspec\"`, `specs/B.mdx` absent and the pre-move `build` clean, `view` listing no import: offset 0 heads a block joining the paragraph's lines, deriving yet inadmissible, so the declaration is appended at the file's end, the paragraph's bytes untouched, `view` listing under `imports` the added declaration alone, the root unchanged; its indented twin, `  import B from \"./B.xspec\"` heading the file, alike — each arm's preview offsets agreeing with the real bytes, the receiving root's own text and ownHash compared through `query node` before and after (unchanged in (a), (b), (c), (e), (f), (g), (k), (l); (d)'s, (h)'s, (i)'s, and (j)'s roots `changed`), `build` and `check` clean after each move, every composed form verified to derive (S-9) (SPEC 6.5, 6.4, 6.6, 6.2, 3, 1.6, 5.5, 5.6, 11.4, 12.7; H-4, H-6)",
  run: async (product) => {
    for (const arm of A13_ARMS) {
      const bytes = await runA13Arm(product, arm);
      if (arm.repeatable === true) {
        await a13AssertRepeatable(product, arm, bytes);
      }
    }
  },
});

// ---------------------------------------------------------------------------
// T6.5-15 Joint import removals over an ESM block
// ---------------------------------------------------------------------------
//
// SPEC 6.5 (import edits): in a spec source, whose ESM block the grammar
// bounds line-sensitively (14.20), the removals in one block are judged
// together, over the block as all of them would leave it. Where they would
// leave it headed by anything but a declaration at the start of its first
// line — a JavaScript comment or an indented declaration — the remaining
// declarations would derive as paragraph text, so the block's first
// declaration stays, whether or not any other declaration would remain, its
// binding unused (2.1) and no removal reported for it (6.6), and the others
// are removed; a block they would leave with no line at all, every line
// dropped (3), is headed by nothing, its first declaration removed with the
// rest. Every arm moves `specs/o.mdx#m`, whose subtree carries every use of
// the bindings said to lose theirs, into `specs/t.mdx#m`, a target already
// binding, under the origin's identifiers, each module the moved text
// references: the moved spellings are rooted at bindings the target holds
// (6.5), so no import is added and nothing is rewritten, and both files
// compose whole from 6.5 and 3 with no latitude. The origin's compiled
// Markdown (3) is read after the move from `specs/o.md`, emission on (7.3).

const J15_ORIGIN = "specs/o.mdx";
const J15_ORIGIN_MARKDOWN = "specs/o.md";
const J15_TARGET = "specs/t.mdx";
const J15_MOVE_ARGV = ["move", "specs/o.mdx#m", "specs/t.mdx#m"] as const;

/** The module's configuration with Markdown emission on (SPEC 7.3, 13.2). */
const J15_EMIT_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  markdown: { emit: true }
})
`;

/** `import <B> from "./<B>.xspec"` — 2.1's one permitted form. */
function j15Declaration(binding: string): string {
  return `import ${binding} from "./${binding}.xspec"`;
}

const J15_A = j15Declaration("A");
const J15_B = j15Declaration("B");
const J15_C = j15Declaration("C");

/** The imported modules: `specs/A.mdx` holds the section `a`, and so on. */
const J15_MODULES: Readonly<Record<string, string>> = Object.fromEntries(
  ["A", "B", "C"].map((binding) => [
    `specs/${binding}.mdx`,
    `<S id="${binding.toLowerCase()}">\n${binding} text.\n</S>\n`,
  ]),
);

/** Lines each followed by U+000A (SPEC 3). */
function j15Join(lines: readonly string[]): string {
  return lines.map((line) => `${line}\n`).join("");
}

/** A section alone on its lines, its `d` value optional (SPEC 2.2, 1.1). */
function j15Section(id: string, d: string | undefined, text: string): string[] {
  return [`<S id="${id}"${d === undefined ? "" : ` d={${d}}`}>`, text, "</S>"];
}

/**
 * The `import-removal` edit for line `index` of the staged block: the
 * declaration's own characters plus the terminator of the line its deletion
 * leaves empty — 6.5's extent, spanned whole as 6.6 has a removal's range
 * span every byte its edit removes — in pre-operation coordinates.
 */
function j15Removal(block: readonly string[], index: number): PreviewEdit {
  const before = j15Join(block.slice(0, index));
  const through = j15Join(block.slice(0, index + 1));
  return a13Span(
    "import-removal",
    Buffer.byteLength(before, "utf8"),
    Buffer.byteLength(through, "utf8"),
  );
}

interface J15Arm {
  readonly key: string;
  /** The joint judgment's outcome over this block, for the diagnosis. */
  readonly summary: string;
  /** The origin's ESM block, line by line, as staged. */
  readonly block: readonly string[];
  /** Indices into `block` of the declarations the joint judgment removes. */
  readonly removed: readonly number[];
  /** The block as the removals leave it. */
  readonly blockAfter: readonly string[];
  /**
   * The kept block's compiled Markdown lines (SPEC 3): each declaration
   * removed by its own characters, its line dropped when left empty or
   * whitespace-only, a JavaScript comment staying as content (T3-7).
   */
  readonly compiledBlock: readonly string[];
  /** The kept section's `d` value: a use a binding keeps outside the moved subtree. */
  readonly keptUse?: string;
  /** The moved section's `d` value: every use of the bindings losing theirs. */
  readonly movedUse: string;
  /** The modules the moved text references, bound by the target under these identifiers. */
  readonly targetBindings: readonly string[];
}

const J15_ARMS: readonly J15Arm[] = [
  {
    key: "(a) own-line comment between two declarations",
    summary:
      "both bindings lose their last use; removing both would leave the " +
      "block headed by `// note`, a comment, so A's declaration stays " +
      "byte-for-byte, its binding unused, and B's alone is removed with its " +
      "line",
    block: [J15_A, "// note", J15_B],
    removed: [2],
    blockAfter: [J15_A, "// note"],
    compiledBlock: ["// note"],
    movedUse: "[A.a, B.b]",
    targetBindings: ["A", "B"],
  },
  {
    key: "(b) trailing comment on the first declaration's line",
    summary:
      "both bindings lose their last use; removing A's declaration alone " +
      "from its line would leave ` // note` heading the block, a comment, " +
      "so A's declaration stays byte-for-byte, its binding unused, and B's " +
      "alone is removed with its line",
    block: [`${J15_A} // note`, J15_B],
    removed: [1],
    blockAfter: [`${J15_A} // note`],
    compiledBlock: [" // note"],
    movedUse: "[A.a, B.b]",
    targetBindings: ["A", "B"],
  },
  {
    key: "(c) indented second declaration, its binding still used",
    summary:
      "A loses its last use while B keeps one in the kept section; removing " +
      "A's declaration would leave the block headed by the indented " +
      "`  import B …`, deriving as paragraph text, so A's declaration stays " +
      "byte-for-byte, its binding unused, and nothing is removed",
    block: [J15_A, `  ${J15_B}`],
    removed: [],
    blockAfter: [J15_A, `  ${J15_B}`],
    compiledBlock: [],
    keptUse: "B.b",
    movedUse: "A.a",
    targetBindings: ["A"],
  },
  {
    key: "(d) every declaration losing its use, no line left",
    summary:
      "both bindings lose their last use and the removals leave the block " +
      "no line at all, so it is headed by nothing: every declaration is " +
      "removed, the first included, both lines dropped with their " +
      "terminators",
    block: [J15_A, J15_B],
    removed: [0, 1],
    blockAfter: [],
    compiledBlock: [],
    movedUse: "[A.a, B.b]",
    targetBindings: ["A", "B"],
  },
  {
    key: "(e) the control: the first declaration keeps its use",
    summary:
      "A keeps its use in the kept section while B and C lose theirs: B's " +
      "and C's declarations are removed with their lines and the block is " +
      "left headed by A at its first line's start, `// note` its second " +
      "line",
    block: [J15_A, J15_B, "// note", J15_C],
    removed: [1, 3],
    blockAfter: [J15_A, "// note"],
    compiledBlock: ["// note"],
    keptUse: "A.a",
    movedUse: "[B.b, C.c]",
    targetBindings: ["B", "C"],
  },
];

interface J15Staging {
  readonly originBefore: string;
  readonly originAfter: string;
  readonly targetBefore: string;
  readonly targetAfter: string;
  /** The origin's compiled Markdown after the move (SPEC 3). */
  readonly compiled: string;
  /** The origin's `import-removal` preview edits, in 12.7's order. */
  readonly removals: readonly PreviewEdit[];
}

/**
 * Compose an arm's files whole (no latitude, H-4): the origin as staged —
 * the block, an empty line, the kept section `k`, then the moved section
 * `m`, each tag alone on its line — and as the joint judgment and the
 * deletion leave it (the moved construct's emptied line dropped with its
 * terminator, 3); the target as staged — its declarations, an empty line,
 * its own section `t` using the same bindings — and with the moved text
 * appended after its final terminator (6.5: the end of the file for a
 * top-level `new-id`, a line-start offset, so no terminator precedes it).
 */
function j15Compose(arm: J15Arm): J15Staging {
  const kept = j15Section("k", arm.keptUse, "K text.");
  const moved = j15Section("m", arm.movedUse, "M text.");
  const targetBefore = j15Join([
    ...arm.targetBindings.map((binding) => j15Declaration(binding)),
    "",
    ...j15Section("t", arm.movedUse, "T text."),
  ]);
  return {
    originBefore: j15Join([...arm.block, "", ...kept, ...moved]),
    originAfter: j15Join([...arm.blockAfter, "", ...kept]),
    targetBefore,
    targetAfter: targetBefore + j15Join(moved),
    compiled: j15Join([...arm.compiledBlock, "", "K text."]),
    removals: arm.removed.map((index) => j15Removal(arm.block, index)),
  };
}

/**
 * Every MDX text T6.5-15 stages or asserts as a move's result, for the S-9
 * self-test (test/self/s9-fixture-well-formedness.test.ts): the staged
 * pre-move files are judged by the workspace builder as they are staged and
 * the composed expectations before each move, so an expectation the stock
 * MDX 3 grammar rejects would pin a text 6.5 refuses as a move's result.
 */
export const J15_FORM_VECTORS: ReadonlyArray<
  readonly [name: string, source: string]
> = J15_ARMS.flatMap((arm) => {
  const staging = j15Compose(arm);
  return [
    [`T6.5-15 ${arm.key}: ${J15_ORIGIN} as staged`, staging.originBefore],
    [`T6.5-15 ${arm.key}: ${J15_ORIGIN} after the move`, staging.originAfter],
    [`T6.5-15 ${arm.key}: ${J15_TARGET} as staged`, staging.targetBefore],
    [`T6.5-15 ${arm.key}: ${J15_TARGET} after the move`, staging.targetAfter],
  ];
});

/** A composed expectation must derive (S-9): a staging defect, never a verdict. */
function j15AssertPremiseDerives(text: string, rel: string, arm: J15Arm): void {
  const verdict = deriveMdx(text);
  if (verdict.derives) return;
  throw new HarnessStagingError(
    "mdx-derivability",
    rel,
    `T6.5-15 ${arm.key}: the composed expectation for ${rel} does not ` +
      `derive under the stock MDX 3 grammar (${verdict.reason}) — the arm's ` +
      `premise, not a product verdict; the text reads ${JSON.stringify(text)}`,
  );
}

/**
 * The preview's `import-removal` edits for the origin — the class the entry
 * pins — with their ranges, in the preview's order (SPEC 6.6, 12.7).
 */
async function j15PreviewRemovals(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
): Promise<readonly PreviewEdit[]> {
  const label = `${context} \`${J15_MOVE_ARGV.join(" ")} --preview --json\``;
  const report = decodePreviewReport(
    await runJson(
      product,
      workspace,
      [...J15_MOVE_ARGV, "--preview", "--json"],
      label,
    ),
    label,
  );
  if (report.files === null) {
    fail(
      `${label}: a preview exiting 0 succeeds as the real operation would ` +
        `and reports its \`files\` — \`null\` is a refused preview's form ` +
        `(SPEC 6.6, 12.7); findings: ${JSON.stringify(report.findings)}`,
    );
  }
  const entry = report.files.find((candidate) => candidate.file === J15_ORIGIN);
  if (entry === undefined) {
    fail(
      `${label}: \`files\` holds an entry for ${J15_ORIGIN}, the file the ` +
        `operation deletes the section from (SPEC 6.6, 12.7); got ` +
        `[${report.files.map((candidate) => JSON.stringify(candidate.file)).join(", ")}]`,
    );
  }
  return entry.edits
    .filter((edit) => edit.class === "import-removal")
    .map((edit) => a13Span("import-removal", edit.range.start, edit.range.end));
}

/** The removals as `[start, end)` ranges, for the messages. */
function j15DescribeRemovals(removals: readonly PreviewEdit[]): string {
  if (removals.length === 0) return "none";
  return removals
    .map((edit) => `[${String(edit.range.start)}, ${String(edit.range.end)})`)
    .join(", ");
}

/** Which declarations the origin keeps or loses against the joint judgment. */
function j15Deviation(actual: string, arm: J15Arm): string {
  const notes: string[] = [];
  for (const binding of ["A", "B", "C"]) {
    const declaration = j15Declaration(binding);
    if (!arm.block.some((line) => line.includes(declaration))) continue;
    const stays = arm.blockAfter.some((line) => line.includes(declaration));
    const present = actual.includes(declaration);
    if (present && !stays) {
      notes.push(
        `${binding}'s declaration is kept where the joint judgment removes it`,
      );
    } else if (!present && stays) {
      notes.push(
        `${binding}'s declaration is removed where it stays` +
          (arm.blockAfter.indexOf(arm.block[0] ?? "") === 0 &&
          arm.block[0]?.includes(declaration) === true
            ? " (the block's first declaration, whose removal would leave " +
              "the block headed by a comment or an indented declaration)"
            : " (its binding still used)"),
      );
    }
  }
  return notes.join("; ");
}

async function runJ15Arm(product: ProductBinding, arm: J15Arm): Promise<void> {
  const context = `T6.5-15 ${arm.key}`;
  const staging = j15Compose(arm);
  j15AssertPremiseDerives(staging.originAfter, J15_ORIGIN, arm);
  j15AssertPremiseDerives(staging.targetAfter, J15_TARGET, arm);
  await withWorkspace(
    {
      "xspec.config.ts": J15_EMIT_CONFIG,
      [J15_ORIGIN]: staging.originBefore,
      [J15_TARGET]: staging.targetBefore,
      ...J15_MODULES,
    },
    async (workspace) => {
      // Premise: the staging is valid — every block well-formed, every
      // import valid and used — so a later failure is the move's.
      await buildOk(
        product,
        workspace,
        `${context} \`build\` over the staging — every ESM block ` +
          `well-formed, every import valid and used (SPEC 14.20, 2.1)`,
      );
      const removals = await j15PreviewRemovals(product, workspace, context);
      assertSameJson(
        removals,
        staging.removals,
        `${context} preview: ${J15_ORIGIN}'s \`import-removal\` edits are ` +
          `exactly ${j15DescribeRemovals(staging.removals)} — ` +
          `${arm.summary}; each removal spans the declaration plus the ` +
          `terminator of the line its deletion leaves empty, in ` +
          `pre-operation coordinates, and none is reported for a ` +
          `declaration that stays (SPEC 6.5, 6.6, 12.7, 3)`,
      );
      await expectExit(
        product,
        workspace,
        [...J15_MOVE_ARGV],
        0,
        `${context} \`${J15_MOVE_ARGV.join(" ")}\``,
      );
      const actual = await readSourceText(workspace, J15_ORIGIN, context);
      if (actual !== staging.originAfter) {
        const deviation = j15Deviation(actual, arm);
        fail(
          `${context}: ${J15_ORIGIN} after the move — ` +
            (deviation === "" ? "" : `${deviation}; `) +
            `${arm.summary}; the moved construct is deleted in place, its ` +
            `emptied line dropped with its terminator, and every other byte ` +
            `is unchanged (SPEC 6.5, 3, 2.1; H-4, normalizing nothing)\n` +
            `  actual:   ${JSON.stringify(actual)}\n` +
            `  expected: ${JSON.stringify(staging.originAfter)}`,
        );
      }
      await assertFileBytes(
        workspace.path(J15_TARGET),
        staging.targetAfter,
        `${context}: ${J15_TARGET} after the move — the moved text lands at ` +
          `the end of the file plus U+000A with no preceding terminator ` +
          `(the final line was terminated), its spellings rooted at the ` +
          `bindings the target already holds under the origin's ` +
          `identifiers, so no import is added and nothing is rewritten; ` +
          `every other byte is unchanged (SPEC 6.5, 3; H-4)`,
      );
      await assertCleanAfterMove(
        product,
        workspace,
        "every kept declaration's binding is unused yet valid (2.1) and " +
          "every moved spelling resolves through a binding the target holds",
        context,
      );
      await assertFileBytes(
        workspace.path(J15_ORIGIN_MARKDOWN),
        staging.compiled,
        `${context}: the origin's compiled Markdown after the move — each ` +
          `kept declaration removed by its own characters alone, its line ` +
          `dropped when left empty or whitespace-only, a JavaScript comment ` +
          `staying as content with its line, \`k\`'s tags removed with ` +
          `their lines (SPEC 3, 2.7; T3-7)`,
      );
    },
  );
}

const T6_5_15 = defineProductTest({
  id: "T6.5-15",
  title:
    "joint import removals over an ESM block: in a spec source the removals in one block are judged together, over the block as all of them would leave it — where they would leave it headed by a JavaScript comment or an indented declaration, the block's first declaration stays byte-for-byte, its binding unused and valid, no removal reported for it, while the others are removed with their lines; a block they would leave with no line at all loses its first declaration with the rest — byte-asserted arms each moving `specs/o.mdx#m`, whose subtree carries every use of the bindings said to lose theirs, into `specs/t.mdx#m`, a target already binding the referenced modules under the origin's identifiers (no import added, nothing rewritten): (a) `import A …`, `// note`, `import B …` on successive lines, both losing their last use — A stays, B is removed with its line, the preview reporting one `import-removal`, B's, none for A; (b) `import A … // note` above `import B …` — the same outcome; (c) `import A …` above the indented `  import B …`, A losing its last use and B keeping one in the kept section — A stays, nothing removed, no removal reported; (d) `import A …`, `import B …` both losing theirs, the removals leaving no line — every declaration removed, both lines dropped, two removals reported; (e) the control `import A …`, `import B …`, `// note`, `import C …`, A keeping its use, B and C losing theirs — B's and C's lines removed, the block left headed by A at its first line's start with `// note` its second line; the origin and the target each asserted byte-equal to expectations composed from 6.5 and 3, `check` and `build` clean after each move, and the origin's compiled Markdown asserted with the comment lines staying as content and the kept declarations removed by their own characters (SPEC 6.5, 3, 2.1, 6.6, 12.7, 14.20)",
  run: async (product) => {
    for (const arm of J15_ARMS) {
      await runJ15Arm(product, arm);
    }
  },
});

// ---------------------------------------------------------------------------
// T6.5-16 `refused-invalid-rewrite` — the finding form and arms (a)–(e)
// ---------------------------------------------------------------------------
//
// SPEC 6.5 (validation and refusals): a section-form move whose exact edits
// would leave a rewritten file other than well-formed MDX (14.20) — the
// origin as its deletion leaves it, the target as its parent rewrite and
// insertion leave it or as its creation composes it — or a file the rewrite
// must add an import to holding no admissible offset, is refused: exit 1,
// nothing modified, and exactly one `refused-invalid-rewrite` finding per
// operation however many files or shapes it covers — locating the moved
// section's construct in the origin file (1.7) plus, for each addition no
// offset admits, every reference spelling rooted at its binding by its
// occurrence span (5.7; Task 36's arms), its `identities` the
// workspace-relative paths of the files concerned in byte order, its `path`
// null (SPEC 14, 12.7). The grammar reads the edited text line-sensitively:
// a tag alone on its line is a flow-position tag, which interrupts a
// paragraph and closes no text-position tag; a U+000B or U+000C — whitespace
// under 1.4, none to the grammar — keeps the tag it adjoins in text position
// at a line's start; and an ESM block absorbs the non-blank lines after it
// (SPEC 6.2, 6.5, 14.20).
//
// Each refused arm composes the would-be text of every rewritten file from
// 6.5's exact edits — the deletion with 3's line drops; the insertion
// immediately before the target parent's closing tag or at the file's end,
// U+000A after it and one before it when the point is not at a line start;
// the self-closing parent's paired-form rewrite — and verifies in the test
// that each concerned file's would-be text does not derive and every other
// rewritten file's does (S-9's `deriveMdx`; a `HarnessStagingError` either
// way, never a verdict), so the refusal stands on the stated ground alone;
// the pre-move workspace derives (the builder's S-9 check) and builds (the
// valid-workspace precondition, 6.4). Nothing modified is the whole-root
// byte snapshot compare around the command — sources, derived files, and
// the journal, absent or byte-unchanged. The controls the entry composes
// here — (c)'s in-line section into each text-position parent (T6.5-2's
// fourth geometry stages the first parent alone), (d)'s prose remainder,
// and (e)'s block-ending empty line — are performed and byte-asserted with
// `check` and `build` clean; those it names by ID — T6.2-3(a), (b), (c),
// and (e) — are that test's stagings. The preview twins are T6.6-3's.

const R16_ORIGIN = "specs/a.mdx";
const R16_TARGET = "specs/b.mdx";
/**
 * (e)'s origin: the entry spells the target's imported module `specs/A.mdx`,
 * and `a.mdx` beside `A.mdx` would collide on a case-insensitive filesystem.
 */
const R16_E_ORIGIN = "specs/o.mdx";
const R16_E_MODULE_SOURCE = "specs/A.mdx";
/** A bystander section: the target's existing content and the origin's kept sibling. */
const R16_K = '<S id="k">z</S>\n';
// U+000B and U+000C, built from code points (never escape spellings).
const R16_VT = String.fromCodePoint(0x000b);
const R16_FF = String.fromCodePoint(0x000c);

/** One expected `locations` entry: a file and a 1.7 byte range. */
interface R16Location {
  readonly file: string;
  readonly start: number;
  readonly end: number;
}

interface R16RefusedArm {
  readonly key: string;
  /** Why the would-be text does not derive, for the diagnoses. */
  readonly summary: string;
  /** The pre-move spec files, each deriving (the builder's S-9 check). */
  readonly files: Readonly<Record<string, string>>;
  readonly argv: readonly string[];
  /** The would-be text of each file the refusal concerns: verified underivable (S-9). */
  readonly illFormed: Readonly<Record<string, string>>;
  /** The would-be text of every other rewritten file: verified to derive (S-9). */
  readonly wellFormed: Readonly<Record<string, string>>;
  /** The finding's `identities`: the concerned files' paths in byte order (SPEC 14). */
  readonly identities: readonly string[];
  /**
   * The finding's `locations` in 12.7's order: the moved section's construct
   * range in the origin file (1.7), and, for an addition no offset admits,
   * every reference spelling rooted at its binding (Task 36's arms).
   */
  readonly locations: readonly R16Location[];
  /** Every other applicable reason's code, reported beside (Task 36's applicability arms). */
  readonly beside?: readonly string[];
}

interface R16ControlArm {
  readonly key: string;
  /** What the performed move leaves, for the diagnoses. */
  readonly summary: string;
  readonly files: Readonly<Record<string, string>>;
  readonly argv: readonly string[];
  /** Every rewritten file's bytes after the move, composed from 6.5 and 3 with no latitude. */
  readonly expected: Readonly<Record<string, string>>;
}

/** The moved section's construct range (1.7): the bytes of `prefix` to its end. */
function r16Construct(
  file: string,
  prefix: string,
  construct: string,
): R16Location {
  const start = Buffer.byteLength(prefix, "utf8");
  return { file, start, end: start + Buffer.byteLength(construct, "utf8") };
}

// (a) the `body</S>` variant: `foo <S id="m">`, then a space, a tab, or
// nothing, U+000A, `body</S>`, moved to top level — at a line's start its
// opening tag is a flow-position tag, which the text-position closing tag
// cannot close (SPEC 6.2); the deletion leaves `foo `, U+000A, deriving. The
// control is T6.2-3(c)'s U+000B/U+000C remainder.
function r16ArmA(name: string, ws: string): R16RefusedArm {
  const moved = `<S id="m">${ws}\nbody</S>`;
  return {
    key: `(a) the body</S> variant, ${name} after its opening tag`,
    summary:
      `at the target's line start the opening tag \`<S id="m">\`, followed ` +
      `by ${name}, is a flow-position tag, which the text-position closing ` +
      `tag of \`body</S>\` cannot close (SPEC 6.2, 14.20)`,
    files: { [R16_ORIGIN]: `foo ${moved}\n`, [R16_TARGET]: R16_K },
    argv: ["move", "specs/a.mdx#m", "specs/b.mdx#m"],
    illFormed: { [R16_TARGET]: `${R16_K}${moved}\n` },
    wellFormed: { [R16_ORIGIN]: "foo \n" },
    identities: [R16_TARGET],
    locations: [r16Construct(R16_ORIGIN, "foo ", moved)],
  };
}

// (b) the one-sided spellings of 6.2's worked three-line shape — the
// character among the whitespace following the opening tag, the closing tag
// then alone on its line at the destination, or preceding the closing tag,
// the opening tag then alone on its line there — the tag it adjoins staying
// in text position while the other is a flow-position tag, and neither
// closes the other (SPEC 6.2); at the origin the closing tag is followed by
// ` bar`, and the deletion leaves `foo  bar`, U+000A, deriving. The
// both-sided and none-sided spellings are the movable controls T6.2-3(b)
// and (a).
function r16ArmB(
  side: "opening" | "closing",
  name: string,
  ws: string,
): R16RefusedArm {
  const moved =
    side === "opening"
      ? `<S id="m">${ws}\nbody\n</S>`
      : `<S id="m">\nbody\n${ws}</S>`;
  return {
    key: `(b) the worked shape with ${name} ${side === "opening" ? "following its opening tag" : "preceding its closing tag"}`,
    summary:
      side === "opening"
        ? `the ${name} following the opening tag keeps it in text position ` +
          `at the target's line start while the closing tag, alone on its ` +
          `line, is a flow-position tag that closes no text-position tag ` +
          `(SPEC 6.2, 14.20)`
        : `the opening tag alone on its line at the target is a flow-position ` +
          `tag while the ${name} preceding the closing tag keeps that tag in ` +
          `text position, closing no flow-position tag (SPEC 6.2, 14.20)`,
    files: { [R16_ORIGIN]: `foo ${moved} bar\n`, [R16_TARGET]: R16_K },
    argv: ["move", "specs/a.mdx#m", "specs/b.mdx#m"],
    illFormed: { [R16_TARGET]: `${R16_K}${moved}\n` },
    wellFormed: { [R16_ORIGIN]: "foo  bar\n" },
    identities: [R16_TARGET],
    locations: [r16Construct(R16_ORIGIN, "foo ", moved)],
  };
}

// (c) a section opening a flow-position tag — its tags alone on their
// lines; a self-closing tag; a single-line section whose line holds nothing
// outside its tags and expression containers, a flow line whose tags are
// flow-position tags (14.20; T3-3's constraint) — moved into a parent whose
// tags stand in text position: the moved text lands alone on its line, a
// flow line interrupting the paragraph that holds the parent's opening tag,
// which then closes nothing (SPEC 6.5, 6.2). The control is a single-line
// in-line section holding prose outside its tags, whose line is a paragraph
// continuation there (T6.5-2's fourth geometry).
interface R16MovedShape {
  readonly name: string;
  /** The construct as staged in the origin, alone on its line after `R16_K`. */
  readonly origin: string;
  /** The construct re-identified under `p.n` (prefix replacement). */
  readonly moved: string;
}

const R16_C_SHAPES: readonly R16MovedShape[] = [
  {
    name: "a flow-position section",
    origin: '<S id="m">\nx\n</S>',
    moved: '<S id="p.n">\nx\n</S>',
  },
  {
    name: "a self-closing section",
    origin: '<S id="m" />',
    moved: '<S id="p.n" />',
  },
  {
    name: "a single-line section holding nothing outside its tags",
    origin: '<S id="m"><S id="m.q" /></S>',
    moved: '<S id="p.n"><S id="p.n.q" /></S>',
  },
];

const R16_C_CONTROL_SHAPE: R16MovedShape = {
  name: 'the in-line section `<S id="m">x</S>`',
  origin: '<S id="m">x</S>',
  moved: '<S id="p.n">x</S>',
};

interface R16Parent {
  readonly name: string;
  /** The staged target file. */
  readonly source: string;
  /** How 6.5's edits leave the target around the moved text. */
  readonly compose: (moved: string) => string;
}

const R16_C_PARENTS: readonly R16Parent[] = [
  {
    // The insertion point, before `</S>` after `bar`, is not at a line
    // start: U+000A before the moved text and after it.
    name: 'the text-position parent `foo <S id="p">bar</S> baz`',
    source: 'foo <S id="p">bar</S> baz\n',
    compose: (moved) => `foo <S id="p">bar\n${moved}\n</S> baz\n`,
  },
  {
    // The closing tag on a later line: the insertion point, at that line's
    // start, takes no terminator before the moved text.
    name: "the text-position parent with its closing tag on a later line",
    source: 'foo <S id="p">bar\n</S> baz\n',
    compose: (moved) => `foo <S id="p">bar\n${moved}\n</S> baz\n`,
  },
  {
    // The self-closing parent is first rewritten to the paired form — its
    // `/` and the whitespace before it deleted, `</S>` appended after `>` —
    // and the insertion before that closing tag is not at a line start.
    name: "the self-closing parent after its paired-form rewrite",
    source: 'foo <S id="p" /> baz\n',
    compose: (moved) => `foo <S id="p">\n${moved}\n</S> baz\n`,
  },
];

function r16ArmC(shape: R16MovedShape, parent: R16Parent): R16RefusedArm {
  return {
    key: `(c) ${shape.name} into ${parent.name}`,
    summary:
      `the moved text stands alone on its line inside the parent, a flow ` +
      `line whose tags are flow-position tags interrupting the paragraph ` +
      `that holds the parent's text-position opening tag, which then closes ` +
      `nothing (SPEC 6.5, 6.2, 14.20; T3-3's constraint)`,
    files: {
      [R16_ORIGIN]: `${R16_K}${shape.origin}\n`,
      [R16_TARGET]: parent.source,
    },
    argv: ["move", "specs/a.mdx#m", "specs/b.mdx#p.n"],
    illFormed: { [R16_TARGET]: parent.compose(shape.moved) },
    wellFormed: { [R16_ORIGIN]: R16_K },
    identities: [R16_TARGET],
    locations: [r16Construct(R16_ORIGIN, R16_K, shape.origin)],
  };
}

function r16ControlC(parent: R16Parent): R16ControlArm {
  return {
    key: `(c) control: ${R16_C_CONTROL_SHAPE.name} into ${parent.name}`,
    summary:
      `the in-line section's line is a paragraph continuation inside the ` +
      `parent — the prose outside its tags denies the flow attempt — so the ` +
      `composed target derives and the move is performed, the origin's ` +
      `emptied line dropped with its terminator (SPEC 6.5, 3, 14.20)`,
    files: {
      [R16_ORIGIN]: `${R16_K}${R16_C_CONTROL_SHAPE.origin}\n`,
      [R16_TARGET]: parent.source,
    },
    argv: ["move", "specs/a.mdx#m", "specs/b.mdx#p.n"],
    expected: {
      [R16_ORIGIN]: R16_K,
      [R16_TARGET]: parent.compose(R16_C_CONTROL_SHAPE.moved),
    },
  };
}

// (d) a deletion leaving what followed the construct on its line at the
// line's start, inside the text-position parent `foo <S id="p">bar`,
// U+000A, the line, U+000A, `</S> baz`: each pre-move file derives (its
// second line a paragraph continuation, the bytes after the construct
// text), and each deletion leaves a list marker, a setext underline, a
// flow-position tag, or a flow-position expression interrupting the
// paragraph that holds the parent's opening tag; and, one arm more, the
// parent's own closing tag as the remainder, left alone on its line — a
// flow-position tag closing no text-position tag (SPEC 6.5, 6.2). The moved
// section `p.m` lands at the top level of a clean target, its line a
// paragraph line, deriving.
const R16_D_MOVED = '<S id="p.m">x</S>';
const R16_D_PREFIX = 'foo <S id="p">bar\n';
const R16_D_TARGET_AFTER = `${R16_K}<S id="m">x</S>\n`;

function r16ArmD(name: string, remainder: string): R16RefusedArm {
  return {
    key: `(d) the deletion leaving ${name} at its line's start`,
    summary:
      `deleting the construct leaves ${JSON.stringify(remainder)} at its ` +
      `line's start, ${name} interrupting the paragraph that holds the ` +
      `parent's text-position opening tag, which then closes nothing ` +
      `(SPEC 6.5, 6.2, 14.20)`,
    files: {
      [R16_ORIGIN]: `${R16_D_PREFIX}${R16_D_MOVED}${remainder}\n</S> baz\n`,
      [R16_TARGET]: R16_K,
    },
    argv: ["move", "specs/a.mdx#p.m", "specs/b.mdx#m"],
    illFormed: { [R16_ORIGIN]: `${R16_D_PREFIX}${remainder}\n</S> baz\n` },
    wellFormed: { [R16_TARGET]: R16_D_TARGET_AFTER },
    identities: [R16_ORIGIN],
    locations: [r16Construct(R16_ORIGIN, R16_D_PREFIX, R16_D_MOVED)],
  };
}

const R16_D_CLOSING_ARM: R16RefusedArm = {
  key: "(d) the deletion leaving the parent's own closing tag alone on its line",
  summary:
    "deleting the construct leaves `</S>` alone on its line, a " +
    "flow-position tag closing no text-position tag, the paragraph holding " +
    "the parent's opening tag interrupted (SPEC 6.5, 6.2, 14.20)",
  files: {
    [R16_ORIGIN]: `${R16_D_PREFIX}${R16_D_MOVED}</S>\n`,
    [R16_TARGET]: R16_K,
  },
  argv: ["move", "specs/a.mdx#p.m", "specs/b.mdx#m"],
  illFormed: { [R16_ORIGIN]: `${R16_D_PREFIX}</S>\n` },
  wellFormed: { [R16_TARGET]: R16_D_TARGET_AFTER },
  identities: [R16_ORIGIN],
  locations: [r16Construct(R16_ORIGIN, R16_D_PREFIX, R16_D_MOVED)],
};

const R16_D_CONTROL: R16ControlArm = {
  key: "(d) control: plain prose after the construct",
  summary:
    "the deletion leaves ` more` a paragraph-continuation line — the line " +
    "keeps content, so 3 drops nothing — and the moved section's line is a " +
    "paragraph line at the target's end (SPEC 6.5, 3, 14.20)",
  files: {
    [R16_ORIGIN]: `${R16_D_PREFIX}${R16_D_MOVED} more\n</S> baz\n`,
    [R16_TARGET]: R16_K,
  },
  argv: ["move", "specs/a.mdx#p.m", "specs/b.mdx#m"],
  expected: {
    [R16_ORIGIN]: `${R16_D_PREFIX} more\n</S> baz\n`,
    [R16_TARGET]: R16_D_TARGET_AFTER,
  },
};

// The insertion-side counterpart: a target `foo <S id="p">`, U+000A,
// `<S id="p.s"> </S></S> tail`, U+000A — deriving, its second line a
// paragraph continuation — receives `<S id="m">text</S>`, alone on its
// origin line, into `p.n`; the insertion, preceded on its line by `p.s`'s
// closing tag, splits the line with an added terminator (6.5), leaving
// `<S id="p.s"> </S>` alone on its line — a flow line, its tags
// flow-position tags closing no text-position tag and interrupting the
// paragraph that holds `p`'s opening tag. The control is T6.2-3(e), the
// U+000C spelling of that line, kept in text position and performed.
const R16_D_INSERTION_MOVED = '<S id="m">text</S>';
const R16_D_INSERTION_ARM: R16RefusedArm = {
  key: "(d) the insertion leaving a sibling's tags alone on their line",
  summary:
    "the insertion, preceded on its line by `p.s`'s closing tag, splits " +
    'the line with an added terminator, leaving `<S id="p.s"> </S>` ' +
    "alone on its line — a flow line whose tags close no text-position " +
    "tag and interrupt the paragraph holding `p`'s opening tag (SPEC 6.5, " +
    "6.2, 14.20)",
  files: {
    [R16_ORIGIN]: `${R16_K}${R16_D_INSERTION_MOVED}\n`,
    [R16_TARGET]: 'foo <S id="p">\n<S id="p.s"> </S></S> tail\n',
  },
  argv: ["move", "specs/a.mdx#m", "specs/b.mdx#p.n"],
  illFormed: {
    [R16_TARGET]:
      'foo <S id="p">\n<S id="p.s"> </S>\n<S id="p.n">text</S>\n</S> tail\n',
  },
  wellFormed: { [R16_ORIGIN]: R16_K },
  identities: [R16_TARGET],
  locations: [r16Construct(R16_ORIGIN, R16_K, R16_D_INSERTION_MOVED)],
};

// (e) a top-level `new-id` insertion at the end of a file whose last line
// belongs to an ESM block — a target holding only `import A from
// "./A.xspec"` (`specs/A.mdx` discovered, the binding unused, 2.1),
// terminated and unterminated — is absorbed into the block (the
// unterminated variant's insertion point, not at a line start, takes an
// added terminator first: the same composed text). The control: the same
// declaration followed by U+000A, U+000A — the empty line ending the
// block — receives the moved text at its end, a line start, none added.
const R16_E_DECLARATION = 'import A from "./A.xspec"';
const R16_E_MOVED = '<S id="m">\nx\n</S>';
const R16_E_ORIGIN_BEFORE = `${R16_K}${R16_E_MOVED}\n`;
const R16_E_MODULE = '<S id="q">Q text.</S>\n';
const R16_E_ARGV = ["move", "specs/o.mdx#m", "specs/b.mdx#m"] as const;

function r16ArmE(name: string, target: string): R16RefusedArm {
  return {
    key: `(e) the insertion after a block's last line, the target ${name}`,
    summary:
      `the moved text, inserted at the end of a file whose last line is an ` +
      `ESM block's, is absorbed into the block, which runs to the next ` +
      `blank line or the file's end (SPEC 6.5, 14.20)`,
    files: {
      [R16_E_ORIGIN]: R16_E_ORIGIN_BEFORE,
      [R16_TARGET]: target,
      [R16_E_MODULE_SOURCE]: R16_E_MODULE,
    },
    argv: [...R16_E_ARGV],
    illFormed: { [R16_TARGET]: `${R16_E_DECLARATION}\n${R16_E_MOVED}\n` },
    wellFormed: { [R16_E_ORIGIN]: R16_K },
    identities: [R16_TARGET],
    locations: [r16Construct(R16_E_ORIGIN, R16_K, R16_E_MOVED)],
  };
}

const R16_E_CONTROL: R16ControlArm = {
  key: "(e) control: the empty line ending the block",
  summary:
    "the target's empty line ends its ESM block, so the moved text and " +
    "U+000A are appended after that line's terminator — a line start, no " +
    "terminator added — and the declaration's binding stays unused and " +
    "valid (SPEC 6.5, 2.1, 14.20)",
  files: {
    [R16_E_ORIGIN]: R16_E_ORIGIN_BEFORE,
    [R16_TARGET]: `${R16_E_DECLARATION}\n\n`,
    [R16_E_MODULE_SOURCE]: R16_E_MODULE,
  },
  argv: [...R16_E_ARGV],
  expected: {
    [R16_E_ORIGIN]: R16_K,
    [R16_TARGET]: `${R16_E_DECLARATION}\n\n${R16_E_MOVED}\n`,
  },
};

const R16_REFUSED_ARMS: readonly R16RefusedArm[] = [
  r16ArmA("a space", " "),
  r16ArmA("a tab", "\t"),
  r16ArmA("nothing", ""),
  r16ArmB("opening", "U+000C", R16_FF),
  r16ArmB("closing", "U+000C", R16_FF),
  r16ArmB("opening", "U+000B", R16_VT),
  r16ArmB("closing", "U+000B", R16_VT),
  ...R16_C_SHAPES.flatMap((shape) =>
    R16_C_PARENTS.map((parent) => r16ArmC(shape, parent)),
  ),
  r16ArmD("a list marker", "- item"),
  r16ArmD("a setext underline", "==="),
  r16ArmD("a flow-position tag", '<S id="p.q" />'),
  r16ArmD("a flow-position expression", "{/* c */}"),
  R16_D_CLOSING_ARM,
  R16_D_INSERTION_ARM,
  r16ArmE("terminated", `${R16_E_DECLARATION}\n`),
  r16ArmE("unterminated", R16_E_DECLARATION),
];

const R16_CONTROL_ARMS: readonly R16ControlArm[] = [
  ...R16_C_PARENTS.map((parent) => r16ControlC(parent)),
  R16_D_CONTROL,
  R16_E_CONTROL,
];

/**
 * Every MDX text T6.5-16 stages, or asserts as a move's result or as the
 * deriving side of a refused rewrite, for the S-9 self-test
 * (test/self/s9-fixture-well-formedness.test.ts): a staged file the stock
 * MDX 3 grammar rejects would fail the valid-workspace precondition, and a
 * control's expectation it rejects would pin a text 6.5 refuses.
 */
export const R16_FORM_VECTORS: ReadonlyArray<
  readonly [name: string, source: string]
> = [
  ...R16_REFUSED_ARMS.flatMap((arm) => [
    ...Object.entries(arm.files).map(
      ([rel, text]) => [`T6.5-16 ${arm.key}: ${rel} as staged`, text] as const,
    ),
    ...Object.entries(arm.wellFormed).map(
      ([rel, text]) =>
        [
          `T6.5-16 ${arm.key}: ${rel} as the edits would leave it`,
          text,
        ] as const,
    ),
  ]),
  ...R16_CONTROL_ARMS.flatMap((arm) => [
    ...Object.entries(arm.files).map(
      ([rel, text]) => [`T6.5-16 ${arm.key}: ${rel} as staged`, text] as const,
    ),
    ...Object.entries(arm.expected).map(
      ([rel, text]) =>
        [`T6.5-16 ${arm.key}: ${rel} after the move`, text] as const,
    ),
  ]),
];

/**
 * Every would-be text T6.5-16 refuses, for the S-9 self-test: each is the
 * concerned file as 6.5's exact edits would leave it, which must not derive
 * — the ground of the refusal.
 */
export const R16_REFUSED_VECTORS: ReadonlyArray<
  readonly [name: string, source: string]
> = R16_REFUSED_ARMS.flatMap((arm) =>
  Object.entries(arm.illFormed).map(
    ([rel, text]) =>
      [`T6.5-16 ${arm.key}: ${rel} as the edits would leave it`, text] as const,
  ),
);

/** A would-be text the entry declares underivable must not derive (S-9): a staging defect, never a verdict. */
function r16AssertUnderivable(text: string, rel: string, key: string): void {
  if (!deriveMdx(text).derives) return;
  throw new HarnessStagingError(
    "mdx-derivability",
    rel,
    `T6.5-16 ${key}: the would-be text of ${rel} derives under the stock ` +
      `MDX 3 grammar, so it is no ground for refused-invalid-rewrite — the ` +
      `arm's premise, not a product verdict; the text reads ${JSON.stringify(text)}`,
  );
}

/** A composed text the entry declares deriving must derive (S-9): a staging defect, never a verdict. */
function r16AssertDerives(text: string, rel: string, key: string): void {
  const verdict = deriveMdx(text);
  if (verdict.derives) return;
  throw new HarnessStagingError(
    "mdx-derivability",
    rel,
    `T6.5-16 ${key}: the composed text for ${rel} does not derive under ` +
      `the stock MDX 3 grammar (${verdict.reason}) — the arm's premise, not ` +
      `a product verdict; the text reads ${JSON.stringify(text)}`,
  );
}

function r16RenderLocations(locations: readonly R16Location[]): string {
  return locations
    .map(
      ({ file, start, end }) =>
        `${JSON.stringify(file)} [${String(start)}, ${String(end)})`,
    )
    .join("; ");
}

/**
 * The refusal's report: exactly one finding per applicable reason —
 * `refused-invalid-rewrite` and the arm's `beside` reasons, none further —
 * the `refused-invalid-rewrite` finding's `locations` exactly the arm's in
 * 12.7's order, its `identities` exactly the concerned paths in byte
 * order, its `path` null (SPEC 14, 12.7, 1.7).
 */
function r16AssertFinding(
  findings: readonly Finding[],
  arm: R16RefusedArm,
  context: string,
): void {
  const expectedCodes = ["refused-invalid-rewrite", ...(arm.beside ?? [])];
  const actualCodes = findings.map(
    (finding) => finding.condition ?? finding.code ?? "(code-less)",
  );
  const sameCodes =
    actualCodes.length === expectedCodes.length &&
    [...expectedCodes]
      .sort()
      .every((code, index) => [...actualCodes].sort()[index] === code);
  if (!sameCodes) {
    fail(
      `${context}: the report holds exactly one finding per applicable ` +
        `reason — ${JSON.stringify(expectedCodes)}, \`refused-invalid-rewrite\` ` +
        `once per operation however many files or shapes it covers, and no ` +
        `reason beside — ${arm.summary} (SPEC 6.5, 14, 12.7); got ` +
        `${JSON.stringify(actualCodes)}`,
    );
  }
  const finding = findings.find(
    (candidate) => candidate.code === "refused-invalid-rewrite",
  )!;
  const actualRendered = finding.locations
    .map(
      (location) =>
        `${renderPathValue(location.file)} [${String(location.range.start)}, ` +
        `${String(location.range.end)})`,
    )
    .join("; ");
  const exact =
    finding.locations.length === arm.locations.length &&
    arm.locations.every((expected, index) => {
      const location = finding.locations[index]!;
      return (
        location.file === expected.file &&
        location.range.start === expected.start &&
        location.range.end === expected.end
      );
    });
  if (!exact) {
    fail(
      `${context}: the finding's \`locations\` are exactly ` +
        `[${r16RenderLocations(arm.locations)}] — the moved section's ` +
        `construct range in the origin file, in pre-operation coordinates` +
        (arm.locations.length > 1
          ? `, then every reference spelling rooted at an addition no offset ` +
            `admits, by its occurrence span, in 12.7's order`
          : "") +
        ` (SPEC 14, 1.7, 5.7, 12.7); got [${actualRendered}] ` +
        `(message: ${JSON.stringify(finding.message)})`,
    );
  }
  assertFindingIdentities(
    finding,
    arm.identities,
    `${context}: the finding's \`identities\` — the workspace-relative ` +
      `paths of the files concerned, each whose would-be text is not ` +
      `well-formed MDX or which holds no admissible offset for an addition ` +
      `it needs, in byte order (SPEC 14, 12.7)`,
  );
  if (finding.path !== null) {
    fail(
      `${context}: the finding's \`path\` is null — a refusal locating in ` +
        `source concerns no path (SPEC 14, 12.7); got ` +
        `${renderPathValue(finding.path)} (message: ` +
        `${JSON.stringify(finding.message)})`,
    );
  }
}

async function runR16RefusedArm(
  product: ProductBinding,
  arm: R16RefusedArm,
): Promise<void> {
  const context = `T6.5-16 ${arm.key}`;
  for (const [rel, text] of Object.entries(arm.illFormed)) {
    r16AssertUnderivable(text, rel, arm.key);
  }
  for (const [rel, text] of Object.entries(arm.wellFormed)) {
    r16AssertDerives(text, rel, arm.key);
  }
  const command = arm.argv.join(" ");
  await withWorkspace(arm.files, async (workspace) => {
    // Premise: the pre-move workspace is valid (6.4's precondition), every
    // staged file well-formed, so the refusal is the rewrite's alone; the
    // build also lays down the derived files the compare below covers.
    await buildOk(
      product,
      workspace,
      `${context} \`build\` over the staging — the pre-move workspace is ` +
        `valid, every staged file well-formed (SPEC 6.4, 6.5, 14.20)`,
    );
    await assertLeavesUnchanged(
      workspace.root,
      async () => {
        const findings = await runFindingsReport(
          product,
          workspace,
          [...arm.argv, "--json"],
          1,
          `${context} \`${command} --json\` — refused: ${arm.summary}; ` +
            `exit 1 with the form-exact 12.7 findings-only report ` +
            `(SPEC 6.5, 14, 12.0, 12.7)`,
        );
        r16AssertFinding(findings, arm, context);
      },
      `${context}: \`${command}\` refused — modifies nothing: every source ` +
        `and derived file byte-identical, the journal absent or ` +
        `byte-unchanged (SPEC 6.5, 14)`,
    );
  });
}

async function runR16ControlArm(
  product: ProductBinding,
  arm: R16ControlArm,
): Promise<void> {
  const context = `T6.5-16 ${arm.key}`;
  for (const [rel, text] of Object.entries(arm.expected)) {
    r16AssertDerives(text, rel, arm.key);
  }
  const command = arm.argv.join(" ");
  await withWorkspace(arm.files, async (workspace) => {
    await buildOk(
      product,
      workspace,
      `${context} \`build\` over the staging — the pre-move workspace is ` +
        `valid, every staged file well-formed (SPEC 6.4, 6.5, 14.20)`,
    );
    await expectExit(
      product,
      workspace,
      [...arm.argv],
      0,
      `${context} \`${command}\` — the movable control is performed: ` +
        `${arm.summary}`,
    );
    for (const [rel, text] of Object.entries(arm.expected)) {
      await assertFileBytes(
        workspace.path(rel),
        text,
        `${context}: ${rel} after the move — ${arm.summary}; composed from ` +
          `6.5's exact edits and 3's line drops with no latitude, every ` +
          `other byte unchanged (SPEC 6.5, 3; H-4)`,
      );
    }
    await assertCleanAfterMove(
      product,
      workspace,
      "the performed control leaves a valid workspace",
      context,
    );
  });
}

const T6_5_16 = defineProductTest({
  id: "T6.5-16",
  title:
    "refused-invalid-rewrite: a section-form move whose exact edits would leave a rewritten file other than well-formed MDX — the origin as its deletion leaves it, the target as its parent rewrite and insertion leave it — is refused: exit 1, nothing modified (the workspace byte-compared, the journal absent or byte-unchanged), exactly one `refused-invalid-rewrite` finding per operation locating the moved section's construct range in the origin file, its `identities` the concerned files' workspace-relative paths in byte order, its `path` null; each arm's would-be text verified underivable and every other rewritten file's verified to derive (S-9) from a valid pre-move workspace: (a) the `body</S>` variant — `foo <S id=\"m\">`, then a space, a tab, or nothing, U+000A, `body</S>` — moved to top level; (b) the one-sided U+000C and U+000B spellings of 6.2's worked three-line shape, the character following the opening tag or preceding the closing tag; (c) a flow-position section, a self-closing section, and a single-line section holding nothing outside its tags, each moved into `foo <S id=\"p\">bar</S> baz`, into the parent with its closing tag on a later line, and into the self-closing parent after its paired-form rewrite; (d) a deletion leaving a list marker, a setext underline, a flow-position tag, a flow-position expression, or the parent's own closing tag at its line's start inside a text-position parent, and the insertion-side counterpart leaving `<S id=\"p.s\"> </S>` alone on its line; (e) a top-level insertion at the end of a file whose last line is an ESM block's, terminated and unterminated; with the movable controls performed and byte-asserted, `check` and `build` clean — the in-line section `<S id=\"m\">x</S>` into each of (c)'s parents, (d)'s plain-prose remainder ` more` kept as a paragraph-continuation line, and (e)'s declaration followed by the empty line ending its block, the moved text appended after it (SPEC 6.5, 6.2, 3, 2.1, 1.7, 14, 12.7, 14.20)",
  run: async (product) => {
    for (const arm of R16_REFUSED_ARMS) {
      await runR16RefusedArm(product, arm);
    }
    for (const arm of R16_CONTROL_ARMS) {
      await runR16ControlArm(product, arm);
    }
  },
});

/** TEST-SPEC §6.5, third part, in canonical ID order (SUITE-25). */
export const section65iiiTests: readonly ProductTestEntry[] = [
  T6_5_12,
  T6_5_13,
  T6_5_14,
  T6_5_15,
  T6_5_16,
];
