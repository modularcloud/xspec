#!/usr/bin/env node
// VIOL-DISC-DERIVED violator executable (CERTIFICATIONS.md
// §VIOL-DISC-DERIVED). The CONF-DISC conformer with exactly one behavioral
// deviation: discovery does not apply the source exclusion of 13.4 — a path
// whose file name contains `.xspec.`, a file under `.xspec/`, or a file at
// an enabled Markdown emit destination, when matched by a spec-group or
// code-group glob, is treated as an ordinary match of its group's kind: on
// the spec side an `.mdx` name is parsed as MDX and any other name is
// reported as 14.19; on the code side it is a discovered code source whose
// content is parsed as plain TypeScript (14.20: the grammar its name
// selects) — an edgeless whole-file location where it parses (4.6), a
// condition-20 finding where it does not. So `query edges --from` no longer
// refuses such a path as one in no configured group (12.0): it answers exit
// 0 where every discovered file parses and exit 1 at the gate of 13.3 where
// one does not or a spec-side 14.19 shares the workspace; and in T7-6's
// invalid-source arm the code glob's match at the invalid source's emit
// destination `specs/a'b.md` enters the code set, `check` reporting its
// condition-20 finding beside the condition-19 one. A single deviation: one
// rule of 13.4 (derived files are never sources) dropped, consumed at
// product.mjs's one exclusion filter that both group kinds pass through.
// Everything else is the conformer's: glob semantics, the dot-segment rule,
// link behavior, 14.19 for non-`.mdx` matches, the parse of a discovered
// source (14.20), the gate of 13.3, and the import and empty-map rules.
// Certifies T7-6 (C-1): exactly it fails against this fixture — on its
// exclusion arms, spec-group and code-group sides alike — while every other
// §CONF-DISC in-scope test passes.
import { runXspec } from "./product.mjs";

const code = await runXspec(process.argv.slice(2), process.cwd(), {
  noDerivedExclusion: true,
});
process.exit(code);
