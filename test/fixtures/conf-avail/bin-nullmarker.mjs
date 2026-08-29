#!/usr/bin/env node
// VIOL-AVAIL-NULLMARKER violator executable (CERTIFICATIONS.md
// §VIOL-AVAIL-NULLMARKER). The CONF-AVAIL conformer with exactly one
// behavioral deviation: the unavailability marker is never emitted — every
// datum the rules of SPEC 11.2 leave undefined is carried as `null` in
// place of {"unavailable": true} (12.7). Which data are undefined, all
// defined values, findings, exit codes, and every other document member are
// unchanged. Certifies T11.2-2, T11.2-4, T11.4-3, and T11.4-4 (C-1):
// exactly they fail against this fixture; every other §CONF-AVAIL in-scope
// test passes (T11.4-1's fixtures stage no undefined datum; T11.3-4's
// answers are empty enumerations).
import { runXspec } from "./product.mjs";

const code = await runXspec(process.argv.slice(2), process.cwd(), {
  nullMarkers: true,
});
process.exit(code);
