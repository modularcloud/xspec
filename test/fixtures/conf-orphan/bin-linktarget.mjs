#!/usr/bin/env node
// VIOL-ORPHAN-LINKTARGET violator executable (CERTIFICATIONS.md
// §VIOL-ORPHAN-LINKTARGET). The CONF-ORPHAN conformer with exactly one
// behavioral deviation: removal of a recorded derived path no longer
// generated, where the path's occupant is a symbolic link, deletes in place
// of the link the plain file the link resolves to — nothing where it
// resolves to no plain file — and leaves the link standing. Unchanged: the
// occupant judged as itself, so 14.10's recorded-file form still reports the
// link concerning the recorded path; nothing read below a workspace-relative
// directory component occupied by anything other than a directory; and
// derived-file writes still replacing a symbolic link at a derived file's
// path as the occupant, traversing none. Certifies T13.4-11 (C-1): it fails
// on arm (c) alone — `build` exiting 0 having deleted the file outside the
// workspace that the link at `specs/A.md` targets and left the link
// standing, while the first `check`'s recorded-file finding concerning
// `specs/A.md` is unmoved.
import { runXspec } from "./product.mjs";

const code = await runXspec(process.argv.slice(2), process.cwd(), {
  removeLinkTarget: true,
});
process.exit(code);
