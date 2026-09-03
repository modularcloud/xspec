// TEST-SPEC §12.7 (JSON document forms) — SUITE-58: T12.7-1…T12.7-3.
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
// decode layer, never adapted. T12.7-1 is the value-form test; T12.7-2 is
// the findings-array-ordering and document-forms test; T12.7-3 is the
// error-document test.
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
//   (`source` exactly `{"unavailable": true}`). The walk equally runs at
//   every adjustable adapter's document entry (`documentRootSite`,
//   forms.ts), the exclusivity clause being universal like the value forms:
//   arm F's captured unpinned-shape documents pass through it too.
// - Arm F asserts 12.7's range form where SPEC leaves the document shape
//   unpinned (H-3): the adjustable adapters' range decode is the literal form
//   decode itself (`decodeSourceRange` delegates to `decodeRangeForm` —
//   exactly {"start", "end"}, non-negative integers; S-5 feeds it
//   `[start, end]`, `{"from", "to"}`, and an extra member), so a decoded
//   range IS a form-exact one, never re-mapped, and each is then asserted
//   byte-exact against the staged construct (SPEC 1.7, 4.6) — every present
//   node of the review payload included, since 10.7 gives every present
//   scope, context, and origin node its source range.
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
//
// T12.7-2's conservative operationalizations (per H-3/H-9):
// - The comparator's cross-class code ordering (numbered conditions, then
//   refusal reasons, then code-less findings) admits no single-array staging:
//   no report mixes refusal reasons with numbered conditions (SPEC 14: the
//   reasons are defined only over a workspace passing `build`'s validations,
//   and the invalid-workspace refusal reports numbered findings alone), and a
//   code-less finding arises only in review-refusal reports, where it is the
//   only finding class (10.7, 14). The test stages each stageable class's
//   internal order by value — numbered conditions across six codes whose
//   numeric order inverts both the token-alphabetical order (`cycle` <
//   `missing-id`) and the ordinal-decimal-string order ("15" < "3"), and the
//   T14-7 refusal pair whose listed order inverts the token-alphabetical
//   order (`refused-cycle` < `refused-id-collision` alphabetically, yet
//   collision ranks 3rd and cycle 6th in 14's listing) — while the full
//   pinned comparator, cross-class ranks included, is enforced over every
//   findings array the suite captures (`decodeFindingsArray`, S-5-guarded).
// - The locations proper-prefix rule, the `null`-before-path rule, and the
//   message tie-break admit no product-independent discriminating fixture:
//   two same-code findings agreeing on every earlier key while differing
//   exactly there cannot be staged — located conditions carry `path` null and
//   path-level conditions carry `locations` [] (so a same-code pair differing
//   in path-nullity already differs at the locations key), no condition
//   yields two findings sharing code, locations, path, AND identities, and
//   messages are unpinned wording (12.7) — the T6.6-4 tie-break precedent:
//   the harness asserts the full comparator over whatever arrays are emitted.
//   The staged tie-break levels: locations element-wise (three missing-id
//   findings — range-start order inside one file, then file-byte order
//   across files), concerned path (the 14.19s in one byte order — on the
//   Linux leg a marked byte-form path sorting BEFORE the plain strings,
//   failing any plain-first partition), and identities element-wise (two
//   policy findings identical to each other except the rule name, declared
//   in the opposite configuration order).
// - The duplicate-collapse staging: one defect file discovered through two
//   spec groups (membership pinned via the inventory's `sources` entry —
//   SPEC 7 allows a file in two same-kind groups). A per-group-iterating
//   product reports the defect once per membership; SPEC 14's cardinality
//   (one finding per violating construct) plus 12.7's collapse pin exactly
//   one finding, and the decode additionally rejects adjacent identical
//   findings wherever they appear.
// - The multi-reason refusal is TEST-SPEC 14's own dual staging (T14-7): a
//   section move staged to both collide (`<new-id>` present in the target
//   file) and create a dependency cycle (the moved node depends on `keep`
//   and would become its child — a dependency on its own ancestor, SPEC
//   5.3), reporting both findings. The code sequence is pinned exactly
//   (order, count, and completeness: no reason beside the staged two); each
//   finding's location is asserted SOME-quantified within its construct's
//   byte window (FP-007's latitude note: cardinality beyond the concerned
//   participant is T14-8's business), `path` null (located findings, 12.7).
//   No third reason is applicable: the new ID `keep.sub` is intrinsically
//   valid, differs from the old identity, sits structurally under the
//   existing target parent `keep` (outside the moved subtree), the target
//   path is occupied by the discovered origin source itself, and nothing
//   references the moved node, so no rewritten reference can fail to
//   resolve.
// - Document forms delegated per the TEST-SPEC entry's own citations: the
//   refused preview's four-member form (T6.6-3), the full inventory and
//   preview forms (T11.6-*, T6.6-4/5), a root's stated-null `tags`/
//   `coverage` (T11.4-3), an absent `targetTags` (T11.6-2). The unset
//   `outDir` null — the entry's named null-never-omission example — IS
//   asserted here, on the ordering workspace's inventory. The gated-read
//   `{"findings": […]}` form is asserted on the same staged array via
//   `query nodes` (13.3: a failing workspace's read reports exactly the
//   findings `build` would report), so the pinned order is observed on a
//   second surface.
// - Interpreted per-node values asserted on the document-forms fixture are
//   the spelled ones plus the 11.2-defined defaults of an attribute-free
//   non-root (`tags` [] — a list-valued member with no elements, never
//   null — and `coverage` "required"); the root's `tags`/`coverage` null
//   distinction stays T11.4-3's. Own/subtree text values are asserted as
//   plain strings containing the embedded target's text (1.6: expanded
//   values) — byte-exact expansion is T11.2-1's business.
// - The clean-workspace pin — a successful `build --json` and `check --json`
//   each emitting exactly `{"findings": []}` as the entire stdout — is
//   asserted on the document-forms workspace right after its premise
//   `build`, through `expectFindingFreeReport` (support.ts): exit 0, the
//   single JSON document the entire stdout (H-5), decoded form-exact as the
//   findings-only report (the one member `findings`, nothing beside it) and
//   its array asserted empty. "Exactly" is the form: SPEC 12.0/12.7 pin no
//   byte layout for the serialization (12.0's byte-determinism is a
//   per-input property, not a byte form), so the bytes are not compared
//   (H-3) — the pin exercised on the report form itself, beside the
//   JSON-only surfaces (TEST-SPEC T12.7-2; T12.1-1 and T12.2-1 keep their
//   plain exit assertions).
//
// T12.7-3's conservative operationalizations (per H-3/H-5/H-9):
// - The anchoring form is asserted byte-exactly where SPEC 14 + 11.6 fix the
//   spelling as a pure function of invocation input: the found configuration
//   file from the workspace root (`xspec.config.ts`) and from a nested
//   working directory two levels down (`../../xspec.config.ts` — ascent
//   spelled `..`, joined with `/`, failing a product that reports the path
//   workspace-relative); a `--config`-named file whose argument is spelled
//   with a leading `./` segment reporting the canonical
//   `cfg/broken.config.ts` (11.6: no `.` segments — failing a
//   verbatim-echoing product), present and missing alike (SPEC 14: "the
//   path `--config` names — it is that file"); and the failed upward search
//   with no `--config` concerning the working directory itself, spelled `.`
//   — from the root and from a nested cwd equally (the search starts at the
//   invocation working directory).
// - The failed-search premise is T7-1's: the workspace is a fresh unique
//   temporary directory (H-1) whose filesystem ancestors (the OS temp
//   directory and its parents) hold no `xspec.config.ts`, so the upward
//   search exhausts without a hit.
// - The configuration-error finding pins locations [] beside code and path:
//   SPEC 14 classes configuration conditions among those "without an
//   in-source location" (they carry the file or path they concern instead),
//   and T12.7-1 pins `locations` [] for unlocated conditions.
// - One-finding-however-many-defects is enforced through the document
//   decode: exactly one JSON document as the entire stdout (H-5), decoded
//   as {"error": …} with the single member holding ONE finding form — a
//   product reporting the three independently-staged 14.14 defects (an
//   unknown top-level key, a glob resolving outside the workspace root, an
//   unknown `markdown` field) as several findings, an array-valued `error`,
//   a `findings` member, or concatenated documents fails the decode; which
//   defect the one finding's message describes is unpinned (12.7: the
//   message is deterministic but otherwise unpinned).
// - A plain usage error pins exactly what the entry states: `code` null and
//   `path` null. Its locations and identities stay unpinned (the finding
//   form permits informational identities, 12.7, and the entry pins neither
//   for usage errors).
// - "Diagnostics on stderr" is asserted as non-empty stderr on every exit-2
//   arm; stderr byte-invariance across output forms and the /config/i
//   actionability operationalization are T12.0-2's and T7-*'s business.
// - Configuration-error runs use `build --json` (the T12.0-2/T7-*
//   precedent); the JSON-only-surface clause rides `inventory` twice — a
//   configuration error on the bare surface, a plain usage error with an
//   unknown flag and no `--json` — and the erroneous-arguments clause rides
//   an unknown command beside `--json`. Every arm's workspace stages a
//   valid source under a canonical spec group so the arm's staged defect is
//   its sole one (the T7-2 attribution discipline): a product that wrongly
//   proceeds exits 0 with a real answer and fails the exit-code assertion
//   attributably, never exits 2 for a side reason.

import { Buffer } from "node:buffer";
import type {
  Finding,
  NodeRow,
  OccurrenceRecord,
  PathValue,
  ReviewItem,
  SourceRange,
  ViewNode,
  ViewReport,
} from "../../helpers/adapters/index.js";
import {
  assertUnavailabilityMarkerForms,
  decodeAtReport,
  decodeExportReport,
  decodeFindingsReport,
  decodeInventoryResolvedMap,
  decodeNodeReport,
  decodeNodeRowsReport,
  decodeOccurrencesReport,
  decodeVersionDocument,
  decodeViewReport,
} from "../../helpers/adapters/index.js";
import {
  assertExitCode,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import type { ProductBinding, RunResult } from "../../helpers/subprocess.js";
import { runProduct } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { WorkspaceDecl } from "../../helpers/workspace.js";
import {
  assertConditionCounts,
  assertFindingMentionsLocation,
  assertSameJson,
  buildFindings,
  buildOk,
  expectErrorDocument,
  expectExit,
  expectFindingFreeReport,
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
// Arm F — the unpinned surfaces' ranges (11.1, 12.4, 10.7) through the H-3
// decode: exactly {"start", "end"}, byte-exact against the staged constructs
// ---------------------------------------------------------------------------
//
// 12.7's value forms bind every JSON output (H-3), pinned document form or
// not: on the shape-unpinned surfaces — `query node`, the `query nodes`/
// `subtree`/`ancestors` rows (11.1), `show --json` (12.4), and a review
// payload's node states (10.7) — a range reaches the assertion through the
// adjustable adapters' decode, whose range decode is the literal 12.7 form
// (`decodeSourceRange` = `decodeRangeForm`: exactly the two members,
// non-negative integers; a range carried as `[start, end]`, `{"from", "to"}`,
// or with an extra member fails there and is never re-mapped — S-5). This
// arm drives every listed surface over one fixture whose construct byte
// offsets are composed from the same parts that stage the files (the arm-A
// discipline), so each decoded range is additionally asserted byte-exact
// (SPEC 1.7: a non-root requirement node's range spans its section
// construct, a root's the entire file, a named code unit's the construct
// binding its name, 4.6).
//
// The review half stages SPEC 10.5's smallest change under a code
// reference: `top > top.leaf`, only the leaf's text edited between the
// baseline commit and `review create --base`, and `src/ref.ts#unit`
// referencing the leaf — a subtree-coherence item scoped at the leaf (its
// context the ancestor chain: the file root and `top`), a parent-consistency
// item at `top` (context: the leaf), and a code-impact item at the unit
// (context: the leaf; SPEC 10.5, 9.2), the leaf every item's origin — so the
// payload carries a present requirement-node scope, a present code-location
// scope, and present context and origin nodes, every one of which enters
// with its source range (SPEC 10.7, 1.7). Every range the payload carries is
// asserted: a present payload node without a range, or with a range other
// than its construct's, fails.

const UR_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: {
    app: ["src/**/*.ts"]
  }
})
`;

const UR_FILE = "specs/A.mdx";
const UR_ROOT_ID = UR_FILE;
const UR_TOP_ID = `${UR_FILE}#top`;
const UR_LEAF_ID = `${UR_FILE}#top.leaf`;

// The current (post-edit) spec source, composed so the top section's range
// spans its opening tag through its closing tag with the leaf nested inside.
const UR = new ByteFixture();
UR.add("Überschrift — multi-byte prefix.\n\n");
const UR_TOP_OPEN = '<S id="top">\nTop own text.\n\n';
const UR_LEAF_TEXT = '<S id="top.leaf">\nLeaf text, edited.\n</S>';
const UR_TOP_CLOSE = "\n</S>";
const UR_TOP_TEXT = `${UR_TOP_OPEN}${UR_LEAF_TEXT}${UR_TOP_CLOSE}`;
const UR_TOP_START = UR.add(UR_TOP_OPEN).start;
const UR_LEAF_RANGE = UR.add(UR_LEAF_TEXT);
const UR_TOP_RANGE: SourceRange = {
  start: UR_TOP_START,
  end: UR.add(UR_TOP_CLOSE).end,
};
UR.add("\n");
const UR_SOURCE = UR.source;
// A root node's range is the entire file (SPEC 1.7).
const UR_ROOT_RANGE: SourceRange = {
  start: 0,
  end: Buffer.byteLength(UR_SOURCE, "utf8"),
};
// The baseline: the same layout, the leaf's text alone differing (SPEC 5.6:
// the leaf is `changed`, `top` and the root descendant-changed).
const UR_BASELINE_SOURCE = UR_SOURCE.replace(
  "Leaf text, edited.",
  "Leaf text.",
);

const UR_CODE_FILE = "src/ref.ts";
const UR_UNIT_ID = `${UR_CODE_FILE}#unit`;
const UR_CODE = new ByteFixture();
UR_CODE.add(
  'import A from "../specs/A.xspec";\n\n// Präzise Bytes vor der Einheit (multi-byte prefix).\n\n',
);
// The named unit's range is the construct binding its name — the function
// declaration's own bytes, keyword through closing brace (SPEC 1.7, 4.6).
const UR_UNIT_TEXT = "function unit() {\n  A.top.leaf;\n}";
const UR_UNIT_RANGE = UR_CODE.add(UR_UNIT_TEXT);
UR_CODE.add("\n");
const UR_CODE_SOURCE = UR_CODE.source;

/** Every node this fixture stages, with its construct's byte range. */
const UR_RANGES: ReadonlyMap<string, SourceRange> = new Map([
  [UR_ROOT_ID, UR_ROOT_RANGE],
  [UR_TOP_ID, UR_TOP_RANGE],
  [UR_LEAF_ID, UR_LEAF_RANGE],
  [UR_UNIT_ID, UR_UNIT_RANGE],
]);

/** identity → range over the given identities, keys in byte order. */
function urExpectedRanges(ids: readonly string[]): Record<string, SourceRange> {
  const out: Record<string, SourceRange> = {};
  for (const id of [...ids].sort()) {
    const range = UR_RANGES.get(id);
    if (range === undefined) {
      throw new Error(
        `section-12.7 fixture self-check: no staged range for ${id}`,
      );
    }
    out[id] = range;
  }
  return out;
}

/**
 * Rows projected to identity → range, keys in byte order (T11-2/3 pin the
 * row order; this arm asserts membership and each row's range).
 */
function urRowRanges(
  rows: readonly NodeRow[],
  context: string,
): Record<string, SourceRange> {
  const out: Record<string, SourceRange> = {};
  const sorted = [...rows].sort((a, b) =>
    a.identity < b.identity ? -1 : a.identity > b.identity ? 1 : 0,
  );
  for (const row of sorted) {
    if (Object.hasOwn(out, row.identity)) {
      fail(
        `${context}: each node is reported once; ${row.identity} appears ` +
          `more than once among the rows (SPEC 11.1)`,
      );
    }
    out[row.identity] = row.sourceRange;
  }
  return out;
}

/** The unique item of a kind and scope node (SPEC 10.1, 10.5). */
function urRequireItem(
  items: readonly ReviewItem[],
  kind: ReviewItem["kind"],
  scope: string,
  context: string,
): ReviewItem {
  const matches = items.filter(
    (item) => item.kind === kind && item.scope.node === scope,
  );
  if (matches.length !== 1) {
    fail(
      `${context}: expected exactly one ${kind} item scoped at ${scope} ` +
        `(SPEC 10.5: the leaf edit yields the leaf's subtree-coherence item, ` +
        `top's parent-consistency item, and the referencing unit's ` +
        `code-impact item); found ${String(matches.length)} among ` +
        JSON.stringify(items.map((item) => `${item.kind} ${item.scope.node}`)),
    );
  }
  return matches[0]!;
}

function urRequireContext(
  item: ReviewItem,
  node: string,
  context: string,
): void {
  if (!item.context.some((state) => state.node === node)) {
    fail(
      `${context}: the item's context must carry ${node} (SPEC 10.5) — the ` +
        `present context node whose range this arm asserts; got ` +
        JSON.stringify(item.context.map((state) => state.node)),
    );
  }
}

/**
 * Every present node of a payload — scope, context, and origin (an origin
 * entry's presence is its after side's, SPEC 10.7) — enters with its
 * construct's range, decoded as exactly {"start", "end"} (SPEC 10.7, 1.7,
 * 12.7); an absent node carries none (the decode forbids one there).
 */
function urAssertPayloadRanges(item: ReviewItem, context: string): void {
  const states = [
    {
      what: "scope",
      node: item.scope.node,
      present: item.scope.present,
      range: item.scope.sourceRange,
    },
    ...item.context.map((state, index) => ({
      what: `context[${String(index)}]`,
      node: state.node,
      present: state.present,
      range: state.sourceRange,
    })),
    ...item.origin.map((entry, index) => ({
      what: `origin[${String(index)}]`,
      node: entry.node,
      present: entry.after.present,
      range: entry.sourceRange,
    })),
  ];
  for (const state of states) {
    if (!state.present) continue;
    const expected = UR_RANGES.get(state.node);
    if (expected === undefined) {
      fail(
        `${context}: ${state.what} presents ${state.node}, a node this ` +
          `fixture never staged`,
      );
    }
    if (state.range === undefined) {
      fail(
        `${context}: ${state.what} (${state.node}) is present but carries ` +
          `no source range — every present scope, context, and origin node, ` +
          `requirement node and code location alike, enters the payload ` +
          `with its source range (SPEC 10.7, 1.7)`,
      );
    }
    assertSameJson(
      state.range,
      expected,
      `${context}: ${state.what} (${state.node})'s range — decoded as ` +
        `exactly {"start", "end"} (12.7's universal value form, H-3) and ` +
        `byte-exact: the construct's own bytes (SPEC 1.7, 4.6, 10.7)`,
    );
  }
}

async function runUnpinnedRangesArm(product: ProductBinding): Promise<void> {
  sliceCheck(UR_SOURCE, UR_LEAF_RANGE, UR_LEAF_TEXT, "the leaf construct");
  sliceCheck(UR_SOURCE, UR_TOP_RANGE, UR_TOP_TEXT, "the top construct");
  sliceCheck(UR_CODE_SOURCE, UR_UNIT_RANGE, UR_UNIT_TEXT, "the named unit");
  if (UR_BASELINE_SOURCE === UR_SOURCE) {
    throw new Error(
      "section-12.7 fixture self-check: the baseline must differ from the " +
        "current source in the leaf's text",
    );
  }

  await withWorkspace(
    {
      files: {
        "xspec.config.ts": UR_CONFIG,
        [UR_FILE]: UR_BASELINE_SOURCE,
        [UR_CODE_FILE]: UR_CODE_SOURCE,
      },
    },
    async (workspace) => {
      const prefix = "T12.7-1 (unpinned-surface ranges)";
      await workspace.gitInit();
      const base = await workspace.gitCommitAll("baseline");
      await workspace.file(UR_FILE, UR_SOURCE);
      await buildOk(
        product,
        workspace,
        `${prefix} \`build\` after the leaf edit`,
      );

      // `query node` (11.1) and `show --json` (12.4): the node's own range.
      for (const argv of [
        ["query", "node", UR_LEAF_ID, "--json"],
        ["show", UR_LEAF_ID, "--json"],
      ]) {
        const context = `${prefix} \`${argv.join(" ")}\``;
        const report = decodeNodeReport(
          await runJson(product, workspace, argv, context),
          context,
        );
        if (report.identity !== UR_LEAF_ID) {
          fail(
            `${context}: the report must present the queried node ` +
              `${UR_LEAF_ID}; got ${JSON.stringify(report.identity)}`,
          );
        }
        assertSameJson(
          report.sourceRange,
          UR_LEAF_RANGE,
          `${context} — the node's source range decodes as exactly ` +
            `{"start", "end"} (12.7's universal value form, through the H-3 ` +
            `decode, never re-mapped) and is byte-exact: the section ` +
            `construct from its opening tag through its closing tag ` +
            `(SPEC 1.7, 11.1, 12.4)`,
        );
      }

      // The row surfaces (11.1): every row's range, membership per T11-2/3.
      const rowArms: readonly {
        readonly argv: readonly string[];
        readonly ids: readonly string[];
        readonly what: string;
      }[] = [
        {
          argv: ["query", "nodes", "--json"],
          ids: [UR_ROOT_ID, UR_TOP_ID, UR_LEAF_ID],
          what: "every node of the workspace",
        },
        {
          argv: ["query", "subtree", UR_TOP_ID, "--json"],
          ids: [UR_TOP_ID, UR_LEAF_ID],
          what: "top and its descendant",
        },
        {
          argv: ["query", "ancestors", UR_LEAF_ID, "--json"],
          ids: [UR_TOP_ID, UR_ROOT_ID],
          what: "the leaf's ancestors, top and the file root",
        },
      ];
      for (const arm of rowArms) {
        const context = `${prefix} \`${arm.argv.join(" ")}\``;
        const rows = decodeNodeRowsReport(
          await runJson(product, workspace, arm.argv, context),
          context,
        );
        assertSameJson(
          urRowRanges(rows, context),
          urExpectedRanges(arm.ids),
          `${context} — ${arm.what}, each row's range decoded as exactly ` +
            `{"start", "end"} (12.7, H-3) and byte-exact: a non-root ` +
            `node's section construct, the root's entire file (SPEC 1.7, 11.1)`,
        );
      }

      // The review payload (10.7): a present requirement-node scope, a
      // present code-location scope, and present context and origin nodes.
      await expectExit(
        product,
        workspace,
        ["review", "create", "--base", base, "--name", "s"],
        0,
        `${prefix} \`review create --base <baseline> --name s\` (SPEC 10.7)`,
      );
      const exportContext = `${prefix} \`review export s --json\``;
      const exported = decodeExportReport(
        await runJson(
          product,
          workspace,
          ["review", "export", "s", "--json"],
          exportContext,
        ),
        exportContext,
      );
      const leafItem = urRequireItem(
        exported.items,
        "subtree-coherence",
        UR_LEAF_ID,
        exportContext,
      );
      const topItem = urRequireItem(
        exported.items,
        "parent-consistency",
        UR_TOP_ID,
        exportContext,
      );
      const unitItem = urRequireItem(
        exported.items,
        "code-impact",
        UR_UNIT_ID,
        exportContext,
      );
      // The present context nodes the range assertion then covers.
      urRequireContext(
        leafItem,
        UR_ROOT_ID,
        `${exportContext} subtree-coherence`,
      );
      urRequireContext(
        leafItem,
        UR_TOP_ID,
        `${exportContext} subtree-coherence`,
      );
      urRequireContext(
        topItem,
        UR_LEAF_ID,
        `${exportContext} parent-consistency`,
      );
      urRequireContext(unitItem, UR_LEAF_ID, `${exportContext} code-impact`);
      for (const item of exported.items) {
        if (!item.origin.some((entry) => entry.node === UR_LEAF_ID)) {
          fail(
            `${exportContext}: the ${item.kind} item at ${item.scope.node} ` +
              `must carry the changed leaf ${UR_LEAF_ID} among its origin ` +
              `entries (SPEC 10.5) — the present origin node whose range ` +
              `this arm asserts; got ` +
              JSON.stringify(item.origin.map((entry) => entry.node)),
          );
        }
        urAssertPayloadRanges(
          item,
          `${exportContext} ${item.kind} item at ${item.scope.node}`,
        );
      }
    },
  );
}

// ---------------------------------------------------------------------------
// T12.7-2 arm A — findings-array ordering by value, and duplicate collapse
// ---------------------------------------------------------------------------
//
// One workspace stages six numbered conditions whose numeric order inverts
// both the token-alphabetical and the ordinal-decimal-string orders (module
// header note), each condition its files' sole defect:
//   14.1  missing-id          x3 — two id-less sections in E1.mdx (range-start
//                                  order between findings of one file) and one
//                                  in dual/D.mdx (file-byte order; the
//                                  two-group collapse staging)
//   14.3  duplicate-id        x1 — two bearers in C.mdx
//   14.5  unknown-dependency  x1 — an unresolved `d` in K.mdx
//   14.9  cycle               x1 — the spec import cycle IA <-> IB (unused
//                                  bindings: valid, no edges, so no dependency
//                                  cycle exists beside it)
//   14.15 invalid-import      x1 — a named-only (non-default) import in M.mdx,
//                                  designating the existing OK.mdx so the
//                                  binding form is the declaration's one defect
//   14.19 invalid-source-path x2 (x3 Linux) — `#`-containing paths ha#1/ha#2
//                                  and, Linux, a non-UTF-8 name whose marked
//                                  byte form sorts BEFORE the plain strings
//                                  ("specs/A\xFF…" < "specs/ha…" byte-wise):
//                                  one byte order over both presentation forms

const ORD_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"],
    extra: ["specs/dual/*.mdx"]
  }
})
`;

const ORD_E1_FILE = "specs/E1.mdx";
const ORD_E1 = new ByteFixture();
ORD_E1.add("Éléments — multi-byte prefix.\n\n");
const ORD_E1_FIRST_TEXT = "<S>\nFirst unnamed.\n</S>";
const ORD_E1_FIRST_RANGE = ORD_E1.add(ORD_E1_FIRST_TEXT);
ORD_E1.add("\n\n");
const ORD_E1_SECOND_TEXT = "<S>\nSecond unnamed.\n</S>";
const ORD_E1_SECOND_RANGE = ORD_E1.add(ORD_E1_SECOND_TEXT);
ORD_E1.add("\n");
const ORD_E1_SOURCE = ORD_E1.source;

// The collapse staging: discovered through BOTH spec groups (`main` and
// `extra`), its sole defect one id-less section (module header note).
const ORD_DUAL_FILE = "specs/dual/D.mdx";
const ORD_DUAL_SOURCE = "<S>\nDual-group unnamed.\n</S>\n";

const ORD_C_FILE = "specs/C.mdx";
const ORD_C_SOURCE =
  '<S id="dup">\nFirst bearer.\n</S>\n\n<S id="dup">\nSecond bearer.\n</S>\n';

const ORD_K_FILE = "specs/K.mdx";
const ORD_K_SOURCE = '<S id="k" d={"nope"}>\nK text.\n</S>\n';

const ORD_IA_FILE = "specs/IA.mdx";
const ORD_IA_SOURCE = 'import B from "./IB.xspec"\n\n<S id="ia">\nIA.\n</S>\n';
const ORD_IB_FILE = "specs/IB.mdx";
const ORD_IB_SOURCE = 'import A from "./IA.xspec"\n\n<S id="ib">\nIB.\n</S>\n';

const ORD_M_FILE = "specs/M.mdx";
const ORD_M_SOURCE =
  'import { x } from "./OK.xspec"\n\n<S id="m">\nM text.\n</S>\n';
const ORD_OK_FILE = "specs/OK.mdx";
const ORD_OK_SOURCE = '<S id="ok">\nOK text.\n</S>\n';

const ORD_HASH1_FILE = "specs/ha#1.mdx";
const ORD_HASH2_FILE = "specs/ha#2.mdx";
const ORD_HASH1_SOURCE = '<S id="v1">\nValid content one.\n</S>\n';
const ORD_HASH2_SOURCE = '<S id="v2">\nValid content two.\n</S>\n';

// (Linux leg) The non-UTF-8-named source: 0x41 ("A") then 0xFF, so its exact
// bytes sort before every staged plain 14.19 path ("specs/h…"), composed from
// the same bytes that stage the file (the T12.7-1 arm-E discipline).
const ORD_NU_PATH_BYTES = Buffer.concat([
  Buffer.from("specs/A", "utf8"),
  Buffer.from([0xff]),
  Buffer.from(".mdx", "utf8"),
]);
const ORD_NU_MARKED = { bytes: ORD_NU_PATH_BYTES.toString("hex") } as const;
const ORD_NU_SOURCE = '<S id="v3">\nValid content three.\n</S>\n';

/** The pinned 12.7 findings order over the staged conditions (SPEC 12.7, 14). */
const ORD_EXPECTED_FINDINGS: readonly FindingFormExpectation[] = [
  { code: "missing-id", path: null, locations: [ORD_E1_FILE] },
  { code: "missing-id", path: null, locations: [ORD_E1_FILE] },
  { code: "missing-id", path: null, locations: [ORD_DUAL_FILE] },
  { code: "duplicate-id", path: null, locations: [ORD_C_FILE, ORD_C_FILE] },
  { code: "unknown-dependency", path: null, locations: [ORD_K_FILE] },
  { code: "cycle", path: null, locations: [ORD_IA_FILE, ORD_IB_FILE] },
  { code: "invalid-import", path: null, locations: [ORD_M_FILE] },
  ...(NON_UTF8_STAGED
    ? [
        {
          code: "invalid-source-path",
          path: ORD_NU_MARKED,
          locations: [],
        } satisfies FindingFormExpectation,
      ]
    : []),
  { code: "invalid-source-path", path: ORD_HASH1_FILE, locations: [] },
  { code: "invalid-source-path", path: ORD_HASH2_FILE, locations: [] },
];

const ORD_EXPECTED_COUNTS: Readonly<Record<string, number>> = {
  "14.1": 3,
  "14.3": 1,
  "14.5": 1,
  "14.9": 1,
  "14.15": 1,
  "14.19": NON_UTF8_STAGED ? 3 : 2,
};

function assertOrderedFindings(
  findings: readonly Finding[],
  context: string,
): void {
  assertConditionCounts(
    findings,
    ORD_EXPECTED_COUNTS,
    `${context} — each staged condition is its files' sole defect, the ` +
      `two-group file's defect reported once (identically-staged duplicate ` +
      `findings collapse to one; SPEC 12.7, 14)`,
  );
  assertSameJson(
    findings.map(projectFindingForm),
    ORD_EXPECTED_FINDINGS,
    `${context} — the findings array in the pinned 12.7 order: by code ` +
      `with numbered conditions in NUMERIC order (missing-id(1) first ` +
      `though alphabetically last; invalid-import(15) after cycle(9) ` +
      `though "15" < "9" as decimal strings), then by locations ` +
      `element-wise (both E1 findings before dual/D's — file-byte order — ` +
      `and C's two in-file locations riding one finding), then by ` +
      `concerned path in ONE byte order over both presentation forms ` +
      `(the marked byte-form path before the plain "specs/ha#…" strings ` +
      `on the Linux leg), null-path located findings carrying path null ` +
      `(SPEC 12.7, 14)`,
  );
  // Range-start order between same-file findings, observed by containment in
  // disjoint windows in the expected sequence (the T12.7-1 technique).
  assertLocationWithin(
    findings[0]!,
    0,
    widen(ORD_E1_FIRST_RANGE),
    `${context} — the first missing-id finding's location (E1's first ` +
      `id-less construct; range-start order between findings of one file, ` +
      `SPEC 12.7)`,
  );
  assertLocationWithin(
    findings[1]!,
    0,
    widen(ORD_E1_SECOND_RANGE),
    `${context} — the second missing-id finding's location (E1's second ` +
      `id-less construct)`,
  );
}

async function runConditionOrderingArm(product: ProductBinding): Promise<void> {
  sliceCheck(
    ORD_E1_SOURCE,
    ORD_E1_FIRST_RANGE,
    ORD_E1_FIRST_TEXT,
    "E1's first id-less construct",
  );
  sliceCheck(
    ORD_E1_SOURCE,
    ORD_E1_SECOND_RANGE,
    ORD_E1_SECOND_TEXT,
    "E1's second id-less construct",
  );

  const workspace = await TestWorkspace.create({
    files: {
      "xspec.config.ts": ORD_CONFIG,
      [ORD_E1_FILE]: ORD_E1_SOURCE,
      [ORD_DUAL_FILE]: ORD_DUAL_SOURCE,
      [ORD_C_FILE]: ORD_C_SOURCE,
      [ORD_K_FILE]: ORD_K_SOURCE,
      [ORD_IA_FILE]: ORD_IA_SOURCE,
      [ORD_IB_FILE]: ORD_IB_SOURCE,
      [ORD_M_FILE]: ORD_M_SOURCE,
      [ORD_OK_FILE]: ORD_OK_SOURCE,
      [ORD_HASH1_FILE]: ORD_HASH1_SOURCE,
      [ORD_HASH2_FILE]: ORD_HASH2_SOURCE,
    },
  });
  try {
    if (NON_UTF8_STAGED) {
      await workspace.file(ORD_NU_PATH_BYTES, ORD_NU_SOURCE);
    }

    // --- `build --json`: the several-conditions findings array, ordered and
    // collapsed per 12.7; the build report is `{"findings": […]}` exactly
    // (decoder-enforced).
    const buildContext = "T12.7-2 (condition ordering) `build --json`";
    assertOrderedFindings(
      await buildFindings(product, workspace, buildContext),
      buildContext,
    );

    // --- The gated read: on a workspace failing `build`'s validations,
    // `query` reports exactly those findings and exits 1 without answering
    // (SPEC 13.3) — its report the same findings-only document
    // `{"findings": […]}`, in the same pinned order (12.7). `query` is a
    // JSON-only surface (11), so the single JSON document needs no `--json`.
    const queryContext =
      "T12.7-2 (condition ordering) gated `query nodes` on the failing " +
      "workspace";
    const queryResult = await expectExit(
      product,
      workspace,
      ["query", "nodes"],
      1,
      `${queryContext} — a failing workspace's read reports the findings a ` +
        `\`build\` would now report and exits 1 without answering ` +
        `(SPEC 13.3, 12.0)`,
    );
    assertOrderedFindings(
      decodeFindingsReport(
        parseJsonStdout(queryResult, queryContext),
        `${queryContext} — a refusing read's report is the findings-only ` +
          `document {"findings": […]} (SPEC 12.7, 13.3)`,
      ).findings,
      queryContext,
    );

    // --- `inventory` (JSON-only; parses no sources, so the answer is
    // finding-free, exit 0 — SPEC 11.6): the collapse premise — the dual
    // file's membership in BOTH spec groups, configuration order — and the
    // entry's named null-never-omission example: the `markdown` key absent
    // resolves to {"emit": false, "outDir": null}, `outDir` null, never
    // omitted (SPEC 7.3, 11.6, 12.7; the full resolved view is T11.6-2's).
    const invContext = "T12.7-2 (condition ordering) `inventory`";
    const invDoc = await runJson(product, workspace, ["inventory"], invContext);
    const resolved = decodeInventoryResolvedMap(invDoc, invContext);
    assertSameJson(
      resolved.configuration.markdown,
      { emit: false, outDir: null },
      `${invContext} — an unset \`outDir\` is null: null is never omission ` +
        `(SPEC 12.7, 7.3, 11.6)`,
    );
    const dualEntry = resolved.sources.find(
      (entry) => entry.path === ORD_DUAL_FILE,
    );
    if (dualEntry === undefined) {
      fail(
        `${invContext}: the discovered source ${JSON.stringify(
          ORD_DUAL_FILE,
        )} must appear in the inventory's sources (SPEC 11.6) — the ` +
          `collapse staging's premise; got paths ` +
          `${JSON.stringify(resolved.sources.map((entry) => entry.path))}`,
      );
    }
    assertSameJson(
      dualEntry.groups,
      [
        { name: "main", kind: "spec" },
        { name: "extra", kind: "spec" },
      ],
      `${invContext} — the collapse staging's premise: the defect file is ` +
        `discovered through BOTH spec groups (memberships in configuration ` +
        `order, SPEC 7, 11.6), so a per-group-iterating product reports ` +
        `its finding twice where 12.7 collapses to one`,
    );
  } finally {
    await workspace.dispose();
  }
}

// ---------------------------------------------------------------------------
// T12.7-2 arm B — the multi-reason refusal: refusal reasons in 14's listed
// order
// ---------------------------------------------------------------------------
//
// TEST-SPEC 14's dual staging (T14-7): a section move staged to both collide
// (`<new-id>` present in the target file) and create a dependency cycle. The
// listed order — refused-id-collision (3rd) before refused-cycle (6th) —
// inverts the token-alphabetical order, so a token-sorting product fails.
// No third reason is applicable (module header note).

const MR_FILE = "specs/MR.mdx";
const MR = new ByteFixture();
MR.add("Préambule — multi-byte prefix.\n\n");
MR.add('<S id="keep">\nKeep text.\n\n');
const MR_SUB_TEXT = '<S id="keep.sub">\nExisting sub text.\n</S>';
const MR_SUB_RANGE = MR.add(MR_SUB_TEXT);
MR.add("\n</S>\n\n");
MR.add('<S id="mv" ');
const MR_D_TEXT = 'd={"keep"}';
const MR_D_RANGE = MR.add(MR_D_TEXT);
MR.add(">\nMoved candidate text.\n</S>\n");
const MR_SOURCE = MR.source;

async function runRefusalOrderingArm(product: ProductBinding): Promise<void> {
  sliceCheck(MR_SOURCE, MR_SUB_RANGE, MR_SUB_TEXT, "the remaining bearer");
  sliceCheck(MR_SOURCE, MR_D_RANGE, MR_D_TEXT, "the cycle's `d` spelling");

  await withWorkspace(
    {
      files: {
        "xspec.config.ts": SPECS_ONLY_CONFIG,
        [MR_FILE]: MR_SOURCE,
      },
    },
    async (workspace) => {
      await buildOk(
        product,
        workspace,
        "T12.7-2 (refusal ordering) premise `build` — the refusal reasons " +
          "are defined only over a workspace passing build's validations " +
          "(SPEC 6.4, 6.5, 14)",
      );
      const context =
        "T12.7-2 (refusal ordering) `move specs/MR.mdx#mv " +
        "specs/MR.mdx#keep.sub --json`";
      const result = await expectExit(
        product,
        workspace,
        ["move", `${MR_FILE}#mv`, `${MR_FILE}#keep.sub`, "--json"],
        1,
        `${context} — the move both collides (keep.sub remains after the ` +
          `subtree removal) and would create a dependency cycle (the moved ` +
          `node depends on \`keep\` and would become its child, SPEC 5.3), ` +
          `so it is refused: exit 1, every applicable reason reported ` +
          `together (SPEC 6.5, 14, 12.0)`,
      );
      const findings = decodeFindingsReport(
        parseJsonStdout(
          result,
          `${context} — a refused operation's report is the findings-only ` +
            `document {"findings": […]} (SPEC 12.7, 14)`,
        ),
        context,
      ).findings;
      assertSameJson(
        findings.map((finding) => ({
          code: finding.code,
          path: finding.path,
        })),
        [
          { code: "refused-id-collision", path: null },
          { code: "refused-cycle", path: null },
        ],
        `${context} — the multi-reason refusal report: one finding per ` +
          `applicable reason and no reason beside them (SPEC 14), in 14's ` +
          `LISTED order — refused-id-collision (3rd listed) before ` +
          `refused-cycle (6th listed), the inverse of their alphabetical ` +
          `order — with \`path\` null on located findings (SPEC 12.7)`,
      );
      assertFindingMentionsLocation(
        findings[0]!,
        { file: MR_FILE, window: widen(MR_SUB_RANGE) },
        `${context} — the collision finding locates the remaining bearer ` +
          `\`keep.sub\`'s construct (SPEC 14: every colliding bearer)`,
      );
      assertFindingMentionsLocation(
        findings[1]!,
        { file: MR_FILE, window: widen(MR_D_RANGE) },
        `${context} — the cycle finding locates the participating ` +
          `reference spelling \`d={"keep"}\` (SPEC 14: the would-be ` +
          `cycle's full path in source)`,
      );
    },
  );
}

// ---------------------------------------------------------------------------
// T12.7-2 arm C — the identities tie-break: two policy findings equal up to
// the rule name
// ---------------------------------------------------------------------------
//
// Two forbidden rules with identical selectors match the one staged edge, so
// `check` reports two findings identical in code (policy-violation),
// locations ([]), and path (null), ordered by identities element-wise — the
// rule name, their first element. The rules are declared in the OPPOSITE
// order ("rb" first), so a configuration-order emission fails.

const IDS_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  policy: [
    {
      name: "rb",
      type: "forbidden",
      from: { group: "main" },
      to: { group: "main" }
    },
    {
      name: "ra",
      type: "forbidden",
      from: { group: "main" },
      to: { group: "main" }
    }
  ]
})
`;

const IDS_FILE = "specs/P.mdx";
const IDS_SOURCE = `<S id="a">
Target leaf.
</S>

<S id="p" d={"a"}>
Dependent leaf.
</S>
`;

async function runIdentitiesOrderingArm(
  product: ProductBinding,
): Promise<void> {
  await withWorkspace(
    {
      files: {
        "xspec.config.ts": IDS_CONFIG,
        [IDS_FILE]: IDS_SOURCE,
      },
    },
    async (workspace) => {
      await buildOk(
        product,
        workspace,
        "T12.7-2 (identities ordering) `build` — policy never fails a " +
          "build (SPEC 7.5, 12.1)",
      );
      const context = "T12.7-2 (identities ordering) `check --json`";
      const result = await expectExit(
        product,
        workspace,
        ["check", "--json"],
        1,
        `${context} — the staged depends edge violates both forbidden ` +
          `rules: one finding per rule and offending edge (SPEC 7.5, ` +
          `14.12, 12.0)`,
      );
      const findings = decodeFindingsReport(
        parseJsonStdout(result, context),
        context,
      ).findings;
      assertConditionCounts(findings, { "14.12": 2 }, context);
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
            identities: ["ra", "specs/P.mdx#p", "depends", "specs/P.mdx#a"],
          },
          {
            code: "policy-violation",
            locations: [],
            path: null,
            identities: ["rb", "specs/P.mdx#p", "depends", "specs/P.mdx#a"],
          },
        ],
        `${context} — two findings identical in code, locations ([]), and ` +
          `path (null) sort by identities element-wise: "ra" before "rb" ` +
          `by identity bytes though "rb" is declared first, so a ` +
          `configuration-order emission fails; each finding's identities ` +
          `are 14.12's exact enumeration [rule, source, kind token, ` +
          `target] (SPEC 12.7, 14.12)`,
      );
    },
  );
}

// ---------------------------------------------------------------------------
// T12.7-2 arm D — document forms and member presence
// ---------------------------------------------------------------------------
//
// One small valid workspace drives each form-catalog surface this test owns
// (module header note names the delegations): a successful `build --json`
// and a finding-free `check --json` on the clean, freshly built workspace
// (each exactly `{"findings": []}` as the entire stdout — the findings-only
// form with the empty array, its one member and nothing beside it; a
// finding-free `findings` is [], never null),
// `occurrences` (`{"findings", "occurrences"}` with the one byte-exact
// record), `view` without and with `--text` (the eight node members with
// `ownText`/`subtreeText` present exactly under the flag — decoder-enforced
// conditional presence — attribute entries `{"name", "range", "text"}`,
// imports `{"range", "name", "target"}`, a root's `attributes` [] and its
// absent opening/closing as the stated null), `at` (`{"findings",
// "resolution"}` with `occurrence` null when the offset lies in none), and
// `version` (`{"product", "interface"}`; values are T12.6-1's).

const DF_F_FILE = "specs/F.mdx";
const DF_W_FILE = "specs/W.mdx";

const DF_F = new ByteFixture();
DF_F.add("Façade — multi-byte prefix.\n\n");
const DF_IMPORT_TEXT = 'import W from "./W.xspec"';
const DF_IMPORT_RANGE = DF_F.add(DF_IMPORT_TEXT);
DF_F.add("\n\n");
const DF_F_START = DF_F.pos;
DF_F.add("<S ");
const DF_ATTR_ID_RANGE = DF_F.add('id="f"');
DF_F.add(" ");
const DF_ATTR_TAGS_RANGE = DF_F.add('tags="alpha beta"');
DF_F.add(" ");
const DF_ATTR_COV_RANGE = DF_F.add('coverage="none"');
const DF_F_GT_RANGE = DF_F.add(">");
DF_F.add("\n");
const DF_BODY_RANGE = DF_F.add("Body text.");
DF_F.add("\n\n");
const DF_LEAF_START = DF_F.pos;
DF_F.add("<S ");
const DF_LEAF_ATTR_ID_RANGE = DF_F.add('id="f.leaf"');
const DF_LEAF_GT_RANGE = DF_F.add(">");
DF_F.add("\nEmbed: ");
const DF_EMBED_TEXT = "{text(W.w)}";
const DF_EMBED_RANGE = DF_F.add(DF_EMBED_TEXT);
DF_F.add("\n");
const DF_LEAF_CLOSE_RANGE = DF_F.add("</S>");
DF_F.add("\n");
const DF_F_CLOSE_RANGE = DF_F.add("</S>");
DF_F.add("\n");
const DF_F_SOURCE = DF_F.source;

const DF_F_RANGE: SourceRange = {
  start: DF_F_START,
  end: DF_F_CLOSE_RANGE.end,
};
const DF_F_OPENING: SourceRange = {
  start: DF_F_START,
  end: DF_F_GT_RANGE.end,
};
const DF_LEAF_RANGE: SourceRange = {
  start: DF_LEAF_START,
  end: DF_LEAF_CLOSE_RANGE.end,
};
const DF_LEAF_OPENING: SourceRange = {
  start: DF_LEAF_START,
  end: DF_LEAF_GT_RANGE.end,
};

const DF_W_SOURCE = '<S id="w">\nW text.\n</S>\n';

// The workspace's one occurrence: f.leaf's embedding of W's `w` (byte-exact
// container span; the source graph node's own construct range — SPEC 5.7).
const DF_EXPECTED_OCCURRENCE: OccurrenceRecord = {
  file: DF_F_FILE,
  range: DF_EMBED_RANGE,
  kind: "embeds",
  source: { identity: `${DF_F_FILE}#f.leaf`, range: DF_LEAF_RANGE },
  target: `${DF_W_FILE}#w`,
};

/** The asserted projection of one view node's non-text members. */
function projectViewNode(node: ViewNode): unknown {
  return {
    identity: node.identity,
    range: node.range,
    opening: node.opening,
    closing: node.closing,
    attributes: node.attributes,
    tags: node.tags,
    coverage: node.coverage,
    childCount: node.children.length,
  };
}

/** Assert a decoded text member is a plain string containing `expected`. */
function assertTextContains(
  value: string | { readonly unavailable: true } | undefined,
  expected: string,
  context: string,
): void {
  if (typeof value !== "string" || !value.includes(expected)) {
    fail(
      `${context}: expected a defined text value — a plain string carrying ` +
        `the embedded target's text ${JSON.stringify(expected)} (SPEC 1.6: ` +
        `own and subtree text are the expanded values; 11.2: defined here, ` +
        `every embedding resolving) — got ${JSON.stringify(value)}`,
    );
  }
}

function assertDocumentFormsViews(
  report: ViewReport,
  text: boolean,
  context: string,
): void {
  assertSameJson(
    report.findings,
    [],
    `${context} — a finding-free answer's findings member is [], never ` +
      `null (SPEC 12.7)`,
  );
  assertSameJson(
    report.views.map((view) => view.file),
    [DF_F_FILE, DF_W_FILE],
    `${context} — per-file views in path-byte order (SPEC 11.4, 12.7)`,
  );
  const fView = report.views[0]!;
  const root = fView.root;
  assertSameJson(
    {
      identity: root.identity,
      opening: root.opening,
      closing: root.closing,
      attributes: root.attributes,
      childCount: root.children.length,
    },
    {
      identity: DF_F_FILE,
      opening: null,
      closing: null,
      attributes: [],
      childCount: 1,
    },
    `${context} — the root node: identity the file path (SPEC 1.5), ` +
      `opening/closing the stated null (a root has neither tag range, ` +
      `SPEC 11.4 — null, never omitted), and attributes [] — an empty ` +
      `list is [], never null (SPEC 12.7); the root's tags/coverage ` +
      `null distinction is T11.4-3's`,
  );
  const fNode = root.children[0]!;
  assertSameJson(
    projectViewNode(fNode),
    {
      identity: `${DF_F_FILE}#f`,
      range: DF_F_RANGE,
      opening: DF_F_OPENING,
      closing: DF_F_CLOSE_RANGE,
      attributes: [
        { name: "id", range: DF_ATTR_ID_RANGE, text: 'id="f"' },
        { name: "tags", range: DF_ATTR_TAGS_RANGE, text: 'tags="alpha beta"' },
        { name: "coverage", range: DF_ATTR_COV_RANGE, text: 'coverage="none"' },
      ],
      tags: ["alpha", "beta"],
      coverage: "none",
      childCount: 1,
    },
    `${context} — the section node \`f\`: the eight-member node form with ` +
      `byte-exact construct/opening/closing ranges, one attribute entry ` +
      `{"name", "range", "text"} per spelled attribute in tag order, and ` +
      `the interpreted tags/coverage (SPEC 11.4, 12.7)`,
  );
  const leafNode = fNode.children[0]!;
  assertSameJson(
    projectViewNode(leafNode),
    {
      identity: `${DF_F_FILE}#f.leaf`,
      range: DF_LEAF_RANGE,
      opening: DF_LEAF_OPENING,
      closing: DF_LEAF_CLOSE_RANGE,
      attributes: [
        { name: "id", range: DF_LEAF_ATTR_ID_RANGE, text: 'id="f.leaf"' },
      ],
      tags: [],
      coverage: "required",
      childCount: 0,
    },
    `${context} — the leaf node: an attribute-free non-root's interpreted ` +
      `defaults are tags [] (an empty list, never null — 11.4 states ` +
      `structural absence for roots alone) and coverage "required" ` +
      `(SPEC 11.2, 2.5, 2.6, 12.7)`,
  );
  assertSameJson(
    fView.imports,
    [{ range: DF_IMPORT_RANGE, name: "W", target: DF_W_FILE }],
    `${context} — the import entry {"range", "name", "target"}: the ` +
      `declaration's byte-exact range, its default binding name, its ` +
      `resolved target (SPEC 11.4, 12.7)`,
  );
  assertSameJson(
    fView.occurrences,
    [DF_EXPECTED_OCCURRENCE],
    `${context} — the viewed file's occurrence records (SPEC 11.4, 5.7)`,
  );
  assertSameJson(
    fView.comments,
    [],
    `${context} — a comment-free file's comments member is [] (SPEC 11.4, ` +
      `12.7)`,
  );
  const wView = report.views[1]!;
  assertSameJson(
    {
      wChild: wView.root.children[0]!.identity,
      imports: wView.imports,
      occurrences: wView.occurrences,
      comments: wView.comments,
    },
    {
      wChild: `${DF_W_FILE}#w`,
      imports: [],
      occurrences: [],
      comments: [],
    },
    `${context} — the second view: W's section node, with empty imports/` +
      `occurrences/comments each [] (SPEC 11.4, 12.7)`,
  );
  if (text) {
    const fWithText = report.views[0]!.root.children[0]!;
    assertTextContains(
      fWithText.children[0]!.ownText,
      "W text.",
      `${context} — the leaf's ownText under --text`,
    );
    assertTextContains(
      fWithText.subtreeText,
      "W text.",
      `${context} — \`f\`'s subtreeText under --text`,
    );
  }
}

async function runDocumentFormsArm(product: ProductBinding): Promise<void> {
  sliceCheck(DF_F_SOURCE, DF_IMPORT_RANGE, DF_IMPORT_TEXT, "F's import");
  sliceCheck(DF_F_SOURCE, DF_EMBED_RANGE, DF_EMBED_TEXT, "F's embed");
  sliceCheck(DF_F_SOURCE, DF_ATTR_ID_RANGE, 'id="f"', "f's id attribute");
  sliceCheck(
    DF_F_SOURCE,
    DF_ATTR_TAGS_RANGE,
    'tags="alpha beta"',
    "f's tags attribute",
  );
  sliceCheck(
    DF_F_SOURCE,
    DF_ATTR_COV_RANGE,
    'coverage="none"',
    "f's coverage attribute",
  );
  sliceCheck(
    DF_F_SOURCE,
    DF_LEAF_ATTR_ID_RANGE,
    'id="f.leaf"',
    "the leaf's id attribute",
  );
  sliceCheck(
    DF_F_SOURCE,
    DF_F_OPENING,
    '<S id="f" tags="alpha beta" coverage="none">',
    "f's opening tag",
  );
  sliceCheck(
    DF_F_SOURCE,
    DF_LEAF_RANGE,
    '<S id="f.leaf">\nEmbed: {text(W.w)}\n</S>',
    "the leaf construct",
  );

  await withWorkspace(
    {
      files: {
        "xspec.config.ts": SPECS_ONLY_CONFIG,
        [DF_F_FILE]: DF_F_SOURCE,
        [DF_W_FILE]: DF_W_SOURCE,
      },
    },
    async (workspace) => {
      await buildOk(
        product,
        workspace,
        "T12.7-2 (document forms) `build` — the staged workspace is valid",
      );

      // --- A successful `build --json` on the clean, freshly built
      // workspace: exactly `{"findings": []}` as the entire stdout — the pin
      // exercised on the report form itself (SPEC 12.1, 12.7).
      await expectFindingFreeReport(
        product,
        workspace,
        ["build", "--json"],
        "T12.7-2 (document forms) `build --json` on the clean, freshly " +
          "built workspace (SPEC 12.1: a successful build; 12.7: the " +
          "findings-only form with the empty array)",
      );

      // --- A finding-free `check --json` on the same freshly built
      // workspace: exactly `{"findings": []}` as the entire stdout.
      await expectFindingFreeReport(
        product,
        workspace,
        ["check", "--json"],
        "T12.7-2 (document forms) `check --json` on the clean, freshly " +
          "built workspace (SPEC 12.2: no finding; 12.7: the findings-only " +
          "form with the empty array)",
      );

      // --- `occurrences`: `{"findings", "occurrences"}` with the byte-exact
      // record (JSON-only, no `--json` needed; SPEC 11.3, 11).
      const occContext = "T12.7-2 (document forms) bare `occurrences`";
      const occReport = decodeOccurrencesReport(
        await runJson(
          product,
          workspace,
          ["occurrences"],
          `${occContext} — a complete, finding-free answer exits 0 ` +
            `(SPEC 11.2)`,
        ),
        occContext,
      );
      assertSameJson(
        { findings: occReport.findings, occurrences: occReport.occurrences },
        { findings: [], occurrences: [DF_EXPECTED_OCCURRENCE] },
        `${occContext} — the occurrences document: findings [] and the one ` +
          `record {"file", "range", "kind", "source", "target"} with the ` +
          `byte-exact container span and the source node's own construct ` +
          `range (SPEC 11.3, 5.7, 12.7)`,
      );

      // --- `view` without `--text`: the node text members are ABSENT (the
      // stated conditional presence — the decoder rejects them under
      // text: false and requires them under text: true; SPEC 11.4, 12.7).
      const viewContext = "T12.7-2 (document forms) bare `view`";
      assertDocumentFormsViews(
        decodeViewReport(
          await runJson(
            product,
            workspace,
            ["view"],
            `${viewContext} — a complete, finding-free answer exits 0 ` +
              `(SPEC 11.2, 11.4)`,
          ),
          { text: false },
          viewContext,
        ),
        false,
        viewContext,
      );

      // --- `view --text`: both text members present on every node.
      const viewTextContext = "T12.7-2 (document forms) `view --text`";
      assertDocumentFormsViews(
        decodeViewReport(
          await runJson(
            product,
            workspace,
            ["view", "--text"],
            `${viewTextContext} — every expansion resolves, so the answer ` +
              `stays complete and finding-free, exit 0 (SPEC 11.2, 11.4)`,
          ),
          { text: true },
          viewTextContext,
        ),
        true,
        viewTextContext,
      );

      // --- `at`: `{"findings", "resolution"}`; an offset inside `f`'s body
      // text lies within no occurrence, so `occurrence` is the stated null —
      // present, never omitted (SPEC 11.5, 12.7).
      const atOffset = DF_BODY_RANGE.start + 3;
      const atContext = `T12.7-2 (document forms) \`at ${DF_F_FILE} ${String(atOffset)}\``;
      const atReport = decodeAtReport(
        await runJson(
          product,
          workspace,
          ["at", DF_F_FILE, String(atOffset)],
          `${atContext} — every within-file offset resolves; a complete, ` +
            `finding-free answer exits 0 (SPEC 11.5, 11.2)`,
        ),
        atContext,
      );
      assertSameJson(
        { findings: atReport.findings, resolution: atReport.resolution },
        {
          findings: [],
          resolution: {
            section: { identity: `${DF_F_FILE}#f`, range: DF_F_RANGE },
            occurrence: null,
          },
        },
        `${atContext} — the at document: resolution {"section", ` +
          `"occurrence"} with the innermost enclosing section construct ` +
          `(byte-exact range) and occurrence null — the offset lies in no ` +
          `occurrence, and null is never omission (SPEC 11.5, 12.7)`,
      );

      // --- `version`: `{"product", "interface"}` exactly (JSON-only). The
      // decode pins the two-member form; values are T12.6-1's.
      const versionContext = "T12.7-2 (document forms) bare `version`";
      decodeVersionDocument(
        await runJson(product, workspace, ["version"], versionContext),
        versionContext,
      );
    },
  );
}

// ---------------------------------------------------------------------------
// T12.7-3 — the exit-2 error document (12.0, 12.7, 14)
// ---------------------------------------------------------------------------
//
// SPEC 12.0: with JSON output in effect, an invocation failing with a usage
// or configuration error (exit 2) emits as its entire stdout a single JSON
// document reporting the error — the error document of 12.7, `{"error": …}`
// holding ONE finding form. SPEC 14: a configuration error's concerned path
// is reported in the anchoring form of 11.6, identified relative to the
// invocation working directory — where a configuration file is concerned
// (the file the upward search found, or the path `--config` names) it is
// that file; for missing configuration with no `--config`, the directory
// the failed search started from, the invocation working directory,
// spelled `.`.

/** A minimal valid source, matched by SPECS_ONLY_CONFIG's spec group. */
const ERR_SOURCE = '<S id="a">\nAlpha.\n</S>\n';

/**
 * The single-deviation invalid configuration (the T7-2 attribution
 * discipline): the canonical valid file plus one unknown top-level key, so
 * the refusal is attributable to that one 14.14 defect and nothing else
 * (SPEC 7: unknown keys anywhere in the defineConfig argument are a
 * configuration error).
 */
const ERR_UNKNOWN_KEY_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  definitelyUnknownKey: true
})
`;

/**
 * Three independent 14.14 defects in one well-formed declarative-form file
 * (SPEC 7): an unknown top-level key, a glob resolving outside the
 * workspace root, and an unknown `markdown` field — "a configuration file
 * with several distinct defects" (T12.7-3), each a configuration error on
 * its own.
 */
const ERR_MULTI_DEFECT_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  definitelyUnknownKey: true,
  specs: {
    main: ["specs/**/*.mdx"],
    outside: ["../escapee/**/*.mdx"]
  },
  markdown: { emit: true, definitelyUnknownField: false }
})
`;

/**
 * Diagnostics are standard-error content (SPEC 12.0; T12.7-3: "each the
 * error document on stdout, diagnostics on stderr"): non-empty stderr on
 * every exit-2 arm. Stderr byte-invariance across output forms and the
 * /config/i actionability operationalization stay T12.0-2's and T7-*'s.
 */
function assertStderrDiagnostic(result: RunResult, context: string): void {
  if (result.stderrBytes.length > 0) return;
  fail(
    `${context}: usage and configuration error messages are standard-error ` +
      `content (SPEC 12.0), so the exit-2 diagnostics must appear on ` +
      `stderr beside the JSON error document on stdout — got empty stderr ` +
      `from ${result.commandLine}`,
  );
}

/**
 * Run an invocation with JSON output in effect that must fail as a
 * configuration error: exit 2 exactly (SPEC 14.14, 12.0), stderr
 * diagnostics present, and stdout exactly the single 12.7 error document
 * whose one finding carries the stable code `configuration-error`,
 * locations [] (SPEC 14: configuration conditions carry no in-source
 * location), and the concerned path exactly `expectedPath` — the anchoring
 * form of 11.6, identified relative to the invocation working directory
 * (SPEC 14, 12.7).
 */
async function expectAnchoredConfigurationError(
  product: ProductBinding,
  cwd: string,
  argv: readonly string[],
  expectedPath: string,
  context: string,
): Promise<void> {
  const result = await runProduct(product, { cwd, argv });
  assertExitCode(
    result,
    2,
    `${context} — missing or invalid configuration is a configuration ` +
      `error, reported by every command that loads configuration as a ` +
      `usage-error outcome (SPEC 14.14, 12.0)`,
  );
  assertStderrDiagnostic(result, context);
  const finding = expectErrorDocument(result, context);
  assertSameJson(
    projectFindingForm(finding),
    { code: "configuration-error", path: expectedPath, locations: [] },
    `${context} — the error document's one finding: the stable code ` +
      `"configuration-error" (SPEC 14 condition 14), locations [] (a ` +
      `configuration error is an unlocated condition, SPEC 14), and the ` +
      `concerned path in the anchoring form of 11.6, identified relative ` +
      `to the invocation working directory (SPEC 14, 12.7)`,
  );
}

/**
 * Arm: configuration-error concerned paths — the found and the
 * `--config`-named configuration file, each in the canonical anchoring
 * spelling (SPEC 14, 11.6), on `build --json` and on the bare JSON-only
 * `inventory` surface.
 */
async function runErrorConfigPathsArm(product: ProductBinding): Promise<void> {
  await withWorkspace(
    {
      files: {
        "xspec.config.ts": ERR_UNKNOWN_KEY_CONFIG,
        "cfg/broken.config.ts": ERR_UNKNOWN_KEY_CONFIG,
        "specs/A.mdx": ERR_SOURCE,
      },
      dirs: ["nested/inner"],
    },
    async (workspace) => {
      // The upward-search-found file from the workspace root: zero ascent
      // segments, one descending segment, no `.` segment and no trailing
      // separator (SPEC 11.6's canonical spelling).
      await expectAnchoredConfigurationError(
        product,
        workspace.root,
        ["build", "--json"],
        "xspec.config.ts",
        "T12.7-3 `build --json` from the workspace root (invalid " +
          "configuration found in place)",
      );
      // From a nested working directory two levels down, the search finds
      // the same file — identified relative to the INVOCATION working
      // directory: ascent spelled `..`, joined with `/` (SPEC 14, 11.6) —
      // failing a product that reports the path workspace-relative.
      await expectAnchoredConfigurationError(
        product,
        workspace.path("nested/inner"),
        ["build", "--json"],
        "../../xspec.config.ts",
        "T12.7-3 `build --json` from nested/inner (invalid configuration " +
          "found by upward search)",
      );
      // The `--config`-named file (SPEC 14: "the path --config names — it
      // is that file"), the argument deliberately spelled with a leading
      // `./` segment: the canonical anchoring spelling carries no `.`
      // segments (SPEC 11.6), so the concerned path is
      // "cfg/broken.config.ts" — failing a product that echoes the
      // argument verbatim.
      await expectAnchoredConfigurationError(
        product,
        workspace.root,
        ["build", "--json", "--config", "./cfg/broken.config.ts"],
        "cfg/broken.config.ts",
        "T12.7-3 `build --json --config ./cfg/broken.config.ts` (invalid " +
          "named configuration)",
      );
      // A missing `--config`-named file is missing configuration WITH
      // --config given: the concerned path is still the named file, never
      // "." (SPEC 14 reserves "." for a failed upward search with no
      // --config).
      await expectAnchoredConfigurationError(
        product,
        workspace.root,
        ["build", "--json", "--config", "missing.config.ts"],
        "missing.config.ts",
        "T12.7-3 `build --json --config missing.config.ts` (missing named " +
          "configuration)",
      );
      // A JSON-only surface without `--json`: bare `inventory` under the
      // invalid configuration — JSON output is in effect (SPEC 12.0, 11),
      // and configuration errors keep their precedence on the inventory
      // (SPEC 11.6), so the error arrives as the error document.
      await expectAnchoredConfigurationError(
        product,
        workspace.root,
        ["inventory"],
        "xspec.config.ts",
        "T12.7-3 bare `inventory` (JSON-only surface, no --json) under the " +
          "invalid configuration",
      );
    },
  );
}

/**
 * Arm: a failed upward search with no `--config` concerns the directory it
 * started from — the invocation working directory, spelled `.` (SPEC 14,
 * 11.6) — whatever that directory's position in the tree.
 */
async function runErrorSearchFailureArm(
  product: ProductBinding,
): Promise<void> {
  // The workspace is a fresh unique temporary directory whose filesystem
  // ancestors (the OS temp directory and its parents) hold no
  // xspec.config.ts — the T7-1 premise — so the upward search exhausts
  // without a hit.
  await withWorkspace(
    { files: { "specs/A.mdx": ERR_SOURCE }, dirs: ["nested/inner"] },
    async (workspace) => {
      await expectAnchoredConfigurationError(
        product,
        workspace.root,
        ["build", "--json"],
        ".",
        "T12.7-3 `build --json` with no xspec.config.ts reachable by " +
          "upward search and no --config",
      );
      // From a nested working directory the failed search still concerns
      // the working directory itself, spelled "." (SPEC 11.6 spells the
      // working directory "."), never that directory's path from anywhere
      // else.
      await expectAnchoredConfigurationError(
        product,
        workspace.path("nested/inner"),
        ["build", "--json"],
        ".",
        "T12.7-3 `build --json` from nested/inner with no xspec.config.ts " +
          "reachable by upward search and no --config",
      );
    },
  );
}

/**
 * Arm: one finding however many defects — a configuration file with
 * several distinct defects yields a single condition-14 finding (SPEC
 * 12.7: "One invocation reports one error"). The cardinality rides the
 * decode: one JSON document as the entire stdout, `{"error": …}` with the
 * one member holding one finding form.
 */
async function runErrorSingleFindingArm(
  product: ProductBinding,
): Promise<void> {
  await withWorkspace(
    {
      files: {
        "xspec.config.ts": ERR_MULTI_DEFECT_CONFIG,
        "specs/A.mdx": ERR_SOURCE,
      },
    },
    async (workspace) => {
      await expectAnchoredConfigurationError(
        product,
        workspace.root,
        ["build", "--json"],
        "xspec.config.ts",
        "T12.7-3 `build --json` over a configuration file with three " +
          "distinct defects (one condition-14 finding, however many " +
          "defects are present)",
      );
    },
  );
}

/**
 * Arm: plain usage errors carry `code` null and `path` null, and JSON is
 * in effect for a JSON-only surface without `--json` (`inventory` with an
 * unknown flag) and whenever `--json` appears among the arguments, the
 * arguments themselves erroneous included (an unknown command beside
 * `--json`) — each the error document on stdout, diagnostics on stderr
 * (SPEC 12.0, 12.7; T12.0-2).
 */
async function runErrorUsageArm(product: ProductBinding): Promise<void> {
  await withWorkspace(
    {
      files: {
        "xspec.config.ts": SPECS_ONLY_CONFIG,
        "specs/A.mdx": ERR_SOURCE,
      },
    },
    async (workspace) => {
      const cases: readonly { argv: readonly string[]; label: string }[] = [
        {
          argv: ["inventory", "--definitely-not-a-flag"],
          label:
            "T12.7-3 `inventory --definitely-not-a-flag` (JSON-only " +
            "surface, unknown flag, no --json)",
        },
        {
          argv: ["definitely-not-a-command", "--json"],
          label:
            "T12.7-3 `definitely-not-a-command --json` (unknown command " +
            "beside --json)",
        },
      ];
      for (const { argv, label } of cases) {
        const result = await runCli(product, workspace, argv);
        assertExitCode(
          result,
          2,
          `${label} — an unknown command or flag is a usage error, and the ` +
            `error is determined by the invocation's syntax alone ` +
            `(SPEC 12.0)`,
        );
        assertStderrDiagnostic(result, label);
        const finding = expectErrorDocument(result, label);
        if (finding.code !== null || finding.path !== null) {
          fail(
            `${label}: a plain usage error's finding carries code null and ` +
              `path null — it describes the invocation the consuming tool ` +
              `composed, no SPEC 14 condition code and no concerned ` +
              `workspace path (SPEC 12.7, 14; T14-6); got code ` +
              `${JSON.stringify(finding.code)}, path ` +
              `${JSON.stringify(finding.path)} (message: ` +
              `${JSON.stringify(finding.message)})`,
          );
        }
      }
    },
  );
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
    "foreign module (14.11); on the shape-unpinned surfaces — `query node`, " +
    "the `query nodes`/`subtree`/`ancestors` rows (11.1), `show --json` " +
    "(12.4), and a review payload's present scope node (a requirement " +
    "node's and a `code-impact` location's), context, and origin nodes " +
    "(10.7) — every range decodes through the H-3 adapters as exactly " +
    '{"start", "end"}, never re-mapped, and byte-exact against the staged ' +
    "constructs (1.7, 4.6) (SPEC 12.7, 12.0, 14, 11.2-11.6, 11.1, 12.4, " +
    "10.7, 1.7)",
  run: async (product) => {
    await runLocatedFindingsArm(product);
    await runPolicyFindingArm(product);
    await runCrossModuleArm(product);
    await runReviewRefusalArm(product);
    await runUnpinnedRangesArm(product);
    if (NON_UTF8_STAGED) {
      await runBytePathsArm(product);
    }
  },
});

// ---------------------------------------------------------------------------
// T12.7-2 — findings arrays and document forms
// ---------------------------------------------------------------------------

const T12_7_2 = defineProductTest({
  id: "T12.7-2",
  title:
    "findings arrays and document forms: a workspace staging several " +
    "conditions reports one findings array ordered by code — numbered " +
    "conditions in NUMERIC order (missing-id first though alphabetically " +
    "last, invalid-import(15) after cycle(9) though before it as decimal " +
    "strings) — then by locations element-wise (range-start order between " +
    "one file's findings, file-byte order across files), then by concerned " +
    "path in one byte order over marked byte-form and plain paths alike " +
    "(Linux leg), with identically-staged duplicate findings collapsed to " +
    "one (a defect file discovered through two spec groups reports once); " +
    "the T14-7 multi-reason refusal (a section move staged to both collide " +
    "and create a dependency cycle) reports its reasons in 14's LISTED " +
    "order — refused-id-collision before refused-cycle, the inverse of " +
    "their alphabetical order; two policy findings equal up to the rule " +
    "name sort by identities element-wise, not configuration order; " +
    "document forms are asserted literally (H-3): build/check/gated-read/" +
    'refused-operation reports are {"findings": […]} (a finding-free ' +
    "findings is [], never null — on a clean, freshly built workspace a " +
    "successful build --json and check --json each emit exactly " +
    '{"findings": []} as the entire stdout, the one member and nothing ' +
    'beside it), occurrences is {"findings", ' +
    '"occurrences"}, view is {"findings", "views"} with the eight-member ' +
    "node form plus ownText/subtreeText exactly when --text is given, " +
    'attribute entries {"name", "range", "text"}, imports {"range", ' +
    '"name", "target"}, a root\'s attributes [] and its opening/closing ' +
    'the stated null, at is {"findings", "resolution"} with occurrence ' +
    'null when the offset lies in none, version is {"product", ' +
    '"interface"}, and an unset outDir is null, never omitted (the ' +
    "refused preview's four-member form is T6.6-3's, the full inventory/" +
    "preview forms T11.6-*'s and T6.6-4/5's, a root's tags/coverage null " +
    "T11.4-3's, an absent targetTags T11.6-2's) (SPEC 12.7, 14, 13.3, " +
    "11.3-11.5, 12.6, 7.3, 12.1, 12.2)",
  run: async (product) => {
    await runConditionOrderingArm(product);
    await runRefusalOrderingArm(product);
    await runIdentitiesOrderingArm(product);
    await runDocumentFormsArm(product);
  },
});

// ---------------------------------------------------------------------------
// T12.7-3 — error document
// ---------------------------------------------------------------------------

const T12_7_3 = defineProductTest({
  id: "T12.7-3",
  title:
    "error document: an exit-2 invocation with JSON output in effect emits " +
    '{"error": …} holding one finding form as the entire stdout — a ' +
    'configuration error carries the stable code "configuration-error", ' +
    "locations [], and its concerned path in the anchoring form of 11.6 " +
    "relative to the invocation working directory (the found " +
    "xspec.config.ts from the root; ../../xspec.config.ts from a nested " +
    "cwd; a --config-named file in the canonical spelling — a ./-spelled " +
    'argument reports without the "." segment — present or missing alike; ' +
    '"." for a failed upward search with no --config); a plain usage error ' +
    "carries code and path null; one finding however many defects (a " +
    "configuration file with three distinct defects yields a single " +
    "condition-14 finding); JSON is in effect for a JSON-only surface " +
    "without --json (inventory with an unknown flag; bare inventory under " +
    "an invalid configuration) and whenever --json appears among the " +
    "arguments, the arguments themselves erroneous included (an unknown " +
    "command beside --json) — each the error document on stdout with " +
    "diagnostics on stderr (SPEC 12.0, 12.7, 14, 11.6)",
  run: async (product) => {
    await runErrorConfigPathsArm(product);
    await runErrorSearchFailureArm(product);
    await runErrorSingleFindingArm(product);
    await runErrorUsageArm(product);
  },
});

/** TEST-SPEC §12.7, in canonical ID order (SUITE-58). */
export const section127Tests: readonly ProductTestEntry[] = [
  T12_7_1,
  T12_7_2,
  T12_7_3,
];
