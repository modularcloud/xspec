// TEST-SPEC §11.3 (`xspec occurrences`) — SUITE-53: T11.3-1, T11.3-2, and
// T11.3-3.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), and rejects a product only via diagnosed
// assertion failures (H-8). SPEC 11: `occurrences` is JSON-only — a single
// JSON document is its only output form, with or without `--json` — in the
// form-exact 12.7 document form (H-3), so every invocation below runs bare
// and its entire stdout decodes through `decodeOccurrencesReport`, which
// enforces the record form (exactly `{"file", "range", "kind", "source",
// "target"}`, the source datum `{"identity", "range"}` or the unavailability
// marker, never `null`) and the occurrence order (SPEC 5.7: file path bytes,
// then range start, then range end; identical spans rejected) over whatever
// the product emits.
//
// T11.3-1 runs over fixtures OWNED ELSEWHERE and imported, never copied, so
// the stagings cannot drift: the four T5.7-* workspaces
// (registry/section-5.7.ts — TEST-SPEC §11.3's "over the T5.7-* fixtures")
// and the two source-side unavailability stagings, T11.2-3's invalid-path
// code source and T11.2-4's resolution-matrix spec source
// (registry/section-11.2.ts). What this test adds over those homes is the
// §11.3 enumeration contract per fixture: the COMPLETE record sequence
// asserted PER INDEX in occurrence order — T5.7-1 and T5.7-4 pin their
// records as order-free multisets; here the same records are order-pinned —
// with each datum's value pinned at the precision the owning fixture
// composes: identity-level tuples for T5.7-1's eleven and T5.7-4's three
// records (their two ranges enforced as present well-formed 12.7 range
// forms by the decode; byte-precision for spans and source constructs is
// T5.7-2's and T5.7-3's subject), byte-precise own ranges for T5.7-2's six
// arms, and every 5.7 datum byte-precise for T5.7-3's six records and both
// unavailability stagings. Exits follow 11.2 (asserted per arm: 0 for the
// complete finding-free enumerations, 1 wherever findings or unavailable
// datums accompany); the imperfect stagings' finding detail (windows,
// identities) stays at its homes — here each answer's findings are pinned
// as exact condition-count multisets (staging integrity riding the answer
// itself), plus the code/path projection for the code-source arm's single
// path-level finding.
//
// T11.3-2 owns its two fixtures (nothing imports them): a failing
// three-source workspace whose per-file findings are pairwise distinct
// conditions (one 14.5 in specs/apple.mdx, one 14.3 in specs/beta.mdx, one
// 14.8 in src/app.ts — the `build --json` gate pins the multiset and homes
// before any `--file` arm, so every domain assertion stands on staged
// ground), each file also holding occurrences, plus an UNDISCOVERED
// on-disk decoy (docs/note.mdx, deliberately unparseable, in no configured
// group); and a valid three-spec-file workspace for the `--file`/`--to`
// conjunction. Domain membership is the subject, so records are pinned as
// per-index identity-level tuples (each staged (file, kind, source,
// target) tuple unique; ranges and order enforced by the decode); the
// exit-2 arms ride T11.2-5's exported usage-error protocol
// (registry/section-11.2.ts).
//
// T11.3-3 owns its two fixtures. (1) The acceptance ground (failing on
// purpose): SPEC 11.3 makes `--to` acceptance purely syntactic — only a
// malformed spelling is a usage error (12.0; T12.0-9's partition states the
// same exception) — so every well-formed spelling naming an identity that
// does not currently resolve is ACCEPTED and selects the empty set while the
// domain's findings stay on the answer, exit 1, never exit 2. The workspace
// stages one resolving occurrence (so each empty selection is the filter's
// doing, pinned by a bare-enumeration staging arm, never a product that
// enumerates nothing) beside the three non-resolving grounds the TEST-SPEC
// names — an undiscovered on-disk file (valid content whose occurrence a
// configuration-blind product would resolve and select), a masked file
// (14.20; its pre-breakage sections and reference spellings recorded by a
// recovering product), and duplicate bearers (14.3) with an ambiguous
// reference to them (14.5; recorded by a winner-picking product) — plus the
// no-such-node spellings in both syntactic forms. Malformed spellings ride
// T11.2-5's exported usage-error protocol on this same failing workspace
// (the argument checks precede answering, whatever findings the workspace
// carries); each malformed arm spells its defect over the DISCOVERED
// specs/OK.mdx path where the form allows, so a resolve-first product that
// finds the file and answers (empty or otherwise) instead of erring is
// discriminated — TEST-SPEC's parenthetical `a#b..c`/`a#then`/`a.mdx#`
// spellings give the malformed classes, not byte-exact operands (the
// FP-018/T6.5-4 `b.mdx#` precedent). (2) The exact-selection ground
// (valid): a two-file workspace whose four records make every mis-selection
// nonempty-visible — a resolving identity selects the occurrences targeting
// it (both edge kinds), never its descendant's records and never the
// root's, and a bare path selects exactly the module-form root reference
// (T2.2-2), never the file's section-targeted records.

import { Buffer } from "node:buffer";
import type {
  Finding,
  OccurrenceRecord,
  PathValue,
  SourceRange,
} from "../../helpers/adapters/index.js";
import { decodeOccurrencesReport } from "../../helpers/adapters/index.js";
import { fail, parseJsonStdout } from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { assertLeavesUnchanged } from "../../helpers/snapshot.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { OccurrenceUnit } from "./section-5.7.js";
import {
  APP_FILE,
  BASE_FILE,
  MAIN_FILE,
  NO_OCC_APP_SOURCE,
  NO_OCC_BASE_SOURCE,
  NO_OCC_EXPECTED_CONDITIONS,
  NO_OCC_MAIN_SOURCE,
  NO_OCC_SPARE_FILE,
  NO_OCC_SPARE_SOURCE,
  NO_OCC_UNITS,
  ORD_ALPHA_FILE,
  ORD_ALPHA_SOURCE,
  ORD_APP_FILE,
  ORD_APP_SOURCE,
  ORD_EXPECTED,
  ORD_ZED_FILE,
  ORD_ZED_SOURCE,
  SPAN_ARMS,
  SPAN_APP_SOURCE,
  SPAN_BASE_SOURCE,
  SPAN_MAIN_SOURCE,
  SPEC_AND_CODE_CONFIG,
  T5_7_1_APP_SOURCE,
  T5_7_1_BASE_SOURCE,
  T5_7_1_MAIN_SOURCE,
  T5_7_1_UNITS,
} from "./section-5.7.js";
import {
  CS_EXPECTED_OCCURRENCES,
  CS_FILE,
  CS_SOURCE,
  expectAvailabilityUsageError,
  OK_FILE,
  OK_SOURCE,
  R_CONDITION_COUNTS,
  R_EXPECTED_OCCURRENCES,
  R_FILE,
  R_SOURCE,
  SPEC_AND_CODE_CONFIG as AVAILABILITY_SPEC_AND_CODE_CONFIG,
  SPECS_ONLY_CONFIG,
} from "./section-11.2.js";
import {
  assertConditionCounts,
  assertFindingLocated,
  assertSameJson,
  buildFindings,
  buildOk,
  expectExit,
  runJson,
} from "./support.js";

/** The 12.7 unavailability marker, as decoded (one-datum state). */
const UNAVAILABLE = { unavailable: true } as const;

/**
 * A record's identity-level projection: every 5.7 datum except the two byte
 * ranges (the occurrence's own and the source node's), whose presence and
 * form the decode has already enforced on every record and whose byte-exact
 * values are pinned by the arms whose fixtures compose them. The `source`
 * member projects to the source node's identity — or the unavailability
 * marker, exactly as served.
 */
interface RecordTuple {
  readonly file: PathValue;
  readonly kind: OccurrenceRecord["kind"];
  readonly source: string | typeof UNAVAILABLE;
  readonly target: string;
}

function projectTuple(record: OccurrenceRecord): RecordTuple {
  return {
    file: record.file,
    kind: record.kind,
    source:
      "unavailable" in record.source ? UNAVAILABLE : record.source.identity,
    target: record.target,
  };
}

/**
 * A unit table's expected tuple sequence, each unit expanded to its record
 * count IN TABLE POSITION — the tables are exported in occurrence order
 * (their stated contract in section-5.7.ts), so the expansion is the
 * complete per-index expectation. A same-tuple duplicate pair (T5.7-1's
 * `dup` entries and its twice-spelled marker) expands to adjacent equal
 * tuples — exactly where the pinned comparator places the pair's two
 * distinct spans within one file.
 */
function expandUnits(units: readonly OccurrenceUnit[]): RecordTuple[] {
  return units.flatMap((unit) =>
    Array.from({ length: unit.count }, () => ({
      file: unit.file,
      kind: unit.kind,
      source: unit.source,
      target: unit.target,
    })),
  );
}

/**
 * Fixture self-check (harness-side, before any product invocation): a
 * claimed byte range must slice the staged file's bytes to exactly the span
 * it claims (the T5.7-2/T1.7-2 discipline). A failure here is a
 * staging-arithmetic defect of the harness, never a product failure.
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
      `T11.3-1 fixture self-check — ${what}: the claimed byte range ` +
        `[${String(range.start)}, ${String(range.end)}) slices the staged ` +
        `bytes to ${JSON.stringify(actual)}, expected ` +
        `${JSON.stringify(span)} (a harness-side staging error, not a ` +
        `product failure)`,
    );
  }
}

/**
 * Fixture self-check: a claimed expected sequence must be strictly
 * increasing under the pinned occurrence comparator — file path bytes, then
 * range start, then range end (SPEC 5.7) — so a mis-ordered expectation
 * fails harness-side, never as a wrong-but-satisfiable one. Every staged
 * fixture here uses plain-string (valid-UTF-8) paths; a non-string claimed
 * file is itself a staging defect.
 */
function assertClaimedOrder(
  claimed: readonly { readonly file: PathValue; readonly range: SourceRange }[],
  what: string,
): void {
  const fileBytes = (file: PathValue, index: number): Buffer => {
    if (typeof file !== "string") {
      fail(
        `T11.3-1 fixture self-check — ${what}: claimed record ` +
          `${String(index)} carries a non-string file; the shared fixtures ` +
          `stage plain valid-UTF-8 paths only (a harness-side staging error)`,
      );
    }
    return Buffer.from(file, "utf8");
  };
  for (let i = 1; i < claimed.length; i += 1) {
    const a = claimed[i - 1]!;
    const b = claimed[i]!;
    const byFile = Buffer.compare(
      fileBytes(a.file, i - 1),
      fileBytes(b.file, i),
    );
    const order =
      byFile !== 0
        ? byFile
        : a.range.start !== b.range.start
          ? a.range.start - b.range.start
          : a.range.end - b.range.end;
    if (order >= 0) {
      fail(
        `T11.3-1 fixture self-check — ${what}: the claimed sequence is not ` +
          `strictly increasing under the pinned occurrence comparator at ` +
          `index ${String(i)} (SPEC 5.7; a harness-side staging error, not ` +
          `a product failure)`,
      );
    }
  }
}

const T11_3_1 = defineProductTest({
  id: "T11.3-1",
  title:
    'enumeration over the T5.7-* fixtures (imported from section-5.7.ts, never copied): bare `occurrences` — JSON-only, a single 12.7 document — reports every occurrence in occurrence order, the complete record sequence asserted per index against each staged workspace (T5.7-1\'s eleven records with both duplicate pairs, T5.7-2\'s six with byte-precise own ranges, T5.7-3\'s six with every 5.7 datum byte-precise, T5.7-4\'s three resolving spellings with the domain\'s findings accompanying, exit 1), each record in the form-exact 12.7 record form {"file", "range", "kind", "source", "target"} (T12.7-1\'s form, decode-enforced with the 5.7 comparator); in T11.2-3\'s invalid-path code source, and equally at T11.2-4\'s spec-source arm (resolving spellings inside a duplicate-`id` bearer and an id-less section), records are served with `source` exactly the unavailability marker while `file`, `range`, `kind`, and `target` are present — never a picked identity, never a dropped record (SPEC 11.3, 5.7, 11.2, 12.7)',
  run: async (product) => {
    // Fixture self-checks over every claimed byte range and every claimed
    // order (harness-side, before any product invocation): the imported
    // expectation tables re-earn their claims in this body, so a restage in
    // the owning module that breaks a claim fails here as a harness
    // diagnosis, never as a wrong-but-satisfiable expectation.
    for (const arm of SPAN_ARMS) {
      sliceCheck(
        arm.fileSource,
        arm.range,
        arm.span,
        `T5.7-2 fixture, ${arm.what}`,
      );
    }
    assertClaimedOrder(SPAN_ARMS, "the T5.7-2 fixture's claimed sequence");
    for (const arm of ORD_EXPECTED) {
      sliceCheck(
        arm.fileSource,
        arm.record.range,
        arm.occurrenceSpan,
        `T5.7-3 fixture, ${arm.what} — the occurrence's own span`,
      );
      sliceCheck(
        arm.fileSource,
        arm.record.source.range,
        arm.sourceSpan,
        `T5.7-3 fixture, ${arm.what} — the source node's construct range`,
      );
    }
    assertClaimedOrder(
      ORD_EXPECTED.map((arm) => arm.record),
      "the T5.7-3 fixture's claimed sequence",
    );
    sliceCheck(
      CS_SOURCE,
      CS_EXPECTED_OCCURRENCES[0]!.range,
      "text(SPEC.ok)",
      "T11.2-3's code source — the call expression's span",
    );
    sliceCheck(
      CS_SOURCE,
      CS_EXPECTED_OCCURRENCES[1]!.range,
      "SPEC.ok",
      "T11.2-3's code source — the bare marker chain's span",
    );
    sliceCheck(
      R_SOURCE,
      R_EXPECTED_OCCURRENCES[0]!.range,
      '"a.b"',
      "T11.2-4's spec source — the second bearer's `d` reference expression",
    );
    sliceCheck(
      R_SOURCE,
      R_EXPECTED_OCCURRENCES[1]!.range,
      '{text("a.b")}',
      "T11.2-4's spec source — the id-less section's embedding container",
    );

    // --- The T5.7-1 fixture (units and duplicates): eleven records. -----------
    // Expected order (SPEC 5.7), realized by expanding the exported unit
    // table in position: `specs/MAIN.mdx` ("sp" 0x70) sorts before
    // `src/app.ts` ("sr" 0x72) by path bytes; within MAIN the spellings in
    // source order — `tri`'s three array entries left to right, `solo`'s
    // single reference, `emb`'s container, `dup`'s two entries — and within
    // the TS file the `useText` call, the `once` marker, then `twice`'s two
    // markers. `specs/BASE.mdx` spells no reference and contributes none.
    {
      const context = "T11.3-1 over the T5.7-1 fixture (units and duplicates)";
      const workspace = await TestWorkspace.create({
        files: {
          "xspec.config.ts": SPEC_AND_CODE_CONFIG,
          [BASE_FILE]: T5_7_1_BASE_SOURCE,
          [MAIN_FILE]: T5_7_1_MAIN_SOURCE,
          [APP_FILE]: T5_7_1_APP_SOURCE,
        },
      });
      try {
        await buildOk(
          product,
          workspace,
          `${context} — \`build\` (premise: the workspace is valid, so the ` +
            `enumeration is complete and finding-free, SPEC 11.2, 11.3)`,
        );
        const report = decodeOccurrencesReport(
          await runJson(
            product,
            workspace,
            ["occurrences"],
            `${context} — bare \`occurrences\`: a complete, finding-free ` +
              `answer exits 0 (SPEC 11.2, 11.3)`,
          ),
          context,
        );
        assertSameJson(
          report.findings,
          [],
          `${context}: the consulted domain (the entire discovered set, no ` +
            `\`--file\`) carries no finding (SPEC 11.2, 11.3)`,
        );
        assertSameJson(
          report.occurrences.map(projectTuple),
          expandUnits(T5_7_1_UNITS),
          `${context}: the COMPLETE eleven-record sequence per index in ` +
            `occurrence order — one record per \`d\` array entry (never one ` +
            `for the array or the prop, SPEC 2.2), one per embedding, call, ` +
            `and marker, two per duplicate pair, each carrying its edge ` +
            `kind, source identity, and target — T5.7-1 pins this multiset ` +
            `order-free; the §11.3 contract adds the per-index order (SPEC ` +
            `5.7, 11.3)`,
        );
      } finally {
        await workspace.dispose();
      }
    }

    // --- The T5.7-2 fixture (spans): six records, own ranges byte-precise. ----
    {
      const context = "T11.3-1 over the T5.7-2 fixture (byte-precise spans)";
      const workspace = await TestWorkspace.create({
        files: {
          "xspec.config.ts": SPEC_AND_CODE_CONFIG,
          "specs/BASE.mdx": SPAN_BASE_SOURCE,
          "specs/MAIN.mdx": SPAN_MAIN_SOURCE,
          "src/app.ts": SPAN_APP_SOURCE,
        },
      });
      try {
        await buildOk(
          product,
          workspace,
          `${context} — \`build\` (premise: every staged reference is a ` +
            `sanctioned spelling that resolves, SPEC 11.2, 11.3)`,
        );
        const report = decodeOccurrencesReport(
          await runJson(
            product,
            workspace,
            ["occurrences"],
            `${context} — bare \`occurrences\`: a complete, finding-free ` +
              `answer exits 0 (SPEC 11.2, 11.3)`,
          ),
          context,
        );
        assertSameJson(
          report.findings,
          [],
          `${context}: the consulted domain carries no finding (SPEC 11.2, ` +
            `11.3)`,
        );
        if (report.occurrences.length !== SPAN_ARMS.length) {
          fail(
            `${context}: expected exactly ${String(SPAN_ARMS.length)} ` +
              `records — one per staged reference, in occurrence order ` +
              `(SPEC 5.7) — got ${String(report.occurrences.length)}: ` +
              JSON.stringify(report.occurrences),
          );
        }
        SPAN_ARMS.forEach((arm, index) => {
          assertSameJson(
            projectTuple(report.occurrences[index]!),
            {
              file: arm.file,
              kind: arm.kind,
              source: arm.source,
              target: arm.target,
            },
            `${context} record [${String(index)}] — ${arm.what}: the ` +
              `record's identity-level data at its pinned position (SPEC ` +
              `5.7, 11.3)`,
          );
          assertSameJson(
            report.occurrences[index]!.range,
            arm.range,
            `${context} record [${String(index)}] — ${arm.what}: the ` +
              `occurrence's own range against precomputed byte offsets — ` +
              `zero-based, start-inclusive end-exclusive (SPEC 1.7, 5.7)`,
          );
        });
      } finally {
        await workspace.dispose();
      }
    }

    // --- The T5.7-3 fixture (record data and order): every datum pinned. ------
    {
      const context = "T11.3-1 over the T5.7-3 fixture (full record data)";
      const workspace = await TestWorkspace.create({
        files: {
          "xspec.config.ts": SPEC_AND_CODE_CONFIG,
          [ORD_ZED_FILE]: ORD_ZED_SOURCE,
          [ORD_ALPHA_FILE]: ORD_ALPHA_SOURCE,
          [ORD_APP_FILE]: ORD_APP_SOURCE,
        },
      });
      try {
        await buildOk(
          product,
          workspace,
          `${context} — \`build\` (premise: every staged reference is ` +
            `sanctioned and resolves, SPEC 11.2, 11.3)`,
        );
        const report = decodeOccurrencesReport(
          await runJson(
            product,
            workspace,
            ["occurrences"],
            `${context} — bare \`occurrences\`: a complete, finding-free ` +
              `answer exits 0 (SPEC 11.2, 11.3)`,
          ),
          context,
        );
        assertSameJson(
          report.findings,
          [],
          `${context}: the consulted domain carries no finding (SPEC 11.2, ` +
            `11.3)`,
        );
        if (report.occurrences.length !== ORD_EXPECTED.length) {
          fail(
            `${context}: expected exactly ${String(ORD_EXPECTED.length)} ` +
              `records — one per staged reference (SPEC 5.7) — got ` +
              `${String(report.occurrences.length)}: ` +
              JSON.stringify(report.occurrences),
          );
        }
        // Per-index equality over the length-checked enumeration: every
        // record member — referencing file, own range, edge kind, the
        // source graph node's identity-plus-range datum, target identity —
        // byte-precise at its pinned position ("each record carrying every
        // 5.7 datum", the file-path-bytes leg included: a case-folding
        // collation surfaces alpha.mdx's record before Zed.mdx's and fails
        // at index 0).
        ORD_EXPECTED.forEach((arm, index) => {
          assertSameJson(
            report.occurrences[index],
            arm.record,
            `${context} record [${String(index)}] — ${arm.what}; zero-based ` +
              `byte offsets, start-inclusive end-exclusive (SPEC 1.7, 5.7, ` +
              `11.3)`,
          );
        });
      } finally {
        await workspace.dispose();
      }
    }

    // --- The T5.7-4 fixture (no-occurrence constructs): findings accompany. ---
    // Expected order: `specs/MAIN.mdx` before `src/app.ts`; within MAIN the
    // `use` reference precedes the `emb` container in source order (the
    // exported table's stated contract). The staged defects mean the answer
    // carries the domain's findings and exits 1, the full answer still
    // emitted; their located detail is T5.7-4's subject — here the exact
    // condition-count multiset is the staging-integrity pin.
    {
      const context =
        "T11.3-1 over the T5.7-4 fixture (no-occurrence constructs)";
      const workspace = await TestWorkspace.create({
        files: {
          "xspec.config.ts": SPEC_AND_CODE_CONFIG,
          [BASE_FILE]: NO_OCC_BASE_SOURCE,
          [NO_OCC_SPARE_FILE]: NO_OCC_SPARE_SOURCE,
          [MAIN_FILE]: NO_OCC_MAIN_SOURCE,
          [APP_FILE]: NO_OCC_APP_SOURCE,
        },
      });
      try {
        const result = await expectExit(
          product,
          workspace,
          ["occurrences"],
          1,
          `${context} — an answer carrying any finding exits 1, the full ` +
            `answer document still emitted (SPEC 11.2, 11.3)`,
        );
        const report = decodeOccurrencesReport(
          parseJsonStdout(
            result,
            `${context} — a single JSON document is the only output form ` +
              `(SPEC 11)`,
          ),
          context,
        );
        assertConditionCounts(
          report.findings,
          NO_OCC_EXPECTED_CONDITIONS,
          `${context}: staging integrity — exactly the four staged defects ` +
            `accompany the answer (one 14.5, one 14.6, one 14.7, one 14.8) ` +
            `and nothing for the import declarations, type-only uses, or ` +
            `shadowed chains; located detail is T5.7-4's subject (SPEC ` +
            `11.2, 14)`,
        );
        assertSameJson(
          report.occurrences.map(projectTuple),
          expandUnits(NO_OCC_UNITS),
          `${context}: the complete three-record sequence per index in ` +
            `occurrence order — records for exactly the resolving ` +
            `spellings: no record for an import declaration, a type-only ` +
            `use, a shadowed chain, the dynamic spelling, or an unresolved ` +
            `one (the decode already rejects any record with an ` +
            `unavailable target — an unresolved spelling is never a ` +
            `record, SPEC 5.7, 11.2, 11.3)`,
        );
      } finally {
        await workspace.dispose();
      }
    }

    // --- T11.2-3's invalid-path code source: `source` served unavailable. -----
    // The staging is the owning module's: `src/co#de.ts` (14.19 — the path
    // is the file's only defect) whose `text(SPEC.ok)` call and bare marker
    // both resolve against the valid `specs/OK.mdx`, so both record — the
    // records' `source` exactly the unavailability marker (identity and
    // range withheld together as one datum, SPEC 11.2) while `file`,
    // `range`, `kind`, and `target` are present, byte-precise.
    {
      const context = "T11.3-1 over T11.2-3's invalid-path code source";
      const workspace = await TestWorkspace.create({
        files: {
          "xspec.config.ts": AVAILABILITY_SPEC_AND_CODE_CONFIG,
          [OK_FILE]: OK_SOURCE,
          [CS_FILE]: CS_SOURCE,
        },
      });
      try {
        const result = await expectExit(
          product,
          workspace,
          ["occurrences"],
          1,
          `${context} — the answer carries a finding and ` +
            `explicitly-unavailable source datums, so exit 1 with the full ` +
            `answer (SPEC 11.2, 11.3)`,
        );
        const report = decodeOccurrencesReport(
          parseJsonStdout(
            result,
            `${context} — a single JSON document is the only output form ` +
              `(SPEC 11)`,
          ),
          context,
        );
        assertConditionCounts(
          report.findings,
          { "14.19": 1 },
          `${context}: exactly the code source's condition-19 finding ` +
            `accompanies — the consulted domain is the entire discovered ` +
            `set, OK.mdx is finding-free, and the path is the code ` +
            `source's only defect (SPEC 11.2, 11.3, 14)`,
        );
        const finding = report.findings[0]!;
        assertSameJson(
          {
            code: finding.code,
            locations: finding.locations,
            path: finding.path,
          },
          { code: "invalid-source-path", locations: [], path: CS_FILE },
          `${context}: the 14.19 finding carries the stable code, no ` +
            `in-source locations (a path-level condition), and the code ` +
            `source as its concerned path (SPEC 14, 12.7)`,
        );
        assertSameJson(
          report.occurrences,
          CS_EXPECTED_OCCURRENCES,
          `${context}: the complete enumeration — the call (embeds, ` +
            `spanning the whole call expression) and the marker ` +
            `(references, spanning the bare chain), each record's source ` +
            `EXACTLY the unavailability marker while file, range, kind, ` +
            `and target are present — never a picked identity, never a ` +
            `dropped record (SPEC 5.7, 11.2, 11.3)`,
        );
      } finally {
        await workspace.dispose();
      }
    }

    // --- T11.2-4's spec-source arm: resolving spellings inside a --------------
    // duplicate-`id` bearer and an id-less section. The staging is the
    // owning module's resolution matrix `specs/R.mdx`: duplicate bearers of
    // `a` with the unique `a.b` beneath the first; the SECOND bearer's
    // `d={"a.b"}` and the id-less section's `{text("a.b")}` each resolve
    // and record with `source` exactly the marker; `q`'s ambiguous
    // `d={"a"}` records nothing (its 14.5 reports it instead).
    {
      const context =
        "T11.3-1 at T11.2-4's spec-source arm (the resolution matrix)";
      const workspace = await TestWorkspace.create({
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          [R_FILE]: R_SOURCE,
        },
      });
      try {
        const result = await expectExit(
          product,
          workspace,
          ["occurrences"],
          1,
          `${context} — the answer carries findings and ` +
            `explicitly-unavailable source datums, so exit 1 with the full ` +
            `answer (SPEC 11.2, 11.3)`,
        );
        const report = decodeOccurrencesReport(
          parseJsonStdout(
            result,
            `${context} — a single JSON document is the only output form ` +
              `(SPEC 11)`,
          ),
          context,
        );
        assertConditionCounts(
          report.findings,
          R_CONDITION_COUNTS,
          `${context}: staging integrity — exactly one 14.1 (the id-less ` +
            `section), one 14.3 (the duplicated \`a\`), one 14.5 (the ` +
            `ambiguous reference, reported by its finding and never as a ` +
            `record); located detail is T11.2-4's subject (SPEC 11.2, 14)`,
        );
        assertSameJson(
          report.occurrences,
          R_EXPECTED_OCCURRENCES,
          `${context}: the complete enumeration — the \`d\` entry on the ` +
            `OTHER duplicate bearer of \`a\` and the embedding inside the ` +
            `id-less section each record with source EXACTLY the ` +
            `unavailability marker (never a picked bearer's identity, ` +
            `never a dropped record) while file, range, kind, and target ` +
            `are present, and the ambiguous reference to \`a\` yields no ` +
            `record and no unavailable target (SPEC 5.7, 11.2, 11.3)`,
        );
      } finally {
        await workspace.dispose();
      }
    }
  },
});

// ---------------------------------------------------------------------------
// T11.3-2 — `--file`: a set restriction over discovered files
// ---------------------------------------------------------------------------

// The restriction workspace (failing on purpose): three discovered sources,
// each holding at least one occurrence and exactly one finding of a condition
// no other file stages — so every domain assertion individuates by condition
// AND by located file — plus an on-disk decoy no configured group discovers.
//
// - specs/apple.mdx: one 14.5 (the unresolved local `"nosuch"` entry) beside
//   TWO resolving spellings — the external `BETA.far` (its target lying in
//   the file the subset glob EXCLUDES: resolution is workspace-wide, the
//   domain restricts consultation, not the reference ground, SPEC 11.2/11.3
//   — a product resolving only within the admitted set reports a phantom
//   14.5 and drops the record) and the local embedding `{text("apple")}`.
// - specs/beta.mdx: one 14.3 (the duplicate `twin` pair) beside the
//   resolving local `d={"far"}`.
// - src/app.ts: one 14.8 (the string-form `text("apple")`, invalid in
//   TypeScript by form, SPEC 4.3 — no occurrence) beside the resolving
//   marker `SPEC.apple`.
// - docs/note.mdx: deliberately unparseable, in NO configured group — a
//   pattern matching it on disk still matches no DISCOVERED file (SPEC 7:
//   discovery is controlled exclusively by configuration), so a product
//   globbing the filesystem instead of the discovered set consults it and
//   surfaces a phantom 14.20 (or any nonempty answer) where the empty,
//   finding-free answer is required.
const FILTER_APPLE_FILE = "specs/apple.mdx";
const FILTER_BETA_FILE = "specs/beta.mdx";
const FILTER_APP_FILE = "src/app.ts";
const FILTER_TRAP_FILE = "docs/note.mdx";

const FILTER_APPLE_SOURCE = [
  'import BETA from "./beta.xspec"',
  "",
  '<S id="apple">',
  "Apple text.",
  "</S>",
  "",
  '<S id="pick" d={[BETA.far, "nosuch"]}>',
  'Pick: {text("apple")}',
  "</S>",
  "",
].join("\n");

const FILTER_BETA_SOURCE = [
  '<S id="far">',
  "Far text.",
  "</S>",
  "",
  '<S id="near" d={"far"}>',
  "Near text.",
  "</S>",
  "",
  '<S id="twin">',
  "Twin one.",
  "</S>",
  "",
  '<S id="twin">',
  "Twin two.",
  "</S>",
  "",
].join("\n");

const FILTER_APP_SOURCE = [
  'import SPEC, { text } from "../specs/apple.xspec";',
  "",
  "export function grab(): void {",
  "  SPEC.apple;",
  "}",
  "",
  "export function bad(): string {",
  '  return text("apple");',
  "}",
  "",
].join("\n");

const FILTER_TRAP_SOURCE = '<S id="trap">\nUnclosed on purpose.\n';

/** The workspace's complete finding multiset (the `build --json` gate). */
const FILTER_WORKSPACE_CONDITIONS: Readonly<Record<string, number>> = {
  "14.3": 1,
  "14.5": 1,
  "14.8": 1,
};

// Expected record tuples per file, each list in that file's source order
// (the 5.7 comparator's within-file leg; `specs/apple.mdx` < `src/app.ts`
// by path bytes on the cross-file leg). Every staged (file, kind, source,
// target) tuple is unique, so the per-index tuple compare individuates a
// dropped, phantom, or out-of-domain record by name.
const FILTER_APPLE_TUPLES: readonly RecordTuple[] = [
  {
    file: FILTER_APPLE_FILE,
    kind: "depends",
    source: "specs/apple.mdx#pick",
    target: "specs/beta.mdx#far",
  },
  {
    file: FILTER_APPLE_FILE,
    kind: "embeds",
    source: "specs/apple.mdx#pick",
    target: "specs/apple.mdx#apple",
  },
];
const FILTER_APP_TUPLES: readonly RecordTuple[] = [
  {
    file: FILTER_APP_FILE,
    kind: "references",
    source: "src/app.ts#grab",
    target: "specs/apple.mdx#apple",
  },
];
const FILTER_BETA_TUPLES: readonly RecordTuple[] = [
  {
    file: FILTER_BETA_FILE,
    kind: "depends",
    source: "specs/beta.mdx#near",
    target: "specs/beta.mdx#far",
  },
];

// The conjunction workspace (valid): occurrences P→x, P→y, Q→x, so `--file
// specs/P.mdx` alone admits two records, `--to specs/T.mdx#x` alone selects
// two, and the conjunction is exactly the one-record intersection — each
// filter alone admits MORE than the intersection, TEST-SPEC's fixture
// condition, so a product applying either filter alone (or their union)
// fails the exact compare.
const CONJ_T_FILE = "specs/T.mdx";
const CONJ_P_FILE = "specs/P.mdx";
const CONJ_Q_FILE = "specs/Q.mdx";
const CONJ_X_ID = "specs/T.mdx#x";
const CONJ_Y_ID = "specs/T.mdx#y";

const CONJ_T_SOURCE = [
  '<S id="x">',
  "X text.",
  "</S>",
  "",
  '<S id="y">',
  "Y text.",
  "</S>",
  "",
].join("\n");

const CONJ_P_SOURCE = [
  'import T from "./T.xspec"',
  "",
  '<S id="p" d={[T.x, T.y]}>',
  "P text.",
  "</S>",
  "",
].join("\n");

const CONJ_Q_SOURCE = [
  'import T from "./T.xspec"',
  "",
  '<S id="q" d={T.x}>',
  "Q text.",
  "</S>",
  "",
].join("\n");

const CONJ_P_TO_X: RecordTuple = {
  file: CONJ_P_FILE,
  kind: "depends",
  source: "specs/P.mdx#p",
  target: CONJ_X_ID,
};
const CONJ_P_TO_Y: RecordTuple = {
  file: CONJ_P_FILE,
  kind: "depends",
  source: "specs/P.mdx#p",
  target: CONJ_Y_ID,
};
const CONJ_Q_TO_X: RecordTuple = {
  file: CONJ_Q_FILE,
  kind: "depends",
  source: "specs/Q.mdx#q",
  target: CONJ_X_ID,
};

/**
 * The answer's one finding of a condition, returned for its located-home
 * assertion; the caller has already pinned the count map, so a miss here is
 * diagnosed against the whole findings array.
 */
function findingByCondition(
  findings: readonly Finding[],
  condition: string,
  context: string,
): Finding {
  const matches = findings.filter((finding) => finding.condition === condition);
  if (matches.length !== 1) {
    fail(
      `${context}: expected exactly one ${condition} finding in the ` +
        `answer; got ${String(matches.length)} among ` +
        JSON.stringify(findings),
    );
  }
  return matches[0]!;
}

const T11_3_2 = defineProductTest({
  id: "T11.3-2",
  title:
    "`--file` is a set restriction over discovered files, spec and code alike: one glob (`**/ap*`) admitting a spec source and a code source restricts the consulted domain to exactly the admitted files — only their findings accompany (never the excluded file's 14.3) and only their occurrences are enumerated, the admitted spec file's record into the excluded file still resolving and recording (the domain restricts consultation, not resolution), exit 1; the complementary literal glob flips the domain (exactly the 14.3, exactly the excluded file's record); a glob matching no discovered file — one matching an on-disk file no configured group discovers, and one matching nothing at all — admits the empty set: an empty, finding-free answer, exit 0, no unknown-file usage error on this filter, whatever findings the workspace carries; an outside-root pattern (a leading and an embedded `..` traversal) exits 2 as an invalid flag value with the single 12.7 error document, the argument check preceding answering; `--file` and `--to` combine conjunctively — a fixture where each filter alone admits more records than the intersection (SPEC 11.3, 11.2, 11.1, 7, 12.0, 12.7)",
  run: async (product) => {
    // --- Workspace 1: the restriction ground (failing on purpose). ------------
    {
      const workspace = await TestWorkspace.create({
        files: {
          "xspec.config.ts": SPEC_AND_CODE_CONFIG,
          [FILTER_APPLE_FILE]: FILTER_APPLE_SOURCE,
          [FILTER_BETA_FILE]: FILTER_BETA_SOURCE,
          [FILTER_APP_FILE]: FILTER_APP_SOURCE,
          [FILTER_TRAP_FILE]: FILTER_TRAP_SOURCE,
        },
      });
      try {
        await assertLeavesUnchanged(
          workspace.root,
          async () => {
            // Gate reference and staging integrity (SPEC 12.1, 14): exactly
            // one finding per file, each of a condition no other file
            // stages, homes pinned — so every domain assertion below reads
            // on staged ground. The decoy is in no configured group and
            // contributes nothing (SPEC 7: discovery is controlled
            // exclusively by configuration).
            const gateContext =
              "T11.3-2 `build --json` (staging integrity: one 14.5 in " +
              "apple, one 14.3 in beta, one 14.8 in the code source; the " +
              "undiscovered docs/note.mdx contributes nothing)";
            const gateFindings = await buildFindings(
              product,
              workspace,
              gateContext,
            );
            assertConditionCounts(
              gateFindings,
              FILTER_WORKSPACE_CONDITIONS,
              `${gateContext} — exactly the staged conditions (SPEC 14)`,
            );
            assertFindingLocated(
              findingByCondition(gateFindings, "14.5", gateContext),
              { file: FILTER_APPLE_FILE },
              `${gateContext} — the unresolved \`"nosuch"\` entry locates ` +
                `in apple (SPEC 14)`,
            );
            assertFindingLocated(
              findingByCondition(gateFindings, "14.3", gateContext),
              { file: FILTER_BETA_FILE },
              `${gateContext} — the duplicate \`twin\` pair locates every ` +
                `bearer, both in beta (SPEC 14)`,
            );
            assertFindingLocated(
              findingByCondition(gateFindings, "14.8", gateContext),
              { file: FILTER_APP_FILE },
              `${gateContext} — the string-form \`text("apple")\` call ` +
                `locates in the code source (SPEC 4.3, 14)`,
            );

            // --- One glob admitting a spec source AND a code source (SPEC
            // 11.3: the discovered files, spec and code alike): the
            // consulted domain is exactly {apple, app.ts} — only their
            // findings accompany, only their occurrences are enumerated,
            // and apple's reference INTO the excluded beta still resolves
            // and records (never a phantom 14.5, never a dropped record).
            {
              const context =
                'T11.3-2 `occurrences --file "**/ap*"` (a subset of spec ' +
                "and code files alike)";
              const result = await expectExit(
                product,
                workspace,
                ["occurrences", "--file", "**/ap*"],
                1,
                `${context} — the admitted files' findings accompany, so ` +
                  `exit 1 with the full answer (SPEC 11.2, 11.3)`,
              );
              const report = decodeOccurrencesReport(
                parseJsonStdout(
                  result,
                  `${context} — a single JSON document is the only output ` +
                    `form (SPEC 11)`,
                ),
                context,
              );
              assertConditionCounts(
                report.findings,
                { "14.5": 1, "14.8": 1 },
                `${context}: ONLY the admitted files' findings accompany — ` +
                  `apple's one 14.5 and the code source's one 14.8, never ` +
                  `the excluded beta's 14.3, and never a second 14.5 for ` +
                  `apple's resolving reference into the excluded file ` +
                  `(SPEC 11.2, 11.3, 14)`,
              );
              assertFindingLocated(
                findingByCondition(report.findings, "14.5", context),
                { file: FILTER_APPLE_FILE },
                `${context} — the accompanying 14.5 is the ADMITTED ` +
                  `apple's (SPEC 11.2)`,
              );
              assertFindingLocated(
                findingByCondition(report.findings, "14.8", context),
                { file: FILTER_APP_FILE },
                `${context} — the accompanying 14.8 is the ADMITTED code ` +
                  `source's (SPEC 11.2)`,
              );
              assertSameJson(
                report.occurrences.map(projectTuple),
                [...FILTER_APPLE_TUPLES, ...FILTER_APP_TUPLES],
                `${context}: the complete enumeration per index in ` +
                  `occurrence order — apple's two records (the external ` +
                  `reference into the EXCLUDED beta included: resolution ` +
                  `is workspace-wide, the domain restricts consultation) ` +
                  `and the code source's marker record; nothing of beta's ` +
                  `(SPEC 5.7, 11.2, 11.3)`,
              );
            }

            // --- The complementary literal glob: the domain flips to
            // exactly {beta} — the other side of "only its findings
            // accompany" over the same staging.
            {
              const context =
                'T11.3-2 `occurrences --file "specs/beta.mdx"` (the ' +
                "complementary single-file subset)";
              const result = await expectExit(
                product,
                workspace,
                ["occurrences", "--file", FILTER_BETA_FILE],
                1,
                `${context} — beta's finding accompanies, so exit 1 with ` +
                  `the full answer (SPEC 11.2, 11.3)`,
              );
              const report = decodeOccurrencesReport(
                parseJsonStdout(
                  result,
                  `${context} — a single JSON document is the only output ` +
                    `form (SPEC 11)`,
                ),
                context,
              );
              assertConditionCounts(
                report.findings,
                { "14.3": 1 },
                `${context}: ONLY beta's 14.3 accompanies — never apple's ` +
                  `14.5 or the code source's 14.8 (SPEC 11.2, 11.3, 14)`,
              );
              assertFindingLocated(
                findingByCondition(report.findings, "14.3", context),
                { file: FILTER_BETA_FILE },
                `${context} — the 14.3 locates in beta (SPEC 14)`,
              );
              assertSameJson(
                report.occurrences.map(projectTuple),
                FILTER_BETA_TUPLES,
                `${context}: exactly beta's one record — nothing of ` +
                  `apple's or the code source's (SPEC 5.7, 11.2, 11.3)`,
              );
            }

            // --- A glob matching no DISCOVERED file admits the empty set
            // (SPEC 11.3: a set restriction, not an existence assertion):
            // an empty, finding-free answer, exit 0, no unknown-file usage
            // error — whatever findings the workspace carries. First with a
            // pattern matching a real on-disk file no group discovers (a
            // product globbing the filesystem consults the unparseable
            // decoy and answers nonempty), then with one matching nothing
            // at all.
            for (const [glob, what] of [
              [
                "docs/*.mdx",
                "matching the on-disk but UNDISCOVERED docs/note.mdx",
              ],
              ["nosuch/**/*.mdx", "matching nothing at all"],
            ] as const) {
              const context = `T11.3-2 \`occurrences --file "${glob}"\` (${what})`;
              const report = decodeOccurrencesReport(
                await runJson(
                  product,
                  workspace,
                  ["occurrences", "--file", glob],
                  `${context} — the glob admits the empty set: an empty, ` +
                    `finding-free answer exits 0, and no unknown-file ` +
                    `usage error exists on this filter, whatever findings ` +
                    `the workspace carries (SPEC 11.2, 11.3)`,
                ),
                context,
              );
              assertSameJson(
                report.findings,
                [],
                `${context}: an empty consulted domain has no findings — ` +
                  `the workspace's staged 14.3/14.5/14.8 are no domain ` +
                  `file's findings here (SPEC 11.2, 11.3)`,
              );
              assertSameJson(
                report.occurrences,
                [],
                `${context}: the empty enumeration (SPEC 11.3)`,
              );
            }

            // --- An outside-root pattern is an invalid flag value, exit 2
            // (SPEC 11.3, 11.1, 7): the argument check precedes answering
            // (11.2), whatever findings the named files carry — asserted on
            // this failing workspace via the shared JSON-only usage-error
            // protocol (single 12.7 error document, message on stderr).
            await expectAvailabilityUsageError(
              product,
              workspace,
              ["occurrences", "--file", "../elsewhere/**/*.mdx"],
              "T11.3-2 outside-root `--file` pattern (leading `..` " +
                "traversal) on the failing workspace",
            );
            await expectAvailabilityUsageError(
              product,
              workspace,
              ["occurrences", "--file", "specs/../../evil/*.mdx"],
              "T11.3-2 outside-root `--file` pattern (embedded `..` " +
                "traversal escaping the root mid-pattern) on the failing " +
                "workspace",
            );
          },
          "T11.3-2 workspace 1 — no invocation of the sweep modifies " +
            "anything: the gate build fails writing nothing (SPEC 12.1) " +
            "and on a failing workspace these surfaces answer from current " +
            "sources and write nothing (SPEC 11.2; the no-write contract " +
            "clauses live at T11.2-1/T11.2-6)",
        );
      } finally {
        await workspace.dispose();
      }
    }

    // --- Workspace 2: `--file` and `--to` combine conjunctively. --------------
    {
      const workspace = await TestWorkspace.create({
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          [CONJ_T_FILE]: CONJ_T_SOURCE,
          [CONJ_P_FILE]: CONJ_P_SOURCE,
          [CONJ_Q_FILE]: CONJ_Q_SOURCE,
        },
      });
      try {
        await buildOk(
          product,
          workspace,
          "T11.3-2 `build` (premise: the conjunction workspace is valid, " +
            "so every answer below is complete and finding-free, SPEC " +
            "11.2, 11.3)",
        );

        // `--file` alone admits P's two records — more than the
        // intersection.
        {
          const context =
            "T11.3-2 `occurrences --file specs/P.mdx` (the file filter " +
            "alone)";
          const report = decodeOccurrencesReport(
            await runJson(
              product,
              workspace,
              ["occurrences", "--file", CONJ_P_FILE],
              `${context} — complete and finding-free, exit 0 (SPEC 11.2, ` +
                `11.3)`,
            ),
            context,
          );
          assertSameJson(
            report.findings,
            [],
            `${context}: the domain carries no finding (SPEC 11.2)`,
          );
          assertSameJson(
            report.occurrences.map(projectTuple),
            [CONJ_P_TO_X, CONJ_P_TO_Y],
            `${context}: exactly P's two records — the file filter alone ` +
              `admits MORE than the conjunction's one (SPEC 11.3)`,
          );
        }

        // `--to` alone selects the two records targeting x — more than the
        // intersection.
        {
          const context =
            "T11.3-2 `occurrences --to specs/T.mdx#x` (the target filter " +
            "alone)";
          const report = decodeOccurrencesReport(
            await runJson(
              product,
              workspace,
              ["occurrences", "--to", CONJ_X_ID],
              `${context} — complete and finding-free, exit 0 (SPEC 11.2, ` +
                `11.3)`,
            ),
            context,
          );
          assertSameJson(
            report.findings,
            [],
            `${context}: the domain (the entire discovered set) carries ` +
              `no finding (SPEC 11.2)`,
          );
          assertSameJson(
            report.occurrences.map(projectTuple),
            [CONJ_P_TO_X, CONJ_Q_TO_X],
            `${context}: exactly the two records targeting x, P's before ` +
              `Q's by path bytes — the target filter alone selects MORE ` +
              `than the conjunction's one (SPEC 5.7, 11.3)`,
          );
        }

        // Both filters combine conjunctively: exactly the one-record
        // intersection — a union, or either filter applied alone, reports
        // two or three records and fails.
        {
          const context =
            "T11.3-2 `occurrences --file specs/P.mdx --to specs/T.mdx#x` " +
            "(the conjunction)";
          const report = decodeOccurrencesReport(
            await runJson(
              product,
              workspace,
              ["occurrences", "--file", CONJ_P_FILE, "--to", CONJ_X_ID],
              `${context} — complete and finding-free, exit 0 (SPEC 11.2, ` +
                `11.3)`,
            ),
            context,
          );
          assertSameJson(
            report.findings,
            [],
            `${context}: the domain carries no finding (SPEC 11.2)`,
          );
          assertSameJson(
            report.occurrences.map(projectTuple),
            [CONJ_P_TO_X],
            `${context}: exactly the intersection — P's record targeting ` +
              `x and nothing else: the two filters combine conjunctively ` +
              `(SPEC 11.3)`,
          );
        }
      } finally {
        await workspace.dispose();
      }
    }
  },
});

// ---------------------------------------------------------------------------
// T11.3-3 — `--to`: syntactic acceptance / malformed spellings; exact
// selection
// ---------------------------------------------------------------------------

// The acceptance workspace (failing on purpose). specs/OK.mdx is the
// finding-free file holding the domain's ONE resolving occurrence
// (`use` → `ok`), so every accepted-but-empty answer below is provably the
// selection's doing: a product ignoring `--to` returns this record and fails
// the empty compare, while a product erring on a non-resolving identity
// fails the exit assertion (SPEC 11.3: acceptance is syntactic, never an
// error). The three non-resolving grounds each carry a spelling a
// mis-implemented product would resolve INTO:
//
// - specs/broken.mdx (masked, 14.20): sibling sections `hidden` and
//   `hiddenUse d={"hidden"}` precede the breakage (the final section never
//   closes), so an error-recovering product that keeps the pre-breakage
//   parse resolves `hiddenUse` → `hidden` and serves it under
//   `--to specs/broken.mdx#hidden`, where the whole-file masking of 14
//   demands the empty set.
// - specs/dup.mdx: two bearers of `twin` (14.3 — every bearer undefined, no
//   winner) and `watcher d={"twin"}` (ambiguous → no occurrence, its 14.5
//   reporting it instead), so a winner-picking product records
//   `watcher` → `twin` and serves it under `--to specs/dup.mdx#twin`.
// - docs/other.mdx: fully VALID content (`x` and `xuse d={"x"}`) in NO
//   configured group (SPEC 7: discovery is controlled exclusively by
//   configuration), so a product resolving the operand against the
//   filesystem instead of the discovered set records `xuse` → `x` and
//   serves it under `--to docs/other.mdx#x` — while for a conforming
//   product the file contributes nothing: no finding, no record.
const TO_OK_FILE = "specs/OK.mdx";
const TO_MASKED_FILE = "specs/broken.mdx";
const TO_DUP_FILE = "specs/dup.mdx";
const TO_DECOY_FILE = "docs/other.mdx";

const TO_OK_SOURCE = [
  '<S id="ok">',
  "Ok text.",
  "</S>",
  "",
  '<S id="use" d={"ok"}>',
  "Use text.",
  "</S>",
  "",
].join("\n");

const TO_MASKED_SOURCE = [
  '<S id="hidden">',
  "Hidden text.",
  "</S>",
  "",
  '<S id="hiddenUse" d={"hidden"}>',
  "Hidden use — this final section never closes, so the file is",
  "unparseable on purpose (14.20) and masked whole.",
  "",
].join("\n");

const TO_DUP_SOURCE = [
  '<S id="twin">',
  "Twin one.",
  "</S>",
  "",
  '<S id="twin">',
  "Twin two.",
  "</S>",
  "",
  '<S id="watcher" d={"twin"}>',
  "Watcher text.",
  "</S>",
  "",
].join("\n");

const TO_DECOY_SOURCE = [
  '<S id="x">',
  "X text.",
  "</S>",
  "",
  '<S id="xuse" d={"x"}>',
  "X use.",
  "</S>",
  "",
].join("\n");

/**
 * The acceptance workspace's complete finding multiset — the `build --json`
 * gate and every accepted-arm answer pin exactly this (no `--file`, so the
 * consulted domain is the entire discovered set and `--to` never changes the
 * accompanying findings): broken's parse failure, dup's duplicate pair, and
 * dup's ambiguous reference; nothing from OK.mdx, nothing from the
 * undiscovered decoy.
 */
const TO_WORKSPACE_CONDITIONS: Readonly<Record<string, number>> = {
  "14.20": 1,
  "14.3": 1,
  "14.5": 1,
};

/** The whole domain's one record — the ground every empty selection filters. */
const TO_BASELINE_TUPLES: readonly RecordTuple[] = [
  {
    file: TO_OK_FILE,
    kind: "depends",
    source: "specs/OK.mdx#use",
    target: "specs/OK.mdx#ok",
  },
];

/**
 * The five accepted-but-empty spellings (SPEC 11.3: acceptance is syntactic,
 * and a named identity that does not currently resolve selects the empty
 * set) — the TEST-SPEC's list: `path#id`, bare `path`, an undiscovered
 * file's identity, a masked file's, an undefined bearer's.
 */
const TO_ACCEPTED_EMPTY: ReadonlyArray<readonly [string, string]> = [
  [
    `${TO_OK_FILE}#nosuch`,
    "well-formed `path#id` — a discovered file's nonexistent id (no such " +
      "node)",
  ],
  [
    "specs/none.mdx",
    "well-formed bare `path` — a root identity no discovered file bears " +
      "(no such file anywhere)",
  ],
  [
    `${TO_DECOY_FILE}#x`,
    "an undiscovered file's identity — the on-disk docs/other.mdx is in no " +
      "configured group, so its section `x` resolves for no conforming " +
      "product",
  ],
  [
    `${TO_MASKED_FILE}#hidden`,
    "a masked file's identity — specs/broken.mdx is unparseable (14.20), " +
      "its pre-breakage `hidden` section masked with the rest",
  ],
  [
    `${TO_DUP_FILE}#twin`,
    "an undefined bearer's identity — duplicate spellings of `twin` leave " +
      "every bearer undefined, no winner picked",
  ],
];

/**
 * The malformed spellings, one arm per TEST-SPEC class (whitespace-bearing
 * and forbidden-name staged one arm each), each exit 2 (SPEC 11.3, 1.4,
 * 12.0). Where the form allows, the defect is spelled over the DISCOVERED
 * specs/OK.mdx path, so a product that resolves first and errs only on
 * unknown names answers (empty or otherwise) and fails the exit assertion.
 */
const TO_MALFORMED: ReadonlyArray<readonly [string, string]> = [
  [`${TO_OK_FILE}#ok#use`, "more than one `#`"],
  ["#ok", "an empty path part"],
  [`${TO_OK_FILE}#ok..use`, "an empty segment (the `a#b..c` class)"],
  [`${TO_OK_FILE}#ok use`, "a whitespace-bearing segment (U+0020 inside)"],
  [`${TO_OK_FILE}#then`, "a forbidden-name segment (the `a#then` class)"],
  [`${TO_OK_FILE}#`, "a trailing empty id part (the `a.mdx#` class)"],
];

// The exact-selection workspace (valid): four records, all in specs/USE.mdx
// in source order, chosen so every mis-selection is nonempty-visible against
// the per-index compares — `--to specs/BASE.mdx#top` must select the two
// records targeting `top` (one per edge kind: the `d` entry and the
// embedding), never `useSub`'s record targeting the DESCENDANT `top.sub`
// (a prefix- or subtree-selecting product fails) and never the root-targeted
// record; `--to specs/BASE.mdx#top.sub` selects exactly the descendant's own
// record (the complement); and the bare `--to specs/BASE.mdx` selects
// exactly the module-form root reference `d={BASE}` (T2.2-2: a `depends`
// edge to the file's root node, identified by the path alone, SPEC 1.5) —
// a product reading the bare path as "anything in (or into) that file"
// returns the section-targeted records and fails.
const SEL_BASE_FILE = "specs/BASE.mdx";
const SEL_USE_FILE = "specs/USE.mdx";

const SEL_BASE_SOURCE = [
  '<S id="top">',
  "Top text.",
  "",
  '<S id="top.sub">',
  "Sub text.",
  "</S>",
  "</S>",
  "",
].join("\n");

const SEL_USE_SOURCE = [
  'import BASE from "./BASE.xspec"',
  "",
  '<S id="useTop" d={BASE.top}>',
  "Top use: {text(BASE.top)}",
  "</S>",
  "",
  '<S id="useSub" d={BASE.top.sub}>',
  "Sub use.",
  "</S>",
  "",
  '<S id="useRoot" d={BASE}>',
  "Root use.",
  "</S>",
  "",
].join("\n");

const SEL_TOP_D: RecordTuple = {
  file: SEL_USE_FILE,
  kind: "depends",
  source: "specs/USE.mdx#useTop",
  target: "specs/BASE.mdx#top",
};
const SEL_TOP_EMBED: RecordTuple = {
  file: SEL_USE_FILE,
  kind: "embeds",
  source: "specs/USE.mdx#useTop",
  target: "specs/BASE.mdx#top",
};
const SEL_SUB_D: RecordTuple = {
  file: SEL_USE_FILE,
  kind: "depends",
  source: "specs/USE.mdx#useSub",
  target: "specs/BASE.mdx#top.sub",
};
const SEL_ROOT_D: RecordTuple = {
  file: SEL_USE_FILE,
  kind: "depends",
  source: "specs/USE.mdx#useRoot",
  target: "specs/BASE.mdx",
};

/** All four records in occurrence order (one file, source order). */
const SEL_ALL_TUPLES: readonly RecordTuple[] = [
  SEL_TOP_D,
  SEL_TOP_EMBED,
  SEL_SUB_D,
  SEL_ROOT_D,
];

const T11_3_3 = defineProductTest({
  id: "T11.3-3",
  title:
    "`--to` acceptance is syntactic: well-formed spellings naming identities that do not currently resolve — a discovered file's nonexistent id (`path#id`), a bare `path` no file bears, an undiscovered on-disk file's identity, a masked (14.20) file's, an undefined duplicate bearer's — are each accepted and select the empty set while the domain's one real occurrence stays enumerable (pinned bare) and the domain's findings stay on the answer (exactly {14.20, 14.3, 14.5}, exit 1), never an error; malformed spellings — more than one `#`, an empty path part, an empty segment, a whitespace-bearing segment, a forbidden-name segment (`then`), a trailing empty id part — each exit 2 with the single 12.7 error document, the argument check preceding answering whatever findings the workspace carries; selection is exact over a valid workspace: a resolving identity selects the occurrences targeting it — both its `d`-entry and its embedding record, never the descendant `top.sub`'s record and never the root's — the descendant's own identity selects exactly its record, and a bare path selects exactly the module-form root reference (T2.2-2), never the file's section-targeted records (SPEC 11.3, 11.2, 1.4, 1.5, 12.0, 12.7)",
  run: async (product) => {
    // --- Workspace 1: the acceptance ground (failing on purpose). -------------
    {
      const workspace = await TestWorkspace.create({
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          [TO_OK_FILE]: TO_OK_SOURCE,
          [TO_MASKED_FILE]: TO_MASKED_SOURCE,
          [TO_DUP_FILE]: TO_DUP_SOURCE,
          [TO_DECOY_FILE]: TO_DECOY_SOURCE,
        },
      });
      try {
        await assertLeavesUnchanged(
          workspace.root,
          async () => {
            // Gate reference and staging integrity (SPEC 12.1, 14): exactly
            // the three staged conditions, homes pinned, so every
            // acceptance assertion below reads on staged ground.
            const gateContext =
              "T11.3-3 `build --json` (staging integrity: broken's 14.20, " +
              "dup's 14.3 and 14.5; OK.mdx finding-free; the undiscovered " +
              "docs/other.mdx contributes nothing)";
            const gateFindings = await buildFindings(
              product,
              workspace,
              gateContext,
            );
            assertConditionCounts(
              gateFindings,
              TO_WORKSPACE_CONDITIONS,
              `${gateContext} — exactly the staged conditions (SPEC 14)`,
            );
            assertFindingLocated(
              findingByCondition(gateFindings, "14.20", gateContext),
              { file: TO_MASKED_FILE },
              `${gateContext} — the parse failure locates in broken.mdx ` +
                `(SPEC 14)`,
            );
            assertFindingLocated(
              findingByCondition(gateFindings, "14.3", gateContext),
              { file: TO_DUP_FILE },
              `${gateContext} — the duplicate \`twin\` pair locates every ` +
                `bearer, both in dup.mdx (SPEC 14)`,
            );
            assertFindingLocated(
              findingByCondition(gateFindings, "14.5", gateContext),
              { file: TO_DUP_FILE },
              `${gateContext} — the ambiguous \`watcher\` reference ` +
                `locates in dup.mdx (SPEC 14)`,
            );

            // Bare-enumeration staging pin: the domain holds EXACTLY the one
            // resolving record, so each accepted arm's empty selection below
            // is the `--to` filter's observable doing — never a domain that
            // was empty to begin with.
            {
              const context =
                "T11.3-3 bare `occurrences` (staging pin: the whole " +
                "domain's one record)";
              const result = await expectExit(
                product,
                workspace,
                ["occurrences"],
                1,
                `${context} — the domain's findings accompany, so exit 1 ` +
                  `with the full answer (SPEC 11.2, 11.3)`,
              );
              const report = decodeOccurrencesReport(
                parseJsonStdout(
                  result,
                  `${context} — a single JSON document is the only output ` +
                    `form (SPEC 11)`,
                ),
                context,
              );
              assertConditionCounts(
                report.findings,
                TO_WORKSPACE_CONDITIONS,
                `${context}: the domain's findings — nothing for the ` +
                  `undiscovered decoy (SPEC 11.2, 14)`,
              );
              assertSameJson(
                report.occurrences.map(projectTuple),
                TO_BASELINE_TUPLES,
                `${context}: exactly the one resolving record ` +
                  `(\`use\` → \`ok\`) — no record for the masked file's ` +
                  `spellings, the ambiguous \`d={"twin"}\`, or the ` +
                  `undiscovered decoy's content (SPEC 5.7, 11.2, 11.3)`,
              );
            }

            // --- The accepted-but-empty spellings: acceptance is syntactic
            // (SPEC 11.3) — each well-formed spelling is accepted whatever
            // the workspace contains, selects the empty set, keeps the
            // domain's findings on the answer, and is NEVER an error (the
            // T12.0-9 partition: unknown-node usage errors exist everywhere
            // except `occurrences --to`).
            for (const [spelling, what] of TO_ACCEPTED_EMPTY) {
              const context = `T11.3-3 \`occurrences --to "${spelling}"\` (${what})`;
              const result = await expectExit(
                product,
                workspace,
                ["occurrences", "--to", spelling],
                1,
                `${context} — accepted, never an error: the named identity ` +
                  `does not currently resolve, so the selection is empty ` +
                  `while the domain's findings keep the answer at exit 1 ` +
                  `(SPEC 11.3, 11.2, 12.0)`,
              );
              const report = decodeOccurrencesReport(
                parseJsonStdout(
                  result,
                  `${context} — a single JSON document is the only output ` +
                    `form (SPEC 11)`,
                ),
                context,
              );
              assertConditionCounts(
                report.findings,
                TO_WORKSPACE_CONDITIONS,
                `${context}: \`--to\` selects occurrences and never ` +
                  `changes the consulted domain — the domain's findings ` +
                  `accompany unchanged (SPEC 11.2, 11.3)`,
              );
              assertSameJson(
                report.occurrences,
                [],
                `${context}: the empty selection — never the domain's ` +
                  `\`use\` → \`ok\` record (a product ignoring \`--to\`), ` +
                  `never a masked file's, winner-picked, or ` +
                  `filesystem-resolved record (SPEC 11.2, 11.3)`,
              );
            }

            // --- The malformed spellings: each exit 2 via the shared
            // JSON-only usage-error protocol (single 12.7 error document,
            // message on stderr), the argument check preceding answering,
            // whatever findings the workspace carries (SPEC 11.2, 11.3,
            // 1.4, 12.0).
            for (const [spelling, what] of TO_MALFORMED) {
              await expectAvailabilityUsageError(
                product,
                workspace,
                ["occurrences", "--to", spelling],
                `T11.3-3 malformed \`--to\` spelling ` +
                  `${JSON.stringify(spelling)} — ${what} — on the failing ` +
                  `workspace`,
              );
            }
          },
          "T11.3-3 workspace 1 — no invocation of the sweep modifies " +
            "anything: the gate build fails writing nothing (SPEC 12.1) " +
            "and on a failing workspace these surfaces answer from current " +
            "sources and write nothing (SPEC 11.2; the no-write contract " +
            "clauses live at T11.2-1/T11.2-6)",
        );
      } finally {
        await workspace.dispose();
      }
    }

    // --- Workspace 2: selection is exact (valid ground). ----------------------
    {
      const workspace = await TestWorkspace.create({
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          [SEL_BASE_FILE]: SEL_BASE_SOURCE,
          [SEL_USE_FILE]: SEL_USE_SOURCE,
        },
      });
      try {
        await buildOk(
          product,
          workspace,
          "T11.3-3 `build` (premise: the selection workspace is valid, so " +
            "every answer below is complete and finding-free, SPEC 11.2, " +
            "11.3)",
        );

        // Staging pin: all four records exist in the unrestricted
        // enumeration, so each selection below provably filters a domain
        // that HOLDS the records it must exclude (the descendant's and the
        // root's records are absent from the `top` selection because of the
        // selection, never because they were never recorded).
        {
          const context =
            "T11.3-3 bare `occurrences` (staging pin: all four records)";
          const report = decodeOccurrencesReport(
            await runJson(
              product,
              workspace,
              ["occurrences"],
              `${context} — complete and finding-free, exit 0 (SPEC 11.2, ` +
                `11.3)`,
            ),
            context,
          );
          assertSameJson(
            report.findings,
            [],
            `${context}: the domain carries no finding (SPEC 11.2)`,
          );
          assertSameJson(
            report.occurrences.map(projectTuple),
            SEL_ALL_TUPLES,
            `${context}: the complete four-record sequence per index — ` +
              `\`useTop\`'s \`d\` entry and embedding (both targeting ` +
              `\`top\`), \`useSub\`'s record targeting the descendant ` +
              `\`top.sub\`, and the module-form \`d={BASE}\` record ` +
              `targeting the root (SPEC 2.2, 5.7, 11.3)`,
          );
        }

        // A resolving identity selects the occurrences targeting it — not
        // its descendants' and not the root's.
        {
          const context =
            "T11.3-3 `occurrences --to specs/BASE.mdx#top` (a resolving " +
            "identity)";
          const report = decodeOccurrencesReport(
            await runJson(
              product,
              workspace,
              ["occurrences", "--to", `${SEL_BASE_FILE}#top`],
              `${context} — complete and finding-free, exit 0 (SPEC 11.2, ` +
                `11.3)`,
            ),
            context,
          );
          assertSameJson(
            report.findings,
            [],
            `${context}: the domain carries no finding (SPEC 11.2)`,
          );
          assertSameJson(
            report.occurrences.map(projectTuple),
            [SEL_TOP_D, SEL_TOP_EMBED],
            `${context}: exactly the two records whose resolved target is ` +
              `\`top\` — the \`d\` entry and the embedding, whatever the ` +
              `edge kind — never the descendant \`top.sub\`'s record (a ` +
              `prefix- or subtree-selecting product fails here) and never ` +
              `the root-targeted one (SPEC 11.3, 5.7)`,
          );
        }

        // The complement: the descendant's own identity selects exactly its
        // record.
        {
          const context =
            "T11.3-3 `occurrences --to specs/BASE.mdx#top.sub` (the " +
            "descendant's own identity)";
          const report = decodeOccurrencesReport(
            await runJson(
              product,
              workspace,
              ["occurrences", "--to", `${SEL_BASE_FILE}#top.sub`],
              `${context} — complete and finding-free, exit 0 (SPEC 11.2, ` +
                `11.3)`,
            ),
            context,
          );
          assertSameJson(
            report.findings,
            [],
            `${context}: the domain carries no finding (SPEC 11.2)`,
          );
          assertSameJson(
            report.occurrences.map(projectTuple),
            [SEL_SUB_D],
            `${context}: exactly \`useSub\`'s record — the descendant's ` +
              `occurrences belong to the descendant's own identity, not ` +
              `to its parent's selection (SPEC 11.3)`,
          );
        }

        // A bare path selects module-form root references (T2.2-2).
        {
          const context =
            "T11.3-3 `occurrences --to specs/BASE.mdx` (a bare path — the " +
            "root)";
          const report = decodeOccurrencesReport(
            await runJson(
              product,
              workspace,
              ["occurrences", "--to", SEL_BASE_FILE],
              `${context} — complete and finding-free, exit 0 (SPEC 11.2, ` +
                `11.3)`,
            ),
            context,
          );
          assertSameJson(
            report.findings,
            [],
            `${context}: the domain carries no finding (SPEC 11.2)`,
          );
          assertSameJson(
            report.occurrences.map(projectTuple),
            [SEL_ROOT_D],
            `${context}: exactly the module-form \`d={BASE}\` record — the ` +
              `bare path names the file's root node (the path alone, SPEC ` +
              `1.5), so the selection is the root-targeted references ` +
              `(T2.2-2), never the file's section-targeted records (SPEC ` +
              `11.3, 2.2)`,
          );
        }
      } finally {
        await workspace.dispose();
      }
    }
  },
});

/** TEST-SPEC §11.3, in canonical ID order (SUITE-53). */
export const section113Tests: readonly ProductTestEntry[] = [
  T11_3_1,
  T11_3_2,
  T11_3_3,
];
