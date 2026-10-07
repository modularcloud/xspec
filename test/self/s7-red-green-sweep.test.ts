// S-7 red-green sweep (TEST-SPEC 17 S-7, §0 H-8). Against an empty stub
// product — every command exits with an unexpected code and no output — every
// product-facing test, the registry's entries and the bodies outside the
// registry alike, must fail with a diagnosed assertion failure (a
// `HarnessAssertionError`, helpers/assertions.ts), and the sweep must
// complete with no harness error, no hang, and no false pass.
//
// The sweep target is the harness-owned stub fixture
// (test/fixtures/empty-stub/bin.mjs), deliberately not src/'s pre-product
// placeholder: H-8 sanctions "a deliberately empty stub", and a sweep bound
// to the placeholder would lose its subject the moment Phase 10 implements
// the product. This file keeps S-7 green in every phase.
//
// Four layers, so the sweep's premise is pinned even while the registry is
// still being populated:
//   1. the stub fixture's own contract (unexpected exit code, silence,
//      no filesystem effects) is asserted directly;
//   2. a registry-convention probe body is run against the stub through the
//      certification runner, proving end to end that the committed fixture
//      produces exactly the diagnosed-failure taxonomy the sweep relies on;
//   3. the sweep proper runs every entry of the product-test manifest
//      (test/suite/registry/index.ts) against the stub via the certification
//      runner — the identical bodies and machinery C-1 certification uses
//      (C-2 one code path). While the manifest is empty (no SUITE-*/PROP-*
//      task has landed yet) the sweep is vacuously satisfied and layer 2
//      carries the check; suite completeness itself is gated elsewhere (S-1
//      traceability and the phase gate), not here;
//   4. the product-facing bodies outside the registry — §18's E-6
//      machinery, keyed to no registry entry — run against the stub through
//      the same runner, each wrapped as a synthetic entry in the reserved
//      section-99 ID space: the representative fixture
//      (`runE6RepresentativeFixture`, helpers/e6.ts), which
//      test/suite/e6-exchange-writer.test.ts and the Windows leg's
//      test/windows/e6-byte-identity.test.ts run before they touch the
//      exchange; the Windows leg's four single-casing probes
//      (test/windows/e6-subset.test.ts — T7-4's, T10.1-2's, T10.1-3's, and
//      T12.0-6's, the probe functions their registered bodies share); and
//      T11.6-1's drive-mismatch arm (`runT1161DriveMismatchArm`,
//      helpers/e6-drive-mismatch-arm.ts, the body of
//      test/windows/e6-drive-mismatch.test.ts). Each must reach the stub and
//      fail there, diagnosed, exactly as a registered body must.

import { expect, onTestFinished, test } from "vitest";
import { fileURLToPath } from "node:url";
import { assertExitCode } from "../helpers/assertions.js";
import { defineProductTest } from "../helpers/registry.js";
import type { ProductTestEntry } from "../helpers/registry.js";
import { runProduct } from "../helpers/subprocess.js";
import type { ProductBinding } from "../helpers/subprocess.js";
import { TestWorkspace } from "../helpers/workspace.js";
// Layer 4's bodies outside the registry. helpers/e6.ts and the drive-mismatch
// arm's records module (helpers/e6-drive-mismatch.ts, which the arm imports)
// create staged-source records at module load, so these two imports must
// precede the registry manifest's below, which seals the ledgers — a record
// created after the seal throws (test/self/s9-staged-sources.test.ts keeps
// the same order).
import { runE6RepresentativeFixture } from "../helpers/e6.js";
import { runT1161DriveMismatchArm } from "../helpers/e6-drive-mismatch-arm.js";
import { productTestSuite } from "../suite/registry/index.js";
import {
  runT1012SessionNameCasingProbe,
  runT1013WrongCaseExtensionProbe,
} from "../suite/registry/section-10.1.js";
import { runT1206SingleCasingPathProbe } from "../suite/registry/section-12.0-i.js";
import { runT74SingleCasingGlobProbe } from "../suite/registry/section-7-discovery.js";
import type { FixtureRunReport } from "./certification-runner.js";
import {
  renderFixtureReport,
  runProductTests,
} from "./certification-runner.js";

// The committed stub executable, resolved relative to this module — never to
// the process cwd. Exit code 87: outside the SPEC.md 12.0 partition (0|1|2)
// and distinct from src/'s placeholder 86 (see the fixture's own comments).
const STUB_BIN = fileURLToPath(
  new URL("../fixtures/empty-stub/bin.mjs", import.meta.url),
);
const STUB_EXIT_CODE = 87;

function emptyStubBinding(): ProductBinding {
  return {
    label: `empty-stub fixture product (exit ${STUB_EXIT_CODE}, no output)`,
    command: process.execPath,
    prefixArgs: [STUB_BIN],
    requiredFiles: [STUB_BIN],
  };
}

// Wall-clock ceiling for the full sweep. Against the stub every product
// invocation exits immediately, so bodies fail fast; this budget is purely a
// hang guard for the whole run (H-8), never an assertion input (H-10).
const SWEEP_TIMEOUT_MS = 600_000;

test("the empty-stub fixture exits with an unexpected code and writes nothing, whatever the command (the S-7 stub contract)", async () => {
  const workspace = await TestWorkspace.create();
  onTestFinished(() => workspace.dispose());
  // Representative invocation shapes across the SPEC.md 12 surface — the stub
  // ignores argv, so these pin that no command form gets a different answer.
  const invocations: readonly (readonly string[])[] = [
    [],
    ["build"],
    ["check", "--json"],
    ["ids"],
    ["query", "node", "specs/a.mdx#alpha"],
    ["impact", "--base", "HEAD"],
    ["review", "create", "--strategy", "audit"],
    // 13.5 choreography shape: the stub must exit without creating the hold
    // file (the waitForFile red-green path in helpers/subprocess.ts).
    [
      "rename",
      "specs/a.mdx#alpha",
      "beta",
      "--test-hold",
      workspace.path("hold"),
    ],
    ["not-a-command", "--nor", "a-flag"],
  ];
  for (const argv of invocations) {
    const result = await runProduct(emptyStubBinding(), {
      cwd: workspace.root,
      argv,
    });
    expect(result.exitCode, result.commandLine).toBe(STUB_EXIT_CODE);
    expect(result.signal, result.commandLine).toBeNull();
    expect(result.stdoutBytes.length, result.commandLine).toBe(0);
    expect(result.stderrBytes.length, result.commandLine).toBe(0);
  }
  // "No output" extends to the filesystem: the stub created nothing in the
  // workspace — no derived files, no journal, no hold file.
  expect(await workspace.readdirNames()).toEqual([]);
});

// A body following the registry conventions exactly (own workspace lifecycle,
// rejection only via the diagnosed-assertion helpers): what the runner sees
// here is what real suite bodies produce against the stub. Section-99 ID
// space is reserved for synthetic self-test entries; this entry is never part
// of the manifest.
const SWEEP_PREMISE_PROBE = defineProductTest({
  id: "T99.7-1",
  title:
    "sweep-premise probe: expects a specified exit code the stub never produces",
  run: async (product) => {
    const workspace = await TestWorkspace.create();
    try {
      const result = await runProduct(product, {
        cwd: workspace.root,
        argv: ["build"],
      });
      assertExitCode(result, 0, "sweep-premise probe `build`");
    } finally {
      await workspace.dispose();
    }
  },
});

test("a registry-convention body fails diagnosed against the committed stub via the certification runner (the sweep premise, H-8)", async () => {
  const report = await runProductTests(emptyStubBinding(), [
    SWEEP_PREMISE_PROBE,
  ]);
  expect(report.counts).toEqual({ pass: 0, fail: 1, error: 0, hang: 0 });
  const result = report.results[0]!;
  expect(result.outcome).toBe("fail");
  // Diagnosed, not crashed: the diagnosis names expectation and observation.
  expect(result.diagnosis).toContain("expected exit code 0");
  expect(result.diagnosis).toContain(`exit code ${STUB_EXIT_CODE}`);
});

test(
  "S-7: every product-facing test in the registry fails as a diagnosed assertion failure against the empty stub — the sweep completes with no false pass, harness error, or hang (H-8)",
  { timeout: SWEEP_TIMEOUT_MS },
  async () => {
    const entries = productTestSuite.all();
    if (entries.length === 0) {
      // Vacuously satisfied: no SUITE-*/PROP-* task has populated the
      // manifest yet. This is not a false pass — "every product-facing test
      // fails" holds over the empty set, the stub premise is pinned by the
      // two tests above, and suite completeness is enforced by the S-1
      // traceability self-check and the phase gate, not by S-7.
      return;
    }
    // Bodies are H-1-isolated and exit fast against the stub (every product
    // invocation terminates immediately), so a higher lane count than the
    // runner's conservative default is safe and keeps the sweep short.
    const report = await runProductTests(emptyStubBinding(), entries, {
      concurrency: 8,
    });
    const offenders = report.results.filter(
      (result) => result.outcome !== "fail",
    );
    if (offenders.length > 0) {
      throw new Error(
        `S-7 red-green sweep violated: ${offenders.length} of ${report.results.length} ` +
          `product-facing test(s) did not fail as a diagnosed assertion failure against the ` +
          `empty stub (H-8: a pass here is a false pass; an error or hang is a harness ` +
          `defect).\n${renderFixtureReport(report)}`,
      );
    }
    expect(report.counts).toEqual({
      pass: 0,
      fail: entries.length,
      error: 0,
      hang: 0,
    });
  },
);

// Layer 4 (module header): the product-facing bodies outside the registry,
// each wrapped as a synthetic entry in the reserved section-99 ID space
// (never part of the manifest), so the certification runner judges each
// exactly as it judges a registered body — a `HarnessAssertionError` a
// fail, anything else thrown an error, a normal return a pass, a body that
// never settles a hang. Each entry's budget is its own test's Vitest
// timeout: the two E-6 fixture tests allow 300 s for the fixture's 25
// invocations, the Windows leg's probes and arm the registry default.
const E6_FIXTURE_BUDGET_MS = 300_000;

const BODIES_OUTSIDE_THE_REGISTRY: readonly ProductTestEntry[] = [
  defineProductTest({
    id: "T99.7-2",
    title:
      "the E-6 representative fixture (`runE6RepresentativeFixture`, helpers/e6.ts), run first by test/suite/e6-exchange-writer.test.ts and test/windows/e6-byte-identity.test.ts",
    timeoutMs: E6_FIXTURE_BUDGET_MS,
    run: async (product) => {
      await runE6RepresentativeFixture(product);
    },
  }),
  defineProductTest({
    id: "T99.7-3",
    title:
      "T7-4's single-casing glob probe (`runT74SingleCasingGlobProbe`), rerun by test/windows/e6-subset.test.ts",
    run: runT74SingleCasingGlobProbe,
  }),
  defineProductTest({
    id: "T99.7-4",
    title:
      "T10.1-2's single-casing session-name probe (`runT1012SessionNameCasingProbe`), rerun by test/windows/e6-subset.test.ts",
    run: runT1012SessionNameCasingProbe,
  }),
  defineProductTest({
    id: "T99.7-5",
    title:
      "T10.1-3's wrong-case extension probe (`runT1013WrongCaseExtensionProbe`), rerun by test/windows/e6-subset.test.ts",
    run: runT1013WrongCaseExtensionProbe,
  }),
  defineProductTest({
    id: "T99.7-6",
    title:
      "T12.0-6's single-casing path probe (`runT1206SingleCasingPathProbe`), rerun by test/windows/e6-subset.test.ts",
    run: runT1206SingleCasingPathProbe,
  }),
  defineProductTest({
    id: "T99.7-7",
    title:
      "T11.6-1's drive-mismatch arm (`runT1161DriveMismatchArm`, helpers/e6-drive-mismatch-arm.ts), the body of test/windows/e6-drive-mismatch.test.ts",
    run: runT1161DriveMismatchArm,
  }),
];

/**
 * Layer 4's verdict (H-8): every body failed as a diagnosed assertion
 * failure, and each diagnosis names the stub's exit code — the body reached
 * the stub and was rejected for its answer (H-5: every test asserts the
 * exact exit code), not by a harness-side check before any invocation. Any
 * other outcome is named by test ID, with the runner's report.
 */
function expectEveryBodyFailedAtTheStub(report: FixtureRunReport): void {
  const stubAnswer = `exit code ${STUB_EXIT_CODE}`;
  const offenders = report.results.filter(
    (result) =>
      result.outcome !== "fail" ||
      !(result.diagnosis ?? "").includes(stubAnswer),
  );
  if (offenders.length > 0) {
    const named = offenders
      .map(
        (result) =>
          `${result.id} (${
            result.outcome === "fail"
              ? `a diagnosis not naming the stub's ${stubAnswer}`
              : result.outcome
          })`,
      )
      .join(", ");
    throw new Error(
      `S-7 red-green sweep violated outside the registry: ${named} — every ` +
        `product-facing body must fail as a diagnosed assertion failure at ` +
        `the empty stub's answer (H-8: a pass here is a false pass; an error ` +
        `or hang is a harness defect).\n${renderFixtureReport(report)}`,
    );
  }
  expect(report.counts).toEqual({
    pass: 0,
    fail: report.results.length,
    error: 0,
    hang: 0,
  });
}

test(
  "S-7: every product-facing body outside the registry — the E-6 representative fixture, the Windows leg's four single-casing probes (T7-4, T10.1-2, T10.1-3, T12.0-6), and T11.6-1's drive-mismatch arm — fails as a diagnosed assertion failure at the empty stub's answer, with no false pass, harness error, or hang (H-8)",
  { timeout: SWEEP_TIMEOUT_MS },
  async () => {
    // Six bodies, each exiting at its first invocation against the stub:
    // one lane apiece.
    const report = await runProductTests(
      emptyStubBinding(),
      BODIES_OUTSIDE_THE_REGISTRY,
      { concurrency: BODIES_OUTSIDE_THE_REGISTRY.length },
    );
    expectEveryBodyFailedAtTheStub(report);
  },
);
