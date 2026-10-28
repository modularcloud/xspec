// E-6 Linux-side leg of the cross-platform byte-identity comparison
// (TEST-SPEC §18 E-6; CI-01). Runs the representative fixture — `version`,
// `build`, `check`, `query`, `coverage`, `impact`, `occurrences`,
// `view --text`, `at`, a `move --preview`, a journaled `rename` (the
// exclusion probe: held and killed, then held again over the dead run's
// leftover while the file-form `move` is refused `workspace-busy`, 13.5), a
// journaled file-form `move`, a journaled section-form `move` (the
// inserted-terminator probe: its moved text lands before a target parent's
// closing tag in an existing target file that gains an added import), an
// `audit` review session, and a nested-working-directory `inventory` —
// against the built product (helpers/e6.ts), asserting every step's exact
// exit code and the lock path's state around the mutating commands, and
// writes the captured outputs (transcript + final workspace tree) into
// XSPEC_E6_EXCHANGE_DIR when it is set. The suite-linux CI job sets that
// variable and uploads the directory as the `e6-linux-outputs` artifact; the
// Windows leg (test/windows/e6-byte-identity.test.ts) reruns the identical
// fixture and compares byte-for-byte (.github/workflows/ci.yml).
//
// This is a product-facing test: against the stub product it fails at the
// fixture's first step as a diagnosed assertion failure (H-8) and writes
// nothing — the artifact upload tolerates the empty directory
// (if-no-files-found: ignore). Without the environment variable (local runs)
// the fixture still runs in full as an ordinary test; only the exchange write
// is conditional — never the test itself (H-9: no skips).
//
// Not a registry entry: the E-6 exchange is §18 execution machinery keyed to
// no TEST-SPEC T/P ID and no CERTIFICATIONS.md scope; the §1–16 behavior it
// touches is owned by the per-section registered tests. Its product
// invocations still go through the one C-2 binding surface.

import { test } from "vitest";
import {
  E6_EXCHANGE_ENV,
  runE6RepresentativeFixture,
  writeE6Exchange,
} from "../helpers/e6.js";
import { NO_SPAN_GUARD } from "../helpers/hang-guards.js";
import { builtProductBinding } from "../helpers/subprocess.js";

// No guard of its own (TEST-SPEC S-3, helpers/hang-guards.ts): the test is a
// span over the fixture's 27 invocations, its exclusion probe's bounded
// reruns included, each bounded by its own hang guard.

test(
  "E-6 Linux leg: the representative fixture runs against the built product; its outputs are written to XSPEC_E6_EXCHANGE_DIR for the Windows leg when set (TEST-SPEC E-6)",
  { timeout: NO_SPAN_GUARD },
  async () => {
    const run = await runE6RepresentativeFixture(builtProductBinding());
    const exchangeDir = process.env[E6_EXCHANGE_ENV];
    if (exchangeDir !== undefined && exchangeDir.trim() !== "") {
      await writeE6Exchange(run, exchangeDir);
    }
  },
);
