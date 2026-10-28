// TEST-SPEC §16 P-15 (PROP-13): thin Vitest wrapper over the registered
// property test — the identical body the certification runner executes
// against fixture products (C-2 "one code path"). Expected to fail as a
// diagnosed assertion failure until the product conforms (H-8).

import { declareProductTests } from "./declare.js";
import { section16P15Tests } from "./registry/section-16-p15.js";

declareProductTests(section16P15Tests);
