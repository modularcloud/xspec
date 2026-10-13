// TEST-SPEC §5.1–5.2 (node and edge kinds) and §5.3 (cycles) — SUITE-17:
// T5.2-1, T5.3-1, T5.3-2.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), decodes output through the H-3 adapters,
// and rejects a product only via diagnosed assertion failures (H-8).
//
// SPEC 5.2: the four edge kinds are `contains` (parent section → child
// section, the implicit root included, SPEC 1.2), `depends` (the `d` prop),
// `embeds` (`{text(...)}` in MDX and `text(...)` in TypeScript), and
// `references` (a bare TypeScript marker, 4.5); edges of each kind form a
// set — duplicate declarations collapse to a single edge. SPEC 5.3:
// dependency-edge cycles in the combined contains/depends/embeds graph over
// requirement nodes are invalid; `check` MUST detect and report them with the
// full cycle path; a self-`depends`/self-`embeds` is a cycle of length one;
// 14.9 is reported by `build` and `check` alike (SPEC 14).
//
// Conservative operationalizations (noted per H-4):
// - Cycle-path acceptance: SPEC 12.7/14 render a cycle's full path through
//   the finding's `locations` — every reference spelling recording a
//   participating dependency edge, each located in the file containing it at
//   the span its occurrence occupies (5.7: a `d` reference's own expression,
//   quotes included; an MDX embedding's entire `{text(...)}` container,
//   brace through brace) — while the identity sequence is informational
//   context (12.7: identities are contractual only where 14 states them).
//   What is asserted where:
//   - every arm of T5.3-1, and T5.3-2, binds the file dimension
//     (`assertDependencyCycleFindings`): every finding is 14.9 and locates
//     only within the participating files, the finding count is bounded,
//     and every participating file is identified through located files,
//     message, or identity context;
//   - T5.3-1's five in-file arms also pin the full path exactly
//     (`assertFullCyclePath`): the one 14.9 finding carries exactly one
//     location per participating spelling — a `contains` edge records no
//     spelling — each in specs/A.mdx at its byte range, in 12.7 order
//     (start, then end), and no other location; each range is located in
//     the staged bytes at module load and re-sliced by a fixture self-check
//     before any product invocation (the T5.7-2 discipline);
//   - T5.3-1's cross-file arm asserts its dependency cycle's full path here,
//     under `check` (`assertCrossFileCyclePath`): its 14.9 findings, taken
//     together, locate both `d` reference spellings exactly — `B.b` in
//     specs/A.mdx and `A.a` in specs/B.mdx, each at the span its
//     occurrence occupies — and the co-staged import cycle's participants
//     each within its import declaration (T2.1-5's convention, below), and
//     nothing else; the spans and windows are computed from the staged
//     records' bytes at module load and self-checked before any product
//     invocation, as the in-file arms' ranges are. T14-8 (section-14.ts)
//     keeps the strict one-finding-per-cycle cardinality over its own
//     cross-file cycle under `build`, and T5.3-2's entry still asks for no
//     path.
// - The cross-file `depends` arm of T5.3-1 necessarily co-stages a spec
//   import cycle: a cross-file `depends` edge needs an external reference
//   (the local string form is same-file only, SPEC 2.2), external references
//   need imports (2.1), and A→B→A therefore needs mutual imports — itself an
//   invalid import cycle (2.1, 14.9). The assertions account for it per the
//   T2.1-5 convention (section-2.1.ts): reported once, or at most once per
//   participating file, identifying every participating file, each
//   participant located within its import declaration's byte window,
//   `byteWindow("", declaration)` (the declaration begins its file; the
//   one-byte end-widening tolerates a line-granular location).
// - Exact finding accounting: every cycle fixture parses, resolves every
//   reference, and is checked without ever having been built — no derived
//   file and no recorded graph data exists, and invalid sources generate
//   nothing a derived file could be compared against (12.1: a failing build
//   modifies nothing) — so the staged cycles are the only error conditions
//   present and every reported finding must be 14.9 (SPEC 14: each present
//   error reported, nothing else).

import { Buffer } from "node:buffer";
import type {
  Finding,
  FindingLocation,
  GraphEdge,
  SourceRange,
} from "../../helpers/adapters/index.js";
import {
  decodeEdgesReport,
  decodeFindingsReport,
  renderPathValue,
} from "../../helpers/adapters/index.js";
import { fail, parseJsonStdout } from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { stagedMdx } from "../../helpers/staged-mdx.js";
import type { StagedMdx } from "../../helpers/staged-mdx.js";
import { stagedTs } from "../../helpers/staged-ts.js";
import type { StagedTs } from "../../helpers/staged-ts.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { InitialFileContents } from "../../helpers/workspace.js";
import {
  assertEdgeSetEqual,
  buildFindings,
  buildOk,
  byteWindow,
  expectExit,
  runJson,
} from "./support.js";

// Minimal declarative configuration (SPEC 7): exactly one spec group. Every
// T5.3-1 cycle arm past the first stages it in a workspace created after the
// body's first invocation, so it is a staged-source record (S-9's timing
// clause; test/self/s9-staged-sources.test.ts).
const SPECS_ONLY_CONFIG = stagedTs(
  "T5.3-1 xspec.config.ts — exactly one spec group, every cycle arm's workspace",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
);

// One spec group plus one code group (SPEC 7.2): TypeScript files under
// `src/` are discovered code sources, so `build` analyzes their spec-module
// usage (4.3, 4.5) — the TS half of T5.2-1's edge kinds.
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

/** Stage a fresh workspace (config plus `files`), run `body`, dispose (H-1). */
async function withWorkspace<T>(
  config: string | StagedTs,
  files: Readonly<Record<string, InitialFileContents>>,
  body: (workspace: TestWorkspace) => Promise<T>,
): Promise<T> {
  const workspace = await TestWorkspace.create({
    files: { "xspec.config.ts": config, ...files },
  });
  try {
    return await body(workspace);
  } finally {
    await workspace.dispose();
  }
}

/**
 * `check --json` over a workspace staged to produce findings: exit 1 (H-5;
 * SPEC 12.0) with exactly one JSON document, decoded as the findings report.
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
    context,
  );
  return decodeFindingsReport(parseJsonStdout(result, context), context)
    .findings;
}

/** The file path of a requirement-node identity (SPEC 1.5: `path#id`). */
function fileOfIdentity(identity: string): string {
  const hash = identity.indexOf("#");
  return hash === -1 ? identity : identity.slice(0, hash);
}

/** What one cycle fixture stages — and everything its report may contain. */
interface CycleExpectation {
  /** The dependency cycle in edge order, one identity per node (open form). */
  readonly cycle: readonly string[];
  /**
   * Participating files of the spec import cycle the fixture necessarily
   * co-stages (the cross-file arm only; see the module header).
   */
  readonly importCycleFiles?: readonly string[];
}

/**
 * Assert a findings report over a fixture staging exactly one dependency
 * cycle (plus, when stated, the import cycle its cross-file staging
 * necessarily carries): every finding is 14.9 and locates only within the
 * participating files — a cycle's full path renders through its locations,
 * every participating reference spelling (or import declaration) located in
 * the file containing it (SPEC 5.3, 14, 12.7) — the finding count is
 * bounded (one per cycle, or at most one per participating file), and every
 * participating file is identified through located files, message, or
 * identity context (identification at file level; T2.1-5's own helper
 * requires a location within each participating import declaration of its
 * import cycles instead). The byte-precise path is asserted beside it:
 * `assertFullCyclePath` for T5.3-1's in-file arms, `assertCrossFileCyclePath`
 * for its cross-file arm (see the module header).
 */
function assertDependencyCycleFindings(
  findings: readonly Finding[],
  expectation: CycleExpectation,
  context: string,
): void {
  const conditions = findings.map((finding) => finding.condition);
  if (
    findings.length === 0 ||
    conditions.some((condition) => condition !== "14.9")
  ) {
    fail(
      `${context}: the staged cycles are the fixture's only error conditions, so ` +
        `every finding must be 14.9 (SPEC 5.3, 14, 14.9); got conditions ` +
        `${JSON.stringify(conditions)} (findings: ${JSON.stringify(findings)})`,
    );
  }

  const cycleFiles = [...new Set(expectation.cycle.map(fileOfIdentity))];
  const importCycleFiles = expectation.importCycleFiles ?? [];
  const participatingFiles = new Set([...cycleFiles, ...importCycleFiles]);

  // Count bounds: each staged cycle is its own condition instance, so each
  // is reported (SPEC 14: every present error reported) — at least one
  // finding per staged cycle — and at most once per cycle or per
  // participating file (the T1.3-5/T2.1-5 per-file tolerance).
  const min = 1 + (expectation.importCycleFiles === undefined ? 0 : 1);
  const max =
    cycleFiles.length +
    (expectation.importCycleFiles === undefined ? 0 : importCycleFiles.length);
  if (findings.length < min || findings.length > max) {
    fail(
      `${context}: between ${String(min)} and ${String(max)} 14.9 finding(s) ` +
        `report the staged cycle(s) — each cycle reported, once or at most ` +
        `once per participating file — got ${String(findings.length)}: ` +
        `${JSON.stringify(findings)}`,
    );
  }

  // Every finding locates its cycle's participating spellings: at least one
  // location, every located file a participating file (SPEC 14: every
  // reference spelling recording a participating dependency edge, or each
  // participating import declaration, located in the file containing it).
  for (const finding of findings) {
    if (finding.locations.length === 0) {
      fail(
        `${context}: a 14.9 finding locates its cycle's participating ` +
          `spellings in source (SPEC 14, 12.7); got a finding with no ` +
          `locations: ${JSON.stringify(finding)}`,
      );
    }
    for (const location of finding.locations) {
      if (
        typeof location.file !== "string" ||
        !participatingFiles.has(location.file)
      ) {
        fail(
          `${context}: a 14.9 finding's locations lie in the cycle's ` +
            `participating files ${JSON.stringify([...participatingFiles])} ` +
            `(SPEC 14); got a location in ${JSON.stringify(location.file)}`,
        );
      }
    }
  }

  // Every participating file is identified (SPEC 14: actionable errors
  // identify the file) — through located files, message, or identity context.
  const identified = findings
    .map((finding) =>
      [
        finding.message,
        ...finding.locations.map((location) =>
          typeof location.file === "string" ? location.file : "",
        ),
        ...finding.identities,
      ].join("\n"),
    )
    .join("\n");
  for (const file of participatingFiles) {
    if (!identified.includes(file)) {
      fail(
        `${context}: the cycle report must identify the participating file ` +
          `${JSON.stringify(file)} (SPEC 14: actionable errors identify the ` +
          `file); findings: ${JSON.stringify(findings)}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// T5.2-1 — all four edge kinds in one workspace, duplicates collapsing
// ---------------------------------------------------------------------------

// The MDX side: document structure gives the `contains` edges (root → alpha,
// root → beta, alpha → alpha.child; SPEC 5.2, 1.2), `beta`'s `d` array gives
// the `depends` edge — the same target referenced twice, so a product
// recording one edge per declaration fails (SPEC 2.2, 5.2) — and two
// identical own-line `{text("alpha.child")}` embeddings give the MDX
// `embeds` edge, likewise duplicated at declaration.
const T5_2_1_SPEC_SOURCE = [
  '<S id="alpha">',
  "Alpha behavior.",
  "",
  '<S id="alpha.child">',
  "Child behavior.",
  "</S>",
  "</S>",
  "",
  '<S id="beta" d={["alpha", "alpha"]}>',
  "Beta behavior.",
  "",
  '{text("alpha.child")}',
  '{text("alpha.child")}',
  "</S>",
  "",
].join("\n");

// The TypeScript side: two identical `text(SPEC.alpha)` calls inside one
// function give the TS `embeds` edge (SPEC 4.3), and two identical bare
// markers inside another give the `references` edge (SPEC 4.5) — each pair
// collapsing to a single edge from its enclosing named unit (SPEC 4.6, 5.2).
// Distinct functions keep the two kinds' sources distinguishable.
const T5_2_1_APP_SOURCE = [
  'import SPEC, { text } from "../specs/MAIN.xspec";',
  "",
  "function useText(): string {",
  "  const first = text(SPEC.alpha);",
  "  const second = text(SPEC.alpha);",
  "  return first + second;",
  "}",
  "",
  "function marker(): void {",
  "  SPEC.beta;",
  "  SPEC.beta;",
  "}",
  "",
].join("\n");

// The workspace's complete edge set: three `contains` from document
// structure, and — duplicates collapsed — one `depends`, one `embeds` per
// mechanism (MDX and TS), one `references`.
const T5_2_1_EXPECTED_EDGES: readonly GraphEdge[] = [
  { from: "specs/MAIN.mdx", to: "specs/MAIN.mdx#alpha", kind: "contains" },
  { from: "specs/MAIN.mdx", to: "specs/MAIN.mdx#beta", kind: "contains" },
  {
    from: "specs/MAIN.mdx#alpha",
    to: "specs/MAIN.mdx#alpha.child",
    kind: "contains",
  },
  {
    from: "specs/MAIN.mdx#beta",
    to: "specs/MAIN.mdx#alpha",
    kind: "depends",
  },
  {
    from: "specs/MAIN.mdx#beta",
    to: "specs/MAIN.mdx#alpha.child",
    kind: "embeds",
  },
  { from: "src/app.ts#useText", to: "specs/MAIN.mdx#alpha", kind: "embeds" },
  { from: "src/app.ts#marker", to: "specs/MAIN.mdx#beta", kind: "references" },
];

const T5_2_1 = defineProductTest({
  id: "T5.2-1",
  title:
    "one workspace exercises all four edge kinds — `contains` from document structure, `depends` from `d`, `embeds` from MDX `{text(...)}` and from TS `text(...)`, `references` from a marker — and unfiltered `query edges` reports exactly them with correct source, target, and kind, duplicate declarations within each dependency kind collapsed to a single edge (SPEC 5.1, 5.2, 11)",
  run: async (product) => {
    await withWorkspace(
      SPEC_AND_CODE_CONFIG,
      { "specs/MAIN.mdx": T5_2_1_SPEC_SOURCE, "src/app.ts": T5_2_1_APP_SOURCE },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T5.2-1 `build` over the four-edge-kind workspace",
        );
        const label = "T5.2-1 unfiltered `query edges`";
        const edges = decodeEdgesReport(
          await runJson(product, workspace, ["query", "edges"], label),
          label,
        );
        // The exact-set comparison pins every recorded edge of every kind —
        // correct source, target, and kind; none missing, none phantom — and
        // simultaneously asserts duplicate collapse for each dependency kind:
        // every staged `depends`, `embeds`, and `references` declaration is
        // duplicated at source, so an uncollapsed product (or a query surface
        // reporting a collapsed edge twice) fails (SPEC 5.2).
        assertEdgeSetEqual(
          edges,
          T5_2_1_EXPECTED_EDGES,
          "T5.2-1 the workspace's complete edge set — all four kinds with " +
            "correct source, target, and kind, duplicates within each " +
            "dependency kind collapsed (SPEC 5.2, 2.2, 2.3, 4.3, 4.5)",
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T5.3-1 — check detects and reports cycles with the full cycle path
// ---------------------------------------------------------------------------

/**
 * One participating reference spelling of a cycle — an in-file arm's, or
 * one file's `d` reference of the cross-file arm (SPEC 14: a cycle locates
 * its full path in source, every reference spelling recording a
 * participating dependency edge) — and the byte range its occurrence
 * occupies (5.7, 1.7), located at module load in the staged bytes — never
 * from product output — as the one staged occurrence of `before` followed
 * by the spelling, `before` the staged context pinning which spelling of
 * the same characters is meant (`"s"` is spelled by `id="s"` too).
 */
interface CycleSpelling {
  readonly what: string;
  readonly spelling: string;
  /**
   * `{start: -1, end: -1}` when `before` + `spelling` is not staged exactly
   * once: the fixture self-check then fails it as a harness defect.
   */
  readonly range: SourceRange;
}

/**
 * An in-file arm's full cycle path: the file it is staged in, the staged
 * record (the self-check ground), and every participating spelling,
 * declared in the 12.7 within-finding order — one file, so start, then end.
 */
interface InFileCyclePath {
  readonly file: string;
  readonly staged: StagedMdx;
  readonly spellings: readonly CycleSpelling[];
}

/** A staged record's bytes, exactly as the workspace writes them. */
function stagedBytes(staged: StagedMdx): Buffer {
  return typeof staged.source === "string"
    ? Buffer.from(staged.source, "utf8")
    : Buffer.from(staged.source);
}

/** A participating spelling as an arm declares it: `before` + `spelling`. */
interface CycleSpellingDecl {
  readonly what: string;
  readonly before: string;
  readonly spelling: string;
}

/**
 * Locate one declared spelling in a record's bytes (module load): the
 * spelling's byte range when `before` + `spelling` is staged exactly once,
 * else `{start: -1, end: -1}`, which the fixture self-check fails.
 */
function locateSpelling(
  bytes: Buffer,
  { what, before, spelling }: CycleSpellingDecl,
): CycleSpelling {
  const needle = Buffer.from(before + spelling, "utf8");
  const at = bytes.indexOf(needle);
  const once = at !== -1 && bytes.indexOf(needle, at + 1) === -1;
  const start = at + Buffer.byteLength(before, "utf8");
  return {
    what,
    spelling,
    range: once
      ? { start, end: start + Buffer.byteLength(spelling, "utf8") }
      : { start: -1, end: -1 },
  };
}

/** Locate each participating spelling in `staged`'s bytes (module load). */
function inFileCyclePath(
  file: string,
  staged: StagedMdx,
  spellings: readonly CycleSpellingDecl[],
): InFileCyclePath {
  const bytes = stagedBytes(staged);
  return {
    file,
    staged,
    spellings: spellings.map((declared) => locateSpelling(bytes, declared)),
  };
}

/**
 * One participating file of the cross-file arm's full path (SPEC 14: "a
 * cycle locates its full path in source, every reference spelling recording
 * a participating dependency edge, or each participating import declaration
 * of a spec import cycle"): the file, its staged record (the self-check
 * ground), its `d` reference spelling — located as an in-file arm's
 * spelling is, at the span its occurrence occupies (5.7: "a `d` reference
 * occurrence spans that one reference's own expression") — and its import
 * declaration, the co-staged import cycle's participant, which begins the
 * file (prefix "") and is judged within its byte window
 * `byteWindow("", declaration)`, T2.1-5's window for an import-cycle
 * participant.
 */
interface CrossFileCycleParticipant {
  readonly file: string;
  readonly staged: StagedMdx;
  readonly dependency: CycleSpelling;
  readonly declaration: string;
  readonly declarationWindow: { readonly start: number; readonly end: number };
}

/**
 * The cross-file arm's full path: one participant per participating file,
 * declared in file-path byte order.
 */
interface CrossFileCyclePath {
  readonly participants: readonly CrossFileCycleParticipant[];
}

/** A cross-file participant as the arm declares it. */
interface CrossFileCycleParticipantDecl {
  readonly file: string;
  readonly staged: StagedMdx;
  readonly dependency: CycleSpellingDecl;
  readonly declaration: string;
}

/**
 * Locate each participant's `d` spelling in its record's bytes and give
 * its import declaration its window (module load).
 */
function crossFileCyclePath(
  participants: readonly CrossFileCycleParticipantDecl[],
): CrossFileCyclePath {
  return {
    participants: participants.map(
      ({ file, staged, dependency, declaration }) => ({
        file,
        staged,
        dependency: locateSpelling(stagedBytes(staged), dependency),
        declaration,
        declarationWindow: byteWindow("", declaration),
      }),
    ),
  };
}

/**
 * Fixture self-check (harness-side, before any product invocation; the
 * T5.7-2 discipline): a claimed byte range slices the staged bytes to
 * exactly the spelling it claims. A failure is a staging defect of this
 * test, thrown as a harness error, never a product result.
 */
function sliceCheck(
  bytes: Buffer,
  range: SourceRange,
  spelling: string,
  what: string,
): void {
  const actual =
    range.start >= 0 && range.start <= range.end && range.end <= bytes.length
      ? bytes.subarray(range.start, range.end).toString("utf8")
      : undefined;
  if (actual !== spelling) {
    throw new Error(
      `section-5.1-5.3 fixture self-check — ${what}: ` +
        (range.start < 0
          ? `the spelling ${JSON.stringify(spelling)} is not staged exactly ` +
            `once after its context`
          : `the claimed byte range [${String(range.start)}, ` +
            `${String(range.end)}) slices the staged bytes to ` +
            `${JSON.stringify(actual)}, expected ${JSON.stringify(spelling)}`) +
        `; the staging arithmetic is wrong (harness defect, not a product ` +
        `result)`,
    );
  }
}

/**
 * Self-check an in-file arm's full path: every spelling slices back out of
 * the staged bytes, and the declared sequence ascends strictly by start,
 * then end — the 12.7 order of one file's locations — so the index-wise
 * assertion below also pins that order.
 */
function checkCyclePathFixture(arm: string, path: InFileCyclePath): void {
  const bytes = stagedBytes(path.staged);
  let previous: SourceRange | undefined;
  for (const { what, spelling, range } of path.spellings) {
    sliceCheck(bytes, range, spelling, `${arm}: ${what}`);
    if (
      previous !== undefined &&
      (range.start < previous.start ||
        (range.start === previous.start && range.end <= previous.end))
    ) {
      throw new Error(
        `section-5.1-5.3 fixture self-check — ${arm}: the participating ` +
          `spellings must be declared in 12.7 order (start, then end); ` +
          `${what} at [${String(range.start)}, ${String(range.end)}) ` +
          `follows [${String(previous.start)}, ${String(previous.end)}) ` +
          `(harness defect, not a product result)`,
      );
    }
    previous = range;
  }
}

/**
 * Self-check the cross-file arm's full path (harness-side, before any
 * product invocation; the T5.7-2 discipline): each `d` span slices back out
 * of its file's staged bytes to its spelling, and each import declaration
 * slices back at [0, its length) — it begins its file, so its window
 * `byteWindow("", declaration)` is its own characters end-widened by one
 * byte. A failure is a staging defect of this test, thrown as a harness
 * error naming the arm, never a product result.
 */
function checkCrossFileCyclePathFixture(
  arm: string,
  path: CrossFileCyclePath,
): void {
  for (const { file, staged, dependency, declaration } of path.participants) {
    const bytes = stagedBytes(staged);
    sliceCheck(
      bytes,
      dependency.range,
      dependency.spelling,
      `${arm}: ${dependency.what}`,
    );
    sliceCheck(
      bytes,
      { start: 0, end: Buffer.byteLength(declaration, "utf8") },
      declaration,
      `${arm}: ${file}'s import declaration, which begins its file`,
    );
  }
}

/**
 * Assert an in-file cycle's full path exactly (SPEC 5.3: reported with the
 * full cycle path; 14: a cycle locates its full path in source, every
 * reference spelling recording a participating dependency edge, ranges
 * exact per condition, a reference spelling at the span its occurrence
 * occupies, 5.7; 12.7: locations ordered by file path bytes, then range
 * start, then range end): the arm's one 14.9 finding carries exactly one
 * location per participating spelling, index-wise in the declared order,
 * each in the arm's file at exactly the spelling's byte range — and no
 * other location, so a representative spelling, a section tag, or any
 * other construct located beside or instead of a spelling fails.
 */
function assertFullCyclePath(
  findings: readonly Finding[],
  path: InFileCyclePath,
  context: string,
): void {
  const expected = path.spellings.map(({ what, spelling, range }) => ({
    what,
    spelling,
    file: path.file,
    range,
  }));
  if (findings.length !== 1) {
    fail(
      `${context}: the staged cycle is one condition instance in one file, ` +
        `reported as exactly one 14.9 finding carrying its full path ` +
        `(SPEC 5.3, 14); got ${String(findings.length)} finding(s): ` +
        `${JSON.stringify(findings)}`,
    );
  }
  const finding = findings[0]!;
  if (finding.locations.length !== expected.length) {
    fail(
      `${context}: the 14.9 finding locates the full cycle path — exactly ` +
        `one location per participating reference spelling, no ` +
        `representative chosen and nothing beside them (a \`contains\` edge ` +
        `records no spelling; SPEC 5.3, 14, 5.7) — expected exactly ` +
        `${String(expected.length)} location(s), ${JSON.stringify(expected)}; ` +
        `got ${String(finding.locations.length)}: ` +
        `${JSON.stringify(finding.locations)} (message: ` +
        `${JSON.stringify(finding.message)})`,
    );
  }
  expected.forEach((spelling, index) => {
    const location = finding.locations[index]!;
    if (
      location.file !== spelling.file ||
      location.range.start !== spelling.range.start ||
      location.range.end !== spelling.range.end
    ) {
      fail(
        `${context}: location[${String(index)}] must locate ${spelling.what} ` +
          `— ${JSON.stringify(spelling.spelling)} in ` +
          `${JSON.stringify(spelling.file)} at exactly ` +
          `[${String(spelling.range.start)}, ${String(spelling.range.end)}), ` +
          `the span its occurrence occupies (SPEC 14: every reference ` +
          `spelling recording a participating dependency edge, ranges exact ` +
          `per condition; 5.7: a \`d\` reference's own expression, an MDX ` +
          `embedding's entire braced container; 12.7: locations in file, ` +
          `start, end order — the declared order); expected ` +
          `${JSON.stringify(expected)}, got ` +
          `${JSON.stringify(finding.locations)} (message: ` +
          `${JSON.stringify(finding.message)})`,
      );
    }
  });
}

/** Whether a location is exactly `range` in `file` (file, start, end). */
function locatesExactly(
  location: FindingLocation,
  file: string,
  range: SourceRange,
): boolean {
  return (
    location.file === file &&
    location.range.start === range.start &&
    location.range.end === range.end
  );
}

/** Whether a location lies in `file` within `window` (T2.1-5's test). */
function locatesWithin(
  location: FindingLocation,
  file: string,
  window: { readonly start: number; readonly end: number },
): boolean {
  return (
    location.file === file &&
    location.range.start >= window.start &&
    location.range.end <= window.end
  );
}

/** A location as diagnostics render it: file, then its half-open range. */
function renderLocation(location: FindingLocation): string {
  return (
    `${renderPathValue(location.file)} [${String(location.range.start)}, ` +
    `${String(location.range.end)})`
  );
}

/**
 * Assert the cross-file arm's full path (SPEC 5.3: reported with the full
 * cycle path; 14: "a cycle locates its full path in source, every reference
 * spelling recording a participating dependency edge, or each participating
 * import declaration of a spec import cycle", ranges exact per condition, a
 * reference spelling located by the span its occurrence occupies; 5.7: "a
 * `d` reference occurrence spans that one reference's own expression"),
 * across all of the report's 14.9 findings taken together — their count
 * tolerance and file identification stay `assertDependencyCycleFindings`'s,
 * run first:
 * (a) every location either equals one participating file's `d` span
 *     exactly (file, start, end) or lies in that file within its import
 *     declaration's window, so a section tag, the whole `d` attribute, or
 *     any other construct located fails;
 * (b) each `d` span is located exactly by at least one finding, so a report
 *     of the co-staged import cycle alone, or one missing a spelling, fails;
 * (c) each import declaration is located, within its window, by at least
 *     one finding — the import cycle's participants judged within their
 *     declarations (T2.1-5's convention), the dependency cycle's spellings
 *     pinned exactly.
 */
function assertCrossFileCyclePath(
  findings: readonly Finding[],
  path: CrossFileCyclePath,
  context: string,
): void {
  const expectation =
    `expected, across the 14.9 findings taken together, exactly each ` +
    `participating file's \`d\` reference spelling at its occurrence span ` +
    `and, within each import declaration's byte window, the co-staged ` +
    `import cycle's participant, nothing else: ` +
    JSON.stringify(
      path.participants.map(
        ({ file, dependency, declaration, declarationWindow }) => ({
          file,
          dependency: {
            spelling: dependency.spelling,
            range: dependency.range,
          },
          importDeclaration: { declaration, window: declarationWindow },
        }),
      ),
    );
  const rule =
    `SPEC 14: "a cycle locates its full path in source, every reference ` +
    `spelling recording a participating dependency edge, or each ` +
    `participating import declaration of a spec import cycle"; 5.7: "a ` +
    `\`d\` reference occurrence spans that one reference's own expression"`;
  const report = `findings: ${JSON.stringify(findings)}`;

  // (a) Nothing else is located.
  for (const finding of findings) {
    for (const location of finding.locations) {
      const accounted = path.participants.some(
        ({ file, dependency, declarationWindow }) =>
          locatesExactly(location, file, dependency.range) ||
          locatesWithin(location, file, declarationWindow),
      );
      if (!accounted) {
        fail(
          `${context}: the stray location ${renderLocation(location)} is ` +
            `neither a participating \`d\` reference spelling's occurrence ` +
            `span nor within a participating import declaration (${rule}); ` +
            `${expectation}; ${report}`,
        );
      }
    }
  }

  // (b) Each `d` spelling is located exactly.
  for (const { file, dependency } of path.participants) {
    const located = findings.some((finding) =>
      finding.locations.some((location) =>
        locatesExactly(location, file, dependency.range),
      ),
    );
    if (!located) {
      fail(
        `${context}: the missing location ${file} ` +
          `[${String(dependency.range.start)}, ${String(dependency.range.end)}) ` +
          `— ${dependency.what}, ${JSON.stringify(dependency.spelling)} at ` +
          `the span its occurrence occupies — must be located exactly by a ` +
          `14.9 finding, the dependency cycle's full path (${rule}); ` +
          `${expectation}; ${report}`,
      );
    }
  }

  // (c) Each import declaration is located within its window.
  for (const { file, declaration, declarationWindow } of path.participants) {
    const located = findings.some((finding) =>
      finding.locations.some((location) =>
        locatesWithin(location, file, declarationWindow),
      ),
    );
    if (!located) {
      fail(
        `${context}: the missing location of ${file}'s import declaration ` +
          `${JSON.stringify(declaration)} — the co-staged spec import ` +
          `cycle's participant — must be located by a 14.9 finding within ` +
          `its byte window [${String(declarationWindow.start)}, ` +
          `${String(declarationWindow.end)}] (${rule}); ${expectation}; ` +
          `${report}`,
      );
    }
  }
}

/** One cycle fixture: its files plus the CycleExpectation it stages. */
interface CycleArm extends CycleExpectation {
  readonly name: string;
  readonly files: Readonly<Record<string, InitialFileContents>>;
  /**
   * An in-file arm's full cycle path, asserted exactly; absent for the
   * cross-file arm, whose path is `crossFilePath`.
   */
  readonly fullPath?: InFileCyclePath;
  /**
   * The cross-file arm's full cycle path — per participating file, its `d`
   * reference spelling, asserted exactly, and its import declaration, the
   * co-staged import cycle's participant, judged within its window
   * (`assertCrossFileCyclePath`); absent for the in-file arms.
   */
  readonly crossFilePath?: CrossFileCyclePath;
}

// The self-`depends` arm's source, exported: T14-4's and T14-6's sweeps
// (section-14.ts) stage the same bytes as their 14.9 entry's specs/a.mdx
// (T5.3-1 is 14.9's primary test) — ONE staged-source record (S-9).
export const SELF_DEPENDS_STAGED = stagedMdx(
  "T5.3-1/T14-4/T14-6 self-depends specs/A.mdx (T14-4's and T14-6's sweep specs/a.mdx, the 14.9 dependency-cycle entry)",
  ['<S id="s" d={"s"}>', "Depends on itself.", "</S>", ""].join("\n"),
);

/** The one file every in-file arm stages its cycle in. */
const IN_FILE_CYCLE_FILE = "specs/A.mdx";

/**
 * An in-file arm: its staged `specs/A.mdx` record and its participating
 * spellings, located in the record's bytes at module load (the record is
 * the very expression the staging uses, created in arm order).
 */
function inFileArm(arm: {
  readonly name: string;
  readonly staged: StagedMdx;
  readonly cycle: readonly string[];
  readonly spellings: readonly CycleSpellingDecl[];
}): CycleArm {
  return {
    name: arm.name,
    files: { [IN_FILE_CYCLE_FILE]: arm.staged },
    cycle: arm.cycle,
    fullPath: inFileCyclePath(IN_FILE_CYCLE_FILE, arm.staged, arm.spellings),
  };
}

// The cross-file arm's import declarations, each beginning its file (prefix
// ""): the co-staged import cycle's participants, whose `byteWindow` every
// import-cycle location in that file must fall within (T2.1-5's convention).
const CROSS_FILE_A_IMPORT = 'import B from "./B.xspec"';
const CROSS_FILE_B_IMPORT = 'import A from "./A.xspec"';

// The cross-file arm's two records, module constants so that its full path
// is computed from the very bytes the arm stages (created here, before the
// in-file arms' records, in arm order as before).
const CROSS_FILE_A_STAGED = stagedMdx(
  "T5.3-1 cross-file depends cycle specs/A.mdx",
  [
    CROSS_FILE_A_IMPORT,
    "",
    '<S id="a" d={B.b}>',
    "A behavior.",
    "</S>",
    "",
  ].join("\n"),
);
const CROSS_FILE_B_STAGED = stagedMdx(
  "T5.3-1 cross-file depends cycle specs/B.mdx",
  [
    CROSS_FILE_B_IMPORT,
    "",
    '<S id="b" d={A.a}>',
    "B behavior.",
    "</S>",
    "",
  ].join("\n"),
);

// The cross-file arm's full path, located in the records' bytes at module
// load: each file's `d` reference, after `d={` as the in-file arms' `d`
// spellings are, and its import declaration's window.
const CROSS_FILE_CYCLE_PATH = crossFileCyclePath([
  {
    file: "specs/A.mdx",
    staged: CROSS_FILE_A_STAGED,
    dependency: {
      what: "a's `d` reference to B.b",
      before: "d={",
      spelling: "B.b",
    },
    declaration: CROSS_FILE_A_IMPORT,
  },
  {
    file: "specs/B.mdx",
    staged: CROSS_FILE_B_STAGED,
    dependency: {
      what: "b's `d` reference to A.a",
      before: "d={",
      spelling: "A.a",
    },
    declaration: CROSS_FILE_B_IMPORT,
  },
]);

// Every arm past the first stages its files after the first arm's `check`:
// the `.mdx` entries are staged-source records, judged before any product
// exists (S-9, test/self/s9-staged-sources.test.ts); the first arm's are
// converted uniformly.
const T5_3_1_ARMS: readonly CycleArm[] = [
  {
    // Both directions need external references, hence mutual imports — the
    // co-staged import cycle (see the module header).
    name:
      "a `depends` cycle A→B→A across files (with its unavoidable mutual-" +
      "import spec import cycle)",
    files: {
      "specs/A.mdx": CROSS_FILE_A_STAGED,
      "specs/B.mdx": CROSS_FILE_B_STAGED,
    },
    cycle: ["specs/A.mdx#a", "specs/B.mdx#b"],
    importCycleFiles: ["specs/A.mdx", "specs/B.mdx"],
    crossFilePath: CROSS_FILE_CYCLE_PATH,
  },
  inFileArm({
    // p contains p.q; p.q embeds x; x embeds p — mixed through `contains`
    // and `embeds`, with no ancestor relation along either embeds edge (the
    // ancestor shapes are the two arms below).
    name: "a mixed cycle through `contains` + `embeds`",
    staged: stagedMdx(
      "T5.3-1 mixed contains+embeds cycle specs/A.mdx",
      [
        '<S id="p">',
        "P behavior.",
        "",
        '<S id="p.q">',
        'Q embeds: {text("x")}',
        "</S>",
        "</S>",
        "",
        '<S id="x">',
        'X embeds: {text("p")}',
        "</S>",
        "",
      ].join("\n"),
    ),
    cycle: ["specs/A.mdx#p", "specs/A.mdx#p.q", "specs/A.mdx#x"],
    // The two embeddings; the `contains` edge p → p.q records no spelling.
    spellings: [
      { what: "p.q's embedding of x", before: "", spelling: '{text("x")}' },
      { what: "x's embedding of p", before: "", spelling: '{text("p")}' },
    ],
  }),
  inFileArm({
    name: "a self-`depends` (a dependency cycle of length one)",
    staged: SELF_DEPENDS_STAGED,
    cycle: ["specs/A.mdx#s"],
    // The `d` reference's own expression, quotes included — never the
    // `"s"` of `id="s"`.
    spellings: [
      { what: "s's `d` reference to itself", before: "d={", spelling: '"s"' },
    ],
  }),
  inFileArm({
    name: "a self-`embeds` (a dependency cycle of length one)",
    staged: stagedMdx(
      "T5.3-1 self-embeds specs/A.mdx",
      ['<S id="s">', 'Embeds itself: {text("s")}', "</S>", ""].join("\n"),
    ),
    cycle: ["specs/A.mdx#s"],
    spellings: [
      { what: "s's embedding of itself", before: "", spelling: '{text("s")}' },
    ],
  }),
  inFileArm({
    // The cycle runs through the intermediate section a.b the `contains`
    // chain passes: a → a.b → a.b.c → a. Its one reference spelling is the
    // `d` reference; the two `contains` edges record no spelling.
    name: "a section depending on its own ancestor (grandparent)",
    staged: stagedMdx(
      "T5.3-1 depends on own grandparent specs/A.mdx",
      [
        '<S id="a">',
        "Alpha behavior.",
        "",
        '<S id="a.b">',
        "Beta behavior.",
        "",
        '<S id="a.b.c" d={"a"}>',
        "Gamma depends on its grandparent.",
        "</S>",
        "</S>",
        "</S>",
        "",
      ].join("\n"),
    ),
    cycle: ["specs/A.mdx#a", "specs/A.mdx#a.b", "specs/A.mdx#a.b.c"],
    spellings: [
      {
        what: "a.b.c's `d` reference to its grandparent a",
        before: "d={",
        spelling: '"a"',
      },
    ],
  }),
  inFileArm({
    // As above, the embedding the one reference spelling.
    name: "a section embedding its own ancestor (grandparent)",
    staged: stagedMdx(
      "T5.3-1 embeds own grandparent specs/A.mdx",
      [
        '<S id="a">',
        "Alpha behavior.",
        "",
        '<S id="a.b">',
        "Beta behavior.",
        "",
        '<S id="a.b.c">',
        'Gamma embeds its grandparent: {text("a")}',
        "</S>",
        "</S>",
        "</S>",
        "",
      ].join("\n"),
    ),
    cycle: ["specs/A.mdx#a", "specs/A.mdx#a.b", "specs/A.mdx#a.b.c"],
    spellings: [
      {
        what: "a.b.c's embedding of its grandparent a",
        before: "",
        spelling: '{text("a")}',
      },
    ],
  }),
];

const T5_3_1 = defineProductTest({
  id: "T5.3-1",
  title:
    "`check` detects and reports, with the full cycle path, each staged dependency cycle — a `depends` cycle A→B→A across files, a mixed cycle through `contains` + `embeds`, a self-`depends` and a self-`embeds` of length one, and a section depending on / embedding its own ancestor — at exit 1; each in-file arm's one 14.9 finding locates exactly every participating reference spelling at its occurrence span in specs/A.mdx (a `d` reference's own expression, an embedding's braced container; no `contains` edge located), in 12.7 order, and nothing else; the cross-file arm's 14.9 findings together locate exactly its two `d` reference spellings — `B.b` in specs/A.mdx and `A.a` in specs/B.mdx, each at its occurrence span — and, within each import declaration, the co-staged import cycle's participants, and nothing else (SPEC 5.3, 14.9, 14, 5.7, 12.7)",
  run: async (product) => {
    // Fixture self-checks (T5.7-2 discipline), before any product
    // invocation: every in-file arm's located spellings slice back out of
    // its staged bytes, in 12.7 order, and the cross-file arm's `d` spans
    // and import declarations slice back out of their files' staged bytes.
    for (const arm of T5_3_1_ARMS) {
      if (arm.fullPath !== undefined) {
        checkCyclePathFixture(arm.name, arm.fullPath);
      }
      if (arm.crossFilePath !== undefined) {
        checkCrossFileCyclePathFixture(arm.name, arm.crossFilePath);
      }
    }
    for (const arm of T5_3_1_ARMS) {
      await withWorkspace(SPECS_ONLY_CONFIG, arm.files, async (workspace) => {
        const context = `T5.3-1 \`check --json\` over ${arm.name}`;
        const findings = await checkFindings(product, workspace, context);
        assertDependencyCycleFindings(findings, arm, context);
        if (arm.fullPath !== undefined) {
          assertFullCyclePath(findings, arm.fullPath, context);
        }
        if (arm.crossFilePath !== undefined) {
          assertCrossFileCyclePath(findings, arm.crossFilePath, context);
        }
      });
    }
  },
});

// ---------------------------------------------------------------------------
// T5.3-2 — build also rejects dependency cycles (14.9 build-and-check)
// ---------------------------------------------------------------------------

// A two-node same-file `depends` cycle via local string references — no
// import exists, so the dependency cycle is the fixture's only error
// condition and its report is exactly one 14.9 finding with the full path.
const T5_3_2_SOURCE = [
  '<S id="a" d={"b"}>',
  "A behavior.",
  "</S>",
  "",
  '<S id="b" d={"a"}>',
  "B behavior.",
  "</S>",
  "",
].join("\n");

const T5_3_2_CYCLE: readonly string[] = ["specs/A.mdx#a", "specs/A.mdx#b"];

const T5_3_2 = defineProductTest({
  id: "T5.3-2",
  title:
    "`build` also rejects dependency cycles: a two-node `depends` cycle fails `build` at exit 1 with one 14.9 finding carrying the full cycle path, and `check` over the same workspace reports the same — 14.9 is a build-and-check condition (SPEC 5.3, 14, 14.9)",
  run: async (product) => {
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { "specs/A.mdx": T5_3_2_SOURCE },
      async (workspace) => {
        const buildContext =
          "T5.3-2 `build --json` over a two-node `depends` cycle";
        assertDependencyCycleFindings(
          await buildFindings(product, workspace, buildContext),
          { cycle: T5_3_2_CYCLE },
          buildContext,
        );
        const checkContext =
          "T5.3-2 `check --json` over the same workspace (14.9 is a " +
          "build-and-check condition)";
        assertDependencyCycleFindings(
          await checkFindings(product, workspace, checkContext),
          { cycle: T5_3_2_CYCLE },
          checkContext,
        );
      },
    );
  },
});

/** TEST-SPEC §5.1–5.3, in canonical ID order (SUITE-17). */
export const section51to53Tests: readonly ProductTestEntry[] = [
  T5_2_1,
  T5_3_1,
  T5_3_2,
];
