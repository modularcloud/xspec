// An S-4 module-settings detection module (TEST-SPEC S-4, H-2): a type
// re-exported through `export { … } from` without a `type` modifier, which
// H-2's CommonJS configuration accepts and its ES-module configuration
// rejects — `isolatedModules`' rule, which `verbatimModuleSyntax` implies
// and the diagnostic names (TS1205 "Re-exporting a type when
// 'verbatimModuleSyntax' is enabled requires using 'export type'").
// Well-formed to TypeScript's parser, read as module code and as script
// code alike: the rejection is the checker's, under one configuration.
// Excluded from `npm run typecheck` (test/tsconfig.json excludes fixtures/);
// the harness compiles it through the tooling driver at test run time. S-4
// pins its exact offsets, lines, and columns via substring markers — any
// edit here must keep test/self/s4-typescript-tooling.test.ts in step.

export { GreetingParts } from "./greeting-parts.js";
