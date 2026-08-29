// TEST-SPEC §11.5 (`xspec at`) — SUITE-55: T11.5-1, T11.5-2, and T11.5-3.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), and rejects a product only via diagnosed
// assertion failures (H-8). SPEC 11: `at` is JSON-only — a single JSON
// document is its only output form, with or without `--json` — in the
// form-exact 12.7 document form (H-3), so every invocation below runs bare
// and its entire stdout decodes through `decodeAtReport`, which enforces the
// top level (`{"findings", "resolution"}` exactly), the resolution's
// `{"section", "occurrence"}` form with `section` `{"identity", "range"}`,
// the three-state datum rules (a plain identity or the unavailability
// marker, never `null`; `occurrence` an occurrence record or `null`), and
// the finding forms over whatever the product emits.
//
// T11.5-1 — total resolution and derivability from view data. One workspace,
// one file with imports, comments, nested sections, and between-section
// prose (specs/total.mdx, finding-free, composed by the running-offset
// builder behind multi-byte prose so byte offsets diverge from code-point
// and UTF-16 counts, SPEC 1.7), plus the prose-only import target:
//
// - Pointwise arms (precomputed constants — the anchor CERTIFICATIONS.md's
//   P-12 note names): offsets inside an import declaration, inside a
//   top-level comment, inside a comment within the deep section, in deep
//   section content, in between-section prose, inside opening tags (a.b's
//   and a.b.c's — the INNERMOST containing section construct wins, never
//   the parent whose range also contains the tag), inside closing tags (a's,
//   lying after a.b's close, and z's), and in content between a child's
//   close and its parent's close each resolve to the innermost section
//   construct whose range (1.7) contains the offset — the root where none
//   does — reported as `{"identity", "range"}`: the construct range and the
//   node identity per 11.2 (every staged identity is spelled, well-formed,
//   structurally conformant, and unique, so each is the defined plain
//   string; the root's identity is the bare path, its range the whole
//   file). `occurrence` is `null` throughout: no reference spelling is
//   staged (occurrence containment is T11.5-3's subject).
// - EOF caret: the offset equal to the file's byte length resolves to the
//   root — outside the root's end-exclusive range, resolved by 11.5's
//   explicit rule; byte length + 1 is a usage error, exit 2 with the single
//   12.7 error document as the entire stdout (SPEC 11.2, 12.0; the
//   T11.2-5 protocol via section-11.2's shared helper).
// - Derivability: for EVERY offset 0…byte length, `at`'s resolution equals
//   the resolution computed from the file's `view` data alone —
//   `resolveAtFromView` below, walking the view's positional tree for the
//   innermost containing section and its occurrence records for the
//   containing occurrence (SPEC 11.5: `at` adds convenience, not
//   information). The comparator is not circular: the view is first
//   anchored byte-exactly against the precomputed fixture (tree
//   identities/ranges, both import entries, both comment ranges, no
//   occurrence, findings []), and a fixture self-check proves the
//   comparator against the hand-stated pointwise expectations on the
//   precomputed tree before any product invocation. Every answer of the
//   sweep is finding-free at exit 0 (SPEC 11.2: the consulted domain is
//   the named file alone; complete and finding-free → exit 0).
//
// Certification note: CONF-AVAIL's scope expressly excludes `at` ("no
// in-scope staging drives `at`" — CERTIFICATIONS.md), and T11.5-1 is in no
// other fixture's scope, so no certification executes this body; its
// answer-side decode rigor is certified through the CONF-AVAIL datum-form
// violators (the shared 12.7 machinery), per CERTIFICATIONS.md's
// negative-matrix note. P-12 generalizes the derivability equality to
// random workspaces, anchored by this test's precomputed fixture, and
// imports `resolveAtFromView` from here (FP-088).

import { Buffer } from "node:buffer";
import type {
  AtResolution,
  AtSection,
  Finding,
  OccurrenceRecord,
  SourceRange,
  ViewNode,
} from "../../helpers/adapters/index.js";
import {
  decodeAtReport,
  decodeViewReport,
} from "../../helpers/adapters/index.js";
import {
  assertExitCode,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { assertLeavesUnchanged } from "../../helpers/snapshot.js";
import type { ArgvValue, ProductBinding } from "../../helpers/subprocess.js";
import type { TestWorkspace as Workspace } from "../../helpers/workspace.js";
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
  runCli,
  runJson,
} from "./support.js";

/**
 * Running byte-offset fixture assembler (the T5.7-2/T11.2-1/T11.4-1
 * discipline): `add` appends a segment and returns its byte range, so every
 * expected offset is composed from the same parts the staged file is.
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
      `§11.5 fixture self-check — ${what}: the claimed byte range ` +
        `[${String(range.start)}, ${String(range.end)}) slices the staged ` +
        `bytes to ${JSON.stringify(actual)}, expected ` +
        `${JSON.stringify(span)} (a harness-side staging error, not a ` +
        `product failure)`,
    );
  }
}

// --- specs/total.mdx — the total-resolution ground (finding-free) -------------
//
// Imports (two, both resolving to the discovered specs/base.mdx — SPEC 2.1:
// several imports may bind one module under different names, and an unused
// binding is valid, so the file stays finding-free), comments (one at top
// level, one inside the deep section), nested sections at three depths
// (a ⊃ a.b ⊃ a.b.c) beside a second top-level section (z), and prose before
// any section, inside sections, between a child's close and its parent's
// close, and between the top-level sections. The multi-byte characters
// (é: 2 bytes; è: 2 bytes; —: 3 bytes) shift every later offset, so byte
// offsets diverge from code-point and UTF-16 counts (SPEC 1.7). Every
// segment's text is a named constant so construct-slice expectations are
// composed, never retyped. Every block construct is blank-line-separated
// (FP-094): under MDX block grammar a line glued to a paragraph rides that
// paragraph, so the separation is load-bearing — it is what makes the two
// `import` lines import DECLARATIONS rather than paragraph prose
// (SPEC 1, 2.1; an import glued to the head prose binds nothing, and a
// typo specifier there draws no 14.15) and both `{/* … */}` comments flow
// expression blocks, unambiguous MDX comments whose ranges the view must
// carry (SPEC 11.4) — the deep one kept inside a.b.c, so its in-section
// placement no longer rests on how an inline expression inside a paragraph
// is classified.

const AT_FILE = "specs/total.mdx";
const BASE_FILE = "specs/base.mdx";
const BASE_SOURCE = "Socle importé — cible des deux imports.\n";

const PROSE_HEAD_TEXT = "Début du fichier — préambule.\n";
const IMPORT_ONE_TEXT = 'import BASE from "./base.xspec"';
const IMPORT_TWO_TEXT = 'import AUSSI from "./base.xspec"';
const COMMENT_TOP_TEXT = "{/* commentaire général */}";
const A_OPEN_TEXT = '<S id="a">';
const A_PROSE_TEXT = "Intro locale.\n";
const AB_OPEN_TEXT = '<S id="a.b">';
const ABC_OPEN_TEXT = '<S id="a.b.c">';
const DEEP_PROSE_TEXT = "Contenu très profond.\n";
const COMMENT_DEEP_TEXT = "{/* note interne */}";
const CLOSE_TEXT = "</S>";
const AB_TAIL_TEXT = "Après c.\n";
const PROSE_BETWEEN_TEXT = "Entre les sections.\n";
const Z_OPEN_TEXT = '<S id="z">';
const Z_PROSE_TEXT = "Finale.\n";

const F = new ByteFixture();
const PROSE_HEAD = F.add(PROSE_HEAD_TEXT);
F.add("\n"); // blank line: each import must start its own MDX block
const IMPORT_ONE = F.add(IMPORT_ONE_TEXT);
F.add("\n\n");
const IMPORT_TWO = F.add(IMPORT_TWO_TEXT);
F.add("\n\n"); // blank line: the comment is a flow expression block
const COMMENT_TOP = F.add(COMMENT_TOP_TEXT);
F.add("\n\n");
const A_OPEN = F.add(A_OPEN_TEXT);
F.add("\n\n");
F.add(A_PROSE_TEXT);
F.add("\n"); // blank line: the nested opening tag starts its own block
const AB_OPEN = F.add(AB_OPEN_TEXT);
F.add("\n\n");
const ABC_OPEN = F.add(ABC_OPEN_TEXT);
F.add("\n\n");
const DEEP_PROSE = F.add(DEEP_PROSE_TEXT);
F.add("\n"); // blank line: the deep comment is a flow block inside a.b.c
const COMMENT_DEEP = F.add(COMMENT_DEEP_TEXT);
F.add("\n\n");
F.add(CLOSE_TEXT);
const ABC_RANGE: SourceRange = { start: ABC_OPEN.start, end: F.pos };
F.add("\n\n");
const AB_TAIL = F.add(AB_TAIL_TEXT);
F.add("\n");
F.add(CLOSE_TEXT);
const AB_RANGE: SourceRange = { start: AB_OPEN.start, end: F.pos };
F.add("\n\n");
const A_CLOSE = F.add(CLOSE_TEXT);
const A_RANGE: SourceRange = { start: A_OPEN.start, end: F.pos };
F.add("\n\n");
const PROSE_BETWEEN = F.add(PROSE_BETWEEN_TEXT);
F.add("\n");
const Z_OPEN = F.add(Z_OPEN_TEXT);
F.add("\n\n");
F.add(Z_PROSE_TEXT);
F.add("\n");
const Z_CLOSE = F.add(CLOSE_TEXT);
const Z_RANGE: SourceRange = { start: Z_OPEN.start, end: F.pos };
F.add("\n");
const AT_SOURCE = F.source;
const AT_LENGTH = F.pos;
const ROOT_RANGE: SourceRange = { start: 0, end: AT_LENGTH };

// Composed construct-slice expectations (never retyped): each paired
// section's construct spans its opening tag's first character through its
// closing tag's last (SPEC 1.7).
const ABC_CONSTRUCT_TEXT = `${ABC_OPEN_TEXT}\n\n${DEEP_PROSE_TEXT}\n${COMMENT_DEEP_TEXT}\n\n${CLOSE_TEXT}`;
const AB_CONSTRUCT_TEXT = `${AB_OPEN_TEXT}\n\n${ABC_CONSTRUCT_TEXT}\n\n${AB_TAIL_TEXT}\n${CLOSE_TEXT}`;
const A_CONSTRUCT_TEXT = `${A_OPEN_TEXT}\n\n${A_PROSE_TEXT}\n${AB_CONSTRUCT_TEXT}\n\n${CLOSE_TEXT}`;
const Z_CONSTRUCT_TEXT = `${Z_OPEN_TEXT}\n\n${Z_PROSE_TEXT}\n${CLOSE_TEXT}`;

// --- the view-derived resolution comparator (SPEC 11.5) -----------------------

/**
 * The resolution-relevant projection of a view's positional tree node:
 * identity datum, construct range, children in document order (SPEC 11.4).
 * `ViewNode` satisfies it structurally, so decoded view data and the
 * precomputed fixture tree feed the same comparator.
 */
export interface ResolutionNode {
  readonly identity: string | { readonly unavailable: true };
  readonly range: SourceRange;
  readonly children: readonly ResolutionNode[];
}

/** The view data one file's `at` resolutions are computed from (11.5). */
export interface ResolutionData {
  readonly root: ResolutionNode;
  readonly occurrences: readonly OccurrenceRecord[];
}

/**
 * Compute one offset's `at` resolution from a file's `view` data alone
 * (SPEC 11.5: the same resolution is derivable from the view's data —
 * `at` adds convenience, not information; T11.5-1's derivability arm, P-12
 * generalizes). Resolution is by range containment (1.7: start-inclusive,
 * end-exclusive) over the positional tree: descend into the child whose
 * construct range contains the offset while one does — sections nest
 * properly, so the descent's fixpoint is the innermost containing section
 * construct — and the root remains where no section contains the offset,
 * which also realizes 11.5's EOF rule (the offset equal to the byte length
 * lies in no end-exclusive construct range and resolves to the root). The
 * containing occurrence is the occurrence record whose range contains the
 * offset, `null` when none does. Callers pass offsets in 0…byte length;
 * greater offsets are usage errors answered by no resolution (11.5).
 */
export function resolveAtFromView(
  data: ResolutionData,
  offset: number,
): AtResolution {
  let node: ResolutionNode = data.root;
  let descended = true;
  while (descended) {
    descended = false;
    for (const child of node.children) {
      if (child.range.start <= offset && offset < child.range.end) {
        node = child;
        descended = true;
        break;
      }
    }
  }
  const occurrence =
    data.occurrences.find(
      (record) => record.range.start <= offset && offset < record.range.end,
    ) ?? null;
  return {
    section: { identity: node.identity, range: node.range },
    occurrence,
  };
}

/** Project a decoded view node onto the resolution-relevant shape. */
function projectResolution(node: ViewNode): ResolutionNode {
  return {
    identity: node.identity,
    range: node.range,
    children: node.children.map(projectResolution),
  };
}

// --- expected values (precomputed constants) ----------------------------------

const ROOT_SECTION: AtSection = { identity: AT_FILE, range: ROOT_RANGE };
const A_SECTION: AtSection = { identity: `${AT_FILE}#a`, range: A_RANGE };
const AB_SECTION: AtSection = { identity: `${AT_FILE}#a.b`, range: AB_RANGE };
const ABC_SECTION: AtSection = {
  identity: `${AT_FILE}#a.b.c`,
  range: ABC_RANGE,
};
const Z_SECTION: AtSection = { identity: `${AT_FILE}#z`, range: Z_RANGE };

/** The precomputed positional tree — the sweep's non-circular anchor. */
const FIXTURE_TREE: ResolutionNode = {
  identity: AT_FILE,
  range: ROOT_RANGE,
  children: [
    {
      identity: A_SECTION.identity,
      range: A_RANGE,
      children: [
        {
          identity: AB_SECTION.identity,
          range: AB_RANGE,
          children: [
            {
              identity: ABC_SECTION.identity,
              range: ABC_RANGE,
              children: [],
            },
          ],
        },
      ],
    },
    { identity: Z_SECTION.identity, range: Z_RANGE, children: [] },
  ],
};

// Key order mirrors the decoded `{range, name, target}` entries (12.7).
const EXPECTED_IMPORTS = [
  { range: IMPORT_ONE, name: "BASE", target: BASE_FILE },
  { range: IMPORT_TWO, name: "AUSSI", target: BASE_FILE },
] as const;

const EXPECTED_COMMENTS: readonly SourceRange[] = [COMMENT_TOP, COMMENT_DEEP];

/**
 * The pointwise arms — each offset composed from the fixture's own ranges,
 * each expectation a hand-stated precomputed constant (the anchor role:
 * independent of any product answer).
 */
const POINTWISE_ARMS: readonly {
  readonly what: string;
  readonly offset: number;
  readonly section: AtSection;
}[] = [
  {
    what: "prose before any section (no section construct contains it)",
    offset: PROSE_HEAD.start + 3,
    section: ROOT_SECTION,
  },
  {
    what: "inside the first import declaration (top level)",
    offset: IMPORT_ONE.start + 7,
    section: ROOT_SECTION,
  },
  {
    what: "inside the top-level comment",
    offset: COMMENT_TOP.start + 4,
    section: ROOT_SECTION,
  },
  {
    what: "inside the comment within a.b.c",
    offset: COMMENT_DEEP.start + 4,
    section: ABC_SECTION,
  },
  {
    what: "deep section content (inside a.b.c)",
    offset: DEEP_PROSE.start + 8,
    section: ABC_SECTION,
  },
  {
    what: "between-section prose (between a's close and z's open)",
    offset: PROSE_BETWEEN.start + 6,
    section: ROOT_SECTION,
  },
  {
    what: "inside a.b's opening tag (the innermost containing construct is a.b itself, never the enclosing a)",
    offset: AB_OPEN.start + 1,
    section: AB_SECTION,
  },
  {
    what: "inside a.b.c's opening tag",
    offset: ABC_OPEN.start + 5,
    section: ABC_SECTION,
  },
  {
    what: "inside a's closing tag (past a.b's close, a is the innermost containing construct)",
    offset: A_CLOSE.start + 2,
    section: A_SECTION,
  },
  {
    what: "inside z's closing tag",
    offset: Z_CLOSE.start + 1,
    section: Z_SECTION,
  },
  {
    what: "content between a.b.c's close and a.b's close (the parent a.b, never the closed child)",
    offset: AB_TAIL.start + 2,
    section: AB_SECTION,
  },
  {
    what: "the offset equal to the file's byte length (the EOF caret) — the root, by 11.5's explicit rule",
    offset: AT_LENGTH,
    section: ROOT_SECTION,
  },
];

/**
 * Run `at` on the staged finding-free file: exit 0 exactly (SPEC 11.2: a
 * complete, finding-free answer exits 0), the entire stdout one form-exact
 * 12.7 at document (SPEC 11, H-3), its findings [] (the consulted domain is
 * the named file alone, and it carries none).
 */
async function runAt(
  product: ProductBinding,
  workspace: Workspace,
  offset: number,
  context: string,
): Promise<AtResolution | { readonly unavailable: true }> {
  const report = decodeAtReport(
    await runJson(
      product,
      workspace,
      ["at", AT_FILE, String(offset)],
      `${context} — a single JSON document is the only output form, with ` +
        `or without --json, and a complete, finding-free answer exits 0 ` +
        `(SPEC 11, 11.2, 11.5)`,
    ),
    context,
  );
  assertSameJson(
    report.findings,
    [],
    `${context} — the consulted domain is the named file alone, and ` +
      `specs/total.mdx is finding-free (SPEC 11.5, 11.2, 12.7)`,
  );
  return report.resolution;
}

const T11_5_1 = defineProductTest({
  id: "T11.5-1",
  title:
    "total resolution (JSON-only, the form-exact 12.7 at document, every answer finding-free at exit 0): on a file with imports, comments, nested sections (a ⊃ a.b ⊃ a.b.c beside top-level z), and between-section prose, offsets inside an import declaration, a top-level comment, a comment within the deep section, deep section content, between-section prose, opening tags (a.b's and a.b.c's — the INNERMOST containing section construct, never the enclosing parent), closing tags (a's, past a.b's close, and z's), and content between a child's close and its parent's close each resolve to the innermost section construct whose range contains the offset — the root where none does — reported as {identity, range}: construct range and node identity per 11.2, byte-asserted against precomputed offsets behind multi-byte prose (SPEC 1.7); the offset equal to the file's byte length (the EOF caret) resolves to the root and byte length + 1 exits 2 with the single 12.7 error document as the entire stdout; derivability: for EVERY offset 0…byte length, `at`'s resolution equals the resolution computed from the file's `view` data alone — the view first anchored byte-exactly against the precomputed fixture (tree, both imports, both comments, no occurrence, findings []), so the comparator is not circular (SPEC 11.5, 11.2, 1.7, 12.7; P-12 generalizes)",
  timeoutMs: 360_000,
  run: async (product) => {
    // Fixture self-checks (T5.7-2 discipline) — composed-range arithmetic
    // proven against the staged bytes before any product invocation.
    sliceCheck(AT_SOURCE, PROSE_HEAD, PROSE_HEAD_TEXT, "the head prose");
    sliceCheck(AT_SOURCE, IMPORT_ONE, IMPORT_ONE_TEXT, "import declaration 1");
    sliceCheck(AT_SOURCE, IMPORT_TWO, IMPORT_TWO_TEXT, "import declaration 2");
    sliceCheck(AT_SOURCE, COMMENT_TOP, COMMENT_TOP_TEXT, "the top comment");
    sliceCheck(AT_SOURCE, COMMENT_DEEP, COMMENT_DEEP_TEXT, "the deep comment");
    sliceCheck(AT_SOURCE, A_OPEN, A_OPEN_TEXT, "a's opening tag");
    sliceCheck(AT_SOURCE, AB_OPEN, AB_OPEN_TEXT, "a.b's opening tag");
    sliceCheck(AT_SOURCE, ABC_OPEN, ABC_OPEN_TEXT, "a.b.c's opening tag");
    sliceCheck(AT_SOURCE, DEEP_PROSE, DEEP_PROSE_TEXT, "the deep prose");
    sliceCheck(AT_SOURCE, AB_TAIL, AB_TAIL_TEXT, "a.b's tail prose");
    sliceCheck(AT_SOURCE, A_CLOSE, CLOSE_TEXT, "a's closing tag");
    sliceCheck(AT_SOURCE, Z_CLOSE, CLOSE_TEXT, "z's closing tag");
    sliceCheck(AT_SOURCE, PROSE_BETWEEN, PROSE_BETWEEN_TEXT, "between prose");
    sliceCheck(AT_SOURCE, ABC_RANGE, ABC_CONSTRUCT_TEXT, "a.b.c's construct");
    sliceCheck(AT_SOURCE, AB_RANGE, AB_CONSTRUCT_TEXT, "a.b's construct");
    sliceCheck(AT_SOURCE, A_RANGE, A_CONSTRUCT_TEXT, "a's construct");
    sliceCheck(AT_SOURCE, Z_RANGE, Z_CONSTRUCT_TEXT, "z's construct");
    if (Buffer.byteLength(AT_SOURCE, "utf8") !== AT_LENGTH) {
      fail(
        `§11.5 fixture self-check — the composed byte length ` +
          `${String(AT_LENGTH)} must equal the staged file's byte length ` +
          `(a harness-side staging error, not a product failure)`,
      );
    }

    // Comparator self-check (harness-side, before any product invocation):
    // the view-derived comparator applied to the PRECOMPUTED tree must agree
    // with every hand-stated pointwise expectation — so the derivability
    // sweep below rests on a comparator proven against independent
    // constants, not on the product's own answers.
    const fixtureData: ResolutionData = { root: FIXTURE_TREE, occurrences: [] };
    for (const arm of POINTWISE_ARMS) {
      assertSameJson(
        resolveAtFromView(fixtureData, arm.offset),
        { section: arm.section, occurrence: null },
        `§11.5 fixture self-check — offset ${String(arm.offset)} (${arm.what}): ` +
          `the view-derived comparator must reproduce the hand-stated ` +
          `expectation on the precomputed tree (a harness-side defect, not ` +
          `a product failure)`,
      );
    }

    const workspace = await TestWorkspace.create({
      files: {
        "xspec.config.ts": SPECS_ONLY_CONFIG,
        [AT_FILE]: AT_SOURCE,
        [BASE_FILE]: BASE_SOURCE,
      },
    });
    try {
      // --- pointwise arms: precomputed constants (the P-12 anchor) --------
      for (const arm of POINTWISE_ARMS) {
        const context = `T11.5-1 \`at ${AT_FILE} ${String(arm.offset)}\` — ${arm.what}`;
        const resolution = await runAt(product, workspace, arm.offset, context);
        assertSameJson(
          resolution,
          { section: arm.section, occurrence: null },
          `${context}: the innermost section construct whose range ` +
            `contains the offset — the root where none does — with its ` +
            `construct range and node identity per 11.2, and no containing ` +
            `occurrence (none is staged) (SPEC 11.5, 1.7, 11.2, 12.7)`,
        );
      }

      // --- byte length + 1: a usage error (SPEC 11.5, 12.0) ---------------
      await expectAvailabilityUsageError(
        product,
        workspace,
        ["at", AT_FILE, String(AT_LENGTH + 1)],
        `T11.5-1 offset ${String(AT_LENGTH + 1)} (byte length + 1) — an ` +
          `offset greater than the file's byte length is a usage error`,
      );

      // --- the view, anchored against the precomputed fixture -------------
      const viewContext = `T11.5-1 \`view ${AT_FILE}\` (the derivability ground)`;
      const viewReport = decodeViewReport(
        await runJson(
          product,
          workspace,
          ["view", AT_FILE],
          `${viewContext} — the requested file is finding-free, so the ` +
            `answer exits 0 (SPEC 11.4, 11.2)`,
        ),
        { text: false },
        viewContext,
      );
      assertSameJson(
        viewReport.findings,
        [],
        `${viewContext} — the consulted domain is the requested file ` +
          `alone, and it is finding-free (SPEC 11.4, 11.2, 12.7)`,
      );
      assertSameJson(
        viewReport.views.map((view) => view.file),
        [AT_FILE],
        `${viewContext} — exactly the requested file is viewed (SPEC 11.4)`,
      );
      const view = viewReport.views[0]!;
      assertSameJson(
        projectResolution(view.root),
        FIXTURE_TREE,
        `${viewContext}: the positional tree — every identity the defined ` +
          `plain string, every construct range byte-exact against the ` +
          `precomputed offsets — anchors the derivability sweep to the ` +
          `staged fixture, so the view-derived comparator is not circular ` +
          `(SPEC 11.4, 11.2, 1.7)`,
      );
      assertSameJson(
        view.occurrences,
        [],
        `${viewContext} — no reference spelling is staged, so every ` +
          `resolution's occurrence member is null (SPEC 11.4, 5.7, 12.7)`,
      );
      assertSameJson(
        view.imports,
        EXPECTED_IMPORTS,
        `${viewContext} — both import declarations, byte-exact, each ` +
          `resolving to the discovered specs/base.mdx (SPEC 11.4, 2.1)`,
      );
      assertSameJson(
        view.comments,
        EXPECTED_COMMENTS,
        `${viewContext} — both MDX comments, byte-exact, in document ` +
          `order (SPEC 11.4, 12.7)`,
      );

      // --- the derivability sweep: every offset of the file ----------------
      const viewData: ResolutionData = {
        root: view.root,
        occurrences: view.occurrences,
      };
      for (let offset = 0; offset <= AT_LENGTH; offset += 1) {
        const context = `T11.5-1 derivability — \`at ${AT_FILE} ${String(offset)}\``;
        const resolution = await runAt(product, workspace, offset, context);
        assertSameJson(
          resolution,
          resolveAtFromView(viewData, offset),
          `${context}: for every offset of the file, \`at\`'s resolution ` +
            `equals the resolution computed from the file's \`view\` data ` +
            `alone — the innermost containing section construct by range ` +
            `containment, the root where none contains it (the EOF caret ` +
            `included), and the containing occurrence (none here) — \`at\` ` +
            `adds convenience, not information (SPEC 11.5, 11.4, 1.7)`,
        );
      }
    } finally {
      await workspace.dispose();
    }
  },
});

// --- T11.5-2 — offset spelling and operands (SPEC 11.5, 12.0) -----------------
//
// The matrix ground (failing on purpose — the T11.4-2 discipline): a
// finding-free spec source whose one section opens BEFORE byte offset 7
// behind a multi-byte prose head (so `007` read as decimal 7 resolves into
// the section while a product reading the spelling as 0 resolves to the
// root — the acceptance arm's teeth), a finding-laden spec source carrying
// exactly one 14.3 (the "same errors on a finding-laden file" ground), a
// discovered code source carrying exactly one 14.8 (the wrong-kind operand,
// its own finding notwithstanding), and an on-disk decoy no configured
// group discovers (membership is in the DISCOVERED set, SPEC 7 — a product
// resolving operands against the filesystem accepts it and answers, or
// surfaces its 14.20, instead of erring).
//
// Certification note: T11.5-2 is expressly in CERTIFICATIONS.md's
// Exclusions — the argument, spelling, and domain-and-exit matrices of the
// machine-interface surfaces (T11.2-5, T11.3-2/3, T11.4-2, T11.5-2) are
// certified representatively through the shared machinery — so, like
// T11.4-2, this body freely drives the gate-reference `build` and the
// whole-root snapshot compare.

const OS_OK_FILE = "specs/ok.mdx";
const OS_PROSE_TEXT = "Pré.\n"; // 6 bytes (é is 2): the head prose [0, 6)
const OS_SEPT_OPEN_TEXT = '<S id="sept">';
const OS_SEPT_BODY_TEXT = "\nTexte visé.\n";

const OS = new ByteFixture();
const OS_PROSE = OS.add(OS_PROSE_TEXT);
const OS_SEPT_OPEN = OS.add(OS_SEPT_OPEN_TEXT);
OS.add(OS_SEPT_BODY_TEXT);
OS.add(CLOSE_TEXT);
const OS_SEPT_RANGE: SourceRange = { start: OS_SEPT_OPEN.start, end: OS.pos };
OS.add("\n");
const OS_OK_SOURCE = OS.source;

const OS_SEPT_CONSTRUCT_TEXT = `${OS_SEPT_OPEN_TEXT}${OS_SEPT_BODY_TEXT}${CLOSE_TEXT}`;

/** Offset 7's precomputed resolution — the anchor `007` must reproduce. */
const OS_SEPT_SECTION: AtSection = {
  identity: `${OS_OK_FILE}#sept`,
  range: OS_SEPT_RANGE,
};

// The finding-laden spec source: prose before any section (so offset 0
// resolves to the root, its identity the defined path — the control arm's
// answer is complete, exit 1 riding on the finding alone), then two
// sections both spelling `twin` — exactly one 14.3, locating every bearer.
const OS_BAD_FILE = "specs/bad.mdx";
const OS_BAD = new ByteFixture();
OS_BAD.add("Préambule fautif — hors de toute section.\n");
OS_BAD.add('<S id="twin">\nUn.\n</S>\n');
OS_BAD.add('<S id="twin">\nDeux.\n</S>\n');
const OS_BAD_SOURCE = OS_BAD.source;

/** Offset 0's resolution in the finding-laden file: the root (SPEC 11.5). */
const OS_BAD_ROOT: AtSection = {
  identity: OS_BAD_FILE,
  range: { start: 0, end: OS_BAD.pos },
};

// The discovered code source (SPEC 7.2): one string-form `text(...)` marker
// — exactly one 14.8 (SPEC 4.3) — beside a resolving reference, so the
// wrong-kind operand is itself finding-laden and the argument check's
// precedence over answering is sharp (T11.4-2's discipline).
const OS_CODE_FILE = "src/app.ts";
const OS_CODE_SOURCE = [
  'import SPEC, { text } from "../specs/ok.xspec";',
  "",
  "export function grab(): void {",
  "  SPEC.sept;",
  "}",
  "",
  "export function bad(): string {",
  '  return text("sept");',
  "}",
  "",
].join("\n");

// On disk but in no configured group (SPEC 7): unknown as an operand. Its
// unclosed tag makes a filesystem-resolving product's acceptance loud — it
// answers or surfaces a spurious 14.20 instead of the usage error.
const OS_DECOY_FILE = "docs/note.mdx";
const OS_DECOY_SOURCE = '<S id="piège">\nJamais fermé.\n';

/** The workspace's complete finding multiset (the `build --json` gate). */
const OS_WORKSPACE_CONDITIONS: Readonly<Record<string, number>> = {
  "14.3": 1,
  "14.8": 1,
};

/**
 * The rejected `<offset>` spellings (SPEC 11.5): anything but one or more
 * ASCII decimal digits — a sign, whitespace, or any other character is not
 * a non-negative integer's spelling. Each runs twice: on the finding-free
 * file and on the finding-laden one (the argument checks precede answering,
 * SPEC 11.2, T11.2-5).
 */
const OS_REJECTED_SPELLINGS: readonly {
  readonly spelling: string;
  readonly what: string;
}[] = [
  { spelling: "+7", what: "a plus sign is not a digit" },
  {
    spelling: "-1",
    what: "a minus sign is not a digit (no negative offset has a spelling)",
  },
  { spelling: " 7", what: "leading whitespace is not a digit" },
  { spelling: "7 ", what: "trailing whitespace is not a digit" },
  {
    spelling: "0x7",
    what: "a hexadecimal prefix is not a digits-only decimal spelling",
  },
  { spelling: "", what: "an empty value spells no non-negative integer" },
];

const T11_5_2 = defineProductTest({
  id: "T11.5-2",
  title:
    '`007` is accepted as 7 — leading zeros permitted, the value read in ASCII decimal: on a file whose one section opens before byte 7 behind a multi-byte prose head, `at specs/ok.mdx 007` answers exit 0, findings [], with byte-exactly offset 7\'s precomputed resolution (the section whose opening tag contains it — a product reading the spelling as 0 resolves to the root and fails), equal to the plain-`7` invocation\'s answer — while `+7`, `-1`, `" 7"`, `"7 "`, `0x7`, and an empty value are each not a digits-only spelling: exit 2 with the single 12.7 error document as the entire stdout, the same six spellings on the finding-laden specs/bad.mdx exiting 2 identically (the argument checks precede answering, never exit 1 with the domain\'s findings); `<file>` membership and wrong-kind checks as T11.4-2: an operand existing nowhere, an on-disk docs/note.mdx no configured group discovers, and a discovered code source — its own staged 14.8 notwithstanding — each exit 2; and the finding-laden file still answers when the arguments are valid: `at specs/bad.mdx 0` exits 1 with the full answer, the root resolution complete beside exactly its one 14.3, no invocation of the sweep modifying anything (SPEC 11.5, 11.2, 12.0, 12.7, 7)',
  run: async (product) => {
    // Fixture self-checks (T5.7-2 discipline) — the staging arithmetic the
    // acceptance arm's teeth rest on, proven before any product invocation.
    sliceCheck(OS_OK_SOURCE, OS_PROSE, OS_PROSE_TEXT, "T11.5-2's head prose");
    sliceCheck(
      OS_OK_SOURCE,
      OS_SEPT_OPEN,
      OS_SEPT_OPEN_TEXT,
      "T11.5-2 sept's opening tag",
    );
    sliceCheck(
      OS_OK_SOURCE,
      OS_SEPT_RANGE,
      OS_SEPT_CONSTRUCT_TEXT,
      "T11.5-2 sept's construct",
    );
    if (!(OS_SEPT_OPEN.start <= 7 && 7 < OS_SEPT_OPEN.end)) {
      fail(
        `§11.5 fixture self-check — byte offset 7 must fall inside sept's ` +
          `opening tag [${String(OS_SEPT_OPEN.start)}, ` +
          `${String(OS_SEPT_OPEN.end)}) so \`007\` read as decimal 7 ` +
          `resolves into the section (a harness-side staging error, not a ` +
          `product failure)`,
      );
    }
    if (!(OS_PROSE.start <= 0 && 0 < OS_PROSE.end)) {
      fail(
        `§11.5 fixture self-check — byte offset 0 must fall inside the ` +
          `head prose so a product reading \`007\` as 0 resolves to the ` +
          `root, not to sept (a harness-side staging error, not a product ` +
          `failure)`,
      );
    }

    const workspace = await TestWorkspace.create({
      files: {
        "xspec.config.ts": SPEC_AND_CODE_CONFIG,
        [OS_OK_FILE]: OS_OK_SOURCE,
        [OS_BAD_FILE]: OS_BAD_SOURCE,
        [OS_CODE_FILE]: OS_CODE_SOURCE,
        [OS_DECOY_FILE]: OS_DECOY_SOURCE,
      },
    });
    try {
      await assertLeavesUnchanged(
        workspace.root,
        async () => {
          // Gate reference and staging integrity (SPEC 12.1, 14): exactly
          // one 14.3 in bad.mdx and one 14.8 in the discovered code
          // source, nothing else — ok.mdx is finding-free and the decoy is
          // in no configured group, contributing nothing (SPEC 7).
          const gateContext =
            "T11.5-2 `build --json` (staging integrity: one 14.3 in " +
            "specs/bad.mdx, one 14.8 in src/app.ts; specs/ok.mdx " +
            "finding-free; the undiscovered docs/note.mdx contributes " +
            "nothing)";
          const gateFindings = await buildFindings(
            product,
            workspace,
            gateContext,
          );
          assertConditionCounts(
            gateFindings,
            OS_WORKSPACE_CONDITIONS,
            `${gateContext} — exactly the staged conditions (SPEC 14)`,
          );
          assertFindingLocated(
            gateFindings.find((finding) => finding.condition === "14.3")!,
            { file: OS_BAD_FILE },
            `${gateContext} — the duplicate \`twin\` pair locates every ` +
              `bearer, both in specs/bad.mdx (SPEC 14)`,
          );
          assertFindingLocated(
            gateFindings.find((finding) => finding.condition === "14.8")!,
            { file: OS_CODE_FILE },
            `${gateContext} — the string-form \`text("sept")\` call ` +
              `locates in the code source (SPEC 4.3, 14)`,
          );

          // --- `007` is accepted as 7 (SPEC 11.5): leading zeros are
          // permitted and the value is read in decimal, so the answer is
          // byte-exactly offset 7's — the section whose opening tag
          // contains byte 7, never offset 0's root — and equals the
          // plain-`7` invocation's, both pinned to the same precomputed
          // constant. Findings [] beside: the consulted domain is the
          // named file alone, and ok.mdx is finding-free — the
          // workspace's staged 14.3/14.8 are no domain file's findings
          // (SPEC 11.2), so exit 0.
          const expectedSeven = {
            section: OS_SEPT_SECTION,
            occurrence: null,
          };
          for (const spelling of ["007", "7"] as const) {
            const context = `T11.5-2 \`at ${OS_OK_FILE} ${spelling}\``;
            const report = decodeAtReport(
              await runJson(
                product,
                workspace,
                ["at", OS_OK_FILE, spelling],
                `${context} — \`${spelling}\` is one-or-more ASCII decimal ` +
                  `digits, read in decimal as 7 (leading zeros permitted), ` +
                  `and the named file's domain is finding-free, so the ` +
                  `answer exits 0 (SPEC 11.5, 11.2)`,
              ),
              context,
            );
            assertSameJson(
              report.findings,
              [],
              `${context} — the consulted domain is the named file alone ` +
                `and specs/ok.mdx is finding-free: the workspace's staged ` +
                `14.3/14.8 are no domain file's findings (SPEC 11.2, 11.5)`,
            );
            assertSameJson(
              report.resolution,
              expectedSeven,
              `${context} — the spelling is read in ASCII decimal as ` +
                `offset 7, which lies inside sept's opening tag: the ` +
                `innermost containing section construct, byte-exactly ` +
                `{identity, range}, occurrence null — a product reading ` +
                `\`007\` as 0 resolves to the root instead (SPEC 11.5, ` +
                `1.7, 11.2, 12.7)`,
            );
          }

          // --- The rejected spellings (SPEC 11.5, 12.0): each exits 2
          // with the single 12.7 error document — on the finding-free
          // file, and identically on the finding-laden one: the argument
          // checks precede answering, never exit 1 with the domain's
          // findings (SPEC 11.2, T11.2-5's protocol).
          for (const { spelling, what } of OS_REJECTED_SPELLINGS) {
            await expectAvailabilityUsageError(
              product,
              workspace,
              ["at", OS_OK_FILE, spelling],
              `T11.5-2 offset value ${JSON.stringify(spelling)} on the ` +
                `finding-free file (${what} — not one-or-more ASCII ` +
                `decimal digits, SPEC 11.5)`,
            );
            await expectAvailabilityUsageError(
              product,
              workspace,
              ["at", OS_BAD_FILE, spelling],
              `T11.5-2 offset value ${JSON.stringify(spelling)} on the ` +
                `FINDING-LADEN specs/bad.mdx (${what}): the argument ` +
                `checks precede answering, so the usage error exits 2 ` +
                `whatever findings the named file carries — never exit 1 ` +
                `with its 14.3 (SPEC 11.2, 11.5)`,
            );
          }

          // --- `<file>` membership and wrong-kind checks as T11.4-2
          // (SPEC 11.5: `<file>` asserts domain membership exactly as a
          // `view` operand does; 11.4, 12.0) — each with a well-formed
          // offset, so the operand is each arm's sole defect.
          await expectAvailabilityUsageError(
            product,
            workspace,
            ["at", "specs/Nope.mdx", "0"],
            "T11.5-2 unknown `<file>` operand (a file existing nowhere) " +
              "on the failing workspace",
          );
          await expectAvailabilityUsageError(
            product,
            workspace,
            ["at", OS_DECOY_FILE, "0"],
            "T11.5-2 unknown `<file>` operand (docs/note.mdx exists on " +
              "disk but no configured group discovers it — membership is " +
              "in the DISCOVERED set, SPEC 7) on the failing workspace",
          );
          await expectAvailabilityUsageError(
            product,
            workspace,
            ["at", OS_CODE_FILE, "0"],
            "T11.5-2 wrong-kind `<file>` operand (src/app.ts is a " +
              "discovered CODE source, and `at` resolves positions in " +
              "spec sources — SPEC 11.5, 11.4, 12.0), its own staged " +
              "14.8 notwithstanding: the argument checks precede " +
              "answering, never exit 1 with the file's findings",
          );

          // --- Control: the finding-laden file ANSWERS when the
          // arguments are valid (SPEC 11.2: exit 1 signals imperfection
          // and never withholds the answer) — pinning that the exit-2s
          // above are the argument checks' doing, not a product erring on
          // every invocation that names bad.mdx.
          {
            const context = `T11.5-2 \`at ${OS_BAD_FILE} 0\` (the control: valid arguments on the finding-laden file)`;
            const result = await expectExit(
              product,
              workspace,
              ["at", OS_BAD_FILE, "0"],
              1,
              `${context} — the domain file's 14.3 accompanies the ` +
                `answer, so exit 1 with the full answer still emitted ` +
                `(SPEC 11.2, 11.5)`,
            );
            const report = decodeAtReport(
              parseJsonStdout(
                result,
                `${context} — the full answer document is still emitted, ` +
                  `complete and parseable (SPEC 11.2, H-5)`,
              ),
              context,
            );
            assertConditionCounts(
              report.findings,
              { "14.3": 1 },
              `${context} — exactly the named file's one finding ` +
                `accompanies; the code source's 14.8 is no domain file's ` +
                `finding (SPEC 11.2, 14)`,
            );
            assertFindingLocated(
              report.findings[0]!,
              { file: OS_BAD_FILE },
              `${context} — the duplicate \`twin\` finding locates every ` +
                `bearer in the named file (SPEC 14)`,
            );
            assertSameJson(
              report.resolution,
              { section: OS_BAD_ROOT, occurrence: null },
              `${context} — offset 0 lies in the head prose, so the ` +
                `resolution is the root, complete: identity the defined ` +
                `path, range the whole file, occurrence null — the ` +
                `duplicate bearers' undefined identities are never ` +
                `consulted here (SPEC 11.5, 11.2, 1.5)`,
            );
          }
        },
        "T11.5-2 — no invocation of the sweep modifies anything: the gate " +
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

// --- T11.5-3 — occurrence containment and imperfect files ---------------------
//
// SPEC 11.5: "when the offset lies within a reference occurrence's range,
// that occurrence and its resolved target (5.7)" — containment under the one
// range convention of 1.7 (start-inclusive, end-exclusive); "on an
// unparseable file the resolution is reported explicitly unavailable, the
// parse-failure finding accompanying it (11.2)"; and "a discovered spec
// source whose path is not valid UTF-8 is nameable by no argument value
// (12.0), so `at` cannot address it: for such a file (14.19) the view,
// reached by glob (11.4), is the one route to position data".
//
// One workspace (SPECS_ONLY_CONFIG), four spec sources:
//
// - specs/occ.mdx — the containment ground, finding-free: behind a
//   multi-byte prose head (SPEC 1.7), a blank-line-separated import binding
//   CIBLE (MDX block grammar: an import glued to a paragraph is prose, so
//   the separation is load-bearing), then one section `host` bearing
//   `d={CIBLE.but}` on its opening tag and an MDX embedding
//   `{text(CIBLE.but)}` in its body — both spellings resolve into
//   specs/cible.mdx#but, so both record occurrences (SPEC 5.7): the `d`
//   occurrence spans that one reference's own expression (`CIBLE.but`), the
//   embedding occurrence the entire braced container, opening brace through
//   closing brace. Offsets at each range's start and at end − 1 report the
//   containing occurrence's full 12.7 record — file, byte-exact range, kind
//   (`depends` / `embeds`), source graph node {identity, range} (`host` and
//   its construct range for both spellings, SPEC 2.2, 2.3), and resolved
//   target — while the end offset and the byte immediately before the start
//   report none (`occurrence` null), realizing 1.7's start-inclusive,
//   end-exclusive convention on both edges. Every probed offset lies inside
//   `host`'s construct and inside no other section, so `section` is pinned
//   to the same {identity, range} constant throughout, and each answer is
//   findings [] at exit 0: the consulted domain is the named file alone
//   (SPEC 11.2) — the workspace's other findings (below) never attach, the
//   sharpest per-file contrast on a failing workspace.
// - specs/cible.mdx — the finding-free reference target.
// - specs/casse.mdx — unparseable (unclosed section tag, 14.20): `at` at
//   offset 0 AND at the EOF caret (the byte-length offset — an offset the
//   argument checks accept, byte length being a property of the bytes, not
//   the parse) each answer with `resolution` exactly the unavailability
//   marker — never a root fallback bypassing the mask — beside exactly the
//   file's one parse-failure finding, exit 1 (SPEC 11.5, 11.2, 12.7).
// - specs/nu<0xFF>.mdx — non-UTF-8-named (14.19), staged exactly when the
//   platform's file names are byte strings (`process.platform === "linux"`,
//   the T11.2-3/T6.5-5 precedent for the entry's "Linux leg" note; every
//   expectation is parameterized on that staging, so the Linux CI leg runs
//   the whole entry and no platform skips the test, H-9). The file is
//   nameable by no argument value (SPEC 12.0: argument values are UTF-8):
//   representative `at` spellings — the exact on-disk path bytes as raw
//   argv (the sharpest: a product resolving byte argv against the
//   filesystem finds the file and answers), the lossy U+FFFD decode, the
//   marked-byte-form JSON rendering (the product's OWN output spelling for
//   the path, 12.7 — still no argument value), and a percent-encoded
//   rendering — each an unknown file, exit 2 with the single 12.7 error
//   document, via the shared T11.2-5 protocol. The glob-reached view stays
//   the one route to its positions: `view --file specs/nu*.mdx` (the
//   byte-wise glob rules of SPEC 7 match the 0xFF byte; the pattern admits
//   no other staged file) answers exit 1 with exactly the file's
//   condition-19 finding (stable code `invalid-source-path`, no locations,
//   the marked-byte-form concerned path) and its one view — `file` in the
//   marked byte form, the full positional tree byte-exact with every node
//   identity, root included, explicitly unavailable (SPEC 11.2, 11.4,
//   12.0, 12.7; T11.2-3 owns the whole-domain sweep).
//
// The gate `build --json` doubles as staging integrity (exactly casse's
// 14.20 plus — where staged — nu's 14.19, so occ.mdx and cible.mdx are
// proven finding-free on pinned ground), and the whole sweep rides one
// whole-root snapshot compare: the failing build writes nothing (SPEC 12.1)
// and on a failing workspace these surfaces answer from current sources and
// write nothing (SPEC 11.2; the no-write contract clauses live at
// T11.2-1/T11.2-6).
//
// Certification note: CONF-AVAIL's scope expressly excludes `at` ("no
// in-scope staging drives `at`" — CERTIFICATIONS.md), and T11.5-3 is in no
// other fixture's scope; its answer-side decode rigor is certified through
// the CONF-AVAIL datum-form violators (the shared 12.7 machinery) and its
// exit-2 arms ride the Exclusions-certified shared protocol.

const UNAVAILABLE = { unavailable: true } as const;

const OC_FILE = "specs/occ.mdx";
const OC_TGT_FILE = "specs/cible.mdx";
const OC_CASSE_FILE = "specs/casse.mdx";

const OC_HEAD_TEXT = "Tête — préambule multi-octets.\n";
const OC_IMPORT_TEXT = 'import CIBLE from "./cible.xspec"';
const OC_HOST_PRE_TEXT = '<S id="host" d={';
const OC_DREF_TEXT = "CIBLE.but";
const OC_HOST_POST_TEXT = "}>";
const OC_BODY_TEXT = "Corps local.\n";
const OC_EMB_TEXT = "{text(CIBLE.but)}";
const OC_TAIL_TEXT = "Queue après l’ancre.\n";

const OC = new ByteFixture();
OC.add(OC_HEAD_TEXT);
OC.add("\n"); // blank line: the import must start its own MDX block
OC.add(OC_IMPORT_TEXT);
OC.add("\n\n");
const OC_HOST_START = OC.pos;
OC.add(OC_HOST_PRE_TEXT);
const OC_DREF = OC.add(OC_DREF_TEXT);
OC.add(OC_HOST_POST_TEXT);
const OC_HOST_OPEN: SourceRange = { start: OC_HOST_START, end: OC.pos };
OC.add("\n");
OC.add(OC_BODY_TEXT);
const OC_EMB = OC.add(OC_EMB_TEXT);
OC.add("\n");
OC.add(OC_TAIL_TEXT);
OC.add(CLOSE_TEXT);
const OC_HOST_RANGE: SourceRange = { start: OC_HOST_START, end: OC.pos };
OC.add("\n");
const OC_SOURCE = OC.source;

const OC_HOST_OPEN_TEXT = `${OC_HOST_PRE_TEXT}${OC_DREF_TEXT}${OC_HOST_POST_TEXT}`;
const OC_HOST_CONSTRUCT_TEXT = `${OC_HOST_OPEN_TEXT}\n${OC_BODY_TEXT}${OC_EMB_TEXT}\n${OC_TAIL_TEXT}${CLOSE_TEXT}`;

const OC_TGT_SOURCE = 'Cible du dossier.\n\n<S id="but">\nTexte visé.\n</S>\n';

/** Every probed offset resolves to `host` (no section nests inside it). */
const OC_HOST_SECTION: AtSection = {
  identity: `${OC_FILE}#host`,
  range: OC_HOST_RANGE,
};

/** Both spellings' source graph node: `host` (SPEC 2.2, 2.3, 5.7). */
const OC_SOURCE_NODE = {
  identity: `${OC_FILE}#host`,
  range: OC_HOST_RANGE,
} as const;
const OC_TARGET = `${OC_TGT_FILE}#but`;

/** The `d` occurrence: that one reference's own expression (SPEC 5.7). */
const OC_D_RECORD: OccurrenceRecord = {
  file: OC_FILE,
  range: OC_DREF,
  kind: "depends",
  source: OC_SOURCE_NODE,
  target: OC_TARGET,
};

/** The embedding occurrence: the entire braced container (SPEC 5.7). */
const OC_EMB_RECORD: OccurrenceRecord = {
  file: OC_FILE,
  range: OC_EMB,
  kind: "embeds",
  source: OC_SOURCE_NODE,
  target: OC_TARGET,
};

/**
 * The containment arms (SPEC 11.5, 1.7): per occurrence, its start and its
 * end − 1 lie within — the record reported with its resolved target — while
 * its end and the byte immediately before its start lie outside — none
 * reported. A fixture self-check proves each arm's offset against the
 * claimed ranges before any product invocation.
 */
const OC_CONTAINMENT_ARMS: readonly {
  readonly what: string;
  readonly offset: number;
  readonly occurrence: OccurrenceRecord | null;
}[] = [
  {
    what: "the d reference expression's start (start-inclusive, SPEC 1.7)",
    offset: OC_DREF.start,
    occurrence: OC_D_RECORD,
  },
  {
    what: "the d reference expression's end − 1 (the last within-range byte)",
    offset: OC_DREF.end - 1,
    occurrence: OC_D_RECORD,
  },
  {
    what: "the d reference expression's end (end-exclusive: outside, SPEC 1.7)",
    offset: OC_DREF.end,
    occurrence: null,
  },
  {
    what: "the byte immediately before the d reference expression (outside)",
    offset: OC_DREF.start - 1,
    occurrence: null,
  },
  {
    what: "the embedding container's start — its opening brace (SPEC 5.7)",
    offset: OC_EMB.start,
    occurrence: OC_EMB_RECORD,
  },
  {
    what: "the embedding container's end − 1 — its closing brace, within range",
    offset: OC_EMB.end - 1,
    occurrence: OC_EMB_RECORD,
  },
  {
    what: "the embedding container's end (end-exclusive: outside, SPEC 1.7)",
    offset: OC_EMB.end,
    occurrence: null,
  },
  {
    what: "the byte immediately before the embedding container (outside)",
    offset: OC_EMB.start - 1,
    occurrence: null,
  },
];

// The unparseable file (14.20: unclosed section tag; the T11.2-1 shape).
// Composed through ByteFixture so the EOF-caret offset is the same
// arithmetic the staged bytes are.
const OC_CASSE = new ByteFixture();
OC_CASSE.add("Cassé dès l’ouverture.\n\n");
OC_CASSE.add('<S id="seul">\nJamais fermé.\n');
const OC_CASSE_SOURCE = OC_CASSE.source;
const OC_CASSE_LENGTH = OC_CASSE.pos;

// --- specs/nu<0xFF>.mdx — non-UTF-8-named spec source (14.19, Linux leg) -----
// 0xFF can occur in no valid UTF-8 sequence, so the workspace-relative path
// is not valid UTF-8; the byte-wise glob rules of SPEC 7 still discover it.
// The marked byte form is composed from the SAME bytes that stage the file
// (never measured from product output).
const NU3_STAGED = process.platform === "linux";
const NU3_PATH_BYTES = Buffer.concat([
  Buffer.from("specs/nu", "utf8"),
  Buffer.from([0xff]),
  Buffer.from(".mdx", "utf8"),
]);
const NU3_MARKED_PATH = { bytes: NU3_PATH_BYTES.toString("hex") } as const;
const NU3 = new ByteFixture();
NU3.add("Prólogo — chemin invalide.\n\n");
const NU3_SEC_START = NU3.pos;
NU3.add('<S id="solo">\nTexte positionné.\n</S>');
const NU3_SEC_RANGE: SourceRange = { start: NU3_SEC_START, end: NU3.pos };
NU3.add("\n");
const NU3_SOURCE = NU3.source;
const NU3_ROOT_RANGE: SourceRange = { start: 0, end: NU3.pos };

/**
 * Representative `at` spellings for the non-UTF-8-pathed source (SPEC 12.0:
 * argument values are UTF-8, so NO value names it — each is an unknown
 * file, exit 2, whatever the spelling's provenance).
 */
const NU3_AT_SPELLINGS: readonly {
  readonly value: ArgvValue;
  readonly what: string;
}[] = [
  {
    value: NU3_PATH_BYTES,
    what:
      "the exact on-disk path bytes as raw argv — argument values are " +
      "UTF-8 (SPEC 12.0), so the byte string names no discovered file; a " +
      "product resolving byte argv against the filesystem finds the file " +
      "and answers instead",
  },
  {
    value: "specs/nu�.mdx",
    what:
      "the lossy UTF-8 decode (U+FFFD replacing the invalid byte) names a " +
      "different, undiscovered path",
  },
  {
    value: JSON.stringify(NU3_MARKED_PATH),
    what:
      "the marked byte form — the product's own 12.7 output spelling for " +
      "the path — is itself no argument value naming the file (SPEC 12.0)",
  },
  {
    value: "specs/nu%ff.mdx",
    what: "a percent-encoded rendering names a different, undiscovered path",
  },
];

/**
 * The asserted projection of the condition-19 finding (the T11.2-3
 * discipline): stable code token, the empty locations of a path-level
 * condition, the concerned path in the marked byte form (SPEC 14, 12.7).
 * Message and identities stay unpinned.
 */
function projectNu3Finding(finding: Finding): {
  readonly code: string | null;
  readonly locations: readonly unknown[];
  readonly path: unknown;
} {
  return {
    code: finding.code,
    locations: finding.locations,
    path: finding.path,
  };
}

/** Range containment under SPEC 1.7 (start-inclusive, end-exclusive). */
function containsOffset(range: SourceRange, offset: number): boolean {
  return range.start <= offset && offset < range.end;
}

const T11_5_3 = defineProductTest({
  id: "T11.5-3",
  title:
    "occurrence containment ends and imperfect files: on a finding-free file whose section `host` bears `d={CIBLE.but}` and embeds `{text(CIBLE.but)}` — both resolving into specs/cible.mdx#but — offsets at the d reference expression's start and end − 1 report the containing occurrence's full 12.7 record (file, byte-exact range, kind `depends`, source graph node {identity, range} = host, resolved target) while the end offset and the byte before the start report none, and likewise for the embedding container (opening brace through closing brace, kind `embeds`) — start-inclusive, end-exclusive (SPEC 1.7) — every answer findings [] at exit 0, the consulted domain being the named file alone whatever the workspace's other findings; the unparseable specs/casse.mdx (unclosed section tag) answers `at` offset 0 AND the EOF caret with `resolution` exactly the unavailability marker — no root fallback bypasses the mask — beside exactly its one located 14.20, exit 1; and — staged where file names are byte strings (Linux leg) — the non-UTF-8-pathed specs/nu<0xFF>.mdx is nameable by no argument value: the exact on-disk path bytes as raw argv, the lossy U+FFFD decode, the marked-byte-form JSON rendering, and a percent-encoded rendering each exit 2 as an unknown file with the single 12.7 error document, while the glob-reached view (`view --file specs/nu*.mdx`, byte-wise glob) stays the one route to its positions: exit 1 with exactly its condition-19 finding (stable code `invalid-source-path`, locations [], the marked-byte-form concerned path) and its full positional tree byte-exact, every node identity — root included — explicitly unavailable; no invocation of the sweep modifies anything (SPEC 11.5, 11.2, 5.7, 1.7, 12.0, 12.7; T11.2-3, T11.2-5)",
  run: async (product) => {
    // Fixture self-checks (T5.7-2 discipline) — composed-range arithmetic
    // proven against the staged bytes before any product invocation.
    sliceCheck(OC_SOURCE, OC_DREF, OC_DREF_TEXT, "the d reference expression");
    sliceCheck(OC_SOURCE, OC_EMB, OC_EMB_TEXT, "the embedding container");
    sliceCheck(OC_SOURCE, OC_HOST_OPEN, OC_HOST_OPEN_TEXT, "host's open tag");
    sliceCheck(
      OC_SOURCE,
      OC_HOST_RANGE,
      OC_HOST_CONSTRUCT_TEXT,
      "host's construct",
    );
    sliceCheck(
      NU3_SOURCE,
      NU3_SEC_RANGE,
      '<S id="solo">\nTexte positionné.\n</S>',
      "the non-UTF-8-named file's section construct",
    );
    if (Buffer.byteLength(OC_CASSE_SOURCE, "utf8") !== OC_CASSE_LENGTH) {
      fail(
        `§11.5 fixture self-check — the composed byte length ` +
          `${String(OC_CASSE_LENGTH)} must equal specs/casse.mdx's staged ` +
          `byte length (a harness-side staging error, not a product failure)`,
      );
    }
    // Both occurrence ranges lie within host's construct and are disjoint;
    // each arm's offset lies inside host, and inside its expected record's
    // range or inside NEITHER record's range — so the arm table's section
    // and occurrence expectations rest on proven staging arithmetic.
    for (const arm of OC_CONTAINMENT_ARMS) {
      if (!containsOffset(OC_HOST_RANGE, arm.offset)) {
        fail(
          `§11.5 fixture self-check — offset ${String(arm.offset)} ` +
            `(${arm.what}) must lie within host's construct range ` +
            `[${String(OC_HOST_RANGE.start)}, ${String(OC_HOST_RANGE.end)}) ` +
            `(a harness-side staging error, not a product failure)`,
        );
      }
      const inD = containsOffset(OC_DREF, arm.offset);
      const inEmb = containsOffset(OC_EMB, arm.offset);
      const expected =
        arm.occurrence === null
          ? !inD && !inEmb
          : arm.occurrence === OC_D_RECORD
            ? inD && !inEmb
            : inEmb && !inD;
      if (!expected) {
        fail(
          `§11.5 fixture self-check — offset ${String(arm.offset)} ` +
            `(${arm.what}): the arm's expected occurrence disagrees with ` +
            `range containment over the staged fixture (in d: ` +
            `${String(inD)}, in embedding: ${String(inEmb)}) — a ` +
            `harness-side staging error, not a product failure`,
        );
      }
    }

    const workspace = await TestWorkspace.create({
      files: {
        "xspec.config.ts": SPECS_ONLY_CONFIG,
        [OC_FILE]: OC_SOURCE,
        [OC_TGT_FILE]: OC_TGT_SOURCE,
        [OC_CASSE_FILE]: OC_CASSE_SOURCE,
      },
    });
    try {
      if (NU3_STAGED) {
        await workspace.file(NU3_PATH_BYTES, NU3_SOURCE);
      }
      await assertLeavesUnchanged(
        workspace.root,
        async () => {
          // Gate reference and staging integrity (SPEC 12.1, 14): exactly
          // casse's 14.20 plus — where staged — nu's 14.19, nothing else,
          // so occ.mdx and cible.mdx are finding-free on pinned ground
          // (the d reference and the embedding both resolve: an unresolved
          // or unparsed spelling would surface here as 14.5/14.8).
          const gateContext =
            "T11.5-3 `build --json` (staging integrity: one 14.20 in " +
            "specs/casse.mdx" +
            (NU3_STAGED
              ? ", one 14.19 for the non-UTF-8-named specs/nu<0xFF>.mdx"
              : "") +
            "; specs/occ.mdx and specs/cible.mdx finding-free)";
          const gateFindings = await buildFindings(
            product,
            workspace,
            gateContext,
          );
          assertConditionCounts(
            gateFindings,
            NU3_STAGED ? { "14.20": 1, "14.19": 1 } : { "14.20": 1 },
            `${gateContext} — exactly the staged conditions (SPEC 14)`,
          );
          assertFindingLocated(
            gateFindings.find((finding) => finding.condition === "14.20")!,
            { file: OC_CASSE_FILE },
            `${gateContext} — the parse failure locates in the ` +
              `unparseable file (SPEC 14.20, 14)`,
          );
          if (NU3_STAGED) {
            assertSameJson(
              projectNu3Finding(
                gateFindings.find((finding) => finding.condition === "14.19")!,
              ),
              {
                code: "invalid-source-path",
                locations: [],
                path: NU3_MARKED_PATH,
              },
              `${gateContext} — the condition-19 finding carries the ` +
                `stable code, no in-source locations, and the non-UTF-8 ` +
                `concerned path in the marked byte form (SPEC 14, 12.0, ` +
                `12.7)`,
            );
          }

          // --- Occurrence containment (SPEC 11.5, 5.7, 1.7): within-range
          // offsets report the containing occurrence's record and resolved
          // target; the end offset and other outside offsets report none.
          for (const arm of OC_CONTAINMENT_ARMS) {
            const context = `T11.5-3 \`at ${OC_FILE} ${String(arm.offset)}\` — ${arm.what}`;
            const report = decodeAtReport(
              await runJson(
                product,
                workspace,
                ["at", OC_FILE, String(arm.offset)],
                `${context} — a single JSON document is the only output ` +
                  `form, and the named file's domain is finding-free, so ` +
                  `the complete answer exits 0 (SPEC 11, 11.2, 11.5)`,
              ),
              context,
            );
            assertSameJson(
              report.findings,
              [],
              `${context} — the consulted domain is the named file alone ` +
                `and specs/occ.mdx is finding-free: the workspace's staged ` +
                `14.20/14.19 are no domain file's findings (SPEC 11.2, ` +
                `11.5)`,
            );
            assertSameJson(
              report.resolution,
              { section: OC_HOST_SECTION, occurrence: arm.occurrence },
              `${context}: the innermost containing section construct is ` +
                `host ({identity, range} byte-exact), and the containing ` +
                `occurrence — reported as the full 12.7 record with its ` +
                `file, byte-exact range, kind, source graph node, and ` +
                `resolved target — is determined by range containment, ` +
                `start-inclusive and end-exclusive (SPEC 11.5, 5.7, 1.7, ` +
                `12.7)`,
            );
          }

          // --- The unparseable file (SPEC 11.5, 11.2): resolution
          // explicitly unavailable — at offset 0 AND at the EOF caret, so
          // no root fallback bypasses the mask — the parse-failure finding
          // accompanying, exit 1 with the full answer still emitted.
          for (const offset of [0, OC_CASSE_LENGTH]) {
            const context = `T11.5-3 \`at ${OC_CASSE_FILE} ${String(offset)}\` (the unparseable file${offset === 0 ? "" : ", the EOF caret"})`;
            const result = await expectExit(
              product,
              workspace,
              ["at", OC_CASSE_FILE, String(offset)],
              1,
              `${context} — the answer carries the parse-failure finding ` +
                `and an explicitly-unavailable resolution, so exit 1 with ` +
                `the full answer document still emitted (SPEC 11.2, 11.5)`,
            );
            const report = decodeAtReport(
              parseJsonStdout(
                result,
                `${context} — the full answer document is still emitted, ` +
                  `complete and parseable (SPEC 11.2, H-5)`,
              ),
              context,
            );
            assertSameJson(
              report.resolution,
              UNAVAILABLE,
              `${context} — on an unparseable file the resolution is ` +
                `reported explicitly unavailable: exactly the ` +
                `unavailability marker, never null, never a fabricated ` +
                `root resolution (SPEC 11.5, 11.2, 12.7)`,
            );
            assertConditionCounts(
              report.findings,
              { "14.20": 1 },
              `${context} — exactly the named file's parse-failure ` +
                `finding accompanies (SPEC 11.2, 14.20)`,
            );
            assertFindingLocated(
              report.findings[0]!,
              { file: OC_CASSE_FILE },
              `${context} — the parse failure locates in the named file ` +
                `(SPEC 14)`,
            );
          }

          // --- The non-UTF-8-pathed source (SPEC 12.0, 11.5; Linux leg):
          // nameable by no argument value — every `at` spelling for it is
          // an unknown file, exit 2 — while the glob-reached view is the
          // one route to its positions.
          if (NU3_STAGED) {
            for (const spelling of NU3_AT_SPELLINGS) {
              await expectAvailabilityUsageError(
                product,
                workspace,
                ["at", spelling.value, "0"],
                `T11.5-3 non-UTF-8-pathed source, \`at\` spelling: ` +
                  `${spelling.what} — an unknown file, the usage error of ` +
                  `12.0 (SPEC 11.5, 11.4, 12.0)`,
              );
            }

            const viewContext =
              "T11.5-3 `view --file specs/nu*.mdx` (the glob-reached " +
              "view: the one route to the non-UTF-8-pathed file's " +
              "positions)";
            const viewResult = await runCli(product, workspace, [
              "view",
              "--file",
              "specs/nu*.mdx",
            ]);
            assertExitCode(
              viewResult,
              1,
              `${viewContext} — the answer carries the file's ` +
                `condition-19 finding and explicitly-unavailable ` +
                `identities, so exit 1 with the full document still ` +
                `emitted (SPEC 11.2, 11.4)`,
            );
            const viewReport = decodeViewReport(
              parseJsonStdout(
                viewResult,
                `${viewContext} — a single JSON document is the only ` +
                  `output form (SPEC 11)`,
              ),
              { text: false },
              viewContext,
            );
            assertSameJson(
              viewReport.findings.map(projectNu3Finding),
              [
                {
                  code: "invalid-source-path",
                  locations: [],
                  path: NU3_MARKED_PATH,
                },
              ],
              `${viewContext} — exactly the admitted file's condition-19 ` +
                `finding accompanies: stable code, no in-source ` +
                `locations, the concerned path in the marked byte form ` +
                `(SPEC 11.2, 14, 12.0, 12.7)`,
            );
            assertSameJson(
              viewReport.views.map((view) => view.file),
              [NU3_MARKED_PATH],
              `${viewContext} — the byte-wise glob admits exactly the ` +
                `non-UTF-8-named file, its \`file\` member presented in ` +
                `the marked byte form (SPEC 7, 11.4, 12.0, 12.7)`,
            );
            assertSameJson(
              projectResolution(viewReport.views[0]!.root),
              {
                identity: UNAVAILABLE,
                range: NU3_ROOT_RANGE,
                children: [
                  {
                    identity: UNAVAILABLE,
                    range: NU3_SEC_RANGE,
                    children: [],
                  },
                ],
              },
              `${viewContext} — the view serves the file's full ` +
                `positional tree with byte-exact construct ranges — the ` +
                `position data \`at\` cannot address — while every node ` +
                `identity, root included, is explicitly unavailable ` +
                `(SPEC 11.2, 11.4, 1.7)`,
            );
          }
        },
        "T11.5-3 — no invocation of the sweep modifies anything: the gate " +
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

export const section115Tests: readonly ProductTestEntry[] = [
  T11_5_1,
  T11_5_2,
  T11_5_3,
];
