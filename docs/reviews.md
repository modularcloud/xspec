---
title: Reviews
description: "Staged review sessions: path-blocks, audit, and coverage strategies."
---

A review session turns graph results into a **staged, durable checklist**: each item is one focused judgment ("does this subtree still cohere?", "does this dependent still hold given its target changed?"), items unlock in a deliberate order, resolutions survive restarts and merges, and anything that changes after you resolved it gets flagged — not silently forgotten.

Sessions are stored as plain JSON at `.xspec/reviews/<name>.json` — [durable files](./workspace.md#derived-vs-durable) you commit alongside the specs they review.

## Creating a session

```sh
xspec review create --base <ref> --name <name>            # path-blocks strategy
xspec review create --strategy audit --name <name>        # audit strategy
xspec review create --coverage <profile> --name <name>    # coverage strategy
```

Exactly one of `--base` / `--strategy audit` / `--coverage` is required. Creation records the session's parameters *fully resolved* — the commit the ref pointed at, or the profile's definition with group names expanded to their globs — so later renaming a branch, editing a profile, or re-pointing a ref never changes what the session reviews.

### `path-blocks` — review a change (the default, baseline-based)

For a change relative to `--base`, the session contains:

- one **`subtree-coherence`** item per changed subtree root — the node and all its descendants, reviewed as a single block;
- one **`parent-consistency`** item per ancestor of a change — "does this parent's own prose still make sense given what changed beneath it?" — *blocked by* the items for the changed branches beneath it, so parents unlock only after their children are reviewed;
- one **`metadata-consistency`** item per node whose `d`/`coverage`/`tags` changed;
- one **`dependency-consistency`** item per node depending on a target whose effective content changed — "your upstream moved; do you still hold?";
- one **`code-impact`** item per [impacted code location](./impact.md#impacted-code).

Item order is deepest-first for requirement items, then code items — matching the blocking direction, so `next` naturally walks bottom-up.

### `audit` — review everything

One `subtree-coherence` item per requirement node (roots included), no baseline. Each item is blocked by its children's items, so leaves unlock first and every subtree is confirmed bottom-up. Use it for a first adoption pass over an existing spec corpus, or periodic full audits.

### `coverage` sessions — burn down uncovered requirements

One **`uncovered-requirement`** item per uncovered required node of the profile at creation time. Use it to turn a [coverage](./coverage.md) gap into a tracked work list.

## The item model

Every item carries: `id`, `kind`, `scope` (what is under review), `context` (the nodes whose text frames the judgment), `origin` (the originating edits, when applicable), `reason` (a sentence explaining why the item exists), recorded `baseline`/`current` state, a `status`, an optional `note`, and `blockedBy`.

### Statuses

| Status | Meaning |
|---|---|
| `unresolved` | Not reviewed yet (every item starts here) |
| `updated` | Reviewed; you changed the sources in response |
| `no-change` | Reviewed; intentionally left as is |
| `skipped` | Intentionally deferred or ignored |
| `invalidated` | Was resolved, but relevant state changed since |

`updated`, `no-change`, and `skipped` are the *resolved* statuses. An item is **blocked** while any of its `blockedBy` items is unresolved — and since `invalidated` is not resolved, a blocker that gets invalidated re-blocks everything above it until it is re-resolved.

### Invalidation — resolutions that stop being true get flagged

Resolving an item records the relevant state for its kind (per-kind relevant hashes plus node presence). Whenever the session is read (`status`, `next`, `show`, `export`), each resolved item is re-checked against the current graph; if a relevant hash changed, a node appeared/disappeared, or the item's context set changed, the item reports as `invalidated` and needs review again. Reads never write the session file — invalidation is computed, not persisted.

Two properties keep this workable:

- **Journaled renames/moves never invalidate anything** — recorded nodes compare by canonical identity through the journal, and reads present them under their current names. Refactor freely mid-review with [`rename`/`move`](./refactoring.md).
- **Deletion review is resolvable**: a node that was already absent when you resolved doesn't re-invalidate by staying absent.

### Re-derivation — sessions follow the work

Resolving an item as `updated` re-runs the session's generators against the current workspace (with the recorded creation parameters): new items appear for newly changed nodes, existing items are matched by kind + scope (keeping their id, status, and history), items that no longer generate remain, and blocking is recomputed. Your checklist tracks the change as it evolves, instead of describing only its first draft.

### `split` — decompose a big review block

`xspec review split <name> <item-id>` decomposes a `subtree-coherence` item into one item per child subtree plus a `parent-consistency` item for the root's own text (blocked by the children). The decomposition is recorded durably and honored by later re-derivations. Use it when a subtree is too large to judge as one block.

## A worked session

The [getting-started project](./getting-started.md), after editing `auth.lockout`'s text (15 → 30 minutes):

```sh
$ xspec review create --base HEAD --name lockout-change
created review session 'lockout-change' (path-blocks): 3 item(s)

$ xspec review status lockout-change
item-1 subtree-coherence specs/AUTH.mdx#auth.lockout unresolved blocked=false
item-2 dependency-consistency specs/OVERVIEW.mdx#overview unresolved blocked=false
item-3 parent-consistency specs/AUTH.mdx#auth unresolved blocked=true
totals: unresolved=3 updated=0 no-change=0 skipped=0 invalidated=0
```

The parent item is blocked until the changed subtree beneath it is reviewed. `next` serves the first unblocked item needing review, with everything required to judge it — the changed text, its context, and the before/after of the originating edit:

```sh
$ xspec review next lockout-change
item item-1
  kind: subtree-coherence
  ...
  reason: the subtree rooted at specs/AUTH.mdx#auth.lockout changed relative
          to the baseline; review the node and all its descendants as a
          single block (SPEC 10.5)
  scope: specs/AUTH.mdx#auth.lockout (present)
    text: |
      Five consecutive failed attempts lock the account for 30 minutes.
  origin:
  - specs/AUTH.mdx#auth.lockout
    before: present
      text: |
        Five consecutive failed attempts lock the account for 15 minutes.
    after: present
      text: |
        Five consecutive failed attempts lock the account for 30 minutes.
```

Work through the session:

```sh
$ xspec review resolve lockout-change item-1 --status updated \
    --note "30-minute lockout confirmed with support team"
resolved item 'item-1' of session 'lockout-change' as updated

$ xspec review resolve lockout-change item-2 --status no-change
$ xspec review resolve lockout-change item-3 --status no-change   # unblocked now

$ xspec review next lockout-change
review session 'lockout-change' is fully resolved: no item needs review

$ xspec review list
lockout-change path-blocks unresolved=0 updated=1 no-change=2 skipped=0 invalidated=0
```

Resolving a blocked item is refused; so is creating a session under an existing name (compared case-insensitively at create time, so session files stay unambiguous on case-insensitive filesystems).

## Scripting and agents

`review next <name> --json` returns a **self-contained payload**: the item plus every scope/context/origin node with identity, presence, source range, and full text (before/after for origins) — enough to act on the item without further reads. When nothing needs review it exits `0` with `"fullyResolved": true` and no item, which makes the driver loop trivial:

```sh
while item=$(xspec review next my-session --json) && \
      [ "$(jq .fullyResolved <<<"$item")" = "false" ]; do
  # judge the item, possibly edit sources…
  xspec review resolve my-session "$(jq -r .item.id <<<"$item")" --status no-change
done
```

`review show <name> <item-id>` prints one item in the same depth; `review export <name>` emits the entire session — parameters, decompositions, every item with its payload and blocked state, read-time invalidation applied — as one JSON document for reporting or archival.

## Operational notes

- `status`, `next`, `show`, `export` are reads; `create`, `resolve`, `split` are mutating and [mutually exclusive](./cli.md#concurrency) per workspace.
- Session names: `A–Z a–z 0–9 . _ -`, not starting with `.`.
- A session file that is damaged or hand-edited into inconsistency is reported **corrupt**: every subcommand naming it (and `check`, and `review list`) says so and exits `1` without touching it. Restore it from version control; nothing regenerates it.
- Sessions read the graph at the current sources — if the workspace fails validation, review commands report the findings and exit `1` like every other read.
