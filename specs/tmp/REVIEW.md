# Review — specs/TEST-SPEC.md — align TEST-SPEC.md with SPEC.md as revised by IP 0002 (the free configuration import specifier and 7.6's `defineConfig` module), iteration 2

## Critical

- [C1] §7, T7-10: the spec-group half of 7's "configuration file as a source" clause has no test. SPEC 7 says: "The rules of 4 and 14.15 reach the configuration file only where a configured group discovers it: xspec then analyzes it as it does every source it discovers (2.1, 4), its import declaration included, … while the configuration itself stays valid." T7-10(b) has the file discovered only through code globs (`*.ts`, `xspec.config.ts`). No arm anywhere lets a spec glob match the configuration file, so the 2.1 side is never exercised. A product that never takes the configuration file for a spec source, or that answers 14.14 when a spec group matches it, passes the suite. Stage each of these beside its undiscovered twin:
  - (i) A spec group whose globs also match `xspec.config.ts`. That makes it a spec-group file without the `.mdx` extension. Expect 14.19 concerning it at `build` and `check` (exit 1), never 14.14 or exit 2. `inventory` exits 0 and lists it among that group's sources with `module` and `markdown` `null` (13.1, 11.6).
  - (ii) A configuration named `xspec.config.mdx`, given through `--config` and matched by a spec glob. It is judged as plain TypeScript (14.20), as T7-1's `.mts`/`.cts`/`.tsx` arms are. It is then analyzed as a spec source, its import declaration included. Expect exit 1 with 14.15 for that import (2.1: a named binding and a non-relative specifier), never 14.14.

  This violates PROCESS.md: TEST-SPEC.md MUST fully test all requirements in SPEC.md.

## Important

- [I1] §7, T7-9(d): the install arms stage the trap package and the FIFO `package.json` only under the unprivileged name `trap`.
  - SPEC 7 makes validity and every outcome independent of what the specifier designates and of how it is spelled, and 7.6's Reach privileges no name.
  - A product could still resolve, read, or load the import only when it spells the product's own name, for example to check an install, a version, or the `defineConfig` export. Such a product passes every arm, because each T7-9 and P-19 spelling of that name (`'xspec'`, `"\x78spec"`, `"XSPEC"`) designates nothing.
  - Fix: also stage (d)'s trap and FIFO-manifest arms under two more names: the `name` the module channel's package manifest gives (read as T7.6-4(a) reads it), and `xspec`, the executable's name. Each must answer as its twin without `node_modules` does.
  - Run them on T7-8's representative command set, a mutating `rename` among them, not only on the four read-and-validate commands.

- [I2] §7, T7-10: 6.5's side of "only where a configured group discovers it" is staged only as a refusal, in (c)'s `"./specs/B.md"` arm. No arm checks that a file move leaves an undiscovered configuration alone.
  - Proposed arm: the configuration imports `{ defineConfig }` from `"./specs/A.xspec"`, which is valid per (a). Then `move specs/A.mdx specs/B.mdx` exits 0, its `--preview` lists no edit in `xspec.config.ts`, the file is byte-identical afterwards, and it still loads.
  - Without this arm, a product that counts the configuration's import among "the paths by which other files import the moved file's generated module" (6.5) passes every current arm.

- [I3] §7.6, T7.6-2: the valid side pins keys and fields but not values.
  - (a) carries one profile and one value for each enumerated field; only `type` appears with both of its values.
  - No arm stages `emit: false`, `coverage: []`, `policy: []`, or `code: {}`, all of which are valid under 7.
  - So a `defineConfig` type with any of these faults passes every deterministic arm:
    - it is missing an admitted value: `mode: "transitive"`, `targets: "all"`, `boundaryKind: "spec"`, a selector's `kind: "code"`, or one edge kind in `edgeKinds` or `kinds`;
    - it types `emit` as `true`;
    - it demands non-empty `coverage`/`policy` lists, misapplying the bar 7.4 and 7.5 set for `targetTags`, `edgeKinds`, `kinds`, and `tags`.
  - Only P-18's draws might reach these faults, and section 16 says properties search the space beside their anchors; they do not replace them.
  - Fix: stage each value 7 enumerates, at each of its positions, and each empty form 7 admits, in a valid covered file judged in every covered setup.

- [I4] §7.6, T7.6-3: the out-of-enumeration arms for an element of `edgeKinds` and of a rule's `kinds` use near misses (`"depend"`), but never `"contains"`. `"contains"` is the edge kind 5.2 defines and 7.4/7.5 leave out, and it is the discriminating value T7.4-1 and T7.5-1 stage at runtime. A `defineConfig` type built on an all-kinds edge type accepts `edgeKinds: ["contains"]` and passes every T7.6-3 arm. Add `"contains"` at both positions.

- [I5] §7.6, T7.6-7(a), with S-10: the standard-error oracle is narrower than 7.6's exception.
  - 7.6 exempts the runtime's own resolution of the specifier and loading of the package's files from "no effect". The arm itself counts the release's `require(esm)` warning as "its own loading".
  - Yet the arm admits only what one of S-10's two minimal stand-ins prints.
  - Any other warning the release prints while resolving or loading a conforming package therefore fails the arm, although 7.6 permits it. Examples are Node.js's runtime deprecations for manifest shapes: DEP0128 (an invalid `main` beside an `index.js`) and DEP0151 (the ES-module `main` lookup). This adds a requirement.
  - Fix, either of:
    - take the expected output from what the release prints for the product package's own manifest and layout, for instance a stand-in copy with only its modules' code replaced;
    - admit the release's own resolution and loading output in some other way, and record whatever stays unobservable.

- [I6] §18, E-1: 7.6's runtime contract holds "on every release of the Node.js 22 line and of every later line". E-1's rule samples only the lines still supported when the list is set, and excludes 23 and 25 outright. So two lines the SPEC covers get no sampled release at all. They would be provisioned at setup like the others, and no test downloads a runtime. Add the final release of each end-of-life line after 22, and make the rule keep doing so for later lines.

## Optional

- [O1] §7.6 Placement rule, T7.6-4(c), P-17: 7.6 excludes a name the release resolves to a built-in module (`fs`, `path`) only for Node.js's resolution and the runtime contract. The Placement rule accordingly bars such names on runtime arms only. But every T7.6-4 placement and every P-17 draw also runs T7.6-6, so no type-checking arm ever stages `N` = `fs`. A type-checking-only placement under such a name would cover the boundary: T7.6-1, plus T7.6-2(a) with its paired arm.

- [O2] §7.6, T7.6-7(b), (c): only the unstageable remainder of the read and network clauses is recorded. Two other remainders are neither observed nor recorded:
  - the write clause beyond the staging, working directory, `HOME`, and `TMPDIR`;
  - the state clause beyond the listed observations, for example the extensibility and `[[Prototype]]` of the global object and of the built-in prototypes, which `Object.preventExtensions` or `Object.setPrototypeOf` change without altering any descriptor.

  Observe what is cheap to observe, and record the rest as T6.5-6 records its unstageable clauses.

- [O3] §17, S-4: S-4 is meant to detect each `module` value of 7.6's matrix "wherever release 5.9.3 gives a setting's value an effect of its own". No listed probe separates `node16` from `node18`: both reject the ES-module-only stand-in from a CommonJS file, and both imply the same target. Import attributes would separate them, since they are rejected under `node16` and admitted under `node18`.

- [O4] §13.1, T13.1-2: "a consumer project with only standard TypeScript tooling installed" sits beside "nothing resolvable from the consumer's location by package name". Read literally, installing `typescript` in the project breaks the second phrase. Say that the tooling is the harness's own, run against the project, with nothing installed in or above it (H-1).

## Open questions

- [Q1] (blocking) Does TypeScript 5.9.3 accept a valid `.cts` configuration's `import { defineConfig } from "N"` under `moduleResolution` `bundler` with `module` `preserve`?
  - As I recall, TypeScript reports TS1293 ("ESM syntax is not allowed in a CommonJS module when 'module' is set to 'preserve'") for any ESM import in a file it emits as CommonJS, and a `.cts` file is such a file.
  - If so, no package can satisfy SPEC 7.6's strict defaults there. That is three of the 173 programs, one per project.
  - T7.6-2, every paired T7.6-3 arm, T7.6-4, T7.6-5, and any P-17/P-18 draw of that setup would then fail against every product, conformers included.
  - 7.6 already places CommonJS-compiled files outside the initialized-project set because of a similar rejection.
  - Tentative read: verify against 5.9.3 before the harness is built. If confirmed, SPEC 7.6 should likewise place files TypeScript compiles as CommonJS outside the `preserve` leg, which is a spec change, and the matrix drops to 170 programs.

- [Q2] (non-blocking) What CI cost is acceptable for 7.6's type-level matrix?
  - "Every type-checking arm runs in every covered setup" sends each of the following through all 173 programs: T7.6-3's single-violation files (well over a hundred), T7.6-2's files, and T7.6-4/T7.6-5's reruns.
  - That is tens of thousands of whole-program type-checks per run. Under the strict defaults `skipLibCheck` is off, so each one also checks TypeScript's own libraries.
  - That is plausibly many CPU-hours per run, so CI would have to shard heavily.
  - Tentative read: keep the matrix whole, since it is exactly what 7.6 promises, and accept the sharding. A cheaper design would judge most shape violations in one setup per distinct resolved declaration file and module format, but the TEST-SPEC would then have to state why those setups are equivalent.
