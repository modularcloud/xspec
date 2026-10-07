// E-6 platform-sensitive subset, part 2 of 3 (TEST-SPEC §18 E-6; CI-01) —
// the drive-mismatch anchoring arm of T11.6-1, the sole platform-form output
// in the whole surface, stageable on no Linux runner. Run by the
// suite-windows CI job (`npm run test:windows`); the path/identity
// assertions and casing probes live in e6-subset.test.ts, the byte-identity
// comparison in e6-byte-identity.test.ts.
//
// The arm's body is `runT1161DriveMismatchArm`
// (helpers/e6-drive-mismatch-arm.ts), one code path (C-2) with S-7's sweep,
// which runs it against the empty stub on every platform
// (test/self/s7-red-green-sweep.test.ts; H-8); this file runs it against
// the built product. That module's header gives the staging — the working
// directory on a substituted drive (`subst`, E-6), the workspace root on
// the real temporary volume — and the failure taxonomy: against a stub or
// nonconforming product the same-drive premise fails first, as a diagnosed
// assertion failure, on any platform this project is run on locally (the
// expected pre-product red on this leg); past it, a platform other than
// Windows is a loud error (H-9: never a skip, never a vacuous pass).

import { test } from "vitest";
import { runT1161DriveMismatchArm } from "../helpers/e6-drive-mismatch-arm.js";
import { DEFAULT_PRODUCT_TEST_TIMEOUT_MS } from "../helpers/registry.js";
import { builtProductBinding } from "../helpers/subprocess.js";

test(
  "T11.6-1 drive-mismatch arm (Windows leg, E-6): with the working directory on a substituted drive and the workspace root on another drive letter, `inventory` reports the anchoring in the platform's absolute, drive-qualified spelling — the sole absolute-path case and sole platform-separator output — byte-exact, deterministic per invocation, the answer complete and finding-free at exit 0; same-drive premise first: from the workspace root the anchoring stays the relative `.`/`xspec.config.ts` (SPEC 11.6, 12.0, 11; TEST-SPEC E-6)",
  { timeout: DEFAULT_PRODUCT_TEST_TIMEOUT_MS },
  async () => {
    await runT1161DriveMismatchArm(builtProductBinding());
  },
);
