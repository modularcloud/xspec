#!/usr/bin/env node
// VIOL-CORE-LATEHOLD violator executable (CERTIFICATIONS.md
// §VIOL-CORE-LATEHOLD). The CONF-CORE conformer with exactly one behavioral
// deviation: the hold seam engages late. A mutating command acquires
// exclusivity where 13.5 places it — once configuration is loaded and
// sources discovered, before every later check — but creates its hold file
// only once the unknown and wrong-kind names and files of the usage class
// and baseline resolution (12.0, 6.3) have passed, its second discovery
// (13.5) preceding them, instead of immediately after acquiring. The gate
// and refresh of 13.3, the item check, the valid-workspace precondition of
// `rename`/`move` (6.4, 6.5), the operation's own validation, and every
// modification still follow the hold; acquisition's outcomes still precede
// every check, and the hold file still precedes every write. An invocation
// those checks refuse exits 2 with that usage error, having acquired and
// released but created no hold file, `--test-hold` or not; every other
// invocation holds and proceeds or is refused exactly as the conformer's
// does. Certifies T13.5-8 (C-1): exactly it fails against this fixture, on
// its four seam-ordering arms those checks refuse (`rename specs/A.mdx nope
// x`, `review create --base <unresolvable-ref> --name n`, `review create
// --coverage nope --name n`, and `move <code> specs/C.mdx`, each under
// `--test-hold`, whose wait for a hold file never created fails loud);
// every other §CONF-CORE in-scope test passes.
import { runXspec } from "./product.mjs";

const code = await runXspec(process.argv.slice(2), process.cwd(), {
  lateHold: true,
});
process.exit(code);
