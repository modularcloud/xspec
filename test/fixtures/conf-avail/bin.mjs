#!/usr/bin/env node
// CONF-AVAIL conformer executable (CERTIFICATIONS.md §CONF-AVAIL). The
// certification runner drives this file exactly as it drives the built
// product — an executable/workspace binding and nothing else (TEST-SPEC C-2).
// Violator fixtures (VIOL-AVAIL-*) reuse product.mjs with exactly one
// behavioral deviation each; this entry runs the conformer, deviation-free.
import { runXspec } from "./product.mjs";

const code = await runXspec(process.argv.slice(2), process.cwd(), {});
process.exit(code);
