import { defineConfig } from "vitest/config";

// Test harness program configuration (TEST-SPEC.md 18; IMPLEMENTATION.md:
// Vitest). The harness is a separate program from the product: it lives
// entirely under test/, never imports product code, and drives the built
// `xspec` executable only as a subprocess (TEST-SPEC H-2).
//
// Projects — selected per suite/CI leg via `--project` (see the package.json
// scripts and .github/workflows/ci.yml):
//
//   suite    test/suite/    product-facing tests and property/fuzz tests
//                           (TEST-SPEC sections 1–16)
//   self     test/self/     harness self-tests and the certification runner
//                           (TEST-SPEC 17; CERTIFICATIONS.md)
//   windows  test/windows/  the E-6 platform-sensitive subset, run on the
//                           Windows CI leg; the Linux leg's representative-
//                           fixture outputs for the E-6 byte-identity
//                           comparison are exchanged through the directory
//                           named by the XSPEC_E6_EXCHANGE_DIR environment
//                           variable (written on Linux, read on Windows)
//   local    test/local/    local-only tests (TEST-SPEC E-2) — a separately
//                           invocable suite, never run in CI and never marked
//                           skipped; this set is currently empty
//
// The module channel (TEST-SPEC H-2, C-2, E-1; SPEC 7.6) takes its two inputs
// from the environment, which CI sets at setup and AGENTS.md shows how to set
// locally:
//
//   XSPEC_PACKAGE_DIR        the product's package directory, exactly as
//                            distributed, beside the built executable: the
//                            directory .github/scripts/pack-package.sh prints.
//                            Unset, no package directory is given (H-8, S-7).
//   XSPEC_NODE_RELEASES_DIR  the Node.js releases E-1 lists, which
//                            test/node-releases.json pins and
//                            .github/scripts/provision-node-releases.sh
//                            installs there, each release's executable at
//                            v<version>/bin/node. A listed release missing
//                            there is a harness error for every run needing it
//                            (E-1, H-11, S-10), never a skip.
//
// Shared harness machinery (H-3 output adapters, the workspace builder, the
// subprocess and TypeScript-tooling drivers, the P-2/P-7 oracles) belongs in
// test/helpers/. Certification fixture products (CERTIFICATIONS.md) and
// consumer fixture projects belong in test/fixtures/.
//
// Harness-only dependencies are the devDependencies of package.json (the
// product's runtime dependencies are its `dependencies`): the stock MDX 3
// parser S-9 judges fixture well-formedness with — `micromark` with
// `micromark-extension-mdxjs`, `mdast-util-from-markdown` with
// `mdast-util-mdx` (JSX tag matching lives in that mdast layer, not in the
// tokenizer) — is declared there in its own right so the check stays
// independent of the product's `remark-mdx` (TEST-SPEC S-9). Likewise the
// harness's TypeScript: `typescript-5.9.3`, an npm alias of
// `typescript@5.9.3` pinned exactly — the release SPEC.md 14.20 fixes — is the
// parser S-9 checks TypeScript fixtures and draws with and the standard
// tooling of section 4 (H-2; T1.4-5: never a later release). npm cannot
// declare one package name in both dependency sets, so the alias is what
// keeps that dependency the harness's own, independent of the product's
// `typescript`; harness code imports `typescript-5.9.3`, never `typescript`.
//
// Hang guards (TEST-SPEC S-3; test/helpers/hang-guards.ts): no test carries a
// framework timeout of its own — every project's `testTimeout` is 0, under
// which Vitest arms no timer — since a test is a span over the invocations
// and harness steps it runs, bounded by their own guards, and a fixed
// per-test timeout would be a span guard fixed apart from what it spans.
//
// Paths below are relative to the repository root: the npm scripts are the
// canonical entry points and always run from the package root.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "suite",
          include: ["test/suite/**/*.test.ts"],
          testTimeout: 0,
        },
      },
      {
        test: {
          name: "self",
          include: ["test/self/**/*.test.ts"],
          testTimeout: 0,
        },
      },
      {
        test: {
          name: "windows",
          include: ["test/windows/**/*.test.ts"],
          testTimeout: 0,
        },
      },
      {
        test: {
          name: "local",
          include: ["test/local/**/*.test.ts"],
          testTimeout: 0,
        },
      },
    ],
  },
});
