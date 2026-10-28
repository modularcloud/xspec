#!/usr/bin/env node
// VIOL-VALID-SEP violator executable (CERTIFICATIONS.md §VIOL-VALID-SEP).
// The CONF-VALID conformer with exactly one behavioral deviation: SPEC 1.4's
// bar on U+2028 and U+2029 is not enforced — a segment or tag containing
// either is accepted as valid. One clause of 1.4's quote-and-escape bullet
// dropped: the quote, escape, and character-reference characters stay
// barred, and neither code point joins the whitespace class, so tag
// splitting (SPEC 2.6) is unchanged — a tag containing either is kept whole —
// as is every other rule and class. Certifies T1.4-1, T1.4-4, and P-1 (C-1):
// exactly they fail against this fixture; every other §CONF-VALID in-scope
// test passes.
import { runXspec } from "./product.mjs";

const code = await runXspec(process.argv.slice(2), process.cwd(), {
  acceptLineSeparators: true,
});
process.exit(code);
