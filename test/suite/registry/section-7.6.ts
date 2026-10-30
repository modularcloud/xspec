// TEST-SPEC §7.6 (the `defineConfig` module): T7.6-1, declared exports;
// T7.6-2, valid configurations; and T7.6-3, shape violations. T7.6-4, the
// placements, T7.6-5, Reach's open cases, and T7.6-6 and T7.6-7, the
// runtime's exports and identity and its absence of effects, are
// section-7.6-ii.ts's — T7.6-4 and T7.6-5 staging the files
// `placementFiles` composes here, the canonical runs' own beside any N;
// P-17, installation names, is section-16-p17.ts's, its draws staging those
// files beside each drawn N; P-18 is not registered yet.
//
// 7.6 is tested through H-2's module channel alone (TEST-SPEC §7.6's four
// rules: Placement, Covered setups, Verdict, Pairing). A body here never
// invokes the `xspec` executable: it places the product's package directory,
// the binding's `packageDir`, in a fresh staging under the canonical
// placement (helpers/module-channel.ts) and type-checks covered files there
// with the harness's TypeScript 5.9.3 in every covered setup
// (helpers/module-channel-ts.ts). With no package directory given, the body
// fails diagnosed before anything is staged (H-8: the module channel counts
// as part of the product).
//
// T7.6-1 (SPEC 7.6 Type contract: exports): in every covered setup, the
// module TypeScript resolves the covered file's import to declares exactly
// one export, `defineConfig`, carrying a value meaning and neither a type
// nor a namespace meaning, and no other export, type-only or not. The
// exports are read from the TypeScript driver's export listing
// (helpers/module-channel-ts.ts, `listExports`): TypeScript's own
// resolution of the file's import in that setup's program — the compiler's
// listing of the module's exports, an implicit export of a declaration
// module holding neither `export {}` nor `export =` among them, and, where
// the module declares an export assignment, the members of the assigned
// value that a named import binds — each with its meanings, never probed
// by names the harness chooses. TypeScript's synthetic default is never in
// that listing, so a default import TypeScript admits only through its
// interoperation with CommonJS fails nothing; a declared default export
// (`default`) is listed, and fails.
//
// Conservative operationalizations (noted per H-4):
// - The covered file is T7.6-2(d)'s, the minimal configuration: any
//   covered file's import reads the same module in a setup, and (d)'s
//   records are named for both tests. T7.6-1 asserts the listing alone;
//   whether the file type-checks is T7.6-2's assertion.
// - One staging per project kind, the file written under each covered
//   extension beside the canonical placement, nothing else installed, and
//   judged in each covered setup of its project, a program of its own each,
//   with its listing: each setup is read through its own resolution, so a
//   package serving different declaration files to `import` and to
//   `require`, or to different resolution modes, is read through each.
// - A listing naming no module — TypeScript resolving the import to no
//   module it reads declarations from, as beside S-7's stub package —
//   fails as a module declaring no `defineConfig`. A value meaning reached
//   only through `export type`, `import type`, or `export type *`, which no
//   import may use as a value, is no value meaning.
// - The body stops at the first setup whose listing deviates, failing
//   once, diagnosed, with every deviation, the listing whole, and
//   TypeScript's errors for the program as a diagnostic aid
//   (`assertDeclaredExports`, which T7.6-4's placements and P-17's draws
//   reuse); where every setup holds, it confirms that it judged all
//   173.
//
// T7.6-2 (SPEC 7.6 Covered files, Type contract: valid configurations): each
// of these covered files, valid under 7, type-checks in every covered setup
// — 173 programs per file — under the canonical placement:
// - (a) every key and field 7 defines, every value 7 enumerates at each of
//   its positions: `specs` and `code` with two groups each (`tests` a spec
//   and a code group's name, so a kind is required with it); `markdown` with
//   `emit` true and `outDir`; two profiles carrying all eight profile fields,
//   between them both `targets`, both `boundaryKind`s, and both `mode`s;
//   three rules, of both `type`s, each carrying `kinds`, their selectors in
//   all three forms, the group form without `kind` and with each kind; each
//   dependency edge kind in each profile's `edgeKinds` and rule's `kinds`;
// - (b) (a) with `defineConfig` imported under an alias and every key a
//   string literal;
// - (c) (a) with a line and a block comment before the import, between keys,
//   inside lists, and after the export;
// - (d) the minimal configuration, `specs` holding no group;
// - (e) the seven members of TypeScript's global `Object` interface and
//   `__proto__`, each a spec and a code group's name — identifier keys in
//   one file, string-literal keys in another — each a profile's `target` and
//   another's `boundary` (with its `boundaryKind`, each name being both
//   kinds'), each a rule's `from` group and another's `to` group (with its
//   kind), and each the name of a profile and of a rule;
// - (f) the empty, omitted, and repeated forms: `code: {}`, `coverage: []`,
//   `policy: []`, and `markdown: { emit: false }` beside a `specs` group; a
//   file like (a)'s with every optional field omitted, its group names
//   unambiguous; and (a) with one spec group's and one code group's glob
//   list empty and an element repeated in every set-read list (each
//   `targetTags`, `edgeKinds`, rule's `kinds`, and selector's `tags`).
// The group, profile, and rule names of (e) are never requirement paths, so
// the accepted residual on `Object`-member path segments is not reached.
//
// Conservative operationalizations (noted per H-4):
// - Each configuration is data — a map per object literal, never a harness
//   object literal, since a `__proto__` key would set a JavaScript literal's
//   prototype — rendered by one renderer in 7's declarative form, the style
//   of SPEC 7's example (double quotes, no semicolons, no trailing commas),
//   every object on lines of its own. Before any product exists, module-load
//   self-checks hold each file to what TEST-SPEC names: valid under 7 (the
//   harness's own reading of 7, 7.3, 7.4, and 7.5 over the data: keys,
//   kinds, enumerations, cross-references, required kinds, non-empty
//   set-read lists, names, and globs inside the root); each arm's own
//   content, as listed above; and 7.6's covered-file conditions, read back
//   from the rendered text with the harness's TypeScript — exactly an import
//   of `defineConfig` by that identifier, with no `type` or `defer` modifier
//   and no attributes, bound to `defineConfig` or (b)'s alias, never
//   `require`, `exports`, or a reserved word; a specifier spelling exactly N
//   in double quotes; a default export of one call to that binding whose one
//   argument reads back equal to the data; no backslash anywhere in the
//   file; and no comment carrying `@` or beginning `///`, so that none is a
//   directive or pragma. A deviation is a harness defect, thrown at module
//   load.
// - N is the canonical name (helpers/module-channel.ts
//   `canonicalModuleName`): one of two fixed candidates, whichever differs
//   from the name the package's manifest gives. Each file is rendered for
//   each candidate at module load.
// - S-9: every rendered file is a staged-source record (helpers/staged-ts.ts
//   `stagedTs`) — one per file and candidate N, judged as plain TypeScript,
//   for the `.ts`, `.mts`, and `.cts` names, beside a TSX record of the same
//   bytes for the `.tsx` name — which test/self/s9-staged-sources.test.ts
//   judges well-formed before any product exists. The body stages exactly
//   the bytes of the records for the placement's N.
// - One staging per project kind — the ES-module project, the CommonJS one
//   with a `package.json`, and the one with none — each the project
//   directory beside its canonical placement, nothing else installed (Reach
//   verified for each written file, `alone`). Every file is written under
//   each covered extension and judged in each covered setup of its project,
//   all the files of a setup in one program where that batch is sound
//   (the driver's header argues the sharing).
// - The body stops at the first setup where any file fails to type-check,
//   failing once, diagnosed, with every failing file of that setup and
//   TypeScript's errors for each: against a package that resolves nothing —
//   S-7's stub package — the body ends at its first setup, keeping the
//   sweep short. A harness error propagates at once. Where every setup
//   passes, the body confirms that it judged all 173.
//
// T7.6-3 (SPEC 7.6 Type contract: shape violations; TEST-SPEC §7.6
// Pairing): in every covered setup, each of these files — T7.6-2(a)'s file
// with violations of 7.6's type-error class applied, that file its valid
// twin — fails to type-check, paired with the twin type-checking in the
// same setup and placement. The arms are edits of (a)'s data, at every
// position of (a)'s file, each a file of its own holding one violation:
// - an unknown key (`extra`) appended to each fixed-key object: the top
//   level, `markdown`, each profile, each rule, and each selector;
// - each required key removed from each object requiring it: `specs`,
//   `markdown`'s `emit`, each profile's `name`, `target`, `boundary`, and
//   `mode`, and each rule's `name`, `type`, `from`, and `to`;
// - at every value of (a)'s file, each kind among a boolean, a string, a
//   list, and an object that 7 does not admit there, from the kind table
//   (`T763_KIND_TABLE`: one row per position as T7.6-3 lists it, its values
//   spelled out, TEST-SPEC's `specs: ["a/*.mdx"]`, `emit: "true"`,
//   `targetTags: "a"`, and `from: "src/*.ts"` among them, the boolean both
//   `true` and `false` where 7 admits a list or an object), and TEST-SPEC's
//   `kinds: [true]` beside them;
// - at every enumerated value, two near misses of it — capitalized, and cut
//   by its last letter, so `"Direct"` and `"depend"` among them — and, at
//   each element of an `edgeKinds` and of a rule's `kinds`, `"contains"`;
// - at each selector, each selector-form violation — each two of `group`,
//   `files`, and `tags`, all three, none (`{}`), and `kind` beside `files`,
//   beside `tags`, and alone — the selector replaced whole, its names
//   resolving;
// - each list 7.4 and 7.5 forbid empty, emptied;
// - and one file holding seven of these at once, a violation of each member
//   of the class among them.
// No arm stages a configuration error outside the class for a verdict: each
// arm is (a) with its edits alone, and the errors outside the class an edit
// entails (the profiles' `target` naming no spec group once `specs` is gone)
// carry no type-level requirement either way (SPEC 7.6).
//
// Conservative operationalizations (noted per H-4):
// - "Every position" is read over (a)'s file: every value it holds — each
//   group, glob, profile, rule, selector, field, and list element — rather
//   than one value per kind of position; the categories TEST-SPEC names in
//   the singular (an unknown key "in a profile", a profile's missing `name`,
//   "a selector's `kind`") are staged at each instance alike. 430 arms.
// - Module-load self-checks (`checkT763Arms`) hold the tables to T7.6-3's
//   list — 7's shape (`CONFIG_SHAPE`) names exactly its positions, each
//   instantiated in (a)'s file; each row of the kind table holds one value
//   of each kind 7 does not admit there; the enumerated positions, the
//   required keys, the fixed-key objects, the forbidden empty lists, and
//   the eight selector-form violations are those it lists; TEST-SPEC's own
//   spellings are staged — and each arm to its edits: the harness's own
//   reading of the type-error class over the data (`classViolations`) finds
//   in each arm exactly the violations its edits make, and none in the
//   twin. Each rendering reads back with the harness's TypeScript as its
//   data, with no backslash and no comment, its keys identifiers as the
//   twin's are, so no arm carries beside its violation an error every
//   `defineConfig` type meets (a repeated key, a syntax error): the
//   composition residual CERTIFICATIONS.md's exclusions name.
// - S-9: each arm's rendering is a staged-source record per candidate N,
//   as plain TypeScript and as TSX, as T7.6-2's are; the twin's records are
//   T7.6-2(a)'s, named for both tests.
// - The body stages, per project kind, the twin alone beside the canonical
//   placement, and judges it first in each setup: where it does not
//   type-check, no arm counts there (Pairing), and the body fails at once,
//   diagnosed — in the project's first setup before the arms are staged,
//   so S-7's stub package costs the sweep one program. Once the twin has
//   type-checked, the arms are staged in the same directory and judged in
//   one program per setup where that batch is sound (the driver's header),
//   each paired with the twin through `assertShapeViolation`. The body
//   stops at the first setup where any arm does not fail to type-check,
//   failing once, naming every such arm and spelling out the first three;
//   where every setup holds, it confirms that it judged all 173.

import ts from "typescript-5.9.3";
import { fail, HarnessAssertionError } from "../../helpers/assertions.js";
import {
  CANONICAL_MODULE_NAMES,
  moduleNameGrammarProblem,
  ModuleStaging,
  PROJECT_KINDS,
  TYPE_CHECKING_ARM,
} from "../../helpers/module-channel.js";
import {
  assertShapeViolation,
  assertTypeChecks,
  COVERED_SETUP_COUNT,
  describeErrors,
  describeExportListing,
  describeListedExport,
  stageCoveredFiles,
} from "../../helpers/module-channel-ts.js";
import type {
  CoveredFiles,
  CoveredVerdict,
  ExportListing,
} from "../../helpers/module-channel-ts.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { stagedTs } from "../../helpers/staged-ts.js";
import type { StagedTs } from "../../helpers/staged-ts.js";
import type { ProductBinding } from "../../helpers/subprocess.js";

const LF = String.fromCodePoint(0x0a);
const BACKSLASH = String.fromCodePoint(0x5c);
const REPLACEMENT_CHARACTER = String.fromCodePoint(0xfffd);

// ---------------------------------------------------------------------------
// Configurations as data, and their rendering
// ---------------------------------------------------------------------------

/** A value of 7's declarative form: a string, a boolean, a list, an object. */
export type ConfigValue = string | boolean | ConfigList | ConfigObject;

/** An array literal of 7's declarative form. */
export type ConfigList = readonly ConfigValue[];

/**
 * An object literal of 7's declarative form, its keys in spelling order: a
 * map, never a harness object literal, whose `__proto__` key would set the
 * literal's prototype (module header).
 */
export type ConfigObject = ReadonlyMap<string, ConfigValue>;

/** Whether `value` is a list. */
export function isConfigList(value: ConfigValue): value is ConfigList {
  return Array.isArray(value);
}

/** Whether `value` is an object. */
export function isConfigObject(value: ConfigValue): value is ConfigObject {
  return value instanceof Map;
}

/** An object from its entries, in order; a repeated key is a harness defect. */
export function configObject(
  ...entries: readonly (readonly [string, ConfigValue])[]
): ConfigObject {
  const object = new Map<string, ConfigValue>();
  for (const [key, value] of entries) {
    if (object.has(key)) {
      throw new Error(
        `TEST-SPEC §7.6: the key ${JSON.stringify(key)} is repeated in one ` +
          "object of a staged configuration (SPEC 7: a key repeated within " +
          "one object literal is a configuration error, outside 7.6's " +
          "type-error class): a harness defect",
      );
    }
    object.set(key, value);
  }
  return object;
}

/** How a rendered file spells its keys. */
export type KeySpelling =
  "identifiers" | "string literals" | "group names as string literals";

/** How a configuration is rendered as a covered file. */
export interface ConfigRendering {
  /** The import's specifier: N, spelled exactly, in double quotes. */
  readonly specifier: string;
  /** The binding `defineConfig` is imported under: itself or an alias. */
  readonly binding: string;
  readonly keys: KeySpelling;
  /**
   * T7.6-2(c)'s comments: a line and a block comment before the import,
   * between keys, inside lists, and after the export.
   */
  readonly comments: boolean;
}

/** The comments (c) carries: plain words, no `@`, none beginning `///`. */
const COMMENTS = {
  lineBeforeImport: "// A line comment before the import.",
  blockBeforeImport: "/* A block comment before the import. */",
  lineBetweenKeys: "// A line comment between keys.",
  blockBetweenKeys: "/* A block comment between keys. */",
  blockInList: "/* A block comment inside a list. */",
  lineInList: "// A line comment inside a list.",
  lineAfterExport: "// A line comment after the export.",
  blockAfterExport: "/* A block comment after the export. */",
} as const;

const INDENT = "  ";

/** A key spelled as an identifier: ASCII, never needing an escape. */
const IDENTIFIER_KEY = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** Whether a key at `path` names a group: a key of `specs` or `code`. */
function isGroupNameKey(path: readonly string[]): boolean {
  return path.length === 1 && (path[0] === "specs" || path[0] === "code");
}

/** A key as the rendering spells it at `path`. */
function spellKey(
  key: string,
  path: readonly string[],
  rendering: ConfigRendering,
): string {
  const stringLiteral =
    rendering.keys === "string literals" ||
    (rendering.keys === "group names as string literals" &&
      isGroupNameKey(path));
  if (stringLiteral) return JSON.stringify(key);
  if (!IDENTIFIER_KEY.test(key)) {
    throw new Error(
      `TEST-SPEC §7.6: the key ${JSON.stringify(key)} cannot be spelled as ` +
        "an identifier with ASCII characters alone: a harness defect",
    );
  }
  return key;
}

/** A value rendered at `depth`, its object keys at `path`. */
function renderValue(
  value: ConfigValue,
  path: readonly string[],
  depth: number,
  rendering: ConfigRendering,
): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  const inner = INDENT.repeat(depth + 1);
  const outer = INDENT.repeat(depth);
  if (isConfigList(value)) {
    if (value.length === 0) return "[]";
    const scalars = value.every((element) => typeof element !== "object");
    if (scalars && !rendering.comments) {
      return `[${value
        .map((element) => renderValue(element, path, depth, rendering))
        .join(", ")}]`;
    }
    const rows = value.map(
      (element, index) =>
        `${inner}${renderValue(element, path, depth + 1, rendering)}` +
        (index < value.length - 1 ? "," : ""),
    );
    if (rendering.comments) {
      rows.unshift(`${inner}${COMMENTS.blockInList}`);
      rows.push(`${inner}${COMMENTS.lineInList}`);
    }
    return `[${LF}${rows.join(LF)}${LF}${outer}]`;
  }
  if (value.size === 0) return "{}";
  const rows: string[] = [];
  let index = 0;
  for (const [key, member] of value) {
    if (index > 0 && rendering.comments) {
      rows.push(
        `${inner}${index % 2 === 1 ? COMMENTS.lineBetweenKeys : COMMENTS.blockBetweenKeys}`,
      );
    }
    rows.push(
      `${inner}${spellKey(key, path, rendering)}: ` +
        renderValue(member, [...path, key], depth + 1, rendering) +
        (index < value.size - 1 ? "," : ""),
    );
    index += 1;
  }
  return `{${LF}${rows.join(LF)}${LF}${outer}}`;
}

/**
 * A configuration rendered as a covered file (module header): the import of
 * `defineConfig` from the specifier, then the default export of one call to
 * the binding, its one argument the configuration; LF line ends, the last
 * line terminated.
 */
export function renderConfiguration(
  config: ConfigObject,
  rendering: ConfigRendering,
): string {
  const lines: string[] = [];
  if (rendering.comments) {
    lines.push(COMMENTS.lineBeforeImport, COMMENTS.blockBeforeImport);
  }
  const imported =
    rendering.binding === "defineConfig"
      ? "defineConfig"
      : `defineConfig as ${rendering.binding}`;
  lines.push(
    `import { ${imported} } from ${JSON.stringify(rendering.specifier)}`,
    "",
    `export default ${rendering.binding}(${renderValue(config, [], 0, rendering)})`,
  );
  if (rendering.comments) {
    lines.push(COMMENTS.lineAfterExport, COMMENTS.blockAfterExport);
  }
  return lines.join(LF) + LF;
}

// ---------------------------------------------------------------------------
// Reading a rendered file back: the covered-file conditions (SPEC 7.6)
// ---------------------------------------------------------------------------

/**
 * Names no binding of a covered file takes: the reserved words of strict
 * module code, `eval` and `arguments`, and the two names TypeScript
 * reserves in a file it compiles as CommonJS (SPEC 7.6 Covered files).
 */
const BARRED_BINDINGS: ReadonlySet<string> = new Set([
  "arguments",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "eval",
  "export",
  "exports",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "interface",
  "let",
  "new",
  "null",
  "package",
  "private",
  "protected",
  "public",
  "require",
  "return",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
]);

/** One key of a read-back file: where it stands and how it is spelled. */
interface SpelledKey {
  /** The keys of the objects enclosing it, outermost first. */
  readonly path: readonly string[];
  readonly key: string;
  readonly stringLiteral: boolean;
}

/** A covered file read back with the harness's TypeScript. */
interface ReadBack {
  /** The specifier's value, and its spelling with its quotes. */
  readonly specifier: string;
  readonly specifierSpelling: string;
  /** The name `defineConfig` is bound to. */
  readonly binding: string;
  /** The default export's one argument. */
  readonly argument: ConfigObject;
  readonly keys: readonly SpelledKey[];
  /** The parsed file, for the comment positions (c) is held to. */
  readonly source: ts.SourceFile;
}

/** T7.6-2's premise for each of its files, which a deviation breaks. */
const T762_PREMISE =
  "each of T7.6-2's files is valid under 7 and a covered file (TEST-SPEC " +
  "T7.6-2; SPEC 7, 7.6 Covered files)";

/** A thrower naming the test, the file, and the premise a deviation breaks. */
function deviation(
  test: string,
  what: string,
  premise: string,
): (detail: string) => never {
  return (detail) => {
    throw new Error(
      `${test}: the staged covered file ${what} ${detail} — ${premise}: a ` +
        "harness defect",
    );
  };
}

/** A value of 7's declarative form read from its expression. */
function readValue(
  node: ts.Expression,
  path: readonly string[],
  keys: SpelledKey[],
  problem: (detail: string) => never,
): ConfigValue {
  if (ts.isStringLiteral(node)) return node.text;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.map((element) => {
      if (ts.isSpreadElement(element) || ts.isOmittedExpression(element)) {
        return problem("holds a spread or an elision in a list");
      }
      return readValue(element, path, keys, problem);
    });
  }
  if (ts.isObjectLiteralExpression(node)) {
    const object = new Map<string, ConfigValue>();
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property)) {
        return problem("holds an object member that is no key and value");
      }
      const name = property.name;
      if (!ts.isIdentifier(name) && !ts.isStringLiteral(name)) {
        return problem("holds a key that is no identifier or string literal");
      }
      const key = name.text;
      if (object.has(key)) {
        return problem(`repeats the key ${JSON.stringify(key)} in one object`);
      }
      keys.push({ path, key, stringLiteral: ts.isStringLiteral(name) });
      object.set(
        key,
        readValue(property.initializer, [...path, key], keys, problem),
      );
    }
    return object;
  }
  return problem(
    `holds an expression outside 7's declarative form ` +
      `(${ts.SyntaxKind[node.kind]})`,
  );
}

/**
 * Read a rendered file back (module header): exactly an import of
 * `defineConfig` by that identifier — no `type` or `defer` modifier, no
 * attributes, one named binding, never `require`, `exports`, or a reserved
 * word — from a string-literal specifier, then a default export of one call
 * to that binding whose one argument is an object literal of 7's form; a
 * deviation goes to `problem`.
 */
function readBack(text: string, problem: (detail: string) => never): ReadBack {
  const source = ts.createSourceFile(
    "covered-file.ts",
    text,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TS,
  );
  const [first, second, ...rest] = source.statements;
  if (
    first === undefined ||
    second === undefined ||
    rest.length > 0 ||
    !ts.isImportDeclaration(first) ||
    !ts.isExportAssignment(second)
  ) {
    return problem("is not exactly an import and a default export");
  }
  const clause = first.importClause;
  const named = clause?.namedBindings;
  if (
    clause === undefined ||
    clause.phaseModifier !== undefined ||
    clause.name !== undefined ||
    named === undefined ||
    !ts.isNamedImports(named) ||
    named.elements.length !== 1 ||
    first.attributes !== undefined
  ) {
    return problem(
      "does not import exactly one named binding with no type or defer " +
        "modifier and no import attributes",
    );
  }
  const element = named.elements[0]!;
  const imported = element.propertyName ?? element.name;
  if (
    element.isTypeOnly ||
    !ts.isIdentifier(imported) ||
    imported.text !== "defineConfig"
  ) {
    return problem("does not import defineConfig by that identifier");
  }
  const binding = element.name.text;
  if (BARRED_BINDINGS.has(binding)) {
    return problem(
      `binds defineConfig to ${JSON.stringify(binding)}, a name strict ` +
        "module code or a CommonJS file reserves",
    );
  }
  if (!ts.isStringLiteral(first.moduleSpecifier)) {
    return problem("has a specifier that is no string literal");
  }
  const call = second.expression;
  if (
    second.isExportEquals === true ||
    !ts.isCallExpression(call) ||
    !ts.isIdentifier(call.expression) ||
    call.expression.text !== binding ||
    call.questionDotToken !== undefined ||
    call.typeArguments !== undefined ||
    call.arguments.length !== 1 ||
    !ts.isObjectLiteralExpression(call.arguments[0]!)
  ) {
    return problem(
      "does not default-export one call to the binding with one object " +
        "literal as its argument",
    );
  }
  const keys: SpelledKey[] = [];
  const argument = readValue(call.arguments[0]!, [], keys, problem);
  if (!isConfigObject(argument)) {
    return problem("has an argument that reads as no object");
  }
  return {
    specifier: first.moduleSpecifier.text,
    specifierSpelling: first.moduleSpecifier.getText(source),
    binding,
    argument,
    keys,
    source,
  };
}

/** One comment of a file, as TypeScript's scanner reads it. */
interface ScannedComment {
  readonly kind: "line" | "block";
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

/** Every comment of `text`, scanned as TypeScript scans it. */
function scanComments(text: string): readonly ScannedComment[] {
  const scanner = ts.createScanner(
    ts.ScriptTarget.ESNext,
    false,
    ts.LanguageVariant.Standard,
    text,
  );
  const comments: ScannedComment[] = [];
  for (
    let token = scanner.scan();
    token !== ts.SyntaxKind.EndOfFileToken;
    token = scanner.scan()
  ) {
    if (
      token === ts.SyntaxKind.SingleLineCommentTrivia ||
      token === ts.SyntaxKind.MultiLineCommentTrivia
    ) {
      comments.push({
        kind:
          token === ts.SyntaxKind.SingleLineCommentTrivia ? "line" : "block",
        start: scanner.getTokenStart(),
        end: scanner.getTokenEnd(),
        text: scanner.getTokenText(),
      });
    }
  }
  return comments;
}

/** Whether the comments in [start, end) hold a line and a block comment. */
function bothKindsWithin(
  comments: readonly ScannedComment[],
  start: number,
  end: number,
): boolean {
  const within = comments.filter(
    (comment) => comment.start >= start && comment.end <= end,
  );
  return (
    within.some((comment) => comment.kind === "line") &&
    within.some((comment) => comment.kind === "block")
  );
}

/**
 * Where (c)'s comments stand, read from the parsed file: each place T7.6-2
 * names — before the import, between keys, inside lists, after the export —
 * holding a line and a block comment; or why not.
 */
function commentPlacesProblem(
  read: ReadBack,
  comments: readonly ScannedComment[],
): string | undefined {
  const source = read.source;
  const [importDeclaration, exportAssignment] = source.statements;
  if (importDeclaration === undefined || exportAssignment === undefined) {
    return "it holds no import and default export";
  }
  const betweenKeys: ScannedComment[] = [];
  const insideLists: ScannedComment[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isObjectLiteralExpression(node)) {
      node.properties.forEach((property, index) => {
        const next = node.properties[index + 1];
        if (next === undefined) return;
        betweenKeys.push(
          ...comments.filter(
            (comment) =>
              comment.start >= property.end &&
              comment.end <= next.getStart(source),
          ),
        );
      });
    }
    if (ts.isArrayLiteralExpression(node)) {
      insideLists.push(
        ...comments.filter(
          (comment) =>
            comment.start > node.getStart(source) && comment.end < node.end,
        ),
      );
    }
    ts.forEachChild(node, visit);
  };
  visit(exportAssignment);
  const places: readonly (readonly [string, boolean])[] = [
    [
      "before the import",
      bothKindsWithin(comments, 0, importDeclaration.getStart(source)),
    ],
    ["between keys", bothKindsWithin(betweenKeys, 0, source.end)],
    ["inside lists", bothKindsWithin(insideLists, 0, source.end)],
    [
      "after the export",
      bothKindsWithin(comments, exportAssignment.end, source.end),
    ],
  ];
  const missing = places.filter(([, held]) => !held).map(([place]) => place);
  return missing.length === 0
    ? undefined
    : `it holds no line and block comment ${missing.join(", ")}`;
}

// ---------------------------------------------------------------------------
// Valid under 7: the harness's own reading over the data (module header)
// ---------------------------------------------------------------------------

const TOP_LEVEL_KEYS = ["specs", "code", "markdown", "coverage", "policy"];
const MARKDOWN_KEYS = ["emit", "outDir"];
const PROFILE_KEYS = [
  "name",
  "target",
  "targetTags",
  "targets",
  "boundary",
  "boundaryKind",
  "mode",
  "edgeKinds",
];
const RULE_KEYS = ["name", "type", "from", "to", "kinds"];
const SELECTOR_KEYS = ["group", "kind", "files", "tags"];
const SELECTOR_FORMS = ["group", "files", "tags"];
const EDGE_KINDS = ["depends", "embeds", "references"];
const GROUP_KINDS = ["spec", "code"];
const TARGETS = ["leaves", "all"];
const MODES = ["direct", "transitive"];
const RULE_TYPES = ["forbidden", "allowedOnly"];

/** The configured groups of one kind, by name. */
type Groups = ReadonlyMap<string, readonly string[]>;

/** Whether a glob lies inside the workspace root by its spelling (SPEC 7). */
function insideRoot(glob: string): boolean {
  if (glob.startsWith("/")) return false;
  let depth = 0;
  for (const segment of glob.split("/")) {
    if (segment === "..") depth -= 1;
    else if (segment !== "." && segment !== "" && segment !== "**") {
      depth += 1;
    }
    if (depth < 0) return false;
  }
  return true;
}

/** A list of strings, or undefined where `value` is none. */
function stringList(
  value: ConfigValue | undefined,
): readonly string[] | undefined {
  if (value === undefined || !isConfigList(value)) return undefined;
  return value.every((element) => typeof element === "string")
    ? (value as readonly string[])
    : undefined;
}

/**
 * Every way `config` is invalid under 7 (SPEC 7, 7.3, 7.4, 7.5), as the
 * harness reads them over the data; empty where it is valid. Workspace-bound
 * rules (a file matched by both a spec and a code group) do not arise: no
 * staging holds a file any configured glob matches.
 */
export function problemsUnder7(config: ConfigObject): readonly string[] {
  const problems: string[] = [];
  const keysWithin = (
    object: ConfigObject,
    allowed: readonly string[],
    where: string,
  ): void => {
    for (const key of object.keys()) {
      if (!allowed.includes(key)) {
        problems.push(`${where} holds the unknown key ${JSON.stringify(key)}`);
      }
    }
  };
  const nameProblem = (name: ConfigValue | undefined, where: string): void => {
    if (typeof name !== "string") problems.push(`${where} has no string name`);
    else if (name === "" || name.includes(REPLACEMENT_CHARACTER)) {
      problems.push(`${where} has the invalid name ${JSON.stringify(name)}`);
    }
  };
  const groupsOf = (key: "specs" | "code"): Groups => {
    const value = config.get(key);
    const groups = new Map<string, readonly string[]>();
    if (value === undefined) {
      if (key === "specs") problems.push("the required key specs is missing");
      return groups;
    }
    if (!isConfigObject(value)) {
      problems.push(`${key} is no object`);
      return groups;
    }
    for (const [name, globs] of value) {
      nameProblem(name, `the ${key} group ${JSON.stringify(name)}`);
      const list = stringList(globs);
      if (list === undefined) {
        problems.push(
          `the ${key} group ${JSON.stringify(name)} is no list of globs`,
        );
        continue;
      }
      for (const glob of list) {
        if (!insideRoot(glob)) {
          problems.push(
            `the glob ${JSON.stringify(glob)} lies outside the root`,
          );
        }
      }
      groups.set(name, list);
    }
    return groups;
  };
  keysWithin(config, TOP_LEVEL_KEYS, "the top level");
  const specs = groupsOf("specs");
  const code = groupsOf("code");
  const groupProblem = (
    group: ConfigValue | undefined,
    kind: ConfigValue | undefined,
    where: string,
  ): void => {
    if (typeof group !== "string") {
      problems.push(`${where} names no group`);
      return;
    }
    const inSpecs = specs.has(group);
    const inCode = code.has(group);
    if (kind === undefined) {
      if (!inSpecs && !inCode) problems.push(`${where} names no group`);
      if (inSpecs && inCode) {
        problems.push(
          `${where} names ${JSON.stringify(group)}, both kinds', without its kind`,
        );
      }
      return;
    }
    if (kind !== "spec" && kind !== "code") {
      problems.push(`${where} gives a kind outside ${GROUP_KINDS.join(", ")}`);
    } else if (!(kind === "spec" ? inSpecs : inCode)) {
      problems.push(`${where} names no ${kind} group ${JSON.stringify(group)}`);
    }
  };
  const setRead = (
    value: ConfigValue | undefined,
    where: string,
    members?: readonly string[],
  ): void => {
    if (value === undefined) return;
    const list = stringList(value);
    if (list === undefined || list.length === 0) {
      problems.push(`${where} is no non-empty list of strings`);
      return;
    }
    if (
      members !== undefined &&
      list.some((element) => !members.includes(element))
    ) {
      problems.push(`${where} holds an element outside ${members.join(", ")}`);
    }
  };
  const enumerated = (
    value: ConfigValue | undefined,
    members: readonly string[],
    where: string,
    required: boolean,
  ): void => {
    if (value === undefined) {
      if (required) problems.push(`${where} is missing`);
    } else if (typeof value !== "string" || !members.includes(value)) {
      problems.push(`${where} is outside ${members.join(", ")}`);
    }
  };
  const markdown = config.get("markdown");
  if (markdown !== undefined) {
    if (!isConfigObject(markdown)) problems.push("markdown is no object");
    else {
      keysWithin(markdown, MARKDOWN_KEYS, "markdown");
      if (typeof markdown.get("emit") !== "boolean") {
        problems.push("markdown's emit is no boolean");
      }
      const outDir = markdown.get("outDir");
      if (outDir !== undefined) {
        const segments = typeof outDir === "string" ? outDir.split("/") : [];
        if (
          typeof outDir !== "string" ||
          segments.some((s) => s === "" || s === "." || s === "..") ||
          outDir === ".xspec" ||
          outDir.startsWith(".xspec/")
        ) {
          problems.push(
            `markdown's outDir ${JSON.stringify(outDir)} is invalid`,
          );
        }
      }
    }
  }
  const listOfObjects = (key: string): readonly ConfigObject[] => {
    const value = config.get(key);
    if (value === undefined) return [];
    if (!isConfigList(value) || !value.every(isConfigObject)) {
      problems.push(`${key} is no list of objects`);
      return [];
    }
    return value as readonly ConfigObject[];
  };
  const uniqueNames = (
    objects: readonly ConfigObject[],
    what: string,
  ): void => {
    const names = objects.map((object) => object.get("name"));
    objects.forEach((object, index) =>
      nameProblem(object.get("name"), `${what} ${String(index + 1)}`),
    );
    if (new Set(names).size !== names.length)
      problems.push(`two ${what}s share a name`);
  };
  const profiles = listOfObjects("coverage");
  uniqueNames(profiles, "profile");
  profiles.forEach((profile, index) => {
    const where = `profile ${String(index + 1)}`;
    keysWithin(profile, PROFILE_KEYS, where);
    const target = profile.get("target");
    if (typeof target !== "string" || !specs.has(target)) {
      problems.push(`${where}'s target names no spec group`);
    }
    setRead(profile.get("targetTags"), `${where}'s targetTags`);
    enumerated(profile.get("targets"), TARGETS, `${where}'s targets`, false);
    groupProblem(
      profile.get("boundary"),
      profile.get("boundaryKind"),
      `${where}'s boundary`,
    );
    enumerated(profile.get("mode"), MODES, `${where}'s mode`, true);
    setRead(profile.get("edgeKinds"), `${where}'s edgeKinds`, EDGE_KINDS);
  });
  const rules = listOfObjects("policy");
  uniqueNames(rules, "rule");
  rules.forEach((rule, index) => {
    const where = `rule ${String(index + 1)}`;
    keysWithin(rule, RULE_KEYS, where);
    enumerated(rule.get("type"), RULE_TYPES, `${where}'s type`, true);
    setRead(rule.get("kinds"), `${where}'s kinds`, EDGE_KINDS);
    for (const end of ["from", "to"]) {
      const selector = rule.get(end);
      const at = `${where}'s ${end}`;
      if (selector === undefined || !isConfigObject(selector)) {
        problems.push(`${at} is no selector`);
        continue;
      }
      keysWithin(selector, SELECTOR_KEYS, at);
      const forms = SELECTOR_FORMS.filter((form) => selector.has(form));
      if (forms.length !== 1) {
        problems.push(`${at} uses ${String(forms.length)} selector forms`);
      } else if (forms[0] === "group") {
        groupProblem(selector.get("group"), selector.get("kind"), at);
      } else if (selector.has("kind")) {
        problems.push(`${at} carries kind without group`);
      } else if (forms[0] === "files") {
        const files = selector.get("files");
        if (
          typeof files !== "string" ||
          !insideRoot(files) ||
          files.includes("$")
        ) {
          problems.push(
            `${at}'s files is no capture-free glob inside the root`,
          );
        }
      } else {
        setRead(selector.get("tags"), `${at}'s tags`);
      }
    }
  });
  return problems;
}

// ---------------------------------------------------------------------------
// T7.6-2's configurations (module header)
// ---------------------------------------------------------------------------

/** The three dependency edge kinds, each list holding all of them. */
const ALL_EDGE_KINDS: ConfigList = ["depends", "embeds", "references"];

/**
 * T7.6-2(a): every key and field 7 defines, every value 7 enumerates at
 * each of its positions (module header). `tests` names a spec and a code
 * group, so each reference to it carries its kind; `product` and `app` are
 * unambiguous, so the selector naming `app` carries none.
 */
export const T762_EVERY_KEY_AND_VALUE: ConfigObject = configObject(
  [
    "specs",
    configObject(
      ["product", ["specs/product/**/*.mdx"]],
      ["tests", ["specs/tests/**/*.mdx"]],
    ),
  ],
  [
    "code",
    configObject(
      ["app", ["src/**/*.ts", "src/**/*.tsx"]],
      ["tests", ["test/**/*.ts"]],
    ),
  ],
  ["markdown", configObject(["emit", true], ["outDir", "docs"])],
  [
    "coverage",
    [
      configObject(
        ["name", "product-tested"],
        ["target", "product"],
        ["targetTags", ["core"]],
        ["targets", "leaves"],
        ["boundary", "tests"],
        ["boundaryKind", "code"],
        ["mode", "direct"],
        ["edgeKinds", ALL_EDGE_KINDS],
      ),
      configObject(
        ["name", "product-specified"],
        ["target", "product"],
        ["targetTags", ["core", "edge"]],
        ["targets", "all"],
        ["boundary", "tests"],
        ["boundaryKind", "spec"],
        ["mode", "transitive"],
        ["edgeKinds", ALL_EDGE_KINDS],
      ),
    ],
  ],
  [
    "policy",
    [
      configObject(
        ["name", "app-avoids-test-code"],
        ["type", "forbidden"],
        ["from", configObject(["group", "app"])],
        ["to", configObject(["group", "tests"], ["kind", "code"])],
        ["kinds", ALL_EDGE_KINDS],
      ),
      configObject(
        ["name", "test-specs-cite-product"],
        ["type", "allowedOnly"],
        ["from", configObject(["group", "tests"], ["kind", "spec"])],
        ["to", configObject(["files", "specs/product/**/*.mdx"])],
        ["kinds", ALL_EDGE_KINDS],
      ),
      configObject(
        ["name", "core-avoids-edge"],
        ["type", "forbidden"],
        ["from", configObject(["tags", ["core"]])],
        ["to", configObject(["tags", ["edge"]])],
        ["kinds", ALL_EDGE_KINDS],
      ),
    ],
  ],
);

/** T7.6-2(d): the minimal configuration, `specs` holding no group. */
const T762_MINIMAL: ConfigObject = configObject(["specs", configObject()]);

/**
 * The seven members of TypeScript's global `Object` interface, then
 * `__proto__` (T7.6-2(e)).
 */
const OBJECT_MEMBER_NAMES: readonly string[] = [
  "constructor",
  "toString",
  "toLocaleString",
  "valueOf",
  "hasOwnProperty",
  "isPrototypeOf",
  "propertyIsEnumerable",
  "__proto__",
];

/** The name after the one at `index`, cyclically. */
function nextMemberName(index: number): string {
  return OBJECT_MEMBER_NAMES[(index + 1) % OBJECT_MEMBER_NAMES.length]!;
}

/**
 * T7.6-2(e) (module header): each name a spec and a code group's, so each
 * reference carries its kind; profile `i`, named the `i`th name, targets it
 * and takes the next as its boundary; rule `i`, so named, runs from its
 * group to the next name's.
 */
const T762_OBJECT_MEMBER_NAMES: ConfigObject = configObject(
  [
    "specs",
    configObject(
      ...OBJECT_MEMBER_NAMES.map(
        (name) => [name, [`specs/${name}/**/*.mdx`]] as const,
      ),
    ),
  ],
  [
    "code",
    configObject(
      ...OBJECT_MEMBER_NAMES.map(
        (name) => [name, [`src/${name}/**/*.ts`]] as const,
      ),
    ),
  ],
  [
    "coverage",
    OBJECT_MEMBER_NAMES.map((name, index) =>
      configObject(
        ["name", name],
        ["target", name],
        ["boundary", nextMemberName(index)],
        ["boundaryKind", index % 2 === 0 ? "code" : "spec"],
        ["mode", "direct"],
      ),
    ),
  ],
  [
    "policy",
    OBJECT_MEMBER_NAMES.map((name, index) =>
      configObject(
        ["name", name],
        ["type", index % 2 === 0 ? "forbidden" : "allowedOnly"],
        [
          "from",
          configObject(
            ["group", name],
            ["kind", index % 2 === 0 ? "spec" : "code"],
          ),
        ],
        [
          "to",
          configObject(
            ["group", nextMemberName(index)],
            ["kind", index % 2 === 0 ? "code" : "spec"],
          ),
        ],
      ),
    ),
  ],
);

/**
 * T7.6-2(f)'s first file: `code: {}`, `coverage: []`, `policy: []`, and
 * `markdown: { emit: false }` beside a `specs` group.
 */
const T762_EMPTY_FORMS: ConfigObject = configObject(
  ["specs", configObject(["product", ["specs/**/*.mdx"]])],
  ["code", configObject()],
  ["markdown", configObject(["emit", false])],
  ["coverage", []],
  ["policy", []],
);

/**
 * T7.6-2(f)'s second file: like (a)'s, every optional field omitted, its
 * group names unambiguous (the code group `checks` in place of `tests`), so
 * that no kind is required.
 */
const T762_OPTIONAL_FIELDS_OMITTED: ConfigObject = configObject(
  [
    "specs",
    configObject(
      ["product", ["specs/product/**/*.mdx"]],
      ["tests", ["specs/tests/**/*.mdx"]],
    ),
  ],
  [
    "code",
    configObject(
      ["app", ["src/**/*.ts", "src/**/*.tsx"]],
      ["checks", ["test/**/*.ts"]],
    ),
  ],
  ["markdown", configObject(["emit", true])],
  [
    "coverage",
    [
      configObject(
        ["name", "product-tested"],
        ["target", "product"],
        ["boundary", "checks"],
        ["mode", "direct"],
      ),
      configObject(
        ["name", "product-specified"],
        ["target", "product"],
        ["boundary", "tests"],
        ["mode", "transitive"],
      ),
    ],
  ],
  [
    "policy",
    [
      configObject(
        ["name", "app-avoids-test-code"],
        ["type", "forbidden"],
        ["from", configObject(["group", "app"])],
        ["to", configObject(["group", "checks"])],
      ),
      configObject(
        ["name", "test-specs-cite-product"],
        ["type", "allowedOnly"],
        ["from", configObject(["group", "tests"])],
        ["to", configObject(["files", "specs/product/**/*.mdx"])],
      ),
      configObject(
        ["name", "core-avoids-edge"],
        ["type", "forbidden"],
        ["from", configObject(["tags", ["core"]])],
        ["to", configObject(["tags", ["edge"]])],
      ),
    ],
  ],
);

/** The lists 7.4 and 7.5 read as sets, by key (T7.6-2(f)). */
const SET_READ_KEYS: readonly string[] = [
  "targetTags",
  "edgeKinds",
  "kinds",
  "tags",
];

/** `value` with an element repeated in every set-read list it holds. */
function withRepeatedElements(
  value: ConfigValue,
  key: string | undefined,
): ConfigValue {
  if (isConfigList(value)) {
    const elements = value.map((element) =>
      withRepeatedElements(element, undefined),
    );
    const first = elements[0];
    return key !== undefined &&
      SET_READ_KEYS.includes(key) &&
      first !== undefined
      ? [...elements, first]
      : elements;
  }
  if (isConfigObject(value)) {
    return configObject(
      ...[...value].map(
        ([member, inner]) =>
          [member, withRepeatedElements(inner, member)] as const,
      ),
    );
  }
  return value;
}

/**
 * T7.6-2(f)'s third file: (a)'s, the spec group `tests`'s and the code
 * group `app`'s glob lists empty, and an element repeated in every set-read
 * list — each `targetTags`, `edgeKinds`, rule's `kinds`, and selector's
 * `tags`.
 */
const T762_EMPTY_AND_REPEATED: ConfigObject = (() => {
  const repeated = withRepeatedElements(T762_EVERY_KEY_AND_VALUE, undefined);
  if (!isConfigObject(repeated)) throw new Error("unreachable: an object");
  const emptied: ReadonlyMap<string, string> = new Map([
    ["specs", "tests"],
    ["code", "app"],
  ]);
  return configObject(
    ...[...repeated].map(([key, value]) => {
      const group = emptied.get(key);
      if (group === undefined || !isConfigObject(value)) {
        return [key, value] as const;
      }
      return [
        key,
        configObject(
          ...[...value].map(
            ([name, globs]) => [name, name === group ? [] : globs] as const,
          ),
        ),
      ] as const;
    }),
  );
})();

// ---------------------------------------------------------------------------
// Each arm's own content (module header)
// ---------------------------------------------------------------------------

/** The objects of the list at `key`, or none. */
function objectsAt(config: ConfigObject, key: string): readonly ConfigObject[] {
  const value = config.get(key);
  return value !== undefined && isConfigList(value)
    ? value.filter(isConfigObject)
    : [];
}

/** Every selector of a configuration's rules. */
function selectorsOf(config: ConfigObject): readonly ConfigObject[] {
  return objectsAt(config, "policy").flatMap((rule) =>
    ["from", "to"]
      .map((end) => rule.get(end))
      .filter(
        (selector): selector is ConfigObject =>
          selector !== undefined && isConfigObject(selector),
      ),
  );
}

/** A selector's form: `group`, `group spec`, `group code`, `files`, `tags`. */
function selectorForm(selector: ConfigObject): string {
  if (selector.has("group")) {
    const kind = selector.get("kind");
    return typeof kind === "string" ? `group ${kind}` : "group";
  }
  return selector.has("files") ? "files" : "tags";
}

/** The keys of the object at `key`, in order, or none. */
function keysAt(config: ConfigObject, key: string): readonly string[] {
  const value = config.get(key);
  return value !== undefined && isConfigObject(value) ? [...value.keys()] : [];
}

/** Whether `keys` are exactly `expected`, in order. */
function exactly(keys: Iterable<string>, expected: readonly string[]): boolean {
  return [...keys].join(",") === expected.join(",");
}

/** Whether a list of strings repeats an element. */
function repeats(value: ConfigValue | undefined): boolean {
  const list = stringList(value);
  return list !== undefined && new Set(list).size < list.length;
}

/** What a requirement check collects: each requirement the file misses. */
type Needs = (held: boolean, requirement: string) => void;

/** Run `check` with a collector; the requirements missed. */
function missed(check: (need: Needs) => void): readonly string[] {
  const misses: string[] = [];
  check((held, requirement) => {
    if (!held) misses.push(requirement);
  });
  return misses;
}

/** (a)'s requirements: every key and field, every enumerated value. */
function everyKeyAndValueMissed(config: ConfigObject): readonly string[] {
  return missed((need) => {
    need(exactly(config.keys(), TOP_LEVEL_KEYS), "every top-level key");
    need(keysAt(config, "specs").length === 2, "specs with two groups");
    need(keysAt(config, "code").length === 2, "code with two groups");
    const markdown = config.get("markdown");
    need(
      markdown !== undefined &&
        isConfigObject(markdown) &&
        markdown.get("emit") === true &&
        markdown.has("outDir"),
      "markdown with emit true and outDir",
    );
    const profiles = objectsAt(config, "coverage");
    need(
      profiles.length === 2 &&
        profiles.every((profile) => exactly(profile.keys(), PROFILE_KEYS)),
      "two profiles, each carrying every profile field",
    );
    const enumerations: readonly (readonly [string, readonly string[]])[] = [
      ["targets", TARGETS],
      ["boundaryKind", GROUP_KINDS],
      ["mode", MODES],
    ];
    for (const [key, members] of enumerations) {
      const taken = new Set(profiles.map((profile) => profile.get(key)));
      need(
        members.every((member) => taken.has(member)),
        `every value of ${key} between the profiles`,
      );
    }
    const rules = objectsAt(config, "policy");
    need(
      rules.length > 0 &&
        rules.every((rule) => exactly(rule.keys(), RULE_KEYS)),
      "rules each carrying every rule field, kinds included",
    );
    const types = new Set(rules.map((rule) => rule.get("type")));
    need(
      RULE_TYPES.every((type) => types.has(type)),
      "rules of both types",
    );
    for (const [key, objects] of [
      ["edgeKinds", profiles],
      ["kinds", rules],
    ] as const) {
      need(
        EDGE_KINDS.every((kind) =>
          objects.some((object) => stringList(object.get(key))?.includes(kind)),
        ),
        `each edge kind an element of some ${key}`,
      );
    }
    const forms = new Set(selectorsOf(config).map(selectorForm));
    for (const form of ["group", "group spec", "group code", "files", "tags"]) {
      need(forms.has(form), `a selector of the form ${form}`);
    }
  });
}

/** (d)'s requirements: `specs` holding no group, and nothing else. */
function minimalMissed(config: ConfigObject): readonly string[] {
  return missed((need) => {
    need(exactly(config.keys(), ["specs"]), "specs alone");
    need(keysAt(config, "specs").length === 0, "specs holding no group");
  });
}

/** (e)'s requirements: the eight names as groups, references, and names. */
function objectMemberNamesMissed(config: ConfigObject): readonly string[] {
  return missed((need) => {
    for (const key of ["specs", "code"]) {
      need(
        exactly(keysAt(config, key), OBJECT_MEMBER_NAMES),
        `exactly the eight names as ${key} groups`,
      );
    }
    const profiles = objectsAt(config, "coverage");
    const rules = objectsAt(config, "policy");
    const selectors = selectorsOf(config);
    for (const name of OBJECT_MEMBER_NAMES) {
      need(
        profiles.some(
          (profile) =>
            profile.get("target") === name || profile.get("boundary") === name,
        ),
        `${name} a profile's target or boundary`,
      );
      need(
        selectors.some((selector) => selector.get("group") === name),
        `${name} a selector's group`,
      );
      need(
        profiles.some((profile) => profile.get("name") === name),
        `a profile named ${name}`,
      );
      need(
        rules.some((rule) => rule.get("name") === name),
        `a rule named ${name}`,
      );
    }
  });
}

/** (f)'s first file's requirements: the empty forms beside a group. */
function emptyFormsMissed(config: ConfigObject): readonly string[] {
  return missed((need) => {
    need(keysAt(config, "specs").length > 0, "a specs group");
    const code = config.get("code");
    need(
      code !== undefined && isConfigObject(code) && code.size === 0,
      "code: {}",
    );
    const markdown = config.get("markdown");
    need(
      markdown !== undefined &&
        isConfigObject(markdown) &&
        exactly(markdown.keys(), ["emit"]) &&
        markdown.get("emit") === false,
      "markdown: { emit: false }",
    );
    for (const key of ["coverage", "policy"]) {
      const list = config.get(key);
      need(
        list !== undefined && isConfigList(list) && list.length === 0,
        `${key}: []`,
      );
    }
  });
}

/** (f)'s second file's requirements: every optional field omitted. */
function optionalFieldsOmittedMissed(config: ConfigObject): readonly string[] {
  return missed((need) => {
    need(exactly(config.keys(), TOP_LEVEL_KEYS), "every top-level key, as (a)");
    need(
      exactly(keysAt(config, "markdown"), ["emit"]),
      "markdown without outDir",
    );
    const profiles = objectsAt(config, "coverage");
    need(
      profiles.length > 0 &&
        profiles.every((profile) =>
          exactly(profile.keys(), ["name", "target", "boundary", "mode"]),
        ),
      "profiles carrying only name, target, boundary, and mode",
    );
    const rules = objectsAt(config, "policy");
    need(
      rules.length > 0 &&
        rules.every((rule) =>
          exactly(rule.keys(), ["name", "type", "from", "to"]),
        ),
      "rules without kinds",
    );
    need(
      selectorsOf(config)
        .filter((selector) => selector.has("group"))
        .every((selector) => exactly(selector.keys(), ["group"])),
      "group selectors without kind",
    );
    const code = new Set(keysAt(config, "code"));
    need(
      keysAt(config, "specs").every((name) => !code.has(name)),
      "group names unambiguous",
    );
  });
}

/** (f)'s third file's requirements: empty glob lists, repeated elements. */
function emptyAndRepeatedMissed(config: ConfigObject): readonly string[] {
  return missed((need) => {
    for (const key of ["specs", "code"]) {
      const groups = config.get(key);
      need(
        groups !== undefined &&
          isConfigObject(groups) &&
          [...groups.values()].some(
            (globs) => isConfigList(globs) && globs.length === 0,
          ),
        `a ${key} group's glob list empty`,
      );
    }
    for (const profile of objectsAt(config, "coverage")) {
      need(repeats(profile.get("targetTags")), "a repeat in each targetTags");
      need(repeats(profile.get("edgeKinds")), "a repeat in each edgeKinds");
    }
    for (const rule of objectsAt(config, "policy")) {
      need(repeats(rule.get("kinds")), "a repeat in each rule's kinds");
    }
    for (const selector of selectorsOf(config)) {
      if (selector.has("tags")) {
        need(repeats(selector.get("tags")), "a repeat in each selector's tags");
      }
    }
  });
}

// ---------------------------------------------------------------------------
// The files, their module-load checks, and their S-9 records
// ---------------------------------------------------------------------------

/** One of T7.6-2's files (module header). */
interface T762Arm {
  /** The arm as TEST-SPEC letters it, with the file's ordinal in (e), (f). */
  readonly arm: string;
  /** What the file stages: its records and diagnoses name it. */
  readonly what: string;
  readonly config: ConfigObject;
  /** How it is rendered, its specifier aside. */
  readonly binding: string;
  readonly keys: KeySpelling;
  readonly comments: boolean;
  /** Each of the arm's own requirements the configuration misses. */
  readonly missed: (config: ConfigObject) => readonly string[];
}

/** (b)'s alias: a name strict module code admits, never require or exports. */
const ALIAS = "configure";

const T762_ARMS: readonly T762Arm[] = [
  {
    arm: "(a)",
    what: "every key and field 7 defines, every enumerated value",
    config: T762_EVERY_KEY_AND_VALUE,
    binding: "defineConfig",
    keys: "identifiers",
    comments: false,
    missed: everyKeyAndValueMissed,
  },
  {
    arm: "(b)",
    what: "(a) with an aliased binding and every key a string literal",
    config: T762_EVERY_KEY_AND_VALUE,
    binding: ALIAS,
    keys: "string literals",
    comments: false,
    missed: everyKeyAndValueMissed,
  },
  {
    arm: "(c)",
    what: "(a) with line and block comments before the import, between keys, inside lists, and after the export",
    config: T762_EVERY_KEY_AND_VALUE,
    binding: "defineConfig",
    keys: "identifiers",
    comments: true,
    missed: everyKeyAndValueMissed,
  },
  {
    arm: "(d)",
    what: "the minimal configuration, specs holding no group",
    config: T762_MINIMAL,
    binding: "defineConfig",
    keys: "identifiers",
    comments: false,
    missed: minimalMissed,
  },
  {
    arm: "(e) 1",
    what: "the Object interface's members and __proto__ as group, profile, and rule names, group keys spelled as identifiers",
    config: T762_OBJECT_MEMBER_NAMES,
    binding: "defineConfig",
    keys: "identifiers",
    comments: false,
    missed: objectMemberNamesMissed,
  },
  {
    arm: "(e) 2",
    what: "the Object interface's members and __proto__ as group, profile, and rule names, group keys spelled as string literals",
    config: T762_OBJECT_MEMBER_NAMES,
    binding: "defineConfig",
    keys: "group names as string literals",
    comments: false,
    missed: objectMemberNamesMissed,
  },
  {
    arm: "(f) 1",
    what: "code: {}, coverage: [], policy: [], and markdown: { emit: false } beside a specs group",
    config: T762_EMPTY_FORMS,
    binding: "defineConfig",
    keys: "identifiers",
    comments: false,
    missed: emptyFormsMissed,
  },
  {
    arm: "(f) 2",
    what: "a file like (a)'s with every optional field omitted, its group names unambiguous",
    config: T762_OPTIONAL_FIELDS_OMITTED,
    binding: "defineConfig",
    keys: "identifiers",
    comments: false,
    missed: optionalFieldsOmittedMissed,
  },
  {
    arm: "(f) 3",
    what: "(a) with a spec and a code group's glob lists empty and an element repeated in every set-read list",
    config: T762_EMPTY_AND_REPEATED,
    binding: "defineConfig",
    keys: "identifiers",
    comments: false,
    missed: emptyAndRepeatedMissed,
  },
];

/** Whether two values of 7's form are equal, object keys in order. */
function sameValue(a: ConfigValue, b: ConfigValue): boolean {
  if (typeof a !== "object" || typeof b !== "object") return a === b;
  if (isConfigList(a) || isConfigList(b)) {
    return (
      isConfigList(a) &&
      isConfigList(b) &&
      a.length === b.length &&
      a.every((element, index) => sameValue(element, b[index]!))
    );
  }
  const entries = [...b];
  return (
    a.size === b.size &&
    [...a].every(([key, value], index) => {
      const entry = entries[index];
      return (
        entry !== undefined && entry[0] === key && sameValue(value, entry[1])
      );
    })
  );
}

/**
 * The file `arm` stages beside the placement `name` — rendered, then held
 * at module load to everything the module header lists; a deviation throws.
 */
function composeFile(arm: T762Arm, name: string): string {
  const what = `T7.6-2${arm.arm} (${arm.what}, importing ${JSON.stringify(name)})`;
  const problem = deviation("T7.6-2", what, T762_PREMISE);
  const rendering: ConfigRendering = {
    specifier: name,
    binding: arm.binding,
    keys: arm.keys,
    comments: arm.comments,
  };
  const text = renderConfiguration(arm.config, rendering);
  if (text.includes(BACKSLASH)) problem("spells a backslash");
  const invalid = problemsUnder7(arm.config);
  if (invalid.length > 0) problem(`is invalid under 7: ${invalid.join("; ")}`);
  const misses = arm.missed(arm.config);
  if (misses.length > 0) {
    problem(`misses what its arm names: ${misses.join("; ")}`);
  }
  const comments = scanComments(text);
  for (const comment of comments) {
    if (comment.text.includes("@") || comment.text.startsWith("///")) {
      problem(
        `carries the comment ${JSON.stringify(comment.text)}, which ` +
          "TypeScript may read as a directive or pragma",
      );
    }
  }
  const read = readBack(text, problem);
  if (
    read.specifier !== name ||
    read.specifierSpelling !== JSON.stringify(name)
  ) {
    problem(`spells its specifier ${read.specifierSpelling}, not exactly N`);
  }
  if (read.binding !== arm.binding) {
    problem(`binds defineConfig to ${read.binding}, not ${arm.binding}`);
  }
  if (!sameValue(read.argument, arm.config)) {
    problem("reads back as another configuration than the one rendered");
  }
  for (const key of read.keys) {
    const stringLiteral =
      arm.keys === "string literals" ||
      (arm.keys === "group names as string literals" &&
        isGroupNameKey(key.path));
    if (key.stringLiteral !== stringLiteral) {
      problem(
        `spells the key ${JSON.stringify(key.key)} as ` +
          `${key.stringLiteral ? "a string literal" : "an identifier"}`,
      );
    }
  }
  if (arm.comments) {
    const places = commentPlacesProblem(read, comments);
    if (places !== undefined) problem(places);
  } else if (comments.length > 0) {
    problem("carries a comment, though its arm stages none");
  }
  return text;
}

/** One file's records for one N: plain TypeScript, and TSX of the same bytes. */
interface T762Records {
  readonly ts: StagedTs;
  readonly tsx: StagedTs;
}

/** One of T7.6-2's files, with its records for each candidate N. */
interface T762File {
  /** The arm as TEST-SPEC letters it. */
  readonly arm: string;
  /** Names the file in every diagnosis. */
  readonly label: string;
  readonly records: ReadonlyMap<string, T762Records>;
}

/**
 * T7.6-2's files, each rendered and checked for each canonical-name
 * candidate at module load, each rendering a staged-source record (S-9),
 * judged as plain TypeScript and, for the `.tsx` name, as TSX. (a)'s records
 * are T7.6-3's twin too, and (d)'s T7.6-1's covered file, so their names
 * lead with both IDs.
 */
const T762_FILES: readonly T762File[] = T762_ARMS.map((arm) => {
  const records = new Map<string, T762Records>();
  const ids =
    arm.arm === "(a)"
      ? "T7.6-2/T7.6-3"
      : arm.arm === "(d)"
        ? "T7.6-1/T7.6-2"
        : "T7.6-2";
  for (const name of CANONICAL_MODULE_NAMES) {
    const text = composeFile(arm, name);
    const record = `${ids} ${arm.arm} ${arm.what}, importing ${JSON.stringify(name)}`;
    records.set(name, {
      ts: stagedTs(record, text),
      tsx: stagedTs(`${record}, as TSX`, text, "well-formed", "tsx"),
    });
  }
  return { arm: arm.arm, label: `T7.6-2${arm.arm} (${arm.what})`, records };
});

// ---------------------------------------------------------------------------
// The body
// ---------------------------------------------------------------------------

/** The project directory each staging holds, staging-relative. */
const PROJECT_DIR = "project";

/** `n` and `word`, pluralized. */
function count(n: number, word: string): string {
  return `${String(n)} ${word}${n === 1 ? "" : "s"}`;
}

/** The files a staging writes for the placement's N: its records' bytes. */
function filesFor(
  name: string,
): readonly { label: string; text: string | Uint8Array }[] {
  return T762_FILES.map((file) => {
    const records = file.records.get(name);
    if (records === undefined) {
      throw new Error(
        `T7.6-2: no record holds ${file.label} beside N ${JSON.stringify(name)}; ` +
          `the canonical N is one of ${CANONICAL_MODULE_NAMES.join(", ")} ` +
          "(helpers/module-channel.ts canonicalModuleName): a harness defect",
      );
    }
    return { label: file.label, text: records.ts.source };
  });
}

/** Each verdict's diagnosed failure, in file order: none where all pass. */
function failuresOf(verdicts: readonly CoveredVerdict[]): readonly string[] {
  const failures: string[] = [];
  for (const verdict of verdicts) {
    try {
      assertTypeChecks(verdict, "T7.6-2");
    } catch (error) {
      if (!(error instanceof HarnessAssertionError)) throw error;
      failures.push(error.message);
    }
  }
  return failures;
}

/** T7.6-2's body (module header). */
async function runValidConfigurations(product: ProductBinding): Promise<void> {
  let judged = 0;
  for (const project of PROJECT_KINDS) {
    const context = `T7.6-2 (valid configurations), the ${project} project`;
    const staging = await ModuleStaging.create(product, context);
    try {
      await staging.stageProject(PROJECT_DIR, project);
      const placement = await staging.placeCanonical(
        PROJECT_DIR,
        TYPE_CHECKING_ARM,
      );
      const files = await stageCoveredFiles({
        staging,
        directory: PROJECT_DIR,
        project,
        placement,
        alone: true,
        files: filesFor(placement.name),
        context,
      });
      for (const setup of files.setups) {
        const verdicts = files.judge(setup);
        const failures = failuresOf(verdicts);
        if (failures.length > 0) {
          fail(
            `${context}: ${count(failures.length, "valid configuration file")} ` +
              `of ${String(verdicts.length)} fail to type-check in ` +
              `${setup.label}, beside the canonical placement ` +
              `${placement.path} — the first covered setup where any fails, ` +
              `after ${count(judged, "setup")} where every file ` +
              "type-checked; the body stops here (TEST-SPEC T7.6-2: each " +
              "covered file valid under 7 type-checks in every covered " +
              "setup; SPEC 7.6 Type contract, valid configurations). " +
              failures.join(" | "),
          );
        }
        judged += 1;
      }
    } finally {
      await staging.dispose();
    }
  }
  if (judged !== COVERED_SETUP_COUNT) {
    throw new Error(
      `T7.6-2: ${String(judged)} covered setups judged, not TEST-SPEC ` +
        `§7.6's ${String(COVERED_SETUP_COUNT)}; no setup is sampled away: ` +
        "a harness defect",
    );
  }
}

const T7_6_2 = defineProductTest({
  id: "T7.6-2",
  title:
    "each covered file valid under 7 type-checks in all 173 covered setups " +
    "beside the canonical placement: (a) every key, field, and enumerated " +
    "value; (b) (a) with an aliased binding and every key a string literal; " +
    "(c) (a) with line and block comments before the import, between keys, " +
    "inside lists, and after the export; (d) the minimal configuration; (e) " +
    "the global Object interface's members and __proto__ as spec and code " +
    "group, profile, and rule names, in a file of identifier keys and one of " +
    "string-literal keys; (f) the empty, omitted, and repeated forms (SPEC " +
    "7.6 Covered files, Type contract)",
  run: runValidConfigurations,
});

// ---------------------------------------------------------------------------
// T7.6-1: declared exports (module header)
// ---------------------------------------------------------------------------

/** The one export SPEC 7.6 lets the module declare. */
const DEFINE_CONFIG = "defineConfig";

/** T7.6-1's covered file: T7.6-2(d)'s, the minimal configuration. */
const T761_FILE: T762File = (() => {
  const file = T762_FILES.find((candidate) => candidate.arm === "(d)");
  if (file === undefined) {
    throw new Error(
      "T7.6-1: T7.6-2(d)'s file, the minimal configuration, is not among " +
        "T7.6-2's files: a harness defect",
    );
  }
  return file;
})();

/**
 * Each way `listing` deviates from T7.6-1, in a fixed order: none where it
 * holds.
 */
function declaredExportsDeviations(listing: ExportListing): readonly string[] {
  if (listing.module === undefined) {
    return [
      "TypeScript resolves the import to no module it reads declarations " +
        "from, so the module declares no export, defineConfig among them",
    ];
  }
  const deviations: string[] = [];
  const entry = listing.exports.find(
    (candidate) => candidate.name === DEFINE_CONFIG,
  );
  if (entry === undefined) {
    deviations.push("the module declares no export named defineConfig");
  } else {
    if (entry.typeOnlyValue) {
      deviations.push(
        "defineConfig's value meaning is reached only through export type, " +
          "import type, or export type *, so no import may use it as a value",
      );
    } else if (!entry.value) {
      deviations.push("defineConfig carries no value meaning");
    }
    if (entry.type) deviations.push("defineConfig carries a type meaning");
    if (entry.namespace) {
      deviations.push("defineConfig carries a namespace meaning");
    }
  }
  const others = listing.exports.filter(
    (candidate) => candidate.name !== DEFINE_CONFIG,
  );
  if (others.length > 0) {
    deviations.push(
      `the module declares ${count(others.length, "other export")}: ` +
        others.map(describeListedExport).join(", "),
    );
  }
  return deviations;
}

/**
 * Assert T7.6-1 of one verdict (module header): the module TypeScript
 * resolves the covered file's import to, in the verdict's setup, declares
 * exactly one export, `defineConfig`, carrying a value meaning an import may
 * use as a value and neither a type nor a namespace meaning, and no other
 * export, type-only or not — read from the verdict's export listing, never
 * probed by names. A listing naming no module, as beside S-7's stub
 * package, fails too. A failure is diagnosed, naming the setup, the file,
 * the placement, every deviation, the listing whole, and TypeScript's
 * errors for the program; a verdict carrying no listing (its request did
 * not ask for one) is a misuse.
 */
export function assertDeclaredExports(
  verdict: CoveredVerdict,
  context: string,
): void {
  const listing = verdict.exportListing;
  if (listing === undefined) {
    throw new Error(
      `T7.6-1: the verdict for ${verdict.label} in ${verdict.setup.label} ` +
        "carries no export listing, which a request asks for with " +
        "listExports (helpers/module-channel-ts.ts): a harness defect " +
        `(${context})`,
    );
  }
  const deviations = declaredExportsDeviations(listing);
  if (deviations.length === 0) return;
  const beside =
    verdict.placement === undefined
      ? ""
      : `, beside the placement ${verdict.placement}`;
  fail(
    `${context}: in ${verdict.setup.label}${beside}, the import of the ` +
      `configuration file ${verdict.label} (${verdict.file}) does not reach ` +
      "a module declaring exactly one export, defineConfig, a value with " +
      `neither a type nor a namespace meaning: ${deviations.join("; ")}. ` +
      `TypeScript 5.9.3's listing for that import: ` +
      `${describeExportListing(listing)}. TypeScript's errors for the ` +
      `program, a diagnostic aid: ${describeErrors(verdict.errors)} ` +
      "(TEST-SPEC T7.6-1: in every covered setup, the module TypeScript " +
      "resolves the covered file's import to declares exactly one export, " +
      "defineConfig, carrying a value meaning and neither a type nor a " +
      "namespace meaning, and no other export, type-only or not; SPEC 7.6 " +
      "Type contract, Exports)",
  );
}

/** T7.6-1's body (module header). */
async function runDeclaredExports(product: ProductBinding): Promise<void> {
  let judged = 0;
  for (const project of PROJECT_KINDS) {
    const context = `T7.6-1 (declared exports), the ${project} project`;
    const staging = await ModuleStaging.create(product, context);
    try {
      await staging.stageProject(PROJECT_DIR, project);
      const placement = await staging.placeCanonical(
        PROJECT_DIR,
        TYPE_CHECKING_ARM,
      );
      const files = await stageCoveredFiles({
        staging,
        directory: PROJECT_DIR,
        project,
        placement,
        alone: true,
        files: [
          {
            label: T761_FILE.label,
            text: textFor(T761_FILE, placement.name),
          },
        ],
        listExports: true,
        context,
      });
      for (const setup of files.setups) {
        const [verdict] = files.judge(setup);
        if (verdict === undefined) throw new Error("unreachable: one verdict");
        assertDeclaredExports(
          verdict,
          `${context}: the first covered setup whose listing deviates, ` +
            `after ${count(judged, "setup")} where every listing held; the ` +
            "body stops here",
        );
        judged += 1;
      }
    } finally {
      await staging.dispose();
    }
  }
  if (judged !== COVERED_SETUP_COUNT) {
    throw new Error(
      `T7.6-1: ${String(judged)} covered setups judged, not TEST-SPEC ` +
        `§7.6's ${String(COVERED_SETUP_COUNT)}; no setup is sampled away: ` +
        "a harness defect",
    );
  }
}

const T7_6_1 = defineProductTest({
  id: "T7.6-1",
  title:
    "in all 173 covered setups beside the canonical placement, the module " +
    "TypeScript resolves the covered file's import to (T7.6-2(d)'s minimal " +
    "configuration) declares exactly one export, defineConfig, carrying a " +
    "value meaning and neither a type nor a namespace meaning, and no other " +
    "export, type-only or not: read from TypeScript's own listing of the " +
    "module's exports (implicit exports of a declaration module included) " +
    "and, for an export assignment, the assigned value's members, each " +
    "setup through its own resolution; TypeScript's synthetic default is no " +
    "export, a declared default export is one (SPEC 7.6 Type contract, " +
    "Exports)",
  run: runDeclaredExports,
});

// ---------------------------------------------------------------------------
// T7.6-3: 7's shape as the type-error class reads it (module header)
// ---------------------------------------------------------------------------

/** A kind SPEC 7.6's type-error class names: what 7 admits at a position. */
type ConfigKind = "boolean" | "string" | "list" | "object";

/** The four kinds, in T7.6-3's order. */
const CONFIG_KINDS: readonly ConfigKind[] = [
  "boolean",
  "string",
  "list",
  "object",
];

/** A value's kind. */
function kindOf(value: ConfigValue): ConfigKind {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "string") return "string";
  return isConfigList(value) ? "list" : "object";
}

/** Where a value stands: object keys and list indices, from the argument. */
export type ConfigPath = readonly (string | number)[];

/**
 * 7's shape as SPEC 7.6's type-error class reads it (module header): each
 * position's kind, its enumeration, a fixed-key object's fields and required
 * keys, a group map's entries, a list's elements, and whether 7.4 or 7.5
 * forbids the list empty or holds the object to a selector's forms.
 */
interface ShapeSchema {
  /** T7.6-3's name for the position: its row of the kind table. */
  readonly position: string;
  /** The kind 7 admits there. */
  readonly kind: ConfigKind;
  /** The values 7 enumerates there, where it enumerates them. */
  readonly values?: readonly string[];
  /** A fixed-key object's fields, in 7's order. */
  readonly fields?: ReadonlyMap<string, ShapeSchema>;
  /** A fixed-key object's required keys. */
  readonly required?: readonly string[];
  /** A group map's entries: each group, under any name. */
  readonly entries?: ShapeSchema;
  /** A list's elements. */
  readonly elements?: ShapeSchema;
  /** A list 7.4 or 7.5 forbids empty. */
  readonly nonEmpty?: boolean;
  /** A selector, held to 7.5's forms. */
  readonly selector?: boolean;
}

/** A string position, enumerated where `values` is given. */
function stringAt(position: string, values?: readonly string[]): ShapeSchema {
  return values === undefined
    ? { position, kind: "string" }
    : { position, kind: "string", values };
}

/** A group: a list of globs. */
const GROUP_SHAPE: ShapeSchema = {
  position: "a group",
  kind: "list",
  elements: stringAt("a group's glob element"),
};

/** A selector (7.5): a rule's `from` or `to`. */
const SELECTOR_SHAPE: ShapeSchema = {
  position: "a selector (a rule's from or to)",
  kind: "object",
  selector: true,
  required: [],
  fields: new Map<string, ShapeSchema>([
    ["group", stringAt("a selector's group")],
    ["kind", stringAt("a selector's kind", GROUP_KINDS)],
    ["files", stringAt("a selector's files")],
    [
      "tags",
      {
        position: "a selector's tags",
        kind: "list",
        nonEmpty: true,
        elements: stringAt("an element of a selector's tags"),
      },
    ],
  ]),
};

/** A coverage profile (7.4). */
const PROFILE_SHAPE: ShapeSchema = {
  position: "a profile",
  kind: "object",
  required: ["name", "target", "boundary", "mode"],
  fields: new Map<string, ShapeSchema>([
    ["name", stringAt("a profile's name")],
    ["target", stringAt("a profile's target")],
    [
      "targetTags",
      {
        position: "a profile's targetTags",
        kind: "list",
        nonEmpty: true,
        elements: stringAt("an element of a profile's targetTags"),
      },
    ],
    ["targets", stringAt("a profile's targets", TARGETS)],
    ["boundary", stringAt("a profile's boundary")],
    ["boundaryKind", stringAt("a profile's boundaryKind", GROUP_KINDS)],
    ["mode", stringAt("a profile's mode", MODES)],
    [
      "edgeKinds",
      {
        position: "a profile's edgeKinds",
        kind: "list",
        nonEmpty: true,
        elements: stringAt("an element of a profile's edgeKinds", EDGE_KINDS),
      },
    ],
  ]),
};

/** A policy rule (7.5). */
const RULE_SHAPE: ShapeSchema = {
  position: "a rule",
  kind: "object",
  required: ["name", "type", "from", "to"],
  fields: new Map<string, ShapeSchema>([
    ["name", stringAt("a rule's name")],
    ["type", stringAt("a rule's type", RULE_TYPES)],
    ["from", SELECTOR_SHAPE],
    ["to", SELECTOR_SHAPE],
    [
      "kinds",
      {
        position: "a rule's kinds",
        kind: "list",
        nonEmpty: true,
        elements: stringAt("an element of a rule's kinds", EDGE_KINDS),
      },
    ],
  ]),
};

/** The `defineConfig` argument (7, 7.1–7.5): the top level. */
const CONFIG_SHAPE: ShapeSchema = {
  position: "the top level",
  kind: "object",
  required: ["specs"],
  fields: new Map<string, ShapeSchema>([
    ["specs", { position: "specs", kind: "object", entries: GROUP_SHAPE }],
    ["code", { position: "code", kind: "object", entries: GROUP_SHAPE }],
    [
      "markdown",
      {
        position: "markdown",
        kind: "object",
        required: ["emit"],
        fields: new Map<string, ShapeSchema>([
          ["emit", { position: "emit", kind: "boolean" }],
          ["outDir", stringAt("outDir")],
        ]),
      },
    ],
    [
      "coverage",
      { position: "coverage", kind: "list", elements: PROFILE_SHAPE },
    ],
    ["policy", { position: "policy", kind: "list", elements: RULE_SHAPE }],
  ]),
};

/** Every shape below `shape`, `shape` first, each once. */
function shapesWithin(shape: ShapeSchema): readonly ShapeSchema[] {
  const seen = new Set<ShapeSchema>();
  const visit = (at: ShapeSchema): void => {
    if (seen.has(at)) return;
    seen.add(at);
    for (const inner of [
      ...(at.fields?.values() ?? []),
      ...(at.entries === undefined ? [] : [at.entries]),
      ...(at.elements === undefined ? [] : [at.elements]),
    ]) {
      visit(inner);
    }
  };
  visit(shape);
  return [...seen];
}

/** One value of a configuration, where it stands, and its shape there. */
interface ShapeNode {
  readonly path: ConfigPath;
  readonly value: ConfigValue;
  readonly shape: ShapeSchema;
}

/**
 * Every value of `config` at a position 7 gives a kind, the argument first
 * (module header): the walk descends only into a value of the kind 7 admits
 * at its position, so a misplaced value's insides stand at no position, and
 * never into an unknown key, which 7 gives no kind.
 */
function shapeNodes(config: ConfigObject): readonly ShapeNode[] {
  const nodes: ShapeNode[] = [];
  const visit = (
    value: ConfigValue,
    shape: ShapeSchema,
    path: ConfigPath,
  ): void => {
    nodes.push({ path, value, shape });
    if (kindOf(value) !== shape.kind) return;
    if (isConfigList(value)) {
      const elements = shape.elements;
      if (elements === undefined) return;
      value.forEach((element, index) =>
        visit(element, elements, [...path, index]),
      );
    } else if (isConfigObject(value)) {
      for (const [key, member] of value) {
        const inner = shape.entries ?? shape.fields?.get(key);
        if (inner !== undefined) visit(member, inner, [...path, key]);
      }
    }
  };
  visit(config, CONFIG_SHAPE, []);
  return nodes;
}

/** The six members of SPEC 7.6's type-error class. */
export type ViolationCategory =
  | "unknown key"
  | "missing required key"
  | "kind"
  | "enumeration"
  | "selector form"
  | "empty list";

/**
 * One violation of the type-error class: its member, and where it lies — an
 * unknown or missing key at that key's path, any other at its value's.
 */
export interface ClassViolation {
  readonly category: ViolationCategory;
  readonly path: ConfigPath;
}

/**
 * Every violation of SPEC 7.6's type-error class in `config`, as the harness
 * reads the class over the data (module header): an unknown key in a
 * fixed-key object; a required key missing; a value of a kind 7 does not
 * admit at its position; a string outside the values 7 enumerates there; a
 * selector not in exactly one of its forms; an empty list 7.4 or 7.5
 * forbids. Errors outside the class are not read.
 */
export function classViolations(
  config: ConfigObject,
): readonly ClassViolation[] {
  const found: ClassViolation[] = [];
  for (const { path, value, shape } of shapeNodes(config)) {
    if (kindOf(value) !== shape.kind) {
      found.push({ category: "kind", path });
      continue;
    }
    if (
      shape.values !== undefined &&
      typeof value === "string" &&
      !shape.values.includes(value)
    ) {
      found.push({ category: "enumeration", path });
    }
    if (isConfigList(value) && shape.nonEmpty === true && value.length === 0) {
      found.push({ category: "empty list", path });
    }
    if (isConfigObject(value) && shape.fields !== undefined) {
      for (const key of value.keys()) {
        if (!shape.fields.has(key)) {
          found.push({ category: "unknown key", path: [...path, key] });
        }
      }
      for (const key of shape.required ?? []) {
        if (!value.has(key)) {
          found.push({
            category: "missing required key",
            path: [...path, key],
          });
        }
      }
      if (shape.selector === true) {
        const forms = SELECTOR_FORMS.filter((form) => value.has(form));
        if (forms.length !== 1 || (value.has("kind") && !value.has("group"))) {
          found.push({ category: "selector form", path });
        }
      }
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
// T7.6-3's violations, as tables (module header)
// ---------------------------------------------------------------------------

/**
 * T7.6-3's positions to which 7 gives a kind, as its list names them, in
 * its order: `specs`, `code`, and each group; a group's glob elements;
 * `markdown`, `emit`, and `outDir`; `coverage`, each profile, each profile
 * field, and each element of its lists; `policy`, each rule, each rule field
 * (`from` and `to` being selectors), and each element of `kinds`; and each
 * selector, each selector field, and each element of its `tags`.
 */
const T763_KIND_POSITIONS: readonly string[] = [
  "specs",
  "code",
  "a group",
  "a group's glob element",
  "markdown",
  "emit",
  "outDir",
  "coverage",
  "a profile",
  "a profile's name",
  "a profile's target",
  "a profile's targetTags",
  "a profile's targets",
  "a profile's boundary",
  "a profile's boundaryKind",
  "a profile's mode",
  "a profile's edgeKinds",
  "an element of a profile's targetTags",
  "an element of a profile's edgeKinds",
  "policy",
  "a rule",
  "a rule's name",
  "a rule's type",
  "a rule's kinds",
  "an element of a rule's kinds",
  "a selector (a rule's from or to)",
  "a selector's group",
  "a selector's kind",
  "a selector's files",
  "a selector's tags",
  "an element of a selector's tags",
];

/** T7.6-3's enumerated positions, as its list names them. */
const T763_ENUMERATED_POSITIONS: readonly string[] = [
  "a profile's targets",
  "a profile's boundaryKind",
  "a profile's mode",
  "a rule's type",
  "a selector's kind",
  "an element of a profile's edgeKinds",
  "an element of a rule's kinds",
];

/** T7.6-3's objects an unknown key is staged in, as its list names them. */
const T763_UNKNOWN_KEY_POSITIONS: readonly string[] = [
  "the top level",
  "markdown",
  "a profile",
  "a rule",
  "a selector (a rule's from or to)",
];

/** T7.6-3's required keys, by the object holding them, as it lists them. */
const T763_REQUIRED_KEYS: readonly (readonly [string, readonly string[]])[] = [
  ["the top level", ["specs"]],
  ["markdown", ["emit"]],
  ["a profile", ["name", "target", "boundary", "mode"]],
  ["a rule", ["name", "type", "from", "to"]],
];

/** T7.6-3's forbidden empty lists, as its list names them. */
const T763_NON_EMPTY_POSITIONS: readonly string[] = [
  "a profile's targetTags",
  "a profile's edgeKinds",
  "a rule's kinds",
  "a selector's tags",
];

/**
 * The kind table (module header): for each position T7.6-3 lists, the
 * values staged there, one of each kind 7 does not admit at it — the
 * boolean both `true` and `false` where 7 admits a list or an object —
 * TEST-SPEC's own spellings among them (`specs: ["a/*.mdx"]`,
 * `emit: "true"`, `targetTags: "a"`, `from: "src/*.ts"`). Each value is
 * staged at every value of (a)'s file standing at that position.
 */
const T763_KIND_TABLE: ReadonlyMap<string, readonly ConfigValue[]> = new Map<
  string,
  readonly ConfigValue[]
>([
  ["specs", [true, false, "specs/**/*.mdx", ["a/*.mdx"]]],
  ["code", [true, false, "src/**/*.ts", ["src/**/*.ts"]]],
  [
    "a group",
    [true, false, "src/**/*.ts", configObject(["globs", ["src/**/*.ts"]])],
  ],
  [
    "a group's glob element",
    [true, ["src/**/*.ts"], configObject(["glob", "src/**/*.ts"])],
  ],
  ["markdown", [true, false, "docs", ["docs"]]],
  ["emit", ["true", [true], configObject(["enabled", true])]],
  ["outDir", [true, ["docs"], configObject(["path", "docs"])]],
  [
    "coverage",
    [
      true,
      false,
      "product-tested",
      configObject(
        ["name", "product-tested"],
        ["target", "product"],
        ["boundary", "tests"],
        ["boundaryKind", "code"],
        ["mode", "direct"],
      ),
    ],
  ],
  ["a profile", [true, false, "product-tested", ["product-tested"]]],
  [
    "a profile's name",
    [true, ["product-tested"], configObject(["name", "product-tested"])],
  ],
  [
    "a profile's target",
    [true, ["product"], configObject(["group", "product"])],
  ],
  [
    "a profile's targetTags",
    [true, false, "a", configObject(["tags", ["core"]])],
  ],
  [
    "a profile's targets",
    [true, ["leaves"], configObject(["targets", "leaves"])],
  ],
  [
    "a profile's boundary",
    [true, ["tests"], configObject(["group", "tests"], ["kind", "code"])],
  ],
  [
    "a profile's boundaryKind",
    [true, ["code"], configObject(["kind", "code"])],
  ],
  ["a profile's mode", [true, ["direct"], configObject(["mode", "direct"])]],
  [
    "a profile's edgeKinds",
    [true, false, "depends", configObject(["depends", true])],
  ],
  [
    "an element of a profile's targetTags",
    [true, ["core"], configObject(["tag", "core"])],
  ],
  [
    "an element of a profile's edgeKinds",
    [true, ["depends"], configObject(["kind", "depends"])],
  ],
  [
    "policy",
    [
      true,
      false,
      "app-avoids-test-code",
      configObject(
        ["name", "app-avoids-test-code"],
        ["type", "forbidden"],
        ["from", configObject(["group", "app"])],
        ["to", configObject(["group", "tests"], ["kind", "code"])],
      ),
    ],
  ],
  ["a rule", [true, false, "app-avoids-test-code", ["app-avoids-test-code"]]],
  [
    "a rule's name",
    [
      true,
      ["app-avoids-test-code"],
      configObject(["name", "app-avoids-test-code"]),
    ],
  ],
  ["a rule's type", [true, ["forbidden"], configObject(["type", "forbidden"])]],
  ["a rule's kinds", [true, false, "depends", configObject(["depends", true])]],
  [
    "an element of a rule's kinds",
    [true, ["depends"], configObject(["kind", "depends"])],
  ],
  [
    "a selector (a rule's from or to)",
    [true, false, "src/*.ts", [configObject(["group", "app"])]],
  ],
  ["a selector's group", [true, ["app"], configObject(["name", "app"])]],
  ["a selector's kind", [true, ["code"], configObject(["kind", "code"])]],
  [
    "a selector's files",
    [true, ["src/*.ts"], configObject(["glob", "src/*.ts"])],
  ],
  ["a selector's tags", [true, false, "core", configObject(["tag", "core"])]],
  [
    "an element of a selector's tags",
    [true, ["core"], configObject(["tag", "core"])],
  ],
]);

/**
 * T7.6-3's selector-form violations (module header): each two of `group`,
 * `files`, and `tags`, all three, none, and `kind` without `group` beside
 * `files`, beside `tags`, and alone — each replacing a selector whole, its
 * names resolving.
 */
const T763_SELECTOR_FORM_VIOLATIONS: readonly (readonly [
  string,
  ConfigObject,
])[] = [
  ["group and files", configObject(["group", "app"], ["files", "src/*.ts"])],
  ["group and tags", configObject(["group", "app"], ["tags", ["core"]])],
  ["files and tags", configObject(["files", "src/*.ts"], ["tags", ["core"]])],
  [
    "group, files, and tags",
    configObject(["group", "app"], ["files", "src/*.ts"], ["tags", ["core"]]),
  ],
  ["none of group, files, and tags", configObject()],
  ["kind beside files", configObject(["files", "src/*.ts"], ["kind", "code"])],
  ["kind beside tags", configObject(["tags", ["core"]], ["kind", "spec"])],
  ["kind alone", configObject(["kind", "spec"])],
];

/** The unknown key staged in each fixed-key object: no key of 7's anywhere. */
const T763_UNKNOWN_KEY = "extra";

/** The edge kind 5.2 defines and 7.4 and 7.5 leave out (T7.6-3). */
const CONTAINS = "contains";

/**
 * Two near misses of an enumerated value (module header): capitalized, and
 * cut by its last letter — `"Direct"` and `"depend"` among them.
 */
function nearMisses(value: string): readonly string[] {
  return [value.charAt(0).toUpperCase() + value.slice(1), value.slice(0, -1)];
}

// ---------------------------------------------------------------------------
// Edits of (a)'s data, and how a label names them
// ---------------------------------------------------------------------------

/** How a label names a position of (a)'s file. */
function describePath(path: ConfigPath): string {
  const [top, second] = path;
  if (top === undefined) return "the top level";
  let text = String(top);
  let named = 1;
  if ((top === "specs" || top === "code") && typeof second === "string") {
    text = `the ${top === "specs" ? "spec" : "code"} group ${second}`;
    named = 2;
    const glob = path[2];
    if (typeof glob === "number") {
      text += `'s glob ${String(glob + 1)}`;
      named = 3;
    }
  } else if (
    (top === "coverage" || top === "policy") &&
    typeof second === "number"
  ) {
    text = `${top === "coverage" ? "profile" : "rule"} ${String(second + 1)}`;
    named = 2;
  }
  for (const segment of path.slice(named)) {
    text +=
      typeof segment === "number"
        ? ` element ${String(segment + 1)}`
        : `'s ${segment}`;
  }
  return text;
}

/** How a label spells a value: as the file does, on one line. */
function describeValue(value: ConfigValue): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return String(value);
  if (isConfigList(value)) return `[${value.map(describeValue).join(", ")}]`;
  if (value.size === 0) return "{}";
  return `{ ${[...value]
    .map(([key, member]) => `${key}: ${describeValue(member)}`)
    .join(", ")} }`;
}

/** A kind with its article. */
function aKind(kind: ConfigKind): string {
  return kind === "object" ? "an object" : `a ${kind}`;
}

/** `config` with the value at `path` replaced by `edit`'s result. */
function editAt(
  config: ConfigValue,
  path: ConfigPath,
  edit: (at: ConfigValue) => ConfigValue,
): ConfigValue {
  const [head, ...rest] = path;
  if (head === undefined) return edit(config);
  if (typeof head === "number") {
    if (!isConfigList(config) || head >= config.length) {
      throw new Error(
        `T7.6-3: no list element ${String(head)} to edit: a harness defect`,
      );
    }
    return config.map((element, index) =>
      index === head ? editAt(element, rest, edit) : element,
    );
  }
  if (!isConfigObject(config) || !config.has(head)) {
    throw new Error(
      `T7.6-3: no key ${JSON.stringify(head)} to edit: a harness defect`,
    );
  }
  return configObject(
    ...[...config].map(
      ([key, member]) =>
        [key, key === head ? editAt(member, rest, edit) : member] as const,
    ),
  );
}

/** An object, or a harness defect. */
function asObject(value: ConfigValue, what: string): ConfigObject {
  if (!isConfigObject(value)) {
    throw new Error(`T7.6-3: ${what} is no object: a harness defect`);
  }
  return value;
}

/**
 * One edit of a configuration (module header): what it does to the data,
 * the violation of the class it makes, and how a label names it. A replacing
 * edit also records where it replaces and with what, so the module-load
 * checks find TEST-SPEC's own spellings among them.
 */
export interface T763Edit {
  readonly apply: (config: ConfigObject) => ConfigObject;
  readonly violation: ClassViolation;
  readonly label: string;
  readonly replaced?: {
    readonly path: ConfigPath;
    readonly value: ConfigValue;
  };
}

/** Replace the value at `path` with `value`, making `violation`. */
function replaceEdit(
  path: ConfigPath,
  value: ConfigValue,
  violation: ClassViolation,
  label: string,
): T763Edit {
  return {
    apply: (config) =>
      asObject(
        editAt(config, path, () => value),
        "an edited configuration",
      ),
    violation,
    label,
    replaced: { path, value },
  };
}

/** Remove the required key `key` from the object at `path`. */
function removeKeyEdit(path: ConfigPath, key: string): T763Edit {
  return {
    apply: (config) =>
      asObject(
        editAt(config, path, (object) =>
          configObject(
            ...[...asObject(object, describePath(path))].filter(
              ([member]) => member !== key,
            ),
          ),
        ),
        "an edited configuration",
      ),
    violation: { category: "missing required key", path: [...path, key] },
    label: `the required key ${key} missing from ${describePath(path)}`,
  };
}

/** Append the unknown key to the object at `path`. */
function unknownKeyEdit(path: ConfigPath): T763Edit {
  return {
    apply: (config) =>
      asObject(
        editAt(config, path, (object) =>
          configObject(...asObject(object, describePath(path)), [
            T763_UNKNOWN_KEY,
            true,
          ]),
        ),
        "an edited configuration",
      ),
    violation: { category: "unknown key", path: [...path, T763_UNKNOWN_KEY] },
    label:
      path.length === 0
        ? "an unknown key at the top level"
        : `an unknown key in ${describePath(path)}`,
  };
}

/** Stage a value of a kind 7 does not admit at `path`. */
function kindEdit(path: ConfigPath, value: ConfigValue): T763Edit {
  return replaceEdit(
    path,
    value,
    { category: "kind", path },
    `${aKind(kindOf(value))} at ${describePath(path)}: ${describeValue(value)}`,
  );
}

/** Stage a string outside the values 7 enumerates at `path`. */
function enumerationEdit(path: ConfigPath, value: string): T763Edit {
  return replaceEdit(
    path,
    value,
    { category: "enumeration", path },
    `a string outside the values 7 enumerates at ${describePath(path)}: ` +
      JSON.stringify(value),
  );
}

/** Replace the selector at `path` with a selector-form violation. */
function selectorFormEdit(
  path: ConfigPath,
  form: string,
  selector: ConfigObject,
): T763Edit {
  return replaceEdit(
    path,
    selector,
    { category: "selector form", path },
    `the selector form ${form} at ${describePath(path)}: ${describeValue(selector)}`,
  );
}

/** Empty the list at `path`, one 7.4 or 7.5 forbids empty. */
function emptyListEdit(path: ConfigPath): T763Edit {
  return replaceEdit(
    path,
    [],
    { category: "empty list", path },
    `an empty list at ${describePath(path)}`,
  );
}

// ---------------------------------------------------------------------------
// T7.6-3's arms: (a)'s file with its edits applied (module header)
// ---------------------------------------------------------------------------

/** One of T7.6-3's files: (a)'s data with its edits applied. */
export interface T763Arm {
  /** Names the file in every diagnosis and in its records. */
  readonly label: string;
  readonly edits: readonly T763Edit[];
  readonly config: ConfigObject;
}

/**
 * The single-violation edits (module header), from a walk of (a)'s data, in
 * T7.6-3's order of the class: unknown keys, missing required keys, kinds,
 * enumerations, selector forms, empty lists — then TEST-SPEC's
 * `kinds: [true]`.
 */
export function singleViolationEdits(twin: ConfigObject): readonly T763Edit[] {
  const nodes = shapeNodes(twin);
  const edits: T763Edit[] = [];
  for (const { path, value, shape } of nodes) {
    if (shape.fields !== undefined && isConfigObject(value)) {
      edits.push(unknownKeyEdit(path));
    }
  }
  for (const { path, value, shape } of nodes) {
    if (shape.fields === undefined || !isConfigObject(value)) continue;
    for (const key of shape.required ?? []) {
      if (value.has(key)) edits.push(removeKeyEdit(path, key));
    }
  }
  for (const { path, shape } of nodes) {
    if (path.length === 0) continue;
    for (const replacement of T763_KIND_TABLE.get(shape.position) ?? []) {
      edits.push(kindEdit(path, replacement));
    }
  }
  for (const { path, value, shape } of nodes) {
    if (shape.values === undefined || typeof value !== "string") continue;
    for (const outside of [
      ...nearMisses(value),
      ...(shape.values === EDGE_KINDS ? [CONTAINS] : []),
    ]) {
      edits.push(enumerationEdit(path, outside));
    }
  }
  for (const { path, shape } of nodes) {
    if (shape.selector !== true) continue;
    for (const [form, selector] of T763_SELECTOR_FORM_VIOLATIONS) {
      edits.push(selectorFormEdit(path, form, selector));
    }
  }
  for (const { path, shape } of nodes) {
    if (shape.nonEmpty === true) edits.push(emptyListEdit(path));
  }
  edits.push(
    replaceEdit(
      ["policy", 0, "kinds"],
      [true],
      { category: "kind", path: ["policy", 0, "kinds", 0] },
      "a boolean at rule 1's kinds element 1, the list [true] alone",
    ),
  );
  return edits;
}

/** The violations the several-violations file holds at once (module header). */
const T763_SEVERAL_EDITS: readonly T763Edit[] = [
  unknownKeyEdit([]),
  kindEdit(["markdown", "emit"], "true"),
  removeKeyEdit(["coverage", 0], "mode"),
  enumerationEdit(["coverage", 1, "mode"], "Transitive"),
  enumerationEdit(["policy", 0, "kinds", 0], CONTAINS),
  selectorFormEdit(
    ["policy", 1, "from"],
    "group and files",
    configObject(["group", "app"], ["files", "src/*.ts"]),
  ),
  emptyListEdit(["coverage", 0, "targetTags"]),
];

/** (a)'s data with `edits` applied in order. */
function applyEdits(
  twin: ConfigObject,
  edits: readonly T763Edit[],
): ConfigObject {
  return edits.reduce((config, edit) => edit.apply(config), twin);
}

/** T7.6-3's arms: one per single-violation edit, then the several. */
export const T763_ARMS: readonly T763Arm[] = [
  ...singleViolationEdits(T762_EVERY_KEY_AND_VALUE).map((edit) => ({
    label: edit.label,
    edits: [edit],
    config: edit.apply(T762_EVERY_KEY_AND_VALUE),
  })),
  {
    label: `several violations at once: ${T763_SEVERAL_EDITS.map(
      (edit) => edit.label,
    ).join("; ")}`,
    edits: T763_SEVERAL_EDITS,
    config: applyEdits(T762_EVERY_KEY_AND_VALUE, T763_SEVERAL_EDITS),
  },
];

/** How a check compares violations: member and path. */
function violationKey(violation: ClassViolation): string {
  return `${violation.category} at ${JSON.stringify(violation.path)}`;
}

/** Whether two lists of strings hold the same members, each once. */
function sameMembers(a: readonly string[], b: readonly string[]): boolean {
  const left = [...a].sort();
  const right = [...b].sort();
  return (
    new Set(left).size === left.length &&
    left.length === right.length &&
    left.every((member, index) => member === right[index])
  );
}

/**
 * Hold T7.6-3's tables to its list and each arm to its edits (module
 * header); a deviation is a harness defect, thrown at module load.
 */
function checkT763Arms(twin: ConfigObject, arms: readonly T763Arm[]): void {
  const problems: string[] = [];
  const need = (held: boolean, problem: string): void => {
    if (!held) problems.push(problem);
  };
  const shapes = shapesWithin(CONFIG_SHAPE).filter(
    (shape) => shape !== CONFIG_SHAPE,
  );
  const byPosition = new Map(shapes.map((shape) => [shape.position, shape]));
  need(byPosition.size === shapes.length, "two shapes share a position's name");
  need(
    sameMembers([...byPosition.keys()], T763_KIND_POSITIONS),
    "7's shape names other positions than T7.6-3 lists",
  );
  const nodes = shapeNodes(twin);
  need(
    sameMembers(
      [
        ...new Set(
          nodes
            .filter((node) => node.path.length > 0)
            .map((node) => node.shape.position),
        ),
      ],
      T763_KIND_POSITIONS,
    ),
    "T7.6-2(a)'s file does not hold a value at every position T7.6-3 lists",
  );
  need(
    sameMembers([...T763_KIND_TABLE.keys()], T763_KIND_POSITIONS),
    "the kind table's rows are not T7.6-3's positions",
  );
  for (const [position, values] of T763_KIND_TABLE) {
    const admitted = byPosition.get(position)?.kind;
    const kinds = values.map(kindOf);
    const booleans = values.filter((value) => typeof value === "boolean");
    const expectedBooleans =
      admitted === "boolean"
        ? []
        : admitted === "list" || admitted === "object"
          ? [true, false]
          : [true];
    need(
      admitted !== undefined &&
        sameMembers(
          [...new Set(kinds)],
          CONFIG_KINDS.filter((kind) => kind !== admitted),
        ) &&
        sameMembers(booleans.map(String), expectedBooleans.map(String)) &&
        kinds.filter((kind) => kind !== "boolean").length ===
          CONFIG_KINDS.filter((kind) => kind !== admitted && kind !== "boolean")
            .length &&
        new Set(values.map(describeValue)).size === values.length,
      `the kind table's row for ${position} is not one value of each kind ` +
        "7 does not admit there (the boolean both ways where 7 admits a " +
        "list or an object)",
    );
  }
  const positionsWhere = (held: (shape: ShapeSchema) => boolean): string[] =>
    shapes.filter(held).map((shape) => shape.position);
  need(
    sameMembers(
      positionsWhere((shape) => shape.values !== undefined),
      T763_ENUMERATED_POSITIONS,
    ),
    "7's shape enumerates at other positions than T7.6-3 lists",
  );
  need(
    sameMembers(
      shapesWithin(CONFIG_SHAPE)
        .filter((shape) => shape.fields !== undefined)
        .map((shape) => shape.position),
      T763_UNKNOWN_KEY_POSITIONS,
    ),
    "7's fixed-key objects are not the objects T7.6-3 stages an unknown key in",
  );
  for (const shape of shapesWithin(CONFIG_SHAPE)) {
    if (shape.fields === undefined) continue;
    const listed =
      T763_REQUIRED_KEYS.find(
        ([position]) => position === shape.position,
      )?.[1] ?? [];
    need(
      sameMembers([...(shape.required ?? [])], listed),
      `${shape.position}'s required keys are not those T7.6-3 lists`,
    );
    need(
      !shape.fields.has(T763_UNKNOWN_KEY),
      `${T763_UNKNOWN_KEY} is a key 7 defines in ${shape.position}`,
    );
  }
  need(
    sameMembers(
      positionsWhere((shape) => shape.nonEmpty === true),
      T763_NON_EMPTY_POSITIONS,
    ),
    "7's shape forbids other lists empty than T7.6-3 lists",
  );
  const keysOf = (shape: ShapeSchema): string =>
    [...(shape.fields?.keys() ?? [])].join(",");
  need(
    keysOf(CONFIG_SHAPE) === TOP_LEVEL_KEYS.join(",") &&
      keysOf(PROFILE_SHAPE) === PROFILE_KEYS.join(",") &&
      keysOf(RULE_SHAPE) === RULE_KEYS.join(",") &&
      keysOf(SELECTOR_SHAPE) === SELECTOR_KEYS.join(",") &&
      byPosition.get("markdown") !== undefined &&
      keysOf(byPosition.get("markdown")!) === MARKDOWN_KEYS.join(","),
    "7's shape names other keys than 7 defines",
  );
  need(
    sameMembers(
      T763_SELECTOR_FORM_VIOLATIONS.map(([, selector]) =>
        [...selector.keys()].sort().join(","),
      ),
      [
        "files,group",
        "group,tags",
        "files,tags",
        "files,group,tags",
        "",
        "files,kind",
        "kind,tags",
        "kind",
      ],
    ),
    "the selector-form violations are not T7.6-3's eight",
  );
  need(
    classViolations(twin).length === 0,
    "T7.6-2(a)'s file holds a violation of the type-error class",
  );
  for (const arm of arms) {
    const found = classViolations(arm.config).map(violationKey);
    const made = arm.edits.map((edit) => violationKey(edit.violation));
    need(
      sameMembers(found, made),
      `the arm ${JSON.stringify(arm.label)} holds the violations ` +
        `${JSON.stringify(found)}, not exactly those its edits make ` +
        `${JSON.stringify(made)}`,
    );
  }
  const several = arms.filter((arm) => arm.edits.length > 1);
  need(
    several.length === 1 &&
      sameMembers(
        [...new Set(several[0]!.edits.map((edit) => edit.violation.category))],
        [
          "unknown key",
          "missing required key",
          "kind",
          "enumeration",
          "selector form",
          "empty list",
        ],
      ),
    "no one file holds a violation of each member of the class at once",
  );
  need(
    new Set(arms.map((arm) => arm.label)).size === arms.length,
    "two arms share a label",
  );
  const positionOf = new Map(
    nodes.map((node) => [JSON.stringify(node.path), node.shape.position]),
  );
  const staged = (
    position: string,
    value: ConfigValue,
    key: string | undefined,
  ): boolean =>
    arms.some((arm) =>
      arm.edits.some(
        (edit) =>
          edit.replaced !== undefined &&
          positionOf.get(JSON.stringify(edit.replaced.path)) === position &&
          (key === undefined || edit.replaced.path.at(-1) === key) &&
          describeValue(edit.replaced.value) === describeValue(value),
      ),
    );
  const spellings: readonly (readonly [string, ConfigValue, string?])[] = [
    ["specs", ["a/*.mdx"]],
    ["emit", "true"],
    ["a profile's targetTags", "a"],
    ["a rule's kinds", [true]],
    ["a selector (a rule's from or to)", "src/*.ts", "from"],
    ["a profile's mode", "Direct"],
    ["an element of a profile's edgeKinds", "depend"],
    ["an element of a rule's kinds", "depend"],
    ["an element of a profile's edgeKinds", CONTAINS],
    ["an element of a rule's kinds", CONTAINS],
  ];
  for (const [position, value, key] of spellings) {
    need(
      staged(position, value, key),
      `no arm stages TEST-SPEC's ${describeValue(value)} at ${position}` +
        (key === undefined ? "" : ` (${key})`),
    );
  }
  if (problems.length > 0) {
    throw new Error(
      `T7.6-3: the shape-violation arms drift from TEST-SPEC T7.6-3 — ` +
        `${problems.join("; ")} (TEST-SPEC T7.6-3; SPEC 7.6 Type contract, ` +
        "the type-error class): a harness defect",
    );
  }
}

checkT763Arms(T762_EVERY_KEY_AND_VALUE, T763_ARMS);

// ---------------------------------------------------------------------------
// T7.6-3's files, their module-load checks, and their S-9 records
// ---------------------------------------------------------------------------

/** T7.6-3's premise for each of its files, which a deviation breaks. */
const T763_PREMISE =
  "each of T7.6-3's files is T7.6-2(a)'s file with exactly the violations " +
  "of 7.6's type-error class its arm names applied, and a covered file " +
  "(TEST-SPEC T7.6-3; SPEC 7.6 Covered files, Type contract)";

/** How T7.6-3's files are rendered: as T7.6-2(a)'s, the specifier aside. */
function t763Rendering(name: string): ConfigRendering {
  return {
    specifier: name,
    binding: "defineConfig",
    keys: "identifiers",
    comments: false,
  };
}

/**
 * The file `arm` stages beside the placement `name` — rendered as its twin
 * is, then read back at module load (module header); a deviation throws.
 */
function composeT763File(arm: T763Arm, name: string): string {
  const what = `T7.6-3 (${arm.label}, importing ${JSON.stringify(name)})`;
  const problem = deviation("T7.6-3", what, T763_PREMISE);
  const text = renderConfiguration(arm.config, t763Rendering(name));
  if (text.includes(BACKSLASH)) problem("spells a backslash");
  if (scanComments(text).length > 0) problem("carries a comment");
  const read = readBack(text, problem);
  if (
    read.specifier !== name ||
    read.specifierSpelling !== JSON.stringify(name)
  ) {
    problem(`spells its specifier ${read.specifierSpelling}, not exactly N`);
  }
  if (read.binding !== "defineConfig") {
    problem(`binds defineConfig to ${read.binding}`);
  }
  if (!sameValue(read.argument, arm.config)) {
    problem("reads back as another configuration than the one rendered");
  }
  if (read.keys.some((key) => key.stringLiteral)) {
    problem("spells a key as a string literal, which its twin does not");
  }
  return text;
}

/** T7.6-2(a)'s file: T7.6-3's twin, its records shared with T7.6-2. */
const T763_TWIN: T762File = (() => {
  const twin = T762_FILES.find((file) => file.arm === "(a)");
  if (twin === undefined) {
    throw new Error("T7.6-3: T7.6-2 holds no (a) file: a harness defect");
  }
  for (const name of CANONICAL_MODULE_NAMES) {
    const text = renderConfiguration(
      T762_EVERY_KEY_AND_VALUE,
      t763Rendering(name),
    );
    if (twin.records.get(name)?.ts.source !== text) {
      throw new Error(
        `T7.6-3: T7.6-2(a)'s record importing ${JSON.stringify(name)} holds ` +
          "other bytes than T7.6-3's arms are rendered beside: the twin is " +
          "the same file without the violation (TEST-SPEC T7.6-3): a " +
          "harness defect",
      );
    }
  }
  return twin;
})();

/** One of T7.6-3's files, with its records for each candidate N. */
interface T763File {
  /** Names the file in every diagnosis. */
  readonly label: string;
  readonly records: ReadonlyMap<string, T762Records>;
}

/**
 * T7.6-3's files, each rendered and read back for each canonical-name
 * candidate at module load, each rendering a staged-source record (S-9),
 * judged as plain TypeScript and, for the `.tsx` name, as TSX; no two alike,
 * and none its twin.
 */
const T763_FILES: readonly T763File[] = (() => {
  const files = T763_ARMS.map((arm) => {
    const records = new Map<string, T762Records>();
    for (const name of CANONICAL_MODULE_NAMES) {
      const text = composeT763File(arm, name);
      const record = `T7.6-3 ${arm.label}, importing ${JSON.stringify(name)}`;
      records.set(name, {
        ts: stagedTs(record, text),
        tsx: stagedTs(`${record}, as TSX`, text, "well-formed", "tsx"),
      });
    }
    return { label: arm.label, records };
  });
  for (const name of CANONICAL_MODULE_NAMES) {
    const texts = new Set([
      T763_TWIN.records.get(name)?.ts.source,
      ...files.map((file) => file.records.get(name)?.ts.source),
    ]);
    if (texts.size !== files.length + 1) {
      throw new Error(
        `T7.6-3: two of its files importing ${JSON.stringify(name)}, or one ` +
          "and its twin, hold the same bytes: a harness defect",
      );
    }
  }
  return files;
})();

// ---------------------------------------------------------------------------
// T7.6-3's body
// ---------------------------------------------------------------------------

/** The bytes of `file`'s record for the placement's N. */
function textFor(file: T762File | T763File, name: string): string {
  const records = file.records.get(name);
  if (records === undefined || typeof records.ts.source !== "string") {
    throw new Error(
      `TEST-SPEC §7.6: no record holds ${file.label} beside N ` +
        `${JSON.stringify(name)}; the canonical N is one of ` +
        `${CANONICAL_MODULE_NAMES.join(", ")} (helpers/module-channel.ts ` +
        "canonicalModuleName): a harness defect",
    );
  }
  return records.ts.source;
}

/** How many failed arms a diagnosis spells out in full. */
const FAILURES_IN_FULL = 3;

/** T7.6-3's body (module header). */
async function runShapeViolations(product: ProductBinding): Promise<void> {
  let judged = 0;
  for (const project of PROJECT_KINDS) {
    const context = `T7.6-3 (shape violations), the ${project} project`;
    const staging = await ModuleStaging.create(product, context);
    try {
      await staging.stageProject(PROJECT_DIR, project);
      const placement = await staging.placeCanonical(
        PROJECT_DIR,
        TYPE_CHECKING_ARM,
      );
      const request = {
        staging,
        directory: PROJECT_DIR,
        project,
        placement,
        alone: true,
        context,
      };
      const twinLabel = T763_TWIN.label;
      const twins = await stageCoveredFiles({
        ...request,
        files: [{ label: twinLabel, text: textFor(T763_TWIN, placement.name) }],
      });
      let arms: CoveredFiles | undefined;
      for (const setup of twins.setups) {
        const [twin] = twins.judge(setup);
        if (twin === undefined) throw new Error("unreachable: one verdict");
        assertTypeChecks(
          twin,
          `${context}: no shape-violation arm counts in ${setup.label}, ` +
            `beside the canonical placement ${placement.path}, unless its ` +
            "valid twin type-checks there (TEST-SPEC §7.6 Pairing), so the " +
            "body stops at the first setup where the twin does not, after " +
            `${count(judged, "setup")} where every arm failed to type-check`,
        );
        arms ??= await stageCoveredFiles({
          ...request,
          files: T763_FILES.map((file) => ({
            label: file.label,
            text: textFor(file, placement.name),
          })),
        });
        const verdicts = arms.judge(setup);
        const failed: string[] = [];
        const inFull: string[] = [];
        for (const verdict of verdicts) {
          try {
            assertShapeViolation(twin, verdict, context);
          } catch (error) {
            if (!(error instanceof HarnessAssertionError)) throw error;
            failed.push(verdict.label);
            if (inFull.length < FAILURES_IN_FULL) inFull.push(error.message);
          }
        }
        if (failed.length > 0) {
          fail(
            `${context}: ${count(failed.length, "shape-violation arm")} of ` +
              `${String(verdicts.length)} do not fail to type-check in ` +
              `${setup.label}, beside the canonical placement ` +
              `${placement.path}, while their valid twin, ${twinLabel}, ` +
              "type-checks there — the first covered setup where any arm " +
              "does not fail to type-check, after " +
              `${count(judged, "setup")} where every arm did; the body stops ` +
              "here (TEST-SPEC T7.6-3: each " +
              "file holding a violation of 7.6's type-error class fails to " +
              "type-check in every covered setup, paired with its valid twin; " +
              "SPEC 7.6 Type contract, shape violations). The arms: " +
              `${failed.join(" | ")}. The first ` +
              `${count(inFull.length, "failure")} in full: ${inFull.join(" || ")}`,
          );
        }
        judged += 1;
      }
    } finally {
      await staging.dispose();
    }
  }
  if (judged !== COVERED_SETUP_COUNT) {
    throw new Error(
      `T7.6-3: ${String(judged)} covered setups judged, not TEST-SPEC ` +
        `§7.6's ${String(COVERED_SETUP_COUNT)}; no setup is sampled away: ` +
        "a harness defect",
    );
  }
}

const T7_6_3 = defineProductTest({
  id: "T7.6-3",
  title:
    "each arm, T7.6-2(a)'s file with one violation of 7.6's type-error " +
    "class applied, fails to type-check in all 173 covered setups beside " +
    "the canonical placement, paired with (a) type-checking in the same " +
    "setup: an unknown key in each fixed-key object (the top level, " +
    "markdown, each profile, each rule, and each selector); each required " +
    "key missing from each object requiring it; at every value of (a)'s " +
    "file, each kind among a boolean (both values where a list or an object " +
    "belongs), a string, a list, and an object that 7 does not admit there, " +
    "and kinds: [true]; at every enumerated value, two near misses of it " +
    "(Direct and depend among them), and contains at each element of an " +
    "edgeKinds and of a rule's kinds; each selector-form violation at each " +
    "selector; each list 7.4 and 7.5 forbid empty, emptied; and one file " +
    "holding a violation of each member of the class at once (SPEC 7.6 " +
    "Type contract, shape violations; TEST-SPEC §7.6 Pairing)",
  run: runShapeViolations,
});

// ---------------------------------------------------------------------------
// T7.6-4's files: the canonical runs' files beside any N (section-7.6-ii.ts)
// ---------------------------------------------------------------------------

/** One file a placement's type-checking runs stage: its label and bytes. */
export interface PlacementFile {
  /** Names the file in every diagnosis; unique among the three. */
  readonly label: string;
  readonly text: string;
}

/**
 * The files of the runs each of T7.6-4's placements stands in for the
 * canonical one in, beside one N (TEST-SPEC T7.6-4): T7.6-1's, T7.6-2(a)'s,
 * and T7.6-3's unknown-top-level-key arm's.
 */
export interface PlacementFiles {
  /** T7.6-1's covered file: T7.6-2(d)'s, the minimal configuration. */
  readonly declaredExports: PlacementFile;
  /** T7.6-2(a)'s file: the unknown-top-level-key arm's valid twin. */
  readonly valid: PlacementFile;
  /** T7.6-3's arm: (a)'s file with an unknown key at its top level. */
  readonly unknownKey: PlacementFile;
}

/** T7.6-2's file lettered `letter`, or a harness defect. */
function t762Arm(letter: string): T762Arm {
  const arm = T762_ARMS.find((candidate) => candidate.arm === letter);
  if (arm === undefined) {
    throw new Error(
      `T7.6-4: T7.6-2 holds no ${letter} file, which T7.6-4's placements ` +
        "stage: a harness defect",
    );
  }
  return arm;
}

/** T7.6-3's arm with an unknown key at the top level, and its own files. */
const T763_UNKNOWN_TOP_LEVEL_KEY: {
  readonly arm: T763Arm;
  readonly file: T763File;
} = (() => {
  const arm = T763_ARMS.find(
    (candidate) =>
      candidate.edits.length === 1 &&
      candidate.edits[0]?.violation.category === "unknown key" &&
      candidate.edits[0].violation.path.length === 1,
  );
  const file = T763_FILES.find((candidate) => candidate.label === arm?.label);
  if (arm === undefined || file === undefined) {
    throw new Error(
      "T7.6-4: T7.6-3 holds no arm with an unknown key at the top level " +
        "alone, which T7.6-4's placements pair with T7.6-2(a)'s file: a " +
        "harness defect",
    );
  }
  return { arm, file };
})();

/**
 * T7.6-4's three files beside the placement N `name`, a name of 7.6's
 * grammar: T7.6-1's covered file (T7.6-2(d)'s), T7.6-2(a)'s file, and
 * T7.6-3's unknown-top-level-key arm, each rendered with the specifier
 * `name` and held to everything its own test's files are held to at module
 * load (`composeFile`, `composeT763File`) — a deviation throws, a harness
 * defect. Beside a canonical candidate the bytes are those tests' own
 * records' (checked at module load below), so each placement's runs are
 * runs of T7.6-1, of T7.6-2(a), and of that arm, N aside.
 */
export function placementFiles(name: string): PlacementFiles {
  const problem = moduleNameGrammarProblem(name);
  if (problem !== null) {
    throw new Error(
      `T7.6-4: the placement N ${JSON.stringify(name)} ${problem}; a ` +
        "configuration file imports from a name of 7.6's grammar: a harness " +
        "defect",
    );
  }
  return {
    declaredExports: {
      label: `T7.6-1's covered file, ${T761_FILE.label}`,
      text: composeFile(t762Arm("(d)"), name),
    },
    valid: { label: T763_TWIN.label, text: composeFile(t762Arm("(a)"), name) },
    unknownKey: {
      label: `T7.6-3's arm, ${T763_UNKNOWN_TOP_LEVEL_KEY.arm.label}`,
      text: composeT763File(T763_UNKNOWN_TOP_LEVEL_KEY.arm, name),
    },
  };
}

for (const name of CANONICAL_MODULE_NAMES) {
  const files = placementFiles(name);
  const own: readonly (readonly [PlacementFile, T762File | T763File])[] = [
    [files.declaredExports, T761_FILE],
    [files.valid, T763_TWIN],
    [files.unknownKey, T763_UNKNOWN_TOP_LEVEL_KEY.file],
  ];
  for (const [file, recorded] of own) {
    if (file.text !== textFor(recorded, name)) {
      throw new Error(
        `T7.6-4: ${file.label} beside ${JSON.stringify(name)} holds other ` +
          `bytes than its own test's record (${recorded.label}): each ` +
          "placement stands in for the canonical one in a run of T7.6-1, " +
          "of T7.6-2(a), and of T7.6-3's unknown-top-level-key arm (TEST-SPEC " +
          "T7.6-4): a harness defect",
      );
    }
  }
}

export const section76Tests: readonly ProductTestEntry[] = [
  T7_6_1,
  T7_6_2,
  T7_6_3,
];
