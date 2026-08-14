// TEST-SPEC §11.3 (`xspec occurrences`) — SUITE-53: T11.3-1.
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

import { Buffer } from "node:buffer";
import type {
  OccurrenceRecord,
  PathValue,
  SourceRange,
} from "../../helpers/adapters/index.js";
import { decodeOccurrencesReport } from "../../helpers/adapters/index.js";
import { fail, parseJsonStdout } from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
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
  assertSameJson,
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

/** TEST-SPEC §11.3, in canonical ID order (SUITE-53). */
export const section113Tests: readonly ProductTestEntry[] = [T11_3_1];
