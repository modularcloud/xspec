#!/usr/bin/env node
// CONF-RACE conformer executable (CERTIFICATIONS.md §CONF-RACE). CONF-RACE's
// scope is CONF-CORE's workspaces, behavior, and command surface as T13.5-13
// drives them, its acquisition and release CONF-CORE's — its entry added
// before the listing that judges the lock directory, so that, of runs whose
// acquisitions overlap, at most one acquires, possibly none — so this entry
// runs the CONF-CORE product deviation-free (../conf-core/product.mjs). The
// certification runner drives it exactly as it drives the built product — an
// executable/workspace binding and nothing else (TEST-SPEC C-2). Its one
// in-scope test is T13.5-13: it sits with a conformer of its own because its
// unheld arm has no deterministic outcome under VIOL-CORE-EARLYRELEASE, so it
// could not join CONF-CORE's in-scope set (CERTIFICATIONS.md, C-1).
import { runXspec } from "../conf-core/product.mjs";

const code = await runXspec(process.argv.slice(2), process.cwd(), {});
process.exit(code);
