#!/usr/bin/env node
// VIOL-LEFTOVER-BYTENAMES violator executable (CERTIFICATIONS.md
// §VIOL-LEFTOVER-BYTENAMES). The CONF-LEFTOVER conformer — the CONF-CORE
// product run deviation-free — with exactly one behavioral deviation:
// acquisition's listings decode names as UTF-8 text, each ill-formed
// sequence decoded to U+FFFD, and its examinations and removals address each
// leftover by its decoded name, so a leftover whose name is not valid UTF-8
// — at the lock directory's top level or at any depth below it — is
// addressed by a name that designates nothing, the removal finding nothing
// there taken for done, as the conformer takes a removal that finds nothing
// to remove, and it stays; every other name, links, FIFOs, unreadable files,
// depth, and a write the environment refuses are handled as the conformer
// handles them. One in the lock directory itself stays, with everything
// below it, and acquisition proceeds and acquires as the conformer's does,
// the run's release, deleting its entry, then leaving the lock directory,
// whose deletion the environment refuses while it holds that leftover (13.5:
// a refusal that changes no outcome). One in a directory acquisition lists
// to remove leaves that directory unemptied, so its removal is refused — the
// write failure of 14.24 (`write-failure`, `.xspec/lock`, exit 2), the run
// attempting no later removal and its release leaving the lock directory
// standing with what it still holds. Certifies P-15 (C-1): on each draw
// holding a name that is not valid UTF-8, `.xspec/lock` stands once the
// command ends where P-15 asserts it absent; where such a name lies in a
// directory acquisition lists to remove, the command besides exits 2 where
// P-15 asserts exit 0 and the twin's result.
import { runXspec } from "../conf-core/product.mjs";

const code = await runXspec(process.argv.slice(2), process.cwd(), {
  namesAsText: true,
});
process.exit(code);
