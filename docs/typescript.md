# Using specs from TypeScript

`xspec build` compiles each spec source `NAME.mdx` into a typed TypeScript module next to it. Code imports that module to reference requirements. Every reference is type-checked, navigable, and recorded as an edge in the project graph.

## Importing a spec module

```ts
import AUTH, { text } from "../specs/AUTH.xspec"
```

- The specifier is the source path with `.mdx` replaced by `.xspec`: a relative path ending in `.xspec`, resolved like any relative import.
- The permitted bindings are exactly the **default export** (the file's root node) and the named **`text`** export, each optionally aliased. Importing anything else from a spec module is a build error.
- Type-only imports are allowed: `import type AUTH from …`, or a `type` modifier on a binding. A type-only binding is a type-level name that records no edges (see below).
- A side-effect-only import (`import "../specs/AUTH.xspec"`) binds nothing and records nothing, but its specifier must still name a spec source.

Every other way of linking to a module with a `.xspec` specifier is invalid by design:

- a dynamic `import("./A.xspec")`;
- every `export … from "./A.xspec"` re-export form;
- `import X = require("./A.xspec")`;
- an import type (`import("./A.xspec")` in a type position, `typeof import("./A.xspec")`);
- a `declare module "./A.xspec"` declaration.

Spec nodes never travel through re-exports. Each file that uses a requirement imports the module itself, and that's what keeps edge attribution honest.

Importing a generated file by its underlying name is likewise invalid: `./A.xspec.ts`, `./A.xspec.impl`, anything under `.xspec/`, or an emitted Markdown path. Derived files are imported only through the `.xspec` specifier.

## Nodes are opaque, typed tokens

The default export is the root node. Child sections hang off it as readonly properties named by ID segment:

```ts
AUTH.auth.login.valid            // the node for specs/AUTH.mdx#auth.login.valid
AUTH["auth"]["login"]["valid"]   // same node; bracket form for non-identifier segments
```

- A missing or misspelled path is a **TypeScript type error** against the generated module, and `xspec build`/`check` report it as `unknown-ts-reference`. There's one known gap: when the last segment of the path is a name every object has (`constructor`, `toString`, `toLocaleString`, `valueOf`, `hasOwnProperty`, `isPrototypeOf`, `propertyIsEnumerable`), TypeScript doesn't flag it, in dot or bracket form. xspec's own finding still does.
- Nodes carry no requirement text as values. The only supported operations are child property access and passing the node to `text()`.
- Every node has a documentation comment holding its own text (truncated to 1000 code points), so editors show the requirement on hover. Go-to-definition on a reference lands in the source `.mdx` at the `<S>` section, or at the start of the file for the root.

## Two ways to reference a requirement

### Dependency markers — "this code implements that"

A bare requirement reference in expression-statement position is a **marker**:

```ts
export function login(email: string, password: string): boolean {
  AUTH.auth.login.valid          // ← marker: records a `references` edge
  return email.includes("@") && password.length > 0
}
```

At runtime a marker is a harmless property read: no tooling needed, no side effects. In the graph it records a `references` edge from the enclosing code location to the node. Markers are how code participates in [coverage](coverage.md) and [impact analysis](impact.md).

A marker to a *root* node (`AUTH` alone on a line) records an edge, but roots never participate in coverage paths. Its practical effect is to make the code location impacted by any change in the whole document or upstream of it.

### `text(node)` — "give me the requirement's text"

```ts
const requirement = text(AUTH.auth.login.valid)
```

`text(node)` returns the node's subtree text as a `string` and records an `embeds` edge from the calling code location. This is the **only** way to reach requirement text at runtime: code that never imports `text` gets no text from the module, only opaque tokens.

The string form (`text("auth.login")`) is MDX-only; in TypeScript it is a build error.

## The rules markers live by

References must be statically analyzable, and the permitted value-level uses of spec bindings are exact:

- A node expression (the default binding, or a chain of child accesses from it) may appear only **as a marker** or **as an argument to its own module's `text`**.
- A `text` binding may appear only as the callee of such a call.
- Chains use only dot access (reserved words like `.delete` included) or string-literal bracket access. Optional chaining, parentheses, non-null assertions (`!`), type assertions, or any computed index make the reference non-static, which is a build error. Names are read exactly as spelled, so a segment written with a Unicode escape (`.login`) never matches.
- Everything else is a build error ("unsupported node usage"): aliasing a node into a variable, destructuring, storing nodes in data structures, passing them to other functions, re-exporting them. This is what guarantees the graph is complete: every reference is visible in the source, rooted at an import.

Scoping is respected:

- An identifier that resolves to a local declaration shadowing the import is not a spec reference.
- A type-only binding used at the value level is your TypeScript error, not an xspec edge.
- If the same scope also declares the import's name in some other way (another import, a `const`, a function, a class, a parameter), the name no longer identifies one binding. That's an `invalid-import` finding, and references through that name don't resolve.
- Purely type-level references (`typeof AUTH.auth.login` and the like) are unrestricted and record nothing. As a corollary, `xspec rename`/`move` don't rewrite them.

### Module branding

Node types are branded per module. Passing a node from one spec module to another module's `text` is a TypeScript type error, a `cross-module-text` finding, *and* a runtime throw whose message names both modules by their source paths. When one file uses several spec modules, alias the `text` imports:

```ts
import AUTH, { text as authText } from "../specs/AUTH.xspec"
import BILLING, { text as billingText } from "../specs/BILLING.xspec"
```

## Code locations: how references are attributed

Graph edges from code are attributed to a **code location**: either the whole file (`src/auth.ts`) or a named unit within it (`src/auth.ts#LoginService.validate`).

Named units are constructs that statically bind a plain identifier to executable code:

- function declarations and class declarations, decorated or not;
- class members with plain identifier names: constructors (`src/auth.ts#LoginService.constructor`), methods, getters and setters, and properties initialized with a function, arrow function, or class expression;
- `const`, `let`, `var`, `using`, and `await using` bindings with a plain identifier name whose initializer is a function, arrow function, or class expression;
- namespaces: `namespace A.B` (or the legacy `module A.B`) yields the units `A` and `A.B`;
- default exports of a function (arrow functions included) or a class, whether a declaration or an expression; the unit is `#default` when it's anonymous.

These are *not* named units:

- anonymous or immediately invoked functions;
- computed, string, numeric, or private (`#x`) member names, and names spelled with escape sequences;
- destructuring bindings;
- a default export of anything else (an object literal, an identifier, a call);
- an initializer or default export wrapped in parentheses, `as`, `satisfies`, or `!`;
- declarations without executable code: overload signatures, abstract or body-less members, `declare` declarations, and everything in a declaration file (`.d.ts`). A function implementation after its overload signatures is therefore `path#f`, not `path#f@2`.

A reference is attributed to the innermost enclosing named unit, or to the file when none encloses it. When the same unit chain occurs more than once in a file (a getter and setter pair, the same name in sibling scopes), later occurrences are disambiguated as `path#unit@2`, `@3`, and so on, in document order.

Each code location also has a **source range**: the construct that binds its name (decorators included, a leading `export` excluded), or the whole file for a file location. Ranges appear in [`xspec occurrences`](machine-interface.md#references-xspec-occurrences) records and in review payloads. This identity is what you see in `coverage` paths, `impact` reports, `query` results, and review items.

## Compiler and runtime setup

Generated modules work under standard TypeScript tooling with **no xspec runtime dependency**. `NAME.xspec.ts` contains the runtime itself, and your own compilation turns it into `NAME.xspec.js` wherever it writes its output. Its companions are type-only:

- `NAME.xspec.impl.d.ts` carries the node types and hover documentation;
- `NAME.xspec.impl.d.ts.map` maps go-to-definition back into the `.mdx`.

A verified minimal setup, a CommonJS-mode project (no `"type": "module"` in `package.json`):

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true
  },
  "include": ["src", "test"]
}
```

```sh
tsc -p tsconfig.json   # typechecks references, emits JS beside the sources
node src/print.js      # runs under plain Node: no loader, no dependency
```

Notes from the trenches:

- **The generated modules join your program through your imports.** You don't need to list them in `include`. `tsc` emits `NAME.xspec.js` for every one your code imports, and since the module has no runtime companion to carry along, compiling into an `outDir` works as well as compiling in place.
- **Extensionless specifiers and ESM.** `./NAME.xspec` resolves in CommonJS-mode files (the setup above) and under `moduleResolution: "bundler"`. In a `"type": "module"` package, Node's ESM rules make extensionless relative specifiers unresolvable, so in that case consume spec modules from CommonJS-mode files or through a bundler.
- **Markers are expression statements on purpose.** If your lint setup flags unused expressions, allow it for spec references; that's the feature.
