// TEST-SPEC §14 III — SUITE-49 (continued): T14-12, the well-formedness
// contract. SPEC 14.20 decides well-formedness by derivability alone under
// the input languages' grammars — every rule beyond derivability excluded,
// whether the language's own text calls its violation a syntax error or its
// tools report it after parsing. This module holds T14-12's positive arms
// (FIX_PLAN Task 44): each file well-formed, proceeding to its ordinary
// outcome, never 14.20. The negative arms — 14.20 at the offset the rule of
// 14 fixes, masking, and the three surfaces — and T14-4's stagings over them
// are Task 45's (this module, continued). T14-11's per-condition ranges live
// in section-14.ts, the environment refusals in section-14-ii.ts; a third
// module keeps both files' edits bounded (the section-6.5-i/-ii/-iii
// precedent).
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace per arm (H-1), drives the product strictly as a subprocess
// (H-2), asserts exact exit codes (H-5), decodes output through the H-3
// adapters, and rejects a product only via diagnosed assertion failures
// (H-8).
//
// Arms (TEST-SPEC T14-12, positive half):
//
// In a spec source, ECMAScript's early errors — each a finding in a
// well-formed file (SPEC 14.20: static-semantic early errors take no part in
// derivability), staged under S-9's named allowance for exactly the early
// error the form relies on (helpers/mdx-derivability.ts):
//   (a) two imports binding one identifier within one ESM block — 14.15, the
//       colliding pair, never 14.20 (T2.1-3's one-block arm; its tolerance —
//       one finding for the collision, or one per import — is kept here);
//       allowance `duplicate-import-binding`;
//   (b) `export { nope }`, `nope` a binding no declaration introduces, on the
//       line after a valid, used import in one ESM block: exactly one
//       condition-16 finding located at the export statement whole (SPEC 14:
//       "an export statement whole"), exit 1, no 14.20 and no 14.15 (the
//       statement holds no declaration, which 2.1's collision clause needs);
//       the import beside it proceeds normally — listed under `view`'s
//       `imports` with its resolved target, the statement getting no view
//       entry (11.4: the invalid constructs of 14.16 get no view entry), and
//       the `{text(BASE.a)}` embedding rooted at the import recorded by
//       `occurrences --file` (5.7, 11.3), the finding accompanying each
//       answer, exit 1 (11.2); allowance `undefined-export`;
//   (c) `{1 = 2}` — an assignment to a non-simple target — 14.16, brace
//       through brace; allowance `invalid-assignment-target`;
//   (d) `{let}` — a strict-mode restriction — 14.16; allowance
//       `let-as-identifier`;
//   (e) `{010}` — a legacy octal literal — 14.16; allowance `legacy-octal`.
// And the expression grammar (well-formed plainly — the default declaration):
//   (f) `{a, b}` — a comma sequence is one expression — 14.16;
//   (g) `d={BASE.a, BASE.b}` — one expression, 14.8 located whole (T14-11's
//       arm (q) pins the same range; here the twin proves the file is no
//       parse failure beside it);
//   (h) `{await x}` — `await` admitted — 14.16;
//   (i) `{function(){}}` — no statement lookahead restriction — 14.16;
//   (j) a spread attribute `{...(a, b)}` — 14.17 at the whole braced
//       construct (T2.7-3's grammar pair, deriving side);
//   (k) `export const x = <b/>` — JSX in an ESM block's declaration — 14.16,
//       the statement whole.
// In a code-group file, TypeScript's post-parse checks — each leaving the
// file well-formed (SPEC 14.20: well-formed TypeScript is the parser's
// acceptance, the post-parse grammar checks, name binding, and type checking
// excluded): `build` and `check` exit 0 on the otherwise valid workspace, a
// marker inside one of the file's units attributed to it (4.5, 4.6) and its
// `references` edge recorded:
//   (l) a rest parameter that is not last, `function f(...r: number[], x:
//       number) {}` — the marker inside `f`;
//   (m) a misplaced modifier, `abstract m(): void` in a non-abstract class —
//       the marker inside the class's method `run` (an abstract member is no
//       unit, 4.6, so `C.run` is the attributed unit);
//   (n) a duplicate declaration, `let a; let a;` — the marker inside a
//       sibling function `f`;
//   (o) a type error, `const n: number = "x"` — the marker inside `f`.
//
// Conservative operationalizations (H-3):
// - Every spec-source container arm stands in flow position at the top
//   level, after a valid section (T14-11's preamble), so the container's
//   14.16 is the file's one finding; `a`, `b`, and `x` inside the containers
//   of (f), (h) are free identifiers — an invalid container is no reference
//   spelling, so nothing resolves or fails to (SPEC 2.7, 14.16), and the
//   pinned expectation is exactly one finding.
// - (b)'s three surfaces compare the findings by condition and locations
//   (the message is free text) and the `imports`, `comments`, and
//   `occurrences` members whole, projected into explicit key order.
// - The code arms assert the workspace-wide `references` edge set is exactly
//   the one marker's edge (T4.5-1's pattern), so the offending construct
//   neither hides the unit nor adds one.
// - The staged texts are exported as `T14_12_FORM_VECTORS` with their
//   allowances for the S-9 self-test, which judges every staging without
//   the product — the S-7 sweep reaches only a body's first staging.

import { Buffer } from "node:buffer";
import type {
  Finding,
  GraphEdge,
  OccurrenceRecord,
  ViewImportEntry,
} from "../../helpers/adapters/index.js";
import {
  decodeEdgesReport,
  decodeOccurrencesReport,
  decodeViewReport,
} from "../../helpers/adapters/index.js";
import { fail, parseJsonStdout } from "../../helpers/assertions.js";
import type { MdxAllowance } from "../../helpers/mdx-derivability.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import type { WorkspaceDecl } from "../../helpers/workspace.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import {
  assertConditionCounts,
  assertEdgeSetEqual,
  assertSameJson,
  buildFindings,
  buildOk,
  expectExit,
  expectFindingFreeReport,
  runJson,
} from "./support.js";

// ---------------------------------------------------------------------------
// Shared staging
// ---------------------------------------------------------------------------

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

/** A byte range in SPEC 1.7's form: zero-based, start-inclusive, end-exclusive. */
interface ByteRange {
  readonly start: number;
  readonly end: number;
}

interface PinnedPart {
  readonly pin: string;
}

/** Mark a fixture part as pinned (T14-11's fixture notation). */
function pin(text: string): PinnedPart {
  return { pin: text };
}

/** A fixture text with the byte range of each pinned part, in part order. */
interface AssembledFixture {
  readonly text: string;
  readonly ranges: readonly ByteRange[];
}

/**
 * Concatenate the parts; each pinned part's range is [bytes before it, bytes
 * through it) over the assembled UTF-8 text (SPEC 1.7).
 */
function assemble(parts: readonly (string | PinnedPart)[]): AssembledFixture {
  let text = "";
  const ranges: ByteRange[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      text += part;
      continue;
    }
    const start = Buffer.byteLength(text, "utf8");
    text += part.pin;
    ranges.push({ start, end: Buffer.byteLength(text, "utf8") });
  }
  return { text, ranges };
}

/** The pinned range of `fixture` at `index` — a harness bug when absent. */
function pinned(fixture: AssembledFixture, index: number): ByteRange {
  const range = fixture.ranges[index];
  if (range === undefined) {
    throw new Error(
      `T14-12 fixture pins no part #${String(index)} (harness bug in section-14-iii.ts)`,
    );
  }
  return range;
}

/** One pinned location: a file and its exact `{start, end}` (SPEC 12.7). */
interface ExactLocation {
  readonly file: string;
  readonly range: ByteRange;
}

/** A finding whose condition and complete location list are pinned. */
interface ExactFindingExpectation {
  readonly condition: string;
  readonly locations: readonly ExactLocation[];
}

/** A finding projected to what the arms pin: condition and exact locations. */
function projectFinding(finding: Finding): ExactFindingExpectation {
  return {
    condition: finding.condition ?? finding.code ?? "(code-less)",
    locations: finding.locations.map((location) => ({
      file:
        typeof location.file === "string"
          ? location.file
          : `<bytes ${location.file.bytes}>`,
      range: { start: location.range.start, end: location.range.end },
    })),
  };
}

const byJson = (a: unknown, b: unknown): number => {
  const left = JSON.stringify(a);
  const right = JSON.stringify(b);
  return left < right ? -1 : left > right ? 1 : 0;
};

/**
 * Assert the findings are exactly the pinned ones — one finding per pinned
 * expectation, each condition's location lists byte-exact and complete —
 * and never 14.20 (the arm's whole point: a finding in a well-formed file).
 */
function assertExactFindings(
  findings: readonly Finding[],
  expected: readonly ExactFindingExpectation[],
  context: string,
): void {
  const parseFailure = findings.find(
    (finding) => finding.condition === "14.20",
  );
  if (parseFailure !== undefined) {
    fail(
      `${context}: the file is well-formed — derivability alone decides ` +
        `well-formedness, and the staged form fails only a rule beyond it ` +
        `(SPEC 14.20) — so no 14.20 is reported; got an unparseable-source ` +
        `finding at ${JSON.stringify(projectFinding(parseFailure).locations)} ` +
        `(message: ${JSON.stringify(parseFailure.message)})`,
    );
  }
  const counts: Record<string, number> = {};
  for (const expectation of expected) {
    counts[expectation.condition] = (counts[expectation.condition] ?? 0) + 1;
  }
  assertConditionCounts(
    findings,
    counts,
    `${context} — exactly the stated findings, one per offending construct ` +
      `and none beside, the file proceeding to its ordinary outcome (SPEC ` +
      `14, 14.20)`,
  );
  for (const finding of findings) {
    if (finding.path !== null) {
      fail(
        `${context}: a finding locating in source concerns no path — \`path\` ` +
          `is null for located conditions (SPEC 12.7, 14); got ` +
          `${JSON.stringify(finding.path)} on the condition-` +
          `${String(finding.condition)} finding (message: ` +
          `${JSON.stringify(finding.message)})`,
      );
    }
  }
  assertSameJson(
    findings.map(projectFinding).sort(byJson),
    [...expected].sort(byJson),
    `${context}: each finding locates exactly the pinned byte range(s) — ` +
      `the range SPEC 14 fixes for its condition, \`{"start", "end"}\` as ` +
      `zero-based byte offsets, end-exclusive (SPEC 14, 1.7, 12.7)`,
  );
}

// ---------------------------------------------------------------------------
// Spec-source arms: one form per workspace, `build --json` findings pinned
// ---------------------------------------------------------------------------

/** A valid section every spec fixture opens with (a multibyte prefix, `é`). */
const PREAMBLE = '<S id="ok">\nTarget: café.\n</S>\n\n';

/** The spec source the `BASE`-rooted arms import: `a` and `b` resolve. */
const BASE_FILE = "specs/BASE.mdx";
const BASE_MDX = '<S id="a">\nA.\n</S>\n\n<S id="b">\nB.\n</S>\n';
const BASE_IMPORT = 'import BASE from "./BASE.xspec"';

/** The file every spec-source arm stages its form in. */
const ARM_FILE = "specs/A.mdx";

/** One positive spec-source arm: a form, its allowance, its pinned findings. */
interface SpecFormArm {
  /** The arm's letter (diagnostics). */
  readonly arm: string;
  /** The form under test and the rule it relies on (diagnostics). */
  readonly name: string;
  readonly fixture: AssembledFixture;
  /** Further staged sources (the `BASE` module), beside the arm's file. */
  readonly extraFiles?: Readonly<Record<string, string>>;
  /** S-9: the early error the form relies on; absent, it derives plainly. */
  readonly allowances?: readonly MdxAllowance[];
  /** The condition each pinned part reports, in pin order. */
  readonly conditions: readonly string[];
}

/** A flow-position container at the top level, after the valid section. */
function containerArm(
  arm: string,
  name: string,
  container: string,
  allowances?: readonly MdxAllowance[],
): SpecFormArm {
  return {
    arm,
    name,
    fixture: assemble([PREAMBLE, pin(container), "\n"]),
    ...(allowances === undefined ? {} : { allowances }),
    conditions: ["14.16"],
  };
}

const SPEC_FORM_ARMS: readonly SpecFormArm[] = [
  containerArm(
    "c",
    "`{1 = 2}` — an assignment to a target that is not simple, an early error (14.16, never 14.20)",
    "{1 = 2}",
    ["invalid-assignment-target"],
  ),
  containerArm(
    "d",
    "`{let}` — `let` as an identifier reference, a strict-mode restriction (14.16, never 14.20)",
    "{let}",
    ["let-as-identifier"],
  ),
  containerArm(
    "e",
    "`{010}` — a legacy octal literal, a strict-mode restriction (14.16, never 14.20)",
    "{010}",
    ["legacy-octal"],
  ),
  containerArm(
    "f",
    "`{a, b}` — a comma sequence is one expression (14.16, never 14.20)",
    "{a, b}",
  ),
  {
    arm: "g",
    name: "`d={BASE.a, BASE.b}` — a comma sequence is one expression, 14.8 located whole (never 14.20)",
    fixture: assemble([
      BASE_IMPORT,
      "\n\n",
      PREAMBLE,
      '<S id="q" d={',
      pin("BASE.a, BASE.b"),
      "}>\nA comma sequence.\n</S>\n",
    ]),
    extraFiles: { [BASE_FILE]: BASE_MDX },
    conditions: ["14.8"],
  },
  containerArm(
    "h",
    "`{await x}` — `await` is admitted by the expression grammar (14.16, never 14.20)",
    "{await x}",
  ),
  containerArm(
    "i",
    "`{function(){}}` — no statement's lookahead restriction applies (14.16, never 14.20)",
    "{function(){}}",
  ),
  {
    arm: "j",
    name: "a spread attribute `{...(a, b)}` — `...` followed by exactly one assignment expression (14.17 at the whole braced construct, never 14.20)",
    fixture: assemble([
      PREAMBLE,
      '<S id="s" ',
      pin("{...(a, b)}"),
      ">\nA spread attribute.\n</S>\n",
    ]),
    conditions: ["14.17"],
  },
  {
    arm: "k",
    name: "`export const x = <b/>` — JSX inside an ESM block's declaration is an export statement (14.16 at the statement whole, never 14.20)",
    fixture: assemble([PREAMBLE, pin("export const x = <b/>"), "\n"]),
    conditions: ["14.16"],
  },
];

/** One spec-form arm: `build --json` exits 1 with exactly the pinned findings. */
async function runSpecFormArm(
  product: ProductBinding,
  arm: SpecFormArm,
): Promise<void> {
  const context = `T14-12 (${arm.arm}) ${arm.name}`;
  const expected = arm.conditions.map((condition, index) => ({
    condition,
    locations: [{ file: ARM_FILE, range: pinned(arm.fixture, index) }],
  }));
  await withWorkspace(
    {
      files: {
        "xspec.config.ts": SPECS_ONLY_CONFIG,
        ...(arm.extraFiles ?? {}),
        [ARM_FILE]: arm.fixture.text,
      },
      ...(arm.allowances === undefined
        ? {}
        : { mdx: { allowances: { [ARM_FILE]: arm.allowances } } }),
    },
    async (workspace) => {
      const findings = await buildFindings(
        product,
        workspace,
        `${context} — \`build --json\` exits 1 with the findings report: the ` +
          `file is well-formed and proceeds to its ordinary outcome, a ` +
          `finding (SPEC 14.20, 12.0, 12.7)`,
      );
      assertExactFindings(findings, expected, context);
    },
  );
}

// (a) Two imports binding one identifier within one ESM block (consecutive
// lines, no blank line between): a duplicate lexically declared name is an
// early error, excluded from derivability, so the file is well-formed and
// the collision is 14.15 — T2.1-3's one-block arm, the one a product handing
// the block to a parser enforcing early errors fails. T2.1-3's tolerance is
// kept: one finding for the collision, or one per import, every one 14.15
// and located within one of the two declarations.
const DUP_BINDING_FIRST = 'import BASE from "./B1.xspec"';
const DUP_BINDING_SECOND = 'import BASE from "./B2.xspec"';
const DUP_BINDING_FIXTURE = assemble([
  pin(DUP_BINDING_FIRST),
  "\n",
  pin(DUP_BINDING_SECOND),
  "\n\n",
  '<S id="x">\nBody.\n</S>\n',
]);
const DUP_BINDING_FILES: Readonly<Record<string, string>> = {
  "specs/B1.mdx": '<S id="b1">\nFirst module.\n</S>\n',
  "specs/B2.mdx": '<S id="b2">\nSecond module.\n</S>\n',
};

async function runDuplicateBindingArm(product: ProductBinding): Promise<void> {
  const context =
    "T14-12 (a) two imports binding one identifier within one ESM block — " +
    "a duplicate lexically declared name is an early error, 14.15 in a " +
    "well-formed file, never 14.20";
  await withWorkspace(
    {
      files: {
        "xspec.config.ts": SPECS_ONLY_CONFIG,
        ...DUP_BINDING_FILES,
        [ARM_FILE]: DUP_BINDING_FIXTURE.text,
      },
      mdx: { allowances: { [ARM_FILE]: ["duplicate-import-binding"] } },
    },
    async (workspace) => {
      const findings = await buildFindings(
        product,
        workspace,
        `${context} — \`build --json\` exits 1 with the findings report ` +
          `(SPEC 12.0, 12.7)`,
      );
      const conditions = findings.map((finding) => finding.condition);
      if (
        findings.length < 1 ||
        findings.length > 2 ||
        conditions.some((condition) => condition !== "14.15")
      ) {
        fail(
          `${context}: expected the colliding pair to report condition 14.15 ` +
            `— one finding for the collision, or one per import — and ` +
            `never 14.20 (SPEC 2.1, 14.20; T2.1-3); got ` +
            `${JSON.stringify(findings.map(projectFinding))}`,
        );
      }
      const windows = [
        pinned(DUP_BINDING_FIXTURE, 0),
        pinned(DUP_BINDING_FIXTURE, 1),
      ];
      for (const finding of findings) {
        if (finding.locations.length === 0) {
          fail(
            `${context}: the 14.15 finding must locate the colliding ` +
              `declaration(s) (SPEC 14); got no location (message: ` +
              `${JSON.stringify(finding.message)})`,
          );
        }
        for (const location of finding.locations) {
          const inside = windows.some(
            (window) =>
              location.range.start >= window.start &&
              location.range.end <= window.end,
          );
          if (location.file !== ARM_FILE || !inside) {
            fail(
              `${context}: every 14.15 location lies within one of the two ` +
                `import declarations of ${ARM_FILE} (SPEC 14: an ` +
                `import-binding collision locates every colliding ` +
                `declaration by its own characters); got ` +
                `${JSON.stringify(projectFinding(finding).locations)}`,
            );
          }
        }
      }
    },
  );
}

// ---------------------------------------------------------------------------
// (b) `export { nope }` — an export naming no declaration, on the line after
// a valid, used import in one ESM block
// ---------------------------------------------------------------------------

// The file: the import, the export statement on the next line (one ESM
// block), a blank line, and a section embedding `BASE.a` — the import used.
// Pinned: the import declaration (the `view` import range, 11.4), the export
// statement whole (the 14.16 range, SPEC 14), the embedding's full braced
// container (the occurrence span, 5.7); the section's construct range (the
// occurrence's source node range, 5.7, 1.7) is computed beside them.
const NOPE_EXPORT = "export { nope }";
const NOPE_SECTION_OPEN = '<S id="x">\n';
const NOPE_EMBEDDING = "{text(BASE.a)}";
const NOPE_SECTION_CLOSE = "\n</S>";
const NOPE_FIXTURE = assemble([
  pin(BASE_IMPORT),
  "\n",
  pin(NOPE_EXPORT),
  "\n\n",
  NOPE_SECTION_OPEN,
  pin(NOPE_EMBEDDING),
  NOPE_SECTION_CLOSE,
  "\n",
]);
const NOPE_SECTION_RANGE: ByteRange = (() => {
  const start = pinned(NOPE_FIXTURE, 1).end + Buffer.byteLength("\n\n", "utf8");
  return {
    start,
    end:
      start +
      Buffer.byteLength(
        NOPE_SECTION_OPEN + NOPE_EMBEDDING + NOPE_SECTION_CLOSE,
        "utf8",
      ),
  };
})();

/** The one finding: 14.16 at the export statement whole (SPEC 14). */
const NOPE_EXPECTED_FINDINGS: readonly ExactFindingExpectation[] = [
  {
    condition: "14.16",
    locations: [{ file: ARM_FILE, range: pinned(NOPE_FIXTURE, 1) }],
  },
];

/** An occurrence record projected into explicit key order (SPEC 5.7, 12.7). */
interface ProjectedRecord {
  readonly file: string;
  readonly range: ByteRange;
  readonly kind: string;
  readonly source:
    | { readonly identity: string; readonly range: ByteRange }
    | { readonly unavailable: true };
  readonly target: string;
}

function projectPath(value: string | { readonly bytes: string }): string {
  return typeof value === "string" ? value : `<bytes ${value.bytes}>`;
}

function projectRecord(record: OccurrenceRecord): ProjectedRecord {
  return {
    file: projectPath(record.file),
    range: { start: record.range.start, end: record.range.end },
    kind: record.kind,
    source:
      "unavailable" in record.source
        ? { unavailable: true }
        : {
            identity: record.source.identity,
            range: {
              start: record.source.range.start,
              end: record.source.range.end,
            },
          },
    target: record.target,
  };
}

/** An import entry projected into explicit key order (SPEC 11.4, 12.7). */
interface ProjectedImport {
  readonly range: ByteRange;
  readonly name: string | null;
  readonly target: string | { readonly unavailable: true };
}

function projectImport(entry: ViewImportEntry): ProjectedImport {
  return {
    range: { start: entry.range.start, end: entry.range.end },
    name: entry.name,
    target:
      typeof entry.target === "object" && "unavailable" in entry.target
        ? { unavailable: true }
        : projectPath(entry.target),
  };
}

/** The embedding rooted at the import: one `embeds` occurrence from `x` to `BASE#a`. */
const NOPE_EXPECTED_RECORD: ProjectedRecord = {
  file: ARM_FILE,
  range: pinned(NOPE_FIXTURE, 2),
  kind: "embeds",
  source: { identity: `${ARM_FILE}#x`, range: NOPE_SECTION_RANGE },
  target: `${BASE_FILE}#a`,
};

/** The import beside the statement, listed with its resolved target. */
const NOPE_EXPECTED_IMPORT: ProjectedImport = {
  range: pinned(NOPE_FIXTURE, 0),
  name: "BASE",
  target: BASE_FILE,
};

/** The findings of an answer, projected and sorted, equal the pinned set. */
function assertAnswerFindings(
  findings: readonly Finding[],
  context: string,
): void {
  assertSameJson(
    findings.map(projectFinding).sort(byJson),
    [...NOPE_EXPECTED_FINDINGS].sort(byJson),
    `${context}: the domain file's one finding — 14.16 at the export ` +
      `statement whole — accompanies the answer, never 14.20, never 14.15 ` +
      `(SPEC 11.2, 14, 14.20)`,
  );
}

async function runExportNopeArm(product: ProductBinding): Promise<void> {
  const context =
    "T14-12 (b) `export { nope }` after a valid, used import in one ESM " +
    "block — an export naming no declaration is an early error, 14.16 in a " +
    "well-formed file, never 14.20 and never 14.15";
  await withWorkspace(
    {
      files: {
        "xspec.config.ts": SPECS_ONLY_CONFIG,
        [BASE_FILE]: BASE_MDX,
        [ARM_FILE]: NOPE_FIXTURE.text,
      },
      mdx: { allowances: { [ARM_FILE]: ["undefined-export"] } },
    },
    async (workspace) => {
      // `build --json`: exactly one condition-16 finding located at the
      // export statement whole (SPEC 14: "an export statement whole"), exit
      // 1; no 14.20 (the file is well-formed) and no 14.15 (the statement
      // holds no declaration, which 2.1's collision clause needs).
      assertExactFindings(
        await buildFindings(
          product,
          workspace,
          `${context} — \`build --json\` exits 1 with the findings report ` +
            `(SPEC 12.0, 12.7)`,
        ),
        NOPE_EXPECTED_FINDINGS,
        `${context} — \`build --json\``,
      );

      // `view`: the import proceeds normally — listed under `imports` with
      // its binding and resolved target; the statement gets no view entry
      // (11.4: the invalid constructs of 14.16 get no view entry) — so
      // `imports` holds exactly the one declaration and `comments` nothing;
      // the embedding's occurrence is the file's one record; the finding
      // accompanies the answer, exit 1 (11.2).
      const viewContext = `${context} — \`view ${ARM_FILE}\``;
      const view = decodeViewReport(
        parseJsonStdout(
          await expectExit(
            product,
            workspace,
            ["view", ARM_FILE],
            1,
            `${viewContext}: an answer carrying a finding exits 1 with the ` +
              `full answer document still emitted (SPEC 11.2)`,
          ),
          viewContext,
        ),
        { text: false },
        viewContext,
      );
      assertAnswerFindings(view.findings, viewContext);
      assertSameJson(
        view.views.map((entry) => projectPath(entry.file)),
        [ARM_FILE],
        `${viewContext}: the requested, parseable file is viewed (SPEC 11.4)`,
      );
      const fileView = view.views[0]!;
      assertSameJson(
        fileView.imports.map(projectImport),
        [NOPE_EXPECTED_IMPORT],
        `${viewContext}: \`imports\` lists exactly the import declaration — ` +
          `its source range, its default binding \`BASE\`, and its resolved ` +
          `target ${BASE_FILE} — the export statement getting no entry ` +
          `(SPEC 11.4, 14.16)`,
      );
      assertSameJson(
        fileView.comments,
        [],
        `${viewContext}: no MDX comment is staged, and an export statement ` +
          `is no comment — \`comments\` is [] (SPEC 11.4, 12.7)`,
      );
      assertSameJson(
        fileView.occurrences.map(projectRecord),
        [NOPE_EXPECTED_RECORD],
        `${viewContext}: the \`{text(BASE.a)}\` embedding rooted at the ` +
          `import records its occurrence — the full braced container, kind ` +
          `embeds, source \`${ARM_FILE}#x\` with the section's construct ` +
          `range, target \`${BASE_FILE}#a\` (SPEC 11.4, 5.7)`,
      );

      // `occurrences --file`: the embedding is recorded, the finding
      // accompanying the answer, exit 1 (SPEC 11.3, 11.2).
      const occurrencesContext = `${context} — \`occurrences --file ${ARM_FILE}\``;
      const report = decodeOccurrencesReport(
        parseJsonStdout(
          await expectExit(
            product,
            workspace,
            ["occurrences", "--file", ARM_FILE],
            1,
            `${occurrencesContext}: an answer carrying a finding exits 1 ` +
              `with the full answer document still emitted (SPEC 11.2)`,
          ),
          occurrencesContext,
        ),
        occurrencesContext,
      );
      assertAnswerFindings(report.findings, occurrencesContext);
      assertSameJson(
        report.occurrences.map(projectRecord),
        [NOPE_EXPECTED_RECORD],
        `${occurrencesContext}: the embedding rooted at the import is the ` +
          `domain's one occurrence record — the full braced container, kind ` +
          `embeds, source \`${ARM_FILE}#x\`, target \`${BASE_FILE}#a\` ` +
          `(SPEC 11.3, 5.7)`,
      );
    },
  );
}

// ---------------------------------------------------------------------------
// Code-group arms: TypeScript's post-parse checks leave the file well-formed
// ---------------------------------------------------------------------------

/** The spec source the code arms import: `a` resolves. */
const A_MDX = '<S id="a">\nAlpha behavior.\n</S>\n';
const CODE_IMPORT = 'import A from "../specs/A.xspec"';
const CODE_FILE = "src/app.ts";

/** One code arm: `src/app.ts`'s lines and the unit the marker lies in. */
interface CodeFormArm {
  readonly arm: string;
  readonly name: string;
  /** The file's lines, each LF-terminated when laid out. */
  readonly lines: readonly string[];
  /** The named unit (SPEC 4.6) enclosing the marker `A.a`. */
  readonly unit: string;
}

const CODE_FORM_ARMS: readonly CodeFormArm[] = [
  {
    arm: "l",
    name: "a rest parameter that is not last, `function f(...r: number[], x: number) {}` — a post-parse grammar check (well-formed TypeScript)",
    lines: [
      CODE_IMPORT,
      "",
      "function f(...r: number[], x: number) {",
      "  A.a",
      "}",
    ],
    unit: "f",
  },
  {
    arm: "m",
    name: "a misplaced modifier, `abstract m(): void` in a non-abstract class — a post-parse grammar check (well-formed TypeScript)",
    lines: [
      CODE_IMPORT,
      "",
      "class C {",
      "  abstract m(): void",
      "  run(): void {",
      "    A.a",
      "  }",
      "}",
    ],
    unit: "C.run",
  },
  {
    arm: "n",
    name: "a duplicate declaration, `let a; let a;` — name binding (well-formed TypeScript)",
    lines: [
      CODE_IMPORT,
      "",
      "let a; let a;",
      "",
      "function f(): void {",
      "  A.a",
      "}",
    ],
    unit: "f",
  },
  {
    arm: "o",
    name: 'a type error, `const n: number = "x"` — type checking (well-formed TypeScript)',
    lines: [
      CODE_IMPORT,
      "",
      'const n: number = "x"',
      "",
      "function f(): void {",
      "  A.a",
      "}",
    ],
    unit: "f",
  },
];

/**
 * One code arm: the file is well-formed, so `build` and `check` exit 0 on
 * the otherwise valid workspace and the marker inside the unit records its
 * `references` edge, attributed to that unit (SPEC 14.20, 4.5, 4.6).
 */
async function runCodeFormArm(
  product: ProductBinding,
  arm: CodeFormArm,
): Promise<void> {
  const context = `T14-12 (${arm.arm}) ${arm.name}`;
  const source = arm.lines.map((line) => line + "\n").join("");
  await withWorkspace(
    {
      files: {
        "xspec.config.ts": SPEC_AND_CODE_CONFIG,
        "specs/A.mdx": A_MDX,
        [CODE_FILE]: source,
      },
    },
    async (workspace) => {
      await buildOk(
        product,
        workspace,
        `${context} — \`build\` exits 0: the file is well-formed, TypeScript's ` +
          `post-parse checks excluded from derivability, and the workspace ` +
          `is otherwise valid (SPEC 14.20, 12.1)`,
      );
      await expectFindingFreeReport(
        product,
        workspace,
        ["check", "--json"],
        `${context} — \`check --json\` on the freshly built workspace ` +
          `(SPEC 14.20, 12.2)`,
      );
      const label = `${context} — \`query edges --kinds references\``;
      const edges: readonly GraphEdge[] = decodeEdgesReport(
        await runJson(
          product,
          workspace,
          ["query", "edges", "--kinds", "references"],
          label,
        ),
        label,
      );
      assertEdgeSetEqual(
        edges,
        [
          {
            from: `${CODE_FILE}#${arm.unit}`,
            to: "specs/A.mdx#a",
            kind: "references",
          },
        ],
        `${context}: the marker inside the unit is attributed to it and its ` +
          `\`references\` edge recorded — the workspace's whole set (SPEC ` +
          `4.5, 4.6, 14.20)`,
      );
    },
  );
}

// ---------------------------------------------------------------------------
// T14-12
// ---------------------------------------------------------------------------

const T14_12 = defineProductTest({
  id: "T14-12",
  title:
    "well-formedness is decided by derivability alone (SPEC 14.20) — positive arms, each file well-formed and proceeding to its ordinary outcome, never 14.20: in a spec source, ECMAScript's early errors — two imports binding one identifier in one ESM block (14.15), `export { nope }` after a valid, used import (exactly one 14.16 at the statement whole, no 14.15; the import listed by `view` with its resolved target, the statement getting no view entry, the `{text(BASE.a)}` embedding recorded by `occurrences --file`, the finding accompanying each answer, exit 1), `{1 = 2}`, `{let}`, `{010}` (14.16 each) — and the expression grammar — `{a, b}` (14.16), `d={BASE.a, BASE.b}` (14.8 located whole), `{await x}`, `{function(){}}` (14.16 each), `{...(a, b)}` (14.17 at the whole braced construct), `export const x = <b/>` (14.16 at the statement whole); in a code-group file, TypeScript's post-parse checks — a rest parameter that is not last, a misplaced `abstract` modifier, a duplicate `let` declaration, a type error — each leaving the file well-formed: `build` and `check` exit 0, a marker inside one of the file's units attributed to it and its `references` edge recorded (SPEC 14.20, 14, 2.1, 2.7, 4.5, 4.6, 5.7, 11.2, 11.3, 11.4)",
  run: async (product) => {
    await runDuplicateBindingArm(product);
    await runExportNopeArm(product);
    for (const arm of SPEC_FORM_ARMS) {
      await runSpecFormArm(product, arm);
    }
    for (const arm of CODE_FORM_ARMS) {
      await runCodeFormArm(product, arm);
    }
  },
});

/**
 * Every MDX source T14-12's positive arms stage, with the S-9 allowances
 * the staging names (empty: derives plainly) — for the S-9 self-test, which
 * judges each without the product (the S-7 sweep reaches only a body's
 * first staging). `[name, source, allowances]`, uniquely named.
 */
export const T14_12_FORM_VECTORS: readonly (readonly [
  string,
  string,
  readonly MdxAllowance[],
])[] = [
  ["T14-12 the BASE module", BASE_MDX, []],
  [
    "T14-12 (a) two imports binding one identifier in one ESM block",
    DUP_BINDING_FIXTURE.text,
    ["duplicate-import-binding"],
  ],
  ...Object.entries(DUP_BINDING_FILES).map(
    ([file, source]): readonly [string, string, readonly MdxAllowance[]] => [
      `T14-12 (a) the imported module ${file}`,
      source,
      [],
    ],
  ),
  [
    "T14-12 (b) `export { nope }` after a valid, used import",
    NOPE_FIXTURE.text,
    ["undefined-export"],
  ],
  ...SPEC_FORM_ARMS.map(
    (arm): readonly [string, string, readonly MdxAllowance[]] => [
      `T14-12 (${arm.arm}) ${arm.name}`,
      arm.fixture.text,
      arm.allowances ?? [],
    ],
  ),
  ["T14-12 the code arms' spec source", A_MDX, []],
];

export const section14iiiTests: readonly ProductTestEntry[] = [T14_12];
