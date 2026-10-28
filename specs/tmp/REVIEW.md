# Review — specs/SPEC.md — apply accepted IP 0002 (configuration import not tied to a package name)

## Critical

- [C1] IP 0002 change 1 (any module specifier) is not implemented. §7, paragraph "The configuration is declarative…", still requires "an import of `defineConfig` from the module specifier `"xspec"`". SPEC.md defines none of the following:
  - the reading-as-configuration rule (change 1, first bullet and its two sub-bullets). Wherever xspec reads a configuration, a baseline's (6.3) included, it never interprets, resolves, or loads the specifier, and it makes no read and no network access on the specifier's account. Validity and every derived result are independent of what the specifier designates, and of any spelling that leaves the file well-formed;
  - the rule's exception for a configuration file that a configured group discovers (change 1, second bullet);
  - "xspec unchanged" (change 2, last bullet): xspec never executes the configuration or resolves its import, so no command's outcome depends on the product's module or on whether a project installed it. §7 now says only "data, not executed code".

  Three integration points are left to refinement:
  - Limit "never interprets" to reading the file as configuration, and say outright that reading it so applies none of §4's or §14.15's TypeScript rules. Both sections phrase those rules for "a TypeScript file", and on its face that includes the configuration file. §4 makes an import declaration "a spec module import exactly when its specifier ends in `.xspec`" that "MUST designate a discovered spec source", and it adds the derived-file-path rule. If change 1 lands without that statement, an undiscovered configuration importing from `"./a.xspec"` would read as valid under change 1 and as a breach of 4 and 14.15. Those rules reach the configuration file only where a code group discovers it.
  - The exception's consequences already follow, once the exception is stated, from 4, 6.3, 6.5, 12.1, 13.3 and 14.15. These are: the 14.15 finding beside the source's other findings while the configuration stays valid; its effect on `build`, `check`, the gated reads and baselines; the `refused-invalid-destination` case, which 6.5 already words as "designated by the relative specifier of a code source's module-linking form"; and the absence of any rewrite of 6. State the rule and point to those sections rather than restating them (MUST NOT be verbose).
  - A spelling that TypeScript's scanner rejects (`"\x4"`, `"\01"`) is already not well-formed under 14.20's scanner-acceptance definition. Cite 14.20; no new rule is needed.

- [C2] IP 0002 change 2 (the product's module) is not implemented.
  - The opening's interface list ("The complete interface to xspec consists of: …") does not include the product's own module.
  - No section defines the module's surface or contract: it exports exactly one binding, `defineConfig`, with no other value and no type, and the IP specifies Package and installation, Reach, Covered setups, Covered files, Type contract and Runtime. SPEC.md must carry each of these at the IP's rigor, with I1's correction to "Program".
  - All of this is consumer-facing contract, so it belongs in SPEC.md itself and not in a module (PROCESS, SPEC.md: "MUST define the full interface or contract … in SPEC.md itself").
  - Carry none of the IP's rationale: offline testability, a tester's choice of name, and why Node.js 22.0 is covered all stay out, because SPEC.md defines no testing strategy.
  - Carry `N`'s form exactly as the IP states it. The Phase 3 O2 note (recorded in 10a37f7's body) concerns the names `node_modules` and `@s/node_modules`. Under those names Node.js ignores the package's `type` field, so where module-syntax detection is off a `"type": "module"` package's `.js` entry loads as CommonJS. This needs no SPEC change. The runtime contract can still be met under those names by an entry whose module format does not depend on `type`, and excluding the names would narrow the accepted contract.

- [C3] IP 0002 change 3 (no package or distribution name) is not implemented. §7's example (`import { defineConfig } from "xspec"`) and its declarative-form rule both name the package `xspec`, which on the public registry is an unrelated package (IP, Motivation). No rule or example may name a package or distribution.
  - The example keeps its import line, which the declarative form requires, but with a specifier that names no package. It must still be a valid configuration, which any static string literal now gives. It should read as the name under which the product's module is installed, without being a real name such as `xspec` or the distributed name.
  - State the accepted form on its own terms. Do not write "any specifier, not only `"xspec"`", "still" or "the one change", and take nothing from the IP's Interactions section, such as the relaxation or existing configurations staying valid. PROCESS, SPEC.md: MUST NOT reference prior versions of itself and MUST NOT carry migration details.

## Important

- [I1] Change 2 → Covered setups → "Program", as it is to land. Coverage is defined by what the program ends up containing, which the product's own package controls, so the type contract can exempt itself. Its key term is also ambiguous.
  - The program may hold "no other file but TypeScript's default libraries … and the package's own declaration files". Two things the package itself can do break that:
    - a `types` entry that resolves to a `.ts` source puts that source in the program under `node10` and `nodenext`, and it is not a declaration file;
    - a `/// <reference lib="es2015" />` in the package's declarations adds `lib.es2015*.d.ts`, which is outside the libraries of the strict defaults' default target.

    Either one takes every such setup out of coverage. A package with broken types plus one such line would then meet the contract vacuously, and no violator fixture could be certified against it. The Phase 3 probes with TypeScript 5.9.3, recorded as O1 in 10a37f7's body, confirm both cases.
  - "TypeScript's default libraries" has two readings. It can mean the libraries the option set selects, or any library file TypeScript ships, all of which TypeScript's compiler API reports as default-library files. The term recurs in "Nothing else need be installed". The two readings cover different setups, and Phase 6 should not have to choose between them.
  - The fix is to define the exclusion by what the setup itself contributes. The configuration file is the sole root and no type package is included automatically, so nothing enters the program except TypeScript's libraries for the option set and whatever the configuration file's import brings in. Everything the package brings in then stays inside coverage and counts toward "type-checks", whether files of any kind or libraries its declarations reference.
  - Keep "none replaced by an installed package" for every TypeScript library in the program, including those the package references. An installed `@typescript/lib-es2015` replacing what such a reference pulls in is still a setup-side exclusion.
  - This serves the IP's own intent ("nothing outside the package but TypeScript's default libraries"), so it is within refinement's latitude and not drift.

## Optional

- [O1] Give the new surface a name that cannot be read as a spec module or a generated module, and use it in every cross-reference. The IP calls it "the product's module" and, within its bullets, "the module". SPEC.md already uses "module" for spec modules, generated modules, module-linking forms and "the imported module itself" (2.2, 4, 4.5, 14.15). The cross-references in question are the opening, §7, and 13.1's "no xspec runtime dependency".
- [O2] §2.1: "xspec source files import nothing from xspec". Now that the product has an importable module and SPEC.md names no package, "from xspec" reads like a `"xspec"` specifier. Either say what is meant (nothing from the product's module; `<S>`, `<Spec>` and `text` are compiler-provided) or drop "from xspec".
- [O3] Change 2 → Type contract → "Every other configuration error" lists "glob validity" beside "globs outside the root" and "the capture rules". Neither 7 nor 14.14 defines any other glob-validity condition. Carry only conditions that 14.14 defines, so Phase 6 does not go looking for a class that does not exist.
- [O4] Bundle note, outside the target: IMPLEMENTATION.md § Distribution still reads "One npm package, `xspec`, providing … the `defineConfig` export that `xspec.config.ts` imports". The IP's Motivation says the bare name `xspec` belongs to an unrelated registry package, and the Developer's recorded goal installs `@modularcloud/xspec`. Nothing in SPEC.md changes; flag it for whichever phase maintains IMPLEMENTATION.md, so that Phase 10 is not misled about the package's name.

## Open questions

*none*
