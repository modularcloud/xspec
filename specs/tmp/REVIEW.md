# Review — specs/TEST-SPEC.md — bring the harness spec in line with SPEC.md as IP 0002 left it (any configuration import specifier; the `defineConfig` module, 7.6; 13.1's widened no-dependency rule)

## Critical

- [C1] **SPEC 7.6 is entirely untested** (PROCESS, TEST-SPEC.md: "MUST fully test all requirements in SPEC.md"). No test, harness rule, or self-test mentions the `defineConfig` module, its installation, Reach, the covered setups, the type contract, or the runtime contract. Section 7 of this document ends at T7.5-6, so the intro's one-to-one mirror of sections 1–15 has no 7.6. H-7's map gains a key for the new numbered subsection 7.6 that no test maps to, so S-1 fails as the document stands. Coverage must include at least the following.
  - **(a) Package and installation.**
    - Install forms: install under `N` as a copy, as a symbolic link to the package directory, and as an aliased install (`N` differing from the manifest's `name`). All three must behave alike.
    - Holding directory: the importing file's own directory, and separately a strict ancestor. Both are read along the physical path: the importing file is reached through a symlinked directory, the package sits at the physical ancestor, and TypeScript and Node.js are given the file by that physical path.
    - `N` across its grammar: unscoped and scoped names; a digit-first name; names with `-`, `_`, and `.` (`a.js` and `a.b`, where `S` differs from `N`); and names at the 214-character bound in both forms.
    - Placement alone: nothing else installed (no other package, no `@types`, no package-manager run). Then again with other packages installed beside it, `typescript` among them.
  - **(b) Reach.**
    - Routes: TypeScript's one route in every covered setup. Each Node.js route: static `import` from an ES module, dynamic `import()` from an ES module and from a CommonJS module, and `require` from a CommonJS module.
    - Stage only setups where all four conditions hold, including the cases those conditions leave open: an ancestor `package.json` with an unrelated `name`, one with `type` `"module"`, one with `type` `"commonjs"`, and other `node_modules` entries.
    - Assert nothing where a condition fails; an assertion there would be requirement drift.
  - **(c) Covered setups.**
    - Option sets: TypeScript 5.9.3 under exactly 7.6's option sets:
      - `node10`, with `module` at its default;
      - `node16` and `nodenext`, each with `node16`, `node18`, `node20`, and `nodenext`;
      - `bundler` with `es2015`, `es2020`, `es2022`, `esnext`, and `preserve`;
      - the `tsc --init` set, for files compiled as ES modules only.
    - Every other option stays at its default. So `target` is 5.9.3's default (ES5, with its default library) and `skipLibCheck` is off under the strict defaults. These are not H-2's two consumer configurations, which set `target` ESNext.
    - Projects: an ES-module project (the nearest manifest has `type` `"module"`), and CommonJS projects (a manifest without `type`, and no manifest at all).
    - Covered files named with each of `.ts`, `.mts`, `.cts`, and `.tsx`. The configuration file is the program's only root file.
    - The matrix is finite. A reviewer probe of one valid file over all of it built 173 programs. Either run the matrix whole, or fix a sample and justify it the way H-2 justifies its two configurations for 13.1.
  - **(d) Covered-file spellings the Valid-configurations bullet names.**
    - An aliased binding, bound only to names strict module code admits and never to `require` or `exports`.
    - String-literal keys, and comments anywhere.
    - Every optional key and field of 7 present.
    - Group names that are members of TypeScript's global `Object` interface (`constructor`, `toString`, `valueOf`, `hasOwnProperty`, `isPrototypeOf`, `propertyIsEnumerable`, `toLocaleString`), and `__proto__`, each as an identifier key and as a string-literal key.
  - **(e) Type contract.**
    - Exports: exactly one declared export, `defineConfig`, a value with no type or namespace meaning.
      - Check it under each setup's own resolution, because the declaration file TypeScript resolves differs by mode and format.
      - Do not count TypeScript's synthetic default. A default import that type-checks in a CommonJS-compiled file is no violation; a declared default export is one.
    - Valid configurations type-check, under the verdict defined in I1.
    - Shape violations: one arm per member of the type-error class:
      - an unknown key at the top level, in `markdown`, in a profile, in a rule, and in a selector;
      - each missing required key: `specs`, `markdown`'s `emit`, a profile's `name`/`target`/`boundary`/`mode`, and a rule's `name`/`type`/`from`/`to`;
      - each wrong-kind position, list elements included;
      - a string outside the allowed values at each enumerated position;
      - each selector-form violation, `kind` without `group` included;
      - each forbidden empty list.
    - Each shape-violation arm fails to type-check with at least one error in the configuration file. Locations, messages, and error counts stay unpinned. Include an arm that holds several violations at once.
    - Assert no type-level outcome, either way, for configuration errors outside the class.
  - **(f) Runtime.**
    - Releases: sampled releases of the Node.js 22 line and of later lines (Q1). Include a release in 22.0–22.11, where `require` of an ES module is unavailable without a flag.
    - Run each release with no option, environment variable (`NODE_OPTIONS` among them), condition, or hook that changes resolution or loading.
    - Exactly one export:
      - An `import` namespace's own keys are exactly `defineConfig`. This fails, for example, a CommonJS-only entry whose namespace carries `default`.
      - A `require` result's own enumerable keys, symbol keys included, are exactly `defineConfig`. This fails an enumerable `__esModule`.
    - Identity: `defineConfig(v) === v` for objects, arrays, functions, symbols, `null`, and other primitives. A call with no argument returns `undefined`, and further arguments are ignored.
    - The argument is neither examined, copied, nor modified. Stage a Proxy first argument and a Proxy second argument whose every trap records, plus a frozen object.
    - No effect beyond the runtime's own resolution and loading:
      - nothing on stdout or stderr (Q2);
      - no filesystem write, checked by a snapshot of the staging directory, the working directory, and a fresh `HOME` and `TMPDIR`;
      - no change to the global object or other observable process state, with the observed set enumerated: global own properties and their descriptors, built-in prototypes, `process.env`, the working directory, `process.exitCode`, process listeners, and no handle keeping the process alive;
      - no network access: loads run network-denied, as E-1 runs product invocations;
      - no filesystem read outside the package.
    - Each of these clauses is either tested, or recorded with its reason where no blackbox staging exists, as T6.5-6 records its unstageable clauses (Q3).

- [C2] **T7-2 and T12.0-6 enforce a requirement SPEC.md no longer has.**
  - T7-2 asserts 14.14 for an "import from a specifier other than `"xspec"` — `"XSPEC"` among them". T12.0-6 lists "the configuration's `"xspec"` specifier (T7-2's `"XSPEC"`)" among the case-sensitive name tests SPEC applies.
  - SPEC 7 now admits a specifier that "is any static string literal (2.4)". It makes validity "independent of … its spelling", so 7 applies no name test to that specifier.
  - A conforming product exits 0 on both arms and fails them. This adds a product requirement, which PROCESS forbids: "MUST NOT add or remove product requirements".
  - Fix: withdraw the arm and the T12.0-6 entry, and replace them with C3's acceptance arms.

- [C3] **SPEC 7's new paragraph on the configuration's import is untested.** The paragraph covers four things: the import is never executed, interpreted, resolved, or loaded; validity is independent of what the specifier designates and how it is spelled; escapes the scanner rejects are 14.14; and analysis applies only where a group discovers the file. Required arms:
  - **Spelling independence.** Each of the following loads, with `inventory`'s `configuration` byte-identical to the `"xspec"` twin's, and `build` and `check` exiting 0 with outputs and derived files byte-identical to the twin's:
    - bare names, `"XSPEC"` and an arbitrary one;
    - a scoped name;
    - a relative path and an absolute path;
    - a URL;
    - `""`;
    - a single-quoted specifier;
    - an escape sequence (`"\x78spec"`);
    - a line continuation;
    - a raw U+FFFD. This one fails a product that applies 7's no-U+FFFD rule for names to every literal.
  - **Scanner-rejected escapes.** `"\x4"`, `"\u{110000}"`, `"\01"`, and `"\8"` are not well-formed TypeScript, so each is 14.14 with exit 2. S-9 must classify each as rejected. A reviewer probe confirms that 5.9.3's scanner reports each (1125, 1198, 1487, 1488) and accepts the other spellings above.
  - **Designation independence; no read, resolution, load, or execution.** Each case behaves exactly as the twin:
    - the specifier designates nothing;
    - it designates an unreadable file (T14-10's discipline);
    - it designates a FIFO, which is never opened (S-3's guard);
    - it designates a directory;
    - it designates the configuration file itself (`"./xspec.config"` and `"./xspec.config.ts"`);
    - it is a URL, under denied network.
    - Booby-trapped installs, compared with a twin holding no `node_modules`: at `node_modules/<specifier>`, a package whose entry writes a marker file, prints, and exits non-zero if loaded; and separately one whose `package.json` is a FIFO. Outcomes must be identical to the twin's, with no marker and no hang. This is 7's "No command's outcome … depends … on whether a project installed it", and it discriminates executing, loading, or resolving the import.
  - **Undiscovered configuration.** The rules of 4 and 14.15 do not reach it.
    - Specifiers ending `.xspec` (`"./specs/A.xspec"`, `"./missing.xspec"`) are valid: `build` and `check` exit 0, with no 14.15.
    - Specifiers designating a derived path are valid too: `"./specs/A.xspec.ts"`, `"./.xspec/x"`, and an emit destination while emission is enabled.
  - **Discovered configuration.** Here a code group globs `*.ts` or names `xspec.config.ts`.
    - The same specifiers are 14.15 at `build` and `check` (exit 1). The reason varies: a `.xspec` specifier designating no source, a named binding (`defineConfig`) other than `text` from a spec module, or a derived-path designation.
    - The configuration itself stays valid: never exit 2. `inventory` answers finding-free and lists the file as a code source.
    - With `"xspec"`, the run is clean and the file's whole-file location exists (`query edges --from xspec.config.ts`, exit 0).
    - The consequences 7 names, each as an arm:
      - 6.5: a file move whose destination's emit path the discovered configuration's relative specifier designates is refused with `refused-invalid-destination`, while the undiscovered twin moves.
      - 13.3: the gated reads exit 1 with the 14.15 finding.
      - 12.1: the failing `build` modifies nothing.
      - 6.3: a baseline whose configuration is discovered with such an import fails as T6.3-4's plain usage error.
  - **Baselines.** 7 says "a baseline's (6.3) included".
    - A commit whose configuration imports from a different specifier (`""`, `"./nowhere"`, `"XSPEC"`) resolves normally, and `impact --base` reports as usual.
    - A baseline configuration spelling a scanner-rejected escape fails as T6.3-4's code-less usage error.

- [C4] **The harness contract shuts out the new surface.**
  - The intro's surface list omits the `defineConfig` module. SPEC's preamble now names it part of the complete interface.
  - H-2's "No other channel into the product exists — … importing product code … is not a permitted channel" forbids the only route by which 7.6 can be tested.
  - C-2's runner "takes an executable/workspace binding and nothing else". So no fixture can supply its own module, and certification cannot reach a 7.6 test.
  - H-2 must define a module channel. The product's package directory, as distributed, is installed under a name the test chooses. It is reached only by a specifier spelling exactly `N`; a subpath, or a package file named by its path, carries no contract (7.6) and is never a channel. It is type-checked under 7.6's covered setups and loaded under the sampled Node.js releases. The channel presumes nothing about how the executable is provided (7.6: "These definitions concern the module alone").
  - C-2's binding must also carry that package directory. The intro and H-2 must list the surface.

## Important

- [I1] **The type-check verdict for 7.6 must include declaration diagnostics.**
  - 7.6: "A file type-checks when the compiler reports no error for that program, in any of its files." The initialized-project set turns `declaration` on, and declaration-emit errors arrive only as declaration diagnostics.
  - Probe at 5.9.3: a package returns a type it does not export (`interface Config …; export declare function defineConfig(c: Config): Config; export {}`). Under that set, `export default defineConfig({…})` draws TS4082 ("Default export of the module has or is using private name 'Config'"). `tsc` reports it, with and without `--noEmit`, while the syntactic, semantic, global, and options diagnostics are all empty.
  - H-2's verdict was written for the consumer configurations, which emit no declarations. The document must define 7.6's verdict as every error the compiler reports for the program under the option set, declaration diagnostics included. Otherwise the trap that 7.6's "no type" export rule sets for a naive package passes vacuously.
  - A second trap, from the same probe: a declaration module without `export {}` exports every top-level declaration, a non-`export`ed interface included. The exports assertion must therefore read the module's declared exports from TypeScript's own resolution, never probe chosen names.

- [I2] **H-1's self-containment must reach 7.6's stagings.**
  - TypeScript's automatic `@types` inclusion, Reach's nothing-nearer, self-reference, and well-formed-manifest conditions, and the ES-module/CommonJS project kind all read directories above the staging root.
  - A staging under the repository, whose own manifest and `node_modules/@types` lie above it, falls outside the covered setups. An `@types` package enters the program, and an `N` equal to an ancestor manifest's `name` is a self-reference.
  - H-1's verified preconditions (no ancestor `xspec.config.ts`, no enclosing working tree) must extend to the ancestor `node_modules` and `package.json` entries 7.6 reads, verified under the environment the tools run in. An unmet precondition is a harness error, never a pass.

- [I3] **H-2 and T13.1-2 under-state 13.1's widened rule.**
  - H-2 has "no package named `xspec` installed or resolvable", and T13.1-2 has "no xspec runtime dependency".
  - 13.1 now reads "no runtime dependency on xspec, its `defineConfig` module (7.6) included", and 7.6 privileges no name.
  - The discriminating environment is one in which no copy of the product's package is resolvable under any name from the consumer's location. State that, and verify it as I2 does.

- [I4] **T7.5-1 has no arm for a selector carrying `kind` without `group`.**
  - Missing cases: `{ files: "src/*.ts", kind: "code" }`, `{ tags: ["a"], kind: "spec" }`, and `{ kind: "spec" }`, each 14.14.
  - 7.5 admits exactly three selector forms and gives `kind` to the group form alone. 7.6's type-error class now names this violation explicitly.
  - A product that vets `kind` only beside `group` passes every current arm.

- [I5] **Configured names that are `Object` members or `__proto__` are untested at the CLI.** 7 bars only empty and U+FFFD-bearing names. Arms:
  - Spec and code groups named `__proto__` (as an identifier key and as a string-literal key) and `constructor`, and a profile and a rule named `toString`. Each loads, discovers its files, and is reported by `inventory`.
  - A profile's `target` or `boundary`, and a selector's `group`, naming `__proto__` or `constructor`. Each resolves when that group is configured, and is an unknown group (14.14) when it is not.
  - `coverage constructor` with no such profile is the usage error.
  - Each arm fails a product that looks names up in a plain object. 7.6 now names these spellings explicitly at the type level.

- [I6] **T7-2 lacks the verbatim-reading arms 7.6 cites.** 7.6's covered-files bullet cites these as xspec's reading under 2.4 and 7, but T7-2 stages only a glob escape and a group-name escape. Missing arms:
  - Key `"\x73pecs"`, read as spelled: an unknown key beside a missing `specs`, so 14.14.
  - `mode: "\x64irect"`: 14.14.
  - `specs: { "ab": […], "a\x62": […] }`: two distinct groups, no repeated-key error, both reported by `inventory`.
  - A product that decodes escapes accepts the first two and refuses the third.

- [I7] **T7-2 does not stage the binding forms of "exactly an import of `defineConfig` (optionally aliased …)".** It covers modifiers and attributes only. Missing arms:
  - A string-literal import name, `import { "defineConfig" as d } from "…"` with `export default d({…})`, loads. 5.9.3 parses it, and 7.6's covered-files bullet excludes it from the type contract, which presupposes it is in 7's declarative form.
  - Its escape-spelled twin `{ "define\x43onfig" as d }`, read verbatim (2.4), names no `defineConfig`, so 14.14.
  - A default import (`import defineConfig from "…"`): 14.14.
  - A namespace import called as `X.defineConfig({…})`: 14.14.
  - An extra default binding (`import d, { defineConfig } from "…"`): 14.14.
  - An extra named binding (`{ defineConfig, other }`): 14.14.

- [I8] **Section 16 has no properties for the new input spaces.** PROCESS says SHOULD; the deterministic arms only sample spaces this large and structured:
  - `N` drawn from 7.6's grammar (scopes, dots, digit-first, lengths up to 214), crossed with install form and with Node.js route;
  - random valid configurations from 7's grammar (key order, identifier versus string-literal keys, comments, arbitrary group names including `Object` members), which must type-check across the covered setups;
  - random single violations of the type-error class, which must not type-check;
  - random well-formed specifier spellings, whose configuration view must equal the canonical twin's.

- [I9] **The new harness machinery needs self-checks that certification cannot fully make.**
  - **(a) TypeScript driver.** S-4 detects only H-2's two configurations. 7.6's setups must each be detected in effect:
    - each `moduleResolution`/`module` pair;
    - the `tsc --init` set's distinguishing options (`verbatimModuleSyntax`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `skipLibCheck`, `types: []`);
    - the module format each project kind and extension implies;
    - the verdict's collection of declaration diagnostics (I1).
  - **(b) Node.js release driver.** Each sampled release must be verified as the one in effect, run with no resolution-altering option or environment, and each route verified as the one exercised. A driver that silently serves one release or one route for all of them makes the 22.0–22.11 `require` arm vacuous.

- [I10] **Red-green (H-8, S-7) does not reach 7.6.**
  - S-7's stub product has no package, so the sweep must stub that binding too.
  - 7.6's negative assertions pass vacuously when the module is absent:
    - a configuration whose import cannot resolve "does not type-check";
    - a load that throws "prints nothing" and "changes no global".
  - Pair each negative arm with its positive twin in the same setup: the valid file type-checks; the load succeeds and `defineConfig` returns its argument. Then each such test fails red against a missing or stub package and cannot pass vacuously against a permissive one, such as `any`-typed declarations.

## Optional

- [O1] **`--config` naming other configuration file names.**
  - Add `--config` arms naming a configuration file not called `xspec.config.ts`, using the covered-file names of 7.6: `.mts`, `.cts`, and `.tsx`. Each should load at the CLI; 7 takes "the path given by `--config`", any name.
  - A `.tsx`-named configuration is judged as TSX (14.20: "TSX or plain as the file name selects", applied to the configuration file by its last sentence).
  - T12.0-3 exercises only relative-path resolution.

## Open questions

- [Q1] (non-blocking) **Which Node.js releases should the suite test?**
  - 7.6's runtime contract and Reach hold "on every release of the Node.js 22 line and of every later line". The suite can only sample that, and each sampled release costs a CI provisioning step and a full pass of the runtime arms.
  - The answer sets how much of the promise the suite actually backs, including whether short-lived odd-numbered lines count.
  - Tentative read, on the Linux leg only:
    - 22.0.0, the oldest;
    - the last release without default `require` of ES modules (22.11.x);
    - the first with it (22.12.0);
    - the newest 22.x;
    - the newest release of each later even-numbered line available at CI setup.

- [Q2] (non-blocking) **Does a warning Node.js itself prints while loading the package count as forbidden stderr output?**
  - 7.6 says: "Beyond the runtime's own resolution of the specifier and loading of the package's files, … no output on … standard error". Node.js 22.12.x prints an `ExperimentalWarning` to stderr when code outside `node_modules` uses `require` to load an ES module.
  - It is unclear whether that warning is part of "the runtime's own … loading" (exempt) or output the load causes (forbidden). The answer decides whether a test may assert byte-empty stderr on that route, and whether a package whose `require` route lands on an ES-module entry there conforms.
  - Tentative read: exempt, by the text's parallel with the reads resolution makes outside the package. The stricter reading would amount to requiring a CommonJS entry for `require` on every release, which 22.0–22.11 already need. If you prefer that, the document should be told so rather than infer it.

- [Q3] (non-blocking) **How far should the suite go to enforce "no filesystem read outside the package" and "no network access" for the module?**
  - The document's stance is that no test observes a product's system calls (S-3).
  - Under that stance these two clauses can only be partly staged: denied network, plus decoy files or FIFOs at plausible paths, which catch an attempted open or a blocking read. The rest would be recorded as a residual.
  - The alternative is OS-level tracing of the loading process, which the harness launches itself.
  - Tentative read: keep the no-syscall stance, stage what decoys and denial catch, and record the rest.
