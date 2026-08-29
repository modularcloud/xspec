#!/usr/bin/env node
// VIOL-AVAIL-NOFILE violator executable (CERTIFICATIONS.md
// §VIOL-AVAIL-NOFILE). The CONF-AVAIL conformer with exactly one
// behavioral deviation: `occurrences` does not apply the `--file`
// restriction — the flag and its argument checks behave as specified
// (SPEC 11.3), but the consulted domain is the entire discovered set,
// exactly as with the flag absent; the enumeration and the findings
// accompanying it follow that widened domain. `--to` selection, `view`,
// and every other behavior are unchanged. Certifies exactly T11.3-4 (C-1):
// its restricted arm enumerates the occurrence `--file` excludes and fails
// the exact-empty compare; every other §CONF-AVAIL in-scope test passes
// (none drives `occurrences` with `--file`).
import { runXspec } from "./product.mjs";

const code = await runXspec(process.argv.slice(2), process.cwd(), {
  ignoreFileRestriction: true,
});
process.exit(code);
