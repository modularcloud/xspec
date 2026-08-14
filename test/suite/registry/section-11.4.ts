// TEST-SPEC §11.4 (`xspec view`) — SUITE-54: T11.4-1 (T11.4-2 through
// T11.4-6 are planned follow-ups in this module).
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), and rejects a product only via diagnosed
// assertion failures (H-8). SPEC 11: `view` is JSON-only — a single JSON
// document is its only output form, with or without `--json` — in the
// form-exact 12.7 document form (H-3), so every invocation below runs bare
// and its entire stdout decodes through `decodeViewReport`, which enforces
// the top level (`{"findings", "views"}` exactly), every per-file wrapper and
// node member (`{"identity", "range", "opening", "closing", "attributes",
// "tags", "coverage", "children"}`, the text members absent without
// `--text`), the three-state datum forms, and the pinned orders (per-file
// views by path bytes, children/attributes/imports/occurrences/comments in
// document order) over whatever the product emits.
//
// T11.4-1 — views and tree. One workspace, one bare `view` (neither operands
// nor `--file`), the whole document asserted:
//
// - Whole domain and order: every discovered spec source is viewed — a
//   section-less file included (a product viewing only files that hold
//   sections drops specs/sub/leaf.mdx and fails the exact file-list
//   compare) — as per-file views in byte order of workspace-relative path.
//   The staged names discriminate the collation: "specs/Zebra.mdx" (Z, 0x5A)
//   sorts before "specs/alpha.mdx" (a, 0x61) before "specs/sub/leaf.mdx"
//   (s, 0x73) by path bytes, while a case-folding or locale collation orders
//   alpha first and fails (the exact compare here; the decode's
//   strictly-ascending check besides).
// - Tree and decomposition (specs/Zebra.mdx, finding-free): the root and the
//   full positional section tree in document order — paired sections at
//   three depths, a self-closing leaf at depth three and another at depth
//   two, two top-level sections — per node the construct range and the
//   decomposition, byte-asserted against precomputed offsets composed by the
//   running-offset builder (SPEC 1.7: zero-based byte offsets,
//   start-inclusive end-exclusive; the multi-byte prefix shifts every later
//   offset so code-point, UTF-16, or line/column reporters fail): opening
//   AND closing tag ranges for paired sections, opening only — the whole
//   self-closing tag, equal to the construct range — for self-closing
//   sections, neither (both `null`) for the root, whose range is the entire
//   file.
// - Invalid-element parenting (specs/alpha.mdx): a section nested inside an
//   invalid non-section element parents to the INNERMOST enclosing section
//   construct — `wrap.mid.inner`, inside a `<div>` inside `wrap.mid` inside
//   `wrap`, parents to `wrap.mid` (never `wrap`, never the root: an
//   outermost-section or root parenting fails the exact tree compare and
//   would judge the ID against the wrong prefix) — and to the root when no
//   section encloses the element (`free`, inside a top-level `<em>`). The
//   enclosure is the one 11.2's chain conditions read: every staged identity
//   is spelled, well-formed, structurally conformant against its POSITIONAL
//   parent, and unique, so every identity datum is the plain expected
//   string — a product reading the invalid element as a chain member (its
//   spelled identity none) marks the nested section unavailable and fails
//   the compare — and the answer's findings are exactly the two 14.16s (a
//   mis-parenting product reports a phantom 14.2 and fails the count), each
//   located within its own element's construct window in specs/alpha.mdx,
//   the `<div>`'s finding ordered before the `<em>`'s (12.7: equal codes
//   order by locations; the windows are disjoint). The invalid elements get
//   NO view entry (SPEC 11.4: the invalid constructs of 14.16 get no view
//   entry — an extra node fails the tree compare).
// - Findings and exit: the two 14.16 findings ARE the staging-integrity pin
//   (no gate-reference `build` — see the certification note), and any
//   finding means exit 1 with the full answer still emitted (SPEC 11.2).
//   imports/occurrences/comments are asserted `[]` per file — nothing is
//   staged, and empty lists are `[]`, never `null` (SPEC 12.7).
//
// Certification (CERTIFICATIONS.md CONF-AVAIL): T11.4-1 is IN scope (the
// fixture family lands with the certification-manifest task), so the body
// obeys the scope's staging constraints exactly: a spec-only workspace of
// `.mdx` sources at valid-UTF-8 `#`-free paths; the ONE command it drives is
// the enumerated surface's bare whole-domain `view` — NO gate-reference
// `build` (the validity premise rides the answer's own findings member) —
// and NO snapshot compare (graph-data and refresh behavior are expressly out
// of CONF-AVAIL scope). Its fixtures stage NO undefined datum — every node
// identity defined under 11.2's chain conditions, the invalid-element arm
// keeping every spelled identity defined — so its answers carry the
// unavailability marker nowhere: the marker-free ground
// VIOL-AVAIL-NULLMARKER's passing side stands on (nothing undefined, so the
// deviation touches nothing), while the stated `null`s the answers DO carry
// (each root's `tags`/`coverage`; `closing` on self-closing sections;
// `opening`/`closing` on roots) make the decode fail under VIOL-AVAIL-OMIT
// exactly as certified (`null` is never omission — decodeViewReport rejects
// the absent members). The per-node `tags`/`coverage` VALUES and raw
// attribute entries stay outside this test's compare (T11.4-3's subject; the
// decode already enforces their presence and forms).

import { Buffer } from "node:buffer";
import type { SourceRange, ViewNode } from "../../helpers/adapters/index.js";
import { decodeViewReport } from "../../helpers/adapters/index.js";
import { fail, parseJsonStdout } from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import { SPECS_ONLY_CONFIG } from "./section-11.2.js";
import {
  assertConditionCounts,
  assertFindingLocated,
  assertSameJson,
  expectExit,
} from "./support.js";

/**
 * Running byte-offset fixture assembler (the T5.7-2/T11.2-1 discipline):
 * `add` appends a segment and returns its byte range, so every expected
 * offset is composed from the same parts the staged file is.
 */
class ByteFixture {
  private readonly parts: string[] = [];
  private bytes = 0;

  get pos(): number {
    return this.bytes;
  }

  get source(): string {
    return this.parts.join("");
  }

  add(segment: string): SourceRange {
    const start = this.bytes;
    this.parts.push(segment);
    this.bytes += Buffer.byteLength(segment, "utf8");
    return { start, end: this.bytes };
  }
}

/**
 * Fixture self-check (harness-side, before any product invocation): a
 * claimed byte range must slice the staged file's bytes to exactly the span
 * it claims. A failure here is a staging-arithmetic defect of the harness,
 * never a product failure.
 */
function sliceCheck(
  source: string,
  range: SourceRange,
  span: string,
  what: string,
): void {
  const actual = Buffer.from(source, "utf8")
    .subarray(range.start, range.end)
    .toString("utf8");
  if (actual !== span) {
    fail(
      `T11.4-1 fixture self-check — ${what}: the claimed byte range ` +
        `[${String(range.start)}, ${String(range.end)}) slices the staged ` +
        `bytes to ${JSON.stringify(actual)}, expected ` +
        `${JSON.stringify(span)} (a harness-side staging error, not a ` +
        `product failure)`,
    );
  }
}

// --- specs/Zebra.mdx — the decomposition ground (finding-free) ----------------
//
// Paired sections at three depths (top ⊃ top.one ⊃ top.one.deep's
// self-closing sibling shape below), a self-closing leaf at depth three
// (top.one.deep) and one at depth two (top.two), a second top-level section
// (side), and prose before, between, and after constructs. The multi-byte
// prefix (é: 2 bytes; è: 2 bytes; —: 3 bytes) shifts every later offset, so
// byte offsets diverge from code-point and UTF-16 counts (SPEC 1.7).

const ZEBRA_FILE = "specs/Zebra.mdx";

const Z = new ByteFixture();
Z.add("Prélude — Zèbre guard prose.\n\n");
const Z_TOP_OPEN = Z.add('<S id="top">');
Z.add("\nTop own text before.\n\n");
const Z_ONE_OPEN = Z.add('<S id="top.one">');
Z.add("\nOne text.\n\n");
const Z_DEEP_TAG = '<S id="top.one.deep" />';
const Z_DEEP_RANGE = Z.add(Z_DEEP_TAG);
Z.add("\nOne tail.\n");
const Z_ONE_CLOSE = Z.add("</S>");
const Z_ONE_RANGE: SourceRange = { start: Z_ONE_OPEN.start, end: Z.pos };
Z.add("\n\nBetween the children.\n\n");
const Z_TWO_TAG = '<S id="top.two" />';
const Z_TWO_RANGE = Z.add(Z_TWO_TAG);
Z.add("\nTop own text after.\n");
const Z_TOP_CLOSE = Z.add("</S>");
const Z_TOP_RANGE: SourceRange = { start: Z_TOP_OPEN.start, end: Z.pos };
Z.add("\n\n");
const Z_SIDE_OPEN = Z.add('<S id="side">');
Z.add("\nSide text.\n");
const Z_SIDE_CLOSE = Z.add("</S>");
const Z_SIDE_RANGE: SourceRange = { start: Z_SIDE_OPEN.start, end: Z.pos };
Z.add("\n");
const ZEBRA_SOURCE = Z.source;
const Z_ROOT_RANGE: SourceRange = { start: 0, end: Z.pos };

// --- specs/alpha.mdx — invalid-element parenting (two 14.16s) -----------------
//
// `wrap.mid.inner` sits inside a `<div>` inside `wrap.mid` inside `wrap`:
// its positional parent is the INNERMOST enclosing section construct,
// `wrap.mid`. `free` sits inside a top-level `<em>`: no section encloses it,
// so it parents to the root and its one-segment ID is checked against the
// empty prefix. Every spelled identity is well-formed, conformant against
// its positional parent, and unique, so the file's only findings are the two
// invalid elements' 14.16s — each element's WHOLE construct recorded as the
// byte window its finding's locations must fall within (located-range
// precision is T11.4-6/T14-8's business).

const ALPHA_FILE = "specs/alpha.mdx";

const AL = new ByteFixture();
AL.add("Alpha prose — enclosure guard.\n\n");
const AL_WRAP_OPEN = AL.add('<S id="wrap">');
AL.add("\nWrap own text.\n\n");
const AL_MID_OPEN = AL.add('<S id="wrap.mid">');
AL.add("\nMid text.\n");
const AL_DIV_START = AL.pos;
AL.add("<div>\n");
const AL_INNER_OPEN = AL.add('<S id="wrap.mid.inner">');
AL.add("\nInner text.\n");
const AL_INNER_CLOSE = AL.add("</S>");
const AL_INNER_RANGE: SourceRange = { start: AL_INNER_OPEN.start, end: AL.pos };
AL.add("\n</div>");
const AL_DIV_WINDOW: SourceRange = { start: AL_DIV_START, end: AL.pos };
AL.add("\n");
const AL_MID_CLOSE = AL.add("</S>");
const AL_MID_RANGE: SourceRange = { start: AL_MID_OPEN.start, end: AL.pos };
AL.add("\n");
const AL_WRAP_CLOSE = AL.add("</S>");
const AL_WRAP_RANGE: SourceRange = { start: AL_WRAP_OPEN.start, end: AL.pos };
AL.add("\n\n");
const AL_EM_START = AL.pos;
AL.add("<em>\n");
const AL_FREE_TAG = '<S id="free" />';
const AL_FREE_RANGE = AL.add(AL_FREE_TAG);
AL.add("\n</em>");
const AL_EM_WINDOW: SourceRange = { start: AL_EM_START, end: AL.pos };
AL.add("\n");
const ALPHA_SOURCE = AL.source;
const AL_ROOT_RANGE: SourceRange = { start: 0, end: AL.pos };

// --- specs/sub/leaf.mdx — a section-less file (root-only view) ----------------

const LEAF_FILE = "specs/sub/leaf.mdx";
const LEAF_SOURCE = "Only prose in this file — no section at all.\n";
const LEAF_ROOT_RANGE: SourceRange = {
  start: 0,
  end: Buffer.byteLength(LEAF_SOURCE, "utf8"),
};

// --- expected trees -----------------------------------------------------------

/**
 * The projection T11.4-1 pins per node (its named clauses): the identity
 * datum, the construct range (1.7), the range's decomposition — opening and
 * closing tag ranges, `null` where none exists — and the children in
 * document order. Raw attribute entries and interpreted tags/coverage stay
 * outside (T11.2-1 and T11.4-3 pin those); the form-exact decode has already
 * validated their presence and forms.
 */
interface TreeShape {
  readonly identity: string | { readonly unavailable: true };
  readonly range: SourceRange;
  readonly opening: SourceRange | null;
  readonly closing: SourceRange | null;
  readonly children: readonly TreeShape[];
}

function projectShape(node: ViewNode): TreeShape {
  return {
    identity: node.identity,
    range: node.range,
    opening: node.opening,
    closing: node.closing,
    children: node.children.map(projectShape),
  };
}

const ZEBRA_TREE: TreeShape = {
  identity: ZEBRA_FILE,
  range: Z_ROOT_RANGE,
  opening: null,
  closing: null,
  children: [
    {
      identity: `${ZEBRA_FILE}#top`,
      range: Z_TOP_RANGE,
      opening: Z_TOP_OPEN,
      closing: Z_TOP_CLOSE,
      children: [
        {
          identity: `${ZEBRA_FILE}#top.one`,
          range: Z_ONE_RANGE,
          opening: Z_ONE_OPEN,
          closing: Z_ONE_CLOSE,
          children: [
            {
              identity: `${ZEBRA_FILE}#top.one.deep`,
              range: Z_DEEP_RANGE,
              opening: Z_DEEP_RANGE,
              closing: null,
              children: [],
            },
          ],
        },
        {
          identity: `${ZEBRA_FILE}#top.two`,
          range: Z_TWO_RANGE,
          opening: Z_TWO_RANGE,
          closing: null,
          children: [],
        },
      ],
    },
    {
      identity: `${ZEBRA_FILE}#side`,
      range: Z_SIDE_RANGE,
      opening: Z_SIDE_OPEN,
      closing: Z_SIDE_CLOSE,
      children: [],
    },
  ],
};

const ALPHA_TREE: TreeShape = {
  identity: ALPHA_FILE,
  range: AL_ROOT_RANGE,
  opening: null,
  closing: null,
  children: [
    {
      identity: `${ALPHA_FILE}#wrap`,
      range: AL_WRAP_RANGE,
      opening: AL_WRAP_OPEN,
      closing: AL_WRAP_CLOSE,
      children: [
        {
          identity: `${ALPHA_FILE}#wrap.mid`,
          range: AL_MID_RANGE,
          opening: AL_MID_OPEN,
          closing: AL_MID_CLOSE,
          children: [
            {
              identity: `${ALPHA_FILE}#wrap.mid.inner`,
              range: AL_INNER_RANGE,
              opening: AL_INNER_OPEN,
              closing: AL_INNER_CLOSE,
              children: [],
            },
          ],
        },
      ],
    },
    {
      identity: `${ALPHA_FILE}#free`,
      range: AL_FREE_RANGE,
      opening: AL_FREE_RANGE,
      closing: null,
      children: [],
    },
  ],
};

const LEAF_TREE: TreeShape = {
  identity: LEAF_FILE,
  range: LEAF_ROOT_RANGE,
  opening: null,
  closing: null,
  children: [],
};

const EXPECTED_VIEWS: readonly {
  readonly file: string;
  readonly tree: TreeShape;
}[] = [
  { file: ZEBRA_FILE, tree: ZEBRA_TREE },
  { file: ALPHA_FILE, tree: ALPHA_TREE },
  { file: LEAF_FILE, tree: LEAF_TREE },
];

const T11_4_1 = defineProductTest({
  id: "T11.4-1",
  title:
    "with neither operands nor `--file`, one bare `view` (JSON-only, a single form-exact 12.7 document) serves every discovered spec source — a section-less file included — as per-file views in byte order of workspace-relative path (specs/Zebra.mdx < specs/alpha.mdx < specs/sub/leaf.mdx: 0x5A < 0x61 < 0x73, never a case-folding or locale collation); per file the root and the full positional section tree in document order, each node's construct range and decomposition byte-asserted against precomputed offsets behind a multi-byte prefix (SPEC 1.7): opening and closing tag ranges for paired sections at three depths, opening only — the whole self-closing tag, equal to the construct range — for self-closing sections, neither for the root, whose range is the entire file; a section nested inside an invalid `<div>` parents to the INNERMOST enclosing section construct (`wrap.mid`, never `wrap`, never the root — the enclosure 11.2's chain conditions read, so every staged identity stays a defined plain string) and a section inside a top-level `<em>` parents to the root, the invalid elements getting no view entry, exactly the two 14.16 findings accompanying (no phantom 14.2), each located within its own element's construct window, exit 1 with the full answer (SPEC 11.4, 11.2, 1.7, 12.7, 14)",
  run: async (product) => {
    // Fixture self-checks (T5.7-2 discipline) — composed-range arithmetic
    // proven against the staged bytes before any product invocation.
    sliceCheck(ZEBRA_SOURCE, Z_TOP_OPEN, '<S id="top">', "top's opening tag");
    sliceCheck(ZEBRA_SOURCE, Z_TOP_CLOSE, "</S>", "top's closing tag");
    sliceCheck(
      ZEBRA_SOURCE,
      Z_ONE_OPEN,
      '<S id="top.one">',
      "top.one's opening tag",
    );
    sliceCheck(ZEBRA_SOURCE, Z_ONE_CLOSE, "</S>", "top.one's closing tag");
    sliceCheck(
      ZEBRA_SOURCE,
      Z_DEEP_RANGE,
      Z_DEEP_TAG,
      "top.one.deep's self-closing tag",
    );
    sliceCheck(
      ZEBRA_SOURCE,
      Z_TWO_RANGE,
      Z_TWO_TAG,
      "top.two's self-closing tag",
    );
    sliceCheck(
      ZEBRA_SOURCE,
      Z_SIDE_OPEN,
      '<S id="side">',
      "side's opening tag",
    );
    sliceCheck(ZEBRA_SOURCE, Z_SIDE_CLOSE, "</S>", "side's closing tag");
    sliceCheck(
      ALPHA_SOURCE,
      AL_DIV_WINDOW,
      '<div>\n<S id="wrap.mid.inner">\nInner text.\n</S>\n</div>',
      "the in-section invalid element's whole construct",
    );
    sliceCheck(
      ALPHA_SOURCE,
      AL_EM_WINDOW,
      '<em>\n<S id="free" />\n</em>',
      "the top-level invalid element's whole construct",
    );
    sliceCheck(
      ALPHA_SOURCE,
      AL_INNER_RANGE,
      '<S id="wrap.mid.inner">\nInner text.\n</S>',
      "wrap.mid.inner's whole construct",
    );
    sliceCheck(ALPHA_SOURCE, AL_FREE_RANGE, AL_FREE_TAG, "free's tag");

    const workspace = await TestWorkspace.create({
      files: {
        "xspec.config.ts": SPECS_ONLY_CONFIG,
        [ZEBRA_FILE]: ZEBRA_SOURCE,
        [ALPHA_FILE]: ALPHA_SOURCE,
        [LEAF_FILE]: LEAF_SOURCE,
      },
    });
    try {
      // The one invocation (CONF-AVAIL's enumerated surface: no
      // gate-reference `build`, no snapshot compare): the bare whole-domain
      // `view`. The answer carries alpha's two 14.16 findings, so exit 1
      // with the full answer still emitted (SPEC 11.2).
      const context = "T11.4-1 bare `view` (whole domain, no operands)";
      const result = await expectExit(
        product,
        workspace,
        ["view"],
        1,
        `${context} — the answer carries the two staged 14.16 findings, so ` +
          `the invocation exits 1 with the full document still emitted ` +
          `(SPEC 11.2, 11.4)`,
      );
      const report = decodeViewReport(
        parseJsonStdout(
          result,
          `${context} — a single JSON document is the only output form, ` +
            `with or without --json (SPEC 11)`,
        ),
        { text: false },
        context,
      );

      // Staging integrity rides the answer itself (no `build` gate): exactly
      // the two invalid elements' findings — one 14.16 per element, nothing
      // else. A product mis-parenting a nested section reports a phantom
      // 14.2 here; one reading the invalid element as a masking chain member
      // drops nothing observable here but fails the identity compare below.
      assertConditionCounts(
        report.findings,
        { "14.16": 2 },
        `${context}: the consulted domain's findings are exactly the two ` +
          `invalid-element findings — every staged identity is spelled, ` +
          `well-formed, conformant against its positional parent, and ` +
          `unique, so no 14.1/14.2/14.3/14.4 arises (SPEC 11.2, 11.4, 14)`,
      );
      const invalidElementFindings = report.findings.filter(
        (finding) => finding.condition === "14.16",
      );
      // The findings order is decode-enforced (12.7: equal codes order by
      // locations element-wise), and the two elements' windows are disjoint
      // with the `<div>` wholly before the `<em>`, so the array order pins
      // which finding is which.
      assertFindingLocated(
        invalidElementFindings[0]!,
        { file: ALPHA_FILE, window: AL_DIV_WINDOW },
        `${context} — the in-section \`<div>\`'s 14.16 locates within that ` +
          `element's construct in specs/alpha.mdx (SPEC 14, 12.7)`,
      );
      assertFindingLocated(
        invalidElementFindings[1]!,
        { file: ALPHA_FILE, window: AL_EM_WINDOW },
        `${context} — the top-level \`<em>\`'s 14.16 locates within that ` +
          `element's construct in specs/alpha.mdx (SPEC 14, 12.7)`,
      );

      // Whole domain, byte order: exactly the three discovered spec sources,
      // Zebra (0x5A) < alpha (0x61) < sub/leaf (0x73) — completeness (the
      // section-less leaf viewed) and collation in one compare.
      assertSameJson(
        report.views.map((view) => view.file),
        EXPECTED_VIEWS.map((view) => view.file),
        `${context}: every discovered spec source is viewed — the ` +
          `section-less file included — in byte order of ` +
          `workspace-relative path (SPEC 11.4, 12.7)`,
      );

      // Per file: the full positional section tree in document order, each
      // node's construct range and decomposition byte-exact; nothing else is
      // staged, so imports, occurrences, and comments are `[]` (never
      // `null`, SPEC 12.7).
      EXPECTED_VIEWS.forEach((expected, index) => {
        const view = report.views[index]!;
        assertSameJson(
          projectShape(view.root),
          expected.tree,
          `${context} — ${expected.file}: the root and the full positional ` +
            `section tree in document order, per node the construct range ` +
            `and its decomposition against precomputed byte offsets — ` +
            `opening and closing tag ranges for paired sections, opening ` +
            `only for self-closing, neither for the root — and every ` +
            `identity the defined plain string (SPEC 11.4, 11.2, 1.7)`,
        );
        assertSameJson(
          view.imports,
          [],
          `${context} — ${expected.file}: no import is staged, and an ` +
            `empty list is [], never null (SPEC 11.4, 12.7)`,
        );
        assertSameJson(
          view.occurrences,
          [],
          `${context} — ${expected.file}: no reference spelling is staged ` +
            `(SPEC 11.4, 5.7, 12.7)`,
        );
        assertSameJson(
          view.comments,
          [],
          `${context} — ${expected.file}: no MDX comment is staged (SPEC ` +
            `11.4, 12.7)`,
        );
      });
    } finally {
      await workspace.dispose();
    }
  },
});

export const section114Tests: readonly ProductTestEntry[] = [T11_4_1];
