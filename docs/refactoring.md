# Renaming and moving requirements

Spec trees need restructuring — IDs outgrow their names, sections belong in other files. The naive way (hand-editing IDs and paths) destroys history: every tool that compares against a baseline sees a deletion plus an addition, dependents light up as changed, resolved review items invalidate.

`xspec rename` and `xspec move` exist so restructuring is **identity-preserving**: they rewrite every reference across the workspace and record the identity mapping in a journal that every baseline comparison replays.

## `xspec rename`

```sh
xspec rename <file> <old-id> <new-id>
```

Renames a requirement ID within its file. In one atomic operation it:

- rewrites the section's `id` and every descendant ID by prefix replacement (`auth.lockout` → `auth.throttling` carries `auth.lockout.reset` → `auth.throttling.reset`);
- rewrites **every reference** across all configured sources: `id` attributes, `d` references, `text(...)` targets (MDX and TypeScript), and TypeScript markers — as minimal in-place edits that preserve each reference's quote style and access form;
- appends the mapping to the journal;
- regenerates derived files, exactly as `xspec build` would.

```sh
$ xspec rename specs/AUTH.mdx auth.lockout auth.throttling
$ echo $?
0

$ xspec impact --base HEAD        # baseline from before the rename
baseline ba39f7296cccc1abc4c63ac33189505bb270857c
```

No output below the baseline line: **a rename produces no changes** against any baseline. That is the identity guarantee — rename is pure, every hash in the workspace is byte-identical afterward.

One deliberate exception: *type-only* TypeScript references record no edges and are **not rewritten** — a rename can leave them naming vacated identities. That surfaces as an ordinary TypeScript error in your build, never as silent drift.

## `xspec move`

```sh
xspec move <old-file> <new-file>                  # file form
xspec move <file>#<id> <target-file>#<new-id>     # section form
```

**File form** relocates an entire source file. IDs are unchanged; identities change only in their file part. The moved file's own imports, and every other file's imports of it, are rewritten so everything keeps resolving. The file form is pure like rename: no hash changes, no impact.

**Section form** extracts a section subtree: removed from its origin, inserted as the last child of the target parent (or at the end of the target file for a top-level `<new-id>`), re-identified by prefix replacement. The target file is created if absent. All references are rewritten — converting between local (`"a.b"`) and imported (`MOD.a.b`) forms as needed, adding spec imports where a file now needs one and removing imports left without references.

```sh
$ xspec move "specs/AUTH.mdx#auth.throttling" "specs/THROTTLING.mdx#throttling"
$ cat specs/THROTTLING.mdx
<S id="throttling" tags="negative temporal">
Five consecutive failed attempts lock the account for 30 minutes.
</S>
```

### How pure is a section move?

The moved subtree keeps its identity and metadata, so *the moved nodes themselves* typically show no change. The two parents necessarily change — the origin lost a child, the target gained one — and that is exactly what impact reports:

```sh
$ xspec impact --base HEAD        # baseline from before the move
changed:
  specs/AUTH.mdx#auth — attributed to: specs/AUTH.mdx#auth
  specs/THROTTLING.mdx — attributed to: specs/THROTTLING.mdx
descendant-changed:
  specs/AUTH.mdx — attributed to: specs/AUTH.mdx#auth
upstream-changed:
  specs/OVERVIEW.mdx#overview — attributed to: specs/AUTH.mdx#auth
```

One edge case to know: the moved text travels verbatim, but on the two lines the section's opening and closing tags sit on, Markdown's line-dropping rules consult characters *outside* the moved text. A section whose tag shares a line with other content at the origin can therefore have slightly different own content at the destination — that node is then reported `changed`, with the ordinary cascades. Sections formatted with their tags on their own lines (the usual style) move without any change to the subtree.

## Validation and refusals

Both commands refuse (exit `1`) rather than leave a broken workspace, and they check **before modifying anything**:

- the workspace must currently pass `build` validation — the commands only ever rewrite a valid workspace, which is what makes the finishing regeneration infallible;
- the new ID must be valid, differ from the old, collide with nothing, and keep structural parent rules satisfied; all rewritten references must resolve.

Move additionally refuses: a move that would create an import or dependency cycle; a file-form destination that already exists; a section-form target parent that is missing or lies inside the moved subtree; a destination path that would not be a valid spec source (outside every configured spec group, also matched by a code group, containing `#`, not UTF-8, or not `.mdx`). The exact self-move (`same-file#same-id`) is refused; a cross-file move keeping the same ID is fine.

A nonexistent origin file or old ID is a usage error (exit `2`) instead — argument checks precede everything else.

## The journal

Journaled operations append one line each to `.xspec/journal`:

```
{"from":"specs/AUTH.mdx#auth.lockout","map":[["specs/AUTH.mdx#auth.lockout","specs/AUTH.mdx#auth.throttling"]],"op":"rename","to":"specs/AUTH.mdx#auth.throttling"}
{"from":"specs/AUTH.mdx#auth.throttling","map":[["specs/AUTH.mdx#auth.throttling","specs/THROTTLING.mdx#throttling"]],"op":"move-section","to":"specs/THROTTLING.mdx#throttling"}
```

Treat the file as opaque except for its contract: **plain text, one entry per line, append-only, written only by `rename` and `move`**. It is a [durable file](workspace.md#derived-vs-durable): commit it, never edit or delete it, let concurrent branches merge it textually. Every baseline-taking command replays the entries added since the baseline to map old identities to new ones — chains compose, so `rename` → `move` → `rename` still resolves. `xspec check` validates the journal and reports malformed, conflicting, or unreplayable entries; a baseline whose journal is not a prefix of the current one (someone rewrote it) is a hard error naming the offending entries.

Because identity flows through the journal, an ID that was vacated by a rename and later reintroduced by a brand-new section is a *different* node — references to the two never compare equal, and hashes never collide across the reuse.

## Manual restructuring

Editing IDs or moving text by hand is always *valid* — xspec just treats it as a deletion plus an addition, with everything that follows: impact reports both sides, dependents show `upstream-changed`, resolved review items over the old nodes invalidate. Do it when that is what you mean (the requirement genuinely was replaced); use `rename`/`move` when it isn't.

## Practical workflow

1. Land content edits and refactoring in the same branch freely — journaled operations keep the two separable in every report.
2. Run restructuring through the commands even for "trivial" one-reference renames; the journal entry is the cheap part, and hand-edits are the ones you end up explaining in review.
3. `rename`/`move` are [mutually exclusive](cli.md#concurrency) with other mutating commands per workspace, and a refused or interrupted operation modifies nothing; `xspec check` reports any inconsistency an interrupted run could leave.
