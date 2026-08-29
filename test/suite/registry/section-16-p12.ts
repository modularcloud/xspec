// TEST-SPEC §16 P-12 (at ≡ view; occurrence order) — PROP-10.
//
// One registered product-facing property test (C-2 "one code path"): a
// seeded, reproducible generator (helpers/property.ts, H-10; fixed seed set
// in CI, E-5) produces small random spec-only workspaces — 1–3 `.mdx` spec
// sources with nested sections, prose (multi-byte spellings included, so
// byte offsets diverge from code-point and UTF-16 counts, SPEC 1.7), MDX
// comments, blank lines, an optional import of the first file, `d`
// references, and `{text(...)}` embeddings, in resolving, maybe-resolving,
// and never-resolving spellings — and asserts, per trial, exactly the two
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
// Input space. Workspaces are valid-leaning but not validity-bound: the
// configuration is constant and valid by construction (a configuration
// error is a 14.14 exit-2 outcome preceding every answer, outside P-12's
// subject), file paths are fixed valid spellings, and every staged argument
// is well-formed with offsets in 0…byte length — so no invocation stages a
// usage error and every answer exits 0 or 1 (SPEC 11.2: these surfaces
// answer per file whatever findings the workspace carries; argument checks
// alone exit 2). Reference spellings may resolve (`"t"` — every file's
// constant anchor section; `M0.t` through the drawn import), maybe-resolve
// (`"s1"`), or never resolve (`"zz"`), so answers are exercised on both
// exit sides with and without findings. One optional per-trial twist
// appends imperfection to one file:
//
//   * `duplicate-id` — two appended sections both spelling `dd`, the first
//     carrying `d={"t"}`: both bearers' identities are undefined (11.2,
//     uniqueness), so the view reports their `identity` as the
//     unavailability marker and `at` must agree at every offset inside
//     them; the `d` reference still resolves and records an occurrence
//     whose source datum is explicitly unavailable as one datum (5.7,
//     11.2) — carried identically by the view, the enumeration, and the
//     containing-occurrence side of `at`.
//   * `break-parse` — an appended unclosed section tag: the file is
//     unparseable (14.20), contributes no view entry, and `at` must report
//     the unavailability marker at every offset (11.2, 11.5).
//
// Rendering discipline (parseable by construction outside `break-parse`):
// section tags, comments, and prose are own-line constructs joined by
// single newlines (the T11.5-1/P-4 style — MDX flow JSX interrupts a
// paragraph, so glued tags stay flow constructs), while the import is
// followed by a mandatory blank line (an MDX ESM block extends to the next
// blank line and cannot interrupt a paragraph — the FP-094 hazard);
// embeddings are glued mid-line behind non-empty prose; prose draws from a
// fixed MDX-safe pool (alphanumeric line starts; no `<`, `>`, `{`, `}`,
// backtick, `~`, `&`, `\`), with multi-byte entries (é, à, —) shifting
// every later offset (SPEC 1.7).
//
// Cost shape: the at ≡ view clause is exhaustive per trial (sum of file
// byte lengths + one EOF caret per file `at` invocations — "reachability is
// total by construction", CERTIFICATIONS.md), so the generator keeps files
// small and the trial count low (`runs: 3` × the 3 default seeds = 9
// CI-pinned trials), with the shrink budget sized against whole-trial
// re-execution cost. An implementation-time dry-run over the committed
// default seeds at these 9 trials verified: every twist kind occurs (none
// ×4, duplicate-id ×3, break-parse ×2), multi-file workspaces, imports,
// embeddings, `d` props, external references, and multi-byte prose all
// occur, ~1470 `at` invocations total across the set, and every staged
// source parses under remark-mdx exactly except the break-parse files,
// which fail to parse (E-5: the fixed seeds exercise the full surface
// deterministically). The `view` invocation runs first, so a product
// without the §11 surfaces (the stub, S-7) fails immediately and cheaply,
// and shrinking stays fast in the red phase (H-8).
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
import type { Choices, Gen } from "../../helpers/property.js";
import { checkProperty } from "../../helpers/property.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import type { ProductBinding, RunResult } from "../../helpers/subprocess.js";
import { runProduct } from "../../helpers/subprocess.js";
import type { TestWorkspace as Workspace } from "../../helpers/workspace.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import { SPECS_ONLY_CONFIG } from "./section-11.2.js";
import type { ResolutionData } from "./section-11.5.js";
import { resolveAtFromView } from "./section-11.5.js";
import { assertSameJson } from "./support.js";

const UNAVAILABLE = { unavailable: true } as const;

// ---------------------------------------------------------------------------
// Generation: file pool, content pools, per-file builder, twists.

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
 * Embedding argument spellings (SPEC 2.3, 2.4 static forms). `"t"` always
 * resolves (the constant anchor section below); `'t'` is a spelling variant
 * of the same target; `"s1"` resolves exactly when the file drew a
 * top-level extra section (maybe); `"zz"` never resolves — an unresolved
 * spelling records no occurrence and reports its own finding (5.7, 11.2).
 * `M0.t` (external, resolving) joins the menu where the import was drawn.
 */
function embedArgumentMenu(hasImport: boolean): readonly string[] {
  const local = ['"t"', "'t'", '"s1"', '"zz"'] as const;
  return hasImport ? [...local, "M0.t"] : local;
}

/**
 * Opening-tag `d` prop spellings (SPEC 2.2), `""` = prop omitted. Entries
 * of a `d` array record occurrences separately (5.7); the mixed arrays
 * exercise resolving and non-resolving entries side by side.
 */
function dPropMenu(
  hasImport: boolean,
): ReadonlyArray<readonly [number, string]> {
  const entries: (readonly [number, string])[] = [
    [5, ""],
    [2, ' d={"t"}'],
    [1, ' d={["t", "s1"]}'],
    [1, ' d={["t", "zz"]}'],
  ];
  if (hasImport) entries.push([1, " d={M0.t}"]);
  return entries;
}

/** One generated workspace and the twist applied to it. */
export interface P12Trial {
  /** Staged content per workspace-relative path, in FILE_POOL order. */
  readonly files: ReadonlyArray<readonly [string, string]>;
  /** Human-readable twist description (`"none"` when none applied). */
  readonly twist: string;
}

/**
 * One file's lines (joined by single newlines; module header discipline).
 * The constant anchor section `t` opens every file, so the resolving
 * reference spellings above always have a target, in-file and cross-file.
 */
function genFileLines(choices: Choices, hasImport: boolean): string[] {
  const lines: string[] = [];
  if (hasImport) {
    lines.push(IMPORT_LINE);
    lines.push(""); // mandatory blank line: the ESM block must end (FP-094)
  }
  lines.push('<S id="t">');
  lines.push(choices.pick(PROSE_POOL));
  lines.push("</S>");

  let seg = 1;
  const nextSeg = (): string => {
    const name = `s${String(seg)}`;
    seg += 1;
    return name;
  };
  const emitProse = (): void => {
    let line: string = choices.pick(PROSE_POOL);
    if (choices.boolean(0.4)) {
      line += `{text(${choices.pick(embedArgumentMenu(hasImport))})}`;
      if (choices.boolean(0.5)) line += choices.pick(TAIL_POOL);
    }
    lines.push(line);
  };
  const emitSection = (parentDotted: string, depth: number): void => {
    const segName = nextSeg();
    const dotted = parentDotted === "" ? segName : `${parentDotted}.${segName}`;
    lines.push(
      `<S id="${dotted}"${choices.weightedPick(dPropMenu(hasImport))}>`,
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
        lines.push(`{/* ${choices.pick(COMMENT_POOL)} */}`);
      } else emitSection(dotted, depth + 1);
    }
    lines.push("</S>");
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
      lines.push(`{/* ${choices.pick(COMMENT_POOL)} */}`);
    } else emitSection("", 0);
  }
  return lines;
}

/**
 * The duplicate-id twist appendix (module header): both bearers of `dd`
 * undefined (11.2), the first's resolving `d={"t"}` reference recording an
 * occurrence whose source datum is explicitly unavailable (5.7).
 */
const DUPLICATE_ID_APPENDIX =
  '<S id="dd" d={"t"}>\nd un.\n</S>\n<S id="dd">\nd deux.\n</S>\n';

/** The break-parse twist appendix: an unclosed flow tag — 14.20, masked. */
const BREAK_PARSE_APPENDIX = '<S id="ka">\n';

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
  const twistKind = choices.weightedPick<
    "none" | "duplicate-id" | "break-parse"
  >([
    [4, "none"],
    [3, "duplicate-id"],
    [2, "break-parse"],
  ]);
  if (twistKind === "none") return { files, twist: "none" };
  const target = choices.intInclusive(0, fileCount - 1);
  const [path, content] = files[target];
  const appendix =
    twistKind === "duplicate-id" ? DUPLICATE_ID_APPENDIX : BREAK_PARSE_APPENDIX;
  files[target] = [path, content + appendix];
  return { files, twist: `${twistKind} on ${path}` };
};

/** Counterexample rendering: the twist and the staged sources, in full. */
export function renderP12Trial(trial: P12Trial): string {
  return JSON.stringify({
    twist: trial.twist,
    files: Object.fromEntries(trial.files),
  });
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

/** The P-12 property body for one generated trial (module header). */
async function runP12Trial(
  product: ProductBinding,
  trial: P12Trial,
): Promise<void> {
  const workspace = await TestWorkspace.create({
    files: {
      "xspec.config.ts": SPECS_ONLY_CONFIG,
      ...Object.fromEntries(trial.files),
    },
  });
  try {
    // --- the derivability ground: one bare `view` over the whole domain ----
    const viewContext = `P-12 \`xspec view\` (twist: ${trial.twist})`;
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
    const occContext = `P-12 \`xspec occurrences\` (twist: ${trial.twist})`;
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
        const context = `P-12 \`at ${path} ${String(offset)}\` (twist: ${trial.twist})`;
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
    "property: on random spec-only workspaces (nested sections, imports, " +
    "comments, d references and {text(...)} embeddings behind multi-byte " +
    "prose; optionally one duplicate-id file or one unparseable file), for " +
    "EVERY file and EVERY offset 0…byte length `at`'s resolution — section " +
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
      { runs: 3, maxShrinkExecutions: 25, render: renderP12Trial },
    );
  },
});

/** TEST-SPEC §16 P-12 (PROP-10). */
export const section16P12Tests: readonly ProductTestEntry[] = [P_12];
