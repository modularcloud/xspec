// TEST-SPEC §14 III (SUITE-49 continued, T14-12 the well-formedness
// contract): thin Vitest wrapper over the registered bodies — the identical
// bodies the certification runner executes against fixture products (C-2
// "one code path"). Expected to fail as diagnosed assertion failures until
// the product conforms (H-8).

import { declareProductTests } from "./declare.js";
import { section14iiiTests } from "./registry/section-14-iii.js";

declareProductTests(section14iiiTests);
