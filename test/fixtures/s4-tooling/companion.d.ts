// Declaration module of the S-4 fixture project, in the shape of a product's
// declaration companion (SPEC.md 13.1): a type and an ambient value a
// consumer imports, no implementation. uses-companion.ts imports it; its
// twin companion-error.d.ts differs from it by one known type error. Valid
// under both of H-2's configurations. S-4 pins exact offsets, lines, and
// columns in these files via substring markers — any edit here must keep
// test/self/s4-typescript-tooling.test.ts in step.

/** The greeting a companion declares. */
export interface CompanionGreeting {
  readonly text: string;
}

/** The companion's greeting value. */
export declare const companionGreeting: CompanionGreeting;
