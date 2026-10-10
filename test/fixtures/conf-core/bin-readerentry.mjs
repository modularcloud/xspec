#!/usr/bin/env node
// VIOL-CORE-READERENTRY violator executable (CERTIFICATIONS.md
// §VIOL-CORE-READERENTRY). The CONF-CORE conformer with exactly one
// behavioral deviation: while a directory — never a symbolic link to one —
// occupies the lock path `.xspec/lock`, `build` and the read commands each
// add to it an entry of their own — a plain file named as a mutating run's
// entry is, recording the reader's process identifier — and leave it there
// as they end, a dead run's leftover once the reader has exited; where no
// directory occupies the lock path, they add nothing. One rule of 13.4 (no
// write but acquisition and release touches the lock path) is broken for
// `build` and the reads alone: they acquire nothing — they list no lock
// directory, judge no entry, and are refused by none — and a mutating
// command's acquisition removes a reader's entry as it removes any dead
// run's, though one meeting a reader still running refuses on its entry as
// on any live run's. Certifies T13.5-4 (C-1): exactly it fails against this
// fixture (once each read run during the hold has exited, the lock directory
// holds that read's entry beside the holder's, where the held-state
// comparison's count half asserts the holder's entry alone); every other
// §CONF-CORE in-scope test passes.
import { runXspec } from "./product.mjs";

const code = await runXspec(process.argv.slice(2), process.cwd(), {
  readersAddEntries: true,
});
process.exit(code);
