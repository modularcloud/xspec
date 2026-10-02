// The Windows leg's drive-mismatch fixture (TEST-SPEC §18 E-6, S-9's timing
// clause, H-8): the two files test/windows/e6-drive-mismatch.test.ts stages
// at its workspace's creation — the configuration and the one spec source
// of the registered T11.6-1 body's staging. That arm runs outside every
// registered body and S-7's sweep (it is no registry entry, and the sweep
// never runs the windows project), so the undeclared-staging guard cannot
// refuse its staging (helpers/workspace.ts: outside a body context a
// creation never refuses), yet S-9 wants both files judged before any
// product exists. They are staged-source records for that reason, defined
// here rather than in the test file so that the S-9 self-test
// (test/self/s9-staged-sources.test.ts) can import this module BEFORE the
// registry manifest seals the ledgers and judge both records there, as it
// judges the E-6 exchange fixture's (helpers/e6.ts). Named after T11.6-1,
// the registered test whose drive-mismatch arm this is.
//
// A minimal valid workspace (the registered T11.6-1 body's staging): the
// inventory parses no sources (SPEC 11.6), so the anchoring depends on none
// of this — the staging keeps the workspace valid so every answer is the
// complete, finding-free, exit-0 case.

import { stagedMdx } from "./staged-mdx.js";
import { stagedTs } from "./staged-ts.js";

/** The arm's `xspec.config.ts`: a single spec group. */
export const ANCHOR_CONFIG = stagedTs(
  "T11.6-1 drive-mismatch arm (E-6 Windows leg) xspec.config.ts",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
);

/** The arm's one spec source, `specs/a.mdx`. */
export const ANCHOR_SOURCE = stagedMdx(
  "T11.6-1 drive-mismatch arm (E-6 Windows leg) specs/a.mdx",
  '<S id="racine">\nAncrage — contenu stable.\n</S>\n',
);
