// Parse-local argument checks of the gated reads (SPEC 12.0, 13.3).
//
// SPEC 12.0: the reads 13.3 gates (`ids`, `show`, `coverage`, `impact`,
// `review`, `query`) run their argument checks before the invalid-workspace
// report of 13.3 — a usage-error argument exits 2 whatever findings the
// workspace carries. A requirement-node or graph-node identity is judged
// parse-local against the named file, as 6.4 judges rename's old ID:
//
// - the path part must be a discovered path of the identity's kind
//   (SPEC 11.1) — for `<node>` a spec source, a code source being the
//   wrong-kind operand of 12.0; for `<graph-node>` either kind;
// - an id is judged over the named file's spelled identities (SPEC 11.2) —
//   a section spells an identity exactly when exactly one `id` attribute
//   occurs on its tag with a quoted static-string value, that value the
//   spelled identity, well-formed or not (core/mdx.ts `SpecSection.id`);
// - a code unit is judged over the named file's named units (SPEC 4.6);
// - an unparseable named file masks the id/unit half of the check as in
//   6.4: the check passes here and the gated report of 13.3 exits 1.
//
// Each check is judged from what it consults — discovery and the named
// file's parse — identically on valid and failing workspaces (SPEC 12.0).
// On a valid workspace a spelled identity is a defined identity and a named
// unit a code location (SPEC 11.2, 12.1), so these judgments agree exactly
// with the graph-based resolution the answer then runs (query-core.ts) —
// and they share its message builders, so the store-backed fast path
// (query-fast.ts), which judges against the verified store, reports
// byte-identically (SPEC 12.0).

import type { CodeAnalysis } from "../../core/code-analysis.js";
import type { SpecDocument } from "../../core/mdx.js";
import type { WorkspaceAnalysis } from "../../workspace/pipeline.js";
import {
  codeLocationNodeMessage,
  unknownGraphNodeMessage,
  unknownNodeMessage,
} from "./query-core.js";

/** A `<node>`/`<graph-node>` value split at its `#` (SPEC 12.0, 1.5). */
interface SplitIdentity {
  readonly path: string;
  /** The id or unit part — undefined for a bare path. */
  readonly rest: string | undefined;
}

/** Split at the `#` (the parser rejects multi-`#` spellings, SPEC 12.0). */
function splitIdentity(raw: string): SplitIdentity {
  const hash = raw.indexOf("#");
  if (hash === -1) {
    return { path: raw, rest: undefined };
  }
  return { path: raw.slice(0, hash), rest: raw.slice(hash + 1) };
}

/** The parse-local view of the named file the checks consult. */
interface NamedFileDomain {
  /** Discovered spec-source paths (valid paths only, SPEC 14.19/12.0). */
  readonly specPaths: ReadonlySet<string>;
  /** Discovered code-source paths (valid paths only). */
  readonly codePaths: ReadonlySet<string>;
  /** Parsed spec documents by path — absent = unparseable (SPEC 14.20). */
  readonly spec: (path: string) => SpecDocument | undefined;
  /** Parsed code analyses by path — absent = unparseable (SPEC 14.20). */
  readonly code: (path: string) => CodeAnalysis | undefined;
}

/** The checks' domain over the analyzed workspace (pipeline.ts). */
function domainOf(analysis: WorkspaceAnalysis): NamedFileDomain {
  const { classification } = analysis;
  const specs = new Map(
    analysis.specs.map((spec) => [spec.document.path, spec.document]),
  );
  const code = new Map(analysis.code.map((entry) => [entry.path, entry]));
  return {
    specPaths: new Set(classification.specSources.map((source) => source.path)),
    codePaths: new Set(classification.codeSources.map((source) => source.path)),
    spec: (path) => specs.get(path),
    code: (path) => code.get(path),
  };
}

/**
 * SPEC 11.2: whether the parsed file spells `id` — some section's exactly-one
 * quoted-static `id` attribute carries this exact value (well-formed or not;
 * `SpecSection.id` is null in every other case, and null for the root).
 */
function spellsIdentity(document: SpecDocument, id: string): boolean {
  return document.sections.some((section) => section.id === id);
}

/**
 * SPEC 4.6: whether the value names one of the file's named units — the
 * whole-file location for a bare path, else a unit whose `path#chain`
 * (`@N`-disambiguated) identity equals the value. Judged over the parse
 * where one exists; the kind itself is discovery's (an unparseable code
 * file still classifies as a code location for the wrong-kind judgment —
 * the id/unit half is what an unparseable file masks).
 */
function namesCodeLocation(
  analysis: CodeAnalysis | undefined,
  raw: string,
  split: SplitIdentity,
): boolean {
  if (split.rest === undefined) {
    return true;
  }
  if (analysis === undefined) {
    return true; // masked: the unit cannot be judged (SPEC 12.0, 14.20)
  }
  return analysis.units.some((unit) => unit.identity === raw);
}

/**
 * The `<node>` argument check of `show` and `query node`/`subtree`/
 * `ancestors` (SPEC 12.4, 11.1 → 12.0), parse-local per the module header.
 * Returns the usage-error diagnostic, or null when the check passes — an
 * unknown name or wrong-kind operand exits 2 whatever findings the
 * workspace carries; a masked (unparseable) named file passes, the gated
 * report of 13.3 then exiting 1.
 */
export function nodeOperandProblem(
  analysis: WorkspaceAnalysis,
  raw: string,
): string | null {
  const domain = domainOf(analysis);
  const split = splitIdentity(raw);
  if (domain.specPaths.has(split.path)) {
    const document = domain.spec(split.path);
    if (document === undefined) {
      return null; // masked: an unparseable named file (SPEC 12.0, 14.20)
    }
    if (split.rest === undefined || spellsIdentity(document, split.rest)) {
      return null;
    }
    return unknownNodeMessage(raw);
  }
  if (domain.codePaths.has(split.path)) {
    // SPEC 12.0: a code source named where a requirement-node identity is
    // required is the wrong-kind operand — the kind is discovery's, never
    // masked. The diagnostic mirrors the graph-based resolution exactly
    // (query-core.ts `resolveRow`): a value naming a code location gets the
    // wrong-kind message, one naming no unit of the file the unknown one.
    return namesCodeLocation(domain.code(split.path), raw, split)
      ? codeLocationNodeMessage(raw)
      : unknownNodeMessage(raw);
  }
  return unknownNodeMessage(raw);
}

/**
 * The `<graph-node>` flag-value check of `query edges`/`reachable`
 * (SPEC 11.1 → 12.0), parse-local per the module header: any graph-node
 * identity — a requirement node or a code location. Returns the
 * usage-error diagnostic, null when the check passes (a masked named file
 * passing as above).
 */
export function graphNodeValueProblem(
  analysis: WorkspaceAnalysis,
  flag: string,
  raw: string,
): string | null {
  const domain = domainOf(analysis);
  const split = splitIdentity(raw);
  if (domain.specPaths.has(split.path)) {
    const document = domain.spec(split.path);
    if (document === undefined) {
      return null; // masked (SPEC 12.0, 14.20)
    }
    if (split.rest === undefined || spellsIdentity(document, split.rest)) {
      return null;
    }
    return unknownGraphNodeMessage(flag, raw);
  }
  if (domain.codePaths.has(split.path)) {
    const parsed = domain.code(split.path);
    if (parsed === undefined) {
      return null; // masked (SPEC 12.0, 14.20)
    }
    if (split.rest === undefined || namesCodeLocation(parsed, raw, split)) {
      return null;
    }
    return unknownGraphNodeMessage(flag, raw);
  }
  return unknownGraphNodeMessage(flag, raw);
}
