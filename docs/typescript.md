---
title: Using specs from TypeScript
sidebarTitle: TypeScript integration
description: Generated modules, dependency markers, text(), and compiler setup.
---

`xspec build` compiles each spec source `NAME.mdx` into a typed TypeScript module next to it. Code imports that module to reference requirements; every reference is type-checked, navigable, and recorded as an edge in the project graph.

## Importing a spec module

```ts
import AUTH, { text } from "../specs/AUTH.xspec"
```

- The specifier is the source path with `.mdx` replaced by `.xspec` — a relative path ending in `.xspec`, resolved like any relative import.
- The permitted bindings are exactly the **default export** (the file's root node) and the named **`text`** export, each optionally aliased. Importing anything else from a spec module is a build error.
- Type-only imports (`import type AUTH from …`, or a `type` modifier on a binding) are allowed; a type-only binding is a type-level name that records no edges (see below).

Everything else that smells like module linking with a `.xspec` specifier is invalid by design: dynamic `import("./A.xspec")`, every `export … from "./A.xspec"` re-export form, and `import X = require("./A.xspec")`. Spec nodes never travel through re-exports — each file that uses a requirement imports the module itself, which is what keeps edge attribution honest. Importing a generated file by its underlying name (`./A.xspec.ts`, `./A.xspec.impl.js`, anything under `.xspec/`, or an emitted Markdown path) is likewise invalid: derived files are consumed only through the `.xspec` specifier.

## Nodes are opaque, typed tokens

The default export is the root node; child sections hang off it as readonly properties named by ID segment:

```ts
AUTH.auth.login.valid            // the node for specs/AUTH.mdx#auth.login.valid
AUTH["auth"]["login"]["valid"]   // same node; bracket form for non-identifier segments
```

- A missing or misspelled path is a **TypeScript type error** against the generated module.
- Nodes carry no requirement text as values. The only supported operations are child property access and passing the node to `text()`.
- Every node has a documentation comment holding its own text (truncated to 1000 code points), so editors show the requirement on hover; go-to-definition on a reference lands in the source `.mdx` at the `<S>` section (file start for the root).

## Two ways to reference a requirement

### Dependency markers — "this code implements that"

A bare requirement reference in expression-statement position is a **marker**:

```ts
export function login(email: string, password: string): boolean {
  AUTH.auth.login.valid          // ← marker: records a `references` edge
  return email.includes("@") && password.length > 0
}
```

At runtime a marker is a harmless property read — no tooling, no side effects. In the graph it records a `references` edge from the enclosing code location to the node. Markers are how code participates in [coverage](./coverage.md) and [impact analysis](./impact.md).

A marker to a *root* node (`AUTH` alone on a line) records an edge, but roots never participate in coverage paths — its practical effect is to make the code location impacted by any change in the whole document or upstream of it.

### `text(node)` — "give me the requirement's text"

```ts
const requirement = text(AUTH.auth.login.valid)
```

`text(node)` returns the node's subtree text as a `string` and records an `embeds` edge from the calling code location. This is the **only** way requirement text is reachable at runtime — a consumer that never imports `text` gets no text from the module, only opaque tokens.

The string form (`text("auth.login")`) is MDX-only; in TypeScript it is a build error.

## The rules markers live by

References must be statically analyzable, and the sanctioned value-level uses of spec bindings are exact:

- A node expression (the default binding, or a chain of child accesses from it) may appear only **as a marker** or **as the sole argument to its own module's `text`**.
- A `text` binding may appear only as the callee of such a call.
- Chains use only dot access or string-literal bracket access. Optional chaining, parentheses, non-null assertions, or any computed index make the reference non-static — a build error.
- Everything else — aliasing a node into a variable, destructuring, storing nodes in data structures, passing them to other functions, re-exporting them — is a build error ("unsupported node usage"). This is what guarantees the graph is complete: every reference is visible in the source, rooted at an import.

At a glance, all of these are build errors:

```ts
AUTH.auth?.login.valid               // ❌ optional chaining — non-static
(AUTH.auth.login.valid)              // ❌ parenthesized
AUTH.auth.login.valid!               // ❌ non-null assertion
AUTH.auth[segment]                   // ❌ computed index
const node = AUTH.auth.login.valid   // ❌ aliased into a variable
const { auth } = AUTH                // ❌ destructured
track(AUTH.auth.login.valid)         // ❌ passed to another function
export { AUTH }                      // ❌ re-exported
```

Scoping is respected: an identifier that resolves to a local declaration shadowing the import is not a spec reference, and a type-only binding used at the value level is your TypeScript error, not an xspec edge:

```ts
function elsewhere() {
  const AUTH = loadConfig()    // local declaration shadows the import
  AUTH.auth.login.valid        // not a spec reference — records nothing
}
```

Purely type-level references (`typeof AUTH.auth.login` and friends) are unrestricted and record nothing — with the corollary that `xspec rename`/`move` do not rewrite them.

### Module branding

Node types are branded per module: passing a node from one spec module to another module's `text` is a TypeScript type error *and* a runtime throw naming both modules. When one file consumes several spec modules, alias the `text` imports:

```ts
import AUTH, { text as authText } from "../specs/AUTH.xspec"
import BILLING, { text as billingText } from "../specs/BILLING.xspec"
```

## Code locations: how references are attributed

Graph edges from code are attributed to a **code location**: either the whole file (`src/auth.ts`) or a named unit within it (`src/auth.ts#LoginService.validate`).

Named units are constructs that statically bind a plain identifier to executable code: function and class declarations, class members with identifier names (methods, getters/setters, function-valued properties), `const`/`let`/`var` bindings whose initializer is a function or class expression, namespaces (`namespace A.B` yields `A.B`), and default exports (`#default` when anonymous). A reference is attributed to the innermost enclosing named unit, or to the file when none encloses it. When the same unit chain occurs more than once in a file (getter/setter pairs, same names in sibling scopes), later occurrences are disambiguated as `path#unit@2`, `@3`, … in document order.

This identity is what you see in `coverage` paths, `impact` reports, `query` results, and review items.

## Compiler and runtime setup

Generated modules work under standard TypeScript tooling with **no xspec runtime dependency**. `NAME.xspec.ts` re-exports from its companion `NAME.xspec.impl.js` (plain JavaScript, with `NAME.xspec.impl.d.ts` carrying the types and declaration maps pointing editors back into the `.mdx`).

A verified minimal setup — CommonJS-mode project, compiled in place:

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true
  },
  "include": ["src", "test", "specs/*.xspec.ts"]
}
```

```sh
tsc -p tsconfig.json   # typechecks references, emits JS beside sources
node src/print.js      # runs under plain Node — no loader, no dependency
```

Notes from the trenches:

- **Include the generated modules in your program** (the `specs/*.xspec.ts` entry above) so they emit JavaScript alongside their `.impl.js` companions.
- **Compile in place rather than through `outDir`.** With `outDir`, tsc copies `NAME.xspec.js` into the output tree but not its `.impl.js` companion, and the runtime import breaks. If you need an output tree, bundle instead.
- **Extensionless specifiers and ESM.** `./NAME.xspec` resolves in CommonJS-mode files (the setup above) and under `moduleResolution: "bundler"`. In a `"type": "module"` package, Node's ESM rules make extensionless relative specifiers unresolvable — consume spec modules from CJS-mode files or through a bundler in that case.
- The marker statement (`AUTH.auth.login.valid`) is intentionally expression-only. If your lint setup flags unused expressions, allow it for spec references — that is the feature.
