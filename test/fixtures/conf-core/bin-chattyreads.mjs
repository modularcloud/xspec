#!/usr/bin/env node
// VIOL-CORE-CHATTYREADS violator executable (CERTIFICATIONS.md
// §VIOL-CORE-CHATTYREADS). The CONF-CORE conformer with exactly one
// behavioral deviation: `build` and the read commands modify the journal —
// each such invocation that is not refused as a usage or configuration error
// (exit 2) appends one fixed line to .xspec/journal, creating the file when
// absent. Mutating commands, and the entries `rename`/`move` append, are
// unchanged. Certifies T13.4-5 and T13.5-4 (C-1): exactly they fail against
// this fixture — T13.4-5's journal byte-compares under `build` and the read
// commands, and T13.5-4's held-state comparisons once its reads during the
// hold have exited, the journal grown past the pre-invocation bytes they
// assert; every other §CONF-CORE in-scope test passes.
import { runXspec } from "./product.mjs";

const code = await runXspec(process.argv.slice(2), process.cwd(), {
  chattyReads: true,
});
process.exit(code);
