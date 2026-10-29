# Review — specs/SPEC.md — applying IP 0002 (any configuration import specifier; the `defineConfig` module), iteration 2

## Critical
- [C1] **7.6, Covered setups, "Program".** The bullet now presents the program's content as a consequence of its conditions: "TypeScript includes no `@types` package automatically, so nothing enters the program but TypeScript's libraries for the option set and what that file's import brings in". Under the initialized-project options that consequence is false.
  - `jsx` `react-jsx` makes TypeScript 5.9.3 add an implicit import of `react/jsx-runtime` to every module file, whether or not it holds JSX. The bullet admits a package installed at `node_modules/react` ("Other packages … may be installed"). When one provides `jsx-runtime`, its files enter the program for `.ts`, `.tsx`, and `.mts` covered files alike. This was checked on a scratch 5.9.3 install.
  - So the bullet no longer settles whether such a program is a covered setup. Read as written, every stated condition holds, so it is covered, and there the type contract cannot be implemented:
    - A file brought in this way can augment the module. With `declare module "N" { export const extra: 1; }` in it, the module as TypeScript resolves the configuration's import exports `defineConfig, extra`, and TypeScript reports nothing (also checked). That breaks "Exports".
    - Such a file can also carry errors of its own. "No error for that program, in any of its files" counts them, and nothing the product ships can prevent them.
  - The IP's Program bullet stated the content as a condition: "the program holds no other file but TypeScript's default libraries … and the package's own declaration files". The change to a consequence is therefore also unrequested drift.
  - The same route opens under the strict defaults through a `@jsxImportSource` pragma, if the covered-files exclusion of pragmas is read as limited by its rationale (O1).
  - Fix direction: make "nothing else enters the program" a condition of the covered setup again. Keep this iteration's broadening, so whatever the configuration file's import brings in (files of any kind, and the libraries they reference) still counts as part of the program.

## Important
*none*

## Optional
- [O1] **7.6, Covered files, second bullet.** The rationale "each of which suppresses errors or raises its own" does not fit every pragma the bullet has to exclude. A `/** @jsxImportSource x */` pragma does neither, yet even under the strict defaults it makes TypeScript 5.9.3 add `x/jsx-runtime` to the program (checked). The clause can be read as narrowing which pragmas are excluded. Either say that every comment TypeScript reads as a directive or pragma is excluded, whatever its effect, or extend the rationale to pragmas that change what enters the program.
- [O2] **7, the declarative-form sentence.** The note on the example's `"<installed-name>"` sits inside the normative MUST sentence, between the import clause and the default-export clause. It would read better as its own sentence after the example. The rule, "any static string literal (2.4)", is complete without it.
- [O3] **Outside this target: IMPLEMENTATION.md, Distribution.** "One npm package, `xspec`" reads as naming the product's package by the bare registry name. The IP's motivation says that name belongs to an unrelated package, and the Developer's recorded goal installs `@modularcloud/xspec`. SPEC.md rightly names no package. This is flagged only so the IMPLEMENTATION.md wording can be routed before implementation takes `xspec` as the manifest name.

## Open questions
*none*
