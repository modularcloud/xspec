// E-6 platform-sensitive subset, part 3 of 3 (TEST-SPEC §18 E-6; CI-01) —
// the representative-fixture byte-identity comparison against the Linux leg.
//
// The identical fixture the Linux leg ran (helpers/e6.ts: `version`,
// `build`, `check`, `query`, `coverage`, `impact`, `occurrences`,
// `view --text`, `at`, a `move --preview`, a journaled `rename` — the
// exclusion probe: held and killed by the platform's forced termination of
// the run and every process it started, then held again over the dead run's
// leftover while the file-form `move` is refused `workspace-busy` (13.5) —
// a journaled file-form `move` — the specifier-computation probe, with
// `check` clean after it — a journaled section-form `move` — the
// inserted-terminator probe, its moved text landing before a target
// parent's closing tag in an existing target file that gains an added
// import — an `audit` review session, and `inventory` from a nested working
// directory, pinning the relative `/`-joined anchoring) is run here against
// the built product, and
// its outputs are asserted byte-identical to the Linux leg's, read from
// XSPEC_E6_EXCHANGE_DIR (the `e6-linux-outputs` CI artifact,
// .github/workflows/ci.yml): reports (every step's stdout/stderr — the
// path- and range-dense occurrence, view, at, inventory, and preview
// documents, and the refused `move`'s error document, included),
// move-rewritten sources, generated files, emitted Markdown, graph data, the
// journal, and the session file — a product-to-itself comparison, permitted
// by H-4, sound because both legs consume byte-identical input (12.0; the
// fixture's git history is scripted with pinned, platform-independent commit
// metadata); the lock path lies outside the comparison (H-6).
//
// Failure taxonomy (H-8/H-9 — never a skip, never a vacuous pass):
// - stub or nonconforming product → the fixture run itself fails first, as a
//   diagnosed assertion failure (the expected pre-product red on this leg);
// - fixture ran, exchange missing/malformed → loud error: the product exists
//   but the Linux outputs are absent, so the artifact plumbing (or the Linux
//   leg's own fixture run) is broken;
// - fixture ran, exchange read, bytes differ → diagnosed assertion failure
//   naming the diverging step or workspace path — the E-6 platform
//   divergence this leg exists to catch.

import { test } from "vitest";
import {
  assertE6RunMatchesExchange,
  requireE6ExchangeDir,
  runE6RepresentativeFixture,
} from "../helpers/e6.js";
import { NO_SPAN_GUARD } from "../helpers/hang-guards.js";
import { builtProductBinding } from "../helpers/subprocess.js";

// No guard of its own (TEST-SPEC S-3, helpers/hang-guards.ts): the test is a
// span over the fixture's 27 invocations, its exclusion probe's bounded
// reruns included, and the comparison, each invocation bounded by its own
// hang guard.

test(
  "E-6 byte-identity: the representative fixture's reports, rewritten sources, generated files, emitted Markdown, graph data, journal, and session file are byte-identical to the Linux leg's outputs from XSPEC_E6_EXCHANGE_DIR (TEST-SPEC E-6)",
  { timeout: NO_SPAN_GUARD },
  async () => {
    // Run the fixture first: against a stub product this fails diagnosed
    // before any exchange is consulted, so the missing-exchange error below
    // can only mean "product works, exchange absent".
    const run = await runE6RepresentativeFixture(builtProductBinding());
    await assertE6RunMatchesExchange(run, requireE6ExchangeDir());
  },
);
