#!/usr/bin/env node
// VIOL-ORPHAN-THROUGHLINK violator executable (CERTIFICATIONS.md
// §VIOL-ORPHAN-THROUGHLINK). The CONF-ORPHAN conformer with exactly one
// behavioral deviation: removal of a recorded derived path no longer
// generated resolves the path's workspace-relative directory components
// through symbolic links to directories inside the workspace root — below a
// component such a link occupies, the occupant is the entry the link's target
// holds under the path's remaining components, judged and removed by 13.4's
// other rules as if it stood at the recorded path, and 14.10's recorded-file
// form, reporting exactly the occupants that removal would remove, reports
// it. Unchanged: 13.4's reads of the journal, the session directory, and the
// record; the occupant at the recorded path itself judged as itself (a
// symbolic link there removed as the link, never its target); a component
// occupied by a plain file, or by a symbolic link to a directory outside the
// workspace root, still leaving the path holding nothing; and derived-file
// writes traversing no symbolic link. Certifies T13.4-11 (C-1): it fails on
// arm (e)'s staging inside the workspace alone — the first `check` reporting
// the foreign `A.md` as a condition-10 recorded-file finding concerning
// `out/specs/A.md`, and `build` deleting it.
import { runXspec } from "./product.mjs";

const code = await runXspec(process.argv.slice(2), process.cwd(), {
  componentLinksInsideRoot: true,
});
process.exit(code);
