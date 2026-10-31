// P-17's fixed-seed draw guard (TEST-SPEC §16 P-17; §18 E-5; §0 H-10;
// §17 S-9). CI runs P-17 over the fixed seed set (E-5), so the names and
// placements it stages are a pure function of its generator, the seed set,
// and its registered runs per seed (`P17_RUNS_PER_SEED`; P-17 passes no
// `seeds`). They are replayed here exactly as `checkProperty` draws them —
// `drawFixedSeedTrials`, one sequential PRNG stream per seed — with no
// property body, no package, and no release run (H-8's ordering: the guard
// holds before any product exists). No certification serves the module
// channel, so nothing but this guard keeps a generator change from dropping
// a class P-17 searches silently; it pins, over those draws, each name
// classified by a scanner of its own over N's characters — never by what
// the generator says it drew:
//
//   1. the classes TEST-SPEC P-17 weights the names toward: a `.` in the
//      last segment (S then differing from N), an extension TypeScript and
//      Node.js read in a specifier after it, a scoped name and an unscoped
//      one, a digit-first segment, and a name of 7.6's bound of 214
//      characters;
//   2. the placements and setups each name is crossed with: both placement
//      forms, every holding directory (the importing files' own and each of
//      its three ancestors up to the staging root), each project kind, each
//      covered extension, both option-set kinds, each release E-1 lists,
//      and each of Node.js's four routes;
//   3. that every drawn N is a name of 7.6's grammar outside its
//      exclusions — no `@types` name, no `@typescript/lib-` name, none of
//      the built-in names the generator mends — and that those names cover
//      every name of the grammar this harness's own Node.js resolves to a
//      built-in module (the drawn release itself confirms each draw, as
//      P-17 places N on its runtime arm);
//   4. that every fixed-seed draw passes S-9's per-draw check before any
//      product exists, through P-17's own code path (`checkProperty` with
//      its `drawSources`), each draw's three files named with its setup's
//      extension — P-17 itself stops at its first falsified draw, so its
//      later draws reach that check only here.
//
// Should the fixed seeds miss a class, raise `P17_RUNS_PER_SEED` or the
// class's weight; never weaken this.

import { builtinModules } from "node:module";
import { expect, test } from "vitest";
import {
  MODULE_NAME_MAX_LENGTH,
  moduleNameExclusion,
  moduleNameGrammarProblem,
  PROJECT_KINDS,
} from "../helpers/module-channel.js";
import {
  COVERED_EXTENSIONS,
  COVERED_SETUPS,
} from "../helpers/module-channel-ts.js";
import { MODULE_ROUTES } from "../helpers/module-channel-node.js";
import {
  checkProperty,
  DEFAULT_PROPERTY_SEEDS,
  drawFixedSeedTrials,
} from "../helpers/property.js";
import type { P17Draw } from "../suite/registry/section-16-p17.js";
import {
  genP17Draw,
  P17_EXTENSION_SUFFIXES,
  P17_IMPORTING_DEPTH,
  P17_NODE_BUILT_IN_NAMES,
  P17_RELEASE_VERSIONS,
  P17_RUNS_PER_SEED,
  p17Setup,
  stagedP17Sources,
} from "../suite/registry/section-16-p17.js";

const DIGITS = "0123456789";

/** One replayed draw, labelled with its seed and 1-based trial number. */
interface Replayed {
  readonly label: string;
  readonly draw: P17Draw;
}

const REPLAYED: readonly Replayed[] = drawFixedSeedTrials(
  genP17Draw,
  P17_RUNS_PER_SEED,
).map((draw, index) => ({
  label:
    `seed ${String(DEFAULT_PROPERTY_SEEDS[Math.floor(index / P17_RUNS_PER_SEED)])} ` +
    `trial ${String((index % P17_RUNS_PER_SEED) + 1)}`,
  draw,
}));

/** N's segments, as the scanner reads them: its scope, then its name. */
function segmentsOf(name: string): readonly string[] {
  if (!name.startsWith("@")) return [name];
  const slash = name.indexOf("/");
  return [name.slice(1, slash), name.slice(slash + 1)];
}

/** N's last segment. */
function lastSegmentOf(name: string): string {
  const segments = segmentsOf(name);
  return segments[segments.length - 1] ?? "";
}

/** S (SPEC 7.6 Reach): N cut before the first `.` of its last segment. */
function cutAtLastSegmentDot(name: string): string {
  const slash = name.lastIndexOf("/");
  const dot = name.indexOf(".", slash + 1);
  return dot < 0 ? name : name.slice(0, dot);
}

/** The labels of the draws `matches` accepts. */
function drawsWhere(matches: (draw: P17Draw) => boolean): string[] {
  return REPLAYED.filter(({ draw }) => matches(draw)).map(({ label }) => label);
}

/** Each named class no draw reaches, with the draws reaching the others. */
function unreached(
  classes: Readonly<Record<string, (draw: P17Draw) => boolean>>,
): { readonly missing: string[]; readonly reach: Record<string, number> } {
  const reach: Record<string, number> = {};
  for (const [name, matches] of Object.entries(classes)) {
    reach[name] = drawsWhere(matches).length;
  }
  return {
    missing: Object.entries(reach)
      .filter(([, n]) => n === 0)
      .map(([name]) => name),
    reach,
  };
}

test("P-17's fixed-seed draws reach each class TEST-SPEC P-17 weights its names toward: a dotted last segment (S differing from N), an extension-like suffix after it, a scoped and an unscoped name, a digit-first segment, and a 214-character name", () => {
  const { missing, reach } = unreached({
    dottedLastSegment: (draw) =>
      lastSegmentOf(draw.name).includes(".") &&
      cutAtLastSegmentDot(draw.name) !== draw.name,
    undottedLastSegment: (draw) => !lastSegmentOf(draw.name).includes("."),
    extensionLikeSuffix: (draw) =>
      P17_EXTENSION_SUFFIXES.some((suffix) =>
        lastSegmentOf(draw.name).endsWith(`.${suffix}`),
      ),
    scoped: (draw) => draw.name.startsWith("@"),
    unscoped: (draw) => !draw.name.startsWith("@"),
    digitFirstSegment: (draw) =>
      segmentsOf(draw.name).some((segment) => DIGITS.includes(segment[0]!)),
    digitFirstScope: (draw) =>
      draw.name.startsWith("@") &&
      DIGITS.includes(segmentsOf(draw.name)[0]![0]!),
    boundUnscoped: (draw) =>
      !draw.name.startsWith("@") && draw.name.length === MODULE_NAME_MAX_LENGTH,
    boundScoped: (draw) =>
      draw.name.startsWith("@") && draw.name.length === MODULE_NAME_MAX_LENGTH,
  });
  expect(
    missing,
    `name classes P-17's fixed seeds never reach; reach: ${JSON.stringify(reach)}`,
  ).toEqual([]);
});

test("P-17's fixed-seed draws cross the names with both placement forms, every holding directory, each project kind, covered extension, and option-set kind, each release E-1 lists, and each of Node.js's four routes", () => {
  const classes: Record<string, (draw: P17Draw) => boolean> = {
    copy: (draw) => draw.form === "copy",
    symlink: (draw) => draw.form === "symlink",
  };
  for (let level = 0; level <= P17_IMPORTING_DEPTH; level += 1) {
    classes[`holding ${String(level)} levels up`] = (draw) =>
      draw.holdingLevel === level;
  }
  for (const project of PROJECT_KINDS) {
    classes[`project ${project}`] = (draw) =>
      p17Setup(draw).project === project;
  }
  for (const extension of COVERED_EXTENSIONS) {
    classes[`extension ${extension}`] = (draw) =>
      p17Setup(draw).extension === extension;
  }
  for (const kind of ["strict defaults", "initialized-project options"]) {
    classes[`option set ${kind}`] = (draw) =>
      p17Setup(draw).optionSet.kind === kind;
  }
  for (const release of P17_RELEASE_VERSIONS) {
    classes[`release ${release}`] = (draw) => draw.release === release;
  }
  for (const route of MODULE_ROUTES) {
    classes[`route ${route}`] = (draw) => draw.route === route;
  }
  const { missing, reach } = unreached(classes);
  expect(
    missing,
    `placements and setups P-17's fixed seeds never reach; reach: ${JSON.stringify(reach)}`,
  ).toEqual([]);
  expect(P17_RELEASE_VERSIONS.length).toBeGreaterThan(0);
  expect(
    REPLAYED.every(({ draw }) => COVERED_SETUPS[draw.setup] !== undefined),
  ).toBe(true);
});

test("every name P-17 draws at the fixed seeds is a name of 7.6's grammar outside its exclusions — no @types name, no @typescript/lib- name, none of the built-in names it mends — and those names cover every name of the grammar this harness's Node.js resolves to a built-in module", () => {
  const violations: string[] = [];
  for (const { label, draw } of REPLAYED) {
    const shown = `${label}: ${JSON.stringify(draw.name)}`;
    const problem =
      moduleNameGrammarProblem(draw.name) ?? moduleNameExclusion(draw.name);
    if (problem !== null) violations.push(`${shown} ${problem}`);
    if (P17_NODE_BUILT_IN_NAMES.includes(draw.name)) {
      violations.push(`${shown} is a built-in name`);
    }
    if (draw.name.length > MODULE_NAME_MAX_LENGTH) {
      violations.push(`${shown} is past 7.6's bound`);
    }
  }
  expect(violations).toEqual([]);
  const ownBuiltIns = builtinModules.filter(
    (name) => moduleNameGrammarProblem(name) === null,
  );
  expect(ownBuiltIns.length).toBeGreaterThan(0);
  expect(
    ownBuiltIns.filter((name) => !P17_NODE_BUILT_IN_NAMES.includes(name)),
    "built-in names of 7.6's grammar the generator would draw",
  ).toEqual([]);
});

test("every fixed-seed P-17 draw passes S-9's per-draw check before any product exists, through P-17's own code path (TEST-SPEC §16 P-17, §17 S-9; E-5 replay at P-17's registered runs per seed)", async () => {
  // P-17 as its registration runs it — the generator, the fixed seed set
  // (no `seeds`; `env: {}`, so no replay variable intervenes), the
  // registered runs per seed, and `drawSources: stagedP17Sources` — with a
  // body that only records: checkProperty judges each draw's three files
  // before the body runs on it, and a draw failing S-9 rejects the run as a
  // harness error naming its seed.
  const names: string[] = [];
  await checkProperty(
    "P-17 installation names (S-9 per-draw replay, no product)",
    genP17Draw,
    (draw) => {
      names.push(draw.name);
    },
    { runs: P17_RUNS_PER_SEED, env: {}, drawSources: stagedP17Sources },
  );
  expect(names).toEqual(REPLAYED.map(({ draw }) => draw.name));
  for (const { draw } of REPLAYED) {
    const sources = stagedP17Sources(draw);
    expect(sources.map(([path]) => path)).toEqual(
      Array.from(
        { length: 3 },
        () => `covered-file${p17Setup(draw).extension}`,
      ),
    );
    for (const [, text] of sources) {
      expect(String(text)).toContain(`from ${JSON.stringify(draw.name)}`);
    }
  }
});
