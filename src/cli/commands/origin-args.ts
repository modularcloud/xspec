// The origin-operand argument checks `rename` and `move` share (SPEC 6.4,
// 6.5, 12.0).
//
// SPEC 6.4: "A `<file>` or old ID that does not exist is a usage error
// (12.0); so is a `<file>` naming a discovered source that is not a spec
// source — a code source bears no requirement IDs, so a code-source origin
// is a wrong-kind operand, the usage error of 11.4's pattern (12.0), judged
// like existence before any content question; the old ID's existence is
// parse-local, judged over spelled identities (11.2) … and an unparseable
// origin file is masked (12.0)." SPEC 6.5 mirrors it for both of `move`'s
// forms: "existence and kind judged as in 6.4, both forms' origin operands
// naming discovered spec sources".
//
// Existence and kind are judged over every discovered file, as 11.4's
// operand membership is — through ./discovered-file.ts, the judgement the
// gated reads' identity checks share (SPEC 12.0). A discovered file whose
// own path 14.19 rejects — one containing `#` or U+FFFD, or a spec-group
// file without the `.mdx` extension or holding a character 7.1 bars — is
// a discovered source of its kind all the same (SPEC 11.2, 14.19). A
// spec-kind one is a spec source by kind: it passes the file check, and
// the old ID is judged over its spelled identities, its structure being
// parse-local though none of its node identities is defined (SPEC 11.2).
// A code-kind one is a wrong-kind operand like any other discovered code
// source. SPEC 12.0: a bare `<file>` operand is a whole path — `#` has no
// delimiter role in it — so `rename specs/a#b.mdx …` names the discovered
// file of that invalid path, while `move`'s operands are classified by
// spelling (SPEC 6.5), the file part of each holding no `#`. A workspace
// discovering such an origin fails `build`'s validations (its 14.19
// finding at least), so once the argument checks pass, the
// invalid-workspace refusal of 6.4 follows (exit 1), no refusal reason
// evaluated.
//
// Comparison is byte-wise against the discovered paths (SPEC 12.0, 1.5): an
// argument value is valid UTF-8 free of U+FFFD (the parser's malformed-value
// check), so it never names a non-UTF-8 or U+FFFD-bearing path.

import type { SpecFileAnalysis } from "../../core/graph.js";
import type { WorkspaceAnalysis } from "../../workspace/pipeline.js";
import { judgeDiscoveredFile } from "./discovered-file.js";

/** How the discovered set classifies an origin `<file>` (SPEC 6.4, 6.5). */
export type OriginFileJudgement =
  /** No configured group discovers the path: an unknown file (SPEC 12.0). */
  | { readonly kind: "unknown" }
  /**
   * A discovered code source, valid path or not: the wrong-kind operand
   * (SPEC 6.4, 12.0) — the kind is discovery's, never masked.
   */
  | { readonly kind: "wrong-kind" }
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
       * The origin's parse — null where the analysis holds none: an
       * unparseable origin, or one whose content the environment refused
       * (SPEC 14.20, 14.25), which masks the old ID's existence (SPEC 12.0,
       * 14).
       */
      readonly parsed: SpecFileAnalysis | null;
    };

/**
 * Judge an origin `<file>` operand against the analysis's discovered set
 * (module header): its existence and kind, and for a spec source its parse.
 */
export function judgeOriginFile(
  analysis: WorkspaceAnalysis,
  file: string,
): OriginFileJudgement {
  const judged = judgeDiscoveredFile(analysis, file);
  switch (judged.kind) {
    case "unknown":
      return { kind: "unknown" };
    case "code":
      // SPEC 6.4: a discovered code source, valid path or not, is the
      // wrong-kind operand — judged like existence, before any content
      // question.
      return { kind: "wrong-kind" };
    case "spec":
      return {
        kind: "spec",
        pathValid: judged.pathValid,
        parsed: judged.parsed,
      };
  }
}

/**
 * SPEC 6.4 (6.5 alike), 11.2: whether the parsed origin spells `id` — the
 * old ID exists exactly when a section of the file spells it, a bearer
 * whose node identity is undefined (duplicate spellings, an undefined
 * ancestor chain, an invalid path) included; a section spelling no
 * identity has a null `SpecSection.id` (core/mdx.ts) and establishes none.
 */
export function originSpellsId(origin: SpecFileAnalysis, id: string): boolean {
  return origin.document.sections.some((section) => section.id === id);
}
