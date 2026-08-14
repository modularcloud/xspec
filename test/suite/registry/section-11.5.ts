// TEST-SPEC §11.5 (`xspec at`) — SUITE-55: T11.5-1 and T11.5-2 (T11.5-3
// follows in this module as it is implemented).
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
  OccurrenceRecord,
  SourceRange,
  ViewNode,
} from "../../helpers/adapters/index.js";
import {
  decodeAtReport,
  decodeViewReport,
} from "../../helpers/adapters/index.js";
import { fail, parseJsonStdout } from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { assertLeavesUnchanged } from "../../helpers/snapshot.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
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
// composed, never retyped.

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
const IMPORT_ONE = F.add(IMPORT_ONE_TEXT);
F.add("\n");
const IMPORT_TWO = F.add(IMPORT_TWO_TEXT);
F.add("\n");
const COMMENT_TOP = F.add(COMMENT_TOP_TEXT);
F.add("\n");
const A_OPEN = F.add(A_OPEN_TEXT);
F.add("\n");
F.add(A_PROSE_TEXT);
const AB_OPEN = F.add(AB_OPEN_TEXT);
F.add("\n");
const ABC_OPEN = F.add(ABC_OPEN_TEXT);
F.add("\n");
const DEEP_PROSE = F.add(DEEP_PROSE_TEXT);
const COMMENT_DEEP = F.add(COMMENT_DEEP_TEXT);
F.add("\n");
F.add(CLOSE_TEXT);
const ABC_RANGE: SourceRange = { start: ABC_OPEN.start, end: F.pos };
F.add("\n");
const AB_TAIL = F.add(AB_TAIL_TEXT);
F.add(CLOSE_TEXT);
const AB_RANGE: SourceRange = { start: AB_OPEN.start, end: F.pos };
F.add("\n");
const A_CLOSE = F.add(CLOSE_TEXT);
const A_RANGE: SourceRange = { start: A_OPEN.start, end: F.pos };
F.add("\n");
const PROSE_BETWEEN = F.add(PROSE_BETWEEN_TEXT);
const Z_OPEN = F.add(Z_OPEN_TEXT);
F.add("\n");
F.add(Z_PROSE_TEXT);
const Z_CLOSE = F.add(CLOSE_TEXT);
const Z_RANGE: SourceRange = { start: Z_OPEN.start, end: F.pos };
F.add("\n");
const AT_SOURCE = F.source;
const AT_LENGTH = F.pos;
const ROOT_RANGE: SourceRange = { start: 0, end: AT_LENGTH };

// Composed construct-slice expectations (never retyped): each paired
// section's construct spans its opening tag's first character through its
// closing tag's last (SPEC 1.7).
const ABC_CONSTRUCT_TEXT = `${ABC_OPEN_TEXT}\n${DEEP_PROSE_TEXT}${COMMENT_DEEP_TEXT}\n${CLOSE_TEXT}`;
const AB_CONSTRUCT_TEXT = `${AB_OPEN_TEXT}\n${ABC_CONSTRUCT_TEXT}\n${AB_TAIL_TEXT}${CLOSE_TEXT}`;
const A_CONSTRUCT_TEXT = `${A_OPEN_TEXT}\n${A_PROSE_TEXT}${AB_CONSTRUCT_TEXT}\n${CLOSE_TEXT}`;
const Z_CONSTRUCT_TEXT = `${Z_OPEN_TEXT}\n${Z_PROSE_TEXT}${CLOSE_TEXT}`;

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

export const section115Tests: readonly ProductTestEntry[] = [T11_5_1, T11_5_2];
