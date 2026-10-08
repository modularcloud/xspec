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

import { expect, test } from "vitest";
import {
  DEFAULT_PROPERTY_SEEDS,
  drawFixedSeedTrials,
} from "../helpers/property.js";
import {
  genSectionMoveTrial,
  P5_SECTION_MOVE_RUNS,
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
