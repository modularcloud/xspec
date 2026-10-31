# CLI reference

```
xspec <command> [arguments] [flags]
```

Commands: `build`, `check`, `ids`, `show`, `coverage`, `impact`, `review <sub>`, `query <sub>`, `occurrences`, `view`, `at`, `inventory`, `rename`, `move`, `version`.

## Global conventions

These hold for **every** command:

- **`--json`**: print a single JSON document on stdout containing the same information as the human report. `query`, `occurrences`, `view`, `at`, `inventory`, `version`, and `review export` print JSON with or without the flag. The JSON forms that tools can rely on are described in [Machine interface](machine-interface.md#the-json-contract).
- **`--config <path>`**: use this configuration file instead of searching upward from the working directory for `xspec.config.ts`. `version` accepts the flag and ignores it.
- **Flag syntax**:
  - Flags may appear anywhere: before the command, between it and its operands, or after them. `xspec --json ids` works.
  - Flags are spelled `--name`; there are no single-dash short forms.
  - A flag that takes a value takes the whole next token, even one that starts with `-`. Write `--config path`; `--config=path` is not accepted and is reported as an unknown flag.
  - The token `--` ends flag reading: every token after it is an operand, even one that starts with `--`.
  - Each flag may be given at most once.
  - List-valued flags (`--kinds`) take one comma-separated value (`--kinds depends,embeds`). The elements form a set: repeats collapse, and an empty element is an invalid value.
  - Operands must match the command's synopsis exactly. A missing operand and an extra one (`xspec ids extra`) are both usage errors.
- **Arguments**:
  - Node and file arguments (`<node>`, `<graph-node>`, `<file>`, `--file`) are **workspace-relative** (`specs/AUTH.mdx#auth.login`), independent of your working directory.
  - They're read exactly as spelled, with no normalization: `./specs/AUTH.mdx` and `specs//AUTH.mdx` name nothing, and `\` is an ordinary character, not a separator.
  - A node argument contains at most one `#`.
  - Only `--config` and `--test-hold` are ordinary filesystem paths, resolved against the working directory.
  - Every argument value must be valid UTF-8 and must not contain U+FFFD.
- **Streams**: reports, findings included, go to **stdout**. Usage and configuration errors and other diagnostics go to **stderr**. When JSON output is on (`--json` given, or a command that always prints JSON), stdout is exactly one JSON document. For an exit-`2` error that document is an [error document](machine-interface.md#error-documents); without JSON output, an exit-`2` error leaves stdout empty.
- **Determinism**: all output and files are byte-deterministic for identical input: no timestamps, no randomness, no absolute paths. Where "one shortest path" is reported and several tie, the byte-least one is chosen, so it's always the same one. Two outputs depend on the invocation. `inventory` reports the workspace root and configuration file relative to your working directory; those are absolute only on Windows, when the working directory and the workspace root are on different drives. Configuration errors name paths the same way, except that a `--config` path where nothing exists is echoed exactly as you gave it.
- **Comparisons**: IDs, tags, identities, session names, and paths compare byte-wise and case-sensitively throughout.

### Exit codes

| Code | Class | Examples |
|---|---|---|
| `0` | Success | Clean `build`/`check`; every informational report (`ids`, `show`, `impact`, `query`, review reads, `coverage` without `--check`, `version`); complete, finding-free answers from `occurrences`, `view`, `at`, `inventory`, and previews |
| `1` | Findings | `build` on invalid sources; `check` findings; `coverage --check` with uncovered requirements; refused `rename`/`move` and refused previews; refused review operations; a corrupt review session; an answer from `occurrences`, `view`, `at`, `inventory`, or a preview that carries findings or unavailable data (still printed in full) |
| `2` | Usage / configuration errors | Unknown command, subcommand, or flag; missing or extra arguments; invalid or malformed values; an unknown profile, session, group, node, or file named in arguments (except `occurrences --to`); a code file named where a spec file is required; invalid or missing configuration; an unreadable baseline; a busy workspace; a read or write that the environment refuses |
| `70` | Internal error | A crash. This is never a defined outcome; report it |

### Freshness model

`build` is the only command that generates or regenerates TypeScript and Markdown.

The graph-reading commands (`ids`, `show`, `coverage`, `impact`, `review`, `query`, `occurrences`, `view`, `at`) never answer from stale data. If the graph data under `.xspec/` doesn't match the current sources, configuration, and journal, they silently refresh it first. A refresh touches graph data only, never generated TypeScript or Markdown.

On a workspace that fails validation:

- `ids`, `show`, `coverage`, `impact`, `review`, and `query` report the findings and exit `1` without answering.
- `occurrences`, `view`, and `at` answer anyway from the current sources, with the findings attached (exit `1`); see [imperfect workspaces](machine-interface.md#working-on-imperfect-workspaces).
- Either way, nothing is modified.

Argument checks come first: an unknown node, a wrong-kind file, or any other usage error in the arguments exits `2` even on a failing workspace.

`check` never refreshes anything; it reports staleness, including stale graph data, as a finding. `inventory` and previews read the stored record without refreshing it, and write nothing.

---

## `xspec build`

`build` parses configured sources; validates structure, IDs, tags, and references; resolves dependencies; generates TypeScript modules; emits Markdown (if enabled); and writes graph data. It prints nothing on success.

- It does **not** evaluate policy rules. Those are `check` findings only.
- It regenerates every derived file and removes recorded derived files that are no longer generated.
- A failed build **modifies nothing**, whether it fails with findings (exit `1`) or a configuration error (exit `2`).
- If the environment refuses a write (permission denied, a read-only filesystem, a full disk), `build` stops with exit `2` (`write-failure`). The files it already wrote are complete; `check` reports whatever is left stale, and the next successful `build` fixes it.

```sh
$ xspec build
$ echo $?
0
```

With `--json`, the report is `{"findings": [...]}`.

## `xspec check`

`check` runs every `build` validation (references, cycles, and journal integrity included) without writing anything, and additionally verifies:

- every generated module, companion, and emitted Markdown file is present as a plain file with exactly the generated content;
- graph data is up to date;
- no recorded derived file remains at a path that's no longer generated, and the recorded generation state is readable;
- **no policy violations** exist (evaluated only when the workspace otherwise passes validation);
- review sessions are intact.

It exits `1` on any finding. Findings print to stdout one per line, followed by a count. Each line gives the location (`file:start-end`, byte offsets) or the path concerned, then the finding's [code](#validation-findings-catalog), then the message:

```sh
$ xspec check
specs/AUTH.mdx:449-471: invalid-structural-id: invalid structural ID "unrelated.section": a top-level section's ID is checked against the empty prefix and is exactly one segment (SPEC 1.3, 14.2)
1 finding
```

A finding with several locations lists the rest as `(also at …)`, and one with context identities (a policy violation's rule and edge, a refusal's identity) ends with them in `[…]`. With `--json`, the report is `{"findings": [...]}`, each finding carrying `code`, `message`, `locations`, `path`, and `identities` ([details](machine-interface.md#findings)).

Every finding names the location, the condition, and the correction. `check` is the CI gate: the everyday invariant is that `xspec build && xspec check` proves a workspace clean.

## `xspec ids`

`ids` lists requirement IDs grouped by file: every spec source in byte order (a file with no sections included), each with its IDs in document order.

| Flag | Meaning |
|---|---|
| `--tree` | Render each file's IDs as a nested tree instead of a flat list |
| `--file <glob>` | Restrict to spec files matching the glob |
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

`--unreferenced` answers "what does nothing point at?" That isn't the same as uncovered: a node can be referenced by something outside a profile's boundary and still be uncovered.

## `xspec show <node>`

`show` prints one requirement for human reading: identity, source range, tags, coverage attribute, all four hashes, incoming and outgoing edges by kind, own text, and subtree text. `<node>` is `path#id`, or a bare `path` for a file's root node (a root has no tags or coverage attribute). `xspec query node` is the machine-facing equivalent.

## `xspec coverage [<profile>] [--check]`

`coverage` runs all configured coverage profiles, or one by name. It reports counts plus the identity of every covered node (with one shortest covering path), every uncovered node, and every ignored node (with exclusion reasons). With `--check`, it exits `1` if any required node is uncovered. See [Coverage](coverage.md).

## `xspec impact --base <git-ref>`

`impact` compares the current workspace against the graph reconstructed at a git ref, with identities mapped through the journal. It reports requirement change categories with attribution, then directly and transitively impacted code with witness paths. It's informational and exits `0` either way. See [Impact analysis](impact.md).

## `xspec review …`

`review` runs staged review sessions over graph results. There are eight subcommands:

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
xspec review export <name> [--json]
```

- `create` requires exactly one of `--base`, `--strategy audit`, and `--coverage`.
- `resolve --status` accepts `updated`, `no-change`, and `skipped`. Each resolve replaces the item's status and note, so resolving without `--note` clears an earlier note.
- `export` always prints JSON.
- Item IDs are opaque strings (for example `ra339e60b52c169bf`); copy them from `status`, `next`, or `export`.
- Sessions live in `.xspec/reviews/<name>.json`. Names may contain only `A–Z a–z 0–9 . _ -` and must not start with `.`.

See [Reviews](reviews.md) for the model and a worked session.

## `xspec query <sub>`

`query` gives scripts and agents set-level, **JSON-only** access to the graph:

```sh
xspec query node <node>
xspec query nodes [--group <g>] [--file <glob>] [--tag <t>] [--coverage required|none]
xspec query edges [--from <graph-node>] [--to <graph-node>] [--kinds <kinds>]
xspec query subtree <node>
xspec query ancestors <node>
xspec query reachable --from <graph-node> --to <graph-node> [--kinds <kinds>]
```

- `<node>` is a requirement identity (`path#id`, or a bare `path` for a root).
- `<graph-node>` is a requirement identity or a code location (`path`, `path#unit`, `path#unit@N`). Whether a bare path is a spec root or a code file follows from its group.
- `node` returns identity, source range, own and subtree text, all four hashes, tags, coverage attribute, and all edges. For a root, tags and coverage attribute are both absent.
- `nodes`, `subtree`, and `ancestors` return one row per node (identity, range, tags, coverage). `subtree` is the node plus its descendants in document order; `ancestors` is the proper ancestors, nearest first.
- `nodes` filters combine conjunctively. `--group` takes a spec group name only. `--tag` accepts any well-formed tag: one that no node carries matches nothing, and only a malformed spelling (empty, or containing whitespace or a quote) is a usage error.
- Edge endpoints (in `edges`, `reachable` paths, and a node's edge lists) are bare identities. Source ranges for code locations appear in [`occurrences`](#xspec-occurrences) and review payloads.
- `edges` filters over all four kinds. `reachable` accepts only the three dependency kinds and reports whether a dependency path exists, plus one shortest witness:

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

## `xspec occurrences`

```sh
xspec occurrences [--file <glob>] [--to <node>]
```

`occurrences` lists every reference spelling with its exact position: each `d` entry, `{text(...)}` embedding, TypeScript `text(...)` call, and marker. Each record carries the referencing file, its range, its edge kind, its source node (with that node's range), and its target. `--to` selects references to one node. It accepts any well-formed identity, so a node that doesn't resolve just matches nothing. `--file` restricts the files consulted. Output is always JSON. It answers even on a workspace with findings, attaching them (exit `1`). See [Machine interface](machine-interface.md#references-xspec-occurrences).

## `xspec view`

```sh
xspec view [<file> …] [--file <glob>] [--text]
```

`view` returns each spec file's structure positioned on its bytes: the section tree with tag and attribute ranges, interpreted identity, tags, and coverage (and with `--text`, own and subtree text), plus every import, reference occurrence, and comment. Name files as operands (they must be discovered spec sources) or select them with `--file`, but not both; with neither, every spec source is included. Output is always JSON, and it answers even on imperfect files. See [Machine interface](machine-interface.md#document-structure-xspec-view).

## `xspec at`

```sh
xspec at <file> <offset>
```

`at` resolves a byte offset in a spec source to the innermost enclosing section and, when the offset falls inside one, the reference occurrence at that position. Offsets run from `0` through the file's length. Output is always JSON. See [Machine interface](machine-interface.md#positions-xspec-at).

## `xspec inventory`

```sh
xspec inventory
```

`inventory` reports the workspace's shape for tools:

- the workspace root and configuration file, relative to the working directory;
- the resolved configuration;
- every discovered source with its groups;
- each spec source's derived paths;
- the recorded derived files;
- the `.xspec` area: the journal, the review sessions, and the lock directory.

It parses no sources and writes nothing. Output is always JSON. See [Machine interface](machine-interface.md#workspace-shape-xspec-inventory).

## `xspec rename <file> <old-id> <new-id> [--preview]`

`rename` renames a requirement ID. It rewrites descendant IDs and **every reference across the workspace** (spec `id`s, `d` refs, `text(...)` refs, TypeScript markers), and appends the identity mapping to the journal. On success it finishes by regenerating derived files and reports the mapping it applied:

```sh
$ xspec rename specs/AUTH.mdx auth.lockout auth.throttling
specs/AUTH.mdx#auth.lockout -> specs/AUTH.mdx#auth.throttling
1 identity mapped
```

It refuses (exit `1`) rather than corrupt anything: an invalid or colliding new ID, an unchanged identity, broken structural rules, or a workspace that doesn't currently pass `build` validation. Each refusal reason has its own [code](#refusal-reasons). `--preview` plans and reports the operation without performing it. `<file>` must be a spec source; a nonexistent file or old ID, or a code file, is a usage error (exit `2`). See [Renaming and moving](refactoring.md).

## `xspec move <old> <new> [--preview]`

`move` has two forms:

```sh
xspec move <old-file> <new-file>                    # relocate a whole source file
xspec move <file>#<id> <target-file>#<new-id>       # extract/move a section subtree
```

An operand containing `#` is a `file#id` pair, and one without is a file. Mixing the two forms is a usage error. Both forms rewrite all references (converting between local and imported forms, adding and removing imports as needed), append the mapping to the journal, regenerate, and report the mapping they applied, as `rename` does. `--preview` plans and reports without performing. The section form's exact text edits and every refusal condition are covered in [Renaming and moving](refactoring.md).

## `xspec version`

`version` reports the product version and the machine-interface version as JSON:

```sh
$ xspec version
{
  "interface": "1",
  "product": "0.3.0"
}
```

It consults no workspace and no configuration, so it gives the same answer anywhere, even where other commands would report a configuration error. See [Machine interface](machine-interface.md#compatibility-check-xspec-version).

---

## Concurrency

All state is workspace-local.

**Mutating commands exclude each other.** The mutating commands are `rename`, `move`, `review create`, `review resolve`, and `review split`; previews are not mutating. They're **mutually exclusive per workspace**: while one runs, a second fails promptly with exit `2` (code `workspace-busy`) and modifies nothing. This holds for every process on one machine, whatever path or symbolic link they reach the workspace through. It does **not** extend across machines that share the directory, such as different hosts, or a container with its own process namespace and its host. Don't run mutating commands against one workspace from several machines at once.

**The lock lives in `.xspec/lock`.** That directory is transient: it exists only while a mutating command runs, or as a leftover.

- **Leftovers clean themselves up.** A command that dies abnormally leaves its entry behind, and the next mutating command removes it automatically once that process is gone.
- **Two rare cases need a hand.** If a leftover's recorded process ID is still in use by another process, mutating commands are refused as busy until that process exits. And if `.xspec` isn't a directory, or `.xspec/lock` is something other than a directory or a plain file (a symbolic link, say), mutating commands fail with `write-failure`. In either case, delete the offending path by hand while no mutating command is running.

**Everything else may run concurrently**, including previews. File writes are atomic in effect: a reader sees each file's old content or its new content, never a torn write. Any derived-file inconsistency from concurrent non-mutating runs is fixed by running `build` again.

Each mutating command also accepts `--test-hold <path>`, a deterministic test seam: after acquiring exclusivity, the command creates the given file and waits until it's deleted before going on. It can't be combined with `--preview`. You won't need it outside of testing xspec itself.

## Validation findings catalog

These are the conditions xspec reports, numbered as in the specification. Each has a stable code, shown in the human report and as `code` in JSON. Unless noted, `build` and `check` both report each condition.

| # | Code | Condition |
|---|---|---|
| 1 | `missing-id` | A non-root section with no `id` |
| 2 | `invalid-structural-id` | An ID that isn't its parent's ID plus one segment (including IDs that skip levels) |
| 3 | `duplicate-id` | Two sections in one file with the same ID |
| 4 | `invalid-segment-or-tag` | An ID segment or tag that breaks the [character rules](writing-specs.md#segment-rules) |
| 5 | `unknown-dependency` | A `d` reference that doesn't resolve |
| 6 | `unknown-text-target` | A `text(...)` target that doesn't resolve |
| 7 | `unknown-ts-reference` | A TypeScript marker or `text` call that doesn't resolve |
| 8 | `invalid-argument` | A non-static reference or argument; wrong `text(...)` arity; string-form `text()` in TypeScript |
| 9 | `cycle` | A dependency cycle or spec import cycle (located along its full path) |
| 10 | `stale-output` | A generated file that is missing, not a plain file, or not what the sources generate; stale graph data; an orphaned recorded derived file; an unreadable record. **`check` only** |
| 11 | `cross-module-text` | A node passed to another spec module's `text` |
| 12 | `policy-violation` | A policy rule violated. **`check` only**, and only on a workspace that passes `build`'s validations |
| 13 | `journal-error` | Malformed, conflicting, or unreplayable journal entries; a journal path that isn't a plain file; an unreadable journal |
| 14 | `configuration-error` | Missing or invalid configuration |
| 15 | `invalid-import` | An invalid import (in spec or TypeScript files) |
| 16 | `invalid-construct` | A foreign JSX element or fragment, a foreign expression, or an `export` in a spec file |
| 17 | `invalid-prop` | An unknown, repeated, spread, or wrongly formed prop on `<S>`/`<Spec>` |
| 18 | `unsupported-node-usage` | A spec binding or node used in TypeScript other than as a marker, a child access, or a `text` argument |
| 19 | `invalid-source-path` | A discovered source path containing `#` or U+FFFD, or not valid UTF-8; a spec file not ending in `.mdx`, or whose path contains `"`, `'`, `\`, a line break, U+2028, or U+2029 |
| 20 | `unparseable-source` | A source that isn't well-formed MDX or TypeScript, isn't valid UTF-8, starts with a byte-order mark, or can't be read |
| 21 | `corrupt-session` | A damaged review session. Reported by `check` and the `review` subcommands, not `build` |
| 22 | `obstructed-write-path` | A directory along a path xspec writes is occupied by a file, a symbolic link, or another non-directory |
| 23 | `unreadable-record` | Recorded generation state that exists but can't be read. Reported by `inventory` and previews; `check` reports this state as `stale-output` |
| 24 | `write-failure` | The environment refused a write (permission denied, a read-only filesystem, a full disk) |
| 25 | `read-failure` | The environment refused a read (an unreadable source file is condition 20 instead) |
| 26 | `workspace-busy` | Another mutating command holds the workspace |

Conditions 14, 24, 25, and 26 are errors rather than findings: the command stops with exit `2`, and with JSON output on, they arrive as an [error document](machine-interface.md#error-documents) carrying the code and the concerned path. A configuration error is reported by every command except `version`, before any source is read. A journal error met while resolving a `--base` baseline is likewise an exit-`2` error.

When several conditions are present they're all reported together, not just the first, except where one masks another: an unparseable file hides what's inside it, and references into it report as unresolved.

### Refusal reasons

A refused `rename` or `move`, or its refused preview, reports one finding per applicable reason, each with its own code (exit `1`):

| Code | Refused because |
|---|---|
| `refused-invalid-id` | The new ID isn't a valid ID |
| `refused-identity-unchanged` | The new identity equals the old one (including the exact self-move) |
| `refused-id-collision` | The new ID, or an ID it produces for a descendant, collides with an ID that would remain |
| `refused-structural-parent` | The new ID would break the structural parent rules |
| `refused-cycle` | The move would create a spec import cycle or a dependency cycle |
| `refused-destination-exists` | The file form's destination already exists, or the section form's target path holds something other than a spec source |
| `refused-missing-target-parent` | The section form's target parent is missing or lies inside the moved subtree |
| `refused-invalid-destination` | The destination wouldn't be a valid spec source, or a directory along it, or along a derived path it would generate, is obstructed |
| `refused-exposed-derived-file` | A file move would leave the origin's emitted Markdown where a configured glob would pick it up as a source |
| `refused-invalid-rewrite` | The section move's exact edits would leave a file not well-formed MDX, or a file has no valid place for an import it needs |
| `refused-moved-import` | The moved section contains an import declaration |

If the workspace fails `build` validation, the operation is refused with the workspace's own findings instead, and only those. See [Renaming and moving](refactoring.md#validation-and-refusals).
