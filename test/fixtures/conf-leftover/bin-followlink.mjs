#!/usr/bin/env node
// VIOL-LEFTOVER-FOLLOWLINK violator executable (CERTIFICATIONS.md
// §VIOL-LEFTOVER-FOLLOWLINK). The CONF-LEFTOVER conformer — the CONF-CORE
// product run deviation-free — with exactly one behavioral deviation:
// acquisition's removal of a leftover symbolic link to a directory — at the
// lock directory's top level or at any depth below it — follows the link,
// removing everything the targeted directory holds, recursing through the
// link as into a directory at every depth, and then the link itself, the
// targeted directory left in place, empty. A link to a file and a dangling
// link are removed themselves, every other leftover is removed as the
// conformer removes it, and acquisition then proceeds as the conformer's
// does; the deletion through the link (a write that traverses a link, 13.4)
// is that single deviation itself. Certifies P-15 (C-1): on each draw holding
// a symbolic link to a directory outside the workspace — its target holding
// a file and writable throughout, by the scope's staging constraint — the
// target's content is deleted where P-15 asserts every link's target outside
// the workspace byte-identical afterward and nothing written through a link,
// the command still exiting 0 with its twin's result and `.xspec/lock`
// absent.
import { runXspec } from "../conf-core/product.mjs";

const code = await runXspec(process.argv.slice(2), process.cwd(), {
  followLinksAtRemoval: true,
});
process.exit(code);
