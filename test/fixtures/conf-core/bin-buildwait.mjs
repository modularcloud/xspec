#!/usr/bin/env node
// VIOL-CORE-BUILDWAIT violator executable (CERTIFICATIONS.md
// §VIOL-CORE-BUILDWAIT). The CONF-CORE conformer with exactly one
// behavioral deviation: `build` waits out other runs' exclusivity — once it
// has loaded its configuration and discovered its sources, where a mutating
// command acquires (SPEC 13.5), and while a directory, never a symbolic link
// to one, occupies the lock path `.xspec/lock`, it lists the lock directory,
// and while that holds an entry of another run alive on this machine — a
// plain file whose name records an identifier its own process list lists,
// judged as acquisition judges one — it waits, listing again at a polling
// interval, and proceeds as the conformer does once none stands; anything
// else at the lock path, nothing there, and a listing the environment
// refuses hold it back from nothing. One clause of 13.5 (every command but
// the mutating ones may run concurrently with them) is broken for `build`
// alone: it adds no entry, removes nothing, writes nothing at the lock path,
// and is refused by nothing, and once it proceeds its outputs, writes, and
// exit are the conformer's; the read commands are unchanged. Certifies
// T13.5-4 (C-1): exactly it fails against this fixture (the `build` it runs
// during a `rename`'s hold finds the holder's entry alive and waits, never
// exiting while the hold stands, so the arm, awaiting that exit before it
// lifts the hold, fails by its hang detection); every other §CONF-CORE
// in-scope test passes.
import { runXspec } from "./product.mjs";

const code = await runXspec(process.argv.slice(2), process.cwd(), {
  buildWaitsForHolders: true,
});
process.exit(code);
