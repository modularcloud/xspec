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
- No programmatic interface beyond `defineConfig`. The new module surface specifies that one export: no command, graph, or configuration-loading API, and no named configuration type.
- The parked follow-up in issue #8 (TypeScript type errors for requirement paths naming members of TypeScript's global `Object` interface) stays separate.

## Proposed `SPEC.md` changes

The following describes the behavior `SPEC.md` is to define, at the rigor `SPEC.md` requires. Exact wording and placement are settled in spec refinement.

### 1. Any module specifier

The declarative form of 7 keeps its import constrained exactly as now: one import declaration binding `defineConfig`, optionally aliased, with no `type` or `defer` modifier and no import attributes. The one change is that its module specifier may be any string literal TypeScript's grammar admits in that position (14.20).

- xspec never interprets, resolves, or loads the specifier, and reads nothing on its account. Neither a configuration's validity nor any command's outcome depends on the specifier's spelling or on what, if anything, it designates.
- Every spelling is therefore accepted alike: a bare or scoped package name, a relative or absolute path, a URL, the empty string, either quote style, and spellings carrying escape sequences, line continuations, or U+FFFD. None of them is a value this specification reads (2.4). A specifier designating nothing, an unreadable path, a workspace file (the configuration file itself included), or a network location is accepted equally, and xspec makes no read and no network access for it.
- The rule holds wherever a configuration is read, a baseline's configuration (6.3) included.

### 2. The product's module

The interface listed in `SPEC.md`'s opening gains one surface: the product's own module, which exports `defineConfig`.

- **Reach.** No literal package or distribution name names the module. It is the module a project reaches through whatever name the project installed the product under: installing the product under any name makes a module specifier spelling that name resolve to the module under TypeScript's resolution of installed dependencies, with no network access and nothing beyond the product's own installation. No name is privileged.
- **Type contract.** Under TypeScript at release 5.9.3 (the release 14.20 names), with `strict` checking:
  - A configuration file valid under 7 whose import names the product's module through that name type-checks with no errors. This holds for every spelling 7 permits: an aliased binding, string-literal keys, comments, and any group name, including one that spells a member of TypeScript's global `Object` interface or `__proto__`.
  - For a file in 7's declarative form whose import names the product's module, each violation of 7's key-and-value shape that a static type can express is a type error in the file, its location and message unpinned. These violations are an unknown key (7) at any level; a missing required key, meaning `specs`, `markdown`'s `emit`, and the keys 7.4 and 7.5 mark required for a profile and a rule; and a value of a kind 7 does not admit in its position. That last class covers a boolean, string, list, or object where 7 gives the position another kind, and a string outside the values 7 enumerates for its position (`targets`, `boundaryKind`, `mode`, `type`, a selector's `kind`, an element of `edgeKinds` or `kinds`).
  - Rules a static type cannot express stay xspec's own configuration errors (14.14), with no type-level requirement either way. They include glob validity and globs outside the root; cross-references between names (a profile's `target` and `boundary`, a selector's `group`, a kind that is required because a name is ambiguous); and the name and character rules (empty, duplicate, and U+FFFD-bearing names, `outDir`'s form). A key repeated within one object literal, the capture rules, and a file matched by both a spec and a code group belong to this class too.
- **Runtime.** `defineConfig` returns its argument unchanged: the very value passed, neither copied nor modified.
- **xspec unchanged.** xspec still never executes or resolves the configuration, so no command's outcome depends on the module or on whether a project installed it.
- **Testability.** `SPEC.md` states the module's reach so that the contract is blackbox-testable offline. A test can make the product's module resolvable under a name of its choosing in a scratch project, run the TypeScript compiler over configuration files importing that name, and load the module to observe `defineConfig`'s result. The seam is ordinary installation, so it adds no tester-only option and no security exposure.
- **Settled in refinement**, together with the contract's wording and placement:
  - the compiler settings the guarantee spans beyond `strict`: which module-resolution modes that resolve installed dependencies by name, and whether a configuration compiled or loaded as CommonJS is covered beside one compiled or loaded as an ES module;
  - whether two rules a type can express join the shape violations or stay with the rules that carry no type-level requirement: a selector's single form (exactly one of `group`, `files`, and `tags`, with `kind` only beside `group`) and the empty-list rules.

### 3. No package or distribution name

No rule or example of `SPEC.md` names a package or distribution. The example in 7 keeps an import line, which the declarative form requires, with a specifier that names none; its spelling is settled in refinement. `SPEC.md` states the accepted form on its own terms, with no reference to a previously required specifier.

## Interactions and compatibility

- **Strict relaxation.** Every configuration valid today stays valid with identical results, one importing from `"xspec"` included. The only configurations whose outcome changes are those that conform in every respect but their specifier, an escape spelling of `xspec` (read as spelled, 2.4) among them. Each moves from configuration error (14.14) to valid, and a baseline whose configuration is such a file now reconstructs (6.3).
- **Configuration file as a code source.** A code group that discovers the configuration file treats it as a TypeScript source like any other (4) and analyzes its import declaration as it does any code source's. A specifier ending in `.xspec`, or a relative one designating a derived-file path, is therefore that source's invalid-import finding (14.15), while the configuration itself stays valid. The configuration's import binds `defineConfig` itself, never a spec module's default or `text` export, so no workspace passing `build`'s validations holds such an import, and no rewrite of 6 applies to the configuration file.
- **Generated modules.** They still carry no xspec runtime dependency (13.1). The product's module serves the configuration alone.
- **Nothing else.** Beyond the module surface of change 2, no command gains a read, write, network access, or durable state. Determinism, JSON output, and the exit-code partition are unaffected beyond the relaxation. The machine-interface version (12.6) stays, since no JSON document form changes.

## Documentation (outside `SPEC.md`)

Per `DEVOPS.md`'s Docs rule, the release commit updates `docs/` and `README.md` for this change and meets the documentation goal recorded above. The configuration import is shown under the name the product is distributed as, and its type support is stated on `SPEC.md`'s authority. The alias install step is removed, and no instruction leads users to install or run the unrelated package that holds the bare name.
