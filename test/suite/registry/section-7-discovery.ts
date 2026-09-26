// TEST-SPEC §7 discovery (glob semantics, symbolic links, discovery
// boundaries) — SUITE-27: T7-4…T7-6. Configuration basics (T7-1…T7-3) live in
// section-7-basics.ts; the §7.1–7.5 tests belong to later tasks.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), decodes reports through the H-3 adapters,
// and rejects a product only via diagnosed assertion failures (H-8).
//
// SPEC 7: globs support exactly `*` (any possibly empty run of bytes within
// one path segment), `?` (one byte within a segment), and `**` (any number of
// whole segments, including none) — every other character is a literal;
// matching is byte-wise (workspace-relative paths as their UTF-8 bytes) and
// case-sensitive; a path segment beginning with `.` is matched only by a
// pattern segment written with a leading `.`; `**` means any segments only
// as a whole pattern segment (elsewhere each `*` of a `**` is the
// single-segment wildcard); patterns resolve relative to the configuration
// file's directory, and whether one lies outside the workspace root is
// decided by its spelling alone — reading its `/`-separated segments from a
// depth of zero, `..` lowers the depth by one, `.`, an empty segment, and
// `**` leave it unchanged, every other segment (a drive-qualified `C:`
// included) raises it by one; a glob beginning with `/`, or whose depth ever
// falls below zero, is a configuration error (14.14), and every other glob
// is inside, its `.`, `..`, and empty segments matching nothing, since a
// discovered path carries no such segment. Discovery never follows symbolic
// links; derived files are never sources (13.4); imports resolve references
// but never add files to the workspace (2.1, else 14.15); a no-match group
// and an empty `specs`/`code` map are valid with zero sources.
//
// Observation: `ids --json` (12.3) — requirement IDs grouped by file identify
// every discovered source together with its parsed content, so a wrongly
// discovered path surfaces as an extra listing entry (or as the validation
// failure its discovery causes) and a wrongly missed path as an absent one.
// Every discovered fixture file is a valid single-section source carrying an
// ID unique in its workspace, and every decoy (a file that must NOT be
// discovered) is equally valid with its own unique ID: a product that wrongly
// discovers a decoy lists it cleanly instead of crashing, keeping failures
// diagnosed (H-8). T7-4's inside-root arms add `inventory --json` (11.6) as
// a second observation — the glob reported exactly as configured, `sources`
// exactly the control file — and its outside-root arms drive `build`, which
// fails at configuration load and writes nothing (12.1); otherwise T7-4 and
// T7-5 never run `build`, so the only product-written path is graph data
// under `.xspec/` (13.3), which no fixture pattern can reach: none names
// `.xspec/`, no staged name carries `.xspec.`, `markdown` is absent, and
// wildcards never match the dot segment — the CERTIFICATIONS.md CONF-DISC
// staging constraints for these two tests.
//
// T7-6's code-group exclusion arm observes the code side through `query
// edges --from <path>` (11.1), T7-3's idiom for code discovery: a discovered
// code source's whole-file location (4.6) answers exit 0 with its edge
// enumeration — empty, nothing staged here giving a code file an edge —
// while a path in no configured group, an excluded derived path above all,
// is unknown to `--from`: the usage error of 12.0, judged after
// configuration loading and before the 13.3 gate, exit 2 with the 12.7
// error document (the CONF-DISC staging constraint for that arm).
//
// Conservative operationalizations (H-3/H-4):
// - Listing comparisons sort both sides bytewise by file path: these tests
//   assert discovery membership; the report's file ordering is 12.3's own
//   contract, asserted by T12.3-1.
// - The é.mdx byte-semantics arms are gated to the Linux leg by T7-4's own
//   text: Linux file names are byte strings, so the staged two-byte code
//   point reaches the matcher verbatim; other platforms' filesystems
//   normalize or re-case names, so the staged bytes are not portable.
// - T7-5 runs `ids` once over one workspace holding every link arm; the
//   invocation is wrapped so a failure to complete — a discovery hang on the
//   staged symlink cycle, killed by the subprocess driver's timeout (H-8) —
//   is reported as a diagnosed assertion failure: nontermination is exactly
//   the product defect that arm tests (SPEC 7).
// - 14.14 contract: `expectConfigurationError` (shared, ./support.ts).
// - Staged-source records (TEST-SPEC S-9's before-any-product clause;
//   helpers/staged-mdx.ts): every `.mdx` file a body stages in a workspace
//   created after its first product invocation — T7-4's probe workspaces
//   past the semantics one (`StagedProbe.source`) and its outside-root
//   arms, T7-6's arms past (a) — is a ledger record, judged by
//   test/self/s9-staged-sources.test.ts before any product exists: the
//   minimal `a` and `b` sources are section-7-basics.ts's shared records,
//   `c`, `m`, and `n` this module's, and T7-6's import arms' sources their
//   own. Each body's first workspace (T7-4's semantics probes, T7-5's link
//   workspace, T7-6's exclusion workspace) precedes any invocation and stays
//   plain; the files T7-4 and T7-5 write beside the root (`stageBesideRoot`,
//   a raw write outside the builder) stay strings — `x/M.mdx` the one the
//   `m` record is made from.

import { Buffer } from "node:buffer";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import {
  decodeEdgesReport,
  decodeIdsReport,
  decodeInventoryDocument,
} from "../../helpers/adapters/index.js";
import {
  assertExitCode,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import type { ProductBinding, RunResult } from "../../helpers/subprocess.js";
import { assertLeavesUnchanged } from "../../helpers/snapshot.js";
import { stagedMdx } from "../../helpers/staged-mdx.js";
import type { StagedMdx } from "../../helpers/staged-mdx.js";
import { runProduct, summarizeResult } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type {
  InitialFileContents,
  WorkspaceDecl,
} from "../../helpers/workspace.js";
import { SECTION_A_SOURCE, SECTION_B_SOURCE } from "./section-7-basics.js";
import {
  assertConditionCounts,
  assertEdgeSetEqual,
  assertFindingLocated,
  assertSameJson,
  buildFindings,
  buildOk,
  byteWindow,
  expectConfigurationError,
  expectErrorDocument,
  expectExit,
  runJson,
  stageBesideRoot,
} from "./support.js";

// ---------------------------------------------------------------------------
// Shared fixture material
// ---------------------------------------------------------------------------

/** A minimal valid single-section source: one node `<id>` under the root. */
function mdxSection(id: string): string {
  return `<S id="${id}">\nText for ${id}.\n</S>\n`;
}

// This module's own staged-source records (module header), beside
// section-7-basics.ts's shared `a` and `b`: the minimal sources T7-4's later
// probe workspaces stage — `c`, the control of the casing and inside-root
// workspaces; `m` and `n`, the inside-root decoys, `n` also T7-6's no-group
// source at `notes/N.mdx` — one record per byte sequence, named with every
// staging test and path.
const SECTION_C_SOURCE = stagedMdx(
  "T7-4 ctl/C.mdx (the minimal section c, the control source)",
  mdxSection("c"),
);
/** `mdxSection("m")`: the `b/M.mdx` decoy's record is made from it, and
 * `stageBesideRoot` writes it at `x/M.mdx` beside the root. */
const M_SOURCE = mdxSection("m");
const SECTION_M_SOURCE = stagedMdx(
  "T7-4 b/M.mdx (the minimal section m, the ascent decoy)",
  M_SOURCE,
);
const SECTION_N_SOURCE = stagedMdx(
  "T7-4/T7-6 the minimal section n (T7-4's a/N.mdx; T7-6's notes/N.mdx)",
  mdxSection("n"),
);

/**
 * A declarative configuration (SPEC 7) whose `specs` map holds exactly the
 * given groups. Group names are non-computed identifier keys; patterns are
 * rendered as static string literals.
 */
function specGroupsConfig(
  groups: Readonly<Record<string, readonly string[]>>,
): string {
  const entries = Object.entries(groups)
    .map(
      ([name, patterns]) =>
        `    ${name}: [${patterns.map((p) => JSON.stringify(p)).join(", ")}]`,
    )
    .join(",\n");
  return `import { defineConfig } from "xspec"\n\nexport default defineConfig({\n  specs: {\n${entries}\n  }\n})\n`;
}

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

/** One `{file, ids}` listing entry (the ids report's flat form, 12.3). */
interface ListingEntry {
  readonly file: string;
  readonly ids: readonly string[];
}

/** Copy of a listing sorted bytewise by file path (module header: membership
 * is these tests' subject; the report's own ordering is T12.3-1's). */
function sortedListing(entries: readonly ListingEntry[]): ListingEntry[] {
  return entries
    .map((entry) => ({ file: entry.file, ids: entry.ids }))
    .sort((a, b) =>
      Buffer.compare(Buffer.from(a.file, "utf8"), Buffer.from(b.file, "utf8")),
    );
}

/**
 * Run `ids --json` (12.3) and assert the discovered set: exit 0 with exactly
 * one JSON document, whose file/ID listing equals `expected` up to file order
 * (compared bytewise-sorted on both sides).
 */
async function expectDiscovered(
  product: ProductBinding,
  workspace: TestWorkspace,
  expected: readonly ListingEntry[],
  context: string,
  cwd?: string,
): Promise<void> {
  const result = await runProduct(product, {
    cwd: cwd ?? workspace.root,
    argv: ["ids", "--json"],
  });
  assertExitCode(
    result,
    0,
    `${context} — the workspace's discovered sources are all valid, so ` +
      `\`ids\` answers (SPEC 12.3, 13.3)`,
  );
  const report = decodeIdsReport(parseJsonStdout(result, context), context);
  assertSameJson(
    sortedListing(report.files),
    sortedListing(expected),
    `${context}: the discovered set — requirement IDs grouped by file, ` +
      `compared bytewise-sorted by path (SPEC 12.3; membership per SPEC 7)`,
  );
}

// ---------------------------------------------------------------------------
// T7-4 — glob semantics
// ---------------------------------------------------------------------------

// One discovery probe: a staged file and whether the configured patterns must
// match it. Every probe file is a valid single-section source with a unique
// ID (module header), so the discovered set is asserted as an exact listing.
interface DiscoveryProbe {
  readonly path: string;
  readonly id: string;
  readonly discovered: boolean;
  /**
   * The staged-source record holding `mdxSection(id)` — required of every
   * probe of a workspace created after T7-4's first product invocation
   * (`StagedProbe`; module header); absent for the semantics probes, the
   * body's first workspace, staged plain.
   */
  readonly source?: StagedMdx;
}

/** A probe of a later workspace: its source a ledger record. */
interface StagedProbe extends DiscoveryProbe {
  readonly source: StagedMdx;
}

function probeFiles(
  probes: readonly DiscoveryProbe[],
): Record<string, InitialFileContents> {
  const files: Record<string, InitialFileContents> = {};
  for (const probe of probes) {
    files[probe.path] = probe.source ?? mdxSection(probe.id);
  }
  return files;
}

function expectedListing(probes: readonly DiscoveryProbe[]): ListingEntry[] {
  return probes
    .filter((probe) => probe.discovered)
    .map((probe) => ({ file: probe.path, ids: [probe.id] }));
}

// The wildcard/dot/literal semantics workspace: one group per probe
// directory, directories mutually disjoint so no probe's match can mask
// another group's (mis)behavior. SPEC 7's grammar, arm by arm.
const SEMANTICS_GROUPS: Readonly<Record<string, readonly string[]>> = {
  // `*`: any possibly empty run of bytes within ONE segment.
  star: ["star/a*.mdx"],
  // `?`: exactly one byte within a segment.
  oneByte: ["q/?.mdx"],
  // `**`: any number of whole segments, including none.
  segments: ["deep/**/z.mdx"],
  // Dot-segment rule: wildcards never match a leading dot (T7-4's three
  // stated probes: `a/**/b.mdx` vs `a/.h/b.mdx`, `*` vs `.hidden`, `?x` vs
  // `.x`)...
  dotDoubleStar: ["dota/**/b.mdx"],
  dotStar: ["dotb/*.mdx"],
  dotQuestion: ["dotc/?x.mdx"],
  // ...while a pattern segment written with a leading `.` does match one.
  dotLiteral: ["dotd/.h/b.mdx"],
  dotPrefixed: ["dote/.*.mdx"],
  // Literal metacharacters (SPEC 7: every character outside `*`/`?`/`**` is a
  // literal): `[1]`, `{a,c}`, `!`, `+(x)` match exactly the file names
  // containing those characters — never what a character-class,
  // brace-expansion, negation, or extglob dialect would match.
  literalBrackets: ["litbr/a[1].mdx"],
  literalBraces: ["litbrace/b{a,c}.mdx"],
  literalBang: ["litbang/!x.mdx"],
  literalExtglob: ["litext/+(x).mdx"],
  // In-segment `**` (SPEC 7: `**` means any segments only as a whole pattern
  // segment; elsewhere each `*` of a `**` is the single-segment wildcard).
  inSegmentDoubleStar: ["dstar/a**b.mdx"],
};

const SEMANTICS_PROBES: readonly DiscoveryProbe[] = [
  // `*` — empty run, multi-byte run, literal prefix, segment confinement.
  { path: "star/a.mdx", id: "s1", discovered: true },
  { path: "star/abc.mdx", id: "s2", discovered: true },
  { path: "star/b.mdx", id: "s3", discovered: false },
  // `star/a*.mdx` has two segments; a `*` crossing `/` (a naive regex `.*`)
  // would wrongly reach this three-segment path.
  { path: "star/ax/y.mdx", id: "s4", discovered: false },
  // `?` — exactly one byte, not two.
  { path: "q/a.mdx", id: "q1", discovered: true },
  { path: "q/ab.mdx", id: "q2", discovered: false },
  // `**` — zero, one, and two whole segments; never a partial segment.
  { path: "deep/z.mdx", id: "d1", discovered: true },
  { path: "deep/m/z.mdx", id: "d2", discovered: true },
  { path: "deep/m/n/z.mdx", id: "d3", discovered: true },
  { path: "deep/mz.mdx", id: "d4", discovered: false },
  // Dot-segment rule, negative: `**`, `*`, and `?` never match a leading dot.
  { path: "dota/h/b.mdx", id: "t1", discovered: true },
  { path: "dota/.h/b.mdx", id: "t2", discovered: false },
  { path: "dotb/plain.mdx", id: "t3", discovered: true },
  { path: "dotb/.hidden.mdx", id: "t4", discovered: false },
  { path: "dotc/ax.mdx", id: "t5", discovered: true },
  { path: "dotc/.x.mdx", id: "t6", discovered: false },
  // Dot-segment rule, positive: a pattern segment written with a leading `.`
  // does match — literally (`.h`) and with a trailing wildcard (`.*.mdx`).
  { path: "dotd/.h/b.mdx", id: "t7", discovered: true },
  { path: "dote/.hidden.mdx", id: "t8", discovered: true },
  // Literal `[1]`: the bracket-bearing name matches; the name a
  // character-class dialect would match does not.
  { path: "litbr/a[1].mdx", id: "l1", discovered: true },
  { path: "litbr/a1.mdx", id: "l2", discovered: false },
  // Literal `{a,c}`: the brace-bearing name matches; brace-expansion
  // candidates do not.
  { path: "litbrace/b{a,c}.mdx", id: "l3", discovered: true },
  { path: "litbrace/ba.mdx", id: "l4", discovered: false },
  { path: "litbrace/bc.mdx", id: "l5", discovered: false },
  // Literal `!`: the bang-bearing name matches; a negation dialect
  // ("everything but x.mdx") would instead match the sibling.
  { path: "litbang/!x.mdx", id: "l6", discovered: true },
  { path: "litbang/y.mdx", id: "l7", discovered: false },
  // Literal `+(x)`: the extglob-looking name matches; what extglob `+(x)`
  // (one or more `x`) would match does not.
  { path: "litext/+(x).mdx", id: "l8", discovered: true },
  { path: "litext/x.mdx", id: "l9", discovered: false },
  { path: "litext/xx.mdx", id: "l10", discovered: false },
  // In-segment `**`: each `*` a possibly empty single-segment run, so
  // `axxb.mdx` and `ab.mdx` match and the two-segment `a/b.mdx` never does.
  { path: "dstar/axxb.mdx", id: "g1", discovered: true },
  { path: "dstar/ab.mdx", id: "g2", discovered: true },
  { path: "dstar/a/b.mdx", id: "g3", discovered: false },
];

// Single-casing case-sensitivity probes (T7-4: stageable on any filesystem —
// each path exists in exactly one casing, so nothing collides on
// case-insensitive filesystems): a group whose only pattern is `SPECS/*.mdx`
// over a workspace directory `specs/` holding `A.mdx` discovers zero sources
// (rerun on the Windows leg, E-6/CI-01), and a file-level twin (`specs2/b.mdx`
// over `specs2/B.mdx`) likewise. The control group pins that discovery ran.
const CASING_GROUPS: Readonly<Record<string, readonly string[]>> = {
  probe: ["SPECS/*.mdx"],
  fileProbe: ["specs2/b.mdx"],
  control: ["ctl/*.mdx"],
};

const CASING_PROBES: readonly StagedProbe[] = [
  { path: "specs/A.mdx", id: "a", discovered: false, source: SECTION_A_SOURCE },
  {
    path: "specs2/B.mdx",
    id: "b",
    discovered: false,
    source: SECTION_B_SOURCE,
  },
  { path: "ctl/C.mdx", id: "c", discovered: true, source: SECTION_C_SOURCE },
];

/**
 * T7-4's single-casing glob probe as one shared code path: called by the
 * registered T7-4 body on the suite leg and rerun verbatim by the Windows leg
 * (TEST-SPEC E-6; test/windows/e6-subset.test.ts). Glob matching is
 * case-sensitive on every platform (SPEC 7, 12.0): `SPECS/*.mdx` over
 * `specs/A.mdx` (and `specs2/b.mdx` over `specs2/B.mdx`) discovers nothing —
 * on a case-insensitive filesystem a product matching globs through
 * filesystem lookups wrongly discovers the file. Each path is staged in
 * exactly one casing, so the fixture stages identically everywhere.
 */
export async function runT74SingleCasingGlobProbe(
  product: ProductBinding,
): Promise<void> {
  await withWorkspace(
    {
      files: {
        "xspec.config.ts": specGroupsConfig(CASING_GROUPS),
        ...probeFiles(CASING_PROBES),
      },
    },
    async (workspace) => {
      await expectDiscovered(
        product,
        workspace,
        expectedListing(CASING_PROBES),
        "T7-4 (single-casing case-sensitivity probes: SPECS/*.mdx over " +
          "specs/A.mdx, specs2/b.mdx over specs2/B.mdx) `ids --json`",
      );
    },
  );
}

// Byte-semantics probes (T7-4, Linux leg — module header): `é` is U+00E9,
// two bytes (0xC3 0xA9) in UTF-8, one character. Paths match as their UTF-8
// bytes (SPEC 7), so `?` (one byte) must NOT match `é.mdx` while `??` (two
// bytes) and `*` must — a character-semantics matcher decides all three the
// other way. The `?`-arm runs in its own workspace: discovery is the union
// over groups, so sharing a workspace with the `??`/`*` groups would mask a
// wrong `?` match.
const BYTE_ONE_GROUPS: Readonly<Record<string, readonly string[]>> = {
  one: ["bytes/?.mdx"],
};
const BYTE_ONE_PROBES: readonly StagedProbe[] = [
  {
    path: "bytes/é.mdx",
    id: "etwo",
    discovered: false,
    source: stagedMdx(
      "T7-4 byte probes bytes/é.mdx (etwo, under bytes/?.mdx)",
      mdxSection("etwo"),
    ),
  },
  {
    path: "bytes/x.mdx",
    id: "xone",
    discovered: true,
    source: stagedMdx(
      "T7-4 byte probes bytes/x.mdx (xone)",
      mdxSection("xone"),
    ),
  },
];
const BYTE_TWO_GROUPS: Readonly<Record<string, readonly string[]>> = {
  two: ["bytes/??.mdx"],
  anyRun: ["bytes2/*.mdx"],
};
const BYTE_TWO_PROBES: readonly StagedProbe[] = [
  {
    path: "bytes/é.mdx",
    id: "e1",
    discovered: true,
    source: stagedMdx(
      "T7-4 byte probes bytes/é.mdx (e1, under bytes/??.mdx)",
      mdxSection("e1"),
    ),
  },
  {
    path: "bytes2/é.mdx",
    id: "e2",
    discovered: true,
    source: stagedMdx("T7-4 byte probes bytes2/é.mdx (e2)", mdxSection("e2")),
  },
];

// Configuration-directory resolution (T7-4: all paths resolve relative to the
// configuration file's directory): run from `sub/`, whose own `sub/specs/`
// holds a source the root configuration's `specs/*.mdx` must NOT see — a
// product resolving globs against the working directory instead of the
// configuration file's directory lists `specs/B.mdx` (id `nested`) in place
// of `specs/A.mdx` (id `roota`).
const CONFIG_DIR_GROUPS: Readonly<Record<string, readonly string[]>> = {
  main: ["specs/*.mdx"],
};
const CONFIG_DIR_PROBES: readonly StagedProbe[] = [
  {
    path: "specs/A.mdx",
    id: "roota",
    discovered: true,
    source: stagedMdx(
      "T7-4 configuration-directory probes specs/A.mdx (roota)",
      mdxSection("roota"),
    ),
  },
  {
    path: "sub/specs/B.mdx",
    id: "nested",
    discovered: false,
    source: stagedMdx(
      "T7-4 configuration-directory probes sub/specs/B.mdx (nested)",
      mdxSection("nested"),
    ),
  },
];

// Outside-root patterns by spelling alone (SPEC 7, 14.14; module header):
// the three spellings T7-4 pins plus the plain ascent. Each fixture also
// stages a valid group and source, so a product that ignores or
// no-match-treats the escaping pattern proceeds to a successful run (exit 0)
// and fails the exit-2 assertion — never exits 2 for a side reason — and the
// root's parent holds `x/M.mdx`, the file the `x` spellings name when
// resolved: a product deciding by what it finds rather than by spelling
// discovers it and exits 0 too. (No file can be staged at the absolute
// `/specs/`, so that arm's premise is the spelling alone.)
const OUTSIDE_ROOT_PATTERNS: readonly string[] = [
  "a/../../x/*.mdx", // the depth falls below zero at the second `..`
  "**/../x/*.mdx", // `**` leaves the depth at zero, so `..` falls below it
  "/specs/*.mdx", // a leading `/`
  "../x/*.mdx", // the plain ascent
];
const BESIDE_ROOT_MATCH: Readonly<Record<string, string>> = {
  "x/M.mdx": M_SOURCE,
};

// Inside-root spellings that match nothing (SPEC 7: every glob not outside
// the root is inside, its `.`, `..`, and empty segments matching nothing,
// since a discovered file's workspace-relative path — the directory-entry
// names descending from the root, `/`-joined — carries no such segment). Each
// spelling runs in its own workspace beside a control group, over the files
// a normalizing product would match through it: `specs/A.mdx` for
// `./specs/*.mdx`, `specs//*.mdx`, `specs/*.mdx/`, and `C:/specs/*.mdx` (a
// drive prefix stripped), and `b/M.mdx` for `a/../b/*.mdx` — `a/N.mdx`
// making `a/` a real directory, so a product walking `a` and then `..`
// reaches `b/` as well.
const INSIDE_NO_MATCH_SPELLINGS: readonly string[] = [
  "a/../b/*.mdx",
  "./specs/*.mdx",
  "specs//*.mdx",
  "specs/*.mdx/",
];
// A drive-qualified spelling is ordinary segments — inside the root and
// matching nothing — on the Linux leg (T7-4), where `C:` is a plain
// directory name; other platforms' semantics for `C:` are not staged.
const DRIVE_QUALIFIED_SPELLING = "C:/specs/*.mdx";
const CONTROL_GLOB = "ctl/*.mdx";
const INSIDE_NO_MATCH_PROBES: readonly StagedProbe[] = [
  { path: "ctl/C.mdx", id: "c", discovered: true, source: SECTION_C_SOURCE },
  { path: "specs/A.mdx", id: "a", discovered: false, source: SECTION_A_SOURCE },
  { path: "b/M.mdx", id: "m", discovered: false, source: SECTION_M_SOURCE },
  { path: "a/N.mdx", id: "n", discovered: false, source: SECTION_N_SOURCE },
];

/**
 * One inside-root spelling that matches nothing (SPEC 7): a group holding
 * only the spelling discovers zero sources beside the control group —
 * `ids --json` (12.3) lists exactly the control, exit 0 — and
 * `inventory --json` (11.6) reports the glob exactly as configured, with
 * `sources` exactly the control file under its own group. A product
 * normalizing the spelling lists the decoy it then matches.
 */
async function expectInsideMatchingNothing(
  product: ProductBinding,
  spelling: string,
): Promise<void> {
  const shown = JSON.stringify(spelling);
  await withWorkspace(
    {
      files: {
        "xspec.config.ts": specGroupsConfig({
          probe: [spelling],
          control: [CONTROL_GLOB],
        }),
        ...probeFiles(INSIDE_NO_MATCH_PROBES),
      },
    },
    async (workspace) => {
      await expectDiscovered(
        product,
        workspace,
        expectedListing(INSIDE_NO_MATCH_PROBES),
        `T7-4 (the inside-root spelling ${shown} matches nothing: a ` +
          `discovered path carries no ".", "..", or empty segment) ` +
          "`ids --json`",
      );
      const label = `T7-4 (the inside-root spelling ${shown}) \`inventory --json\``;
      const inventory = decodeInventoryDocument(
        await runJson(product, workspace, ["inventory", "--json"], label),
        label,
      );
      assertSameJson(
        inventory.configuration.specs,
        [
          { name: "probe", globs: [spelling] },
          { name: "control", globs: [CONTROL_GLOB] },
        ],
        `${label}: the glob is reported exactly as configured — never a ` +
          `normalized spelling (SPEC 7, 11.6)`,
      );
      assertSameJson(
        inventory.sources,
        [{ path: "ctl/C.mdx", groups: [{ name: "control", kind: "spec" }] }],
        `${label}: the group holding only ${shown} discovers zero sources — ` +
          `the control file under its own group is the whole discovered ` +
          `set (SPEC 7, 11.6)`,
      );
    },
  );
}

const T7_4 = defineProductTest({
  id: "T7-4",
  title:
    "glob semantics: `*`/`?`/`**` per SPEC 7 (in-segment `a**b.mdx` each " +
    "`*` the single-segment wildcard), byte-wise case-sensitive matching " +
    "incl. the single-casing SPECS/specs probe and the Linux-leg é.mdx " +
    "byte probes, the dot-segment rule, literal metacharacters ([1], " +
    "{a,c}, !, +(x)), configuration-directory-relative resolution, " +
    "outside-root patterns by spelling alone (`a/../../x`, `**/../x`, a " +
    "leading `/`) as configuration errors even with a matching file " +
    "beside the root (SPEC 7, 14.14), and inside-root spellings " +
    "(`a/../b`, `./specs`, `specs//`, `specs/*.mdx/`, Linux-leg `C:/`) " +
    "matching nothing with the inventory reporting them as configured " +
    "(SPEC 7, 11.6)",
  run: async (product) => {
    // Wildcard, dot-segment, and literal-metacharacter semantics — disjoint
    // per-directory groups over one workspace, asserted as one exact set.
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": specGroupsConfig(SEMANTICS_GROUPS),
          ...probeFiles(SEMANTICS_PROBES),
        },
      },
      async (workspace) => {
        await expectDiscovered(
          product,
          workspace,
          expectedListing(SEMANTICS_PROBES),
          "T7-4 (wildcard/dot/literal semantics) `ids --json`",
        );
      },
    );

    // Case-sensitive matching: the single-casing probes discover nothing;
    // the control group proves discovery ran. Shared code path with the
    // Windows-leg rerun (E-6/CI-01).
    await runT74SingleCasingGlobProbe(product);

    // Patterns resolve relative to the configuration file's directory, not
    // the working directory.
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": specGroupsConfig(CONFIG_DIR_GROUPS),
          ...probeFiles(CONFIG_DIR_PROBES),
        },
      },
      async (workspace) => {
        await expectDiscovered(
          product,
          workspace,
          expectedListing(CONFIG_DIR_PROBES),
          "T7-4 (globs resolve against the configuration file's directory) " +
            "`ids --json` run from sub/",
          workspace.path("sub"),
        );
      },
    );

    // Byte semantics — Linux leg per T7-4's own text (module header).
    if (process.platform === "linux") {
      await withWorkspace(
        {
          files: {
            "xspec.config.ts": specGroupsConfig(BYTE_ONE_GROUPS),
            ...probeFiles(BYTE_ONE_PROBES),
          },
        },
        async (workspace) => {
          await expectDiscovered(
            product,
            workspace,
            expectedListing(BYTE_ONE_PROBES),
            "T7-4 (byte semantics, Linux leg: `?` is one byte, so " +
              "bytes/?.mdx does not match the two-byte é.mdx) `ids --json`",
          );
        },
      );
      await withWorkspace(
        {
          files: {
            "xspec.config.ts": specGroupsConfig(BYTE_TWO_GROUPS),
            ...probeFiles(BYTE_TWO_PROBES),
          },
        },
        async (workspace) => {
          await expectDiscovered(
            product,
            workspace,
            expectedListing(BYTE_TWO_PROBES),
            "T7-4 (byte semantics, Linux leg: `??` — two bytes — and `*` " +
              "both match é.mdx) `ids --json`",
          );
        },
      );
    }

    // A pattern outside the workspace root by its spelling alone → 14.14
    // (exit 2), the root's parent holding the file the `x` spellings name
    // when resolved; the error document's finding carries the stable code
    // and the configuration file as its concerned path (SPEC 14, 12.7), and
    // a build failing at configuration load writes nothing (12.1).
    for (const pattern of OUTSIDE_ROOT_PATTERNS) {
      await withWorkspace(
        {
          files: {
            "xspec.config.ts": specGroupsConfig({
              main: ["specs/*.mdx"],
              escape: [pattern],
            }),
            "specs/A.mdx": SECTION_A_SOURCE,
          },
        },
        async (workspace) => {
          await stageBesideRoot(workspace, BESIDE_ROOT_MATCH);
          const context =
            `T7-4 (the pattern ${JSON.stringify(pattern)} lies outside the ` +
            `workspace root by its spelling alone, a matching file beside ` +
            `the root notwithstanding) \`build --json\``;
          const result = await assertLeavesUnchanged(
            workspace.root,
            () =>
              expectConfigurationError(product, workspace, ["build"], context),
            context,
          );
          const finding = expectErrorDocument(result, context);
          assertSameJson(
            {
              code: finding.code,
              path: finding.path,
              locations: finding.locations.map((location) => location.file),
            },
            {
              code: "configuration-error",
              path: "xspec.config.ts",
              locations: [],
            },
            `${context}: the error document's one finding carries the ` +
              `stable code "configuration-error", locations [] (an ` +
              `unlocated condition), and the configuration file as its ` +
              `concerned path (SPEC 14.14, 14, 12.7)`,
          );
        },
      );
    }

    // Inside-root spellings match nothing: a group holding only such a glob
    // discovers zero sources (exit 0), the inventory reporting the glob as
    // configured (SPEC 7, 11.6); the drive-qualified spelling is ordinary
    // segments on the Linux leg.
    for (const spelling of INSIDE_NO_MATCH_SPELLINGS) {
      await expectInsideMatchingNothing(product, spelling);
    }
    if (process.platform === "linux") {
      await expectInsideMatchingNothing(product, DRIVE_QUALIFIED_SPELLING);
    }
  },
});

// ---------------------------------------------------------------------------
// T7-5 — symbolic links
// ---------------------------------------------------------------------------

// One workspace holds every T7-5 arm (SPEC 7: discovery never follows
// symbolic links — to a file or a directory, broken or not — so symlinked,
// cyclic, or workspace-external content never enters the discovered set):
//
//   real/R.mdx                     regular source — positive control
//   links/file-link.mdx  → ../targets/T.mdx      glob-matched file symlink to
//                                                an existing workspace file:
//                                                never discovered
//   links/external.mdx   → ../../outside/X.mdx   glob-matched file symlink to
//                                                content outside the
//                                                workspace root: never enters
//                                                the discovered set
//   links/broken.mdx     → missing.mdx           dangling link: ignored
//   links/dir            → ../realdir            directory symlink: never
//                                                traversed, so realdir/D.mdx
//                                                is not discovered as
//                                                links/dir/D.mdx
//   cyc/self             → .                     directory symlink cycle of
//                                                length one: discovery of
//                                                cyc/ must terminate
//   cyc/C.mdx                                    regular source inside the
//                                                cycle directory — proves
//                                                cyc/ was scanned
//
// targets/T.mdx and realdir/D.mdx are matched by no pattern; every link
// target holds a valid single-section source with its own unique ID, so a
// link-following product lists the extra files cleanly (diagnosed listing
// mismatch, not a crash) — and VIOL-DISC-SYMLINK fails exactly this way
// (CERTIFICATIONS.md: by assertion, not by hang).
const SYMLINK_GROUPS: Readonly<Record<string, readonly string[]>> = {
  real: ["real/*.mdx"],
  links: ["links/**/*.mdx"],
  cycle: ["cyc/**/*.mdx"],
};

const SYMLINK_EXPECTED: readonly ListingEntry[] = [
  { file: "cyc/C.mdx", ids: ["c"] },
  { file: "real/R.mdx", ids: ["r"] },
];

const T7_5 = defineProductTest({
  id: "T7-5",
  title:
    "symbolic links: a symlinked file matched by a glob is not discovered, " +
    "a symlinked directory is not traversed, broken links are ignored, a " +
    "symlink cycle does not hang discovery, and workspace-external content " +
    "behind a link never enters the discovered set (SPEC 7)",
  run: async (product) => {
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": specGroupsConfig(SYMLINK_GROUPS),
          "real/R.mdx": mdxSection("r"),
          "targets/T.mdx": mdxSection("t"),
          "realdir/D.mdx": mdxSection("d"),
          "cyc/C.mdx": mdxSection("c"),
        },
      },
      async (workspace) => {
        // Links staged explicitly so directory links carry the Windows
        // link-type hint (ignored on POSIX; the suite's CI leg is Linux).
        await workspace.symlink("links/file-link.mdx", "../targets/T.mdx");
        await workspace.symlink("links/broken.mdx", "missing.mdx");
        await workspace.symlink("links/dir", "../realdir", "dir");
        await workspace.symlink("cyc/self", ".", "dir");
        // Workspace-external content: a valid source OUTSIDE the workspace
        // root (beside it in the test-owned temporary directory, disposed
        // with the workspace), reachable only through the link.
        const outside = path.join(workspace.tempRoot, "outside");
        await fsp.mkdir(outside, { recursive: true });
        await fsp.writeFile(path.join(outside, "X.mdx"), mdxSection("x"));
        await workspace.symlink("links/external.mdx", "../../outside/X.mdx");

        const context = "T7-5 `ids --json` over the symbolic-link workspace";
        const result: RunResult = await runProduct(product, {
          cwd: workspace.root,
          argv: ["ids", "--json"],
        }).catch((error: unknown) =>
          // Module header: a run that fails to complete — the staged symlink
          // cycle hanging discovery until the subprocess driver kills it —
          // is the tested defect, diagnosed here (SPEC 7; H-8).
          fail(
            `${context}: discovery must terminate without following ` +
              `symbolic links — in particular, the staged symlink cycle ` +
              `(cyc/self -> .) must not hang it (SPEC 7); the invocation ` +
              `did not complete: ` +
              (error instanceof Error ? error.message : String(error)),
          ),
        );
        assertExitCode(
          result,
          0,
          `${context} — symlinked files are never discovered, symlinked ` +
            `directories never traversed, and broken links ignored, so the ` +
            `workspace holds only its two valid regular sources and \`ids\` ` +
            `answers (SPEC 7, 12.3)`,
        );
        const report = decodeIdsReport(
          parseJsonStdout(result, context),
          context,
        );
        assertSameJson(
          sortedListing(report.files),
          sortedListing(SYMLINK_EXPECTED),
          `${context}: exactly the two regular sources are discovered — no ` +
            `file symlink (workspace-internal or external target), no ` +
            `directory-symlink content, no broken link (SPEC 7)`,
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T7-6 — discovery boundaries
// ---------------------------------------------------------------------------

// Exclusion arms (SPEC 13.4: derived files are never sources — paths whose
// file name contains `.xspec.`, files under `.xspec/`, and files at the
// configured Markdown emit destinations are excluded from every spec and
// code group), staged on both group sides (the CERTIFICATIONS.md CONF-DISC
// staging constraint). The spec side, observed through `ids`:
//
//   specs/A.mdx        the one real source (id `a`)
//   specs/A.md         user-authored file at A.mdx's emit destination —
//                      emission enabled and never yet run, so classification
//                      is by configuration alone (7.3); matched by `specs/*`
//                      but excluded: not discovered, and no 14.19 despite
//                      lacking `.mdx`
//   specs/B.xspec.mdx  valid `.mdx` content at a `.xspec.`-bearing name,
//                      matched by `specs/*`: excluded
//   .xspec/direct.mdx  valid `.mdx` content under `.xspec/`, matched by a
//                      pattern spelling the dot segment literally
//                      (`.xspec/*.mdx`, past the dot-segment rule): excluded
//
// The `build` between the two listings regenerates derived files (12.1) —
// afterwards `specs/*` also matches the generated `A.xspec.*` module and
// companions and the emitted `specs/A.md`, all of which stay excluded, so
// the discovered set is unchanged.
const EXCLUSION_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/*"],
    inside: [".xspec/*.mdx"]
  },
  markdown: { emit: true }
})
`;

const EXCLUSION_EXPECTED: readonly ListingEntry[] = [
  { file: "specs/A.mdx", ids: ["a"] },
];

// The code side, observed through `query edges --from <path>` (SPEC 11.1;
// module header). The spec group `specs/*.mdx` matches specs/A.mdx alone;
// the code group's globs match:
//
//   src/plain.ts       the one code source: well-formed TypeScript spelling
//                      no marker, no spec-module import, no `text` call
//                      (4) — discovered, its whole-file code location (4.6)
//                      a graph node with no edges
//   specs/A.xspec.ts   the module `build` generates beside specs/A.mdx
//                      (13.1), matched by `specs/*.ts` — a file the product
//                      itself wrote under an everyday code glob: excluded
//   .xspec/staged.ts   a staged `.ts` file under `.xspec/`, matched by
//                      `.xspec/*.ts` (the dot segment spelled literally):
//                      excluded
//   specs/A.md         specs/A.mdx's enabled Markdown emit destination
//                      (7.3) — user-authored before `build`, emitted by it
//                      — matched by `specs/*.md`: excluded
//
// and no spec-group file: `specs/*.md` does not match `specs/A.mdx`, so
// 14.14's both-groups rule stays dormant; `specs/*.ts` also matches
// whatever `.xspec.`-named companions the module has (13.1), derived like
// the module. No pattern carries a bracket or brace character and nothing
// is a symbolic link (the VIOL-DISC-DIALECT and VIOL-DISC-SYMLINK staging
// constraints). Each excluded path, in no configured group, is unknown to
// `--from` — the usage error of 12.0, judged after configuration loading
// and before the 13.3 gate: exit 2 with the 12.7 error document, never a
// finding, nothing modified — beside the discovered source's exit-0 control
// showing the group live.
const CODE_EXCLUSION_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/*.mdx"]
  },
  code: {
    impl: ["src/**/*.ts", "specs/*.ts", ".xspec/*.ts", "specs/*.md"]
  },
  markdown: { emit: true }
})
`;

/** The staged code source: well-formed, no marker, spec import, or text call. */
const PLAIN_TS = "export const plain = 1;\n";

/** A well-formed `.ts` file staged under `.xspec/` — derived by path alone. */
const STAGED_UNDER_XSPEC_TS = "export const staged = 2;\n";

/** The excluded paths the code globs match: each arm's premise and rule. */
const CODE_EXCLUDED: readonly {
  readonly path: string;
  readonly premise: string;
  readonly why: string;
}[] = [
  {
    path: "specs/A.xspec.ts",
    premise:
      "NAME.mdx generates NAME.xspec.ts in the source file's directory " +
      "(SPEC 13.1)",
    why:
      "the module `build` generated beside specs/A.mdx (13.1), matched by " +
      "specs/*.ts",
  },
  {
    path: ".xspec/staged.ts",
    premise:
      "the staged file under .xspec/ is a derived path of nothing and a " +
      "recorded derived file of nothing, so `build` neither replaces nor " +
      "removes it (SPEC 12.1, 13.4)",
    why: "a file under .xspec/, matched by .xspec/*.ts",
  },
  {
    path: "specs/A.md",
    premise:
      "with emission enabled, `build` emits specs/A.mdx's Markdown at " +
      "specs/A.md (SPEC 13.2)",
    why:
      "specs/A.mdx's enabled Markdown emit destination (7.3), matched by " +
      "specs/*.md",
  },
];

// Import arms (SPEC 2.1/7: imports resolve references between files but
// never add files to the workspace — the designated file must already be a
// discovered source of a configured spec group, else 14.15).
const IMPORT_NEG_LINE = 'import U from "../other/unlisted.xspec"';
const IMPORT_NEG_SOURCE = stagedMdx(
  "T7-6 specs/A.mdx importing the unmatched other/unlisted.mdx",
  `${IMPORT_NEG_LINE}\n\n<S id="a">\nAlpha behavior.\n</S>\n`,
);
/** The existing but unmatched file the invalid import designates. */
const UNLISTED_SOURCE = stagedMdx(
  "T7-6 other/unlisted.mdx (existing, matched by no group)",
  mdxSection("u"),
);
const IMPORT_POS_SOURCE = stagedMdx(
  "T7-6 specs/A.mdx importing the discovered specs/sub/B.mdx",
  `import B from "./sub/B.xspec"\n\n<S id="a">\nAlpha behavior.\n</S>\n`,
);

const T7_6 = defineProductTest({
  id: "T7-6",
  title:
    "discovery boundaries: derived files (`.xspec.` names, `.xspec/` " +
    "paths, enabled Markdown emit destinations) are never discovered as " +
    "sources of a spec or a code group even when globs match them — the " +
    "code side observed through `query edges --from`; an import never " +
    "adds an unmatched file (14.15); a no-match group and empty " +
    "specs/code maps are valid with zero sources (SPEC 7, 13.4, 2.1, 11.1)",
  run: async (product) => {
    // (a) Derived-file exclusion, before and after a `build`.
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": EXCLUSION_CONFIG,
          "specs/A.mdx": mdxSection("a"),
          "specs/A.md": "User-authored file at the emit destination.\n",
          "specs/B.xspec.mdx": mdxSection("b"),
          ".xspec/direct.mdx": mdxSection("d"),
        },
      },
      async (workspace) => {
        await expectDiscovered(
          product,
          workspace,
          EXCLUSION_EXPECTED,
          "T7-6 (derived-file exclusion, before any build: emission " +
            "enabled but never run — destinations classified by " +
            "configuration alone, 7.3) `ids --json`",
        );
        await buildOk(
          product,
          workspace,
          "T7-6 (derived-file exclusion): `build` — the excluded files are " +
            "no sources, and writing derived files replaces whatever " +
            "occupies their paths (SPEC 12.1, 13.4)",
        );
        await expectDiscovered(
          product,
          workspace,
          EXCLUSION_EXPECTED,
          "T7-6 (derived-file exclusion, after build: the generated " +
            "`A.xspec.*` files and the emitted specs/A.md now exist and " +
            "are matched by specs/* — still excluded, 13.4) `ids --json`",
        );
      },
    );

    // (a') Code-group exclusion, observed through `query edges --from`
    // (11.1): after `build`, the discovered code source answers exit 0 with
    // its empty edge enumeration, while each excluded path the code globs
    // match is unknown — exit 2 with the 12.7 error document, no finding,
    // nothing modified.
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": CODE_EXCLUSION_CONFIG,
          "specs/A.mdx": SECTION_A_SOURCE,
          "specs/A.md": "User-authored file at the emit destination.\n",
          "src/plain.ts": PLAIN_TS,
          ".xspec/staged.ts": STAGED_UNDER_XSPEC_TS,
        },
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T7-6 (code-group exclusion): `build` — the workspace passes " +
            "build's validations: src/plain.ts is a well-formed code " +
            "source, and every other code-glob match is a derived file in " +
            "no group (SPEC 7.2, 13.4)",
        );
        // Premises: each excluded path exists as a plain file after the
        // build — the generated module at its 13.1 path, the emitted
        // Markdown at its 13.2 destination, and the staged file under
        // .xspec/, which `build` has no derived path to replace and no
        // record to remove (12.1, 13.4) — so the refusals below observe the
        // exclusion of existing, glob-matched paths, never a merely absent
        // one.
        for (const excluded of CODE_EXCLUDED) {
          const kind = await workspace.kind(excluded.path);
          if (kind !== "file") {
            fail(
              `T7-6 (code-group exclusion): after \`build\`, expected a ` +
                `plain file at ${excluded.path} — ${excluded.premise}; ` +
                `found ${kind}`,
            );
          }
        }
        const controlLabel =
          "T7-6 (code-group exclusion) `query edges --from src/plain.ts`";
        const edges = decodeEdgesReport(
          await runJson(
            product,
            workspace,
            ["query", "edges", "--from", "src/plain.ts"],
            `${controlLabel} — the discovered code source's whole-file ` +
              `location is a graph node, so the query answers (SPEC 7.2, ` +
              `4.6, 11.1)`,
          ),
          controlLabel,
        );
        assertEdgeSetEqual(
          edges,
          [],
          `${controlLabel}: the edge enumeration is empty — src/plain.ts ` +
            `spells no marker, spec-module import, or text call, so its ` +
            `whole-file location sources no edge (SPEC 4.3, 4.5, 4.6, 5.2)`,
        );
        for (const excluded of CODE_EXCLUDED) {
          const label =
            "T7-6 (code-group exclusion) `query edges --from " +
            `${excluded.path}\``;
          const result = await assertLeavesUnchanged(
            workspace.root,
            () =>
              expectExit(
                product,
                workspace,
                ["query", "edges", "--from", excluded.path],
                2,
                `${label} — ${excluded.why}: a derived file is in no ` +
                  `spec or code group (SPEC 13.4), so the path is unknown ` +
                  `to --from, a usage error judged after configuration ` +
                  `loading and before the 13.3 gate — never a finding ` +
                  `(SPEC 11.1, 12.0)`,
              ),
            `${label}: a refused query modifies nothing — the argument ` +
              `check precedes the gate, and a built workspace's graph data ` +
              `already matches its sources (SPEC 12.0, 13.3)`,
          );
          expectErrorDocument(
            result,
            `${label} — query's single JSON document is its only output ` +
              `form, so JSON output is in effect without --json and the ` +
              `exit-2 error document is the entire stdout (SPEC 11, 12.0, ` +
              `12.7, H-5)`,
          );
          if (result.stderrBytes.length === 0) {
            fail(
              `${label}: the usage error must be a standard-error ` +
                `diagnostic (SPEC 12.0); stderr is empty — ` +
                `${summarizeResult(result)}`,
            );
          }
        }
      },
    );

    // (b) An import never adds an unmatched file: other/unlisted.mdx exists
    // on disk and the specifier resolves to it against the importing file's
    // directory (2.1), but no group matches it — so the import is invalid
    // (14.15, exit 1) instead of the file entering the workspace (a product
    // that adds import targets builds successfully and fails the exit-code
    // assertion).
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": specGroupsConfig({ main: ["specs/*.mdx"] }),
          "specs/A.mdx": IMPORT_NEG_SOURCE,
          "other/unlisted.mdx": UNLISTED_SOURCE,
        },
      },
      async (workspace) => {
        const context =
          "T7-6 (import of an existing but unmatched file) `build --json`";
        const findings = await buildFindings(product, workspace, context);
        assertConditionCounts(findings, { "14.15": 1 }, context);
        assertFindingLocated(
          findings[0]!,
          { file: "specs/A.mdx", window: byteWindow("", IMPORT_NEG_LINE) },
          `${context}: the 14.15 finding`,
        );
      },
    );

    // (b') The positive control: the same import shape whose target IS a
    // discovered source (resolved against the importing file's directory)
    // is valid — and the discovered set is exactly the glob matches, the
    // import adding nothing.
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": specGroupsConfig({ main: ["specs/**/*.mdx"] }),
          "specs/A.mdx": IMPORT_POS_SOURCE,
          "specs/sub/B.mdx": SECTION_B_SOURCE,
        },
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T7-6 (import of a discovered source): `build` — the specifier " +
            "resolves against the importing file's directory to a " +
            "discovered source, so the import is valid (SPEC 2.1)",
        );
        await expectDiscovered(
          product,
          workspace,
          [
            { file: "specs/A.mdx", ids: ["a"] },
            { file: "specs/sub/B.mdx", ids: ["b"] },
          ],
          "T7-6 (import of a discovered source) `ids --json`",
        );
      },
    );

    // (c) A group whose globs match no files is valid: zero sources from it,
    // discovery otherwise unaffected.
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": specGroupsConfig({
            main: ["specs/*.mdx"],
            vacant: ["vacant/**/*.mdx"],
          }),
          "specs/A.mdx": SECTION_A_SOURCE,
        },
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T7-6 (no-match group): `build` — a group whose globs match no " +
            "files is valid (SPEC 7)",
        );
        await expectDiscovered(
          product,
          workspace,
          [{ file: "specs/A.mdx", ids: ["a"] }],
          "T7-6 (no-match group) `ids --json`",
        );
      },
    );

    // (d) Empty `specs` and `code` maps are valid with zero sources: the
    // staged notes/N.mdx belongs to no group (there are none), so discovery
    // yields nothing and both commands still succeed.
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {},
  code: {}
})
`,
          "notes/N.mdx": SECTION_N_SOURCE,
        },
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T7-6 (empty specs/code maps): `build` — a specs or code map " +
            "with no groups is valid; discovery yields zero sources " +
            "(SPEC 7)",
        );
        await expectDiscovered(
          product,
          workspace,
          [],
          "T7-6 (empty specs/code maps) `ids --json`",
        );
      },
    );
  },
});

/** TEST-SPEC §7 discovery T7-4…T7-6, in canonical ID order (SUITE-27). */
export const section7DiscoveryTests: readonly ProductTestEntry[] = [
  T7_4,
  T7_5,
  T7_6,
];
