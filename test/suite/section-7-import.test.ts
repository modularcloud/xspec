// TEST-SPEC §7 configuration import T7-9 (the import's module specifier, read
// as spelled and never interpreted, resolved, or loaded): thin Vitest
// wrapper over the registered body — the identical body the certification
// runner executes against fixture products (C-2 "one code path"). Expected
// to fail as a diagnosed assertion failure until the product conforms (H-8).

import { declareProductTests } from "./declare.js";
import { section7ImportTests } from "./registry/section-7-import.js";

declareProductTests(section7ImportTests);
