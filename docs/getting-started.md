# Getting started

This walkthrough takes you from an empty directory to a validated project with coverage measured. Every command and output shown here was produced by the real tool.

## Install

xspec requires **Node.js ≥ 22**. It's published on npm as `@modularcloud/xspec`. Install it into your project as a development dependency under the name `xspec`:

```sh
npm install --save-dev xspec@npm:@modularcloud/xspec
npx xspec version
```

The alias does two things. It installs the package as `xspec`, the module name that `xspec.config.ts` imports `defineConfig` from (see below), so your editor gets type support. It also puts the `xspec` command in `node_modules/.bin`.

Two other ways to run it:

- **Globally**: `npm install -g @modularcloud/xspec`.
- **Once, without installing**: `npx @modularcloud/xspec <command>`.

The rest of the documentation writes `xspec <command>`. With a local install, run it as `npx xspec <command>` or from an npm script.

To work on xspec itself, build it from a checkout instead: clone `https://github.com/modularcloud/xspec`, then run `npm ci && npm run build && npm link`.

## Create a project

An xspec project is any directory with an `xspec.config.ts` at its root. The config names your spec files and, optionally, the code that uses them:

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

- xspec **parses it statically and never executes it**, so it must be purely declarative (literals only). See [Configuration](configuration.md) for the full schema.
- The `import { defineConfig } from "xspec"` exists for editor type support. xspec itself never resolves it, so the CLI works whether or not the import resolves. If your own `tsc` run includes `xspec.config.ts`, install the package under the `xspec` alias as above, or exclude the config file from your tsconfig.

## Write a first spec

Spec files are MDX documents in which requirement sections are wrapped in `<S>` tags. Each section carries a structural dot-path `id`. Create `specs/AUTH.mdx`:

```mdx
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
specs/AUTH.mdx                   ← your source
specs/AUTH.md                    ← pure Markdown (annotations stripped), because markdown.emit
specs/AUTH.xspec.ts              ← generated typed module, runtime included
specs/AUTH.xspec.impl.d.ts       ← companions of the generated module (types, go-to-definition)
specs/AUTH.xspec.impl.d.ts.map
.xspec/                          ← graph data: the project graph
```

A failed `build` (invalid sources, exit `1`) modifies nothing: derived files stay exactly as they were.

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

A marker is an ordinary property read at runtime (harmless, no tooling required) and a type-checked reference at compile time. If the requirement is renamed or deleted, your build breaks instead of silently drifting. Setup details and rules are in [Using specs from TypeScript](typescript.md).

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

Show one requirement, with its text, tags, hashes, and every edge in and out:

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

Find every place that references it, with exact byte positions:

```sh
$ xspec occurrences --to "specs/AUTH.mdx#auth.login.valid"
```

`xspec query` is the machine-facing equivalent of `show` and `ids`; see the [CLI reference](cli.md#xspec-query-sub). `occurrences`, `view`, `at`, and `inventory` serve editors and other tools; see [Machine interface](machine-interface.md). All of them print JSON.

## Measure coverage

The `tested` profile above asks: which `product` requirements are directly referenced by anything in the `tests` code group?

```sh
$ xspec coverage
profile tested
  required: 3, covered: 2, uncovered: 1, ignored: 3
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
```

`auth.lockout` has no test yet. While that's true, `xspec coverage tested --check` exits `1`, so wire it into CI to keep specs and tests honest. Details are in [Coverage](coverage.md).

## Validate continuously

```sh
$ xspec check
$ echo $?
0
```

`check` runs every build validation without writing anything. That covers references, cycles, and the journal. It additionally verifies that generated files and graph data are up to date, policy rules hold, and review sessions are intact. Any finding exits `1`. Each finding names its location and stable code, with an actionable message:

```sh
$ echo "// tampered" >> specs/AUTH.xspec.ts && xspec check
specs/AUTH.xspec.ts: stale-output: stale generated output: specs/AUTH.xspec.ts does not match what the current sources and configuration generate; run `xspec build` to regenerate every derived file (SPEC 14.10)
1 finding
```

`xspec build && xspec check` is the everyday loop; `check` alone is the CI gate.

## The example in the other pages

The other pages extend this project with one more spec file, `specs/OVERVIEW.mdx`, which depends on the `auth` section and is excluded from coverage:

```mdx
import AUTH from "./AUTH.xspec"

<S id="overview" coverage="none" d={AUTH.auth}>
The product summary, for context.
</S>
```

## Where to go next

- Track what a spec edit affects: [Impact analysis](impact.md)
- Turn changes into a reviewable checklist: [Reviews](reviews.md)
- Restructure specs without losing history, with a preview first: [Renaming and moving](refactoring.md)
- Commit the right files: [Workspace files](workspace.md)
- Build an editor integration or other tooling: [Machine interface](machine-interface.md)
