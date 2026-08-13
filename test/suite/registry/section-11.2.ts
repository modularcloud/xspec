// TEST-SPEC §11.2 (availability on imperfect files) — SUITE-52: T11.2-1
// through T11.2-3.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), and rejects a product only via diagnosed
// assertion failures (H-8).
//
// Certification (CERTIFICATIONS.md CONF-AVAIL): T11.2-2 is in scope —
// VIOL-AVAIL-NULLMARKER and VIOL-AVAIL-OMIT certify it (the fixture family
// lands with the certification-manifest task). CONF-AVAIL's staging
// constraint pins every command an in-scope test drives to its enumerated
// `view`/`occurrences` surface, so T11.2-2 runs NO gate-reference `build`
// (unlike T11.2-1 and T11.2-3, which are not in scope — CONF-AVAIL's
// workspace scope is `#`-free valid-UTF-8 paths with no code groups, so
// T11.2-3's staging lies outside it by construction): staging integrity
// rides the `view` answer's own exact accompanying-findings multiset
// instead, and the staged conditions are drawn from the scope's stated set
// (14.1, 14.3, 14.4, 14.17).
//
// SPEC 11.2: `occurrences`, `view`, and `at` answer per file, from parsing
// alone, never gated on workspace-wide validity — parse-local structure (the
// positional tree, construct ranges, raw attribute spellings, comment
// ranges, reference-occurrence positions) survives the file's own findings
// and other files' invalidity; only an unparseable file (14.20) loses its
// structural data, per file. The three surfaces are JSON-only (SPEC 11): a
// single JSON document is the only output form, with or without `--json`,
// in the form-exact 12.7 document forms (H-3) — so every invocation below
// runs bare and its entire stdout is parsed as one JSON document.
//
// Conservative operationalizations (noted per H-3/H-4):
// - "`view` over all three" is the bare whole-domain form (SPEC 11.4: with
//   neither operands nor `--file`, every discovered spec source is viewed).
// - "all served" is realized byte-exactly over a projection of each per-file
//   view: tree shape, per-node identity datum (the 11.2 three-state — the
//   tree's anchoring), construct range, and raw attribute entries
//   (name/range/text), plus the comment ranges and the full occurrence
//   records (SPEC 5.7 pins every member). Every expected range is composed
//   from the same string parts the staged files are — never measured from
//   product output — and fixture self-checks slice claimed ranges back out
//   of the staged bytes before the product runs (the T5.7-2 discipline).
//   Deliberately OUTSIDE the projection, at their home tests: the
//   opening/closing tag-range decompositions (T11.4-1 byte-asserts them),
//   and the interpreted `tags`/`coverage` datums (T11.2-2's matrix,
//   T11.4-3) — the form-exact decode still validates their forms.
// - "modify nothing: graph data and derived files byte-identical around each
//   invocation" is a whole-workspace-root snapshot compare around every
//   invocation (H-4): the workspace never passes `build`, so no graph data
//   and no derived files exist — any write (`.xspec/`, a module, Markdown)
//   surfaces in the diff. The gate-reference `build` rides the same compare
//   (a failing build modifies nothing, SPEC 12.1).
// - The failing-side `occurrences` and `at` answers are asserted here per
//   T11.2-6's delegation ("on a failing one they answer from current
//   sources and write nothing (T11.2-1)"): `occurrences` bare answers the
//   whole discovered set's enumeration with the workspace's findings
//   (exit 1), while `at` on the finding-free C answers finding-free with
//   exit 0 — its consulted domain is the named file alone (SPEC 11.5), the
//   sharpest per-file contrast on a failing workspace.
// - The `build --json` gate reference doubles as staging integrity: exactly
//   the staged condition multiset — findings of both levels in A (14.5,
//   14.9 resolution-level; 14.3, 14.4, 14.16, 14.17 per-file structural)
//   and B's 14.20 — so "the workspace fails `build`" and every later
//   exact-findings assertion stand on pinned ground. Finding LOCATIONS are
//   asserted at file granularity only (range precision is T14-8's).

import { Buffer } from "node:buffer";
import type {
  Finding,
  OccurrenceRecord,
  PathValue,
  SourceRange,
  ViewAttributeEntry,
  ViewNode,
} from "../../helpers/adapters/index.js";
import {
  decodeAtReport,
  decodeFindingsReport,
  decodeOccurrencesReport,
  decodeViewReport,
} from "../../helpers/adapters/index.js";
import { assertExitCode, parseJsonStdout } from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { assertLeavesUnchanged } from "../../helpers/snapshot.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import {
  assertConditionCounts,
  assertFindingLocated,
  assertSameJson,
  expectExit,
  runCli,
} from "./support.js";

// Minimal declarative configuration (SPEC 7): exactly one spec group.
const SPECS_ONLY_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`;

const A_FILE = "specs/A.mdx";
const B_FILE = "specs/B.mdx";
const C_FILE = "specs/C.mdx";

/**
 * Running byte-offset fixture assembler (the T5.7-2/T1.7-2 discipline):
 * `add` appends a segment and returns its byte range, `attr` an attribute
 * segment as the expected `{name, range, text}` view entry (SPEC 11.4: the
 * source text is the attribute's own characters, so entry text = segment).
 * Every expected offset is composed from the same parts the staged file is.
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

  attr(name: string, text: string): ViewAttributeEntry {
    return { name, range: this.add(text), text };
  }
}

/** The 12.7 unavailability marker, as decoded (one-datum state). */
const UNAVAILABLE = { unavailable: true } as const;

// --- specs/A.mdx — parseable, findings of both levels ------------------------
//
// Resolution-level: `gone`'s `d={"nosuch"}` is unresolved (14.5, records no
// occurrence); `top`'s `d={"top"}` is a dependency self-cycle of length one
// (SPEC 5.3, 14.9) — the spelling RESOLVES (its target's identity is
// defined), so it records a `depends` occurrence: exactly the
// positions-survive-findings demonstration. Per-file structural: the two
// `dup` bearers (14.3, every bearer's identity undefined, no winner —
// SPEC 11.2), the malformed one-segment `ha#sh` (14.4; its spelled identity
// is malformed, so its node identity is undefined), `top.kid`'s unknown
// `bogus` prop (14.17; identity untouched), and the `<div>` element (14.16 —
// no view entry, located by its finding instead, SPEC 11.4). `top`'s
// `{text("solo")}` resolves to the self-closing `solo` leaf and records the
// second occurrence (`embeds`, spanning the whole braced container, 5.7).
// The multi-byte prefix (é: 2 bytes; —: 3 bytes) shifts every later offset,
// so byte offsets diverge from code-point and UTF-16 counts (SPEC 1.7).

const A = new ByteFixture();
A.add("Prélude — multi-byte guard prose.\n\n");
const A_COMMENT_TEXT = "{/* availability survey */}";
const A_COMMENT_RANGE = A.add(A_COMMENT_TEXT);
A.add("\n\n");
const A_TOP_START = A.pos;
A.add("<S ");
const A_TOP_ID = A.attr("id", 'id="top"');
A.add(" ");
const A_TOP_D = A.attr("d", 'd={"top"}');
A.add(">\nTop text.\n\n");
const A_EMBED_TEXT = '{text("solo")}';
const A_EMBED_RANGE = A.add(A_EMBED_TEXT);
A.add("\n\n");
const A_KID_START = A.pos;
A.add("<S ");
const A_KID_ID = A.attr("id", 'id="top.kid"');
A.add(" ");
const A_KID_BOGUS = A.attr("bogus", 'bogus="x"');
A.add(">\nKid text.\n</S>");
const A_KID_RANGE: SourceRange = { start: A_KID_START, end: A.pos };
A.add("\n</S>");
const A_TOP_RANGE: SourceRange = { start: A_TOP_START, end: A.pos };
A.add("\n\n");
const A_DUP1_START = A.pos;
A.add("<S ");
const A_DUP1_ID = A.attr("id", 'id="dup"');
A.add(">\nFirst bearer.\n</S>");
const A_DUP1_RANGE: SourceRange = { start: A_DUP1_START, end: A.pos };
A.add("\n\n");
const A_DUP2_START = A.pos;
A.add("<S ");
const A_DUP2_ID = A.attr("id", 'id="dup"');
A.add(">\nSecond bearer.\n</S>");
const A_DUP2_RANGE: SourceRange = { start: A_DUP2_START, end: A.pos };
A.add("\n\n");
const A_HASH_START = A.pos;
A.add("<S ");
const A_HASH_ID = A.attr("id", 'id="ha#sh"');
A.add(">\nMalformed segment.\n</S>");
const A_HASH_RANGE: SourceRange = { start: A_HASH_START, end: A.pos };
A.add("\n\n");
const A_GONE_START = A.pos;
A.add("<S ");
const A_GONE_ID = A.attr("id", 'id="gone"');
A.add(" ");
const A_GONE_D = A.attr("d", 'd={"nosuch"}');
A.add(">\nUnresolved dependency.\n</S>");
const A_GONE_RANGE: SourceRange = { start: A_GONE_START, end: A.pos };
A.add("\n\n<div>stray</div>\n\n");
const A_SOLO_TEXT_START = A.pos;
A.add("<S ");
const A_SOLO_ID = A.attr("id", 'id="solo"');
A.add(" />");
const A_SOLO_RANGE: SourceRange = { start: A_SOLO_TEXT_START, end: A.pos };
A.add("\n");
const A_SOURCE = A.source;
const A_ROOT_RANGE: SourceRange = { start: 0, end: A.pos };

/**
 * The string-literal reference inside a `d={"…"}` attribute: `d={` and the
 * closing `}` excluded — a `d` occurrence spans that one reference's own
 * expression, the string literal's characters quotes included (SPEC 5.7,
 * 2.2; the T5.7-2 local-form convention). ASCII segment, so character
 * arithmetic is byte arithmetic.
 */
function dLiteralRange(attribute: ViewAttributeEntry): SourceRange {
  return {
    start: attribute.range.start + "d={".length,
    end: attribute.range.end - 1,
  };
}
const A_TOP_D_REF = dLiteralRange(A_TOP_D);

// --- specs/B.mdx — unparseable (14.20: unclosed section tag) ------------------
const B_SOURCE = '<S id="broken">\nNever closed.\n';

// --- specs/C.mdx — finding-free ----------------------------------------------
const C = new ByteFixture();
C.add("Intro prose.\n\n");
const C_SECTION_START = C.pos;
C.add("<S ");
const C_ID = C.attr("id", 'id="c"');
C.add(">\nComplete text.\n</S>");
const C_SECTION_RANGE: SourceRange = { start: C_SECTION_START, end: C.pos };
C.add("\n");
const C_SOURCE = C.source;
const C_ROOT_RANGE: SourceRange = { start: 0, end: C.pos };

// --- expected values ----------------------------------------------------------

/**
 * The tree projection T11.2-1 pins (its named clauses): per node, the
 * identity datum (11.2 three-state), the construct range (1.7), the raw
 * attribute entries as parsed, and the children in document order. The
 * opening/closing decompositions and interpreted tags/coverage stay outside
 * — T11.4-1, T11.2-2/T11.4-3 pin those; the form-exact decode has already
 * validated their forms.
 */
interface TreeExpectation {
  readonly identity: string | { readonly unavailable: true };
  readonly range: SourceRange;
  readonly attributes: readonly ViewAttributeEntry[];
  readonly children: readonly TreeExpectation[];
}

function projectNode(node: ViewNode): TreeExpectation {
  return {
    identity: node.identity,
    range: node.range,
    attributes: node.attributes.map((entry) => ({
      name: entry.name,
      range: entry.range,
      text: entry.text,
    })),
    children: node.children.map(projectNode),
  };
}

// A's full positional tree: the `<div>` gets no node (14.16 — located by its
// finding, never a view entry); the duplicate bearers and the malformed
// `ha#sh` keep their structure with identities explicitly unavailable
// (SPEC 11.2: no winner picked; a malformed spelled identity is undefined),
// while `top`, `top.kid`, `gone`, and `solo` stay defined — an unknown prop
// (14.17) and resolution-level findings never undefine an identity.
const A_TREE: TreeExpectation = {
  identity: A_FILE,
  range: A_ROOT_RANGE,
  attributes: [],
  children: [
    {
      identity: `${A_FILE}#top`,
      range: A_TOP_RANGE,
      attributes: [A_TOP_ID, A_TOP_D],
      children: [
        {
          identity: `${A_FILE}#top.kid`,
          range: A_KID_RANGE,
          attributes: [A_KID_ID, A_KID_BOGUS],
          children: [],
        },
      ],
    },
    {
      identity: UNAVAILABLE,
      range: A_DUP1_RANGE,
      attributes: [A_DUP1_ID],
      children: [],
    },
    {
      identity: UNAVAILABLE,
      range: A_DUP2_RANGE,
      attributes: [A_DUP2_ID],
      children: [],
    },
    {
      identity: UNAVAILABLE,
      range: A_HASH_RANGE,
      attributes: [A_HASH_ID],
      children: [],
    },
    {
      identity: `${A_FILE}#gone`,
      range: A_GONE_RANGE,
      attributes: [A_GONE_ID, A_GONE_D],
      children: [],
    },
    {
      identity: `${A_FILE}#solo`,
      range: A_SOLO_RANGE,
      attributes: [A_SOLO_ID],
      children: [],
    },
  ],
};

const C_TREE: TreeExpectation = {
  identity: C_FILE,
  range: C_ROOT_RANGE,
  attributes: [],
  children: [
    {
      identity: `${C_FILE}#c`,
      range: C_SECTION_RANGE,
      attributes: [C_ID],
      children: [],
    },
  ],
};

// A's complete occurrence enumeration (SPEC 5.7): the self-cycle's `d`
// spelling and the embedding — the unresolved `d={"nosuch"}` records none,
// and B's spellings are hidden with the rest of it (11.2). Member order
// mirrors the form decode's construction (assertSameJson is order-exact).
const A_EXPECTED_OCCURRENCES: readonly OccurrenceRecord[] = [
  {
    file: A_FILE,
    range: A_TOP_D_REF,
    kind: "depends",
    source: { identity: `${A_FILE}#top`, range: A_TOP_RANGE },
    target: `${A_FILE}#top`,
  },
  {
    file: A_FILE,
    range: A_EMBED_RANGE,
    kind: "embeds",
    source: { identity: `${A_FILE}#top`, range: A_TOP_RANGE },
    target: `${A_FILE}#solo`,
  },
];

// The staged condition multiset (SPEC 14: each present condition reported):
// A's six findings — one 14.3 locating both bearers, 14.4, 14.5, 14.9 (the
// self-cycle), 14.16, 14.17 — plus B's 14.20. No masking interplay: every
// section spells an `id` (no 14.1), every spelled identity is one segment at
// top level or parent-plus-one (`top.kid`), so no 14.2 arises.
const WORKSPACE_CONDITION_COUNTS: Readonly<Record<string, number>> = {
  "14.3": 1,
  "14.4": 1,
  "14.5": 1,
  "14.9": 1,
  "14.16": 1,
  "14.17": 1,
  "14.20": 1,
};

/**
 * Every finding locates in its home file: B's 14.20 in specs/B.mdx (the
 * parse-failure location), everything else in specs/A.mdx — at file
 * granularity (range precision is T14-8's business).
 */
function assertFindingHomes(
  findings: readonly Finding[],
  context: string,
): void {
  for (const finding of findings) {
    const home = finding.condition === "14.20" ? B_FILE : A_FILE;
    assertFindingLocated(
      finding,
      { file: home },
      `${context} — the ${finding.condition ?? finding.code ?? "code-less"} finding`,
    );
  }
}

/** Fixture self-check (T5.7-2 discipline): a claimed range slices the staged bytes to exactly `expected` — before the product is ever invoked. */
function sliceCheck(
  source: string,
  range: SourceRange,
  expected: string,
  what: string,
): void {
  const actual = Buffer.from(source, "utf8")
    .subarray(range.start, range.end)
    .toString("utf8");
  if (actual !== expected) {
    throw new Error(
      `section-11.2 fixture self-check: ${what} — expected the range ` +
        `[${String(range.start)}, ${String(range.end)}) to slice to ` +
        `${JSON.stringify(expected)}, got ${JSON.stringify(actual)}; the ` +
        `staging arithmetic is wrong (harness defect, not a product result)`,
    );
  }
}

// ---------------------------------------------------------------------------
// T11.2-1 — parse-local structure, per-file masking, no writes
// ---------------------------------------------------------------------------

const T11_2_1 = defineProductTest({
  id: "T11.2-1",
  title:
    "three spec files — A parseable with findings of both levels (unresolved `d`, self-cycle; duplicate-ID pair, malformed segment, unknown prop, invalid construct), B unparseable, C finding-free — fail `build` with exactly the staged conditions; the bare whole-domain `view` (one JSON document, no `--json`) serves A's full positional tree with byte-exact construct ranges, raw attribute spellings, comment ranges, and occurrence records — structure surviving A's own findings and B's invalidity — and C's complete view, while B contributes no view, its parse-failure finding accompanying, exit 1; on the same failing workspace `occurrences` answers the whole enumeration (exit 1) and `at` on C answers finding-free (exit 0, per-file domain); every invocation modifies nothing — no graph data, no derived files (SPEC 11.2, 11.3–11.5, 13.3, 5.7, 14)",
  run: async (product) => {
    // Fixture self-checks (T5.7-2 discipline) — composed-range arithmetic
    // proven against the staged bytes before any product invocation.
    sliceCheck(A_SOURCE, A_TOP_D_REF, '"top"', "the self-cycle d reference");
    sliceCheck(
      A_SOURCE,
      A_EMBED_RANGE,
      A_EMBED_TEXT,
      "the embedding container",
    );
    sliceCheck(A_SOURCE, A_COMMENT_RANGE, A_COMMENT_TEXT, "the MDX comment");
    sliceCheck(A_SOURCE, A_SOLO_RANGE, '<S id="solo" />', "the solo construct");
    sliceCheck(A_SOURCE, A_TOP_ID.range, A_TOP_ID.text, "top's id attribute");
    sliceCheck(
      C_SOURCE,
      C_SECTION_RANGE,
      '<S id="c">\nComplete text.\n</S>',
      "C's section construct",
    );

    const workspace = await TestWorkspace.create({
      files: {
        "xspec.config.ts": SPECS_ONLY_CONFIG,
        [A_FILE]: A_SOURCE,
        [B_FILE]: B_SOURCE,
        [C_FILE]: C_SOURCE,
      },
    });
    try {
      // --- The gate reference and staging integrity: `build` fails with
      // exactly the staged conditions — findings of both levels in A, the
      // parse failure in B — each located in its home file; a failing build
      // modifies nothing (SPEC 12.1, 14).
      const buildContext =
        "T11.2-1 `build --json` (the gate reference: the workspace fails " +
        "`build`, with exactly the staged conditions)";
      await assertLeavesUnchanged(
        workspace.root,
        async () => {
          const result = await expectExit(
            product,
            workspace,
            ["build", "--json"],
            1,
            buildContext,
          );
          const findings = decodeFindingsReport(
            parseJsonStdout(result, buildContext),
            buildContext,
          ).findings;
          assertConditionCounts(
            findings,
            WORKSPACE_CONDITION_COUNTS,
            `${buildContext} — A carries findings of BOTH levels ` +
              `(resolution-level 14.5/14.9; per-file structural ` +
              `14.3/14.4/14.16/14.17) and B is unparseable (14.20)`,
          );
          assertFindingHomes(findings, buildContext);
        },
        `${buildContext} — a failing build modifies nothing (SPEC 12.1)`,
      );

      // --- `view` over all three (the bare whole-domain form, SPEC 11.4):
      // one JSON document, exit 1 (findings accompany, the answer still
      // whole — SPEC 11.2), decoded form-exactly (H-3).
      const viewContext =
        "T11.2-1 bare `view` (whole domain: every discovered spec source)";
      await assertLeavesUnchanged(
        workspace.root,
        async () => {
          const result = await runCli(product, workspace, ["view"]);
          assertExitCode(
            result,
            1,
            `${viewContext} — the answer carries findings and ` +
              `explicitly-unavailable identities, so the invocation exits 1 ` +
              `with the full document still emitted (SPEC 11.2)`,
          );
          const report = decodeViewReport(
            parseJsonStdout(
              result,
              `${viewContext} — a single JSON document is the only output ` +
                `form, with or without --json (SPEC 11)`,
            ),
            { text: false },
            viewContext,
          );

          // The consulted domain is all three requested files, so every
          // staged finding accompanies — B's parse-failure finding included
          // (SPEC 11.2, 11.4).
          assertConditionCounts(
            report.findings,
            WORKSPACE_CONDITION_COUNTS,
            `${viewContext} — the domain's findings accompany the answer, ` +
              `B's 14.20 among them (SPEC 11.2)`,
          );
          assertFindingHomes(report.findings, viewContext);

          // B contributes no view; A's and C's views are served, ordered by
          // file path bytes (SPEC 11.4).
          assertSameJson(
            report.views.map((view) => view.file),
            [A_FILE, C_FILE],
            `${viewContext} — per-file views for exactly the parseable ` +
              `files in path-byte order: B is unparseable and contributes ` +
              `no entry, its finding reporting it instead (SPEC 11.4, 11.2)`,
          );
          const aView = report.views[0]!;
          const cView = report.views[1]!;

          // A's full positional tree — structure survives A's own findings
          // and B's invalidity (SPEC 11.2): tree shape, construct ranges,
          // and raw attribute spellings byte-exact; the invalid `<div>` has
          // no node (14.16 — its finding locates it, SPEC 11.4); identities
          // per 11.2's three-state rules.
          assertSameJson(
            projectNode(aView.root),
            A_TREE,
            `${viewContext} — A's full positional tree: document-order ` +
              `nodes with byte-exact construct ranges (SPEC 1.7), raw ` +
              `attribute entries as parsed (name/range/text — the unknown ` +
              `prop included, its invalidity a finding, never an omission), ` +
              `and identity datums per 11.2 (duplicate bearers and the ` +
              `malformed ha#sh explicitly unavailable; top, top.kid, gone, ` +
              `solo defined)`,
          );
          assertSameJson(
            aView.comments,
            [A_COMMENT_RANGE],
            `${viewContext} — A's comment ranges are served (SPEC 11.4)`,
          );
          assertSameJson(
            aView.occurrences,
            A_EXPECTED_OCCURRENCES,
            `${viewContext} — A's occurrence positions are served despite ` +
              `the findings: the self-cycle's d spelling RESOLVES and ` +
              `records its depends occurrence (cycle participation is a ` +
              `finding, not an occurrence eraser — SPEC 11.2, 5.7), the ` +
              `embedding spans its whole braced container, and the ` +
              `unresolved d={"nosuch"} records none`,
          );
          assertSameJson(
            aView.imports,
            [],
            `${viewContext} — A declares no imports (SPEC 11.4: [] never null)`,
          );

          // C's view is complete (SPEC 11.2): the finding-free file's whole
          // structure, empty lists as [] (12.7).
          assertSameJson(
            projectNode(cView.root),
            C_TREE,
            `${viewContext} — C's complete view: root and section with ` +
              `byte-exact ranges and defined identities`,
          );
          assertSameJson(
            [cView.imports, cView.occurrences, cView.comments],
            [[], [], []],
            `${viewContext} — C holds no imports, occurrences, or comments: ` +
              `empty arrays, never null (SPEC 12.7)`,
          );
        },
        `${viewContext} — \`view\` on a failing workspace answers from ` +
          `current sources and modifies nothing: no graph data, no derived ` +
          `files (SPEC 11.2, 13.3)`,
      );

      // --- `occurrences` bare (the whole discovered set, SPEC 11.3): the
      // same domain findings, the same two records — answered per file on
      // the failing workspace, nothing written (T11.2-6 delegates the
      // failing side here).
      const occurrencesContext = "T11.2-1 bare `occurrences`";
      await assertLeavesUnchanged(
        workspace.root,
        async () => {
          const result = await runCli(product, workspace, ["occurrences"]);
          assertExitCode(
            result,
            1,
            `${occurrencesContext} — the enumeration carries the domain's ` +
              `findings, so exit 1 with the full answer (SPEC 11.2, 11.3)`,
          );
          const report = decodeOccurrencesReport(
            parseJsonStdout(
              result,
              `${occurrencesContext} — a single JSON document is the only ` +
                `output form (SPEC 11)`,
            ),
            occurrencesContext,
          );
          assertConditionCounts(
            report.findings,
            WORKSPACE_CONDITION_COUNTS,
            `${occurrencesContext} — the whole discovered set is the ` +
              `consulted domain (SPEC 11.3)`,
          );
          assertFindingHomes(report.findings, occurrencesContext);
          assertSameJson(
            report.occurrences,
            A_EXPECTED_OCCURRENCES,
            `${occurrencesContext} — the workspace's complete enumeration: ` +
              `A's two resolving spellings, byte-exact (SPEC 5.7); the ` +
              `unresolved spelling records none and B's content is hidden ` +
              `with the rest of it (SPEC 11.2)`,
          );
        },
        `${occurrencesContext} — \`occurrences\` on a failing workspace ` +
          `answers from current sources and modifies nothing (SPEC 11.2, 13.3)`,
      );

      // --- `at` on C (SPEC 11.5): the consulted domain is the named file
      // alone, so the answer is finding-free and exits 0 — per-file
      // availability at its sharpest: A's and B's findings do not attach,
      // and the failing workspace never gates the answer (SPEC 11.2).
      const atContext = "T11.2-1 `at specs/C.mdx 0`";
      await assertLeavesUnchanged(
        workspace.root,
        async () => {
          const result = await runCli(product, workspace, ["at", C_FILE, "0"]);
          assertExitCode(
            result,
            0,
            `${atContext} — the consulted domain is the named finding-free ` +
              `file alone, so the complete answer exits 0 on the failing ` +
              `workspace (SPEC 11.5, 11.2)`,
          );
          const report = decodeAtReport(
            parseJsonStdout(
              result,
              `${atContext} — a single JSON document is the only output ` +
                `form (SPEC 11)`,
            ),
            atContext,
          );
          assertSameJson(
            report.findings,
            [],
            `${atContext} — C's findings alone accompany: none (SPEC 11.2)`,
          );
          assertSameJson(
            report.resolution,
            {
              section: { identity: C_FILE, range: C_ROOT_RANGE },
              occurrence: null,
            },
            `${atContext} — offset 0 lies in C's between-section prose, so ` +
              `it resolves to the root (identity the path, range the whole ` +
              `file) with no containing occurrence (SPEC 11.5, 1.7)`,
          );
        },
        `${atContext} — \`at\` on a failing workspace answers from current ` +
          `sources and modifies nothing (SPEC 11.2, 13.3)`,
      );
    } finally {
      await workspace.dispose();
    }
  },
});

// ---------------------------------------------------------------------------
// T11.2-2 — spelled identities and interpreted data
// ---------------------------------------------------------------------------
//
// SPEC 11.2's definedness matrix in one file, every node's identity datum —
// and every node's interpreted tags and coverage — asserted via the bare
// `view` (each a plain value, the root's stated `null`, or the 12.7
// unavailability marker):
//
// - a section spells an identity exactly when EXACTLY ONE `id` attribute
//   occurs on its tag with a quoted static-string value; repeated (values
//   agreeing and disagreeing), braced, valueless, and absent `id` each spell
//   none — identity explicitly unavailable;
// - duplicate spellings (`x` twice) leave every bearer undefined, no winner,
//   while the uniquely spelled `x.y` beneath one bearer keeps its defined
//   identity (uniqueness constrains the section's own spelled identity
//   alone: a defined identity without defined prefix identities);
// - the chain conditions ARE inherited: descendants of a no-`id` section
//   (child and grandchild — the grandchild discriminates a product checking
//   only the immediate parent) and of a malformed-`id` section are undefined;
// - uniqueness compares spelled identities only: the unique `z` stays
//   defined beside a braced `id={"z"}`, whose invalid form contests nothing;
// - absent `tags`/`coverage` props define the defaults (no tags — the plain
//   empty list, never null — and coverage "required"), asserted on every
//   propless section; a repeated, malformed (braced/valueless), or
//   invalid-valued `tags`/`coverage` leaves the interpreted value
//   unavailable, its raw spelling still a listed attribute entry (the full
//   T11.4-3 attribute contract stays at its home test — here the entries
//   pin exactly that no invalid form is omitted); identity is untouched by
//   `tags`/`coverage` invalidity (those sections stay defined).
//
// Staging integrity WITHOUT a `build` gate reference (the CONF-AVAIL surface
// constraint, module header): the answer's findings are pinned as the exact
// staged condition multiset — every finding located in the matrix file —
// so a mis-staged arm (a defect that never fired, or one firing under the
// wrong condition) fails loudly here. Finding locations are asserted at
// file granularity (range precision is T14-8's).

const M_FILE = "specs/M.mdx";

const M = new ByteFixture();
M.add("Prélude — spelled-identity and interpreted-data matrix.\n\n");

// (a) Exactly one quoted static `id` → defined; `coverage="none"` is the
// defined non-default interpreted value (SPEC 2.5).
const M_SOLO_START = M.pos;
M.add("<S ");
const M_SOLO_ID = M.attr("id", 'id="solo"');
M.add(" ");
const M_SOLO_COVERAGE = M.attr("coverage", 'coverage="none"');
M.add(">\nSolo text.\n</S>");
const M_SOLO_RANGE: SourceRange = { start: M_SOLO_START, end: M.pos };
M.add("\n\n");

// (b) Repeated `id`, values agreeing → spells none (14.17, never 14.1); a
// take-any-value product would define #ragree and fail the tree compare.
const M_RAGREE_START = M.pos;
M.add("<S ");
const M_RAGREE_ID1 = M.attr("id", 'id="ragree"');
M.add(" ");
const M_RAGREE_ID2 = M.attr("id", 'id="ragree"');
M.add(">\nAgreeing repeat.\n</S>");
const M_RAGREE_RANGE: SourceRange = { start: M_RAGREE_START, end: M.pos };
M.add("\n\n");

// (c) Repeated `id`, values disagreeing → spells none (14.17); take-first
// (#rone) and take-last (#rtwo) products both fail the tree compare.
const M_RPAIR_START = M.pos;
M.add("<S ");
const M_RPAIR_ID1 = M.attr("id", 'id="rone"');
M.add(" ");
const M_RPAIR_ID2 = M.attr("id", 'id="rtwo"');
M.add(">\nDisagreeing repeat.\n</S>");
const M_RPAIR_RANGE: SourceRange = { start: M_RPAIR_START, end: M.pos };
M.add("\n\n");

// (d) Braced `id={"x"}` → spells none (14.17); TEST-SPEC's own value ties it
// to the duplicate pair below — under any reading its datum is unavailable,
// and the contests-nothing discrimination rides the `z` arm.
const M_BRACEDX_START = M.pos;
M.add("<S ");
const M_BRACEDX_ID = M.attr("id", 'id={"x"}');
M.add(">\nBraced value.\n</S>");
const M_BRACEDX_RANGE: SourceRange = { start: M_BRACEDX_START, end: M.pos };
M.add("\n\n");

// (e) Valueless `id` → spells none (14.17); the raw entry is the bare name.
const M_VALUELESS_START = M.pos;
M.add("<S ");
const M_VALUELESS_ID = M.attr("id", "id");
M.add(">\nValueless id.\n</S>");
const M_VALUELESS_RANGE: SourceRange = { start: M_VALUELESS_START, end: M.pos };
M.add("\n\n");

// (f) No `id` at all → 14.1, identity unavailable — and (h) inheritance:
// the child spells the well-formed, unique `orphan` (its structural check
// masked by the parent's 14.1 — no 14.2), the grandchild `orphan.deep`
// (structurally clean against `orphan`) — both undefined because the chain
// contains a section spelling no identity. The grandchild discriminates a
// product that checks only its immediate parent's spelling.
const M_NOID_START = M.pos;
M.add("<S>\nNo id here.\n\n");
const M_ORPHAN_START = M.pos;
M.add("<S ");
const M_ORPHAN_ID = M.attr("id", 'id="orphan"');
M.add(">\nOrphan text.\n\n");
const M_DEEP_START = M.pos;
M.add("<S ");
const M_DEEP_ID = M.attr("id", 'id="orphan.deep"');
M.add(">\nDeep text.\n</S>");
const M_DEEP_RANGE: SourceRange = { start: M_DEEP_START, end: M.pos };
M.add("\n</S>");
const M_ORPHAN_RANGE: SourceRange = { start: M_ORPHAN_START, end: M.pos };
M.add("\n</S>");
const M_NOID_RANGE: SourceRange = { start: M_NOID_START, end: M.pos };
M.add("\n\n");

// (g) Two sections both spelling `x` → one 14.3 locating both bearers, both
// identities unavailable, no winner — while the uniquely spelled `x.y`
// beneath the first keeps its defined identity: defined without defined
// prefixes (duplication is not a chain condition).
const M_X1_START = M.pos;
M.add("<S ");
const M_X1_ID = M.attr("id", 'id="x"');
M.add(">\nFirst duplicate bearer.\n\n");
const M_XY_START = M.pos;
M.add("<S ");
const M_XY_ID = M.attr("id", 'id="x.y"');
M.add(">\nUnique descendant.\n</S>");
const M_XY_RANGE: SourceRange = { start: M_XY_START, end: M.pos };
M.add("\n</S>");
const M_X1_RANGE: SourceRange = { start: M_X1_START, end: M.pos };
M.add("\n\n");
const M_X2_START = M.pos;
M.add("<S ");
const M_X2_ID = M.attr("id", 'id="x"');
M.add(">\nSecond duplicate bearer.\n</S>");
const M_X2_RANGE: SourceRange = { start: M_X2_START, end: M.pos };
M.add("\n\n");

// (i) Malformed spelled identity (`ha#sh`, 14.4) with a structurally
// consistent child `ha#sh.kid` — the child's own spelled identity carries
// the malformed segment too (its own 14.4; extending a malformed identity
// cannot avoid its segments), and both are undefined: the chain contains a
// malformed spelled identity. No 14.2 anywhere: the child extends its
// parent's spelling exactly.
const M_HASH_START = M.pos;
M.add("<S ");
const M_HASH_ID = M.attr("id", 'id="ha#sh"');
M.add(">\nMalformed bearer.\n\n");
const M_HASHKID_START = M.pos;
M.add("<S ");
const M_HASHKID_ID = M.attr("id", 'id="ha#sh.kid"');
M.add(">\nMalformed-chain child.\n</S>");
const M_HASHKID_RANGE: SourceRange = { start: M_HASHKID_START, end: M.pos };
M.add("\n</S>");
const M_HASH_RANGE: SourceRange = { start: M_HASH_START, end: M.pos };
M.add("\n\n");

// (j) The unique `z` stays defined beside the braced `id={"z"}`: uniqueness
// compares spelled identities only — an invalid form contests nothing. A
// product reading the braced value would see `z` duplicated and undefine
// the quoted bearer (tree compare) and report a second 14.3 (count map).
// `tags="lone"` doubles as the defined single-tag interpreted value.
const M_Z_START = M.pos;
M.add("<S ");
const M_Z_ID = M.attr("id", 'id="z"');
M.add(" ");
const M_Z_TAGS = M.attr("tags", 'tags="lone"');
M.add(">\nUnique beside invalid forms.\n</S>");
const M_Z_RANGE: SourceRange = { start: M_Z_START, end: M.pos };
M.add("\n\n");
const M_BRACEDZ_START = M.pos;
M.add("<S ");
const M_BRACEDZ_ID = M.attr("id", 'id={"z"}');
M.add(">\nContests nothing.\n</S>");
const M_BRACEDZ_RANGE: SourceRange = { start: M_BRACEDZ_START, end: M.pos };
M.add("\n\n");

// Interpreted tags/coverage matrix (each bearer's own `id` valid and unique,
// pinning that tags/coverage invalidity never undefines identity):
// repeated `tags` (values disagreeing — any picked or merged value fails),
// malformed braced `tags`, invalid-valued `tags` (an invalid tag, 14.4),
// repeated `coverage` (values AGREEING — a take-any product yields the
// plain "none" and fails), valueless `coverage`, invalid `coverage` value.
const M_TR_START = M.pos;
M.add("<S ");
const M_TR_ID = M.attr("id", 'id="tr"');
M.add(" ");
const M_TR_TAGS1 = M.attr("tags", 'tags="alpha"');
M.add(" ");
const M_TR_TAGS2 = M.attr("tags", 'tags="beta"');
M.add(">\nRepeated tags.\n</S>");
const M_TR_RANGE: SourceRange = { start: M_TR_START, end: M.pos };
M.add("\n\n");
const M_TM_START = M.pos;
M.add("<S ");
const M_TM_ID = M.attr("id", 'id="tm"');
M.add(" ");
const M_TM_TAGS = M.attr("tags", 'tags={"alpha"}');
M.add(">\nBraced tags.\n</S>");
const M_TM_RANGE: SourceRange = { start: M_TM_START, end: M.pos };
M.add("\n\n");
const M_TI_START = M.pos;
M.add("<S ");
const M_TI_ID = M.attr("id", 'id="ti"');
M.add(" ");
const M_TI_TAGS = M.attr("tags", 'tags="ok bad#tag"');
M.add(">\nInvalid tag value.\n</S>");
const M_TI_RANGE: SourceRange = { start: M_TI_START, end: M.pos };
M.add("\n\n");
const M_CR_START = M.pos;
M.add("<S ");
const M_CR_ID = M.attr("id", 'id="cr"');
M.add(" ");
const M_CR_COVERAGE1 = M.attr("coverage", 'coverage="none"');
M.add(" ");
const M_CR_COVERAGE2 = M.attr("coverage", 'coverage="none"');
M.add(">\nRepeated coverage.\n</S>");
const M_CR_RANGE: SourceRange = { start: M_CR_START, end: M.pos };
M.add("\n\n");
const M_CM_START = M.pos;
M.add("<S ");
const M_CM_ID = M.attr("id", 'id="cm"');
M.add(" ");
const M_CM_COVERAGE = M.attr("coverage", "coverage");
M.add(">\nValueless coverage.\n</S>");
const M_CM_RANGE: SourceRange = { start: M_CM_START, end: M.pos };
M.add("\n\n");
const M_CI_START = M.pos;
M.add("<S ");
const M_CI_ID = M.attr("id", 'id="ci"');
M.add(" ");
const M_CI_COVERAGE = M.attr("coverage", 'coverage="maybe"');
M.add(">\nInvalid coverage value.\n</S>");
const M_CI_RANGE: SourceRange = { start: M_CI_START, end: M.pos };
M.add("\n");
const M_SOURCE = M.source;
const M_ROOT_RANGE: SourceRange = { start: 0, end: M.pos };

/**
 * The staged condition multiset — the answer's exact accompanying findings
 * (SPEC 11.2, 14), doubling as staging integrity (no `build` gate reference:
 * CONF-AVAIL surface constraint, module header). One finding per afflicted
 * element for 14.17 (each element stages exactly one cause); 14.3 is ONE
 * finding for the jointly-duplicated `x` (locating both bearers); 14.4 once
 * per malformed spelled identity (`ha#sh`, `ha#sh.kid`) plus once for the
 * invalid tag (`bad#tag`, T1.4-4's condition). The masked checks contribute
 * nothing: no 14.1 from repeated/braced/valueless `id` (condition 17, never
 * 1), no 14.2 anywhere (the no-`id` section's child is masked; every other
 * child extends its parent's spelling exactly).
 */
const M_CONDITION_COUNTS: Readonly<Record<string, number>> = {
  "14.1": 1,
  "14.3": 1,
  "14.4": 3,
  "14.17": 10,
};

/**
 * T11.2-2's tree projection: T11.2-1's clauses (identity datum, construct
 * range, raw attribute entries, children) PLUS the interpreted `tags` and
 * `coverage` datums — this test's own matrix. Tag-range decompositions stay
 * outside (T11.4-1's home); the form-exact decode has validated their forms.
 */
interface DatumTreeExpectation {
  readonly identity: ViewNode["identity"];
  readonly range: SourceRange;
  readonly attributes: readonly ViewAttributeEntry[];
  readonly tags: ViewNode["tags"];
  readonly coverage: ViewNode["coverage"];
  readonly children: readonly DatumTreeExpectation[];
}

function projectDatumNode(node: ViewNode): DatumTreeExpectation {
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
    children: node.children.map(projectDatumNode),
  };
}

/** Shorthand for a leaf expectation with defaulted tags/coverage. */
function datumLeaf(
  identity: DatumTreeExpectation["identity"],
  range: SourceRange,
  attributes: readonly ViewAttributeEntry[],
  overrides?: Partial<Pick<DatumTreeExpectation, "tags" | "coverage">> & {
    readonly children?: readonly DatumTreeExpectation[];
  },
): DatumTreeExpectation {
  return {
    identity,
    range,
    attributes,
    // Absent props define the defaults (SPEC 11.2, 2.5, 2.6): no tags — the
    // plain empty list, never null (12.7) — and coverage "required".
    tags: overrides?.tags ?? [],
    coverage: overrides?.coverage ?? "required",
    children: overrides?.children ?? [],
  };
}

// The complete expected tree (document order). Root: identity defined (the
// path is valid), tags/coverage the stated structural-absence `null` (11.4,
// 12.7) — never the marker.
const M_TREE: DatumTreeExpectation = {
  identity: M_FILE,
  range: M_ROOT_RANGE,
  attributes: [],
  tags: null,
  coverage: null,
  children: [
    datumLeaf(`${M_FILE}#solo`, M_SOLO_RANGE, [M_SOLO_ID, M_SOLO_COVERAGE], {
      coverage: "none",
    }),
    datumLeaf(UNAVAILABLE, M_RAGREE_RANGE, [M_RAGREE_ID1, M_RAGREE_ID2]),
    datumLeaf(UNAVAILABLE, M_RPAIR_RANGE, [M_RPAIR_ID1, M_RPAIR_ID2]),
    datumLeaf(UNAVAILABLE, M_BRACEDX_RANGE, [M_BRACEDX_ID]),
    datumLeaf(UNAVAILABLE, M_VALUELESS_RANGE, [M_VALUELESS_ID]),
    datumLeaf(UNAVAILABLE, M_NOID_RANGE, [], {
      children: [
        datumLeaf(UNAVAILABLE, M_ORPHAN_RANGE, [M_ORPHAN_ID], {
          children: [datumLeaf(UNAVAILABLE, M_DEEP_RANGE, [M_DEEP_ID])],
        }),
      ],
    }),
    datumLeaf(UNAVAILABLE, M_X1_RANGE, [M_X1_ID], {
      children: [datumLeaf(`${M_FILE}#x.y`, M_XY_RANGE, [M_XY_ID])],
    }),
    datumLeaf(UNAVAILABLE, M_X2_RANGE, [M_X2_ID]),
    datumLeaf(UNAVAILABLE, M_HASH_RANGE, [M_HASH_ID], {
      children: [datumLeaf(UNAVAILABLE, M_HASHKID_RANGE, [M_HASHKID_ID])],
    }),
    datumLeaf(`${M_FILE}#z`, M_Z_RANGE, [M_Z_ID, M_Z_TAGS], {
      tags: ["lone"],
    }),
    datumLeaf(UNAVAILABLE, M_BRACEDZ_RANGE, [M_BRACEDZ_ID]),
    datumLeaf(`${M_FILE}#tr`, M_TR_RANGE, [M_TR_ID, M_TR_TAGS1, M_TR_TAGS2], {
      tags: UNAVAILABLE,
    }),
    datumLeaf(`${M_FILE}#tm`, M_TM_RANGE, [M_TM_ID, M_TM_TAGS], {
      tags: UNAVAILABLE,
    }),
    datumLeaf(`${M_FILE}#ti`, M_TI_RANGE, [M_TI_ID, M_TI_TAGS], {
      tags: UNAVAILABLE,
    }),
    datumLeaf(
      `${M_FILE}#cr`,
      M_CR_RANGE,
      [M_CR_ID, M_CR_COVERAGE1, M_CR_COVERAGE2],
      {
        coverage: UNAVAILABLE,
      },
    ),
    datumLeaf(`${M_FILE}#cm`, M_CM_RANGE, [M_CM_ID, M_CM_COVERAGE], {
      coverage: UNAVAILABLE,
    }),
    datumLeaf(`${M_FILE}#ci`, M_CI_RANGE, [M_CI_ID, M_CI_COVERAGE], {
      coverage: UNAVAILABLE,
    }),
  ],
};

const T11_2_2 = defineProductTest({
  id: "T11.2-2",
  title:
    'one file\'s definedness matrix via bare `view`: exactly one quoted static `id` is defined while repeated (agreeing and disagreeing), braced (`id={"x"}`), valueless, and absent `id` each spell none — identity explicitly unavailable; duplicate spellings of `x` leave both bearers unavailable, no winner, while the uniquely spelled `x.y` beneath one keeps its defined identity (defined without defined prefixes); descendants of a no-`id` and of a malformed-`id` (`ha#sh`) section are undefined by inheritance (grandchild included); the unique `z` stays defined beside a braced `id={"z"}` (an invalid form contests nothing); absent `tags`/`coverage` props define the defaults (no tags, coverage-required) while repeated, malformed, and invalid-valued ones leave the interpreted value unavailable, raw spellings still listed; the answer carries exactly the staged findings (14.1, 14.3, one 14.4 per malformed identity or tag, one 14.17 per afflicted element), each located in the file, exit 1 (SPEC 11.2, 11.4, 2.5-2.7, 14; CERTIFICATIONS.md CONF-AVAIL in scope)',
  run: async (product) => {
    // Fixture self-checks (T5.7-2 discipline): composed ranges sliced back
    // out of the staged bytes before any product invocation.
    sliceCheck(
      M_SOURCE,
      M_SOLO_RANGE,
      '<S id="solo" coverage="none">\nSolo text.\n</S>',
      "the solo construct",
    );
    sliceCheck(
      M_SOURCE,
      M_BRACEDX_ID.range,
      M_BRACEDX_ID.text,
      "the braced id attribute",
    );
    sliceCheck(M_SOURCE, M_VALUELESS_ID.range, "id", "the valueless id");
    sliceCheck(
      M_SOURCE,
      M_DEEP_RANGE,
      '<S id="orphan.deep">\nDeep text.\n</S>',
      "the deep descendant construct",
    );
    sliceCheck(
      M_SOURCE,
      M_TI_TAGS.range,
      'tags="ok bad#tag"',
      "the invalid-valued tags attribute",
    );
    sliceCheck(M_SOURCE, M_ROOT_RANGE, M_SOURCE, "the whole matrix file");

    const workspace = await TestWorkspace.create({
      files: {
        "xspec.config.ts": SPECS_ONLY_CONFIG,
        [M_FILE]: M_SOURCE,
      },
    });
    try {
      const context = "T11.2-2 bare `view` (the matrix file is the domain)";
      const result = await runCli(product, workspace, ["view"]);
      assertExitCode(
        result,
        1,
        `${context} — the answer carries findings and explicitly-unavailable ` +
          `datums, so the invocation exits 1 with the full document still ` +
          `emitted (SPEC 11.2)`,
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

      // Staging integrity and the reporting side of the matrix: exactly the
      // staged conditions accompany, every finding located in the file.
      assertConditionCounts(
        report.findings,
        M_CONDITION_COUNTS,
        `${context} — exactly the staged conditions accompany the answer ` +
          `(SPEC 11.2, 14): one 14.1 (the id-less section), one 14.3 (the ` +
          `duplicated x, locating both bearers), three 14.4 (ha#sh, ` +
          `ha#sh.kid, the invalid tag bad#tag), ten 14.17 (repeated ` +
          `agreeing/disagreeing id, braced id x2, valueless id, repeated ` +
          `tags, braced tags, repeated coverage, valueless coverage, ` +
          `invalid coverage value) — and nothing masked reports: no 14.1 ` +
          `from an invalid-form id (condition 17, never 1) and no 14.2 ` +
          `anywhere (the no-id section's child is masked, every other ` +
          `child extends its parent's spelling exactly)`,
      );
      for (const finding of report.findings) {
        assertFindingLocated(
          finding,
          { file: M_FILE },
          `${context} — the ${finding.condition ?? finding.code ?? "code-less"} finding ` +
            `locates in the matrix file (file granularity; range precision ` +
            `is T14-8's)`,
        );
      }

      // The one requested file's view, with every node's identity datum and
      // interpreted tags/coverage per SPEC 11.2 — the matrix itself.
      assertSameJson(
        report.views.map((view) => view.file),
        [M_FILE],
        `${context} — one per-file view: the parseable matrix file (SPEC 11.4)`,
      );
      assertSameJson(
        projectDatumNode(report.views[0]!.root),
        M_TREE,
        `${context} — the full positional tree with byte-exact construct ` +
          `ranges and raw attribute entries, each node's identity datum per ` +
          `11.2's spelling/chain/uniqueness rules (defined string or the ` +
          `unavailability marker; the root's identity the path) and its ` +
          `interpreted tags/coverage (plain value, the root's stated null, ` +
          `or the marker; absent props the defaults — no tags as the plain ` +
          `empty list, coverage "required")`,
      );
      assertSameJson(
        [
          report.views[0]!.imports,
          report.views[0]!.occurrences,
          report.views[0]!.comments,
        ],
        [[], [], []],
        `${context} — the matrix file holds no imports, occurrences, or ` +
          `comments: empty arrays, never null (SPEC 12.7)`,
      );
    } finally {
      await workspace.dispose();
    }
  },
});

// ---------------------------------------------------------------------------
// T11.2-3 — invalid paths (Linux leg)
// ---------------------------------------------------------------------------
//
// SPEC 11.2: a node identity is formed over the file's path and requires a
// valid one — in a discovered file whose own path is invalid (14.19: `#` in
// the workspace-relative path, or not valid UTF-8), NO graph node has a
// defined identity, whatever the content spells: a spec source's root and
// every section, a code source's whole-file location and every named unit.
// Such a file keeps its parse-local structure and positions; its
// condition-19 finding accompanies every answer whose consulted domain
// includes it; and no identity over an invalid path is ever emitted or
// resolved against (1.5). A non-UTF-8 path has no plain string form:
// wherever an output carries one — a per-file view's `file`, a finding's
// concerned `path` — it is the marked byte form `{"bytes": …}`, the exact
// bytes as lowercase hexadecimal (12.0, 12.7).
//
// Staging: one workspace, spec group + code group. `specs/OK.mdx` is the
// valid-path contrast (root identity is defined EXACTLY when the file's path
// is valid — both directions in one document) and the reference target;
// `specs/a#b.mdx` (the entry's literal name) and, on the Linux leg,
// `specs/b<0xFF>.mdx` are the invalid-path spec sources; `src/co#de.ts` is
// the invalid-path code source, spelling one `text(SPEC.ok)` call inside a
// named function (kind `embeds`, source would be the unit) and one bare
// top-level marker `SPEC.ok;` (kind `references`, source would be the
// whole-file location) — both targets defined, so both spellings resolve
// and record occurrences whose `source` datum is exactly the unavailability
// marker (5.7, T11.3-1). Every file's CONTENT is deliberately
// condition-free: the gate `build --json` reports exactly the 14.19
// multiset, so the identity unavailability observed later is attributable
// to the paths alone.
//
// Conservative operationalizations (noted per H-3/H-4):
// - The non-UTF-8 arms are staged exactly when the platform's file names are
//   byte strings (`process.platform === "linux"`, the T1.5-2/T6.5-5
//   precedent for the entry's "(Linux leg)" note; other filesystems cannot
//   hold the path at all), and every expectation is parameterized on that
//   staging: the `#` arms run on every platform, so the Linux CI leg runs
//   the whole entry and no platform skips the test (H-9).
// - "the condition-19 finding accompanies every answer whose domain includes
//   the file" is asserted in BOTH directions via exact per-answer finding
//   sets: bare `view` (domain: the discovered spec sources) carries the spec
//   paths' findings and never the code source's — a 14.19 is a domain file's
//   through its concerned path (SPEC 11.2) — bare `occurrences` (domain: the
//   entire discovered set) carries all of them, and `at specs/a#b.mdx`
//   (domain: the named file) carries exactly its own. Per finding, the
//   projection pins the stable code token, `locations` empty (a path-level
//   condition without in-source locations, SPEC 14, 12.7), and the concerned
//   path — the non-UTF-8 one in the marked byte form, composed from the same
//   bytes that stage the file; messages stay unpinned (deterministic but
//   informational, 12.7).
// - "no identity over the invalid path is ever emitted" is realized as
//   exact-value pinning of every identity datum in every captured document:
//   the three view trees (markers on every invalid-path node, root
//   included; plain identities in OK.mdx), each occurrence record's `source`
//   (the marker) and `target` (OK's node), and both `at` resolutions (the
//   marker). The form-exact decode additionally rejects a marked-byte-form
//   path anywhere a plain identity string is required.
// - The non-UTF-8 file is nameable by no argument value (12.0: argument
//   values are UTF-8), so the whole-domain `view` reached without operands
//   is its one route to position data (11.5) — `at` runs against
//   `specs/a#b.mdx`, whose `#`-containing spelling names the discovered file
//   (a bare `<file>` operand is a whole path, `#` has no delimiter role;
//   12.0 — T12.0-13 owns the operand-classification matrix). The exit-2
//   side of addressing the non-UTF-8 file is T11.5-3's arm, not staged here.
// - The gate `build` rides a whole-root snapshot compare (a failing build
//   modifies nothing, SPEC 12.1), pinning that every later answer runs on
//   the staged ground; the per-invocation no-write sweep is T11.2-1's home
//   clause and is not repeated here.

// One spec group plus one code group (SPEC 7.2), so `src/**/*.ts` files are
// discovered code sources and their spec-module usage is analyzed (4.3, 4.5).
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

/** Whether the non-UTF-8-named file is staged (module-header note). */
const NON_UTF8_STAGED = process.platform === "linux";

// --- specs/OK.mdx — the valid-path contrast and reference target -------------
const OK_FILE = "specs/OK.mdx";
const OK = new ByteFixture();
OK.add("Préambule — valid-path contrast.\n\n");
const OK_SEC_START = OK.pos;
OK.add("<S ");
const OK_ID = OK.attr("id", 'id="ok"');
OK.add(">\nOK text.\n</S>");
const OK_SEC_RANGE: SourceRange = { start: OK_SEC_START, end: OK.pos };
OK.add("\n");
const OK_SOURCE = OK.source;
const OK_ROOT_RANGE: SourceRange = { start: 0, end: OK.pos };
const OK_NODE_ID = `${OK_FILE}#ok`;

// --- specs/a#b.mdx — `#`-containing spec path (14.19) ------------------------
// Nested sections with attributes: the tree, ranges, and raw attribute
// entries stay on view while every identity — root included — is
// unavailable. All spelled identities are well-formed, unique, and
// structurally consistent: the path is the file's ONLY defect.
const HP_FILE = "specs/a#b.mdx";
const HP = new ByteFixture();
HP.add("Prélude — invalid `#` path.\n\n");
const HP_PA_START = HP.pos;
HP.add("<S ");
const HP_PA_ID = HP.attr("id", 'id="pa"');
HP.add(">\nParent text.\n\n");
const HP_KID_START = HP.pos;
HP.add("<S ");
const HP_KID_ID = HP.attr("id", 'id="pa.kid"');
HP.add(" ");
const HP_KID_TAGS = HP.attr("tags", 'tags="deep"');
HP.add(">\nKid text.\n</S>");
const HP_KID_RANGE: SourceRange = { start: HP_KID_START, end: HP.pos };
HP.add("\n</S>");
const HP_PA_RANGE: SourceRange = { start: HP_PA_START, end: HP.pos };
HP.add("\n");
const HP_SOURCE = HP.source;
const HP_ROOT_RANGE: SourceRange = { start: 0, end: HP.pos };

// --- specs/b<0xFF>.mdx — non-UTF-8-named spec source (14.19, Linux leg) ------
// 0xFF can occur in no valid UTF-8 sequence, so the workspace-relative path
// is not valid UTF-8; the byte-wise glob rules of SPEC 7 still discover it.
// The marked byte form is composed from the SAME bytes that stage the file
// (never measured from product output).
const NU_PATH_BYTES = Buffer.concat([
  Buffer.from("specs/b", "utf8"),
  Buffer.from([0xff]),
  Buffer.from(".mdx", "utf8"),
]);
const NU_MARKED_PATH = { bytes: NU_PATH_BYTES.toString("hex") } as const;
const NU = new ByteFixture();
NU.add("Prólogo — non-UTF-8 path.\n\n");
const NU_SEC_START = NU.pos;
NU.add("<S ");
const NU_ID = NU.attr("id", 'id="solo"');
NU.add(">\nSolo text.\n</S>");
const NU_SEC_RANGE: SourceRange = { start: NU_SEC_START, end: NU.pos };
NU.add("\n");
const NU_SOURCE = NU.source;
const NU_ROOT_RANGE: SourceRange = { start: 0, end: NU.pos };

// --- src/co#de.ts — `#`-containing code source (14.19) -----------------------
// One sanctioned spelling per attribution case (SPEC 4.5, 4.6): the
// `text(SPEC.ok)` call inside the named unit `useText` (its occurrence spans
// the entire call expression, callee through closing parenthesis) and the
// bare top-level marker `SPEC.ok` (whole-file attribution; its occurrence
// spans the bare reference chain alone, exclusive of the terminator). The
// multi-byte comment prefix shifts every later offset (SPEC 1.7).
const CS_FILE = "src/co#de.ts";
const CS = new ByteFixture();
CS.add("// Präambel — invalid-path code source.\n");
CS.add('import SPEC, { text } from "../specs/OK.xspec";\n');
CS.add("\nexport function useText(): string {\n  return ");
const CS_CALL_TEXT = "text(SPEC.ok)";
const CS_CALL_RANGE = CS.add(CS_CALL_TEXT);
CS.add(";\n}\n\n");
const CS_MARKER_TEXT = "SPEC.ok";
const CS_MARKER_RANGE = CS.add(CS_MARKER_TEXT);
CS.add(";\n");
const CS_SOURCE = CS.source;

// The invalid-path code source's complete occurrence enumeration (SPEC 5.7,
// 11.2): both spellings resolve (the referenced identity `specs/OK.mdx#ok`
// is defined), so both record — `file`, `range`, `kind`, and `target`
// present, `source` exactly the unavailability marker (identity and range
// withheld together as one datum; never a picked identity, never a dropped
// record). No other staged file holds a reference spelling, so this is the
// workspace's whole enumeration, in occurrence order (range start).
const CS_EXPECTED_OCCURRENCES: readonly OccurrenceRecord[] = [
  {
    file: CS_FILE,
    range: CS_CALL_RANGE,
    kind: "embeds",
    source: UNAVAILABLE,
    target: OK_NODE_ID,
  },
  {
    file: CS_FILE,
    range: CS_MARKER_RANGE,
    kind: "references",
    source: UNAVAILABLE,
    target: OK_NODE_ID,
  },
];

// --- expected trees (T11.2-1's projection: identity/range/attributes) --------

const OK_TREE: TreeExpectation = {
  identity: OK_FILE,
  range: OK_ROOT_RANGE,
  attributes: [],
  children: [
    {
      identity: OK_NODE_ID,
      range: OK_SEC_RANGE,
      attributes: [OK_ID],
      children: [],
    },
  ],
};

const HP_TREE: TreeExpectation = {
  identity: UNAVAILABLE,
  range: HP_ROOT_RANGE,
  attributes: [],
  children: [
    {
      identity: UNAVAILABLE,
      range: HP_PA_RANGE,
      attributes: [HP_PA_ID],
      children: [
        {
          identity: UNAVAILABLE,
          range: HP_KID_RANGE,
          attributes: [HP_KID_ID, HP_KID_TAGS],
          children: [],
        },
      ],
    },
  ],
};

const NU_TREE: TreeExpectation = {
  identity: UNAVAILABLE,
  range: NU_ROOT_RANGE,
  attributes: [],
  children: [
    {
      identity: UNAVAILABLE,
      range: NU_SEC_RANGE,
      attributes: [NU_ID],
      children: [],
    },
  ],
};

// --- expected condition-19 findings ------------------------------------------

/**
 * The asserted projection of a 14.19 finding (module-header note): the
 * stable code token, the empty locations of a path-level condition, and the
 * concerned path (SPEC 14, 12.7). Message and identities stay unpinned.
 */
interface PathFindingExpectation {
  readonly code: string | null;
  readonly locations: readonly unknown[];
  readonly path: PathValue | null;
}

function projectPathFinding(finding: Finding): PathFindingExpectation {
  return {
    code: finding.code,
    locations: finding.locations,
    path: finding.path,
  };
}

const HP_19: PathFindingExpectation = {
  code: "invalid-source-path",
  locations: [],
  path: HP_FILE,
};
const NU_19: PathFindingExpectation = {
  code: "invalid-source-path",
  locations: [],
  path: NU_MARKED_PATH,
};
const CS_19: PathFindingExpectation = {
  code: "invalid-source-path",
  locations: [],
  path: CS_FILE,
};

// Pinned 12.7 order among equal-code, location-less findings: by concerned
// path bytes — "specs/a#b.mdx" < "specs/b\xFF.mdx" (a marked byte-form path
// and a plain string sort in one byte order) < "src/co#de.ts".
const WORKSPACE_19S: readonly PathFindingExpectation[] = NON_UTF8_STAGED
  ? [HP_19, NU_19, CS_19]
  : [HP_19, CS_19];
const VIEW_DOMAIN_19S: readonly PathFindingExpectation[] = NON_UTF8_STAGED
  ? [HP_19, NU_19]
  : [HP_19];
const WORKSPACE_19_COUNTS: Readonly<Record<string, number>> = {
  "14.19": NON_UTF8_STAGED ? 3 : 2,
};

// Per-file views ordered by byte order of workspace-relative path (SPEC
// 11.4): "specs/OK.mdx" ("O" 0x4f) < "specs/a#b.mdx" ("a" 0x61) <
// "specs/b\xFF.mdx" ("b" 0x62). The code source has no structural view and
// never appears (SPEC 11.4: the view's domain is the discovered spec
// sources).
const EXPECTED_VIEW_FILES: readonly PathValue[] = NON_UTF8_STAGED
  ? [OK_FILE, HP_FILE, NU_MARKED_PATH]
  : [OK_FILE, HP_FILE];

const T11_2_3 = defineProductTest({
  id: "T11.2-3",
  title:
    "(Linux leg) invalid paths: the discovered spec sources `specs/a#b.mdx` and — staged where file names are byte strings — a non-UTF-8-named `specs/b<0xFF>.mdx` keep full views (tree, byte-exact construct ranges, raw attribute entries) with every node identity, root included, explicitly unavailable, while `specs/OK.mdx` beside them keeps defined identities — root identity defined exactly when the file's path is valid; the condition-19 finding (stable code `invalid-source-path`, no locations, the file as concerned path — the non-UTF-8 path in the marked byte form `{\"bytes\": …}`) accompanies every answer whose consulted domain includes the file and no other: bare `view` carries exactly the spec paths' findings (never the code source's), bare `occurrences` every 14.19, `at specs/a#b.mdx` exactly its own; the code source `src/co#de.ts` defines no identity for its whole-file location or any unit, its `text(SPEC.ok)` call and bare marker still recording occurrences with `source` exactly the unavailability marker and `file`, `range`, `kind`, `target` present; no identity over an invalid path is ever emitted (every identity datum in every captured document pinned); the gate `build --json` fails with exactly the staged 14.19 multiset, modifying nothing (SPEC 11.2, 11.3-11.5, 12.0, 12.7, 5.7, 1.5, 14)",
  run: async (product) => {
    // Fixture self-checks (T5.7-2 discipline): composed ranges sliced back
    // out of the staged bytes before any product invocation.
    sliceCheck(
      OK_SOURCE,
      OK_SEC_RANGE,
      '<S id="ok">\nOK text.\n</S>',
      "OK's section construct",
    );
    sliceCheck(
      HP_SOURCE,
      HP_KID_RANGE,
      '<S id="pa.kid" tags="deep">\nKid text.\n</S>',
      "the nested kid construct",
    );
    sliceCheck(HP_SOURCE, HP_PA_ID.range, HP_PA_ID.text, "pa's id attribute");
    sliceCheck(
      NU_SOURCE,
      NU_SEC_RANGE,
      '<S id="solo">\nSolo text.\n</S>',
      "the non-UTF-8-named file's section construct",
    );
    sliceCheck(
      CS_SOURCE,
      CS_CALL_RANGE,
      CS_CALL_TEXT,
      "the text(...) call expression",
    );
    sliceCheck(
      CS_SOURCE,
      CS_MARKER_RANGE,
      CS_MARKER_TEXT,
      "the bare marker chain",
    );

    const workspace = await TestWorkspace.create({
      files: {
        "xspec.config.ts": SPEC_AND_CODE_CONFIG,
        [OK_FILE]: OK_SOURCE,
        [HP_FILE]: HP_SOURCE,
        [CS_FILE]: CS_SOURCE,
      },
    });
    try {
      if (NON_UTF8_STAGED) {
        await workspace.file(NU_PATH_BYTES, NU_SOURCE);
      }

      // --- The gate reference and staging integrity: `build` fails with
      // EXACTLY the 14.19 multiset — the content of every file stages no
      // other condition, so later identity unavailability is attributable
      // to the paths alone. Each finding pinned: stable code, no locations
      // (a path-level condition), the concerned path — the non-UTF-8 one in
      // the marked byte form (SPEC 14, 12.0, 12.7).
      const buildContext =
        "T11.2-3 `build --json` (the gate reference: the workspace fails " +
        "`build` on exactly the staged invalid-path conditions)";
      await assertLeavesUnchanged(
        workspace.root,
        async () => {
          const result = await expectExit(
            product,
            workspace,
            ["build", "--json"],
            1,
            buildContext,
          );
          const findings = decodeFindingsReport(
            parseJsonStdout(result, buildContext),
            buildContext,
          ).findings;
          assertConditionCounts(
            findings,
            WORKSPACE_19_COUNTS,
            `${buildContext} — one 14.19 per invalid-path discovered ` +
              `source and nothing else: every file's content is ` +
              `condition-free`,
          );
          assertSameJson(
            findings.map(projectPathFinding),
            WORKSPACE_19S,
            `${buildContext} — each finding carries the stable code ` +
              `"invalid-source-path", no in-source locations, and the ` +
              `offending file as its concerned path — the non-UTF-8 path ` +
              `presented in the marked byte form (SPEC 14, 12.0, 12.7)`,
          );
        },
        `${buildContext} — a failing build modifies nothing (SPEC 12.1)`,
      );

      // --- Bare `view` (whole domain: every discovered spec source, the
      // one route to the non-UTF-8 file — nameable by no argument value).
      const viewContext =
        "T11.2-3 bare `view` (whole domain: every discovered spec source)";
      const viewResult = await runCli(product, workspace, ["view"]);
      assertExitCode(
        viewResult,
        1,
        `${viewContext} — the answer carries findings and ` +
          `explicitly-unavailable identities, so the invocation exits 1 ` +
          `with the full document still emitted (SPEC 11.2)`,
      );
      const viewReport = decodeViewReport(
        parseJsonStdout(
          viewResult,
          `${viewContext} — a single JSON document is the only output ` +
            `form, with or without --json (SPEC 11)`,
        ),
        { text: false },
        viewContext,
      );
      assertSameJson(
        viewReport.findings.map(projectPathFinding),
        VIEW_DOMAIN_19S,
        `${viewContext} — the condition-19 finding accompanies every ` +
          `answer whose consulted domain includes the file AND NO OTHER ` +
          `(SPEC 11.2): the requested spec sources' findings exactly — the ` +
          `code source's 14.19 concerns no domain file and must not attach`,
      );
      assertSameJson(
        viewReport.views.map((view) => view.file),
        EXPECTED_VIEW_FILES,
        `${viewContext} — per-file views for every discovered spec source ` +
          `in path-byte order, the non-UTF-8 file's \`file\` member ` +
          `presented in the marked byte form — its exact bytes as ` +
          `lowercase hexadecimal, never a plain string (SPEC 11.4, 12.0, ` +
          `12.7)`,
      );
      const okView = viewReport.views[0]!;
      const hpView = viewReport.views[1]!;
      assertSameJson(
        projectNode(okView.root),
        OK_TREE,
        `${viewContext} — the valid-path file's identities are DEFINED ` +
          `(root: the path; section: path#id): root identity is defined ` +
          `exactly when the file's path is valid (SPEC 11.2)`,
      );
      assertSameJson(
        projectNode(hpView.root),
        HP_TREE,
        `${viewContext} — specs/a#b.mdx keeps its full positional tree ` +
          `with byte-exact construct ranges and raw attribute entries ` +
          `while every node identity, root included, is explicitly ` +
          `unavailable — no identity over an invalid path is ever emitted ` +
          `(SPEC 11.2, 1.5)`,
      );
      assertSameJson(
        [
          [okView.imports, okView.occurrences, okView.comments],
          [hpView.imports, hpView.occurrences, hpView.comments],
        ],
        [
          [[], [], []],
          [[], [], []],
        ],
        `${viewContext} — the spec files hold no imports, occurrences, or ` +
          `comments: empty arrays, never null (SPEC 12.7)`,
      );
      if (NON_UTF8_STAGED) {
        const nuView = viewReport.views[2]!;
        assertSameJson(
          projectNode(nuView.root),
          NU_TREE,
          `${viewContext} — the non-UTF-8-named file keeps its full ` +
            `positional tree, every node identity explicitly unavailable, ` +
            `root included (SPEC 11.2)`,
        );
        assertSameJson(
          [nuView.imports, nuView.occurrences, nuView.comments],
          [[], [], []],
          `${viewContext} — the non-UTF-8-named file holds no imports, ` +
            `occurrences, or comments (SPEC 12.7)`,
        );
      }

      // --- Bare `occurrences` (the entire discovered set, SPEC 11.3):
      // every 14.19 accompanies — the code source's included — and the
      // invalid-path code source's spellings still record, `source`
      // exactly the unavailability marker (SPEC 5.7, 11.2).
      const occContext = "T11.2-3 bare `occurrences`";
      const occResult = await runCli(product, workspace, ["occurrences"]);
      assertExitCode(
        occResult,
        1,
        `${occContext} — the enumeration carries the domain's findings and ` +
          `explicitly-unavailable source datums, so exit 1 with the full ` +
          `answer (SPEC 11.2, 11.3)`,
      );
      const occReport = decodeOccurrencesReport(
        parseJsonStdout(
          occResult,
          `${occContext} — a single JSON document is the only output form ` +
            `(SPEC 11)`,
        ),
        occContext,
      );
      assertSameJson(
        occReport.findings.map(projectPathFinding),
        WORKSPACE_19S,
        `${occContext} — the consulted domain is the entire discovered ` +
          `set, so every invalid path's condition-19 finding accompanies, ` +
          `the code source's included (SPEC 11.2, 11.3)`,
      );
      assertSameJson(
        occReport.occurrences,
        CS_EXPECTED_OCCURRENCES,
        `${occContext} — the invalid-path code source's spellings still ` +
          `record occurrences: the text(...) call (embeds, spanning the ` +
          `whole call expression) and the bare marker (references, ` +
          `spanning the chain alone), each record's source EXACTLY the ` +
          `unavailability marker — identity and range withheld together as ` +
          `one datum, never a picked identity, never a dropped record — ` +
          `while file, range, kind, and target are present (SPEC 5.7, 11.2)`,
      );

      // --- `at specs/a#b.mdx <offset>` (SPEC 11.5): the `#`-containing
      // spelling names the discovered file (a bare <file> operand is a
      // whole path, 12.0); the consulted domain is the named file alone, so
      // exactly its own condition-19 finding accompanies, and the
      // resolution's identity is the marker — offset 0 resolves to the
      // root (prose before any section), the kid-construct offset to the
      // innermost section.
      const atCases: readonly {
        readonly offset: number;
        readonly what: string;
        readonly range: SourceRange;
      }[] = [
        {
          offset: 0,
          what:
            "offset 0 (prose) resolves to the ROOT, its identity " +
            "explicitly unavailable — the root of an invalid-path file " +
            "included (SPEC 11.2, 11.5)",
          range: HP_ROOT_RANGE,
        },
        {
          offset: HP_KID_RANGE.start,
          what:
            "the kid-construct offset resolves to the innermost " +
            "section, its identity explicitly unavailable (SPEC 11.2, 11.5)",
          range: HP_KID_RANGE,
        },
      ];
      for (const atCase of atCases) {
        const atContext = `T11.2-3 \`at ${HP_FILE} ${String(atCase.offset)}\``;
        const atResult = await runCli(product, workspace, [
          "at",
          HP_FILE,
          String(atCase.offset),
        ]);
        assertExitCode(
          atResult,
          1,
          `${atContext} — the answer carries the file's finding and an ` +
            `unavailable identity, so exit 1 with the full answer ` +
            `(SPEC 11.2, 11.5)`,
        );
        const atReport = decodeAtReport(
          parseJsonStdout(
            atResult,
            `${atContext} — a single JSON document is the only output ` +
              `form (SPEC 11)`,
          ),
          atContext,
        );
        assertSameJson(
          atReport.findings.map(projectPathFinding),
          [HP_19],
          `${atContext} — the consulted domain is the named file alone: ` +
            `exactly its condition-19 finding, never the other invalid ` +
            `paths' (SPEC 11.2, 11.5)`,
        );
        assertSameJson(
          atReport.resolution,
          {
            section: { identity: UNAVAILABLE, range: atCase.range },
            occurrence: null,
          },
          `${atContext} — ${atCase.what}`,
        );
      }
    } finally {
      await workspace.dispose();
    }
  },
});

/** TEST-SPEC §11.2, in canonical ID order (SUITE-52). */
export const section112Tests: readonly ProductTestEntry[] = [
  T11_2_1,
  T11_2_2,
  T11_2_3,
];
