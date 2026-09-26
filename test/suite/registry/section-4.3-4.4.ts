// TEST-SPEC §4.3 (text) and §4.4 (module branding) — SUITE-14: T4.3-1,
// T4.3-2, T4.4-1, T4.4-2.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5) and exact bytes where SPEC.md fixes bytes
// (H-4), decodes reports through the H-3 adapters, and rejects a product only
// via diagnosed assertion failures (H-8). Consumer-side contracts run under
// standard TypeScript tooling with no xspec runtime dependency (SPEC 13.1)
// through helpers/tooling.ts, in the CommonJS-mode arrangement described in
// section-4.ts. Files under `consumer/` are matched by no configured group
// (never analyzed by the product); files under `src/` are discovered
// code-group sources.
//
// Conservative operationalizations (noted per H-4 — wording is free, so only
// the stated observables are asserted):
// - T4.3-1 "returns the node's subtree text as a `string`" is asserted at the
//   type level (each call result assigned to a `string`-annotated binding
//   compiles clean), at runtime (`typeof` is "string"), and on bytes (stdout
//   equals the hand-derived expansions, SPEC 1.6/3). "From the calling code
//   location": the calls sit at file top level, so the location is the file
//   (SPEC 4.6), asserted as the file's complete outgoing edge set.
// - T4.3-2 arms stage exactly one defect each — the string/dynamic/arity
//   form. The dynamic arms' chains would resolve to existing nodes if read
//   statically (`SPEC[key]` with key = "a"; `SPEC.a?.b` with `a.b` staged),
//   so a product cannot legitimately reclassify them as unresolved
//   references (14.7): the sole present condition is 14.8 (SPEC 2.4, 4.3,
//   4.5). The arity arms mirror T2.4-3's MDX staging in this language's
//   valid argument form: the two-argument call passes two static, resolvable
//   node chains (`SPEC.a`, `SPEC.a.b` — never strings, each themselves 14.8
//   in TypeScript, which would stage further defects), and the zero-argument
//   call has nothing to resolve, so in each the arity is the sole defect —
//   exactly one 14.8, at the call — and a product tolerating the arity
//   builds clean, failing the exit-1 expectation. A node argument of the
//   wrong-arity call is still a direct argument to its own module's `text`
//   export, so no 14.18 is present (SPEC 14.18's entry sanctions direct
//   `text` arguments; 2.4 assigns any other arity to 14.8). Each finding
//   must fall within the offending statement's byte window (support.ts
//   byteWindow).
// - T4.3-2's TypeScript-only arms (`SPEC.a!`, `SPEC.a as X`, `<X>SPEC.a`,
//   `SPEC.a satisfies X` as the `text` argument) are dynamic references in a
//   TypeScript source — 14.8 at the call, the file well-formed — never a
//   parse failure: 14.20 is the spec-source reading of the same spellings
//   (T2.4-2), and the exact count {"14.8": 1} excludes it. The angle-bracket
//   form parses only as plain TypeScript, which the `.ts` file name selects
//   (SPEC 2.4, 14.20).
// - T4.4-1 asserts the condition's facets (SPEC 14.11: reported by
//   `build`/`check`, its edge and occurrence standing beside it,
//   "additionally a TypeScript type error and a runtime throw per 4.4";
//   TEST-SPEC §14 names T4.4-1 the primary test for 14.11) at the paths
//   TEST-SPEC pins verbatim (`specs/A.mdx`, the node's module; `specs/B.mdx`,
//   the called module): the home-context finding — a discovered code file
//   with the cross-module call fails `build --json` and `check --json` with
//   exactly one 14.11 finding, located at the call alone, callee through
//   closing parenthesis (5.7; T14-11), `path` null, `identities` exactly
//   `["specs/B.mdx"]` — and the occurrence beside it (`occurrences` on the
//   failing workspace, 11.2: the one record projected exactly — `embeds`,
//   the call's span, source the whole-file location `src/app.ts` with the
//   file's own range (4.6, 1.7), target `specs/A.mdx#a` — the finding
//   accompanying, exit 1); the resolving-argument arms (`textB(A.missing)`
//   condition 7 alone, `textB(A.a!)` condition 8 alone, no record for
//   either); the invalid-called-path arm (the called module discovered as
//   `specs/B#.mdx`: 14.19 concerning it beside the 14.11 whose `identities`
//   are exactly `[]`, the record still listed); plus, over an undiscovered
//   consumer, the TypeScript type error at the consumer reference and the
//   runtime throw, reached "via the emitted JS" (standard tsc emits despite
//   the asserted type error — the TEST-SPEC alternative to suppressing it;
//   either way at the consumer's responsibility). On `check`, the condition
//   is counted exactly, 14.10 included: the never-built workspace holds no
//   record (a failing `build` writes nothing, 12.1), so neither
//   whatever-validity form of 14.10 exists, and on a workspace failing
//   `build`'s validations the mismatch forms — the absent derived files
//   and graph data — go unreported (SPEC 14.10, 13.3); no other condition
//   is admitted.
// - T4.4-1 "an error whose message contains both modules' source files'
//   workspace-relative paths": the thrown value's `message` property must be
//   a string holding `specs/A.mdx` and `specs/B.mdx` as substrings —
//   `/`-separated, the `.mdx` sources — so a product naming the generated
//   module files (`specs/A.xspec.ts`), using native separators, naming bare
//   stems, or naming one module alone fails, and a thrown value without a
//   string `message` (a bare string, say) is diagnosed as such (SPEC 4.4,
//   1.5). The consumer reports `{ threw, message, rendering }`, the
//   rendering (`String(error)`) carried for the diagnosis alone.
// - T4.4-2 "each alias accepts only its own module's nodes": acceptance is
//   the clean compile of both own-module calls plus their byte-exact runtime
//   values; "only" is a compile error at each cross-module argument (the
//   failing location is the consumer reference under test, TEST-SPEC §4
//   preamble).

import type {
  Finding,
  GraphEdge,
  OccurrenceRecord,
  OccurrencesReport,
  SourceRange,
} from "../../helpers/adapters/index.js";
import {
  decodeEdgesReport,
  decodeOccurrencesReport,
  renderPathValue,
} from "../../helpers/adapters/index.js";
import {
  assertBytesEqual,
  assertExitCode,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { stagedMdx } from "../../helpers/staged-mdx.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import {
  assertCompileErrorAt,
  assertNoCompileErrors,
  ConsumerProject,
  formatConsumerDiagnostic,
  runConsumer,
} from "../../helpers/tooling.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { InitialFileContents } from "../../helpers/workspace.js";
import {
  assertConditionCounts,
  assertEdgeSetEqual,
  assertFindingConcernsPath,
  assertFindingIdentities,
  assertFindingLocated,
  assertSameJson,
  buildFindings,
  buildOk,
  byteWindow,
  expectExit,
  findingsInSourceOrder,
  runFindingsReport,
  runJson,
} from "./support.js";

// Minimal declarative configuration (SPEC 7): exactly one spec group. The
// consumer files under `consumer/` are outside every group by construction.
const SPECS_ONLY_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`;

// One spec group plus one code group (SPEC 7.2): TypeScript files under
// `src/` are discovered code sources, so `build` analyzes their imports and
// spec-module usage (4, 4.5).
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
  config: string,
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

/** `query edges --from <graph-node>`, decoded (SPEC 11). */
async function queryEdgesFrom(
  product: ProductBinding,
  workspace: TestWorkspace,
  from: string,
  context: string,
): Promise<readonly GraphEdge[]> {
  const label = `${context} \`query edges --from ${from}\``;
  return decodeEdgesReport(
    await runJson(
      product,
      workspace,
      ["query", "edges", "--from", from],
      label,
    ),
    label,
  );
}

/** Emit a consumer project's JavaScript, failing diagnosed when skipped. */
function emitConsumer(project: ConsumerProject, context: string): void {
  const emitted = project.emit();
  if (emitted.emitSkipped) {
    fail(
      `${context}: consumer emit was skipped; diagnostics:\n` +
        emitted.diagnostics
          .map((diagnostic) => `  ${formatConsumerDiagnostic(diagnostic)}`)
          .join("\n"),
    );
  }
}

// ---------------------------------------------------------------------------
// T4.3-1 — text(node) runtime value and embeds edge
// ---------------------------------------------------------------------------

// A parent whose subtree text interleaves its own runs with a child's
// contribution and expands an embedding of the sibling `lib` (SPEC 1.6, 3),
// so the runtime value is discriminating: own text alone, unexpanded text,
// or wrong interleaving each miss the expected bytes. The final line is the
// unterminated inline `lib` section, so lib's subtree text carries no
// trailing terminator.
const T4_3_1_SPEC_SOURCE = [
  '<S id="alpha">',
  "Alpha heading line.",
  '<S id="alpha.child">',
  "Child line one.",
  "</S>",
  'Alpha trailing {text("lib")} inline.',
  "</S>",
  '<S id="lib">EMBED-PAYLOAD core.</S>',
].join("\n");

// Hand-derived per SPEC 3/1.6: tag-only lines drop with their terminators,
// content lines keep theirs, the embedding expands to lib's subtree text.
const T4_3_1_ALPHA_SUBTREE =
  "Alpha heading line.\n" +
  "Child line one.\n" +
  "Alpha trailing EMBED-PAYLOAD core. inline.\n";
const T4_3_1_LIB_SUBTREE = "EMBED-PAYLOAD core.";

// Both calls sit at file top level in a discovered code-group file; the
// `string` annotations make the declared return type an assertion, and the
// runtime `typeof` line makes the runtime type one. Storing and passing the
// call *results* is unrestricted — the 4.5 usage rules bind the spec-module
// bindings, not the returned strings.
const T4_3_1_CONSUMER_SOURCE = [
  'import SPEC, { text } from "../specs/MAIN.xspec";',
  "",
  "const alpha: string = text(SPEC.alpha);",
  "const lib: string = text(SPEC.lib);",
  'process.stdout.write(JSON.stringify([typeof alpha, typeof lib]) + "\\n");',
  "process.stdout.write(alpha);",
  "process.stdout.write(lib);",
  "",
].join("\n");

const T4_3_1_EXPECTED_STDOUT =
  '["string","string"]\n' + T4_3_1_ALPHA_SUBTREE + T4_3_1_LIB_SUBTREE;

const T4_3_1 = defineProductTest({
  id: "T4.3-1",
  title:
    "`text(node)` returns the node's subtree text as a `string` at runtime — byte-compared to the expected expansion — and records an `embeds` edge from the calling code location to the node, observed via `query edges` (SPEC 4.3, 4.6, 1.6, 13.1)",
  run: async (product) => {
    await withWorkspace(
      SPEC_AND_CODE_CONFIG,
      {
        "specs/MAIN.mdx": T4_3_1_SPEC_SOURCE,
        "src/app.ts": T4_3_1_CONSUMER_SOURCE,
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T4.3-1 `build` over the embedding spec source and the consuming " +
            "code file",
        );

        // Each `text(node)` call records an `embeds` edge from the calling
        // code location — the file, for top-level calls (SPEC 4.3, 4.6) —
        // and those are the file's complete outgoing edges.
        assertEdgeSetEqual(
          await queryEdgesFrom(product, workspace, "src/app.ts", "T4.3-1"),
          [
            { from: "src/app.ts", to: "specs/MAIN.mdx#alpha", kind: "embeds" },
            { from: "src/app.ts", to: "specs/MAIN.mdx#lib", kind: "embeds" },
          ],
          "T4.3-1 each `text(node)` call records an `embeds` edge from the " +
            "calling code location (SPEC 4.3, 4.6), and nothing else leaves " +
            "the file",
        );

        // Under standard tooling (SPEC 13.1): the `string`-annotated
        // bindings type-check, and the compiled consumer's stdout carries
        // the runtime `typeof`s plus both subtree texts, byte-exact.
        const project = await ConsumerProject.load({
          rootDir: workspace.root,
          rootFiles: ["src/app.ts"],
        });
        assertNoCompileErrors(
          project,
          "T4.3-1 consumer assigning each `text(node)` result to a " +
            "`string`-annotated binding (SPEC 4.3: returns the subtree text " +
            "as a `string`)",
        );
        emitConsumer(project, "T4.3-1 consumer");
        const run = await runConsumer({
          dir: workspace.root,
          entry: "src/app.js",
        });
        assertExitCode(
          run,
          0,
          "T4.3-1 compiled consumer under plain Node (SPEC 13.1)",
        );
        assertBytesEqual(
          run.stdoutBytes,
          T4_3_1_EXPECTED_STDOUT,
          'T4.3-1 `text(node)` at runtime: `typeof` is "string" for both ' +
            "calls and each value is the node's subtree text with embedded " +
            "text fully expanded, byte-exact (SPEC 4.3, 1.6, 3)",
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T4.3-2 — string and dynamic text arguments in TypeScript are 14.8
// ---------------------------------------------------------------------------

// One spec source with a nested `a.b`, shared by every arm, so each dynamic
// chain would resolve if read statically — the form is each arm's sole
// defect.
// Staged in every arm's fresh workspace — past the first, after a product
// invocation: a staged-source record (S-9, test/self/s9-staged-sources.test.ts).
const T4_3_2_SPEC_FILES = {
  "specs/A.mdx": stagedMdx(
    "T4.3-2 specs/A.mdx",
    '<S id="a">\nAlpha behavior.\n<S id="a.b">\nBeta behavior.\n</S>\n</S>\n',
  ),
} as const;

/** One invalid `text` argument arm: a workspace differing only in src/app.ts. */
interface InvalidTextArgumentArm {
  /** Which SPEC 4.3/2.4 invalid case this is (failure diagnostics). */
  readonly name: string;
  /** The lines of `src/app.ts`, pure ASCII, one statement per line. */
  readonly lines: readonly string[];
  /** The offending statement — exactly one of the lines. */
  readonly offending: string;
}

const T4_3_2_ARMS: readonly InvalidTextArgumentArm[] = [
  {
    name: "a string argument to `text` (the string form is MDX-only, SPEC 4.3)",
    lines: ['import { text } from "../specs/A.xspec";', "", 'text("a");'],
    offending: 'text("a");',
  },
  {
    name:
      "a computed index by variable as the `text` argument (dynamic node " +
      "form, SPEC 2.4)",
    lines: [
      'import SPEC, { text } from "../specs/A.xspec";',
      "",
      'const key = "a";',
      "text(SPEC[key]);",
    ],
    offending: "text(SPEC[key]);",
  },
  {
    name:
      "an optional-chaining chain as the `text` argument (dynamic node " +
      "form, SPEC 2.4)",
    lines: [
      'import SPEC, { text } from "../specs/A.xspec";',
      "",
      "text(SPEC.a?.b);",
    ],
    offending: "text(SPEC.a?.b);",
  },
  // The four TypeScript-only forms SPEC 2.4 makes dynamic in a TypeScript
  // source — never a parse failure there (the spec-source counterparts are
  // T2.4-2's 14.20 arms). `type X = unknown;` declares the asserted type so
  // the file carries no TypeScript error at all — a type alias is type-level
  // and collides with no binding (SPEC 2.4, 4.5) — keeping the form each
  // arm's sole defect. The angle-bracket assertion parses only under the
  // plain-TypeScript grammar the staged `.ts` file name selects (SPEC
  // 14.20) — never `.tsx`.
  {
    name:
      "a non-null assertion on the chain as the `text` argument " +
      "(TypeScript-only syntax, dynamic in a TypeScript source, SPEC 2.4)",
    lines: [
      'import SPEC, { text } from "../specs/A.xspec";',
      "",
      "text(SPEC.a!);",
    ],
    offending: "text(SPEC.a!);",
  },
  {
    name:
      "a type assertion `as X` on the chain as the `text` argument " +
      "(TypeScript-only syntax, dynamic in a TypeScript source, SPEC 2.4)",
    lines: [
      'import SPEC, { text } from "../specs/A.xspec";',
      "",
      "type X = unknown;",
      "text(SPEC.a as X);",
    ],
    offending: "text(SPEC.a as X);",
  },
  {
    name:
      "an angle-bracket assertion `<X>` on the chain as the `text` argument, " +
      "in a `.ts` file where it parses (TypeScript-only syntax, dynamic in a " +
      "TypeScript source, SPEC 2.4)",
    lines: [
      'import SPEC, { text } from "../specs/A.xspec";',
      "",
      "type X = unknown;",
      "text(<X>SPEC.a);",
    ],
    offending: "text(<X>SPEC.a);",
  },
  {
    name:
      "a `satisfies X` operator on the chain as the `text` argument " +
      "(TypeScript-only syntax, dynamic in a TypeScript source, SPEC 2.4)",
    lines: [
      'import SPEC, { text } from "../specs/A.xspec";',
      "",
      "type X = unknown;",
      "text(SPEC.a satisfies X);",
    ],
    offending: "text(SPEC.a satisfies X);",
  },
  {
    name: "a zero-argument `text()` call (arity, SPEC 2.4)",
    lines: ['import { text } from "../specs/A.xspec";', "", "text();"],
    offending: "text();",
  },
  {
    name:
      "a two-argument `text(...)` call (arity, SPEC 2.4) — both arguments " +
      "static resolvable node chains, so the arity is the sole defect",
    lines: [
      'import SPEC, { text } from "../specs/A.xspec";',
      "",
      "text(SPEC.a, SPEC.a.b);",
    ],
    offending: "text(SPEC.a, SPEC.a.b);",
  },
];

const T4_3_2 = defineProductTest({
  id: "T4.3-2",
  title:
    "a string argument to `text` in a TypeScript file fails with 14.8; so does a dynamic node-form argument there — a computed index by variable, an optional-chaining chain, and the TypeScript-only forms 2.4 makes dynamic in a TypeScript source, never a parse failure there (`text(SPEC.a!)`, `text(SPEC.a as X)`, `text(<X>SPEC.a)` in a `.ts` file, `text(SPEC.a satisfies X)`), each as the `text` argument, the file well-formed — and so do a zero-argument and a two-argument `text(...)` call: 14.8's arity clause holds in either language, the MDX arms being T2.4-3 (SPEC 4.3, 2.4, 4.5)",
  run: async (product) => {
    for (const arm of T4_3_2_ARMS) {
      const at = arm.lines.indexOf(arm.offending);
      if (at === -1 || arm.lines.lastIndexOf(arm.offending) !== at) {
        // A harness defect (never a product failure): the offending
        // statement must appear exactly once among the staged lines.
        throw new Error(
          `T4.3-2 fixture broke: the offending statement must appear ` +
            `exactly once (${arm.name}) — fix T4_3_2_ARMS in ` +
            `section-4.3-4.4.ts`,
        );
      }
      const source = arm.lines.map((line) => line + "\n").join("");
      const prefix = arm.lines
        .slice(0, at)
        .map((line) => line + "\n")
        .join("");
      const window = byteWindow(prefix, arm.offending);
      const context = `T4.3-2 \`build --json\` over ${arm.name}`;
      await withWorkspace(
        SPEC_AND_CODE_CONFIG,
        { ...T4_3_2_SPEC_FILES, "src/app.ts": source },
        async (workspace) => {
          const findings = await buildFindings(product, workspace, context);
          assertConditionCounts(findings, { "14.8": 1 }, context);
          assertFindingLocated(
            findings[0]!,
            { file: "src/app.ts", window },
            `${context}: the 14.8 finding`,
          );
        },
      );
    }
  },
});

// ---------------------------------------------------------------------------
// T4.4-1 — cross-module text call: finding, occurrence, type error, throw
// ---------------------------------------------------------------------------

// Two spec modules at the paths TEST-SPEC T4.4-1 pins verbatim — the node's
// module `specs/A.mdx` (node `a`) and the called module `specs/B.mdx` (node
// `b`) — so the runtime message's substrings, the finding's `identities`,
// and the occurrence's target are exact literals. Shared with T4.4-2. T4.4-1's
// facets past the first create their workspaces after its first invocation —
// facet 3 staging the `B` source at the invalid path `specs/B#.mdx` — so both
// sources are staged-source records (S-9, test/self/s9-staged-sources.test.ts).
const T4_4_SPEC_FILES = {
  "specs/A.mdx": stagedMdx(
    "T4.4-1/T4.4-2 specs/A.mdx",
    '<S id="a">\nAlpha module first behavior.\n</S>\n',
  ),
  "specs/B.mdx": stagedMdx(
    "T4.4-1/T4.4-2 specs/B.mdx (T4.4-1's facet 3 stages it at specs/B#.mdx)",
    '<S id="b">\nBravo module second behavior.\n</S>\n',
  ),
} as const;
// Hand-derived subtree texts (SPEC 3/1.6).
const A_NODE_TEXT = "Alpha module first behavior.\n";
const B_NODE_TEXT = "Bravo module second behavior.\n";

// The home-context arms: a discovered code-group file whose only defect is
// the cross-module call — the argument a static chain (2.4) that resolves,
// the callee a spec module's `text` export (4.5), only the modules differ
// (14.11) — and its resolving-argument variants (condition 7 or 8 alone,
// SPEC 14.11's own examples).
const T4_4_1_APP_FILE = "src/app.ts";
const T4_4_1_APP_PREFIX =
  'import A from "../specs/A.xspec";\n' +
  'import { text as textB } from "../specs/B.xspec";\n' +
  "\n";
/** The cross-module call — callee through closing parenthesis (SPEC 5.7). */
const T4_4_1_CROSS_CALL = "textB(A.a)";
const T4_4_1_UNRESOLVED_CALL = "textB(A.missing)";
const T4_4_1_DYNAMIC_CALL = "textB(A.a!)";
const T4_4_1_NODE_IDENTITY = "specs/A.mdx#a";
const T4_4_1_CALLED_MODULE_IDENTITY = "specs/B.mdx";

// Invalid called path (T11.2-3): the called module discovered at a path
// holding `#` (14.19). Its import is valid — the file is discovered (2.1,
// 4) — and the call is still condition 11 with `identities` exactly `[]`:
// no identity over an invalid path is ever emitted (SPEC 1.5, 11.2), while
// the node's module and the calling file keep their identities, so the
// occurrence is still recorded.
const T4_4_1_INVALID_CALLED_PATH = "specs/B#.mdx";
const T4_4_1_INVALID_APP_PREFIX =
  'import A from "../specs/A.xspec";\n' +
  'import { text as textB } from "../specs/B#.xspec";\n' +
  "\n";

/** The discovered code file: the imports, one call statement, a newline. */
function appSource(prefix: string, call: string): string {
  return `${prefix}${call};\n`;
}

/** The call's exact range: after `prefix`, callee through `)` (SPEC 5.7). */
function callRange(prefix: string, call: string): SourceRange {
  const start = Buffer.byteLength(prefix, "utf8");
  return { start, end: start + Buffer.byteLength(call, "utf8") };
}

/**
 * The cross-module call's one occurrence record, projected (SPEC 5.7, 12.7):
 * the referencing file, the call's span, `embeds`, the source graph node —
 * no named unit encloses a top-level statement, so the whole-file location,
 * identity the path alone, range the entire file (4.6, 1.7) — and the
 * node's identity as target.
 */
function expectedCrossCallRecord(source: string, range: SourceRange): unknown {
  return {
    file: T4_4_1_APP_FILE,
    range,
    kind: "embeds",
    source: {
      identity: T4_4_1_APP_FILE,
      range: { start: 0, end: Buffer.byteLength(source, "utf8") },
    },
    target: T4_4_1_NODE_IDENTITY,
  };
}

/** An occurrence record in the projection `expectedCrossCallRecord` uses. */
function projectRecord(record: OccurrenceRecord): unknown {
  return {
    file: renderPathValue(record.file),
    range: record.range,
    kind: record.kind,
    source:
      "unavailable" in record.source
        ? { unavailable: true }
        : { identity: record.source.identity, range: record.source.range },
    target: record.target,
  };
}

/**
 * The condition-11 finding contract (SPEC 14.11, 12.7; TEST-SPEC T4.4-1):
 * located at the call alone — exactly one location, in the code file, the
 * call's exact range (callee through closing parenthesis, T14-11) —
 * concerning no path, its `identities` exactly `identities`.
 */
function assertCrossModuleFinding(
  finding: Finding,
  range: SourceRange,
  identities: readonly string[],
  context: string,
): void {
  assertSameJson(
    finding.locations.map((location) => ({
      file: renderPathValue(location.file),
      range: location.range,
    })),
    [{ file: T4_4_1_APP_FILE, range }],
    `${context}: the condition-11 finding locates the call alone — one ` +
      `location, in ${T4_4_1_APP_FILE}, spanning the call from its callee ` +
      `through the closing parenthesis, argument included (SPEC 14.11, 5.7; ` +
      `T14-11) — message: ${JSON.stringify(finding.message)}`,
  );
  if (finding.path !== null) {
    fail(
      `${context}: a finding locating in source concerns no path — \`path\` ` +
        `is null for located conditions (SPEC 12.7, 14); got ` +
        `${JSON.stringify(finding.path)} (message: ` +
        `${JSON.stringify(finding.message)})`,
    );
  }
  assertFindingIdentities(
    finding,
    identities,
    `${context}: the condition-11 finding names the called module — ` +
      `\`identities\` exactly the root identity of the spec module whose ` +
      `\`text\` export is called, never the node's module and never a ` +
      `generated-module path, and exactly \`[]\` where that module's path ` +
      `is invalid (SPEC 14.11, 1.5, 12.7; T12.7-1)`,
  );
}

/**
 * `occurrences` over a workspace failing `build`: it answers from the
 * current sources, the domain's findings accompanying, exit 1 with the full
 * answer still emitted (SPEC 11.2, 11.3).
 */
async function occurrencesOnFailingWorkspace(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
): Promise<OccurrencesReport> {
  const result = await expectExit(
    product,
    workspace,
    ["occurrences"],
    1,
    `${context} — an answer carrying any finding exits 1, the full answer ` +
      `document still emitted (SPEC 11.2, 11.3)`,
  );
  return decodeOccurrencesReport(parseJsonStdout(result, context), context);
}

// The consumer for the type-error and runtime facets, outside every group:
// the call carries the expected (asserted) type error, tsc emits regardless,
// and the emitted JS reports whether the call threw, the thrown value's
// `message` property when it is a string (the datum SPEC 4.4 binds; null
// otherwise), and `String(error)` for the diagnosis alone.
const T4_4_1_CONSUMER_SOURCE = [
  'import A from "../specs/A.xspec";',
  'import { text as textB } from "../specs/B.xspec";',
  "",
  "let threw = false;",
  "let message: string | null = null;",
  'let rendering = "";',
  "try {",
  "  const returned: unknown = textB(A.a);",
  "  rendering = String(returned);",
  "} catch (error) {",
  "  threw = true;",
  "  rendering = String(error);",
  '  if (error !== null && typeof error === "object") {',
  "    const candidate = (error as { message?: unknown }).message;",
  '    if (typeof candidate === "string") {',
  "      message = candidate;",
  "    }",
  "  }",
  "}",
  "process.stdout.write(JSON.stringify({ threw, message, rendering }));",
  "",
].join("\n");

/** Decode the cross-module consumer's report (harness-authored contract). */
function decodeCrossOutcome(payload: unknown): {
  readonly threw: boolean;
  readonly message: string | null;
  readonly rendering: string;
} {
  const candidate = payload as {
    threw?: unknown;
    message?: unknown;
    rendering?: unknown;
  } | null;
  if (
    candidate === null ||
    typeof candidate !== "object" ||
    typeof candidate.threw !== "boolean" ||
    (candidate.message !== null && typeof candidate.message !== "string") ||
    typeof candidate.rendering !== "string"
  ) {
    fail(
      "T4.4-1: the cross-module consumer must report " +
        "`{ threw, message, rendering }` — harness-authored consumer " +
        "contract; got " +
        JSON.stringify(payload),
    );
  }
  return candidate as {
    threw: boolean;
    message: string | null;
    rendering: string;
  };
}

/** The workspace-relative source paths the runtime message must contain. */
const T4_4_1_MESSAGE_PATHS = [
  ["specs/A.mdx", "the node's module"],
  ["specs/B.mdx", "the called module"],
] as const;

const T4_4_1 = defineProductTest({
  id: "T4.4-1",
  title:
    "passing a node from module A to module B's `text` export is 14.11: `build` and `check` report exactly one condition-11 finding located at the call, callee through closing parenthesis, `identities` exactly [\"specs/B.mdx\"], exit 1, and the call's `embeds` occurrence stands beside it — `occurrences` on the failing workspace lists exactly one record, source the whole-file location, target specs/A.mdx#a; `textB(A.missing)` is condition 7 alone and `textB(A.a!)` condition 8 alone, no record for either; with the called module discovered as `specs/B#.mdx` the finding's `identities` are exactly [] beside 14.19, the record still listed; at an undiscovered consumer the call is a TypeScript type error and, executed via the emitted JS, throws an error whose message contains both `specs/A.mdx` and `specs/B.mdx` (SPEC 4.4, 14.11, 5.7, 11.2, 1.5, 13.1)",
  run: async (product) => {
    // Facet 1 — the home-context condition on `build` and `check`, and the
    // occurrence beside it.
    {
      const source = appSource(T4_4_1_APP_PREFIX, T4_4_1_CROSS_CALL);
      const range = callRange(T4_4_1_APP_PREFIX, T4_4_1_CROSS_CALL);
      await withWorkspace(
        SPEC_AND_CODE_CONFIG,
        { ...T4_4_SPEC_FILES, [T4_4_1_APP_FILE]: source },
        async (workspace) => {
          const buildContext =
            "T4.4-1 `build --json` over a discovered code file passing " +
            "module A's node to module B's `text` export";
          const built = await buildFindings(product, workspace, buildContext);
          assertConditionCounts(built, { "14.11": 1 }, buildContext);
          assertCrossModuleFinding(
            built[0]!,
            range,
            [T4_4_1_CALLED_MODULE_IDENTITY],
            buildContext,
          );

          // `check` performs all build validations (SPEC 12.2); the
          // condition is counted exactly, 14.10 included (module header).
          const checkContext = "T4.4-1 `check --json` over the same workspace";
          const checked = await runFindingsReport(
            product,
            workspace,
            ["check", "--json"],
            1,
            `${checkContext} — \`check\` performs all build validations ` +
              `and exits 1 on any finding (SPEC 12.2, 14.11)`,
          );
          assertConditionCounts(
            checked,
            { "14.11": 1 },
            `${checkContext} — the condition-11 finding and nothing beside ` +
              `it: the never-built failing workspace holds no record, and ` +
              `14.10's mismatch forms go unreported there (SPEC 12.2, ` +
              `14.11, 14.10)`,
          );
          assertCrossModuleFinding(
            checked[0]!,
            range,
            [T4_4_1_CALLED_MODULE_IDENTITY],
            checkContext,
          );

          // The edge and occurrence stand beside the finding (SPEC 14.11,
          // 5.7): `query edges` refuses to answer on a failing workspace
          // (13.3), so the occurrence record is the edge's witness (11.2).
          const occContext = "T4.4-1 `occurrences` over the failing workspace";
          const report = await occurrencesOnFailingWorkspace(
            product,
            workspace,
            occContext,
          );
          assertConditionCounts(
            report.findings,
            { "14.11": 1 },
            `${occContext} — the call's finding accompanies the answer, ` +
              `none beside it (SPEC 11.2)`,
          );
          assertCrossModuleFinding(
            report.findings[0]!,
            range,
            [T4_4_1_CALLED_MODULE_IDENTITY],
            occContext,
          );
          assertSameJson(
            report.occurrences.map(projectRecord),
            [expectedCrossCallRecord(source, range)],
            `${occContext}: exactly one record, the cross-module call's — ` +
              `\`embeds\`, spanning the call from its callee through the ` +
              `closing parenthesis, source the whole-file location ` +
              `\`${T4_4_1_APP_FILE}\` with the file's own range, target ` +
              `\`${T4_4_1_NODE_IDENTITY}\` (SPEC 5.7, 4.6, 1.7, 14.11)`,
          );
        },
      );
    }

    // Facet 2 — a resolving argument is required: condition 7 or 8 alone,
    // no condition 11 beside it, and no occurrence (SPEC 14.11, 5.7).
    for (const arm of [
      {
        call: T4_4_1_UNRESOLVED_CALL,
        condition: "14.7",
        what: "an unresolved argument",
      },
      {
        call: T4_4_1_DYNAMIC_CALL,
        condition: "14.8",
        what: "a non-static argument",
      },
    ]) {
      const source = appSource(T4_4_1_APP_PREFIX, arm.call);
      const window = byteWindow(T4_4_1_APP_PREFIX, arm.call);
      await withWorkspace(
        SPEC_AND_CODE_CONFIG,
        { ...T4_4_SPEC_FILES, [T4_4_1_APP_FILE]: source },
        async (workspace) => {
          const context = `T4.4-1 \`build --json\` with ${arm.what}, \`${arm.call}\``;
          const findings = await buildFindings(product, workspace, context);
          assertConditionCounts(
            findings,
            { [arm.condition]: 1 },
            `${context} — condition ${arm.condition} alone, no condition 11 ` +
              `beside it: the cross-module condition needs an argument that ` +
              `resolves (SPEC 14.11)`,
          );
          assertFindingLocated(
            findings[0]!,
            { file: T4_4_1_APP_FILE, window },
            `${context}: the condition-${arm.condition} finding`,
          );
          const occContext = `T4.4-1 \`occurrences\` with ${arm.what}, \`${arm.call}\``;
          const report = await occurrencesOnFailingWorkspace(
            product,
            workspace,
            occContext,
          );
          assertConditionCounts(
            report.findings,
            { [arm.condition]: 1 },
            `${occContext} — the finding accompanies the answer (SPEC 11.2)`,
          );
          assertSameJson(
            report.occurrences.map(projectRecord),
            [],
            `${occContext}: no record — a cross-module call whose argument ` +
              `does not resolve or is not static records no edge and no ` +
              `occurrence (SPEC 5.7, 11.2; T5.7-4)`,
          );
        },
      );
    }

    // Facet 3 — invalid called path: the finding still reported, its
    // `identities` exactly `[]`, the occurrence still recorded.
    {
      const source = appSource(T4_4_1_INVALID_APP_PREFIX, T4_4_1_CROSS_CALL);
      const range = callRange(T4_4_1_INVALID_APP_PREFIX, T4_4_1_CROSS_CALL);
      await withWorkspace(
        SPEC_AND_CODE_CONFIG,
        {
          "specs/A.mdx": T4_4_SPEC_FILES["specs/A.mdx"],
          [T4_4_1_INVALID_CALLED_PATH]: T4_4_SPEC_FILES["specs/B.mdx"],
          [T4_4_1_APP_FILE]: source,
        },
        async (workspace) => {
          const context =
            "T4.4-1 `build --json` with the called module discovered at " +
            `the invalid path \`${T4_4_1_INVALID_CALLED_PATH}\``;
          const findings = await buildFindings(product, workspace, context);
          assertConditionCounts(
            findings,
            { "14.19": 1, "14.11": 1 },
            `${context} — the path's condition 19 beside the call's ` +
              `condition 11, the import itself valid since the file is ` +
              `discovered (SPEC 14.19, 14.11, 2.1)`,
          );
          assertFindingConcernsPath(
            findingsInSourceOrder(findings, "14.19")[0]!,
            T4_4_1_INVALID_CALLED_PATH,
            `${context}: the condition-19 finding`,
          );
          assertCrossModuleFinding(
            findingsInSourceOrder(findings, "14.11")[0]!,
            range,
            [],
            context,
          );
          const occContext =
            "T4.4-1 `occurrences` with the called module at the invalid path";
          const report = await occurrencesOnFailingWorkspace(
            product,
            workspace,
            occContext,
          );
          assertConditionCounts(
            report.findings,
            { "14.19": 1, "14.11": 1 },
            `${occContext} — both domain files' findings accompany the ` +
              `answer (SPEC 11.2)`,
          );
          assertCrossModuleFinding(
            findingsInSourceOrder(report.findings, "14.11")[0]!,
            range,
            [],
            occContext,
          );
          assertSameJson(
            report.occurrences.map(projectRecord),
            [expectedCrossCallRecord(source, range)],
            `${occContext}: the record still listed — the calling file and ` +
              `the node's module keep their identities, only the called ` +
              `module's is undefined (SPEC 11.2, 1.5, 5.7)`,
          );
        },
      );
    }

    // Facet 4 — the consumer-side type error and the runtime throw, over
    // generated modules from a valid build (consumer outside every group).
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { ...T4_4_SPEC_FILES, "consumer/cross.ts": T4_4_1_CONSUMER_SOURCE },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T4.4-1 `build` over the two spec modules",
        );
        const project = await ConsumerProject.load({
          rootDir: workspace.root,
          rootFiles: ["consumer/cross.ts"],
        });
        assertCompileErrorAt(
          project,
          project.locate("consumer/cross.ts", T4_4_1_CROSS_CALL, {
            charOffset: "textB(".length,
          }),
          {},
          "T4.4-1 passing module A's node to module B's `text` export must " +
            "be a TypeScript type error at the consumer reference " +
            "(SPEC 4.4, 14.11)",
        );

        // "Executed via the emitted JS": standard tsc emits despite the
        // asserted type error, and the call must throw at runtime.
        emitConsumer(project, "T4.4-1 cross-module consumer");
        const run = await runConsumer({
          dir: workspace.root,
          entry: "consumer/cross.js",
        });
        assertExitCode(
          run,
          0,
          "T4.4-1 compiled cross-module consumer under plain Node — the " +
            "consumer catches the expected throw itself (SPEC 13.1)",
        );
        const outcome = decodeCrossOutcome(
          parseJsonStdout(run, "T4.4-1 cross-module consumer output"),
        );
        if (!outcome.threw) {
          fail(
            "T4.4-1: the cross-module call did not throw at runtime — " +
              `\`${T4_4_1_CROSS_CALL}\` returned ` +
              JSON.stringify(outcome.rendering) +
              " (SPEC 4.4: at runtime the call MUST throw an error whose " +
              "message names both the node's module and the called module)",
          );
        }
        if (outcome.message === null) {
          fail(
            "T4.4-1: the thrown value carries no string `message` — SPEC " +
              "4.4 requires an error whose message names both modules by " +
              "their source files' workspace-relative paths; thrown: " +
              JSON.stringify(outcome.rendering),
          );
        }
        for (const [path, role] of T4_4_1_MESSAGE_PATHS) {
          if (!outcome.message.includes(path)) {
            fail(
              `T4.4-1: the runtime error's message must name ${role} by ` +
                `its source file's workspace-relative, \`/\`-separated path ` +
                `— the substring ${JSON.stringify(path)} — never a ` +
                `generated module file, a native-separator spelling, a bare ` +
                `stem, or one module alone (SPEC 4.4, 1.5); message: ` +
                JSON.stringify(outcome.message),
            );
          }
        }
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T4.4-2 — two spec modules in one file, aliased text per module
// ---------------------------------------------------------------------------

// Acceptance: both own-module calls in one file compile clean and return
// their own module's subtree texts at runtime.
const T4_4_2_ACCEPT_SOURCE = [
  'import A, { text as textA } from "../specs/A.xspec";',
  'import B, { text as textB } from "../specs/B.xspec";',
  "",
  "process.stdout.write(textA(A.a));",
  "process.stdout.write(textB(B.b));",
  "",
].join("\n");

// "Only": each alias rejects the other module's node — a compile error at
// each cross-module argument.
const T4_4_2_REJECT_SOURCE = [
  'import A, { text as textA } from "../specs/A.xspec";',
  'import B, { text as textB } from "../specs/B.xspec";',
  "",
  "textA(B.b);",
  "textB(A.a);",
  "",
].join("\n");

const T4_4_2 = defineProductTest({
  id: "T4.4-2",
  title:
    "consuming two spec modules in one file with aliased `text` imports: each alias accepts only its own module's nodes — own-module calls compile clean and return their texts, cross-module arguments are TypeScript type errors at the consumer references (SPEC 4.4, 13.1)",
  run: async (product) => {
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      {
        ...T4_4_SPEC_FILES,
        "consumer/accept.ts": T4_4_2_ACCEPT_SOURCE,
        "consumer/reject.ts": T4_4_2_REJECT_SOURCE,
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T4.4-2 `build` over the two spec modules",
        );

        const accept = await ConsumerProject.load({
          rootDir: workspace.root,
          rootFiles: ["consumer/accept.ts"],
        });
        assertNoCompileErrors(
          accept,
          "T4.4-2 one file consuming two spec modules with aliased `text` " +
            "imports: each alias accepts its own module's nodes (SPEC 4.4)",
        );
        emitConsumer(accept, "T4.4-2 accept consumer");
        const run = await runConsumer({
          dir: workspace.root,
          entry: "consumer/accept.js",
        });
        assertExitCode(
          run,
          0,
          "T4.4-2 compiled accept consumer under plain Node (SPEC 13.1)",
        );
        assertBytesEqual(
          run.stdoutBytes,
          A_NODE_TEXT + B_NODE_TEXT,
          "T4.4-2 each aliased `text` returns its own module's subtree " +
            "text at runtime, byte-exact (SPEC 4.4, 4.3, 1.6)",
        );

        const reject = await ConsumerProject.load({
          rootDir: workspace.root,
          rootFiles: ["consumer/reject.ts"],
        });
        assertCompileErrorAt(
          reject,
          reject.locate("consumer/reject.ts", "textA(B.b)", {
            charOffset: "textA(".length,
          }),
          {},
          "T4.4-2 module B's node passed to module A's aliased `text` must " +
            "be a TypeScript type error at the consumer reference (SPEC 4.4)",
        );
        assertCompileErrorAt(
          reject,
          reject.locate("consumer/reject.ts", "textB(A.a)", {
            charOffset: "textB(".length,
          }),
          {},
          "T4.4-2 module A's node passed to module B's aliased `text` must " +
            "be a TypeScript type error at the consumer reference (SPEC 4.4)",
        );
      },
    );
  },
});

/** TEST-SPEC §4.3–4.4, in canonical ID order (SUITE-14). */
export const section43to44Tests: readonly ProductTestEntry[] = [
  T4_3_1,
  T4_3_2,
  T4_4_1,
  T4_4_2,
];
