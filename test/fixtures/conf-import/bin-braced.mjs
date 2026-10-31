#!/usr/bin/env node
// VIOL-IMPORT-BRACED violator executable (CERTIFICATIONS.md
// §VIOL-IMPORT-BRACED). The CONF-IMPORT conformer with exactly one
// behavioral deviation: the braced form of the Unicode escape sequence (a
// backslash, `u`, and a code point's hex digits in braces) is not recognized
// in the configuration's import specifier where its code point is at or
// below U+FFFF, leading zeros and surrogates included — a specifier spelling
// one is judged not well-formed TypeScript (14.20), so its configuration is
// a configuration error (14.14), every command exiting 2 with the 12.7
// configuration-error document concerning `xspec.config.ts`. A braced escape
// begins where the grammar 14.20 fixes begins one — at a backslash that
// itself begins an escape sequence and is followed by `u{` — never at a
// backslash a preceding backslash escapes, after which `u{…}` is ordinary
// characters, read as the conformer reads them. A single deviation: one
// escape form of the grammar 14.20 fixes dropped, for the specifier and
// those code points alone, consumed at product.mjs's one hook
// (`specifierRefusal`); a braced escape above U+FFFF, the four-digit form,
// every other escape sequence, line continuations, either quote style, and
// every other spelling are the conformer's. Certifies P-19 (C-1): exactly it
// fails against this fixture, on each draw whose specifier spells such an
// escape — the §CONF-IMPORT in-scope set has no other test.
import { runXspec } from "./product.mjs";

const code = await runXspec(process.argv.slice(2), process.cwd(), {
  refuseBracedEscapes: true,
});
process.exit(code);
