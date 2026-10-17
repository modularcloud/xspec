// Consumer of the S-4 fixture project's clean declaration module
// (companion.d.ts): the clean-whole-program twin of uses-companion-error.ts,
// identical to it but for the module it imports. Valid under both of H-2's
// configurations.

import { companionGreeting } from "./companion.js";

export const shown: string = companionGreeting.text;
