// The one load of the TypeScript compiler API (IMPLEMENTATION: TypeScript
// parsing, analysis, and emission go through the `typescript` package).
//
// The package ships as a single ~8.5 MB CommonJS file. Importing it through
// the ESM loader makes Node format-sniff and CJS-lex the whole file on every
// process start to synthesize named exports — ~200ms per invocation on top
// of the require itself. Loading it through `createRequire` skips that
// interop entirely (the module is CJS; requiring it is the direct path) and
// roughly halves the cost of every configuration-parsing invocation, which
// matters for surfaces answered once per CLI run (SPEC 11: `at` sweeps run
// the whole path per offset). Same module instance, same API, loaded once
// per process either way.

import { createRequire } from "node:module";
import type TsModule from "typescript";

const require = createRequire(import.meta.url);

/** The TypeScript compiler API namespace (the package's CJS export). */
const ts: typeof TsModule = require("typescript") as typeof TsModule;

export default ts;
