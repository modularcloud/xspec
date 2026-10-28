// P-16's fixed-seed draw guard (TEST-SPEC §16 P-16; §18 E-5; §0 H-10). CI
// runs P-16 over a fixed seed set (E-5), so the histories it stages are a
// pure function of its generator (`genP16Trial`), the seed set, and its
// registered runs per seed (`P16_RUNS`; P-16 passes no `seeds`). They are
// replayed here exactly as `checkProperty` draws them —
// `drawFixedSeedTrials`, one sequential PRNG stream per seed — with no
// property body and no product (H-8's ordering: the guard holds before any
// product exists), each trial's items predicted by the path-blocks oracle
// from the generator's own model (`predictP16Trial`).
//
// P-16's entry enumerates what 10.5 pins combinatorially — visiting and
// skipping, roots visited as N (T10.5-8), node links (a deleted node under
// its baseline parent through the journal, a present node under its current
// parent, also where a section move has given it a new one; T10.5-9), each
// kind's scope, context, and origin (T10.5-3), impact edges of both kinds
// (T10.5-7), blocking chains (T10.5-2), and the total order (T10.5-4) — over
// workspaces holding root-sourced embeddings and code locations bearing
// markers and `text(...)` calls, changed by every kind of step its entry
// lists. The first test requires the fixed-seed draws to reach each of them,
// so that a generator change — P-16's own, or the PROP-03 model generator's
// it draws through, which moves every stream after it — cannot drop one
// silently; should one be missed, re-weight the generator
// (test/suite/registry/section-16-p16.ts) and re-measure, never weaken this.
//
// Every fixed-seed draw must also pass S-9's per-draw check (TEST-SPEC §16
// preamble, §17 S-9) before any product exists, through the very code path
// P-16 takes: `checkProperty` over its generator at the fixed seed set and
// the registered runs, with P-16's own `drawSources` (`stagedP16Sources`) —
// every source each draw stages, the baseline's and each step's, and the
// would-be texts of each section move, composed by P-5's own builder — each
// judged before the body runs. P-16 itself stops at its first falsified
// trial, so its later draws reach the check only here.

import { expect, test } from "vitest";
import {
  checkProperty,
  DEFAULT_PROPERTY_SEEDS,
  drawFixedSeedTrials,
} from "../helpers/property.js";
import { PATH_BLOCKS_ITEM_KINDS } from "../helpers/oracles/path-blocks.js";
import type { P16Step } from "../suite/registry/section-16-p16.js";
import {
  genP16Trial,
  P16_RUNS,
  P16_WOULD_BE_LABEL,
  predictP16Trial,
  stagedP16Sources,
} from "../suite/registry/section-16-p16.js";

/** Every step kind P-16's interleaving draws (its module header). */
const STEP_KINDS: readonly P16Step["kind"][] = [
  "specEdit",
  "codeEdit",
  "addSpecFile",
  "deleteSpecFile",
  "deleteSection",
  "rename",
  "moveFile",
  "moveSection",
];

/** Each node's parent on one side of the oracle's input. */
function parentsOf(
  side: ReadonlyMap<string, { readonly children: readonly string[] }>,
): Map<string, string> {
  const parents = new Map<string, string>();
  for (const [identity, node] of side) {
    for (const child of node.children) parents.set(child, identity);
  }
  return parents;
}

test("P-16's own fixed-seed draws reach every step kind and every shape its TEST-SPEC entry lists (TEST-SPEC §16 P-16; E-5 replay at P-16's registered runs per seed)", () => {
  const trials = drawFixedSeedTrials(genP16Trial, P16_RUNS);
  expect(trials).toHaveLength(DEFAULT_PROPERTY_SEEDS.length * P16_RUNS);
  const reached = new Map<string, string[]>();
  const note = (shape: string, where: string): void => {
    const list = reached.get(shape) ?? [];
    list.push(where);
    reached.set(shape, list);
  };
  trials.forEach((trial, index) => {
    const where =
      `seed ${String(DEFAULT_PROPERTY_SEEDS[Math.floor(index / P16_RUNS)])}, ` +
      `trial ${String((index % P16_RUNS) + 1)}`;
    for (const step of trial.steps) {
      note(`the step kind ${step.kind}`, where);
      if (step.kind === "moveSection" && step.toFile === null) {
        note("a section move creating its target file", where);
      }
    }
    for (const file of trial.initial.code) {
      for (const ref of [...file.top, ...file.units.flatMap((u) => u.refs)]) {
        note(`a baseline code reference of the kind ${ref.kind}`, where);
      }
    }
    const { prediction, input, journalMapped } = predictP16Trial(trial);
    for (const side of [input.before, input.after]) {
      for (const [identity, node] of side) {
        if (!identity.includes("#") && node.edgeTargets.length > 0) {
          note("a root sourcing an embedding", where);
        }
      }
    }
    const before = parentsOf(input.before);
    for (const [child, parent] of parentsOf(input.after)) {
      const was = before.get(child);
      if (was !== undefined && was !== parent) {
        note(
          "a present node under a current parent not its baseline one",
          where,
        );
      }
    }
    for (const item of prediction.items) {
      note(`an item of the kind ${item.kind}`, where);
      if (item.kind === "subtree-coherence") {
        if (!item.scope.includes("#") && input.before.has(item.scope)) {
          note("a root present at the baseline visited as N", where);
        }
        if (item.origin.length > 1) {
          note("a changed node skipped below a visited one", where);
        }
      }
      if (
        item.kind === "parent-consistency" &&
        item.blockedBy.some((key) => key.startsWith("parent-consistency "))
      ) {
        note("a parent-consistency item blocked by another", where);
      }
      if (!item.scopePresent) {
        note(
          item.kind === "code-impact"
            ? "a code-impact item scoped at an absent location"
            : "a requirement item scoped at a deleted node",
          where,
        );
      }
      for (const node of item.scopeSet) {
        if (prediction.absent.has(node) && journalMapped.has(node)) {
          note(
            "a deleted node in a scope, presented under its baseline " +
              "identity mapped forward through the journal",
            where,
          );
        }
      }
    }
  });
  const required = [
    ...STEP_KINDS.map((kind) => `the step kind ${kind}`),
    "a section move creating its target file",
    "a present node under a current parent not its baseline one",
    ...PATH_BLOCKS_ITEM_KINDS.map((kind) => `an item of the kind ${kind}`),
    "a root present at the baseline visited as N",
    "a changed node skipped below a visited one",
    "a parent-consistency item blocked by another",
    "a requirement item scoped at a deleted node",
    "a code-impact item scoped at an absent location",
    "a deleted node in a scope, presented under its baseline identity mapped forward through the journal",
    "a root sourcing an embedding",
    "a baseline code reference of the kind marker",
    "a baseline code reference of the kind text",
  ];
  const missing = required.filter((shape) => !reached.has(shape));
  expect(
    missing,
    `P-16's ${String(trials.length)} fixed-seed trials never reach: ` +
      `${missing.join("; ")} — TEST-SPEC §16 P-16 lists each; re-weight its ` +
      `generator and re-measure, never weaken this guard (reached: ` +
      `${JSON.stringify(Object.fromEntries(reached))})`,
  ).toEqual([]);
});

test("every fixed-seed P-16 draw's staged sources and would-be texts pass S-9's per-draw check before any product exists, through P-16's own code path (TEST-SPEC §16 P-16, §17 S-9; E-5 replay at P-16's registered runs per seed)", async () => {
  // P-16 as its registration runs it — the generator, the fixed seed set (no
  // `seeds`; `env: {}`, so no replay variable intervenes), the registered
  // runs per seed, and `drawSources: stagedP16Sources` — with a body that
  // only counts: checkProperty judges each draw's sources before the body
  // runs on it, and a draw failing S-9 rejects the run as a harness error
  // naming its seed.
  const sourcesPerDraw: number[] = [];
  const wouldBePerDraw: number[] = [];
  await checkProperty(
    "P-16 path-blocks generation (S-9 per-draw replay, no product)",
    genP16Trial,
    (trial) => {
      const sources = stagedP16Sources(trial);
      sourcesPerDraw.push(sources.length);
      wouldBePerDraw.push(
        sources.filter(
          ([, , label]) => label?.includes(P16_WOULD_BE_LABEL) === true,
        ).length,
      );
    },
    { runs: P16_RUNS, env: {}, drawSources: stagedP16Sources },
  );
  expect(sourcesPerDraw).toHaveLength(DEFAULT_PROPERTY_SEEDS.length * P16_RUNS);
  // Not vacuous: every draw stages sources, and the section moves drawn
  // yield would-be texts for the check to judge.
  expect(sourcesPerDraw.every((count) => count > 0)).toBe(true);
  expect(wouldBePerDraw.reduce((sum, count) => sum + count, 0)).toBeGreaterThan(
    0,
  );
});
