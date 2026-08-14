// TEST-SPEC §11.6 (`xspec inventory`) — SUITE-56: T11.6-1 (T11.6-2..T11.6-4
// register here as they are implemented).
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), and rejects a product only via diagnosed
// assertion failures (H-8). SPEC 11: `inventory` is JSON-only — a single JSON
// document is its only output form, with or without `--json` — in the
// form-exact 12.7 inventory document form (H-3), so every invocation below
// runs bare (one arm additionally with `--json`, asserting the two forms
// carry the same information, SPEC 11) and its stdout decodes through the
// scoped form-exact decoders `decodeInventoryAnchoring` and
// `decodeInventoryFindings` (the full inventory form is pinned across the
// T11.6-* tests as they land).
//
// T11.6-1 — anchoring (SPEC 11.6, 12.0). The workspace root and the
// configuration file are identified relative to the invocation working
// directory — pure invocation input — in the canonical spelling: ascent
// segments each spelled `..`, then descent segments, joined with `/` on
// every platform, no `.` segments, no trailing separator, the working
// directory itself spelled `.`. Asserted byte-exactly:
//
// - from the workspace root: `root` `.`, `config` `xspec.config.ts`, in the
//   flag-less and the `--json` form alike (same information, SPEC 11);
// - from nested `a/b`: `root` `../..`, `config` `../../xspec.config.ts`
//   (upward search, SPEC 7);
// - from a sibling directory with `--config`: ascent-then-descent
//   (`../work/…`), and from a deeper sibling multi-`..` ascent then descent
//   (`../../work/…`) — under a relative and under an absolute `--config`
//   spelling alike: the anchoring is a function of the working directory and
//   the identified file, never an echo of the argument's spelling (SPEC
//   11.6, 12.0);
// - drive-mismatch arm, Linux side (E-6): from a working directory in an
//   unrelated temporary tree — the nearest common ancestor lies outside both
//   trees, the closest Linux staging to a cross-drive invocation — the
//   anchoring is still the pure relative ascent-then-descent form: on the
//   Linux leg no absolute form ever appears (the platform admits a relative
//   path between any two directories; the absolute, drive-qualified form is
//   the Windows leg's sole case, staged by the Windows-subset arm in
//   test/windows/). The expected spelling is computed harness-side by 11.6's
//   own rule over the realpath'd directory pair (self-checked against fixed
//   vectors before any product invocation), and the invocation is repeated:
//   byte-identical stdout, deterministic per invocation (SPEC 12.0; a
//   product-to-itself comparison, H-4).
//
// Every answer here is complete and finding-free on a valid workspace —
// `findings` decodes to [] and the exit code is 0 (SPEC 12.0, 11.6).
//
// Certification note: CERTIFICATIONS.md's Exclusions list T11.6-1 through
// T11.6-4 ("`inventory` and `version`"), so no fixture executes these
// bodies; the anchoring arms are positive and byte-asserted per that entry.

import * as fsp from "node:fs/promises";
import * as path from "node:path";
import type { PathValue } from "../../helpers/adapters/index.js";
import {
  decodeInventoryAnchoring,
  decodeInventoryFindings,
  renderPathValue,
} from "../../helpers/adapters/index.js";
import {
  assertBytesEqual,
  assertExitCode,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import type { ProductBinding, RunResult } from "../../helpers/subprocess.js";
import { runProduct } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";

// --- fixture ------------------------------------------------------------------
//
// A minimal valid workspace: one spec group, one well-formed source. The
// inventory parses no sources (SPEC 11.6), so the anchoring depends on none
// of this — the staging keeps the workspace valid so every answer is the
// complete, finding-free, exit-0 case (T11.6-4 owns the imperfect-workspace
// arms).

const ANCHOR_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`;

const ANCHOR_SOURCE = '<S id="racine">\nAncrage — contenu stable.\n</S>\n';

const CONFIG_FILE = "xspec.config.ts";

// --- SPEC 11.6's canonical relative spelling (harness-side) -------------------

/**
 * SPEC 11.6's canonical relative spelling from an absolute working directory
 * to an absolute target: the segments ascending to the nearest common
 * ancestor, each spelled `..`, then the segments descending to the target,
 * joined with `/` — no `.` segments, no trailing separator — and the working
 * directory itself spelled `.`. Both inputs must be absolute, symlink-free
 * paths (the caller realpaths them): the product observes its physical
 * working directory, so the harness computes expectations from the same
 * physical pair.
 */
function canonicalRelativeSpelling(fromDir: string, target: string): string {
  const split = (abs: string): string[] =>
    abs.split(path.sep).filter((segment) => segment !== "");
  const fromParts = split(fromDir);
  const toParts = split(target);
  let common = 0;
  while (
    common < fromParts.length &&
    common < toParts.length &&
    fromParts[common] === toParts[common]
  ) {
    common += 1;
  }
  const segments = [
    ...Array<string>(fromParts.length - common).fill(".."),
    ...toParts.slice(common),
  ];
  return segments.length === 0 ? "." : segments.join("/");
}

/**
 * Fixture self-check (harness-side, before any product invocation): the
 * spelling rule above must reproduce SPEC 11.6's stated forms on fixed
 * vectors, and a computed expectation must be a pure relative
 * ascent-then-descent spelling — never absolute, no `.` segments, no
 * trailing separator. A failure here is a harness-arithmetic defect, never a
 * product failure.
 */
function selfCheckSpellingRule(): void {
  const vectors: readonly [string, string, string][] = [
    ["/t/ws", "/t/ws", "."],
    ["/t/ws/a/b", "/t/ws", "../.."],
    ["/t/ws/a/b", "/t/ws/xspec.config.ts", "../../xspec.config.ts"],
    ["/t/side", "/t/work", "../work"],
    ["/t/side/deep", "/t/work/xspec.config.ts", "../../work/xspec.config.ts"],
    ["/t/ws", "/t/ws/xspec.config.ts", "xspec.config.ts"],
  ];
  for (const [from, to, expected] of vectors) {
    const actual = canonicalRelativeSpelling(from, to);
    if (actual !== expected) {
      fail(
        `§11.6 fixture self-check — the harness-side 11.6 spelling rule ` +
          `computes ${JSON.stringify(actual)} from ${JSON.stringify(from)} ` +
          `to ${JSON.stringify(to)}, expected ${JSON.stringify(expected)} ` +
          `(a harness-arithmetic defect, not a product failure)`,
      );
    }
  }
}

/** Self-check a computed expectation's shape (see selfCheckSpellingRule). */
function selfCheckComputedSpelling(spelling: string, what: string): void {
  const segments = spelling.split("/");
  const pure =
    spelling !== "" &&
    !path.isAbsolute(spelling) &&
    !spelling.endsWith("/") &&
    segments.every((segment) => segment !== "" && segment !== ".") &&
    // Ascent before descent: no `..` may follow a non-`..` segment.
    segments.every(
      (segment, index) =>
        segment !== ".." || segments.slice(0, index).every((s) => s === ".."),
    );
  if (!pure) {
    fail(
      `§11.6 fixture self-check — ${what}: the computed expected spelling ` +
        `${JSON.stringify(spelling)} is not a pure relative ` +
        `ascent-then-descent form (a harness-arithmetic defect, not a ` +
        `product failure)`,
    );
  }
}

// --- shared assertion ---------------------------------------------------------

interface AnchoringExpectation {
  /** Expected `root` member, byte-exact (SPEC 11.6). */
  readonly root: string;
  /** Expected `config` member, byte-exact (SPEC 11.6). */
  readonly config: string;
}

function assertAnchoringMember(
  actual: PathValue,
  expected: string,
  member: string,
  context: string,
): void {
  if (actual === expected) return;
  fail(
    `${context}: the inventory's ${member} anchoring must be exactly ` +
      `${JSON.stringify(expected)} — the canonical relative spelling from ` +
      `the invocation working directory: ascent \`..\` segments then ` +
      `descent segments joined with "/", no "." segments, no trailing ` +
      `separator, the working directory itself "."; on the Linux leg no ` +
      `absolute form ever appears (SPEC 11.6, 12.7, E-6); got ` +
      `${renderPathValue(actual)}`,
  );
}

/**
 * Run `inventory` from `cwd` and assert the T11.6-1 contract: exit 0 exactly
 * (a complete, finding-free answer, SPEC 12.0/11.6; H-5); exactly one JSON
 * document as the entire stdout (JSON-only, SPEC 11); `findings` decoding to
 * [] (form-exact, 12.7); and the `root`/`config` anchoring byte-exact.
 */
async function expectAnchoredInventory(
  product: ProductBinding,
  cwd: string,
  argv: readonly string[],
  expected: AnchoringExpectation,
  context: string,
): Promise<RunResult> {
  const result = await runProduct(product, { cwd, argv });
  assertExitCode(
    result,
    0,
    `${context} — a complete, finding-free inventory answer exits 0 ` +
      `(SPEC 12.0, 11.6)`,
  );
  const doc = parseJsonStdout(
    result,
    `${context} — inventory is JSON-only: a single JSON document is its ` +
      `only output form, with or without --json (SPEC 11, 12.0)`,
  );
  const findings = decodeInventoryFindings(doc, context);
  if (findings.length !== 0) {
    fail(
      `${context}: the staged workspace is valid and the inventory parses ` +
        `no sources, so the answer is finding-free — findings [] (SPEC ` +
        `11.6, 12.7); got ${String(findings.length)} finding(s), first: ` +
        `${JSON.stringify(findings[0]?.message)}`,
    );
  }
  const anchoring = decodeInventoryAnchoring(doc, context);
  assertAnchoringMember(anchoring.root, expected.root, "`root`", context);
  assertAnchoringMember(anchoring.config, expected.config, "`config`", context);
  return result;
}

// --- T11.6-1 ------------------------------------------------------------------

const T11_6_1 = defineProductTest({
  id: "T11.6-1",
  title:
    "inventory anchoring: `root` and `config` are identified relative to the invocation working directory in the canonical spelling — from the workspace root `.` and `xspec.config.ts` (flag-less and `--json` forms carrying the same information, JSON-only), from nested `a/b` `../..` and `../../xspec.config.ts`, from sibling directories with `--config` the ascent-`..`-then-descent form joined with `/` (multi-segment ascent and descent included), no `.` segments, no trailing separator — byte-exact, a pure function of invocation input whatever the `--config` spelling (relative or absolute); drive-mismatch arm, Linux side (E-6): from an unrelated directory tree the anchoring is still the pure relative form — no absolute form ever appears on the Linux leg — and repeated invocations are byte-identical, deterministic per invocation; every answer complete and finding-free at exit 0 (SPEC 11.6, 12.7, 12.0, 11)",
  run: async (product) => {
    selfCheckSpellingRule();
    const workspace = await TestWorkspace.create({
      files: {
        [CONFIG_FILE]: ANCHOR_CONFIG,
        "specs/a.mdx": ANCHOR_SOURCE,
      },
    });
    try {
      // --- from the workspace root: `.` / `xspec.config.ts`, both forms.
      // SPEC 11: inventory is JSON-only — the flag-less and `--json`
      // invocations carry the same information; asserting both byte-exactly
      // against the same expected anchoring realizes that parity for the
      // anchoring members (byte-identity of the two stdouts is not asserted,
      // SPEC.md not requiring it).
      const atRoot: AnchoringExpectation = {
        root: ".",
        config: CONFIG_FILE,
      };
      await expectAnchoredInventory(
        product,
        workspace.root,
        ["inventory"],
        atRoot,
        "T11.6-1 — `inventory` from the workspace root (flag-less): the " +
          "working directory itself is spelled `.` and the configuration " +
          "file is the pure descent `xspec.config.ts` (SPEC 11.6)",
      );
      await expectAnchoredInventory(
        product,
        workspace.root,
        ["inventory", "--json"],
        atRoot,
        "T11.6-1 — `inventory --json` from the workspace root: the same " +
          "anchoring information as the flag-less form (JSON-only, SPEC 11, " +
          "11.6)",
      );

      // --- from nested `a/b`: `../..` / `../../xspec.config.ts` (the
      // configuration located by upward search from the working directory,
      // SPEC 7; working-directory-dependence is pure invocation input, 12.0).
      await workspace.dir("a/b");
      await expectAnchoredInventory(
        product,
        workspace.path("a/b"),
        ["inventory"],
        { root: "../..", config: "../../xspec.config.ts" },
        "T11.6-1 — `inventory` from the nested working directory a/b: pure " +
          "ascent, each segment spelled `..`, joined with `/` (SPEC 11.6, 7)",
      );

      // --- from sibling directories with `--config`: ascent `..` segments
      // then descent segments. The siblings live beside the workspace root
      // in the fixture's own temporary directory (the builder's layout:
      // root is a `work/` subdirectory of tempRoot), so the expected
      // spellings are composed from the root's real basename. The physical
      // root anchors the absolute `--config` spelling below, so every
      // product-side path resolution agrees with the harness's expectation
      // arithmetic whatever symlinks the temp prefix holds.
      const rootBase = path.basename(workspace.root);
      const physicalRoot = await fsp.realpath(workspace.root);
      const absoluteConfig = path.join(physicalRoot, CONFIG_FILE);
      const side = path.join(workspace.tempRoot, "side");
      const deep = path.join(side, "creuse");
      await fsp.mkdir(deep, { recursive: true });

      await expectAnchoredInventory(
        product,
        side,
        ["inventory", "--config", `../${rootBase}/${CONFIG_FILE}`],
        {
          root: `../${rootBase}`,
          config: `../${rootBase}/${CONFIG_FILE}`,
        },
        "T11.6-1 — `inventory --config` from a sibling directory: one " +
          "ascent segment then the descent segments, joined with `/`, no " +
          "`.` segments, no trailing separator (SPEC 11.6)",
      );
      await expectAnchoredInventory(
        product,
        deep,
        ["inventory", "--config", `../../${rootBase}/${CONFIG_FILE}`],
        {
          root: `../../${rootBase}`,
          config: `../../${rootBase}/${CONFIG_FILE}`,
        },
        "T11.6-1 — `inventory --config` from a deeper sibling directory: a " +
          "multi-segment `..` ascent run then descent, joined with `/` " +
          "(SPEC 11.6)",
      );
      // The same working directory with the `--config` value spelled
      // absolutely: the anchoring identifies the same file relative to the
      // same working directory, so the spelling is unchanged — pure
      // invocation input (working directory + identified file), never an
      // echo of the argument (SPEC 11.6, 12.0: `--config` is a filesystem
      // path resolved against the working directory).
      await expectAnchoredInventory(
        product,
        deep,
        ["inventory", "--config", absoluteConfig],
        {
          root: `../../${rootBase}`,
          config: `../../${rootBase}/${CONFIG_FILE}`,
        },
        "T11.6-1 — `inventory --config <absolute path>` from the deeper " +
          "sibling: the anchoring stays the canonical relative spelling — " +
          "a function of the working directory and the identified file, " +
          "not of the argument's spelling (SPEC 11.6, 12.0)",
      );

      // --- drive-mismatch arm, Linux side (E-6): an unrelated temporary
      // tree as the working directory — the nearest common ancestor lies
      // outside both trees. The platform admits a relative path between any
      // two directories, so the anchoring is still the pure
      // ascent-then-descent relative form: no absolute form ever appears on
      // the Linux leg (the absolute, drive-qualified spelling is the
      // Windows leg's sole case, test/windows/). The expectation is
      // computed by 11.6's own rule over the realpath'd pair (self-checked
      // above and shape-checked here), and the invocation is repeated
      // byte-identically: the anchoring is deterministic per invocation
      // (SPEC 12.0; product-to-itself, H-4).
      const farTree = await TestWorkspace.create({});
      try {
        const farCwd = await fsp.realpath(farTree.root);
        const expectedFarRoot = canonicalRelativeSpelling(farCwd, physicalRoot);
        selfCheckComputedSpelling(
          expectedFarRoot,
          "the unrelated-tree arm's expected `root`",
        );
        const farExpectation: AnchoringExpectation = {
          root: expectedFarRoot,
          config: `${expectedFarRoot}/${CONFIG_FILE}`,
        };
        const farArgv = ["inventory", "--config", absoluteConfig];
        const farContext =
          "T11.6-1 — `inventory` from an unrelated directory tree (the " +
          "E-6 drive-mismatch arm's Linux side): the nearest common " +
          "ancestor lies outside both trees, and the anchoring is still " +
          "the pure relative ascent-then-descent form — no absolute form " +
          "ever appears on the Linux leg (SPEC 11.6, 12.0, E-6)";
        const first = await expectAnchoredInventory(
          product,
          farCwd,
          farArgv,
          farExpectation,
          farContext,
        );
        const second = await expectAnchoredInventory(
          product,
          farCwd,
          farArgv,
          farExpectation,
          `${farContext} — repeated invocation`,
        );
        assertBytesEqual(
          second.stdoutBytes,
          first.stdoutBytes,
          "T11.6-1 — the anchoring is invocation-anchored content: a pure " +
            "function of invocation input, deterministic per invocation, so " +
            "repeating the identical invocation from the identical working " +
            "directory yields byte-identical stdout (SPEC 12.0, 11.6; a " +
            "product-to-itself comparison, H-4)",
        );
      } finally {
        await farTree.dispose();
      }
    } finally {
      await workspace.dispose();
    }
  },
});

export const section116Tests: readonly ProductTestEntry[] = [T11_6_1];
