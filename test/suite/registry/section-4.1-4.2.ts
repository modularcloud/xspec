// TEST-SPEC §4.1 (node skeleton) and §4.2 (documentation and navigation) —
// SUITE-13: T4.1-1, T4.1-2, T4.1-3, T4.2-1, T4.2-2, T4.2-3, T4.2-4.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5) and exact bytes where SPEC.md fixes bytes
// (H-4), and rejects a product only via diagnosed assertion failures (H-8).
// Consumer-side contracts run under standard TypeScript tooling with no xspec
// runtime dependency (SPEC 13.1) through helpers/tooling.ts, in TEST-SPEC
// H-2's two fixed configurations as section-4.ts describes: every
// type-checking verdict, hover, and definition is asserted under each of
// the two in turn — a clean verdict over the whole program, the generated
// module and the companions it reaches included; a type-error assertion
// expecting the program's diagnostics at the consumer references under
// test alone — and every runtime arm runs under the CommonJS configuration
// alone, compiled to CommonJS JavaScript written outside the workspace.
// Consumer files live under `consumer/`, matched by no configured group:
// this section's tests are "compiled under standard TypeScript tooling
// only" (TEST-SPEC §4's opening paragraph), so the staged type errors and
// probe code are never analyzed by the product and can trigger no xspec
// finding. H-2 supplies no `@types/node`, so a consumer writing to standard
// output declares the one `process` member it uses itself.
//
// Conservative operationalizations (noted per H-4 — where SPEC.md fixes the
// value, assertions are literal):
// - T4.1-1's built-in-member segments, "child properties like any other",
//   are observed on both sides of the consumer channel. The chain to each
//   segment's child `x` type-checks clean, where a node type that drops
//   the segment, or lets `Object`'s or a function's member of that name
//   stand in for it, makes the chain a diagnostic. And a runtime consumer
//   writes `text(SPEC.<segment>)` for each segment, in order, byte-compared
//   with the subtree texts hand-derived per SPEC 3 and 1.6: an inherited
//   method or a function's own `name` or `length` reaching `text` in the
//   child's place yields no node's text. Each node's prose carries a token
//   naming its own segment, so one node's text standing in for another's
//   misses the bytes too.
// - "Documentation comment": a `/** … */` block in the generated module —
//   the TypeScript form editors surface as hover documentation, which is the
//   comment's stated purpose (SPEC 4.2). Scanning for spans by the literal
//   terminator `*/` is sound *because of* the 4.2 escaping rule: inside a
//   conforming comment every emitted `*/` is written `*\/`, so the first raw
//   `*/` after `/**` is the comment's real end (and a product that leaves a
//   raw `*/` inside truncates its own comment, failing the containment
//   assertions — a correct failure).
// - "Containing the node's own text" is literal substring containment of the
//   exact own-text bytes (SPEC 1.6: both text values are exact bytes),
//   trailing line terminator included. A comment may hold more than the own
//   text, but it must hold the own text itself, unbroken — the escaping rule
//   (one fixed rewrite) only makes sense under literal embedding.
// - T4.2-2's negative arms are scoped to documentation comments, not the
//   whole module: `text()` must return subtree text at runtime with no xspec
//   dependency (SPEC 4.3, 13.1), so the module (or a companion) may
//   legitimately carry full requirement text as runtime data. What no
//   documentation comment may carry is the own text beyond its 1000th code
//   point (SPEC 4.2: truncated to the first 1000 code points).
// - T4.2-4 "resolve into the source `.mdx` at the corresponding `<S>`
//   section": some go-to-definition target — as standard editor tooling
//   presents it, i.e. declaration-map mapped (ConsumerProject
//   .sourceDefinitionsAt; SPEC 13.1 companion files) — whose file is the
//   `.mdx` source and whose start offset falls within the section
//   construct's own span (1.7), child constructs' spans excluded so a
//   parent reference cannot be satisfied by its child's section; for a root
//   reference, exactly the start of the file (SPEC 4.2). Fixtures are pure
//   ASCII, so tooling UTF-16 offsets equal byte offsets. Hover is asserted
//   as robust containment of a per-node sentinel in the hover documentation
//   (H-3 robust matching: language services normalize JSDoc whitespace).

import {
  assertBytesEqual,
  assertExitCode,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import type { RunResult } from "../../helpers/subprocess.js";
import {
  assertTypeChecksClean,
  assertTypeErrorsAt,
  COMMONJS_CONFIGURATION,
  ConsumerProject,
  forEachConsumerProject,
  withCompiledConsumer,
} from "../../helpers/tooling.js";
import type {
  ConsumerSources,
  FileOffset,
  SourceDefinitionTarget,
} from "../../helpers/tooling.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import { buildOk, readGeneratedModule } from "./support.js";

// Minimal declarative configuration (SPEC 7): exactly one spec group. The
// consumer files under `consumer/` are outside every group by construction.
const SPECS_ONLY_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`;

/** Stage a fresh workspace (config plus `files`), run `body`, dispose (H-1). */
async function withWorkspace<T>(
  files: Readonly<Record<string, string>>,
  body: (workspace: TestWorkspace) => Promise<T>,
): Promise<T> {
  const workspace = await TestWorkspace.create({
    files: { "xspec.config.ts": SPECS_ONLY_CONFIG, ...files },
  });
  try {
    return await body(workspace);
  } finally {
    await workspace.dispose();
  }
}

/**
 * A runtime consumer under H-2 (module header): its program type-checks
 * clean under each of H-2's configurations, the whole program included, and
 * its root file, compiled under the CommonJS configuration alone to
 * CommonJS JavaScript written outside the workspace, is run there under
 * plain Node; the run's result is returned for the caller's assertions.
 */
async function typeCheckAndRunConsumer(
  workspace: TestWorkspace,
  rootFile: string,
  context: string,
): Promise<RunResult> {
  const sources: ConsumerSources = {
    rootDir: workspace.root,
    rootFiles: [rootFile],
  };
  await forEachConsumerProject(sources, (project) =>
    assertTypeChecksClean(project, context),
  );
  return await withCompiledConsumer(
    await ConsumerProject.load({
      ...sources,
      configuration: COMMONJS_CONFIGURATION,
    }),
    context,
    async (compiled) => await compiled.run(rootFile),
  );
}

// ---------------------------------------------------------------------------
// Documentation-comment scanning (T4.2-1 … T4.2-3)
// ---------------------------------------------------------------------------

// `/**` not immediately followed by `/` (so the degenerate `/**/` cannot open
// a span), lazily to the first raw `*/` — the real comment end under the 4.2
// escaping rule (see the module header).
const DOC_COMMENT_PATTERN = /\/\*\*(?!\/)[\s\S]*?\*\//g;

/** Every documentation-comment span in a generated module, in order. */
function docCommentSpans(moduleText: string): readonly string[] {
  return [...moduleText.matchAll(DOC_COMMENT_PATTERN)].map((match) => match[0]);
}

/** Excerpt a needle for failure diagnoses without dumping kilobytes. */
function excerpt(text: string): string {
  return text.length <= 120
    ? JSON.stringify(text)
    : `${JSON.stringify(`${text.slice(0, 117)}`)}… (${String(text.length)} chars)`;
}

/** Assert some documentation comment contains `needle` literally. */
function assertSomeDocComment(
  spans: readonly string[],
  needle: string,
  context: string,
): void {
  if (spans.length === 0) {
    fail(
      `${context}: the generated module contains no documentation comment at ` +
        `all (no \`/** … */\` block; SPEC 4.2: every generated node MUST ` +
        `carry a documentation comment)`,
    );
  }
  if (!spans.some((span) => span.includes(needle))) {
    fail(
      `${context}: no documentation comment in the generated module contains ` +
        `${excerpt(needle)} (SPEC 4.2, 1.6; ${String(spans.length)} comment ` +
        `span(s) scanned)`,
    );
  }
}

/** Assert no documentation comment contains `needle`. */
function assertNoDocComment(
  spans: readonly string[],
  needle: string,
  context: string,
): void {
  if (spans.some((span) => span.includes(needle))) {
    fail(
      `${context}: a documentation comment in the generated module contains ` +
        `${excerpt(needle)}, which must not appear in any documentation ` +
        `comment (SPEC 4.2)`,
    );
  }
}

// ---------------------------------------------------------------------------
// T4.1-1, T4.1-2 — skeleton chains, type errors, built-in-member segments,
// readonly
// ---------------------------------------------------------------------------

// Three nesting levels plus a top-level segment that is not a TypeScript
// identifier (`dash-leaf`): child sections are properties named by ID
// segment, with bracket notation for non-identifier segments (SPEC 4.1, 1.4).
const TREE_SOURCE = [
  '<S id="alpha">',
  "Alpha layer prose.",
  '<S id="alpha.beta">',
  "Beta layer prose.",
  '<S id="alpha.beta.gamma">',
  "Gamma leaf prose.",
  "</S>",
  "</S>",
  "</S>",
  '<S id="dash-leaf">',
  "Dash leaf prose.",
  "</S>",
  "",
].join("\n");

// Positive arm: chains to leaves through segment-named properties, rooted at
// the default export, type-check — including bracket access for the
// non-identifier segment.
const CHAIN_CONSUMER = [
  'import SPEC from "../specs/TREE.xspec";',
  "",
  "SPEC.alpha.beta.gamma;",
  'SPEC["dash-leaf"];',
  "",
].join("\n");

// Negative arms: a missing leaf under an existing chain and a missing
// top-level path are TypeScript type errors at the consumer reference.
const MISSING_CONSUMER = [
  'import SPEC from "../specs/TREE.xspec";',
  "",
  "SPEC.alpha.beta.nope;",
  "SPEC.zeta;",
  "",
].join("\n");

// T4.1-2: assigning to a node property is a type error (readonly, SPEC 4.1) —
// one arm on a root child, one on a nested child. The right-hand sides are
// the same properties, so the assignment target is each statement's only
// defect.
const READONLY_CONSUMER = [
  'import SPEC from "../specs/TREE.xspec";',
  "",
  "SPEC.alpha = SPEC.alpha;",
  "SPEC.alpha.beta = SPEC.alpha.beta;",
  "",
].join("\n");

// T4.1-1's built-in-member segments (TEST-SPEC T4.1-1; SPEC 1.4 forbids
// none of them): top-level sections named after `Object.prototype`'s
// methods and a function's own `name` and `length`, in TEST-SPEC's order,
// each holding a child `x`. Both kinds can shadow a node's child: a plain
// object inherits the methods, and a function owns `name` and `length`.
const BUILTIN_MEMBER_SEGMENTS = [
  "toString",
  "valueOf",
  "hasOwnProperty",
  "name",
  "length",
] as const;

// Every node's prose carries a token naming its own segment (`BUILTIN-name`,
// `BUILTIN-name-x`), so each subtree text is distinct.
const BUILTIN_SOURCE = [
  ...BUILTIN_MEMBER_SEGMENTS.flatMap((segment) => [
    `<S id="${segment}">`,
    `BUILTIN-${segment} section prose.`,
    `<S id="${segment}.x">`,
    `BUILTIN-${segment}-x child prose.`,
    "</S>",
    "</S>",
  ]),
  "",
].join("\n");

// Hand-derived per SPEC 3/1.6, in segment order: the tag-only lines drop
// with their terminators, and the content lines keep theirs, the child's
// line interleaved after its parent's.
const BUILTIN_SUBTREE_TEXTS: readonly string[] = BUILTIN_MEMBER_SEGMENTS.map(
  (segment) =>
    `BUILTIN-${segment} section prose.\n` +
    `BUILTIN-${segment}-x child prose.\n`,
);

// Positive arm, type level: a chain to each segment's child `x` resolves
// through the segment's own child property. Where the node's type lacks
// that property, or an `Object` or function member of that name stands in
// for it, the chain is a diagnostic.
const BUILTIN_CHAIN_CONSUMER = [
  'import SPEC from "../specs/BUILTIN.xspec";',
  "",
  ...BUILTIN_MEMBER_SEGMENTS.map((segment) => `SPEC.${segment}.x;`),
  "",
].join("\n");

// Positive arm, runtime: `text()` on each built-in-member section writes
// that node's subtree text, in segment order, nothing else written. The
// consumer declares the one `process` member it uses (module header).
const BUILTIN_TEXT_CONSUMER = [
  'import SPEC, { text } from "../specs/BUILTIN.xspec";',
  "",
  "declare const process: { readonly stdout: { write(chunk: string): boolean } };",
  "",
  ...BUILTIN_MEMBER_SEGMENTS.map(
    (segment) => `process.stdout.write(text(SPEC.${segment}));`,
  ),
  "",
].join("\n");

const BUILTIN_TEXT_STDOUT = BUILTIN_SUBTREE_TEXTS.join("");

const T4_1_1 = defineProductTest({
  id: "T4.1-1",
  title:
    "the default export is the root, child sections are properties named by ID segment (bracket notation for a non-identifier segment), a consumer chain to a leaf type-checks clean, a chain naming a missing requirement path is a TypeScript type error at the consumer reference, the program's diagnostics there alone, and segments naming built-in members (`toString`, `valueOf`, `hasOwnProperty`, `name`, `length`) are child properties like any other — a chain to each one's child `x` type-checks clean, and `text()` on each returns its subtree text at runtime, byte-exact — every type-checking verdict under both of H-2's configurations, the runtime one compiled under its CommonJS configuration (SPEC 4.1, 1.4, 4.3, 1.6, 13.1)",
  run: async (product) => {
    await withWorkspace(
      {
        "specs/TREE.mdx": TREE_SOURCE,
        "specs/BUILTIN.mdx": BUILTIN_SOURCE,
        "consumer/chain.ts": CHAIN_CONSUMER,
        "consumer/missing.ts": MISSING_CONSUMER,
        "consumer/builtin-chain.ts": BUILTIN_CHAIN_CONSUMER,
        "consumer/builtin-text.ts": BUILTIN_TEXT_CONSUMER,
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T4.1-1 `build` over the nested spec source and the " +
            "built-in-member one",
        );

        // Under each of H-2's configurations: the chains type-check clean,
        // the whole program — the generated module and its companions —
        // included, and the missing paths are type errors at the two
        // consumer references under test alone (H-2).
        await forEachConsumerProject(
          { rootDir: workspace.root, rootFiles: ["consumer/chain.ts"] },
          (chain) =>
            assertTypeChecksClean(
              chain,
              "T4.1-1 consumer chains from the default export to the leaves — " +
                "segment-named properties, bracket notation for the " +
                "non-identifier segment `dash-leaf` (SPEC 4.1, 1.4)",
            ),
        );

        await forEachConsumerProject(
          { rootDir: workspace.root, rootFiles: ["consumer/missing.ts"] },
          (missing) =>
            assertTypeErrorsAt(
              missing,
              [
                {
                  at: missing.locate(
                    "consumer/missing.ts",
                    "SPEC.alpha.beta.nope",
                    { charOffset: "SPEC.alpha.beta.".length },
                  ),
                },
                {
                  at: missing.locate("consumer/missing.ts", "SPEC.zeta", {
                    charOffset: "SPEC.".length,
                  }),
                },
              ],
              "T4.1-1 a chain naming a missing leaf (`nope` under " +
                "`alpha.beta`) and one naming a missing top-level path " +
                "(`zeta`) must each be a TypeScript type error at the " +
                "consumer reference, and nothing else diagnosed (SPEC 4.1)",
            ),
        );

        // Built-in-member segments are child properties like any other
        // (SPEC 4.1; 1.4 forbids none of them). Under each of H-2's
        // configurations the chains to each segment's child `x`
        // type-check clean, the whole program included. Then the runtime
        // consumer, type-checked clean under each and compiled under the
        // CommonJS one, writes each segment's subtree text through `text()`
        // (T4.3-1's observation), byte-exact.
        await forEachConsumerProject(
          { rootDir: workspace.root, rootFiles: ["consumer/builtin-chain.ts"] },
          (chain) =>
            assertTypeChecksClean(
              chain,
              "T4.1-1 consumer chains to the child `x` of each top-level " +
                "section named after a built-in member (`SPEC.toString.x`, " +
                "`SPEC.valueOf.x`, `SPEC.hasOwnProperty.x`, `SPEC.name.x`, " +
                "`SPEC.length.x`) — each segment a child property like any " +
                "other, never an inherited or function-own member standing " +
                "in for the child (SPEC 4.1, 1.4)",
            ),
        );
        const textContext =
          "T4.1-1 runtime consumer passing each built-in-member section " +
          "(`SPEC.toString`, `SPEC.valueOf`, `SPEC.hasOwnProperty`, " +
          "`SPEC.name`, `SPEC.length`) to `text()` (SPEC 4.1, 4.3)";
        const textRun = await typeCheckAndRunConsumer(
          workspace,
          "consumer/builtin-text.ts",
          textContext,
        );
        assertExitCode(
          textRun,
          0,
          `${textContext}: the compiled consumer under plain Node, compiled ` +
            "under H-2's CommonJS configuration outside the workspace (SPEC " +
            "13.1)",
        );
        assertBytesEqual(
          textRun.stdoutBytes,
          BUILTIN_TEXT_STDOUT,
          `${textContext}: each call returns that section's subtree text, ` +
            "written in segment order, byte-exact — no inherited method " +
            "or function's own `name` or `length` in the child's place " +
            "(SPEC 4.1, 4.3, 1.6, 3)",
        );
      },
    );
  },
});

const T4_1_2 = defineProductTest({
  id: "T4.1-2",
  title:
    "node properties are readonly: assigning to a node property is a TypeScript type error at the assignment target, the program's diagnostics there alone, under both of H-2's configurations (SPEC 4.1, 13.1)",
  run: async (product) => {
    await withWorkspace(
      {
        "specs/TREE.mdx": TREE_SOURCE,
        "consumer/readonly.ts": READONLY_CONSUMER,
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T4.1-2 `build` over the nested spec source",
        );
        // Under each of H-2's configurations, the two assignment targets
        // are the program's only diagnosed positions (H-2's type-error
        // assertion).
        await forEachConsumerProject(
          { rootDir: workspace.root, rootFiles: ["consumer/readonly.ts"] },
          (project) =>
            assertTypeErrorsAt(
              project,
              [
                {
                  at: project.locate(
                    "consumer/readonly.ts",
                    "SPEC.alpha = SPEC.alpha;",
                    { charOffset: "SPEC.".length },
                  ),
                },
                {
                  at: project.locate(
                    "consumer/readonly.ts",
                    "SPEC.alpha.beta = SPEC.alpha.beta;",
                    { charOffset: "SPEC.alpha.".length },
                  ),
                },
              ],
              "T4.1-2 assigning to a root child property (`SPEC.alpha = …`) " +
                "and to a nested node property (`SPEC.alpha.beta = …`) must " +
                "each be a TypeScript type error at the assignment target, " +
                "and nothing else diagnosed (readonly, SPEC 4.1)",
            ),
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T4.1-3 — opaque node values, no text as values
// ---------------------------------------------------------------------------

// The fixture's texts are distinctive (TEST-SPEC T4.1-3): every node — the
// root and every parent included — has a non-empty own text carrying a token
// of its own (`OPAQ-SENTINEL-ROOT`, `-ALPHA`, `-BETA`, `-GAMMA`) that no ID
// segment, path, or identifier spells, its subtree text and every
// ancestor's carrying the token too. Every token carries the shared sentinel
// prefix, so a string equal to or containing any node's own or subtree text
// is caught by one containment check, while no property name, path,
// inherited method's source text, or JSON serialization's punctuation ever
// contains the prefix.
const OPAQ_SENTINEL_PREFIX = "OPAQ-SENTINEL";

const OPAQ_SOURCE = [
  "OPAQ-SENTINEL-ROOT preamble prose.",
  '<S id="alpha">',
  "OPAQ-SENTINEL-ALPHA prose.",
  '<S id="alpha.beta">',
  "OPAQ-SENTINEL-BETA prose.",
  "</S>",
  "</S>",
  '<S id="gamma">',
  "OPAQ-SENTINEL-GAMMA prose.",
  "</S>",
  "",
].join("\n");

// Hand-derived per SPEC 3/1.6: tag-only lines drop with their terminators,
// content lines keep theirs; subtree text interleaves children in document
// order.
const OPAQ_ROOT_SUBTREE =
  "OPAQ-SENTINEL-ROOT preamble prose.\n" +
  "OPAQ-SENTINEL-ALPHA prose.\n" +
  "OPAQ-SENTINEL-BETA prose.\n" +
  "OPAQ-SENTINEL-GAMMA prose.\n";
const OPAQ_ALPHA_SUBTREE =
  "OPAQ-SENTINEL-ALPHA prose.\nOPAQ-SENTINEL-BETA prose.\n";
const OPAQ_BETA_SUBTREE = "OPAQ-SENTINEL-BETA prose.\n";
const OPAQ_GAMMA_SUBTREE = "OPAQ-SENTINEL-GAMMA prose.\n";
const OPAQ_ACCEPT_STDOUT =
  OPAQ_ROOT_SUBTREE +
  OPAQ_ALPHA_SUBTREE +
  OPAQ_BETA_SUBTREE +
  OPAQ_GAMMA_SUBTREE;

// The value obtained by each supported child-access operation (and the root
// itself) is accepted by `text()`, and the calls return the subtree texts at
// runtime (SPEC 4.1, 4.3). It declares the one `process` member it uses
// (module header), as the probe consumer below does.
const OPAQ_ACCEPT_CONSUMER = [
  'import SPEC, { text } from "../specs/OPAQ.xspec";',
  "",
  "declare const process: { readonly stdout: { write(chunk: string): boolean } };",
  "",
  "process.stdout.write(text(SPEC));",
  "process.stdout.write(text(SPEC.alpha));",
  "process.stdout.write(text(SPEC.alpha.beta));",
  "process.stdout.write(text(SPEC.gamma));",
  "",
].join("\n");

// Every runtime value reachable from the default export by child property
// access — the root (the default export itself) and each child chain — as
// the access chain the probe consumer evaluates, in its `nodes` order: the
// walk starts from these values.
const OPAQ_NODE_CHAINS = [
  "SPEC",
  "SPEC.alpha",
  "SPEC.alpha.beta",
  "SPEC.gamma",
] as const;

// The probe's walk budget, a harness-internal limit (H-11: an exhausted one
// is a harness error, never a diagnosed product failure and never a pass —
// `OpaqueWalkCapError`): each value the walk visits (object, function, or
// primitive), and each prototype-chain link it reads keys through, costs
// one step. A conforming module can exhaust it — SPEC 4.1 constrains only
// the supported operations, so a getter minting a fresh object on every
// read is allowed so long as no text is exposed — which is why a capped
// walk is the harness's failure, not the product's. The built product's
// generated module — frozen plain-object nodes over `Object.prototype`, a
// symbol-keyed module path, the texts in a module-private map — takes 868
// steps (293 values: 114 objects and functions, the intrinsics its values
// reach included, and 179 primitives), so the cap sits far above what this
// four-node fixture's walk needs.
const OPAQ_WALK_CAP = 100_000;

// A consumer that never imports `text` and reaches every node by the
// supported child-access operation, then walks those values reflectively,
// with no depth bound. A node may be any runtime value — prototype-less,
// circular, guarded by throwing accessors, or a primitive, a string token
// carrying no requirement text included (TEST-SPEC T4.1-3: SPEC 4.1 fixes
// no runtime representation) — so the walk treats every value alike. Every
// value reached — object, function, or primitive — is walked once (a
// visited set: objects by identity, primitives by value): its string
// coercion, its JSON serialization, its own property keys and values, and
// the keys and values of every object on its prototype chain, each
// inherited key read through the walked value as receiver (`Reflect.get`)
// — so an inherited accessor yields its value for the node itself, which a
// getter keyed on the instance (a private map, a private field) withholds
// from its prototype — while the prototype objects are walked in their own
// right too (their own keys read through themselves). A primitive's own
// keys and prototype chain are its wrapper object's (`Object(value)`), read
// with the primitive itself as receiver, as a property access on it reads
// them — so a string token's inherited accessors (on `String.prototype`)
// yield their values for that token; `null` and `undefined`, which have no
// properties, contribute their string coercion and JSON serialization
// alone. Every operation is guarded: one that throws on a value (string
// coercion of a prototype-less object, JSON serialization of a circular
// one, a key listing or property read a trap or getter refuses, a prototype
// read) contributes nothing, the walk continuing with the value's other
// operations and every other value, and the walk runs off a work list, so
// no depth can overflow the stack. The visited set makes the walk finite
// over a finite value graph, and `OPAQ_WALK_CAP` bounds it loudly over any
// other. It reports `{ seen, capped }`: every observed string — a string
// token itself included — and whether the budget ran out with work left.
// No observed string may carry requirement text. A capped walk cannot show
// that none is observable, so once no leak was found,
// `judgeOpaqueProbeReport` reports it as the harness error
// `OpaqueWalkCapError` (H-11) — never a diagnosed product failure and never
// a pass.
const OPAQ_PROBE_CONSUMER = [
  'import SPEC from "../specs/OPAQ.xspec";',
  "",
  "declare const process: { readonly stdout: { write(chunk: string): boolean } };",
  "",
  "const nodes: readonly unknown[] = [",
  ...OPAQ_NODE_CHAINS.map((chain) => `  ${chain},`),
  "];",
  "const seen: string[] = [];",
  "const visited = new Set<unknown>();",
  "const pending: unknown[] = [];",
  `const cap = ${String(OPAQ_WALK_CAP)};`,
  "let steps = 0;",
  "let capped = false;",
  "",
  "function observe(value: unknown): void {",
  "  if (!visited.has(value)) {",
  "    visited.add(value);",
  "    pending.push(value);",
  "  }",
  "}",
  "",
  "function step(): boolean {",
  "  if (steps >= cap) {",
  "    capped = true;",
  "    return false;",
  "  }",
  "  steps += 1;",
  "  return true;",
  "}",
  "",
  "function readKeys(holder: object, receiver: unknown): void {",
  "  let keys: readonly (string | symbol)[];",
  "  try {",
  "    keys = [",
  "      ...Object.getOwnPropertyNames(holder),",
  "      ...Object.getOwnPropertySymbols(holder),",
  "    ];",
  "  } catch {",
  "    return;",
  "  }",
  "  for (const key of keys) {",
  "    seen.push(String(key));",
  "    let child: unknown;",
  "    try {",
  "      child = Reflect.get(holder, key, receiver);",
  "    } catch {",
  "      continue;",
  "    }",
  "    observe(child);",
  "  }",
  "}",
  "",
  "function walk(value: unknown): void {",
  "  try {",
  "    seen.push(String(value));",
  "  } catch {",
  "    // A throwing string coercion contributes nothing.",
  "  }",
  "  try {",
  "    const json = JSON.stringify(value);",
  '    if (typeof json === "string") {',
  "      seen.push(json);",
  "    }",
  "  } catch {",
  "    // A throwing JSON serialization contributes nothing.",
  "  }",
  "  if (value === null || value === undefined) {",
  "    return;",
  "  }",
  "  const target = Object(value) as object;",
  "  readKeys(target, value);",
  "  let holder: object | null;",
  "  try {",
  "    holder = Object.getPrototypeOf(target) as object | null;",
  "  } catch {",
  "    return;",
  "  }",
  "  observe(holder);",
  "  while (holder !== null) {",
  "    if (!step()) {",
  "      return;",
  "    }",
  "    readKeys(holder, value);",
  "    try {",
  "      holder = Object.getPrototypeOf(holder) as object | null;",
  "    } catch {",
  "      holder = null;",
  "    }",
  "  }",
  "}",
  "",
  "for (const node of nodes) {",
  "  observe(node);",
  "}",
  "while (pending.length > 0 && step()) {",
  "  walk(pending.pop());",
  "}",
  "",
  "process.stdout.write(JSON.stringify({ seen, capped }));",
  "",
].join("\n");

/**
 * The probe consumer's report: every observed string, and whether the
 * walk's budget ran out with work left.
 */
interface OpaqueProbeReport {
  readonly seen: readonly string[];
  readonly capped: boolean;
}

/** The harness-authored probe contract: `{ seen, capped }`. */
function isOpaqueProbeReport(value: unknown): value is OpaqueProbeReport {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const { seen, capped } = value as Record<string, unknown>;
  return (
    Array.isArray(seen) &&
    seen.every((observed) => typeof observed === "string") &&
    typeof capped === "boolean"
  );
}

/**
 * T4.1-3's probe walk spent its budget (`OPAQ_WALK_CAP`) with values still
 * unwalked, having observed no requirement text: a harness-internal limit
 * exhausted while evaluating an answer, which TEST-SPEC H-11 reports as a
 * defect in the harness — never a diagnosed product failure (so never a
 * `HarnessAssertionError`: the certification runner's outcome is `error`)
 * and never a pass. A conforming module can exhaust the budget (SPEC 4.1
 * constrains only the supported operations), so the walk's inconclusive end
 * is the harness's failure, in the manner of the driver's capacity errors
 * (`ProductRunOutputOverflowError`, `HarnessEvaluationError` in
 * helpers/subprocess.ts).
 */
class OpaqueWalkCapError extends Error {
  /** Strings the walk observed before the cap, none carrying the sentinel. */
  readonly observedStrings: number;

  constructor(observedStrings: number) {
    super(
      "harness error (H-11): T4.1-3's probe consumer's reflective deep " +
        "walk of the values reachable from the default export spent its " +
        `budget of ${String(OPAQ_WALK_CAP)} steps (\`OPAQ_WALK_CAP\`: one ` +
        "per value walked — object, function, or primitive — and per " +
        "prototype-chain link read through) with values still unwalked. " +
        `Strings observed before the cap: ${String(observedStrings)}, none ` +
        "carrying the fixture's requirement-text sentinel. The budget " +
        "is a harness-internal limit a conforming module can exhaust (SPEC " +
        "4.1 constrains only the supported operations), so the harness, " +
        "not the product, failed: the walk cannot show that no requirement " +
        "text is observable (SPEC 4.1, 4.3) — a defect in the harness, " +
        "never a diagnosed product failure and never a pass.",
    );
    this.name = "OpaqueWalkCapError";
    this.observedStrings = observedStrings;
  }
}

/**
 * Judge the probe consumer's report (TEST-SPEC T4.1-3): the reflective deep
 * walk of the runtime values reachable from the default export by child
 * property access observed no string carrying the fixture's
 * requirement-text sentinel (SPEC 4.1: nodes carry no requirement text as
 * values; 4.3) — a diagnosed failure, checked first, so a leak observed
 * before the cap fails the product. A node's runtime representation is
 * free (SPEC 4.1 supports only child property access and passing the node
 * to `text()`): it may be prototype-less, circular, guarded by throwing
 * accessors, or a primitive — a string token carrying no requirement text
 * included — so nothing here judges a node's kind; a string token is
 * judged as the walk's observation, like every other string it meets. A
 * walk that then ended capped cannot show that no text is observable, and
 * its budget is a harness-internal limit a conforming module can exhaust:
 * it throws `OpaqueWalkCapError`, the harness error H-11 prescribes — never
 * a diagnosed product failure and never a pass.
 */
function judgeOpaqueProbeReport(observed: unknown): void {
  if (!isOpaqueProbeReport(observed)) {
    fail(
      "T4.1-3: the probe consumer must report a JSON object `{ seen, " +
        "capped }` — `seen` an array of observed strings, `capped` a " +
        "boolean (whether the walk's budget ran out) — harness-authored " +
        "consumer contract; got " +
        excerpt(JSON.stringify(observed) ?? String(observed)),
    );
  }
  const leaks = observed.seen.filter((value) =>
    value.includes(OPAQ_SENTINEL_PREFIX),
  );
  if (leaks.length > 0) {
    fail(
      "T4.1-3: requirement text is observable through the module's " +
        "node values — a consumer that never imports `text` obtained " +
        `${String(leaks.length)} observation(s) carrying the ` +
        `fixture's requirement-text sentinel (SPEC 4.1: nodes carry ` +
        `no requirement text as values; 4.3: text is reachable at ` +
        `runtime only through the \`text\` export). First leaks: ` +
        leaks
          .slice(0, 3)
          .map((leak) => excerpt(leak))
          .join(", "),
    );
  }
  if (observed.capped) {
    // H-11: the harness's own limit ran out — a harness error, never
    // `fail()` (a diagnosed product failure) and never a pass.
    throw new OpaqueWalkCapError(observed.seen.length);
  }
}

const T4_1_3 = defineProductTest({
  id: "T4.1-3",
  title:
    "nodes are opaque tokens: every value obtained by supported child access is accepted by `text()` and returns its subtree text, while a consumer that never imports `text` observes no requirement text on the values reachable by supported operations, a node free to be any runtime value — a primitive, a string token carrying no requirement text included — each consumer type-checking clean under both of H-2's configurations and run compiled under its CommonJS configuration (SPEC 4.1, 4.3, 13.1)",
  run: async (product) => {
    await withWorkspace(
      {
        "specs/OPAQ.mdx": OPAQ_SOURCE,
        "consumer/accept.ts": OPAQ_ACCEPT_CONSUMER,
        "consumer/probe.ts": OPAQ_PROBE_CONSUMER,
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T4.1-3 `build` over the sentinel spec source",
        );

        // Supported operations behave as specified: each node value is
        // accepted by `text()` (type level, under each of H-2's
        // configurations) and yields its subtree text (runtime, under its
        // CommonJS configuration, byte-exact — SPEC 4.3, 1.6).
        const acceptRun = await typeCheckAndRunConsumer(
          workspace,
          "consumer/accept.ts",
          "T4.1-3 every node value obtained by supported child access " +
            "(root included) is accepted by `text()` (SPEC 4.1)",
        );
        assertExitCode(
          acceptRun,
          0,
          "T4.1-3 compiled accept consumer under plain Node, compiled under " +
            "H-2's CommonJS configuration outside the workspace (SPEC 13.1)",
        );
        assertBytesEqual(
          acceptRun.stdoutBytes,
          OPAQ_ACCEPT_STDOUT,
          "T4.1-3 `text(node)` over every reachable node — the subtree " +
            "texts, byte-exact (SPEC 4.3, 1.6, 3)",
        );

        // No text as values: the probe consumer never imports `text`,
        // reaches every node by supported child access, and observes no
        // requirement text on those values — type-checked clean under each
        // of H-2's configurations and run under its CommonJS configuration.
        const probeRun = await typeCheckAndRunConsumer(
          workspace,
          "consumer/probe.ts",
          "T4.1-3 probe consumer (never imports `text`; supported " +
            "operations plus guarded generic inspection)",
        );
        assertExitCode(
          probeRun,
          0,
          "T4.1-3 compiled probe consumer under plain Node, compiled under " +
            "H-2's CommonJS configuration outside the workspace — supported " +
            "child accesses are harmless at runtime and every unsupported " +
            "probe is guarded (SPEC 4.1, 4.5)",
        );
        // No observed string — a string token itself included — carries
        // requirement text, whatever runtime value each node is (judged in
        // `judgeOpaqueProbeReport`, which reports a capped walk as the
        // harness error `OpaqueWalkCapError`, H-11).
        judgeOpaqueProbeReport(
          parseJsonStdout(probeRun, "T4.1-3 probe consumer output"),
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T4.2-1 — doc comments carry expanded own text
// ---------------------------------------------------------------------------

// One file, four nodes with distinct own texts. `alpha` embeds the sibling
// `lib` mid-line, so alpha's own text is the *expanded* value (SPEC 1.6). The
// file's last line is the unterminated inline `lib` section (the SPEC 3
// inline-tag shape), so lib's subtree text carries no trailing terminator and
// alpha's expanded own text stays a single line.
const DOC_SOURCE = [
  "DOC-ROOT-OWN anchor prose.",
  '<S id="alpha">',
  'DOC-ALPHA-OWN before {text("lib")} after.',
  '<S id="alpha.beta">',
  "DOC-BETA-OWN payload.",
  "</S>",
  "</S>",
  '<S id="lib">DOC-EMBED-CORE payload.</S>',
].join("\n");

// Hand-derived own texts per SPEC 3/1.6 (exact bytes, terminators included).
const DOC_OWN_TEXTS: readonly (readonly [string, string])[] = [
  ["the root node", "DOC-ROOT-OWN anchor prose.\n"],
  [
    "`alpha` (embedding expanded, SPEC 1.6)",
    "DOC-ALPHA-OWN before DOC-EMBED-CORE payload. after.\n",
  ],
  ["`alpha.beta`", "DOC-BETA-OWN payload.\n"],
  ["`lib` (unterminated final line)", "DOC-EMBED-CORE payload."],
];

const T4_2_1 = defineProductTest({
  id: "T4.2-1",
  title:
    "the generated module carries, for every node, a documentation comment containing the node's own text — the expanded value: an embedding's target text appears in the embedder's comment (SPEC 4.2, 1.6)",
  run: async (product) => {
    await withWorkspace({ "specs/DOC.mdx": DOC_SOURCE }, async (workspace) => {
      await buildOk(
        product,
        workspace,
        "T4.2-1 `build` over the embedding spec source",
      );
      const moduleText = await readGeneratedModule(
        workspace,
        "specs/DOC.xspec.ts",
        "T4.2-1 generated module",
      );
      const spans = docCommentSpans(moduleText);
      for (const [label, ownText] of DOC_OWN_TEXTS) {
        assertSomeDocComment(
          spans,
          ownText,
          `T4.2-1 documentation comment for ${label}`,
        );
      }
    });
  },
});

// ---------------------------------------------------------------------------
// T4.2-2 — 1000-code-point truncation
// ---------------------------------------------------------------------------

/** Slice by Unicode code points (SPEC 4.2 counts code points, 1.6). */
function codePointSlice(text: string, start: number, end: number): string {
  return [...text].slice(start, end).join("");
}

/** Deterministic letter filler (no `*`, `/`, or markup characters). */
function letterCycle(count: number): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  let out = "";
  for (let i = 0; i < count; i += 1) {
    out += alphabet[i % alphabet.length]!;
  }
  return out;
}

// U+1F98A: one code point, two UTF-16 units, four UTF-8 bytes — placed before
// the truncation boundary so cutting at 1000 code points, 1000 UTF-16 units,
// and 1000 bytes land at visibly different spots (TEST-SPEC T4.2-2).
const FOX = "\u{1F98A}";

// 1500 code points: own text exceeds 1000, cut lands inside the letter tail.
const LONG_OWN_TEXT = "TRUNCPROBE" + FOX.repeat(745) + letterCycle(745);
// Exactly 1000 code points (1490 UTF-16 units — a product truncating by
// UTF-16 units would wrongly truncate this one).
const EXACT_OWN_TEXT = "EXACTPROBE" + FOX.repeat(490) + letterCycle(500);

const HORIZONTAL_ELLIPSIS = "…";
const LONG_TRUNCATED =
  codePointSlice(LONG_OWN_TEXT, 0, 1000) + HORIZONTAL_ELLIPSIS;
const LONG_BEYOND_CUT = codePointSlice(LONG_OWN_TEXT, 0, 1001);

// Single-line files in the SPEC 3 inline-tag shape, unterminated at EOF, so
// each node's own text is exactly its staged content (no trailing
// terminator entering the code-point count).
const LONG_SOURCE = `<S id="long">${LONG_OWN_TEXT}</S>`;
const EXACT_SOURCE = `<S id="exact">${EXACT_OWN_TEXT}</S>`;

const T4_2_2 = defineProductTest({
  id: "T4.2-2",
  title:
    "own text beyond 1000 Unicode code points is truncated in the documentation comment to exactly its first 1000 code points with `…` appended (code points, not UTF-16 units or bytes — multi-code-unit characters staged before the cut); a node at exactly 1000 code points is not truncated and gains no `…` (SPEC 4.2, 1.6)",
  run: async (product) => {
    // Fixture arithmetic guard (a failure here is a harness defect, never a
    // product failure — hence not a HarnessAssertionError).
    if (
      [...LONG_OWN_TEXT].length !== 1500 ||
      [...EXACT_OWN_TEXT].length !== 1000 ||
      EXACT_OWN_TEXT.length !== 1490
    ) {
      throw new Error(
        "T4.2-2 fixture arithmetic broke: expected 1500/1000 code points " +
          "and 1490 UTF-16 units — fix the fixture builders in " +
          "section-4.1-4.2.ts",
      );
    }
    await withWorkspace(
      {
        "specs/LONG.mdx": LONG_SOURCE,
        "specs/EXACT.mdx": EXACT_SOURCE,
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T4.2-2 `build` over the truncation-probe spec sources",
        );

        const longSpans = docCommentSpans(
          await readGeneratedModule(
            workspace,
            "specs/LONG.xspec.ts",
            "T4.2-2 generated module for the >1000-code-point node",
          ),
        );
        assertSomeDocComment(
          longSpans,
          LONG_TRUNCATED,
          "T4.2-2 the >1000-code-point own text truncated to exactly its " +
            "first 1000 code points with `…` appended",
        );
        assertNoDocComment(
          longSpans,
          LONG_BEYOND_CUT,
          "T4.2-2 own text beyond the 1000th code point (the first 1001 " +
            "code points as one run)",
        );

        const exactSpans = docCommentSpans(
          await readGeneratedModule(
            workspace,
            "specs/EXACT.xspec.ts",
            "T4.2-2 generated module for the exactly-1000-code-point node",
          ),
        );
        assertSomeDocComment(
          exactSpans,
          EXACT_OWN_TEXT,
          "T4.2-2 the exactly-1000-code-point own text, untruncated",
        );
        for (const span of exactSpans) {
          for (
            let at = span.indexOf(EXACT_OWN_TEXT);
            at !== -1;
            at = span.indexOf(EXACT_OWN_TEXT, at + 1)
          ) {
            const next = span.slice(
              at + EXACT_OWN_TEXT.length,
              at + EXACT_OWN_TEXT.length + 1,
            );
            if (next === HORIZONTAL_ELLIPSIS) {
              fail(
                "T4.2-2: the exactly-1000-code-point own text gained a " +
                  "`…` in a documentation comment — a node at exactly " +
                  "1000 code points is not truncated and gains no `…` " +
                  "(SPEC 4.2)",
              );
            }
          }
        }
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T4.2-3 — `*/` escaping
// ---------------------------------------------------------------------------

const ESC_OWN_TEXT = "Esc one */ mid */ tail.";
const ESC_SOURCE = `<S id="esc">${ESC_OWN_TEXT}</S>`;
// Each occurrence of the comment-terminating sequence written `*\/`.
const ESC_ESCAPED_TEXT = "Esc one *\\/ mid *\\/ tail.";

const ESC_CONSUMER = [
  'import SPEC, { text } from "../specs/ESC.xspec";',
  "",
  "text(SPEC.esc);",
  "",
].join("\n");

const T4_2_3 = defineProductTest({
  id: "T4.2-3",
  title:
    "own text containing `*/` appears in the documentation comment with each occurrence written `*\\/`, and the generated module still parses under standard tooling — a consumer of it type-checking clean, its whole program included, under both of H-2's configurations (SPEC 4.2, 13.1)",
  run: async (product) => {
    await withWorkspace(
      {
        "specs/ESC.mdx": ESC_SOURCE,
        "consumer/esc.ts": ESC_CONSUMER,
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T4.2-3 `build` over the `*/`-bearing spec source",
        );
        const spans = docCommentSpans(
          await readGeneratedModule(
            workspace,
            "specs/ESC.xspec.ts",
            "T4.2-3 generated module",
          ),
        );
        assertSomeDocComment(
          spans,
          ESC_ESCAPED_TEXT,
          "T4.2-3 the own text with each `*/` occurrence written `*\\/`",
        );
        // A raw occurrence would terminate the comment early — either way it
        // must not appear inside any documentation-comment span.
        assertNoDocComment(
          spans,
          "one */",
          "T4.2-3 the first `*/` occurrence left unescaped",
        );
        assertNoDocComment(
          spans,
          "mid */",
          "T4.2-3 the second `*/` occurrence left unescaped",
        );
        // "Still parses under standard tooling", asserted as the (stronger,
        // §4-implied) clean type check of a consumer program against the
        // module under each of H-2's configurations — a verdict over the
        // whole program, the generated module and its companions included,
        // so a parse error in either is a diagnostic there.
        await forEachConsumerProject(
          { rootDir: workspace.root, rootFiles: ["consumer/esc.ts"] },
          (project) =>
            assertTypeChecksClean(
              project,
              "T4.2-3 consumer against the `*/`-bearing generated module " +
                "(SPEC 4.2: the module still parses under standard tooling)",
            ),
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T4.2-4 — go-to-definition and hover
// ---------------------------------------------------------------------------

// Pure ASCII (tooling UTF-16 offsets equal byte offsets); one sentinel per
// node so the hover documentation is attributable to the hovered node.
const NAV_SOURCE = [
  "NAV-ROOT-DOC anchor prose.",
  '<S id="alpha">',
  "NAV-ALPHA-DOC anchor prose.",
  '<S id="alpha.beta">',
  "NAV-BETA-DOC anchor prose.",
  "</S>",
  "</S>",
  "",
].join("\n");

const NAV_CONSUMER = [
  'import SPEC, { text } from "../specs/NAV.xspec";',
  "",
  "text(SPEC);",
  "text(SPEC.alpha.beta);",
  "",
].join("\n");

/** Render definition targets for failure diagnoses. */
function describeTargets(targets: readonly SourceDefinitionTarget[]): string {
  if (targets.length === 0) return "  <none>";
  return targets
    .map(
      (target) =>
        `  ${target.file}:${String(target.start.line)}:${String(target.start.column)} ` +
        `(offset ${String(target.start.offset)}; ` +
        (target.mapped
          ? `declaration-mapped from ${target.raw.file})`
          : "unmapped)"),
    )
    .join("\n");
}

/** Assert some editor-level definition target satisfies `predicate`. */
function assertSomeDefinition(
  targets: readonly SourceDefinitionTarget[],
  predicate: (target: SourceDefinitionTarget) => boolean,
  wanted: string,
  context: string,
): void {
  if (!targets.some(predicate)) {
    fail(
      `${context}: go-to-definition must yield a target ${wanted} ` +
        `(SPEC 4.2, 13.1); targets reported:\n${describeTargets(targets)}`,
    );
  }
}

/** Assert hover exists and its documentation contains `needle` (H-3). */
function assertHoverDocumentation(
  project: ConsumerProject,
  position: FileOffset,
  needle: string,
  context: string,
): void {
  const hover = project.hoverAt(position);
  if (hover === undefined) {
    fail(
      `${context}: hover reports nothing at the reference — the reference ` +
        `must show its documentation (SPEC 4.2)`,
    );
  }
  if (!hover.documentation.includes(needle)) {
    fail(
      `${context}: the hover documentation must contain ` +
        `${JSON.stringify(needle)} (the hovered node's own text sentinel, ` +
        `SPEC 4.2); got display ${excerpt(hover.display)}, documentation ` +
        excerpt(hover.documentation),
    );
  }
}

const T4_2_4 = defineProductTest({
  id: "T4.2-4",
  title:
    "under standard TypeScript tooling, in each of H-2's configurations, go-to-definition on a consumer's node reference resolves into the source `.mdx`: a non-root reference at its corresponding `<S>` section, the root reference (default export) at the start of the file; hover on the reference shows the documentation (SPEC 4.2, 13.1)",
  run: async (product) => {
    await withWorkspace(
      {
        "specs/NAV.mdx": NAV_SOURCE,
        "consumer/nav.ts": NAV_CONSUMER,
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T4.2-4 `build` over the navigation spec source",
        );

        // Section construct spans in the pure-ASCII source (SPEC 1.7:
        // opening tag through closing tag).
        const alphaStart = NAV_SOURCE.indexOf('<S id="alpha">');
        const betaStart = NAV_SOURCE.indexOf('<S id="alpha.beta">');
        const betaEnd = NAV_SOURCE.indexOf("</S>") + "</S>".length;
        const alphaEnd = NAV_SOURCE.indexOf("</S>", betaEnd) + "</S>".length;
        const inBeta = (offset: number): boolean =>
          offset >= betaStart && offset < betaEnd;
        const inAlphaOwn = (offset: number): boolean =>
          offset >= alphaStart && offset < alphaEnd && !inBeta(offset);

        // Every verdict, definition, and hover under each of H-2's
        // configurations in turn, with the same expectation (TEST-SPEC §4's
        // opening paragraph); a failure names its configuration.
        await forEachConsumerProject(
          { rootDir: workspace.root, rootFiles: ["consumer/nav.ts"] },
          (project) => {
            assertTypeChecksClean(
              project,
              "T4.2-4 navigation consumer (queries run against a checking " +
                "program)",
            );

            const rootRef = project.locate("consumer/nav.ts", "text(SPEC);", {
              charOffset: "text(".length,
            });
            const alphaRef = project.locate(
              "consumer/nav.ts",
              "SPEC.alpha.beta",
              { charOffset: "SPEC.".length },
            );
            const betaRef = project.locate(
              "consumer/nav.ts",
              "SPEC.alpha.beta",
              { charOffset: "SPEC.alpha.".length },
            );

            assertSomeDefinition(
              project.sourceDefinitionsAt(betaRef),
              (target) =>
                target.file === "specs/NAV.mdx" && inBeta(target.start.offset),
              `in specs/NAV.mdx within \`alpha.beta\`'s \`<S>\` construct ` +
                `[${String(betaStart)}, ${String(betaEnd)})`,
              "T4.2-4 go-to-definition on the nested node reference `beta`",
            );
            assertSomeDefinition(
              project.sourceDefinitionsAt(alphaRef),
              (target) =>
                target.file === "specs/NAV.mdx" &&
                inAlphaOwn(target.start.offset),
              `in specs/NAV.mdx within \`alpha\`'s own \`<S>\` construct ` +
                `[${String(alphaStart)}, ${String(alphaEnd)}) excluding the ` +
                `nested \`alpha.beta\` construct`,
              "T4.2-4 go-to-definition on the mid-chain node reference `alpha`",
            );
            assertSomeDefinition(
              project.sourceDefinitionsAt(rootRef),
              (target) =>
                target.file === "specs/NAV.mdx" && target.start.offset === 0,
              "in specs/NAV.mdx at the start of the file (offset 0 — the " +
                "root has no `<S>` section, SPEC 1.2, 4.2)",
              "T4.2-4 go-to-definition on the root reference (default export)",
            );

            assertHoverDocumentation(
              project,
              rootRef,
              "NAV-ROOT-DOC",
              "T4.2-4 hover on the root reference",
            );
            assertHoverDocumentation(
              project,
              alphaRef,
              "NAV-ALPHA-DOC",
              "T4.2-4 hover on the `alpha` reference",
            );
            assertHoverDocumentation(
              project,
              betaRef,
              "NAV-BETA-DOC",
              "T4.2-4 hover on the `beta` reference",
            );
          },
        );
      },
    );
  },
});

/** TEST-SPEC §4.1–4.2, in canonical ID order (SUITE-13). */
export const section41to42Tests: readonly ProductTestEntry[] = [
  T4_1_1,
  T4_1_2,
  T4_1_3,
  T4_2_1,
  T4_2_2,
  T4_2_3,
  T4_2_4,
];
