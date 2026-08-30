// `xspec view [<file> …] [--file <glob>] [--text]` (SPEC 11.4).
//
// Returns, per requested file, everything needed to overlay structure on
// the raw MDX bytes: the root and the full positional section tree with
// construct ranges, tag-range decompositions, raw attribute spellings, and
// the per-node interpreted datums of SPEC 11.2 (identity, tags, coverage —
// each plain, structurally absent, or explicitly unavailable), every
// import declaration, the file's reference occurrences, and every MDX
// comment's range — with `--text`, each node's own and subtree text
// (SPEC 1.6), defined or explicitly unavailable per SPEC 11.2. JSON-only
// (SPEC 11): a single JSON document — the 12.7 `{"findings", "views"}`
// form — is its only output form, with or without `--json`.
//
// The view's domain is the discovered spec sources (SPEC 11.4). `<file>`
// operands assert membership — a file outside the discovered set is an
// unknown file and a discovered code source a wrong-kind operand, each a
// usage error (exit 2, SPEC 12.0); a `#`-containing operand is a whole
// path, never a `path#id` split (SPEC 12.0). `--file` is instead a set
// restriction under the glob rules of SPEC 7 — a glob admitting no
// discovered spec source admits the empty set (an empty, finding-free
// answer, exit 0) — and combining operands with `--file` is a usage error
// (rejected at parse time). With neither, the request covers every
// discovered spec source. The argument checks precede answering
// (SPEC 11.2, 12.0): membership is judged against discovery, before the
// SPEC 13.3 refresh participation, so a failing invocation writes nothing.
//
// The consulted domain (SPEC 11.2) is the requested files plus, with
// `--text`, every file the requested expansions transitively consult
// (core/availability.ts `expansionConsultedFiles`); the domain's findings
// accompany the answer, and any finding or explicitly-unavailable datum
// exits 1 with the full document still emitted. An unparseable requested
// file contributes no view entry — its parse-failure finding reports it —
// while an invalid-path (SPEC 14.19) requested file keeps its view, every
// node identity explicitly unavailable.

import {
  accompanyingFindings,
  availabilityExit,
  ConsultedDomain,
  expansionConsultedFiles,
  selectOccurrences,
  TextAvailability,
} from "../../core/availability.js";
import { canonicalJson } from "../../core/canonical-json.js";
import type { JsonObject, JsonValue } from "../../core/canonical-json.js";
import type { ExitCode } from "../../core/findings.js";
import { orderFindings } from "../../core/findings.js";
import type { CompiledGlob } from "../../core/glob.js";
import { compileGlob } from "../../core/glob.js";
import type { SpecFileAnalysis, WorkspaceGraph } from "../../core/graph.js";
import type { SpecDocument, SpecSection } from "../../core/mdx.js";
import { definedIdentitySections } from "../../core/mdx.js";
import type { PathText } from "../../core/path-text.js";
import {
  comparePathTexts,
  pathTextJson,
  pathTextKey,
} from "../../core/path-text.js";
import type { WorkspaceTextModel } from "../../core/text-model.js";
import { finishAvailabilityRefresh } from "../../workspace/availability.js";
import type { Invocation } from "../args.js";
import { flagPresent, flagValue } from "../args.js";
import type { CommandContext } from "../io.js";
import { analyzeAnalysisForAvailability } from "../prepare.js";
import {
  findingToJson,
  occurrenceRecordJson,
  unavailableJson,
} from "../report.js";
import { rangeJson, usageError } from "./common.js";

/** One requested file's parsed analysis and its path validity (SPEC 14.19). */
interface RequestedSpec {
  readonly spec: SpecFileAnalysis;
  /**
   * Whether the file's own path is valid — false for a 14.19 member, whose
   * every node identity is explicitly unavailable (SPEC 11.2) while its
   * parse-local structure stays on view.
   */
  readonly pathValid: boolean;
}

/** The `view` command handler (SPEC 11.4). */
export async function viewCommand(
  invocation: Invocation,
  context: CommandContext,
): Promise<ExitCode> {
  // --- syntactic argument checks (SPEC 11.2: they precede answering) ------
  const withText = flagPresent(invocation, "--text");
  let fileGlob: CompiledGlob | undefined;
  const filePattern = flagValue(invocation, "--file");
  if (filePattern !== undefined) {
    const compiled = compileGlob(filePattern, "plain");
    if (!compiled.ok) {
      // Plain mode has one compile error: a pattern resolving outside the
      // workspace root — an invalid flag value, as in SPEC 11.1 (SPEC 7).
      return usageError(
        invocation,
        context,
        `invalid value '${filePattern}' for '--file' — the pattern ` +
          `resolves outside the workspace root (SPEC 11.4, 11.1, 7, 12.0)`,
      );
    }
    fileGlob = compiled.glob;
  }

  // --- the analysis half of the SPEC 11.2 pre-answer step (a pure read) ---
  const prepared = await analyzeAnalysisForAvailability(invocation, context);
  if (!prepared.ok) {
    return prepared.exit;
  }
  const { analysis } = prepared;
  const { classification } = analysis;

  // --- operand membership checks (SPEC 11.4, 12.0): judged against the
  // discovered set — discovery is controlled exclusively by configuration
  // (SPEC 7), so an on-disk file no group discovers is unknown — before
  // any answer or refresh side effect (SPEC 11.2).
  const discoveredKinds = new Map<string, "spec" | "code">();
  for (const source of classification.specSources) {
    discoveredKinds.set(pathTextKey(source.path), "spec");
  }
  for (const source of classification.codeSources) {
    discoveredKinds.set(pathTextKey(source.path), "code");
  }
  for (const source of classification.invalidSources) {
    // SPEC 11.2/14.19: invalid-path members are discovered files of their
    // kind — a spec-kind member keeps its view; a code-kind member is a
    // wrong-kind operand like any other discovered code source.
    discoveredKinds.set(pathTextKey(source.path), source.kind);
  }

  const requested: PathText[] = [];
  const requestedKeys = new Set<string>();
  const addRequested = (file: PathText): void => {
    const key = pathTextKey(file);
    if (!requestedKeys.has(key)) {
      requestedKeys.add(key);
      requested.push(file);
    }
  };
  if (invocation.positionals.length > 0) {
    for (const operand of invocation.positionals) {
      // SPEC 12.0: a bare <file> operand is a whole path — `#` has no
      // delimiter role in it — so the operand names the discovered file of
      // exactly that spelling.
      const kind = discoveredKinds.get(pathTextKey(operand));
      if (kind === undefined) {
        return usageError(
          invocation,
          context,
          `unknown file '${operand}' — a <file> operand names a ` +
            `discovered spec source, and no configured group discovers ` +
            `this path (SPEC 11.4, 7, 12.0)`,
        );
      }
      if (kind === "code") {
        return usageError(
          invocation,
          context,
          `wrong-kind file '${operand}' — the operand names a discovered ` +
            `code source, which has no structural view; name a discovered ` +
            `spec source (SPEC 11.4, 12.0)`,
        );
      }
      addRequested(operand);
    }
  } else {
    // SPEC 11.4: `--file` admits the discovered spec sources it matches —
    // matching is byte-wise against the workspace-relative path (SPEC 7);
    // with neither operands nor `--file`, every discovered spec source.
    for (const source of classification.specSources) {
      if (fileGlob === undefined || fileGlob.matches(source.path)) {
        addRequested(source.path);
      }
    }
    for (const source of classification.invalidSources) {
      if (source.kind !== "spec") continue;
      if (fileGlob === undefined || fileGlob.matches(source.bytes)) {
        addRequested(source.path);
      }
    }
  }
  // SPEC 11.4: the requested files form a set; per-file views are ordered
  // by byte order of workspace-relative path.
  requested.sort(comparePathTexts);

  // --- the refresh half (SPEC 13.3, 11.2): the invocation is valid, so
  // the surface participates in read-time refresh on a passing workspace
  // and touches nothing on a failing one.
  await finishAvailabilityRefresh(context.workspace, analysis);

  // --- the answer (SPEC 11.4, 11.2) ---------------------------------------
  const parsedByKey = new Map<string, RequestedSpec>();
  for (const spec of analysis.specs) {
    parsedByKey.set(pathTextKey(spec.document.file), { spec, pathValid: true });
  }
  for (const spec of analysis.invalidPathSpecs) {
    parsedByKey.set(pathTextKey(spec.document.file), {
      spec,
      pathValid: false,
    });
  }
  // An unparseable requested file has no parsed analysis: it contributes
  // no view entry, its parse-failure finding reporting it (SPEC 11.2).
  const requestedSpecs: RequestedSpec[] = [];
  for (const file of requested) {
    const entry = parsedByKey.get(pathTextKey(file));
    if (entry !== undefined) {
      requestedSpecs.push(entry);
    }
  }

  // The consulted domain: the requested files plus, with `--text`, every
  // file the requested expansions transitively consult (SPEC 11.4).
  const domainFiles: PathText[] = [...requested];
  if (withText) {
    domainFiles.push(
      ...expansionConsultedFiles(
        analysis.graph,
        requestedSpecs.map((entry) => entry.spec.document),
      ),
    );
  }
  const domain = new ConsultedDomain(domainFiles);
  const findings = orderFindings(
    accompanyingFindings(analysis.findings, domain),
  );

  const renderer = new ViewRenderer(
    analysis.graph,
    analysis.textModel,
    withText,
  );
  const views = requestedSpecs.map((entry) => renderer.fileView(entry));

  const document: JsonValue = {
    findings: findings.map(findingToJson),
    views,
  };
  context.stdout.write(canonicalJson(document));
  // SPEC 11.2: any finding or explicitly-unavailable datum → exit 1 with
  // the full document emitted; complete and finding-free → exit 0.
  return availabilityExit(findings, renderer.carriesUnavailable);
}

/**
 * Renders per-file views in the 12.7 document form, tracking whether any
 * emitted datum is the explicit unavailability marker (the SPEC 11.2 exit
 * input). Structure is parse-local; the interpreted datums follow
 * SPEC 11.2's three states — plain value, stated `null` where 11.4 defines
 * structural absence, or `{"unavailable": true}` — and with `--text` the
 * own/subtree text values are defined exactly per the expansion rules
 * (core/availability.ts `TextAvailability`).
 */
class ViewRenderer {
  carriesUnavailable = false;
  private readonly textAvailability: TextAvailability;

  constructor(
    private readonly graph: WorkspaceGraph,
    private readonly textModel: WorkspaceTextModel,
    private readonly withText: boolean,
  ) {
    this.textAvailability = new TextAvailability(graph);
  }

  /** The 12.7 unavailability marker, counted toward the exit (SPEC 11.2). */
  private unavailable(): JsonObject {
    this.carriesUnavailable = true;
    return unavailableJson();
  }

  /** One `{"file", "root", "imports", "occurrences", "comments"}` entry. */
  fileView(entry: RequestedSpec): JsonObject {
    const { spec, pathValid } = entry;
    const document = spec.document;
    // SPEC 11.2: a section's node identity is defined per the spelling and
    // chain rules — and in a file whose own path is invalid (SPEC 14.19)
    // no node has a defined identity, whatever the content spells.
    const defined = pathValid ? definedIdentitySections(document) : null;
    // SPEC 11.4: the file's own occurrence records, in document order —
    // the graph's occurrence order restricted to one file (SPEC 5.7).
    const records = selectOccurrences(
      this.graph,
      new ConsultedDomain([document.file]),
    );
    if (records.some((record) => record.source === null)) {
      // The source datum is reported explicitly unavailable (SPEC 11.2).
      this.carriesUnavailable = true;
    }
    return {
      file: pathTextJson(document.file),
      root: this.nodeJson(document, document.root, defined),
      imports: spec.imports.imports.map((declaration) => ({
        range: rangeJson(declaration.statement.range),
        // SPEC 11.4: the default binding's identifier — structurally
        // absent (null, never unavailable) where the declaration binds no
        // default.
        name: declaration.bindingName,
        // SPEC 11.4/11.2: the resolved target where specifier form and
        // discovery define one, explicitly unavailable otherwise.
        target:
          declaration.designatedFile === null
            ? this.unavailable()
            : pathTextJson(declaration.designatedFile),
      })),
      occurrences: records.map(occurrenceRecordJson),
      comments: document.comments.map((comment) => rangeJson(comment.range)),
    };
  }

  /**
   * One node of the positional section tree (SPEC 11.4, 12.7): the
   * `{"identity", "range", "opening", "closing", "attributes", "tags",
   * "coverage", "children"}` form plus `"ownText"`/`"subtreeText"` exactly
   * when `--text` is given. The tree is built iteratively — children before
   * parents over an explicit stack — so a pathologically deep nesting tower
   * cannot exhaust the call stack (the answer covers any parseable file).
   */
  private nodeJson(
    document: SpecDocument,
    section: SpecSection,
    defined: ReadonlySet<SpecSection> | null,
  ): JsonObject {
    // Pre-order collection (parents before descendants), then a reverse
    // build pass so every node's children are built when the node is.
    const order: SpecSection[] = [];
    const pending: SpecSection[] = [section];
    while (pending.length > 0) {
      const current = pending.pop() as SpecSection;
      order.push(current);
      for (const child of current.children) {
        pending.push(child);
      }
    }
    const built = new Map<SpecSection, JsonObject>();
    for (let index = order.length - 1; index >= 0; index -= 1) {
      const current = order[index];
      const children = current.children.map(
        (child) => built.get(child) as JsonObject,
      );
      built.set(
        current,
        this.sectionJson(document, current, defined, children),
      );
    }
    return built.get(section) as JsonObject;
  }

  /** The one-node body of `nodeJson`, its children already rendered. */
  private sectionJson(
    document: SpecDocument,
    section: SpecSection,
    defined: ReadonlySet<SpecSection> | null,
    children: readonly JsonObject[],
  ): JsonObject {
    const isRoot = section.parent === null;
    // SPEC 11.2: the identity datum — the root's is defined exactly when
    // the file's path is valid; a section's when the spelling, chain, and
    // uniqueness rules define it.
    const identity =
      defined === null
        ? this.unavailable()
        : isRoot
          ? document.path
          : defined.has(section)
            ? `${document.path}#${section.id ?? ""}`
            : this.unavailable();
    // SPEC 11.2/12.7: with `--text`, all-or-nothing over transitive
    // expansion — where defined the value is exact, one unresolved
    // spelling or embedding cycle on the path makes the whole value
    // unavailable; without the flag the members are absent (the stated
    // conditional presence — `undefined` members are omitted by the
    // canonical serializer).
    const ownText = !this.withText
      ? undefined
      : this.textAvailability.ownTextDefined(document, section)
        ? this.textModel.ownText(document, section)
        : this.unavailable();
    const subtreeText = !this.withText
      ? undefined
      : this.textAvailability.subtreeTextDefined(document, section)
        ? this.textModel.subtreeText(document, section)
        : this.unavailable();
    return {
      identity,
      range: rangeJson(section.range),
      // SPEC 11.4: the construct range's decomposition — a self-closing
      // section has an opening-tag range only (the whole tag), the root
      // neither.
      opening: isRoot ? null : rangeJson(section.openingTagRange),
      closing:
        isRoot || section.selfClosing
          ? null
          : rangeJson(section.closingTagRange),
      // SPEC 11.4: raw attribute spellings as parsed, one entry per
      // spelled attribute in tag order — inclusion is by form.
      attributes: section.attributes.map((attribute) => ({
        name: attribute.name,
        range: rangeJson(attribute.range),
        text: attribute.text,
      })),
      // SPEC 11.4/11.2: a root's tags and coverage attribute are
      // structurally absent — the stated null, never unavailable; a
      // section's are plain where its parsed attributes define them
      // unambiguously, explicitly unavailable otherwise.
      tags: isRoot
        ? null
        : section.tagsDefined
          ? [...section.tags]
          : this.unavailable(),
      coverage: isRoot
        ? null
        : section.coverageDefined
          ? section.coverage
          : this.unavailable(),
      children,
      ownText,
      subtreeText,
    };
  }
}
