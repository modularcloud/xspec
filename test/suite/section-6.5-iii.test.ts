// TEST-SPEC §6.5 third part (SUITE-25 continued, T6.5-12 through T6.5-16): thin
// Vitest wrapper over the registered bodies — the identical bodies the
// certification runner executes against fixture products (C-2 "one code
// path"). Expected to fail as diagnosed assertion failures until the product
// conforms (H-8).

import { declareProductTests } from "./declare.js";
import { section65iiiTests } from "./registry/section-6.5-iii.js";

declareProductTests(section65iiiTests);
