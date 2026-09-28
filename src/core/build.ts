// The build output set (SPEC 12.1, 13.1–13.3) — the pure derivation.
//
// Pure core (IMPLEMENTATION Architecture: output generation is deterministic
// and I/O-free; the workspace layer writes): over a validated workspace's
// analyses this module computes everything `xspec build` writes —
//
// - the generated TypeScript modules and companions of every spec source
//   (SPEC 13.1, via ./emission.ts);
// - the emitted Markdown, exactly while `markdown` is present with `emit`
//   true (SPEC 7.3): `NAME.mdx` emits `NAME.md`, placed per `markdown.outDir`
//   preserving workspace-relative paths, the default next to each source
//   (SPEC 3, 13.2);
// - the graph data (SPEC 13.3): the current snapshot with its derivation
//   inputs, and the derived-file record set to exactly the paths generated
//   by this build (13.4 — the record orphan removal relies on), the two
//   stored apart so a refresh can write the one without the other;
// - the orphans (SPEC 12.1, 13.3, 13.4): recorded derived files the current
//   sources and configuration no longer generate, removed via their recorded
//   paths only — a missing or malformed record records nothing, and such
//   orphans stay outside xspec's knowledge.
//
// Only valid workspaces reach this derivation (SPEC 12.1: a failed build
// modifies nothing), so every value is a total, byte-deterministic function
// of (configuration, parsed sources, journal) — no wall clock, no
// randomness, no absolute paths (SPEC 12.0).

import { compareBytes, sortByBytes } from "./bytes.js";
import type { Configuration } from "./config.js";
import type { SourceClassification } from "./discovery.js";
import { canonicalOutDirPrefix } from "./discovery.js";
import type { GeneratedFile } from "./emission.js";
import { generateSpecModule, specModulePaths } from "./emission.js";
import type { GraphData, StoredInputs } from "./graph-data.js";
import { buildGraphSnapshot, GRAPH_DATA_OWN_PATHS } from "./graph-data.js";
import type { SpecFileAnalysis, WorkspaceGraph } from "./graph.js";
import type { NodeHashes } from "./hashes.js";
import type { WorkspaceTextModel } from "./text-model.js";

/** Everything one `xspec build` writes and removes (SPEC 12.1). */
export interface BuildOutputs {
  /**
   * Every derived file this build generates — generated TypeScript modules
   * and companions (SPEC 13.1), then emitted Markdown (13.2) — sources in
   * byte order of workspace-relative path, each source's files in a fixed
   * order (SPEC 12.0 determinism). Graph data is not among them: it is
   * carried separately as `graphData`.
   */
  readonly files: readonly GeneratedFile[];
  /**
   * SPEC 13.3: the graph data to store — the current snapshot with its
   * derivation inputs, exactly what a refresh writes too.
   */
  readonly graphData: GraphData;
  /**
   * SPEC 13.3/13.4: the derived-file record to store — exactly the paths of
   * `files`, in byte order: the paths of the derived files most recently
   * generated, written by generation alone (never by a refresh).
   */
  readonly record: readonly string[];
  /**
   * SPEC 12.1, 13.3, 13.4: recorded derived files the current sources and
   * configuration no longer generate, in byte order — removed via these
   * recorded paths only.
   */
  readonly orphans: readonly string[];
  /**
   * The complete workspace-relative write set — every path of `files` plus
   * the graph data's own paths (the snapshot's and the record's) — for the
   * SPEC 14.22 pre-write validation (writes never traverse symbolic links;
   * a command refuses the write and reports it before modifying anything).
   */
  readonly writePaths: readonly string[];
}

/**
 * Derive the SPEC 12.1 build outputs of a validated workspace. `recorded`
 * is the stored record's derived-file paths — empty when the record is
 * absent or cannot be read as a record: such orphans are outside xspec's
 * knowledge (SPEC 13.4) — the orphan-removal domain (SPEC 13.3, 13.4).
 * `hashes` must be the SPEC 5.5 computation over `graph`.
 */
export function computeBuildOutputs(
  configuration: Configuration,
  specs: readonly SpecFileAnalysis[],
  graph: WorkspaceGraph,
  textModel: WorkspaceTextModel,
  hashes: ReadonlyMap<string, NodeHashes>,
  recorded: readonly string[],
  inputs: StoredInputs,
): BuildOutputs {
  // SPEC 12.0: deterministic output order — sources by byte order of
  // workspace-relative path (the classification already yields this order;
  // sorting keeps the derivation order-independent of its inputs).
  const ordered = sortByBytes(specs, (spec) => spec.document.path);

  const files: GeneratedFile[] = [];
  // SPEC 13.1: `NAME.mdx` generates `NAME.xspec.ts` and its companions in
  // the source file's directory.
  for (const spec of ordered) {
    files.push(...generateSpecModule(spec.document, textModel));
  }
  // SPEC 7.3/13.2: Markdown is emitted exactly while `markdown` is present
  // with `emit` true — `NAME.mdx` emits `NAME.md`, placed per
  // `markdown.outDir` preserving workspace-relative paths (SPEC 3).
  const markdown = configuration.markdown;
  if (markdown !== undefined && markdown.emit) {
    const prefix = canonicalOutDirPrefix(markdown.outDir) ?? "";
    for (const spec of ordered) {
      const specPath = spec.document.path;
      files.push({
        // SPEC 13.2: the `.mdx` source emits `.md` — the trailing "x"
        // dropped (discovered spec sources always end `.mdx`, SPEC 7.1).
        path: prefix + specPath.slice(0, -1),
        content: textModel.compiledMarkdown(spec.document),
      });
    }
  }

  const generated = new Set(files.map((file) => file.path));
  // SPEC 12.1/13.3/13.4: orphan removal via recorded paths only.
  const orphans = orphanedRecordedPaths(recorded, generated);

  return {
    files,
    graphData: {
      snapshot: buildGraphSnapshot(graph, hashes, textModel),
      // SPEC 13.3: the recorded derivation inputs certify the snapshot for
      // byte-identical current inputs (core/graph-data.ts).
      inputs,
    },
    // SPEC 13.3: the paths of the derived files most recently generated —
    // updated only by generation.
    record: [...generated].sort(compareBytes),
    orphans,
    writePaths: [...files.map((file) => file.path), ...GRAPH_DATA_OWN_PATHS],
  };
}

/**
 * The derived-file paths a build over `specPaths` would generate — each
 * source's generated module and companions (SPEC 13.1, the `NAME.mdx` name
 * shape via emission's `specModulePaths`) plus, exactly while `markdown` is
 * present with `emit` true, its Markdown destination (SPEC 13.2, 7.3) — in
 * byte order, graph data excluded (SPEC 13.3: the record holds the
 * generated derived files; graph data records no path of its own). The
 * path-only companion of `computeBuildOutputs`' enumeration, serving the
 * preview delta's post-operation generation set (SPEC 6.6) and the set of
 * generated paths on any workspace (`discoveredGeneratedPaths`, SPEC
 * 14.10): the paths are a function of the source names and the
 * configuration alone.
 */
export function generatedDerivedPaths(
  configuration: Configuration,
  specPaths: readonly string[],
): readonly string[] {
  const paths: string[] = [];
  const markdown = configuration.markdown;
  const emitMarkdown = markdown !== undefined && markdown.emit;
  const prefix = emitMarkdown
    ? (canonicalOutDirPrefix(markdown.outDir) ?? "")
    : "";
  for (const specPath of specPaths) {
    if (!specPath.endsWith(".mdx")) {
      // SPEC 13.1: per-source derived paths are defined by the `NAME.mdx`
      // name shape alone — a spec-group file without the extension (14.19,
      // reaching here only through `discoveredGeneratedPaths`) generates no
      // module and emits no Markdown.
      continue;
    }
    const modulePaths = specModulePaths(specPath);
    paths.push(
      modulePaths.module,
      modulePaths.runtime,
      modulePaths.types,
      modulePaths.typesMap,
    );
    if (emitMarkdown) {
      // SPEC 13.2: the `.mdx` source emits `.md` — the trailing "x" dropped.
      paths.push(prefix + specPath.slice(0, -1));
    }
  }
  return [...new Set(paths)].sort(compareBytes);
}

/**
 * SPEC 14.10's "set of generated paths alone, a set discovery and
 * configuration define on any workspace (13.1, 7.3, 11.6)": the derived
 * paths every discovered spec source generates by its `NAME.mdx` name shape
 * alone — its module and companions (13.1) and, while emission is enabled,
 * its Markdown emit destination (7.3) — through `generatedDerivedPaths`, in
 * byte order, graph data excluded. It parses no source, so it is defined on
 * a workspace failing `build`'s validations as on a passing one, where it
 * is exactly the paths `computeBuildOutputs` generates (every discovered
 * spec source then valid and parsed). A spec-group file whose own path
 * 14.19 rejects is a discovered spec source all the same — the inventory's
 * derived-file map gives it a module path and an emit destination (11.6),
 * and the configured emit destinations count it (7.3) — so it contributes
 * its derived paths, a non-`.mdx` one none (13.1). A rejected path with no
 * plain string form (not valid UTF-8, SPEC 12.0) contributes nothing here:
 * its derived paths keep its stem, an ASCII suffix following it, so they
 * are no more valid UTF-8 than it is, and no recorded path — a string, the
 * record written by a successful build over valid sources (13.3) — can
 * equal one.
 */
export function discoveredGeneratedPaths(
  configuration: Configuration,
  classification: SourceClassification,
): readonly string[] {
  const specPaths = classification.specSources.map((source) => source.path);
  for (const source of classification.invalidSources) {
    if (source.kind === "spec" && typeof source.path === "string") {
      specPaths.push(source.path);
    }
  }
  return generatedDerivedPaths(configuration, specPaths);
}

/**
 * SPEC 12.1, 13.3, 13.4, 14.10: the recorded derived-file paths the current
 * sources and configuration no longer generate — `recorded` (a readable
 * record's paths; none where the record is absent or cannot be read as a
 * record, files orphaned then being outside xspec's knowledge, 13.4)
 * outside `generated`, duplicate-free, in byte order. Graph data's own
 * paths are never recorded (13.3: graph data records no paths of its own);
 * a record naming one anyway is dropped defensively — the store is
 * rewritten, never removed, by a build. The one rule behind generation's
 * orphan removal and `check`'s recorded-file form.
 */
export function orphanedRecordedPaths(
  recorded: readonly string[],
  generated: ReadonlySet<string>,
): readonly string[] {
  return [...new Set(recorded)]
    .filter(
      (path) => !generated.has(path) && !GRAPH_DATA_OWN_PATHS.includes(path),
    )
    .sort(compareBytes);
}
