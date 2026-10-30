// TEST-SPEC §7 configured names T7-11 (the members of TypeScript's global
// `Object` interface and `__proto__` as group, profile, and rule names):
// thin Vitest wrapper over the registered body — the identical body the
// certification runner executes against fixture products (C-2 "one code
// path"). Expected to fail as diagnosed assertion failures until the product
// conforms (H-8).

import { declareProductTests } from "./declare.js";
import { section7NamesTests } from "./registry/section-7-names.js";

declareProductTests(section7NamesTests);
