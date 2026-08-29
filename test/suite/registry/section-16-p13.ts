// TEST-SPEC §16 P-13 (coverage oracle) — PROP-11.
//
// One registered product-facing property test (C-2 "one code path"): a
// seeded, reproducible generator (helpers/property.ts, H-10; fixed seed set
// in CI, E-5) produces small random workspaces spanning P-13's stated input
// space — spec and code groups; `depends`, `embeds`, and `references` edges;
// tags; `coverage="none"`; root-sourced and root-targeted edges — plus 1–3
// random coverage profiles over every 7.4 knob (`mode`, `targets` omitted /
// `"leaves"` / `"all"`, `targetTags` omitted or drawn — a tag no node
// carries included — `edgeKinds` omitted or any non-empty subset, spec and
// code boundaries, boundary∩target overlap included), builds the workspace,
// and asserts one `coverage --json` run against the independent
// SPEC 8/8.1/8.2 reachability oracle (helpers/oracles/coverage.ts,
// `computeCoverage` — S-6-vetted on SPEC 15's worked material before any
// trial trusts it, TEST-SPEC §17 S-6): per profile the four 8.2 counts, the
// covered set with one shortest covering path per node (boundary node
// first, permitted kinds only, `contains`-free and root-free, equal-length
// ties by the element-wise 12.0 byte-least sequence — the tie-break's
// minimum is unique, so exact path equality is exactly P-13's "every
// reported covering path is a permitted path … shortest with the 12.0
// tie-break"), the uncovered set, and the ignored set with all applicable
// exclusion reasons in the fixed 8.2 order. The required set is observed
// through covered ∪ uncovered plus the required count (SPEC 8.2 reports
// counts and the covered/uncovered/ignored identities; 8.1: required =
// covered ∪ uncovered). Oracle independence holds by construction: the
// oracle is fed the generator's own graph model — nodes, children, tags,
// coverage attributes, edges, group memberships — never anything read back
// from the product.
//
// Conservative operationalizations (H-3, the §8 suite's discipline):
// SPEC 8.2 fixes membership, per-node information, and counts — no row or
// profile order — so rows compare identity-byte sorted while covering paths
// compare as exact sequences; ignored-reason spellings are output shape,
// mapped onto the four 8.2 reason identities order-preservingly by
// `classifyIgnoredReasons` (fail-loud, never defaulting); profiles are
// matched by name after asserting the report carries exactly the configured
// profile names (8.2: all profiles run by default).
//
// Validity by construction (every trial's `build` must exit 0 — a valid
// workspace is P-13's input space; SPEC 5.3, 2.1): every node gets a rank —
// file index, then post-order position within the file (children before
// parents, the root last) — and every drawn reference targets a strictly
// lower rank in the same file or any node of an earlier file. All edges
// then strictly decrease the (file, post-order) key — `contains` edges
// parent→child included — so the combined contains/depends/embeds graph is
// acyclic, no section depends on or embeds an ancestor or itself, and spec
// imports (each file imports exactly the earlier files) cannot cycle; code
// locations source edges to arbitrary spec nodes (roots included) and are
// never edge targets, so they cannot cycle either. IDs are structural
// dotted paths unique per file (1.3); every reference targets a staged node
// of a discovered file (every spec and code file belongs to at least one
// group — membership repair appends uncovered files to the first group);
// spec and code directories are disjoint (7.2) and group names distinct, so
// `boundaryKind` is always inferable (7.4). Rendering follows the proven
// fixture discipline: import lines form one ESM block followed by a
// mandatory blank line (the FP-094 lesson), root-sourced embeddings are
// top-level `{text(…)}` flow-expression blocks (T8-5's staging), in-section
// embeddings sit blank-line-separated in the body (T8-2's staging), and
// nested sections spell full dotted IDs (T8-2). Root-targeted edges are the
// module-form `d={M<j>}` / `{text(M<j>)}` spellings (2.2, 2.3) and code
// markers/`text` calls naming a module binding alone (4.5); root-sourced
// edges are the top-level embeddings. Section segments are drawn from
// deliberately non-sorted pools (document order k,d,t vs byte order d,k,t)
// so identity byte order and graph structure decouple and the 12.0
// tie-break is exercised on real ties.
//
// An implementation-time dry-run over the committed default seeds at the
// registered 8 runs per seed (24 CI-pinned trials, E-5) verified that every
// staged MDX source parses under remark-mdx with its imports as real ESM
// blocks, every staged TypeScript source parses cleanly, every oracle input
// passes the oracle's misuse guards (acyclicity included), and every input
// class occurs: all three edge kinds, tags, coverage="none",
// root-sourced and root-targeted edges, code files and code boundaries,
// spec boundaries, boundary∩target overlap, both modes, targets
// "leaves"/"all"/omitted, targetTags present (a no-node tag included) and
// omitted, edgeKinds restricted and omitted, all four ignored reasons
// (multi-reason rows included), non-empty covered/uncovered/ignored sets,
// multi-edge transitive paths (11 covered rows), and covered nodes whose
// shortest covering path is tie-broken among several equal-length
// candidates (16 rows). The previous iteration's built product (whose
// coverage engine predates this patch) accepts all 24 workspaces (`build`
// exit 0 — the validity-by-construction proof) and agrees with the oracle
// on all their profile runs, while six implementation-time teeth probes
// (each reverted) all falsified the property against that product:
// transitive-run-as-direct, coverage="none" dropped, tags dropped, children
// (leaf judgment) dropped, code-sourced edges dropped, and reported paths
// reversed — the last failing the covered-path assertion specifically.
//
// P-13 is expressly outside every CERTIFICATIONS.md fixture scope (its
// Exclusions name P-13 directly: the anchors are loud positive fixtures and
// the oracle is S-6-vetted), so this body binds only to the real product
// surface.

import { Buffer } from "node:buffer";
import type { CoverageProfileReport } from "../../helpers/adapters/index.js";
import {
  classifyIgnoredReasons,
  decodeCoverageReport,
} from "../../helpers/adapters/index.js";
import { fail } from "../../helpers/assertions.js";
import type {
  CoverageOracleEdge,
  CoverageOracleEdgeKind,
  CoverageOracleInput,
  CoverageOracleNode,
  CoverageOracleResult,
} from "../../helpers/oracles/coverage.js";
import { computeCoverage } from "../../helpers/oracles/coverage.js";
import type { Choices, Gen } from "../../helpers/property.js";
import { checkProperty } from "../../helpers/property.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import { assertSameJson, buildOk, runJson } from "./support.js";

// ---------------------------------------------------------------------------
// Fixed naming pools (module header: segment pools deliberately non-sorted).

/** Spec source paths by file index (each file in its own directory, 7.1). */
const SPEC_PATHS = ["s0/A.mdx", "s1/B.mdx", "s2/C.mdx"] as const;
/** The corresponding import specifier stems (`DIR/NAME.xspec`, SPEC 2.1). */
const SPEC_XSPEC = ["s0/A.xspec", "s1/B.xspec", "s2/C.xspec"] as const;
/** Code source paths by file index (disjoint directories, SPEC 7.2). */
const CODE_PATHS = ["c0/U.ts", "c1/V.ts"] as const;

/** Top-level ID segments: document order k, d, t — byte order d, k, t. */
const TOP_SEGMENTS = ["k", "d", "t"] as const;
/** Child segments: document order m, b — byte order b, m. */
const CHILD_SEGMENTS = ["m", "b"] as const;
/** Grandchild segment (depth cap 2). */
const GRAND_SEGMENT = "x";
/** Named-unit (function) names per code file (unique — no `@N`, 4.6). */
const UNIT_NAMES = ["f", "g"] as const;

/** Section tag sets (SPEC 2.6); the empty (omitted-prop) set first. */
const TAG_SETS: ReadonlyArray<readonly string[]> = [
  [],
  ["red"],
  ["blu"],
  ["red", "blu"],
];
/** Profile targetTags menus (7.4) — `zz` is a tag no node ever carries. */
const TARGET_TAG_SETS: ReadonlyArray<readonly string[]> = [
  ["red"],
  ["blu"],
  ["red", "blu"],
  ["zz"],
  ["blu", "zz"],
];
/** Non-empty edgeKinds subsets (7.4), singletons first. */
const KIND_SETS: ReadonlyArray<readonly CoverageOracleEdgeKind[]> = [
  ["depends"],
  ["embeds"],
  ["references"],
  ["depends", "embeds"],
  ["depends", "references"],
  ["embeds", "references"],
  ["depends", "embeds", "references"],
];

/** Spec group names by group index; disjoint from code group names (7.4). */
const SPEC_GROUP_NAMES = ["sa", "sb", "sc"] as const;
const CODE_GROUP_NAMES = ["ka", "kb"] as const;
/** Non-empty index subsets of {0..n-1}, singletons (simplest) first. */
const NONEMPTY_SUBSETS: ReadonlyArray<ReadonlyArray<readonly number[]>> = [
  [[0]],
  [[0], [1], [0, 1]],
  [[0], [1], [2], [0, 1], [0, 2], [1, 2], [0, 1, 2]],
];

// ---------------------------------------------------------------------------
// The trial model.

/** One requirement section (SPEC 1.1/1.3): full dotted ID and identity. */
export interface P13Section {
  /** The node identity `path#id` (SPEC 1.5). */
  readonly identity: string;
  /** The full dotted ID (structural path, SPEC 1.3). */
  readonly id: string;
  readonly tags: readonly string[];
  /** The spelled coverage attribute; `null` = none spelled (SPEC 2.5). */
  readonly coverage: "required" | "none" | null;
  /** `d`-prop target identities (depends edges, SPEC 2.2), deduplicated. */
  readonly dRefs: readonly string[];
  /** In-body `{text(…)}` target identities (embeds edges, SPEC 2.3). */
  readonly embeds: readonly string[];
  readonly children: readonly P13Section[];
}

/** One spec source file. */
export interface P13SpecFile {
  readonly index: number;
  readonly path: string;
  /** Top-level `{text(…)}` targets — root-sourced embeds edges (2.3, 8). */
  readonly rootEmbeds: readonly string[];
  readonly sections: readonly P13Section[];
}

/** One TypeScript statement recording an edge (SPEC 4.3, 4.5). */
export interface P13CodeStatement {
  /** `marker` → references edge; `text` → embeds edge. */
  readonly kind: "marker" | "text";
  /** The target node identity (a root identity = module-form spelling). */
  readonly target: string;
}

/** One code source file (SPEC 4.6: file location + named units). */
export interface P13CodeFile {
  readonly index: number;
  readonly path: string;
  /** Top-level statements, attributed to the whole-file location (4.6). */
  readonly topLevel: readonly P13CodeStatement[];
  readonly units: ReadonlyArray<{
    readonly name: string;
    readonly statements: readonly P13CodeStatement[];
  }>;
}

/** One coverage profile (SPEC 7.4); `null` members are omitted from config. */
export interface P13Profile {
  readonly name: string;
  /** A spec group name. */
  readonly target: string;
  /** A spec or code group name (names are disjoint — kind inferable, 7.4). */
  readonly boundary: string;
  readonly mode: "direct" | "transitive";
  readonly targets: "leaves" | "all" | null;
  readonly targetTags: readonly string[] | null;
  readonly edgeKinds: readonly CoverageOracleEdgeKind[] | null;
}

/** One generated trial: the whole workspace and profile model. */
export interface P13Trial {
  readonly specFiles: readonly P13SpecFile[];
  readonly codeFiles: readonly P13CodeFile[];
  /** Spec groups: name → member spec-file indices (deduplicated). */
  readonly specGroups: ReadonlyArray<readonly [string, readonly number[]]>;
  /** Code groups: name → member code-file indices (deduplicated). */
  readonly codeGroups: ReadonlyArray<readonly [string, readonly number[]]>;
  readonly profiles: readonly P13Profile[];
}

// ---------------------------------------------------------------------------
// Generation (module header: structure pass, then rank-disciplined refs).

interface MutableSection {
  identity: string;
  id: string;
  tags: readonly string[];
  coverage: "required" | "none" | null;
  dRefs: string[];
  embeds: string[];
  children: MutableSection[];
}

/** Draw one file's section tree (structure only; refs come later). */
function genSectionTree(
  choices: Choices,
  path: string,
): readonly MutableSection[] {
  const section = (id: string): MutableSection => ({
    identity: `${path}#${id}`,
    id,
    tags: choices.pick(TAG_SETS),
    coverage: choices.weightedPick<"required" | "none" | null>([
      [5, null],
      [2, "none"],
      [1, "required"],
    ]),
    dRefs: [],
    embeds: [],
    children: [],
  });
  const topCount = choices.weightedPick<number>([
    [1, 1],
    [3, 2],
    [3, 3],
  ]);
  const tops: MutableSection[] = [];
  for (let t = 0; t < topCount; t += 1) {
    const top = section(TOP_SEGMENTS[t]);
    const childCount = choices.weightedPick<number>([
      [4, 0],
      [3, 1],
      [2, 2],
    ]);
    for (let c = 0; c < childCount; c += 1) {
      const child = section(`${top.id}.${CHILD_SEGMENTS[c]}`);
      if (choices.boolean(0.3)) {
        child.children.push(section(`${child.id}.${GRAND_SEGMENT}`));
      }
      top.children.push(child);
    }
    tops.push(top);
  }
  return tops;
}

/** Post-order section list (children before parents; module header rank). */
function postOrder(sections: readonly MutableSection[]): MutableSection[] {
  const out: MutableSection[] = [];
  const visit = (section: MutableSection): void => {
    for (const child of section.children) visit(child);
    out.push(section);
  };
  for (const section of sections) visit(section);
  return out;
}

/** Document-order section list (parents before children). */
function docOrder<T extends { readonly children: readonly T[] }>(
  sections: readonly T[],
): T[] {
  const out: T[] = [];
  const visit = (section: T): void => {
    out.push(section);
    for (const child of section.children) visit(child);
  };
  for (const section of sections) visit(section);
  return out;
}

/** Draw up to `max` distinct targets from a non-empty menu. */
function drawTargets(
  choices: Choices,
  menu: readonly string[],
  countEntries: ReadonlyArray<readonly [number, number]>,
): string[] {
  const count = choices.weightedPick(countEntries);
  const targets: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const target = choices.pick(menu);
    if (!targets.includes(target)) targets.push(target);
  }
  return targets;
}

/** The P-13 trial generator (module header). */
export const genP13Trial: Gen<P13Trial> = (choices) => {
  // --- spec structure pass -------------------------------------------------
  const specFileCount = choices.weightedPick<number>([
    [2, 1],
    [4, 2],
    [3, 3],
  ]);
  const trees: (readonly MutableSection[])[] = [];
  for (let i = 0; i < specFileCount; i += 1) {
    trees.push(genSectionTree(choices, SPEC_PATHS[i]));
  }

  // --- rank-disciplined reference pass (module header) ---------------------
  const externalMenu: string[] = []; // all nodes of files before the current
  const specFiles: P13SpecFile[] = [];
  for (let i = 0; i < specFileCount; i += 1) {
    const ordered = postOrder(trees[i]);
    const seen: string[] = []; // same-file lower-rank identities
    for (const section of ordered) {
      const menu = [...seen, ...externalMenu];
      if (menu.length > 0) {
        section.dRefs = drawTargets(choices, menu, [
          [3, 0],
          [5, 1],
          [2, 2],
        ]);
        section.embeds = drawTargets(choices, menu, [
          [4, 0],
          [3, 1],
        ]);
      }
      seen.push(section.identity);
    }
    const rootMenu = [...seen, ...externalMenu];
    const rootEmbeds = drawTargets(choices, rootMenu, [
      [4, 0],
      [2, 1],
    ]);
    specFiles.push({
      index: i,
      path: SPEC_PATHS[i],
      rootEmbeds,
      sections: trees[i],
    });
    externalMenu.push(SPEC_PATHS[i], ...seen); // root + sections, now earlier
  }
  const allSpecNodes = [...externalMenu]; // every spec identity, root first

  // --- code files (targets unrestricted: code is never a target, 5.2) ------
  const codeFileCount = choices.weightedPick<number>([
    [2, 0],
    [3, 1],
    [2, 2],
  ]);
  const codeFiles: P13CodeFile[] = [];
  const statement = (): P13CodeStatement => ({
    kind: choices.pick(["marker", "text"] as const),
    target: choices.pick(allSpecNodes),
  });
  for (let i = 0; i < codeFileCount; i += 1) {
    const topLevel: P13CodeStatement[] = [];
    if (choices.boolean(0.4)) topLevel.push(statement());
    const unitCount = choices.intInclusive(1, 2);
    const units: { name: string; statements: P13CodeStatement[] }[] = [];
    for (let u = 0; u < unitCount; u += 1) {
      const statementCount = choices.intInclusive(1, 2);
      const statements: P13CodeStatement[] = [];
      for (let s = 0; s < statementCount; s += 1) statements.push(statement());
      units.push({ name: UNIT_NAMES[u], statements });
    }
    codeFiles.push({ index: i, path: CODE_PATHS[i], topLevel, units });
  }

  // --- groups (every file discovered: membership repair, module header) ----
  const drawGroups = (
    names: readonly string[],
    fileCount: number,
    countEntries: ReadonlyArray<readonly [number, number]>,
  ): (readonly [string, readonly number[]])[] => {
    const groupCount = choices.weightedPick(countEntries);
    const subsets = NONEMPTY_SUBSETS[fileCount - 1];
    const members: number[][] = [];
    for (let g = 0; g < groupCount; g += 1) {
      members.push([...choices.pick(subsets)]);
    }
    for (let file = 0; file < fileCount; file += 1) {
      if (!members.some((group) => group.includes(file))) {
        members[0].push(file); // repair: keep every file discovered
      }
    }
    return members.map((group, g) => [names[g], group.sort((a, b) => a - b)]);
  };
  const specGroups = drawGroups(SPEC_GROUP_NAMES, specFileCount, [
    [3, 1],
    [3, 2],
    [1, 3],
  ]);
  const codeGroups =
    codeFileCount === 0
      ? []
      : drawGroups(CODE_GROUP_NAMES, codeFileCount, [
          [3, 1],
          [1, 2],
        ]);

  // --- profiles ------------------------------------------------------------
  const specGroupNames = specGroups.map(([name]) => name);
  const allGroupNames = [
    ...specGroupNames,
    ...codeGroups.map(([name]) => name),
  ];
  const profileCount = choices.weightedPick<number>([
    [3, 1],
    [3, 2],
    [1, 3],
  ]);
  const profiles: P13Profile[] = [];
  for (let p = 0; p < profileCount; p += 1) {
    profiles.push({
      name: `p${String(p + 1)}`,
      target: choices.pick(specGroupNames),
      boundary: choices.pick(allGroupNames),
      mode: choices.weightedPick<"direct" | "transitive">([
        [2, "direct"],
        [3, "transitive"],
      ]),
      targets: choices.weightedPick<"leaves" | "all" | null>([
        [4, null],
        [1, "leaves"],
        [3, "all"],
      ]),
      targetTags: choices.boolean(0.35) ? choices.pick(TARGET_TAG_SETS) : null,
      edgeKinds: choices.boolean(0.35) ? choices.pick(KIND_SETS) : null,
    });
  }

  return { specFiles, codeFiles, specGroups, codeGroups, profiles };
};

// ---------------------------------------------------------------------------
// Rendering (module header: proven fixture staging discipline).

/** Module index of a target identity's file, or a plain modeling error. */
function specFileIndexOf(target: string): number {
  const hash = target.indexOf("#");
  const path = hash === -1 ? target : target.slice(0, hash);
  const index = SPEC_PATHS.indexOf(path as (typeof SPEC_PATHS)[number]);
  if (index === -1) {
    throw new Error(`P-13 model error: no spec file for target ${target}`);
  }
  return index;
}

/** The dotted ID of a target identity, or `null` for a root identity. */
function idOf(target: string): string | null {
  const hash = target.indexOf("#");
  return hash === -1 ? null : target.slice(hash + 1);
}

/** An MDX reference spelling (SPEC 2.2/2.3/2.4) for one target identity. */
function mdxRef(fileIndex: number, target: string): string {
  const id = idOf(target);
  if (specFileIndexOf(target) === fileIndex) {
    if (id === null) {
      throw new Error(
        `P-13 model error: a same-file reference cannot target the root ` +
          `(rank discipline forbids it): ${target}`,
      );
    }
    return JSON.stringify(id); // local string form
  }
  const binding = `M${String(specFileIndexOf(target))}`;
  return id === null ? binding : `${binding}.${id}`; // external chain form
}

/** A TypeScript chain spelling rooted at the module binding (SPEC 4.5). */
function tsChain(target: string): string {
  const binding = `M${String(specFileIndexOf(target))}`;
  const id = idOf(target);
  return id === null ? binding : `${binding}.${id}`;
}

function renderSectionLines(section: P13Section, fileIndex: number): string[] {
  const attrs = [`id="${section.id}"`];
  if (section.tags.length > 0) attrs.push(`tags="${section.tags.join(" ")}"`);
  if (section.coverage !== null) attrs.push(`coverage="${section.coverage}"`);
  if (section.dRefs.length === 1) {
    attrs.push(`d={${mdxRef(fileIndex, section.dRefs[0])}}`);
  } else if (section.dRefs.length > 1) {
    const refs = section.dRefs.map((target) => mdxRef(fileIndex, target));
    attrs.push(`d={[${refs.join(", ")}]}`);
  }
  const lines = [`<S ${attrs.join(" ")}>`, "body."];
  for (const target of section.embeds) {
    lines.push("", `{text(${mdxRef(fileIndex, target)})}`);
  }
  for (const child of section.children) {
    lines.push("", ...renderSectionLines(child, fileIndex));
  }
  lines.push("</S>");
  return lines;
}

function renderSpecFile(file: P13SpecFile): string {
  const blocks: string[][] = [];
  if (file.index > 0) {
    const imports: string[] = [];
    for (let j = 0; j < file.index; j += 1) {
      imports.push(`import M${String(j)} from "../${SPEC_XSPEC[j]}"`);
    }
    blocks.push(imports); // one ESM block; the join adds its blank line
  }
  for (const target of file.rootEmbeds) {
    blocks.push([`{text(${mdxRef(file.index, target)})}`]);
  }
  for (const section of file.sections) {
    blocks.push(renderSectionLines(section, file.index));
  }
  return `${blocks.map((block) => block.join("\n")).join("\n\n")}\n`;
}

function renderStatement(statement: P13CodeStatement): string {
  const chain = tsChain(statement.target);
  if (statement.kind === "marker") return `${chain};`;
  return `t${String(specFileIndexOf(statement.target))}(${chain});`;
}

function renderCodeFile(file: P13CodeFile, specFileCount: number): string {
  const lines: string[] = [];
  for (let j = 0; j < specFileCount; j += 1) {
    lines.push(
      `import M${String(j)}, { text as t${String(j)} } from "../${SPEC_XSPEC[j]}";`,
    );
  }
  lines.push("");
  for (const statement of file.topLevel) lines.push(renderStatement(statement));
  for (const unit of file.units) {
    lines.push("", `function ${unit.name}() {`);
    for (const statement of unit.statements) {
      lines.push(`  ${renderStatement(statement)}`);
    }
    lines.push("}");
  }
  return `${lines.join("\n")}\n`;
}

function renderConfig(trial: P13Trial): string {
  const groupLines = (
    groups: ReadonlyArray<readonly [string, readonly number[]]>,
    glob: (index: number) => string,
  ): string =>
    groups
      .map(
        ([name, members]) =>
          `    ${name}: [${members.map((index) => JSON.stringify(glob(index))).join(", ")}]`,
      )
      .join(",\n");
  const profileLines = trial.profiles
    .map((profile) => {
      const members = [
        `      name: ${JSON.stringify(profile.name)}`,
        `      target: ${JSON.stringify(profile.target)}`,
        `      boundary: ${JSON.stringify(profile.boundary)}`,
        `      mode: ${JSON.stringify(profile.mode)}`,
      ];
      if (profile.targets !== null) {
        members.push(`      targets: ${JSON.stringify(profile.targets)}`);
      }
      if (profile.targetTags !== null) {
        members.push(`      targetTags: ${JSON.stringify(profile.targetTags)}`);
      }
      if (profile.edgeKinds !== null) {
        members.push(`      edgeKinds: ${JSON.stringify(profile.edgeKinds)}`);
      }
      return `    {\n${members.join(",\n")}\n    }`;
    })
    .join(",\n");
  const codeBlock =
    trial.codeGroups.length === 0
      ? ""
      : `,\n  code: {\n${groupLines(trial.codeGroups, (index) => `c${String(index)}/**/*.ts`)}\n  }`;
  return `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
${groupLines(trial.specGroups, (index) => `s${String(index)}/**/*.mdx`)}
  }${codeBlock},
  coverage: [
${profileLines}
  ]
})
`;
}

/** Render the trial's whole staged file map (config + sources). */
export function renderP13Files(trial: P13Trial): Record<string, string> {
  const files: Record<string, string> = {
    "xspec.config.ts": renderConfig(trial),
  };
  for (const file of trial.specFiles) files[file.path] = renderSpecFile(file);
  for (const file of trial.codeFiles) {
    files[file.path] = renderCodeFile(file, trial.specFiles.length);
  }
  return files;
}

/** Counterexample rendering: profiles plus the staged sources, in full. */
export function renderP13Trial(trial: P13Trial): string {
  return JSON.stringify({
    profiles: trial.profiles,
    files: renderP13Files(trial),
  });
}

// ---------------------------------------------------------------------------
// The oracle bridge (module header: fed the generator's own model only).

interface TrialGraph {
  readonly nodes: ReadonlyMap<string, CoverageOracleNode>;
  readonly edges: readonly CoverageOracleEdge[];
  /** Group name → full node membership (roots included, SPEC 7.1/8.2). */
  readonly groupMembers: ReadonlyMap<string, readonly string[]>;
}

function trialGraph(trial: P13Trial): TrialGraph {
  const nodes = new Map<string, CoverageOracleNode>();
  const edges: CoverageOracleEdge[] = [];
  const specFileNodes: string[][] = [];
  for (const file of trial.specFiles) {
    const sections = docOrder(file.sections);
    nodes.set(file.path, {
      root: true,
      children: file.sections.map((section) => section.identity),
      coverage: null,
      tags: [],
    });
    for (const section of sections) {
      nodes.set(section.identity, {
        root: false,
        children: section.children.map((child) => child.identity),
        coverage: section.coverage,
        tags: section.tags,
      });
      for (const target of section.dRefs) {
        edges.push({ source: section.identity, target, kind: "depends" });
      }
      for (const target of section.embeds) {
        edges.push({ source: section.identity, target, kind: "embeds" });
      }
    }
    for (const target of file.rootEmbeds) {
      edges.push({ source: file.path, target, kind: "embeds" });
    }
    specFileNodes.push([
      file.path,
      ...sections.map((section) => section.identity),
    ]);
  }
  const codeFileNodes: string[][] = [];
  for (const file of trial.codeFiles) {
    const locations: string[] = [];
    const location = (identity: string): void => {
      locations.push(identity);
      nodes.set(identity, {
        root: false,
        children: [],
        coverage: null,
        tags: [],
      });
    };
    const record = (source: string, statement: P13CodeStatement): void => {
      edges.push({
        source,
        target: statement.target,
        kind: statement.kind === "marker" ? "references" : "embeds",
      });
    };
    if (file.topLevel.length > 0) {
      location(file.path); // the whole-file location sources edges (4.6)
      for (const statement of file.topLevel) record(file.path, statement);
    }
    for (const unit of file.units) {
      const identity = `${file.path}#${unit.name}`;
      location(identity);
      for (const statement of unit.statements) record(identity, statement);
    }
    codeFileNodes.push(locations);
  }
  const groupMembers = new Map<string, readonly string[]>();
  for (const [name, members] of trial.specGroups) {
    groupMembers.set(
      name,
      members.flatMap((index) => specFileNodes[index]),
    );
  }
  for (const [name, members] of trial.codeGroups) {
    groupMembers.set(
      name,
      members.flatMap((index) => codeFileNodes[index]),
    );
  }
  return { nodes, edges, groupMembers };
}

/** Per profile, the oracle input mirroring the staged configuration. */
export function p13OracleInputs(trial: P13Trial): ReadonlyArray<{
  readonly profile: P13Profile;
  readonly input: CoverageOracleInput;
}> {
  const graph = trialGraph(trial);
  const membersOf = (name: string): readonly string[] => {
    const members = graph.groupMembers.get(name);
    if (members === undefined) {
      throw new Error(`P-13 model error: profile names unknown group ${name}`);
    }
    return members;
  };
  return trial.profiles.map((profile) => ({
    profile,
    input: {
      nodes: graph.nodes,
      edges: graph.edges,
      targetGroup: membersOf(profile.target),
      boundaryGroup: membersOf(profile.boundary),
      profile: {
        mode: profile.mode,
        ...(profile.targets !== null ? { targets: profile.targets } : {}),
        ...(profile.targetTags !== null
          ? { targetTags: profile.targetTags }
          : {}),
        ...(profile.edgeKinds !== null ? { edgeKinds: profile.edgeKinds } : {}),
      },
    },
  }));
}

// ---------------------------------------------------------------------------
// The property body.

/** Byte-wise UTF-8 identity comparison (SPEC 12.0; oracle row order). */
function compareIdentityBytes(a: string, b: string): number {
  return Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

function describeProfile(profile: P13Profile): string {
  const parts = [
    `target=${profile.target}`,
    `boundary=${profile.boundary}`,
    `mode=${profile.mode}`,
  ];
  if (profile.targets !== null) parts.push(`targets=${profile.targets}`);
  if (profile.targetTags !== null) {
    parts.push(`targetTags=${profile.targetTags.join("|")}`);
  }
  if (profile.edgeKinds !== null) {
    parts.push(`edgeKinds=${profile.edgeKinds.join("|")}`);
  }
  return `${profile.name} (${parts.join(", ")})`;
}

/** One profile's decoded report must equal the oracle's result (8, 8.1, 8.2). */
function assertProfileMatchesOracle(
  actual: CoverageProfileReport,
  expected: CoverageOracleResult,
  context: string,
): void {
  assertSameJson(
    actual.counts,
    expected.counts,
    `${context}: the counts of required, covered, uncovered, and ignored ` +
      `nodes must equal the oracle's — required = the target group ` +
      `restricted per 8.1, covered/uncovered = its reachability split per ` +
      `8, ignored = the excluded target-group nodes (SPEC 8.1, 8.2)`,
  );
  assertSameJson(
    actual.covered
      .map((row) => ({ identity: row.identity, path: [...row.path] }))
      .sort((a, b) => compareIdentityBytes(a.identity, b.identity)),
    expected.covered,
    `${context}: the covered set with one shortest covering path per node — ` +
      `boundary node first, target last, one edge in direct mode and one or ` +
      `more in transitive, only the profile's edgeKinds, contains edges and ` +
      `root nodes never appearing, equal-length ties resolved to the least ` +
      `element-wise byte sequence (SPEC 8, 8.2, 12.0)`,
  );
  assertSameJson(
    [...actual.uncovered].sort(compareIdentityBytes),
    expected.uncovered,
    `${context}: the uncovered set — required nodes with no permitted path ` +
      `from a boundary node (boundary membership alone covers nothing) ` +
      `(SPEC 8, 8.1, 8.2)`,
  );
  assertSameJson(
    actual.ignored
      .map((row) => ({
        identity: row.identity,
        reasons: classifyIgnoredReasons(
          row.reasons,
          `${context} ignored ${row.identity}`,
        ),
      }))
      .sort((a, b) => compareIdentityBytes(a.identity, b.identity)),
    expected.ignored,
    `${context}: the ignored set — the target group's nodes excluded from ` +
      `the required set, each with all applicable exclusion reasons in the ` +
      `fixed order root node, coverage="none", non-leaf under targets: ` +
      `"leaves", lacking every targetTags tag (SPEC 8.1, 8.2)`,
  );
}

/** The P-13 property body for one generated trial (module header). */
async function runP13Trial(
  product: ProductBinding,
  trial: P13Trial,
): Promise<void> {
  const workspace = await TestWorkspace.create({
    files: renderP13Files(trial),
  });
  try {
    await buildOk(
      product,
      workspace,
      `P-13 \`xspec build\` — the generated workspace is valid by ` +
        `construction (rank-disciplined references, resolving targets, ` +
        `structural IDs, acyclic imports), so build must succeed`,
    );
    const label = "P-13 `xspec coverage --json`";
    const report = decodeCoverageReport(
      await runJson(product, workspace, ["coverage", "--json"], label),
      label,
    );
    assertSameJson(
      report.profiles.map((profile) => profile.name).sort(),
      trial.profiles.map((profile) => profile.name).sort(),
      `${label}: \`coverage\` runs all configured profiles by default, so ` +
        `the report carries exactly the configured profile names (SPEC 8.2)`,
    );
    for (const { profile, input } of p13OracleInputs(trial)) {
      const reported = report.profiles.find(
        (candidate) => candidate.name === profile.name,
      );
      if (reported === undefined) {
        // Unreachable after the name-set assertion; guard for diagnosis.
        fail(`${label}: profile ${profile.name} missing from the report`);
      }
      assertProfileMatchesOracle(
        reported,
        computeCoverage(input),
        `${label} profile ${describeProfile(profile)}`,
      );
    }
  } finally {
    await workspace.dispose();
  }
}

// ---------------------------------------------------------------------------
// The registered property test.

const P_13 = defineProductTest({
  id: "P-13",
  title:
    "property: on random workspaces (spec and code groups; depends, embeds, " +
    'and references edges; tags; coverage="none"; root-sourced and ' +
    "root-targeted edges) under random profiles (mode, targets, targetTags, " +
    "edgeKinds, spec and code boundaries), `coverage --json`'s required, " +
    "covered, uncovered, and ignored sets — the four counts, all applicable " +
    "exclusion reasons in the fixed order, and one shortest covering path " +
    "per covered node with the 12.0 element-wise byte tie-break — equal an " +
    "independent oracle implementing 8.1's required set and 8's " +
    "reachability over the generator's own graph model (SPEC 8, 8.1, 8.2, " +
    "7.4, 12.0; TEST-SPEC §16 P-13)",
  // Wall-clock hang guard only (H-10): 8 trials per seed over the 3 fixed
  // seeds (E-5), two product invocations per trial (build + coverage), with
  // the shrink budget sized against whole-trial re-execution cost.
  timeoutMs: 300_000,
  run: async (product) => {
    await checkProperty(
      "P-13 coverage oracle",
      genP13Trial,
      async (trial) => {
        await runP13Trial(product, trial);
      },
      { runs: 8, maxShrinkExecutions: 30, render: renderP13Trial },
    );
  },
});

/** TEST-SPEC §16 P-13 (PROP-11). */
export const section16P13Tests: readonly ProductTestEntry[] = [P_13];
