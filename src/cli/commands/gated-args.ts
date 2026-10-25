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
//   wrong-kind operand of 12.0; for `<graph-node>` either kind — judged
//   over every discovered file by kind, as 6.4 judges the origin file
//   (./discovered-file.ts). SPEC 11.1: "a path in no configured group is
//   unknown", and a discovered file whose own path 14.19 rejects lies in a
//   configured group: a spec-kind one is a discovered path of the spec
//   kind, its structure parse-local though none of its node identities is
//   defined (SPEC 11.2). An identity value names one where its path has a
//   UTF-8 spelling free of `#` and U+FFFD — a spec-group file without the
//   `.mdx` extension (`specs/n.txt` under a spec glob `specs/*.txt`), or
//   one whose path holds a character 7.1 bars (`specs/it's.mdx`). A
//   code-kind one's path holds `#` or U+FFFD or is not valid UTF-8, so no
//   well-formed value's path part — split at the value's one `#`, valid
//   UTF-8 free of U+FFFD (SPEC 12.0) — ever names it; it is judged as a
//   code path all the same, keeping the checks total;
// - an id is judged over the named file's spelled identities (SPEC 11.2) —
//   a section spells an identity exactly when exactly one `id` attribute
//   occurs on its tag with a quoted static-string value, that value the
//   spelled identity, well-formed or not (core/mdx.ts `SpecSection.id`);
// - a code unit is judged over the named file's named units (SPEC 4.6);
// - an unparseable named file, or one whose content the environment
//   refused (SPEC 14.20, 14.25), masks the id/unit half of the check as in
//   6.4: the check passes here and the gated report of 13.3 exits 1.
//
// Each check is judged from what it consults — discovery and the named
// file's parse — identically on valid and failing workspaces (SPEC 12.0).
// A check passing on a 14.19 member's path leads to the gated report: the
// member's own 14.19 finding fails `build`'s validations (SPEC 12.1, 13.3).
// On a valid workspace every discovered path is valid, a spelled identity
// is a defined identity, and a named unit a code location (SPEC 11.2,
// 12.1), so these judgments agree exactly with the graph-based resolution
// the answer then runs (query-core.ts), whose message builders they share,
// so either judgment reports byte-identically (SPEC 12.0).

import type { CodeAnalysis } from "../../core/code-analysis.js";
import type { SpecDocument } from "../../core/mdx.js";
import type { WorkspaceAnalysis } from "../../workspace/pipeline.js";
import { judgeDiscoveredFile } from "./discovered-file.js";
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

/**
 * SPEC 11.2: whether the parsed file spells `id` — some section's exactly-one
 * quoted-static `id` attribute carries this exact value (well-formed or not;
 * `SpecSection.id` is null in every other case, and null for the root). A
 * 14.19 member's sections spell identities like any file's, though none of
 * its node identities is defined.
 */
function spellsIdentity(document: SpecDocument, id: string): boolean {
  return document.sections.some((section) => section.id === id);
}

/**
 * SPEC 4.6: whether the value names one of the file's named units — the
 * whole-file location for a bare path, else a unit whose `chain`
 * (`@N`-disambiguated) equals the value's unit part. The unit part is
 * compared, not the whole identity, so the judgement holds over a 14.19
 * member's analysis too, whose unit identities are formed over a stand-in
 * path (core/code-analysis.ts); for a valid file the two comparisons agree.
 * Judged over the parse where one exists; the kind itself is discovery's
 * (an unparseable code file still classifies as a code location for the
 * wrong-kind judgment — the id/unit half is what an unparseable file
 * masks).
 */
function namesCodeLocation(
  analysis: CodeAnalysis | null,
  split: SplitIdentity,
): boolean {
  if (split.rest === undefined) {
    return true;
  }
  if (analysis === null) {
    return true; // masked: the unit cannot be judged (SPEC 12.0, 14.20)
  }
  // `unit.identity` is `${analysis.path}#${unit part}` (SPEC 4.6).
  const unitStart = analysis.path.length + 1;
  return analysis.units.some(
    (unit) => unit.identity.slice(unitStart) === split.rest,
  );
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
  const split = splitIdentity(raw);
  const named = judgeDiscoveredFile(analysis, split.path);
  switch (named.kind) {
    case "spec":
      if (named.parsed === null) {
        return null; // masked: an unparseable named file (SPEC 12.0, 14.20)
      }
      if (
        split.rest === undefined ||
        spellsIdentity(named.parsed.document, split.rest)
      ) {
        return null;
      }
      return unknownNodeMessage(raw);
    case "code":
      // SPEC 12.0: a code source named where a requirement-node identity
      // is required is the wrong-kind operand — the kind is discovery's,
      // never masked. The diagnostic mirrors the graph-based resolution
      // exactly (query-core.ts `resolveRow`): a value naming a code
      // location gets the wrong-kind message, one naming no unit of the
      // file the unknown one.
      return namesCodeLocation(named.parsed, split)
        ? codeLocationNodeMessage(raw)
        : unknownNodeMessage(raw);
    case "unknown":
      return unknownNodeMessage(raw);
  }
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
  const split = splitIdentity(raw);
  const named = judgeDiscoveredFile(analysis, split.path);
  switch (named.kind) {
    case "spec":
      if (named.parsed === null) {
        return null; // masked (SPEC 12.0, 14.20)
      }
      if (
        split.rest === undefined ||
        spellsIdentity(named.parsed.document, split.rest)
      ) {
        return null;
      }
      return unknownGraphNodeMessage(flag, raw);
    case "code":
      if (named.parsed === null) {
        return null; // masked (SPEC 12.0, 14.20)
      }
      return namesCodeLocation(named.parsed, split)
        ? null
        : unknownGraphNodeMessage(flag, raw);
    case "unknown":
      return unknownGraphNodeMessage(flag, raw);
  }
}
