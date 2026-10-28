#!/usr/bin/env node
// VIOL-CORE-PARTIALWRITE violator executable (CERTIFICATIONS.md
// §VIOL-CORE-PARTIALWRITE). The CONF-CORE conformer with exactly one
// behavioral deviation: derived-file writes are not atomic in their
// observable effect — while a derived file is being written, its path holds
// a strict prefix of the new content for a sustained interval (long relative
// to a concurrent reader's polling cadence, short of S-3's hang detection)
// before the complete content appears. Every `build` performs its
// derived-file writes through this interval — content already byte-identical
// on disk is rewritten, never skipped — so each build of T13.5-5's polling
// loop exposes the partial state, on an unchanged workspace too. Durable
// files are unaffected. Certifies T13.5-5 (C-1): exactly it fails against
// this fixture; every other §CONF-CORE in-scope test passes.
import { runXspec } from "./product.mjs";

const code = await runXspec(process.argv.slice(2), process.cwd(), {
  partialDerivedWrites: true,
});
process.exit(code);
