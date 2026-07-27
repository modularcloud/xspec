# Impact analysis

```sh
xspec impact --base <git-ref>
```

`impact` compares the current workspace against a **baseline**: the graph reconstructed from the workspace content at a git ref — sources *and* configuration as they stood there — with identities mapped forward through the [journal](refactoring.md#the-journal). It answers "what did this change touch?" at two levels: requirement nodes (with change categories and attribution) and code (which locations are impacted, with witness paths).

`impact` is informational: it exits `0` whether or not differences exist, and `--json` emits the full report as data. It reads git history but never writes to git.

## Hashes

Every requirement node carries four hashes; the categories below are defined in terms of them. In practice you rarely look at hash values — you look at the categories — but knowing what each hash *covers* tells you why a node shows up:

| Hash | Covers | Changes when |
|---|---|---|
| `ownHash` | The node's own content: its text runs plus the positions and identities of its children and embedded references | You edit the node's prose; add/remove/reorder its children; add, remove, retarget, or reposition a `{text(...)}` embedding |
| `subtreeHash` | `ownHash` + all descendants' subtree hashes, in order | Anything changes anywhere in the subtree |
| `effectiveHash` | `subtreeHash` inputs + the dependency edges of the node and its subtree, each as (target identity, target's `effectiveHash`) | The subtree changes, a dependency is added/removed/retargeted, or **any upstream target's `effectiveHash` changes** — this is the hash that propagates through the graph |
| `metadataHash` | The node's `d` target set, `coverage` attribute, and tags | Metadata edits only |

Two consequences worth internalizing:

- **Embedding insulates the embedder.** `{text(X)}` hashes as a *reference to X*, not as X's expanded text. Editing X changes X's hashes; the embedder is affected only via `effectiveHash` — an upstream change — while its Markdown output still re-expands on the next build.
- **References hash by canonical identity**, resolved through the journal. A journaled `rename`/`move` changes no hash anywhere; hand-editing an ID does (it's a delete plus an add).

## Change categories

Relative to the baseline, each node receives zero or more categories, each **attributed to the originating nodes** — the places actual edits happened:

| Category | Meaning |
|---|---|
| `changed` | The node was added or deleted, or its own content changed (structural edits — adding/removing a child — originate at the parent, which is also `changed`) |
| `metadata-changed` | Its `d` targets, `coverage`, or tags changed |
| `descendant-changed` | Something in its subtree changed (attributed to the descendants that changed) |
| `upstream-changed` | A dependency target of the node or its subtree changed effectively (attributed to the originating edits upstream) |

Categories are independent flags; a node can carry several. A node added or deleted since the baseline is `changed` and nothing else.

## Impacted code

Code locations enter through their `references` and `embeds` edges (the union of both graphs — an edge deleted since the baseline still implicates its location):

- **directly impacted** — the location has an edge to a node whose `subtreeHash` changed: the text it points at is different.
- **transitively impacted** — the location has an edge to a node whose `effectiveHash` changed but whose `subtreeHash` did not: what it points at reads the same, but something it depends on moved.

Each impacted location is reported with one impact edge and **one shortest witness path** from that edge's target to a node whose own edit explains the change — so every "you are impacted" comes with a traceable why. Deleted requirements and deleted code locations are reported under their baseline identities.

## Reading a report

An edit to the text of `auth.lockout` in the [getting-started project](getting-started.md):

```sh
$ xspec impact --base HEAD
baseline 56b30aaab448c0a1b0207b9c67dd8a0571485501
changed:
  specs/AUTH.mdx#auth.lockout — attributed to: specs/AUTH.mdx#auth.lockout
descendant-changed:
  specs/AUTH.mdx, specs/AUTH.mdx#auth — attributed to: specs/AUTH.mdx#auth.lockout
upstream-changed:
  specs/OVERVIEW.mdx — attributed to: specs/AUTH.mdx#auth.lockout
  specs/OVERVIEW.mdx#overview — attributed to: specs/AUTH.mdx#auth.lockout
```

Reading it: the lockout requirement itself changed; its ancestors (`auth` and the file root — collapsed onto one line because they form a chain with identical attribution) contain the change; the `OVERVIEW` document depends on the `auth` section, so it is upstream-affected — all attributed to the one node that was actually edited. When impacted code exists, it follows with the qualifying edge and witness path:

```
directly impacted code:
  test/auth.test.ts#testInvalidLogin — via references specs/AUTH.mdx#auth.login.invalid; path: specs/AUTH.mdx#auth.login.invalid
```

In JSON (`--json`), the same content is structured per node group — note `nodes` is a list because ancestor chains collapse into one entry:

```json
{
  "baseline": "56b30aa…",
  "requirements": [
    {
      "nodes": ["specs/AUTH.mdx#auth.lockout"],
      "deleted": false,
      "categories": [
        { "category": "changed", "attributedTo": ["specs/AUTH.mdx#auth.lockout"] }
      ]
    }
  ],
  "code": {
    "direct": [
      {
        "location": "test/auth.test.ts#testInvalidLogin",
        "edge": { "from": "test/auth.test.ts#testInvalidLogin",
                  "kind": "references",
                  "to": "specs/AUTH.mdx#auth.login.invalid" },
        "path": ["specs/AUTH.mdx#auth.login.invalid"]
      }
    ],
    "transitive": []
  }
}
```

## Baselines and refactoring

Because baselines replay the journal, **journaled renames and moves are invisible to impact**. After `xspec rename specs/AUTH.mdx auth.lockout auth.throttling`:

```sh
$ xspec impact --base HEAD
baseline ba39f7296cccc1abc4c63ac33189505bb270857c
```

— an empty report. The rename rewrote every reference and recorded the identity mapping; nothing *changed* in the graph's terms. Restructure specs by hand instead and the same operation reports a deletion plus an addition, with every dependent upstream-changed. This is the payoff of [`rename`/`move`](refactoring.md).

A baseline that cannot be read or reconstructed — unknown ref, sources at the ref that don't validate, a journal whose baseline content is not a prefix of the current one — is a usage error (exit `2`) naming the offending entries or files.

## Where impact fits

- **Pre-merge summary**: `xspec impact --base origin/main --json` in CI annotates a PR with exactly which requirements changed and which code is affected.
- **Review scoping**: [`xspec review create --base <ref>`](reviews.md) turns the same comparison into a durable, staged checklist with blocking order — impact is the report, review is the workflow.
- **Change auditing**: since attribution always points at originating nodes, an unexpected entry in the report traces to the edit that caused it in one hop.
