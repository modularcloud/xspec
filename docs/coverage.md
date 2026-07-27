---
title: Coverage
description: Profiles, boundaries, direct vs. transitive coverage, and CI gating.
---

# Coverage

Coverage answers one question per configured profile: **is every requirement I care about reachable from the things that are supposed to exercise it?** It is graph reachability over dependency edges — deliberate, inspectable, and deterministic — not proof of semantic correctness.

## The model

A profile ([configured](./configuration.md#coverage--coverage-profiles) in `xspec.config.ts`) names:

- a **target**: the spec group whose requirements must be covered, optionally narrowed by `targetTags` and, by default, to leaves;
- a **boundary**: the spec or code group that counts as "covering" — test code, test specs, a design layer;
- a **mode**: `direct` (a single dependency edge from a boundary node to the target) or `transitive` (a path of one or more edges);
- optionally **edgeKinds**: which of `depends`, `embeds`, `references` may carry coverage (default: all three).

A target requirement is **covered** when a permitted path exists from a boundary node to it. Two exclusions apply everywhere: `contains` edges never grant coverage (structure isn't testing), and root nodes never appear in coverage paths at all — not as boundary, intermediate, or target. A spec group used as a boundary contributes only its non-root requirement nodes.

### The required set

For each profile, the required nodes are: the target group's nodes → restricted to those carrying a `targetTags` tag (when configured) → restricted to leaves (unless `targets: "all"`) → minus `coverage="none"` nodes → minus roots. Everything excluded is reported as **ignored**, with every reason that applies.

## Running it

`xspec coverage` runs all profiles; `xspec coverage <name>` runs one:

```sh
$ xspec coverage
profile tested
  required: 3, covered: 2, uncovered: 1, ignored: 5
  covered:
    specs/AUTH.mdx#auth.login.valid
      path: test/auth.test.ts#testValidLogin -> specs/AUTH.mdx#auth.login.valid
    specs/AUTH.mdx#auth.login.invalid
      path: test/auth.test.ts#testInvalidLogin -> specs/AUTH.mdx#auth.login.invalid
  uncovered:
    specs/AUTH.mdx#auth.lockout
  ignored:
    specs/AUTH.mdx: root node; non-leaf under targets: "leaves"
    specs/AUTH.mdx#auth: non-leaf under targets: "leaves"
    specs/AUTH.mdx#auth.login: non-leaf under targets: "leaves"
    specs/OVERVIEW.mdx: root node; non-leaf under targets: "leaves"
    specs/OVERVIEW.mdx#overview: coverage="none"
```

Every covered node comes with **one shortest covering path** (ties broken byte-deterministically), so "covered" is always a claim you can click through, not a boolean. `--json` gives the same information as data.

### Gating CI

```sh
xspec coverage tested --check
```

exits `1` if any required node is uncovered (`0` otherwise). Without `--check`, `coverage` is informational and exits `0`. A typical CI sequence:

```sh
xspec build
xspec check
xspec coverage tested --check
```

## Choosing a mode

**`direct`** is the strict form: the boundary itself must reference the requirement. Use it when tests carry [markers](./typescript.md#two-ways-to-reference-a-requirement) straight to the requirements they exercise:

```
test/auth.test.ts#testValidLogin ──references──▶ specs/AUTH.mdx#auth.login.valid
```

**`transitive`** allows chains, for layered projects. A common shape: product requirements are covered by *test specs* which are in turn referenced by test code — the covering path runs boundary → intermediate → target:

```
test code ──references──▶ test spec ──depends──▶ product requirement
```

With `mode: "transitive"`, a profile targeting the product group and bounded by the test-spec group (or the test-code group) accepts such paths. Use `edgeKinds` to tighten what may carry coverage — e.g. `["depends"]` to insist on declared dependencies and ignore incidental text embeddings.

## Interpreting the numbers

- **uncovered** is your work list: requirements no boundary node reaches. Create a [coverage review session](./reviews.md#coverage-sessions--burn-down-uncovered-requirements) (`xspec review create --coverage <profile> --name <n>`) to burn it down as a checklist.
- **ignored** is the audit trail for scope: every target-group node excluded from the required set, with reasons in a fixed order (`root node`, `coverage="none"`, `non-leaf under targets: "leaves"`, lacking every `targetTags` tag). If something you expected to be measured shows up here, the reason tells you which knob to turn.
- `xspec ids --unreferenced` is related but different: it lists nodes with **no incoming dependency edges at all**, regardless of any profile. A node can be referenced (by the app, by a sibling spec) yet still uncovered for a profile whose boundary is the test group.

## Practical tips

- **Leaves are the default target for a reason**: parents are prose structure; leaves are the testable statements. Switch a profile to `targets: "all"` only when parent sections carry independent requirements of their own.
- **Multiple profiles are cheap.** A `tested` profile (boundary: test code, `direct`) next to a `designed` profile (boundary: design specs, `transitive`) gives two orthogonal gates over the same graph.
- **Tag-scoped profiles** (`targetTags: ["critical"]`) let you hard-gate a subset (`--check` in CI) while the broader profile stays informational.
- Coverage reads the graph, so it reflects the last `build`/refresh — the read commands refresh graph data automatically; you do not need to `build` first unless you also want regenerated modules.
