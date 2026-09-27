// TEST-SPEC §16 P-12 (at ≡ view; occurrence order) — PROP-10.
//
// One registered product-facing property test (C-2 "one code path"): a
// seeded, reproducible generator (helpers/property.ts, H-10; fixed seed set
// in CI, E-5) produces small random spec-only workspaces, valid by
// construction — 1–3 `.mdx` spec sources with nested sections, prose
// (multi-byte spellings included, so byte offsets diverge from code-point
// and UTF-16 counts, SPEC 1.7), MDX comments, blank lines, an optional
// import of the first file, and resolving `d` references and
// `{text(...)}` embeddings — and asserts, per trial, exactly the two
// equivalences P-12 states:
//
//   * **at ≡ view.** For EVERY file and EVERY offset 0…byte length, `at`'s
//     resolution — section identity, construct range, containing occurrence
//     — equals the resolution computed from that file's per-file entry of
//     one bare `view` answer alone (SPEC 11.5: "the same resolution is
//     derivable from the view's data alone … `at` adds convenience, not
//     information"): the innermost containing section construct by range
//     containment over the view's positional tree — the root where none
//     contains the offset, the EOF caret included — and the containing
//     occurrence record, via `resolveAtFromView`, imported from
//     registry/section-11.5.ts (T11.5-1), where the comparator is proven
//     against T11.5-1's precomputed fixture tree and pointwise constants
//     before any product invocation — P-12's anchor (TEST-SPEC §16
//     preamble; CERTIFICATIONS.md's P-12 exclusion note: "its comparator is
//     computed from the product's own `view` answers, anchored by T11.5-1's
//     precomputed fixture, so there is no independent oracle to mis-trust").
//     A requested file the view answer carries no entry for (the masked
//     case, 14.20: an unparseable requested file contributes no view) must
//     resolve to exactly the unavailability marker at every offset (SPEC
//     11.5, 11.2, 12.7; T11.5-3's deterministic arm generalized).
//   * **Occurrence order.** The workspace-wide bare `occurrences`
//     enumeration equals the view-collected occurrence records — the
//     concatenation of every per-file view's `occurrences` member — sorted
//     by referencing file path bytes, then range start, then range end
//     (SPEC 5.7: occurrence order is total and deterministic): totality and
//     order in one array equality, over records decoded through the same
//     form-exact 12.7 record decode on both sides (H-3). Duplicate-freedom
//     is asserted first-class on both sides: distinct occurrences are
//     distinct spellings occupying distinct spans, so identical
//     (file, range) spans do not occur (5.7) — which also makes the sort
//     key total, no further tiebreak existing. And the enumeration is
//     byte-identical across runs: a second identical invocation's entire
//     stdout equals the first's byte-for-byte (5.7, SPEC 12.0
//     byte-determinism for identical input).
//
// Both equivalences compare the product with itself (H-4): no harness
// oracle predicts identities, ranges, occurrences, or resolution — the
// deterministic §11 tests pin pointwise correctness; P-12 searches the
// input space for inconsistency between the three surfaces.
//
// Input space: valid by construction (TEST-SPEC §16 preamble — P-12 is not
// among the properties staging invalid or imperfect input by design, P-1's
// invalid draws, P-8, and P-11, so its oracles are evaluated over documents
// that build and a generator artifact never surfaces as a product failure).
// The configuration is constant and valid (a configuration error is a
// 14.14 exit-2 outcome preceding every answer, outside P-12's subject),
// file paths are fixed valid spellings, and every staged argument is
// well-formed with offsets in 0…byte length — so no invocation stages a
// usage error and every answer exits 0 or 1 (SPEC 11.2: argument checks
// alone exit 2; P-12's entry pins no exit beyond that). References follow
// P-4's discipline (section-16-p4.ts): each targets the file's constant
// anchor `t` — its first top-level section, holding prose alone — or,
// through the drawn import `M0` of the first file (files after the first
// only; the first draws none, so no import cycle arises, SPEC 2.1), that
// file's anchor `M0.t`, or `s1` — the first section a file emits, always
// top-level — at sites after `s1`'s closing tag alone (the root's later
// content or a later top-level subtree). So every reference resolves
// (SPEC 2.2–2.4); none names the site's own section or an ancestor (SPEC
// 5.3: "a section MUST NOT depend on or embed its own ancestor"); every
// depends/embeds edge points into a subtree whose own references reach
// only the anchors, which reference nothing, so the combined
// contains/depends/embeds graph is acyclic (5.3); and section IDs come
// from a fresh per-file counter beside `t` (`s1`, `s1.s2`, …: unique and
// structurally valid, 1.3, 1.4). Imperfect input is anchored elsewhere: an
// unparseable requested file's explicitly unavailable resolution by
// T11.5-3, explicitly unavailable identity data by T11.2-*, and the
// imperfect-input classes by P-11.
//
// Rendering discipline (every composed file derives, S-9): section tags,
// comments, and prose are own-line constructs joined by single newlines
// (the T11.5-1/P-4 style — MDX flow JSX interrupts a paragraph, so glued
// tags stay flow constructs), while the import is followed by a mandatory
// blank line (an MDX ESM block extends to the next blank line and cannot
// interrupt a paragraph — the FP-094 hazard); embeddings are glued mid-line
// behind non-empty prose; prose draws from a fixed MDX-safe pool
// (alphanumeric line starts; no `<`, `>`, `{`, `}`, backtick, `~`, `&`,
// `\`), with multi-byte entries (é, à, —) shifting every later offset
// (SPEC 1.7). `P12_FORM_VECTORS` below spells every composed form, each
// where the generator may compose it, for the S-9 self-test
// (test/self/s9-fixture-well-formedness.test.ts), and every draw's sources
// are judged before the product sees them (`mdxSources`,
// helpers/property.ts).
//
// Cost shape: the at ≡ view clause is exhaustive per trial (sum of file
// byte lengths + one EOF caret per file `at` invocations — "reachability is
// total by construction", CERTIFICATIONS.md), so the generator keeps files
// small and the trial count low (`runs: 3` × the 3 default seeds = 9
// CI-pinned trials), with the shrink budget sized against whole-trial
// re-execution cost. An implementation-time dry-run over the committed
// default seeds at these 9 trials measured: 20 files (1-file workspaces ×2,
// 2-file ×3, 3-file ×4), 8 drawn imports and one `M0.t` reference (a
// `d={M0.t}`), 4 embeddings (`'t'` ×3, `"t"` ×1, each with a tail) and 6
// single `d` props (`d={"t"}` ×5, `d={M0.t}` ×1) — 10 occurrences, spread
// over two files in three trials and two to a file in two files — one
// depth-2 section, multi-byte prose in 14 of the 20 files, and 1339 `at`
// invocations in all. No `"s1"` reference and no `d` array occur there,
// nor in the first 25 trials per seed: both arise only at a site after
// `s1` closes (about 2% of files over a 1000-trial sample on other seeds),
// and the S-9 vectors spell both. Every file of both seed sets derives,
// and every trial of both — as every one of the sample's 38 trials
// spelling `"s1"`, and each form vector — builds under the built product
// with exit 0 and no finding (an implementation-time cross-check, never a
// committed check against the product). The `view` invocation runs first,
// so a product without the §11 surfaces (the stub, S-7) fails immediately
// and cheaply, and shrinking stays fast in the red phase (H-8).
//
// P-12 is expressly outside every CERTIFICATIONS.md fixture scope (its
// Exclusions name P-12 directly), so this body binds only to the real
// product surface.

import { Buffer } from "node:buffer";
import type {
  FileView,
  OccurrenceRecord,
  PathValue,
} from "../../helpers/adapters/index.js";
import {
  decodeAtReport,
  decodeOccurrencesReport,
  decodeViewReport,
} from "../../helpers/adapters/index.js";
import { fail, parseJsonStdout } from "../../helpers/assertions.js";
import type { Choices, DrawSource, Gen } from "../../helpers/property.js";
import { checkProperty } from "../../helpers/property.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import type { ProductBinding, RunResult } from "../../helpers/subprocess.js";
import { runProduct } from "../../helpers/subprocess.js";
import type { TestWorkspace as Workspace } from "../../helpers/workspace.js";
import { TestWorkspace, mdxPathsOf } from "../../helpers/workspace.js";
import { SPECS_ONLY_CONFIG } from "./section-11.2.js";
import type { ResolutionData } from "./section-11.5.js";
import { resolveAtFromView } from "./section-11.5.js";
import { assertSameJson } from "./support.js";

const UNAVAILABLE = { unavailable: true } as const;

// ---------------------------------------------------------------------------
// Generation: file pool, content pools, per-file builder.

/** Fixed valid paths in byte order (the 5.7 file-order sort is exercised). */
const FILE_POOL = ["specs/A.mdx", "specs/B.mdx", "specs/C.mdx"] as const;

/** The drawn import (files after the first only): binds the first file. */
const IMPORT_LINE = 'import M0 from "./A.xspec"';

/**
 * MDX-safe prose lines (module header): each starts alphanumeric and spells
 * no structural character; the multi-byte entries (é 2 bytes, à 2 bytes,
 * — 3 bytes) shift every later byte offset (SPEC 1.7). Simplest first
 * (pick shrinks toward the first entry).
 */
const PROSE_POOL = [
  "mot.",
  "fin brève.",
  "ligne bàsique 7.",
  "texte — étendu.",
] as const;

/** Mid-line tails glued after an embedding (safe interior characters). */
const TAIL_POOL = [" fin.", " — suite."] as const;

/** Own-line MDX comment interiors (no slash, no star). */
const COMMENT_POOL = ["note", "à voir"] as const;

/**
 * Embedding argument spellings (SPEC 2.3, 2.4 static forms), every one
 * resolving (module header, "Input space"): `"t"` — the file's constant
 * anchor section below — and `'t'`, a spelling variant of the same target;
 * `"s1"` once the file's `s1` has closed (`s1` is the first section a file
 * emits, always top-level, so at every later site it exists and is neither
 * the site's own section nor an ancestor, SPEC 5.3); `M0.t` (external) where
 * the import was drawn. Simplest first (pick shrinks toward the first
 * entry).
 */
function embedArgumentMenu(
  hasImport: boolean,
  s1Closed: boolean,
): readonly string[] {
  const menu = ['"t"', "'t'"];
  if (s1Closed) menu.push('"s1"');
  if (hasImport) menu.push("M0.t");
  return menu;
}

/**
 * Opening-tag `d` prop spellings (SPEC 2.2), `""` = prop omitted, under the
 * embedding menu's targets and conditions: every entry resolves, and the
 * array's entries record occurrences separately (5.7).
 */
function dPropMenu(
  hasImport: boolean,
  s1Closed: boolean,
): ReadonlyArray<readonly [number, string]> {
  const entries: (readonly [number, string])[] = [
    [5, ""],
    [2, ' d={"t"}'],
  ];
  if (s1Closed) entries.push([1, ' d={["t", "s1"]}']);
  if (hasImport) entries.push([1, " d={M0.t}"]);
  return entries;
}

/** One generated workspace (module header). */
export interface P12Trial {
  /** Staged content per workspace-relative path, in FILE_POOL order. */
  readonly files: ReadonlyArray<readonly [string, string]>;
}

// --- the line templates (the generator and the S-9 vector set below) ------

/** The import's ESM block: the declaration, then the mandatory blank line (the ESM block must end, FP-094). */
const IMPORT_BLOCK_LINES: readonly string[] = [IMPORT_LINE, ""];

/** The constant anchor section `t` opening every file. */
function anchorSectionLines(prose: string): string[] {
  return ['<S id="t">', prose, "</S>"];
}

/** A prose line, optionally carrying an embedding and, after it, a tail. */
function proseLine(
  prose: string,
  embedArgument: string | null,
  tail: string | null,
): string {
  if (embedArgument === null) return prose;
  return `${prose}{text(${embedArgument})}${tail ?? ""}`;
}

/** A section's opening tag: the dotted id, then the `d` prop spelling. */
function openingTag(dotted: string, dProp: string): string {
  return `<S id="${dotted}"${dProp}>`;
}

/** An own-line MDX comment. */
function commentLine(interior: string): string {
  return `{/* ${interior} */}`;
}

/**
 * One file's lines (joined by single newlines; module header discipline).
 * The constant anchor section `t` opens every file, so the reference
 * spellings above always have a target, in-file and cross-file; `s1Closed`
 * turns true right after the closing tag of `s1` — the first section
 * `emitSection` names, always top-level — so neither `s1`'s opening tag nor
 * anything inside it spells `"s1"` (module header, "Input space").
 */
function genFileLines(choices: Choices, hasImport: boolean): string[] {
  const lines: string[] = [];
  if (hasImport) lines.push(...IMPORT_BLOCK_LINES);
  lines.push(...anchorSectionLines(choices.pick(PROSE_POOL)));

  let seg = 1;
  let s1Closed = false;
  const nextSeg = (): string => {
    const name = `s${String(seg)}`;
    seg += 1;
    return name;
  };
  const emitProse = (): void => {
    const prose = choices.pick(PROSE_POOL);
    const embedArgument = choices.boolean(0.4)
      ? choices.pick(embedArgumentMenu(hasImport, s1Closed))
      : null;
    const tail =
      embedArgument !== null && choices.boolean(0.5)
        ? choices.pick(TAIL_POOL)
        : null;
    lines.push(proseLine(prose, embedArgument, tail));
  };
  const emitSection = (parentDotted: string, depth: number): void => {
    const segName = nextSeg();
    const dotted = parentDotted === "" ? segName : `${parentDotted}.${segName}`;
    lines.push(
      openingTag(dotted, choices.weightedPick(dPropMenu(hasImport, s1Closed))),
    );
    const innerCount = choices.intInclusive(0, 2);
    for (let k = 0; k < innerCount; k += 1) {
      const menu: (readonly [
        number,
        "prose" | "blank" | "comment" | "section",
      ])[] = [
        [3, "prose"],
        [1, "blank"],
        [1, "comment"],
      ];
      if (depth < 2) menu.push([2, "section"]);
      const shape = choices.weightedPick(menu);
      if (shape === "prose") emitProse();
      else if (shape === "blank") lines.push("");
      else if (shape === "comment") {
        lines.push(commentLine(choices.pick(COMMENT_POOL)));
      } else emitSection(dotted, depth + 1);
    }
    lines.push("</S>");
    if (dotted === "s1") s1Closed = true;
  };

  const extraCount = choices.intInclusive(0, 2);
  for (let i = 0; i < extraCount; i += 1) {
    const shape = choices.weightedPick<
      "prose" | "blank" | "comment" | "section"
    >([
      [3, "prose"],
      [1, "blank"],
      [1, "comment"],
      [4, "section"],
    ]);
    if (shape === "prose") emitProse();
    else if (shape === "blank") lines.push("");
    else if (shape === "comment") {
      lines.push(commentLine(choices.pick(COMMENT_POOL)));
    } else emitSection("", 0);
  }
  return lines;
}

// --- S-9's fixed form-vector set (TEST-SPEC 17 S-9; the §16 preamble) ------

/** A file's staged text: its lines joined by single newlines, terminated. */
function p12FileText(lines: readonly string[]): string {
  return `${lines.join("\n")}\n`;
}

/**
 * One file holding every form the generator composes, with or without the
 * import (the `M0` spellings join the menus with it), each where the
 * generator may compose it — so the file is valid as the generator would
 * compose it (module header, "Input space"): the anchor, every prose line,
 * every embedding argument of the opening menu plain and with every tail,
 * every comment, a blank line, and one top-level section per `d` prop
 * spelling, each nested to the depth cap with every inner shape. The first
 * of them is `s1`, spelling the omitted prop (every menu's first entry) and
 * drawing its subtree's spellings from the opening menus alone (`s1` is not
 * yet closed there); the embedding arguments the menus add once `s1` has
 * closed follow its closing tag, plain and with every tail, and the later
 * sections draw from the full menus.
 */
function p12FormFileLines(hasImport: boolean): string[] {
  const lines: string[] = hasImport ? [...IMPORT_BLOCK_LINES] : [];
  lines.push(...anchorSectionLines(PROSE_POOL[0]));
  for (const prose of PROSE_POOL) lines.push(proseLine(prose, null, null));
  const pushEmbeddings = (embedArguments: readonly string[]): void => {
    for (const argument of embedArguments) {
      lines.push(proseLine(PROSE_POOL[1], argument, null));
      for (const tail of TAIL_POOL) {
        lines.push(proseLine(PROSE_POOL[2], argument, tail));
      }
    }
  };
  const openingArguments = embedArgumentMenu(hasImport, false);
  pushEmbeddings(openingArguments);
  for (const interior of COMMENT_POOL) lines.push(commentLine(interior));
  lines.push("");
  const dPropSpellings = (s1Closed: boolean): string[] =>
    dPropMenu(hasImport, s1Closed).map(([, spelling]) => spelling);
  let seg = 1;
  let s1Closed = false;
  const nextSeg = (): string => {
    const name = `s${String(seg)}`;
    seg += 1;
    return name;
  };
  dPropSpellings(true).forEach((dProp, index) => {
    const embedArguments = embedArgumentMenu(hasImport, s1Closed);
    const dProps = dPropSpellings(s1Closed);
    const top = nextSeg();
    lines.push(openingTag(top, dProp));
    lines.push(
      proseLine(
        PROSE_POOL[3],
        embedArguments[index % embedArguments.length]!,
        TAIL_POOL[index % TAIL_POOL.length]!,
      ),
    );
    lines.push("");
    lines.push(commentLine(COMMENT_POOL[index % COMMENT_POOL.length]!));
    const child = `${top}.${nextSeg()}`;
    lines.push(openingTag(child, dProps[(index + 1) % dProps.length]!));
    const grandchild = `${child}.${nextSeg()}`;
    lines.push(openingTag(grandchild, ""));
    lines.push(proseLine(PROSE_POOL[0], null, null));
    lines.push("</S>", "</S>", "</S>");
    if (top === "s1") {
      s1Closed = true;
      pushEmbeddings(
        embedArgumentMenu(hasImport, true).filter(
          (argument) => !openingArguments.includes(argument),
        ),
      );
    }
  });
  return lines;
}

/**
 * Each form alone after the anchor — a minimal context — named. A form the
 * menus offer only once `s1` has closed (a spelling of `s1`) follows a
 * closed top-level `s1`, as the generator composes it: the embedding on the
 * root's next line, the `d` prop on the next top-level section, `s2`.
 */
function p12MinimalContexts(
  hasImport: boolean,
): (readonly [name: string, source: string])[] {
  const label = hasImport ? "with the import" : "without the import";
  const context = (
    name: string,
    afterS1: boolean,
    ...lines: string[]
  ): readonly [string, string] => [
    `${name}, alone after the anchor${afterS1 ? " and a closed s1" : ""} ${label}`,
    p12FileText([
      ...(hasImport ? IMPORT_BLOCK_LINES : []),
      ...anchorSectionLines(PROSE_POOL[0]),
      ...(afterS1 ? [openingTag("s1", ""), PROSE_POOL[0], "</S>"] : []),
      ...lines,
    ]),
  ];
  const openingArguments = embedArgumentMenu(hasImport, false);
  const openingDProps = dPropMenu(hasImport, false).map(
    ([, spelling]) => spelling,
  );
  return [
    ...PROSE_POOL.map((prose) =>
      context(`prose ${JSON.stringify(prose)}`, false, prose),
    ),
    ...embedArgumentMenu(hasImport, true).flatMap((argument) => {
      const afterS1 = !openingArguments.includes(argument);
      return [
        context(
          `embedding of ${argument}`,
          afterS1,
          proseLine(PROSE_POOL[0], argument, null),
        ),
        ...TAIL_POOL.map((tail) =>
          context(
            `embedding of ${argument} with the tail ${JSON.stringify(tail)}`,
            afterS1,
            proseLine(PROSE_POOL[0], argument, tail),
          ),
        ),
      ];
    }),
    ...COMMENT_POOL.map((interior) =>
      context(
        `comment ${JSON.stringify(interior)}`,
        false,
        commentLine(interior),
      ),
    ),
    ...dPropMenu(hasImport, true).map(([, dProp]) => {
      const afterS1 = !openingDProps.includes(dProp);
      return context(
        dProp === "" ? "a section without a d prop" : `a section with${dProp}`,
        afterS1,
        openingTag(afterS1 ? "s2" : "s1", dProp),
        PROSE_POOL[0],
        "</S>",
      );
    }),
    context("a blank line", false, ""),
  ];
}

/**
 * The fixed form-vector set of the P-12 generator (S-9): every form in one
 * file and each alone in a minimal context, with and without the import —
 * each vector file valid as the generator would compose it (every reference
 * it spells resolves, none to its own section or an ancestor; IDs unique).
 */
export const P12_FORM_VECTORS: ReadonlyArray<
  readonly [name: string, source: string]
> = [false, true].flatMap((hasImport): (readonly [string, string])[] => {
  const label = hasImport ? "with the import" : "without the import";
  return [
    [`every form ${label}`, p12FileText(p12FormFileLines(hasImport))],
    ...p12MinimalContexts(hasImport),
  ];
});

/** The P-12 trial generator (see the module header). */
export const genP12Trial: Gen<P12Trial> = (choices) => {
  const fileCount = choices.weightedPick<number>([
    [2, 1],
    [3, 2],
    [2, 3],
  ]);
  const files: (readonly [string, string])[] = [];
  for (let i = 0; i < fileCount; i += 1) {
    const hasImport = i > 0 && choices.boolean(0.5);
    files.push([
      FILE_POOL[i],
      `${genFileLines(choices, hasImport).join("\n")}\n`,
    ]);
  }
  return { files };
};

/** Counterexample rendering: the staged sources, in full. */
export function renderP12Trial(trial: P12Trial): string {
  return JSON.stringify({ files: Object.fromEntries(trial.files) });
}

// ---------------------------------------------------------------------------
// The 5.7 occurrence-order key and the duplicate-span assertion.

/** A path value's bytes (12.7: marked byte form or UTF-8 string; 12.0). */
function pathBytes(path: PathValue): Buffer {
  return typeof path === "string"
    ? Buffer.from(path, "utf8")
    : Buffer.from(path.bytes, "hex");
}

/**
 * Occurrence order (SPEC 5.7): referencing file path bytes, then range
 * start, then range end — a total key once duplicate spans are excluded
 * ("identical ranges do not occur and no further tiebreak exists").
 */
function occurrenceOrder(a: OccurrenceRecord, b: OccurrenceRecord): number {
  const files = Buffer.compare(pathBytes(a.file), pathBytes(b.file));
  if (files !== 0) return files;
  if (a.range.start !== b.range.start) return a.range.start - b.range.start;
  return a.range.end - b.range.end;
}

/**
 * No two records occupy one (file, range) span — distinct occurrences are
 * distinct spellings occupying distinct spans, so identical ranges do not
 * occur (SPEC 5.7); this also makes `occurrenceOrder` total, so the sorted
 * comparison below needs no further tiebreak.
 */
function assertDistinctSpans(
  records: readonly OccurrenceRecord[],
  context: string,
): void {
  const seen = new Map<string, number>();
  records.forEach((record, index) => {
    const key = `${pathBytes(record.file).toString("hex")}:${String(
      record.range.start,
    )}:${String(record.range.end)}`;
    const prior = seen.get(key);
    if (prior !== undefined) {
      fail(
        `${context}: records ${String(prior)} and ${String(index)} both ` +
          `occupy the span [${String(record.range.start)}, ` +
          `${String(record.range.end)}) of the same file — distinct ` +
          `occurrences are distinct spellings occupying distinct spans, so ` +
          `identical ranges do not occur (SPEC 5.7)`,
      );
    }
    seen.set(key, index);
  });
}

// ---------------------------------------------------------------------------
// The property body.

/**
 * Run one invocation of the availability surfaces. Every argument staged by
 * P-12 is well-formed with the named file discovered and the offset in
 * 0…byte length, so no usage error exists and the answer exits 0 or 1
 * (SPEC 11.2: findings ride the answer at exit 1, never exit 2).
 */
async function runAnswer(
  product: ProductBinding,
  workspace: Workspace,
  argv: readonly string[],
  context: string,
): Promise<RunResult> {
  const result = await runProduct(product, {
    cwd: workspace.root,
    argv,
  });
  if (result.signal !== null) {
    fail(
      `${context}: ${result.commandLine} died by signal ` +
        `${String(result.signal)} instead of exiting — SPEC 12.0 partitions ` +
        `all outcomes into exit codes 0, 1, and 2`,
    );
  }
  if (result.exitCode !== 0 && result.exitCode !== 1) {
    fail(
      `${context}: exit ${String(result.exitCode)} — every P-12 invocation ` +
        `is well-formed over discovered files (offsets within 0…byte ` +
        `length), so no usage error exists and the answer exits 0 or 1, ` +
        `whatever findings the workspace carries (SPEC 11.2, 12.0)`,
    );
  }
  return result;
}

/**
 * S-9's per-draw check (helpers/property.ts `mdxSources`): every composed
 * file, each of which must derive — the workspaces are valid by
 * construction (module header, "Input space"; TEST-SPEC §16 preamble).
 */
function stagedP12Sources(trial: P12Trial): DrawSource[] {
  return trial.files.map(([path, contents]): DrawSource => [path, contents]);
}

/** The P-12 property body for one generated trial (module header). */
async function runP12Trial(
  product: ProductBinding,
  trial: P12Trial,
): Promise<void> {
  const files = {
    "xspec.config.ts": SPECS_ONLY_CONFIG,
    ...Object.fromEntries(trial.files),
  };
  const workspace = await TestWorkspace.create({
    files,
    // S-9: every composed file is the draw's, judged by the property runner
    // before the body saw it (`stagedP12Sources` above) and declared
    // `perDraw`, as every initial `.mdx` file a trial stages after the
    // body's first product invocation must be (helpers/workspace.ts) —
    // judged again at creation: it must derive.
    mdx: { perDraw: mdxPathsOf(files) },
  });
  try {
    // --- the derivability ground: one bare `view` over the whole domain ----
    const viewContext = "P-12 `xspec view`";
    const viewReport = decodeViewReport(
      parseJsonStdout(
        await runAnswer(product, workspace, ["view"], viewContext),
        viewContext,
      ),
      { text: false },
      viewContext,
    );
    const stagedPaths = new Set(trial.files.map(([path]) => path));
    const viewByPath = new Map<string, FileView>();
    for (const entry of viewReport.views) {
      if (typeof entry.file !== "string" || !stagedPaths.has(entry.file)) {
        fail(
          `${viewContext}: the answer carries a view for ` +
            `${JSON.stringify(entry.file)}, which is no staged spec source — ` +
            `a bare \`view\` covers exactly the discovered spec sources, ` +
            `each a valid-UTF-8 path string here (SPEC 11.4, 12.0)`,
        );
      }
      if (viewByPath.has(entry.file)) {
        fail(
          `${viewContext}: two views for ${JSON.stringify(entry.file)} — ` +
            `the requested files form a set, one per-file view per ` +
            `parseable requested file (SPEC 11.4, 12.7)`,
        );
      }
      viewByPath.set(entry.file, entry);
    }

    // --- occurrence order: enumeration ≡ view-collected, sorted (5.7) ------
    const occContext = "P-12 `xspec occurrences`";
    const first = await runAnswer(
      product,
      workspace,
      ["occurrences"],
      occContext,
    );
    const second = await runAnswer(
      product,
      workspace,
      ["occurrences"],
      `${occContext} — second identical invocation`,
    );
    if (
      Buffer.compare(
        Buffer.from(first.stdoutBytes),
        Buffer.from(second.stdoutBytes),
      ) !== 0 ||
      first.exitCode !== second.exitCode
    ) {
      fail(
        `${occContext}: two identical invocations over unchanged sources ` +
          `must answer byte-identically with one exit code — occurrence ` +
          `order is total and deterministic, and output is ` +
          `byte-deterministic for identical input (SPEC 5.7, 12.0); first ` +
          `exit ${String(first.exitCode)}, second exit ` +
          `${String(second.exitCode)}`,
      );
    }
    const enumeration = decodeOccurrencesReport(
      parseJsonStdout(first, occContext),
      occContext,
    ).occurrences;
    assertDistinctSpans(enumeration, `${occContext} — the enumeration`);
    for (const [path, entry] of viewByPath) {
      assertDistinctSpans(
        entry.occurrences,
        `${viewContext} — the ${path} view's occurrence records`,
      );
    }
    const collected = [...viewByPath.values()]
      .flatMap((entry) => entry.occurrences)
      .sort(occurrenceOrder);
    assertSameJson(
      enumeration,
      collected,
      `${occContext}: the workspace-wide enumeration must equal the ` +
        `view-collected occurrence records sorted by referencing file path ` +
        `bytes, then range start, then range end — total (every view ` +
        `record enumerated, nothing else) and in occurrence order, over ` +
        `one spec-only domain (SPEC 5.7, 11.3, 11.4)`,
    );

    // --- at ≡ view: every file, every offset 0…byte length -----------------
    for (const [path, content] of trial.files) {
      const byteLength = Buffer.byteLength(content, "utf8");
      const entry = viewByPath.get(path);
      const data: ResolutionData | null =
        entry === undefined
          ? null
          : { root: entry.root, occurrences: entry.occurrences };
      for (let offset = 0; offset <= byteLength; offset += 1) {
        const context = `P-12 \`at ${path} ${String(offset)}\``;
        const report = decodeAtReport(
          parseJsonStdout(
            await runAnswer(
              product,
              workspace,
              ["at", path, String(offset)],
              context,
            ),
            context,
          ),
          context,
        );
        const expected =
          data === null ? UNAVAILABLE : resolveAtFromView(data, offset);
        assertSameJson(
          report.resolution,
          expected,
          data === null
            ? `${context}: the requested file contributed no view — the ` +
                `masked case — so its position data is gone with the rest of ` +
                `it and every offset's resolution is exactly the ` +
                `unavailability marker (SPEC 11.2, 11.5, 12.7)`
            : `${context}: for every offset of the file, \`at\`'s ` +
                `resolution must equal the resolution computed from the ` +
                `file's own \`view\` entry alone — the innermost containing ` +
                `section construct by range containment (the root where ` +
                `none contains it, the EOF caret included) with its ` +
                `identity datum verbatim, and the containing occurrence ` +
                `record (\`null\` where the offset lies in none) — \`at\` ` +
                `adds convenience, not information (SPEC 11.5, 11.4, 1.7)`,
        );
      }
    }
  } finally {
    await workspace.dispose();
  }
}

// ---------------------------------------------------------------------------
// The registered property test.

const P_12 = defineProductTest({
  id: "P-12",
  title:
    "property: on random spec-only workspaces, valid by construction " +
    "(nested sections, imports, comments, resolving d references and " +
    "{text(...)} embeddings behind multi-byte prose), for EVERY file and " +
    "EVERY offset 0…byte length `at`'s resolution — section " +
    "identity, construct range, containing occurrence — equals the " +
    "resolution computed from that file's entry of one bare `view` answer " +
    "alone (no entry — the masked file — resolving to exactly the " +
    "unavailability marker), and the workspace-wide bare `occurrences` " +
    "enumeration equals the view-collected occurrence records sorted by " +
    "file path bytes, range start, range end — total, duplicate-free " +
    "(identical spans never occur), and byte-identical across repeated " +
    "runs (SPEC 11.5, 11.4, 11.3, 11.2, 5.7, 12.0; TEST-SPEC §16 P-12)",
  // Wall-clock hang guard only (H-10): the per-trial at sweep is exhaustive
  // over every staged byte offset, so trials are few (3 per seed × 3 fixed
  // seeds, E-5) and small by generator construction, and the shrink budget
  // is sized against whole-trial re-execution cost.
  timeoutMs: 600_000,
  run: async (product) => {
    await checkProperty(
      "P-12 at ≡ view; occurrence order",
      genP12Trial,
      async (trial) => {
        await runP12Trial(product, trial);
      },
      {
        runs: 3,
        maxShrinkExecutions: 25,
        render: renderP12Trial,
        mdxSources: stagedP12Sources,
      },
    );
  },
});

/** TEST-SPEC §16 P-12 (PROP-10). */
export const section16P12Tests: readonly ProductTestEntry[] = [P_12];
