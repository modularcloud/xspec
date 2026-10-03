// P-8's fixed-seed draw guard (TEST-SPEC §16 P-8; §18 E-5; §0 H-10). CI runs
// P-8 over a fixed seed set (E-5), so the trials it stages are a pure
// function of its generator, the seed set, and its registered runs per seed
// (`P8_RUNS_PER_SEED`; P-8 passes no `seeds`). They are replayed here exactly
// as `checkProperty` draws them — `drawFixedSeedTrials`, one sequential PRNG
// stream per seed — with no property body and no product (H-8's ordering:
// the guard holds before any product exists). Two test-strength obligations
// of P-8 must hold of those draws, so that a generator, menu, or run-count
// change that moves them cannot drop either silently:
//
//   1. the giant-nesting floor: "its staged draws MUST include section
//      nesting at least 2048 levels deep" (a floor on staged inputs, not a
//      product bound). A draw counts toward it when it is a nesting mutation
//      of an MDX target — the section tower `sectionTowerSource` builds,
//      balanced or unclosed — and that tower's bytes survive intact into
//      the file the trial stages: a later mutation of the same file (a
//      truncation, a garbage or tower replacement, a terminator rewrite, a
//      splice into the tower) can undo the nesting, and a TypeScript target's
//      parenthesis or bracket tower is no section nesting. S-8's pooled
//      replay (test/self/s8-answer-scale-capacity.test.ts) reads the bare
//      `depth-<n>` descriptions over P-8's and P-11's draws together at 25
//      runs per seed; it bounds the capacity maxima and cannot see the floor
//      leave P-8's own registered runs;
//   2. the command sweep: P-8 holds "every command" to its robustness
//      clauses, so every `COMMAND_MENU` form must be drawn at least once by
//      P-8's own fixed-seed trials — a form the menu offers that CI never
//      draws would go unexercised. Should the fixed seeds miss a form, raise
//      the per-trial command count or weight the pick; never weaken this.

import { Buffer } from "node:buffer";
import { expect, test } from "vitest";
import {
  DEFAULT_PROPERTY_SEEDS,
  drawFixedSeedTrials,
} from "../helpers/property.js";
import {
  COMMAND_MENU,
  genFuzzTrial,
  P8_RUNS_PER_SEED,
  sectionTowerSource,
} from "../suite/registry/section-16-p8.js";
import type { FuzzTrial } from "../suite/registry/section-16-p8.js";
import { GIANT_NESTING_FLOOR } from "./staged-scale.js";

/** The replay's runs per seed: P-8's registered count, never another. */
const REPLAY_RUNS = P8_RUNS_PER_SEED;

/** One replayed P-8 trial, labelled with its seed and 1-based trial number. */
interface ReplayedTrial {
  readonly label: string;
  readonly trial: FuzzTrial;
}

/** P-8's own fixed-seed draws, exactly as its registered run stages them. */
function replayP8Draws(): ReplayedTrial[] {
  const trials = drawFixedSeedTrials(genFuzzTrial, REPLAY_RUNS);
  return trials.map((trial, index) => {
    const seed = DEFAULT_PROPERTY_SEEDS[Math.floor(index / REPLAY_RUNS)];
    const number = (index % REPLAY_RUNS) + 1;
    return { label: `seed ${String(seed)}, trial ${String(number)}`, trial };
  });
}

/**
 * A nesting mutation's log line for an MDX target (`mutateNesting` in
 * section-16-p8.ts, prefixed with the target path by `genFuzzTrial`).
 */
const SECTION_TOWER_DRAW =
  /^(.+): (?:append|replace with) a depth-(\d+) (balanced|unclosed) section tower$/;

/** A section-tower draw of one trial, and whether its staged file keeps it. */
interface SectionTowerDraw {
  readonly description: string;
  readonly depth: number;
  readonly intact: boolean;
}

function sectionTowerDraws(trial: FuzzTrial): SectionTowerDraw[] {
  const staged = new Map(trial.files);
  const draws: SectionTowerDraw[] = [];
  for (const description of trial.mutations) {
    const match = SECTION_TOWER_DRAW.exec(description);
    if (match === null) continue;
    const [, path = "", depthText = "", shape = ""] = match;
    const bytes = staged.get(path);
    if (bytes === undefined) {
      throw new Error(
        `P-8 draw guard: the trial logs "${description}" but stages no file at ${path}`,
      );
    }
    const depth = Number(depthText);
    const tower = Buffer.from(
      sectionTowerSource(depth, shape === "balanced"),
      "utf8",
    );
    const intact = Buffer.from(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength,
    ).includes(tower);
    draws.push({ description, depth, intact });
  }
  return draws;
}

test("P-8's own fixed-seed draws stage its giant-nesting floor — an intact MDX section tower at least 2048 levels deep (TEST-SPEC §16 P-8; E-5 replay at P-8's registered runs per seed)", () => {
  let deepest = 0;
  const towers: string[] = [];
  for (const { label, trial } of replayP8Draws()) {
    for (const draw of sectionTowerDraws(trial)) {
      towers.push(
        `${label}: ${draw.description}${draw.intact ? "" : " (undone by a later mutation)"}`,
      );
      if (draw.intact) deepest = Math.max(deepest, draw.depth);
    }
  }
  expect(
    deepest,
    `P-8's fixed-seed draws (${String(DEFAULT_PROPERTY_SEEDS.length)} seeds × ` +
      `${String(REPLAY_RUNS)} runs) must stage section nesting at least ` +
      `${String(GIANT_NESTING_FLOOR)} levels deep (TEST-SPEC §16 P-8); their ` +
      `section-tower draws: ${JSON.stringify(towers)}`,
  ).toBeGreaterThanOrEqual(GIANT_NESTING_FLOOR);
});

test("the floor reading counts an MDX section tower only where its trial stages it intact, and never a TypeScript tower (guard vectors)", () => {
  const depth = GIANT_NESTING_FLOOR;
  const utf8 = (text: string): Uint8Array =>
    Uint8Array.from(Buffer.from(text, "utf8"));
  const unclosed = utf8(sectionTowerSource(depth, false));
  const replaced = `specs/A.mdx: replace with a depth-${String(depth)} unclosed section tower`;
  const appended = `specs/B.mdx: append a depth-${String(depth)} balanced section tower`;
  const bracket = `src/app.ts: append a depth-${String(depth)} unbalanced bracket tower`;
  const trial = (
    files: ReadonlyArray<readonly [string, Uint8Array]>,
    mutations: readonly string[],
  ): FuzzTrial => ({ files, mutations, commands: [] });
  // Staged as drawn: the replaced file is the tower; the appended tower
  // follows the file's own bytes.
  expect(
    sectionTowerDraws(
      trial(
        [
          ["specs/A.mdx", unclosed],
          ["specs/B.mdx", utf8(`# B\n\n${sectionTowerSource(depth, true)}`)],
        ],
        [replaced, appended],
      ),
    ),
  ).toEqual([
    { description: replaced, depth, intact: true },
    { description: appended, depth, intact: true },
  ]);
  // A later mutation of the same file undoes the tower: one byte short.
  expect(
    sectionTowerDraws(
      trial(
        [["specs/A.mdx", unclosed.subarray(0, unclosed.length - 1)]],
        [
          replaced,
          `specs/A.mdx: truncate to the first ${String(unclosed.length - 1)} byte(s)`,
        ],
      ),
    ),
  ).toEqual([{ description: replaced, depth, intact: false }]);
  // A TypeScript target's tower is no section nesting.
  expect(
    sectionTowerDraws(
      trial(
        [["src/app.ts", utf8(`const zz = ${"[".repeat(depth)}\n`)]],
        [bracket],
      ),
    ),
  ).toEqual([]);
});

test("P-8's own fixed-seed draws exercise every command-menu form (TEST-SPEC §16 P-8's command sweep; E-5 replay at P-8's registered runs per seed)", () => {
  const drawn = new Set<string>();
  for (const { trial } of replayP8Draws()) {
    for (const argv of trial.commands) drawn.add(JSON.stringify(argv));
  }
  const undrawn = COMMAND_MENU.filter(
    (argv) => !drawn.has(JSON.stringify(argv)),
  ).map((argv) => argv.join(" "));
  expect(
    undrawn,
    `every COMMAND_MENU form must be drawn by P-8's fixed-seed trials ` +
      `(${String(DEFAULT_PROPERTY_SEEDS.length)} seeds × ` +
      `${String(REPLAY_RUNS)} runs; ${String(drawn.size)} of ` +
      `${String(COMMAND_MENU.length)} forms drawn) — raise the per-trial ` +
      `command count or weight the pick, never weaken this guard`,
  ).toEqual([]);
});
