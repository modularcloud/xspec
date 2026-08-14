// TEST-SPEC §11.6 (`xspec inventory`) — SUITE-56: T11.6-1, T11.6-2, T11.6-3,
// T11.6-4.
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
// `decodeInventoryFindings`, and `decodeInventoryResolvedMap` (T11.6-1/-2)
// and the full ten-member `decodeInventoryDocument` (T11.6-3 — its entry
// completes the member set, so its arms pin the whole document form).
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
// T11.6-3 — record, area, durables, order (SPEC 11.6, 13.3, 13.1, 6.1,
// 10.1, 12.7). Two workspaces:
//
// - record/area/journal workspace (emission enabled; two spec groups `zz`
//   before `aa` so configuration order has teeth): before any build,
//   `recorded` is [] (empty before any generation — never null, never
//   unavailable), `graphData` is exactly ".xspec" (reported unconditionally,
//   no trailing separator), `journal` is {".xspec/journal", occupied: false}
//   (an absent journal is an empty journal, 6.1), `sessions` [] — flag-less
//   and `--json` forms against the same expectation (SPEC 11). After a
//   `build`: `recorded` lists the recorded derived paths — both generated
//   modules and both emitted Markdown files pinned present, and every
//   further entry attributable to a discovered source through the 13.1
//   naming scheme (`<dir>/<NAME>.xspec.<suffix>` beside `<dir>/<NAME>.mdx`)
//   — in byte order (decoder-enforced). After a configuration change
//   without rebuild (emission flipped off): the resolved view and derived
//   map report the new configuration (`markdown` null per source) while
//   `recorded` still lists the previously generated Markdown — the record
//   lags, reported as recorded, not as configured (11.6, 13.3). A foreign
//   file placed under `.xspec/` (neither journal, session-named, nor
//   recorded) appears in no inventory list and is never claimed: the exact
//   sources/sessions compares and the recorded attribution rule exclude it,
//   and its name appears nowhere in the document bytes. Journal occupancy is
//   presence alone: a garbage-content plain file, a directory, and a broken
//   symbolic link each report occupied true with a finding-free answer (no
//   content read, no 14.13 from inventory; the broken link discriminates a
//   product probing occupancy through the link).
//
// - sessions workspace: a product-written session (`review create
//   --strategy audit --name ancien`), a garbage-content `S.json`, and a
//   directory named `S2.json` are all listed (selection by name alone,
//   content unread — no 14.21 here), while `notes.txt` and `.foo.json` are
//   never listed (no session file name, 10.1) and never claimed (their
//   names appear nowhere in the document bytes). Order: byte order of file
//   name — "S.json" < "S2.json" < "ancien.json" (0x53 'S' sorts before
//   0x61 'a'), inverting under case folding, so the byte-order contract has
//   teeth.
//
// T11.6-4 — no parse, no write, one finding (SPEC 11.6, 14.23, 14.14, 12.7,
// 12.0, 13.3). Three arm groups, three workspaces:
//
// - imperfect workspace: sources failing every validation family — an
//   unparseable file included — plus a garbage journal line and a corrupt
//   session. Staging premise pinned first (the FP-016 style): `build --json`
//   exits 1 reporting exactly the staged multiset — 14.1–14.9, 14.11, 14.15
//   through 14.20 across MDX and TS, plus the journal line's 14.13 — one
//   finding each, nothing beside (14.21 deliberately absent: `build` does
//   not read sessions, SPEC 14; 14.10/14.12 are `check`-only; the record is
//   absent, so no 14.23 anywhere). Then `inventory`, flag-less and `--json`
//   against ONE expected document, both inside a single whole-root
//   modifies-nothing compare (byte-compare; no refresh — graph data absent
//   before and after, where every refreshing read would create it or die on
//   the invalid sources): the COMPLETE ten-member document asserted exactly
//   — every discovered source listed with its membership, the unparseable
//   and non-`.mdx` files included; the derived map determined by
//   configuration and discovery alone (the unparseable source's module and
//   Markdown paths present — a product computing the map through parsing
//   dies here); `recorded` [] (the failed build modified nothing, 12.1);
//   the journal occupied; the corrupt session listed by name — and
//   `findings` [] at exit 0: the staged findings are reported where their
//   conditions assign them (the premise build; T13.3-3, T10.1-4, T12.2-2),
//   never here, which IS the parses-no-sources/reads-no-content observation.
//
// - configuration errors keep precedence (14.14): missing configuration (a
//   bare directory tree with no reachable xspec.config.ts, the T7-1
//   operationalization) and invalid configuration (garbage TypeScript, a
//   valid source beside it so the refusal is attributable to the
//   configuration alone) each → exit 2 with the single 12.7 error document
//   as the entire stdout — asserted in the flag-less form (inventory is a
//   JSON-only surface, so JSON output is in effect without `--json`, SPEC
//   12.0) and via `expectConfigurationError`'s `--json` form — the finding
//   carrying the stable code `configuration-error` and a concerned path,
//   the stderr message naming the configuration; "no inventory" is the
//   decode itself: the error document is `{"error": …}` exactly, no
//   inventory member beside it (12.7).
//
// - corrupt-record workspace: valid, built, `recorded` premise-pinned as a
//   readable non-empty record (module and Markdown present), then the
//   record corrupted shape-blind (T6.6-6's staging — garbage over T13.3-2's
//   operational path set, product-written files only, H-3/H-4). Both output
//   forms inside one whole-root compare (the corrupt state is left neither
//   read-repaired nor replaced, 13.3): exit 1 (an answer carrying a finding
//   and explicitly-unavailable data, 12.0), `recorded` exactly the
//   unavailability marker — never read as empty, never fabricated —
//   `findings` exactly one condition-23 finding (the stable code
//   `unreadable-record` pinned through the decode's token table), concerned
//   path the graph-data area, locations [] (no path inside the area is
//   named, 13.3/12.7), and every other member emitted in full — deep-equal
//   to the intact-record answer on the same workspace.
//
// Certification note: CERTIFICATIONS.md's Exclusions list T11.6-1 through
// T11.6-4 ("`inventory` and `version`"), so no fixture executes these
// bodies; the anchoring, resolved-configuration, derived-map, occupancy,
// and listing arms are positive and byte-asserted per that entry, T11.6-4's
// no-parse/no-write negatives ride the certified compare-around machinery,
// and every broken state T11.6-4 must ignore is positively reported from
// the same staging by its home reporter (its premise build in-test;
// T13.3-3, T10.1-4, T12.2-2 on their own stagings).

import { Buffer } from "node:buffer";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import type {
  DecodedDatum,
  DependencyEdgeKind,
  GroupKind,
  InventoryConfigurationView,
  InventoryDocument,
  InventoryJournalStatus,
  InventoryResolvedMap,
  PathValue,
} from "../../helpers/adapters/index.js";
import {
  GRAPH_DATA_AREA_PATH,
  corruptGraphDataShapeBlind,
  decodeInventoryAnchoring,
  decodeInventoryDocument,
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
import { assertLeavesUnchanged } from "../../helpers/snapshot.js";
import type { ProductBinding, RunResult } from "../../helpers/subprocess.js";
import { runProduct, summarizeResult } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import {
  assertConditionCounts,
  assertFindingConcernsPath,
  assertSameJson,
  buildFindings,
  buildOk,
  expectConfigurationError,
  expectErrorDocument,
  expectExit,
} from "./support.js";

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

// --- T11.6-3 ------------------------------------------------------------------
//
// Fixtures. The record/area/journal workspace declares two spec groups in an
// order (`zz` before `aa`) that inverts name byte order, so the
// configuration-order clause of 11.6's ordering contract has teeth here too;
// emission is enabled so the post-build record carries modules AND Markdown;
// the lag arm rewrites the configuration to the emission-off twin (still
// valid — a configuration error would preempt the inventory, 14.14) without
// rebuilding.

const DURABLES_EMIT_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    zz: ["specs/z*.mdx"],
    aa: ["specs/a*.mdx"]
  },
  markdown: { emit: true }
})
`;

const DURABLES_NOEMIT_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    zz: ["specs/z*.mdx"],
    aa: ["specs/a*.mdx"]
  },
  markdown: { emit: false }
})
`;

/**
 * The foreign occupant's distinctive name component: chosen to appear in no
 * legitimate inventory content of these workspaces, so "appears in no
 * inventory list and is never claimed" (SPEC 11.6) is assertable as
 * document-wide byte absence on top of the exact list compares.
 */
const FOREIGN_TOKEN = "zzz-artefact-etranger";

const SESSIONS_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`;

/** The journal's workspace-relative path (SPEC 6.1). */
const JOURNAL_PATH = `${GRAPH_DATA_AREA_PATH}/journal`;

/**
 * Run `inventory` and assert the finding-free full-document frame (T11.6-3;
 * reused by T11.6-4's imperfect-workspace arm and intact-record premise):
 * exit 0 exactly (a complete, finding-free answer — the inventory parses no
 * sources, reads no journal or session content, and the calling arm has not
 * corrupted the record; SPEC 11.6, 12.0; H-5); exactly one JSON document as
 * the entire stdout (JSON-only, SPEC 11); the full ten-member 12.7 inventory
 * document form (H-3); `findings` [] — which IS the no-14.13/no-14.21
 * observation on the occupancy and session stagings. Returns the decoded
 * document and the raw run for the callers' value assertions and byte scans.
 */
async function expectInventoryDocument(
  product: ProductBinding,
  cwd: string,
  argv: readonly string[],
  context: string,
): Promise<{ document: InventoryDocument; result: RunResult }> {
  const result = await runProduct(product, { cwd, argv });
  assertExitCode(
    result,
    0,
    `${context} — a complete, finding-free inventory answer exits 0: the ` +
      `inventory parses no sources and reads no journal or session content, ` +
      `and the findings a listed file or path may bear are reported where ` +
      `their conditions assign them, never here (SPEC 11.6, 12.0)`,
  );
  const document = decodeInventoryDocument(
    parseJsonStdout(
      result,
      `${context} — inventory is JSON-only: a single JSON document is its ` +
        `only output form, with or without --json (SPEC 11, 12.0)`,
    ),
    context,
  );
  if (document.findings.length !== 0) {
    fail(
      `${context}: the inventory answer is finding-free — findings [] ` +
        `(SPEC 11.6, 12.7: parsing no sources and reading no journal or ` +
        `session content, the inventory meets no condition on these ` +
        `stagings — no 14.13, no 14.21 — and no arm corrupts the record); ` +
        `got ${String(document.findings.length)} finding(s), first: ` +
        `${JSON.stringify(document.findings[0]?.message)}`,
    );
  }
  return { document, result };
}

/** The graph-data area: exactly `.xspec`, no trailing separator (11.6). */
function assertGraphDataArea(actual: PathValue, context: string): void {
  if (actual === GRAPH_DATA_AREA_PATH) return;
  fail(
    `${context}: the graph-data area is reported unconditionally as its ` +
      `workspace-relative path ${JSON.stringify(GRAPH_DATA_AREA_PATH)} with ` +
      `no trailing separator (SPEC 11.6, 13.3); got ` +
      `${renderPathValue(actual)}`,
  );
}

/** The journal member: `{".xspec/journal", occupied}` byte-exact (11.6). */
function assertJournalStatus(
  actual: InventoryJournalStatus,
  occupied: boolean,
  context: string,
): void {
  if (actual.path !== JOURNAL_PATH) {
    fail(
      `${context}: the inventory reports the journal path — xspec maintains ` +
        `the journal at ${JSON.stringify(JOURNAL_PATH)} (SPEC 6.1, 11.6); ` +
        `got ${renderPathValue(actual.path)}`,
    );
  }
  if (actual.occupied !== occupied) {
    fail(
      `${context}: journal occupancy must be ${String(occupied)} — ` +
        `occupancy is presence alone, whatever kind of filesystem object ` +
        `occupies the path, and an absent journal is an empty journal ` +
        `(SPEC 11.6, 6.1); got ${String(actual.occupied)}`,
    );
  }
}

/**
 * The document's bytes must not contain the token anywhere: a path the
 * inventory neither lists nor claims (a foreign occupant under `.xspec/`, a
 * non-session entry under the review-session directory) appears nowhere in
 * the answer (SPEC 11.6, 10.1).
 */
function assertStdoutOmits(
  result: RunResult,
  token: string,
  context: string,
): void {
  if (!Buffer.from(result.stdoutBytes).includes(Buffer.from(token, "utf8"))) {
    return;
  }
  fail(
    `${context}: the inventory document mentions ${JSON.stringify(token)} — ` +
      `an unattributed path under the graph-data area (or a non-session ` +
      `entry under the review-session directory) appears in no inventory ` +
      `list and is never claimed (SPEC 11.6, 10.1)`,
  );
}

interface RecordedExpectation {
  /**
   * Paths that MUST be recorded: the generated module and (while emission
   * was enabled at the recording build) the emitted Markdown per source —
   * the paths as last generated (SPEC 13.3, 13.1, 13.2).
   */
  readonly pinned: readonly string[];
  /**
   * The discovered spec sources (`<dir>/<NAME>.mdx`) every further recorded
   * entry must attribute to through the 13.1 naming scheme.
   */
  readonly specSources: readonly string[];
}

/**
 * Assert the record-supplied datum after a generation has run: the plain
 * list state (never `null`, never unavailable — 14.23 is T11.6-4's staging),
 * every pinned module/Markdown path present, and every further entry a
 * companion attributable to its source through the 13.1 naming scheme —
 * `<dir>/<NAME>.xspec.<suffix>` beside a discovered `<dir>/<NAME>.mdx`, the
 * suffix non-empty. 13.1 pins no companion set (a product generates
 * whatever companions its modules need), so companions are asserted by
 * attributability, not enumeration; a path attributable to no source — a
 * graph-data path, the foreign occupant, any invention — fails. Byte order
 * and uniqueness are decoder-enforced (SPEC 11.6, 12.7).
 */
function assertRecordedDerivedPaths(
  recorded: DecodedDatum<readonly PathValue[]>,
  expectation: RecordedExpectation,
  context: string,
): void {
  if (recorded.state !== "value") {
    fail(
      `${context}: the recorded derived-file paths must be the plain list — ` +
        `the record exists and is readable on this staging, so the datum is ` +
        `never null and never the unavailability marker (14.23 is the ` +
        `corrupt-record case, T11.6-4) (SPEC 11.6, 12.7); got state ` +
        `"${recorded.state}"`,
    );
  }
  const entries: string[] = recorded.value.map((entry, index) => {
    if (typeof entry === "string") return entry;
    fail(
      `${context}: recorded entry ${String(index)} arrived in the marked ` +
        `byte form (${renderPathValue(entry)}) — every derived path of this ` +
        `staging is valid UTF-8, and a valid-UTF-8 path is never presented ` +
        `in the byte form (SPEC 12.0, 12.7)`,
    );
  });
  for (const pinnedPath of expectation.pinned) {
    if (!entries.includes(pinnedPath)) {
      fail(
        `${context}: the record must list ${JSON.stringify(pinnedPath)} — ` +
          `the recorded derived-file paths are the paths as last generated: ` +
          `the generated modules with their companions and the emitted ` +
          `Markdown (SPEC 13.3, 13.1, 13.2, 11.6); recorded: ` +
          `${JSON.stringify(entries)}`,
      );
    }
  }
  const stems = expectation.specSources.map((source) => {
    if (!source.endsWith(".mdx")) {
      fail(
        `${context}: fixture self-check — spec source ` +
          `${JSON.stringify(source)} does not end in ".mdx" (a harness ` +
          `staging defect, not a product failure)`,
      );
    }
    return source.slice(0, -".mdx".length);
  });
  for (const entry of entries) {
    if (expectation.pinned.includes(entry)) continue;
    const attributable = stems.some(
      (stem) =>
        entry.startsWith(`${stem}.xspec.`) &&
        entry.length > `${stem}.xspec.`.length,
    );
    if (!attributable) {
      fail(
        `${context}: recorded entry ${JSON.stringify(entry)} is neither a ` +
          `pinned module/Markdown path nor a companion attributable to a ` +
          `discovered source through the 13.1 naming scheme ` +
          `("<dir>/<NAME>.xspec." plus a suffix, beside "<dir>/<NAME>.mdx") ` +
          `— the record lists generated modules, their companions, and ` +
          `emitted Markdown, and nothing else: graph data records no paths ` +
          `of its own, and an unattributed path is never claimed (SPEC ` +
          `13.3, 13.1, 11.6)`,
      );
    }
  }
}

const T11_6_3 = defineProductTest({
  id: "T11.6-3",
  title:
    'inventory record, area, durables, order: `recorded` is [] before any generation (never null, never unavailable) and after a build lists the recorded derived paths in byte order — generated modules and emitted Markdown pinned present, every further entry a companion attributable to its source through the 13.1 naming scheme — and after a configuration change without rebuild it lags, reported as recorded, not as configured (emission flipped off: `derived[*].markdown` null while the previously emitted `.md` paths stay recorded); the graph-data area is reported unconditionally — before any build — as ".xspec" with no trailing separator; a foreign file placed under `.xspec/` appears in no inventory list and is never claimed (its name absent from the document bytes); `journal` is {".xspec/journal", occupied} with occupancy by presence alone — absent false; a garbage-content plain file, a directory, and a broken symbolic link each true, content unread, no 14.13 from inventory, the answer finding-free; sessions are selected by name alone — a product-written session, a garbage-content S.json, and a directory named S2.json all listed (content unread, no 14.21 here) in byte order of file name ("S.json" < "S2.json" < "ancien.json", inverting under case folding), while notes.txt and .foo.json are never listed; groups stay in configuration order (`zz` before `aa` against name byte order); every answer complete and finding-free at exit 0, the pre-build state asserted in the flag-less and `--json` forms against one expectation (SPEC 11.6, 13.3, 13.1, 13.2, 6.1, 10.1, 12.7, 12.0, 11)',
  run: async (product) => {
    // --- record / area / journal workspace ---------------------------------
    const workspace = await TestWorkspace.create({
      files: {
        [CONFIG_FILE]: DURABLES_EMIT_CONFIG,
        "specs/apex.mdx": '<S id="apex">\nSommet.\n</S>\n',
        "specs/zele.mdx": '<S id="zele">\nArdeur.\n</S>\n',
      },
    });
    try {
      // Before any build: the record is empty, the area is already reported,
      // the absent journal is unoccupied, no sessions exist — flag-less and
      // `--json` forms against the same expectation (JSON-only, SPEC 11).
      for (const argv of [["inventory"], ["inventory", "--json"]] as const) {
        const context =
          `T11.6-3 — \`${argv.join(" ")}\` before any build: recorded [], ` +
          `graphData ".xspec", journal unoccupied, sessions [] (SPEC 11.6)`;
        const { document } = await expectInventoryDocument(
          product,
          workspace.root,
          argv,
          context,
        );
        assertSameJson(
          document.recorded,
          { state: "value", value: [] },
          `${context} — \`recorded\` is empty before any generation has ` +
            `run: the empty list, never null and never the unavailability ` +
            `marker (SPEC 11.6, 12.7)`,
        );
        assertGraphDataArea(
          document.graphData,
          `${context} — the graph-data area is reported unconditionally: a ` +
            `consumer must know the area before any build has run`,
        );
        assertJournalStatus(
          document.journal,
          false,
          `${context} — no journal file exists yet`,
        );
        assertSameJson(
          document.sessions,
          [],
          `${context} — no session directory entries exist (SPEC 11.6, 10.1)`,
        );
        // 11.6's ordering contract, configuration-order half: groups arrive
        // in configuration order — `zz` before `aa`, inverting name byte
        // order (profiles and rules ride the same clause; their
        // configuration-order exact compares are T11.6-2's).
        assertSameJson(
          document.configuration.specs.map((group) => group.name),
          ["zz", "aa"],
          `${context} — groups in configuration order, not name byte order ` +
            `(SPEC 11.6)`,
        );
        // The as-configured baseline the lag arm contrasts against.
        assertSameJson(
          document.derived,
          [
            {
              source: "specs/apex.mdx",
              module: "specs/apex.xspec.ts",
              markdown: "specs/apex.md",
            },
            {
              source: "specs/zele.mdx",
              module: "specs/zele.xspec.ts",
              markdown: "specs/zele.md",
            },
          ],
          `${context} — the derived map per spec source with emission ` +
            `enabled (SPEC 11.6, 13.1, 7.3)`,
        );
      }

      // Build, then place a foreign file under the graph-data area. The
      // foreign occupant is staged after the build so the arm asserts
      // exactly what 11.6 defines — the inventory's treatment of an
      // unattributed path — not any build-time behavior toward it.
      await buildOk(
        product,
        workspace,
        "T11.6-3 — the staged workspace is valid, so `build` succeeds and " +
          "records the generated derived paths (SPEC 12.1, 13.3)",
      );
      await workspace.file(
        `${GRAPH_DATA_AREA_PATH}/${FOREIGN_TOKEN}.bin`,
        "contenu etranger — ni journal, ni session, ni enregistre\n",
      );

      const postBuildRecorded: RecordedExpectation = {
        pinned: [
          "specs/apex.md",
          "specs/apex.xspec.ts",
          "specs/zele.md",
          "specs/zele.xspec.ts",
        ],
        specSources: ["specs/apex.mdx", "specs/zele.mdx"],
      };
      const afterContext =
        "T11.6-3 — `inventory` after a build: the record lists the " +
        "recorded derived paths — modules, companions, Markdown (SPEC " +
        "11.6, 13.3)";
      const after = await expectInventoryDocument(
        product,
        workspace.root,
        ["inventory"],
        afterContext,
      );
      assertRecordedDerivedPaths(
        after.document.recorded,
        postBuildRecorded,
        `${afterContext} — both generated modules and both emitted Markdown ` +
          `files recorded, every further entry a 13.1-attributable companion`,
      );
      assertJournalStatus(
        after.document.journal,
        false,
        `${afterContext} — a build journals nothing: the journal is written ` +
          `only by rename and move (SPEC 6.1)`,
      );
      assertGraphDataArea(after.document.graphData, afterContext);
      assertSameJson(
        after.document.sessions,
        [],
        `${afterContext} — still no session directory entries`,
      );
      // The foreign occupant is in no list: `sources` holds exactly the two
      // discovered files (`.xspec/` is excluded from every group, 13.4),
      // `sessions` is empty, the recorded entries are pinned-or-attributable
      // — and the name appears nowhere in the document at all.
      assertSameJson(
        after.document.sources,
        [
          { path: "specs/apex.mdx", groups: [{ name: "aa", kind: "spec" }] },
          { path: "specs/zele.mdx", groups: [{ name: "zz", kind: "spec" }] },
        ],
        `${afterContext} — every discovered source with its membership; the ` +
          `foreign file under .xspec/ is never a source (SPEC 11.6, 13.4)`,
      );
      assertStdoutOmits(
        after.result,
        FOREIGN_TOKEN,
        `${afterContext} — a foreign file under the graph-data area ` +
          `(neither journal, session-named, nor recorded) is unattributed: ` +
          `listed nowhere, claimed never (SPEC 11.6)`,
      );

      // Configuration change without rebuild: emission off. The resolved
      // view and derived map follow the new configuration; the record lags —
      // reported as recorded, not as configured (SPEC 11.6, 13.3: the
      // inventory never refreshes or writes, and even a refresh leaves the
      // recorded paths unchanged).
      await workspace.file(CONFIG_FILE, DURABLES_NOEMIT_CONFIG);
      const lagContext =
        "T11.6-3 — `inventory` after the configuration change (emission " +
        "off) without rebuild: the record lags, reported as recorded, not " +
        "as configured (SPEC 11.6, 13.3)";
      const lag = await expectInventoryDocument(
        product,
        workspace.root,
        ["inventory"],
        lagContext,
      );
      assertSameJson(
        lag.document.configuration.markdown,
        { emit: false, outDir: null },
        `${lagContext} — the resolved view reports the new configuration ` +
          `(SPEC 7.3, 11.6)`,
      );
      assertSameJson(
        lag.document.derived,
        [
          {
            source: "specs/apex.mdx",
            module: "specs/apex.xspec.ts",
            markdown: null,
          },
          {
            source: "specs/zele.mdx",
            module: "specs/zele.xspec.ts",
            markdown: null,
          },
        ],
        `${lagContext} — the derived map follows the configuration: no ` +
          `Markdown destination exists while emission is disabled (SPEC ` +
          `7.3, 11.6)`,
      );
      assertRecordedDerivedPaths(
        lag.document.recorded,
        postBuildRecorded,
        `${lagContext} — the previously emitted Markdown paths and the ` +
          `modules stay recorded until a rebuild replaces the record: a ` +
          `product recomputing "recorded" from the current configuration ` +
          `drops the .md paths and fails here`,
      );
      assertStdoutOmits(lag.result, FOREIGN_TOKEN, lagContext);

      // Journal occupancy by presence alone: a garbage-content plain file, a
      // directory, and a broken symbolic link each occupy the path — no
      // content read, no 14.13 from the inventory (findings [] is asserted
      // by the shared frame on every decode).
      await workspace.file(
        JOURNAL_PATH,
        "ceci n'est pas une entree de journal\n",
      );
      const plainFile = await expectInventoryDocument(
        product,
        workspace.root,
        ["inventory"],
        "T11.6-3 — `inventory` with a garbage-content plain file at the " +
          "journal path: occupancy is presence alone and no content is " +
          "read — no 14.13 from the inventory (SPEC 11.6, 6.1)",
      );
      assertJournalStatus(
        plainFile.document.journal,
        true,
        "T11.6-3 — journal occupied by a plain file",
      );

      await fsp.rm(workspace.path(JOURNAL_PATH));
      await workspace.dir(JOURNAL_PATH);
      const directory = await expectInventoryDocument(
        product,
        workspace.root,
        ["inventory"],
        "T11.6-3 — `inventory` with a directory at the journal path: " +
          "occupancy is presence alone, whatever kind of filesystem object " +
          "occupies it (SPEC 11.6, 6.1)",
      );
      assertJournalStatus(
        directory.document.journal,
        true,
        "T11.6-3 — journal occupied by a directory",
      );

      await fsp.rm(workspace.path(JOURNAL_PATH), { recursive: true });
      await workspace.symlink(JOURNAL_PATH, "cible-fantome");
      const symlink = await expectInventoryDocument(
        product,
        workspace.root,
        ["inventory"],
        "T11.6-3 — `inventory` with a broken symbolic link at the journal " +
          "path: still occupied — presence alone, so a product probing " +
          "occupancy through the link (stat, open) wrongly reports absent " +
          "(SPEC 11.6, 6.1)",
      );
      assertJournalStatus(
        symlink.document.journal,
        true,
        "T11.6-3 — journal occupied by a broken symbolic link",
      );
    } finally {
      await workspace.dispose();
    }

    // --- sessions workspace -------------------------------------------------
    const sessions = await TestWorkspace.create({
      files: {
        [CONFIG_FILE]: SESSIONS_CONFIG,
        "specs/seul.mdx": '<S id="seul">\nSeul.\n</S>\n',
      },
    });
    try {
      await buildOk(
        product,
        sessions,
        "T11.6-3 — the sessions workspace is valid, so `build` succeeds " +
          "(SPEC 12.1)",
      );
      await expectExit(
        product,
        sessions,
        ["review", "create", "--strategy", "audit", "--name", "ancien"],
        0,
        "T11.6-3 — `review create --strategy audit --name ancien` writes " +
          "the product's own session file (SPEC 10.1, 10.7)",
      );
      // Staging premise: the product wrote a plain session file where 10.1
      // stores sessions — the later exact listing rests on it.
      const sessionKind = await sessions.kind(
        `${GRAPH_DATA_AREA_PATH}/reviews/ancien.json`,
      );
      if (sessionKind !== "file") {
        fail(
          "T11.6-3 — staging premise: `review create` must store the " +
            "session at .xspec/reviews/ancien.json as a plain file (SPEC " +
            `10.1, 13.4); found ${sessionKind}`,
        );
      }
      await sessions.file(
        `${GRAPH_DATA_AREA_PATH}/reviews/S.json`,
        "{{{ pas du JSON du tout — contenu jamais lu par l'inventaire",
      );
      await sessions.dir(`${GRAPH_DATA_AREA_PATH}/reviews/S2.json`);
      await sessions.file(
        `${GRAPH_DATA_AREA_PATH}/reviews/notes.txt`,
        "a ne jamais lister\n",
      );
      await sessions.file(`${GRAPH_DATA_AREA_PATH}/reviews/.foo.json`, "{}\n");

      const listContext =
        "T11.6-3 — `inventory` over the staged review-session directory: " +
        "sessions are selected by name alone, content unread (SPEC 11.6, " +
        "10.1)";
      const listed = await expectInventoryDocument(
        product,
        sessions.root,
        ["inventory"],
        listContext,
      );
      // Selection by name alone, whatever occupies the entry: the
      // product-written session, the garbage-content S.json, and the
      // directory S2.json are all listed — no 14.21 here (findings [] in
      // the frame) — while notes.txt (no .json session name) and .foo.json
      // (a session name never begins with ".") never are. Order: byte
      // order of file name — "S.json" < "S2.json" (0x2e < 0x32) <
      // "ancien.json" (0x53 < 0x61); case folding would sort "ancien"
      // first, so the byte-order contract has teeth.
      assertSameJson(
        listed.document.sessions,
        [
          `${GRAPH_DATA_AREA_PATH}/reviews/S.json`,
          `${GRAPH_DATA_AREA_PATH}/reviews/S2.json`,
          `${GRAPH_DATA_AREA_PATH}/reviews/ancien.json`,
        ],
        `${listContext} — exactly the three session-named entries, in byte ` +
          `order of file name`,
      );
      assertStdoutOmits(
        listed.result,
        "notes.txt",
        `${listContext} — a review-directory entry with no session file ` +
          `name is not a session: never listed, never claimed (SPEC 10.1, ` +
          `11.6)`,
      );
      assertStdoutOmits(
        listed.result,
        ".foo.json",
        `${listContext} — a session name never begins with ".", so ` +
          `.foo.json is no session file name: never listed, never claimed ` +
          `(SPEC 10.1, 11.6)`,
      );
      assertJournalStatus(
        listed.document.journal,
        false,
        `${listContext} — review operations never touch the journal (SPEC ` +
          `6.1)`,
      );
      assertGraphDataArea(listed.document.graphData, listContext);
      assertRecordedDerivedPaths(
        listed.document.recorded,
        { pinned: ["specs/seul.xspec.ts"], specSources: ["specs/seul.mdx"] },
        `${listContext} — the record from the build: the module (no ` +
          `Markdown; emission is disabled by the absent key) plus ` +
          `attributable companions (SPEC 13.3, 13.1, 7.3)`,
      );
    } finally {
      await sessions.dispose();
    }
  },
});

// --- T11.6-4 ------------------------------------------------------------------
//
// Fixtures. The imperfect workspace's sources fail every validation family
// (see the module header): one heavily invalid but parseable file, one
// unparseable file, an in-file dependency cycle, two valid resolution
// targets, a non-`.mdx` spec-group file (the extension-free glob discovers
// it, 14.19), and a TypeScript source with the code-side reference family —
// plus a garbage journal line and a corrupt session staged as files. The
// configuration is valid (a configuration error would preempt everything,
// 14.14) with emission enabled, so the derived map carries Markdown
// destinations for every `.mdx` source, the unparseable one included.

const IMPERFECT_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    grp: ["specs/*"]
  },
  code: {
    impl: ["src/**/*.ts"]
  },
  markdown: { emit: true }
})
`;

/**
 * The parseable multi-family file: 14.1 (id-less section), 14.2 (top-level
 * multi-segment ID), 14.3 (duplicated `paire`, one finding), 14.4
 * (whitespace in a segment), 14.5 (`d` to an absent node), 14.6
 * (`text(...)` to an absent node), 14.8 (zero-argument `text()`), 14.15
 * (import designating no discovered spec source), 14.16 (`<div>`), 14.17
 * (unknown prop) — each staged once.
 */
const IMPERFECT_MULTI = `import AUTRE from "./autre.xspec"
import RIEN from "./inexistant.xspec"

<S>
Sans identite.
</S>

<S id="saut.niveau">
Saute un niveau.
</S>

<S id="paire">
Premiere.
</S>

<S id="paire">
Seconde.
</S>

<S id="mauvais seg">
Segment invalide.
</S>

<S id="charge" d={AUTRE.absent}>
Dependance inconnue.

{text(AUTRE.manque)}

{text()}
</S>

<S id="props" inconnu="x">
Prop inconnue.
</S>

<div>hors grammaire</div>
`;

/**
 * The TypeScript reference family: an unresolving marker (14.7), a spec
 * module binding used outside the sanctioned forms (14.18), and a node of
 * one module passed to another module's `text` export (14.11) — the two
 * imports themselves valid (SPEC 4), their targets the valid spec files.
 */
const IMPERFECT_CODE = `import AUTRE, { text } from "../specs/autre.xspec";
import PUR from "../specs/pur.xspec";

export function usine() {
  AUTRE.inconnu;
  const garde = AUTRE;
  text(PUR.net);
}
`;

/** In-file dependency cycle via local string references (14.9, SPEC 2.4). */
const IMPERFECT_CYCLE = `<S id="boucle1" d={"boucle2"}>
Premier maillon.
</S>

<S id="boucle2" d={"boucle1"}>
Second maillon.
</S>
`;

/** Unparseable MDX: an unclosed section tag (14.20). */
const IMPERFECT_BROKEN = '<S id="casse">\nJamais fermee.\n';

/** The corrupt session's path: a well-formed session file name (SPEC 10.1). */
const CORRUPT_SESSION_PATH = `${GRAPH_DATA_AREA_PATH}/reviews/louche.json`;

/**
 * The staged multiset the premise `build` must report — one finding per
 * staged construct, nothing beside: 14.21 is deliberately absent (`build`
 * does not read sessions, SPEC 14), 14.10/14.12 are `check`-only, the
 * configuration is valid (no 14.14), no write path is obstructed (no
 * 14.22), and no record exists (14.23 is never `build`'s anyway). Counting
 * keys are the token-derived `14.N` identities (support.ts), so each count
 * pins the exact stable code string too.
 */
const IMPERFECT_PREMISE_CONDITIONS: Readonly<Record<string, number>> = {
  "14.1": 1,
  "14.2": 1,
  "14.3": 1,
  "14.4": 1,
  "14.5": 1,
  "14.6": 1,
  "14.7": 1,
  "14.8": 1,
  "14.9": 1,
  "14.11": 1,
  "14.13": 1,
  "14.15": 1,
  "14.16": 1,
  "14.17": 1,
  "14.18": 1,
  "14.19": 1,
  "14.20": 1,
};

/** Not well-formed TypeScript: the invalid-configuration staging (14.14). */
const IMPERFECT_BROKEN_CONFIG =
  "ceci n'est pas du TypeScript ((( donc pas une configuration\n";

/** Arm C's valid workspace: one source, emission on (a rich record). */
const RECORD_EMIT_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    seul: ["specs/**/*.mdx"]
  },
  markdown: { emit: true }
})
`;

/**
 * Run flag-less `inventory` from `cwd` and assert the 14.14 precedence
 * contract on a JSON-only surface: exit 2 exactly; stdout exactly the
 * single 12.7 error document — JSON output is in effect without `--json`
 * (SPEC 12.0), and the decode's single `error` member IS the no-inventory
 * observation — its finding carrying the stable code `configuration-error`
 * and a non-`null` concerned path (SPEC 14; the exact anchoring-form
 * spelling is T12.7-3's assertion); and a standard-error message
 * identifying the configuration as the failing subject (/config/i, the
 * `expectConfigurationError` operationalization; 12.0: error messages are
 * standard-error content, diagnostics beside the error document).
 */
async function expectFlaglessInventoryConfigurationError(
  product: ProductBinding,
  cwd: string,
  context: string,
): Promise<void> {
  const result = await runProduct(product, { cwd, argv: ["inventory"] });
  assertExitCode(
    result,
    2,
    `${context} — missing or invalid configuration is a configuration ` +
      `error, preceding the inventory: exit 2, no inventory (SPEC 14.14, ` +
      `11.6, 12.0)`,
  );
  const error = expectErrorDocument(result, context);
  if (error.code !== "configuration-error") {
    fail(
      `${context}: the error document's finding must carry the stable code ` +
        `"configuration-error" (SPEC 14 condition 14, 12.7); got ` +
        `${JSON.stringify(error.code)} (message: ` +
        `${JSON.stringify(error.message)})`,
    );
  }
  if (error.path === null) {
    fail(
      `${context}: a configuration error's finding carries its concerned ` +
        `path — the configuration file, or "." for a failed upward search — ` +
        `in the anchoring form (SPEC 14, 12.7); got null`,
    );
  }
  if (!/config/i.test(result.stderr)) {
    fail(
      `${context}: the configuration-error message on stderr must identify ` +
        `the configuration as the failing subject (SPEC 14.14; 12.0: error ` +
        `messages are standard-error content) — any phrasing naming ` +
        `xspec.config.ts or "configuration" qualifies (H-3); got ` +
        `${summarizeResult(result)}`,
    );
  }
}

/**
 * An inventory document's eight members apart from the record-supplied
 * `recorded` datum and the `findings` that report its state — the "every
 * other member emitted in full" projection of SPEC 14.23, built in the
 * decoded document's member order so `assertSameJson` compares exactly.
 */
function inventoryApartFromRecordSupplied(
  document: InventoryDocument,
): Record<string, unknown> {
  return {
    root: document.root,
    config: document.config,
    configuration: document.configuration,
    sources: document.sources,
    derived: document.derived,
    graphData: document.graphData,
    journal: document.journal,
    sessions: document.sessions,
  };
}

const T11_6_4 = defineProductTest({
  id: "T11.6-4",
  title:
    "inventory no parse, no write, one finding: on a workspace whose sources fail every validation family — an unparseable file included, the premise `build --json` exiting 1 with exactly one finding per staged construct (14.1–14.9, 14.11, 14.15–14.20 across MDX and TS, plus the garbage journal line's 14.13; no 14.21 — build reads no sessions) — with a garbage journal line and a corrupt session staged, `inventory` answers in full, finding-free, exit 0, modifying nothing (whole-root byte-compare; no refresh — graph data absent throughout): the complete ten-member document asserted exactly in the flag-less and `--json` forms against one expectation — every discovered source listed with its membership (the unparseable and non-`.mdx` files included), the derived map determined by configuration and discovery alone (the unparseable source's module and Markdown paths present), `recorded` [], the journal occupied, the corrupt session listed by name — those findings reported where their conditions assign them, never here; configuration errors keep precedence: missing and invalid configuration each exit 2 with the single 12.7 error document as the entire stdout (stable code `configuration-error`, concerned path present, stderr naming the configuration), flag-less — a JSON-only surface — and with `--json` alike, no inventory beside the error member; the one finding it ever carries: with the record corrupted shape-blind (T6.6-6's staging) after a pinned readable-record premise, `recorded` is exactly the unavailability marker — never read as empty — beside exactly one condition-23 finding (stable code `unreadable-record`, concerned path the graph-data area, locations []: no path inside the area is named), exit 1, every other member emitted in full (deep-equal to the intact-record answer), the corrupt state left unmodified in a whole-root compare (SPEC 11.6, 14.23, 14.14, 14, 12.7, 12.0, 13.3, 12.1, 11)",
  run: async (product) => {
    // --- arm A: the imperfect workspace ------------------------------------
    const imperfect = await TestWorkspace.create({
      files: {
        [CONFIG_FILE]: IMPERFECT_CONFIG,
        "specs/anneau.mdx": IMPERFECT_CYCLE,
        "specs/autre.mdx": '<S id="autre">\nCible saine.\n</S>\n',
        "specs/casse.mdx": IMPERFECT_BROKEN,
        "specs/multi.mdx": IMPERFECT_MULTI,
        "specs/note.txt": "pas une source xspec\n",
        "specs/pur.mdx": '<S id="net">\nCible nette.\n</S>\n',
        "src/impl.ts": IMPERFECT_CODE,
        [JOURNAL_PATH]: "pas une entree de journal valide\n",
        [CORRUPT_SESSION_PATH]: "{{{ pas du JSON — session corrompue\n",
      },
    });
    try {
      // Staging premise (SPEC 14; the Exclusions' positively-reported
      // condition): the workspace genuinely fails every staged family — the
      // premise build reports exactly one finding per staged construct and
      // nothing beside. 14.21 is absent (build reads no sessions), which is
      // itself part of the "reported where their conditions assign them"
      // contract this arm rides.
      const premise = await buildFindings(
        product,
        imperfect,
        "T11.6-4 — staging premise: `build --json` on the imperfect " +
          "workspace exits 1 reporting the staged validation findings " +
          "(SPEC 12.1, 14)",
      );
      assertConditionCounts(
        premise,
        IMPERFECT_PREMISE_CONDITIONS,
        "T11.6-4 — staging premise: exactly the staged multiset — every " +
          "validation family fails once, none masked away, none phantom, " +
          "no 14.21 (build reads no sessions) and no 14.10/14.12 " +
          "(check-only) (SPEC 14)",
      );

      // The complete expected document, asserted exactly (SPEC 11.6, 12.7):
      // the answer is full — sources and derived from configuration and
      // discovery alone, the record-supplied datum the empty record (the
      // failed premise build modified nothing, 12.1), durables by presence
      // and name alone — and finding-free at exit 0.
      const expectedImperfect: InventoryDocument = {
        findings: [],
        root: ".",
        config: CONFIG_FILE,
        configuration: {
          specs: [{ name: "grp", globs: ["specs/*"] }],
          code: [{ name: "impl", globs: ["src/**/*.ts"] }],
          markdown: { emit: true, outDir: null },
          coverage: [],
          policy: [],
        },
        sources: [
          {
            path: "specs/anneau.mdx",
            groups: [{ name: "grp", kind: "spec" }],
          },
          { path: "specs/autre.mdx", groups: [{ name: "grp", kind: "spec" }] },
          // The unparseable file IS a discovered source with a membership:
          // discovery is glob-driven, never parse-driven (SPEC 7, 11.6).
          { path: "specs/casse.mdx", groups: [{ name: "grp", kind: "spec" }] },
          { path: "specs/multi.mdx", groups: [{ name: "grp", kind: "spec" }] },
          { path: "specs/note.txt", groups: [{ name: "grp", kind: "spec" }] },
          { path: "specs/pur.mdx", groups: [{ name: "grp", kind: "spec" }] },
          { path: "src/impl.ts", groups: [{ name: "impl", kind: "code" }] },
        ],
        derived: [
          {
            source: "specs/anneau.mdx",
            module: "specs/anneau.xspec.ts",
            markdown: "specs/anneau.md",
          },
          {
            source: "specs/autre.mdx",
            module: "specs/autre.xspec.ts",
            markdown: "specs/autre.md",
          },
          // Determined by configuration and discovery, existing whether or
          // not generation could ever succeed: the unparseable source's
          // derived paths are present — a product computing the map by
          // parsing sources fails here (SPEC 11.6, 13.1).
          {
            source: "specs/casse.mdx",
            module: "specs/casse.xspec.ts",
            markdown: "specs/casse.md",
          },
          {
            source: "specs/multi.mdx",
            module: "specs/multi.xspec.ts",
            markdown: "specs/multi.md",
          },
          // The spec-group file without `.mdx` (14.19): both structurally
          // absent (SPEC 11.6, 13.1, 12.7).
          { source: "specs/note.txt", module: null, markdown: null },
          {
            source: "specs/pur.mdx",
            module: "specs/pur.xspec.ts",
            markdown: "specs/pur.md",
          },
        ],
        // Empty before any generation — the premise build failed and
        // modified nothing (SPEC 12.1), so the record is the empty list:
        // never null, never the unavailability marker (SPEC 11.6, 12.7).
        recorded: { state: "value", value: [] },
        graphData: GRAPH_DATA_AREA_PATH,
        // Occupancy by presence alone — the garbage content is never read,
        // no 14.13 from the inventory (SPEC 11.6, 6.1).
        journal: { path: JOURNAL_PATH, occupied: true },
        // Selected by name alone — the corrupt content is never read, no
        // 14.21 from the inventory (SPEC 11.6, 10.1).
        sessions: [CORRUPT_SESSION_PATH],
      };

      // Both output forms inside ONE whole-root modifies-nothing compare:
      // the inventory never refreshes or writes anything (SPEC 11.6) —
      // graph data stays absent (every refreshing read would create it or
      // die on the invalid sources, 13.3), sources, journal, and session
      // bytes stay put.
      await assertLeavesUnchanged(
        imperfect.root,
        async () => {
          for (const argv of [
            ["inventory"],
            ["inventory", "--json"],
          ] as const) {
            const context =
              `T11.6-4 — \`${argv.join(" ")}\` on the imperfect workspace: ` +
              `the inventory parses no sources and reads no journal or ` +
              `session content — the answer is complete, finding-free, ` +
              `exit 0, the staged findings reported where their conditions ` +
              `assign them, never here (SPEC 11.6, 12.0)`;
            const { document } = await expectInventoryDocument(
              product,
              imperfect.root,
              argv,
              context,
            );
            assertSameJson(
              document,
              expectedImperfect,
              `${context} — the complete ten-member document, exactly: ` +
                `every discovered source with its membership (unparseable ` +
                `and non-.mdx files included), the configuration-determined ` +
                `derived map, recorded [], the occupied journal, the ` +
                `corrupt session listed by name (SPEC 11.6, 12.7)`,
            );
          }
        },
        "T11.6-4 — `inventory` on the imperfect workspace modifies nothing " +
          "and never refreshes: graph data absent before and after, every " +
          "source, journal, and session byte untouched (SPEC 11.6, 13.3)",
      );
    } finally {
      await imperfect.dispose();
    }

    // --- arm B: configuration errors keep precedence (14.14) ---------------
    const missing = await TestWorkspace.create({});
    try {
      await expectFlaglessInventoryConfigurationError(
        product,
        missing.root,
        "T11.6-4 — flag-less `inventory` with no reachable configuration " +
          "(the upward search exhausts): the error document on a JSON-only " +
          "surface, no inventory (SPEC 14.14, 11.6, 12.0, 12.7)",
      );
      await expectConfigurationError(
        product,
        missing,
        ["inventory"],
        "T11.6-4 — `inventory --json` with no reachable configuration: " +
          "exit 2, the single 12.7 error document, no inventory (SPEC " +
          "14.14, 11.6, 12.0)",
      );
    } finally {
      await missing.dispose();
    }

    const invalid = await TestWorkspace.create({
      files: {
        [CONFIG_FILE]: IMPERFECT_BROKEN_CONFIG,
        // A valid source beside the broken configuration: the refusal is
        // attributable to the configuration alone, and "no inventory" has
        // content an answer would have carried.
        "specs/a.mdx": ANCHOR_SOURCE,
      },
    });
    try {
      await expectFlaglessInventoryConfigurationError(
        product,
        invalid.root,
        "T11.6-4 — flag-less `inventory` with invalid configuration (not " +
          "well-formed TypeScript): the error document on a JSON-only " +
          "surface, no inventory (SPEC 14.14, 14 condition 14, 11.6, 12.0)",
      );
      await expectConfigurationError(
        product,
        invalid,
        ["inventory"],
        "T11.6-4 — `inventory --json` with invalid configuration: exit 2, " +
          "the single 12.7 error document, no inventory (SPEC 14.14, 11.6)",
      );
    } finally {
      await invalid.dispose();
    }

    // --- arm C: the one finding it ever carries (14.23) --------------------
    const record = await TestWorkspace.create({
      files: {
        [CONFIG_FILE]: RECORD_EMIT_CONFIG,
        "specs/seul.mdx": '<S id="seul">\nContenu stable.\n</S>\n',
      },
    });
    try {
      await buildOk(
        product,
        record,
        "T11.6-4 — the corrupt-record workspace is valid, so `build` " +
          "succeeds and records the generated derived paths (SPEC 12.1, " +
          "13.3)",
      );
      const intactContext =
        "T11.6-4 — `inventory` on the intact record: the readable-record " +
        "premise the corruption then destroys (SPEC 11.6, 13.3)";
      const intact = await expectInventoryDocument(
        product,
        record.root,
        ["inventory"],
        intactContext,
      );
      // Premise: the record-supplied datum is a readable, non-empty record
      // — module and Markdown pinned present — so the corrupt-state
      // "unavailable" below is a real state change, and "never read as
      // empty" has a non-empty record to contrast against.
      assertRecordedDerivedPaths(
        intact.document.recorded,
        {
          pinned: ["specs/seul.md", "specs/seul.xspec.ts"],
          specSources: ["specs/seul.mdx"],
        },
        `${intactContext} — the generated module and emitted Markdown ` +
          `recorded, every further entry an attributable companion`,
      );

      // Corrupt the product-written record shape-blind (TEST-SPEC T6.6-6;
      // H-3 adapter — garbage over T13.3-2's operational path set, files
      // present but readable as no record).
      await corruptGraphDataShapeBlind(
        record.root,
        "T11.6-4 — corrupt-record staging",
      );

      // Both output forms inside ONE whole-root compare: the inventory
      // leaves the corrupt state neither read-repaired nor replaced (SPEC
      // 11.6, 13.3 — only a successful build or finishing regeneration
      // replaces it).
      await assertLeavesUnchanged(
        record.root,
        async () => {
          for (const argv of [
            ["inventory"],
            ["inventory", "--json"],
          ] as const) {
            const context =
              `T11.6-4 — \`${argv.join(" ")}\` with the record corrupted ` +
              `shape-blind: recorded explicitly unavailable beside the one ` +
              `condition-23 finding, every other member in full (SPEC ` +
              `14.23, 11.6)`;
            const result = await expectExit(
              product,
              record,
              argv,
              1,
              `${context} — an answer carrying a finding and ` +
                `explicitly-unavailable data exits 1, emitted in full ` +
                `(SPEC 14.23, 12.0)`,
            );
            const document = decodeInventoryDocument(
              parseJsonStdout(
                result,
                `${context} — inventory is JSON-only: a single JSON ` +
                  `document as the entire stdout (SPEC 11, 12.0)`,
              ),
              context,
            );
            // The one finding an inventory answer ever carries: exactly one
            // condition-23 finding. The counting key "14.23" is the
            // token-derived identity, so this pins the stable code
            // `unreadable-record` exactly (an unknown or misspelled code
            // fails the decode; a different token counts elsewhere).
            assertConditionCounts(
              document.findings,
              { "14.23": 1 },
              `${context} — exactly the one condition-23 finding (stable ` +
                `code unreadable-record) — the workspace is otherwise ` +
                `clean, and the inventory meets no other condition (SPEC ` +
                `14.23, 11.6, 14)`,
            );
            const finding = document.findings[0]!;
            assertFindingConcernsPath(
              finding,
              GRAPH_DATA_AREA_PATH,
              `${context} — the concerned path is the graph-data area, the ` +
                `.xspec directory spelled workspace-relative with no ` +
                `trailing separator (SPEC 14.23, 11.6)`,
            );
            assertSameJson(
              finding.locations,
              [],
              `${context} — no path inside the area is named: the record's ` +
                `layout is deliberately unenumerated (SPEC 14.23, 13.3), ` +
                `and a path-concerned condition is unlocated — locations ` +
                `[] (SPEC 12.7)`,
            );
            assertSameJson(
              document.recorded,
              { state: "unavailable" },
              `${context} — the record-supplied datum is exactly the ` +
                `unavailability marker: never fabricated, never read as an ` +
                `empty record (the intact premise recorded real paths, so ` +
                `[] here would be a fabrication) (SPEC 14.23, 11.6, 12.7)`,
            );
            assertSameJson(
              inventoryApartFromRecordSupplied(document),
              inventoryApartFromRecordSupplied(intact.document),
              `${context} — every other member emitted in full: the ` +
                `anchoring, configuration, sources, derived map, area, ` +
                `journal, and sessions equal to the intact-record answer ` +
                `on this same workspace (SPEC 14.23, 11.6)`,
            );
          }
        },
        "T11.6-4 — `inventory` on the corrupt record modifies nothing: the " +
          "corrupt state is left neither read-repaired nor replaced, every " +
          "byte untouched (SPEC 11.6, 13.3, 14.23)",
      );
    } finally {
      await record.dispose();
    }
  },
});

export const section116Tests: readonly ProductTestEntry[] = [
  T11_6_1,
  T11_6_2,
  T11_6_3,
  T11_6_4,
];
