// TEST-SPEC §16 P-18 (type contract over generated configurations).
//
// One registered product-facing property test (C-2 "one code path") over
// SPEC 7.6's type contract: a covered file valid under 7 type-checks in
// every covered setup, whatever spelling it carries, and one holding a
// violation of 7.6's type-error class does not. T7.6-2 and T7.6-3 anchor
// the property (section-7.6.ts: every key, field, and enumerated value, an
// aliased binding, string-literal keys, comments, the minimal file, the
// global `Object` interface's members and `__proto__` as names, the empty,
// omitted, and repeated forms, and 430 single-violation edits of (a)'s
// file); this module searches the configurations they never stage. A
// seeded, reproducible generator (helpers/property.ts, H-10; the fixed
// seed set in CI, E-5) draws, per trial (`genP18Draw`):
//
//   * a configuration valid under 7 by construction (`genP18Argument`):
//     zero to three spec groups and, at even odds or so, a `code` map of
//     zero to three code groups, a code group's name drawn now and then
//     among the spec groups' so that a name is both kinds'; each group's
//     glob list empty or not; `markdown`, `coverage`, and `policy` each
//     present or absent, `markdown` with `emit` either boolean and `outDir`
//     present or absent; up to two profiles, each optional field present or
//     absent, and up to three rules, their selectors in each of 7.5's forms,
//     `kinds` present or absent; every reference resolving (a profile's
//     `target` a spec group, its `boundary` and a selector's `group` any
//     group), every kind given where a name is both a spec and a code
//     group's and drawn present or absent elsewhere (and then the name's
//     own), group names distinct within each map, profile names distinct
//     among the profiles and rule names among the rules; each list 7.4 and
//     7.5 read as a set (`targetTags`, `edgeKinds`, a rule's `kinds`, a
//     selector's `tags`) drawn with repeated elements or without;
//   * group, profile, and rule names (`genP18Name`) drawn from identifier
//     spellings (P18_IDENTIFIER_NAMES, reserved words and non-ASCII letters
//     among them), from non-identifier spellings (`genNonIdentifierName`:
//     runs of ASCII punctuation, spaces, digits, letters, non-ASCII
//     characters, an astral one among them, and control characters), and,
//     weighted toward them, the seven members of TypeScript's global
//     `Object` interface and `__proto__` — never a backslash, a quote, a
//     line terminator, or U+FFFD (P18_FORBIDDEN_IN_STRINGS); a name drawn
//     twice where 7 requires distinct names is mended by a suffix;
//   * every object's key order (a drawn permutation of its keys), and per
//     key its spelling: an identifier where the key is an identifier name
//     by TypeScript's reading, drawn against a string literal, and a string
//     literal otherwise;
//   * `defineConfig`'s binding (`genP18Binding`): unaliased, or an alias
//     drawn among names strict module code admits as a binding
//     (P18_ALIAS_NAMES: contextual keywords, global names, `__`-prefixed
//     names, non-ASCII ones, and `defineConfig` itself), never `require`,
//     `exports`, or a name SPEC 6.5's first rule bars (section-7.6.ts
//     `BARRED_BINDINGS`);
//   * comments between tokens: a density per draw — none, sparse, or
//     dense — and in each gap between two tokens of the file, before the
//     first and after the last included, none, one, or two line or block
//     comments, their bodies runs of P18_COMMENT_ALPHABET — no `@`, `/`,
//     `*`, backslash, or line terminator — so that none is a directive or
//     pragma, none begins `///`, and none closes early;
//   * a covered setup of 7.6's matrix (helpers/module-channel-ts.ts
//     `COVERED_SETUPS`), its option set's kind drawn first, as P-17 draws
//     it (the initialized-project set's 5 setups a quarter of the time);
//   * and one violation of 7.6's type-error class (`genP18Mutation`): its
//     member drawn among those the draw has a position for, its position
//     among the draw's — every fixed-key object for an unknown key, every
//     required key present for a missing one, every value at a position 7
//     gives a kind for a kind, every enumerated value for an enumeration,
//     every selector for a selector form, every set-read list for an empty
//     list, and, for the last three, an optional field the draw omits,
//     added (outside a selector, where adding a field changes its form) —
//     and its offending value drawn: the unknown key's name
//     (P18_UNKNOWN_KEYS, the `Object` members and `__proto__` among them,
//     less the object's own fields), value, spelling, and place among the
//     object's keys; a value of a kind 7 does not admit there, from T7.6-3's
//     kind table (section-7.6.ts `T763_KIND_TABLE`) or drawn; a string
//     outside the position's enumeration — near misses, other
//     enumerations' members, `"contains"` for an edge kind, the empty
//     string; a selector in one of T7.6-3's eight form violations, its
//     names resolving; or the empty list. The mutant is the draw with that
//     one edit, its spellings and comments elsewhere unchanged.
//
// The generator holds each draw to its premise before returning it: the
// harness's own reading of 7 over the data finds the draw valid
// (section-7.6.ts `problemsUnder7`), its reading of the type-error class
// finds no violation in the draw and exactly the drawn one in the mutant
// (`classViolations`); a deviation is a harness defect, thrown and reported
// with the seed (H-10). Each draw's two files — the draw and its mutant,
// each rendered beside each candidate canonical N (helpers/module-channel.ts
// `CANONICAL_MODULE_NAMES`) — are read back with the harness's TypeScript
// as 7.6's covered-file conditions require (section-7.6.ts `readBack`: an
// import of `defineConfig` by that identifier bound to the drawn binding,
// the specifier exactly N, a default export of one call whose argument
// reads back equal to the data, each key spelled as drawn, no backslash
// anywhere, and exactly the drawn comments, none carrying `@` or beginning
// `///`), and checked well-formed under the grammar the drawn setup's
// extension selects before TypeScript judges them (S-9; §16's preamble:
// `drawSources`, a failing draw a harness error reported with its seed).
// Reading back as its data, which holds no key twice in one object, no
// mutant carries beside its violation an error every `defineConfig` type
// meets (a repeated key, a syntax error): the composition residual
// CERTIFICATIONS.md's exclusions name for T7.6-3's edits and P-18's
// mutants.
//
// The body checks the package directory first (none given fails diagnosed
// before any draw, declining shrinking: H-8, S-7); then each draw runs in a
// fresh staging (H-1) holding the drawn setup's project kind in its project
// directory beside the canonical placement and nothing else (TEST-SPEC §7.6
// Placement, Reach verified for each written file), where the draw and its
// mutant are written under the drawn setup's extension and judged in one
// program in the drawn setup (helpers/module-channel-ts.ts, which falls
// back to a program per file where the batch is unsound): the draw
// type-checks (`assertTypeChecks`, T7.6-2's assertion) and the mutant fails
// to type-check paired with it (`assertShapeViolation`, T7.6-3's; where the
// draw does not type-check, the mutant counts nowhere: §7.6 Pairing). Both
// are judged on every draw and the draw fails once, naming each failing
// assertion; a harness error or a hang-guard kill propagates at once. A
// draw failing where nothing resolves — TypeScript resolving the import to
// no module it reads declarations from (`listExports`) — declines
// shrinking (helpers/assertions.ts): no configuration is expected to
// resolve where this one did not, and a shrink would only report an
// arbitrary counterexample. S-7's stub package, whose manifest names no
// entry, so ends P-18 at its first draw. Every other failure shrinks,
// within P18_MAX_SHRINK_EXECUTIONS draws.
//
// Conservative operationalizations (noted per H-4):
// - The placement is the canonical one throughout: P-17 searches names and
//   placements, so P-18 varies the configuration and the setup alone.
// - Globs, `outDir` values, and tags are drawn from fixed pools that 7
//   admits (P18_SPEC_GLOB_PARTS, P18_CODE_GLOB_PARTS, P18_OUT_DIRS,
//   P18_TAGS): globs inside the root and capture-free, spec globs naming
//   `.mdx` files and code globs `.ts` and `.tsx` ones, so that no file a
//   spec and a code group both match can arise; none is staged, so no
//   workspace-bound rule of 7 is reached.
// - A value replaced or added by a mutation carries no comments, its keys
//   spelled as identifiers where they can be.
//
// No certification serves the module channel (CERTIFICATIONS.md, the
// defineConfig module's tests): P-18's draws reach no class without a
// deterministic anchor whose failure is loud — T7.6-2 and T7.6-3.
// test/self/p18-fixed-seed-draws.test.ts pins what the fixed seeds reach:
// string-literal and identifier keys, each `Object` member name and
// `__proto__` as a group name, non-identifier names, an aliased binding,
// empty glob lists, repeated elements in each set-read list, line and
// block comments in the import declaration and in the argument, each
// optional key present and absent, a kind given for a name of both kinds,
// each member of the type-error class, and each project kind, covered
// extension, and option-set kind.

import ts from "typescript-5.9.3";
import { fail, HarnessAssertionError } from "../../helpers/assertions.js";
import {
  CANONICAL_MODULE_NAMES,
  modulePackageDirectory,
  ModuleStaging,
  TYPE_CHECKING_ARM,
} from "../../helpers/module-channel.js";
import {
  assertShapeViolation,
  assertTypeChecks,
  COVERED_SETUPS,
  stageCoveredFiles,
} from "../../helpers/module-channel-ts.js";
import type {
  CoveredSetup,
  OptionSetKind,
} from "../../helpers/module-channel-ts.js";
import type { Choices, DrawSource } from "../../helpers/property.js";
import { checkProperty } from "../../helpers/property.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import {
  BARRED_BINDINGS,
  classViolations,
  CONFIG_KINDS,
  configObject,
  CONTAINS,
  describeValue,
  EDGE_KINDS,
  GROUP_KINDS,
  isConfigList,
  isConfigObject,
  kindOf,
  MODES,
  nearMisses,
  OBJECT_MEMBER_NAMES,
  problemsUnder7,
  readBack,
  RULE_TYPES,
  sameValue,
  scanComments,
  shapeNodes,
  T763_KIND_TABLE,
  TARGETS,
} from "./section-7.6.js";
import type {
  ClassViolation,
  ConfigKind,
  ConfigObject,
  ConfigPath,
  ConfigValue,
  ShapeNode,
  ShapeSchema,
  ViolationCategory,
} from "./section-7.6.js";

/**
 * Trials per fixed seed (E-5): the default three seeds, each draw one
 * staging and one TypeScript program of two files.
 * test/self/p18-fixed-seed-draws.test.ts replays exactly these.
 */
export const P18_RUNS_PER_SEED = 30;

/**
 * Shrink budget, in draws (helpers/property.ts): each costs a staging and
 * one program, a fraction of a second against a conforming stand-in.
 */
const P18_MAX_SHRINK_EXECUTIONS = 96;

const LF = String.fromCodePoint(0x0a);
const BACKSLASH = String.fromCodePoint(0x5c);
const INDENT = "  ";

/** `n` and `word`, pluralized. */
function count(n: number, word: string): string {
  return `${String(n)} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * What no string of a draw holds (module header): a backslash, either
 * quote, a line terminator TypeScript's scanner ends a string literal at
 * (U+000A, U+000D, U+2028, U+2029), and U+FFFD — so that every string reads
 * the same as spelled and as TypeScript reads it, delimited by double
 * quotes, and every name is one 7 admits.
 */
export const P18_FORBIDDEN_IN_STRINGS: readonly string[] = [
  BACKSLASH,
  '"',
  "'",
  LF,
  String.fromCodePoint(0x0d),
  String.fromCodePoint(0x2028),
  String.fromCodePoint(0x2029),
  String.fromCodePoint(0xfffd),
];

/** The first forbidden character `text` holds, or undefined. */
function forbiddenIn(text: string): string | undefined {
  return P18_FORBIDDEN_IN_STRINGS.find((character) => text.includes(character));
}

/**
 * Whether TypeScript 5.9.3 reads `text` as one identifier name at ESNext:
 * an identifier start, then identifier parts, code point by code point.
 */
export function isIdentifierName(text: string): boolean {
  const [first, ...rest] = [...text].map((character) =>
    character.codePointAt(0),
  );
  return (
    first !== undefined &&
    ts.isIdentifierStart(first, ts.ScriptTarget.ESNext) &&
    rest.every(
      (codePoint) =>
        codePoint !== undefined &&
        ts.isIdentifierPart(codePoint, ts.ScriptTarget.ESNext),
    )
  );
}

// ---------------------------------------------------------------------------
// The draw's data: values with their spellings and comments (module header)
// ---------------------------------------------------------------------------

/** A comment drawn between two tokens. */
export interface P18Comment {
  readonly kind: "line" | "block";
  /** Its text, a run of P18_COMMENT_ALPHABET, rendered after a space. */
  readonly body: string;
}

/** The comments drawn in one gap between two tokens, in order. */
export type P18Gap = readonly P18Comment[];

const NO_COMMENTS: P18Gap = Object.freeze([]);

/** A value of 7's declarative form, with its spellings and comments. */
export type P18Value = P18Scalar | P18List | P18Object;

/** A string or a boolean literal. */
export interface P18Scalar {
  readonly kind: "scalar";
  readonly value: string | boolean;
}

/** An array literal. */
export interface P18List {
  readonly kind: "list";
  readonly elements: readonly P18Element[];
  /** The gap between `[` and `]` where the list is empty. */
  readonly inner: P18Gap;
}

/** One element of an array literal, with the gaps on either side of it. */
export interface P18Element {
  readonly before: P18Gap;
  readonly value: P18Value;
  /** Between the value and the comma, or `]` after the last. */
  readonly after: P18Gap;
}

/** An object literal, its members in spelling order. */
export interface P18Object {
  readonly kind: "object";
  readonly members: readonly P18Member[];
  /** The gap between `{` and `}` where the object is empty. */
  readonly inner: P18Gap;
}

/** One key and value of an object literal, with the gaps around them. */
export interface P18Member {
  readonly key: string;
  /** Spelled as a string literal; as an identifier otherwise. */
  readonly stringLiteral: boolean;
  /** Before the key: after `{`, or after the previous member's comma. */
  readonly before: P18Gap;
  /** Between the key and the colon. */
  readonly afterKey: P18Gap;
  /** Between the colon and the value. */
  readonly afterColon: P18Gap;
  readonly value: P18Value;
  /** Between the value and the comma, or `}` after the last. */
  readonly after: P18Gap;
}

/**
 * The gaps of the file outside its argument, in token order: before
 * `import`, inside the import declaration (`nameAs` and `asBinding` only
 * where the import is aliased), between the declaration and the export,
 * inside the export around the argument, and after the closing `)`.
 */
export const P18_STATEMENT_GAPS = [
  "head",
  "importBrace",
  "braceName",
  "nameAs",
  "asBinding",
  "bindingBrace",
  "braceFrom",
  "fromSpecifier",
  "between",
  "exportDefault",
  "defaultBinding",
  "bindingParen",
  "parenArgument",
  "argumentParen",
  "tail",
] as const;

export type P18StatementGap = (typeof P18_STATEMENT_GAPS)[number];

/** The gaps inside the import declaration (module header). */
export const P18_IMPORT_GAPS: readonly P18StatementGap[] = [
  "importBrace",
  "braceName",
  "nameAs",
  "asBinding",
  "bindingBrace",
  "braceFrom",
  "fromSpecifier",
];

/** A covered file: the import, then the default export of one call. */
export interface P18File {
  /** Whether the import spells `defineConfig as <binding>`. */
  readonly alias: boolean;
  /** The name `defineConfig` is bound to: itself where not aliased. */
  readonly binding: string;
  readonly gaps: Readonly<Record<P18StatementGap, P18Gap>>;
  readonly argument: P18Object;
}

/** The drawn violation, and the mutant's argument it makes. */
export interface P18Mutation {
  /** The member of the class and where it lies, as `classViolations` reads it. */
  readonly violation: ClassViolation;
  /** How a diagnosis names the edit. */
  readonly label: string;
  /** The mutant's argument: the draw's with the one edit. */
  readonly argument: P18Object;
}

/** One trial (module header). */
export interface P18Draw {
  /** The valid configuration, a covered file. */
  readonly file: P18File;
  readonly mutation: P18Mutation;
  /** The covered setup, by its index in `COVERED_SETUPS`. */
  readonly setup: number;
}

/** A scalar. */
function scalar(value: string | boolean): P18Scalar {
  return { kind: "scalar", value };
}

/** A value of 7's form, as the harness's readings of 7 take it. */
export function toConfigValue(value: P18Value): ConfigValue {
  if (value.kind === "scalar") return value.value;
  if (value.kind === "list") {
    return value.elements.map((element) => toConfigValue(element.value));
  }
  return configObject(
    ...value.members.map(
      (member) => [member.key, toConfigValue(member.value)] as const,
    ),
  );
}

/** An argument as the harness's readings of 7 take it. */
export function p18Config(argument: P18Object): ConfigObject {
  const config = toConfigValue(argument);
  if (!isConfigObject(config)) {
    throw new Error("unreachable: an object reads as an object");
  }
  return config;
}

/**
 * A plain value of 7's form as a spelled one (a mutation's replacement):
 * no comments, each key an identifier where it is an identifier name.
 */
function fromConfigValue(value: ConfigValue): P18Value {
  if (typeof value === "string" || typeof value === "boolean") {
    return scalar(value);
  }
  if (isConfigList(value)) {
    return {
      kind: "list",
      elements: value.map((element) => ({
        before: NO_COMMENTS,
        value: fromConfigValue(element),
        after: NO_COMMENTS,
      })),
      inner: NO_COMMENTS,
    };
  }
  return {
    kind: "object",
    members: [...value].map(([key, member]) => plainMember(key, member)),
    inner: NO_COMMENTS,
  };
}

/** A member with no comments, its key an identifier where it can be. */
function plainMember(key: string, value: ConfigValue): P18Member {
  return {
    key,
    stringLiteral: !isIdentifierName(key),
    before: NO_COMMENTS,
    afterKey: NO_COMMENTS,
    afterColon: NO_COMMENTS,
    value: fromConfigValue(value),
    after: NO_COMMENTS,
  };
}

// ---------------------------------------------------------------------------
// Rendering (module header)
// ---------------------------------------------------------------------------

/** What separates a piece from the one before it. */
type Separator = "none" | "space" | "line" | "blank";

/** One token or comment of a rendered file. */
interface Piece {
  readonly text: string;
  readonly before: Separator;
  readonly depth: number;
  /** A comment (module header): its kind. */
  readonly comment?: "line" | "block";
}

/** A comment as rendered. */
function commentText(comment: P18Comment): string {
  return comment.kind === "line"
    ? `// ${comment.body}`
    : `/* ${comment.body} */`;
}

/** The pieces of a file, joined into its text. */
class Pieces {
  readonly #pieces: Piece[] = [];
  #forced: Separator | undefined;

  token(text: string, before: Separator, depth: number): void {
    this.#pieces.push({ text, before: this.#forced ?? before, depth });
    this.#forced = undefined;
  }

  gap(gap: P18Gap, depth: number): void {
    for (const comment of gap) {
      this.#pieces.push({
        text: commentText(comment),
        before: this.#forced ?? "space",
        depth,
        comment: comment.kind,
      });
      this.#forced = undefined;
    }
  }

  /** The next piece starts on a line of its own. */
  breakNext(separator: "line" | "blank"): void {
    this.#forced = separator;
  }

  /** Every comment rendered, in order. */
  comments(): readonly string[] {
    return this.#pieces
      .filter((piece) => piece.comment !== undefined)
      .map((piece) => piece.text);
  }

  /**
   * The text: each piece after its separator, a line comment always ending
   * its line; LF line ends, the last line terminated.
   */
  text(): string {
    let text = "";
    let breakDue = false;
    this.#pieces.forEach((piece, index) => {
      let separator = "";
      if (index > 0) {
        if (piece.before === "blank") separator = LF + LF;
        else if (breakDue || piece.before === "line") {
          separator = LF + INDENT.repeat(piece.depth);
        } else if (piece.before === "space") separator = " ";
      }
      text += separator + piece.text;
      breakDue = piece.comment === "line";
    });
    return text + LF;
  }
}

/** A string literal spelling `value` exactly, in double quotes. */
function spellString(value: string): string {
  const forbidden = forbiddenIn(value);
  if (forbidden !== undefined) {
    throw new Error(
      `P-18: the string ${JSON.stringify(value)} holds ` +
        `${JSON.stringify(forbidden)}, which no string of a draw holds ` +
        "(P18_FORBIDDEN_IN_STRINGS): a harness defect",
    );
  }
  return `"${value}"`;
}

/** A member's key as spelled. */
function spellKey(member: P18Member): string {
  if (member.stringLiteral) return spellString(member.key);
  if (!isIdentifierName(member.key)) {
    throw new Error(
      `P-18: the key ${JSON.stringify(member.key)} is spelled as an ` +
        "identifier, which TypeScript does not read it as: a harness defect",
    );
  }
  return member.key;
}

/** Push a value: a scalar's token, or a list's or an object's pieces. */
function pushValue(
  pieces: Pieces,
  value: P18Value,
  depth: number,
  before: Separator,
): void {
  if (value.kind === "scalar") {
    pieces.token(
      typeof value.value === "string"
        ? spellString(value.value)
        : String(value.value),
      before,
      depth,
    );
  } else if (value.kind === "list") pushList(pieces, value, depth, before);
  else pushObject(pieces, value, depth, before);
}

/** Push a list: scalars on its own line, anything else a line each. */
function pushList(
  pieces: Pieces,
  list: P18List,
  depth: number,
  before: Separator,
): void {
  pieces.token("[", before, depth);
  if (list.elements.length === 0) {
    pieces.gap(list.inner, depth + 1);
    pieces.token("]", list.inner.length > 0 ? "space" : "none", depth);
    return;
  }
  const multiline = list.elements.some(
    (element) => element.value.kind !== "scalar",
  );
  list.elements.forEach((element, index) => {
    if (multiline) pieces.breakNext("line");
    pieces.gap(element.before, depth + 1);
    pushValue(
      pieces,
      element.value,
      depth + 1,
      index === 0 && !multiline ? "none" : "space",
    );
    pieces.gap(element.after, depth + 1);
    if (index < list.elements.length - 1) pieces.token(",", "none", depth + 1);
  });
  if (multiline) pieces.breakNext("line");
  pieces.token("]", "none", depth);
}

/** Push an object: each member on a line of its own. */
function pushObject(
  pieces: Pieces,
  object: P18Object,
  depth: number,
  before: Separator,
): void {
  pieces.token("{", before, depth);
  if (object.members.length === 0) {
    pieces.gap(object.inner, depth + 1);
    pieces.token("}", object.inner.length > 0 ? "space" : "none", depth);
    return;
  }
  object.members.forEach((member, index) => {
    pieces.breakNext("line");
    pieces.gap(member.before, depth + 1);
    pieces.token(spellKey(member), "space", depth + 1);
    pieces.gap(member.afterKey, depth + 1);
    pieces.token(":", "none", depth + 1);
    pieces.gap(member.afterColon, depth + 1);
    pushValue(pieces, member.value, depth + 1, "space");
    pieces.gap(member.after, depth + 1);
    if (index < object.members.length - 1) {
      pieces.token(",", "none", depth + 1);
    }
  });
  pieces.breakNext("line");
  pieces.token("}", "none", depth);
}

/** A rendered file, with every comment it renders, in order. */
export interface P18Rendering {
  readonly text: string;
  readonly comments: readonly string[];
}

/**
 * `file` rendered with `argument` as its argument, importing from
 * `specifier` (module header): the import declaration, a blank line, the
 * default export; every gap's comments where the file draws them.
 */
export function renderP18File(
  file: P18File,
  argument: P18Object,
  specifier: string,
): P18Rendering {
  const pieces = new Pieces();
  const gaps = file.gaps;
  pieces.gap(gaps.head, 0);
  pieces.breakNext("line");
  pieces.token("import", "line", 0);
  pieces.gap(gaps.importBrace, 0);
  pieces.token("{", "space", 0);
  pieces.gap(gaps.braceName, 0);
  pieces.token("defineConfig", "space", 0);
  if (file.alias) {
    pieces.gap(gaps.nameAs, 0);
    pieces.token("as", "space", 0);
    pieces.gap(gaps.asBinding, 0);
    pieces.token(file.binding, "space", 0);
  } else if (gaps.nameAs.length > 0 || gaps.asBinding.length > 0) {
    throw new Error(
      "P-18: an unaliased import draws comments around an alias it does " +
        "not spell: a harness defect",
    );
  }
  pieces.gap(gaps.bindingBrace, 0);
  pieces.token("}", "space", 0);
  pieces.gap(gaps.braceFrom, 0);
  pieces.token("from", "space", 0);
  pieces.gap(gaps.fromSpecifier, 0);
  pieces.token(spellString(specifier), "space", 0);
  pieces.gap(gaps.between, 0);
  pieces.breakNext("blank");
  pieces.token("export", "blank", 0);
  pieces.gap(gaps.exportDefault, 0);
  pieces.token("default", "space", 0);
  pieces.gap(gaps.defaultBinding, 0);
  pieces.token(file.binding, "space", 0);
  pieces.gap(gaps.bindingParen, 0);
  pieces.token("(", "none", 0);
  pieces.gap(gaps.parenArgument, 0);
  pushObject(pieces, argument, 0, "none");
  pieces.gap(gaps.argumentParen, 0);
  pieces.token(")", "none", 0);
  pieces.gap(gaps.tail, 0);
  return { text: pieces.text(), comments: pieces.comments() };
}

// ---------------------------------------------------------------------------
// The generator's pools (module header)
// ---------------------------------------------------------------------------

/** A character from its code point. */
function cp(codePoint: number): string {
  return String.fromCodePoint(codePoint);
}

/**
 * Identifier spellings of names (module header): ASCII identifiers, reserved
 * words (identifier names all the same, as keys), and non-ASCII letters
 * Unicode has held since its first versions.
 */
export const P18_IDENTIFIER_NAMES: readonly string[] = [
  "app",
  "tests",
  "product",
  "docs",
  "a",
  "B",
  "_x",
  "$y",
  "a1",
  "ab_$9",
  "default",
  "class",
  "new",
  "import",
  "await",
  "yield",
  `caf${cp(0xe9)}`,
  cp(0x3c0),
  `${cp(0x4e2d)}${cp(0x6587)}`,
  `${cp(0x416)}x`,
];

/**
 * A non-identifier name's first character (module header): none an
 * identifier's start — ASCII punctuation and the space, digits, non-ASCII
 * characters (U+00A0, U+00B7, the astral U+1F600, U+FEFF, U+200B, U+0085),
 * and control characters (U+0001, U+0009, U+001F, U+007F, U+0000).
 */
export const P18_NON_IDENTIFIER_LEADS: readonly string[] = [
  ..." -./*@#!?+,;:=<>()[]{}|~^%&`",
  ..."0123456789",
  cp(0xa0),
  cp(0xb7),
  cp(0x1f600),
  cp(0xfeff),
  cp(0x200b),
  cp(0x85),
  cp(0x01),
  cp(0x09),
  cp(0x1f),
  cp(0x7f),
  cp(0x00),
];

/** A non-identifier name's later characters, by class. */
const NON_IDENTIFIER_RUN: ReadonlyArray<readonly [number, readonly string[]]> =
  [
    [4, [..."abcxyzABZ"]],
    [2, [..."0123456789"]],
    [3, P18_NON_IDENTIFIER_LEADS],
    [1, ["_", "$", cp(0xe9), cp(0x3c0)]],
  ];

/** Spec globs' parts (module header): directories, then a file pattern. */
export const P18_SPEC_GLOB_PARTS = {
  directories: ["specs", "docs", "a", "**", "*", "x?", ".hidden", "s-1"],
  files: ["*.mdx", "a.mdx", "?.mdx", "*-x.mdx", "index.mdx"],
} as const;

/** Code globs' parts (module header). */
export const P18_CODE_GLOB_PARTS = {
  directories: ["src", "test", "lib", "**", "*", "y?", ".gen", "c_2"],
  files: ["*.ts", "*.tsx", "index.ts", "?.ts", "*.test.ts"],
} as const;

/** One pool of glob parts. */
interface GlobParts {
  readonly directories: readonly string[];
  readonly files: readonly string[];
}

/** `markdown.outDir` values (module header): each of 7.3's form. */
export const P18_OUT_DIRS: readonly string[] = [
  "docs",
  "out/md",
  "build",
  "a/b/c",
  ".site",
  "md-out",
  "_x",
];

/** Tags (module header), for `targetTags` and a selector's `tags`. */
export const P18_TAGS: readonly string[] = [
  "core",
  "edge",
  "a",
  "b.c",
  "x-1",
  "ui_2",
  "T",
];

/**
 * An unknown key's names (module header): near misses of 7's keys, keys of
 * other objects of 7's, and the `Object` members and `__proto__`; each
 * object draws among those that are none of its own fields.
 */
export const P18_UNKNOWN_KEYS: readonly string[] = [
  "extra",
  "Specs",
  "spec",
  "groups",
  "name",
  "kind",
  "group",
  "type",
  "emits",
  "outdir",
  "boundarykind",
  "edgeKind",
  "files",
  "tags",
  "from",
  "to",
  "mode",
  "markdown",
  "version",
  "$schema",
  "target-tags",
  "edge kinds",
  ...OBJECT_MEMBER_NAMES,
];

/**
 * Aliases `defineConfig` may be bound to (module header): names strict
 * module code admits as a binding — contextual keywords, global names,
 * `__`-prefixed names, non-ASCII ones, `defineConfig` itself — none of
 * `BARRED_BINDINGS` (`require`, `exports`, and SPEC 6.5's first rule).
 */
export const P18_ALIAS_NAMES: readonly string[] = [
  "configure",
  "d",
  "_",
  "$",
  "defineConfig",
  "define",
  "undefined",
  "string",
  "async",
  "type",
  "as",
  "from",
  "of",
  "get",
  "set",
  "declare",
  "module",
  "namespace",
  "global",
  "Object",
  "Promise",
  "globalThis",
  "React",
  "escape",
  "Iterator",
  "__proto__",
  "constructor",
  "toString",
  "__esModule",
  "__awaiter",
  cp(0x3c0),
  `d${cp(0xe9)}finir`,
  "x9",
];

/**
 * Comment bodies' characters (module header): no `@`, so no directive or
 * pragma; no `/` or `*`, so no `///` line and no early close; no backslash
 * and no line terminator.
 */
export const P18_COMMENT_ALPHABET: readonly string[] = [
  ..."abcdefghijklmnopqrstuvwxyzABCXYZ0123456789",
  " ",
  " ",
  " ",
  ..."-.,;:!?()[]{}<>=+#$%&~^|`",
  "'",
  '"',
  cp(0xe9),
  cp(0x3c0),
  cp(0x4e2d),
];

/** Strings a mutation's free values hold (module header). */
const LOOSE_STRINGS: readonly string[] = [
  "",
  "x",
  "true",
  "specs/**/*.mdx",
  "src/*.ts",
  "direct",
  "app",
  "a b",
];

/** Keys a mutation's free objects hold. */
const LOOSE_KEYS: readonly string[] = [
  "name",
  "group",
  "x",
  "emit",
  "glob",
  "kind",
];

/** Every value 7 enumerates, at any position. */
const ENUMERATED_VALUES: readonly string[] = [
  ...TARGETS,
  ...GROUP_KINDS,
  ...MODES,
  ...RULE_TYPES,
  ...EDGE_KINDS,
];

/**
 * T7.6-3's selector-form violations (module header), each by the keys it
 * carries: each two of `group`, `files`, and `tags`, all three, none, and
 * `kind` without `group` beside `files`, beside `tags`, and alone.
 */
const SELECTOR_FORM_VIOLATIONS: ReadonlyArray<
  readonly [form: string, keys: readonly string[]]
> = [
  ["group and files", ["group", "files"]],
  ["group and tags", ["group", "tags"]],
  ["files and tags", ["files", "tags"]],
  ["group, files, and tags", ["group", "files", "tags"]],
  ["none of group, files, and tags", []],
  ["kind beside files", ["files", "kind"]],
  ["kind beside tags", ["tags", "kind"]],
  ["kind alone", ["kind"]],
];

// ---------------------------------------------------------------------------
// The generator (module header): simplest outcomes first, for shrinking
// ---------------------------------------------------------------------------

/** The draws one trial makes, and its comment density. */
interface Drawing {
  readonly choices: Choices;
  /** How likely a gap holds comments: 0 draws none at all. */
  readonly density: number;
}

/** A comment: its kind, then its body. */
function genComment(choices: Choices): P18Comment {
  const kind = choices.boolean(0.5) ? "line" : "block";
  const length = choices.intInclusive(0, 12);
  let body = "";
  for (let index = 0; index < length; index += 1) {
    body += choices.pick(P18_COMMENT_ALPHABET);
  }
  return { kind, body };
}

/** A gap's comments: none, one, or two. */
function genGap(drawing: Drawing): P18Gap {
  const { choices, density } = drawing;
  if (density === 0 || !choices.boolean(density)) return NO_COMMENTS;
  const comments = [genComment(choices)];
  if (choices.boolean(0.3)) comments.push(genComment(choices));
  return comments;
}

/** `items` in a drawn order, the given order the simplest. */
function genOrder<T>(choices: Choices, items: readonly T[]): T[] {
  const remaining = [...items];
  const ordered: T[] = [];
  while (remaining.length > 0) {
    const index =
      remaining.length === 1
        ? 0
        : choices.intInclusive(0, remaining.length - 1);
    ordered.push(remaining.splice(index, 1)[0]!);
  }
  return ordered;
}

/** A list of `values`, each element with its gaps. */
function genListOf(drawing: Drawing, values: readonly P18Value[]): P18List {
  const elements = values.map((value) => ({
    before: genGap(drawing),
    value,
    after: genGap(drawing),
  }));
  return {
    kind: "list",
    elements,
    inner: elements.length === 0 ? genGap(drawing) : NO_COMMENTS,
  };
}

/** A list of strings. */
function genStringList(drawing: Drawing, values: readonly string[]): P18List {
  return genListOf(drawing, values.map(scalar));
}

/** A member: its key's spelling, then its gaps. */
function genMember(drawing: Drawing, key: string, value: P18Value): P18Member {
  const stringLiteral = isIdentifierName(key)
    ? drawing.choices.boolean(0.4)
    : true;
  return {
    key,
    stringLiteral,
    before: genGap(drawing),
    afterKey: genGap(drawing),
    afterColon: genGap(drawing),
    value,
    after: genGap(drawing),
  };
}

/** An object of `entries`, in a drawn order unless `ordered` is false. */
function genObjectOf(
  drawing: Drawing,
  entries: ReadonlyArray<readonly [string, P18Value]>,
  ordered = true,
): P18Object {
  const members = (
    ordered ? genOrder(drawing.choices, entries) : [...entries]
  ).map(([key, value]) => genMember(drawing, key, value));
  return {
    kind: "object",
    members,
    inner: members.length === 0 ? genGap(drawing) : NO_COMMENTS,
  };
}

/** A non-identifier name: a lead no identifier begins with, then a run. */
export function genNonIdentifierName(choices: Choices): string {
  let name = choices.pick(P18_NON_IDENTIFIER_LEADS);
  const length = choices.intInclusive(0, 7);
  for (let index = 0; index < length; index += 1) {
    name += choices.pick(choices.weightedPick(NON_IDENTIFIER_RUN));
  }
  return name;
}

/**
 * A group, profile, or rule name (module header): an identifier spelling,
 * an `Object` member or `__proto__` (weighted toward them), or a
 * non-identifier spelling.
 */
export function genP18Name(choices: Choices): string {
  return choices.weightedPick<(choices: Choices) => string>([
    [3, (c) => c.pick(P18_IDENTIFIER_NAMES)],
    [4, (c) => c.pick(OBJECT_MEMBER_NAMES)],
    [3, genNonIdentifierName],
  ])(choices);
}

/** A name none of `taken` holds: drawn, mended by a suffix if it is. */
function genDistinctName(choices: Choices, taken: ReadonlySet<string>): string {
  const drawn = genP18Name(choices);
  if (!taken.has(drawn)) return drawn;
  for (let suffix = 2; ; suffix += 1) {
    const mended = `${drawn}-${String(suffix)}`;
    if (!taken.has(mended)) return mended;
  }
}

/** `count` distinct names. */
function genDistinctNames(choices: Choices, count: number): string[] {
  const names: string[] = [];
  const taken = new Set<string>();
  for (let index = 0; index < count; index += 1) {
    const name = genDistinctName(choices, taken);
    taken.add(name);
    names.push(name);
  }
  return names;
}

/** A glob: up to two directory parts, then a file pattern. */
function genGlob(choices: Choices, parts: GlobParts): string {
  const depth = choices.intInclusive(0, 2);
  const segments: string[] = [];
  for (let index = 0; index < depth; index += 1) {
    segments.push(choices.pick(parts.directories));
  }
  segments.push(choices.pick(parts.files));
  return segments.join("/");
}

/** A group's glob list: empty, or up to three globs. */
function genGlobList(choices: Choices, parts: GlobParts): string[] {
  const length = choices.weightedPick([
    [2, 0],
    [4, 1],
    [2, 2],
    [1, 3],
  ]);
  return Array.from({ length }, () => genGlob(choices, parts));
}

/**
 * A list 7.4 or 7.5 reads as a set (module header): one to three distinct
 * members of `pool`, then, a third of the time, one or two of them
 * repeated at drawn places.
 */
function genSetList(choices: Choices, pool: readonly string[]): string[] {
  const remaining = [...pool];
  const distinct: string[] = [];
  const size = choices.intInclusive(1, Math.min(3, pool.length));
  for (let index = 0; index < size; index += 1) {
    distinct.push(
      remaining.splice(choices.intInclusive(0, remaining.length - 1), 1)[0]!,
    );
  }
  const values = [...distinct];
  if (choices.boolean(0.35)) {
    const repeats = choices.intInclusive(1, 2);
    for (let index = 0; index < repeats; index += 1) {
      values.splice(
        choices.intInclusive(0, values.length),
        0,
        choices.pick(distinct),
      );
    }
  }
  return values;
}

/** The configured groups' names, by kind. */
interface GroupNames {
  readonly spec: readonly string[];
  readonly code: readonly string[];
}

/** Every configured group's name, each once. */
function allGroupNames(groups: GroupNames): readonly string[] {
  return [...new Set([...groups.spec, ...groups.code])];
}

/** The kinds of the groups named `name`. */
function groupKinds(groups: GroupNames, name: string): readonly string[] {
  return GROUP_KINDS.filter((kind) =>
    (kind === "spec" ? groups.spec : groups.code).includes(name),
  );
}

/**
 * A reference to one of `among` (module header): its name, and its kind —
 * given where the name is both kinds', drawn present or absent elsewhere.
 */
function genGroupReference(
  choices: Choices,
  groups: GroupNames,
  among: readonly string[],
): { readonly name: string; readonly kind: string | undefined } {
  const name = choices.pick(among);
  const kinds = groupKinds(groups, name);
  if (kinds.length > 1) return { name, kind: choices.pick(kinds) };
  return { name, kind: choices.boolean(0.3) ? kinds[0] : undefined };
}

/** The code groups' names, a third or so shared with the spec groups. */
function genCodeNames(
  choices: Choices,
  count: number,
  specNames: readonly string[],
): string[] {
  const names: string[] = [];
  const taken = new Set<string>();
  for (let index = 0; index < count; index += 1) {
    const shareable = specNames.filter((name) => !taken.has(name));
    const name =
      shareable.length > 0 && choices.boolean(0.35)
        ? choices.pick(shareable)
        : genDistinctName(choices, taken);
    taken.add(name);
    names.push(name);
  }
  return names;
}

/** `markdown`: `emit`, and `outDir` present or absent. */
function genMarkdown(drawing: Drawing): P18Object {
  const { choices } = drawing;
  const entries: [string, P18Value][] = [["emit", scalar(choices.boolean())]];
  if (choices.boolean(0.5)) {
    entries.push(["outDir", scalar(choices.pick(P18_OUT_DIRS))]);
  }
  return genObjectOf(drawing, entries);
}

/** A profile named `name`, each optional field present or absent. */
function genProfile(
  drawing: Drawing,
  groups: GroupNames,
  name: string,
): P18Object {
  const { choices } = drawing;
  const entries: [string, P18Value][] = [
    ["name", scalar(name)],
    ["target", scalar(choices.pick(groups.spec))],
  ];
  if (choices.boolean(0.5)) {
    entries.push([
      "targetTags",
      genStringList(drawing, genSetList(choices, P18_TAGS)),
    ]);
  }
  if (choices.boolean(0.5)) {
    entries.push(["targets", scalar(choices.pick(TARGETS))]);
  }
  const boundary = genGroupReference(choices, groups, allGroupNames(groups));
  entries.push(["boundary", scalar(boundary.name)]);
  if (boundary.kind !== undefined) {
    entries.push(["boundaryKind", scalar(boundary.kind)]);
  }
  entries.push(["mode", scalar(choices.pick(MODES))]);
  if (choices.boolean(0.5)) {
    entries.push([
      "edgeKinds",
      genStringList(drawing, genSetList(choices, EDGE_KINDS)),
    ]);
  }
  return genObjectOf(drawing, entries);
}

/** A glob for a `files` selector: a spec or a code glob. */
function genSelectorGlob(choices: Choices): string {
  return genGlob(
    choices,
    choices.boolean(0.5) ? P18_CODE_GLOB_PARTS : P18_SPEC_GLOB_PARTS,
  );
}

/** A selector in one of 7.5's forms, its names resolving. */
function genSelector(drawing: Drawing, groups: GroupNames): P18Object {
  const { choices } = drawing;
  const names = allGroupNames(groups);
  const form = choices.pick(
    names.length > 0 ? ["group", "files", "tags"] : ["files", "tags"],
  );
  const entries: [string, P18Value][] = [];
  if (form === "group") {
    const reference = genGroupReference(choices, groups, names);
    entries.push(["group", scalar(reference.name)]);
    if (reference.kind !== undefined) {
      entries.push(["kind", scalar(reference.kind)]);
    }
  } else if (form === "files") {
    entries.push(["files", scalar(genSelectorGlob(choices))]);
  } else {
    entries.push([
      "tags",
      genStringList(drawing, genSetList(choices, P18_TAGS)),
    ]);
  }
  return genObjectOf(drawing, entries);
}

/** A rule named `name`, `kinds` present or absent. */
function genRule(
  drawing: Drawing,
  groups: GroupNames,
  name: string,
): P18Object {
  const { choices } = drawing;
  const entries: [string, P18Value][] = [
    ["name", scalar(name)],
    ["type", scalar(choices.pick(RULE_TYPES))],
    ["from", genSelector(drawing, groups)],
    ["to", genSelector(drawing, groups)],
  ];
  if (choices.boolean(0.5)) {
    entries.push([
      "kinds",
      genStringList(drawing, genSetList(choices, EDGE_KINDS)),
    ]);
  }
  return genObjectOf(drawing, entries);
}

/**
 * The argument (module header): a configuration valid under 7 by
 * construction, its top-level keys in a drawn order.
 */
function genP18Argument(drawing: Drawing): P18Object {
  const { choices } = drawing;
  const specNames = genDistinctNames(
    choices,
    choices.weightedPick([
      [1, 0],
      [3, 1],
      [3, 2],
      [2, 3],
    ]),
  );
  const codePresent = choices.boolean(0.6);
  const codeNames = codePresent
    ? genCodeNames(
        choices,
        choices.weightedPick([
          [1, 0],
          [3, 1],
          [2, 2],
          [1, 3],
        ]),
        specNames,
      )
    : [];
  const groups: GroupNames = { spec: specNames, code: codeNames };
  const groupMap = (names: readonly string[], parts: GlobParts): P18Object =>
    genObjectOf(
      drawing,
      names.map(
        (name) =>
          [name, genStringList(drawing, genGlobList(choices, parts))] as const,
      ),
      false,
    );
  const entries: [string, P18Value][] = [
    ["specs", groupMap(specNames, P18_SPEC_GLOB_PARTS)],
  ];
  if (codePresent)
    entries.push(["code", groupMap(codeNames, P18_CODE_GLOB_PARTS)]);
  if (choices.boolean(0.4)) entries.push(["markdown", genMarkdown(drawing)]);
  if (choices.boolean(0.5)) {
    const profiles =
      specNames.length === 0
        ? 0
        : choices.weightedPick([
            [1, 0],
            [3, 1],
            [2, 2],
          ]);
    entries.push([
      "coverage",
      genListOf(
        drawing,
        genDistinctNames(choices, profiles).map((name) =>
          genProfile(drawing, groups, name),
        ),
      ),
    ]);
  }
  if (choices.boolean(0.5)) {
    const rules = choices.weightedPick([
      [1, 0],
      [3, 1],
      [2, 2],
      [1, 3],
    ]);
    entries.push([
      "policy",
      genListOf(
        drawing,
        genDistinctNames(choices, rules).map((name) =>
          genRule(drawing, groups, name),
        ),
      ),
    ]);
  }
  return genObjectOf(drawing, entries);
}

/** `defineConfig`'s binding: unaliased, or an alias (module header). */
function genP18Binding(choices: Choices): {
  readonly alias: boolean;
  readonly binding: string;
} {
  if (!choices.boolean(0.6)) return { alias: false, binding: "defineConfig" };
  return { alias: true, binding: choices.pick(P18_ALIAS_NAMES) };
}

/** The file around `argument`: its binding, then its statement gaps. */
function genP18File(drawing: Drawing, argument: P18Object): P18File {
  const { alias, binding } = genP18Binding(drawing.choices);
  const gaps = {} as Record<P18StatementGap, P18Gap>;
  for (const gap of P18_STATEMENT_GAPS) {
    gaps[gap] =
      !alias && (gap === "nameAs" || gap === "asBinding")
        ? NO_COMMENTS
        : genGap(drawing);
  }
  return { alias, binding, gaps, argument };
}

/** The indices in `COVERED_SETUPS` of the setups of one option-set kind. */
function setupsOfKind(kind: OptionSetKind): readonly number[] {
  return COVERED_SETUPS.flatMap((setup, index) =>
    setup.optionSet.kind === kind ? [index] : [],
  );
}

/**
 * The covered setups by option-set kind (module header): the strict
 * defaults' 168, and the initialized-project set's 5, drawn a quarter of
 * the time so that the fixed seeds reach it.
 */
export const P18_STRICT_DEFAULT_SETUPS = setupsOfKind("strict defaults");
export const P18_INITIALIZED_PROJECT_SETUPS = setupsOfKind(
  "initialized-project options",
);

/** The drawn covered setup. */
export function p18Setup(draw: P18Draw): CoveredSetup {
  const setup = COVERED_SETUPS[draw.setup];
  if (setup === undefined) {
    throw new Error(
      `P-18: the draw names the covered setup ${String(draw.setup)}, which ` +
        `7.6's matrix of ${String(COVERED_SETUPS.length)} does not hold: a ` +
        "harness defect",
    );
  }
  return setup;
}

// ---------------------------------------------------------------------------
// The mutation (module header)
// ---------------------------------------------------------------------------

/** Where a value stands, as a label names it: `coverage[0].mode`. */
export function describeP18Path(path: ConfigPath): string {
  if (path.length === 0) return "the top level";
  let text = "";
  for (const segment of path) {
    if (typeof segment === "number") text += `[${String(segment)}]`;
    else if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(segment)) {
      text += text === "" ? segment : `.${segment}`;
    } else text += `[${JSON.stringify(segment)}]`;
  }
  return text;
}

/** A kind with its article. */
function aKind(kind: ConfigKind): string {
  return kind === "object" ? "an object" : `a ${kind}`;
}

/**
 * A position a kind, an enumeration, or an empty-list violation may take
 * (module header): a value of the draw, or an optional field it omits.
 */
type ValuePosition =
  | {
      readonly added: false;
      readonly path: ConfigPath;
      readonly shape: ShapeSchema;
      readonly value: ConfigValue;
    }
  | {
      readonly added: true;
      /** The fixed-key object the field is added to. */
      readonly objectPath: ConfigPath;
      readonly key: string;
      readonly shape: ShapeSchema;
      /** How many keys the object holds. */
      readonly size: number;
    };

/** A value of the draw as a position. */
function present(node: ShapeNode): ValuePosition {
  return {
    added: false,
    path: node.path,
    shape: node.shape,
    value: node.value,
  };
}

/**
 * The optional fields the draw omits whose shape `keep` admits, in every
 * fixed-key object but a selector, where adding a field changes its form.
 */
function addablePositions(
  nodes: readonly ShapeNode[],
  keep: (shape: ShapeSchema) => boolean,
): ValuePosition[] {
  const positions: ValuePosition[] = [];
  for (const node of nodes) {
    const { shape, value } = node;
    if (
      shape.fields === undefined ||
      shape.selector === true ||
      !isConfigObject(value)
    ) {
      continue;
    }
    for (const [key, field] of shape.fields) {
      if (
        value.has(key) ||
        (shape.required ?? []).includes(key) ||
        !keep(field)
      ) {
        continue;
      }
      positions.push({
        added: true,
        objectPath: node.path,
        key,
        shape: field,
        size: value.size,
      });
    }
  }
  return positions;
}

/** An object of the spelled tree, or a harness defect. */
function asP18Object(value: P18Value, path: ConfigPath): P18Object {
  if (value.kind !== "object") {
    throw new Error(
      `P-18: ${describeP18Path(path)} is no object to edit: a harness defect`,
    );
  }
  return value;
}

/** `value` with the value at `path` replaced by `edit`'s result. */
function editP18At(
  value: P18Value,
  path: ConfigPath,
  edit: (at: P18Value) => P18Value,
  walked: ConfigPath = [],
): P18Value {
  const [head, ...rest] = path;
  if (head === undefined) return edit(value);
  const here = [...walked, head];
  if (typeof head === "number") {
    if (value.kind !== "list" || head >= value.elements.length) {
      throw new Error(
        `P-18: no list element at ${describeP18Path(here)} to edit: a ` +
          "harness defect",
      );
    }
    return {
      ...value,
      elements: value.elements.map((element, index) =>
        index === head
          ? { ...element, value: editP18At(element.value, rest, edit, here) }
          : element,
      ),
    };
  }
  const object = asP18Object(value, walked);
  if (!object.members.some((member) => member.key === head)) {
    throw new Error(
      `P-18: no key at ${describeP18Path(here)} to edit: a harness defect`,
    );
  }
  return {
    ...object,
    members: object.members.map((member) =>
      member.key === head
        ? { ...member, value: editP18At(member.value, rest, edit, here) }
        : member,
    ),
  };
}

/** The argument with the value at `path` replaced by `value`. */
function replaceValue(
  argument: P18Object,
  path: ConfigPath,
  value: ConfigValue,
): P18Object {
  return asP18Object(
    editP18At(argument, path, () => fromConfigValue(value)),
    [],
  );
}

/**
 * The argument with `member` inserted as key `index` of the object at
 * `objectPath`: an empty object's comments move before it.
 */
function insertMember(
  argument: P18Object,
  objectPath: ConfigPath,
  index: number,
  member: P18Member,
): P18Object {
  return asP18Object(
    editP18At(argument, objectPath, (at) => {
      const object = asP18Object(at, objectPath);
      const members = [...object.members];
      members.splice(
        index,
        0,
        members.length === 0 ? { ...member, before: object.inner } : member,
      );
      return { kind: "object", members, inner: NO_COMMENTS };
    }),
    [],
  );
}

/** The argument with `key` removed from the object at `objectPath`. */
function removeMember(
  argument: P18Object,
  objectPath: ConfigPath,
  key: string,
): P18Object {
  return asP18Object(
    editP18At(argument, objectPath, (at) => {
      const object = asP18Object(at, objectPath);
      return {
        kind: "object",
        members: object.members.filter((member) => member.key !== key),
        inner: NO_COMMENTS,
      };
    }),
    [],
  );
}

/** A free value of `kind` (module header): its contents unconstrained. */
function genLooseOfKind(
  choices: Choices,
  kind: ConfigKind,
  depth: number,
): ConfigValue {
  switch (kind) {
    case "boolean":
      return choices.boolean();
    case "string":
      return choices.boolean(0.7)
        ? choices.pick(LOOSE_STRINGS)
        : genP18Name(choices);
    case "list": {
      const length = choices.intInclusive(0, depth > 0 ? 1 : 2);
      return Array.from({ length }, () => genLooseValue(choices, depth + 1));
    }
    case "object": {
      const remaining = [...LOOSE_KEYS];
      const size = choices.intInclusive(0, depth > 0 ? 1 : 2);
      const entries: [string, ConfigValue][] = [];
      for (let index = 0; index < size; index += 1) {
        const key = remaining.splice(
          choices.intInclusive(0, remaining.length - 1),
          1,
        )[0]!;
        entries.push([key, genLooseValue(choices, depth + 1)]);
      }
      return configObject(...entries);
    }
  }
}

/** A free value of any kind, scalars alone two levels down. */
function genLooseValue(choices: Choices, depth: number): ConfigValue {
  return genLooseOfKind(
    choices,
    choices.pick(depth > 1 ? (["boolean", "string"] as const) : CONFIG_KINDS),
    depth,
  );
}

/**
 * A value of a kind 7 does not admit where `shape` stands (module header):
 * the kind drawn, then T7.6-3's kind-table value of it there, or a drawn
 * one.
 */
function genWrongKindValue(choices: Choices, shape: ShapeSchema): ConfigValue {
  const kind = choices.pick(
    CONFIG_KINDS.filter((other) => other !== shape.kind),
  );
  const tabled = (T763_KIND_TABLE.get(shape.position) ?? []).filter(
    (value) => kindOf(value) === kind,
  );
  if (tabled.length > 0 && choices.boolean(0.5)) return choices.pick(tabled);
  return genLooseOfKind(choices, kind, 0);
}

/**
 * A string outside `values` (module header): near misses of the current
 * value, variants of each enumerated one, `"contains"` for an edge kind,
 * every other enumeration's members, and the empty string.
 */
function genOutsideEnumeration(
  choices: Choices,
  values: readonly string[],
  current: string | undefined,
): string {
  const candidates = [
    ...new Set([
      ...(current === undefined ? [] : nearMisses(current)),
      ...values.flatMap((value) => [
        value.toUpperCase(),
        `${value}s`,
        ` ${value}`,
        `${value} `,
      ]),
      ...(values.includes("depends") ? [CONTAINS] : []),
      ...ENUMERATED_VALUES,
      "",
      "none",
    ]),
  ].filter((candidate) => !values.includes(candidate));
  return choices.pick(candidates);
}

/** The configured groups' names, read from the data. */
function groupNamesOf(config: ConfigObject): GroupNames {
  const names = (key: string): string[] => {
    const value = config.get(key);
    return value !== undefined && isConfigObject(value)
      ? [...value.keys()]
      : [];
  };
  return { spec: names("specs"), code: names("code") };
}

/** Where a path stands, in words. */
function where(path: ConfigPath): string {
  return describeP18Path(path);
}

/** An unknown key in the object `node` holds (module header). */
function unknownKeyMutation(
  choices: Choices,
  argument: P18Object,
  node: ShapeNode,
): P18Mutation {
  const object = node.value;
  const fields = node.shape.fields;
  if (!isConfigObject(object) || fields === undefined) {
    throw new Error("unreachable: an unknown key's object is a fixed-key one");
  }
  const key = choices.pick(
    P18_UNKNOWN_KEYS.filter((name) => !fields.has(name) && !object.has(name)),
  );
  const value = genLooseValue(choices, 0);
  const stringLiteral = isIdentifierName(key) ? choices.boolean(0.5) : true;
  const index = choices.intInclusive(0, object.size);
  return {
    violation: { category: "unknown key", path: [...node.path, key] },
    label:
      `the unknown key ${JSON.stringify(key)} — spelled as ` +
      `${stringLiteral ? "a string literal" : "an identifier"}, valued ` +
      `${describeValue(value)} — as key ${String(index + 1)} of ` +
      where(node.path),
    argument: insertMember(argument, node.path, index, {
      ...plainMember(key, value),
      stringLiteral,
    }),
  };
}

/** A value of a kind 7 does not admit, replacing or added (module header). */
function kindMutation(
  choices: Choices,
  argument: P18Object,
  position: ValuePosition,
): P18Mutation {
  const value = genWrongKindValue(choices, position.shape);
  const offending =
    `${aKind(kindOf(value))} where 7 admits ${aKind(position.shape.kind)} ` +
    `(${position.shape.position}): ${describeValue(value)}`;
  if (!position.added) {
    return {
      violation: { category: "kind", path: position.path },
      label: `${offending}, at ${where(position.path)}`,
      argument: replaceValue(argument, position.path, value),
    };
  }
  const index = choices.intInclusive(0, position.size);
  return {
    violation: {
      category: "kind",
      path: [...position.objectPath, position.key],
    },
    label:
      `${offending}, as the optional field ${position.key} the draw omits, ` +
      `added as key ${String(index + 1)} of ${where(position.objectPath)}`,
    argument: insertMember(
      argument,
      position.objectPath,
      index,
      plainMember(position.key, value),
    ),
  };
}

/** A string outside an enumeration, replacing or added (module header). */
function enumerationMutation(
  choices: Choices,
  argument: P18Object,
  position: ValuePosition,
): P18Mutation {
  if (!position.added) {
    const values = position.shape.values;
    if (values === undefined || typeof position.value !== "string") {
      throw new Error("unreachable: an enumerated position holds a string");
    }
    const value = genOutsideEnumeration(choices, values, position.value);
    return {
      violation: { category: "enumeration", path: position.path },
      label:
        `the string ${JSON.stringify(value)}, outside ${values.join(", ")}, ` +
        `replacing ${JSON.stringify(position.value)} at ${where(position.path)}`,
      argument: replaceValue(argument, position.path, value),
    };
  }
  const index = choices.intInclusive(0, position.size);
  const field = [...position.objectPath, position.key];
  const values = position.shape.values ?? position.shape.elements?.values;
  if (values === undefined) {
    throw new Error("unreachable: an added enumerated field enumerates");
  }
  const outside = genOutsideEnumeration(choices, values, undefined);
  const inList = position.shape.values === undefined;
  const value: ConfigValue = inList ? [outside] : outside;
  return {
    violation: {
      category: "enumeration",
      path: inList ? [...field, 0] : field,
    },
    label:
      `the string ${JSON.stringify(outside)}, outside ${values.join(", ")}, ` +
      `${inList ? "the one element of " : ""}the optional field ` +
      `${position.key} the draw omits, added as key ${String(index + 1)} of ` +
      where(position.objectPath),
    argument: insertMember(
      argument,
      position.objectPath,
      index,
      plainMember(position.key, value),
    ),
  };
}

/** A selector in one of T7.6-3's form violations (module header). */
function selectorFormMutation(
  choices: Choices,
  argument: P18Object,
  node: ShapeNode,
  groups: GroupNames,
): P18Mutation {
  const names = allGroupNames(groups);
  const [form, keys] = choices.pick(
    SELECTOR_FORM_VIOLATIONS.filter(
      ([, carried]) => names.length > 0 || !carried.includes("group"),
    ),
  );
  const entries: [string, ConfigValue][] = [];
  for (const key of keys) {
    if (key === "group") {
      const reference = genGroupReference(choices, groups, names);
      entries.push(["group", reference.name]);
      if (reference.kind !== undefined) entries.push(["kind", reference.kind]);
    } else if (key === "files") {
      entries.push(["files", genSelectorGlob(choices)]);
    } else if (key === "tags") {
      entries.push(["tags", genSetList(choices, P18_TAGS)]);
    } else {
      entries.push(["kind", choices.pick(GROUP_KINDS)]);
    }
  }
  const selector = configObject(...genOrder(choices, entries));
  return {
    violation: { category: "selector form", path: node.path },
    label:
      `the selector form ${form}, ${describeValue(selector)}, at ` +
      where(node.path),
    argument: replaceValue(argument, node.path, selector),
  };
}

/** An empty set-read list, replacing or added (module header). */
function emptyListMutation(
  choices: Choices,
  argument: P18Object,
  position: ValuePosition,
): P18Mutation {
  if (!position.added) {
    return {
      violation: { category: "empty list", path: position.path },
      label: `an empty list at ${where(position.path)}`,
      argument: replaceValue(argument, position.path, []),
    };
  }
  const index = choices.intInclusive(0, position.size);
  return {
    violation: {
      category: "empty list",
      path: [...position.objectPath, position.key],
    },
    label:
      `an empty list as the optional field ${position.key} the draw omits, ` +
      `added as key ${String(index + 1)} of ${where(position.objectPath)}`,
    argument: insertMember(
      argument,
      position.objectPath,
      index,
      plainMember(position.key, []),
    ),
  };
}

/**
 * One violation of 7.6's type-error class (module header): its member
 * drawn among those the draw has a position for, then its position, then
 * its offending value.
 */
function genP18Mutation(choices: Choices, argument: P18Object): P18Mutation {
  const config = p18Config(argument);
  const nodes = shapeNodes(config);
  const objects = nodes.filter(
    (node) => node.shape.fields !== undefined && isConfigObject(node.value),
  );
  const required = objects.flatMap((node) => {
    const object = node.value;
    return (node.shape.required ?? [])
      .filter((key) => isConfigObject(object) && object.has(key))
      .map((key) => ({ node, key }));
  });
  const kinds = [
    ...nodes.filter((node) => node.path.length > 0).map(present),
    ...addablePositions(nodes, () => true),
  ];
  const enumerations = [
    ...nodes
      .filter(
        (node) =>
          node.shape.values !== undefined && typeof node.value === "string",
      )
      .map(present),
    ...addablePositions(
      nodes,
      (shape) =>
        shape.values !== undefined || shape.elements?.values !== undefined,
    ),
  ];
  const selectors = nodes.filter((node) => node.shape.selector === true);
  const empties = [
    ...nodes.filter((node) => node.shape.nonEmpty === true).map(present),
    ...addablePositions(nodes, (shape) => shape.nonEmpty === true),
  ];
  const members = (
    [
      ["unknown key", objects.length],
      ["missing required key", required.length],
      ["kind", kinds.length],
      ["enumeration", enumerations.length],
      ["selector form", selectors.length],
      ["empty list", empties.length],
    ] as const
  )
    .filter(([, positions]) => positions > 0)
    .map(([category]): ViolationCategory => category);
  const category = choices.pick(members);
  switch (category) {
    case "unknown key":
      return unknownKeyMutation(choices, argument, choices.pick(objects));
    case "missing required key": {
      const { node, key } = choices.pick(required);
      return {
        violation: { category, path: [...node.path, key] },
        label: `the required key ${key} removed from ${where(node.path)}`,
        argument: removeMember(argument, node.path, key),
      };
    }
    case "kind":
      return kindMutation(choices, argument, choices.pick(kinds));
    case "enumeration":
      return enumerationMutation(choices, argument, choices.pick(enumerations));
    case "selector form":
      return selectorFormMutation(
        choices,
        argument,
        choices.pick(selectors),
        groupNamesOf(config),
      );
    case "empty list":
      return emptyListMutation(choices, argument, choices.pick(empties));
  }
}

/** TEST-SPEC P-18's premise for each draw, which a deviation breaks. */
const P18_PREMISE =
  "each draw is valid under 7 and a covered file, and its mutant is the " +
  "draw with exactly the one violation of 7.6's type-error class drawn " +
  "(TEST-SPEC P-18; SPEC 7, 7.6 Covered files, Type contract)";

/** How a check compares violations: member and path. */
function violationKey(violation: ClassViolation): string {
  return `${violation.category} at ${JSON.stringify(violation.path)}`;
}

/** A violation, in words. */
function describeViolation(violation: ClassViolation): string {
  return `${violation.category} at ${where(violation.path)}`;
}

/**
 * Hold a draw to its premise (module header): valid under 7 by the
 * harness's own reading, no violation of the class in the draw, and
 * exactly the drawn one in its mutant; a deviation is a harness defect.
 */
function checkP18Draw(file: P18File, mutation: P18Mutation): void {
  const config = p18Config(file.argument);
  const problems = [
    ...problemsUnder7(config),
    ...classViolations(config).map(describeViolation),
  ];
  if (problems.length > 0) {
    throw new Error(
      `P-18: a draw is not valid as drawn (${problems.join("; ")}) — ` +
        `${P18_PREMISE}: a harness defect`,
    );
  }
  const found = classViolations(p18Config(mutation.argument));
  if (
    found.length !== 1 ||
    violationKey(found[0]!) !== violationKey(mutation.violation)
  ) {
    throw new Error(
      `P-18: the mutant (${mutation.label}) holds ` +
        `${found.length === 0 ? "no violation" : found.map(describeViolation).join(", ")} ` +
        "by the harness's reading of 7.6's type-error class, not exactly " +
        `the one drawn, ${describeViolation(mutation.violation)} — ` +
        `${P18_PREMISE}: a harness defect`,
    );
  }
}

/** The generator (module header): simplest outcomes first, for shrinking. */
export function genP18Draw(choices: Choices): P18Draw {
  const density = choices.weightedPick([
    [3, 0],
    [2, 0.12],
    [1, 0.4],
  ]);
  const drawing: Drawing = { choices, density };
  const argument = genP18Argument(drawing);
  const file = genP18File(drawing, argument);
  const setup = choices.pick(
    choices.weightedPick<readonly number[]>([
      [3, P18_STRICT_DEFAULT_SETUPS],
      [1, P18_INITIALIZED_PROJECT_SETUPS],
    ]),
  );
  const mutation = genP18Mutation(choices, argument);
  checkP18Draw(file, mutation);
  return { file, mutation, setup };
}

// ---------------------------------------------------------------------------
// The draw's files, read back, and S-9 (module header)
// ---------------------------------------------------------------------------

/** The keys of `value`, with their spellings, as TypeScript reads them back. */
function spelledKeys(
  value: P18Value,
  keys: Array<readonly [string, boolean]> = [],
): Array<readonly [string, boolean]> {
  if (value.kind === "list") {
    for (const element of value.elements) spelledKeys(element.value, keys);
  } else if (value.kind === "object") {
    for (const member of value.members) {
      keys.push([member.key, member.stringLiteral]);
      spelledKeys(member.value, keys);
    }
  }
  return keys;
}

/**
 * `file` rendered with `argument` beside N `name`, then read back with the
 * harness's TypeScript (module header); a deviation throws.
 */
function composeP18File(
  file: P18File,
  argument: P18Object,
  name: string,
  what: string,
): string {
  const problem = (detail: string): never => {
    throw new Error(
      `P-18: ${what}, rendered importing ${JSON.stringify(name)}, ${detail} ` +
        `— ${P18_PREMISE}: a harness defect`,
    );
  };
  const rendering = renderP18File(file, argument, name);
  const text = rendering.text;
  if (text.includes(BACKSLASH)) problem("spells a backslash");
  const scanned = scanComments(text).map((comment) => comment.text);
  if (
    scanned.length !== rendering.comments.length ||
    scanned.some((comment, index) => comment !== rendering.comments[index])
  ) {
    problem(
      `holds ${count(scanned.length, "comment")} as TypeScript scans it, ` +
        `not the ${String(rendering.comments.length)} drawn`,
    );
  }
  for (const comment of scanned) {
    if (comment.includes("@") || comment.startsWith("///")) {
      problem(
        `carries the comment ${JSON.stringify(comment)}, which TypeScript ` +
          "may read as a directive or pragma",
      );
    }
  }
  const read = readBack(text, problem);
  if (read.specifier !== name || read.specifierSpelling !== `"${name}"`) {
    problem(`spells its specifier ${read.specifierSpelling}, not exactly N`);
  }
  if (read.binding !== file.binding) {
    problem(`binds defineConfig to ${read.binding}, not ${file.binding}`);
  }
  if (!sameValue(read.argument, p18Config(argument))) {
    problem("reads back as another configuration than the one drawn");
  }
  const expected = spelledKeys(argument);
  if (
    read.keys.length !== expected.length ||
    read.keys.some(
      (key, index) =>
        key.key !== expected[index]?.[0] ||
        key.stringLiteral !== expected[index]?.[1],
    )
  ) {
    problem("spells its keys otherwise than drawn");
  }
  return text;
}

/** A draw's two files beside one N. */
export interface P18Texts {
  readonly valid: string;
  readonly mutant: string;
}

/** Each draw's files, composed once per candidate N. */
const composedTexts = new WeakMap<P18Draw, Map<string, P18Texts>>();

/** The draw's two files beside N `name`, read back (module header). */
export function p18Texts(draw: P18Draw, name: string): P18Texts {
  let byName = composedTexts.get(draw);
  if (byName === undefined) {
    byName = new Map();
    composedTexts.set(draw, byName);
  }
  let texts = byName.get(name);
  if (texts === undefined) {
    texts = {
      valid: composeP18File(draw.file, draw.file.argument, name, "the draw"),
      mutant: composeP18File(
        draw.file,
        draw.mutation.argument,
        name,
        `its mutant (${draw.mutation.label})`,
      ),
    };
    byName.set(name, texts);
  }
  return texts;
}

/**
 * S-9's per-draw check (module header): the draw and its mutant beside each
 * candidate N, each under the name the drawn setup's extension gives it,
 * so that S-9 judges each under the grammar its staging selects.
 */
export function stagedP18Sources(draw: P18Draw): readonly DrawSource[] {
  const { extension } = p18Setup(draw);
  return CANONICAL_MODULE_NAMES.flatMap((name) => {
    const texts = p18Texts(draw, name);
    const importing = `importing ${JSON.stringify(name)}`;
    return [
      [`covered-file${extension}`, texts.valid, `the draw, ${importing}`],
      [
        `covered-file${extension}`,
        texts.mutant,
        `its mutant (${draw.mutation.label}), ${importing}`,
      ],
    ] as const;
  });
}

/** A draw, in words, for a diagnosis and a counterexample. */
export function renderP18Draw(draw: P18Draw): string {
  const setup = COVERED_SETUPS[draw.setup];
  const [name] = CANONICAL_MODULE_NAMES;
  let text: string;
  try {
    text = JSON.stringify(
      renderP18File(draw.file, draw.file.argument, name).text,
    );
  } catch (error) {
    text = `(not rendered: ${error instanceof Error ? error.message : String(error)})`;
  }
  return (
    `${setup === undefined ? `covered setup ${String(draw.setup)} (none such)` : setup.label}; ` +
    `the mutation: ${draw.mutation.label}; the draw, importing ` +
    `${JSON.stringify(name)}: ${text}`
  );
}

// ---------------------------------------------------------------------------
// S-9's fixed vectors, and the tables held at module load (module header)
// ---------------------------------------------------------------------------

/** A gap holding a block and a line comment, every comment character. */
const VECTOR_GAP: P18Gap = [
  { kind: "block", body: P18_COMMENT_ALPHABET.join("") },
  { kind: "line", body: P18_COMMENT_ALPHABET.join("") },
];

/** `value` with VECTOR_GAP in every gap, keys alternately spelled. */
function commentedEverywhere(
  value: ConfigValue,
  keys: { count: number },
): P18Value {
  if (typeof value !== "object") return scalar(value);
  if (isConfigList(value)) {
    return {
      kind: "list",
      elements: value.map((element) => ({
        before: VECTOR_GAP,
        value: commentedEverywhere(element, keys),
        after: VECTOR_GAP,
      })),
      inner: value.length === 0 ? VECTOR_GAP : NO_COMMENTS,
    };
  }
  const members = [...value].map(([key, member]): P18Member => {
    keys.count += 1;
    return {
      key,
      stringLiteral: !isIdentifierName(key) || keys.count % 2 === 0,
      before: VECTOR_GAP,
      afterKey: VECTOR_GAP,
      afterColon: VECTOR_GAP,
      value: commentedEverywhere(member, keys),
      after: VECTOR_GAP,
    };
  });
  return {
    kind: "object",
    members,
    inner: members.length === 0 ? VECTOR_GAP : NO_COMMENTS,
  };
}

/** A name holding every character a non-identifier name may hold. */
const VECTOR_NAME = [
  ...P18_NON_IDENTIFIER_LEADS,
  ...NON_IDENTIFIER_RUN.flatMap(([, characters]) => characters),
].join("");

/**
 * The vector configuration: names of each class — `__proto__`, `Object`
 * members, an identifier, and VECTOR_NAME — one of both kinds, empty glob
 * lists, repeated set-read elements, keys out of 7's order, and each kind
 * given where a name is both kinds'.
 */
const VECTOR_ARGUMENT: ConfigObject = configObject(
  [
    "specs",
    configObject(
      ["__proto__", ["specs/**/*.mdx", "specs/**/*.mdx"]],
      [VECTOR_NAME, []],
      ["constructor", ["a/x?/*-x.mdx"]],
    ),
  ],
  [
    "code",
    configObject(["constructor", ["src/**/*.ts", ".gen/*.tsx"]], ["app", []]),
  ],
  ["markdown", configObject(["outDir", "out/md"], ["emit", false])],
  [
    "coverage",
    [
      configObject(
        ["targets", "all"],
        ["name", "toString"],
        ["target", "__proto__"],
        ["targetTags", ["core", "b.c", "core"]],
        ["boundary", "constructor"],
        ["boundaryKind", "code"],
        ["mode", "transitive"],
        ["edgeKinds", ["embeds", "depends", "embeds"]],
      ),
    ],
  ],
  [
    "policy",
    [
      configObject(
        ["name", VECTOR_NAME],
        ["type", "allowedOnly"],
        ["from", configObject(["kind", "spec"], ["group", "constructor"])],
        ["to", configObject(["tags", ["x-1", "x-1"]])],
        ["kinds", ["references", "references"]],
      ),
      configObject(
        ["name", "valueOf"],
        ["type", "forbidden"],
        ["from", configObject(["files", "src/*.ts"])],
        ["to", configObject(["group", "app"])],
      ),
    ],
  ],
);

/** The vector file: aliased to `undefined`, VECTOR_GAP in every gap. */
const VECTOR_FILE: P18File = (() => {
  const gaps = {} as Record<P18StatementGap, P18Gap>;
  for (const gap of P18_STATEMENT_GAPS) gaps[gap] = VECTOR_GAP;
  return {
    alias: true,
    binding: "undefined",
    gaps,
    argument: asP18Object(
      commentedEverywhere(VECTOR_ARGUMENT, { count: 0 }),
      [],
    ),
  };
})();

/** The vector mutant: an unknown `__proto__` key first at the top level. */
const VECTOR_MUTATION: P18Mutation = {
  violation: { category: "unknown key", path: ["__proto__"] },
  label: 'the unknown key "__proto__" as key 1 of the top level',
  argument: insertMember(VECTOR_FILE.argument, [], 0, {
    ...plainMember("__proto__", true),
    stringLiteral: true,
  }),
};

/**
 * S-9's fixed TypeScript vectors (test/self/s9-typescript-well-formedness
 * .test.ts): the vector draw and its mutant, as plain TypeScript and as
 * TSX, through the composition P-18's draws are staged with.
 */
export const P18_TS_FORM_VECTORS: ReadonlyArray<
  readonly [name: string, path: string, source: string | Uint8Array]
> = (() => {
  checkP18Draw(VECTOR_FILE, VECTOR_MUTATION);
  const [name] = CANONICAL_MODULE_NAMES;
  const files = [
    ["the vector draw", VECTOR_FILE.argument],
    ["its mutant", VECTOR_MUTATION.argument],
  ] as const;
  return files.flatMap(([what, argument]) => {
    const text = composeP18File(VECTOR_FILE, argument, name, `P-18's ${what}`);
    return ["xspec.config.ts", "xspec.config.tsx"].map(
      (path) =>
        [
          `P-18 configuration (${what}: comments in every gap, names of ` +
            `each class, importing ${JSON.stringify(name)}, as ` +
            `${path.endsWith(".tsx") ? "TSX" : "plain TypeScript"})`,
          path,
          text,
        ] as const,
    );
  });
})();

/**
 * The generator's tables (module header), held at module load: names and
 * aliases of their classes, none holding a forbidden character, every
 * alias reading back as the binding; comment characters none a directive
 * or line terminator needs; and 7.6's matrix as P-18 draws from it. A
 * deviation is a harness defect, thrown at module load.
 */
function checkP18Tables(): void {
  const problems: string[] = [];
  const need = (held: boolean, problem: string): void => {
    if (!held) problems.push(problem);
  };
  const strings = [
    ...P18_IDENTIFIER_NAMES,
    ...P18_NON_IDENTIFIER_LEADS,
    ...NON_IDENTIFIER_RUN.flatMap(([, characters]) => characters),
    ...P18_SPEC_GLOB_PARTS.directories,
    ...P18_SPEC_GLOB_PARTS.files,
    ...P18_CODE_GLOB_PARTS.directories,
    ...P18_CODE_GLOB_PARTS.files,
    ...P18_OUT_DIRS,
    ...P18_TAGS,
    ...P18_UNKNOWN_KEYS,
    ...LOOSE_STRINGS,
    ...LOOSE_KEYS,
  ];
  for (const text of strings) {
    need(
      forbiddenIn(text) === undefined,
      `${JSON.stringify(text)} holds no forbidden character`,
    );
  }
  for (const name of P18_IDENTIFIER_NAMES) {
    need(isIdentifierName(name), `${JSON.stringify(name)} is an identifier`);
  }
  for (const lead of P18_NON_IDENTIFIER_LEADS) {
    const codePoint = lead.codePointAt(0);
    need(
      [...lead].length === 1 &&
        codePoint !== undefined &&
        !ts.isIdentifierStart(codePoint, ts.ScriptTarget.ESNext),
      `the lead ${JSON.stringify(lead)} is one character no identifier begins with`,
    );
  }
  for (const character of P18_COMMENT_ALPHABET) {
    need(
      [...character].length === 1 &&
        !["@", "/", "*"].includes(character) &&
        forbiddenIn(character.replace(/["']/, "")) === undefined,
      `the comment character ${JSON.stringify(character)} is one no ` +
        "directive, pragma, or comment's end needs",
    );
  }
  for (const alias of P18_ALIAS_NAMES) {
    need(
      isIdentifierName(alias) && !BARRED_BINDINGS.has(alias),
      `the alias ${JSON.stringify(alias)} is a binding strict module code admits`,
    );
    try {
      composeP18File(
        {
          alias: true,
          binding: alias,
          gaps: VECTOR_FILE.gaps,
          argument: asP18Object(
            fromConfigValue(configObject(["specs", configObject()])),
            [],
          ),
        },
        asP18Object(
          fromConfigValue(configObject(["specs", configObject()])),
          [],
        ),
        CANONICAL_MODULE_NAMES[0],
        `the alias ${JSON.stringify(alias)}`,
      );
    } catch (error) {
      problems.push(error instanceof Error ? error.message : String(error));
    }
  }
  need(
    COVERED_SETUPS.length === 173 &&
      P18_STRICT_DEFAULT_SETUPS.length === 168 &&
      P18_INITIALIZED_PROJECT_SETUPS.length === 5,
    "7.6's matrix holds 173 covered setups, 168 under the strict defaults " +
      "and 5 under the initialized-project options",
  );
  need(
    P18_TS_FORM_VECTORS.length === 4,
    "S-9's vectors are the vector draw and its mutant, each as TypeScript " +
      "and as TSX",
  );
  if (problems.length > 0) {
    throw new Error(
      `P-18: its generator's tables deviate: ${problems.join("; ")}: a ` +
        "harness defect",
    );
  }
}

checkP18Tables();

// ---------------------------------------------------------------------------
// The body (module header)
// ---------------------------------------------------------------------------

/** Leads every diagnosis. */
const P18_CONTEXT = "P-18 (type contract over generated configurations)";

/** TEST-SPEC P-18's rule, closing a draw's failure. */
const P18_RULE =
  "(TEST-SPEC P-18: each draw, valid under 7 by construction and a " +
  "covered file, type-checks in its drawn covered setup (T7.6-2), and its " +
  "mutant, holding one violation of 7.6's type-error class, fails to " +
  "type-check in the same setup, paired with its draw (T7.6-3); SPEC 7.6 " +
  "Type contract: valid configurations, shape violations)";

/** The project directory, the importing files' own, in each staging. */
const PROJECT_DIR = "project";

/** What a draw's runs found. */
interface DrawOutcome {
  /** Each failing assertion's diagnosis, in order. */
  readonly failures: readonly string[];
  /** TypeScript resolved the import to no module it reads declarations from. */
  readonly nothingResolved: boolean;
}

/** Each failing assertion's diagnosis, in order: none where all hold. */
function failuresOf(checks: readonly (() => void)[]): readonly string[] {
  const failures: string[] = [];
  for (const check of checks) {
    try {
      check();
    } catch (error) {
      if (!(error instanceof HarnessAssertionError)) throw error;
      failures.push(error.message);
    }
  }
  return failures;
}

/**
 * Judge a draw (module header): the draw and its mutant beside the
 * canonical placement in a fresh staging of the drawn setup's project
 * kind, in one program in the drawn setup.
 */
async function judgeP18Draw(
  product: ProductBinding,
  draw: P18Draw,
  setup: CoveredSetup,
  context: string,
): Promise<DrawOutcome> {
  const staging = await ModuleStaging.create(product, context);
  try {
    await staging.stageProject(PROJECT_DIR, setup.project);
    const placement = await staging.placeCanonical(
      PROJECT_DIR,
      TYPE_CHECKING_ARM,
    );
    const texts = p18Texts(draw, placement.name);
    const covered = await stageCoveredFiles({
      staging,
      directory: PROJECT_DIR,
      project: setup.project,
      placement,
      alone: true,
      files: [
        { label: "the draw", text: texts.valid },
        { label: `its mutant (${draw.mutation.label})`, text: texts.mutant },
      ],
      setups: [setup],
      listExports: true,
      context,
    });
    const [valid, mutant] = covered.judge(setup);
    if (valid === undefined || mutant === undefined) {
      throw new Error("unreachable: two verdicts");
    }
    return {
      failures: failuresOf([
        () => {
          assertTypeChecks(valid, "T7.6-2's assertion over the draw");
        },
        () => {
          if (!valid.typeChecks) {
            fail(
              "T7.6-3's assertion over its mutant: the mutant counts " +
                "nowhere here, the draw, its valid twin, not type-checking " +
                "(TEST-SPEC §7.6 Pairing)",
            );
          }
          assertShapeViolation(
            valid,
            mutant,
            "T7.6-3's assertion over its mutant",
          );
        },
      ]),
      nothingResolved: valid.exportListing?.module === undefined,
    };
  } finally {
    await staging.dispose();
  }
}

/**
 * One draw (module header): both assertions, then one diagnosed failure
 * naming each failing one, declining shrinking where nothing resolved.
 */
async function runP18Draw(
  product: ProductBinding,
  draw: P18Draw,
): Promise<void> {
  const setup = p18Setup(draw);
  const context = `${P18_CONTEXT}, in ${setup.label}`;
  const { failures, nothingResolved } = await judgeP18Draw(
    product,
    draw,
    setup,
    context,
  );
  if (failures.length === 0) return;
  fail(
    `${P18_CONTEXT}: ${String(failures.length)} of the draw's 2 ` +
      "assertions — T7.6-2's over the draw and T7.6-3's over its mutant " +
      `(${draw.mutation.label}) — ${failures.length === 1 ? "fails" : "fail"} ` +
      `in ${setup.label} ${P18_RULE}` +
      (nothingResolved
        ? ". Nothing resolves here — TypeScript resolves the import to no " +
          "module it reads declarations from — a failure no configuration " +
          "is expected to change, so it is reported as drawn, unshrunk"
        : "") +
      `: ${failures.join(" | ")}`,
    { shrinkable: !nothingResolved },
  );
}

/**
 * P-18's body (module header): the package directory checked before any
 * draw, then the property.
 */
async function runP18(product: ProductBinding): Promise<void> {
  await modulePackageDirectory(product, P18_CONTEXT);
  await checkProperty(
    "P-18 type contract over generated configurations",
    genP18Draw,
    (draw) => runP18Draw(product, draw),
    {
      runs: P18_RUNS_PER_SEED,
      maxShrinkExecutions: P18_MAX_SHRINK_EXECUTIONS,
      render: renderP18Draw,
      drawSources: stagedP18Sources,
    },
  );
}

// ---------------------------------------------------------------------------
// Registration

const P_18 = defineProductTest({
  id: "P-18",
  title:
    "type contract over generated configurations (TEST-SPEC §16 P-18): " +
    "seeded draws of configurations valid under 7 by construction, each a " +
    "covered file — each object's key order and each key's identifier or " +
    "string-literal spelling drawn; defineConfig's binding drawn among " +
    "names strict module code admits, never require or exports; line and " +
    "block comments drawn between tokens, their bodies free of @ and never " +
    "a /// line; optional keys and fields present or absent; each group's " +
    "glob list empty or not; each set-read list (targetTags, edgeKinds, a " +
    "rule's kinds, a selector's tags) with repeated elements or without; " +
    "group, profile, and rule names drawn from identifier and " +
    "non-identifier spellings weighted toward the global Object " +
    "interface's members and __proto__; every reference resolving, every " +
    "kind given where a name is ambiguous, every name distinct where 7 " +
    "requires it — each type-checks in a covered setup drawn from 7.6's " +
    "matrix beside the canonical placement (T7.6-2), and each draw given " +
    "one violation of 7.6's type-error class — its member, position, and " +
    "offending value drawn — fails to type-check in the same setup, paired " +
    "with its draw (T7.6-3); draws and mutants checked well-formed before " +
    "TypeScript judges them (S-9) (SPEC 7.6 Covered files, Type contract; " +
    "E-5)",
  run: runP18,
});

/** TEST-SPEC §16 P-18. */
export const section16P18Tests: readonly ProductTestEntry[] = [P_18];
