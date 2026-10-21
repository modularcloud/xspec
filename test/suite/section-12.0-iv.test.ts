// TEST-SPEC §12.0 IV (SUITE-42 continued, T12.0-15): thin Vitest wrapper
// over the registered bodies — the identical bodies the certification runner
// executes against fixture products (C-2 "one code path"). Expected to fail
// as diagnosed assertion failures until the product conforms (H-8).

import { declareProductTests } from "./declare.js";
import { section120ivTests } from "./registry/section-12.0-iv.js";

declareProductTests(section120ivTests);
