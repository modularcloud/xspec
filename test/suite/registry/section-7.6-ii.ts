// TEST-SPEC §7.6 (the `defineConfig` module), second part — the placements
// and the runtime: T7.6-4, placements; T7.6-6, runtime exports and
// identity; and T7.6-7, runtime: no effect. T7.6-1, T7.6-2, and T7.6-3, the
// type contract, are section-7.6.ts's business; T7.6-5, P-17, and P-18 are
// not registered yet.
//
// 7.6 is tested through H-2's module channel alone (TEST-SPEC §7.6's four
// rules: Placement, Covered setups, Verdict, Pairing). A body here never
// invokes the `xspec` executable: it places the product's package
// directory, the binding's `packageDir`, in fresh stagings — under the
// canonical placement, or, for T7.6-4, under each of its placements
// (helpers/module-channel.ts) — and loads the `defineConfig` module there
// on the Node.js releases E-1 provisions (helpers/node-releases.ts) through
// the module channel's release driver (helpers/module-channel-node.ts and
// its bootstrap), T7.6-4 also type-checking covered files there through the
// TypeScript driver (helpers/module-channel-ts.ts), as T7.6-1–3's bodies
// do (T7.6-4 at the end of this header). The driver runs each
// release under T7.6-6's run conditions — no option, and an environment of
// exactly a fresh `HOME` and `TMPDIR` and the harness's `PATH`, so no
// `NODE_OPTIONS` and no `NODE_PATH`, and with them no user condition and no
// loader or customization hook — checks them on every report, and makes
// T7.6-6's and T7.6-7's observations inside the run and around it; S-10
// pins it on committed stand-ins (test/self/s10-node-release-driver.test.ts).
// With no package directory given, the body fails diagnosed before
// anything is staged (H-8: the module channel counts as part of the
// product); a listed release the environment has not provisioned is a
// harness error (E-1, H-11), never a skip or a product failure.
//
// T7.6-6 (SPEC 7.6 Runtime, Reach): on each release E-1 provisions — a
// release of 22.0–22.11, on which `require` cannot load an ES module
// without a flag, among them — the module is loaded along each of Node.js's
// routes from a harness-written importing module in the importing file's
// place: a static `import` from an ES module (`.mjs`), a dynamic `import()`
// from an ES module and from a CommonJS module (`.cjs`), and `require` from
// a CommonJS module. In each run:
// - (a) exports: an `import` namespace's own string-keyed properties are
//   exactly `defineConfig` — a CommonJS-only entry, whose namespace carries
//   `default`, fails — and a `require` result's own enumerable properties,
//   string- and symbol-keyed alike, are exactly `defineConfig` — an
//   enumerable `__esModule` fails (the driver's `exportsProblems`);
// - (b) identity: `defineConfig(v)` returns `v` itself, compared by
//   SameValue, for an object, an array, a function, a symbol, `null`,
//   `undefined` passed explicitly, a string, a boolean, a bigint, and the
//   numbers `0`, `-0`, and `NaN`; a call with no argument returns
//   `undefined`; and a call with a further argument returns its first
//   (`identityProblems`);
// - (c) no examination, copy, or modification: called with a Proxy over a
//   function whose every trap records its invocation and a second such
//   Proxy, `defineConfig` returns the first Proxy itself with no trap of
//   either invoked through the run's end; called with a frozen object, it
//   returns that object without throwing (`examinationProblems`).
//
// T7.6-7 (SPEC 7.6 Runtime: beyond the runtime's own resolution of the
// specifier and loading of the package's files, neither loading the module
// nor calling `defineConfig` has any effect): in T7.6-6's runs, loading the
// module and making T7.6-6's calls have no effect:
// - (a) output: standard output is empty, and standard error is exactly the
//   release's printed forms of the process warnings the run emits, in
//   order, as the runtime delivers them to the `warning` listener the
//   bootstrap registers on `process` before the importing module's own
//   loading begins — each in the form learned from the release itself —
//   and no captured warning's stack begins in the package's files, its
//   first frame naming one of them (the driver's output oracle,
//   `runtimeOutputProblems`). The release's own warnings in resolving the
//   specifier and loading the package's files — the experimental warning
//   for loading an ES module through `require`, DEP0128, DEP0151 — begin
//   their stacks outside the package's files, so 7.6's exception admits
//   them; text the module writes to either stream, in the warning form or
//   not, has no captured warning behind it, so it fails, as does a warning
//   the module emits through the runtime's warning facility;
// - (b) writes: no entry is created, modified, or removed in the staging,
//   the placement included, in the run's working directory, or in its
//   fresh `HOME` and `TMPDIR`, each compared entry by entry just before and
//   just after the run, a plain file by its bytes as well and a FIFO by its
//   kind alone, never opened (`writeProblems`);
// - (c) process state: unchanged across the load and the calls, as the
//   bootstrap compares the state read before the importing module's own
//   loading begins — the `warning` listener already registered — with the
//   state once T7.6-6's calls are made: the global object's own properties
//   with their descriptors, the built-ins' own properties, each observed
//   object's extensibility and prototype, `process`'s own properties,
//   `process.env`, the process title, the working directory,
//   `process.exitCode`, the `write` each standard stream resolves to, the
//   listeners registered on `process`, and the pending timers and handles
//   (`stateProblems`);
// - (d) network: the environment's — every run inherits the network-denied
//   namespace CI's Linux jobs run in (E-1), so an attempted access fails
//   rather than reaching a network; nothing here observes it;
// - (e) reads: FIFOs named `xspec.config.ts` in the run's working
//   directory, in the importing module's directory, and in its `HOME`, each
//   afterwards still a FIFO in place (`fifoProblems`) and unopened — a run
//   that opens one blocks until its guard, whose kill propagates and ends
//   the test (S-3), so every run ending within its guard is all
//   "unopened" asserts.
// Each of T7.6-7's absences counts only under §7.6's pairing: each of its
// readings reports first, where unmet, that the run never saw
// `defineConfig` return its argument in every one of T7.6-6's calls (the
// driver's `pairingProblem`), so a stub package fails every arm. The rest
// of T7.6-7's read, write, network, state, and output clauses admits no
// discriminating staging (its closing sentences): nothing is asserted
// there.
//
// Conservative operationalizations of T7.6-6 and T7.6-7 (noted per H-4):
// - One staging per test: a CommonJS project whose `package.json` holds no
//   `type` (`project/`), beside the canonical placement — a copy at
//   `node_modules/N` in the project's directory, the importing file's own,
//   N the canonical name, which differs from the name the package's
//   manifest gives, so the install is an aliased one — nothing else
//   installed. The project kind bears on no route: each importing module's
//   kind is fixed by its extension, whatever any `package.json` says, and
//   no manifest in the importing file's directory or its ancestors gives a
//   `name`, so none is a self-reference. It is the staging S-10's checks
//   pin the driver on.
//   Before each run the driver verifies Reach — the project kind and
//   nothing else installed among it — and H-1 under the run's exact
//   environment; an unmet condition is a harness error.
// - The releases: every release E-1 lists, in list order, resolved once
//   the package directory has been checked. The body confirms that one of
//   them is a 22.0–22.11 release, as T7.6-6 names one among them (a list
//   lacking one is a harness defect), and the placement confirms that none
//   resolves N to a built-in module. The routes: the driver's four, in
//   T7.6-6's order. One run per release and route, one after another — 24
//   for E-1's six releases — each route's importing module written once in
//   the project's directory and found byte-equal there by every later
//   release's run.
// - T7.6-6 and T7.6-7 share one body (`runRuntimeRuns`), each test making
//   its own runs, as each registered test runs alone on a fresh staging
//   (H-1): T7.6-7's runs are runs of T7.6-6's shape — the same staging,
//   releases, routes, and run conditions, the bootstrap making T7.6-6's
//   calls in every run — each also observing its effects (the driver's
//   `effects`: the three FIFOs staged before it, the staging, the working
//   directory, `HOME`, and `TMPDIR` snapshotted just before and just after
//   it). Of T7.6-6's observations, T7.6-7 reads the calls' returns alone,
//   for its pairing, and T7.6-6 reads none of T7.6-7's. A run observing its
//   effects compares the whole staging, so each run is prepared, launched,
//   and disposed of before the next, never beside another.
// - Each run must load the module and end on its own with exit code 0 (the
//   driver's `assertModuleLoaded`, the conservative reading: the route's
//   load is its whole run, so a process ending otherwise — a crash, a
//   signal, an exit the package forces — loaded nothing cleanly, whatever
//   its report holds). Otherwise the run is reported as what it came to —
//   the load threw (a missing entry, a `require` refused), the process
//   ended before the load completed or during T7.6-6's calls, or it left no
//   report — with its streams, a diagnosed failure (H-8). The body stops at
//   the first such run, its diagnosis naming the problems the runs before
//   it found, so S-7's stub package ends it at its first run.
// - On each run that loaded, the test's observations are read as problems
//   in words, never thrown, and collected across every run; once all have
//   run, the body fails once, diagnosed, naming each distinct problem in
//   full with the runs it was found in (New-test conventions: many
//   stagings) — a run's own directory, which holds its working directory,
//   `HOME`, and `TMPDIR` and differs from run to run, written
//   `<run directory>`, so that a write into `TMPDIR` made in every run is
//   one problem found in each. A harness error, and a run's hang-guard
//   kill (S-3), propagate at once.
//
// T7.6-4 (SPEC 7.6 Package and installation: a copy, a symbolic-link
// install, and an aliased install are alike; Reach): each placement below
// stands in for the canonical one in a run of T7.6-1, of T7.6-2(a) with
// T7.6-3's unknown-top-level-key arm paired to it in every covered setup,
// and of T7.6-6's exports and identity assertions ((a) and (b)) along every
// route on every release E-1 provisions, and fares as the canonical
// placement does:
// - (a) a copy under the `name` the package's manifest gives (the
//   non-aliased install), wherever that is a name of 7.6's grammar outside
//   its exclusions;
// - (b) `node_modules/N` a symbolic link to a copy of the package directory
//   placed elsewhere in the staging, under no `node_modules`;
// - (c) names across 7.6's grammar: a scoped name, a name beginning with a
//   digit, a name holding `-` and `_`, the dotted names `a.js` and `a.b`,
//   whose `S` differs from N (each beside an unrelated package at
//   `node_modules/a`, which Reach does not bar, and no `a.ts` beside
//   `a.js`), and an unscoped and a scoped name each exactly 214 characters
//   long;
// - (d) the holding directory a strict ancestor of the importing file's
//   directory, and, separately, an ancestor of the file's physical path
//   alone — the file's directory also reachable through a symbolic link
//   elsewhere in the staging, on whose path that ancestor does not lie —
//   each tool given the physical path;
// - (e) other packages installed — TypeScript 5.9.3's package at
//   `node_modules/typescript` and an unrelated package beside the
//   placement, and, the holding directory a strict ancestor, an unrelated
//   package in the importing file's own directory — none an `@types`
//   package;
// - (f) in the type-checking runs alone, N `fs`, and separately `path`,
//   names the provisioned releases resolve to built-in modules.
//
// Conservative operationalizations of T7.6-4 (noted per H-4):
// - "Fares as the canonical placement does" is read as each of those runs'
//   assertions holding under the placement as T7.6-1, T7.6-2, T7.6-3, and
//   T7.6-6 require them to hold under the canonical one — never as a
//   comparison with the canonical placement's own outcome, under which a
//   missing or stub package, failing everywhere alike, would pass (H-8,
//   S-7).
// - One registered test, one body (`runPlacements`), here beside the
//   runtime tests whose runs it shares: the package directory checked
//   first (none given fails diagnosed, before anything is staged), every
//   release E-1 lists resolved, then each placement in TEST-SPEC's order
//   (`T764_PLACEMENTS`), its type-checking half, then its runtime half.
//   Each half makes stagings of its own, made as the canonical placement's
//   are but for what the placement varies; nothing is shared across
//   placements but parsed libraries and their diagnostics (the TypeScript
//   driver's header), since a placement's package files lie elsewhere.
// - The type-checking half: one staging per project kind, the importing
//   files' directory staged as that project; in it T7.6-1's covered file
//   (T7.6-2(d)'s, its export listing asked), T7.6-2(a)'s file, and T7.6-3's
//   unknown-top-level-key arm, written under each covered extension, Reach
//   verified for each, and judged in one program per covered setup of the
//   project — a batch TEST-SPEC §7.6 allows, the three importing the same
//   module, which the driver confirms on each program, falling back to a
//   program per file — in all 173 setups: T7.6-1's listing read through
//   section-7.6.ts's `assertDeclaredExports`, (a)'s file type-checking, and
//   the arm failing to type-check paired with it (`assertShapeViolation`;
//   where (a)'s file does not type-check, the arm counts nowhere there).
//   The files are those tests' own, N aside (section-7.6.ts
//   `placementFiles`, which confirms at module load that beside the
//   canonical candidates its bytes are their records').
// - The runtime half: one staging, the importing files' directory staged as
//   a CommonJS project, as T7.6-6's is, and T7.6-6's 24 runs from it — the
//   same driver, run conditions, routes, and releases (`runRoutes`) — each
//   read for T7.6-6's exports and identity (`exportsProblems`,
//   `identityProblems`), never its (c), which T7.6-4 does not name.
// - N: (b), (d), and (e) place the canonical N (helpers/module-channel.ts
//   `canonicalModuleName`), varying only what they name. (c)'s names are
//   fixed here: `@staged-scope/config-module`, `7config`,
//   `staged-config_module`, `a.js`, `a.b`, a 214-character unscoped name,
//   and a 214-character name in the scope `@long-scope`, none a canonical
//   candidate; a module-load check (`checkT764Placements`) holds the list to
//   T7.6-4's — its arms' counts, each name's feature and its place in 7.6's
//   grammar outside the exclusions, the runtime halves, and `alone`.
//   (a)'s N is the manifest's `name`, read strictly (helpers/module-channel.ts
//   `readManifestName`); where the manifest gives none, or one outside 7.6's
//   grammar or under an exclusion every arm has, (a) is not staged, as
//   TEST-SPEC stages it only where it is such a name; its runtime half runs
//   on each release that resolves that N to no built-in module, each
//   release asked, and on none where every release does. On every other
//   runtime half the placement itself confirms that no release resolves N
//   to a built-in module.
// - Layouts (`T764_LAYOUTS`), staging-relative: the canonical one, the
//   importing files and the holding directory both `project/`; for (d)'s
//   first placement and (e)'s second, the files in `ancestor/project/` and
//   the placement in `ancestor/`; for (d)'s second, the files in
//   `physical/project/` and the placement in `physical/`, with a symbolic
//   link at `linked/project` reaching the files' directory — each tool
//   given the files by their physical paths, as Reach's physical naming has
//   it, which the staging verifies.
// - Other packages: an unrelated package is a directory of the harness's
//   writing — a manifest naming it, a CommonJS `index.js`, and its
//   `index.d.ts` — which nothing imports, so a resolution straying into it
//   (`a` for `a.js`) fails loud, its exports differing; TypeScript's
//   package is a copy, entry by entry, of the harness's own
//   `typescript-5.9.3` directory, the release the TypeScript driver runs,
//   its manifest confirmed to name `typescript` at 5.9.3 — never a link out
//   of the staging. Neither is an `@types` package, and the TypeScript
//   driver refuses any program something else enters (the program
//   condition).
// - Reach is verified for each written file and before each run, the
//   project kind confirmed, and, where nothing else is installed — (a),
//   (b), (c)'s undotted names, (d), and (f) — that the placement is alone;
//   an unmet condition is a harness error.
// - S-9: the files beside each fixed N — the canonical candidates and every
//   fixed name — are staged-source records made at module load, as plain
//   TypeScript and as TSX of the same bytes. (a)'s files, whose N only the
//   package's manifest gives, are composed at run time by the same
//   composition (a generated form, the records its vector set) and judged
//   well-formed under both grammars before anything is staged, a failure a
//   harness error.
// - The body stops at its first failure, diagnosed, naming the placement,
//   N, and the placements that held before it: in a type-checking half, the
//   first covered setup where any of the three runs fails, every failing
//   run's diagnosis given; in a runtime half, the first run that does not
//   load the module and end on its own with exit code 0, or, once its 24
//   runs are made, the problems they found (T7.6-6's reading). So S-7's
//   stub package ends the body at (a)'s first setup, and a missing package
//   directory before anything is staged.

import * as fsp from "node:fs/promises";
import * as path from "node:path";
import ts from "typescript-5.9.3";
import { fail, HarnessAssertionError } from "../../helpers/assertions.js";
import {
  builtInNamesOn,
  CANONICAL_MODULE_NAMES,
  canonicalModuleName,
  MODULE_NAME_MAX_LENGTH,
  moduleNameExclusion,
  moduleNameGrammarProblem,
  modulePackageDirectory,
  ModuleStaging,
  PROJECT_KINDS,
  readManifestStrictly,
  runtimeArm,
  TYPE_CHECKING_ARM,
} from "../../helpers/module-channel.js";
import type {
  ModuleArm,
  PackageDirectory,
  Placement,
  PlacementForm,
  ProjectKind,
} from "../../helpers/module-channel.js";
import {
  assertShapeViolation,
  assertTypeChecks,
  COVERED_SETUP_COUNT,
  stageCoveredFiles,
} from "../../helpers/module-channel-ts.js";
import {
  assertModuleLoaded,
  examinationProblems,
  exportsProblems,
  fifoProblems,
  identityProblems,
  MODULE_ROUTES,
  RUN_FIFO_NAME,
  runModuleRoute,
  runtimeOutputProblems,
  stateProblems,
  writeProblems,
} from "../../helpers/module-channel-node.js";
import type {
  LoadedModuleRun,
  ModuleRoute,
  ModuleRun,
} from "../../helpers/module-channel-node.js";
import { resolveNodeReleases } from "../../helpers/node-releases.js";
import type { NodeRelease } from "../../helpers/node-releases.js";
import { HarnessStagingError } from "../../helpers/permissions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { stagedTs } from "../../helpers/staged-ts.js";
import type { StagedTs } from "../../helpers/staged-ts.js";
import { guardStep } from "../../helpers/step-guards.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import {
  judgeTypeScript,
  tsDeclarationProblem,
} from "../../helpers/ts-derivability.js";
import { assertDeclaredExports, placementFiles } from "./section-7.6.js";
import type { PlacementFile, PlacementFiles } from "./section-7.6.js";

const LF = String.fromCodePoint(0x0a);

/** The project's directory, staging-relative: the importing file's own. */
const PROJECT_DIR = "project";

/** The project kind the staging declares (module header). */
const PROJECT_KIND: ProjectKind = "commonjs";

/** `n` and `word`, pluralized. */
function count(n: number, word: string): string {
  return `${String(n)} ${word}${n === 1 ? "" : "s"}`;
}

// ---------------------------------------------------------------------------
// The runtime tests' runs (module header)
// ---------------------------------------------------------------------------

/**
 * One of 7.6's runtime tests (module header): whether its runs observe
 * their effects, what it reads off each run, and the words its diagnoses
 * use.
 */
interface RuntimeTest {
  /** Its TEST-SPEC ID. */
  readonly id: string;
  /** Leads every diagnosis of its runs. */
  readonly context: string;
  /** TEST-SPEC's rule, closing its failures. */
  readonly rule: string;
  /** The clauses a run's reading holds, in words: "(a), (b), and (c)". */
  readonly clauses: string;
  /**
   * Whether each run also observes T7.6-7(b) and (e) — its FIFOs staged
   * before it, its places snapshotted around it (the driver's `effects`).
   */
  readonly effects: boolean;
  /**
   * Its reading of a loaded run: problems in words, each led by the run's
   * description.
   */
  readonly read: (run: LoadedModuleRun) => Promise<readonly string[]>;
}

/**
 * Stands for a run's own directory — the one holding its working directory,
 * `HOME`, and `TMPDIR`, removed once the run ends — in a recorded problem,
 * so that the same problem found in many runs is named once.
 */
const RUN_DIRECTORY = "<run directory>";

/** How a run observing its effects is made, in words, for a diagnosis. */
const OBSERVING_EFFECTS =
  `, each run observing its effects — a FIFO named ${RUN_FIFO_NAME} ` +
  "staged in its working directory, in the importing module's directory, " +
  "and in its fresh HOME, and the staging, its working directory, HOME, " +
  "and TMPDIR compared entry by entry just before and just after it, its " +
  "working directory, HOME, and TMPDIR lying in a directory of its own, " +
  `written ${RUN_DIRECTORY} below`;

/**
 * Whether `release` is of 22.0–22.11, on which `require` cannot load an ES
 * module without a flag (TEST-SPEC T7.6-6). Its version is an exact
 * `major.minor.patch` (helpers/node-releases.ts reads the list strictly).
 */
function refusesRequireOfModules(release: NodeRelease): boolean {
  const [major, minor] = release.version.split(".").map(Number);
  return major === 22 && minor !== undefined && minor <= 11;
}

/** A run, in short, for a diagnosis listing many: its release and route. */
function runLabel(release: NodeRelease, route: ModuleRoute): string {
  return `${release.version} (${route})`;
}

/**
 * The problems a test's runs found (module header): each distinct problem,
 * the run's description it is led by left out, with the runs it was found
 * in, in the order found; and each run that found any.
 */
interface FoundProblems {
  readonly problems: Map<string, string[]>;
  readonly runs: string[];
}

/**
 * Record `problems`, each led by `run`'s description, under `label`: the
 * description left out, and the run's own directory written
 * {@link RUN_DIRECTORY}.
 */
function recordProblems(
  found: FoundProblems,
  run: LoadedModuleRun,
  label: string,
  problems: readonly string[],
): void {
  if (problems.length === 0) return;
  found.runs.push(label);
  const lead = `${run.description}: `;
  const own = path.dirname(run.cwd);
  for (const problem of problems) {
    const body = (
      problem.startsWith(lead) ? problem.slice(lead.length) : problem
    )
      .split(own)
      .join(RUN_DIRECTORY);
    const runs = found.problems.get(body);
    if (runs === undefined) found.problems.set(body, [label]);
    else if (!runs.includes(label)) runs.push(label);
  }
}

/**
 * Each distinct problem found, in full, with the runs it was found in, of
 * the `observed` runs whose problems were read: "every one" of them where
 * it was found in each.
 */
function describeFound(found: FoundProblems, observed: number): string {
  return [...found.problems]
    .map(([body, labels]) =>
      labels.length === observed && observed > 1
        ? `${body} — in every one of the ${String(observed)} runs`
        : `${body} — in ${count(labels.length, "run")}: ${labels.join("; ")}`,
    )
    .join(" | ");
}

/**
 * `run` as a run that loaded the module and ended on its own with exit
 * code 0 (`assertModuleLoaded`), or a diagnosed failure stopping `test`'s
 * body there (module header), naming what the runs before it found.
 */
function loadedOrStop(
  test: RuntimeTest,
  run: ModuleRun,
  label: string,
  ordinal: number,
  total: number,
  found: FoundProblems,
): LoadedModuleRun {
  try {
    return assertModuleLoaded(run, "product");
  } catch (error) {
    if (!(error instanceof HarnessAssertionError)) throw error;
    const before =
      found.problems.size === 0
        ? ordinal === 1
          ? "no run came before it"
          : `each of the ${count(ordinal - 1, "run")} before it loaded the ` +
            `module and held ${test.clauses}`
        : `the ${count(ordinal - 1, "run")} before it, each of which loaded ` +
          "the module and ended on its own with exit code 0, found " +
          `${count(found.problems.size, "distinct problem")}: ` +
          describeFound(found, ordinal - 1);
    fail(
      `${error.message}. The body stops at this run, ${label}, run ` +
        `${String(ordinal)} of ${String(total)}, the first that did not ` +
        `load the module and end on its own with exit code 0; ${before} ` +
        test.rule,
    );
  }
}

/** Where a test's runs load the module from: a placement in its staging. */
interface RunsPlace {
  readonly staging: ModuleStaging;
  readonly placement: Placement;
  /** The importing file's directory, staging-relative, along its physical path. */
  readonly importingDir: string;
  /** The project kind staged there, confirmed by Reach before each run. */
  readonly project: ProjectKind;
  /** Whether nothing but the placement is installed, confirmed likewise. */
  readonly alone: boolean;
}

/**
 * Make `test`'s runs (module header): one per release of `releases` and
 * route, one after another, each loading the module from `place`; the
 * first run that does not load the module and end on its own with exit
 * code 0 stops the body, diagnosed ({@link loadedOrStop}), and each loaded
 * run's problems are recorded into `found`. Resolves with the number of
 * runs made.
 */
async function runRoutes(
  test: RuntimeTest,
  place: RunsPlace,
  releases: readonly NodeRelease[],
  found: FoundProblems,
): Promise<number> {
  const total = releases.length * MODULE_ROUTES.length;
  let made = 0;
  for (const release of releases) {
    for (const route of MODULE_ROUTES) {
      const label = runLabel(release, route);
      const run = await runModuleRoute({
        staging: place.staging,
        placement: place.placement,
        route,
        release,
        importingDir: place.importingDir,
        project: place.project,
        alone: place.alone,
        effects: test.effects,
        context: test.context,
      });
      made += 1;
      const loaded = loadedOrStop(test, run, label, made, total, found);
      recordProblems(found, loaded, label, await test.read(loaded));
    }
  }
  return made;
}

/**
 * Fail `test` once, diagnosed, where its `made` runs — `summary` saying
 * what they were — found any problem (module header); nothing otherwise.
 */
function failOnProblems(
  test: RuntimeTest,
  found: FoundProblems,
  made: number,
  summary: string,
): void {
  if (found.problems.size === 0) return;
  fail(
    `${test.context}: ${count(found.problems.size, "distinct problem")} ` +
      `in ${count(found.runs.length, "run")} of the ${String(made)} — ` +
      `${summary} — each of which loaded the module and ended on its own ` +
      `with exit code 0: ${describeFound(found, made)} ${test.rule}`,
  );
}

/** The body `test` runs against `product` (module header). */
async function runRuntimeRuns(
  product: ProductBinding,
  test: RuntimeTest,
): Promise<void> {
  const staging = await ModuleStaging.create(product, test.context);
  const found: FoundProblems = { problems: new Map(), runs: [] };
  let made = 0;
  let summary = "";
  try {
    const releases = await resolveNodeReleases();
    const versions = releases.map((release) => release.version);
    if (!releases.some(refusesRequireOfModules)) {
      throw new Error(
        `${test.id}: none of the releases E-1 lists (${versions.join(", ")}) ` +
          "is of 22.0–22.11, on which require cannot load an ES module " +
          "without a flag, though TEST-SPEC T7.6-6 names one among them: a " +
          "harness defect (E-1)",
      );
    }
    const directory = await staging.stageProject(PROJECT_DIR, PROJECT_KIND);
    const placement = await staging.placeCanonical(
      PROJECT_DIR,
      runtimeArm(releases),
    );
    summary =
      `every release E-1 lists (${versions.join(", ")}) along each of ` +
      `Node.js's ${String(MODULE_ROUTES.length)} routes, each run loading ` +
      `${placement.name}, the canonical placement at ${placement.path}, ` +
      `from its route's importing module in ${directory}` +
      (test.effects ? OBSERVING_EFFECTS : "");
    made = await runRoutes(
      test,
      {
        staging,
        placement,
        importingDir: PROJECT_DIR,
        project: PROJECT_KIND,
        alone: true,
      },
      releases,
      found,
    );
  } finally {
    await staging.dispose();
  }
  failOnProblems(test, found, made, summary);
}

// ---------------------------------------------------------------------------
// T7.6-6: runtime exports and identity
// ---------------------------------------------------------------------------

/** T7.6-6's runs and reading (module header). */
const T766: RuntimeTest = {
  id: "T7.6-6",
  context: "T7.6-6 (runtime exports and identity)",
  rule:
    "(TEST-SPEC T7.6-6: on each release E-1 provisions, run with no option, " +
    "no environment variable, no user condition, and no loader or " +
    "customization hook, the module loads along each of Node.js's routes, " +
    "and in each run (a) an import namespace's own string-keyed properties " +
    "and a require result's own enumerable properties, string- and " +
    "symbol-keyed alike, are exactly defineConfig, (b) defineConfig returns " +
    "its first argument, compared by SameValue, and undefined when called " +
    "with none, and (c) it neither examines, copies, nor modifies its " +
    "argument; SPEC 7.6 Runtime, Reach)",
  clauses: "(a), (b), and (c)",
  effects: false,
  read: (run) =>
    Promise.resolve([
      ...exportsProblems(run),
      ...identityProblems(run),
      ...examinationProblems(run),
    ]),
};

const T7_6_6 = defineProductTest({
  id: "T7.6-6",
  title:
    "on every Node.js release E-1 provisions (one of 22.0–22.11, on which " +
    "require cannot load an ES module without a flag, among them), each run " +
    "with no option and no environment variable but a fresh HOME and " +
    "TMPDIR and the harness's PATH (so no NODE_OPTIONS or NODE_PATH, no user " +
    "condition, and no loader or customization hook), the module placed at " +
    "the canonical placement loads along each of Node.js's four routes — a " +
    "static import and a dynamic import() from an ES module (.mjs), a " +
    "dynamic import() and require from a CommonJS module (.cjs) — from a " +
    "harness-written importing module in the importing file's place, the " +
    "process ending on its own with exit code 0; and in each run (a) an " +
    "import namespace's own string-keyed properties, and a require result's " +
    "own enumerable properties, string- and symbol-keyed alike, are exactly " +
    "defineConfig; (b) defineConfig(v) returns v itself, compared by " +
    "SameValue, for an object, an array, a function, a symbol, null, " +
    "undefined passed explicitly, a string, a boolean, a bigint, 0, -0, and " +
    "NaN, returns undefined when called with no argument, and returns its " +
    "first argument when called with a further one; (c) called with two " +
    "Proxies over functions whose every trap records its invocation, it " +
    "returns the first with no trap of either invoked through the run's " +
    "end, and called with a frozen object it returns that object without " +
    "throwing (SPEC 7.6 Runtime, Reach)",
  run: (product) => runRuntimeRuns(product, T766),
});

// ---------------------------------------------------------------------------
// T7.6-7: runtime, no effect
// ---------------------------------------------------------------------------

/** T7.6-7's runs and reading (module header). */
const T767: RuntimeTest = {
  id: "T7.6-7",
  context: "T7.6-7 (runtime: no effect)",
  rule:
    "(TEST-SPEC T7.6-7: in T7.6-6's runs, beyond the runtime's own " +
    "resolution of the specifier and loading of the package's files, " +
    "loading the module and making T7.6-6's calls have no effect — (a) " +
    "standard output empty, and standard error exactly the release's " +
    "printed forms of the process warnings the run emits, in order, none " +
    "beginning its stack in the package's files; (b) no entry created, " +
    "modified, or removed in the staging, the working directory, HOME, or " +
    "TMPDIR; (c) the process state unchanged across the load and the " +
    "calls; (d) every run network-denied (E-1); and (e) the FIFOs named " +
    "xspec.config.ts in the working directory, the importing module's " +
    "directory, and HOME afterwards still FIFOs, unopened, every run ending " +
    "within its guard — each absence counting only where the run saw " +
    "defineConfig return its argument (§7.6 Pairing); SPEC 7.6 Runtime)",
  clauses: "(a), (b), (c), and (e)",
  effects: true,
  read: async (run) => [
    ...(await runtimeOutputProblems(run)),
    ...writeProblems(run),
    ...stateProblems(run),
    ...fifoProblems(run),
  ],
};

const T7_6_7 = defineProductTest({
  id: "T7.6-7",
  title:
    "in runs of T7.6-6's shape — on every Node.js release E-1 provisions, " +
    "along each of Node.js's four routes, the module placed at the " +
    "canonical placement loaded from a harness-written importing module in " +
    "the importing file's place, under T7.6-6's run conditions with a fresh " +
    "HOME, TMPDIR, and working directory, T7.6-6's calls made, and the " +
    "process ending on its own with exit code 0 — loading the module and " +
    "making the calls have no effect, each absence counting only where the " +
    "run saw defineConfig return its argument in every call: (a) standard " +
    "output is empty, and standard error is exactly the release's printed " +
    "forms, learned from the release, of the process warnings the run " +
    "emits, in order, as delivered to a warning listener registered before " +
    "the importing module's own loading begins, no captured warning's stack " +
    "beginning in the package's files; (b) no entry is created, modified, " +
    "or removed in the staging (the placement included), the working " +
    "directory, HOME, or TMPDIR, each compared entry by entry just before " +
    "and just after the run; (c) the process state — the global object's " +
    "own properties with their descriptors, the built-ins' own properties, " +
    "extensibility and prototypes, process's own properties, process.env, " +
    "the title, the working directory, process.exitCode, each standard " +
    "stream's write, process's listeners, and the pending timers and " +
    "handles — is unchanged across the load and the calls; and (e) FIFOs " +
    "named xspec.config.ts in the working directory, the importing module's " +
    "directory, and HOME are afterwards still FIFOs, unopened, every run " +
    "ending within its guard; (d), network denial, is the environment's " +
    "(E-1) (SPEC 7.6 Runtime)",
  run: (product) => runRuntimeRuns(product, T767),
});

// ---------------------------------------------------------------------------
// T7.6-4: placements — what each stages (module header)
// ---------------------------------------------------------------------------

/** Leads every diagnosis of T7.6-4. */
const T764_CONTEXT = "T7.6-4 (placements)";

/** TEST-SPEC T7.6-4's rule, closing its failures. */
const T764_RULE =
  "(TEST-SPEC T7.6-4: each placement stands in for the canonical one in a " +
  "run of T7.6-1, of T7.6-2(a) with T7.6-3's unknown-top-level-key arm " +
  "paired to it in every covered setup, and of T7.6-6's exports and " +
  "identity assertions along every route on every release E-1 provisions, " +
  "and fares as the canonical placement does; SPEC 7.6 Package and " +
  "installation — a copy, a symbolic-link install, and an aliased install " +
  "are alike — and Reach)";

/**
 * Where a placement's importing files lie and where it is placed, each
 * staging-relative (module header): the importing file's own directory as
 * the holding directory, as the canonical placement has it; a strict
 * ancestor of it; or a strict ancestor of its physical path alone, the
 * directory also reachable through a symbolic link elsewhere in the
 * staging, on whose path that ancestor does not lie.
 */
type T764Layout = "own" | "ancestor" | "physical ancestor";

interface LayoutShape {
  /** The importing files' directory: the project's, along its physical path. */
  readonly importingDir: string;
  readonly holdingDir: string;
  /** A symbolic link at `at` reaching the importing files' directory. */
  readonly link?: { readonly at: string; readonly to: string };
}

const T764_LAYOUTS: Readonly<Record<T764Layout, LayoutShape>> = {
  own: { importingDir: PROJECT_DIR, holdingDir: PROJECT_DIR },
  ancestor: { importingDir: `ancestor/${PROJECT_DIR}`, holdingDir: "ancestor" },
  "physical ancestor": {
    importingDir: `physical/${PROJECT_DIR}`,
    holdingDir: "physical",
    link: { at: `linked/${PROJECT_DIR}`, to: `physical/${PROJECT_DIR}` },
  },
};

/**
 * Another package a placement's staging installs (module header): an
 * unrelated package of the harness's writing, or TypeScript 5.9.3's.
 */
type OtherPackage =
  | { readonly kind: "unrelated"; readonly name: string }
  | { readonly kind: "typescript" };

/**
 * A placement's N: the name the package's manifest gives ((a)), the
 * canonical N, or a name fixed here.
 */
type T764Name =
  | { readonly kind: "manifest" }
  | { readonly kind: "canonical" }
  | { readonly kind: "fixed"; readonly name: string };

/** One of T7.6-4's placements (module header). */
interface T764Placement {
  /** The arm as TEST-SPEC letters it, with an ordinal where it holds several. */
  readonly arm: string;
  /** What the placement stages, in words. */
  readonly what: string;
  readonly name: T764Name;
  readonly form: PlacementForm;
  readonly layout: T764Layout;
  /** Other packages installed beside the placement, in its holding directory. */
  readonly beside: readonly OtherPackage[];
  /** Other packages installed in the importing files' own directory. */
  readonly inImportingDir: readonly OtherPackage[];
  /** Whether nothing but the placement is installed (Reach's `alone`). */
  readonly alone: boolean;
  /** Whether it has a runtime half: every placement but (f)'s. */
  readonly runtime: boolean;
}

/** (c)'s names across 7.6's grammar (module header). */
const SCOPED_NAME = "@staged-scope/config-module";
const DIGIT_FIRST_NAME = "7config";
const DASH_UNDERSCORE_NAME = "staged-config_module";
const DOTTED_NAMES: readonly string[] = ["a.js", "a.b"];
const LONG_SCOPE = "@long-scope/";
const LONG_UNSCOPED_NAME = "long-config-module-".padEnd(
  MODULE_NAME_MAX_LENGTH,
  "x",
);
const LONG_SCOPED_NAME =
  LONG_SCOPE +
  "long-config-module-".padEnd(MODULE_NAME_MAX_LENGTH - LONG_SCOPE.length, "x");

/** The unrelated package beside (c)'s dotted names: at node_modules/a. */
const DOTTED_NEIGHBOUR = "a";

/** (e)'s unrelated package, unscoped, so never an `@types` package. */
const UNRELATED_PACKAGE = "unrelated-package";

/** (f)'s names: the releases resolve each to a built-in module. */
const BUILT_IN_NAMES: readonly string[] = ["fs", "path"];

/** A placement of the canonical layout, form, and N but for `overrides`. */
function placementOf(
  arm: string,
  what: string,
  overrides: Partial<Omit<T764Placement, "arm" | "what">>,
): T764Placement {
  return {
    arm,
    what,
    name: { kind: "canonical" },
    form: "copy",
    layout: "own",
    beside: [],
    inImportingDir: [],
    alone: true,
    runtime: true,
    ...overrides,
  };
}

/** T7.6-4's placements, in TEST-SPEC's order (module header). */
const T764_PLACEMENTS: readonly T764Placement[] = [
  placementOf(
    "(a)",
    "a copy under the name the package's manifest gives, the non-aliased " +
      "install",
    { name: { kind: "manifest" } },
  ),
  placementOf(
    "(b)",
    "node_modules/N a symbolic link to a copy of the package directory " +
      "elsewhere in the staging, under no node_modules",
    { form: "symlink" },
  ),
  placementOf("(c) 1", "a scoped name", {
    name: { kind: "fixed", name: SCOPED_NAME },
  }),
  placementOf("(c) 2", "a name beginning with a digit", {
    name: { kind: "fixed", name: DIGIT_FIRST_NAME },
  }),
  placementOf("(c) 3", "a name holding - and _", {
    name: { kind: "fixed", name: DASH_UNDERSCORE_NAME },
  }),
  ...DOTTED_NAMES.map((name, index) =>
    placementOf(
      `(c) ${String(4 + index)}`,
      `the dotted name ${name}, whose S, ${DOTTED_NEIGHBOUR}, differs from ` +
        `N, beside an unrelated package at node_modules/` +
        `${DOTTED_NEIGHBOUR}${name === "a.js" ? " and no a.ts" : ""}`,
      {
        name: { kind: "fixed", name },
        beside: [{ kind: "unrelated", name: DOTTED_NEIGHBOUR }],
        alone: false,
      },
    ),
  ),
  placementOf("(c) 6", "an unscoped name exactly 214 characters long", {
    name: { kind: "fixed", name: LONG_UNSCOPED_NAME },
  }),
  placementOf("(c) 7", "a scoped name exactly 214 characters long", {
    name: { kind: "fixed", name: LONG_SCOPED_NAME },
  }),
  placementOf(
    "(d) 1",
    "the holding directory a strict ancestor of the importing file's " +
      "directory",
    { layout: "ancestor" },
  ),
  placementOf(
    "(d) 2",
    "the holding directory an ancestor of the importing file's physical " +
      "path alone, the file's directory also reachable through a symbolic " +
      "link elsewhere in the staging, on whose path that ancestor does not " +
      "lie, each tool given the physical path",
    { layout: "physical ancestor" },
  ),
  placementOf(
    "(e) 1",
    "TypeScript 5.9.3's package at node_modules/typescript and an unrelated " +
      "package beside the placement",
    {
      beside: [
        { kind: "typescript" },
        { kind: "unrelated", name: UNRELATED_PACKAGE },
      ],
      alone: false,
    },
  ),
  placementOf(
    "(e) 2",
    "the holding directory a strict ancestor, an unrelated package in the " +
      "importing file's own directory",
    {
      layout: "ancestor",
      inImportingDir: [{ kind: "unrelated", name: UNRELATED_PACKAGE }],
      alone: false,
    },
  ),
  ...BUILT_IN_NAMES.map((name, index) =>
    placementOf(
      `(f) ${String(1 + index)}`,
      `N ${name}, a name the provisioned releases resolve to a built-in ` +
        "module, in the type-checking runs alone",
      { name: { kind: "fixed", name }, runtime: false },
    ),
  ),
];

/** `S` for N (SPEC 7.6 Reach): N cut before the first `.` of its last segment. */
function cutAtLastSegmentDot(name: string): string {
  const slash = name.lastIndexOf("/");
  const dot = name.indexOf(".", slash + 1);
  return dot < 0 ? name : name.slice(0, dot);
}

/**
 * Hold T7.6-4's placements to its list (module header): its arms' counts,
 * each fixed N a name of 7.6's grammar outside its exclusions with the
 * feature its arm names, the runtime halves, and `alone` exactly where
 * nothing else is installed. A deviation is a harness defect, thrown at
 * module load.
 */
function checkT764Placements(): void {
  const problems: string[] = [];
  const need = (held: boolean, problem: string): void => {
    if (!held) problems.push(problem);
  };
  const letters = new Map<string, number>();
  for (const placement of T764_PLACEMENTS) {
    const letter = placement.arm.slice(0, 3);
    letters.set(letter, (letters.get(letter) ?? 0) + 1);
    need(
      placement.runtime === (letter !== "(f)"),
      `${placement.arm} has a runtime half exactly where its arm is not (f)`,
    );
    need(
      placement.alone ===
        (placement.beside.length === 0 &&
          placement.inImportingDir.length === 0),
      `${placement.arm} is declared alone exactly where it installs nothing else`,
    );
    if (placement.name.kind !== "fixed") continue;
    const { name } = placement.name;
    const problem = moduleNameGrammarProblem(name) ?? moduleNameExclusion(name);
    need(problem === null, `${placement.arm}'s N ${name} ${String(problem)}`);
    need(
      !CANONICAL_MODULE_NAMES.includes(name),
      `${placement.arm}'s N ${name} differs from the canonical candidates`,
    );
  }
  const expected: readonly [string, number][] = [
    ["(a)", 1],
    ["(b)", 1],
    ["(c)", 7],
    ["(d)", 2],
    ["(e)", 2],
    ["(f)", 2],
  ];
  need(
    letters.size === expected.length &&
      expected.every(([letter, n]) => letters.get(letter) === n),
    `the arms number (a) 1, (b) 1, (c) 7, (d) 2, (e) 2, and (f) 2, not ` +
      JSON.stringify([...letters]),
  );
  need(SCOPED_NAME.startsWith("@"), "(c) 1 is scoped");
  need(/^[0-9]/.test(DIGIT_FIRST_NAME), "(c) 2 begins with a digit");
  need(
    DASH_UNDERSCORE_NAME.includes("-") && DASH_UNDERSCORE_NAME.includes("_"),
    "(c) 3 holds - and _",
  );
  for (const name of DOTTED_NAMES) {
    need(
      cutAtLastSegmentDot(name) === DOTTED_NEIGHBOUR &&
        name !== DOTTED_NEIGHBOUR,
      `${name}'s S is ${DOTTED_NEIGHBOUR}, differing from N`,
    );
  }
  need(
    LONG_UNSCOPED_NAME.length === MODULE_NAME_MAX_LENGTH &&
      !LONG_UNSCOPED_NAME.startsWith("@") &&
      LONG_SCOPED_NAME.length === MODULE_NAME_MAX_LENGTH &&
      LONG_SCOPED_NAME.startsWith("@"),
    `(c) 6 and 7 are an unscoped and a scoped name of exactly ` +
      `${String(MODULE_NAME_MAX_LENGTH)} characters`,
  );
  need(
    !UNRELATED_PACKAGE.startsWith("@") && !DOTTED_NEIGHBOUR.startsWith("@"),
    "no other package installed is a scoped one, an @types package least",
  );
  if (problems.length > 0) {
    throw new Error(
      `T7.6-4: its placements deviate from TEST-SPEC T7.6-4's list: ` +
        `${problems.join("; ")}: a harness defect`,
    );
  }
}

checkT764Placements();

// ---------------------------------------------------------------------------
// T7.6-4: its files, and their S-9 records (module header)
// ---------------------------------------------------------------------------

/** One of T7.6-4's files beside one N: plain TypeScript, and TSX. */
interface T764Record {
  readonly label: string;
  readonly ts: StagedTs;
  readonly tsx: StagedTs;
}

/** The three files beside one fixed N, as records. */
interface T764Records {
  readonly declaredExports: T764Record;
  readonly valid: T764Record;
  readonly unknownKey: T764Record;
}

/** Every N fixed at module load: the canonical candidates and the fixed names. */
const T764_FIXED_NAMES: readonly string[] = [
  ...new Set([
    ...CANONICAL_MODULE_NAMES,
    ...T764_PLACEMENTS.flatMap((placement) =>
      placement.name.kind === "fixed" ? [placement.name.name] : [],
    ),
  ]),
];

/**
 * T7.6-4's files beside each fixed N (module header), each a staged-source
 * record (S-9) as plain TypeScript and, for the `.tsx` name, as TSX of the
 * same bytes — composed by section-7.6.ts's `placementFiles`, so each is
 * the canonical run's own file but for its specifier.
 */
const T764_RECORDS: ReadonlyMap<string, T764Records> = new Map(
  T764_FIXED_NAMES.map((name): [string, T764Records] => {
    const files = placementFiles(name);
    const record = (file: PlacementFile): T764Record => {
      const named = `T7.6-4 ${file.label}, importing ${JSON.stringify(name)}`;
      return {
        label: file.label,
        ts: stagedTs(named, file.text),
        tsx: stagedTs(`${named}, as TSX`, file.text, "well-formed", "tsx"),
      };
    };
    return [
      name,
      {
        declaredExports: record(files.declaredExports),
        valid: record(files.valid),
        unknownKey: record(files.unknownKey),
      },
    ];
  }),
);

/** The files beside a fixed N: its records' bytes. */
function recordedFiles(name: string): PlacementFiles {
  const records = T764_RECORDS.get(name);
  const file = (record: T764Record | undefined): PlacementFile => {
    if (record === undefined || typeof record.ts.source !== "string") {
      throw new Error(
        `T7.6-4: no record holds its files beside the fixed N ` +
          `${JSON.stringify(name)}: a harness defect`,
      );
    }
    return { label: record.label, text: record.ts.source };
  };
  return {
    declaredExports: file(records?.declaredExports),
    valid: file(records?.valid),
    unknownKey: file(records?.unknownKey),
  };
}

/**
 * The files beside (a)'s N, the name the package's manifest gives, known
 * only once the package directory is read (module header): composed by
 * `placementFiles`, the composition the fixed names' records hold, then
 * judged by S-9's TypeScript check before anything is staged — accepted
 * both as module code and as script code under the grammar each covered
 * name selects (plain TypeScript, and TSX for `.tsx`) — a failure a harness
 * error, as a draw's is.
 */
function composedFiles(name: string, context: string): PlacementFiles {
  const files = placementFiles(name);
  for (const file of [files.declaredExports, files.valid, files.unknownKey]) {
    for (const judged of ["covered-file.ts", "covered-file.tsx"]) {
      const problem = tsDeclarationProblem(
        judgeTypeScript(file.text, judged),
        "well-formed",
      );
      if (problem !== undefined) {
        throw new HarnessStagingError(
          "ts-derivability",
          judged,
          `${context}: ${file.label}, importing ${JSON.stringify(name)}, ` +
            `judged as ${judged.endsWith(".tsx") ? "TSX" : "plain TypeScript"}, ` +
            `is ${problem} (TEST-SPEC S-9: a generated configuration file is ` +
            "judged well-formed before the product is driven on it)",
        );
      }
    }
  }
  return files;
}

// ---------------------------------------------------------------------------
// T7.6-4: staging a placement (module header)
// ---------------------------------------------------------------------------

/**
 * An unrelated package's files (module header): a manifest naming it, a
 * CommonJS entry exporting one value, and its declarations — a package no
 * covered file or importing module names, which neither TypeScript nor
 * Node.js reads unless a resolution strays into it.
 */
function unrelatedPackageFiles(name: string): readonly [string, string][] {
  const manifest = {
    name,
    version: "1.0.0",
    main: "index.js",
    types: "index.d.ts",
  };
  return [
    ["package.json", `${JSON.stringify(manifest, null, 2)}${LF}`],
    [
      "index.js",
      `"use strict";${LF}${LF}exports.unrelated = ${JSON.stringify(name)};${LF}`,
    ],
    [
      "index.d.ts",
      `export declare const unrelated: ${JSON.stringify(name)};${LF}`,
    ],
  ];
}

/** TypeScript 5.9.3's package directory, once read (module header). */
let typeScriptPackage: Promise<string> | undefined;

/**
 * TypeScript 5.9.3's package directory, by its physical path: the harness's
 * own `typescript-5.9.3`, the release the TypeScript driver runs — the
 * parent of its library directory — its manifest read strictly and found to
 * give the name `typescript` and the version 5.9.3, else a harness defect.
 */
function typeScriptPackageDirectory(): Promise<string> {
  typeScriptPackage ??= guardStep(
    "reading TypeScript 5.9.3's package directory (T7.6-4(e))",
    async () => {
      const directory = await fsp.realpath(
        path.dirname(path.dirname(ts.getDefaultLibFilePath({}))),
      );
      const reading = await readManifestStrictly(
        path.join(directory, "package.json"),
      );
      if (
        ts.version !== "5.9.3" ||
        reading === undefined ||
        !reading.wellFormed ||
        reading.members["name"] !== "typescript" ||
        reading.members["version"] !== "5.9.3"
      ) {
        throw new Error(
          `T7.6-4: ${directory} is not TypeScript 5.9.3's package, whose ` +
            "manifest gives the name typescript and the version 5.9.3 " +
            `(TypeScript ${ts.version} loaded): a harness defect`,
        );
      }
      return directory;
    },
  );
  return typeScriptPackage;
}

/** Install `other` at `node_modules/<its name>` in `directory`. */
async function installOther(
  staging: ModuleStaging,
  directory: string,
  other: OtherPackage,
): Promise<void> {
  if (other.kind === "typescript") {
    await staging.copyDirectory(
      `${directory}/node_modules/typescript`,
      await typeScriptPackageDirectory(),
    );
    return;
  }
  for (const [file, text] of unrelatedPackageFiles(other.name)) {
    await staging.writeFile(
      `${directory}/node_modules/${other.name}/${file}`,
      text,
    );
  }
}

/** A placement staged: the placement made, and the importing files' place. */
interface StagedPlacement {
  readonly placement: Placement;
  /** The importing files' directory, staging-relative, along its physical path. */
  readonly importingDir: string;
}

/**
 * Stage `spec` under `name` for `arm` (module header): a project of kind
 * `project` in the layout's importing directory, the placement in its
 * holding directory, the layout's symbolic link, and the other packages.
 */
async function stagePlacement(
  staging: ModuleStaging,
  spec: T764Placement,
  name: string,
  project: ProjectKind,
  arm: ModuleArm,
): Promise<StagedPlacement> {
  const layout = T764_LAYOUTS[spec.layout];
  await staging.stageProject(layout.importingDir, project);
  const placement = await staging.place({
    name,
    holdingDir: layout.holdingDir,
    arm,
    form: spec.form,
  });
  if (layout.link !== undefined) {
    await staging.link(layout.link.at, layout.link.to);
  }
  for (const other of spec.beside) {
    await installOther(staging, layout.holdingDir, other);
  }
  for (const other of spec.inImportingDir) {
    await installOther(staging, layout.importingDir, other);
  }
  return { placement, importingDir: layout.importingDir };
}

// ---------------------------------------------------------------------------
// T7.6-4: the body (module header)
// ---------------------------------------------------------------------------

/** A placement as the body runs it: its N and its files. */
interface ResolvedPlacement {
  readonly spec: T764Placement;
  readonly name: string;
  readonly files: PlacementFiles;
  /** Leads its diagnoses. */
  readonly context: string;
}

/**
 * `spec` as the body runs it beside `pkg` (module header), or undefined for
 * (a) where the manifest gives no name of 7.6's grammar outside the
 * exclusions every arm has — TEST-SPEC stages (a) only where it does.
 */
function resolvePlacement(
  spec: T764Placement,
  pkg: PackageDirectory,
): ResolvedPlacement | undefined {
  const describe = (name: string): string =>
    `${T764_CONTEXT}, placement ${spec.arm} (${spec.what}), N ` +
    JSON.stringify(name);
  switch (spec.name.kind) {
    case "canonical": {
      const name = canonicalModuleName(pkg.manifestName.name);
      return {
        spec,
        name,
        files: recordedFiles(name),
        context: describe(name),
      };
    }
    case "fixed":
      return {
        spec,
        name: spec.name.name,
        files: recordedFiles(spec.name.name),
        context: describe(spec.name.name),
      };
    case "manifest": {
      const name = pkg.manifestName.name;
      if (
        name === undefined ||
        moduleNameGrammarProblem(name) !== null ||
        moduleNameExclusion(name) !== null
      ) {
        return undefined;
      }
      const context = describe(name);
      return { spec, name, files: composedFiles(name, context), context };
    }
  }
}

/**
 * The releases `resolved`'s runtime half runs on (module header): every
 * release for a fixed or the canonical N — the placement itself confirming
 * that none resolves it to a built-in module — and, for (a)'s, the manifest's
 * name, each release that resolves it to none, each release asked.
 */
async function runtimeReleases(
  resolved: ResolvedPlacement,
  releases: readonly NodeRelease[],
): Promise<readonly NodeRelease[]> {
  if (!resolved.spec.runtime) return [];
  if (resolved.spec.name.kind !== "manifest") return releases;
  const admitted: NodeRelease[] = [];
  for (const release of releases) {
    const builtIn = await builtInNamesOn(
      release,
      [resolved.name],
      resolved.context,
    );
    if (!builtIn.has(resolved.name)) admitted.push(release);
  }
  return admitted;
}

/** Where a placement stands in the body, for a diagnosis (module header). */
function standing(held: readonly string[]): string {
  return held.length === 0
    ? "the first placement the body runs"
    : `run after ${count(held.length, "placement")} that ` +
        `${held.length === 1 ? "fared" : "each fared"} as the canonical one ` +
        `does — ${held.join("; ")}`;
}

/** Each failing assertion's diagnosis, in order: none where all hold. */
function placementFailures(checks: readonly (() => void)[]): readonly string[] {
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
 * A placement's type-checking half (module header): in each project kind's
 * staging, T7.6-1's covered file, T7.6-2(a)'s file, and T7.6-3's
 * unknown-top-level-key arm judged in one program per covered setup, the
 * first holding T7.6-1's listing, the second type-checking, and the arm
 * failing to type-check paired with it; the first setup where any fails
 * ends the body, diagnosed.
 */
async function runPlacementTypeChecking(
  product: ProductBinding,
  resolved: ResolvedPlacement,
  held: readonly string[],
): Promise<void> {
  const { spec, name, files } = resolved;
  let judged = 0;
  for (const project of PROJECT_KINDS) {
    const context = `${resolved.context}, the ${project} project`;
    const staging = await ModuleStaging.create(product, context);
    try {
      const { placement, importingDir } = await stagePlacement(
        staging,
        spec,
        name,
        project,
        TYPE_CHECKING_ARM,
      );
      const covered = await stageCoveredFiles({
        staging,
        directory: importingDir,
        project,
        placement,
        alone: spec.alone,
        files: [files.declaredExports, files.valid, files.unknownKey],
        listExports: true,
        context,
      });
      for (const setup of covered.setups) {
        const [listed, valid, arm] = covered.judge(setup);
        if (listed === undefined || valid === undefined || arm === undefined) {
          throw new Error("unreachable: three verdicts");
        }
        const failures = placementFailures([
          () => assertDeclaredExports(listed, "T7.6-1's run"),
          () => assertTypeChecks(valid, "T7.6-2(a)'s run"),
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
        if (failures.length > 0) {
          fail(
            `${context}: in ${setup.label}, beside the placement ` +
              `${placement.path}, ${String(failures.length)} of the 3 runs ` +
              "the placement stands in for the canonical one in " +
              `${failures.length === 1 ? "fails" : "fail"} — the first ` +
              "covered setup where any does, after " +
              `${count(judged, "setup")} of this placement where all 3 ` +
              `held; the placement is ${standing(held)}; the body stops ` +
              `here ${T764_RULE}. ${failures.join(" | ")}`,
          );
        }
        judged += 1;
      }
    } finally {
      await staging.dispose();
    }
  }
  if (judged !== COVERED_SETUP_COUNT) {
    throw new Error(
      `T7.6-4: ${String(judged)} covered setups judged beside the placement ` +
        `${spec.arm}, not TEST-SPEC §7.6's ${String(COVERED_SETUP_COUNT)}; no ` +
        "setup is sampled away: a harness defect",
    );
  }
}

/**
 * A placement's runtime half (module header): a CommonJS project in the
 * layout's importing directory beside the placement, and one run per
 * release of `releases` and route, each read for T7.6-6's exports and
 * identity; the first run not loading ends the body, diagnosed, as the
 * problems the runs found do once all have run. `every` is how many
 * releases E-1 lists.
 */
async function runPlacementRuntime(
  product: ProductBinding,
  resolved: ResolvedPlacement,
  releases: readonly NodeRelease[],
  held: readonly string[],
  every: number,
): Promise<void> {
  const { spec, name } = resolved;
  const test: RuntimeTest = {
    id: "T7.6-4",
    context: `${resolved.context}, its runtime runs`,
    rule:
      `— the placement, its type-checking runs having held in all ` +
      `${String(COVERED_SETUP_COUNT)} covered setups, is ` +
      `${standing(held)} ${T764_RULE}`,
    clauses: "T7.6-6's (a) and (b)",
    effects: false,
    read: (run) =>
      Promise.resolve([...exportsProblems(run), ...identityProblems(run)]),
  };
  const staging = await ModuleStaging.create(product, test.context);
  const found: FoundProblems = { problems: new Map(), runs: [] };
  let made = 0;
  let summary = "";
  try {
    const { placement, importingDir } = await stagePlacement(
      staging,
      spec,
      name,
      PROJECT_KIND,
      runtimeArm(releases),
    );
    const versions = releases.map((release) => release.version).join(", ");
    summary =
      (releases.length === every
        ? `every release E-1 lists (${versions})`
        : `each release E-1 lists that resolves N to no built-in module ` +
          `(${versions})`) +
      ` along each of Node.js's ${String(MODULE_ROUTES.length)} routes, ` +
      `each run loading ${name}, placed at ${placement.path}` +
      (placement.form === "symlink"
        ? `, a symbolic link to its copy at ${placement.copy},`
        : "") +
      ` from its route's importing module in ${staging.path(importingDir)}`;
    made = await runRoutes(
      test,
      {
        staging,
        placement,
        importingDir,
        project: PROJECT_KIND,
        alone: spec.alone,
      },
      releases,
      found,
    );
  } finally {
    await staging.dispose();
  }
  failOnProblems(test, found, made, summary);
}

/** T7.6-4's body (module header). */
async function runPlacements(product: ProductBinding): Promise<void> {
  const pkg = await modulePackageDirectory(product, T764_CONTEXT);
  const releases = await resolveNodeReleases();
  const held: string[] = [];
  for (const spec of T764_PLACEMENTS) {
    const resolved = resolvePlacement(spec, pkg);
    if (resolved === undefined) continue;
    await runPlacementTypeChecking(product, resolved, held);
    const runtime = await runtimeReleases(resolved, releases);
    if (runtime.length > 0) {
      await runPlacementRuntime(
        product,
        resolved,
        runtime,
        held,
        releases.length,
      );
    }
    held.push(`${spec.arm} (N ${JSON.stringify(resolved.name)})`);
  }
}

const T7_6_4 = defineProductTest({
  id: "T7.6-4",
  title:
    "each placement stands in for the canonical one, and fares as it does, " +
    "in a run of T7.6-1 (T7.6-2(d)'s file, the module TypeScript resolves " +
    "its import to declaring exactly defineConfig) and of T7.6-2(a)'s file " +
    "type-checking with T7.6-3's unknown-top-level-key arm failing to " +
    "type-check paired to it, in all 173 covered setups, and in T7.6-6's " +
    "runs, the module loading on every release E-1 provisions along each of " +
    "Node.js's four routes with its exports exactly defineConfig and " +
    "defineConfig returning its argument (T7.6-6 (a), (b)): (a) a copy " +
    "under the name the package's manifest gives, the non-aliased install, " +
    "where that is a name of 7.6's grammar outside its exclusions; (b) " +
    "node_modules/N a symbolic link to a copy elsewhere in the staging, " +
    "under no node_modules; (c) a scoped name, a name beginning with a " +
    "digit, a name holding - and _, the dotted names a.js and a.b (each " +
    "beside an unrelated package at node_modules/a, no a.ts beside a.js), " +
    "and an unscoped and a scoped name each 214 characters long; (d) the " +
    "holding directory a strict ancestor of the importing file's directory, " +
    "and an ancestor of its physical path alone, the directory also " +
    "reachable through a symbolic link, each tool given the physical path; " +
    "(e) TypeScript 5.9.3's package at node_modules/typescript and an " +
    "unrelated package beside the placement, and, the holding directory a " +
    "strict ancestor, an unrelated package in the importing file's own " +
    "directory; (f) in the type-checking runs alone, N fs, and N path (SPEC " +
    "7.6 Package and installation, Reach)",
  run: runPlacements,
});

export const section76iiTests: readonly ProductTestEntry[] = [
  T7_6_4,
  T7_6_6,
  T7_6_7,
];
