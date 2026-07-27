# xspec

**Requirement traceability for specifications written in MDX.**

xspec turns your spec documents into a typed, queryable dependency graph. Mark requirement sections with `<S>` tags; xspec compiles each document into a strongly typed TypeScript module, links requirements to the code that implements and tests them, and uses the resulting project-wide graph to validate references, enforce dependency policy, measure coverage, analyze the impact of changes, and drive staged reviews.

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
  AUTH.auth.login   // type-checked reference: this code implements that requirement
  return email.includes("@") && password.length > 0
}
```

```sh
xspec build                 # typed modules + Markdown + project graph
xspec check                 # validate everything; exit 1 on any finding
xspec coverage tested --check   # gate CI on requirement coverage
xspec impact --base main    # what does this change touch?
```

## Why

- **References that can't rot.** Requirement references in code are real TypeScript — hover shows the requirement text, go-to-definition jumps into the `.mdx`, and a renamed or deleted requirement is a compile error, not silent drift.
- **A graph, not a convention.** Sections, declared dependencies (`d`), text embeddings (`{text(...)}`), and code references form one project-wide graph you can query, gate, and diff.
- **Coverage as reachability.** Named profiles ask precise questions — "is every product requirement referenced by a test?" — and `--check` turns them into CI gates.
- **Impact you can trust.** Hash-based change detection attributes every downstream effect to the edit that caused it; `xspec rename`/`xspec move` record identity mappings in a journal, so refactoring produces *zero* spurious impact.
- **Reviews with memory.** Changes, audits, and coverage gaps become durable, staged checklists that unlock bottom-up and flag resolutions invalidated by later edits.
- **Deterministic by construction.** Every output and generated file is byte-identical for identical input: no timestamps, no randomness, no network. Exit codes mean things (`0` success, `1` findings, `2` usage/config errors). Every command speaks `--json`.

## Getting started

Requires **Node.js ≥ 22**. Not yet published to npm — run from a checkout:

```sh
git clone https://github.com/modularcloud/xspec.git
cd xspec && npm ci && npm run build
npm link    # puts `xspec` on your PATH
```

Then follow **[docs/getting-started.md](docs/getting-started.md)** to set up a project in minutes.

## Documentation

Usage guides live in [`docs/`](docs/index.md) and are rendered at **[xspec.mintlify.site](https://xspec.mintlify.site)**:

| | |
|---|---|
| [Getting started](docs/getting-started.md) | Install → first project → first coverage report |
| [Writing specs](docs/writing-specs.md) | The `.mdx` syntax: sections, IDs, `d`, `text()`, tags |
| [Configuration](docs/configuration.md) | `xspec.config.ts`: groups, Markdown, coverage profiles, policy |
| [TypeScript integration](docs/typescript.md) | Generated modules, markers, `text()`, compiler setup |
| [CLI reference](docs/cli.md) | Every command, flag, exit code, and convention |
| [Coverage](docs/coverage.md) | Profiles, boundaries, modes, CI gating |
| [Impact analysis](docs/impact.md) | Hashes, change categories, baselines, impacted code |
| [Reviews](docs/reviews.md) | Staged review sessions and strategies |
| [Renaming & moving](docs/refactoring.md) | Identity-preserving refactoring and the journal |
| [Workspace files](docs/workspace.md) | What xspec writes and what to commit |

The authoritative behavioral specification is [`specs/SPEC.md`](specs/SPEC.md); the docs are the guide, the spec is the law.

The hosted site ([xspec.mintlify.site](https://xspec.mintlify.site)) renders these same files directly from `docs/` — there is no separate content copy.

## Development

This repository is built and maintained through **Spec-Driven Generation (SDG)**: the specification is the master artifact, and the spec, tests, and implementation are generated and kept in lockstep by the process defined in [`specs/PROCESS.md`](specs/PROCESS.md) (with Claude Code bindings in [`specs/CLAUDE-PROCESS.md`](specs/CLAUDE-PROCESS.md) and scaffolding under `.claude/`). Humans steer by editing goals and answering questions — not by hand-writing code — so issues and ideas are welcome as problem statements rather than patches.

Build and test instructions (for CI and process runs) are in [`AGENTS.md`](AGENTS.md): `npm ci`, `npm run build`, `npm test`. The test harness under `test/` is a separate program that drives the built `xspec` executable as a subprocess; certification fixtures keep the harness itself honest.

## License

MIT
