// TEST-SPEC §5.7 (reference occurrences) — SUITE-51: T5.7-1, T5.7-2, T5.7-3.
// The section's remaining test (T5.7-4) registers here as it is implemented.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), decodes output through the H-3 adapters —
// the `occurrences` document (SPEC 11.3) is a form-exact 12.7 surface decoded
// literally with no adapter in the path and, being JSON-only (SPEC 11), no
// `--json` flag — and rejects a product only via diagnosed assertion failures
// (H-8).
//
// SPEC 5.7: a reference occurrence is one textual spelling of a
// dependency-kind reference whose target resolves — one `d` reference (each
// entry of a `d` array separately, never the array or the prop, 2.2), one MDX
// `{text(...)}` embedding (2.3), one TypeScript `text(...)` call (4.3), or
// one TypeScript dependency marker (4.5). Edges are sets; occurrences are the
// positions behind them: duplicate references that collapse to a single edge
// each remain distinct occurrences at distinct ranges. Byte-precise
// occurrence spans are T5.7-2's subject; full record data — the source graph
// node as one identity-plus-range datum — and the total deterministic order
// are T5.7-3's; T5.7-1 asserts the units — record cardinality per staged
// construct, each record's edge kind — and the duplicate contrast, so its
// occurrence-record assertions compare complete (file, kind, source, target)
// multisets, order-free, with ranges consulted only for the duplicates'
// distinctness.

import { Buffer } from "node:buffer";
import type {
  DependencyEdgeKind,
  GraphEdge,
  OccurrenceRecord,
  OccurrenceSourceNode,
  SourceRange,
} from "../../helpers/adapters/index.js";
import {
  decodeEdgesReport,
  decodeOccurrencesReport,
  renderPathValue,
} from "../../helpers/adapters/index.js";
import {
  assertBytesEqual,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import {
  assertEdgeSetEqual,
  assertSameJson,
  buildOk,
  expectExit,
  runJson,
} from "./support.js";

// One spec group plus one code group (SPEC 7.2): TypeScript files under
// `src/` are discovered code sources, so `build` analyzes their spec-module
// usage (4.3, 4.5) — the TS half of the occurrence kinds.
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

// ---------------------------------------------------------------------------
// T5.7-1 — units and duplicates
// ---------------------------------------------------------------------------

// The imported spec source: `a` with child `a.b` (the duplicate pair's
// target, TEST-SPEC's literal `d={[BASE.a.b, BASE.a.b]}` spelling) and
// `other`, so the three-entry array has distinct external targets.
const T5_7_1_BASE_SOURCE = [
  '<S id="a">',
  "Alpha text.",
  "",
  '<S id="a.b">',
  "Alpha B text.",
  "</S>",
  "</S>",
  "",
  '<S id="other">',
  "Other text.",
  "</S>",
  "",
].join("\n");

// The main spec source, one section per staged MDX occurrence unit:
// - `tri`: a three-entry `d` array mixing the external chain and local
//   string forms (2.2 permits mixing) — one occurrence per ENTRY, so a
//   product recording one occurrence for the array or for the prop reports
//   1 where 3 are expected;
// - `solo`: a single-reference `d` (no array) — exactly one occurrence;
// - `emb`: an MDX `{text(...)}` embedding — exactly one occurrence, kind
//   `embeds`;
// - `dup`: TEST-SPEC's duplicate pair `d={[BASE.a.b, BASE.a.b]}` — one
//   edge, two occurrences at distinct ranges.
const T5_7_1_MAIN_SOURCE = [
  'import BASE from "./BASE.xspec"',
  "",
  '<S id="peer">',
  "Peer text.",
  "</S>",
  "",
  '<S id="tri" d={[BASE.a, "peer", BASE.other]}>',
  "Tri text.",
  "</S>",
  "",
  '<S id="solo" d={"peer"}>',
  "Solo text.",
  "</S>",
  "",
  '<S id="emb">',
  "Emb: {text(BASE.a.b)}",
  "</S>",
  "",
  '<S id="dup" d={[BASE.a.b, BASE.a.b]}>',
  "Dup text.",
  "</S>",
  "",
].join("\n");

// The TypeScript side, one named function per staged unit (SPEC 4.6 makes
// the source attribution determinate): a `text(...)` call (kind `embeds`),
// a single marker (kind `references`), and the twice-spelled marker — one
// edge, two occurrences at distinct ranges. The import declaration records
// no edge and no occurrence (SPEC 2.1, 5.7).
const T5_7_1_APP_SOURCE = [
  'import SPEC, { text } from "../specs/MAIN.xspec";',
  "",
  "export function useText(): string {",
  "  return text(SPEC.emb);",
  "}",
  "",
  "export function once(): void {",
  "  SPEC.tri;",
  "}",
  "",
  "export function twice(): void {",
  "  SPEC.dup;",
  "  SPEC.dup;",
  "}",
  "",
].join("\n");

const BASE_FILE = "specs/BASE.mdx";
const MAIN_FILE = "specs/MAIN.mdx";
const APP_FILE = "src/app.ts";
const A_ID = "specs/BASE.mdx#a";
const AB_ID = "specs/BASE.mdx#a.b";
const OTHER_ID = "specs/BASE.mdx#other";
const PEER_ID = "specs/MAIN.mdx#peer";
const TRI_ID = "specs/MAIN.mdx#tri";
const SOLO_ID = "specs/MAIN.mdx#solo";
const EMB_ID = "specs/MAIN.mdx#emb";
const DUP_ID = "specs/MAIN.mdx#dup";
const USE_TEXT_LOCATION = "src/app.ts#useText";
const ONCE_LOCATION = "src/app.ts#once";
const TWICE_LOCATION = "src/app.ts#twice";

/** One expected occurrence unit: its identifying data and record count. */
interface OccurrenceUnit {
  readonly what: string;
  readonly file: string;
  readonly kind: DependencyEdgeKind;
  readonly source: string;
  readonly target: string;
  /** How many records the staged spelling(s) of this unit produce. */
  readonly count: number;
}

// The workspace's complete expected occurrence multiset — 11 records. Every
// record's (file, kind, source, target) tuple is determinate from the staging
// (SPEC 5.7, 4.6, 5.4), and no two staged units share a tuple, so the
// order-free multiset comparison individuates every unit: a missing,
// phantom, per-array, per-prop, uncollapsed-edge-shaped, or mis-kinded
// record fails with the offending tuple named.
const T5_7_1_UNITS: readonly OccurrenceUnit[] = [
  {
    what: "three-entry `d` array, entry 1 (external chain `BASE.a`)",
    file: MAIN_FILE,
    kind: "depends",
    source: TRI_ID,
    target: A_ID,
    count: 1,
  },
  {
    what: 'three-entry `d` array, entry 2 (local string `"peer"`)',
    file: MAIN_FILE,
    kind: "depends",
    source: TRI_ID,
    target: PEER_ID,
    count: 1,
  },
  {
    what: "three-entry `d` array, entry 3 (external chain `BASE.other`)",
    file: MAIN_FILE,
    kind: "depends",
    source: TRI_ID,
    target: OTHER_ID,
    count: 1,
  },
  {
    what: "single-reference `d` (no array)",
    file: MAIN_FILE,
    kind: "depends",
    source: SOLO_ID,
    target: PEER_ID,
    count: 1,
  },
  {
    what: "MDX `{text(...)}` embedding",
    file: MAIN_FILE,
    kind: "embeds",
    source: EMB_ID,
    target: AB_ID,
    count: 1,
  },
  {
    what: "duplicate `d={[BASE.a.b, BASE.a.b]}` — two entries, one edge",
    file: MAIN_FILE,
    kind: "depends",
    source: DUP_ID,
    target: AB_ID,
    count: 2,
  },
  {
    what: "TS `text(...)` call",
    file: APP_FILE,
    kind: "embeds",
    source: USE_TEXT_LOCATION,
    target: EMB_ID,
    count: 1,
  },
  {
    what: "TS marker, spelled once",
    file: APP_FILE,
    kind: "references",
    source: ONCE_LOCATION,
    target: TRI_ID,
    count: 1,
  },
  {
    what: "twice-spelled TS marker — two spellings, one edge",
    file: APP_FILE,
    kind: "references",
    source: TWICE_LOCATION,
    target: DUP_ID,
    count: 2,
  },
];

// The workspace's complete edge set (SPEC 5.2): document structure gives the
// `contains` edges, and each dependency-kind unit above gives exactly ONE
// edge — the duplicate `d` pair and the twice-spelled marker collapsed
// (edges are sets), so the exact-set comparison pins the collapse side of
// the duplicate contrast (T2.2-3's and T5.2-1's home subject, asserted here
// against the same staging the occurrence records answer over).
const T5_7_1_EXPECTED_EDGES: readonly GraphEdge[] = [
  { from: BASE_FILE, to: A_ID, kind: "contains" },
  { from: A_ID, to: AB_ID, kind: "contains" },
  { from: BASE_FILE, to: OTHER_ID, kind: "contains" },
  { from: MAIN_FILE, to: PEER_ID, kind: "contains" },
  { from: MAIN_FILE, to: TRI_ID, kind: "contains" },
  { from: MAIN_FILE, to: SOLO_ID, kind: "contains" },
  { from: MAIN_FILE, to: EMB_ID, kind: "contains" },
  { from: MAIN_FILE, to: DUP_ID, kind: "contains" },
  { from: TRI_ID, to: A_ID, kind: "depends" },
  { from: TRI_ID, to: PEER_ID, kind: "depends" },
  { from: TRI_ID, to: OTHER_ID, kind: "depends" },
  { from: SOLO_ID, to: PEER_ID, kind: "depends" },
  { from: DUP_ID, to: AB_ID, kind: "depends" },
  { from: EMB_ID, to: AB_ID, kind: "embeds" },
  { from: USE_TEXT_LOCATION, to: EMB_ID, kind: "embeds" },
  { from: ONCE_LOCATION, to: TRI_ID, kind: "references" },
  { from: TWICE_LOCATION, to: DUP_ID, kind: "references" },
];

/**
 * Render one decoded record's identifying tuple for the order-free multiset
 * comparison. Every staged path is valid UTF-8 and every source identity is
 * defined (11.2), so a marked byte-form file or an unavailable source renders
 * to a value no expected tuple matches and fails the comparison visibly.
 */
function renderOccurrenceUnit(record: OccurrenceRecord): string {
  const source =
    "unavailable" in record.source
      ? "(source unavailable)"
      : record.source.identity;
  return `${renderPathValue(record.file)} [${record.kind}] ${source} -> ${record.target}`;
}

/** The expected multiset, each unit expanded to its count, sorted. */
function expectedUnitMultiset(units: readonly OccurrenceUnit[]): string[] {
  return units
    .flatMap((unit) =>
      Array<string>(unit.count).fill(
        `${unit.file} [${unit.kind}] ${unit.source} -> ${unit.target}`,
      ),
    )
    .sort();
}

/**
 * A duplicate pair's occurrence side: exactly two records carry the unit's
 * (file, kind, source, target) tuple, and their ranges are distinct — the
 * two spellings collapse to one edge yet remain two distinct occurrences at
 * distinct ranges (SPEC 5.7). Distinct-span totality over the whole document
 * is already decode-enforced (12.7 occurrence order); this assertion names
 * the duplicate subject when a product merges the pair's positions.
 */
function assertDuplicateOccurrencePair(
  records: readonly OccurrenceRecord[],
  unit: OccurrenceUnit,
  context: string,
): void {
  const pair = records.filter(
    (record) =>
      renderPathValue(record.file) === unit.file &&
      record.kind === unit.kind &&
      !("unavailable" in record.source) &&
      record.source.identity === unit.source &&
      record.target === unit.target,
  );
  if (pair.length !== 2) {
    fail(
      `${context}: the ${unit.what} must yield exactly two occurrence ` +
        `records for ${unit.file} [${unit.kind}] ${unit.source} -> ` +
        `${unit.target} (SPEC 5.7: duplicates collapse to one edge yet ` +
        `remain distinct occurrences); got ${String(pair.length)}: ` +
        JSON.stringify(pair),
    );
  }
  const [first, second] = pair as [OccurrenceRecord, OccurrenceRecord];
  if (
    first.range.start === second.range.start &&
    first.range.end === second.range.end
  ) {
    fail(
      `${context}: the ${unit.what}'s two occurrence records must lie at ` +
        `distinct ranges — distinct spellings occupy distinct spans (SPEC ` +
        `5.7); both report ${JSON.stringify(first.range)}`,
    );
  }
}

const T5_7_1 = defineProductTest({
  id: "T5.7-1",
  title:
    "one workspace spells every occurrence kind — a three-entry `d` array, a single-reference `d`, an MDX `{text(...)}`, a TS `text(...)` call, a TS marker — and `occurrences` reports one occurrence per `d` array entry (never one for the array or the prop) and one per embedding, call, and marker, each carrying its edge kind; the duplicate `d={[BASE.a.b, BASE.a.b]}` and a twice-spelled marker collapse to one edge each yet remain two distinct occurrences each, at distinct ranges (SPEC 5.7, 2.2, 5.2, 11.3)",
  run: async (product) => {
    const workspace = await TestWorkspace.create({
      files: {
        "xspec.config.ts": SPEC_AND_CODE_CONFIG,
        "specs/BASE.mdx": T5_7_1_BASE_SOURCE,
        "specs/MAIN.mdx": T5_7_1_MAIN_SOURCE,
        "src/app.ts": T5_7_1_APP_SOURCE,
      },
    });
    try {
      // Premise: the workspace is valid — every staged reference is a
      // sanctioned spelling that resolves — so the enumeration below is
      // complete and finding-free (11.2, 11.3).
      await buildOk(
        product,
        workspace,
        "T5.7-1 `build` (premise: every staged reference resolves and the workspace is valid)",
      );

      const context = "T5.7-1 `occurrences`";
      const report = decodeOccurrencesReport(
        await runJson(product, workspace, ["occurrences"], context),
        context,
      );
      assertSameJson(
        report.findings,
        [],
        `${context}: the consulted domain (the entire discovered set, no ` +
          `\`--file\`) carries no finding (SPEC 11.2, 11.3)`,
      );

      // The complete record multiset: one record per `d` array entry —
      // never one for the array or the prop (2.2) — one per embedding,
      // call, and marker, each carrying its edge kind, and exactly two for
      // each duplicate pair. Order-free (the occurrence ORDER is T5.7-3's
      // subject; the decode already enforces it as 12.7 form).
      assertSameJson(
        report.occurrences.map(renderOccurrenceUnit).sort(),
        expectedUnitMultiset(T5_7_1_UNITS),
        `${context}: the complete (file, [kind], source -> target) record ` +
          `multiset — one occurrence per \`d\` array entry, never one for ` +
          `the array or the prop (SPEC 2.2, 5.7); one per MDX embedding, ` +
          `TS call, and marker, each carrying its edge kind (5.2); two per ` +
          `duplicate pair — so 1-per-array, 1-per-prop, dropped-duplicate, ` +
          `phantom-import, or mis-kinded reporting all fail`,
      );

      // The duplicate contrast's occurrence side: two distinct records at
      // distinct ranges for each collapsed pair.
      const dupUnit = T5_7_1_UNITS.find((unit) => unit.source === DUP_ID)!;
      const twiceUnit = T5_7_1_UNITS.find(
        (unit) => unit.source === TWICE_LOCATION,
      )!;
      assertDuplicateOccurrencePair(report.occurrences, dupUnit, context);
      assertDuplicateOccurrencePair(report.occurrences, twiceUnit, context);

      // The duplicate contrast's edge side: the same staging's complete
      // edge set, the duplicate `d` pair and the twice-spelled marker each
      // collapsed to a single edge (SPEC 5.2: edges are sets; occurrences
      // are the positions behind them).
      const edgesContext = "T5.7-1 unfiltered `query edges`";
      assertEdgeSetEqual(
        decodeEdgesReport(
          await runJson(product, workspace, ["query", "edges"], edgesContext),
          edgesContext,
        ),
        T5_7_1_EXPECTED_EDGES,
        `${edgesContext}: the workspace's complete edge set — the duplicate ` +
          `\`d\` entries and the twice-spelled marker collapse to one edge ` +
          `each while remaining two occurrences each (SPEC 2.2, 5.2, 5.7)`,
      );
    } finally {
      await workspace.dispose();
    }
  },
});

// ---------------------------------------------------------------------------
// T5.7-2 — byte-precise spans per kind
// ---------------------------------------------------------------------------

// Occurrence spans are exact per kind (SPEC 5.7): a `d` occurrence spans that
// one reference's own expression; an MDX embedding occurrence spans the
// entire `{text(...)}` expression container, brace through brace; a TS
// `text(...)` occurrence spans the whole call expression, callee through
// closing parenthesis; a marker occurrence spans the bare reference chain
// alone, exclusive of any statement terminator. Every expected range below is
// composed from the same string parts the staged files are — never measured
// from product output — and a fixture self-check slices each claimed range
// back out of the staged bytes before the product is invoked (the T1.7-2
// discipline), so a staging-arithmetic error fails as a harness-side
// diagnosis, never as a wrong-but-satisfiable expectation. Both referencing
// files put multi-byte UTF-8 (é: 1 code point, 2 bytes; 🦄: 1 code point / 2
// UTF-16 units / 4 bytes) before every asserted construct, so byte offsets
// diverge from code-point and UTF-16 offsets and a product counting either
// fails (SPEC 1.7).

/** UTF-8 byte length of a composed fixture part. */
function utf8Length(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

/** Byte range of `span` where it follows exactly `prefix` in a file. */
function rangeAfter(prefix: string, span: string): SourceRange {
  const start = utf8Length(prefix);
  return { start, end: start + utf8Length(span) };
}

// The referenced spec source: three top-level targets plus a nested child, so
// the marker's chain is multi-segment (`SPEC.y.leaf`) and every staged
// occurrence resolves to its own distinct target.
const SPAN_BASE_SOURCE = [
  '<S id="x">',
  "X text.",
  "</S>",
  "",
  '<S id="mid">',
  "Mid text.",
  "</S>",
  "",
  '<S id="y">',
  "Y text.",
  "",
  '<S id="y.leaf">',
  "Leaf text.",
  "</S>",
  "</S>",
  "",
].join("\n");

// specs/MAIN.mdx, composed from the exact parts the expected ranges cite. The
// `pre` section's multi-byte text shifts every later byte offset. `arr`'s
// three-entry `d` array spells whitespace on BOTH sides of each comma
// (` , `), so an entry span including any bracket, comma, or neighboring
// whitespace misses byte-precisely; `emb` holds the braced embedding.
const SPAN_MAIN_HEAD =
  'import BASE from "./BASE.xspec"\n\n<S id="pre">\nPrélude 🦄 text.\n</S>\n\n';
const SPAN_ARR_TAG_PRE = '<S id="arr" d={[';
const SPAN_ARR_ENTRY_1 = "BASE.x";
const SPAN_ARR_SEP = " , ";
const SPAN_ARR_ENTRY_2 = "BASE.mid";
const SPAN_ARR_ENTRY_3 = '"pre"';
const SPAN_ARR_TAG_POST = "]}>\nArr text.\n</S>\n\n";
const SPAN_EMB_PRE = '<S id="emb">\nEmb: ';
const SPAN_EMB_CONTAINER = "{text(BASE.y)}";
const SPAN_EMB_POST = "\n</S>\n";
const SPAN_MAIN_SOURCE =
  SPAN_MAIN_HEAD +
  SPAN_ARR_TAG_PRE +
  SPAN_ARR_ENTRY_1 +
  SPAN_ARR_SEP +
  SPAN_ARR_ENTRY_2 +
  SPAN_ARR_SEP +
  SPAN_ARR_ENTRY_3 +
  SPAN_ARR_TAG_POST +
  SPAN_EMB_PRE +
  SPAN_EMB_CONTAINER +
  SPAN_EMB_POST;

// src/app.ts: the `text` export is aliased ON IMPORT (SPEC 4.4's sanctioned
// aliasing — TEST-SPEC's aliased callee `t(...)`), and each reference
// statement wears the trivia its span must exclude — leading indentation, a
// terminating `;`, and (for the marker) a trailing comment.
const SPAN_APP_HEAD =
  '// prélude 🦄 spans\nimport SPEC, { text as t } from "../specs/BASE.xspec";\n\n';
const SPAN_CALL_PRE = "export function call(): string {\n  return ";
const SPAN_CALL_EXPR = "t(SPEC.x)";
const SPAN_CALL_POST = ";\n}\n\n";
const SPAN_MARK_PRE = "export function mark(): void {\n  ";
const SPAN_MARK_CHAIN = "SPEC.y.leaf";
const SPAN_MARK_POST = "; // trailing trivia\n}\n";
const SPAN_APP_SOURCE =
  SPAN_APP_HEAD +
  SPAN_CALL_PRE +
  SPAN_CALL_EXPR +
  SPAN_CALL_POST +
  SPAN_MARK_PRE +
  SPAN_MARK_CHAIN +
  SPAN_MARK_POST;

const SPAN_X_ID = "specs/BASE.mdx#x";
const SPAN_MID_ID = "specs/BASE.mdx#mid";
const SPAN_Y_ID = "specs/BASE.mdx#y";
const SPAN_LEAF_ID = "specs/BASE.mdx#y.leaf";
const SPAN_PRE_ID = "specs/MAIN.mdx#pre";
const SPAN_ARR_ID = "specs/MAIN.mdx#arr";
const SPAN_EMB_ID = "specs/MAIN.mdx#emb";
const SPAN_CALL_LOCATION = "src/app.ts#call";
const SPAN_MARK_LOCATION = "src/app.ts#mark";

/**
 * One staged occurrence and the exact span its record must carry. The
 * (file, kind, source, target) tuple is unique per arm in this staging, so it
 * identifies the arm's record without leaning on the report order (T5.7-3's
 * subject, decode-enforced as 12.7 form meanwhile); the source node's own
 * range datum is likewise T5.7-3's subject, consulted here only as identity.
 */
interface SpanArm {
  readonly what: string;
  /** The staged file's full content (fixture self-check ground). */
  readonly fileSource: string;
  /** The exact characters the occurrence's own range must slice to. */
  readonly span: string;
  readonly file: string;
  readonly kind: DependencyEdgeKind;
  readonly source: string;
  readonly target: string;
  /** Precomputed byte range: zero-based, start-inclusive end-exclusive. */
  readonly range: SourceRange;
}

// The complete expected enumeration — the staged references are the
// workspace's only occurrences (import declarations record none, SPEC 5.7),
// one record each, every span byte-precise.
const SPAN_ARMS: readonly SpanArm[] = [
  {
    what:
      "`d` array entry 1 (`BASE.x`) — the reference's own expression, the " +
      "opening `[` and the following ` , ` excluded (SPEC 5.7, 2.2)",
    fileSource: SPAN_MAIN_SOURCE,
    span: SPAN_ARR_ENTRY_1,
    file: "specs/MAIN.mdx",
    kind: "depends",
    source: SPAN_ARR_ID,
    target: SPAN_X_ID,
    range: rangeAfter(SPAN_MAIN_HEAD + SPAN_ARR_TAG_PRE, SPAN_ARR_ENTRY_1),
  },
  {
    what:
      "`d` array MIDDLE entry (`BASE.mid`) alone — no brackets, no commas, " +
      "no surrounding whitespace: the ` , ` on each side lies outside the " +
      "span (SPEC 5.7, 2.2)",
    fileSource: SPAN_MAIN_SOURCE,
    span: SPAN_ARR_ENTRY_2,
    file: "specs/MAIN.mdx",
    kind: "depends",
    source: SPAN_ARR_ID,
    target: SPAN_MID_ID,
    range: rangeAfter(
      SPAN_MAIN_HEAD + SPAN_ARR_TAG_PRE + SPAN_ARR_ENTRY_1 + SPAN_ARR_SEP,
      SPAN_ARR_ENTRY_2,
    ),
  },
  {
    what:
      '`d` array entry 3 (the local string `"pre"`) — the string literal ' +
      "expression's own characters, quotes included, the preceding ` , ` " +
      "and the closing `]}` excluded (SPEC 5.7, 2.2)",
    fileSource: SPAN_MAIN_SOURCE,
    span: SPAN_ARR_ENTRY_3,
    file: "specs/MAIN.mdx",
    kind: "depends",
    source: SPAN_ARR_ID,
    target: SPAN_PRE_ID,
    range: rangeAfter(
      SPAN_MAIN_HEAD +
        SPAN_ARR_TAG_PRE +
        SPAN_ARR_ENTRY_1 +
        SPAN_ARR_SEP +
        SPAN_ARR_ENTRY_2 +
        SPAN_ARR_SEP,
      SPAN_ARR_ENTRY_3,
    ),
  },
  {
    what:
      "MDX embedding — the ENTIRE braced container `{text(BASE.y)}`, " +
      "opening brace through closing brace, the whole construct Markdown " +
      "compilation replaces (SPEC 5.7, 3): a call-only span missing either " +
      "brace fails",
    fileSource: SPAN_MAIN_SOURCE,
    span: SPAN_EMB_CONTAINER,
    file: "specs/MAIN.mdx",
    kind: "embeds",
    source: SPAN_EMB_ID,
    target: SPAN_Y_ID,
    range: rangeAfter(
      SPAN_MAIN_HEAD +
        SPAN_ARR_TAG_PRE +
        SPAN_ARR_ENTRY_1 +
        SPAN_ARR_SEP +
        SPAN_ARR_ENTRY_2 +
        SPAN_ARR_SEP +
        SPAN_ARR_ENTRY_3 +
        SPAN_ARR_TAG_POST +
        SPAN_EMB_PRE,
      SPAN_EMB_CONTAINER,
    ),
  },
  {
    what:
      "TS `text(...)` call with an ALIASED callee — `t(SPEC.x)` from its " +
      "`t` through the closing parenthesis, argument included, the " +
      "terminating `;` excluded (SPEC 5.7, 4.3, 4.4)",
    fileSource: SPAN_APP_SOURCE,
    span: SPAN_CALL_EXPR,
    file: "src/app.ts",
    kind: "embeds",
    source: SPAN_CALL_LOCATION,
    target: SPAN_X_ID,
    range: rangeAfter(SPAN_APP_HEAD + SPAN_CALL_PRE, SPAN_CALL_EXPR),
  },
  {
    what:
      "TS marker — the bare reference chain `SPEC.y.leaf` alone, every " +
      "segment included, the leading indentation, terminating `;`, and " +
      "trailing comment all excluded (SPEC 5.7, 4.5)",
    fileSource: SPAN_APP_SOURCE,
    span: SPAN_MARK_CHAIN,
    file: "src/app.ts",
    kind: "references",
    source: SPAN_MARK_LOCATION,
    target: SPAN_LEAF_ID,
    range: rangeAfter(
      SPAN_APP_HEAD +
        SPAN_CALL_PRE +
        SPAN_CALL_EXPR +
        SPAN_CALL_POST +
        SPAN_MARK_PRE,
      SPAN_MARK_CHAIN,
    ),
  },
];

/**
 * Fixture self-check (harness-side, before any product invocation): the
 * precomputed range must slice the staged file's bytes to exactly the span it
 * claims. A failure here is a staging-arithmetic defect of this test, never a
 * product failure.
 */
function assertStagedSpan(arm: SpanArm): void {
  const actual = Buffer.from(arm.fileSource, "utf8")
    .subarray(arm.range.start, arm.range.end)
    .toString("utf8");
  if (actual !== arm.span) {
    fail(
      `T5.7-2 fixture self-check — ${arm.what}: the precomputed byte range ` +
        `[${String(arm.range.start)}, ${String(arm.range.end)}) slices the ` +
        `staged bytes to ${JSON.stringify(actual)}, expected ` +
        `${JSON.stringify(arm.span)} (a harness-side staging error, not a ` +
        `product failure)`,
    );
  }
}

const T5_7_2 = defineProductTest({
  id: "T5.7-2",
  title:
    "byte-precise occurrence spans per kind against precomputed offsets: a `d` occurrence spans exactly that one reference's own expression — an array's middle entry alone, no brackets, commas, or surrounding whitespace; an MDX embedding occurrence spans the entire braced container `{text(...)}`, opening brace through closing brace — the whole construct compilation replaces; a TS call occurrence spans callee through closing parenthesis, argument included — an aliased callee `t(SPEC.x)` from its `t`; a marker occurrence spans the bare reference chain alone, exclusive of the statement's terminating `;` and surrounding trivia (SPEC 5.7, 1.7, 3, 4.4, 11.3)",
  run: async (product) => {
    for (const arm of SPAN_ARMS) assertStagedSpan(arm);

    const workspace = await TestWorkspace.create({
      files: {
        "xspec.config.ts": SPEC_AND_CODE_CONFIG,
        "specs/BASE.mdx": SPAN_BASE_SOURCE,
        "specs/MAIN.mdx": SPAN_MAIN_SOURCE,
        "src/app.ts": SPAN_APP_SOURCE,
      },
    });
    try {
      // Premise: the workspace is valid — every staged reference is a
      // sanctioned spelling that resolves (the import-aliased `t` callee
      // included, SPEC 4.4) — so the enumeration below is complete and
      // finding-free (11.2, 11.3).
      await buildOk(
        product,
        workspace,
        "T5.7-2 `build` (premise: every staged reference is a sanctioned spelling that resolves)",
      );

      const context = "T5.7-2 `occurrences`";
      const report = decodeOccurrencesReport(
        await runJson(product, workspace, ["occurrences"], context),
        context,
      );
      assertSameJson(
        report.findings,
        [],
        `${context}: the consulted domain (the entire discovered set, no ` +
          `\`--file\`) carries no finding (SPEC 11.2, 11.3)`,
      );
      if (report.occurrences.length !== SPAN_ARMS.length) {
        fail(
          `${context}: expected exactly ${String(SPAN_ARMS.length)} ` +
            `occurrence records — one per staged reference; the import ` +
            `declarations record none (SPEC 5.7) — got ` +
            `${String(report.occurrences.length)}: ` +
            JSON.stringify(report.occurrences.map(renderOccurrenceUnit)),
        );
      }
      for (const arm of SPAN_ARMS) {
        const matches = report.occurrences.filter(
          (record) =>
            renderPathValue(record.file) === arm.file &&
            record.kind === arm.kind &&
            !("unavailable" in record.source) &&
            record.source.identity === arm.source &&
            record.target === arm.target,
        );
        if (matches.length !== 1) {
          fail(
            `${context}: expected exactly one record for the ${arm.what} — ` +
              `${arm.file} [${arm.kind}] ${arm.source} -> ${arm.target}; ` +
              `got ${String(matches.length)} among ` +
              JSON.stringify(report.occurrences.map(renderOccurrenceUnit)),
          );
        }
        assertSameJson(
          matches[0]!.range,
          arm.range,
          `${context} — ${arm.what}: the occurrence's own range against ` +
            `precomputed byte offsets — zero-based, start-inclusive ` +
            `end-exclusive, so code-point, UTF-16, line/column, or 1-based ` +
            `counting all fail (SPEC 1.7, 5.7)`,
        );
      }
    } finally {
      await workspace.dispose();
    }
  },
});

// ---------------------------------------------------------------------------
// T5.7-3 — record data and total deterministic order
// ---------------------------------------------------------------------------

// Each record carries the referencing file, its own range, its edge kind, its
// source graph node as ONE identity-plus-range datum — for MDX the containing
// section with its construct range (opening tag's first character through
// closing tag's last, 1.7; the ROOT with the whole-file range for a top-level
// embedding — the T8-5 shape, SPEC 1.2/2.3), for TS the innermost enclosing
// named unit with the construct binding its name, or the file (SPEC 4.6;
// T1.7-2 owns the full unit-shape matrix) — and the resolved target's
// identity. Order is total and deterministic (SPEC 5.7): by referencing file
// path BYTES, then range start, then range end. The three referencing files
// give the byte-order clause teeth: `specs/Zed.mdx` (`Z` = 0x5A) sorts before
// `specs/alpha.mdx` (`a` = 0x61) in byte order while any case-folding or
// locale collation reverses the pair, and `specs/...` sorts before `src/...`
// (`p` = 0x70 < `r` = 0x72). The complete six-record document is asserted
// per-index — every member, byte-precise ranges — against offsets composed
// from the same string parts the staged files are (the T1.7-2/T5.7-2
// discipline: multi-byte UTF-8 before every asserted construct so byte
// offsets diverge from code-point and UTF-16 counts; fixture self-checks
// slice every claimed range back out of the staged bytes AND re-derive the
// claimed sequence under the pinned comparator before the product is
// invoked). H-6: the identical command runs twice, byte-identical stdout. No
// two records share a range: the six expected ranges are pairwise distinct
// (distinct spellings occupy distinct spans, and no two sanctioned constructs
// share a span start, so the comparator's range-end leg decides no stageable
// pair — the decode enforces both the sharing rejection and the full
// comparator, range-end leg included, as 12.7 form over whatever a product
// emits).

const ORD_ZED_FILE = "specs/Zed.mdx";
const ORD_ALPHA_FILE = "specs/alpha.mdx";
const ORD_APP_FILE = "src/app.ts";
const ORD_ZIN_ID = "specs/Zed.mdx#zout.zin";
const ORD_ZLOC_ID = "specs/Zed.mdx#zloc";
const ORD_T_ID = "specs/alpha.mdx#t";
const ORD_U_ID = "specs/alpha.mdx#u";
const ORD_MID_ID = "specs/alpha.mdx#mid";
const ORD_DEEP_ID = "src/app.ts#wrap.deep";

// specs/Zed.mdx — byte-FIRST referencing file (`Z` < `a`), three occurrences
// at increasing starts: a `d` on the NESTED section `zout.zin` (the
// containing section is the innermost, its construct range strictly inside
// the parent `zout`'s), an embedding in that same nested section's content
// (same source datum), and a top-level embedding outside any section (source
// the ROOT: identity the path alone, range the entire file).
const ORD_ZED_IMPORT = 'import ALPHA from "./alpha.xspec"\n\n';
const ORD_ZED_PRELUDE = "Prélude 🦄 Zed.\n\n";
const ORD_ZED_ZOUT_OPEN = '<S id="zout">\nOuter text.\n\n';
const ORD_ZED_ZIN_TAG_PRE = '<S id="zout.zin" d={';
const ORD_ZED_ZIN_DEP = "ALPHA.t";
const ORD_ZED_ZIN_TAG_POST = "}>\nInner: ";
const ORD_ZED_ZIN_EMB = '{text("zloc")}';
const ORD_ZED_ZIN_CLOSE = "\n</S>";
const ORD_ZED_ZIN_CONSTRUCT =
  ORD_ZED_ZIN_TAG_PRE +
  ORD_ZED_ZIN_DEP +
  ORD_ZED_ZIN_TAG_POST +
  ORD_ZED_ZIN_EMB +
  ORD_ZED_ZIN_CLOSE;
const ORD_ZED_ZOUT_CLOSE = "\n</S>\n\n";
const ORD_ZED_ZLOC = '<S id="zloc">\nLocal target text.\n</S>\n\n';
const ORD_ZED_TAIL_PRE = "Tail text.\n\n";
const ORD_ZED_TAIL_EMB = "{text(ALPHA.u)}";
const ORD_ZED_SOURCE =
  ORD_ZED_IMPORT +
  ORD_ZED_PRELUDE +
  ORD_ZED_ZOUT_OPEN +
  ORD_ZED_ZIN_CONSTRUCT +
  ORD_ZED_ZOUT_CLOSE +
  ORD_ZED_ZLOC +
  ORD_ZED_TAIL_PRE +
  ORD_ZED_TAIL_EMB +
  "\n";

// specs/alpha.mdx — byte-SECOND (under a case-folding collation it would sort
// FIRST and its record would lead the enumeration): the two external targets
// `t` and `u`, plus one local-string `d` occurrence on `mid`.
const ORD_ALPHA_PRELUDE = "Prélude 🦄 alpha.\n\n";
const ORD_ALPHA_TARGETS =
  '<S id="t">\nT text.\n</S>\n\n<S id="u">\nU text.\n</S>\n\n';
const ORD_ALPHA_MID_TAG_PRE = '<S id="mid" d={';
const ORD_ALPHA_MID_DEP = '"u"';
const ORD_ALPHA_MID_TAG_POST = "}>\nMid text.\n";
const ORD_ALPHA_MID_CLOSE = "</S>";
const ORD_ALPHA_MID_CONSTRUCT =
  ORD_ALPHA_MID_TAG_PRE +
  ORD_ALPHA_MID_DEP +
  ORD_ALPHA_MID_TAG_POST +
  ORD_ALPHA_MID_CLOSE;
const ORD_ALPHA_SOURCE =
  ORD_ALPHA_PRELUDE + ORD_ALPHA_TARGETS + ORD_ALPHA_MID_CONSTRUCT + "\n";

// src/app.ts — byte-LAST (`src/` after `specs/`): a top-level marker (no
// named unit encloses it — the source is the whole-file location, identity
// the path alone, range 0..byte length) and a marker inside the NESTED
// function `deep` (the innermost enclosing named unit, chain `wrap.deep`,
// with the inner declaration's own construct range — not the enclosing
// `wrap`'s; SPEC 4.6, 1.7).
const ORD_APP_HEAD =
  '// prélude 🦄 app\nimport SPEC from "../specs/alpha.xspec";\n\n';
const ORD_APP_TOP_MARKER = "SPEC.t";
const ORD_APP_TOP_POST = ";\n\n";
const ORD_APP_WRAP_PRE = "function wrap(): void {\n  ";
const ORD_APP_DEEP_PRE = "function deep(): void {\n    ";
const ORD_APP_DEEP_MARKER = "SPEC.u";
const ORD_APP_DEEP_POST = ";\n  }";
const ORD_APP_DEEP_CONSTRUCT =
  ORD_APP_DEEP_PRE + ORD_APP_DEEP_MARKER + ORD_APP_DEEP_POST;
const ORD_APP_WRAP_POST = "\n  deep();\n}\n";
const ORD_APP_SOURCE =
  ORD_APP_HEAD +
  ORD_APP_TOP_MARKER +
  ORD_APP_TOP_POST +
  ORD_APP_WRAP_PRE +
  ORD_APP_DEEP_CONSTRUCT +
  ORD_APP_WRAP_POST;

/** One staged occurrence: its complete expected record plus self-check data. */
interface OrderArm {
  readonly what: string;
  /** The staged file's full content (self-check ground). */
  readonly fileSource: string;
  /** The exact characters the occurrence's own range must slice to. */
  readonly occurrenceSpan: string;
  /** The exact characters the source node's range must slice to. */
  readonly sourceSpan: string;
  readonly record: OccurrenceRecord & {
    readonly source: OccurrenceSourceNode;
  };
}

// The complete expected document, in occurrence order (SPEC 5.7): file path
// bytes — Zed.mdx, then alpha.mdx, then src/app.ts — then range start. The
// staged references are the workspace's only occurrences (plain sections,
// prose, and import declarations record none).
const ORD_EXPECTED: readonly OrderArm[] = [
  {
    what:
      "`d={ALPHA.t}` on the NESTED section `zout.zin` — the source datum is " +
      "the containing section itself: its identity plus its construct " +
      "range, opening tag through closing tag, strictly inside the parent " +
      "`zout`'s construct, so an outer-section attribution fails identity " +
      "AND range (SPEC 5.7, 1.7, 2.2)",
    fileSource: ORD_ZED_SOURCE,
    occurrenceSpan: ORD_ZED_ZIN_DEP,
    sourceSpan: ORD_ZED_ZIN_CONSTRUCT,
    record: {
      file: ORD_ZED_FILE,
      range: rangeAfter(
        ORD_ZED_IMPORT +
          ORD_ZED_PRELUDE +
          ORD_ZED_ZOUT_OPEN +
          ORD_ZED_ZIN_TAG_PRE,
        ORD_ZED_ZIN_DEP,
      ),
      kind: "depends",
      source: {
        identity: ORD_ZIN_ID,
        range: rangeAfter(
          ORD_ZED_IMPORT + ORD_ZED_PRELUDE + ORD_ZED_ZOUT_OPEN,
          ORD_ZED_ZIN_CONSTRUCT,
        ),
      },
      target: ORD_T_ID,
    },
  },
  {
    what:
      '`{text("zloc")}` inside the nested section\'s content — the INNERMOST ' +
      "containing section (`zout.zin`, never `zout`) sources it, carrying " +
      "the identical identity-plus-range datum as the sibling `d` " +
      "occurrence (SPEC 5.7, 1.7, 2.3)",
    fileSource: ORD_ZED_SOURCE,
    occurrenceSpan: ORD_ZED_ZIN_EMB,
    sourceSpan: ORD_ZED_ZIN_CONSTRUCT,
    record: {
      file: ORD_ZED_FILE,
      range: rangeAfter(
        ORD_ZED_IMPORT +
          ORD_ZED_PRELUDE +
          ORD_ZED_ZOUT_OPEN +
          ORD_ZED_ZIN_TAG_PRE +
          ORD_ZED_ZIN_DEP +
          ORD_ZED_ZIN_TAG_POST,
        ORD_ZED_ZIN_EMB,
      ),
      kind: "embeds",
      source: {
        identity: ORD_ZIN_ID,
        range: rangeAfter(
          ORD_ZED_IMPORT + ORD_ZED_PRELUDE + ORD_ZED_ZOUT_OPEN,
          ORD_ZED_ZIN_CONSTRUCT,
        ),
      },
      target: ORD_ZLOC_ID,
    },
  },
  {
    what:
      "top-level `{text(ALPHA.u)}` outside any section — the containing " +
      "node is the ROOT: identity the file's path alone, range the entire " +
      "file, start 0, end the byte length (SPEC 5.7, 1.2, 1.7, 2.3 — the " +
      "T8-5 root-sourced shape)",
    fileSource: ORD_ZED_SOURCE,
    occurrenceSpan: ORD_ZED_TAIL_EMB,
    sourceSpan: ORD_ZED_SOURCE,
    record: {
      file: ORD_ZED_FILE,
      range: rangeAfter(
        ORD_ZED_IMPORT +
          ORD_ZED_PRELUDE +
          ORD_ZED_ZOUT_OPEN +
          ORD_ZED_ZIN_CONSTRUCT +
          ORD_ZED_ZOUT_CLOSE +
          ORD_ZED_ZLOC +
          ORD_ZED_TAIL_PRE,
        ORD_ZED_TAIL_EMB,
      ),
      kind: "embeds",
      source: {
        identity: ORD_ZED_FILE,
        range: { start: 0, end: utf8Length(ORD_ZED_SOURCE) },
      },
      target: ORD_U_ID,
    },
  },
  {
    what:
      '`d={"u"}` (local string form) on `mid` in the byte-SECOND file — ' +
      "under a case-folding or locale collation `specs/alpha.mdx` would " +
      "sort before `specs/Zed.mdx` and this record would lead the " +
      "enumeration; file-path BYTE order places it fourth (SPEC 5.7)",
    fileSource: ORD_ALPHA_SOURCE,
    occurrenceSpan: ORD_ALPHA_MID_DEP,
    sourceSpan: ORD_ALPHA_MID_CONSTRUCT,
    record: {
      file: ORD_ALPHA_FILE,
      range: rangeAfter(
        ORD_ALPHA_PRELUDE + ORD_ALPHA_TARGETS + ORD_ALPHA_MID_TAG_PRE,
        ORD_ALPHA_MID_DEP,
      ),
      kind: "depends",
      source: {
        identity: ORD_MID_ID,
        range: rangeAfter(
          ORD_ALPHA_PRELUDE + ORD_ALPHA_TARGETS,
          ORD_ALPHA_MID_CONSTRUCT,
        ),
      },
      target: ORD_U_ID,
    },
  },
  {
    what:
      "top-level TS marker `SPEC.t` — no named unit encloses it, so the " +
      "source is the whole-file location: identity the path alone, range " +
      "the entire file (SPEC 4.6, 1.7; T1.7-2)",
    fileSource: ORD_APP_SOURCE,
    occurrenceSpan: ORD_APP_TOP_MARKER,
    sourceSpan: ORD_APP_SOURCE,
    record: {
      file: ORD_APP_FILE,
      range: rangeAfter(ORD_APP_HEAD, ORD_APP_TOP_MARKER),
      kind: "references",
      source: {
        identity: ORD_APP_FILE,
        range: { start: 0, end: utf8Length(ORD_APP_SOURCE) },
      },
      target: ORD_T_ID,
    },
  },
  {
    what:
      "marker inside the nested function `deep` — the INNERMOST enclosing " +
      "named unit sources it: identity `src/app.ts#wrap.deep` (the " +
      "dot-joined chain, outermost first) with the inner declaration's own " +
      "construct range, not the enclosing `wrap`'s (SPEC 4.6, 1.7; T1.7-2)",
    fileSource: ORD_APP_SOURCE,
    occurrenceSpan: ORD_APP_DEEP_MARKER,
    sourceSpan: ORD_APP_DEEP_CONSTRUCT,
    record: {
      file: ORD_APP_FILE,
      range: rangeAfter(
        ORD_APP_HEAD +
          ORD_APP_TOP_MARKER +
          ORD_APP_TOP_POST +
          ORD_APP_WRAP_PRE +
          ORD_APP_DEEP_PRE,
        ORD_APP_DEEP_MARKER,
      ),
      kind: "references",
      source: {
        identity: ORD_DEEP_ID,
        range: rangeAfter(
          ORD_APP_HEAD +
            ORD_APP_TOP_MARKER +
            ORD_APP_TOP_POST +
            ORD_APP_WRAP_PRE,
          ORD_APP_DEEP_CONSTRUCT,
        ),
      },
      target: ORD_U_ID,
    },
  },
];

/**
 * Fixture self-check (harness-side, before any product invocation): the
 * precomputed range must slice the staged file's bytes to exactly the span it
 * claims. A failure here is a staging-arithmetic defect of this test, never a
 * product failure.
 */
function assertOrdSpan(
  fileSource: string,
  range: SourceRange,
  span: string,
  what: string,
): void {
  const actual = Buffer.from(fileSource, "utf8")
    .subarray(range.start, range.end)
    .toString("utf8");
  if (actual !== span) {
    fail(
      `T5.7-3 fixture self-check — ${what}: the precomputed byte range ` +
        `[${String(range.start)}, ${String(range.end)}) slices the staged ` +
        `bytes to ${JSON.stringify(actual)}, expected ${JSON.stringify(span)} ` +
        `(a harness-side staging error, not a product failure)`,
    );
  }
}

/**
 * Fixture self-check: the claimed expected sequence must be strictly
 * increasing under the pinned occurrence comparator — file path bytes, then
 * range start, then range end (SPEC 5.7). This protects the ORDER the arms
 * claim exactly as the span self-checks protect their offsets: a mis-ordered
 * expectation fails harness-side, never as a wrong-but-satisfiable one.
 */
function assertOrdSequenceSorted(arms: readonly OrderArm[]): void {
  for (let i = 1; i < arms.length; i += 1) {
    const a = arms[i - 1]!.record;
    const b = arms[i]!.record;
    const byFile = Buffer.compare(
      Buffer.from(renderPathValue(a.file), "utf8"),
      Buffer.from(renderPathValue(b.file), "utf8"),
    );
    const order =
      byFile !== 0
        ? byFile
        : a.range.start !== b.range.start
          ? a.range.start - b.range.start
          : a.range.end - b.range.end;
    if (order >= 0) {
      fail(
        `T5.7-3 fixture self-check — the expected sequence is not strictly ` +
          `increasing under the pinned occurrence comparator at index ` +
          `${String(i)}: ${JSON.stringify(a)} vs ${JSON.stringify(b)} ` +
          `(a harness-side staging error, not a product failure)`,
      );
    }
  }
}

const T5_7_3 = defineProductTest({
  id: "T5.7-3",
  title:
    "each occurrence record carries the referencing file, its own range, its edge kind, its source graph node as one identity-plus-range datum — the containing section for MDX with its construct range (the root with the whole-file range for a top-level embedding), the innermost enclosing named unit or the file for TS — and the resolved target's identity; order is total and deterministic: a multi-file fixture asserts file-path BYTE order (`specs/Zed.mdx` before `specs/alpha.mdx`), then range start, then range end, byte-identical across repeated runs; no two records share a range (SPEC 5.7, 1.7, 4.6, 11.3; H-6)",
  run: async (product) => {
    for (const arm of ORD_EXPECTED) {
      assertOrdSpan(
        arm.fileSource,
        arm.record.range,
        arm.occurrenceSpan,
        `${arm.what} — the occurrence's own span`,
      );
      assertOrdSpan(
        arm.fileSource,
        arm.record.source.range,
        arm.sourceSpan,
        `${arm.what} — the source node's construct range`,
      );
    }
    assertOrdSequenceSorted(ORD_EXPECTED);

    const workspace = await TestWorkspace.create({
      files: {
        "xspec.config.ts": SPEC_AND_CODE_CONFIG,
        [ORD_ZED_FILE]: ORD_ZED_SOURCE,
        [ORD_ALPHA_FILE]: ORD_ALPHA_SOURCE,
        [ORD_APP_FILE]: ORD_APP_SOURCE,
      },
    });
    try {
      // Premise: the workspace is valid — every staged reference is a
      // sanctioned spelling that resolves (the top-level embedding and the
      // nested-function marker included) — so the enumeration below is
      // complete and finding-free (11.2, 11.3). A product disputing any
      // staging judgment fails loudly here.
      await buildOk(
        product,
        workspace,
        "T5.7-3 `build` (premise: every staged reference is sanctioned and resolves)",
      );

      const context = "T5.7-3 `occurrences`";
      const first = await expectExit(
        product,
        workspace,
        ["occurrences"],
        0,
        `${context} (first run)`,
      );
      const report = decodeOccurrencesReport(
        parseJsonStdout(first, `${context} (first run)`),
        context,
      );
      assertSameJson(
        report.findings,
        [],
        `${context}: the consulted domain (the entire discovered set, no ` +
          `\`--file\`) carries no finding (SPEC 11.2, 11.3)`,
      );
      if (report.occurrences.length !== ORD_EXPECTED.length) {
        fail(
          `${context}: expected exactly ${String(ORD_EXPECTED.length)} ` +
            `occurrence records — one per staged reference; plain sections, ` +
            `prose, and import declarations record none (SPEC 5.7) — got ` +
            `${String(report.occurrences.length)}: ` +
            JSON.stringify(report.occurrences.map(renderOccurrenceUnit)),
        );
      }
      // Per-index equality over the length-checked enumeration pins the
      // total order — file path BYTES, then range start, then range end
      // (SPEC 5.7: a case-folding collation surfaces alpha.mdx's record
      // first and fails at index 0) — along with every record member: file,
      // own range, kind, the source node's identity-plus-range datum, and
      // the target identity.
      ORD_EXPECTED.forEach((arm, index) => {
        assertSameJson(
          report.occurrences[index],
          arm.record,
          `${context} record [${String(index)}] — ${arm.what}; zero-based ` +
            `byte offsets, start-inclusive end-exclusive (SPEC 1.7)`,
        );
      });

      // H-6 determinism: the identical invocation again, byte-identical
      // stdout — order and every datum stable across repeated runs.
      const second = await expectExit(
        product,
        workspace,
        ["occurrences"],
        0,
        `${context} (second run, H-6)`,
      );
      assertBytesEqual(
        second.stdoutBytes,
        first.stdoutBytes,
        `${context}: stdout of the second run vs the first — the ` +
          `enumeration is total and deterministic, byte-identical across ` +
          `repeated runs (SPEC 5.7, H-6)`,
      );
    } finally {
      await workspace.dispose();
    }
  },
});

/** TEST-SPEC §5.7, in canonical ID order (SUITE-51). */
export const section57Tests: readonly ProductTestEntry[] = [
  T5_7_1,
  T5_7_2,
  T5_7_3,
];
