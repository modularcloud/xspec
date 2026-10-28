// TEST-SPEC §6.5 fifth part (SUITE-25 continued, T6.5-23): thin Vitest
// wrapper over the registered bodies — the identical bodies the
// certification runner executes against fixture products (C-2 "one code
// path"). Expected to fail as diagnosed assertion failures until the product
// conforms (H-8).

import { declareProductTests } from "./declare.js";
import { section65vTests } from "./registry/section-6.5-v.js";

declareProductTests(section65vTests);
