---
title: Configuration
description: "The xspec.config.ts schema: spec and code groups, Markdown emission, coverage profiles, and policy rules."
---

Every xspec project is configured by a single `xspec.config.ts`. Its directory is the **workspace root**: all globs and paths resolve relative to it, and every identity xspec prints is workspace-relative.

Commands find the file by upward search from the working directory; `--config <path>` (available on every command) points at it explicitly. A missing or invalid configuration is a usage error — exit `2`, before any source is read.

## The file is data, not code

xspec **parses the configuration statically and never executes or imports it**. The file must consist of exactly:

1. an import of `defineConfig` from the module specifier `"xspec"` (aliasing allowed), and
2. a default export of one call to that binding, whose argument is built only from object literals (plain identifier or string keys), array literals, plain quoted strings, and `true`/`false`.

No spreads, no computed values, no other statements. This makes configuration incapable of side effects or environment-dependent behavior — a property the rest of the tool's byte-determinism relies on. Anything outside this form, and any unknown key anywhere in the argument, is a configuration error (exit `2`).

`defineConfig` is an identity function whose only job is editor type support while you author the file. Because xspec never resolves the import, the CLI works even when the `xspec` package is not installed in your project; install it (or exclude the config from your tsconfig) only to keep your own `tsc` happy.

## Full example

```ts
import { defineConfig } from "xspec"

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

`specs` is required. `code`, `markdown`, `coverage`, and `policy` are optional; omitting one simply means no code groups, no Markdown emission, no coverage profiles, or no policy rules. Empty `coverage`/`policy` arrays are valid and equivalent to omission.

## `specs` — spec groups

Named groups of `.mdx` source files, each a list of globs:

```ts
specs: {
  product: ["specs/product/**/*.mdx"],
  tests: ["specs/tests/**/*.mdx"]
}
```

- A file may belong to several groups.
- Every matched file must end in `.mdx`; a glob matching anything else is an error.
- A group whose globs match nothing is valid — discovery just yields fewer sources.

Group names are what coverage profiles, policy selectors, and `query nodes --group` refer to.

## `code` — code groups

Named groups of TypeScript files. Code groups serve two purposes: they can be a coverage **boundary** ("covered = referenced from this code"), and they are the population reported by [impacted-code analysis](./impact.md#impacted-code).

A file matched by both a spec group and a code group is a configuration error. Files whose names carry `.xspec.` (generated modules), files under `.xspec/`, and configured Markdown output destinations are never discovered as sources, so generated artifacts cannot sneak into groups via a broad glob.

## `markdown` — pure-Markdown emission

```ts
markdown: { emit: true, outDir: "build/md" }
```

- `emit` (required boolean): whether each `NAME.mdx` compiles to a pure `NAME.md` ([what that means](./writing-specs.md#markdown-compilation)).
- `outDir` (optional): redirect emitted files into a directory, preserving workspace-relative paths. Must resolve inside the workspace root. Default: emit next to each source file.

## `coverage` — coverage profiles

Each profile is a named question of the form "is every requirement in *target* reachable from *boundary*?" — evaluated by `xspec coverage`. See [Coverage](./coverage.md) for semantics; the fields:

| Field | Required | Meaning |
|---|---|---|
| `name` | yes | Unique profile name; `xspec coverage <name>` runs just this one. |
| `target` | yes | Spec group whose requirements must be covered. |
| `targetTags` | no | Restrict targets to nodes carrying at least one of these tags. Empty list = error. |
| `targets` | no | `"leaves"` (default: only childless nodes are targets) or `"all"`. |
| `boundary` | yes | Spec **or** code group that counts as "covering". |
| `boundaryKind` | see below | `"spec"` or `"code"`. |
| `mode` | yes | `"direct"` (one edge) or `"transitive"` (a path of edges). |
| `edgeKinds` | no | Subset of `["depends", "embeds", "references"]`; default all three. Empty list = error. |

`boundaryKind` must be omitted when the group name is unambiguous and must be given when the same name exists as both a spec and a code group. Referring to a group that does not exist is a configuration error.

## `policy` — dependency policy rules

Policy rules constrain which dependency edges (`depends`, `embeds`, `references`) may exist. They are evaluated by `xspec check` only — `build` regenerates output regardless, so a policy violation never blocks builds, it fails the gate.

| Field | Required | Meaning |
|---|---|---|
| `name` | yes | Unique rule name, cited in findings. |
| `type` | yes | `"forbidden"` or `"allowedOnly"`. |
| `from`, `to` | yes | Selectors (below). |
| `kinds` | no | Subset of the dependency edge kinds; default all three. Empty list = error. |

Semantics over edges of the rule's kinds:

- **`forbidden`** — any edge whose source matches `from` *and* whose target matches `to` is a violation.
- **`allowedOnly`** — every edge whose source matches `from` must have a target matching `to`; each edge that does not is a violation.

### Selectors

A selector matches nodes or code locations by exactly one of:

```ts
{ group: "product" }              // members of a named group
{ group: "tests", kind: "code" }  // kind required only when the name is ambiguous
{ files: "src/legacy/**" }        // a path glob
{ tags: ["draft", "internal"] }   // carries at least one listed tag
```

### Capture wildcards in `files` selectors

The `from` pattern may contain captures `$1`…`$9` (each at most once), and the `to` pattern may reference them — the way to express *parallel-structure* rules like "a module's spec may only be depended on by that module's own code":

```ts
{
  name: "same-module-only",
  type: "allowedOnly",
  from: { files: "src/$1/**" },
  to: { files: "specs/$1/**" }
}
```

A capture matches one or more bytes within a single path segment (never `/`). Matching is disambiguated left to right, each wildcard and capture taking as few bytes as possible — so every match and every capture value is unique. For example, `$1-$2.ts` against `a-b-c.ts` captures `$1 = a`, `$2 = b-c`. A `to` referencing a capture absent from `from` is a configuration error.

A violation finding names the rule and the offending edge:

```
policy violation (14.12): policy violation: rule "app-avoids-drafts": the
references edge src/auth.ts#login -> specs/AUTH.mdx#auth.login.valid violates
the rule — its source matches "from" and its target matches "to" of the
forbidden rule (SPEC 7.5); remove or redirect the dependency, or revise the
rule in the configuration (SPEC 14.12)
```

## Glob rules

Globs appear in groups, selectors, `markdown.outDir` handling, and the `--file` flags of `ids`/`query nodes`. The language is deliberately small:

- `*` — any (possibly empty) run of bytes within one path segment
- `?` — exactly one byte within a segment
- `**` — any number of whole segments, including none

Matching is byte-wise and case-sensitive. A path segment beginning with `.` is matched only by a pattern segment that itself starts with `.` — `**/*.mdx` does not see `specs/.drafts/x.mdx`. A pattern that resolves outside the workspace root is an error.

Discovery never follows symbolic links — a symlink (to a file or directory, broken or not) is never a discovered source and never traversed, so linked or cyclic directory structures cannot pull outside content into the workspace.
