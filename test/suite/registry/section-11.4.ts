// TEST-SPEC §11.4 (`xspec view`) — SUITE-54: T11.4-1 through T11.4-3
// (T11.4-4 through T11.4-6 are planned follow-ups in this module).
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
// T11.4-2 — operands vs restriction (SPEC 11.4). One failing-on-purpose
// workspace, the whole sweep inside one modifies-nothing compare:
//
// - Staging (the `build --json` gate pins it before any arm, so every
//   domain-and-exit assertion below reads on staged ground): specs/dup.mdx
//   is finding-free with one section `solo` (the positive-control file the
//   set arm views); specs/bad.mdx holds exactly one 14.3 (a duplicate
//   `twin` pair); src/app.ts is a DISCOVERED code source holding exactly one
//   14.8 (the string-form `text("solo")` call, invalid in TypeScript by
//   form, SPEC 4.3) beside a resolving `SPEC.solo` marker; docs/note.mdx is
//   an on-disk, deliberately unparseable decoy in NO configured group (SPEC
//   7: discovery is controlled exclusively by configuration).
// - `<file>` operands assert membership in the DISCOVERED spec-source
//   domain: a file existing nowhere and the on-disk undiscovered decoy each
//   exit 2 as an unknown file (a product resolving operands against the
//   filesystem accepts the decoy and answers — or surfaces its 14.20 —
//   instead of erring); the discovered code source exits 2 as a wrong-kind
//   operand (12.0), its own 14.8 notwithstanding — the argument checks
//   precede answering (11.2, the T11.2-5 protocol), never exit 1 with the
//   file's findings.
// - `--file` is instead a set restriction over the domain: a glob matching
//   only the undiscovered decoy, one matching nothing at all, and the SAME
//   `src/app.ts` spelling that just erred as an operand each admit the
//   empty set — `{"findings": [], "views": []}`, exit 0, no unknown-file
//   usage error on this filter, whatever findings the workspace carries.
//   The only-code-sources arm is the sharp half (SPEC 11.4: the restriction
//   admits the discovered SPEC sources it matches, unlike 11.3's
//   spec-and-code-alike filter): a product reusing the occurrences filter
//   consults the finding-laden code file, carries its 14.8, and exits 1.
// - Combining `<file>` operands with `--file` — each part individually
//   valid — is a usage error, exit 2 (an intersecting or union product
//   answers instead).
// - The requested files form a set: the discovered specs/dup.mdx named
//   twice yields ONE view (the decode besides rejects a duplicated view
//   entry: per-file views are strictly ascending by path bytes), the
//   finding-free domain {dup} exiting 0 with an empty findings member while
//   bad.mdx and the code source stay failing — the domain is the requested
//   files (T11.2-5's ground riding as this arm's positive control). The
//   view's substance is pinned at identity level (root and child identity);
//   ranges, attributes, and interpreted values stay T11.4-1/-3's subject.
//
// T11.4-3 — attributes and per-node data (SPEC 11.4, 11.2, 2.7). One
// workspace, two files, two invocations:
//
// - specs/attrs.mdx, staged via the running-offset builder: a
//   five-attribute section tag `<S id="dup" id="dup" note="mystery"
//   {...extras} tags>` — a repeated `id` (BOTH entries listed), an unknown
//   prop, a spread attribute (its `name` structurally absent — the stated
//   `null` — its source text the whole braced construct), and a valueless
//   bare-name `tags` — and a second section `<S id="cov"
//   coverage={"none"}>`. The bare `view` asserts every attribute entry
//   `{name, range, text}` byte-exactly in tag order: inclusion is by form —
//   a product omitting an invalid form from the listing (or folding the
//   repeated pair to one entry) fails the exact attributes compare — while
//   each invalidity is a located finding beside the view: exactly five
//   14.17 (repeated `id`; unknown prop; spread attribute; valueless `tags`;
//   braced `coverage` — SPEC 2.7 assigns each), every finding located in
//   specs/attrs.mdx (file granularity; range precision is T14-8's), and
//   nothing else: no 14.1 (an invalid-form `id` is condition 17, never
//   condition 1), no 14.16 (a spread attribute is an attribute form of a
//   permitted section element, not an invalid construct), no 14.2/14.3
//   (`cov` and `ok` are unique and structurally conformant).
// - Per-node interpreted data ride the same tree compare, each datum
//   observed in every legitimate state (the full definedness matrix is
//   T11.2-2's home; this test carries each state once): identity — plain
//   (`cov`, `ok`, every root) and unavailable (the repeated-`id` bearer
//   spells none); tags — plain default `[]` (`cov`), plain `["solo"]`
//   (`ok`), the roots' stated `null`, and unavailable (the valueless
//   `tags`); coverage — plain default `"required"` (the five-attribute tag:
//   `coverage` is absent there, and an absent prop defines the default
//   whatever OTHER attributes the tag spells, SPEC 11.2), plain `"none"`
//   (`ok`), the roots' stated `null`, and unavailable (the braced
//   `coverage={"none"}` — quoted-static form required, 2.7).
// - specs/clean.mdx is finding-free (`<S id="ok" tags="solo"
//   coverage="none">`); the second invocation names it as a `<file>`
//   operand and asserts SPEC 11.4's root sentence sharply: a root's `tags`
//   and `coverage` are structurally absent — the stated `null`, never the
//   unavailability marker, NO finding and NO exit-1 consequence — so the
//   finding-free domain exits 0 with them `null` (a product reading the
//   structural absence as unavailability owes exit 1 per 11.2's
//   any-unavailable-datum rule and fails the exit compare; the bare
//   invocation exits 1 for the matrix file's findings and markers).
//
// Certification (CERTIFICATIONS.md CONF-AVAIL): T11.4-1 and T11.4-3 are IN
// scope (the fixture family lands with the certification-manifest task), so
// both bodies obey the scope's staging constraints exactly: spec-only
// workspaces of `.mdx` sources at valid-UTF-8 `#`-free paths; every command
// driven is drawn from the enumerated surface — T11.4-1's bare whole-domain
// `view`, T11.4-3's bare `view` plus one `<file>`-operand `view`, never
// `occurrences` or `at` — with NO gate-reference `build` (each answer's own
// findings member is the staging integrity) and NO snapshot compare
// (graph-data and refresh behavior are expressly out of CONF-AVAIL scope),
// and every staged condition drawn from the scope's stated set (T11.4-3
// stages 14.17 alone). T11.4-1's fixtures stage NO undefined datum — every
// node identity defined under 11.2's chain conditions, the invalid-element
// arm keeping every spelled identity defined — so its answers carry the
// unavailability marker nowhere: the marker-free ground
// VIOL-AVAIL-NULLMARKER's passing side stands on (nothing undefined, so the
// deviation touches nothing), while the stated `null`s the answers DO carry
// (each root's `tags`/`coverage`; `closing` on self-closing sections;
// `opening`/`closing` on roots) make the decode fail under VIOL-AVAIL-OMIT
// exactly as certified (`null` is never omission — decodeViewReport rejects
// the absent members). T11.4-3 is the per-node unavailability carrier the
// document names: under VIOL-AVAIL-NULLMARKER its identity, tags, and
// coverage unavailability arms read `null` where the test asserts the
// marker literally (a `null` identity fails the form-exact decode outright;
// `null` tags/coverage fail the tree compare against the expected marker);
// under VIOL-AVAIL-OMIT every stated-`null` member its answers carry (each
// root's `tags`/`coverage`, every finding's `null` path, the spread entry's
// `null` name) is absent and the decode rejects the omission, the exit-0
// operand arm asserting the root distinction directly; under
// VIOL-AVAIL-NOFILE it passes untouched — T11.4-3 drives `view` alone.
// T11.4-2 is NOT in scope: CERTIFICATIONS.md's Exclusions name the
// argument, spelling, and domain-and-exit matrices of the machine-interface
// surfaces (T11.2-5, T11.3-2/3, T11.4-2, T11.5-2) — certified
// representatively through the shared machinery — so unlike its siblings it
// is free to drive the gate-reference `build` and the snapshot compare.

import { Buffer } from "node:buffer";
import type {
  SourceRange,
  ViewAttributeEntry,
  ViewNode,
} from "../../helpers/adapters/index.js";
import { decodeViewReport } from "../../helpers/adapters/index.js";
import { fail, parseJsonStdout } from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { assertLeavesUnchanged } from "../../helpers/snapshot.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import {
  expectAvailabilityUsageError,
  SPEC_AND_CODE_CONFIG,
  SPECS_ONLY_CONFIG,
} from "./section-11.2.js";
import {
  assertConditionCounts,
  assertFindingLocated,
  assertSameJson,
  buildFindings,
  expectExit,
  runJson,
} from "./support.js";

/**
 * Running byte-offset fixture assembler (the T5.7-2/T11.2-1 discipline):
 * `add` appends a segment and returns its byte range, and `attr` an
 * attribute segment as the expected `{name, range, text}` view entry (SPEC
 * 11.4: the source text is the attribute's own characters, so entry text =
 * segment), so every expected offset is composed from the same parts the
 * staged file is.
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

  attr(name: string | null, text: string): ViewAttributeEntry {
    return { name, range: this.add(text), text };
  }
}

/** The 12.7 unavailability marker, as decoded (one-datum state). */
const UNAVAILABLE = { unavailable: true } as const;

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
      `§11.4 fixture self-check — ${what}: the claimed byte range ` +
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

// --- T11.4-2 — operands vs restriction ----------------------------------------
//
// The matrix ground (failing on purpose; module header): a finding-free spec
// source, a spec source with one 14.3, a discovered code source with one
// 14.8, and an on-disk decoy no configured group discovers.

const OV_DUP_FILE = "specs/dup.mdx";
const OV_DUP_SOURCE = ['<S id="solo">', "Solo text.", "</S>", ""].join("\n");

const OV_BAD_FILE = "specs/bad.mdx";
const OV_BAD_SOURCE = [
  '<S id="twin">',
  "Twin one.",
  "</S>",
  "",
  '<S id="twin">',
  "Twin two.",
  "</S>",
  "",
].join("\n");

const OV_CODE_FILE = "src/app.ts";
const OV_CODE_SOURCE = [
  'import SPEC, { text } from "../specs/dup.xspec";',
  "",
  "export function grab(): void {",
  "  SPEC.solo;",
  "}",
  "",
  "export function bad(): string {",
  '  return text("solo");',
  "}",
  "",
].join("\n");

const OV_DECOY_FILE = "docs/note.mdx";
const OV_DECOY_SOURCE = '<S id="trap">\nUnclosed on purpose.\n';

/** The workspace's complete finding multiset (the `build --json` gate). */
const OV_WORKSPACE_CONDITIONS: Readonly<Record<string, number>> = {
  "14.3": 1,
  "14.8": 1,
};

/**
 * The set arm's identity-level projection: the served view's substance is
 * pinned by node identities alone — the construct ranges, decompositions,
 * attribute entries, and interpreted values are T11.4-1's and T11.4-3's
 * subject (the form-exact decode has already enforced their presence and
 * forms).
 */
interface IdentityShape {
  readonly identity: string | { readonly unavailable: true };
  readonly children: readonly IdentityShape[];
}

function projectIdentities(node: ViewNode): IdentityShape {
  return {
    identity: node.identity,
    children: node.children.map(projectIdentities),
  };
}

const OV_DUP_IDENTITY_TREE: IdentityShape = {
  identity: OV_DUP_FILE,
  children: [{ identity: `${OV_DUP_FILE}#solo`, children: [] }],
};

const T11_4_2 = defineProductTest({
  id: "T11.4-2",
  title:
    '`<file>` operands assert membership in the DISCOVERED spec-source domain while `--file` is a set restriction over it: an undiscovered operand — a file existing nowhere, and an on-disk `docs/note.mdx` no configured group discovers — exits 2 as an unknown file, and a discovered code source exits 2 as a wrong-kind operand (12.0), its own staged 14.8 notwithstanding — the argument checks precede answering — each with the single 12.7 error document; the SAME `src/app.ts` spelling as a `--file` value instead admits the empty set — a glob matching only code sources, one matching the undiscovered on-disk decoy, and one matching nothing at all each answer `{"findings": [], "views": []}`, exit 0, no unknown-file usage error on this filter, whatever findings the workspace carries; combining `<file>` operands with `--file`, each part individually valid, exits 2; and the requested files form a set — the discovered `specs/dup.mdx` named twice yields ONE view, its finding-free domain exiting 0 with the root and section identities served while the rest of the workspace stays failing, no invocation of the sweep modifying anything (SPEC 11.4, 11.2, 12.0, 12.7, 7)',
  run: async (product) => {
    const workspace = await TestWorkspace.create({
      files: {
        "xspec.config.ts": SPEC_AND_CODE_CONFIG,
        [OV_DUP_FILE]: OV_DUP_SOURCE,
        [OV_BAD_FILE]: OV_BAD_SOURCE,
        [OV_CODE_FILE]: OV_CODE_SOURCE,
        [OV_DECOY_FILE]: OV_DECOY_SOURCE,
      },
    });
    try {
      await assertLeavesUnchanged(
        workspace.root,
        async () => {
          // Gate reference and staging integrity (SPEC 12.1, 14): exactly
          // one 14.3 in bad.mdx and one 14.8 in the discovered code source,
          // nothing else — dup.mdx is finding-free and the decoy is in no
          // configured group, contributing nothing (SPEC 7: discovery is
          // controlled exclusively by configuration). Every domain-and-exit
          // assertion below reads on this staged ground.
          const gateContext =
            "T11.4-2 `build --json` (staging integrity: one 14.3 in " +
            "specs/bad.mdx, one 14.8 in src/app.ts; specs/dup.mdx " +
            "finding-free; the undiscovered docs/note.mdx contributes " +
            "nothing)";
          const gateFindings = await buildFindings(
            product,
            workspace,
            gateContext,
          );
          assertConditionCounts(
            gateFindings,
            OV_WORKSPACE_CONDITIONS,
            `${gateContext} — exactly the staged conditions (SPEC 14)`,
          );
          assertFindingLocated(
            gateFindings.find((finding) => finding.condition === "14.3")!,
            { file: OV_BAD_FILE },
            `${gateContext} — the duplicate \`twin\` pair locates every ` +
              `bearer, both in specs/bad.mdx (SPEC 14)`,
          );
          assertFindingLocated(
            gateFindings.find((finding) => finding.condition === "14.8")!,
            { file: OV_CODE_FILE },
            `${gateContext} — the string-form \`text("solo")\` call ` +
              `locates in the code source (SPEC 4.3, 14)`,
          );

          // --- `<file>` operands assert membership (SPEC 11.4, 12.0): an
          // undiscovered file is unknown — whether it exists nowhere or
          // sits on disk outside every configured group (a product
          // resolving operands against the filesystem accepts the decoy
          // and answers, or surfaces its 14.20, instead of erring) — and a
          // discovered code source is a wrong-kind operand, each exit 2
          // with the single 12.7 error document, the checks preceding
          // answering whatever findings the workspace or the named file
          // carries (SPEC 11.2, T11.2-5's protocol).
          await expectAvailabilityUsageError(
            product,
            workspace,
            ["view", "specs/Nope.mdx"],
            "T11.4-2 unknown `<file>` operand (a file existing nowhere) " +
              "on the failing workspace",
          );
          await expectAvailabilityUsageError(
            product,
            workspace,
            ["view", OV_DECOY_FILE],
            "T11.4-2 unknown `<file>` operand (docs/note.mdx exists on " +
              "disk but no configured group discovers it — membership is " +
              "in the DISCOVERED set, SPEC 7) on the failing workspace",
          );
          await expectAvailabilityUsageError(
            product,
            workspace,
            ["view", OV_CODE_FILE],
            "T11.4-2 wrong-kind `<file>` operand (src/app.ts is a " +
              "discovered CODE source, which has no structural view — " +
              "SPEC 11.4, 12.0), its own staged 14.8 notwithstanding: the " +
              "argument checks precede answering, never exit 1 with the " +
              "file's findings",
          );

          // --- `--file` restricts the domain (SPEC 11.4): a glob
          // admitting no discovered SPEC source admits the empty set — an
          // empty, finding-free answer, exit 0, no unknown-file usage
          // error on this filter, whatever findings the workspace
          // carries. The `src/app.ts` arm is the operand-vs-restriction
          // contrast in one spelling — the path that just erred as an
          // operand — and the sharp half of "only code sources": a
          // product reusing 11.3's spec-and-code-alike filter consults
          // the code file, carries its staged 14.8, and exits 1.
          for (const [glob, what] of [
            [
              "docs/*.mdx",
              "matching the on-disk but UNDISCOVERED docs/note.mdx — a " +
                "product globbing the filesystem consults the unparseable " +
                "decoy and answers nonempty",
            ],
            ["nosuch/**/*.mdx", "matching nothing at all"],
            [
              OV_CODE_FILE,
              "matching only a discovered CODE source — the restriction " +
                "admits the discovered SPEC sources it matches (SPEC " +
                "11.4), so the finding-laden src/app.ts is never " +
                "consulted, unlike 11.3's spec-and-code-alike filter",
            ],
          ] as const) {
            const context = `T11.4-2 \`view --file "${glob}"\` (${what})`;
            const report = decodeViewReport(
              await runJson(
                product,
                workspace,
                ["view", "--file", glob],
                `${context} — the glob admits the empty set: an empty, ` +
                  `finding-free answer exits 0, and no unknown-file usage ` +
                  `error exists on this filter, whatever findings the ` +
                  `workspace carries (SPEC 11.4, 11.2)`,
              ),
              { text: false },
              context,
            );
            assertSameJson(
              report.findings,
              [],
              `${context}: an empty consulted domain has no findings — ` +
                `the workspace's staged 14.3/14.8 are no domain file's ` +
                `findings here (SPEC 11.2, 11.4)`,
            );
            assertSameJson(
              report.views,
              [],
              `${context}: the empty set of views — an empty list is [], ` +
                `never null (SPEC 11.4, 12.7)`,
            );
          }

          // --- Combining `<file>` operands with `--file` is a usage
          // error, exit 2 (SPEC 11.4) — each part individually valid (the
          // operand is a discovered spec source; the glob matches
          // discovered spec sources), so an intersecting or union product
          // answers with views instead of erring.
          await expectAvailabilityUsageError(
            product,
            workspace,
            ["view", OV_DUP_FILE, "--file", "specs/*.mdx"],
            "T11.4-2 combining a `<file>` operand with `--file` (each " +
              "part individually valid — the combination itself is the " +
              "usage error, SPEC 11.4)",
          );

          // --- The requested files form a set (SPEC 11.4): a file named
          // twice yields one view. The decode besides rejects a
          // duplicated per-file entry (views strictly ascending by path
          // bytes). Domain {dup} is finding-free, so exit 0 with an empty
          // findings member while bad.mdx and the code source stay
          // failing — the domain is the requested files (T11.2-5's
          // ground, riding as this arm's positive control that the
          // workspace serves views at all: the empty answers above are
          // the filter's doing, not a product serving nothing).
          {
            const context =
              "T11.4-2 `view specs/dup.mdx specs/dup.mdx` (a discovered " +
              "file named twice)";
            const report = decodeViewReport(
              await runJson(
                product,
                workspace,
                ["view", OV_DUP_FILE, OV_DUP_FILE],
                `${context} — the requested files form a set with the ` +
                  `finding-free domain {specs/dup.mdx}, so exit 0 with ` +
                  `the full answer (SPEC 11.4, 11.2)`,
              ),
              { text: false },
              context,
            );
            assertSameJson(
              report.findings,
              [],
              `${context}: the domain's one file is finding-free — ` +
                `bad.mdx's 14.3 and the code source's 14.8 are no domain ` +
                `file's findings (SPEC 11.2, 11.4)`,
            );
            assertSameJson(
              report.views.map((view) => view.file),
              [OV_DUP_FILE],
              `${context}: ONE view — a file named twice yields one ` +
                `(SPEC 11.4)`,
            );
            assertSameJson(
              projectIdentities(report.views[0]!.root),
              OV_DUP_IDENTITY_TREE,
              `${context}: the served view is genuinely the named ` +
                `file's — the root and its one section, each identity ` +
                `the defined plain string (SPEC 11.4, 11.2, 1.5)`,
            );
          }
        },
        "T11.4-2 — no invocation of the sweep modifies anything: the gate " +
          "build fails writing nothing (SPEC 12.1) and on a failing " +
          "workspace these surfaces answer from current sources and write " +
          "nothing (SPEC 11.2; the no-write contract clauses live at " +
          "T11.2-1/T11.2-6)",
      );
    } finally {
      await workspace.dispose();
    }
  },
});

// --- T11.4-3 — attributes and per-node data -----------------------------------
//
// The staging ground (module header): specs/attrs.mdx carries the raw
// attribute matrix — the five-attribute tag and the braced-coverage tag,
// exactly five 14.17 — while specs/clean.mdx is finding-free with all three
// interpreted data plain. The multi-byte prose prefixes shift every later
// offset (SPEC 1.7: byte offsets, not code points or UTF-16 units).

const ATTRS_FILE = "specs/attrs.mdx";

const AT = new ByteFixture();
AT.add("Prélude — matrice d'attributs.\n\n");
const AT_DUP_START = AT.pos;
AT.add("<S ");
const AT_DUP_ID1 = AT.attr("id", 'id="dup"');
AT.add(" ");
const AT_DUP_ID2 = AT.attr("id", 'id="dup"');
AT.add(" ");
const AT_NOTE = AT.attr("note", 'note="mystery"');
AT.add(" ");
// The spread attribute (SPEC 2.7): `name` is structurally absent — the
// stated null — and the source text is its entire braced construct.
const AT_SPREAD = AT.attr(null, "{...extras}");
AT.add(" ");
const AT_TAGS = AT.attr("tags", "tags");
AT.add(">\nDup text.\n</S>");
const AT_DUP_RANGE: SourceRange = { start: AT_DUP_START, end: AT.pos };
AT.add("\n\n");
const AT_COV_START = AT.pos;
AT.add("<S ");
const AT_COV_ID = AT.attr("id", 'id="cov"');
AT.add(" ");
const AT_COV_COVERAGE = AT.attr("coverage", 'coverage={"none"}');
AT.add(">\nCov text.\n</S>");
const AT_COV_RANGE: SourceRange = { start: AT_COV_START, end: AT.pos };
AT.add("\n");
const ATTRS_SOURCE = AT.source;
const ATTRS_ROOT_RANGE: SourceRange = { start: 0, end: AT.pos };

const CLEAN_FILE = "specs/clean.mdx";

const CN = new ByteFixture();
CN.add("Épilogue — sol sans finding.\n\n");
const CN_OK_START = CN.pos;
CN.add("<S ");
const CN_OK_ID = CN.attr("id", 'id="ok"');
CN.add(" ");
const CN_OK_TAGS = CN.attr("tags", 'tags="solo"');
CN.add(" ");
const CN_OK_COVERAGE = CN.attr("coverage", 'coverage="none"');
CN.add(">\nOk text.\n</S>");
const CN_OK_RANGE: SourceRange = { start: CN_OK_START, end: CN.pos };
CN.add("\n");
const CLEAN_SOURCE = CN.source;
const CLEAN_ROOT_RANGE: SourceRange = { start: 0, end: CN.pos };

/**
 * The answer's exact accompanying findings (SPEC 11.2, 14) — doubling as
 * staging integrity (no `build` gate reference: CONF-AVAIL surface
 * constraint, module header). One 14.17 per afflicted prop name per element
 * (SPEC 2.7; T11.2-2's counting precedent): the repeated `id`, the unknown
 * prop, the spread attribute, the valueless `tags`, the braced `coverage` —
 * and nothing else (no 14.1, no 14.16, no 14.2/14.3; module header).
 */
const ATTRS_CONDITION_COUNTS: Readonly<Record<string, number>> = {
  "14.17": 5,
};

/**
 * T11.4-3's projection: the identity datum, the construct range, the raw
 * attribute entries (`{name, range, text}` — this test's own subject), and
 * the interpreted `tags`/`coverage` datums, per node. Tag-range
 * decompositions stay outside (T11.4-1 byte-asserts them; the form-exact
 * decode has already validated their presence and forms).
 */
interface AttributeDataShape {
  readonly identity: ViewNode["identity"];
  readonly range: SourceRange;
  readonly attributes: readonly ViewAttributeEntry[];
  readonly tags: ViewNode["tags"];
  readonly coverage: ViewNode["coverage"];
  readonly children: readonly AttributeDataShape[];
}

function projectAttributeData(node: ViewNode): AttributeDataShape {
  return {
    identity: node.identity,
    range: node.range,
    attributes: node.attributes.map((entry) => ({
      name: entry.name,
      range: entry.range,
      text: entry.text,
    })),
    tags: node.tags,
    coverage: node.coverage,
    children: node.children.map(projectAttributeData),
  };
}

// The complete expected trees (document order). Each root: identity defined
// (the path is valid), attributes [], tags/coverage the stated
// structural-absence null (SPEC 11.4, 12.7) — never the marker.
const ATTRS_TREE: AttributeDataShape = {
  identity: ATTRS_FILE,
  range: ATTRS_ROOT_RANGE,
  attributes: [],
  tags: null,
  coverage: null,
  children: [
    {
      // Repeated `id` spells no identity (SPEC 11.2) — explicitly
      // unavailable, never a picked value; BOTH raw entries listed in tag
      // order. `coverage` is absent on this tag, so its interpreted value
      // is the plain default "required" (an absent prop defines the
      // default whatever other attributes the tag spells), while the
      // valueless `tags` leaves the interpreted tags unavailable.
      identity: UNAVAILABLE,
      range: AT_DUP_RANGE,
      attributes: [AT_DUP_ID1, AT_DUP_ID2, AT_NOTE, AT_SPREAD, AT_TAGS],
      tags: UNAVAILABLE,
      coverage: "required",
      children: [],
    },
    {
      // The braced `coverage={"none"}` is not quoted-static form (SPEC
      // 2.7): interpreted coverage unavailable — never the braced value
      // read through — while the identity stays defined (tags/coverage
      // invalidity never undefines identity) and absent `tags` defines
      // the plain default [].
      identity: `${ATTRS_FILE}#cov`,
      range: AT_COV_RANGE,
      attributes: [AT_COV_ID, AT_COV_COVERAGE],
      tags: [],
      coverage: UNAVAILABLE,
      children: [],
    },
  ],
};

const CLEAN_TREE: AttributeDataShape = {
  identity: CLEAN_FILE,
  range: CLEAN_ROOT_RANGE,
  attributes: [],
  tags: null,
  coverage: null,
  children: [
    {
      identity: `${CLEAN_FILE}#ok`,
      range: CN_OK_RANGE,
      attributes: [CN_OK_ID, CN_OK_TAGS, CN_OK_COVERAGE],
      tags: ["solo"],
      coverage: "none",
      children: [],
    },
  ],
};

const T11_4_3 = defineProductTest({
  id: "T11.4-3",
  title:
    'raw attribute spellings as parsed, one entry per spelled attribute in tag order on the five-attribute tag `<S id="dup" id="dup" note="mystery" {...extras} tags>` — a repeated `id` (BOTH entries), an unknown prop, a spread attribute (its `name` structurally absent — the stated `null` — its source text the whole braced construct), a valueless bare-name `tags` — each entry\'s name, range, and source text byte-asserted against precomputed offsets behind a multi-byte prefix; inclusion is by form: every invalid form stays a listed entry, its invalidity a located finding beside the view, never a view omission — exactly five 14.17 (those four plus a braced `coverage={"none"}` on a second section), each located in the matrix file; per-node `identity`, `tags`, `coverage` each plain or explicitly unavailable per T11.2-2, every state carried once (identity unavailable on the repeated-`id` bearer; tags unavailable on the valueless `tags` beside its absent-prop default coverage "required"; coverage unavailable on the braced value beside its defined identity and default empty tags; all three plain in the sibling file); a root\'s `tags` and `coverage` are structurally absent — the stated `null`, never the unavailability marker, no finding and no exit-1 consequence: the finding-free specs/clean.mdx named as a `<file>` operand exits 0 with them `null`, the bare whole-domain view exiting 1 for the matrix file\'s findings and markers (SPEC 11.4, 11.2, 2.7, 12.7, 14; CERTIFICATIONS.md CONF-AVAIL in scope)',
  run: async (product) => {
    // Fixture self-checks (T5.7-2 discipline) — composed-range arithmetic
    // proven against the staged bytes before any product invocation.
    for (const [entry, what] of [
      [AT_DUP_ID1, "the first repeated id spelling"],
      [AT_DUP_ID2, "the second repeated id spelling"],
      [AT_NOTE, "the unknown prop"],
      [AT_SPREAD, "the spread attribute's whole braced construct"],
      [AT_TAGS, "the valueless tags prop"],
      [AT_COV_ID, "the cov id"],
      [AT_COV_COVERAGE, "the braced coverage"],
    ] as const) {
      sliceCheck(ATTRS_SOURCE, entry.range, entry.text, what);
    }
    sliceCheck(
      ATTRS_SOURCE,
      AT_DUP_RANGE,
      '<S id="dup" id="dup" note="mystery" {...extras} tags>\nDup text.\n</S>',
      "the five-attribute construct",
    );
    sliceCheck(
      ATTRS_SOURCE,
      AT_COV_RANGE,
      '<S id="cov" coverage={"none"}>\nCov text.\n</S>',
      "the braced-coverage construct",
    );
    sliceCheck(ATTRS_SOURCE, ATTRS_ROOT_RANGE, ATTRS_SOURCE, "the matrix file");
    for (const [entry, what] of [
      [CN_OK_ID, "the ok id"],
      [CN_OK_TAGS, "the ok tags"],
      [CN_OK_COVERAGE, "the ok coverage"],
    ] as const) {
      sliceCheck(CLEAN_SOURCE, entry.range, entry.text, what);
    }
    sliceCheck(
      CLEAN_SOURCE,
      CN_OK_RANGE,
      '<S id="ok" tags="solo" coverage="none">\nOk text.\n</S>',
      "the clean construct",
    );
    sliceCheck(CLEAN_SOURCE, CLEAN_ROOT_RANGE, CLEAN_SOURCE, "the clean file");

    const workspace = await TestWorkspace.create({
      files: {
        "xspec.config.ts": SPECS_ONLY_CONFIG,
        [ATTRS_FILE]: ATTRS_SOURCE,
        [CLEAN_FILE]: CLEAN_SOURCE,
      },
    });
    try {
      // --- Invocation 1: the bare whole-domain `view` (CONF-AVAIL's
      // enumerated surface; no gate-reference `build`, no snapshot
      // compare). The answer carries the five 14.17 findings and the
      // explicitly-unavailable datums, so exit 1 with the full document
      // still emitted (SPEC 11.2).
      const context = "T11.4-3 bare `view` (whole domain: attrs + clean)";
      const result = await expectExit(
        product,
        workspace,
        ["view"],
        1,
        `${context} — the answer carries the staged 14.17 findings and ` +
          `explicitly-unavailable datums, so the invocation exits 1 with ` +
          `the full document still emitted (SPEC 11.2, 11.4)`,
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

      // Staging integrity rides the answer itself (no `build` gate):
      // exactly one 14.17 per afflicted prop name per element, nothing
      // else — the invalidity is a located finding beside the view, never
      // a view omission (SPEC 11.4, 2.7, 14).
      assertConditionCounts(
        report.findings,
        ATTRS_CONDITION_COUNTS,
        `${context}: exactly five 14.17 accompany — the repeated id, the ` +
          `unknown prop, the spread attribute, the valueless tags, and ` +
          `the braced coverage (SPEC 2.7, 14) — and nothing masked or ` +
          `phantom reports: no 14.1 from the invalid-form id (condition ` +
          `17, never condition 1), no 14.16 for the spread attribute (an ` +
          `attribute form of a permitted section element, not an invalid ` +
          `construct), no 14.2/14.3 (cov and ok are unique and conformant)`,
      );
      for (const finding of report.findings) {
        assertFindingLocated(
          finding,
          { file: ATTRS_FILE },
          `${context} — every 14.17 locates in the matrix file (file ` +
            `granularity; range precision is T14-8's)`,
        );
      }

      // The whole domain in path-byte order, then each per-file tree with
      // its raw attribute entries and interpreted datums (module header).
      assertSameJson(
        report.views.map((view) => view.file),
        [ATTRS_FILE, CLEAN_FILE],
        `${context}: both discovered spec sources are viewed, in byte ` +
          `order of workspace-relative path (SPEC 11.4, 12.7)`,
      );
      assertSameJson(
        projectAttributeData(report.views[0]!.root),
        ATTRS_TREE,
        `${context} — ${ATTRS_FILE}: raw attribute spellings as parsed, ` +
          `one entry per spelled attribute in tag order — the repeated ` +
          `id's BOTH entries, the unknown prop, the spread attribute ` +
          `(name the stated null, text the whole braced construct), the ` +
          `valueless bare-name tags — each with byte-exact range and ` +
          `source text, none omitted for its invalidity (SPEC 11.4); ` +
          `per-node identity/tags/coverage per 11.2: the repeated-id ` +
          `bearer's identity and valueless-tags value explicitly ` +
          `unavailable beside its absent-prop default coverage ` +
          `"required", the braced-coverage value unavailable beside its ` +
          `defined identity and default empty tags, and the root's ` +
          `tags/coverage the stated null, never the marker (SPEC 12.7)`,
      );
      assertSameJson(
        projectAttributeData(report.views[1]!.root),
        CLEAN_TREE,
        `${context} — ${CLEAN_FILE}: the sibling file's section carries ` +
          `all three interpreted data plain (identity "ok", tags ` +
          `["solo"], coverage "none") with its three attribute entries ` +
          `byte-exact, and the root's tags/coverage stay the stated null ` +
          `(SPEC 11.4, 11.2, 12.7)`,
      );
      [ATTRS_FILE, CLEAN_FILE].forEach((file, index) => {
        const view = report.views[index]!;
        assertSameJson(
          [view.imports, view.occurrences, view.comments],
          [[], [], []],
          `${context} — ${file}: no import, reference spelling, or MDX ` +
            `comment is staged — empty lists are [], never null (SPEC ` +
            `11.4, 12.7)`,
        );
      });

      // --- Invocation 2: the finding-free file named as a `<file>`
      // operand (SPEC 11.4's root sentence, sharply): the root's
      // tags/coverage are structurally absent — the stated null, never
      // the unavailability marker — with NO finding and NO exit-1
      // consequence, so the finding-free domain {clean} exits 0 with the
      // full answer while the matrix file stays failing outside the
      // domain (SPEC 11.2, 11.4, 12.7).
      const cleanContext =
        "T11.4-3 `view specs/clean.mdx` (the finding-free file as a " +
        "`<file>` operand)";
      const cleanReport = decodeViewReport(
        await runJson(
          product,
          workspace,
          ["view", CLEAN_FILE],
          `${cleanContext} — a finding-free file's view exits 0 with the ` +
            `root's tags/coverage the stated null: structural absence ` +
            `carries no finding and no exit-1 consequence, unlike an ` +
            `explicitly-unavailable datum (SPEC 11.4, 11.2, 12.7)`,
        ),
        { text: false },
        cleanContext,
      );
      assertSameJson(
        cleanReport.findings,
        [],
        `${cleanContext}: the domain's one file is finding-free — the ` +
          `matrix file's 14.17s are no domain file's findings — and a ` +
          `root's stated-null tags/coverage contribute none (SPEC 11.2, ` +
          `11.4)`,
      );
      assertSameJson(
        cleanReport.views.map((view) => view.file),
        [CLEAN_FILE],
        `${cleanContext}: one per-file view — the requested file (SPEC 11.4)`,
      );
      assertSameJson(
        projectAttributeData(cleanReport.views[0]!.root),
        CLEAN_TREE,
        `${cleanContext}: the same tree as the whole-domain answer — the ` +
          `root's tags/coverage the stated null, never the unavailability ` +
          `marker, on the exit-0 side too (SPEC 11.4, 12.7)`,
      );
    } finally {
      await workspace.dispose();
    }
  },
});

export const section114Tests: readonly ProductTestEntry[] = [
  T11_4_1,
  T11_4_2,
  T11_4_3,
];
