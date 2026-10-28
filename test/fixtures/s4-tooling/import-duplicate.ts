// The S-4 known duplicate import binding: one identifier bound by two import
// declarations (TS2300 "Duplicate identifier"), the other diagnostic kind
// T6.5-9's compile-clean observation turns on — when a product-chosen import
// identifier collides with an import binding the receiving file already
// holds. Deliberately broken and therefore excluded from
// `npm run typecheck` (test/tsconfig.json excludes fixtures/); the harness
// compiles this project through the tooling driver at test run time.

import { greet } from "./greeting.js";
import { greet } from "./other-greeting.js";

export const duplicated: string = greet("world");
