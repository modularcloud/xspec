// Type-only module of the S-4 fixture project: it exports one interface and
// no value, so a module naming `GreetingParts` without a `type` modifier —
// type-reexport.ts, type-import.ts — is accepted under H-2's CommonJS
// configuration and rejected under its ES-module configuration
// (`isolatedModules`, `verbatimModuleSyntax`). Valid under both on its own.

/** The parts a greeting is built from. */
export interface GreetingParts {
  readonly salutation: string;
  readonly name: string;
}
