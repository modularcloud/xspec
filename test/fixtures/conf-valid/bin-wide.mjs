#!/usr/bin/env node
// VIOL-VALID-WIDE violator executable (CERTIFICATIONS.md §VIOL-VALID-WIDE).
// The CONF-VALID conformer with exactly one behavioral deviation: U+00A0 and
// U+0085, exactly, are treated as whitespace for SPEC 1.4 validity — a
// segment or tag containing either is rejected with 14.4. Tag splitting
// (SPEC 2.6) and all other classifications are unchanged — U+2028 and
// U+2029 stay barred by 1.4's quote-and-escape bullet, as in the conformer,
// and split no tag. Certifies T1.4-2, T1.4-4, and P-1 (C-1): exactly they
// fail against this fixture; every other §CONF-VALID in-scope test passes.
import { runXspec } from "./product.mjs";

const code = await runXspec(process.argv.slice(2), process.cwd(), {
  widenValidityWhitespace: true,
});
process.exit(code);
