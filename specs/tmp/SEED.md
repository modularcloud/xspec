# Seed

Improvement requested by the Developer on 2026-10-28. Written by Liaison on the Developer's behalf.

## Work needed

The configuration file's `defineConfig` import must stop being tied to the literal module specifier `"xspec"`. The Developer never meant the spec to tie the product to a literal package name. The name the product is published under, today the npm package `@modularcloud/xspec`, is a distribution detail.

## Goals

- With a plain `npm install --save-dev @modularcloud/xspec`, a project can write the config's import under that package's name and get editor and `tsc` type support, with no npm alias.
- Existing config files that import `defineConfig` from `"xspec"` keep working.
- The spec names no literal package or distribution name for this. How it states which import is accepted is for the spec work to settle.
- `docs/` and `README.md` are updated alongside. The alias install step goes, and nothing leads users to `npm install xspec` or `npx xspec`, which fetch an unrelated package owned by another maintainer.

## Non-goals

- The `xspec` command name does not change.
- No other configuration change.
- The parked follow-up in issue #8 (TypeScript type errors for `Object`-member names) stays separate.

## Developer's words (archival, verbatim)

- "yes, fix the config import"
- "wait, i thought you meant the docs need to update to reflect the true import name?"
- "yes i lets make this IP. will there be any pitfalls due to the name collision of the "xspec" package? it was actually never my intention to tie the spec to the literal package name xspec."
