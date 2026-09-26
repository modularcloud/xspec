#!/usr/bin/env node
// VIOL-CORE-LATELOCK violator executable (CERTIFICATIONS.md
// §VIOL-CORE-LATELOCK). The CONF-CORE conformer with exactly one behavioral
// deviation: workspace exclusivity is acquired late — a mutating command
// acquires it, and creates its hold file, only once the argument checks of
// SPEC 12.0 and baseline resolution (6.3) have passed, instead of before
// them (13.5) — the two checks 12.0 places ahead of source validation, and
// the only ones this deviation moves. The gate and refresh of 13.3, the
// valid-workspace precondition of `rename`/`move` (6.4, 6.5), the
// operation's own validation, and every modification still follow
// acquisition and the hold; a second mutating command is still refused on
// acquisition — now after those two checks. An invocation an argument check
// or baseline resolution refuses exits 2 with that usage error at once,
// having acquired nothing and created no hold file, `--test-hold` or not;
// every invocation passing both checks — the gate's and the precondition's
// refusals included — acquires, holds, and proceeds or is refused exactly as
// the conformer's does. Certifies T13.5-8 (C-1): exactly it fails against
// this fixture, on its two seam-ordering arms refused ahead of the gate
// (`rename specs/A.mdx nope x` and `review create --base <ref> --name n`
// under `--test-hold`); every other §CONF-CORE in-scope test passes.
import { runXspec } from "./product.mjs";

const code = await runXspec(process.argv.slice(2), process.cwd(), {
  lateAcquisition: true,
});
process.exit(code);
