#!/usr/bin/env node
// VIOL-READERS-CLAIM violator executable (CERTIFICATIONS.md
// §VIOL-READERS-CLAIM). The CONF-READERS conformer — the CONF-CORE product
// run deviation-free — with exactly one behavioral deviation: `build` and
// the read commands each hold a claim while they run. Having located its
// configuration file, each adds to the lock directory an entry of its own —
// a plain file named as a mutating run's entry is, recording the reader's
// process identifier — where the area's path and the lock path each hold a
// directory or nothing, the lock directory and the area's directory coming
// into existence where absent, as acquisition brings them (13.5), and adds
// nothing where either holds anything else; it then dwells for a sustained
// interval (3000 ms, long against the 65–92 ms measured from a reader's
// start to the acquisition of a mutating command started once that reader
// is confirmed running, far short of every hang guard), proceeds as the
// conformer does, and as it ends deletes its entry, then the emptied lock
// directory and an emptied area directory it brought into existence, as
// release does. Acquisition judges a reader's entry as any run's: one whose
// reader is alive refuses it (14.26). One rule of 13.4 (no write but
// acquisition and release touches the lock path) is broken for `build` and
// the reads alone; they list no lock directory, judge no entry, remove no
// leftover, and are refused by none, and their answers, their other writes,
// and their exits are the conformer's. Certifies P-10 (C-1): on each
// schedule holding a reader started before a mutating command and confirmed
// running as it starts, the reader's entry — added once it located its
// configuration file, ahead of the command's acquisition, which follows the
// command's loading of its configuration and discovery of its sources —
// stands live at that acquisition, so the command is refused
// `workspace-busy`, exit 2, where P-10 asserts it never refused and ending
// as on its reader-free twin; wherever a reader runs as P-10 inspects the
// lock path after a kill, its entry stands beside the dead run's.
import { runXspec } from "../conf-core/product.mjs";

const code = await runXspec(process.argv.slice(2), process.cwd(), {
  readersHoldClaims: true,
});
process.exit(code);
