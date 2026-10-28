// TEST-SPEC §4.3 (text) and §4.4 (module branding) — SUITE-14: T4.3-1,
// T4.3-2, T4.4-1, T4.4-2.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5) and exact bytes where SPEC.md fixes bytes
// (H-4), decodes reports through the H-3 adapters, and rejects a product only
// via diagnosed assertion failures (H-8). Consumer-side contracts run under
// standard TypeScript tooling with no xspec runtime dependency (SPEC 13.1)
// through helpers/tooling.ts, in TEST-SPEC H-2's two fixed configurations
// as section-4.ts describes: every type-checking verdict is made under each
// of the two in turn — a clean verdict over the whole program, the
// generated modules and the companions they reach included; a type-error
// assertion expecting the program's diagnostics at the consumer references
// under test alone — and every runtime arm runs under the CommonJS
// configuration alone, compiled to CommonJS JavaScript written outside the
// workspace and run there under plain Node. A consumer writing to standard
// output declares the one `process` member it uses (H-2 supplies no
// `@types/node`). Files under `consumer/` are matched by no configured group
// (never analyzed by the product); files under `src/` are discovered
// code-group sources.
//
// Conservative operationalizations (noted per H-4 — wording is free, so only
// the stated observables are asserted):
// - T4.3-1 "returns the node's subtree text as a `string`" is asserted at the
//   type level (each call result assigned to a `string`-annotated binding
//   type-checks clean under each of H-2's configurations), at runtime
//   (`typeof` is "string"), and on bytes (stdout equals the hand-derived
//   expansions, SPEC 1.6/3). "From the calling code location": the calls sit
//   at file top level, so the location is the file (SPEC 4.6), asserted as
//   the file's complete outgoing edge set — the file's `process` declaration
//   names no spec module binding and records nothing.
// - T4.3-2 arms stage exactly one defect each — the string/dynamic/arity
//   form. The dynamic arms' chains would resolve to existing nodes if read
//   statically (`SPEC[key]` with key = "a"; `SPEC[1]` read as `SPEC["1"]`,
//   as TypeScript type-checks it, with a top-level `1` staged; `` SPEC[`a`] ``
//   read as `SPEC["a"]`; `SPEC.a?.b` with `a.b` staged; `(SPEC.a)`,
//   `(SPEC).a`, and `SPEC[("a")]` read through their parentheses as
//   `SPEC.a`, as TypeScript's checker types each), so a product cannot
//   legitimately reclassify them as unresolved references (14.7): the sole
//   present condition is 14.8 (SPEC 2.4, 4.3, 4.5) — never 14.18, a
//   non-static `text(...)` argument being an invalid argument, not
//   unsupported usage (4.5), which the exact count {"14.8": 1} asserts.
//   The arity arms mirror T2.4-3's MDX staging in this language's valid
//   argument form: the two-argument call passes two static, resolvable node
//   chains (TEST-SPEC's `text(SPEC.a, SPEC.b)`, both nodes of the callee's
//   own module — never strings, each themselves 14.8 in TypeScript, which
//   would stage further defects), and the zero-argument call has nothing to
//   resolve, so in each the arity is the sole defect — exactly one 14.8, at
//   the call — and a product tolerating the arity builds clean, failing the
//   exit-1 expectation. Every argument of a spec module's `text` call is a
//   sanctioned use, so no 14.18 stands beside the 14.8 (SPEC 4.5, 14.18; 2.4
//   assigns any other arity to 14.8): a product sanctioning a sole argument
//   alone reports 14.18 at the second, failing the exact count. The
//   two-argument call's cross-module variant `text(SPEC.a, B.b)`, `B`
//   another spec module's default binding (`specs/B.mdx`, holding the `b`
//   the chain names, so the argument resolves), is condition 8 alone,
//   neither 14.18 nor 14.11: a call condition 8 reports for its argument
//   count is that condition alone (SPEC 14.11). TEST-SPEC names `build` and
//   `check` for both two-argument calls, so `check` runs on the same
//   never-built failing workspace, its condition counted exactly as T4.4-1
//   counts it (below), 14.10 included. Each finding must fall within the
//   offending statement's byte window (support.ts byteWindow).
// - T4.3-2's TypeScript-only arms (`SPEC.a!`, `SPEC.a as X`, `<X>SPEC.a`,
//   `SPEC.a satisfies X` as the `text` argument) are dynamic references in a
//   TypeScript source — 14.8 at the call, the file well-formed — never a
//   parse failure: 14.20 is the spec-source reading of the same spellings
//   (T2.4-2), and the exact count {"14.8": 1} excludes it. The angle-bracket
//   form parses only as plain TypeScript, which the `.ts` file name selects
//   (SPEC 2.4, 14.20).
// - T4.3-2's "no edge, no occurrence" attaches to the dynamic node-form
//   list (the eleven arms marked `dynamicNodeForm`). `query edges` refuses
//   to answer on a failing workspace (13.3), so the occurrence record is
//   the edge's witness (SPEC 5.7, 11.2), as in T4.4-1: after each such
//   arm's `build`, `occurrences` on the same failing workspace must exit 1
//   with its full answer emitted, its findings exactly {"14.8": 1}, that
//   finding located in the offending statement's byte window as `build`'s
//   is, and its record list empty (SPEC 11.2, 11.3). It runs unfiltered,
//   consulting the whole discovered set; the spec source holds no
//   reference, so `--file src/app.ts` would give the same verdict, and the
//   unfiltered answer's guarantee is absolute (11.3). The string-argument
//   and arity arms carry no such check: SPEC 5.7 lets an invalid call whose
//   argument resolves record its occurrence beside its finding (14.11's
//   cross-module call), and TEST-SPEC's clause does not cover them.
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
//   consumer, the TypeScript type error at the consumer reference — the
//   program's diagnostics there alone, under each of H-2's configurations —
//   and the runtime throw, reached "via the emitted JS" under H-2's CommonJS
//   configuration, written outside the workspace (standard tsc emits
//   despite the asserted type error — the TEST-SPEC alternative to
//   suppressing it; either way at the consumer's responsibility — and that
//   error is a semantic diagnostic, no emit diagnostic, so the emit
//   proceeds). On `check`, the condition
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
//   the clean type check of both own-module calls, the whole program
//   included, under each of H-2's configurations, plus their byte-exact
//   runtime values under its CommonJS configuration; "only" is a type error
//   at each cross-module argument, the program's diagnostics there alone
//   (the consumer references under test, TEST-SPEC §4's opening paragraph,
//   H-2).

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
import type { StagedMdx } from "../../helpers/staged-mdx.js";
import { stagedTs } from "../../helpers/staged-ts.js";
import type { StagedTs } from "../../helpers/staged-ts.js";
import type { ProductBinding, RunResult } from "../../helpers/subprocess.js";
import {
  assertTypeChecksClean,
  assertTypeErrorsAt,
  COMMONJS_CONFIGURATION,
  ConsumerProject,
  forEachConsumerProject,
  withCompiledConsumer,
} from "../../helpers/tooling.js";
import type { ConsumerSources } from "../../helpers/tooling.js";
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
// A staged-source record, judged before any product exists (S-9's timing
// clause; test/self/s9-staged-sources.test.ts): T4.4-1's consumer facet
// creates its workspace after the body's first invocation; T4.4-2 stages it
// before its own.
const SPECS_ONLY_CONFIG = stagedTs(
  "T4.4-1 xspec.config.ts — one spec group only, the consumer facet's",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
);

// One spec group plus one code group (SPEC 7.2): TypeScript files under
// `src/` are discovered code sources, so `build` analyzes their imports and
// spec-module usage (4, 4.5). A staged-source record: every arm workspace
// of T4.3-2 past the first, and T4.4-1's after its first facet, is created
// after a product invocation; T4.3-1 stages it before its own.
const SPEC_AND_CODE_CONFIG = stagedTs(
  "T4.3-2/T4.4-1 xspec.config.ts — one spec group and one code group, the arm workspaces' default",
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

/** Stage a fresh workspace (config plus `files`), run `body`, dispose (H-1). */
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

/**
 * Compile a consumer program under H-2's CommonJS configuration alone to
 * CommonJS JavaScript written outside the workspace, and run its root file
 * there under plain Node (module header); the run's result is returned for
 * the caller's assertions. The program's type-checking verdicts are the
 * caller's, made under each of H-2's configurations.
 */
async function runCompiledConsumer(
  workspace: TestWorkspace,
  rootFile: string,
  context: string,
): Promise<RunResult> {
  return await withCompiledConsumer(
    await ConsumerProject.load({
      rootDir: workspace.root,
      rootFiles: [rootFile],
      configuration: COMMONJS_CONFIGURATION,
    }),
    context,
    async (compiled) => await compiled.run(rootFile),
  );
}

/** A consumer program's sources: one root file in the workspace. */
function consumerSources(
  workspace: TestWorkspace,
  rootFile: string,
): ConsumerSources {
  return { rootDir: workspace.root, rootFiles: [rootFile] };
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
// bindings, not the returned strings. The file declares the one `process`
// member it uses (module header).
const T4_3_1_CONSUMER_SOURCE = [
  'import SPEC, { text } from "../specs/MAIN.xspec";',
  "",
  "declare const process: { readonly stdout: { write(chunk: string): boolean } };",
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
    "`text(node)` returns the node's subtree text as a `string` at runtime — byte-compared to the expected expansion, the consumer type-checking clean under both of H-2's configurations and run compiled under its CommonJS configuration — and records an `embeds` edge from the calling code location to the node, observed via `query edges` (SPEC 4.3, 4.6, 1.6, 13.1)",
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
        // bindings type-check clean under each of H-2's configurations, the
        // whole program included, and the consumer compiled under its
        // CommonJS configuration writes the runtime `typeof`s plus both
        // subtree texts, byte-exact.
        const consumerContext =
          "T4.3-1 consumer assigning each `text(node)` result to a " +
          "`string`-annotated binding (SPEC 4.3: returns the subtree text " +
          "as a `string`)";
        await forEachConsumerProject(
          consumerSources(workspace, "src/app.ts"),
          (project) => assertTypeChecksClean(project, consumerContext),
        );
        const run = await runCompiledConsumer(
          workspace,
          "src/app.ts",
          consumerContext,
        );
        assertExitCode(
          run,
          0,
          "T4.3-1 compiled consumer under plain Node, compiled under H-2's " +
            "CommonJS configuration outside the workspace (SPEC 13.1)",
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

// One spec source shared by every arm: `a` with a nested `a.b`, so each
// dynamic chain would resolve if read statically — the form is each arm's
// sole defect — beside the top-level `b` the two-argument call's second
// argument names and the top-level `1` (a valid segment, SPEC 1.4) a product
// reading `SPEC[1]` as `SPEC["1"]` resolves to. Staged in every arm's fresh
// workspace — past the first, after a product invocation: a staged-source
// record (S-9, test/self/s9-staged-sources.test.ts).
const T4_3_2_SPEC_FILES = {
  "specs/A.mdx": stagedMdx(
    "T4.3-2 specs/A.mdx",
    '<S id="a">\nAlpha behavior.\n<S id="a.b">\nBeta behavior.\n</S>\n</S>\n\n' +
      '<S id="b">\nBravo behavior.\n</S>\n\n' +
      '<S id="1">\nSection one behavior.\n</S>\n',
  ),
} as const;

// The cross-module arm's other spec module, the one `B` binds: it holds the
// `b` that arm's second argument names, so the argument resolves — a product
// judging it a cross-module `text` argument despite the arity reports 14.11
// (SPEC 14.11). Staged beside the shared source in that arm's workspace
// alone; a staged-source record, as the shared source is (S-9).
const T4_3_2_CROSS_SPEC_FILES = {
  "specs/B.mdx": stagedMdx(
    "T4.3-2 specs/B.mdx — the cross-module arm's other module",
    '<S id="b">\nOther module bravo behavior.\n</S>\n',
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
  /**
   * Whether this is one of TEST-SPEC's dynamic node-form arms, of which it
   * says "no edge, no occurrence" (T4.3-2): `occurrences` on the failing
   * workspace must list no record. False for the string-argument and arity
   * arms, which that clause does not cover (module header).
   */
  readonly dynamicNodeForm: boolean;
  /**
   * Whether `check --json` must report the same single finding as `build`
   * on the same never-built failing workspace — TEST-SPEC T4.3-2 names
   * both surfaces for the two-argument call and its cross-module variant
   * (module header).
   */
  readonly atCheck: boolean;
  /**
   * What the exact count {"14.8": 1} rules out beside the finding where
   * TEST-SPEC names it for a call that is no dynamic node form (failure
   * diagnostics; a dynamic node form's is 14.18, `t432CountContext`).
   */
  readonly excludes?: string;
  /**
   * Spec sources staged beside the shared `specs/A.mdx`
   * (`T4_3_2_SPEC_FILES`) — staged-source records, as every arm's workspace
   * past the body's first is created after a product invocation (S-9).
   */
  readonly extraSpecFiles?: Readonly<Record<string, StagedMdx>>;
}

const T4_3_2_ARMS: readonly InvalidTextArgumentArm[] = [
  {
    name: "a string argument to `text` (the string form is MDX-only, SPEC 4.3)",
    lines: ['import { text } from "../specs/A.xspec";', "", 'text("a");'],
    offending: 'text("a");',
    dynamicNodeForm: false,
    atCheck: false,
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
    dynamicNodeForm: true,
    atCheck: false,
  },
  // TEST-SPEC's `text(SPEC[1])`, `SPEC`'s module holding a top-level section
  // `1`: a numeric literal is no static string literal (SPEC 2.4), though
  // TypeScript type-checks the call as `text(SPEC["1"])`, so a product
  // reading the index as the string `"1"` resolves the chain, records the
  // edge, and reports nothing — failing the exit-1 and exact {"14.8": 1}
  // expectations.
  {
    name:
      "a computed index by numeric literal as the `text` argument, `SPEC`'s " +
      "module holding a top-level section `1` (a numeric literal is no " +
      "static string literal, SPEC 2.4)",
    lines: [
      'import SPEC, { text } from "../specs/A.xspec";',
      "",
      "text(SPEC[1]);",
    ],
    offending: "text(SPEC[1]);",
    dynamicNodeForm: true,
    atCheck: false,
  },
  // TEST-SPEC's `` text(SPEC[`a`]) ``, `SPEC`'s module holding `a`: template
  // literals are not static (SPEC 2.4), so a product reading the
  // no-substitution template literal as the static string literal `"a"`
  // resolves the chain, records the edge, and reports nothing — failing the
  // exit-1 and exact {"14.8": 1} expectations.
  {
    name:
      "a computed index by template literal as the `text` argument " +
      "(template literals are not static, SPEC 2.4)",
    lines: [
      'import SPEC, { text } from "../specs/A.xspec";',
      "",
      "text(SPEC[`a`]);",
    ],
    offending: "text(SPEC[`a`]);",
    dynamicNodeForm: true,
    atCheck: false,
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
    dynamicNodeForm: true,
    atCheck: false,
  },
  // TEST-SPEC's parenthesized chain, whole (`text((SPEC.a))`) and partly
  // parenthesized (`text((SPEC).a)`): parentheses applied to the chain make
  // the reference dynamic (SPEC 2.4), though TypeScript's checker types each
  // argument as `SPEC.a`, so a product reading through the parentheses
  // resolves `a`, records the edge, and reports nothing.
  {
    name:
      "a parenthesized chain `(SPEC.a)` as the `text` argument (parentheses " +
      "applied to the chain make the reference dynamic, SPEC 2.4)",
    lines: [
      'import SPEC, { text } from "../specs/A.xspec";',
      "",
      "text((SPEC.a));",
    ],
    offending: "text((SPEC.a));",
    dynamicNodeForm: true,
    atCheck: false,
  },
  {
    name:
      "a partly parenthesized chain `(SPEC).a` as the `text` argument " +
      "(parentheses applied to the chain make the reference dynamic, SPEC " +
      "2.4)",
    lines: [
      'import SPEC, { text } from "../specs/A.xspec";',
      "",
      "text((SPEC).a);",
    ],
    offending: "text((SPEC).a);",
    dynamicNodeForm: true,
    atCheck: false,
  },
  // TEST-SPEC's parenthesized index `text(SPEC[("a")])`: no static string
  // literal indexes it (SPEC 2.4), though the checker types the argument as
  // `SPEC.a`, so a product reading the parenthesized literal as the index
  // resolves `a`, records the edge, and reports nothing.
  {
    name:
      'a parenthesized index `SPEC[("a")]` as the `text` argument (no ' +
      "static string literal indexes it, SPEC 2.4)",
    lines: [
      'import SPEC, { text } from "../specs/A.xspec";',
      "",
      'text(SPEC[("a")]);',
    ],
    offending: 'text(SPEC[("a")]);',
    dynamicNodeForm: true,
    atCheck: false,
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
    dynamicNodeForm: true,
    atCheck: false,
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
    dynamicNodeForm: true,
    atCheck: false,
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
    dynamicNodeForm: true,
    atCheck: false,
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
    dynamicNodeForm: true,
    atCheck: false,
  },
  {
    name: "a zero-argument `text()` call (arity, SPEC 2.4)",
    lines: ['import { text } from "../specs/A.xspec";', "", "text();"],
    offending: "text();",
    dynamicNodeForm: false,
    atCheck: false,
  },
  // TEST-SPEC's `text(SPEC.a, SPEC.b)`, both nodes of the callee's own
  // module: every argument of a spec module's `text` call is a sanctioned
  // use (SPEC 4.5, 14.18), so `build` and `check` each report the one 14.8
  // and no 14.18 beside it — a product sanctioning a sole argument alone
  // reports 14.18 at the second.
  {
    name:
      "a two-argument `text(SPEC.a, SPEC.b)` call (arity, SPEC 2.4) — both " +
      "arguments static chains resolving to nodes of the callee's own " +
      "module, so the arity is the sole defect",
    lines: [
      'import SPEC, { text } from "../specs/A.xspec";',
      "",
      "text(SPEC.a, SPEC.b);",
    ],
    offending: "text(SPEC.a, SPEC.b);",
    dynamicNodeForm: false,
    atCheck: true,
    excludes:
      "no 14.18 beside it: every argument of a spec module's `text` call " +
      "is a sanctioned use (SPEC 4.5, 14.18)",
  },
  // Its cross-module variant `text(SPEC.a, B.b)`, `B` another spec module's
  // default binding: a call condition 8 reports for its argument count is
  // that condition alone (SPEC 14.11), so `build` and `check` each report
  // the one 14.8, neither 14.18 nor 14.11 beside it. `B`'s module holds the
  // `b` the chain names (`T4_3_2_CROSS_SPEC_FILES`), so the argument
  // resolves: a product judging it a cross-module `text` argument despite
  // the arity reports 14.11.
  {
    name:
      "the two-argument call's cross-module variant `text(SPEC.a, B.b)`, " +
      "`B` another spec module's default binding (arity, SPEC 2.4: " +
      "condition 8 alone, SPEC 14.11)",
    lines: [
      'import SPEC, { text } from "../specs/A.xspec";',
      'import B from "../specs/B.xspec";',
      "",
      "text(SPEC.a, B.b);",
    ],
    offending: "text(SPEC.a, B.b);",
    dynamicNodeForm: false,
    atCheck: true,
    excludes:
      "neither 14.18 nor 14.11: every argument of a spec module's `text` " +
      "call is a sanctioned use, and a call condition 8 reports for its " +
      "argument count is that condition alone (SPEC 4.5, 14.11, 14.18)",
    extraSpecFiles: T4_3_2_CROSS_SPEC_FILES,
  },
];

/**
 * An arm's exact-count context, naming what TEST-SPEC T4.3-2 rules out
 * beside the one 14.8: 14.18 for a dynamic node form — a non-static `text`
 * argument is an invalid argument, not unsupported usage (SPEC 4.5) — and
 * the arm's own `excludes` for a call that is none.
 */
function t432CountContext(
  arm: InvalidTextArgumentArm,
  context: string,
): string {
  if (arm.dynamicNodeForm) {
    return (
      `${context} — never 14.18: a non-static \`text(...)\` argument is an ` +
      `invalid argument, not unsupported usage (SPEC 4.5, 14.8)`
    );
  }
  return arm.excludes === undefined ? context : `${context} — ${arm.excludes}`;
}

/**
 * An invalid `text` argument arm laid out at module load: its `src/app.ts`
 * — the arm's lines, each one terminated — as a staged-source record (S-9's
 * timing clause: every arm's workspace past the first is created after a
 * product invocation, so S-7's sweep never reaches it), one per row.
 */
interface LaidOutTextArgumentArm {
  readonly arm: InvalidTextArgumentArm;
  readonly app: StagedTs;
}

// T4.3-2's arms in run order, one record per row.
const T4_3_2_LAID_OUT_ARMS: readonly LaidOutTextArgumentArm[] = T4_3_2_ARMS.map(
  (arm) => ({
    arm,
    app: stagedTs(
      `T4.3-2 arm ${arm.name} src/app.ts`,
      arm.lines.map((line) => line + "\n").join(""),
    ),
  }),
);

const T4_3_2 = defineProductTest({
  id: "T4.3-2",
  title:
    "a string argument to `text` in a TypeScript file fails with 14.8; so does a dynamic node-form argument there — a computed index by variable, a computed index by numeric literal (`text(SPEC[1])`, the module holding a top-level section `1`), a computed index by template literal (`` text(SPEC[`a`]) ``, the module holding `a`: template literals are not static), an optional-chaining chain, a parenthesized chain (`text((SPEC.a))` and the partly parenthesized `text((SPEC).a)`), and a parenthesized index (`text(SPEC[(\"a\")])`), never 14.18: a non-static `text(...)` argument is an invalid argument, not unsupported usage — and the TypeScript-only forms 2.4 makes dynamic in a TypeScript source, never a parse failure there (`text(SPEC.a!)`, `text(SPEC.a as X)`, `text(<X>SPEC.a)` in a `.ts` file, `text(SPEC.a satisfies X)`), each as the `text` argument, the file well-formed — each dynamic form 14.8 located at the call with no edge and no occurrence: `occurrences` on the failing workspace exits 1 with its full answer, the one 14.8 finding accompanying it located as `build`'s is, and lists no record; and so do a zero-argument and a two-argument `text(...)` call: 14.8's arity clause holds in either language, the MDX arms being T2.4-3; every argument of a spec module's `text` call is a sanctioned use: for `text(SPEC.a, SPEC.b)`, both nodes of the callee's own module, `build` and `check` each report exactly one finding, 14.8 located at the call, no 14.18 beside it, and for its cross-module variant `text(SPEC.a, B.b)`, `B` another spec module's default binding, the same single finding, neither 14.18 nor 14.11 — a call condition 8 reports for its argument count is that condition alone (SPEC 4.3, 2.4, 4.5, 5.7, 11.2, 11.3, 14.11, 14.18)",
  run: async (product) => {
    for (const { arm, app } of T4_3_2_LAID_OUT_ARMS) {
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
      const prefix = arm.lines
        .slice(0, at)
        .map((line) => line + "\n")
        .join("");
      const window = byteWindow(prefix, arm.offending);
      const context = `T4.3-2 \`build --json\` over ${arm.name}`;
      await withWorkspace(
        SPEC_AND_CODE_CONFIG,
        { ...T4_3_2_SPEC_FILES, ...arm.extraSpecFiles, "src/app.ts": app },
        async (workspace) => {
          const findings = await buildFindings(product, workspace, context);
          assertConditionCounts(
            findings,
            { "14.8": 1 },
            t432CountContext(arm, context),
          );
          assertFindingLocated(
            findings[0]!,
            { file: "src/app.ts", window },
            `${context}: the 14.8 finding`,
          );
          if (arm.atCheck) {
            // `check` performs all build validations (SPEC 12.2); on the
            // same never-built failing workspace the condition is counted
            // exactly, 14.10 included (module header).
            const checkContext = `T4.3-2 \`check --json\` over ${arm.name}`;
            const checked = await runFindingsReport(
              product,
              workspace,
              ["check", "--json"],
              1,
              `${checkContext} — \`check\` performs all build validations ` +
                `and exits 1 on any finding (SPEC 12.2, 14.8)`,
            );
            assertConditionCounts(
              checked,
              { "14.8": 1 },
              t432CountContext(
                arm,
                `${checkContext} — the call's finding and nothing beside ` +
                  `it: the never-built failing workspace holds no record, ` +
                  `and 14.10's mismatch forms go unreported there (SPEC ` +
                  `12.2, 14.10)`,
              ),
            );
            assertFindingLocated(
              checked[0]!,
              { file: "src/app.ts", window },
              `${checkContext}: the 14.8 finding, located as \`build\`'s is`,
            );
          }
          if (arm.dynamicNodeForm) {
            // "No edge, no occurrence": `query edges` refuses to answer on a
            // failing workspace (13.3), so the occurrence record is the
            // edge's witness (SPEC 5.7, 11.2) — module header.
            const occContext = `T4.3-2 \`occurrences\` over ${arm.name}`;
            const report = await occurrencesOnFailingWorkspace(
              product,
              workspace,
              occContext,
            );
            assertConditionCounts(
              report.findings,
              { "14.8": 1 },
              `${occContext} — the call's finding accompanies the answer, ` +
                `none beside it (SPEC 11.2)`,
            );
            assertFindingLocated(
              report.findings[0]!,
              { file: "src/app.ts", window },
              `${occContext}: the 14.8 finding, located as \`build\`'s is`,
            );
            assertSameJson(
              report.occurrences.map(projectRecord),
              [],
              `${occContext}: no record — a dynamic node-form \`text\` ` +
                `argument records no edge and no occurrence (SPEC 5.7, ` +
                `11.2; TEST-SPEC T4.3-2)`,
            );
          }
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

// The resolving-argument arms (facet 2) and the invalid-called-path facet
// (facet 3) create their workspaces after the body's first invocation, so
// their `src/app.ts` sources are staged-source records laid out at module
// load (S-9's timing clause; test/self/s9-staged-sources.test.ts), one per
// arm; facet 1's source, staged before that invocation, stays plain.
const T4_4_1_RESOLVING_ARMS = [
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
].map((arm) => ({
  ...arm,
  app: stagedTs(
    `T4.4-1 src/app.ts with ${arm.what}, \`${arm.call}\``,
    appSource(T4_4_1_APP_PREFIX, arm.call),
  ),
}));
const T4_4_1_INVALID_APP_SOURCE = appSource(
  T4_4_1_INVALID_APP_PREFIX,
  T4_4_1_CROSS_CALL,
);
const T4_4_1_INVALID_APP = stagedTs(
  `T4.4-1 src/app.ts importing the called module from the invalid path ${T4_4_1_INVALID_CALLED_PATH}`,
  T4_4_1_INVALID_APP_SOURCE,
);

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
// otherwise), and `String(error)` for the diagnosis alone. It declares the
// one `process` member it uses (module header), so the call's argument is
// its only diagnostic under either of H-2's configurations. A staged-source
// record (S-9's timing clause): the consumer facet's workspace is created
// after the body's first invocation.
const T4_4_1_CONSUMER_SOURCE = stagedTs(
  "T4.4-1 consumer/cross.ts — the cross-module consumer, outside every group",
  [
    'import A from "../specs/A.xspec";',
    'import { text as textB } from "../specs/B.xspec";',
    "",
    "declare const process: { readonly stdout: { write(chunk: string): boolean } };",
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
  ].join("\n"),
);

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
    "passing a node from module A to module B's `text` export is 14.11: `build` and `check` report exactly one condition-11 finding located at the call, callee through closing parenthesis, `identities` exactly [\"specs/B.mdx\"], exit 1, and the call's `embeds` occurrence stands beside it — `occurrences` on the failing workspace lists exactly one record, source the whole-file location, target specs/A.mdx#a; `textB(A.missing)` is condition 7 alone and `textB(A.a!)` condition 8 alone, no record for either; with the called module discovered as `specs/B#.mdx` the finding's `identities` are exactly [] beside 14.19, the record still listed; at an undiscovered consumer the call is a TypeScript type error, the program's diagnostics at its argument alone under both of H-2's configurations, and, executed via the JS emitted under H-2's CommonJS configuration, throws an error whose message contains both `specs/A.mdx` and `specs/B.mdx` (SPEC 4.4, 14.11, 5.7, 11.2, 1.5, 13.1)",
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
    for (const arm of T4_4_1_RESOLVING_ARMS) {
      const window = byteWindow(T4_4_1_APP_PREFIX, arm.call);
      await withWorkspace(
        SPEC_AND_CODE_CONFIG,
        { ...T4_4_SPEC_FILES, [T4_4_1_APP_FILE]: arm.app },
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
      const source = T4_4_1_INVALID_APP_SOURCE;
      const range = callRange(T4_4_1_INVALID_APP_PREFIX, T4_4_1_CROSS_CALL);
      await withWorkspace(
        SPEC_AND_CODE_CONFIG,
        {
          "specs/A.mdx": T4_4_SPEC_FILES["specs/A.mdx"],
          [T4_4_1_INVALID_CALLED_PATH]: T4_4_SPEC_FILES["specs/B.mdx"],
          [T4_4_1_APP_FILE]: T4_4_1_INVALID_APP,
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
        // Under each of H-2's configurations, the cross-module argument is
        // the program's one diagnosed position (H-2's type-error
        // assertion).
        await forEachConsumerProject(
          consumerSources(workspace, "consumer/cross.ts"),
          (project) =>
            assertTypeErrorsAt(
              project,
              [
                {
                  at: project.locate("consumer/cross.ts", T4_4_1_CROSS_CALL, {
                    charOffset: "textB(".length,
                  }),
                },
              ],
              "T4.4-1 passing module A's node to module B's `text` export " +
                "must be a TypeScript type error at the consumer reference, " +
                "and nothing else diagnosed (SPEC 4.4, 14.11)",
            ),
        );

        // "Executed via the emitted JS": standard tsc emits despite the
        // asserted type error — compiled under H-2's CommonJS configuration
        // alone, outside the workspace — and the call must throw at runtime.
        const run = await runCompiledConsumer(
          workspace,
          "consumer/cross.ts",
          "T4.4-1 cross-module consumer",
        );
        assertExitCode(
          run,
          0,
          "T4.4-1 compiled cross-module consumer under plain Node, compiled " +
            "under H-2's CommonJS configuration outside the workspace — the " +
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

// Acceptance: both own-module calls in one file type-check clean and return
// their own module's subtree texts at runtime. The file declares the one
// `process` member it uses (module header).
const T4_4_2_ACCEPT_SOURCE = [
  'import A, { text as textA } from "../specs/A.xspec";',
  'import B, { text as textB } from "../specs/B.xspec";',
  "",
  "declare const process: { readonly stdout: { write(chunk: string): boolean } };",
  "",
  "process.stdout.write(textA(A.a));",
  "process.stdout.write(textB(B.b));",
  "",
].join("\n");

// "Only": each alias rejects the other module's node — a type error at each
// cross-module argument, and nothing else diagnosed.
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
    "consuming two spec modules in one file with aliased `text` imports: each alias accepts only its own module's nodes — own-module calls type-check clean and return their texts, cross-module arguments are TypeScript type errors at the consumer references, the program's diagnostics there alone — each verdict under both of H-2's configurations, the runtime under its CommonJS configuration (SPEC 4.4, 13.1)",
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

        const acceptContext =
          "T4.4-2 one file consuming two spec modules with aliased `text` " +
          "imports: each alias accepts its own module's nodes (SPEC 4.4)";
        await forEachConsumerProject(
          consumerSources(workspace, "consumer/accept.ts"),
          (accept) => assertTypeChecksClean(accept, acceptContext),
        );
        const run = await runCompiledConsumer(
          workspace,
          "consumer/accept.ts",
          acceptContext,
        );
        assertExitCode(
          run,
          0,
          "T4.4-2 compiled accept consumer under plain Node, compiled under " +
            "H-2's CommonJS configuration outside the workspace (SPEC 13.1)",
        );
        assertBytesEqual(
          run.stdoutBytes,
          A_NODE_TEXT + B_NODE_TEXT,
          "T4.4-2 each aliased `text` returns its own module's subtree " +
            "text at runtime, byte-exact (SPEC 4.4, 4.3, 1.6)",
        );

        // Under each of H-2's configurations, the two cross-module
        // arguments are the program's only diagnosed positions (H-2's
        // type-error assertion).
        await forEachConsumerProject(
          consumerSources(workspace, "consumer/reject.ts"),
          (reject) =>
            assertTypeErrorsAt(
              reject,
              [
                {
                  at: reject.locate("consumer/reject.ts", "textA(B.b)", {
                    charOffset: "textA(".length,
                  }),
                },
                {
                  at: reject.locate("consumer/reject.ts", "textB(A.a)", {
                    charOffset: "textB(".length,
                  }),
                },
              ],
              "T4.4-2 module B's node passed to module A's aliased `text`, " +
                "and module A's node to module B's, must each be a " +
                "TypeScript type error at the consumer reference, and " +
                "nothing else diagnosed (SPEC 4.4)",
            ),
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
