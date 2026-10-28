# Review — specs/patches/0002-config-import-specifier.md — IP 0002 newly drafted by triage; first refinement (Phase 3, iteration 1)

## Critical

- [C1] §2 "Type contract", both bullets — unimplementable for escape sequences and line continuations, so the IP fails its PROCESS.md duty to propose changes at SPEC.md's rigor. SPEC 2.4 reads every configuration literal as spelled, with no escape sequence interpreted. TypeScript reads the cooked value instead. Two failures follow:
  - (a) The first bullet ("valid ⇒ no errors"), which claims to hold "for every spelling 7 permits", fails for keys that differ as spelled but are equal once cooked. `specs: { "ab": [...], "ab": [...] }` holds two distinct, valid groups for xspec (no "key repeated", since the spellings differ). TypeScript reads both keys as `ab` and reports the repetition, which is the "TypeScript's own diagnosis of the repetition" that 7 already acknowledges.
  - (b) The second bullet ("violation ⇒ type error") fails wherever an escape spells a known key or an enumerated value. For xspec, `mode: "direct"` is outside 7.4's values; to TypeScript it is `"direct"`. Likewise `"specs"` is an unknown key, with `specs` missing, for xspec, but is `specs` to TypeScript.

  No declaration the product could ship satisfies either case. The fix is to limit both bullets to keys and string literals spelled without escape sequences or line continuations, or to literals whose TypeScript value equals their spelled value. The contract also has to say whose reading decides that an import "names the product's module through that name": TypeScript reads `"\x66oo"` as `foo`.

- [C2] §2 "Type contract", first bullet ("This holds for every spelling 7 permits: … comments") — unimplementable. Section 7 permits comments anywhere, but TypeScript acts on some comments:
  - `// @ts-ignore`, `// @ts-expect-error` and `// @ts-nocheck` suppress the shape violations the second bullet requires to be type errors.
  - A `// @ts-expect-error` with nothing to suppress is itself reported as an error.
  - A triple-slash directive, which SPEC 4 calls "a comment to the grammar", makes a valid configuration fail to type-check. Examples: `/// <reference path="./missing.d.ts" />`, `/// <reference types="missing" />`, `/// <reference no-default-lib="true" />`.

  SPEC 6.5 already names such comments as ones TypeScript acts on (`// @ts-nocheck`, `// @ts-expect-error`). The contract must exclude files carrying directive comments, or define which comments it covers.

- [C3] §2 "Type contract", first bullet ("an aliased binding") — unimplementable for aliases that TypeScript rejects in module code after parsing. Under 14.20, well-formedness is the parser's acceptance alone, with name binding and post-parse checks excluded. So `import { defineConfig as let } from "…"` with `export default let({ specs: {} })` is well-formed TypeScript in 7's declarative form, and therefore a valid configuration. TypeScript 5.9.3 still reports a strict-mode reserved-word error for it. The same holds for `static`, `yield`, `implements`, `package`, `private`, `protected` and `public`. SPEC 6.5 records this gap itself: it lists names "whose binding 14.20's derivability admits but an ECMAScript runtime and TypeScript's compiler reject in module code". The IP must do one of two things:
  - exclude such aliases from the guarantee; or
  - propose making them invalid in 7. That narrows validity, which conflicts with "Strict relaxation" and the Non-goals ("every key, value, and error rule of 7 and 14.14 stay as they are"), so the IP would have to say so.

- [C4] §1 vs "Interactions — Configuration file as a code source" — contradiction. Section 1 states that "xspec never interprets, resolves, or loads the specifier" and that "Neither a configuration's validity nor any command's outcome depends on the specifier's spelling or on what, if anything, it designates". The interactions bullet says the opposite for one case: when a code group discovers the configuration file, a specifier ending in `.xspec`, or a relative one designating a derived-file path, is a 14.15 finding. That finding:
  - fails `build` and `check`;
  - turns back every gated read (13.3);
  - makes a baseline holding such a file unreconstructable (6.3).

  One more dependency goes unmentioned. SPEC 6.5's `refused-invalid-destination` refuses a file move when the destination's Markdown emit path is designated by "the relative specifier of a code source's module-linking form", and the configuration's import qualifies. Carried into SPEC.md together, these statements contradict each other, and SPEC.md MUST NOT contain contradictions.
  
  Fix: scope §1's guarantees to xspec's reading of the file as configuration, and state the code-source analysis, including 6.5's refusal, as the exception. "Strict relaxation" also needs adjusting: for such a file, "moves from configuration error (14.14) to valid" ends in a 14.15 finding (exit 1), not a successful outcome.

## Important

- [I1] §2 "Settled in refinement" (first item), "Type contract", "Runtime" — the conditions of the guarantee are left for Phase 4 to invent. The IP defers:
  - which module-resolution modes are covered;
  - whether CommonJS configurations are covered;
  - which compiler options apply beyond `strict`. This set has to be closed, not "strict plus anything": some options reject a valid configuration whatever the module declares, such as `isolatedDeclarations` on an inferred default export, or `verbatimModuleSyntax` with ESM syntax in a CommonJS file.

  The IP also leaves unstated:
  - the program the check runs over: the file alone with only the product installed, or alongside other declarations;
  - whether "no errors" counts diagnostics in the product's own declaration files, which turns on `skipLibCheck`;
  - which configuration files are covered. `--config` can name a `.mts`, `.cts` or `.tsx` file, and the extension fixes the module format TypeScript applies.
  - which runtime "load the module" means: engine, release, and `import` versus `require`. Also whether the installed name must resolve under that runtime's own resolution too, since "Reach" names only TypeScript's.

  Each of these decides what gets built and tested, and the mission counts intent Phase 4 would have to invent as IMPORTANT at minimum. The IP should state each one (see Q1).

- [I2] §2 "Type contract" (second and third bullets) and "Settled in refinement" (second item) — the type-error class is defined by a criterion that contradicts the IP's own lists and cannot be tested. Two problems:
  - The rule "each violation … that a static type can express is a type error" sits beside a deferral conceding that two rules "a type can express" may carry no type-level requirement: a selector's single form, and the empty-list rules.
  - The no-requirement class rests on the claim that a static type "cannot express" cross-references between names. Cross-references can be expressed by inferring the declared group keys, and so can the kind an ambiguous name requires.

  The no-requirement list is also left open ("They include"), so a rule in neither list has no classification. An example is 14.14's catch-all, "otherwise invalid profile, rule, or group shapes".

  Fix:
  - define the type-error class as a closed enumeration;
  - state that every other configuration error carries no type-level requirement either way;
  - decide the two deferred rules;
  - drop the "can/cannot express" rationale, so Phase 4 does not carry it into SPEC.md as the operative rule.

- [I3] §2 "Reach" and "Testability" — "installing the product under any name" relies on an installation concept SPEC.md has never defined. The IP leaves open:
  - what the installable unit is;
  - which placements count: a copied package, a symlinked install such as pnpm or a `file:` dependency produces, or an npm-alias install;
  - whether the product's own dependencies are part of "the product's own installation";
  - whether installation itself must work offline, with no install-time download. The claim that the contract is "blackbox-testable offline" depends on this.
  - which names "any name" covers: package-name syntax and scoped names, and what happens when something else in the program claims the name first. TypeScript's resolution prefers an ambient `declare module` of that name, for instance a Node built-in module name under `@types/node`.

  Until these are defined, "the seam is ordinary installation" names no seam that Phase 4 or a test harness can derive from SPEC.md.

## Optional

- [O1] §1 — "any string literal TypeScript's grammar admits in that position (14.20)" would read better as "a static string literal (2.4)", matching 7's other literal positions. TypeScript's parser accepts a non-literal expression in the specifier position and rejects it only in a post-parse grammar check, and 14.20's derivability counts that check out. Read loosely, the qualifier therefore admits template literals and other expressions, so the string-literal requirement must stay explicit in the declarative form.
- [O2] §2 "Testability" — the bullet sits under "the behavior `SPEC.md` is to define", but its middle sentence ("A test can make … run … load …") is a test procedure, and SPEC.md MUST NOT define tests or testing strategy. Mark the bullet as rationale, so that Phase 4 carries only the seam (Reach) into SPEC.md.
- [O3] §2 "Runtime" and "Interactions — Nothing else" — the runtime contract leaves edge cases open:
  - a call with no argument or with extra arguments;
  - a call with a non-object or non-conforming value;
  - whether loading the module or calling `defineConfig` may read, write, access the network, or do anything beyond returning.

  "Beyond the module surface of change 2, no command gains a read, write, network access, or durable state" can be read as exempting the module surface. State the module's own absence of effects explicitly.
- [O4] §2 and Non-goals — say whether the module exports exactly `defineConfig` or at least `defineConfig`. A test can observe the runtime export set, and the opening of SPEC.md calls its list "the complete interface".

## Open questions

- [Q1] (non-blocking) Which TypeScript setups does the type-support promise cover?
  - What the IP leaves open (I1): it defers the module-resolution modes and CommonJS configurations, and leaves the remaining compiler options and the runtime unstated.
  - Why it matters: the answer shapes how the package is built.
    - Legacy `node10` resolution ignores a package's export map.
    - A `node16` CommonJS file cannot import an ES-module-only package.
    - `tsc` run on a lone file with no tsconfig defaults to CommonJS with `node10` resolution.
  - Tentative read: the recorded goal says "a project" without qualification, so cover:
    - every TypeScript 5.9.3 mode that resolves installed packages by name (`node10`, `node16`, `nodenext`, `bundler`);
    - both module formats;
    - the configuration compiled on its own, with default options plus `strict`, excluding options that reject valid configurations on their own;
    - runtime loading in a pinned Node.js release, through both `import` and `require`.
- [Q2] (non-blocking) How deep should configuration type support go?
  - What the IP decides:
    - unknown keys, missing required keys, and wrong kinds or values must be type errors;
    - cross-references (a profile `target` naming no declared group) and the naming rules carry no requirement;
    - the selector-form and empty-list rules are deferred;
    - the module exports no named configuration type.
  - Why it matters: each of these changes what the module must model and what gets tested.
  - Tentative read:
    - keep the IP's line;
    - add the selector-form and empty-list rules to the required errors, since they are cheap to express and useful in an editor;
    - leave cross-references unrequired;
    - export no named type.
