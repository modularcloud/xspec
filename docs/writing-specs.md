# Writing specs

xspec source files are MDX documents (`.mdx`) in which requirement sections are marked with `<S>` tags. Everything else in the file is ordinary Markdown. This page covers the complete authoring syntax; validation of every rule here is enforced by `xspec build` / `xspec check` with errors that name the file, location, and fix.

Source files must be valid UTF-8 without a byte-order mark, and must have the `.mdx` extension. Which files are spec sources at all is decided only by the globs in [`xspec.config.ts`](configuration.md) — imports never pull extra files into the workspace.

## Sections

A requirement section wraps part of the document in `<S>` … `</S>`:

```mdx
<S id="login">
The product supports login.
</S>
```

- `<Spec>` is an exact synonym of `<S>`; the short form is preferred.
- A self-closing section `<S id="todo" />` is valid: an empty leaf — no text, no children. Useful as a placeholder to reserve an ID.
- Sections nest to any depth, and nesting is meaningful — it defines the requirement tree.

### The implicit root

Every file also has an implicit **root node** representing the whole document. It has no `id` and is identified by the file path alone (e.g. `specs/AUTH.mdx`). The root is what the generated module default-exports, and it is never a coverage target.

## Requirement IDs

Every non-root section must have an `id`, and IDs are **structural paths**: a child's ID is exactly its parent's ID plus `.` plus one new segment.

```mdx
<S id="login">
Login behavior.

<S id="login.validCredentials">
A user with valid credentials can log in.
</S>
</S>
```

All of the following are invalid, and `build` says so:

- `<S id="validCredentials">` nested inside `login` (child must be `login.validCredentials`)
- `<S id="login.validCredentials">` nested inside some other section
- a top-level `<S id="auth.login">` when no `auth` section encloses it (IDs cannot skip levels)
- two sections with the same ID in one file

The full identity of a requirement is `path#id` — e.g. `specs/AUTH.mdx#login.validCredentials`. That is the form every CLI command accepts and prints. Paths are always workspace-relative with `/` separators, on every platform.

### Segment rules

Each dot-separated segment must be non-empty and must not contain `.`, `#`, whitespace, or control characters, and must not be one of the reserved words `$`, `__proto__`, `prototype`, `constructor`, `then`.

camelCase segments that are valid TypeScript identifiers are recommended — they read as `SPEC.login.validCredentials` in code. Nothing else is enforced; a segment like `login-v2` is legal and is accessed with bracket notation (`SPEC["login-v2"]`) in TypeScript and in references.

## Declaring dependencies: the `d` prop

`d` declares that one requirement depends on another. It takes a single reference or an array of references:

```mdx
import BASE from "./BASE.xspec"

<S id="derived" d={[BASE.auth.login, "local.requirement"]}>
Derived behavior.
</S>
```

- **External form**: a property chain rooted at an imported spec module (`BASE.auth.login`). The module itself (`d={BASE}`) targets that file's root node.
- **Local form**: a string literal naming an ID in the same file (`"local.requirement"`).
- The two forms mix freely in one array; duplicates collapse to one edge; `d={[]}` is the same as omitting the prop.

`d` records a `depends` edge in the graph. It does not render into Markdown output and it does not prove anything by itself — it is the raw material for [coverage](coverage.md), [policy](configuration.md#policy--dependency-policy-rules), [impact](impact.md), and [reviews](reviews.md).

A section must not depend on (or embed) itself or its own ancestor — that is a dependency cycle, and cycles of any length are build errors reported with the full cycle path.

## Embedding requirement text: `{text(...)}`

`{text(...)}` splices the target's full text into this document's compiled Markdown output and records an `embeds` edge:

```mdx
<S id="summary">
As specified:

{text(BASE.auth.login)}
{text("local.requirement")}
</S>
```

The argument follows the same external/local duality as `d`. The expansion is the target's *subtree* text — the target section and everything nested in it, fully expanded.

Embedding is a dependency like any other, with one behavior worth internalizing: editing the embedded target's text changes the *target's* hashes, not the embedder's own hash — the embedder sees it as an upstream change, while its Markdown output still re-expands to the new text on the next build.

## The static-argument rule

Every reference — `d` entries, `text(...)` arguments — must be *static*:

- a plain single- or double-quoted string literal (template literals don't count), or
- a property chain rooted at an imported spec module, using only dot access (`.login`) or string-literal computed access (`["login-v2"]`).

Optional chaining, non-null assertions, parentheses, variables, or any computed expression make the reference dynamic — a build error. `text(...)` takes exactly one argument. xspec resolves everything statically; there is no runtime resolution to fall back on.

## Imports

The **only** imports permitted in a spec file are other spec modules, in exactly this form:

```mdx
import BASE from "./BASE.xspec"
```

- The specifier must be relative (`./` or `../`) and end in `.xspec`; `DIR/NAME.xspec` designates the source file `DIR/NAME.mdx`, which must itself be a discovered spec source.
- Only a single default binding is allowed — no named, namespace, or side-effect imports.
- No import may bind `S`, `Spec`, or `text` (those names belong to the compiler), and no two imports may bind the same identifier.
- Import cycles between spec files are invalid, even without a requirement-level cycle. A file importing itself counts.
- An import whose binding is never used is valid and records nothing.

## Tags

```mdx
<S id="auth.lockout" tags="negative temporal">
Repeated failed logins lock the account.
</S>
```

`tags` is a whitespace-separated list. Duplicates collapse; an empty value is the same as no prop. A tag follows the same character rules as an ID segment, except that tags may contain `.`. Tags are recorded in the graph and usable in coverage target filters and policy selectors; they do **not** render into Markdown and are **not** inherited by child sections.

## Excluding a node from coverage

```mdx
<S id="metadata.author" coverage="none">
Authored by the project owner.
</S>
```

The only values are `required` (the default) and `none`. `coverage="none"` removes the node from coverage *targets* only: it can still be depended on, still appears in impact reports, and its descendants keep their own coverage settings.

## What else may appear in a file

Beyond ordinary Markdown content, exactly four constructs are permitted: spec imports, `<S>`/`<Spec>` sections, `{text(...)}` embeddings, and MDX comments `{/* … */}`. Any other JSX element, any other `{expression}`, and any `export` statement is a build error. Comments are pure annotations — they never enter requirement text or hashes, and Markdown output drops them.

Prop syntax is strict:

- The defined props are `id`, `d`, `coverage`, `tags`. Unknown props are errors; no prop may repeat; spread attributes (`{...props}`) are errors.
- `id`, `coverage`, `tags` must be plain quoted strings: `id="login"`, never `id={"login"}`.
- `d` must be a braced expression: `d={BASE.auth.login}` or `d={[…]}`, never a quoted string.

## Markdown compilation

With [`markdown.emit`](configuration.md#markdown--pure-markdown-emission) enabled, each `NAME.mdx` compiles to a pure-Markdown `NAME.md`:

- spec imports, `<S>`/`<Spec>` tags (with their props), and MDX comments are removed;
- each `{text(...)}` is replaced by the target's fully expanded subtree text;
- everything else — content and author whitespace — is preserved byte-for-byte.

Removal is exact textual deletion. A line that had non-whitespace content in the source but is left empty *purely by removals* is dropped entirely; every other line keeps whatever remains. So a tag on its own line vanishes without leaving a blank line, but tags are otherwise transparent — xspec does not insert spacing for you. In-line tags keep reading in-line:

```mdx
<S id="a">Example:</S><S id="b">1. A</S>
```

strips to `Example:1. A` — if you want a break, write one.

### Own text vs. subtree text

Two text values of a node show up throughout xspec (`show`, `query`, review payloads):

- **subtree text** — the node's full contribution to the compiled Markdown: its own content with every descendant interleaved in document order.
- **own text** — the same with every child's contribution excised; just the node's directly-owned prose.

Both are exact bytes with `text(...)` embeddings fully expanded. Hashing works on a related but distinct value (own *content*, where embeddings count as references rather than expanded text) — the practical consequences are described in [Impact analysis](impact.md#hashes).

## A complete example

```mdx
import BASE from "./BASE.xspec"

{/* Editorial note: keep the summary in sync with marketing copy. */}

<S id="overview" coverage="none" d={BASE.auth}>
The product summary, for context.

{text(BASE.auth.login)}
</S>

<S id="lockout" tags="negative temporal">
Five consecutive failed attempts lock the account for 15 minutes.

<S id="lockout.reset" />
</S>
```

This file declares two top-level requirements; `overview` depends on `BASE.auth` and embeds the login requirement's text; `lockout.reset` is a reserved empty leaf awaiting content.
