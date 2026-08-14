// TEST-SPEC §12.7 (JSON document forms) — SUITE-58: T12.7-1.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes and stream separation (H-5), and rejects a product
// only via diagnosed assertion failures (H-8).
//
// SPEC 12.7 fixes the machine interface's value forms — the range, path,
// unavailability-marker, and finding forms every JSON output uses — and this
// section's assertions are form-exact (H-3): member names, `null`-vs-omission,
// `[]`-vs-`null`, and orderings asserted literally through the forms.ts
// decode layer, never adapted. T12.7-1 is the value-form test; T12.7-2
// (arrays/document forms) and T12.7-3 (the error document) follow it.
//
// Conservative operationalizations (noted per H-3/H-5/H-9):
// - "A source range is {"start", "end"}, non-negative integers, everywhere
//   the 12.7 surfaces carry one" is enforced by `decodeRangeForm` at every
//   range site of every captured document, and asserted by value where this
//   test controls the bytes: the embed occurrence's range is byte-exact
//   (composed from the same parts the staged file is — the T5.7-2
//   discipline), and each finding location's range must fall within its
//   offending construct's byte window (the construct's own range end-widened
//   by one byte, the shared `byteWindow` tolerance for line-granular
//   locations; SPEC 14 pins "per offending construct", so containment in
//   disjoint windows in the expected order also observes the location
//   ORDER — file path bytes, then start, then end).
// - The location-order clause is staged as (a) one condition-9 finding whose
//   participating import declarations lie in two files (file-byte order
//   across locations) and (b) one condition-3 finding whose two bearers lie
//   in one file (start order); `decodeFindingForm` additionally rejects
//   unordered locations in every captured document.
// - The byte-form path clause is Linux-leg (TEST-SPEC: "a non-UTF-8 path
//   (Linux leg)"): file names are byte strings there, so the arm's staging is
//   platform-conditional exactly as T11.2-3's is — conditional STAGING, never
//   a test skip (H-9); the suite's CI leg is Linux. The marked byte form is
//   composed from the SAME bytes that stage the files, never measured from
//   product output. A non-UTF-8 DIRECTORY component stages the import whose
//   resolved target is a non-UTF-8 path: an import specifier is UTF-8 source
//   text, so only a relative specifier resolved AGAINST a non-UTF-8
//   directory (SPEC 2.1: `./Tgt.xspec` from `specs/d<0xFF>/In.mdx`
//   designates `specs/d<0xFF>/Tgt.mdx`) can yield one.
// - The valid-UTF-8-never-byte-form half is asserted cross-platform: every
//   exact path value this test pins in arms A–D is a plain string, and
//   `decodePathValue` rejects a byte-form presentation of valid-UTF-8 bytes
//   wherever any captured document carries one; the Linux arm additionally
//   pins the plain spellings beside the marked ones in the same documents
//   (`specs/OK.mdx` among byte-form siblings, the `../OK.xspec` import's
//   plain resolved target beside the byte-form `./Tgt.xspec` one).
// - The marker-uniqueness walk (`assertUnavailabilityMarkerForms`, S-5
//   guarded) runs over every 12.7 document the suite captures — integrated
//   at every forms.ts document-decode entry point — and this test drives it
//   explicitly over its own captured documents, which carry genuine markers
//   (every identity of an invalid-path file; the occurrence records'
//   `source`), so the walk's accepting side is exercised on marker-bearing
//   answers, and marker exactness at the datum sites is value-asserted
//   (`source` exactly `{"unavailable": true}`).
// - The review-refusal finding's cardinality is unpinned (SPEC 10.7/14 state
//   no per-reason finding count for review-operation refusals, unlike the
//   6.4/6.5 reasons): the arm asserts a nonempty findings-only report every
//   finding of which carries `code` null — exactly the T12.7-1 clause ("null
//   where 14 assigns none"), with the five-member form enforced by decode.
// - The 14.11 identities clause ("a cross-module call names the foreign
//   module") is asserted by distinctive-stem containment, the T4.4-1
//   operationalization: every rendering of the foreign module's identity —
//   file name, workspace-relative path, `.xspec` specifier, root-node
//   identity — contains its stem, and the stem occurs in no other module of
//   the fixture, so SOME identities element containing it names that module;
//   SPEC 12.7 pins the entity named, not its rendering.
// - The 14.12 identities enumeration IS pinned exactly (SPEC 14.12 fixes
//   content and order: rule name, source identity, kind token, target
//   identity; locations `[]`, path `null`).
// - `inventory` on the Linux arm's workspace exits 0: SPEC 11.6 — the
//   inventory parses no sources, 14.23 is the only finding it ever carries,
//   and the staged workspace has readable (absent-therefore-empty) recorded
//   state, so the answer is finding-free and carries no unavailable datum
//   (12.0's exit partition). The sources/derived byte-form paths ride the
//   scoped resolved-map decode; the full inventory form is T11.6-3's.

import { Buffer } from "node:buffer";
import type {
  Finding,
  OccurrenceRecord,
  PathValue,
  SourceRange,
} from "../../helpers/adapters/index.js";
import {
  assertUnavailabilityMarkerForms,
  decodeFindingsReport,
  decodeInventoryResolvedMap,
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
import type { ProductBinding } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { WorkspaceDecl } from "../../helpers/workspace.js";
import {
  assertConditionCounts,
  assertSameJson,
  buildFindings,
  buildOk,
  expectExit,
  runCli,
  runJson,
} from "./support.js";

// ---------------------------------------------------------------------------
// Shared machinery
// ---------------------------------------------------------------------------

/** Whether non-UTF-8 file names are stageable (module-header note). */
const NON_UTF8_STAGED = process.platform === "linux";

/** The 12.7 unavailability marker, as decoded (one-datum state). */
const UNAVAILABLE = { unavailable: true } as const;

/**
 * Running byte-offset fixture assembler (the T5.7-2/T11.2-3 discipline):
 * `add` appends a segment and returns its byte range, so every expected
 * offset is composed from the same parts the staged file is.
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
      `section-12.7 fixture self-check: ${what} — the composed range ` +
        `[${String(range.start)}, ${String(range.end)}) slices to ` +
        `${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}.`,
    );
  }
}

/**
 * A construct's containment window: its own byte range end-widened by one
 * byte (the shared `byteWindow` tolerance — a product reporting a
 * line-granular location spanning the construct's last line terminator
 * still passes; every other staged construct lies outside the window).
 */
function widen(range: SourceRange): SourceRange {
  return { start: range.start, end: range.end + 1 };
}

/**
 * The asserted projection of a finding's value form (T12.7-1): the stable
 * code (or null), the concerned path (null for located conditions), and the
 * locations' files in order. Ranges are asserted separately by containment
 * (`assertLocationWithin`); message and — where 14 states no content —
 * identities stay unpinned (informational, SPEC 12.7).
 */
interface FindingFormExpectation {
  readonly code: string | null;
  readonly path: PathValue | null;
  readonly locations: readonly PathValue[];
}

function projectFindingForm(finding: Finding): FindingFormExpectation {
  return {
    code: finding.code,
    path: finding.path,
    locations: finding.locations.map((location) => location.file),
  };
}

/** Assert one location's range falls within the offending construct's window. */
function assertLocationWithin(
  finding: Finding,
  index: number,
  window: SourceRange,
  context: string,
): void {
  const location = finding.locations[index];
  if (location === undefined) {
    fail(
      `${context}: the finding must carry a locations[${String(index)}] ` +
        `entry (SPEC 12.7: one {"file", "range"} per offending construct); ` +
        `got ${String(finding.locations.length)} location(s) (message: ` +
        `${JSON.stringify(finding.message)})`,
    );
  }
  if (location.range.start < window.start || location.range.end > window.end) {
    fail(
      `${context}: locations[${String(index)}]'s range ` +
        `[${String(location.range.start)}, ${String(location.range.end)}) ` +
        `must fall within the offending construct's byte window ` +
        `[${String(window.start)}, ${String(window.end)}] (SPEC 12.7, 14; ` +
        `message: ${JSON.stringify(finding.message)})`,
    );
  }
}

/** Stage a fresh workspace, run `body`, dispose (H-1). */
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

// The canonical valid configuration (SPEC 7): exactly one spec group.
const SPECS_ONLY_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`;

// ---------------------------------------------------------------------------
// Arm A — located findings: path null, location order (file bytes; start)
// ---------------------------------------------------------------------------
//
// Two independent conditions, each the sole defect of its files: a spec
// import cycle A <-> B (14.9 — one finding locating every participating
// import declaration, SPEC 2.1/T14-8: the bindings are deliberately unused,
// an unused import being valid and recording no edges, so no dependency
// cycle exists beside the import cycle) and a duplicated ID within one file
// C (14.3 — one finding, one location per bearer). The cycle's locations
// span two files in file-byte order; the duplicate's span one file in start
// order. Multi-byte prefixes shift every later offset (SPEC 1.7).

const CY_A_FILE = "specs/A.mdx";
const CY_A = new ByteFixture();
CY_A.add("Décor — multi-byte prefix.\n\n");
const CY_A_IMPORT_TEXT = 'import B from "./B.xspec"';
const CY_A_IMPORT_RANGE = CY_A.add(CY_A_IMPORT_TEXT);
CY_A.add('\n\n<S id="a">\nAlpha text.\n</S>\n');
const CY_A_SOURCE = CY_A.source;

const CY_B_FILE = "specs/B.mdx";
const CY_B = new ByteFixture();
CY_B.add("Début — multi-byte prefix.\n\n");
const CY_B_IMPORT_TEXT = 'import A from "./A.xspec"';
const CY_B_IMPORT_RANGE = CY_B.add(CY_B_IMPORT_TEXT);
CY_B.add('\n\n<S id="b">\nBravo text.\n</S>\n');
const CY_B_SOURCE = CY_B.source;

const DUP_FILE = "specs/C.mdx";
const DUP = new ByteFixture();
DUP.add("Préfixe — multi-byte guard.\n\n");
const DUP_ONE_TEXT = '<S id="dup">\nFirst bearer.\n</S>';
const DUP_ONE_RANGE = DUP.add(DUP_ONE_TEXT);
DUP.add("\n\n");
const DUP_TWO_TEXT = '<S id="dup">\nSecond bearer.\n</S>';
const DUP_TWO_RANGE = DUP.add(DUP_TWO_TEXT);
DUP.add("\n");
const DUP_SOURCE = DUP.source;

async function runLocatedFindingsArm(product: ProductBinding): Promise<void> {
  sliceCheck(
    CY_A_SOURCE,
    CY_A_IMPORT_RANGE,
    CY_A_IMPORT_TEXT,
    "A's import declaration",
  );
  sliceCheck(
    CY_B_SOURCE,
    CY_B_IMPORT_RANGE,
    CY_B_IMPORT_TEXT,
    "B's import declaration",
  );
  sliceCheck(DUP_SOURCE, DUP_ONE_RANGE, DUP_ONE_TEXT, "the first dup bearer");
  sliceCheck(DUP_SOURCE, DUP_TWO_RANGE, DUP_TWO_TEXT, "the second dup bearer");

  await withWorkspace(
    {
      files: {
        "xspec.config.ts": SPECS_ONLY_CONFIG,
        [CY_A_FILE]: CY_A_SOURCE,
        [CY_B_FILE]: CY_B_SOURCE,
        [DUP_FILE]: DUP_SOURCE,
      },
    },
    async (workspace) => {
      const context =
        "T12.7-1 (located findings) `build --json` over a spec import " +
        "cycle A <-> B and a duplicated ID in C";
      const findings = await buildFindings(product, workspace, context);
      assertConditionCounts(
        findings,
        { "14.3": 1, "14.9": 1 },
        `${context} — each condition is its files' sole defect: one ` +
          `duplicate-ID finding, one cycle finding, nothing else`,
      );
      assertSameJson(
        findings.map(projectFindingForm),
        [
          { code: "duplicate-id", path: null, locations: [DUP_FILE, DUP_FILE] },
          { code: "cycle", path: null, locations: [CY_A_FILE, CY_B_FILE] },
        ],
        `${context} — the finding form's located side: exact stable code ` +
          `tokens, \`path\` null for located conditions, and one ` +
          `{"file", "range"} per offending construct — the duplicate's two ` +
          `bearers in one file, the import cycle's two participating ` +
          `declarations across two files in file-path-byte order ` +
          `(SPEC 12.7, 14)`,
      );
      const [dupFinding, cycleFinding] = [findings[0]!, findings[1]!];
      // Containment in DISJOINT windows in the expected sequence observes
      // the within-finding location order by value: file bytes (A before B),
      // then range start (the first bearer before the second).
      assertLocationWithin(
        dupFinding,
        0,
        widen(DUP_ONE_RANGE),
        `${context} — the duplicate-id finding's first location (the first ` +
          `bearer construct)`,
      );
      assertLocationWithin(
        dupFinding,
        1,
        widen(DUP_TWO_RANGE),
        `${context} — the duplicate-id finding's second location (the ` +
          `second bearer construct; start order within one file, SPEC 12.7)`,
      );
      assertLocationWithin(
        cycleFinding,
        0,
        widen(CY_A_IMPORT_RANGE),
        `${context} — the cycle finding's first location (A's ` +
          `participating import declaration)`,
      );
      assertLocationWithin(
        cycleFinding,
        1,
        widen(CY_B_IMPORT_RANGE),
        `${context} — the cycle finding's second location (B's ` +
          `participating import declaration; file-byte order across files, ` +
          `SPEC 12.7)`,
      );
    },
  );
}

// ---------------------------------------------------------------------------
// Arm B — the policy finding's contractual identities (14.12)
// ---------------------------------------------------------------------------

const POLICY_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  policy: [
    {
      name: "no-self-deps",
      type: "forbidden",
      from: { group: "main" },
      to: { group: "main" }
    }
  ]
})
`;

// The one violation: `p` depends locally on `a` (SPEC 2.2 string form);
// both endpoints are `main` nodes, so the forbidden rule matches exactly
// this edge and nothing else. `build` never evaluates policy (SPEC 7.5,
// 12.1) — the finding is `check`'s.
const POLICY_SOURCE = `<S id="a">
Target leaf.
</S>

<S id="p" d={"a"}>
Dependent leaf.
</S>
`;

async function runPolicyFindingArm(product: ProductBinding): Promise<void> {
  await withWorkspace(
    {
      files: {
        "xspec.config.ts": POLICY_CONFIG,
        "specs/P.mdx": POLICY_SOURCE,
      },
    },
    async (workspace) => {
      await buildOk(
        product,
        workspace,
        "T12.7-1 (policy finding) `build` — policy never fails a build " +
          "(SPEC 7.5, 12.1)",
      );
      const context = "T12.7-1 (policy finding) `check --json`";
      const result = await expectExit(
        product,
        workspace,
        ["check", "--json"],
        1,
        `${context} — the staged depends edge violates the forbidden rule, ` +
          `so check reports it and exits 1 (SPEC 7.5, 14.12, 12.0)`,
      );
      const findings = decodeFindingsReport(
        parseJsonStdout(result, context),
        context,
      ).findings;
      assertConditionCounts(findings, { "14.12": 1 }, context);
      assertSameJson(
        findings.map((finding) => ({
          code: finding.code,
          locations: finding.locations,
          path: finding.path,
          identities: finding.identities,
        })),
        [
          {
            code: "policy-violation",
            locations: [],
            path: null,
            identities: [
              "no-self-deps",
              "specs/P.mdx#p",
              "depends",
              "specs/P.mdx#a",
            ],
          },
        ],
        `${context} — the finding form's contractual-identities side: a ` +
          `policy finding carries the rule name, source identity, kind ` +
          `token, and target identity IN THAT ORDER, with locations [] ` +
          `(an unlocated condition — the offending entity is a graph ` +
          `edge, not a spelling) and path null (SPEC 14.12, 12.7)`,
      );
    },
  );
}

// ---------------------------------------------------------------------------
// Arm C — the cross-module call names the foreign module (14.11)
// ---------------------------------------------------------------------------
//
// Distinctive name stems (the T4.4-1 operationalization): every rendering of
// a module's identity — file name, workspace-relative path, `.xspec`
// specifier, root-node identity — contains its stem, and neither stem names
// any other module of the fixture, so an identities element containing
// FOREIGNMOD names the foreign (called) module.

const FOREIGN_STEM = "FOREIGNMOD";

const CROSS_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: {
    app: ["src/**/*.ts"]
  }
})
`;

const CROSS_IMPORT_PREFIX =
  'import HOME from "../specs/HOMEMOD.xspec";\n' +
  'import { text as textF } from "../specs/FOREIGNMOD.xspec";\n' +
  "\n";
const CROSS_STATEMENT = "textF(HOME.first);";

async function runCrossModuleArm(product: ProductBinding): Promise<void> {
  await withWorkspace(
    {
      files: {
        "xspec.config.ts": CROSS_CONFIG,
        "specs/HOMEMOD.mdx": '<S id="first">\nHome behavior.\n</S>\n',
        "specs/FOREIGNMOD.mdx": '<S id="second">\nForeign behavior.\n</S>\n',
        "src/app.ts": CROSS_IMPORT_PREFIX + CROSS_STATEMENT + "\n",
      },
    },
    async (workspace) => {
      const context =
        "T12.7-1 (cross-module finding) `build --json` over a discovered " +
        "code file passing HOMEMOD's node to FOREIGNMOD's `text` export";
      const findings = await buildFindings(product, workspace, context);
      assertConditionCounts(
        findings,
        { "14.11": 1 },
        `${context} — the cross-module call is the workspace's sole defect`,
      );
      const finding = findings[0]!;
      assertSameJson(
        projectFindingForm(finding),
        { code: "cross-module-text", path: null, locations: ["src/app.ts"] },
        `${context} — the finding form: the stable code, path null (a ` +
          `located condition), one location at the offending call in the ` +
          `code file (SPEC 14.11, 12.7)`,
      );
      assertLocationWithin(
        finding,
        0,
        widen({
          start: Buffer.byteLength(CROSS_IMPORT_PREFIX, "utf8"),
          end: Buffer.byteLength(CROSS_IMPORT_PREFIX + CROSS_STATEMENT, "utf8"),
        }),
        `${context} — the 14.11 finding's location (the cross-module call ` +
          `statement)`,
      );
      if (
        !finding.identities.some((identity) => identity.includes(FOREIGN_STEM))
      ) {
        fail(
          `${context}: the finding's identities must name the foreign ` +
            `module — the called module, "a spec module other than its ` +
            `own" (SPEC 14.11; 12.7: identities are contractual where 14 ` +
            `states a named context entity) — but no element contains the ` +
            `distinctive stem ${JSON.stringify(FOREIGN_STEM)}, which every ` +
            `rendering of that module's identity carries; got ` +
            `${JSON.stringify(finding.identities)}`,
        );
      }
    },
  );
}

// ---------------------------------------------------------------------------
// Arm D — a review-refusal finding carries `code` null
// ---------------------------------------------------------------------------

async function runReviewRefusalArm(product: ProductBinding): Promise<void> {
  await withWorkspace(
    {
      files: {
        "xspec.config.ts": SPECS_ONLY_CONFIG,
        "specs/R.mdx": '<S id="r">\nReviewed leaf.\n</S>\n',
      },
    },
    async (workspace) => {
      await expectExit(
        product,
        workspace,
        ["review", "create", "--strategy", "audit", "--name", "s"],
        0,
        "T12.7-1 (review refusal) `review create --strategy audit --name " +
          "s` — the first creation succeeds on the valid workspace " +
          "(SPEC 10.1, 10.6; the audit strategy needs no git, 12.0)",
      );
      const context =
        "T12.7-1 (review refusal) `review create --strategy audit --name " +
        "s --json` again";
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
        if (finding.code !== null) {
          fail(
            `${context}: a review-operation refusal carries no stable ` +
              `code — \`code\` is null where 14 assigns none (SPEC 14, ` +
              `12.7); got ${JSON.stringify(finding.code)} (message: ` +
              `${JSON.stringify(finding.message)})`,
          );
        }
      }
    },
  );
}

// ---------------------------------------------------------------------------
// Arm E — (Linux leg) byte-form paths at each output the 12.0 rule names
// ---------------------------------------------------------------------------
//
// A non-UTF-8 directory `specs/d<0xFF>/` (0xFF occurs in no valid UTF-8
// sequence; the byte-wise glob rules of SPEC 7 still discover its files)
// holds In.mdx — importing the valid `../OK.xspec` AND the sibling
// `./Tgt.xspec`, embedding `{text(OK.ok)}` inside section `in`, and holding
// an id-less `<S>` (14.1, the located finding INSIDE a non-UTF-8 file:
// structure and validation are parse-local, SPEC 11.2) — and Tgt.mdx, whose
// only defect is its path. Every expected byte-form value is composed from
// the same bytes that stage the files.

const NU_DIR_BYTES = Buffer.concat([
  Buffer.from("specs/d", "utf8"),
  Buffer.from([0xff]),
]);
const IN_PATH_BYTES = Buffer.concat([
  NU_DIR_BYTES,
  Buffer.from("/In.mdx", "utf8"),
]);
const TGT_PATH_BYTES = Buffer.concat([
  NU_DIR_BYTES,
  Buffer.from("/Tgt.mdx", "utf8"),
]);
const IN_MODULE_BYTES = Buffer.concat([
  NU_DIR_BYTES,
  Buffer.from("/In.xspec.ts", "utf8"),
]);
const TGT_MODULE_BYTES = Buffer.concat([
  NU_DIR_BYTES,
  Buffer.from("/Tgt.xspec.ts", "utf8"),
]);
const IN_MARKED = { bytes: IN_PATH_BYTES.toString("hex") } as const;
const TGT_MARKED = { bytes: TGT_PATH_BYTES.toString("hex") } as const;
const IN_MODULE_MARKED = { bytes: IN_MODULE_BYTES.toString("hex") } as const;
const TGT_MODULE_MARKED = { bytes: TGT_MODULE_BYTES.toString("hex") } as const;

const OK_FILE = "specs/OK.mdx";
const OK_SOURCE = '<S id="ok">\nOK text.\n</S>\n';
const OK_NODE_ID = `${OK_FILE}#ok`;

const IN = new ByteFixture();
IN.add("Prólogo — byte-form path survey.\n\n");
IN.add('import OK from "../OK.xspec"\n');
IN.add("\n");
IN.add('import T from "./Tgt.xspec"\n');
IN.add('\n<S id="in">\nEmbed: ');
const IN_EMBED_TEXT = "{text(OK.ok)}";
const IN_EMBED_RANGE = IN.add(IN_EMBED_TEXT);
IN.add("\n</S>\n\n");
const IN_NOID_TEXT = "<S>\nNo id here.\n</S>";
const IN_NOID_RANGE = IN.add(IN_NOID_TEXT);
IN.add("\n");
const IN_SOURCE = IN.source;

const TGT_SOURCE = '<S id="t">\nTarget text.\n</S>\n';

// The workspace findings, identical for `build`, bare `view` (whose domain
// is every discovered spec source = the whole workspace), and bare
// `occurrences` (the entire discovered set): the located 14.1 (its location
// FILE in the marked byte form), then the two path-level 14.19s in
// concerned-path byte order ("…/In.mdx" < "…/Tgt.mdx") — each concerned
// path the marked byte form. `specs/OK.mdx` is condition-free.
const NU_EXPECTED_FINDINGS: readonly FindingFormExpectation[] = [
  { code: "missing-id", path: null, locations: [IN_MARKED] },
  { code: "invalid-source-path", path: IN_MARKED, locations: [] },
  { code: "invalid-source-path", path: TGT_MARKED, locations: [] },
];

// The workspace's one occurrence: In.mdx's embedding resolves (the target
// `specs/OK.mdx#ok` has a defined identity) and records — `file` the marked
// byte form, the byte-exact container range, `source` exactly the
// unavailability marker (every node identity of an invalid-path file is
// undefined, withheld as one datum; SPEC 11.2, 5.7), the target's identity
// a plain string (no identity carries a non-UTF-8 path, 12.0).
const NU_EXPECTED_OCCURRENCE: OccurrenceRecord = {
  file: IN_MARKED,
  range: IN_EMBED_RANGE,
  kind: "embeds",
  source: UNAVAILABLE,
  target: OK_NODE_ID,
};

async function runBytePathsArm(product: ProductBinding): Promise<void> {
  sliceCheck(IN_SOURCE, IN_EMBED_RANGE, IN_EMBED_TEXT, "the embed container");
  sliceCheck(IN_SOURCE, IN_NOID_RANGE, IN_NOID_TEXT, "the id-less construct");

  const workspace = await TestWorkspace.create({
    files: {
      "xspec.config.ts": SPECS_ONLY_CONFIG,
      [OK_FILE]: OK_SOURCE,
    },
  });
  try {
    await workspace.file(IN_PATH_BYTES, IN_SOURCE);
    await workspace.file(TGT_PATH_BYTES, TGT_SOURCE);

    // --- `build --json`: a finding's location file and concerned path in
    // the marked byte form (SPEC 12.0, 12.7, 14).
    const buildContext = "T12.7-1 (byte-form paths) `build --json`";
    const buildResult = await expectExit(
      product,
      workspace,
      ["build", "--json"],
      1,
      `${buildContext} — the workspace fails \`build\` on exactly the ` +
        `staged conditions (SPEC 14.19, 14.1, 12.0)`,
    );
    const buildDoc = parseJsonStdout(buildResult, buildContext);
    assertUnavailabilityMarkerForms(buildDoc, buildContext);
    const findings = decodeFindingsReport(buildDoc, buildContext).findings;
    assertConditionCounts(
      findings,
      { "14.1": 1, "14.19": 2 },
      `${buildContext} — the id-less construct and the two invalid paths ` +
        `are the workspace's only conditions`,
    );
    assertSameJson(
      findings.map(projectFindingForm),
      NU_EXPECTED_FINDINGS,
      `${buildContext} — a finding's location file (the 14.1 inside the ` +
        `non-UTF-8-named file) and concerned path (each 14.19's offending ` +
        `file) are presented in the marked byte form {"bytes": …} — the ` +
        `path's exact bytes as lowercase hexadecimal, two digits per ` +
        `byte — never a plain string (SPEC 12.0, 12.7, 14)`,
    );
    assertLocationWithin(
      findings[0]!,
      0,
      widen(IN_NOID_RANGE),
      `${buildContext} — the 14.1 finding's location (the id-less ` +
        `construct inside the non-UTF-8-named file: structure and ` +
        `validation are parse-local, SPEC 11.2)`,
    );

    // --- Bare `occurrences` (JSON-only; the entire discovered set): an
    // occurrence's referencing file in the marked byte form (SPEC 11.3,
    // 12.0, 12.7).
    const occContext = "T12.7-1 (byte-form paths) bare `occurrences`";
    const occResult = await runCli(product, workspace, ["occurrences"]);
    assertExitCode(
      occResult,
      1,
      `${occContext} — the answer carries the domain's findings and an ` +
        `explicitly-unavailable source datum, so exit 1 with the full ` +
        `document emitted (SPEC 11.2, 11.3)`,
    );
    const occDoc = parseJsonStdout(
      occResult,
      `${occContext} — a single JSON document is the only output form, ` +
        `with or without --json (SPEC 11)`,
    );
    assertUnavailabilityMarkerForms(occDoc, occContext);
    const occReport = decodeOccurrencesReport(occDoc, occContext);
    assertSameJson(
      occReport.findings.map(projectFindingForm),
      NU_EXPECTED_FINDINGS,
      `${occContext} — every domain file's finding accompanies, byte-form ` +
        `paths exactly as \`build\` presents them (SPEC 11.2, 12.7)`,
    );
    assertSameJson(
      occReport.occurrences,
      [NU_EXPECTED_OCCURRENCE],
      `${occContext} — the one record: referencing \`file\` in the marked ` +
        `byte form, the byte-exact container range {"start", "end"}, ` +
        `\`source\` exactly the unavailability marker (one datum: every ` +
        `identity of an invalid-path file is undefined), and the resolved ` +
        `target's identity a plain string (SPEC 5.7, 11.2, 11.3, 12.0, ` +
        `12.7)`,
    );

    // --- Bare `view` (whole domain): a view's file and an import's
    // resolved target in the marked byte form, the valid-UTF-8 siblings
    // plain (SPEC 11.4, 12.0, 12.7).
    const viewContext = "T12.7-1 (byte-form paths) bare `view`";
    const viewResult = await runCli(product, workspace, ["view"]);
    assertExitCode(
      viewResult,
      1,
      `${viewContext} — the answer carries findings and ` +
        `explicitly-unavailable identities, so exit 1 with the full ` +
        `document emitted (SPEC 11.2, 11.4)`,
    );
    const viewDoc = parseJsonStdout(
      viewResult,
      `${viewContext} — a single JSON document is the only output form ` +
        `(SPEC 11)`,
    );
    assertUnavailabilityMarkerForms(viewDoc, viewContext);
    const viewReport = decodeViewReport(viewDoc, { text: false }, viewContext);
    assertSameJson(
      viewReport.findings.map(projectFindingForm),
      NU_EXPECTED_FINDINGS,
      `${viewContext} — the requested files' findings accompany the ` +
        `answer, byte-form paths exactly as \`build\` presents them ` +
        `(SPEC 11.2, 12.7)`,
    );
    assertSameJson(
      viewReport.views.map((view) => view.file),
      [OK_FILE, IN_MARKED, TGT_MARKED],
      `${viewContext} — per-file views in path-byte order: the ` +
        `non-UTF-8-named files' \`file\` members in the marked byte form, ` +
        `the valid-UTF-8 one a plain string — never the byte form ` +
        `(SPEC 11.4, 12.0, 12.7)`,
    );
    const inView = viewReport.views[1]!;
    assertSameJson(
      inView.imports.map((entry) => ({
        name: entry.name,
        target: entry.target,
      })),
      [
        { name: "OK", target: OK_FILE },
        { name: "T", target: TGT_MARKED },
      ],
      `${viewContext} — the import entries' resolved targets: ` +
        `\`../OK.xspec\` designates the valid-path source as a plain ` +
        `string while \`./Tgt.xspec\`, resolved against the non-UTF-8 ` +
        `directory, designates a non-UTF-8 path presented in the marked ` +
        `byte form (SPEC 2.1, 11.4, 12.0, 12.7)`,
    );
    assertSameJson(
      inView.occurrences,
      [NU_EXPECTED_OCCURRENCE],
      `${viewContext} — the viewed file's own occurrence record, ` +
        `byte-form \`file\` and marker \`source\` exactly as ` +
        `\`occurrences\` reports them (SPEC 11.4, 5.7, 12.7)`,
    );

    // --- `inventory` (JSON-only): source and derived-module paths in the
    // marked byte form (SPEC 11.6, 12.0, 12.7). The inventory parses no
    // sources and carries no finding but 14.23 — absent recorded state is
    // empty, not unavailable — so the answer is finding-free: exit 0
    // (SPEC 11.6, 12.0).
    const invContext = "T12.7-1 (byte-form paths) `inventory`";
    const invDoc = await runJson(product, workspace, ["inventory"], invContext);
    assertUnavailabilityMarkerForms(invDoc, invContext);
    const resolved = decodeInventoryResolvedMap(invDoc, invContext);
    assertSameJson(
      resolved.sources,
      [
        { path: OK_FILE, groups: [{ name: "main", kind: "spec" }] },
        { path: IN_MARKED, groups: [{ name: "main", kind: "spec" }] },
        { path: TGT_MARKED, groups: [{ name: "main", kind: "spec" }] },
      ],
      `${invContext} — every discovered source with its group ` +
        `memberships, in path-byte order: the non-UTF-8 source paths in ` +
        `the marked byte form, the valid one plain (SPEC 11.6, 12.0, 12.7)`,
    );
    assertSameJson(
      resolved.derived,
      [
        { source: OK_FILE, module: "specs/OK.xspec.ts", markdown: null },
        { source: IN_MARKED, module: IN_MODULE_MARKED, markdown: null },
        { source: TGT_MARKED, module: TGT_MODULE_MARKED, markdown: null },
      ],
      `${invContext} — the derived map: each \`NAME.mdx\` source's ` +
        `generated-module path (defined by name shape alone, SPEC 13.1), ` +
        `the non-UTF-8 ones in the marked byte form; \`markdown\` null ` +
        `for every source while emission is disabled — null, never ` +
        `omitted (SPEC 7.3, 11.6, 12.7)`,
    );
  } finally {
    await workspace.dispose();
  }
}

// ---------------------------------------------------------------------------
// T12.7-1 — value forms
// ---------------------------------------------------------------------------

const T12_7_1 = defineProductTest({
  id: "T12.7-1",
  title:
    'value forms: a source range is {"start", "end"} with non-negative ' +
    "integers everywhere the 12.7 surfaces carry one (byte-exact where this " +
    "test stages the bytes); (Linux leg) a non-UTF-8 path is the marked " +
    'byte form {"bytes": …} — its exact bytes as lowercase hexadecimal, ' +
    "two digits per byte — at each output the 12.0 rule names: an inventory " +
    "source and derived-module path, an occurrence's referencing file, a " +
    "view's file and an import's resolved target, and a finding's location " +
    "file and concerned path, while a valid-UTF-8 path never takes the byte " +
    'form; unavailability is exactly {"unavailable": true} and no object ' +
    'of any other form carries a member named "unavailable" (the ' +
    "S-5-guarded structural walk, run over every captured 12.7 document); " +
    'a finding is {"code", "message", "locations", "path", ' +
    '"identities"} — `code` the stable token or null where 14 assigns ' +
    'none (a review-refusal finding), `locations` one {"file", "range"} ' +
    "per offending construct ordered by file bytes then start then end and " +
    "[] for unlocated conditions, `path` null for located conditions and " +
    "the concerned path otherwise, `identities` contractual where 14 states " +
    "them: a policy finding [rule, source, kind token, target] with " +
    "locations [] and path null (14.12), a cross-module call naming the " +
    "foreign module (14.11) (SPEC 12.7, 12.0, 14, 11.2-11.6)",
  run: async (product) => {
    await runLocatedFindingsArm(product);
    await runPolicyFindingArm(product);
    await runCrossModuleArm(product);
    await runReviewRefusalArm(product);
    if (NON_UTF8_STAGED) {
      await runBytePathsArm(product);
    }
  },
});

/** TEST-SPEC §12.7, in canonical ID order (SUITE-58). */
export const section127Tests: readonly ProductTestEntry[] = [T12_7_1];
