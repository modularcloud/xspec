#!/usr/bin/env node
// VIOL-CORE-EARLYREFRESH violator executable (CERTIFICATIONS.md
// §VIOL-CORE-EARLYREFRESH). The CONF-CORE conformer with exactly one
// behavioral deviation: the 13.3 refresh a mutating `review` subcommand
// performs on a stale workspace (T10.1-1) runs before workspace exclusivity
// is acquired, so stale graph data is rewritten before the hold file is
// created — one ordering rule of 13.5 (the hold precedes every modification,
// the refresh included) broken for the refresh alone; the hold file is still
// created after exclusivity and before every other write, and a workspace
// whose graph data is current is refreshed by nothing. Certifies T13.5-1
// (C-1): exactly that test fails against this fixture, on its stale-workspace
// arm's while-held compare; every other §CONF-CORE in-scope test passes.
import { runXspec } from "./product.mjs";

const code = await runXspec(process.argv.slice(2), process.cwd(), {
  refreshBeforeExclusivity: true,
});
process.exit(code);
