// TEST-SPEC §16 P-19 (configuration import spellings): thin Vitest wrapper
// over the registered property test — the identical body the certification
// runner executes against fixture products (C-2 "one code path"). Expected
// to fail as a diagnosed assertion failure until the product conforms
// (H-8).

import { declareProductTests } from "./declare.js";
import { section16P19Tests } from "./registry/section-16-p19.js";

declareProductTests(section16P19Tests);
