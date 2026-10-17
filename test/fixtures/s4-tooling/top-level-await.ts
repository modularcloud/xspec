// An S-4 module-settings detection module (TEST-SPEC S-4, H-2): a top-level
// `await`, which H-2's ES-module configuration accepts and its CommonJS
// configuration rejects (TS1378 "Top-level 'await' expressions are only
// allowed when the 'module' option is set to …"), CommonJS output admitting
// none. Well-formed to TypeScript's parser, read as module code and as
// script code alike: the rejection is the checker's, under one
// configuration. Excluded from `npm run typecheck` (test/tsconfig.json
// excludes fixtures/); the harness compiles it through the tooling driver at
// test run time. S-4 pins its exact offsets, lines, and columns via
// substring markers — any edit here must keep
// test/self/s4-typescript-tooling.test.ts in step.

export const ready: string = await Promise.resolve("ready");
