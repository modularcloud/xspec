# 0002 — Configuration import not tied to a package name

- **Type:** Improvement Proposal (IP)
- **Stage:** Proposed
- **Branch:** `claude/relaxed-albattani-5v6l55` (harness-designated for this session; stands in for `patch/config-import-specifier`)

## Motivation

`SPEC.md` requires the configuration file to import `defineConfig` from the module specifier `"xspec"`, which ties every project's configuration to one literal package name. The name the product is distributed under is a distribution matter, separate from the `xspec` command, and on the public package registry the bare name `xspec` belongs to an unrelated package. A project that installs the product under its distributed name must therefore alias the install so that `"xspec"` resolves, or go without editor and `tsc` type support for its configuration. An instruction to install or run the bare name fetches the unrelated package. Developer never intended the specification to name a package.

This proposal frees the import's module specifier and leaves the specification naming no package at all. Type support for the configuration is a promise the product makes, so `SPEC.md` takes it on: the product's own importable module, which exports `defineConfig`, joins the product's interface with a type contract that a test can check offline under any name it installs the product as.

Archival — Developer's words (2026-10-28), verbatim:

> yes, fix the config import

> wait, i thought you meant the docs need to update to reflect the true import name?

> yes i lets make this IP. will there be any pitfalls due to the name collision of the "xspec" package? it was actually never my intention to tie the spec to the literal package name xspec.

Archival — goals recorded at intake by Liaison on Developer's behalf (2026-10-28), verbatim:

> - With a plain `npm install --save-dev @modularcloud/xspec`, a project can write the config's import under that package's name and get editor and `tsc` type support, with no npm alias.
> - Existing config files that import `defineConfig` from `"xspec"` keep working.
> - The spec names no literal package or distribution name for this. How it states which import is accepted is for the spec work to settle.
> - `docs/` and `README.md` are updated alongside. The alias install step goes, and nothing leads users to `npm install xspec` or `npx xspec`, which fetch an unrelated package owned by another maintainer.

## Non-goals

- The `xspec` command name does not change.
- No other configuration change. The file's name and location, `--config`, the encoding rules, the `defineConfig` binding and its aliasing, the excluded `type` and `defer` modifiers and import attributes, the default export's single call with its statically literal argument, and every key, value, and error rule of 7 and 14.14 stay as they are.
- No programmatic interface beyond `defineConfig`. The new module exports exactly that one binding (change 2): no command, graph, or configuration-loading API, and no named configuration type.
- The three accepted residuals parked in issue #8 stay outside this patch, its release included: the syntax-failure location gaps of 14.20, the gap of 6.5 for TypeScript import removals joined by automatic semicolon insertion, and the TypeScript type error of 4.1 and 14.7 for a requirement path whose last segment names a member of TypeScript's global `Object` interface.

## Proposed `SPEC.md` changes

The following describes the behavior `SPEC.md` is to define, at the rigor `SPEC.md` requires. Exact wording and placement are settled in spec refinement.

### 1. Any module specifier

The declarative form of 7 keeps its import constrained exactly as now: one import declaration binding `defineConfig`, optionally aliased, with no `type` or `defer` modifier and no import attributes. The one change is that its module specifier may be any static string literal (2.4).

- **Reading the file as configuration.** Wherever xspec reads a configuration, a baseline's configuration (6.3) included, it never interprets, resolves, or loads the specifier, and reads nothing on its account. A configuration's validity, and everything xspec derives from the configuration, are independent of what, if anything, the specifier designates, and of its spelling wherever that spelling leaves the file well-formed TypeScript (14.20).
  - Every such spelling is therefore accepted alike: a bare or scoped package name, a relative or absolute path, a URL, the empty string, either quote style, and spellings carrying escape sequences, line continuations, or U+FFFD. A spelling TypeScript's scanner rejects — an escape such as those of `"\x4"`, `"\u{110000}"`, `"\01"`, and `"\8"` — leaves the file not well-formed, a configuration error (7, 14.14).
  - A specifier designating nothing, an unreadable path, a workspace file (the configuration file itself included), or a network location is accepted equally, and xspec makes no read and no network access for it.
- **The one exception: the configuration file as a source.** Where a configured group discovers the configuration file, xspec analyzes it as it does every source it discovers (2.1, 4), its import declaration included, the specifier read as any source's (2.4).
  - For a code group, a specifier ending in `.xspec`, or a relative one designating a derived-file path (13.4), gives that source an invalid-import finding (14.15), beside any other the source carries, while the configuration itself stays valid. The finding fails `build` and `check`, turns back the gated reads (13.3), and leaves a baseline whose workspace holds it unreconstructable (6.3).
  - Likewise for a code group, while Markdown emission is enabled, a move whose destination would emit Markdown to a path the configuration file's relative specifier designates is refused (`refused-invalid-destination`, 6.5).
  - No rewrite of 6 applies to the configuration file. Its declarative form holds no reference, and its import binds `defineConfig` itself, never a spec module's default or `text` export, so wherever the file is a source, its import, when its specifier ends in `.xspec`, is invalid (14.15), and no workspace a rewrite runs on (6.4, 6.5) holds such an import.

### 2. The product's module

The interface listed in `SPEC.md`'s opening gains one surface: the product's own module, which exports exactly one binding, `defineConfig` — no other value and no type.

- **Package and installation.** The module is distributed as a package: a directory whose root holds a `package.json` manifest, the form TypeScript's and Node.js's resolution of installed dependencies read. The module is the package's root entry, the one a specifier naming the package with no subpath designates. No other module of the package carries a contract, whether a specifier with a subpath designates it or a file of the package is imported by its path. These definitions concern the module alone: they make no claim about how the `xspec` executable is provided or run.
  - Installing the package under a name `N` places it, exactly as distributed, at `node_modules/N` in its holding directory, as the directory itself or as a symbolic link to it. The holding directory is the importing file's directory or one of its ancestors, read along the file's physical path, every symbolic link among its components resolved (as 11.6 reads anchoring), and is not itself named `node_modules`: TypeScript's lookup and `require`'s skip such a directory. A copy, a symbolic-link install, and an aliased install (one whose `N` differs from the name the package's manifest gives) are therefore alike.
  - `N` is `name` or `@scope/name`, where `scope` and `name` are each a non-empty run of lowercase ASCII letters, digits, `-`, `.`, and `_` beginning with a letter or digit, the whole at most 214 characters — except a name in the `@types` scope, which TypeScript reserves for declaration packages; a name in the `@typescript` scope whose `name` begins with `lib-`, the form under which TypeScript looks up replacements for its default libraries (`@typescript/lib-es5`); and, for Node.js's resolution and the runtime contract on a given release, a name that release resolves to one of its own built-in modules (`fs`, `path`).
  - Nothing else need be installed: the module needs no other package and no `@types` declarations, and nothing outside the package but TypeScript's default libraries and the runtime's built-ins. Installation is that placement alone, with no package-manager run, install-time step, or network access.
- **Reach.** No literal package or distribution name names the module, and no name is privileged. With the package installed under `N`, a module specifier spelling exactly `N` designates the module along each tool's routes:
  - TypeScript's one route, in every covered setup (below): the covered file's import declaration, whatever module format TypeScript applies to that file.
  - Node.js's routes, on every release and in every run the runtime contract covers (below): `import` — a static import in an ES module, or a dynamic `import()` in a module of either kind — and `require` in a CommonJS module.

  The specifier does so wherever three conditions hold, each ruling out a resolution those tools make before they reach the installed package:
  - Nothing nearer. Write `S` for `N` cut before the first `.` of its last segment, or `N` itself where that segment has none (`a` for `a.js` and `a.b`), `D` for the name under which TypeScript looks up declarations for `N` (`@types/N`, or `@types/scope__name` for `@scope/name`), and `T` for `D` cut the same way.
    - In the holding directory, no entry but the placement occupies a path beginning `node_modules/S.`: no `N.js` or `N.d.ts` and, for `N` `a.js`, no `a.ts`.
    - In the importing file's directory and each ancestor nearer to it than the holding directory, no entry occupies `node_modules/N` or `node_modules/D`, or a path beginning `node_modules/S.` or `node_modules/T.`.
  - No self-reference: no `package.json` in the importing file's directory or one of its ancestors gives `N` as its `name`.
  - Physical naming: TypeScript is given the importing file by its physical path, and Node.js loads it by that path.
- **Covered setups.** The type contract holds under TypeScript at release 5.9.3 (the release 14.20 names) in each covered setup: the program below, under one of the two option sets that follow, for a covered file (below) that set covers.
  - Program: the configuration file is the one root file, in a project whose only installed package is the module's package, Reach's conditions holding, with no declarations visible but TypeScript's default libraries and the package's own. The project may be an ES-module or a CommonJS one: ES-module when the `package.json` nearest the configuration file — in its directory, or else in the nearest ancestor holding one — declares `"type": "module"`, and CommonJS otherwise, a project with no `package.json` included. TypeScript applies to the file whichever module format follows.
  - Strict defaults, covering every covered file: `strict` on; `moduleResolution` one of `node10`, `node16`, `nodenext`, and `bundler`, the modes that find installed packages; `module` at its default under `node10` and, under the other modes, at a value the mode requires — `node16`, `node18`, `node20`, or `nodenext` under `node16` and `nodenext`, and `es2015`, `es2020`, `es2022`, `esnext`, or `preserve` under `bundler`. Every other option is at its default, so `skipLibCheck` is off and the package's own declaration files count.
  - Initialized-project options, covering each covered file TypeScript compiles as an ES module (a name ending in `.mts`, or in `.ts` or `.tsx` in an ES-module project): exactly the option set release 5.9.3's `tsc --init` writes — `module` `nodenext`, `target` `esnext`, `types` `[]`, `jsx` `react-jsx`, `moduleDetection` `force`, and these ten on: `strict`, `declaration`, `declarationMap`, `sourceMap`, `verbatimModuleSyntax`, `isolatedModules`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noUncheckedSideEffectImports`, and `skipLibCheck` — with every other option at its default. A file TypeScript compiles as CommonJS is outside this set: under it, TypeScript rejects that file's import declaration whatever the module declares.
  - A file type-checks when the compiler reports no error for that program.
- **Covered files.** The type contract concerns a configuration file in 7's declarative form whose import names the module by a specifier spelling exactly `N`, whose path ends in `.ts`, `.mts`, `.cts`, or `.tsx` and is no declaration-file name (4.6's file-name rule), and which meets each of these conditions:
  - It spells no `\` outside its comments: no identifier or string literal carries an escape sequence or line continuation, so every key, value, and the specifier read the same as spelled (2.4) and as TypeScript reads them. (Otherwise keys distinct as spelled, `"ab"` and `"a\x62"`, collide for TypeScript, and a key or value invalid as spelled, `"\x73pecs"` or `mode: "\x64irect"`, conforms for it.)
  - It carries no comment TypeScript reads as a directive or pragma: a triple-slash directive (`/// <reference … />`), a comment directive in a line or block comment (`@ts-ignore`, `@ts-expect-error`), or a pragma (`@ts-nocheck`). Such comments suppress errors or raise their own.
  - It imports `defineConfig` by that identifier, never by a string-literal import name (`{ "defineConfig" as d }`, a TypeScript error under `module` `es2015` and `es2020`), and binds it to a name strict module code admits as a binding — the first of 6.5's rules for an added import's identifiers: no ECMAScript reserved word (`await`, `yield`, `enum`, and `default` among them), and none of `let`, `static`, `implements`, `interface`, `package`, `private`, `protected`, `public`, `eval`, and `arguments` — and to neither `require` nor `exports`, which TypeScript reserves in a file it compiles as CommonJS.
- **Type contract.** In every covered setup:
  - **Valid configurations.** A covered file valid under 7 type-checks with no errors. This holds for every spelling a covered file can carry: an aliased binding, string-literal keys, comments, and any group name, including one that spells a member of TypeScript's global `Object` interface or `__proto__`.
  - **Shape violations.** A covered file in 7's declarative form holding one or more violations of the type-error class does not type-check: TypeScript reports at least one error in the file, its locations and messages unpinned, possibly fewer errors than violations. The type-error class is exactly:
    - an unknown key (7) at any level;
    - a missing required key: `specs`, `markdown`'s `emit`, and the keys 7.4 and 7.5 mark required for a profile and a rule;
    - a value of a kind 7 does not admit in its position, a list's element included: a boolean, string, list, or object where 7 gives the position another kind;
    - a string outside the values 7 enumerates for its position: `targets`, `boundaryKind`, `mode`, `type`, a selector's `kind`, an element of `edgeKinds` or `kinds`;
    - a selector not in exactly one of its forms (7.5): one using more than one of `group`, `files`, and `tags`, one using none of them, or one carrying `kind` without `group`;
    - an empty list where 7.4 or 7.5 forbids one: `targetTags`, `edgeKinds`, a rule's `kinds`, or a selector's `tags`.
  - **Every other configuration error** (14.14) carries no type-level requirement either way: a covered file whose violations all lie outside the class may type-check or not. Among them:
    - cross-references between names: a profile's `target` and `boundary`, a selector's `group`, a kind required because a name is ambiguous;
    - the name and character rules: empty, duplicate, and U+FFFD-bearing names, `outDir`'s form;
    - glob validity and globs outside the root;
    - a key repeated within one object literal;
    - the capture rules;
    - a file matched by both a spec and a code group.
- **Runtime.** On every release of the Node.js 22 line and of every later line, Node.js run with no option, environment variable, or module customization hook that changes how modules are resolved or loaded — so with no user condition (`--conditions`, `-C`), no loader or customization hook (`--loader`, or one `--import` registers), and none of these through `NODE_OPTIONS` — and the module loaded through `import` or `require` as Reach describes:
  - The module's exports are exactly `defineConfig`: an `import` namespace holds that one export, and a `require` result has that one own enumerable property, symbol-keyed properties counted as well as string-keyed ones.
  - `defineConfig` returns its first argument and does nothing else: the very value passed, whatever it is, neither examined, copied, nor modified; `undefined` when called with none; any further arguments ignored.
  - Beyond the runtime's own resolution of the specifier and loading of the package's files, neither loading the module nor calling `defineConfig` has any effect: no filesystem read outside the package, no filesystem write, no network access, no output on standard output or standard error, and no change to the global object or to any other state of the process.
- **xspec unchanged.** xspec still never executes or resolves the configuration, so no command's outcome depends on the module or on whether a project installed it.

*Rationale, not carried into `SPEC.md`:* installation is defined as a placement so that the contract is blackbox-testable offline, the package installed under a name of a tester's choosing. The seam is ordinary installation, so it adds no tester-only option and no security exposure. The runtime contract covers every release of the Node.js 22 line, 22.0 included, so it rests on no behavior a later 22.x release introduced, such as `require` of an ES module, on by default only from 22.12.

### 3. No package or distribution name

No rule or example of `SPEC.md` names a package or distribution. The example in 7 keeps an import line, which the declarative form requires, with a specifier that names none; its spelling is settled in refinement. `SPEC.md` states the accepted form on its own terms, with no reference to a previously required specifier.

## Interactions and compatibility

- **Strict relaxation.** Every configuration valid today stays valid with identical results, one importing from `"xspec"` included. The only configurations whose validity changes are those that are well-formed TypeScript (14.20) and conform in every respect but their specifier, an escape spelling of `xspec` (read as spelled, 2.4) among them.
  - Each moves from configuration error (14.14) to valid, and then behaves as any valid configuration does, change 1's exception included. Where such a file is a discovered code source whose specifier ends in `.xspec`, or is a relative one designating a derived-file path, its workspace fails with that source's invalid-import finding (14.15, exit 1) in place of the configuration error (exit 2).
  - Likewise, a baseline whose configuration is such a file is no longer refused for its configuration (6.3). It reconstructs exactly when its content validates as a workspace, so not while that finding stands.
- **Generated modules.** They still carry no xspec runtime dependency (13.1). The product's module serves the configuration alone.
- **Nothing else.** No command gains a read, write, network access, or durable state, and the module has no effect of its own (change 2, Runtime). Determinism, JSON output, and the exit-code partition are unaffected beyond the relaxation. The machine-interface version (12.6) stays, since no JSON document form changes.

## Documentation (outside `SPEC.md`)

Per `DEVOPS.md`'s Docs rule, the release commit updates `docs/` and `README.md` for this change and meets the documentation goal recorded above. The configuration import is shown under the name the product is distributed as, and its type support is stated on `SPEC.md`'s authority. For a CommonJS project, where TypeScript under the initialized-project options (change 2) rejects a `.ts` configuration's import, the docs tell users to name the configuration file `.mts`, passing it with `--config` (7), or to declare `"type": "module"`. The alias install step is removed, and no instruction leads users to install or run the unrelated package that holds the bare name.
