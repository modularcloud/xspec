#!/usr/bin/env node
// VIOL-AVAIL-OMIT violator executable (CERTIFICATIONS.md §VIOL-AVAIL-OMIT).
// The CONF-AVAIL conformer with exactly one behavioral deviation:
// `null`-valued members are omitted — every member whose value an answer
// would carry as the stated `null` (SPEC 12.7) is absent from the emitted
// document (a viewed root's `tags` and `coverage` and a located finding's
// `path` among them). Members with plain, marker, or list values, which
// findings exist, and exit codes are unchanged. Certifies T11.2-2,
// T11.2-4, T11.4-1, T11.4-3, and T11.4-4 (C-1): exactly they fail against
// this fixture — every in-scope test that decodes a `view` answer — and
// T11.3-4 passes (its two answers are empty enumerations carrying no
// `null`-valued member to omit).
import { runXspec } from "./product.mjs";

const code = await runXspec(process.argv.slice(2), process.cwd(), {
  omitNullMembers: true,
});
process.exit(code);
