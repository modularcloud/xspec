// TEST-SPEC §11.2 (availability on imperfect files) — SUITE-52: T11.2-1
// through T11.2-7.
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
// (VIOL-AVAIL-NOFILE's staging constraint) — unlike T11.2-1, T11.2-3,
// T11.2-5, and T11.2-6, which are not in scope (CONF-AVAIL's workspace scope
// is `#`-free valid-UTF-8 paths with no code groups, so T11.2-3's staging
// lies outside it by construction, and T11.2-5 — its argument and
// domain-and-exit matrix — and T11.2-6 — its answer-side no-write compares
// lean on the compare-around machinery certified through
// VIOL-CORE-CHATTYREADS — are expressly Exclusions entries): staging
// integrity rides each
// answer's own exact accompanying-findings multiset instead, and the
// staged conditions are
// drawn from the scope's stated set (T11.2-2: 14.1, 14.2, 14.3, 14.4, 14.5,
// 14.6, 14.17; T11.2-4: 14.1, 14.3, 14.5, 14.6, 14.9, 14.15, 14.16).
// T11.2-7 lies in no fixture's in-scope set; its arms drive bare
// `view --text` alone.
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
  FindingLocation,
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
import { stageDirectoryMode } from "../../helpers/permissions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { assertLeavesUnchanged } from "../../helpers/snapshot.js";
import { stagedMdx } from "../../helpers/staged-mdx.js";
import type { StagedMdx } from "../../helpers/staged-mdx.js";
import { stagedTs } from "../../helpers/staged-ts.js";
import { runProduct } from "../../helpers/subprocess.js";
import type {
  ArgvValue,
  ProductBinding,
  RunResult,
} from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { WorkspaceDecl } from "../../helpers/workspace.js";
import {
  assertConditionCounts,
  assertFindingConcernsPath,
  assertFindingLocated,
  assertPlainUsageError,
  assertSameJson,
  buildOk,
  expectErrorDocument,
  expectExit,
  expectFindingFreeReport,
  runCli,
  runFindingsReport,
  runJson,
} from "./support.js";

// Minimal declarative configuration (SPEC 7): exactly one spec group.
// Exported (with the T11.2-3 code-source and T11.2-4 resolution-matrix
// staging constants below): T11.3-1 asserts the same stagings' enumerations
// through `occurrences` (registry/section-11.3.ts imports, never copies).
// A TypeScript staged-source record (helpers/staged-ts.ts; S-9's TypeScript
// and timing clauses), staged wherever it is used and named for every body
// staging it after a product invocation: T11.2-4's later stagings,
// T11.2-5's second workspace, T11.2-6's corrupt-session workspace, and
// T11.2-7's later arms here, T11.3-1's, T11.3-2's, and T11.3-3's later
// workspaces, T11.4-3's shared workspace and T11.4-5's and T11.4-6's later
// ones, T11.6-4's corrupt-session workspace and T14-4's corrupt-session
// row (the same staging, through `T11_2_6_PASSING_SIDE_STAGINGS`), and
// P-12's later trials (registry/section-16-p12.ts).
export const SPECS_ONLY_CONFIG = stagedTs(
  "T11.2-4/T11.2-5/T11.2-6/T11.2-7/T11.3-1/T11.3-2/T11.3-3/T11.4-3/T11.4-5/T11.4-6/T11.6-4/T14-4/P-12 xspec.config.ts — one spec group",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
);

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
 * The reference expression inside a single-reference `d={…}` attribute:
 * `d={` and the closing `}` excluded — a `d` occurrence spans that one
 * reference's own expression, for the local form the string literal's
 * characters quotes included (the T5.7-2 convention) and for the external
 * form the property chain's characters (SPEC 5.7, 2.2). ASCII segment, so
 * character arithmetic is byte arithmetic.
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
// Restaged after a body's first product invocation (T11.2-5's cycle-pair
// workspace, T11.2-6's later fixtures, and T11.6-4's and T14-4's
// corrupt-session workspaces, T11.2-6's fixture 5 staged through
// `T11_2_6_PASSING_SIDE_STAGINGS`), so S-7's sweep never reaches those
// stagings against the stub: a staged-source record (helpers/staged-mdx.ts;
// S-9's before-any-product clause) made from the string the pins use, and
// staged at every site the bytes appear (T11.2-1's too).
const C_STAGED = stagedMdx(
  "T11.2-1/T11.2-5/T11.2-6/T11.6-4/T14-4 specs/C.mdx (the finding-free file; T11.2-6's discovered-component, corrupt-session, and unreadable-emit-directory fixtures, and T11.6-4's and T14-4's corrupt-session workspaces, stage it at specs/A.mdx too)",
  C_SOURCE,
);
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

/**
 * The finding-free C-shaped document's tree projection at `file`: a node
 * identity is formed over the file's path (SPEC 1.5), so the same bytes
 * staged at another path project the same ranges and attribute entries
 * under that path's identities (T11.2-6 stages them at `specs/A.mdx`).
 */
function cShapedTreeAt(file: string): TreeExpectation {
  return {
    identity: file,
    range: C_ROOT_RANGE,
    attributes: [],
    children: [
      {
        identity: `${file}#c`,
        range: C_SECTION_RANGE,
        attributes: [C_ID],
        children: [],
      },
    ],
  };
}

const C_TREE: TreeExpectation = cShapedTreeAt(C_FILE);

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
        [C_FILE]: C_STAGED,
      },
      // S-9: B is the staged parse failure (14.20).
      mdx: { unparseable: [B_FILE] },
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
// - structural validity is a chain condition too (each spelled identity in
//   the chain satisfies 1.3): the well-formed, uniquely spelled `m.n`
//   nested inside the defined `k`, and the top-level `q.r`, are unavailable
//   (structurally invalid: one 14.2 each), their structurally consistent
//   children `m.n.o` and `q.r.s` unavailable by inheritance (no 14.2: each
//   extends its parent's spelling by exactly one segment, T1.3-2); the same
//   file's `d={"m.n"}` and `{text("m.n.o")}` (on the defined `refs`)
//   report 14.5 and 14.6 and record no occurrence — the view's
//   `occurrences` stays empty (11.4; CONF-AVAIL's staging constraint: the
//   no-occurrence arm rides the one file's view). A product resolving
//   through every well-formed, uniquely spelled ID and ignoring 1.3
//   defines all four and records two occurrences in place of the 14.5 and
//   the 14.6;
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
// file granularity (range precision is T14-8's), but for the
// structural-chain arm's four findings, each attributed to its offending
// construct by T11.2-4's window discipline (exactly one location, inside
// the construct's end-widened byte window): "one 14.2 per invalid bearer,
// none for its child" is that arm's own claim, so each 14.2 lies on its
// bearer's opening tag (`m.n`'s, then `q.r`'s, in 12.7 order — never a
// child's tag), the 14.5 on the opening tag spelling `d={"m.n"}`, and the
// 14.6 on the `{text("m.n.o")}` container.

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
// malformed spelled identity. No 14.2 in this arm: the child extends its
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

// (k) Structural validity is a chain condition too (SPEC 11.2: each spelled
// identity in the chain satisfies 1.3). `m.n` — well-formed (1.4) and
// uniquely spelled — is nested inside `k` yet does not extend `k`'s
// spelling (14.2), and the top-level `q.r` is two segments where a
// top-level ID is exactly one (14.2): both unavailable. Their children
// `m.n.o` and `q.r.s` each extend their own parent's spelling by exactly
// one segment (T1.3-2: no 14.2 of their own) and are unavailable by
// inheritance; `k` stays defined. The defined `refs` then spells the same
// file's `d={"m.n"}` and `{text("m.n.o")}`: neither names a target whose
// identity is defined, so each records no occurrence and reports its
// finding (14.5, 14.6) — never an unavailable target (SPEC 11.2). Each
// opening tag's end is kept for the findings' windows (T11.2-4's
// discipline): the bearers' tags discriminate them from their children's.
const M_K_START = M.pos;
M.add("<S ");
const M_K_ID = M.attr("id", 'id="k"');
M.add(">\nChain host.\n\n");
const M_MN_START = M.pos;
M.add("<S ");
const M_MN_ID = M.attr("id", 'id="m.n"');
M.add(">");
const M_MN_OPEN_END = M.pos;
M.add("\nStructurally invalid bearer.\n\n");
const M_MNO_START = M.pos;
M.add("<S ");
const M_MNO_ID = M.attr("id", 'id="m.n.o"');
M.add(">\nInheriting child.\n</S>");
const M_MNO_RANGE: SourceRange = { start: M_MNO_START, end: M.pos };
M.add("\n</S>");
const M_MN_RANGE: SourceRange = { start: M_MN_START, end: M.pos };
M.add("\n</S>");
const M_K_RANGE: SourceRange = { start: M_K_START, end: M.pos };
M.add("\n\n");
const M_QR_START = M.pos;
M.add("<S ");
const M_QR_ID = M.attr("id", 'id="q.r"');
M.add(">");
const M_QR_OPEN_END = M.pos;
M.add("\nTop-level two-segment bearer.\n\n");
const M_QRS_START = M.pos;
M.add("<S ");
const M_QRS_ID = M.attr("id", 'id="q.r.s"');
M.add(">\nInheriting child.\n</S>");
const M_QRS_RANGE: SourceRange = { start: M_QRS_START, end: M.pos };
M.add("\n</S>");
const M_QR_RANGE: SourceRange = { start: M_QR_START, end: M.pos };
M.add("\n\n");
const M_REFS_START = M.pos;
M.add("<S ");
const M_REFS_ID = M.attr("id", 'id="refs"');
M.add(" ");
const M_REFS_D = M.attr("d", 'd={"m.n"}');
M.add(">");
const M_REFS_OPEN_END = M.pos;
M.add("\nReferences into the invalid chain.\n\n");
const M_REFS_EMBED_TEXT = '{text("m.n.o")}';
const M_REFS_EMBED_RANGE = M.add(M_REFS_EMBED_TEXT);
M.add("\n</S>");
const M_REFS_RANGE: SourceRange = { start: M_REFS_START, end: M.pos };
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
 * invalid tag (`bad#tag`, T1.4-4's condition); 14.2 once per structurally
 * invalid bearer (`m.n` nested inside `k`, the top-level `q.r`); 14.5 and
 * 14.6 once each, for `refs`'s `d={"m.n"}` and `{text("m.n.o")}`. The masked
 * checks contribute nothing: no 14.1 from repeated/braced/valueless `id`
 * (condition 17, never 1), and no 14.2 beyond the two bearers' (the no-`id`
 * section's child is masked; every other child — `m.n.o` and `q.r.s`
 * included — extends its parent's spelling by exactly one segment).
 */
const M_CONDITION_COUNTS: Readonly<Record<string, number>> = {
  "14.1": 1,
  "14.2": 2,
  "14.3": 1,
  "14.4": 3,
  "14.5": 1,
  "14.6": 1,
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
    datumLeaf(`${M_FILE}#k`, M_K_RANGE, [M_K_ID], {
      children: [
        datumLeaf(UNAVAILABLE, M_MN_RANGE, [M_MN_ID], {
          children: [datumLeaf(UNAVAILABLE, M_MNO_RANGE, [M_MNO_ID])],
        }),
      ],
    }),
    datumLeaf(UNAVAILABLE, M_QR_RANGE, [M_QR_ID], {
      children: [datumLeaf(UNAVAILABLE, M_QRS_RANGE, [M_QRS_ID])],
    }),
    datumLeaf(`${M_FILE}#refs`, M_REFS_RANGE, [M_REFS_ID, M_REFS_D]),
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
    'one file\'s definedness matrix via bare `view`: exactly one quoted static `id` is defined while repeated (agreeing and disagreeing), braced (`id={"x"}`), valueless, and absent `id` each spell none — identity explicitly unavailable; duplicate spellings of `x` leave both bearers unavailable, no winner, while the uniquely spelled `x.y` beneath one keeps its defined identity (defined without defined prefixes); descendants of a no-`id` and of a malformed-`id` (`ha#sh`) section are undefined by inheritance (grandchild included); structural validity is a chain condition too — the well-formed, uniquely spelled `m.n` nested inside `k` and the top-level `q.r` are unavailable (structurally invalid), their structurally consistent children `m.n.o` and `q.r.s` unavailable by inheritance, `k` defined, exactly one 14.2 per invalid bearer (on its opening tag, none for either child), and the same file\'s `d={"m.n"}` and `{text("m.n.o")}` report 14.5 and 14.6, recording no occurrence; the unique `z` stays defined beside a braced `id={"z"}` (an invalid form contests nothing); absent `tags`/`coverage` props define the defaults (no tags, coverage-required) while repeated, malformed, and invalid-valued ones leave the interpreted value unavailable, raw spellings still listed; the answer carries exactly the staged findings (14.1, one 14.2 per structurally invalid bearer, 14.3, one 14.4 per malformed identity or tag, 14.5, 14.6, one 14.17 per afflicted element), each located in the file, exit 1 (SPEC 11.2, 11.4, 1.3, 2.5-2.7, 14; CERTIFICATIONS.md CONF-AVAIL in scope)',
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
    sliceCheck(
      M_SOURCE,
      M_MN_RANGE,
      '<S id="m.n">\nStructurally invalid bearer.\n\n' +
        '<S id="m.n.o">\nInheriting child.\n</S>\n</S>',
      "the structurally invalid m.n construct, its child inside",
    );
    sliceCheck(
      M_SOURCE,
      { start: M_MN_START, end: M_MN_OPEN_END },
      '<S id="m.n">',
      "the m.n opening tag (its 14.2 window)",
    );
    sliceCheck(
      M_SOURCE,
      { start: M_QR_START, end: M_QR_OPEN_END },
      '<S id="q.r">',
      "the q.r opening tag (its 14.2 window)",
    );
    sliceCheck(
      M_SOURCE,
      { start: M_REFS_START, end: M_REFS_OPEN_END },
      '<S id="refs" d={"m.n"}>',
      "the refs opening tag (its 14.5 window)",
    );
    sliceCheck(
      M_SOURCE,
      M_REFS_EMBED_RANGE,
      '{text("m.n.o")}',
      "the refs embedding container (its 14.6 window)",
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
          `(SPEC 11.2, 14): one 14.1 (the id-less section), two 14.2 (the ` +
          `structurally invalid m.n nested inside k and the top-level q.r), ` +
          `one 14.3 (the duplicated x, locating both bearers), three 14.4 ` +
          `(ha#sh, ha#sh.kid, the invalid tag bad#tag), one 14.5 and one ` +
          `14.6 (refs's d={"m.n"} and {text("m.n.o")}, naming no target ` +
          `whose identity is defined), ten 14.17 (repeated ` +
          `agreeing/disagreeing id, braced id x2, valueless id, repeated ` +
          `tags, braced tags, repeated coverage, valueless coverage, ` +
          `invalid coverage value) — and nothing masked reports: no 14.1 ` +
          `from an invalid-form id (condition 17, never 1) and no 14.2 ` +
          `beyond the two bearers' (the no-id section's child is masked, ` +
          `every other child — m.n.o and q.r.s included — extends its ` +
          `parent's spelling by exactly one segment, T1.3-2)`,
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

      // The structural-chain arm's findings, each on its offending
      // construct (T11.2-4's window discipline; counts asserted above): one
      // 14.2 per structurally invalid bearer, in 12.7 order — `m.n`'s on
      // its opening tag, then `q.r`'s on its — so neither lies on a child's
      // tag; the 14.5 on the opening tag spelling `d={"m.n"}`; the 14.6 on
      // the `{text("m.n.o")}` container.
      const structuralFindings = report.findings.filter(
        (finding) => finding.condition === "14.2",
      );
      assertLocatedFinding(
        structuralFindings[0]!,
        [
          {
            file: M_FILE,
            window: { start: M_MN_START, end: M_MN_OPEN_END + 1 },
          },
        ],
        `${context} — the first 14.2 is m.n's alone: nested inside k, it ` +
          `does not extend k's spelling by one segment (SPEC 1.3, 11.2, ` +
          `14), located on its own opening tag — never on its structurally ` +
          `consistent child m.n.o's`,
      );
      assertLocatedFinding(
        structuralFindings[1]!,
        [
          {
            file: M_FILE,
            window: { start: M_QR_START, end: M_QR_OPEN_END + 1 },
          },
        ],
        `${context} — the second 14.2 is q.r's alone: a top-level ID is ` +
          `exactly one segment (SPEC 1.3, 11.2, 14), located on its own ` +
          `opening tag — never on its structurally consistent child q.r.s's`,
      );
      assertLocatedFinding(
        findingByCondition(report.findings, "14.5", context),
        [
          {
            file: M_FILE,
            window: { start: M_REFS_START, end: M_REFS_OPEN_END + 1 },
          },
        ],
        `${context} — d={"m.n"} names a section whose identity the ` +
          `structural chain condition leaves undefined, so it resolves to ` +
          `no target and is reported by its finding's range (within the ` +
          `opening tag spelling it), never as an occurrence or an ` +
          `unavailable target (SPEC 11.2, 14)`,
      );
      assertLocatedFinding(
        findingByCondition(report.findings, "14.6", context),
        [{ file: M_FILE, window: widened(M_REFS_EMBED_RANGE) }],
        `${context} — {text("m.n.o")} names a section undefined by ` +
          `inheritance, so it resolves to no target and is reported by its ` +
          `finding's range (within the embedding container), never as an ` +
          `occurrence or an unavailable target (SPEC 11.2, 14)`,
      );

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
        [report.views[0]!.imports, report.views[0]!.comments],
        [[], []],
        `${context} — the matrix file holds no imports or comments: empty ` +
          `arrays, never null (SPEC 12.7)`,
      );
      assertSameJson(
        report.views[0]!.occurrences,
        [],
        `${context} — the file's only reference spellings, refs's ` +
          `d={"m.n"} and {text("m.n.o")}, record no occurrence: each names ` +
          `a section the structural chain condition leaves undefined (SPEC ` +
          `11.2, 5.7), so the view's occurrences (11.4) are the empty array, ` +
          `never null (12.7)`,
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
// Staging: one workspace, spec group + code group (the target side below
// has its own, configured alike). `specs/OK.mdx` is the valid-path
// contrast (root identity is defined EXACTLY when the file's path is
// valid — both directions in one document) and the reference target;
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
// Target side (11.2's resolution rule read from the target: a spelling
// resolves only to a section whose node identity is defined, or — in
// module form — to a root whose identity is defined, its path valid; 1.5:
// no identity is resolved against over an invalid path): a second
// workspace, created once the first is disposed — after the body's first
// product invocation, so its initial files are staged-source records
// (S-9's timing clause). `specs/a'b.mdx` is discovered (the spec glob
// matches it) and barred by 7.1 (`'` in a spec-group path, T7.1-1) — one
// 14.19 — and holds the section `x`. `specs/A.mdx` imports it as
// `import B from "./a'b.xspec"` and the code source `src/use.ts` as
// `import B, { text } from "../specs/a'b.xspec"`: each import is valid,
// its target a discovered source of a configured spec group whatever its
// path's validity (2.1, 4), so no 14.15 arises. `specs/A.mdx` spells
// `d={B.x}`, `d={B}` (the module form, naming the root), and the embedding
// `{text(B.x)}`; the code source the call `text(B.x)` inside a named
// function and the bare top-level marker `B.x`. None of the five resolves
// — `x`'s identity and the root's are undefined over the invalid path — so
// each records no edge and no occurrence and reports its own condition at
// the span its occurrence would occupy (SPEC 14): 14.5 at each `d` value's
// expression, 14.6 at the embedding's full braced container, 14.7 at the
// call (callee through closing parenthesis) and at the bare chain (its
// terminator excluded) — beside the target's 14.19, and nothing else.
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
//   clause and is not repeated here. On the target side the compare spans
//   `build` and `check` (which writes nothing, 12.2) alike.
// - The target side's findings are pinned form-exactly — stable code,
//   every location's file and exact range (SPEC 14 fixes a reference
//   spelling's range as the span its occurrence occupies or would
//   occupy), the 14.19's empty locations and concerned path — at `build
//   --json` and `check --json` (the workspace is never built, so `check`
//   reports `build`'s findings exactly: 14.10's mismatch forms are
//   undetectable on a workspace failing `build`'s validations, and no
//   record exists), at bare `occurrences` and both `--to` answers (their
//   consulted domain the entire discovered set: all six findings), and at
//   `view specs/A.mdx`, whose consulted domain is the named file: its
//   three findings alone, never the code source's 14.7s or the target's
//   14.19 (a 14.19 is a domain file's through its concerned path, 11.2).
// - "No edge and no occurrence" is observed through the occurrence
//   surfaces — on a failing workspace the gated reads report findings
//   without answering (T13.3-3), so no edge listing exists: every
//   enumeration is pinned exactly empty (bare `occurrences`, both `--to`
//   selections, `specs/A.mdx`'s view). No record of any file therefore
//   carries a `target` over the invalid path: a product that resolves into
//   the invalid-path file — emitting `specs/a'b.mdx#x` or `specs/a'b.mdx`
//   as an identity — fails those compares, and the condition counts
//   before them, its five findings missing.
// - The import's view entry pins `target` as the plain path
//   `specs/a'b.mdx` — the discovered spec source the specifier designates
//   (11.4) — never the unavailability marker of a product reading it as
//   the target root's (undefined) identity (T11.4-4); its range is the
//   declaration's own characters (no terminator), its name `B`.
// - `--to "specs/a'b.mdx#x"` and `--to "specs/a'b.mdx"` are well-formed
//   spellings (11.3: acceptance is syntactic — 1.4's segment rules judge
//   the id part alone, so the `'` in the path part is well-formed), so
//   each is accepted — exit 1 with the empty selection and the domain's
//   findings, never exit 2 (T11.3-3).

// One spec group plus one code group (SPEC 7.2), so `src/**/*.ts` files are
// discovered code sources and their spec-module usage is analyzed (4.3, 4.5).
export const SPEC_AND_CODE_CONFIG = `import { defineConfig } from "xspec"

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
export const OK_FILE = "specs/OK.mdx";
const OK = new ByteFixture();
OK.add("Préambule — valid-path contrast.\n\n");
const OK_SEC_START = OK.pos;
OK.add("<S ");
const OK_ID = OK.attr("id", 'id="ok"');
OK.add(">\nOK text.\n</S>");
const OK_SEC_RANGE: SourceRange = { start: OK_SEC_START, end: OK.pos };
OK.add("\n");
export const OK_SOURCE = OK.source;
// T11.3-1 restages the file after its first product invocation (S-9's
// before-any-product clause): a record made from the string the pins use.
export const OK_STAGED = stagedMdx(
  "T11.2-3/T11.3-1 specs/OK.mdx (the valid-path contrast)",
  OK_SOURCE,
);
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
export const CS_FILE = "src/co#de.ts";
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
export const CS_SOURCE = CS.source;

// The invalid-path code source's complete occurrence enumeration (SPEC 5.7,
// 11.2): both spellings resolve (the referenced identity `specs/OK.mdx#ok`
// is defined), so both record — `file`, `range`, `kind`, and `target`
// present, `source` exactly the unavailability marker (identity and range
// withheld together as one datum; never a picked identity, never a dropped
// record). No other staged file holds a reference spelling, so this is the
// workspace's whole enumeration, in occurrence order (range start).
export const CS_EXPECTED_OCCURRENCES: readonly OccurrenceRecord[] = [
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
 * The asserted projection of a finding (module-header note): the stable
 * code token; every location — its file and exact byte range, `[]` for a
 * path-level condition such as 14.19 — and the concerned path, `null` for
 * a located condition (SPEC 14, 12.7). Message and identities stay
 * unpinned.
 */
interface FindingProjection {
  readonly code: string | null;
  readonly locations: readonly FindingLocation[];
  readonly path: PathValue | null;
}

function projectFinding(finding: Finding): FindingProjection {
  return {
    code: finding.code,
    locations: finding.locations,
    path: finding.path,
  };
}

const HP_19: FindingProjection = {
  code: "invalid-source-path",
  locations: [],
  path: HP_FILE,
};
const NU_19: FindingProjection = {
  code: "invalid-source-path",
  locations: [],
  path: NU_MARKED_PATH,
};
const CS_19: FindingProjection = {
  code: "invalid-source-path",
  locations: [],
  path: CS_FILE,
};

// Pinned 12.7 order among equal-code, location-less findings: by concerned
// path bytes — "specs/a#b.mdx" < "specs/b\xFF.mdx" (a marked byte-form path
// and a plain string sort in one byte order) < "src/co#de.ts".
const WORKSPACE_19S: readonly FindingProjection[] = NON_UTF8_STAGED
  ? [HP_19, NU_19, CS_19]
  : [HP_19, CS_19];
const VIEW_DOMAIN_19S: readonly FindingProjection[] = NON_UTF8_STAGED
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

// --- the target side: specs/a'b.mdx imported by both kinds of source --------
// Staged after the body's first product invocation (the section comment):
// every initial file of its workspace is a staged-source record (S-9).

const TARGET_SIDE_CONFIG = stagedTs(
  "T11.2-3 target-side workspace xspec.config.ts — one spec group and one code group (SPEC_AND_CODE_CONFIG)",
  SPEC_AND_CODE_CONFIG,
);

// specs/a'b.mdx: `'` in a spec-group path (7.1's bar, 14.19) — the file's
// only defect; its content is condition-free.
const QUOTE_FILE = "specs/a'b.mdx";
const QUOTE_STAGED = stagedMdx(
  "T11.2-3 target-side specs/a'b.mdx (the invalid-path target behind 7.1's bar, holding section x)",
  "Prélude — the target behind 7.1's bar.\n\n" + '<S id="x">\nX text.\n</S>\n',
);

// specs/A.mdx: the spec-source importer. Its import declaration opens the
// file (its range the declaration's own characters, no terminator); the
// multi-byte prose after it shifts every later offset (SPEC 1.7). The two
// `d` values' expressions and the embedding's braced container are the
// spans their occurrences would occupy — exactly their findings' ranges.
const IMPORTER_FILE = "specs/A.mdx";
const IMPORTER = new ByteFixture();
const IMPORTER_IMPORT_TEXT = `import B from "./a'b.xspec"`;
const IMPORTER_IMPORT_RANGE = IMPORTER.add(IMPORTER_IMPORT_TEXT);
IMPORTER.add('\n\nPréambule — imports the invalid-path file.\n\n<S id="p" d={');
const IMPORTER_DEP_X_RANGE = IMPORTER.add("B.x");
IMPORTER.add('}>\nP text.\n</S>\n\n<S id="q" d={');
const IMPORTER_DEP_ROOT_RANGE = IMPORTER.add("B");
IMPORTER.add("}>\nQ text ");
const IMPORTER_EMBED_TEXT = "{text(B.x)}";
const IMPORTER_EMBED_RANGE = IMPORTER.add(IMPORTER_EMBED_TEXT);
IMPORTER.add(" here.\n</S>\n");
const IMPORTER_SOURCE = IMPORTER.source;
const IMPORTER_STAGED = stagedMdx(
  "T11.2-3 target-side specs/A.mdx (imports specs/a'b.mdx; d={B.x}, d={B}, {text(B.x)})",
  IMPORTER_SOURCE,
);

// The import's view entry (SPEC 11.4, 12.7 member order): the target is
// the discovered spec source the specifier designates — a path, never an
// identity (the target root's identity is undefined; its path is not).
const IMPORTER_IMPORT: ViewImportEntry = {
  range: IMPORTER_IMPORT_RANGE,
  name: "B",
  target: QUOTE_FILE,
};

// src/use.ts: the code-source importer — the `text(B.x)` call inside the
// named function `useText` (its would-be occurrence the whole call
// expression, callee through closing parenthesis) and the bare top-level
// marker `B.x` (the chain alone, its terminator excluded). The multi-byte
// comment prefix shifts every later offset (SPEC 1.7).
const USER_FILE = "src/use.ts";
const USER = new ByteFixture();
USER.add("// Präambel — imports the invalid-path file.\n");
USER.add(`import B, { text } from "../specs/a'b.xspec";\n`);
USER.add("\nexport function useText(): string {\n  return ");
const USER_CALL_TEXT = "text(B.x)";
const USER_CALL_RANGE = USER.add(USER_CALL_TEXT);
USER.add(";\n}\n\n");
const USER_MARKER_TEXT = "B.x";
const USER_MARKER_RANGE = USER.add(USER_MARKER_TEXT);
USER.add(";\n");
const USER_SOURCE = USER.source;
const USER_STAGED = stagedTs(
  "T11.2-3 target-side src/use.ts (imports specs/a'b.xspec; the call text(B.x) and the marker B.x)",
  USER_SOURCE,
);

/** One located finding's projection: a single location, no concerned path. */
function locatedAt(
  code: string,
  file: string,
  range: SourceRange,
): FindingProjection {
  return { code, locations: [{ file, range }], path: null };
}

// The target side's whole finding set in 12.7's pinned order — by code
// (conditions 5, 6, 7, 19), then by locations (file path bytes, range
// start): the five unresolved spellings at their exact spans, then the
// target's path-level 14.19 concerning specs/a'b.mdx. No 14.15: both
// imports are valid (2.1, 4).
const TARGET_SIDE_FINDINGS: readonly FindingProjection[] = [
  locatedAt("unknown-dependency", IMPORTER_FILE, IMPORTER_DEP_X_RANGE),
  locatedAt("unknown-dependency", IMPORTER_FILE, IMPORTER_DEP_ROOT_RANGE),
  locatedAt("unknown-text-target", IMPORTER_FILE, IMPORTER_EMBED_RANGE),
  locatedAt("unknown-ts-reference", USER_FILE, USER_CALL_RANGE),
  locatedAt("unknown-ts-reference", USER_FILE, USER_MARKER_RANGE),
  { code: "invalid-source-path", locations: [], path: QUOTE_FILE },
];
const TARGET_SIDE_CONDITION_COUNTS: Readonly<Record<string, number>> = {
  "14.5": 2,
  "14.6": 1,
  "14.7": 2,
  "14.19": 1,
};
// `view specs/A.mdx`'s consulted domain is the named file: its own three
// findings — never the code source's 14.7s or the target's 14.19 (11.2).
const IMPORTER_DOMAIN_FINDINGS: readonly FindingProjection[] =
  TARGET_SIDE_FINDINGS.slice(0, 3);

// The two `--to` spellings naming the invalid-path file's section `x` and
// its root: well-formed (11.3), so accepted, each selecting nothing.
const TARGET_SIDE_TO_SPELLINGS: readonly string[] = [
  `${QUOTE_FILE}#x`,
  QUOTE_FILE,
];

/**
 * T11.2-3's target side (the section comment): on its own workspace,
 * `build --json` and `check --json` (inside one whole-root compare: neither
 * writes), `view specs/A.mdx`, bare `occurrences`, and `occurrences --to`
 * with each spelling of {@link TARGET_SIDE_TO_SPELLINGS} — every finding
 * set and enumeration pinned exactly.
 */
async function runTargetSideArm(product: ProductBinding): Promise<void> {
  const workspace = await TestWorkspace.create({
    files: {
      "xspec.config.ts": TARGET_SIDE_CONFIG,
      [QUOTE_FILE]: QUOTE_STAGED,
      [IMPORTER_FILE]: IMPORTER_STAGED,
      [USER_FILE]: USER_STAGED,
    },
  });
  try {
    // --- `build` and `check`: the five unresolved spellings' findings
    // beside the target's 14.19, nothing else (no 14.15: both imports are
    // valid), exit 1 — the workspace never built, so `check` reports
    // `build`'s findings exactly.
    const gateContext =
      "T11.2-3 target side `build --json` and `check --json` (specs/a'b.mdx " +
      "behind 7.1's bar, imported by specs/A.mdx and src/use.ts)";
    await assertLeavesUnchanged(
      workspace.root,
      async () => {
        for (const command of ["build", "check"] as const) {
          const context = `T11.2-3 target side \`${command} --json\``;
          const findings = await runFindingsReport(
            product,
            workspace,
            [command, "--json"],
            1,
            `${context} — the unresolved spellings' findings and the ` +
              `target's condition 19 are findings: exit 1 (SPEC 12.0, ` +
              `12.1, 12.2)`,
          );
          assertConditionCounts(
            findings,
            TARGET_SIDE_CONDITION_COUNTS,
            `${context} — 14.5 for each \`d\` reference (d={B.x}, d={B}), ` +
              `14.6 for the embedding, 14.7 for the call and for the ` +
              `marker, beside specs/a'b.mdx's 14.19, and nothing else: no ` +
              `spelling resolves into the invalid-path file — no section ` +
              `or root identity is defined over it (SPEC 11.2, 1.5) — ` +
              `while both imports are valid, their target discovered (2.1, ` +
              `4: no 14.15)`,
          );
          assertSameJson(
            findings.map(projectFinding),
            TARGET_SIDE_FINDINGS,
            `${context} — each unresolved spelling located exactly at the ` +
              `span its occurrence would occupy (the d value's expression, ` +
              `the full braced container, the call callee through closing ` +
              `parenthesis, the bare chain without its terminator) and the ` +
              `14.19 concerning specs/a'b.mdx with no locations, in 12.7's ` +
              `order (SPEC 14, 12.7)`,
          );
        }
      },
      `${gateContext} — a failing build modifies nothing (SPEC 12.1) and ` +
        `\`check\` writes nothing (SPEC 12.2)`,
    );

    // --- `view specs/A.mdx`: the import listed with its target a path,
    // never an identity; no occurrence; the named file's findings alone.
    const viewContext = `T11.2-3 target side \`view ${IMPORTER_FILE}\``;
    const viewResult = await runCli(product, workspace, [
      "view",
      IMPORTER_FILE,
    ]);
    assertExitCode(
      viewResult,
      1,
      `${viewContext} — the file's unresolved spellings' findings accompany ` +
        `the answer, so exit 1 with the full document (SPEC 11.2)`,
    );
    const viewReport = decodeViewReport(
      parseJsonStdout(
        viewResult,
        `${viewContext} — a single JSON document is the only output form ` +
          `(SPEC 11)`,
      ),
      { text: false },
      viewContext,
    );
    assertSameJson(
      viewReport.findings.map(projectFinding),
      IMPORTER_DOMAIN_FINDINGS,
      `${viewContext} — the consulted domain is the named file: its two ` +
        `14.5s and its 14.6, never the code source's 14.7s or ` +
        `specs/a'b.mdx's 14.19, which concern no domain file (SPEC 11.2, ` +
        `11.4)`,
    );
    assertSameJson(
      viewReport.views.map((view) => view.file),
      [IMPORTER_FILE],
      `${viewContext} — exactly the requested file's view (SPEC 11.4)`,
    );
    const importerView = viewReport.views[0]!;
    assertSameJson(
      importerView.imports,
      [IMPORTER_IMPORT],
      `${viewContext} — the import listed with its range, its binding name ` +
        `B, and its target specs/a'b.mdx: the discovered spec source its ` +
        `specifier designates, a path and never an identity — the ` +
        `target root's identity is undefined over the invalid path, the ` +
        `path itself is not, so never the unavailability marker (SPEC ` +
        `11.4, 2.1, 11.2; T11.4-4)`,
    );
    assertSameJson(
      importerView.occurrences,
      [],
      `${viewContext} — no occurrence for d={B.x}, d={B}, or ` +
        `{text(B.x)}: none resolves into the invalid-path file, so none ` +
        `records (SPEC 11.2, 1.5, 5.7)`,
    );

    // --- Bare `occurrences`: the entire discovered set's enumeration —
    // none for the five spellings, every one of their findings
    // accompanying.
    const occContext = "T11.2-3 target side bare `occurrences`";
    const occResult = await runCli(product, workspace, ["occurrences"]);
    assertExitCode(
      occResult,
      1,
      `${occContext} — the domain's findings accompany the answer, so ` +
        `exit 1 with the full answer (SPEC 11.2, 11.3)`,
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
      occReport.findings.map(projectFinding),
      TARGET_SIDE_FINDINGS,
      `${occContext} — the consulted domain is the entire discovered set: ` +
        `every one of the five spellings' findings and specs/a'b.mdx's ` +
        `14.19 accompany (SPEC 11.2, 11.3)`,
    );
    assertSameJson(
      occReport.occurrences,
      [],
      `${occContext} — no record for any of the five spellings, so no ` +
        `record of any file carries a target over the invalid path — ` +
        `never specs/a'b.mdx#x, never specs/a'b.mdx: no identity is ` +
        `resolved against over an invalid path (SPEC 11.2, 1.5, 5.7)`,
    );

    // --- `occurrences --to` with each spelling naming the invalid-path
    // file's section and root: accepted (well-formed, 11.3), selecting
    // nothing, the domain's findings accompanying, exit 1 — never exit 2.
    for (const spelling of TARGET_SIDE_TO_SPELLINGS) {
      const toContext = `T11.2-3 target side \`occurrences --to "${spelling}"\``;
      const toResult = await runCli(product, workspace, [
        "occurrences",
        "--to",
        spelling,
      ]);
      assertExitCode(
        toResult,
        1,
        `${toContext} — a well-formed spelling is accepted whatever the ` +
          `workspace holds (acceptance is syntactic: never exit 2), and the ` +
          `domain's findings make the answer exit 1 (SPEC 11.3, 11.2; ` +
          `T11.3-3)`,
      );
      const toReport = decodeOccurrencesReport(
        parseJsonStdout(
          toResult,
          `${toContext} — a single JSON document is the only output form ` +
            `(SPEC 11)`,
        ),
        toContext,
      );
      assertSameJson(
        toReport.findings.map(projectFinding),
        TARGET_SIDE_FINDINGS,
        `${toContext} — the consulted domain is the entire discovered set ` +
          `(no --file): all six findings accompany (SPEC 11.2, 11.3)`,
      );
      assertSameJson(
        toReport.occurrences,
        [],
        `${toContext} — the selection is empty: the named identity does ` +
          `not resolve, its file's path invalid (SPEC 11.3, 14.19)`,
      );
    }
  } finally {
    await workspace.dispose();
  }
}

const T11_2_3 = defineProductTest({
  id: "T11.2-3",
  title:
    "(Linux leg) invalid paths: the discovered spec sources `specs/a#b.mdx` and — staged where file names are byte strings — a non-UTF-8-named `specs/b<0xFF>.mdx` keep full views (tree, byte-exact construct ranges, raw attribute entries) with every node identity, root included, explicitly unavailable, while `specs/OK.mdx` beside them keeps defined identities — root identity defined exactly when the file's path is valid; the condition-19 finding (stable code `invalid-source-path`, no locations, the file as concerned path — the non-UTF-8 path in the marked byte form `{\"bytes\": …}`) accompanies every answer whose consulted domain includes the file and no other: bare `view` carries exactly the spec paths' findings (never the code source's), bare `occurrences` every 14.19, `at specs/a#b.mdx` exactly its own; the code source `src/co#de.ts` defines no identity for its whole-file location or any unit, its `text(SPEC.ok)` call and bare marker still recording occurrences with `source` exactly the unavailability marker and `file`, `range`, `kind`, `target` present; no identity over an invalid path is ever emitted (every identity datum in every captured document pinned); the gate `build --json` fails with exactly the staged 14.19 multiset, modifying nothing; target side — no identity is resolved against over an invalid path: `specs/a'b.mdx` (7.1's bar, its 14.19) holding section `x` is imported validly (no 14.15) by `specs/A.mdx` as `import B from \"./a'b.xspec\"` and by the code source `src/use.ts` as `import B, { text } from \"../specs/a'b.xspec\"`, `view specs/A.mdx` listing the import with target `specs/a'b.mdx` — a path, never an identity; `specs/A.mdx`'s `d={B.x}`, `d={B}`, and `{text(B.x)}` and the code source's marker `B.x` and call `text(B.x)` resolve to nothing: `build` and `check` report exactly 14.5 twice, 14.6, and 14.7 twice, each at its spelling's exact span, beside the 14.19, exit 1, modifying nothing; no edge and no occurrence — `specs/A.mdx`'s view and bare `occurrences` list none (`occurrences` with all six findings), so no record carries a target over the invalid path — and `occurrences --to \"specs/a'b.mdx#x\"` and `--to \"specs/a'b.mdx\"` are accepted, each selecting nothing with the domain's findings, exit 1, never exit 2 (SPEC 11.2, 11.3-11.5, 12.0, 12.1, 12.2, 12.7, 5.7, 1.5, 2.1, 4, 7.1, 14)",
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
    sliceCheck(
      IMPORTER_SOURCE,
      IMPORTER_IMPORT_RANGE,
      IMPORTER_IMPORT_TEXT,
      "the target side's import declaration (its own characters)",
    );
    sliceCheck(
      IMPORTER_SOURCE,
      IMPORTER_DEP_X_RANGE,
      "B.x",
      "the target side's d={B.x} expression",
    );
    sliceCheck(
      IMPORTER_SOURCE,
      IMPORTER_DEP_ROOT_RANGE,
      "B",
      "the target side's d={B} expression",
    );
    sliceCheck(
      IMPORTER_SOURCE,
      IMPORTER_EMBED_RANGE,
      IMPORTER_EMBED_TEXT,
      "the target side's embedding container",
    );
    sliceCheck(
      USER_SOURCE,
      USER_CALL_RANGE,
      USER_CALL_TEXT,
      "the target side's text(...) call expression",
    );
    sliceCheck(
      USER_SOURCE,
      USER_MARKER_RANGE,
      USER_MARKER_TEXT,
      "the target side's bare marker chain",
    );

    const workspace = await TestWorkspace.create({
      files: {
        "xspec.config.ts": SPEC_AND_CODE_CONFIG,
        [OK_FILE]: OK_STAGED,
        [HP_FILE]: HP_SOURCE,
        [CS_FILE]: CS_SOURCE,
      },
    });
    try {
      // This staging precedes the body's first product invocation (the gate
      // `build` below), so S-7's sweep reaches it against the stub: plain
      // contents, no ledger record (helpers/staged-mdx.ts).
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
            findings.map(projectFinding),
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
        viewReport.findings.map(projectFinding),
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
        occReport.findings.map(projectFinding),
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
          atReport.findings.map(projectFinding),
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

    // --- The target side, on its own workspace (the section comment).
    await runTargetSideArm(product);
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
// value (partial expansion is fabrication and never occurs) — and own and
// subtree text are judged apart: own text consults the embeddings of the
// node's own contribution, subtree text those anywhere in its subtree, each
// recursively through every embedded target's subtree, so an embedding
// failing beneath a node poisons its subtree text alone. Removal
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
//   spelling and the own-versus-subtree arm's `{text("missing")}`, where
//   SPEC 14 pins the finding range exactly (the full braced container, the
//   span its occurrence would occupy), asserted exactly there — as is the
//   own-versus-subtree arm's ancestor cycle (14.9), located at its one
//   participating reference spelling, the braced container `{text("p")}`
//   (the `contains` edge closing the cycle spells nothing; SPEC 5.3, 14,
//   T14-8) — each of those three findings form-exact: code, locations, and
//   concerned path. Every other located finding is asserted as an exact
//   location COUNT (one per offending construct — SPEC 14's cardinality
//   rule: both bearers for the duplicate-ID finding) with each range inside
//   the offending construct's byte window (end-widened by one byte): the
//   ambiguous `d` reference's finding inside the opening tag that spells
//   the reference, the self-embedding cycle's inside its participating
//   embedding container's line, 14.1/14.15/14.16 inside their constructs —
//   file and construct discrimination without pinning T14-8's range
//   precision.
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
// - The own-versus-subtree arm stages its two embeddings — the unresolved
//   `{text("missing")}` and, staged separately, the ancestor-embedding
//   `{text("p")}` — in the same `p`/`p.c` shape, one workspace each (the
//   file `specs/P.mdx` in both), and pins the whole `--text` projection of
//   each: p's own text byte-exact (p.c's contribution excised, 1.6) beside
//   its subtree text exactly the marker, p.c's own and subtree text the
//   marker, and the root's own text byte-exact beside its poisoned subtree
//   text — so a product marking both of a node's values unavailable
//   whenever an embedding anywhere beneath it fails is caught at p's (and
//   the root's) own text — together with the view's occurrence list (the
//   unresolved spelling records none; the ancestor embedding records its
//   `embeds` occurrence p.c → p, cycle participation erasing no record).
// - "Never an unavailable target" is enforced twice: the form decode admits
//   only a plain identity string as a record's `target` (12.7), and every
//   enumeration is pinned as a complete exact set (a phantom record for the
//   ambiguous spelling fails the compare — "never a dropped record" rides
//   the same exactness for the two resolving spellings).
// - The enclosure arm stages the entry's construct in two spellings, one
//   workspace each — the entry's own one-line spelling (a paragraph holding
//   text-position tags under the stock grammar) and the flow-tag spelling
//   with `<div>` and `</div>` each alone on its line — since 11.2's rule
//   ("an element by its own tags") is spelling-blind while the two derive
//   as different MDX node kinds; each pins the 14.16 finding's range
//   EXACTLY (`<div>`'s first byte through `</div>`'s last byte, the line
//   terminator after `</div>` excluded — the one range the entry fixes),
//   the text values as hand-derived literals, and the occurrence's `source`
//   as the root's identity with its whole-file range (SPEC 1.5, 1.7).

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

export const R_FILE = "specs/R.mdx";
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
export const R_SOURCE = R.source;
// T11.3-1 restages the file after its first product invocation (S-9's
// before-any-product clause): a record made from the string the pins use.
export const R_STAGED = stagedMdx(
  "T11.2-4/T11.3-1 specs/R.mdx (the resolution matrix)",
  R_SOURCE,
);
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
export const R_EXPECTED_OCCURRENCES: readonly OccurrenceRecord[] = [
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
export const R_CONDITION_COUNTS: Readonly<Record<string, number>> = {
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
// The chain workspace follows the resolution matrix's invocations (S-9's
// before-any-product clause): records made from the strings the pins use.
const CH_A_STAGED = stagedMdx(
  "T11.2-4 specs/CH-A.mdx (the embedding chain)",
  CH_A_SOURCE,
);
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
const CH_B_STAGED = stagedMdx(
  "T11.2-4 specs/CH-B.mdx (the embedding chain)",
  CH_B_SOURCE,
);
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
const CH_C_STAGED = stagedMdx(
  "T11.2-4 specs/CH-C.mdx (the embedding chain)",
  CH_C_SOURCE,
);
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
// A later workspace of the body (S-9's before-any-product clause).
const CY_STAGED = stagedMdx(
  "T11.2-4 specs/CY.mdx (the self-embedding cycle)",
  CY_SOURCE,
);
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

// --- staging 4: own text and subtree text judged apart (two stagings) ---------
//
// SPEC 11.2 (expanded text): own text consults the embeddings of the node's
// own contribution, subtree text those anywhere in its subtree, each
// recursively through every embedded target's subtree. The top-level `p`,
// whose own contribution holds no embedding, parents `p.c`, which holds the
// one embedding: (a) the unresolved `{text("missing")}` — no occurrence, one
// 14.6 located at its braced container — and, staged separately, (b)
// `{text("p")}`, resolving to p.c's own ancestor, so that expanding p's
// subtree re-enters p: an embedding cycle over p → p.c (contains) and
// p.c → p (embeds) — SPEC 5.3's section embedding its own ancestor — whose
// spelling records its `embeds` occurrence beside the cycle's one 14.9,
// located at its one participating reference spelling, the braced container
// (the `contains` edge spells nothing; SPEC 14). Either way p's own text
// stays a plain value beside its poisoned subtree text, p.c's own and
// subtree text are both poisoned (the embedding lies in its own
// contribution), and the root — no embedding in its own contribution either
// — keeps its own text beside its poisoned subtree text. Every id is unique
// and well-formed (`p.c` extends its parent's spelling by one segment), so
// the embedding's condition is each workspace's ONLY condition. The
// multi-byte title shifts every later offset (SPEC 1.7).
//
// Text derivation (SPEC 3, 1.6), shared by both stagings: every `<S>` and
// `</S>` line holds nothing but removed tags and drops with its terminator —
// p.c's `</S>` line taking p's line terminator after it along — while blank
// lines stay. p's own runs: `P head.` LF and the blank line before p.c, then
// — p.c's whole contribution excised — the blank line after p.c and
// `P tail.` LF. The root's own run: the title line and the blank line after
// it, the final `</S>` line dropping.

const OWN_FILE = "specs/P.mdx";
const OWN_P_HEAD = '<S id="p">\nP head.\n\n';
const OWN_PC_HEAD = '<S id="p.c">\nC body.\n\n';
const OWN_P_TAIL = "\n\nP tail.\n</S>";
// The two values defined in both stagings, pinned literals (derived above):
const OWN_ROOT_OWN = "Prélude — own text and subtree text judged apart.\n\n";
const OWN_P_OWN = "P head.\n\n\nP tail.\n";

/** One own-versus-subtree staging: its bytes, composed ranges, and pins. */
interface OwnSubtreeStaging {
  readonly label: string;
  readonly source: string;
  /** The staged bytes as a ledger record (S-9's before-any-product clause). */
  readonly staged: StagedMdx;
  /** p.c's one embedding container as staged, and its range. */
  readonly embedText: string;
  readonly embedRange: SourceRange;
  readonly pText: string;
  readonly pRange: SourceRange;
  readonly pcText: string;
  readonly pcRange: SourceRange;
  readonly rootRange: SourceRange;
  /** The workspace's one staged condition, and its finding form-exact. */
  readonly condition: string;
  readonly finding: FindingProjection;
  /** What the finding's one location is, for the diagnostic. */
  readonly findingWhat: string;
  readonly textTree: TextTreeExpectation;
  readonly occurrences: readonly OccurrenceRecord[];
  /** What the view's occurrence list holds, for the diagnostic. */
  readonly occurrencesWhat: string;
}

/**
 * Compose one staging around p.c's embedding `embedText`: its one finding
 * (`condition`, stable `code`) located at the braced container, and the
 * identity it resolves to — `target`, or `null` for an unresolved spelling,
 * which records no occurrence. Every range is composed from the same parts
 * that stage the file; the text values are the pinned literals above.
 */
function stageOwnSubtree(
  label: string,
  embedText: string,
  expected: {
    readonly condition: string;
    readonly code: string;
    readonly findingWhat: string;
    readonly target: string | null;
    readonly occurrencesWhat: string;
  },
): OwnSubtreeStaging {
  const f = new ByteFixture();
  f.add("Prélude — own text and subtree text judged apart.\n\n");
  const pStart = f.pos;
  f.add(OWN_P_HEAD);
  const pcStart = f.pos;
  f.add(OWN_PC_HEAD);
  const embedRange = f.add(embedText);
  f.add("\n</S>");
  const pcRange: SourceRange = { start: pcStart, end: f.pos };
  f.add(OWN_P_TAIL);
  const pRange: SourceRange = { start: pStart, end: f.pos };
  f.add("\n");
  const rootRange: SourceRange = { start: 0, end: f.pos };
  const pcText = OWN_PC_HEAD + embedText + "\n</S>";
  const target = expected.target;
  return {
    label,
    source: f.source,
    staged: stagedMdx(
      `T11.2-4 specs/P.mdx (own versus subtree: ${label})`,
      f.source,
    ),
    embedText,
    embedRange,
    pText: OWN_P_HEAD + pcText + OWN_P_TAIL,
    pRange,
    pcText,
    pcRange,
    rootRange,
    condition: expected.condition,
    finding: locatedAt(expected.code, OWN_FILE, embedRange),
    findingWhat: expected.findingWhat,
    textTree: {
      identity: OWN_FILE,
      range: rootRange,
      ownText: OWN_ROOT_OWN,
      subtreeText: UNAVAILABLE,
      children: [
        {
          identity: `${OWN_FILE}#p`,
          range: pRange,
          ownText: OWN_P_OWN,
          subtreeText: UNAVAILABLE,
          children: [
            {
              identity: `${OWN_FILE}#p.c`,
              range: pcRange,
              ownText: UNAVAILABLE,
              subtreeText: UNAVAILABLE,
              children: [],
            },
          ],
        },
      ],
    },
    occurrences:
      target === null
        ? []
        : [
            {
              file: OWN_FILE,
              range: embedRange,
              kind: "embeds",
              source: { identity: `${OWN_FILE}#p.c`, range: pcRange },
              target,
            },
          ],
    occurrencesWhat: expected.occurrencesWhat,
  };
}

// (a) p.c holds the unresolved `{text("missing")}`.
const OWN_A = stageOwnSubtree("the unresolved embedding", '{text("missing")}', {
  condition: "14.6",
  code: "unknown-text-target",
  findingWhat:
    "EXACTLY the braced container, the span its occurrence would occupy",
  target: null,
  occurrencesWhat:
    "none: the unresolved spelling records no occurrence, its position " +
    "reaching consumers through its finding's range",
});
// (b) p.c holds `{text("p")}`, embedding its own ancestor.
const OWN_B = stageOwnSubtree("the ancestor embedding cycle", '{text("p")}', {
  condition: "14.9",
  code: "cycle",
  findingWhat:
    "EXACTLY the braced container, the cycle's one participating " +
    "reference spelling (its contains edge p → p.c spells nothing)",
  target: `${OWN_FILE}#p`,
  occurrencesWhat:
    "exactly the ancestor embedding's one embeds record, p.c to p — the " +
    "spelling resolves, and cycle participation erases no record",
});
const OWN_STAGINGS: readonly OwnSubtreeStaging[] = [OWN_A, OWN_B];

// --- staging 5: removal classification is by syntactic form -------------------
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
// A later workspace of the body (S-9's before-any-product clause).
const IMP_STAGED = stagedMdx(
  "T11.2-4 specs/IMP.mdx (the importer of GONE.mdx)",
  IMP_SOURCE,
);
const IMP_ROOT_RANGE: SourceRange = { start: 0, end: IMP.pos };

const GONE_FIX = new ByteFixture();
GONE_FIX.add("Œuvre — deletable import target.\n\n");
const GONE_G_START = GONE_FIX.pos;
GONE_FIX.add('<S id="g">\nGone text.\n</S>');
const GONE_G_RANGE: SourceRange = { start: GONE_G_START, end: GONE_FIX.pos };
GONE_FIX.add("\n");
const GONE_SOURCE = GONE_FIX.source;
const GONE_STAGED = stagedMdx(
  "T11.2-4 specs/GONE.mdx (the imported file, deleted mid-arm)",
  GONE_SOURCE,
);
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

// --- staging 6: enclosure — a stray element enclosing a section and an
// embedding at the root level ---------------------------------------------------
//
// SPEC 11.2 (removal classification by form): a stray element (14.16) is
// content, preserved by its own tags, and the sections and embeddings it
// encloses are classified by their own forms — the enclosed section a node
// of the positional tree parented to the innermost enclosing SECTION
// construct, the root when none encloses it (SPEC 11.4, T11.4-1), and the
// enclosed embedding a resolving spelling of the root's own contribution:
// its occurrence records the root as its source graph node (5.7). The same
// construct is staged in two spellings, one workspace each — (a) the
// entry's own one-line spelling `<div><S id="x">t</S>{text("y")}</div>`
// (under the stock grammar a paragraph holding text-position tags: a flow
// JSX attempt fails at the `t` after `<S id="x">`), and (b) the flow-tag
// spelling with `<div>` and `</div>` each alone on its line — both deriving
// (S-9's default declaration; the builder judges them at staging). `y`
// precedes the element, so the expansion reads a closed same-file target.
//
// Text derivation (SPEC 3, 1.6), shared by both spellings: lines 1 and 3
// hold nothing but y's removed tags and drop with their terminators; line 2
// (`Y text.` LF) is kept and is y's whole contribution; `<div>` and `</div>`
// match no removal rule's form and stay as content; x's tags are removed
// and its `t` stays in place; `{text("y")}` is replaced by y's subtree text
// `Y text.` LF — an expansion belonging to the root's own run. The root's
// subtree text is the whole output; its own text is that output with y's
// and x's contributions excised.

const ENCL_FILE = "specs/ENCL.mdx";
const ENCL_Y_TEXT = "Y text.\n";
const ENCL_X_TEXT = "t";
const ENCL_Y_CONSTRUCT = '<S id="y">\n' + ENCL_Y_TEXT + "</S>";
const ENCL_X_CONSTRUCT = '<S id="x">' + ENCL_X_TEXT + "</S>";
const ENCL_EMBED_TEXT = '{text("y")}';

/** One enclosure spelling: its staged bytes, composed ranges, and pins. */
interface EnclosureStaging {
  readonly label: string;
  readonly source: string;
  /** The staged bytes as a ledger record (S-9's before-any-product clause). */
  readonly staged: StagedMdx;
  /** `<div>`'s first byte through `</div>`'s last byte (the 14.16 range). */
  readonly divRange: SourceRange;
  readonly divText: string;
  readonly yRange: SourceRange;
  readonly xRange: SourceRange;
  readonly embedRange: SourceRange;
  readonly rootRange: SourceRange;
  readonly textTree: TextTreeExpectation;
  readonly occurrences: readonly OccurrenceRecord[];
}

/**
 * Compose one spelling: `afterOpen` follows `<div>` and `beforeClose`
 * precedes `</div>` ("" for the one-line spelling, LF for the flow-tag
 * spelling). Every range is composed from the same parts that stage the
 * file; the expected root text values are pinned literals, hand-derived
 * per spelling (below) — never computed from the staging.
 */
function stageEnclosure(
  label: string,
  afterOpen: string,
  beforeClose: string,
  rootOwn: string,
  rootSubtree: string,
): EnclosureStaging {
  const f = new ByteFixture();
  const yRange = f.add(ENCL_Y_CONSTRUCT);
  f.add("\n");
  const divStart = f.pos;
  f.add("<div>" + afterOpen);
  const xRange = f.add(ENCL_X_CONSTRUCT);
  const embedRange = f.add(ENCL_EMBED_TEXT);
  f.add(beforeClose + "</div>");
  const divRange: SourceRange = { start: divStart, end: f.pos };
  f.add("\n");
  const rootRange: SourceRange = { start: 0, end: f.pos };
  return {
    label,
    source: f.source,
    staged: stagedMdx(`T11.2-4 specs/ENCL.mdx (${label})`, f.source),
    divRange,
    divText:
      "<div>" +
      afterOpen +
      ENCL_X_CONSTRUCT +
      ENCL_EMBED_TEXT +
      beforeClose +
      "</div>",
    yRange,
    xRange,
    embedRange,
    rootRange,
    textTree: {
      identity: ENCL_FILE,
      range: rootRange,
      ownText: rootOwn,
      subtreeText: rootSubtree,
      children: [
        {
          identity: `${ENCL_FILE}#y`,
          range: yRange,
          ownText: ENCL_Y_TEXT,
          subtreeText: ENCL_Y_TEXT,
          children: [],
        },
        {
          identity: `${ENCL_FILE}#x`,
          range: xRange,
          ownText: ENCL_X_TEXT,
          subtreeText: ENCL_X_TEXT,
          children: [],
        },
      ],
    },
    occurrences: [
      {
        file: ENCL_FILE,
        range: embedRange,
        kind: "embeds",
        // The root as the source graph node: its identity the path alone
        // (SPEC 1.5) together with its own range, the entire file (1.7).
        source: { identity: ENCL_FILE, range: rootRange },
        target: `${ENCL_FILE}#y`,
      },
    ],
  };
}

// (a) the entry's spelling, one line at the root level:
//   root own      `<div>` `Y text.` LF `</div>` LF
//   root subtree  `Y text.` LF `<div>t` `Y text.` LF `</div>` LF
const ENCL_A = stageEnclosure(
  "the entry's one-line spelling",
  "",
  "",
  "<div>Y text.\n</div>\n",
  "Y text.\n<div>tY text.\n</div>\n",
);
// (b) the flow-tag spelling, `<div>` and `</div>` each alone on its line:
//   root own      `<div>` LF `Y text.` LF LF `</div>` LF
//   root subtree  `Y text.` LF `<div>` LF `t` `Y text.` LF LF `</div>` LF
const ENCL_B = stageEnclosure(
  "the flow-tag spelling",
  "\n",
  "\n",
  "<div>\nY text.\n\n</div>\n",
  "Y text.\n<div>\ntY text.\n\n</div>\n",
);
const ENCL_STAGINGS: readonly EnclosureStaging[] = [ENCL_A, ENCL_B];

const T11_2_4 = defineProductTest({
  id: "T11.2-4",
  title:
    "resolution turns on the referenced identity's own definedness: with duplicate spellings of `a` and the unique `a.b` beneath one bearer, the `d` entry naming `a.b` on the other bearer and the `{text(\"a.b\")}` embedding inside an id-less section each resolve and record occurrences whose `source` is exactly the unavailability marker (`file`, `range`, `kind`, `target` present — never a picked bearer, never a dropped record; observed via bare `occurrences` AND `view`), while the `d` reference to `a` records none — ambiguous, every bearer undefined — reported by its 14.5 finding's range, never as a record or an unavailable target, the view still positioning each enclosing construct with identity unavailable, the file's findings (14.1, 14.3, 14.5) accompanying, exit 1; `view --text`: CH-A embeds CH-B embeds CH-C with an unresolved embedding in CH-C (14.6, its finding's range exactly the braced container) → top's and mid's own/subtree text exactly the unavailability marker — one unresolved spelling, or (staged separately) one self-embedding cycle (14.9), poisons the whole value, partial expansion never occurring — while siblings with resolved expansions stay defined and byte-exact and each root's own text stays defined beside its poisoned subtree text; own text and subtree text are judged apart: a section `p` whose own contribution holds no embedding, its child `p.c` holding the unresolved `{text(\"missing\")}` (14.6) — and, staged separately, `{text(\"p\")}`, so that expanding `p`'s subtree re-enters `p` (an embedding cycle, a section embedding its own ancestor: one 14.9 locating the braced container, the `embeds` occurrence recorded) — under `view --text`: `p`'s own text a plain value byte-equal to its precomputed own text (`p.c`'s contribution excised) and its subtree text exactly the unavailability marker, `p.c`'s own and subtree text the marker, each finding form-exact, exit 1 — failing a product that marks both values unavailable whenever an embedding anywhere beneath the node fails; removal classification is by syntactic form: after deleting the imported (unused-binding) GONE.mdx, IMP.mdx's text values are byte-identical to before — the import removed by form, its 14.15 finding notwithstanding, the import entry's `target` flipping to the marker — and the stray `<div>` (14.16) is content, preserved byte-for-byte in the enclosing text and located by its finding; enclosure: `<div><S id=\"x\">t</S>{text(\"y\")}</div>` staged in flow position at the root level (the entry's one-line spelling and the flow-tag spelling, one workspace each), `y` a section of the same file → exactly one 14.16 finding located `<div>` through `</div>`, node `x` in the view's tree a child of the root (never of the element, T11.4-1), the embedding's occurrence recorded with the root as its `source`, and under `view --text` the root's own text carrying `<div>` and `</div>` with `x`'s whole contribution excised and the embedding expanded to `y`'s subtree text, its subtree text carrying `t` in place with `x`'s tags removed — each byte-asserted via bare `view --text` and bare `occurrences` (SPEC 11.2, 11.3, 11.4, 5.3, 5.7, 1.6, 2.1, 3, 12.7, 14; CERTIFICATIONS.md CONF-AVAIL in scope)",
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
    for (const staging of OWN_STAGINGS) {
      const what = `the own-versus-subtree staging (${staging.label})`;
      sliceCheck(
        staging.source,
        staging.embedRange,
        staging.embedText,
        `${what}: p.c's embedding container`,
      );
      sliceCheck(
        staging.source,
        staging.pcRange,
        staging.pcText,
        `${what}: p.c`,
      );
      sliceCheck(staging.source, staging.pRange, staging.pText, `${what}: p`);
      sliceCheck(
        staging.source,
        staging.rootRange,
        staging.source,
        `${what}: the root's whole-file range`,
      );
    }
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
    for (const staging of ENCL_STAGINGS) {
      const what = `the enclosure staging (${staging.label})`;
      sliceCheck(
        staging.source,
        staging.divRange,
        staging.divText,
        `${what}: the stray element, <div> through </div>`,
      );
      sliceCheck(
        staging.source,
        staging.yRange,
        ENCL_Y_CONSTRUCT,
        `${what}: y`,
      );
      sliceCheck(
        staging.source,
        staging.xRange,
        ENCL_X_CONSTRUCT,
        `${what}: x`,
      );
      sliceCheck(
        staging.source,
        staging.embedRange,
        ENCL_EMBED_TEXT,
        `${what}: the enclosed embedding container`,
      );
      sliceCheck(
        staging.source,
        staging.rootRange,
        staging.source,
        `${what}: the root's whole-file range`,
      );
    }

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
          [R_FILE]: R_STAGED,
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
          [CH_A_FILE]: CH_A_STAGED,
          [CH_B_FILE]: CH_B_STAGED,
          [CH_C_FILE]: CH_C_STAGED,
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
          [CY_FILE]: CY_STAGED,
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

    // --- Staging 4: own text and subtree text judged apart, one workspace
    // per staging (SPEC 11.2: own text consults the embeddings of the
    // node's own contribution, subtree text those anywhere in its subtree).
    for (const staging of OWN_STAGINGS) {
      const workspace = await TestWorkspace.create({
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          [OWN_FILE]: staging.staged,
        },
      });
      try {
        const context = `T11.2-4 bare \`view --text\` (own versus subtree: ${staging.label})`;
        const result = await expectExit(
          product,
          workspace,
          ["view", "--text"],
          1,
          `${context} — the ${staging.condition} finding and the poisoned ` +
            `text values accompany, so exit 1 with the full answer (SPEC ` +
            `11.2)`,
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
          { [staging.condition]: 1 },
          `${context} — p.c's embedding is the workspace's ONLY condition ` +
            `(every id unique and well-formed): exactly one ` +
            `${staging.condition} (SPEC 11.2, 14)`,
        );
        assertSameJson(
          report.findings.map(projectFinding),
          [staging.finding],
          `${context} — the file's one finding, form-exact: its stable code, ` +
            `no concerned path, and its one location ${staging.findingWhat} ` +
            `(SPEC 14, 5.3, 5.7, 12.7)`,
        );
        assertSameJson(
          report.views.map((view) => view.file),
          [OWN_FILE],
          `${context} — one per-file view (SPEC 11.4)`,
        );
        const ownView = report.views[0]!;
        assertSameJson(
          projectTextNode(ownView.root),
          staging.textTree,
          `${context} — own and subtree text judged apart: p's own text a ` +
            `plain value, byte-equal to its precomputed own text with p.c's ` +
            `contribution excised, beside its subtree text EXACTLY the ` +
            `unavailability marker; p.c's own and subtree text the marker ` +
            `(the embedding lies in its own contribution); the root's own ` +
            `text defined beside its poisoned subtree text — never both ` +
            `values marked unavailable for an embedding failing beneath the ` +
            `node (SPEC 11.2, 1.6, 3)`,
        );
        assertSameJson(
          ownView.occurrences,
          staging.occurrences,
          `${context} — the view's occurrence records: ` +
            `${staging.occurrencesWhat} (SPEC 5.7, 11.2)`,
        );
        assertSameJson(
          [ownView.imports, ownView.comments],
          [[], []],
          `${context} — no imports or comments staged (SPEC 12.7)`,
        );
      } finally {
        await workspace.dispose();
      }
    }

    // --- Staging 5: removal classification is by syntactic form.
    {
      const workspace = await TestWorkspace.create({
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          [IMP_FILE]: IMP_STAGED,
          [GONE_FILE]: GONE_STAGED,
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
    // --- Staging 6: enclosure — a stray element enclosing a section and an
    // embedding at the root level, one workspace per spelling (SPEC 11.2:
    // the element is preserved by its own tags, the section and the
    // embedding it encloses classified by their own forms).
    for (const staging of ENCL_STAGINGS) {
      // Shared: exactly the one staged condition, located by the element's
      // own tags (the identical finding must accompany both surfaces).
      const assertEnclosureFindings = (
        findings: readonly Finding[],
        context: string,
      ): void => {
        assertConditionCounts(
          findings,
          { "14.16": 1 },
          `${context} — the stray element is the workspace's ONLY ` +
            `condition: exactly one 14.16 and no phantom condition — the ` +
            `enclosed section and embedding are valid by their own forms ` +
            `(SPEC 11.2, 2.7, 14)`,
        );
        const finding = findingByCondition(findings, "14.16", context);
        assertLocatedFinding(
          finding,
          [{ file: ENCL_FILE, window: staging.divRange }],
          `${context} — the stray element is located by its finding, one ` +
            `location (SPEC 11.2, 14)`,
        );
        assertSameJson(
          finding.locations,
          [{ file: ENCL_FILE, range: staging.divRange }],
          `${context} — the element is located by its own tags: EXACTLY ` +
            `<div>'s first byte through </div>'s last byte, the line ` +
            `terminator after </div> excluded (SPEC 11.2, 14)`,
        );
      };

      const workspace = await TestWorkspace.create({
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          [ENCL_FILE]: staging.staged,
        },
      });
      try {
        const viewContext = `T11.2-4 bare \`view --text\` (enclosure: ${staging.label})`;
        const viewResult = await expectExit(
          product,
          workspace,
          ["view", "--text"],
          1,
          `${viewContext} — the stray element's 14.16 finding accompanies, ` +
            `so exit 1 with the full answer emitted (SPEC 11.2)`,
        );
        const viewReport = decodeViewReport(
          parseJsonStdout(
            viewResult,
            `${viewContext} — a single JSON document is the only output ` +
              `form (SPEC 11)`,
          ),
          { text: true },
          viewContext,
        );
        assertEnclosureFindings(viewReport.findings, viewContext);
        assertSameJson(
          viewReport.views.map((view) => view.file),
          [ENCL_FILE],
          `${viewContext} — one per-file view: the enclosure file (SPEC 11.4)`,
        );
        const enclView = viewReport.views[0]!;
        assertSameJson(
          projectTextNode(enclView.root),
          staging.textTree,
          `${viewContext} — the positional tree and the text values: the ` +
            `root's children in document order y then x — x a child of the ` +
            `ROOT, the innermost enclosing section construct, never of the ` +
            `element, which gets no view node (SPEC 11.4, T11.4-1) — each ` +
            `with its construct range; the root's own text carrying <div> ` +
            `and </div> as content with x's whole contribution excised and ` +
            `the embedding expanded to y's subtree text, its subtree text ` +
            `carrying x's t in place with x's tags removed; y's and x's ` +
            `values byte-exact (SPEC 11.2, 1.6, 3)`,
        );
        assertSameJson(
          enclView.occurrences,
          staging.occurrences,
          `${viewContext} — the enclosed embedding's occurrence: the one ` +
            `record, brace through brace, kind embeds, its source the ROOT ` +
            `— identity the path alone with the whole-file range — and ` +
            `target y (SPEC 5.7, 1.5, 1.7, 11.2)`,
        );
        assertSameJson(
          [enclView.imports, enclView.comments],
          [[], []],
          `${viewContext} — no imports or comments staged: empty arrays, ` +
            `never null (SPEC 12.7)`,
        );

        const occContext = `T11.2-4 bare \`occurrences\` (enclosure: ${staging.label})`;
        const occResult = await expectExit(
          product,
          workspace,
          ["occurrences"],
          1,
          `${occContext} — the same 14.16 finding accompanies the ` +
            `enumeration, so exit 1 with the full answer (SPEC 11.2, 11.3)`,
        );
        const occReport = decodeOccurrencesReport(
          parseJsonStdout(
            occResult,
            `${occContext} — a single JSON document is the only output ` +
              `form (SPEC 11)`,
          ),
          occContext,
        );
        assertEnclosureFindings(occReport.findings, occContext);
        assertSameJson(
          occReport.occurrences,
          staging.occurrences,
          `${occContext} — the workspace's COMPLETE enumeration: exactly ` +
            `the enclosed embedding's record with the root as its source ` +
            `(SPEC 5.7, 11.2, 11.3)`,
        );
      } finally {
        await workspace.dispose();
      }
    }
  },
});

// ---------------------------------------------------------------------------
// T11.2-5 — domain, findings, exits
// ---------------------------------------------------------------------------
//
// SPEC 11.2 "Consulted domain, findings, exits": every answer of 11.3–11.5
// has a consulted domain of files, and the findings of every domain file —
// and those alone — accompany the answer; a condition several files jointly
// violate (a cross-file cycle, 14.9) accompanies the answer WHOLE whenever
// any participating file lies in the domain. Any finding or explicitly-
// unavailable datum → exit 1 with the full answer document still emitted
// (exit 1 signals imperfection and never withholds the answer); a complete,
// finding-free answer → exit 0. The argument checks of 11.3–11.5 precede
// answering: a malformed `--to` or invalid glob, a `<file>` operand outside
// the domain or of the wrong kind, and an out-of-range offset each exit 2,
// whatever findings the workspace or the named files carry (12.0). The
// per-surface spelling matrices stay at their home tests (T11.3-2/3,
// T11.4-2, T11.5-2); this test pins the precedence discipline itself, every
// arm run on the finding-laden workspace.
//
// Conservative operationalizations (noted per H-3/H-4):
// - Workspace 1 is T11.2-1's staging (the entry's own reference: A parseable
//   with findings of both levels, B unparseable, C finding-free) beside a
//   discovered, reference-free code source under a spec+code configuration —
//   the wrong-kind `<file>` operand (11.4) needs a discovered code source,
//   and a valid, reference-free TypeScript file adds no finding, no node,
//   and no occurrence (staging integrity rides the gate reference's exact
//   multiset). T11.2-5 is in no certification scope (CERTIFICATIONS.md
//   lists it under Exclusions), so the gate `build --json` and `at` are
//   free to ride.
// - "A's findings of both levels accompany" is the exact multiset of A's six
//   staged conditions (resolution-level 14.5/14.9; per-file structural
//   14.3/14.4/14.16/14.17), every finding located in A — B's 14.20 excluded
//   by the same exactness: the domain is the requested files, never the
//   workspace.
// - The two-file cycle is D#x --depends--> E#y --depends--> D#x via mutual
//   EXTERNAL `d` references (SPEC 2.2's cross-file form), which forces the
//   mutual imports the external form requires (2.1) — themselves a spec
//   import cycle. The staged condition set is therefore exactly two 14.9
//   findings (SPEC 5.3, 2.1, 14.9), each a condition the two files JOINTLY
//   violate, each locating its full path per SPEC 14's cardinality rule —
//   one location per participating construct, one in each file: the two
//   import declarations; the two reference spellings. "Accompanies whole"
//   is realized as each finding carrying BOTH files' locations — asserted
//   with exactly two locations per finding, each within its participating
//   construct's byte window (the T11.2-4 window discipline: the import
//   declaration; the opening tag spelling the reference) — in the domain
//   [D] and again in the domain [E]; message equality across the two
//   invocations is deliberately not asserted (informational content,
//   SPEC 12.7). The finding-free C staged beside the pair pins the
//   contrapositive: with no participant in the domain, neither cycle
//   finding attaches — findings [], exit 0.
// - "Explicitly-unavailable datum → exit 1" rides the same arms: SPEC 11.2
//   derives every unavailable datum from a condition that is a domain
//   file's finding (or, for 14.19, its concerned path), so no
//   unavailable-datum-without-finding staging exists to build; view A's
//   answer carries both (unavailable identities beside findings), view C's
//   neither.
// - Exit-2 protocol: the three surfaces are JSON-only (SPEC 11), so JSON
//   output is in effect on every invocation and an exit-2 usage error emits
//   the single 12.7 error document as its entire stdout (12.0) — decoded
//   form-exactly ({"error": …} with no findings member beside it) — with
//   the usage message on stderr; `code`/`path` value assertions stay at
//   T12.7-3's home.
// - Every invocation of both workspaces rides one whole-root snapshot
//   compare per workspace (H-4): the never-built workspaces make any write
//   surface in the diff (the no-write CONTRACT clauses stay at their
//   T11.2-1/T11.2-6 homes; the compare is staging hygiene here).

// --- workspace 1's added code source (the wrong-kind operand) ----------------
const WRONG_KIND_CODE_FILE = "src/app.ts";
const WRONG_KIND_CODE_SOURCE = "export function noop(): void {}\n";

/**
 * `view specs/A.mdx`'s accompanying findings: exactly A's six staged
 * conditions — findings of both levels — and never B's 14.20 (SPEC 11.2:
 * the consulted domain is the requested files).
 */
const A_DOMAIN_CONDITION_COUNTS: Readonly<Record<string, number>> = {
  "14.3": 1,
  "14.4": 1,
  "14.5": 1,
  "14.9": 1,
  "14.16": 1,
  "14.17": 1,
};

// --- specs/D.mdx / specs/E.mdx — the two-file cycle pair ---------------------
//
// Each file: one import of the other (the external form's requirement,
// SPEC 2.2, 2.1) and one uniquely identified section whose `d` references
// the other file's section. Everything else is deliberately clean — every
// id spelled, well-formed, structural, and unique; both imports valid as
// declarations (form, target, binding) — so the two cycles are the
// workspace's ONLY conditions. Both `d` spellings RESOLVE (each target's
// identity is defined; cycle participation never undefines an identity,
// SPEC 11.2) and record their `depends` occurrences — positions survive the
// findings, the T11.2-1 clause — pinned here as each view's exact
// enumeration. The multi-byte prefixes (é) shift every later offset
// (SPEC 1.7).

const D_FILE = "specs/D.mdx";
const E_FILE = "specs/E.mdx";

const D = new ByteFixture();
D.add("Début — two-file cycle: participant one.\n\n");
const D_IMPORT_TEXT = 'import E from "./E.xspec"';
const D_IMPORT_RANGE = D.add(D_IMPORT_TEXT);
D.add("\n\n");
const D_X_START = D.pos;
D.add("<S ");
const D_X_ID = D.attr("id", 'id="x"');
D.add(" ");
const D_X_D = D.attr("d", "d={E.y}");
D.add(">");
const D_X_OPEN: SourceRange = { start: D_X_START, end: D.pos };
D.add("\nParticipant one text.\n</S>");
const D_X_RANGE: SourceRange = { start: D_X_START, end: D.pos };
D.add("\n");
const D_SOURCE = D.source;
// The cycle-pair workspace follows the body's first invocations (S-9's
// before-any-product clause): records made from the strings the pins use.
const D_STAGED = stagedMdx("T11.2-5 specs/D.mdx (the cycle pair)", D_SOURCE);
const D_ROOT_RANGE: SourceRange = { start: 0, end: D.pos };
const D_X_D_REF = dLiteralRange(D_X_D);

const E = new ByteFixture();
E.add("Étape — two-file cycle: participant two.\n\n");
const E_IMPORT_TEXT = 'import D from "./D.xspec"';
const E_IMPORT_RANGE = E.add(E_IMPORT_TEXT);
E.add("\n\n");
const E_Y_START = E.pos;
E.add("<S ");
const E_Y_ID = E.attr("id", 'id="y"');
E.add(" ");
const E_Y_D = E.attr("d", "d={D.x}");
E.add(">");
const E_Y_OPEN: SourceRange = { start: E_Y_START, end: E.pos };
E.add("\nParticipant two text.\n</S>");
const E_Y_RANGE: SourceRange = { start: E_Y_START, end: E.pos };
E.add("\n");
const E_SOURCE = E.source;
const E_STAGED = stagedMdx("T11.2-5 specs/E.mdx (the cycle pair)", E_SOURCE);
const E_ROOT_RANGE: SourceRange = { start: 0, end: E.pos };
const E_Y_D_REF = dLiteralRange(E_Y_D);

const D_X_NODE_ID = `${D_FILE}#x`;
const E_Y_NODE_ID = `${E_FILE}#y`;

const D_TREE: TreeExpectation = {
  identity: D_FILE,
  range: D_ROOT_RANGE,
  attributes: [],
  children: [
    {
      identity: D_X_NODE_ID,
      range: D_X_RANGE,
      attributes: [D_X_ID, D_X_D],
      children: [],
    },
  ],
};

const E_TREE: TreeExpectation = {
  identity: E_FILE,
  range: E_ROOT_RANGE,
  attributes: [],
  children: [
    {
      identity: E_Y_NODE_ID,
      range: E_Y_RANGE,
      attributes: [E_Y_ID, E_Y_D],
      children: [],
    },
  ],
};

/** D's view: the one import entry, resolved (SPEC 11.4, 2.1). */
const D_IMPORTS: readonly ViewImportEntry[] = [
  { range: D_IMPORT_RANGE, name: "E", target: E_FILE },
];
const E_IMPORTS: readonly ViewImportEntry[] = [
  { range: E_IMPORT_RANGE, name: "D", target: D_FILE },
];

// Each file's complete occurrence enumeration (SPEC 5.7): the resolving
// external `d` reference — its span the reference's own expression — with
// its source graph node defined (SPEC 11.2).
const D_OCCURRENCES: readonly OccurrenceRecord[] = [
  {
    file: D_FILE,
    range: D_X_D_REF,
    kind: "depends",
    source: { identity: D_X_NODE_ID, range: D_X_RANGE },
    target: E_Y_NODE_ID,
  },
];
const E_OCCURRENCES: readonly OccurrenceRecord[] = [
  {
    file: E_FILE,
    range: E_Y_D_REF,
    kind: "depends",
    source: { identity: E_Y_NODE_ID, range: E_Y_RANGE },
    target: D_X_NODE_ID,
  },
];

/** The cycle workspace's exact condition multiset (staging integrity). */
const CYCLE_CONDITION_COUNTS: Readonly<Record<string, number>> = {
  "14.9": 2,
};

// The two joint findings' full paths (SPEC 14's cardinality rule): one
// location per participating construct, one in each file, in 12.7 location
// order (file path bytes: D before E). The spec import cycle locates each
// participating import declaration; the dependency cycle locates each
// participating reference spelling — its window the opening tag that spells
// it (the T11.2-4 tolerance; the two windows are disjoint within each file,
// so the 12.7 findings order pins the import-cycle finding first).
const CYCLE_IMPORT_LOCATIONS: readonly LocationWindowExpectation[] = [
  { file: D_FILE, window: widened(D_IMPORT_RANGE) },
  { file: E_FILE, window: widened(E_IMPORT_RANGE) },
];
const CYCLE_DEPENDENCY_LOCATIONS: readonly LocationWindowExpectation[] = [
  { file: D_FILE, window: widened(D_X_OPEN) },
  { file: E_FILE, window: widened(E_Y_OPEN) },
];

/**
 * Assert the two-file cycle findings accompany WHOLE (SPEC 11.2, 14):
 * exactly two 14.9 findings — the spec import cycle, then the dependency
 * cycle (the 12.7 findings order over their disjoint, ordered windows) —
 * each carrying exactly its two participating locations, one per file,
 * whatever the invocation's domain was.
 */
function assertCycleFindingsWhole(
  findings: readonly Finding[],
  context: string,
): void {
  assertConditionCounts(
    findings,
    CYCLE_CONDITION_COUNTS,
    `${context} — exactly the two staged 14.9 conditions: the dependency ` +
      `cycle over the mutual d references and the spec import cycle over ` +
      `the mutual imports the external form forces (SPEC 5.3, 2.1, 14.9)`,
  );
  const cycles = findings.filter((finding) => finding.condition === "14.9");
  assertLocatedFinding(
    cycles[0]!,
    CYCLE_IMPORT_LOCATIONS,
    `${context} — the spec import cycle accompanies WHOLE: one location ` +
      `per participating import declaration, BOTH files' included ` +
      `(SPEC 11.2: a condition several files jointly violate accompanies ` +
      `the answer whole whenever any participating file lies in the ` +
      `domain; SPEC 14's cardinality rule)`,
  );
  assertLocatedFinding(
    cycles[1]!,
    CYCLE_DEPENDENCY_LOCATIONS,
    `${context} — the dependency cycle accompanies WHOLE: one location per ` +
      `participating reference spelling, BOTH files' included (SPEC 11.2, ` +
      `14)`,
  );
}

/**
 * Run one availability-surface invocation expected to fail its argument
 * checks: exit 2 exactly (the checks precede answering — SPEC 11.2, 12.0 —
 * whatever findings the workspace or the named files carry), stdout exactly
 * the single 12.7 error document (the surfaces are JSON-only, SPEC 11, so
 * JSON output is always in effect; the form-exact decode admits no findings
 * report and no answer beside it), and the usage message on stderr (12.0).
 * Exported: the per-surface spelling matrices (T11.3-2/3, T11.4-2, T11.5-2)
 * assert their exit-2 arms through this same protocol
 * (registry/section-11.3.ts imports, never copies). Accepts raw-byte argv
 * elements (`ArgvValue`) for T11.5-3's Linux-leg non-UTF-8 `at` spellings
 * (the T6.5-5/T12.0-5 precedent: argv is a byte channel there, carried by
 * the subprocess driver's raw-byte argv support).
 */
export async function expectAvailabilityUsageError(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly ArgvValue[],
  context: string,
): Promise<void> {
  const command = `xspec ${argv
    .map((arg) =>
      typeof arg === "string"
        ? arg
        : `<bytes 0x${Buffer.from(arg).toString("hex")}>`,
    )
    .join(" ")}`;
  const result = await runProduct(product, { cwd: workspace.root, argv });
  assertExitCode(
    result,
    2,
    `${context}: \`${command}\` — the argument checks of 11.3–11.5 precede ` +
      `answering, so the usage error exits 2 whatever findings the ` +
      `workspace or the named files carry (SPEC 11.2, 12.0)`,
  );
  expectErrorDocument(
    result,
    `${context}: \`${command}\` — the surface is JSON-only, so JSON output ` +
      `is in effect and the exit-2 error document is the entire stdout: no ` +
      `findings report, no answer beside it (SPEC 11, 12.0, 12.7, H-5)`,
  );
  if (result.stderrBytes.length === 0) {
    fail(
      `${context}: \`${command}\` — usage error messages are ` +
        `standard-error content (SPEC 12.0), but stderr is empty`,
    );
  }
}

const T11_2_5 = defineProductTest({
  id: "T11.2-5",
  title:
    "`view` naming only C — T11.2-1's finding-free file, A and B staying invalid beside it — answers finding-free with exit 0: the domain is the requested files; naming A attaches exactly A's findings of both levels (never B's 14.20), exit 1, the full answer still emitted (the document complete and parseable, H-5); the two-file cycle pair D/E (mutual external `d` references and the mutual imports they force: a dependency cycle and a spec import cycle, 14.9 ×2) accompanies WHOLE — both files' participating locations — when either participant is the domain, and not at all when only the finding-free file is; any finding → exit 1 with the full answer, complete and finding-free → exit 0; argument checks precede answering: unknown `<file>`, wrong-kind `<file>` (a discovered code source), an outside-root `--file` glob, a malformed `--to` (empty segment), and an out-of-range offset each exit 2 with the single 12.7 error document as the entire stdout, whatever findings the workspace or the named files carry (SPEC 11.2, 11.3–11.5, 12.0, 12.7, 14)",
  run: async (product) => {
    // Fixture self-checks (T5.7-2 discipline): composed-range arithmetic
    // proven against the staged bytes before any product invocation.
    sliceCheck(D_SOURCE, D_IMPORT_RANGE, D_IMPORT_TEXT, "D's import");
    sliceCheck(D_SOURCE, D_X_D_REF, "E.y", "D's reference expression");
    sliceCheck(D_SOURCE, D_X_OPEN, '<S id="x" d={E.y}>', "D's opening tag");
    sliceCheck(E_SOURCE, E_IMPORT_RANGE, E_IMPORT_TEXT, "E's import");
    sliceCheck(E_SOURCE, E_Y_D_REF, "D.x", "E's reference expression");
    sliceCheck(E_SOURCE, E_Y_OPEN, '<S id="y" d={D.x}>', "E's opening tag");

    // --- Workspace 1: T11.2-1's A/B/C beside a discovered code source ------
    {
      const workspace = await TestWorkspace.create({
        files: {
          "xspec.config.ts": SPEC_AND_CODE_CONFIG,
          [A_FILE]: A_SOURCE,
          [B_FILE]: B_SOURCE,
          [C_FILE]: C_STAGED,
          [WRONG_KIND_CODE_FILE]: WRONG_KIND_CODE_SOURCE,
        },
        mdx: { unparseable: [B_FILE] },
      });
      try {
        await assertLeavesUnchanged(
          workspace.root,
          async () => {
            // Gate reference and staging integrity: A and B stay invalid —
            // exactly T11.2-1's condition multiset, so the reference-free
            // code source adds no finding (and C none), and every later
            // domain assertion stands on pinned ground (SPEC 12.1, 14).
            const buildContext =
              "T11.2-5 `build --json` (staging integrity: A and B stay " +
              "invalid; the reference-free code source and C contribute " +
              "nothing)";
            const buildResult = await expectExit(
              product,
              workspace,
              ["build", "--json"],
              1,
              buildContext,
            );
            const buildFindings = decodeFindingsReport(
              parseJsonStdout(buildResult, buildContext),
              buildContext,
            ).findings;
            assertConditionCounts(
              buildFindings,
              WORKSPACE_CONDITION_COUNTS,
              `${buildContext} — exactly the staged conditions (SPEC 14)`,
            );
            assertFindingHomes(buildFindings, buildContext);

            // --- `view` naming only C: the domain is the requested files,
            // so nothing of A's or B's attaches — a complete, finding-free
            // answer, exit 0, while the workspace stays failing (SPEC 11.2,
            // 11.4).
            const viewCContext =
              "T11.2-5 `view specs/C.mdx` (the finding-free file alone, on " +
              "the failing workspace)";
            const viewCResult = await expectExit(
              product,
              workspace,
              ["view", C_FILE],
              0,
              `${viewCContext} — a complete, finding-free answer exits 0: ` +
                `the consulted domain is the requested files, and A's and ` +
                `B's findings are no domain file's (SPEC 11.2)`,
            );
            const viewCReport = decodeViewReport(
              parseJsonStdout(
                viewCResult,
                `${viewCContext} — a single JSON document is the only ` +
                  `output form (SPEC 11)`,
              ),
              { text: false },
              viewCContext,
            );
            assertSameJson(
              viewCReport.findings,
              [],
              `${viewCContext} — the domain's findings alone accompany: ` +
                `none — never A's six, never B's 14.20 (SPEC 11.2)`,
            );
            assertSameJson(
              viewCReport.views.map((view) => view.file),
              [C_FILE],
              `${viewCContext} — exactly the requested file's view (SPEC 11.4)`,
            );
            const viewC = viewCReport.views[0]!;
            assertSameJson(
              projectNode(viewC.root),
              C_TREE,
              `${viewCContext} — C's complete view: byte-exact ranges, ` +
                `defined identities (SPEC 11.2, 11.4)`,
            );
            assertSameJson(
              [viewC.imports, viewC.occurrences, viewC.comments],
              [[], [], []],
              `${viewCContext} — C holds no imports, occurrences, or ` +
                `comments: empty arrays, never null (SPEC 12.7)`,
            );

            // --- `view` naming A: A's findings of BOTH levels accompany —
            // and only A's — exit 1 with the full answer still emitted:
            // exit 1 signals imperfection and never withholds the answer
            // (SPEC 11.2, H-5).
            const viewAContext =
              "T11.2-5 `view specs/A.mdx` (the finding-laden file alone)";
            const viewAResult = await expectExit(
              product,
              workspace,
              ["view", A_FILE],
              1,
              `${viewAContext} — the answer carries findings and ` +
                `explicitly-unavailable identities, so exit 1 (SPEC 11.2)`,
            );
            const viewAReport = decodeViewReport(
              parseJsonStdout(
                viewAResult,
                `${viewAContext} — the full answer document is still ` +
                  `emitted, complete and parseable (SPEC 11.2, H-5)`,
              ),
              { text: false },
              viewAContext,
            );
            assertConditionCounts(
              viewAReport.findings,
              A_DOMAIN_CONDITION_COUNTS,
              `${viewAContext} — exactly A's findings of both levels ` +
                `(resolution-level 14.5/14.9; per-file structural ` +
                `14.3/14.4/14.16/14.17) accompany; B's 14.20 is no domain ` +
                `file's finding and never attaches (SPEC 11.2)`,
            );
            assertFindingHomes(viewAReport.findings, viewAContext);
            assertSameJson(
              viewAReport.views.map((view) => view.file),
              [A_FILE],
              `${viewAContext} — the full answer: exactly A's view, never ` +
                `withheld for the findings (SPEC 11.2, 11.4)`,
            );
            const viewA = viewAReport.views[0]!;
            assertSameJson(
              projectNode(viewA.root),
              A_TREE,
              `${viewAContext} — A's full positional tree, byte-exact, ` +
                `identities per 11.2 (SPEC 11.2, 11.4)`,
            );
            assertSameJson(
              viewA.comments,
              [A_COMMENT_RANGE],
              `${viewAContext} — A's comment ranges served (SPEC 11.4)`,
            );
            assertSameJson(
              viewA.occurrences,
              A_EXPECTED_OCCURRENCES,
              `${viewAContext} — A's complete occurrence enumeration ` +
                `(SPEC 5.7, 11.2)`,
            );
            assertSameJson(
              viewA.imports,
              [],
              `${viewAContext} — A declares no imports (SPEC 12.7)`,
            );

            // --- Argument checks precede answering (SPEC 11.2, 12.0): each
            // usage error exits 2 with the single 12.7 error document,
            // whatever findings the workspace or the named files carry —
            // never exit 1 with the domain's findings. The per-surface
            // spelling matrices live at T11.3-2/3, T11.4-2, T11.5-2.
            await expectAvailabilityUsageError(
              product,
              workspace,
              ["view", "specs/Nope.mdx"],
              "T11.2-5 unknown `<file>` operand (11.4: a file outside the " +
                "discovered set is unknown) on the failing workspace",
            );
            await expectAvailabilityUsageError(
              product,
              workspace,
              ["view", WRONG_KIND_CODE_FILE],
              "T11.2-5 wrong-kind `<file>` operand (11.4: a discovered " +
                "code source has no structural view) on the failing " +
                "workspace",
            );
            await expectAvailabilityUsageError(
              product,
              workspace,
              ["occurrences", "--file", "../outside/*.mdx"],
              "T11.2-5 invalid glob (11.3, 11.1: a `--file` pattern " +
                "resolving outside the workspace root is an invalid flag " +
                "value) on the failing workspace",
            );
            await expectAvailabilityUsageError(
              product,
              workspace,
              ["occurrences", "--to", `${A_FILE}#a..b`],
              "T11.2-5 malformed `--to` (11.3: an empty segment is not a " +
                "well-formed identity spelling) naming the finding-laden A",
            );
            await expectAvailabilityUsageError(
              product,
              workspace,
              ["at", A_FILE, String(A_ROOT_RANGE.end + 1)],
              "T11.2-5 out-of-range offset (11.5: only the offsets 0 " +
                "through the file's byte length resolve) on the " +
                "finding-laden A",
            );
          },
          "T11.2-5 workspace 1 — no invocation of the sweep modifies " +
            "anything: no graph data, no derived files (SPEC 11.2, 12.1, " +
            "13.3; staging hygiene — the no-write contract clauses live at " +
            "T11.2-1/T11.2-6)",
        );
      } finally {
        await workspace.dispose();
      }
    }

    // --- Workspace 2: the two-file cycle pair beside the finding-free C ----
    {
      const workspace = await TestWorkspace.create({
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          [C_FILE]: C_STAGED,
          [D_FILE]: D_STAGED,
          [E_FILE]: E_STAGED,
        },
      });
      try {
        await assertLeavesUnchanged(
          workspace.root,
          async () => {
            // Gate reference and staging integrity: the two cycles are the
            // workspace's ONLY conditions, each located whole (SPEC 5.3,
            // 2.1, 14.9, 14).
            const buildContext =
              "T11.2-5 cycle workspace `build --json` (staging integrity: " +
              "the dependency cycle and the forced spec import cycle are " +
              "the only conditions; C contributes nothing)";
            const buildResult = await expectExit(
              product,
              workspace,
              ["build", "--json"],
              1,
              buildContext,
            );
            assertCycleFindingsWhole(
              decodeFindingsReport(
                parseJsonStdout(buildResult, buildContext),
                buildContext,
              ).findings,
              buildContext,
            );

            // --- `view` naming each participant: both joint findings
            // accompany WHOLE — the other file's locations included, that
            // file lying outside the domain (SPEC 11.2) — with the full
            // answer (the participant's complete view) still emitted,
            // exit 1.
            const participants = [
              {
                file: D_FILE,
                tree: D_TREE,
                imports: D_IMPORTS,
                occurrences: D_OCCURRENCES,
                what: "D",
              },
              {
                file: E_FILE,
                tree: E_TREE,
                imports: E_IMPORTS,
                occurrences: E_OCCURRENCES,
                what: "E",
              },
            ] as const;
            for (const participant of participants) {
              const context =
                `T11.2-5 \`view ${participant.file}\` (one cycle ` +
                `participant as the whole domain)`;
              const result = await expectExit(
                product,
                workspace,
                ["view", participant.file],
                1,
                `${context} — the answer carries the cycle findings, so ` +
                  `exit 1 with the full answer (SPEC 11.2)`,
              );
              const report = decodeViewReport(
                parseJsonStdout(
                  result,
                  `${context} — a single JSON document is the only output ` +
                    `form (SPEC 11)`,
                ),
                { text: false },
                context,
              );
              assertCycleFindingsWhole(report.findings, context);
              assertSameJson(
                report.views.map((view) => view.file),
                [participant.file],
                `${context} — exactly the requested file's view (SPEC 11.4)`,
              );
              const view = report.views[0]!;
              assertSameJson(
                projectNode(view.root),
                participant.tree,
                `${context} — ${participant.what}'s complete positional ` +
                  `tree, identities defined: cycle participation never ` +
                  `undefines an identity (SPEC 11.2)`,
              );
              assertSameJson(
                view.imports,
                participant.imports,
                `${context} — the import entry stays on view, resolved: ` +
                  `the cycle is a finding, never a view omission ` +
                  `(SPEC 11.4, 2.1)`,
              );
              assertSameJson(
                view.occurrences,
                participant.occurrences,
                `${context} — the resolving reference records its ` +
                  `occurrence, cycle notwithstanding (SPEC 5.7, 11.2)`,
              );
              assertSameJson(
                view.comments,
                [],
                `${context} — no comments staged (SPEC 12.7)`,
              );
            }

            // --- `view` naming only C: no participant in the domain, so
            // neither joint finding attaches — complete and finding-free,
            // exit 0 (SPEC 11.2: whole attachment turns on a participating
            // file lying in the domain, and only on that).
            const calmContext =
              "T11.2-5 cycle workspace `view specs/C.mdx` (no cycle " +
              "participant in the domain)";
            const calmResult = await expectExit(
              product,
              workspace,
              ["view", C_FILE],
              0,
              `${calmContext} — a complete, finding-free answer exits 0: ` +
                `the cycle findings belong to D and E, neither in the ` +
                `domain (SPEC 11.2)`,
            );
            const calmReport = decodeViewReport(
              parseJsonStdout(
                calmResult,
                `${calmContext} — a single JSON document is the only ` +
                  `output form (SPEC 11)`,
              ),
              { text: false },
              calmContext,
            );
            assertSameJson(
              calmReport.findings,
              [],
              `${calmContext} — neither 14.9 attaches: a joint condition ` +
                `accompanies exactly the answers whose domain holds a ` +
                `participant (SPEC 11.2)`,
            );
            assertSameJson(
              calmReport.views.map((view) => view.file),
              [C_FILE],
              `${calmContext} — exactly C's view (SPEC 11.4)`,
            );
            assertSameJson(
              projectNode(calmReport.views[0]!.root),
              C_TREE,
              `${calmContext} — C's complete view (SPEC 11.2, 11.4)`,
            );
          },
          "T11.2-5 workspace 2 — no invocation of the sweep modifies " +
            "anything (SPEC 11.2, 12.1, 13.3; staging hygiene)",
        );
      } finally {
        await workspace.dispose();
      }
    }
  },
});

// ---------------------------------------------------------------------------
// T11.2-6 — never stale, gate findings never attach
// ---------------------------------------------------------------------------
//
// SPEC 11.2's closing paragraph, with TEST-SPEC's stated delegations: the
// passing-workspace half — these surfaces participate in read-time refresh
// exactly as 13.3's reads — rides T13.3-2's sweep; the failing-side
// answer-from-current-sources-and-write-nothing discipline is T11.2-1's
// (T13.3-3 stages the journal-error and refused-write failures stale);
// the gated-read breadth over these two fixtures (each of `ids`, `show`,
// `coverage`, `impact`, `review status`, `query` reporting the gate finding
// without answering) is T13.3-3's whole-gate arms; and the
// `occurrences`/`at` finding-free contrast on the same states rides
// T13.3-3's never-gated sweep and T14-4's availability rows. This test owns
// the six fixtures and the entry's own arms: a gate condition that is NO
// domain file's finding — the journal's 14.13, a write-path component's
// 14.22, each carrying no in-source location and a concerned path that
// names a domain file's own finding for condition 19 alone (SPEC 11.2: an
// obstructing component that is itself a discovered file attaches
// nothing) — accompanies no answer of these surfaces, while the state
// surfaces through `build` and `check` (fixtures 1 to 3); findings of no
// domain file attach nothing on the passing side either (fixtures 4 and
// 5); and the judgement these surfaces make past their argument checks
// makes every read the gate makes, a read failure there stopping them
// before any answer (fixture 6).
//
// Fixture 1 (garbage journal, 14.13): a passing `build` first — derived
// files and graph data then exist and match, so the later `check` stands on
// pinned ground — then one garbage line written at `.xspec/journal` (the
// journal is written only by `rename`/`move`, SPEC 6.1, so the build left
// it absent; the T12.2-2 family-7 and T14-4 staging). `build --json` and
// `check --json` each report the journal error — build's multiset exact
// ({14.13: 1}: build cannot observe staleness, SPEC 12.1), check's exact
// too ({14.13: 1}: the workspace fails `build`'s validations — journal
// errors alike, SPEC 13.3 — so 14.10's mismatch forms, per file and graph
// data, are undetectable and go unreported, SPEC 14.10, while the two
// forms reported whatever the validity have nothing here: the record the
// passing build wrote stays readable, no 14.23 state, and every recorded
// derived path is still generated, no recorded-file form; the exact pin
// discriminates a product reporting phantom staleness beside the journal
// error — the unit form of a hash comparison the journal's canonical
// identities, SPEC 5.4, leave unverifiable, or the generated files as
// stale against a regeneration the failing sources leave undefined) —
// each finding concerning the journal path (SPEC 14: a journal condition
// carries the file it concerns). Then `view specs/C.mdx`: the
// finding-free file's complete
// view, findings [], exit 0 — the workspace fails `build`'s validations
// (journal errors alike, SPEC 13.3), so the surface answers from current
// sources, consults no journal, and the gate finding never attaches.
//
// Fixture 2 (obstructed write path, 14.22): a passing `build` with
// emission under `markdown.outDir` (premise-checked: `mdout/` exists and
// holds the emitted `mdout/specs/C.md`, SPEC 7.3, 13.2), then the outDir
// directory replaced by a plain file — the emit write path's
// workspace-relative component `mdout` is now occupied by a non-directory,
// the one offending component (SPEC 13.4, 14.22; T13.3-3's arm-2 staging).
// `build --json` reports exactly {14.22: 1} concerning `mdout` and
// modifies nothing — the refusal precedes every write (byte-level, H-4: an
// identical regeneration would be invisible, which is exactly the
// contract's grain). `check --json` reports exactly {14.22: 1} concerning
// `mdout`: the swap deleted the emitted Markdown, but a workspace whose
// `build` is refused fails `build`'s validations — source validation
// errors, journal errors, and refused writes alike (SPEC 13.3) — and on
// such a workspace 14.10's mismatch forms, per file and graph data, are
// undetectable and go unreported (SPEC 14.10, 14), the missing
// `mdout/specs/C.md` included; the two forms reported whatever the
// validity have nothing here — the record is readable (no 14.23 state;
// contrast T10.1-6's `.xspec`-obstructed arm, where `check` reports the
// unreadable-record unit form beside the refusal) and every recorded
// derived path is still generated (no recorded-file form). The exact pin
// discriminates a product reporting the deleted emission as per-file
// staleness beside the refusal — the deviation the earlier
// {14.10: 1, 14.22: 1} pin demanded. Then `view specs/C.mdx`: finding-free,
// complete,
// exit 0 — the viewed file is the very file whose emission path is
// obstructed, and the write-path condition is still no domain file's
// finding (its concerned path is the component, never the source).
//
// Fixture 3 (the obstructing component is itself a discovered file — 14.22
// under 11.2's concerned-path clause): `markdown.outDir` names the
// discovered spec source `specs/A.mdx`, a plain file holding the
// finding-free C-shaped bytes, so every emit destination
// (`specs/A.mdx/specs/A.md`, and `specs/A.mdx/specs/C.md` for the second
// source staged beside it) lies below that file — the one offending
// component whatever write paths it refuses (SPEC 14.22: one finding per
// distinct offending component). The source stays discovered: 13.4
// excludes the files AT the emit destinations alone, and 7.3 admits the
// spelling, the occupant judged only where the write is made (13.4). The
// workspace is never built: the refusal precedes every write of the
// command's own (SPEC 14.22, 12.1), so the whole-root compares are at
// their sharpest — a product generating the modules or graph data before
// refusing the emission, or refreshing graph data on the failing side at
// `view`, is caught byte-wise where a pre-built ground would hide an
// identical rewrite. `build --json` reports exactly {14.22: 1} concerning
// `specs/A.mdx`, exit 1, nothing written. `check --json` reports exactly
// that finding, {14.22: 1}: the workspace fails `build`'s validations (a
// refused write, SPEC 13.3), so the unemittable destinations and the
// never-generated modules — per-file mismatch — and the absent graph data
// — the unit mismatch form — are undetectable and go unreported (SPEC
// 14.10), and no record exists to be unreadable (14.23) or to hold a
// recorded path the configuration no longer generates (the two forms
// reported whatever the validity); exit 1, nothing written. Then `view
// specs/A.mdx`: complete and finding-free,
// exit 0 — the concerned path IS the requested file, and still the finding
// is no domain file's, a concerned path naming a domain file's own finding
// for condition 19 alone (SPEC 11.2): the discriminating arm against a
// product attaching findings by concerned path.
//
// Fixtures 4 and 5 (the passing side: findings of no domain file attach nothing
// there either — SPEC 11.2: a finding is a domain file's exactly through a
// location in that file or a condition-19 concerned path), the exported
// `T11_2_6_PASSING_SIDE_STAGINGS` (T11.6-4, the inventory's counterpart, and
// T14-4, the reporter matrix, stage the same two workspaces and judge their
// `check` through the exported `expectCheckReportsStagedFinding`, one code
// path): each a workspace passing `build`'s validations, built (exit 0), so its
// graph data is fresh — 4 violating a `forbidden` rule (T7.5-2's staging: the
// spec group `hi`'s `specs/A.mdx#a` depending on the spec group `lo`'s
// `lo/L.mdx#l`, the offending edge's `d` spelled in the spec source
// `specs/A.mdx`, the rule `no-hi-to-lo` forbidding `hi` to `lo`), 5 holding a
// corrupt session (T10.1-4's garbage-bytes staging, `.xspec/reviews/cor.json`,
// written after the build; `specs/A.mdx` the finding-free C-shaped bytes).
// `check --json` reports exactly the one finding, exit 1, writing nothing — 4's
// 14.12 with no location and no concerned path (a policy finding is no file's
// finding, SPEC 14.12), 5's 14.21 with no location, concerning the session
// file, no domain file (14.21) — while `occurrences` (bare: the whole
// discovered set), `view specs/A.mdx`, and `at specs/A.mdx 0` each answer
// finding-free at exit 0, writing nothing (the fresh graph data needs no
// refresh, SPEC 13.3): the arm against a product attaching every finding
// lacking an in-source location to these answers (the offending edge's spelling
// lies in the very file viewed).
//
// Fixture 6 (the judgement's reads; the Linux leg, E-1): past their argument
// checks these surfaces judge `build`'s validations exactly as the gate of
// 13.3 does, making every read it makes whatever findings the sources carry
// — the kinds of `build`'s write-path directory components (14.22) included
// — and a read failure of that judgement stops them, a usage error before
// any answer (SPEC 11.2, 14.25, 12.0). The workspace emits Markdown under
// `out` (`markdown: { emit: true, outDir: "out" }`) beside the spec group
// `specs/**/*.mdx` and a code group `app` (`src/**/*.ts`) over `src/x.ts`,
// no glob reaching below `out`, so discovery never lists it (SPEC 7);
// `specs/A.mdx` holds the finding-free C-shaped bytes. It is built (exit 0;
// premise-checked: `out` and `out/specs` directories, the emitted
// `out/specs/A.md` a file, SPEC 7.3, 13.2), and around each run below — made
// just before it and restored in a `finally` once it ends, inside the run's
// whole-root compare (T6.3-6's discipline: the harness's own walk never
// meets the staging) — `out` is staged mode 000 (`stageDirectoryMode`,
// helpers/permissions.ts: read, write, and search removed, the harness
// verifying on itself that its own listing of `out` and its own examination
// of `out/specs` are refused, E-1), so the kind of `out/specs`, a directory
// component of every emit destination, can be read neither by examination
// nor from a listing (TEST-SPEC T14-10's both-routes clause). On the passing
// side, and then on the failing side — `specs/A.mdx` restaged with a
// section spelling no `id` (14.1; premise: `build --json` reports exactly
// {14.1: 1}, writing nothing): `view specs/A.mdx`, `occurrences`, `at
// specs/A.mdx 0`, `build --json`, `check --json`, `ids --json`, and `query
// nodes --json` each exit 2, standard output exactly the error document, its
// `code` `read-failure` and its `path` `out` or a path below it (which one
// turning on the product's read order, T14-10's last clause), the
// diagnostic on standard error, nothing modified — a product skipping the
// judgement answers instead, exit 0 on the passing side, exit 1 with the
// condition-1 finding on the failing one; and the judgement comes past
// every argument check, none of which reads below `out` (SPEC 11.2; 13.3:
// the gate follows the argument checks; 12.0: a read failure is met at the
// read it refuses, in the order the command makes its reads): `view
// specs/nope.mdx` (an undiscovered file, 11.4), `view src/x.ts` (a
// wrong-kind operand), `at specs/A.mdx <n>` with `<n>` the file's byte length
// plus one (11.5), `show specs/A.mdx#nope` (an `id` the file spells nowhere,
// 12.0), `query nodes --group app` (a code group's name, 11.1), `coverage
// nope` (an unknown profile), and `review status nope` (an unknown session)
// each exit 2 with its plain usage error, `code` and `path` `null`, never
// `read-failure`, nothing modified, on both sides — failing a product that
// judges the workspace, write-path kinds included, before its argument
// checks. Between the sides, the permission restored, `build` exits 0 and
// `check --json` is clean (SPEC 12.1, 12.2). On any other platform fixture 6
// does not run (`T11_2_6_MODE_STAGED`, T6.3-6's `J6_ENVIRONMENT_STAGED`
// pattern).
//
// Every invocation runs under a whole-root snapshot compare (the
// CERTIFICATIONS.md Exclusions note's answer-side no-write compares): the
// view answers write nothing — the garbage journal not repaired or
// deleted, no graph data or derived files touched — the failing
// build/check modify nothing (SPEC 12.1, 12.2, 14.22), and neither do the
// passing side's answers and `check` nor any run under fixture 6's staging.
//
// Fixtures 2 to 6 are created after fixture 1's invocations, so their
// configurations and sources are staged-source records (helpers/staged-mdx.ts,
// helpers/staged-ts.ts; S-9's timing clause), all well-formed, as is fixture
// 6's failing-side `specs/A.mdx`; fixture 1's configuration is
// SPECS_ONLY_CONFIG, a record itself (fixture 5's too), and fixture 5's
// corrupt session file is plain bytes, no source.

const JOURNAL_PATH = ".xspec/journal";
const T11_2_6_GARBAGE_LINE =
  "?? harness-injected garbage: not a journal entry ??\n";

const T11_2_6_OUTDIR_CONFIG = stagedTs(
  "T11.2-6 obstructed-write-path fixture xspec.config.ts — Markdown emission under mdout",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  markdown: { emit: true, outDir: "mdout" }
})
`,
);
const T11_2_6_OUTDIR = "mdout";
const T11_2_6_EMITTED = "mdout/specs/C.md";

// Fixture 3: the emit directory is the discovered spec source itself — a
// well-formed outDir spelling (SPEC 7.3: non-empty segments, none `.` or
// `..`), its occupant judged only where the write is made (13.4, 14.22).
const T11_2_6_SOURCE_OUTDIR_CONFIG = stagedTs(
  "T11.2-6 discovered-component fixture xspec.config.ts — markdown.outDir naming the discovered spec source",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  markdown: { emit: true, outDir: "${A_FILE}" }
})
`,
);

/**
 * The T11.2-6 never-attach arm: `view` naming the finding-free file
 * (C-shaped bytes at `file`, projecting `tree`) answers complete and
 * finding-free at exit 0 — whatever journal or write-path state the
 * workspace holds, the obstructing component being the viewed file itself
 * included (SPEC 11.2) — modifying nothing.
 */
async function assertViewFindingFree(
  product: ProductBinding,
  workspace: TestWorkspace,
  file: string,
  tree: TreeExpectation,
  context: string,
): Promise<void> {
  await assertLeavesUnchanged(
    workspace.root,
    async () => {
      const report = decodeViewReport(
        await runJson(
          product,
          workspace,
          ["view", file],
          `${context} — a complete, finding-free answer exits 0 whatever ` +
            `journal or write-path state the workspace holds (SPEC 11.2)`,
        ),
        { text: false },
        context,
      );
      assertSameJson(
        report.findings,
        [],
        `${context} — the gate condition is the finding of no domain file ` +
          `(no in-source location; a concerned path names a domain file's ` +
          `own finding for condition 19 alone, never for a write-path ` +
          `component, discovered file or not), so it accompanies no answer ` +
          `of this surface (SPEC 11.2, 14; the gated reads report it ` +
          `instead, T13.3-3)`,
      );
      assertSameJson(
        report.views.map((view) => view.file),
        [file],
        `${context} — exactly the requested file's view (SPEC 11.4)`,
      );
      const fileView = report.views[0]!;
      assertSameJson(
        projectNode(fileView.root),
        tree,
        `${context} — ${file}'s complete view: the answer is served ` +
          `whole, from the current sources (SPEC 11.2, 11.4)`,
      );
      assertSameJson(
        [fileView.imports, fileView.occurrences, fileView.comments],
        [[], [], []],
        `${context} — ${file} holds no imports, occurrences, or comments: ` +
          `empty arrays, never null (SPEC 12.7)`,
      );
    },
    `${context} — the answer consults no journal and no record and writes ` +
      `nothing: journal, graph data, and derived files byte-identical ` +
      `around the invocation (SPEC 11.2, 13.3)`,
  );
}

// --- Fixtures 4 and 5: the passing side (module comment) --------------------

// Fixture 4: T7.5-2's forbidden-rule staging with the offending edge's `d`
// spelled in the spec source `specs/A.mdx` — the spec group `hi`'s
// `specs/A.mdx#a` depends on the spec group `lo`'s `lo/L.mdx#l`, and the
// rule `no-hi-to-lo` forbids every edge from `hi` to `lo` (SPEC 7.5).
const T11_2_6_POLICY_CONFIG = stagedTs(
  "T11.2-6/T11.6-4/T14-4 passing-side policy fixture xspec.config.ts — a forbidden rule from the spec group hi to the spec group lo",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    hi: ["specs/**/*.mdx"],
    lo: ["lo/**/*.mdx"]
  },
  policy: [
    {
      name: "no-hi-to-lo",
      type: "forbidden",
      from: { group: "hi" },
      to: { group: "lo" }
    }
  ]
})
`,
);
const T11_2_6_POLICY_SOURCE = stagedMdx(
  "T11.2-6/T11.6-4/T14-4 passing-side policy fixture specs/A.mdx — the offending edge's d spelling",
  `import L from "../lo/L.xspec"

<S id="a" d={L.l}>
Depends on the low group.
</S>
`,
);
const T11_2_6_POLICY_TARGET_FILE = "lo/L.mdx";
const T11_2_6_POLICY_TARGET = stagedMdx(
  "T11.2-6/T11.6-4/T14-4 passing-side policy fixture lo/L.mdx — the forbidden edge's target",
  `<S id="l">
Low one.
</S>
`,
);

// Fixture 5: T10.1-4's shape-independent garbage bytes — no JSON document —
// staged directly at a session file (SPEC 10.1: `.xspec/reviews/<name>.json`)
// after the build, no assumed session layout involved.
const T11_2_6_CORRUPT_SESSION_PATH = ".xspec/reviews/cor.json";
const T11_2_6_CORRUPT_SESSION_BYTES =
  "this is deliberately not a JSON document ][}{\n";

/**
 * One of T11.2-6's passing-side stagings (TEST-SPEC T11.2-6; exported for
 * T11.6-4, the inventory's counterpart, and T14-4, the reporter matrix,
 * which stage the same two workspaces): a workspace passing `build`'s
 * validations, built, beside one finding of no domain file, which `check`
 * reports there (exit 1) and no answer of 11.3–11.5 carries (SPEC 11.2).
 */
export interface T1126PassingSideStaging {
  /** The arm, as contexts name it. */
  readonly arm: string;
  /** The one condition `check --json` reports on the staged workspace. */
  readonly condition: "14.12" | "14.21";
  /**
   * That finding's concerned path beside its empty `locations` — `null`
   * for the policy finding, which concerns no path (SPEC 14.12, 12.7).
   */
  readonly concerned: string | null;
  /** Why the finding is no domain file's (SPEC 11.2), for diagnostics. */
  readonly noDomainFile: string;
  /**
   * The discovered spec source `view` and `at` are asked over: the
   * finding-free `specs/A.mdx` — the policy staging's offending edge's `d`
   * spelled in it (SPEC 11.4, 11.5).
   */
  readonly file: string;
  /**
   * Create the workspace, `build` it (exit 0: policy is no validation of
   * `build`, SPEC 7.5, 12.1, and `build` reads no session, 14.21), and stage
   * the finding; the caller disposes the workspace.
   */
  readonly stage: (
    product: ProductBinding,
    context: string,
  ) => Promise<TestWorkspace>;
}

/**
 * Create a workspace from `files`, `build` it (exit 0), and apply `after`
 * to it — the workspace disposed when any of it throws.
 */
async function stageBuiltWorkspace(
  product: ProductBinding,
  files: WorkspaceDecl["files"],
  context: string,
  after?: (workspace: TestWorkspace) => Promise<void>,
): Promise<TestWorkspace> {
  const workspace = await TestWorkspace.create({ files });
  try {
    await buildOk(
      product,
      workspace,
      `${context} staging \`build\` — the workspace passes \`build\`'s ` +
        `validations (SPEC 12.1)`,
    );
    await after?.(workspace);
    return workspace;
  } catch (error) {
    await workspace.dispose();
    throw error;
  }
}

/** T11.2-6's two passing-side stagings, fixtures 4 and 5 (module comment). */
export const T11_2_6_PASSING_SIDE_STAGINGS: readonly T1126PassingSideStaging[] =
  [
    {
      arm: "a policy violation",
      condition: "14.12",
      concerned: null,
      noDomainFile:
        "a policy finding is no file's finding — it carries no in-source " +
        "location and concerns no path — and accompanies no answer of " +
        "11.3–11.5 (SPEC 14.12, 11.2), the offending edge's `d` spelling " +
        "in the very file viewed notwithstanding",
      file: A_FILE,
      stage: async (product, context) =>
        await stageBuiltWorkspace(
          product,
          {
            "xspec.config.ts": T11_2_6_POLICY_CONFIG,
            [A_FILE]: T11_2_6_POLICY_SOURCE,
            [T11_2_6_POLICY_TARGET_FILE]: T11_2_6_POLICY_TARGET,
          },
          context,
        ),
    },
    {
      arm: "a corrupt session",
      condition: "14.21",
      concerned: T11_2_6_CORRUPT_SESSION_PATH,
      noDomainFile:
        "a session file is no domain file — the corrupt-session finding " +
        "carries no in-source location, and its concerned path names no " +
        "domain file (SPEC 14.21, 11.2)",
      file: A_FILE,
      stage: async (product, context) =>
        await stageBuiltWorkspace(
          product,
          { "xspec.config.ts": SPECS_ONLY_CONFIG, [A_FILE]: C_STAGED },
          context,
          async (workspace) => {
            await workspace.file(
              T11_2_6_CORRUPT_SESSION_PATH,
              T11_2_6_CORRUPT_SESSION_BYTES,
            );
          },
        ),
    },
  ];

/**
 * Fixtures 4 and 5's `check --json`: exit 1 with exactly the staged finding
 * of no domain file, form-exact — its stable code (the token-derived
 * condition count), no in-source location, its concerned path
 * `staging.concerned` — writing nothing (SPEC 12.2, 14). Exported for
 * T11.6-4, which judges `check` on the same stagings beside its finding-free
 * `inventory` answers (registry/section-11.6.ts), and for T14-4, beside its
 * finding-free answers of `occurrences`, `view`, `at`, and `inventory`
 * (registry/section-14.ts).
 */
export async function expectCheckReportsStagedFinding(
  product: ProductBinding,
  workspace: TestWorkspace,
  staging: T1126PassingSideStaging,
  context: string,
): Promise<void> {
  const checkContext = `${context} \`check --json\``;
  await assertLeavesUnchanged(
    workspace.root,
    async () => {
      const findings = await runFindingsReport(
        product,
        workspace,
        ["check", "--json"],
        1,
        `${checkContext} — \`check\` reports condition ` +
          `${staging.condition} on the passing workspace (SPEC 12.2, 14)`,
      );
      assertConditionCounts(
        findings,
        { [staging.condition]: 1 },
        `${checkContext} — exactly the staged finding: the built workspace ` +
          `passes \`build\`'s validations and its derived files and graph ` +
          `data are fresh (SPEC 12.2, 14)`,
      );
      assertSameJson(
        { locations: findings[0]!.locations, path: findings[0]!.path },
        { locations: [], path: staging.concerned },
        `${checkContext} — ${staging.noDomainFile}: no in-source location, ` +
          `its concerned path ${JSON.stringify(staging.concerned)} (SPEC ` +
          `14, 12.7)`,
      );
    },
    `${checkContext} — \`check\` writes nothing (SPEC 12.2)`,
  );
}

/**
 * Fixtures 4 and 5's answers: `occurrences` (bare: the whole discovered
 * set), `view specs/A.mdx`, and `at specs/A.mdx 0` — `specs/A.mdx` the
 * staging's `file` — each answer finding-free at exit 0, the staged
 * finding being no domain file's (its `noDomainFile`, SPEC 11.2), each
 * writing nothing: the graph data the build wrote is fresh, so no refresh
 * writes (SPEC 13.3), and these reads write nothing else.
 */
async function assertPassingSideAnswersFindingFree(
  product: ProductBinding,
  workspace: TestWorkspace,
  staging: T1126PassingSideStaging,
  context: string,
): Promise<void> {
  const { file, noDomainFile } = staging;
  const noWrite =
    "writes nothing: the built workspace's graph data is fresh, so no " +
    "refresh writes, and the answer writes nothing else (SPEC 11.2, 13.3)";

  const occurrencesContext = `${context} bare \`occurrences\``;
  await assertLeavesUnchanged(
    workspace.root,
    async () => {
      const report = decodeOccurrencesReport(
        await runJson(
          product,
          workspace,
          ["occurrences"],
          `${occurrencesContext} — the whole discovered set's enumeration ` +
            `is complete and finding-free, so it exits 0 (SPEC 11.2, 11.3)`,
        ),
        occurrencesContext,
      );
      assertSameJson(
        report.findings,
        [],
        `${occurrencesContext} — only the consulted domain's findings ` +
          `accompany the answer, and ${noDomainFile}`,
      );
    },
    `${occurrencesContext} — ${noWrite}`,
  );

  const viewContext = `${context} \`view ${file}\``;
  await assertLeavesUnchanged(
    workspace.root,
    async () => {
      const report = decodeViewReport(
        await runJson(
          product,
          workspace,
          ["view", file],
          `${viewContext} — the requested file's view is complete and ` +
            `finding-free, so it exits 0 (SPEC 11.2, 11.4)`,
        ),
        { text: false },
        viewContext,
      );
      assertSameJson(
        report.findings,
        [],
        `${viewContext} — only the consulted domain's findings accompany ` +
          `the answer, and ${noDomainFile}`,
      );
      assertSameJson(
        report.views.map((view) => view.file),
        [file],
        `${viewContext} — exactly the requested file's view (SPEC 11.4)`,
      );
    },
    `${viewContext} — ${noWrite}`,
  );

  const atContext = `${context} \`at ${file} 0\``;
  await assertLeavesUnchanged(
    workspace.root,
    async () => {
      const report = decodeAtReport(
        await runJson(
          product,
          workspace,
          ["at", file, "0"],
          `${atContext} — the named file's resolution is complete and ` +
            `finding-free, so it exits 0 (SPEC 11.2, 11.5)`,
        ),
        atContext,
      );
      assertSameJson(
        report.findings,
        [],
        `${atContext} — only the named file's findings accompany the ` +
          `answer, and ${noDomainFile}`,
      );
    },
    `${atContext} — ${noWrite}`,
  );
}

// --- Fixture 6: the judgement's reads (module comment) -----------------------

/**
 * Whether fixture 6 runs: its mode-000 staging is a permission removal, the
 * Linux leg's (E-1), verified on the harness itself before any product sees
 * it — a privileged runner's ineffective staging a harness error, never a
 * pass or a skip (H-9, H-11). On any other platform the other fixtures alone
 * run (T6.3-6's `J6_ENVIRONMENT_STAGED` pattern).
 */
const T11_2_6_MODE_STAGED = process.platform === "linux";
/** The emit directory `out` (SPEC 7.3), staged mode 000 around each run. */
const T11_2_6_EMIT_DIR = "out";
/** Read, write, and search permission all removed (TEST-SPEC T14-10). */
const T11_2_6_EMIT_DIR_MODE = 0o000;
/**
 * The entry below `out` whose kind the staging refuses — `out/specs`, a
 * directory component of every emit destination (SPEC 7.3, 13.2, 14.22).
 */
const T11_2_6_EMIT_COMPONENT = "specs";
/** The prior build's emission of `specs/A.mdx` (SPEC 7.3, 13.2). */
const T11_2_6_EMITTED_A = "out/specs/A.md";
const T11_2_6_CODE_GROUP = "app";
const T11_2_6_CODE_FILE = "src/x.ts";
/** 14.25's stable code, carried only by the exit-2 error document. */
const T11_2_6_READ_FAILURE_CODE = "read-failure";

const T11_2_6_UNREADABLE_EMIT_CONFIG = stagedTs(
  "T11.2-6 unreadable-emit-directory fixture xspec.config.ts — Markdown emission under out, a code group app beside the spec group",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: {
    ${T11_2_6_CODE_GROUP}: ["src/**/*.ts"]
  },
  markdown: { emit: true, outDir: "${T11_2_6_EMIT_DIR}" }
})
`,
);
const T11_2_6_CODE_SOURCE = stagedTs(
  "T11.2-6 unreadable-emit-directory fixture src/x.ts — the code group's one source",
  "export const x = 1;\n",
);
// The failing side's `specs/A.mdx`: one section spelling no `id` (14.1),
// restaged after the build, so `out` still holds that build's emission.
const T11_2_6_ID_LESS_SOURCE_TEXT = "Intro prose.\n\n<S>\nNo id here.\n</S>\n";
const T11_2_6_ID_LESS_SOURCE = stagedMdx(
  "T11.2-6 unreadable-emit-directory fixture specs/A.mdx — the failing side: a section spelling no id (14.1)",
  T11_2_6_ID_LESS_SOURCE_TEXT,
);

/**
 * Fixture 6's commands judging `build`'s validations past their argument
 * checks: the three surfaces of 11.2 (bare: JSON-only, SPEC 11), `build`,
 * `check`, and the gated reads' representatives `ids` and `query nodes`.
 */
const T11_2_6_JUDGING_COMMANDS: readonly (readonly string[])[] = [
  ["view", A_FILE],
  ["occurrences"],
  ["at", A_FILE, "0"],
  ["build", "--json"],
  ["check", "--json"],
  ["ids", "--json"],
  ["query", "nodes", "--json"],
];

/**
 * Fixture 6's argument checks — each a usage error judged before the
 * judgement and reading nothing below `out` (SPEC 11.2, 13.3, 12.0) — for a
 * `specs/A.mdx` of `length` bytes, with why each is a usage error.
 */
function t1126ArgumentChecks(
  length: number,
): readonly { readonly argv: readonly string[]; readonly why: string }[] {
  const beyond = String(length + 1);
  return [
    {
      argv: ["view", "specs/nope.mdx"],
      why: "an undiscovered file is an unknown-file operand (SPEC 11.4, 12.0)",
    },
    {
      argv: ["view", T11_2_6_CODE_FILE],
      why:
        "a discovered code source is a wrong-kind operand, having no " +
        "structural view (SPEC 11.4, 12.0)",
    },
    {
      argv: ["at", A_FILE, beyond],
      why:
        `${beyond}, the file's byte length plus one, is an out-of-range ` +
        `offset (SPEC 11.5, 12.0)`,
    },
    {
      argv: ["show", `${A_FILE}#nope`, "--json"],
      why:
        "an `id` the file spells nowhere names an unknown requirement node, " +
        "judged parse-local against the named file (SPEC 12.0, 12.4)",
    },
    {
      argv: ["query", "nodes", "--group", T11_2_6_CODE_GROUP, "--json"],
      why:
        "a code group's name under `--group` is an invalid flag value (SPEC " +
        "11.1, 12.0)",
    },
    {
      argv: ["coverage", "nope", "--json"],
      why: "no configured coverage profile is named nope (SPEC 8.2, 12.0)",
    },
    {
      argv: ["review", "status", "nope", "--json"],
      why:
        "no session is named nope, judged against the session directory " +
        "(SPEC 10.1, 12.0)",
    },
  ];
}

/**
 * Run `argv` from the workspace root with fixture 6's emit directory `out`
 * staged mode 000 — made just before the run and restored in a `finally`
 * once it ends, before anything is asserted on the result (T6.3-6's
 * `runUnderStaging` discipline), so a caller's whole-root compare, whose
 * snapshots are taken outside it, never meets the staging. The staging
 * verifies on the harness itself that its own listing of `out` and its own
 * examination of `out/specs` are refused (E-1; TEST-SPEC T11.2-6, T14-10),
 * a privileged runner's ineffective staging a `HarnessStagingError`.
 */
async function runWithEmitDirectoryUnreadable(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
): Promise<RunResult> {
  const staging = await stageDirectoryMode(
    workspace.path(T11_2_6_EMIT_DIR),
    T11_2_6_EMIT_DIR_MODE,
    [
      { attempt: "list", refused: true },
      { attempt: "examine", name: T11_2_6_EMIT_COMPONENT, refused: true },
    ],
  );
  try {
    return await runCli(product, workspace, argv);
  } finally {
    await staging.restore();
  }
}

/** Whether `concerned` is the emit directory `out` or a path below it. */
function isEmitDirectoryPath(concerned: PathValue | null): boolean {
  return (
    typeof concerned === "string" &&
    (concerned === T11_2_6_EMIT_DIR ||
      concerned.startsWith(`${T11_2_6_EMIT_DIR}/`))
  );
}

/**
 * One fixture-6 run of a judging command (`T11_2_6_JUDGING_COMMANDS`):
 * exit 2, standard output exactly the error document — no answer — its
 * finding's stable code `read-failure` and its concerned path `out` or a
 * path below it, the diagnostic on standard error, nothing modified (SPEC
 * 11.2, 13.3, 14.25, 12.0, 12.7).
 */
async function expectJudgementReadFailure(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  context: string,
): Promise<void> {
  const label = `${context}: \`${argv.join(" ")}\``;
  await assertLeavesUnchanged(
    workspace.root,
    async () => {
      const result = await runWithEmitDirectoryUnreadable(
        product,
        workspace,
        argv,
      );
      assertExitCode(
        result,
        2,
        `${label} — past its argument checks the command judges \`build\`'s ` +
          `validations exactly as the gate of 13.3 does, whatever findings ` +
          `the sources carry, reading the kinds of \`build\`'s write-path ` +
          `directory components; the kind of out/specs is refused by both ` +
          `routes, so that read fails: a usage error before any answer, ` +
          `exit 2 (SPEC 11.2, 13.3, 14.22, 14.25, 12.0)`,
      );
      const error = expectErrorDocument(
        result,
        `${label} — standard output is exactly the error document, no ` +
          `answer (SPEC 12.0, 12.7, 11.2)`,
      );
      if (error.code !== T11_2_6_READ_FAILURE_CODE) {
        fail(
          `${label} — the refused read of the judgement is a read failure: ` +
            `the error document's finding carries the stable code ` +
            `${JSON.stringify(T11_2_6_READ_FAILURE_CODE)} (SPEC 14.25, 14, ` +
            `12.7); got ${JSON.stringify(error.code)} (message: ` +
            `${JSON.stringify(error.message)})`,
        );
      }
      if (!isEmitDirectoryPath(error.path)) {
        fail(
          `${label} — the concerned path is the refused object's ` +
            `workspace-relative path, ${JSON.stringify(T11_2_6_EMIT_DIR)} or ` +
            `a path below it as the product's read order decides (SPEC 14.25; ` +
            `TEST-SPEC T14-10's last clause); got ` +
            `${JSON.stringify(error.path)} (message: ` +
            `${JSON.stringify(error.message)})`,
        );
      }
      if (result.stderrBytes.length === 0) {
        fail(
          `${label} — usage error messages are standard-error content (SPEC ` +
            `12.0, 14.25), but stderr is empty beside ` +
            `${JSON.stringify(error.message)}`,
        );
      }
    },
    `${label} — the command stops at the refused read, modifying nothing ` +
      `(SPEC 14.25, 12.0)`,
  );
}

/**
 * One fixture-6 run of an argument check (`t1126ArgumentChecks`): exit 2
 * with its plain usage error — `code` and `path` `null`, never
 * `read-failure` — nothing modified: the judgement comes past every
 * argument check, and no argument check reads below `out` (SPEC 11.2; 13.3:
 * the gate follows the argument checks; 12.0).
 */
async function expectArgumentCheckFirst(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  why: string,
  context: string,
): Promise<void> {
  const label = `${context}: \`${argv.join(" ")}\``;
  await assertLeavesUnchanged(
    workspace.root,
    async () => {
      const result = await runWithEmitDirectoryUnreadable(
        product,
        workspace,
        argv,
      );
      assertPlainUsageError(
        result,
        `${label} — ${why}: an argument check, which precedes the judgement ` +
          `of \`build\`'s validations and reads nothing below out, so the ` +
          `command exits 2 with its usage error, never \`read-failure\` ` +
          `(SPEC 11.2, 13.3, 12.0)`,
      );
    },
    `${label} — a usage error modifies nothing (SPEC 12.0)`,
  );
}

/**
 * One side of fixture 6 (`side` naming it), `specs/A.mdx` holding
 * `sourceText`: every judging command meets the read failure, then every
 * argument check answers its usage error first (module comment).
 */
async function runEmitDirectoryUnreadableSide(
  product: ProductBinding,
  workspace: TestWorkspace,
  sourceText: string,
  context: string,
): Promise<void> {
  for (const argv of T11_2_6_JUDGING_COMMANDS) {
    await expectJudgementReadFailure(product, workspace, argv, context);
  }
  for (const check of t1126ArgumentChecks(
    Buffer.byteLength(sourceText, "utf8"),
  )) {
    await expectArgumentCheckFirst(
      product,
      workspace,
      check.argv,
      check.why,
      context,
    );
  }
}

const T11_2_6 = defineProductTest({
  id: "T11.2-6",
  title:
    "gate findings never attach, and the judgement's reads stop these surfaces: on an otherwise-valid pre-built workspace with a garbage journal line staged (14.13), separately with the `markdown.outDir` directory replaced by a plain file (14.22, the obstructed emit write path's one offending component), and separately, on a never-built workspace, with `markdown.outDir` naming the discovered finding-free spec source `specs/A.mdx` itself (14.22 whose one offending component is a discovered file, every emit destination lying below that plain file), `view` of the finding-free file — in the third fixture `specs/A.mdx` itself, a concerned path naming a domain file's own finding for condition 19 alone (11.2) — answers complete and finding-free at exit 0, writing nothing — the state surfaces through `build` (exactly the gate condition; a failing build modifies nothing) and `check` (in every fixture exactly the gate condition — a workspace failing `build`'s validations, a journal error and a refused write alike (13.3), leaves 14.10's mismatch forms, the deleted emission and the never-generated derived files included, unreported, and neither whatever-validity form is staged: the record, where a build wrote one, stays readable and every recorded derived path still generated (14.10) — concerning the journal path, and the offending component, `mdout` and `specs/A.mdx`), and through the gated reads (T13.3-3), never these answers; findings of no domain file attach nothing on the passing side either — on a built workspace passing `build`'s validations that violates a `forbidden` rule (the offending edge's `d` spelled in `specs/A.mdx`), and separately on one holding a corrupt session of garbage bytes, `check` reports exactly the 14.12 (no location, no concerned path), respectively the 14.21 (concerning the session file), exit 1, while `occurrences`, `view specs/A.mdx`, and `at specs/A.mdx 0` each answer finding-free at exit 0, writing nothing; and, on the Linux leg, with Markdown emitted under `out` (`markdown.outDir`), a code group `app` over `src/x.ts` beside the spec group, and no glob reaching below `out`, the built emit directory `out` staged mode 000 around each run (the harness's own listing of `out` and examination of `out/specs` verified refused), on the passing side and, `specs/A.mdx` then given a section spelling no `id` (14.1), on the failing side, `view specs/A.mdx`, `occurrences`, `at specs/A.mdx 0`, `build`, `check`, `ids`, and `query nodes` each exit 2 with the error document alone — `code` `read-failure`, `path` `out` or a path below it — nothing modified, the judgement coming past every argument check: `view specs/nope.mdx`, `view src/x.ts`, `at specs/A.mdx <length+1>`, `show specs/A.mdx#nope`, `query nodes --group app`, `coverage nope`, and `review status nope` each exit 2 with the plain usage error, `code` and `path` `null`, never `read-failure`, nothing modified — and, the permission restored, `build` on the passing side exits 0 and `check` is clean; the passing-workspace refresh participation is T13.3-2's sweep and the failing-side answering discipline T11.2-1's (SPEC 11.2, 13.3, 13.4, 7.3, 7.5, 12.0, 12.1, 12.2, 12.7, 14.12, 14.13, 14.21, 14.22, 14.25, 14.10)",
  run: async (product) => {
    // --- Fixture 1: garbage journal line (14.13) --------------------------
    {
      const workspace = await TestWorkspace.create({
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          [C_FILE]: C_STAGED,
        },
      });
      try {
        const context = "T11.2-6 (garbage journal)";
        await buildOk(
          product,
          workspace,
          `${context} staging \`build\` — a passing build, so derived ` +
            `files and graph data exist and match before the journal is ` +
            `garbaged (SPEC 12.1)`,
        );
        await workspace.file(JOURNAL_PATH, T11_2_6_GARBAGE_LINE);

        // The state surfaces through `build`: exactly the staged gate
        // condition, concerning the journal path (SPEC 14.13, 14, 12.1).
        const buildContext = `${context} \`build --json\``;
        await assertLeavesUnchanged(
          workspace.root,
          async () => {
            const result = await expectExit(
              product,
              workspace,
              ["build", "--json"],
              1,
              `${buildContext} — journal errors are among \`build\`'s ` +
                `validations (SPEC 12.1, 13.3, 14.13)`,
            );
            const findings = decodeFindingsReport(
              parseJsonStdout(result, buildContext),
              buildContext,
            ).findings;
            assertConditionCounts(
              findings,
              { "14.13": 1 },
              `${buildContext} — exactly the staged gate condition: the ` +
                `pre-built otherwise-valid workspace stages nothing else, ` +
                `and \`build\` cannot observe staleness (SPEC 14.13, 12.1)`,
            );
            assertFindingConcernsPath(
              findings[0]!,
              JOURNAL_PATH,
              `${buildContext} — a journal condition carries the journal ` +
                `path it concerns (SPEC 14, 12.7)`,
            );
          },
          `${buildContext} — a failing build modifies nothing, the garbage ` +
            `journal included (SPEC 12.1, 6.1)`,
        );

        // ...and through `check` (SPEC 12.2, 14.13): exactly the gate
        // condition. The workspace fails `build`'s validations (journal
        // errors alike, SPEC 13.3), so 14.10's mismatch forms — per file
        // and graph data — are undetectable and go unreported (SPEC 14.10),
        // and the two forms reported whatever the validity have nothing
        // here: the record the passing build wrote stays readable (no 14.23
        // state) and every recorded derived path is still generated (no
        // recorded-file form). No phantom staleness is accepted beside the
        // journal error (the module comment).
        const checkContext = `${context} \`check --json\``;
        await assertLeavesUnchanged(
          workspace.root,
          async () => {
            const result = await expectExit(
              product,
              workspace,
              ["check", "--json"],
              1,
              `${checkContext} — \`check\` performs all build validations, ` +
                `journal errors included (SPEC 12.2, 14.13)`,
            );
            const findings = decodeFindingsReport(
              parseJsonStdout(result, checkContext),
              checkContext,
            ).findings;
            assertConditionCounts(
              findings,
              { "14.13": 1 },
              `${checkContext} — exactly the journal error: the workspace ` +
                `fails \`build\`'s validations, so 14.10's mismatch forms ` +
                `go unreported, and neither whatever-validity form is ` +
                `staged — the record readable, every recorded path still ` +
                `generated (SPEC 12.2, 14.13, 13.3, 14.10)`,
            );
            assertFindingConcernsPath(
              findings[0]!,
              JOURNAL_PATH,
              `${checkContext} — the journal condition's concerned path ` +
                `(SPEC 14, 12.7)`,
            );
          },
          `${checkContext} — \`check\` writes nothing (SPEC 12.2, 13.3)`,
        );

        // ...never this answer: `view` of the finding-free file (SPEC 11.2).
        await assertViewFindingFree(
          product,
          workspace,
          C_FILE,
          C_TREE,
          `${context} \`view ${C_FILE}\``,
        );
      } finally {
        await workspace.dispose();
      }
    }

    // --- Fixture 2: obstructed write path (14.22) -------------------------
    {
      const workspace = await TestWorkspace.create({
        files: {
          "xspec.config.ts": T11_2_6_OUTDIR_CONFIG,
          [C_FILE]: C_STAGED,
        },
      });
      try {
        const context = "T11.2-6 (obstructed write path)";
        await buildOk(
          product,
          workspace,
          `${context} staging \`build\` — emits under markdown.outDir ` +
            `(SPEC 7.3, 13.2, 12.1)`,
        );

        // Staging premises (T13.3-3's arm-2 discipline): emission landed
        // under mdout/ preserving workspace-relative paths (SPEC 7.3,
        // 13.2), so mdout is a component of a path `build` writes.
        const mdoutKind = await workspace.kind(T11_2_6_OUTDIR);
        if (mdoutKind !== "dir") {
          fail(
            `${context}: staging premise — \`build\` with emission enabled ` +
              `under markdown.outDir creates the mdout/ directory (SPEC ` +
              `7.3, 13.2, 13.4); found ${mdoutKind}`,
          );
        }
        const emittedKind = await workspace.kind(T11_2_6_EMITTED);
        if (emittedKind !== "file") {
          fail(
            `${context}: staging premise — emission under outDir preserves ` +
              `workspace-relative paths, so ${C_FILE} emits ` +
              `${T11_2_6_EMITTED} (SPEC 7.3, 13.2); found ${emittedKind}`,
          );
        }

        // Obstruct: replace the directory with a plain file. The emitted
        // Markdown goes with it — a per-file mismatch `check` leaves
        // unreported on a workspace failing `build`'s validations, refused
        // writes included (SPEC 14.10, 13.3), and invisible to `build`,
        // which refuses at the obstruction (SPEC 13.4, 14.22).
        await fsp.rm(workspace.path(T11_2_6_OUTDIR), {
          recursive: true,
          force: true,
        });
        await workspace.file(T11_2_6_OUTDIR, "not a directory\n");

        // The state surfaces through `build`: exactly the one condition-22
        // finding — one finding per distinct offending component —
        // concerning the component's workspace-relative path, and the
        // refusal precedes every write (SPEC 14.22, 13.4, 12.1).
        const buildContext = `${context} \`build --json\``;
        await assertLeavesUnchanged(
          workspace.root,
          async () => {
            const result = await expectExit(
              product,
              workspace,
              ["build", "--json"],
              1,
              `${buildContext} — a command refuses the obstructed write ` +
                `and reports it (SPEC 14.22, 13.4)`,
            );
            const findings = decodeFindingsReport(
              parseJsonStdout(result, buildContext),
              buildContext,
            ).findings;
            assertConditionCounts(
              findings,
              { "14.22": 1 },
              `${buildContext} — exactly the one offending component, and ` +
                `\`build\` cannot observe the deleted emission's staleness ` +
                `(SPEC 14.22, 12.1)`,
            );
            assertFindingConcernsPath(
              findings[0]!,
              T11_2_6_OUTDIR,
              `${buildContext} — the refused write's concerned path is the ` +
                `offending component's workspace-relative path (SPEC ` +
                `14.22, 13.4)`,
            );
          },
          `${buildContext} — the write is refused before anything is ` +
            `modified (SPEC 14.22, 12.1)`,
        );

        // ...and through `check`: exactly the obstruction. The swap's
        // deleted emission is a per-file mismatch, and a workspace whose
        // `build` is refused fails `build`'s validations (SPEC 13.3), where
        // 14.10's mismatch forms are undetectable and go unreported (SPEC
        // 14.10); the record stays readable and every recorded derived
        // path still generated, so neither whatever-validity form is
        // staged (module header).
        const checkContext = `${context} \`check --json\``;
        await assertLeavesUnchanged(
          workspace.root,
          async () => {
            const result = await expectExit(
              product,
              workspace,
              ["check", "--json"],
              1,
              `${checkContext} — \`check\` reports the obstruction without ` +
                `writing (SPEC 12.2, 14.22)`,
            );
            const findings = decodeFindingsReport(
              parseJsonStdout(result, checkContext),
              checkContext,
            ).findings;
            assertConditionCounts(
              findings,
              { "14.22": 1 },
              `${checkContext} — exactly the obstructed component: a ` +
                `refused write fails \`build\`'s validations, so the ` +
                `deleted ${T11_2_6_EMITTED} is a per-file mismatch 14.10 ` +
                `leaves unreported there, and the readable record with ` +
                `every recorded path still generated stages neither form ` +
                `reported whatever the validity (SPEC 14.22, 13.3, 14.10, ` +
                `12.2, 14)`,
            );
            assertFindingConcernsPath(
              findings[0]!,
              T11_2_6_OUTDIR,
              `${checkContext} — the refused write's concerned path (SPEC ` +
                `14.22, 13.4)`,
            );
          },
          `${checkContext} — \`check\` writes nothing (SPEC 12.2, 13.3)`,
        );

        // ...never this answer: `view` of the very file whose emission
        // path is obstructed (SPEC 11.2 — the condition's concerned path
        // is the component, never the source file).
        await assertViewFindingFree(
          product,
          workspace,
          C_FILE,
          C_TREE,
          `${context} \`view ${C_FILE}\``,
        );
      } finally {
        await workspace.dispose();
      }
    }

    // --- Fixture 3: the obstructing component is a discovered file (14.22) --
    {
      const workspace = await TestWorkspace.create({
        files: {
          "xspec.config.ts": T11_2_6_SOURCE_OUTDIR_CONFIG,
          [A_FILE]: C_STAGED,
          [C_FILE]: C_STAGED,
        },
      });
      try {
        const context = "T11.2-6 (obstructing component a discovered file)";

        // Never built: the refusal precedes every write of the command's
        // own (SPEC 14.22, 12.1), so `build` writes no module, companion,
        // Markdown, or graph data here — the whole-root compare sees any.
        const buildContext = `${context} \`build --json\``;
        await assertLeavesUnchanged(
          workspace.root,
          async () => {
            const result = await expectExit(
              product,
              workspace,
              ["build", "--json"],
              1,
              `${buildContext} — every emit destination lies below the ` +
                `plain file ${A_FILE}, a workspace-relative directory ` +
                `component occupied by a non-directory: the write is ` +
                `refused and reported; the spelling is a well-formed ` +
                `outDir, no configuration error (SPEC 14.22, 13.4, 7.3)`,
            );
            const findings = decodeFindingsReport(
              parseJsonStdout(result, buildContext),
              buildContext,
            ).findings;
            assertConditionCounts(
              findings,
              { "14.22": 1 },
              `${buildContext} — one finding per distinct offending ` +
                `component whatever write paths it refuses: both refused ` +
                `destinations share the component ${A_FILE}, and the ` +
                `valid sources stage nothing else (SPEC 14.22, 12.1)`,
            );
            assertFindingConcernsPath(
              findings[0]!,
              A_FILE,
              `${buildContext} — the concerned path is the offending ` +
                `component's workspace-relative path: the discovered ` +
                `source itself (SPEC 14.22, 13.4)`,
            );
          },
          `${buildContext} — the write is refused before any write of the ` +
            `command's own: no module, companion, Markdown, or graph data ` +
            `written, the source byte-unchanged (SPEC 14.22, 12.1)`,
        );

        // `check` judges exactly `build`'s write paths (SPEC 14.22, 12.2):
        // exactly the obstruction. The workspace fails `build`'s
        // validations (a refused write, SPEC 13.3), so the unemittable
        // destinations, the never-generated modules, and the absent graph
        // data are 14.10's mismatch forms, undetectable and unreported
        // there (SPEC 14.10), and no record exists for its two
        // whatever-validity forms (module header); writing nothing.
        const checkContext = `${context} \`check --json\``;
        await assertLeavesUnchanged(
          workspace.root,
          async () => {
            const result = await expectExit(
              product,
              workspace,
              ["check", "--json"],
              1,
              `${checkContext} — \`check\` judges \`build\`'s write paths ` +
                `and reports the obstruction without writing (SPEC 14.22, ` +
                `12.2)`,
            );
            const findings = decodeFindingsReport(
              parseJsonStdout(result, checkContext),
              checkContext,
            ).findings;
            assertConditionCounts(
              findings,
              { "14.22": 1 },
              `${checkContext} — exactly the one offending component: on ` +
                `this never-built workspace whose \`build\` is refused, ` +
                `14.10's mismatch forms go unreported and no record exists ` +
                `for its whatever-validity forms (SPEC 14.22, 13.3, 14.10, ` +
                `12.2)`,
            );
            assertFindingConcernsPath(
              findings[0]!,
              A_FILE,
              `${checkContext} — the refused write's concerned path is the ` +
                `discovered source occupying the component (SPEC 14.22, ` +
                `13.4)`,
            );
          },
          `${checkContext} — \`check\` writes nothing (SPEC 12.2, 13.3)`,
        );

        // ...never this answer: `view` of the discovered file that IS the
        // obstructing component. Its concerned path names the requested
        // file, and still the finding is no domain file's — a concerned
        // path names a domain file's own finding for condition 19 alone
        // (SPEC 11.2) — so the answer is complete and finding-free at exit
        // 0, served from the current sources, nothing written.
        await assertViewFindingFree(
          product,
          workspace,
          A_FILE,
          cShapedTreeAt(A_FILE),
          `${context} \`view ${A_FILE}\``,
        );
      } finally {
        await workspace.dispose();
      }
    }

    // --- Fixtures 4 and 5: the passing side (14.12, 14.21) -----------------
    // Findings of no domain file attach nothing on a workspace passing
    // `build`'s validations either: `check` reports the finding, the three
    // surfaces answer finding-free (SPEC 11.2, 14.12, 14.21).
    for (const staging of T11_2_6_PASSING_SIDE_STAGINGS) {
      const context = `T11.2-6 (passing side: ${staging.arm})`;
      const workspace = await staging.stage(product, context);
      try {
        await expectCheckReportsStagedFinding(
          product,
          workspace,
          staging,
          context,
        );
        await assertPassingSideAnswersFindingFree(
          product,
          workspace,
          staging,
          context,
        );
      } finally {
        await workspace.dispose();
      }
    }

    // --- Fixture 6: the judgement's reads, `out` unreadable (14.25) --------
    if (T11_2_6_MODE_STAGED) {
      const workspace = await TestWorkspace.create({
        files: {
          "xspec.config.ts": T11_2_6_UNREADABLE_EMIT_CONFIG,
          [A_FILE]: C_STAGED,
          [T11_2_6_CODE_FILE]: T11_2_6_CODE_SOURCE,
        },
      });
      try {
        const context = "T11.2-6 (unreadable emit directory)";
        await buildOk(
          product,
          workspace,
          `${context} staging \`build\` — emits under markdown.outDir, so ` +
            `out holds a prior build's emission (SPEC 7.3, 13.2, 12.1)`,
        );
        // Staging premises: the emission landed under out/ preserving
        // workspace-relative paths (SPEC 7.3, 13.2), so out/specs is a
        // directory component of every emit destination.
        const premises: readonly (readonly [string, string])[] = [
          [T11_2_6_EMIT_DIR, "dir"],
          [`${T11_2_6_EMIT_DIR}/${T11_2_6_EMIT_COMPONENT}`, "dir"],
          [T11_2_6_EMITTED_A, "file"],
        ];
        for (const [rel, kind] of premises) {
          const found = await workspace.kind(rel);
          if (found !== kind) {
            fail(
              `${context}: staging premise — \`build\` with emission ` +
                `enabled under markdown.outDir emits ${A_FILE} as ` +
                `${T11_2_6_EMITTED_A}, so ${rel} is a ${kind} (SPEC 7.3, ` +
                `13.2); found ${found}`,
            );
          }
        }

        // The passing side.
        await runEmitDirectoryUnreadableSide(
          product,
          workspace,
          C_SOURCE,
          `${context} (passing side)`,
        );

        // The permission restored (each staging was undone as its run
        // ended): `build` exits 0 and `check` is clean (SPEC 12.1, 12.2).
        await buildOk(
          product,
          workspace,
          `${context} \`build\` once the permission is restored — the ` +
            `passing side builds (SPEC 12.1)`,
        );
        await expectFindingFreeReport(
          product,
          workspace,
          ["check", "--json"],
          `${context} \`check --json\` once the permission is restored — ` +
            `clean (SPEC 12.2)`,
        );

        // The failing side: `specs/A.mdx` restaged with a section spelling
        // no `id` after the build, so out still holds its emission;
        // premise — `build` reports exactly the staged condition-1 finding,
        // writing nothing (SPEC 12.1, 14.1).
        await workspace.file(A_FILE, T11_2_6_ID_LESS_SOURCE);
        const premiseContext = `${context} failing-side premise \`build --json\``;
        await assertLeavesUnchanged(
          workspace.root,
          async () => {
            const findings = await runFindingsReport(
              product,
              workspace,
              ["build", "--json"],
              1,
              `${premiseContext} — the restaged source fails \`build\`'s ` +
                `validations (SPEC 12.1, 14.1)`,
            );
            assertConditionCounts(
              findings,
              { "14.1": 1 },
              `${premiseContext} — exactly the staged section spelling no ` +
                `\`id\` (SPEC 14.1, 1.3)`,
            );
          },
          `${premiseContext} — a failing build modifies nothing (SPEC 12.1)`,
        );
        await runEmitDirectoryUnreadableSide(
          product,
          workspace,
          T11_2_6_ID_LESS_SOURCE_TEXT,
          `${context} (failing side)`,
        );
      } finally {
        await workspace.dispose();
      }
    }
  },
});

// ---------------------------------------------------------------------------
// T11.2-7 — removal by form
// ---------------------------------------------------------------------------
//
// SPEC 11.2 (expanded text): the removal classification of 3 is by
// syntactic form, never by validity or resolution — every import
// declaration is removed whatever its binding shape, specifier validity, and
// target discovery; a section tag is removed with every attribute it spells,
// unknown, repeated, and spread included; and an export statement, matching
// no removal rule's form, is content, preserved byte-for-byte and located by
// its finding (14.16). T11.2-4 stages the deleted-target import and the
// stray element, T2.3-3 the invalid containers; this entry stages the rest,
// three arms, one failing workspace each. Every workspace holds
// `specs/A.mdx`, a discovered spec source holding `a` — so each `./A.xspec`
// specifier below designates a discovered spec source and its import fails
// by binding shape alone — beside the arm's own `specs/B.mdx`:
// (a) a root-level ESM block of four imports, one per line — the named
//     `import { a } from "./A.xspec"`, the namespace
//     `import * as N from "./A.xspec"`, the side-effect-only
//     `import "./A.xspec"`, and the bare-specifier `import X from "x"` —
//     each a 14.15 finding (2.1: not a single default binding; a specifier
//     that is no relative `.xspec` path), followed by the section `b`;
// (b) three sections whose opening tags spell an unknown attribute
//     (`<S id="u" foo="1">`), a repeated one (`<S id="r" tags="t" tags="t">`),
//     and a spread (`<S id="p" {...q}>`), each a 14.17 finding (2.7) — every
//     section still spelling exactly one quoted `id`, so its identity stays
//     defined (11.2);
// (c) one ESM block holding `import A from "./A.xspec"` (valid, its binding
//     unused: 2.1, records no edges), U+000A, `export const x = 1`, U+000A —
//     the export statement a 14.16 finding — followed by the section `c`.
//
// Operationalization (noted per H-3/H-4):
// - Each arm runs bare `view --text`: the whole discovered domain, so the
//   answer carries A's view (finding-free) and B's, B's findings alone
//   accompanying, exit 1 (11.2). The findings are pinned form-exact in 12.7
//   order — stable code, every location's file and exact range, concerned
//   path `null` — at the ranges SPEC 14 fixes: an import condition (14.15)
//   at the declaration's own characters (the import range of 11.4, no
//   terminator), an attribute condition (14.17) at the attribute's own
//   characters (the attribute range of 11.4; a spread its whole braced
//   construct), a repeated prop locating every attribute spelling the name
//   in one finding, and an export statement (14.16) whole, no terminator.
// - Every node of both views is projected to its identity, construct range,
//   own text, and subtree text (`projectTextNode`, T11.2-4's projection) and
//   compared with a pinned tree whose text values are hand-derived per the
//   rules of 3 (the derivation comments beside each arm) — never computed
//   from the staging; ranges are composed from the parts that stage the
//   file and sliced back out of its bytes before any product runs (the
//   T5.7-2 discipline). Import entries and attribute entries stay at their
//   home tests (T11.4-4, T11.4-3), their forms decode-validated (H-3); the
//   occurrence and comment lists are pinned empty (no reference or comment
//   is staged).
// - Every staged source is a staged-source record (S-9: the body's later
//   workspaces follow its first invocations), well-formed MDX: each ESM
//   block holds import and export declarations alone and stands between
//   blank lines (an ESM block interrupts no paragraph and runs to a blank
//   line), and the arms' bindings — `a`, `N`, `X`, and `A`, `x` — are
//   pairwise distinct, so no early error and no collision (2.4) arises.

/** One T11.2-7 arm: its `specs/B.mdx` record, composed ranges, and pins. */
interface RemovalByFormArm {
  readonly label: string;
  readonly source: string;
  /** The staged bytes as a ledger record (S-9's before-any-product clause). */
  readonly staged: StagedMdx;
  /** The ranges composed with the file, each with the text it must slice to. */
  readonly slices: readonly {
    readonly range: SourceRange;
    readonly text: string;
    readonly what: string;
  }[];
  readonly conditionCounts: Readonly<Record<string, number>>;
  /** B's findings, form-exact, in 12.7 order (by code, then locations). */
  readonly findings: readonly FindingProjection[];
  readonly findingsWhat: string;
  readonly textTree: TextTreeExpectation;
  readonly textWhat: string;
}

// specs/A.mdx, every arm's import target. Text derivation (SPEC 3, 1.6): the
// title line and the blank line after it stay; a's tag lines hold nothing
// but removed tags and drop with their terminators — its `</S>` line taking
// the root's terminator after it along — so a contributes its body line and
// the root's own run ends at the blank line.
const RBF_TARGET = new ByteFixture();
RBF_TARGET.add("Prélude — the import target holding a.\n\n");
const RBF_TARGET_A_TEXT = '<S id="a">\nA text.\n</S>';
const RBF_TARGET_A_RANGE = RBF_TARGET.add(RBF_TARGET_A_TEXT);
RBF_TARGET.add("\n");
const RBF_TARGET_SOURCE = RBF_TARGET.source;
const RBF_TARGET_STAGED = stagedMdx(
  "T11.2-7 specs/A.mdx (every arm's import target, holding a)",
  RBF_TARGET_SOURCE,
);
const RBF_TARGET_ROOT_OWN = "Prélude — the import target holding a.\n\n";
const RBF_TARGET_A_OWN = "A text.\n";
const RBF_TARGET_TEXT_TREE: TextTreeExpectation = {
  identity: A_FILE,
  range: { start: 0, end: RBF_TARGET.pos },
  ownText: RBF_TARGET_ROOT_OWN,
  subtreeText: RBF_TARGET_ROOT_OWN + RBF_TARGET_A_OWN,
  children: [
    {
      identity: `${A_FILE}#a`,
      range: RBF_TARGET_A_RANGE,
      ownText: RBF_TARGET_A_OWN,
      subtreeText: RBF_TARGET_A_OWN,
      children: [],
    },
  ],
};

// (a) every import form. Text derivation: the title line and the blank line
// after it stay; each of the four import lines holds nothing but its
// declaration, removed by form whatever its validity, so each drops WITH its
// terminator; the blank line closing the ESM block stays; b's tag lines
// drop (its `</S>` line taking the root's final terminator along), b
// contributing its body line.
const RBF_A = new ByteFixture();
const RBF_A_TITLE = "Prélude — removal by form: every import form.\n";
RBF_A.add(RBF_A_TITLE + "\n");
const RBF_A_NAMED = 'import { a } from "./A.xspec"';
const RBF_A_NAMED_RANGE = RBF_A.add(RBF_A_NAMED);
RBF_A.add("\n");
const RBF_A_NAMESPACE = 'import * as N from "./A.xspec"';
const RBF_A_NAMESPACE_RANGE = RBF_A.add(RBF_A_NAMESPACE);
RBF_A.add("\n");
const RBF_A_SIDE_EFFECT = 'import "./A.xspec"';
const RBF_A_SIDE_EFFECT_RANGE = RBF_A.add(RBF_A_SIDE_EFFECT);
RBF_A.add("\n");
const RBF_A_BARE = 'import X from "x"';
const RBF_A_BARE_RANGE = RBF_A.add(RBF_A_BARE);
RBF_A.add("\n\n");
const RBF_A_B_TEXT = '<S id="b">\nB body.\n</S>';
const RBF_A_B_RANGE = RBF_A.add(RBF_A_B_TEXT);
RBF_A.add("\n");
const RBF_A_B_OWN = "B body.\n";
//   root own      title LF, the blank line before the block, the blank line
//                 after it — no byte of any declaration, no line of the block
const RBF_A_ROOT_OWN = RBF_A_TITLE + "\n" + "\n";
const RBF_ARM_A: RemovalByFormArm = {
  label: "(a) every import form",
  source: RBF_A.source,
  staged: stagedMdx(
    "T11.2-7 (a) specs/B.mdx (a root-level ESM block: named, namespace, side-effect-only, and bare-specifier imports)",
    RBF_A.source,
  ),
  slices: [
    { range: RBF_A_NAMED_RANGE, text: RBF_A_NAMED, what: "the named import" },
    {
      range: RBF_A_NAMESPACE_RANGE,
      text: RBF_A_NAMESPACE,
      what: "the namespace import",
    },
    {
      range: RBF_A_SIDE_EFFECT_RANGE,
      text: RBF_A_SIDE_EFFECT,
      what: "the side-effect-only import",
    },
    {
      range: RBF_A_BARE_RANGE,
      text: RBF_A_BARE,
      what: "the bare-specifier import",
    },
    { range: RBF_A_B_RANGE, text: RBF_A_B_TEXT, what: "section b" },
  ],
  conditionCounts: { "14.15": 4 },
  findings: [
    locatedAt("invalid-import", B_FILE, RBF_A_NAMED_RANGE),
    locatedAt("invalid-import", B_FILE, RBF_A_NAMESPACE_RANGE),
    locatedAt("invalid-import", B_FILE, RBF_A_SIDE_EFFECT_RANGE),
    locatedAt("invalid-import", B_FILE, RBF_A_BARE_RANGE),
  ],
  findingsWhat:
    "four invalid-import findings in document order, each located at its " +
    "declaration's own characters (the import range of 11.4, no terminator)",
  textTree: {
    identity: B_FILE,
    range: { start: 0, end: RBF_A.pos },
    ownText: RBF_A_ROOT_OWN,
    subtreeText: RBF_A_ROOT_OWN + RBF_A_B_OWN,
    children: [
      {
        identity: `${B_FILE}#b`,
        range: RBF_A_B_RANGE,
        ownText: RBF_A_B_OWN,
        subtreeText: RBF_A_B_OWN,
        children: [],
      },
    ],
  },
  textWhat:
    "every import declaration removed by form — binding shape, specifier " +
    "validity, and target discovery notwithstanding — so no byte of any " +
    "declaration is in the root's own or subtree text, and each import line, " +
    "left empty purely by its removal, is dropped together with its " +
    "terminator; b's own and subtree text its body line",
};

// (b) every attribute with its tag. Text derivation: each section's opening
// tag line holds nothing but the tag — every attribute it spells removed
// with it, unknown, repeated, and spread alike — and drops with its
// terminator, as does each `</S>` line, taking the root's terminator after
// it along; so each section contributes its body line alone, and the root's
// own runs are the title line, the blank line after it, and the blank lines
// between the sections.
const RBF_B = new ByteFixture();
const RBF_B_TITLE =
  "Prélude — removal by form: every attribute with its tag.\n";
RBF_B.add(RBF_B_TITLE + "\n");
const RBF_B_U_START = RBF_B.pos;
RBF_B.add('<S id="u" ');
const RBF_B_FOO = 'foo="1"';
const RBF_B_FOO_RANGE = RBF_B.add(RBF_B_FOO);
RBF_B.add(">\nU body.\n</S>");
const RBF_B_U_RANGE: SourceRange = { start: RBF_B_U_START, end: RBF_B.pos };
RBF_B.add("\n\n");
const RBF_B_R_START = RBF_B.pos;
RBF_B.add('<S id="r" ');
const RBF_B_TAGS = 'tags="t"';
const RBF_B_TAGS_FIRST_RANGE = RBF_B.add(RBF_B_TAGS);
RBF_B.add(" ");
const RBF_B_TAGS_SECOND_RANGE = RBF_B.add(RBF_B_TAGS);
RBF_B.add(">\nR body.\n</S>");
const RBF_B_R_RANGE: SourceRange = { start: RBF_B_R_START, end: RBF_B.pos };
RBF_B.add("\n\n");
const RBF_B_P_START = RBF_B.pos;
RBF_B.add('<S id="p" ');
const RBF_B_SPREAD = "{...q}";
const RBF_B_SPREAD_RANGE = RBF_B.add(RBF_B_SPREAD);
RBF_B.add(">\nP body.\n</S>");
const RBF_B_P_RANGE: SourceRange = { start: RBF_B_P_START, end: RBF_B.pos };
RBF_B.add("\n");
const RBF_B_U_OWN = "U body.\n";
const RBF_B_R_OWN = "R body.\n";
const RBF_B_P_OWN = "P body.\n";
//   root own      title LF, the blank line after it, the blank line after u,
//                 the blank line after r — no byte of any tag
//   root subtree  title LF, LF, U body. LF, LF, R body. LF, LF, P body. LF
const RBF_B_ROOT_OWN = RBF_B_TITLE + "\n" + "\n" + "\n";
const RBF_B_ROOT_SUBTREE =
  RBF_B_TITLE + "\n" + RBF_B_U_OWN + "\n" + RBF_B_R_OWN + "\n" + RBF_B_P_OWN;
const RBF_ARM_B: RemovalByFormArm = {
  label: "(b) every attribute with its tag",
  source: RBF_B.source,
  staged: stagedMdx(
    "T11.2-7 (b) specs/B.mdx (opening tags spelling an unknown, a repeated, and a spread attribute)",
    RBF_B.source,
  ),
  slices: [
    { range: RBF_B_FOO_RANGE, text: RBF_B_FOO, what: "u's unknown attribute" },
    {
      range: RBF_B_TAGS_FIRST_RANGE,
      text: RBF_B_TAGS,
      what: "r's first tags attribute",
    },
    {
      range: RBF_B_TAGS_SECOND_RANGE,
      text: RBF_B_TAGS,
      what: "r's second tags attribute",
    },
    {
      range: RBF_B_SPREAD_RANGE,
      text: RBF_B_SPREAD,
      what: "p's spread attribute",
    },
    {
      range: RBF_B_U_RANGE,
      text: `<S id="u" ${RBF_B_FOO}>\nU body.\n</S>`,
      what: "section u",
    },
    {
      range: RBF_B_R_RANGE,
      text: `<S id="r" ${RBF_B_TAGS} ${RBF_B_TAGS}>\nR body.\n</S>`,
      what: "section r",
    },
    {
      range: RBF_B_P_RANGE,
      text: `<S id="p" ${RBF_B_SPREAD}>\nP body.\n</S>`,
      what: "section p",
    },
  ],
  conditionCounts: { "14.17": 3 },
  findings: [
    locatedAt("invalid-prop", B_FILE, RBF_B_FOO_RANGE),
    {
      code: "invalid-prop",
      locations: [
        { file: B_FILE, range: RBF_B_TAGS_FIRST_RANGE },
        { file: B_FILE, range: RBF_B_TAGS_SECOND_RANGE },
      ],
      path: null,
    },
    locatedAt("invalid-prop", B_FILE, RBF_B_SPREAD_RANGE),
  ],
  findingsWhat:
    "three invalid-prop findings — u's unknown attribute, r's repeated " +
    "`tags` (one finding locating both of its spellings), and p's spread — " +
    "each located at the attribute's own characters (the attribute range " +
    "of 11.4; the spread its whole braced construct)",
  textTree: {
    identity: B_FILE,
    range: { start: 0, end: RBF_B.pos },
    ownText: RBF_B_ROOT_OWN,
    subtreeText: RBF_B_ROOT_SUBTREE,
    children: [
      {
        identity: `${B_FILE}#u`,
        range: RBF_B_U_RANGE,
        ownText: RBF_B_U_OWN,
        subtreeText: RBF_B_U_OWN,
        children: [],
      },
      {
        identity: `${B_FILE}#r`,
        range: RBF_B_R_RANGE,
        ownText: RBF_B_R_OWN,
        subtreeText: RBF_B_R_OWN,
        children: [],
      },
      {
        identity: `${B_FILE}#p`,
        range: RBF_B_P_RANGE,
        ownText: RBF_B_P_OWN,
        subtreeText: RBF_B_P_OWN,
        children: [],
      },
    ],
  },
  textWhat:
    "each section tag removed whole with every attribute it spells — " +
    "unknown, repeated, and spread alike — so each section's own and " +
    "subtree text is its body line alone and the root's subtree text " +
    "carries those bodies in place with no byte of either tag, every tag " +
    "line dropped with its terminator; each identity defined (exactly one " +
    "quoted id on each tag, 11.2)",
};

// (c) an export is content. Text derivation: the title line and the blank
// line after it stay; the import line holds nothing but its declaration and
// drops with its terminator; the export statement matches no removal rule's
// form, so its line stays byte-for-byte, its terminator included; the blank
// line closing the ESM block stays; c's tag lines drop, c contributing its
// body line.
const RBF_C = new ByteFixture();
const RBF_C_TITLE = "Prélude — removal by form: an export is content.\n";
RBF_C.add(RBF_C_TITLE + "\n");
const RBF_C_IMPORT = 'import A from "./A.xspec"';
const RBF_C_IMPORT_RANGE = RBF_C.add(RBF_C_IMPORT);
RBF_C.add("\n");
const RBF_C_EXPORT = "export const x = 1";
const RBF_C_EXPORT_RANGE = RBF_C.add(RBF_C_EXPORT);
RBF_C.add("\n\n");
const RBF_C_C_TEXT = '<S id="c">\nC body.\n</S>';
const RBF_C_C_RANGE = RBF_C.add(RBF_C_C_TEXT);
RBF_C.add("\n");
const RBF_C_C_OWN = "C body.\n";
//   root own      title LF, LF, `export const x = 1` LF, LF
const RBF_C_ROOT_OWN = RBF_C_TITLE + "\n" + RBF_C_EXPORT + "\n" + "\n";
const RBF_ARM_C: RemovalByFormArm = {
  label: "(c) an export is content",
  source: RBF_C.source,
  staged: stagedMdx(
    "T11.2-7 (c) specs/B.mdx (an export statement on the line after an import in one ESM block)",
    RBF_C.source,
  ),
  slices: [
    { range: RBF_C_IMPORT_RANGE, text: RBF_C_IMPORT, what: "the import" },
    {
      range: RBF_C_EXPORT_RANGE,
      text: RBF_C_EXPORT,
      what: "the export statement",
    },
    { range: RBF_C_C_RANGE, text: RBF_C_C_TEXT, what: "section c" },
  ],
  conditionCounts: { "14.16": 1 },
  findings: [locatedAt("invalid-construct", B_FILE, RBF_C_EXPORT_RANGE)],
  findingsWhat:
    "exactly one invalid-construct finding, located at the export statement " +
    "whole (its terminator excluded) — no 14.15: the import is valid, its " +
    "unused binding colliding with nothing",
  textTree: {
    identity: B_FILE,
    range: { start: 0, end: RBF_C.pos },
    ownText: RBF_C_ROOT_OWN,
    subtreeText: RBF_C_ROOT_OWN + RBF_C_C_OWN,
    children: [
      {
        identity: `${B_FILE}#c`,
        range: RBF_C_C_RANGE,
        ownText: RBF_C_C_OWN,
        subtreeText: RBF_C_C_OWN,
        children: [],
      },
    ],
  },
  textWhat:
    "the import's line dropped with its terminator while the export " +
    "statement — matching no removal rule's form — is content, its line " +
    "preserved byte-for-byte, terminator included, in the root's own and " +
    "subtree text; c's own and subtree text its body line",
};

const RBF_ARMS: readonly RemovalByFormArm[] = [RBF_ARM_A, RBF_ARM_B, RBF_ARM_C];

const T11_2_7 = defineProductTest({
  id: "T11.2-7",
  title:
    'removal of expanded text is classified by syntactic form, never by validity — each arm its own failing workspace beside `specs/A.mdx`, a discovered spec source holding `a`, under bare `view --text` (exit 1; the arm file\'s findings form-exact in 12.7 order; every node\'s identity, construct range, and own and subtree text byte-asserted against precomputed values, A\'s view finding-free): (a) a root-level ESM block holding, one per line, the named `import { a } from "./A.xspec"`, the namespace `import * as N from "./A.xspec"`, the side-effect-only `import "./A.xspec"`, and the bare-specifier `import X from "x"` — four 14.15 findings, each at its declaration — every declaration absent from the root\'s own and subtree text, each line dropped with its terminator; (b) sections whose opening tags spell an unknown attribute (`<S id="u" foo="1">`), a repeated one (`<S id="r" tags="t" tags="t">`, its one finding locating both spellings), and a spread (`<S id="p" {...q}>`) — three 14.17 findings, each at its attribute spellings — each tag removed whole with every attribute it spells: each section\'s own text its body alone, the root\'s subtree text carrying the bodies in place with no byte of either tag; (c) `import A from "./A.xspec"`, U+000A, `export const x = 1`, U+000A in one ESM block — one 14.16 finding at the export statement whole — the import\'s line dropped and the export\'s line preserved byte-for-byte, its terminator included, in the root\'s own and subtree text — failing a product that classifies imports by validity, keeps an invalid tag\'s attributes as content, or removes export declarations with the imports (SPEC 11.2, 11.4, 1.6, 2.1, 2.7, 3, 12.7, 14)',
  run: async (product) => {
    // Fixture self-checks (T5.7-2 discipline): composed ranges sliced back
    // out of the staged bytes before any product invocation.
    sliceCheck(
      RBF_TARGET_SOURCE,
      RBF_TARGET_A_RANGE,
      RBF_TARGET_A_TEXT,
      "T11.2-7 specs/A.mdx: section a",
    );
    for (const arm of RBF_ARMS) {
      for (const slice of arm.slices) {
        sliceCheck(
          arm.source,
          slice.range,
          slice.text,
          `T11.2-7 ${arm.label}: ${slice.what}`,
        );
      }
    }

    for (const arm of RBF_ARMS) {
      const workspace = await TestWorkspace.create({
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          [A_FILE]: RBF_TARGET_STAGED,
          [B_FILE]: arm.staged,
        },
      });
      try {
        const context = `T11.2-7 bare \`view --text\` (${arm.label})`;
        const result = await expectExit(
          product,
          workspace,
          ["view", "--text"],
          1,
          `${context} — specs/B.mdx's findings accompany, so exit 1 with ` +
            `the full answer emitted (SPEC 11.2)`,
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
          arm.conditionCounts,
          `${context} — exactly the staged conditions accompany, all ` +
            `specs/B.mdx's (specs/A.mdx is finding-free; SPEC 11.2, 14)`,
        );
        assertSameJson(
          report.findings.map(projectFinding),
          arm.findings,
          `${context} — specs/B.mdx's findings, form-exact in 12.7 order: ` +
            `${arm.findingsWhat} (SPEC 14, 12.7)`,
        );
        assertSameJson(
          report.views.map((view) => view.file),
          [A_FILE, B_FILE],
          `${context} — one per-file view per discovered spec source, in ` +
            `path-byte order (SPEC 11.4)`,
        );
        const targetView = report.views[0]!;
        const armView = report.views[1]!;
        assertSameJson(
          projectTextNode(targetView.root),
          RBF_TARGET_TEXT_TREE,
          `${context} — the import target specs/A.mdx: its text values ` +
            `defined and byte-exact (SPEC 11.4, 1.6, 3)`,
        );
        assertSameJson(
          projectTextNode(armView.root),
          arm.textTree,
          `${context} — specs/B.mdx's text values against their ` +
            `precomputed bytes: ${arm.textWhat} (SPEC 11.2, 1.6, 3)`,
        );
        assertSameJson(
          [
            targetView.occurrences,
            targetView.comments,
            armView.occurrences,
            armView.comments,
          ],
          [[], [], [], []],
          `${context} — no reference and no comment staged: empty ` +
            `occurrence and comment lists, never null (SPEC 5.7, 12.7)`,
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
  T11_2_5,
  T11_2_6,
  T11_2_7,
];
