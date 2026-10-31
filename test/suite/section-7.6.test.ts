// TEST-SPEC §7.6 T7.6-1, T7.6-2, and T7.6-3 (the defineConfig module, through
// H-2's module channel): thin Vitest wrapper over the registered bodies — the
// identical bodies the certification runner executes against fixture
// products (C-2 "one code path"). Expected to fail as diagnosed assertion
// failures until the product's package directory meets 7.6 (H-8).

import { declareProductTests } from "./declare.js";
import { section76Tests } from "./registry/section-7.6.js";

declareProductTests(section76Tests);
