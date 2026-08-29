// The workspace analysis pipeline (SPEC 12.1, 13.3, 14) — the shared
// pre-answer step of every command that parses and validates the configured
// sources: `build` runs it before generating, the graph-data consumers run
// it to refresh and to fail on invalid sources (SPEC 13.3), and `check` runs
// it as the base of its validations (SPEC 12.2).
//
// IMPLEMENTATION (Architecture): this workspace-layer module owns the I/O —
// discovery (the walk), reading source bytes, loading the journal — and
// composes the pure core: MDX parsing (core/mdx.ts), import and reference
// analysis (core/spec-references.ts), TypeScript analysis
// (core/code-analysis.ts), graph assembly (core/graph.ts), the text model
// (core/text-model.ts), and the four hashes (core/hashes.ts).
//
// Reporting semantics (SPEC 14): every detectable condition is collected —
// each present condition, not only the first — with the masking rules
// applied where the data flows:
//
// - a discovery-level configuration error (a file matched by both a spec and
//   a code group, SPEC 7.2 → 14.14) precedes all source analysis: it is
//   returned separately as a usage-class error (exit 2, SPEC 12.0) and no
//   source is parsed;
// - an unparseable source (14.20) masks the conditions inside itself: the
//   file contributes its single 14.20 finding and nothing else, and
//   references into it report as unresolved (14.5–14.7) during graph
//   resolution;
// - a discovered file whose own path is invalid (14.19) is no source of the
//   graph — no identity of it is defined (SPEC 11.2) — but it keeps its
//   parse-local structure: it is parsed and per-file validated beside its
//   14.19 finding, its references resolved on their own terms (the graph
//   reports their 14.5–14.7), and its analysis carried separately
//   (`invalidPathSpecs`/`invalidPathCode`) for the surfaces of 11.3–11.5.
//
// The journal is loaded here because it is a validation subject (14.13) and
// a hash input (SPEC 5.4, 5.5): a workspace whose journal is malformed fails
// build validation like any other finding-bearing workspace.

import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { Buffer } from "node:buffer";
import { compareBytes } from "../core/bytes.js";
import type { CodeAnalysis } from "../core/code-analysis.js";
import { analyzeCodeSource } from "../core/code-analysis.js";
import type { Configuration } from "../core/config.js";
import type { InvalidSource, SourceClassification } from "../core/discovery.js";
import { markdownEmitDestinations } from "../core/discovery.js";
import type { Finding } from "../core/findings.js";
import {
  codeExitClass,
  locatedFinding,
  orderFindings,
} from "../core/findings.js";
import { configurationToStored } from "../core/config-data.js";
import type { StoredInputs } from "../core/graph-data.js";
import type { SpecFileAnalysis } from "../core/graph.js";
import { buildWorkspaceGraph, WorkspaceGraph } from "../core/graph.js";
import { sha256Hex } from "../core/hash.js";
import type { NodeHashes } from "../core/hashes.js";
import { computeWorkspaceHashes } from "../core/hashes.js";
import { Journal } from "../core/journal.js";
import { parseSpecSource } from "../core/mdx.js";
import type { PathText } from "../core/path-text.js";
import {
  analyzeSpecImports,
  analyzeSpecReferences,
  SpecSourceDomain,
} from "../core/spec-references.js";
import { WorkspaceTextModel } from "../core/text-model.js";
import type { LoadedWorkspace } from "./config.js";
import { discoverSources } from "./discovery.js";
import type { LoadedJournal } from "./journal.js";
import { loadJournal } from "./journal.js";

/** The analyzed workspace: models plus the collected validation findings. */
export interface WorkspaceAnalysis {
  readonly classification: SourceClassification;
  /** SPEC 7.3: the configured Markdown emit destinations (may be empty). */
  readonly markdownDestinations: ReadonlySet<string>;
  /** The parseable spec sources' analyses, byte-ordered by path. */
  readonly specs: readonly SpecFileAnalysis[];
  /** The parseable code sources' analyses, byte-ordered by path. */
  readonly code: readonly CodeAnalysis[];
  /**
   * Per-file analyses of parseable discovered sources whose own paths are
   * invalid (SPEC 14.19), byte-ordered by path — structure is parse-local
   * (SPEC 11.2), so these files are parsed and validated like any other
   * while no identity of theirs is defined: they feed no graph nodes, no
   * hashes, no journal or derived-file interaction, and no recorded
   * inputs (their 14.19 findings gate every write, SPEC 12.1). Each
   * `document.file` / `analysis.file` carries the real path; `path` is a
   * never-rendered stand-in (core/mdx.ts, core/code-analysis.ts).
   */
  readonly invalidPathSpecs: readonly SpecFileAnalysis[];
  /** The code-source counterpart of `invalidPathSpecs`. */
  readonly invalidPathCode: readonly CodeAnalysis[];
  readonly graph: WorkspaceGraph;
  readonly textModel: WorkspaceTextModel;
  /** SPEC 5.5: the four hashes of every requirement node. */
  readonly hashes: ReadonlyMap<string, NodeHashes>;
  readonly journal: LoadedJournal;
  /**
   * SHA-256 (hex) of each discovered source's exact bytes as analyzed —
   * the graph data's recorded derivation inputs (SPEC 13.3;
   * core/graph-data.ts). Unreadable sources have no entry (their 14.20
   * finding fails validation before any store write), and neither do
   * invalid-path sources (SPEC 14.19: the finding gates every write, and
   * recorded state never concerns such a file).
   */
  readonly sourceHashes: ReadonlyMap<string, string>;
  /**
   * Every exit-1 validation finding (SPEC 14), deterministically ordered
   * (file bytes, location, condition — SPEC 12.0). Empty exactly when the
   * workspace passes build validation (SPEC 12.1; the write-path conditions
   * of 14.22 are the writing caller's to add).
   */
  readonly findings: readonly Finding[];
  /**
   * Discovery-level configuration errors (SPEC 7.2 → 14.14): usage-class
   * (exit 2, SPEC 12.0), preceding all source analysis (SPEC 14) — when
   * non-empty, nothing was parsed and `findings` is empty.
   */
  readonly configurationErrors: readonly Finding[];
}

/** The absolute filesystem path of a workspace-relative `/`-path. */
function absoluteOf(root: string, rel: string): string {
  return path.join(root, ...rel.split("/"));
}

/**
 * A workspace's content, however sourced: the classified file listing, a
 * byte reader for the discovered sources, and the journal. The filesystem
 * workspace (`analyzeWorkspace`) and a git tree at a baseline ref
 * (SPEC 6.3, src/workspace/baseline.ts) both analyze through this shape,
 * so the baseline analysis and the current analysis can never drift apart.
 */
export interface WorkspaceContent {
  readonly classification: SourceClassification;
  /**
   * Read one discovered source's exact bytes; null when the content cannot
   * be read (reported as an unparseable source, SPEC 14.20).
   */
  readonly readSource: (rel: string) => Promise<Uint8Array | null>;
  /**
   * Read one invalid-path discovered source's exact bytes (SPEC 14.19),
   * addressed by its exact path bytes — such a path may have no plain
   * string form (SPEC 12.0). Null when the content cannot be read
   * (SPEC 14.20). Called only for `classification.invalidSources`
   * entries, so content sourced from a workspace that passed `build`'s
   * validations (which discovers none) may answer null unconditionally.
   */
  readonly readInvalidSource: (bytes: Uint8Array) => Promise<Uint8Array | null>;
  /**
   * Load the journal (SPEC 6.1). Called only when analysis proceeds past
   * configuration errors — those precede all source analysis (SPEC 14).
   */
  readonly loadJournal: () => Promise<LoadedJournal>;
}

/**
 * Analyze the workspace (see the module header): discover, parse, and
 * validate every configured source, load the journal, assemble the graph,
 * and compute the text model and hashes. Total over invalid workspaces —
 * every condition arrives as data in `findings`/`configurationErrors`, and
 * only I/O failures throw.
 */
export async function analyzeWorkspace(
  workspace: LoadedWorkspace,
): Promise<WorkspaceAnalysis> {
  const { root, configuration } = workspace;
  const classification = await discoverSources(root, configuration);
  return analyzeWorkspaceContent(configuration, {
    classification,
    readSource: (rel) => readSourceBytes(root, rel),
    readInvalidSource: (bytes) => readInvalidSourceBytes(root, bytes),
    loadJournal: () => loadJournal(root),
  });
}

/**
 * Analyze already-classified workspace content (see the module header):
 * parse and validate every discovered source, load the journal, assemble
 * the graph, and compute the text model and hashes. The shared body behind
 * `analyzeWorkspace` (filesystem) and baseline reconstruction (a git tree
 * at a ref, SPEC 6.3).
 */
export async function analyzeWorkspaceContent(
  configuration: Configuration,
  content: WorkspaceContent,
): Promise<WorkspaceAnalysis> {
  const { classification } = content;

  // SPEC 14/14.14: discovery-level configuration errors are usage-class and
  // precede all source analysis — with one present, no source is parsed and
  // no finding-class condition is reported.
  const configurationErrors = classification.findings.filter(
    (finding) => codeExitClass(finding.code) === 2,
  );
  if (configurationErrors.length > 0) {
    const graph = buildWorkspaceGraph({ specs: [], code: [] });
    const textModel = new WorkspaceTextModel(graph.embeddingResolver());
    return {
      classification,
      markdownDestinations: new Set(),
      specs: [],
      code: [],
      invalidPathSpecs: [],
      invalidPathCode: [],
      graph,
      textModel,
      hashes: new Map(),
      // Not loaded: configuration errors precede all source analysis
      // (SPEC 14), and no caller consumes the journal on the exit-2 path.
      journal: {
        fileState: "absent",
        journal: new Journal([]),
        entries: [],
        findings: [],
        rawBytes: null,
      },
      sourceHashes: new Map(),
      findings: [],
      configurationErrors,
    };
  }

  const findings: Finding[] = [...classification.findings];

  const specPaths = new Set(
    classification.specSources.map((source) => source.path),
  );
  // SPEC 2.1/7.1: import designation consults the ENTIRE discovered
  // spec-source set — an import designating a discovered member whose own
  // path is invalid (SPEC 14.19) is valid, the member's identities all
  // undefined (SPEC 11.2, 14.5–14.7).
  const specDomain = new SpecSourceDomain(
    specPaths,
    classification.invalidSources.filter((source) => source.kind === "spec"),
  );
  // SPEC 7.3: destinations exist exactly while emission is enabled —
  // classification by configuration alone, whether or not emission has run.
  const markdownDestinations = markdownEmitDestinations(
    configuration,
    specPaths,
  );

  // --- spec sources (SPEC 1–3; conditions 14.1–14.4, 14.8, 14.15–14.17,
  // 14.20) --------------------------------------------------------------
  const sourceHashes = new Map<string, string>();
  const specs: SpecFileAnalysis[] = [];
  for (const source of classification.specSources) {
    const bytes = await content.readSource(source.path);
    if (bytes === null) {
      findings.push(unreadableSourceFinding(source.path));
      continue;
    }
    sourceHashes.set(source.path, sha256Hex(bytes));
    try {
      const parsed = parseSpecSource(source.path, bytes);
      if (parsed.kind === "unparseable") {
        // SPEC 14.20: the file's single finding masks everything inside
        // it; references into it report as unresolved at graph resolution.
        findings.push(parsed.finding);
        continue;
      }
      const document = parsed.document;
      const imports = analyzeSpecImports(
        document,
        specDomain.designatorFor(source.path),
      );
      const references = analyzeSpecReferences(document, imports);
      findings.push(...document.findings);
      findings.push(...imports.findings);
      findings.push(...references.findings);
      specs.push({ document, imports, references });
    } catch (error) {
      // SPEC 14.20: nesting beyond what the recursive analyses can process
      // (a call-stack overflow surfaces as a RangeError — possible in the
      // TypeScript re-parse of extracted import/reference expressions even
      // when the MDX parse itself succeeded) makes the file unparseable —
      // one finding, the file's contents masked, never a crash (SPEC 12.0).
      if (!(error instanceof RangeError)) throw error;
      findings.push(
        locatedFinding(
          20,
          `unparseable source: not well-formed MDX — the file's nesting ` +
            `exceeds what the analyzer can process, so no location inside ` +
            `it can be analyzed; simplify or split the file (SPEC 14.20)`,
          [{ file: source.path, range: { start: 0, end: 0 } }],
        ),
      );
    }
  }

  // --- code sources (SPEC 4; conditions 14.8, 14.11, 14.15, 14.18,
  // 14.20) ---------------------------------------------------------------
  const code: CodeAnalysis[] = [];
  for (const source of classification.codeSources) {
    const bytes = await content.readSource(source.path);
    if (bytes === null) {
      findings.push(unreadableSourceFinding(source.path));
      continue;
    }
    sourceHashes.set(source.path, sha256Hex(bytes));
    const analyzed = analyzeCodeSource(source.path, bytes, {
      designate: specDomain.designatorFor(source.path),
      markdownDestinations,
    });
    if (analyzed.kind === "unparseable") {
      findings.push(analyzed.finding);
      continue;
    }
    findings.push(...analyzed.analysis.findings);
    code.push(analyzed.analysis);
  }

  // --- invalid-path sources (SPEC 14.19, 11.2) --------------------------
  //
  // A discovered file whose own path is invalid keeps its parse-local
  // structure: it is parsed and per-file validated like any other source
  // — its located findings (marked byte-form location files) report
  // beside its 14.19 — while no identity of it is defined: it enters no
  // graph node, no hash, no recorded input, and no derived-file
  // derivation (its 14.19 gates every write, SPEC 12.1). An unparseable
  // one reports its 14.20 beside the 14.19, its contents masked (SPEC 14).
  const invalidPathSpecs: SpecFileAnalysis[] = [];
  const invalidPathCode: CodeAnalysis[] = [];
  for (const source of classification.invalidSources) {
    const bytes = await content.readInvalidSource(source.bytes);
    if (bytes === null) {
      findings.push(unreadableSourceFinding(source.path));
      continue;
    }
    // The analyzers' identity-space path: a deterministic stand-in (the
    // lossily decoded path bytes) — never rendered, never resolved
    // against; `source.path` is the real path (core/mdx.ts SpecDocument).
    const standIn = lossyDecoder.decode(source.bytes);
    if (source.kind === "spec") {
      try {
        const parsed = parseSpecSource(standIn, bytes, source.path);
        if (parsed.kind === "unparseable") {
          findings.push(parsed.finding);
          continue;
        }
        const document = parsed.document;
        const imports = analyzeSpecImports(
          document,
          specDomain.designatorForBytes(source.bytes),
        );
        const references = analyzeSpecReferences(document, imports);
        findings.push(...document.findings);
        findings.push(...imports.findings);
        findings.push(...references.findings);
        invalidPathSpecs.push({ document, imports, references });
      } catch (error) {
        // SPEC 14.20: overflow-deep nesting, as in the valid-source loop.
        if (!(error instanceof RangeError)) throw error;
        findings.push(
          locatedFinding(
            20,
            `unparseable source: not well-formed MDX — the file's nesting ` +
              `exceeds what the analyzer can process, so no location inside ` +
              `it can be analyzed; simplify or split the file (SPEC 14.20)`,
            [{ file: source.path, range: { start: 0, end: 0 } }],
          ),
        );
      }
    } else {
      const analyzed = analyzeCodeSource(
        standIn,
        bytes,
        {
          designate: specDomain.designatorForBytes(source.bytes),
          markdownDestinations,
        },
        source.path,
      );
      if (analyzed.kind === "unparseable") {
        findings.push(analyzed.finding);
        continue;
      }
      findings.push(...analyzed.analysis.findings);
      invalidPathCode.push(analyzed.analysis);
    }
  }

  // --- journal (SPEC 6.1, 5.4 → 14.13) ----------------------------------
  const journal = await content.loadJournal();
  findings.push(...journal.findings);

  // --- graph, text model, hashes (SPEC 5; conditions 14.5–14.7, 14.9) ---
  const graph = buildWorkspaceGraph({
    specs,
    code,
    invalidPathSpecs,
    invalidPathCode,
  });
  findings.push(...graph.findings);
  const textModel = new WorkspaceTextModel(graph.embeddingResolver());
  // Total even over invalid workspaces (core/hashes.ts); only valid
  // workspaces ever surface hashes (SPEC 12.1, 13.3).
  const hashes = computeWorkspaceHashes(graph, textModel, journal.journal);

  return {
    classification,
    markdownDestinations,
    specs,
    code,
    invalidPathSpecs,
    invalidPathCode,
    graph,
    textModel,
    hashes,
    journal,
    sourceHashes,
    findings: orderFindings(findings),
    configurationErrors: [],
  };
}

/**
 * The graph data's recorded derivation inputs for this analysis
 * (SPEC 13.3; core/graph-data.ts `StoredInputs`): the configuration file's
 * content hash with its parsed form, the journal's content hash, and every
 * analyzed source's content hash in byte order of path (SPEC 12.0). Shared
 * by every producer of stored graph data — `build`, refresh-on-read,
 * `check`'s would-be comparison, and the finishing regeneration of
 * `rename`/`move` — so all of them record inputs by one rule.
 */
export function workspaceInputsOf(
  workspace: LoadedWorkspace,
  analysis: WorkspaceAnalysis,
): StoredInputs {
  return {
    configHash: workspace.configHash,
    config: configurationToStored(workspace.configuration),
    journalHash:
      analysis.journal.rawBytes === null
        ? null
        : sha256Hex(analysis.journal.rawBytes),
    sources: [...analysis.sourceHashes.entries()]
      .map(([sourcePath, hash]) => ({ path: sourcePath, hash }))
      .sort((a, b) => compareBytes(a.path, b.path)),
  };
}

/**
 * Deterministic lossy decoding for the identity-space stand-in path of an
 * invalid-path source (SPEC 14.19): invalid sequences become U+FFFD per
 * the Unicode maximal-subpart rule — never rendered, only a per-analysis
 * map key.
 */
const lossyDecoder = new TextDecoder("utf-8");

/**
 * Read one discovered source's exact bytes from the filesystem, null when
 * unreadable — the reader `analyzeWorkspace` hands the shared body.
 */
async function readSourceBytes(
  root: string,
  rel: string,
): Promise<Uint8Array | null> {
  try {
    return await fsp.readFile(absoluteOf(root, rel));
  } catch {
    return null;
  }
}

/**
 * Read one invalid-path discovered source's exact bytes (SPEC 14.19) —
 * such a workspace-relative path may have no plain string form, so the
 * filesystem is addressed with the exact bytes (`/`-separated, as the
 * walk produced them; every platform Node supports accepts `/` here).
 */
async function readInvalidSourceBytes(
  root: string,
  bytes: Uint8Array,
): Promise<Uint8Array | null> {
  try {
    return await fsp.readFile(
      Buffer.concat([Buffer.from(root), Buffer.from("/"), Buffer.from(bytes)]),
    );
  } catch {
    return null;
  }
}

/**
 * SPEC 14.20: a discovered source whose content cannot be read. On the
 * filesystem that means the file vanished (or became unreadable) between
 * the walk and the read — concurrent modification, SPEC 13.5
 * last-write-wins territory; it was discovered, and its content cannot be
 * analyzed.
 */
function unreadableSourceFinding(rel: PathText): Finding {
  // SPEC 14.20 locates in source; with no readable content, the failure
  // locates at the file start (range [0, 0)).
  return locatedFinding(
    20,
    `unparseable source: the discovered file could not be read — it ` +
      `changed or vanished while the command ran; re-run the command ` +
      `once the workspace is quiescent (SPEC 13.5, 14.20)`,
    [{ file: rel, range: { start: 0, end: 0 } }],
  );
}
