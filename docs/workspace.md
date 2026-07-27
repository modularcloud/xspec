---
title: Workspace files
description: What xspec writes, derived vs. durable files, and what to commit.
---

Everything xspec writes is a **plain file with deterministic bytes** — stable ordering, sorted keys, no timestamps, no absolute paths — deliberately suitable for committing and diffing. This page inventories those files, explains the derived/durable distinction, and gives version-control guidance.

## Inventory

For a source file `specs/AUTH.mdx` and default configuration:

| Path | What | Class |
|---|---|---|
| `specs/AUTH.xspec.ts` | Generated TypeScript module (the `./AUTH.xspec` import target) | Derived |
| `specs/AUTH.xspec.impl.js` | Companion: runtime implementation | Derived |
| `specs/AUTH.xspec.impl.d.ts` | Companion: types + hover docs | Derived |
| `specs/AUTH.xspec.impl.d.ts.map` | Companion: declaration map (go-to-definition into the `.mdx`) | Derived |
| `specs/AUTH.md` | Pure-Markdown emission (only with `markdown.emit`; placed per `outDir`) | Derived |
| `.xspec/graph.json` | Graph data serving `check`/`ids`/`show`/`coverage`/`impact`/`review`/`query` | Derived |
| `.xspec/journal` | Identity journal written by `rename`/`move` | **Durable** |
| `.xspec/reviews/<name>.json` | One review session each | **Durable** |

Companion sets are an implementation detail and may evolve; the stable rule is that every companion sits beside the module and carries `.xspec.` in its name. Graph data's format is likewise opaque — its contract is its location, classification, and freshness behavior.

## Derived vs. durable

**Derived files** are fully reproducible from sources + configuration + journal via `xspec build`. Anything wrong with one — merge conflict, corruption, deletion, tampering — is correctly resolved by rebuilding. `build` also removes derived files it recorded earlier that current sources no longer generate, so renames don't strand orphans.

**Durable files** (the journal, review sessions) record operations and resolutions. They are **not reproducible, never regenerated, and must not be modified except by their owning commands**. Both are line-oriented or stably keyed so concurrent branches merge textually; `xspec check` validates their integrity and reports unresolvable states.

Derived-file *paths belong to xspec*: writing a derived file replaces whatever sits at that path, whether or not xspec wrote it. Don't park anything at a path matching a derived name.

Three path classes are **never discovered as sources**, no matter what your globs say: paths whose file name contains `.xspec.`, anything under `.xspec/`, and the configured Markdown emit destinations. A broad `specs/**/*.mdx` therefore never accidentally ingests emitted output.

## What to commit

Commit **everything xspec writes**, alongside your sources:

- **The journal and review sessions: non-negotiable.** They cannot be regenerated; losing the journal breaks identity mapping for every baseline that crosses a rename or move. If you commit nothing else, commit `.xspec/journal`.
- **Generated modules and companions: commit them.** Consumers' builds and editors resolve `./NAME.xspec` without running xspec first; diffs of generated files are deterministic and reviewable; `xspec check` in CI proves they match the sources (staleness is a finding), so they cannot silently drift.
- **Emitted Markdown and `.xspec/graph.json`: commit for the same reasons**, or — if repository size argues otherwise — ignore them and run `xspec build` in CI before `check`. Choose per file class, not per file; a half-committed derived set is the confusing middle ground.

A `.gitignore` for the commit-everything policy needs no xspec entries at all. For the regenerate-in-CI policy:

```ini
# derived (rebuilt by `xspec build`) — keep .xspec/journal and .xspec/reviews!
*.xspec.*
specs/**/*.md
.xspec/graph.json
```

The `*.xspec.*` pattern needs both dots, so it matches the generated module and every companion (`AUTH.xspec.ts`, `AUTH.xspec.impl.js`, …) but never the `.xspec/` directory. Still, never ignore `.xspec/` wholesale — that would drop the journal and review sessions.

## Freshness, staleness, and repair

- `xspec build` regenerates every derived file; a failed build changes nothing.
- Read commands (`ids`, `show`, `coverage`, `impact`, `review`, `query`) silently refresh graph data when it doesn't match the current sources — you never get stale answers, and they never touch generated TS/Markdown.
- `xspec check` never refreshes; a derived file that doesn't match the sources is a **staleness finding**:

```
specs/AUTH.xspec.ts: stale generated output (14.10): … run `xspec build` to
regenerate every derived file (SPEC 14.10)
```

  which is also your tamper detector: manual edits to generated files, orphaned outputs after config changes, and merge damage all surface here, with rebuild as the universal fix.

## Filesystem behavior worth knowing

- **Writes are atomic in effect**: concurrent readers and interrupted commands see the old content or the new, never a torn file.
- **Mutating commands** (`rename`, `move`, `review create/resolve/split`) are mutually exclusive per workspace; a second one fails fast (exit `2`) touching nothing. Different workspaces never interfere.
- **Symbolic links are never followed**: not in discovery (a symlink is never a source), not in writes (a symlink in a write path's directories is a refusal; a symlink *at* a derived file's own path is simply replaced as a plain file). Journal or session paths occupied by non-plain-files are errors, never written through.
- xspec performs no network access, reads git only where documented (`impact --base`, `review create --base`, baseline reconstruction), and never writes to git.
