# Review — specs/TEST-SPEC.md — bring the harness in line with SPEC.md as revised by IP 0002 (refinement iteration 5)

## Critical
*none*

## Important
- [I1] §7 T7-2 (declarative form: the "Binding forms" arms and the arm "a default export that is not one call to the (optionally aliased) binding"): no arm stages either of TypeScript's two CommonJS-interop statement forms:
  - the export assignment `export = defineConfig({…})` beside a valid `import { defineConfig } from "N"`;
  - the import-equals declaration `import defineConfig = require("N")` beside `export default defineConfig({…})`.

  Both are outside 7's form ("exactly an import of `defineConfig` … and a default export of one call to that binding"). An export assignment is not a default export. An import-equals declaration binds the module itself rather than its `defineConfig` export, which is the same reason T7-2 already rejects the default and the namespace import.

  Both forms parse under TypeScript 5.9.3 as module code and as script code, with no parse diagnostic (checked by probe), so 7's form, not a parse failure, decides them.

  The `export =` arm targets a likely product fault. TypeScript's parser represents `export = x` and `export default x` as the same node kind, `ExportAssignment`, told apart only by its `isExportEquals` flag (checked). A product that finds the default export by node kind, the obvious route for the AST-based reading IMPLEMENTATION.md describes, loads an `export =` configuration and still passes every current T7-2 arm.

  Fix: add one arm per form, each over an otherwise valid argument → 14.14, exit 2. Name both among the forms S-9 checks as well-formed, as it names T7-2's modifier-bearing imports; their TypeScript errors under ECMAScript-module targets are post-parse checks.

- [I2] §7 T7-2 ("Verbatim literals" and "Keys and enumerated values are read as spelled too (7, 2.4; the spellings 7.6's covered-file bar cites)"): every escape arm spells a *string literal* (`"\x73pecs"`, `"product"`, `"a\x62"`). No arm spells a configuration *identifier* key with an escape.

  The covered-file bar the arm cites covers identifiers as well: "no identifier or string literal carries an escape sequence or line continuation, so every key, value, and the specifier read the same as spelled (2.4) and as TypeScript reads them". So xspec reads an identifier key as spelled, which matches 2.4's and 4.6's as-spelled reading of identifiers; T2.4 and T4.6 pin that reading for chains and unit names, but nothing pins it for the configuration.

  TypeScript's parser decodes identifier escapes. For the key `specs`, the node's `escapedText` is `specs` while its source text is `specs` (checked by probe, file well-formed). A product that reads keys through the decoded name passes every current arm, because string literals and identifiers take different paths through that AST.

  Fix: add the identifier twins of the existing arms:
  - a top-level key `specs: {…}` is an unknown key, and `specs` is then missing → 14.14;
  - `specs: { ab: […], ab: […] }` declares two groups, no key repeated: it loads and `inventory` reports both;
  - a group key `product` names a group whose spelling contains `\`, so `target: "product"` is an unknown group (14.14), while `target: "product"` resolves.

  Each fails a product that decodes identifier escapes.

## Optional
- [O1] §7.6 T7.6-2(a): pin `emit: true`. T7.6-2 closes by saying a type that narrows `emit` to `true` fails here, through (f)'s `markdown: { emit: false }`. No valid file pins `true`, though: (a) gives `markdown` "with `emit` and `outDir`" and leaves the value open. Where (a) is staged with `false`, a type that narrows `emit` to `false` passes every arm.
- [O2] §7.6 T7.6-7(b), (e): (b) compares the staging, the working directory and `HOME` "entry by entry and byte by byte". In the same runs, (e) places FIFOs named `xspec.config.ts` in exactly those directories. Read literally, the comparison opens the FIFOs and the harness blocks on its own read. S-10's stand-in runs would expose this before any product exists, but one clause settles it: plain files compare by bytes, and a FIFO compares by kind and stays unopened (S-3).
- [O3] §17 S-4: the 7.6 detection list says it covers every setting to which release 5.9.3 gives an effect of its own, but it omits `strict` under the fourteen strict defaults. (Under the initialized set, `exactOptionalPropertyTypes` raises an options error without `strictNullChecks`, so `strict` is checked there indirectly.) A driver that drops `strict` from the strict defaults would pass a package whose declaration file has an implicitly typed parameter, since `skipLibCheck` is off in those sets. Add a stand-in that the strict defaults reject only through `strict`.

## Open questions
- [Q1] (non-blocking) §7 / T7-2, order of the two statements. SPEC 7 says the configuration "MUST consist of exactly an import of `defineConfig` … and a default export of one call to that binding". It does not say whether the import must come first. ECMAScript hoists imports, so `export default defineConfig({…})` followed by `import { defineConfig } from "…"` is a valid module, and TypeScript 5.9.3 parses it with no diagnostic as module and as script code (checked). No arm stages that order, so the product will settle it by default, most likely by rejecting the file.

  My tentative read: 7 fixes which statements the file holds, not their order. The reversed file should load (`inventory`'s `configuration` byte-identical to the import-first twin's), and T7-2 should pin that. If the Developer wants import-first instead, SPEC 7 should say so.
