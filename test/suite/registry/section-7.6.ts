// TEST-SPEC §7.6 (the `defineConfig` module): T7.6-2, valid configurations.
// The rest of §7.6 — T7.6-1, T7.6-3 through T7.6-7 — and P-17 and P-18 are
// not registered yet.
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

import ts from "typescript-5.9.3";
import { fail, HarnessAssertionError } from "../../helpers/assertions.js";
import {
  CANONICAL_MODULE_NAMES,
  ModuleStaging,
  PROJECT_KINDS,
  TYPE_CHECKING_ARM,
} from "../../helpers/module-channel.js";
import {
  assertTypeChecks,
  COVERED_SETUP_COUNT,
  stageCoveredFiles,
} from "../../helpers/module-channel-ts.js";
import type { CoveredVerdict } from "../../helpers/module-channel-ts.js";
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
        `T7.6-2: the key ${JSON.stringify(key)} is repeated in one object ` +
          "of a staged configuration (SPEC 7: a key repeated within one " +
          "object literal is a configuration error)",
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
      `T7.6-2: the key ${JSON.stringify(key)} cannot be spelled as an ` +
        "identifier with ASCII characters alone",
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

/** A thrower naming the file and the rules a deviation breaks. */
function deviation(what: string): (detail: string) => never {
  return (detail) => {
    throw new Error(
      `T7.6-2: the staged covered file ${what} ${detail} — each of ` +
        "T7.6-2's files is valid under 7 and a covered file (TEST-SPEC " +
        "T7.6-2; SPEC 7, 7.6 Covered files): a harness defect",
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
 * to that binding whose one argument is an object literal of 7's form.
 */
function readBack(text: string, what: string): ReadBack {
  const problem = deviation(what);
  const source = ts.createSourceFile(
    "t7.6-2-covered-file.ts",
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
  const problem = deviation(what);
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
  const read = readBack(text, what);
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
  /** Names the file in every diagnosis. */
  readonly label: string;
  readonly records: ReadonlyMap<string, T762Records>;
}

/**
 * T7.6-2's files, each rendered and checked for each canonical-name
 * candidate at module load, each rendering a staged-source record (S-9),
 * judged as plain TypeScript and, for the `.tsx` name, as TSX.
 */
const T762_FILES: readonly T762File[] = T762_ARMS.map((arm) => {
  const records = new Map<string, T762Records>();
  for (const name of CANONICAL_MODULE_NAMES) {
    const text = composeFile(arm, name);
    const record = `T7.6-2 ${arm.arm} ${arm.what}, importing ${JSON.stringify(name)}`;
    records.set(name, {
      ts: stagedTs(record, text),
      tsx: stagedTs(`${record}, as TSX`, text, "well-formed", "tsx"),
    });
  }
  return { label: `T7.6-2${arm.arm} (${arm.what})`, records };
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

export const section76Tests: readonly ProductTestEntry[] = [T7_6_2];
