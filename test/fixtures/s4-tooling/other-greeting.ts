// Second clean module of the S-4 fixture project: exports a `greet` of the
// same signature as greeting.ts's, with a different body, so that a file
// importing `greet` from both modules stages the S-4 known duplicate import
// binding (TS2300) — see import-duplicate.ts. Valid on its own. S-4 pins
// exact offsets, lines, and columns in these files via substring markers —
// any edit here must keep test/self/s4-typescript-tooling.test.ts in step.

/** Builds an informal greeting for a name. */
export function greet(name: string): string {
  return `Hey there, ${name}.`;
}
