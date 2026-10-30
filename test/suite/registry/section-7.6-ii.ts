// TEST-SPEC §7.6 (the `defineConfig` module), second part — the runtime:
// T7.6-6, runtime exports and identity, and T7.6-7, runtime: no effect.
// T7.6-1, T7.6-2, and T7.6-3, the type contract, are section-7.6.ts's
// business; T7.6-4 and T7.6-5, and P-17 and P-18, are not registered yet.
//
// 7.6 is tested through H-2's module channel alone (TEST-SPEC §7.6's four
// rules: Placement, Covered setups, Verdict, Pairing). A body here never
// invokes the `xspec` executable: it places the product's package
// directory, the binding's `packageDir`, in a fresh staging under the
// canonical placement (helpers/module-channel.ts) and loads the
// `defineConfig` module there on the Node.js releases E-1 provisions
// (helpers/node-releases.ts) through the module channel's release driver
// (helpers/module-channel-node.ts and its bootstrap). The driver runs each
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
// Conservative operationalizations (noted per H-4):
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

import * as path from "node:path";
import { fail, HarnessAssertionError } from "../../helpers/assertions.js";
import { ModuleStaging, runtimeArm } from "../../helpers/module-channel.js";
import type { ProjectKind } from "../../helpers/module-channel.js";
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
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import type { ProductBinding } from "../../helpers/subprocess.js";

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
    const total = releases.length * MODULE_ROUTES.length;
    summary =
      `every release E-1 lists (${versions.join(", ")}) along each of ` +
      `Node.js's ${String(MODULE_ROUTES.length)} routes, each run loading ` +
      `${placement.name}, the canonical placement at ${placement.path}, ` +
      `from its route's importing module in ${directory}` +
      (test.effects ? OBSERVING_EFFECTS : "");
    for (const release of releases) {
      for (const route of MODULE_ROUTES) {
        const label = runLabel(release, route);
        const run = await runModuleRoute({
          staging,
          placement,
          route,
          release,
          project: PROJECT_KIND,
          alone: true,
          effects: test.effects,
          context: test.context,
        });
        made += 1;
        const loaded = loadedOrStop(test, run, label, made, total, found);
        recordProblems(found, loaded, label, await test.read(loaded));
      }
    }
  } finally {
    await staging.dispose();
  }
  if (found.problems.size > 0) {
    fail(
      `${test.context}: ${count(found.problems.size, "distinct problem")} ` +
        `in ${count(found.runs.length, "run")} of the ${String(made)} — ` +
        `${summary} — each of which loaded the module and ended on its own ` +
        `with exit code 0: ${describeFound(found, made)} ${test.rule}`,
    );
  }
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

export const section76iiTests: readonly ProductTestEntry[] = [T7_6_6, T7_6_7];
