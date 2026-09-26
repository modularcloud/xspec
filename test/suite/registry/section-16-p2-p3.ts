// TEST-SPEC §16 P-2 + P-3 (Markdown compilation / text algebra) — PROP-02.
//
// Two registered product-facing property tests (C-2 "one code path") sharing
// one seeded random-document generator (helpers/property.ts, H-10; fixed seed
// set in CI, E-5). Each trial generates a workspace of 1–3 `.mdx` spec
// sources composed of prose blocks — fenced code blocks and inline code
// spans spelling tag-, import-, and expression-like bytes included (T3-1's
// grammar boundary: such bytes are content) — nested sections, imports,
// single- and multi-line MDX comments, and same-file and cross-file
// `{text(...)}` embeddings, over mixed line terminators (LF, CRLF, lone CR),
// with content weighted toward the whitespace/non-whitespace boundary code
// points of SPEC 1.4 (U+00A0, U+0085, U+2028 included) — exactly the P-2
// input space.
//
//   * P-2 — for every file, `build` under `markdown: { emit: true }` emits
//     Markdown byte-equal to the independent harness oracle
//     (helpers/oracles/markdown.ts, S-6-vetted; H-4 byte assertions);
//     compilation is deterministic (H-6: the identical workspace built in a
//     second directory yields byte-identical emissions); and content bytes
//     outside removed constructs are preserved — asserted directly, without
//     the oracle: every logical line no construct touches must appear
//     verbatim, in order, in the emitted output (such a line can never drop:
//     the SPEC 3 drop rule fires only for lines left empty or
//     whitespace-only *purely by removals*).
//   * P-3 — the text algebra of SPEC 1.6, asserted purely as internal
//     consistency of the product's own reported values (no oracle): the root
//     node's subtree text equals the file's compiled Markdown output
//     byte-for-byte, and every node's subtree text equals its own-text runs
//     interleaved with its children's subtree texts in document order — N
//     children yielding N + 1 runs, so |subtree| = |own| + Σ|child subtree|
//     and a run decomposition exists that splits the reported own text into
//     exactly N + 1 runs (empty runs counting) around the children's
//     reported subtree texts.
//
// CONF-MD in-scope (CERTIFICATIONS.md): both properties run against the
// CONF-MD conformer, and P-2 is certified by §VIOL-MD-CLASS (the line-drop
// rule classifying U+00A0/U+0085/U+2028 as whitespace) and §VIOL-MD-CR (a
// lone U+000D not recognized as a line terminator). The generator reaches
// both flip classes deterministically under the fixed seed set: comment
// lines left holding only boundary code points after removal (kept by SPEC
// 1.4/3, dropped under the CLASS deviation), and lone-CR terminators on and
// around removal-affected lines (line extents, and therefore drops and kept
// bytes, diverge under the CR deviation) — verified by a per-seed dry-run
// against deviation-simulating oracles at implementation time, and
// re-verified per seed against the violator executables themselves when the
// fence/code-span staging landed (the choice streams shifted). P-3 asserts
// only product-internal consistency, which both violators preserve
// ("consistently in Markdown output and, through 1.6, in own and subtree
// text"), so P-3 passes against every CONF-MD fixture while P-2 fails
// against exactly the violators. The bodies stay within the CONF-MD command
// surface: `build` plus `query node` decoded through the scoped own/subtree
// text adapter (decodeNodeTextSummary) — nothing beyond own and subtree
// text is demanded of a scoped fixture product.
//
// Staging discipline (byte-exact per HARNESS-01; the generator, not the
// oracle, owns these choices):
//   * Generated free prose draws from an alphabet that excludes
//     MDX-structural characters — `<`, `{`, `}`, backtick, `~`, `>`, `&`,
//     `\` — so a prose byte can never open a fence, JSX tag, expression
//     container, blockquote lazy-continuation, or character reference that
//     would make the product's construct parse diverge from the generator's
//     structure — and the inline-delimiter punctuation `*`, `_`, `[`, `]`,
//     `(`, `)`, whose CommonMark pairs (emphasis, links) can straddle an
//     inline section's tag within a paragraph, a shape the MDX grammar
//     rejects (S-9: every composed form derives; `P2_P3_FORM_VECTORS`
//     below is the fixed vector set, and every draw is checked before the
//     product sees it). Everything else (the remaining Markdown
//     punctuation included) is plain content to SPEC 3, which never
//     interprets Markdown semantics.
//   * Backticks and `~` appear only inside deliberately staged fenced code
//     blocks and inline code spans (T3-1's grammar boundary, the P-2 entry's
//     named inclusion) — complete by construction and within the grammar
//     subset every certified model shares: fences open at column 0 with a
//     run of 3–4 backticks or tildes plus an optional backtick-free
//     identifier info string, close with a bare run of the same character
//     and length, and hold interior lines that never spell a fence marker
//     (the interior alphabet has no backtick or `~`); code spans are
//     single-line, open and close with equal-length runs of 1–2 backticks,
//     and hold a non-empty backtick-free interior (an empty interior would
//     merge the two runs into one). Interior bytes spell the construct-like
//     forms T3-1 fixes — `<S id="x">`, `<div>`,
//     `import X from "./X.xspec"`, `{text("a")}` — plus free prose. Every
//     fence and span byte is a `content` entry: constructs exist only where
//     the MDX parse yields them, so the oracle treats these bytes as
//     content (preserved verbatim; their lines carry the marker or span
//     runs as non-whitespace, and interior blank or whitespace-only lines
//     are untouched lines, kept), and the direct byte-preservation
//     assertion sees them as ordinary untouched lines.
//   * Section tags and imports are single-line and ASCII; the exotic bytes
//     live in content, where P-2 aims them. Comments take every form of
//     SPEC 2.7 and embeddings every form of 2.3 (`mdxComment`,
//     `embeddingContainer` below: `{}`, block-comment sequences,
//     line-comment containers ended by a drawn terminator, the run-on
//     `{// c}` form, ECMAScript-only whitespace between braces; whitespace
//     and comments beside a `text(...)` call — T2.7-4's and T2.3-3's positive
//     forms), and an ESM block carries JavaScript comments beside its
//     imports and `;`-terminated declarations (T3-7). Multi-line containers
//     carry 1–2 internal terminators and no internal blank line (MDX
//     expressions admit none); the comment alphabets contain no `/` or `*`,
//     so a premature `*/` cannot form, and a line comment's alphabet has no
//     U+2028 or U+2029, at which the lexical grammar would end it while
//     14.20's deletion judgement runs on (T2.7-4's negative arms).
//   * A generated line's lead never opens a CommonMark container (a list
//     item: `-` or digits with `.`/`)`, then whitespace, after any
//     indentation) or an ATX heading (`#`s then whitespace): inside a
//     container the continuation line of a multi-line expression is a lazy
//     line the grammar rejects, and a heading ends at its line, so a
//     multi-line container it hosts never closes (`opensBlockConstruct`,
//     applied by `keptProse`). Every other lead — `-a`, `9.a`, `#{`, `---`
//     (a thematic break), a setext underline — is harmless.
//   * Line terminators are drawn per line; a deterministic guard keeps a
//     lone-CR terminator from being followed by an empty line's LF (the two
//     bytes would merge into one CRLF terminator and desynchronize the
//     generator's line model from the bytes on disk).
//   * Every file begins (after imports) with one construct-free plain-prose
//     line, so no file compiles to empty output — whether an all-dropped
//     source emits a zero-byte file is not a SPEC 3 question and not staged.
//   * Embedding and `d` references target only sections already closed
//     (earlier in the same file, or any section of an imported earlier
//     file): references resolve, no target is an ancestor, and the embeds
//     graph is acyclic by construction (SPEC 5.3), so expansions are
//     computable bottom-up in definition order.
//   * Embedding targets are restricted to shapes whose subtree text SPEC
//     1.6/3 pins exactly: self-closing sections (empty), single-line inline
//     sections hosted on lines guaranteed to keep (their interior bytes),
//     and block sections whose opening and closing tags stand alone on
//     their lines (the compiled interior — the drop rule is line-local, so
//     the interior compiles compositionally; validated against T3-2's
//     hand-derived chain).

import { decodeNodeTextSummary } from "../../helpers/adapters/index.js";
import type { NodeTextSummary } from "../../helpers/adapters/index.js";
import {
  assertFileBytes,
  assertFilesEqual,
  fail,
} from "../../helpers/assertions.js";
import type { MarkdownPiece } from "../../helpers/oracles/markdown.js";
import { compileMarkdown } from "../../helpers/oracles/markdown.js";
import type { Choices, DrawSource, Gen } from "../../helpers/property.js";
import { checkProperty, listOf } from "../../helpers/property.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import { TestWorkspace, mdxPathsOf } from "../../helpers/workspace.js";
import { buildOk, runJson } from "./support.js";

// Minimal declarative configuration (SPEC 7): one spec group, emission
// enabled with the default destination next to each source (SPEC 7.3, 13.2).
// The spec-group glob matches only `.mdx` files, so no glob matches a
// Markdown emit destination.
const EMIT_TRUE_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  markdown: { emit: true }
})
`;

/** The character with the given code point (hex-spelled, tool-safe). */
function cp(codePoint: number): string {
  return String.fromCodePoint(codePoint);
}

const TAB = cp(0x0009);
const LF = cp(0x000a);
const VT = cp(0x000b);
const FF = cp(0x000c);
const CR = cp(0x000d);
const SPACE = cp(0x0020);
const CRLF = CR + LF;
// The SPEC 1.4 boundary code points: neither whitespace nor terminators.
const NBSP = cp(0x00a0);
const NEL = cp(0x0085);
const LS = cp(0x2028);
// ECMAScript's remaining line terminator and its zero-width no-break space:
// whitespace between braces and within an ESM block (SPEC 14.20), content
// bytes everywhere else (1.4).
const PS = cp(0x2029);
const FEFF = cp(0xfeff);
// Fence and code-span marker characters — staged only inside deliberately
// constructed fences and spans, never drawn into free prose (module header).
const BACKTICK = cp(0x0060);
const TILDE = cp(0x007e);

// ---------------------------------------------------------------------------
// Document IR
//
// The generator emits an intermediate representation the trial bodies (and
// the implementation-time dry-run) consume: per file, the source as an
// ordered entry list — plain content, removed constructs, and embeddings by
// target key — plus the requirement-node tree; per document, the registry of
// embeddable targets with the structural shape their subtree text is
// computed from. The source text is the concatenation of entry texts;
// expansion values are *not* baked in, so expected outputs can be
// materialized under SPEC rules (here) or under a simulated deviation (the
// dry-run) from one IR.

/** One segment of a generated source file, in document order. */
export type DocEntry =
  | { readonly kind: "content"; readonly text: string }
  | { readonly kind: "removal"; readonly text: string }
  | {
      /** A `{text(...)}` expression embedding the target's subtree text. */
      readonly kind: "embed";
      readonly text: string;
      readonly targetKey: string;
    };

/** How an embeddable target's subtree text is computed (module header). */
export type TargetShape =
  | { readonly kind: "empty" }
  | { readonly kind: "inline"; readonly interior: string }
  | { readonly kind: "block"; readonly interior: readonly DocEntry[] };

/** One requirement node: its identity reference and children in order. */
export interface DocNode {
  /** `path` for a root, `path#dotted.id` for a section (SPEC 1.5). */
  readonly ref: string;
  /** Direct child sections' refs, in document order (SPEC 1.6). */
  readonly childRefs: readonly string[];
}

export interface GeneratedFileDoc {
  /** Workspace-relative source path, e.g. `specs/A.mdx`. */
  readonly path: string;
  readonly entries: readonly DocEntry[];
  /** Every requirement node of the file (root included). */
  readonly nodes: readonly DocNode[];
}

export interface GeneratedDoc {
  readonly files: readonly GeneratedFileDoc[];
  /**
   * Embeddable targets by key (`path#dotted.id`), in definition order —
   * every embedding references a key defined earlier, so subtree texts are
   * computable in one forward pass.
   */
  readonly targets: ReadonlyMap<string, TargetShape>;
}

/** The generated source text of one file. */
export function sourceOf(file: GeneratedFileDoc): string {
  return file.entries.map((entry) => entry.text).join("");
}

/**
 * Materialize entries into oracle pieces, resolving each embedding to its
 * target's subtree text under the given target-subtree map.
 */
function materializePieces(
  entries: readonly DocEntry[],
  subtreeOf: ReadonlyMap<string, string>,
): MarkdownPiece[] {
  return entries.map((entry): MarkdownPiece => {
    if (entry.kind === "embed") {
      const expansion = subtreeOf.get(entry.targetKey);
      if (expansion === undefined) {
        throw new Error(
          `P-2/P-3 generator defect: embedding references unknown target ${entry.targetKey}`,
        );
      }
      return { kind: "embedding", text: entry.text, expansion };
    }
    return { kind: entry.kind, text: entry.text };
  });
}

/**
 * Subtree text of every embeddable target under SPEC 1.6/3, bottom-up in
 * definition order (targets only reference earlier targets): a self-closing
 * section is an empty leaf (SPEC 1.1); an inline section on a kept line
 * contributes its interior bytes exactly; a block section with own-line tags
 * contributes its compiled interior — the drop rule is line-local, so whole
 * interior lines compile identically in isolation (validated against T3-2's
 * hand-derived expansions).
 */
export function specSubtreeTexts(doc: GeneratedDoc): Map<string, string> {
  const subtreeOf = new Map<string, string>();
  for (const [key, shape] of doc.targets) {
    switch (shape.kind) {
      case "empty":
        subtreeOf.set(key, "");
        break;
      case "inline":
        subtreeOf.set(key, shape.interior);
        break;
      case "block":
        subtreeOf.set(
          key,
          compileMarkdown(materializePieces(shape.interior, subtreeOf)),
        );
        break;
    }
  }
  return subtreeOf;
}

/** Expected compiled Markdown output of every file, per the SPEC 3 oracle. */
export function specCompiledOutputs(doc: GeneratedDoc): Map<string, string> {
  const subtreeOf = specSubtreeTexts(doc);
  const outputs = new Map<string, string>();
  for (const file of doc.files) {
    outputs.set(
      file.path,
      compileMarkdown(materializePieces(file.entries, subtreeOf)),
    );
  }
  return outputs;
}

// ---------------------------------------------------------------------------
// Generators

// Weighted content alphabet (module header: MDX-structural characters
// excluded by design). Order is simplest-first: weightedPick shrinks toward
// the first entry, so counterexamples minimize toward plain `a`s.
const PROSE_ALPHABET: ReadonlyArray<readonly [number, string]> = [
  [24, "a"],
  [8, "b"],
  [4, "z"],
  [4, "K"],
  [4, "0"],
  [3, "9"],
  // 1.4 whitespace that is not a line terminator — ordinary content bytes,
  // and the drop rule's "whitespace-only" fillers.
  [6, SPACE],
  [4, TAB],
  [2, VT],
  [2, FF],
  // The boundary code points SPEC 1.4 excludes from both classes — the
  // §VIOL-MD-CLASS flip class and P-2's named weighting.
  [6, NBSP],
  [5, NEL],
  [5, LS],
  // Breadth beyond the named set: further code points a Unicode-whitespace
  // (JS regex `\s`-style) classifier would misclassify, plus multi-byte and
  // astral content so byte counting is exercised.
  [1, cp(0x2000)],
  [1, PS],
  [1, cp(0x3000)],
  [2, cp(0x00e9)],
  [1, cp(0x4e2d)],
  [1, cp(0x1f600)],
  // Markdown punctuation — plain content to SPEC 3 (compilation never
  // interprets Markdown semantics) — restricted to characters that open no
  // CommonMark inline construct: the emphasis delimiters `*` and `_` and
  // the link characters `[`, `]`, `(`, `)` are excluded because their pairs
  // can straddle an inline section's tag — within one line or across a
  // paragraph's lines — and the MDX grammar rejects a JSX element whose tag
  // lies inside an emphasis or link that closes outside it (S-9; found by
  // the fixed form vectors below). Block-level punctuation (`#`, `-`, `|`,
  // `:`, `!`, `.`) cannot pair across a tag.
  [2, "."],
  [2, "-"],
  [1, ";"],
  [1, "#"],
  [1, ","],
  [1, "|"],
  [1, ":"],
  [1, "%"],
  [1, "@"],
  [1, "?"],
  [1, "$"],
  [1, "!"],
];

const proseChar: Gen<string> = (choices) =>
  choices.weightedPick(PROSE_ALPHABET);

/** Plain keepable characters: never 1.4 whitespace, never boundary-class. */
const PLAIN_CHARS = ["a", "b", "z", "K", "0", "9", "."] as const;

const plainChar: Gen<string> = (choices) => choices.pick(PLAIN_CHARS);

/** 1.4 whitespace that is not a line terminator, simplest (space) first. */
const INLINE_WHITESPACE = [SPACE, TAB, VT, FF] as const;

const whitespaceChar: Gen<string> = (choices) =>
  choices.pick(INLINE_WHITESPACE);

/** The three boundary code points, for boundary-only residues (T3-3 arms). */
const BOUNDARY_CHARS = [NBSP, NEL, LS] as const;

const boundaryChar: Gen<string> = (choices) => choices.pick(BOUNDARY_CHARS);

function run(element: Gen<string>, min: number, max: number): Gen<string> {
  return (choices) => listOf(element, { min, max })(choices).join("");
}

/** Free prose (may be empty or whitespace-only). */
const prose: Gen<string> = run(proseChar, 0, 10);

/**
 * Whether a line beginning with `lead` would open a CommonMark container or
 * an ATX heading: after any indentation (MDX disables indented code, so no
 * amount of leading whitespace makes a code block), a list marker — `-`, or
 * one to nine digits then `.` or `)` — or one to six `#`, followed by
 * whitespace or by the end of the lead (whatever follows the lead is judged
 * as if it were whitespace, the conservative reading). `+`, `*`, and `>` are
 * not in the prose alphabet. A container makes the continuation line of a
 * multi-line expression a lazy line, which the expression grammar rejects,
 * and a heading ends at its line, so a multi-line container hosted on one
 * never closes (S-9; both found by the per-draw check).
 */
function opensBlockConstruct(lead: string): boolean {
  const isWhitespace = (char: string | undefined): boolean =>
    char === undefined || INLINE_WHITESPACE.includes(char as never);
  let i = 0;
  while (i < lead.length && isWhitespace(lead[i])) i += 1;
  let j = i;
  if (lead[j] === "-") {
    j += 1;
  } else if (lead[j] === "#") {
    while (j < lead.length && j - i < 6 && lead[j] === "#") j += 1;
  } else {
    while (j < lead.length && j - i < 9 && lead[j] >= "0" && lead[j] <= "9") {
      j += 1;
    }
    if (j === i || (lead[j] !== "." && lead[j] !== ")")) return false;
    j += 1;
  }
  return isWhitespace(lead[j]);
}

/**
 * Prose guaranteed to contain a plain non-whitespace character — a line's
 * lead, so it never opens a container or a heading (`opensBlockConstruct`:
 * a letter is prepended when the draw would; no choice is consumed).
 */
const keptProse: Gen<string> = (choices) => {
  const before = run(proseChar, 0, 4)(choices);
  const anchor = plainChar(choices);
  const after = run(proseChar, 0, 4)(choices);
  const text = before + anchor + after;
  return opensBlockConstruct(text) ? `a${text}` : text;
};

/** Plain-only prose (letters/digits/space) with a guaranteed anchor. */
const plainProse: Gen<string> = (choices) => {
  const anchor = plainChar(choices);
  const rest = run(
    (c: Choices) =>
      c.weightedPick<string>([
        [6, "a"],
        [3, "b"],
        [2, "0"],
        [3, SPACE],
      ]),
    0,
    8,
  )(choices);
  return anchor + rest;
};

// Comment interior prose: the prose alphabet contains no `/`, so a premature
// comment terminator can never form; the surrounding spaces keep the interior
// away from the comment's opening and closing brackets.
const commentProse: Gen<string> = (choices) =>
  ` ${run(proseChar, 0, 6)(choices)} `;

/** A line terminator, simplest (LF) first (mixed per line, P-2). */
const terminator: Gen<string> = (choices) =>
  choices.weightedPick<string>([
    [6, LF],
    [3, CRLF],
    [3, CR],
  ]);

// ---------------------------------------------------------------------------
// The refined container and ESM-block forms (TEST-SPEC §16 P-2: T2.7-4's
// comment forms, T2.3-3's embedding forms, T3-7's ESM-block comments)

// Line-comment interiors: the prose alphabet minus ECMAScript's line
// terminators U+2028 and U+2029 — the lexical grammar ends a line comment at
// either while 14.20's deletion judgement runs it through the first U+000A or
// U+000D alone, and the two disagreeing makes the file unparseable (T2.7-4's
// negative arms, never staged here). A block comment may hold them (a
// terminator inside one changes nothing), so block-comment interiors keep
// the whole alphabet (`commentProse`). Neither alphabet spells `/` or `*`.
const LINE_COMMENT_ALPHABET: ReadonlyArray<readonly [number, string]> =
  PROSE_ALPHABET.filter(([, char]) => char !== LS && char !== PS);

const lineCommentProse: Gen<string> = (choices) =>
  ` ${run((c: Choices) => c.weightedPick(LINE_COMMENT_ALPHABET), 0, 6)(choices)} `;

/** ECMAScript's whitespace and line terminators that 1.4 excludes (14.20). */
const ECMASCRIPT_ONLY_WHITESPACE = [NBSP, FEFF, LS, PS] as const;

const ecmascriptOnlyWhitespaceChar: Gen<string> = (choices) =>
  choices.pick(ECMASCRIPT_ONLY_WHITESPACE);

/** Whitespace beside a `text(...)` call or between comments in a container:
 * 1.4's inline whitespace and, less often, ECMAScript's own. */
const containerWhitespace: Gen<string> = run(
  (choices: Choices) =>
    choices.weightedPick<string>([
      [6, SPACE],
      [1, TAB],
      [1, NBSP],
      [1, LS],
    ]),
  1,
  2,
);

/**
 * An MDX comment container in one of 2.7's forms (T2.7-4's positive forms),
 * the usual block-comment form dominant — the certified flip classes ride the
 * residues beside it, not the form: `{}`; a block-comment sequence with
 * whitespace (ECMAScript's included) or nothing between the comments;
 * ECMAScript-only whitespace between the braces; and, when `multiLine`
 * allows, the line-comment containers — ended by a drawn terminator (LF,
 * CRLF, lone CR: 14.20 ends a line comment at U+000A or U+000D alike)
 * before the closing brace, the run-on `{// c}` form whose first brace lies
 * on the commented-out line and closes nothing, and mixed sequences. A
 * multi-line container's terminator is among its own characters: deleted
 * with it, the lines it spans merging (SPEC 3), never a line of the
 * generator's line model.
 */
function mdxComment(choices: Choices, multiLine = true): string {
  type Form =
    | "usual"
    | "empty"
    | "sequence"
    | "ecmascriptWhitespace"
    | "lineComment"
    | "runOn"
    | "blockThenLine"
    | "lineThenBlock"
    | "twoLines";
  const forms: (readonly [number, Form])[] = [
    [12, "usual"],
    [2, "empty"],
    [2, "sequence"],
    [2, "ecmascriptWhitespace"],
  ];
  if (multiLine) {
    forms.push(
      [2, "lineComment"],
      [2, "runOn"],
      [1, "blockThenLine"],
      [1, "lineThenBlock"],
      [1, "twoLines"],
    );
  }
  const block = (): string => `/*${commentProse(choices)}*/`;
  const line = (): string => `//${lineCommentProse(choices)}`;
  const gap = (): string =>
    choices.weightedPick<string>([
      [3, " "],
      [1, ""],
      [1, NBSP],
      [1, LS],
    ]);
  switch (choices.weightedPick(forms)) {
    case "usual":
      return `{${block()}}`;
    case "empty":
      return "{}";
    case "sequence":
      return `{${gap()}${block()}${gap()}${block()}${gap()}}`;
    case "ecmascriptWhitespace":
      return `{${run(ecmascriptOnlyWhitespaceChar, 1, 2)(choices)}}`;
    case "lineComment":
      return `{${line()}${terminator(choices)}}`;
    case "runOn":
      return `{${line()}}${terminator(choices)}}`;
    case "blockThenLine":
      return `{${block()} ${line()}${terminator(choices)}}`;
    case "lineThenBlock":
      return `{${line()}${terminator(choices)}${block()}}`;
    case "twoLines":
      return `{${line()}${terminator(choices)}${line()}${terminator(choices)}}`;
  }
}

/**
 * An embedding container around `text(<argText>)` in one of 2.3's forms
 * (T2.3-3's positive forms), the bare `{text(...)}` dominant: whitespace
 * beside the call (ECMAScript's included), a block comment before it, after
 * it, or both, and, when `multiLine` allows, a line comment before the call
 * ended by a drawn terminator, the run-on `{// c}` form holding the call on
 * the next line, and a line comment after the call ended before the closing
 * brace. The whole container is the embedding's own characters (SPEC 3, 2.3:
 * replaced whole, interior terminator included).
 */
function embeddingContainer(
  choices: Choices,
  argText: string,
  multiLine = true,
): string {
  type Form =
    | "bare"
    | "whitespace"
    | "blockBefore"
    | "blockAfter"
    | "blockBoth"
    | "lineBefore"
    | "runOn"
    | "lineAfter";
  const forms: (readonly [number, Form])[] = [
    [12, "bare"],
    [2, "whitespace"],
    [2, "blockBefore"],
    [2, "blockAfter"],
    [1, "blockBoth"],
  ];
  if (multiLine) {
    forms.push([2, "lineBefore"], [2, "runOn"], [1, "lineAfter"]);
  }
  const call = `text(${argText})`;
  const block = (): string => `/*${commentProse(choices)}*/`;
  const line = (): string => `//${lineCommentProse(choices)}`;
  switch (choices.weightedPick(forms)) {
    case "bare":
      return `{${call}}`;
    case "whitespace":
      return `{${containerWhitespace(choices)}${call}${containerWhitespace(choices)}}`;
    case "blockBefore":
      return `{${block()} ${call}}`;
    case "blockAfter":
      return `{${call} ${block()}}`;
    case "blockBoth":
      return `{ ${block()} ${call} ${block()} }`;
    case "lineBefore":
      return `{${line()}${terminator(choices)}${call}}`;
    case "runOn":
      return `{${line()}}${terminator(choices)}${call}}`;
    case "lineAfter":
      return `{${call} ${line()}${terminator(choices)}}`;
  }
}

// Construct-like literal bytes (T3-1's grammar-boundary set, the P-2 entry's
// named inclusion): spelled inside fenced code blocks and inline code spans,
// where the MDX parse makes them plain content. A product recognizing
// constructs by textual pattern instead of by parse turns them into phantom
// constructs — a finding failing `build` exit 0, or bytes missing from the
// compiled output failing the oracle and byte-preservation arms. Backtick-
// and tilde-free, so none can close a span or spell a fence marker.
const CONSTRUCT_LIKE_LINES = [
  '<S id="x">',
  "<div>",
  'import X from "./X.xspec"',
  '{text("a")}',
  "</S>",
  "{/* not a comment */}",
] as const;

/** Single-line code-span interiors: non-empty, backtick-free (module header). */
const CONSTRUCT_LIKE_SPAN_INTERIORS = [
  '<S id="x">',
  '{text("a")}',
  '<S id="x">{text("a")}',
  'import X from "./X.xspec"',
  "<div>",
] as const;

/**
 * A complete inline code span on one line: equal-length runs of 1–2
 * backticks around a non-empty backtick-free construct-like interior — the
 * exact shape both the CommonMark/MDX grammar and CONF-MD's modeled subset
 * close where the generator says (an empty interior would merge the two runs
 * into one). Always emitted as a `content` entry: span bytes are literal
 * text (T3-1).
 */
const codeSpan: Gen<string> = (choices) => {
  const marker = BACKTICK.repeat(choices.intInclusive(1, 2));
  return `${marker}${choices.pick(CONSTRUCT_LIKE_SPAN_INTERIORS)}${marker}`;
};

// ---------------------------------------------------------------------------
// Per-file generation

/** A reference a `text(...)` argument or `d` value can spell. */
interface EmbedRef {
  /** The argument text: `"dotted.id"` (local) or `M1.dotted.id` (external). */
  readonly argText: string;
  readonly targetKey: string;
}

interface FileContext {
  readonly path: string;
  /** Section-per-file cap and unique-segment counter (SPEC 1.3). */
  idCounter: number;
  /** Terminator of the previously emitted line ("" before the first). */
  prevTerminator: string;
  /** Dotted id of the enclosing section ("" at root level; SPEC 1.3). */
  parentDotted: string;
  /** Local targets closed so far, as local-form references. */
  readonly localRefs: EmbedRef[];
  /** Targets of imported earlier files, as external-form references. */
  readonly externalRefs: readonly EmbedRef[];
  readonly nodes: DocNode[];
  readonly registerTarget: (dotted: string, shape: TargetShape) => void;
}

const MAX_SECTIONS_PER_FILE = 6;

/**
 * End the current line: draw a terminator and append it as a content entry.
 * Deterministic guard (module header): after a lone-CR terminator, an empty
 * line never takes a lone-LF terminator — the CR and LF bytes would merge
 * into one CRLF terminator on disk.
 */
function endLine(
  choices: Choices,
  ctx: FileContext,
  out: DocEntry[],
  lineIsEmpty: boolean,
): void {
  let t = terminator(choices);
  if (lineIsEmpty && ctx.prevTerminator === CR && t === LF) t = CR;
  out.push({ kind: "content", text: t });
  ctx.prevTerminator = t;
}

/** Pick an embedding/`d` reference, or null when none exists yet. */
function pickRef(choices: Choices, ctx: FileContext): EmbedRef | null {
  const pool = [...ctx.localRefs, ...ctx.externalRefs];
  if (pool.length === 0) return null;
  return choices.pick(pool);
}

/** Optional `coverage`/`tags`/`d` props (SPEC 2.7; T3-1's all-props shape). */
function extraProps(choices: Choices, ctx: FileContext): string {
  let props = "";
  if (choices.boolean(0.15)) {
    const ref = pickRef(choices, ctx);
    if (ref !== null) {
      const second = choices.boolean(0.4) ? pickRef(choices, ctx) : null;
      props +=
        second !== null && second.targetKey !== ref.targetKey
          ? ` d={[${ref.argText}, ${second.argText}]}`
          : ` d={${ref.argText}}`;
    }
  }
  if (choices.boolean(0.15)) {
    props += ` coverage="${choices.pick(["required", "none"] as const)}"`;
  }
  if (choices.boolean(0.15)) {
    props += ` tags="${choices.pick(["t1", "t1 t2", "alpha"] as const)}"`;
  }
  return props;
}

/** A fresh section id under `parentDotted`; null when the file is full. */
function nextSectionId(
  ctx: FileContext,
  parentDotted: string,
): { readonly seg: string; readonly dotted: string } | null {
  if (ctx.idCounter >= MAX_SECTIONS_PER_FILE) return null;
  const seg = `s${String(ctx.idCounter)}`;
  ctx.idCounter += 1;
  return { seg, dotted: parentDotted === "" ? seg : `${parentDotted}.${seg}` };
}

const TAG_NAMES = ["S", "Spec"] as const;

interface BlockList {
  readonly entries: readonly DocEntry[];
  /** Refs of the sections generated at this level, in document order. */
  readonly sectionRefs: readonly string[];
}

/**
 * A sequence of blocks at one nesting level. Every block leaves the entry
 * list at a line boundary. `depth` limits section nesting (SPEC 1.3 levels).
 */
function genBlocks(
  choices: Choices,
  ctx: FileContext,
  depth: number,
): BlockList {
  const entries: DocEntry[] = [];
  const sectionRefs: string[] = [];
  const max = depth === 0 ? 7 : 4;
  let count = 0;
  while (count < max && choices.boolean(0.85)) {
    genBlock(choices, ctx, depth, entries, sectionRefs);
    count += 1;
  }
  return { entries, sectionRefs };
}

function genBlock(
  choices: Choices,
  ctx: FileContext,
  depth: number,
  out: DocEntry[],
  sectionRefs: string[],
): void {
  const shape = choices.weightedPick<
    | "prose"
    | "blank"
    | "whitespace"
    | "comment"
    | "multiComment"
    | "embedLine"
    | "fence"
    | "section"
    | "selfClosing"
  >([
    [5, "prose"],
    [2, "blank"],
    [1, "whitespace"],
    [3, "comment"],
    [2, "multiComment"],
    [3, "embedLine"],
    [2, "fence"],
    [5, "section"],
    [2, "selfClosing"],
  ]);
  switch (shape) {
    case "prose":
      genProseLine(choices, ctx, out, sectionRefs);
      return;
    case "blank":
      endLine(choices, ctx, out, true);
      return;
    case "whitespace":
      out.push({ kind: "content", text: run(whitespaceChar, 1, 4)(choices) });
      endLine(choices, ctx, out, false);
      return;
    case "comment":
      genCommentLine(choices, ctx, out);
      return;
    case "multiComment":
      genMultiLineComment(choices, ctx, out);
      return;
    case "fence":
      genFenceBlock(choices, ctx, out);
      return;
    case "embedLine": {
      const ref = pickRef(choices, ctx);
      if (ref === null) {
        genProseLine(choices, ctx, out, sectionRefs);
        return;
      }
      out.push({
        kind: "embed",
        text: embeddingContainer(choices, ref.argText),
        targetKey: ref.targetKey,
      });
      endLine(choices, ctx, out, false);
      return;
    }
    case "section":
      genBlockSection(choices, ctx, depth, out, sectionRefs);
      return;
    case "selfClosing": {
      const id = nextSectionId(ctx, ctx.parentDotted);
      if (id === null) {
        genProseLine(choices, ctx, out, sectionRefs);
        return;
      }
      const tag = choices.pick(TAG_NAMES);
      out.push({ kind: "removal", text: `<${tag} id="${id.dotted}" />` });
      endLine(choices, ctx, out, false);
      registerSection(ctx, sectionRefs, id.dotted, []);
      ctx.registerTarget(id.dotted, { kind: "empty" });
      return;
    }
  }
}

function registerSection(
  ctx: FileContext,
  sectionRefs: string[],
  dotted: string,
  childRefs: readonly string[],
): void {
  const ref = `${ctx.path}#${dotted}`;
  ctx.nodes.push({ ref, childRefs });
  sectionRefs.push(ref);
}

/**
 * A prose line: free content, optionally hosting one inline element — an
 * inline comment, an inline embedding, an inline code span whose
 * construct-like bytes are literal content (T3-1), a one-line section, or a
 * self-closing section — with content around it. A line hosting an inline
 * section always carries a guaranteed-kept plain prose anchor, so the line
 * is kept under SPEC 3 and the section's contribution is exactly its
 * interior bytes (module header).
 */
function genProseLine(
  choices: Choices,
  ctx: FileContext,
  out: DocEntry[],
  sectionRefs: string[],
): void {
  const lead = keptProse(choices);
  if (!choices.boolean(0.45)) {
    out.push({ kind: "content", text: lead });
    endLine(choices, ctx, out, false);
    return;
  }
  const inline = choices.weightedPick<
    "comment" | "embed" | "codeSpan" | "inlineSection" | "inlineSelfClosing"
  >([
    [3, "comment"],
    [3, "embed"],
    [2, "codeSpan"],
    [3, "inlineSection"],
    [1, "inlineSelfClosing"],
  ]);
  const pieces: DocEntry[] = [{ kind: "content", text: lead }];
  switch (inline) {
    case "comment":
      pieces.push({ kind: "removal", text: mdxComment(choices) });
      break;
    case "codeSpan":
      // Literal span bytes amid prose — content, never a construct (T3-1).
      pieces.push({ kind: "content", text: codeSpan(choices) });
      break;
    case "embed": {
      const ref = pickRef(choices, ctx);
      if (ref !== null) {
        pieces.push({
          kind: "embed",
          text: embeddingContainer(choices, ref.argText),
          targetKey: ref.targetKey,
        });
      }
      break;
    }
    case "inlineSection":
    case "inlineSelfClosing": {
      const id = nextSectionId(ctx, ctx.parentDotted);
      if (id === null) break;
      const tag = choices.pick(TAG_NAMES);
      if (inline === "inlineSelfClosing") {
        pieces.push({ kind: "removal", text: `<${tag} id="${id.dotted}" />` });
        registerSection(ctx, sectionRefs, id.dotted, []);
        ctx.registerTarget(id.dotted, { kind: "empty" });
        break;
      }
      const interior = choices.weightedPick<Gen<string>>([
        [4, prose],
        [2, run(whitespaceChar, 1, 2)],
        [1, () => ""],
      ])(choices);
      pieces.push({ kind: "removal", text: `<${tag} id="${id.dotted}">` });
      if (interior !== "") pieces.push({ kind: "content", text: interior });
      pieces.push({ kind: "removal", text: `</${tag}>` });
      registerSection(ctx, sectionRefs, id.dotted, []);
      ctx.registerTarget(id.dotted, { kind: "inline", interior });
      break;
    }
  }
  if (choices.boolean(0.6)) {
    pieces.push({ kind: "content", text: prose(choices) });
  }
  out.push(...pieces);
  endLine(choices, ctx, out, false);
}

/**
 * A single-line own-line comment, optionally with a residue on the line —
 * weighted toward the T3-3 arms: a boundary-code-point-only residue (kept
 * under SPEC 1.4, the §VIOL-MD-CLASS flip), a 1.4-whitespace residue (the
 * line still drops), mixes, plain kept residues, and an inline code span as
 * the line's sole other survivor (non-whitespace literal content, T3-1: the
 * removal-affected line is kept holding exactly the span bytes).
 */
function genCommentLine(
  choices: Choices,
  ctx: FileContext,
  out: DocEntry[],
): void {
  const comment: DocEntry = { kind: "removal", text: mdxComment(choices) };
  const residue = choices.weightedPick<Gen<string>>([
    [4, () => ""],
    [4, run(boundaryChar, 1, 3)],
    [3, run(whitespaceChar, 1, 3)],
    [
      3,
      (c: Choices) =>
        run(
          (cc: Choices) =>
            cc.weightedPick<string>([
              [2, SPACE],
              [2, NBSP],
              [1, NEL],
              [1, LS],
              [1, TAB],
            ]),
          1,
          4,
        )(c),
    ],
    [2, run(plainChar, 1, 3)],
    [2, codeSpan],
  ])(choices);
  const residueFirst = choices.boolean(0.3);
  if (residue !== "" && residueFirst) {
    out.push({ kind: "content", text: residue });
  }
  out.push(comment);
  if (residue !== "" && !residueFirst) {
    out.push({ kind: "content", text: residue });
  }
  endLine(choices, ctx, out, false);
}

/**
 * A multi-line comment (1–2 internal terminators, no internal blank line),
 * optionally with prose residues before and after on its first and last
 * lines — the residue-merge and merged-line-drop arms of SPEC 3.
 */
function genMultiLineComment(
  choices: Choices,
  ctx: FileContext,
  out: DocEntry[],
): void {
  const before = choices.boolean(0.4) ? keptProse(choices) : "";
  const after = choices.boolean(0.4) ? prose(choices) : "";
  const internalLines = listOf(plainProse, { min: 2, max: 3 })(choices);
  let text = "{/* ";
  internalLines.forEach((line, index) => {
    if (index > 0) text += terminator(choices);
    text += line;
  });
  text += " */}";
  if (before !== "") out.push({ kind: "content", text: before });
  out.push({ kind: "removal", text });
  if (after !== "") out.push({ kind: "content", text: after });
  endLine(choices, ctx, out, false);
}

/**
 * A fenced code block (T3-1's grammar boundary; module header): an opening
 * fence line — column 0, a run of 3–4 backticks or tildes, an optional
 * backtick-free identifier info string — 0–3 interior lines spelling
 * construct-like bytes, free prose, or nothing, and a bare closing fence of
 * the same character and length. Every byte is a `content` entry: fences are
 * literal text under the MDX grammar, so the oracle and a conforming product
 * alike treat the interior's construct-like spellings as plain content, and
 * the fence's lines are ordinary logical lines (marker lines carry
 * non-whitespace; interior blank or whitespace-only lines are untouched and
 * kept). Interior alphabets contain no backtick or `~`, so no interior line
 * can spell a fence marker and the fence closes exactly where the generator
 * says it does — fenced code blocks interrupt paragraphs in CommonMark, so
 * no blank-line separation is needed around the block.
 */
function genFenceBlock(
  choices: Choices,
  ctx: FileContext,
  out: DocEntry[],
): void {
  const marker = choices
    .pick([BACKTICK, TILDE] as const)
    .repeat(choices.intInclusive(3, 4));
  const info = choices.pick(["", "ts", "md"] as const);
  out.push({ kind: "content", text: `${marker}${info}` });
  endLine(choices, ctx, out, false);
  const interiorLines = choices.intInclusive(0, 3);
  for (let index = 0; index < interiorLines; index += 1) {
    const line = choices.weightedPick<Gen<string>>([
      [4, (c: Choices) => c.pick(CONSTRUCT_LIKE_LINES)],
      [2, prose],
      [1, () => ""],
    ])(choices);
    if (line !== "") out.push({ kind: "content", text: line });
    endLine(choices, ctx, out, line === "");
  }
  out.push({ kind: "content", text: marker });
  endLine(choices, ctx, out, false);
}

/**
 * A block section: opening tag alone on its line, interior blocks one level
 * deeper, closing tag alone on its line; registered as an embeddable target
 * (module header). Opening tags never carry trailing same-line content: MDX
 * parses such a tag as a paragraph-inline element that must close within
 * its paragraph, so the own-line-close form would be unparseable — in-place
 * tag deletion on content-retaining lines is exercised by the inline
 * sections of genProseLine instead.
 */
function genBlockSection(
  choices: Choices,
  ctx: FileContext,
  depth: number,
  out: DocEntry[],
  sectionRefs: string[],
): void {
  const id = nextSectionId(ctx, ctx.parentDotted);
  if (id === null) {
    genProseLine(choices, ctx, out, sectionRefs);
    return;
  }
  const tag = choices.pick(TAG_NAMES);
  const open = `<${tag} id="${id.dotted}"${extraProps(choices, ctx)}>`;
  out.push({ kind: "removal", text: open });
  endLine(choices, ctx, out, false);

  const savedParent = ctx.parentDotted;
  ctx.parentDotted = id.dotted;
  const interior =
    depth < 2
      ? genBlocks(choices, ctx, depth + 1)
      : ({ entries: [], sectionRefs: [] } satisfies BlockList);
  ctx.parentDotted = savedParent;

  out.push(...interior.entries);
  out.push({ kind: "removal", text: `</${tag}>` });
  endLine(choices, ctx, out, false);

  registerSection(ctx, sectionRefs, id.dotted, interior.sectionRefs);
  ctx.registerTarget(id.dotted, {
    kind: "block",
    interior: interior.entries,
  });
}

// ---------------------------------------------------------------------------
// Whole-document generation

const FILE_NAMES = ["A", "B", "C"] as const;

/** The shared P-2/P-3 document generator (module header). */
export const generatedDoc: Gen<GeneratedDoc> = (choices) => {
  const targets = new Map<string, TargetShape>();
  const fileTargets = new Map<string, string[]>();
  const files: GeneratedFileDoc[] = [];
  const fileCount = choices.intInclusive(1, FILE_NAMES.length);
  for (let index = 0; index < fileCount; index += 1) {
    const path = `specs/${FILE_NAMES[index]}.mdx`;
    const entries: DocEntry[] = [];
    const nodes: DocNode[] = [];

    // Imports of earlier files (SPEC 2.1), each a removed own-line construct.
    const imports: { readonly binding: string; readonly path: string }[] = [];
    for (let earlier = 0; earlier < index; earlier += 1) {
      if (!choices.boolean(0.65)) continue;
      const binding = `M${String(imports.length + 1)}`;
      imports.push({ binding, path: files[earlier].path });
    }
    const externalRefs: EmbedRef[] = imports.flatMap(({ binding, path: p }) =>
      (fileTargets.get(p) ?? []).map((dotted) => ({
        argText: `${binding}.${dotted}`,
        targetKey: `${p}#${dotted}`,
      })),
    );

    const ctx: FileContext = {
      path,
      idCounter: 0,
      prevTerminator: "",
      parentDotted: "",
      localRefs: [],
      externalRefs,
      nodes,
      registerTarget: (dotted, shape) => {
        const key = `${path}#${dotted}`;
        targets.set(key, shape);
        ctx.localRefs.push({ argText: `"${dotted}"`, targetKey: key });
        const list = fileTargets.get(path) ?? [];
        list.push(dotted);
        fileTargets.set(path, list);
      },
    };

    // The ESM block (SPEC 14.20): one declaration per line, each optionally
    // `;`-terminated (the `;` among its own characters, T3-7's terminator
    // arm), with JavaScript comments beside the declarations — content under
    // SPEC 3, no MDX comment (T3-7): a line or block comment after an import
    // on its line, an own-line `// note` between two imports or after the
    // last, and a block comment before an import on the block's second line
    // onward. Never before the first line: an ESM block begins at an import
    // keyword, so a comment there would make the block a paragraph.
    const jsLineComment = (): string => `//${lineCommentProse(choices)}`;
    const jsBlockComment = (): string => `/*${commentProse(choices)}*/`;
    imports.forEach(({ binding, path: p }, importIndex) => {
      const name = p.slice("specs/".length, -".mdx".length);
      if (importIndex > 0 && choices.boolean(0.2)) {
        entries.push({ kind: "content", text: jsLineComment() });
        endLine(choices, ctx, entries, false);
      }
      if (importIndex > 0 && choices.boolean(0.2)) {
        entries.push({ kind: "content", text: `${jsBlockComment()} ` });
      }
      const semicolon = choices.boolean(0.25) ? ";" : "";
      entries.push({
        kind: "removal",
        text: `import ${binding} from "./${name}.xspec"${semicolon}`,
      });
      const trailing = choices.weightedPick<"none" | "line" | "block">([
        [7, "none"],
        [2, "line"],
        [1, "block"],
      ]);
      if (trailing === "line") {
        entries.push({ kind: "content", text: ` ${jsLineComment()}` });
      } else if (trailing === "block") {
        entries.push({ kind: "content", text: ` ${jsBlockComment()}` });
      }
      endLine(choices, ctx, entries, false);
    });
    if (imports.length > 0 && choices.boolean(0.15)) {
      entries.push({ kind: "content", text: jsLineComment() });
      endLine(choices, ctx, entries, false);
    }
    // A mandatory blank line after the import block: MDX ESM blocks extend
    // to the next blank line, so a non-blank line directly after an import
    // would be swallowed into the ESM block and fail to parse. Deliberate
    // conservative staging, not oracle behavior — SPEC 2.1 itself stages
    // imports this way.
    if (imports.length > 0) {
      endLine(choices, ctx, entries, true);
    }

    // Guaranteed construct-free plain prose first line (module header).
    entries.push({ kind: "content", text: plainProse(choices) });
    endLine(choices, ctx, entries, false);

    const body = genBlocks(choices, ctx, 0);
    entries.push(...body.entries);

    // Optionally strip the final terminator (SPEC 3: the final line may
    // have none). Every top-level block ends with a terminator entry.
    if (choices.boolean(0.3)) {
      const last = entries[entries.length - 1];
      if (
        last !== undefined &&
        last.kind === "content" &&
        (last.text === LF || last.text === CRLF || last.text === CR)
      ) {
        entries.pop();
      }
    }

    nodes.unshift({ ref: path, childRefs: body.sectionRefs });
    files.push({ path, entries, nodes });
  }
  return { files, targets };
};

// ---------------------------------------------------------------------------
// Fixed form vectors (TEST-SPEC 17 S-9; 16 preamble)
//
// The enumerated forms this generator can compose — not draws — each spelled
// from the generator's own constants and templates as a complete source, in
// every context the generator can place it (directly after a prose line,
// after a blank line, and as a block section's interior, all in one
// document), so that S-9's self-test
// (test/self/s9-fixture-well-formedness.test.ts) proves before any product
// exists that every form derives under the grammar 14.20 fixes; at property
// time every draw is checked the same way before the product sees it
// (`mdxSources` on the registrations below; helpers/property.ts). A form
// added to the generator is added here.

/** Every character of the prose alphabet, once, in alphabet order. */
const ALL_PROSE_CHARS = PROSE_ALPHABET.map(([, char]) => char).join("");
/** Every character of the line-comment alphabet, once, in alphabet order. */
const ALL_LINE_COMMENT_CHARS = LINE_COMMENT_ALPHABET.map(
  ([, char]) => char,
).join("");
/** The mandatory construct-free plain-prose first line (module header). */
const FORM_FIRST_LINE = "a0 first";
const FORM_TRAIL_LINE = "z9 trail";

function codePointName(char: string): string {
  const codePoint = char.codePointAt(0);
  if (codePoint === undefined) throw new Error("empty character");
  return `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
}

/** A fresh dotted id allocator under a prefix (`""` at root level). */
function formIds(prefix: string): () => string {
  let counter = 0;
  return () => {
    const dotted = `${prefix}s${String(counter)}`;
    counter += 1;
    return dotted;
  };
}

/** One form: its lines, given an id allocator for the sections it spells. */
interface FormSpelling {
  readonly name: string;
  readonly lines: (id: () => string) => readonly string[];
}

const FORM_TERMINATORS: ReadonlyArray<readonly [string, string]> = [
  ["LF", LF],
  ["CRLF", CRLF],
  ["CR", CR],
];

/** The comment-line residue classes of genCommentLine. */
const FORM_RESIDUES: ReadonlyArray<readonly [string, string]> = [
  ["boundary-only", NBSP + NEL + LS],
  ["whitespace-only", SPACE + TAB + VT],
  ["mixed", SPACE + NBSP + NEL + LS + TAB],
  ["plain", "ab9"],
  ["code-span", `${BACKTICK}${CONSTRUCT_LIKE_SPAN_INTERIORS[0]}${BACKTICK}`],
];

/** Every code span: 1–2 backtick runs around each interior (codeSpan). */
const FORM_CODE_SPANS: ReadonlyArray<readonly [string, string]> = [
  1, 2,
].flatMap((length) =>
  CONSTRUCT_LIKE_SPAN_INTERIORS.map((interior): readonly [string, string] => [
    `code span, ${String(length)}-backtick runs around ${JSON.stringify(interior)}`,
    `${BACKTICK.repeat(length)}${interior}${BACKTICK.repeat(length)}`,
  ]),
);

/** The prop combinations of extraProps, in its spelling order (d, coverage, tags). */
const FORM_PROPS: ReadonlyArray<readonly [string, string]> = [
  ["no props", ""],
  ["d single local", ' d={"s0"}'],
  ["d single external", " d={M1.s0}"],
  ["d pair", ' d={["s0", M1.s0]}'],
  ["coverage required", ' coverage="required"'],
  ["coverage none", ' coverage="none"'],
  ["tags one", ' tags="t1"'],
  ["tags two", ' tags="t1 t2"'],
  ["tags alpha", ' tags="alpha"'],
  ["all props", ' d={["s0", M1.s0]} coverage="required" tags="t1 t2"'],
];

const FORM_FENCE_MARKERS = [3, 4].flatMap((length) => [
  BACKTICK.repeat(length),
  TILDE.repeat(length),
]);
const FORM_FENCE_INFOS = ["", "ts", "md"] as const;

/** The block forms of genBlock (and the import lines), one entry each. */
const BLOCK_FORMS: readonly FormSpelling[] = [
  { name: "blank line", lines: () => [""] },
  ...INLINE_WHITESPACE.map((char): FormSpelling => ({
    name: `whitespace-only line of ${codePointName(char)}`,
    lines: () => [char],
  })),
  {
    name: "whitespace-only line, a run of all four whitespace characters",
    lines: () => [INLINE_WHITESPACE.join("")],
  },
  {
    name: "prose line of every alphabet character",
    lines: () => [ALL_PROSE_CHARS],
  },
  ...PROSE_ALPHABET.map(([, char]): FormSpelling => ({
    name: `prose line of ${codePointName(char)} alone`,
    lines: () => [char],
  })),
  {
    name: "comment line, alphabet interior",
    lines: () => [`{/* ${ALL_PROSE_CHARS} */}`],
  },
  { name: "comment line, empty interior", lines: () => ["{/*  */}"] },
  ...FORM_RESIDUES.flatMap(([residueName, residue]): FormSpelling[] => [
    {
      name: `comment line, ${residueName} residue before`,
      lines: () => [`${residue}{/* ab */}`],
    },
    {
      name: `comment line, ${residueName} residue after`,
      lines: () => [`{/* ab */}${residue}`],
    },
  ]),
  ...FORM_TERMINATORS.flatMap(
    ([terminatorName, terminator]): FormSpelling[] => [
      {
        name: `multi-line comment, one internal ${terminatorName}`,
        lines: () => [`{/* ab${terminator}cd */}`],
      },
      {
        name: `multi-line comment, two internal ${terminatorName}`,
        lines: () => [`{/* ab${terminator}cd${terminator}ef */}`],
      },
      {
        name: `multi-line comment with residues, internal ${terminatorName}`,
        lines: () => [`a0 lead{/* ab${terminator}cd */}${ALL_PROSE_CHARS}`],
      },
    ],
  ),
  {
    name: "multi-line comment, mixed internal terminators",
    lines: () => [`{/* ab${LF}cd${CR}ef */}`],
  },
  // The refined comment forms of 2.7 (mdxComment), own-line.
  { name: "comment line, `{}`", lines: () => ["{}"] },
  {
    name: "comment line, block-comment sequence with spaces between",
    lines: () => [`{ /* ${ALL_PROSE_CHARS} */ /* ab */ }`],
  },
  {
    name: "comment line, block-comment sequence with nothing between",
    lines: () => ["{/* ab *//* cd */}"],
  },
  {
    name: "comment line, block-comment sequence with ECMAScript-only whitespace between",
    lines: () => [`{${NBSP}/* ab */${LS}/* cd */${FEFF}}`],
  },
  ...ECMASCRIPT_ONLY_WHITESPACE.map((char): FormSpelling => ({
    name: `comment line, ${codePointName(char)} between the braces`,
    lines: () => [`{${char}}`],
  })),
  {
    name: "comment line, every ECMAScript-only whitespace between the braces",
    lines: () => [`{${ECMASCRIPT_ONLY_WHITESPACE.join("")}}`],
  },
  ...FORM_TERMINATORS.flatMap(
    ([terminatorName, terminator]): FormSpelling[] => [
      {
        name: `line-comment container ended by ${terminatorName}, alphabet interior`,
        lines: () => [`{// ${ALL_LINE_COMMENT_CHARS}${terminator}}`],
      },
      {
        name: `line-comment container ended by ${terminatorName}, empty interior`,
        lines: () => [`{//  ${terminator}}`],
      },
      {
        name: `run-on line-comment container, ${terminatorName}`,
        lines: () => [`{// ${ALL_LINE_COMMENT_CHARS}}${terminator}}`],
      },
      {
        name: `block comment then line comment, ${terminatorName}`,
        lines: () => [`{/* ${ALL_PROSE_CHARS} */ // ab${terminator}}`],
      },
      {
        name: `line comment then block comment, ${terminatorName}`,
        lines: () => [`{// ab${terminator}/* ${ALL_PROSE_CHARS} */}`],
      },
      {
        name: `two line comments, ${terminatorName}`,
        lines: () => [`{// ab${terminator}// cd${terminator}}`],
      },
      {
        name: `line-comment container with residues, ${terminatorName}`,
        lines: () => [`a0 lead{// ab${terminator}}${ALL_PROSE_CHARS}`],
      },
      {
        name: `run-on container with residues, ${terminatorName}`,
        lines: () => [`a0 lead{// ab}${terminator}}${ALL_PROSE_CHARS}`],
      },
      ...FORM_RESIDUES.flatMap(([residueName, residue]): FormSpelling[] => [
        {
          name: `line-comment container, ${residueName} residue before, ${terminatorName}`,
          lines: () => [`${residue}{// ab${terminator}}`],
        },
        {
          name: `line-comment container, ${residueName} residue after, ${terminatorName}`,
          lines: () => [`{// ab${terminator}}${residue}`],
        },
      ]),
    ],
  ),
  ...FORM_FENCE_MARKERS.flatMap((marker) =>
    FORM_FENCE_INFOS.map((info): FormSpelling => ({
      name: `fenced code block ${marker}${info}, full interior`,
      lines: () => [
        `${marker}${info}`,
        ...CONSTRUCT_LIKE_LINES,
        ALL_PROSE_CHARS,
        "",
        marker,
      ],
    })),
  ),
  ...CONSTRUCT_LIKE_LINES.map((line): FormSpelling => ({
    name: `fenced code block holding ${JSON.stringify(line)} alone`,
    lines: () => [FORM_FENCE_MARKERS[0], line, FORM_FENCE_MARKERS[0]],
  })),
  {
    name: "fenced code block, empty",
    lines: () => [FORM_FENCE_MARKERS[0], FORM_FENCE_MARKERS[0]],
  },
  { name: "embedding line, local reference", lines: () => ['{text("s0")}'] },
  {
    name: "embedding line, external reference",
    lines: () => ["{text(M1.s0)}"],
  },
  // The refined embedding forms of 2.3 (embeddingContainer), own-line.
  {
    name: "embedding line, whitespace beside the call",
    lines: () => [`{ ${TAB}text("s0")${NBSP}${LS} }`],
  },
  {
    name: "embedding line, block comment before the call",
    lines: () => [`{/* ${ALL_PROSE_CHARS} */ text(M1.s0)}`],
  },
  {
    name: "embedding line, block comment after the call",
    lines: () => [`{text("s0") /* ${ALL_PROSE_CHARS} */}`],
  },
  {
    name: "embedding line, block comments on both sides",
    lines: () => ["{ /* ab */ text(M1.s0) /* cd */ }"],
  },
  ...FORM_TERMINATORS.flatMap(
    ([terminatorName, terminator]): FormSpelling[] => [
      {
        name: `embedding line, line comment before the call, ${terminatorName}`,
        lines: () => [`{// ${ALL_LINE_COMMENT_CHARS}${terminator}text("s0")}`],
      },
      {
        name: `embedding line, run-on line comment holding the call, ${terminatorName}`,
        lines: () => [
          `{// ${ALL_LINE_COMMENT_CHARS}}${terminator}text(M1.s0)}`,
        ],
      },
      {
        name: `embedding line, line comment after the call, ${terminatorName}`,
        lines: () => [`{text("s0") // ${ALL_LINE_COMMENT_CHARS}${terminator}}`],
      },
    ],
  ),
  ...TAG_NAMES.flatMap((tag): FormSpelling[] => [
    {
      name: `self-closing section line <${tag}>`,
      lines: (id) => [`<${tag} id="${id()}" />`],
    },
    {
      name: `block section <${tag}>`,
      lines: (id) => [`<${tag} id="${id()}">`, "interior a", `</${tag}>`],
    },
  ]),
  ...FORM_PROPS.map(([propsName, props]): FormSpelling => ({
    name: `block section, ${propsName}`,
    lines: (id) => [`<S id="${id()}"${props}>`, "interior a", "</S>"],
  })),
  { name: "block section, empty", lines: (id) => [`<S id="${id()}">`, "</S>"] },
  {
    name: "block sections nested three deep",
    lines: (id) => {
      const outer = id();
      return [
        `<S id="${outer}">`,
        `<Spec id="${outer}.s0">`,
        `<S id="${outer}.s0.s0">`,
        "x",
        "</S>",
        "</Spec>",
        "</S>",
      ];
    },
  },
];

/** The inline elements of genProseLine, each spelled once. */
const INLINE_ELEMENTS: ReadonlyArray<
  readonly [string, (id: () => string) => string]
> = [
  ["inline comment", () => "{/* ab */}"],
  ["inline embedding, local reference", () => '{text("s0")}'],
  ["inline embedding, external reference", () => "{text(M1.s0)}"],
  // The refined comment and embedding forms, in text position.
  ["inline comment `{}`", () => "{}"],
  ["inline block-comment sequence", () => `{ /* ab */${NBSP}/* cd */ }`],
  [
    "inline comment of ECMAScript-only whitespace",
    () => `{${ECMASCRIPT_ONLY_WHITESPACE.join("")}}`,
  ],
  ["inline embedding, whitespace beside the call", () => `{ text("s0")${LS}}`],
  [
    "inline embedding, block comments beside the call",
    () => "{/* ab */ text(M1.s0) /* cd */}",
  ],
  ...FORM_TERMINATORS.flatMap(
    ([terminatorName, terminator]): (readonly [string, () => string])[] => [
      [
        `inline line-comment container, ${terminatorName}`,
        () => `{// ${ALL_LINE_COMMENT_CHARS}${terminator}}`,
      ],
      [
        `inline run-on container, ${terminatorName}`,
        () => `{// ab}${terminator}}`,
      ],
      [
        `inline embedding, line comment before the call, ${terminatorName}`,
        () => `{// ab${terminator}text("s0")}`,
      ],
      [
        `inline embedding, run-on line comment holding the call, ${terminatorName}`,
        () => `{// ab}${terminator}text(M1.s0)}`,
      ],
      [
        `inline embedding, line comment after the call, ${terminatorName}`,
        () => `{text("s0") // ab${terminator}}`,
      ],
    ],
  ),
  ...FORM_CODE_SPANS.map(
    ([spanName, span]): readonly [string, () => string] => [
      spanName,
      () => span,
    ],
  ),
  ...TAG_NAMES.flatMap(
    (tag): (readonly [string, (id: () => string) => string])[] => [
      [
        `inline section <${tag}>, alphabet interior`,
        (id) => `<${tag} id="${id()}">${ALL_PROSE_CHARS}</${tag}>`,
      ],
      ...INLINE_WHITESPACE.map(
        (char): readonly [string, (id: () => string) => string] => [
          `inline section <${tag}>, ${codePointName(char)} interior`,
          (id) => `<${tag} id="${id()}">${char}</${tag}>`,
        ],
      ),
      [
        `inline section <${tag}>, two-character whitespace interior`,
        (id) => `<${tag} id="${id()}">${FF}${VT}</${tag}>`,
      ],
      [
        `inline section <${tag}>, empty interior`,
        (id) => `<${tag} id="${id()}"></${tag}>`,
      ],
      [
        `inline self-closing section <${tag}>`,
        (id) => `<${tag} id="${id()}" />`,
      ],
    ],
  ),
];

/** The prose-line forms: a kept lead, an inline element, an optional tail. */
const PROSE_LINE_FORMS: readonly FormSpelling[] = [
  ...INLINE_ELEMENTS.flatMap(([elementName, element]): FormSpelling[] => [
    {
      name: `prose line hosting ${elementName}, no tail`,
      lines: (id) => [`a0 ${element(id)}`],
    },
    {
      name: `prose line hosting ${elementName}, alphabet tail`,
      lines: (id) => [`a0 ${element(id)}${ALL_PROSE_CHARS}`],
    },
  ]),
  // The character adjoining a construct on either side: each alphabet
  // character directly before the opening tag and directly after the
  // closing tag of an inline section, and around an inline comment.
  ...PROSE_ALPHABET.flatMap(([, char]): FormSpelling[] => [
    {
      name: `inline section adjoined by ${codePointName(char)} on both sides`,
      lines: (id) => [`a${char}<S id="${id()}">x</S>${char}a`],
    },
    {
      name: `inline comment adjoined by ${codePointName(char)} on both sides`,
      lines: () => [`a${char}{/* ab */}${char}a`],
    },
    {
      name: `run-on container adjoined by ${codePointName(char)} on both sides`,
      lines: () => [`a${char}{// ab}${LF}}${char}a`],
    },
  ]),
  // Leads the container/heading guard leaves reachable (opensBlockConstruct):
  // a marker character not followed by whitespace opens nothing.
  {
    name: "prose line led by U+002D then a letter, hosting a run-on container",
    lines: () => [`-a {// ab}${LF}}`],
  },
  {
    name: "prose line led by a digit and U+002E then a letter, hosting a line-comment container",
    lines: () => [`9.a {// ab${LF}}`],
  },
  {
    name: "prose line led by U+0023 then a letter (no heading), hosting a two-line embedding",
    lines: () => [`#a {// ab${LF}text("s0")}`],
  },
  {
    name: "prose line led by whitespace, U+0023, and a letter, hosting a multi-line comment",
    lines: () => [` ${TAB}#a {/* ab${LF}cd */}`],
  },
];

/** The import block: one import per earlier file, then the mandatory blank. */
const FORM_IMPORT_LINES = [
  'import M1 from "./A.xspec"',
  'import M2 from "./B.xspec"',
] as const;

/**
 * The ESM-block forms of generatedDoc (T3-7): `;`-terminated declarations
 * and JavaScript comments beside the imports — each block's lines, the
 * mandatory blank line after it excluded. The last entry spells every form
 * in one block; the composites below carry it under every terminator.
 */
const FORM_ESM_BLOCKS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["one import", [FORM_IMPORT_LINES[0]]],
  ["two imports", [...FORM_IMPORT_LINES]],
  [
    "`;`-terminated imports",
    ['import M1 from "./A.xspec";', 'import M2 from "./B.xspec";'],
  ],
  [
    "a line comment after an import",
    [
      `import M1 from "./A.xspec" // ${ALL_LINE_COMMENT_CHARS}`,
      FORM_IMPORT_LINES[1],
    ],
  ],
  [
    "a block comment after an import",
    [
      `import M1 from "./A.xspec" /* ${ALL_PROSE_CHARS} */`,
      FORM_IMPORT_LINES[1],
    ],
  ],
  [
    "an own-line line comment between two imports",
    [
      FORM_IMPORT_LINES[0],
      `// ${ALL_LINE_COMMENT_CHARS}`,
      FORM_IMPORT_LINES[1],
    ],
  ],
  [
    "a block comment before an import on the block's second line",
    [
      FORM_IMPORT_LINES[0],
      `/* ${ALL_PROSE_CHARS} */ import M2 from "./B.xspec"`,
    ],
  ],
  [
    "an own-line line comment after the last import",
    [FORM_IMPORT_LINES[0], `// ${ALL_LINE_COMMENT_CHARS}`],
  ],
  [
    "a `;`-terminated single import with a line comment after it",
    [`import M1 from "./A.xspec"; // ${ALL_LINE_COMMENT_CHARS}`],
  ],
  [
    "every ESM-block form in one block",
    [
      `import M1 from "./A.xspec"; // ${ALL_LINE_COMMENT_CHARS}`,
      `// ${ALL_LINE_COMMENT_CHARS}`,
      `/* ${ALL_PROSE_CHARS} */ import M2 from "./B.xspec" /* ${ALL_PROSE_CHARS} */`,
      `// ${ALL_LINE_COMMENT_CHARS}`,
    ],
  ],
];
const FORM_ESM_BLOCK_ALL = FORM_ESM_BLOCKS[FORM_ESM_BLOCKS.length - 1][1];

/**
 * One form's document: the form after the first prose line, after a blank
 * line, and as a block section's interior (with dotted ids beneath it).
 */
function formDocument(form: FormSpelling): string {
  const lines = [
    FORM_FIRST_LINE,
    ...form.lines(formIds("")),
    FORM_TRAIL_LINE,
    "",
    ...form.lines(formIds("t")),
    "",
    '<S id="u">',
    ...form.lines(formIds("u.")),
    "</S>",
    FORM_TRAIL_LINE,
  ];
  return lines.join(LF) + LF;
}

/**
 * Every form in one document under one terminator drawn for every line
 * (the composite the generator's per-line terminator draw can reach; the
 * multi-line container forms keep their own internal terminators), the
 * all-forms ESM block at its head. `cycle` draws LF, CRLF, CR in turn,
 * applying endLine's lone-CR guard.
 */
function compositeDocument(
  terminatorOf: (
    index: number,
    lineIsEmpty: boolean,
    previous: string,
  ) => string,
  stripFinal: boolean,
): string {
  const id = formIds("");
  const lines = [
    ...FORM_ESM_BLOCK_ALL,
    "",
    FORM_FIRST_LINE,
    ...BLOCK_FORMS.flatMap((form) => form.lines(id)),
    ...PROSE_LINE_FORMS.flatMap((form) => form.lines(id)),
    FORM_TRAIL_LINE,
  ];
  let text = "";
  let previous = "";
  lines.forEach((line, index) => {
    const terminator = terminatorOf(index, line === "", previous);
    text += line + terminator;
    previous = terminator;
  });
  return stripFinal ? text.slice(0, -previous.length) : text;
}

const CYCLED_TERMINATORS = [LF, CRLF, CR] as const;

/**
 * The fixed form-vector set of the P-2/P-3 generator (S-9): name and source.
 */
export const P2_P3_FORM_VECTORS: ReadonlyArray<
  readonly [name: string, source: string]
> = [
  ...BLOCK_FORMS.map((form): readonly [string, string] => [
    form.name,
    formDocument(form),
  ]),
  ...PROSE_LINE_FORMS.map((form): readonly [string, string] => [
    form.name,
    formDocument(form),
  ]),
  ...FORM_ESM_BLOCKS.flatMap(([blockName, block]) =>
    FORM_TERMINATORS.map(
      ([terminatorName, terminator]): readonly [string, string] => [
        `import block, ${blockName}, then the mandatory blank line, under ${terminatorName}`,
        [...block, "", FORM_FIRST_LINE, "{text(M1.s0)}"].join(terminator) +
          terminator,
      ],
    ),
  ),
  [
    "lone-CR terminator followed by an empty line (endLine's guard: CR, never LF)",
    `a${CR}${CR}b${LF}`,
  ],
  ...FORM_TERMINATORS.flatMap(
    ([terminatorName, terminator]): (readonly [string, string])[] => [
      [
        `every form under ${terminatorName} terminators`,
        compositeDocument(() => terminator, false),
      ],
      [
        `every form under ${terminatorName} terminators, final terminator stripped`,
        compositeDocument(() => terminator, true),
      ],
    ],
  ),
  [
    "every form under cycled terminators (endLine's lone-CR guard applied)",
    compositeDocument((index, lineIsEmpty, previous) => {
      const drawn = CYCLED_TERMINATORS[index % CYCLED_TERMINATORS.length];
      return lineIsEmpty && previous === CR && drawn === LF ? CR : drawn;
    }, false),
  ],
];

// ---------------------------------------------------------------------------
// Rendering

/** Counterexample rendering: per-file sources with escapes readable. */
function renderDoc(doc: GeneratedDoc): string {
  const rendered: Record<string, string> = {};
  for (const file of doc.files) rendered[file.path] = sourceOf(file);
  return JSON.stringify(rendered);
}

// ---------------------------------------------------------------------------
// P-2: compiled output equals the oracle; determinism; byte preservation

function mdPathOf(sourcePath: string): string {
  return `${sourcePath.slice(0, -".mdx".length)}.md`;
}

function workspaceFiles(doc: GeneratedDoc): Record<string, string> {
  const files: Record<string, string> = { "xspec.config.ts": EMIT_TRUE_CONFIG };
  for (const file of doc.files) files[file.path] = sourceOf(file);
  return files;
}

/**
 * S-9's per-draw check (helpers/property.ts `mdxSources`): every file a
 * draw stages — the `.mdx` sources are judged before the product sees them.
 */
function stagedSources(doc: GeneratedDoc): DrawSource[] {
  return Object.entries(workspaceFiles(doc));
}

/**
 * The logical lines of a generated file that no construct touches, each with
 * its terminator (the final line possibly without one). Construct-internal
 * terminators never split lines (SPEC 3); lines overlapping any construct
 * are excluded here, so the survivors are exactly the lines SPEC 3 preserves
 * verbatim — the drop rule fires only for lines left empty or
 * whitespace-only purely by removals.
 */
function untouchedLines(file: GeneratedFileDoc): string[] {
  const lines: string[] = [];
  let buffer = "";
  let touched = false;
  const close = (terminatorText: string): void => {
    if (!touched && buffer + terminatorText !== "") {
      lines.push(buffer + terminatorText);
    }
    buffer = "";
    touched = false;
  };
  for (const entry of file.entries) {
    if (entry.kind !== "content") {
      touched = true;
      continue;
    }
    const text = entry.text;
    let start = 0;
    let i = 0;
    while (i < text.length) {
      const code = text.charCodeAt(i);
      if (code !== 0x0a && code !== 0x0d) {
        i += 1;
        continue;
      }
      const t =
        code === 0x0d && text.charCodeAt(i + 1) === 0x0a ? CRLF : text[i];
      buffer += text.slice(start, i);
      close(t);
      i += t.length;
      start = i;
    }
    buffer += text.slice(start);
  }
  close("");
  return lines;
}

/**
 * Direct byte-preservation assertion (P-2, independent of the oracle): every
 * untouched line must occur verbatim in the compiled output, in order, at
 * non-overlapping positions (greedy leftmost matching is complete for
 * ordered non-overlapping substring sequences).
 */
function assertUntouchedLinesPreserved(
  file: GeneratedFileDoc,
  output: string,
  context: string,
): void {
  let cursor = 0;
  for (const line of untouchedLines(file)) {
    const index = output.indexOf(line, cursor);
    if (index < 0) {
      fail(
        `${context}: the source line ${JSON.stringify(line)} of ${file.path} is touched by ` +
          `no removed construct, so SPEC 3 preserves it verbatim (a line with no removal ` +
          `is never dropped), but it does not occur in the compiled output after ` +
          `offset ${String(cursor)} (content bytes outside removed constructs must be preserved)`,
      );
    }
    cursor = index + line.length;
  }
}

/** Decode product-written bytes as UTF-8, failing diagnosed (H-8). */
function decodeUtf8(bytes: Uint8Array, context: string): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return fail(`${context}: the emitted Markdown is not valid UTF-8`);
  }
}

async function runP2Trial(
  product: ProductBinding,
  doc: GeneratedDoc,
): Promise<void> {
  const expected = specCompiledOutputs(doc);
  const files = workspaceFiles(doc);
  // S-9: the draw's sources, judged by the property runner before the body
  // saw them (`stagedSources` above) — declared per draw, as every initial
  // `.mdx` file a trial stages after the body's first product invocation
  // must be (helpers/workspace.ts).
  const mdx = { perDraw: mdxPathsOf(files) };
  const first = await TestWorkspace.create({ files, mdx });
  try {
    const second = await TestWorkspace.create({ files, mdx });
    try {
      await buildOk(
        product,
        first,
        "P-2: `build` of the generated workspace with `markdown: { emit: true }`",
      );
      await buildOk(
        product,
        second,
        "P-2: `build` of the identical workspace in a second directory (H-6 determinism protocol)",
      );
      for (const file of doc.files) {
        const mdRel = mdPathOf(file.path);
        const expectedOutput = expected.get(file.path);
        if (expectedOutput === undefined) {
          throw new Error(
            `P-2 harness defect: no oracle output for ${file.path}`,
          );
        }
        await assertFileBytes(
          first.path(mdRel),
          expectedOutput,
          `P-2: emitted ${mdRel} equals the SPEC 3 oracle's compilation of ${file.path} ` +
            `(removal / replacement / line-drop / terminator rules; H-4 byte equality)`,
        );
        await assertFilesEqual(
          first.path(mdRel),
          second.path(mdRel),
          `P-2: compilation is deterministic — ${mdRel} built from the identical workspace ` +
            `in two separate directories must be byte-identical (H-6)`,
        );
        const output = decodeUtf8(
          await first.readBytes(mdRel),
          `P-2: emitted ${mdRel}`,
        );
        assertUntouchedLinesPreserved(file, output, `P-2: emitted ${mdRel}`);
      }
    } finally {
      await second.dispose();
    }
  } finally {
    await first.dispose();
  }
}

// ---------------------------------------------------------------------------
// P-3: text algebra as product-internal consistency

/**
 * Whether `subtree` can be decomposed as r0 c1 r1 … cN rN where c1…cN are
 * the children's subtree texts in document order and r0…rN concatenate to
 * `own` (SPEC 1.6: N children divide the contribution into exactly N + 1
 * runs, empty runs counting). Iterative memoized search over (children
 * consumed, position in subtree); the position in `own` is determined by
 * the two. Caller guarantees |subtree| = |own| + Σ|children|.
 */
export function interleavingExists(
  subtree: string,
  own: string,
  children: readonly string[],
): boolean {
  const n = children.length;
  const prefix: number[] = [0];
  for (const child of children) {
    prefix.push(prefix[prefix.length - 1] + child.length);
  }
  const width = subtree.length + 1;
  const seen = new Set<number>();
  const stack: number[] = [0];
  while (stack.length > 0) {
    const state = stack.pop() as number;
    if (seen.has(state)) continue;
    seen.add(state);
    const consumed = Math.floor(state / width);
    const position = state % width;
    const ownPosition = position - prefix[consumed];
    if (consumed === n) {
      if (subtree.slice(position) === own.slice(ownPosition)) return true;
      continue;
    }
    const child = children[consumed];
    if (subtree.startsWith(child, position)) {
      stack.push((consumed + 1) * width + position + child.length);
    }
    if (
      ownPosition < own.length &&
      position < subtree.length &&
      subtree.charCodeAt(position) === own.charCodeAt(ownPosition)
    ) {
      stack.push(consumed * width + position + 1);
    }
  }
  return false;
}

function excerpt(text: string): string {
  const rendered = JSON.stringify(text);
  return rendered.length <= 160 ? rendered : `${rendered.slice(0, 160)}…`;
}

/** The SPEC 1.6 algebra for one node, over product-reported values only. */
function assertTextAlgebra(
  node: DocNode,
  texts: ReadonlyMap<string, NodeTextSummary>,
  context: string,
): void {
  const self = texts.get(node.ref);
  if (self === undefined) {
    throw new Error(`P-3 harness defect: no queried texts for ${node.ref}`);
  }
  const children = node.childRefs.map((ref) => {
    const child = texts.get(ref);
    if (child === undefined) {
      throw new Error(`P-3 harness defect: no queried texts for ${ref}`);
    }
    return child.subtreeText;
  });
  const childrenLength = children.reduce((sum, text) => sum + text.length, 0);
  if (self.subtreeText.length !== self.ownText.length + childrenLength) {
    fail(
      `${context}: for ${node.ref}, |subtree text| must equal |own text| plus the sum of ` +
        `the ${String(children.length)} children's |subtree text| — the children interleave ` +
        `with exactly N + 1 own-text runs and nothing else (SPEC 1.6); got ` +
        `${String(self.subtreeText.length)} vs ${String(self.ownText.length)} + ${String(childrenLength)}\n` +
        `  subtree: ${excerpt(self.subtreeText)}\n  own:     ${excerpt(self.ownText)}`,
    );
  }
  if (!interleavingExists(self.subtreeText, self.ownText, children)) {
    fail(
      `${context}: for ${node.ref}, the reported subtree text does not decompose as the ` +
        `reported own text's N + 1 runs interleaved with the ${String(children.length)} ` +
        `children's reported subtree texts in document order (SPEC 1.6)\n` +
        `  subtree:  ${excerpt(self.subtreeText)}\n` +
        `  own:      ${excerpt(self.ownText)}\n` +
        `  children: ${children.map(excerpt).join(", ")}`,
    );
  }
}

async function runP3Trial(
  product: ProductBinding,
  doc: GeneratedDoc,
): Promise<void> {
  const files = workspaceFiles(doc);
  // S-9: the draw's sources, declared per draw (see runP2Trial).
  const workspace = await TestWorkspace.create({
    files,
    mdx: { perDraw: mdxPathsOf(files) },
  });
  try {
    await buildOk(
      product,
      workspace,
      "P-3: `build` of the generated workspace with `markdown: { emit: true }`",
    );
    for (const file of doc.files) {
      const texts = new Map<string, NodeTextSummary>();
      for (const node of file.nodes) {
        const label = `P-3 \`query node ${node.ref}\``;
        texts.set(
          node.ref,
          decodeNodeTextSummary(
            await runJson(
              product,
              workspace,
              ["query", "node", node.ref],
              label,
            ),
            label,
          ),
        );
      }
      const root = texts.get(file.path);
      if (root === undefined) {
        throw new Error(`P-3 harness defect: no root texts for ${file.path}`);
      }
      const mdRel = mdPathOf(file.path);
      await assertFileBytes(
        workspace.path(mdRel),
        root.subtreeText,
        `P-3: the root node's reported subtree text equals the compiled Markdown ` +
          `output emitted at ${mdRel}, byte for byte (SPEC 1.6, 1.2, 3)`,
      );
      for (const node of file.nodes) {
        assertTextAlgebra(node, texts, "P-3");
      }
    }
  } finally {
    await workspace.dispose();
  }
}

// ---------------------------------------------------------------------------
// The registered property tests

const P_2 = defineProductTest({
  id: "P-2",
  title:
    "property: random documents (prose, fenced code blocks and inline code spans spelling " +
    "tag-, import-, and expression-like bytes as literal content, nested sections, imports " +
    "with JavaScript comments and `;` terminators beside them in their ESM block, comments " +
    "in every form of 2.7 — `{}`, block-comment sequences, line-comment containers, the " +
    "run-on `{// c}` form, ECMAScript-only whitespace between braces — embeddings with " +
    "whitespace and comments beside the call, mixed line terminators, " +
    "boundary-code-point-weighted content) compile to Markdown byte-equal to the harness's " +
    "SPEC 3 oracle, deterministically across directories, preserving content bytes outside " +
    "removed constructs (SPEC 3, 1.4, 1.6, 7.3; TEST-SPEC §16 P-2)",
  // Wall-clock hang guard only (H-10): three fixed seeds (E-5), two
  // workspaces and two builds per trial, plus the shrink budget.
  timeoutMs: 300_000,
  run: async (product) => {
    await checkProperty(
      "P-2 Markdown compilation",
      generatedDoc,
      async (doc) => {
        await runP2Trial(product, doc);
      },
      {
        runs: 12,
        maxShrinkExecutions: 150,
        render: renderDoc,
        mdxSources: stagedSources,
      },
    );
  },
});

const P_3 = defineProductTest({
  id: "P-3",
  title:
    "property: for random documents, the root's subtree text equals the compiled Markdown " +
    "output, and every node's subtree text equals its own-text runs interleaved with its " +
    "children's subtree texts in document order, N children yielding N + 1 runs — asserted " +
    "as internal consistency of the product's reported values (SPEC 1.6, 3; TEST-SPEC §16 P-3)",
  // Wall-clock hang guard only (H-10): one build plus one `query node` per
  // requirement node per trial, three fixed seeds (E-5), plus shrinking.
  timeoutMs: 300_000,
  run: async (product) => {
    await checkProperty(
      "P-3 text algebra",
      generatedDoc,
      async (doc) => {
        await runP3Trial(product, doc);
      },
      {
        runs: 6,
        maxShrinkExecutions: 100,
        render: renderDoc,
        mdxSources: stagedSources,
      },
    );
  },
});

/** TEST-SPEC §16 P-2 and P-3 (PROP-02). */
export const section16P2P3Tests: readonly ProductTestEntry[] = [P_2, P_3];
