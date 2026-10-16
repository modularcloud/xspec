// Thin Vitest wrapper over the product-test registry (C-2 "one code path"):
// each suite file declares its section's registered entries with
// `declareProductTests`, and every body runs here against the default
// binding — the built product (helpers/subprocess.ts, builtProductBinding) —
// byte-for-byte the same body the certification runner executes against
// CERTIFICATIONS.md fixture products. No test hard-codes the product path.
//
// Membership guard: an entry declared to Vitest but absent from the manifest
// (test/suite/registry/index.ts) would run in the suite yet be invisible to
// certification and to the S-7 red-green sweep — so declaration refuses it
// outright.

import { test } from "vitest";
import { NO_SPAN_GUARD } from "../helpers/hang-guards.js";
import { runProductTestBody } from "../helpers/product-invocations.js";
import type { ProductTestEntry } from "../helpers/registry.js";
import { builtProductBinding } from "../helpers/subprocess.js";
import { productTestSuite } from "./registry/index.js";

/**
 * Declare registered product-facing tests as Vitest tests against the built
 * product. Each is declared with no Vitest timeout ({@link NO_SPAN_GUARD};
 * TEST-SPEC S-3): a test is a span over its invocations and harness steps,
 * bounded by their own guards — the certification runner applies none
 * either. Each body runs inside its own invocation context
 * (helpers/product-invocations.ts), as it does under the certification
 * runner, so the workspace builder's undeclared-staging guard sees the
 * body's first product invocation wherever it happens.
 */
export function declareProductTests(
  entries: readonly ProductTestEntry[],
): void {
  for (const entry of entries) {
    if (
      !productTestSuite.has(entry.id) ||
      productTestSuite.get(entry.id) !== entry
    ) {
      throw new Error(
        `product test ${entry.id} is not in the manifest (test/suite/registry/index.ts) — ` +
          `every declared suite test must be registered there, or the certification runner ` +
          `and the S-7 red-green sweep would never see it (C-1, C-2).`,
      );
    }
    test(`${entry.id} ${entry.title}`, { timeout: NO_SPAN_GUARD }, async () => {
      await runProductTestBody(entry.id, () =>
        entry.run(builtProductBinding()),
      );
    });
  }
}
