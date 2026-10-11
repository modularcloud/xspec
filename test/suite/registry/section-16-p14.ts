// TEST-SPEC §16 P-14 (sources vanishing under reads) — PROP-12.
//
// One registered product-facing property test (C-2 "one code path") over
// SPEC 14.25's absence rule: a discovered source found absent when its
// content is read — removed or relocated since discovery (13.5) — reads as
// undiscovered, as though discovery had not yielded it, never as a read the
// environment refuses. Seeded, reproducible generators (helpers/property.ts,
// H-10; the fixed seed set in CI, E-5) draw random valid workspaces in two
// series, each its own `checkProperty` run, so both run at every seed:
//
//   * the spec-source series: one to three spec sources under `specs/`
//     (SPEC_NAMES) and the flipped spec source F (FLIPPED_NAMES, its name
//     sorting before, between, or after theirs; directly under `specs/` or
//     in `specs/sub/`), under the one spec group `specs/**/*.mdx`
//     (P14_SPEC_CONFIG). Each file imports only files drawn before it, and
//     F, drawn last, is imported by none (SPEC 2.1: an import cycle is
//     invalid), so no other file references F; F holds at least one
//     reference occurrence, so its presence changes `occurrences`' answer
//     as well as `ids`' and `query nodes`';
//   * the code-source series: one to three spec sources and the flipped
//     code source F under `src/` or `src/lib/` (`src/**/*.ts`, the code
//     group of P14_CODE_CONFIG), importing spec modules and holding at
//     least one marker on a section of a spec source (SPEC 4.5), at the
//     module's top level or inside function units, so that its presence
//     changes `occurrences`' answer; beside it, sometimes, a second code
//     source `src/Ot.ts` holding markers of its own — no code source imports
//     another, so no other file imports F.
//
// Validity by construction (TEST-SPEC §16 preamble, S-9): each spec source's
// first top-level section is the anchor `t` (prose alone, no reference, no
// child); its other sections (`u`, sometimes `v`, each sometimes with the
// children `.k` and `.m`) carry `d` references (one, or an array) and
// `{text(…)}` embeddings whose targets are the same file's anchor (the local
// form `"t"`) or a section of an imported, earlier file (the external chain
// form `M<j>.<id>`, SPEC 2.2–2.4) — so every reference resolves, none names
// an ancestor of its site (5.3), and the contains/depends/embeds graph is
// acyclic (cross-file edges point to earlier files, same-file ones to the
// referenceless anchor); section IDs are structural (1.3) and drawn from a
// fixed alphanumeric pool (1.4); prose opens no construct. The rendering
// follows P-13's line templates (section-16-p13.ts), every composed form
// spelled in P14_FORM_VECTORS and P14_TS_FORM_VECTORS for S-9's self-tests
// (test/self/s9-fixture-well-formedness.test.ts,
// s9-typescript-well-formedness.test.ts), and every draw's sources judged
// before the body sees them (`drawSources`). Each draw also names the
// section the property's `rename` arm renames — a top-level section other
// than the anchor in a spec source other than F — and F, in either series,
// references no identity in its subtree, so that `rename` rewrites no
// flipped path (TEST-SPEC P-14).
//
// Each trial (`runP14Trial`): the workspace is created fresh and built
// quiescently with F present (`build`, exit 0 — a `build` failure on a valid
// draw is a product failure, reported with its seed), and that built state
// is kept, a byte copy outside the root (`keepBuiltState`), for the commands
// driven alone below. First the reads' arm. The refreshing reads
// (SPEC 13.3) of the series' menu (`readMenu`) — `ids --json`, `query
// nodes`, `occurrences`, and `view` of another spec source, and, in the
// spec-source series, `view` of F and `at` of F at a within-file offset,
// each naming F as its `<file>` operand — are each run quiescently with F
// present and then with F absent, parked one atomic rename away: removed
// from the workspace (renamed into the workspace's temporary directory,
// outside its root) or relocated outside every group's globs (into
// `parked/` under the root), the trial's park mode. Those quiescent runs
// are the references, and their premises are asserted: with F present
// every read exits 0 (a valid workspace's finding-free answers, SPEC 11.2,
// 12.0); with F absent a read naming it answers the unknown-file usage
// error — exit 2, the 12.7 error document's `code` `null` (12.0; 11.4,
// 11.5) — never condition 20 for it at offset 0, and every other read exits
// 0; and F's presence shows: the two answers of each read F's presence
// changes differ (`ids`, `query nodes`, `occurrences`, and the two reads
// naming F in the spec-source series; `occurrences` in the code-source
// series), so no product passes vacuously by never discovering F.
//
// Then, while P14_WORKERS concurrent workers each run P14_ROUNDS rounds of
// the menu back to back (worker w starting at menu entry rotation + w), the
// flipper (`SourceFlipper`) parks and restores F every drawn period
// (FLIP_PERIODS_MS, choreography only, never an assertion input: H-10),
// each change one atomic rename, so no partial file ever stands at a
// discovered path, and restores F once every read has settled. Each read's
// exit code and standard output must equal those of the quiescent run with
// F present or of the one with F absent — never a `read-failure` for the
// vanished file, never condition 20 for it at offset 0, never a crash
// (TEST-SPEC P-14). So P-14 fails a product that takes a source vanished
// between discovery and its content read for an unreadable one, and one
// that, its operand check passed, reads the named file by its path and
// takes the file's absence for a refused read. Such a failure depends on a
// flip landing in that window, so it may show on some runs only — the
// product's failure, never flakiness (E-5): every assertion holds for a
// conforming product under every timing.
//
// Then the commands driven alone (`soloArm`; TEST-SPEC P-14: "`build` and
// `check` are driven likewise", and "The mutating commands are driven
// likewise, as T13.5-12 defers to this property"), in this order: `build`,
// `check`, the drawn `rename` — `rename <file> <id> w`, a top-level
// section of a spec source other than F, so a section in another file —
// and `review create --strategy audit --name n` (`soloCommands`), each
// under `--json`, so a refusal's error document is standard-output content
// (SPEC 12.0). Every run of them is alone — no other xspec command beside
// it — on a fresh byte copy of the kept built state, F present: twice
// quiescently, with F present and with F parked as the trial parks it,
// the references; then P14_SOLO_RUNS times while the flipper flips F every
// drawn period, F restored once the run has ended. A run's outcome is its
// exit code and standard output and — for all but `check`, which writes
// nothing (SPEC 12.2, 13.3) — the files it leaves: every file of the copy
// but the paths the harness flips (F's discovered path and, relocated,
// its park) and the lock path (H-6), so `build`'s derived files and graph
// data (every other file the copy's own, which `build` never writes: SPEC
// 12.1, 13.4) and the mutating commands' sources, journal, session,
// derived files, and graph data. The references' premises: with F present
// each exits 0 (on the valid workspace `build` just generated, `check`
// finds nothing; SPEC 12.1, 12.2, 6.4, 10.7); with F absent `check` exits
// 1 — the graph data built with F present no longer matches the sources,
// staleness (12.2, 13.3, 14.10) — and the others 0; and F's presence
// shows: the two references differ (F changes `build`'s graph data and the
// graph data the `rename` regenerates, TEST-SPEC P-14; `review create`
// first refreshes the stale graph data, 13.3), so no product passes
// vacuously. Each run while F flips must leave, together, one reference's
// outcome — never a `read-failure` for the vanished file, never condition
// 20 for it, never a crash (TEST-SPEC P-14; SPEC 14.25): a mutating
// command's content reads follow its rediscovery under exclusivity (13.5),
// so F may be present at one discovery and absent at the other, and either
// way the run reads as one quiescent run does. So P-14 fails a product
// whose `build`, `check`, `rename`, or `review create` takes a source
// vanished between its discovery and its content read for an unreadable
// one, or leaves state mixing the two references' — derived files of one,
// graph data of the other — again on the runs whose flips meet the window
// (E-5).
//
// A falsified trial is shrunk within P14_MAX_SHRINK_EXECUTIONS whole
// trials, a candidate whose re-run does not meet the window again being no
// counterexample (P-10's budget rule); a run's hang declines shrinking
// (each re-observation would cost a full hang guard). The bodies count,
// per trial, the reads that met F present and absent (those whose two
// references differ) and, per command driven alone, the runs that met
// each reference, for scratch probes (`P14Observation`, `P14Arms`
// selecting the arms run); the registered body observes nothing and runs
// every arm.
//
// Uncertified (CERTIFICATIONS.md, P-14's exclusion note): no conformer here
// serves `at` or code groups whose markers change `occurrences`' answer.

import { Buffer } from "node:buffer";
import { mkdir, rename } from "node:fs/promises";
import * as path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { decodeErrorDocument } from "../../helpers/adapters/index.js";
import {
  bytesEqual,
  describeByteDifference,
  fail,
  HarnessAssertionError,
} from "../../helpers/assertions.js";
import { EXCLUDE_LOCK_PATH, isLockPathBytes } from "../../helpers/lock-path.js";
import type { Choices, DrawSource, Gen } from "../../helpers/property.js";
import { checkProperty } from "../../helpers/property.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { diffSnapshots, snapshotDirectory } from "../../helpers/snapshot.js";
import type {
  DirectorySnapshot,
  SnapshotChange,
} from "../../helpers/snapshot.js";
import { stagedTs } from "../../helpers/staged-ts.js";
import type { ProductBinding, RunResult } from "../../helpers/subprocess.js";
import { summarizeResult } from "../../helpers/subprocess.js";
import {
  mdxPathsOf,
  TestWorkspace,
  tsPathsOf,
} from "../../helpers/workspace.js";
import { copyTreeBytes, runBounded } from "./section-13.5.js";

// ---------------------------------------------------------------------------
// Configurations (staged-source records: every trial stages its
// configuration afresh, from the second trial on after the body's first
// product invocation — S-9's timing clause; test/self/s9-staged-sources
// .test.ts judges them before any product exists)

/** The spec-source series' configuration: one spec group. */
export const P14_SPEC_CONFIG = stagedTs(
  "P-14 xspec.config.ts — the spec-source series: one spec group, specs/**/*.mdx",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
);

/** The code-source series' configuration: one spec group, one code group. */
export const P14_CODE_CONFIG = stagedTs(
  "P-14 xspec.config.ts — the code-source series: one spec group, specs/**/*.mdx, and one code group, src/**/*.ts",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: {
    app: ["src/**/*.ts"]
  }
})
`,
);

// ---------------------------------------------------------------------------
// Fixed pools and knobs

/** The spec sources other than F, by index: `specs/<name>.mdx`. */
const SPEC_NAMES = ["Ka", "Mo", "Se"] as const;
/** F's name: sorting before, between, or after every SPEC_NAMES entry. */
const FLIPPED_NAMES = ["Ab", "Lu", "Zo"] as const;
/** The second code source of the code-source series. */
const OTHER_CODE_PATH = "src/Ot.ts";
/** The anchor: every spec source's first top-level section, referenceless. */
const ANCHOR = "t";
/** Top-level sections after the anchor: `u` always, `v` sometimes. */
const TOP_SEGMENTS = ["u", "v"] as const;
/** Child segments under a top-level section other than the anchor. */
const CHILD_SEGMENTS = ["k", "m"] as const;
/** Function units of a code source (distinct names: no `@N`, SPEC 4.6). */
const UNIT_NAMES = ["f", "g"] as const;
/** The fresh ID the `rename` arm gives its target (no pool spells it). */
const RENAMED_TO = "w";
/** Where the relocated park mode puts F: under the root, outside every glob. */
const RELOCATION_DIR = "parked";

/**
 * The flipper's periods, in ms (E-5's spread): F stands at its discovered
 * path, or is parked, for one period at a time. Choreography only (H-10).
 */
export const FLIP_PERIODS_MS = [2, 5, 10, 20, 40] as const;
/** Concurrent workers in a trial's concurrent phase. */
export const P14_WORKERS = 3;
/** Rounds of the read menu each worker runs, back to back. */
export const P14_ROUNDS = 2;
/** Trials per fixed seed, per series (E-5). */
export const P14_RUNS_PER_SEED = 2;
/**
 * Runs of each command driven alone while F flips, per trial (E-5's fixed
 * count; the drawn period its spread).
 */
export const P14_SOLO_RUNS = 3;
/** Shrink budget, in trials (helpers/property.ts): each costs a whole trial. */
const P14_MAX_SHRINK_EXECUTIONS = 4;
/** Each run's hang guard (H-8, H-10): far past any run under this load. */
const RUN_TIMEOUT_MS = 60_000;
/** The `review create` arm's session name (TEST-SPEC P-14: `--name n`). */
const SESSION_NAME = "n";

// ---------------------------------------------------------------------------
// The draw model

/** P-14's two series (module header). */
export type P14Series = "spec" | "code";

/**
 * A reference target: the referencing file's own anchor (the local form
 * `"t"`), or a section of an imported spec source (the chain `M<j>.<id>`).
 */
export type P14Target =
  | { readonly kind: "local" }
  | { readonly kind: "external"; readonly file: number; readonly id: string };

/** A generated section: its full ID, references, embeddings, and children. */
export interface P14Section {
  readonly id: string;
  /** The `d` prop's targets: none (no prop), one, or an array of two. */
  readonly refs: readonly P14Target[];
  /** Each a `{text(…)}` embedding in the section's body. */
  readonly embeds: readonly P14Target[];
  readonly children: readonly P14Section[];
}

/** A generated spec source. */
export interface P14SpecFile {
  /** Workspace-relative path. */
  readonly path: string;
  /** Spec-file indices it imports, each bound as `M<index>`. */
  readonly imports: readonly number[];
  /** Top-level sections, the anchor first. */
  readonly sections: readonly P14Section[];
}

/** A marker's target: a section of an imported spec source. */
export interface P14MarkerTarget {
  readonly file: number;
  readonly id: string;
}

/** A generated code source (the code-source series). */
export interface P14CodeFile {
  readonly path: string;
  /** Spec-file indices it imports, each bound as `M<index>`. */
  readonly imports: readonly number[];
  /** Markers at the module's top level. */
  readonly topLevel: readonly P14MarkerTarget[];
  /** Function units, each holding at least one marker. */
  readonly units: readonly {
    readonly name: string;
    readonly markers: readonly P14MarkerTarget[];
  }[];
}

/** How F is parked: out of the workspace, or outside every group's globs. */
export type P14ParkMode = "removed" | "relocated";

/** One P-14 draw (module header). */
export interface P14Draw {
  readonly series: P14Series;
  /** Every spec source; in the spec-source series F is the last. */
  readonly specFiles: readonly P14SpecFile[];
  /** Every code source; in the code-source series F is the first. */
  readonly codeFiles: readonly P14CodeFile[];
  /** F's workspace-relative path. */
  readonly flipped: string;
  /**
   * The `rename` arm's operation: a top-level section other than the anchor
   * in a spec source other than F, whose subtree F never references.
   */
  readonly rename: {
    readonly file: string;
    readonly id: string;
    readonly to: string;
  };
  readonly park: P14ParkMode;
  /** The spec source `view` names as "another file" (never F). */
  readonly viewOther: string;
  /** The spec-source series' `at` offset, within F; `null` in the other. */
  readonly atOffset: number | null;
  readonly flipPeriodMs: number;
  /** The menu entry worker 0 starts at. */
  readonly rotation: number;
}

// ---------------------------------------------------------------------------
// The generators

interface Skeleton {
  readonly id: string;
  readonly children: readonly string[];
}

/** A spec source's section skeleton: the anchor, `u`, sometimes `v`. */
function genSkeleton(choices: Choices): Skeleton[] {
  const tops: string[] = [TOP_SEGMENTS[0]];
  if (choices.boolean(0.5)) tops.push(TOP_SEGMENTS[1]);
  const skeleton: Skeleton[] = [{ id: ANCHOR, children: [] }];
  for (const top of tops) {
    const children: string[] = [];
    for (const segment of CHILD_SEGMENTS) {
      if (choices.boolean(0.35)) children.push(`${top}.${segment}`);
    }
    skeleton.push({ id: top, children });
  }
  return skeleton;
}

/** Every section ID a skeleton holds, in document order. */
function idsOf(skeleton: readonly Skeleton[]): string[] {
  return skeleton.flatMap((top) => [top.id, ...top.children]);
}

/** Whether `id` lies in the subtree of `root` (itself included). */
function inSubtree(id: string, root: string): boolean {
  return id === root || id.startsWith(`${root}.`);
}

/** Draw up to `max` distinct targets, the first `min` of them required. */
function genTargets(
  choices: Choices,
  externals: readonly P14MarkerTarget[],
  min: number,
  max: number,
): P14Target[] {
  const count = choices.intInclusive(min, max);
  const drawn: P14Target[] = [];
  for (let n = 0; n < count; n += 1) {
    const target: P14Target =
      externals.length === 0 || !choices.boolean(0.6)
        ? { kind: "local" }
        : { kind: "external", ...choices.pick(externals) };
    if (!drawn.some((seen) => sameTarget(seen, target))) drawn.push(target);
  }
  return drawn;
}

function sameTarget(a: P14Target, b: P14Target): boolean {
  if (a.kind === "local" || b.kind === "local") return a.kind === b.kind;
  return a.file === b.file && a.id === b.id;
}

/** Draw the subset of `candidates` a file imports, each kept or not. */
function genImports(choices: Choices, candidates: readonly number[]): number[] {
  return candidates.filter(() => choices.boolean(0.6));
}

/**
 * One spec source's sections over its skeleton: every section but the
 * anchor draws references and embeddings among the local anchor and the
 * imported files' sections (`externals`); `mustReference` makes the first
 * one after the anchor hold at least one `d` reference.
 */
function genSections(
  choices: Choices,
  skeleton: readonly Skeleton[],
  externals: readonly P14MarkerTarget[],
  mustReference: boolean,
): P14Section[] {
  const section = (id: string, children: P14Section[], min: number) => ({
    id,
    refs: genTargets(choices, externals, min, 2),
    embeds: genTargets(choices, externals, 0, 1),
    children,
  });
  return skeleton.map((top, index) => {
    if (top.id === ANCHOR) {
      return { id: ANCHOR, refs: [], embeds: [], children: [] };
    }
    const children = top.children.map((child) => section(child, [], 0));
    return section(top.id, children, mustReference && index === 1 ? 1 : 0);
  });
}

/** The external targets of `imports`: every section of each imported file. */
function externalsOf(
  imports: readonly number[],
  skeletons: readonly (readonly Skeleton[])[],
): P14MarkerTarget[] {
  return imports.flatMap((file) =>
    idsOf(skeletons[file] ?? []).map((id) => ({ file, id })),
  );
}

/** `[0, 1, …, count - 1]`. */
function indices(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index);
}

/**
 * The spec sources other than F, drawn alike in both series: their count,
 * skeletons, and paths, then the `rename` target among them, then each
 * one's imports (earlier files alone) and sections.
 */
interface OtherSpecSources {
  readonly skeletons: Skeleton[][];
  readonly files: P14SpecFile[];
  readonly rename: { readonly file: number; readonly id: string };
}

function genOtherSpecSources(choices: Choices): OtherSpecSources {
  const count = choices.intInclusive(1, SPEC_NAMES.length);
  const skeletons: Skeleton[][] = [];
  for (let i = 0; i < count; i += 1) skeletons.push(genSkeleton(choices));
  const renameFile = choices.intInclusive(0, count - 1);
  const renameTops = (skeletons[renameFile] ?? [])
    .map((top) => top.id)
    .filter((id) => id !== ANCHOR);
  const rename = { file: renameFile, id: choices.pick(renameTops) };
  const files: P14SpecFile[] = [];
  for (let i = 0; i < count; i += 1) {
    const imports = genImports(choices, indices(i));
    files.push({
      path: `specs/${SPEC_NAMES[i] ?? "X"}.mdx`,
      imports,
      sections: genSections(
        choices,
        skeletons[i] ?? [],
        externalsOf(imports, skeletons),
        false,
      ),
    });
  }
  return { skeletons, files, rename };
}

/** F's targets: never in the `rename` target's subtree (module header). */
function outsideRename(
  targets: readonly P14MarkerTarget[],
  rename: { readonly file: number; readonly id: string },
): P14MarkerTarget[] {
  return targets.filter(
    (target) => target.file !== rename.file || !inSubtree(target.id, rename.id),
  );
}

/** The trial's choreography and park mode, drawn last in both series. */
function genSchedule(
  choices: Choices,
  menuLength: number,
): Pick<P14Draw, "park" | "flipPeriodMs" | "rotation"> {
  return {
    park: choices.pick<P14ParkMode>(["removed", "relocated"]),
    flipPeriodMs: choices.pick(FLIP_PERIODS_MS),
    rotation: choices.intInclusive(0, menuLength - 1),
  };
}

/** The spec-source series' menu length (`readMenu`). */
const SPEC_MENU_LENGTH = 6;
/** The code-source series' menu length (`readMenu`). */
const CODE_MENU_LENGTH = 4;

/** The spec-source series' generator (module header). */
export const genP14SpecDraw: Gen<P14Draw> = (choices) => {
  const others = genOtherSpecSources(choices);
  const count = others.files.length;
  const name = choices.pick(FLIPPED_NAMES);
  const flipped = choices.boolean(0.4)
    ? `specs/sub/${name}.mdx`
    : `specs/${name}.mdx`;
  const skeleton = genSkeleton(choices);
  const imports = genImports(choices, indices(count));
  const externals = outsideRename(
    externalsOf(imports, others.skeletons),
    others.rename,
  );
  const specFiles: P14SpecFile[] = [
    ...others.files,
    {
      path: flipped,
      imports,
      sections: genSections(choices, skeleton, externals, true),
    },
  ];
  const flippedText = renderSpecFile(
    specFiles[count] as P14SpecFile,
    specFiles,
  );
  const atOffset = choices.intInclusive(0, byteLength(flippedText) - 1);
  const viewOther = choices.pick(others.files).path;
  return {
    series: "spec",
    specFiles,
    codeFiles: [],
    flipped,
    rename: renameOf(others),
    viewOther,
    atOffset,
    ...genSchedule(choices, SPEC_MENU_LENGTH),
  };
};

/** The code-source series' generator (module header). */
export const genP14CodeDraw: Gen<P14Draw> = (choices) => {
  const others = genOtherSpecSources(choices);
  const count = others.files.length;
  const name = choices.pick(FLIPPED_NAMES);
  const flipped = choices.boolean(0.4)
    ? `src/lib/${name}.ts`
    : `src/${name}.ts`;
  const codeFiles: P14CodeFile[] = [
    genCodeFile(choices, flipped, count, others.skeletons, others.rename),
  ];
  if (choices.boolean(0.5)) {
    codeFiles.push(
      genCodeFile(choices, OTHER_CODE_PATH, count, others.skeletons, null),
    );
  }
  const viewOther = choices.pick(others.files).path;
  return {
    series: "code",
    specFiles: others.files,
    codeFiles,
    flipped,
    rename: renameOf(others),
    viewOther,
    atOffset: null,
    ...genSchedule(choices, CODE_MENU_LENGTH),
  };
};

function renameOf(others: OtherSpecSources): P14Draw["rename"] {
  const file = others.files[others.rename.file];
  if (file === undefined) {
    throw new Error(
      "P-14 generator defect: the rename target's file is missing",
    );
  }
  return { file: file.path, id: others.rename.id, to: RENAMED_TO };
}

/**
 * A code source: imports of one or more spec sources, and markers on their
 * sections — at the top level, in function units, or both, at least one in
 * all — never in `avoid`'s subtree (F's: the `rename` target's).
 */
function genCodeFile(
  choices: Choices,
  filePath: string,
  specCount: number,
  skeletons: readonly (readonly Skeleton[])[],
  avoid: { readonly file: number; readonly id: string } | null,
): P14CodeFile {
  let imports = genImports(choices, indices(specCount));
  if (imports.length === 0) imports = [choices.intInclusive(0, specCount - 1)];
  const all = externalsOf(imports, skeletons);
  const targets = avoid === null ? all : outsideRename(all, avoid);
  const markers = (min: number, max: number): P14MarkerTarget[] => {
    const count = choices.intInclusive(min, max);
    return indices(count).map(() => choices.pick(targets));
  };
  const topLevel = markers(0, 2);
  const units: { name: string; markers: P14MarkerTarget[] }[] = [];
  for (const unitName of UNIT_NAMES) {
    if (choices.boolean(0.5)) {
      units.push({ name: unitName, markers: markers(1, 2) });
    }
  }
  if (topLevel.length === 0 && units.length === 0) {
    topLevel.push(choices.pick(targets));
  }
  return { path: filePath, imports, topLevel, units };
}

// ---------------------------------------------------------------------------
// Rendering (P-13's line templates; every form in the S-9 vectors below)

/** A UTF-8 text's byte length. */
function byteLength(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

/** The specifier designating `specPath`'s module from `fromPath` (SPEC 2.1). */
function specifierOf(fromPath: string, specPath: string): string {
  const relative = path.posix.relative(
    path.posix.dirname(fromPath),
    `${specPath.slice(0, -".mdx".length)}.xspec`,
  );
  return relative.startsWith("../") ? relative : `./${relative}`;
}

/** A reference's spelling: the local string form or the external chain. */
function spell(target: P14Target): string {
  return target.kind === "local"
    ? JSON.stringify(ANCHOR)
    : `M${String(target.file)}.${target.id}`;
}

function renderSection(section: P14Section): string[] {
  const attributes = [`id="${section.id}"`];
  if (section.refs.length === 1) {
    attributes.push(`d={${spell(section.refs[0] as P14Target)}}`);
  } else if (section.refs.length > 1) {
    attributes.push(`d={[${section.refs.map(spell).join(", ")}]}`);
  }
  const lines = [`<S ${attributes.join(" ")}>`, `Text of ${section.id}.`];
  for (const target of section.embeds) {
    lines.push("", `{text(${spell(target)})}`);
  }
  for (const child of section.children) {
    lines.push("", ...renderSection(child));
  }
  lines.push("</S>");
  return lines;
}

/** One spec source: one ESM block of its imports, then its sections. */
export function renderSpecFile(
  file: P14SpecFile,
  specFiles: readonly P14SpecFile[],
): string {
  const blocks: string[][] = [];
  if (file.imports.length > 0) {
    blocks.push(
      file.imports.map(
        (index) =>
          `import M${String(index)} from "${specifierOf(file.path, specPathOf(specFiles, index))}"`,
      ),
    );
  }
  for (const section of file.sections) blocks.push(renderSection(section));
  return `${blocks.map((block) => block.join("\n")).join("\n\n")}\n`;
}

function specPathOf(specFiles: readonly P14SpecFile[], index: number): string {
  const file = specFiles[index];
  if (file === undefined) {
    throw new Error(
      `P-14 model defect: no spec source at index ${String(index)}`,
    );
  }
  return file.path;
}

function chainOf(target: P14MarkerTarget): string {
  return `M${String(target.file)}.${target.id}`;
}

/** One code source: its imports, top-level markers, then function units. */
export function renderCodeFile(
  file: P14CodeFile,
  specFiles: readonly P14SpecFile[],
): string {
  const lines = file.imports.map(
    (index) =>
      `import M${String(index)} from "${specifierOf(file.path, specPathOf(specFiles, index))}";`,
  );
  lines.push("");
  for (const marker of file.topLevel) lines.push(`${chainOf(marker)};`);
  for (const unit of file.units) {
    lines.push("", `function ${unit.name}() {`);
    for (const marker of unit.markers) lines.push(`  ${chainOf(marker)};`);
    lines.push("}");
  }
  return `${lines.join("\n")}\n`;
}

/** Every source a draw composes — its spec and code sources, path → text. */
export function renderP14Sources(draw: P14Draw): Record<string, string> {
  const files: Record<string, string> = {};
  for (const file of draw.specFiles) {
    files[file.path] = renderSpecFile(file, draw.specFiles);
  }
  for (const file of draw.codeFiles) {
    files[file.path] = renderCodeFile(file, draw.specFiles);
  }
  return files;
}

/** S-9's per-draw check (`drawSources`): every source the draw composes. */
function stagedP14Sources(draw: P14Draw): DrawSource[] {
  return Object.entries(renderP14Sources(draw));
}

/** Counterexample rendering: the draw's schedule and its sources in full. */
function renderP14Draw(draw: P14Draw): string {
  return JSON.stringify({
    series: draw.series,
    flipped: draw.flipped,
    park: draw.park,
    flipPeriodMs: draw.flipPeriodMs,
    rotation: draw.rotation,
    viewOther: draw.viewOther,
    atOffset: draw.atOffset,
    rename: draw.rename,
    files: renderP14Sources(draw),
  });
}

// ---------------------------------------------------------------------------
// The read menu

/** One refreshing read of a trial's menu (module header). */
interface P14Read {
  readonly argv: readonly string[];
  readonly what: string;
  /** Names F as its `<file>` operand (the spec-source series' last two). */
  readonly namesFlipped: boolean;
  /** F's presence changes its answer: its two references must differ. */
  readonly reflectsFlipped: boolean;
}

/**
 * The series' menu: `ids --json`, `query nodes`, `occurrences`, `view` of
 * another spec source, and, in the spec-source series, `view` and `at` of F
 * (SPEC 13.3's refreshing reads; 11.1, 11.3–11.5, 12.3).
 */
function readMenu(draw: P14Draw): P14Read[] {
  const spec = draw.series === "spec";
  const menu: P14Read[] = [
    {
      argv: ["ids", "--json"],
      what: "`ids --json`",
      namesFlipped: false,
      reflectsFlipped: spec,
    },
    {
      argv: ["query", "nodes"],
      what: "`query nodes`",
      namesFlipped: false,
      reflectsFlipped: spec,
    },
    {
      argv: ["occurrences"],
      what: "`occurrences`",
      namesFlipped: false,
      reflectsFlipped: true,
    },
    {
      argv: ["view", draw.viewOther],
      what: `\`view ${draw.viewOther}\``,
      namesFlipped: false,
      reflectsFlipped: false,
    },
  ];
  if (spec) {
    const offset = String(draw.atOffset);
    menu.push(
      {
        argv: ["view", draw.flipped],
        what: `\`view ${draw.flipped}\``,
        namesFlipped: true,
        reflectsFlipped: true,
      },
      {
        argv: ["at", draw.flipped, offset],
        what: `\`at ${draw.flipped} ${offset}\``,
        namesFlipped: true,
        reflectsFlipped: true,
      },
    );
  }
  const expected = spec ? SPEC_MENU_LENGTH : CODE_MENU_LENGTH;
  if (menu.length !== expected) {
    throw new Error(
      `P-14 harness defect: the ${draw.series}-source series' menu holds ${String(menu.length)} reads, not ${String(expected)}`,
    );
  }
  return menu;
}

// ---------------------------------------------------------------------------
// The flipper

/**
 * Parks and restores F, each change one atomic rename (`rename(2)` within
 * one filesystem: the workspace's temporary directory), so no partial file
 * ever stands at its discovered path. `start` flips every period until
 * `stop`, which restores F once the loop has ended.
 */
class SourceFlipper {
  readonly #home: string;
  readonly #parked: string;
  readonly #periodMs: number;
  #present = true;
  #stopping = false;
  #flips = 0;
  #loop: Promise<void> | undefined;

  constructor(home: string, parked: string, periodMs: number) {
    this.#home = home;
    this.#parked = parked;
    this.#periodMs = periodMs;
  }

  /** Changes made by the loop so far. */
  get flips(): number {
    return this.#flips;
  }

  /** Move F to its park (it must stand at home). */
  async park(): Promise<void> {
    if (!this.#present) throw new Error("P-14 flipper: F is already parked");
    await this.#move(this.#home, this.#parked);
    this.#present = false;
  }

  /** Move F back home, where it is parked; nothing otherwise. */
  async restore(): Promise<void> {
    if (this.#present) return;
    await this.#move(this.#parked, this.#home);
    this.#present = true;
  }

  start(): void {
    if (this.#loop !== undefined) throw new Error("P-14 flipper started twice");
    this.#loop = this.#run();
    // A failed change is reported by `stop`, which awaits the loop; until
    // then the rejection must not count as unhandled.
    this.#loop.catch(() => undefined);
  }

  /** End the loop, then restore F; a failed change is rethrown here. */
  async stop(): Promise<void> {
    this.#stopping = true;
    try {
      await this.#loop;
    } finally {
      await this.restore();
    }
  }

  async #run(): Promise<void> {
    while (!this.#stopping) {
      await sleep(this.#periodMs);
      if (this.#stopping) return;
      if (this.#present) await this.park();
      else await this.restore();
      this.#flips += 1;
    }
  }

  async #move(from: string, to: string): Promise<void> {
    try {
      await rename(from, to);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        // Only the flipper moves F, and no command P-14 runs beside it
        // writes a source but the drawn `rename`, which rewrites no
        // flipped path: F's absence where it was left is the product's
        // doing.
        fail(
          `P-14: the flipped source is gone from ${from}, where the harness ` +
            `left it — the command running beside the flipper removed or ` +
            `relocated a source, which none of P-14's may: a read, ` +
            `\`build\`, or \`check\` writes no source, \`review create\` ` +
            `its session and a refresh alone, and the drawn \`rename\` ` +
            `rewrites no flipped path (SPEC 13.3, 13.4, 12.1, 12.2, 10.7, ` +
            `6.4)`,
        );
      }
      throw error;
    }
  }
}

// ---------------------------------------------------------------------------
// One trial

/** What a scratch probe learns of one trial (module header). */
export interface P14Observation {
  readonly series: P14Series;
  readonly flipped: string;
  readonly park: P14ParkMode;
  readonly flipPeriodMs: number;
  /** Changes the flipper made during the concurrent phase. */
  readonly flips: number;
  /** Concurrent reads run. */
  readonly reads: number;
  /** Concurrent reads whose answer is F present's, the two answers differing. */
  readonly metPresent: number;
  /** Concurrent reads whose answer is F absent's, the two answers differing. */
  readonly metAbsent: number;
  /** Concurrent reads whose two references are identical. */
  readonly indistinct: number;
  /** The commands driven alone, in the order run (module header). */
  readonly solo: readonly P14SoloObservation[];
}

/** What a scratch probe learns of one command driven alone. */
export interface P14SoloObservation {
  readonly command: P14SoloKind;
  /** Runs while F flipped whose outcome is F present's. */
  readonly metPresent: number;
  /** Runs while F flipped whose outcome is F absent's. */
  readonly metAbsent: number;
  /** Changes the flipper made during each of those runs. */
  readonly flips: readonly number[];
}

/** Which arms a trial runs (scratch probes; the registered body: all). */
export interface P14Arms {
  /** The concurrent reads' arm (default: run). */
  readonly reads?: boolean;
  /** The commands driven alone (default: every one, in their order). */
  readonly solo?: readonly P14SoloKind[];
}

/** Exit code (or signal) and standard output equal (TEST-SPEC P-14). */
function sameAnswer(a: RunResult, b: RunResult): boolean {
  return (
    a.signal === b.signal &&
    a.exitCode === b.exitCode &&
    bytesEqual(a.stdoutBytes, b.stdoutBytes)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Name the outcome P-14 singles out where a deviant answer shows it: a
 * crash, a `read-failure` for the vanished file, or condition 20 for it at
 * offset 0; `null` for anything else (the byte differences then speak).
 */
function characterize(result: RunResult, flipped: string): string | null {
  if (result.signal !== null) {
    return `a crash, its process killed by signal ${result.signal}`;
  }
  let doc: unknown;
  try {
    doc = JSON.parse(Buffer.from(result.stdoutBytes).toString("utf8"));
  } catch {
    return null;
  }
  if (!isRecord(doc)) return null;
  const error = doc.error;
  if (isRecord(error) && error.code === "read-failure") {
    return error.path === flipped
      ? "a `read-failure` for the vanished file — 14.25's outcome for a read the environment refuses, never for an absent source"
      : `a \`read-failure\` (path ${JSON.stringify(error.path)})`;
  }
  const findings = doc.findings;
  if (Array.isArray(findings)) {
    const atOffsetZero = findings.some(
      (finding) =>
        isRecord(finding) &&
        finding.code === "unparseable-source" &&
        Array.isArray(finding.locations) &&
        finding.locations.some(
          (location) =>
            isRecord(location) &&
            location.file === flipped &&
            isRecord(location.range) &&
            location.range.start === 0,
        ),
    );
    if (atOffsetZero) {
      return "condition 20 for the vanished file at offset 0 — 14.25's outcome for a source whose content read the environment refuses, never for an absent one";
    }
  }
  return null;
}

/** The rule every concurrent read is held to (TEST-SPEC P-14). */
const ABSENCE_RULE =
  "a discovered source found absent when its content is read — removed or " +
  "relocated since discovery — reads as undiscovered, as though discovery " +
  "had not yielded it: never a `read-failure` for it, never condition 20 " +
  "for it, never a crash; a read naming it answers the unknown-file usage " +
  "error (SPEC 14.25, 13.5, 12.0; 11.4, 11.5)";

/**
 * One P-14 trial (module header): the workspace built with F present, its
 * built state kept for the commands driven alone; the reads' arm — the
 * quiescent references with F present and absent, and their premises; the
 * concurrent phase while F flips; every read judged against the two
 * references — then each command driven alone (`soloArm`). `observe`
 * (scratch probes) receives the trial's counts once every run has been
 * judged; `arms` (scratch probes) selects the arms run.
 */
export async function runP14Trial(
  product: ProductBinding,
  draw: P14Draw,
  observe?: (observation: P14Observation) => void,
  arms: P14Arms = {},
): Promise<void> {
  const config = draw.series === "spec" ? P14_SPEC_CONFIG : P14_CODE_CONFIG;
  const sources = renderP14Sources(draw);
  // S-9: the draw's sources, judged by the property runner before the body
  // saw them (`stagedP14Sources`), are declared per draw — every trial
  // after the first creates its workspace after the body's first product
  // invocation; the configuration is a staged-source record.
  const workspace = await TestWorkspace.create({
    files: { "xspec.config.ts": config, ...sources },
    mdx: { perDraw: mdxPathsOf(sources) },
    ts: { perDraw: tsPathsOf(sources) },
  });
  try {
    const context =
      `P-14 (the ${draw.series}-source series; F ${draw.flipped}, ` +
      `${draw.park === "removed" ? "removed from the workspace" : `relocated to ${RELOCATION_DIR}/`} ` +
      `and restored every ${String(draw.flipPeriodMs)} ms)`;
    const flipper = new SourceFlipper(
      workspace.path(draw.flipped),
      await parkedPathIn(workspace, draw),
      draw.flipPeriodMs,
    );
    // Each run under its hang guard; a hang — runBounded's one diagnosed
    // failure — declines shrinking: each re-observation would cost a full
    // hang guard (helpers/assertions.ts `shrinkable`).
    const runIn: P14Run = async (cwd, argv, what) => {
      try {
        return await runBounded(product, cwd, argv, `${context} ${what}`, {
          timeoutMs: RUN_TIMEOUT_MS,
        });
      } catch (error) {
        if (error instanceof HarnessAssertionError) {
          fail(error.message, { shrinkable: false });
        }
        throw error;
      }
    };
    const run = (argv: readonly string[], what: string): Promise<RunResult> =>
      runIn(workspace.root, argv, what);

    const build = await run(["build"], "quiescent `build` with F present");
    if (build.signal !== null || build.exitCode !== 0) {
      fail(
        `${context}: the quiescent \`build\` with F present must succeed — ` +
          `the generated workspace is valid by construction, so a \`build\` ` +
          `failure is a product failure (TEST-SPEC §16 preamble; SPEC 12.1): ` +
          summarizeResult(build),
      );
    }
    const built = await keepBuiltState(workspace);

    let reads: Omit<P14Observation, "solo"> = {
      series: draw.series,
      flipped: draw.flipped,
      park: draw.park,
      flipPeriodMs: draw.flipPeriodMs,
      flips: 0,
      reads: 0,
      metPresent: 0,
      metAbsent: 0,
      indistinct: 0,
    };
    if (arms.reads !== false) {
      const menu = readMenu(draw);
      const present: RunResult[] = [];
      for (const read of menu) {
        present.push(
          await run(read.argv, `${read.what} (quiescent, F present)`),
        );
      }
      await flipper.park();
      const absent: RunResult[] = [];
      try {
        for (const read of menu) {
          absent.push(
            await run(read.argv, `${read.what} (quiescent, F absent)`),
          );
        }
      } finally {
        await flipper.restore();
      }
      assertReferences(context, draw, menu, present, absent);

      const answers = await concurrentPhase(draw, menu, flipper, run);
      reads = judgeAnswers(
        context,
        draw,
        menu,
        present,
        absent,
        answers,
        flipper.flips,
      );
    }

    const solo: P14SoloObservation[] = [];
    for (const command of soloCommands(draw)) {
      if (arms.solo !== undefined && !arms.solo.includes(command.kind)) {
        continue;
      }
      solo.push(await soloArm(context, draw, command, built, runIn));
    }
    observe?.({ ...reads, solo });
  } finally {
    await workspace.dispose();
  }
}

/** A run under its hang guard, in `cwd` (`runP14Trial`'s `runIn`). */
type P14Run = (
  cwd: string,
  argv: readonly string[],
  what: string,
) => Promise<RunResult>;

/**
 * Where F parks in `workspace` (module header): renamed into the
 * workspace's temporary directory, outside its root, or into
 * RELOCATION_DIR under the root, outside every group's globs — each
 * directory brought into existence first (in a copy of a built workspace,
 * RELOCATION_DIR already stands: the trial makes it before its `build`).
 */
async function parkedPathIn(
  workspace: TestWorkspace,
  draw: P14Draw,
): Promise<string> {
  const basename = path.posix.basename(draw.flipped);
  if (draw.park === "removed") {
    const parked = path.join(workspace.tempRoot, "parked", basename);
    await mkdir(path.dirname(parked), { recursive: true });
    return parked;
  }
  await workspace.dir(RELOCATION_DIR);
  return workspace.path(`${RELOCATION_DIR}/${basename}`);
}

/**
 * The state every command driven alone starts from (TEST-SPEC P-14: "the
 * workspace built quiescently with the source present"): a byte copy of
 * the trial's workspace taken as its quiescent `build` left it, before any
 * read could refresh its graph data (SPEC 13.3), kept in the workspace's
 * temporary directory, outside its root; the lock path aside (H-6), where
 * a `build`, acquiring nothing, leaves nothing. A copy differing from the
 * workspace is a harness error, never a product verdict.
 */
async function keepBuiltState(
  workspace: TestWorkspace,
): Promise<DirectorySnapshot> {
  const kept = path.join(workspace.tempRoot, "built");
  await mkdir(kept);
  await copyTreeBytes(
    Buffer.from(workspace.root),
    Buffer.from(kept),
    isLockPathBytes,
  );
  const built = await snapshotDirectory(kept);
  assertCopyEqual(
    await snapshotDirectory(workspace.root, EXCLUDE_LOCK_PATH),
    built,
  );
  return built;
}

/** A copy's byte state equals its origin's, or the harness erred. */
function assertCopyEqual(
  origin: DirectorySnapshot,
  copy: DirectorySnapshot,
): void {
  const differences = diffSnapshots(origin, copy);
  if (differences.length > 0) {
    throw new Error(
      `harness error: P-14's copy of ${origin.root} at ${copy.root} ` +
        `differs from it: ` +
        differences
          .slice(0, 10)
          .map((change) => `${change.change} ${change.path}`)
          .join(", "),
    );
  }
}

/** The quiescent references' premises (module header). */
function assertReferences(
  context: string,
  draw: P14Draw,
  menu: readonly P14Read[],
  present: readonly RunResult[],
  absent: readonly RunResult[],
): void {
  menu.forEach((read, index) => {
    const withF = present[index] as RunResult;
    const withoutF = absent[index] as RunResult;
    if (withF.signal !== null || withF.exitCode !== 0) {
      fail(
        `${context}: ${read.what}, quiescent with F present, must answer ` +
          `exit 0 — on a valid workspace every answer is complete and ` +
          `finding-free (SPEC 11.2, 12.0): ${summarizeResult(withF)}`,
      );
    }
    if (read.namesFlipped) {
      if (withoutF.signal !== null || withoutF.exitCode !== 2) {
        const shown = characterize(withoutF, draw.flipped);
        fail(
          `${context}: ${read.what}, quiescent with F absent, must answer ` +
            `the unknown-file usage error — exit 2, \`code\` null (SPEC ` +
            `12.0; 11.4, 11.5) — never condition 20 for it at offset 0` +
            `${shown === null ? "" : `; it answered ${shown}`}: ` +
            summarizeResult(withoutF),
        );
      }
      const error = decodeErrorDocument(
        parseOrFail(withoutF, `${context}: ${read.what} with F absent`),
        `${context}: ${read.what} with F absent`,
      ).error;
      if (error.code !== null) {
        fail(
          `${context}: ${read.what}, quiescent with F absent, must answer ` +
            `the unknown-file usage error, its \`code\` null (SPEC 12.0, ` +
            `12.7; 11.4, 11.5), but the error document's \`code\` is ` +
            `${JSON.stringify(error.code)}: ${summarizeResult(withoutF)}`,
        );
      }
    } else if (withoutF.signal !== null || withoutF.exitCode !== 0) {
      fail(
        `${context}: ${read.what}, quiescent with F absent, must answer ` +
          `exit 0 — the workspace without F is valid, nothing else ` +
          `referencing it (SPEC 11.2, 12.0): ${summarizeResult(withoutF)}`,
      );
    }
    if (read.reflectsFlipped && sameAnswer(withF, withoutF)) {
      fail(
        `${context}: ${read.what} answers byte-identically with F present ` +
          `and with F absent, so F's presence does not show in it — a ` +
          `discovered source's ${draw.series === "spec" ? "sections and reference occurrences" : "markers (reference occurrences, SPEC 4.5, 5.7)"} ` +
          `belong to the answer (SPEC 11.1, 11.3–11.5, 12.3): ` +
          summarizeResult(withF),
      );
    }
  });
}

/** Parse a run's stdout as JSON, a parse failure diagnosed (H-5). */
function parseOrFail(result: RunResult, context: string): unknown {
  try {
    return JSON.parse(Buffer.from(result.stdoutBytes).toString("utf8"));
  } catch {
    return fail(
      `${context}: with JSON output in effect, an exit-2 invocation emits ` +
        `the 12.7 error document as its entire stdout (SPEC 12.0, H-5): ` +
        summarizeResult(result),
    );
  }
}

/** One concurrent read's answer and its place in the schedule. */
interface ConcurrentAnswer {
  readonly read: number;
  readonly worker: number;
  readonly round: number;
  readonly step: number;
  readonly result: RunResult;
}

/**
 * The concurrent phase (module header): P14_WORKERS workers, each running
 * P14_ROUNDS rounds of the menu back to back, while the flipper flips F;
 * F restored once every read has settled. A worker's diagnosed failure (a
 * read's hang guard, declining shrinking) is reported once all have
 * settled.
 */
async function concurrentPhase(
  draw: P14Draw,
  menu: readonly P14Read[],
  flipper: SourceFlipper,
  run: (argv: readonly string[], what: string) => Promise<RunResult>,
): Promise<ConcurrentAnswer[]> {
  const answers: ConcurrentAnswer[] = [];
  const worker = async (index: number): Promise<void> => {
    for (let round = 0; round < P14_ROUNDS; round += 1) {
      for (let step = 0; step < menu.length; step += 1) {
        const read = (draw.rotation + index + step) % menu.length;
        const entry = menu[read] as P14Read;
        const result = await run(
          entry.argv,
          `${entry.what} (concurrent, worker ${String(index)}, round ${String(round)})`,
        );
        answers.push({ read, worker: index, round, step, result });
      }
    }
  };
  flipper.start();
  let settled: PromiseSettledResult<void>[];
  try {
    settled = await Promise.allSettled(indices(P14_WORKERS).map(worker));
  } finally {
    await flipper.stop();
  }
  for (const outcome of settled) {
    if (outcome.status === "rejected") throw outcome.reason;
  }
  return answers;
}

/**
 * Judge every concurrent answer against the two references (TEST-SPEC
 * P-14), reporting the first deviant one in schedule order and how many
 * deviated; count the reads that met F present and absent.
 */
function judgeAnswers(
  context: string,
  draw: P14Draw,
  menu: readonly P14Read[],
  present: readonly RunResult[],
  absent: readonly RunResult[],
  answers: readonly ConcurrentAnswer[],
  flips: number,
): Omit<P14Observation, "solo"> {
  let metPresent = 0;
  let metAbsent = 0;
  let indistinct = 0;
  const deviant: ConcurrentAnswer[] = [];
  for (const answer of answers) {
    const withF = present[answer.read] as RunResult;
    const withoutF = absent[answer.read] as RunResult;
    const isPresent = sameAnswer(answer.result, withF);
    const isAbsent = sameAnswer(answer.result, withoutF);
    if (!isPresent && !isAbsent) deviant.push(answer);
    else if (isPresent && isAbsent) indistinct += 1;
    else if (isPresent) metPresent += 1;
    else metAbsent += 1;
  }
  if (deviant.length > 0) {
    const ordered = [...deviant].sort(
      (a, b) => a.worker - b.worker || a.round - b.round || a.step - b.step,
    );
    const first = ordered[0] as ConcurrentAnswer;
    const read = menu[first.read] as P14Read;
    const withF = present[first.read] as RunResult;
    const withoutF = absent[first.read] as RunResult;
    const shown = characterize(first.result, draw.flipped);
    fail(
      `${context}: ${read.what} (concurrent, worker ${String(first.worker)}, ` +
        `round ${String(first.round)}; ${String(deviant.length)} of ` +
        `${String(answers.length)} concurrent reads deviated, ` +
        `${String(flips)} flips) answered neither as the quiescent run with ` +
        `F present (exit ${String(withF.exitCode)}) nor as the one with F ` +
        `absent (exit ${String(withoutF.exitCode)})` +
        `${shown === null ? "" : ` — it answered ${shown}`}: ` +
        `${summarizeResult(first.result)}\n` +
        `against F present's standard output: ` +
        `${describeByteDifference(first.result.stdoutBytes, withF.stdoutBytes, "answer", "F present")}\n` +
        `against F absent's standard output: ` +
        `${describeByteDifference(first.result.stdoutBytes, withoutF.stdoutBytes, "answer", "F absent")}\n` +
        `(${ABSENCE_RULE})`,
    );
  }
  return {
    series: draw.series,
    flipped: draw.flipped,
    park: draw.park,
    flipPeriodMs: draw.flipPeriodMs,
    flips,
    reads: answers.length,
    metPresent,
    metAbsent,
    indistinct,
  };
}

// ---------------------------------------------------------------------------
// The commands driven alone

/** The commands P-14 drives alone while F flips, in their order. */
export const P14_SOLO_KINDS = [
  "build",
  "check",
  "rename",
  "review create",
] as const;

/** One of P14_SOLO_KINDS. */
export type P14SoloKind = (typeof P14_SOLO_KINDS)[number];

/** A quiescent exit code a reference must answer, and why. */
interface P14Exit {
  readonly code: number;
  readonly why: string;
}

/** One command P-14 drives alone (module header). */
interface P14Solo {
  readonly kind: P14SoloKind;
  readonly argv: readonly string[];
  readonly what: string;
  /**
   * Whether the files it leaves join its outcome — every file of the copy
   * but the paths the harness flips and the lock path (H-6). `check`
   * writes nothing (SPEC 12.2, 13.3): its exit code and standard output
   * alone are compared.
   */
  readonly leavesFiles: boolean;
  /** The references' premises: the quiescent exit codes, F present and absent. */
  readonly exits: { readonly present: P14Exit; readonly absent: P14Exit };
  /** Why the two references must differ (a premise: F's presence shows). */
  readonly differsBecause: string;
}

const VALID_WORKSPACE =
  "the workspace is valid by construction, nothing referencing F, so with " +
  "F present or absent";

/**
 * The commands driven alone, under `--json` so a refusal's error document
 * is standard-output content (SPEC 12.0): `build`, `check`, the drawn
 * `rename` (a section in a spec source other than F), and `review create
 * --strategy audit --name n` (TEST-SPEC P-14).
 */
function soloCommands(draw: P14Draw): P14Solo[] {
  const { file, id, to } = draw.rename;
  return [
    {
      kind: "build",
      argv: ["build", "--json"],
      what: "`build --json`",
      leavesFiles: true,
      exits: {
        present: {
          code: 0,
          why: `${VALID_WORKSPACE} \`build\` succeeds (SPEC 12.1)`,
        },
        absent: {
          code: 0,
          why: `${VALID_WORKSPACE} \`build\` succeeds (SPEC 12.1)`,
        },
      },
      differsBecause:
        "F's presence changes `build`'s graph data (TEST-SPEC P-14; SPEC " +
        "12.1, 13.3) — and, in the spec-source series, the derived files it " +
        "generates or removes (13.1, 13.4)",
    },
    {
      kind: "check",
      argv: ["check", "--json"],
      what: "`check --json`",
      leavesFiles: false,
      exits: {
        present: {
          code: 0,
          why:
            "on the workspace `build` just generated, every derived file and " +
            "the graph data match the sources: no finding (SPEC 12.2)",
        },
        absent: {
          code: 1,
          why:
            "with F absent, the graph data the `build` wrote with F present " +
            "no longer matches the sources — staleness, a `check` finding " +
            "(SPEC 12.2, 13.3, 14.10)",
        },
      },
      differsBecause:
        "with F absent the graph data `build` wrote with F present is stale " +
        "(SPEC 12.2, 13.3, 14.10)",
    },
    {
      kind: "rename",
      argv: ["rename", file, id, to, "--json"],
      what: `\`rename ${file} ${id} ${to} --json\``,
      leavesFiles: true,
      exits: {
        present: {
          code: 0,
          why: `${VALID_WORKSPACE} the \`rename\` of an existing section to a fresh ID succeeds (SPEC 6.4)`,
        },
        absent: {
          code: 0,
          why: `${VALID_WORKSPACE} the \`rename\` of an existing section to a fresh ID succeeds (SPEC 6.4)`,
        },
      },
      differsBecause:
        "F's presence changes the graph data the `rename`'s finishing " +
        "regeneration writes (TEST-SPEC P-14; SPEC 6.4, 12.1, 13.3)",
    },
    {
      kind: "review create",
      argv: [
        "review",
        "create",
        "--strategy",
        "audit",
        "--name",
        SESSION_NAME,
        "--json",
      ],
      what: `\`review create --strategy audit --name ${SESSION_NAME} --json\``,
      leavesFiles: true,
      exits: {
        present: {
          code: 0,
          why: `${VALID_WORKSPACE} \`review create\` of a new audit session succeeds (SPEC 10.6, 10.7)`,
        },
        absent: {
          code: 0,
          why: `${VALID_WORKSPACE} \`review create\` of a new audit session succeeds (SPEC 10.6, 10.7)`,
        },
      },
      differsBecause:
        "with F absent the graph data `build` wrote with F present is " +
        "stale, and `review create` refreshes it before deriving its items " +
        "(SPEC 13.3, 10.6, 10.7)",
    },
  ];
}

/** One run of a command driven alone, as P-14 compares it. */
interface SoloOutcome {
  readonly result: RunResult;
  /**
   * The files it leaves — the flipped paths and the lock path aside (H-6);
   * `null` where they are not compared (`check`).
   */
  readonly files: DirectorySnapshot | null;
  /** Changes the flipper made during the run (none for a reference). */
  readonly flips: number;
}

/** The differences between the files two runs leave (none when uncompared). */
function fileChanges(
  reference: SoloOutcome,
  outcome: SoloOutcome,
): SnapshotChange[] {
  if (reference.files === null || outcome.files === null) return [];
  return diffSnapshots(reference.files, outcome.files);
}

/** Exit code, standard output, and the files left, together equal. */
function sameOutcome(a: SoloOutcome, b: SoloOutcome): boolean {
  return sameAnswer(a.result, b.result) && fileChanges(a, b).length === 0;
}

/**
 * The snapshot keys of the paths the harness flips (TEST-SPEC P-14: "the
 * paths the harness flips aside"): F's discovered path and, relocated, its
 * park under the root.
 */
function flippedKeys(draw: P14Draw): ReadonlySet<string> {
  const keys = new Set([draw.flipped]);
  if (draw.park === "relocated") {
    keys.add(`${RELOCATION_DIR}/${path.posix.basename(draw.flipped)}`);
  }
  return keys;
}

/**
 * One run of `solo`, alone, on a fresh byte copy of the built state
 * (`keepBuiltState`): with F present, with F parked as the trial parks it,
 * or while the flipper flips F every drawn period — F restored once the
 * run has ended, before the files it leaves are captured.
 */
async function soloRun(
  draw: P14Draw,
  solo: P14Solo,
  built: DirectorySnapshot,
  mode: "present" | "absent" | "flipping",
  runIn: P14Run,
  what: string,
): Promise<SoloOutcome> {
  const copy = await TestWorkspace.create();
  try {
    await copyTreeBytes(Buffer.from(built.root), Buffer.from(copy.root));
    assertCopyEqual(built, await snapshotDirectory(copy.root));
    const flipper = new SourceFlipper(
      copy.path(draw.flipped),
      await parkedPathIn(copy, draw),
      draw.flipPeriodMs,
    );
    let result: RunResult;
    if (mode === "flipping") {
      flipper.start();
      try {
        result = await runIn(copy.root, solo.argv, what);
      } finally {
        await flipper.stop();
      }
    } else {
      if (mode === "absent") await flipper.park();
      try {
        result = await runIn(copy.root, solo.argv, what);
      } finally {
        await flipper.restore();
      }
    }
    const flipped = flippedKeys(draw);
    const files = solo.leavesFiles
      ? await snapshotDirectory(copy.root, {
          exclude: (rel) =>
            isLockPathBytes(rel) ||
            flipped.has(Buffer.from(rel).toString("latin1")),
        })
      : null;
    return { result, files, flips: flipper.flips };
  } finally {
    await copy.dispose();
  }
}

/** The rule every run of a command driven alone is held to (TEST-SPEC P-14). */
const SOLO_RULE =
  "a discovered source found absent when its content is read — removed or " +
  "relocated since discovery, for a mutating command since its rediscovery " +
  "under exclusivity — reads as undiscovered, so `build`, `check`, a " +
  "`rename`, and `review create`, each run alone while it flips, leave " +
  "what one quiescent run leaves with it present or with it absent: never " +
  "a `read-failure` for it, never a crash (SPEC 14.25, 13.5, 12.1, 12.2, " +
  "6.4, 10.7; H-6)";

/**
 * A command driven alone (module header): its two quiescent references,
 * their premises, then P14_SOLO_RUNS runs while F flips, each outcome
 * equal to one reference's — the first deviant run failing at once.
 */
async function soloArm(
  context: string,
  draw: P14Draw,
  solo: P14Solo,
  built: DirectorySnapshot,
  runIn: P14Run,
): Promise<P14SoloObservation> {
  const present = await soloRun(
    draw,
    solo,
    built,
    "present",
    runIn,
    `${solo.what} (alone, quiescent, F present)`,
  );
  const absent = await soloRun(
    draw,
    solo,
    built,
    "absent",
    runIn,
    `${solo.what} (alone, quiescent, F absent)`,
  );
  assertSoloReferences(context, draw, solo, present, absent);
  let metPresent = 0;
  const flips: number[] = [];
  for (let index = 0; index < P14_SOLO_RUNS; index += 1) {
    const outcome = await soloRun(
      draw,
      solo,
      built,
      "flipping",
      runIn,
      `${solo.what} (alone while F flips, run ${String(index + 1)} of ${String(P14_SOLO_RUNS)})`,
    );
    flips.push(outcome.flips);
    if (sameOutcome(outcome, present)) {
      metPresent += 1;
    } else if (!sameOutcome(outcome, absent)) {
      failSolo(context, draw, solo, index, outcome, present, absent);
    }
  }
  return {
    command: solo.kind,
    metPresent,
    metAbsent: P14_SOLO_RUNS - metPresent,
    flips,
  };
}

/** The premises of a command's two references (module header). */
function assertSoloReferences(
  context: string,
  draw: P14Draw,
  solo: P14Solo,
  present: SoloOutcome,
  absent: SoloOutcome,
): void {
  for (const [side, outcome] of [
    ["present", present],
    ["absent", absent],
  ] as const) {
    const expected = solo.exits[side];
    const { result } = outcome;
    if (result.signal !== null || result.exitCode !== expected.code) {
      const shown = characterize(result, draw.flipped);
      fail(
        `${context}: ${solo.what}, run alone and quiescent on a fresh copy ` +
          `of the built workspace with F ${side}, must answer exit ` +
          `${String(expected.code)} — ${expected.why}` +
          `${shown === null ? "" : `; it answered ${shown}`}: ` +
          summarizeResult(result),
      );
    }
  }
  if (sameOutcome(present, absent)) {
    fail(
      `${context}: ${solo.what}, run alone and quiescent with F present and ` +
        `with F absent, leaves byte-identical outcomes — exit code, standard ` +
        `output${solo.leavesFiles ? ", and the files it leaves" : ""} — so ` +
        `F's presence does not show in it, though ${solo.differsBecause}: ` +
        summarizeResult(present.result),
    );
  }
}

/** At most ten differences, each with its detail. */
function renderSoloChanges(changes: readonly SnapshotChange[]): string {
  const shown = changes
    .slice(0, 10)
    .map((change) => `${change.change} ${change.path} (${change.detail})`);
  if (changes.length > 10) {
    shown.push(`… ${String(changes.length - 10)} more`);
  }
  return shown.join("; ");
}

/** A run while F flipped whose outcome is neither reference's (diagnosed). */
function failSolo(
  context: string,
  draw: P14Draw,
  solo: P14Solo,
  index: number,
  outcome: SoloOutcome,
  present: SoloOutcome,
  absent: SoloOutcome,
): never {
  const against = (label: string, reference: SoloOutcome): string => {
    const parts: string[] = [];
    if (sameAnswer(outcome.result, reference.result)) {
      parts.push("its exit code and standard output equal that run's");
    } else {
      parts.push(
        `that run exited ${String(reference.result.exitCode)}; standard ` +
          `output: ${describeByteDifference(outcome.result.stdoutBytes, reference.result.stdoutBytes, "this run", label)}`,
      );
    }
    if (solo.leavesFiles) {
      const changes = fileChanges(reference, outcome);
      parts.push(
        changes.length === 0
          ? "the files it leaves equal that run's"
          : `${String(changes.length)} difference(s) in the files it ` +
              `leaves: ${renderSoloChanges(changes)}`,
      );
    }
    return `against the quiescent run with ${label}: ${parts.join("; ")}`;
  };
  const shown = characterize(outcome.result, draw.flipped);
  fail(
    `${context}: ${solo.what}, run alone on a fresh copy of the built ` +
      `workspace while F flipped (run ${String(index + 1)} of ` +
      `${String(P14_SOLO_RUNS)}, ${String(outcome.flips)} flips during it), ` +
      `left an outcome — its exit code, standard output` +
      `${solo.leavesFiles ? ", and the files it leaves, together" : ""} — ` +
      `equal to neither quiescent run's` +
      `${shown === null ? "" : `; it answered ${shown}`}: ` +
      `${summarizeResult(outcome.result)}\n` +
      `${against("F present", present)}\n` +
      `${against("F absent", absent)}\n` +
      `(${SOLO_RULE})`,
  );
}

// ---------------------------------------------------------------------------
// S-9's fixed vectors (TEST-SPEC 17 S-9; the §16 preamble): every form the
// rendering composes, through the rendering itself over fixed models.

const local: P14Target = { kind: "local" };
const ext = (file: number, id: string): P14Target => ({
  kind: "external",
  file,
  id,
});
const leaf = (
  id: string,
  refs: readonly P14Target[] = [],
  embeds: readonly P14Target[] = [],
): P14Section => ({ id, refs, embeds, children: [] });
const ANCHOR_SECTION = leaf(ANCHOR);

/**
 * Fixed spec sources: no imports (local `d` and embedding, two children, a
 * referenceless `v`); one import (`./` specifier; a mixed `d` array, an
 * external embedding, a child's external `d`); two imports (an external `d`
 * array, `v` with a child); F nested in `specs/sub/` (`../` specifiers) and
 * F directly under `specs/`.
 */
const VECTOR_SPEC_FILES: readonly P14SpecFile[] = [
  {
    path: "specs/Ka.mdx",
    imports: [],
    sections: [
      ANCHOR_SECTION,
      {
        id: "u",
        refs: [local],
        embeds: [local],
        children: [leaf("u.k"), leaf("u.m", [local])],
      },
      leaf("v"),
    ],
  },
  {
    path: "specs/Mo.mdx",
    imports: [0],
    sections: [
      ANCHOR_SECTION,
      {
        id: "u",
        refs: [ext(0, "u"), local],
        embeds: [ext(0, "u.k")],
        children: [leaf("u.k", [ext(0, "t")])],
      },
    ],
  },
  {
    path: "specs/Se.mdx",
    imports: [0, 1],
    sections: [
      ANCHOR_SECTION,
      leaf("u", [ext(0, "t"), ext(1, "u")], [ext(1, "t")]),
      {
        id: "v",
        refs: [ext(1, "u.k")],
        embeds: [],
        children: [leaf("v.m", [], [local])],
      },
    ],
  },
  {
    path: "specs/sub/Lu.mdx",
    imports: [0, 2],
    sections: [ANCHOR_SECTION, leaf("u", [ext(2, "v")], [ext(0, "t")])],
  },
  {
    path: "specs/Zo.mdx",
    imports: [1],
    sections: [ANCHOR_SECTION, leaf("u", [local])],
  },
];

/** `[name, source]`: every spec-source form, judged derivable by S-9. */
export const P14_FORM_VECTORS: ReadonlyArray<
  readonly [name: string, source: string]
> = VECTOR_SPEC_FILES.map((file) => [
  `P-14 ${file.path}`,
  renderSpecFile(file, VECTOR_SPEC_FILES),
]);

/**
 * Fixed code sources over VECTOR_SPEC_FILES: one import and top-level
 * markers; two imports and function units alone, from `src/lib/` (`../../`
 * specifiers); a top-level marker beside a unit, at OTHER_CODE_PATH.
 */
const VECTOR_CODE_FILES: readonly P14CodeFile[] = [
  {
    path: "src/Lu.ts",
    imports: [0],
    topLevel: [
      { file: 0, id: "t" },
      { file: 0, id: "u.k" },
    ],
    units: [],
  },
  {
    path: "src/lib/Ab.ts",
    imports: [0, 1],
    topLevel: [],
    units: [
      { name: "f", markers: [{ file: 1, id: "u" }] },
      {
        name: "g",
        markers: [
          { file: 0, id: "t" },
          { file: 1, id: "u.k" },
        ],
      },
    ],
  },
  {
    path: OTHER_CODE_PATH,
    imports: [2],
    topLevel: [{ file: 2, id: "v" }],
    units: [{ name: "f", markers: [{ file: 2, id: "t" }] }],
  },
];

/**
 * `[name, staged path, source]`: both configurations (the records above)
 * and every code-source form, judged well-formed TypeScript by S-9.
 */
export const P14_TS_FORM_VECTORS: ReadonlyArray<
  readonly [name: string, path: string, source: string | Uint8Array]
> = [
  [
    "P-14 configuration — the spec-source series (P14_SPEC_CONFIG)",
    "xspec.config.ts",
    P14_SPEC_CONFIG.source,
  ],
  [
    "P-14 configuration — the code-source series (P14_CODE_CONFIG)",
    "xspec.config.ts",
    P14_CODE_CONFIG.source,
  ],
  ...VECTOR_CODE_FILES.map((file): readonly [string, string, string] => [
    `P-14 ${file.path}`,
    file.path,
    renderCodeFile(file, VECTOR_SPEC_FILES),
  ]),
];

// ---------------------------------------------------------------------------
// Registration

const P_14 = defineProductTest({
  id: "P-14",
  title:
    "sources vanishing under reads (TEST-SPEC §16 P-14): random valid workspaces holding a spec source no other file references and, in a second series, a code source a configured code group matches that no other file imports, holding markers on sections of spec sources, the flipped source referencing nothing in the drawn `rename` target's subtree; built quiescently with it present, the refreshing reads (`ids --json`, `query nodes`, `occurrences`, `view` of another spec source, and, in the spec-source series, `view` of the flipped source and `at` of it at a within-file offset) run quiescently with the source present and with it absent — a read naming it answering, absent, the unknown-file usage error (exit 2, `code` null), never condition 20 for it at offset 0 — and then repeatedly and concurrently while the source is repeatedly removed from the workspace or relocated outside every group's globs and restored, each change one atomic rename: each read's exit code and standard output equal those of the quiescent run with the source present or of the one with it absent; and `build`, `check`, a `rename` of a section in another file, and `review create --strategy audit --name n`, each run alone on a fresh copy of the workspace as built, quiescently with the source present and with it absent and then while it flips: each run's exit code, standard output, and — but for `check`, which writes nothing — the files it leaves (sources, journal, session, derived files, graph data; the flipped paths aside, the lock path excluded, H-6) together equal those of one quiescent run of the same command with the source present or with it absent — never a `read-failure` for the vanished file, never condition 20 for it, never a crash (SPEC 14.25, 13.5, 12.0, 11.4, 11.5; E-5)",
  // Wall-clock hang guard only (H-10): two series, each P14_RUNS_PER_SEED
  // trials at each of the three fixed seeds (E-5), plus up to
  // P14_MAX_SHRINK_EXECUTIONS shrink trials on a falsification; each run's
  // own guard is RUN_TIMEOUT_MS. Measured under the unprivileged namespace:
  // ~231 s passing against a P-14-conforming stand-in (the built product
  // re-running any run its own race answer spoiled, a command driven alone
  // from the state the spoiled run started in): the spec-source series
  // ~122 s, the code-source series ~108 s, 17–22 s a trial (a fresh
  // workspace and its `build`; the reads' arm, 12 quiescent and 36
  // concurrent reads in the spec-source series, 8 and 24 in the other; and
  // 2 + P14_SOLO_RUNS runs of each command driven alone). Failing against
  // the built product, its four shrink trials included: ~40 s, at the
  // reads' arm.
  timeoutMs: 900_000,
  run: async (product) => {
    await checkProperty(
      "P-14 sources vanishing under reads — the spec-source series",
      genP14SpecDraw,
      async (draw) => {
        await runP14Trial(product, draw);
      },
      {
        runs: P14_RUNS_PER_SEED,
        maxShrinkExecutions: P14_MAX_SHRINK_EXECUTIONS,
        render: renderP14Draw,
        drawSources: stagedP14Sources,
      },
    );
    await checkProperty(
      "P-14 sources vanishing under reads — the code-source series",
      genP14CodeDraw,
      async (draw) => {
        await runP14Trial(product, draw);
      },
      {
        runs: P14_RUNS_PER_SEED,
        maxShrinkExecutions: P14_MAX_SHRINK_EXECUTIONS,
        render: renderP14Draw,
        drawSources: stagedP14Sources,
      },
    );
  },
});

/** TEST-SPEC §16 P-14 (PROP-12). */
export const section16P14Tests: readonly ProductTestEntry[] = [P_14];
