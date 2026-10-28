#!/usr/bin/env node
// VIOL-CORE-HOLDLINK violator executable (CERTIFICATIONS.md
// §VIOL-CORE-HOLDLINK). The CONF-CORE conformer with exactly one behavioral
// deviation: hold-file creation follows a symbolic link at the hold path.
// The path's occupancy is judged through the link, so a dangling link reads
// as nothing there, and the empty hold file is created at the link's target
// — a write through the link — the run then proceeding only once the hold
// path, judged through the link, holds nothing. One clause of 13.5's seam
// (creation fails if anything, a symbolic link included, already exists at
// the path) broken for a link whose target does not exist: a link to an
// existing file or directory reads as occupied through the link, so creation
// fails there with the seam's usage error as the conformer's does, and a
// path holding no link is judged alike on both sides. Certifies T13.5-1
// (C-1): exactly it fails against this fixture, on its dangling-link arm
// (the run holds at the link's target, never exiting 2, the arm's hang
// detection diagnosing it); every other §CONF-CORE in-scope test passes.
import { runXspec } from "./product.mjs";

const code = await runXspec(process.argv.slice(2), process.cwd(), {
  holdThroughLink: true,
});
process.exit(code);
