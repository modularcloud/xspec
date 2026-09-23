// TEST-SPEC §6.5 (move), third part — SUITE-25 (continued): T6.5-12, the
// target file's own references to moved nodes, and T6.5-14, a created target
// file's fixed content. T6.5-1…T6.5-10 are section-6.5.ts's business and
// T6.5-11 section-6.5-ii.ts's; this module keeps both files' edits bounded
// (the section-10.7-i/-ii precedent).
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

import { Buffer } from "node:buffer";
import type {
  ChangeCategory,
  GraphEdge,
  ImpactReport,
} from "../../helpers/adapters/index.js";
import {
  decodeEdgesReport,
  decodeImpactReport,
} from "../../helpers/adapters/index.js";
import { assertFileBytes, fail } from "../../helpers/assertions.js";
import { canonicalSpecifier } from "../../helpers/import-insertion.js";
import { deriveMdx } from "../../helpers/mdx-derivability.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import {
  assertEdgeSetEqual,
  assertSameJson,
  buildOk,
  expectExit,
  expectFindingFreeReport,
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

/** TEST-SPEC §6.5, third part, in canonical ID order (SUITE-25). */
export const section65iiiTests: readonly ProductTestEntry[] = [
  T6_5_12,
  T6_5_14,
];
