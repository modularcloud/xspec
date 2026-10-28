# Review — specs/patches/0002-config-import-specifier.md — Phase 3, refinement iteration 6 of IP 0002's first refinement

## Critical
*none*

## Important
*none*

## Optional
- [O1] Change 2, Covered setups → Program. The product partly controls the clause "the program holds no other file but TypeScript's default libraries … and the package's own declaration files". Two examples:
  - a package whose types entry is a `.ts` source;
  - declarations that pull in a library that is not a default for the target, such as `/// <reference lib="es2015" />` under the strict defaults' ES5 target.

  Either puts other files into every program. No setup is then covered, so for that product the whole type contract (Exports, Valid configurations, Shape violations) is vacuously met instead of failing. A covered-setup precondition should constrain only the tester's environment. Suggested fix: phrase the clause over what the setup adds. For example: "no file but the configuration file, TypeScript's default libraries (none replaced by an installed package), and the files the package itself brings in". Alternatively, have "Nothing else need be installed" also require that the package bring in nothing outside itself but those libraries.
- [O2] Change 2, Package and installation. `N`'s grammar admits `node_modules` and `@scope/node_modules`, names that npm's naming rules reject. When the package directory itself is named `node_modules`, Node.js's package-scope lookup stops before reading the package's own `package.json`.
  - Probed on Node.js 22.22 with `--no-experimental-detect-module`, which reproduces 22.0–22.6 behaviour: a `"type": "module"` package loads under an npm-valid name but fails under `node_modules`.
  - So the runtime contract forces extension-typed entry files (`.mjs`/`.cjs`) just to serve a name no user can install under.
  - Consider excluding `node_modules` as `name`, as npm does.

## Open questions
- [Q1] (non-blocking) CommonJS projects and the default file name (change 2, Initialized-project options; Documentation section).
  - Under the option set TypeScript 5.9.3's `tsc --init` writes, a CommonJS project's `xspec.config.ts` cannot type-check whatever the module declares. TypeScript reports TS1295 on its import and on its export (confirmed with 5.9.3).
  - That generated tsconfig includes every `.ts` file, so the project's whole `tsc` run fails.
  - A project made with `npm init` and `tsc --init` is in exactly this state.
  - The IP's remedy is documentation only: rename the file to `.mts` and pass `--config` on every command, or convert the project to ES modules.
  - Intake goal 1 asks for type support after a plain install. The non-goals keep the file name and the upward search as they are.

  Should the upward search also find `xspec.config.mts`? Tentative read: keep this IP as scoped and take `.mts` discovery as its own seed if wanted. The documented workaround stands meanwhile.
- [Q2] (non-blocking) Which TypeScript releases the type contract covers (change 2, Covered setups).
  - The type contract holds under TypeScript 5.9.3 alone. The runtime contract, by contrast, covers every Node.js release from 22.0 on, future lines included.
  - Intake goal 1 asks for editor and `tsc` type support without naming a release. Users on later TypeScript releases (the 6.x line, the native 7.x line) would get no promise from `SPEC.md`.

  Should the contract also name later TypeScript releases? That costs a wider test matrix and commits the product against compiler defaults and checks not yet known. Tentative read: keep the 5.9.3 pin, which matches 14.20 and stays testable, and let the docs state wider support informally.
