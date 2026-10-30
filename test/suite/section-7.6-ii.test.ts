// TEST-SPEC §7.6 T7.6-6 (the defineConfig module's runtime, through H-2's
// module channel on the Node.js releases E-1 provisions): thin Vitest
// wrapper over the registered bodies — the identical bodies the
// certification runner executes against fixture products (C-2 "one code
// path"). Expected to fail as diagnosed assertion failures until the
// product's package directory meets 7.6 (H-8).

import { declareProductTests } from "./declare.js";
import { section76iiTests } from "./registry/section-7.6-ii.js";

declareProductTests(section76iiTests);
