// The `rename`/`move` refusal contract (SPEC 6.4, 6.5, 14) — the pure
// evaluation.
//
// SPEC 14 (refusal-reason paragraph): each distinct reason `rename` and
// `move` refuse carries a stable code and, under the location-cardinality
// rule, the file, source range, or identity it concerns; a refused
// operation or preview reports EVERY applicable reason together, one
// finding per reason — never only the first found — each reason's
// applicability read on its own terms. This module evaluates all of them
// over a workspace passing `build`'s validations (the reasons are defined
// only there, SPEC 6.4/6.5 — the invalid-workspace refusal reports the
// workspace's numbered findings alone, upstream of this module) and
// returns the refusal findings as data (IMPLEMENTATION cross-cutting
// rules); the CLI renders them once per output form. `--preview` (SPEC
// 6.6) shares exactly this evaluation: a preview is refused exactly when —
// reporting what, and exiting as — the real operation would be.
//
// Pure core (IMPLEMENTATION Architecture): no I/O. The two filesystem
// facts a move's destination reasons need — what occupies the destination
// path, and which workspace-relative directory components of the
// destination-side write paths are occupied by non-directories — arrive as
// inputs, probed by the workspace layer (workspace/writes.ts) over exactly
// the paths `assessDestinationPath` names.
//
// The would-be reasons — `refused-cycle` and
// `refused-unresolvable-reference` — are evaluated over the post-operation
// workspace modeled in identity space (the current graph's nodes, edges,
// and occurrences with the operation's identity mapping applied, the
// section form's re-parenting included), never by reanalyzing rewritten
// text: the findings locate the participating reference spellings and
// import declarations at their CURRENT, pre-operation coordinates (SPEC
// 14: a refusal renders as precisely as a finding; 6.6: previews report in
// current, pre-operation coordinates).

import type { ByteRange } from "./bytes.js";
import { sortByBytes } from "./bytes.js";
import type { Configuration, ConfiguredGroup } from "./config.js";
import { specSourceDerivedPaths } from "./discovery.js";
import type { Finding, FindingLocation, RefusalCode } from "./findings.js";
import { sortLocations } from "./findings.js";
import { findCycles } from "./graph.js";
import type { SpecFileAnalysis, WorkspaceGraph } from "./graph.js";
import type { SpecSection } from "./mdx.js";
import type { PathText } from "./path-text.js";
import { replaceIdPrefix } from "./rename.js";
import {
  containsControl,
  containsWhitespace,
  FORBIDDEN_SEGMENT_NAMES,
} from "./text.js";

/**
 * Why `id` is not in intrinsic ID form (SPEC 14: one or more segments
 * joined by `.`, each satisfying 1.4), or null when it is. Splitting on
 * `.` makes the no-`.` rule structural; each segment must be non-empty,
 * free of `#`, whitespace, and control characters, and none of the
 * forbidden names. Shared by the refusal evaluation here and the CLI's
 * argument diagnostics (SPEC 6.4, 6.5).
 */
export function intrinsicIdProblem(id: string): string | null {
  for (const segment of id.split(".")) {
    if (segment.length === 0) {
      return "it has an empty segment";
    }
    if (FORBIDDEN_SEGMENT_NAMES.has(segment)) {
      return (
        `its segment ${JSON.stringify(segment)} is one of the forbidden ` +
        `names ("$", "__proto__", "prototype", "constructor", "then")`
      );
    }
    if (segment.includes("#")) {
      return `its segment ${JSON.stringify(segment)} contains "#"`;
    }
    if (containsWhitespace(segment)) {
      return `its segment ${JSON.stringify(segment)} contains whitespace`;
    }
    if (containsControl(segment)) {
      return `its segment ${JSON.stringify(segment)} contains a control character`;
    }
  }
  return null;
}

/** One refusal-reason finding (SPEC 14): stable code, concerned data. */
function refusalFinding(
  code: RefusalCode,
  message: string,
  parts: {
    readonly locations?: readonly FindingLocation[];
    readonly path?: string;
    readonly identities?: readonly string[];
  } = {},
): Finding {
  return {
    code,
    message,
    locations: sortLocations(parts.locations ?? []),
    path: parts.path ?? null,
    identities: parts.identities ?? [],
  };
}

// ---------------------------------------------------------------------------
// Destination-path assessment (SPEC 6.5: the destination-validity family)
// ---------------------------------------------------------------------------

/**
 * The pure half of `refused-invalid-destination` (SPEC 6.5, 14): whether a
 * destination path could be a valid discovered spec source at all, judged
 * from its spelling and the configuration alone, plus the derived paths it
 * would generate — the paths whose workspace-relative directory components
 * the workspace layer must probe for non-directory occupants (SPEC 6.5:
 * "or a workspace-relative directory component of the destination path,
 * or of a derived path it would generate, occupied by anything other than
 * a directory").
 */
export interface DestinationPathAssessment {
  /**
   * Why the path would not be a valid discovered spec source (SPEC 6.5 →
   * 7, 7.1, 14.19, 13.4), in a fixed evaluation order; empty when the
   * spelling and configuration accept it. However many causes hold, they
   * feed ONE `refused-invalid-destination` finding (SPEC 14: one finding
   * per reason).
   */
  readonly causes: readonly string[];
  /** The configured spec groups whose globs match the path (SPEC 7). */
  readonly specGroups: readonly string[];
  /**
   * Whether the path is a well-formed workspace-relative path that may be
   * probed on disk: a malformed spelling (absolute, `.`/`..` segments,
   * empty segments, non-UTF-8) is never resolved against the workspace
   * root, so no occupant or component probe runs for it.
   */
  readonly probeable: boolean;
  /**
   * The destination path together with the derived paths it would
   * generate (SPEC 13.1, 13.2, 7.3): the generated module and its
   * companions share the destination's directory, so probing the
   * destination's own components covers them; the Markdown emit
   * destination adds its own components while emission is enabled. The
   * workspace layer probes the directory components of exactly these.
   */
  readonly componentProbePaths: readonly string[];
}

/**
 * Why `destination` is not a well-formed workspace-relative source-path
 * shape (SPEC 1.5: workspace-relative, `/`-separated, no `.`/`..`
 * segments — the shape every discovered source path has), or null when it
 * is.
 */
function destinationShapeProblem(destination: string): string | null {
  if (destination.length === 0) {
    return "it is empty";
  }
  if (destination.startsWith("/")) {
    return "it is not workspace-relative (SPEC 1.5, 12.0)";
  }
  for (const segment of destination.split("/")) {
    if (segment === "") {
      return "it has an empty path segment";
    }
    if (segment === "." || segment === "..") {
      return (
        `it has a ${JSON.stringify(segment)} path segment — discovered ` +
        `source paths are workspace-relative without "." or ".." (SPEC 1.5)`
      );
    }
  }
  return null;
}

const utf8Encoder = new TextEncoder();

/** The configured groups whose globs match `bytes` (SPEC 7). */
function matchingGroups(
  groups: readonly ConfiguredGroup[],
  bytes: Uint8Array,
): string[] {
  const names: string[] = [];
  for (const group of groups) {
    if (group.globs.some((glob) => glob.matches(bytes))) {
      names.push(group.name);
    }
  }
  return names;
}

/**
 * Assess a move destination path (SPEC 6.5): the file form's `<new-file>`
 * or the section form's to-be-created `<target-file>`. `utf8` is whether
 * the argument value decoded as valid UTF-8 (cli/args.ts marks
 * undecodable argv with U+FFFD); a non-UTF-8 spelling is normally an
 * exit-2 usage error first (SPEC 12.0), leaving this cause a dead letter,
 * but the reason holds on its own terms (SPEC 14.19: such a path is never
 * a valid source path).
 */
export function assessDestinationPath(
  destination: string,
  utf8: boolean,
  configuration: Configuration,
): DestinationPathAssessment {
  const causes: string[] = [];
  if (!utf8) {
    causes.push(
      `the path is not valid UTF-8 — a discovered source file's ` +
        `workspace-relative path must be valid UTF-8 (SPEC 7, 14.19)`,
    );
  }
  if (destination.includes("#")) {
    causes.push(
      `the path contains "#", which node identities reserve (path#id) — ` +
        `it would never be a valid discovered spec source (SPEC 1.5, 14.19)`,
    );
  }
  const shape = destinationShapeProblem(destination);
  if (shape !== null) {
    causes.push(
      `the path is not a well-formed workspace-relative path: ${shape}`,
    );
  }
  if (causes.length > 0) {
    // Malformed spellings match no group and are never probed: a
    // `..`-bearing argument must not resolve outside the workspace root.
    return {
      causes,
      specGroups: [],
      probeable: false,
      componentProbePaths: [],
    };
  }

  const bytes = utf8Encoder.encode(destination);
  const specGroups = matchingGroups(configuration.specGroups, bytes);
  // SPEC 6.5: a path belonging to no configured spec group — a move never
  // takes a node out of the workspace.
  if (specGroups.length === 0) {
    causes.push(
      `the path belongs to no configured spec group — a move never takes ` +
        `a node out of the workspace; choose a destination a spec group's ` +
        `globs match (SPEC 7)`,
    );
  }
  // SPEC 6.5 → 7.2/14.14: belonging to a code group as well.
  const codeGroups = matchingGroups(configuration.codeGroups, bytes);
  if (specGroups.length > 0 && codeGroups.length > 0) {
    causes.push(
      `the path is matched by spec group ${JSON.stringify(specGroups[0]!)} ` +
        `and code group ${JSON.stringify(codeGroups[0]!)} alike — no file ` +
        `may belong to both a spec and a code group (SPEC 7.2, 14.14)`,
    );
  }
  // SPEC 6.5 → 7.1/14.19: lacking the `.mdx` extension.
  if (!destination.endsWith(".mdx")) {
    causes.push(
      `the path lacks the .mdx extension — every spec-group source must ` +
        `end ".mdx" (SPEC 7.1, 14.19)`,
    );
  }
  // SPEC 13.4: derived-file paths are never sources — a file name
  // containing `.xspec.` or a path under `.xspec/` is excluded from every
  // group, so such a destination would never be discovered. (A configured
  // Markdown emit destination always ends ".md" and can never collide
  // with a ".mdx" destination.)
  const fileName = destination.slice(destination.lastIndexOf("/") + 1);
  if (fileName.includes(".xspec.") || destination.startsWith(".xspec/")) {
    causes.push(
      `the path is a derived-file path (a file name containing ".xspec." ` +
        `or a path under ".xspec/") — derived-file paths are never ` +
        `discovered as sources (SPEC 13.4)`,
    );
  }

  // SPEC 6.5/13.1/13.2/7.3: the derived paths the destination would
  // generate. The module and companions share the destination's directory
  // (13.1: "in the source file's directory"), so the destination path
  // itself covers their components; the Markdown emit destination (13.2)
  // adds its own. `specSourceDerivedPaths` is total over any byte shape;
  // the destination is valid UTF-8 here, so its results are plain strings.
  const componentProbePaths: string[] = [destination];
  const derived = specSourceDerivedPaths(bytes, configuration);
  if (typeof derived.markdown === "string") {
    componentProbePaths.push(derived.markdown);
  }
  return { causes, specGroups, probeable: true, componentProbePaths };
}

/**
 * The one `refused-invalid-destination` finding (SPEC 14: one finding per
 * reason, concerning the destination path) over the pure causes and the
 * probed component obstructions — or null when the destination is valid.
 */
function invalidDestinationFinding(
  destination: string,
  causes: readonly string[],
  obstructedComponents: readonly string[],
): Finding | null {
  const all = [...causes];
  for (const component of obstructedComponents) {
    all.push(
      `its workspace-relative directory component ` +
        `${JSON.stringify(component)} (of the destination path or of a ` +
        `derived path the destination would generate, SPEC 13.1, 13.2, ` +
        `7.3) is occupied by something other than a directory — writes ` +
        `never traverse or replace such an occupant (SPEC 13.4, 14.22)`,
    );
  }
  if (all.length === 0) return null;
  return refusalFinding(
    "refused-invalid-destination",
    `invalid destination ${JSON.stringify(destination)}: the destination ` +
      `file path would not be a valid discovered spec source after the ` +
      `move, or could not be written and regenerated — ${all.join("; ")} ` +
      `(SPEC 6.5)`,
    { path: destination },
  );
}

// ---------------------------------------------------------------------------
// Identity mappings (the would-be operations, SPEC 6.4, 6.5)
// ---------------------------------------------------------------------------

/** The identity-space mapping a would-be operation applies (SPEC 6.1). */
type IdentityMap = (identity: string) => string;

/** A rename's mapping: `file#oldId(.rest)` → `file#newId(.rest)` (SPEC 6.4). */
function renameIdentityMap(
  file: string,
  oldId: string,
  newId: string,
): IdentityMap {
  const prefix = `${file}#`;
  return (identity) => {
    if (!identity.startsWith(prefix)) return identity;
    const mapped = replaceIdPrefix(identity.slice(prefix.length), oldId, newId);
    return mapped === null ? identity : `${prefix}${mapped}`;
  };
}

/** A file move's mapping: identities change only in the file part (SPEC 6.5). */
function moveFileIdentityMap(origin: string, destination: string): IdentityMap {
  const prefix = `${origin}#`;
  return (identity) => {
    if (identity === origin) return destination;
    if (identity.startsWith(prefix)) {
      return `${destination}#${identity.slice(prefix.length)}`;
    }
    return identity;
  };
}

/** A section move's mapping: prefix replacement into the target (SPEC 6.5). */
function moveSectionIdentityMap(
  origin: string,
  oldId: string,
  target: string,
  newId: string,
): IdentityMap {
  const prefix = `${origin}#`;
  return (identity) => {
    if (!identity.startsWith(prefix)) return identity;
    const mapped = replaceIdPrefix(identity.slice(prefix.length), oldId, newId);
    return mapped === null ? identity : `${target}#${mapped}`;
  };
}

/** The file part of a node identity (SPEC 1.5: `path#id`, or the path). */
function identityFilePart(identity: string): string {
  const hash = identity.indexOf("#");
  return hash === -1 ? identity : identity.slice(0, hash);
}

// ---------------------------------------------------------------------------
// Shared reason evaluations
// ---------------------------------------------------------------------------

/**
 * `refused-invalid-id` (SPEC 14): the new ID, or an ID the prefix
 * replacement produces, is not in intrinsic ID form — one finding
 * concerning those identities (`file#id` per SPEC 1.5), or null. The
 * produced IDs are `newId` plus each moved descendant's prefix-replaced ID
 * (SPEC 6.4, 6.5).
 */
function invalidIdFinding(
  targetFile: string,
  producedIds: readonly string[],
): Finding | null {
  const invalid: string[] = [];
  const problems: string[] = [];
  for (const id of producedIds) {
    const problem = intrinsicIdProblem(id);
    if (problem !== null) {
      invalid.push(id);
      problems.push(`${JSON.stringify(id)}: ${problem}`);
    }
  }
  if (invalid.length === 0) return null;
  return refusalFinding(
    "refused-invalid-id",
    `invalid new ID: the operation would produce identities that are not ` +
      `in intrinsic ID form (one or more segments joined by ".", each ` +
      `satisfying SPEC 1.4) — ${problems.join("; ")}; choose a valid new ` +
      `ID (SPEC 1.4, 14)`,
    { identities: invalid.map((id) => `${targetFile}#${id}`) },
  );
}

/**
 * `refused-id-collision` (SPEC 14): the new ID, or an ID the prefix
 * replacement produces, collides with an ID remaining after the
 * operation's removals — one finding locating every colliding bearer, or
 * null. `remaining` holds the target file's sections minus the vacated
 * ones (SPEC 6.4: the old ID and its descendants'; SPEC 6.5: the moved
 * subtree, for a same-file move).
 */
function idCollisionFinding(
  targetFile: string,
  targetFilePath: PathText,
  producedIds: readonly string[],
  remaining: readonly SpecSection[],
): Finding | null {
  const produced = new Set(producedIds);
  const locations: FindingLocation[] = [];
  const colliding = new Set<string>();
  for (const section of remaining) {
    if (section.id !== null && produced.has(section.id)) {
      colliding.add(section.id);
      locations.push({ file: targetFilePath, range: section.range });
    }
  }
  if (locations.length === 0) return null;
  const ids = sortByBytes([...colliding], (id) => id);
  return refusalFinding(
    "refused-id-collision",
    `ID collision: the operation would produce ` +
      `${ids.map((id) => JSON.stringify(id)).join(", ")}, which collide${
        ids.length === 1 ? "s" : ""
      } with the located ID${ids.length === 1 ? "" : "s"} remaining in ` +
      `${JSON.stringify(targetFile)} after the operation's removals — IDs ` +
      `are unique within a source file (SPEC 1.3); choose a new ID that ` +
      `collides with nothing (SPEC 6.4, 6.5, 14)`,
    {
      locations,
      identities: ids.map((id) => `${targetFile}#${id}`),
    },
  );
}

// ---------------------------------------------------------------------------
// Would-be cycles (SPEC 6.5 → 5.3, 2.1; refused-cycle)
// ---------------------------------------------------------------------------

/** The section form's re-parenting of the moved node (SPEC 6.5). */
interface Reparent {
  /** The pre-operation `contains` edge to drop: parent → moved root. */
  readonly removed: { readonly parent: string; readonly child: string };
  /** The post-operation `contains` edge to add (mapped identities). */
  readonly added: { readonly parent: string; readonly child: string };
}

/**
 * `refused-cycle`, dependency half (SPEC 14, 5.3): cycles in the would-be
 * combined graph of `contains`, `depends`, and `embeds` edges over
 * requirement nodes — the current graph's edges with the identity mapping
 * applied and, for the section form, the moved root re-parented. Each
 * cycle is one finding locating its full in-source path: every CURRENT
 * reference spelling recording a participating dependency edge (SPEC 14
 * location cardinality; `contains` steps, the would-be insertion
 * included, spell nothing).
 */
function wouldBeDependencyCycleFindings(
  graph: WorkspaceGraph,
  map: IdentityMap,
  reparent: Reparent | null,
  extraNodes: readonly string[],
): Finding[] {
  const adjacency = new Map<string, Set<string>>();
  const addEdge = (source: string, target: string): void => {
    let targets = adjacency.get(source);
    if (targets === undefined) adjacency.set(source, (targets = new Set()));
    targets.add(target);
  };
  for (const edge of graph.edges) {
    if (edge.kind === "references") continue;
    if (graph.requirementNode(edge.source) === undefined) continue;
    if (
      reparent !== null &&
      edge.kind === "contains" &&
      edge.source === reparent.removed.parent &&
      edge.target === reparent.removed.child
    ) {
      continue;
    }
    addEdge(map(edge.source), map(edge.target));
  }
  if (reparent !== null) {
    addEdge(reparent.added.parent, reparent.added.child);
  }

  // The current reference spellings behind each would-be dependency edge,
  // keyed by mapped (source, target): a cycle locates its full path in
  // source at pre-operation coordinates (SPEC 14, 6.6).
  const spellings = new Map<string, FindingLocation[]>();
  for (const occurrence of graph.occurrences) {
    if (occurrence.kind === "references") continue;
    if (occurrence.source === null) continue;
    if (graph.requirementNode(occurrence.source) === undefined) continue;
    const key = `${map(occurrence.source)} ${map(occurrence.target)}`;
    let list = spellings.get(key);
    if (list === undefined) spellings.set(key, (list = []));
    list.push({ file: occurrence.file, range: occurrence.range });
  }

  const nodes = [
    ...graph.requirementNodes.map((node) => map(node.identity)),
    ...extraNodes,
  ];
  return findCycles(nodes, adjacency).map((cycle) => {
    const locations: FindingLocation[] = [];
    for (let step = 0; step + 1 < cycle.length; step += 1) {
      const list = spellings.get(`${cycle[step]!} ${cycle[step + 1]!}`);
      if (list !== undefined) locations.push(...list);
    }
    return refusalFinding(
      "refused-cycle",
      `the move would create a dependency cycle: ${cycle.join(" → ")} — ` +
        `the combined contains/depends/embeds graph over requirement ` +
        `nodes must be acyclic (SPEC 5.3); the located reference ` +
        `spellings record its participating dependency edges; choose a ` +
        `target outside the moved node's dependents (SPEC 6.5, 14)`,
      { locations },
    );
  });
}

/** How a would-be operation relocates files and spellings (SPEC 6.5). */
interface RelocationModel {
  /** A file's post-operation path (the file form's rename; else identity). */
  readonly postPathOf: (path: string) => string;
  /** A post-operation path's current file, or null for a created one. */
  readonly prePathOf: (path: string) => string | null;
  /** The post-operation home of one reference spelling (SPEC 6.5). */
  readonly postHomeOf: (path: string, range: ByteRange) => string;
  /** Post-operation spec files that exist in no current analysis. */
  readonly createdFiles: readonly string[];
}

/**
 * `refused-cycle`, spec-import half (SPEC 14, 2.1): cycles in the
 * would-be file-level import relation among spec source files. The
 * relation is modeled in identity space: an import whose binding was
 * already unreferenced stays (SPEC 6.5), and beyond those, a
 * post-operation import edge H → T exists exactly when a reference
 * spelling homed in H post-operation resolves to a node of T ≠ H — the
 * rewrite adds an import when a rewritten reference needs a module
 * binding its file lacks and removes one whose binding is left without
 * references (SPEC 6.5). Each cycle is one finding locating the CURRENT
 * import declarations participating in it (a would-be import the rewrite
 * would add exists in no current source and contributes no location).
 */
function wouldBeImportCycleFindings(
  specs: readonly SpecFileAnalysis[],
  graph: WorkspaceGraph,
  map: IdentityMap,
  relocation: RelocationModel,
): Finding[] {
  const specByPath = new Map<string, SpecFileAnalysis>();
  for (const spec of specs) {
    specByPath.set(spec.document.path, spec);
  }
  const adjacency = new Map<string, Set<string>>();
  const addEdge = (source: string, target: string): void => {
    if (source === target) return;
    let targets = adjacency.get(source);
    if (targets === undefined) adjacency.set(source, (targets = new Set()));
    targets.add(target);
  };

  // SPEC 6.5/2.1: an import whose binding was already unreferenced stays —
  // its file-level relation survives the operation unchanged (paths
  // mapped).
  for (const spec of specs) {
    const referencedRoots = new Set<string>();
    for (const dependency of spec.references.dependencies) {
      const spelling = dependency.reference.spelling;
      if (spelling.form === "chain") referencedRoots.add(spelling.rootName);
    }
    for (const embedded of spec.references.embeddings) {
      const spelling = embedded.reference?.spelling;
      if (spelling !== undefined && spelling.form === "chain") {
        referencedRoots.add(spelling.rootName);
      }
    }
    for (const declared of spec.imports.imports) {
      if (declared.targetPath === null || declared.bindingName === null) {
        continue;
      }
      if (!referencedRoots.has(declared.bindingName)) {
        addEdge(
          relocation.postPathOf(spec.document.path),
          relocation.postPathOf(declared.targetPath),
        );
      }
    }
  }

  // Every requirement-side reference spelling, homed and retargeted: the
  // spec-file import relation the rewrite leaves behind (SPEC 6.5). Code
  // files do not participate in SPEC import cycles (2.1: among spec
  // source files).
  for (const occurrence of graph.occurrences) {
    if (occurrence.source === null) continue;
    if (graph.requirementNode(occurrence.source) === undefined) continue;
    if (typeof occurrence.file !== "string") continue; // valid workspaces only
    const home = relocation.postHomeOf(occurrence.file, occurrence.range);
    const targetFile = identityFilePart(map(occurrence.target));
    addEdge(home, targetFile);
  }

  const nodes = [
    ...specs.map((spec) => relocation.postPathOf(spec.document.path)),
    ...relocation.createdFiles,
  ];
  return findCycles(nodes, adjacency).map((cycle) => {
    // Locate the CURRENT import declarations participating in the
    // would-be cycle (SPEC 14 location cardinality): for each step, every
    // import of the step's source file (at its current path) designating
    // the step's target (at its current path). Imports the rewrite would
    // add exist in no current source and contribute no location.
    const locations: FindingLocation[] = [];
    for (let step = 0; step + 1 < cycle.length; step += 1) {
      const sourcePath = relocation.prePathOf(cycle[step]!);
      const targetPath = relocation.prePathOf(cycle[step + 1]!);
      if (sourcePath === null || targetPath === null) continue;
      const spec = specByPath.get(sourcePath);
      if (spec === undefined) continue;
      for (const declared of spec.imports.imports) {
        if (declared.targetPath === targetPath) {
          locations.push({
            file: spec.document.file,
            range: declared.statement.range,
          });
        }
      }
    }
    return refusalFinding(
      "refused-cycle",
      `the move would create a spec import cycle: ${cycle.join(" → ")} — ` +
        `import cycles among spec source files are invalid (SPEC 2.1); ` +
        `the rewrite would add the imports closing this cycle, so the ` +
        `move is refused; choose a target that does not make the origin ` +
        `and target files import each other (SPEC 6.5, 14)`,
      { locations },
    );
  });
}

// ---------------------------------------------------------------------------
// Rename (SPEC 6.4)
// ---------------------------------------------------------------------------

/** The inputs of a rename's refusal evaluation (SPEC 6.4, 14). */
export interface RenameRefusalInputs {
  /** The origin file's analysis (a discovered, parsed spec source). */
  readonly origin: SpecFileAnalysis;
  readonly oldId: string;
  readonly newId: string;
}

/**
 * Evaluate every applicable rename refusal reason together (SPEC 6.4, 14)
 * over a workspace passing `build`'s validations: the new ID's intrinsic
 * form, identity change, collisions against the IDs remaining after the
 * vacated ones are removed, and the structural parent rules at the
 * renamed section's place. A rename maps identities one-to-one within one
 * file and preserves every reference's form (SPEC 6.4), so it can create
 * no cycle and leave no rewritten reference unresolved — those reasons
 * are move-only (SPEC 14) and the "all rewritten references resolve"
 * clause is the always-passing side here.
 */
export function evaluateRenameRefusals(inputs: RenameRefusalInputs): Finding[] {
  const { origin, oldId, newId } = inputs;
  const file = origin.document.path;
  const section = origin.document.sections.find((s) => s.id === oldId);
  if (section === undefined) {
    throw new Error(
      `xspec internal error: rename origin ID ${oldId} is not a section of ` +
        `${file} — the caller validated its existence (SPEC 6.4)`,
    );
  }
  const findings: Finding[] = [];

  // SPEC 14 `refused-identity-unchanged`: the new identity equals the old,
  // concerning it.
  if (newId === oldId) {
    findings.push(
      refusalFinding(
        "refused-identity-unchanged",
        `identity unchanged: the new ID ${JSON.stringify(newId)} equals ` +
          `the old ID — a rename must change the identity (SPEC 6.4, 14)`,
        { identities: [`${file}#${newId}`] },
      ),
    );
  }

  // The produced IDs (SPEC 6.4): the new ID plus each descendant's
  // prefix-replaced ID; the vacated IDs: the old ID and its descendants'.
  const producedIds: string[] = [];
  const vacated = new Set<string>();
  for (const candidate of origin.document.sections) {
    if (candidate.id === null) continue;
    const mapped = replaceIdPrefix(candidate.id, oldId, newId);
    if (mapped !== null) {
      vacated.add(candidate.id);
      producedIds.push(mapped);
    }
  }

  // SPEC 14 `refused-invalid-id`: intrinsic form only.
  const invalidId = invalidIdFinding(file, producedIds);
  if (invalidId !== null) findings.push(invalidId);

  // SPEC 14 `refused-id-collision`: against the IDs remaining once the
  // vacated ones are removed (SPEC 6.4) — an identity-unchanged rename
  // therefore collides with nothing.
  const remaining = origin.document.sections.filter(
    (candidate) => candidate.id !== null && !vacated.has(candidate.id),
  );
  const collision = idCollisionFinding(
    file,
    origin.document.file,
    producedIds,
    remaining,
  );
  if (collision !== null) findings.push(collision);

  // SPEC 14 `refused-structural-parent`: positional conformance (1.3) at
  // the renamed section's unchanged place, evaluated only over
  // intrinsically valid IDs — no identity reports under both.
  if (invalidId === null) {
    const parentId = section.parent === null ? null : section.parent.id;
    let violated = false;
    if (parentId === null) {
      // Top-level (the implicit root, SPEC 1.2): exactly one segment.
      violated = newId.includes(".");
    } else {
      const prefix = `${parentId}.`;
      violated =
        !newId.startsWith(prefix) || newId.slice(prefix.length).includes(".");
    }
    if (violated) {
      findings.push(
        refusalFinding(
          "refused-structural-parent",
          `structural parent violation: the renamed section keeps its ` +
            `place in the tree, so its new ID must be ` +
            (parentId === null
              ? `exactly one segment (it is top-level)`
              : `${JSON.stringify(parentId)} plus "." plus exactly one ` +
                `segment (it is nested inside ${JSON.stringify(parentId)})`) +
            ` (SPEC 1.3); ${JSON.stringify(newId)} is not (SPEC 6.4, 14)`,
          { identities: [`${file}#${newId}`] },
        ),
      );
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Move (SPEC 6.5)
// ---------------------------------------------------------------------------

/** The probed destination-side filesystem facts (workspace/writes.ts). */
export interface DestinationProbe {
  /**
   * What occupies the destination path itself, judged by `lstat` — never
   * through a symbolic link (SPEC 13.4) — "absent" also for a path
   * unreachable through a non-directory component (nothing occupies it;
   * the component itself reports through `obstructedComponents`).
   */
  readonly occupant: "absent" | "file" | "directory" | "symlink" | "other";
  /**
   * The workspace-relative directory components of the assessment's
   * `componentProbePaths` occupied by anything other than a directory
   * (SPEC 6.5), distinct, in byte order; nonexistent components are never
   * listed (writes create those, SPEC 13.4).
   */
  readonly obstructedComponents: readonly string[];
}

/** A destination that was never probed (shape-invalid, SPEC 1.5). */
export const UNPROBED_DESTINATION: DestinationProbe = {
  occupant: "absent",
  obstructedComponents: [],
};

/** Human words for an occupant kind (diagnostics). */
function describeOccupantKind(
  occupant: Exclude<DestinationProbe["occupant"], "absent">,
): string {
  switch (occupant) {
    case "file":
      return "a plain file";
    case "directory":
      return "a directory";
    case "symlink":
      return "a symbolic link";
    case "other":
      return "a non-plain file";
  }
}

/** The inputs of a file-form move's refusal evaluation (SPEC 6.5, 14). */
export interface MoveFileRefusalInputs {
  readonly specs: readonly SpecFileAnalysis[];
  readonly graph: WorkspaceGraph;
  readonly originPath: string;
  readonly destination: string;
  readonly assessment: DestinationPathAssessment;
  readonly probe: DestinationProbe;
}

/**
 * Evaluate every applicable file-form move refusal reason together (SPEC
 * 6.5, 14) over a workspace passing `build`'s validations. A file move
 * maps identities one-to-one (file part only) and preserves the shapes of
 * both the dependency graph and the import relation, so the would-be
 * cycle evaluation runs on principle and finds nothing new on a valid
 * workspace; no rewritten reference can fail to resolve (import
 * specifiers are rewritten to keep designating the files they designated,
 * SPEC 6.5).
 */
export function evaluateMoveFileRefusals(
  inputs: MoveFileRefusalInputs,
): Finding[] {
  const { specs, graph, originPath, destination, assessment, probe } = inputs;
  const findings: Finding[] = [];

  // SPEC 14 `refused-identity-unchanged` (the mirrored identity check,
  // SPEC 6.5: the new identity differs from the old — for the file form,
  // in its file part): the exact self-move maps every identity to itself.
  if (destination === originPath) {
    findings.push(
      refusalFinding(
        "refused-identity-unchanged",
        `identity unchanged: the destination equals the origin ` +
          `${JSON.stringify(originPath)}, so every identity would map to ` +
          `itself — a move must change the identities (SPEC 6.5, 14)`,
        { identities: [originPath] },
      ),
    );
  }

  // SPEC 14 `refused-destination-exists`: the file form's destination path
  // is already occupied, whatever kind of filesystem object occupies it.
  if (probe.occupant !== "absent") {
    findings.push(
      refusalFinding(
        "refused-destination-exists",
        `destination exists: the destination path ` +
          `${JSON.stringify(destination)} is already occupied by ` +
          `${describeOccupantKind(probe.occupant)} — a file-form move ` +
          `refuses an existing destination, whatever occupies it ` +
          `(SPEC 6.5, 14)`,
        { path: destination },
      ),
    );
  }

  // SPEC 14 `refused-invalid-destination`: one finding over every cause.
  const invalidDestination = invalidDestinationFinding(
    destination,
    assessment.causes,
    probe.obstructedComponents,
  );
  if (invalidDestination !== null) findings.push(invalidDestination);

  // SPEC 14 `refused-cycle`: evaluated on its own terms over the would-be
  // workspace (no new cycle can arise from a pure file rename of the
  // graph, but the reason is read on its own terms, SPEC 14).
  const map = moveFileIdentityMap(originPath, destination);
  findings.push(...wouldBeDependencyCycleFindings(graph, map, null, []));
  const relocation: RelocationModel = {
    postPathOf: (path) => (path === originPath ? destination : path),
    prePathOf: (path) => (path === destination ? originPath : path),
    postHomeOf: (path) => (path === originPath ? destination : path),
    createdFiles: [],
  };
  findings.push(...wouldBeImportCycleFindings(specs, graph, map, relocation));

  return findings;
}

/** The inputs of a section-form move's refusal evaluation (SPEC 6.5, 14). */
export interface MoveSectionRefusalInputs {
  readonly specs: readonly SpecFileAnalysis[];
  readonly graph: WorkspaceGraph;
  /** The origin file's analysis (a discovered, parsed spec source). */
  readonly origin: SpecFileAnalysis;
  readonly oldId: string;
  readonly targetPath: string;
  readonly newId: string;
  /**
   * The discovered target file's analysis — the origin itself for a
   * same-file move — or null when no discovered spec source occupies the
   * target path (the move would create the file, or the occupant refuses
   * it; the probe tells which).
   */
  readonly target: SpecFileAnalysis | null;
  /**
   * The target-path assessment — meaningful when `target` is null (an
   * existing discovered target IS a valid spec source; only its
   * component probe below still applies). Callers pass a cause-free
   * assessment for a discovered target.
   */
  readonly assessment: DestinationPathAssessment;
  readonly probe: DestinationProbe;
}

/**
 * Evaluate every applicable section-form move refusal reason together
 * (SPEC 6.5, 14) over a workspace passing `build`'s validations: the
 * mirrored identity checks (intrinsic form, identity change, collisions
 * after the removal), the target parent, the destination occupancy and
 * validity, the would-be cycles (dependency and spec-import), and the
 * rewritten references that could not resolve (a moved reference
 * targeting the target file's root node — the local form names IDs of its
 * own file, never the file's root, SPEC 2.2, and the imported form would
 * be a self-import cycle, SPEC 2.1).
 */
export function evaluateMoveSectionRefusals(
  inputs: MoveSectionRefusalInputs,
): Finding[] {
  const { specs, graph, origin, oldId, targetPath, newId, target, probe } =
    inputs;
  const originPath = origin.document.path;
  const sameFile = targetPath === originPath;
  const movedSection = origin.document.sections.find((s) => s.id === oldId);
  if (movedSection === undefined) {
    throw new Error(
      `xspec internal error: move origin ID ${oldId} is not a section of ` +
        `${originPath} — the caller validated its existence (SPEC 6.5)`,
    );
  }
  const inMovedSubtree = (id: string): boolean =>
    id === oldId || id.startsWith(`${oldId}.`);
  const findings: Finding[] = [];

  // SPEC 14 `refused-identity-unchanged`: the exact self-move —
  // `<target-file>#<new-id>` equal to `<file>#<id>` (SPEC 6.5).
  if (sameFile && newId === oldId) {
    findings.push(
      refusalFinding(
        "refused-identity-unchanged",
        `identity unchanged: ${JSON.stringify(`${targetPath}#${newId}`)} ` +
          `is the moved section's own identity — the exact self-move is ` +
          `refused and appends no journal entry (SPEC 6.5, 14)`,
        { identities: [`${targetPath}#${newId}`] },
      ),
    );
  }

  // The produced IDs (SPEC 6.5): the new ID plus each moved descendant's
  // prefix-replaced ID.
  const producedIds: string[] = [];
  for (const candidate of origin.document.sections) {
    if (candidate.id === null) continue;
    const mapped = replaceIdPrefix(candidate.id, oldId, newId);
    if (mapped !== null) producedIds.push(mapped);
  }

  // SPEC 14 `refused-invalid-id`: intrinsic form only.
  const invalidId = invalidIdFinding(targetPath, producedIds);
  if (invalidId !== null) findings.push(invalidId);

  // SPEC 14 `refused-id-collision`: against the IDs remaining in the
  // target file after the removal — the moved subtree's own IDs are
  // vacated by it (a same-file move), and a distinct target file loses
  // nothing (SPEC 6.5).
  if (target !== null) {
    const remaining = target.document.sections.filter(
      (candidate) =>
        candidate.id !== null && !(sameFile && inMovedSubtree(candidate.id)),
    );
    const collision = idCollisionFinding(
      targetPath,
      target.document.file,
      producedIds,
      remaining,
    );
    if (collision !== null) findings.push(collision);
  }

  // SPEC 14 `refused-destination-exists` (section form): the target path
  // is occupied by anything other than a discovered spec source — neither
  // an insertion target nor an absent path to create (SPEC 6.5).
  if (target === null && probe.occupant !== "absent") {
    findings.push(
      refusalFinding(
        "refused-destination-exists",
        `destination exists: the target path ` +
          `${JSON.stringify(targetPath)} is occupied by ` +
          `${describeOccupantKind(probe.occupant)} that is not a ` +
          `discovered spec source — neither an insertion target nor an ` +
          `absent path to create (SPEC 6.5, 7, 14)`,
        { path: targetPath },
      ),
    );
  }

  // SPEC 14 `refused-invalid-destination`: the path-validity causes apply
  // to a target that is no discovered spec source (a discovered one IS a
  // valid source path — the caller passes a cause-free assessment); the
  // component obstructions apply to every target's destination-side
  // write paths (SPEC 6.5, 14.22).
  const invalidDestination = invalidDestinationFinding(
    targetPath,
    inputs.assessment.causes,
    probe.obstructedComponents,
  );
  if (invalidDestination !== null) findings.push(invalidDestination);

  // SPEC 14 `refused-missing-target-parent`: the target file's section
  // bearing `<new-id>` minus its final segment — needed whenever
  // `<new-id>` has more than one segment — is missing or lies within the
  // moved subtree, leaving no insertion point after the removal
  // (SPEC 6.5), concerning the target-parent identity.
  const newSegments = newId.split(".");
  let parentUsable = true;
  let parentSection: SpecSection | null = null;
  if (newSegments.length > 1) {
    const parentId = newSegments.slice(0, -1).join(".");
    parentSection =
      target?.document.sections.find((s) => s.id === parentId) ?? null;
    if (parentSection === null) {
      parentUsable = false;
      findings.push(
        refusalFinding(
          "refused-missing-target-parent",
          `missing target parent: the target parent ` +
            `${JSON.stringify(`${targetPath}#${parentId}`)} — the section ` +
            `bearing the new ID minus its final segment — does not exist ` +
            `in the target file (SPEC 6.5, 1.3, 14)`,
          { identities: [`${targetPath}#${parentId}`] },
        ),
      );
    } else if (sameFile && inMovedSubtree(parentId)) {
      parentUsable = false;
      findings.push(
        refusalFinding(
          "refused-missing-target-parent",
          `missing target parent: the target parent ` +
            `${JSON.stringify(`${targetPath}#${parentId}`)} lies within ` +
            `the moved subtree, leaving no insertion point after the ` +
            `removal (SPEC 6.5, 14)`,
          { identities: [`${targetPath}#${parentId}`] },
        ),
      );
    }
  }

  const map = moveSectionIdentityMap(originPath, oldId, targetPath, newId);
  const withinMovedRange = (range: ByteRange): boolean =>
    range.start >= movedSection.range.start &&
    range.end <= movedSection.range.end;

  // SPEC 14 `refused-unresolvable-reference`: a rewritten reference would
  // not resolve — a reference within the moved subtree targeting the
  // target file's root node: at the target, the local form names IDs of
  // its own file, never the file's root (SPEC 2.2), and the imported form
  // would be a self-import (SPEC 2.1) — locating each such reference
  // spelling.
  const unresolvable: FindingLocation[] = [];
  for (const occurrence of graph.occurrences) {
    if (occurrence.source === null) continue;
    if (graph.requirementNode(occurrence.source) === undefined) continue;
    if (occurrence.file !== originPath) continue;
    if (!withinMovedRange(occurrence.range)) continue;
    if (map(occurrence.target) === targetPath) {
      unresolvable.push({ file: occurrence.file, range: occurrence.range });
    }
  }
  if (unresolvable.length > 0) {
    findings.push(
      refusalFinding(
        "refused-unresolvable-reference",
        `unresolvable rewritten reference: the located reference ` +
          `spellings within the moved subtree target the target file's ` +
          `root node — after the move no rewrite of them could resolve: ` +
          `the local form names IDs of its own file, never the file's ` +
          `root (SPEC 2.2), and the imported form would be a self-import ` +
          `(SPEC 2.1) — retarget those references or choose another ` +
          `target file (SPEC 6.5, 14)`,
        { locations: unresolvable },
      ),
    );
  }

  // SPEC 14 `refused-cycle`: the would-be dependency graph — the moved
  // root re-parented from its current parent to the target parent (the
  // target file's root for a single-segment `<new-id>`, SPEC 6.5) — and
  // the would-be spec import relation. These reasons need a definable
  // post-operation shape: with the insertion point missing (above) there
  // is no would-be graph to judge.
  if (!parentUsable) return findings;
  const movedIdentity = `${originPath}#${oldId}`;
  const currentParent = movedSection.parent;
  const currentParentIdentity =
    currentParent === null || currentParent.id === null
      ? originPath
      : `${originPath}#${currentParent.id}`;
  const newParentIdentity =
    parentSection === null
      ? targetPath
      : parentSection.id === null
        ? targetPath
        : `${targetPath}#${parentSection.id}`;
  const reparent: Reparent = {
    removed: { parent: currentParentIdentity, child: movedIdentity },
    added: { parent: newParentIdentity, child: map(movedIdentity) },
  };
  const createdTarget = target === null;
  findings.push(
    ...wouldBeDependencyCycleFindings(
      graph,
      map,
      reparent,
      // A created target file's root node exists in no current graph.
      createdTarget ? [targetPath] : [],
    ),
  );
  const relocation: RelocationModel = {
    postPathOf: (path) => path,
    prePathOf: (path) => (createdTarget && path === targetPath ? null : path),
    postHomeOf: (path, range) =>
      path === originPath && withinMovedRange(range) ? targetPath : path,
    createdFiles: createdTarget ? [targetPath] : [],
  };
  findings.push(...wouldBeImportCycleFindings(specs, graph, map, relocation));

  return findings;
}
