# Writing specs

xspec source files are MDX documents (`.mdx`) in which requirement sections are marked with `<S>` tags. Everything else in the file is ordinary Markdown. This page covers the complete authoring syntax. `xspec build` and `xspec check` enforce every rule here, with errors that name the file, the location, and the fix.

Source files must be valid UTF-8 without a byte-order mark, and must have the `.mdx` extension. A spec file's path must not contain `#`, `"`, `'`, `\`, a line break, U+2028, U+2029, or U+FFFD. Which files are spec sources at all is decided only by the globs in [`xspec.config.ts`](configuration.md); imports never pull extra files into the workspace.

## Sections

A requirement section wraps part of the document in `<S>` … `</S>`:

```mdx
<S id="login">
The product supports login.
</S>
```

- `<Spec>` is an exact synonym of `<S>`; the short form is preferred.
- A self-closing section, `<S id="todo" />`, is valid: an empty leaf with no text and no children. It's useful as a placeholder that reserves an ID.
- Sections nest to any depth, and nesting is meaningful: it defines the requirement tree.

### The implicit root

Every file also has an implicit **root node** representing the whole document. It has no `id` and is identified by the file path alone (e.g. `specs/AUTH.mdx`). The root is what the generated module default-exports, and it is never a coverage target. It has no tags and no coverage attribute.

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

- `<S id="validCredentials">` nested inside `login` (the child must be `login.validCredentials`)
- `<S id="login.validCredentials">` nested inside some other section
- a top-level `<S id="auth.login">` when no `auth` section encloses it (IDs can't skip levels)
- two sections with the same ID in one file

The full identity of a requirement is `path#id`, for example `specs/AUTH.mdx#login.validCredentials`. That's the form every CLI command accepts and prints. Paths are always workspace-relative with `/` separators, on every platform.

### Segment rules

Each dot-separated segment must be non-empty and must not contain:

- `.` or `#`;
- whitespace or control characters;
- the quote, escape, and character-reference characters `"`, `'`, `\`, and `&`;
- U+2028 (line separator), U+2029 (paragraph separator), or U+FFFD (replacement character).

It also must not be one of the reserved words `$`, `__proto__`, `prototype`, `constructor`, and `then`. These rules guarantee that every ID is spelled the same, character for character, in every form it appears in: `id` attributes, `d` and `text()` references, and TypeScript.

camelCase segments that are valid TypeScript identifiers are recommended, because they read as `SPEC.login.validCredentials` in code. Nothing else is enforced. A segment like `login-v2` is legal; you access it with bracket notation (`SPEC["login-v2"]`) in TypeScript and in references.

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
- The two forms mix freely in one array, and duplicates collapse to one edge.
- `d={[]}` is the same as omitting the prop. Empty braces, `d={}`, are a syntax error.

`d` records a `depends` edge in the graph. It doesn't render into Markdown output, and it doesn't prove anything by itself. It's the raw material for [coverage](coverage.md), [policy](configuration.md#policy--dependency-policy-rules), [impact](impact.md), and [reviews](reviews.md).

A section must not depend on (or embed) itself or its own ancestor. That is a dependency cycle, and cycles of any length are build errors, reported with the full cycle path.

## Embedding requirement text: `{text(...)}`

`{text(...)}` splices the target's full text into this document's compiled Markdown output and records an `embeds` edge:

```mdx
<S id="summary">
As specified:

{text(BASE.auth.login)}
{text("local.requirement")}
</S>
```

The argument follows the same external/local duality as `d`. The expansion is the target's *subtree* text: the target section and everything nested in it, fully expanded. Whitespace and comments may stand beside the call inside the braces (`{ text("a") }`), but the braces must hold exactly that one call.

Embedding is a dependency like any other, with one behavior worth internalizing: editing the embedded target's text changes the *target's* hashes, not the embedder's own hash. The embedder sees it as an upstream change, while its Markdown output still re-expands to the new text on the next build.

## The static-argument rule

Every reference (`d` entries, `text(...)` arguments) must be *static*:

- a plain single- or double-quoted string literal (template literals don't count), or
- a property chain rooted at an imported spec module, using only dot access (`.login`, reserved words like `.delete` included) or string-literal bracket access (`["login-v2"]`).

String values are read exactly as spelled: no escape sequence or character reference is interpreted, here or in `id`, `tags`, `coverage`, and import specifiers. A value containing `\` or `&` can therefore never name a valid ID.

Optional chaining, parentheses, variables, and any computed expression make a reference dynamic (`invalid-argument`). Expressions in a spec file are plain JavaScript, so TypeScript-only syntax such as `BASE.a!` doesn't parse at all (`unparseable-source`). `text(...)` takes exactly one argument. xspec resolves everything statically; there's no runtime resolution to fall back on.

## Imports

The **only** imports permitted in a spec file are other spec modules, in exactly this form:

```mdx
import BASE from "./BASE.xspec"
```

- **The specifier** must be relative (starting with `./` or `../`) and end in `.xspec`. `DIR/NAME.xspec` designates the source file `DIR/NAME.mdx`, which must itself be a discovered spec source.
  - Specifiers resolve lexically, so `./sub/../BASE.xspec` works too, though rewrites always write the canonical spelling.
  - A specifier that climbs above the workspace root designates nothing.
- **The form** is a single default binding only: no named, namespace, or side-effect imports, and no import attributes (`with { … }`).
- **The binding name** may not be `S`, `Spec`, or `text` (those names belong to the compiler), and no two imports may bind the same identifier.
- **Cycles**: import cycles between spec files are invalid, even without a requirement-level cycle. A file importing itself counts.
- **Unused imports**: an import whose binding is never used is valid and records nothing.

## Tags

```mdx
<S id="auth.lockout" tags="negative temporal">
Repeated failed logins lock the account.
</S>
```

`tags` is a whitespace-separated list. Duplicates collapse, and an empty value is the same as no prop. A tag follows the same character rules as an ID segment, except that tags may contain `.`. Tags are recorded in the graph and usable in coverage target filters and policy selectors. They do **not** render into Markdown and are **not** inherited by child sections.

## Excluding a node from coverage

```mdx
<S id="metadata.author" coverage="none">
Authored by the project owner.
</S>
```

The only values are `required` (the default) and `none`. `coverage="none"` removes the node from coverage *targets* only. It can still be depended on, it still appears in impact reports, and its descendants keep their own coverage settings.

## What else may appear in a file

Beyond ordinary Markdown content, exactly four constructs are permitted:

- spec imports;
- `<S>`/`<Spec>` sections;
- `{text(...)}` embeddings;
- MDX comments.

Any other JSX element (a fragment `<>…</>` included), any other `{expression}`, and any `export` statement is a build error. A `<S>` written inside an `{expression}` is part of that expression, never a section.

An MDX comment is a pair of braces holding nothing but whitespace and JavaScript comments: `{/* … */}` is the usual form, and `{}` and `{ /* a */ /* b */ }` count too. Comments are pure annotations. They never enter requirement text or hashes, and Markdown output drops them.

Prop syntax is strict:

- The defined props are `id`, `d`, `coverage`, and `tags`. Unknown props are errors, no prop may repeat, and spread attributes (`{...props}`) are errors.
- `id`, `coverage`, and `tags` must be plain quoted strings: `id="login"`, never `id={"login"}`.
- `d` must be a braced expression: `d={BASE.auth.login}` or `d={[…]}`, never a quoted string.

## Markdown compilation

With [`markdown.emit`](configuration.md#markdown--pure-markdown-emission) enabled, each `NAME.mdx` compiles to a pure-Markdown `NAME.md`:

- spec imports, `<S>`/`<Spec>` tags (with their props), and MDX comments are removed;
- each `{text(...)}` is replaced by the target's fully expanded subtree text;
- everything else, content and author whitespace alike, is preserved byte for byte.

Removal is exact textual deletion. A line that had non-whitespace content in the source but is left empty *purely by removals* is dropped entirely; every other line keeps whatever remains. A removed construct that spans several lines takes its line breaks with it. So a tag on its own line vanishes without leaving a blank line, but tags are otherwise transparent: xspec doesn't insert spacing for you. In-line tags keep reading in-line:

```mdx
<S id="a">Example:</S><S id="b">1. A</S>
```

strips to `Example:1. A`. If you want a break, write one.

Only the import declaration itself is removed. A JavaScript comment written beside it (`import BASE from "./BASE.xspec" // why`) isn't an MDX comment, so it stays in the output as text. Put notes in `{/* … */}` instead.

### Own text vs. subtree text

Two text values of a node show up throughout xspec (`show`, `query`, `view --text`, review payloads):

- **subtree text** is the node's full contribution to the compiled Markdown: its own content with every descendant interleaved in document order.
- **own text** is the same with every child's contribution cut out: just the node's directly owned prose.

Both are exact bytes with `text(...)` embeddings fully expanded. Hashing works on a related but distinct value, own *content*, in which embeddings count as references rather than expanded text. The practical consequences are described in [Impact analysis](impact.md#hashes).

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

This file declares two top-level requirements. `overview` depends on `BASE.auth` and embeds the login requirement's text, and `lockout.reset` is a reserved empty leaf awaiting content.
