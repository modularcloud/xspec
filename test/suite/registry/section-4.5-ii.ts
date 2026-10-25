// TEST-SPEC §4.5 (dependency markers), second part — SUITE-15 (continued):
// T4.5-10, the scope a nested import declaration declares its bindings in
// and the chains it roots, and T4.5-11, the collisions in an import's own
// scope (its own section below). T4.5-1 … T4.5-9 are section-4.5.ts's
// business; this module keeps that file's edits bounded (the section-6.5-v
// precedent).
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), decodes output through the H-3 adapters,
// and rejects a product only via diagnosed assertion failures (H-8).
//
// SPEC 4.5: an import declaration declares its bindings in its own scope —
// the file's for a top-level declaration and, for a nested one (TypeScript's
// parser admits an import declaration wherever a statement may stand,
// 14.20), that of the innermost function, class static block, or namespace
// or module declaration enclosing it, never a block's, as TypeScript at
// release 5.9.3 declares them — so the marker of `function g() { { import A
// from "../specs/A.xspec"; } A.a.b; }` is rooted at that import, whether or
// not a top-level import binds `A` too — a pair 14.15 reports whatever
// their scopes. Which binding roots a chain is the language's scoping
// question (2.4), an import binding its identifier throughout its scope and
// the scopes nested in it; a rooted marker records a `references` edge from
// the innermost enclosing named code unit, or the file where none encloses
// it (4.5, 4.6), and its occurrence (5.7). A `text` binding is declared in
// its import's scope alike, and is sanctioned only as the callee of a spec
// module's `text` call (4.3, 4.5): a node passed to a call whose callee no
// visible `text` binding binds is used outside the sanctioned forms (14.18).
//
// T4.5-10's conservative operationalizations (noted per H-4 — wording is
// free, so only the stated observables are asserted; T4.5-11's stand at its
// own section):
// - T4.5-10's arms each stage a workspace of their own (H-1), (g)'s two
//   stagings one each: `specs/A.mdx` holding `a` and its child `a.b` — in
//   (d) beside `specs/B.mdx` holding the same — the arm's code sources
//   together under `src/`, and a configuration with one spec group
//   (`specs/**/*.mdx`) and one code group (`src/**/*.ts`), emission
//   disabled: exactly the files TEST-SPEC names, so (e)'s nested `import {
//   SPEC } from "./t"` names no staged module, its specifier's validity a
//   consumer-side matter outside xspec's validations (6.4). Every staged
//   file is a staged-source record (S-9's timing clause: every arm's
//   workspace past the body's first is created after a product
//   invocation), each code text TEST-SPEC's exactly — a trailing U+000A
//   where TEST-SPEC spells one and none where it spells none; (c)'s two
//   functions, which TEST-SPEC places "beside" each other, are joined by
//   one U+000A, no trailing one; (g)'s twin is (g)'s text with `text("x")`
//   in the call's place. TEST-SPEC fixes the texts and the locations, the
//   harness the file names where TEST-SPEC names none. Each text is
//   accepted by TypeScript 5.9.3 both as module code and as script code
//   (S-9's judge, test/self/s9-staged-sources.test.ts): its diagnostics on
//   a nested import declaration, on a statement in an ambient context, and
//   on an undeclared string-named module declaration are post-parse checks
//   (14.20).
// - None is compiled under H-2's channel: TypeScript's checker rejects a
//   nested import declaration after parsing, so each arm observes xspec's
//   surfaces alone. A valid arm's — (a), (b), (c), (f), (g)'s twin, and
//   (h) — are `build --json`, then `check --json` on the freshly built
//   workspace, each exactly `{"findings": []}` (exit 0), then `query
//   edges` and `occurrences`.
// - The failing arms, (d), (e), and (g): `build --json` and `check --json`
//   each exit 1 with exactly the arm's one finding — the complete set, so
//   TEST-SPEC's "no 14.7" (and (g)'s "no 14.7, 14.8, or 14.11") is that
//   set's — `check`'s nothing set aside: on a workspace failing `build`'s
//   validations 14.10's mismatch forms are undetectable, and a never-built
//   workspace holds no record for its other forms to consult (SPEC 14.10;
//   section-4.ts's T4-4 and T4-6 assert `check` alike). The finding
//   concerns no path and carries exactly its locations, byte-exact, in
//   12.7's within-finding order (file bytes, then start, then end): a 14.15
//   every colliding declaration by its own characters (T14-11) — no
//   declaration staged here spells a `;`, so each ends at its closing
//   quote, and (d)'s block-nested one lies inside its braces, the braces
//   excluded — and (g)'s 14.18 TEST-SPEC's [105, 111), `SPEC.a`, the
//   binding's identifier extended by the chain it roots (14). Their `query
//   edges` is no observation TEST-SPEC names (its gate answers nothing on a
//   failing workspace, 13.3) and is not made: `occurrences --file <file>`,
//   answering on the failing workspace (11.2), exits 1 with that finding
//   beside the complete record set.
// - Edges: (a)'s "`query edges` reports one `references` edge", (b)'s
//   "each marker records its `references` edge … from the location named",
//   and (h)'s "one `references` edge … and one `embeds` edge" are the
//   workspace's complete dependency-edge set — the spec source's
//   structural `contains` edges set aside (SPEC 5.2) — compared with
//   exactly those edges; (c)'s "lists no edge from its location" is that
//   set compared with none, its workspace holding no other spelling that
//   could record one; (f)'s "lists no edge from `src/q.ts`" and (g)'s
//   twin's "no edge from `src/c.ts`" are the answer's edges from that file
//   or a unit within it compared with none.
// - Occurrences: (a)'s "one marker occurrence", (d)'s and (h)'s "exactly
//   two records", and (e)'s "exactly one record" are the complete record
//   set of the surface TEST-SPEC names — a bare `occurrences` for (a),
//   `occurrences --file <file>` otherwise — every record's every datum
//   pinned from the exact bytes (5.7): its own span (a marker's bare chain,
//   any `;` excluded; a `text(...)` call callee through closing
//   parenthesis), its kind, its source's identity with that location's own
//   range (1.7: a whole-file location the entire file; a function
//   declaration from `function`, a leading `export` excluded, through its
//   closing brace; (h)'s arrow-function-valued `const h` its declarator,
//   the name through the initializer), and its target; on a valid
//   workspace, beside no finding (11.3). (c)'s "no occurrence" is a bare
//   `occurrences` answering no record and no finding; (f)'s and (g)'s
//   twin's, `occurrences --file` likewise; (g)'s, `occurrences --file
//   src/c.ts` listing no record beside its finding.
// - Every construct a pin locates is found in the staged bytes at module
//   load — its spelling occurring exactly as often as the text holds it,
//   each range TEST-SPEC pins ((g)'s [105, 111), (h)'s [87, 92) and
//   [112, 121)) checked against the computed one — a mismatch a harness
//   defect thrown at load, never a product verdict.
// - Every arm workspace runs; each one's diagnosed failure is collected and
//   the body fails once at the end, naming every arm that failed (T6.5-23's
//   discipline, section-6.5-v.ts), so one product failure hides no other
//   arm's verdict. A harness error — anything but a diagnosed assertion
//   failure, a hang included — propagates at once.

import { Buffer } from "node:buffer";
import type { Finding, GraphEdge } from "../../helpers/adapters/index.js";
import {
  decodeEdgesReport,
  decodeOccurrencesReport,
  renderPathValue,
} from "../../helpers/adapters/index.js";
import {
  fail,
  HarnessAssertionError,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { stagedMdx } from "../../helpers/staged-mdx.js";
import { stagedTs } from "../../helpers/staged-ts.js";
import type { StagedTs } from "../../helpers/staged-ts.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { InitialFileContents } from "../../helpers/workspace.js";
import { locationTuples, occurrenceTuple } from "./section-4.5.js";
import {
  assertEdgeSetEqual,
  assertSameJson,
  buildFindings,
  expectExit,
  expectFindingFreeReport,
  runFindingsReport,
  runJson,
} from "./support.js";

/**
 * Stage a fresh workspace — the configuration record plus `files` — run
 * `body`, and dispose of it (H-1). Every entry is a staged-source record,
 * staged under the record's own declaration (S-9; helpers/workspace.ts).
 */
async function withWorkspace<T>(
  config: StagedTs,
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
 * `build --json`, then `check --json` on the freshly built workspace, each
 * finding-free — exit 0 and exactly `{"findings": []}` (SPEC 12.1, 12.2,
 * 12.7).
 */
async function expectCleanBuildAndCheck(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
  why: string,
): Promise<void> {
  await expectFindingFreeReport(
    product,
    workspace,
    ["build", "--json"],
    `${context}: \`build --json\` — ${why}`,
  );
  await expectFindingFreeReport(
    product,
    workspace,
    ["check", "--json"],
    `${context}: \`check --json\` on the freshly built workspace (SPEC ` +
      `12.2) — ${why}`,
  );
}

/**
 * The workspace's dependency edges: `query edges` decoded (SPEC 11.1), the
 * spec sources' structural `contains` edges set aside (5.2).
 */
async function queryDependencyEdges(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
): Promise<readonly GraphEdge[]> {
  const label = `${context}: \`query edges\``;
  return decodeEdgesReport(
    await runJson(product, workspace, ["query", "edges"], label),
    label,
  ).filter((edge) => edge.kind !== "contains");
}

/**
 * An `occurrences` invocation on a valid workspace (`argv` naming the
 * subcommand and its filters): exit 0 with exactly one JSON document, its
 * findings none (SPEC 11.2, 11.3: a complete, finding-free answer), its
 * records returned as `occurrenceTuple`s, every datum of 5.7 per record.
 */
async function validOccurrenceRecords(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  context: string,
): Promise<readonly (readonly unknown[])[]> {
  const label = `${context}: \`${argv.join(" ")}\``;
  const report = decodeOccurrencesReport(
    await runJson(product, workspace, argv, label),
    label,
  );
  assertSameJson(
    report.findings,
    [],
    `${label}: the valid workspace's answer carries no finding (SPEC 11.2, ` +
      `11.3)`,
  );
  return report.occurrences.map(occurrenceTuple);
}

// ---------------------------------------------------------------------------
// T4.5-10
// ---------------------------------------------------------------------------

// One spec group plus one code group (SPEC 7.2), emission disabled: the
// TypeScript files under `src/` are discovered code sources, so `build`
// analyzes their imports and markers (4, 4.5). A staged-source record (S-9's
// timing clause): every arm's workspace past the body's first is created
// after a product invocation.
const T4_5_10_CONFIG = stagedTs(
  "T4.5-10 xspec.config.ts — one spec group and one code group, every arm's workspace",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: {
    app: ["src/**/*.ts"]
  }
})
`,
);

// `specs/A.mdx`, `a` and its child `a.b`: every arm's spec source, holding
// the node every staged chain names. A staged-source record (S-9's timing
// clause).
const T4_5_10_SPEC_SOURCE = stagedMdx(
  "T4.5-10 specs/A.mdx — `a` and its child `a.b`, every arm's spec source",
  '<S id="a">\nAlpha behavior.\n<S id="a.b">\nBeta behavior.\n</S>\n</S>\n',
);

/**
 * The chain every marker of arms (a), (b), (c), and (f) spells, and the
 * node it names; arms (d), (e), (g), and (h) pin their own constructs.
 */
const T4_5_10_CHAIN = "A.a.b";
const T4_5_10_TARGET = "specs/A.mdx#a.b";

/** One T4.5-10 code source as staged: its path and TEST-SPEC's exact text. */
interface T4510Staging {
  /** The code source's workspace-relative path, under `src/`. */
  readonly file: string;
  /** What the file stages (record names and failure diagnostics). */
  readonly what: string;
  /** The file's exact text — pure ASCII, spelling `A.a.b` exactly once. */
  readonly text: string;
}

/**
 * A (b) file, whose chain the import roots: the code location its marker's
 * `references` edge comes from is the innermost enclosing named unit,
 * dot-joined under the file's path (`unit`), or the file itself where none
 * encloses the chain (`null`; SPEC 4.6).
 */
interface T4510RootedStaging extends T4510Staging {
  readonly unit: string | null;
}

/** A staging laid out at module load, its text a staged-source record. */
interface LaidOutT4510Staging<S extends T4510Staging> {
  readonly staging: S;
  readonly source: StagedTs;
}

/**
 * Lay out one staging: check that its text spells the chain exactly once,
 * throwing otherwise (a harness defect, never a product verdict), and
 * register its record. It registers a record, so it runs at module load
 * only (the tables below).
 */
function layOutT4510Staging<S extends T4510Staging>(
  arm: string,
  staging: S,
): LaidOutT4510Staging<S> {
  const at = staging.text.indexOf(T4_5_10_CHAIN);
  if (at === -1 || staging.text.lastIndexOf(T4_5_10_CHAIN) !== at) {
    throw new Error(
      `T4.5-10 fixture self-check: arm (${arm})'s ${staging.file} (` +
        `${staging.what}) must spell the chain \`${T4_5_10_CHAIN}\` exactly ` +
        `once (harness bug)`,
    );
  }
  return {
    staging,
    source: stagedTs(
      `T4.5-10 (${arm}) ${staging.file} — ${staging.what}`,
      staging.text,
    ),
  };
}

/** A rooted staging's code location: `path#unit`, or `path` (SPEC 4.6). */
function stagingLocation(staging: T4510RootedStaging): string {
  return staging.unit === null
    ? staging.file
    : `${staging.file}#${staging.unit}`;
}

// Arm (a), SPEC.md's example (4.5) as TEST-SPEC stages it: the marker after
// the block is rooted at the block-nested import, whose scope is `g`'s, not
// the block's.
const T4_5_10_A: LaidOutT4510Staging<T4510Staging> = layOutT4510Staging("a", {
  file: "src/g.ts",
  what: "SPEC.md's example, `A.a.b` after `g`'s block-nested import",
  text: 'function g() { { import A from "../specs/A.xspec"; } A.a.b; }\n',
});

/**
 * Arm (a)'s one occurrence record (SPEC 5.7) as a JSON-safe tuple, in the
 * order of `occurrenceTuple` (section-4.5.ts) — file, own range, kind,
 * source (identity and range), target — pinned from the exact bytes: the
 * bare chain `A.a.b`, its `;` excluded; its source the unit `g`, whose range
 * is the function declaration by its own characters, `function` through the
 * closing brace ending the file's one line (1.7).
 */
const T4_5_10_A_RECORD: readonly unknown[] = (() => {
  const { file, text } = T4_5_10_A.staging;
  const unitStart = text.indexOf("function g() {");
  const unitEnd = text.lastIndexOf("}") + 1;
  if (unitStart !== 0 || text.slice(unitEnd) !== "\n") {
    throw new Error(
      "T4.5-10 fixture self-check: arm (a)'s src/g.ts must be the one " +
        "declaration `function g() { … }` on a line of its own (harness bug)",
    );
  }
  const bytes = (slice: string): number => Buffer.byteLength(slice, "utf8");
  const chainStart = bytes(text.slice(0, text.indexOf(T4_5_10_CHAIN)));
  return [
    file,
    chainStart,
    chainStart + bytes(T4_5_10_CHAIN),
    "references",
    [
      `${file}#g`,
      bytes(text.slice(0, unitStart)),
      bytes(text.slice(0, unitEnd)),
    ],
    T4_5_10_TARGET,
  ];
})();

// Arm (b): each container 4.5 names, one file each, the chain following the
// import within it — a function's body, an arrow function's, a class
// method's, a class static block (which binds no unit: `path#C`, T4.6-1), a
// namespace and its legacy `module` spelling (the same declaration, 4.6),
// and a string-named module declaration (binding no unit: `path`, 4.6) —
// then an import inside a top-level `if` block and, separately, inside a
// bare block, binding in the file's scope (no function, class static block,
// or namespace or module declaration enclosing it; TypeScript 5.9.3's binder
// places each in the file's own symbol table), so that the chain after the
// block is rooted at it (`path`); and a chain preceding the import in a
// function's body, an import binding its identifier throughout its scope,
// never from its position onward (`path#g`). Every file is a script (no
// top-level import or export), the if-block and bare-block files among them
// on the arm's one workspace, each rooting its chain at its own import.
const T4_5_10_B: readonly LaidOutT4510Staging<T4510RootedStaging>[] = (
  [
    {
      file: "src/function.ts",
      what: "the chain after the import in a function's body",
      text: 'function g() { import A from "../specs/A.xspec"; A.a.b }',
      unit: "g",
    },
    {
      file: "src/arrow.ts",
      what: "the chain after a block-nested import in an arrow function's body",
      text: 'const h = () => { { import A from "../specs/A.xspec" } A.a.b }',
      unit: "h",
    },
    {
      file: "src/method.ts",
      what: "the chain after a block-nested import in a class method's body",
      text: 'class C { m() { { import A from "../specs/A.xspec" } A.a.b } }',
      unit: "C.m",
    },
    {
      file: "src/static-block.ts",
      what: "the chain after a block-nested import in a class static block",
      text: 'class C { static { { import A from "../specs/A.xspec" } A.a.b } }',
      unit: "C",
    },
    {
      file: "src/namespace.ts",
      what: "the chain after a block-nested import in a namespace body",
      text: 'namespace N { { import A from "../specs/A.xspec" } A.a.b }',
      unit: "N",
    },
    {
      file: "src/legacy-module.ts",
      what: "the chain after the import in a namespace spelled `module M`",
      text: 'module M { import A from "../specs/A.xspec"; A.a.b }',
      unit: "M",
    },
    {
      file: "src/module-declaration.ts",
      what: 'the chain after the import in a string-named `declare module "m"`',
      text: 'declare module "m" { import A from "../specs/A.xspec"; A.a.b }',
      unit: null,
    },
    {
      file: "src/if-block.ts",
      what: "the chain after a top-level `if` block holding the import",
      text: 'if (c) { import A from "../specs/A.xspec" }\nA.a.b\n',
      unit: null,
    },
    {
      file: "src/bare-block.ts",
      what: "the chain after a top-level bare block holding the import",
      text: '{ import A from "../specs/A.xspec" }\nA.a.b\n',
      unit: null,
    },
    {
      file: "src/preceding.ts",
      what: "the chain preceding the import in a function's body",
      text: 'function g() { A.a.b; import A from "../specs/A.xspec" }',
      unit: "g",
    },
  ] satisfies readonly T4510RootedStaging[]
).map((staging) => layOutT4510Staging("b", staging));

// Arm (c): the visibility boundary — the chain spelled where the import's
// scope does not reach, one file each: after the function whose body holds
// the import; in a sibling function; in a method of the class whose static
// block holds it; in a second declaration of the namespace whose first
// holds it (a namespace declaration's scope, never the merged namespace's);
// and after a string-named module declaration holding it, `declare` or not
// (4). No binding of `A` is visible at any of these chains, so each is
// rooted at nothing — no edge, no occurrence, and no finding, none being a
// spec module reference.
const T4_5_10_C: readonly LaidOutT4510Staging<T4510Staging>[] = (
  [
    {
      file: "src/after-function.ts",
      what: "the chain after the function whose body holds the import",
      text: 'function g() { import A from "../specs/A.xspec" }\nA.a.b\n',
    },
    {
      file: "src/sibling-function.ts",
      what: "the chain in a sibling of the function holding the import",
      text: 'function g() { import A from "../specs/A.xspec" }\nfunction h() { A.a.b }',
    },
    {
      file: "src/static-block-method.ts",
      what: "the chain in a method of the class whose static block holds the import",
      text: 'class C { static { import A from "../specs/A.xspec" } m() { A.a.b } }',
    },
    {
      file: "src/namespace-redeclared.ts",
      what: "the chain in a second declaration of the namespace whose first holds the import",
      text: 'namespace N { import A from "../specs/A.xspec" }\nnamespace N { A.a.b }',
    },
    {
      file: "src/after-module-declaration.ts",
      what: 'the chain after a string-named `declare module "m"` holding the import',
      text: 'declare module "m" { import A from "../specs/A.xspec" }\nA.a.b\n',
    },
    {
      file: "src/after-undeclared-module.ts",
      what: 'the chain after an undeclared string-named `module "m"` holding the import',
      text: 'module "m" { import A from "../specs/A.xspec" }\nA.a.b\n',
    },
  ] satisfies readonly T4510Staging[]
).map((staging) => layOutT4510Staging("c", staging));

/** A byte range of a staged text, start-inclusive, end-exclusive (SPEC 1.7). */
interface ByteRange {
  readonly start: number;
  readonly end: number;
}

/**
 * Where a construct stands among its spelling's occurrences in a staged
 * text: the text spells it exactly `count` times (default 1), the construct
 * being occurrence `nth` (0-based, in text order; default 0), and — where
 * TEST-SPEC pins the construct's range — that pin.
 */
interface ConstructPlacement {
  readonly count?: number;
  readonly nth?: number;
  readonly pinned?: ByteRange;
}

/**
 * The byte range of one construct of a staged text, computed from the exact
 * bytes (SPEC 1.7): occurrence `nth` (0-based, in text order) of `spelling`,
 * which the text must spell exactly `count` times, and — where TEST-SPEC
 * pins the construct's range — that pin checked against it. A mismatch is a
 * harness defect of `test`'s tables, thrown at module load, never a product
 * verdict.
 */
function constructRange(
  test: string,
  where: string,
  text: string,
  spelling: string,
  { count = 1, nth = 0, pinned }: ConstructPlacement = {},
): ByteRange {
  const indices: number[] = [];
  for (
    let at = text.indexOf(spelling);
    at !== -1;
    at = text.indexOf(spelling, at + 1)
  ) {
    indices.push(at);
  }
  const index = indices[nth];
  if (indices.length !== count || index === undefined) {
    throw new Error(
      `${test} fixture self-check: ${where} must spell \`${spelling}\` ` +
        `exactly ${String(count)} time(s), the pinned construct its ` +
        `occurrence #${String(nth + 1)}; the text spells it ` +
        `${String(indices.length)} time(s) (harness bug)`,
    );
  }
  const start = Buffer.byteLength(text.slice(0, index), "utf8");
  const range = { start, end: start + Buffer.byteLength(spelling, "utf8") };
  if (
    pinned !== undefined &&
    (pinned.start !== range.start || pinned.end !== range.end)
  ) {
    throw new Error(
      `${test} fixture self-check: ${where}'s \`${spelling}\` must lie at ` +
        `TEST-SPEC's [${String(pinned.start)}, ${String(pinned.end)}); the ` +
        `staged bytes place it at [${String(range.start)}, ` +
        `${String(range.end)}) (harness bug)`,
    );
  }
  return range;
}

/** `constructRange` for T4.5-10's tables (the tables below). */
function t4510ConstructRange(
  where: string,
  text: string,
  spelling: string,
  placement: ConstructPlacement = {},
): ByteRange {
  return constructRange("T4.5-10", where, text, spelling, placement);
}

/** Throw unless a staged text's structure `holds` (a harness defect). */
function t4510SelfCheck(holds: boolean, what: string): void {
  if (!holds) {
    throw new Error(`T4.5-10 fixture self-check: ${what} (harness bug)`);
  }
}

/** A whole-file code location's range: the entire file (SPEC 1.7). */
function t4510WholeFile(text: string): ByteRange {
  return { start: 0, end: Buffer.byteLength(text, "utf8") };
}

/** A finding location as a JSON-safe `[file, start, end]` tuple (12.7). */
function t4510Location(
  file: string,
  range: ByteRange,
): readonly [string, number, number] {
  return [file, range.start, range.end];
}

/**
 * One expected occurrence record (SPEC 5.7) as a JSON-safe tuple in the
 * order of `occurrenceTuple` (section-4.5.ts): file, own range, kind,
 * source (identity and range), target.
 */
function t4510Record(
  file: string,
  range: ByteRange,
  kind: "references" | "embeds",
  source: string,
  sourceRange: ByteRange,
  target: string,
): readonly unknown[] {
  return [
    file,
    range.start,
    range.end,
    kind,
    [source, sourceRange.start, sourceRange.end],
    target,
  ];
}

/**
 * The one finding a failing arm's workspace reports (arms (d), (e), and
 * (g)): its numbered condition and its locations as `[file, start, end]`
 * byte offsets, end-exclusive, in 12.7's within-finding order (file bytes,
 * then start, then end).
 */
interface T4510Finding {
  readonly condition: "14.15" | "14.18";
  readonly locations: readonly (readonly [string, number, number])[];
  /** What the finding is, and why nothing else is reported (diagnostics). */
  readonly why: string;
}

/**
 * A failing T4.5-10 staging, on a workspace of its own: its files, the code
 * source its `occurrences --file` names, the one finding `build`, `check`,
 * and `occurrences` report, and the complete record set `occurrences
 * --file` answers beside it, in occurrence order (SPEC 5.7).
 */
interface T4510FailingStaging {
  /** The arm, as TEST-SPEC keys it: `(d)`, `(e)`, or `(g)`. */
  readonly arm: string;
  /** What the arm stages (diagnostics). */
  readonly what: string;
  /** The code source the arm's `occurrences --file` names. */
  readonly file: string;
  /** Every staged file, the configuration excluded. */
  readonly files: Readonly<Record<string, InitialFileContents>>;
  readonly finding: T4510Finding;
  readonly records: readonly (readonly unknown[])[];
  /** What the records are, and why no other is listed (diagnostics). */
  readonly recordsWhy: string;
}

// Arm (d): the cross-scope pair — `src/x.ts`'s top-level import of
// `specs/B.mdx` and its import of `specs/A.mdx` nested in a block of `g`,
// both binding `A`, beside `specs/B.mdx` holding `a` and `a.b` too. The
// nested import roots `g`'s chains whether or not a top-level import binds
// `A` too, and 14.15 reports the two imports whatever scope each declares
// the identifier in (4.5): the one finding locates both declarations by
// their own characters (T14-11), and each chain records its occurrence,
// rooted at its own scope's import — the chain in `g` at the nested import,
// the top-level one at the top-level import.
const T4_5_10_D_FILE = "src/x.ts";
const T4_5_10_D_TEXT =
  'import A from "../specs/B.xspec"\nfunction g() {\n  { import A from "../specs/A.xspec" }\n  A.a.b\n}\nA.a.b\n';
const T4_5_10_D_SOURCE = stagedTs(
  "T4.5-10 (d) src/x.ts — `A` imported from B at top level and from A in a block of `g`, `A.a.b` in `g` and after it",
  T4_5_10_D_TEXT,
);
// `specs/B.mdx`, `a` and its child `a.b`: the top-level import's spec
// source, holding the node the top-level chain names. A staged-source
// record (S-9's timing clause).
const T4_5_10_D_B_SOURCE = stagedMdx(
  "T4.5-10 (d) specs/B.mdx — `a` and its child `a.b`, the top-level import's spec source",
  '<S id="a">\nAlpha behavior.\n<S id="a.b">\nBeta behavior.\n</S>\n</S>\n',
);
const T4_5_10_D: T4510FailingStaging = (() => {
  const where = "arm (d)'s src/x.ts";
  const text = T4_5_10_D_TEXT;
  const file = T4_5_10_D_FILE;
  const outer = t4510ConstructRange(
    where,
    text,
    'import A from "../specs/B.xspec"',
  );
  // The block-nested declaration's own characters, inside its braces.
  const inner = t4510ConstructRange(
    where,
    text,
    'import A from "../specs/A.xspec"',
  );
  // `g`'s range: the function declaration, `function` through its closing
  // brace (1.7).
  const unit = t4510ConstructRange(
    where,
    text,
    'function g() {\n  { import A from "../specs/A.xspec" }\n  A.a.b\n}',
  );
  const inG = t4510ConstructRange(where, text, "A.a.b", { count: 2 });
  const topLevel = t4510ConstructRange(where, text, "A.a.b", {
    count: 2,
    nth: 1,
  });
  t4510SelfCheck(
    inG.start > unit.start && inG.end < unit.end && topLevel.start > unit.end,
    `${where} must spell its first \`A.a.b\` inside \`g\` and its second ` +
      `after it`,
  );
  return {
    arm: "(d)",
    what:
      "src/x.ts's cross-scope pair, `A` imported from `specs/B.mdx` at top " +
      "level and from `specs/A.mdx` in a block of `g`",
    file,
    files: {
      "specs/A.mdx": T4_5_10_SPEC_SOURCE,
      "specs/B.mdx": T4_5_10_D_B_SOURCE,
      [file]: T4_5_10_D_SOURCE,
    },
    finding: {
      condition: "14.15",
      locations: [t4510Location(file, outer), t4510Location(file, inner)],
      why:
        "the top-level import and the import nested in `g` both bind `A`, " +
        "a pair 14.15 reports whatever scope each declares it in (SPEC " +
        "4.5, 14), located at both declarations by their own characters, " +
        "the block-nested one inside its braces, the braces excluded " +
        "(T14-11); and each chain resolves, rooted at its own scope's " +
        "import — no 14.7",
    },
    records: [
      t4510Record(file, inG, "references", `${file}#g`, unit, T4_5_10_TARGET),
      t4510Record(
        file,
        topLevel,
        "references",
        file,
        t4510WholeFile(text),
        "specs/B.mdx#a.b",
      ),
    ],
    recordsWhy:
      "exactly two records beside the finding, in occurrence order: the " +
      "marker in `g`, rooted at `g`'s nested import — targeting " +
      "`specs/A.mdx#a.b`, its source `src/x.ts#g` with the function " +
      "declaration's own range — and the top-level marker, rooted at the " +
      "top-level import — targeting `specs/B.mdx#a.b`, its source the whole " +
      "file `src/x.ts` (SPEC 4.5, 4.6, 5.7, 1.7, 11.2) — never both rooted " +
      "at the outer import, the inner record then targeting " +
      "`specs/B.mdx#a.b`, nor both at neither, a colliding identifier read " +
      "unresolved file-wide where 2.4 makes it so within one scope alone",
  };
})();

// Arm (e): the cross-scope pair whose nested import is no spec module
// import — `src/y.ts`'s top-level spec module import binding `SPEC` and
// `import { SPEC } from "./t"` in `g`'s body. 14.15 reports the pair,
// either import a spec module import, whatever scope each declares the
// identifier in; within `g` the identifier resolves to the non-spec binding
// (rooting is scope-aware, 4.5), so `SPEC.a` there is no spec module
// reference and records nothing, while the top-level chain is rooted at the
// spec module import.
const T4_5_10_E_FILE = "src/y.ts";
const T4_5_10_E_TEXT =
  'import SPEC from "../specs/A.xspec"\nexport function g() {\n  import { SPEC } from "./t"\n  SPEC.a\n}\nSPEC.a.b\n';
const T4_5_10_E_SOURCE = stagedTs(
  "T4.5-10 (e) src/y.ts — the spec module import of `SPEC` at top level, a non-spec `import { SPEC }` in `g`, `SPEC.a` in `g` and `SPEC.a.b` after it",
  T4_5_10_E_TEXT,
);
const T4_5_10_E: T4510FailingStaging = (() => {
  const where = "arm (e)'s src/y.ts";
  const text = T4_5_10_E_TEXT;
  const file = T4_5_10_E_FILE;
  const spec = t4510ConstructRange(
    where,
    text,
    'import SPEC from "../specs/A.xspec"',
  );
  const nonSpec = t4510ConstructRange(
    where,
    text,
    'import { SPEC } from "./t"',
  );
  const topLevel = t4510ConstructRange(where, text, "SPEC.a.b");
  t4510SelfCheck(
    text.endsWith("\n  SPEC.a\n}\nSPEC.a.b\n"),
    `${where} must spell \`SPEC.a\` as \`g\`'s last statement and ` +
      `\`SPEC.a.b\` on the file's last line, after \`g\``,
  );
  return {
    arm: "(e)",
    what:
      "src/y.ts's cross-scope pair, the spec module import of `SPEC` at " +
      "top level and a non-spec `import { SPEC }` in `g`",
    file,
    files: { "specs/A.mdx": T4_5_10_SPEC_SOURCE, [file]: T4_5_10_E_SOURCE },
    finding: {
      condition: "14.15",
      locations: [t4510Location(file, spec), t4510Location(file, nonSpec)],
      why:
        "the top-level spec module import and the non-spec import nested " +
        "in `g` both bind `SPEC`, either a spec module import, a pair 14.15 " +
        "reports whatever scope each declares it in (SPEC 4.5, 14), located " +
        "at both declarations by their own characters (T14-11); and no " +
        "chain is an unresolved spec module reference — no 14.7 — never " +
        "the silence of a product judging cross-scope collisions between " +
        "spec module imports alone",
    },
    records: [
      t4510Record(
        file,
        topLevel,
        "references",
        file,
        t4510WholeFile(text),
        T4_5_10_TARGET,
      ),
    ],
    recordsWhy:
      "exactly one record beside the finding: the top-level marker " +
      "`SPEC.a.b`, rooted at the spec module import — targeting " +
      "`specs/A.mdx#a.b`, its source the whole file `src/y.ts` — while " +
      "`SPEC.a` in `g` resolves to the non-spec binding and records nothing " +
      "(SPEC 4.5, 4.6, 5.7, 1.7, 11.2) — never a second record, targeting " +
      "`specs/A.mdx#a`, from a product rooting the inner chain at the outer " +
      "import",
  };
})();

// Arm (f): the file boundary — an import's scope is at widest its own
// file's. `src/p.ts` holds a bare block's import of `A` and `src/q.ts` the
// chain alone, each a script to TypeScript (no top-level import or export),
// whose checker would merge their file-level declarations into one global
// scope and resolve `q.ts`'s `A` to `p.ts`'s import: under 4.5 that import
// binds in `p.ts`'s scope alone, so `q.ts`'s chain is rooted at nothing.
const T4_5_10_F_IMPORTING_FILE = "src/p.ts";
const T4_5_10_F_IMPORTING_SOURCE = stagedTs(
  "T4.5-10 (f) src/p.ts — a script whose bare block holds the import of `A`",
  '{ import A from "../specs/A.xspec" }\n',
);
const T4_5_10_F: LaidOutT4510Staging<T4510Staging> = layOutT4510Staging("f", {
  file: "src/q.ts",
  what: "a script spelling the chain `A.a.b` alone",
  text: "A.a.b\n",
});

// Arm (g): the callee side of the visibility boundary — `src/c.ts`'s
// top-level spec module import binding `SPEC`, `g`'s body holding `import {
// text } from "../specs/A.xspec"`, and the top-level call `text(SPEC.a)`.
// The nested `text` binding is `g`'s, so no `text` binding is visible at
// the call, whose callee resolves to no declaration: it is no spec module's
// `text` call, and the node `SPEC.a` is passed to another function — 14.18
// at TEST-SPEC's [105, 111), and no `embeds` edge or occurrence (4.5, 5.7).
const T4_5_10_G_FILE = "src/c.ts";
const T4_5_10_G_CALL = "text(SPEC.a)";
const T4_5_10_G_TEXT =
  'import SPEC from "../specs/A.xspec"\nexport function g() { import { text } from "../specs/A.xspec" }\ntext(SPEC.a)\n';
const T4_5_10_G_SOURCE = stagedTs(
  "T4.5-10 (g) src/c.ts — the top-level `text(SPEC.a)` beside `g`'s nested import of `text`",
  T4_5_10_G_TEXT,
);
const T4_5_10_G: T4510FailingStaging = (() => {
  const where = "arm (g)'s src/c.ts";
  const text = T4_5_10_G_TEXT;
  const file = T4_5_10_G_FILE;
  const use = t4510ConstructRange(where, text, "SPEC.a", {
    pinned: { start: 105, end: 111 },
  });
  t4510ConstructRange(where, text, T4_5_10_G_CALL);
  t4510SelfCheck(
    text.endsWith(`}\n${T4_5_10_G_CALL}\n`),
    `${where} must spell the call \`${T4_5_10_G_CALL}\` on the file's last ` +
      `line, after \`g\``,
  );
  return {
    arm: "(g)",
    what:
      "src/c.ts's top-level `text(SPEC.a)` beside `g`'s nested import of " +
      "`text`",
    file,
    files: { "specs/A.mdx": T4_5_10_SPEC_SOURCE, [file]: T4_5_10_G_SOURCE },
    finding: {
      condition: "14.18",
      locations: [t4510Location(file, use)],
      why:
        "the nested `text` binding is `g`'s, so no `text` binding is " +
        "visible at the top-level call, whose callee resolves to no " +
        "declaration: no spec module's `text` call, the node `SPEC.a` " +
        "passed to another function (SPEC 4.5), located at `SPEC.a`, " +
        "[105, 111), the binding's identifier extended by the chain it " +
        "roots (14, T14-11) — no 14.7, 14.8, or 14.11, as from a product " +
        "resolving the callee through every `text` binding in the file, " +
        "nested ones included",
    },
    records: [],
    recordsWhy:
      "no record beside the finding — the call, whose callee no visible " +
      "`text` binding binds, records no `embeds` edge and no occurrence " +
      "(SPEC 4.5, 5.7, 11.2) — never the record of a product reading it as " +
      "A's `text` call",
  };
})();

// (g)'s twin, on a workspace of its own: the same file with `text("x")` in
// the call's place — no finding, never 14.8, the string argument being no
// spec module `text` call's (4.3); no edge from `src/c.ts`, and no record.
const T4_5_10_G_TWIN_TEXT = T4_5_10_G_TEXT.replace(T4_5_10_G_CALL, 'text("x")');
const T4_5_10_G_TWIN_SOURCE = stagedTs(
  'T4.5-10 (g) twin src/c.ts — the top-level `text("x")` beside `g`\'s nested import of `text`',
  T4_5_10_G_TWIN_TEXT,
);

// Arm (h): scopes nested within the import's own — `src/c.ts`'s `g` holding
// `import A, { text } from "../specs/A.xspec"`, the marker `A.a.b` in the
// arrow function `h` and the call `text(A.a)` in the function `k`, each in
// a scope nested within `g`'s where no declaration shadows `A` or `text`:
// both are rooted at `g`'s import, as TypeScript resolves an identifier
// through each enclosing scope outward (2.4, 4.5), each recording its edge
// from its own unit (4.6) and its occurrence, at TEST-SPEC's [87, 92) and
// [112, 121).
const T4_5_10_H_FILE = "src/c.ts";
const T4_5_10_H_TEXT =
  'export function g() {\n  import A, { text } from "../specs/A.xspec"\n  const h = () => { A.a.b }\n  function k() { text(A.a) }\n}\n';
const T4_5_10_H_SOURCE = stagedTs(
  "T4.5-10 (h) src/c.ts — `A.a.b` in the arrow function `h` and `text(A.a)` in the function `k`, both nested in `g` beside its import",
  T4_5_10_H_TEXT,
);
/** Arm (h)'s dependency edges and records, pinned from the bytes. */
const T4_5_10_H: {
  readonly edges: readonly GraphEdge[];
  readonly records: readonly (readonly unknown[])[];
} = (() => {
  const where = "arm (h)'s src/c.ts";
  const text = T4_5_10_H_TEXT;
  const file = T4_5_10_H_FILE;
  const marker = t4510ConstructRange(where, text, "A.a.b", {
    pinned: { start: 87, end: 92 },
  });
  const call = t4510ConstructRange(where, text, "text(A.a)", {
    pinned: { start: 112, end: 121 },
  });
  // `h`'s range: its declarator, the name through the initializer, the
  // `const` excluded (1.7: a function-valued variable declaration's unit);
  // `k`'s, the function declaration, `function` through its closing brace.
  const h = t4510ConstructRange(where, text, "h = () => { A.a.b }");
  const k = t4510ConstructRange(where, text, "function k() { text(A.a) }");
  return {
    edges: [
      { from: `${file}#g.h`, to: T4_5_10_TARGET, kind: "references" },
      { from: `${file}#g.k`, to: "specs/A.mdx#a", kind: "embeds" },
    ],
    records: [
      t4510Record(file, marker, "references", `${file}#g.h`, h, T4_5_10_TARGET),
      t4510Record(file, call, "embeds", `${file}#g.k`, k, "specs/A.mdx#a"),
    ],
  };
})();

/** The `files` of a workspace holding `specs/A.mdx` and the given stagings. */
function t4510Files(
  stagings: readonly LaidOutT4510Staging<T4510Staging>[],
): Record<string, InitialFileContents> {
  return {
    "specs/A.mdx": T4_5_10_SPEC_SOURCE,
    ...Object.fromEntries(
      stagings.map((laid) => [laid.staging.file, laid.source]),
    ),
  };
}

/**
 * Arm (a): SPEC.md's example builds and checks finding-free; the
 * workspace's one dependency edge is the marker's `references` edge from
 * `src/g.ts#g` to `specs/A.mdx#a.b`; and a bare `occurrences` answers
 * exactly the marker's record, its source `src/g.ts#g`.
 */
async function runT4510ArmA(product: ProductBinding): Promise<void> {
  await withWorkspace(T4_5_10_CONFIG, t4510Files([T4_5_10_A]), async (ws) => {
    const context = "T4.5-10 (a) over src/g.ts, SPEC.md's example";
    await expectCleanBuildAndCheck(
      product,
      ws,
      context,
      "the block-nested import declares `A` in `g`'s scope, so the chain " +
        "after the block is a marker rooted at it (SPEC 4.5)",
    );
    assertEdgeSetEqual(
      await queryDependencyEdges(product, ws, context),
      [{ from: "src/g.ts#g", to: T4_5_10_TARGET, kind: "references" }],
      `${context}: \`query edges\` — the marker's \`references\` edge from ` +
        `\`src/g.ts#g\`, the innermost enclosing named unit, to ` +
        `\`specs/A.mdx#a.b\` is the workspace's one dependency edge (SPEC ` +
        `4.5, 4.6) — never none, as from a product ignoring nested imports ` +
        `or scoping one to its block, which finds the marker rooted at nothing`,
    );
    assertSameJson(
      await validOccurrenceRecords(product, ws, ["occurrences"], context),
      [T4_5_10_A_RECORD],
      `${context}: \`occurrences\` lists exactly the marker's occurrence — ` +
        `spanning the bare chain \`A.a.b\`, its \`;\` excluded, kind ` +
        `\`references\`, its source \`src/g.ts#g\` with the unit's own range ` +
        `(\`function\` through the closing brace), its target ` +
        `\`specs/A.mdx#a.b\` (SPEC 5.7, 4.6, 1.7)`,
    );
  });
}

/**
 * Arm (b): the workspace holding every container's file builds and checks
 * finding-free, and its dependency edges are exactly one `references` edge
 * per file, from the location TEST-SPEC names to `specs/A.mdx#a.b`.
 */
async function runT4510ArmB(product: ProductBinding): Promise<void> {
  await withWorkspace(T4_5_10_CONFIG, t4510Files(T4_5_10_B), async (ws) => {
    const context =
      "T4.5-10 (b) over the chain beside its import in each container 4.5 " +
      "names, in top-level blocks, and before the import";
    await expectCleanBuildAndCheck(
      product,
      ws,
      context,
      "each import declares `A` in its own scope — the innermost function, " +
        "class static block, or namespace or module declaration enclosing " +
        "it, the file's where none does, never a block's — throughout that " +
        "scope, so each chain is a marker rooted at it (SPEC 4.5)",
    );
    assertEdgeSetEqual(
      await queryDependencyEdges(product, ws, context),
      T4_5_10_B.map(({ staging }) => ({
        from: stagingLocation(staging),
        to: T4_5_10_TARGET,
        kind: "references" as const,
      })),
      `${context}: \`query edges\` — each marker records its \`references\` ` +
        `edge to \`specs/A.mdx#a.b\` from its innermost enclosing named unit, ` +
        `or its file where none encloses it (a static block and a ` +
        `string-named module declaration binding no unit), and nothing else ` +
        `records one (SPEC 4.5, 4.6, T4.6-1): ` +
        T4_5_10_B.map(
          ({ staging }) => `${staging.what} → ${stagingLocation(staging)}`,
        ).join("; "),
    );
  });
}

/**
 * Arm (c): the workspace holding every boundary file builds and checks
 * finding-free, records no dependency edge, and `occurrences` answers no
 * record.
 */
async function runT4510ArmC(product: ProductBinding): Promise<void> {
  await withWorkspace(T4_5_10_CONFIG, t4510Files(T4_5_10_C), async (ws) => {
    const context =
      "T4.5-10 (c) over the chain spelled where the nested import's scope " +
      "does not reach";
    const visibility =
      "no binding of `A` is visible at any of the chains — a nested " +
      "import's scope is the declaration enclosing it, never the file's, a " +
      "sibling's, or a merged namespace's (SPEC 4.5) — so each is rooted at " +
      "nothing, no spec module reference: " +
      T4_5_10_C.map(({ staging }) => staging.what).join("; ");
    await expectCleanBuildAndCheck(
      product,
      ws,
      context,
      `${visibility} — never the unresolved spec module reference a ` +
        `product reading the chain as one reports`,
    );
    assertEdgeSetEqual(
      await queryDependencyEdges(product, ws, context),
      [],
      `${context}: \`query edges\` lists no dependency edge, none from any ` +
        `chain's location — ${visibility} — never the edges of a product ` +
        `rooting by name file-wide, or counting identifier-named namespace ` +
        `declarations alone among the containers`,
    );
    assertSameJson(
      await validOccurrenceRecords(product, ws, ["occurrences"], context),
      [],
      `${context}: \`occurrences\` lists no record — a chain rooted at ` +
        `nothing records no occurrence (SPEC 5.7, 11.2)`,
    );
  });
}

/**
 * Assert a failing arm's report carries exactly its one finding — the
 * expected condition and nothing beside it — concerning no path (SPEC
 * 12.7), its locations byte-exact in 12.7's within-finding order.
 */
function assertT4510Finding(
  findings: readonly Finding[],
  expected: T4510Finding,
  context: string,
): void {
  assertSameJson(
    findings.map((finding) => finding.condition ?? finding.code),
    [expected.condition],
    `${context}: exactly one finding, condition ${expected.condition}, and ` +
      `nothing beside it — ${expected.why}`,
  );
  const finding = findings[0]!;
  if (finding.path !== null) {
    fail(
      `${context}: a finding locating in source concerns no path — ` +
        `\`path\` is null for located conditions (SPEC 12.7, 14); got ` +
        `${renderPathValue(finding.path)} (message: ` +
        `${JSON.stringify(finding.message)})`,
    );
  }
  assertSameJson(
    locationTuples(finding),
    expected.locations,
    `${context}: the ${expected.condition} finding's locations as ` +
      `\`[file, start, end]\` byte offsets, end-exclusive, in 12.7's ` +
      `within-finding order (file bytes, then start, then end) — ` +
      `${expected.why}`,
  );
}

/**
 * A failing arm — (d), (e), or (g) — on a workspace of its own: `build
 * --json` and `check --json` each exit 1 with exactly the arm's one finding
 * — `check`'s nothing set aside (module header) — and `occurrences --file
 * <file>`, answering on the failing workspace (SPEC 11.2), exits 1 with
 * that finding beside exactly the arm's records (5.7, 11.3).
 */
async function runT4510FailingArm(
  product: ProductBinding,
  staging: T4510FailingStaging,
): Promise<void> {
  await withWorkspace(T4_5_10_CONFIG, staging.files, async (ws) => {
    const context = `T4.5-10 ${staging.arm} over ${staging.what}`;
    const buildContext = `${context}: \`build --json\``;
    assertT4510Finding(
      await buildFindings(product, ws, buildContext),
      staging.finding,
      buildContext,
    );
    const checkContext = `${context}: \`check --json\``;
    assertT4510Finding(
      await runFindingsReport(
        product,
        ws,
        ["check", "--json"],
        1,
        `${checkContext} — \`check\` performs all build validations and ` +
          `exits 1 on the findings (SPEC 12.2)`,
      ),
      staging.finding,
      checkContext,
    );
    const argv = ["occurrences", "--file", staging.file];
    const occContext = `${context}: \`${argv.join(" ")}\``;
    const report = decodeOccurrencesReport(
      parseJsonStdout(
        await expectExit(
          product,
          ws,
          argv,
          1,
          `${occContext} — the answer carries the domain's findings, so ` +
            `exit 1 with the full answer document (SPEC 11.2, 11.3)`,
        ),
        `${occContext} — a single JSON document is the only output form ` +
          `(SPEC 11)`,
      ),
      occContext,
    );
    assertT4510Finding(
      report.findings,
      staging.finding,
      `${occContext}: the code file's finding accompanies the answer (SPEC ` +
        `11.2, 11.3)`,
    );
    assertSameJson(
      report.occurrences.map(occurrenceTuple),
      staging.records,
      `${occContext}: ${staging.recordsWhy}`,
    );
  });
}

/**
 * Arm (f): the two scripts build and check finding-free, `query edges`
 * lists no edge from `src/q.ts`, and `occurrences --file src/q.ts` answers
 * no record.
 */
async function runT4510ArmF(product: ProductBinding): Promise<void> {
  const chainFile = T4_5_10_F.staging.file;
  await withWorkspace(
    T4_5_10_CONFIG,
    {
      ...t4510Files([T4_5_10_F]),
      [T4_5_10_F_IMPORTING_FILE]: T4_5_10_F_IMPORTING_SOURCE,
    },
    async (ws) => {
      const context =
        "T4.5-10 (f) over script src/q.ts's chain beside script src/p.ts's " +
        "bare-block import";
      const boundary =
        "an import's scope is at widest its own file's — `src/p.ts`'s " +
        "bare-block import binds in that file's scope alone (SPEC 4.5) — so " +
        "`src/q.ts`'s chain is rooted at nothing";
      await expectCleanBuildAndCheck(product, ws, context, boundary);
      assertEdgeSetEqual(
        (await queryDependencyEdges(product, ws, context)).filter(
          (edge) =>
            edge.from === chainFile || edge.from.startsWith(`${chainFile}#`),
        ),
        [],
        `${context}: \`query edges\` lists no edge from \`${chainFile}\` or ` +
          `a unit within it — ${boundary} — never the edge of a product ` +
          `rooting chains through a whole-program checker, which merges ` +
          `the two scripts' file-level declarations into one global scope`,
      );
      assertSameJson(
        await validOccurrenceRecords(
          product,
          ws,
          ["occurrences", "--file", chainFile],
          context,
        ),
        [],
        `${context}: \`occurrences --file ${chainFile}\` lists no record — ` +
          `a chain rooted at nothing records no occurrence (SPEC 5.7, 11.2)`,
      );
    },
  );
}

/**
 * Arm (g)'s twin, on a workspace of its own: `build` and `check` finding-
 * free; `query edges` no edge from `src/c.ts` or a unit within it; and
 * `occurrences --file src/c.ts` a finding-free answer listing no record.
 */
async function runT4510ArmGTwin(product: ProductBinding): Promise<void> {
  const file = T4_5_10_G_FILE;
  await withWorkspace(
    T4_5_10_CONFIG,
    { "specs/A.mdx": T4_5_10_SPEC_SOURCE, [file]: T4_5_10_G_TWIN_SOURCE },
    async (ws) => {
      const context =
        'T4.5-10 (g) twin over src/c.ts\'s top-level `text("x")` beside ' +
        "`g`'s nested import of `text`";
      const invisible =
        "the nested `text` binding is `g`'s, so no `text` binding is " +
        "visible at the top-level call, no spec module's `text` call, its " +
        "string argument no such call's (SPEC 4.3, 4.5)";
      await expectCleanBuildAndCheck(
        product,
        ws,
        context,
        `${invisible} — never the 14.8 of a product resolving a callee ` +
          `through every \`text\` binding in the file, nested ones included`,
      );
      assertEdgeSetEqual(
        (await queryDependencyEdges(product, ws, context)).filter(
          (edge) => edge.from === file || edge.from.startsWith(`${file}#`),
        ),
        [],
        `${context}: \`query edges\` lists no edge from \`${file}\` or a ` +
          `unit within it — ${invisible}`,
      );
      assertSameJson(
        await validOccurrenceRecords(
          product,
          ws,
          ["occurrences", "--file", file],
          context,
        ),
        [],
        `${context}: \`occurrences --file ${file}\` lists no record — the ` +
          `call records no occurrence (SPEC 5.7, 11.3)`,
      );
    },
  );
}

/**
 * Arm (h), on a workspace of its own: `build` and `check` finding-free; the
 * dependency edges exactly the marker's `references` edge from
 * `src/c.ts#g.h` and the call's `embeds` edge from `src/c.ts#g.k`; and
 * `occurrences --file src/c.ts` exactly their two records.
 */
async function runT4510ArmH(product: ProductBinding): Promise<void> {
  const file = T4_5_10_H_FILE;
  await withWorkspace(
    T4_5_10_CONFIG,
    { "specs/A.mdx": T4_5_10_SPEC_SOURCE, [file]: T4_5_10_H_SOURCE },
    async (ws) => {
      const context =
        "T4.5-10 (h) over src/c.ts's `A.a.b` in the arrow function `h` and " +
        "`text(A.a)` in the function `k`, both nested in `g` beside its " +
        "import";
      await expectCleanBuildAndCheck(
        product,
        ws,
        context,
        "an identifier resolves through each enclosing scope outward, so " +
          "the marker in `h` and the call in `k`, each in a scope nested " +
          "within `g`'s where no declaration shadows `A` or `text`, are " +
          "rooted at `g`'s import (SPEC 2.4, 4.5)",
      );
      assertEdgeSetEqual(
        await queryDependencyEdges(product, ws, context),
        T4_5_10_H.edges,
        `${context}: \`query edges\` — the marker's \`references\` edge ` +
          `from \`src/c.ts#g.h\` to \`specs/A.mdx#a.b\` and the call's ` +
          `\`embeds\` edge from \`src/c.ts#g.k\` to \`specs/A.mdx#a\`, each ` +
          `from its innermost enclosing named unit, are the workspace's ` +
          `dependency edges (SPEC 4.3, 4.5, 4.6) — never none, as from a ` +
          `product matching a nested import only against the innermost ` +
          `function, class static block, or namespace or module ` +
          `declaration enclosing the spelling, never walking outward`,
      );
      assertSameJson(
        await validOccurrenceRecords(
          product,
          ws,
          ["occurrences", "--file", file],
          context,
        ),
        T4_5_10_H.records,
        `${context}: \`occurrences --file ${file}\` lists exactly two ` +
          `records — the marker spanning \`A.a.b\`, [87, 92), kind ` +
          `\`references\`, its source \`src/c.ts#g.h\` with its ` +
          `declarator's range, \`h\` through the initializer, and the call ` +
          `spanning \`text(A.a)\`, [112, 121), kind \`embeds\`, its source ` +
          `\`src/c.ts#g.k\` with the function declaration's range, each ` +
          `targeting the node it names (SPEC 5.7, 4.6, 1.7)`,
      );
    },
  );
}

/**
 * T4.5-10's arm workspaces in TEST-SPEC's order, each arm's on a workspace
 * of its own, (g)'s two stagings one each.
 */
const T4_5_10_ARMS: readonly {
  readonly key: string;
  readonly run: (product: ProductBinding) => Promise<void>;
}[] = [
  { key: "(a)", run: runT4510ArmA },
  { key: "(b)", run: runT4510ArmB },
  { key: "(c)", run: runT4510ArmC },
  { key: "(d)", run: (product) => runT4510FailingArm(product, T4_5_10_D) },
  { key: "(e)", run: (product) => runT4510FailingArm(product, T4_5_10_E) },
  { key: "(f)", run: runT4510ArmF },
  { key: "(g)", run: (product) => runT4510FailingArm(product, T4_5_10_G) },
  { key: "(g) twin", run: runT4510ArmGTwin },
  { key: "(h)", run: runT4510ArmH },
];

/**
 * T4.5-10, nested import declarations' scope and rooting (SPEC 4.5): an
 * import declaration declares its bindings in its own scope — the file's at
 * top level, and for a nested one that of the innermost function, class
 * static block, or namespace or module declaration enclosing it, never a
 * block's — throughout that scope and the scopes nested in it, and a chain
 * rooted at it records its edge from its innermost enclosing unit (4.6) and
 * its occurrence (5.7). Arms (a) through (h), each on a workspace of its
 * own ((g)'s two stagings one each) beside `specs/A.mdx` holding `a` and
 * `a.b`, every file S-9 well-formed and none compiled (module header): (a)
 * SPEC.md's example roots its marker at the block-nested import, `g`'s edge
 * and record; (b) each container's chain, the top-level blocks' (scripts
 * sharing the workspace, each rooted at its own import), and a chain
 * preceding its import record their edges from the locations TEST-SPEC
 * names; (c) a chain where the import's scope does not reach records
 * nothing and raises nothing; (d) a top-level import and a block-nested one
 * binding one identifier collide (14.15, both declarations located), each
 * still rooting its own scope's chain — two records, one per spec source;
 * (e) a nested non-spec import collides with the top-level spec module
 * import alike, the chain in its scope recording nothing and the top-level
 * one its record; (f) a script's chain beside another script's
 * block-nested import records nothing; (g) a nested `text` binding is
 * invisible at a top-level call, which passes its node to another function
 * (14.18 at [105, 111), no record), its `text("x")` twin raising nothing;
 * (h) a marker and a call in scopes nested within the import's own are
 * rooted at it, their edges from `src/c.ts#g.h` and `src/c.ts#g.k` and
 * their records pinned. Every arm workspace runs, the diagnosed failures
 * collected.
 */
const T4_5_10 = defineProductTest({
  id: "T4.5-10",
  title:
    "nested import declarations: scope and rooting — an import declares its bindings in its own scope, the file's at top level and a nested one's that of the innermost function, class static block, or namespace or module declaration enclosing it, never a block's, throughout that scope and the scopes nested in it; every file S-9 well-formed and none compiled, each arm on a workspace of its own ((g)'s two stagings one each) beside `specs/A.mdx` holding `a` and its child `a.b`, `build` and `check` exiting 0 with no finding on each but (d), (e), and (g): (a) SPEC.md's example, `src/g.ts` = `function g() { { import A from \"../specs/A.xspec\"; } A.a.b; }`, `query edges` holding exactly the marker's `references` edge from `src/g.ts#g` to `specs/A.mdx#a.b` and `occurrences` exactly its record spanning `A.a.b`, its source `src/g.ts#g` with the unit's own range; (b) the chain after the import in a function's body (`path#g`), after a block-nested import in an arrow function (`path#h`), a class method (`path#C.m`), a class static block (`path#C`), and a namespace (`path#N`), after the import in the legacy `module M` (`path#M`) and in `declare module \"m\"` (`path`), after a top-level `if` block and a bare block holding the import (scripts, each rooted at its own import, `path`), and before the import in a function's body (`path#g`) — `query edges` holding exactly each marker's `references` edge to `specs/A.mdx#a.b` from the location named; (c) the chain after the function holding the import, in a sibling function, in a method of the class whose static block holds it, in a second declaration of the namespace, and after a string-named module declaration holding it, `declare` or not — rooted at nothing: no dependency edge and no occurrence; (d) the cross-scope pair, `src/x.ts`'s top-level `import A from \"../specs/B.xspec\"` (`specs/B.mdx` holding `a` and `a.b` too) and `import A from \"../specs/A.xspec\"` in a block of `g`, `A.a.b` in `g` and after it — `build` and `check` exit 1 with exactly the 14.15 locating both declarations by their own characters, [0, 32) and [52, 84), and `occurrences --file src/x.ts` exactly two records beside it, `g`'s marker targeting `specs/A.mdx#a.b` from `src/x.ts#g` and the top-level one `specs/B.mdx#a.b` from `src/x.ts`; (e) the pair whose nested import is no spec module import, `src/y.ts`'s top-level `import SPEC from \"../specs/A.xspec\"` and `import { SPEC } from \"./t\"` in `g` — exactly the 14.15 at [0, 35) and [60, 86), exit 1, and `occurrences --file src/y.ts` exactly the top-level `SPEC.a.b`'s record, targeting `specs/A.mdx#a.b` from `src/y.ts`; (f) script `src/q.ts`'s `A.a.b` beside script `src/p.ts`'s bare-block import — no edge from `src/q.ts` and no record in `occurrences --file src/q.ts`; (g) the callee side, a top-level `text(SPEC.a)` beside `g`'s nested `import { text }` — exactly one finding, 14.18 at `SPEC.a`, [105, 111), exit 1, and no record in `occurrences --file src/c.ts` — and its twin, `text(\"x\")` in the call's place, no finding, exit 0, no edge from `src/c.ts` and no record; (h) `A.a.b` in the arrow function `h` and `text(A.a)` in the function `k`, both nested in `g` beside its `import A, { text }` — `query edges` holding exactly the `references` edge from `src/c.ts#g.h` to `specs/A.mdx#a.b` and the `embeds` edge from `src/c.ts#g.k` to `specs/A.mdx#a`, and `occurrences --file src/c.ts` exactly their records at [87, 92) and [112, 121); every finding's locations byte-exact and every record's every datum pinned from the bytes; never the silence of a product ignoring nested imports, scoping one to its block, binding one from its position onward, or matching it only against the innermost scope, nor the edges of one rooting by name file-wide or through a whole-program checker, nor the records of one rooting a cross-scope pair's chains at the outer import, nor the silence of one judging cross-scope collisions between spec module imports alone, nor the record or 14.8 of one resolving a callee through every `text` binding in the file (SPEC 4.5, 1.7, 2.4, 4.3, 4.6, 5.7, 11.2, 11.3, 14)",
  run: async (product) => {
    const failures: string[] = [];
    for (const arm of T4_5_10_ARMS) {
      try {
        await arm.run(product);
      } catch (error) {
        if (!(error instanceof HarnessAssertionError)) throw error;
        // A failure diagnosed outside the arm's own assertions — the
        // subprocess driver's, say — is named by its arm too.
        const context = `T4.5-10 ${arm.key}`;
        failures.push(
          error.message.startsWith(context)
            ? error.message
            : `${context}: ${error.message}`,
        );
      }
    }
    if (failures.length > 0) {
      fail(
        `T4.5-10: ${String(failures.length)} of ` +
          `${String(T4_5_10_ARMS.length)} arm workspaces failed, each ` +
          `diagnosed:\n` +
          failures.map((failure) => `* ${failure}`).join("\n"),
      );
    }
  },
});

// ---------------------------------------------------------------------------
// T4.5-11
// ---------------------------------------------------------------------------

// SPEC 2.4, 4.5, 14.15: a spec module import's binding collides with another
// import, or — the binding being value-level (4) — with a value-level
// non-import declaration, of the import's own scope: for a nested import,
// that of the innermost function, class static block, or namespace or
// module declaration enclosing it, a function's scope holding its
// parameters too (2.4), while a declaration of an inner scope — a block's,
// a catch clause's — shadows the binding instead. A chain rooted at a
// colliding identifier names no target — no edge, no occurrence (5.7) — and
// is an unresolved reference (14.7); the condition-15 finding locates every
// colliding declaration (14, T14-11): an import declaration by its own
// characters, a variable declarator by its own characters — its name or
// binding pattern through its initializer, the enclosing statement excluded
// — and a parameter, function, or class declaration by its own characters,
// its decorators and modifiers included.
//
// T4.5-11's conservative operationalizations (noted per H-4 — wording is
// free, so only the stated observables are asserted):
// - Each staging is a workspace of its own (H-1) holding exactly the files
//   TEST-SPEC names: `T4_5_11_CONFIG` (one spec group, one code group,
//   emission disabled, as T4.5-10's), `specs/A.mdx` and `specs/B.mdx` — one
//   staged-source record at both paths — each holding the sibling sections
//   `a` and `b`, so that either module's binding alone would resolve every
//   chain, and the code source `src/c.ts`, TEST-SPEC's text exactly: the
//   lines it lists, each ended by U+000A, no declaration spelling a `;`.
//   Every file is a staged-source record (S-9's timing clause: every
//   staging's workspace past the body's first is created after a product
//   invocation), each code text accepted by TypeScript 5.9.3 both as module
//   code and as script code (S-9's judge), and none is compiled under H-2's
//   channel: TypeScript's checker rejects a nested import declaration after
//   parsing (T4.5-10), so each staging observes xspec's surfaces alone.
// - A failing staging — (a)'s five parameter forms, (b)'s three body
//   declarations and its inner block's `var` — runs `build --json` and
//   `check --json`, each exiting 1 with exactly the staging's findings, the
//   complete set in 12.7's order: condition 7 per unresolved spelling,
//   located at the span its occurrence would occupy (14, 5.7) — the
//   marker's bare chain, a `text(...)` call callee through closing
//   parenthesis — then the one condition-15 finding locating the colliding
//   declaration and the import, each by its own characters (the import,
//   spelling no `;`, ending at its closing quote), in 12.7's within-finding
//   order (file bytes, then start, then end); every finding concerns no
//   path. `check`'s nothing set aside (T4.5-10's reading of 14.10, the
//   module header). `query edges` is gated on a failing workspace (13.3) and
//   is not made: `occurrences --file src/c.ts`, answering on it (11.2),
//   exits 1 with the same findings beside no record — TEST-SPEC's "no edge
//   and no occurrence".
// - A valid staging — (a)'s contrast, and (b)'s contrast and catch clause —
//   runs `build --json` and `check --json`, each exactly `{"findings": []}`
//   (exit 0), then `query edges`, its dependency edges (the spec sources'
//   structural `contains` edges set aside, 5.2) compared with exactly the
//   one edge TEST-SPEC names: `src/c.ts` holds every spelling, so "`SPEC.a`
//   recording no edge" is that set's.
// - Every construct a finding locates is found in the staged bytes at
//   module load, its spelling occurring exactly once in the text, and each
//   staging's expected findings, and each finding's locations, are checked
//   to stand in 12.7's order — a mismatch a harness defect thrown at load,
//   never a product verdict.
// - Every staging runs; each one's diagnosed failure is collected and the
//   body fails once at the end, naming every staging that failed (T4.5-10's
//   discipline), so one product failure hides no other staging's verdict. A
//   harness error — anything but a diagnosed assertion failure, a hang
//   included — propagates at once.

// One spec group plus one code group (SPEC 7.2), emission disabled, as
// T4.5-10's: the TypeScript files under `src/` are discovered code sources,
// so `build` analyzes their imports and markers (4, 4.5). A staged-source
// record (S-9's timing clause).
const T4_5_11_CONFIG = stagedTs(
  "T4.5-11 xspec.config.ts — one spec group and one code group, every staging's workspace",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: {
    app: ["src/**/*.ts"]
  }
})
`,
);

// `specs/A.mdx` and `specs/B.mdx`, each the sibling sections `a` and `b` —
// one staged-source record staged at both paths (S-9's timing clause) — so
// that either module's binding alone would resolve every staged chain, and
// a colliding staging's chains are unresolved for the collision alone.
const T4_5_11_SPEC_SOURCE = stagedMdx(
  "T4.5-11 specs/A.mdx and specs/B.mdx — sibling sections `a` and `b`, every staging's two spec sources",
  '<S id="a">\nAlpha behavior.\n</S>\n\n<S id="b">\nBeta behavior.\n</S>\n',
);

/** Every staging's code source. */
const T4_5_11_FILE = "src/c.ts";

/**
 * The import every colliding (a) and (b) staging nests in its function's,
 * or constructor's, body or a block of it — spelled without `;`, so its own
 * characters end at its closing quote.
 */
const T4_5_11_IMPORT = 'import SPEC from "../specs/A.xspec"';

/** The marker-shaped chain every (a) and (b) staging spells once. */
const T4_5_11_MARKER = "SPEC.a";

/** A code text: `lines`, each ended by U+000A (TEST-SPEC's spelling). */
function t4511Text(...lines: readonly string[]): string {
  return lines.map((line) => `${line}\n`).join("");
}

/**
 * One parameter form T4.5-11 (a) stages colliding with the import nested in
 * its function's or constructor's body (SPEC 2.4: a function's scope holds
 * its parameters). Exported for T14-11's colliding-parameter arm
 * (section-14.ts), which restages these texts.
 */
export interface CollidingParameterForm {
  /** What the form is (record names and diagnostics). */
  readonly name: string;
  /**
   * T4.5-11 (a)'s `src/c.ts` for the form, exactly — TEST-SPEC's lines,
   * each ended by U+000A: the function or constructor whose body holds
   * `import SPEC from "../specs/A.xspec"` (no `;`) and the marker `SPEC.a`.
   */
  readonly text: string;
  /**
   * The `function` or `constructor` line declaring the parameter: exactly
   * one line of `text`, its indentation included.
   */
  readonly line: string;
  /**
   * The parameter's located characters (SPEC 14: a parameter by its own
   * characters, its decorators and modifiers included — its initializer,
   * `...`, and binding pattern too), spelled exactly once in `line` and in
   * `text`.
   */
  readonly construct: string;
  /**
   * The spellings of `text` the colliding identifier roots, in text order,
   * each an unresolved reference (14.7) located at the span its occurrence
   * would occupy (14, 5.7) — the marker's bare chain, a `text(...)` call
   * callee through closing parenthesis — and each spelled exactly once in
   * `text`.
   */
  readonly chains: readonly string[];
}

/**
 * T4.5-11 (a)'s five colliding parameter forms, in TEST-SPEC's order: a name
 * with a type annotation (the staging that also calls the top-level
 * `text`), a constructor parameter property located from its `@`, and a
 * parameter spelled beyond a name and a type annotation — an initializer, a
 * rest parameter, and a binding pattern, each whole.
 */
export const T4_5_11_COLLIDING_PARAMETER_FORMS: Readonly<
  Record<
    "annotated" | "property" | "initializer" | "rest" | "pattern",
    CollidingParameterForm
  >
> = {
  annotated: {
    name: "the parameter `SPEC: number` of `g`, `SPEC.a` and `text(SPEC.b)` in its body beside the top-level `import { text }`",
    text: t4511Text(
      'import { text } from "../specs/A.xspec"',
      "export function g(SPEC: number) {",
      '  import SPEC from "../specs/A.xspec"',
      "  SPEC.a",
      "  text(SPEC.b)",
      "}",
    ),
    line: "export function g(SPEC: number) {",
    construct: "SPEC: number",
    chains: [T4_5_11_MARKER, "text(SPEC.b)"],
  },
  property: {
    name: "the constructor parameter property `@dec private readonly SPEC: number` of `C`, `SPEC.a` in the constructor's body",
    text: t4511Text(
      "export class C {",
      "  constructor(@dec private readonly SPEC: number) {",
      '    import SPEC from "../specs/A.xspec"',
      "    SPEC.a",
      "  }",
      "}",
    ),
    line: "  constructor(@dec private readonly SPEC: number) {",
    construct: "@dec private readonly SPEC: number",
    chains: [T4_5_11_MARKER],
  },
  initializer: {
    name: "the parameter `SPEC = 1` of `g`, `SPEC.a` in its body",
    text: t4511Text(
      "export function g(SPEC = 1) {",
      '  import SPEC from "../specs/A.xspec"',
      "  SPEC.a",
      "}",
    ),
    line: "export function g(SPEC = 1) {",
    construct: "SPEC = 1",
    chains: [T4_5_11_MARKER],
  },
  rest: {
    name: "the rest parameter `...SPEC: number[]` of `g`, `SPEC.a` in its body",
    text: t4511Text(
      "export function g(...SPEC: number[]) {",
      '  import SPEC from "../specs/A.xspec"',
      "  SPEC.a",
      "}",
    ),
    line: "export function g(...SPEC: number[]) {",
    construct: "...SPEC: number[]",
    chains: [T4_5_11_MARKER],
  },
  pattern: {
    name: "the binding-pattern parameter `{ SPEC }` of `g`, `SPEC.a` in its body",
    text: t4511Text(
      "export function g({ SPEC }) {",
      '  import SPEC from "../specs/A.xspec"',
      "  SPEC.a",
      "}",
    ),
    line: "export function g({ SPEC }) {",
    construct: "{ SPEC }",
    chains: [T4_5_11_MARKER],
  },
};

// The forms' module-load self-check (a mismatch is a harness defect — fix
// the table — never a product verdict): each `line` exactly one line of its
// `text`, its `construct` spelled once in the line and once in the text,
// and the text holding the nested import and every chain once each.
for (const [key, form] of Object.entries(T4_5_11_COLLIDING_PARAMETER_FORMS)) {
  const lines = form.text.split("\n");
  const once = (haystack: string, needle: string): boolean =>
    haystack.includes(needle) &&
    haystack.indexOf(needle) === haystack.lastIndexOf(needle);
  if (
    !form.text.endsWith("\n") ||
    lines.filter((line) => line === form.line).length !== 1 ||
    !once(form.line, form.construct) ||
    !once(form.text, form.construct) ||
    !once(form.text, T4_5_11_IMPORT) ||
    form.chains.some((chain) => !once(form.text, chain))
  ) {
    throw new Error(
      `T4.5-11 fixture self-check: the ${key} parameter form must hold its ` +
        `line once, its construct \`${form.construct}\` once in the line and ` +
        `in the text, and the nested import and each chain once in a text ` +
        `ending in U+000A — fix T4_5_11_COLLIDING_PARAMETER_FORMS (harness ` +
        `bug)`,
    );
  }
}

/**
 * One finding a failing T4.5-11 staging reports: its numbered condition and
 * the constructs it locates, each spelled exactly once in the staged text,
 * listed in 12.7's within-finding order (one file: start, then end).
 */
interface T4511Finding {
  readonly condition: "14.7" | "14.15";
  readonly at: readonly string[];
}

/** One T4.5-11 staging: `src/c.ts` and the outcome TEST-SPEC gives it. */
interface T4511Staging {
  /** The staging's key, its arm first: `(a) …` or `(b) …` (diagnostics). */
  readonly key: string;
  /** What the staging stages (its record's name and diagnostics). */
  readonly what: string;
  /** `src/c.ts`, TEST-SPEC's text exactly. */
  readonly text: string;
  /**
   * Why the outcome is what it is, and what a product failing the staging
   * reports instead (diagnostics).
   */
  readonly why: string;
  /**
   * A failing staging's findings, in 12.7's order (numbered conditions in
   * numeric order, then by locations); or a valid staging's dependency
   * edges, the complete set `query edges` answers beside the spec sources'
   * `contains` edges.
   */
  readonly outcome:
    | { readonly kind: "failing"; readonly findings: readonly T4511Finding[] }
    | { readonly kind: "valid"; readonly edges: readonly GraphEdge[] };
}

// Arm (a): a parameter collides with an import nested in its function's —
// or constructor's — body, a function's scope holding its parameters (2.4):
// the five forms of `T4_5_11_COLLIDING_PARAMETER_FORMS`, each reporting
// 14.15 at the parameter and the import and 14.7 for each chain the
// colliding identifier roots (the annotated form's `text(SPEC.b)` among
// them, its callee the top-level `text`); and the contrast, the same
// parameter beside a top-level import, which it shadows (a declaration of
// an inner scope, 2.4): no finding, `SPEC.a` rooted at the parameter and
// recording no edge (T4.5-4's outcome), the top-level `SPEC.b` its
// `references` edge from the file.
const T4_5_11_A_MISLOCATIONS: Readonly<
  Record<keyof typeof T4_5_11_COLLIDING_PARAMETER_FORMS, string>
> = {
  annotated: "",
  property:
    ", nor the range of one starting the parameter at its name, its " +
    "decorator and modifiers excluded",
  initializer:
    ", nor the range of one ending the parameter at its name, its " +
    "initializer excluded",
  rest:
    ", nor the range of one starting the parameter at its name, its `...` " +
    "excluded",
  pattern: ", nor the range of one locating the pattern's element `SPEC` alone",
};
const T4_5_11_A: readonly T4511Staging[] = [
  ...(["annotated", "property", "initializer", "rest", "pattern"] as const).map(
    (formKey): T4511Staging => {
      const form = T4_5_11_COLLIDING_PARAMETER_FORMS[formKey];
      return {
        key: `(a) \`${form.construct}\``,
        what: form.name,
        text: form.text,
        why:
          `a function's scope holds its parameters (SPEC 2.4), so the ` +
          `parameter \`${form.construct}\` and the import nested in its ` +
          `body bind \`SPEC\` in one scope — the 14.15 locating the ` +
          `parameter whole, by its own characters, and the import (14, ` +
          `T14-11) — and each chain \`SPEC\` roots there is unresolved ` +
          `(14.7)` +
          (form.chains.length > 1
            ? `, the call's among them: its callee the top-level \`text\`, ` +
              `its argument rooted at the colliding identifier`
            : "") +
          ` — never the silence of a product ignoring parameters, which ` +
          `roots the chains at the nested import, records their ` +
          `occurrences, and exits 0` +
          T4_5_11_A_MISLOCATIONS[formKey],
        outcome: {
          kind: "failing",
          findings: [
            ...form.chains.map((chain): T4511Finding => ({
              condition: "14.7",
              at: [chain],
            })),
            { condition: "14.15", at: [form.construct, T4_5_11_IMPORT] },
          ],
        },
      };
    },
  ),
  {
    key: "(a) contrast",
    what: "the parameter `SPEC: number` of `g` beside the top-level `import SPEC`, `SPEC.a` in `g` and `SPEC.b` after it",
    text: t4511Text(
      'import SPEC from "../specs/A.xspec"',
      "export function g(SPEC: number) {",
      "  SPEC.a",
      "}",
      "SPEC.b",
    ),
    why:
      "the parameter, a declaration of `g`'s scope — inner to the file's — " +
      "shadows the top-level import instead of colliding with it (SPEC " +
      "2.4, 4.5): `SPEC.a` is rooted at the parameter, recording no edge " +
      "(T4.5-4's outcome), and `SPEC.b` at the import, recording its " +
      "`references` edge from the file (4.6) — never the 14.15 of a product " +
      "reading every same-named parameter as a collision",
    outcome: {
      kind: "valid",
      edges: [{ from: T4_5_11_FILE, to: "specs/A.mdx#b", kind: "references" }],
    },
  },
];

// Arm (b): a declaration of the function's own body collides with the
// block-nested import, which declares its binding in the function's scope,
// never the block's (4.5) — a `const` declarator, a function declaration,
// a class declaration — and so does a `var` in an inner block, which the
// language declares in the enclosing function's scope (TypeScript 5.9.3's
// binder declaring it and the import in `g`'s one scope); the contrasts —
// a declaration in the inner block holding the import, the block's, and a
// catch clause's parameter, the catch clause's — shadow instead: no
// finding, the chain each roots recording no edge, and `SPEC.b`, rooted at
// the import, recording its `references` edge from `src/c.ts#g`.
const T4_5_11_B_BODY_DECLARATIONS: readonly {
  readonly statement: string;
  readonly construct: string;
  readonly what: string;
}[] = [
  {
    statement: "const SPEC = 1",
    construct: "SPEC = 1",
    what: "the declarator `SPEC = 1`, the `const` excluded",
  },
  {
    statement: "function SPEC() {}",
    construct: "function SPEC() {}",
    what: "the function declaration by its own characters",
  },
  {
    statement: "class SPEC {}",
    construct: "class SPEC {}",
    what: "the class declaration by its own characters",
  },
];
const T4_5_11_B: readonly T4511Staging[] = [
  ...T4_5_11_B_BODY_DECLARATIONS.map(
    ({ statement, construct, what }): T4511Staging => ({
      key: `(b) \`${statement}\``,
      what: `\`${statement}\` in \`g\`'s body beside the import nested in a block of \`g\`, \`SPEC.a\` after the block`,
      text: t4511Text(
        "export function g() {",
        `  ${statement}`,
        "  {",
        '    import SPEC from "../specs/A.xspec"',
        "  }",
        "  SPEC.a",
        "}",
      ),
      why:
        `the block-nested import declares its binding in \`g\`'s scope ` +
        `(SPEC 4.5: never a block's), where \`${statement}\` stands, so ` +
        `both bind \`SPEC\` in one scope — the 14.15 locating ${what} and ` +
        `the import (14, 1.7, T14-11) — and \`SPEC.a\` is unresolved ` +
        `(14.7) — never the silence of a product scoping imports to ` +
        `blocks, which finds \`SPEC.a\` rooted at the local`,
      outcome: {
        kind: "failing",
        findings: [
          { condition: "14.7", at: [T4_5_11_MARKER] },
          { condition: "14.15", at: [construct, T4_5_11_IMPORT] },
        ],
      },
    }),
  ),
  {
    key: "(b) inner block's `var SPEC = 1`",
    what: "`var SPEC = 1` in an inner block of `g` beside `g`'s import, `SPEC.a` after it",
    text: t4511Text(
      "export function g() {",
      "  {",
      "    var SPEC = 1",
      "  }",
      '  import SPEC from "../specs/A.xspec"',
      "  SPEC.a",
      "}",
    ),
    why:
      "a `var` in an inner block is declared in the enclosing function's " +
      "scope, never the block's — TypeScript 5.9.3's binder declaring it " +
      "and the import in `g`'s one scope (SPEC 2.4, 4.5) — so both bind " +
      "`SPEC` there: the 14.15 locating the declarator `SPEC = 1`, the " +
      "`var` excluded, and the import (14, 1.7, T14-11), and `SPEC.a` " +
      "unresolved (14.7) — never the silence of a product scoping every " +
      "declaration by its textual block, which finds the `var` shadowing " +
      "within its block alone and `SPEC.a` rooted at the import, recording " +
      "its edge",
    outcome: {
      kind: "failing",
      findings: [
        { condition: "14.7", at: [T4_5_11_MARKER] },
        { condition: "14.15", at: ["SPEC = 1", T4_5_11_IMPORT] },
      ],
    },
  },
  {
    key: "(b) contrast",
    what: "`const SPEC = 1` and the import in one inner block of `g`, `SPEC.a` in the block and `SPEC.b` after it",
    text: t4511Text(
      "export function g() {",
      "  {",
      "    const SPEC = 1",
      '    import SPEC from "../specs/A.xspec"',
      "    SPEC.a",
      "  }",
      "  SPEC.b",
      "}",
    ),
    why:
      "the declaration in the inner block holding the import shadows " +
      "instead — the import's binding belongs to `g`'s scope and the " +
      "`const` to the block's (SPEC 4.5, 2.4) — so the chain inside the " +
      "block is rooted at the local, recording no edge, and the chain after " +
      "the block at the import, recording its `references` edge from " +
      "`src/c.ts#g` (4.6) — never the 14.15 of a product judging a " +
      "collision by the block the declarations stand in",
    outcome: {
      kind: "valid",
      edges: [
        {
          from: `${T4_5_11_FILE}#g`,
          to: "specs/A.mdx#b",
          kind: "references",
        },
      ],
    },
  },
  {
    key: "(b) catch parameter",
    what: "`g`'s import beside `try {} catch (SPEC) { … }`, `SPEC.a` in the catch clause and `SPEC.b` after it",
    text: t4511Text(
      "export function g() {",
      '  import SPEC from "../specs/A.xspec"',
      "  try {} catch (SPEC) {",
      "    SPEC.a",
      "  }",
      "  SPEC.b",
      "}",
    ),
    why:
      "a catch clause's parameter belongs to the catch clause's scope, " +
      "inner to `g`'s, and shadows the import there (SPEC 2.4, 4.5): " +
      "`SPEC.a` is rooted at the catch parameter, recording no edge, and " +
      "`SPEC.b` at the import, recording its `references` edge from " +
      "`src/c.ts#g` (4.6) — never the 14.15 and 14.7 of a product counting " +
      "a catch parameter among the function's own parameters or variables",
    outcome: {
      kind: "valid",
      edges: [
        {
          from: `${T4_5_11_FILE}#g`,
          to: "specs/A.mdx#b",
          kind: "references",
        },
      ],
    },
  },
];

/** A located finding: its condition and `[file, start, end]` per location. */
type LocatedT4511Finding = readonly [
  string,
  readonly (readonly [string, number, number])[],
];

/** A staging laid out at module load, its text a staged-source record. */
interface LaidOutT4511Staging {
  readonly staging: T4511Staging;
  readonly source: StagedTs;
  /**
   * A failing staging's findings, located from the exact bytes, in 12.7's
   * order; empty for a valid staging.
   */
  readonly findings: readonly LocatedT4511Finding[];
  /** The located findings, rendered with their spellings (diagnostics). */
  readonly rendered: string;
}

/**
 * 12.7's findings order over one file's located findings: numbered
 * condition in numeric order, then locations element-wise (start, then
 * end), a proper prefix first. Negative where `a` sorts first.
 */
function compareT4511Findings(
  a: LocatedT4511Finding,
  b: LocatedT4511Finding,
): number {
  const conditionNumber = (condition: string): number =>
    Number(condition.slice("14.".length));
  const byCondition = conditionNumber(a[0]) - conditionNumber(b[0]);
  if (byCondition !== 0) return byCondition;
  for (let index = 0; index < Math.min(a[1].length, b[1].length); index += 1) {
    const [, aStart, aEnd] = a[1][index]!;
    const [, bStart, bEnd] = b[1][index]!;
    if (aStart !== bStart) return aStart - bStart;
    if (aEnd !== bEnd) return aEnd - bEnd;
  }
  return a[1].length - b[1].length;
}

/**
 * Lay out one staging: register its text as a staged-source record and, for
 * a failing staging, locate every construct its findings name from the
 * exact bytes (`constructRange`: each spelled exactly once), checking that
 * each finding's locations and the findings themselves stand in 12.7's
 * order — a mismatch a harness defect, thrown. It registers a record, so it
 * runs at module load only (`T4_5_11_STAGINGS`).
 */
function layOutT4511Staging(staging: T4511Staging): LaidOutT4511Staging {
  const where = `staging ${staging.key}'s ${T4_5_11_FILE}`;
  const findings: LocatedT4511Finding[] = [];
  const rendered: string[] = [];
  if (staging.outcome.kind === "failing") {
    for (const finding of staging.outcome.findings) {
      const ranges = finding.at.map((spelling) => ({
        spelling,
        range: constructRange("T4.5-11", where, staging.text, spelling),
      }));
      const located: LocatedT4511Finding = [
        finding.condition,
        ranges.map(({ range }) => [T4_5_11_FILE, range.start, range.end]),
      ];
      const inOrder = located[1].every(
        ([, start, end], index) =>
          index === 0 ||
          start > located[1][index - 1]![1] ||
          (start === located[1][index - 1]![1] &&
            end > located[1][index - 1]![2]),
      );
      const previous = findings[findings.length - 1];
      if (
        !inOrder ||
        (previous !== undefined && compareT4511Findings(previous, located) >= 0)
      ) {
        throw new Error(
          `T4.5-11 fixture self-check: ${where} must list its findings, and ` +
            `each finding's locations, in 12.7's order — the ` +
            `${finding.condition} at ${finding.at.join(" and ")} stands out ` +
            `of order (harness bug)`,
        );
      }
      findings.push(located);
      rendered.push(
        `${finding.condition} at ` +
          ranges
            .map(
              ({ spelling, range }) =>
                `\`${spelling}\` [${String(range.start)}, ` +
                `${String(range.end)})`,
            )
            .join(" and "),
      );
    }
  }
  return {
    staging,
    source: stagedTs(
      `T4.5-11 ${staging.key} ${T4_5_11_FILE} — ${staging.what}`,
      staging.text,
    ),
    findings,
    rendered: rendered.join("; "),
  };
}

/**
 * T4.5-11's stagings in TEST-SPEC's order, each on a workspace of its own,
 * laid out at module load (S-9's timing clause).
 */
const T4_5_11_STAGINGS: readonly LaidOutT4511Staging[] = [
  ...T4_5_11_A,
  ...T4_5_11_B,
].map(layOutT4511Staging);

/** The `files` of a staging's workspace: both spec sources and `src/c.ts`. */
function t4511Files(source: StagedTs): Record<string, InitialFileContents> {
  return {
    "specs/A.mdx": T4_5_11_SPEC_SOURCE,
    "specs/B.mdx": T4_5_11_SPEC_SOURCE,
    [T4_5_11_FILE]: source,
  };
}

/**
 * Assert a failing staging's report carries exactly its findings — the
 * complete set, in 12.7's order — each concerning no path (SPEC 12.7, 14),
 * its locations byte-exact in 12.7's within-finding order.
 */
function assertT4511Findings(
  findings: readonly Finding[],
  laid: LaidOutT4511Staging,
  context: string,
): void {
  const why = `${laid.rendered} — ${laid.staging.why}`;
  assertSameJson(
    findings.map((finding) => finding.condition ?? finding.code),
    laid.findings.map(([condition]) => condition),
    `${context}: exactly these findings, in 12.7's order — numbered ` +
      `conditions in numeric order, then by location — and nothing beside ` +
      `them: ${why}`,
  );
  findings.forEach((finding, index) => {
    if (finding.path !== null) {
      fail(
        `${context}: finding #${String(index + 1)} ` +
          `(${String(finding.condition ?? finding.code)}) locates in ` +
          `source, so it concerns no path — \`path\` is null for located ` +
          `conditions (SPEC 12.7, 14); got ${renderPathValue(finding.path)} ` +
          `(message: ${JSON.stringify(finding.message)})`,
      );
    }
  });
  assertSameJson(
    findings.map((finding) => [
      finding.condition ?? finding.code,
      locationTuples(finding),
    ]),
    laid.findings,
    `${context}: each finding's locations as \`[file, start, end]\` byte ` +
      `offsets, end-exclusive, in 12.7's within-finding order (file bytes, ` +
      `then start, then end) — each 14.7 at the span its occurrence would ` +
      `occupy, the marker's bare chain or a \`text(...)\` call callee ` +
      `through closing parenthesis (SPEC 14, 5.7), the 14.15 at every ` +
      `colliding declaration by its own characters (14, 1.7, T14-11): ${why}`,
  );
}

/**
 * A failing staging, on a workspace of its own: `build --json` and `check
 * --json` each exit 1 with exactly the staging's findings — `check`'s
 * nothing set aside (module header) — and `occurrences --file src/c.ts`,
 * answering on the failing workspace (SPEC 11.2), exits 1 with those
 * findings beside no record (5.7, 11.3).
 */
async function runT4511FailingStaging(
  product: ProductBinding,
  laid: LaidOutT4511Staging,
): Promise<void> {
  const { staging } = laid;
  await withWorkspace(T4_5_11_CONFIG, t4511Files(laid.source), async (ws) => {
    const context = `T4.5-11 ${staging.key} over ${staging.what}`;
    const expected =
      `the staging's findings are exit-1 outcomes (SPEC 12.0, 14): ` +
      `${laid.rendered} — ${staging.why}`;
    const buildContext = `${context}: \`build --json\``;
    assertT4511Findings(
      await runFindingsReport(
        product,
        ws,
        ["build", "--json"],
        1,
        `${buildContext} — ${expected}`,
      ),
      laid,
      buildContext,
    );
    const checkContext = `${context}: \`check --json\``;
    assertT4511Findings(
      await runFindingsReport(
        product,
        ws,
        ["check", "--json"],
        1,
        `${checkContext} — \`check\` performs all build validations and ` +
          `exits 1 on the findings (SPEC 12.2): ${laid.rendered}`,
      ),
      laid,
      checkContext,
    );
    const argv = ["occurrences", "--file", T4_5_11_FILE];
    const occContext = `${context}: \`${argv.join(" ")}\``;
    const report = decodeOccurrencesReport(
      parseJsonStdout(
        await expectExit(
          product,
          ws,
          argv,
          1,
          `${occContext} — the answer carries the domain's findings, so ` +
            `exit 1 with the full answer document (SPEC 11.2, 11.3)`,
        ),
        `${occContext} — a single JSON document is the only output form ` +
          `(SPEC 11)`,
      ),
      occContext,
    );
    assertT4511Findings(
      report.findings,
      laid,
      `${occContext}: the code file's findings accompany the answer (SPEC ` +
        `11.2, 11.3)`,
    );
    assertSameJson(
      report.occurrences.map(occurrenceTuple),
      [],
      `${occContext}: no record — a chain rooted at the colliding ` +
        `identifier names no target, recording no edge and no occurrence, ` +
        `its position reported by its finding alone (SPEC 2.4, 5.7, 11.2) ` +
        `— never the record of a product rooting it at the nested import`,
    );
  });
}

/**
 * A valid staging, on a workspace of its own: `build` and `check` finding-
 * free, and the dependency edges exactly the staging's.
 */
async function runT4511ValidStaging(
  product: ProductBinding,
  laid: LaidOutT4511Staging,
  edges: readonly GraphEdge[],
): Promise<void> {
  const { staging } = laid;
  await withWorkspace(T4_5_11_CONFIG, t4511Files(laid.source), async (ws) => {
    const context = `T4.5-11 ${staging.key} over ${staging.what}`;
    await expectCleanBuildAndCheck(product, ws, context, staging.why);
    assertEdgeSetEqual(
      await queryDependencyEdges(product, ws, context),
      edges,
      `${context}: \`query edges\` — the workspace's dependency edges are ` +
        `exactly ` +
        edges
          .map(
            (edge) =>
              `\`${edge.kind}\` from \`${edge.from}\` to \`${edge.to}\``,
          )
          .join(", ") +
        `, \`SPEC.a\` recording none: ${staging.why}`,
    );
  });
}

/**
 * T4.5-11, collisions in the import's own scope (SPEC 2.4, 4.5, 14.15): a
 * spec module import's binding collides with another import, or with a
 * value-level non-import declaration, of the import's own scope — for a
 * nested import the innermost function, class static block, or namespace or
 * module declaration enclosing it, a function's scope holding its
 * parameters too — while a declaration of an inner scope shadows it. Each
 * staging on a workspace of its own beside `specs/A.mdx` and `specs/B.mdx`
 * each holding `a` and `b`, every file S-9 well-formed and none compiled
 * (the section's operationalizations): (a) each colliding parameter form —
 * `SPEC: number` (beside a top-level `import { text }`, `text(SPEC.b)` in
 * the body), the constructor parameter property `@dec private readonly
 * SPEC: number`, `SPEC = 1`, `...SPEC: number[]`, and `{ SPEC }` — beside
 * the import nested in its body reports 14.15 at the parameter, whole, and
 * the import, and 14.7 for each chain the identifier roots, exit 1, no
 * record; the parameter beside a top-level import shadows it — no finding,
 * `SPEC.b`'s edge alone; (b) `const SPEC = 1`, `function SPEC() {}`, and
 * `class SPEC {}` in `g`'s body beside its block-nested import, and an
 * inner block's `var SPEC = 1` beside its import, each report 14.15 at the
 * declaration (a declarator by its own characters) and the import and 14.7
 * for `SPEC.a`, exit 1, no record; a `const` in the block holding the
 * import, and a catch clause's parameter, shadow — no finding, `SPEC.b`'s
 * edge from `src/c.ts#g` alone. Every staging runs, the diagnosed failures
 * collected.
 */
const T4_5_11 = defineProductTest({
  id: "T4.5-11",
  title:
    "collisions in the import's own scope — a spec module import's binding collides with another import, or with a value-level non-import declaration, of the import's own scope, for a nested import that of the innermost function, class static block, or namespace or module declaration enclosing it, a function's scope holding its parameters too, while a declaration of an inner scope shadows it instead; each staging on a workspace of its own, its code source `src/c.ts` beside `specs/A.mdx` and `specs/B.mdx` each holding `a` and `b`, every file S-9 well-formed and none compiled: (a) a parameter — `export function g(SPEC: number) {` holding `import SPEC from \"../specs/A.xspec\"`, `SPEC.a`, and `text(SPEC.b)` beside the top-level `import { text } from \"../specs/A.xspec\"` — `build --json` and `check --json` exit 1 with exactly 14.7 at `SPEC.a` [114, 120), 14.7 at the call `text(SPEC.b)` [123, 135), and 14.15 at the parameter `SPEC: number` [58, 70) and the nested import [76, 111), and `occurrences --file src/c.ts` exit 1 with those findings beside no record; likewise the constructor parameter property `@dec private readonly SPEC: number`, located from its `@`, [31, 65), and the parameters `SPEC = 1` [18, 26), `...SPEC: number[]` [18, 35), and `{ SPEC }` [18, 26), each whole, each with 14.7 at `SPEC.a`; and the contrast, the parameter beside a top-level `import SPEC`, shadowing it — `build` and `check` exit 0 with no finding and `query edges` exactly `SPEC.b`'s `references` edge from `src/c.ts` to `specs/A.mdx#b`, none for `SPEC.a`; (b) a declaration of the function's own body — `const SPEC = 1` (the declarator `SPEC = 1` located, [30, 38)), `function SPEC() {}` [24, 42), or `class SPEC {}` [24, 37) beside `g`'s import nested in a block — and an inner block's `var SPEC = 1` (the declarator, [34, 42)) beside `g`'s import, each exactly 14.7 at `SPEC.a` and 14.15 at the declaration and the import, exit 1, no record; the contrasts, `const SPEC = 1` in the inner block holding the import and a catch clause's parameter `SPEC`, each shadowing — no finding, exit 0, `query edges` exactly `SPEC.b`'s `references` edge from `src/c.ts#g` to `specs/A.mdx#b`, none for `SPEC.a`; every finding's locations byte-exact and concerning no path; never the silence of a product ignoring parameters, scoping imports to blocks, or scoping every declaration by its textual block, nor the range of one locating a parameter from its name through its type annotation, nor the 14.15 of one reading every same-named parameter, a declaration of the import's own block, or a catch parameter as colliding (SPEC 4.5, 1.7, 2.4, 4.6, 5.7, 11.2, 11.3, 14)",
  run: async (product) => {
    const failures: string[] = [];
    for (const laid of T4_5_11_STAGINGS) {
      const { outcome } = laid.staging;
      try {
        await (outcome.kind === "failing"
          ? runT4511FailingStaging(product, laid)
          : runT4511ValidStaging(product, laid, outcome.edges));
      } catch (error) {
        if (!(error instanceof HarnessAssertionError)) throw error;
        // A failure diagnosed outside the staging's own assertions — the
        // subprocess driver's, say — is named by its staging too.
        const context = `T4.5-11 ${laid.staging.key}`;
        failures.push(
          error.message.startsWith(context)
            ? error.message
            : `${context}: ${error.message}`,
        );
      }
    }
    if (failures.length > 0) {
      fail(
        `T4.5-11: ${String(failures.length)} of ` +
          `${String(T4_5_11_STAGINGS.length)} staging workspaces failed, ` +
          `each diagnosed:\n` +
          failures.map((failure) => `* ${failure}`).join("\n"),
      );
    }
  },
});

/** TEST-SPEC §4.5, second part, in canonical ID order (SUITE-15). */
export const section45iiTests: readonly ProductTestEntry[] = [T4_5_10, T4_5_11];
