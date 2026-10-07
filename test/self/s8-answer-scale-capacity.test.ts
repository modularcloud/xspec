// S-8 Answer-scale capacity self-test (TEST-SPEC 17 S-8; §0 H-11). The
// harness must capture, decode, and evaluate every answer SPEC.md permits a
// conforming product over the inputs the suite stages — nesting depth and
// document size included, expansion blowup included — with every internal
// capacity limit dimensioned to that scale, and an exhausted capture limit a
// loud harness error, never a silent truncation. No CERTIFICATIONS.md fixture
// reaches this class (a harness-side failure against a conforming answer is
// a spurious fail, not a missed deviation), so it is gated here, before any
// product exists (H-8's ordering):
//
//   1. the scale is DERIVED from what the suite stages — the generator
//      draws (P-8/P-11's towers and mutation budget, P-2/P-3's expansion
//      oracle) and the deterministic fixtures (T1.3-7's chained-id tower,
//      the anchor of P-8's floor and the largest document the suite stages)
//      — never assumed; `staged-scale.ts` states the derivation (shared with
//      S-2, which stages the same maxima through the workspace builder), and
//      the fixed CI seed set (E-5) is replayed to confirm the staged draws
//      stay inside the generator maxima;
//   2. synthetic conforming-form documents at that scale are built
//      iteratively (never by recursion — `JSON.stringify` itself overflows
//      at these depths) and driven through every H-3/12.7 decoder and every
//      answer-document walk the suite performs, asserting no exception and
//      the expected datum counts;
//   3. capture is gated at the same scale through S-3's stand-in mechanism:
//      a stand-in command streams the largest synthetic document to stdout
//      through the one ProductBinding/run path product invocations use
//      (H-2, C-2), under an argv putting JSON output in effect (SPEC 12.0),
//      so the driver's T12.7-1 walk over every captured JSON document
//      (helpers/capture-walk.ts) runs over it as over a product's answer;
//      the captured bytes must be complete and identical to what
//      it emitted, the capture feeds the decoders unchanged, the default
//      capture cap must hold at least twice the document, and a cap set just
//      below the document must surface as ProductRunOutputOverflowError;
//   4. an exhausted capture limit stays a harness error even where
//      termination is the assertion: P-8's and P-11's command runs, their
//      capture cap lowered against a flooding stand-in, let the overflow
//      propagate out of the property, which reports it as a harness error
//      naming the seed — never a falsified property — while the hang-guard
//      kill, their termination clause, stays a diagnosed failure (S-3);
//   5. and so it stays wherever a shared helper converts a run's rejection
//      into a diagnosed failure — 13.5's runBounded and describeExit, the
//      write-refusal staging's awaitHoldFile, runSettled, and
//      runHeldWithStaging, P-10's runHeldRead, settleStraddleRead, and
//      settleKilled: their capture cap lowered against a flooding
//      stand-in, each lets the driver's ProductRunOutputOverflowError
//      through unchanged, while the hang-guard kill (for a hold-file wait,
//      a premature exit) stays a diagnosed failure. S-3 pins the driver's
//      own hold-file wait and `rethrowHarnessError`; the conversions
//      written inline in registered bodies call it the same way;
//   6. and a harness-side failure while evaluating an answer is no
//      diagnosed product failure either: the driver evaluates every
//      performed move's answer in the run (T6.5-22(a)'s check), and when
//      that check itself fails — made to fail here by a scoped `vi.doMock`
//      of its module, which the driver imports on demand — the run rejects
//      with the harness error HarnessEvaluationError (S-3), which every
//      shared helper through which a move can run — 13.5's runBounded and
//      describeExit, the write-refusal staging's awaitHoldFile, runSettled,
//      and runHeldWithStaging, P-10's settleStraddleRead and settleKilled —
//      lets through unchanged, never converted into a HarnessAssertionError
//      — and P-10's property runner reports it as a harness error naming
//      the seed. (P-10's runHeldRead runs only its fixed read menu, which
//      never prepares the check; it calls `rethrowHarnessError` all the
//      same.)

import { Buffer } from "node:buffer";
import { once } from "node:events";
import { createReadStream, createWriteStream } from "node:fs";
import { expect, onTestFinished, test, vi } from "vitest";
import type * as AddedImportCheckModule from "../helpers/added-import-identifiers.js";
import {
  assertBareEdgeEndpoints,
  assertNodeEdgeListsBare,
  assertUnavailabilityMarkerForms,
  decodeAtReport,
  decodeEdgesReport,
  decodeErrorDocument,
  decodeFindingsReport,
  decodeIdsReport,
  decodeIdsTreeReport,
  decodeNodeIdentityRowsReport,
  decodeNodeReport,
  decodeNodeRowsReport,
  decodeNodeSummaryRowsReport,
  decodeNodeTextAlgebraSummary,
  decodeOccurrencesReport,
  decodeReachableReport,
  decodeViewReport,
  describeJsonValue,
} from "../helpers/adapters/index.js";
import type { IdsTreeNode, ViewNode } from "../helpers/adapters/index.js";
import {
  HarnessAssertionError,
  parseJsonStdout,
} from "../helpers/assertions.js";
import { jsonOutputInEffect } from "../helpers/invocation-grammar.js";
import {
  checkProperty,
  drawFixedSeedTrials,
  PROPERTY_SEED_ENV,
  PropertyFalsifiedError,
} from "../helpers/property.js";
import {
  DEFAULT_MAX_OUTPUT_BYTES,
  HarnessEvaluationError,
  ProductRunOutputOverflowError,
  runProduct,
  startProduct,
} from "../helpers/subprocess.js";
import type {
  ProductBinding,
  RunGuards,
  RunningProduct,
} from "../helpers/subprocess.js";
import { TestWorkspace } from "../helpers/workspace.js";
import {
  canonicalJson as canonicalJson1023,
  collectStringLeaves as collectStringLeaves1023,
} from "../suite/registry/section-10.2-10.3.js";
import { collectStringLeaves as collectStringLeaves104 } from "../suite/registry/section-10.4.js";
import {
  canonicalJson as canonicalJson106,
  collectStringLeaves as collectStringLeaves106,
} from "../suite/registry/section-10.6.js";
import {
  canonicalJson as canonicalJson107i,
  collectStringLeaves as collectStringLeaves107i,
} from "../suite/registry/section-10.7-i.js";
import {
  canonicalJson as canonicalJson107ii,
  collectStringLeaves as collectStringLeaves107ii,
} from "../suite/registry/section-10.7-ii.js";
import { canonicalizeJson } from "../suite/registry/section-12.0-i.js";
import { describeExit, runBounded } from "../suite/registry/section-13.5.js";
import {
  runHeldRead,
  settleKilled,
  settleStraddleRead,
} from "../suite/registry/section-16-p10.js";
import {
  documentCarriesUnavailability,
  genAvailabilityTrial,
  runAvailabilityCommand,
} from "../suite/registry/section-16-p11.js";
import {
  generatedDoc,
  specSubtreeTexts,
} from "../suite/registry/section-16-p2-p3.js";
import {
  genFuzzTrial,
  MAX_MUTATIONS_PER_TRIAL,
  runFuzzCommand,
} from "../suite/registry/section-16-p8.js";
import {
  awaitHoldFile,
  holdPathFor,
  runHeldWithStaging,
  runSettled,
} from "../suite/registry/write-refusal-staging.js";
import type { StagingApplier } from "../suite/registry/write-refusal-staging.js";
import {
  DEEPEST_STAGED_TOWER,
  DEPTH_FLOOR,
  FATTEST_TERMINATOR,
  GIANT_NESTING_FLOOR,
  LARGEST_BASE_BYTES,
  LARGEST_BASE_FILE,
  LARGEST_DETERMINISTIC_INPUT_BYTES,
  LARGEST_GENERATED_INPUT_BYTES,
  LARGEST_STAGED_INPUT_BYTES,
  largestDeterministicDocument,
  largestGeneratedDocument,
  largestStagedDocument,
  TOWER_BYTES,
} from "./staged-scale.js";

// ---------------------------------------------------------------------------
// 1. The scale the suite stages — derived from the generators, not assumed
//
// Nesting and document size are derived once, in `staged-scale.ts`
// (GIANT_NESTING_FLOOR, DEEPEST_STAGED_TOWER, TOWER_BYTES, the generator
// maximum LARGEST_GENERATED_INPUT_BYTES, the deterministic maximum
// LARGEST_DETERMINISTIC_INPUT_BYTES — T1.3-7's tower at DEPTH_FLOOR — and
// their larger, LARGEST_STAGED_INPUT_BYTES, with their derivation comments)
// — the same constants S-2 stages through the workspace builder; every S-8
// pin binds to the kind it sizes. A trial applies up to
// MAX_MUTATIONS_PER_TRIAL mutations to the same file, and a shuffle mutation
// relocates one contiguous byte range, so tower + tower + shuffle can drop
// the second tower into the first's innermost level: the deepest section
// chain any P-8/P-11 draw can stage is 2 × 4096 = 8192 (a third tower would
// need a fourth mutation). Every `view` and `ids --tree` answer over such an
// input nests one node per level.
const SYNTHETIC_DEPTH = 2 * DEEPEST_STAGED_TOWER;

// Expansion blowup. SPEC 3 defines a line terminator as CRLF, a lone LF, or
// a lone CR — nothing else — so after P-8's LF → U+2028 rewrite a tower's
// tags no longer stand on lines of their own: no line is dropped, and every
// level's own text is its two separators. A section's subtree text (1.6)
// re-emits every level beneath it, so a `view --text` answer carries, per
// tower, Σ_k (2·(D − k) separators + the content line) — quadratic in the
// depth: ~100 MB at D = 4096 in the six-character `\u2028` JSON spelling a
// conforming product may choose (12.7 pins no escaping), ~50 MB raw. Two
// towers under one rewrite (tower + tower + rewrite: the whole budget) double
// it, and P-11's answer arms request exactly this (`view --text` over the
// mutated base). That is the largest answer SPEC.md permits over a staged
// input — three orders of magnitude past the input's own size. Embedding
// chains multiply less here: the fuzz base's chain (B.b → A.c → A.a.b) has
// fan-out one, a shuffle can carry a tower into an embedded target once, and
// an embedded subtree is re-emitted once per embedding level, not once per
// nesting level; P-2/P-3's generator has no structural expansion bound (each
// target may embed every earlier target), so its fixed-seed maximum is
// measured below and its randomized mode fails loudly in the oracle
// (`specSubtreeTexts` materializes every expansion before any product runs)
// rather than silently under-capturing.
const BLOWUP_TOWERS = 2;
const BLOWUP_DEPTH = DEEPEST_STAGED_TOWER;
/** U+2028 as a conforming product may spell it inside a JSON string. */
const SEPARATOR_ESCAPED = "\\u2028";
const SEPARATOR = "\u2028";

test("S-8: the derived scale — deepest chain, largest generated and deterministic staged inputs, blowup input", () => {
  expect(DEEPEST_STAGED_TOWER).toBeGreaterThanOrEqual(GIANT_NESTING_FLOOR);
  expect(SYNTHETIC_DEPTH).toBe(8192);
  // The tower the suite stages, byte for byte (sectionTowerSource is what
  // mutateNesting appends): 11 bytes per opener line, the content line, 5
  // bytes per closer line.
  expect(TOWER_BYTES).toBe(
    DEEPEST_STAGED_TOWER * 11 + 6 + DEEPEST_STAGED_TOWER * 5,
  );
  expect(FATTEST_TERMINATOR).toBe(3);
  // The derivation's claim: the all-towers mix is the largest generated file.
  expect(LARGEST_GENERATED_INPUT_BYTES).toBe(
    LARGEST_BASE_BYTES + MAX_MUTATIONS_PER_TRIAL * TOWER_BYTES,
  );
  expect(LARGEST_GENERATED_INPUT_BYTES).toBeGreaterThan(190_000);
  expect(LARGEST_GENERATED_INPUT_BYTES).toBeLessThan(200_000);
  // Attained, not merely bounded: the largest base is an `.mdx` file, so a
  // nesting draw over it appends the section tower the mix is sized with,
  // and the document S-2 stages is exactly that mix.
  expect(LARGEST_BASE_FILE[0].endsWith(".mdx")).toBe(true);
  expect(largestGeneratedDocument().length).toBe(LARGEST_GENERATED_INPUT_BYTES);

  // The deterministic maximum: T1.3-7's chained-id tower (section-1.3.ts),
  // quadratic in the depth because every id spells its whole ancestor chain
  // — per level k an opener `<S id="` (7 bytes) plus a (2k − 1)-byte id plus
  // `">\n` (3 bytes), then `deep.\n` (6 bytes), then `</S>\n` × D (5 bytes
  // each): 9·D + D·(D + 1) + 6 + 5·D, 4,225,030 bytes at D = 2048. The
  // exact size moves only when T1.3-7's DEPTH_FLOOR does — deliberately.
  expect(LARGEST_DETERMINISTIC_INPUT_BYTES).toBe(
    9 * DEPTH_FLOOR + DEPTH_FLOOR * (DEPTH_FLOOR + 1) + 6 + 5 * DEPTH_FLOOR,
  );
  expect(LARGEST_DETERMINISTIC_INPUT_BYTES).toBe(4_225_030);
  expect(largestDeterministicDocument().length).toBe(
    LARGEST_DETERMINISTIC_INPUT_BYTES,
  );
  // The suite's staged maximum is the larger kind's — today the
  // deterministic one, ~21× the generator maximum — and the document staged
  // under that name is exactly that large.
  expect(LARGEST_STAGED_INPUT_BYTES).toBe(
    Math.max(LARGEST_GENERATED_INPUT_BYTES, LARGEST_DETERMINISTIC_INPUT_BYTES),
  );
  expect(largestStagedDocument().length).toBe(LARGEST_STAGED_INPUT_BYTES);
  // The deterministic anchor sits inside the synthetic answer scale: T1.3-7
  // anchors P-8's floor (TEST-SPEC T1.3-7), and the synthetic `view` and
  // `ids --tree` documents below nest at least as deep as it.
  expect(DEPTH_FLOOR).toBeGreaterThanOrEqual(GIANT_NESTING_FLOOR);
  expect(SYNTHETIC_DEPTH).toBeGreaterThanOrEqual(DEPTH_FLOOR);
});

test("S-8: the fixed CI seed set stages within the derived scale (E-5 replay)", () => {
  // DEFAULT_RUNS_PER_SEED (25) bounds every property's registered run count,
  // and each seed's trials are one sequential PRNG stream, so the draws the
  // suite stages under the fixed plan are a prefix of these.
  const RUNS = 25;
  let largestFile = 0;
  let deepestTower = 0;
  const trials = [
    ...drawFixedSeedTrials(genFuzzTrial, RUNS),
    ...drawFixedSeedTrials(genAvailabilityTrial, RUNS),
  ];
  for (const trial of trials) {
    for (const [, bytes] of trial.files) {
      largestFile = Math.max(largestFile, bytes.length);
    }
    for (const mutation of trial.mutations) {
      const depth = /depth-(\d+) /.exec(mutation);
      if (depth !== null)
        deepestTower = Math.max(deepestTower, Number(depth[1]));
    }
  }
  expect(largestFile).toBeLessThanOrEqual(LARGEST_GENERATED_INPUT_BYTES);
  expect(deepestTower).toBeLessThanOrEqual(DEEPEST_STAGED_TOWER);
  // P-8's test-strength floor on staged draws (TEST-SPEC §16 P-8): the fixed
  // seed set must itself stage nesting at least 2048 deep.
  expect(deepestTower).toBeGreaterThanOrEqual(GIANT_NESTING_FLOOR);

  // P-2/P-3: the largest text datum a `query node` answer carries over the
  // fixed-seed documents — the expansion oracle's own materialization.
  let largestText = 0;
  for (const doc of drawFixedSeedTrials(generatedDoc, RUNS)) {
    for (const text of specSubtreeTexts(doc).values()) {
      largestText = Math.max(largestText, Buffer.byteLength(text, "utf8"));
    }
  }
  expect(largestText).toBeGreaterThan(0);
  expect(largestText).toBeLessThan(LARGEST_GENERATED_INPUT_BYTES);
});

// ---------------------------------------------------------------------------
// 2. Synthetic conforming-form documents, built iteratively

const VIEWED_FILE = "specs/A.mdx";

interface TowerText {
  /** JSON-escaped own text of level k (1 = the outermost). */
  readonly own: (level: number) => string;
  /** JSON-escaped subtree text of level k. */
  readonly subtree: (level: number) => string;
}

interface ViewDocumentSpec {
  readonly towers: number;
  readonly depth: number;
  /** Node text members (the `--text` form), or null for the bare form. */
  readonly text: TowerText | null;
  /** JSON-escaped root own/subtree texts (text form only). */
  readonly rootText: { readonly own: string; readonly subtree: string };
  /** Tower node identities: the marker (duplicate `g`) or a plain string. */
  readonly identity: "marker" | "string";
  /** Element count of each flat per-file member and of the findings. */
  readonly flat: number;
}

/**
 * Append one balanced tower's node chain as JSON text: `depth` nested view
 * nodes in the literal 12.7 form, ranges laid out exactly as
 * sectionTowerSource's bytes lie from `start` — opener lines of 11 bytes
 * (`<S id="g">`, the attribute at +3..+9), the 6-byte content line, closer
 * lines of 5 bytes. Returns the byte offset after the tower.
 */
function appendTowerNodes(
  out: string[],
  spec: ViewDocumentSpec,
  start: number,
  tower: number,
): number {
  const closersStart = start + spec.depth * 11 + 6;
  for (let level = 1; level <= spec.depth; level += 1) {
    const open = start + (level - 1) * 11;
    const close = closersStart + (spec.depth - level) * 5;
    const identity =
      spec.identity === "marker"
        ? '{"unavailable":true}'
        : JSON.stringify(`${VIEWED_FILE}#t${String(tower)}.g${String(level)}`);
    out.push(
      `{"identity":${identity},"range":{"start":${String(open)},"end":${String(close + 4)}},` +
        `"opening":{"start":${String(open)},"end":${String(open + 10)}},` +
        `"closing":{"start":${String(close)},"end":${String(close + 4)}},` +
        `"attributes":[{"name":"id","range":{"start":${String(open + 3)},"end":${String(open + 9)}},"text":"id=\\"g\\""}],` +
        `"tags":[],"coverage":null,`,
    );
    if (spec.text !== null) {
      out.push(
        `"ownText":"${spec.text.own(level)}","subtreeText":"${spec.text.subtree(level)}",`,
      );
    }
    out.push('"children":[');
  }
  for (let level = 1; level <= spec.depth; level += 1) out.push("]}");
  return closersStart + spec.depth * 5;
}

/** `count` findings in the pinned order: one 14.1 finding locating every
 * bearer, then one 14.3 finding per bearer, locations ascending. */
function appendFindings(out: string[], count: number): void {
  if (count === 0) return;
  out.push(
    '{"code":"missing-id","message":"a section spells no id","locations":[',
  );
  for (let index = 0; index < count; index += 1) {
    if (index > 0) out.push(",");
    out.push(
      `{"file":${JSON.stringify(VIEWED_FILE)},"range":{"start":${String(index * 11)},"end":${String(index * 11 + 10)}}}`,
    );
  }
  out.push('],"path":null,"identities":[]}');
  for (let index = 0; index < count; index += 1) {
    out.push(
      `,{"code":"duplicate-id","message":"duplicate id g","locations":[{"file":${JSON.stringify(VIEWED_FILE)},"range":{"start":${String(index * 11)},"end":${String(index * 11 + 10)}}}],"path":null,"identities":[]}`,
    );
  }
}

/** The whole `view` document as JSON text pieces (join to get the text). */
function buildViewDocument(spec: ViewDocumentSpec): string[] {
  const out: string[] = [];
  const fileLength = spec.towers * TOWER_BYTES;
  out.push('{"findings":[');
  appendFindings(out, spec.flat);
  out.push(`],"views":[{"file":${JSON.stringify(VIEWED_FILE)},"root":`);
  out.push(
    `{"identity":${JSON.stringify(VIEWED_FILE)},"range":{"start":0,"end":${String(fileLength)}},` +
      `"opening":null,"closing":null,"attributes":[],"tags":null,"coverage":null,`,
  );
  if (spec.text !== null) {
    out.push(
      `"ownText":"${spec.rootText.own}","subtreeText":"${spec.rootText.subtree}",`,
    );
  }
  out.push('"children":[');
  let offset = 0;
  for (let tower = 1; tower <= spec.towers; tower += 1) {
    if (tower > 1) out.push(",");
    offset = appendTowerNodes(out, spec, offset, tower);
  }
  out.push("]}");
  out.push(',"imports":[');
  for (let index = 0; index < spec.flat; index += 1) {
    if (index > 0) out.push(",");
    out.push(
      `{"range":{"start":${String(index * 8)},"end":${String(index * 8 + 7)}},"name":null,"target":{"unavailable":true}}`,
    );
  }
  out.push('],"occurrences":[');
  for (let index = 0; index < spec.flat; index += 1) {
    if (index > 0) out.push(",");
    out.push(
      `{"file":${JSON.stringify(VIEWED_FILE)},"range":{"start":${String(index * 6)},"end":${String(index * 6 + 5)}},` +
        `"kind":"embeds","source":{"unavailable":true},"target":"specs/A.mdx#a.b"}`,
    );
  }
  out.push('],"comments":[');
  for (let index = 0; index < spec.flat; index += 1) {
    if (index > 0) out.push(",");
    out.push(`{"start":${String(index * 4)},"end":${String(index * 4 + 3)}}`);
  }
  out.push("]}]}");
  return out;
}

/** An `ids --tree` document nesting one node per level, `depth` deep. */
function buildIdsTreeDocument(depth: number): string {
  const out: string[] = [
    `{"files":[{"file":${JSON.stringify(VIEWED_FILE)},"nodes":[`,
  ];
  for (let level = 0; level < depth; level += 1)
    out.push('{"id":"g","children":[');
  for (let level = 0; level < depth; level += 1) out.push("]}");
  out.push("]}]}");
  return out.join("");
}

function countViewNodes(root: ViewNode): { nodes: number; depth: number } {
  let nodes = 0;
  let depth = 0;
  const stack: { readonly node: ViewNode; readonly level: number }[] = [
    { node: root, level: 0 },
  ];
  while (stack.length > 0) {
    const { node, level } = stack.pop()!;
    nodes += 1;
    depth = Math.max(depth, level);
    for (const child of node.children)
      stack.push({ node: child, level: level + 1 });
  }
  return { nodes, depth };
}

function countIdsNodes(roots: readonly IdsTreeNode[]): {
  nodes: number;
  depth: number;
} {
  let nodes = 0;
  let depth = 0;
  const stack: { readonly node: IdsTreeNode; readonly level: number }[] =
    roots.map((node) => ({ node, level: 1 }));
  while (stack.length > 0) {
    const { node, level } = stack.pop()!;
    nodes += 1;
    depth = Math.max(depth, level);
    for (const child of node.children)
      stack.push({ node: child, level: level + 1 });
  }
  return { nodes, depth };
}

function innermost(root: ViewNode): ViewNode {
  let node = root;
  while (node.children.length > 0) node = node.children[0]!;
  return node;
}

/** An independent count of string leaves (the registry walkers' oracle). */
function countStringLeaves(value: unknown): number {
  let count = 0;
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const current = stack.pop();
    if (typeof current === "string") count += 1;
    else if (Array.isArray(current)) stack.push(...current);
    else if (typeof current === "object" && current !== null) {
      stack.push(...Object.values(current));
    }
  }
  return count;
}

const identities = (count: number, offset = 0): string[] =>
  Array.from(
    { length: count },
    (_, index) => `${VIEWED_FILE}#g${String(index + offset)}`,
  );

test("S-8: every H-3/12.7 decoder and answer-document walk succeeds at the synthetic depth", () => {
  const depth = SYNTHETIC_DEPTH;
  const flat = SYNTHETIC_DEPTH;
  const bareText = buildViewDocument({
    towers: 1,
    depth,
    text: null,
    rootText: { own: "", subtree: "" },
    identity: "marker",
    flat,
  }).join("");
  const bare = JSON.parse(bareText) as unknown;

  // The `view` document: the positional tree one node per level, and the
  // flat per-file members and findings at the same count.
  const view = decodeViewReport(bare, { text: false }, "S-8 deep view");
  expect(view.findings).toHaveLength(flat + 1);
  expect(view.views).toHaveLength(1);
  const fileView = view.views[0]!;
  expect(countViewNodes(fileView.root)).toEqual({ nodes: depth + 1, depth });
  expect(fileView.imports).toHaveLength(flat);
  expect(fileView.occurrences).toHaveLength(flat);
  expect(fileView.comments).toHaveLength(flat);
  expect(innermost(fileView.root).identity).toEqual({ unavailable: true });

  // The `--text` twin at depth (P-11's arm): both text members per level.
  const textDoc = JSON.parse(
    buildViewDocument({
      towers: 1,
      depth,
      text: { own: () => "", subtree: () => "deep.\\n" },
      rootText: { own: "", subtree: "deep.\\n" },
      identity: "marker",
      flat: 0,
    }).join(""),
  ) as unknown;
  const textView = decodeViewReport(
    textDoc,
    { text: true },
    "S-8 deep view --text",
  );
  expect(countViewNodes(textView.views[0]!.root)).toEqual({
    nodes: depth + 1,
    depth,
  });
  expect(innermost(textView.views[0]!.root).subtreeText).toBe("deep.\n");

  // The whole-document marker walk and P-11's unavailability walk.
  assertUnavailabilityMarkerForms(bare, "S-8 deep view");
  expect(documentCarriesUnavailability(bare)).toBe(true);
  expect(documentCarriesUnavailability(textDoc)).toBe(true);

  // The diagnosis renderer: bounded text at any depth (its fallback runs
  // where V8's serializer overflows).
  const description = describeJsonValue(bare);
  expect(description.startsWith("object ")).toBe(true);
  expect(description.length).toBeLessThan(400);

  // The registry modules' generic JSON walkers: string leaves counted
  // against an independent walk, canonical renderings that decode back to
  // the same tree, key-order canonicalization that decodes likewise.
  const leaves = countStringLeaves(bare);
  for (const collect of [
    collectStringLeaves1023,
    collectStringLeaves104,
    collectStringLeaves106,
    collectStringLeaves107i,
    collectStringLeaves107ii,
  ]) {
    expect(collect(bare)).toHaveLength(leaves);
  }
  for (const render of [
    canonicalJson1023,
    canonicalJson106,
    canonicalJson107i,
    canonicalJson107ii,
  ]) {
    const rendered = render(bare);
    expect(rendered.length).toBeGreaterThan(depth * 100);
    const decoded = decodeViewReport(JSON.parse(rendered), { text: false });
    expect(countViewNodes(decoded.views[0]!.root)).toEqual({
      nodes: depth + 1,
      depth,
    });
  }
  const canonicalized = decodeViewReport(canonicalizeJson(bare), {
    text: false,
  });
  expect(countViewNodes(canonicalized.views[0]!.root)).toEqual({
    nodes: depth + 1,
    depth,
  });

  // `ids --tree` one node per level; `ids` and the row reports at the
  // section count T1.3-7's `query subtree` returns (root plus every level).
  const idsTree = decodeIdsTreeReport(
    JSON.parse(buildIdsTreeDocument(depth)),
    "S-8 ids --tree",
  );
  expect(countIdsNodes(idsTree.files[0]!.nodes)).toEqual({
    nodes: depth,
    depth,
  });
  const ids = identities(depth + 1);
  expect(
    decodeIdsReport({ files: [{ file: VIEWED_FILE, ids }] }).files[0]!.ids,
  ).toHaveLength(depth + 1);
  const rows = {
    nodes: [
      {
        identity: VIEWED_FILE,
        sourceRange: { start: 0, end: TOWER_BYTES },
        tags: [],
      },
      ...ids.map((identity, index) => ({
        identity,
        sourceRange: { start: index, end: index + 1 },
        tags: ["t1"],
        coverage: "none",
      })),
    ],
  };
  expect(decodeNodeRowsReport(rows, "S-8 rows")).toHaveLength(depth + 2);
  expect(decodeNodeSummaryRowsReport(rows, "S-8 rows")).toHaveLength(depth + 2);
  expect(decodeNodeIdentityRowsReport(rows, "S-8 rows")).toHaveLength(
    depth + 2,
  );

  // Edge surfaces at the chain's edge count, each through the bare-endpoint
  // walk; a reachability witness the length of the chain.
  const edges = ids.slice(0, -1).map((from, index) => ({
    from,
    to: ids[index + 1]!,
    kind: "contains",
  }));
  expect(decodeEdgesReport({ edges }, "S-8 edges")).toHaveLength(depth);
  assertBareEdgeEndpoints({ edges }, "S-8 edges");
  const node = {
    identity: VIEWED_FILE,
    sourceRange: { start: 0, end: TOWER_BYTES },
    ownText: "",
    subtreeText: "deep.\n",
    hashes: {
      ownHash: "o",
      subtreeHash: "s",
      effectiveHash: "e",
      metadataHash: "m",
    },
    tags: [],
    edges: { incoming: edges, outgoing: edges },
  };
  expect(decodeNodeReport(node, "S-8 node").incomingEdges).toHaveLength(depth);
  expect(
    decodeNodeTextAlgebraSummary(node, "S-8 node").containsTargets,
  ).toHaveLength(depth);
  assertNodeEdgeListsBare(node, "S-8 node");
  const reachable = { reachable: true, path: ids };
  expect(decodeReachableReport(reachable, "S-8 reachable").path).toHaveLength(
    depth + 1,
  );
  assertBareEdgeEndpoints(reachable, "S-8 reachable");

  // The flat 12.7 surfaces at the same count: findings-only, occurrences,
  // `at`, and the exit-2 error document.
  const findingsOnly = JSON.parse(
    `{"findings":[${(() => {
      const out: string[] = [];
      appendFindings(out, flat);
      return out.join("");
    })()}]}`,
  ) as unknown;
  expect(
    decodeFindingsReport(findingsOnly, "S-8 findings").findings,
  ).toHaveLength(flat + 1);
  expect(
    decodeOccurrencesReport(
      { findings: [], occurrences: fileView.occurrences },
      "S-8 occurrences",
    ).occurrences,
  ).toHaveLength(flat);
  const at = {
    findings: (findingsOnly as { findings: unknown[] }).findings,
    resolution: {
      section: {
        identity: { unavailable: true },
        range: { start: 0, end: 10 },
      },
      occurrence: null,
    },
  };
  expect(decodeAtReport(at, "S-8 at").findings).toHaveLength(flat + 1);
  const error = decodeErrorDocument(
    { error: (findingsOnly as { findings: unknown[] }).findings[0] },
    "S-8 error",
  );
  expect(error.error.locations).toHaveLength(flat);
}, 120_000);

// ---------------------------------------------------------------------------
// 3. The capture gate: the largest synthetic document through the H-2 path

// S-3's stand-in mechanism: an argv-driven Node script written into a fresh
// TestWorkspace and driven through the same ProductBinding shape product
// invocations use. It streams a staged file to standard output in 64 KiB
// chunks and lets the event loop drain before exiting — never process.exit,
// which could drop a pipe's pending writes: that is the product-side defect
// a truncated capture is indistinguishable from (H-11), and the gate must
// know its stand-in emitted every byte.
const EMIT_SOURCE = `import { createReadStream } from "node:fs";

const [file] = process.argv.slice(2);
const source = createReadStream(file, { highWaterMark: 1 << 16 });
source.on("error", (error) => {
  process.stderr.write(String(error));
  process.exitCode = 1;
});
source.pipe(process.stdout, { end: false });
`;

/**
 * The capture gate's argv: the file the stand-in streams, then `--json`,
 * which the stand-in ignores and the driver reads as putting JSON output
 * in effect (SPEC 12.0), so the capture takes the path a product's JSON
 * answer takes — T12.7-1's walk over the captured document included.
 */
const CAPTURE_ARGV: readonly string[] = ["answer.json", "--json"];

/** Write JSON text pieces to a file under back-pressure; the byte length. */
async function writePieces(
  path: string,
  pieces: readonly string[],
): Promise<number> {
  const stream = createWriteStream(path);
  const failure = new Promise<never>((_, reject) => {
    stream.once("error", reject);
  });
  let bytes = 0;
  for (const piece of pieces) {
    bytes += Buffer.byteLength(piece, "utf8");
    if (!stream.write(piece)) {
      await Promise.race([once(stream, "drain"), failure]);
    }
  }
  await Promise.race([
    new Promise<void>((resolve) => {
      stream.end(resolve);
    }),
    failure,
  ]);
  return bytes;
}

/** Byte identity of the emitted file and the captured bytes, streamed. */
async function assertCapturedFile(
  path: string,
  captured: Uint8Array,
): Promise<void> {
  let offset = 0;
  for await (const chunk of createReadStream(path, {
    highWaterMark: 1 << 20,
  })) {
    const bytes = chunk as Buffer;
    if (!bytes.equals(captured.subarray(offset, offset + bytes.length))) {
      throw new Error(
        `S-8: the captured stdout diverges from the emitted document at byte ${String(offset)} (H-2 capture; H-11)`,
      );
    }
    offset += bytes.length;
  }
  expect(offset).toBe(captured.length);
}

/**
 * The blowup tower's text members, JSON-escaped: level k's own text is its
 * two U+2028 separators (the innermost: separator, content line, separator),
 * its subtree text every level from k inward — built inward-out so each
 * level's string is one concatenation, never a recursion.
 */
function blowupTowerText(depth: number): TowerText {
  const own = (level: number): string =>
    level === depth
      ? `${SEPARATOR_ESCAPED}deep.${SEPARATOR_ESCAPED}`
      : `${SEPARATOR_ESCAPED}${SEPARATOR_ESCAPED}`;
  const subtree: string[] = new Array<string>(depth + 1).fill("");
  subtree[depth] = own(depth);
  for (let level = depth - 1; level >= 1; level -= 1) {
    subtree[level] = own(level) + subtree[level + 1]!;
  }
  return { own, subtree: (level) => subtree[level]! };
}

/** Decoded characters of one tower's subtree text at level k. */
const decodedSubtreeLength = (depth: number, level: number): number =>
  2 * (depth - level) + 7;

test("S-8: capture gate — the largest synthetic document (`view --text` blowup) captured complete and identical, then decoded", async () => {
  const workspace = await TestWorkspace.create({
    files: { "emit.mjs": EMIT_SOURCE },
  });
  onTestFinished(() => workspace.dispose());
  const binding: ProductBinding = {
    label: "S-8 stand-in",
    command: process.execPath,
    prefixArgs: [workspace.path("emit.mjs")],
  };

  const text = blowupTowerText(BLOWUP_DEPTH);
  const documentPath = workspace.path("answer.json");
  const documentBytes = await writePieces(
    documentPath,
    buildViewDocument({
      towers: BLOWUP_TOWERS,
      depth: BLOWUP_DEPTH,
      text,
      rootText: { own: "", subtree: text.subtree(1).repeat(BLOWUP_TOWERS) },
      identity: "string",
      flat: 0,
    }),
  );
  // The document holds every level's re-emitted text: per tower
  // Σ_k (12·(D − k) + 17) escaped characters, and it dwarfs the staged
  // input it answers (S-8: "past its staged input's own size").
  const perTowerText =
    (12 * BLOWUP_DEPTH * (BLOWUP_DEPTH - 1)) / 2 + 17 * BLOWUP_DEPTH;
  expect(documentBytes).toBeGreaterThan(BLOWUP_TOWERS * perTowerText);
  expect(documentBytes).toBeLessThan(
    BLOWUP_TOWERS * perTowerText + 16 * 1024 * 1024,
  );
  expect(documentBytes).toBeGreaterThan(500 * LARGEST_GENERATED_INPUT_BYTES);
  // …and past the largest document the suite stages at all (today T1.3-7's
  // deterministic tower) by a documented factor: that fixture's largest
  // answer is ~13 MB of `view` over its ~4.2 MB input (section-1.3.ts's
  // T1.3-7 comment), about 3×, so a synthetic scale at least 8× the staged
  // maximum keeps every answer the deterministic anchor elicits inside what
  // the decoders and the capture are gated at, with margin — ~48× today;
  // this pin trips once a grown DEPTH_FLOOR (a quadratic file) brings
  // T1.3-7's answers near the synthetic scale.
  expect(documentBytes).toBeGreaterThan(8 * LARGEST_STAGED_INPUT_BYTES);
  // The capture cap is dimensioned to this scale with headroom (H-11).
  expect(DEFAULT_MAX_OUTPUT_BYTES).toBeGreaterThanOrEqual(2 * documentBytes);

  // A cap just below the document surfaces as the typed overflow error —
  // loud, never a truncated capture (run first so its buffers are released
  // before the complete capture below).
  await expect(
    runProduct(binding, {
      cwd: workspace.root,
      argv: CAPTURE_ARGV,
      timeoutMs: 120_000,
      maxOutputBytes: documentBytes - 1,
    }),
  ).rejects.toBeInstanceOf(ProductRunOutputOverflowError);

  // The complete capture through the H-2 path: complete, byte-identical —
  // and walked by the driver for T12.7-1 before the run resolves, since
  // the argv puts JSON output in effect as a product invocation's would.
  expect(jsonOutputInEffect(CAPTURE_ARGV)).toBe(true);
  const result = await runProduct(binding, {
    cwd: workspace.root,
    argv: CAPTURE_ARGV,
    timeoutMs: 120_000,
  });
  expect(result.signal).toBeNull();
  expect(result.exitCode).toBe(0);
  expect(result.stderrBytes.length).toBe(0);
  expect(result.stdoutBytes.length).toBe(documentBytes);
  await assertCapturedFile(documentPath, result.stdoutBytes);

  // Evaluation from the capture itself (capture through evaluation): the
  // stdout-to-document step product tests use, the form-exact decode, the
  // marker and P-11 walks, and the text datum sizes the blowup implies.
  const doc = parseJsonStdout(result, "S-8 capture");
  const view = decodeViewReport(doc, { text: true }, "S-8 blowup view --text");
  const root = view.views[0]!.root;
  expect(countViewNodes(root)).toEqual({
    nodes: BLOWUP_TOWERS * BLOWUP_DEPTH + 1,
    depth: BLOWUP_DEPTH,
  });
  expect(root.children).toHaveLength(BLOWUP_TOWERS);
  let reEmitted = 0;
  const stack: ViewNode[] = [...root.children];
  while (stack.length > 0) {
    const node = stack.pop()!;
    expect(typeof node.subtreeText).toBe("string");
    reEmitted += (node.subtreeText as string).length;
    stack.push(...node.children);
  }
  let expectedReEmitted = 0;
  for (let level = 1; level <= BLOWUP_DEPTH; level += 1) {
    expectedReEmitted +=
      BLOWUP_TOWERS * decodedSubtreeLength(BLOWUP_DEPTH, level);
  }
  expect(reEmitted).toBe(expectedReEmitted);
  const outer = root.children[0]!;
  expect(outer.subtreeText).toBe(
    `${SEPARATOR.repeat(2 * BLOWUP_DEPTH - 1)}deep.${SEPARATOR}`,
  );
  expect(innermost(outer).ownText).toBe(`${SEPARATOR}deep.${SEPARATOR}`);
  assertUnavailabilityMarkerForms(doc, "S-8 blowup");
  expect(documentCarriesUnavailability(doc)).toBe(false);
  // P-3's decode of the root's `query node` answer at the blowup scale: the
  // captured texts and range, and one `contains` edge per tower.
  const summary = decodeNodeTextAlgebraSummary(
    {
      ownText: root.ownText,
      subtreeText: root.subtreeText,
      sourceRange: root.range,
      edges: {
        incoming: [],
        outgoing: root.children.map((child) => ({
          from: VIEWED_FILE,
          to: child.identity,
          kind: "contains",
        })),
      },
    },
    "S-8 text summary",
  );
  expect(summary.subtreeText).toHaveLength(
    BLOWUP_TOWERS * decodedSubtreeLength(BLOWUP_DEPTH, 1),
  );
  expect(summary.containsTargets).toHaveLength(BLOWUP_TOWERS);
}, 600_000);

/**
 * Stand-in for the two driver kills a fuzz command run can meet (header
 * item 4): `flood` writes 4 MiB to stdout and exits — past any small capture
 * cap — and `hang` never exits.
 */
const GUARD_STANDIN_SOURCE = `const mode = process.argv[2];
if (mode === "flood") {
  const chunk = "x".repeat(1 << 16);
  for (let i = 0; i < 64; i += 1) process.stdout.write(chunk);
} else {
  setInterval(() => {}, 60000);
}
`;

/** The seed the guard vectors run under (one of E-5's fixed seeds). */
const GUARD_VECTOR_SEED = 314159265;

/** What a run rejects with; a run that resolves fails the vector. */
async function rejectionOf(run: Promise<unknown>): Promise<unknown> {
  try {
    await run;
  } catch (error) {
    return error;
  }
  throw new Error("S-8: expected the run to reject");
}

test("S-8: an exhausted capture limit in a P-8 or P-11 command run is a harness error naming the seed, never a falsified property; the hang-guard kill stays a diagnosed failure (H-11; S-3)", async () => {
  const workspace = await TestWorkspace.create({
    files: { "guards.mjs": GUARD_STANDIN_SOURCE },
  });
  onTestFinished(() => workspace.dispose());
  const binding: ProductBinding = {
    label: "S-8 guard stand-in",
    command: process.execPath,
    prefixArgs: [workspace.path("guards.mjs")],
  };
  const runners = [
    ["P-8", runFuzzCommand],
    ["P-11", runAvailabilityCommand],
  ] as const;
  for (const [property, run] of runners) {
    // The capture cap lowered below what `flood` emits: the kill propagates
    // out of the body, and `checkProperty` reports it as a harness error
    // carrying the seed — neither a `PropertyFalsifiedError` nor any other
    // `HarnessAssertionError`.
    const overflow = await rejectionOf(
      checkProperty(
        `${property} capture-limit vector`,
        () => null,
        async () => {
          await run(binding, workspace, ["flood"], { maxOutputBytes: 4096 });
        },
        {
          runs: 1,
          seeds: [GUARD_VECTOR_SEED],
          env: {},
          maxShrinkExecutions: 0,
        },
      ),
    );
    expect(overflow, property).toBeInstanceOf(Error);
    expect(overflow, property).not.toBeInstanceOf(HarnessAssertionError);
    const error = overflow as Error;
    expect(error.message, property).toContain(
      `harness error while running trial 1 of 1 with seed ${String(GUARD_VECTOR_SEED)}`,
    );
    expect(error.message, property).toContain(
      `${PROPERTY_SEED_ENV}=${String(GUARD_VECTOR_SEED)}`,
    );
    expect(error.cause, property).toBeInstanceOf(ProductRunOutputOverflowError);

    // The hang guard lowered below `hang`'s lifetime: the kill falsifies the
    // property's termination clause, a diagnosed failure naming the seed.
    const hang = await rejectionOf(
      checkProperty(
        `${property} hang-guard vector`,
        () => null,
        async () => {
          await run(binding, workspace, ["hang"], { timeoutMs: 300 });
        },
        {
          runs: 1,
          seeds: [GUARD_VECTOR_SEED],
          env: {},
          maxShrinkExecutions: 0,
        },
      ),
    );
    expect(hang, property).toBeInstanceOf(PropertyFalsifiedError);
    const falsified = hang as PropertyFalsifiedError;
    expect(falsified.seed, property).toBe(GUARD_VECTOR_SEED);
    expect(falsified.assertionMessage, property).toContain(
      "hang guard killed it",
    );
  }
}, 60_000);

/**
 * Stand-in for the conversion vectors (header items 5 and 6). Its mode rides
 * the binding's prefix, so the argv a helper appends — a P-10 menu read, a
 * move, a `--test-hold <path>` pair — follows it, read only for the hold
 * path: `flood` writes 4 MiB to stdout and exits, past any small capture
 * cap; `exit` exits 3 and `complete` exits 0, at once; `hold-flood`,
 * `hold-hang`, and `hold-complete` create the hold file, wait for its
 * deletion, then flood, never exit, or exit 0; anything else never exits.
 */
const CONVERSION_STANDIN_SOURCE = `import fs from "node:fs";
const mode = process.argv[2];
const flood = () => {
  const chunk = "x".repeat(1 << 16);
  for (let i = 0; i < 64; i += 1) process.stdout.write(chunk);
};
const hang = () => setInterval(() => {}, 60000);
if (mode === "flood") {
  flood();
} else if (mode === "exit") {
  process.exit(3);
} else if (mode === "complete") {
  process.exit(0);
} else if (mode === "hold-flood" || mode === "hold-hang" || mode === "hold-complete") {
  const hold = process.argv[process.argv.indexOf("--test-hold") + 1];
  fs.writeFileSync(hold, "");
  const poll = setInterval(() => {
    if (!fs.existsSync(hold)) {
      clearInterval(poll);
      if (mode === "hold-flood") flood();
      else if (mode === "hold-complete") process.exit(0);
      else hang();
    }
  }, 10);
} else {
  hang();
}
`;

test("S-8: an exhausted capture limit propagates as a harness error out of every shared helper that converts a run's rejection into a diagnosed failure — 13.5's, the write-refusal staging's, P-10's — while the hang-guard kill and a premature exit stay diagnosed failures (H-11; S-3)", async () => {
  const workspace = await TestWorkspace.create({
    files: { "conversions.mjs": CONVERSION_STANDIN_SOURCE },
  });
  onTestFinished(() => workspace.dispose());
  const standin = (mode: string): ProductBinding => ({
    label: `S-8 conversion stand-in (${mode})`,
    command: process.execPath,
    prefixArgs: [workspace.path("conversions.mjs"), mode],
  });
  const start = async (
    mode: string,
    guards: RunGuards = {},
  ): Promise<RunningProduct> =>
    await startProduct(standin(mode), {
      cwd: workspace.root,
      ...guards,
    });
  // The capture cap lowered below what `flood` emits, and the hang guard
  // below `hang`'s lifetime.
  const capped: RunGuards = { maxOutputBytes: 4096 };
  const guarded: RunGuards = { timeoutMs: 300 };
  // The held helper's staging is beside the point here: a no-op.
  const noStaging: StagingApplier = async (root) => ({
    mode: "write-refusal",
    path: root,
    restore: async () => {},
  });
  const context = "S-8 conversion vector";
  const helpers: readonly {
    readonly helper: string;
    readonly overflow: () => Promise<unknown>;
    readonly diagnosed: () => Promise<unknown>;
  }[] = [
    {
      helper: "13.5's runBounded",
      overflow: () =>
        runBounded(standin("flood"), workspace.root, [], context, capped),
      diagnosed: () =>
        runBounded(standin("hang"), workspace.root, [], context, guarded),
    },
    {
      helper: "the write-refusal staging's awaitHoldFile",
      overflow: async () =>
        await awaitHoldFile(
          await start("flood", capped),
          holdPathFor(workspace, "never-a.tmp"),
          context,
        ),
      diagnosed: async () =>
        await awaitHoldFile(
          await start("exit"),
          holdPathFor(workspace, "never-b.tmp"),
          context,
        ),
    },
    {
      helper: "the write-refusal staging's runSettled",
      overflow: () =>
        runSettled(standin("flood"), workspace, [], context, capped),
      diagnosed: () =>
        runSettled(standin("hang"), workspace, [], context, guarded),
    },
    {
      helper: "the write-refusal staging's runHeldWithStaging",
      overflow: () =>
        runHeldWithStaging(
          standin("hold-flood"),
          workspace,
          [],
          "hold-a.tmp",
          noStaging,
          context,
          capped,
        ),
      // A guard long enough for the hold to appear first; a stand-in slower
      // than that dies before it and fails as diagnosed all the same.
      diagnosed: () =>
        runHeldWithStaging(
          standin("hold-hang"),
          workspace,
          [],
          "hold-b.tmp",
          noStaging,
          context,
          { timeoutMs: 1500 },
        ),
    },
    {
      helper: "P-10's runHeldRead",
      overflow: () =>
        runHeldRead(standin("flood"), workspace.root, 0, context, capped),
      diagnosed: () =>
        runHeldRead(standin("hang"), workspace.root, 0, context, guarded),
    },
    {
      helper: "P-10's settleStraddleRead",
      overflow: async () =>
        await settleStraddleRead(
          { running: await start("flood", capped), what: "`flood`" },
          context,
        ),
      diagnosed: async () =>
        await settleStraddleRead(
          { running: await start("hang", guarded), what: "`hang`" },
          context,
        ),
    },
    {
      helper: "P-10's settleKilled",
      overflow: async () =>
        await settleKilled(await start("flood", capped), context),
      diagnosed: async () =>
        await settleKilled(await start("hang", guarded), context),
    },
  ];
  for (const { helper, overflow, diagnosed } of helpers) {
    const overflowed = await rejectionOf(overflow());
    expect(overflowed, helper).toBeInstanceOf(ProductRunOutputOverflowError);
    expect(overflowed, helper).not.toBeInstanceOf(HarnessAssertionError);
    const failed = await rejectionOf(diagnosed());
    expect(failed, helper).toBeInstanceOf(HarnessAssertionError);
    expect((failed as Error).message, helper).toContain(context);
  }
  // 13.5's describeExit folds a settled run into a premature-exit
  // diagnosis — except an exhausted capture limit, which propagates.
  const described = await rejectionOf(
    describeExit(await start("flood", capped)),
  );
  expect(described).toBeInstanceOf(ProductRunOutputOverflowError);
  expect(await describeExit(await start("exit"))).toContain("exit code 3");
}, 60_000);

/** The module the driver loads on demand for T6.5-22(a)'s check. */
const CHECK_MODULE = "../helpers/added-import-identifiers.js";

test("S-8: a failure of the driver's in-run evaluation — T6.5-22(a)'s check of a performed move — propagates as the harness error HarnessEvaluationError out of every shared helper through which a move can run — 13.5's, the write-refusal staging's, P-10's — never converted into a diagnosed HarnessAssertionError (H-11; S-3)", async () => {
  const workspace = await TestWorkspace.create({
    files: { "conversions.mjs": CONVERSION_STANDIN_SOURCE },
  });
  onTestFinished(() => workspace.dispose());
  // The check made to fail on purpose (header item 6): whatever the run
  // did, judging it crashes — the harness's failure, never the product's.
  const original = new Error("S-8: the check's judgement crashed");
  vi.doMock(CHECK_MODULE, async (importOriginal) => ({
    ...(await importOriginal<typeof AddedImportCheckModule>()),
    prepareAddedImportCheck: async () => ({
      verify: async () => {
        throw original;
      },
    }),
  }));
  onTestFinished(() => {
    vi.doUnmock(CHECK_MODULE);
  });
  const standin = (mode: string): ProductBinding => ({
    label: `S-8 evaluation stand-in (${mode})`,
    command: process.execPath,
    prefixArgs: [workspace.path("conversions.mjs"), mode],
  });
  // A performed move, as the driver reads the argv; the stand-in's mode
  // decides what the run does.
  const move = ["move", "specs/A.mdx", "specs/B.mdx"];
  const startMove = async (mode: string): Promise<RunningProduct> =>
    await startProduct(standin(mode), { cwd: workspace.root, argv: move });
  // The held helper's staging is beside the point here: a no-op.
  const noStaging: StagingApplier = async (root) => ({
    mode: "write-refusal",
    path: root,
    restore: async () => {},
  });
  const context = "S-8 evaluation vector";
  const helpers: readonly {
    readonly helper: string;
    readonly run: () => Promise<unknown>;
  }[] = [
    {
      helper: "13.5's runBounded",
      run: () => runBounded(standin("complete"), workspace.root, move, context),
    },
    {
      helper: "13.5's describeExit",
      run: async () => await describeExit(await startMove("complete")),
    },
    {
      // The move exits before creating the hold file: the premature-exit
      // path, whose settled outcome is the failed evaluation.
      helper: "the write-refusal staging's awaitHoldFile",
      run: async () =>
        await awaitHoldFile(
          await startMove("complete"),
          holdPathFor(workspace, "never-c.tmp"),
          context,
        ),
    },
    {
      helper: "the write-refusal staging's runSettled",
      run: () => runSettled(standin("complete"), workspace, move, context),
    },
    {
      helper: "the write-refusal staging's runHeldWithStaging",
      run: () =>
        runHeldWithStaging(
          standin("hold-complete"),
          workspace,
          move,
          "hold-c.tmp",
          noStaging,
          context,
        ),
    },
    {
      helper: "P-10's settleStraddleRead",
      run: async () =>
        await settleStraddleRead(
          { running: await startMove("complete"), what: "`move`" },
          context,
        ),
    },
    {
      // A mutator that completed before its kill landed is judged as any
      // completed move is.
      helper: "P-10's settleKilled",
      run: async () => await settleKilled(await startMove("complete"), context),
    },
  ];
  for (const { helper, run } of helpers) {
    const rejected = await run().then(
      () => {
        throw new Error(
          `S-8: ${helper} resolved — it must reject with the failed evaluation`,
        );
      },
      (thrown: unknown) => thrown,
    );
    expect(rejected, helper).toBeInstanceOf(HarnessEvaluationError);
    expect(rejected, helper).not.toBeInstanceOf(HarnessAssertionError);
    expect((rejected as HarnessEvaluationError).cause, helper).toBe(original);
  }
  // P-10 runs its episodes inside the property runner, which reports what
  // escapes a body — this harness error included — as a harness error
  // naming the seed, never a falsified property.
  const reported = await rejectionOf(
    checkProperty(
      "P-10 evaluation vector",
      () => null,
      async () => {
        await settleKilled(await startMove("complete"), context);
      },
      {
        runs: 1,
        seeds: [GUARD_VECTOR_SEED],
        env: {},
        maxShrinkExecutions: 0,
      },
    ),
  );
  expect(reported).toBeInstanceOf(Error);
  expect(reported).not.toBeInstanceOf(HarnessAssertionError);
  expect((reported as Error).message).toContain(
    `harness error while running trial 1 of 1 with seed ${String(GUARD_VECTOR_SEED)}`,
  );
  expect((reported as Error).cause).toBeInstanceOf(HarnessEvaluationError);
}, 60_000);
