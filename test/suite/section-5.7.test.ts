// TEST-SPEC §5.7 (SUITE-51): thin Vitest wrapper over the registered
// bodies — the identical bodies the certification runner executes against
// fixture products (C-2 "one code path"). Expected to fail as diagnosed
// assertion failures until the product exists (H-8).

import { declareProductTests } from "./declare.js";
import { section57Tests } from "./registry/section-5.7.js";

declareProductTests(section57Tests);
