// TEST-SPEC §2.4 (static argument rule) — SUITE-08: T2.4-1 … T2.4-5.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), decodes output through the H-3 adapters,
// and rejects a product only via diagnosed assertion failures (H-8). The
// T2.4-4 type-error arm exercises the generated module under standard
// TypeScript tooling with no xspec runtime dependency (SPEC 13.1, HARNESS-05).
//
// SPEC 2.4: the argument to `text(...)` and every reference in `d` MUST be a
// static string literal (a plain single- or double-quoted string — template
// literals are not static) or a static property chain rooted at an imported
// spec module: the import binding followed by zero or more segments, each a
// non-computed property access whose name is an identifier (`.login`) or a
// computed access whose index is a static string literal (`["login-v2"]`).
// No other syntax participates in a chain — optional chaining, non-null
// assertions, parentheses, and any other index or expression form make the
// reference dynamic — and a `text(...)` call MUST have exactly one argument;
// dynamic references and other arities are invalid (14.8). A chain segment is
// exactly one ID segment, and no segment contains `.` (1.4), so a dotted
// computed index resolves to nothing (14.5/14.6/14.7 by context), while a
// local string names a whole dotted path (2.2). The value of a static
// string literal is the characters between its delimiters exactly as
// spelled — no escape sequence or character reference interpreted — and a
// chain segment's identifier is read as spelled likewise, so an
// escape-spelled segment names no node (2.4; T2.4-5, whose code-source
// half rides the same standard-tooling channel as T2.4-4's type-error arm).
//
// Location assertions: fixtures are pure ASCII and composed as
// `prefix + construct + suffix` with exactly known parts, so string indices
// are byte offsets and each finding must fall within the offending
// construct's own byte window (end-widened by one byte for line-granular
// locations, see support.ts byteWindow); every other staged construct lies
// outside the widened window.

import type { Finding, GraphEdge } from "../../helpers/adapters/index.js";
import {
  decodeEdgesReport,
  decodeOccurrencesReport,
} from "../../helpers/adapters/index.js";
import { parseJsonStdout } from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import {
  assertCompileErrorAt,
  assertNoCompileErrors,
  ConsumerProject,
} from "../../helpers/tooling.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { WorkspaceMdxDecl } from "../../helpers/workspace.js";
import type { OccurrenceUnit } from "./section-5.7.js";
import { expectedUnitMultiset, renderOccurrenceUnit } from "./section-5.7.js";
import {
  assertConditionCounts,
  assertEdgeSetEqual,
  assertFindingLocated,
  assertSameJson,
  buildFindings,
  buildOk,
  byteWindow,
  expectExit,
  findingsInSourceOrder,
  runJson,
} from "./support.js";

// Minimal declarative configuration (SPEC 7): exactly one spec group.
const SPECS_ONLY_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`;

// One spec group plus one code group, for T2.4-4's TypeScript marker arm
// (SPEC 7.2): the marker's file must be a discovered code source for `build`
// to analyze it (4.5, 14.7).
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
  files: Readonly<Record<string, string>>,
  body: (workspace: TestWorkspace) => Promise<T>,
  mdx?: WorkspaceMdxDecl,
): Promise<T> {
  const workspace = await TestWorkspace.create({
    files: { "xspec.config.ts": config, ...files },
    mdx,
  });
  try {
    return await body(workspace);
  } finally {
    await workspace.dispose();
  }
}

/**
 * The workspace's complete edge set of one dependency kind, via
 * `query edges --kinds <kind>` (SPEC 11). Asserted against an exact expected
 * set, this pins every recorded edge of the kind — none missing, none
 * phantom, no duplicates (edges of each kind form a set, SPEC 5.2).
 */
async function queryEdgesOfKind(
  product: ProductBinding,
  workspace: TestWorkspace,
  kind: "depends" | "embeds",
  context: string,
): Promise<readonly GraphEdge[]> {
  const label = `${context} \`query edges --kinds ${kind}\``;
  return decodeEdgesReport(
    await runJson(
      product,
      workspace,
      ["query", "edges", "--kinds", kind],
      label,
    ),
    label,
  );
}

// ---------------------------------------------------------------------------
// T2.4-1
// ---------------------------------------------------------------------------

// Every accepted static form (SPEC 2.4) in one workspace, each exercised in
// `d` and in `text(...)`: double- and single-quoted string literals, a
// dot-access chain, computed access via a static string literal (double- and
// single-quoted index alike — "a plain single- or double-quoted string"), and
// mixed chains (dot-then-computed and computed-then-dot). The imported module
// carries non-identifier segments (`login-v2`, `pin-2`, `auth.sub-x`) so the
// computed arms use the form 2.4 defines them for (1.4).
const T2_4_1_BASE = [
  '<S id="login-v2">',
  "Dashed target.",
  "</S>",
  "",
  '<S id="pin-2">',
  "Second dashed target.",
  "</S>",
  "",
  '<S id="auth">',
  "Auth intro.",
  "",
  '<S id="auth.login">',
  "Login behavior.",
  "</S>",
  "",
  '<S id="auth.sub-x">',
  "Dashed child.",
  "</S>",
  "</S>",
  "",
].join("\n");

// Every arm targets its own distinct node (or declares from a distinct
// section), so the expected edge sets never rely on duplicate collapse
// (that is T2.2-3's subject) and each accepted form is pinned to its own
// recorded edge.
const T2_4_1_SOURCE = [
  'import BASE from "./BASE.xspec"',
  "",
  '<S id="alpha">',
  "Alpha behavior.",
  "</S>",
  "",
  '<S id="beta">',
  "Beta behavior.",
  "</S>",
  "",
  '<S id="dq" d={"alpha"}>',
  "Double-quoted local string.",
  "</S>",
  "",
  "<S id=\"sq\" d={'alpha'}>",
  "Single-quoted local string.",
  "</S>",
  "",
  '<S id="dot" d={BASE.auth.login}>',
  "Dot-access chain.",
  "</S>",
  "",
  '<S id="computed" d={[BASE["login-v2"], BASE[\'pin-2\']]}>',
  "Computed access via double- and single-quoted static string literals.",
  "</S>",
  "",
  '<S id="mixed" d={[BASE.auth["sub-x"], BASE["auth"].login]}>',
  "Mixed dot and computed chains.",
  "</S>",
  "",
  '<S id="embed">',
  'Double: {text("alpha")}',
  "Single: {text('beta')}",
  "Dot: {text(BASE.auth.login)}",
  'Computed: {text(BASE["login-v2"])}',
  'Mixed: {text(BASE.auth["sub-x"])}',
  "</S>",
  "",
].join("\n");

const T2_4_1 = defineProductTest({
  id: "T2.4-1",
  title:
    "double- and single-quoted string literals and property chains with dot access, computed access via static string literal, and mixed chains are all accepted in `d` and `text(...)` — the workspace builds and each form records its edge to the right target (SPEC 2.4, 2.2, 2.3)",
  run: async (product) => {
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { "specs/BASE.mdx": T2_4_1_BASE, "specs/A.mdx": T2_4_1_SOURCE },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T2.4-1 `build` with every accepted static form in `d` and `text(...)`",
        );
        // "All build" is grounded in the forms being accepted *as
        // references*: an unresolved reference would have failed the build
        // (14.5/14.6), and the exact edge sets pin each accepted form to the
        // target its spelling names (SPEC 2.2, 2.3) — a product that builds
        // by ignoring a form, or resolves a computed or mixed chain to the
        // wrong node, fails here.
        assertEdgeSetEqual(
          await queryEdgesOfKind(product, workspace, "depends", "T2.4-1"),
          [
            {
              from: "specs/A.mdx#dq",
              to: "specs/A.mdx#alpha",
              kind: "depends",
            },
            {
              from: "specs/A.mdx#sq",
              to: "specs/A.mdx#alpha",
              kind: "depends",
            },
            {
              from: "specs/A.mdx#dot",
              to: "specs/BASE.mdx#auth.login",
              kind: "depends",
            },
            {
              from: "specs/A.mdx#computed",
              to: "specs/BASE.mdx#login-v2",
              kind: "depends",
            },
            {
              from: "specs/A.mdx#computed",
              to: "specs/BASE.mdx#pin-2",
              kind: "depends",
            },
            {
              from: "specs/A.mdx#mixed",
              to: "specs/BASE.mdx#auth.sub-x",
              kind: "depends",
            },
            {
              from: "specs/A.mdx#mixed",
              to: "specs/BASE.mdx#auth.login",
              kind: "depends",
            },
          ],
          "T2.4-1 the complete `depends` edge set — one edge per accepted `d` form, " +
            "each resolved to the node its spelling names (SPEC 2.4, 2.2)",
        );
        assertEdgeSetEqual(
          await queryEdgesOfKind(product, workspace, "embeds", "T2.4-1"),
          [
            {
              from: "specs/A.mdx#embed",
              to: "specs/A.mdx#alpha",
              kind: "embeds",
            },
            {
              from: "specs/A.mdx#embed",
              to: "specs/A.mdx#beta",
              kind: "embeds",
            },
            {
              from: "specs/A.mdx#embed",
              to: "specs/BASE.mdx#auth.login",
              kind: "embeds",
            },
            {
              from: "specs/A.mdx#embed",
              to: "specs/BASE.mdx#login-v2",
              kind: "embeds",
            },
            {
              from: "specs/A.mdx#embed",
              to: "specs/BASE.mdx#auth.sub-x",
              kind: "embeds",
            },
          ],
          "T2.4-1 the complete `embeds` edge set — one edge per accepted `text(...)` " +
            "form, each resolved to the node its spelling names (SPEC 2.4, 2.3)",
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T2.4-2
// ---------------------------------------------------------------------------

// The dynamic forms of SPEC 2.4, each run in `d` and in `text(...)`, in MDX,
// and beside them the TypeScript-only spellings a spec source's grammar does
// not derive. Every arm's workspace is otherwise valid — `specs/BASE.mdx`
// provides the `auth` node the chain forms name, and the local `alpha` node
// exists so a product wrongly treating the template literal as a static
// string would resolve it and exit 0 (caught by the exit-1 expectation) —
// making the one offending construct the only condition present (the exact
// count has teeth).
//
// Two kinds of arm (SPEC 2.4): a form ECMAScript 2024 derives that makes the
// reference dynamic is 14.8 — the "another meaning" case `d={BASE.a<X>y}`
// included: two comparisons, a well-formed container holding no static
// chain, never 14.20, its finding located at the whole expression (SPEC 14;
// T14-11) — while TypeScript-only syntax (a non-null assertion `BASE.a!`, a
// type assertion `BASE.a as X`) is a parse failure of the file, 14.20 alone
// and never 14.8, with the one zero-length range at the offset SPEC 14's
// syntax-failure rule fixes: the byte length of the longest whole-character
// prefix of the file with which some well-formed file begins. Precomputed
// per form from the fixture's exact bytes: for `BASE.a!` the byte after `!`
// — the closing brace in `d`, the closing parenthesis in `text(...)` — since
// `!` may begin `!=`, so the prefix through `!` begins a well-formed file;
// for `BASE.a as X` the offset of `as`, no well-formed file continuing a
// member expression with an identifier (the prefix through the space before
// it does begin one). The stock MDX 3 parser (S-9, `deriveMdx`) rejects each
// of the four stagings at that offset or one byte before it — its own
// position, not the rule's — and the workspace builder holds each to its
// `unparseable` declaration. The TypeScript-source counterparts, where the
// same spellings are dynamic (14.8), are T4.5-3's and T4.3-2's.
interface DynamicFormArm {
  /** Which SPEC 2.4 form this is (failure diagnostics). */
  readonly name: string;
  /** The offending expression, used verbatim in `d` and in `text(...)`. */
  readonly expression: string;
  /**
   * TypeScript-only syntax (14.20, never 14.8): the syntax failure's offset
   * relative to the expression's first byte, `expression.length` naming the
   * byte after it (the closing brace in `d`, the closing parenthesis in
   * `text(...)`).
   */
  readonly unparseableAt?: number;
  /**
   * The `d` arm's 14.8 finding is pinned exactly at the whole expression —
   * first token through last, the braces excluded (SPEC 14; T14-11) — where
   * the entry fixes that range, rather than within the widened byte window.
   */
  readonly exactExpressionRange?: true;
}

const DYNAMIC_FORM_ARMS: readonly DynamicFormArm[] = [
  { name: "a template literal argument", expression: "`alpha`" },
  { name: "an identifier as index", expression: "BASE[key]" },
  { name: "a call as index", expression: "BASE[getKey()]" },
  { name: "optional chaining", expression: "BASE?.auth" },
  { name: "a parenthesized chain", expression: "(BASE.auth)" },
  {
    name: "a conditional expression",
    expression: "true ? BASE.auth : BASE.auth",
  },
  {
    // ECMAScript reads `BASE.auth<X>y` as two comparisons, `(BASE.auth < X)
    // > y`: a well-formed container holding no static chain (SPEC 2.4).
    name: 'the "another meaning" case, two comparisons',
    expression: "BASE.auth<X>y",
    exactExpressionRange: true,
  },
  {
    // `!` may begin `!=`: the prefix through `!` begins a well-formed file,
    // the one through the next byte (`}` or `)`) does not.
    name: "a non-null assertion (TypeScript-only)",
    expression: "BASE.auth!",
    unparseableAt: "BASE.auth!".length,
  },
  {
    // No well-formed file continues a member expression with an identifier:
    // the prefix through the space before `as` begins one, the one through
    // its `a` does not.
    name: "a type assertion (TypeScript-only)",
    expression: "BASE.auth as X",
    unparseableAt: "BASE.auth ".length,
  },
];

// Shared preamble of every dynamic-form fixture: the import the chain forms
// are rooted at (unused imports are valid, SPEC 2.1, so it is harmless where
// a form never mentions BASE) and the `alpha` node. The offending construct
// starts exactly at this preamble's byte length.
const DYNAMIC_ARM_PREAMBLE =
  'import BASE from "./BASE.xspec"\n\n<S id="alpha">\nAlpha behavior.\n</S>\n\n';

const DYNAMIC_ARM_BASE_FILES = {
  "specs/BASE.mdx": '<S id="auth">\nAuth behavior.\n</S>\n',
} as const;

/** The byte range of `expression` when it follows `prefix` in the file. */
function expressionRange(
  prefix: string,
  expression: string,
): { readonly start: number; readonly end: number } {
  const start = Buffer.byteLength(prefix, "utf8");
  return { start, end: start + Buffer.byteLength(expression, "utf8") };
}

/**
 * Assert a located finding's concern exactly (SPEC 14, 12.7): `path` null,
 * and exactly one location — in specs/A.mdx, at exactly `range`.
 */
function assertT242FindingRange(
  finding: Finding,
  range: { readonly start: number; readonly end: number },
  context: string,
): void {
  assertSameJson(
    finding.path,
    null,
    `${context} — a located condition's concerned path is null (SPEC 12.7)`,
  );
  assertSameJson(
    finding.locations.map((location) => ({
      file: location.file,
      range: { start: location.range.start, end: location.range.end },
    })),
    [{ file: "specs/A.mdx", range: { start: range.start, end: range.end } }],
    `${context} (message: ${JSON.stringify(finding.message)})`,
  );
}

/** One arm's staged `specs/A.mdx` and where its offending bytes stand. */
interface RejectedFormStaging {
  /** The whole staged source. */
  readonly source: string;
  /**
   * The offending construct's byte window — the opening tag carrying the
   * braced `d` value, or the embedding container (end-widened by one byte,
   * `byteWindow`).
   */
  readonly window: { readonly start: number; readonly end: number };
  /** The expression's own byte range, first token through last. */
  readonly expression: { readonly start: number; readonly end: number };
}

/**
 * Run one dynamic-form arm: `build --json` exits 1 with exactly one finding,
 * condition 14.8, located within the offending construct's own byte window
 * in `specs/A.mdx` (SPEC 14: errors identify file and location) — or, where
 * `exactRange` is given, exactly at that range (SPEC 14; T14-11).
 */
async function runDynamicFormArm(
  product: ProductBinding,
  staging: RejectedFormStaging,
  exactRange: { readonly start: number; readonly end: number } | undefined,
  context: string,
): Promise<void> {
  await withWorkspace(
    SPECS_ONLY_CONFIG,
    { ...DYNAMIC_ARM_BASE_FILES, "specs/A.mdx": staging.source },
    async (workspace) => {
      const findings = await buildFindings(product, workspace, context);
      assertConditionCounts(
        findings,
        { "14.8": 1 },
        `${context} — a form ECMAScript 2024 derives that makes the ` +
          `reference dynamic: 14.8, never 14.20 (SPEC 2.4)`,
      );
      if (exactRange === undefined) {
        assertFindingLocated(
          findings[0]!,
          { file: "specs/A.mdx", window: staging.window },
          `${context}: the 14.8 finding`,
        );
      } else {
        assertT242FindingRange(
          findings[0]!,
          exactRange,
          `${context}: the 14.8 finding, located at the whole expression ` +
            `its braces enclose — first token through last, the braces ` +
            `excluded (SPEC 14; T14-11)`,
        );
      }
    },
  );
}

/**
 * Run one TypeScript-only arm: the file is not well-formed MDX (SPEC 2.4,
 * 14.20), so `build --json` exits 1 with exactly one finding, 14.20 — the
 * masked file reports nothing else, never 14.8 — carrying the one
 * zero-length range at `offset`, the syntax failure's offset under SPEC 14's
 * rule. S-9: the staging is declared unparseable.
 */
async function runUnparseableFormArm(
  product: ProductBinding,
  source: string,
  offset: number,
  context: string,
): Promise<void> {
  await withWorkspace(
    SPECS_ONLY_CONFIG,
    { ...DYNAMIC_ARM_BASE_FILES, "specs/A.mdx": source },
    async (workspace) => {
      const findings = await buildFindings(product, workspace, context);
      assertConditionCounts(
        findings,
        { "14.20": 1 },
        `${context} — TypeScript-only syntax in a spec source is a parse ` +
          `failure of the file: 14.20 alone, never a dynamic reference ` +
          `(SPEC 2.4, 14.20)`,
      );
      assertT242FindingRange(
        findings[0]!,
        { start: offset, end: offset },
        `${context} — the one zero-length range at the offset SPEC 14's ` +
          `syntax-failure rule fixes: the byte length of the longest ` +
          `whole-character prefix with which some well-formed file begins ` +
          `(SPEC 14; T14-11)`,
      );
    },
    { unparseable: ["specs/A.mdx"] },
  );
}

const T2_4_2 = defineProductTest({
  id: "T2.4-2",
  title:
    'each dynamic form — template literal argument; identifier or call as index; optional chaining; parenthesized chain; conditional expression; the "another meaning" case `BASE.a<X>y`, two comparisons, its `d` finding at the whole expression — fails with 14.8, in `d` and in `text(...)`, in MDX, while TypeScript-only syntax — a non-null assertion, a type assertion — is 14.20 alone at the offset SPEC 14\'s syntax-failure rule fixes (SPEC 2.4, 14.8, 14.20)',
  run: async (product) => {
    for (const arm of DYNAMIC_FORM_ARMS) {
      // In `d`: the offending construct is the opening tag carrying the
      // braced reference (SPEC 2.7: a braced `d` value that is not a static
      // reference or array literal of them is a dynamic argument, 14.8); its
      // expression starts right after `d={`.
      const dTagPrefix = '<S id="bad" d={';
      const dConstruct = `${dTagPrefix}${arm.expression}}>`;
      const dStaging: RejectedFormStaging = {
        source: DYNAMIC_ARM_PREAMBLE + dConstruct + "\nBad reference.\n</S>\n",
        window: byteWindow(DYNAMIC_ARM_PREAMBLE, dConstruct),
        expression: expressionRange(
          DYNAMIC_ARM_PREAMBLE + dTagPrefix,
          arm.expression,
        ),
      };
      const dContext = `T2.4-2 \`build --json\` with ${arm.name} in \`d\``;
      if (arm.unparseableAt === undefined) {
        await runDynamicFormArm(
          product,
          dStaging,
          arm.exactExpressionRange === true ? dStaging.expression : undefined,
          dContext,
        );
      } else {
        await runUnparseableFormArm(
          product,
          dStaging.source,
          dStaging.expression.start + arm.unparseableAt,
          dContext,
        );
      }

      // In `text(...)`: the offending construct is the embedding container
      // on its own line inside an otherwise valid section; its expression
      // starts right after `{text(`.
      const textPrefix = DYNAMIC_ARM_PREAMBLE + '<S id="bad">\n';
      const callPrefix = "{text(";
      const textConstruct = `${callPrefix}${arm.expression})}`;
      const textStaging: RejectedFormStaging = {
        source: textPrefix + textConstruct + "\n</S>\n",
        window: byteWindow(textPrefix, textConstruct),
        expression: expressionRange(textPrefix + callPrefix, arm.expression),
      };
      const textContext = `T2.4-2 \`build --json\` with ${arm.name} in \`text(...)\``;
      if (arm.unparseableAt === undefined) {
        // An embedding's 14.8 is located by its full braced container (SPEC
        // 14), asserted within the construct's window as the sibling arms are.
        await runDynamicFormArm(product, textStaging, undefined, textContext);
      } else {
        await runUnparseableFormArm(
          product,
          textStaging.source,
          textStaging.expression.start + arm.unparseableAt,
          textContext,
        );
      }
    }
  },
});

// ---------------------------------------------------------------------------
// T2.4-3
// ---------------------------------------------------------------------------

// Arity (SPEC 2.4: a `text(...)` call MUST have exactly one argument). The
// two-argument arm passes two static, resolvable local strings — both target
// nodes exist — so the arity is the arm's only defect (a product accepting
// two arguments would build clean and fail the exit-1 expectation), and the
// zero-argument arm has nothing to resolve at all; either way exactly one
// 14.8 must be reported, at the call.
const ARITY_PREAMBLE =
  '<S id="alpha">\nAlpha behavior.\n</S>\n\n<S id="beta">\nBeta behavior.\n</S>\n\n<S id="bad">\n';

const ARITY_ARMS: readonly { name: string; construct: string }[] = [
  { name: "zero arguments", construct: "{text()}" },
  { name: "two arguments", construct: '{text("alpha", "beta")}' },
];

const T2_4_3 = defineProductTest({
  id: "T2.4-3",
  title:
    "`text()` with zero and with two arguments fails with 14.8 (SPEC 2.4, 14.8)",
  run: async (product) => {
    for (const arm of ARITY_ARMS) {
      const context = `T2.4-3 \`build --json\` with \`text\` called with ${arm.name}`;
      await withWorkspace(
        SPECS_ONLY_CONFIG,
        { "specs/A.mdx": ARITY_PREAMBLE + arm.construct + "\n</S>\n" },
        async (workspace) => {
          const findings = await buildFindings(product, workspace, context);
          assertConditionCounts(findings, { "14.8": 1 }, context);
          assertFindingLocated(
            findings[0]!,
            {
              file: "specs/A.mdx",
              window: byteWindow(ARITY_PREAMBLE, arm.construct),
            },
            `${context}: the 14.8 finding`,
          );
        },
      );
    }
  },
});

// ---------------------------------------------------------------------------
// T2.4-4
// ---------------------------------------------------------------------------

// Computed access is segment-exact (SPEC 2.4, 1.4): a chain segment is
// exactly one ID segment and no segment contains `.`, so against a module
// whose file contains nodes `a` and `a.b`, the *static* chain `BASE["a.b"]`
// resolves to nothing — its single segment `a.b` can name no node — while
// `BASE["a"]["b"]` and `BASE.a.b` resolve to node `a.b` and the same-file
// local string `d={"a.b"}` names the whole dotted *path* (SPEC 2.2).
const SEGMENT_EXACT_BASE =
  '<S id="a">\nA text.\n\n<S id="a.b">\nB text.\n</S>\n</S>\n';

// 14.5 arm: the dotted computed index in `d`.
const T2_4_4_D_PREFIX = 'import BASE from "./BASE.xspec"\n\n';
const T2_4_4_D_CONSTRUCT = '<S id="bad" d={BASE["a.b"]}>';
const T2_4_4_D_SOURCE =
  T2_4_4_D_PREFIX + T2_4_4_D_CONSTRUCT + "\nDotted computed index.\n</S>\n";

// 14.6 arm: the same chain as the `text(...)` argument.
const T2_4_4_TEXT_PREFIX = 'import BASE from "./BASE.xspec"\n\n<S id="bad">\n';
const T2_4_4_TEXT_CONSTRUCT = '{text(BASE["a.b"])}';
const T2_4_4_TEXT_SOURCE =
  T2_4_4_TEXT_PREFIX + T2_4_4_TEXT_CONSTRUCT + "\n</S>\n";

// 14.7 arm: the same chain as a TypeScript dependency marker (SPEC 4.5). The
// file is staged valid first — `BASE.a` is a resolving marker — so the
// workspace shape (config, import form, marker position) is proven accepted
// before the dotted index becomes the one defect; the first build also
// generates the spec module (13.1), and the failing second build modifies
// nothing (12.1), leaving the generated module in place for the type-error
// arm compiled under standard TypeScript tooling (HARNESS-05, SPEC 13.1).
const T2_4_4_VALID_CONSUMER =
  'import BASE from "../specs/BASE.xspec";\n\nBASE.a;\n';
const T2_4_4_MARKER_PREFIX = 'import BASE from "../specs/BASE.xspec";\n\n';
const T2_4_4_MARKER_CONSTRUCT = 'BASE["a.b"];';
const T2_4_4_MARKER_CONSUMER =
  T2_4_4_MARKER_PREFIX + T2_4_4_MARKER_CONSTRUCT + "\n";

// Positive arms: segment-per-index computed chain and dot chain resolve to
// node `a.b`; the local string names the dotted path within the declaring
// file. The importing file carries its *own* `a`/`a.b` nodes: BASE's
// same-named nodes are the decoys — a product resolving the local string in
// the imported file records `to: specs/BASE.mdx#a.b` and fails the exact
// edge-set comparison.
const T2_4_4_POSITIVE_SOURCE = [
  'import BASE from "./BASE.xspec"',
  "",
  '<S id="a">',
  "Local a text.",
  "",
  '<S id="a.b">',
  "Local b text.",
  "</S>",
  "</S>",
  "",
  '<S id="viaBrackets" d={BASE["a"]["b"]}>',
  "Segment-per-index computed chain.",
  "</S>",
  "",
  '<S id="viaDots" d={BASE.a.b}>',
  "Dot chain.",
  "</S>",
  "",
  '<S id="viaLocal" d={"a.b"}>',
  "Local string naming the two-segment path.",
  "</S>",
  "",
].join("\n");

const T2_4_4 = defineProductTest({
  id: "T2.4-4",
  title:
    'computed access is segment-exact: `BASE["a.b"]` fails with 14.5 in `d`, 14.6 in `text(...)`, and 14.7 as a TypeScript marker (also a type error against the generated module), while `BASE["a"]["b"]`, `BASE.a.b`, and the local string `d={"a.b"}` resolve to node `a.b` (SPEC 2.4, 1.4, 2.2, 4.5, 14.5–14.7)',
  run: async (product) => {
    // 14.5: unresolved `d` reference — the segment `a.b` names no node even
    // though the node `a.b` exists (its path is two segments, `a` then `b`).
    const dContext =
      'T2.4-4 `build --json` with `d={BASE["a.b"]}` (dotted computed index)';
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { "specs/BASE.mdx": SEGMENT_EXACT_BASE, "specs/A.mdx": T2_4_4_D_SOURCE },
      async (workspace) => {
        const findings = await buildFindings(product, workspace, dContext);
        assertConditionCounts(findings, { "14.5": 1 }, dContext);
        assertFindingLocated(
          findings[0]!,
          {
            file: "specs/A.mdx",
            window: byteWindow(T2_4_4_D_PREFIX, T2_4_4_D_CONSTRUCT),
          },
          `${dContext}: the 14.5 finding`,
        );
      },
    );

    // 14.6: the same unresolvable chain as the `text(...)` argument.
    const textContext =
      'T2.4-4 `build --json` with `text(BASE["a.b"])` (dotted computed index)';
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      {
        "specs/BASE.mdx": SEGMENT_EXACT_BASE,
        "specs/A.mdx": T2_4_4_TEXT_SOURCE,
      },
      async (workspace) => {
        const findings = await buildFindings(product, workspace, textContext);
        assertConditionCounts(findings, { "14.6": 1 }, textContext);
        assertFindingLocated(
          findings[0]!,
          {
            file: "specs/A.mdx",
            window: byteWindow(T2_4_4_TEXT_PREFIX, T2_4_4_TEXT_CONSTRUCT),
          },
          `${textContext}: the 14.6 finding`,
        );
      },
    );

    // 14.7 + type error: the same chain as a TypeScript dependency marker.
    await withWorkspace(
      SPEC_AND_CODE_CONFIG,
      {
        "specs/BASE.mdx": SEGMENT_EXACT_BASE,
        "src/app.ts": T2_4_4_VALID_CONSUMER,
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T2.4-4 `build` with the resolving marker `BASE.a` (staging: proves the " +
            "workspace shape valid and generates the spec module, SPEC 13.1)",
        );

        await workspace.file("src/app.ts", T2_4_4_MARKER_CONSUMER);
        const markerContext =
          'T2.4-4 `build --json` with the TypeScript marker `BASE["a.b"]`';
        const findings = await buildFindings(product, workspace, markerContext);
        assertConditionCounts(findings, { "14.7": 1 }, markerContext);
        assertFindingLocated(
          findings[0]!,
          {
            file: "src/app.ts",
            window: byteWindow(T2_4_4_MARKER_PREFIX, T2_4_4_MARKER_CONSTRUCT),
          },
          `${markerContext}: the 14.7 finding`,
        );

        // The failing build modified nothing (SPEC 12.1), so the module
        // generated by the passing build is still in place: under standard
        // TypeScript tooling the marker must be a type error (14.7 "this is
        // also a type error against the generated module") — located at the
        // dotted index, which lies within the reported span whether the
        // compiler blames the whole element access or the index expression.
        const consumer = await ConsumerProject.load({
          rootDir: workspace.root,
          rootFiles: ["src/app.ts"],
        });
        assertCompileErrorAt(
          consumer,
          consumer.locate("src/app.ts", '["a.b"]', { charOffset: 2 }),
          {},
          'T2.4-4 the marker `BASE["a.b"]` against the generated module — no segment ' +
            "contains `.`, so no property `a.b` exists on the root node (SPEC 2.4, " +
            "1.4, 4.1, 14.7)",
        );
      },
    );

    // Positive arms: segment-exact spellings resolve to node `a.b`, and the
    // local string form names the dotted path (SPEC 2.2).
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      {
        "specs/BASE.mdx": SEGMENT_EXACT_BASE,
        "specs/A.mdx": T2_4_4_POSITIVE_SOURCE,
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T2.4-4 `build` with the segment-exact and local-string spellings",
        );
        assertEdgeSetEqual(
          await queryEdgesOfKind(
            product,
            workspace,
            "depends",
            "T2.4-4 positive arms:",
          ),
          [
            {
              from: "specs/A.mdx#viaBrackets",
              to: "specs/BASE.mdx#a.b",
              kind: "depends",
            },
            {
              from: "specs/A.mdx#viaDots",
              to: "specs/BASE.mdx#a.b",
              kind: "depends",
            },
            {
              from: "specs/A.mdx#viaLocal",
              to: "specs/A.mdx#a.b",
              kind: "depends",
            },
          ],
          'T2.4-4 the complete `depends` edge set — `BASE["a"]["b"]` and ' +
            "`BASE.a.b` resolve to the imported node `a.b`, and the local string " +
            '`"a.b"` names the path within the declaring file, not the imported ' +
            "decoy (SPEC 2.4, 2.2, 1.5)",
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T2.4-5
// ---------------------------------------------------------------------------

// Verbatim literals (SPEC 2.4): the value of a static string literal is the
// characters between its delimiters exactly as spelled — no escape sequence
// or character reference interpreted — so a spelling whose interpreted value
// would name a node names nothing: a local value containing `\` or `&` names
// no valid identity (1.4) and a computed key spelled with an escape is a
// segment no node has. Every negative arm is staged beside the node its
// interpreted value would name — the local `login` and local path `a.b` in
// the declaring file, and `a.b` and `login` in the imported BASE — so a
// product interpreting the spelling resolves it, reports nothing for it,
// and fails the exact condition counts. (The escape-spelled computed key
// `BASE["a\u002Eb"]` is 14.5 for a verbatim reader and for an interpreting
// one alike — its interpreted key `a.b` is a single segment naming nothing,
// T2.4-4 — while `text(BASE["\u0061"]["b"])` discriminates: interpreted,
// its keys would resolve to `a.b`.)
//
// The code-source half: the marker `BASE.lo\u0067in` — a chain segment
// carrying a Unicode escape spells a name containing `\`, which no segment
// contains (2.4) — is 14.7, records no edge and no occurrence (5.7), while
// the escape-free control `BASE.login` beside it records its edge, witnessed
// through `occurrences` (11.3), which answers on the failing workspace
// (11.2) — `query edges` does not (13.3), so the edge behind the control's
// occurrence record is the witness, and a second record for the escaped
// spelling (its tuple identical to the control's) is a phantom the exact
// multiset rejects. The discriminating half rides H-2's standard-tooling
// channel: the consumer file type-checks clean against the prior valid
// generation (TypeScript reads the escaped identifier as `login`, which the
// generated module exports), so a product deriving resolution from the
// interpreted name — no finding, an edge, a record — fails this arm, and
// 14.7's type-error clause is not what makes the finding (SPEC 14.7: it
// holds only for a spelling free of escape sequences).
//
// The escape spellings are composed from the backslash's code point (the
// Task 18 pattern) so they stand in the staged files as their six-character
// sequences, never decoded on the way in; the character reference `&#46;` is
// plain ASCII. Fixtures stay pure ASCII, so string indices are byte offsets.
const BACKSLASH = String.fromCodePoint(0x5c);
/** The ten characters `lo\u0067in` as spelled; interpreted they read `login`. */
const ESCAPED_LOGIN = `lo${BACKSLASH}u0067in`;
/** The eight characters `a\u002Eb` as spelled; interpreted they read `a.b`. */
const ESCAPED_DOTTED_KEY = `a${BACKSLASH}u002Eb`;
/** The six characters `\u0061` as spelled; interpreted they read `a`. */
const ESCAPED_A_KEY = `${BACKSLASH}u0061`;
/** The character-reference spelling whose interpreted value reads `a.b`. */
const REFERENCE_DOTTED_PATH = "a&#46;b";

// The imported module: `login` (what the escaped marker's interpreted name,
// and TypeScript's reading of it, would name) and `a` with child `a.b` (what
// the interpreted computed keys would name).
const T2_4_5_BASE = [
  '<S id="login">',
  "The node an interpreted escape spelling would name.",
  "</S>",
  "",
  '<S id="a">',
  "A text.",
  "",
  '<S id="a.b">',
  "B text.",
  "</S>",
  "</S>",
  "",
].join("\n");

// The declaring file's valid head — the initial state (its import unused,
// SPEC 2.1) — holding the local `login` and the local path `a.b` the
// interpreted local spellings would name.
const T2_4_5_HEAD = [
  'import BASE from "./BASE.xspec"',
  "",
  '<S id="login">',
  "The local node an interpreted escape spelling would name.",
  "</S>",
  "",
  '<S id="a">',
  "Local a text.",
  "",
  '<S id="a.b">',
  "Local b text.",
  "</S>",
  "</S>",
  "",
  "",
].join("\n");

/** One verbatim-literal spelling and the condition it must report. */
interface VerbatimArm {
  /** The spelling as it stands in the source (failure diagnostics). */
  readonly name: string;
  readonly condition: "14.5" | "14.6";
  /** The offending construct: the opening tag for `d`, the container for `text`. */
  readonly construct: string;
}

// specs/A.mdx after the edit, as an exact sequence of parts: the head, then
// each arm's construct with its surrounding text, so every construct's byte
// window follows from the parts before it. Arm order within a condition is
// source order — the order `findingsInSourceOrder` selects.
const T2_4_5_MDX_PARTS: readonly (string | VerbatimArm)[] = [
  T2_4_5_HEAD,
  {
    name: `d={"${ESCAPED_LOGIN}"}`,
    condition: "14.5",
    construct: `<S id="e1" d={"${ESCAPED_LOGIN}"}>`,
  },
  "\nEscape-spelled local dependency.\n</S>\n\n",
  '<S id="e2">\n',
  {
    name: `{text("${ESCAPED_LOGIN}")}`,
    condition: "14.6",
    construct: `{text("${ESCAPED_LOGIN}")}`,
  },
  "\n</S>\n\n",
  {
    name: `d={"${REFERENCE_DOTTED_PATH}"}`,
    condition: "14.5",
    construct: `<S id="e3" d={"${REFERENCE_DOTTED_PATH}"}>`,
  },
  "\nReference-spelled local dependency.\n</S>\n\n",
  {
    name: `d={BASE["${ESCAPED_DOTTED_KEY}"]}`,
    condition: "14.5",
    construct: `<S id="e4" d={BASE["${ESCAPED_DOTTED_KEY}"]}>`,
  },
  "\nEscape-spelled computed key.\n</S>\n\n",
  '<S id="e5">\n',
  {
    name: `{text(BASE["${ESCAPED_A_KEY}"]["b"])}`,
    condition: "14.6",
    construct: `{text(BASE["${ESCAPED_A_KEY}"]["b"])}`,
  },
  "\n</S>\n",
];

const T2_4_5_MDX_SOURCE = T2_4_5_MDX_PARTS.map((part) =>
  typeof part === "string" ? part : part.construct,
).join("");

/** The staged arms of one condition in source order, each with its byte window. */
function verbatimArmsOf(
  condition: VerbatimArm["condition"],
): readonly { arm: VerbatimArm; window: { start: number; end: number } }[] {
  const arms: { arm: VerbatimArm; window: { start: number; end: number } }[] =
    [];
  let prefix = "";
  for (const part of T2_4_5_MDX_PARTS) {
    if (typeof part === "string") {
      prefix += part;
      continue;
    }
    if (part.condition === condition) {
      arms.push({ arm: part, window: byteWindow(prefix, part.construct) });
    }
    prefix += part.construct;
  }
  return arms;
}

// src/app.ts: the escape-free control marker at the top level (the initial
// state, valid), then — the edit — the escape-spelled marker beside it.
const T2_4_5_APP_PREFIX = 'import BASE from "../specs/BASE.xspec";\n\n';
const T2_4_5_APP_CONTROL_CHAIN = "BASE.login";
const T2_4_5_APP_INITIAL = `${T2_4_5_APP_PREFIX}${T2_4_5_APP_CONTROL_CHAIN};\n`;
const T2_4_5_APP_ESCAPED_MARKER = `BASE.${ESCAPED_LOGIN};`;
const T2_4_5_APP_EDITED = `${T2_4_5_APP_INITIAL}${T2_4_5_APP_ESCAPED_MARKER}\n`;

// The control's occurrence: from the whole file (no named unit encloses it,
// SPEC 4.6) to BASE's `login`, spanning the bare chain alone, exclusive of
// the statement terminator (5.7).
const T2_4_5_CONTROL_UNIT: OccurrenceUnit = {
  what: "the escape-free control marker `BASE.login` at the top level of src/app.ts",
  file: "src/app.ts",
  kind: "references",
  source: "src/app.ts",
  target: "specs/BASE.mdx#login",
  count: 1,
};
const T2_4_5_CONTROL_RANGE = {
  start: Buffer.byteLength(T2_4_5_APP_PREFIX, "utf8"),
  end:
    Buffer.byteLength(T2_4_5_APP_PREFIX, "utf8") +
    Buffer.byteLength(T2_4_5_APP_CONTROL_CHAIN, "utf8"),
};

/**
 * The six staged spellings and nothing else: exactly three 14.5, two 14.6,
 * one 14.7 (SPEC 14: every condition reported, and nothing for the control
 * marker or the nodes beside the arms), each located within its own
 * construct's byte window.
 */
function assertVerbatimFindings(
  findings: readonly Finding[],
  context: string,
): void {
  assertConditionCounts(
    findings,
    { "14.5": 3, "14.6": 2, "14.7": 1 },
    `${context}: exactly the six verbatim spellings are reported — the ` +
      `escape-spelled local \`d\` literal, the reference-spelled local \`d\` ` +
      `literal, and the escape-spelled computed key are 14.5; the ` +
      `escape-spelled local \`text\` literal and the escape-spelled computed ` +
      `keys in \`text\` are 14.6; the escape-spelled marker is 14.7 — and ` +
      `nothing for the escape-free control \`BASE.login\` (SPEC 2.4, 1.4, ` +
      `14.5–14.7): a product interpreting a spelling resolves it to the node ` +
      `staged beside it and drops its finding`,
  );
  for (const condition of ["14.5", "14.6"] as const) {
    const reported = findingsInSourceOrder(findings, condition);
    const staged = verbatimArmsOf(condition);
    staged.forEach(({ arm, window }, index) => {
      assertFindingLocated(
        reported[index]!,
        { file: "specs/A.mdx", window },
        `${context}: the ${condition} finding for \`${arm.name}\` locates ` +
          `that spelling's own construct (SPEC 14, 2.4)`,
      );
    });
  }
  assertFindingLocated(
    findingsInSourceOrder(findings, "14.7")[0]!,
    {
      file: "src/app.ts",
      window: byteWindow(T2_4_5_APP_INITIAL, T2_4_5_APP_ESCAPED_MARKER),
    },
    `${context}: the 14.7 finding locates the escape-spelled marker ` +
      `\`${T2_4_5_APP_ESCAPED_MARKER}\` — a segment carrying a Unicode ` +
      `escape spells a name containing \`\\\`, which no segment contains, so ` +
      `the reference resolves nowhere (SPEC 2.4, 1.4, 4.5, 14.7) — never ` +
      `the control beside it`,
  );
}

const T2_4_5 = defineProductTest({
  id: "T2.4-5",
  title: `verbatim literals: every static string literal is read exactly as spelled, no escape sequence or character reference interpreted, so a spelling whose interpreted value would name a node names nothing — beside the local \`login\` and \`a.b\` and BASE's \`a.b\` and \`login\`, \`d={"${ESCAPED_LOGIN}"}\` and \`{text("${ESCAPED_LOGIN}")}\` are 14.5 and 14.6, \`d={"${REFERENCE_DOTTED_PATH}"}\` 14.5, \`d={BASE["${ESCAPED_DOTTED_KEY}"]}\` and \`{text(BASE["${ESCAPED_A_KEY}"]["b"])}\` 14.5 and 14.6, each at its own construct; the TypeScript marker \`BASE.${ESCAPED_LOGIN}\` is 14.7 and records no edge and no occurrence — \`occurrences\` lists exactly the escape-free control \`BASE.login\`'s record beside it, spanning the bare chain — while the consumer file type-checks clean against the prior valid generation (TypeScript reads the escaped identifier as \`login\`, which exists), so a product resolving the interpreted name fails (SPEC 2.4, 1.4, 4.5, 5.7, 11.3, 14.5–14.7)`,
  run: async (product) => {
    await withWorkspace(
      SPEC_AND_CODE_CONFIG,
      {
        "specs/BASE.mdx": T2_4_5_BASE,
        "specs/A.mdx": T2_4_5_HEAD,
        "src/app.ts": T2_4_5_APP_INITIAL,
      },
      async (workspace) => {
        // Staging: the initial state is valid, so the workspace shape (the
        // configuration, both import forms, the control marker) is proven
        // accepted before the verbatim spellings become the only defects,
        // and the build generates the spec modules (SPEC 13.1) — the prior
        // valid generation the type-check arm compiles against, which the
        // failing build below leaves in place (12.1).
        await buildOk(
          product,
          workspace,
          "T2.4-5 initial `build` (staging: the valid head with the " +
            "escape-free control marker; generates specs/BASE.xspec.ts, " +
            "SPEC 13.1)",
        );

        await workspace.file("specs/A.mdx", T2_4_5_MDX_SOURCE);
        await workspace.file("src/app.ts", T2_4_5_APP_EDITED);

        const buildContext =
          "T2.4-5 `build --json` over the six verbatim spellings";
        assertVerbatimFindings(
          await buildFindings(product, workspace, buildContext),
          buildContext,
        );

        // The discriminating half (H-2's standard-tooling channel): against
        // the prior valid generation, the consumer file — the control and
        // the escape-spelled marker — type-checks clean, since TypeScript
        // reads `BASE.lo\u0067in` as `BASE.login`, which the generated
        // module exports (SPEC 4.1). So the 14.7 finding above is owed to
        // the verbatim reading alone (SPEC 2.4), not to a missing property:
        // 14.7's type-error clause holds only for a spelling free of escape
        // sequences (14.7).
        const consumer = await ConsumerProject.load({
          rootDir: workspace.root,
          rootFiles: ["src/app.ts"],
        });
        assertNoCompileErrors(
          consumer,
          `T2.4-5 the consumer file holding the control \`BASE.login\` and ` +
            `the escape-spelled marker \`${T2_4_5_APP_ESCAPED_MARKER}\` must ` +
            `type-check clean against the prior valid generation — ` +
            `TypeScript reads the escaped identifier as \`login\`, which the ` +
            `generated module exports (SPEC 14.7, 2.4, 4.1)`,
        );

        // No edge, no occurrence for the escaped marker; the control records
        // its edge. `occurrences` answers on the failing workspace, the
        // domain's findings accompanying (SPEC 11.2, 11.3; exit 1), and the
        // complete record multiset is exactly the control's one record —
        // its (file, kind, source, target) tuple and its exact span — so a
        // record for the escaped spelling (a tuple identical to the
        // control's, at another span) is caught by count, and a record at
        // the escaped span in place of the control's by the span.
        const occContext = "T2.4-5 `occurrences` over the failing workspace";
        const result = await expectExit(
          product,
          workspace,
          ["occurrences"],
          1,
          `${occContext} — an answer carrying any finding exits 1, the full ` +
            `answer document still emitted (SPEC 11.2, 11.3)`,
        );
        const report = decodeOccurrencesReport(
          parseJsonStdout(result, occContext),
          occContext,
        );
        assertVerbatimFindings(report.findings, occContext);
        assertSameJson(
          report.occurrences.map(renderOccurrenceUnit).sort(),
          expectedUnitMultiset([T2_4_5_CONTROL_UNIT]),
          `${occContext}: the complete (file, [kind], source -> target) ` +
            `record multiset is exactly the escape-free control's one record ` +
            `— \`BASE.login\` from the whole file to \`specs/BASE.mdx#login\` ` +
            `— and no record for the escape-spelled marker, which resolves ` +
            `nowhere and so records no edge and no occurrence (SPEC 2.4, 5.7, ` +
            `4.5, 11.3)`,
        );
        assertSameJson(
          report.occurrences[0]!.range,
          T2_4_5_CONTROL_RANGE,
          `${occContext}: the one record spans the control's bare chain ` +
            `\`${T2_4_5_APP_CONTROL_CHAIN}\` alone, exclusive of the ` +
            `terminator (SPEC 5.7) — never the escape-spelled marker's span`,
        );
      },
    );
  },
});

/** TEST-SPEC §2.4, in canonical ID order (SUITE-08). */
export const section24Tests: readonly ProductTestEntry[] = [
  T2_4_1,
  T2_4_2,
  T2_4_3,
  T2_4_4,
  T2_4_5,
];
