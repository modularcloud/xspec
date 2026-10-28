# Review — specs/patches/0002-config-import-specifier.md — Phase 3 refinement, iteration 5: frees the configuration import's specifier and specifies the product's importable module

## Critical
*none*

## Important
- [I1] Change 2, Reach, "No self-reference": the condition is not sufficient. Reach, and with it the type and runtime contracts, is promised in cases no product can meet. TypeScript 5.9.3's self-name lookup (under `node16`, `nodenext` and `bundler`) compares the nearest `package.json`'s `name` with the specifier one path component at a time and accepts it as a leading part. Node.js's CommonJS `require` self-resolution accepts any specifier that begins with `<name>/`. Both apply only when that `package.json` declares `exports`.
  - Probed with TypeScript 5.9.3 (`nodenext`, `bundler`) and Node.js 22.22.0. Each project `package.json` declared `exports`, and a decoy `.d.ts` declared no `defineConfig`.
    - A nearest `package.json` named `""` (with an `exports` entry `./xpkg`) or `"xpkg/"`: TypeScript resolved `xpkg` to the project's decoy and reported TS2305.
    - One named `"@s"`: both TypeScript and `require` resolved `@s/xpkg` to the project's own `./xpkg` export, not to the installed package.
  - None of these names is N, so all three conditions hold and the import still never reaches the placement.
  - Fix: widen the condition to every name either tool reads as N or as a leading part of it. That means N, the empty name, N's scope (`@scope` for `@scope/name`), and each of these followed by one `/`. For example, exclude any `package.json` in the importing file's directory or its ancestors that declares `exports` and gives such a name.
- [I2] Change 2, Reach, "Nothing nearer", second sub-bullet: "In the importing file's directory and each ancestor nearer to it than the holding directory" most naturally reads as always including the importing file's directory. The canonical layout puts the configuration file at the project root beside `node_modules`, so the importing file's directory is the holding directory. Read that way, the bullet then forbids any entry at `node_modules/N`, which is the placement itself.
  - Reach would then never hold in that layout, and the type and runtime contracts would cover only installs in a strict ancestor.
  - It also clashes with the first sub-bullet, which governs the holding directory and admits the placement.
  - Fix: reword so the bullet covers only the directories strictly below the holding directory, e.g. "In every directory from the importing file's own up to, but excluding, the holding directory".

## Optional
- [O1] Change 2, Covered setups, Program: "TypeScript applies to the file whichever module format follows" is false under two of the strict-default modes if "follows" means "follows from the project kind just defined". Probed with 5.9.3:
  - Under `node10`, a `.ts` file in an ES-module project is compiled as CommonJS.
  - Under `bundler` (with `module` `esnext` or `preserve`), a `.ts` file in a CommonJS project is compiled as an ES module.
  - Only under `node16`/`nodenext` does the `package.json` `type` decide.
  
  The project-kind distinction only scopes the initialized-project options, which run under `nodenext`. Drop the sentence, or say that TypeScript applies whatever format its own rules give under the option set, so that Phase 4 does not carry a false claim about TypeScript into `SPEC.md`.
- [O2] Change 2, Covered setups, Program: "a project whose only installed package is the module's package" leaves the setup the intake goal describes outside every covered setup. That setup has `typescript` installed in the same `node_modules` to run `tsc`, even though an installed `typescript` package adds nothing to the program. The clause's purposes are no stray `@types` declarations and no `@typescript/lib-*` replacement. Consider stating those directly ("no other installed package contributes declarations to the program or replaces one of TypeScript's default libraries"). The contract would then certify the project the goal describes.
- [O3] Change 2, opening: "exports exactly one binding, `defineConfig` — no other value and no type". The value half has an observation route (Runtime: the `import` namespace and the `require` result), but the type half has none: neither Reach nor the Type contract says what TypeScript must see. Tie it to the covered setups, e.g. "in every covered setup, TypeScript's view of the module's exports is exactly `defineConfig`, a value", so that Phase 4 does not have to pick the route.

## Open questions
- [Q1] (non-blocking) Consider a CommonJS project that uses TypeScript 5.9.3's own `tsc --init` options. A CommonJS project is what `npm init -y` gives when nothing sets `"type": "module"`, and `npm init -y` followed by `npx tsc --init` is a common fresh setup. In it, `xspec.config.ts` can never type-check: under `verbatimModuleSyntax`, TypeScript rejects every ES import and export in a CommonJS file (TS1295, probed), whatever the module declares.
  - The Documentation section's answer: rename the file `.mts` and pass `--config` to every command, or switch the whole project to ES modules. This is needed because the upward search finds only `xspec.config.ts`, and the Non-goals keep it that way.
  - So in that setup the intake goal ("editor and `tsc` type support" after a plain install) does not hold out of the box for the default file name.
  - Should the upward search also find `xspec.config.mts`, either in this IP or in a follow-up? It would need a rule for when both files exist.
  - Tentative read: keep this IP's scope and its documentation workaround. A small follow-up IP adding `.mts` discovery would make the goal hold out of the box, and the Developer should decide whether that matters now.
