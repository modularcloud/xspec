// TEST-SPEC §16 P-11 (availability robustness) — PROP-09.
//
// One registered product-facing fuzz test (C-2 "one code path"): fuzzed and
// mutated spec and code sources — P-8's generators over P-8's base workspace
// (section-16-p8.ts: `FUZZ_BASE_FILES`, `drawFuzzMutation`; TEST-SPEC §16
// P-11 "P-8's generators — the availability contract is precisely an
// imperfect-input surface") — driven through `occurrences`, `view` (with and
// without `--text`), and `at` at random offsets, asserting per invocation
// exactly the robustness contract P-11 states:
//
//   * every invocation terminates — operationalized by the subprocess
//     driver's hang guard (helpers/subprocess.ts): a run killed by the
//     per-invocation timeout or the runaway-output cap is converted into a
//     *diagnosed assertion failure* (H-8), because termination is this
//     property's assertion, not merely harness hygiene; the timeout is
//     dimensioned to the staged answer scale (H-11; `FUZZ_COMMAND_TIMEOUT_MS`
//     below), and a killed invocation is reported unshrunk, since every
//     shrink candidate re-observing a kill would cost the full guard;
//   * stdout is one complete JSON document, never partial — the three
//     surfaces are JSON-only (SPEC 11: a single JSON document is the only
//     output form, with or without `--json`), so the entire stdout must
//     parse as exactly one document on every exit, the 12.7 error document
//     (`{"error": …}`) on exit 2 (SPEC 12.0, H-5);
//   * the exit is 0 or 1 per 11.2 — 2 only for the trial's deliberately
//     staged argument errors, which the 11.2 precedence clause pins to
//     exactly exit 2 "whatever findings the workspace or the named files
//     carry" (argument checks precede answering);
//   * every datum is exactly one of plain value, `null`, or
//     `{"unavailable": true}` (SPEC 11.4, 12.7) — asserted by decoding the
//     whole answer through the form-exact 12.7 document decoders
//     (adapters/forms.ts, H-3), whose per-member three-state decodes and
//     whole-document unavailability-marker walk reject any fourth state,
//     any omitted member, and any non-marker object spelling `unavailable`;
//   * any finding or unavailable datum implies exit 1 with the full
//     document emitted — the decode enforces the complete document form —
//     and exit 0 implies a finding-free document carrying none: with the
//     exit pinned to {0, 1}, the two directions close 11.2's iff (a
//     complete, finding-free answer exits 0; imperfection exits 1 and
//     never withholds the answer).
//
// Staging: each trial writes the base workspace with 1–3 drawn mutations
// applied to the SOURCES ONLY — `specs/A.mdx`, `specs/B.mdx`, `src/app.ts` —
// never to `xspec.config.ts`. P-11's input space is "fuzzed and mutated spec
// and code sources"; the configuration must stay valid by construction,
// because a configuration error is a 14.14 exit-2 outcome that precedes
// every answer (12.0) and would sit outside the staged-argument-error set
// the exit clause admits. No staging `build` runs and no prior derived state
// exists: the availability surfaces answer from current sources whatever the
// workspace's validity and write nothing on a failing one (SPEC 11.2 "never
// stale"), so the answers under test need no build — and mutations are
// frequently benign, exercising the exit-0 clean side too.
//
// The invocation menu (2–4 drawn arms per trial) spans the three surfaces'
// argument grammar. Answer arms (exit 0/1 expected): bare `occurrences`;
// `occurrences --file <glob>` (set restriction; a glob admitting none admits
// the empty set, 11.3); `occurrences --to <well-formed identity>` (syntactic
// acceptance — unknown and unresolving spellings select nothing, 11.3); bare
// `view`; `view` with operand subsets; `view --file <glob>` (a glob
// admitting only code sources admits the empty set, 11.4) — each with and
// without `--text` — and `at <file> <offset>` with the offset drawn over
// [0, staged byte length] (offset = length resolves to the root, 11.5).
// Staged-argument-error arms (exit 2 + the 12.7 error document expected,
// SPEC 11.2/12.0): a `view` or `at` operand of the wrong kind (a discovered
// code source, 11.4/11.5) or outside the discovered set (12.0); `view`
// operands combined with `--file` (11.4); an out-of-range or malformed
// `<offset>` spelling (11.5: only ASCII decimal digits spell one); a
// malformed `--to` spelling (11.3's well-formedness rules); a `--file`
// pattern resolving outside the workspace root (11.3/11.1, the outside-root
// rule of 7); a repeated flag and an unknown flag (12.0). Discovery is
// path-based (SPEC 7), so mutations never change which files are
// discovered, and the trial knows each arm's error/answer expectation at
// generation time. Offsets and error excesses are drawn against the staged
// bytes at generation time, so replay and shrinking re-derive identical
// invocations (H-10).
//
// An implementation-time dry-run over the committed default seeds at the
// registered 12 runs per seed verified that every menu entry — all seven
// answer arms and all ten staged-error arms — and every mutation kind and
// mutation target occurs across the CI-pinned trial set (E-5), so the fixed
// seeds exercise the full surface deterministically.
//
// P-11 is outside every CERTIFICATIONS.md fixture scope (Exclusions:
// "P-11's imperfect-input classes are broad basins under P-8's mutators …
// its datum-form discipline is certified deterministically through the
// CONF-AVAIL datum-form violators"), so this body binds only to the real
// product surface.

import { Buffer } from "node:buffer";
import type { Finding } from "../../helpers/adapters/index.js";
import {
  decodeAtReport,
  decodeErrorDocument,
  decodeOccurrencesReport,
  decodeViewReport,
} from "../../helpers/adapters/index.js";
import { fail, parseJsonStdout } from "../../helpers/assertions.js";
import type { Choices, Gen } from "../../helpers/property.js";
import { checkProperty, listOf } from "../../helpers/property.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import type { ProductBinding, RunResult } from "../../helpers/subprocess.js";
import {
  ProductRunOutputOverflowError,
  ProductRunTimeoutError,
  runProduct,
} from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import {
  drawFuzzMutation,
  FUZZ_BASE_FILES,
  MAX_MUTATIONS_PER_TRIAL,
} from "./section-16-p8.js";

// ---------------------------------------------------------------------------
// The mutable surface: the spec and code sources of the shared fuzz base
// workspace — never the configuration (see the module header).

const SPEC_SOURCES = ["specs/A.mdx", "specs/B.mdx"] as const;
const CODE_SOURCE = "src/app.ts";
const MUTATION_TARGETS: readonly string[] = [...SPEC_SOURCES, CODE_SOURCE];

// ---------------------------------------------------------------------------
// Argument pools. Simplest entries first (pick shrinks toward the first).

/** `--file` restrictions over the discovered set (SPEC 11.3, glob rules 7). */
const OCCURRENCES_FILE_GLOBS: readonly string[] = [
  "specs/*.mdx",
  "**",
  "src/**",
  "nomatch/**", // admits the empty set — an empty, finding-free answer
];

/** `--file` restrictions over the view domain (SPEC 11.4). */
const VIEW_FILE_GLOBS: readonly string[] = [
  "specs/*.mdx",
  "specs/**",
  "src/**", // admits only code sources — the empty set (11.4)
  "nomatch/**",
];

/**
 * Well-formed `--to` spellings (11.3: acceptance is syntactic; unknown or
 * unresolving identities select nothing and are never usage errors).
 */
const WELL_FORMED_TO_TARGETS: readonly string[] = [
  "specs/A.mdx#a",
  "specs/A.mdx#a.b",
  "specs/B.mdx#b",
  "specs/A.mdx", // bare path — a root identity (1.5)
  "specs/A.mdx#zz", // no such node — empty selection
  "other/Z.mdx#q", // undiscovered file — empty selection
];

/** Malformed `--to` spellings (11.3's well-formedness rules; 1.4). */
const MALFORMED_TO_SPELLINGS: readonly string[] = [
  "a#b#c", // more than one `#`
  "#x", // empty path part
  "specs/A.mdx#", // `#` with no segment
  "specs/A.mdx#a..b", // empty segment
  "specs/A.mdx#a b", // whitespace inside a segment (1.4)
];

/**
 * `<offset>` spellings that are not one-or-more ASCII decimal digits (11.5:
 * a sign, whitespace, or any other character is not a non-negative
 * integer's spelling; leading zeros ARE permitted, so none appears here).
 */
const MALFORMED_OFFSET_SPELLINGS: readonly string[] = [
  "-1",
  "+3",
  "1.5",
  "0x10",
  " 7",
  "seven",
  "",
];

/** The established outside-root pattern staging (T11-2's spelling). */
const OUTSIDE_ROOT_GLOB = "../*.mdx";

// ---------------------------------------------------------------------------
// Trial generation

/** One drawn invocation with its generation-time expectation. */
export interface AvailabilityArm {
  readonly argv: readonly string[];
  /** Which 12.7 document form an answer decodes through. */
  readonly surface: "occurrences" | "view" | "at";
  /** view only: whether `--text` is among the arguments (12.7 text members). */
  readonly text: boolean;
  /**
   * A deliberately staged argument error: expect exit 2 with the 12.7 error
   * document (SPEC 11.2: argument checks precede answering). Answer arms
   * expect exit 0 or 1 with the surface's full document.
   */
  readonly stagedError: boolean;
}

/** One generated trial: staged bytes, the mutation log, and drawn arms. */
export interface AvailabilityTrial {
  /** Staged bytes per workspace-relative path (base files + mutations). */
  readonly files: ReadonlyArray<readonly [string, Uint8Array]>;
  /** Human-readable description of each applied mutation. */
  readonly mutations: readonly string[];
  /** Drawn invocations, run in order. */
  readonly arms: readonly AvailabilityArm[];
}

type ArmBuilder = (
  choices: Choices,
  staged: ReadonlyMap<string, Uint8Array>,
) => AvailabilityArm;

function stagedLength(
  staged: ReadonlyMap<string, Uint8Array>,
  path: string,
): number {
  const bytes = staged.get(path);
  if (bytes === undefined) {
    throw new Error(`P-11 harness defect: no staged bytes for ${path}`);
  }
  return bytes.length;
}

const answerArm = (
  surface: AvailabilityArm["surface"],
  argv: readonly string[],
  text = false,
): AvailabilityArm => ({ argv, surface, text, stagedError: false });

const errorArm = (
  surface: AvailabilityArm["surface"],
  argv: readonly string[],
): AvailabilityArm => ({ argv, surface, text: false, stagedError: true });

/**
 * The invocation menu (see the module header). Weighted toward the answer
 * arms — the property's heart is the answer contract; the staged-error arms
 * pin the "2 only for staged argument errors" boundary — and ordered
 * simplest-first (weightedPick shrinks toward the first entry).
 */
const ARM_MENU: ReadonlyArray<readonly [number, ArmBuilder]> = [
  // --- answer arms (exit 0/1 per 11.2) ---
  [4, () => answerArm("occurrences", ["occurrences"])],
  [
    3,
    (c) =>
      answerArm("occurrences", [
        "occurrences",
        "--file",
        c.pick(OCCURRENCES_FILE_GLOBS),
      ]),
  ],
  [
    3,
    (c) =>
      answerArm("occurrences", [
        "occurrences",
        "--to",
        c.pick(WELL_FORMED_TO_TARGETS),
      ]),
  ],
  [
    4,
    (c) => {
      const text = c.boolean();
      return answerArm("view", text ? ["view", "--text"] : ["view"], text);
    },
  ],
  [
    3,
    (c) => {
      const operands = c.pick<readonly string[]>([
        [SPEC_SOURCES[0]],
        [SPEC_SOURCES[1]],
        [...SPEC_SOURCES],
      ]);
      const text = c.boolean();
      return answerArm(
        "view",
        text ? ["view", ...operands, "--text"] : ["view", ...operands],
        text,
      );
    },
  ],
  [
    3,
    (c) => {
      const glob = c.pick(VIEW_FILE_GLOBS);
      const text = c.boolean();
      return answerArm(
        "view",
        text ? ["view", "--file", glob, "--text"] : ["view", "--file", glob],
        text,
      );
    },
  ],
  [
    4,
    (c, staged) => {
      const file = c.pick(SPEC_SOURCES);
      // Every within-file offset resolves, and offset = byte length is the
      // end-of-file caret resolving to the root (SPEC 11.5).
      const offset = c.intInclusive(0, stagedLength(staged, file));
      return answerArm("at", ["at", file, String(offset)]);
    },
  ],
  // --- staged argument errors (exit 2 per 11.2/12.0) ---
  [1, () => errorArm("view", ["view", CODE_SOURCE])], // wrong-kind operand (11.4)
  [1, () => errorArm("view", ["view", "specs/None.mdx"])], // unknown file (12.0)
  [
    2,
    () => errorArm("view", ["view", SPEC_SOURCES[0], "--file", "specs/*.mdx"]), // operands + --file (11.4)
  ],
  [1, () => errorArm("at", ["at", CODE_SOURCE, "0"])], // wrong-kind operand (11.5)
  [
    2,
    (c, staged) => {
      const file = c.pick(SPEC_SOURCES);
      const excess = 1 + c.intInclusive(0, 8);
      return errorArm("at", [
        "at",
        file,
        String(stagedLength(staged, file) + excess), // out of range (11.5)
      ]);
    },
  ],
  [
    1,
    (c) =>
      errorArm("at", [
        "at",
        SPEC_SOURCES[0],
        c.pick(MALFORMED_OFFSET_SPELLINGS), // not a non-negative integer's spelling (11.5)
      ]),
  ],
  [
    1,
    (c) =>
      errorArm("occurrences", [
        "occurrences",
        "--to",
        c.pick(MALFORMED_TO_SPELLINGS), // malformed identity spelling (11.3)
      ]),
  ],
  [
    1,
    (c) => {
      const surface = c.pick(["occurrences", "view"] as const);
      return errorArm(surface, [surface, "--file", OUTSIDE_ROOT_GLOB]); // outside root (11.3/11.1, 7)
    },
  ],
  [
    1,
    () =>
      errorArm("occurrences", [
        "occurrences",
        "--file",
        "specs/*.mdx",
        "--file",
        "src/**", // repeated flag (12.0)
      ]),
  ],
  [1, () => errorArm("view", ["view", "--frobnicate"])], // unknown flag (12.0)
];

/** The P-11 trial generator (see the module header). */
export const genAvailabilityTrial: Gen<AvailabilityTrial> = (choices) => {
  const files = new Map<string, Uint8Array>(
    FUZZ_BASE_FILES.map(([path, text]) => [
      path,
      Uint8Array.from(Buffer.from(text, "utf8")),
    ]),
  );
  const mutations: string[] = [];
  const mutationCount =
    1 + choices.intInclusive(0, MAX_MUTATIONS_PER_TRIAL - 1);
  for (let i = 0; i < mutationCount; i += 1) {
    const path = choices.pick(MUTATION_TARGETS);
    const current = files.get(path);
    if (current === undefined) {
      throw new Error(`P-11 harness defect: no staged bytes for ${path}`);
    }
    const result = drawFuzzMutation(choices, current, path);
    files.set(path, result.bytes);
    mutations.push(`${path}: ${result.description}`);
  }
  const arms = listOf((c: Choices) => c.weightedPick(ARM_MENU)(c, files), {
    min: 2,
    max: 4,
  })(choices);
  return { files: [...files.entries()], mutations, arms };
};

/** Counterexample rendering: the mutation log and the drawn invocations. */
export function renderAvailabilityTrial(trial: AvailabilityTrial): string {
  return JSON.stringify({
    mutations: trial.mutations,
    arms: trial.arms.map(
      (arm) =>
        `${arm.argv.join(" ")}${arm.stagedError ? " [staged argument error]" : ""}`,
    ),
  });
}

// ---------------------------------------------------------------------------
// Assertions

/**
 * Per-invocation hang guard. Purely the H-8 guard bounding the observation
 * "the invocation terminates" — never an assertion input beyond that (H-10)
 * — dimensioned to the staged answer scale (H-11), not to parse time. The
 * largest answer SPEC.md permits over a P-11 draw is `view --text` over
 * `specs/A.mdx` carrying two appended depth-4096 section towers under P-8's
 * LF → U+2028 rewrite (the whole mutation budget), whose quadratic text
 * expansion S-8 sizes the capture to (~204 MB in the `\u2028` spelling).
 * Measured at 20ee9fd through `runProduct` against the built product on a
 * 4-core machine: that invocation emits 58.6 MB and terminates in 17.0 s
 * (bare `view --text` over the same workspace 16.5 s; the same input with
 * LF → U+0020, 9.3 s; the other surfaces at that scale — `view`,
 * `occurrences`, `at` — 1.0–1.5 s; any arm over an unmutated-scale draw
 * ~0.3 s). 120 s is 7× that maximum: the ≥ 4× margin a conforming product
 * is owed over its measured answer time, plus headroom for the up-to-3.5×
 * larger `\u2028` spelling and slower CI runners. So a conforming product
 * is never killed while still emitting its answer (H-11: an exhausted
 * harness limit is a harness defect, never a diagnosed product failure),
 * and a genuinely hanging one costs one guard per diagnosis, reported
 * unshrunk (runAvailabilityCommand). Re-measure with a temporary self-test
 * staging `FUZZ_BASE_FILES` with `sectionTowerSource(4096, true)` appended
 * twice to `specs/A.mdx` and every LF rewritten to U+2028 (see AGENTS.md).
 */
const FUZZ_COMMAND_TIMEOUT_MS = 120_000;

/**
 * Run one availability invocation, converting the hang-guard and
 * runaway-output kills — exactly those — into diagnosed assertion failures:
 * P-11's first clause is that every invocation terminates. Anything else
 * thrown by the driver stays a harness error (H-8).
 */
async function runAvailabilityCommand(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
): Promise<RunResult> {
  try {
    return await runProduct(product, {
      cwd: workspace.root,
      argv,
      timeoutMs: FUZZ_COMMAND_TIMEOUT_MS,
    });
  } catch (error) {
    // Both driver kills are reported unshrunk (`shrinkable: false`): a
    // shrink candidate can re-observe a kill only by waiting out the guard
    // (or filling the output cap) again — one full guard per candidate — so
    // shrinking's execution budget would stop bounding the body's wall
    // clock (the entry's `timeoutMs` below). The drawn trial, at most three
    // mutations and four invocations, is the reported counterexample, and
    // its seed replays it (H-10).
    if (error instanceof ProductRunTimeoutError) {
      fail(
        `P-11: every invocation of the availability surfaces must terminate ` +
          `on fuzzed sources (TEST-SPEC §16 P-11; SPEC 11.2, 12.0), but the ` +
          `invocation was still running when the harness's hang guard killed ` +
          `it — ${error.message}`,
        { shrinkable: false },
      );
    }
    if (error instanceof ProductRunOutputOverflowError) {
      fail(
        `P-11: every invocation must terminate with bounded output — one ` +
          `complete JSON document (TEST-SPEC §16 P-11; SPEC 11, 12.0) — but ` +
          `the invocation emitted unbounded output until the harness's ` +
          `runaway-output guard killed it — ${error.message}`,
        { shrinkable: false },
      );
    }
    throw error;
  }
}

/**
 * Does the raw parsed document carry any explicitly-unavailable datum? The
 * form decode has already run `assertUnavailabilityMarkerForms` over the
 * whole document (adapters/forms.ts), so every object spelling a member
 * named `unavailable` is exactly the marker `{"unavailable": true}`
 * (SPEC 12.7) — presence of the member is presence of the marker. Exported
 * for S-8, which drives this walk at the suite's staged answer scale.
 */
export function documentCarriesUnavailability(value: unknown): boolean {
  // H-11: an explicit stack, never native recursion per nesting level — the
  // fuzzed `view` answers carry the depth-2048 and depth-4096 section towers
  // the suite stages (P-8, P-11), past V8's frame budget; no depth cap.
  const pending: unknown[] = [value];
  while (pending.length > 0) {
    const current = pending.pop();
    if (Array.isArray(current)) {
      for (let index = current.length - 1; index >= 0; index -= 1) {
        pending.push(current[index]);
      }
      continue;
    }
    if (typeof current !== "object" || current === null) continue;
    const obj = current as Record<string, unknown>;
    if (Object.hasOwn(obj, "unavailable")) return true;
    const members = Object.values(obj);
    for (let index = members.length - 1; index >= 0; index -= 1) {
      pending.push(members[index]);
    }
  }
  return false;
}

/** Decode an answer through its surface's form-exact 12.7 decoder (H-3). */
function decodeAnswer(
  doc: unknown,
  arm: AvailabilityArm,
  context: string,
): readonly Finding[] {
  switch (arm.surface) {
    case "occurrences":
      return decodeOccurrencesReport(doc, context).findings;
    case "view":
      return decodeViewReport(doc, { text: arm.text }, context).findings;
    case "at":
      return decodeAtReport(doc, context).findings;
  }
}

/**
 * Run one drawn invocation with the P-11 assertions: termination (via
 * `runAvailabilityCommand`), no signal death, the exit clause, one complete
 * JSON document as the entire stdout, the form-exact three-state decode,
 * and the finding/unavailability ⟷ exit correspondence of 11.2.
 */
async function runAvailabilityArm(
  product: ProductBinding,
  workspace: TestWorkspace,
  arm: AvailabilityArm,
  trial: AvailabilityTrial,
): Promise<void> {
  const context =
    `P-11 \`xspec ${arm.argv.join(" ")}\` over the fuzzed workspace ` +
    `(mutations: ${JSON.stringify(trial.mutations)})`;
  const result = await runAvailabilityCommand(product, workspace, arm.argv);
  if (result.signal !== null) {
    fail(
      `${context}: ${result.commandLine} died by signal ` +
        `${String(result.signal)} instead of exiting — SPEC 12.0 partitions ` +
        `all outcomes into exit codes 0, 1, and 2 (P-11)`,
    );
  }
  if (arm.stagedError) {
    if (result.exitCode !== 2) {
      fail(
        `${context}: this staged argument error must exit 2 — the argument ` +
          `checks of 11.3–11.5 precede answering, "whatever findings the ` +
          `workspace or the named files carry" (SPEC 11.2, 12.0) — got exit ` +
          `${String(result.exitCode)}`,
      );
    }
    // JSON output is in effect (a JSON-only surface, SPEC 11/12.0): the
    // entire stdout is the single 12.7 error document, decoded form-exactly.
    decodeErrorDocument(
      parseJsonStdout(
        result,
        `${context} — an exit-2 invocation of a JSON-only surface emits the ` +
          `12.7 error document as its entire stdout (SPEC 12.0, H-5)`,
      ),
      context,
    );
    return;
  }
  if (result.exitCode !== 0 && result.exitCode !== 1) {
    fail(
      `${context}: exit ${String(result.exitCode)} — an availability answer ` +
        `exits 0 or 1; exit 2 arises only from usage and configuration ` +
        `errors, none of which this invocation stages (SPEC 11.2, 12.0; ` +
        `P-11: "2 only for staged argument errors")`,
    );
  }
  // One complete JSON document as the entire stdout (SPEC 11, 12.0; a
  // partial or concatenated document fails its own parse), then the
  // form-exact 12.7 decode: member names literal, every datum exactly one
  // of plain value / null / {"unavailable": true} (SPEC 11.4, 12.7; H-3) —
  // the full document, so exit 1 demonstrably never withholds the answer.
  const doc = parseJsonStdout(result, context);
  const findings = decodeAnswer(doc, arm, context);
  const carriesUnavailability = documentCarriesUnavailability(doc);
  if (findings.length > 0 || carriesUnavailability) {
    if (result.exitCode !== 1) {
      fail(
        `${context}: the answer carries ${String(findings.length)} ` +
          `finding(s)${carriesUnavailability ? " and explicitly-unavailable data" : ""} ` +
          `yet exited ${String(result.exitCode)} — any finding or ` +
          `unavailable datum implies exit 1, with the full document still ` +
          `emitted (SPEC 11.2; P-11)`,
      );
    }
    return;
  }
  if (result.exitCode !== 0) {
    fail(
      `${context}: the answer is complete and finding-free — no finding, no ` +
        `explicitly-unavailable datum — yet exited ` +
        `${String(result.exitCode)}; a complete, finding-free answer exits 0 ` +
        `(SPEC 11.2; P-11)`,
    );
  }
}

/** The P-11 property body for one trial (see the module header). */
async function runAvailabilityTrial(
  product: ProductBinding,
  trial: AvailabilityTrial,
): Promise<void> {
  const workspace = await TestWorkspace.create({
    files: Object.fromEntries(trial.files),
  });
  try {
    for (const arm of trial.arms) {
      await runAvailabilityArm(product, workspace, arm, trial);
    }
  } finally {
    await workspace.dispose();
  }
}

// ---------------------------------------------------------------------------
// The registered fuzz test

const P_11 = defineProductTest({
  id: "P-11",
  title:
    "fuzz: over byte-mutated spec and code sources, `occurrences`, `view` " +
    "(with and without --text), and `at` at random offsets always terminate, " +
    "emit one complete JSON document, exit 0 or 1 (2 only for staged " +
    "argument errors), answer in the three-state 12.7 datum forms, and exit " +
    "1 exactly when the answer carries a finding or an unavailable datum " +
    "(SPEC 11.2, 11.4, 12.7; TEST-SPEC §16 P-11)",
  // Wall-clock hang guard on the body only (H-10), sized to the diagnosis
  // path, never an assertion input. The sweep is three fixed seeds (E-5) ×
  // 12 trials × 2–4 invocations, ≤ 144, each bounded by
  // FUZZ_COMMAND_TIMEOUT_MS and with no staging build. A conforming product
  // answers within the measured scale that guard is derived from — ≤ 17 s
  // for a `view --text` arm at the staged maximum, ≤ 1.5 s for any other arm
  // at tower scale (the pinned seeds draw 18 `view --text` answer arms, 2 of
  // them over towers, and 5 tower trials in all; dry run at 20ee9fd) — so a
  // sweep whose every text arm reached the maximum runs ≈ 8.5 min; a
  // slow-but-terminating product then fails as one hang-guard kill on top,
  // unshrunk (≈ 10.5 min in all), and 20 min doubles that for CI runners:
  // the failure is the guard's diagnosis of one invocation, never this body
  // timeout. Shrinking any other failure class costs answer time, not guard
  // time (≤ 100 executions at ≤ 17 s per maximal-scale text arm). The
  // adversarial bound — every invocation just under the guard — is ≈ 4.8 h,
  // past the 45-minute CI job ceiling governing the whole suite; no body
  // budget can cover it.
  timeoutMs: 1_200_000,
  run: async (product) => {
    await checkProperty(
      "P-11 availability robustness",
      genAvailabilityTrial,
      async (trial) => {
        await runAvailabilityTrial(product, trial);
      },
      { runs: 12, maxShrinkExecutions: 100, render: renderAvailabilityTrial },
    );
  },
});

/** TEST-SPEC §16 P-11 (PROP-09). */
export const section16P11Tests: readonly ProductTestEntry[] = [P_11];
