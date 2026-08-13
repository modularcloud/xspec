// TEST-SPEC §11.2 (availability on imperfect files) — SUITE-52: T11.2-1
// through T11.2-4.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), and rejects a product only via diagnosed
// assertion failures (H-8).
//
// Certification (CERTIFICATIONS.md CONF-AVAIL): T11.2-2 and T11.2-4 are in
// scope — VIOL-AVAIL-NULLMARKER and VIOL-AVAIL-OMIT certify both (the
// fixture family lands with the certification-manifest task). CONF-AVAIL's
// staging constraint pins every command an in-scope test drives to its
// enumerated `view`/`occurrences` surface, so T11.2-2 and T11.2-4 run NO
// gate-reference `build`, no `at`, and no `--file` on `occurrences`
// (VIOL-AVAIL-NOFILE's staging constraint) — unlike T11.2-1 and T11.2-3,
// which are not in scope (CONF-AVAIL's workspace scope is `#`-free
// valid-UTF-8 paths with no code groups, so T11.2-3's staging lies outside
// it by construction): staging integrity rides each answer's own exact
// accompanying-findings multiset instead, and the staged conditions are
// drawn from the scope's stated set (T11.2-2: 14.1, 14.3, 14.4, 14.17;
// T11.2-4: 14.1, 14.3, 14.5, 14.6, 14.9, 14.15, 14.16).
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
import * as fsp from "node:fs/promises";
import type {
  Finding,
  OccurrenceRecord,
  PathValue,
  SourceRange,
  ViewAttributeEntry,
  ViewImportEntry,
  ViewNode,
} from "../../helpers/adapters/index.js";
import {
  decodeAtReport,
  decodeFindingsReport,
  decodeOccurrencesReport,
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

// ---------------------------------------------------------------------------
// T11.2-4 — resolution and expanded text
// ---------------------------------------------------------------------------
//
// SPEC 11.2 resolution: a reference spelling resolves exactly when it names
// exactly one target whose own node identity is DEFINED — so a reference to
// the one section spelling `a.b` resolves and records an occurrence (5.7)
// even while duplicate spellings of `a` leave every bearer of `a` undefined,
// and a reference to `a` itself records no edge and no occurrence —
// ambiguous, every bearer undefined — and never reports an unavailable
// target: its position reaches consumers through its finding's range (14).
// Source-side unavailability (5.7): a resolving spelling inside a section
// whose own identity is undefined still records, the record carrying `file`,
// its own `range`, `kind`, and `target` with `source` exactly the
// unavailability marker — identity and range withheld together as one datum,
// never a picked bearer's identity, never a dropped record. Expanded text
// (11.2, 1.6, 3): an own/subtree text value is defined exactly when every
// embedding its expansion transitively reaches records an occurrence and the
// recursion re-enters no node already being expanded — one unresolved
// spelling or one embedding cycle on the expansion path poisons the WHOLE
// value (partial expansion is fabrication and never occurs) — and removal
// classification is by syntactic form, never by validity or resolution:
// every import declaration is removed by form (target discovery
// notwithstanding), while a construct matching no removal rule's form (a
// stray element, 14.16) is content, preserved byte-for-byte.
//
// CONF-AVAIL scope (module header): the whole entry drives ONLY bare `view`
// (with and without `--text`) and bare `occurrences` — no gate-reference
// `build`, no `at`, no `--file` (the record observations ride `occurrences`
// and `view`, per the scope's staging constraints). Staging integrity rides
// each answer's own exact findings multiset (the T11.2-2 discipline).
//
// Conservative operationalizations (noted per H-3/H-4):
// - The ambiguous reference to `a` is staged in the `d` entry form (14.5) —
//   the one staged condition set drawn from CONF-AVAIL's stated scope; the
//   unresolved-embedding form (14.6) rides the expansion chain's boundary
//   spelling, where SPEC 14 pins the finding range exactly (the full braced
//   container, the span its occurrence would occupy), asserted exactly
//   there. Every other located finding is asserted as an exact location
//   COUNT (one per offending construct — SPEC 14's cardinality rule: both
//   bearers for the duplicate-ID finding) with each range inside the
//   offending construct's byte window (end-widened by one byte): the
//   ambiguous `d` reference's finding inside the opening tag that spells
//   the reference, the cycle's inside its participating embedding
//   container's line, 14.1/14.15/14.16 inside their constructs — file and
//   construct discrimination without pinning T14-8's range precision.
// - Import-declaration view entries pin the declaration's range as exactly
//   its own characters (no terminator) — the 1.7 construct convention —
//   with `name` the default binding's identifier and `target` the resolved
//   path or the marker (SPEC 11.4).
// - Expected own/subtree text values are hand-derived per the rules of 3
//   (line-by-line derivation comments beside each constant; line-drop rule
//   included) and composed from the same string parts that stage the files
//   wherever an expansion inserts bytes.
// - "Text values byte-identical to before" (the deleted-import arm) is
//   realized by pinning the SAME expected tree on both sides of the
//   deletion: equality with one pinned constant on each side implies
//   before/after byte identity AND pins the by-form import removal on both
//   sides (a remove-by-resolution product leaves the import line in the
//   compiled text once the target is gone, failing the after-side pin).
// - The `--text` tree projection pins identity, construct range, ownText,
//   subtreeText, and tree shape; attribute entries and interpreted
//   tags/coverage stay at their home tests (T11.2-1/-2, T11.4-1/-3), their
//   forms still decode-validated (H-3).
// - "Never an unavailable target" is enforced twice: the form decode admits
//   only a plain identity string as a record's `target` (12.7), and every
//   enumeration is pinned as a complete exact set (a phantom record for the
//   ambiguous spelling fails the compare — "never a dropped record" rides
//   the same exactness for the two resolving spellings).

/** A window check for one located finding (SPEC 14 location cardinality). */
interface LocationWindowExpectation {
  readonly file: string;
  readonly window: { readonly start: number; readonly end: number };
}

/** An offending construct's byte window: its range, end-widened by one. */
function widened(range: SourceRange): { start: number; end: number } {
  return { start: range.start, end: range.end + 1 };
}

/**
 * Assert a located finding's concern exactly: `path` null (a located
 * condition, SPEC 12.7), exactly one location per offending construct (SPEC
 * 14's cardinality rule), each — in 12.7 location order, which the decode
 * has already enforced — lying in its expected file with its range inside
 * the offending construct's byte window.
 */
function assertLocatedFinding(
  finding: Finding,
  expected: readonly LocationWindowExpectation[],
  context: string,
): void {
  assertSameJson(
    finding.path,
    null,
    `${context} — a located condition's concerned path is null (SPEC 12.7)`,
  );
  if (finding.locations.length !== expected.length) {
    fail(
      `${context}: expected exactly ${String(expected.length)} location(s) — ` +
        `one per offending construct (SPEC 14) — got ` +
        `${String(finding.locations.length)} (message: ` +
        `${JSON.stringify(finding.message)})`,
    );
  }
  expected.forEach((want, index) => {
    const location = finding.locations[index]!;
    if (location.file !== want.file) {
      fail(
        `${context}: location ${String(index)} must lie in ` +
          `${JSON.stringify(want.file)}, got ` +
          `${JSON.stringify(location.file)} (message: ` +
          `${JSON.stringify(finding.message)})`,
      );
    }
    if (
      location.range.start < want.window.start ||
      location.range.end > want.window.end
    ) {
      fail(
        `${context}: location ${String(index)} ` +
          `[${String(location.range.start)}, ${String(location.range.end)}) ` +
          `must fall within the offending construct's byte window ` +
          `[${String(want.window.start)}, ${String(want.window.end)}] ` +
          `(message: ${JSON.stringify(finding.message)})`,
      );
    }
  });
}

/** The one finding of a condition — counts asserted beforehand. */
function findingByCondition(
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

// --- staging 1: specs/R.mdx — the resolution matrix ---------------------------
//
// Duplicate spellings of `a` (both bearers undefined, one 14.3 locating
// both) with the unique `a.b` beneath the FIRST bearer (defined without
// defined prefixes, SPEC 11.2); the SECOND bearer carries `d={"a.b"}` — a
// resolving spelling inside a duplicate-`id` bearer; an id-less section
// (14.1) holds `{text("a.b")}` — a resolving spelling inside a section
// spelling no identity; and the defined `q` carries `d={"a"}` — the
// ambiguous reference, recording nothing and reporting 14.5. The multi-byte
// prefix shifts every later offset (SPEC 1.7).

const R_FILE = "specs/R.mdx";
const R = new ByteFixture();
R.add("Prélude — resolution turns on the target identity's definedness.\n\n");
const R_A1_START = R.pos;
R.add("<S ");
const R_A1_ID = R.attr("id", 'id="a"');
R.add(">\nFirst bearer.\n\n");
const R_AB_START = R.pos;
R.add("<S ");
const R_AB_ID = R.attr("id", 'id="a.b"');
R.add(">\nTarget text.\n</S>");
const R_AB_RANGE: SourceRange = { start: R_AB_START, end: R.pos };
R.add("\n</S>");
const R_A1_RANGE: SourceRange = { start: R_A1_START, end: R.pos };
R.add("\n\n");
const R_A2_START = R.pos;
R.add("<S ");
const R_A2_ID = R.attr("id", 'id="a"');
R.add(" ");
const R_A2_D = R.attr("d", 'd={"a.b"}');
R.add(">\nSecond bearer.\n</S>");
const R_A2_RANGE: SourceRange = { start: R_A2_START, end: R.pos };
R.add("\n\n");
const R_NOID_START = R.pos;
R.add("<S>\nNo identity here.\n\n");
const R_EMBED_TEXT = '{text("a.b")}';
const R_EMBED_RANGE = R.add(R_EMBED_TEXT);
R.add("\n</S>");
const R_NOID_RANGE: SourceRange = { start: R_NOID_START, end: R.pos };
R.add("\n\n");
const R_Q_START = R.pos;
R.add("<S ");
const R_Q_ID = R.attr("id", 'id="q"');
R.add(" ");
const R_Q_D = R.attr("d", 'd={"a"}');
R.add(">");
const R_Q_OPEN_END = R.pos;
R.add("\nAmbiguous reference.\n</S>");
const R_Q_RANGE: SourceRange = { start: R_Q_START, end: R.pos };
R.add("\n");
const R_SOURCE = R.source;
const R_ROOT_RANGE: SourceRange = { start: 0, end: R.pos };

const R_AB_NODE_ID = `${R_FILE}#a.b`;
const R_A2_D_REF = dLiteralRange(R_A2_D);

// The view positions each enclosing construct (SPEC 11.4), identities per
// 11.2: both `a` bearers and the id-less section explicitly unavailable
// (no winner picked; `id` absent), `a.b` and `q` defined.
const R_TREE: TreeExpectation = {
  identity: R_FILE,
  range: R_ROOT_RANGE,
  attributes: [],
  children: [
    {
      identity: UNAVAILABLE,
      range: R_A1_RANGE,
      attributes: [R_A1_ID],
      children: [
        {
          identity: R_AB_NODE_ID,
          range: R_AB_RANGE,
          attributes: [R_AB_ID],
          children: [],
        },
      ],
    },
    {
      identity: UNAVAILABLE,
      range: R_A2_RANGE,
      attributes: [R_A2_ID, R_A2_D],
      children: [],
    },
    {
      identity: UNAVAILABLE,
      range: R_NOID_RANGE,
      attributes: [],
      children: [],
    },
    {
      identity: `${R_FILE}#q`,
      range: R_Q_RANGE,
      attributes: [R_Q_ID, R_Q_D],
      children: [],
    },
  ],
};

// The workspace's COMPLETE enumeration (SPEC 5.7, 11.2): the two resolving
// spellings record — each record's `source` exactly the unavailability
// marker (identity and range withheld together as one datum), `file`,
// `range`, `kind`, `target` present — while the ambiguous reference to `a`
// records nothing: no record, no unavailable target (the exact set pins
// both "never a picked bearer's identity" and "never a dropped record").
const R_EXPECTED_OCCURRENCES: readonly OccurrenceRecord[] = [
  {
    file: R_FILE,
    range: R_A2_D_REF,
    kind: "depends",
    source: UNAVAILABLE,
    target: R_AB_NODE_ID,
  },
  {
    file: R_FILE,
    range: R_EMBED_RANGE,
    kind: "embeds",
    source: UNAVAILABLE,
    target: R_AB_NODE_ID,
  },
];

// Exactly the staged conditions (SPEC 11.2, 14) — staging integrity without
// a `build` gate (CONF-AVAIL surface constraint): one 14.1 (the id-less
// section), one 14.3 (the duplicated `a`, locating both bearers), one 14.5
// (the ambiguous `d` reference — reported by its finding's range, never as
// a record). No 14.2 anywhere: `a.b` extends its parent's spelling exactly,
// the id-less section's structural check is masked and it has no section
// children, and every other spelled identity is one segment at top level.
const R_CONDITION_COUNTS: Readonly<Record<string, number>> = {
  "14.1": 1,
  "14.3": 1,
  "14.5": 1,
};

// --- staging 2: the embedding chain (CH-A embeds CH-B embeds CH-C) ------------
//
// A#top embeds B#mid (node form via import), B#mid embeds C#deep, and
// C#deep holds the unresolved `{text("nosuch")}` (14.6) — one unresolved
// spelling on the expansion path poisons top's and mid's (and deep's) whole
// own/subtree values; the siblings with resolved or embedding-free
// expansions (A#side embedding B#ok, and B#ok itself) stay defined and
// byte-exact; each root's own text is defined (no embedding in any root's
// own contribution) while each root's subtree text is poisoned through its
// section. Every id is unique and well-formed, every import valid: the
// 14.6 is the workspace's ONLY condition.

const CH_A_FILE = "specs/CH-A.mdx";
const CH_B_FILE = "specs/CH-B.mdx";
const CH_C_FILE = "specs/CH-C.mdx";

const CHA = new ByteFixture();
CHA.add("Rôle — chain head.\n\n");
const CHA_IMPORT_TEXT = 'import B from "./CH-B.xspec"';
const CHA_IMPORT_RANGE = CHA.add(CHA_IMPORT_TEXT);
CHA.add("\n\n");
const CHA_TOP_START = CHA.pos;
CHA.add('<S id="top">\nTop head.\n\n');
const CHA_EMBED_MID_RANGE = CHA.add("{text(B.mid)}");
CHA.add("\n</S>");
const CHA_TOP_RANGE: SourceRange = { start: CHA_TOP_START, end: CHA.pos };
CHA.add("\n\n");
const CHA_SIDE_START = CHA.pos;
CHA.add('<S id="side">\nSide head.\n\n');
const CHA_EMBED_OK_RANGE = CHA.add("{text(B.ok)}");
CHA.add("\n</S>");
const CHA_SIDE_RANGE: SourceRange = { start: CHA_SIDE_START, end: CHA.pos };
CHA.add("\n");
const CH_A_SOURCE = CHA.source;
const CH_A_ROOT_RANGE: SourceRange = { start: 0, end: CHA.pos };

const CHB = new ByteFixture();
CHB.add("Über — chain middle.\n\n");
const CHB_IMPORT_TEXT = 'import C from "./CH-C.xspec"';
const CHB_IMPORT_RANGE = CHB.add(CHB_IMPORT_TEXT);
CHB.add("\n\n");
const CHB_MID_START = CHB.pos;
CHB.add('<S id="mid">\nMid head.\n\n');
const CHB_EMBED_DEEP_RANGE = CHB.add("{text(C.deep)}");
CHB.add("\n</S>");
const CHB_MID_RANGE: SourceRange = { start: CHB_MID_START, end: CHB.pos };
CHB.add("\n\n");
const CHB_OK_START = CHB.pos;
CHB.add('<S id="ok">\nOK line.\n</S>');
const CHB_OK_RANGE: SourceRange = { start: CHB_OK_START, end: CHB.pos };
CHB.add("\n");
const CH_B_SOURCE = CHB.source;
const CH_B_ROOT_RANGE: SourceRange = { start: 0, end: CHB.pos };

const CHC = new ByteFixture();
CHC.add("Café — chain tail.\n\n");
const CHC_DEEP_START = CHC.pos;
CHC.add('<S id="deep">\nDeep head.\n\n');
const CHC_NOSUCH_TEXT = '{text("nosuch")}';
const CHC_NOSUCH_RANGE = CHC.add(CHC_NOSUCH_TEXT);
CHC.add("\n</S>");
const CHC_DEEP_RANGE: SourceRange = { start: CHC_DEEP_START, end: CHC.pos };
CHC.add("\n");
const CH_C_SOURCE = CHC.source;
const CH_C_ROOT_RANGE: SourceRange = { start: 0, end: CHC.pos };

// Expected text values, derived per the rules of 3 (SPEC 3, 1.6). Line
// derivations (each file): the import line and every `<S>`/`</S>` line are
// removed and left empty purely by removals, so each is dropped WITH its
// terminator; blank source lines (never non-whitespace) are preserved; a
// replaced `{text(...)}` line keeps its own terminator after the inserted
// expansion.
//
// CH-B#ok's construct contributes only its body line:
const CH_B_OK_TEXT = "OK line.\n";
// CH-A#side: "Side head.\n" + blank "\n" + (expansion of B.ok inserted in
// place of the container, then the line's own terminator):
const CH_A_SIDE_TEXT = "Side head.\n\n" + CH_B_OK_TEXT + "\n";
// Each root's own text: title line + the blank line after it + the blank
// line left after the dropped import line (where one exists), then the
// blank line between the two sections joined at the excision points; the
// dropped final `</S>` line leaves nothing after the last section.
const CH_A_ROOT_OWN = "Rôle — chain head.\n\n\n\n";
const CH_B_ROOT_OWN = "Über — chain middle.\n\n\n\n";
// CH-C has no import and no second section: title + one blank line.
const CH_C_ROOT_OWN = "Café — chain tail.\n\n";

/**
 * T11.2-4's `--text` tree projection: identity datum, construct range, and
 * the own/subtree text datums (each a byte-exact string or the
 * unavailability marker — the matrix under test), plus tree shape.
 * Attribute entries and interpreted tags/coverage stay at their home tests
 * (module comment); the form-exact decode has validated their forms.
 */
interface TextTreeExpectation {
  readonly identity: ViewNode["identity"];
  readonly range: SourceRange;
  readonly ownText: string | { readonly unavailable: true };
  readonly subtreeText: string | { readonly unavailable: true };
  readonly children: readonly TextTreeExpectation[];
}

function projectTextNode(node: ViewNode): TextTreeExpectation {
  return {
    identity: node.identity,
    range: node.range,
    ownText: node.ownText!,
    subtreeText: node.subtreeText!,
    children: node.children.map(projectTextNode),
  };
}

const CH_A_TEXT_TREE: TextTreeExpectation = {
  identity: CH_A_FILE,
  range: CH_A_ROOT_RANGE,
  ownText: CH_A_ROOT_OWN,
  subtreeText: UNAVAILABLE,
  children: [
    {
      identity: `${CH_A_FILE}#top`,
      range: CHA_TOP_RANGE,
      ownText: UNAVAILABLE,
      subtreeText: UNAVAILABLE,
      children: [],
    },
    {
      identity: `${CH_A_FILE}#side`,
      range: CHA_SIDE_RANGE,
      ownText: CH_A_SIDE_TEXT,
      subtreeText: CH_A_SIDE_TEXT,
      children: [],
    },
  ],
};

const CH_B_TEXT_TREE: TextTreeExpectation = {
  identity: CH_B_FILE,
  range: CH_B_ROOT_RANGE,
  ownText: CH_B_ROOT_OWN,
  subtreeText: UNAVAILABLE,
  children: [
    {
      identity: `${CH_B_FILE}#mid`,
      range: CHB_MID_RANGE,
      ownText: UNAVAILABLE,
      subtreeText: UNAVAILABLE,
      children: [],
    },
    {
      identity: `${CH_B_FILE}#ok`,
      range: CHB_OK_RANGE,
      ownText: CH_B_OK_TEXT,
      subtreeText: CH_B_OK_TEXT,
      children: [],
    },
  ],
};

const CH_C_TEXT_TREE: TextTreeExpectation = {
  identity: CH_C_FILE,
  range: CH_C_ROOT_RANGE,
  ownText: CH_C_ROOT_OWN,
  subtreeText: UNAVAILABLE,
  children: [
    {
      identity: `${CH_C_FILE}#deep`,
      range: CHC_DEEP_RANGE,
      ownText: UNAVAILABLE,
      subtreeText: UNAVAILABLE,
      children: [],
    },
  ],
};

const CH_A_IMPORTS: readonly ViewImportEntry[] = [
  { range: CHA_IMPORT_RANGE, name: "B", target: CH_B_FILE },
];
const CH_B_IMPORTS: readonly ViewImportEntry[] = [
  { range: CHB_IMPORT_RANGE, name: "C", target: CH_C_FILE },
];

// The chain's occurrence records (SPEC 5.7): every resolving embedding —
// sources defined here (each enclosing section spells a unique id) — while
// the unresolved `{text("nosuch")}` records none (CH-C's list is empty, its
// position reaching consumers through the 14.6 finding's range).
const CH_A_OCCURRENCES: readonly OccurrenceRecord[] = [
  {
    file: CH_A_FILE,
    range: CHA_EMBED_MID_RANGE,
    kind: "embeds",
    source: { identity: `${CH_A_FILE}#top`, range: CHA_TOP_RANGE },
    target: `${CH_B_FILE}#mid`,
  },
  {
    file: CH_A_FILE,
    range: CHA_EMBED_OK_RANGE,
    kind: "embeds",
    source: { identity: `${CH_A_FILE}#side`, range: CHA_SIDE_RANGE },
    target: `${CH_B_FILE}#ok`,
  },
];
const CH_B_OCCURRENCES: readonly OccurrenceRecord[] = [
  {
    file: CH_B_FILE,
    range: CHB_EMBED_DEEP_RANGE,
    kind: "embeds",
    source: { identity: `${CH_B_FILE}#mid`, range: CHB_MID_RANGE },
    target: `${CH_C_FILE}#deep`,
  },
];

// --- staging 3: the embedding cycle (staged separately) -----------------------
//
// `{text("self")}` inside the section spelling `self`: the spelling
// RESOLVES (its target's identity is defined) and records an occurrence —
// an embeds edge from `self` to itself, a dependency cycle of length one
// (SPEC 5.3, 14.9) — while the expansion re-enters the node being expanded,
// poisoning self's whole own/subtree value. The sibling `calm` and the
// root's own text stay defined and byte-exact; the root's subtree text is
// poisoned through `self`.

const CY_FILE = "specs/CY.mdx";
const CY = new ByteFixture();
CY.add("Célula — self-embedding cycle.\n\n");
const CY_SELF_START = CY.pos;
CY.add('<S id="self">\nSelf head.\n\n');
const CY_SELF_EMBED_TEXT = '{text("self")}';
const CY_SELF_EMBED_RANGE = CY.add(CY_SELF_EMBED_TEXT);
CY.add("\n</S>");
const CY_SELF_RANGE: SourceRange = { start: CY_SELF_START, end: CY.pos };
CY.add("\n\n");
const CY_CALM_START = CY.pos;
CY.add('<S id="calm">\nCalm line.\n</S>');
const CY_CALM_RANGE: SourceRange = { start: CY_CALM_START, end: CY.pos };
CY.add("\n");
const CY_SOURCE = CY.source;
const CY_ROOT_RANGE: SourceRange = { start: 0, end: CY.pos };

const CY_CALM_TEXT = "Calm line.\n";
// Root own text: title + its blank line, then the blank line between the
// sections (no import line in this file).
const CY_ROOT_OWN = "Célula — self-embedding cycle.\n\n\n";

const CY_TEXT_TREE: TextTreeExpectation = {
  identity: CY_FILE,
  range: CY_ROOT_RANGE,
  ownText: CY_ROOT_OWN,
  subtreeText: UNAVAILABLE,
  children: [
    {
      identity: `${CY_FILE}#self`,
      range: CY_SELF_RANGE,
      ownText: UNAVAILABLE,
      subtreeText: UNAVAILABLE,
      children: [],
    },
    {
      identity: `${CY_FILE}#calm`,
      range: CY_CALM_RANGE,
      ownText: CY_CALM_TEXT,
      subtreeText: CY_CALM_TEXT,
      children: [],
    },
  ],
};

const CY_OCCURRENCES: readonly OccurrenceRecord[] = [
  {
    file: CY_FILE,
    range: CY_SELF_EMBED_RANGE,
    kind: "embeds",
    source: { identity: `${CY_FILE}#self`, range: CY_SELF_RANGE },
    target: `${CY_FILE}#self`,
  },
];

// --- staging 4: removal classification is by syntactic form -------------------
//
// specs/IMP.mdx imports specs/GONE.xspec with an UNUSED binding (2.1: valid,
// records no edges — so no expansion depends on the target and the text
// values stay defined on both sides of its deletion) and holds a stray
// `<div>` (14.16) inside its one section: content, preserved byte-for-byte
// in the enclosing text, located by its finding, with no view entry (SPEC
// 11.2, 11.4). Deleting GONE.mdx flips the import's `target` datum to the
// unavailability marker and adds the 14.15 finding — while every text value
// is byte-identical to before: the import is removed by FORM, target
// discovery notwithstanding.

const IMP_FILE = "specs/IMP.mdx";
const GONE_FILE = "specs/GONE.mdx";

const IMP = new ByteFixture();
IMP.add("Süd — removal classification.\n\n");
const IMP_IMPORT_TEXT = 'import GONE from "./GONE.xspec"';
const IMP_IMPORT_RANGE = IMP.add(IMP_IMPORT_TEXT);
IMP.add("\n\n");
const IMP_KEEP_START = IMP.pos;
IMP.add('<S id="keep">\nKeep head.\n\n');
const IMP_DIV_TEXT = "<div>stray</div>";
const IMP_DIV_RANGE = IMP.add(IMP_DIV_TEXT);
IMP.add("\n\nTail line.\n</S>");
const IMP_KEEP_RANGE: SourceRange = { start: IMP_KEEP_START, end: IMP.pos };
IMP.add("\n");
const IMP_SOURCE = IMP.source;
const IMP_ROOT_RANGE: SourceRange = { start: 0, end: IMP.pos };

const GONE_FIX = new ByteFixture();
GONE_FIX.add("Œuvre — deletable import target.\n\n");
const GONE_G_START = GONE_FIX.pos;
GONE_FIX.add('<S id="g">\nGone text.\n</S>');
const GONE_G_RANGE: SourceRange = { start: GONE_G_START, end: GONE_FIX.pos };
GONE_FIX.add("\n");
const GONE_SOURCE = GONE_FIX.source;
const GONE_ROOT_RANGE: SourceRange = { start: 0, end: GONE_FIX.pos };

// keep's contribution: body lines with the stray element's own characters
// preserved byte-for-byte (it matches no removal rule's form) and both
// blank lines intact; the tag lines drop.
const IMP_KEEP_TEXT = "Keep head.\n\n" + IMP_DIV_TEXT + "\n\nTail line.\n";
// Root own text: title + its blank line + the blank line left after the
// dropped import line; nothing after keep (the final `</S>` line drops).
const IMP_ROOT_OWN = "Süd — removal classification.\n\n\n";
const IMP_ROOT_SUBTREE = IMP_ROOT_OWN + IMP_KEEP_TEXT;
const GONE_G_TEXT = "Gone text.\n";
const GONE_ROOT_OWN = "Œuvre — deletable import target.\n\n";
const GONE_ROOT_SUBTREE = GONE_ROOT_OWN + GONE_G_TEXT;

// One pinned tree serves BOTH sides of the deletion (module comment: equal
// pinned values realize "byte-identical to before" and the by-form rule).
const IMP_TEXT_TREE: TextTreeExpectation = {
  identity: IMP_FILE,
  range: IMP_ROOT_RANGE,
  ownText: IMP_ROOT_OWN,
  subtreeText: IMP_ROOT_SUBTREE,
  children: [
    {
      identity: `${IMP_FILE}#keep`,
      range: IMP_KEEP_RANGE,
      ownText: IMP_KEEP_TEXT,
      subtreeText: IMP_KEEP_TEXT,
      children: [],
    },
  ],
};

const GONE_TEXT_TREE: TextTreeExpectation = {
  identity: GONE_FILE,
  range: GONE_ROOT_RANGE,
  ownText: GONE_ROOT_OWN,
  subtreeText: GONE_ROOT_SUBTREE,
  children: [
    {
      identity: `${GONE_FILE}#g`,
      range: GONE_G_RANGE,
      ownText: GONE_G_TEXT,
      subtreeText: GONE_G_TEXT,
      children: [],
    },
  ],
};

const IMP_IMPORTS_BEFORE: readonly ViewImportEntry[] = [
  { range: IMP_IMPORT_RANGE, name: "GONE", target: GONE_FILE },
];
const IMP_IMPORTS_AFTER: readonly ViewImportEntry[] = [
  { range: IMP_IMPORT_RANGE, name: "GONE", target: UNAVAILABLE },
];

const T11_2_4 = defineProductTest({
  id: "T11.2-4",
  title:
    "resolution turns on the referenced identity's own definedness: with duplicate spellings of `a` and the unique `a.b` beneath one bearer, the `d` entry naming `a.b` on the other bearer and the `{text(\"a.b\")}` embedding inside an id-less section each resolve and record occurrences whose `source` is exactly the unavailability marker (`file`, `range`, `kind`, `target` present — never a picked bearer, never a dropped record; observed via bare `occurrences` AND `view`), while the `d` reference to `a` records none — ambiguous, every bearer undefined — reported by its 14.5 finding's range, never as a record or an unavailable target, the view still positioning each enclosing construct with identity unavailable, the file's findings (14.1, 14.3, 14.5) accompanying, exit 1; `view --text`: CH-A embeds CH-B embeds CH-C with an unresolved embedding in CH-C (14.6, its finding's range exactly the braced container) → top's and mid's own/subtree text exactly the unavailability marker — one unresolved spelling, or (staged separately) one self-embedding cycle (14.9), poisons the whole value, partial expansion never occurring — while siblings with resolved expansions stay defined and byte-exact and each root's own text stays defined beside its poisoned subtree text; removal classification is by syntactic form: after deleting the imported (unused-binding) GONE.mdx, IMP.mdx's text values are byte-identical to before — the import removed by form, its 14.15 finding notwithstanding, the import entry's `target` flipping to the marker — and the stray `<div>` (14.16) is content, preserved byte-for-byte in the enclosing text and located by its finding (SPEC 11.2, 11.3, 11.4, 5.7, 1.6, 2.1, 3, 12.7, 14; CERTIFICATIONS.md CONF-AVAIL in scope)",
  run: async (product) => {
    // Fixture self-checks (T5.7-2 discipline): composed ranges sliced back
    // out of the staged bytes before any product invocation.
    sliceCheck(
      R_SOURCE,
      R_A2_D_REF,
      '"a.b"',
      "the resolving d reference on the second bearer",
    );
    sliceCheck(
      R_SOURCE,
      dLiteralRange(R_Q_D),
      '"a"',
      "the ambiguous d reference",
    );
    sliceCheck(
      R_SOURCE,
      R_EMBED_RANGE,
      R_EMBED_TEXT,
      "the id-less section's embedding container",
    );
    sliceCheck(
      R_SOURCE,
      { start: R_Q_START, end: R_Q_OPEN_END },
      '<S id="q" d={"a"}>',
      "q's opening tag",
    );
    sliceCheck(
      R_SOURCE,
      R_AB_RANGE,
      '<S id="a.b">\nTarget text.\n</S>',
      "the unique a.b construct",
    );
    sliceCheck(
      CH_A_SOURCE,
      CHA_IMPORT_RANGE,
      CHA_IMPORT_TEXT,
      "CH-A's import declaration",
    );
    sliceCheck(
      CH_A_SOURCE,
      CHA_EMBED_OK_RANGE,
      "{text(B.ok)}",
      "the resolved sibling embedding",
    );
    sliceCheck(
      CH_B_SOURCE,
      CHB_OK_RANGE,
      '<S id="ok">\nOK line.\n</S>',
      "CH-B's ok construct",
    );
    sliceCheck(
      CH_C_SOURCE,
      CHC_NOSUCH_RANGE,
      CHC_NOSUCH_TEXT,
      "the unresolved embedding container",
    );
    sliceCheck(
      CY_SOURCE,
      CY_SELF_EMBED_RANGE,
      CY_SELF_EMBED_TEXT,
      "the self-embedding container",
    );
    sliceCheck(
      IMP_SOURCE,
      IMP_IMPORT_RANGE,
      IMP_IMPORT_TEXT,
      "IMP's import declaration",
    );
    sliceCheck(IMP_SOURCE, IMP_DIV_RANGE, IMP_DIV_TEXT, "the stray element");
    sliceCheck(
      GONE_SOURCE,
      GONE_G_RANGE,
      '<S id="g">\nGone text.\n</S>',
      "GONE's section construct",
    );

    // Shared: exactly the R stagings' findings, keyed and located (the
    // identical multiset must accompany both surfaces' answers).
    const assertRFindings = (
      findings: readonly Finding[],
      context: string,
    ): void => {
      assertConditionCounts(
        findings,
        R_CONDITION_COUNTS,
        `${context} — exactly the staged conditions accompany (SPEC 11.2, ` +
          `14): one 14.1, one 14.3, one 14.5 — and no 14.2 (masked or ` +
          `satisfied everywhere) and no phantom condition`,
      );
      assertLocatedFinding(
        findingByCondition(findings, "14.1", context),
        [{ file: R_FILE, window: widened(R_NOID_RANGE) }],
        `${context} — the missing-id finding locates the id-less section`,
      );
      assertLocatedFinding(
        findingByCondition(findings, "14.3", context),
        [
          { file: R_FILE, window: widened(R_A1_RANGE) },
          { file: R_FILE, window: widened(R_A2_RANGE) },
        ],
        `${context} — the duplicate-id finding locates EVERY bearer of ` +
          `\`a\`, one location each in 12.7 location order (SPEC 14)`,
      );
      assertLocatedFinding(
        findingByCondition(findings, "14.5", context),
        [{ file: R_FILE, window: { start: R_Q_START, end: R_Q_OPEN_END + 1 } }],
        `${context} — the ambiguous reference to \`a\` is reported by its ` +
          `finding's range (within the opening tag spelling the reference), ` +
          `never as a record or an unavailable target (SPEC 11.2, 14)`,
      );
    };

    // --- Staging 1: resolution and source-side unavailability.
    {
      const workspace = await TestWorkspace.create({
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          [R_FILE]: R_SOURCE,
        },
      });
      try {
        const viewContext = "T11.2-4 bare `view` (the resolution matrix)";
        const viewResult = await expectExit(
          product,
          workspace,
          ["view"],
          1,
          `${viewContext} — findings and explicitly-unavailable datums ` +
            `accompany, so exit 1 with the full answer emitted (SPEC 11.2)`,
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
        assertRFindings(viewReport.findings, viewContext);
        assertSameJson(
          viewReport.views.map((view) => view.file),
          [R_FILE],
          `${viewContext} — one per-file view: the matrix file (SPEC 11.4)`,
        );
        const rView = viewReport.views[0]!;
        assertSameJson(
          projectNode(rView.root),
          R_TREE,
          `${viewContext} — the view still positions each enclosing ` +
            `construct (SPEC 11.4): both duplicate bearers and the id-less ` +
            `section with byte-exact ranges and raw attribute entries, ` +
            `identities explicitly unavailable, while a.b (defined without ` +
            `defined prefixes) and q stay defined (SPEC 11.2)`,
        );
        assertSameJson(
          rView.occurrences,
          R_EXPECTED_OCCURRENCES,
          `${viewContext} — the file's occurrence records: the two ` +
            `resolving spellings record with source EXACTLY the ` +
            `unavailability marker (identity and range withheld together ` +
            `as one datum) and file/range/kind/target present; the ` +
            `ambiguous reference to a records NONE (SPEC 5.7, 11.2)`,
        );
        assertSameJson(
          [rView.imports, rView.comments],
          [[], []],
          `${viewContext} — the matrix file holds no imports or comments: ` +
            `empty arrays, never null (SPEC 12.7)`,
        );

        const occContext =
          "T11.2-4 bare `occurrences` (no --file: the entire discovered set)";
        const occResult = await expectExit(
          product,
          workspace,
          ["occurrences"],
          1,
          `${occContext} — the enumeration carries the domain's findings ` +
            `and explicitly-unavailable source datums, so exit 1 with the ` +
            `full answer (SPEC 11.2, 11.3)`,
        );
        const occReport = decodeOccurrencesReport(
          parseJsonStdout(
            occResult,
            `${occContext} — a single JSON document is the only output ` +
              `form (SPEC 11)`,
          ),
          occContext,
        );
        assertRFindings(occReport.findings, occContext);
        assertSameJson(
          occReport.occurrences,
          R_EXPECTED_OCCURRENCES,
          `${occContext} — the workspace's COMPLETE enumeration: exactly ` +
            `the two resolving spellings' records (never a dropped ` +
            `record), each source exactly the marker (never a picked ` +
            `bearer's identity), and no record — with no unavailable ` +
            `target — for the ambiguous reference (SPEC 5.7, 11.2, 11.3)`,
        );
      } finally {
        await workspace.dispose();
      }
    }

    // --- Staging 2: whole-value poisoning through an unresolved spelling.
    {
      const workspace = await TestWorkspace.create({
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          [CH_A_FILE]: CH_A_SOURCE,
          [CH_B_FILE]: CH_B_SOURCE,
          [CH_C_FILE]: CH_C_SOURCE,
        },
      });
      try {
        const context = "T11.2-4 bare `view --text` (the embedding chain)";
        const result = await expectExit(
          product,
          workspace,
          ["view", "--text"],
          1,
          `${context} — a finding and explicitly-unavailable text values ` +
            `accompany, so exit 1 with the full answer (SPEC 11.2)`,
        );
        const report = decodeViewReport(
          parseJsonStdout(
            result,
            `${context} — a single JSON document is the only output form ` +
              `(SPEC 11)`,
          ),
          { text: true },
          context,
        );
        assertConditionCounts(
          report.findings,
          { "14.6": 1 },
          `${context} — the unresolved embedding is the workspace's ONLY ` +
            `condition (every id unique and well-formed, every import ` +
            `valid), so exactly one 14.6 accompanies (SPEC 11.2, 14)`,
        );
        const unresolved = findingByCondition(report.findings, "14.6", context);
        assertSameJson(
          {
            code: unresolved.code,
            locations: unresolved.locations,
            path: unresolved.path,
          },
          {
            code: "unknown-text-target",
            locations: [{ file: CH_C_FILE, range: CHC_NOSUCH_RANGE }],
            path: null,
          },
          `${context} — the non-recording spelling is located by its ` +
            `finding: stable code unknown-text-target, its one location's ` +
            `range EXACTLY the full braced container — the span its ` +
            `occurrence would occupy (SPEC 14, 5.7, 12.7)`,
        );
        assertSameJson(
          report.views.map((view) => view.file),
          [CH_A_FILE, CH_B_FILE, CH_C_FILE],
          `${context} — per-file views in path-byte order (SPEC 11.4)`,
        );
        const aView = report.views[0]!;
        const bView = report.views[1]!;
        const cView = report.views[2]!;
        assertSameJson(
          projectTextNode(aView.root),
          CH_A_TEXT_TREE,
          `${context} — CH-A: top's own/subtree text EXACTLY the ` +
            `unavailability marker (one unresolved spelling on the ` +
            `expansion path poisons the whole value — partial expansion ` +
            `never occurs), the sibling side defined and byte-exact with ` +
            `its resolved expansion inserted, the root's own text defined ` +
            `beside its poisoned subtree text (SPEC 11.2, 1.6, 3)`,
        );
        assertSameJson(
          projectTextNode(bView.root),
          CH_B_TEXT_TREE,
          `${context} — CH-B: mid poisoned (the unresolved spelling lies ` +
            `two hops down), ok defined and byte-exact, root own text ` +
            `defined (SPEC 11.2, 1.6, 3)`,
        );
        assertSameJson(
          projectTextNode(cView.root),
          CH_C_TEXT_TREE,
          `${context} — CH-C: deep (holding the unresolved spelling) ` +
            `poisoned, root own text defined (SPEC 11.2, 1.6, 3)`,
        );
        assertSameJson(
          [aView.imports, bView.imports, cView.imports],
          [CH_A_IMPORTS, CH_B_IMPORTS, []],
          `${context} — each import declaration with its range, default ` +
            `binding, and resolved target file (SPEC 11.4)`,
        );
        assertSameJson(
          [aView.occurrences, bView.occurrences, cView.occurrences],
          [CH_A_OCCURRENCES, CH_B_OCCURRENCES, []],
          `${context} — the resolving embeddings record (defined sources ` +
            `here); the unresolved spelling records NONE, so CH-C's list ` +
            `is empty (SPEC 5.7, 11.2)`,
        );
        assertSameJson(
          [aView.comments, bView.comments, cView.comments],
          [[], [], []],
          `${context} — no comments staged: empty arrays (SPEC 12.7)`,
        );
      } finally {
        await workspace.dispose();
      }
    }

    // --- Staging 3: whole-value poisoning through an embedding cycle.
    {
      const workspace = await TestWorkspace.create({
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          [CY_FILE]: CY_SOURCE,
        },
      });
      try {
        const context = "T11.2-4 bare `view --text` (the self-embedding cycle)";
        const result = await expectExit(
          product,
          workspace,
          ["view", "--text"],
          1,
          `${context} — the cycle finding and poisoned text values ` +
            `accompany, so exit 1 with the full answer (SPEC 11.2)`,
        );
        const report = decodeViewReport(
          parseJsonStdout(
            result,
            `${context} — a single JSON document is the only output form ` +
              `(SPEC 11)`,
          ),
          { text: true },
          context,
        );
        assertConditionCounts(
          report.findings,
          { "14.9": 1 },
          `${context} — the length-one embedding cycle is the workspace's ` +
            `ONLY condition: exactly one 14.9 (SPEC 5.3, 14)`,
        );
        assertLocatedFinding(
          findingByCondition(report.findings, "14.9", context),
          [{ file: CY_FILE, window: widened(CY_SELF_EMBED_RANGE) }],
          `${context} — the cycle locates its full path in source: the one ` +
            `participating reference spelling, the self-embedding ` +
            `container (SPEC 14)`,
        );
        assertSameJson(
          report.views.map((view) => view.file),
          [CY_FILE],
          `${context} — one per-file view (SPEC 11.4)`,
        );
        const cyView = report.views[0]!;
        assertSameJson(
          projectTextNode(cyView.root),
          CY_TEXT_TREE,
          `${context} — one embedding cycle poisons the whole value: ` +
            `self's own/subtree text EXACTLY the unavailability marker ` +
            `(the recursion re-enters a node being expanded; partial ` +
            `expansion never occurs), the sibling calm defined and ` +
            `byte-exact, the root's own text defined beside its poisoned ` +
            `subtree text (SPEC 11.2, 1.6)`,
        );
        assertSameJson(
          cyView.occurrences,
          CY_OCCURRENCES,
          `${context} — the cycle-participating spelling RESOLVES and ` +
            `records its occurrence (cycle participation never erases ` +
            `records; its source is the defined self node): exactly one ` +
            `embeds record, self to self (SPEC 5.7, 11.2)`,
        );
        assertSameJson(
          [cyView.imports, cyView.comments],
          [[], []],
          `${context} — no imports or comments staged (SPEC 12.7)`,
        );
      } finally {
        await workspace.dispose();
      }
    }

    // --- Staging 4: removal classification is by syntactic form.
    {
      const workspace = await TestWorkspace.create({
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          [IMP_FILE]: IMP_SOURCE,
          [GONE_FILE]: GONE_SOURCE,
        },
      });
      try {
        // Before the deletion: the import resolves; the stray element is
        // the only condition; every text value is defined and pinned.
        const beforeContext =
          "T11.2-4 bare `view --text` (before deleting the imported file)";
        const beforeResult = await expectExit(
          product,
          workspace,
          ["view", "--text"],
          1,
          `${beforeContext} — the stray-element finding accompanies, so ` +
            `exit 1 with the full answer (SPEC 11.2)`,
        );
        const beforeReport = decodeViewReport(
          parseJsonStdout(
            beforeResult,
            `${beforeContext} — a single JSON document is the only output ` +
              `form (SPEC 11)`,
          ),
          { text: true },
          beforeContext,
        );
        assertConditionCounts(
          beforeReport.findings,
          { "14.16": 1 },
          `${beforeContext} — the stray element is the workspace's ONLY ` +
            `condition before the deletion (the unused-binding import is ` +
            `valid, SPEC 2.1, 14)`,
        );
        assertLocatedFinding(
          findingByCondition(beforeReport.findings, "14.16", beforeContext),
          [{ file: IMP_FILE, window: widened(IMP_DIV_RANGE) }],
          `${beforeContext} — the stray element is located by its finding ` +
            `(SPEC 11.2, 14)`,
        );
        assertSameJson(
          beforeReport.views.map((view) => view.file),
          [GONE_FILE, IMP_FILE],
          `${beforeContext} — per-file views in path-byte order (SPEC 11.4)`,
        );
        const goneView = beforeReport.views[0]!;
        const impBeforeView = beforeReport.views[1]!;
        assertSameJson(
          projectTextNode(goneView.root),
          GONE_TEXT_TREE,
          `${beforeContext} — the import target's own view, text values ` +
            `defined and byte-exact (SPEC 11.4, 1.6, 3)`,
        );
        assertSameJson(
          projectTextNode(impBeforeView.root),
          IMP_TEXT_TREE,
          `${beforeContext} — IMP's text values: the import line removed ` +
            `by form, the stray <div> preserved byte-for-byte as content ` +
            `in the enclosing text (it matches no removal rule's form, ` +
            `14.16 notwithstanding), the section tag lines dropped (SPEC ` +
            `11.2, 1.6, 3)`,
        );
        assertSameJson(
          impBeforeView.imports,
          IMP_IMPORTS_BEFORE,
          `${beforeContext} — the import entry: range, default binding ` +
            `GONE, resolved target specs/GONE.mdx (SPEC 11.4, 2.1)`,
        );
        assertSameJson(
          [
            goneView.imports,
            goneView.occurrences,
            goneView.comments,
            impBeforeView.occurrences,
            impBeforeView.comments,
          ],
          [[], [], [], [], []],
          `${beforeContext} — the unused binding records no occurrence ` +
            `(SPEC 2.1, 5.7); no comments staged (SPEC 12.7)`,
        );

        // Delete the imported file: removal classification is by syntactic
        // form, so IMP's text values MUST NOT move.
        await fsp.rm(workspace.path(GONE_FILE));

        const afterContext =
          "T11.2-4 bare `view --text` (after deleting the imported file)";
        const afterResult = await expectExit(
          product,
          workspace,
          ["view", "--text"],
          1,
          `${afterContext} — the 14.15 and 14.16 findings accompany, so ` +
            `exit 1 with the full answer (SPEC 11.2)`,
        );
        const afterReport = decodeViewReport(
          parseJsonStdout(
            afterResult,
            `${afterContext} — a single JSON document is the only output ` +
              `form (SPEC 11)`,
          ),
          { text: true },
          afterContext,
        );
        assertConditionCounts(
          afterReport.findings,
          { "14.15": 1, "14.16": 1 },
          `${afterContext} — the import no longer designates a discovered ` +
            `spec source (14.15) beside the unchanged stray-element ` +
            `finding — and nothing else (SPEC 2.1, 14)`,
        );
        assertLocatedFinding(
          findingByCondition(afterReport.findings, "14.15", afterContext),
          [{ file: IMP_FILE, window: widened(IMP_IMPORT_RANGE) }],
          `${afterContext} — the invalid import is located at its ` +
            `declaration (SPEC 14)`,
        );
        assertLocatedFinding(
          findingByCondition(afterReport.findings, "14.16", afterContext),
          [{ file: IMP_FILE, window: widened(IMP_DIV_RANGE) }],
          `${afterContext} — the stray element's finding is unchanged ` +
            `(SPEC 14)`,
        );
        assertSameJson(
          afterReport.views.map((view) => view.file),
          [IMP_FILE],
          `${afterContext} — the deleted file is no longer discovered: ` +
            `IMP's view alone (SPEC 11.4)`,
        );
        const impAfterView = afterReport.views[0]!;
        assertSameJson(
          projectTextNode(impAfterView.root),
          IMP_TEXT_TREE,
          `${afterContext} — the importing file's text values are ` +
            `BYTE-IDENTICAL to before (the same pinned tree): every import ` +
            `declaration is removed by FORM — binding shape, specifier ` +
            `validity, and target discovery notwithstanding — so the ` +
            `deletion perturbs no text value, its 14.15 finding ` +
            `notwithstanding (SPEC 11.2, 3)`,
        );
        assertSameJson(
          impAfterView.imports,
          IMP_IMPORTS_AFTER,
          `${afterContext} — the import entry stays on view with its ` +
            `range and binding, its resolved target now EXACTLY the ` +
            `unavailability marker: discovery defines none (SPEC 11.4, ` +
            `11.2)`,
        );
        assertSameJson(
          [impAfterView.occurrences, impAfterView.comments],
          [[], []],
          `${afterContext} — still no occurrences (the binding stays ` +
            `unused) and no comments (SPEC 5.7, 12.7)`,
        );
      } finally {
        await workspace.dispose();
      }
    }
  },
});

/** TEST-SPEC §11.2, in canonical ID order (SUITE-52). */
export const section112Tests: readonly ProductTestEntry[] = [
  T11_2_1,
  T11_2_2,
  T11_2_3,
  T11_2_4,
];
