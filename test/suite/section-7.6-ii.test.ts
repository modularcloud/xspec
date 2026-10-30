// TEST-SPEC §7.6 T7.6-4, T7.6-6, and T7.6-7 (the defineConfig module's
// placements — each standing in for the canonical one in runs of T7.6-1,
// T7.6-2(a) with T7.6-3's unknown-top-level-key arm, and T7.6-6 — and its
// runtime — its exports and identity, and the absence of any effect —
// through H-2's module channel, with TypeScript 5.9.3 and on the Node.js
// releases E-1 provisions): thin Vitest wrapper over the registered
// bodies — the identical bodies the certification runner executes against
// fixture products (C-2 "one code path"). Expected to fail as diagnosed
// assertion failures until the product's package directory meets 7.6
// (H-8).

import { declareProductTests } from "./declare.js";
import { section76iiTests } from "./registry/section-7.6-ii.js";

declareProductTests(section76iiTests);
