// TEST-SPEC §11.6 (`xspec inventory`) — SUITE-56: T11.6-1, T11.6-2
// (T11.6-3..T11.6-4 register here as they are implemented).
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), and rejects a product only via diagnosed
// assertion failures (H-8). SPEC 11: `inventory` is JSON-only — a single JSON
// document is its only output form, with or without `--json` — in the
// form-exact 12.7 inventory document form (H-3), so every invocation below
// runs bare (per-test arms additionally with `--json`, asserting the two
// forms carry the same information, SPEC 11) and its stdout decodes through
// the scoped form-exact decoders `decodeInventoryAnchoring`,
// `decodeInventoryFindings`, and `decodeInventoryResolvedMap` (the full
// inventory form is pinned across the T11.6-* tests as they land).
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
// T11.6-2 — configuration, sources, derived map (SPEC 11.6, 12.7, 7.3,
// 13.1). The resolved configuration view with every default and inferred
// kind explicit, every discovered source with its group memberships, and the
// per-spec-source derived map — all determined by configuration and
// discovery, asserted before any build has ever run. Four workspaces:
//
// - defaults: `markdown` key absent → the view reports `{"emit": false,
//   "outDir": null}` (7.3) and `derived[*].markdown` null for every source
//   (emission disabled by absence); a profile spelling only its required
//   fields → `targets` "leaves", `edgeKinds` all three, `boundaryKind`
//   explicit though inferred (the boundary group name is unambiguous),
//   `targetTags` null; a rule spelling only its required fields → `kinds`
//   all three, each group selector's `kind` explicit though inferred; group
//   references inside the profile and rule stay configured names resolving
//   against the reported group list; a file matched by two spec groups
//   carries both memberships (7.1) in configuration order (11.6); the whole
//   document asserted exactly, flag-less and `--json` forms against the same
//   expectation (same information, SPEC 11);
// - emission enabled, default destinations: `module` and `markdown` both
//   present for every `.mdx` source before any build has run (13.1/7.3 —
//   determined by configuration and discovery, never by what exists on
//   disk); beside them a spec-group file without the `.mdx` extension
//   (14.19 staged beside it, SPEC 7.1) is listed in `sources` with its
//   membership while its `module` and `markdown` are the stated
//   structural-absence null (11.6/13.1/12.7) — and the answer stays
//   complete, finding-free, exit 0: the 14.19 finding is reported where its
//   condition assigns it, never here (11.6);
// - emission redirected: `markdown.outDir` echoes in the view and every
//   emit destination lies under it, preserving workspace-relative paths
//   (7.3), nested source included;
// - emission disabled explicitly: `emit` false with `outDir` configured —
//   the view reports both, and `derived[*].markdown` is null for every
//   source (destinations exist exactly while emission is enabled, 7.3).
//
// `edgeKinds`/`kinds` element order is no pinned order (11.6 orders files/
// paths, groups, profiles, rules, and session files only), so those two
// members are compared as sets (sorted before the exact compare); every
// other list is asserted in its pinned order — sources/derived in byte order
// of workspace-relative path, groups/profiles/rules in configuration order.
//
// Every answer here is complete and finding-free — `findings` decodes to []
// and the exit code is 0 (SPEC 12.0, 11.6) — T11.6-1's workspaces being
// valid, and T11.6-2's 14.19 staging never being the inventory's finding.
//
// Certification note: CERTIFICATIONS.md's Exclusions list T11.6-1 through
// T11.6-4 ("`inventory` and `version`"), so no fixture executes these
// bodies; the anchoring, resolved-configuration, and derived-map arms are
// positive and byte-asserted per that entry.

import * as fsp from "node:fs/promises";
import * as path from "node:path";
import type {
  DependencyEdgeKind,
  GroupKind,
  InventoryConfigurationView,
  InventoryResolvedMap,
  PathValue,
} from "../../helpers/adapters/index.js";
import {
  decodeInventoryAnchoring,
  decodeInventoryFindings,
  decodeInventoryResolvedMap,
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
import { assertSameJson } from "./support.js";

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

// --- T11.6-2 ------------------------------------------------------------------
//
// Fixtures. Every configuration is statically literal (SPEC 7) and valid —
// a configuration error would preempt the inventory (14.14) — and no arm
// ever runs `build`: the configuration/sources/derived projection is
// determined by configuration and discovery alone (SPEC 11.6).

/**
 * Defaults workspace: `markdown` absent; two spec groups declared in an
 * order (`core` before `aux`) that differs from name byte order, so the
 * configuration-order contract has teeth; a profile and a rule spelling
 * only their required fields (SPEC 7.4, 7.5) so every default and inferred
 * kind must be made explicit in the view; `boundary`/selector group names
 * unambiguous, so their kinds MUST be inferred (7.4, 7.5).
 */
const RESOLVED_DEFAULTS_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    core: ["specs/core/**/*.mdx", "specs/shared/**/*.mdx"],
    aux: ["specs/aux/**/*.mdx", "specs/shared/**/*.mdx"]
  },
  code: {
    impl: ["src/**/*.ts"]
  },
  coverage: [
    {
      name: "socle",
      target: "core",
      boundary: "impl",
      mode: "direct"
    }
  ],
  policy: [
    {
      name: "cloison",
      type: "forbidden",
      from: { group: "aux" },
      to: { group: "core" }
    }
  ]
})
`;

/**
 * Emission enabled with the default next-to-source destinations (SPEC 7.3),
 * and the glob `specs/*` written extension-free so `specs/note.txt` is a
 * discovered spec-group file without the `.mdx` extension — the 14.19
 * staging beside the valid source (SPEC 7.1).
 */
const RESOLVED_EMIT_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/*"]
  },
  markdown: { emit: true }
})
`;

/** Emission redirected under `markdown.outDir` (SPEC 7.3). */
const RESOLVED_OUTDIR_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    docs: ["specs/**/*.mdx"]
  },
  markdown: { emit: true, outDir: "mdout" }
})
`;

/**
 * Emission disabled explicitly — `emit` false with `outDir` configured: the
 * view reports the complete definition while no path is a Markdown emit
 * destination (SPEC 7.3).
 */
const RESOLVED_DISABLED_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  markdown: { emit: false, outDir: "docsout" }
})
`;

/**
 * The three dependency edge kinds in byte order — the shape `edgeKinds` and
 * `kinds` normalize to for the set compare (SPEC 7.4/7.5: both default to
 * all three; 11.6 pins no element order for them).
 */
const ALL_EDGE_KINDS_SORTED: readonly DependencyEdgeKind[] = [
  "depends",
  "embeds",
  "references",
];

/**
 * Normalize the two set-valued members (`edgeKinds`, `kinds`) to byte-sorted
 * copies so `assertSameJson` compares them as sets: SPEC 11.6 orders files/
 * paths, groups, profiles, rules, and session files — not edge-kind lists —
 * so element order there is no contract. A duplicated or missing kind still
 * fails the exact compare (the normalized list's length changes). Every
 * other list is left exactly as reported: sources/derived arrive byte-
 * ordered (decoder-enforced) and groups/profiles/rules must arrive in
 * configuration order (asserted by the exact compare).
 */
function normalizeKindSets(map: InventoryResolvedMap): InventoryResolvedMap {
  return {
    ...map,
    configuration: {
      ...map.configuration,
      coverage: map.configuration.coverage.map((profile) => ({
        ...profile,
        edgeKinds: [...profile.edgeKinds].sort(),
      })),
      policy: map.configuration.policy.map((rule) => ({
        ...rule,
        kinds: [...rule.kinds].sort(),
      })),
    },
  };
}

/**
 * SPEC 11.6: "A group reference inside a profile or rule stays the
 * configured group name, resolving against the group list this same view
 * reports." Assert every profile's `target` (a spec group, 7.4) and
 * `boundary` (per its explicit `boundaryKind`) and every group selector
 * (per its explicit `kind`) name a group the view's own lists report.
 */
function assertGroupReferencesResolve(
  view: InventoryConfigurationView,
  context: string,
): void {
  const names: Record<GroupKind, ReadonlySet<string>> = {
    spec: new Set(view.specs.map((group) => group.name)),
    code: new Set(view.code.map((group) => group.name)),
  };
  const resolve = (name: string, kind: GroupKind, what: string): void => {
    if (names[kind].has(name)) return;
    fail(
      `${context}: ${what} is the configured group name ` +
        `${JSON.stringify(name)} and must resolve against the ${kind} group ` +
        `list this same view reports (SPEC 11.6) — reported ${kind} groups: ` +
        `${[...names[kind]].map((n) => JSON.stringify(n)).join(", ") || "none"}`,
    );
  };
  for (const profile of view.coverage) {
    resolve(profile.target, "spec", `profile "${profile.name}"'s target`);
    resolve(
      profile.boundary,
      profile.boundaryKind,
      `profile "${profile.name}"'s boundary`,
    );
  }
  for (const rule of view.policy) {
    for (const [side, selector] of [
      ["from", rule.from],
      ["to", rule.to],
    ] as const) {
      if ("group" in selector) {
        resolve(
          selector.group,
          selector.kind,
          `rule "${rule.name}"'s ${side} selector`,
        );
      }
    }
  }
}

/**
 * Run `inventory` from the workspace root and assert the T11.6-2 frame:
 * exit 0 exactly (a complete, finding-free answer — the findings a listed
 * file may bear, 14.19 included, are reported where their conditions assign
 * them, never here; SPEC 11.6, 12.0; H-5); exactly one JSON document as the
 * entire stdout (JSON-only, SPEC 11); `findings` decoding to [] (form-exact,
 * 12.7); the configuration/sources/derived projection decoding in the 12.7
 * member forms; and every group reference resolving against the reported
 * group list. Returns the decoded projection for the caller's exact-value
 * assertion.
 */
async function expectResolvedInventory(
  product: ProductBinding,
  cwd: string,
  argv: readonly string[],
  context: string,
): Promise<InventoryResolvedMap> {
  const result = await runProduct(product, { cwd, argv });
  assertExitCode(
    result,
    0,
    `${context} — a complete, finding-free inventory answer exits 0: the ` +
      `inventory parses no sources and meets no condition on these ` +
      `workspaces, and the findings a listed file may bear (14.19) are ` +
      `reported where their conditions assign them, never here (SPEC 11.6, ` +
      `12.0)`,
  );
  const doc = parseJsonStdout(
    result,
    `${context} — inventory is JSON-only: a single JSON document is its ` +
      `only output form, with or without --json (SPEC 11, 12.0)`,
  );
  const findings = decodeInventoryFindings(doc, context);
  if (findings.length !== 0) {
    fail(
      `${context}: the inventory answer is finding-free — findings [] ` +
        `(SPEC 11.6, 12.7: the only finding an inventory ever carries is ` +
        `condition 23, and no arm here corrupts the record); got ` +
        `${String(findings.length)} finding(s), first: ` +
        `${JSON.stringify(findings[0]?.message)}`,
    );
  }
  const map = decodeInventoryResolvedMap(doc, context);
  assertGroupReferencesResolve(map.configuration, context);
  return map;
}

const T11_6_2 = defineProductTest({
  id: "T11.6-2",
  title:
    'inventory configuration, sources, derived map: the resolved configuration view with every default and inferred kind explicit — `markdown` key absent resolving to {"emit": false, "outDir": null}; a defaulted profile reporting `targets` "leaves", `edgeKinds` all three, `boundaryKind` explicit though inferred, `targetTags` null; a defaulted rule reporting `kinds` all three with each group selector\'s `kind` explicit though inferred; group references inside profiles and rules staying configured names resolving against the reported group list — every discovered source with its group memberships (a two-group file carrying both, in configuration order); the derived map per spec source: generated-module path (13.1) and Markdown emit destination exactly while emission is enabled (default next-to-source and `markdown.outDir`-redirected placements alike), both present before any build has run — determined by configuration and discovery; a spec-group file without the `.mdx` extension (14.19 staged beside it) listed in `sources` while `module` and `markdown` are the stated structural-absence null; with emission disabled — the key absent, or `emit` false with `outDir` configured — `markdown` null for every source; every answer complete and finding-free at exit 0, the defaults workspace asserted in the flag-less and `--json` forms against one expectation (SPEC 11.6, 12.7, 7.3, 7.4, 7.5, 13.1, 12.0, 11)',
  run: async (product) => {
    // --- defaults workspace: every default and inferred kind explicit ------
    const defaults = await TestWorkspace.create({
      files: {
        [CONFIG_FILE]: RESOLVED_DEFAULTS_CONFIG,
        "specs/core/a.mdx": '<S id="alpha">\nNoyau.\n</S>\n',
        "specs/aux/b.mdx": '<S id="beta">\nAnnexe.\n</S>\n',
        "specs/shared/deux.mdx": '<S id="gamma">\nPartagé.\n</S>\n',
        "src/app.ts": "export const rien = 0;\n",
      },
    });
    try {
      const expected: InventoryResolvedMap = {
        configuration: {
          // Groups in configuration order (`core` before `aux` — byte order
          // would invert them), each with its complete glob list (11.6).
          specs: [
            {
              name: "core",
              globs: ["specs/core/**/*.mdx", "specs/shared/**/*.mdx"],
            },
            {
              name: "aux",
              globs: ["specs/aux/**/*.mdx", "specs/shared/**/*.mdx"],
            },
          ],
          code: [{ name: "impl", globs: ["src/**/*.ts"] }],
          // `markdown` key absent → {"emit": false, "outDir": null} (7.3,
          // 12.7).
          markdown: { emit: false, outDir: null },
          coverage: [
            {
              name: "socle",
              target: "core",
              // Every default and inferred kind explicit (11.6, 7.4):
              targetTags: null,
              targets: "leaves",
              boundary: "impl",
              boundaryKind: "code",
              mode: "direct",
              edgeKinds: ALL_EDGE_KINDS_SORTED,
            },
          ],
          policy: [
            {
              name: "cloison",
              type: "forbidden",
              // Group selectors with the inferred kind explicit (7.5, 12.7).
              from: { group: "aux", kind: "spec" },
              to: { group: "core", kind: "spec" },
              kinds: ALL_EDGE_KINDS_SORTED,
            },
          ],
        },
        // Every discovered source with its group memberships, in byte order
        // of workspace-relative path; the two-group file carries both
        // memberships in configuration order (7.1, 11.6).
        sources: [
          { path: "specs/aux/b.mdx", groups: [{ name: "aux", kind: "spec" }] },
          {
            path: "specs/core/a.mdx",
            groups: [{ name: "core", kind: "spec" }],
          },
          {
            path: "specs/shared/deux.mdx",
            groups: [
              { name: "core", kind: "spec" },
              { name: "aux", kind: "spec" },
            ],
          },
          { path: "src/app.ts", groups: [{ name: "impl", kind: "code" }] },
        ],
        // One entry per discovered spec source — the code source contributes
        // none — module path per 13.1; `markdown` null for every source
        // while emission is disabled by the absent key (7.3, 12.7).
        derived: [
          {
            source: "specs/aux/b.mdx",
            module: "specs/aux/b.xspec.ts",
            markdown: null,
          },
          {
            source: "specs/core/a.mdx",
            module: "specs/core/a.xspec.ts",
            markdown: null,
          },
          {
            source: "specs/shared/deux.mdx",
            module: "specs/shared/deux.xspec.ts",
            markdown: null,
          },
        ],
      };
      // Flag-less and `--json` forms against the same expectation: inventory
      // is JSON-only, the two invocations carrying the same information
      // (SPEC 11; byte-identity of the two stdouts is not asserted, SPEC.md
      // not requiring it).
      const flagless = await expectResolvedInventory(
        product,
        defaults.root,
        ["inventory"],
        "T11.6-2 — `inventory` (flag-less) on the defaults workspace: the " +
          "resolved view with every default and inferred kind explicit " +
          "(SPEC 11.6)",
      );
      assertSameJson(
        normalizeKindSets(flagless),
        expected,
        "T11.6-2 — the defaults workspace's configuration/sources/derived " +
          "projection: `markdown` absent resolving to emit-false/outDir-" +
          "null, the defaulted profile and rule fully explicit " +
          '(targetTags null, targets "leaves", boundaryKind and selector ' +
          "kinds inferred-but-explicit, edgeKinds/kinds all three), group " +
          "references staying configured names, the two-group file " +
          "carrying both memberships, and the derived map with `markdown` " +
          "null for every source (SPEC 11.6, 7.3, 7.4, 7.5, 13.1, 12.7)",
      );
      const withJson = await expectResolvedInventory(
        product,
        defaults.root,
        ["inventory", "--json"],
        "T11.6-2 — `inventory --json` on the defaults workspace: the same " +
          "information as the flag-less form (JSON-only, SPEC 11, 11.6)",
      );
      assertSameJson(
        normalizeKindSets(withJson),
        expected,
        "T11.6-2 — the `--json` form carries the same configuration/" +
          "sources/derived information as the flag-less form (SPEC 11, " +
          "11.6)",
      );
    } finally {
      await defaults.dispose();
    }

    // --- emission enabled, default destinations; 14.19 staged beside ------
    const emit = await TestWorkspace.create({
      files: {
        [CONFIG_FILE]: RESOLVED_EMIT_CONFIG,
        "specs/a.mdx": '<S id="seule">\nÉmise.\n</S>\n',
        // A spec-group file without the `.mdx` extension: discovered (the
        // extension-free glob matches it), invalid (14.19, SPEC 7.1) — a
        // finding of build/check, never of the inventory (11.6).
        "specs/note.txt": "pas une source xspec\n",
      },
    });
    try {
      const map = await expectResolvedInventory(
        product,
        emit.root,
        ["inventory"],
        "T11.6-2 — `inventory` with emission enabled (default destinations) " +
          "and a non-`.mdx` spec-group file staged beside the valid source " +
          "(SPEC 11.6, 7.3)",
      );
      assertSameJson(
        normalizeKindSets(map),
        {
          configuration: {
            specs: [{ name: "main", globs: ["specs/*"] }],
            // Absent `code`/`coverage`/`policy` keys mean no code groups,
            // no profiles, no rules: empty lists are [], never null (SPEC
            // 7, 12.7).
            code: [],
            markdown: { emit: true, outDir: null },
            coverage: [],
            policy: [],
          },
          sources: [
            {
              path: "specs/a.mdx",
              groups: [{ name: "main", kind: "spec" }],
            },
            // The non-`.mdx` file IS a discovered spec-group source: listed
            // with its membership (11.6 "every discovered source file").
            {
              path: "specs/note.txt",
              groups: [{ name: "main", kind: "spec" }],
            },
          ],
          derived: [
            // Module path and Markdown destination both present before any
            // build has run — determined by configuration and discovery
            // (11.6, 13.1); the default placement emits next to the source
            // (7.3, 13.2).
            {
              source: "specs/a.mdx",
              module: "specs/a.xspec.ts",
              markdown: "specs/a.md",
            },
            // The spec-group file without `.mdx` generates and emits
            // nothing (13.1): both structurally absent — the stated null,
            // never omission (11.6, 12.7).
            { source: "specs/note.txt", module: null, markdown: null },
          ],
        } satisfies InventoryResolvedMap,
        "T11.6-2 — emission enabled: per spec source the generated-module " +
          "path and the next-to-source Markdown destination, both present " +
          "before any build has run; the non-`.mdx` spec-group file listed " +
          "in `sources` with `module` and `markdown` null (SPEC 11.6, 7.3, " +
          "13.1, 12.7)",
      );
    } finally {
      await emit.dispose();
    }

    // --- emission redirected under markdown.outDir -------------------------
    const outDir = await TestWorkspace.create({
      files: {
        [CONFIG_FILE]: RESOLVED_OUTDIR_CONFIG,
        "specs/g.mdx": '<S id="haut">\nRacine.\n</S>\n',
        "specs/sub/h.mdx": '<S id="bas">\nNichée.\n</S>\n',
      },
    });
    try {
      const map = await expectResolvedInventory(
        product,
        outDir.root,
        ["inventory"],
        "T11.6-2 — `inventory` with emission redirected under " +
          "`markdown.outDir` (SPEC 7.3, 11.6)",
      );
      assertSameJson(
        normalizeKindSets(map),
        {
          configuration: {
            specs: [{ name: "docs", globs: ["specs/**/*.mdx"] }],
            code: [],
            markdown: { emit: true, outDir: "mdout" },
            coverage: [],
            policy: [],
          },
          sources: [
            { path: "specs/g.mdx", groups: [{ name: "docs", kind: "spec" }] },
            {
              path: "specs/sub/h.mdx",
              groups: [{ name: "docs", kind: "spec" }],
            },
          ],
          derived: [
            // outDir redirects emitted files into the directory,
            // preserving workspace-relative paths (7.3) — the nested
            // source's destination keeps its whole relative path.
            {
              source: "specs/g.mdx",
              module: "specs/g.xspec.ts",
              markdown: "mdout/specs/g.md",
            },
            {
              source: "specs/sub/h.mdx",
              module: "specs/sub/h.xspec.ts",
              markdown: "mdout/specs/sub/h.md",
            },
          ],
        } satisfies InventoryResolvedMap,
        "T11.6-2 — `markdown.outDir` echoes in the resolved view and every " +
          "emit destination lies under it, preserving workspace-relative " +
          "paths, before any build has run (SPEC 7.3, 11.6, 12.7)",
      );
    } finally {
      await outDir.dispose();
    }

    // --- emission disabled explicitly (emit false, outDir configured) ------
    const disabled = await TestWorkspace.create({
      files: {
        [CONFIG_FILE]: RESOLVED_DISABLED_CONFIG,
        "specs/seul.mdx": '<S id="seul">\nInerte.\n</S>\n',
      },
    });
    try {
      const map = await expectResolvedInventory(
        product,
        disabled.root,
        ["inventory"],
        "T11.6-2 — `inventory` with emission disabled explicitly (`emit` " +
          "false, `outDir` configured) (SPEC 7.3, 11.6)",
      );
      assertSameJson(
        normalizeKindSets(map),
        {
          configuration: {
            specs: [{ name: "main", globs: ["specs/**/*.mdx"] }],
            code: [],
            // The complete definition is reported — `emit` false AND the
            // configured `outDir` — while no path is a Markdown emit
            // destination (7.3).
            markdown: { emit: false, outDir: "docsout" },
            coverage: [],
            policy: [],
          },
          sources: [
            {
              path: "specs/seul.mdx",
              groups: [{ name: "main", kind: "spec" }],
            },
          ],
          derived: [
            // With emission disabled, `markdown` is null for every source
            // whatever `outDir` says (7.3, 12.7); the module path stays —
            // generation does not depend on emission (13.1).
            {
              source: "specs/seul.mdx",
              module: "specs/seul.xspec.ts",
              markdown: null,
            },
          ],
        } satisfies InventoryResolvedMap,
        "T11.6-2 — emission disabled explicitly: the view reports " +
          "emit-false with the configured outDir, and `markdown` is null " +
          "for every source — destinations exist exactly while emission is " +
          "enabled (SPEC 7.3, 11.6, 12.7)",
      );
    } finally {
      await disabled.dispose();
    }
  },
});

export const section116Tests: readonly ProductTestEntry[] = [T11_6_1, T11_6_2];
