// TEST-SPEC §14 II (SUITE-49, the environment refusals): thin Vitest wrapper
// over the registered bodies — the identical bodies the certification runner
// executes against fixture products (C-2 "one code path"). Expected to fail
// as diagnosed assertion failures until the product exists (H-8).

import { declareProductTests } from "./declare.js";
import { section14iiTests } from "./registry/section-14-ii.js";

declareProductTests(section14iiTests);
