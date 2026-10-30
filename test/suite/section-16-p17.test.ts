// TEST-SPEC §16 P-17 (installation names): thin Vitest wrapper over the
// registered property test — the identical body the certification runner
// executes against fixture products (C-2 "one code path"), placing the
// product's package directory under drawn names through H-2's module
// channel, with TypeScript 5.9.3 and on the Node.js releases E-1
// provisions. Expected to fail as a diagnosed assertion failure until the
// product's package directory meets 7.6 (H-8).

import { declareProductTests } from "./declare.js";
import { section16P17Tests } from "./registry/section-16-p17.js";

declareProductTests(section16P17Tests);
