// TEST-SPEC §12.0 IV (global command conventions, fourth part) — SUITE-42
// continued: T12.0-15 (human-form reports). This registration carries the
// `build` and `check` family — T14-11's per-condition fixtures, T12.2-2's
// per-family workspaces, and T1.5-2's every arm — the gated reads' reports of
// the same findings on T13.3-3's stagings, and the non-UTF-8 marking clause
// on T1.5-2's arms; the `rename`/`move`, `impact`, `review`,
// `coverage`/`ids`/`show`, and exit-2 families are added beside them by the
// plan written at 2a2b94e's FIX_PLAN Tasks 131–135.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspaces (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), decodes reports through the H-3 adapters,
// and rejects a product only via diagnosed assertion failures (H-8).
//
// SPEC 12.0: where SPEC.md defines report content, the human report carries
// it and the JSON form the same information; the output form never changes
// an exit code or standard-error content; wherever an output carries a path
// that is not valid UTF-8 it is presented in an explicitly marked byte form
// carrying its exact bytes, distinguishable from every plain path string,
// deterministically, and a valid-UTF-8 path never in it. SPEC 14: every
// reported condition carries its stable code, a location per offending
// construct (its file and source range, 1.7), the file or path it concerns
// where it has no in-source location, and the identities it names.
//
// Conservative operationalizations (noted per H-3/H-4):
// - The twin (`expectHumanFindingsTwin`): at a fixture's state the
//   invocation runs with `--json` — its exit the staging's premise where the
//   home test pins one — and its stdout is decoded form-exact as the
//   findings-only report (12.7); the same argv without `--json` then runs on
//   the same pre-invocation state and must exit as its twin, its standard
//   error byte-identical (T12.0-2), and its report — decoded by the human
//   findings decoder (helpers/adapters/human-reports.ts: fitted to the
//   built product's layout, shape-aware, value-blind, failing loudly) —
//   must carry the twin's findings (`assertHumanFindingsReportCarries`):
//   every finding's stable code, its locations (each file and its range's
//   two byte offsets), its concerned path, and its identities, as multisets,
//   one human finding per `--json` finding, order free (SPEC fixes no order
//   for a findings report's human form; 12.7's is the JSON form's), each
//   path in form and bytes; a finding's message is free wording, never
//   compared (H-3). A human report printing nothing, or omitting or
//   changing any datum, fails, naming it against the nearest human finding.
// - The same pre-invocation state: where the run writes nothing at that
//   state — a failing `build` (12.1: it modifies nothing), `check` (13.3: it
//   never refreshes and writes nothing), a gated read on a failing workspace
//   (13.3) — both forms run on the workspace itself inside one whole-root
//   modifies-nothing compare, the lock path compared like any other path
//   (none of these acquires, 13.5; H-6), so the human run's state is the
//   `--json` run's pre-invocation state, observed. Where the run writes — a
//   mutating command (`review create`, `resolve`, `split`; 13.5), or a
//   successful `build` (T14-11's valid trailing-comma arm, T12.2-2's states
//   where `build` succeeds and regenerates) — each form runs on a fresh
//   byte copy of the state (`copyTreeBytes`, `.git` included, the lock path
//   left out unread as T6.4-1's human-form copy leaves it; each copy checked
//   against the workspace before anything runs there — a difference is a
//   harness error, never a product verdict; a copy composes no source text,
//   so S-9 has nothing to judge), the workspace itself untouched, so the
//   staging it belongs to continues exactly as its home test's does. A copy
//   is a different directory, so a product writing its absolute workspace
//   root to standard error would differ there across the two forms: the
//   built product writes nothing to standard error at exit 0 or 1.
// - The fixtures, each staged by its home module's own staging, never
//   re-spelled: T14-11's per-condition fixtures (section-14.ts
//   `T14_11_FIXTURES`: the range-rule arms, (n)'s repeated `d`, (ab)'s
//   trailing comma, and — Linux leg — (o)'s refused read, the unreadable
//   file left out of the compare), `build` (exit 1, or 0 at (ab)) and
//   `check` (exit 1: every fixture fails validation or, at (ab), was never
//   built) on each; T12.2-2's family states (section-12.1-12.2.ts
//   `runT1222Families`: each state its arms reach, the staging between
//   them T12.2-2's own), `build` (its exit unpinned there: T12.2-2 pins
//   `check`'s alone) and `check` (exit 1) at each; T1.5-2's every arm
//   (section-1.5.ts `T1_5_2_ARMS`, its located arm included, the non-UTF-8
//   arms on the Linux leg), `build` and `check` (exit 1 each) on each; and
//   T13.3-3's stagings (section-13.3.ts `runT1333GateStagings`: the
//   invalid-sources workspace, the garbage journal line and the obstructed
//   write path, each with its stale twin), each gated invocation's twin
//   (exit 1) — `ids`, `show`, `coverage`, `impact --base` where staged, and
//   `review status`, and the mutating `review` subcommands, gated past their
//   acquisition, on fresh copies — but `query`'s, a JSON-only surface with
//   no human form (SPEC 11). T13.3-3's own assertions (its pinned findings,
//   never-gated contrasts, and stale twins' premises) are its own: this
//   test asserts the two forms against each other.
// - Non-UTF-8 paths (12.0): on every arm of T1.5-2, each human report's
//   paths — every finding's location files and concerned path — must be,
//   as a multiset in form and bytes, exactly the paths T1.5-2 pins for the
//   arm (`T152Arm.expected`), whatever the `--json` twin carries: the
//   non-UTF-8 path, the 14.19 finding's concerned path and the located
//   arm's location file, presented in the marked byte form, which the
//   decoder tells from a plain path string by the mark alone and decodes to
//   the path's exact bytes (the staged bytes); and every valid-UTF-8 path —
//   the `#` and U+FFFD arms' concerned paths — a plain string, never marked.
//   A non-UTF-8 path printed raw fails the decode at once (a report's bytes
//   must be valid UTF-8); one printed lossily (U+FFFD-substituted) or
//   otherwise unmarked reads as a plain path differing from the marked one,
//   and a valid path printed marked as a marked path differing from the
//   plain one. On the Linux-leg non-UTF-8 arms each human report is run a
//   second time on the same state (inside the same compare), its stdout
//   byte-identical to the first's (H-6: deterministic presentation).

import { Buffer } from "node:buffer";
import type {
  Finding,
  HumanFindingsReport,
  PathValue,
} from "../../helpers/adapters/index.js";
import {
  assertHumanFindingsReportCarries,
  decodeFindingsReport,
  pathValueBytes,
  renderPathValue,
} from "../../helpers/adapters/index.js";
import {
  assertBytesEqual,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { EXCLUDE_LOCK_PATH, isLockPathBytes } from "../../helpers/lock-path.js";
import { stageReadRefusalOfFile } from "../../helpers/permissions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import {
  assertLeavesUnchanged,
  diffSnapshots,
  snapshotDirectory,
} from "../../helpers/snapshot.js";
import type { SnapshotOptions } from "../../helpers/snapshot.js";
import type { ProductBinding, RunResult } from "../../helpers/subprocess.js";
import { copyTreeBytes } from "../../helpers/tree-copy.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { T152Arm } from "./section-1.5.js";
import { stageT152Arm, T1_5_2_ARMS } from "./section-1.5.js";
import { runT1222Families } from "./section-12.1-12.2.js";
import { runT1333GateStagings } from "./section-13.3.js";
import { T14_11_FIXTURES } from "./section-14.js";
import { expectExit, runCli } from "./support.js";

// ---------------------------------------------------------------------------
// The twin
// ---------------------------------------------------------------------------

/**
 * Where a twin's two runs meet the pre-invocation state (the module
 * header): `"same"` — both on the workspace itself, inside one whole-root
 * modifies-nothing compare (a run writing nothing at that state);
 * `"fresh"` — each on its own fresh byte copy of the state, the workspace
 * untouched (a mutating command, or a run that writes).
 */
type TwinState = "same" | "fresh";

/** {@link expectHumanFindingsTwin}'s options. */
interface HumanFindingsTwinOptions {
  /** Where the two runs meet the pre-invocation state. */
  readonly state: TwinState;
  /**
   * The `--json` run's exit as the staging's premise, where the home test
   * pins one; absent, the twin asserts only that the human run exits as the
   * `--json` run did.
   */
  readonly expectedExit?: number;
  /**
   * Entries a `"same"` compare leaves out, unread — a file staged
   * unreadable, which no snapshot can read (T14-11 (o)).
   */
  readonly exclude?: SnapshotOptions["exclude"];
  /**
   * Run the human form a second time on the same state, its report
   * byte-identical to the first's (12.0's deterministic presentation of a
   * non-UTF-8 path; H-6).
   */
  readonly repeatHuman?: boolean;
}

/** One twin's outcome: the `--json` run's findings and the human report. */
interface HumanFindingsTwin {
  /** The `--json` twin's findings, decoded form-exact (12.7). */
  readonly findings: readonly Finding[];
  /** The human run. */
  readonly human: RunResult;
  /** Its report, decoded onto the information model. */
  readonly decoded: HumanFindingsReport;
}

/**
 * Run `body` on a fresh workspace holding a byte copy of `workspace` as it
 * stands (the module header): helpers/tree-copy.ts's `copyTreeBytes`
 * (directories, plain files, and symbolic links, names as bytes; `.git`
 * included), the lock path left out unread (`isLockPathBytes`: a product
 * may make its entries unreadable, H-4), checked against the original, the
 * lock path aside, before `body` runs — a difference is a harness error,
 * never a product verdict — then dispose of the copy (H-1).
 */
async function onFreshCopy<T>(
  workspace: TestWorkspace,
  context: string,
  body: (copy: TestWorkspace) => Promise<T>,
): Promise<T> {
  const copy = await TestWorkspace.create({});
  try {
    await copyTreeBytes(
      Buffer.from(workspace.root),
      Buffer.from(copy.root),
      isLockPathBytes,
    );
    const differences = diffSnapshots(
      await snapshotDirectory(workspace.root, EXCLUDE_LOCK_PATH),
      await snapshotDirectory(copy.root, EXCLUDE_LOCK_PATH),
    );
    if (differences.length > 0) {
      throw new Error(
        `harness error: ${context}: the byte copy of ${workspace.root} at ` +
          `${copy.root} differs from it (the lock path aside): ` +
          differences
            .slice(0, 10)
            .map((change) => `${change.change} ${change.path}`)
            .join(", "),
      );
    }
    return await body(copy);
  } finally {
    await copy.dispose();
  }
}

/**
 * The `--json` run's exit, or a diagnosed failure where it ended by signal
 * (H-5: every invocation's exact exit code is asserted).
 */
function exitOf(json: RunResult, context: string): number {
  if (json.exitCode === null) {
    fail(
      `${context}: the \`--json\` run ended by signal ${String(json.signal)}, ` +
        `never exiting — its human twin has no exit code to match (SPEC ` +
        `12.0; TEST-SPEC H-5, T12.0-15)`,
    );
  }
  return json.exitCode;
}

/**
 * Run the `--json` form at `at`: its exit asserted where the staging pins
 * one (`expectedExit`, the premise), else whatever it is (the twin then
 * asks the human form only to match it).
 */
async function runJsonForm(
  product: ProductBinding,
  at: TestWorkspace,
  jsonArgv: readonly string[],
  expectedExit: number | undefined,
  premise: string,
): Promise<RunResult> {
  if (expectedExit !== undefined) {
    return await expectExit(product, at, jsonArgv, expectedExit, premise);
  }
  return await runCli(product, at, jsonArgv);
}

/**
 * T12.0-15's twin of one findings-report invocation at the state a staging
 * left (the module header): `argv` with `--json` — its exit
 * `options.expectedExit` where given, the staging's premise — decoded
 * form-exact as the findings-only report (SPEC 12.7); then `argv` itself,
 * the human form, on the same pre-invocation state (`options.state`),
 * exiting as its `--json` twin with its standard error byte-identical
 * (SPEC 12.0: the output form never changes an exit code or
 * standard-error content; T12.0-2), its report decoded by the human
 * findings decoder and carrying the twin's findings — every code,
 * location, concerned path, and identity (TEST-SPEC T12.0-15;
 * `assertHumanFindingsReportCarries`); with `options.repeatHuman`, the
 * human form run again on the same state, its report byte-identical (H-6).
 */
async function expectHumanFindingsTwin(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  context: string,
  options: HumanFindingsTwinOptions,
): Promise<HumanFindingsTwin> {
  const jsonArgv = [...argv, "--json"];
  const jsonCommand = `\`${jsonArgv.join(" ")}\``;
  const humanCommand = `\`${argv.join(" ")}\` (human report)`;
  const premise =
    `${context}: ${jsonCommand} — the staging's premise: exit ` +
    `${String(options.expectedExit)}, as the home test pins it (SPEC 12.0)`;
  const humanExitWhy = (exit: number): string =>
    `${context}: ${humanCommand} — run without \`--json\` on the same ` +
    `pre-invocation state, it exits as its \`--json\` twin did ` +
    `(${String(exit)}; SPEC 12.0: the output form never changes an exit ` +
    `code; TEST-SPEC T12.0-15, T12.0-2)`;

  // The two forms against each other, once both have run.
  const judge = (json: RunResult, human: RunResult): HumanFindingsTwin => {
    const findings = decodeFindingsReport(
      parseJsonStdout(
        json,
        `${context}: ${jsonCommand} — a single JSON document as the ` +
          `entire stdout (SPEC 12.0)`,
      ),
      `${context}: ${jsonCommand}`,
    ).findings;
    assertBytesEqual(
      human.stderrBytes,
      json.stderrBytes,
      `${context}: ${humanCommand} — its standard error byte-identical to ` +
        `its \`--json\` twin's (SPEC 12.0: the output form never changes ` +
        `standard-error content; T12.0-2)`,
    );
    const decoded = assertHumanFindingsReportCarries(
      human,
      findings,
      `${context}: ${humanCommand}`,
    );
    return { findings, human, decoded };
  };
  const assertRepeated = (first: RunResult, again: RunResult): void => {
    assertBytesEqual(
      again.stdoutBytes,
      first.stdoutBytes,
      `${context}: ${humanCommand} run twice on the same state — the ` +
        `human report byte-identical across the two runs (SPEC 12.0: the ` +
        `marked byte form presented deterministically; TEST-SPEC T12.0-15, ` +
        `H-6)`,
    );
  };

  if (options.state === "same") {
    return await assertLeavesUnchanged(
      workspace.root,
      async () => {
        const json = await runJsonForm(
          product,
          workspace,
          jsonArgv,
          options.expectedExit,
          premise,
        );
        const exit = exitOf(json, `${context}: ${jsonCommand}`);
        const human = await expectExit(
          product,
          workspace,
          argv,
          exit,
          humanExitWhy(exit),
        );
        const twin = judge(json, human);
        if (options.repeatHuman === true) {
          assertRepeated(
            human,
            await expectExit(
              product,
              workspace,
              argv,
              exit,
              humanExitWhy(exit),
            ),
          );
        }
        return twin;
      },
      `${context}: ${jsonCommand} and its human twin on the same state — ` +
        `neither writes anything there, the lock path included (SPEC 12.1: ` +
        `a failing \`build\` modifies nothing; 13.3: \`check\` never ` +
        `refreshes, and a gated read on a failing workspace modifies ` +
        `nothing; none of them acquires, 13.5; TEST-SPEC H-6, T12.0-15)`,
      options.exclude === undefined ? {} : { exclude: options.exclude },
    );
  }
  const json = await onFreshCopy(
    workspace,
    `${context}: the state copied for ${jsonCommand}`,
    (copy) =>
      runJsonForm(product, copy, jsonArgv, options.expectedExit, premise),
  );
  const exit = exitOf(json, `${context}: ${jsonCommand}`);
  const human = await onFreshCopy(
    workspace,
    `${context}: the state copied for ${humanCommand}`,
    (copy) => expectExit(product, copy, argv, exit, humanExitWhy(exit)),
  );
  const twin = judge(json, human);
  if (options.repeatHuman === true) {
    assertRepeated(
      human,
      await onFreshCopy(
        workspace,
        `${context}: the state copied again for ${humanCommand}`,
        (copy) => expectExit(product, copy, argv, exit, humanExitWhy(exit)),
      ),
    );
  }
  return twin;
}

// ---------------------------------------------------------------------------
// `build` and `check`: T14-11's per-condition fixtures
// ---------------------------------------------------------------------------

/** A snapshot exclusion leaving out exactly the workspace-relative `rel`. */
function excludingFile(rel: string): SnapshotOptions["exclude"] {
  const bytes = Buffer.from(rel, "utf8");
  return (relPathBytes) => Buffer.from(relPathBytes).equals(bytes);
}

/**
 * T14-11's per-condition fixtures (section-14.ts `T14_11_FIXTURES`), each
 * on a fresh workspace staged as T14-11 stages it: `build` — exit 1 at a
 * staged condition, on the same state (a failing `build` modifies nothing,
 * 12.1); exit 0 at (ab)'s valid attribute, each form on a fresh copy (a
 * successful `build` writes) — then `check` on the same state, exit 1
 * (every fixture fails `build`'s validations or, at (ab), was never built:
 * 12.2, 14.10). At (o) the source is staged unreadable around both twins
 * (Linux leg, E-1), the file left out of the compares (no snapshot reads
 * it).
 */
async function runT1411Twins(product: ProductBinding): Promise<void> {
  for (const fixture of T14_11_FIXTURES) {
    const context = `T12.0-15 (T14-11 (${fixture.arm}) ${fixture.rule})`;
    const workspace = await TestWorkspace.create({ files: fixture.files });
    try {
      const staging =
        fixture.refused === undefined
          ? undefined
          : await stageReadRefusalOfFile(workspace.path(fixture.refused));
      try {
        const exclude =
          fixture.refused === undefined
            ? undefined
            : excludingFile(fixture.refused);
        await expectHumanFindingsTwin(product, workspace, ["build"], context, {
          state: fixture.buildExit === 0 ? "fresh" : "same",
          expectedExit: fixture.buildExit,
          ...(exclude === undefined ? {} : { exclude }),
        });
        await expectHumanFindingsTwin(product, workspace, ["check"], context, {
          state: "same",
          expectedExit: 1,
          ...(exclude === undefined ? {} : { exclude }),
        });
      } finally {
        await staging?.restore();
      }
    } finally {
      await workspace.dispose();
    }
  }
}

// ---------------------------------------------------------------------------
// `build` and `check`: T12.2-2's per-family workspaces
// ---------------------------------------------------------------------------

/**
 * T12.2-2's family states (section-12.1-12.2.ts `runT1222Families`: each
 * state its arms reach, staged as T12.2-2 stages it): at each, `build` —
 * each form on a fresh copy, its exit unpinned (T12.2-2 pins `check`'s
 * alone; where the sources pass, `build` succeeds and writes) — and
 * `check` on the same state, exit 1 (T12.2-2's family assertion: `check`
 * reports each family with exit 1).
 */
async function runT1222Twins(product: ProductBinding): Promise<void> {
  await runT1222Families(product, async (workspace, state) => {
    const context = `T12.0-15 (T12.2-2 ${state.label})`;
    await expectHumanFindingsTwin(product, workspace, ["build"], context, {
      state: "fresh",
    });
    await expectHumanFindingsTwin(product, workspace, ["check"], context, {
      state: "same",
      expectedExit: 1,
    });
  });
}

// ---------------------------------------------------------------------------
// `build` and `check`: T1.5-2's every arm, and the non-UTF-8 paths
// ---------------------------------------------------------------------------

/** Every path a finding carries: its location files, then its concerned path. */
function pathsOf(
  findings: readonly {
    readonly locations: readonly { readonly file: PathValue }[];
    readonly path: PathValue | null;
  }[],
): PathValue[] {
  return findings.flatMap((finding) => [
    ...finding.locations.map((location) => location.file),
    ...(finding.path === null ? [] : [finding.path]),
  ]);
}

/** A path's presentation and bytes, as one comparable key. */
function presentationKey(path: PathValue): string {
  return `${typeof path === "string" ? "plain" : "marked"}:${pathValueBytes(path).toString("hex")}`;
}

/** A path's presentation, rendered for a diagnosis. */
function describePresentation(path: PathValue): string {
  return typeof path === "string"
    ? `the plain string ${JSON.stringify(path)}`
    : `the marked byte form of ${renderPathValue(path)}`;
}

/**
 * T12.0-15's non-UTF-8 clause on one human report of a T1.5-2 arm (the
 * module header): the paths the decoded report presents — every finding's
 * location files and concerned path — are, as a multiset in form and
 * bytes, exactly the paths T1.5-2 pins for the arm, whatever the `--json`
 * twin carries: a non-UTF-8 path in the explicitly marked byte form
 * carrying its exact bytes (the decoder recognizing it by the mark alone),
 * every valid-UTF-8 path a plain string, never marked (SPEC 12.0, 12.7).
 */
function assertPathsPresented(
  decoded: HumanFindingsReport,
  arm: T152Arm,
  context: string,
): void {
  const expected = pathsOf(arm.expected);
  const presented = pathsOf(decoded.findings);
  const sortedKeys = (paths: readonly PathValue[]): string[] =>
    paths.map(presentationKey).sort();
  if (
    JSON.stringify(sortedKeys(presented)) ===
    JSON.stringify(sortedKeys(expected))
  ) {
    return;
  }
  fail(
    `${context}: every path T1.5-2's arm reports is presented in the form ` +
      `12.0 fixes, whatever the \`--json\` twin carries — a path that is ` +
      `not valid UTF-8 in the explicitly marked byte form carrying its ` +
      `exact bytes, told from a plain path string by the mark alone, and ` +
      `every valid-UTF-8 path (the \`#\` and U+FFFD arms' among them) a ` +
      `plain string, never marked (SPEC 12.0, 12.7; TEST-SPEC T12.0-15): ` +
      `the arm's findings carry [${expected.map(describePresentation).join(", ")}]; ` +
      `the human report presents [${presented.map(describePresentation).join(", ")}] ` +
      `(a path printed lossily, U+FFFD-substituted, or otherwise unmarked ` +
      `reads as a plain path; one printed marked, as a marked path).\n` +
      `Human report lines: ${decoded.findings.map((finding) => finding.text).join("\n")}`,
  );
}

/**
 * T1.5-2's every arm (section-1.5.ts `T1_5_2_ARMS`, the non-UTF-8 arms on
 * the Linux leg, where T1.5-2 stages them), each on a fresh workspace
 * staged as T1.5-2 stages it: `build`, then `check`, each exit 1 on the
 * same state (the arm fails `build`'s validations and was never built:
 * 12.1, 12.2), each human report's paths held to 12.0's forms
 * (`assertPathsPresented`), and on a non-UTF-8 arm each human report run
 * twice, byte-identical (H-6).
 */
async function runT152Twins(product: ProductBinding): Promise<void> {
  for (const arm of T1_5_2_ARMS) {
    if (arm.nonUtf8 && process.platform !== "linux") continue;
    const context = `T12.0-15 (T1.5-2 ${arm.label})`;
    const workspace = await stageT152Arm(arm);
    try {
      for (const command of ["build", "check"] as const) {
        const twin = await expectHumanFindingsTwin(
          product,
          workspace,
          [command],
          context,
          { state: "same", expectedExit: 1, repeatHuman: arm.nonUtf8 },
        );
        assertPathsPresented(
          twin.decoded,
          arm,
          `${context}: \`${command}\` (human report)`,
        );
      }
    } finally {
      await workspace.dispose();
    }
  }
}

// ---------------------------------------------------------------------------
// The gated reads' reports of the same findings: T13.3-3's stagings
// ---------------------------------------------------------------------------

/**
 * T13.3-3's stagings (section-13.3.ts `runT1333GateStagings`, staged as
 * T13.3-3 stages them, its own assertions left to it): at each gated
 * invocation but `query`'s — a JSON-only surface, no human form (SPEC 11)
 * — the human twin, exit 1 (the gate reports the findings a `build` would
 * report and answers nothing, 13.3): a gated read on the same state, a
 * mutating `review` subcommand each form on a fresh copy.
 */
async function runT1333Twins(product: ProductBinding): Promise<void> {
  await runT1333GateStagings(product, {
    home: false,
    probe: async (workspace, invocation) => {
      if (invocation.argv[0] === "query") return;
      await expectHumanFindingsTwin(
        product,
        workspace,
        invocation.argv.filter((token) => token !== "--json"),
        `T12.0-15 (${invocation.context})`,
        { state: invocation.mutating ? "fresh" : "same", expectedExit: 1 },
      );
    },
  });
}

// ---------------------------------------------------------------------------
// T12.0-15
// ---------------------------------------------------------------------------

const T12_0_15 = defineProductTest({
  id: "T12.0-15",
  title:
    "human-form reports — this registration's families: `build` and `check` on T14-11's per-condition fixtures, T12.2-2's per-family workspaces, and T1.5-2's every arm (its located arm included), and each gated read and mutating `review` subcommand on T13.3-3's stagings but `query` (JSON-only), each run again without `--json` on the same pre-invocation state (a fresh copy of it for a mutating command or a run that writes), exit as its `--json` twin, standard error byte-identical, its report — decoded by the human findings decoder — carrying every finding's stable code, locations (each file and its range's two byte offsets), concerned path, and identities as its twin does, order free, messages never compared, a human report printing nothing or omitting or changing any datum failing; and on T1.5-2's arms every reported path presented as 12.0 fixes, whatever the twin carries — the non-UTF-8 path (the condition-19 finding's concerned path, the located arm's location file) explicitly marked, the adapter recovering its exact bytes by the mark alone, each such report byte-identical across two runs on the same state, and every valid-UTF-8 path (the `#` and U+FFFD arms') a plain string, never marked; the `rename`/`move`, `impact`, `review`, `coverage`/`ids`/`show`, and exit-2 families follow (the plan written at 2a2b94e, FIX_PLAN Tasks 131–135) (SPEC 12.0, 12.7, 14, 1.7; H-3, H-6)",
  run: async (product) => {
    await runT1411Twins(product);
    await runT1222Twins(product);
    await runT152Twins(product);
    await runT1333Twins(product);
  },
});

/** TEST-SPEC §12.0 IV: T12.0-15, in canonical ID order (SUITE-42). */
export const section120ivTests: readonly ProductTestEntry[] = [T12_0_15];
