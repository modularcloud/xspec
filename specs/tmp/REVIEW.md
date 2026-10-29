# Review — specs/CERTIFICATIONS.md — bring certifications in line with IP 0002's revised SPEC.md and TEST-SPEC.md (Phase 7, iteration 3)

## Critical
*none*

## Important
*none*

## Optional
- [O1] Exclusions, **T7-9 and T7-10**: the sentence "These four ride CONF-IMPORT's certification representatively, insofar as they share the machinery that brings P-19's draws … to the product as spelled", and CONF-IMPORT's closing line ("T7-9's fixed escape-spelled, single-quoted, and raw-U+FFFD arms ride this certification"). For the corruptions this same bullet names, the condition is unlikely to hold. P-19's draws are put together at run time by its generator. T7-9(a)'s four spellings are declared text, and two of the named corruptions act only on declared text, before any step P-19's path shares with it:
  - a literal in the harness's own source can decode the hexadecimal escape, or swallow the line continuation, before the arm ever reaches the builder. S-2 then faithfully writes the bytes it was given, already decoded.
  - a formatter run over a configuration kept as a fixture file rewrites `'xspec'` as `"xspec"`. The formatter IMPLEMENTATION.md adopts (Coding style) prefers double quotes at its default configuration.

  No P-19 draw passes through either step, so VIOL-IMPORT-BRACED and VIOL-IMPORT-SINGLE never meet these corruptions. Elsewhere in the document, each "insofar as" (the notes of VIOL-CORE-CHATTYREADS, VIOL-CORE-READERENTRY, and VIOL-ORPHAN-LINKTARGET) names machinery a harness naturally shares. Here the non-shared case is the likely one, and the text leaves it implicit. State it outright: an arm staged by a path P-19's draws do not take goes unreached, a residual this document accepts. Reword CONF-IMPORT's closing line to match, so that Phase 9 cannot take the four arms as certified when their staging differs.
- [O2] VIOL-IMPORT-SINGLE, **Expected failures**: in "every other draw, and each twin, importing from the double-quoted `"xspec"`, loads and answers as against the conformer", the participle grammatically applies to both subjects. As written, it says every other draw imports from `"xspec"`. Something like "every double-quoted draw, whatever its text, and each twin, importing from the double-quoted `"xspec"`, loads …" reads as intended.
- [O3] VIOL-IMPORT-BRACED and VIOL-IMPORT-SINGLE, **Expected failures**: "concerning `xspec.config.ts`". SPEC 14 reports a configuration error's concerned path in 11.6's anchoring form, relative to the invocation working directory. The preamble lets an in-scope test run from any working directory H-2 allows, and P-19 does not pin one. From a subdirectory, the document therefore concerns `../xspec.config.ts`. The failure still materializes on the exit code. "Concerning the configuration file, in the anchoring form of 14" states the expectation exactly without pinning a choice TEST-SPEC.md leaves open.

## Open questions
- [Q1] (non-blocking) IP 0002's headline promise (SPEC 7: wherever xspec reads a configuration, it never interprets, resolves, loads, or reads through the import's specifier, whatever the spelling) has no red-green check on the arms written to test it.
  - Exclusions exclude T7-9 and T7-10 and accept that the read traps of T7-9(c), T7-9(d), and T7-10(d) can be misplaced. These are the FIFOs, the refused files, and the trap package. Placed anywhere but the path the specifier designates, each passes exactly the products it targets.
  - T7-9(a)'s four fixed spellings are covered only through P-19 (see O1).
  - Per the bullet, closing this inside this document takes a conformer serving T7-9 whole: CONF-IMPORT's four commands, plus `view`, `review list`, and `rename`, the rejecting side for T7-9(b)'s four escapes, and a package directory for T7-9(d)'s third name.
  - A cheaper route lies outside this document: a TEST-SPEC.md self-test that runs a stand-in reader against those stagings, as S-10 does for 7.6's observations.

  Tentative read: accept the residuals for this patch. A product that never resolves the specifier meets none of these stagings. One that resolves it and fails on what it finds already fails loudly on T7-9(c)'s `./nowhere.js` arm. The residual matters only for a product that reads through the specifier and silently tolerates the failure. The choice still sets how far the harness's evidence for the patch's main behavior can be trusted, so it should be yours.
