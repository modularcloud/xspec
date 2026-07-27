# xspec documentation

xspec is a requirement-traceability tool for specifications written in MDX. You mark requirement sections in your spec documents with `<S>` tags, and xspec compiles them into strongly typed TypeScript modules, builds a project-wide dependency graph between requirements and code, and uses that graph to validate references, enforce dependency policy, measure coverage, analyze the impact of changes, and drive staged reviews.

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

Requirement references are real, type-checked TypeScript — renaming a requirement without updating the code is a compile error, and `xspec rename` updates every reference for you while preserving identity in the change-tracking journal.

## Guide

Read in order if you are new:

1. **[Getting started](getting-started.md)** — install, create a project, first build, first coverage report.
2. **[Writing specs](writing-specs.md)** — the `.mdx` source syntax: sections, IDs, dependencies, embedding, tags, Markdown output.
3. **[Configuration](configuration.md)** — `xspec.config.ts`: spec and code groups, Markdown emission, coverage profiles, policy rules.
4. **[Using specs from TypeScript](typescript.md)** — generated modules, `text()`, dependency markers, compiler setup.

Reference and workflows:

5. **[CLI reference](cli.md)** — every command, flag, exit code, and output convention.
6. **[Coverage](coverage.md)** — profiles, boundaries, direct vs. transitive coverage, gating CI.
7. **[Impact analysis](impact.md)** — hashes, change categories, baselines, impacted code.
8. **[Reviews](reviews.md)** — staged review sessions: `path-blocks`, `audit`, and `coverage` strategies.
9. **[Renaming and moving](refactoring.md)** — `xspec rename`, `xspec move`, and the identity journal.
10. **[Workspace files](workspace.md)** — what xspec writes, derived vs. durable files, what to commit.

## What xspec is not

- **Not a semantic checker.** Coverage is graph reachability; a `depends` edge or a code marker asserts a relationship, it does not prove the code is correct.
- **Not a renderer.** Markdown output is a plain-text export of your specs with the annotations stripped; xspec does not build doc sites.
- **Not networked.** xspec performs no network access, reads git data only where baselines call for it (`impact --base`, baseline review sessions), and never writes to git.

## Guarantees worth knowing up front

- **Deterministic output.** All output, generated files, and stored data are byte-deterministic for identical input: no timestamps, no randomness, no absolute paths. Diffs stay meaningful and CI stays reproducible.
- **Three exit codes.** `0` success, `1` findings (validation errors, policy violations, uncovered requirements under `--check`, refused operations), `2` usage or configuration errors. Anything else (the CLI uses `70`) is an internal error, never a defined outcome.
- **`--json` everywhere.** Every command can emit a single JSON document with the same information as the human report.
- **Durable identity.** `xspec rename` and `xspec move` record identity mappings in a journal, so refactoring your spec tree does not show up as spurious change in impact reports or invalidate review work.
