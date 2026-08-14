// TEST-SPEC §11.3 (SUITE-53): thin Vitest wrapper over the registered
// bodies — the identical bodies the certification runner executes against
// fixture products (C-2 "one code path"). Expected to fail as diagnosed
// assertion failures until the product exists (H-8).

import { declareProductTests } from "./declare.js";
import { section113Tests } from "./registry/section-11.3.js";

declareProductTests(section113Tests);
