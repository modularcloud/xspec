// TEST-SPEC §4.5 second part (SUITE-15 continued, T4.5-10 and T4.5-11): thin
// Vitest wrapper over the registered bodies — the identical bodies the
// certification runner executes against fixture products (C-2 "one code
// path"). Expected to fail as diagnosed assertion failures until the product
// conforms (H-8).

import { declareProductTests } from "./declare.js";
import { section45iiTests } from "./registry/section-4.5-ii.js";

declareProductTests(section45iiTests);
