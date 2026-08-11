// TEST-SPEC §5.7 (reference occurrences) — SUITE-51: T5.7-1. The section's
// remaining tests (T5.7-2, T5.7-3, T5.7-4) register here as they are
// implemented.
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
// occurrence spans are T5.7-2's subject and full record data with the total
// order T5.7-3's; T5.7-1 asserts the units — record cardinality per staged
// construct, each record's edge kind — and the duplicate contrast, so its
// occurrence-record assertions compare complete (file, kind, source, target)
// multisets, order-free, with ranges consulted only for the duplicates'
// distinctness.

import type {
  DependencyEdgeKind,
  GraphEdge,
  OccurrenceRecord,
} from "../../helpers/adapters/index.js";
import {
  decodeEdgesReport,
  decodeOccurrencesReport,
  renderPathValue,
} from "../../helpers/adapters/index.js";
import { fail } from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import {
  assertEdgeSetEqual,
  assertSameJson,
  buildOk,
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

/** TEST-SPEC §5.7, in canonical ID order (SUITE-51). */
export const section57Tests: readonly ProductTestEntry[] = [T5_7_1];
