// The `defineConfig` module (SPEC 7.6) along the `require` route: the
// package's root entry as package.json's `exports["."].require` names it,
// compiled to dist/index.cjs and typed by dist/index.d.cts. Its twin,
// index.mts, is the same module along the `import` route (dist/index.mjs,
// typed by dist/index.d.mts): the two declare the same configuration type,
// alias for alias, and must not drift apart. The aliases below are copied
// from index.mts byte for byte, and that file's header gives their reasons
// (one export and no type; aliases, never interfaces; the type contract) and
// the runtime contract both entries keep.
//
// Why a CommonJS entry (SPEC 7.6, Reach and Runtime): the module must load
// through `require` in a CommonJS module, with no option, environment
// variable, or module customization hook, on every release of the Node.js 22
// line and of every later line. On 22.0 to 22.11 `require` cannot load an ES
// module without a flag, so the `require` route names this CommonJS file. A
// `.cjs` file is CommonJS by its extension alone, whatever the manifest's
// `type` says and whether or not Node.js reads it (it reads none for the
// package installed as node_modules/node_modules). IMPLEMENTATION.md's "ES
// modules throughout" yields to 7.6 here, as that document's preamble rules
// wherever a choice it names cannot satisfy SPEC.md (the Liaison's ruling of
// 2026-10-29); every other module of the product stays an ES module.
//
// Why `export =`: tsc compiles a `.cts` source as CommonJS, and under
// tsconfig.base.json's `verbatimModuleSyntax` a CommonJS-format file cannot
// carry a top-level `export` modifier on a value (TS1287). `export =` of an
// object literal compiles to `module.exports = { defineConfig };` with no
// `__esModule` marker (tsc writes one only for ES-syntax exports), so the
// `require` result's one own property, string- or symbol-keyed, is
// `defineConfig` (SPEC 7.6, Runtime). In dist/index.d.cts tsc types the
// assignment as a constant of type `{ defineConfig: typeof defineConfig }`:
// its one member is the one export a named import of the module binds in a
// file TypeScript compiles as CommonJS under `node16` or `nodenext`, the
// setups that resolve the `require` entry (SPEC 7.6, Type contract), and
// the default import TypeScript admits there for interoperation with
// CommonJS is no export the module declares.

/**
 * A non-empty list (SPEC 7.4, 7.5): `targetTags`, `edgeKinds`, a rule's
 * `kinds`, and a selector's `tags` must not be empty (14.14). Repeated
 * elements are admitted, as 7.4 and 7.5 read these lists as sets.
 */
type NonEmpty<T> = [T, ...T[]];

/**
 * A dependency edge kind a profile's `edgeKinds` and a rule's `kinds` admit
 * (SPEC 7.4, 7.5) — not `"contains"`, the edge kind 5.2 also defines.
 */
type EdgeKind = "depends" | "embeds" | "references";

/** A group's kind: `boundaryKind` (SPEC 7.4) and a selector's `kind` (7.5). */
type GroupKind = "spec" | "code";

/**
 * Named groups, each a list of globs: `specs` (SPEC 7.1) and `code` (7.2).
 * Any name is a group name, and a group's list may be empty (7). A plain
 * `string[]`, never a tuple: TypeScript 5.9.3 types an object-literal key
 * naming a member of the global `Object` interface (`constructor`,
 * `toString`, and the like) by that member rather than by this index
 * signature, so such a group's list would lose a tuple's contextual typing
 * and fail to type-check though valid.
 */
type Groups = { [name: string]: string[] };

/** The `markdown` key (SPEC 7.3). */
type Markdown = {
  /** Whether pure Markdown files are emitted (SPEC 7.3). */
  emit: boolean;
  /**
   * A directory relative to the workspace root into which emitted files are
   * redirected, preserving workspace-relative paths (SPEC 7.3).
   */
  outDir?: string;
};

/** A named coverage profile (SPEC 7.4). */
type Profile = {
  /** The profile's unique name. */
  name: string;
  /** The spec group whose requirements must be covered. */
  target: string;
  /** Restricts the target set to nodes carrying at least one listed tag. */
  targetTags?: NonEmpty<string>;
  /** `"leaves"` (the default) restricts the target set to childless nodes. */
  targets?: "leaves" | "all";
  /** The spec or code group that counts as the coverage boundary. */
  boundary: string;
  /** Required exactly when `boundary` names both a spec and a code group. */
  boundaryKind?: GroupKind;
  mode: "direct" | "transitive";
  /** The edge kinds coverage paths use; all three by default. */
  edgeKinds?: NonEmpty<EdgeKind>;
};

/** A group selector (SPEC 7.5). */
type GroupSelector = {
  group: string;
  /** Required exactly when the name is both a spec and a code group. */
  kind?: GroupKind;
  files?: never;
  tags?: never;
};

/** A files selector (SPEC 7.5): a glob, with capture wildcards. */
type FilesSelector = {
  files: string;
  group?: never;
  kind?: never;
  tags?: never;
};

/** A tags selector (SPEC 7.5): matches nodes carrying a listed tag. */
type TagsSelector = {
  tags: NonEmpty<string>;
  group?: never;
  kind?: never;
  files?: never;
};

/**
 * A policy selector (SPEC 7.5) matches by exactly one of `group`, `files`,
 * and `tags`, and only a group selector carries `kind`. Each form declares the
 * other forms' keys optional and `never`, so a selector using two or three
 * forms, none (`{}`), or `kind` without `group` matches no member of this
 * union, while an unknown key is excess in every member.
 */
type Selector = GroupSelector | FilesSelector | TagsSelector;

/** A named policy rule constraining dependency edges (SPEC 7.5). */
type Rule = {
  /** The rule's unique name. */
  name: string;
  type: "forbidden" | "allowedOnly";
  from: Selector;
  to: Selector;
  /** The edge kinds the rule constrains; all three by default. */
  kinds?: NonEmpty<EdgeKind>;
};

/**
 * The `defineConfig` argument (SPEC 7): `specs` required; `code`,
 * `markdown`, `coverage`, and `policy` optional, an empty `coverage` or
 * `policy` list being valid.
 */
type Config = {
  specs: Groups;
  code?: Groups;
  markdown?: Markdown;
  coverage?: Profile[];
  policy?: Rule[];
};

/**
 * `xspec.config.ts` default-exports one call to this function (SPEC 7, 7.6).
 * Not generic: its argument is checked against `Config` itself, so
 * TypeScript's excess-property check reports an unknown key at every level,
 * where inference into a type parameter would check none. At run time it is
 * the identity: it returns the very value passed, never examined, copied, or
 * modified (`undefined` when called with none; further arguments ignored), and
 * does nothing else.
 */
function defineConfig(config: Config): Config {
  return config;
}

// The module's one export (SPEC 7.6): the `require` result is this object.
export = { defineConfig };
