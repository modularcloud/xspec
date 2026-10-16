#!/usr/bin/env node
// VIOL-CORE-CHATTYREADS violator executable (CERTIFICATIONS.md
// §VIOL-CORE-CHATTYREADS). The CONF-CORE conformer with exactly one
// behavioral deviation: `check` modifies the journal — each `check`
// invocation that is not refused as a usage or configuration error (exit 2)
// appends one fixed line to .xspec/journal, creating the file when absent.
// The line is inert to the fixture's own journal handling: read back as
// neither an identity mapping (5.4) nor a malformed entry (no 14.13, so no
// later command is gated by it, 13.3), graph data and every other derived
// byte independent of how many such lines the journal holds (13.4). A
// single deviation: 6.1's rule that the journal is written by `rename` and
// `move` alone broken for `check`; `build`, every other read command,
// mutating commands, and the entries `rename`/`move` append are unchanged.
// Certifies T13.5-4 (C-1): exactly it fails against this fixture, on one
// ground — the held-state comparison made once its reads during the hold,
// `check` among them, have exited meets the journal grown past the
// pre-invocation bytes it asserts (at its first read during the hold,
// `check`); its `build` arm and its storm, on whose workspaces and twins no
// `check` runs, meet no appended line; every other §CONF-CORE in-scope test
// passes.
import { runXspec } from "./product.mjs";

const code = await runXspec(process.argv.slice(2), process.cwd(), {
  chattyReads: true,
});
process.exit(code);
