---
title: CLI reference
description: Every command, flag, exit code, and output convention.
---

```
xspec <command> [arguments] [flags]
```

Commands: `build`, `check`, `ids`, `show`, `coverage`, `impact`, `review <sub>`, `query <sub>`, `rename`, `move`.

## Global conventions

These hold for **every** command:

- **`--json`** — emit a single JSON document on stdout containing the same information as the human report. For `query` and `review export` the output is JSON with or without the flag.
- **`--config <path>`** — use this configuration file instead of searching upward from the working directory for `xspec.config.ts`.
- **Flag syntax** — flags are space-separated (`--config path`, not `--config=path`); each flag may be given at most once; list-valued flags (`--kinds`) take one comma-separated value (`--kinds depends,embeds`).
- **Arguments** — node and file arguments (`<node>`, `<graph-node>`, `<file>`, `--file`) are **workspace-relative** (`specs/AUTH.mdx#auth.login`), independent of your working directory. Only `--config` and `--test-hold` are ordinary filesystem paths resolved against the working directory. Values must be valid UTF-8.
- **Streams** — reports (including findings) go to **stdout**; usage/configuration errors and diagnostics go to **stderr**. With `--json`, the JSON document is the entire stdout; when an exit-2 error prevents emitting one, stdout is empty.
- **Determinism** — all output and files are byte-deterministic for identical input: no timestamps, no randomness, no absolute paths. Where "one shortest path" is reported and several tie, the byte-least one is chosen — always the same one.
- **Comparisons** — IDs, tags, identities, session names, and paths compare byte-wise and case-sensitively throughout.

### Exit codes

| Code | Class | Examples |
|---|---|---|
| `0` | Success | Clean `build`/`check`; every informational report (`ids`, `show`, `impact`, `query`, review reads, `coverage` without `--check`) |
| `1` | Findings | `build` on invalid sources; `check` findings; `coverage --check` with uncovered requirements; refused `rename`/`move`; refused review operations; corrupt review session |
| `2` | Usage / configuration errors | Unknown command, flag, or flag value; missing arguments; unknown profile/session/group/node/file named in arguments; invalid or missing configuration; unreadable baseline; a mutating command blocked by another one running |
| `70` | Internal error | A crash — never a defined outcome; report it |

### Freshness model

`build` is the only command that (re)generates TypeScript and Markdown. The read commands (`ids`, `show`, `coverage`, `impact`, `review`, `query`) never answer from stale data: if the graph data under `.xspec/` does not match the current sources, they refresh it silently first (graph data only — never generated TS/Markdown). If the sources fail validation, they report the errors and exit `1` without answering. `check` is the exception: it never refreshes anything — it reports staleness as a finding.

---

## `xspec build`

Parses configured sources; validates structure, IDs, tags, and references; resolves dependencies; generates TypeScript modules; emits Markdown (if enabled); writes graph data. Silent on success.

- Does **not** evaluate policy rules — those are `check` findings only.
- Regenerates every derived file and removes recorded derived files that are no longer generated.
- A failed build (exit `1` findings, exit `2` config error) **modifies nothing**.

```sh
$ xspec build
$ echo $?
0
```

## `xspec check`

Everything `build` validates, plus: generated files match current sources byte-for-byte (staleness), no orphaned derived files, all references resolve and are static, no dependency or import cycles, the journal is well-formed and replayable, **no policy violations**, review sessions are intact. Writes nothing. Exit `1` on any finding; findings print to stdout, one per line, followed by a count:

```sh
$ xspec check
specs/AUTH.mdx:331-353: invalid structural ID (14.2): invalid structural ID
"unrelated.section": a top-level section's ID is checked against the empty
prefix and is exactly one segment (SPEC 1.3, 14.2)
1 finding
```

Every finding names the file/location, the condition (numbered per SPEC §14), and the correction. `check` is the CI gate: `xspec build && xspec check` proving a workspace clean is the everyday invariant.

## `xspec ids`

Lists requirement IDs grouped by file (files in byte order, IDs in document order).

| Flag | Meaning |
|---|---|
| `--tree` | Render each file's IDs as a nested tree instead of a flat list |
| `--file <glob>` | Restrict to files matching the glob |
| `--unreferenced` | Only nodes with **no incoming dependency edges** from specs or code (`contains` doesn't count) |

```sh
$ xspec ids --tree
specs/AUTH.mdx
  auth
    auth.login
      auth.login.valid
      auth.login.invalid
    auth.lockout
```

`--unreferenced` answers "what does nothing point at?" — not the same as uncovered (a node can be referenced by something outside a profile's boundary and still be uncovered).

## `xspec show <node>`

Prints one requirement for human reading: identity, source range, tags, coverage attribute, all four hashes, incoming/outgoing edges by kind, own text, and subtree text. `<node>` is `path#id`, or a bare `path` for a file's root node. `xspec query node` is the machine-facing equivalent.

## `xspec coverage [<profile>] [--check]`

Runs all configured coverage profiles, or one by name. Reports counts plus the identity of every covered (with one shortest covering path), uncovered, and ignored node (with exclusion reasons). With `--check`, exits `1` if any required node is uncovered. See [Coverage](./coverage.md).

## `xspec impact --base <git-ref>`

Compares the current workspace against the graph reconstructed at a git ref (identities mapped through the journal). Reports requirement change categories with attribution, then directly/transitively impacted code with witness paths. Informational: exits `0` either way. See [Impact analysis](./impact.md).

## `xspec review …`

Staged review sessions over graph results. Eight subcommands:

```sh
xspec review create --base <ref> --name <name>            # path-blocks strategy
xspec review create --strategy audit --name <name>        # audit strategy
xspec review create --coverage <profile> --name <name>    # coverage strategy
xspec review list
xspec review status <name>
xspec review next <name> [--json]
xspec review show <name> <item-id>
xspec review split <name> <item-id>
xspec review resolve <name> <item-id> --status <status> [--note <text>]
xspec review export <name>
```

`create` requires exactly one of `--base`, `--strategy audit`, `--coverage`. `resolve --status` accepts `updated`, `no-change`, `skipped`. `export` emits JSON always. Sessions live in `.xspec/reviews/<name>.json`; names are limited to `A–Z a–z 0–9 . _ -` and must not start with `.`. See [Reviews](./reviews.md) for the model and a worked session.

## `xspec query <sub>`

Set-level, **JSON-only** access to the graph for scripts and agents:

```sh
xspec query node <node>
xspec query nodes [--group <g>] [--file <glob>] [--tag <t>] [--coverage required|none]
xspec query edges [--from <graph-node>] [--to <graph-node>] [--kinds <kinds>]
xspec query subtree <node>
xspec query ancestors <node>
xspec query reachable --from <graph-node> --to <graph-node> [--kinds <kinds>]
```

- `<node>` is a requirement identity (`path#id`, bare `path` = root). `<graph-node>` is that or a code location (`path`, `path#unit`, `path#unit@N`). Whether a bare path is a spec root or a code file follows from its group.
- `node` returns identity, source range, own/subtree text, all four hashes, tags, coverage attribute, and all edges. `nodes`/`subtree`/`ancestors` return one row per node (identity, range, tags, coverage). `subtree` is the node plus descendants in document order; `ancestors` is proper ancestors nearest-first.
- `nodes` filters combine conjunctively; `--group` takes a spec group name only.
- `edges` filters over all four kinds; `reachable` accepts only the three dependency kinds and reports whether a dependency path exists plus one shortest witness:

```sh
$ xspec query reachable --from "test/auth.test.ts#testValidLogin" \
    --to "specs/AUTH.mdx#auth.login.valid"
{
  "path": [
    "test/auth.test.ts#testValidLogin",
    "specs/AUTH.mdx#auth.login.valid"
  ],
  "reachable": true
}
```

## `xspec rename <file> <old-id> <new-id>`

Renames a requirement ID, rewrites descendant IDs and **every reference across the workspace** (spec `id`s, `d` refs, `text(...)` refs, TypeScript markers), and appends the identity mapping to the journal. Refuses (exit `1`) rather than corrupt: invalid or colliding new ID, broken structural rules, or a workspace that doesn't currently pass `build` validation. Finishes by regenerating derived files. See [Renaming and moving](./refactoring.md).

## `xspec move <old> <new>`

Two forms:

```sh
xspec move <old-file> <new-file>                    # relocate a whole source file
xspec move <file>#<id> <target-file>#<new-id>       # extract/move a section subtree
```

Both rewrite all references (converting between local and imported forms, adding/removing imports as needed), append the mapping to the journal, and regenerate. The section form's exact text edits and refusal conditions are covered in [Renaming and moving](./refactoring.md).

---

## Concurrency

All state is workspace-local. Mutating commands — `rename`, `move`, `review create|resolve|split` — are **mutually exclusive per workspace**: while one runs, a second fails promptly with a usage error (exit `2`) and modifies nothing. Exclusivity ends when the holder's process terminates, even abnormally. Everything else may run concurrently; file writes are atomic in effect (a reader sees the old content or the new, never a torn write), and any derived-file inconsistency from concurrent non-mutating runs is fixed by re-running `build`.

Each mutating command also accepts `--test-hold <path>` — a deterministic test seam that creates the given file after acquiring exclusivity and waits until it is deleted before proceeding. You will not need it outside of testing xspec itself.

## Validation findings catalog

The conditions `build`/`check` report, in SPEC §14 numbering (each finding cites its number). All are reported by both commands except where noted:

| # | Condition |
|---|---|
| 1–4 | Missing ID; invalid structural ID; duplicate ID; invalid segment or tag |
| 5–7 | Unresolved `d` reference; unresolved `text(...)` target; unresolved TypeScript reference |
| 8 | Non-static reference/argument; wrong `text(...)` arity; string-form `text()` in TS |
| 9 | Dependency cycle or spec import cycle (with the full path) |
| 10 | Stale/orphaned generated output — **`check` only** |
| 11 | Cross-module `text` call |
| 12 | Policy violation — **`check` only** |
| 13 | Journal error (malformed/conflicting/unreplayable entries) |
| 14 | Configuration error — reported by every command as exit `2`, precedes all source analysis |
| 15 | Invalid import (in spec or TypeScript files) |
| 16 | Invalid construct (foreign JSX/expression/`export` in a spec file) |
| 17 | Invalid prop on `<S>`/`<Spec>` |
| 18 | Unsupported node usage in TypeScript |
| 19 | Invalid source path (`#` in path, non-UTF-8, non-`.mdx` spec file) |
| 20 | Unparseable source (bad MDX/TypeScript, invalid UTF-8, BOM) |
| 21 | Corrupt review session — `check` and `review` subcommands, not `build` |
| 22 | Symbolic link in a write path |

Multiple conditions are all reported together — not just the first — except where one masks another (an unparseable file hides what's inside it; references into it report as unresolved).
