// TEST-SPEC §16 P-17 (installation names).
//
// One registered product-facing property test (C-2 "one code path") over
// SPEC 7.6's Package and installation and Reach: a package installed under
// a name N — placed, exactly as distributed, at `node_modules/N` in its
// holding directory, the importing file's own or an ancestor, as a copy or
// as a symbolic link to one — is designated by a specifier spelling exactly
// N along TypeScript's route in every covered setup and along Node.js's
// routes on every release the runtime contract covers, wherever Reach's
// four conditions hold; a copy, a symbolic-link install, and an aliased
// install are alike. T7.6-4's placements anchor the property
// (section-7.6-ii.ts: the manifest's own name, a symbolic link, a scoped
// name, a digit-first name, a name holding `-` and `_`, the dotted names
// `a.js` and `a.b`, an unscoped and a scoped 214-character name, two
// ancestor holding directories); this module searches the names and
// placements they never stage. A seeded, reproducible generator
// (helpers/property.ts, H-10; the fixed seed set in CI, E-5) draws, per
// trial (`genP17Draw`):
//
//   * N (`genP17Name`), a name of 7.6's grammar: unscoped, or scoped
//     (`@scope/name`), each segment a run of lowercase ASCII letters,
//     digits, `-`, `.`, and `_` beginning with a letter or a digit, its
//     lead weighted toward a digit (digit-first segments); its length drawn
//     from four classes (P17_LENGTH_CLASSES), the last 7.6's bound of 214
//     characters itself; and its last segment weighted toward holding a
//     `.`, so that S — N cut before the first `.` of its last segment —
//     differs from N, what follows that `.` drawn as a run of the alphabet
//     (possibly empty: `a.`) or as one of the file extensions TypeScript and
//     Node.js read in a specifier (P17_EXTENSION_SUFFIXES: `js`, `d.ts`,
//     `json`, `node`, …), the lookups Reach's nothing-nearer condition
//     guards. Never an `@types` name, an `@typescript` name beginning
//     `lib-`, or a name a release E-1 lists resolves to a built-in module:
//     a draw falling there is mended by construction — the scope's leading
//     `t` made `u` (`@types/…` drawn as `@uypes/…`), and a `-` appended to
//     an unscoped name P17_NODE_BUILT_IN_NAMES holds (`fs` drawn as `fs-`).
//     Those names are the 42 that every listed release resolves to its own
//     built-in modules without the `node:` scheme (its newer built-ins,
//     `node:test` and `node:sqlite` among them, are reached through that
//     scheme alone), and the drawn release itself confirms on every draw
//     that it resolves N to none (below);
//   * the placement form: a copy at `node_modules/N`, or a symbolic link
//     there to a copy elsewhere in the staging, under no `node_modules`
//     (helpers/module-channel.ts `ModuleStaging.place`);
//   * the holding directory: the importing files' own directory,
//     P17_IMPORTING_DIR (`outer/inner/project`), or, at even odds, one of
//     its three ancestors, the staging root the farthest;
//   * a covered setup of 7.6's matrix (helpers/module-channel-ts.ts
//     `COVERED_SETUPS`: a project kind, the configuration file's
//     extension, and an option set), its option set's kind drawn first —
//     the initialized-project set, which covers 5 of the 173 setups, a
//     quarter of the time — then one of that kind's setups; and
//   * a release E-1 lists (test/node-releases.json, read at module load)
//     and one of Node.js's four routes, T7.6-6's (a static `import` and a
//     dynamic `import()` from an `.mjs`, a dynamic `import()` and `require`
//     from a `.cjs`).
//
// Each draw's files — T7.6-1's covered file (T7.6-2(d)'s), T7.6-2(a)'s
// file, and T7.6-3's unknown-top-level-key arm, beside N, exactly as
// T7.6-4's placements compose them (section-7.6.ts `placementFiles`) — are
// checked well-formed under the grammar their staged name selects before
// anything is staged (S-9; §16's preamble: `drawSources`, a failing draw a
// harness error reported with its seed). The body checks the package
// directory first (none given fails diagnosed before any draw, declining
// shrinking: H-8, S-7) and resolves every release E-1 lists (a missing one
// a harness error, E-1); then each draw runs in two fresh stagings (H-1),
// as T7.6-4's placements run their two halves, each holding the drawn
// setup's project kind in the importing files' directory as
// `ModuleStaging.stageProject` stages it, the drawn placement in the drawn
// holding directory, and nothing else (Reach's conditions verified, and
// nothing but the placement installed, before any tool runs):
//
//   * the type-checking half: the three files written under the drawn
//     setup's extension and judged in one program in the drawn setup
//     (helpers/module-channel-ts.ts, which falls back to a program per file
//     where the batch is unsound) — T7.6-1's listing declaring exactly
//     `defineConfig` (section-7.6.ts `assertDeclaredExports`), T7.6-2(a)'s
//     file type-checking (`assertTypeChecks`), and the arm failing to
//     type-check paired with it (`assertShapeViolation`; where (a)'s file
//     does not type-check the arm counts nowhere: §7.6 Pairing);
//   * the runtime half: the placement made on the drawn release's runtime
//     arm — the release itself asked whether it resolves N to a built-in
//     module, a yes a harness error (the generator let through a name it
//     never draws) — and one run along the drawn route on that release
//     (helpers/module-channel-node.ts `runModuleRoute`, under T7.6-6's run
//     conditions), which must load the module and end on its own with exit
//     code 0 (`assertModuleLoaded`), its exports exactly `defineConfig` and
//     `defineConfig` returning its argument (`exportsProblems`,
//     `identityProblems`: T7.6-6's (a) and (b), as T7.6-4 reads them).
//
// Both halves run on every draw: their diagnosed failures are collected,
// and the draw fails once, naming each (New-test conventions: many
// stagings); a harness error or a hang-guard kill propagates at once. A
// draw failing where nothing resolves — TypeScript resolving T7.6-1's
// import to no module it reads declarations from, and the load throwing —
// declines shrinking (helpers/assertions.ts): with Reach holding, both
// tools read the package's own manifest and files alone, whatever the
// draw, so no draw is expected to resolve where this one did not, and a
// shrink would only report an arbitrary counterexample, as for H-8's
// missing product (helpers/property.ts). S-7's stub package, whose manifest
// names no entry, so ends P-17 at its first draw. Every other failure
// shrinks, within P17_MAX_SHRINK_EXECUTIONS draws.
//
// No certification serves the module channel (CERTIFICATIONS.md, the
// defineConfig module's tests): P-17's draws reach no class without a
// deterministic anchor whose failure is loud — names, placement forms,
// holding directories, setups, releases, and routes by T7.6-4 and T7.6-6.
// test/self/p17-fixed-seed-draws.test.ts pins what the fixed seeds reach: a
// dotted last segment, an extension-like suffix, a scoped name, a
// digit-first segment, a 214-character name, both placement forms, each
// holding directory, each project kind, covered extension, and option-set
// kind, each release, and each route.

import * as fs from "node:fs";
import { fail, HarnessAssertionError } from "../../helpers/assertions.js";
import {
  MODULE_NAME_MAX_LENGTH,
  moduleNameExclusion,
  moduleNameGrammarProblem,
  modulePackageDirectory,
  ModuleStaging,
  runtimeArm,
  TYPE_CHECKING_ARM,
} from "../../helpers/module-channel.js";
import type {
  ModuleArm,
  Placement,
  PlacementForm,
} from "../../helpers/module-channel.js";
import {
  assertShapeViolation,
  assertTypeChecks,
  COVERED_SETUPS,
  stageCoveredFiles,
} from "../../helpers/module-channel-ts.js";
import type {
  CoveredSetup,
  CoveredVerdict,
  OptionSetKind,
} from "../../helpers/module-channel-ts.js";
import {
  assertModuleLoaded,
  describeRoute,
  exportsProblems,
  identityProblems,
  MODULE_ROUTES,
  runModuleRoute,
} from "../../helpers/module-channel-node.js";
import type { ModuleRoute } from "../../helpers/module-channel-node.js";
import {
  NODE_RELEASE_LIST_PATH,
  parseNodeReleaseList,
  resolveNodeReleases,
} from "../../helpers/node-releases.js";
import type { NodeRelease } from "../../helpers/node-releases.js";
import type { Choices, DrawSource } from "../../helpers/property.js";
import { checkProperty } from "../../helpers/property.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { guardSyncStep } from "../../helpers/step-guards.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import { assertDeclaredExports, placementFiles } from "./section-7.6.js";
import type { PlacementFile, PlacementFiles } from "./section-7.6.js";

/**
 * Trials per fixed seed (E-5): the default three seeds, each draw two
 * stagings, one TypeScript program, and two runs of a release (the
 * built-in check and the route's). test/self/p17-fixed-seed-draws.test.ts
 * replays exactly these.
 */
export const P17_RUNS_PER_SEED = 25;

/**
 * Shrink budget, in draws (helpers/property.ts): each costs a full draw,
 * about a third of a second against a conforming stand-in, so a failure
 * found on a long name has room to shrink.
 */
const P17_MAX_SHRINK_EXECUTIONS = 32;

/** `n` and `word`, pluralized. */
function count(n: number, word: string): string {
  return `${String(n)} ${word}${n === 1 ? "" : "s"}`;
}

// ---------------------------------------------------------------------------
// N (module header)

/** A segment's characters (SPEC 7.6): its lead, and the rest of its run. */
const LETTERS: readonly string[] = [..."abcdefghijklmnopqrstuvwxyz"];
const DIGITS: readonly string[] = [..."0123456789"];

/** N's length classes, simplest first: [least, most] characters. */
export type P17LengthClass = "short" | "medium" | "long" | "bound";

export const P17_LENGTH_CLASSES: Readonly<
  Record<P17LengthClass, readonly [number, number]>
> = {
  short: [1, 8],
  medium: [9, 40],
  long: [41, MODULE_NAME_MAX_LENGTH - 1],
  bound: [MODULE_NAME_MAX_LENGTH, MODULE_NAME_MAX_LENGTH],
};

const LENGTH_WEIGHTS: ReadonlyArray<readonly [number, P17LengthClass]> = [
  [6, "short"],
  [3, "medium"],
  [1, "long"],
  [2, "bound"],
];

/** How often N is scoped, and its last segment dotted. */
const SCOPED_PROBABILITY = 0.4;
const DOTTED_PROBABILITY = 0.5;

/**
 * File extensions TypeScript and Node.js read in a specifier, drawn after
 * the last segment's `.` (module header): each a run of 7.6's alphabet.
 */
export const P17_EXTENSION_SUFFIXES: readonly string[] = [
  "js",
  "mjs",
  "cjs",
  "jsx",
  "ts",
  "mts",
  "cts",
  "tsx",
  "d.ts",
  "d.mts",
  "d.cts",
  "json",
  "node",
  "wasm",
];

/**
 * The names every release E-1 lists resolves to its own built-in modules
 * without the `node:` scheme and that 7.6's grammar admits (module header:
 * each release's `require("node:module").builtinModules`, less the names
 * holding a `/` or beginning `_`, which the grammar bars). A draw never
 * stages one: an unscoped name drawn among them is mended by a `-`
 * appended.
 */
export const P17_NODE_BUILT_IN_NAMES: readonly string[] = [
  "assert",
  "async_hooks",
  "buffer",
  "child_process",
  "cluster",
  "console",
  "constants",
  "crypto",
  "dgram",
  "diagnostics_channel",
  "dns",
  "domain",
  "events",
  "fs",
  "http",
  "http2",
  "https",
  "inspector",
  "module",
  "net",
  "os",
  "path",
  "perf_hooks",
  "process",
  "punycode",
  "querystring",
  "readline",
  "repl",
  "stream",
  "string_decoder",
  "sys",
  "timers",
  "tls",
  "trace_events",
  "tty",
  "url",
  "util",
  "v8",
  "vm",
  "wasi",
  "worker_threads",
  "zlib",
];

/** A segment's lead: a letter, or — weighted toward it — a digit. */
function genLead(choices: Choices): string {
  return choices.pick(
    choices.weightedPick<readonly string[]>([
      [3, LETTERS],
      [2, DIGITS],
    ]),
  );
}

/** One character of a segment's run past its lead. */
function genRunCharacter(choices: Choices): string {
  return choices.pick(
    choices.weightedPick<readonly string[]>([
      [10, LETTERS],
      [4, DIGITS],
      [1, ["-"]],
      [1, ["_"]],
      [1, ["."]],
    ]),
  );
}

/** `length` characters of a segment's run. */
function genRun(choices: Choices, length: number): string {
  let run = "";
  for (let index = 0; index < length; index += 1) {
    run += genRunCharacter(choices);
  }
  return run;
}

/** A segment of `length` characters (at least one): its lead, then its run. */
function genSegment(choices: Choices, length: number): string {
  return genLead(choices) + genRun(choices, length - 1);
}

/**
 * N's last segment, `length` characters long: where it is at least two,
 * weighted toward a `.` after its lead, followed by an extension
 * TypeScript or Node.js reads in a specifier or by a run of the alphabet,
 * possibly empty (module header).
 */
function genLastSegment(choices: Choices, length: number): string {
  if (length < 2 || !choices.boolean(DOTTED_PROBABILITY)) {
    return genSegment(choices, length);
  }
  const room = length - 2;
  const extensions = P17_EXTENSION_SUFFIXES.filter(
    (suffix) => suffix.length <= room,
  );
  const suffix =
    extensions.length > 0 && choices.boolean(0.5)
      ? choices.pick(extensions)
      : genRun(choices, choices.intInclusive(0, room));
  return `${genSegment(choices, length - 1 - suffix.length)}.${suffix}`;
}

/**
 * N (module header): a name of 7.6's grammar outside its exclusions for
 * every release E-1 lists — unscoped or scoped, its length drawn from
 * P17_LENGTH_CLASSES (a scoped name at least four characters long), a
 * draw falling under an exclusion mended by construction.
 */
export function genP17Name(choices: Choices): string {
  const scoped = choices.boolean(SCOPED_PROBABILITY);
  const [least, most] =
    P17_LENGTH_CLASSES[choices.weightedPick(LENGTH_WEIGHTS)];
  const length = Math.max(choices.intInclusive(least, most), scoped ? 4 : 1);
  if (!scoped) {
    const name = genLastSegment(choices, length);
    return P17_NODE_BUILT_IN_NAMES.includes(name) ? `${name}-` : name;
  }
  const scopeLength = choices.intInclusive(1, length - 3);
  const drawnScope = genSegment(choices, scopeLength);
  const name = genLastSegment(choices, length - 2 - scopeLength);
  const excluded =
    drawnScope === "types" ||
    (drawnScope === "typescript" && name.startsWith("lib-"));
  const scope = excluded ? `u${drawnScope.slice(1)}` : drawnScope;
  return `@${scope}/${name}`;
}

// ---------------------------------------------------------------------------
// The draw (module header)

/**
 * The importing files' directory, staging-relative: three levels below the
 * staging root, so that the holding directory may be any of its three
 * ancestors.
 */
export const P17_IMPORTING_DIR = "outer/inner/project";

/** How many ancestors the importing files' directory has in the staging. */
export const P17_IMPORTING_DEPTH = P17_IMPORTING_DIR.split("/").length;

/**
 * The holding directory `level` levels above the importing files'
 * directory, staging-relative: its own at 0, the staging root (`""`) at
 * {@link P17_IMPORTING_DEPTH}.
 */
export function holdingDirOf(level: number): string {
  if (!Number.isInteger(level) || level < 0 || level > P17_IMPORTING_DEPTH) {
    throw new Error(
      `P-17: no holding directory lies ${String(level)} levels above ` +
        `${P17_IMPORTING_DIR} in the staging`,
    );
  }
  return P17_IMPORTING_DIR.split("/")
    .slice(0, P17_IMPORTING_DEPTH - level)
    .join("/");
}

/**
 * E-1's releases, in list order, read at module load from the one list CI
 * and the harness both read (helpers/node-releases.ts): what the generator
 * draws from. The body resolves each where the environment provisioned it.
 */
export const P17_RELEASE_VERSIONS: readonly string[] = guardSyncStep(
  `reading E-1's release list ${NODE_RELEASE_LIST_PATH} for P-17's draws`,
  () =>
    parseNodeReleaseList(
      fs.readFileSync(NODE_RELEASE_LIST_PATH, "utf8"),
      NODE_RELEASE_LIST_PATH,
    ),
);

/** One trial (module header). */
export interface P17Draw {
  /** N. */
  readonly name: string;
  readonly form: PlacementForm;
  /**
   * How many levels above the importing files' directory the holding
   * directory lies: 0 for that directory itself ({@link holdingDirOf}).
   */
  readonly holdingLevel: number;
  /** The covered setup, by its index in `COVERED_SETUPS`. */
  readonly setup: number;
  /** The release, by its version. */
  readonly release: string;
  readonly route: ModuleRoute;
}

/** The indices in `COVERED_SETUPS` of the setups of one option-set kind. */
function setupsOfKind(kind: OptionSetKind): readonly number[] {
  return COVERED_SETUPS.flatMap((setup, index) =>
    setup.optionSet.kind === kind ? [index] : [],
  );
}

/**
 * The covered setups by option-set kind (module header): the strict
 * defaults' 168, and the initialized-project set's 5, drawn a quarter of
 * the time so that the fixed seeds reach it.
 */
export const P17_STRICT_DEFAULT_SETUPS = setupsOfKind("strict defaults");
export const P17_INITIALIZED_PROJECT_SETUPS = setupsOfKind(
  "initialized-project options",
);

/** The generator (module header): simplest outcomes first, for shrinking. */
export function genP17Draw(choices: Choices): P17Draw {
  const name = genP17Name(choices);
  const form: PlacementForm = choices.boolean(0.5) ? "symlink" : "copy";
  const holdingLevel = choices.boolean(0.5)
    ? choices.intInclusive(1, P17_IMPORTING_DEPTH)
    : 0;
  const setup = choices.pick(
    choices.weightedPick<readonly number[]>([
      [3, P17_STRICT_DEFAULT_SETUPS],
      [1, P17_INITIALIZED_PROJECT_SETUPS],
    ]),
  );
  const release = choices.pick(P17_RELEASE_VERSIONS);
  const route = choices.pick(MODULE_ROUTES);
  return { name, form, holdingLevel, setup, release, route };
}

/** The drawn covered setup. */
export function p17Setup(draw: P17Draw): CoveredSetup {
  const setup = COVERED_SETUPS[draw.setup];
  if (setup === undefined) {
    throw new Error(
      `P-17: the draw names the covered setup ${String(draw.setup)}, which ` +
        `7.6's matrix of ${String(COVERED_SETUPS.length)} does not hold: a ` +
        "harness defect",
    );
  }
  return setup;
}

/** The drawn holding directory, in words. */
function describeHolding(draw: P17Draw): string {
  if (draw.holdingLevel === 0) {
    return `the importing files' own directory, ${P17_IMPORTING_DIR}`;
  }
  const holding = holdingDirOf(draw.holdingLevel);
  return (
    `${holding === "" ? "the staging root" : holding}, ` +
    `${count(draw.holdingLevel, "level")} above the importing files' ` +
    `directory ${P17_IMPORTING_DIR}`
  );
}

/** A draw, in words, for a diagnosis and a counterexample. */
export function renderP17Draw(draw: P17Draw): string {
  const setup = COVERED_SETUPS[draw.setup];
  return (
    `N ${JSON.stringify(draw.name)} (${String(draw.name.length)} ` +
    `characters), ${
      draw.form === "copy"
        ? "a copy at node_modules/N"
        : "node_modules/N a symbolic link to a copy elsewhere in the staging"
    }, held in ${describeHolding(draw)}; ${
      setup === undefined
        ? `covered setup ${String(draw.setup)} (none such)`
        : setup.label
    }; the Node.js release ${draw.release} along ${describeRoute(draw.route)}`
  );
}

// ---------------------------------------------------------------------------
// The draw's files, and S-9 (module header)

/** The three files beside each N drawn so far, composed once per N. */
const composed = new Map<string, PlacementFiles>();

/** The files beside `name` (section-7.6.ts `placementFiles`). */
function p17Files(name: string): PlacementFiles {
  let files = composed.get(name);
  if (files === undefined) {
    files = placementFiles(name);
    composed.set(name, files);
  }
  return files;
}

/** The three files in the order the type-checking half stages them. */
function filesInOrder(files: PlacementFiles): readonly PlacementFile[] {
  return [files.declaredExports, files.valid, files.unknownKey];
}

/**
 * S-9's per-draw check (module header): the draw's three files, each under
 * the name the drawn setup's extension gives it, so that S-9 judges each
 * under the grammar its staging selects (TSX for `.tsx`).
 */
export function stagedP17Sources(draw: P17Draw): readonly DrawSource[] {
  const { extension } = p17Setup(draw);
  return filesInOrder(p17Files(draw.name)).map(
    (file) => [`covered-file${extension}`, file.text, file.label] as const,
  );
}

/**
 * A name holding every character N may hold — scoped, one segment led by a
 * letter and one by a digit, `-`, `.`, and `_` in each, and an
 * extension-like suffix — for S-9's fixed vectors.
 */
const P17_VECTOR_NAME = "@a0-._/9z-_.d.ts";

/**
 * S-9's fixed TypeScript vectors (test/self/s9-typescript-well-formedness
 * .test.ts): the three files beside {@link P17_VECTOR_NAME}, as plain
 * TypeScript and as TSX — the files P-17 composes beside any N, through
 * the composition its draws are staged with.
 */
export const P17_TS_FORM_VECTORS: ReadonlyArray<
  readonly [name: string, path: string, source: string | Uint8Array]
> = filesInOrder(placementFiles(P17_VECTOR_NAME)).flatMap((file) =>
  ["xspec.config.ts", "xspec.config.tsx"].map(
    (path) =>
      [
        `P-17 configuration (${file.label}, importing ` +
          `${JSON.stringify(P17_VECTOR_NAME)}, as ` +
          `${path.endsWith(".tsx") ? "TSX" : "plain TypeScript"})`,
        path,
        file.text,
      ] as const,
  ),
);

/**
 * The generator's tables (module header), held at module load: each
 * built-in name and the suffixes runs of 7.6's alphabet, a mended
 * built-in name of the grammar and no built-in name itself, the importing
 * directory three levels deep, the vector name of the grammar, and E-1's
 * list read. A deviation is a harness defect, thrown at module load.
 */
function checkP17Tables(): void {
  const problems: string[] = [];
  const need = (held: boolean, problem: string): void => {
    if (!held) problems.push(problem);
  };
  const alphabet = new Set([...LETTERS, ...DIGITS, "-", ".", "_"]);
  for (const name of P17_NODE_BUILT_IN_NAMES) {
    need(
      moduleNameGrammarProblem(name) === null && !name.startsWith("@"),
      `the built-in name ${name} is an unscoped name of 7.6's grammar`,
    );
    const mended = `${name}-`;
    need(
      moduleNameGrammarProblem(mended) === null &&
        !P17_NODE_BUILT_IN_NAMES.includes(mended),
      `the mended name ${mended} is a name of 7.6's grammar and no built-in`,
    );
  }
  for (const suffix of P17_EXTENSION_SUFFIXES) {
    need(
      suffix.length > 0 && [...suffix].every((c) => alphabet.has(c)),
      `the suffix ${suffix} is a run of 7.6's alphabet`,
    );
  }
  need(
    P17_IMPORTING_DEPTH === 3 &&
      holdingDirOf(P17_IMPORTING_DEPTH) === "" &&
      holdingDirOf(0) === P17_IMPORTING_DIR,
    `the importing files' directory ${P17_IMPORTING_DIR} lies three levels ` +
      "below the staging root",
  );
  need(
    moduleNameGrammarProblem(P17_VECTOR_NAME) === null &&
      moduleNameExclusion(P17_VECTOR_NAME) === null,
    `the vector name ${P17_VECTOR_NAME} is a name of 7.6's grammar outside ` +
      "its exclusions",
  );
  need(P17_RELEASE_VERSIONS.length > 0, "E-1's list names a release");
  need(
    COVERED_SETUPS.length === 173 &&
      P17_STRICT_DEFAULT_SETUPS.length === 168 &&
      P17_INITIALIZED_PROJECT_SETUPS.length === 5,
    "7.6's matrix holds 173 covered setups, 168 under the strict defaults " +
      `and 5 under the initialized-project options, not ` +
      `${String(COVERED_SETUPS.length)}, ${String(P17_STRICT_DEFAULT_SETUPS.length)}, ` +
      `and ${String(P17_INITIALIZED_PROJECT_SETUPS.length)}`,
  );
  if (problems.length > 0) {
    throw new Error(
      `P-17: its generator's tables deviate: ${problems.join("; ")}: a ` +
        "harness defect",
    );
  }
}

checkP17Tables();

// ---------------------------------------------------------------------------
// The body (module header)

/** Leads every diagnosis. */
const P17_CONTEXT = "P-17 (installation names)";

/** TEST-SPEC P-17's rule, closing a draw's failure. */
const P17_RULE =
  "(TEST-SPEC P-17: N drawn from 7.6's grammar outside its exclusions, " +
  "crossed with a drawn placement form, holding directory, covered setup, " +
  "release, and route, every condition of Reach holding: T7.6-1's exports " +
  "assertion holds, T7.6-2(a)'s file type-checks with T7.6-3's " +
  "unknown-top-level-key arm paired to it, and T7.6-6's exports and " +
  "identity assertions hold along the drawn route; SPEC 7.6 Package and " +
  "installation — a copy, a symbolic-link install, and an aliased install " +
  "are alike — and Reach)";

/** What one half of a draw found (module header). */
interface HalfOutcome {
  /** Each failing run's diagnosis, in order. */
  readonly failures: readonly string[];
  /**
   * Whether nothing resolved there: TypeScript resolving T7.6-1's import
   * to no module it reads declarations from, or the load throwing.
   */
  readonly nothingResolved: boolean;
}

/** Each failing assertion's diagnosis, in order: none where all hold. */
function failuresOf(checks: readonly (() => void)[]): readonly string[] {
  const failures: string[] = [];
  for (const check of checks) {
    try {
      check();
    } catch (error) {
      if (!(error instanceof HarnessAssertionError)) throw error;
      failures.push(error.message);
    }
  }
  return failures;
}

/**
 * Stage `draw` in `staging` for `arm` (module header): the drawn setup's
 * project kind in the importing files' directory, then the drawn placement
 * in the drawn holding directory.
 */
async function stageDraw(
  staging: ModuleStaging,
  draw: P17Draw,
  setup: CoveredSetup,
  arm: ModuleArm,
): Promise<Placement> {
  await staging.stageProject(P17_IMPORTING_DIR, setup.project);
  return staging.place({
    name: draw.name,
    holdingDir: holdingDirOf(draw.holdingLevel),
    arm,
    form: draw.form,
  });
}

/**
 * A draw's type-checking half (module header): T7.6-1's covered file,
 * T7.6-2(a)'s file, and T7.6-3's unknown-top-level-key arm judged in the
 * drawn setup, beside the drawn placement.
 */
async function typeCheckingHalf(
  product: ProductBinding,
  draw: P17Draw,
  setup: CoveredSetup,
  context: string,
): Promise<HalfOutcome> {
  const half = `${context}, its type-checking runs`;
  const staging = await ModuleStaging.create(product, half);
  try {
    const placement = await stageDraw(staging, draw, setup, TYPE_CHECKING_ARM);
    const covered = await stageCoveredFiles({
      staging,
      directory: P17_IMPORTING_DIR,
      project: setup.project,
      placement,
      alone: true,
      files: filesInOrder(p17Files(draw.name)),
      setups: [setup],
      listExports: true,
      context: half,
    });
    const verdicts: readonly CoveredVerdict[] = covered.judge(setup);
    const [listed, valid, arm] = verdicts;
    if (listed === undefined || valid === undefined || arm === undefined) {
      throw new Error("unreachable: three verdicts");
    }
    const failures = failuresOf([
      () => {
        assertDeclaredExports(listed, "T7.6-1's run");
      },
      () => {
        assertTypeChecks(valid, "T7.6-2(a)'s run");
      },
      () => {
        if (!valid.typeChecks) {
          fail(
            "T7.6-3's run: its unknown-top-level-key arm counts nowhere " +
              "here, its valid twin, T7.6-2(a)'s file, not type-checking " +
              "(TEST-SPEC §7.6 Pairing)",
          );
        }
        assertShapeViolation(valid, arm, "T7.6-3's run");
      },
    ]);
    return {
      failures,
      nothingResolved: listed.exportListing?.module === undefined,
    };
  } finally {
    await staging.dispose();
  }
}

/**
 * A draw's runtime half (module header): one run along the drawn route on
 * the drawn release, beside the drawn placement made on that release's
 * runtime arm, read for T7.6-6's exports and identity.
 */
async function runtimeHalf(
  product: ProductBinding,
  draw: P17Draw,
  setup: CoveredSetup,
  release: NodeRelease,
  context: string,
): Promise<HalfOutcome> {
  const half = `${context}, its runtime run`;
  const staging = await ModuleStaging.create(product, half);
  try {
    const placement = await stageDraw(
      staging,
      draw,
      setup,
      runtimeArm([release]),
    );
    const run = await runModuleRoute({
      staging,
      placement,
      route: draw.route,
      release,
      importingDir: P17_IMPORTING_DIR,
      project: setup.project,
      alone: true,
      context: half,
    });
    let loaded;
    try {
      loaded = assertModuleLoaded(run, "product");
    } catch (error) {
      if (!(error instanceof HarnessAssertionError)) throw error;
      return {
        failures: [`T7.6-6's run: ${error.message}`],
        nothingResolved: run.outcome === "load-failed",
      };
    }
    const problems = [...exportsProblems(loaded), ...identityProblems(loaded)];
    return {
      failures:
        problems.length === 0
          ? []
          : [
              `T7.6-6's run, which loaded the module and ended on its own ` +
                `with exit code 0: ${problems.join("; ")}`,
            ],
      nothingResolved: false,
    };
  } finally {
    await staging.dispose();
  }
}

/**
 * One draw (module header): both halves, then one diagnosed failure naming
 * each failing run, declining shrinking where nothing resolved in either.
 */
async function runP17Draw(
  product: ProductBinding,
  releases: ReadonlyMap<string, NodeRelease>,
  draw: P17Draw,
): Promise<void> {
  const setup = p17Setup(draw);
  const release = releases.get(draw.release);
  if (release === undefined) {
    throw new Error(
      `P-17: the draw names the release ${draw.release}, which E-1's list ` +
        `as resolved does not hold: a harness defect`,
    );
  }
  const context =
    `${P17_CONTEXT}, N ${JSON.stringify(draw.name)}, ` +
    `${draw.form === "copy" ? "a copy" : "a symbolic link"} held in ` +
    describeHolding(draw);
  const typeChecking = await typeCheckingHalf(product, draw, setup, context);
  const runtime = await runtimeHalf(product, draw, setup, release, context);
  const failures = [...typeChecking.failures, ...runtime.failures];
  if (failures.length === 0) return;
  const nothingResolves =
    typeChecking.nothingResolved && runtime.nothingResolved;
  fail(
    `${P17_CONTEXT}: ${String(failures.length)} of the draw's 4 runs — ` +
      "T7.6-1's, T7.6-2(a)'s, T7.6-3's arm's, and T7.6-6's — " +
      `${failures.length === 1 ? "fails" : "fail"} ${P17_RULE}` +
      (nothingResolves
        ? ". Nothing resolves here — TypeScript resolves the import to no " +
          "module it reads declarations from, and the load throws — a " +
          "failure no draw meeting Reach is expected to change, since both " +
          "tools then read the package's own manifest and files alone, so " +
          "it is reported as drawn, unshrunk"
        : "") +
      `: ${failures.join(" | ")}`,
    { shrinkable: !nothingResolves },
  );
}

/**
 * P-17's body (module header): the package directory checked and every
 * release E-1 lists resolved before any draw, then the property.
 */
async function runP17(product: ProductBinding): Promise<void> {
  await modulePackageDirectory(product, P17_CONTEXT);
  const resolved = await resolveNodeReleases();
  const versions = resolved.map((release) => release.version);
  if (versions.join(", ") !== P17_RELEASE_VERSIONS.join(", ")) {
    throw new Error(
      `P-17: the releases resolved (${versions.join(", ")}) are not those ` +
        `its draws name (${P17_RELEASE_VERSIONS.join(", ")}), though both ` +
        "come from E-1's one list: a harness defect",
    );
  }
  const releases = new Map(
    resolved.map((release): [string, NodeRelease] => [
      release.version,
      release,
    ]),
  );
  await checkProperty(
    "P-17 installation names",
    genP17Draw,
    (draw) => runP17Draw(product, releases, draw),
    {
      runs: P17_RUNS_PER_SEED,
      maxShrinkExecutions: P17_MAX_SHRINK_EXECUTIONS,
      render: renderP17Draw,
      drawSources: stagedP17Sources,
    },
  );
}

// ---------------------------------------------------------------------------
// Registration

const P_17 = defineProductTest({
  id: "P-17",
  title:
    "installation names (TEST-SPEC §16 P-17): seeded draws of N from 7.6's " +
    "grammar — unscoped and scoped, each segment a run of lowercase " +
    "letters, digits, -, ., and _ beginning with a letter or digit, " +
    "weighted toward a . in the last segment (S then differing from N, " +
    "what follows it a run or a file extension such as js or d.ts), " +
    "digit-first segments, and lengths up to the 214-character bound — " +
    "never an @types name, an @typescript/lib- name, or a name the drawn " +
    "release resolves to a built-in module, each crossed with a drawn " +
    "placement form (a copy, or a symbolic link to a copy elsewhere in the " +
    "staging), a drawn holding directory (the importing files' own, or one " +
    "of its ancestors up to the staging root), a covered setup drawn from " +
    "7.6's matrix, and a release E-1 lists and a route drawn from T7.6-6's, " +
    "every condition of Reach holding and each draw's files checked " +
    "well-formed before staging (S-9): in the drawn setup, T7.6-1's " +
    "covered file's import reaches a module declaring exactly defineConfig, " +
    "T7.6-2(a)'s file type-checks, and T7.6-3's unknown-top-level-key arm " +
    "fails to type-check paired with it; and along the drawn route on the " +
    "drawn release, the module loads, the process ending on its own with " +
    "exit code 0, its exports exactly defineConfig and defineConfig " +
    "returning its argument (T7.6-6 (a), (b)) (SPEC 7.6 Package and " +
    "installation, Reach; E-5)",
  run: runP17,
});

/** TEST-SPEC §16 P-17. */
export const section16P17Tests: readonly ProductTestEntry[] = [P_17];
