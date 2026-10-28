// The S-4 known type error outside the consumer file (TEST-SPEC S-4, H-2):
// the twin of companion.d.ts, identical to it but for one type error inside
// the declaration module — a type argument violating its parameter's
// constraint (TS2344) — which uses-companion-error.ts reaches through its
// import. H-2's clean verdict covers the whole program, generated modules
// and companions included, so the error fails a clean verdict on that
// consumer, whose own file carries no diagnostic; a driver skipping
// declaration files (`skipLibCheck`) would pass it vacuously. Deliberately
// broken and therefore excluded from `npm run typecheck`
// (test/tsconfig.json excludes fixtures/); the harness compiles this project
// through the tooling driver at test run time. S-4 pins its exact offsets,
// lines, and columns via substring markers — any edit here must keep
// test/self/s4-typescript-tooling.test.ts in step.

/** The greeting a companion declares. */
export interface CompanionGreeting {
  readonly text: string;
}

/** A label type admitting strings alone. */
type Label<T extends string> = T;

/** The known type error: `42` does not satisfy `string`. */
export type CompanionLabel = Label<42>;

/** The companion's greeting value. */
export declare const companionGreeting: CompanionGreeting;
