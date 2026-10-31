#!/usr/bin/env node
// VIOL-IMPORT-SINGLE violator executable (CERTIFICATIONS.md
// §VIOL-IMPORT-SINGLE). The CONF-IMPORT conformer with exactly one
// behavioral deviation: a single-quoted module specifier is refused — the
// configuration's import is read only where its specifier is double-quoted,
// a configuration whose specifier is single-quoted being a configuration
// error (14.14), every command exiting 2 with the 12.7 configuration-error
// document concerning `xspec.config.ts`. A single deviation: one quote style
// of the static string literal 2.4 defines dropped, for the specifier alone,
// consumed at product.mjs's one hook (`specifierRefusal`); a double-quoted
// specifier — whatever its text, escapes, line continuations, and code
// points — and every other literal of the configuration, single-quoted globs
// included, are the conformer's. Certifies P-19 (C-1): exactly it fails
// against this fixture, on each draw whose specifier is single-quoted — the
// §CONF-IMPORT in-scope set has no other test.
import { runXspec } from "./product.mjs";

const code = await runXspec(process.argv.slice(2), process.cwd(), {
  refuseSingleQuotes: true,
});
process.exit(code);
