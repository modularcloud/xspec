// The `defineConfig` module (SPEC 7.6) along the `import` route: the
// package's root entry as package.json's `exports["."].import` names it,
// compiled to dist/index.mjs and typed by dist/index.d.mts, which the
// top-level `types` also names for TypeScript's `node10` resolution (it reads
// no `exports`). Its twin, index.cts, is the same module along the `require`
// route (dist/index.cjs, typed by dist/index.d.cts): the two declare the same
// configuration type, alias for alias, and must not drift apart.
//
// One export and no type (SPEC 7.6): the module exports exactly one binding,
// `defineConfig`. The configuration type is therefore built from unexported
// type aliases alone, and this file's one `export` keeps them unexported in
// the declaration file too, which tsc closes with `export {}` (a declaration
// module with no export list exports every top-level declaration). Aliases,
// never interfaces: where a consumer's declaration emit is on, as under 7.6's
// initialized-project options, the declaration of the consumer's default
// export inlines an unexported alias's structure, while an unexported
// interface cannot be named there and fails a valid configuration (TS4082).
//
// The type contract (SPEC 7.6, over the configuration of 7 to 7.5): every
// configuration valid under 7 type-checks, and each member of 7.6's
// type-error class fails to — an unknown key at any level, a missing required
// key, a value of a kind 7 does not admit, a string outside 7's enumerations,
// a selector not in exactly one of its forms, and an empty `targetTags`,
// `edgeKinds`, rule `kinds`, or selector `tags`. Every other configuration
// error (14.14) is left to xspec's static validation, the authoritative one.
//
// The runtime contract (SPEC 7.6): `defineConfig` returns its first argument
// itself and does nothing else, and loading the module has no effect. xspec
// never executes or imports a configuration (SPEC 7); this module serves the
// consumer's type checking and editor support alone.
//
// Why an `.mjs` file: SPEC 7.6 covers every installation name, `node_modules`
// among them, on every release of the Node.js 22 line. Node.js's
// package-scope lookup, which reads a manifest's `type`, stops without
// reading a package.json that sits directly in a directory named
// node_modules, so for the package installed as node_modules/node_modules its
// own `"type": "module"` is never read: a `.js` entry would be read as
// CommonJS and, on releases predating module-syntax detection (22.0 among
// them), fail to load. An `.mjs` file is an ES module by its extension alone.

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
export function defineConfig(config: Config): Config {
  return config;
}
