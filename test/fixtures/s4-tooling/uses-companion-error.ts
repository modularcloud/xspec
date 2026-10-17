// Consumer of the S-4 known type error outside the consumer file: this file
// carries no diagnostic of its own, while the declaration module it imports
// (companion-error.d.ts) carries one, so only a clean verdict covering the
// whole program (TEST-SPEC H-2, S-4) reports it. Its twin uses-companion.ts
// imports the clean companion.d.ts.

import { companionGreeting } from "./companion-error.js";

export const shown: string = companionGreeting.text;
