#!/usr/bin/env node
// VIOL-CORE-NOLOCK violator executable (CERTIFICATIONS.md §VIOL-CORE-NOLOCK).
// The CONF-CORE conformer with exactly one behavioral deviation: a live
// run's entry does not refuse acquisition. Acquisition adds its own entry and
// lists the lock directory `.xspec/lock` as SPEC 13.5 directs, but leaves
// every entry whose recorded identifier the process list lists in place,
// unaltered, removes the other leftovers, and acquires — so mutating
// commands never exclude one another, the busy refusal of 14.26 dropped.
// Entries, the hold file (still created before any modification and
// honored), leftover removal, acquisition's write and read failures, and
// release are unchanged. Certifies T13.5-2 and T13.5-8 (C-1): exactly they
// fail against this fixture; every other §CONF-CORE in-scope test passes.
import { runXspec } from "./product.mjs";

const code = await runXspec(process.argv.slice(2), process.cwd(), {
  noMutualExclusion: true,
});
process.exit(code);
