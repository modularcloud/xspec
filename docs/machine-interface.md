# Machine interface: building tools on xspec

xspec is headless. It has no UI of its own and no server: its whole interface is the CLI, the configuration, the source syntax, the generated modules, and the files it writes. Editors, dependency visualizers, CI annotators, and agents connect through the CLI. Every command speaks JSON, every output is byte-deterministic, and reads are safe to run concurrently, so a tool simply runs xspec again whenever it needs a fresh answer.

This page covers the surfaces built for such tools:

| Command | What it answers |
|---|---|
| [`xspec version`](#compatibility-check-xspec-version) | Which machine interface this build speaks |
| [`xspec inventory`](#workspace-shape-xspec-inventory) | Where the workspace is, which files xspec reads, and which it owns |
| [`xspec view`](#document-structure-xspec-view) | A document's full structure, positioned on its raw bytes |
| [`xspec occurrences`](#references-xspec-occurrences) | Every reference spelling, with its position, in both directions |
| [`xspec at`](#positions-xspec-at) | What is at a given byte offset |
| [`rename`/`move --preview`](#previews-before-refactoring) | What a refactoring would change, without changing anything |

It also covers the [JSON contract](#the-json-contract) these commands share and the [diagnostics](#diagnostics) that let a tool show findings inline. `xspec query` (set-level graph access) is covered in the [CLI reference](cli.md#xspec-query-sub).

Two limits to design around:

- xspec reads files **as saved on disk**. It never sees unsaved editor buffers, so validate on save.
- There is **no watch mode or long-running service**. Run xspec again after each change.

## Compatibility check: `xspec version`

```sh
$ xspec version
{
  "interface": "1",
  "product": "0.2.0"
}
```

`interface` is the machine-interface version. It names the JSON contract the specification defines, and it changes whenever that contract changes. Compare it with the value your tool was built against. `product` is the release version, for display and support only.

`version` always prints JSON and doesn't depend on any workspace. It reads no configuration, so it gives the same answer anywhere, even with no project or a broken `xspec.config.ts`. That makes it a safe first call.

## The JSON contract

Every command accepts `--json`. `query`, `occurrences`, `view`, `at`, `inventory`, `version`, and `review export` print JSON whether or not you pass it. The output is always a single JSON document that makes up all of stdout.

### Value forms

- **Ranges** are `{"start": n, "end": n}`: byte offsets into the file, counted from zero, with `end` exclusive. Every range xspec reports uses this one convention: nodes, code locations, occurrences, findings, view entries, and preview edits.
- **Paths** are workspace-relative strings with `/` separators. A path whose bytes are not valid UTF-8 appears as `{"bytes": "<lowercase hex>"}`, an object that can't be mistaken for a plain path.
- **Each datum is in one of three states**:
  - a plain value;
  - `null` where the datum doesn't apply, such as a root node's tags, a flag you didn't give, or a refused preview's plan;
  - `{"unavailable": true}` where the datum exists in principle but can't be determined right now (see [imperfect workspaces](#working-on-imperfect-workspaces)).

  Members are never left out. An empty list is always `[]`, never `null`.
- **Tag sets** are arrays sorted bytewise. **Edge-kind sets** list `depends`, `embeds`, `references`, in that order.

### Findings

Every finding has the same shape, whether it's a validation error, a refused operation, or a finding attached to an answer:

```json
{
  "code": "invalid-structural-id",
  "identities": [],
  "locations": [
    { "file": "specs/AUTH.mdx", "range": { "end": 471, "start": 449 } }
  ],
  "message": "invalid structural ID \"unrelated.section\": a top-level section's ID is checked against the empty prefix and is exactly one segment (SPEC 1.3, 14.2)",
  "path": null
}
```

- `code` is the stable machine-readable code from the [catalog](cli.md#validation-findings-catalog). Refused review operations are the one case with `null` here.
- `locations` holds one `{file, range}` for each construct at fault, so a condition involving several constructs has several.
- `path` is the file or path that a finding without a source location concerns. It's `null` for located findings.
- `identities` holds context, such as a policy violation's rule name and edge, or the identity a refusal concerns.
- `message` is human-readable text. Don't parse it.

A report that consists only of findings is `{"findings": [...]}`. That covers `build`, `check`, refused operations, and a read refused on an invalid workspace. Findings are sorted deterministically: by code, then location, path, identities, and message.

### Error documents

A usage or configuration error exits `2`. If JSON output is on, stdout is then a single **error document**. JSON output is on when `--json` appears anywhere on the command line (even when the arguments themselves are the error) or when the command always prints JSON. For example, `xspec ids --json` run outside any project prints:

```json
{
  "error": {
    "code": "configuration-error",
    "identities": [],
    "locations": [],
    "message": "no xspec.config.ts found by upward search from the working directory — create one in the project root or pass --config <path> (SPEC 7)",
    "path": "."
  }
}
```

`error` holds one finding.

- `code` and `path` are set for configuration errors, journal errors met while resolving a baseline, write and read failures, and a busy workspace.
- They are `null` for plain usage errors such as an unknown flag, a malformed value, or an unknown node. Those describe your tool's own command line, not anything in the workspace.

The human-readable message still goes to stderr, and the exit code doesn't change. When JSON output is off, an exit-`2` error leaves stdout empty.

### Exit codes

`view`, `occurrences`, `at`, and `inventory` answer even when the workspace has problems. For them, and for previews, the exit codes mean:

- `0`: a complete answer with no findings.
- `1`: an answer that carries findings or `{"unavailable": true}` data. **The full answer is still printed.** For these commands, exit `1` means the answer is imperfect, never that there is no answer. A refused preview also exits `1`, with its refusal findings in the preview's own document form.
- `2`: a usage or configuration error (the error document above).

## Workspace shape: `xspec inventory`

```sh
xspec inventory
```

A tool that edits files needs to know which files xspec reads, which it owns, and where the workspace actually is. `inventory` reports all of that. Here is an excerpt, run from the [example project](getting-started.md#the-example-in-the-other-pages)'s `specs/` directory:

```json
{
  "config": "../xspec.config.ts",
  "configuration": { "code": [ … ], "coverage": [ … ], "markdown": { "emit": true, "outDir": null }, "policy": [], "specs": [ … ] },
  "derived": [
    { "markdown": "specs/AUTH.md", "module": "specs/AUTH.xspec.ts", "source": "specs/AUTH.mdx" },
    …
  ],
  "findings": [],
  "graphData": ".xspec",
  "journal": { "occupied": false, "path": ".xspec/journal" },
  "lock": ".xspec/lock",
  "recorded": [ "specs/AUTH.md", "specs/AUTH.xspec.impl.d.ts", "specs/AUTH.xspec.impl.d.ts.map", "specs/AUTH.xspec.ts", … ],
  "root": "..",
  "sessions": [],
  "sources": [
    { "groups": [ { "kind": "spec", "name": "product" } ], "path": "specs/AUTH.mdx" },
    …
  ]
}
```

- **`root`, `config`**: the workspace root and the configuration file, relative to the **working directory**, where `.` is the working directory itself. Use them to map every workspace-relative path xspec prints to a real file rather than repeating xspec's upward search for the config. If a tool guesses the root wrong, it edits the wrong files. (On Windows, when the working directory and the root are on different drives, these two are absolute paths.)
- **`configuration`**: the resolved configuration with every default spelled out: groups with their globs, `markdown` (`{"emit": false, "outDir": null}` when the key is absent), and every coverage profile and policy rule in full. References to groups stay group names.
- **`sources`**: every discovered source file with the groups it belongs to.
- **`derived`**: for each spec source, its generated module and, while Markdown emission is on, its Markdown destination. These come from the configuration, so they're known before any build has run.
- **`recorded`**: the derived-file paths as last generated, companions included. This list can lag behind the configuration until the next build, and it's empty before the first build.
- **`graphData`, `journal`, `sessions`, `lock`**: the `.xspec` area and what's in it. `journal` gives the journal path and whether anything occupies it, `sessions` lists the review-session files present, and `lock` is the lock path.

The inventory implies these rules for any tool that edits files:

- **Never create, edit, or keep anything of your own under `.xspec/`.** That area is reserved for xspec's writes.
- **Treat every unlisted path under `.xspec/` as undeletable.** Such a path may be xspec's graph data, which the next build would restore, or someone else's content, which nothing would restore. Don't treat the area as something you can wipe either: the journal and review sessions inside it are durable and can't be regenerated.
- **Don't edit derived files.** xspec replaces them on every build, and `check` reports hand edits as staleness.
- **Leave `.xspec/lock` alone.** It's transient coordination state (see [Workspace files](workspace.md#derived-durable-and-transient)).

`inventory` parses no sources, so it answers however broken they are. Configuration errors still come first. It never refreshes or writes anything.

Its only possible finding is `unreadable-record`. That happens when recorded generation state exists but can't be read, for example a graph-data file left with merge-conflict markers. `recorded` is then `{"unavailable": true}`, the finding's `path` is `.xspec`, the exit code is `1`, and everything else is still reported. A successful `xspec build` repairs the record.

## Document structure: `xspec view`

```sh
xspec view [<file> …] [--file <glob>] [--text]
```

In one call, `view` returns everything needed to overlay structure on a spec file's raw MDX bytes:

- **The section tree**, from the root, in document order. Each node has:
  - its `range`;
  - its `opening` and `closing` tag ranges (a self-closing section has only `opening`, and the root has neither);
  - its `attributes` exactly as spelled, each `{name, range, text}`, including repeated, unknown, and spread attributes;
  - its interpreted `identity`, `tags`, and `coverage`;
  - with `--text`, also `ownText` and `subtreeText`, fully expanded.
- **Every import declaration**, valid or not, as `{range, name, target}`. `name` is `null` when the import binds no default name. `target` is the spec file it points to, or unavailable.
- **Every reference occurrence** in the file, in the same record form as [`occurrences`](#references-xspec-occurrences).
- **The range of every MDX comment**, braces included.

Tags, imports, comments, and `{text(...)}` embeddings are exactly the constructs that Markdown compilation removes. So on a file with no findings, a tool can tell for every byte whether it's annotation or content from the view alone, without parsing MDX itself. On a file with findings, the findings' ranges position whatever the view doesn't list.

For the example project's `specs/OVERVIEW.mdx` (see [Getting started](getting-started.md#the-example-in-the-other-pages)):

```mdx
import AUTH from "./AUTH.xspec"

<S id="overview" coverage="none" d={AUTH.auth}>
The product summary, for context.
</S>
```

`xspec view specs/OVERVIEW.mdx` prints:

```json
{
  "findings": [],
  "views": [
    {
      "comments": [],
      "file": "specs/OVERVIEW.mdx",
      "imports": [
        { "name": "AUTH", "range": { "end": 31, "start": 0 }, "target": "specs/AUTH.mdx" }
      ],
      "occurrences": [
        {
          "file": "specs/OVERVIEW.mdx",
          "kind": "depends",
          "range": { "end": 78, "start": 69 },
          "source": { "identity": "specs/OVERVIEW.mdx#overview", "range": { "end": 119, "start": 33 } },
          "target": "specs/AUTH.mdx#auth"
        }
      ],
      "root": {
        "attributes": [],
        "children": [
          {
            "attributes": [
              { "name": "id", "range": { "end": 49, "start": 36 }, "text": "id=\"overview\"" },
              { "name": "coverage", "range": { "end": 65, "start": 50 }, "text": "coverage=\"none\"" },
              { "name": "d", "range": { "end": 79, "start": 66 }, "text": "d={AUTH.auth}" }
            ],
            "children": [],
            "closing": { "end": 119, "start": 115 },
            "coverage": "none",
            "identity": "specs/OVERVIEW.mdx#overview",
            "opening": { "end": 80, "start": 33 },
            "range": { "end": 119, "start": 33 },
            "tags": []
          }
        ],
        "closing": null,
        "coverage": null,
        "identity": "specs/OVERVIEW.mdx",
        "opening": null,
        "range": { "end": 120, "start": 0 },
        "tags": null
      }
    }
  ]
}
```

The root's `tags` and `coverage` are `null` because roots have neither. A section with no tags has `[]`.

Choosing files:

- `<file>` operands must name discovered spec sources. An unknown file, or a code file (which has no structural view), is a usage error.
- `--file <glob>` restricts the request to the spec sources the glob matches. A glob that matches none gives an empty answer with exit `0`, not an error.
- With neither, every spec source is included. Operands and `--file` can't be combined.
- Views come in path order, all in one document, so one call can index a whole workspace.

An unparseable file has no entry in `views`; its `unparseable-source` finding reports it. With `--text`, the files that embedded text is drawn from are consulted too, and their findings come with the answer.

## References: `xspec occurrences`

```sh
xspec occurrences [--file <glob>] [--to <node>]
```

An **occurrence** is one written reference that records a dependency edge. There are four kinds: one entry of a `d` prop, one MDX `{text(...)}` embedding, one TypeScript `text(...)` call, and one TypeScript marker. Graph edges merge duplicates, but occurrences don't: every reference is listed with its own position. Each record has:

- `file` and `range`: where the reference is written. Spans are exact for each kind:
  - a `d` entry covers its own expression;
  - an MDX embedding covers the whole `{text(...)}` container, braces included;
  - a TypeScript `text(...)` call runs from the callee through the closing parenthesis;
  - a marker covers the bare reference chain, without any `;`.
- `kind`: `depends`, `embeds`, or `references`.
- `source`: the node the reference is written in (a section or a code location), with that node's own range, as `{identity, range}`.
- `target`: the identity of the node referenced.

Records are ordered by file, then by range.

To find every reference to a requirement:

```sh
$ xspec occurrences --to "specs/AUTH.mdx#auth.login.valid"
```

```json
{
  "findings": [],
  "occurrences": [
    {
      "file": "src/auth.ts",
      "kind": "references",
      "range": { "end": 129, "start": 108 },
      "source": { "identity": "src/auth.ts#login", "range": { "end": 183, "start": 47 } },
      "target": "specs/AUTH.mdx#auth.login.valid"
    },
    {
      "file": "test/auth.test.ts",
      "kind": "references",
      "range": { "end": 116, "start": 95 },
      "source": { "identity": "test/auth.test.ts#testValidLogin", "range": { "end": 155, "start": 57 } },
      "target": "specs/AUTH.mdx#auth.login.valid"
    },
    {
      "file": "test/auth.test.ts",
      "kind": "embeds",
      "range": { "end": 153, "start": 126 },
      "source": { "identity": "test/auth.test.ts#testValidLogin", "range": { "end": 155, "start": 57 } },
      "target": "specs/AUTH.mdx#auth.login.valid"
    }
  ]
}
```

To list every reference a file makes, run `xspec occurrences --file src/auth.ts`. The two filters combine: `--file "test/**" --to <node>` asks which tests reference a node.

- **`--to` accepts any well-formed requirement identity**, whether or not the node exists. A node that doesn't resolve, now or ever, matches nothing. Only a malformed spelling such as `specs/A.mdx#a..b` is a usage error. That way "who references this section?" gets an answer even while the section's own file is broken.
- **`--file` restricts which files are consulted**, spec and code alike. A glob that matches nothing gives an empty answer with exit `0`.
- **An empty answer with no findings is definitive.** Without `--file`, it means nothing in the workspace references the node. With `--file`, it means nothing *in those files* does, because files outside the glob weren't consulted.

References that record no edge produce no occurrence: import declarations themselves, type-only references, identifiers shadowed by a local declaration, and references that are dynamic or don't resolve. The invalid ones are positioned by their [findings](#diagnostics) instead. Between them, occurrences and findings locate every written reference in every parseable file.

## Positions: `xspec at`

```sh
xspec at <file> <offset>
```

`at` resolves a byte offset in a spec source. It reports the innermost section that contains the offset (the root when no section does). When the offset falls inside a reference occurrence, it also reports that occurrence:

```sh
$ xspec at specs/OVERVIEW.mdx 72
```

```json
{
  "findings": [],
  "resolution": {
    "occurrence": {
      "file": "specs/OVERVIEW.mdx",
      "kind": "depends",
      "range": { "end": 78, "start": 69 },
      "source": { "identity": "specs/OVERVIEW.mdx#overview", "range": { "end": 119, "start": 33 } },
      "target": "specs/AUTH.mdx#auth"
    },
    "section": { "identity": "specs/OVERVIEW.mdx#overview", "range": { "end": 119, "start": 33 } }
  }
}
```

- `occurrence` is `null` when the offset isn't inside any occurrence.
- Every offset from `0` through the file's length (the caret at end of file) resolves. A larger offset, or one that isn't plain decimal digits, is a usage error.
- On an unparseable file, `resolution` is `{"unavailable": true}` and the parse-failure finding comes with it (exit `1`).

A `view` of the file contains everything needed to compute the same answer, so a tool that builds its own index doesn't need `at`.

## Working on imperfect workspaces

The other read commands (`ids`, `show`, `query`, `coverage`, …) refuse to answer while the workspace fails validation. `view`, `occurrences`, and `at` keep answering, because an editor needs answers exactly while someone is in the middle of an edit. These rules govern their answers:

- **Structure comes from each file's own parse.** The section tree, ranges, attribute and import spellings, comments, and occurrence positions stay available while other files are broken and while the file itself has findings. Only an unparseable file loses its structure, and only that file.
- **Interpreted data is either defined or explicitly unavailable, never guessed.**
  - A section's `identity` is defined only when it and every enclosing section each carry exactly one quoted `id`, every one of those IDs is well-formed and structurally valid, and no other section in the file has the same ID as the section itself.
  - Duplicate IDs leave *every* section that carries them undefined; no winner is picked.
  - A section inside one whose ID is missing or invalid is undefined too. A uniquely named section inside duplicated ones keeps its identity.
  - A repeated or invalid `tags` or `coverage` prop leaves that value undefined. Its raw spelling is still in `attributes`.
  - Undefined data shows up as `{"unavailable": true}`.
- **References resolve only to defined identities.** A reference to an undefined or unknown node records no occurrence, and its finding carries its position instead. An occurrence inside a section whose identity is undefined is still listed, with `source` unavailable.
- **Expanded text is all or nothing.** With `--text`, a node's text is unavailable if any embedding it pulls in, directly or through other embeddings, fails to resolve or forms a cycle. Partly expanded text is never reported.
- **Findings come with the answer.** The findings of every consulted file are attached, and the exit code is `1`, so a possibly incomplete answer is never silent.
- **These commands never give stale answers, and they never write to a broken workspace.** On a valid workspace they refresh graph data the way every read does. On an invalid one they answer from the current sources and modify nothing.

## Diagnostics

Findings are designed to be shown inline in an editor:

- Every finding carries a stable `code`: one of the numbered conditions or refusal reasons in the [catalog](cli.md#validation-findings-catalog).
- Every finding that points into source carries one range per construct at fault, at a defined precision:
  - a missing `id` points at the section's opening tag;
  - an invalid `id`, `tags`, or other prop points at that attribute;
  - an unresolved or non-static reference points at the span its occurrence would cover;
  - duplicate IDs point at every section that carries them;
  - a cycle points at every reference (or import) along it.
- A finding about a file or path rather than a construct carries it in `path`. That covers configuration, staleness, the journal, review sessions, and similar conditions. Configuration-error paths are relative to the working directory, like `inventory`'s `root`.
- An unparseable file carries one zero-length range at the offset where parsing fails. One known limit: for some unusual MDX constructions, the offset reported can differ from the exact one the specification fixes.

The human-readable report shows the same information, one finding per line. The line starts with the location (or path) and the code. Further locations follow as `(also at …)`, and context identities as `[…]`:

```
specs/DUP.mdx:3-11: duplicate-id: duplicate ID "dup": 2 sections bear this ID — IDs must be unique within a source file; rename all but one of the sections (SPEC 1.3, 14.3) (also at specs/DUP.mdx:27-35)
1 finding
```

## Previews before refactoring

`xspec rename … --preview` and `xspec move … --preview` run all of the operation's validation and planning, then report what it *would* do. They modify nothing: no sources, no journal, no derived files, no graph data. For a section move whose subject is referenced from test code:

```sh
$ xspec move "specs/AUTH.mdx#auth.login.invalid" "specs/ERRORS.mdx#errors" --preview --json
```

```json
{
  "delta": {
    "generated": [ "specs/ERRORS.md", "specs/ERRORS.xspec.impl.d.ts", "specs/ERRORS.xspec.impl.d.ts.map", "specs/ERRORS.xspec.ts" ],
    "removed": []
  },
  "files": [
    {
      "edits": [
        { "class": "origin-deletion", "range": { "end": 316, "start": 204 } },
        { "class": "id-rewrite", "range": { "end": 230, "start": 207 } }
      ],
      "file": "specs/AUTH.mdx"
    },
    { "edits": [ { "class": "file-creation", "range": { "end": 0, "start": 0 } } ], "file": "specs/ERRORS.mdx" },
    {
      "edits": [
        { "class": "import-addition", "range": { "end": 49, "start": 49 } },
        { "class": "reference-rewrite", "range": { "end": 225, "start": 202 } }
      ],
      "file": "test/auth.test.ts"
    }
  ],
  "findings": [],
  "mapping": [ { "from": "specs/AUTH.mdx#auth.login.invalid", "to": "specs/ERRORS.mdx#errors" } ]
}
```

- **`mapping`** lists every identity that would change, exactly what the operation would record in the journal.
- **`files`** lists every file the operation would rewrite, relocate, or create, with every edit as a `class` and a `range` in the file as it is now. The classes are:
  - `reference-rewrite`;
  - `id-rewrite`;
  - `import-specifier-rewrite`;
  - `import-addition`;
  - `import-removal`;
  - `origin-deletion`;
  - `target-insertion`;
  - `target-parent-rewrite`;
  - `file-relocation`;
  - `file-creation`, the one edit with no range in an existing file. It sits at `0`–`0` of the file to be created and covers that file's whole initial content.

  Insertions have zero-length ranges, and ranges can nest: an `id` rewrite falls inside the moved section's `origin-deletion`.
- **`delta`** lists the derived files the operation would newly generate and the recorded ones it would stop generating.

Edits carry no replacement text. A preview is a safety report, not a patch for your tool to apply itself. Run the operation to get the result, along with the journal entry that preserves identity.

A preview is refused exactly when the operation would be, with the same findings and exit code; `mapping`, `files`, and `delta` are then `null`. A preview takes no workspace lock, so it never blocks other commands or waits for them, and `--test-hold` isn't accepted with `--preview`. If the derived-file record is unreadable, the preview still succeeds, with `delta` unavailable and an `unreadable-record` finding (exit `1`).

The operation itself, when it succeeds, reports the mapping it applied: `{"findings": [], "mapping": [...]}` in JSON. See [Renaming and moving](refactoring.md) for the edits themselves and every refusal reason.

## Concurrency

Reads, including `view`, `occurrences`, `at`, `inventory`, and previews, can run at any time, alongside each other and alongside mutating commands. Every file write is atomic, so a reader sees each file whole, either before or after a change. Mutating commands (`rename`, `move`, `review create`, `review resolve`, `review split`) exclude each other per workspace: a second one fails immediately with exit `2` and code `workspace-busy`. See [Concurrency](cli.md#concurrency) for the details and limits.
