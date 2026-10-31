# Configuration: `xspec.config.ts`

Every xspec project is configured by a single `xspec.config.ts`. Its directory is the **workspace root**: all globs and paths resolve relative to it, and every identity xspec prints is workspace-relative.

Commands find the file by searching upward from the working directory. The search stops at the nearest directory that has an entry named `xspec.config.ts`, and that entry must be a plain file: a directory or symbolic link there is a configuration error, never followed. `--config <path>` (available on every command) points at the file explicitly. A missing or invalid configuration is a usage error: exit `2`, before any source is read. `xspec inventory` shows which configuration file and root a given working directory resolves to. `xspec version` is the one command that reads no configuration.

## The file is data, not code

xspec **parses the configuration statically and never executes or imports it**. The file must consist of exactly:

1. an import of `defineConfig` whose module specifier is any plain single- or double-quoted string (aliasing allowed; no `type` or `defer` modifier, no import attributes), and
2. a default export of one call to that binding, whose argument is built only from object literals (plain identifier or string keys), array literals, plain quoted strings, and `true`/`false`.

No spreads, no computed values, and no other statements are allowed; comments are fine anywhere. String values are read exactly as written, with no escape sequences interpreted. The file must be valid UTF-8 without a byte-order mark.

This makes configuration incapable of side effects or environment-dependent behavior, a property the rest of the tool's byte-determinism relies on. Each of these is a configuration error (exit `2`):

- anything outside this form;
- an unknown key anywhere in the argument, or a key repeated within one object;
- an empty group, profile, or rule name, or one containing U+FFFD.

xspec never resolves, loads, or interprets the import's specifier, and reads nothing on its account. Whatever the specifier names (your installed package, a path, a URL, or nothing at all), the configuration means the same, so the CLI works whether or not the import resolves. The specifier's spelling only has to leave the file well-formed TypeScript: an escape sequence that TypeScript rejects makes the file a configuration error.

## Type checking the configuration

Import `defineConfig` from the package your project installed. With the plain install from [Getting started](getting-started.md#install), that's `"@modularcloud/xspec"`:

```sh
npm install --save-dev @modularcloud/xspec
```

```ts
import { defineConfig } from "@modularcloud/xspec"
```

The package's root module exports `defineConfig` and nothing else (no other value and no types), and it needs no `@types` package. Your editor and `tsc` then check the file against the configuration's shape:

- A valid configuration type-checks with no errors, whatever its group names and whether or not you alias the import.
- Mistakes in the shape are type errors:
  - an unknown key at any level;
  - a missing required key: `specs`, `markdown`'s `emit`, and the profile and rule fields marked required below;
  - a value of the wrong kind, such as a string where a list belongs;
  - a string outside a field's allowed values: `targets`, `boundaryKind`, `mode`, `type`, a selector's `kind`, an entry of `edgeKinds` or `kinds`;
  - a selector that doesn't use exactly one of `group`, `files`, and `tags`, or that has `kind` without `group`;
  - an empty `targetTags`, `edgeKinds`, `kinds`, or selector `tags` list.
- Every other configuration error may or may not be a type error. These include a profile or selector naming a group that doesn't exist, or an ambiguous group name without its kind; empty, duplicate, or U+FFFD-bearing names; a malformed `outDir`; a glob outside the root; a key repeated within one object; a capture error; and a file matched by both a spec and a code group. xspec's own checks are the authority: every command reports these as configuration errors.

`defineConfig` returns the very value you pass it and does nothing else. On Node.js 22 or later, run with no loader or module-resolution options, the package loads through both `import` and `require`, and neither loading it nor calling `defineConfig` has any other effect. xspec never runs the file, but your own tooling may.

**What's covered.** This type checking is specified for TypeScript 5.9.3 checking the configuration file on its own, as the program's one root file, in either of two setups:

- `strict` on, `moduleResolution` set to `node10`, `node16`, `nodenext`, or `bundler` (with `module` at its default under `node10`, or at a value the mode requires), and every other option at its default;
- exactly the options `tsc --init` writes, for a file TypeScript compiles as an ES module.

Other TypeScript releases and option sets aren't covered. Within those setups, keep the file plain:

- No backslashes outside comments: no escape sequences or line continuations in keys, values, names, or the specifier. xspec reads every string as spelled, while TypeScript decodes escapes, so the two could disagree.
- No comment that TypeScript reads as a directive (`@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`, `@jsxImportSource`, or a triple-slash directive), since such comments change what TypeScript reports.
- Import `defineConfig` by its name, as in `import { defineConfig }` or `import { defineConfig as config }`, and don't alias it to `require`, `exports`, or a reserved word.

The import reaches the installed package only when nothing else claims its name first, such as a `package.json` of your own named `@modularcloud/xspec` in the configuration file's directory or above it. SPEC 7.6 lists the exact conditions.

**CommonJS projects.** Without `"type": "module"` in your `package.json`, TypeScript compiles `xspec.config.ts` as CommonJS, and under the options `tsc --init` writes (they turn on `verbatimModuleSyntax`) it rejects the file's `import` declaration. Either:

- name the file `xspec.config.mts`, which TypeScript always compiles as an ES module, and pass it to every command with `--config xspec.config.mts`, since the upward search looks only for `xspec.config.ts`; or
- declare `"type": "module"` in your `package.json`.

Under the strict setup above, a CommonJS project's `xspec.config.ts` type-checks as it is.

> **Upgrading from 0.2.x:** guides for earlier releases installed the package under an alias so that the import could name `"xspec"`. You no longer need that: install `@modularcloud/xspec` as above, change the import to `"@modularcloud/xspec"`, and remove the aliased entry from your `package.json`. Until you do, the old setup keeps working, since the import may name the package by whatever name it's installed under.

## Full example

```ts
import { defineConfig } from "@modularcloud/xspec"

export default defineConfig({
  specs: {
    product: ["specs/product/**/*.mdx"],
    tests: ["specs/tests/**/*.mdx"]
  },
  code: {
    app: ["src/**/*.ts", "src/**/*.tsx"],
    tests: ["test/**/*.ts", "test/**/*.tsx"]
  },
  markdown: { emit: true, outDir: "build/md" },
  coverage: [
    {
      name: "product-tested",
      target: "product",
      boundary: "tests",
      boundaryKind: "code",
      mode: "direct"
    }
  ],
  policy: [
    {
      name: "product-depends-on-nothing",
      type: "forbidden",
      from: { group: "product" },
      to: { group: "tests", kind: "spec" }
    }
  ]
})
```

`specs` is required. `code`, `markdown`, `coverage`, and `policy` are optional; omitting one simply means no code groups, no Markdown emission, no coverage profiles, or no policy rules. Empty `coverage` and `policy` arrays are valid and equivalent to omitting them.

## `specs` — spec groups

Named groups of `.mdx` source files, each a list of globs:

```ts
specs: {
  product: ["specs/product/**/*.mdx"],
  tests: ["specs/tests/**/*.mdx"]
}
```

- A file may belong to several groups.
- Every matched file must end in `.mdx`, and its path must not contain `"`, `'`, `\`, a line break, U+2028, or U+2029. A match that breaks either rule is reported as an invalid source path.
- A group whose globs match nothing is valid; discovery just yields fewer sources.

Group names are what coverage profiles, policy selectors, and `query nodes --group` refer to.

## `code` — code groups

Named groups of TypeScript files. Code groups serve two purposes: they can be a coverage **boundary** ("covered means referenced from this code"), and they are the population reported by [impacted-code analysis](impact.md#impacted-code).

A file matched by both a spec group and a code group is a configuration error. Three kinds of path are never discovered as sources, so generated artifacts can't sneak into groups through a broad glob:

- files whose names carry `.xspec.` (generated modules);
- files under `.xspec/`;
- configured Markdown output destinations.

The configuration file itself isn't excluded. A code group whose globs match it (a root-level `*.ts`, for example) makes `xspec.config.ts` a code source like any other, and its import is then checked as any code file's import is. The configuration stays valid either way, but as a source:

- a specifier ending in `.xspec`, or a relative one naming a derived file (a name carrying `.xspec.`, a path under `.xspec/`, or a Markdown output destination), is an `invalid-import` finding, so `build` and `check` fail;
- with Markdown emission on, a `move` whose destination would emit Markdown to the path that a relative specifier names is refused (`refused-invalid-destination`).

A package-name specifier such as `"@modularcloud/xspec"` triggers neither.

## `markdown` — pure-Markdown emission

```ts
markdown: { emit: true, outDir: "build/md" }
```

- `emit` (required boolean): whether each `NAME.mdx` compiles to a pure `NAME.md` ([what that means](writing-specs.md#markdown-compilation)).
- `outDir` (optional): redirect emitted files into a directory, preserving workspace-relative paths. The default is to emit next to each source file.
  - It must be a plain workspace-relative directory path: one or more `/`-separated names, with no leading `/`, no `.` or `..` segments, and no empty segments.
  - It must not be `.xspec` or lie under it.

## `coverage` — coverage profiles

Each profile is a named question of the form "is every requirement in *target* reachable from *boundary*?", evaluated by `xspec coverage`. See [Coverage](coverage.md) for semantics. The fields:

| Field | Required | Meaning |
|---|---|---|
| `name` | yes | Unique profile name; `xspec coverage <name>` runs just this one. |
| `target` | yes | Spec group whose requirements must be covered. |
| `targetTags` | no | Restrict targets to nodes carrying at least one of these tags. An empty list is an error. |
| `targets` | no | `"leaves"` (the default: only childless nodes are targets) or `"all"`. |
| `boundary` | yes | Spec **or** code group that counts as "covering". |
| `boundaryKind` | see below | `"spec"` or `"code"`. |
| `mode` | yes | `"direct"` (one edge) or `"transitive"` (a path of edges). |
| `edgeKinds` | no | Subset of `["depends", "embeds", "references"]`; the default is all three. An empty list is an error. |

`boundaryKind` must be omitted when the group name is unambiguous, and must be given when the same name exists as both a spec group and a code group. Referring to a group that doesn't exist is a configuration error. List-valued fields (`targetTags`, `edgeKinds`, and in policy `kinds` and `tags`) are sets: a repeated element counts once.

## `policy` — dependency policy rules

Policy rules constrain which dependency edges (`depends`, `embeds`, `references`) may exist. Only `xspec check` evaluates them, and only on a workspace that otherwise passes `build`'s validations. `build` regenerates output regardless, so a policy violation never blocks a build; it fails the gate.

| Field | Required | Meaning |
|---|---|---|
| `name` | yes | Unique rule name, cited in findings. |
| `type` | yes | `"forbidden"` or `"allowedOnly"`. |
| `from`, `to` | yes | Selectors (below). |
| `kinds` | no | Subset of the dependency edge kinds; the default is all three. An empty list is an error. |

Semantics, over edges of the rule's kinds:

- **`forbidden`**: any edge whose source matches `from` *and* whose target matches `to` is a violation.
- **`allowedOnly`**: every edge whose source matches `from` must have a target matching `to`; each edge that doesn't is a violation.

### Selectors

A selector matches nodes or code locations by exactly one of:

```ts
{ group: "product" }              // members of a named group
{ group: "tests", kind: "code" }  // kind required only when the name is ambiguous
{ files: "src/legacy/**" }        // a path glob
{ tags: ["draft", "internal"] }   // carries at least one listed tag
```

### Capture wildcards in `files` selectors

The `from` pattern may contain captures `$1` to `$9` (each at most once), and the `to` pattern may reference them. That's how to express *parallel-structure* rules like "a module's spec may only be depended on by that module's own code":

```ts
{
  name: "same-module-only",
  type: "allowedOnly",
  from: { files: "src/$1/**" },
  to: { files: "specs/$1/**" }
}
```

- **Syntax**: a capture is exactly `$` followed by one digit `1`–`9`. Any other `$`, such as `$0` or a trailing `$`, is an ordinary character.
- **Matching**: a capture matches one or more bytes within a single path segment, never across `/`.
- **Disambiguation**: matching goes left to right, and each wildcard and capture takes as few bytes as possible, so every match and every capture value is unique. For example, `$1-$2.ts` against `a-b-c.ts` captures `$1 = a` and `$2 = b-c`.
- **Errors**: a `to` that references a capture absent from `from` is a configuration error.

A violation finding names the rule and the offending edge, and lists them as its context:

```
policy-violation: policy violation: rule "app-avoids-drafts": the references edge src/auth.ts#login -> specs/AUTH.mdx#auth.login.valid violates the rule — its source matches "from" and its target matches "to" of the forbidden rule (SPEC 7.5); remove or redirect the dependency, or revise the rule in the configuration (SPEC 14.12) [app-avoids-drafts, src/auth.ts#login, references, specs/AUTH.mdx#auth.login.valid]
```

## Glob rules

Globs appear in groups, in selectors, and in the `--file` flags of `ids`, `query nodes`, `occurrences`, and `view`. The language is deliberately small:

- `*` matches any (possibly empty) run of bytes within one path segment;
- `?` matches exactly one byte within a segment;
- `**` matches any number of whole segments, including none. It has this meaning only as a whole pattern segment; inside a longer segment, each `*` is the ordinary single-segment wildcard.

Matching is byte-wise and case-sensitive. A path segment beginning with `.` is matched only by a pattern segment that itself starts with `.`, so `**/*.mdx` doesn't see `specs/.drafts/x.mdx`.

Whether a pattern points outside the workspace root is decided by its spelling alone: a pattern that starts with `/`, or whose `..` segments climb above the root, is an error. That's a configuration error in the configuration, and an invalid flag value (exit `2`) in a `--file` flag. Discovered paths never contain `.`, `..`, or empty segments, so such segments inside an otherwise valid pattern simply match nothing.

Discovery never follows symbolic links. A symlink (to a file or a directory, broken or not) is never a discovered source and is never traversed, so linked or cyclic directory structures can't pull outside content into the workspace. Discovery also lists only the directories some glob could match below, so unrelated parts of the tree are never read.
