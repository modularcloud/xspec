# Review — specs/SPEC.md — apply IP 0002 (configuration import not tied to a package name), refinement iteration 3

## Critical
- [C1] 7.6 Reach and Covered setups (Program). Reach and Runtime promise a resolution that no implementation can deliver when the importing file's package scope holds a `package.json` that is not a well-formed JSON object. All three Reach conditions can hold in that setup. The setup also has no defined project kind under Program. This makes the requirement unimplementable as stated, and the edge case ambiguous.
  - Node.js. Suppose the importing file's nearest `package.json` is malformed (`{ "type": "module",`), empty, or a JSON array, `null`, string, or number. None of these gives a `name`, so No self-reference holds. Even so, a static `import` from an ES module, a dynamic `import()` from a CommonJS module, and `require` all fail with `ERR_INVALID_PACKAGE_CONFIG` before reaching the placement, whatever the package holds. Checked on Node.js 22.22.0, a release the Runtime bullet covers. None of these fails: a byte-order mark, a directory at that path, or a valid manifest with no `name` or with an unknown `type` value.
  - TypeScript. Program reads "ES-module when the `package.json` nearest the configuration file … declares `"type": "module"`" but does not say what a malformed manifest declares. TypeScript 5.9.3 reads one as declaring nothing. A `.ts` covered file beside `{ "type": "module",` is compiled as CommonJS, and its import is rejected under the initialized-project options (TS1295). A textual reading of "declares" would therefore make it a covered file whose valid configuration cannot type-check.
  - Fix. Add a condition beside the three, such as "Well-formed manifests: every `package.json` in the importing file's directory or one of its ancestors holds a well-formed JSON object". Node.js reads only the nearest manifest, so a condition on that one alone is enough. Program's project kind should then read `type` from that object. Reach's lead-in also needs adjusting: it says "three conditions … each ruling out a resolution those tools make before they reach the installed package", and the new condition rules out a failure, not an earlier resolution.

## Important
- [I1] 7.6 Type contract, Exports. "exports exactly `defineConfig` … and no other export, type-only or not" does not say whether it means the exports the module declares or the import forms TypeScript accepts. Under the second reading, no implementation can satisfy it.
  - TypeScript grants a synthetic default (its `esModuleInterop`/`allowSyntheticDefaultImports` interop) to a module it reads as CommonJS. Checked with a dual-format stand-in package on 5.9.3 under the strict defaults, `import d from "N"` type-checks whatever the package declares in these cases:
    - a `.cts` file under `node16`/`nodenext` resolution;
    - a `.cts` file under `bundler`;
    - a `.ts` file of a CommonJS project under `node16`/`nodenext` resolution.
  - The package cannot avoid this:
    - Under `module` `node16` and `node18`, a valid `.cts` configuration that imports ES-module-format declarations gets TS1479. The `require` route must therefore reach CommonJS-format declarations.
    - The only declaration-side way to suppress the synthetic default is a declared `__esModule` export, which is itself a second export.
  - Under the first reading, the same stand-in satisfies the bullet in every setup checked: the module's exports as TypeScript's checker lists them are exactly `defineConfig`.
  - A Phase 6 test that probes a default import would fail every product.
  - Fix: state that the exports meant are those the module declares, and that TypeScript's synthetic default for a module it reads as CommonJS is not one of them.

## Optional
- [O1] 7, the paragraph after the declarative-form rule. "No command's outcome therefore depends, through a configuration, on the `defineConfig` module or on whether a project installed it" can be read to cover the installed package's own files. Configured globs can discover those files and change outcomes, for example a `**/*.ts` code group matching `node_modules/N/…`. Writing "through a configuration's import" (or "through its specifier") states the intended scope.
- [O2] 7, the note under the example. 7.6 has the package installed under `N`, and a specifier spelling `N` designates the module. "The name under which the project installed the `defineConfig` module" would match 7.6's terms better as "the name `N` under which the project installed the package (7.6)".
- [O3] 7.6 Covered files, third bullet. It cites "the first of 6.5's rules for an added import's identifiers" and then restates that rule's word list. Keeping only the citation avoids two copies that can drift apart.
- [O4] Outside this target: `specs/IMPLEMENTATION.md`, Distribution. It still reads "One npm package, `xspec`, providing the `xspec` bin and the `defineConfig` export that `xspec.config.ts` imports". The IP's motivation and recorded goals say that bare name belongs to an unrelated maintainer and that the product is installed as `@modularcloud/xspec`. SPEC.md is unaffected, since it names no package. This is noted for whichever step maintains IMPLEMENTATION.md, so that Phase 10 does not build toward a name it cannot publish under.

## Open questions
*none*
