#!/usr/bin/env node
// VIOL-CORE-EARLYRELEASE violator executable (CERTIFICATIONS.md
// §VIOL-CORE-EARLYRELEASE). The CONF-CORE conformer with exactly one
// behavioral deviation: a run releases at its hold point instead of as it
// ends. A mutating command given `--test-hold` releases once its hold is
// lifted — deleting its entry, then the emptied lock directory and an
// emptied area directory its acquisition created, as release does (13.5) —
// and one without the seam straight after acquiring; it then dwells for a
// sustained interval (long relative to the time the rest of the run
// otherwise takes, short of every hang bound) and proceeds with the rest of
// the command as the conformer does, outside exclusivity, releasing nothing
// further. 13.5's release point alone is moved; acquisition, the hold file,
// every check, every write and its order, and every run's outcome are
// unchanged. Certifies T13.5-3 (C-1): exactly it fails against this fixture,
// on its past-the-hold arm (kills landing in the interval find every path
// the twin's run changes still in its prior state and `.xspec/lock` absent);
// every other §CONF-CORE in-scope test passes.
import { runXspec } from "./product.mjs";

const code = await runXspec(process.argv.slice(2), process.cwd(), {
  releaseAtHold: true,
});
process.exit(code);
