// Workspace graph assembly (SPEC 5.1–5.3).
//
// Pure core (IMPLEMENTATION Architecture: graph construction is core —
// deterministic, I/O-free): over the analyzed spec sources (parsed
// documents with their import and reference models) and the analyzed code
// sources, this module assembles the project-wide graph (SPEC 5):
//
// - nodes — requirement nodes and code locations (SPEC 5.1), identified per
//   SPEC 1.5 (`path#id`, bare path for a file's root) and SPEC 4.6
//   (`path`, `path#unit`, `path#unit@N`), paths workspace-relative and
//   `/`-separated on every platform;
// - edges — `contains`, `depends`, `embeds`, `references` (SPEC 5.2), each
//   kind a set: duplicate declarations collapse to a single edge;
// - reference resolution — every `d` reference, `{text(...)}` target, and
//   TypeScript reference is resolved; unknown targets report 14.5, 14.6,
//   and 14.7. Masking (SPEC 14): a reference into an unparseable file
//   reports as unresolved here while the file's internal conditions stay
//   masked behind its own 14.20;
// - reference occurrences (SPEC 5.7) — one record per textual spelling of
//   a dependency-kind reference whose target resolves, in occurrence
//   order: the positions behind the collapsed edge set;
// - cycles (SPEC 5.3 → 14.9) — dependency cycles over the combined
//   `contains`+`depends`+`embeds` graph on requirement nodes (a
//   self-`depends`/self-`embeds` is a cycle of length one; a section
//   depending on or embedding its own ancestor closes a cycle through the
//   `contains` chain), and spec import cycles (SPEC 2.1; a self-import is a
//   cycle of length one — the import itself, used or not, creates the
//   file-level relation). Each cycle is reported with its full path.
//
// The graph is assembled for every workspace, valid or not, so that every
// detectable condition is reported (SPEC 14: each present condition, not
// only the first); sections without a usable identity (their 14.1/14.3/
// 14.17 accounts for them) simply contribute no identified node and no
// edges. Only valid workspaces ever surface graph content (SPEC 12.1,
// 13.3).

import { compareBytes, sortByBytes, utf8Length } from "./bytes.js";
import type { ByteRange } from "./bytes.js";
import type { CodeAnalysis } from "./code-analysis.js";
import type { Finding, FindingLocation } from "./findings.js";
import { compareFindings, locatedFinding } from "./findings.js";
import type { SpecDocument, SpecEmbedding, SpecSection } from "./mdx.js";
import { definedIdentitySections } from "./mdx.js";
import type { PathText } from "./path-text.js";
import { comparePathTexts, pathTextKey, renderPathText } from "./path-text.js";
import type {
  ReferenceTarget,
  SpecImportModel,
  SpecReferenceModel,
} from "./spec-references.js";
import type { EmbeddingResolver } from "./text-model.js";

// ---------------------------------------------------------------------------
// The graph model
// ---------------------------------------------------------------------------

/** A requirement node (SPEC 5.1): a section or a file's implicit root. */
export interface RequirementNode {
  readonly kind: "requirement";
  /** SPEC 1.5: `path#id`, or the bare path for the root node. */
  readonly identity: string;
  /** Workspace-relative `/`-separated source file path (SPEC 1.5). */
  readonly path: string;
  /** The requirement ID — null exactly for the root node (SPEC 1.2). */
  readonly id: string | null;
  readonly document: SpecDocument;
  readonly section: SpecSection;
}

/** A code location (SPEC 5.1, 4.6): a whole file or a named code unit. */
export interface CodeLocationNode {
  readonly kind: "code";
  /** SPEC 4.6: `path`, `path#unit`, or `path#unit@N`. */
  readonly identity: string;
  /** Workspace-relative `/`-separated code file path (SPEC 1.5). */
  readonly path: string;
  /**
   * SPEC 1.7: the location's source range — the entire file for a
   * whole-file location, the construct binding the unit's name for a
   * named unit (CodeUnit.range). Presented in exactly two outputs —
   * occurrence records (5.7, 11.3) and review payloads (10.7); everywhere
   * else a code location remains a bare identity (SPEC 1.7).
   */
  readonly range: ByteRange;
}

export type GraphNode = RequirementNode | CodeLocationNode;

/** SPEC 5.2: the four edge kinds. */
export type GraphEdgeKind = "contains" | "depends" | "embeds" | "references";

/**
 * SPEC 5.2: the dependency edge kinds — an edge of these kinds means the
 * source depends on the target; `contains` is structural.
 */
export const DEPENDENCY_EDGE_KINDS: readonly GraphEdgeKind[] = [
  "depends",
  "embeds",
  "references",
];

/** One edge of the graph, endpoints as graph-node identities (SPEC 5.2). */
export interface GraphEdge {
  readonly kind: GraphEdgeKind;
  /** Source identity: a requirement node or (embeds/references) a code location. */
  readonly source: string;
  /** Target identity: always a requirement node. */
  readonly target: string;
}

/** SPEC 5.2/5.7: the dependency edge kinds — the kinds occurrences record. */
export type DependencyEdgeKind = Exclude<GraphEdgeKind, "contains">;

/**
 * SPEC 5.7: one reference occurrence — one textual spelling of a
 * dependency-kind reference whose target resolves (SPEC 11.2): each `d`
 * array entry separately (2.2), each MDX `{text(...)}` embedding (2.3),
 * each TypeScript `text(...)` call (4.3), and each TypeScript dependency
 * marker (4.5). Edges are sets; occurrences are the positions behind them
 * — duplicate references collapsing to a single edge each remain distinct
 * occurrences. A construct that records no edge records no occurrence.
 */
export interface ReferenceOccurrence {
  /**
   * The referencing file's real path (SPEC 12.0, 12.7 path value form
   * capable — the marked byte form for an invalid-path file's occurrence,
   * SPEC 14.19; such occurrences arise only on failing workspaces).
   */
  readonly file: PathText;
  /**
   * The occurrence's own span (SPEC 5.7), exact per kind: a `d` reference's
   * own expression; an MDX embedding's entire braced container, opening
   * brace through closing brace; a TS `text(...)` call's entire call
   * expression, callee through closing parenthesis; a marker's bare
   * reference chain, exclusive of any statement terminator.
   */
  readonly range: ByteRange;
  readonly kind: DependencyEdgeKind;
  /**
   * The source graph node's identity — null exactly where SPEC 11.2 leaves
   * the containing node's identity undefined (a section without a usable
   * identity; every node of an invalid-path file, SPEC 14.19): the source
   * datum is then reported explicitly unavailable (SPEC 5.7). The datum's
   * other half — the source node's own range (SPEC 1.7) — travels with the
   * identified node itself (a requirement node's section range; a code
   * location's range), joined at presentation (SPEC 11.3, 12.7).
   */
  readonly source: string | null;
  /** The resolved target's identity (SPEC 1.5) — always a requirement node. */
  readonly target: string;
}

/** One parsed spec source with its per-file analyses (T6–T8 outputs). */
export interface SpecFileAnalysis {
  readonly document: SpecDocument;
  readonly imports: SpecImportModel;
  readonly references: SpecReferenceModel;
}

/**
 * The graph builder's inputs: the parseable discovered sources' analyses.
 * Unparseable discovered sources (SPEC 14.20) contribute nothing here —
 * their own 14.20 finding is the caller's — and references designating
 * them (their paths were discovered, so import validation accepted the
 * specifier) resolve to nothing, reporting 14.5–14.7 (SPEC 14 masking).
 * Input order does not matter: the builder orders everything itself
 * (SPEC 12.0 determinism).
 */
export interface WorkspaceGraphInputs {
  readonly specs: readonly SpecFileAnalysis[];
  readonly code: readonly CodeAnalysis[];
  /**
   * Per-file analyses of discovered spec sources whose own paths are
   * invalid (SPEC 14.19, 11.2): they contribute no nodes and no edges —
   * no identity of theirs is defined — but their references are resolved
   * here on their own terms (a reference out of such a file into a
   * defined identity resolves finding-free; anything else reports
   * 14.5/14.6) and their imports participate in the file-level import
   * relation (spec import cycles, SPEC 2.1 → 14.9).
   */
  readonly invalidPathSpecs?: readonly SpecFileAnalysis[];
  /** The code-source counterpart: references resolve or report 14.7. */
  readonly invalidPathCode?: readonly CodeAnalysis[];
}

// ---------------------------------------------------------------------------
// The assembled graph
// ---------------------------------------------------------------------------

/** SPEC 5.2 listing order, used for deterministic edge ordering. */
const EDGE_KIND_RANK: Readonly<Record<GraphEdgeKind, number>> = {
  contains: 0,
  depends: 1,
  embeds: 2,
  references: 3,
};

interface GraphParts {
  readonly requirementNodes: readonly RequirementNode[];
  readonly codeLocations: readonly CodeLocationNode[];
  readonly edges: readonly GraphEdge[];
  readonly occurrences: readonly ReferenceOccurrence[];
  readonly findings: readonly Finding[];
  readonly requirementIndex: ReadonlyMap<string, RequirementNode>;
  readonly codeIndex: ReadonlyMap<string, CodeLocationNode>;
  readonly sectionIndex: ReadonlyMap<SpecSection, RequirementNode>;
  readonly embeddingIndex: ReadonlyMap<SpecEmbedding, RequirementNode | null>;
}

/**
 * The assembled workspace graph (SPEC 5). Node lists are ordered by file
 * path (byte order, SPEC 12.0) and within a file by document order, the
 * root (or the whole-file code location) first; `edges` is the collapsed
 * edge set (SPEC 5.2) ordered by (source, kind, target); `occurrences`
 * holds every reference occurrence (SPEC 5.7) in occurrence order —
 * referencing file path bytes, then range start, then range end;
 * `findings` holds the graph's own conditions — unresolved references
 * (14.5–14.7) and cycles (14.9) — deterministically ordered. Everything
 * else (structural, prop, import, argument, and code-usage findings)
 * belongs to the per-file analyses this graph was built from.
 */
export class WorkspaceGraph {
  readonly requirementNodes: readonly RequirementNode[];
  readonly codeLocations: readonly CodeLocationNode[];
  readonly edges: readonly GraphEdge[];
  readonly occurrences: readonly ReferenceOccurrence[];
  readonly findings: readonly Finding[];

  private readonly requirementIndex: ReadonlyMap<string, RequirementNode>;
  private readonly codeIndex: ReadonlyMap<string, CodeLocationNode>;
  private readonly sectionIndex: ReadonlyMap<SpecSection, RequirementNode>;
  private readonly embeddingIndex: ReadonlyMap<
    SpecEmbedding,
    RequirementNode | null
  >;
  private readonly outgoingIndex: ReadonlyMap<string, readonly GraphEdge[]>;
  private readonly incomingIndex: ReadonlyMap<string, readonly GraphEdge[]>;

  constructor(parts: GraphParts) {
    this.requirementNodes = parts.requirementNodes;
    this.codeLocations = parts.codeLocations;
    this.edges = parts.edges;
    this.occurrences = parts.occurrences;
    this.findings = parts.findings;
    this.requirementIndex = parts.requirementIndex;
    this.codeIndex = parts.codeIndex;
    this.sectionIndex = parts.sectionIndex;
    this.embeddingIndex = parts.embeddingIndex;
    const outgoing = new Map<string, GraphEdge[]>();
    const incoming = new Map<string, GraphEdge[]>();
    for (const edge of parts.edges) {
      // Built from the sorted edge list, so each per-identity list keeps
      // the (source, kind, target) order (SPEC 12.0 determinism).
      let out = outgoing.get(edge.source);
      if (out === undefined) outgoing.set(edge.source, (out = []));
      out.push(edge);
      let inc = incoming.get(edge.target);
      if (inc === undefined) incoming.set(edge.target, (inc = []));
      inc.push(edge);
    }
    this.outgoingIndex = outgoing;
    this.incomingIndex = incoming;
  }

  /** The requirement node bearing `identity` (SPEC 1.5), if any. */
  requirementNode(identity: string): RequirementNode | undefined {
    return this.requirementIndex.get(identity);
  }

  /** The code location bearing `identity` (SPEC 4.6), if any. */
  codeLocation(identity: string): CodeLocationNode | undefined {
    return this.codeIndex.get(identity);
  }

  /** Any graph node bearing `identity` — requirement nodes shadow nothing:
   * spec and code paths are disjoint (SPEC 7.2 → 14.14). */
  node(identity: string): GraphNode | undefined {
    return this.requirementIndex.get(identity) ?? this.codeIndex.get(identity);
  }

  /**
   * The requirement node built for `section` — undefined for a section
   * without a usable identity (no `id`, or a duplicate; SPEC 14.1, 14.3).
   */
  nodeOfSection(section: SpecSection): RequirementNode | undefined {
    return this.sectionIndex.get(section);
  }

  /** The structural parent node — null for a root (SPEC 1.2). */
  parentOf(node: RequirementNode): RequirementNode | null {
    const parent = node.section.parent;
    if (parent === null) return null;
    return this.sectionIndex.get(parent) ?? null;
  }

  /** The child nodes in document order (SPEC 5.2 `contains`). */
  childrenOf(node: RequirementNode): RequirementNode[] {
    const children: RequirementNode[] = [];
    for (const section of node.section.children) {
      const child = this.sectionIndex.get(section);
      if (child !== undefined) children.push(child);
    }
    return children;
  }

  /**
   * The resolved target of one analyzed `{text(...)}` embedding (SPEC 2.3)
   * — null when the embedding yields no resolvable target (its 14.6/14.8
   * accounts for it, or its import's 14.15 masks it).
   */
  embeddingTarget(embedding: SpecEmbedding): RequirementNode | null {
    return this.embeddingIndex.get(embedding) ?? null;
  }

  /**
   * The graph as a text-model resolver (SPEC 3, 1.6): resolves the
   * embeddings of exactly the documents this graph was built over.
   */
  embeddingResolver(): EmbeddingResolver {
    return (_document, embedding) => {
      const target = this.embeddingIndex.get(embedding);
      if (target === undefined || target === null) return null;
      return { document: target.document, section: target.section };
    };
  }

  /** The edges leaving `identity`, in (source, kind, target) order. */
  outgoingEdges(identity: string): readonly GraphEdge[] {
    return this.outgoingIndex.get(identity) ?? [];
  }

  /** The edges reaching `identity`, in (source, kind, target) order. */
  incomingEdges(identity: string): readonly GraphEdge[] {
    return this.incomingIndex.get(identity) ?? [];
  }
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

/** How one reference resolution ended. */
type Resolution =
  | { readonly ok: true; readonly node: RequirementNode }
  | { readonly ok: false; readonly reason: string };

/** Assemble the workspace graph (SPEC 5.1–5.3; see the module header). */
export function buildWorkspaceGraph(
  inputs: WorkspaceGraphInputs,
): WorkspaceGraph {
  // SPEC 12.0: deterministic by construction — files in byte order of
  // workspace-relative path, content in document order.
  const specs = sortByBytes(inputs.specs, (spec) => spec.document.path);
  const code = sortByBytes(inputs.code, (analysis) => analysis.path);
  const invalidPathSpecs = inputs.invalidPathSpecs ?? [];
  const invalidPathCode = inputs.invalidPathCode ?? [];

  // --- requirement nodes (SPEC 5.1, 1.5) ----------------------------------
  const requirementNodes: RequirementNode[] = [];
  const requirementIndex = new Map<string, RequirementNode>();
  const sectionIndex = new Map<SpecSection, RequirementNode>();
  /** Per document: declared ID → its node (first declaration wins). */
  const idIndex = new Map<SpecDocument, Map<string, RequirementNode>>();
  const parsedByPath = new Map<string, SpecFileAnalysis>();

  for (const spec of specs) {
    const document = spec.document;
    parsedByPath.set(document.path, spec);
    const ids = new Map<string, RequirementNode>();
    idIndex.set(document, ids);
    // SPEC 1.2/1.5: the implicit root, identified by the path alone,
    // precedes every section of its file.
    const root: RequirementNode = {
      kind: "requirement",
      identity: document.path,
      path: document.path,
      id: null,
      document,
      section: document.root,
    };
    requirementNodes.push(root);
    requirementIndex.set(root.identity, root);
    sectionIndex.set(document.root, root);
    // SPEC 11.2/1.5: only defined node identities are formed, emitted, or
    // resolved against — a section spelling no identity, a malformed or
    // structurally invalid spelling (or one anywhere in its chain), and
    // every bearer of a duplicated spelling (no winner picked) contribute
    // no identified node; their findings (14.1–14.4, 14.17) account for
    // them, and references to them report as unresolved (14.5–14.7).
    const definedSections = definedIdentitySections(document);
    for (const section of document.sections) {
      if (section.id === null || !definedSections.has(section)) {
        continue;
      }
      // SPEC 1.5: `path#id`; the `#` is unambiguous because discovered
      // paths never contain `#` (14.19), and definedness makes the
      // identity unique within the file (SPEC 11.2).
      const identity = `${document.path}#${section.id}`;
      const node: RequirementNode = {
        kind: "requirement",
        identity,
        path: document.path,
        id: section.id,
        document,
        section,
      };
      requirementNodes.push(node);
      requirementIndex.set(identity, node);
      sectionIndex.set(section, node);
      ids.set(section.id, node);
    }
  }

  // --- code locations (SPEC 5.1, 4.6) --------------------------------------
  const codeLocations: CodeLocationNode[] = [];
  const codeIndex = new Map<string, CodeLocationNode>();
  for (const analysis of code) {
    // The whole file is a code location; its named units follow in
    // document order, already `@N`-disambiguated (SPEC 4.6).
    const file: CodeLocationNode = {
      kind: "code",
      identity: analysis.path,
      path: analysis.path,
      // SPEC 1.7: a whole-file location's range spans the entire file —
      // the analyzed text is the file's exact bytes decoded (SPEC 1.6),
      // so its UTF-8 length is the file's byte length.
      range: { start: 0, end: utf8Length(analysis.text) },
    };
    codeLocations.push(file);
    codeIndex.set(file.identity, file);
    for (const unit of analysis.units) {
      if (codeIndex.has(unit.identity)) continue; // defensive: identities are unique
      const node: CodeLocationNode = {
        kind: "code",
        identity: unit.identity,
        path: analysis.path,
        // SPEC 1.7: the construct binding the unit's name.
        range: unit.range,
      };
      codeLocations.push(node);
      codeIndex.set(node.identity, node);
    }
  }

  // --- edges (SPEC 5.2): each kind a set — duplicates collapse -------------
  const edgeByKey = new Map<string, GraphEdge>();
  const addEdge = (
    kind: GraphEdgeKind,
    source: string,
    target: string,
  ): void => {
    const key = `${kind}\u0000${source}\u0000${target}`;
    if (!edgeByKey.has(key)) edgeByKey.set(key, { kind, source, target });
  };

  // SPEC 5.2: `contains` — parent section → child section (document
  // structure, the root included, SPEC 1.2).
  for (const spec of specs) {
    for (const section of spec.document.sections) {
      const node = sectionIndex.get(section);
      if (node === undefined) continue;
      const parent =
        section.parent === null ? undefined : sectionIndex.get(section.parent);
      if (parent === undefined) continue;
      addEdge("contains", parent.identity, node.identity);
    }
  }

  const findings: Finding[] = [];
  const resolution = new Resolver(parsedByPath, requirementIndex, idIndex);

  // SPEC 5.7: one occurrence per textual spelling of a dependency-kind
  // reference whose target resolves — recorded beside edge recording, so a
  // construct that records no edge records no occurrence, while a resolving
  // spelling whose SOURCE node has no defined identity (SPEC 11.2) still
  // records one, its source datum explicitly unavailable (null).
  const occurrences: ReferenceOccurrence[] = [];
  const addOccurrence = (
    file: PathText,
    range: ByteRange,
    kind: DependencyEdgeKind,
    source: string | null,
    target: string,
  ): void => {
    occurrences.push({ file, range, kind, source, target });
  };

  // The reference spellings behind each requirement-side dependency edge
  // (SPEC 5.7 spans), keyed source → target: a cycle locates its full path
  // in source through every spelling recording a participating edge
  // (SPEC 14 location cardinality, 14.9).
  const edgeSpellings = new Map<string, FindingLocation[]>();
  const addSpelling = (
    source: string,
    target: string,
    file: string,
    range: ByteRange,
  ): void => {
    const key = `${source}\u0000${target}`;
    let spellings = edgeSpellings.get(key);
    if (spellings === undefined) edgeSpellings.set(key, (spellings = []));
    spellings.push({ file, range });
  };

  // SPEC 5.2/2.2: `depends` — declared by the `d` prop; unknown targets
  // are 14.5.
  for (const spec of specs) {
    for (const dependency of spec.references.dependencies) {
      const resolved = resolution.resolve(
        spec.document,
        dependency.reference.target,
      );
      if (!resolved.ok) {
        findings.push(
          unresolvedFinding(
            5,
            spec.document.path,
            dependency.reference.range,
            `unknown dependency: the d reference to ` +
              `${resolution.describe(spec.document, dependency.reference.target)} ` +
              `does not resolve — ${resolved.reason}; declare the target ` +
              `section or correct the reference (SPEC 2.2, 14.5)`,
          ),
        );
        continue;
      }
      const source = sectionIndex.get(dependency.section);
      // SPEC 5.7: a `d` reference occurrence spans that one reference's own
      // expression — recorded whenever the target resolves, the source
      // datum unavailable where the declaring section has no defined
      // identity (SPEC 11.2).
      addOccurrence(
        spec.document.file,
        dependency.reference.range,
        "depends",
        source?.identity ?? null,
        resolved.node.identity,
      );
      if (source !== undefined) {
        addEdge("depends", source.identity, resolved.node.identity);
        // SPEC 5.7: a `d` reference's spelling spans its own expression.
        addSpelling(
          source.identity,
          resolved.node.identity,
          spec.document.path,
          dependency.reference.range,
        );
      }
    }
  }

  // SPEC 5.2/2.3: `embeds` from MDX `{text(...)}`; unknown targets are
  // 14.6. Every analyzed embedding gets a recorded target (or null) so the
  // text model can expand it (SPEC 3, 1.6).
  const embeddingIndex = new Map<SpecEmbedding, RequirementNode | null>();
  for (const spec of specs) {
    for (const embedded of spec.references.embeddings) {
      if (embedded.reference === null) {
        // No reference extracted: its 14.8 (or a masking 14.15) accounts
        // for it (SPEC 14).
        embeddingIndex.set(embedded.embedding, null);
        continue;
      }
      const resolved = resolution.resolve(
        spec.document,
        embedded.reference.target,
      );
      if (!resolved.ok) {
        embeddingIndex.set(embedded.embedding, null);
        // SPEC 14: a no-occurrence spelling of the MDX embedding form is
        // located by the full braced container, opening brace through
        // closing brace — the span its occurrence would occupy (5.7).
        findings.push(
          unresolvedFinding(
            6,
            spec.document.path,
            embedded.embedding.range,
            `unknown text target: the text(...) reference to ` +
              `${resolution.describe(spec.document, embedded.reference.target)} ` +
              `does not resolve — ${resolved.reason}; declare the target ` +
              `section or correct the reference (SPEC 2.3, 14.6)`,
          ),
        );
        continue;
      }
      embeddingIndex.set(embedded.embedding, resolved.node);
      const source = sectionIndex.get(embedded.embedding.section);
      // SPEC 5.7: an MDX embedding occurrence spans the entire braced
      // container, opening brace through closing brace — the innermost
      // containing section (the root included) is its source, unavailable
      // where that section has no defined identity (SPEC 11.2).
      addOccurrence(
        spec.document.file,
        embedded.embedding.range,
        "embeds",
        source?.identity ?? null,
        resolved.node.identity,
      );
      if (source !== undefined) {
        addEdge("embeds", source.identity, resolved.node.identity);
        // SPEC 5.7: an MDX embedding's spelling spans the entire braced
        // container, opening brace through closing brace.
        addSpelling(
          source.identity,
          resolved.node.identity,
          spec.document.path,
          embedded.embedding.range,
        );
      }
    }
  }

  // SPEC 5.2/4.3/4.5: `references` from TypeScript markers and `embeds`
  // from TypeScript `text(...)` calls; unknown targets are 14.7.
  for (const analysis of code) {
    for (const reference of analysis.references) {
      const resolved = resolution.resolveExternal(
        reference.modulePath,
        reference.segments,
      );
      if (!resolved.ok) {
        const construct =
          reference.kind === "references" ? "marker" : "text(...) argument";
        findings.push(
          unresolvedFinding(
            7,
            analysis.path,
            reference.range,
            `unknown TypeScript reference: the ${construct} referencing ` +
              `${describeExternal(reference.modulePath, reference.segments)} ` +
              `does not resolve — ${resolved.reason}; this is also a type ` +
              `error against the generated module; correct or remove the ` +
              `reference (SPEC 4.5, 14.7)`,
          ),
        );
        continue;
      }
      addEdge(reference.kind, reference.location, resolved.node.identity);
      // SPEC 5.7: a TS `text(...)` occurrence spans the entire call
      // expression, callee through closing parenthesis; a marker occurrence
      // spans the bare reference chain alone. The source is the attributed
      // code location (SPEC 4.6), whose identity is always defined for a
      // valid-path file (SPEC 11.2).
      addOccurrence(
        analysis.file,
        reference.occurrenceRange,
        reference.kind,
        reference.location,
        resolved.node.identity,
      );
    }
  }

  // --- references of invalid-path files (SPEC 14.19, 11.2) ----------------
  //
  // A discovered file whose own path is invalid contributes no nodes and
  // no edges — no identity of it is defined, and nothing resolves into it
  // — but its constructs are judged on their own terms (SPEC 11.2, 14):
  // its extracted references resolve against the defined identities, a
  // local reference (naming an ID in the invalid-path file itself) never
  // resolving, and each unresolved reference reports its 14.5/14.6/14.7
  // located in the file (marked byte form capable). A reference that DOES
  // resolve is finding-free and records its occurrence (SPEC 5.7), the
  // source datum explicitly unavailable — no identity of the referencing
  // file is defined (SPEC 14.19, 11.2).
  const invalidPathOutcome = (
    target: ReferenceTarget,
  ):
    | { readonly ok: true; readonly node: RequirementNode }
    | {
        readonly ok: false;
        readonly described: string;
        readonly reason: string;
      } => {
    if (target.kind === "local") {
      return {
        ok: false,
        described: `${JSON.stringify(target.idPath)} in this file`,
        reason:
          `the reference names an ID in this file, and no identity of ` +
          `this file is defined because its own path is invalid ` +
          `(SPEC 14.19, 11.2); rename the file to a valid source path`,
      };
    }
    const resolved = resolution.resolveExternal(
      target.modulePath,
      target.segments,
    );
    if (resolved.ok) return resolved;
    return {
      ok: false,
      described: describeExternal(target.modulePath, target.segments),
      reason: resolved.reason,
    };
  };
  for (const spec of invalidPathSpecs) {
    const file = spec.document.file;
    for (const dependency of spec.references.dependencies) {
      const outcome = invalidPathOutcome(dependency.reference.target);
      if (outcome.ok) {
        addOccurrence(
          file,
          dependency.reference.range,
          "depends",
          null,
          outcome.node.identity,
        );
        continue;
      }
      findings.push(
        locatedFinding(
          5,
          `unknown dependency: the d reference to ${outcome.described} ` +
            `does not resolve — ${outcome.reason}; declare the target ` +
            `section or correct the reference (SPEC 2.2, 14.5)`,
          [{ file, range: dependency.reference.range }],
        ),
      );
    }
    for (const embedded of spec.references.embeddings) {
      if (embedded.reference === null) {
        // No reference extracted: its 14.8 (or a masking 14.15) accounts
        // for it (SPEC 14); the text model expands it to nothing.
        embeddingIndex.set(embedded.embedding, null);
        continue;
      }
      const outcome = invalidPathOutcome(embedded.reference.target);
      if (outcome.ok) {
        // SPEC 5.7: the occurrence spans the entire braced container. The
        // resolved target also enters the embedding index: the text model
        // expands an invalid-path file's resolving embeddings exactly like
        // any other (SPEC 11.2 — a defined text value is exact on
        // imperfect files too), while the file still contributes no nodes
        // and no edges.
        embeddingIndex.set(embedded.embedding, outcome.node);
        addOccurrence(
          file,
          embedded.embedding.range,
          "embeds",
          null,
          outcome.node.identity,
        );
        continue;
      }
      embeddingIndex.set(embedded.embedding, null);
      // SPEC 14: an embedding-form finding's range is the full braced
      // container — the span its occurrence would occupy (5.7).
      findings.push(
        locatedFinding(
          6,
          `unknown text target: the text(...) reference to ` +
            `${outcome.described} does not resolve — ${outcome.reason}; ` +
            `declare the target section or correct the reference ` +
            `(SPEC 2.3, 14.6)`,
          [{ file, range: embedded.embedding.range }],
        ),
      );
    }
  }
  for (const analysis of invalidPathCode) {
    for (const reference of analysis.references) {
      const resolved = resolution.resolveExternal(
        reference.modulePath,
        reference.segments,
      );
      if (resolved.ok) {
        addOccurrence(
          analysis.file,
          reference.occurrenceRange,
          reference.kind,
          null,
          resolved.node.identity,
        );
        continue;
      }
      const construct =
        reference.kind === "references" ? "marker" : "text(...) argument";
      findings.push(
        locatedFinding(
          7,
          `unknown TypeScript reference: the ${construct} referencing ` +
            `${describeExternal(reference.modulePath, reference.segments)} ` +
            `does not resolve — ${resolved.reason}; correct or remove the ` +
            `reference (SPEC 4.5, 14.7)`,
          [{ file: analysis.file, range: reference.range }],
        ),
      );
    }
  }

  // SPEC 14/12.7: deterministic finding order.
  findings.sort(compareFindings);

  // The collapsed edge set, ordered (source, kind, target) — kinds in
  // SPEC 5.2 listing order (SPEC 12.0 determinism).
  const edges = [...edgeByKey.values()].sort(
    (a, b) =>
      compareBytes(a.source, b.source) ||
      EDGE_KIND_RANK[a.kind] - EDGE_KIND_RANK[b.kind] ||
      compareBytes(a.target, b.target),
  );

  // SPEC 5.7: occurrence order is total and deterministic — referencing
  // file path bytes (one byte order over both path forms, SPEC 12.0), then
  // range start, then range end. Distinct occurrences occupy distinct
  // spans, so no further tiebreak exists.
  occurrences.sort(
    (a, b) =>
      comparePathTexts(a.file, b.file) ||
      a.range.start - b.range.start ||
      a.range.end - b.range.end,
  );

  // --- cycles (SPEC 5.3, 2.1 → 14.9) ---------------------------------------
  findings.push(
    ...dependencyCycleFindings(
      requirementNodes,
      requirementIndex,
      edges,
      edgeSpellings,
    ),
  );
  findings.push(...importCycleFindings([...specs, ...invalidPathSpecs]));

  return new WorkspaceGraph({
    requirementNodes,
    codeLocations,
    edges,
    occurrences,
    findings,
    requirementIndex,
    codeIndex,
    sectionIndex,
    embeddingIndex,
  });
}

/** One unresolved-reference finding (14.5/14.6/14.7). */
function unresolvedFinding(
  condition: 5 | 6 | 7,
  file: string,
  range: ByteRange,
  message: string,
): Finding {
  return locatedFinding(condition, message, [{ file, range }]);
}

/** A human description of an external reference's target (messages only). */
function describeExternal(
  modulePath: string,
  segments: readonly string[],
): string {
  if (segments.length === 0) {
    // SPEC 2.2: the module itself targets that file's root node.
    return `the root node of ${JSON.stringify(modulePath)}`;
  }
  return JSON.stringify(`${modulePath}#${segments.join(".")}`);
}

/** Reference resolution against the parsed documents (SPEC 2.2, 2.3, 4.5). */
class Resolver {
  constructor(
    private readonly parsedByPath: ReadonlyMap<string, SpecFileAnalysis>,
    private readonly requirementIndex: ReadonlyMap<string, RequirementNode>,
    private readonly idIndex: ReadonlyMap<
      SpecDocument,
      ReadonlyMap<string, RequirementNode>
    >,
  ) {}

  /** Resolve one extracted reference of `document` (SPEC 2.2, 2.4). */
  resolve(document: SpecDocument, target: ReferenceTarget): Resolution {
    if (target.kind === "local") {
      // SPEC 2.2: the local form names an ID in the same file.
      const node = this.idIndex.get(document)?.get(target.idPath);
      if (node === undefined) {
        return {
          ok: false,
          reason:
            `no section with ID ${JSON.stringify(target.idPath)} exists ` +
            `in ${JSON.stringify(document.path)}`,
        };
      }
      return { ok: true, node };
    }
    return this.resolveExternal(target.modulePath, target.segments);
  }

  /**
   * Resolve an external reference: a chain rooted at an imported spec
   * module (SPEC 2.2, 2.4, 4.5). Zero segments target the file's root
   * node. Segments are matched as a sequence, never joined and re-split
   * (SPEC 2.4): a segment containing `.` can match no ID segment
   * (SPEC 1.4). A designated file that did not parse resolves to nothing:
   * its conditions are masked and the reference reports as unresolved
   * (SPEC 14, 14.20).
   */
  resolveExternal(modulePath: string, segments: readonly string[]): Resolution {
    const spec = this.parsedByPath.get(modulePath);
    if (spec === undefined) {
      return {
        ok: false,
        reason:
          `the referenced file ${JSON.stringify(modulePath)} could not be ` +
          `parsed (SPEC 14.20), so nothing in it resolves`,
      };
    }
    if (segments.length === 0) {
      const root = this.requirementIndex.get(modulePath);
      if (root === undefined) {
        // Unreachable: every parsed document registered its root.
        throw new Error(
          `xspec internal error: no root node for parsed ${modulePath}`,
        );
      }
      return { ok: true, node: root };
    }
    for (const segment of segments) {
      if (segment.includes(".")) {
        return {
          ok: false,
          reason:
            `the chain segment ${JSON.stringify(segment)} contains "." ` +
            `and can match no ID segment (SPEC 1.4, 2.4)`,
        };
      }
    }
    const id = segments.join(".");
    const node = this.idIndex.get(spec.document)?.get(id);
    if (node === undefined) {
      return {
        ok: false,
        reason:
          `no section with ID ${JSON.stringify(id)} exists in ` +
          JSON.stringify(modulePath),
      };
    }
    return { ok: true, node };
  }

  /** A human description of a reference's target (messages only). */
  describe(document: SpecDocument, target: ReferenceTarget): string {
    if (target.kind === "local") {
      return `${JSON.stringify(target.idPath)} in this file (${document.path})`;
    }
    return describeExternal(target.modulePath, target.segments);
  }
}

// ---------------------------------------------------------------------------
// Cycle detection (SPEC 5.3, 2.1 → 14.9)
// ---------------------------------------------------------------------------

/**
 * SPEC 5.3: dependency cycles over the combined graph of `contains`,
 * `depends`, and `embeds` edges on requirement nodes (`references` edges
 * and code-sourced `embeds` edges have code-location sources and do not
 * participate). One 14.9 finding per cyclic strongly connected component,
 * carrying a full cycle path within it — located in source through every
 * reference spelling recording a participating dependency edge (SPEC 14
 * location cardinality; `contains` steps arise from document structure and
 * spell nothing), the full identity path carried in the message.
 */
function dependencyCycleFindings(
  requirementNodes: readonly RequirementNode[],
  requirementIndex: ReadonlyMap<string, RequirementNode>,
  edges: readonly GraphEdge[],
  edgeSpellings: ReadonlyMap<string, readonly FindingLocation[]>,
): Finding[] {
  const adjacency = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (edge.kind === "references") continue;
    if (!requirementIndex.has(edge.source)) continue; // a code-sourced embeds
    let targets = adjacency.get(edge.source);
    if (targets === undefined)
      adjacency.set(edge.source, (targets = new Set()));
    targets.add(edge.target);
  }
  const identities = requirementNodes.map((node) => node.identity);
  const cycles = findCycles(identities, adjacency);
  return cycles.map((cycle) => {
    const start = requirementIndex.get(cycle[0]);
    if (start === undefined) {
      throw new Error("xspec internal error: cycle through an unknown node");
    }
    // SPEC 14/14.9: locate the cycle's full path in source — every
    // reference spelling recording a participating dependency edge (a
    // walk step covered only by `contains` contributes no spelling).
    const locations: FindingLocation[] = [];
    for (let step = 0; step + 1 < cycle.length; step += 1) {
      const spellings = edgeSpellings.get(
        `${cycle[step]}\u0000${cycle[step + 1]}`,
      );
      if (spellings !== undefined) locations.push(...spellings);
    }
    return locatedFinding(
      9,
      `dependency cycle: ${cycle.join(" → ")} — the combined ` +
        `contains/depends/embeds graph over requirement nodes must be ` +
        `acyclic; break the cycle by removing or retargeting one of its ` +
        `depends or embeds references (SPEC 5.3, 14.9)`,
      locations.length > 0
        ? locations
        : // Unreachable in practice — `contains` alone cannot cycle — but
          // a located condition must locate (SPEC 14): fall back to the
          // cycle's starting section.
          [{ file: start.path, range: start.section.range }],
    );
  });
}

/**
 * SPEC 2.1: spec import cycles — over each parsed file's valid imports'
 * designated files, whether or not the bindings are used (an unused
 * import records no edges, but the import itself still relates the
 * files). A file importing itself is a cycle of length one. The relation
 * is between FILES, so discovered spec sources whose own paths are
 * invalid (SPEC 14.19) participate — their imports were analyzed
 * (SPEC 11.2) and a valid import designates a member whatever that
 * member's path validity — and the walk therefore runs over exact path
 * bytes (SPEC 12.0), with every location and message path rendered from
 * the file's real path (marked byte form capable). One 14.9 finding per
 * cyclic component, locating each participating import declaration —
 * every import recording a step of the reported cycle (SPEC 14 location
 * cardinality), the full file path carried in the message.
 */
function importCycleFindings(specs: readonly SpecFileAnalysis[]): Finding[] {
  /** Byte key of one parsed file (both `PathText` forms, SPEC 12.0). */
  const keyed = new Map<string, SpecFileAnalysis>();
  for (const spec of specs) {
    keyed.set(pathTextKey(spec.document.file), spec);
  }
  const adjacency = new Map<string, Set<string>>();
  for (const spec of specs) {
    const sourceKey = pathTextKey(spec.document.file);
    for (const declared of spec.imports.imports) {
      if (declared.targetFile === null) continue;
      let targets = adjacency.get(sourceKey);
      if (targets === undefined) {
        adjacency.set(sourceKey, (targets = new Set()));
      }
      targets.add(pathTextKey(declared.targetFile));
    }
  }
  const cycles = findCycles([...keyed.keys()], adjacency);
  return cycles.map((cycle) => {
    const fileOf = (key: string): PathText => {
      const spec = keyed.get(key);
      if (spec === undefined) {
        throw new Error("xspec internal error: cycle through unknown file");
      }
      return spec.document.file;
    };
    // SPEC 14/14.9: locate each participating import declaration — for
    // every step of the closed walk, every import of the step's source
    // file designating the step's target (for a self-import cycle, the
    // self-designating imports).
    const locations: FindingLocation[] = [];
    for (let step = 0; step + 1 < cycle.length; step += 1) {
      const spec = keyed.get(cycle[step]);
      if (spec === undefined) continue;
      for (const declared of spec.imports.imports) {
        if (
          declared.targetFile !== null &&
          pathTextKey(declared.targetFile) === cycle[step + 1]
        ) {
          locations.push({
            file: spec.document.file,
            range: declared.statement.range,
          });
        }
      }
    }
    const renderedCycle = cycle
      .map((key) => renderPathText(fileOf(key)))
      .join(" → ");
    return locatedFinding(
      9,
      `spec import cycle: ${renderedCycle} — import cycles among ` +
        `spec source files are invalid, even when no requirement-level ` +
        `dependency cycle exists; remove one of the participating imports ` +
        `(SPEC 2.1, 14.9)`,
      locations.length > 0
        ? locations
        : // Unreachable — every step of a reported import cycle came from
          // a recorded import — but a located condition must locate
          // (SPEC 14).
          [{ file: fileOf(cycle[0]), range: { start: 0, end: 0 } }],
    );
  });
}

/**
 * Every cycle of the directed graph, one full closed path per cyclic
 * strongly connected component: for each component containing a cycle (more
 * than one node, or a self-loop), the shortest cycle through its
 * byte-least node, as a closed walk (first identity repeated at the end;
 * `[a, a]` for a self-loop). Results are ordered by starting identity.
 * Adjacency entries naming unknown nodes are ignored. Exported for the
 * `rename`/`move` refusal evaluation (core/refusal.ts), which runs the
 * same detection over the would-be post-operation graph (SPEC 6.5, 14
 * `refused-cycle`).
 */
export function findCycles(
  nodes: readonly string[],
  adjacency: ReadonlyMap<string, ReadonlySet<string>>,
): string[][] {
  const indexOf = new Map<string, number>();
  for (const node of nodes) {
    if (!indexOf.has(node)) indexOf.set(node, indexOf.size);
  }
  const ordered = [...indexOf.keys()];
  const neighborLists: number[][] = ordered.map(() => []);
  for (const [source, targets] of adjacency) {
    const sourceIndex = indexOf.get(source);
    if (sourceIndex === undefined) continue;
    const list = neighborLists[sourceIndex];
    for (const target of sortByBytes([...targets], (value) => value)) {
      const targetIndex = indexOf.get(target);
      if (targetIndex !== undefined) list.push(targetIndex);
    }
  }

  const cycles: string[][] = [];
  for (const component of stronglyConnectedComponents(neighborLists)) {
    const selfLoop =
      component.length === 1 &&
      neighborLists[component[0]].includes(component[0]);
    if (component.length === 1 && !selfLoop) continue;
    const members = component.map((index) => ordered[index]);
    cycles.push(shortestCycleWithin(members, ordered, indexOf, neighborLists));
  }
  return cycles.sort((a, b) => compareBytes(a[0], b[0]));
}

/**
 * The shortest cycle through the byte-least member of one cyclic strongly
 * connected component, as a closed walk. Deterministic: BFS with
 * byte-ordered adjacency; within a component every node reaches every
 * other, so a cycle through any member always exists.
 */
function shortestCycleWithin(
  members: readonly string[],
  ordered: readonly string[],
  indexOf: ReadonlyMap<string, number>,
  neighborLists: readonly (readonly number[])[],
): string[] {
  const inComponent = new Set(members.map((member) => indexOf.get(member)!));
  const startIdentity = sortByBytes(members, (member) => member)[0];
  const start = indexOf.get(startIdentity)!;
  if (neighborLists[start].includes(start)) {
    // A self-loop: a dependency cycle (or self-import) of length one.
    return [startIdentity, startIdentity];
  }
  const parent = new Map<number, number>();
  const queue: number[] = [start];
  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head];
    for (const next of neighborLists[current]) {
      if (!inComponent.has(next)) continue;
      if (next === start) {
        const path: string[] = [];
        for (let node = current; node !== start; node = parent.get(node)!) {
          path.push(ordered[node]);
        }
        path.reverse();
        return [startIdentity, ...path, startIdentity];
      }
      if (next !== start && !parent.has(next)) {
        parent.set(next, current);
        queue.push(next);
      }
    }
  }
  throw new Error(
    "xspec internal error: no cycle found within a cyclic component",
  );
}

/**
 * Tarjan's strongly-connected-components algorithm, iterative (deep
 * `contains`/`depends` chains must not overflow the call stack). Nodes are
 * integer indices into `neighborLists`; components come out in a
 * deterministic order given the input order.
 */
function stronglyConnectedComponents(
  neighborLists: readonly (readonly number[])[],
): number[][] {
  const count = neighborLists.length;
  const index = new Int32Array(count).fill(-1);
  const lowlink = new Int32Array(count);
  const onStack = new Uint8Array(count);
  const stack: number[] = [];
  const components: number[][] = [];
  let nextIndex = 0;

  const frameNode: number[] = [];
  const frameNext: number[] = [];
  for (let root = 0; root < count; root += 1) {
    if (index[root] !== -1) continue;
    frameNode.push(root);
    frameNext.push(0);
    while (frameNode.length > 0) {
      const node = frameNode[frameNode.length - 1];
      const position = frameNext[frameNext.length - 1];
      if (position === 0) {
        index[node] = nextIndex;
        lowlink[node] = nextIndex;
        nextIndex += 1;
        stack.push(node);
        onStack[node] = 1;
      }
      const neighbors = neighborLists[node];
      if (position < neighbors.length) {
        frameNext[frameNext.length - 1] = position + 1;
        const next = neighbors[position];
        if (index[next] === -1) {
          frameNode.push(next);
          frameNext.push(0);
        } else if (onStack[next] === 1 && index[next] < lowlink[node]) {
          lowlink[node] = index[next];
        }
      } else {
        frameNode.pop();
        frameNext.pop();
        if (lowlink[node] === index[node]) {
          const component: number[] = [];
          let member: number;
          do {
            member = stack.pop()!;
            onStack[member] = 0;
            component.push(member);
          } while (member !== node);
          components.push(component);
        }
        if (frameNode.length > 0) {
          const parent = frameNode[frameNode.length - 1];
          if (lowlink[node] < lowlink[parent]) {
            lowlink[parent] = lowlink[node];
          }
        }
      }
    }
  }
  return components;
}
