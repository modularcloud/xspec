# Getting started

This walkthrough takes you from an empty directory to a validated, coverage-measured spec project. Every command and output shown here was produced by the real tool.

## Install

xspec requires **Node.js ≥ 22**. It is not yet published to npm, so run it from a checkout of this repository:

```sh
git clone https://github.com/modularcloud/xspec.git
cd xspec
npm ci
npm run build
```

The executable is `dist/cli/bin.js`. Either invoke it directly:

```sh
node /path/to/xspec/dist/cli/bin.js <command>
```

or link it once so `xspec` is on your `PATH`:

```sh
npm link        # from the xspec checkout
xspec build     # now available anywhere
```

The rest of the documentation writes `xspec <command>` and assumes one of the above.

## Create a project

An xspec project is any directory with an `xspec.config.ts` at its root. The config names your spec files and (optionally) the code that consumes them:

```ts
// xspec.config.ts
import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    product: ["specs/**/*.mdx"]
  },
  code: {
    app: ["src/**/*.ts"],
    tests: ["test/**/*.ts"]
  },
  markdown: { emit: true },
  coverage: [
    {
      name: "tested",
      target: "product",
      boundary: "tests",
      mode: "direct"
    }
  ]
})
```

Two things to know about this file:

- xspec **parses it statically and never executes it** — it must be purely declarative (literals only). See [Configuration](configuration.md) for the full schema.
- The `import { defineConfig } from "xspec"` exists for editor type support. xspec itself never resolves it, so your project does not need xspec installed as a dependency for the CLI to work. If your own `tsc` run includes `xspec.config.ts`, either install the package (e.g. `npm install /path/to/xspec/checkout`) or exclude the config file from your tsconfig.

## Write a first spec

Spec files are MDX documents in which requirement sections are wrapped in `<S>` tags. Each section carries a structural dot-path `id`:

```mdx
{/* specs/AUTH.mdx */}
<S id="auth">
Authentication.

<S id="auth.login">
Users sign in with an email address and a password.

<S id="auth.login.valid" tags="happy-path">
A user submitting valid credentials is signed in.
</S>

<S id="auth.login.invalid" tags="negative">
Invalid credentials are rejected with a generic error message.
</S>
</S>

<S id="auth.lockout" tags="negative temporal">
Five consecutive failed attempts lock the account for 15 minutes.
</S>
</S>
```

The nesting is the structure: `auth.login.valid` must be a child of `auth.login`, which must be a child of `auth`. See [Writing specs](writing-specs.md) for the complete syntax.

## Build

```sh
$ xspec build
$ echo $?
0
```

`build` validates the sources and generates everything (see [Workspace files](workspace.md) for details):

```
specs/AUTH.mdx                 ← your source
specs/AUTH.md                  ← pure Markdown (annotations stripped), because markdown.emit
specs/AUTH.xspec.ts            ← generated typed module
specs/AUTH.xspec.impl.js       ← companions of the generated module
specs/AUTH.xspec.impl.d.ts
specs/AUTH.xspec.impl.d.ts.map
.xspec/graph.json              ← the project graph
```

A failed `build` (invalid sources, exit `1`) modifies nothing — derived files stay exactly as they were.

## Reference requirements from code

Code declares which requirements it implements or exercises by importing the generated module:

```ts
// src/auth.ts
import AUTH from "../specs/AUTH.xspec"

export function login(email: string, password: string): boolean {
  AUTH.auth.login.valid        // dependency marker → "references" edge
  return email.includes("@") && password.length > 0
}
```

```ts
// test/auth.test.ts
import AUTH, { text } from "../specs/AUTH.xspec"

export function testValidLogin(): string {
  AUTH.auth.login.valid        // marker: this test exercises that requirement
  return text(AUTH.auth.login.valid)   // the requirement text, as a string
}

export function testInvalidLogin(): void {
  AUTH.auth.login.invalid
}
```

A marker is an ordinary property read at runtime (harmless, no tooling required) and a type-checked reference at compile time: if the requirement is renamed or deleted, your build breaks instead of silently drifting. Setup details and rules are in [Using specs from TypeScript](typescript.md).

Re-run `xspec build` after adding code references so the graph includes them.

## Inspect the graph

List every requirement:

```sh
$ xspec ids --tree
specs/AUTH.mdx
  auth
    auth.login
      auth.login.valid
      auth.login.invalid
    auth.lockout
```

Show one requirement — its text, tags, hashes, and every edge in and out:

```sh
$ xspec show "specs/AUTH.mdx#auth.login.valid"
specs/AUTH.mdx#auth.login.valid
source range: bytes 104-202
tags: happy-path
coverage: required
hashes:
  ownHash: b235263b…
  subtreeHash: bc3ccfe3…
  effectiveHash: 08b71bba…
  metadataHash: d2d935c3…
edges:
  incoming:
    contains from specs/AUTH.mdx#auth.login
    references from src/auth.ts#login
    embeds from test/auth.test.ts#testValidLogin
    references from test/auth.test.ts#testValidLogin
  outgoing:
own text:
  A user submitting valid credentials is signed in.
subtree text:
  A user submitting valid credentials is signed in.
```

`xspec query` is the machine-facing equivalent (JSON only) — see the [CLI reference](cli.md#xspec-query-sub).

## Measure coverage

The `tested` profile above asks: which `product` requirements are directly referenced by anything in the `tests` code group?

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
    ...
```

`auth.lockout` has no test yet. `xspec coverage tested --check` exits `1` while that is true — wire it into CI to keep specs and tests honest. Details in [Coverage](coverage.md).

## Validate continuously

```sh
$ xspec check
$ echo $?
0
```

`check` runs every build validation without writing anything, and additionally verifies that generated files are up to date, references resolve, no dependency cycles exist, policy rules hold, the journal replays, and review sessions are intact. Any finding exits `1` with an actionable message:

```sh
$ echo "// tampered" >> specs/AUTH.xspec.ts && xspec check
specs/AUTH.xspec.ts: stale generated output (14.10): stale generated output:
specs/AUTH.xspec.ts does not match what the current sources and configuration
generate; run `xspec build` to regenerate every derived file (SPEC 14.10)
1 finding
```

`xspec build && xspec check` is the everyday loop; `check` alone is the CI gate.

## Where to go next

- Track what a spec edit affects: [Impact analysis](impact.md)
- Turn changes into a reviewable checklist: [Reviews](reviews.md)
- Restructure specs without losing history: [Renaming and moving](refactoring.md)
- Commit the right files: [Workspace files](workspace.md)
