# Reviews

A review session turns graph results into a **staged, durable checklist**:

- each item is one focused judgment ("does this subtree still cohere?", "does this dependent still hold given its target changed?");
- items unlock in a deliberate order;
- resolutions survive restarts and merges;
- anything that changes after you resolved it gets flagged rather than silently forgotten.

Sessions are stored as plain JSON at `.xspec/reviews/<name>.json`. They are [durable files](workspace.md#derived-durable-and-transient), committed alongside the specs they review. Items are stored one per line, so concurrent branches merge textually.

## Creating a session

```sh
xspec review create --base <ref> --name <name>            # path-blocks strategy
xspec review create --strategy audit --name <name>        # audit strategy
xspec review create --coverage <profile> --name <name>    # coverage strategy
```

Exactly one of `--base`, `--strategy audit`, and `--coverage` is required. Creation records the session's parameters *fully resolved*: the commit the ref pointed at, or the profile's definition with group names expanded to their globs. Later renaming a branch, editing a profile, or re-pointing a ref therefore never changes what the session reviews.

### `path-blocks` — review a change (the default, baseline-based)

For a change relative to `--base`, the session contains:

- one **`subtree-coherence`** item per changed subtree root: the node and all its descendants, reviewed as a single block;
- one **`parent-consistency`** item per ancestor of a change, asking whether the parent's own prose still makes sense given what changed beneath it. It's *blocked by* the items for the changed branches beneath it, so parents unlock only after their children are reviewed;
- one **`metadata-consistency`** item per node whose `d`, `coverage`, or `tags` changed;
- one **`dependency-consistency`** item per node that depends on a target whose effective content changed: "your upstream moved; do you still hold?";
- one **`code-impact`** item per [impacted code location](impact.md#impacted-code).

A node deleted since the baseline still counts as a child of its baseline parent, so deletions are reviewed in place. Item order is deepest-first for requirement items, then code items. That matches the blocking direction, so `next` naturally walks bottom-up.

### `audit` — review everything

`audit` creates one `subtree-coherence` item per requirement node (roots included), with no baseline. Each item is blocked by its children's items, so leaves unlock first and every subtree is confirmed bottom-up. Use it for a first adoption pass over an existing spec corpus, or for periodic full audits.

### `coverage` sessions — burn down uncovered requirements

A coverage session has one **`uncovered-requirement`** item per uncovered required node of the profile at creation time. Use it to turn a [coverage](coverage.md) gap into a tracked work list.

## The item model

Every item carries these fields:

- `id`: an opaque string such as `ra339e60b52c169bf`. Copy it from `status`, `next`, or `export`.
- `kind`.
- `scope`: what's under review.
- `context`: the nodes whose text frames the judgment.
- `origin`: the originating edits, when there are any.
- `reason`: a human-readable sentence explaining why the item exists.
- recorded `baseline` and `current` state.
- `status`.
- an optional `note`.
- `blockedBy`.

### Statuses

| Status | Meaning |
|---|---|
| `unresolved` | Not reviewed yet (every item starts here) |
| `updated` | Reviewed; you changed the sources in response |
| `no-change` | Reviewed; intentionally left as is |
| `skipped` | Intentionally deferred or ignored |
| `invalidated` | Was resolved, but relevant state changed since |

`updated`, `no-change`, and `skipped` are the *resolved* statuses. An item is **blocked** while any of its `blockedBy` items is unresolved. Since `invalidated` is not resolved, a blocker that gets invalidated re-blocks everything above it until it's resolved again.

Each `resolve` replaces the item's status and note, and records its current state. Resolving without `--note` clears any earlier note.

### Invalidation: resolutions that stop being true get flagged

Resolving an item records the state relevant to its kind: per-kind hashes, node presence, and the item's current context. Whenever the session is read (`status`, `next`, `show`, `export`), each resolved item is checked against the current graph. If a relevant hash changed, a node appeared or disappeared, or the item's context changed, the item reports as `invalidated` and needs review again. Reads never write the session file: invalidation is computed, not stored.

Two properties keep this workable:

- **Journaled renames and moves never invalidate anything.** Recorded nodes compare by canonical identity through the journal, and reads present them under their current names. Refactor freely mid-review with [`rename`/`move`](refactoring.md).
- **Deletion review is resolvable.** A node that was already absent when you resolved doesn't invalidate the item by staying absent.

### Re-derivation: sessions follow the work

When you resolve an item as `updated`, and at the end of every `split`, xspec re-runs the session's generators against the current workspace, using the recorded creation parameters:

- New items appear for newly changed nodes.
- An existing item that's generated again (matched by kind and scope) keeps its id, status, note, and recorded state, and takes the newly generated scope, context, origin, and reason. A changed origin alone doesn't invalidate it.
- Items that are no longer generated remain.
- Blocking is recomputed.

Your checklist tracks the change as it evolves, instead of describing only its first draft.

### `split`: decompose a big review block

`xspec review split <name> <item-id>` breaks a `subtree-coherence` item into one item per child subtree, plus a `parent-consistency` item for the root's own text (blocked by the children). The decomposition is recorded durably and honored by later re-derivations. Use it when a subtree is too large to judge as one block.

## A worked session

Take the [example project](getting-started.md#the-example-in-the-other-pages) and edit `auth.lockout`'s text from 15 to 30 minutes:

```sh
$ xspec review create --base HEAD --name lockout-change
created review session 'lockout-change' (path-blocks): 3 item(s)

$ xspec review status lockout-change
ra339e60b52c169bf subtree-coherence specs/AUTH.mdx#auth.lockout unresolved blocked=false
r8807b03b23df9371 dependency-consistency specs/OVERVIEW.mdx#overview unresolved blocked=false
rac5c69a6253e8ed4 parent-consistency specs/AUTH.mdx#auth unresolved blocked=true
totals: unresolved=3 updated=0 no-change=0 skipped=0 invalidated=0
```

The parent item is blocked until the changed subtree beneath it is reviewed. `next` serves the first unblocked item that needs review, with everything required to judge it: the changed text, its context, and the before and after of the originating edit.

```sh
$ xspec review next lockout-change
item ra339e60b52c169bf
  kind: subtree-coherence
  status: unresolved
  blocked: false
  blockedBy: (none)
  reason: the subtree rooted at specs/AUTH.mdx#auth.lockout changed relative to the baseline; review the node and all its descendants as a single block (SPEC 10.5)
  scope: specs/AUTH.mdx#auth.lockout (present)
    range: 322-439
    text: |
      Five consecutive failed attempts lock the account for 30 minutes.
  ...
  origin:
  - specs/AUTH.mdx#auth.lockout
    range: 322-439
    before: present
      text: |
        Five consecutive failed attempts lock the account for 15 minutes.
    after: present
      text: |
        Five consecutive failed attempts lock the account for 30 minutes.
  ...
```

Work through the session:

```sh
$ xspec review resolve lockout-change ra339e60b52c169bf --status updated \
    --note "30-minute lockout confirmed with support team"
resolved item 'ra339e60b52c169bf' of session 'lockout-change' as updated

$ xspec review resolve lockout-change r8807b03b23df9371 --status no-change
$ xspec review resolve lockout-change rac5c69a6253e8ed4 --status no-change   # unblocked now

$ xspec review next lockout-change
review session 'lockout-change' is fully resolved: no item needs review

$ xspec review list
lockout-change path-blocks unresolved=0 updated=1 no-change=2 skipped=0 invalidated=0
```

Resolving a blocked item is refused. So is creating a session under an existing name; the comparison at create time ignores ASCII case, so session files stay unambiguous on case-insensitive filesystems. If an existing session with that name is corrupt, `create` reports the corruption instead.

## Scripting and agents

`review next <name> --json` returns a **self-contained payload**: the item, plus every scope, context, and origin node with its identity, presence, source range (code locations included), and full text (before and after for origins). For a `metadata-consistency` item it also carries the node's `d` targets, coverage, and tags before and after. That's enough to act on the item without further reads. When nothing needs review, it exits `0` with `"fullyResolved": true` and no item, which makes the driver loop trivial:

```sh
while item=$(xspec review next my-session --json) && \
      [ "$(jq .fullyResolved <<<"$item")" = "false" ]; do
  # judge the item, possibly edit sources…
  xspec review resolve my-session "$(jq -r .item.id <<<"$item")" --status no-change
done
```

`review show <name> <item-id>` prints one item at the same depth. `review export <name>` prints the entire session as one JSON document, for reporting or archival: parameters, decompositions, and every item with its payload and blocked state, with read-time invalidation applied.

## Operational notes

- `status`, `next`, `show`, `export`, and `list` are reads. `create`, `resolve`, and `split` are mutating and [mutually exclusive](cli.md#concurrency) per workspace.
- Session names may contain only `A–Z a–z 0–9 . _ -`, and must not start with `.`.
- A session file that's damaged or hand-edited into inconsistency is reported **corrupt**. Every subcommand naming it says so and exits `1` without touching it, as do `check` and `review list`. Restore it from version control; nothing regenerates it.
- Sessions read the graph at the current sources. If the workspace fails validation, review commands report the findings and exit `1`, like every other read, without reading any session.
