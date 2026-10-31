// TEST-SPEC §16 P-18 (type contract over generated configurations): thin
// Vitest wrapper over the registered property test — the identical body the
// certification runner executes against fixture products (C-2 "one code
// path"), type-checking drawn configurations and their mutants beside the
// product's package directory, placed through H-2's module channel, with
// TypeScript 5.9.3. Expected to fail as a diagnosed assertion failure until
// the product's package directory meets 7.6 (H-8).

import { declareProductTests } from "./declare.js";
import { section16P18Tests } from "./registry/section-16-p18.js";

declareProductTests(section16P18Tests);
