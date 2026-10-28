// The S-4 known import conflict: an import binding that collides with a
// module-scope local declaration of the same identifier (TS2440 "Import
// declaration conflicts with local declaration"), the diagnostic kind
// T6.5-9's compile-clean observation turns on when a product-chosen import
// identifier collides with the receiving file's own `const`, `function`, or
// `class`. Deliberately broken and therefore excluded from
// `npm run typecheck` (test/tsconfig.json excludes fixtures/); the harness
// compiles this project through the tooling driver at test run time.

import { greet } from "./greeting.js";

const greet = (who: string): string => `Hi, ${who}.`;

export const conflicted: string = greet("world");
