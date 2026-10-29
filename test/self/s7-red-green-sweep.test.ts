// S-7 red-green sweep (TEST-SPEC 17 S-7, §0 H-8). Against an empty stub
// product — every command exits with an unexpected code and no output —
// beside an empty stub package (a directory holding only a manifest naming
// no entry; H-2's module channel), and again with no package directory
// given, every product-facing test, the registry's entries and the bodies
// outside the registry alike, must fail with a diagnosed assertion failure
// (a `HarnessAssertionError`, helpers/assertions.ts), and each sweep must
// complete with no harness error, no hang, and no false pass — 7.6's tests
// failing through their pairing (TEST-SPEC §7.6: a shape-violation arm
// counts only where its valid twin type-checks, a runtime absence only
// where the same run saw `defineConfig` return its argument), never passing
// on a negative arm alone. H-8's other half, a run with no product
// installed, holds the same bodies to the same verdict (layer 5).
//
// The sweep targets are two harness-owned fixtures, deliberately not src/'s
// pre-product placeholder or the product's own package directory: H-8
// sanctions "a deliberately empty stub", and a sweep bound to the product
// would lose its subject the moment Phase 10 implements it. This file keeps
// S-7 green in every phase.
//   - The stub product, test/fixtures/empty-stub/bin.mjs (its own comments
//     give its contract and its exit code's choice).
//   - The stub package, test/fixtures/empty-stub-package/, documented here
//     since JSON holds no comment: one file, `package.json`, a manifest
//     naming no entry — no `main`, `exports`, `types`, `typings`, `module`,
//     `imports`, or `bin` — whose only members are `name`,
//     `xspec-empty-stub`, and `version`, `0.0.0`; nothing else is in the
//     directory. Wherever a test places it, under whatever name, neither
//     TypeScript nor Node.js finds a module there — a specifier naming it
//     designates nothing — so every arm of 7.6 fails beside it through its
//     pairing. Its `name` is of 7.6's grammar, so that the tests reading the
//     manifest's `name` (T7.6-4(a), T7-9(d)) stage under it as they would
//     under the product's; and it is unscoped and differs from `xspec`, the
//     executable's name, which T7-9(d) stages as a name of its own, so that
//     no two of T7-9(d)'s names coincide. The sweep beside it gives every
//     body the directory as the binding's `packageDir`, exactly as committed
//     here, and afterwards finds it as it was: the harness copies a package
//     directory and reads its manifest, never writing into it (H-2).
//
// Five layers, so the sweep's premise is pinned even while the registry is
// still being populated:
//   1. the two stub fixtures' own contracts — the stub product's (unexpected
//      exit code, silence, no filesystem effects) and the stub package's
//      (the directory holds exactly `package.json`, a JSON object naming no
//      entry) — are asserted directly;
//   2. a registry-convention probe body is run against the stub through the
//      certification runner, proving end to end that the committed fixture
//      produces exactly the diagnosed-failure taxonomy the sweep relies on;
//   3. the sweep proper runs every entry of the product-test manifest
//      (test/suite/registry/index.ts) against the stub via the certification
//      runner — the identical bodies and machinery C-1 certification uses
//      (C-2 one code path) — in two sweeps (`STUB_SWEEPS`): the stub product
//      beside the stub package, given as the binding's `packageDir`, and
//      the stub product with no package directory given (H-8: a stub
//      package and a missing one alike hold every test of 7.6 to a diagnosed
//      failure). Each sweep's title and report name it, and the sweep beside
//      the stub package ends by finding the directory as it was. While the
//      manifest is empty (no SUITE-*/PROP-* task has landed yet) the sweeps
//      are vacuously satisfied and layer 2 carries the check; suite
//      completeness itself is gated elsewhere (S-1 traceability and the
//      phase gate), not here;
//   4. the product-facing bodies outside the registry — §18's E-6
//      machinery, keyed to no registry entry — run against the stub through
//      the same runner, in layer 3's two sweeps, each wrapped as a synthetic
//      entry in the reserved section-99 ID space: the representative fixture
//      (`runE6RepresentativeFixture`, helpers/e6.ts), which
//      test/suite/e6-exchange-writer.test.ts and the Windows leg's
//      test/windows/e6-byte-identity.test.ts run before they touch the
//      exchange; the Windows leg's five single-casing probes
//      (test/windows/e6-subset.test.ts — T7-1's, T7-4's, T10.1-2's,
//      T10.1-3's, and T12.0-6's, the probe functions their registered
//      bodies share); and
//      T11.6-1's drive-mismatch arm (`runT1161DriveMismatchArm`,
//      helpers/e6-drive-mismatch-arm.ts, the body of
//      test/windows/e6-drive-mismatch.test.ts). Each must reach the stub and
//      fail there, diagnosed, exactly as a registered body must;
//   5. H-8's no-product half: layer 2's probe, the registry's entries, and
//      layer 4's bodies run through the same runner against
//      `builtProductBindingAt(<absent>)` (helpers/subprocess.ts) — the
//      built product's binding shape, whose missing artifact is H-8's
//      missing product, at a path inside a fresh temporary directory the
//      test creates and nothing writes into. The artifact is absent
//      whatever the checkout's `dist/` holds, so this half means the same
//      locally, in CI's harness-self job (no product installed), and in its
//      full-suite job (the product built), and, like the stub, keeps its
//      subject in every phase. Each body must fail diagnosed, its diagnosis
//      naming the absent artifact: the driver's pre-flight refuses the
//      body's first product invocation, before anything is spawned. The
//      probe also runs against an unflagged binding of the certification
//      fixtures' shape over the same absent path, which must end a harness
//      error: an unbuilt fixture is a harness defect, never a certified
//      failure (C-1).

import { expect, onTestFinished, test } from "vitest";
import type { Stats } from "node:fs";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { assertExitCode } from "../helpers/assertions.js";
import { NO_SPAN_GUARD } from "../helpers/hang-guards.js";
import { defineProductTest } from "../helpers/registry.js";
import type { ProductTestEntry } from "../helpers/registry.js";
import { builtProductBindingAt, runProduct } from "../helpers/subprocess.js";
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
import { runT71ConfigNameCasingProbe } from "../suite/registry/section-7-basics.js";
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

// The committed stub package directory (module header), resolved like the
// stub executable: an absolute path, which the sweep beside the stub package
// gives every body exactly as spelled here.
const STUB_PACKAGE_DIR = fileURLToPath(
  new URL("../fixtures/empty-stub-package", import.meta.url),
);

/**
 * The stub product's binding: beside the stub package where `packageDir` is
 * given — the binding's package directory, as the built product's binding
 * carries the product's — and with no package directory otherwise, each
 * labelled with what it gives, so that a sweep's report names its sweep.
 */
function emptyStubBinding(packageDir?: string): ProductBinding {
  const product = `empty-stub fixture product (exit ${STUB_EXIT_CODE}, no output)`;
  const invocation = {
    command: process.execPath,
    prefixArgs: [STUB_BIN],
    requiredFiles: [STUB_BIN],
  };
  return packageDir === undefined
    ? { label: `${product}, no package directory given`, ...invocation }
    : {
        label: `${product} beside the empty stub package ${packageDir}`,
        ...invocation,
        packageDir,
      };
}

/** One of the two stub sweeps layers 3 and 4 run (module header). */
interface StubSweep {
  /** The sweep's name, in its tests' titles and its violation reports. */
  readonly name: string;
  /** The stub product's binding for the sweep. */
  readonly binding: ProductBinding;
}

const STUB_SWEEPS: readonly StubSweep[] = [
  {
    name: "beside the empty stub package",
    binding: emptyStubBinding(STUB_PACKAGE_DIR),
  },
  { name: "with no package directory given", binding: emptyStubBinding() },
];

// No guard of its own per sweep (TEST-SPEC S-3, helpers/hang-guards.ts): a
// sweep is a span over the bodies it runs, each stub invocation in them
// bounded by its own hang guard — against the stub every one exits at once,
// so bodies fail fast.

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

// Layer 1, the stub package (module header). The entry members of a
// manifest: the fields through which TypeScript's or Node.js's resolution,
// or a package manager, finds a module or an executable in a package.
const ENTRY_MEMBERS: readonly string[] = [
  "main",
  "exports",
  "types",
  "typings",
  "module",
  "imports",
  "bin",
];

// 7.6's grammar for an unscoped name (SPEC.md 7.6, *Package and
// installation*): a non-empty run of lowercase ASCII letters, digits, `-`,
// `.`, and `_` beginning with a letter or digit, at most 214 characters.
const UNSCOPED_NAME = /^[a-z0-9][a-z0-9._-]*$/;
const NAME_LENGTH_LIMIT = 214;

const LF = String.fromCodePoint(0x0a);
const BYTE_ORDER_MARK = String.fromCodePoint(0xfeff);

type EntryKind = "file" | "directory" | "symbolic link" | "other";

function kindOf(stats: Stats): EntryKind {
  if (stats.isFile()) return "file";
  if (stats.isDirectory()) return "directory";
  if (stats.isSymbolicLink()) return "symbolic link";
  return "other";
}

/** An entry of the stub package as read, never followed. */
interface PackageEntryState {
  readonly name: string;
  readonly kind: EntryKind;
  readonly mode: number;
  /** A regular file's bytes, base64; null for any other kind. */
  readonly bytes: string | null;
}

/**
 * The stub package directory read afresh: its own kind and mode, and each
 * entry, in name order — what layer 1 pins, and what a sweep beside the
 * stub package must leave as it found it.
 */
interface StubPackageState {
  readonly kind: EntryKind;
  readonly mode: number;
  readonly entries: readonly PackageEntryState[];
}

async function readStubPackage(): Promise<StubPackageState> {
  const directory = await fsp.lstat(STUB_PACKAGE_DIR);
  const entries: PackageEntryState[] = [];
  for (const name of (await fsp.readdir(STUB_PACKAGE_DIR)).sort()) {
    const entryPath = path.join(STUB_PACKAGE_DIR, name);
    const stats = await fsp.lstat(entryPath);
    entries.push({
      name,
      kind: kindOf(stats),
      mode: stats.mode,
      bytes: stats.isFile()
        ? (await fsp.readFile(entryPath)).toString("base64")
        : null,
    });
  }
  return { kind: kindOf(directory), mode: directory.mode, entries };
}

test("the empty stub package is a directory holding exactly one file, `package.json`: a manifest naming no entry, a JSON object whose only members are a `name` of 7.6's grammar — unscoped, and not `xspec` — and a `version`, in canonical form (the S-7 stub package contract; H-2's module channel)", async () => {
  const state = await readStubPackage();
  expect(state.kind, STUB_PACKAGE_DIR).toBe("directory");
  expect(
    state.entries.map(({ name, kind }) => `${name} (${kind})`),
    "the stub package holds one regular file, its manifest, and nothing else",
  ).toEqual(["package.json (file)"]);
  const bytes = Buffer.from(state.entries[0]!.bytes!, "base64");
  // UTF-8 (`fatal`: an ill-formed sequence throws), a byte-order mark kept
  // (`ignoreBOM`) so that it is seen and refused.
  const text = new TextDecoder("utf-8", {
    fatal: true,
    ignoreBOM: true,
  }).decode(bytes);
  expect(
    text.startsWith(BYTE_ORDER_MARK),
    "the stub package's manifest carries no byte-order mark",
  ).toBe(false);
  const manifest: unknown = JSON.parse(text);
  if (
    typeof manifest !== "object" ||
    manifest === null ||
    Array.isArray(manifest)
  ) {
    throw new Error(
      `the stub package's manifest is not a JSON object: ${text}`,
    );
  }
  const members = Object.keys(manifest);
  expect(
    ENTRY_MEMBERS.filter((member) => members.includes(member)),
    "the stub package's manifest names no entry",
  ).toEqual([]);
  expect(
    members,
    "the stub package's manifest holds a name and a version, and nothing else",
  ).toEqual(["name", "version"]);
  const { name, version } = manifest as Record<string, unknown>;
  expect(
    typeof name === "string" &&
      UNSCOPED_NAME.test(name) &&
      name.length <= NAME_LENGTH_LIMIT,
    `the manifest's name ${JSON.stringify(name)} is an unscoped name of 7.6's grammar`,
  ).toBe(true);
  expect(
    name,
    "the manifest's name differs from `xspec`, the executable's name, which T7-9(d) stages as a name of its own",
  ).not.toBe("xspec");
  expect(
    typeof version === "string" && version !== "",
    `the manifest's version ${JSON.stringify(version)} is a non-empty string`,
  ).toBe(true);
  // Canonical form — two-space JSON ending in one line feed, Prettier's form
  // for a package.json — which also rules out a repeated member name, whose
  // earlier value JSON.parse drops silently.
  expect(
    text,
    "the stub package's manifest is in canonical form, no member name repeated",
  ).toBe(`${JSON.stringify(manifest, null, 2)}${LF}`);
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

/**
 * The stub package's state before a sweep beside it, read afresh (H-2: the
 * harness never writes into a package directory); null for a sweep with no
 * package directory given.
 */
async function stubPackageBefore(
  sweep: StubSweep,
): Promise<StubPackageState | null> {
  return sweep.binding.packageDir === undefined
    ? null
    : await readStubPackage();
}

/**
 * A sweep beside the stub package found it as it was before the sweep: its
 * kind and mode, and each entry's kind, mode, and bytes (H-2: the harness
 * copies a package directory and reads its manifest, never writing into it).
 */
async function expectStubPackageAsBefore(
  sweep: StubSweep,
  before: StubPackageState | null,
): Promise<void> {
  if (before === null) {
    return;
  }
  expect(
    await readStubPackage(),
    `S-7's sweep ${sweep.name} left the stub package ${STUB_PACKAGE_DIR} ` +
      `as it found it (H-2: the harness never writes into a package directory)`,
  ).toStrictEqual(before);
}

/** The words a test title adds for a sweep beside the stub package. */
function packageClause(sweep: StubSweep): string {
  return sweep.binding.packageDir === undefined
    ? ""
    : ", the stub package left as the sweep found it (H-2)";
}

/**
 * Layer 3's verdict (H-8): every registered body failed as a diagnosed
 * assertion failure in `sweep`. Any other outcome is named by count, with
 * the sweep's name and the runner's report.
 */
function expectEveryEntryFailed(
  report: FixtureRunReport,
  sweep: StubSweep,
): void {
  const offenders = report.results.filter(
    (result) => result.outcome !== "fail",
  );
  if (offenders.length > 0) {
    throw new Error(
      `S-7 red-green sweep ${sweep.name} violated: ${offenders.length} of ${report.results.length} ` +
        `product-facing test(s) did not fail as a diagnosed assertion failure against the ` +
        `empty stub (H-8: a pass here is a false pass; an error or hang is a harness ` +
        `defect).\n${renderFixtureReport(report)}`,
    );
  }
  expect(report.counts).toEqual({
    pass: 0,
    fail: report.results.length,
    error: 0,
    hang: 0,
  });
}

for (const sweep of STUB_SWEEPS) {
  test(
    `S-7, ${sweep.name}: every product-facing test in the registry fails as a diagnosed assertion failure against the empty stub — the sweep completes with no false pass, harness error, or hang (H-8)${packageClause(sweep)}`,
    { timeout: NO_SPAN_GUARD },
    async () => {
      const entries = productTestSuite.all();
      if (entries.length === 0) {
        // Vacuously satisfied: no SUITE-*/PROP-* task has populated the
        // manifest yet. This is not a false pass — "every product-facing
        // test fails" holds over the empty set, the stub premise is pinned
        // by layers 1 and 2, and suite completeness is enforced by the S-1
        // traceability self-check and the phase gate, not by S-7.
        return;
      }
      const before = await stubPackageBefore(sweep);
      // Bodies are H-1-isolated and exit fast against the stub (every
      // product invocation terminates immediately), so a higher lane count
      // than the runner's conservative default is safe and keeps the sweep
      // short.
      const report = await runProductTests(sweep.binding, entries, {
        concurrency: 8,
      });
      expectEveryEntryFailed(report, sweep);
      expect(report.results).toHaveLength(entries.length);
      await expectStubPackageAsBefore(sweep, before);
    },
  );
}

// Layer 4 (module header): the product-facing bodies outside the registry,
// each wrapped as a synthetic entry in the reserved section-99 ID space
// (never part of the manifest), so the certification runner judges each
// exactly as it judges a registered body — a `HarnessAssertionError` a
// fail, the driver's hang-guard kill a hang, anything else thrown an error,
// a normal return a pass. Like a registered entry, each carries no time
// budget of its own (TEST-SPEC S-3), nor do the tests running them. A
// synthetic ID, once assigned, stays its body's: a body added later takes
// the next free number wherever it stands in the list (T7-1's probe,
// T99.7-8, stands with the other single-casing probes).

const BODIES_OUTSIDE_THE_REGISTRY: readonly ProductTestEntry[] = [
  defineProductTest({
    id: "T99.7-2",
    title:
      "the E-6 representative fixture (`runE6RepresentativeFixture`, helpers/e6.ts), run first by test/suite/e6-exchange-writer.test.ts and test/windows/e6-byte-identity.test.ts",
    run: async (product) => {
      await runE6RepresentativeFixture(product);
    },
  }),
  defineProductTest({
    id: "T99.7-8",
    title:
      "T7-1's single-casing configuration-name probe (`runT71ConfigNameCasingProbe`), rerun by test/windows/e6-subset.test.ts",
    run: runT71ConfigNameCasingProbe,
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
 * Layer 4's verdict (H-8): in `sweep`, every body failed as a diagnosed
 * assertion failure, and each diagnosis names the stub's exit code — the
 * body reached the stub and was rejected for its answer (H-5: every test
 * asserts the exact exit code), not by a harness-side check before any
 * invocation. Any other outcome is named by test ID, with the sweep's name
 * and the runner's report.
 */
function expectEveryBodyFailedAtTheStub(
  report: FixtureRunReport,
  sweep: StubSweep,
): void {
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
      `S-7 red-green sweep ${sweep.name} violated outside the registry: ${named} — every ` +
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

for (const sweep of STUB_SWEEPS) {
  test(
    `S-7, ${sweep.name}: every product-facing body outside the registry — the E-6 representative fixture, the Windows leg's five single-casing probes (T7-1, T7-4, T10.1-2, T10.1-3, T12.0-6), and T11.6-1's drive-mismatch arm — fails as a diagnosed assertion failure at the empty stub's answer, with no false pass, harness error, or hang (H-8)${packageClause(sweep)}`,
    { timeout: NO_SPAN_GUARD },
    async () => {
      const before = await stubPackageBefore(sweep);
      // Seven bodies, each exiting at its first invocation against the
      // stub: one lane apiece.
      const report = await runProductTests(
        sweep.binding,
        BODIES_OUTSIDE_THE_REGISTRY,
        { concurrency: BODIES_OUTSIDE_THE_REGISTRY.length },
      );
      expectEveryBodyFailedAtTheStub(report, sweep);
      await expectStubPackageAsBefore(sweep, before);
    },
  );
}

// Layer 5 (module header): H-8's no-product half — the same bodies against
// the built product's binding shape at an artifact path guaranteed absent,
// never the checkout's `dist/cli/bin.js`, so they meet exactly what a run
// with no product installed meets, whatever this checkout or CI job built.

/** Layer 5's binding and the absent artifact its diagnoses must name. */
interface NoProductStaging {
  /** `builtProductBindingAt(artifact)`: the flagged built-product shape. */
  readonly binding: ProductBinding;
  /** The absent artifact path. */
  readonly artifact: string;
  /** The fresh directory the path lies in, which nothing may write into. */
  readonly directory: string;
}

/**
 * Create a fresh temporary directory, removed when the test finishes, and
 * bind the built product's shape at `dist/cli/bin.js` inside it — a path
 * nothing creates, so the artifact is absent however the checkout's own
 * `dist/` stands.
 */
async function noProductStaging(): Promise<NoProductStaging> {
  const directory = await fsp.mkdtemp(
    path.join(os.tmpdir(), "xspec-s7-no-product-"),
  );
  onTestFinished(() => fsp.rm(directory, { recursive: true, force: true }));
  const artifact = path.join(directory, "dist", "cli", "bin.js");
  return { binding: builtProductBindingAt(artifact), artifact, directory };
}

/**
 * Layer 5's verdict (H-8: no product installed): every body failed as a
 * diagnosed assertion failure whose diagnosis names the absent artifact —
 * the driver's pre-flight refused the body's first product invocation,
 * nothing spawned — never a harness error, a hang, or a pass. Any other
 * outcome is named by test ID, with the runner's report.
 */
function expectEveryBodyFailedAtTheMissingProduct(
  report: FixtureRunReport,
  artifact: string,
  where: string,
): void {
  const offenders = report.results.filter(
    (result) =>
      result.outcome !== "fail" || !(result.diagnosis ?? "").includes(artifact),
  );
  if (offenders.length > 0) {
    const named = offenders
      .map(
        (result) =>
          `${result.id} (${
            result.outcome === "fail"
              ? "a diagnosis not naming the absent artifact"
              : result.outcome
          })`,
      )
      .join(", ");
    throw new Error(
      `H-8's no-product sweep violated ${where}: ${offenders.length} of ` +
        `${report.results.length} product-facing body(ies) — ${named} — did ` +
        `not fail as a diagnosed assertion failure naming the absent ` +
        `artifact ${artifact} (H-8: with no product installed, a pass is a ` +
        `false pass; an error or hang is a harness defect).\n` +
        renderFixtureReport(report),
    );
  }
  expect(report.counts).toEqual({
    pass: 0,
    fail: report.results.length,
    error: 0,
    hang: 0,
  });
}

test("H-8, no product installed: a registry-convention body fails diagnosed against the built product's binding shape at an absent artifact, its diagnosis naming the artifact, and ends a harness error against the certification fixtures' unflagged shape over the same path (the no-product premise, via the certification runner; C-1: an unbuilt fixture is a harness defect)", async () => {
  const { binding, artifact, directory } = await noProductStaging();
  const report = await runProductTests(binding, [SWEEP_PREMISE_PROBE]);
  expect(report.counts).toEqual({ pass: 0, fail: 1, error: 0, hang: 0 });
  expect(report.results[0]!.diagnosis).toContain(artifact);

  // The certification fixtures' binding shape (certification-fixtures.ts),
  // its executable unbuilt: `missingFilesFailDiagnosed` left unset.
  const unbuiltFixture: ProductBinding = {
    label: "unbuilt fixture product (the certification fixtures' shape)",
    command: process.execPath,
    prefixArgs: [artifact],
    requiredFiles: [artifact],
  };
  const fixtureReport = await runProductTests(unbuiltFixture, [
    SWEEP_PREMISE_PROBE,
  ]);
  expect(fixtureReport.counts).toEqual({
    pass: 0,
    fail: 0,
    error: 1,
    hang: 0,
  });
  // The harness error is the pre-flight's, naming the same artifact.
  expect(fixtureReport.results[0]!.diagnosis).toContain(artifact);
  expect(await fsp.readdir(directory)).toEqual([]);
});

test(
  "H-8, no product installed: every product-facing test in the registry fails as a diagnosed assertion failure naming the absent artifact, against the built product's binding shape at it — the sweep completes with no false pass, harness error, or hang",
  { timeout: NO_SPAN_GUARD },
  async () => {
    const entries = productTestSuite.all();
    if (entries.length === 0) {
      // Vacuously satisfied over an empty manifest, as the stub sweep is.
      return;
    }
    const { binding, artifact, directory } = await noProductStaging();
    // Every body fails at its first product invocation's pre-flight,
    // nothing spawned: the stub sweep's lane count is as safe here.
    const report = await runProductTests(binding, entries, {
      concurrency: 8,
    });
    expectEveryBodyFailedAtTheMissingProduct(
      report,
      artifact,
      "in the registry",
    );
    expect(await fsp.readdir(directory)).toEqual([]);
  },
);

test(
  "H-8, no product installed: every product-facing body outside the registry — the E-6 representative fixture, the Windows leg's five single-casing probes (T7-1, T7-4, T10.1-2, T10.1-3, T12.0-6), and T11.6-1's drive-mismatch arm — fails as a diagnosed assertion failure naming the absent artifact, against the built product's binding shape at it, with no false pass, harness error, or hang",
  { timeout: NO_SPAN_GUARD },
  async () => {
    const { binding, artifact, directory } = await noProductStaging();
    const report = await runProductTests(binding, BODIES_OUTSIDE_THE_REGISTRY, {
      concurrency: BODIES_OUTSIDE_THE_REGISTRY.length,
    });
    expectEveryBodyFailedAtTheMissingProduct(
      report,
      artifact,
      "outside the registry",
    );
    expect(await fsp.readdir(directory)).toEqual([]);
  },
);
