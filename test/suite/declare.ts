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
//
// The declarations reach Vitest's `test` through a declarer parameter, so
// S-3's pre-product check (test/self/s3-hang-guards.test.ts) records the
// declaration every registered entry receives — its name, its framework
// timeout, its function — with no body run and no product driven.

import { test } from "vitest";
import { NO_SPAN_GUARD } from "../helpers/hang-guards.js";
import { runProductTestBody } from "../helpers/product-invocations.js";
import type { ProductTestEntry } from "../helpers/registry.js";
import { builtProductBinding } from "../helpers/subprocess.js";
import { productTestSuite } from "./registry/index.js";

/** The framework options a registered test is declared with. */
export interface ProductTestDeclarationOptions {
  /** Vitest's per-test timeout: {@link NO_SPAN_GUARD} (TEST-SPEC S-3). */
  readonly timeout: number;
}

/**
 * Where {@link declareProductTests} sends each declaration: Vitest's `test`
 * by default, or a recorder (S-3's pre-product check, module header).
 */
export type ProductTestDeclarer = (
  name: string,
  options: ProductTestDeclarationOptions,
  fn: () => Promise<void>,
) => void;

/**
 * Declare registered product-facing tests as Vitest tests against the built
 * product — through `declare`, Vitest's `test` unless a recorder is given
 * (module header). Each is declared with no Vitest timeout
 * ({@link NO_SPAN_GUARD}; TEST-SPEC S-3): a test is a span over its
 * invocations and harness steps, bounded by their own guards — the
 * certification runner applies none either. Each body runs inside its own
 * invocation context (helpers/product-invocations.ts), as it does under the
 * certification runner, so the workspace builder's undeclared-staging guard
 * sees the body's first product invocation wherever it happens.
 */
export function declareProductTests(
  entries: readonly ProductTestEntry[],
  declare: ProductTestDeclarer = test,
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
    declare(
      `${entry.id} ${entry.title}`,
      { timeout: NO_SPAN_GUARD },
      async () => {
        await runProductTestBody(entry.id, () =>
          entry.run(builtProductBinding()),
        );
      },
    );
  }
}
