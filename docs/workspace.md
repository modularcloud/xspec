# Workspace files

Everything xspec writes is a **plain file with deterministic bytes**: stable ordering, sorted keys, no timestamps, no absolute paths. That makes these files suitable for committing and diffing. This page lists them, explains the derived, durable, and transient classes, and gives version-control guidance. For your own workspace, [`xspec inventory`](machine-interface.md#workspace-shape-xspec-inventory) reports the same information as JSON.

## Inventory

For a source file `specs/AUTH.mdx` and default configuration:

| Path | What | Class |
|---|---|---|
| `specs/AUTH.xspec.ts` | Generated TypeScript module: the `./AUTH.xspec` import target, runtime included | Derived |
| `specs/AUTH.xspec.impl.d.ts` | Companion: node types and hover documentation | Derived |
| `specs/AUTH.xspec.impl.d.ts.map` | Companion: declaration map (go-to-definition into the `.mdx`) | Derived |
| `specs/AUTH.md` | Pure-Markdown emission (only with `markdown.emit`; placed per `outDir`) | Derived |
| `.xspec/` (graph data) | Graph data serving the read commands, including the record of which derived files were last generated | Derived |
| `.xspec/journal` | Identity journal written by `rename`/`move` | **Durable** |
| `.xspec/reviews/<name>.json` | One review session each | **Durable** |
| `.xspec/lock` | Lock directory for mutating commands, present only while one runs (or as a leftover) | Transient |

Companion files are an implementation detail and may change. The stable rule is that every companion sits beside its module and carries `.xspec.` in its name.

> **Upgrading from 0.1.x:** 0.1.x also wrote a runtime companion, `NAME.xspec.impl.js`. Since 0.2.0 the generated module carries its own runtime, so that file is no longer generated. 0.1.x recorded its derived files in a form 0.2.0 doesn't read, so 0.2.0 neither removes the old files nor reports them. Delete each `*.xspec.impl.js` by hand after your first 0.2.0 build.

Graph data's file layout is deliberately unspecified. Its contract is its location under `.xspec/`, its classification as derived, and its freshness behavior.

## Derived, durable, and transient

**Derived files** are fully reproducible from sources, configuration, and journal via `xspec build`. Anything wrong with one (a merge conflict, corruption, deletion, tampering) is fixed by rebuilding. `build` also removes derived files it recorded earlier that the current sources no longer generate, so renames don't strand orphans. Two kinds of orphan are left for you to delete by hand:

- one xspec never recorded, because it was orphaned while the record was missing or unreadable;
- one that occupies a directory a rebuild needs to write into. The rebuild is refused with `obstructed-write-path` until you delete it.

**Durable files** (the journal, review sessions) record operations and resolutions. They are **not reproducible, never regenerated, and must not be modified except by their owning commands**. Both are line-oriented or stably keyed so that concurrent branches merge textually. `xspec check` validates their integrity and reports states it can't resolve.

**Transient** is the lock directory `.xspec/lock` and everything in it. It exists only while a mutating command takes or holds the workspace lock, or as a leftover from one that ended abnormally. Its contents depend on the machine and process that wrote them, so it is **never committed**. You may delete it by hand, but only while no mutating command is running (see [Concurrency](cli.md#concurrency)).

Derived-file *paths belong to xspec*. Writing a derived file replaces whatever is at that path, whether or not xspec wrote it, so don't keep anything at a path matching a derived name. (The one exception is a derived path that's a directory holding a source or another derived path: xspec refuses that write with `obstructed-write-path` rather than replace the directory.)

**The `.xspec/` area is reserved for xspec's writes.** Don't keep files of your own anywhere under it. A derived-file write there replaces whatever is in its way, and nothing xspec records would bring your content back.

Three path classes are **never discovered as sources**, whatever your globs say: paths whose file name contains `.xspec.`, anything under `.xspec/`, and the configured Markdown emit destinations. A broad `specs/**/*.mdx` therefore never accidentally takes in emitted output.

## What to commit

Commit **everything xspec writes except the lock directory**, alongside your sources:

- **The journal and review sessions are non-negotiable.** They can't be regenerated, and losing the journal breaks identity mapping for every baseline that crosses a rename or move. If you commit nothing else, commit `.xspec/journal`.
- **Commit the generated modules and companions.** Consumers' builds and editors resolve `./NAME.xspec` without running xspec first. Diffs of generated files are deterministic and reviewable, and `xspec check` in CI proves they match the sources (staleness is a finding), so they can't silently drift.
- **Commit the emitted Markdown and graph data for the same reasons**, or, if repository size argues against it, ignore them and run `xspec build` in CI before `check`. Decide per class of file, not per file; a half-committed derived set is the confusing middle ground.

For the commit-everything policy, `.gitignore` needs one xspec entry:

```gitignore
.xspec/lock
```

For the regenerate-in-CI policy:

```gitignore
# derived (rebuilt by `xspec build`)
*.xspec.*
specs/**/*.md
# everything under .xspec/ except the durable files (this also covers the lock)
.xspec/*
!.xspec/journal
!.xspec/reviews/
```

Never ignore `.xspec/` wholesale: that would drop the journal and review sessions.

## Freshness, staleness, and repair

- `xspec build` regenerates every derived file; a failed build changes nothing.
- Read commands silently refresh graph data when it doesn't match the current sources. You never get stale answers, and they never touch generated TypeScript or Markdown.
- `xspec check` never refreshes. A derived file that doesn't match the sources is a **staleness finding**, and so is stale graph data.
- Graph data damaged beyond reading (by merge-conflict markers, say) is reported by `check` as staleness and by `inventory` and previews as `unreadable-record`. `xspec build` replaces it.

After editing `specs/AUTH.mdx` without rebuilding, `check` reports:

```
.xspec: stale-output: stale generated output: the graph data under the graph-data area is missing or does not match the current sources and configuration; run `xspec build` to regenerate every derived file (SPEC 14.10, 13.3)
specs/AUTH.md: stale-output: stale generated output: specs/AUTH.md does not match what the current sources and configuration generate; run `xspec build` to regenerate every derived file (SPEC 14.10)
specs/AUTH.xspec.impl.d.ts: stale-output: stale generated output: specs/AUTH.xspec.impl.d.ts does not match what the current sources and configuration generate; run `xspec build` to regenerate every derived file (SPEC 14.10)
specs/AUTH.xspec.ts: stale-output: stale generated output: specs/AUTH.xspec.ts does not match what the current sources and configuration generate; run `xspec build` to regenerate every derived file (SPEC 14.10)
4 findings
```

That makes `check` your tamper detector too. Manual edits to generated files, outputs orphaned by configuration changes, and merge damage all show up here, and rebuilding is the universal fix.

## Filesystem behavior worth knowing

- **Writes are atomic in effect.** Concurrent readers and interrupted commands see the old content or the new, never a torn file. Missing directories on a write path are created.
- **A refused write stops the command.** If the environment refuses a write (permission denied, a read-only filesystem, a full disk), the command stops with exit `2` (`write-failure`). The files already written are complete, and `check` reports anything left stale.
- **Mutating commands** (`rename`, `move`, `review create/resolve/split`) are mutually exclusive per workspace on one machine. A second one fails fast (exit `2`, `workspace-busy`) and touches nothing. The lock does not extend across machines sharing the directory. Different workspaces never interfere unless they share files.
- **Symbolic links are never followed.**
  - Not in discovery: a symlink is never a source.
  - Not in writes: a directory along a write path that's occupied by a symlink, a plain file, or anything else that isn't a directory is refused (`obstructed-write-path`), while a symlink *at* a derived file's own path is simply replaced by a plain file.
  - Not in reads: nothing below a symlinked directory is read.

  Journal or session paths occupied by anything but plain files are errors, never written through.
- **No network, no git writes.** xspec performs no network access, reads git only where documented (`impact --base`, `review create --base`, and baseline reconstruction), and never writes to git.
