#!/usr/bin/env node
// VIOL-DISC-DERIVED violator executable (CERTIFICATIONS.md
// §VIOL-DISC-DERIVED). The CONF-DISC conformer with exactly one behavioral
// deviation: discovery does not apply the source exclusion of 13.4 — a path
// whose file name contains `.xspec.`, a file under `.xspec/`, or a file at
// an enabled Markdown emit destination, when matched by a spec-group or
// code-group glob, is treated as an ordinary match: on the spec side it
// enters the discovered spec set (a non-`.mdx` occupant then surfaces as
// 14.19); on the code side it enters the discovered code set as an edgeless
// whole-file location, as every discovered code source of the scope is, so
// `query edges --from` answers it exit 0 where the conformer refuses the
// unknown path (12.0). A single deviation: one rule of 13.4 (derived files
// are never sources) dropped, consumed at product.mjs's one exclusion
// filter that both group kinds pass through. Glob semantics, the
// dot-segment rule, link behavior, 14.19 for non-`.mdx` matches, and the
// import and empty-map rules are unchanged. Certifies T7-6 (C-1): exactly
// it fails against this fixture — on its exclusion arms, spec-group and
// code-group sides alike — while every other §CONF-DISC in-scope test
// passes.
import { runXspec } from "./product.mjs";

const code = await runXspec(process.argv.slice(2), process.cwd(), {
  noDerivedExclusion: true,
});
process.exit(code);
