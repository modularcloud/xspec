// The discovered file a workspace-relative path names, judged by kind over
// every discovered file (SPEC 7, 11.1, 11.2, 14.19) — the membership step
// the parse-local argument checks share: `rename`'s and `move`'s origin
// file (SPEC 6.4, 6.5; ./origin-args.ts) and the path part of the gated
// reads' `<node>` and `<graph-node>` values (SPEC 12.0, 11.1;
// ./gated-args.ts), which 12.0 judges "as 6.4 judges the old ID".
//
// SPEC 11.1: "whether a bare path names a root node or a code file follows
// from the file's group (7), and a path in no configured group is unknown
// (12.0)". A discovered file whose own path 14.19 rejects — one containing
// `#` or U+FFFD or not valid UTF-8, or a spec-group file without the `.mdx`
// extension or whose path holds a character 7.1 bars — lies in a
// configured group all the same: it is a discovered file of its group's
// kind, its structure parse-local though none of its node identities is
// defined (SPEC 11.2, 14.19). So the judgement reports, for every
// discovered file, its kind, whether its own path is valid, and its parse
// where the analysis holds one. An unparseable file, or one whose content
// the environment refused (SPEC 14.20, 14.25), has none, which masks every
// content question a check would ask of it (SPEC 12.0, 14).
//
// Comparison is byte-wise against the discovered paths (SPEC 12.0, 1.5): an
// argument value is valid UTF-8 free of U+FFFD (the parser's malformed-value
// check), so it never names a non-UTF-8 or U+FFFD-bearing path, and string
// equality with a valid path is byte equality.

import type { CodeAnalysis } from "../../core/code-analysis.js";
import type { SpecFileAnalysis } from "../../core/graph.js";
import { pathTextKey } from "../../core/path-text.js";
import type { WorkspaceAnalysis } from "../../workspace/pipeline.js";

/** How the discovered set classifies a workspace-relative path. */
export type DiscoveredFileJudgement =
  /** No configured group discovers the path: an unknown file (SPEC 12.0). */
  | { readonly kind: "unknown" }
  /** A discovered spec source by kind, valid path or not (SPEC 14.19). */
  | {
      readonly kind: "spec";
      /**
       * Whether the file's own path is valid — false for a 14.19 member,
       * whose `document.path` is a never-rendered stand-in (core/mdx.ts)
       * and whose presence fails `build`'s validations.
       */
      readonly pathValid: boolean;
      /**
       * The file's parse — null where the analysis holds none: an
       * unparseable file, or one whose content the environment refused
       * (SPEC 14.20, 14.25).
       */
      readonly parsed: SpecFileAnalysis | null;
    }
  /** A discovered code source by kind, valid path or not (SPEC 14.19). */
  | {
      readonly kind: "code";
      /**
       * Whether the file's own path is valid — false for a 14.19 member,
       * whose `path` is a never-rendered stand-in (core/code-analysis.ts).
       */
      readonly pathValid: boolean;
      /** The file's parse — null as for a spec source (SPEC 14.20, 14.25). */
      readonly parsed: CodeAnalysis | null;
    };

/**
 * Judge a workspace-relative path against the analysis's discovered set
 * (module header): its existence and kind, and the file's parse.
 */
export function judgeDiscoveredFile(
  analysis: WorkspaceAnalysis,
  file: string,
): DiscoveredFileJudgement {
  const { classification } = analysis;
  if (classification.specSources.some((source) => source.path === file)) {
    return {
      kind: "spec",
      pathValid: true,
      parsed:
        analysis.specs.find((spec) => spec.document.path === file) ?? null,
    };
  }
  if (classification.codeSources.some((source) => source.path === file)) {
    return {
      kind: "code",
      pathValid: true,
      parsed: analysis.code.find((entry) => entry.path === file) ?? null,
    };
  }
  // SPEC 14.19, 11.2: a discovered file whose own path is invalid, matched
  // by its exact bytes (`pathTextKey`); its analysis carries the real path
  // as `file`.
  const key = pathTextKey(file);
  const invalid = classification.invalidSources.find(
    (source) => pathTextKey(source.path) === key,
  );
  if (invalid === undefined) {
    return { kind: "unknown" };
  }
  if (invalid.kind === "spec") {
    return {
      kind: "spec",
      pathValid: false,
      parsed:
        analysis.invalidPathSpecs.find(
          (spec) => pathTextKey(spec.document.file) === key,
        ) ?? null,
    };
  }
  return {
    kind: "code",
    pathValid: false,
    parsed:
      analysis.invalidPathCode.find(
        (entry) => pathTextKey(entry.file) === key,
      ) ?? null,
  };
}
