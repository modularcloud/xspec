// P-5's fixed-seed draw guard (TEST-SPEC §16 P-5; §18 E-5; §0 H-10). CI runs
// P-5 over a fixed seed set (E-5), so the section moves its second arm
// stages are a pure function of its generator (`genSectionMoveTrial`), the
// seed set, and its registered runs per seed (`P5_SECTION_MOVE_RUNS`; P-5
// passes no `seeds`). They are replayed here exactly as `checkProperty`
// draws them — `drawFixedSeedTrials`, one sequential PRNG stream per seed —
// with no property body and no product (H-8's ordering: the guard holds
// before any product exists).
//
// One test-strength obligation of P-5 must hold of those draws, so that a
// generator change — P-5's own, or the PROP-03 model generator's it draws
// through, which moves every stream after it — cannot drop it silently: a
// single-line section holding prose outside its tags "is drawn into either"
// a flow-position parent or one whose tags stand in text position
// (TEST-SPEC §16 P-5), so P-5's own fixed-seed trials route such a section
// into a text-position target parent in every shape the staging renders
// (`TEXT_POSITION_SHAPES`: T6.5-2's fourth geometry, its closing tag on a
// later line, and the self-closing parent — T6.5-16(c)'s three control
// parents). No unbiased draw reached one under the fixed seeds (the module
// header of test/suite/registry/section-16-p5-p6.ts, "the target side");
// should the fixed seeds miss a shape, re-weight the text-position bias or
// routing there and re-measure; never weaken this.
//
// Every fixed-seed draw must also pass S-9's per-draw check (TEST-SPEC §16
// P-5, §17 S-9) before any product exists, through the very code path P-5
// takes: `checkProperty` over the arm-2 generator at the fixed seed set and
// the registered runs, with P-5's own `drawSources`
// (`stagedSectionMoveSources`) — each draw's staged files and the would-be
// texts of its move, the files as 6.5's edits would leave them (the
// origin, an existing target or the coincident file, a created target with
// its declarations, each file referencing into the moved subtree with the
// created module's import), each judged by `deriveMdx` before the body
// runs. P-5 itself stops at its first falsified trial, so its later draws
// reach the check only here. A draw failing it is a generator defect (a
// refused shape drawn: exclude it as TEST-SPEC §16 P-5 lists) or a would-be
// composition defect; fix that, never silence the check.

import { expect, test } from "vitest";
import {
  checkProperty,
  DEFAULT_PROPERTY_SEEDS,
  drawFixedSeedTrials,
} from "../helpers/property.js";
import {
  genSectionMoveTrial,
  P5_SECTION_MOVE_RUNS,
  P5_WOULD_BE_LABEL_PREFIX,
  stagedSectionMoveSources,
  TEXT_POSITION_SHAPES,
} from "../suite/registry/section-16-p5-p6.js";

test("P-5's own fixed-seed section moves route a single-line section holding prose into a text-position target parent in every shape (TEST-SPEC §16 P-5; E-5 replay at P-5's registered runs per seed)", () => {
  const trials = drawFixedSeedTrials(genSectionMoveTrial, P5_SECTION_MOVE_RUNS);
  const reached = new Map<string, string[]>();
  trials.forEach((trial, index) => {
    if (trial.textPositionTarget === null) return;
    const seed =
      DEFAULT_PROPERTY_SEEDS[Math.floor(index / P5_SECTION_MOVE_RUNS)];
    const number = (index % P5_SECTION_MOVE_RUNS) + 1;
    const labels = reached.get(trial.textPositionTarget) ?? [];
    labels.push(`seed ${String(seed)}, trial ${String(number)}`);
    reached.set(trial.textPositionTarget, labels);
  });
  const missing = TEXT_POSITION_SHAPES.filter((shape) => !reached.has(shape));
  expect(
    missing,
    `P-5's ${String(trials.length)} fixed-seed section moves never route ` +
      `into a text-position target parent of shape(s) ` +
      `${missing.join(", ")} (reached: ` +
      `${JSON.stringify(Object.fromEntries(reached))}) — TEST-SPEC §16 P-5: ` +
      `a single-line section holding prose is drawn into either a ` +
      `flow-position parent or a text-position one`,
  ).toEqual([]);
});

test("every fixed-seed P-5 section move's staged files and would-be texts pass S-9's per-draw check before any product exists, through P-5's own code path (TEST-SPEC §16 P-5, §17 S-9; E-5 replay at P-5's registered runs per seed)", async () => {
  // P-5's arm 2 as its registration runs it — the generator, the fixed seed
  // set (no `seeds`; `env: {}`, so no replay variable intervenes), the
  // registered runs per seed, and `drawSources: stagedSectionMoveSources` —
  // with a body that only counts: checkProperty judges each draw's sources
  // before the body runs on it, and a draw failing S-9 rejects the run as a
  // harness error naming its seed.
  const wouldBePerDraw: number[] = [];
  await checkProperty(
    "P-5 random section moves (S-9 per-draw replay, no product)",
    genSectionMoveTrial,
    (trial) => {
      wouldBePerDraw.push(
        stagedSectionMoveSources(trial).filter(
          ([, , label]) => label?.startsWith(P5_WOULD_BE_LABEL_PREFIX) === true,
        ).length,
      );
    },
    {
      runs: P5_SECTION_MOVE_RUNS,
      env: {},
      drawSources: stagedSectionMoveSources,
    },
  );
  expect(wouldBePerDraw).toHaveLength(
    DEFAULT_PROPERTY_SEEDS.length * P5_SECTION_MOVE_RUNS,
  );
  // Not vacuous: every draw's move rewrites at least one file, so each
  // draw yields a would-be text for the check to judge.
  const without = wouldBePerDraw.flatMap((count, index) =>
    count === 0
      ? [
          `seed ${String(
            DEFAULT_PROPERTY_SEEDS[Math.floor(index / P5_SECTION_MOVE_RUNS)],
          )}, trial ${String((index % P5_SECTION_MOVE_RUNS) + 1)}`,
        ]
      : [],
  );
  expect(
    without,
    `P-5 fixed-seed draws yielding no would-be text to S-9's per-draw ` +
      `check (stagedSectionMoveSources; SPEC 6.5's would-be forms, ` +
      `TEST-SPEC §16 P-5)`,
  ).toEqual([]);
});
