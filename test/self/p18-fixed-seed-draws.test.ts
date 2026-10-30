// P-18's fixed-seed draw guard (TEST-SPEC §16 P-18; §18 E-5; §0 H-10;
// §17 S-9). CI runs P-18 over the fixed seed set (E-5), so the
// configurations, mutants, and setups it stages are a pure function of its
// generator, the seed set, and its registered runs per seed
// (`P18_RUNS_PER_SEED`; P-18 passes no `seeds`). They are replayed here
// exactly as `checkProperty` draws them — `drawFixedSeedTrials`, one
// sequential PRNG stream per seed — with no property body and no package
// (H-8's ordering: the guard holds before any product exists). No
// certification serves the module channel, so nothing but this guard keeps
// a generator change from dropping a class P-18 searches silently; it pins,
// over those draws, each file classified by reading its rendered text back
// with the harness's TypeScript — the keys, names, comments, binding, and
// data as TypeScript reads them, and the mutant's violation as the
// harness's reading of the type-error class finds it — never by what the
// generator says it drew:
//
//   1. the spellings TEST-SPEC P-18 draws: string-literal and identifier
//      keys, a group name spelled each way, keys out of 7's order, each of
//      the global `Object` interface's members and `__proto__` as a group
//      name, non-identifier group names, an `Object` member or `__proto__`
//      as a profile's and as a rule's name, an aliased and an unaliased
//      binding, and line and block comments, inside the import declaration
//      and inside the argument;
//   2. the forms it draws: an empty glob list; a repeated element in each
//      set-read list (`targetTags`, `edgeKinds`, a rule's `kinds`, a
//      selector's `tags`); each optional key and field present and absent;
//      each selector form; and a kind given for a name of both kinds;
//   3. each member of 7.6's type-error class among the mutants, a violation
//      added at a field the draw omits among them, and each project kind,
//      covered extension, and option-set kind among the setups;
//   4. that every draw reads back valid under 7 with no violation of the
//      class, and its mutant with exactly the drawn one;
//   5. that every fixed-seed draw passes S-9's per-draw check before any
//      product exists, through P-18's own code path (`checkProperty` with
//      its `drawSources`) — P-18 itself stops at its first falsified draw,
//      so its later draws reach that check only here.
//
// Should the fixed seeds miss a class, raise `P18_RUNS_PER_SEED` or the
// class's weight; never weaken this.

import ts from "typescript-5.9.3";
import { expect, test } from "vitest";
import {
  CANONICAL_MODULE_NAMES,
  PROJECT_KINDS,
} from "../helpers/module-channel.js";
import { COVERED_EXTENSIONS } from "../helpers/module-channel-ts.js";
import {
  checkProperty,
  DEFAULT_PROPERTY_SEEDS,
  drawFixedSeedTrials,
} from "../helpers/property.js";
import type { P18Draw } from "../suite/registry/section-16-p18.js";
import {
  genP18Draw,
  isIdentifierName,
  P18_RUNS_PER_SEED,
  p18Setup,
  p18Texts,
  stagedP18Sources,
} from "../suite/registry/section-16-p18.js";
import {
  classViolations,
  isConfigList,
  isConfigObject,
  OBJECT_MEMBER_NAMES,
  problemsUnder7,
  readBack,
  scanComments,
} from "../suite/registry/section-7.6.js";
import type {
  ConfigObject,
  ConfigValue,
  ReadBack,
} from "../suite/registry/section-7.6.js";

/** 7's top-level keys, in its order. */
const TOP_LEVEL_ORDER = ["specs", "code", "markdown", "coverage", "policy"];

/** One file read back: its data, keys, comments, and where they stand. */
interface ReadFile {
  readonly read: ReadBack;
  readonly aliased: boolean;
  readonly commentsInImport: readonly string[];
  readonly commentsInArgument: readonly string[];
  readonly comments: readonly string[];
}

/** A replayed draw, labelled with its seed and 1-based trial number. */
interface Replayed {
  readonly label: string;
  readonly draw: P18Draw;
  readonly valid: ReadFile;
  readonly mutant: ReadFile;
}

/** `text` read back with the harness's TypeScript (section-7.6.ts). */
function readFile(text: string, label: string): ReadFile {
  const read = readBack(text, (detail) => {
    throw new Error(`${label}: the rendered file ${detail}`);
  });
  const [declaration, exported] = read.source.statements;
  if (
    declaration === undefined ||
    exported === undefined ||
    !ts.isImportDeclaration(declaration) ||
    !ts.isExportAssignment(exported) ||
    !ts.isCallExpression(exported.expression)
  ) {
    throw new Error(`${label}: no import and default export read back`);
  }
  const argument = exported.expression.arguments[0]!;
  const named = declaration.importClause?.namedBindings;
  const specifier =
    named !== undefined && ts.isNamedImports(named)
      ? named.elements[0]
      : undefined;
  const scanned = scanComments(text);
  const within = (node: ts.Node): string[] =>
    scanned
      .filter(
        (comment) =>
          comment.start > node.getStart(read.source) && comment.end <= node.end,
      )
      .map((comment) => comment.text);
  return {
    read,
    aliased: specifier?.propertyName !== undefined,
    commentsInImport: within(declaration),
    commentsInArgument: within(argument),
    comments: scanned.map((comment) => comment.text),
  };
}

const [NAME] = CANONICAL_MODULE_NAMES;

const REPLAYED: readonly Replayed[] = drawFixedSeedTrials(
  genP18Draw,
  P18_RUNS_PER_SEED,
).map((draw, index) => {
  const label =
    `seed ${String(DEFAULT_PROPERTY_SEEDS[Math.floor(index / P18_RUNS_PER_SEED)])} ` +
    `trial ${String((index % P18_RUNS_PER_SEED) + 1)}`;
  const texts = p18Texts(draw, NAME);
  return {
    label,
    draw,
    valid: readFile(texts.valid, `${label}, the draw`),
    mutant: readFile(texts.mutant, `${label}, its mutant`),
  };
});

/** The object at `key` of `object`, or an empty one. */
function objectAt(object: ConfigObject, key: string): ConfigObject {
  const value = object.get(key);
  return value !== undefined && isConfigObject(value) ? value : new Map();
}

/** The objects listed at `key` of `object`. */
function objectsAt(object: ConfigObject, key: string): ConfigObject[] {
  const value = object.get(key);
  return value !== undefined && isConfigList(value)
    ? value.filter((element) => isConfigObject(element))
    : [];
}

/** Every rule's two selectors. */
function selectorsOf(config: ConfigObject): ConfigObject[] {
  return objectsAt(config, "policy").flatMap((rule) =>
    ["from", "to"].map((end) => objectAt(rule, end)),
  );
}

/** Whether `value` is a list holding some element twice. */
function repeats(value: ConfigValue | undefined): boolean {
  if (value === undefined || !isConfigList(value)) return false;
  const strings = value.filter((element) => typeof element === "string");
  return new Set(strings).size < strings.length;
}

/** The group names of one kind. */
function groupsOf(config: ConfigObject, key: "specs" | "code"): string[] {
  return [...objectAt(config, key).keys()];
}

/** Whether `name` is both a spec and a code group's in `config`. */
function bothKinds(
  config: ConfigObject,
  name: ConfigValue | undefined,
): boolean {
  return (
    typeof name === "string" &&
    groupsOf(config, "specs").includes(name) &&
    groupsOf(config, "code").includes(name)
  );
}

/** Whether `path` names a value or key `config` holds. */
function holds(
  config: ConfigValue,
  path: readonly (string | number)[],
): boolean {
  let at: ConfigValue | undefined = config;
  for (const segment of path) {
    if (at === undefined) return false;
    if (typeof segment === "number") {
      at = isConfigList(at) ? at[segment] : undefined;
    } else {
      at = isConfigObject(at) ? at.get(segment) : undefined;
    }
  }
  return at !== undefined;
}

/** Each named class no draw reaches, with the draws reaching each. */
function unreached(
  classes: Readonly<Record<string, (replayed: Replayed) => boolean>>,
): { readonly missing: string[]; readonly reach: Record<string, number> } {
  const reach: Record<string, number> = {};
  for (const [name, matches] of Object.entries(classes)) {
    reach[name] = REPLAYED.filter(matches).length;
  }
  return {
    missing: Object.entries(reach)
      .filter(([, n]) => n === 0)
      .map(([name]) => name),
    reach,
  };
}

test("P-18's fixed-seed draws reach each spelling TEST-SPEC P-18 draws: string-literal and identifier keys, a group name spelled each way, keys out of 7's order, each Object member and __proto__ as a group name, non-identifier group names, an Object member or __proto__ as a profile's and a rule's name, an aliased and an unaliased binding, and line and block comments in the import declaration and in the argument", () => {
  const config = ({ valid }: Replayed): ConfigObject => valid.read.argument;
  const groupKeys = ({ valid }: Replayed) =>
    valid.read.keys.filter(
      (key) =>
        key.path.length === 1 &&
        (key.path[0] === "specs" || key.path[0] === "code"),
    );
  const classes: Record<string, (replayed: Replayed) => boolean> = {
    stringLiteralKey: ({ valid }) =>
      valid.read.keys.some((key) => key.stringLiteral),
    identifierKey: ({ valid }) =>
      valid.read.keys.some((key) => !key.stringLiteral),
    fixedKeyAsStringLiteral: ({ valid }) =>
      valid.read.keys.some((key) => key.path.length === 0 && key.stringLiteral),
    groupNameAsIdentifier: (replayed) =>
      groupKeys(replayed).some((key) => !key.stringLiteral),
    groupNameAsStringLiteral: (replayed) =>
      groupKeys(replayed).some(
        (key) => key.stringLiteral && isIdentifierName(key.key),
      ),
    topLevelKeysOutOfOrder: (replayed) => {
      const keys = [...config(replayed).keys()];
      const sorted = [...keys].sort(
        (a, b) => TOP_LEVEL_ORDER.indexOf(a) - TOP_LEVEL_ORDER.indexOf(b),
      );
      return keys.join() !== sorted.join();
    },
    nonIdentifierGroupName: (replayed) =>
      groupKeys(replayed).some((key) => !isIdentifierName(key.key)),
    nonAsciiGroupName: (replayed) =>
      groupKeys(replayed).some((key) => /[^ -~]/.test(key.key)),
    objectMemberProfileName: (replayed) =>
      objectsAt(config(replayed), "coverage").some((profile) =>
        OBJECT_MEMBER_NAMES.includes(String(profile.get("name"))),
      ),
    objectMemberRuleName: (replayed) =>
      objectsAt(config(replayed), "policy").some((rule) =>
        OBJECT_MEMBER_NAMES.includes(String(rule.get("name"))),
      ),
    aliased: ({ valid }) => valid.aliased,
    unaliased: ({ valid }) => !valid.aliased,
    aliasOtherThanDefineConfig: ({ valid }) =>
      valid.aliased && valid.read.binding !== "defineConfig",
    lineComment: ({ valid }) =>
      valid.comments.some((comment) => comment.startsWith("//")),
    blockComment: ({ valid }) =>
      valid.comments.some((comment) => comment.startsWith("/*")),
    commentInImportDeclaration: ({ valid }) =>
      valid.commentsInImport.length > 0,
    commentInArgument: ({ valid }) => valid.commentsInArgument.length > 0,
  };
  for (const member of OBJECT_MEMBER_NAMES) {
    classes[`group name ${member}`] = (replayed) =>
      groupKeys(replayed).some((key) => key.key === member);
  }
  const { missing, reach } = unreached(classes);
  expect(
    missing,
    `spellings P-18's fixed seeds never reach; reach: ${JSON.stringify(reach)}`,
  ).toEqual([]);
});

test("P-18's fixed-seed draws reach each form TEST-SPEC P-18 draws: an empty glob list, a repeated element in each set-read list, each optional key and field present and absent, each selector form, and a kind given for a name of both kinds", () => {
  const config = ({ valid }: Replayed): ConfigObject => valid.read.argument;
  const profiles = (replayed: Replayed) =>
    objectsAt(config(replayed), "coverage");
  const rules = (replayed: Replayed) => objectsAt(config(replayed), "policy");
  const selectors = (replayed: Replayed) => selectorsOf(config(replayed));
  const classes: Record<string, (replayed: Replayed) => boolean> = {
    emptyGlobList: (replayed) =>
      (["specs", "code"] as const).some((key) =>
        [...objectAt(config(replayed), key).values()].some(
          (globs) => isConfigList(globs) && globs.length === 0,
        ),
      ),
    repeatedTargetTags: (replayed) =>
      profiles(replayed).some((profile) => repeats(profile.get("targetTags"))),
    repeatedEdgeKinds: (replayed) =>
      profiles(replayed).some((profile) => repeats(profile.get("edgeKinds"))),
    repeatedRuleKinds: (replayed) =>
      rules(replayed).some((rule) => repeats(rule.get("kinds"))),
    repeatedSelectorTags: (replayed) =>
      selectors(replayed).some((selector) => repeats(selector.get("tags"))),
    profileBoundaryKindForBothKinds: (replayed) =>
      profiles(replayed).some(
        (profile) =>
          bothKinds(config(replayed), profile.get("boundary")) &&
          profile.has("boundaryKind"),
      ),
    selectorKindForBothKinds: (replayed) =>
      selectors(replayed).some(
        (selector) =>
          bothKinds(config(replayed), selector.get("group")) &&
          selector.has("kind"),
      ),
    selectorKindWhereUnambiguous: (replayed) =>
      selectors(replayed).some(
        (selector) =>
          selector.has("group") &&
          selector.has("kind") &&
          !bothKinds(config(replayed), selector.get("group")),
      ),
    selectorGroupWithoutKind: (replayed) =>
      selectors(replayed).some(
        (selector) => selector.has("group") && !selector.has("kind"),
      ),
    selectorFiles: (replayed) =>
      selectors(replayed).some((selector) => selector.has("files")),
    selectorTags: (replayed) =>
      selectors(replayed).some((selector) => selector.has("tags")),
    noSpecGroup: (replayed) => groupsOf(config(replayed), "specs").length === 0,
  };
  for (const key of ["code", "markdown", "coverage", "policy"]) {
    classes[`top-level ${key} present`] = (replayed) =>
      config(replayed).has(key);
    classes[`top-level ${key} absent`] = (replayed) =>
      !config(replayed).has(key);
  }
  classes["markdown outDir present"] = (replayed) =>
    objectAt(config(replayed), "markdown").has("outDir");
  classes["markdown outDir absent"] = (replayed) =>
    config(replayed).has("markdown") &&
    !objectAt(config(replayed), "markdown").has("outDir");
  for (const field of ["targetTags", "targets", "boundaryKind", "edgeKinds"]) {
    classes[`profile ${field} present`] = (replayed) =>
      profiles(replayed).some((profile) => profile.has(field));
    classes[`profile ${field} absent`] = (replayed) =>
      profiles(replayed).some((profile) => !profile.has(field));
  }
  classes["rule kinds present"] = (replayed) =>
    rules(replayed).some((rule) => rule.has("kinds"));
  classes["rule kinds absent"] = (replayed) =>
    rules(replayed).some((rule) => !rule.has("kinds"));
  const { missing, reach } = unreached(classes);
  expect(
    missing,
    `forms P-18's fixed seeds never reach; reach: ${JSON.stringify(reach)}`,
  ).toEqual([]);
});

test("P-18's fixed-seed mutants reach each member of 7.6's type-error class, one added at a field its draw omits among them, and its setups each project kind, covered extension, and option-set kind", () => {
  const found = ({ mutant }: Replayed) => classViolations(mutant.read.argument);
  const classes: Record<string, (replayed: Replayed) => boolean> = {
    addedAtAnOmittedField: (replayed) =>
      found(replayed).some(
        (violation) =>
          violation.category !== "unknown key" &&
          violation.category !== "missing required key" &&
          !holds(replayed.valid.read.argument, violation.path),
      ),
  };
  for (const category of [
    "unknown key",
    "missing required key",
    "kind",
    "enumeration",
    "selector form",
    "empty list",
  ]) {
    classes[`violation ${category}`] = (replayed) =>
      found(replayed).some((violation) => violation.category === category);
  }
  for (const project of PROJECT_KINDS) {
    classes[`project ${project}`] = ({ draw }) =>
      p18Setup(draw).project === project;
  }
  for (const extension of COVERED_EXTENSIONS) {
    classes[`extension ${extension}`] = ({ draw }) =>
      p18Setup(draw).extension === extension;
  }
  for (const kind of ["strict defaults", "initialized-project options"]) {
    classes[`option set ${kind}`] = ({ draw }) =>
      p18Setup(draw).optionSet.kind === kind;
  }
  const { missing, reach } = unreached(classes);
  expect(
    missing,
    `violations and setups P-18's fixed seeds never reach; reach: ${JSON.stringify(reach)}`,
  ).toEqual([]);
});

test("every fixed-seed P-18 draw reads back valid under 7 with no violation of 7.6's type-error class, and its mutant with exactly the one drawn", () => {
  const deviations: string[] = [];
  for (const { label, draw, valid, mutant } of REPLAYED) {
    const problems = problemsUnder7(valid.read.argument);
    const inDraw = classViolations(valid.read.argument);
    const inMutant = classViolations(mutant.read.argument);
    if (problems.length > 0) {
      deviations.push(`${label}: the draw is invalid: ${problems.join("; ")}`);
    }
    if (inDraw.length > 0) {
      deviations.push(`${label}: the draw holds ${JSON.stringify(inDraw)}`);
    }
    if (
      JSON.stringify(inMutant) !== JSON.stringify([draw.mutation.violation])
    ) {
      deviations.push(
        `${label}: the mutant holds ${JSON.stringify(inMutant)}, not ` +
          JSON.stringify([draw.mutation.violation]),
      );
    }
  }
  expect(deviations).toEqual([]);
});

test("every fixed-seed P-18 draw passes S-9's per-draw check before any product exists, through P-18's own code path (TEST-SPEC §16 P-18, §17 S-9; E-5 replay at P-18's registered runs per seed)", async () => {
  // P-18 as its registration runs it — the generator, the fixed seed set
  // (no `seeds`; `env: {}`, so no replay variable intervenes), the
  // registered runs per seed, and `drawSources: stagedP18Sources` — with a
  // body that only records: checkProperty judges each draw's four files
  // (the draw and its mutant beside each candidate N) before the body runs
  // on it, and a draw failing S-9 rejects the run as a harness error
  // naming its seed.
  const labels: string[] = [];
  await checkProperty(
    "P-18 type contract over generated configurations (S-9 per-draw replay, no product)",
    genP18Draw,
    (draw) => {
      labels.push(draw.mutation.label);
    },
    { runs: P18_RUNS_PER_SEED, env: {}, drawSources: stagedP18Sources },
  );
  expect(labels).toEqual(REPLAYED.map(({ draw }) => draw.mutation.label));
  for (const { draw } of REPLAYED) {
    const sources = stagedP18Sources(draw);
    expect(sources.map(([path]) => path)).toEqual(
      Array.from(
        { length: 4 },
        () => `covered-file${p18Setup(draw).extension}`,
      ),
    );
    for (const [index, name] of CANONICAL_MODULE_NAMES.entries()) {
      expect(String(sources[index * 2]?.[1])).toContain(`"${name}"`);
    }
  }
});
