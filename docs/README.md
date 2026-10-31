# xspec documentation

xspec is a requirement-traceability tool for specifications written in MDX. You mark requirement sections in your spec documents with `<S>` tags. xspec compiles them into strongly typed TypeScript modules and builds a project-wide dependency graph between requirements and code. It then uses that graph to validate references, enforce dependency policy, measure coverage, analyze the impact of changes, and drive staged reviews. External tools such as editors, visualizers, and agents connect to the same graph through a deterministic JSON command-line interface.

These pages are the usage guide. The authoritative behavioral specification is [`specs/SPEC.md`](../specs/SPEC.md); if a page here ever disagrees with it, the specification wins.

## Thirty-second tour

```mdx
{/* specs/AUTH.mdx */}
<S id="auth">
Authentication.

<S id="auth.login" tags="happy-path">
Users sign in with an email address and a password.
</S>
</S>
```

```ts
// src/auth.ts
import AUTH from "../specs/AUTH.xspec"

export function login(email: string, password: string): boolean {
  AUTH.auth.login          // ← dependency marker: this code implements that requirement
  return email.includes("@") && password.length > 0
}
```

```sh
xspec build      # generate typed modules, Markdown, and the graph
xspec check      # validate everything; exit 1 on any finding
xspec coverage   # which requirements are exercised, and by what
xspec impact --base main   # what a change touches, up and down the graph
```

Requirement references are real, type-checked TypeScript. Renaming a requirement without updating the code is a compile error, and `xspec rename` updates every reference for you while preserving identity in the change-tracking journal.

## Guide

Read in order if you are new:

1. **[Getting started](getting-started.md)**: install, create a project, first build, first coverage report.
2. **[Writing specs](writing-specs.md)**: the `.mdx` source syntax, covering sections, IDs, dependencies, embedding, tags, and Markdown output.
3. **[Configuration](configuration.md)**: `xspec.config.ts`, covering spec and code groups, Markdown emission, coverage profiles, policy rules, and type checking the file.
4. **[Using specs from TypeScript](typescript.md)**: generated modules, `text()`, dependency markers, and compiler setup.

Reference and workflows:

5. **[CLI reference](cli.md)**: every command, flag, exit code, finding code, and output convention.
6. **[Coverage](coverage.md)**: profiles, boundaries, direct vs. transitive coverage, and gating CI.
7. **[Impact analysis](impact.md)**: hashes, change categories, baselines, and impacted code.
8. **[Reviews](reviews.md)**: staged review sessions, with the `path-blocks`, `audit`, and `coverage` strategies.
9. **[Renaming and moving](refactoring.md)**: `xspec rename`, `xspec move`, previews, and the identity journal.
10. **[Workspace files](workspace.md)**: what xspec writes, the derived, durable, and transient files, and what to commit.
11. **[Machine interface](machine-interface.md)**: building editors and tools on xspec with `view`, `occurrences`, `at`, `inventory`, `version`, previews, and the JSON contract.

## What xspec is not

- **Not a semantic checker.** Coverage is graph reachability. A `depends` edge or a code marker asserts a relationship; it doesn't prove the code is correct.
- **Not a renderer.** Markdown output is a plain-text export of your specs with the annotations stripped. xspec doesn't build doc sites, and it ships no UI; editors and visualizers are built on its [machine interface](machine-interface.md).
- **Not a server.** Every command is a one-shot run over the files as saved on disk. There's no watch mode, and xspec never sees unsaved editor buffers.
- **Not networked.** xspec performs no network access. It reads git data only where baselines call for it (`impact --base`, baseline review sessions), and it never writes to git.

## Guarantees worth knowing up front

- **Deterministic output.** All output, generated files, and stored data are byte-deterministic for identical input: no timestamps, no randomness, no absolute paths. The one exception is output anchored to the invocation, such as `inventory`'s workspace root relative to your working directory; see [Global conventions](cli.md#global-conventions). Diffs stay meaningful and CI stays reproducible.
- **Three exit codes.**
  - `0`: success.
  - `1`: findings, such as validation errors, policy violations, uncovered requirements under `--check`, refused operations, or an answer that carries findings.
  - `2`: usage or configuration errors.

  Anything else is an internal error, never a defined outcome; the CLI uses `70`.
- **`--json` everywhere.** Every command can print a single JSON document with the same information as the human report. Every finding carries a stable code and exact byte ranges, and even usage and configuration errors arrive as a JSON document when you ask for JSON.
- **Durable identity.** `xspec rename` and `xspec move` record identity mappings in a journal. Refactoring your spec tree therefore doesn't show up as spurious change in impact reports or invalidate review work, and `--preview` shows every edit before you commit to it.
