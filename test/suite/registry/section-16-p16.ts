// TEST-SPEC §16 P-16 (path-blocks generation) — PROP-16.
//
// One registered product-facing property test (C-2 "one code path"): a
// seeded, reproducible generator (helpers/property.ts, H-10; fixed seed set
// in CI, E-5) draws a random valid workspace of spec and code sources,
// commits it as a git baseline, changes it by a random interleaving of edits
// and journaled operations, and runs `review create --base` against that
// baseline. The session, read back whole through `review export --json`,
// must hold exactly the items the path-blocks generation oracle
// (helpers/oracles/path-blocks.ts — an independent implementation of SPEC
// 10.5 over P-6's graph-diff oracle, vetted by its S-6 suite,
// test/self/s6-path-blocks-oracle.test.ts, before this property trusts it)
// derives from the two graphs the harness's own model describes, identities
// mapped through the journal suffix the harness's operations wrote
// (`assertP16Export`):
//
//   * the same kinds and scope nodes, in the item order of 10.5 — the
//     export's item sequence compared position by position;
//   * each item's scope set exactly, each scope node presented present or
//     absent as the oracle has it (10.4: a node deleted since the baseline
//     absent) — a subtree-coherence item's subtree read through the payload's
//     scope-node list (`requireScopeNodes`, its absence failing loudly, H-3),
//     every other kind's scope its scope node alone, which the payload's
//     `scope` presents (a scope-node list, where carried, holding it alone);
//   * each item's context exactly, and its origin exactly: every member the
//     oracle requires, and nothing but those and the members it tolerates
//     (the oracle's documented two-sided readings — what only a relocated
//     member, or an added or deleted member's own dependency edges, leads
//     to; its module header);
//   * each item's `blockedBy` as the set of the kinds and scope nodes of the
//     items it names, each named id required to be an item of the session;
//   * scope nodes compared as canonical identities (10.4) and presented under
//     their current identities: the oracle's are the baseline's mapped
//     forward through the journal suffix — each operation's mapping in turn,
//     as its journal entry records it, every node present when the
//     operation runs and none it no longer finds (6.6: the renamed or moved
//     section and its descendants, or the moved file's root and sections;
//     a node deleted earlier keeps the identity it had then) — and the
//     current graph's as they stand, so a match is a match of current
//     identities.
// `reason` (informational, 10.2) and the recorded hashes are not compared.
//
// The workspace (TEST-SPEC §16 P-16: random valid workspaces of spec and
// code sources). Spec sources are PROP-03's model (section-16-p4.ts):
// nested sections, `d` references in local and external form, `{text(...)}`
// embeddings — in root-level prose too, so a root sources an embedding —
// and `coverage` and `tags` attributes, with up to three further sections
// nested below existing ones (`deepened`: PROP-03 draws at most three
// sections per file, while a `parent-consistency` item needs a visited node
// two levels deep and a chain of them three), staged as P-5 stages them
// (`renderP5Workspace`: every spec source begun by an empty line, its import
// header naming every earlier file at its staged path, flat under `specs/`
// under basenames drawn from P-5's classes, `drawSpecBasename`). Code
// sources are `src/c<k>.ts` (the configuration's code group `src/**/*.ts`),
// each importing every spec module (`import S<j>, { text as t<j> } from
// "../specs/<name>.xspec";`, j the spec file's index) and holding markers
// (`S<j>.a.b;`, `S<j>;` for a root) and `text(...)` calls (`t<j>(S<j>.a);`)
// at top level — the whole-file location — and in function units
// (`function u<n>() { … }`, the location `src/c<k>.ts#u<n>`, SPEC 4.6), so
// code locations carry impact edges of both kinds (9.2: `references` and
// `embeds`).
//
// The interleaving (TEST-SPEC §16 P-16: P-6's random interleavings of edits,
// journaled renames, and journaled moves of both forms): one to six steps,
// each
//   * a spec edit (P-4's `Edit`, applied by `applyEdit`): own text replaced
//     (`editProse`), an embedding added, removed, retargeted, or exchanged
//     with another, a `d` reference added, removed, or retargeted, `coverage`
//     toggled, a tag added or removed (metadata edits), a section added
//     (`addChild`), two child sections reordered (`swapChildren`) — drawn
//     at a nested or a section's site more often than at a root's
//     (`pickSectionBiased`), since a root's or a top-level section's own
//     change leaves every change below it unvisited (10.5);
//   * a section deleted (`deleteSection`), every reference naming its
//     subtree from outside it removed with it — a `d` reference from its
//     array, an embedding from its prose line — and each code reference
//     naming one retargeted to the deleted section's parent;
//   * a code edit: a marker or `text(...)` call added, removed, or
//     retargeted, a unit added or removed, a code file added or deleted;
//   * a spec file added (a fresh file holding its first prose line and one or
//     two sections referencing earlier files) or deleted (the last one in
//     import order, which no spec source imports, each code reference naming
//     one of its nodes retargeted to the first file's root);
//   * a journaled `rename` (a fresh final segment, descendants re-prefixed —
//     P-6's), a journaled file-form `move` (a fresh basename), or a
//     journaled section-form `move` drawn under P-5's discipline: the moved
//     construct in P-5's flow layout (every staged section stands in it),
//     inserted as the target parent's last child under a fresh final segment
//     (6.5) — the moved section a nested one more often than not, its
//     target parent drawn among every file root and section outside the
//     moved subtree and a created target file, biased toward another parent
//     than the moved node's own and toward a section (TEST-SPEC: moves into
//     another parent, which leave the moved node's current parent other than
//     its baseline parent), each candidate admitted only where the workspace
//     the move leaves is valid (`moveProblem`), so every draw is a move the
//     product performs; and S-9's per-draw check judges each draw's would-be
//     texts — the files as 6.5's edits would leave them — through P-5's own
//     composer (`stagedSectionMoveSources`), a refused shape drawn surfacing
//     as a harness error with its seed, never as a product failure.
// Every step keeps the workspace valid by construction (the §16 preamble):
// a new reference names a node it cannot close a cycle through (`refPool`'s
// reachability test over the combined contains, depends, and embeds graph,
// SPEC 5.3), in its own file (a section, local form) or an earlier one
// (external form, the import header binding it — no import cycle, 2.1); a
// deletion takes every reference naming what it deletes with it; a code
// location holding references keeps at least one while it stands (below).
// The generator checks the model after every step (`p16ModelProblem`): a
// violation is a harness defect, thrown with its seed. At the fixed seeds the
// draws reach every step kind and every shape TEST-SPEC's P-16 entry lists —
// test/self/p16-fixed-seed-draws.test.ts pins them, with S-9's per-draw
// replay, before any product exists.
//
// Conservative operationalizations (noted per H-4):
// - The harness's model, not the product's rewrite, stands after every
//   journaled operation: once `rename` or `move` exits 0, the harness
//   re-stages every source from its model (the section-16 per-draw form).
//   The model mirrors the operation — identities re-prefixed, references
//   retargeted (their spellings the model's own; spellings enter no hash,
//   5.4), a moved section appended to its target parent, a created target
//   file appended to the import order — so the re-staging changes no node's
//   own content, metadata, or dependency edges against a conforming
//   product's rewrite: the moved construct's own-content runs travel
//   verbatim in the flow layout (6.2), import declarations, added or
//   removed, are dropped lines in every root's own content (3), and the
//   journal, which the harness never touches, carries the operation's
//   identity effect. Byte-exactness of the rewrites themselves is P-5's,
//   P-6's, and T6.4-*/T6.5-*'s subject; P-16's is the derivation over the
//   two graphs and the journal, so the final workspace is exactly the
//   model's rendering and both oracle sides are the model's.
// - A created target file is appended to the import order — it imports
//   every earlier file and no spec source imports it — so a section moves
//   into a created file only when no spec source outside the moved subtree
//   references into it (P-5's created-target window, its strict side
//   empty); code sources reference into it freely (a code file's added
//   import is the product's to place, 6.5's TypeScript offsets).
// - A code location's presence (9.2, 10.4) is left unambiguous: a unit and
//   a file's top-level code each keep at least one reference while they
//   stand (`removeRef` only where two or more remain, a deletion's code
//   references retargeted, never removed), so a location with impact edges
//   at the baseline is absent from the current graph exactly when its unit
//   or file is gone.
// - Identities are never reused (the oracle's input space: one identity
//   names one node on each side): segments come from each file's fresh
//   counter, every basename a trial stages or draws is never drawn again,
//   and code files and units take fresh names.
// - Every `review create` follows a successful `build`, as every `impact` in
//   P-6 does; the property runs one session per trial, named `p16`.
//
// P-16 is outside every CERTIFICATIONS.md fixture scope (its preamble: a
// conformer would need substantially the whole graph, identity, baseline,
// and review engine), so this body binds only to the real product surface:
// `build`, `rename`, `move`, `review create --base`, and `review export`,
// decoded through the H-3 adapters.

import { Buffer } from "node:buffer";
import * as fsp from "node:fs/promises";
import type { ExportReport, ReviewItem } from "../../helpers/adapters/index.js";
import {
  decodeExportReport,
  requireScopeNodes,
} from "../../helpers/adapters/index.js";
import { fail } from "../../helpers/assertions.js";
import { derivePathBlocks } from "../../helpers/oracles/path-blocks.js";
import type {
  PathBlocksCode,
  PathBlocksInput,
  PathBlocksNode,
  PathBlocksPrediction,
  PathBlocksSide,
} from "../../helpers/oracles/path-blocks.js";
import type { Choices, DrawSource, Gen } from "../../helpers/property.js";
import { checkProperty, listOf } from "../../helpers/property.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { stagedTs } from "../../helpers/staged-ts.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import type { WorkspaceDecl } from "../../helpers/workspace.js";
import {
  TestWorkspace,
  mdxPathsOf,
  tsPathsOf,
} from "../../helpers/workspace.js";
import type {
  BodyItem,
  Edit,
  FileModel,
  ProseItem,
  ProsePart,
  RefModel,
  SectionItem,
  WorkspaceModel,
} from "./section-16-p4.js";
import {
  TAG_POOL,
  applyEdit,
  genWorkspaceModel,
  proseText,
  refIdentity,
  semanticsOf,
} from "./section-16-p4.js";
import type { SectionMoveTrial, SectionSite } from "./section-16-p5-p6.js";
import {
  FLOW_LAYOUT,
  P5_WOULD_BE_LABEL_PREFIX,
  drawSpecBasename,
  drawSpecBasenames,
  locateSection,
  renderP5Workspace,
  rewriteDotted,
  sectionsOf,
  specPath,
  stagedSectionMoveSources,
  subtreeDotteds,
} from "./section-16-p5-p6.js";
import { buildOk, expectExit, runJson } from "./support.js";

// ---------------------------------------------------------------------------
// Configuration

/**
 * The configuration every trial stages (SPEC 7): the spec group P-4/P-5/P-6
 * stage and a code group over `src/` — a TypeScript staged-source record
 * (helpers/staged-ts.ts; S-9's TypeScript and timing clauses), well-formed:
 * every trial after the body's first stages it after that body's first
 * product invocation, an initial file S-7's sweep never reaches, so the
 * ledger self-test judges it before any product exists.
 */
const P16_CONFIG = stagedTs(
  "P-16 xspec.config.ts — one spec group, one code group",
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

/** The session every trial creates (SPEC 10.1: a valid session name). */
const P16_SESSION = "p16";

/**
 * Trials per seed, as the registration below draws them (three fixed seeds
 * in CI, E-5) and as P-16's draw guard replays them
 * (test/self/p16-fixed-seed-draws.test.ts).
 */
export const P16_RUNS = 6;

/** The most steps one trial's interleaving draws. */
const MAX_STEPS = 6;

// ---------------------------------------------------------------------------
// The model

/**
 * One code reference (SPEC 4.5, 4.3): a marker — a bare chain as an
 * expression statement — or a `text(...)` call, naming a spec node by its
 * file's index in the spec model and its dotted ID (`""` names the root).
 * Retargeted in place by the journaled operations' rewrites.
 */
export interface P16CodeRef {
  readonly kind: "marker" | "text";
  file: number;
  dotted: string;
}

/** A function unit (SPEC 4.6): the code location `<path>#<name>`. */
export interface P16CodeUnit {
  readonly name: string;
  refs: P16CodeRef[];
}

/**
 * A code source `src/<name>.ts`: its top-level references — the whole-file
 * location's — and its function units; `nextUnit` the fresh-name counter.
 */
export interface P16CodeFile {
  readonly name: string;
  top: P16CodeRef[];
  units: P16CodeUnit[];
  nextUnit: number;
}

/** A trial's baseline workspace: JSON-safe (counterexamples render it). */
export interface P16Initial {
  readonly spec: WorkspaceModel;
  /** Drawn basename per spec file index: its staged `specs/<name>.mdx`. */
  readonly basenames: readonly string[];
  readonly code: readonly P16CodeFile[];
}

/** One code edit (module header, "the interleaving"). */
export type P16CodeEdit =
  | {
      readonly kind: "addRef";
      readonly file: number;
      /** The unit's index; null for the file's top-level code. */
      readonly unit: number | null;
      readonly ref: P16CodeRef;
    }
  | {
      readonly kind: "removeRef";
      readonly file: number;
      readonly unit: number | null;
      readonly index: number;
    }
  | {
      readonly kind: "retargetRef";
      readonly file: number;
      readonly unit: number | null;
      readonly index: number;
      readonly target: { readonly file: number; readonly dotted: string };
    }
  | {
      readonly kind: "addUnit";
      readonly file: number;
      readonly refs: readonly P16CodeRef[];
    }
  | {
      readonly kind: "removeUnit";
      readonly file: number;
      readonly unit: number;
    }
  | {
      readonly kind: "addFile";
      readonly top: readonly P16CodeRef[];
      readonly units: readonly (readonly P16CodeRef[])[];
    }
  | { readonly kind: "deleteFile"; readonly file: number };

/** One step of a trial's interleaving (module header). JSON-safe. */
export type P16Step =
  | { readonly kind: "specEdit"; readonly edit: Edit }
  | { readonly kind: "codeEdit"; readonly edit: P16CodeEdit }
  | {
      readonly kind: "addSpecFile";
      readonly file: FileModel;
      readonly basename: string;
    }
  | { readonly kind: "deleteSpecFile" }
  | {
      readonly kind: "deleteSection";
      readonly file: number;
      readonly dotted: string;
    }
  | {
      readonly kind: "rename";
      readonly file: number;
      readonly dotted: string;
      readonly newSeg: string;
    }
  | {
      readonly kind: "moveFile";
      readonly file: number;
      readonly basename: string;
    }
  | {
      readonly kind: "moveSection";
      readonly fromFile: number;
      readonly dotted: string;
      /** The target file's index; null when the move creates it. */
      readonly toFile: number | null;
      /** The target parent's dotted ID; null for the target file's root. */
      readonly targetDotted: string | null;
      /** The created target file's drawn basename; null otherwise. */
      readonly createdBasename: string | null;
    };

/** A drawn trial: the baseline workspace and the interleaving after it. */
export interface P16Trial {
  readonly initial: P16Initial;
  readonly steps: readonly P16Step[];
}

/**
 * The evolving state the generator draws against and the body replays —
 * one function evolves both (`applyP16Step`), so the staged bytes and the
 * oracle's two sides always describe the same workspaces.
 */
interface P16State {
  spec: WorkspaceModel;
  /** The staged basename of each spec file index: `specs/<name>.mdx`. */
  basenames: string[];
  /** Every basename the trial has staged or drawn (never drawn again). */
  taken: string[];
  code: P16CodeFile[];
  nextCode: number;
}

function defect(message: string): never {
  throw new Error(`P-16 harness defect: ${message}`);
}

function initState(initial: P16Initial): P16State {
  if (initial.basenames.length !== initial.spec.files.length) {
    defect(
      `${String(initial.basenames.length)} basenames for ` +
        `${String(initial.spec.files.length)} spec files`,
    );
  }
  return {
    spec: structuredClone(initial.spec),
    basenames: [...initial.basenames],
    taken: [...initial.basenames],
    code: structuredClone(initial.code) as P16CodeFile[],
    nextCode: initial.code.length,
  };
}

/** The staged path of spec file `file`. */
function specPathAt(state: P16State, file: number): string {
  const basename = state.basenames[file] as string | undefined;
  if (basename === undefined) defect(`no spec file at index ${String(file)}`);
  return specPath(basename);
}

/** A code source's staged path. */
function codePathOf(file: P16CodeFile): string {
  return `src/${file.name}.ts`;
}

/** A spec node's identity as the workspace stages it (SPEC 1.5). */
function stagedIdentity(state: P16State, file: number, dotted: string): string {
  return `${specPathAt(state, file)}${dotted === "" ? "" : `#${dotted}`}`;
}

/**
 * A description PROP-03's edit code wrote in model space (`specs/A.mdx#s0`),
 * every model path replaced by the path its file stands at in the state.
 */
function stagedText(state: P16State, text: string): string {
  const staged = new Map<string, string>();
  state.basenames.forEach((_basename, file) => {
    staged.set(modelIdentity(file, ""), specPathAt(state, file));
  });
  return text.replace(/specs\/[A-P]\.mdx/g, (path) => staged.get(path) ?? path);
}

// ---------------------------------------------------------------------------
// Rendering (model → staged bytes)

/** The default binding of spec file `file`'s module in a code source. */
function codeBinding(file: number): string {
  return `S${String(file)}`;
}

/** The `text` binding of spec file `file`'s module in a code source. */
function textBinding(file: number): string {
  return `t${String(file)}`;
}

/** A code reference's statement, without its terminator (SPEC 4.5, 4.3). */
function renderCodeRef(ref: P16CodeRef): string {
  const chain =
    ref.dotted === ""
      ? codeBinding(ref.file)
      : `${codeBinding(ref.file)}.${ref.dotted}`;
  return ref.kind === "marker" ? chain : `${textBinding(ref.file)}(${chain})`;
}

/**
 * A code source's bytes (module header): one import of every spec module,
 * named by the spec files' staged basenames in index order, then its
 * top-level references, then its function units — LF-terminated lines,
 * every statement `;`-terminated.
 */
export function renderP16CodeFile(
  file: P16CodeFile,
  specBasenames: readonly string[],
): string {
  const lines = specBasenames.map(
    (basename, index) =>
      `import ${codeBinding(index)}, { text as ${textBinding(index)} } ` +
      `from "../specs/${basename}.xspec";`,
  );
  lines.push("");
  for (const ref of file.top) lines.push(`${renderCodeRef(ref)};`);
  for (const unit of file.units) {
    lines.push("", `function ${unit.name}() {`);
    for (const ref of unit.refs) lines.push(`  ${renderCodeRef(ref)};`);
    lines.push("}");
  }
  return `${lines.join("\n")}\n`;
}

/** Every source the state stages: spec sources, then code sources. */
function renderP16Sources(state: P16State): Record<string, string> {
  const files = renderP5Workspace(state.spec, state.basenames.map(specPath));
  for (const file of state.code) {
    files[codePathOf(file)] = renderP16CodeFile(file, state.basenames);
  }
  return files;
}

// ---------------------------------------------------------------------------
// Model walks

/** A node of the spec model with its edit-site context. */
interface P16Node {
  /** Model-space identity (PROP-03's `specs/A.mdx#s0`). */
  readonly identity: string;
  readonly file: number;
  /** The dotted ID; `""` for a root. */
  readonly dotted: string;
  /** The node's own body items (the file's items for a root). */
  readonly items: BodyItem[];
  readonly section: SectionItem | null;
}

function modelIdentity(file: number, dotted: string): string {
  return refIdentity({ file, dotted, spell: 0 });
}

/** Every node, roots and sections, files in index order, document order. */
function p16Nodes(spec: WorkspaceModel): P16Node[] {
  const nodes: P16Node[] = [];
  const walk = (
    items: BodyItem[],
    file: number,
    parentDotted: string,
  ): void => {
    for (const item of items) {
      if (item.kind !== "section") continue;
      const dotted =
        parentDotted === "" ? item.seg : `${parentDotted}.${item.seg}`;
      nodes.push({
        identity: modelIdentity(file, dotted),
        file,
        dotted,
        items: item.items,
        section: item,
      });
      walk(item.items, file, dotted);
    }
  };
  spec.files.forEach((model, file) => {
    nodes.push({
      identity: modelIdentity(file, ""),
      file,
      dotted: "",
      items: model.items,
      section: null,
    });
    walk(model.items, file, "");
  });
  return nodes;
}

/** A spec reference with the node whose `d` prop or prose holds it. */
interface HostedRef {
  readonly ref: RefModel;
  /** The host node's model identity. */
  readonly host: string;
  readonly hostFile: number;
}

/** Every spec reference of the model — the live objects — with its host. */
function hostedRefs(spec: WorkspaceModel): HostedRef[] {
  const out: HostedRef[] = [];
  for (const node of p16Nodes(spec)) {
    for (const ref of node.section?.deps ?? []) {
      out.push({ ref, host: node.identity, hostFile: node.file });
    }
    for (const item of node.items) {
      if (item.kind !== "prose") continue;
      for (const part of item.parts) {
        if (part.kind === "embed") {
          out.push({ ref: part.ref, host: node.identity, hostFile: node.file });
        }
      }
    }
  }
  return out;
}

/** Every code reference of the state — the live objects. */
function allCodeRefs(code: readonly P16CodeFile[]): P16CodeRef[] {
  return code.flatMap((file) => [
    ...file.top,
    ...file.units.flatMap((unit) => unit.refs),
  ]);
}

/**
 * Reachability over the combined graph of contains, depends, and embeds
 * edges (SPEC 5.3), memoized per start node: every node reachable from it,
 * itself included. The staged graphs are acyclic by construction.
 */
function reachabilityOf(
  spec: WorkspaceModel,
): (identity: string) => ReadonlySet<string> {
  const sems = semanticsOf(spec);
  const memo = new Map<string, Set<string>>();
  const visiting = new Set<string>();
  const reach = (identity: string): Set<string> => {
    const cached = memo.get(identity);
    if (cached !== undefined) return cached;
    if (visiting.has(identity)) defect(`a cycle through ${identity}`);
    const sem = sems.get(identity);
    if (sem === undefined) defect(`no semantics for ${identity}`);
    visiting.add(identity);
    const found = new Set<string>([identity]);
    for (const next of [...sem.children, ...sem.edgeTargets]) {
      for (const member of reach(next)) found.add(member);
    }
    visiting.delete(identity);
    memo.set(identity, found);
    return found;
  };
  return reach;
}

/**
 * The nodes a new reference held by `host` may name (module header): a
 * section of the host's own file (local form) or any node of an earlier
 * file (external form, its root included — the import header binds every
 * earlier file), never the host itself and never a node the host is
 * reachable from, which the new edge would close a cycle through (5.3).
 */
function refPool(
  nodes: readonly P16Node[],
  reach: (identity: string) => ReadonlySet<string>,
  host: P16Node,
): P16Node[] {
  return nodes.filter(
    (node) =>
      (node.file < host.file ||
        (node.file === host.file && node.section !== null)) &&
      node.identity !== host.identity &&
      !reach(node.identity).has(host.identity),
  );
}

/**
 * Why the state is not a valid workspace, or null (module header): every
 * spec reference resolving, naming a node of its own file — a section — or
 * of an earlier file; the combined graph acyclic; every code reference
 * resolving; every unit holding a reference; one basename per spec file,
 * no two alike.
 */
function p16ModelProblem(state: P16State): string | null {
  const { spec } = state;
  if (state.basenames.length !== spec.files.length) {
    return `${String(state.basenames.length)} basenames for ${String(spec.files.length)} spec files`;
  }
  if (spec.files.length === 0) return "no spec file";
  if (new Set(state.basenames).size !== state.basenames.length) {
    return "two spec files share a path";
  }
  const nodes = p16Nodes(spec);
  const identities = new Set(nodes.map((node) => node.identity));
  for (const { ref, host, hostFile } of hostedRefs(spec)) {
    const target = modelIdentity(ref.file, ref.dotted);
    if (!identities.has(target)) {
      return `${host}'s reference to ${target} does not resolve`;
    }
    if (ref.file > hostFile) {
      return `${host} references ${target}, a later file (an import cycle)`;
    }
    if (ref.file === hostFile && ref.dotted === "") {
      return `${host} references its own file's root (no local form, 2.2)`;
    }
  }
  const sems = semanticsOf(spec);
  const state0 = new Map<string, "open" | "done">();
  const cycleFrom = (identity: string): string | null => {
    const mark = state0.get(identity);
    if (mark === "done") return null;
    if (mark === "open") return identity;
    state0.set(identity, "open");
    const sem = sems.get(identity);
    if (sem === undefined) return `${identity} has no semantics`;
    for (const next of [...sem.children, ...sem.edgeTargets]) {
      const found = cycleFrom(next);
      if (found !== null) return found;
    }
    state0.set(identity, "done");
    return null;
  };
  for (const identity of sems.keys()) {
    const found = cycleFrom(identity);
    if (found !== null) return `a dependency cycle through ${found} (5.3)`;
  }
  for (const file of state.code) {
    for (const unit of file.units) {
      if (unit.refs.length === 0) {
        return `${codePathOf(file)}#${unit.name} holds no reference`;
      }
    }
  }
  for (const ref of allCodeRefs(state.code)) {
    const target = modelIdentity(ref.file, ref.dotted);
    if (!identities.has(target)) {
      return `a code reference to ${target} does not resolve`;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Applying a step (pure over the state; the generator and the body share it)

/** What one step did: its description and, for a journaled operation, its command. */
interface AppliedStep {
  readonly description: string;
  /** The product command a journaled operation runs; null for an edit. */
  readonly argv: readonly string[] | null;
  /**
   * The identity mapping a journaled operation produces (SPEC 6.1, 6.6):
   * one entry per node whose identity it changes — each node present when
   * it runs, a node deleted earlier having none — workspace identities at
   * the time, as its journal entry records them; empty for an edit.
   */
  readonly journalMap: Readonly<Record<string, string>>;
}

const NO_MAP: Readonly<Record<string, string>> = {};

/**
 * Retarget every reference — spec and code — naming `fromPrefix` or a
 * descendant of it in file `fromFile` to the same node under `toPrefix` in
 * file `toFile` (a rename's or a section move's rewrite, 6.4, 6.5).
 */
function retargetReferences(
  state: P16State,
  fromFile: number,
  fromPrefix: string,
  toFile: number,
  toPrefix: string,
): void {
  const refs: { file: number; dotted: string }[] = [
    ...hostedRefs(state.spec).map((hosted) => hosted.ref),
    ...allCodeRefs(state.code),
  ];
  for (const ref of refs) {
    if (ref.file !== fromFile) continue;
    const mapped = rewriteDotted(ref.dotted, fromPrefix, toPrefix);
    if (mapped === null) continue;
    ref.file = toFile;
    ref.dotted = mapped;
  }
}

function sectionAt(
  spec: WorkspaceModel,
  file: number,
  dotted: string,
): SectionItem {
  const located = locateSection(spec, file, dotted);
  const item = located.items[located.index];
  if (item.kind !== "section") defect(`${dotted} is no section`);
  return item;
}

function applyRenameStep(
  state: P16State,
  step: Extract<P16Step, { kind: "rename" }>,
): AppliedStep {
  const section = sectionAt(state.spec, step.file, step.dotted);
  const lastDot = step.dotted.lastIndexOf(".");
  const newDotted =
    lastDot === -1
      ? step.newSeg
      : `${step.dotted.slice(0, lastDot + 1)}${step.newSeg}`;
  const path = specPathAt(state, step.file);
  const journalMap: Record<string, string> = {};
  for (const dotted of subtreeDotteds(section, step.dotted)) {
    const mapped = rewriteDotted(dotted, step.dotted, newDotted);
    if (mapped === null) defect("a subtree ID outside its own prefix");
    journalMap[`${path}#${dotted}`] = `${path}#${mapped}`;
  }
  section.seg = step.newSeg;
  state.spec.files[step.file].nextSeg += 1;
  retargetReferences(state, step.file, step.dotted, step.file, newDotted);
  return {
    description: `rename ${path} ${step.dotted} -> ${newDotted}`,
    argv: ["rename", path, step.dotted, newDotted],
    journalMap,
  };
}

function applyMoveFileStep(
  state: P16State,
  step: Extract<P16Step, { kind: "moveFile" }>,
): AppliedStep {
  if (state.taken.includes(step.basename)) {
    defect(`the file-move destination basename ${step.basename} is taken`);
  }
  const oldPath = specPathAt(state, step.file);
  const newPath = specPath(step.basename);
  // The root and every section of the moved file (6.6), as they stand.
  const journalMap: Record<string, string> = { [oldPath]: newPath };
  for (const node of p16Nodes(state.spec)) {
    if (node.file !== step.file || node.dotted === "") continue;
    journalMap[`${oldPath}#${node.dotted}`] = `${newPath}#${node.dotted}`;
  }
  state.basenames[step.file] = step.basename;
  state.taken.push(step.basename);
  return {
    description: `move file ${oldPath} -> ${newPath}`,
    argv: ["move", oldPath, newPath],
    journalMap,
  };
}

function applyMoveSectionStep(
  state: P16State,
  step: Extract<P16Step, { kind: "moveSection" }>,
): AppliedStep {
  const fromPath = specPathAt(state, step.fromFile);
  const located = locateSection(state.spec, step.fromFile, step.dotted);
  const moved = located.items[located.index];
  if (moved.kind !== "section") defect(`${step.dotted} is no section`);
  const oldDotteds = subtreeDotteds(moved, step.dotted);
  let toFile: number;
  if (step.toFile === null) {
    if (step.createdBasename === null) defect("a created target unnamed");
    if (state.taken.includes(step.createdBasename)) {
      defect(`the created target basename ${step.createdBasename} is taken`);
    }
    toFile = state.spec.files.length;
    state.basenames.push(step.createdBasename);
    state.taken.push(step.createdBasename);
    state.spec.files.push({ items: [], nextSeg: 0 });
  } else {
    if (step.createdBasename !== null) {
      defect("a created-target basename for an existing target file");
    }
    toFile = step.toFile;
  }
  if (
    step.targetDotted !== null &&
    toFile === step.fromFile &&
    rewriteDotted(step.targetDotted, step.dotted, step.dotted) !== null
  ) {
    defect(
      `the target parent ${step.targetDotted} lies within the moved ` +
        `subtree ${step.dotted}`,
    );
  }
  const toPath = specPathAt(state, toFile);
  const target = state.spec.files[toFile];
  const newSeg = `s${String(target.nextSeg)}`;
  target.nextSeg += 1;
  const newDotted =
    step.targetDotted === null ? newSeg : `${step.targetDotted}.${newSeg}`;
  // 6.5: deleted at the origin, inserted as the target parent's last child.
  located.items.splice(located.index, 1);
  const targetItems =
    step.targetDotted === null
      ? target.items
      : sectionAt(state.spec, toFile, step.targetDotted).items;
  moved.seg = newSeg;
  targetItems.push(moved);
  retargetReferences(state, step.fromFile, step.dotted, toFile, newDotted);
  const journalMap: Record<string, string> = {};
  for (const dotted of oldDotteds) {
    const mapped = rewriteDotted(dotted, step.dotted, newDotted);
    if (mapped === null) defect("a subtree ID outside its own prefix");
    journalMap[`${fromPath}#${dotted}`] = `${toPath}#${mapped}`;
  }
  return {
    description:
      `move section ${fromPath}#${step.dotted} -> ${toPath}#${newDotted}` +
      `${step.toFile === null ? " (created target file)" : ""}`,
    argv: ["move", `${fromPath}#${step.dotted}`, `${toPath}#${newDotted}`],
    journalMap,
  };
}

/**
 * Delete a section subtree (module header): every reference naming a node
 * of it from outside it goes too — a `d` reference removed from its array,
 * an embedding removed from its prose line, the runs around it joined (as
 * P-4's `removeEmbed`) — and each code reference naming one is retargeted
 * to the subtree's parent, so every code location keeps its reference count.
 */
function applyDeleteSectionStep(
  state: P16State,
  step: Extract<P16Step, { kind: "deleteSection" }>,
): AppliedStep {
  const located = locateSection(state.spec, step.file, step.dotted);
  const section = located.items[located.index];
  if (section.kind !== "section") defect(`${step.dotted} is no section`);
  const inside = new Set(
    subtreeDotteds(section, step.dotted).map((dotted) =>
      modelIdentity(step.file, dotted),
    ),
  );
  const names = (ref: { file: number; dotted: string }): boolean =>
    inside.has(modelIdentity(ref.file, ref.dotted));
  let referrers = 0;
  for (const node of p16Nodes(state.spec)) {
    if (inside.has(node.identity)) continue;
    const deps = node.section?.deps;
    if (node.section !== null && deps !== null && deps !== undefined) {
      const kept = deps.filter((ref) => !names(ref));
      referrers += deps.length - kept.length;
      node.section.deps = kept;
    }
    for (const item of node.items) {
      if (
        item.kind !== "prose" ||
        !item.parts.some((part) => part.kind === "embed" && names(part.ref))
      ) {
        continue;
      }
      const parts: ProsePart[] = [];
      let joinNext = false;
      for (const part of item.parts) {
        if (part.kind === "embed" && names(part.ref)) {
          referrers += 1;
          joinNext = true;
          continue;
        }
        const previous = parts[parts.length - 1] as ProsePart | undefined;
        if (part.kind === "text" && joinNext && previous?.kind === "text") {
          previous.text += part.text;
        } else {
          parts.push(part);
        }
        joinNext = false;
      }
      item.parts = parts;
    }
  }
  const lastDot = step.dotted.lastIndexOf(".");
  const parentDotted = lastDot === -1 ? "" : step.dotted.slice(0, lastDot);
  let retargeted = 0;
  for (const ref of allCodeRefs(state.code)) {
    if (!names(ref)) continue;
    ref.dotted = parentDotted;
    retargeted += 1;
  }
  located.items.splice(located.index, 1);
  const parent = stagedIdentity(state, step.file, parentDotted);
  return {
    description:
      `delete the section ${stagedIdentity(state, step.file, step.dotted)}` +
      `${referrers > 0 ? ` and the ${String(referrers)} reference(s) naming its subtree from outside it` : ""}` +
      `${retargeted > 0 ? `, ${String(retargeted)} code reference(s) retargeted to ${parent}` : ""}`,
    argv: null,
    journalMap: NO_MAP,
  };
}

function codeLocationRefs(
  state: P16State,
  file: number,
  unit: number | null,
): P16CodeRef[] {
  const code = state.code[file] as P16CodeFile | undefined;
  if (code === undefined) defect(`no code file at index ${String(file)}`);
  if (unit === null) return code.top;
  const found = code.units[unit] as P16CodeUnit | undefined;
  if (found === undefined) defect(`no unit ${String(unit)} in ${code.name}`);
  return found.refs;
}

function codeLocationName(
  state: P16State,
  file: number,
  unit: number | null,
): string {
  const code = state.code[file];
  return unit === null
    ? codePathOf(code)
    : `${codePathOf(code)}#${code.units[unit].name}`;
}

function describeCodeRef(state: P16State, ref: P16CodeRef): string {
  return `${ref.kind === "marker" ? "a marker of" : "a text() call on"} ${stagedIdentity(state, ref.file, ref.dotted)}`;
}

function applyCodeEdit(state: P16State, edit: P16CodeEdit): AppliedStep {
  const done = (description: string): AppliedStep => ({
    description,
    argv: null,
    journalMap: NO_MAP,
  });
  switch (edit.kind) {
    case "addRef": {
      codeLocationRefs(state, edit.file, edit.unit).push({ ...edit.ref });
      return done(
        `add ${describeCodeRef(state, edit.ref)} to ${codeLocationName(state, edit.file, edit.unit)}`,
      );
    }
    case "removeRef": {
      const refs = codeLocationRefs(state, edit.file, edit.unit);
      if (refs.length < 2 || edit.index >= refs.length) {
        defect("a code reference removal leaving its location without one");
      }
      const [removed] = refs.splice(edit.index, 1);
      return done(
        `remove ${describeCodeRef(state, removed)} from ${codeLocationName(state, edit.file, edit.unit)}`,
      );
    }
    case "retargetRef": {
      const refs = codeLocationRefs(state, edit.file, edit.unit);
      const ref = refs[edit.index] as P16CodeRef | undefined;
      if (ref === undefined) defect("a code reference retarget out of range");
      const from = stagedIdentity(state, ref.file, ref.dotted);
      ref.file = edit.target.file;
      ref.dotted = edit.target.dotted;
      return done(
        `retarget ${ref.kind === "marker" ? "a marker" : "a text() call"} of ` +
          `${codeLocationName(state, edit.file, edit.unit)} from ${from} to ` +
          `${stagedIdentity(state, ref.file, ref.dotted)}`,
      );
    }
    case "addUnit": {
      const code = state.code[edit.file] as P16CodeFile | undefined;
      if (code === undefined) defect("a unit added to no code file");
      const name = `u${String(code.nextUnit)}`;
      code.nextUnit += 1;
      code.units.push({ name, refs: edit.refs.map((ref) => ({ ...ref })) });
      return done(`add the unit ${codePathOf(code)}#${name}`);
    }
    case "removeUnit": {
      const code = state.code[edit.file] as P16CodeFile | undefined;
      const unit = code?.units[edit.unit];
      if (code === undefined || unit === undefined) {
        defect("a unit removal addressing no unit");
      }
      code.units.splice(edit.unit, 1);
      return done(`remove the unit ${codePathOf(code)}#${unit.name}`);
    }
    case "addFile": {
      const name = `c${String(state.nextCode)}`;
      state.nextCode += 1;
      const file: P16CodeFile = {
        name,
        top: edit.top.map((ref) => ({ ...ref })),
        units: edit.units.map((refs, index) => ({
          name: `u${String(index)}`,
          refs: refs.map((ref) => ({ ...ref })),
        })),
        nextUnit: edit.units.length,
      };
      state.code.push(file);
      return done(`add the code file ${codePathOf(file)}`);
    }
    case "deleteFile": {
      const code = state.code[edit.file] as P16CodeFile | undefined;
      if (code === undefined) defect("a code file deletion addressing none");
      state.code.splice(edit.file, 1);
      return done(`delete the code file ${codePathOf(code)}`);
    }
  }
}

/**
 * Apply one step to the state (module header): mutate the model and return
 * what the step does. Pure over the state — the generator, the body, S-9's
 * per-draw sources, and the oracle's input all replay it — so identical
 * trials evolve identical states (H-10).
 */
function applyP16Step(state: P16State, step: P16Step): AppliedStep {
  switch (step.kind) {
    case "specEdit": {
      const { after, description } = applyEdit(state.spec, step.edit);
      state.spec = after;
      return {
        description: stagedText(state, description),
        argv: null,
        journalMap: NO_MAP,
      };
    }
    case "codeEdit":
      return applyCodeEdit(state, step.edit);
    case "addSpecFile": {
      if (state.taken.includes(step.basename)) {
        defect(`the added spec file's basename ${step.basename} is taken`);
      }
      state.basenames.push(step.basename);
      state.taken.push(step.basename);
      state.spec.files.push(structuredClone(step.file));
      return {
        description: `add the spec file ${specPath(step.basename)}`,
        argv: null,
        journalMap: NO_MAP,
      };
    }
    case "deleteSpecFile": {
      const last = state.spec.files.length - 1;
      if (last < 1) defect("the only spec file deleted");
      const path = specPathAt(state, last);
      // No spec source imports the last file; each code reference naming
      // one of its nodes is retargeted to the first file's root (module
      // header), so every code location keeps its reference count.
      for (const ref of allCodeRefs(state.code)) {
        if (ref.file !== last) continue;
        ref.file = 0;
        ref.dotted = "";
      }
      state.basenames.pop();
      state.spec.files.pop();
      return {
        description:
          `delete the spec file ${path}, every code reference naming one ` +
          `of its nodes retargeted to ${specPathAt(state, 0)}`,
        argv: null,
        journalMap: NO_MAP,
      };
    }
    case "deleteSection":
      return applyDeleteSectionStep(state, step);
    case "rename":
      return applyRenameStep(state, step);
    case "moveFile":
      return applyMoveFileStep(state, step);
    case "moveSection":
      return applyMoveSectionStep(state, step);
  }
}

/** The step's description against the state it applies to (no mutation). */
function describeStep(state: P16State, step: P16Step): string {
  return applyP16Step(structuredClone(state), step).description;
}

// ---------------------------------------------------------------------------
// Generation

/** A reference target: a node's file index and dotted ID. */
interface P16Target {
  readonly file: number;
  readonly dotted: string;
}

function targetOf(node: P16Node): P16Target {
  return { file: node.file, dotted: node.dotted };
}

function sameTarget(a: P16Target, b: P16Target): boolean {
  return a.file === b.file && a.dotted === b.dotted;
}

/** A code reference to a node of the pool, its kind drawn. */
function drawCodeRef(choices: Choices, pool: readonly P16Target[]): P16CodeRef {
  const target = choices.pick(pool);
  return {
    kind: choices.boolean(0.5) ? "text" : "marker",
    file: target.file,
    dotted: target.dotted,
  };
}

/**
 * The baseline's code sources (module header): one or two files, each with
 * up to two top-level references and one or two units of one to three
 * references each, every reference naming any spec node, roots included.
 */
function genInitialCode(choices: Choices, spec: WorkspaceModel): P16CodeFile[] {
  const pool = p16Nodes(spec).map(targetOf);
  const count = choices.weightedPick<number>([
    [1, 1],
    [3, 2],
  ]);
  const files: P16CodeFile[] = [];
  for (let index = 0; index < count; index += 1) {
    const top = [
      ...listOf((c: Choices) => drawCodeRef(c, pool), { max: 2 })(choices),
    ];
    const unitCount = choices.intInclusive(1, 2);
    const units: P16CodeUnit[] = [];
    for (let unit = 0; unit < unitCount; unit += 1) {
      units.push({
        name: `u${String(unit)}`,
        refs: [
          ...listOf((c: Choices) => drawCodeRef(c, pool), { min: 1, max: 3 })(
            choices,
          ),
        ],
      });
    }
    files.push({ name: `c${String(index)}`, top, units, nextUnit: unitCount });
  }
  return files;
}

/**
 * Draw one of `sites`: a nested section's half the time there is one, else a
 * section's three times in four there is one. An edit of a root's or a
 * top-level section's own content makes it `changed`, which leaves every
 * other change below it unvisited (10.5), so a draw favoring them would
 * rarely reach a `parent-consistency` item, let alone a chain of them.
 * Shrinks toward the first site.
 */
function pickSectionBiased<T extends { readonly node: P16Node }>(
  choices: Choices,
  sites: readonly T[],
): T {
  const nested = sites.filter((site) => site.node.dotted.includes("."));
  if (nested.length > 0 && choices.boolean(0.5)) return choices.pick(nested);
  const inSections = sites.filter((site) => site.node.section !== null);
  return inSections.length > 0 && choices.boolean(0.75)
    ? choices.pick(inSections)
    : choices.pick(sites);
}

/**
 * One spec edit valid by construction (module header): its references drawn
 * from `refPool`. A section's deletion is a step of its own
 * (`deleteSection`). Simplest first (shrinking): own text replaced.
 */
function genSpecEdit(choices: Choices, state: P16State): Edit {
  const { spec } = state;
  const nodes = p16Nodes(spec);
  const reach = reachabilityOf(spec);
  const poolFor = (host: P16Node): P16Node[] => refPool(nodes, reach, host);
  const drawRef = (pool: readonly P16Node[]): RefModel => {
    const target = choices.pick(pool);
    return {
      file: target.file,
      dotted: target.dotted,
      spell: choices.intInclusive(0, 5),
    };
  };
  const menu: (readonly [number, () => Edit])[] = [];

  // Own text.
  const proseSites = nodes.flatMap((node) =>
    node.items.flatMap((item, itemIndex) =>
      item.kind === "prose"
        ? item.parts.flatMap((part, partIndex) =>
            part.kind === "text"
              ? [{ node, item: itemIndex, part: partIndex }]
              : [],
          )
        : [],
    ),
  );
  if (proseSites.length === 0) defect("no prose run to edit");
  menu.push([
    3,
    () => {
      const site = pickSectionBiased(choices, proseSites);
      return {
        kind: "editProse",
        node: site.node.identity,
        item: site.item,
        part: site.part,
        text: proseText(choices),
      };
    },
  ]);

  // Embedding edits.
  const embedHosts = nodes.flatMap((node) => {
    const pool = poolFor(node);
    return pool.length === 0
      ? []
      : node.items.flatMap((item, itemIndex) =>
          item.kind === "prose" ? [{ node, itemIndex, pool }] : [],
        );
  });
  if (embedHosts.length > 0) {
    menu.push([
      2,
      () => {
        const host = pickSectionBiased(choices, embedHosts);
        return {
          kind: "addEmbed",
          node: host.node.identity,
          item: host.itemIndex,
          ref: drawRef(host.pool),
          tail: ` ${proseText(choices)}`,
        };
      },
    ]);
  }
  const embedSites = nodes.flatMap((node) =>
    node.items.flatMap((item, itemIndex) =>
      item.kind === "prose"
        ? item.parts.flatMap((part, partIndex) =>
            part.kind === "embed"
              ? [{ node, item: itemIndex, part: partIndex, ref: part.ref }]
              : [],
          )
        : [],
    ),
  );
  if (embedSites.length > 0) {
    menu.push([
      1,
      () => {
        const site = choices.pick(embedSites);
        return {
          kind: "removeEmbed",
          node: site.node.identity,
          item: site.item,
          part: site.part,
        };
      },
    ]);
    const retargetable = embedSites.flatMap((site) => {
      const current = modelIdentity(site.ref.file, site.ref.dotted);
      const pool = poolFor(site.node).filter(
        (target) => target.identity !== current,
      );
      return pool.length > 0 ? [{ site, pool }] : [];
    });
    if (retargetable.length > 0) {
      menu.push([
        1,
        () => {
          const { site, pool } = choices.pick(retargetable);
          return {
            kind: "retargetEmbed",
            node: site.node.identity,
            item: site.item,
            part: site.part,
            ref: drawRef(pool),
          };
        },
      ]);
    }
    const swapPairs = embedSites.flatMap((a, i) =>
      embedSites
        .slice(i + 1)
        .flatMap((b) =>
          a.node.identity === b.node.identity &&
          modelIdentity(a.ref.file, a.ref.dotted) !==
            modelIdentity(b.ref.file, b.ref.dotted)
            ? [{ a, b }]
            : [],
        ),
    );
    if (swapPairs.length > 0) {
      menu.push([
        1,
        () => {
          const { a, b } = choices.pick(swapPairs);
          return {
            kind: "swapEmbeds",
            node: a.node.identity,
            itemA: a.item,
            partA: a.part,
            itemB: b.item,
            partB: b.part,
          };
        },
      ]);
    }
  }

  // Structure: a section added, two children reordered.
  menu.push([
    2,
    () => {
      const { node } = pickSectionBiased(
        choices,
        nodes.map((node) => ({ node })),
      );
      return {
        kind: "addChild",
        node: node.identity,
        at: choices.intInclusive(0, node.items.length),
        text: proseText(choices),
      };
    },
  ]);
  const swapSites = nodes.flatMap((node) => {
    const indexes = node.items.flatMap((item, index) =>
      item.kind === "section" ? [index] : [],
    );
    return indexes.length >= 2 ? [{ node: node.identity, indexes }] : [];
  });
  if (swapSites.length > 0) {
    menu.push([
      2,
      () => {
        const site = choices.pick(swapSites);
        const first = choices.intInclusive(0, site.indexes.length - 2);
        const second = choices.intInclusive(first + 1, site.indexes.length - 1);
        return {
          kind: "swapChildren",
          node: site.node,
          itemA: site.indexes[first],
          itemB: site.indexes[second],
        };
      },
    ]);
  }

  // Metadata: coverage, tags, and `d` references.
  const sections = nodes.filter(
    (node): node is P16Node & { readonly section: SectionItem } =>
      node.section !== null,
  );
  if (sections.length > 0) {
    menu.push([
      1,
      () => ({ kind: "coverageToggle", node: choices.pick(sections).identity }),
    ]);
    const taggable = sections.flatMap((node) => {
      const current = new Set(node.section.tags ?? []);
      const fresh = TAG_POOL.filter((token) => !current.has(token));
      return fresh.length > 0 ? [{ node, fresh }] : [];
    });
    if (taggable.length > 0) {
      menu.push([
        1,
        () => {
          const { node, fresh } = choices.pick(taggable);
          return {
            kind: "tagsAdd",
            node: node.identity,
            token: choices.pick(fresh),
          };
        },
      ]);
    }
    const tagRemovals = sections.flatMap((node) => {
      const tags = node.section.tags ?? [];
      return tags.flatMap((token, index) =>
        tags.filter((other) => other === token).length === 1
          ? [{ node: node.identity, index }]
          : [],
      );
    });
    if (tagRemovals.length > 0) {
      menu.push([
        1,
        () => ({ kind: "tagsRemove", ...choices.pick(tagRemovals) }),
      ]);
    }
    const depAddable = sections.flatMap((node) => {
      const held = new Set(
        (node.section.deps ?? []).map((ref) =>
          modelIdentity(ref.file, ref.dotted),
        ),
      );
      const pool = poolFor(node).filter((target) => !held.has(target.identity));
      return pool.length > 0 ? [{ node, pool }] : [];
    });
    if (depAddable.length > 0) {
      menu.push([
        1,
        () => {
          const { node, pool } = choices.pick(depAddable);
          return { kind: "depAdd", node: node.identity, ref: drawRef(pool) };
        },
      ]);
    }
    const depOccurrences = sections.flatMap((node) =>
      (node.section.deps ?? []).map((ref, index) => ({ node, ref, index })),
    );
    const depRemovals = depOccurrences.filter(
      ({ node, ref }) =>
        (node.section.deps ?? []).filter(
          (other) =>
            modelIdentity(other.file, other.dotted) ===
            modelIdentity(ref.file, ref.dotted),
        ).length === 1,
    );
    if (depRemovals.length > 0) {
      menu.push([
        1,
        () => {
          const site = choices.pick(depRemovals);
          return {
            kind: "depRemove",
            node: site.node.identity,
            index: site.index,
          };
        },
      ]);
    }
    const depRetargets = depOccurrences.flatMap((occurrence) => {
      const current = modelIdentity(occurrence.ref.file, occurrence.ref.dotted);
      const pool = poolFor(occurrence.node).filter(
        (target) => target.identity !== current,
      );
      return pool.length > 0 ? [{ ...occurrence, pool }] : [];
    });
    if (depRetargets.length > 0) {
      menu.push([
        1,
        () => {
          const site = choices.pick(depRetargets);
          return {
            kind: "depRetarget",
            node: site.node.identity,
            index: site.index,
            ref: drawRef(site.pool),
          };
        },
      ]);
    }
  }
  return choices.weightedPick(menu)();
}

/**
 * One code edit (module header): a code location holding references keeps
 * at least one while it stands. Simplest first: a reference added.
 */
function genCodeEdit(choices: Choices, state: P16State): P16CodeEdit {
  const pool = p16Nodes(state.spec).map(targetOf);
  const locations = state.code.flatMap((file, fileIndex) => [
    { file: fileIndex, unit: null as number | null, refs: file.top },
    ...file.units.map((unit, unitIndex) => ({
      file: fileIndex,
      unit: unitIndex as number | null,
      refs: unit.refs,
    })),
  ]);
  const menu: (readonly [number, () => P16CodeEdit])[] = [];
  if (locations.length > 0) {
    menu.push([
      3,
      () => {
        const location = choices.pick(locations);
        return {
          kind: "addRef",
          file: location.file,
          unit: location.unit,
          ref: drawCodeRef(choices, pool),
        };
      },
    ]);
  }
  const refSites = locations.flatMap((location) =>
    location.refs.map((ref, index) => ({ ...location, index, ref })),
  );
  const retargetable = refSites.flatMap((site) => {
    const others = pool.filter((target) => !sameTarget(target, site.ref));
    return others.length > 0 ? [{ site, others }] : [];
  });
  if (retargetable.length > 0) {
    menu.push([
      2,
      () => {
        const { site, others } = choices.pick(retargetable);
        return {
          kind: "retargetRef",
          file: site.file,
          unit: site.unit,
          index: site.index,
          target: choices.pick(others),
        };
      },
    ]);
  }
  const removable = refSites.filter((site) => site.refs.length >= 2);
  if (removable.length > 0) {
    menu.push([
      1,
      () => {
        const site = choices.pick(removable);
        return {
          kind: "removeRef",
          file: site.file,
          unit: site.unit,
          index: site.index,
        };
      },
    ]);
  }
  if (state.code.length > 0) {
    menu.push([
      1,
      () => ({
        kind: "addUnit",
        file: choices.intInclusive(0, state.code.length - 1),
        refs: [
          ...listOf((c: Choices) => drawCodeRef(c, pool), { min: 1, max: 2 })(
            choices,
          ),
        ],
      }),
    ]);
  }
  const units = state.code.flatMap((file, fileIndex) =>
    file.units.map((_unit, unit) => ({ file: fileIndex, unit })),
  );
  if (units.length > 0) {
    menu.push([2, () => ({ kind: "removeUnit", ...choices.pick(units) })]);
  }
  menu.push([
    1,
    () => ({
      kind: "addFile",
      top: [
        ...listOf((c: Choices) => drawCodeRef(c, pool), { max: 1 })(choices),
      ],
      units: [
        [
          ...listOf((c: Choices) => drawCodeRef(c, pool), { min: 1, max: 2 })(
            choices,
          ),
        ],
      ],
    }),
  ]);
  if (state.code.length > 0) {
    menu.push([
      2,
      () => ({
        kind: "deleteFile",
        file: choices.intInclusive(0, state.code.length - 1),
      }),
    ]);
  }
  return choices.weightedPick(menu)();
}

/**
 * A spec file to add (module header): its first prose line, then one or two
 * sections, each optionally tagged, `coverage="none"`, or depending on a node
 * of an earlier file, holding a prose line that may embed one — every
 * reference external, naming an earlier file (the import header binds it).
 */
function genAddedSpecFile(choices: Choices, state: P16State): FileModel {
  const pool = p16Nodes(state.spec).map(targetOf);
  const drawRef = (): RefModel => {
    const target = choices.pick(pool);
    return {
      file: target.file,
      dotted: target.dotted,
      spell: choices.intInclusive(0, 5),
    };
  };
  const prose = (): ProseItem => {
    const item: ProseItem = {
      kind: "prose",
      parts: [{ kind: "text", text: proseText(choices) }],
    };
    if (choices.boolean(0.4)) {
      item.parts.push(
        { kind: "embed", ref: drawRef() },
        { kind: "text", text: ` ${proseText(choices)}` },
      );
    }
    return item;
  };
  const items: BodyItem[] = [
    { kind: "prose", parts: [{ kind: "text", text: proseText(choices) }] },
  ];
  const count = choices.intInclusive(1, 2);
  for (let index = 0; index < count; index += 1) {
    items.push({
      kind: "section",
      seg: `s${String(index)}`,
      tags: choices.boolean(0.3) ? [choices.pick(TAG_POOL)] : null,
      coverageNone: choices.boolean(0.2),
      deps: choices.boolean(0.5) ? [drawRef()] : null,
      depsSingle: false,
      items: [prose()],
    });
  }
  return { items, nextSeg: count };
}

/** The candidate for a section move that creates its target file. */
const CREATED_TARGET = { toFile: null, targetDotted: null } as const;

/** A placeholder basename for probing a created target (never staged). */
const PROBE_BASENAME = "P16probe";

/**
 * Why moving `moved` to `target` would leave an invalid workspace, or null
 * (module header: every draw a move the product performs).
 */
function moveProblem(
  state: P16State,
  moved: SectionSite,
  target: {
    readonly toFile: number | null;
    readonly targetDotted: string | null;
  },
): string | null {
  const probe = structuredClone(state);
  applyP16Step(probe, {
    kind: "moveSection",
    fromFile: moved.file,
    dotted: moved.dotted,
    toFile: target.toFile,
    targetDotted: target.targetDotted,
    createdBasename: target.toFile === null ? PROBE_BASENAME : null,
  });
  return p16ModelProblem(probe);
}

/**
 * A section move under P-5's discipline (module header): the moved section a
 * nested one three times in four where one exists, else drawn among all; its
 * target among the valid candidates — every file root and every section
 * outside the moved subtree, each admitted by `moveProblem` — a created
 * target file a fifth of the time it is valid, otherwise another parent
 * than the moved node's own nine times in ten where one is valid, a
 * section's three times in four among those, and the own parent (a
 * re-insertion as its last child, always valid) remaining.
 */
function genSectionMove(
  choices: Choices,
  state: P16State,
  sections: readonly SectionSite[],
): P16Step {
  // A nested section three times in four where one exists: moving a
  // top-level section changes its file's root, which leaves every other
  // change in the file unvisited (10.5; `pickSectionBiased`).
  const nested = sections.filter((site) => site.parentDotted !== "");
  const moved =
    nested.length > 0 && choices.boolean(0.75)
      ? choices.pick(nested)
      : choices.pick(sections);
  const ownParent = {
    toFile: moved.file,
    targetDotted: moved.parentDotted === "" ? null : moved.parentDotted,
  };
  const candidates: { toFile: number; targetDotted: string | null }[] = [];
  state.spec.files.forEach((_file, toFile) => {
    candidates.push({ toFile, targetDotted: null });
  });
  for (const site of sections) {
    if (
      site.file === moved.file &&
      rewriteDotted(site.dotted, moved.dotted, moved.dotted) !== null
    ) {
      continue;
    }
    candidates.push({ toFile: site.file, targetDotted: site.dotted });
  }
  const valid = candidates.filter(
    (candidate) => moveProblem(state, moved, candidate) === null,
  );
  if (valid.length === 0) {
    defect(
      `no valid target for moving ${modelIdentity(moved.file, moved.dotted)} ` +
        `(its own parent always is)`,
    );
  }
  const elsewhere = valid.filter(
    (candidate) =>
      candidate.toFile !== ownParent.toFile ||
      candidate.targetDotted !== ownParent.targetDotted,
  );
  const createdValid = moveProblem(state, moved, CREATED_TARGET) === null;
  let target: { toFile: number | null; targetDotted: string | null };
  if (createdValid && choices.boolean(0.2)) {
    target = CREATED_TARGET;
  } else if (elsewhere.length > 0 && choices.boolean(0.9)) {
    // A section parent three times in four where one is valid (a root
    // target changes that root; above).
    const sectionParents = elsewhere.filter(
      (candidate) => candidate.targetDotted !== null,
    );
    target =
      sectionParents.length > 0 && choices.boolean(0.75)
        ? choices.pick(sectionParents)
        : choices.pick(elsewhere);
  } else {
    target = choices.pick(valid);
  }
  return {
    kind: "moveSection",
    fromFile: moved.file,
    dotted: moved.dotted,
    toFile: target.toFile,
    targetDotted: target.targetDotted,
    createdBasename:
      target.toFile === null
        ? drawSpecBasename(choices, new Set(state.taken))
        : null,
  };
}

/**
 * One step of the interleaving (module header), weighted: a spec edit 5, a
 * code edit 3, a file move 2, a spec file added 2, and — where a section
 * exists — a rename 2, a section move 4, a section deleted 2, and — where two
 * spec files exist — the last one deleted 1. Simplest first: a spec edit.
 */
function genStep(choices: Choices, state: P16State): P16Step {
  const sections = sectionsOf(state.spec);
  const menu: (readonly [number, () => P16Step])[] = [
    [5, () => ({ kind: "specEdit", edit: genSpecEdit(choices, state) })],
    [3, () => ({ kind: "codeEdit", edit: genCodeEdit(choices, state) })],
    [
      2,
      () => ({
        kind: "moveFile",
        file: choices.intInclusive(0, state.spec.files.length - 1),
        basename: drawSpecBasename(choices, new Set(state.taken)),
      }),
    ],
    [
      2,
      () => ({
        kind: "addSpecFile",
        file: genAddedSpecFile(choices, state),
        basename: drawSpecBasename(choices, new Set(state.taken)),
      }),
    ],
  ];
  if (sections.length > 0) {
    menu.push([
      2,
      () => {
        const site = choices.pick(sections);
        return {
          kind: "rename",
          file: site.file,
          dotted: site.dotted,
          newSeg: `s${String(state.spec.files[site.file].nextSeg)}`,
        };
      },
    ]);
    menu.push([4, () => genSectionMove(choices, state, sections)]);
    menu.push([
      2,
      () => {
        // A nested section's half the time there is one (its file's root
        // stays unchanged; `pickSectionBiased`).
        const nested = sections.filter((site) => site.parentDotted !== "");
        const site =
          nested.length > 0 && choices.boolean(0.5)
            ? choices.pick(nested)
            : choices.pick(sections);
        return { kind: "deleteSection", file: site.file, dotted: site.dotted };
      },
    ]);
  }
  // The last file in import order, which no spec source imports (module
  // header); the first file always stays.
  if (state.spec.files.length >= 2) {
    menu.push([1, () => ({ kind: "deleteSpecFile" })]);
  }
  return choices.weightedPick(menu)();
}

/**
 * PROP-03's model with up to three further sections nested below existing
 * ones (module header): PROP-03 draws at most three sections per file, so
 * its trees are shallow, while a `parent-consistency` item needs a visited
 * node two levels deep and a chain of them three. Each added section is
 * P-4's `addChild` — one prose line, no props, a fresh segment — appended to
 * a section drawn deepest-first half the time. Shrinks toward none.
 */
function deepened(choices: Choices, model: WorkspaceModel): WorkspaceModel {
  let current = model;
  const count = choices.intInclusive(0, 3);
  for (let index = 0; index < count; index += 1) {
    const sections = sectionsOf(current);
    if (sections.length === 0) break;
    const depth = (site: SectionSite): number => site.dotted.split(".").length;
    const deepest = Math.max(...sections.map(depth));
    const site = choices.boolean(0.5)
      ? choices.pick(sections.filter((entry) => depth(entry) === deepest))
      : choices.pick(sections);
    current = applyEdit(current, {
      kind: "addChild",
      node: modelIdentity(site.file, site.dotted),
      at: site.section.items.length,
      text: proseText(choices),
    }).after;
  }
  return current;
}

/**
 * P-16's trial generator (module header), replayed at the fixed seeds by
 * P-16's draw guard (test/self/p16-fixed-seed-draws.test.ts) exactly as the
 * registration below draws it, `P16_RUNS` trials per seed.
 */
export const genP16Trial: Gen<P16Trial> = (choices) => {
  const spec = deepened(choices, genWorkspaceModel(choices));
  const basenames = drawSpecBasenames(choices, spec.files.length);
  const code = genInitialCode(choices, spec);
  const initial: P16Initial = { spec, basenames, code };
  const state = initState(initial);
  const baselineProblem = p16ModelProblem(state);
  if (baselineProblem !== null) {
    defect(`the generated baseline is invalid: ${baselineProblem}`);
  }
  const steps: P16Step[] = [];
  do {
    const step = genStep(choices, state);
    const applied = applyP16Step(state, step);
    const problem = p16ModelProblem(state);
    if (problem !== null) {
      defect(
        `step ${String(steps.length + 1)} (${applied.description}) leaves ` +
          `an invalid workspace: ${problem}`,
      );
    }
    steps.push(step);
  } while (steps.length < MAX_STEPS && choices.boolean(0.8));
  return { initial, steps };
};

// ---------------------------------------------------------------------------
// The oracle's input (module header)

type Semantics = ReturnType<typeof semanticsOf>;

/** One graph state as the oracle reads it, in model space. */
interface P16Snapshot {
  readonly sems: Semantics;
  /** The staged path of each spec file index at the snapshot. */
  readonly paths: readonly string[];
  /** Each code location with references → their targets' model identities. */
  readonly code: ReadonlyMap<string, readonly string[]>;
}

function snapshotOf(state: P16State): P16Snapshot {
  const code = new Map<string, string[]>();
  for (const file of state.code) {
    const path = codePathOf(file);
    const targets = (refs: readonly P16CodeRef[]): string[] =>
      refs.map((ref) => modelIdentity(ref.file, ref.dotted));
    if (file.top.length > 0) code.set(path, targets(file.top));
    for (const unit of file.units) {
      code.set(`${path}#${unit.name}`, targets(unit.refs));
    }
  }
  return {
    sems: semanticsOf(state.spec),
    paths: state.basenames.map(specPath),
    code,
  };
}

/** A model identity of the snapshot as its workspace stages it (SPEC 1.5). */
function snapshotIdentity(snapshot: P16Snapshot, identity: string): string {
  const at = identity.indexOf("#");
  const path = at === -1 ? identity : identity.slice(0, at);
  const file = snapshot.paths.findIndex(
    (_path, index) => modelIdentity(index, "") === path,
  );
  if (file === -1) defect(`${identity} names no spec file of the snapshot`);
  return `${snapshot.paths[file]}${at === -1 ? "" : identity.slice(at)}`;
}

/**
 * One side of the oracle's input: every node of the snapshot with every
 * identity occurrence mapped through `map` — keys, child lists, the
 * reference tokens of the own-content key, the `d`-target set, the pair
 * multiset, and the edge targets — the JSON semantic keys standing in for
 * the SPEC 5.5 hash preimages (P-6's mapping, plus the `d`-target set the
 * path-blocks oracle reads).
 */
function pathBlocksSide(
  sems: Semantics,
  map: (identity: string) => string,
): PathBlocksSide {
  const side = new Map<string, PathBlocksNode>();
  for (const [identity, sem] of sems) {
    const tokens = JSON.parse(sem.ownTokens) as [string, string][];
    const [deps, coverage, tags] = JSON.parse(sem.metaKey) as [
      string[],
      string,
      string[],
    ];
    const pairs = JSON.parse(sem.pairKey) as string[];
    const dTargets = [...new Set(deps.map(map))].sort();
    side.set(map(identity), {
      children: sem.children.map(map),
      ownKey: JSON.stringify(
        tokens.map(([kind, value]) =>
          kind === "run" ? [kind, value] : [kind, map(value)],
        ),
      ),
      metaKey: JSON.stringify([dTargets, coverage, tags]),
      pairKey: JSON.stringify(pairs.map(map).sort()),
      edgeTargets: [...new Set(sem.edgeTargets.map(map))].sort(),
      dTargets,
    });
  }
  if (side.size !== sems.size) {
    defect("an identity mapping collapsed two identities");
  }
  return side;
}

function codeSide(
  code: ReadonlyMap<string, readonly string[]>,
  map: (identity: string) => string,
): PathBlocksCode {
  return new Map(
    [...code].map(([location, targets]) => [location, targets.map(map)]),
  );
}

/**
 * The oracle's input for a trial's two snapshots (module header): the
 * baseline's identities, as its commit stages them, mapped forward through
 * the journal suffix — each operation's mapping in turn, the operations the
 * harness performed, which map only the nodes present when they run (SPEC
 * 6.3: chained mappings compose) — and the current snapshot's as they
 * stand.
 */
function p16OracleInput(
  baseline: P16Snapshot,
  current: P16Snapshot,
  journal: readonly Readonly<Record<string, string>>[],
): PathBlocksInput {
  const forward = (identity: string): string =>
    journal.reduce((mapped, map) => map[mapped] ?? mapped, identity);
  const before = (identity: string): string =>
    forward(snapshotIdentity(baseline, identity));
  const after = (identity: string): string =>
    snapshotIdentity(current, identity);
  return {
    before: pathBlocksSide(baseline.sems, before),
    after: pathBlocksSide(current.sems, after),
    codeBefore: codeSide(baseline.code, before),
    codeAfter: codeSide(current.code, after),
  };
}

/** A trial's prediction, computed from the generator's model alone. */
export interface P16Prediction {
  /** The items `review create --base` must yield (the oracle's). */
  readonly prediction: PathBlocksPrediction;
  /** The oracle's input: the two graphs and their code locations. */
  readonly input: PathBlocksInput;
  /** Each step's description, in order. */
  readonly history: readonly string[];
  /**
   * Every baseline node whose presented identity — its baseline identity
   * mapped forward through the journal (6.3, 10.4) — differs from the one
   * the baseline commit gives it: presented identity → baseline identity.
   */
  readonly journalMapped: ReadonlyMap<string, string>;
}

/**
 * The oracle's prediction for a trial, computed from the generator's model
 * alone — no product (module header): the items `review create --base`
 * must yield, with the history that leads to them.
 */
export function predictP16Trial(trial: P16Trial): P16Prediction {
  const state = initState(trial.initial);
  const baseline = snapshotOf(state);
  const journal: Readonly<Record<string, string>>[] = [];
  const history: string[] = [];
  for (const step of trial.steps) {
    const applied = applyP16Step(state, step);
    if (applied.argv !== null) journal.push(applied.journalMap);
    history.push(applied.description);
  }
  const input = p16OracleInput(baseline, snapshotOf(state), journal);
  const committed = p16OracleInput(baseline, baseline, []);
  const journalMapped = new Map<string, string>();
  const presented = [...input.before.keys()];
  [...committed.before.keys()].forEach((identity, index) => {
    if (presented[index] !== identity) {
      journalMapped.set(presented[index], identity);
    }
  });
  return {
    prediction: derivePathBlocks(input),
    input,
    history,
    journalMapped,
  };
}

// ---------------------------------------------------------------------------
// Answer scale (TEST-SPEC S-8, H-11)

/**
 * The bytes a payload node entry can take beyond its text, generously: an
 * identity (P-16's are under 64 bytes), its presence, a source range, and,
 * in a recorded state, four hashes and the entry's own punctuation.
 */
export const P16_NODE_ENTRY_BYTES = 512;

/**
 * The bytes an item can take beyond its node entries and texts, generously:
 * its id, kind, status, blocked state, `blockedBy`, a metadata pair, and the
 * item's own punctuation — `reason` aside, informational and unpinned
 * (10.2), its scale no input bounds.
 */
export const P16_ITEM_BYTES = 1024;

/** The scale of a trial's `review export` answer (S-8; H-11). */
export interface P16AnswerScale {
  /** The items the session holds (the oracle's). */
  readonly items: number;
  /**
   * Text values a payload may carry (10.7): per item its scope text, a text
   * per scope node, a text per context node, and an origin node's
   * before/after pair — tolerated members included.
   */
  readonly textValues: number;
  /**
   * Node entries a payload may carry: each scope, context, and origin node
   * once as presented and twice more as recorded (`baseline`, `current`).
   */
  readonly nodeEntries: number;
  /**
   * The largest expanded subtree text (1.6's expanded value, 10.7) of any
   * node in any graph state the trial passes through — the baseline, and
   * the state after each step, where an absent node's text may come from —
   * in UTF-8 bytes, a root's two leading empty lines included.
   */
  readonly largestText: number;
  /**
   * The answer's bound in bytes: every text value at `largestText`, JSON's
   * escape of each LF doubling it at most (P-16's texts are plain ASCII
   * prose and LFs), beside `P16_NODE_ENTRY_BYTES` per node entry and
   * `P16_ITEM_BYTES` per item.
   */
  readonly bound: number;
}

/**
 * The largest expanded subtree text of any node of the model, in bytes:
 * its runs, its children's subtree texts, and its embedded targets' subtree
 * texts (1.6), plus the two leading empty lines a root's first run can hold
 * beyond what PROP-03's semantics model (P-5's leading empty line, the
 * import block's blank line).
 */
function largestSubtreeText(spec: WorkspaceModel): number {
  const sems = semanticsOf(spec);
  const memo = new Map<string, number>();
  const size = (identity: string): number => {
    const cached = memo.get(identity);
    if (cached !== undefined) return cached;
    const sem = sems.get(identity);
    if (sem === undefined) defect(`no semantics for ${identity}`);
    let total = 0;
    for (const [kind, value] of JSON.parse(sem.ownTokens) as [
      string,
      string,
    ][]) {
      total += kind === "run" ? Buffer.byteLength(value, "utf8") : size(value);
    }
    memo.set(identity, total);
    return total;
  };
  let largest = 0;
  for (const identity of sems.keys())
    largest = Math.max(largest, size(identity));
  return largest + 2;
}

/**
 * The scale of the `review export` answer a conforming product gives over a
 * trial (S-8: the largest answers SPEC.md permits over the inputs the suite
 * stages), computed from the generator's model alone: the oracle's items,
 * their payload's text values and node entries, and the largest text value
 * any of them can carry (`P16AnswerScale`).
 */
export function p16AnswerScale(trial: P16Trial): P16AnswerScale {
  const { prediction } = predictP16Trial(trial);
  const state = initState(trial.initial);
  let largestText = largestSubtreeText(state.spec);
  for (const step of trial.steps) {
    applyP16Step(state, step);
    largestText = Math.max(largestText, largestSubtreeText(state.spec));
  }
  let textValues = 0;
  let nodeEntries = 0;
  for (const item of prediction.items) {
    const origin = item.origin.length + item.originOptional.length;
    textValues += 1 + item.scopeSet.length + item.context.length + 2 * origin;
    nodeEntries += 3 * (item.scopeSet.length + item.context.length + origin);
  }
  return {
    items: prediction.items.length,
    textValues,
    nodeEntries,
    largestText,
    bound:
      2 * largestText * textValues +
      P16_NODE_ENTRY_BYTES * nodeEntries +
      P16_ITEM_BYTES * prediction.items.length,
  };
}

// ---------------------------------------------------------------------------
// S-9's per-draw check (helpers/property.ts `drawSources`) and form vectors

/**
 * The would-be texts of a drawn section move (SPEC 6.5's
 * `refused-invalid-rewrite` judges them; TEST-SPEC §16 P-16: section moves
 * drawn under P-5's discipline, every draw a move the product performs),
 * composed by P-5's own builder over the state the move applies to, in the
 * flow layout every P-16 section stands in — so S-9 judges each before the
 * product sees the draw.
 */
function wouldBeTexts(
  state: P16State,
  step: Extract<P16Step, { kind: "moveSection" }>,
  label: string,
): DrawSource[] {
  const trial: SectionMoveTrial = {
    model: structuredClone(state.spec),
    fromFile: step.fromFile,
    dotted: step.dotted,
    target: { toFile: step.toFile, targetDotted: step.targetDotted },
    newSeg:
      step.toFile === null
        ? "s0"
        : `s${String(state.spec.files[step.toFile].nextSeg)}`,
    layout: FLOW_LAYOUT,
    selfCloseTargetParent: false,
    stripFinalNewline: false,
    textPositionTarget: null,
    basenames: [...state.basenames],
    createdBasename: step.createdBasename,
  };
  return stagedSectionMoveSources(trial)
    .filter(
      ([, , source]) => source?.startsWith(P5_WOULD_BE_LABEL_PREFIX) === true,
    )
    .map(([path, text, source]) => [path, text, `${label}: ${source ?? ""}`]);
}

/** The label every would-be entry of {@link stagedP16Sources} carries. */
export const P16_WOULD_BE_LABEL = "would-be";

/**
 * P-16's per-draw sources: every file the baseline stages, every file each
 * step stages — an edit's changed files, a journaled operation's re-staged
 * workspace — and, before a section move applies, its would-be texts
 * (`wouldBeTexts`), so S-9 judges each before the product sees the draw; one
 * that does not derive, or is not well-formed TypeScript, is a harness error
 * carrying the seed (TEST-SPEC §16 preamble, 17 S-9).
 */
export function stagedP16Sources(trial: P16Trial): DrawSource[] {
  const state = initState(trial.initial);
  let files = renderP16Sources(state);
  const sources: DrawSource[] = Object.entries(files).map(
    ([path, text]): DrawSource => [path, text, "the baseline workspace"],
  );
  trial.steps.forEach((step, index) => {
    const label = `step ${String(index + 1)}`;
    if (step.kind === "moveSection") {
      sources.push(
        ...wouldBeTexts(
          state,
          step,
          `${label} (${describeStep(state, step)}), ${P16_WOULD_BE_LABEL}`,
        ),
      );
    }
    const applied = applyP16Step(state, step);
    const after = renderP16Sources(state);
    for (const [path, text] of Object.entries(after)) {
      if (applied.argv !== null || files[path] !== text) {
        sources.push([path, text, `after ${label} — ${applied.description}`]);
      }
    }
    files = after;
  });
  return sources;
}

/**
 * S-9's fixed TypeScript form-vector set's code sources (TEST-SPEC 17 S-9;
 * the §16 preamble): every code-source form the rendering spells, through
 * the draws' own renderer — an import of every spec module under ordinary
 * and barred-class basenames, top-level markers and `text(...)` calls on a
 * root and on sections, a file with units alone, and units holding markers
 * and calls — beside the configuration record.
 */
export const P16_TS_FORM_VECTORS: ReadonlyArray<
  readonly [name: string, path: string, source: string | Uint8Array]
> = [
  ["P-16 configuration (P16_CONFIG)", "xspec.config.ts", P16_CONFIG.source],
  [
    "P-16 code source: top-level markers and calls, units, five imports",
    "src/c0.ts",
    renderP16CodeFile(
      {
        name: "c0",
        top: [
          { kind: "marker", file: 0, dotted: "" },
          { kind: "marker", file: 1, dotted: "s0.s1" },
          { kind: "text", file: 2, dotted: "" },
          { kind: "text", file: 0, dotted: "s2" },
        ],
        units: [
          {
            name: "u0",
            refs: [
              { kind: "marker", file: 3, dotted: "s4" },
              { kind: "text", file: 4, dotted: "s0" },
              { kind: "marker", file: 4, dotted: "" },
            ],
          },
          { name: "u1", refs: [{ kind: "text", file: 1, dotted: "" }] },
        ],
        nextUnit: 2,
      },
      ["A", "default", "Iterator", "__x", "text"],
    ),
  ],
  [
    "P-16 code source: units alone, one import",
    "src/c1.ts",
    renderP16CodeFile(
      {
        name: "c1",
        top: [],
        units: [
          { name: "u3", refs: [{ kind: "marker", file: 0, dotted: "s1" }] },
        ],
        nextUnit: 4,
      },
      ["N0"],
    ),
  ],
];

/**
 * The fixed spec model of P-16's own MDX form vectors (below): five files,
 * so an import header of four lines; references the PROP-03 generator never
 * draws but P-16's pools do — a local `d` reference to the holder's own
 * descendant and to a later sibling's subtree, a root-level embedding of a
 * later top-level section — and a file holding a moved section alone, as a
 * created target file stands after its move.
 */
const P16_FORM_MODEL: WorkspaceModel = {
  files: [
    {
      nextSeg: 3,
      items: [
        { kind: "prose", parts: [{ kind: "text", text: "a0 first" }] },
        {
          kind: "prose",
          parts: [
            { kind: "text", text: "a0 lead " },
            { kind: "embed", ref: { file: 0, dotted: "s1", spell: 0 } },
            { kind: "text", text: " a0 tail" },
          ],
        },
        {
          kind: "section",
          seg: "s0",
          tags: ["t1"],
          coverageNone: false,
          deps: [
            { file: 0, dotted: "s0.s2", spell: 1 },
            { file: 0, dotted: "s1", spell: 0 },
          ],
          depsSingle: false,
          items: [
            { kind: "prose", parts: [{ kind: "text", text: "k9 holder" }] },
            {
              kind: "section",
              seg: "s2",
              tags: null,
              coverageNone: true,
              deps: null,
              depsSingle: false,
              items: [
                { kind: "prose", parts: [{ kind: "text", text: "k9 kid" }] },
              ],
            },
          ],
        },
        {
          kind: "section",
          seg: "s1",
          tags: null,
          coverageNone: false,
          deps: null,
          depsSingle: false,
          items: [
            { kind: "prose", parts: [{ kind: "text", text: "k9 later" }] },
          ],
        },
      ],
    },
    {
      nextSeg: 1,
      items: [
        { kind: "prose", parts: [{ kind: "text", text: "b0 first" }] },
        {
          kind: "section",
          seg: "s0",
          tags: null,
          coverageNone: false,
          deps: [{ file: 0, dotted: "", spell: 0 }],
          depsSingle: true,
          items: [{ kind: "prose", parts: [{ kind: "text", text: "k9 b" }] }],
        },
      ],
    },
    {
      nextSeg: 1,
      items: [
        { kind: "prose", parts: [{ kind: "text", text: "c0 first" }] },
        {
          kind: "section",
          seg: "s0",
          tags: null,
          coverageNone: false,
          deps: null,
          depsSingle: false,
          items: [],
        },
      ],
    },
    {
      nextSeg: 1,
      items: [
        { kind: "prose", parts: [{ kind: "text", text: "d0 first" }] },
        {
          kind: "section",
          seg: "s0",
          tags: ["zeta"],
          coverageNone: true,
          deps: [{ file: 1, dotted: "s0", spell: 2 }],
          depsSingle: false,
          items: [
            {
              kind: "prose",
              parts: [
                { kind: "text", text: "d0 lead " },
                { kind: "embed", ref: { file: 2, dotted: "", spell: 0 } },
                { kind: "text", text: " d0 tail" },
              ],
            },
          ],
        },
      ],
    },
    {
      // A created target file after its move: the moved section alone.
      nextSeg: 1,
      items: [
        {
          kind: "section",
          seg: "s0",
          tags: null,
          coverageNone: false,
          deps: [{ file: 0, dotted: "s1", spell: 1 }],
          depsSingle: true,
          items: [
            { kind: "prose", parts: [{ kind: "text", text: "k9 moved" }] },
          ],
        },
      ],
    },
  ],
};

/** The fixed form-vector set of P-16's spec-source rendering (S-9). */
export const P16_FORM_VECTORS: ReadonlyArray<
  readonly [name: string, source: string]
> = Object.entries(
  renderP5Workspace(
    P16_FORM_MODEL,
    ["A", "default", "Iterator", "__x", "text"].map(specPath),
  ),
).map(([path, source]): readonly [string, string] => [
  `P-16 rendering of ${path}`,
  source,
]);

// ---------------------------------------------------------------------------
// The assertion (module header)

/** Byte order of two strings' UTF-8 encodings (SPEC 10.5, 12.0). */
function compareBytes(a: string, b: string): number {
  return Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

function sortedBytes(values: readonly string[]): string[] {
  return [...values].sort(compareBytes);
}

/** An item's kind and scope node as one key (`<kind> <scope>`). */
function itemKey(kind: string, scope: string): string {
  return `${kind} ${scope}`;
}

function json(value: unknown): string {
  return JSON.stringify(value);
}

/**
 * The session `review export` presents must hold exactly the oracle's items
 * (module header): the same kinds and scope nodes in the same order; each
 * item's scope set (its members' presence included), context, and origin
 * (required members present, nothing but required and tolerated members);
 * each item's `blockedBy` as the kinds and scope nodes of the items it
 * names. `reason` and the recorded hashes are not read.
 */
export function assertP16Export(
  report: ExportReport,
  prediction: PathBlocksPrediction,
  context: string,
): void {
  const keyOf = (item: ReviewItem): string =>
    itemKey(item.kind, item.scope.node);
  const actual = report.items.map(keyOf);
  const expected = prediction.items.map((item) =>
    itemKey(item.kind, item.scope),
  );
  const seen = new Set<string>();
  for (const key of actual) {
    if (seen.has(key)) {
      fail(
        `${context}: the session holds two items of the kind and scope node ` +
          `${json(key)} — a session never contains two items with the same ` +
          `kind and scope node (SPEC 10.1, 10.5); the session's items: ` +
          `${json(actual)}`,
      );
    }
    seen.add(key);
  }
  const missing = expected.filter((key) => !seen.has(key));
  const expectedSet = new Set(expected);
  const extra = actual.filter((key) => !expectedSet.has(key));
  if (missing.length > 0 || extra.length > 0) {
    fail(
      `${context}: \`review create --base\` must yield exactly the items ` +
        `SPEC 10.5's path-blocks strategy derives from the two graphs, ` +
        `identities mapped through the journal suffix — the oracle's kinds ` +
        `and scope nodes — but the session ${missing.length > 0 ? `lacks ${json(missing)}` : ""}` +
        `${missing.length > 0 && extra.length > 0 ? " and " : ""}` +
        `${extra.length > 0 ? `holds ${json(extra)} beyond them` : ""}; the ` +
        `oracle's items, in item order: ${json(expected)}; the session's: ` +
        `${json(actual)}`,
    );
  }
  if (actual.some((key, index) => key !== expected[index])) {
    fail(
      `${context}: \`review export\` must present the items in SPEC 10.5's ` +
        `item order — requirement-scoped items by scope-node depth deepest ` +
        `first, then kind (subtree-coherence, metadata-consistency, ` +
        `dependency-consistency, parent-consistency), then scope-node file ` +
        `path, then document order, absent scope nodes after present ones ` +
        `by identity; code-impact items last by location identity — ` +
        `expected ${json(expected)}, presented ${json(actual)}`,
    );
  }
  const keyById = new Map(report.items.map((item) => [item.id, keyOf(item)]));
  report.items.forEach((item, index) => {
    const want = prediction.items[index];
    const where =
      `${context}: item ${String(index + 1)} of ${String(report.items.length)} ` +
      `(${json(item.id)}: ${keyOf(item)})`;
    if (item.scope.present !== want.scopePresent) {
      fail(
        `${where}: its scope node must be presented ` +
          `${want.scopePresent ? "present" : "absent — deleted since the baseline, under its baseline identity mapped forward through the journal"} ` +
          `(SPEC 10.4, 10.5), but it is presented ` +
          `${item.scope.present ? "present" : "absent"}`,
      );
    }
    // A subtree-coherence item's scope is a subtree, every node of which the
    // payload presents (10.7) in its scope-node list, required
    // (`requireScopeNodes`, H-3); every other kind's is its scope node alone
    // (10.5), which `scope` presents — a scope-node list, where the payload
    // carries one, must then hold that node alone (compared below).
    const scopeNodes =
      item.kind === "subtree-coherence"
        ? requireScopeNodes(item, where)
        : (item.scopeNodes ?? [item.scope]);
    const scopeSet = sortedBytes(scopeNodes.map((node) => node.node));
    if (json(scopeSet) !== json(want.scopeSet)) {
      fail(
        `${where}: its scope set must be exactly ${json(want.scopeSet)} ` +
          `(SPEC 10.5: ${item.kind === "subtree-coherence" ? "the visited node and all its descendants — present nodes under their current parents, deleted ones under their baseline parents" : "the scope node alone"}), ` +
          `but the payload presents ${json(scopeSet)}`,
      );
    }
    for (const node of scopeNodes) {
      const absent = prediction.absent.has(node.node);
      if (node.present === absent) {
        fail(
          `${where}: the scope node ${json(node.node)} must be presented ` +
            `${absent ? "absent (deleted since the baseline)" : "present"} ` +
            `(SPEC 10.4), but it is presented ${node.present ? "present" : "absent"}`,
        );
      }
    }
    const contextSet = sortedBytes(item.context.map((node) => node.node));
    if (json(contextSet) !== json(want.context)) {
      fail(
        `${where}: its context must be exactly ${json(want.context)} (SPEC ` +
          `10.5), but the payload presents ${json(contextSet)}`,
      );
    }
    const origin = item.origin.map((entry) => entry.node);
    const originSet = new Set(origin);
    if (originSet.size !== origin.length) {
      fail(
        `${where}: its origin names a node twice — ${json(origin)} — the ` +
          `origin is a set of originating nodes (SPEC 10.2, 10.5)`,
      );
    }
    const lacking = want.origin.filter((node) => !originSet.has(node));
    const tolerated = new Set([...want.origin, ...want.originOptional]);
    const unfounded = sortedBytes(
      origin.filter((node) => !tolerated.has(node)),
    );
    if (lacking.length > 0 || unfounded.length > 0) {
      fail(
        `${where}: its origin must hold exactly the originating nodes SPEC ` +
          `10.5 assigns — ${json(want.origin)}` +
          `${want.originOptional.length > 0 ? `, ${json(want.originOptional)} tolerated present or absent (the oracle's two-sided readings)` : ""} ` +
          `— but the payload presents ${json(sortedBytes(origin))}` +
          `${lacking.length > 0 ? `, lacking ${json(lacking)}` : ""}` +
          `${unfounded.length > 0 ? `, holding ${json(unfounded)} on no ground` : ""}`,
      );
    }
    const blockers = sortedBytes(
      [...new Set(item.blockedBy)].map((id) => {
        const key = keyById.get(id);
        if (key === undefined) {
          return fail(
            `${where}: its blockedBy names ${json(id)}, which is no item of ` +
              `the session (SPEC 10.1: blockedBy names only item ids present ` +
              `in the session)`,
          );
        }
        return key;
      }),
    );
    if (json(blockers) !== json(want.blockedBy)) {
      fail(
        `${where}: its blockedBy must name exactly the items ` +
          `${json(want.blockedBy)} (SPEC 10.5: a parent-consistency item is ` +
          `blocked, per changed branch, by the item whose scope node is the ` +
          `branch's child — its subtree-coherence item when visited, else its ` +
          `parent-consistency item; every other item by none), but it names ` +
          `${json(blockers)}`,
      );
    }
  });
}

// ---------------------------------------------------------------------------
// The body

/**
 * A trial's workspace declaration: the configuration (a staged-source record)
 * beside the rendered sources, every `.mdx` and code source declared per draw
 * — judged by the property runner before the body saw the draw
 * (`drawSources`; S-9), as every initial source a trial stages after the
 * body's first product invocation must be (helpers/workspace.ts).
 */
function drawWorkspace(
  rendered: Readonly<Record<string, string>>,
): WorkspaceDecl {
  const files = { "xspec.config.ts": P16_CONFIG, ...rendered };
  return {
    files,
    mdx: { perDraw: mdxPathsOf(files) },
    ts: { perDraw: tsPathsOf(files) },
  };
}

/** Stage one draw-composed source (judged per draw; `per-draw`). */
async function stageDrawSource(
  workspace: TestWorkspace,
  path: string,
  text: string,
): Promise<void> {
  await workspace.file(
    path,
    text,
    path.endsWith(".mdx") ? { mdx: "per-draw" } : { ts: "per-draw" },
  );
}

async function runP16Trial(
  product: ProductBinding,
  trial: P16Trial,
): Promise<void> {
  // The full prediction is computed before any product invocation: a
  // staging outside the oracle's input space throws here as a harness
  // defect (H-8), never a diagnosed product failure.
  const { prediction } = predictP16Trial(trial);
  const state = initState(trial.initial);
  let files = renderP16Sources(state);
  const workspace = await TestWorkspace.create(drawWorkspace(files));
  try {
    await workspace.gitInit();
    const base = await workspace.gitCommitAll("P-16 baseline");
    await buildOk(
      product,
      workspace,
      "P-16: `build` of the generated workspace (the generator stages only " +
        "valid workspaces)",
    );
    const history: string[] = [];
    for (const [index, step] of trial.steps.entries()) {
      const applied = applyP16Step(state, step);
      const after = renderP16Sources(state);
      if (applied.argv !== null) {
        await expectExit(
          product,
          workspace,
          applied.argv,
          0,
          `P-16 step ${String(index + 1)}: \`${applied.argv.join(" ")}\` on a ` +
            `valid workspace, drawn so that the operation is one the product ` +
            `performs (SPEC 6.4, 6.5; module header)`,
        );
        // The model's rendering stands after the operation (module header).
        for (const [path, text] of Object.entries(after)) {
          await stageDrawSource(workspace, path, text);
        }
      } else {
        for (const [path, text] of Object.entries(after)) {
          if (files[path] !== text)
            await stageDrawSource(workspace, path, text);
        }
        for (const path of Object.keys(files)) {
          if (!(path in after)) await fsp.rm(workspace.path(path));
        }
      }
      files = after;
      history.push(applied.description);
    }
    await buildOk(
      product,
      workspace,
      "P-16: final `build` before `review create` (the P-6 protocol)",
    );
    const context = `P-16 — after: ${history.join("; ") || "no steps"} —`;
    await expectExit(
      product,
      workspace,
      ["review", "create", "--base", base, "--name", P16_SESSION],
      0,
      `${context} \`review create --base <baseline> --name ${P16_SESSION}\``,
    );
    const label = `${context} \`review export ${P16_SESSION} --json\``;
    const report = decodeExportReport(
      await runJson(
        product,
        workspace,
        ["review", "export", P16_SESSION, "--json"],
        label,
      ),
      label,
    );
    assertP16Export(report, prediction, label);
  } finally {
    await workspace.dispose();
  }
}

/** Counterexample rendering: the baseline's staged sources and the steps. */
function renderP16Trial(trial: P16Trial): string {
  return JSON.stringify({
    files: renderP16Sources(initState(trial.initial)),
    steps: trial.steps,
  });
}

// ---------------------------------------------------------------------------
// The registered property test

const P_16 = defineProductTest({
  id: "P-16",
  title:
    "property: path-blocks generation — random valid workspaces of spec and code sources " +
    "(nested sections, `d` references, `{text(...)}` embeddings, root-sourced ones included, " +
    "`coverage` and `tags` attributes, and code locations bearing markers and `text(...)` " +
    "calls), committed as a baseline and then changed by random interleavings of own-text, " +
    "metadata, and embedding edits, section and file additions and deletions, child " +
    "reorders, journaled renames, and journaled moves of both forms — the section-form " +
    "ones drawn under P-5's discipline, moves into another parent included — make " +
    "`review create --base` against that baseline yield exactly the items the path-blocks " +
    "oracle derives from P-6's graph-diff oracle and 9.2's impacted code over impact edges " +
    "in either graph: the same kinds and scope nodes in 10.5's item order, each item's " +
    "scope set, context, and origin exactly, and each item's `blockedBy` as the set of the " +
    "kinds and scope nodes of the items it names, scope nodes compared as canonical " +
    "identities and presented under their current identities; `reason` and the recorded " +
    "hashes not compared (SPEC 5.6, 6.3, 9.2, 10.4, 10.5; TEST-SPEC §16 P-16)",
  run: async (product) => {
    await checkProperty(
      "P-16 path-blocks generation",
      genP16Trial,
      async (trial) => {
        await runP16Trial(product, trial);
      },
      {
        runs: P16_RUNS,
        maxShrinkExecutions: 60,
        render: renderP16Trial,
        drawSources: stagedP16Sources,
      },
    );
  },
});

/** TEST-SPEC §16 P-16 (PROP-16). */
export const section16P16Tests: readonly ProductTestEntry[] = [P_16];
