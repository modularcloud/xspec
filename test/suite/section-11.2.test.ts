// TEST-SPEC §11.2 (SUITE-52): thin Vitest wrapper over the registered
// bodies — the identical bodies the certification runner executes against
// fixture products (C-2 "one code path"). Expected to fail as diagnosed
// assertion failures until the product exists (H-8).

import { declareProductTests } from "./declare.js";
import { section112Tests } from "./registry/section-11.2.js";

declareProductTests(section112Tests);
