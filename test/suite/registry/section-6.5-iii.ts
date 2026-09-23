// TEST-SPEC §6.5 (move), third part — SUITE-25 (continued): T6.5-12, the
// target file's own references to moved nodes, T6.5-13, admissible offsets
// and composition in pre-operation coordinates, T6.5-14, a created target
// file's fixed content, T6.5-15, joint import removals over an ESM block,
// T6.5-16, `refused-invalid-rewrite`, T6.5-17, `refused-moved-import`,
// T6.5-18, the shadow-aware binding choice, and T6.5-19, the in-section
// exclusion.
// T6.5-1…T6.5-10 are section-6.5.ts's business and T6.5-11
// section-6.5-ii.ts's; this module keeps both files' edits bounded (the
// section-10.7-i/-ii precedent).
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
// - T6.5-18 stages the origin with a kept sibling `w` after the moved `x`
//   (the entry leaves the rest of the file open), so the origin stays a
//   non-empty file and its post-move bytes are composed whole from 6.5 and
//   3; `src/c.ts` is composed value-blind in the fresh identifier alone,
//   read off the rewritten marker, and the added declaration isolated by
//   diff (T6.5-8's discipline, `assertAddedImportInsertion`); the preview
//   is taken before the real move and its `src/c.ts` edits asserted once
//   the real addition's offset is known, mapped back to pre-operation
//   coordinates — the removal's start and its end both admitted where the
//   addition composes to the file's start (T6.6-4(b)'s latitude); the
//   compile-clean premise and observation ride the TypeScript tooling
//   driver (H-2) as T6.5-9's do.
// - T6.5-19 rides T6.5-13's arm runner (`runA13Arm`, its diagnoses under
//   the caller's test ID): (a) is a cross-file arm over T6.5-13's shared
//   origin and third module (the origin keeps a second use of `X`, so
//   its expectation is the deletion's alone), (b) stages T6.5-13(i)'s
//   existing target `<S id="k">z</S>`, U+000A, the moved `m` appended
//   after its final terminator; the entry's named offsets are probed
//   under `deriveMdx` over the receiving file as the other edits leave
//   it, the declaration inserted per 6.5's terminator rule
//   (`r16Declared`), as staging premises.

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
import {
  assertAddedImportInsertion,
  canonicalSpecifier,
} from "../../helpers/import-insertion.js";
import { deriveMdx } from "../../helpers/mdx-derivability.js";
import { HarnessStagingError } from "../../helpers/permissions.js";
import { defineProductTest } from "../../helpers/registry.js";
import { assertLeavesUnchanged } from "../../helpers/snapshot.js";
import {
  ConsumerProject,
  assertNoCompileErrors,
} from "../../helpers/tooling.js";
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

/**
 * The configuration every arm of this module is staged under
 * (`withWorkspace`'s default, T6.5-13's arms included) — exported for
 * T6.6-3's preview twins, which stage T6.5-16's and T6.5-17's arms byte for
 * byte (TEST-SPEC T6.6-3: "staged identically"), and for T6.6-4's tie-break
 * stagings, T6.5-13's (b), (d), and (g) restaged likewise
 * (`A13_TIE_BREAK_ARMS`).
 */
export const R16_CONFIG = CONFIG;

// One spec group plus one code group (SPEC 7.1), for T6.5-18's code file.
const SPEC_AND_CODE_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: {
    app: ["src/**/*.ts"]
  }
})
`;

/** The compiler-provided names a spec source's added import may not bind (SPEC 2.1). */
const MDX_RESERVED_NAMES: readonly string[] = ["S", "Spec", "text"];

/** Stage a fresh workspace (`config` plus `files`), run `body`, dispose (H-1). */
async function withWorkspace<T>(
  files: Readonly<Record<string, string>>,
  body: (workspace: TestWorkspace) => Promise<T>,
  config: string = CONFIG,
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
  kind: "depends" | "embeds" | "references",
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
export interface A13Other {
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

// ---------------------------------------------------------------------------
// T6.6-4(e)'s tie-break stagings — the T6.5-13 entries TEST-SPEC T6.6-4
// names for the 12.7 comparator's final tie-break, exported so that
// section-6.6.ts restages them byte for byte (the contracts above unchanged).
// ---------------------------------------------------------------------------

/** An embedding of the moved text whose root binding the rewrite may change (SPEC 6.5). */
export interface A13Embedding {
  /** The occurrence's whole `{text(...)}` container as staged (SPEC 5.7). */
  readonly container: string;
  /** The origin's binding the chain is rooted at. */
  readonly binding: string;
}

/**
 * One of T6.6-4(e)'s pinned tie-break stagings: (b), the self-closing
 * target parent (`import-addition` and `target-insertion` both zero-length
 * at the tag's end); (d), both variants (the same cross-class coincidence
 * at the end of a paragraph-ended file); and (g), the same-class
 * coincidence (two `import-addition` entries at one offset, their count the
 * observation). Beside the T6.5-13 arm's staging and contracts it carries
 * what T6.6-4 needs to compose the origin entry of the preview's plan
 * (SPEC 6.6): the origin's path, the moved construct's spelling as staged,
 * its `id` attribute, and the moved text's embeddings — in `added`'s
 * order, the i-th rooted at the origin's binding of the i-th added module,
 * so the i-th fresh identifier decides whether its spelling changes.
 */
export interface A13TieBreakArm {
  readonly key: string;
  readonly summary: string;
  readonly files: Readonly<Record<string, string>>;
  readonly argv: readonly string[];
  readonly receiving: string;
  readonly added: readonly string[];
  readonly compose: (idents: readonly string[]) => readonly string[];
  readonly others: readonly A13Other[];
  /** The receiving file's one admissible edit list, in 12.7's order. */
  readonly receivingEdits: readonly PreviewEdit[];
  /** The origin file — the move's first operand's path. */
  readonly origin: string;
  /** The moved construct exactly as the origin stages it. */
  readonly movedConstruct: string;
  /** The moved section's `id` attribute, e.g. `id="m"`. */
  readonly movedIdAttribute: string;
  readonly embeddings: readonly A13Embedding[];
}

/**
 * The T6.5-13 arm `key` names, joined with the origin geometry T6.6-4
 * composes from; a mismatch is a defect of this table, never a product
 * verdict, so it throws a plain error.
 */
function a13TieBreakArm(
  key: string,
  movedLines: readonly string[],
  embeddings: readonly A13Embedding[],
): A13TieBreakArm {
  const arm = A13_ARMS.find((candidate) => candidate.key === key);
  if (arm === undefined) {
    throw new Error(`A13_TIE_BREAK_ARMS: no T6.5-13 arm is keyed ${key}`);
  }
  const [receivingEdits, ...more] = arm.previewEdits;
  if (receivingEdits === undefined || more.length > 0) {
    throw new Error(
      `A13_TIE_BREAK_ARMS ${key}: a tie-break arm pins exactly one ` +
        `admissible edit list for its receiving file (TEST-SPEC T6.6-4)`,
    );
  }
  const operand = arm.argv[1] ?? "";
  const hash = operand.indexOf("#");
  const origin = operand.slice(0, hash);
  const movedConstruct = movedLines.join("\n");
  if (hash === -1 || !(arm.files[origin] ?? "").includes(movedConstruct)) {
    throw new Error(
      `A13_TIE_BREAK_ARMS ${key}: the origin ${origin} must stage the moved ` +
        `construct ${JSON.stringify(movedConstruct)}`,
    );
  }
  if (embeddings.length !== arm.added.length) {
    throw new Error(
      `A13_TIE_BREAK_ARMS ${key}: one embedding per added declaration, in ` +
        `the order of the added declarations`,
    );
  }
  for (const embedding of embeddings) {
    if (!movedConstruct.includes(embedding.container)) {
      throw new Error(
        `A13_TIE_BREAK_ARMS ${key}: the moved construct must hold the ` +
          `embedding ${JSON.stringify(embedding.container)}`,
      );
    }
  }
  return {
    key: arm.key,
    summary: arm.summary,
    files: arm.files,
    argv: arm.argv,
    receiving: arm.receiving,
    added: arm.added,
    compose: arm.compose,
    others: arm.others,
    receivingEdits,
    origin,
    movedConstruct,
    movedIdAttribute: `id="${operand.slice(hash + 1)}"`,
    embeddings,
  };
}

/** The cross-file arms' one embedding, rooted at the origin's `X` (SPEC 6.5). */
const A13_TIE_BREAK_EMBEDDING: A13Embedding = {
  container: "{text(X.a)}",
  binding: "X",
};

export const A13_TIE_BREAK_ARMS: readonly A13TieBreakArm[] = [
  a13TieBreakArm("(b)", a13MovedLines("m", "X"), [A13_TIE_BREAK_EMBEDDING]),
  a13TieBreakArm("(d)", a13MovedLines("m", "X"), [A13_TIE_BREAK_EMBEDDING]),
  a13TieBreakArm("(d, terminated)", a13MovedLines("m", "X"), [
    A13_TIE_BREAK_EMBEDDING,
  ]),
  a13TieBreakArm("(g)", a13TwiceMovedLines("m", "X", "Y"), [
    A13_TIE_BREAK_EMBEDDING,
    { container: "{text(Y.b)}", binding: "Y" },
  ]),
];

/**
 * S-9's premise: a composed expectation derives under the stock MDX 3
 * grammar. A failure here is the arm's own defect — a harness error, never
 * a product verdict.
 */
function a13AssertPremiseDerives(
  text: string,
  arm: A13Arm,
  testId = "T6.5-13",
): void {
  const verdict = deriveMdx(text);
  if (verdict.derives) return;
  throw new HarnessStagingError(
    "mdx-derivability",
    arm.receiving,
    `${testId} ${arm.key}: the composed expectation does not derive under ` +
      `the stock MDX 3 grammar (${verdict.reason}) — the arm's premise, not ` +
      `a product verdict; the text reads ${JSON.stringify(text)}`,
  );
}

/**
 * The fresh identifiers the receiving file's added declarations bind, read
 * off the declaration lines — for each lacked module exactly one line
 * `import <X> from "<specifier>"`, its other characters T6.5-8's (SPEC 6.5,
 * 2.1) — distinct from one another and none of the compiler-provided names.
 * Exported for T6.6-4's tie-break stagings, which read them the same way.
 */
export function a13ReadAddedIdentifiers(
  actual: string,
  arm: Pick<A13Arm, "added" | "receiving">,
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
 * `testId` heads the diagnoses (T6.5-19's arms share this runner).
 */
async function runA13Arm(
  product: ProductBinding,
  arm: A13Arm,
  testId = "T6.5-13",
): Promise<string> {
  const context = `${testId} ${arm.key}`;
  for (const form of arm.compose(
    A13_PLACEHOLDER_IDENTS.slice(0, arm.added.length),
  )) {
    a13AssertPremiseDerives(form, arm, testId);
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
// T6.5-16 `refused-invalid-rewrite` — the finding form, arms (a)–(i), the
// applicability arms, and the created-target arms
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
// occurrence span (5.7; the (g) family and (i)), its `identities` the
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
/** The flow-form section, its tags alone on their lines (arms (f)–(i) and the applicability arms). */
const R16_FLOW_SECTION = '<S id="m">\nx\n</S>';
/** The text-position parent of (c)'s first arm, as a whole target file. */
const R16_TEXT_PARENT = 'foo <S id="p">bar</S> baz\n';

/** One expected `locations` entry: a file and a 1.7 byte range. */
export interface R16Location {
  readonly file: string;
  readonly start: number;
  readonly end: number;
}

export interface R16RefusedArm {
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
   * every reference spelling rooted at its binding (the (g) family, (i)).
   */
  readonly locations: readonly R16Location[];
  /** Every other applicable reason's code, reported beside (the applicability arms). */
  readonly beside?: readonly string[];
  /** A beside reason's finding `path`, where the entry pins it (`refused-invalid-destination`, T14-7). */
  readonly besidePath?: Readonly<Record<string, string>>;
  /** For a file holding no admissible offset for an addition it needs: the (g) family's premise. */
  readonly noOffset?: R16NoOffset;
}

/**
 * One offset the entry names for an addition no offset admits: the file
 * with the declaration's line inserted there — U+000A after it, one before
 * it when the offset is not at a line start (SPEC 6.5) — and whether the
 * text derives. An underivable probe is inadmissible outright (14.20); a
 * deriving one is inadmissible on 6.5's other grounds — the added line
 * paragraph text after a paragraph line, no declaration, or a block joining
 * lines that were no ESM block's before the edit — which the arm's comment
 * reasons and no parse decides (T6.5-13 pins the same rule's admissible
 * side by hand).
 */
export interface R16OffsetProbe {
  readonly name: string;
  readonly text: string;
  readonly derives: boolean;
}

/**
 * The concerned file of an addition no offset admits, as every other edit
 * of the rewrite leaves it — verified deriving (S-9), so the refusal's
 * ground is the offsets alone — and the entry's named offsets probed.
 */
export interface R16NoOffset {
  readonly file: string;
  readonly composed: string;
  readonly probes: readonly R16OffsetProbe[];
}

/**
 * An arm refused for another reason alone — `refused-invalid-rewrite` not
 * applicable, no would-be text existing to judge — exit 1, nothing
 * modified, exactly the expected reasons reported (SPEC 6.5, 14).
 */
export interface R16AloneArm {
  readonly key: string;
  readonly summary: string;
  readonly files: Readonly<Record<string, string>>;
  readonly argv: readonly string[];
  /** The report's codes, exactly, as a set. */
  readonly codes: readonly string[];
}

interface R16ControlArm {
  readonly key: string;
  /** What the performed move leaves, for the diagnoses. */
  readonly summary: string;
  readonly files: Readonly<Record<string, string>>;
  readonly argv: readonly string[];
  /** Every rewritten file's bytes after the move, composed from 6.5 and 3 with no latitude. */
  readonly expected: Readonly<Record<string, string>>;
  /**
   * A receiving file whose added declaration binds a fresh identifier —
   * 6.5's latitude — its bytes composed from the identifier read back off
   * the one line `import <X> from "<specifier>"` (T6.5-13's reading).
   */
  readonly added?: {
    readonly rel: string;
    readonly specifier: string;
    readonly compose: (ident: string) => string;
  };
  /** `impact --base <pre-move ref>` against pins (SPEC 5.6, 6.2), the baseline committed before the move. */
  readonly impact?: A13ImpactExpectation;
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

// (f) a moved section standing in a block quote — `> <S id="m">`, `> x`,
// `> </S>` — whose moved text, the construct's own characters from its
// opening tag through its closing tag (SPEC 6.5), carries the `>` prefixes
// of its interior lines: at the destination's line start its opening tag
// stands outside any quote while `> </S>` puts its closing tag inside one,
// where it closes no tag standing outside (SPEC 6.5, 14.20). The deletion
// leaves `> `, U+000A — the line keeps its quote marker, so 3 drops
// nothing, and an empty quote derives. The control — the same section
// standing in no quote — is T6.5-2's flow-form arms.
const R16_F_MOVED = '<S id="m">\n> x\n> </S>';
const R16_F_ARM: R16RefusedArm = {
  key: "(f) a section standing in a block quote",
  summary:
    "the moved text carries the `>` prefixes of its interior lines, so at " +
    "the destination its closing tag stands inside a quote its opening tag " +
    "stands outside, closing nothing there (SPEC 6.5, 14.20)",
  files: { [R16_ORIGIN]: `> ${R16_F_MOVED}\n`, [R16_TARGET]: R16_K },
  argv: ["move", "specs/a.mdx#m", "specs/b.mdx#m"],
  illFormed: { [R16_TARGET]: `${R16_K}${R16_F_MOVED}\n` },
  wellFormed: { [R16_ORIGIN]: "> \n" },
  identities: [R16_TARGET],
  locations: [r16Construct(R16_ORIGIN, "> ", R16_F_MOVED)],
};

// (g) an addition no offset admits. The moved text `<S id="m">x
// {text(X.a)}</S>` — a single-line in-line section alone on its origin line
// — carries an embedding rooted at the origin's binding `X` of a third
// module `specs/x.mdx` the target lacks, so the rewrite must add a
// declaration of that module to the target (its identifier the product's
// latitude, SPEC 6.5; the probes spell `X`) at an admissible offset: one at
// which the file, as every edit leaves it, derives with the added line an
// ESM block's declaration standing inside no section, the block's other
// lines an ESM block's before the edit (SPEC 6.5, 14.20). The origin's
// binding is used by the kept sibling `k` too, so the deletion alone leaves
// the origin (no removal, 6.5), deriving. The finding locates, beside the
// construct, the embedding's braced container — the spelling rooted at the
// lacked binding, by its occurrence span (SPEC 5.7, 14) — both in the
// origin, in start order (12.7).
const R16_G_THIRD = "specs/x.mdx";
const R16_G_THIRD_SOURCE = '<S id="a">\nA text.\n</S>\n';
const R16_G_SPECIFIER = canonicalSpecifier("specs", "specs/x.xspec");
/** The origin's declaration of the third module, and the line a receiving file would need. */
const R16_G_DECLARATION = `import X from "${R16_G_SPECIFIER}"`;
const R16_G_CONTAINER = "{text(X.a)}";
const R16_G_MOVED = `<S id="m">x ${R16_G_CONTAINER}</S>`;
/** The origin as the deletion leaves it: the declaration, an empty line, the kept sibling. */
const R16_G_ORIGIN_KEPT = `${R16_G_DECLARATION}\n\n<S id="k">z ${R16_G_CONTAINER}</S>\n`;
const R16_G_ORIGIN_BEFORE = `${R16_G_ORIGIN_KEPT}${R16_G_MOVED}\n`;
const R16_G_LOCATIONS: readonly R16Location[] = [
  r16Construct(R16_ORIGIN, R16_G_ORIGIN_KEPT, R16_G_MOVED),
  r16Construct(R16_ORIGIN, `${R16_G_ORIGIN_KEPT}<S id="m">x `, R16_G_CONTAINER),
];
/** (c)'s first parent as the target insertion into `p.n` leaves it, the declaration absent, terminated or not. */
function r16ComposedIntoP(terminated: boolean): string {
  return `foo <S id="p">bar\n<S id="p.n">x ${R16_G_CONTAINER}</S>\n</S> baz${terminated ? "\n" : ""}`;
}

/**
 * 6.5's line of an added declaration at `offset` of `text` — the file as the
 * other edits leave it: U+000A after the declaration, and one before it
 * when the offset is not at a line start, judged over `text`.
 */
function r16Declared(
  text: string,
  offset: number,
  declaration: string,
): string {
  const lineStart = offset === 0 || text[offset - 1] === "\n";
  return `${text.slice(0, offset)}${lineStart ? "" : "\n"}${declaration}\n${text.slice(offset)}`;
}

function r16Probe(
  name: string,
  text: string,
  offset: number,
  derives: boolean,
  declaration: string = R16_G_DECLARATION,
): R16OffsetProbe {
  return { name, text: r16Declared(text, offset, declaration), derives };
}

// The text-position target `foo <S id="p">bar</S> baz`, with and without a
// final terminator: offset 0 would absorb the paragraph line into the
// block, the file's end follows a paragraph line, and every other offset
// splits the paragraph.
function r16ArmG(name: string, terminated: boolean): R16RefusedArm {
  const composed = r16ComposedIntoP(terminated);
  return {
    key: `(g) no admissible offset in the text-position target, ${name}`,
    summary:
      `the target lacks the third module's binding the embedding is rooted ` +
      `at, and no offset admits the declaration: offset 0 absorbs the ` +
      `paragraph's first line into the block (14.20), the file's end ` +
      `follows a paragraph line, leaving the added line paragraph text, and ` +
      `every other offset splits the paragraph (SPEC 6.5)`,
    files: {
      [R16_ORIGIN]: R16_G_ORIGIN_BEFORE,
      [R16_TARGET]: terminated ? R16_TEXT_PARENT : R16_TEXT_PARENT.slice(0, -1),
      [R16_G_THIRD]: R16_G_THIRD_SOURCE,
    },
    argv: ["move", "specs/a.mdx#m", "specs/b.mdx#p.n"],
    illFormed: {},
    wellFormed: { [R16_ORIGIN]: R16_G_ORIGIN_KEPT },
    identities: [R16_TARGET],
    locations: R16_G_LOCATIONS,
    noOffset: {
      file: R16_TARGET,
      composed,
      probes: [
        r16Probe("offset 0", composed, 0, false),
        r16Probe("the file's end", composed, composed.length, true),
      ],
    },
  };
}

// The pseudo-block twin: the same target headed by T6.5-13(l)'s paragraph
// `// note`, U+000A, `import B from "./B.xspec"`, U+000A, U+000A — content,
// no block (an ESM block cannot interrupt a paragraph; `specs/B.mdx` is
// absent and the pre-move `build` clean all the same). Offset 0 heads a
// block joining the paragraph's lines — deriving yet inadmissible, lines
// that were no ESM block's before the edit; the start of line 2, the start
// of the empty line, and the file's end each follow a paragraph line; the
// start of the `foo` line heads a block absorbing that line (14.20); every
// other offset splits a paragraph line. A product judging admissibility by
// derivability alone performs the move at offset 0, the paragraph turned
// into live declarations.
const R16_G_PSEUDO_HEAD = '// note\nimport B from "./B.xspec"\n\n';
const R16_G_PSEUDO_COMPOSED = `${R16_G_PSEUDO_HEAD}${r16ComposedIntoP(true)}`;
const R16_G_PSEUDO_ARM: R16RefusedArm = {
  key: "(g) the pseudo-block twin: the target headed by a paragraph of declarations",
  summary:
    "offset 0 heads a block joining the paragraph's lines — deriving yet " +
    "inadmissible, lines that were no ESM block's before the edit — the " +
    "start of line 2, the start of the empty line, and the file's end each " +
    "follow a paragraph line, the start of the `foo` line heads a block " +
    "absorbing that line (14.20), and every other offset splits a paragraph " +
    "line (SPEC 6.5); a product judging admissibility by derivability alone " +
    "performs the move at offset 0",
  files: {
    [R16_ORIGIN]: R16_G_ORIGIN_BEFORE,
    [R16_TARGET]: `${R16_G_PSEUDO_HEAD}${R16_TEXT_PARENT}`,
    [R16_G_THIRD]: R16_G_THIRD_SOURCE,
  },
  argv: ["move", "specs/a.mdx#m", "specs/b.mdx#p.n"],
  illFormed: {},
  wellFormed: { [R16_ORIGIN]: R16_G_ORIGIN_KEPT },
  identities: [R16_TARGET],
  locations: R16_G_LOCATIONS,
  noOffset: {
    file: R16_TARGET,
    composed: R16_G_PSEUDO_COMPOSED,
    probes: [
      r16Probe(
        "offset 0, a block joining the paragraph's lines",
        R16_G_PSEUDO_COMPOSED,
        0,
        true,
      ),
      r16Probe(
        "the start of line 2",
        R16_G_PSEUDO_COMPOSED,
        "// note\n".length,
        true,
      ),
      r16Probe(
        "the start of the empty line",
        R16_G_PSEUDO_COMPOSED,
        R16_G_PSEUDO_HEAD.length - 1,
        true,
      ),
      r16Probe(
        "the start of the `foo` line",
        R16_G_PSEUDO_COMPOSED,
        R16_G_PSEUDO_HEAD.length,
        false,
      ),
      r16Probe(
        "the file's end",
        R16_G_PSEUDO_COMPOSED,
        R16_G_PSEUDO_COMPOSED.length,
        true,
      ),
    ],
  },
};

// The top-level twin: the same moved text to the top level of a
// paragraph-ended target `para`, U+000A, terminated and unterminated — the
// composed text `para`, U+000A, the moved text, U+000A either way (the
// target insertion at a line start in the terminated variant, preceded by
// an added terminator in the other), deriving: the moved text's line is a
// paragraph continuation of `para`, the prose outside its tags denying the
// flow attempt (14.20), whatever precedes the line. No offset admits the
// declaration: offset 0 absorbs `para` into the block; the end of the
// `para` line and every offset inside it leave the added line after a
// paragraph line; and the file's end, the target insertion's offset, where
// the declaration stands after the moved text (6.5's fixed order), leaves
// it after the moved text's own paragraph line — 6.5's end-of-file
// qualifier decided on its refusing side. The controls are T6.5-13(d) and
// R16_G_CONTROL below.
const R16_G_TOP_COMPOSED = `para\n${R16_G_MOVED}\n`;
function r16ArmGTop(name: string, target: string): R16RefusedArm {
  return {
    key: `(g) the top-level twin: the paragraph-ended target, ${name}`,
    summary:
      "the in-line moved text's line is a paragraph continuation of `para` " +
      "(14.20), and no offset admits the declaration: offset 0 absorbs " +
      "`para` into the block, the end of the `para` line and every offset " +
      "inside it leave the added line after a paragraph line, and the " +
      "file's end — where the declaration stands after the moved text, " +
      "6.5's fixed order — leaves it after the moved text's own paragraph " +
      "line (SPEC 6.5)",
    files: {
      [R16_ORIGIN]: R16_G_ORIGIN_BEFORE,
      [R16_TARGET]: target,
      [R16_G_THIRD]: R16_G_THIRD_SOURCE,
    },
    argv: ["move", "specs/a.mdx#m", "specs/b.mdx#m"],
    illFormed: {},
    wellFormed: { [R16_ORIGIN]: R16_G_ORIGIN_KEPT },
    identities: [R16_TARGET],
    locations: R16_G_LOCATIONS,
    noOffset: {
      file: R16_TARGET,
      composed: R16_G_TOP_COMPOSED,
      probes: [
        r16Probe("offset 0", R16_G_TOP_COMPOSED, 0, false),
        r16Probe(
          "the end of the `para` line",
          R16_G_TOP_COMPOSED,
          "para".length,
          true,
        ),
        r16Probe(
          "the file's end, after the moved text",
          R16_G_TOP_COMPOSED,
          R16_G_TOP_COMPOSED.length,
          true,
        ),
      ],
    },
  };
}

// The origin-side twin: an origin `foo <S id="p">bar <S id="p.m">x</S></S>
// {text("p.m")} baz` with no terminator, `p.m` moved into a clean
// flow-position target; the kept reference's conversion to imported form
// needs an import of the target module, which the origin holds no
// admissible offset for — offset 0 absorbs its one line into the block
// (14.20), the file's end, after an unterminated paragraph line, leaves the
// added line paragraph text, and every other offset splits the line. The
// deletion's result derives; the reference's rewritten spelling falls
// inside its braces, an expression either way. The controls are T6.5-13's
// arms, whose receiving files each hold an admissible offset.
const R16_G_SIDE_PREFIX = 'foo <S id="p">bar ';
const R16_G_SIDE_MOVED = '<S id="p.m">x</S>';
const R16_G_SIDE_REFERENCE = '{text("p.m")}';
const R16_G_SIDE_TAIL = `</S> ${R16_G_SIDE_REFERENCE} baz`;
const R16_G_SIDE_COMPOSED = `${R16_G_SIDE_PREFIX}${R16_G_SIDE_TAIL}`;
const R16_G_SIDE_DECLARATION = `import B from "${canonicalSpecifier("specs", "specs/b.xspec")}"`;
const R16_G_SIDE_ARM: R16RefusedArm = {
  key: "(g) the origin-side twin: the kept reference's import the origin has no offset for",
  summary:
    'the origin\'s kept `{text("p.m")}` converts to imported form, rooted ' +
    "at a binding of the target module the origin lacks, and no offset " +
    "admits the declaration: offset 0 absorbs the file's one line into the " +
    "block (14.20), the file's end, after an unterminated paragraph line, " +
    "leaves the added line paragraph text, and every other offset splits " +
    "the line (SPEC 6.5)",
  files: {
    [R16_ORIGIN]: `${R16_G_SIDE_PREFIX}${R16_G_SIDE_MOVED}${R16_G_SIDE_TAIL}`,
    [R16_TARGET]: '<S id="q">\nz\n</S>\n',
  },
  argv: ["move", "specs/a.mdx#p.m", "specs/b.mdx#q.n"],
  illFormed: {},
  wellFormed: { [R16_TARGET]: '<S id="q">\nz\n<S id="q.n">x</S>\n</S>\n' },
  identities: [R16_ORIGIN],
  locations: [
    r16Construct(R16_ORIGIN, R16_G_SIDE_PREFIX, R16_G_SIDE_MOVED),
    r16Construct(
      R16_ORIGIN,
      `${R16_G_SIDE_PREFIX}${R16_G_SIDE_MOVED}</S> `,
      R16_G_SIDE_REFERENCE,
    ),
  ],
  noOffset: {
    file: R16_ORIGIN,
    composed: R16_G_SIDE_COMPOSED,
    probes: [
      r16Probe(
        "offset 0",
        R16_G_SIDE_COMPOSED,
        0,
        false,
        R16_G_SIDE_DECLARATION,
      ),
      r16Probe(
        "the file's end, after the unterminated line",
        R16_G_SIDE_COMPOSED,
        R16_G_SIDE_COMPOSED.length,
        true,
        R16_G_SIDE_DECLARATION,
      ),
    ],
  },
};

// (i) two files concerned, one finding: an origin `specs/z.mdx` of (d)'s
// shape — its deletion leaving `- item` at the line's start — whose import
// of the third module has its only occurrence in the moved text, so the
// declaration is removed and its line dropped, the empty line kept (SPEC
// 6.5, 3); and the target of (g)'s shape, lacking that module, no offset
// admitting the declaration. An insertion point exists, so both texts are
// judged: exactly one finding, `identities` both paths in byte order — the
// target first — and `locations` the construct and the embedding's braced
// container, both in the origin, in start order (SPEC 14, 12.7).
const R16_I_ORIGIN = "specs/z.mdx";
const R16_I_PREFIX = `${R16_G_DECLARATION}\n\nfoo <S id="p">bar\n`;
const R16_I_MOVED = `<S id="p.m">x ${R16_G_CONTAINER}</S>`;
const R16_I_COMPOSED = r16ComposedIntoP(true);
const R16_I_ARM: R16RefusedArm = {
  key: "(i) two files concerned, one finding",
  summary:
    "the origin's deletion leaves `- item` at its line's start (14.20) and " +
    "the target, lacking the third module's binding, holds no admissible " +
    "offset for the declaration: exactly one finding, `identities` both " +
    "paths in byte order, the target first, `locations` the construct and " +
    "the embedding's braced container, both in the origin, in start order " +
    "(SPEC 6.5, 14, 12.7)",
  files: {
    [R16_I_ORIGIN]: `${R16_I_PREFIX}${R16_I_MOVED}- item\n</S> baz\n`,
    [R16_TARGET]: R16_TEXT_PARENT,
    [R16_G_THIRD]: R16_G_THIRD_SOURCE,
  },
  argv: ["move", "specs/z.mdx#p.m", "specs/b.mdx#p.n"],
  illFormed: { [R16_I_ORIGIN]: '\nfoo <S id="p">bar\n- item\n</S> baz\n' },
  wellFormed: {},
  identities: [R16_TARGET, R16_I_ORIGIN],
  locations: [
    r16Construct(R16_I_ORIGIN, R16_I_PREFIX, R16_I_MOVED),
    r16Construct(
      R16_I_ORIGIN,
      `${R16_I_PREFIX}<S id="p.m">x `,
      R16_G_CONTAINER,
    ),
  ],
  noOffset: {
    file: R16_TARGET,
    composed: R16_I_COMPOSED,
    probes: [
      r16Probe("offset 0", R16_I_COMPOSED, 0, false),
      r16Probe("the file's end", R16_I_COMPOSED, R16_I_COMPOSED.length, true),
    ],
  },
};

// (h) the same-file variant: the flow-form section `m` moved into the
// text-position parent `p` of its own file — the one file as deletion and
// insertion both leave it not well-formed (SPEC 6.5, 14.20), its path once
// in `identities`. The control is the same-file move of T6.5-13(e).
const R16_H_ARM: R16RefusedArm = {
  key: "(h) the same-file variant",
  summary:
    "origin and target coincide: the deletion drops the section's lines and " +
    "the insertion puts its flow-position tags inside the text-position " +
    "parent `p`, the one file not well-formed — its path once in " +
    "`identities` (SPEC 6.5, 6.2, 14.20)",
  files: { [R16_ORIGIN]: `${R16_TEXT_PARENT}${R16_FLOW_SECTION}\n` },
  argv: ["move", "specs/a.mdx#m", "specs/a.mdx#p.n"],
  illFormed: {
    [R16_ORIGIN]: 'foo <S id="p">bar\n<S id="p.n">\nx\n</S>\n</S> baz\n',
  },
  wellFormed: {},
  identities: [R16_ORIGIN],
  locations: [r16Construct(R16_ORIGIN, R16_TEXT_PARENT, R16_FLOW_SECTION)],
};

// Applicability (SPEC 6.5): the refusal is reported beside every other
// applicable reason; judged only under an intrinsically valid `<new-id>`;
// the origin's would-be text judged always, the target's only when an
// insertion point exists; and a created target's path spelled whatever its
// validity, the creation's composition judged on its own.

// (c)'s first shape staged beside `refused-id-collision` — a section `p.n`
// already in the target — reports both reasons.
const R16_COLLISION_ARM: R16RefusedArm = {
  key: "(c) beside refused-id-collision: a section p.n already in the target",
  summary:
    "the flow-form section's tags would stand alone on their lines inside " +
    "the text-position parent (SPEC 6.5, 14.20) and `p.n` collides with " +
    "the section the target already holds: both reasons reported, each " +
    "once (SPEC 6.5, 14)",
  files: {
    [R16_ORIGIN]: `${R16_K}${R16_FLOW_SECTION}\n`,
    [R16_TARGET]: 'foo <S id="p">bar <S id="p.n">n</S></S> baz\n',
  },
  argv: ["move", "specs/a.mdx#m", "specs/b.mdx#p.n"],
  illFormed: {
    [R16_TARGET]:
      'foo <S id="p">bar <S id="p.n">n</S>\n<S id="p.n">\nx\n</S>\n</S> baz\n',
  },
  wellFormed: { [R16_ORIGIN]: R16_K },
  identities: [R16_TARGET],
  locations: [r16Construct(R16_ORIGIN, R16_K, R16_FLOW_SECTION)],
  beside: ["refused-id-collision"],
};

// A missing target parent beside an origin deletion of shape (d): no
// insertion point exists, so the target's text is not judged, while the
// origin's, judged always, is not well-formed — both reasons, `identities`
// the origin path alone.
const R16_D_MISSING_PARENT_ARM: R16RefusedArm = {
  key: "(d) beside refused-missing-target-parent: the origin judged, the target not",
  summary:
    "the target holds no `q`, so no insertion point exists and the target's " +
    "text is not judged, while the origin's deletion, judged always, leaves " +
    "`- item` at its line's start (SPEC 6.5, 14.20): both reasons reported, " +
    "`identities` the origin path alone (SPEC 14)",
  files: {
    [R16_ORIGIN]: `${R16_D_PREFIX}${R16_D_MOVED}- item\n</S> baz\n`,
    [R16_TARGET]: R16_K,
  },
  argv: ["move", "specs/a.mdx#p.m", "specs/b.mdx#q.n"],
  illFormed: { [R16_ORIGIN]: `${R16_D_PREFIX}- item\n</S> baz\n` },
  wellFormed: {},
  identities: [R16_ORIGIN],
  locations: [r16Construct(R16_ORIGIN, R16_D_PREFIX, R16_D_MOVED)],
  beside: ["refused-missing-target-parent"],
};

// A created target: (a)'s shape (a space after its opening tag) moved to an
// absent path, its content composed as T6.5-14 fixes — the re-identified
// moved text and U+000A, no declaration needed — underivable: at the line's
// start its opening tag is a flow-position tag, its closing tag inside the
// paragraph `body</S>` (SPEC 6.5, 6.2, 14.20). The path is spelled in
// `identities` whatever its validity: `specs/new.txt`, lacking the `.mdx`
// extension, beside `refused-invalid-destination` with that path (T14-7);
// the valid `specs/new.mdx` alone — exit 1, nothing created (the
// whole-root compare).
const R16_CREATED_MOVED = '<S id="m"> \nbody</S>';
function r16CreatedArm(
  created: string,
  beside: readonly string[],
): R16RefusedArm {
  const alone = beside.length === 0;
  return {
    key: `the created target ${created}${alone ? " alone" : ` beside ${beside.join(", ")}`}`,
    summary:
      `the creation's composition — the re-identified moved text and ` +
      `U+000A — is judged on its own: at the line's start its opening tag ` +
      `is a flow-position tag, which the text-position closing tag of ` +
      `\`body</S>\` cannot close (SPEC 6.5, 6.2, 14.20), the path spelled ` +
      (alone
        ? `alone, valid, nothing created`
        : `beside its own invalidity, ${beside.join(", ")} with that path`),
    files: { [R16_ORIGIN]: `foo ${R16_CREATED_MOVED}\n` },
    argv: ["move", "specs/a.mdx#m", `${created}#y`],
    illFormed: { [created]: '<S id="y"> \nbody</S>\n' },
    wellFormed: { [R16_ORIGIN]: "foo \n" },
    identities: [created],
    locations: [r16Construct(R16_ORIGIN, "foo ", R16_CREATED_MOVED)],
    beside,
    ...(beside.includes("refused-invalid-destination")
      ? { besidePath: { "refused-invalid-destination": created } }
      : {}),
  };
}

// Refused for another reason alone, `refused-invalid-rewrite` not
// applicable: (c)'s first shape under the intrinsically invalid `<new-id>`
// `p.then` (`then` a forbidden segment, SPEC 1.4) — an invalid one spelled
// verbatim leaves the would-be text undefined; and a missing target parent
// beside the flow-form section and a text-position target file, the
// origin's deletion leaving it well-formed — no target text exists to
// judge.
export const R16_ALONE_ARMS: readonly R16AloneArm[] = [
  {
    key: "(c)'s shape under the invalid new-id p.then: refused-invalid-id alone",
    summary:
      "the refusal is judged only under an intrinsically valid `<new-id>`: " +
      "`then` is a forbidden segment (SPEC 1.4), so `refused-invalid-id` is " +
      "reported alone, no would-be text judged (SPEC 6.5, 14)",
    files: {
      [R16_ORIGIN]: `${R16_K}${R16_FLOW_SECTION}\n`,
      [R16_TARGET]: R16_TEXT_PARENT,
    },
    argv: ["move", "specs/a.mdx#m", "specs/b.mdx#p.then"],
    codes: ["refused-invalid-id"],
  },
  {
    key: "a missing target parent beside a clean origin: refused-missing-target-parent alone",
    summary:
      "the flow-form section's deletion leaves the origin well-formed and " +
      "the target holds no `q`, so no insertion point exists and no target " +
      "text is judged: `refused-missing-target-parent` alone (SPEC 6.5, 14)",
    files: {
      [R16_ORIGIN]: `${R16_K}${R16_FLOW_SECTION}\n`,
      [R16_TARGET]: R16_TEXT_PARENT,
    },
    argv: ["move", "specs/a.mdx#m", "specs/b.mdx#q.n"],
    codes: ["refused-missing-target-parent"],
  },
];

// (g)'s performed control: the same in-line moved text to the top level
// of `<S id="p">`, U+000A, `x`, U+000A, `</S>`, U+000A — its only admissible
// offset the end of the `</S>` line before its terminator (offset 0
// absorbing the tag's line; the end of that line heading a block inside
// `p`, deriving yet excluded, T6.5-19; the start of the `x` line absorbing
// it; the end of the `x` line and the start of the `</S>` line leaving the
// added line paragraph text; the file's end, a line start after a flow line
// before the operation, following the moved text's paragraph line after
// it), T6.5-13(h)'s forced mid-line placement: the added terminator ends
// the `</S>` line, the declaration's line follows, and the line's original
// terminator is left an empty line before the moved text — which pins that
// the in-line moved text's own line is a paragraph line whatever precedes
// it. `build` and `check` clean; the root `changed` — a parent gaining a
// child reference, its run after `p` now U+000A, the kept remainder line,
// and its run after `m` U+000A — beside the origin root, which loses one;
// `p` keeps its own content (the added terminator ends its closing tag's
// line, dropped as before), the moved node keeps its hashes (its one line
// contributes at the destination what it did at the origin), and the third
// module is untouched (SPEC 6.2, 5.6). A product treating the file's end
// after a top-level target insertion as admissible outright, or judging
// admissibility over the pre-operation text, places the declaration after
// the moved text.
const R16_G_CONTROL_TARGET = '<S id="p">\nx\n</S>\n';
const R16_G_CONTROL: R16ControlArm = {
  key: "(g) control: the in-line moved text to the top level of a flow-ended target",
  summary:
    "the end of the `</S>` line before its terminator is the only " +
    "admissible offset — offset 0 absorbing the tag's line, the end of the " +
    "opening tag's line heading a block inside `p` (excluded), the start " +
    "of the `x` line absorbing it, the end of the `x` line and the start of " +
    "the `</S>` line leaving the added line paragraph text, and the file's " +
    "end following the moved text's own paragraph line — so the added " +
    "terminator ends the `</S>` line, the declaration's line follows, and " +
    "the line's original terminator is left an empty line before the moved " +
    "text (SPEC 6.5, 6.2, 14.20)",
  files: {
    [R16_ORIGIN]: R16_G_ORIGIN_BEFORE,
    [R16_TARGET]: R16_G_CONTROL_TARGET,
    [R16_G_THIRD]: R16_G_THIRD_SOURCE,
  },
  argv: ["move", "specs/a.mdx#m", "specs/b.mdx#m"],
  expected: { [R16_ORIGIN]: R16_G_ORIGIN_KEPT },
  added: {
    rel: R16_TARGET,
    specifier: R16_G_SPECIFIER,
    compose: (ident) =>
      `${R16_G_CONTROL_TARGET.slice(0, -1)}\nimport ${ident} from "${R16_G_SPECIFIER}"\n\n<S id="m">x {text(${ident}.a)}</S>\n`,
  },
  impact: {
    known: [
      R16_ORIGIN,
      `${R16_ORIGIN}#k`,
      R16_TARGET,
      `${R16_TARGET}#p`,
      `${R16_TARGET}#m`,
      R16_G_THIRD,
      `${R16_G_THIRD}#a`,
    ],
    pins: [
      {
        identity: R16_TARGET,
        required: ["changed"],
        changedWithin: [R16_TARGET],
      },
      {
        identity: R16_ORIGIN,
        required: ["changed"],
        changedWithin: [R16_ORIGIN],
      },
      { identity: `${R16_TARGET}#p`, required: [] },
      { identity: `${R16_TARGET}#m`, required: [] },
      { identity: `${R16_ORIGIN}#k`, required: [] },
      { identity: R16_G_THIRD, required: [] },
      { identity: `${R16_G_THIRD}#a`, required: [] },
    ],
    reason:
      "the target root is `changed` — a parent gaining a child reference, " +
      "its run after `p` now U+000A, the kept remainder line, and its run " +
      "after `m` U+000A — beside the origin root, which loses one, each " +
      "attributed to itself; `p` keeps its own content, the moved node its " +
      "hashes, and the third module is untouched (SPEC 6.2, 5.6)",
  },
};

/** T6.5-16's refused arms, in the entry's order (exported for T6.6-3's preview twins). */
export const R16_REFUSED_ARMS: readonly R16RefusedArm[] = [
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
  R16_F_ARM,
  r16ArmG("terminated", true),
  r16ArmG("unterminated", false),
  R16_G_PSEUDO_ARM,
  r16ArmGTop("terminated", "para\n"),
  r16ArmGTop("unterminated", "para"),
  R16_G_SIDE_ARM,
  R16_H_ARM,
  R16_I_ARM,
  R16_COLLISION_ARM,
  R16_D_MISSING_PARENT_ARM,
  r16CreatedArm("specs/new.txt", ["refused-invalid-destination"]),
  r16CreatedArm("specs/new.mdx", []),
];

const R16_CONTROL_ARMS: readonly R16ControlArm[] = [
  ...R16_C_PARENTS.map((parent) => r16ControlC(parent)),
  R16_D_CONTROL,
  R16_E_CONTROL,
  R16_G_CONTROL,
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
    ...(arm.noOffset === undefined
      ? []
      : [
          [
            `T6.5-16 ${arm.key}: ${arm.noOffset.file} as the other edits leave it`,
            arm.noOffset.composed,
          ] as const,
          ...arm.noOffset.probes
            .filter((probe) => probe.derives)
            .map(
              (probe) =>
                [
                  `T6.5-16 ${arm.key}: ${arm.noOffset!.file} with the declaration at ${probe.name}`,
                  probe.text,
                ] as const,
            ),
        ]),
  ]),
  ...R16_CONTROL_ARMS.flatMap((arm) => [
    ...Object.entries(arm.files).map(
      ([rel, text]) => [`T6.5-16 ${arm.key}: ${rel} as staged`, text] as const,
    ),
    ...Object.entries(arm.expected).map(
      ([rel, text]) =>
        [`T6.5-16 ${arm.key}: ${rel} after the move`, text] as const,
    ),
    ...(arm.added === undefined
      ? []
      : [
          [
            `T6.5-16 ${arm.key}: ${arm.added.rel} after the move, the declaration binding X`,
            arm.added.compose("X"),
          ] as const,
        ]),
  ]),
  ...R16_ALONE_ARMS.flatMap((arm) =>
    Object.entries(arm.files).map(
      ([rel, text]) => [`T6.5-16 ${arm.key}: ${rel} as staged`, text] as const,
    ),
  ),
];

/**
 * Every would-be text T6.5-16 refuses, for the S-9 self-test: each is the
 * concerned file as 6.5's exact edits would leave it, which must not derive
 * — the ground of the refusal.
 */
export const R16_REFUSED_VECTORS: ReadonlyArray<
  readonly [name: string, source: string]
> = R16_REFUSED_ARMS.flatMap((arm) => [
  ...Object.entries(arm.illFormed).map(
    ([rel, text]) =>
      [`T6.5-16 ${arm.key}: ${rel} as the edits would leave it`, text] as const,
  ),
  ...(arm.noOffset?.probes ?? [])
    .filter((probe) => !probe.derives)
    .map(
      (probe) =>
        [
          `T6.5-16 ${arm.key}: ${arm.noOffset!.file} with the declaration at ${probe.name}`,
          probe.text,
        ] as const,
    ),
]);

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
function r16AssertDerives(
  text: string,
  rel: string,
  key: string,
  testId = "T6.5-16",
): void {
  const verdict = deriveMdx(text);
  if (verdict.derives) return;
  throw new HarnessStagingError(
    "mdx-derivability",
    rel,
    `${testId} ${key}: the composed text for ${rel} does not derive under ` +
      `the stock MDX 3 grammar (${verdict.reason}) — the arm's premise, not ` +
      `a product verdict; the text reads ${JSON.stringify(text)}`,
  );
}

/** The report's codes, as `condition ?? code` (the H-3 decoder's derived condition where one is pinned). */
function r16Codes(findings: readonly Finding[]): string[] {
  return findings.map(
    (finding) => finding.condition ?? finding.code ?? "(code-less)",
  );
}

/** Two code lists hold the same multiset. */
function r16SameCodes(
  actual: readonly string[],
  expected: readonly string[],
): boolean {
  const sortedActual = [...actual].sort();
  return (
    actual.length === expected.length &&
    [...expected].sort().every((code, index) => sortedActual[index] === code)
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
  const actualCodes = r16Codes(findings);
  if (!r16SameCodes(actualCodes, expectedCodes)) {
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
  for (const [code, path] of Object.entries(arm.besidePath ?? {})) {
    const beside = findings.find((candidate) => candidate.code === code)!;
    if (beside.path !== path) {
      fail(
        `${context}: the \`${code}\` finding reported beside carries ` +
          `\`path\` ${JSON.stringify(path)} — the destination spelled ` +
          `whatever its validity (SPEC 6.5, 14; T14-7); got ` +
          `${renderPathValue(beside.path)} (message: ` +
          `${JSON.stringify(beside.message)})`,
      );
    }
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
  if (arm.noOffset !== undefined) {
    // The refusal's ground is the offsets alone: the concerned file derives
    // as the other edits leave it, and each named offset holds the verdict
    // the entry states for the declaration inserted there.
    r16AssertDerives(arm.noOffset.composed, arm.noOffset.file, arm.key);
    for (const probe of arm.noOffset.probes) {
      const rel = `${arm.noOffset.file} with the declaration at ${probe.name}`;
      if (probe.derives) r16AssertDerives(probe.text, rel, arm.key);
      else r16AssertUnderivable(probe.text, rel, arm.key);
    }
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

async function runR16AloneArm(
  product: ProductBinding,
  arm: R16AloneArm,
): Promise<void> {
  const context = `T6.5-16 ${arm.key}`;
  const command = arm.argv.join(" ");
  await withWorkspace(arm.files, async (workspace) => {
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
        const actualCodes = r16Codes(findings);
        if (!r16SameCodes(actualCodes, arm.codes)) {
          fail(
            `${context}: the report holds exactly one finding per applicable ` +
              `reason — ${JSON.stringify(arm.codes)} and no ` +
              `\`refused-invalid-rewrite\` beside it: ${arm.summary} ` +
              `(SPEC 6.5, 14, 12.7); got ${JSON.stringify(actualCodes)}`,
          );
        }
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
  testId = "T6.5-16",
): Promise<void> {
  const context = `${testId} ${arm.key}`;
  for (const [rel, text] of Object.entries(arm.expected)) {
    r16AssertDerives(text, rel, arm.key, testId);
  }
  if (arm.added !== undefined) {
    r16AssertDerives(arm.added.compose("X"), arm.added.rel, arm.key, testId);
  }
  const command = arm.argv.join(" ");
  await withWorkspace(arm.files, async (workspace) => {
    await buildOk(
      product,
      workspace,
      `${context} \`build\` over the staging — the pre-move workspace is ` +
        `valid, every staged file well-formed (SPEC 6.4, 6.5, 14.20)`,
    );
    let base = "";
    if (arm.impact !== undefined) {
      await workspace.gitInit();
      base = await workspace.gitCommitAll("pre-move baseline");
    }
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
    if (arm.added !== undefined) {
      const { rel, specifier, compose } = arm.added;
      const actual = await readSourceText(workspace, rel, context);
      const ident = r16ReadAddedIdentifier(actual, specifier);
      await assertFileBytes(
        workspace.path(rel),
        compose(ident ?? "X"),
        `${context}: ${rel} after the move — ${arm.summary}; the added ` +
          `declaration \`import <X> from "${specifier}"\` (its identifier ` +
          `${ident === undefined ? "unreadable off the file, spelled X here" : `read back as \`${ident}\``}) ` +
          `at the one admissible offset, the rest composed from 6.5's exact ` +
          `edits with no latitude (SPEC 6.5, 2.1, 3; H-4)`,
      );
    }
    await assertCleanAfterMove(
      product,
      workspace,
      "the performed control leaves a valid workspace",
      context,
    );
    if (arm.impact !== undefined) {
      await a13AssertImpact(product, workspace, base, arm.impact, context);
    }
  });
}

/**
 * The fresh identifier a receiving file's one added declaration of
 * `specifier` binds, read off its line (`import <X> from "<specifier>"`,
 * SPEC 6.5); undefined when no such line stands alone — the caller then
 * pins the composition with `X`, and the byte assertion diagnoses.
 */
function r16ReadAddedIdentifier(
  actual: string,
  specifier: string,
): string | undefined {
  const escaped = specifier.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  const pattern = new RegExp(
    `^import ([A-Za-z_$][A-Za-z0-9_$]*) from "${escaped}"$`,
    "gm",
  );
  const matches = [...actual.matchAll(pattern)];
  const ident = matches.length === 1 ? matches[0]?.[1] : undefined;
  if (ident === undefined || MDX_RESERVED_NAMES.includes(ident)) {
    return undefined;
  }
  return ident;
}

const T6_5_16 = defineProductTest({
  id: "T6.5-16",
  title:
    "refused-invalid-rewrite: a section-form move whose exact edits would leave a rewritten file other than well-formed MDX — the origin as its deletion leaves it, the target as its parent rewrite and insertion leave it or as its creation composes it, the one file when origin and target coincide — or a file the rewrite must add an import to holding no admissible offset, is refused: exit 1, nothing modified (the workspace byte-compared, the journal absent or byte-unchanged), exactly one `refused-invalid-rewrite` finding per operation, beside every other applicable reason, locating the moved section's construct range in the origin file plus, for an addition no offset admits, the reference spelling rooted at its binding by its occurrence span, its `identities` the concerned files' workspace-relative paths in byte order, its `path` null; each arm's would-be text verified underivable, every other rewritten file's verified to derive, and each named offset of an addition none admits probed (S-9) from a valid pre-move workspace: (a) the `body</S>` variant — `foo <S id=\"m\">`, then a space, a tab, or nothing, U+000A, `body</S>` — moved to top level; (b) the one-sided U+000C and U+000B spellings of 6.2's worked three-line shape; (c) a flow-position section, a self-closing section, and a single-line section holding nothing outside its tags, each moved into `foo <S id=\"p\">bar</S> baz`, into the parent with its closing tag on a later line, and into the self-closing parent after its paired-form rewrite; (d) a deletion leaving a list marker, a setext underline, a flow-position tag, a flow-position expression, or the parent's own closing tag at its line's start inside a text-position parent, and the insertion-side counterpart leaving `<S id=\"p.s\"> </S>` alone on its line; (e) a top-level insertion at the end of a file whose last line is an ESM block's, terminated and unterminated; (f) a section standing in a block quote, its moved text carrying the `>` prefixes of its interior lines; (g) a text-position target lacking the module the moved embedding is rooted at, terminated and unterminated, its pseudo-block twin headed by a paragraph of declarations, its top-level twin into the paragraph-ended `para`, terminated and unterminated, and its origin-side twin whose kept reference needs an import the unterminated origin holds no offset for — the finding locating the construct and the embedding's braced container; (h) the same-file variant, one path; (i) two files concerned, one finding, `identities` exactly [\"specs/b.mdx\", \"specs/z.mdx\"]; the applicability arms — (c)'s shape beside `refused-id-collision`; a missing target parent beside an origin deletion of shape (d), `identities` the origin alone, and, the origin clean, `refused-missing-target-parent` alone; (c)'s shape under `p.then`, `refused-invalid-id` alone; and (a)'s shape to the absent `specs/new.txt#y`, beside `refused-invalid-destination` with that path, and to `specs/new.mdx#y`, alone, nothing created; with the movable controls performed and byte-asserted, `check` and `build` clean — the in-line section `<S id=\"m\">x</S>` into each of (c)'s parents, (d)'s plain-prose remainder ` more` kept as a paragraph-continuation line, (e)'s declaration followed by the empty line ending its block, and (g)'s in-line moved text to the top level of `<S id=\"p\">`, `x`, `</S>`, the declaration at the end of the `</S>` line before the moved text and the root `changed` (SPEC 6.5, 6.2, 3, 2.1, 1.7, 5.7, 14, 12.7, 14.20)",
  run: async (product) => {
    for (const arm of R16_REFUSED_ARMS) {
      await runR16RefusedArm(product, arm);
    }
    for (const arm of R16_ALONE_ARMS) {
      await runR16AloneArm(product, arm);
    }
    for (const arm of R16_CONTROL_ARMS) {
      await runR16ControlArm(product, arm);
    }
  },
});

// ---------------------------------------------------------------------------
// T6.5-17: `refused-moved-import`. SPEC 6.5: a section-form move whose moved
// text holds an import declaration is refused, "judged over the moved text
// as it stands, whatever the edits would leave" — the exact edits would
// carry the declaration into the target file, where its specifier resolves
// from that file's directory (2.1) and its binding may collide with one the
// file holds (14.15), while every origin-kept reference rooted at its
// binding would lose it (2.4), outcomes no rewrite of 6.5 covers — so such
// a section is movable once the declaration stands outside it. SPEC 14 and
// 12.7: one finding, locating each such declaration in the origin file by
// its own characters (the import range of 11.4), its `identities` empty,
// its `path` null; reported beside every other applicable reason and,
// unlike `refused-invalid-rewrite`, under no intrinsic-validity qualifier:
// an invalid `<new-id>` reports `refused-invalid-id` beside it.
//
// The fixture is T2.1-6's form — an ESM block inside a section element,
// parted from the tag line and from the body line by a blank line on each
// side, so it interrupts no paragraph and runs to its blank line (14.20):
// `<S id="m">`, U+000A, U+000A, `import X from "./x.xspec"`, U+000A, U+000A,
// `body {text(X.a)}`, U+000A, `</S>` — after a sibling `k`, so no pinned
// offset is the section's own. Everything staged is ASCII, so string
// lengths are byte counts (1.7). The pre-move `build` (exit 0) repeats
// T2.1-6's positive observation, so the refusal is the moved text's alone.
// The preview twins are T6.6-3's (the arms are exported for them).

const M17_ORIGIN = "specs/a.mdx";
const M17_TARGET = "specs/b.mdx";
const M17_X = "specs/x.mdx";
const M17_Y = "specs/y.mdx";
const M17_X_SOURCE = '<S id="a">\nA text.\n</S>\n';
const M17_Y_SOURCE = '<S id="b">\nB text.\n</S>\n';
/** The target: a flow-form section holding no ESM block, its last line terminated. */
const M17_TARGET_SOURCE = '<S id="p">\nx\n</S>\n';
const M17_X_SPECIFIER = canonicalSpecifier("specs", "specs/x.xspec");
const M17_X_DECLARATION = `import X from "${M17_X_SPECIFIER}"`;
const M17_Y_DECLARATION = `import Y from "${canonicalSpecifier("specs", "specs/y.xspec")}"`;
/** The sibling heading the origin (`<S id="k">z</S>`, U+000A): no pinned offset is the section's own. */
const M17_K = R16_K;
/** The moved section's opening tag and the blank line parting it from the block. */
const M17_OPENING = '<S id="m">\n\n';
const M17_ARGV = ["move", "specs/a.mdx#m", "specs/b.mdx#m"] as const;

/** The origin: the sibling, then the section holding `declarations` in its block, a blank line, and `body` (T2.1-6's form). */
function m17Origin(declarations: readonly string[], body: string): string {
  return `${M17_K}${M17_OPENING}${declarations.join("\n")}\n\n${body}\n</S>\n`;
}

/**
 * Each declaration's own characters in the origin file — the import range of
 * 11.4, its terminator excluded — in start order (SPEC 14, 12.7, 1.7).
 */
function m17Locations(declarations: readonly string[]): R16Location[] {
  const locations: R16Location[] = [];
  let start = Buffer.byteLength(`${M17_K}${M17_OPENING}`, "utf8");
  for (const declaration of declarations) {
    const end = start + Buffer.byteLength(declaration, "utf8");
    locations.push({ file: M17_ORIGIN, start, end });
    start = end + 1; // the declaration line's U+000A
  }
  return locations;
}

/** A section-form move refused as `refused-moved-import`: exit 1, nothing modified, the finding form-exact. */
export interface M17RefusedArm {
  readonly key: string;
  /** Why the moved text is refused, for the diagnoses. */
  readonly summary: string;
  /** The pre-move spec files, each deriving (the builder's S-9 check). */
  readonly files: Readonly<Record<string, string>>;
  readonly argv: readonly string[];
  /** The finding's `locations`: each declaration's own characters in the origin, in start order (SPEC 14, 11.4, 12.7). */
  readonly locations: readonly R16Location[];
  /** Every other applicable reason's code, reported beside (SPEC 14). */
  readonly beside?: readonly string[];
}

const M17_A_FILES: Readonly<Record<string, string>> = {
  [M17_ORIGIN]: m17Origin([M17_X_DECLARATION], "body {text(X.a)}"),
  [M17_TARGET]: M17_TARGET_SOURCE,
  [M17_X]: M17_X_SOURCE,
};

/** T6.5-17's refused arms, in the entry's order (exported for T6.6-3's preview twins). */
export const M17_REFUSED_ARMS: readonly M17RefusedArm[] = [
  {
    key: "(a) one declaration in the section's block",
    summary:
      "the moved text holds the block's one declaration, `import X from " +
      '"./x.xspec"`, which the moved body references through `X` ' +
      "(SPEC 6.5, 2.1)",
    files: M17_A_FILES,
    argv: [...M17_ARGV],
    locations: m17Locations([M17_X_DECLARATION]),
  },
  {
    key: "(b) two declarations on successive lines: two locations",
    summary:
      "the moved text holds two declarations, `import X …` and `import Y …` " +
      "on successive lines of the one block, each located by its own " +
      "characters in start order (SPEC 6.5, 14, 12.7)",
    files: {
      [M17_ORIGIN]: m17Origin(
        [M17_X_DECLARATION, M17_Y_DECLARATION],
        "body {text(X.a)} {text(Y.b)}",
      ),
      [M17_TARGET]: M17_TARGET_SOURCE,
      [M17_X]: M17_X_SOURCE,
      [M17_Y]: M17_Y_SOURCE,
    },
    argv: [...M17_ARGV],
    locations: m17Locations([M17_X_DECLARATION, M17_Y_DECLARATION]),
  },
  {
    key: "(c) an unused binding: the block's declaration referenced nowhere",
    summary:
      "the block's declaration binds `X`, referenced nowhere (a valid, " +
      "unused binding, SPEC 2.1), and the composition would otherwise be " +
      "well-formed — refused all the same, judged over the moved text as " +
      "it stands (SPEC 6.5)",
    files: {
      [M17_ORIGIN]: m17Origin([M17_X_DECLARATION], "body"),
      [M17_TARGET]: M17_TARGET_SOURCE,
      [M17_X]: M17_X_SOURCE,
    },
    argv: [...M17_ARGV],
    locations: m17Locations([M17_X_DECLARATION]),
  },
  {
    key: "(d) beside refused-invalid-id: the new ID `then`, no intrinsic-validity qualifier",
    summary:
      "(a)'s moved text under the `<new-id>` `then` — a forbidden segment " +
      "(SPEC 1.4) — reports `refused-invalid-id` and `refused-moved-import` " +
      "both: the reason is judged over the moved text as it stands, under no " +
      "intrinsic-validity qualifier, unlike `refused-invalid-rewrite` " +
      "(SPEC 6.5, 14)",
    files: M17_A_FILES,
    argv: ["move", "specs/a.mdx#m", "specs/b.mdx#then"],
    locations: m17Locations([M17_X_DECLARATION]),
    beside: ["refused-invalid-id"],
  },
];

// (e) the positive counterpart: the same workspace with the declaration
// moved to the file's top-level ESM block and a second reference through
// `X` standing outside the moved subtree (the sibling `k`), so the origin's
// declaration keeps a use. The move is performed: the origin's deletion
// leaves the sibling and the kept declaration byte-for-byte (its emptied
// line dropped with its terminator, 3); the moved text lands at the
// target's end after its final terminator (a line start, no terminator
// added) with its embedding re-rooted through an added binding of `x.mdx`'s
// module (T6.5-10's fourth direction); and the added declaration's
// admissible offsets, judged over the target as every other edit leaves it
// (SPEC 6.5), are: offset 0, absorbing the `<S id="p">` line (underivable);
// the `x` line's start and the `</S>` line's start, inside `p` (excluded);
// the end of the `</S>` line before its terminator, deriving yet mid-line
// (T6.5-13(h)'s forced placement, not taken while a line-start offset is
// admissible); the pre-operation file's end, where the moved text lands,
// absorbing its `<S id="m">` line (underivable); the moved text's interior
// line starts, inside `m` (the blank line after its opening tag derives,
// heading a block inside `m` — excluded); and the file's end after the
// moved text's closing tag and terminator, deriving — the line-start
// admissible offset "the file's end after a final terminator included,
// taken over any other" (6.5: "the moved text's closing tag, U+000A, the
// declaration, U+000A — no empty line between"). The composition is
// therefore pinned, value-blind in the fresh identifier alone (read back
// off the declaration line, T6.5-13's reading); `check` and `build` clean.
const M17_CONTROL_ORIGIN_KEPT = `${M17_X_DECLARATION}\n\n<S id="k">z {text(X.a)}</S>\n`;
const M17_CONTROL_MOVED = '<S id="m">\n\nbody {text(X.a)}\n</S>';
const M17_CONTROL: R16ControlArm = {
  key: "(e) control: the declaration in the top-level block, a second reference outside the moved subtree",
  summary:
    "the origin keeps its declaration byte-for-byte for the sibling's " +
    "remaining use and loses the moved construct with its line; the target " +
    "gains the moved text after its final terminator, the embedding " +
    "re-rooted through an added binding of `x.mdx`'s module, the " +
    "declaration on the line after the moved text's closing tag — the one " +
    "line-start admissible offset (SPEC 6.5, 2.1, 3, 14.20)",
  files: {
    [M17_ORIGIN]: `${M17_CONTROL_ORIGIN_KEPT}${M17_CONTROL_MOVED}\n`,
    [M17_TARGET]: M17_TARGET_SOURCE,
    [M17_X]: M17_X_SOURCE,
  },
  argv: [...M17_ARGV],
  expected: { [M17_ORIGIN]: M17_CONTROL_ORIGIN_KEPT },
  added: {
    rel: M17_TARGET,
    specifier: M17_X_SPECIFIER,
    compose: (ident) =>
      `${M17_TARGET_SOURCE}<S id="m">\n\nbody {text(${ident}.a)}\n</S>\nimport ${ident} from "${M17_X_SPECIFIER}"\n`,
  },
};

/**
 * Every MDX form T6.5-17 stages or asserts as the control's result, for the
 * S-9 self-test: each refused arm's files (T2.1-6's in-section block, which
 * derives), the control's files, its expected origin, and its target
 * composed with the identifier `X`.
 */
export const M17_FORM_VECTORS: ReadonlyArray<
  readonly [name: string, source: string]
> = [
  ...M17_REFUSED_ARMS.flatMap((arm) =>
    Object.entries(arm.files).map(
      ([rel, text]) => [`T6.5-17 ${arm.key}: ${rel} as staged`, text] as const,
    ),
  ),
  ...Object.entries(M17_CONTROL.files).map(
    ([rel, text]) =>
      [`T6.5-17 ${M17_CONTROL.key}: ${rel} as staged`, text] as const,
  ),
  ...Object.entries(M17_CONTROL.expected).map(
    ([rel, text]) =>
      [`T6.5-17 ${M17_CONTROL.key}: ${rel} after the move`, text] as const,
  ),
  [
    `T6.5-17 ${M17_CONTROL.key}: ${M17_CONTROL.added!.rel} after the move, composed with X`,
    M17_CONTROL.added!.compose("X"),
  ] as const,
];

/**
 * The refusal's report: exactly one finding per applicable reason —
 * `refused-moved-import` once per operation however many declarations the
 * moved text holds, plus the arm's `beside` reasons, none further — the
 * `refused-moved-import` finding's `locations` exactly each declaration's
 * own characters in the origin in start order, its `identities` exactly
 * `[]`, its `path` null (SPEC 6.5, 14, 11.4, 12.7).
 */
function m17AssertFinding(
  findings: readonly Finding[],
  arm: M17RefusedArm,
  context: string,
): void {
  const expectedCodes = ["refused-moved-import", ...(arm.beside ?? [])];
  const actualCodes = r16Codes(findings);
  if (!r16SameCodes(actualCodes, expectedCodes)) {
    fail(
      `${context}: the report holds exactly one finding per applicable ` +
        `reason — ${JSON.stringify(expectedCodes)}, \`refused-moved-import\` ` +
        `once per operation however many declarations the moved text ` +
        `holds, reported beside every other applicable reason and under no ` +
        `intrinsic-validity qualifier — ${arm.summary} (SPEC 6.5, 14, ` +
        `12.7); got ${JSON.stringify(actualCodes)}`,
    );
  }
  const finding = findings.find(
    (candidate) => candidate.code === "refused-moved-import",
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
        `[${r16RenderLocations(arm.locations)}] — each import declaration ` +
        `the moved text holds, by its own characters in the origin file ` +
        `(the import range of 11.4, its terminator excluded), in start ` +
        `order, in pre-operation coordinates (SPEC 14, 11.4, 1.7, 12.7); ` +
        `got [${actualRendered}] (message: ${JSON.stringify(finding.message)})`,
    );
  }
  assertFindingIdentities(
    finding,
    [],
    `${context}: the finding's \`identities\` — empty: the reason concerns ` +
      `no identity (SPEC 14, 12.7)`,
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

async function runM17RefusedArm(
  product: ProductBinding,
  arm: M17RefusedArm,
): Promise<void> {
  const context = `T6.5-17 ${arm.key}`;
  const command = arm.argv.join(" ");
  await withWorkspace(arm.files, async (workspace) => {
    // Premise: the pre-move workspace is valid (6.4's precondition), the
    // in-section block deriving (T2.1-6's positive observation repeated),
    // so the refusal is the moved text's alone; the build also lays down
    // the derived files the compare below covers.
    await buildOk(
      product,
      workspace,
      `${context} \`build\` over the staging — the pre-move workspace is ` +
        `valid, the section's ESM block deriving inside it (SPEC 6.4, 6.5, ` +
        `14.20; T2.1-6)`,
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
        m17AssertFinding(findings, arm, context);
      },
      `${context}: \`${command}\` refused — modifies nothing: every source ` +
        `and derived file byte-identical, the journal absent or ` +
        `byte-unchanged (SPEC 6.5, 14)`,
    );
  });
}

const T6_5_17 = defineProductTest({
  id: "T6.5-17",
  title:
    "refused-moved-import: a section-form move whose moved text holds an import declaration is refused, judged over the moved text as it stands, whatever the edits would leave — exit 1, nothing modified (the workspace byte-compared, the journal absent or byte-unchanged), exactly one `refused-moved-import` finding whose `locations` are each such declaration's own characters in the origin file (the import range of 11.4) in start order, its `identities` exactly [], its `path` null — from a valid pre-move workspace whose origin section holds T2.1-6's blank-line-separated ESM block (the pre-move `build` exit 0 repeating that positive observation): (a) one declaration in the block; (b) two, `import X …` and `import Y …` on successive lines, two locations; (c) an unused binding, the block's declaration referenced nowhere, refused all the same; (d) reported beside every other applicable reason and under no intrinsic-validity qualifier — the `<new-id>` `then` reports `refused-invalid-id` and `refused-moved-import` both; and (e) the positive counterpart performed: the declaration in the file's top-level block and a second reference through `X` in a sibling, the move succeeding with the moved embedding re-rooted through an added binding of `x.mdx`'s module in the target, placed at the one line-start admissible offset after the moved text's closing tag, the origin's declaration kept byte-for-byte for its remaining use, `check` and `build` clean (SPEC 6.5, 14, 11.4, 12.7, 2.1, 3)",
  run: async (product) => {
    for (const arm of M17_REFUSED_ARMS) {
      await runM17RefusedArm(product, arm);
    }
    await runR16ControlArm(product, M17_CONTROL, "T6.5-17");
  },
});

// ---------------------------------------------------------------------------
// T6.5-18: shadow-aware binding choice. SPEC 6.5 roots a rewritten spelling
// at a binding the file already holds only where no local declaration
// shadows it at the occurrence (4.5) — "one the file already holds that no
// local declaration shadows at the occurrence" — and otherwise, the file
// holding none, at the binding of the declaration the operation adds, an
// import being added exactly where the file lacks a binding the spelling is
// rooted at. T6.5-7's TS arm exercises the unshadowed choice (the existing
// target binding used, no import added); this test the shadowed one, whose
// wrong outcome is silent to the product alone: a product rooting by name at
// the shadowed `T` rewrites the marker to `T.y`, adds no import, and records
// no edge from `f` — a chain rooted at a local declaration is no spec
// reference (4.5): no finding, no staleness, a dropped edge behind a
// reported success — its `T.y` a consumer type error besides.
//
// Fixture: `specs/origin.mdx` holding `x` (beside a kept sibling `w`, so the
// origin stays a non-empty file after the deletion — a staging choice the
// entry leaves open), `specs/target.mdx` holding `z`, and `src/c.ts`
// importing both modules, holding a module-scope marker `T.z` and a function
// `f` holding `const T = 1` beside the marker `O.x`: the inner-scope `T`
// shadows the import within `f` (T4.5-4) and is no same-scope collision of
// 14.15 (T4.5-8); `O.x` resolves through the unshadowed `O`. Everything
// staged is ASCII, so string lengths are byte counts (1.7). After
// `move specs/origin.mdx#x specs/target.mdx#y` the marker, standing in `f`,
// is rooted at no binding of the target module the file holds unshadowed
// there — `T` is shadowed — so a declaration binding a fresh `<F>` is added
// (its value unpinned, 6.5's latitude; equal to `T` under no reading, the
// module-scope import and the local of `f` both binding it — 6.5's
// freshness spanning the local, T6.5-9), the marker's occurrence span (5.7:
// the bare chain, exclusive of the `;`) is replaced by `<F>.y`, and the
// origin declaration, its only use gone, is removed with its line (3).

const A18_ORIGIN = "specs/origin.mdx";
const A18_TARGET = "specs/target.mdx";
const A18_APP = "src/c.ts";
const A18_TARGET_MODULE = "specs/target.xspec";
const A18_ARGV = ["move", "specs/origin.mdx#x", "specs/target.mdx#y"] as const;

const A18_ORIGIN_BEFORE = [
  '<S id="x">',
  "Origin x text.",
  "</S>",
  "",
  '<S id="w">',
  "Kept w text.",
  "</S>",
  "",
].join("\n");

// Composed from SPEC 6.5 and 3: the moved construct's own characters are
// deleted in place; the line that deletion leaves empty is dropped with its
// terminator; the blank line after it was blank before the deletion and
// stays, so the file opens with that terminator (T6.5-12's removal arm).
const A18_ORIGIN_AFTER = ["", '<S id="w">', "Kept w text.", "</S>", ""].join(
  "\n",
);

const A18_TARGET_BEFORE = ['<S id="z">', "Target z text.", "</S>", ""].join(
  "\n",
);

// Composed from SPEC 6.5: a top-level `y`, so the moved text — re-identified
// by prefix replacement `x` → `y` — is inserted at the end of the file,
// followed by U+000A; the final line is terminated, so the insertion point
// lies at a line start and no preceding U+000A is added (T6.5-8's TS arm).
const A18_TARGET_AFTER = [
  '<S id="z">',
  "Target z text.",
  "</S>",
  '<S id="y">',
  "Origin x text.",
  "</S>",
  "",
].join("\n");

const A18_ORIGIN_DECLARATION = 'import O from "../specs/origin.xspec";';
const A18_TARGET_DECLARATION = 'import T from "../specs/target.xspec";';
/** The marker in `f`: the bare chain, its occurrence span (SPEC 5.7). */
const A18_MARKER = "O.x";

/**
 * `src/c.ts` around its two variable parts: the origin declaration on its
 * own first line (present before the move, removed by it) and the marker in
 * `f` (`O.x` before, `<F>.y` after). Everything else stands byte-for-byte:
 * the `T` import, the module-scope marker `T.z`, the local `const T = 1`.
 */
function a18App(originImport: boolean, marker: string): string {
  return [
    ...(originImport ? [A18_ORIGIN_DECLARATION] : []),
    A18_TARGET_DECLARATION,
    "",
    "T.z;",
    "",
    "function f() {",
    "  const T = 1;",
    `  ${marker};`,
    "}",
    "",
  ].join("\n");
}

const A18_APP_BEFORE = a18App(true, A18_MARKER);

/**
 * `src/c.ts`'s expected post-move bytes WITHOUT the added import (SPEC
 * 6.4/6.5, 3): the origin declaration removed with its line — its own
 * characters deleted in place leave the line empty, so it is dropped with
 * its terminator — the marker re-rooted at the fresh binding with dot access
 * (`y` is identifier-valid), its `;` outside the span kept, the `T`
 * declaration and `T.z` byte-for-byte.
 */
const a18AppBase = (root: string): string => a18App(false, `${root}.y`);

/** The origin declaration's removal range: its characters and the line's terminator (SPEC 6.5, 3; 6.6). */
const A18_REMOVAL_END = A18_ORIGIN_DECLARATION.length + 1;
/** The marker's occurrence span in pre-operation coordinates (SPEC 5.7; `O.x` occurs once). */
const A18_MARKER_START = A18_APP_BEFORE.indexOf(A18_MARKER);
const A18_MARKER_END = A18_MARKER_START + A18_MARKER.length;

// The rewritten marker: a root not preceded by an identifier character or a
// `.`, then `.y;` (`T.z;` and the declarations never match).
const A18_APP_REWRITTEN = /(?<![A-Za-z0-9_$.])([A-Za-z_$][A-Za-z0-9_$]*)\.y;/g;

/** Before the move: `O.x` through the unshadowed `O`, attributed to `f` (4.6); `T.z` to the file. */
const A18_EDGES_BEFORE: readonly GraphEdge[] = [
  { from: `${A18_APP}#f`, to: `${A18_ORIGIN}#x`, kind: "references" },
  { from: A18_APP, to: `${A18_TARGET}#z`, kind: "references" },
];

/** After the move: the marker through the fresh binding, under the moved node's new identity. */
const A18_EDGES_AFTER: readonly GraphEdge[] = [
  { from: `${A18_APP}#f`, to: `${A18_TARGET}#y`, kind: "references" },
  { from: A18_APP, to: `${A18_TARGET}#z`, kind: "references" },
];

/** Every MDX form T6.5-18 stages or asserts as the move's result (S-9). */
export const A18_FORM_VECTORS: ReadonlyArray<
  readonly [name: string, source: string]
> = [
  [`T6.5-18: ${A18_ORIGIN} as staged`, A18_ORIGIN_BEFORE],
  [`T6.5-18: ${A18_TARGET} as staged`, A18_TARGET_BEFORE],
  [`T6.5-18: ${A18_ORIGIN} after the move`, A18_ORIGIN_AFTER],
  [`T6.5-18: ${A18_TARGET} after the move`, A18_TARGET_AFTER],
];

/**
 * The identifier the rewritten marker is rooted at — the value-unpinned
 * fresh binding (SPEC 6.5), read off the one place 6.4's pinned spelling
 * makes it observable; diagnosed when the marker is not spelled as 6.4 pins
 * it or is rewritten more or less than once.
 */
function a18RewrittenMarkerRoot(text: string, context: string): string {
  const matches = [...text.matchAll(A18_APP_REWRITTEN)];
  const root = matches.length === 1 ? matches[0]?.[1] : undefined;
  if (root === undefined) {
    fail(
      `${context}: ${A18_APP} after the move must hold exactly one marker ` +
        `\`<binding>.y;\` — the marker on the moved node rewritten, over ` +
        `its occurrence span (5.7), to the moved node's new identity through ` +
        `a binding of the target module in 6.4's pinned spelling (dot ` +
        `access, \`y\` being identifier-valid; SPEC 6.5, 6.4); found ` +
        `${String(matches.length)} in ${JSON.stringify(text)}`,
    );
  }
  return root;
}

/**
 * The pre-operation offsets at which an import addition composes to
 * `composedOffset` in the rewritten file (SPEC 6.5, 6.6): each edited range
 * is replaced whole, an addition's offset lies strictly inside none, and an
 * insertion at an offset where an edit's range ends stands after that
 * edit's result, where one begins, before it — so the removal's start and
 * its end are two pre-operation offsets for one composed position
 * (T6.6-4(b)'s latitude, T6.5-13(i)/(k)), while past the marker's rewrite
 * the composed text differs by the spelling's length difference.
 */
function a18PreOperationOffsets(
  composedOffset: number,
  rewritten: string,
): readonly number[] {
  const delta = rewritten.length - A18_MARKER.length;
  const offsets: number[] = [];
  for (let p = 0; p <= A18_APP_BEFORE.length; p += 1) {
    const insideRemoval = p > 0 && p < A18_REMOVAL_END;
    const insideRewrite = p > A18_MARKER_START && p < A18_MARKER_END;
    if (insideRemoval || insideRewrite) continue;
    let composed: number;
    if (p <= A18_REMOVAL_END) composed = 0;
    else if (p <= A18_MARKER_START) composed = p - A18_REMOVAL_END;
    else composed = p - A18_REMOVAL_END + delta;
    if (composed === composedOffset) offsets.push(p);
  }
  return offsets;
}

/**
 * `src/c.ts`'s preview edits given the addition's pre-operation offset:
 * the `import-removal` spanning the origin declaration with its adjunct
 * drop, the `import-addition` zero-length at that offset, and the
 * `reference-rewrite` spanning the marker — in 12.7's order: range start,
 * then range end, then class-name bytes (SPEC 6.6, 12.7; T6.6-4).
 */
function a18PreviewEdits(addition: number): readonly PreviewEdit[] {
  const edits: PreviewEdit[] = [
    { class: "import-removal", range: { start: 0, end: A18_REMOVAL_END } },
    { class: "import-addition", range: { start: addition, end: addition } },
    {
      class: "reference-rewrite",
      range: { start: A18_MARKER_START, end: A18_MARKER_END },
    },
  ];
  return edits.sort(
    (a, b) =>
      a.range.start - b.range.start ||
      a.range.end - b.range.end ||
      Buffer.compare(
        Buffer.from(a.class, "utf8"),
        Buffer.from(b.class, "utf8"),
      ),
  );
}

/** The preview's entry for `src/c.ts`, taken before the real move (SPEC 6.6: a preview modifies nothing). */
async function a18PreviewEntry(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
): Promise<PreviewFileEntry> {
  const label = `${context} \`${A18_ARGV.join(" ")} --preview --json\` before the real move`;
  const report = decodePreviewReport(
    await runJson(
      product,
      workspace,
      [...A18_ARGV, "--preview", "--json"],
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
  const entry = report.files.find((candidate) => candidate.file === A18_APP);
  if (entry === undefined) {
    fail(
      `${label}: \`files\` holds an entry for ${A18_APP}, a file the ` +
        `operation rewrites — its marker rewrite, import addition, and ` +
        `import removal (SPEC 6.6, 12.7); got ` +
        `[${report.files.map((candidate) => JSON.stringify(candidate.file)).join(", ")}]`,
    );
  }
  return entry;
}

/**
 * Preview parity (SPEC 6.6, 12.7): `src/c.ts`'s edits are exactly one
 * `reference-rewrite` spanning the marker, one `import-addition` at the
 * offset the real operation then used — either pre-operation offset where
 * the composed position admits two — and one `import-removal` spanning the
 * origin declaration with its adjunct drop, in 12.7's order.
 */
function a18AssertPreviewEdits(
  entry: PreviewFileEntry,
  candidates: readonly (readonly PreviewEdit[])[],
  context: string,
): void {
  const actual = entry.edits.map((edit) => ({
    class: edit.class,
    range: { start: edit.range.start, end: edit.range.end },
  }));
  const shown = JSON.stringify(actual);
  if (candidates.some((candidate) => JSON.stringify(candidate) === shown)) {
    return;
  }
  fail(
    `${context} preview: ${A18_APP}'s edits are exactly ` +
      candidates.map((candidate) => JSON.stringify(candidate)).join(" or ") +
      ` — one \`reference-rewrite\` spanning the marker's occurrence (5.7), ` +
      `one \`import-addition\` zero-length at the pre-operation offset the ` +
      `real operation then used (the removal's start and its end composing ` +
      `to one position, T6.6-4(b)), one \`import-removal\` spanning the ` +
      `origin declaration with its adjunct drop, ordered by range start, ` +
      `then range end, then class-name bytes (SPEC 6.6, 12.7; T6.6-4); ` +
      `got ${shown}`,
  );
}

const T6_5_18 = defineProductTest({
  id: "T6.5-18",
  title:
    "shadow-aware binding choice: over `specs/origin.mdx` holding `x`, `specs/target.mdx` holding `z`, and `src/c.ts` importing both modules (`O`, `T`) with a module-scope marker `T.z` and a function `f` holding `const T = 1` beside the marker `O.x` — a valid workspace (`build --json` clean, the file compiling clean under standard tooling, the `references` edges `src/c.ts#f` → `specs/origin.mdx#x` and `src/c.ts` → `specs/target.mdx#z`) — `move specs/origin.mdx#x specs/target.mdx#y` roots the rewritten marker at no binding of the target module the file holds unshadowed at the occurrence (`T` is shadowed in `f`, SPEC 4.5) and so adds a declaration binding a fresh `<F>` (value unpinned, never `T`): asserted under T6.5-8's diff-isolated discipline against the file composed without the added import — the single added byte run exactly `import <F> from \"../specs/target.xspec\"` followed by U+000A at a line-start offset, `<F>` read off the rewritten marker, the marker's occurrence span (5.7) replaced by `<F>.y`, the origin declaration removed with its line (3), the `T` declaration and `T.z` byte-for-byte, no other byte changed — the origin and target files byte-equal to their compositions; the `--preview` taken before the move reporting for `src/c.ts` exactly one `reference-rewrite` spanning the marker, one `import-addition` at the offset the real operation then used, and one `import-removal` spanning the origin declaration with its adjunct drop (6.6, 12.7; T6.6-4); then `query edges` reporting `src/c.ts#f` → `specs/target.mdx#y` beside `T.z`'s edge as before, `check --json` and `build --json` clean (no 14.7, no 14.15: two imports of one module under distinct identifiers collide with nothing), and the file compiling clean (H-2) — a product rooting by name at the shadowed `T` rewrites the marker to `T.y`, adds no import, and records no edge from `f`, silent to itself (SPEC 6.5, 4.5, 2.1, 3, 5.7, 6.6, 12.7)",
  run: async (product) => {
    const context = "T6.5-18";
    await withWorkspace(
      {
        [A18_ORIGIN]: A18_ORIGIN_BEFORE,
        [A18_TARGET]: A18_TARGET_BEFORE,
        [A18_APP]: A18_APP_BEFORE,
      },
      async (workspace) => {
        // Premise: a valid workspace — the inner-scope `T` shadows the
        // import within `f` and is no same-scope collision (14.15), `O.x`
        // resolves through the unshadowed `O` — so a later failure is the
        // move's, not the staging's.
        await expectFindingFreeReport(
          product,
          workspace,
          ["build", "--json"],
          `${context} premise \`build --json\` over the staging — clean: ` +
            `the local \`const T = 1\` in \`f\` shadows the import there ` +
            `(SPEC 4.5; T4.5-4) and is no same-scope collision of 14.15 ` +
            `(T4.5-8), and \`O.x\` resolves through the unshadowed \`O\``,
        );
        // Fixture self-check through H-2's standard-tooling channel: the
        // staging compiles clean, so a later diagnostic is the move's.
        assertNoCompileErrors(
          await ConsumerProject.load({
            rootDir: workspace.root,
            rootFiles: [A18_APP],
          }),
          `${context} premise: ${A18_APP} compiles clean before the move ` +
            `under standard tooling — the shadowing local is valid ` +
            `TypeScript and the generated modules resolve (SPEC 4, 13.1; a ` +
            `fixture self-check)`,
        );
        assertEdgeSetEqual(
          await queryEdgesOfKind(product, workspace, "references", context),
          A18_EDGES_BEFORE,
          `${context} premise: the complete \`references\` edge set before ` +
            `the move — \`O.x\` through the unshadowed \`O\`, attributed ` +
            `to \`f\`, and \`T.z\` attributed to the file (SPEC 4.5, 4.6, ` +
            `5.2)`,
        );

        // The preview first: it modifies nothing (6.6), and its edits for
        // `src/c.ts` are asserted once the real operation's offset is known.
        const previewEntry = await a18PreviewEntry(product, workspace, context);

        await expectExit(
          product,
          workspace,
          [...A18_ARGV],
          0,
          `${context} \`${A18_ARGV.join(" ")}\` — a valid move over the ` +
            `workspace the premise \`build\` accepted succeeds (SPEC 6.5)`,
        );

        const actual = await workspace.readBytes(A18_APP);
        const text = Buffer.from(actual).toString("utf8");
        const root = a18RewrittenMarkerRoot(text, context);
        if (root === "T") {
          fail(
            `${context}: the marker in \`f\` is rewritten to \`T.y\` — ` +
              `rooted by name at \`T\`, which the local \`const T = 1\` ` +
              `shadows at the occurrence, so the chain is no spec reference ` +
              `(SPEC 4.5): 6.5 roots a rewritten spelling at a binding the ` +
              `file already holds only where no local declaration shadows ` +
              `it at the occurrence, and otherwise at the binding of the ` +
              `declaration it adds — a fresh identifier equal to \`T\` ` +
              `under no reading, the module-scope import and the local of ` +
              `\`f\` both binding it (SPEC 6.5, 2.1; T6.5-9); the file reads ` +
              `${JSON.stringify(text)}`,
          );
        }
        // T6.5-8's diff-isolated discipline: the file composed without the
        // added import, the single added run isolated by diff and read at
        // every admissible offset, a line-start one alone accepted.
        const reading = assertAddedImportInsertion(
          {
            rel: A18_APP,
            base: Buffer.from(a18AppBase(root), "utf8"),
            actual,
            importerDir: "src",
            expectedModule: A18_TARGET_MODULE,
            identifier: root,
          },
          `${context}: ${A18_APP} after the move is its composed post-move ` +
            `bytes — the origin declaration removed with its line (its only ` +
            `use gone; SPEC 6.5, 3), the marker's occurrence span replaced ` +
            `by \`${root}.y\` (5.7), the \`T\` declaration and \`T.z\` ` +
            `byte-for-byte — with exactly one import of the target module ` +
            `added as a line of its own: byte-exactly 6.5's spelling ` +
            `(single spaces, no statement terminator, the specifier ` +
            `double-quoted in its canonical relative spelling from src/) ` +
            `followed by U+000A at a line-start offset, binding the fresh ` +
            `identifier the rewritten marker is rooted at, no other byte ` +
            `changed (SPEC 6.5, 2.1, 6.4, 3; T6.5-8)`,
        );
        await assertFileBytes(
          workspace.path(A18_ORIGIN),
          A18_ORIGIN_AFTER,
          `${context}: ${A18_ORIGIN} after the move — the moved construct ` +
            `deleted in place, the line its deletion empties dropped with ` +
            `its terminator, the blank line that was blank before kept, the ` +
            `sibling untouched (SPEC 6.5, 3; H-4, normalizing nothing)`,
        );
        await assertFileBytes(
          workspace.path(A18_TARGET),
          A18_TARGET_AFTER,
          `${context}: ${A18_TARGET} after the move — the re-identified ` +
            `moved text appended after the final terminator plus U+000A, ` +
            `otherwise byte-identical (SPEC 6.5; H-4, normalizing nothing)`,
        );

        // Preview parity: the addition's offset is the one the real
        // operation used, mapped back to pre-operation coordinates.
        a18AssertPreviewEdits(
          previewEntry,
          a18PreOperationOffsets(reading.offset, `${root}.y`).map(
            a18PreviewEdits,
          ),
          context,
        );

        assertEdgeSetEqual(
          await queryEdgesOfKind(product, workspace, "references", context),
          A18_EDGES_AFTER,
          `${context}: the complete \`references\` edge set after the move ` +
            `— the rewritten marker reported from \`src/c.ts#f\` under the ` +
            `moved node's new identity through the fresh binding, beside ` +
            `\`T.z\`'s edge as before the move; a chain rooted by name at ` +
            `the shadowed \`T\` records no edge (SPEC 6.5, 4.5, 4.6, 5.2)`,
        );
        await assertCleanAfterMove(
          product,
          workspace,
          "the added import and the rewritten marker resolve (no 14.7), " +
            "and two imports binding one module under distinct identifiers " +
            "collide with nothing (2.1, 14.15)",
          context,
        );
        // A fresh project: the language service snapshots files on first
        // access, and the move rewrote them.
        assertNoCompileErrors(
          await ConsumerProject.load({
            rootDir: workspace.root,
            rootFiles: [A18_APP],
          }),
          `${context}: ${A18_APP} after the move compiles with no ` +
            `diagnostics under standard tooling — the added import binds an ` +
            `identifier colliding with no binding of the file (TS2440, ` +
            `TS2300), and the rewritten marker resolves against the ` +
            `regenerated modules through it, never through the local ` +
            `\`const T = 1\` (SPEC 6.5, 4.5; H-2)`,
        );
      },
      SPEC_AND_CODE_CONFIG,
    );
  },
});

// ---------------------------------------------------------------------------
// T6.5-19 The in-section exclusion
// ---------------------------------------------------------------------------
//
// SPEC 6.5: in a spec source an admissible offset is one at which the file,
// as every edit of the rewrite leaves it, is well-formed with the added line
// an import declaration of an ESM block standing inside no section
// construct of the file so left, the inserted one included. An ESM block
// derives inside a section element (14.20; T2.1-6), so derivability does
// not decide the exclusion — and no arm of T6.5-13 or T6.5-16(g) does
// either: each in-section line start there also absorbs the following line
// or follows a paragraph line, and the in-section offsets that derive are
// mid-line, never preferred. Each receiving file here holds exactly one
// line start at which the added line derives as a declaration — inside a
// section, at the start of an interior empty line — and exactly one
// admissible offset, mid-line at the file's end, so the two readings take
// different offsets: a product judging admissibility by derivability and
// T6.5-13(l)'s exclusion alone, then applying the line-start preference,
// inserts at the empty line's start — the workspace valid, `check` clean,
// every node's own content as it was, the declaration's line dropping
// whole (3) — and fails the byte contract and the preview's offset while
// passing T6.5-13 whole. (a) judges the target file; (b) the origin file as
// its deletion leaves it ("of the file so left"), the declaration it
// asserts being the origin's own (T6.5-13(i)'s conversion). Both arms are
// composed and observed as T6.5-13's are (`runA13Arm`): value-blind in the
// fresh identifier alone, the receiving root's own text and ownHash through
// `query node` before and after, the real bytes agreeing with the preview's
// offsets (T6.6-4(b)), `build` and `check` clean after each move. Every
// form here derives under the grammar 14.20 fixes (S-9), the excluded
// in-section forms included: the entry's named offsets are probed under
// `deriveMdx` before the move — the in-section and paragraph-text forms
// deriving, the absorbing ones not — a staging premise (a
// `HarnessStagingError`), never a verdict.

/** (a)'s target: an interior empty line inside `p`, the `</S>` line unterminated. */
const A19_A_TARGET = ['<S id="p">', "", "x", "</S>"].join("\n");
/** (a)'s target as the target insertion alone leaves it, the declaration absent (6.5's composed text; the identifier `X`). */
const A19_A_COMPOSED = [
  '<S id="p">',
  "",
  "x",
  ...a13MovedLines("p.n", "X"),
  "</S>",
].join("\n");
const A19_A_DECLARATION = a13Declaration("X");
/** The end of (a)'s tag line before its terminator; the empty line starts one byte on, the `x` line two. */
const A19_A_TAG_END = A19_A_COMPOSED.indexOf("\n");

/** (a)'s composition: the moved text before `</S>`, the tag's line ended by the added terminator, then the declaration. */
function a19ComposeIntoP(ident: string): string {
  return [
    '<S id="p">',
    "",
    "x",
    ...a13MovedLines("p.n", ident),
    "</S>",
    a13Declaration(ident),
    "",
  ].join("\n");
}

const A19_A_ARM: A13Arm = a13CrossArm({
  key: "(a)",
  summary:
    "the target side — offset 0 would absorb the tag's line into the " +
    "block; the start of the empty line heads a block that empty line " +
    "ends, deriving inside `p`: a line start, yet inadmissible; the end of " +
    "the tag's line heads such a block too, mid-line; the start of the `x` " +
    "line would absorb that line; the end of the `x` line leaves the added " +
    "line paragraph text; at the start of the `</S>` line, the insertion " +
    "point, the declaration would stand after the moved text and absorb " +
    "the `</S>` line; so the file's end, mid-line after `</S>`, is the " +
    "only admissible offset: the added terminator ends the `</S>` line, " +
    "which drops as it did before, then the declaration and its terminator",
  target: A19_A_TARGET,
  newId: "p.n",
  compose: a19ComposeIntoP,
  previewEdits: [
    a13At("target-insertion", A19_A_TARGET.indexOf("</S>")),
    a13At("import-addition", A19_A_TARGET.length),
  ],
  ownTextBefore: "",
  ownTextAfter: "",
  ownHashChanges: false,
});

// (b): the origin `<S id="m">`, U+000A, `z`, U+000A, `</S>`, U+000A,
// `<S id="a" d={"m"}>`, U+000A, U+000A, `y`, U+000A, `</S>` with no final
// terminator; `m` moved to the top level of an existing target needing no
// declaration (the moved text local to its subtree), its ID kept; the
// origin's own `d={"m"}` converts to `d={<T>.m}` through the target
// module's declaration the origin lacks. The deletion's range runs from the
// file's start through line 3's terminator — the construct's own
// characters and the terminator of the line their removal leaves empty
// (SPEC 3, 6.6) — leaving `<S id="a" d={<T>.m}>`, U+000A, U+000A, `y`,
// U+000A, `</S>`, over which the file's end is the only admissible offset.
const A19_B_MOVED = ['<S id="m">', "z", "</S>"].join("\n");
const A19_B_ORIGIN_BEFORE = [
  A19_B_MOVED,
  '<S id="a" d={"m"}>',
  "",
  "y",
  "</S>",
].join("\n");
/** The origin deletion's end: the construct's own characters plus line 3's terminator. */
const A19_B_DELETION_END = A19_B_MOVED.length + 1;
/** The `d` reference occurrence: that one reference's own expression, `"m"` (SPEC 5.7). */
const A19_B_REFERENCE = A19_B_ORIGIN_BEFORE.indexOf('d={"m"}') + 3;
const A19_B_TARGET_AFTER = `${A13_EXISTING_TARGET}${A19_B_MOVED}\n`;
/** (b)'s origin as the deletion and the reference rewrite leave it, the declaration absent (the identifier `X`). */
const A19_B_COMPOSED = ['<S id="a" d={X.m}>', "", "y", "</S>"].join("\n");
const A19_B_DECLARATION = a13Declaration("X", A13_TARGET_SPECIFIER);
/** The end of (b)'s tag line before its terminator; the empty line starts one byte on, the `y` line two. */
const A19_B_TAG_END = A19_B_COMPOSED.indexOf("\n");

/** (b)'s composition: the converted reference, the `</S>` line ended by the added terminator, then the target module's declaration. */
function a19ComposeOriginDeclaration(
  idents: readonly string[],
): readonly string[] {
  const [t = ""] = idents;
  return [
    [
      `<S id="a" d={${t}.m}>`,
      "",
      "y",
      "</S>",
      a13Declaration(t, A13_TARGET_SPECIFIER),
      "",
    ].join("\n"),
  ];
}

const A19_B_ARM: A13Arm = {
  key: "(b)",
  summary:
    "the origin side, `of the file so left` — over the origin as the " +
    "deletion leaves it, the composed file's start would absorb the tag's " +
    "line into the block; the start of the empty line heads a block that " +
    "line ends, deriving inside `a`: a line start, yet inadmissible; the " +
    "end of the tag's line heads such a block mid-line; the start of the " +
    "`y` line would absorb that line; the end of the `y` line and the " +
    "start of the `</S>` line each leave the added line paragraph text; so " +
    "the file's end, mid-line after `</S>`, is the only admissible offset: " +
    "the added terminator ends the `</S>` line, which drops as it did " +
    "before, then the target module's declaration and its terminator",
  files: {
    [A13_ORIGIN]: A19_B_ORIGIN_BEFORE,
    [A13_TARGET]: A13_EXISTING_TARGET,
  },
  argv: ["move", `${A13_ORIGIN}#m`, `${A13_TARGET}#m`],
  receiving: A13_ORIGIN,
  added: [A13_TARGET_SPECIFIER],
  compose: a19ComposeOriginDeclaration,
  others: [
    {
      rel: A13_TARGET,
      bytes: A19_B_TARGET_AFTER,
      reason:
        "the moved text appended at the file's end after its final " +
        "terminator — a line start, so none is added before it — followed " +
        "by its own, the ID kept",
    },
  ],
  previewEdits: [
    [
      a13Span("origin-deletion", 0, A19_B_DELETION_END),
      a13Span("reference-rewrite", A19_B_REFERENCE, A19_B_REFERENCE + 3),
      a13At("import-addition", A19_B_ORIGIN_BEFORE.length),
    ],
  ],
  root: {
    identity: A13_ORIGIN,
    ownTextBefore: "",
    ownTextAfter: "",
    ownHashChanges: true,
  },
};

/**
 * One arm of T6.5-19: T6.5-13's arm plus the entry's named offsets over the
 * receiving file as every other edit leaves it, each probed with the
 * declaration inserted per 6.5's terminator rule (`r16Declared`).
 */
interface A19Arm {
  readonly arm: A13Arm;
  /** The receiving file as every other edit of the rewrite leaves it, the declaration absent. */
  readonly composed: string;
  /** The entry's named offsets, each with the verdict it states. */
  readonly probes: readonly R16OffsetProbe[];
}

const A19_A: A19Arm = {
  arm: A19_A_ARM,
  composed: A19_A_COMPOSED,
  probes: [
    r16Probe(
      "offset 0, absorbing the tag's line into the block",
      A19_A_COMPOSED,
      0,
      false,
      A19_A_DECLARATION,
    ),
    r16Probe(
      "the end of the tag's line before its terminator, heading a block inside `p` (mid-line)",
      A19_A_COMPOSED,
      A19_A_TAG_END,
      true,
      A19_A_DECLARATION,
    ),
    r16Probe(
      "the start of the empty line, heading a block that line ends inside `p` (a line start, inadmissible)",
      A19_A_COMPOSED,
      A19_A_TAG_END + 1,
      true,
      A19_A_DECLARATION,
    ),
    r16Probe(
      "the start of the `x` line, absorbing that line",
      A19_A_COMPOSED,
      A19_A_TAG_END + 2,
      false,
      A19_A_DECLARATION,
    ),
    r16Probe(
      "the end of the `x` line, leaving the added line paragraph text",
      A19_A_COMPOSED,
      A19_A_TAG_END + 3,
      true,
      A19_A_DECLARATION,
    ),
    r16Probe(
      "the start of the `</S>` line after the moved text (the insertion point), absorbing the `</S>` line",
      A19_A_COMPOSED,
      A19_A_COMPOSED.lastIndexOf("</S>"),
      false,
      A19_A_DECLARATION,
    ),
    r16Probe(
      "the file's end, mid-line after `</S>` — the one admissible offset, the result",
      A19_A_COMPOSED,
      A19_A_COMPOSED.length,
      true,
      A19_A_DECLARATION,
    ),
  ],
};

const A19_B: A19Arm = {
  arm: A19_B_ARM,
  composed: A19_B_COMPOSED,
  probes: [
    r16Probe(
      "the composed file's start, absorbing the tag's line into the block",
      A19_B_COMPOSED,
      0,
      false,
      A19_B_DECLARATION,
    ),
    r16Probe(
      "the end of the tag's line before its terminator, heading a block inside `a` (mid-line)",
      A19_B_COMPOSED,
      A19_B_TAG_END,
      true,
      A19_B_DECLARATION,
    ),
    r16Probe(
      "the start of the empty line, heading a block that line ends inside `a` (a line start, inadmissible)",
      A19_B_COMPOSED,
      A19_B_TAG_END + 1,
      true,
      A19_B_DECLARATION,
    ),
    r16Probe(
      "the start of the `y` line, absorbing that line",
      A19_B_COMPOSED,
      A19_B_TAG_END + 2,
      false,
      A19_B_DECLARATION,
    ),
    r16Probe(
      "the end of the `y` line, leaving the added line paragraph text",
      A19_B_COMPOSED,
      A19_B_TAG_END + 3,
      true,
      A19_B_DECLARATION,
    ),
    r16Probe(
      "the start of the `</S>` line, leaving the added line paragraph text",
      A19_B_COMPOSED,
      A19_B_COMPOSED.lastIndexOf("</S>"),
      true,
      A19_B_DECLARATION,
    ),
    r16Probe(
      "the file's end, mid-line after `</S>` — the one admissible offset, the result",
      A19_B_COMPOSED,
      A19_B_COMPOSED.length,
      true,
      A19_B_DECLARATION,
    ),
  ],
};

const A19_ARMS: readonly A19Arm[] = [A19_A, A19_B];

/** The vectors of `entry`'s probes holding the verdict `derives`, named by arm, file, and offset. */
function a19ProbeVectors(
  entry: A19Arm,
  derives: boolean,
): readonly (readonly [name: string, source: string])[] {
  return entry.probes
    .filter((probe) => probe.derives === derives)
    .map(
      (probe) =>
        [
          `T6.5-19 ${entry.arm.key}: ${entry.arm.receiving} with the declaration at ${probe.name}`,
          probe.text,
        ] as const,
    );
}

/**
 * Every MDX form T6.5-19 stages, composes as the other edits leave a file,
 * or names as deriving — the excluded in-section forms included, the
 * exclusion, not derivability, deciding them (S-9).
 */
export const A19_FORM_VECTORS: ReadonlyArray<
  readonly [name: string, source: string]
> = [
  [`T6.5-19 (a): ${A13_ORIGIN} as staged`, A13_ORIGIN_BEFORE],
  [`T6.5-19 (a): ${A13_THIRD} as staged`, A13_THIRD_SOURCE],
  [`T6.5-19 (a): ${A13_TARGET} as staged`, A19_A_TARGET],
  [`T6.5-19 (a): ${A13_ORIGIN} after the move`, A13_ORIGIN_AFTER],
  [
    `T6.5-19 (a): ${A13_TARGET} as the target insertion leaves it`,
    A19_A_COMPOSED,
  ],
  ...a19ProbeVectors(A19_A, true),
  [`T6.5-19 (b): ${A13_ORIGIN} as staged`, A19_B_ORIGIN_BEFORE],
  [`T6.5-19 (b): ${A13_TARGET} as staged`, A13_EXISTING_TARGET],
  [`T6.5-19 (b): ${A13_TARGET} after the move`, A19_B_TARGET_AFTER],
  [
    `T6.5-19 (b): ${A13_ORIGIN} as the deletion and the reference rewrite leave it`,
    A19_B_COMPOSED,
  ],
  ...a19ProbeVectors(A19_B, true),
];

/**
 * Every offset T6.5-19 names as absorbing the line after it — offset 0, the
 * start of the body line, and (a)'s insertion point after the moved text —
 * heads a block that runs on into a tag or prose line: none derives (S-9).
 */
export const A19_UNDERIVABLE_VECTORS: ReadonlyArray<
  readonly [name: string, source: string]
> = [...a19ProbeVectors(A19_A, false), ...a19ProbeVectors(A19_B, false)];

/** A form the entry names as absorbing must not derive (S-9): a staging defect, never a verdict. */
function a19AssertUnderivable(text: string, rel: string, key: string): void {
  if (!deriveMdx(text).derives) return;
  throw new HarnessStagingError(
    "mdx-derivability",
    rel,
    `T6.5-19 ${key}: ${rel} derives under the stock MDX 3 grammar, where ` +
      `the entry names the offset as absorbing the line after it — the ` +
      `arm's premise, not a product verdict; the text reads ${JSON.stringify(text)}`,
  );
}

/**
 * The entry's premises (S-9): the receiving file as every other edit
 * leaves it derives, and each named offset holds the verdict the entry
 * states — the in-section and paragraph-text forms deriving, the absorbing
 * ones not. A contradiction is a staging defect, never a verdict.
 */
function a19AssertPremises(entry: A19Arm): void {
  const rel = entry.arm.receiving;
  r16AssertDerives(
    entry.composed,
    `${rel} as every other edit leaves it`,
    entry.arm.key,
    "T6.5-19",
  );
  for (const probe of entry.probes) {
    const where = `${rel} with the declaration at ${probe.name}`;
    if (probe.derives) {
      r16AssertDerives(probe.text, where, entry.arm.key, "T6.5-19");
    } else {
      a19AssertUnderivable(probe.text, where, entry.arm.key);
    }
  }
}

const T6_5_19 = defineProductTest({
  id: "T6.5-19",
  title:
    "the in-section exclusion: in a spec source 6.5 admits only an offset whose added declaration's ESM block stands inside no section construct of the file as every edit of the rewrite leaves it, the inserted one included — an ESM block derives inside a section element (14.20), so derivability does not decide the exclusion, and no arm of T6.5-13 or T6.5-16(g) does either; two byte-asserted arms composed and observed as T6.5-13's are (value-blind in the fresh identifier alone, `build` and `check` clean after each move, the receiving root's own text and ownHash compared through `query node` before and after, the real operation's bytes agreeing with the preview's offsets, T6.6-4(b)), each receiving file holding exactly one line start at which the added line derives as a declaration — inside a section, at an interior empty line's start — and exactly one admissible offset, mid-line at the file's end, so that the two readings take different offsets: (a) the target side — `<S id=\"p\">`, U+000A, U+000A, `x`, U+000A, `</S>` with no final terminator, moved into `p.n` with T6.5-13(h)'s moved text, the result exactly `<S id=\"p\">`, U+000A, U+000A, `x`, U+000A, the moved text, U+000A, `</S>`, U+000A, `import <X> from \"./x.xspec\"`, U+000A, the preview's `target-insertion` at the `</S>` line's start and `import-addition` at the file's byte length, the root's own text and ownHash unchanged; (b) the origin side, `of the file so left` — `<S id=\"m\">`, U+000A, `z`, U+000A, `</S>`, U+000A, `<S id=\"a\" d={\"m\"}>`, U+000A, U+000A, `y`, U+000A, `</S>` with no final terminator, `move specs/a.mdx#m specs/b.mdx#m` into an existing target needing no declaration, the origin's own `d={\"m\"}` converting to `d={<T>.m}` through the target module's declaration the origin lacks, the deletion's range from the file's start through line 3's terminator, the result exactly `<S id=\"a\" d={<T>.m}>`, U+000A, U+000A, `y`, U+000A, `</S>`, U+000A, `import <T> from \"./b.xspec\"`, U+000A, the preview's `origin-deletion` spanning that range, `reference-rewrite` spanning `\"m\"`, and `import-addition` at the file's byte length, the origin root `changed` by its lost child reference alone, its own text empty before and after — every form verified to derive under the stock grammar (S-9), the excluded in-section forms included, and every absorbing offset verified not to; a product reading the exclusion out of 6.5, applying it in the target file alone, or judging it by derivability inserts at the empty line's start and fails the byte contract and the preview's offset while passing T6.5-13 whole (SPEC 6.5, 6.4, 6.2, 3, 6.6, 12.7, 1.6, 5.5; H-4)",
  run: async (product) => {
    for (const entry of A19_ARMS) {
      a19AssertPremises(entry);
      await runA13Arm(product, entry.arm, "T6.5-19");
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
  T6_5_17,
  T6_5_18,
  T6_5_19,
];
