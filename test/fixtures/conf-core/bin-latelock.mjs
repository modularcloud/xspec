#!/usr/bin/env node
// VIOL-CORE-LATELOCK violator executable (CERTIFICATIONS.md
// §VIOL-CORE-LATELOCK). The CONF-CORE conformer with exactly one behavioral
// deviation: workspace exclusivity is acquired late — a mutating command
// acquires it, and creates its hold file, only once the argument checks of
// SPEC 12.0, baseline resolution (6.3), the validation gate of 13.3, and the
// valid-workspace precondition of `rename`/`move` (6.4, 6.5) have all
// passed, instead of before them (13.5). The refresh's writes, the
// operation's own validation, and every other modification still follow
// acquisition and the hold; a second mutating command is still refused on
// acquisition — now after those checks. An invocation one of those checks
// refuses exits with that outcome at once, having acquired nothing and
// created no hold file, `--test-hold` or not. Certifies T13.5-8 (C-1):
// exactly it fails against this fixture; every other §CONF-CORE in-scope
// test passes.
import { runXspec } from "./product.mjs";

const code = await runXspec(process.argv.slice(2), process.cwd(), {
  lateAcquisition: true,
});
process.exit(code);
