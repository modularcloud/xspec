#!/usr/bin/env node
// VIOL-CORE-STALELOCK violator executable (CERTIFICATIONS.md
// §VIOL-CORE-STALELOCK). The CONF-CORE conformer with exactly one behavioral
// deviation: abnormal termination does not end exclusivity. Any entry in the
// lock directory `.xspec/lock` — a plain file named in the conformer's entry
// form — refuses acquisition as a live run's entry does (14.26,
// `workspace-busy`), its presence alone judged, whatever identifier its name
// records, so once a mutating command's process is killed every later
// mutating command in that workspace is refused while the dead run's entry
// stands. SPEC 13.5's liveness judgment alone is dropped: release on every
// normal end, and the removal of every leftover that is no entry, are
// unchanged. Certifies T13.5-3 (C-1): exactly it fails against this fixture;
// every other §CONF-CORE in-scope test passes.
import { runXspec } from "./product.mjs";

const code = await runXspec(process.argv.slice(2), process.cwd(), {
  staleLockBlocks: true,
});
process.exit(code);
