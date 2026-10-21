// S-3 hang guards, the pre-product checks (TEST-SPEC S-3, with H-8, H-10,
// E-5, and section 16's preamble; AGENTS.md, "Hang guards (TEST-SPEC S-3)";
// helpers/hang-guards.ts). Conformer and violators answering far below every
// guard, guard sizing is harness behavior certification cannot exercise, so
// S-3 has its rule checked before any product exists, against stand-ins.
// The harness follows S-3's conservative design: no span — a test, a trial
// loop, a property and its shrink phase, a held run across what the harness
// drives during its hold, a certification verification, a sweep — carries a
// guard of its own, so the guard each applies (none) is no less than the
// compositional bound over what it spans, at whatever count its staging
// fixes or yields, and no guard needs deriving. These checks establish, for
// every kind of span, that none applies a guard, and drive each machinery a
// span runs through against stand-in spans long enough that a guard below
// the sum of the own guards they span would fire:
//
// - The delayed span: a body spanning stand-in invocations, each taking a
//   fixed delay well inside its own guard (shrunk for the self-test, never
//   the delay below it), their delays together past one such guard, passes
//   — declared with the framework options `declareProductTests` gives every
//   registered entry (recorded below), run inside `runProductTestBody` as
//   the suite's wrapper runs it, and under the certification runner.
// - The never-terminating invocation: a body whose second invocation never
//   terminates ends with the driver's hang-guard kill within that
//   invocation's own guard, nothing staged after it started, and the runner
//   records the test's hang.
// - Every registered test: `declareProductTests`, through a recorder
//   (test/suite/declare.ts), declares each entry of the manifest with the
//   framework timeout NO_SPAN_GUARD — 0, under which Vitest arms no timer —
//   in projects whose `testTimeout` is 0 (test/vitest.config.ts), and no
//   entry carries a budget of its own.
// - Every limit the harness sets, by a scan of its own TypeScript (every
//   `.ts` file under test/, the fixture products of test/fixtures/ aside),
//   parsed with the harness's own TypeScript:
//   (a) in every file, no test-framework declaration — Vitest's `test`,
//       `it`, `describe`, `suite`, `bench`, and test/suite/declare.ts's
//       declarer — names a timeout but NO_SPAN_GUARD or 0, no configuration
//       a `testTimeout` but 0, and no `vi.setConfig` sets one;
//   (b) in the span machinery — the registry and its staging modules and
//       the suite's wrappers (test/suite/), the Windows leg (test/windows/),
//       the local set (test/local/), the helpers (test/helpers/), the
//       certification runner, its fixture manifest, the certification
//       verifications, and the S-7 sweeps — no timer races work
//       (`Promise.race`, `AbortSignal.timeout`, a global `setTimeout` or
//       `setInterval`: delays are timers/promises' `setTimeout`, imported
//       as `sleep`), and no clock comparison can end work (a clock reading
//       — `Date.now()`, `performance.now()`, `process.hrtime` — compared,
//       or a value computed from one in the same function compared with a
//       bound other than zero or guarding a throw or a `fail`; no name
//       holding the word "deadline"), but at the own-guard sites listed
//       below, `OWN_GUARD_SITES` — the per-invocation guard, the
//       harness-step guards, and the bounds of harness steps after a kill
//       or of harness subprocesses and the harness's own helper processes —
//       each of which the scan must still find;
//   (c) there, no hold is observed or lifted but through the driver: no
//       path named for a hold (an identifier or member whose words include
//       "hold", the suite's convention) is deleted but by
//       `releaseHoldFile`, nor probed for existence inside a polling loop
//       (one that sleeps) but by `waitForFile` or `holdFileStands`, so every
//       hold the suite keeps standing suspends its run's own guard
//       (helpers/subprocess.ts; s3-subprocess-driver.test.ts pins the
//       suspension).
//   The scanner itself is pinned on synthetic sources: each construct it
//   must flag — P-10's hold wait as it stood before S-3's design among them
//   — is flagged, and the delays, measurements, own guards, and assertions
//   the suite writes are not.
// - Properties at the fixed seeds: `checkProperty` (helpers/property.ts),
//   which every section-16 property runs through, applies no guard over its
//   trials — a property whose fixed-seed trials each run a delayed stand-in
//   invocation, together past one own guard, passes, its trial count the
//   one its staging fixes (seeds × runs).
// - Spans whose count is known only once staged, at differing counts:
//   voidable trials (`runVoidableTrial`, helpers/kill-discipline.ts — T13.5-3's
//   reuse check and T13.5-10's stagings) voided a differing number of times;
//   a property's shrink phase, entered only once the property has failed,
//   against stand-ins failing the property at differing draws, each phase
//   run to the very counterexample and execution count its invocation-free
//   twin's shrink yields — a guard cutting it short would end it at fewer;
//   and the
//   companion stagings of T6.5-20(a), (c), (e) and T13.4-9(e), one per
//   companion path a build records, read through their shared reading
//   (`readRecordedCompanionPaths`, test/suite/registry/support.ts) from
//   stand-in `recorded` sets of differing sizes — and T13.3-5(a)'s
//   tampering trials, as many as the files a product writes under `.xspec/`
//   yield (rounds of one alteration per nonempty file, at least eight
//   trials per fixed seed, and, where the product writes several files
//   there, the mixes of two product-written states), read through their
//   shared reading (`readTamperingTrials`,
//   test/suite/registry/section-13.3.ts) from the stand-in file sets of one
//   and two files a stand-in `build` writes — at each count no guard is
//   applied, the longest span past one own guard.
// - A held run's span: while the harness keeps the hold standing it drives
//   invocations whose delays together pass the held run's own guard, which
//   stands suspended (helpers/subprocess.ts), and the run completes once
//   lifted.
//
// The stand-in is a tiny argv-driven Node script written into a fresh
// TestWorkspace (S-2 certifies the builder), driven through the
// ProductBinding shape every product-facing test uses (the driver itself is
// S-3's s3-subprocess-driver.test.ts). Synthetic registry entries take the
// reserved section-99 ID space (T99.3-*). Nothing here depends on the built
// product: these checks pass in every phase (H-8).

import { Buffer } from "node:buffer";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript-5.9.3";
import { expect, onTestFinished, test } from "vitest";
import {
  assertBytesEqual,
  assertExitCode,
  fail,
} from "../helpers/assertions.js";
import { isHangGuardKill, NO_SPAN_GUARD } from "../helpers/hang-guards.js";
import { runVoidableTrial, voidTrial } from "../helpers/kill-discipline.js";
import { runProductTestBody } from "../helpers/product-invocations.js";
import {
  checkProperty,
  DEFAULT_PROPERTY_SEEDS,
  PropertyFalsifiedError,
} from "../helpers/property.js";
import { defineProductTest } from "../helpers/registry.js";
import type { ProductTestEntry } from "../helpers/registry.js";
import {
  ProductRunTimeoutError,
  releaseHoldFile,
  runProduct,
  startProduct,
} from "../helpers/subprocess.js";
import type { ProductBinding } from "../helpers/subprocess.js";
import { TestWorkspace } from "../helpers/workspace.js";
import { declareProductTests } from "../suite/declare.js";
import type { ProductTestDeclarationOptions } from "../suite/declare.js";
import { productTestSuite } from "../suite/registry/index.js";
import { readTamperingTrials } from "../suite/registry/section-13.3.js";
import { readRecordedCompanionPaths } from "../suite/registry/support.js";
import { runProductTests } from "./certification-runner.js";

// ---------------------------------------------------------------------------
// The stand-in
// ---------------------------------------------------------------------------

// Known-behavior stand-in: every mode's observable behavior is fixed by this
// source. `pause <ms>` answers "ok" after a fixed delay; `verdict <threshold>
// <value> <ms>` exits 0 below the threshold and 1 at or past it after a
// fixed delay (a stand-in failing a property at the draws it names); `hang`
// never terminates; `held --test-hold <path>` creates the hold file and
// exits 0 once it is deleted; `build` writes the stand-in graph-data file
// set its environment names — `XSPEC_S3_GRAPH_FILES` files under `.xspec/`,
// `s3g0` onward, each holding the bytes of `s3-source.txt` and its index,
// none when the variable is unset — and exits 0; `inventory` answers the
// `recorded` set its environment names.
const STANDIN_SOURCE = `import fs from "node:fs";

const [mode, ...args] = process.argv.slice(2);
switch (mode) {
  case "pause": {
    setTimeout(() => {
      process.stdout.write("ok\\n");
      process.exit(0);
    }, Number(args[0]));
    break;
  }
  case "verdict": {
    setTimeout(() => {
      process.exit(Number(args[1]) >= Number(args[0]) ? 1 : 0);
    }, Number(args[2]));
    break;
  }
  case "hang": {
    setInterval(() => {}, 60000);
    break;
  }
  case "held": {
    const hold = args[args.indexOf("--test-hold") + 1];
    fs.writeFileSync(hold, "");
    const poll = setInterval(() => {
      if (!fs.existsSync(hold)) {
        clearInterval(poll);
        process.stdout.write("released");
        process.exit(0);
      }
    }, 10);
    break;
  }
  case "build": {
    const count = Number(process.env.XSPEC_S3_GRAPH_FILES ?? "0");
    if (count > 0) {
      const source = fs.readFileSync("s3-source.txt");
      fs.mkdirSync(".xspec", { recursive: true });
      for (let index = 0; index < count; index += 1) {
        fs.writeFileSync(
          ".xspec/s3g" + String(index),
          Buffer.concat([source, Buffer.from(String(index))]),
        );
      }
    }
    process.exit(0);
    break;
  }
  case "inventory": {
    const recorded = JSON.parse(process.env.XSPEC_S3_RECORDED ?? "[]");
    process.stdout.write(JSON.stringify({ recorded }));
    process.exit(0);
    break;
  }
  default: {
    process.stderr.write("unknown mode: " + String(mode));
    process.exit(99);
  }
}
`;

interface Standin {
  readonly workspace: TestWorkspace;
  readonly binding: ProductBinding;
}

/** A fresh workspace holding the stand-in, its binding pinning `env`. */
async function standin(
  env: Readonly<Record<string, string>> = {},
): Promise<Standin> {
  const workspace = await TestWorkspace.create({
    files: { "standin.mjs": STANDIN_SOURCE },
  });
  onTestFinished(() => workspace.dispose());
  return {
    workspace,
    binding: {
      label: "S-3 hang-guard stand-in",
      command: process.execPath,
      prefixArgs: [workspace.path("standin.mjs")],
      env,
    },
  };
}

/** A stand-in invocation's fixed delay. */
const DELAY_MS = 600;
/**
 * Each stand-in invocation's own guard: shrunk for the self-test, the delay
 * well inside it, loaded runs included (E-5).
 */
const OWN_GUARD_MS = 2_000;
/** The delayed span's length: its delays together past one own guard. */
const SPAN_LENGTH = 4;
/** The never-terminating invocation's own guard. */
const HANG_GUARD_MS = 1_500;
/**
 * How long past the hanging invocation's own guard its test may take to end
 * — the brief invocation before it, the kill, and collecting its exit under
 * load — far below any span guard's expiry.
 */
const HANG_SLACK_MS = 5_000;
/** A shrink execution's stand-in delay and own guard. */
const SHRINK_DELAY_MS = 100;
const SHRINK_GUARD_MS = 1_000;

/** Run `work`, timing it. */
async function timed<T>(
  work: () => Promise<T>,
): Promise<{ readonly value: T; readonly ms: number }> {
  const started = performance.now();
  const value = await work();
  return { value, ms: performance.now() - started };
}

/** One delayed stand-in invocation, required to answer as the stand-in does. */
async function delayedInvocation(
  binding: ProductBinding,
  cwd: string,
  context: string,
): Promise<void> {
  const result = await runProduct(binding, {
    cwd,
    argv: ["pause", String(DELAY_MS)],
    timeoutMs: OWN_GUARD_MS,
  });
  assertExitCode(result, 0, context);
  assertBytesEqual(result.stdoutBytes, "ok\n", `${context}: stdout`);
}

// ---------------------------------------------------------------------------
// The declarations every registered entry receives
// ---------------------------------------------------------------------------

/** One declaration `declareProductTests` made, as the recorder saw it. */
interface RecordedDeclaration {
  readonly name: string;
  readonly options: ProductTestDeclarationOptions;
}

/**
 * Every declaration `declareProductTests` makes for the manifest, recorded
 * at collection time: no body runs, no product is driven (test/suite/
 * declare.ts, module header).
 */
const DECLARED: readonly RecordedDeclaration[] = (() => {
  const recorded: RecordedDeclaration[] = [];
  declareProductTests(productTestSuite.all(), (name, options) => {
    recorded.push({ name, options });
  });
  return recorded;
})();

/**
 * The framework options a registered entry is declared with — the first
 * entry's; the registry walk below requires every entry's to be these. The
 * tests here that run spans are declared with them, so each span runs under
 * the very framework guard a registered body runs under.
 */
const SPAN_DECLARATION: ProductTestDeclarationOptions = (() => {
  const first = DECLARED[0];
  if (first === undefined) {
    throw new Error(
      "S-3's pre-product check: declareProductTests declared no entry of " +
        "the manifest (test/suite/registry/index.ts) — the registry walk " +
        "would pass vacuously",
    );
  }
  return first.options;
})();

// ---------------------------------------------------------------------------
// The delayed span and the never-terminating invocation
// ---------------------------------------------------------------------------

/**
 * A registered-shape body (registry conventions: its own workspace, a
 * product rejected only through the diagnosed-assertion helpers) spanning
 * `count` delayed stand-in invocations, each under its own guard.
 */
function delayedSpanEntry(id: string, count: number): ProductTestEntry {
  return defineProductTest({
    id,
    title: `${String(count)} stand-in invocations of ${String(DELAY_MS)} ms, each under its own ${String(OWN_GUARD_MS)} ms guard`,
    run: async (product) => {
      const workspace = await TestWorkspace.create();
      try {
        for (let index = 0; index < count; index += 1) {
          await delayedInvocation(
            product,
            workspace.root,
            `${id} invocation ${String(index + 1)} of ${String(count)}`,
          );
        }
      } finally {
        await workspace.dispose();
      }
    },
  });
}

test(
  "a span of stand-in invocations, each taking a fixed delay well inside its own guard, passes at a length whose delays together exceed one invocation's own guard — run as one span through the machinery a registered body runs through: declared with the framework options declareProductTests gives every entry, inside runProductTestBody as the suite's wrapper runs it, and under the certification runner (TEST-SPEC S-3)",
  SPAN_DECLARATION,
  async () => {
    expect(SPAN_LENGTH * DELAY_MS).toBeGreaterThan(OWN_GUARD_MS);
    const { binding } = await standin();
    const entry = delayedSpanEntry("T99.3-1", SPAN_LENGTH);
    const [wrapped, certified] = await Promise.all([
      timed(() => runProductTestBody(entry.id, () => entry.run(binding))),
      timed(() => runProductTests(binding, [entry])),
    ]);
    expect(certified.value.results).toEqual([
      { id: entry.id, title: entry.title, outcome: "pass", diagnosis: null },
    ]);
    // The premise: each span did outlast one invocation's own guard, so a
    // guard of its own fixed below the sum of what it spans would have
    // fired.
    expect(wrapped.ms).toBeGreaterThan(OWN_GUARD_MS);
    expect(certified.ms).toBeGreaterThan(OWN_GUARD_MS);
  },
);

/**
 * A registered-shape body whose second stand-in invocation never
 * terminates, two more staged after it; `started` counts the invocations
 * the body started.
 */
function hangingSpanEntry(
  id: string,
  started: { count: number },
): ProductTestEntry {
  const span: readonly (readonly string[])[] = [
    ["pause", "50"],
    ["hang"],
    ["pause", "50"],
    ["pause", "50"],
  ];
  return defineProductTest({
    id,
    title: "a stand-in span whose second invocation never terminates",
    run: async (product) => {
      const workspace = await TestWorkspace.create();
      try {
        for (const [index, argv] of span.entries()) {
          started.count += 1;
          const result = await runProduct(product, {
            cwd: workspace.root,
            argv,
            timeoutMs: HANG_GUARD_MS,
          });
          assertExitCode(
            result,
            0,
            `${id} invocation ${String(index + 1)} (${argv.join(" ")})`,
          );
        }
      } finally {
        await workspace.dispose();
      }
    },
  });
}

test(
  "a single stand-in invocation that never terminates fails as a hang, ending its test within its own guard: the span stops there, nothing staged after it starting, the body ending with the driver's hang-guard kill, which the certification runner records as the test's hang (TEST-SPEC S-3, H-8)",
  SPAN_DECLARATION,
  async () => {
    const { binding } = await standin();

    const wrappedStarts = { count: 0 };
    const wrappedEntry = hangingSpanEntry("T99.3-2", wrappedStarts);
    const started = performance.now();
    const thrown = await runProductTestBody(wrappedEntry.id, () =>
      wrappedEntry.run(binding),
    ).then(
      () => undefined,
      (error: unknown) => error,
    );
    const elapsedMs = performance.now() - started;
    expect(thrown).toBeInstanceOf(ProductRunTimeoutError);
    expect(isHangGuardKill(thrown)).toBe(true);
    expect((thrown as Error).message).toContain(
      `timed out after ${String(HANG_GUARD_MS)} ms and was killed`,
    );
    expect(wrappedStarts.count).toBe(2);
    expect(elapsedMs).toBeGreaterThanOrEqual(HANG_GUARD_MS);
    expect(elapsedMs).toBeLessThan(HANG_GUARD_MS + HANG_SLACK_MS);

    const runnerStarts = { count: 0 };
    const report = await runProductTests(binding, [
      hangingSpanEntry("T99.3-2", runnerStarts),
    ]);
    expect(report.results.map((result) => result.outcome)).toEqual(["hang"]);
    expect(report.results[0]!.diagnosis).toContain(
      `timed out after ${String(HANG_GUARD_MS)} ms and was killed`,
    );
    expect(runnerStarts.count).toBe(2);
  },
);

// ---------------------------------------------------------------------------
// Every registered test
// ---------------------------------------------------------------------------

/** A Vitest project's name and test timeout, as the configuration sets them. */
interface ProjectTimeout {
  readonly name: unknown;
  readonly timeout: unknown;
}

/** The projects test/vitest.config.ts configures, and its root timeout. */
async function configuredTimeouts(): Promise<{
  readonly root: unknown;
  readonly projects: readonly ProjectTimeout[];
}> {
  const loaded: unknown = (await import("../vitest.config.js")).default;
  const testConfig = (loaded as { test?: unknown }).test;
  if (typeof testConfig !== "object" || testConfig === null) {
    throw new Error("test/vitest.config.ts configures no `test` block");
  }
  const { projects, testTimeout } = testConfig as {
    projects?: unknown;
    testTimeout?: unknown;
  };
  if (!Array.isArray(projects)) {
    throw new Error("test/vitest.config.ts configures no inline `projects`");
  }
  return {
    root: testTimeout,
    projects: projects.map((project: unknown): ProjectTimeout => {
      const projectTest = (project as { test?: unknown }).test as
        { name?: unknown; testTimeout?: unknown } | undefined;
      return {
        name: projectTest?.name,
        timeout: projectTest?.testTimeout,
      };
    }),
  };
}

test("every registered test is declared with no span guard of its own: declareProductTests declares each entry of the manifest, in canonical order, with the framework timeout NO_SPAN_GUARD — 0, under which Vitest arms no timer — every Vitest project's testTimeout is 0, and no entry carries a budget (TEST-SPEC S-3: a test is a span bounded by its invocations' and steps' own guards, never by a guard fixed apart from them)", async () => {
  expect(NO_SPAN_GUARD).toBe(0);
  const entries = productTestSuite.all();
  expect(entries.length).toBeGreaterThan(0);
  expect(DECLARED.map((declared) => declared.name)).toEqual(
    entries.map((entry) => `${entry.id} ${entry.title}`),
  );
  const guarded = DECLARED.filter(
    (declared) =>
      Object.keys(declared.options).join(",") !== "timeout" ||
      declared.options.timeout !== NO_SPAN_GUARD,
  ).map(
    (declared) =>
      `${declared.name.slice(0, declared.name.indexOf(" "))}: ${JSON.stringify(declared.options)}`,
  );
  expect(guarded).toEqual([]);
  const budgeted = entries
    .filter(
      (entry) =>
        !Object.isFrozen(entry) ||
        Object.keys(entry).sort().join(",") !== "id,run,title",
    )
    .map((entry) => `${entry.id}: ${Object.keys(entry).join(", ")}`);
  expect(budgeted).toEqual([]);

  const configured = await configuredTimeouts();
  expect(configured.root ?? 0).toBe(0);
  expect(configured.projects.map((project) => project.name)).toEqual([
    "suite",
    "self",
    "windows",
    "local",
  ]);
  expect(
    configured.projects.filter((project) => project.timeout !== 0),
  ).toEqual([]);
});

// ---------------------------------------------------------------------------
// Every limit the harness sets: the source scan
// ---------------------------------------------------------------------------

/**
 * What a limit site is: (a) a test-framework timeout; (b) a timer racing
 * work (`race`: `Promise.race`, `AbortSignal.timeout`; `timer`: a global
 * `setTimeout` or `setInterval`) or a clock comparison that can end work
 * (`clock`); (c) a hold lifted (`hold-delete`) or observed (`hold-poll`)
 * outside the driver (module header).
 */
type LimitRule =
  "framework" | "race" | "timer" | "clock" | "hold-delete" | "hold-poll";

interface LimitSite {
  /** Repository-relative path of the scanned file. */
  readonly file: string;
  readonly line: number;
  /** The innermost named function enclosing the site, or `<module>`. */
  readonly fn: string;
  readonly rule: LimitRule;
  /** The construct, abbreviated. */
  readonly text: string;
}

/**
 * The callees a test-framework declaration starts at: Vitest's, and
 * test/suite/declare.ts's declarer (`declare`, Vitest's `test` by default).
 */
const FRAMEWORK_ROOTS: ReadonlySet<string> = new Set([
  "test",
  "it",
  "describe",
  "suite",
  "bench",
  "declare",
]);
const DELETIONS: ReadonlySet<string> = new Set([
  "rm",
  "rmSync",
  "unlink",
  "unlinkSync",
  "rmdir",
  "rmdirSync",
]);
const EXISTENCE_PROBES: ReadonlySet<string> = new Set([
  "pathExists",
  "exists",
  "existsSync",
  "access",
  "accessSync",
  "stat",
  "statSync",
  "lstat",
  "lstatSync",
]);
const POLLING_DELAYS: ReadonlySet<string> = new Set([
  "sleep",
  "setTimeout",
  "setInterval",
]);
const COMPARISONS: ReadonlySet<ts.SyntaxKind> = new Set([
  ts.SyntaxKind.LessThanToken,
  ts.SyntaxKind.LessThanEqualsToken,
  ts.SyntaxKind.GreaterThanToken,
  ts.SyntaxKind.GreaterThanEqualsToken,
]);

/** The words of a name: camel-case humps and runs between non-alphanumerics. */
function wordsOf(name: string): readonly string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter((word) => word !== "")
    .map((word) => word.toLowerCase());
}

function strip(node: ts.Expression): ts.Expression {
  let current = node;
  while (ts.isParenthesizedExpression(current)) current = current.expression;
  return current;
}

/** The called name: an identifier's, or a member access's last name. */
function calleeName(callee: ts.Expression): string | undefined {
  if (ts.isIdentifier(callee)) return callee.text;
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
  return undefined;
}

/** The identifier a callee chain (`test.runIf(x)`, `describe.each`) starts at. */
function chainRoot(callee: ts.Expression): string | undefined {
  let current: ts.Expression = callee;
  for (;;) {
    if (ts.isIdentifier(current)) return current.text;
    if (
      ts.isPropertyAccessExpression(current) ||
      ts.isCallExpression(current) ||
      ts.isParenthesizedExpression(current)
    ) {
      current = current.expression;
      continue;
    }
    return undefined;
  }
}

/** `<object>.<name>` with `<object>` the identifier `object`. */
function isMember(node: ts.Expression, object: string, name: string): boolean {
  return (
    ts.isPropertyAccessExpression(node) &&
    node.name.text === name &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === object
  );
}

/** A clock reading: `Date.now()`, `performance.now()`, `process.hrtime(…)`. */
function isClockReading(node: ts.Node): boolean {
  if (!ts.isCallExpression(node)) return false;
  const callee = node.expression;
  return (
    isMember(callee, "Date", "now") ||
    isMember(callee, "performance", "now") ||
    isMember(callee, "process", "hrtime") ||
    (ts.isPropertyAccessExpression(callee) &&
      callee.name.text === "bigint" &&
      isMember(callee.expression, "process", "hrtime"))
  );
}

/** Whether a clock reading occurs in `node`, nested functions aside. */
function readsClock(node: ts.Node): boolean {
  let found = false;
  const visit = (current: ts.Node): void => {
    if (found) return;
    if (isClockReading(current)) {
      found = true;
      return;
    }
    if (current !== node && ts.isFunctionLike(current)) return;
    ts.forEachChild(current, visit);
  };
  visit(node);
  return found;
}

/** A comparison operand reading the clock directly: a reading, or arithmetic over one. */
function clockOperand(operand: ts.Expression): boolean {
  const node = strip(operand);
  if (isClockReading(node)) return true;
  return (
    ts.isBinaryExpression(node) &&
    (node.operatorToken.kind === ts.SyntaxKind.MinusToken ||
      node.operatorToken.kind === ts.SyntaxKind.PlusToken) &&
    readsClock(node)
  );
}

/** Whether `node` names a hold: an identifier or member whose words include "hold". */
function namesHold(node: ts.Node): boolean {
  let found = false;
  const visit = (current: ts.Node): void => {
    if (found) return;
    if (ts.isIdentifier(current) || ts.isPrivateIdentifier(current)) {
      if (wordsOf(current.text).includes("hold")) found = true;
      return;
    }
    if (ts.isFunctionLike(current)) return;
    ts.forEachChild(current, visit);
  };
  visit(node);
  return found;
}

/** The function-like node enclosing `node`, or its source file. */
function enclosingScope(node: ts.Node): ts.Node {
  let current = node.parent;
  while (!ts.isFunctionLike(current) && !ts.isSourceFile(current)) {
    current = current.parent;
  }
  return current;
}

/** The innermost named function enclosing `node`: `Class.member`, or `<module>`. */
function enclosingName(node: ts.Node): string {
  for (let current = node.parent; !ts.isSourceFile(current);) {
    if (ts.isFunctionDeclaration(current) && current.name !== undefined) {
      return current.name.text;
    }
    if (
      (ts.isMethodDeclaration(current) ||
        ts.isGetAccessorDeclaration(current) ||
        ts.isSetAccessorDeclaration(current) ||
        ts.isConstructorDeclaration(current)) &&
      ts.isClassLike(current.parent)
    ) {
      const owner = current.parent.name?.text ?? "<class>";
      const member = ts.isConstructorDeclaration(current)
        ? "constructor"
        : current.name.getText();
      return `${owner}.${member}`;
    }
    if (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) {
      const holder = current.parent;
      if (ts.isVariableDeclaration(holder) && ts.isIdentifier(holder.name)) {
        return holder.name.text;
      }
      if (ts.isPropertyAssignment(holder) || ts.isPropertyDeclaration(holder)) {
        return holder.name.getText();
      }
    }
    current = current.parent;
  }
  return "<module>";
}

/** Whether `node` lies inside a loop that sleeps, within its own function. */
function insidePollingLoop(node: ts.Node): boolean {
  for (
    let current = node.parent;
    !ts.isFunctionLike(current) && !ts.isSourceFile(current);
    current = current.parent
  ) {
    if (!ts.isIterationStatement(current, false)) continue;
    let sleeps = false;
    const visit = (inner: ts.Node): void => {
      if (sleeps) return;
      if (ts.isCallExpression(inner)) {
        const name = calleeName(inner.expression);
        if (name !== undefined && POLLING_DELAYS.has(name)) {
          sleeps = true;
          return;
        }
      }
      if (ts.isFunctionLike(inner)) return;
      ts.forEachChild(inner, visit);
    };
    visit(current.statement);
    if (sleeps) return true;
  }
  return false;
}

/** Whether a comparison is an `if` condition whose consequence throws or fails. */
function guardsThrow(comparison: ts.Node): boolean {
  let condition: ts.Node = comparison;
  while (
    ts.isParenthesizedExpression(condition.parent) ||
    ts.isPrefixUnaryExpression(condition.parent) ||
    (ts.isBinaryExpression(condition.parent) &&
      (condition.parent.operatorToken.kind ===
        ts.SyntaxKind.AmpersandAmpersandToken ||
        condition.parent.operatorToken.kind === ts.SyntaxKind.BarBarToken))
  ) {
    condition = condition.parent;
  }
  const statement = condition.parent;
  if (!ts.isIfStatement(statement) || statement.expression !== condition) {
    return false;
  }
  let ends = false;
  const visit = (inner: ts.Node): void => {
    if (ends) return;
    if (
      ts.isThrowStatement(inner) ||
      (ts.isCallExpression(inner) && calleeName(inner.expression) === "fail")
    ) {
      ends = true;
      return;
    }
    if (ts.isFunctionLike(inner)) return;
    ts.forEachChild(inner, visit);
  };
  visit(statement.thenStatement);
  return ends;
}

/**
 * Scan one TypeScript source for limit sites (module header): the framework
 * rule in every file, the race, timer, clock, and hold rules where
 * `spanMachinery` holds.
 */
function scanLimits(
  file: string,
  text: string,
  spanMachinery: boolean,
): LimitSite[] {
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TS,
  );
  const sites: LimitSite[] = [];
  const report = (node: ts.Node, rule: LimitRule): void => {
    const { line } = source.getLineAndCharacterOfPosition(
      node.getStart(source),
    );
    sites.push({
      file,
      line: line + 1,
      fn: enclosingName(node),
      rule,
      text: node.getText(source).replace(/\s+/g, " ").slice(0, 100),
    });
  };
  // Per function: the names a clock reading initializes.
  const derivedByScope = new Map<ts.Node, ReadonlySet<string>>();
  const clockDerived = (node: ts.Node): ReadonlySet<string> => {
    const scope = enclosingScope(node);
    let names = derivedByScope.get(scope);
    if (names === undefined) {
      const found = new Set<string>();
      const visit = (inner: ts.Node): void => {
        if (inner !== scope && ts.isFunctionLike(inner)) return;
        if (
          ts.isVariableDeclaration(inner) &&
          ts.isIdentifier(inner.name) &&
          inner.initializer !== undefined &&
          readsClock(inner.initializer)
        ) {
          found.add(inner.name.text);
        }
        ts.forEachChild(inner, visit);
      };
      visit(scope);
      names = found;
      derivedByScope.set(scope, names);
    }
    return names;
  };
  const isZero = (node: ts.Expression): boolean => {
    const value = strip(node);
    return ts.isNumericLiteral(value) && Number(value.text) === 0;
  };
  const timeoutAllowed = (node: ts.Expression): boolean => {
    const value = strip(node);
    return (
      (ts.isIdentifier(value) && value.text === "NO_SPAN_GUARD") ||
      isZero(value)
    );
  };

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const name = calleeName(callee);
      const root = chainRoot(callee);
      // (a) A test-framework declaration's timeout.
      if (root !== undefined && FRAMEWORK_ROOTS.has(root)) {
        for (const argument of node.arguments) {
          const value = strip(argument);
          if (ts.isNumericLiteral(value) && !isZero(value)) {
            report(argument, "framework");
          }
          if (ts.isObjectLiteralExpression(value)) {
            for (const property of value.properties) {
              if (
                property.name !== undefined &&
                property.name.getText(source) === "timeout" &&
                !(
                  ts.isPropertyAssignment(property) &&
                  timeoutAllowed(property.initializer)
                )
              ) {
                report(property, "framework");
              }
            }
          }
        }
      }
      // A run-time configuration the scan cannot read is a timeout it
      // cannot rule out; an object literal's `testTimeout` is the
      // configuration rule's below.
      if (isMember(callee, "vi", "setConfig")) {
        const [config] = node.arguments;
        if (
          config !== undefined &&
          !ts.isObjectLiteralExpression(strip(config))
        ) {
          report(node, "framework");
        }
      }
      if (spanMachinery) {
        // (b) A timer racing work.
        if (
          isMember(callee, "Promise", "race") ||
          isMember(callee, "AbortSignal", "timeout")
        ) {
          report(node, "race");
        }
        if (
          ts.isIdentifier(callee) &&
          (callee.text === "setTimeout" || callee.text === "setInterval")
        ) {
          report(node, "timer");
        }
        // (c) A hold lifted or observed outside the driver.
        const [target] = node.arguments;
        if (name !== undefined && target !== undefined && namesHold(target)) {
          if (DELETIONS.has(name)) report(node, "hold-delete");
          if (EXISTENCE_PROBES.has(name) && insidePollingLoop(node)) {
            report(node, "hold-poll");
          }
        }
      }
    }
    // (a) A configuration's test timeout.
    if (
      ts.isPropertyAssignment(node) &&
      node.name.getText(source) === "testTimeout" &&
      !isZero(node.initializer)
    ) {
      report(node, "framework");
    }
    if (spanMachinery) {
      // (b) A clock comparison that can end work.
      if (
        ts.isBinaryExpression(node) &&
        COMPARISONS.has(node.operatorToken.kind)
      ) {
        const left = strip(node.left);
        const right = strip(node.right);
        if (clockOperand(left) || clockOperand(right)) {
          report(node, "clock");
        } else {
          const derived = clockDerived(node);
          const isDerived = (side: ts.Expression): boolean =>
            ts.isIdentifier(side) && derived.has(side.text);
          if (
            (isDerived(left) && !isZero(right)) ||
            (isDerived(right) && !isZero(left)) ||
            ((isDerived(left) || isDerived(right)) && guardsThrow(node))
          ) {
            report(node, "clock");
          }
        }
      }
      if (
        (ts.isVariableDeclaration(node) ||
          ts.isParameter(node) ||
          ts.isPropertyDeclaration(node) ||
          ts.isPropertySignature(node) ||
          ts.isPropertyAssignment(node) ||
          ts.isShorthandPropertyAssignment(node)) &&
        ts.isIdentifier(node.name) &&
        wordsOf(node.name.text).includes("deadline")
      ) {
        report(node, "clock");
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return sites;
}

const REPO_ROOT = path.resolve(
  fileURLToPath(new URL("../..", import.meta.url)),
);

/** Every TypeScript file of the harness, repository-relative, sorted. */
function harnessSources(): readonly string[] {
  const found: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      const relative = path
        .relative(REPO_ROOT, absolute)
        .split(path.sep)
        .join("/");
      if (entry.isDirectory()) {
        // Fixture products and consumer projects are data the harness
        // drives, not the harness (test/tsconfig.json excludes them too).
        if (relative !== "test/fixtures") walk(absolute);
      } else if (entry.isFile() && entry.name.endsWith(".ts")) {
        found.push(relative);
      }
    }
  };
  walk(path.join(REPO_ROOT, "test"));
  return found.sort();
}

/** The span machinery's files outside test/suite/, test/windows/, test/local/, test/helpers/. */
const SPAN_MACHINERY_SELF_FILES: ReadonlySet<string> = new Set([
  "test/self/certification-runner.ts",
  "test/self/certification-fixtures.ts",
  "test/self/certification.test.ts",
  "test/self/s7-red-green-sweep.test.ts",
]);

/** Whether a file belongs to the span machinery (module header, (b)). */
function inSpanMachinery(file: string): boolean {
  return (
    file.startsWith("test/suite/") ||
    file.startsWith("test/windows/") ||
    file.startsWith("test/local/") ||
    file.startsWith("test/helpers/") ||
    SPAN_MACHINERY_SELF_FILES.has(file)
  );
}

/**
 * The own-guard sites: every function of the span machinery where a timer,
 * a race, or a clock comparison stands as an own guard — of an invocation,
 * of a harness step — never a span's. Each must still be found.
 */
interface OwnGuardSite {
  readonly file: string;
  readonly fn: string;
  readonly rules: readonly LimitRule[];
  readonly why: string;
}

const OWN_GUARD_SITES: readonly OwnGuardSite[] = [
  {
    file: "test/helpers/subprocess.ts",
    fn: "RunningProduct.#armGuard",
    rules: ["timer"],
    why: "the per-invocation hang guard itself (`RunOptions.timeoutMs`)",
  },
  {
    file: "test/helpers/subprocess.ts",
    fn: "settlesWithin",
    rules: ["timer", "race"],
    why: "`killGroup`'s bound on collecting the exit of a run it killed by request — a harness step after the kill",
  },
  {
    file: "test/helpers/step-guards.ts",
    fn: "guardStep",
    rules: ["timer", "race", "clock"],
    why: "the asynchronous harness-step guard itself",
  },
  {
    file: "test/helpers/step-guards.ts",
    fn: "guardSyncStep",
    rules: ["clock"],
    why: "the synchronous harness-step guard itself",
  },
  {
    file: "test/helpers/kill-discipline.ts",
    fn: "confirmGroupGone",
    rules: ["clock"],
    why: "a killed group confirmed gone from the process list — a harness step after the kill",
  },
  {
    file: "test/helpers/e6-exclusion.ts",
    fn: "runWindowsCommand",
    rules: ["timer"],
    why: "a harness subprocess (`tasklist`, `taskkill`) under its own guard",
  },
  {
    file: "test/helpers/e6-exclusion.ts",
    fn: "confirmWindowsTreeGone",
    rules: ["clock"],
    why: "E-6's killed process tree confirmed gone — a harness step after the kill",
  },
  {
    file: "test/helpers/e6-exclusion.ts",
    fn: "settlesWithin",
    rules: ["timer", "race"],
    why: "E-6's kill collecting the killed run's exit — a harness step after the kill",
  },
  {
    file: "test/helpers/machine-staging.ts",
    fn: "settlesWithin",
    rules: ["timer", "race"],
    why: "a closed namespace's first process's exit collected after its kill — a harness step",
  },
  {
    file: "test/helpers/machine-staging.ts",
    fn: "FirstProcess.#nextLine",
    rules: ["clock", "timer"],
    why: "the namespace's control protocol awaiting the harness's own helper process's answer — a harness step",
  },
];

function isOwnGuardSite(site: LimitSite): boolean {
  return OWN_GUARD_SITES.some(
    (own) =>
      own.file === site.file &&
      own.fn === site.fn &&
      own.rules.includes(site.rule),
  );
}

function describeSite(site: LimitSite): string {
  return `${site.file}:${String(site.line)} (${site.fn}) [${site.rule}] ${site.text}`;
}

test("every limit the harness sets is an own guard: a scan of the harness's own TypeScript finds no framework timeout but NO_SPAN_GUARD or 0, no timer racing work and no clock comparison that can end work in the span machinery but at its own-guard sites — each still found — and no hold lifted but by releaseHoldFile or polled but by waitForFile and holdFileStands (TEST-SPEC S-3: every limit the harness sets is a guard held to its rule; a span may carry none beyond its own guards)", () => {
  const files = harnessSources();
  // The scan reaches the files that set or could set a span's guard: a
  // silent under-scan would make it vacuous.
  for (const anchor of [
    "test/vitest.config.ts",
    "test/suite/declare.ts",
    "test/suite/registry/index.ts",
    "test/suite/registry/section-16-p10.ts",
    "test/suite/registry/section-16-p12.ts",
    "test/suite/registry/section-13.5-vi.ts",
    "test/helpers/property.ts",
    "test/helpers/subprocess.ts",
    "test/helpers/kill-discipline.ts",
    "test/self/certification-runner.ts",
    "test/self/certification.test.ts",
    "test/self/s7-red-green-sweep.test.ts",
  ]) {
    expect(files).toContain(anchor);
  }
  const sites = files.flatMap((file) =>
    scanLimits(
      file,
      fs.readFileSync(path.join(REPO_ROOT, file), "utf8"),
      inSpanMachinery(file),
    ),
  );
  expect(
    sites.filter((site) => !isOwnGuardSite(site)).map(describeSite),
  ).toEqual([]);
  const stale = OWN_GUARD_SITES.flatMap((own) =>
    own.rules
      .filter(
        (rule) =>
          !sites.some(
            (site) =>
              site.file === own.file &&
              site.fn === own.fn &&
              site.rule === rule,
          ),
      )
      .map((rule) => `${own.file} (${own.fn}) [${rule}]: ${own.why}`),
  );
  expect(stale).toEqual([]);
});

/** A synthetic source the scanner must flag, with the rules it must report. */
interface ScannerVector {
  readonly label: string;
  readonly source: string;
  readonly rules: readonly LimitRule[];
}

const FLAGGED: readonly ScannerVector[] = [
  {
    label: "a positional framework timeout",
    source: `test("t", async () => {}, 120_000);\n`,
    rules: ["framework"],
  },
  {
    label: "a framework timeout option",
    source: `test("t", { timeout: 600_000 }, async () => {});\n`,
    rules: ["framework"],
  },
  {
    label: "a suite's timeout option",
    source: `describe("d", { timeout: 5_000 }, () => {});\n`,
    rules: ["framework"],
  },
  {
    label: "a registered entry's declaration given a timeout",
    source: `declare(name, { timeout: entry.timeoutMs ?? NO_SPAN_GUARD }, run);\n`,
    rules: ["framework"],
  },
  {
    label: "a conditional test's positional timeout",
    source: `test.runIf(onPosix)("t", async () => {}, 30_000);\n`,
    rules: ["framework"],
  },
  {
    label: "a configured test timeout",
    source: `export default { test: { testTimeout: 120_000 } };\n`,
    rules: ["framework"],
  },
  {
    label: "a test timeout set at run time",
    source: `vi.setConfig({ testTimeout: 1_000 });\n`,
    rules: ["framework"],
  },
  {
    label: "a run-time configuration the scan cannot read",
    source: `vi.setConfig(spanConfig);\n`,
    rules: ["framework"],
  },
  {
    label: "a span raced against a delay",
    source: `export async function run(body: () => Promise<void>): Promise<void> {\n  await Promise.race([body(), sleep(600_000)]);\n}\n`,
    rules: ["race"],
  },
  {
    label: "an abort signal's timeout",
    source: `const signal = AbortSignal.timeout(60_000);\n`,
    rules: ["race"],
  },
  {
    label: "a watchdog timer",
    source: `export function watch(): void {\n  setTimeout(() => {\n    throw new Error("over budget");\n  }, 600_000);\n}\n`,
    rules: ["timer"],
  },
  {
    label: "P-10's hold wait as it stood before S-3's design",
    source: `async function holdsOrExits(running: RunningProduct, hold: string): Promise<boolean> {\n  const deadline = Date.now() + DEFAULT_WAIT_FOR_FILE_TIMEOUT_MS;\n  for (;;) {\n    if (await pathExists(hold)) return true;\n    if (running.hasExited()) return false;\n    if (Date.now() >= deadline) {\n      fail("the run neither held nor exited");\n    }\n    await sleep(10);\n  }\n}\n`,
    rules: ["clock", "clock", "hold-poll"],
  },
  {
    label: "an elapsed-time budget",
    source: `export async function trials(): Promise<void> {\n  const started = performance.now();\n  for (let i = 0; i < 10; i += 1) {\n    await trial(i);\n    if (performance.now() - started > BUDGET_MS) throw new Error("budget");\n  }\n}\n`,
    rules: ["clock"],
  },
  {
    label: "a budget over a measured value",
    source: `export async function loop(): Promise<void> {\n  const started = Date.now();\n  for (;;) {\n    await step();\n    const elapsed = Date.now() - started;\n    if (elapsed > LIMIT_MS) fail("too slow");\n  }\n}\n`,
    rules: ["clock"],
  },
  {
    label: "a remaining-time budget ending work at zero",
    source: `export async function wait(limitMs: number): Promise<void> {\n  const started = Date.now();\n  for (;;) {\n    const left = limitMs - (Date.now() - started);\n    if (left <= 0) {\n      throw new Error("expired");\n    }\n    await sleep(10);\n  }\n}\n`,
    rules: ["clock"],
  },
  {
    label: "a hold lifted by hand",
    source: `export async function lift(holdPath: string): Promise<void> {\n  await fsp.rm(holdPath, { force: true });\n}\n`,
    rules: ["hold-delete"],
  },
  {
    label: "a run's hold unlinked by hand",
    source: `export function lift(run: { hold: string }): void {\n  fs.unlinkSync(run.hold);\n}\n`,
    rules: ["hold-delete"],
  },
  {
    label: "a hold polled by hand",
    source: `export async function awaitHold(previewHold: string): Promise<void> {\n  while (!(await pathExists(previewHold))) {\n    await sleep(10);\n  }\n}\n`,
    rules: ["hold-poll"],
  },
];

const UNFLAGGED: readonly {
  readonly label: string;
  readonly source: string;
}[] = [
  {
    label: "the suite's declarations and an own invocation guard",
    source: `test("t", { timeout: NO_SPAN_GUARD }, async () => {\n  await runProduct(product, { cwd, argv, timeoutMs: 30_000 });\n});\ntest("u", async () => {});\ntest.each([[1, 2]])("v", async () => {});\ndeclare(name, { timeout: NO_SPAN_GUARD }, run);\n`,
  },
  {
    label: "a scheduling delay computed from the clock",
    source: `export async function start(plan: { offsetMs: number }, origin: number): Promise<void> {\n  const wait = plan.offsetMs - (performance.now() - origin);\n  if (wait > 0) await sleep(wait);\n}\n`,
  },
  {
    label: "a measurement",
    source: `export async function measure(): Promise<number> {\n  const started = performance.now();\n  await work();\n  const span = performance.now() - started;\n  return span;\n}\n`,
  },
  {
    label:
      "a hold path's occupant checked before a run, and after its runs in a case loop",
    source: `export async function arms(holdPath: string, cases: readonly string[]): Promise<void> {\n  if (await pathExists(holdPath)) throw new Error("occupied");\n  for (const c of cases) {\n    await run(c);\n    if (await pathExists(holdPath)) fail("created");\n  }\n}\n`,
  },
  {
    label: "a hold observed and lifted through the driver",
    source: `export async function held(running: RunningProduct, hold: string): Promise<void> {\n  while (!(await running.holdFileStands(hold))) {\n    await sleep(10);\n  }\n  await running.waitForFile(hold);\n  await releaseHoldFile(hold);\n}\n`,
  },
  {
    label: "a harness subprocess's own guard",
    source: `export async function git(args: readonly string[]): Promise<void> {\n  await execFile("git", args, { timeout: 60_000 });\n}\n`,
  },
];

test("the source scan's own vectors: it flags every construct a span guard or a hold kept outside the driver is written with — framework timeouts, races, watchdog timers, clock budgets direct or over a measured value, P-10's hold wait as it stood before S-3's design, holds lifted or polled by hand — and none of the delays, measurements, own guards, occupancy checks, and driver calls the suite writes; outside the span machinery only framework timeouts count (TEST-SPEC S-3)", () => {
  const synthetic = "test/suite/registry/s3-scan-vector.ts";
  for (const vector of FLAGGED) {
    expect(
      scanLimits(synthetic, vector.source, true)
        .map((site) => site.rule)
        .sort(),
      vector.label,
    ).toEqual([...vector.rules].sort());
  }
  for (const vector of UNFLAGGED) {
    expect(
      scanLimits(synthetic, vector.source, true).map(describeSite),
      vector.label,
    ).toEqual([]);
  }
  // A self-test's own stand-in choreography is no span the suite stages.
  const selfTest = "test/self/s3-scan-vector.test.ts";
  for (const vector of FLAGGED) {
    const framework = vector.rules.filter((rule) => rule === "framework");
    expect(
      scanLimits(selfTest, vector.source, false).map((site) => site.rule),
      vector.label,
    ).toEqual(framework);
  }
  expect(inSpanMachinery(synthetic)).toBe(true);
  expect(inSpanMachinery(selfTest)).toBe(false);
});

// ---------------------------------------------------------------------------
// Properties and trial loops
// ---------------------------------------------------------------------------

test(
  "properties at the fixed seeds: checkProperty, which every section-16 property runs through, applies no guard over a property's trials — a property whose fixed-seed trials each run a delayed stand-in invocation, together past one own guard, passes, its trial count the one its staging fixes, seeds × runs (TEST-SPEC S-3, E-5)",
  SPAN_DECLARATION,
  async () => {
    const { workspace, binding } = await standin();
    const runs = 2;
    let trials = 0;
    const span = await timed(() =>
      runProductTestBody("T99.3-5", () =>
        checkProperty(
          "S-3 fixed-seed span",
          (choices) => choices.intInclusive(0, 9),
          async () => {
            trials += 1;
            await delayedInvocation(
              binding,
              workspace.root,
              `the fixed-seed span's trial ${String(trials)}`,
            );
          },
          { runs, env: {} },
        ),
      ),
    );
    expect(trials).toBe(DEFAULT_PROPERTY_SEEDS.length * runs);
    expect(trials * DELAY_MS).toBeGreaterThan(OWN_GUARD_MS);
    expect(span.ms).toBeGreaterThan(OWN_GUARD_MS);
  },
);

test(
  "voidable trials, their attempt count known only once staged: runVoidableTrial (T13.5-3's reuse check, T13.5-10's stagings) applies no guard at any count — trials voided once and three times, each attempt a delayed stand-in invocation, reach their verdicts at the second and fourth attempts, the longer past one own guard (TEST-SPEC S-3)",
  SPAN_DECLARATION,
  async () => {
    const { workspace, binding } = await standin();
    for (const voids of [1, 3]) {
      let attempts = 0;
      const span = await timed(() =>
        runProductTestBody("T99.3-6", () =>
          runVoidableTrial(
            `S-3 voidable span voided ${String(voids)} time(s)`,
            async (attempt) => {
              attempts += 1;
              await delayedInvocation(
                binding,
                workspace.root,
                `attempt ${String(attempt)}`,
              );
              if (attempt <= voids) {
                voidTrial(
                  `stand-in void ${String(attempt)} of ${String(voids)}`,
                );
              }
              return attempt;
            },
          ),
        ),
      );
      expect(span.value).toBe(voids + 1);
      expect(attempts).toBe(voids + 1);
      if (voids === 3) {
        expect(attempts * DELAY_MS).toBeGreaterThan(OWN_GUARD_MS);
        expect(span.ms).toBeGreaterThan(OWN_GUARD_MS);
      }
    }
  },
);

/**
 * Run a property at the fixed seeds over draws in [0, 1000] whose body
 * `judge`s each draw, returning its falsification (the property must fail).
 */
async function falsification(
  name: string,
  judge: (value: number) => Promise<void> | void,
): Promise<PropertyFalsifiedError> {
  const thrown = await runProductTestBody("T99.3-7", () =>
    checkProperty(name, (choices) => choices.intInclusive(0, 1000), judge, {
      env: {},
    }),
  ).then(
    () => undefined,
    (error: unknown) => error,
  );
  if (!(thrown instanceof PropertyFalsifiedError)) {
    throw new Error(
      `S-3's shrink check: ${name} did not end in a falsification: ` +
        String(thrown),
    );
  }
  return thrown;
}

test(
  "a property's shrink phase, entered only once the property has failed, its count known only as it shrinks: against stand-ins failing the property at differing draws — at or past 1, at or past 700 — each shrink phase applies no guard, running to the very counterexample and execution count its invocation-free twin's shrink reaches, each execution a delayed stand-in invocation, the counts differing and each phase outlasting one own guard (TEST-SPEC S-3, 16)",
  SPAN_DECLARATION,
  async () => {
    const { workspace, binding } = await standin();
    const counts: number[] = [];
    for (const threshold of [1, 700]) {
      // The count its staging yields, derived as it shrinks: the same
      // property over the same draws, judged without any invocation, in
      // milliseconds no guard could reach.
      const twin = await falsification(
        `S-3 shrink twin failing at or past ${String(threshold)}`,
        (value) => {
          if (value >= threshold)
            fail(`the twin's verdict on ${String(value)}`);
        },
      );
      let executions = 0;
      let firstFailureAt: number | undefined;
      const falsified = await falsification(
        `S-3 shrink span failing at or past ${String(threshold)}`,
        async (value) => {
          executions += 1;
          const result = await runProduct(binding, {
            cwd: workspace.root,
            argv: [
              "verdict",
              String(threshold),
              String(value),
              String(SHRINK_DELAY_MS),
            ],
            timeoutMs: SHRINK_GUARD_MS,
          });
          if (result.exitCode !== 0) firstFailureAt ??= performance.now();
          assertExitCode(
            result,
            0,
            `the stand-in's verdict on ${String(value)}`,
          );
        },
      );
      const endedAt = performance.now();
      expect(twin.value).toBe(threshold);
      expect([
        falsified.seed,
        falsified.trial,
        falsified.value,
        falsified.shrinkSteps,
        falsified.shrinkExecutions,
        falsified.shrinkStopped,
        falsified.shrinkDeclined,
      ]).toEqual([
        twin.seed,
        twin.trial,
        twin.value,
        twin.shrinkSteps,
        twin.shrinkExecutions,
        false,
        false,
      ]);
      // The trials ran up to the first failure, the shrink phase after it,
      // its executions together past one own guard.
      expect(executions - falsified.shrinkExecutions).toBeGreaterThanOrEqual(1);
      expect(falsified.shrinkExecutions * SHRINK_DELAY_MS).toBeGreaterThan(
        SHRINK_GUARD_MS,
      );
      expect(firstFailureAt).toBeDefined();
      expect(endedAt - firstFailureAt!).toBeGreaterThan(SHRINK_GUARD_MS);
      counts.push(falsified.shrinkExecutions);
    }
    expect(new Set(counts).size).toBe(counts.length);
  },
);

// ---------------------------------------------------------------------------
// The companion stagings
// ---------------------------------------------------------------------------

/** The stand-in twin's configuration and source (the stand-in reads neither). */
const COMPANION_CONFIG = `export default { specs: ["specs/**/*.mdx"] };\n`;
const COMPANION_SOURCE = "# A\n";

/** The recorded set of `count` companions of `specs/A.mdx`, in byte order. */
function recordedSet(companions: readonly string[]): readonly string[] {
  return ["specs/A.xspec.ts", ...companions].sort((a, b) =>
    Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8")),
  );
}

test(
  "the companion stagings of T6.5-20(a), (c), (e) and T13.4-9(e), one per companion path a build records, their count known only once staged: read through their shared reading (readRecordedCompanionPaths) from stand-in recorded sets of 0, 1, and 4 companions, each count stages its span — one delayed stand-in invocation per staging — under no guard, the longest past one own guard (TEST-SPEC S-3)",
  SPAN_DECLARATION,
  async () => {
    for (const count of [0, 1, 4]) {
      const companions = Array.from(
        { length: count },
        (_, index) => `specs/A.xspec.s3c${String(index)}`,
      );
      const { workspace, binding } = await standin({
        XSPEC_S3_RECORDED: JSON.stringify(recordedSet(companions)),
      });
      const span = await timed(() =>
        runProductTestBody("T99.3-8", async () => {
          const read = await readRecordedCompanionPaths(
            binding,
            COMPANION_CONFIG,
            "specs/A.mdx",
            COMPANION_SOURCE,
            `S-3's stand-in recorded set of ${String(count)} companion(s)`,
          );
          for (const [index, companion] of read.entries()) {
            await delayedInvocation(
              binding,
              workspace.root,
              `the staging beside ${companion} (${String(index + 1)} of ${String(read.length)})`,
            );
          }
          return read;
        }),
      );
      expect(span.value).toEqual(companions);
      if (count === 4) {
        expect(count * DELAY_MS).toBeGreaterThan(OWN_GUARD_MS);
        expect(span.ms).toBeGreaterThan(OWN_GUARD_MS);
      }
    }
  },
);

// ---------------------------------------------------------------------------
// T13.3-5(a)'s tampering trials
// ---------------------------------------------------------------------------

/** The file the stand-in's `build` derives its graph-data files from. */
const TAMPERING_SOURCE = "s3-source.txt";
/**
 * Each trial's stand-in invocation's fixed delay: shorter than the other
 * spans' — a tampering span stages at least twenty-four trials — its
 * delays together still past one own guard at every count.
 */
const TRIAL_DELAY_MS = 100;

test(
  "T13.3-5(a)'s tampering trials, their count known only once staged — rounds of one alteration per nonempty file the product writes under .xspec/, at least eight trials per fixed seed, and, where it writes several files there, the mixes of the workspace's own state and a twin's: read through their shared reading (readTamperingTrials) from the stand-in file sets of one and two files a stand-in build writes, each count stages its span — one delayed stand-in invocation per trial — under no guard, each past one own guard (TEST-SPEC S-3)",
  SPAN_DECLARATION,
  async () => {
    const counts: number[] = [];
    for (const files of [1, 2]) {
      const { workspace, binding } = await standin({
        XSPEC_S3_GRAPH_FILES: String(files),
      });
      await workspace.file(TAMPERING_SOURCE, "own\n");
      const span = await timed(() =>
        runProductTestBody("T99.3-9", async () => {
          assertExitCode(
            await runProduct(binding, {
              cwd: workspace.root,
              argv: ["build"],
              timeoutMs: OWN_GUARD_MS,
            }),
            0,
            "the stand-in's build of the workspace's own state",
          );
          const trials = await readTamperingTrials(
            binding,
            workspace,
            { [TAMPERING_SOURCE]: "twin\n" },
            `S-3's stand-in file set of ${String(files)} file(s)`,
          );
          for (const [index, trial] of trials.entries()) {
            const context = `trial ${String(index + 1)} of ${String(trials.length)} (${trial.description})`;
            const result = await runProduct(binding, {
              cwd: workspace.root,
              argv: ["pause", String(TRIAL_DELAY_MS)],
              timeoutMs: OWN_GUARD_MS,
            });
            assertExitCode(result, 0, context);
            assertBytesEqual(result.stdoutBytes, "ok\n", `${context}: stdout`);
          }
          return trials.length;
        }),
      );
      // Per fixed seed, ⌈8 / files⌉ rounds of one trial per file; with two
      // files, which the twin's build writes with other bytes, the two
      // mixes taking each one from the twin.
      expect(span.value).toBe(
        DEFAULT_PROPERTY_SEEDS.length * Math.ceil(8 / files) * files +
          (files === 2 ? 2 : 0),
      );
      expect(span.value * TRIAL_DELAY_MS).toBeGreaterThan(OWN_GUARD_MS);
      expect(span.ms).toBeGreaterThan(OWN_GUARD_MS);
      counts.push(span.value);
    }
    expect(new Set(counts).size).toBe(counts.length);
  },
);

// ---------------------------------------------------------------------------
// A held run's span
// ---------------------------------------------------------------------------

test(
  "a held run's span: while the harness keeps its hold standing it drives invocations whose delays together pass the held run's own guard — that guard stands suspended, never spanning them — and the run completes once its hold is lifted (TEST-SPEC S-3: a held run's guard covers its own work, never what the harness drives during its hold)",
  SPAN_DECLARATION,
  async () => {
    const { workspace, binding } = await standin();
    const hold = path.join(workspace.tempRoot, "s3-span-hold");
    const held = await startProduct(binding, {
      cwd: workspace.root,
      argv: ["held", "--test-hold", hold],
      timeoutMs: OWN_GUARD_MS,
    });
    await held.waitForFile(hold);
    const span = await timed(async () => {
      for (let index = 0; index < SPAN_LENGTH; index += 1) {
        await delayedInvocation(
          binding,
          workspace.root,
          `the harness's invocation ${String(index + 1)} during the hold`,
        );
        expect(held.hasExited()).toBe(false);
      }
    });
    expect(span.ms).toBeGreaterThan(OWN_GUARD_MS);
    await releaseHoldFile(hold);
    const result = await held.waitForExit();
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("released");
  },
);
