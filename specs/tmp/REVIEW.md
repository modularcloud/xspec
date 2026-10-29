# Review — specs/SPEC.md — Phase 4, iteration 4: applying accepted IP 0002 (configuration import not tied to a package name)

## Critical
*none*

## Important
*none*

## Optional
- [O1] Outside this target. These concern IMPLEMENTATION.md, Product → Distribution and Product → Language and runtime, for whichever pass maintains that file; SPEC.md needs no change. (a) "One npm package, `xspec`" makes the bare registry name the product's distribution. IP 0002's motivation says that name belongs to an unrelated package, and its documentation goal says nothing should lead users to install it. (b) "ES modules throughout" reads as ruling out a CommonJS entry. SPEC 7.6's Runtime needs one: `require` of the module must work with no option on every Node.js 22 release, including 22.0–22.11, where `require` of an ES module is not on by default. IMPLEMENTATION.md's preamble lets the spec win, so neither point blocks this target, but both would mislead a Phase 10 Engineer.

## Open questions
*none*
