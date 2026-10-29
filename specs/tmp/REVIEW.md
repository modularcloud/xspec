# Review — specs/TEST-SPEC.md — Phase 6, iteration 6: bring the harness in line with SPEC after IP 0002 (free configuration import specifier, the `defineConfig` module, 13.1's independence from it)

## Critical
*none*

## Important
*none*

## Optional
- [O1] T7-9(a), and T7-10(d)'s baseline arm: `"XSPEC"` is labelled "a single-casing arm, 12.0: no case folding", but the arm cannot discriminate case folding. Section 7 accepts every specifier spelling and never interprets it, so a product that folds the specifier's case accepts `"XSPEC"` exactly as one that does not. The only product the arm fails, one that privileges its own name without regard to case, is already failed by `"left-pad"` and by T7-9(d). The label promises a discrimination the arm cannot make, and an engineer reading it may build a case-sensitivity probe that has nothing to probe. Restate the arm as one more arbitrary bare name, or drop the label.
- [O2] H-1 / H-2 (consumer runtime), T13.1-2: H-2 executes compiled consumer programs with "nothing resolvable there by package name … H-1 verifying the precondition". But the environment H-1 verifies names only "no `NODE_PATH` and a fresh `HOME`". A `NODE_OPTIONS` preload, an `--import`/`--require` hook, a loader, or a user condition inherited from the harness's own environment (a test runner's or a developer's shell) can make a package resolvable by name. That would let a generated module's runtime dependency on the product's package, which 13.1 forbids, pass T13.1-2. T7.6-6 already rules all of these out for the module channel. Apply the same rule to consumer programs (no option, no `NODE_OPTIONS`, no module customization hook, no user condition), and include it in what H-1 verifies.
- [O3] S-3 (hang guards): S-3 says "unopened" asserts only termination, on the grounds that "SPEC.md bars reading such an occupant (7, 13.4, 13.5)". T7.6-7(e)'s FIFOs, named `xspec.config.ts` in the working directory, the importing module's directory, and `HOME`, rest on a different rule: 7.6's runtime clause (no filesystem read outside the package). The citation does not name that rule. Add 7.6 so that the module channel's "unopened" assertions have their grounding where S-3 states it.

## Open questions
- [Q1] (non-blocking) E-1 / T7.6-6 / S-10: SPEC 7.6 promises its runtime contract on every release of the Node.js 22 line and of every later line. The harness pins six releases as of 2026-10-29 and changes the list only through the change process. As a result:
  - a Node.js line that ships after that date is never exercised until a patch updates the list;
  - the end-of-life lines 23 and 25 are never sampled, although the contract covers them.

  This keeps E-5's run-to-run sameness, but the promise outruns the evidence the moment a new line ships. Should a release step (DEVOPS / Phase 11) re-derive the list by E-1's rule, so that a line that has become Current or LTS since the last setting is caught? Or should an extra job run 7.6's runtime arms against the newest available release without pinning? My tentative read: keep the pinned list, and make re-deriving it under E-1's rule a mandatory part of each release. That guards against a line that became Current shortly before the list was set being missed, keeps E-5 intact, and makes the gap at most one release cycle long.
