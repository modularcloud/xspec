// TEST-SPEC §12.6 (`xspec version`) — SUITE-57: T12.6-1, T12.6-2.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes and stream separation (H-5), and rejects a product
// only via diagnosed assertion failures (H-8).
//
// SPEC 12.6: `version` reports the product version and the machine-interface
// version. The surface is JSON-only — a single JSON document, in the form of
// 12.7, is its only output form, with or without `--json` (12.0). Both values
// are fixed per build; the machine-interface version is `1`, reported exactly
// as the string `"1"` (12.7 pins the document form `{"product",
// "interface"}`, both strings). `version` is workspace-independent: it
// consults no workspace and no configuration — `--config` is accepted (12.0)
// and not consulted — answers identically in any working directory, no
// discoverable workspace, missing configuration, and invalid configuration
// included, and cannot fail for workspace or configuration reasons:
// configuration-error precedence (14.14) does not reach it. Usage errors
// keep exit 2 (12.0).
//
// Conservative operationalizations (noted per H-3/H-4/H-5):
// - The document is decoded through the form-exact 12.7 decoder
//   (helpers/adapters/forms.ts `decodeVersionDocument`): exactly the members
//   `{"product", "interface"}`, both strings — 12.7 fixes the document form
//   of 12.6, so no adapter may re-map it (H-3); `interface` exactly `"1"` is
//   T12.6-1's value assertion.
// - "Fixed per build" is asserted as value identity across repeated
//   invocations of the one build under test (H-4, product-to-itself): the
//   decoded `product` and `interface` values — not whole-document bytes,
//   which T12.0-7's determinism sweep owns — are identical across the bare,
//   flagged, and repeated runs. Fixedness across *different* builds is
//   unobservable to a single product binding and is not asserted.
// - T12.6-1's unknown-flag arm runs WITHOUT `--json`: 12.6 is a JSON-only
//   surface, so JSON output is in effect for the erroneous invocation
//   (12.0), the 12.7 error document is the entire stdout, and the usage
//   diagnostic is standard-error content (T12.0-2) — discriminating against
//   a product that reports the error as bare stderr text with empty stdout.
//   Error-finding values (`code`/`path` null for a plain usage error) are
//   T12.7-3's assertions, not repeated here.
// - T12.6-2's byte-identity: the valid-workspace answer is the reference —
//   asserted once to be a single JSON document in the version form — and
//   every other context's entire stdout must be byte-identical to it (H-4,
//   product-to-itself), so a context-dependent answer fails at the byte
//   compare and a context-dependent refusal fails at the exit assertion.
// - T12.6-2's no-configuration context pins its staging premise in-test:
//   `build` in that directory must fail as a 14.14 configuration error
//   (T7-1's contract) — otherwise a configuration file accidentally
//   reachable by upward search (H-1 makes the temporary root's ancestors
//   hold none) would silently weaken the context into a configured one.
// - T12.6-2's discriminating pair: the invalid-configuration fixture is
//   proven genuinely invalid by `expectConfigurationError` on `build` (exit
//   2, stable code `configuration-error`; the shared 14.14 protocol) — the
//   very fixture `version` must answer from at exit 0, so a product routing
//   configuration-error precedence through `version` fails its exit
//   assertion against a fixture whose invalidity is asserted, not assumed.

import { decodeVersionDocument } from "../../helpers/adapters/index.js";
import {
  assertBytesEqual,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import type { ProductBinding, RunResult } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { WorkspaceDecl } from "../../helpers/workspace.js";
import {
  assertSameJson,
  expectConfigurationError,
  expectErrorDocument,
  expectExit,
} from "./support.js";

// ---------------------------------------------------------------------------
// Shared fixture material
// ---------------------------------------------------------------------------

// The canonical valid configuration (SPEC 7): exactly one spec group.
const SPECS_ONLY_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`;

// The invalid configuration: SPECS_ONLY_CONFIG with exactly one deviation —
// an unknown top-level key (14.14; the T7-2 single-deviation discipline), so
// `build`'s refusal is attributable to the configuration alone while the
// staged source stays valid.
const INVALID_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  bogus: true
})
`;

// A malformed `--config` target: not well-formed TypeScript, so any product
// that consults the named file at all fails on it (14.14) — `version` must
// accept the flag and never consult the file (SPEC 12.6, 12.0).
const MALFORMED_CONFIG_TARGET = "this is ( not TypeScript {{{\n";

/** A minimal single-section source: one node `a` under the file root. */
const VALID_SOURCE = '<S id="a">\nText for a.\n</S>\n';

/** Stage a fresh workspace, run `body`, dispose (H-1). */
async function withWorkspace<T>(
  decl: WorkspaceDecl,
  body: (workspace: TestWorkspace) => Promise<T>,
): Promise<T> {
  const workspace = await TestWorkspace.create(decl);
  try {
    return await body(workspace);
  } finally {
    await workspace.dispose();
  }
}

/**
 * Run `version` expecting the JSON-only answer: exit 0 exactly (a success
 * report, SPEC 12.0) with a single JSON document as the entire stdout — the
 * surface's only output form, with or without `--json` (SPEC 12.6, H-5).
 * Returns the raw result for byte comparison; decoding stays with callers.
 */
async function expectVersionAnswer(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  context: string,
): Promise<RunResult> {
  const result = await expectExit(
    product,
    workspace,
    argv,
    0,
    `${context} — \`version\` is an informational report, exit 0; it cannot ` +
      `fail for workspace or configuration reasons (SPEC 12.6, 12.0)`,
  );
  parseJsonStdout(
    result,
    `${context} — 12.6 is a JSON-only surface: a single JSON document is ` +
      `its entire standard output, with or without --json (SPEC 12.6, ` +
      `12.0, H-5)`,
  );
  return result;
}

// ---------------------------------------------------------------------------
// T12.6-1 — surface and values
// ---------------------------------------------------------------------------

const T12_6_1 = defineProductTest({
  id: "T12.6-1",
  title:
    "surface and values: `version` emits, with and without `--json`, a " +
    "single JSON document as its entire stdout in the literal 12.7 form — " +
    '{"product", "interface"} exactly, both strings, `interface` exactly ' +
    '"1" (form-exact, H-3) — with both values identical across invocations ' +
    "of one build (fixed per build); usage errors keep exit 2: an unknown " +
    "flag on `version` yields the 12.7 error document as the entire stdout " +
    "with a standard-error diagnostic (SPEC 12.6, 12.7, 12.0)",
  run: async (product) => {
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          "specs/A.mdx": VALID_SOURCE,
        },
      },
      async (workspace) => {
        // Bare form: the single JSON document is the surface's only output
        // form (SPEC 12.6), decoded form-exactly (H-3).
        const bareContext = "T12.6-1 `version`";
        const bare = await expectVersionAnswer(
          product,
          workspace,
          ["version"],
          bareContext,
        );
        const bareDoc = decodeVersionDocument(
          parseJsonStdout(bare, bareContext),
          bareContext,
        );
        if (bareDoc.interface !== "1") {
          fail(
            `${bareContext}: the machine-interface version is 1, reported ` +
              `exactly as the string "1" — the string form of 12.6's stated ` +
              `value (SPEC 12.6, 12.7); got ` +
              `${JSON.stringify(bareDoc.interface)}`,
          );
        }

        // Flagged form: `--json` is accepted and inert on a JSON-only
        // surface — the same document form at the same exit code (SPEC
        // 12.6, 12.0; the flag-parity compare is T12.0-1's).
        const flaggedContext = "T12.6-1 `version --json`";
        const flagged = await expectVersionAnswer(
          product,
          workspace,
          ["version", "--json"],
          flaggedContext,
        );
        const flaggedDoc = decodeVersionDocument(
          parseJsonStdout(flagged, flaggedContext),
          flaggedContext,
        );

        // Repeat invocation of the same build: both values are fixed per
        // build, so every invocation reports the identical values (SPEC
        // 12.6; H-4, product-to-itself).
        const repeatContext = "T12.6-1 `version` (repeat invocation)";
        const repeat = await expectVersionAnswer(
          product,
          workspace,
          ["version"],
          repeatContext,
        );
        const repeatDoc = decodeVersionDocument(
          parseJsonStdout(repeat, repeatContext),
          repeatContext,
        );

        assertSameJson(
          flaggedDoc,
          bareDoc,
          "T12.6-1: the product and machine-interface values with `--json` " +
            "vs without — both values are fixed per build, identical " +
            "across invocations of one build (SPEC 12.6; H-4, " +
            "product-to-itself)",
        );
        assertSameJson(
          repeatDoc,
          bareDoc,
          "T12.6-1: the product and machine-interface values across " +
            "repeated invocations — both values are fixed per build " +
            "(SPEC 12.6; H-4, product-to-itself)",
        );

        // Unknown flag: usage errors keep exit 2 (SPEC 12.6, 12.0). JSON
        // output is in effect — 12.6 is a JSON-only surface, no `--json`
        // needed — so the exit-2 invocation emits the 12.7 error document
        // as its entire stdout, the diagnostic riding stderr (T12.0-2;
        // error-finding values are T12.7-3's assertions).
        const errorContext = "T12.6-1 `version --definitely-not-a-flag`";
        const errored = await expectExit(
          product,
          workspace,
          ["version", "--definitely-not-a-flag"],
          2,
          `${errorContext} — an unknown flag is a usage error, exit 2 ` +
            `(SPEC 12.6, 12.0)`,
        );
        expectErrorDocument(
          errored,
          `${errorContext} — 12.6 is a JSON-only surface, so JSON output ` +
            `is in effect for the erroneous invocation and the 12.7 error ` +
            `document is the entire stdout (SPEC 12.0, 12.7, T12.0-2)`,
        );
        if (errored.stderrBytes.length === 0) {
          fail(
            `${errorContext}: usage error messages are standard-error ` +
              `content (SPEC 12.0, T12.0-2), but stderr is empty`,
          );
        }
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T12.6-2 — workspace independence
// ---------------------------------------------------------------------------

const T12_6_2 = defineProductTest({
  id: "T12.6-2",
  title:
    "workspace independence: byte-identical answers at exit 0 inside a " +
    "valid workspace, in a directory with no discoverable configuration " +
    "(where `build` exits 2, T7-1), with invalid configuration present, and " +
    "with `--config` naming a nonexistent and a malformed file — accepted, " +
    "never consulted; configuration-error precedence never reaches " +
    "`version`: the same invalid-configuration fixture makes `build` exit " +
    "2, the discriminating pair (SPEC 12.6, 14.14, 12.0; H-4 " +
    "product-to-itself)",
  run: async (product) => {
    // Context 1 — inside a valid workspace: the reference answer, asserted
    // once to be a single JSON document in the version form; every other
    // context's entire stdout must be byte-identical to these bytes (H-4).
    const referenceContext = "T12.6-2 `version` inside a valid workspace";
    const reference = await withWorkspace(
      {
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          "specs/A.mdx": VALID_SOURCE,
        },
      },
      async (workspace) => {
        const result = await expectVersionAnswer(
          product,
          workspace,
          ["version"],
          referenceContext,
        );
        // Form sanity on the reference only — the byte compares below carry
        // it to every other context; value pins ("1", fixedness) are
        // T12.6-1's.
        decodeVersionDocument(
          parseJsonStdout(result, referenceContext),
          referenceContext,
        );
        return result;
      },
    );

    const expectAnswerBytes = async (
      workspace: TestWorkspace,
      argv: readonly string[],
      context: string,
    ): Promise<void> => {
      const result = await expectVersionAnswer(
        product,
        workspace,
        argv,
        context,
      );
      assertBytesEqual(
        result.stdoutBytes,
        reference.stdoutBytes,
        `${context} — \`version\` answers identically in any working ` +
          `directory: no discoverable workspace, missing configuration, ` +
          `and invalid configuration included; byte-identical to the ` +
          `valid-workspace answer (SPEC 12.6; H-4, product-to-itself)`,
      );
    };

    // Contexts 2, 4, 5 — a directory with no discoverable configuration
    // (T7-1: the fresh temporary root's ancestors hold no xspec.config.ts),
    // also hosting the two `--config` targets: a nonexistent path and a
    // malformed file, each accepted and never consulted (SPEC 12.6, 12.0).
    await withWorkspace(
      { files: { "malformed-config.ts": MALFORMED_CONFIG_TARGET } },
      async (workspace) => {
        // Staging premise, pinned in-test: no configuration is reachable
        // here — the other commands exit 2 as a 14.14 configuration error
        // (T7-1). A configuration file accidentally reachable by upward
        // search would otherwise silently weaken this context.
        await expectConfigurationError(
          product,
          workspace,
          ["build"],
          "T12.6-2 `build --json` in the no-configuration directory — the " +
            "context's staging premise: no xspec.config.ts is reachable by " +
            "upward search, so the other commands exit 2 there (SPEC 14.14, " +
            "7, T7-1)",
        );

        await expectAnswerBytes(
          workspace,
          ["version"],
          "T12.6-2 `version` in a directory with no discoverable " +
            "configuration",
        );
        await expectAnswerBytes(
          workspace,
          ["version", "--config", "missing/xspec.config.ts"],
          "T12.6-2 `version --config missing/xspec.config.ts` (a " +
            "nonexistent file — accepted, never consulted: a product " +
            "consulting it would fail to read it, SPEC 12.6, 12.0)",
        );
        await expectAnswerBytes(
          workspace,
          ["version", "--config", "malformed-config.ts"],
          "T12.6-2 `version --config malformed-config.ts` (a malformed " +
            "file — accepted, never consulted: a product consulting it " +
            "would refuse it as 14.14, SPEC 12.6, 12.0)",
        );
      },
    );

    // Context 3 — invalid configuration present, plus the discriminating
    // pair: `build` exits 2 as a configuration error on the very fixture
    // `version` must answer from — configuration-error precedence (14.14)
    // never reaches `version` (SPEC 12.6).
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": INVALID_CONFIG,
          "specs/A.mdx": VALID_SOURCE,
        },
      },
      async (workspace) => {
        await expectAnswerBytes(
          workspace,
          ["version"],
          "T12.6-2 `version` with invalid configuration present",
        );
        await expectConfigurationError(
          product,
          workspace,
          ["build"],
          "T12.6-2 `build --json` on the same invalid-configuration " +
            "fixture — the discriminating pair: the configuration is " +
            "genuinely invalid (14.14, exit 2) on the very fixture " +
            "`version` answers from at exit 0 (SPEC 12.6, 14.14)",
        );
      },
    );
  },
});

/** TEST-SPEC §12.6, in canonical ID order (SUITE-57). */
export const section126Tests: readonly ProductTestEntry[] = [T12_6_1, T12_6_2];
