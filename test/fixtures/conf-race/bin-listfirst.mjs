#!/usr/bin/env node
// VIOL-RACE-LISTFIRST violator executable (CERTIFICATIONS.md
// §VIOL-RACE-LISTFIRST). The CONF-RACE conformer — the CONF-CORE product run
// deviation-free — with exactly one behavioral deviation: acquisition judges
// the lock directory before adding its entry. It lists the lock directory (a
// missing area or lock directory holding nothing, never a refused read), is
// refused by another live run's entry there (14.26) as the conformer is, and
// otherwise — after a sustained interval, long relative to the spread of runs
// started together yet far short of every hang guard — adds its entry,
// removes the leftovers its listing found, and acquires, never listing again.
// 13.5's order of acquisition's addition and listing alone is inverted; the
// liveness judgment, leftover removal, the hold seam, and release are
// unchanged. Certifies T13.5-13 (C-1): its held arm's runs, started together,
// each list the lock directory within the others' intervals, before any has
// added its entry, so none finds a live run's entry and each acquires and
// creates its hold file — more than one hold file standing where the arm
// asserts at most one, on every trial, on the built and the unbuilt
// workspace alike.
import { runXspec } from "../conf-core/product.mjs";

const code = await runXspec(process.argv.slice(2), process.cwd(), {
  listBeforeEntry: true,
});
process.exit(code);
