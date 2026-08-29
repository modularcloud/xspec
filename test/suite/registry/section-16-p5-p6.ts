// TEST-SPEC §16 P-5 (rename/move purity) and P-6 (baseline replay) — PROP-04.
//
// Two registered product-facing property tests (C-2 "one code path") over the
// PROP-03 workspace model (section-16-p4.ts): seeded, reproducible generators
// (helpers/property.ts, H-10; fixed seed set in CI, E-5) produce random valid
// workspaces, then drive `xspec rename`, the file and section forms of
// `xspec move`, staged edits, and scripted git commits (HARNESS-01: pinned,
// platform-independent commit metadata) against them.
//
//   * P-5 arm 1 — purity sequences. A random workspace, committed as a git
//     baseline, then 1–3 journaled operations drawn from `rename` (fresh
//     final segment, descendants re-prefixed) and file-form `move` (fresh
//     `specs/N<k>.mdx` destination), each followed by a commit. After every
//     operation: `query nodes` enumerates exactly the mapped identity set,
//     every node's four hashes are byte-identical to the previous sweep under
//     the operation's identity map (SPEC 6.2, 5.4), `check` exits 0 — all
//     references resolve and the journal replays (SPEC 12.2, the
//     operationalization of P-5's "all references still resolve") — and
//     `impact --base <c>` against every prior commit in the sequence reports
//     no requirement categories and no impacted code (SPEC 6.2, 6.3, 9).
//   * P-5 arm 2 — random section moves. One random section-form `move`: any
//     section subtree to a random valid target parent (its own parent, a
//     section of any file, a file root — same-file and cross-file — or a
//     freshly created target file), under a fresh ID, with the construct's
//     byte layout at both boundaries randomized (see "arm-2 boundary
//     staging" below). Staged tags/coverage/`d` travel with the subtree.
//     The impact report against the pre-move baseline must satisfy the
//     section-move category oracle (helpers/oracles/section-move.ts, vetted
//     by its S-6 suite before this arm trusts it): the `changed` set drawn
//     from exactly the origin parent, the target parent, and the moved
//     subtree's nodes — a moved node `changed` iff the straddling-line
//     drops of 6.2 change its runs, computed by the line-drop rules of 3
//     (every keep/drop decision delegated to P-2's markdown oracle) — a
//     created target file's root `changed` as an added node carrying no
//     other category, a coincident parent pure when the re-insertion
//     reproduces its sequence (a final child re-inserted at its own former
//     position, T6.2-4), `metadata-changed` on no node (SPEC 6.2), and
//     `descendant-changed`/`upstream-changed` exactly per 5.6's cascades
//     with per-category attribution bounds — anchored by T6.2-3/T6.2-4
//     (TEST-SPEC §16 P-5).
//   * P-6 — baseline replay. A random interleaving of staged edits (the
//     PROP-03 edit classes), `rename`, file-form `move`, and commits; then
//     `impact --base` against every historical baseline must equal the
//     oracle diff of the baseline-snapshot model against the current model,
//     with identities mapped through the journal suffix (SPEC 6.3) — the
//     harness composes the per-operation mappings it requested, which is
//     exactly the journal suffix a conforming product replays.
//
// Arm-2 boundary staging (the generalization past PROP-03's tag-alone-line
// discipline; TEST-SPEC §16 P-5 "random section moves"). The two files a
// move textually touches are staged from piece trees (the FP-083 oracle's
// input form) built to reproduce renderWorkspace byte-for-byte when
// undecorated — asserted every trial — and then decorated at the moved
// construct's boundaries. Every decorated byte form was vetted against
// remark-mdx by an implementation-time probe (staged sources must parse,
// SPEC 1; findings below), which pinned this validity rule: a multi-line
// element parses only fully flow (tags at line starts, at most trailing
// whitespace sharing a tag's line) or fully inline (the whole element
// inside one paragraph, non-whitespace forcers on BOTH sides — an element
// opened inline must also close inline, so SPEC 6.2's worked shape is
// staged with a balanced close such as `</S>ptail`). The staged layouts:
//   * flow — the PROP-03 form; any subtree (child sections, blanks,
//     comments, embeddings); clean boundaries, moved subtree keeps every
//     hash;
//   * inline — parent prose immediately before the opening tag
//     (`plead. <S …>`), moved-root text or whitespace-only residue after it
//     on the same line (the SPEC 6.2 worked straddling case), moved-root
//     text or residue before the closing tag, parent prose after it —
//     balanced combinations only; requires a childless subtree of
//     plain-text prose items (no embeddings, blanks, comments — an inline
//     element's interior must stay inside one paragraph), or an empty body
//     with parent prose on both sides;
//   * collapse — a single-prose-item section as one line (`<S …>text</S>`,
//     SPEC 3's in-line example): complete on its line, valid in every
//     context, optional parent prose on either side (with embeddings in the
//     prose, only the undecorated line-start form);
//   * self-closing — an empty moved section as `<S … />`, optional parent
//     prose on either side.
// The target side adds two forms: an empty target parent rendered
// self-closing (T6.5-2's rewrite exercised against the product) and, for an
// existing-file root target, the file's final line terminator stripped so
// the insertion point is mid-line (6.5's preceding-U+000A rule). Decoration
// bytes are owned by exactly the origin parent (outside the tags) and the
// moved root (inside them), and the construct's first and last body lines
// carry no other node's bytes, so no line whose keep/drop status the move
// flips holds a third node's bytes — the oracle's exactly-three-groups
// misuse guard enforces this, throwing a harness defect (H-8), never a
// diagnosed product failure. Embeddings keep the PROP-03 prose-flanked
// staging everywhere (never on a straddling or decorated line), so no
// line-drop decision ever consults an expansion's emptiness and the
// oracle's emptiness-stability contract holds trivially; expansion values
// are emptiness-faithful sentinels ("E"/"") from the model's expanded-text
// fixpoint — only emptiness enters the drop rule (SPEC 3), which never
// fires here. Import rewrites the move performs (additions as own lines,
// removals with their adjunct drops, 6.5) touch no node's runs, and
// reference respells never enter any hash (SPEC 5.4), so the oracle's
// derived after-side stays exact without modeling them.
//
// P-6's category oracle is the baseline graph-diff oracle
// (helpers/oracles/graph-diff.ts, vetted by its S-6 suite — SPEC 5.6's
// three worked examples plus T5.6-6's added/deleted convention — before
// this arm trusts it): per node, `changed` iff added or its own-content
// key changed; `metadata-changed` iff its `d`-target set, coverage, or tag
// set changed; `descendant-changed` iff a changed node lies among its
// strict descendants (either side); `upstream-changed` iff its effective
// state changed through a dependency-edge cause (SPEC 5.5's effectiveHash
// recursion, evaluated as a fixpoint). It is fed the harness's own model
// semantics (section-16-p4.ts `semanticsOf`), every identity mapped into
// the current workspace space, the JSON semantic keys standing in for the
// 5.5 hash preimages.
//
// Conservative operationalizations (noted per H-4):
// - "No change categories" is asserted as an empty `requirements` list — the
//   suite's fixed T1.5-1 interpretation (SPEC 9.3 groups output by category),
//   carried through SUITE-20/22; entry granularity is merged per node
//   identity (the SUITE-20 convention).
// - P-6 asserts category sets exactly per node with attributions within the
//   diff's originating-node set (SPEC 5.6: every category MUST be attributed
//   to its originating nodes), the empty list accepted — exact causal
//   attribution is pinned by the deterministic tests (SUITE-20/22). P-5's
//   section-move arm asserts the tighter per-category bounds its oracle
//   states: reported attributions lie within `attributionWithin` and include
//   `attributionMustInclude` (TEST-SPEC §16 P-5, "attributions included").
// - The two-sided ambiguity documented by T6.2-3 — a node whose one-side-only
//   subtree member carries the cause — is kept out of P-6's required diff:
//   its generator never lets a changed or metadata-changed node relocate
//   (the graph-diff oracle's relocated-originator misuse guard), stages no
//   section moves, never deletes nodes, and adds only dependency-free
//   sections (both guarded at the call site as harness defects — the oracle
//   itself handles deletions and edge-bearing additions per SPEC 5.6 and
//   its documented tolerance, but this generator stages neither). The one
//   residual case —
//   an ancestor holding a *relocated* dependency-bearing node on one side
//   only while that node's target changed effectively — makes
//   `upstream-changed` optional on exactly those ancestors, accepted present
//   or absent. P-5's section moves relocate whole subtrees by design; there
//   the section-move oracle predicts each category as required or
//   tolerated-optional per exactly that documented tolerance (its module
//   header), and the assertion honors the flag.
// - Every `impact` run follows a successful `build` (the SUITE-20/22
//   protocol); P-5's operations regenerate as `build` does (SPEC 6.4), so no
//   extra build is needed between operations.
// - P-6 applies a staged edit by rewriting the edited file from the model —
//   the file's body is byte-deterministic after journaled renames (SPEC 6.4:
//   minimal in-place edits, forms preserved; every generated segment is a
//   TypeScript identifier) and the import header is recomputed against the
//   files' current paths in the pinned 2.1 form (`./NAME.xspec`, one default
//   binding per line). Byte-exactness of the product's own rewrites is
//   T6.4-2/T6.5-*'s business, not P-6's: a deviating byte form would be
//   replaced by an equivalent-semantics staging here (import spellings and
//   reference spellings enter no hash, SPEC 5.4), never silently trusted.
// - Baselines are commits of the full working tree (sources, configuration,
//   the journal — 6.3 replays the journal content at the ref — and whatever
//   derived files exist; derived files match no spec group and are inert to
//   baseline reconstruction).
// - Identity reuse never occurs: fresh segments come from the model's
//   per-file counters and fresh file names from a trial counter, so the 9.3
//   deleted/added identity-collision edge case stays out of the input space
//   (it is deterministic-test material).
//
// P-5 and P-6 are outside every CERTIFICATIONS.md fixture scope (its
// preamble: conformers for P-4/P-5/P-6 would be near-complete second
// products), so these bodies bind only to the real product surface: `build`,
// `check`, `rename`, `move`, `query node`/`query nodes`, and
// `impact --base` (SPEC 6, 9, 11, 12), decoded through the H-3 adapters.

import type {
  ChangeCategory,
  ImpactReport,
  NodeHashes,
} from "../../helpers/adapters/index.js";
import {
  decodeNodeReport,
  decodeNodeRowsReport,
} from "../../helpers/adapters/index.js";
import { fail } from "../../helpers/assertions.js";
import type {
  GraphDiff,
  GraphDiffNode,
  GraphDiffSide,
} from "../../helpers/oracles/graph-diff.js";
import { computeGraphDiff } from "../../helpers/oracles/graph-diff.js";
import type {
  SectionMoveCategoryName,
  SectionMoveDocument,
  SectionMoveGraphNode,
  SectionMovePiece,
  SectionMovePrediction,
} from "../../helpers/oracles/section-move.js";
import {
  predictSectionMoveImpact,
  sectionMoveSourceText,
} from "../../helpers/oracles/section-move.js";
import type { Choices, Gen } from "../../helpers/property.js";
import { checkProperty } from "../../helpers/property.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type {
  BodyItem,
  Edit,
  EditClass,
  ProseItem,
  RefModel,
  SectionItem,
  WorkspaceModel,
} from "./section-16-p4.js";
import {
  applyEdit,
  genEditOfClass,
  genWorkspaceModel,
  refIdentity,
  renderOpenTag,
  renderRef,
  renderWorkspace,
  semanticsOf,
} from "./section-16-p4.js";
import { SPECS_ONLY_CONFIG, impactAgainst } from "./section-5.6.js";
import {
  assertSameJson,
  buildOk,
  expectExit,
  runJson,
  sortedIdentities,
} from "./support.js";

// ---------------------------------------------------------------------------
// Identity spaces and semantic maps
//
// Internally everything speaks the PROP-03 model space: file paths are the
// generator's `specs/A.mdx`… and dotted IDs are the model's current segments.
// Renames and section moves mutate the model's segments and references (the
// model always mirrors the workspace's current IDs); file moves mutate only
// the trial state's path table. Workspace identities — what the product's
// arguments and reports speak — are the model identities with the path table
// applied. Baseline-to-current mapping composes the per-operation segment
// maps (recorded in model-path space) and applies the current path table
// last, so no per-commit path bookkeeping is ever needed.

type IdentityFn = (identity: string) => string;

/** Semantic content of one node in model space (`semanticsOf`'s shape). */
interface NodeSemantics {
  readonly children: readonly string[];
  readonly ownTokens: string;
  readonly metaKey: string;
  readonly pairKey: string;
  readonly edgeTargets: readonly string[];
}

type SemanticsMap = ReadonlyMap<string, NodeSemantics>;

function composeIdentityMaps(
  maps: ReadonlyArray<Readonly<Record<string, string>>>,
): IdentityFn {
  return (identity) => {
    let current = identity;
    for (const map of maps) {
      current = map[current] ?? current;
    }
    return current;
  };
}

/**
 * Map every identity occurrence of a model semantics map — keys, child
 * lists, the reference tokens inside `ownTokens`, the `d`-target set inside
 * `metaKey`, the dependency-edge pair multiset `pairKey`, and `edgeTargets`
 * — through `fn`, re-sorting the sorted components (mapping is injective
 * over the staged spaces, so deduplicated sets stay deduplicated). The
 * result is one side of the graph-diff oracle's input: the mapped JSON
 * semantic keys stand in for the SPEC 5.5 hash preimages.
 */
function mapSemantics(sems: SemanticsMap, fn: IdentityFn): GraphDiffSide {
  const mapped = new Map<string, GraphDiffNode>();
  for (const [identity, sem] of sems) {
    const tokens = JSON.parse(sem.ownTokens) as [string, string][];
    const [deps, coverage, tags] = JSON.parse(sem.metaKey) as [
      string[],
      string,
      string[],
    ];
    const pairs = JSON.parse(sem.pairKey) as string[];
    mapped.set(fn(identity), {
      children: sem.children.map(fn),
      ownKey: JSON.stringify(
        tokens.map(([kind, value]) =>
          kind === "run" ? [kind, value] : [kind, fn(value)],
        ),
      ),
      metaKey: JSON.stringify([deps.map(fn).sort(), coverage, tags]),
      pairKey: JSON.stringify(pairs.map(fn).sort()),
      edgeTargets: sem.edgeTargets.map(fn).sort(),
    });
  }
  if (mapped.size !== sems.size) {
    throw new Error(
      "P-5/P-6 harness defect: an identity map collapsed two identities — " +
        "generated operations never reuse identities",
    );
  }
  return mapped;
}

// ---------------------------------------------------------------------------
// Impact-report-vs-oracle assertion (SPEC 5.6, 9.1, 9.3; SUITE-20 merging)

function assertImpactMatchesOracle(
  report: ImpactReport,
  oracle: GraphDiff,
  context: string,
): void {
  interface MergedNode {
    deleted: boolean;
    readonly categories: Map<ChangeCategory, string[]>;
  }
  const actual = new Map<string, MergedNode>();
  for (const entry of report.requirements) {
    for (const identity of entry.nodes) {
      if (!oracle.required.has(identity)) {
        fail(
          `${context}: the report names ${JSON.stringify(identity)}, which is ` +
            `no current node of the workspace (in the workspace-relative ` +
            `identity form of SPEC 1.5) — a pre-operation identity here means ` +
            `the product failed to unify identities through the journal ` +
            `suffix (SPEC 6.3, 9.2); entry: ${JSON.stringify(entry)}`,
        );
      }
      if (entry.deleted) {
        fail(
          `${context}: an entry names ${JSON.stringify(identity)} as deleted — ` +
            `this history deletes nothing: journaled operations map ` +
            `identities forward and staged edits only add (SPEC 6.2, 6.3, ` +
            `9.3); entry: ${JSON.stringify(entry)}`,
        );
      }
      let merged = actual.get(identity);
      if (merged === undefined) {
        merged = { deleted: false, categories: new Map() };
        actual.set(identity, merged);
      }
      for (const category of entry.categories) {
        const attributed = merged.categories.get(category.category) ?? [];
        attributed.push(...category.attributedTo);
        merged.categories.set(category.category, attributed);
      }
    }
  }

  for (const [identity, requiredSet] of oracle.required) {
    const merged = actual.get(identity);
    const actualNames = merged ? [...merged.categories.keys()] : [];
    const requiredNames = [...requiredSet].sort();
    if (requiredNames.length === 0 && !oracle.optionalUpstream.has(identity)) {
      if (merged !== undefined) {
        fail(
          `${context}: ${identity} must receive no category — its own ` +
            `content, metadata, subtree, and effective state are unchanged ` +
            `under the journal mapping (SPEC 5.6, 6.2, 6.3) — and so appear ` +
            `in no requirement entry (SPEC 9.3 groups output by category; ` +
            `the T1.5-1 convention), but the report names it with ` +
            `${JSON.stringify(actualNames.sort())}`,
        );
      }
      continue;
    }
    for (const name of requiredNames) {
      if (!actualNames.includes(name)) {
        fail(
          `${context}: ${identity} must carry ${name} — the oracle graph ` +
            `diff derives it from the staged history (SPEC 5.6, 9.1) — but ` +
            `the report gives it only ${JSON.stringify(actualNames.sort())}`,
        );
      }
    }
    for (const name of actualNames) {
      if (requiredSet.has(name)) continue;
      if (name === "upstream-changed" && oracle.optionalUpstream.has(identity))
        continue;
      fail(
        `${context}: ${identity} carries the category ${name}, which the ` +
          `oracle graph diff gives it no ground for — expected exactly ` +
          `${JSON.stringify(requiredNames)}` +
          `${oracle.optionalUpstream.has(identity) ? " (upstream-changed tolerated, module header)" : ""} ` +
          `(SPEC 5.6, 9.1)`,
      );
    }
    for (const [name, rawAttribution] of merged?.categories ?? []) {
      for (const attributed of new Set(rawAttribution)) {
        if (!oracle.originators.has(attributed)) {
          fail(
            `${context}: the ${name} category of ${identity} is attributed ` +
              `to ${JSON.stringify(attributed)}, which is no originating ` +
              `node of this diff — every category is attributed to its ` +
              `originating nodes, the nodes where edits occurred (SPEC 5.6); ` +
              `originators: ${JSON.stringify([...oracle.originators].sort())}`,
          );
        }
      }
    }
  }

  assertSameJson(
    report.code,
    { direct: [], transitive: [] },
    `${context}: no code groups are configured, so no code location is ` +
      `impacted (SPEC 9.2)`,
  );
}

/** Assert a pure history: no requirement entry at all, no impacted code. */
function assertEmptyImpact(report: ImpactReport, context: string): void {
  assertSameJson(
    report.requirements,
    [],
    `${context}: journaled rename/file-move operations are pure — every hash ` +
      `is unchanged and identities map through the journal, so no node ` +
      `receives any category and the requirements list is empty (SPEC 6.2, ` +
      `6.3, 9.1; the T1.5-1 convention)`,
  );
  assertSameJson(
    report.code,
    { direct: [], transitive: [] },
    `${context}: no code groups are configured, so no code location is ` +
      `impacted (SPEC 9.2)`,
  );
}

// ---------------------------------------------------------------------------
// Trial state, model walkers, and operation appliers

interface TrialState {
  /** The model, mutated to mirror the workspace's current IDs and refs. */
  model: WorkspaceModel;
  /** Model-space path per file index (`specs/A.mdx`…), fixed for the trial. */
  readonly modelPaths: readonly string[];
  /** Current workspace path per file index (file moves mutate this). */
  readonly paths: string[];
  /** Fresh-name counter for file-move destinations. */
  movedCounter: number;
}

function initTrialState(model: WorkspaceModel): TrialState {
  const cloned = structuredClone(model);
  const modelPaths = Object.keys(renderWorkspace(cloned));
  return {
    model: cloned,
    modelPaths,
    paths: [...modelPaths],
    movedCounter: 0,
  };
}

/** `specs/A.mdx` → `A` (the generator stages flat `specs/` paths only). */
function specBasename(path: string): string {
  const match = /^specs\/([^/]+)\.mdx$/.exec(path);
  if (match === null) {
    throw new Error(
      `P-5/P-6 harness defect: unexpected spec path ${JSON.stringify(path)}`,
    );
  }
  return match[1];
}

/** Workspace identity of a model identity under the current path table. */
function workspaceIdentityFn(state: TrialState): IdentityFn {
  const byModelPath = new Map<string, string>();
  state.modelPaths.forEach((modelPath, index) => {
    byModelPath.set(modelPath, state.paths[index]);
  });
  return (identity) => {
    const hash = identity.indexOf("#");
    const pathPart = hash === -1 ? identity : identity.slice(0, hash);
    const mappedPath = byModelPath.get(pathPart);
    if (mappedPath === undefined) {
      throw new Error(
        `P-5/P-6 harness defect: identity ${identity} names no model file`,
      );
    }
    return hash === -1 ? mappedPath : mappedPath + identity.slice(hash);
  };
}

interface SectionSite {
  readonly file: number;
  readonly dotted: string;
  readonly parentDotted: string;
  readonly section: SectionItem;
}

/** Every section of the model, document order, with its dotted context. */
function sectionsOf(model: WorkspaceModel): SectionSite[] {
  const sites: SectionSite[] = [];
  const walk = (
    items: readonly BodyItem[],
    file: number,
    parentDotted: string,
  ): void => {
    for (const item of items) {
      if (item.kind !== "section") continue;
      const dotted =
        parentDotted === "" ? item.seg : `${parentDotted}.${item.seg}`;
      sites.push({ file, dotted, parentDotted, section: item });
      walk(item.items, file, dotted);
    }
  };
  model.files.forEach((file, index) => {
    walk(file.items, index, "");
  });
  return sites;
}

/** Locate a section by its dotted ID: its container item list and index. */
function locateSection(
  model: WorkspaceModel,
  file: number,
  dotted: string,
): { readonly items: BodyItem[]; readonly index: number } {
  const segments = dotted.split(".");
  let items = model.files[file].items;
  for (let depth = 0; depth < segments.length; depth += 1) {
    const index = items.findIndex(
      (item) => item.kind === "section" && item.seg === segments[depth],
    );
    if (index === -1) {
      throw new Error(
        `P-5/P-6 harness defect: no section ${dotted} in file ${String(file)}`,
      );
    }
    if (depth === segments.length - 1) return { items, index };
    const item = items[index];
    if (item.kind !== "section") {
      throw new Error("unreachable: findIndex matched a section");
    }
    items = item.items;
  }
  throw new Error(`P-5/P-6 harness defect: empty dotted ID`);
}

/** All dotted IDs of a section subtree (itself first), document order. */
function subtreeDotteds(section: SectionItem, selfDotted: string): string[] {
  const out = [selfDotted];
  for (const item of section.items) {
    if (item.kind === "section") {
      out.push(...subtreeDotteds(item, `${selfDotted}.${item.seg}`));
    }
  }
  return out;
}

/** Visit every reference of the model with its host file (mutable refs). */
function forEachRef(
  model: WorkspaceModel,
  visit: (ref: RefModel, hostFile: number) => void,
): void {
  const walk = (items: readonly BodyItem[], hostFile: number): void => {
    for (const item of items) {
      if (item.kind === "prose") {
        for (const part of item.parts) {
          if (part.kind === "embed") visit(part.ref, hostFile);
        }
      } else if (item.kind === "section") {
        for (const ref of item.deps ?? []) visit(ref, hostFile);
        walk(item.items, hostFile);
      }
    }
  };
  model.files.forEach((file, index) => {
    walk(file.items, index);
  });
}

/** Prefix-rewrite: `old` or `old.<suffix>` → `new` + suffix, else null. */
function rewriteDotted(
  dotted: string,
  oldPrefix: string,
  newPrefix: string,
): string | null {
  if (dotted === oldPrefix) return newPrefix;
  if (dotted.startsWith(`${oldPrefix}.`)) {
    return newPrefix + dotted.slice(oldPrefix.length);
  }
  return null;
}

interface AppliedOp {
  readonly argv: readonly string[];
  /** Model-space identity map (empty for file moves). */
  readonly internalMap: Readonly<Record<string, string>>;
  /** Workspace-space identity map of this operation (for hash sweeps). */
  readonly wsMap: Readonly<Record<string, string>>;
  readonly description: string;
}

interface RenameOp {
  readonly kind: "rename";
  readonly file: number;
  readonly dotted: string;
  readonly newSeg: string;
}

interface MoveFileOp {
  readonly kind: "moveFile";
  readonly file: number;
  readonly newName: string;
}

type PureOp = RenameOp | MoveFileOp;

function applyRename(state: TrialState, op: RenameOp): AppliedOp {
  const located = locateSection(state.model, op.file, op.dotted);
  const section = located.items[located.index];
  if (section.kind !== "section") {
    throw new Error("unreachable: locateSection returns a section index");
  }
  const lastDot = op.dotted.lastIndexOf(".");
  const newDotted =
    lastDot === -1
      ? op.newSeg
      : `${op.dotted.slice(0, lastDot + 1)}${op.newSeg}`;
  const modelPath = state.modelPaths[op.file];
  const internalMap: Record<string, string> = {};
  for (const dotted of subtreeDotteds(section, op.dotted)) {
    const mapped = rewriteDotted(dotted, op.dotted, newDotted);
    if (mapped === null) {
      throw new Error("unreachable: subtree dotteds share the prefix");
    }
    internalMap[`${modelPath}#${dotted}`] = `${modelPath}#${mapped}`;
  }
  section.seg = op.newSeg;
  state.model.files[op.file].nextSeg += 1;
  forEachRef(state.model, (ref) => {
    if (ref.file !== op.file) return;
    const mapped = rewriteDotted(ref.dotted, op.dotted, newDotted);
    if (mapped !== null) ref.dotted = mapped;
  });
  const wsFn = workspaceIdentityFn(state);
  const wsMap: Record<string, string> = {};
  for (const [from, to] of Object.entries(internalMap)) {
    wsMap[wsFn(from)] = wsFn(to);
  }
  return {
    argv: ["rename", state.paths[op.file], op.dotted, newDotted],
    internalMap,
    wsMap,
    description: `rename ${state.paths[op.file]} ${op.dotted} -> ${newDotted}`,
  };
}

function applyMoveFile(state: TrialState, op: MoveFileOp): AppliedOp {
  const oldPath = state.paths[op.file];
  const newPath = `specs/${op.newName}.mdx`;
  const modelPath = state.modelPaths[op.file];
  const wsMap: Record<string, string> = { [oldPath]: newPath };
  const walkDotteds = (items: readonly BodyItem[], parent: string): void => {
    for (const item of items) {
      if (item.kind !== "section") continue;
      const dotted = parent === "" ? item.seg : `${parent}.${item.seg}`;
      wsMap[`${oldPath}#${dotted}`] = `${newPath}#${dotted}`;
      walkDotteds(item.items, dotted);
    }
  };
  walkDotteds(state.model.files[op.file].items, "");
  state.paths[op.file] = newPath;
  state.movedCounter += 1;
  return {
    argv: ["move", oldPath, newPath],
    internalMap: {},
    wsMap,
    description:
      `move file ${oldPath} -> ${newPath} (IDs unchanged, ` +
      `identities change only in their file part; ${modelPath} in model space)`,
  };
}

function applyPureOp(state: TrialState, op: PureOp): AppliedOp {
  return op.kind === "rename"
    ? applyRename(state, op)
    : applyMoveFile(state, op);
}

// ---------------------------------------------------------------------------
// Staged-edit application (P-6): rewrite edited files from the model
//
// The model mirrors the workspace's current IDs and reference targets, and
// every generated segment is a TypeScript identifier, so a file's body is
// byte-deterministic after journaled renames (SPEC 6.4). The import header
// is recomputed against the current path table in the pinned 2.1 form
// (module header, H-4).

function currentFileBytes(state: TrialState, fileIndex: number): string {
  const rendered = renderWorkspace(state.model)[state.modelPaths[fileIndex]];
  if (fileIndex === 0) return rendered;
  const lines = rendered.split("\n");
  const header: string[] = [];
  for (let j = 0; j < fileIndex; j += 1) {
    header.push(
      `import M${String(j)} from "./${specBasename(state.paths[j])}.xspec"`,
    );
  }
  header.push("");
  return [...header, ...lines.slice(fileIndex + 1)].join("\n");
}

/**
 * Apply one staged edit: mutate the model and rewrite the changed files in
 * the workspace at their current paths. Returns a description for contexts.
 */
async function applyEditStep(
  state: TrialState,
  workspace: TestWorkspace,
  edit: Edit,
): Promise<string> {
  const beforeFiles = renderWorkspace(state.model);
  const { after, description } = applyEdit(state.model, edit);
  state.model = after;
  const afterFiles = renderWorkspace(after);
  const changedIndexes = state.modelPaths.flatMap((modelPath, index) =>
    afterFiles[modelPath] !== beforeFiles[modelPath] ? [index] : [],
  );
  if (changedIndexes.length === 0) {
    throw new Error(
      `P-6 harness defect: the edit "${description}" staged no byte change`,
    );
  }
  for (const index of changedIndexes) {
    await workspace.file(state.paths[index], currentFileBytes(state, index));
  }
  return description;
}

// ---------------------------------------------------------------------------
// Product-query helpers (SPEC 11; H-3), per the SUITE-19/22 protocol

async function queryHashes(
  product: ProductBinding,
  workspace: TestWorkspace,
  identity: string,
  context: string,
): Promise<NodeHashes> {
  const label = `${context} \`query node ${identity}\``;
  return decodeNodeReport(
    await runJson(product, workspace, ["query", "node", identity], label),
    label,
  ).hashes;
}

async function assertIdentitySet(
  product: ProductBinding,
  workspace: TestWorkspace,
  expected: readonly string[],
  context: string,
): Promise<void> {
  const label = `${context} \`query nodes\``;
  const rows = decodeNodeRowsReport(
    await runJson(product, workspace, ["query", "nodes"], label),
    label,
  );
  assertSameJson(
    sortedIdentities(rows),
    [...expected].sort(),
    `${context}: the workspace's full node-identity set — a journaled ` +
      `operation maps every identity and neither adds nor deletes nodes ` +
      `(SPEC 1.5, 6.2, 11)`,
  );
}

async function sweepHashes(
  product: ProductBinding,
  workspace: TestWorkspace,
  identities: readonly string[],
  context: string,
): Promise<Map<string, NodeHashes>> {
  await assertIdentitySet(product, workspace, identities, context);
  const hashes = new Map<string, NodeHashes>();
  for (const identity of [...identities].sort()) {
    hashes.set(
      identity,
      await queryHashes(product, workspace, identity, context),
    );
  }
  return hashes;
}

// ---------------------------------------------------------------------------
// P-5 arm 1 — purity sequences

interface PurityTrial {
  readonly model: WorkspaceModel;
  readonly ops: readonly PureOp[];
}

const genPurityTrial: Gen<PurityTrial> = (choices) => {
  const model = genWorkspaceModel(choices);
  const state = initTrialState(model);
  const ops: PureOp[] = [];
  do {
    const sections = sectionsOf(state.model);
    const kind =
      sections.length === 0
        ? "moveFile"
        : choices.weightedPick<"moveFile" | "rename">([
            [2, "moveFile"],
            [3, "rename"],
          ]);
    let op: PureOp;
    if (kind === "rename") {
      const site = choices.pick(sections);
      op = {
        kind: "rename",
        file: site.file,
        dotted: site.dotted,
        newSeg: `s${String(state.model.files[site.file].nextSeg)}`,
      };
    } else {
      op = {
        kind: "moveFile",
        file: choices.intInclusive(0, state.model.files.length - 1),
        newName: `N${String(state.movedCounter)}`,
      };
    }
    applyPureOp(state, op);
    ops.push(op);
  } while (ops.length < 3 && choices.boolean(0.6));
  return { model, ops };
};

async function runPurityTrial(
  product: ProductBinding,
  trial: PurityTrial,
): Promise<void> {
  const state = initTrialState(trial.model);
  const workspace = await TestWorkspace.create({
    files: {
      "xspec.config.ts": SPECS_ONLY_CONFIG,
      ...renderWorkspace(state.model),
    },
  });
  try {
    await workspace.gitInit();
    const commits = [await workspace.gitCommitAll("baseline 0")];
    await buildOk(
      product,
      workspace,
      "P-5: `build` of the generated workspace (the generator stages only " +
        "valid workspaces)",
    );
    const wsFn = workspaceIdentityFn(state);
    let identities = [...semanticsOf(state.model).keys()].map(wsFn);
    let hashes = await sweepHashes(
      product,
      workspace,
      identities,
      "P-5 pre-operation sweep:",
    );

    for (const [index, op] of trial.ops.entries()) {
      const applied = applyPureOp(state, op);
      const context = `P-5 after operation ${String(index + 1)} — ${applied.description} —`;
      await expectExit(
        product,
        workspace,
        applied.argv,
        0,
        `P-5 operation ${String(index + 1)}: \`${applied.argv.join(" ")}\` on a valid workspace (SPEC 6.4, 6.5)`,
      );
      commits.push(
        await workspace.gitCommitAll(`after operation ${String(index + 1)}`),
      );
      await expectExit(
        product,
        workspace,
        ["check"],
        0,
        `${context} \`check\` must pass: all references resolve after the ` +
          `rewrite and the journal is well-formed and replayable (SPEC 6.4, ` +
          `6.5, 12.2 — P-5's "all references still resolve")`,
      );
      identities = identities.map(
        (identity) => applied.wsMap[identity] ?? identity,
      );
      const swept = await sweepHashes(product, workspace, identities, context);
      for (const [before, hash] of hashes) {
        const current = applied.wsMap[before] ?? before;
        assertSameJson(
          swept.get(current),
          hash,
          `${context} the operation is pure — every node's four hashes stay ` +
            `byte-identical, because child constructs and references hash ` +
            `by canonical identity (SPEC 5.4), which journaled operations ` +
            `preserve (SPEC 6.2, 5.5); the hashes of ${before}` +
            `${current === before ? "" : ` (now ${current})`} differ`,
        );
      }
      hashes = swept;
      for (let prior = 0; prior < commits.length - 1; prior += 1) {
        const label =
          `${context} \`impact --base <commit ${String(prior)}> --json\` — ` +
          `every prior commit in the sequence`;
        assertEmptyImpact(
          await impactAgainst(product, workspace, commits[prior], label),
          label,
        );
      }
    }
  } finally {
    await workspace.dispose();
  }
}

// ---------------------------------------------------------------------------
// P-5 arm 2 — random section moves (module header: arm-2 boundary staging)

/**
 * Byte layout staged around the moved construct (module header). JSON-safe;
 * `flow` is the undecorated PROP-03 form.
 */
interface MovedLayout {
  readonly form: "flow" | "inline" | "collapse" | "selfClose";
  /** Origin-parent prose immediately before the opening tag (same line). */
  readonly leadOutside: string | null;
  /** Moved-root bytes after the opening tag on its line (`inline` only). */
  readonly leadInside: string | null;
  /** Moved-root bytes before the closing tag on its line (`inline` only). */
  readonly tailInside: string | null;
  /** Origin-parent bytes immediately after the closing tag (same line). */
  readonly tailOutside: string | null;
}

const FLOW_LAYOUT: MovedLayout = {
  form: "flow",
  leadOutside: null,
  leadInside: null,
  tailInside: null,
  tailOutside: null,
};

// Fixed decoration bytes (deterministic staging, HARNESS-01): MDX-safe plain
// prose per the PROP-03 alphabet, whitespace residues two spaces (never four
// or more — line-start indentation must not open a Markdown code block).
const LEAD_OUTSIDE = "plead. ";
const LEAD_INSIDE = "k9 lead";
const TAIL_INSIDE = "k9 tail";
const TAIL_OUTSIDE = "ptail";
const WS_RESIDUE = "  ";

/**
 * Every inline combination the remark-mdx probe accepts (module header's
 * balance rule): a non-whitespace open-side forcer — parent lead before the
 * tag, or moved-root text after it — iff a non-whitespace close-side forcer;
 * whitespace residues force nothing and ride either side. Enumerated in a
 * fixed order, simplest first (shrinking).
 */
const INLINE_LAYOUTS: readonly MovedLayout[] = (() => {
  const layouts: MovedLayout[] = [];
  for (const leadOutside of [null, LEAD_OUTSIDE]) {
    for (const leadInside of [null, WS_RESIDUE, LEAD_INSIDE]) {
      for (const tailInside of [null, WS_RESIDUE, TAIL_INSIDE]) {
        for (const tailOutside of [null, WS_RESIDUE, TAIL_OUTSIDE]) {
          const openForced = leadOutside !== null || leadInside === LEAD_INSIDE;
          const closeForced =
            tailInside === TAIL_INSIDE || tailOutside === TAIL_OUTSIDE;
          if (openForced && closeForced) {
            layouts.push({
              form: "inline",
              leadOutside,
              leadInside,
              tailInside,
              tailOutside,
            });
          }
        }
      }
    }
  }
  return layouts;
})();

/**
 * The probed inline form for an empty moved section (`plead. <S …>` +
 * terminator + `</S>ptail`): parent prose on both sides, nothing inside.
 */
const EMPTY_INLINE_LAYOUT: MovedLayout = {
  form: "inline",
  leadOutside: LEAD_OUTSIDE,
  leadInside: null,
  tailInside: null,
  tailOutside: TAIL_OUTSIDE,
};

const OUTSIDE_LEADS: readonly (string | null)[] = [null, LEAD_OUTSIDE];
const OUTSIDE_TAILS: readonly (string | null)[] = [
  null,
  WS_RESIDUE,
  TAIL_OUTSIDE,
];

/** A prose item whose parts are all plain text (no embeddings). */
function isPlainProse(item: BodyItem): item is ProseItem {
  return item.kind === "prose" && item.parts.every((p) => p.kind === "text");
}

/**
 * One random byte layout valid for the moved section's shape (module
 * header): inline requires a childless all-plain-prose body (or an empty
 * one, in the probed both-sides form), collapse a single prose item.
 */
function genMovedLayout(choices: Choices, section: SectionItem): MovedLayout {
  const options: (readonly [number, () => MovedLayout])[] = [
    [4, () => FLOW_LAYOUT],
  ];
  if (section.items.length === 0) {
    options.push([
      3,
      () => ({
        form: "selfClose",
        leadOutside: choices.pick(OUTSIDE_LEADS),
        leadInside: null,
        tailInside: null,
        tailOutside: choices.pick(OUTSIDE_TAILS),
      }),
    ]);
    options.push([2, () => EMPTY_INLINE_LAYOUT]);
  } else {
    if (section.items.every(isPlainProse)) {
      options.push([10, () => choices.pick(INLINE_LAYOUTS)]);
    }
    if (section.items.length === 1 && section.items[0].kind === "prose") {
      const plain = isPlainProse(section.items[0]);
      options.push([
        3,
        () => ({
          form: "collapse",
          // Embeddings stay valid only in the undecorated line-start
          // collapse (module header / the probe).
          leadOutside: plain ? choices.pick(OUTSIDE_LEADS) : null,
          leadInside: null,
          tailInside: null,
          tailOutside: plain ? choices.pick(OUTSIDE_TAILS) : null,
        }),
      ]);
    }
  }
  return choices.weightedPick(options)();
}

interface SectionMoveTrial {
  readonly model: WorkspaceModel;
  readonly fromFile: number;
  /** Dotted ID of the moved section in the origin file. */
  readonly dotted: string;
  readonly target: MoveCandidate;
  readonly newSeg: string;
  readonly layout: MovedLayout;
  /** Render the (empty) target parent self-closing (T6.5-2's rewrite). */
  readonly selfCloseTargetParent: boolean;
  /** Strip the root-target file's final terminator (mid-line insertion). */
  readonly stripFinalNewline: boolean;
}

interface MoveCandidate {
  /** Existing target file index; null = the move creates the target file. */
  readonly toFile: number | null;
  /** Target parent's dotted ID; null = the target file's root. */
  readonly targetDotted: string | null;
}

/** The created-target path (`specs/**` keeps it in the spec group, 6.5). */
const CREATED_TARGET_PATH = "specs/N0.mdx";

/**
 * Valid target parents for moving `moved`, mirroring SPEC 6.5's refusals
 * over the staged space (module header): the target is not within the moved
 * subtree; no reference from the moved subtree names the target or one of
 * its ancestors, the destination root included (a dependency edge to a new
 * ancestor would be a 5.3 cycle); and the destination file lies within the
 * import-cycle-free window — every file referenced from the subtree at or
 * before it, every file referencing into the subtree at or after it (the
 * base import graph is the complete downward DAG, so any other destination
 * would need a forward import that closes a cycle). A created target file
 * (`createdOk`) sits strictly between the two: it must import every file
 * the subtree references while every file referencing into the subtree
 * imports it, so the window must be strict — max referenced-out index
 * strictly below min referencing-in index.
 */
function moveCandidates(
  model: WorkspaceModel,
  moved: SectionSite,
): { readonly candidates: MoveCandidate[]; readonly createdOk: boolean } {
  const movedKeys = new Set(
    subtreeDotteds(moved.section, moved.dotted).map(
      (dotted) => `${String(moved.file)}#${dotted}`,
    ),
  );
  const refKey = (ref: RefModel): string => `${String(ref.file)}#${ref.dotted}`;

  // Which references live inside the moved subtree? Host granularity is the
  // file; subtree membership is decided per reference by re-walking the
  // subtree's own items.
  const insideRefs = new Set<RefModel>();
  const collectInside = (items: readonly BodyItem[]): void => {
    for (const item of items) {
      if (item.kind === "prose") {
        for (const part of item.parts) {
          if (part.kind === "embed") insideRefs.add(part.ref);
        }
      } else if (item.kind === "section") {
        for (const ref of item.deps ?? []) insideRefs.add(ref);
        collectInside(item.items);
      }
    }
  };
  for (const ref of moved.section.deps ?? []) insideRefs.add(ref);
  collectInside(moved.section.items);

  const outFiles = new Set<number>();
  const inFiles = new Set<number>();
  const outTargets = new Set<string>();
  forEachRef(model, (ref, hostFile) => {
    const targetsMoved = movedKeys.has(refKey(ref));
    if (insideRefs.has(ref)) {
      if (!targetsMoved) {
        outFiles.add(ref.file);
        outTargets.add(refKey(ref));
      }
    } else if (targetsMoved) {
      inFiles.add(hostFile);
    }
  });
  const maxOut = outFiles.size > 0 ? Math.max(...outFiles) : -1;
  const minIn = inFiles.size > 0 ? Math.min(...inFiles) : model.files.length;

  const candidates: MoveCandidate[] = [];
  const consider = (
    toFile: number,
    targetDotted: string | null,
    ancestorKeys: readonly string[],
  ): void => {
    if (toFile < maxOut || toFile > minIn) return;
    if (
      targetDotted !== null &&
      movedKeys.has(`${String(toFile)}#${targetDotted}`)
    ) {
      return;
    }
    for (const key of ancestorKeys) {
      if (outTargets.has(key)) return;
    }
    candidates.push({ toFile, targetDotted });
  };
  model.files.forEach((_file, fileIndex) => {
    // The file root as target parent (top-level insertion): its ancestor set
    // is itself (external root references use the empty dotted part).
    consider(fileIndex, null, [`${String(fileIndex)}#`]);
  });
  for (const site of sectionsOf(model)) {
    const ancestorKeys = [`${String(site.file)}#`];
    const segments = site.dotted.split(".");
    for (let depth = 1; depth <= segments.length; depth += 1) {
      ancestorKeys.push(
        `${String(site.file)}#${segments.slice(0, depth).join(".")}`,
      );
    }
    consider(site.file, site.dotted, ancestorKeys);
  }
  return { candidates, createdOk: maxOut < minIn };
}

const genSectionMoveTrial: Gen<SectionMoveTrial> = (choices) => {
  let model = genWorkspaceModel(choices);
  if (sectionsOf(model).length === 0) {
    // Guarantee a movable subtree: add one prose-only section to file 0
    // (deterministic — no draws — so tape replay is unaffected).
    const rootIdentity = Object.keys(renderWorkspace(model))[0];
    model = applyEdit(model, {
      kind: "addChild",
      node: rootIdentity,
      at: model.files[0].items.length,
      text: "moved anchor body",
    }).after;
  }
  const sections = sectionsOf(model);
  // Bias toward subtree-bearing moves (descendant re-identification and the
  // richer cascades) when any exist; a plain pick underexercises them under
  // the fixed seeds. Shrinks toward the unbiased simple pick.
  const withChildren = sections.filter((site) =>
    site.section.items.some((item) => item.kind === "section"),
  );
  const moved =
    withChildren.length > 0 && choices.boolean(0.5)
      ? choices.pick(withChildren)
      : choices.pick(sections);
  const { candidates, createdOk } = moveCandidates(model, moved);
  if (candidates.length === 0) {
    // The moved section's own parent is always a valid target (same file,
    // ancestors unchanged), so an empty candidate list is a harness defect.
    throw new Error(
      `P-5 harness defect: no valid move target for ` +
        `${String(moved.file)}#${moved.dotted}`,
    );
  }
  // Target pick: sometimes a created target file (the created-root-as-added
  // arm) when the strict import window allows; sometimes the final child
  // re-inserted at its own former position (T6.2-4's purity, reached in the
  // random space — and confined to this branch: the ordinary pick excludes
  // the pure-reproducing own-parent target so no-op trials stay rare);
  // otherwise biased toward section parents (nesting under a section, the
  // deeper 6.5 insertion) over file roots, which dominate small models.
  const container = locateSection(model, moved.file, moved.dotted);
  const isFinalChild = container.index === container.items.length - 1;
  const ownParent: MoveCandidate = {
    toFile: moved.file,
    targetDotted: moved.parentDotted === "" ? null : moved.parentDotted,
  };
  let target: MoveCandidate;
  if (createdOk && choices.boolean(0.2)) {
    target = { toFile: null, targetDotted: null };
  } else if (isFinalChild && choices.boolean(0.2)) {
    target = ownParent;
  } else {
    const pool = isFinalChild
      ? candidates.filter(
          (candidate) =>
            candidate.toFile !== ownParent.toFile ||
            candidate.targetDotted !== ownParent.targetDotted,
        )
      : candidates;
    const effective = pool.length > 0 ? pool : candidates;
    const sectionTargets = effective.filter(
      (candidate) => candidate.targetDotted !== null,
    );
    target =
      sectionTargets.length > 0 && choices.boolean(0.65)
        ? choices.pick(sectionTargets)
        : choices.pick(effective);
  }
  const layout = genMovedLayout(choices, moved.section);
  let selfCloseTargetParent = false;
  if (target.toFile !== null && target.targetDotted !== null) {
    const located = locateSection(model, target.toFile, target.targetDotted);
    const parent = located.items[located.index];
    if (
      parent.kind === "section" &&
      parent.items.length === 0 &&
      choices.boolean(0.5)
    ) {
      selfCloseTargetParent = true;
    }
  }
  let stripFinalNewline = false;
  if (target.toFile !== null && target.targetDotted === null) {
    const rendered = renderWorkspace(model);
    const text = rendered[Object.keys(rendered)[target.toFile]];
    // Effective only when stripping actually leaves EOF mid-line: the last
    // line non-empty and singly terminated.
    const effective =
      text.endsWith("\n") &&
      text.length > 1 &&
      text[text.length - 2] !== "\n" &&
      text[text.length - 2] !== "\r";
    if (effective && choices.boolean(0.5)) stripFinalNewline = true;
  }
  return {
    model,
    fromFile: moved.file,
    dotted: moved.dotted,
    target,
    newSeg:
      target.toFile === null
        ? "s0"
        : `s${String(model.files[target.toFile].nextSeg)}`,
    layout,
    selfCloseTargetParent,
    stripFinalNewline,
  };
};

// --- piece-tree staging (the FP-083 oracle's input form) ---------------------

/**
 * Emptiness-faithful expansion sentinels (module header): "E" when the
 * identity's fully-expanded subtree text is non-empty, "" when empty. Only
 * emptiness enters any drop decision (the oracle's contract; SPEC 3), and
 * the prose-flanked embedding staging keeps even that from ever firing.
 */
function expansionSentinels(sems: SemanticsMap): (identity: string) => string {
  const memo = new Map<string, boolean>();
  const visiting = new Set<string>();
  const nonempty = (identity: string): boolean => {
    const cached = memo.get(identity);
    if (cached !== undefined) return cached;
    if (visiting.has(identity)) {
      throw new Error(
        `P-5 harness defect: contains/embeds cycle through ${identity} — ` +
          `staged graphs are acyclic by construction (SPEC 5.3)`,
      );
    }
    const sem = sems.get(identity);
    if (sem === undefined) {
      throw new Error(`P-5 harness defect: no semantics for ${identity}`);
    }
    visiting.add(identity);
    const tokens = JSON.parse(sem.ownTokens) as [string, string][];
    const result = tokens.some(([kind, value]) =>
      kind === "run" ? value !== "" : nonempty(value),
    );
    visiting.delete(identity);
    memo.set(identity, result);
    return result;
  };
  return (identity) => (nonempty(identity) ? "E" : "");
}

/** Decorations applied to one staged file (module header). */
interface FileDecorations {
  readonly moved?: { readonly dotted: string; readonly layout: MovedLayout };
  /** Dotted ID of an empty section to render self-closing. */
  readonly selfCloseDotted?: string;
  readonly stripFinalNewline?: boolean;
}

function stagingDefect(message: string): never {
  throw new Error(`P-5 harness defect: ${message}`);
}

/**
 * The file's piece tree: byte-identical to renderWorkspace's output when
 * `deco` is empty — locked by an equality assertion per trial — with the
 * arm-2 boundary decorations applied where staged (module header).
 */
function buildFilePieces(
  model: WorkspaceModel,
  fileIndex: number,
  modelPaths: readonly string[],
  expansionOf: (identity: string) => string,
  deco: FileDecorations,
): SectionMovePiece[] {
  const prosePieces = (
    item: ProseItem,
    withTerminator: boolean,
  ): SectionMovePiece[] => {
    const out: SectionMovePiece[] = [];
    for (const part of item.parts) {
      if (part.kind === "text") {
        out.push({ kind: "content", text: part.text });
      } else {
        const identity = refIdentity(part.ref);
        out.push({
          kind: "embedding",
          text: `{text(${renderRef(part.ref, fileIndex)})}`,
          expansion: expansionOf(identity),
          target: identity,
        });
      }
    }
    if (withTerminator) out.push({ kind: "content", text: "\n" });
    return out;
  };
  const newline: SectionMovePiece = { kind: "content", text: "\n" };
  const walk = (
    items: readonly BodyItem[],
    parentDotted: string,
  ): SectionMovePiece[] => {
    const out: SectionMovePiece[] = [];
    for (const item of items) {
      switch (item.kind) {
        case "blank":
          out.push(newline);
          break;
        case "comment":
          out.push({ kind: "removal", text: `{/* ${item.words} */}` });
          out.push(newline);
          break;
        case "prose":
          out.push(...prosePieces(item, true));
          break;
        case "section": {
          const dotted =
            parentDotted === "" ? item.seg : `${parentDotted}.${item.seg}`;
          const open = renderOpenTag(item, dotted, fileIndex);
          const selfClosed = `${open.slice(0, -1)} />`;
          const depends = (item.deps ?? []).map(refIdentity);
          const layout =
            deco.moved !== undefined && deco.moved.dotted === dotted
              ? deco.moved.layout
              : null;
          if (deco.selfCloseDotted === dotted) {
            if (item.items.length > 0 || layout !== null) {
              stagingDefect(
                `self-closing decoration on ${dotted}, which has body items ` +
                  `or is the moved section`,
              );
            }
            out.push({
              kind: "section",
              id: dotted,
              open: selfClosed,
              close: null,
              body: [],
              depends,
            });
            out.push(newline);
            break;
          }
          if (layout === null || layout.form === "flow") {
            out.push({
              kind: "section",
              id: dotted,
              open,
              close: "</S>",
              body: [newline, ...walk(item.items, dotted)],
              depends,
            });
            out.push(newline);
            break;
          }
          // A decorated moved construct (module header's staged forms).
          if (layout.leadOutside !== null) {
            out.push({ kind: "content", text: layout.leadOutside });
          }
          if (layout.form === "selfClose") {
            if (item.items.length > 0) {
              stagingDefect(`selfClose layout on non-empty ${dotted}`);
            }
            out.push({
              kind: "section",
              id: dotted,
              open: selfClosed,
              close: null,
              body: [],
              depends,
            });
          } else if (layout.form === "collapse") {
            const only = item.items[0];
            if (item.items.length !== 1 || only.kind !== "prose") {
              stagingDefect(
                `collapse layout on ${dotted} without exactly one prose item`,
              );
            }
            out.push({
              kind: "section",
              id: dotted,
              open,
              close: "</S>",
              body: prosePieces(only, false),
              depends,
            });
          } else {
            if (!item.items.every(isPlainProse)) {
              stagingDefect(
                `inline layout on ${dotted}, whose body is not all ` +
                  `plain-text prose (module header)`,
              );
            }
            const body: SectionMovePiece[] = [
              { kind: "content", text: `${layout.leadInside ?? ""}\n` },
              ...walk(item.items, dotted),
            ];
            if (layout.tailInside !== null) {
              body.push({ kind: "content", text: layout.tailInside });
            }
            out.push({
              kind: "section",
              id: dotted,
              open,
              close: "</S>",
              body,
              depends,
            });
          }
          if (layout.tailOutside !== null) {
            out.push({ kind: "content", text: layout.tailOutside });
          }
          out.push(newline);
          break;
        }
      }
    }
    return out;
  };

  const pieces: SectionMovePiece[] = [];
  for (let j = 0; j < fileIndex; j += 1) {
    pieces.push({
      kind: "removal",
      text: `import M${String(j)} from "./${specBasename(modelPaths[j])}.xspec"`,
    });
    pieces.push(newline);
  }
  // Mandatory blank line after the import block (PROP-03 module header).
  if (fileIndex > 0) pieces.push(newline);
  pieces.push(...walk(model.files[fileIndex].items, ""));
  if (deco.stripFinalNewline === true) {
    const last = pieces[pieces.length - 1];
    if (
      last === undefined ||
      last.kind !== "content" ||
      !last.text.endsWith("\n")
    ) {
      stagingDefect(
        "stripFinalNewline on a file not ending with a content terminator",
      );
    }
    const trimmed = last.text.slice(0, -1);
    if (trimmed === "") pieces.pop();
    else pieces[pieces.length - 1] = { kind: "content", text: trimmed };
  }
  return pieces;
}

interface BuiltSectionMove {
  readonly origin: SectionMoveDocument;
  readonly target: SectionMoveDocument | { readonly createdPath: string };
  /** The move's dotted new ID (SPEC 6.5). */
  readonly newId: string;
  readonly otherNodes: readonly SectionMoveGraphNode[];
  readonly argv: readonly string[];
  /** Every workspace file as staged (decorations applied). */
  readonly files: Record<string, string>;
  readonly description: string;
}

/**
 * Materialize a trial: piece trees for the involved files (decorated), the
 * untouched files' graph nodes, the staged bytes, and the move's argv. Pure
 * — identical trials build identical stagings (H-10) — and independent of
 * the product, so every staging defect (including the oracle's misuse
 * guards downstream) surfaces as a harness error, never a diagnosed
 * failure (H-8).
 */
function buildSectionMove(trial: SectionMoveTrial): BuiltSectionMove {
  const { model, target } = trial;
  const rendered = renderWorkspace(model);
  const modelPaths = Object.keys(rendered);
  const sems = semanticsOf(model);
  const expansionOf = expansionSentinels(sems);

  const originPath = modelPaths[trial.fromFile];
  const { toFile } = target;
  const coincident = toFile === trial.fromFile;
  const targetPath = toFile === null ? CREATED_TARGET_PATH : modelPaths[toFile];

  // Builder-vs-renderer byte lock (module header): the undecorated piece
  // tree reproduces renderWorkspace exactly for every involved file.
  const involvedIndexes = new Set<number>([trial.fromFile]);
  if (toFile !== null && !coincident) involvedIndexes.add(toFile);
  for (const fileIndex of involvedIndexes) {
    const undecorated = sectionMoveSourceText(
      buildFilePieces(model, fileIndex, modelPaths, expansionOf, {}),
    );
    if (undecorated !== rendered[modelPaths[fileIndex]]) {
      stagingDefect(
        `piece-tree builder diverges from renderWorkspace for ` +
          `${modelPaths[fileIndex]}`,
      );
    }
  }

  const targetSideDeco: FileDecorations = {
    ...(trial.selfCloseTargetParent && target.targetDotted !== null
      ? { selfCloseDotted: target.targetDotted }
      : {}),
    ...(trial.stripFinalNewline ? { stripFinalNewline: true } : {}),
  };
  const origin: SectionMoveDocument = {
    path: originPath,
    pieces: buildFilePieces(model, trial.fromFile, modelPaths, expansionOf, {
      moved: { dotted: trial.dotted, layout: trial.layout },
      ...(coincident ? targetSideDeco : {}),
    }),
  };
  const targetDocument: SectionMoveDocument | { createdPath: string } =
    toFile === null
      ? { createdPath: targetPath }
      : coincident
        ? origin
        : {
            path: targetPath,
            pieces: buildFilePieces(
              model,
              toFile,
              modelPaths,
              expansionOf,
              targetSideDeco,
            ),
          };

  const involvedPaths = new Set([originPath, targetPath]);
  const otherNodes: SectionMoveGraphNode[] = [];
  for (const [identity, sem] of sems) {
    const hash = identity.indexOf("#");
    const path = hash === -1 ? identity : identity.slice(0, hash);
    if (involvedPaths.has(path)) continue;
    otherNodes.push({
      identity,
      children: sem.children,
      edgeTargets: sem.edgeTargets,
    });
  }

  const newId =
    target.targetDotted === null
      ? trial.newSeg
      : `${target.targetDotted}.${trial.newSeg}`;
  const files: Record<string, string> = { ...rendered };
  files[originPath] = sectionMoveSourceText(origin.pieces);
  if ("pieces" in targetDocument && !coincident) {
    files[targetPath] = sectionMoveSourceText(targetDocument.pieces);
  }
  return {
    origin,
    target: targetDocument,
    newId,
    otherNodes,
    argv: ["move", `${originPath}#${trial.dotted}`, `${targetPath}#${newId}`],
    files,
    description:
      `move section ${originPath}#${trial.dotted} -> ${targetPath}#${newId} ` +
      `(${trial.layout.form} layout${toFile === null ? ", created target" : ""}` +
      `${trial.selfCloseTargetParent ? ", self-closing target parent" : ""}` +
      `${trial.stripFinalNewline ? ", terminator-less EOF" : ""})`,
  };
}

// --- prediction assertion (SPEC 6.2, 5.6, 9.1, 9.3; SUITE-20 merging) --------

function assertImpactMatchesPrediction(
  report: ImpactReport,
  prediction: SectionMovePrediction,
  context: string,
): void {
  const merged = new Map<string, Map<ChangeCategory, string[]>>();
  for (const entry of report.requirements) {
    for (const identity of entry.nodes) {
      if (!prediction.nodes.has(identity)) {
        fail(
          `${context}: the report names ${JSON.stringify(identity)}, which ` +
            `is no current node of the workspace (in the workspace-relative ` +
            `identity form of SPEC 1.5) — a pre-move identity here means the ` +
            `product failed to unify identities through the journaled ` +
            `mapping (SPEC 6.3, 6.5, 9.2); entry: ${JSON.stringify(entry)}`,
        );
      }
      if (entry.deleted) {
        fail(
          `${context}: an entry names ${JSON.stringify(identity)} as ` +
            `deleted — a section move deletes no node: every moved node is ` +
            `re-identified through the journaled mapping (SPEC 6.2, 6.5, ` +
            `9.3); entry: ${JSON.stringify(entry)}`,
        );
      }
      let categories = merged.get(identity);
      if (categories === undefined) {
        categories = new Map();
        merged.set(identity, categories);
      }
      for (const category of entry.categories) {
        const attributed = categories.get(category.category) ?? [];
        attributed.push(...category.attributedTo);
        categories.set(category.category, attributed);
      }
    }
  }

  for (const [identity, node] of prediction.nodes) {
    const reported =
      merged.get(identity) ?? new Map<ChangeCategory, string[]>();
    for (const name of reported.keys()) {
      if (name === "metadata-changed") {
        fail(
          `${context}: ${identity} is reported metadata-changed — a section ` +
            `move changes no node's metadataHash: every moved node keeps ` +
            `its own, and canonical identities preserve every other node's ` +
            `(SPEC 6.2; TEST-SPEC §16 P-5)`,
        );
      }
      if (!node.categories.has(name as SectionMoveCategoryName)) {
        fail(
          `${context}: ${identity} carries the category ${name}, which the ` +
            `section-move oracle gives it no ground for — expected within ` +
            `${JSON.stringify([...node.categories.keys()].sort())} ` +
            `(SPEC 6.2, 5.6, 9.1)`,
        );
      }
    }
    for (const [name, category] of node.categories) {
      const attribution = reported.get(name);
      if (attribution === undefined) {
        if (category.required) {
          fail(
            `${context}: ${identity} must carry ${name} — the section-move ` +
              `oracle derives it from the staged move (SPEC 6.2, 5.6, 9.1) ` +
              `— but the report gives it only ` +
              `${JSON.stringify([...reported.keys()].sort())}`,
          );
        }
        // Tolerated-optional (the T6.2-3 two-sided tolerance): absence is
        // accepted.
        continue;
      }
      const attributed = [...new Set(attribution)].sort();
      const within = new Set(category.attributionWithin);
      for (const source of attributed) {
        if (!within.has(source)) {
          fail(
            `${context}: the ${name} category of ${identity} is attributed ` +
              `to ${JSON.stringify(source)}, outside the oracle's ` +
              `originating-node bound ` +
              `${JSON.stringify([...category.attributionWithin])} — every ` +
              `category is attributed to its originating nodes, the nodes ` +
              `where edits occurred (SPEC 5.6)`,
          );
        }
      }
      const attributedSet = new Set(attributed);
      for (const source of category.attributionMustInclude) {
        if (!attributedSet.has(source)) {
          fail(
            `${context}: the ${name} category of ${identity} must be ` +
              `attributed to ${JSON.stringify(source)} — the originating ` +
              `node its cause traces to through both-sides members ` +
              `(SPEC 5.6: every category MUST be attributed to its ` +
              `originating nodes) — but the report attributes it to ` +
              `${JSON.stringify(attributed)}`,
          );
        }
      }
    }
  }

  assertSameJson(
    report.code,
    { direct: [], transitive: [] },
    `${context}: no code groups are configured, so no code location is ` +
      `impacted (SPEC 9.2)`,
  );
}

async function runSectionMoveTrial(
  product: ProductBinding,
  trial: SectionMoveTrial,
): Promise<void> {
  const built = buildSectionMove(trial);
  // The full prediction is computed before any product invocation: a
  // staging outside the oracle's input space throws here as a harness
  // defect (H-8), never a diagnosed product failure.
  const prediction = predictSectionMoveImpact({
    origin: built.origin,
    target: built.target,
    movedId: trial.dotted,
    newId: built.newId,
    otherNodes: built.otherNodes,
  });
  const workspace = await TestWorkspace.create({
    files: { "xspec.config.ts": SPECS_ONLY_CONFIG, ...built.files },
  });
  try {
    await workspace.gitInit();
    const base = await workspace.gitCommitAll("pre-move baseline");
    await buildOk(
      product,
      workspace,
      "P-5: `build` of the generated workspace (the generator stages only " +
        "valid workspaces; every decorated byte form parses — module header)",
    );
    const context = `P-5 section move — ${built.description} —`;
    await expectExit(
      product,
      workspace,
      built.argv,
      0,
      `P-5: \`${built.argv.join(" ")}\` satisfies every 6.5 validation over ` +
        `the staged space (module header), so the move must succeed`,
    );
    await expectExit(
      product,
      workspace,
      ["check"],
      0,
      `${context} \`check\` must pass: all rewritten references resolve and ` +
        `the journal replays (SPEC 6.5, 12.2)`,
    );
    const label = `${context} \`impact --base <pre-move ref> --json\``;
    assertImpactMatchesPrediction(
      await impactAgainst(product, workspace, base, label),
      prediction,
      `${label} — the report must match the section-move oracle's ` +
        `prediction: the changed set drawn from exactly the origin parent, ` +
        `the target parent, and the moved subtree's nodes (straddling-line ` +
        `drops computed by the line-drop rules of 3), a created target ` +
        `file's root changed as an added node, a coincident parent pure ` +
        `when re-insertion reproduces its sequence, metadata-changed on no ` +
        `node, and the 5.6 cascades with their attributions (TEST-SPEC §16 ` +
        `P-5; SPEC 6.2, 5.6)`,
    );
  } finally {
    await workspace.dispose();
  }
}

// ---------------------------------------------------------------------------
// P-6 — edit/rename/move/commit interleavings

type ReplayStep =
  | { readonly kind: "commit" }
  | { readonly kind: "edit"; readonly edit: Edit }
  | { readonly kind: "op"; readonly op: PureOp };

interface ReplayTrial {
  readonly model: WorkspaceModel;
  readonly steps: readonly ReplayStep[];
}

/** Edit classes safe for interleaved replay (module header: no deletions). */
const REPLAY_EDIT_CLASSES: readonly EditClass[] = [
  "content",
  "metadata",
  "dependency",
  "referencedText",
  "noop",
];

/** Deterministic MDX-safe prose pool for added sections (module header). */
const ADDED_SECTION_TEXT = [
  "added body alpha",
  "added body beta",
  "added body k9",
] as const;

function genReplayEdit(choices: Choices, model: WorkspaceModel): Edit {
  const shape = choices.weightedPick<EditClass | "addChild">([
    [3, "content"],
    [2, "metadata"],
    [2, "dependency"],
    [2, "referencedText"],
    [2, "noop"],
    [2, "addChild"],
  ]);
  if (shape !== "addChild") {
    return genEditOfClass(choices, model, shape);
  }
  // A dependency-free added section (module header): the P-4 addChild edit
  // adds exactly that — a fresh-segment section holding one prose line.
  const hosts: { readonly identity: string; readonly size: number }[] = [];
  const modelPaths = Object.keys(renderWorkspace(model));
  model.files.forEach((file, index) => {
    hosts.push({ identity: modelPaths[index], size: file.items.length });
  });
  for (const site of sectionsOf(model)) {
    hosts.push({
      identity: `${modelPaths[site.file]}#${site.dotted}`,
      size: site.section.items.length,
    });
  }
  const host = choices.pick(hosts);
  return {
    kind: "addChild",
    node: host.identity,
    at: choices.intInclusive(0, host.size),
    text: choices.pick(ADDED_SECTION_TEXT),
  };
}

const genReplayTrial: Gen<ReplayTrial> = (choices) => {
  const model = genWorkspaceModel(choices);
  const state = initTrialState(model);
  const steps: ReplayStep[] = [];
  do {
    const sections = sectionsOf(state.model);
    const kind = choices.weightedPick<
      "commit" | "edit" | "rename" | "moveFile"
    >([
      [2, "commit"],
      [4, "edit"],
      [2, "rename"],
      [1, "moveFile"],
    ]);
    if (kind === "commit") {
      steps.push({ kind: "commit" });
    } else if (kind === "edit") {
      const edit = genReplayEdit(choices, state.model);
      state.model = applyEdit(state.model, edit).after;
      steps.push({ kind: "edit", edit });
    } else if (kind === "rename" && sections.length > 0) {
      const site = choices.pick(sections);
      const op: PureOp = {
        kind: "rename",
        file: site.file,
        dotted: site.dotted,
        newSeg: `s${String(state.model.files[site.file].nextSeg)}`,
      };
      applyPureOp(state, op);
      steps.push({ kind: "op", op });
    } else {
      const op: PureOp = {
        kind: "moveFile",
        file: choices.intInclusive(0, state.model.files.length - 1),
        newName: `N${String(state.movedCounter)}`,
      };
      applyPureOp(state, op);
      steps.push({ kind: "op", op });
    }
  } while (steps.length < 6 && choices.boolean(0.8));
  return { model, steps };
};

async function runReplayTrial(
  product: ProductBinding,
  trial: ReplayTrial,
): Promise<void> {
  const state = initTrialState(trial.model);
  const workspace = await TestWorkspace.create({
    files: {
      "xspec.config.ts": SPECS_ONLY_CONFIG,
      ...renderWorkspace(state.model),
    },
  });
  try {
    await workspace.gitInit();
    interface Snapshot {
      readonly commit: string;
      readonly sems: SemanticsMap;
      /** Index into `internalMaps` from which later maps apply. */
      readonly mapsFrom: number;
      readonly label: string;
    }
    const internalMaps: Readonly<Record<string, string>>[] = [];
    const snapshots: Snapshot[] = [
      {
        commit: await workspace.gitCommitAll("baseline 0"),
        sems: semanticsOf(state.model),
        mapsFrom: 0,
        label: "baseline 0 (the initial commit)",
      },
    ];
    await buildOk(
      product,
      workspace,
      "P-6: `build` of the generated workspace (the generator stages only " +
        "valid workspaces)",
    );

    const history: string[] = [];
    for (const [index, step] of trial.steps.entries()) {
      if (step.kind === "commit") {
        snapshots.push({
          commit: await workspace.gitCommitAll(
            `baseline ${String(snapshots.length)}`,
          ),
          sems: semanticsOf(state.model),
          mapsFrom: internalMaps.length,
          label: `baseline ${String(snapshots.length)} (after: ${history.join("; ") || "nothing"})`,
        });
      } else if (step.kind === "edit") {
        history.push(await applyEditStep(state, workspace, step.edit));
      } else {
        const applied = applyPureOp(state, step.op);
        await expectExit(
          product,
          workspace,
          applied.argv,
          0,
          `P-6 step ${String(index + 1)}: \`${applied.argv.join(" ")}\` on a ` +
            `valid workspace (SPEC 6.4, 6.5)`,
        );
        internalMaps.push(applied.internalMap);
        history.push(applied.description);
      }
    }

    await buildOk(
      product,
      workspace,
      "P-6: final `build` before the impact runs (the SUITE-20/22 protocol)",
    );
    const wsFn = workspaceIdentityFn(state);
    const currentSems = mapSemantics(semanticsOf(state.model), wsFn);
    for (const snapshot of snapshots) {
      const mapped = mapSemantics(snapshot.sems, (identity) =>
        wsFn(
          composeIdentityMaps(internalMaps.slice(snapshot.mapsFrom))(identity),
        ),
      );
      const diff = computeGraphDiff(mapped, currentSems);
      // Input-space guards (module header, H-4): the oracle defines
      // deletions and edge-bearing additions, but this generator stages
      // neither — meeting one is a harness defect (H-8), never a diagnosed
      // product failure.
      if (diff.deleted.size > 0) {
        throw new Error(
          `P-6 harness defect: the generated history deleted node(s) ` +
            `${[...diff.deleted].sort().join(", ")} — deletions are outside ` +
            `PROP-04's input space (module header)`,
        );
      }
      for (const id of diff.added) {
        if ((currentSems.get(id)?.edgeTargets.length ?? 0) > 0) {
          throw new Error(
            `P-6 harness defect: added node ${id} carries dependency edges ` +
              `— added sections must be dependency-free (module header)`,
          );
        }
      }
      const label =
        `P-6 \`impact --base <${snapshot.label}> --json\` — full history: ` +
        `${history.join("; ") || "no steps"}`;
      assertImpactMatchesOracle(
        await impactAgainst(product, workspace, snapshot.commit, label),
        diff,
        `${label} — the report must equal the oracle graph diff of the two ` +
          `models with identities mapped through the journal suffix ` +
          `(SPEC 6.3, 5.6, 9.1)`,
      );
    }
  } finally {
    await workspace.dispose();
  }
}

// ---------------------------------------------------------------------------
// The registered property tests

function renderPurityTrial(trial: PurityTrial): string {
  return JSON.stringify({
    files: renderWorkspace(trial.model),
    ops: trial.ops,
  });
}

function renderSectionMoveTrial(trial: SectionMoveTrial): string {
  // The staged bytes (decorations applied) are what reproduces the trial;
  // buildSectionMove is pure. renderValue guards against a builder throw.
  const built = buildSectionMove(trial);
  return JSON.stringify({
    files: built.files,
    move: built.argv.slice(1).join(" -> "),
    layout: trial.layout,
    selfCloseTargetParent: trial.selfCloseTargetParent,
    stripFinalNewline: trial.stripFinalNewline,
  });
}

function renderReplayTrial(trial: ReplayTrial): string {
  return JSON.stringify({
    files: renderWorkspace(trial.model),
    steps: trial.steps,
  });
}

const P_5 = defineProductTest({
  id: "P-5",
  title:
    "property: random journaled rename/file-move sequences over random valid workspaces are " +
    "pure — after every operation each node's four hashes are byte-identical under the " +
    "operation's identity map, `check` passes (all references resolve, the journal replays), " +
    "and `impact --base` against every prior commit in the sequence reports no categories and " +
    "no impacted code; random section moves — boundary layouts randomized, same-file, " +
    "cross-file, and created-target-file — produce exactly the section-move oracle's " +
    "prediction: the changed set drawn from the origin parent, the target parent, and the " +
    "moved subtree via the straddling-line drop rules of 3, a created target root changed as " +
    "added, a coincident parent pure on exact re-insertion, metadata-changed on no node, and " +
    "the 5.6 cascades with their attributions (SPEC 3, 5.4-5.6, 6.1-6.5, 9, 12.2; TEST-SPEC " +
    "§16 P-5)",
  // Wall-clock hang guard only (H-10): three fixed seeds (E-5); per purity
  // trial up to 3 operations x (sweep of every node + impact against every
  // prior commit), 8 section-move trials per seed (each one build + move +
  // check + impact), plus the shrink budget on falsification.
  timeoutMs: 600_000,
  run: async (product) => {
    await checkProperty(
      "P-5 rename/file-move purity sequences",
      genPurityTrial,
      async (trial) => {
        await runPurityTrial(product, trial);
      },
      { runs: 3, maxShrinkExecutions: 60, render: renderPurityTrial },
    );
    await checkProperty(
      "P-5 random section moves",
      genSectionMoveTrial,
      async (trial) => {
        await runSectionMoveTrial(product, trial);
      },
      { runs: 8, maxShrinkExecutions: 80, render: renderSectionMoveTrial },
    );
  },
});

const P_6 = defineProductTest({
  id: "P-6",
  title:
    "property: over random interleavings of staged edits, journaled renames, journaled " +
    "file-form moves, and git commits, `impact --base` against each historical baseline " +
    "reports exactly the categories of an oracle diff of the two workspace graphs with " +
    "identities mapped through the journal suffix — per-node category sets exact, added nodes " +
    "`changed` only, attributions within the originating nodes, no impacted code " +
    "(SPEC 5.5, 5.6, 6.3, 6.4, 6.5, 9; TEST-SPEC §16 P-6)",
  // Wall-clock hang guard only (H-10): three fixed seeds (E-5), up to 6
  // steps and one impact run per historical baseline per trial, plus the
  // shrink budget on falsification.
  timeoutMs: 600_000,
  run: async (product) => {
    await checkProperty(
      "P-6 baseline replay",
      genReplayTrial,
      async (trial) => {
        await runReplayTrial(product, trial);
      },
      { runs: 4, maxShrinkExecutions: 60, render: renderReplayTrial },
    );
  },
});

/** TEST-SPEC §16 P-5 and P-6 (PROP-04). */
export const section16P5P6Tests: readonly ProductTestEntry[] = [P_5, P_6];
