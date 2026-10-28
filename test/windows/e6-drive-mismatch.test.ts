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
// the real temporary volume, after the member-invariance staging (`build`,
// a journaled `rename`, `review create`) — and the failure taxonomy:
// against a stub or nonconforming product the staging or the same-drive
// premise fails first, as a diagnosed assertion failure, on any platform
// this project is run on locally (the expected pre-product red on this
// leg); past it, a platform other than Windows is a loud error (H-9: never
// a skip, never a vacuous pass).

import { test } from "vitest";
import { runT1161DriveMismatchArm } from "../helpers/e6-drive-mismatch-arm.js";
import { NO_SPAN_GUARD } from "../helpers/hang-guards.js";
import { builtProductBinding } from "../helpers/subprocess.js";

test(
  "T11.6-1 drive-mismatch arm (Windows leg, E-6): with the working directory on a substituted drive and the workspace root on another drive letter, `inventory` reports the anchoring in the platform's absolute, drive-qualified spelling — the sole absolute-path case and sole platform-separator output — byte-exact, deterministic per invocation, the answer complete and finding-free at exit 0, and every other member (`findings`, `configuration`, `sources`, `derived`, `recorded`, `graphData`, `journal`, `sessions`, `lock`) byte-identical to the root run's on this leg, `graphData` exactly `.xspec`, `journal`'s `path` exactly `.xspec/journal`, and `lock` exactly `.xspec/lock` in every answer; the workspace staged first as built with Markdown emission enabled, a journal (a journaled `rename`), and a review session; same-drive premise first: from the workspace root the anchoring stays the relative `.`/`xspec.config.ts`, each path-bearing member of that root run's answer carrying content (SPEC 11.6, 12.0, 11, 1.5; TEST-SPEC E-6)",
  { timeout: NO_SPAN_GUARD },
  async () => {
    await runT1161DriveMismatchArm(builtProductBinding());
  },
);
