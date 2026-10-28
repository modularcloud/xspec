# Renaming and moving requirements

Spec trees need restructuring: IDs outgrow their names, and sections belong in other files. Doing it the naive way, by hand-editing IDs and paths, destroys history. Every tool that compares against a baseline sees a deletion plus an addition, dependents light up as changed, and resolved review items are invalidated.

`xspec rename` and `xspec move` make restructuring **identity-preserving**: they rewrite every reference across the workspace and record the identity mapping in a journal that every baseline comparison replays. Both accept `--preview`, which shows exactly what they would change without changing anything.

## `xspec rename`

```sh
xspec rename <file> <old-id> <new-id> [--preview]
```

`rename` renames a requirement ID within its file. In one operation it:

- rewrites the section's `id` and every descendant ID by prefix replacement (`auth.lockout` → `auth.throttling` carries `auth.lockout.reset` → `auth.throttling.reset`);
- rewrites **every reference** across all configured sources: `id` attributes, `d` references, `text(...)` targets (MDX and TypeScript), and TypeScript markers. The edits are minimal and in place, and they keep each reference's quote style and access form. Where a form can't be kept (say, the new segment isn't a valid TypeScript identifier), the rewrite uses dot access where it can and double-quoted bracket access otherwise;
- appends the mapping to the journal;
- regenerates derived files, exactly as `xspec build` would;
- reports the mapping it applied.

```sh
$ xspec rename specs/AUTH.mdx auth.lockout auth.throttling
specs/AUTH.mdx#auth.lockout -> specs/AUTH.mdx#auth.throttling
1 identity mapped

$ xspec impact --base HEAD        # baseline from before the rename
baseline ba39f7296cccc1abc4c63ac33189505bb270857c
```

There's no output below the baseline line: **a rename produces no changes** against any baseline. That is the identity guarantee. A rename is pure: every hash in the workspace is byte-identical afterward.

There's one deliberate exception. *Type-only* TypeScript references record no edges and are **not rewritten**, so a rename can leave them naming identities that no longer exist. That shows up as an ordinary TypeScript error in your build, never as silent drift.

## `xspec move`

```sh
xspec move <old-file> <new-file> [--preview]                  # file form
xspec move <file>#<id> <target-file>#<new-id> [--preview]     # section form
```

An operand containing `#` is a `file#id` pair, and one without is a file, so the two forms can't be mixed.

**The file form** relocates an entire source file. IDs are unchanged; identities change only in their file part. The moved file's own imports, and every other file's imports of it, are rewritten wherever they would otherwise stop resolving, using the canonical relative spelling. A specifier that still resolves is left as it is. The file form is pure like rename: no hash changes, no impact.

**The section form** extracts a section subtree:

- The section is removed from its origin and inserted as the last child of the target parent, or at the end of the target file for a top-level `<new-id>`.
- It's re-identified by prefix replacement.
- If nothing exists at the target path, the target file is created. A target path holding anything other than a spec source is refused.
- All references are rewritten, converting between local (`"a.b"`) and imported (`MOD.a.b`) forms as needed.

Imports follow the references:

- Where a file now needs an import, one is added on a line of its own with a fresh binding name: `import X from "…"` in a spec file, and `import X from "…"`, `import { text as Y } from "…"`, or both in TypeScript.
- An import that the rewrite leaves unused is removed, except in the rare spots where deleting it would change how the rest of the file parses; there it stays, unused. An import that was already unused stays too.
- A created target file starts with the imports it needs, then an empty line, then the moved section.

```sh
$ xspec move "specs/AUTH.mdx#auth.throttling" "specs/THROTTLING.mdx#throttling"
specs/AUTH.mdx#auth.throttling -> specs/THROTTLING.mdx#throttling
1 identity mapped

$ cat specs/THROTTLING.mdx
<S id="throttling" tags="negative temporal">
Five consecutive failed attempts lock the account for 15 minutes.
</S>
```

### How pure is a section move?

The moved subtree keeps its identity and metadata, so *the moved nodes themselves* typically show no change. The two parents necessarily change, since the origin lost a child and the target gained one, and that is exactly what impact reports:

```sh
$ xspec impact --base HEAD        # baseline from before the move
baseline 9c88b0fdf39b7bb70faedf47613850cc5a08d90f
changed:
  specs/AUTH.mdx#auth — attributed to: specs/AUTH.mdx#auth
  specs/THROTTLING.mdx — attributed to: specs/THROTTLING.mdx
descendant-changed:
  specs/AUTH.mdx — attributed to: specs/AUTH.mdx#auth
upstream-changed:
  specs/OVERVIEW.mdx — attributed to: specs/AUTH.mdx#auth
  specs/OVERVIEW.mdx#overview — attributed to: specs/AUTH.mdx#auth
```

One edge case: the moved text travels verbatim, but on the two lines where the section's opening and closing tags sit, Markdown's line-dropping rules look at characters *outside* the moved text. If the section's tag shares a line with other content at the origin, its own content can come out slightly different at the destination. That node is then reported `changed`, with the usual cascades. Sections whose tags sit on their own lines (the usual style) move without any change to the subtree.

## Previewing a refactoring

With `--preview`, either command runs its full validation and planning and reports what it *would* do. It modifies nothing: no sources, no journal, no derived files, no graph data. Here's a preview of moving a section that a test references:

```sh
$ xspec move "specs/AUTH.mdx#auth.login.invalid" "specs/ERRORS.mdx#errors" --preview
mapping:
  specs/AUTH.mdx#auth.login.invalid -> specs/ERRORS.mdx#errors
files:
  specs/AUTH.mdx
    204-316 origin-deletion
    207-230 id-rewrite
  specs/ERRORS.mdx
    0-0 file-creation
  test/auth.test.ts
    49-49 import-addition
    202-225 reference-rewrite
delta:
  generated specs/ERRORS.md
  generated specs/ERRORS.xspec.impl.d.ts
  generated specs/ERRORS.xspec.impl.d.ts.map
  generated specs/ERRORS.xspec.ts
```

- **`mapping`** lists every identity that would change, exactly what the journal would record.
- **`files`** lists every file that would be rewritten, relocated, or created, with each edit's byte range in the file *as it is now* and its class. The classes are:
  - `reference-rewrite`;
  - `id-rewrite`;
  - `import-specifier-rewrite`;
  - `import-addition`;
  - `import-removal`;
  - `origin-deletion` (the moved section plus any line it leaves blank);
  - `target-insertion`;
  - `target-parent-rewrite` (a self-closing target parent opened up to receive the child);
  - `file-relocation`;
  - `file-creation`.

  Insertions are zero-length ranges, and ranges may nest (the `id-rewrite` above falls inside the `origin-deletion`).
- **`delta`** lists the derived files that would be newly generated and the recorded ones that would no longer be generated.

Edits don't include replacement text. A preview is a safety report, not a patch: run the real operation to apply it. Running the move above produces exactly the planned edits:

```sh
$ xspec move "specs/AUTH.mdx#auth.login.invalid" "specs/ERRORS.mdx#errors"
specs/AUTH.mdx#auth.login.invalid -> specs/ERRORS.mdx#errors
1 identity mapped

$ cat test/auth.test.ts
import AUTH, { text } from "../specs/AUTH.xspec"
import ERRORS from "../specs/ERRORS.xspec"

export function testValidLogin(): string {
  AUTH.auth.login.valid
  return text(AUTH.auth.login.valid)
}

export function testInvalidLogin(): void {
  ERRORS.errors
}
```

A preview is refused exactly when the real operation would be, with the same reasons and exit code. It takes no workspace lock, so it never blocks or waits for other commands, and it can't be combined with `--test-hold`. With `--json`, both the preview and the applied mapping come as JSON documents; see [Machine interface](machine-interface.md#previews-before-refactoring).

## Validation and refusals

Both commands check everything **before modifying anything**, and they refuse (exit `1`) rather than leave a broken workspace. Every applicable reason is reported together, each as its own finding with a stable code.

**The workspace must currently pass `build` validation.** The commands only ever rewrite a valid workspace, which is what makes the finishing regeneration certain to succeed. On a failing workspace, the refusal reports the workspace's own findings, and only those.

Both commands also refuse with:

- `refused-invalid-id`: the new ID isn't a valid ID.
- `refused-identity-unchanged`: the new identity equals the old one. That includes the exact self-move (`same-file#same-id`, or a file moved onto itself). A cross-file move that keeps its ID is fine.
- `refused-id-collision`: the new ID, or an ID it produces for a descendant, collides with an ID that would remain.
- `refused-structural-parent`: the structural parent rules would no longer hold.

Move can additionally refuse with:

- `refused-cycle`: the move would create a spec import cycle or a dependency cycle.
- `refused-destination-exists`: the file form's destination already exists (anything there counts, a symbolic link included), or the section form's target path holds something other than a spec source, such as a directory.
- `refused-missing-target-parent`: the target parent is missing or lies inside the moved subtree.
- `refused-invalid-destination`: the destination wouldn't be a valid spec source. That's the case when it lies outside every configured spec group, is also matched by a code group, lacks the `.mdx` extension, is spelled with a `.`, `..`, or empty segment, or contains `"`, `'`, `\`, a line break, U+2028, or U+2029. It's also the case when a directory along the destination, or along a derived file it would generate, is occupied by a file or a symbolic link.
- `refused-exposed-derived-file`: a file move whose origin's emitted Markdown would then be picked up by a configured glob as a source.
- `refused-invalid-rewrite`: the section move's exact edits would leave a file that isn't well-formed MDX, or a file has no valid place for an import it needs. MDX is line-sensitive, so this can happen when a section's tags share their lines with other text, or when a section sits inside a block quote.
- `refused-moved-import`: the moved section contains an import declaration. Move the import out of the section first.

```sh
$ xspec move "specs/AUTH.mdx#auth.login" "specs/AUTH.mdx#auth.login"
refused-identity-unchanged: identity unchanged: "specs/AUTH.mdx#auth.login" is the moved section's own identity — the exact self-move is refused and appends no journal entry (SPEC 6.5, 14) [specs/AUTH.mdx#auth.login]
1 finding
```

Some problems are usage errors (exit `2`) instead, because argument checks come before everything else:

- a nonexistent origin file or old ID;
- a code file named as the origin;
- a malformed operand;
- a destination that can't be spelled as an argument (containing `#`, or not valid UTF-8).

## If an operation stops partway

The writes happen in a fixed order: every source edit first, then the journal append, then the regeneration of derived files. If an operation is interrupted, or stops because the environment refused a write (`write-failure`, exit `2`), what's left depends on where it stopped:

- **Before the journal append**, there's no journal entry. The source edits already made stand as manual edits, and `xspec check` reports anything they left broken.
- **After the journal append**, the identity change is complete. Only derived files may be stale; run `xspec build`.

## Known limit: TypeScript without semicolons

A section move can remove a TypeScript import that sits between a statement with no terminating `;` and a line that starts with `(`, `[`, `/`, `` ` ``, `+`, or `-`. Deleting the import then joins the two statements. If the joined text no longer parses, the move is refused and nothing is modified. If it still parses, its meaning can change without any finding (a line starting with `(` becomes a call on the previous expression, for example). In files written without semicolons, check `--preview` for `import-removal` edits and review the result.

## The journal

Each journaled operation appends one line to `.xspec/journal`:

```
{"from":"specs/AUTH.mdx#auth.lockout","map":[["specs/AUTH.mdx#auth.lockout","specs/AUTH.mdx#auth.throttling"]],"op":"rename","to":"specs/AUTH.mdx#auth.throttling"}
{"from":"specs/AUTH.mdx#auth.throttling","map":[["specs/AUTH.mdx#auth.throttling","specs/THROTTLING.mdx#throttling"]],"op":"move-section","to":"specs/THROTTLING.mdx#throttling"}
```

Treat the file as opaque except for its contract: **plain text, one entry per line, append-only, written only by `rename` and `move`**. It is a [durable file](workspace.md#derived-durable-and-transient): commit it, never edit or delete it, and let concurrent branches merge it textually.

Every command that takes a baseline replays the entries added since that baseline to map old identities to new ones. Chains compose, so `rename` → `move` → `rename` still resolves. `xspec check` validates the journal and reports malformed, conflicting, or unreplayable entries. A baseline whose journal is not a prefix of the current one (someone rewrote it) is a hard error naming the offending entries.

Because identity flows through the journal, an ID that a rename vacated and a brand-new section later reintroduced is a *different* node. References to the two never compare equal, and their hashes never collide.

## Manual restructuring

Editing IDs or moving text by hand is always *valid*. xspec just treats it as a deletion plus an addition, with everything that follows: impact reports both sides, dependents show `upstream-changed`, and resolved review items over the old nodes are invalidated. Do it when that's what you mean, because the requirement really was replaced; use `rename`/`move` when it wasn't.

## Practical workflow

1. Land content edits and refactoring in the same branch freely. Journaled operations keep the two separable in every report.
2. Run restructuring through the commands, even for "trivial" one-reference renames. The journal entry is the cheap part; hand edits are the ones you end up explaining in review.
3. Preview anything non-trivial first (`--preview`): it lists every file and byte range the operation would touch.
4. `rename` and `move` are [mutually exclusive](cli.md#concurrency) with other mutating commands per workspace. A refused operation modifies nothing, and `xspec check` reports any inconsistency an interrupted run leaves behind.
