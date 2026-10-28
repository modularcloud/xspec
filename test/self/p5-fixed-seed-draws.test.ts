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
//
// And a refused shape drawn must surface as exactly that: a harness error
// carrying its seed, raised before the body runs on the draw — never a
// falsified property (a product failure), never a draw to skip (TEST-SPEC
// §16 preamble and P-5, §17 S-9). The generator draws none, so the last
// tests hand checkProperty, through P-5's own `drawSources`, one trial each
// built from a fixed-seed arm-2 draw (never from product output) with its
// layout replaced: each one-sided inline spelling SPEC 6.2 and 6.5 refuse
// (T6.5-16(a) and (b)), whose staged files all derive, so only the moved
// text's would-be landing reveals it; and a flow-opening moved text routed
// into a text-position target parent (T6.5-16(c)), which buildSectionMove's
// guard refuses as a staging defect.

import { expect, test } from "vitest";
import { HarnessAssertionError } from "../helpers/assertions.js";
import { deriveMdx } from "../helpers/mdx-derivability.js";
import { HarnessStagingError } from "../helpers/permissions.js";
import {
  checkProperty,
  DEFAULT_PROPERTY_SEEDS,
  drawFixedSeedTrials,
  PROPERTY_SEED_ENV,
} from "../helpers/property.js";
import type { BodyItem, SectionItem } from "../suite/registry/section-16-p4.js";
import {
  FLOW_LAYOUT,
  genSectionMoveTrial,
  LEAD_INSIDE,
  LEAD_OUTSIDE,
  P5_SECTION_MOVE_RUNS,
  P5_WOULD_BE_LABEL_PREFIX,
  stagedSectionMoveSources,
  TAB_RESIDUE,
  TAIL_INSIDE,
  TAIL_OUTSIDE,
  TEXT_POSITION_SHAPES,
  WS_RESIDUE,
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

// ---------------------------------------------------------------------------
// A refused shape drawn (TEST-SPEC §16 preamble and P-5, §17 S-9).

/** Await a rejection and return the thrown value (fails if it resolves). */
async function captureRejection(promise: Promise<void>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("expected the checkProperty call to reject, but it resolved");
}

type SectionMoveTrial = ReturnType<typeof genSectionMoveTrial>;
type MovedLayout = SectionMoveTrial["layout"];

/** A fixed-seed arm-2 draw, with the seed and trial number that drew it. */
interface FixedSeedDraw {
  readonly trial: SectionMoveTrial;
  readonly seed: number;
  readonly number: number;
}

/**
 * The first of P-5's fixed-seed arm-2 draws (replay order: the fixed seeds,
 * P-5's registered runs per seed) that `qualifies`. None qualifying is a
 * harness defect, thrown as one: a generator change moved every such draw
 * away, so the refused-shape tests need another base draw — never a weaker
 * check.
 */
function firstFixedSeedDraw(
  wanted: string,
  qualifies: (trial: SectionMoveTrial) => boolean,
): FixedSeedDraw {
  const trials = drawFixedSeedTrials(genSectionMoveTrial, P5_SECTION_MOVE_RUNS);
  const index = trials.findIndex(qualifies);
  if (index === -1) {
    throw new Error(
      `harness defect: none of P-5's ${String(trials.length)} fixed-seed ` +
        `arm-2 draws ${wanted}, so the refused-shape test has no base ` +
        `draw — choose another qualifying draw, never weaken the test`,
    );
  }
  return {
    trial: trials[index],
    seed: DEFAULT_PROPERTY_SEEDS[Math.floor(index / P5_SECTION_MOVE_RUNS)],
    number: (index % P5_SECTION_MOVE_RUNS) + 1,
  };
}

/** The base draw, as assertion messages name it. */
function drawName(base: FixedSeedDraw): string {
  return `based on seed ${String(base.seed)}'s trial ${String(base.number)}`;
}

/**
 * Run P-5's arm 2 over one refused trial as P-5 runs it — its own
 * `drawSources`, `env: {}` — at its base draw's seed, one run, with a body
 * that records any call. The run must reject with a harness error carrying
 * that seed and the replay variable from S-9's per-draw check (TEST-SPEC
 * §16 preamble: never a product failure, never a draw to skip), never a
 * diagnosed failure (`HarnessAssertionError`, which a falsified property's
 * error is), the body never running on the draw; the rejection is returned
 * for its cause.
 */
async function rejectedRefusedDraw(
  base: FixedSeedDraw,
  refused: SectionMoveTrial,
): Promise<Error> {
  let bodyRuns = 0;
  const thrown = await captureRejection(
    checkProperty(
      "P-5 random section moves (a refused shape drawn, no product)",
      () => refused,
      () => {
        bodyRuns += 1;
      },
      {
        runs: 1,
        seeds: [base.seed],
        env: {},
        drawSources: stagedSectionMoveSources,
      },
    ),
  );
  expect(bodyRuns, `the body ran on the refused draw ${drawName(base)}`).toBe(
    0,
  );
  expect(thrown).toBeInstanceOf(Error);
  expect(thrown).not.toBeInstanceOf(HarnessAssertionError);
  const error = thrown as Error;
  expect(error.message).toContain("harness error while checking trial 1 of 1");
  expect(error.message).toContain("S-9");
  expect(error.message).toContain(`seed ${String(base.seed)}`);
  expect(error.message).toContain(`${PROPERTY_SEED_ENV}=${String(base.seed)}`);
  return error;
}

/** The moved section's body items, located by its dotted ID (model space). */
function movedBody(trial: SectionMoveTrial): readonly BodyItem[] {
  let items: readonly BodyItem[] = trial.model.files[trial.fromFile].items;
  for (const seg of trial.dotted.split(".")) {
    const section = items.find(
      (item): item is SectionItem =>
        item.kind === "section" && item.seg === seg,
    );
    if (section === undefined) {
      throw new Error(
        `harness defect: no section ${trial.dotted} in model file ` +
          `${String(trial.fromFile)} to move`,
      );
    }
    items = section.items;
  }
  return items;
}

/** The staged path of the file the moved text lands in (`specs/<name>.mdx`). */
function destinationPath(trial: SectionMoveTrial): string {
  const { toFile } = trial.target;
  const basename =
    toFile === null ? trial.createdBasename : trial.basenames[toFile];
  if (basename === null) {
    throw new Error("harness defect: a created target without a basename");
  }
  return `specs/${basename}.mdx`;
}

/**
 * The one-sided inline spellings SPEC 6.2 and 6.5 refuse and the generator
 * never draws (module header of test/suite/registry/section-16-p5-p6.ts,
 * "arm-2 boundary staging"; T6.5-16(b)'s two arms and (a)): the opening
 * tag's remainder and the closing tag's lead disagree in kind, so the moved
 * text, landing at a line start, opens and closes in different positions
 * and does not derive (SPEC 6.5, 14.20). Each keeps T6.5-16's origin —
 * parent prose immediately before the opening tag and after the closing tag
 * (`LEAD_OUTSIDE`, `TAIL_OUTSIDE`), which keep the element in-line there —
 * so every file the draw stages derives. The draws' own decoration bytes.
 */
const ONE_SIDED_INLINE_LAYOUTS: readonly (readonly [string, MovedLayout])[] = [
  [
    "a whitespace remainder and a prose lead",
    {
      form: "inline",
      leadOutside: LEAD_OUTSIDE,
      leadInside: WS_RESIDUE,
      tailInside: TAIL_INSIDE,
      tailOutside: TAIL_OUTSIDE,
      closeJoined: false,
    },
  ],
  [
    "a prose remainder and a whitespace lead",
    {
      form: "inline",
      leadOutside: LEAD_OUTSIDE,
      leadInside: LEAD_INSIDE,
      tailInside: TAB_RESIDUE,
      tailOutside: TAIL_OUTSIDE,
      closeJoined: false,
    },
  ],
  [
    "a whitespace remainder and its closing tag joined to the last body line",
    {
      form: "inline",
      leadOutside: LEAD_OUTSIDE,
      leadInside: TAB_RESIDUE,
      tailInside: null,
      tailOutside: TAIL_OUTSIDE,
      closeJoined: true,
    },
  ],
];

for (const [spelling, layout] of ONE_SIDED_INLINE_LAYOUTS) {
  test(`a refused shape drawn — an inline moved text with ${spelling} — is a harness error carrying its seed from S-9's per-draw check of the move's would-be texts, the body never running on it (TEST-SPEC §16 preamble and P-5, §17 S-9; T6.5-16)`, async () => {
    // Seed 271828183's trial 4 at this writing: a top-level section of one
    // prose line moved to a created target — a childless plain-prose
    // section, the one shape every inline spelling renders (module header).
    const base = firstFixedSeedDraw(
      "moves a section with body lines in the inline form",
      (trial) => trial.layout.form === "inline" && movedBody(trial).length > 0,
    );
    const refused: SectionMoveTrial = { ...base.trial, layout };
    // The premise: every file the draw stages derives (T6.5-16's origin),
    // so only a would-be text — the moved text as it lands — reveals the
    // refused shape.
    for (const [path, contents, label] of stagedSectionMoveSources(refused)) {
      if (label !== undefined) continue;
      expect(
        deriveMdx(contents).derives,
        `${path} as staged, ${drawName(base)}`,
      ).toBe(true);
    }
    const error = await rejectedRefusedDraw(base, refused);
    expect(error.cause).toBeInstanceOf(HarnessStagingError);
    const cause = error.cause as HarnessStagingError;
    expect(cause.mode).toBe("mdx-derivability");
    // The destination's would-be text, by its label: where the moved text
    // lands at a line start (SPEC 6.5).
    expect(
      cause.path.startsWith(
        `${destinationPath(refused)} (${P5_WOULD_BE_LABEL_PREFIX}`,
      ),
      `${cause.path}, ${drawName(base)}`,
    ).toBe(true);
    expect(error.message).toContain(cause.path);
  });
}

test("a refused shape drawn — a flow-opening moved text routed into a text-position target parent — is a harness error carrying its seed from buildSectionMove's guard in S-9's per-draw check, the body never running on it (TEST-SPEC §16 preamble and P-5, §17 S-9; T6.5-16(c))", async () => {
  // Seed 271828183's trial 5 at this writing (a `laterLine` parent); the
  // moved section's collapse gives way to the flow form, its tags alone on
  // their lines, which closes no text-position tag (T6.5-16(c)).
  const base = firstFixedSeedDraw(
    "routes its moved text into a text-position target parent",
    (trial) => trial.textPositionTarget !== null,
  );
  const error = await rejectedRefusedDraw(base, {
    ...base.trial,
    layout: FLOW_LAYOUT,
  });
  // The staging defect buildSectionMove's guard names before any file is
  // judged: no derivability verdict.
  expect(error.cause).toBeInstanceOf(Error);
  expect(error.cause).not.toBeInstanceOf(HarnessStagingError);
  const cause = error.cause as Error;
  expect(cause.message).toContain("P-5 harness defect");
  expect(cause.message).toContain(
    `${String(base.trial.textPositionTarget)} text-position target parent`,
  );
});
