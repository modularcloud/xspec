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
//
// A third guard pins how P-8 decides which output contract a drawn form is
// held to: JSON output is in effect, and the never-a-partial-JSON-document
// clause applies, exactly when SPEC 12.0 puts it in effect — a `--json`
// token read as a flag, or a JSON-only surface (10.7, 11, 12.6) with or
// without one (H-5) — and every JSON-only surface the menu holds has a form
// without `--json`, so the by-surface half of the rule is exercised, not
// only the flag half (the sweep guard above then has it drawn).
//
// A fourth pins how P-8 runs the review forms that name a session or an
// item (SPEC 10.7): each as a composite (`armSteps`) over a session its arm
// creates first, a JSON read of the session yielding the item an item form
// names — so a drawn `show`, `split`, or `resolve` can reach a session's
// items rather than only ever meeting the no-session usage error — with
// every slot filled before a step runs.
//
// A fifth pins the rest of the sweep's shape: every command runs with JSON
// output in effect at least once (12.0: every command supports `--json`) —
// `build` in the fixed arm — and the mutating commands run performed and
// previewed (6.4–6.6): `rename` and the file form of `move` previewed with
// and without `--json`, and the section form, out of a base section into a
// target file the base holds and into one it lacks (6.5 creates it),
// performed and previewed, each with and without `--json` — never with
// `--test-hold`, a usage error beside `--preview` (6.6).

import { Buffer } from "node:buffer";
import { expect, test } from "vitest";
import {
  DEFAULT_PROPERTY_SEEDS,
  drawFixedSeedTrials,
} from "../helpers/property.js";
import {
  armSteps,
  COMMAND_MENU,
  FIXED_BUILD_ARM,
  FUZZ_BASE_FILES,
  genFuzzTrial,
  ITEM_ID_SLOT,
  jsonOutputInEffect,
  P8_RUNS_PER_SEED,
  sectionTowerSource,
  SESSION_SLOT,
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

test("P-8 holds a form to the JSON contract exactly when SPEC 12.0 puts JSON output in effect, and every JSON-only surface its menu holds has a form without --json (TEST-SPEC §16 P-8, H-5; guard vectors)", () => {
  const vectors: ReadonlyArray<readonly [readonly string[], boolean]> = [
    // JSON-only surfaces (SPEC 10.7, 11, 12.6), with or without `--json`.
    [["version"], true],
    [["version", "--json"], true],
    [["inventory"], true],
    [["query", "nodes"], true],
    [["occurrences", "--file", "specs/B.mdx"], true],
    [["view", "specs/A.mdx", "--text"], true],
    [["at", "specs/A.mdx", "0"], true],
    [["review", "export", "r1"], true],
    // Flags stand anywhere: the surface is the first non-flag token left
    // once flags and their values are removed (12.0's grammar).
    [["--config", "xspec.config.ts", "view"], true],
    [["--name", "view", "review", "list"], false],
    // Every other surface: `--json` read as a flag, and only so.
    [["check"], false],
    [["ids", "--tree"], false],
    [["review", "list"], false],
    [["review", "next", "r1"], false],
    // A preview is no JSON-only surface (6.6).
    [["rename", "specs/A.mdx", "c", "c2", "--preview"], false],
    [["move", "specs/A.mdx#c", "specs/C.mdx#e", "--preview", "--json"], true],
    [["check", "--json"], true],
    [["--json", "check"], true],
    [["check", "--json", "--json"], true],
    [["check", "--file", "--json"], false],
    [["check", "--", "--json"], false],
  ];
  expect(
    vectors
      .filter(([argv, expected]) => jsonOutputInEffect(argv) !== expected)
      .map(
        ([argv, expected]) =>
          `${argv.join(" ")} (expected ${String(expected)})`,
      ),
    "P-8's reading of when JSON output is in effect (SPEC 12.0)",
  ).toEqual([]);

  // Per JSON-only surface the menu holds: whether a form without `--json`
  // is among its forms. Menu forms lead with the command word.
  const bareForm = new Map<string, boolean>();
  for (const argv of COMMAND_MENU) {
    const withoutJson = argv.filter((token) => token !== "--json");
    if (!jsonOutputInEffect(withoutJson)) continue;
    const surface =
      argv[0] === "review" ? argv.slice(0, 2).join(" ") : (argv[0] ?? "");
    bareForm.set(
      surface,
      (bareForm.get(surface) ?? false) || withoutJson.length === argv.length,
    );
  }
  expect([...bareForm.keys()]).toEqual(
    expect.arrayContaining([
      "at",
      "inventory",
      "occurrences",
      "query",
      "review export",
      "version",
      "view",
    ]),
  );
  expect(
    [...bareForm].filter(([, bare]) => !bare).map(([surface]) => surface),
    "every JSON-only surface P-8's menu holds needs a form without --json, " +
      "so the by-surface half of SPEC 12.0's rule is exercised",
  ).toEqual([]);
});

test("P-8 runs every review form naming a session or an item as a composite over a session it creates first, a JSON read of it yielding the item (TEST-SPEC §16 P-8; SPEC 10.7, 12.0; guard vectors)", () => {
  const create = [
    "review",
    "create",
    "--strategy",
    "audit",
    "--name",
    "r1",
    "--json",
  ];
  // A static form is its own one step.
  expect(armSteps(["check", "--json"])).toEqual([
    { argv: ["check", "--json"] },
  ]);
  // A session form: the create, then the form naming the session.
  expect(armSteps(["review", "export", SESSION_SLOT])).toEqual([
    { argv: create },
    { argv: ["review", "export", "r1"] },
  ]);
  // An item form: the create, the read yielding the item (`status` for
  // `split`, `next` otherwise), then the form, its item slot left for the
  // read's item.
  expect(armSteps(["review", "show", SESSION_SLOT, ITEM_ID_SLOT])).toEqual([
    { argv: create },
    { argv: ["review", "next", "r1", "--json"], yieldsItem: "next" },
    { argv: ["review", "show", "r1", ITEM_ID_SLOT] },
  ]);
  expect(
    armSteps(["review", "split", SESSION_SLOT, ITEM_ID_SLOT, "--json"]),
  ).toEqual([
    { argv: create },
    { argv: ["review", "status", "r1", "--json"], yieldsItem: "status" },
    { argv: ["review", "split", "r1", ITEM_ID_SLOT, "--json"] },
  ]);

  // Over the menu: the composites are exactly the review subcommands that
  // name a session (10.7's `status`, `show`, `split`, `resolve`, `export`),
  // the item ones exactly `show`, `split`, and `resolve`, each with and
  // without `--json` (12.0); no session slot reaches a step, the item slot
  // only a composite's last step, after a JSON read that yields it.
  const sessionForms = COMMAND_MENU.filter((form) =>
    form.includes(SESSION_SLOT),
  );
  const subcommands = (forms: ReadonlyArray<readonly string[]>): string[] =>
    [...new Set(forms.map((form) => form[1] ?? ""))].sort();
  expect(subcommands(sessionForms)).toEqual([
    "export",
    "resolve",
    "show",
    "split",
    "status",
  ]);
  expect(
    subcommands(sessionForms.filter((form) => form.includes(ITEM_ID_SLOT))),
  ).toEqual(["resolve", "show", "split"]);
  for (const subcommand of subcommands(sessionForms)) {
    const forms = sessionForms.filter((form) => form[1] === subcommand);
    expect(
      forms.map((form) => form.includes("--json")).sort(),
      `review ${subcommand}: one form with --json, one without`,
    ).toEqual([false, true]);
  }
  const misplaced: string[] = [];
  for (const form of COMMAND_MENU) {
    const steps = armSteps(form);
    steps.forEach((step, index) => {
      const read = steps[index - 1];
      const itemSlotPlaced =
        index === steps.length - 1 &&
        read?.yieldsItem !== undefined &&
        jsonOutputInEffect(read.argv);
      if (
        step.argv.includes(SESSION_SLOT) ||
        (step.argv.includes(ITEM_ID_SLOT) && !itemSlotPlaced)
      ) {
        misplaced.push(`${form.join(" ")}: step ${String(index + 1)}`);
      }
    });
  }
  expect(misplaced, "slots left where no read fills them").toEqual([]);
});

test("P-8 runs every command with JSON output in effect, and rename and move performed and previewed — the section form into a target file the base holds and one it lacks — each preview and section form with and without --json (TEST-SPEC §16 P-8; SPEC 6.4–6.6, 12.0; guard vectors)", () => {
  // Every command — `review` and `query` per subcommand — runs at least
  // once with JSON output in effect (12.0: every command supports
  // `--json`); `build`'s run is the fixed arm, the menu holding its bare
  // form.
  const runs = [FIXED_BUILD_ARM, ...COMMAND_MENU];
  const surface = (argv: readonly string[]): string =>
    argv[0] === "review" || argv[0] === "query"
      ? argv.slice(0, 2).join(" ")
      : (argv[0] ?? "");
  const underJson = new Set(
    runs.filter((argv) => jsonOutputInEffect(argv)).map(surface),
  );
  expect(
    [...new Set(runs.map(surface))].filter((name) => !underJson.has(name)),
    "commands P-8 never runs with JSON output in effect",
  ).toEqual([]);

  // The mutating commands' forms (6.4–6.6), each classified by its operands
  // as 12.0 reads them: a `#`-bearing target operand makes a move the
  // section form (6.5), whose target file the base workspace holds or lacks.
  const baseFiles = new Map(FUZZ_BASE_FILES);
  const sectionOrigins: string[] = [];
  const variants = COMMAND_MENU.filter(
    (form) => form[0] === "rename" || form[0] === "move",
  ).map((form) => {
    const [command = "", origin = "", target = ""] = form.filter(
      (token) => !token.startsWith("--"),
    );
    const section = command === "move" && target.includes("#");
    const variant = [
      command === "rename" ? "rename" : `move ${section ? "section" : "file"}`,
      form.includes("--preview") ? "preview" : "performed",
      form.includes("--json") ? "json" : "human",
    ];
    if (section) {
      sectionOrigins.push(origin);
      const targetFile = target.slice(0, target.indexOf("#"));
      variant.push(
        baseFiles.has(targetFile) ? "held target" : "created target",
      );
    }
    return variant.join(", ");
  });
  const sectionVariants = ["held target", "created target"].flatMap((target) =>
    ["performed", "preview"].flatMap((mode) =>
      ["json", "human"].map(
        (output) => `move section, ${mode}, ${output}, ${target}`,
      ),
    ),
  );
  expect(variants).toEqual(
    expect.arrayContaining([
      "rename, performed, json",
      "rename, preview, json",
      "rename, preview, human",
      "move file, performed, json",
      "move file, preview, json",
      "move file, preview, human",
      ...sectionVariants,
    ]),
  );
  // Each section form moves a section the base workspace spells.
  for (const origin of sectionOrigins) {
    const [file = "", id = ""] = origin.split("#");
    expect(baseFiles.get(file) ?? "", `${origin}: a base section`).toContain(
      `<S id="${id}"`,
    );
  }
  expect(
    COMMAND_MENU.filter((form) => form.includes("--test-hold")),
    "--test-hold beside --preview is a usage error (6.6), and P-8 drives no seam",
  ).toEqual([]);
});
