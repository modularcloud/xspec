// TEST-SPEC §14 (validation errors: the reporting contract) — SUITE-49:
// T14-1 … T14-6.
//
// Sections 1–13 exercise each numbered condition in its home context; these
// are the reporting-contract tests: multi-error completeness with
// file/location/correction information (T14-1), the unresolved-reference
// conditions 14.5/14.6/14.7 plus the consumer-side type error (T14-2),
// masking by unparseable files and by configuration errors (T14-3), the
// reporter matrix — which of `build`/`check`/`review`/the machine-interface
// surfaces reports which condition (T14-4) — grammar selection by file
// name (T14-5), and the stable-code contract — each of the 23 conditions'
// exact token as the finding's `code`, `null` where 14 assigns none
// (T14-6).
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), decodes findings through the H-3 adapters,
// and rejects a product only via diagnosed assertion failures (H-8).
//
// Conservative operationalizations (noted per H-3/H-4):
// - "states a correction-oriented message" (T14-1): wording is free, so the
//   assertion is information presence — every finding carries a non-empty
//   human message, beside the file and location the same SPEC 14 sentence
//   demands; which phrasing counts as correction-oriented is not
//   machine-decidable (H-3). (14.2's assertable "expected form" statement is
//   T1.3-2's subject.)
// - MDX-staged conditions locate within the offending element's byte window:
//   every plausible attribution point — the reference expression, the prop,
//   the element itself — lies inside it, and every other staged construct
//   lies outside the end-widened window, so a finding attributed to the
//   wrong construct fails. Code-file conditions use the offending
//   statement's own window (the section-4 convention, support.ts byteWindow).
// - 14.20 locations (T14-3, T14-5): "the parse-failure location is reported"
//   fixes presence, not the point — where a parser gives up inside an
//   unparseable file is parser-specific — so the arms assert the finding
//   names the file and carries a location, never a window.
// - check-side condition counts set 14.10 staleness findings aside (the
//   T12.2-2/T13.4-6 rationale: whether prior or missing derived state is
//   detectably stale when the staged defect makes current generation
//   uncomputable is not settled by SPEC 13.3/14); the staged conditions are
//   counted exactly over the non-14.10 findings. `build`-side counts are
//   exact — `build` cannot observe 14.10 (SPEC 14.10, 12.1).
// - T14-4's 14.14 row: the 14.14 entry routes it through every command "as a
//   usage error (12.0), not a finding", so its both-reporters assertion is
//   the exit-2 contract (empty stdout under `--json`, stderr naming the
//   configuration) for `build` and `check` alike, never a findings row.
// - T14-4's 14.3 row tolerates one finding for the duplication or one per
//   occurrence (the T1.3-5 operationalization; SPEC 14.3 fixes no count) —
//   every reported finding must carry 14.3.
// - T14-4 stages each sweep condition in its minimal home form; per-condition
//   breadth belongs to the home-section tests (TEST-SPEC §14 preamble names
//   them). The sweep asserts reporter membership: the staged condition is
//   reported by `build` and by `check`.
// - T14-4's 14.21 arm asserts matrix membership — exit 1 with /corrupt/i on
//   stdout, the T10.1-4 operationalization — for one subcommand naming the
//   session (`review status`) and for `review list`; the all-subcommands
//   breadth and the fields-level list contract are T10.1-4's subject. The
//   failing-workspace half likewise asserts membership alone — `check`
//   reports 14.21 beside the gate's findings while `build`, `review status`,
//   and `review list` report exactly the gate's findings (the `--json`
//   findings report of the refusing reads, 12.7/13.3) — the every-subcommand
//   breadth, modifies-nothing compares, and bytes-untouched assertions being
//   T10.1-5's subject.
// - T14-4's 14.23 arm asserts reporter membership by exact condition counts:
//   `inventory` (the scoped `decodeInventoryFindings` decode) and a
//   `rename --preview` each carry exactly the one condition-23 finding;
//   `check` reports exactly one condition-10 finding (the unit form — so
//   never 14.23, never a per-file finding beside it on the freshly built,
//   otherwise clean workspace); a refreshing read (`query nodes`) and
//   `build` exit 0. Depth — `recorded`/`delta` unavailability, concerned
//   paths, record discipline, replacement — is T11.6-4's, T6.6-6's,
//   T12.2-2's, and T13.3-2's subject.
// - T14-4's 14.14 row includes `version`: exit 0 with a single JSON document
//   as its entire stdout (12.6 is JSON-only) on the same invalid
//   configuration that makes `build`/`check` exit 2 — the never-`version`
//   membership; the byte-identity and document-form depth is T12.6-1/2's.
// - T14-4's availability rows (SPEC 11.2): each sweep condition's finding
//   accompanies the answers of the surfaces whose domain can hold its staged
//   file — `occurrences`, `view`, and `at <file> 0` for a spec-source
//   staging (offset 0 is always a within-file offset of the non-empty staged
//   files; resolution is total, 11.5), `occurrences` alone for a code-source
//   one (14.7/14.11/14.18 locate in code sources alone; `view`'s and `at`'s
//   domains hold spec sources only) — each answer decoded through the
//   form-exact 12.7 document decoders (so the full answer member is emitted
//   beside the findings) at exit 1, its findings counted exactly like the
//   `build` side (these surfaces never report 14.10, which is `check`'s
//   alone, so no set-aside applies). 14.13 and 14.22 are instead the
//   findings of no domain file: one gated read (`query nodes`) reports
//   exactly the staged finding at exit 1 (the 13.3 gate; the six-read
//   breadth and modifies-nothing compares are T13.3-3's), while the three
//   surfaces answer finding-free at exit 0 over the staged valid spec
//   source. Per-surface semantics depth is T11.2-*..T11.5-*'s subject.
// - T14-6 stages each condition via its primary test's fixture — the same
//   minimal home-form stagings T14-4 sweeps, plus the five specially
//   reported conditions' stagings (14.10, 14.12, 14.14, 14.21, 14.23),
//   hoisted below and shared with T14-4's dedicated arms — and reads it
//   from ONE stated reporter of T14-4's matrix: `build` for every
//   both-reporter condition, `check` for 14.10/14.12/14.21, the exit-2
//   error document for 14.14, `inventory` for 14.23. Its assertion is the
//   code value alone: at least one finding, every finding carrying the
//   staged condition's exact token — sound because every staging stages
//   exactly one condition (T14-4 pins the counts; 14.3's per-occurrence
//   tolerance and several stale files under 14.10 both collapse into
//   "every finding carries the one staged token"). Count precision and
//   reporter breadth stay T14-4's and the home tests' subject; the
//   `code`-null arms mirror T12.7-3's plain-usage-error and T12.7-1's
//   review-refusal stagings, per T14-6's own citations.

import { Buffer } from "node:buffer";
import type { Finding, GraphEdge } from "../../helpers/adapters/index.js";
import {
  CONDITION_CODE_TOKENS,
  assertReportMentions,
  corruptGraphDataShapeBlind,
  decodeAtReport,
  decodeEdgesReport,
  decodeFindingsReport,
  decodeInventoryFindings,
  decodeOccurrencesReport,
  decodePreviewReport,
  decodeViewFilesReport,
} from "../../helpers/adapters/index.js";
import {
  assertExitCode,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import {
  assertCompileErrorAt,
  ConsumerProject,
} from "../../helpers/tooling.js";
import type { WorkspaceDecl } from "../../helpers/workspace.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import {
  assertConditionCounts,
  assertEdgeSetEqual,
  assertFindingLocated,
  assertSameJson,
  buildFindings,
  buildOk,
  byteWindow,
  expectConfigurationError,
  expectErrorDocument,
  expectExit,
  runCli,
  runJson,
} from "./support.js";

// ---------------------------------------------------------------------------
// Shared fixture material and helpers
// ---------------------------------------------------------------------------

// Minimal declarative configuration (SPEC 7): exactly one spec group.
const SPECS_ONLY_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`;

// One spec group plus one code group (SPEC 7.2): TypeScript files under
// `src/` are discovered code sources, so `build` analyzes their spec-module
// usage (4, 4.5).
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

/** One spec group over `specs/`, Markdown emission on or off (SPEC 7, 7.3). */
function markdownConfig(emit: boolean): string {
  return `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  markdown: { emit: ${String(emit)} }
})
`;
}

/** Stage a fresh workspace with the given entries, run `body`, dispose (H-1). */
async function withWorkspace<T>(
  decl: WorkspaceDecl,
  body: (workspace: TestWorkspace) => Promise<T>,
): Promise<T> {
  const workspace = await TestWorkspace.create(decl);
  try {
    return await body(workspace);
  } finally {
    await workspace.dispose();
  }
}

/**
 * Run `check --json` expecting findings: exit 1 (findings are exit-1
 * outcomes, SPEC 12.0, 12.2; H-5) with exactly one JSON document as the
 * entire stdout, decoded as the findings report (H-3).
 */
async function checkFindings(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
): Promise<readonly Finding[]> {
  const result = await expectExit(
    product,
    workspace,
    ["check", "--json"],
    1,
    `${context} — \`check\` exits 1 on any finding (SPEC 12.2, 12.0)`,
  );
  return decodeFindingsReport(parseJsonStdout(result, context), context)
    .findings;
}

/**
 * The check-side tolerance of the module header: 14.10 staleness findings
 * against staged corruption are set aside, everything else is counted.
 */
function nonStale(findings: readonly Finding[]): readonly Finding[] {
  return findings.filter((finding) => finding.condition !== "14.10");
}

/**
 * Run a JSON-only surface (or a `--json` invocation) expecting the exact
 * exit code (H-5) with exactly one JSON document as the entire stdout (SPEC
 * 12.0), returned parsed for the form-exact decoders — the counterpart of
 * support.ts `runJson` for answers that carry findings and therefore exit 1
 * with the full answer document still emitted (SPEC 11.2, 11.6, 6.6).
 */
async function runJsonExpecting(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  exitCode: number,
  context: string,
): Promise<unknown> {
  const result = await expectExit(product, workspace, argv, exitCode, context);
  return parseJsonStdout(result, context);
}

/**
 * Resolve the unique finding carrying `condition` (the caller has already
 * pinned the condition multiset, so a miss here is a diagnosed count defect).
 */
function findingOf(
  findings: readonly Finding[],
  condition: string,
  context: string,
): Finding {
  const matching = findings.filter(
    (finding) => finding.condition === condition,
  );
  if (matching.length !== 1) {
    fail(
      `${context}: expected exactly one condition-${condition} finding ` +
        `(SPEC 14); got ${String(matching.length)} among ` +
        JSON.stringify(findings.map((finding) => finding.condition)),
    );
  }
  return matching[0]!;
}

// 0xFF can occur in no valid UTF-8 sequence; everything else in the file is
// valid bytes, so 14.20 is the file's only reportable condition.
function withInvalidUtf8Byte(prefix: string, suffix: string): Uint8Array {
  return Buffer.concat([
    Buffer.from(prefix, "utf8"),
    Buffer.from([0xff]),
    Buffer.from(suffix, "utf8"),
  ]);
}

// A UTF-8 byte-order mark: a source beginning with it is unparseable
// (SPEC 1.6, 14.20). The workspace builder writes string contents with BOMs
// kept (S-2).
const BOM = "\u{FEFF}";

// The TSX-only construct shared by T14-3 (in a `.ts` file: fails 14.20) and
// T14-5 (in a `.tsx` file: parses; in an `.mts` file: fails 14.20). A JSX
// fragment is valid TSX and no plain-TypeScript production: in the plain
// grammar `<>` begins a type assertion with an empty type — a parse error
// wherever it appears.
const TSX_ONLY_STATEMENT = "const view = <>markup</>;";

// ---------------------------------------------------------------------------
// T14-1 — actionable and complete reporting
// ---------------------------------------------------------------------------

// Several independent error conditions across files, every fixture pure
// ASCII and assembled as prefix + offending construct + suffix so each
// finding's location window is precomputed from the parts' byte lengths.

// specs/one.mdx — 14.1: a non-root section without `id`.
const T14_1_ONE_PREFIX = '<S id="ok1">\nValid sibling.\n</S>\n\n';
const T14_1_ONE_CONSTRUCT = "<S>\nMissing id.\n</S>";

// specs/two.mdx — 14.4: an invalid segment (whitespace inside).
const T14_1_TWO_PREFIX = '<S id="ok2">\nValid sibling.\n</S>\n\n';
const T14_1_TWO_CONSTRUCT = '<S id="two seg">\nInvalid segment.\n</S>';

// specs/three.mdx — 14.5 and 14.6 in one file ("not only the first" within a
// file): an unresolved local `d` reference and an unresolved local `text`
// target, each in its own element.
const T14_1_THREE_PREFIX =
  "Preamble prose keeps the offending constructs off offset zero.\n\n";
const T14_1_THREE_D_CONSTRUCT =
  '<S id="t1" d={"absent.dep"}>\nUnknown dependency target.\n</S>';
const T14_1_THREE_MID = "\n\n";
const T14_1_THREE_TEXT_CONSTRUCT =
  '<S id="t2">\nUnknown text target:\n\n{text("absent.text")}\n</S>';

// specs/four.mdx — 14.16: a JSX element other than `<S>`/`<Spec>`.
const T14_1_FOUR_PREFIX = '<S id="ok4">\nValid sibling.\n</S>\n\n';
const T14_1_FOUR_CONSTRUCT = "<div>Not a section.</div>";

// src/five.ts — 14.7: an unresolved TypeScript marker (the import target
// `specs/ok.mdx` is valid, so the reference is the file's only defect).
const T14_1_FIVE_PREFIX = 'import OK from "../specs/ok.xspec";\n\n';
const T14_1_FIVE_CONSTRUCT = "OK.absent;";

const T14_1_FILES: Readonly<Record<string, string>> = {
  "xspec.config.ts": SPEC_AND_CODE_CONFIG,
  "specs/ok.mdx": '<S id="present">\nA resolvable target.\n</S>\n',
  "specs/one.mdx": `${T14_1_ONE_PREFIX}${T14_1_ONE_CONSTRUCT}\n`,
  "specs/two.mdx": `${T14_1_TWO_PREFIX}${T14_1_TWO_CONSTRUCT}\n`,
  "specs/three.mdx":
    T14_1_THREE_PREFIX +
    T14_1_THREE_D_CONSTRUCT +
    T14_1_THREE_MID +
    T14_1_THREE_TEXT_CONSTRUCT +
    "\n",
  "specs/four.mdx": `${T14_1_FOUR_PREFIX}${T14_1_FOUR_CONSTRUCT}\n`,
  "src/five.ts": `${T14_1_FIVE_PREFIX}${T14_1_FIVE_CONSTRUCT}\n`,
};

/** Where each staged condition must be located (module-header windows). */
const T14_1_EXPECTED: readonly {
  readonly condition: string;
  readonly file: string;
  readonly window: { readonly start: number; readonly end: number };
}[] = [
  {
    condition: "14.1",
    file: "specs/one.mdx",
    window: byteWindow(T14_1_ONE_PREFIX, T14_1_ONE_CONSTRUCT),
  },
  {
    condition: "14.4",
    file: "specs/two.mdx",
    window: byteWindow(T14_1_TWO_PREFIX, T14_1_TWO_CONSTRUCT),
  },
  {
    condition: "14.5",
    file: "specs/three.mdx",
    window: byteWindow(T14_1_THREE_PREFIX, T14_1_THREE_D_CONSTRUCT),
  },
  {
    condition: "14.6",
    file: "specs/three.mdx",
    window: byteWindow(
      T14_1_THREE_PREFIX + T14_1_THREE_D_CONSTRUCT + T14_1_THREE_MID,
      T14_1_THREE_TEXT_CONSTRUCT,
    ),
  },
  {
    condition: "14.16",
    file: "specs/four.mdx",
    window: byteWindow(T14_1_FOUR_PREFIX, T14_1_FOUR_CONSTRUCT),
  },
  {
    condition: "14.7",
    file: "src/five.ts",
    window: byteWindow(T14_1_FIVE_PREFIX, T14_1_FIVE_CONSTRUCT),
  },
];

/** The T14-1 report contract over one command's findings. */
function assertCompleteReport(
  findings: readonly Finding[],
  context: string,
): void {
  assertConditionCounts(
    findings,
    { "14.1": 1, "14.4": 1, "14.5": 1, "14.6": 1, "14.7": 1, "14.16": 1 },
    `${context} — every staged condition is reported, not only the first, ` +
      `across files and within one file (SPEC 14)`,
  );
  for (const expected of T14_1_EXPECTED) {
    const finding = findingOf(findings, expected.condition, context);
    assertFindingLocated(
      finding,
      { file: expected.file, window: expected.window },
      `${context}: the ${expected.condition} finding identifies its file ` +
        `and location (SPEC 14)`,
    );
    if (finding.message.trim() === "") {
      fail(
        `${context}: the ${expected.condition} finding must state a ` +
          `correction-oriented message — information presence, not wording ` +
          `(SPEC 14; H-3); got a blank message`,
      );
    }
  }
}

const T14_1 = defineProductTest({
  id: "T14-1",
  title:
    "a workspace seeded with several independent error conditions across files: `build` and `check` report each of them (not only the first), and every report identifies file and location and states a correction-oriented message — information presence, not wording (SPEC 14)",
  run: async (product) => {
    await withWorkspace({ files: T14_1_FILES }, async (workspace) => {
      const buildContext =
        "T14-1 `build --json` over six independent conditions in five files";
      assertCompleteReport(
        await buildFindings(product, workspace, buildContext),
        buildContext,
      );
      const checkContext =
        "T14-1 `check --json` over the same workspace (the non-14.10 " +
        "findings; see the module header)";
      assertCompleteReport(
        nonStale(await checkFindings(product, workspace, checkContext)),
        checkContext,
      );
    });
  },
});

// ---------------------------------------------------------------------------
// T14-2 — unresolved references, plus the consumer-side type error
// ---------------------------------------------------------------------------

// Initial, fully valid staging: `build` succeeds, so a prior valid
// generation of specs/base.xspec.ts exists — the state the type-error facet
// is asserted in (a later failing `build` modifies nothing, SPEC 12.1).
const T14_2_INITIAL_FILES: Readonly<Record<string, string>> = {
  "xspec.config.ts": SPEC_AND_CODE_CONFIG,
  "specs/base.mdx": '<S id="b1">\nBase behavior.\n</S>\n',
  "specs/ref.mdx": [
    'import BASE from "./base.xspec"',
    "",
    '<S id="r1" d={BASE.b1}>',
    "Valid dependency.",
    "</S>",
    "",
  ].join("\n"),
  "src/app.ts": [
    'import BASE, { text } from "../specs/base.xspec";',
    "",
    "BASE.b1;",
    "text(BASE.b1);",
    "",
  ].join("\n"),
};

// The edits staging the unresolved references, prefix + construct exact.
const T14_2_REF_PREFIX = 'import BASE from "./base.xspec"\n\n';
const T14_2_REF_D_CONSTRUCT =
  '<S id="r1" d={BASE.nodep}>\nUnknown dependency target.\n</S>';
const T14_2_REF_MID = "\n\n";
const T14_2_REF_TEXT_CONSTRUCT =
  '<S id="r2">\nUnknown text target:\n\n{text("notext")}\n</S>';

const T14_2_APP_PREFIX =
  'import BASE, { text } from "../specs/base.xspec";\n\n';
const T14_2_APP_MARKER = "BASE.nomark;";
const T14_2_APP_CALL = "text(BASE.nocall);";

const T14_2 = defineProductTest({
  id: "T14-2",
  title:
    "a `d` reference, a `text(...)` target, and a TypeScript marker and `text` call that do not resolve are 14.5, 14.6, and 14.7 respectively, each locating its reference; the TypeScript case is also a type error against the generated module, asserted while a prior valid generation exists (SPEC 14.5, 14.6, 14.7, 4.1)",
  run: async (product) => {
    await withWorkspace({ files: T14_2_INITIAL_FILES }, async (workspace) => {
      // Prior valid generation: the modules specs/base.xspec.ts and
      // specs/ref.xspec.ts exist after this build (SPEC 13.1).
      await buildOk(
        product,
        workspace,
        "T14-2 initial `build` (staging: a prior valid generation must " +
          "exist for the type-error facet, SPEC 12.1, 13.1)",
      );

      // Break every reference form: external `d`, local `text(...)`, and
      // the two TypeScript forms (marker; `text` call).
      await workspace.file(
        "specs/ref.mdx",
        T14_2_REF_PREFIX +
          T14_2_REF_D_CONSTRUCT +
          T14_2_REF_MID +
          T14_2_REF_TEXT_CONSTRUCT +
          "\n",
      );
      await workspace.file(
        "src/app.ts",
        `${T14_2_APP_PREFIX}${T14_2_APP_MARKER}\n${T14_2_APP_CALL}\n`,
      );

      const context =
        "T14-2 `build --json` over the four unresolved references";
      const findings = await buildFindings(product, workspace, context);
      assertConditionCounts(
        findings,
        { "14.5": 1, "14.6": 1, "14.7": 2 },
        `${context} — an unresolved \`d\` reference is 14.5, an unresolved ` +
          `\`text(...)\` target is 14.6, and each unresolved TypeScript ` +
          `reference (marker; \`text\` call) is 14.7 (SPEC 14.5–14.7)`,
      );
      assertFindingLocated(
        findingOf(findings, "14.5", context),
        {
          file: "specs/ref.mdx",
          window: byteWindow(T14_2_REF_PREFIX, T14_2_REF_D_CONSTRUCT),
        },
        `${context}: the 14.5 finding`,
      );
      assertFindingLocated(
        findingOf(findings, "14.6", context),
        {
          file: "specs/ref.mdx",
          window: byteWindow(
            T14_2_REF_PREFIX + T14_2_REF_D_CONSTRUCT + T14_2_REF_MID,
            T14_2_REF_TEXT_CONSTRUCT,
          ),
        },
        `${context}: the 14.6 finding`,
      );
      const typescriptFindings = findings
        .filter((finding) => finding.condition === "14.7")
        .slice()
        .sort(
          (a, b) =>
            (a.locations[0]?.range.start ?? -1) -
            (b.locations[0]?.range.start ?? -1),
        );
      assertFindingLocated(
        typescriptFindings[0]!,
        {
          file: "src/app.ts",
          window: byteWindow(T14_2_APP_PREFIX, T14_2_APP_MARKER),
        },
        `${context}: the marker's 14.7 finding`,
      );
      assertFindingLocated(
        typescriptFindings[1]!,
        {
          file: "src/app.ts",
          window: byteWindow(
            `${T14_2_APP_PREFIX}${T14_2_APP_MARKER}\n`,
            T14_2_APP_CALL,
          ),
        },
        `${context}: the \`text\` call's 14.7 finding`,
      );

      // The type-error facet: the failed build modified nothing (SPEC
      // 12.1), so the prior valid generation persists — against it, each
      // unresolved TypeScript reference is a type error at the reference
      // (SPEC 14.7: "this is also a type error against the generated
      // module").
      const project = await ConsumerProject.load({
        rootDir: workspace.root,
        rootFiles: ["src/app.ts"],
      });
      assertCompileErrorAt(
        project,
        project.locate("src/app.ts", T14_2_APP_MARKER, {
          charOffset: "BASE.".length,
        }),
        {},
        "T14-2 the unresolved marker must be a TypeScript type error " +
          "against the generated module (SPEC 14.7, 4.1)",
      );
      assertCompileErrorAt(
        project,
        project.locate("src/app.ts", T14_2_APP_CALL, {
          charOffset: "text(BASE.".length,
        }),
        {},
        "T14-2 the unresolved `text` argument must be a TypeScript type " +
          "error against the generated module (SPEC 14.7, 4.1)",
      );
    });
  },
});

// ---------------------------------------------------------------------------
// T14-3 — masking: unparseable files and configuration errors
// ---------------------------------------------------------------------------

// Four unparseable files (SPEC 14.20), each containing a would-be condition
// that must stay masked, plus otherwise-valid files referencing into them.
// The exact condition multiset is the masking assertion: any leaked in-file
// condition, and any reference reported as something other than unresolved,
// breaks it.

// Malformed MDX: the element holding the referenced id `bm1` is never
// closed, so the file fails to parse — the would-be 14.4 (`worse name`) is
// masked, and references targeting `bm1` (an id that would exist) are
// unresolved.
const T14_3_BROKEN_MDX = [
  '<S id="worse name">',
  "A would-be invalid segment (14.4), masked by the parse failure.",
  "</S>",
  "",
  '<S id="bm1">',
  "The target id the references aim at; the file never parses.",
].join("\n");

// Malformed TypeScript in a `.ts` file: the TSX-only construct (the grammar
// selected by any name but `.tsx` is plain TypeScript, SPEC 14.20). The
// would-be invalid import (14.15) above it is masked.
const T14_3_BROKEN_TS = [
  'import { S } from "./nonsense.xspec";',
  TSX_ONLY_STATEMENT,
  "",
].join("\n");

const T14_3_FILES: WorkspaceDecl = {
  files: {
    "xspec.config.ts": SPEC_AND_CODE_CONFIG,
    "specs/brokenmdx.mdx": T14_3_BROKEN_MDX,
    "src/brokents.ts": T14_3_BROKEN_TS,
    "specs/badutf8.mdx": withInvalidUtf8Byte(
      "<S>\nA would-be missing id (14.1), masked; the invalid byte: ",
      " ends parsing.\n</S>\n",
    ),
    "specs/bom.mdx":
      BOM + '<S id="also bad">\nA would-be 14.4, masked by the BOM.\n</S>\n',
    "specs/refs.mdx": [
      'import BROKEN from "./brokenmdx.xspec"',
      "",
      '<S id="rf1" d={BROKEN.bm1}>',
      "Dependency reference into the unparseable file.",
      "</S>",
      "",
      '<S id="rf2">',
      "Text reference into the unparseable file:",
      "",
      "{text(BROKEN.bm1)}",
      "</S>",
      "",
    ].join("\n"),
    "src/refs.ts": [
      'import BROKEN from "../specs/brokenmdx.xspec";',
      "",
      "BROKEN.bm1;",
      "",
    ].join("\n"),
    "specs/refs2.mdx": [
      'import BAD from "./badutf8.xspec"',
      'import BOMED from "./bom.xspec"',
      "",
      '<S id="rg1" d={BAD.u1}>',
      "Reference into the invalid-UTF-8 file.",
      "</S>",
      "",
      '<S id="rg2" d={BOMED.m1}>',
      "Reference into the BOM file.",
      "</S>",
      "",
    ].join("\n"),
  },
};

const T14_3_UNPARSEABLE_FILES: readonly string[] = [
  "specs/brokenmdx.mdx",
  "src/brokents.ts",
  "specs/badutf8.mdx",
  "specs/bom.mdx",
];

/** The T14-3 masking contract over one command's findings. */
function assertMaskingReport(
  findings: readonly Finding[],
  context: string,
): void {
  // The exact multiset: one 14.20 per unparseable file, one unresolved
  // reference per staged reference into them — and nothing from inside the
  // unparseable files (the masked would-be 14.1/14.4/14.15 must not leak).
  assertConditionCounts(
    findings,
    { "14.20": 4, "14.5": 3, "14.6": 1, "14.7": 1 },
    `${context} — each unparseable file is one 14.20, its in-file ` +
      `conditions are masked, and every reference into it reports as ` +
      `unresolved (SPEC 14, 14.20, 14.5–14.7)`,
  );
  for (const file of T14_3_UNPARSEABLE_FILES) {
    const matching = findings.filter((finding) =>
      finding.locations.some((location) => location.file === file),
    );
    if (matching.length !== 1 || matching[0]!.condition !== "14.20") {
      fail(
        `${context}: expected exactly one finding naming ` +
          `${JSON.stringify(file)}, carrying condition 14.20 (SPEC 14.20; ` +
          `everything inside an unparseable file is masked, SPEC 14); got ` +
          JSON.stringify(
            matching.map(({ condition, message }) => ({ condition, message })),
          ),
      );
    }
    // "The parse-failure location is reported": presence, per the module
    // header — where a parser fails inside an unparseable file is
    // parser-specific.
    assertFindingLocated(
      matching[0]!,
      { file },
      `${context}: the 14.20 finding for ${file} reports the parse-failure ` +
        `location (SPEC 14.20)`,
    );
  }
  const filesOf = (condition: string): string[] =>
    findings
      .filter((finding) => finding.condition === condition)
      .map((finding) => {
        const file = finding.locations[0]?.file;
        return typeof file === "string" ? file : "<no location>";
      })
      .sort();
  assertSameJson(
    filesOf("14.5"),
    ["specs/refs.mdx", "specs/refs2.mdx", "specs/refs2.mdx"],
    `${context} — the unresolved \`d\` references are the three staged ` +
      `references into the unparseable files (SPEC 14, 14.5)`,
  );
  assertSameJson(
    filesOf("14.6"),
    ["specs/refs.mdx"],
    `${context} — the unresolved \`text(...)\` target is the staged ` +
      `reference into the malformed MDX file (SPEC 14, 14.6)`,
  );
  assertSameJson(
    filesOf("14.7"),
    ["src/refs.ts"],
    `${context} — the unresolved TypeScript marker is the staged reference ` +
      `into the malformed MDX file (SPEC 14, 14.7)`,
  );
}

// The configuration-error arm: an unknown top-level key (SPEC 7, 14.14)
// beside sources that are themselves invalid.
const T14_3_CONFIG_ARM_FILES: Readonly<Record<string, string>> = {
  "xspec.config.ts": `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  bogus: true
})
`,
  "specs/invalid.mdx": "<S>\nMissing id (14.1), never analyzed.\n</S>\n",
  "specs/broken.mdx": '<S id="x">\nUnclosed element (14.20), never analyzed.\n',
};

const T14_3 = defineProductTest({
  id: "T14-3",
  title:
    "an unparseable file (14.20 — malformed MDX; a TSX-only construct in a `.ts` file; invalid UTF-8; BOM) masks conditions inside itself, every reference into it from other files reports as unresolved (14.5-14.7), and the parse-failure location is reported; a configuration error suppresses all source analysis — only 14.14 is reported (exit 2) even with invalid sources present (SPEC 14, 14.20, 14.14)",
  timeoutMs: 180_000,
  run: async (product) => {
    await withWorkspace(T14_3_FILES, async (workspace) => {
      const buildContext =
        "T14-3 `build --json` over four unparseable files and the " +
        "references into them";
      assertMaskingReport(
        await buildFindings(product, workspace, buildContext),
        buildContext,
      );
      const checkContext =
        "T14-3 `check --json` over the same workspace (the non-14.10 " +
        "findings; see the module header)";
      assertMaskingReport(
        nonStale(await checkFindings(product, workspace, checkContext)),
        checkContext,
      );
    });

    // Configuration-error arm: 14.14 precedes all source analysis — exit 2,
    // empty stdout under --json (no findings report at all), stderr naming
    // the configuration — for `build` and `check` alike, with invalid
    // sources present.
    await withWorkspace(
      { files: T14_3_CONFIG_ARM_FILES },
      async (workspace) => {
        await expectConfigurationError(
          product,
          workspace,
          ["build"],
          "T14-3 `build` under a configuration error with invalid sources " +
            "present — only 14.14 is reported, as a usage error suppressing " +
            "all source analysis (SPEC 14.14, 14, 12.0)",
        );
        await expectConfigurationError(
          product,
          workspace,
          ["check"],
          "T14-3 `check` under the same configuration error — the " +
            "suppression holds for every command (SPEC 14.14, 14, 12.0)",
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T14-4 — reporter matrix
// ---------------------------------------------------------------------------

// One minimal staging per both-reporter condition (the sweep of the T14-4
// text: "every other condition reported by both `build` and `check`").
interface SweepEntry {
  readonly condition: string;
  readonly label: string;
  readonly decl: WorkspaceDecl;
  /** Extra staging that must run before the assertions (e.g. a prior build). */
  readonly prepare?: (
    product: ProductBinding,
    workspace: TestWorkspace,
  ) => Promise<void>;
  /**
   * SPEC fixes no count for this condition: accept one finding for the
   * staged defect or one per occurrence (the T1.3-5 operationalization).
   */
  readonly perOccurrenceTolerated?: boolean;
  /**
   * Which machine-interface answers the staged condition accompanies (the
   * T14-4 availability rows; SPEC 11.2, module header): a spec-source
   * staging accompanies all three of `occurrences`/`view`/`at <file> 0`; a
   * code-source staging accompanies `occurrences` alone (`view`'s and
   * `at`'s domains hold spec sources only, 11.4/11.5); the conditions of no
   * domain file (14.13, 14.22) accompany none of them — they are instead
   * reported by the gated reads (13.3), probed via `query nodes`, while the
   * three surfaces answer finding-free at exit 0 over `file`, the staging's
   * valid spec source.
   */
  readonly answers:
    | { readonly kind: "spec-source"; readonly file: string }
    | { readonly kind: "code-source" }
    | { readonly kind: "no-domain-file"; readonly file: string };
}

/** Shorthand: a specs-only workspace whose one source stages the condition. */
function specArm(condition: string, label: string, source: string): SweepEntry {
  return {
    condition,
    label,
    decl: {
      files: { "xspec.config.ts": SPECS_ONLY_CONFIG, "specs/a.mdx": source },
    },
    answers: { kind: "spec-source", file: "specs/a.mdx" },
  };
}

/** Shorthand: a valid spec plus one code file staging the condition. */
function codeArm(condition: string, label: string, source: string): SweepEntry {
  return {
    condition,
    label,
    decl: {
      files: {
        "xspec.config.ts": SPEC_AND_CODE_CONFIG,
        "specs/s.mdx": '<S id="n1">\nCode-referenced behavior.\n</S>\n',
        "src/app.ts": source,
      },
    },
    answers: { kind: "code-source" },
  };
}

const GARBAGE_JOURNAL_LINE =
  "?? harness-injected garbage: not a journal entry ??\n";

const SWEEP_ENTRIES: readonly SweepEntry[] = [
  specArm("14.1", "missing ID", "<S>\nNo id.\n</S>\n"),
  specArm(
    "14.2",
    "invalid structural ID",
    [
      '<S id="p">',
      "Parent.",
      "",
      '<S id="q.r">',
      "A child whose ID does not extend the parent's.",
      "</S>",
      "</S>",
      "",
    ].join("\n"),
  ),
  {
    ...specArm(
      "14.3",
      "duplicate ID within a file",
      [
        '<S id="dup">',
        "First occurrence.",
        "</S>",
        "",
        '<S id="dup">',
        "Second occurrence.",
        "</S>",
        "",
      ].join("\n"),
    ),
    perOccurrenceTolerated: true,
  },
  specArm(
    "14.4",
    "invalid segment",
    '<S id="bad name">\nInvalid segment.\n</S>\n',
  ),
  specArm(
    "14.5",
    "unknown dependency",
    '<S id="a" d={"nope"}>\nUnknown dependency target.\n</S>\n',
  ),
  specArm(
    "14.6",
    "unknown text target",
    '<S id="a">\nBody:\n\n{text("nada")}\n</S>\n',
  ),
  codeArm(
    "14.7",
    "unknown TypeScript reference",
    ['import SPEC from "../specs/s.xspec";', "", "SPEC.missing;", ""].join(
      "\n",
    ),
  ),
  specArm(
    "14.8",
    "invalid argument",
    '<S id="a" d={42}>\nNon-static dependency value.\n</S>\n',
  ),
  specArm(
    "14.9",
    "dependency cycle",
    '<S id="s" d={"s"}>\nDepends on itself.\n</S>\n',
  ),
  {
    condition: "14.11",
    label: "cross-module text call",
    decl: {
      files: {
        "xspec.config.ts": SPEC_AND_CODE_CONFIG,
        "specs/alpha.mdx": '<S id="first">\nAlpha behavior.\n</S>\n',
        "specs/bravo.mdx": '<S id="second">\nBravo behavior.\n</S>\n',
        "src/app.ts": [
          'import ALPHA from "../specs/alpha.xspec";',
          'import { text as textB } from "../specs/bravo.xspec";',
          "",
          "textB(ALPHA.first);",
          "",
        ].join("\n"),
      },
    },
    answers: { kind: "code-source" },
  },
  {
    condition: "14.13",
    label: "journal error",
    decl: {
      files: {
        "xspec.config.ts": SPECS_ONLY_CONFIG,
        "specs/a.mdx": '<S id="a1">\nValid behavior.\n</S>\n',
      },
    },
    prepare: async (product, workspace) => {
      await buildOk(
        product,
        workspace,
        "section-14 (journal error) staging `build` (SPEC 12.1; the " +
          "staging is shared by T14-4's sweep and T14-6's)",
      );
      await workspace.file(".xspec/journal", GARBAGE_JOURNAL_LINE);
    },
    answers: { kind: "no-domain-file", file: "specs/a.mdx" },
  },
  specArm(
    "14.15",
    "invalid import",
    [
      'import X from "./missing.xspec"',
      "",
      '<S id="a">',
      "The import designates no discovered spec source.",
      "</S>",
      "",
    ].join("\n"),
  ),
  specArm(
    "14.16",
    "invalid construct",
    '<S id="a">\nBody.\n</S>\n\n<div>Not a section.</div>\n',
  ),
  specArm(
    "14.17",
    "invalid prop",
    '<S id="a" bogus="1">\nUnknown prop.\n</S>\n',
  ),
  codeArm(
    "14.18",
    "unsupported node usage",
    [
      'import SPEC from "../specs/s.xspec";',
      "",
      "const alias = SPEC.n1;",
      "",
    ].join("\n"),
  ),
  {
    condition: "14.19",
    label: "invalid source path",
    decl: {
      files: {
        "xspec.config.ts": SPECS_ONLY_CONFIG,
        "specs/a#b.mdx": '<S id="a">\nValid content, invalid path.\n</S>\n',
      },
    },
    // The `#`-containing path is valid UTF-8, so the file is nameable by an
    // argument value: it keeps its parse-local view, every node identity in
    // it explicitly unavailable, its condition-19 finding accompanying every
    // answer whose consulted domain includes it (SPEC 11.2, 11.4, 11.5).
    answers: { kind: "spec-source", file: "specs/a#b.mdx" },
  },
  specArm("14.20", "unparseable source", '<S id="x">\nUnclosed element.\n'),
  {
    condition: "14.22",
    label: "symbolic link in a write path",
    decl: {
      files: {
        "xspec.config.ts": `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  markdown: { emit: true, outDir: "out" }
})
`,
        "specs/a.mdx": '<S id="a1">\nValid behavior.\n</S>\n',
      },
      dirs: ["real-out"],
      symlinks: { out: "real-out" },
    },
    answers: { kind: "no-domain-file", file: "specs/a.mdx" },
  },
];

// ---------------------------------------------------------------------------
// Stagings shared by T14-4's dedicated reporter arms and T14-6's stable-code
// sweep — one per specially-reported condition, each the minimal
// primary-fixture form of the TEST-SPEC 14 preamble's per-condition record
// ---------------------------------------------------------------------------

// 14.10 (T12.2-2's fixture): build, then edit the source — Markdown emission
// on, so the emitted file's bytes are the compiled source and the staged
// staleness is certainly detectable.
const STALE_DECL: WorkspaceDecl = {
  files: {
    "xspec.config.ts": markdownConfig(true),
    "specs/a.mdx": '<S id="a1">\nAlpha behavior.\n</S>\n',
  },
};
const STALE_EDIT = '<S id="a1">\nAlpha behavior, edited.\n</S>\n';

// 14.12 (T7.5-2's fixture): one forbidden rule, one violating dependence.
const POLICY_DECL: WorkspaceDecl = {
  files: {
    "xspec.config.ts": `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    hi: ["hi/**/*.mdx"],
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
    "hi/H.mdx": [
      'import L from "../lo/L.xspec"',
      "",
      '<S id="h1" d={L.l1}>',
      "Violating dependence.",
      "</S>",
      "",
    ].join("\n"),
    "lo/L.mdx": ['<S id="l1">', "Low one.", "</S>", ""].join("\n"),
  },
};

// A minimal valid workspace (one spec group, one valid source): the ground
// the 14.21/14.23 corruptions — and T14-6's code-null arms — are staged on.
const VALID_SPECS_DECL: WorkspaceDecl = {
  files: {
    "xspec.config.ts": SPECS_ONLY_CONFIG,
    "specs/a.mdx": '<S id="a1">\nValid behavior.\n</S>\n',
  },
};

// 14.21 (T10.1-4's fixture): a session file that cannot be parsed.
const GARBAGE_SESSION_PATH = ".xspec/reviews/bad.json";
const GARBAGE_SESSION_CONTENT = "{ this is not a parseable session";

// 14.14 (the T7-2 attribution discipline, as in T14-3's configuration arm):
// the canonical valid configuration plus one unknown top-level key, so the
// error is attributable to that one defect, beside a valid source.
const BOGUS_KEY_DECL: WorkspaceDecl = {
  files: {
    "xspec.config.ts": `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  bogus: true
})
`,
    "specs/a.mdx": '<S id="a1">\nValid behavior.\n</S>\n',
  },
};

/**
 * One availability-surface probe (SPEC 11.2, 11.3–11.5): the invocation
 * paired with the form-exact 12.7 document decode, so asserting the decoded
 * findings also asserts the full answer member is emitted beside them.
 */
interface AvailabilityProbe {
  readonly what: string;
  readonly argv: readonly string[];
  readonly findingsOf: (doc: unknown, context: string) => readonly Finding[];
}

/** `occurrences` alone — the one surface whose domain holds code sources. */
const OCCURRENCES_PROBE: AvailabilityProbe = {
  what: "`occurrences`",
  argv: ["occurrences"],
  findingsOf: (doc, context) => decodeOccurrencesReport(doc, context).findings,
};

/**
 * All three surfaces over one staged spec source. `at` probes offset 0 — a
 * within-file offset of every (non-empty) staged file; resolution is total
 * over the file (11.5), so the answer never turns on the offset choice.
 */
function availabilityProbes(file: string): readonly AvailabilityProbe[] {
  return [
    OCCURRENCES_PROBE,
    {
      what: "`view`",
      argv: ["view"],
      findingsOf: (doc, context) =>
        decodeViewFilesReport(doc, context).findings,
    },
    {
      what: `\`at ${file} 0\``,
      argv: ["at", file, "0"],
      findingsOf: (doc, context) => decodeAtReport(doc, context).findings,
    },
  ];
}

/** One command's sweep assertion (build exact; check over non-14.10). */
function assertSweepFindings(
  findings: readonly Finding[],
  entry: SweepEntry,
  context: string,
): void {
  if (entry.perOccurrenceTolerated) {
    const conditions = findings.map((finding) => finding.condition);
    if (
      findings.length < 1 ||
      findings.length > 2 ||
      conditions.some((condition) => condition !== entry.condition)
    ) {
      fail(
        `${context}: expected the staged ${entry.label} to report condition ` +
          `${entry.condition} — one finding for the defect, or one per ` +
          `occurrence (SPEC 14.3 fixes no count; the T1.3-5 ` +
          `operationalization) — got ${JSON.stringify(conditions)}`,
      );
    }
    return;
  }
  assertConditionCounts(findings, { [entry.condition]: 1 }, context);
}

const T14_4 = defineProductTest({
  id: "T14-4",
  title:
    "the reporter matrix: 14.10 and 14.12 reported by `check` only (a stale workspace `build`s successfully by regenerating; a policy-violating workspace `build`s successfully); 14.21 reported by `check`, by `review` subcommands naming the session, and by `review list` — not by `build`, and on a workspace failing `build`'s validations by `check` alone, beside the gate's findings; 14.23 reported by `inventory` and `rename`/`move` previews only — `check` reports the state as 14.10's unit form, and `build` and the refreshing reads never do; 14.14 as the every-command usage error — never `version`; 14.13 and 14.22 reported by `build`, `check`, and the gated reads, yet accompanying no `occurrences`/`view`/`at` answer; every other condition reported by both `build` and `check`, and as a domain file's finding accompanying the answers of each of `occurrences`/`view`/`at` whose domain can hold its staged file — all three for a spec-source staging, `occurrences` alone for a code-source one (SPEC 14, 12.1, 12.2, 10.1, 13.3, 11.2, 11.3-11.6, 6.6, 12.6)",
  timeoutMs: 480_000,
  run: async (product) => {
    // --- 14.10: check-only. A stale workspace `build`s successfully by
    // regenerating (STALE_DECL: Markdown emission on, so the staged
    // staleness is certainly detectable).
    await withWorkspace(STALE_DECL, async (workspace) => {
      await buildOk(
        product,
        workspace,
        "T14-4 (14.10) staging `build` (SPEC 12.1)",
      );
      await workspace.file("specs/a.mdx", STALE_EDIT);
      const context = "T14-4 (14.10) `check --json` on the stale workspace";
      const findings = await checkFindings(product, workspace, context);
      if (
        findings.length === 0 ||
        findings.some((finding) => finding.condition !== "14.10")
      ) {
        fail(
          `${context}: staleness is the workspace's only staged error ` +
            `condition, so \`check\` reports at least one finding and ` +
            `every finding is 14.10 (SPEC 12.2, 14.10); got ` +
            JSON.stringify(findings.map((finding) => finding.condition)),
        );
      }
      await expectExit(
        product,
        workspace,
        ["build"],
        0,
        "T14-4 (14.10) `build` on the stale workspace — `build` cannot " +
          "observe staleness because it regenerates every derived file: " +
          "14.10 is reported by `check` only (SPEC 14.10, 12.1)",
      );
      await expectExit(
        product,
        workspace,
        ["check"],
        0,
        "T14-4 (14.10) `check` after the rebuild — the successful " +
          "`build` resolved the staleness by regenerating (SPEC 12.1, 14.10)",
      );
    });

    // --- 14.12: check-only. A policy-violating workspace `build`s
    // successfully; `check` reports the violation (POLICY_DECL).
    await withWorkspace(POLICY_DECL, async (workspace) => {
      await buildOk(
        product,
        workspace,
        "T14-4 (14.12) `build` over the policy-violating workspace — " +
          "policy violations are `check` findings, and `build` succeeds " +
          "and regenerates regardless (SPEC 14.12, 12.1, 7.5)",
      );
      assertConditionCounts(
        await checkFindings(product, workspace, "T14-4 (14.12) `check --json`"),
        { "14.12": 1 },
        "T14-4 (14.12) `check` reports the one violating edge — the " +
          "freshly built workspace stages nothing else (SPEC 14.12, 12.2)",
      );
    });

    // --- 14.21: reported by `check`, by `review` subcommands naming the
    // session, and by `review list` — not by `build` (VALID_SPECS_DECL plus
    // the garbage session file).
    await withWorkspace(VALID_SPECS_DECL, async (workspace) => {
      await buildOk(
        product,
        workspace,
        "T14-4 (14.21) staging `build` (SPEC 12.1)",
      );
      await workspace.file(GARBAGE_SESSION_PATH, GARBAGE_SESSION_CONTENT);
      await expectExit(
        product,
        workspace,
        ["build"],
        0,
        "T14-4 (14.21) `build` beside the corrupt session — `build` does " +
          "not read sessions, so 14.21 is not its finding (SPEC 14.21)",
      );
      assertConditionCounts(
        await checkFindings(product, workspace, "T14-4 (14.21) `check --json`"),
        { "14.21": 1 },
        "T14-4 (14.21) `check` reports the one corrupt session — the " +
          "just-rebuilt workspace stages nothing else (SPEC 14.21, 12.2)",
      );
      for (const argv of [
        ["review", "status", "bad"],
        ["review", "list"],
      ] as const) {
        const context = `T14-4 (14.21) \`${argv.join(" ")}\``;
        const result = await runCli(product, workspace, argv);
        assertExitCode(
          result,
          1,
          `${context} — a review subcommand naming a corrupt session, and ` +
            `\`review list\` reporting one, exit 1 (SPEC 14.21, 10.1, ` +
            `10.7, 12.0)`,
        );
        assertReportMentions(
          result,
          [/corrupt/i],
          `${context} — the report identifies the session as corrupt ` +
            `(SPEC 10.1/14.21 vocabulary; findings are standard-output ` +
            `content, 12.0; information presence, never exact wording, H-3)`,
        );
      }

      // On a workspace failing `build`'s validations, 14.21 is reported
      // by `check` alone, beside the gate's findings: no session is read
      // on the failing side, so the gated `review` reads report exactly
      // the gate's findings — the validation errors, no condition-21
      // finding beside them (SPEC 14.21, 13.3, 10.1; membership only, the
      // module header — the every-subcommand breadth, modifies-nothing
      // compares, and bytes-untouched assertions are T10.1-5's).
      await workspace.file("specs/a.mdx", "<S>\nNo id.\n</S>\n");
      assertConditionCounts(
        await buildFindings(
          product,
          workspace,
          "T14-4 (14.21, failing workspace) `build --json`",
        ),
        { "14.1": 1 },
        "T14-4 (14.21, failing workspace) `build` reports the validation " +
          "error alone — `build` does not read sessions, so 14.21 is " +
          "never its finding (SPEC 14.21, 12.1)",
      );
      assertConditionCounts(
        nonStale(
          await checkFindings(
            product,
            workspace,
            "T14-4 (14.21, failing workspace) `check --json`",
          ),
        ),
        { "14.1": 1, "14.21": 1 },
        "T14-4 (14.21, failing workspace) `check` reports 14.21 beside " +
          "the failing workspace's other findings — the validation error " +
          "and the corrupt session together, counted exactly over the " +
          "non-14.10 findings (SPEC 14.21, 12.2; module header)",
      );
      for (const argv of [
        ["review", "status", "bad", "--json"],
        ["review", "list", "--json"],
      ] as const) {
        const context = `T14-4 (14.21, failing workspace) \`${argv.join(" ")}\``;
        const result = await expectExit(
          product,
          workspace,
          argv,
          1,
          `${context} — on a workspace failing \`build\`'s validations a ` +
            `gated read reports the gate's findings and exits 1 without ` +
            `answering (SPEC 13.3, 12.0)`,
        );
        assertConditionCounts(
          decodeFindingsReport(parseJsonStdout(result, context), context)
            .findings,
          { "14.1": 1 },
          `${context} — exactly the gate's findings: no session file is ` +
            `read on a failing workspace, so no condition-21 finding is ` +
            `reported beside them — on this workspace 14.21 is \`check\`'s ` +
            `alone (SPEC 14.21, 13.3, 10.1; depth: T10.1-5)`,
        );
      }
    });

    // --- 14.23: reported by `inventory` and `rename`/`move` previews only —
    // `check` reports the state as 14.10's unit form, and `build` and the
    // refreshing reads never do: the rebuild replaces the record; the reads
    // leave it unconsulted (SPEC 14.23, 14.10, 13.3, 11.6, 6.6; membership
    // by exact counts per the module header — depth: T11.6-4, T6.6-6,
    // T12.2-2, T13.3-2). Staged on VALID_SPECS_DECL.
    await withWorkspace(VALID_SPECS_DECL, async (workspace) => {
      await buildOk(
        product,
        workspace,
        "T14-4 (14.23) staging `build` — the corruption applies to a " +
          "record the product itself wrote (SPEC 12.1, 13.3; H-3)",
      );
      await corruptGraphDataShapeBlind(workspace.root, "T14-4 (14.23)");

      const inventoryContext = "T14-4 (14.23) `inventory`";
      assertConditionCounts(
        decodeInventoryFindings(
          await runJsonExpecting(
            product,
            workspace,
            ["inventory"],
            1,
            `${inventoryContext} — the condition-23 finding accompanies ` +
              `the answer and the invocation exits 1 (SPEC 14.23, 11.6)`,
          ),
          inventoryContext,
        ),
        { "14.23": 1 },
        `${inventoryContext} — the unreadable record is the inventory ` +
          `answer's one finding on the otherwise clean workspace (SPEC ` +
          `14.23, 11.6)`,
      );

      const previewContext =
        "T14-4 (14.23) `rename specs/a.mdx a1 a2 --preview --json`";
      assertConditionCounts(
        decodePreviewReport(
          await runJsonExpecting(
            product,
            workspace,
            ["rename", "specs/a.mdx", "a1", "a2", "--preview", "--json"],
            1,
            `${previewContext} — the condition-23 finding accompanies the ` +
              `answer and the invocation exits 1 (SPEC 14.23, 6.6)`,
          ),
          previewContext,
        ).findings,
        { "14.23": 1 },
        `${previewContext} — the preview consults the record for its ` +
          `delta, so the otherwise valid plan's report carries exactly ` +
          `the condition-23 finding (SPEC 14.23, 6.6; the delta's ` +
          `unavailability and the plan's completeness are T6.6-6's)`,
      );

      assertConditionCounts(
        await checkFindings(product, workspace, "T14-4 (14.23) `check --json`"),
        { "14.10": 1 },
        "T14-4 (14.23) `check` reports the state as staleness — exactly " +
          "one condition-10 finding, the unit form: never 14.23, never " +
          "the mismatch form or a per-file finding beside it on the " +
          "freshly built, otherwise clean workspace (SPEC 14.23, 14.10; " +
          "depth: T12.2-2)",
      );

      await expectExit(
        product,
        workspace,
        ["query", "nodes"],
        0,
        "T14-4 (14.23) `query nodes` on the corrupt-record state — the " +
          "refreshing reads never report 14.23: they leave the record " +
          "unconsulted and answer finding-free, exit 0 (SPEC 14.23, 13.3; " +
          "depth: T13.3-2)",
      );

      await expectExit(
        product,
        workspace,
        ["build"],
        0,
        "T14-4 (14.23) `build` on the corrupt-record state — `build` " +
          "never reports 14.23: its rebuild replaces the record (SPEC " +
          "14.23, 12.1)",
      );
      await expectExit(
        product,
        workspace,
        ["check"],
        0,
        "T14-4 (14.23) `check` after the rebuild — the successful " +
          "`build` replaced the unreadable state (SPEC 14.23, 12.1, 13.3)",
      );
    });

    // --- 14.14: reported by `build` and `check` alike — as the
    // every-command usage error of its entry (exit 2, not a finding).
    // Staged on BOGUS_KEY_DECL.
    await withWorkspace(BOGUS_KEY_DECL, async (workspace) => {
      await expectConfigurationError(
        product,
        workspace,
        ["build"],
        "T14-4 (14.14) `build` under an unknown configuration key " +
          "(SPEC 14.14, 7, 12.0)",
      );
      await expectConfigurationError(
        product,
        workspace,
        ["check"],
        "T14-4 (14.14) `check` under the same configuration (SPEC 14.14, " +
          "7, 12.0)",
      );

      // Never `version`: it loads no configuration, so configuration-error
      // precedence cannot reach it — on the same invalid configuration
      // that makes `build`/`check` exit 2, `version` answers at exit 0
      // with a single JSON document as its entire stdout (12.6 is
      // JSON-only). Membership only; the byte-identity and document-form
      // depth is T12.6-1/2's.
      const versionContext =
        "T14-4 (14.14) `version` under the same invalid configuration";
      parseJsonStdout(
        await expectExit(
          product,
          workspace,
          ["version"],
          0,
          `${versionContext} — \`version\` loads no configuration and ` +
            `cannot fail for workspace or configuration reasons: 14.14 is ` +
            `delivered by every command that loads configuration, never ` +
            `\`version\` (SPEC 12.6, 14.14)`,
        ),
        `${versionContext} — a JSON-only surface: a single JSON document ` +
          `is its only output form, with or without --json (SPEC 12.6, 12.0)`,
      );
    });

    // --- Every other condition: reported by both `build` and `check`, and
    // per its staging's kind by the machine-interface answers (SPEC 11.2;
    // the availability rows of the module header). 14.13 and 14.22 instead
    // ride the gated reads and accompany no such answer.
    for (const entry of SWEEP_ENTRIES) {
      await withWorkspace(entry.decl, async (workspace) => {
        await entry.prepare?.(product, workspace);
        const buildContext = `T14-4 (${entry.label}) \`build --json\``;
        assertSweepFindings(
          await buildFindings(product, workspace, buildContext),
          entry,
          `${buildContext} — condition ${entry.condition} is a \`build\` ` +
            `finding, counted exactly (\`build\` cannot observe 14.10; ` +
            `SPEC 14, 12.1)`,
        );
        const checkContext = `T14-4 (${entry.label}) \`check --json\``;
        assertSweepFindings(
          nonStale(await checkFindings(product, workspace, checkContext)),
          entry,
          `${checkContext} — condition ${entry.condition} is a \`check\` ` +
            `finding, counted exactly over the non-14.10 findings (see the ` +
            `module header; SPEC 14, 12.2)`,
        );

        if (entry.answers.kind === "no-domain-file") {
          // Reported by the gated reads (SPEC 13.3: the gate is over every
          // finding a `build` would report — journal errors and refused
          // writes alike), probed via one read; the six-read breadth and
          // modifies-nothing compares are T13.3-3's.
          const gatedContext = `T14-4 (${entry.label}) \`query nodes\``;
          assertSweepFindings(
            decodeFindingsReport(
              await runJsonExpecting(
                product,
                workspace,
                ["query", "nodes"],
                1,
                `${gatedContext} — a gated read on the failing workspace ` +
                  `reports the gate's findings and exits 1 without ` +
                  `answering (SPEC 13.3, 12.0)`,
              ),
              gatedContext,
            ).findings,
            entry,
            `${gatedContext} — condition ${entry.condition} is the gated ` +
              `reads' finding, exactly as a \`build\`'s (SPEC 13.3, 14; ` +
              `depth: T13.3-3)`,
          );
          // ...yet accompanying no `occurrences`/`view`/`at` answer: the
          // condition is the finding of no domain file — the journal and a
          // write-path component are never domain files — so these
          // surfaces answer finding-free at exit 0 over the staged valid
          // spec source (SPEC 11.2; depth: T11.2-6).
          for (const probe of availabilityProbes(entry.answers.file)) {
            const context = `T14-4 (${entry.label}) ${probe.what}`;
            assertConditionCounts(
              probe.findingsOf(
                await runJson(
                  product,
                  workspace,
                  probe.argv,
                  `${context} — a complete, finding-free answer exits 0 ` +
                    `whatever journal or write-path state the workspace ` +
                    `holds (SPEC 11.2)`,
                ),
                context,
              ),
              {},
              `${context} — condition ${entry.condition} is the finding of ` +
                `no domain file, so it accompanies no answer of this ` +
                `surface (SPEC 11.2, 14; depth: T11.2-6)`,
            );
          }
          return;
        }

        // A domain file's finding accompanies the answers of each surface
        // whose domain can hold its staged file: all three for a
        // spec-source staging; `occurrences` alone for a code-source one —
        // 14.7/14.11/14.18 locate in code sources alone, and `view`'s and
        // `at`'s domains hold spec sources only (SPEC 11.2, 11.3-11.5;
        // depth: T11.2-5).
        const probes =
          entry.answers.kind === "spec-source"
            ? availabilityProbes(entry.answers.file)
            : [OCCURRENCES_PROBE];
        for (const probe of probes) {
          const context = `T14-4 (${entry.label}) ${probe.what}`;
          assertSweepFindings(
            probe.findingsOf(
              await runJsonExpecting(
                product,
                workspace,
                probe.argv,
                1,
                `${context} — an answer carrying any finding exits 1 with ` +
                  `the full answer document still emitted (SPEC 11.2)`,
              ),
              context,
            ),
            entry,
            `${context} — condition ${entry.condition} is a domain file's ` +
              `finding and accompanies the answer, counted exactly (these ` +
              `surfaces never report 14.10, which is \`check\`'s alone; ` +
              `SPEC 11.2, 11.3-11.5, 14)`,
          );
        }
      });
    }
  },
});

// ---------------------------------------------------------------------------
// T14-5 — grammar selection by file name
// ---------------------------------------------------------------------------

// One named unit holding a dependency marker, a `text(...)` call, and the
// TSX-only construct. The same bytes serve the `.tsx` arm (parses as TSX,
// SPEC 14.20) and the `.mts` arm (any name but `.tsx` selects plain
// TypeScript — the fragment fails 14.20 exactly as T14-3's `.ts` arm does).
const T14_5_UNIT_SOURCE = [
  'import SPEC, { text } from "../specs/U.xspec";',
  "",
  "function render(): void {",
  "  SPEC.t1;",
  "  text(SPEC.t2);",
  `  ${TSX_ONLY_STATEMENT}`,
  "  void view;",
  "}",
  "",
].join("\n");

const T14_5_SPEC_SOURCE = [
  '<S id="t1">',
  "Marker target.",
  "</S>",
  "",
  '<S id="t2">',
  "Embedded target.",
  "</S>",
  "",
].join("\n");

function codeGroupConfig(glob: string): string {
  return `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: {
    app: ["${glob}"]
  }
})
`;
}

const T14_5 = defineProductTest({
  id: "T14-5",
  title:
    "a code-group file named `.tsx` holding a TSX-only construct inside a named unit with a dependency marker and a `text(...)` call: `build` succeeds — `.tsx` parses as TSX — and the marker's `references` edge and the call's `embeds` edge attribute to that unit per 4.6; the same construct in a code-group `.mts` file fails 14.20 identically — any name but `.tsx` selects plain TypeScript (SPEC 14.20, 4.6)",
  run: async (product) => {
    // Positive arm: `.tsx` parses as TSX, and both edges are recorded and
    // attributed to the enclosing named unit.
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": codeGroupConfig("src/**/*.tsx"),
          "specs/U.mdx": T14_5_SPEC_SOURCE,
          "src/view.tsx": T14_5_UNIT_SOURCE,
        },
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T14-5 `build` over the `.tsx` code file — the file name selects " +
            "the TSX grammar, so the fragment parses (SPEC 14.20)",
        );
        const referencesLabel =
          "T14-5 `query edges --kinds references` after the `.tsx` build";
        assertEdgeSetEqual(
          decodeEdgesReport(
            await runJson(
              product,
              workspace,
              ["query", "edges", "--kinds", "references"],
              referencesLabel,
            ),
            referencesLabel,
          ),
          [
            {
              from: "src/view.tsx#render",
              to: "specs/U.mdx#t1",
              kind: "references",
            },
          ],
          "T14-5 the marker's `references` edge is recorded and attributed " +
            "to the enclosing named unit of the `.tsx` file (SPEC 4.6, 4.5)",
        );
        const embedsLabel =
          "T14-5 `query edges --kinds embeds` after the `.tsx` build";
        assertEdgeSetEqual(
          decodeEdgesReport(
            await runJson(
              product,
              workspace,
              ["query", "edges", "--kinds", "embeds"],
              embedsLabel,
            ),
            embedsLabel,
          ),
          [
            {
              from: "src/view.tsx#render",
              to: "specs/U.mdx#t2",
              kind: "embeds",
            },
          ],
          "T14-5 the `text(...)` call's `embeds` edge is recorded and " +
            "attributed to the same named unit (SPEC 4.6, 4.3)",
        );
      },
    );

    // Negative arm: the same bytes in a code-group file named `.mts` fail
    // 14.20 identically — discriminating against products keying
    // specifically on `.ts` (the `.ts` direction itself is T14-3's).
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": codeGroupConfig("src/**/*.mts"),
          "specs/U.mdx": T14_5_SPEC_SOURCE,
          "src/view.mts": T14_5_UNIT_SOURCE,
        },
      },
      async (workspace) => {
        const context = "T14-5 `build --json` over the `.mts` code file";
        const findings = await buildFindings(product, workspace, context);
        assertConditionCounts(
          findings,
          { "14.20": 1 },
          `${context} — any name but \`.tsx\` selects plain TypeScript, so ` +
            `the fragment is a parse failure and everything inside the ` +
            `file is masked (SPEC 14.20, 14)`,
        );
        assertFindingLocated(
          findingOf(findings, "14.20", context),
          { file: "src/view.mts" },
          `${context}: the 14.20 finding names the file and reports the ` +
            `parse-failure location (SPEC 14.20)`,
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T14-6 — stable codes
// ---------------------------------------------------------------------------

/**
 * The 1-based SPEC 14 ordinal of a `"14.N"` condition identity (the sweep
 * entries' vocabulary). A malformed identity is a harness defect, not a
 * product failure — hence a plain error, never `fail` (H-8 taxonomy).
 */
function conditionOrdinal(condition: string): number {
  const ordinal = Number(condition.slice("14.".length));
  if (
    !condition.startsWith("14.") ||
    !Number.isInteger(ordinal) ||
    ordinal < 1 ||
    ordinal > CONDITION_CODE_TOKENS.length
  ) {
    throw new Error(
      `section-14 harness defect: no SPEC 14 condition ${JSON.stringify(condition)} exists`,
    );
  }
  return ordinal;
}

/**
 * The T14-6 per-condition assertion: at least one finding, and EVERY finding
 * carries the staged condition's exact stable code token as its `code` —
 * strict string equality against the harness-pinned SPEC 14 token table
 * (model.ts CONDITION_CODE_TOKENS: index N-1 holds condition 14.N's token).
 * The form-exact decode already admits only known tokens or null (S-5), so
 * with this equality an omitted, misspelled, null, wrong-condition, or
 * numeral-decorated code fails even where exit class and located
 * information are right (SPEC 14, 12.7; T14-6). Every T14-6 staging stages
 * exactly one condition, so "every finding" is the whole report.
 */
function assertExactCodeToken(
  findings: readonly Finding[],
  ordinal: number,
  context: string,
): void {
  const token = CONDITION_CODE_TOKENS[ordinal - 1];
  if (token === undefined) {
    throw new Error(
      `section-14 harness defect: no SPEC 14 condition ${String(ordinal)} exists`,
    );
  }
  if (findings.length === 0) {
    fail(
      `${context}: the staged condition ${String(ordinal)} must be reported — with ` +
        `its finding absent altogether, the stable-code assertion is absent ` +
        `with it (SPEC 14; T14-6 is a positive identity check); got an ` +
        `empty findings array`,
    );
  }
  for (const finding of findings) {
    if (finding.code !== token) {
      fail(
        `${context}: the finding must carry condition ${String(ordinal)}'s stable ` +
          `code — the exact token ${JSON.stringify(token)} as its \`code\` member, ` +
          `the token string alone, the ordinal numeral no part of the value ` +
          `(SPEC 14, 12.7); got ${JSON.stringify(finding.code)} (message: ` +
          `${JSON.stringify(finding.message)})`,
      );
    }
  }
}

/** Assert a code-less finding: `code` null where SPEC 14 assigns none. */
function assertCodeNull(finding: Finding, why: string, context: string): void {
  if (finding.code !== null) {
    fail(
      `${context}: ${why} carries no stable code — \`code\` is null where ` +
        `14 assigns none (SPEC 14, 12.7); got ${JSON.stringify(finding.code)} ` +
        `(message: ${JSON.stringify(finding.message)})`,
    );
  }
}

const T14_6 = defineProductTest({
  id: "T14-6",
  title:
    "stable codes: for each of the 23 conditions, staged via its primary test's fixture and read from its stated reporter, the finding carries the exact token 14 lists (`missing-id` … `unreadable-record`) as its `code` in the JSON report form — the value is the token string alone, the ordinal numeral no part of it — so a product omitting or misspelling a code fails even where exit class and located information are right; a plain usage error and a review-operation refusal carry no stable code — `code` null (SPEC 14, 12.7, 12.0)",
  timeoutMs: 300_000,
  run: async (product) => {
    // --- The 18 conditions `build` reports, staged as T14-4 sweeps them
    // (their minimal primary-fixture forms) and read from `build --json` —
    // a stated reporter for every one of them: "every other condition
    // reported by both `build` and `check`", 14.13/14.22 "by both `build`
    // and `check` and by the gated reads" (T14-4's matrix).
    for (const entry of SWEEP_ENTRIES) {
      const ordinal = conditionOrdinal(entry.condition);
      await withWorkspace(entry.decl, async (workspace) => {
        await entry.prepare?.(product, workspace);
        const context = `T14-6 (${entry.label}) \`build --json\``;
        assertExactCodeToken(
          await buildFindings(product, workspace, context),
          ordinal,
          `${context} — condition ${entry.condition}'s stable code, read ` +
            `from \`build\``,
        );
      });
    }

    // --- 14.10 `stale-output`: `check` is its sole reporter (SPEC 14.10).
    await withWorkspace(STALE_DECL, async (workspace) => {
      await buildOk(
        product,
        workspace,
        "T14-6 (14.10) staging `build` (SPEC 12.1)",
      );
      await workspace.file("specs/a.mdx", STALE_EDIT);
      const context = "T14-6 (14.10) `check --json` on the stale workspace";
      assertExactCodeToken(
        await checkFindings(product, workspace, context),
        10,
        `${context} — staleness is the only staged condition, so every ` +
          `finding carries its code`,
      );
    });

    // --- 14.12 `policy-violation`: `check` only (SPEC 14.12), on the
    // freshly built policy-violating workspace.
    await withWorkspace(POLICY_DECL, async (workspace) => {
      await buildOk(
        product,
        workspace,
        "T14-6 (14.12) staging `build` (SPEC 12.1, 14.12: `build` succeeds " +
          "regardless of policy)",
      );
      const context = "T14-6 (14.12) `check --json`";
      assertExactCodeToken(
        await checkFindings(product, workspace, context),
        12,
        context,
      );
    });

    // --- 14.14 `configuration-error`: delivered by every configuration-
    // loading command as the exit-2 usage error; its JSON report form is
    // the error document, whose one finding carries the stable code
    // (SPEC 14.14, 12.0, 12.7).
    await withWorkspace(BOGUS_KEY_DECL, async (workspace) => {
      const context =
        "T14-6 (14.14) `build --json` under the unknown-key configuration";
      const result = await expectExit(
        product,
        workspace,
        ["build", "--json"],
        2,
        `${context} — a configuration error is an exit-2 usage error ` +
          `(SPEC 14.14, 12.0)`,
      );
      assertExactCodeToken(
        [expectErrorDocument(result, context)],
        14,
        `${context} — the error document's finding`,
      );
    });

    // --- 14.21 `corrupt-session`: `check` (a stated reporter beside the
    // `review` subcommands naming the session and `review list`, SPEC
    // 14.21), on the freshly built workspace plus the garbage session.
    await withWorkspace(VALID_SPECS_DECL, async (workspace) => {
      await buildOk(
        product,
        workspace,
        "T14-6 (14.21) staging `build` (SPEC 12.1)",
      );
      await workspace.file(GARBAGE_SESSION_PATH, GARBAGE_SESSION_CONTENT);
      const context = "T14-6 (14.21) `check --json` beside the corrupt session";
      assertExactCodeToken(
        await checkFindings(product, workspace, context),
        21,
        context,
      );
    });

    // --- 14.23 `unreadable-record`: `inventory` (a stated reporter beside
    // the `rename`/`move` previews, SPEC 14.23) — the finding accompanies
    // the answer with its stable code, exit 1; the corruption applies to a
    // record the product itself wrote (H-3).
    await withWorkspace(VALID_SPECS_DECL, async (workspace) => {
      await buildOk(
        product,
        workspace,
        "T14-6 (14.23) staging `build` (SPEC 12.1, 13.3; H-3)",
      );
      await corruptGraphDataShapeBlind(workspace.root, "T14-6 (14.23)");
      const context = "T14-6 (14.23) `inventory`";
      assertExactCodeToken(
        decodeInventoryFindings(
          await runJsonExpecting(
            product,
            workspace,
            ["inventory"],
            1,
            `${context} — the condition-23 finding accompanies the answer ` +
              `with its stable code and the invocation exits 1 (SPEC 14.23, ` +
              `11.6)`,
          ),
          context,
        ),
        23,
        context,
      );
    });

    // --- `code` null: a plain usage error (T12.7-3's staging — an unknown
    // command, the error determined by the invocation's syntax alone)
    // describes the invocation the consuming tool composed and carries no
    // stable code (SPEC 14, 12.0).
    await withWorkspace(VALID_SPECS_DECL, async (workspace) => {
      const context =
        "T14-6 (plain usage error) `definitely-not-a-command --json`";
      const result = await expectExit(
        product,
        workspace,
        ["definitely-not-a-command", "--json"],
        2,
        `${context} — an unknown command is a plain usage error (SPEC 12.0)`,
      );
      assertCodeNull(
        expectErrorDocument(result, context),
        "a plain usage error",
        context,
      );
    });

    // --- `code` null: a review-operation refusal (T12.7-1's staging —
    // `create` with an existing session's exact name, refused per SPEC
    // 10.1/10.7; the audit strategy needs no git).
    await withWorkspace(VALID_SPECS_DECL, async (workspace) => {
      await expectExit(
        product,
        workspace,
        ["review", "create", "--strategy", "audit", "--name", "s"],
        0,
        "T14-6 (review refusal) staging `review create --strategy audit " +
          "--name s` — the first creation succeeds on the valid workspace " +
          "(SPEC 10.1, 10.6)",
      );
      const context =
        "T14-6 (review refusal) `review create --strategy audit --name s " +
        "--json` again";
      const result = await expectExit(
        product,
        workspace,
        ["review", "create", "--strategy", "audit", "--name", "s", "--json"],
        1,
        `${context} — \`create\` with an existing session's exact name is ` +
          `refused: exit 1, a refused review operation (SPEC 10.1, 10.7, ` +
          `12.0)`,
      );
      const findings = decodeFindingsReport(
        parseJsonStdout(
          result,
          `${context} — a refused operation's report is the findings-only ` +
            `document {"findings": […]} (SPEC 12.7)`,
        ),
        context,
      ).findings;
      if (findings.length === 0) {
        fail(
          `${context}: the refusal must be reported as at least one ` +
            `finding — an exit-1 refusal with an empty findings array ` +
            `reports nothing (SPEC 10.7, 12.7, 14)`,
        );
      }
      for (const finding of findings) {
        assertCodeNull(finding, "a review-operation refusal", context);
      }
    });
  },
});

/** TEST-SPEC §14 T14-1…T14-6, in canonical ID order (SUITE-49). */
export const section14ValidationTests: readonly ProductTestEntry[] = [
  T14_1,
  T14_2,
  T14_3,
  T14_4,
  T14_5,
  T14_6,
];
