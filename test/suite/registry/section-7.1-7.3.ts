// TEST-SPEC §7.1–7.3 (spec groups, code groups, markdown configuration) —
// SUITE-28: T7.1-1, T7.2-1, T7.3-1. Configuration basics (T7-1…T7-3) live in
// section-7-basics.ts, discovery (T7-4…T7-6) in section-7-discovery.ts; the
// §7.4–7.5 profile/rule tests belong to SUITE-29.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), decodes reports through the H-3 adapters,
// and rejects a product only via diagnosed assertion failures (H-8).
//
// SPEC 7.1: spec groups are named glob lists; a file MAY belong to multiple
// groups; every matched file MUST have the `.mdx` extension, and its
// workspace-relative path MUST NOT contain U+0022, U+0027, U+005C (the
// backslash), U+000A, U+000D, U+2028, or U+2029, any other match being
// invalid (14.19) — a bar binding spec groups alone, 14.19's code-source
// forms being `#`, U+FFFD, and non-UTF-8. SPEC 7.2: code groups serve as
// coverage boundaries and as the impacted-code population; a file matched
// by both a spec and a code group is a configuration error (14.14). SPEC
// 7.3: `markdown` absent → no emission; when present, `emit` (boolean) is
// REQUIRED and controls emission; `outDir` redirects emitted files
// preserving workspace-relative paths and is a directory path relative to
// the workspace root spelled as one or more non-empty `/`-separated
// segments, none `.` or `..` — the form of every workspace-relative path
// (1.5, 7) — so that each emit destination (`outDir` joined by `/` to the
// default workspace-relative path) is itself a plain workspace-relative
// path; any other spelling — empty, beginning with `/`, or carrying a `.`,
// `..`, or empty segment — is a configuration error (14.14), decided by
// spelling alone, never by where the path would resolve; so is an `outDir`
// of `.xspec` or beginning with `.xspec/` — no emit destination lies in the
// graph-data area (13.3), so graph data is the only derived file under it
// (13.1, 13.4; 11.6's claim); the configured emit destinations exist
// exactly while emission is enabled — with `emit: true` they are the
// destination paths whether or not emission has yet run, with `markdown`
// absent or `emit: false` no path is a destination, so the 13.4 exclusion
// and the import rule of 4 have no Markdown component.
//
// Conservative operationalizations (noted per H-3/H-4):
// - 14.14 contract: `expectConfigurationError` (shared, ./support.ts) — exit
//   2 exactly, the single 12.7 error document (stable code
//   `configuration-error`, concerned path) as the entire stdout under
//   --json, stderr matching /config/i. T7.2-1's overlap arm and T7.3-1's
//   own refusal arms (the local `expectConfigRefused`) further pin, through
//   the local `assertFoundConfigurationConcerned`, the document's `path` to
//   exactly `xspec.config.ts` — the configuration file the upward search
//   found, in the anchoring form of 11.6 relative to the invocation working
//   directory, the workspace root; for the overlap the configuration file,
//   never the doubly matched file — and `locations` to `[]` (a
//   configuration condition carries the file it concerns, never a source
//   range: SPEC 14, 12.7). T7.3-1's arms also compare the workspace around
//   the refused `build`: a build failing at configuration load modifies
//   nothing (SPEC 12.1, 12.0).
// - T7.3-1 `outDir` validity is decided by spelling (SPEC 7.3): one arm per
//   pinned spelling — `""`, `"/out"`, `"./out"`, `"out/../x"`, `"out//x"`,
//   `"out/"` — each 14.14, beside the two `..`-bearing spellings the arm
//   always drove (`"../out"`, `"docs/../../out"`), while `"out/sub"` is the
//   pinned valid multi-segment spelling, asserted through the emission it
//   redirects. No arm depends on where a spelling would resolve: a product
//   normalizing `./out`, `out//x`, or `out/` to a path inside the root, or
//   reading `""` as "next to each source", fails its arm at the exit code.
//   The graph-data area is refused by segment, one arm each: `".xspec"`
//   and `".xspec/md"` are 14.14 through the same refusal contract, beside
//   their look-alike controls `".xspec2"` and `".xspecs/md"`, each valid
//   and asserted through the emission it redirects — its absent directory
//   chain created as real directories (T13.4-8) — so a product testing the
//   byte prefix `.xspec` without its segment boundary fails a control at
//   the exit code, and one accepting the area fails its refused arm there.
// - T7.1-1 coverage: profiles are looked up by name (T8.2-1 owns report
//   ordering and the full report contract — counts and the ignored-node
//   composition are not asserted here); "sees it in both" is asserted as the
//   shared file's leaves appearing in each profile's covered/uncovered sets,
//   the covered node with its exact boundary-to-target path (the harness
//   information model, helpers/adapters/model.ts).
// - T7.1-1 policy findings are compared as sorted "rule :: kind: from -> to"
//   renderings: SPEC 7.5 fixes the information (rule name + offending edge),
//   not an order, and one finding per (rule, edge) pair.
// - T7.1-1 path characters (SPEC 7.1, 14.19): one arm per character 7.1
//   bars in a spec-group file name (`specs/a<c>b.mdx`) plus U+0027 in a
//   directory component (`specs/it's/a.mdx`), each file alone in its own
//   workspace with condition-free content, so its one 14.19 finding — the
//   stable code, `locations` empty, the path as concerned path — is the
//   build's exact multiset. "Still discovered and reachable as T11.2-3's
//   invalid-path files are" is asserted through `view --file <glob>`
//   (T11.5-3's reading of "glob-reached"): exit 1, the file's finding
//   accompanying, one view whose tree keeps its ranges and raw attribute
//   entries with every identity, root included, unavailable (T11.2-3's
//   projection). The U+0022, backslash, U+000A, and U+000D arms — names
//   other filesystems cannot hold — are staged on the Linux leg alone
//   (`process.platform === "linux"`, T1.5-2's precedent), gated in the
//   body; so is the code-source control `src/it's<U+005C>x.ts`, its name
//   holding a backslash, asserted finding-free under `build --json` and
//   `check --json` and through its workspace's exact `query edges` set.
//   Every barred character is built from its code point.
// - T7.3-1 emitted Markdown is byte-asserted (SPEC 3 fixes the compiled
//   bytes; H-4); the compilation semantics themselves are T3-*'s subject —
//   fixture sources are single-section files with trivially known output.
// - T7.3-1 classification-follows-emit, discovery channel: 14.19 constrains
//   spec-group files to `.mdx` (7.1), but no extension rule constrains code
//   groups (14.19/14.20: any non-`.tsx` name parses as plain TypeScript), so
//   a destination path is staged as a *valid* code source — with `emit:
//   false` it must be discovered (its top-level marker's `references` edge
//   exists and `--from` knows the location), with `emit: true` it must not
//   (13.4 excludes destinations from every group). Whole-graph edge-set
//   equality has teeth because the fixture's complete edge set is spec-forced
//   (SPEC 5.1–5.2); the unknown-path `--from` probe uses T7-3's exit-2
//   operationalization (empty stdout, non-empty stderr diagnostic; 12.0).
// - T7.3-1 classification-follows-emit, import-rule channel (T4-2's rule,
//   SPEC 4/13.4/14.15): the identical workspace flips between exactly one
//   14.15 finding (`emit: true` — the specifier designates a configured
//   destination) and a clean build (`emit: false` — no path is a
//   destination, so the ordinary import is outside xspec's validations).
// - Staged-source records (TEST-SPEC S-9's before-any-product clause;
//   helpers/staged-mdx.ts): every MDX source a body stages in a workspace
//   created after its first product invocation — `expectConfigRefused`'s
//   one staging site, T7.1-1's non-`.mdx`-match (its `specs/notes.txt`
//   included: a spec-group file not named `.mdx` is an MDX source all the
//   same, invalid by its name yet judged by 14.20, and a record at that
//   path declares it a well-formed one), path-character (one record staged
//   at every barred path), and code-source-control workspaces, T7.3-1's
//   `EMISSION_FILES` (its first workspace's too, the map being shared) and
//   destination workspaces — is a ledger record, judged by
//   test/self/s9-staged-sources.test.ts before any product exists: the
//   minimal `a` and `b` sources are section-7-basics.ts's shared records,
//   staged byte-identically by the three §7 modules. T7.1-1's two-group
//   workspace and T7.2-1's overlap workspace, each its body's first,
//   precede any invocation and stay plain.
// - TypeScript staged-source records (TEST-SPEC S-9's TypeScript and
//   timing clauses; helpers/staged-ts.ts): every configuration file and
//   code source a body stages in a workspace created after its first
//   product invocation — `expectConfigRefused`'s one staging site (its
//   arm tables' rows each a record made at module load), T7.1-1's
//   non-`.mdx`-match and path-character configurations and its
//   code-source control's configuration and code source (the record
//   staged at `src/it's<U+005C>x.ts`), T7.3-1's emission-matrix variants
//   (the first's too, the table being one), outDir (its graph-data-area
//   look-alikes' included), destination, and configuration-alone
//   workspaces — is a ledger record carrying its S-9
//   declaration, judged by test/self/s9-staged-sources.test.ts before any
//   product exists: every one well-formed, T7.3-1's destination code
//   source at `specs/A.md` included (its record makes the path judged, a
//   name the default does not reach). The same two first workspaces stay
//   plain; `specs/A.md`'s user-authored text in T7.3-1's
//   configuration-alone arm lies in a spec group, no code source, and
//   stays a string.

import { Buffer } from "node:buffer";
import type {
  CoverageProfileReport,
  CoverageReport,
  Finding,
  GraphEdge,
  IdsFileEntry,
  PathValue,
  SourceRange,
  ViewAttributeEntry,
  ViewNode,
} from "../../helpers/adapters/index.js";
import {
  decodeCoverageReport,
  decodeEdgesReport,
  decodeFindingsReport,
  decodeIdsReport,
  decodeViewReport,
} from "../../helpers/adapters/index.js";
import {
  assertBytesEqual,
  assertExitCode,
  assertFileBytes,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import {
  assertSnapshotsEqual,
  snapshotDirectory,
} from "../../helpers/snapshot.js";
import { stagedMdx } from "../../helpers/staged-mdx.js";
import { type StagedTs, stagedTs } from "../../helpers/staged-ts.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import { summarizeResult } from "../../helpers/subprocess.js";
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
  expectFindingFreeReport,
  runCli,
  runJson,
} from "./support.js";

// ---------------------------------------------------------------------------
// Shared fixture material
// ---------------------------------------------------------------------------

/** A minimal valid single-section source: one node `<id>` under the root. */
function mdxSection(id: string): string {
  return `<S id="${id}">\nText for ${id}.\n</S>\n`;
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

/** Copy of an ids listing sorted bytewise by file path (module header:
 * membership is this module's subject; the report's own file ordering is
 * T12.3-1's contract). */
function sortedListing(entries: readonly IdsFileEntry[]): IdsFileEntry[] {
  return entries
    .map((entry) => ({ file: entry.file, ids: entry.ids }))
    .sort((a, b) =>
      Buffer.compare(Buffer.from(a.file, "utf8"), Buffer.from(b.file, "utf8")),
    );
}

/**
 * Run `ids --json` (12.3) and assert the discovered set: exit 0 with exactly
 * one JSON document whose file/ID listing equals `expected` up to file order.
 */
async function expectIdsListing(
  product: ProductBinding,
  workspace: TestWorkspace,
  expected: readonly IdsFileEntry[],
  context: string,
): Promise<void> {
  const report = decodeIdsReport(
    await runJson(product, workspace, ["ids", "--json"], context),
    context,
  );
  assertSameJson(
    sortedListing(report.files),
    sortedListing(expected),
    `${context}: the discovered set — requirement IDs grouped by file, ` +
      `compared bytewise-sorted by path (SPEC 12.3; membership per SPEC 7)`,
  );
}

/**
 * Assert a configuration error's one finding — its 12.7 error document
 * decoded by `expectErrorDocument` — concerns the configuration file the
 * upward search found: the stable code "configuration-error", `locations`
 * [] (a configuration condition carries the file it concerns, never a
 * source range), and as its concerned path that file in the anchoring form
 * of 11.6 relative to the invocation working directory. Every caller runs
 * its invocation at the workspace root, where the staged `xspec.config.ts`
 * sits, so the path is exactly "xspec.config.ts" (SPEC 14, 12.7, 11.6)
 * whatever the defect — T7.2-1's overlap included, whose doubly matched
 * file is never the concerned path. `citation` lists the SPEC sections the
 * failure cites.
 */
function assertFoundConfigurationConcerned(
  finding: Finding,
  context: string,
  citation: string,
): void {
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
    `${context}: the error document's one finding carries the stable ` +
      `code "configuration-error", locations [] (a configuration ` +
      `condition carries the file it concerns, never a source range), ` +
      `and as its concerned path the configuration file the upward ` +
      `search found, in the anchoring form of 11.6 relative to the ` +
      `invocation working directory — the workspace root, so exactly ` +
      `"xspec.config.ts" (${citation})`,
  );
}

/**
 * Stage a workspace whose only defect is the given configuration — a
 * staged-source record, well-formed (module header), since T7.3-1 stages
 * every arm after its first product invocation (S-9's timing clause) — and
 * assert `build --json` refuses it per 14.14, its one finding concerning
 * the configuration file (`assertFoundConfigurationConcerned`). The staged
 * source is valid and matched by every fixture configuration's spec glob,
 * so a product that wrongly accepts the configuration proceeds to a
 * successful build (exit 0) and fails the exit-code assertion — never exits
 * 2 for a side reason.
 */
async function expectConfigRefused(
  product: ProductBinding,
  config: StagedTs,
  context: string,
): Promise<void> {
  await withWorkspace(
    {
      files: {
        "xspec.config.ts": config,
        "specs/A.mdx": SECTION_A_SOURCE,
      },
    },
    async (workspace) => {
      const before = await snapshotDirectory(workspace.root);
      const result = await expectConfigurationError(
        product,
        workspace,
        ["build"],
        context,
      );
      assertFoundConfigurationConcerned(
        expectErrorDocument(result, context),
        context,
        "SPEC 14, 12.7, 11.6",
      );
      assertSnapshotsEqual(
        before,
        await snapshotDirectory(workspace.root),
        `${context}: a build failing at configuration load modifies ` +
          `nothing (SPEC 12.1, 12.0) — no derived file or graph data ` +
          `appears anywhere under the root`,
      );
    },
  );
}

// ---------------------------------------------------------------------------
// T7.1-1 — spec groups
// ---------------------------------------------------------------------------

// One file (shared/S.mdx) matched by two spec groups, `alpha` and `beta`,
// each also holding a private file; group `ext` supplies the coverage
// boundary and group `low` the policy-rule target, wired acyclically
// (imports: shared → low, ext → shared; SPEC 2.1: import cycles are invalid,
// so the boundary edge into the shared file and the policy edge out of it
// must not point at each other's files):
//
//   ext/E.mdx#e          --depends-->  shared/S.mdx#s.covered   (covers it)
//   shared/S.mdx#s.uses  --depends-->  low/L.mdx#l              (policy edge)
//
// Two identically shaped coverage profiles target `alpha` and `beta` with
// boundary `ext` (unambiguous name — `boundaryKind` inferred, SPEC 7.4) in
// `direct` mode; two identically shaped `forbidden` rules match the s.uses →
// l edge from `alpha` and from `beta`. A product assigning the file to only
// one of its groups loses the shared leaves from one profile's report and
// one rule's finding.
const TWO_GROUP_MEMBERSHIP_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    alpha: ["alpha/*.mdx", "shared/*.mdx"],
    beta: ["beta/*.mdx", "shared/*.mdx"],
    ext: ["ext/*.mdx"],
    low: ["low/*.mdx"]
  },
  coverage: [
    {
      name: "cov-alpha",
      target: "alpha",
      boundary: "ext",
      mode: "direct"
    },
    {
      name: "cov-beta",
      target: "beta",
      boundary: "ext",
      mode: "direct"
    }
  ],
  policy: [
    {
      name: "alpha-to-low",
      type: "forbidden",
      from: { group: "alpha" },
      to: { group: "low" }
    },
    {
      name: "beta-to-low",
      type: "forbidden",
      from: { group: "beta" },
      to: { group: "low" }
    }
  ]
})
`;

const SHARED_SOURCE = `import L from "../low/L.xspec"

<S id="s">
Shared behavior.

<S id="s.covered">
Coverable from ext.
</S>

<S id="s.uses" d={L.l}>
Uses low-level behavior.
</S>
</S>
`;

const EXT_SOURCE = `import SH from "../shared/S.xspec"

<S id="e" d={SH.s.covered}>
Ext behavior depending on the shared leaf.
</S>
`;

const TWO_GROUP_FILES: Readonly<Record<string, string>> = {
  "xspec.config.ts": TWO_GROUP_MEMBERSHIP_CONFIG,
  "alpha/A.mdx": mdxSection("a"),
  "beta/B.mdx": mdxSection("b"),
  "shared/S.mdx": SHARED_SOURCE,
  "ext/E.mdx": EXT_SOURCE,
  "low/L.mdx": mdxSection("l"),
};

const SHARED_COVERED = "shared/S.mdx#s.covered";
const SHARED_USES = "shared/S.mdx#s.uses";
const EXT_BOUNDARY = "ext/E.mdx#e";
const LOW_TARGET = "low/L.mdx#l";

/** Resolve one profile of a coverage report by name, diagnosed (H-8). */
function profileNamed(
  report: CoverageReport,
  name: string,
  context: string,
): CoverageProfileReport {
  const profile = report.profiles.find((candidate) => candidate.name === name);
  if (profile === undefined) {
    fail(
      `${context}: the coverage report must carry profile ${JSON.stringify(name)} — ` +
        `all configured profiles run by default (SPEC 8.2); got profiles ` +
        `${JSON.stringify(report.profiles.map((candidate) => candidate.name))}`,
    );
  }
  return profile;
}

/**
 * Assert one profile sees the shared file's leaves: `s.covered` covered with
 * the exact one-edge boundary-to-target path (SPEC 8: direct mode, one
 * dependency edge from a boundary node), `s.uses` and the group's private
 * leaf uncovered (membership, compared sorted — the module header's
 * operationalization note).
 */
function assertProfileSeesSharedFile(
  profile: CoverageProfileReport,
  privateLeaf: string,
  context: string,
): void {
  assertSameJson(
    profile.covered.map((node) => ({
      identity: node.identity,
      path: node.path,
    })),
    [{ identity: SHARED_COVERED, path: [EXT_BOUNDARY, SHARED_COVERED] }],
    `${context}: the shared file's leaf ${SHARED_COVERED} is covered via the ` +
      `single boundary edge (SPEC 8, 7.1 — the file's nodes belong to this ` +
      `profile's target group too)`,
  );
  assertSameJson(
    [...profile.uncovered].sort(),
    [privateLeaf, SHARED_USES].sort(),
    `${context}: the group's private leaf and the shared file's other leaf ` +
      `are the uncovered required nodes (SPEC 8.1, 7.1)`,
  );
}

/**
 * Render one policy finding from its contractual identities — in order, the
 * violated rule's name and the offending edge's source identity, kind token,
 * and target identity (SPEC 14.12, 12.7) — as `rule :: kind: from -> to`.
 * A finding without the four identities renders verbatim, failing the
 * comparison with the offense visible.
 */
function renderPolicyIdentities(finding: Finding): string {
  if (finding.identities.length !== 4) {
    return `<malformed 14.12 identities> ${JSON.stringify(finding.identities)}`;
  }
  const [rule, from, kind, to] = finding.identities;
  return `${rule} :: ${kind}: ${from} -> ${to}`;
}

/** Render policy findings for order-insensitive exact comparison (7.5). */
function renderPolicyFindings(findings: readonly Finding[]): string[] {
  return findings.map(renderPolicyIdentities).sort();
}

// The non-`.mdx`-match workspace's configuration: the one spec group's glob
// `specs/*` matches `specs/notes.txt`. A staged-source record (module
// header): T7.1-1 stages it after its first product invocation.
const NON_MDX_MATCH_CONFIG = stagedTs(
  "T7.1-1 xspec.config.ts (the spec-group glob specs/* matching " +
    "specs/notes.txt)",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/*"]
  }
})
`,
);

// The non-`.mdx`-match workspace's spec-group file not named `.mdx`: an MDX
// source all the same — invalid by its name (SPEC 7.1, 14.19), its content
// still judged by 14.20 (11.2 keeps its parse-local structure) — whose
// content is well-formed, so the invalid path is the workspace's only
// condition and the arm's exact `{"14.19": 1}` has teeth. T7.1-1 stages it
// after its first product invocation, so it is a staged-source record
// (module header; S-9's before-any-product clause): a record at a path not
// named `.mdx` declares that path a well-formed MDX source for its own
// write, so the ledger self-test judges it before any product exists.
const NON_MDX_MATCH_NOTES = stagedMdx(
  "T7.1-1 specs/notes.txt (the spec-group match without .mdx, its content " +
    "well-formed so the 14.19 is the workspace's only condition)",
  mdxSection("n"),
);

// --- T7.1-1's path-character arms (SPEC 7.1, 14.19) --------------------------
//
// SPEC 7.1 bars U+0022, U+0027, U+005C (the backslash), U+000A, U+000D,
// U+2028, and U+2029 from a spec-group file's workspace-relative path
// (14.19): one arm per character in the file name (`specs/a<c>b.mdx`) plus
// one with U+0027 in a directory component (`specs/it's/a.mdx`), each file
// alone in its own workspace (module header). Every barred character is
// built from its code point, never from an escape spelling.

/** Whether the Linux-leg arms are staged (module-header note). */
const LINUX_LEG = process.platform === "linux";

const APOSTROPHE = String.fromCodePoint(0x27);
const BACKSLASH = String.fromCodePoint(0x5c);

/** One path-character arm: a barred spec-group file, alone in its workspace. */
interface PathCharacterArm {
  /** The barred character and where it stands, for diagnoses. */
  readonly what: string;
  /** The spec-group file's workspace-relative path. */
  readonly path: string;
  /** The `view --file` glob reaching exactly that file (SPEC 7's globs). */
  readonly glob: string;
  /** Staged on the Linux leg alone: a name other filesystems cannot hold. */
  readonly linuxLeg: boolean;
}

function fileNameArm(
  codePoint: number,
  name: string,
  linuxLeg: boolean,
): PathCharacterArm {
  return {
    what: `${name} in the file name`,
    path: `specs/a${String.fromCodePoint(codePoint)}b.mdx`,
    glob: "specs/a*b.mdx",
    linuxLeg,
  };
}

const PATH_CHARACTER_ARMS: readonly PathCharacterArm[] = [
  fileNameArm(0x22, "U+0022 QUOTATION MARK", true),
  fileNameArm(0x27, "U+0027 APOSTROPHE", false),
  fileNameArm(0x5c, "U+005C REVERSE SOLIDUS (the backslash)", true),
  fileNameArm(0x0a, "U+000A LINE FEED", true),
  fileNameArm(0x0d, "U+000D CARRIAGE RETURN", true),
  fileNameArm(0x2028, "U+2028 LINE SEPARATOR", false),
  fileNameArm(0x2029, "U+2029 PARAGRAPH SEPARATOR", false),
  {
    what: "U+0027 APOSTROPHE in a directory component",
    path: `specs/it${APOSTROPHE}s/a.mdx`,
    glob: "specs/*/a.mdx",
    linuxLeg: false,
  },
];

// The arms' configuration: one spec group whose glob reaches every arm's
// file, the directory component included. A staged-source record (module
// header): T7.1-1 stages it after its first product invocation.
const PATH_CHARACTER_CONFIG = stagedTs(
  "T7.1-1 xspec.config.ts (the path-character arms: the spec-group glob " +
    "specs/**/*.mdx)",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
);

/**
 * Running byte-offset composer (the T5.7-2 discipline): `add` appends a
 * segment and returns its byte range, `attr` an attribute segment as its
 * expected raw view entry (SPEC 11.4: the entry's text is the attribute's
 * own characters), so every expected offset is composed from the parts the
 * staged file is made of.
 */
class SourceComposer {
  private readonly parts: string[] = [];
  private bytes = 0;

  get pos(): number {
    return this.bytes;
  }

  get source(): string {
    return this.parts.join("");
  }

  add(segment: string): SourceRange {
    const start = this.bytes;
    this.parts.push(segment);
    this.bytes += Buffer.byteLength(segment, "utf8");
    return { start, end: this.bytes };
  }

  attr(name: string, text: string): ViewAttributeEntry {
    return { name, range: this.add(text), text };
  }
}

// The arms' one spec source, staged at each barred path: a section with a
// nested child, so "every identity unavailable" reaches the root, a
// top-level section, and a nested one. Its content is condition-free — the
// path is each arm's only defect, so the exact 14.19 count has teeth.
const PATH_ARM = new SourceComposer();
const PATH_ARM_OUTER_START = PATH_ARM.pos;
PATH_ARM.add("<S ");
const PATH_ARM_OUTER_ID = PATH_ARM.attr("id", 'id="p"');
PATH_ARM.add(">\nText for p.\n\n");
const PATH_ARM_INNER_START = PATH_ARM.pos;
PATH_ARM.add("<S ");
const PATH_ARM_INNER_ID = PATH_ARM.attr("id", 'id="p.kid"');
PATH_ARM.add(">\nText for p.kid.\n</S>");
const PATH_ARM_INNER_RANGE: SourceRange = {
  start: PATH_ARM_INNER_START,
  end: PATH_ARM.pos,
};
PATH_ARM.add("\n</S>");
const PATH_ARM_OUTER_RANGE: SourceRange = {
  start: PATH_ARM_OUTER_START,
  end: PATH_ARM.pos,
};
PATH_ARM.add("\n");
const PATH_ARM_SOURCE = stagedMdx(
  "T7.1-1 the path-character arms' spec source (staged at each barred path)",
  PATH_ARM.source,
);

/** The 12.7 unavailability marker, as decoded (one-datum state). */
const UNAVAILABLE = { unavailable: true } as const;

/**
 * The tree projection T11.2-3 pins: per node, the identity datum (11.2
 * three-state), the construct range (1.7), the raw attribute entries as
 * parsed, and the children in document order.
 */
interface TreeExpectation {
  readonly identity: string | { readonly unavailable: true };
  readonly range: SourceRange;
  readonly attributes: readonly ViewAttributeEntry[];
  readonly children: readonly TreeExpectation[];
}

function projectTree(node: ViewNode): TreeExpectation {
  return {
    identity: node.identity,
    range: node.range,
    attributes: node.attributes.map((entry) => ({
      name: entry.name,
      range: entry.range,
      text: entry.text,
    })),
    children: node.children.map(projectTree),
  };
}

// The arm source's full positional tree, every identity unavailable.
const PATH_ARM_TREE: TreeExpectation = {
  identity: UNAVAILABLE,
  range: { start: 0, end: PATH_ARM.pos },
  attributes: [],
  children: [
    {
      identity: UNAVAILABLE,
      range: PATH_ARM_OUTER_RANGE,
      attributes: [PATH_ARM_OUTER_ID],
      children: [
        {
          identity: UNAVAILABLE,
          range: PATH_ARM_INNER_RANGE,
          attributes: [PATH_ARM_INNER_ID],
          children: [],
        },
      ],
    },
  ],
};

/**
 * The asserted projection of a 14.19 finding (T11.2-3's): the stable code
 * token, the empty locations of a path-level condition, and the concerned
 * path (SPEC 14, 12.7). Message and identities stay unpinned.
 */
interface PathFindingExpectation {
  readonly code: string | null;
  readonly locations: readonly unknown[];
  readonly path: PathValue | null;
}

function projectPathFinding(finding: Finding): PathFindingExpectation {
  return {
    code: finding.code,
    locations: finding.locations,
    path: finding.path,
  };
}

function invalidPathFinding(path: string): PathFindingExpectation {
  return { code: "invalid-source-path", locations: [], path };
}

/**
 * One path-character arm (module header): `build --json` reports exactly
 * the file's condition-19 finding, concerning its path, and the
 * glob-reached `view` serves its tree with every identity unavailable, the
 * finding accompanying — the file still discovered and reachable as
 * T11.2-3's invalid-path files are (SPEC 7.1, 14.19, 11.2, 11.4).
 */
async function runPathCharacterArm(
  product: ProductBinding,
  arm: PathCharacterArm,
): Promise<void> {
  const label = `${JSON.stringify(arm.path)} (${arm.what})`;
  const expected19 = [invalidPathFinding(arm.path)];
  await withWorkspace(
    {
      files: {
        "xspec.config.ts": PATH_CHARACTER_CONFIG,
        [arm.path]: PATH_ARM_SOURCE,
      },
    },
    async (workspace) => {
      const buildContext = `T7.1-1 \`build --json\` with the spec-group file ${label}`;
      const findings = await buildFindings(product, workspace, buildContext);
      assertConditionCounts(findings, { "14.19": 1 }, buildContext);
      assertSameJson(
        findings.map(projectPathFinding),
        expected19,
        `${buildContext} — the file is discovered and its path is invalid: ` +
          `one condition-19 finding with the stable code ` +
          `"invalid-source-path", no in-source locations, and the file's ` +
          `workspace-relative path as its concerned path (SPEC 7.1, 14.19, ` +
          `14, 12.7)`,
      );

      const viewContext =
        `T7.1-1 \`view --file ${arm.glob}\` (the glob-reached view) over ` +
        `the spec-group file ${label}`;
      const viewResult = await runCli(product, workspace, [
        "view",
        "--file",
        arm.glob,
      ]);
      assertExitCode(
        viewResult,
        1,
        `${viewContext} — the answer carries the file's condition-19 ` +
          `finding and explicitly-unavailable identities, so exit 1 with ` +
          `the full document still emitted (SPEC 11.2, 11.4)`,
      );
      const report = decodeViewReport(
        parseJsonStdout(
          viewResult,
          `${viewContext} — a single JSON document is the only output ` +
            `form (SPEC 11)`,
        ),
        { text: false },
        viewContext,
      );
      assertSameJson(
        report.findings.map(projectPathFinding),
        expected19,
        `${viewContext} — the file's condition-19 finding accompanies the ` +
          `answer whose consulted domain includes it (SPEC 11.2, 14.19)`,
      );
      assertSameJson(
        report.views.map((view) => view.file),
        [arm.path],
        `${viewContext} — the glob admits the discovered file: one ` +
          `per-file view, its \`file\` the workspace-relative path (SPEC ` +
          `11.4, 7)`,
      );
      const view = report.views[0]!;
      assertSameJson(
        projectTree(view.root),
        PATH_ARM_TREE,
        `${viewContext} — the file keeps its full positional tree with ` +
          `byte-exact construct ranges and raw attribute entries while ` +
          `every node identity, root included, is explicitly unavailable ` +
          `(SPEC 11.2, 11.4, 1.5)`,
      );
      assertSameJson(
        [view.imports, view.occurrences, view.comments],
        [[], [], []],
        `${viewContext} — the file holds no imports, occurrences, or ` +
          `comments: empty arrays, never null (SPEC 11.4, 12.7)`,
      );
    },
  );
}

// --- T7.1-1's code-source control (SPEC 7.1, 14.19) --------------------------
//
// 7.1's bar binds spec groups alone (14.19's code-source forms are `#`,
// U+FFFD, and non-UTF-8), so a code-group file whose path holds U+0027 and
// the backslash — `src/it's<U+005C>x.ts`, one file name: the backslash is
// no separator of a workspace-relative path (1.5) — is valid: `build` and
// `check` exit 0, and its top-level marker records its `references` edge
// from that whole-file location (4.5, 4.6), discriminating a product that
// applies the bar to every source. Staged on the Linux leg (module header):
// the name holds a backslash.
const CODE_PATH_CONTROL_FILE = `src/it${APOSTROPHE}s${BACKSLASH}x.ts`;

// The control's configuration and code source: staged-source records
// (module header), T7.1-1 staging them after its first product invocation.
const CODE_PATH_CONTROL_CONFIG = stagedTs(
  "T7.1-1 xspec.config.ts (the code-source path control: spec glob " +
    "specs/*.mdx, code glob src/*.ts)",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/*.mdx"]
  },
  code: {
    app: ["src/*.ts"]
  }
})
`,
);
const CODE_PATH_CONTROL_SOURCE = stagedTs(
  "T7.1-1 the code-source path control's code source (staged at " +
    "src/it's<U+005C>x.ts: a top-level marker of specs/A.mdx#a)",
  `import SPEC from "../specs/A.xspec"

SPEC.a
`,
);

// The control workspace's complete edge set (SPEC 5.1, 5.2): the source's
// containment edge and the marker's references edge, sourced at the code
// file's whole-file location — its path, the identity of a valid path.
const CODE_PATH_CONTROL_EDGES: readonly GraphEdge[] = [
  { from: "specs/A.mdx", to: "specs/A.mdx#a", kind: "contains" },
  { from: CODE_PATH_CONTROL_FILE, to: "specs/A.mdx#a", kind: "references" },
];

const T7_1_1 = defineProductTest({
  id: "T7.1-1",
  title:
    "spec groups: a file in two spec groups is valid, listed once, and " +
    "coverage and policy see it in both groups; a spec-group match without " +
    "`.mdx` is invalid; a spec-group file whose path holds U+0022, U+0027, " +
    "U+005C, U+000A, U+000D, U+2028, or U+2029 — one arm per character in " +
    "the file name, plus U+0027 in a directory component; the U+0022, " +
    "U+005C, U+000A, and U+000D arms on the Linux leg — is invalid (14.19), " +
    "still discovered and reachable: its finding concerns its path and a " +
    "glob-reached `view` serves its tree with every identity unavailable; " +
    "control (Linux leg): the code-group file `src/it's<U+005C>x.ts` is " +
    "valid, `build` and `check` exiting 0 and its marker recording its edge " +
    "from the whole-file location (SPEC 7.1, 8, 7.5, 14.19, 11.2, 11.4)",
  run: async (product) => {
    // A file in two spec groups is valid — and coverage/policy see it in
    // both.
    await withWorkspace({ files: TWO_GROUP_FILES }, async (workspace) => {
      await buildOk(
        product,
        workspace,
        "T7.1-1 `build` — a file in two spec groups is valid (SPEC 7.1)",
      );
      await expectIdsListing(
        product,
        workspace,
        [
          { file: "alpha/A.mdx", ids: ["a"] },
          { file: "beta/B.mdx", ids: ["b"] },
          { file: "ext/E.mdx", ids: ["e"] },
          { file: "low/L.mdx", ids: ["l"] },
          { file: "shared/S.mdx", ids: ["s", "s.covered", "s.uses"] },
        ],
        "T7.1-1 `ids --json` — the twice-grouped file is one source, listed " +
          "once (SPEC 7.1, 7, 12.3)",
      );

      // Coverage: both profiles — one per group — report the shared file's
      // leaves in their required sets.
      const coverageLabel = "T7.1-1 `coverage --json`";
      const coverage = decodeCoverageReport(
        await runJson(
          product,
          workspace,
          ["coverage", "--json"],
          coverageLabel,
        ),
        coverageLabel,
      );
      assertProfileSeesSharedFile(
        profileNamed(coverage, "cov-alpha", coverageLabel),
        "alpha/A.mdx#a",
        `${coverageLabel} profile cov-alpha`,
      );
      assertProfileSeesSharedFile(
        profileNamed(coverage, "cov-beta", coverageLabel),
        "beta/B.mdx#b",
        `${coverageLabel} profile cov-beta`,
      );

      // Policy: the depends edge sourced at the shared file's node violates
      // BOTH group-scoped rules — one finding per rule, each naming the rule
      // and the offending edge (SPEC 7.5, 14.12).
      const checkLabel = "T7.1-1 `check --json`";
      const checkResult = await expectExit(
        product,
        workspace,
        ["check", "--json"],
        1,
        `${checkLabel} — the staged edge violates both forbidden rules, a ` +
          `finding outcome (SPEC 7.5, 12.0)`,
      );
      const findings = decodeFindingsReport(
        parseJsonStdout(checkResult, checkLabel),
        checkLabel,
      ).findings;
      assertConditionCounts(findings, { "14.12": 2 }, checkLabel);
      assertSameJson(
        renderPolicyFindings(findings),
        [
          `alpha-to-low :: depends: ${SHARED_USES} -> ${LOW_TARGET}`,
          `beta-to-low :: depends: ${SHARED_USES} -> ${LOW_TARGET}`,
        ],
        `${checkLabel}: the rule scoped to each group flags the edge — ` +
          `policy sees the shared file in both spec groups (SPEC 7.1, 7.5)`,
      );
    });

    // A spec-group match without `.mdx` → 14.19. The offending file's
    // content is itself well-formed (its record declares it so, and S-9's
    // ledger self-test judges it), so the invalid path is the workspace's
    // only condition (the exact-count assertion has teeth) — and a product
    // that wrongly accepts the match builds cleanly and fails the exit-code
    // assertion.
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": NON_MDX_MATCH_CONFIG,
          "specs/A.mdx": SECTION_A_SOURCE,
          "specs/notes.txt": NON_MDX_MATCH_NOTES,
        },
      },
      async (workspace) => {
        const context =
          "T7.1-1 `build --json` with the spec-group glob specs/* matching " +
          "specs/notes.txt";
        const findings = await buildFindings(product, workspace, context);
        assertConditionCounts(findings, { "14.19": 1 }, context);
        const finding = findings[0]!;
        if (finding.path !== "specs/notes.txt") {
          fail(
            `${context}: the 14.19 finding must identify the offending ` +
              `workspace-relative source path as its concerned path (SPEC ` +
              `14, 7.1, 1.5, 12.7); expected "specs/notes.txt", got ` +
              `${JSON.stringify(finding.path)} ` +
              `(message: ${JSON.stringify(finding.message)})`,
          );
        }
      },
    );

    // Path characters (SPEC 7.1, 14.19): one arm per barred character in
    // the file name plus U+0027 in a directory component, each file alone
    // in its own workspace; the U+0022, backslash, U+000A, and U+000D arms
    // on the Linux leg alone (module header).
    for (const arm of PATH_CHARACTER_ARMS) {
      if (arm.linuxLeg && !LINUX_LEG) continue;
      await runPathCharacterArm(product, arm);
    }

    // Control (Linux leg: the name holds a backslash): the code-group file
    // `src/it's<U+005C>x.ts` is valid — 7.1's bar binds spec groups alone —
    // so `build` and `check` are finding-free and its top-level marker
    // records its edge from the whole-file location.
    if (LINUX_LEG) {
      await withWorkspace(
        {
          files: {
            "xspec.config.ts": CODE_PATH_CONTROL_CONFIG,
            "specs/A.mdx": SECTION_A_SOURCE,
            [CODE_PATH_CONTROL_FILE]: CODE_PATH_CONTROL_SOURCE,
          },
        },
        async (workspace) => {
          const label =
            `the code-group file ${JSON.stringify(CODE_PATH_CONTROL_FILE)} ` +
            `(U+0027 and the backslash in a code source's path)`;
          await expectFindingFreeReport(
            product,
            workspace,
            ["build", "--json"],
            `T7.1-1 \`build --json\` with ${label} — valid: 7.1's bar ` +
              `binds spec groups alone, 14.19's code-source forms being ` +
              `\`#\`, U+FFFD, and non-UTF-8 (SPEC 7.1, 14.19)`,
          );
          await expectFindingFreeReport(
            product,
            workspace,
            ["check", "--json"],
            `T7.1-1 \`check --json\` with ${label}, after the build — ` +
              `valid and current (SPEC 7.1, 14.19, 12.2)`,
          );
          const edgesLabel = `T7.1-1 \`query edges\` with ${label}`;
          assertEdgeSetEqual(
            decodeEdgesReport(
              await runJson(product, workspace, ["query", "edges"], edgesLabel),
              edgesLabel,
            ),
            CODE_PATH_CONTROL_EDGES,
            `${edgesLabel}: the file's top-level marker records its ` +
              `references edge from the whole-file location, whose ` +
              `identity is the file's path (SPEC 4.5, 4.6, 7.1)`,
          );
        },
      );
    }
  },
});

// ---------------------------------------------------------------------------
// T7.2-1 — code groups
// ---------------------------------------------------------------------------

// The positive roles of code groups — coverage boundaries (SPEC 7.2, 8) and
// the impacted-code population (9.2) — are asserted by the section 8/9 tests
// (T8-3, T9.2-*), per T7.2-1's own text. This test's subject is the overlap
// rule: a file matched by both a spec and a code group is a configuration
// error (14.14), reported when the configuration is loaded and sources are
// discovered, as a usage error (exit 2). The error document's one finding
// concerns the configuration file the upward search found — exactly
// `xspec.config.ts`, the invocation running at the workspace root (11.6's
// anchoring form), never the doubly matched mixed/X.mdx — and carries
// `locations` [] (SPEC 14, 12.7; `assertFoundConfigurationConcerned`). The
// decoy pair — a spec source and a code source each matched by exactly one
// group — keeps the overlap the workspace's only defect: a product that
// wrongly accepts it proceeds past configuration load (to exit 0 or a
// finding exit 1, whatever it makes of mixed/X.mdx) and fails the exit-2
// assertion either way.
const OVERLAP_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/*.mdx", "mixed/*.mdx"]
  },
  code: {
    app: ["src/*.ts", "mixed/*"]
  }
})
`;

const T7_2_1 = defineProductTest({
  id: "T7.2-1",
  title:
    "code groups: a file matched by both a spec and a code group is a " +
    "configuration error (14.14, exit 2); the coverage-boundary and " +
    "impacted-code-population roles are asserted in sections 8/9 (SPEC 7.2)",
  run: async (product) => {
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": OVERLAP_CONFIG,
          "specs/A.mdx": mdxSection("a"),
          "src/impl.ts": "export const ok = 1;\n",
          "mixed/X.mdx": mdxSection("x"),
        },
      },
      async (workspace) => {
        const context =
          "T7.2-1 `build --json` with mixed/X.mdx matched by both the spec " +
          "group (mixed/*.mdx) and the code group (mixed/*)";
        const result = await expectConfigurationError(
          product,
          workspace,
          ["build"],
          context,
        );
        assertFoundConfigurationConcerned(
          expectErrorDocument(result, context),
          context,
          "SPEC 14, 12.7, 11.6, 7.2",
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T7.3-1 — markdown configuration
// ---------------------------------------------------------------------------

/** The canonical one-spec-group configuration plus an optional extra key. */
function specsMainConfig(extra: string): string {
  return `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }${extra}
})
`;
}

// Two sources, one in a subdirectory, so "next to each source" and the
// outDir path preservation are both observable. Compiled bytes are fixed by
// SPEC 3 (the tag-only lines drop with their terminators; the content line
// keeps its own): byte-asserted per H-4; compilation semantics are T3-*'s.
const EMISSION_FILES: Readonly<Record<string, InitialFileContents>> = {
  "specs/A.mdx": SECTION_A_SOURCE,
  "specs/sub/B.mdx": SECTION_B_SOURCE,
};
const A_COMPILED = "Text for a.\n";
const B_COMPILED = "Text for b.\n";

// The emission-scope matrix (SPEC 7.3): absent and `emit: false` mean no
// emission; `emit: true` emits next to each source. Each variant's
// configuration is a staged-source record (module header): T7.3-1 stages
// every variant past the first after its first product invocation.
const EMISSION_VARIANTS = [
  {
    key: "`markdown` absent",
    config: stagedTs(
      "T7.3-1 xspec.config.ts (emission matrix: `markdown` absent)",
      specsMainConfig(""),
    ),
    emits: false,
  },
  {
    key: "`markdown: { emit: false }`",
    config: stagedTs(
      "T7.3-1 xspec.config.ts (emission matrix: `markdown: { emit: false }`)",
      specsMainConfig(",\n  markdown: { emit: false }"),
    ),
    emits: false,
  },
  {
    key: "`markdown: { emit: true }`",
    config: stagedTs(
      "T7.3-1 xspec.config.ts (emission matrix: `markdown: { emit: true }`)",
      specsMainConfig(",\n  markdown: { emit: true }"),
    ),
    emits: true,
  },
] as const;

/** A refused-configuration arm (T7.3-1): its label and its record. */
interface RefusedConfigArm {
  readonly label: string;
  readonly config: StagedTs;
}

// `markdown` present without `emit` → 14.14 (SPEC 7.3: `emit` is required
// when `markdown` is present). The outDir-bearing arm discriminates a
// product that infers emission from any other markdown key. Each arm's
// configuration is a staged-source record made at module load from its row
// (module header).
const EMIT_REQUIRED_VIOLATIONS: readonly RefusedConfigArm[] = [
  { label: "markdown: {}", extra: ",\n  markdown: {}" },
  {
    label: 'markdown: { outDir: "docs" } (outDir given, emit still missing)',
    extra: ',\n  markdown: { outDir: "docs" }',
  },
].map((row) => ({
  label: row.label,
  config: stagedTs(
    `T7.3-1 xspec.config.ts (${row.label})`,
    specsMainConfig(row.extra),
  ),
}));

// `outDir` redirect (SPEC 7.3: emitted files land under outDir, preserving
// workspace-relative paths; outDir resolves against the workspace root).
// A staged-source record (module header).
const OUTDIR_CONFIG = stagedTs(
  'T7.3-1 xspec.config.ts (outDir "docs")',
  specsMainConfig(',\n  markdown: { emit: true, outDir: "docs" }'),
);

// `outDir` not in plain workspace-relative form → 14.14 (SPEC 7.3: one or
// more non-empty `/`-separated segments, none `.` or `..`; any other
// spelling — empty, beginning with `/`, or carrying a `.`, `..`, or empty
// segment — is a configuration error, by spelling alone). One arm per
// pinned spelling (TEST-SPEC T7.3-1), then the two `..`-bearing spellings
// the arm always drove. Each is serialized into the configuration through
// `JSON.stringify`, so the literal the product reads is exactly the
// spelling listed; each arm's configuration is a staged-source record made
// at module load from its row (module header).
const INVALID_OUTDIRS: readonly {
  readonly outDir: string;
  readonly why: string;
  readonly config: StagedTs;
}[] = [
  { outDir: "", why: "empty" },
  { outDir: "/out", why: "begins with `/`" },
  { outDir: "./out", why: "carries a `.` segment" },
  { outDir: "out/../x", why: "carries a `..` segment" },
  { outDir: "out//x", why: "carries an empty segment" },
  { outDir: "out/", why: "carries a trailing empty segment" },
  { outDir: "../out", why: "begins with a `..` segment" },
  {
    outDir: "docs/../../out",
    why: "carries `..` segments (resolving outside the root besides)",
  },
].map((row) => ({
  outDir: row.outDir,
  why: row.why,
  config: stagedTs(
    `T7.3-1 xspec.config.ts (outDir ${JSON.stringify(row.outDir)} ${row.why})`,
    specsMainConfig(
      `,\n  markdown: { emit: true, outDir: ${JSON.stringify(row.outDir)} }`,
    ),
  ),
}));

// The pinned valid multi-segment spelling (SPEC 7.3, TEST-SPEC T7.3-1):
// `out/sub` redirects the emission under `out/sub/`, preserving each
// source's workspace-relative path beneath it. A staged-source record
// (module header).
const OUTDIR_SUB_CONFIG = stagedTs(
  'T7.3-1 xspec.config.ts (outDir "out/sub")',
  specsMainConfig(',\n  markdown: { emit: true, outDir: "out/sub" }'),
);

// An `outDir` naming the graph-data area or a path under it → 14.14 (SPEC
// 7.3: "So is an `outDir` of `.xspec` or beginning with `.xspec/`" — no emit
// destination lies in the graph-data area, 13.3, so graph data is the only
// derived file under it, 11.6, 13.1, 13.4). Both spellings are in plain
// workspace-relative form, so each arm is refused for the area alone, one
// arm each (TEST-SPEC T7.3-1). Each arm's configuration is a staged-source
// record made at module load from its row (module header).
const GRAPH_DATA_AREA_OUTDIRS: readonly {
  readonly outDir: string;
  readonly why: string;
  readonly config: StagedTs;
}[] = [
  { outDir: ".xspec", why: "names the graph-data area itself" },
  { outDir: ".xspec/md", why: "names a path under the graph-data area" },
].map((row) => ({
  outDir: row.outDir,
  why: row.why,
  config: stagedTs(
    `T7.3-1 xspec.config.ts (outDir ${JSON.stringify(row.outDir)} ${row.why})`,
    specsMainConfig(
      `,\n  markdown: { emit: true, outDir: ${JSON.stringify(row.outDir)} }`,
    ),
  ),
}));

// The graph-data area's look-alikes (TEST-SPEC T7.3-1): `.xspec2` and
// `.xspecs/md` are neither `.xspec` nor begin with `.xspec/` — a product
// testing the byte prefix `.xspec` without its segment boundary refuses
// them — so each is a valid `outDir`, and emission writes each destination
// under it, creating the missing directory chain (SPEC 7.3, 13.4; T13.4-8).
// `chain` lists every directory the destinations need, `outDir`'s own
// components first, none of which the arm's staging creates. Each arm's
// configuration is a staged-source record made at module load from its row
// (module header).
const LOOKALIKE_OUTDIRS: readonly {
  readonly outDir: string;
  readonly chain: readonly string[];
  readonly config: StagedTs;
}[] = [
  { outDir: ".xspec2", chain: [".xspec2"] },
  { outDir: ".xspecs/md", chain: [".xspecs", ".xspecs/md"] },
].map((row) => ({
  outDir: row.outDir,
  chain: [...row.chain, `${row.outDir}/specs`, `${row.outDir}/specs/sub`],
  config: stagedTs(
    `T7.3-1 xspec.config.ts (outDir ${JSON.stringify(row.outDir)}, a ` +
      `look-alike of the graph-data area)`,
    specsMainConfig(
      `,\n  markdown: { emit: true, outDir: ${JSON.stringify(row.outDir)} }`,
    ),
  ),
}));

// Classification-follows-emit, discovery channel (module header): the
// destination path `specs/A.md` staged as a *valid code source* — plain-TS
// content whose top-level marker records a `references` edge attributed to
// the file (SPEC 4.5, 4.6, 14.20) — in a code group whose glob matches only
// it. The spec and code globs are disjoint (`*.mdx` vs `*.md` suffixes), so
// no 14.14 overlap arises. S-9: the destination path's code source, a name
// the default does not reach, is declared well-formed (a valid code source,
// 14.20) by its staged-source record (module header; the record makes the
// path judged), staged in both workspaces of the arm.
const DESTINATION_CODE_SOURCE = stagedTs(
  "T7.3-1 specs/A.md (the destination path staged as a valid code source)",
  `import BASE from "./A.xspec"

BASE.a
`,
);

function destinationDiscoveryConfig(emit: boolean): string {
  return `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/*.mdx"]
  },
  code: {
    doc: ["specs/*.md"]
  },
  markdown: { emit: ${String(emit)} }
})
`;
}

// The arm's two configurations, staged-source records (module header).
const DESTINATION_DISCOVERY_NO_EMIT_CONFIG = stagedTs(
  "T7.3-1 xspec.config.ts (destination discovery: emission disabled)",
  destinationDiscoveryConfig(false),
);
const DESTINATION_DISCOVERY_EMIT_CONFIG = stagedTs(
  "T7.3-1 xspec.config.ts (destination discovery: emission enabled)",
  destinationDiscoveryConfig(true),
);

const DESTINATION_DISCOVERY_FILES: Readonly<
  Record<string, InitialFileContents>
> = {
  "specs/A.mdx": SECTION_A_SOURCE,
  "specs/A.md": DESTINATION_CODE_SOURCE,
};

const CONTAINS_EDGE: GraphEdge = {
  from: "specs/A.mdx",
  to: "specs/A.mdx#a",
  kind: "contains",
};
const DESTINATION_MARKER_EDGE: GraphEdge = {
  from: "specs/A.md",
  to: "specs/A.mdx#a",
  kind: "references",
};

// Classification-follows-emit, import-rule channel (T4-2's rule, SPEC 4,
// 13.4, 14.15): a code-group file importing the destination path. The
// classification is by path, so nothing exists at specs/A.md here.
const DESTINATION_IMPORT_STATEMENT = 'import DOC from "../specs/A.md";';

function destinationImportConfig(emit: boolean): string {
  return `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/*.mdx"]
  },
  code: {
    app: ["src/*.ts"]
  },
  markdown: { emit: ${String(emit)} }
})
`;
}

// The arm's two configurations and the importing code source, staged-source
// records (module header).
const DESTINATION_IMPORT_EMIT_CONFIG = stagedTs(
  "T7.3-1 xspec.config.ts (destination import: emission enabled)",
  destinationImportConfig(true),
);
const DESTINATION_IMPORT_NO_EMIT_CONFIG = stagedTs(
  "T7.3-1 xspec.config.ts (destination import: emission disabled)",
  destinationImportConfig(false),
);

const DESTINATION_IMPORT_FILES: Readonly<Record<string, InitialFileContents>> =
  {
    "specs/A.mdx": SECTION_A_SOURCE,
    "src/use.ts": stagedTs(
      "T7.3-1 src/use.ts (importing the destination path ../specs/A.md)",
      `${DESTINATION_IMPORT_STATEMENT}\n`,
    ),
  };

// Classification-by-configuration-alone arm (SPEC 7.3 "whether or not
// emission has yet run"): emission enabled, no emission ever run, a
// user-authored file at the destination, one spec-group glob matching both
// the source and the destination. A staged-source record (module header).
const CONFIG_ALONE_CONFIG = stagedTs(
  "T7.3-1 xspec.config.ts (classification by configuration alone)",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/*"]
  },
  markdown: { emit: true }
})
`,
);

const USER_AUTHORED_DESTINATION =
  "User-authored notes at the emit destination.\n";

/** Assert nothing occupies a would-be emit destination (SPEC 7.3). */
async function assertNotEmitted(
  workspace: TestWorkspace,
  rel: string,
  context: string,
): Promise<void> {
  const kind = await workspace.kind(rel);
  if (kind !== "absent") {
    fail(
      `${context}: expected nothing at ${rel} — with \`markdown\` absent or ` +
        `\`emit: false\` no path is a Markdown emit destination, and with ` +
        `outDir only the paths beneath outDir itself, joined by \`/\` to ` +
        `each source's default workspace-relative destination, are ` +
        `destinations (SPEC 7.3, 13.2) — but found: ${kind}`,
    );
  }
}

const T7_3_1 = defineProductTest({
  id: "T7.3-1",
  title:
    "markdown configuration: absent and emit:false mean no emission, " +
    "emit:true emits next to each source; markdown without emit is 14.14; " +
    "outDir redirects preserving workspace-relative paths and must be " +
    "spelled in plain workspace-relative form — non-empty `/`-separated " +
    "segments, none `.` or `..` — decided by spelling alone (else 14.14: " +
    '"", "/out", "./out", "out/../x", "out//x", "out/"; "out/sub" valid); ' +
    "an outDir naming the graph-data area or a path under it is 14.14 " +
    '(".xspec", ".xspec/md"), its look-alikes (".xspec2", ".xspecs/md") ' +
    "valid, emission writing under them; emit-destination classification " +
    "follows emit — by configuration alone, whether or not emission has " +
    "yet run (SPEC 7.3, 13.2, 13.3, 13.4, 14.14)",
  run: async (product) => {
    // (a) The emission-scope matrix: absent → none, emit:false → none,
    // emit:true → next to each source. Fresh workspace per variant, so no
    // arm can observe a leftover emission.
    for (const variant of EMISSION_VARIANTS) {
      await withWorkspace(
        { files: { "xspec.config.ts": variant.config, ...EMISSION_FILES } },
        async (workspace) => {
          await buildOk(
            product,
            workspace,
            `T7.3-1 \`build\` under ${variant.key}`,
          );
          if (variant.emits) {
            await assertFileBytes(
              workspace.path("specs/A.md"),
              A_COMPILED,
              `T7.3-1 under ${variant.key}: specs/A.mdx emits specs/A.md ` +
                `next to its source (SPEC 7.3, 13.2)`,
            );
            await assertFileBytes(
              workspace.path("specs/sub/B.md"),
              B_COMPILED,
              `T7.3-1 under ${variant.key}: specs/sub/B.mdx emits ` +
                `specs/sub/B.md next to its source (SPEC 7.3, 13.2)`,
            );
          } else {
            await assertNotEmitted(
              workspace,
              "specs/A.md",
              `T7.3-1 under ${variant.key}`,
            );
            await assertNotEmitted(
              workspace,
              "specs/sub/B.md",
              `T7.3-1 under ${variant.key}`,
            );
          }
        },
      );
    }

    // (b) `markdown` present without `emit` → 14.14 (exit 2).
    for (const arm of EMIT_REQUIRED_VIOLATIONS) {
      await expectConfigRefused(
        product,
        arm.config,
        `T7.3-1 (${arm.label}) \`build --json\` — \`emit\` is required when ` +
          `\`markdown\` is present (SPEC 7.3, 14.14)`,
      );
    }

    // (c) `outDir` redirects, preserving workspace-relative paths — and
    // redirects rather than duplicates: the default next-to-source paths
    // stay vacant.
    await withWorkspace(
      { files: { "xspec.config.ts": OUTDIR_CONFIG, ...EMISSION_FILES } },
      async (workspace) => {
        await buildOk(product, workspace, "T7.3-1 `build` with outDir docs");
        await assertFileBytes(
          workspace.path("docs/specs/A.md"),
          A_COMPILED,
          "T7.3-1 (outDir): specs/A.mdx emits docs/specs/A.md — outDir " +
            "prefixes the preserved workspace-relative path (SPEC 7.3)",
        );
        await assertFileBytes(
          workspace.path("docs/specs/sub/B.md"),
          B_COMPILED,
          "T7.3-1 (outDir): specs/sub/B.mdx emits docs/specs/sub/B.md — " +
            "subdirectory structure preserved under outDir (SPEC 7.3)",
        );
        await assertNotEmitted(
          workspace,
          "specs/A.md",
          "T7.3-1 (outDir redirects, not duplicates)",
        );
        await assertNotEmitted(
          workspace,
          "specs/sub/B.md",
          "T7.3-1 (outDir redirects, not duplicates)",
        );
      },
    );

    // (d) `outDir` not in plain workspace-relative form → 14.14 (exit 2,
    // the configuration the concerned path, nothing modified), one arm per
    // spelling.
    for (const arm of INVALID_OUTDIRS) {
      await expectConfigRefused(
        product,
        arm.config,
        `T7.3-1 (outDir ${JSON.stringify(arm.outDir)} ${arm.why}: not in ` +
          `plain workspace-relative form — one or more non-empty ` +
          `\`/\`-separated segments, none \`.\` or \`..\`, decided by ` +
          `spelling alone) \`build --json\` (SPEC 7.3, 14.14)`,
      );
    }

    // (d') `outDir` `"out/sub"` is valid: a multi-segment plain spelling
    // redirects the emission under `out/sub/`, preserving each source's
    // workspace-relative path — and redirects rather than duplicates.
    await withWorkspace(
      { files: { "xspec.config.ts": OUTDIR_SUB_CONFIG, ...EMISSION_FILES } },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T7.3-1 `build` with outDir out/sub — a multi-segment plain " +
            "workspace-relative spelling is valid (SPEC 7.3)",
        );
        await assertFileBytes(
          workspace.path("out/sub/specs/A.md"),
          A_COMPILED,
          "T7.3-1 (outDir out/sub): specs/A.mdx emits out/sub/specs/A.md — " +
            "outDir prefixes the preserved workspace-relative path (SPEC 7.3)",
        );
        await assertFileBytes(
          workspace.path("out/sub/specs/sub/B.md"),
          B_COMPILED,
          "T7.3-1 (outDir out/sub): specs/sub/B.mdx emits " +
            "out/sub/specs/sub/B.md — subdirectory structure preserved " +
            "under outDir (SPEC 7.3)",
        );
        for (const vacant of [
          "specs/A.md",
          "specs/sub/B.md",
          "out/specs/A.md",
          "out/specs/sub/B.md",
        ]) {
          await assertNotEmitted(
            workspace,
            vacant,
            "T7.3-1 (outDir out/sub redirects, not duplicates; every " +
              "segment of the spelling is honored)",
          );
        }
      },
    );

    // (d'') An `outDir` naming the graph-data area or a path under it →
    // 14.14 (exit 2, the configuration the concerned path, nothing modified
    // — no graph data and no emitted file appears), one arm per spelling.
    for (const arm of GRAPH_DATA_AREA_OUTDIRS) {
      await expectConfigRefused(
        product,
        arm.config,
        `T7.3-1 (outDir ${JSON.stringify(arm.outDir)} ${arm.why}: no emit ` +
          `destination lies in the graph-data area, graph data being the ` +
          `only derived file under it) \`build --json\` (SPEC 7.3, 13.3, ` +
          `11.6, 14.14)`,
      );
    }

    // (d''') The look-alikes `.xspec2` and `.xspecs/md` are valid: emission
    // writes each destination under them, the absent directory chain
    // created as real directories (13.4; T13.4-8), workspace-relative paths
    // preserved — and redirects rather than duplicates.
    for (const arm of LOOKALIKE_OUTDIRS) {
      const label =
        `T7.3-1 (outDir ${JSON.stringify(arm.outDir)}, a look-alike of the ` +
        `graph-data area)`;
      await withWorkspace(
        { files: { "xspec.config.ts": arm.config, ...EMISSION_FILES } },
        async (workspace) => {
          await buildOk(
            product,
            workspace,
            `${label} \`build\` — neither \`.xspec\` nor beginning with ` +
              `\`.xspec/\`, the spelling is a valid outDir (SPEC 7.3)`,
          );
          for (const dir of arm.chain) {
            const kind = await workspace.kind(dir);
            if (kind !== "dir") {
              fail(
                `${label}: every directory component of the emit ` +
                  `destinations comes into existence as a real directory ` +
                  `(SPEC 13.4, 7.3; T13.4-8) — expected a directory at ` +
                  `${dir}, found: ${kind}`,
              );
            }
          }
          await assertFileBytes(
            workspace.path(`${arm.outDir}/specs/A.md`),
            A_COMPILED,
            `${label}: specs/A.mdx emits ${arm.outDir}/specs/A.md — outDir ` +
              `prefixes the preserved workspace-relative path (SPEC 7.3, 13.2)`,
          );
          await assertFileBytes(
            workspace.path(`${arm.outDir}/specs/sub/B.md`),
            B_COMPILED,
            `${label}: specs/sub/B.mdx emits ${arm.outDir}/specs/sub/B.md — ` +
              `subdirectory structure preserved under outDir (SPEC 7.3, 13.2)`,
          );
          for (const vacant of ["specs/A.md", "specs/sub/B.md"]) {
            await assertNotEmitted(
              workspace,
              vacant,
              `${label} (outDir redirects, not duplicates)`,
            );
          }
        },
      );
    }

    // (e) Classification follows `emit`, discovery channel: with emission
    // off the destination path IS a discovered (code) source — its marker
    // edge exists and `--from` knows the location; with emission on it is
    // not — 13.4 excludes destinations from every group.
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": DESTINATION_DISCOVERY_NO_EMIT_CONFIG,
          ...DESTINATION_DISCOVERY_FILES,
        },
      },
      async (workspace) => {
        const allLabel =
          "T7.3-1 (emit: false — destination path as code source) " +
          "`query edges` (unfiltered)";
        assertEdgeSetEqual(
          decodeEdgesReport(
            await runJson(product, workspace, ["query", "edges"], allLabel),
            allLabel,
          ),
          [CONTAINS_EDGE, DESTINATION_MARKER_EDGE],
          `${allLabel}: with emission off no path is a destination, so ` +
            `specs/A.md is an ordinary discovered code source and its ` +
            `top-level marker records its references edge (SPEC 7.3, 13.4, ` +
            `4.5, 4.6)`,
        );
        const fromLabel =
          "T7.3-1 (emit: false) `query edges --from specs/A.md`";
        assertEdgeSetEqual(
          decodeEdgesReport(
            await runJson(
              product,
              workspace,
              ["query", "edges", "--from", "specs/A.md"],
              fromLabel,
            ),
            fromLabel,
          ),
          [DESTINATION_MARKER_EDGE],
          `${fromLabel}: the path names a known code location — the file is ` +
            `discovered (SPEC 11, 7.3)`,
        );
      },
    );
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": DESTINATION_DISCOVERY_EMIT_CONFIG,
          ...DESTINATION_DISCOVERY_FILES,
        },
      },
      async (workspace) => {
        const allLabel =
          "T7.3-1 (emit: true — destination path excluded) `query edges` " +
          "(unfiltered)";
        assertEdgeSetEqual(
          decodeEdgesReport(
            await runJson(product, workspace, ["query", "edges"], allLabel),
            allLabel,
          ),
          [CONTAINS_EDGE],
          `${allLabel}: with emission enabled specs/A.md is a configured ` +
            `emit destination, excluded from every group (SPEC 13.4) — no ` +
            `edge is sourced at it`,
        );
        const fromLabel = "T7.3-1 (emit: true) `query edges --from specs/A.md`";
        const fromResult = await expectExit(
          product,
          workspace,
          ["query", "edges", "--from", "specs/A.md"],
          2,
          `${fromLabel} — the excluded destination belongs to no configured ` +
            `group, so the path is unknown, a usage error (SPEC 7.3, 13.4, ` +
            `11, 12.0)`,
        );
        expectErrorDocument(
          fromResult,
          `${fromLabel} — query's single JSON document is its only output ` +
            `form, so JSON output is in effect without --json and the ` +
            `exit-2 error document is the entire stdout (SPEC 11, 12.0, ` +
            `12.7, H-5)`,
        );
        if (fromResult.stderrBytes.length === 0) {
          fail(
            `${fromLabel}: the usage error must be a standard-error ` +
              `diagnostic (SPEC 12.0); stderr is empty — ` +
              summarizeResult(fromResult),
          );
        }
      },
    );

    // (f) Classification follows `emit`, import-rule channel (T4-2's rule):
    // the identical workspace flips between exactly one 14.15 finding
    // (emission enabled — the specifier designates a configured destination)
    // and a clean build (emission disabled — no Markdown component to the
    // import rule).
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": DESTINATION_IMPORT_EMIT_CONFIG,
          ...DESTINATION_IMPORT_FILES,
        },
      },
      async (workspace) => {
        const context =
          "T7.3-1 (emit: true) `build --json` over src/use.ts importing " +
          "../specs/A.md — a configured Markdown emit destination";
        const findings = await buildFindings(product, workspace, context);
        assertConditionCounts(findings, { "14.15": 1 }, context);
        assertFindingLocated(
          findings[0]!,
          {
            file: "src/use.ts",
            window: byteWindow("", DESTINATION_IMPORT_STATEMENT),
          },
          `${context}: the 14.15 finding (SPEC 4, 13.4)`,
        );
      },
    );
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": DESTINATION_IMPORT_NO_EMIT_CONFIG,
          ...DESTINATION_IMPORT_FILES,
        },
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T7.3-1 (emit: false) `build` over the identical workspace — with " +
            "emission off no path is a destination, so the same import is " +
            "an ordinary one outside xspec's validations (SPEC 7.3, 4)",
        );
      },
    );

    // (g) Classification is by configuration alone, "whether or not emission
    // has yet run" (SPEC 7.3): no emission has ever run, yet the read
    // command treats the user-occupied destination as no source — not
    // discovered, no 14.19 from the non-`.mdx` match, bytes untouched
    // (`ids` is the representative read; its 13.3 refresh never emits).
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": CONFIG_ALONE_CONFIG,
          "specs/A.mdx": SECTION_A_SOURCE,
          "specs/A.md": USER_AUTHORED_DESTINATION,
        },
      },
      async (workspace) => {
        await expectIdsListing(
          product,
          workspace,
          [{ file: "specs/A.mdx", ids: ["a"] }],
          "T7.3-1 (classification by configuration alone) `ids --json` — " +
            "emission enabled but never run: the glob-matched user file at " +
            "the destination specs/A.md is no source (no 14.19 despite the " +
            "non-`.mdx` match), discriminating classification by existing " +
            "emitted output (SPEC 7.3, 13.4)",
        );
        assertBytesEqual(
          await workspace.readBytes("specs/A.md"),
          USER_AUTHORED_DESTINATION,
          "T7.3-1 (classification by configuration alone): the user-authored " +
            "bytes at the destination are untouched — the read's refresh " +
            "never emits (SPEC 13.3, 7.3)",
        );
      },
    );
  },
});

/** TEST-SPEC §7.1–7.3 T7.1-1, T7.2-1, T7.3-1, in canonical order (SUITE-28). */
export const section71to73Tests: readonly ProductTestEntry[] = [
  T7_1_1,
  T7_2_1,
  T7_3_1,
];
