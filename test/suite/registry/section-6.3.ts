// TEST-SPEC §6.3 (baseline resolution) — SUITE-23: T6.3-1…T6.3-5.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), decodes output through the H-3 adapters,
// and rejects a product only via diagnosed assertion failures (H-8).
//
// SPEC 6.3: a baseline graph is reconstructed from the workspace content at
// the ref — sources and configuration alike, so group membership reflects the
// configuration as it stood at the ref. A journal absent at the ref or in the
// current workspace reads as an empty journal, and an empty journal is a
// prefix of every journal. Entries present in the current journal but absent
// from the journal content at the baseline ref are applied, in file order, to
// map baseline identities to current identities; chained mappings compose.
// Replay that produces an unresolvable mapping, a baseline journal that is
// not a prefix of the current journal, and baseline content that cannot be
// parsed and validated all MUST fail with an actionable error naming the
// offending entries or files; a baseline that cannot be read or reconstructed
// is a usage error (12.0, exit 2), and baseline resolution precedes source
// validation (12.0).
//
// Conservative operationalizations (noted per H-4):
// - "Resolves normally" / "reports no changes" is asserted as an empty
//   `requirements` list plus empty impacted-code groups — the suite's fixed
//   T1.5-1 interpretation (SPEC 9.3 groups output by category, so an
//   uncategorized node appears under none), carried through SUITE-20/22.
// - Every failure arm runs with `--json`: exit 2 exactly (H-5), stdout
//   exactly one 12.7 error document (12.0: with JSON output in effect, an
//   exit-2 invocation emits the error document as its entire stdout), and
//   the actionable error on stderr (12.0: usage and configuration error
//   messages are standard-error content).
// - "Naming the offending entries" for the garbage replay line (staged on
//   journal line 2, after one legitimate entry): entry content is opaque
//   (SPEC 6.1, H-4), so the harness accepts any of — stderr echoing the
//   garbage line's text, stderr citing line/entry 2, or a `journal:2`
//   file:line form. The T6.1-3 operationalization, applied to the stderr
//   channel.
// - "Naming the offending entries or files" for prefix violations: the
//   offending file is the journal, so stderr must name it — it must match
//   /journal/i (satisfied by the path `.xspec/journal` or the word).
// - A baseline whose sources fail parse/validation: stderr must name the
//   offending file — it must contain the file's name (`Broken.mdx`).
// - An unresolvable ref: the offending item is the ref itself, so the
//   actionable error must echo its spelling on stderr.
// - "Report no validation findings" (the precedence arm): findings are
//   report content — stdout (12.0) — so under `--json` the exit-2 error
//   document (which carries no `findings` member, 12.7) as the entire
//   stdout is exactly "no validation findings reported".
// - "Modifying nothing" is asserted as a whole-workspace-root byte snapshot
//   compare around the command, `.git/` included (git is read-only for the
//   product, SPEC preamble; T12.0-11 pins `.git/` byte-identity around every
//   git-reading invocation).
// - T6.3-5's repository-resolution arms report a leaf edit of a two-node
//   file (`specs/A.mdx#a` under its file root): SPEC 5.6's leaf-edit table
//   (T5.6-1) — the section `changed`, the file root `descendant-changed`
//   attributed to it, no other identity; identities are workspace-relative
//   to the configuration's directory (SPEC 1.5), so a `sub/`-prefixed
//   spelling or the outer repository's extra section fails the exact set.
// - "`review create --base v1` records the inner commit" (SPEC 10.7): the
//   recorded creation parameters are product-shaped (H-4), so the inner
//   repository's `v1` commit hash must appear among their string leaves as
//   `review export` emits them — the full hash or an abbreviation of at
//   least 7 hex digits — and the outer repository's `v1` hash must not; the
//   §10.2/§10.6 string-leaf operationalization. Beside it, no item of the
//   session names the extra section that only the outer `v1` holds.
// - The no-repository arm's actionable error: stderr must echo the ref
//   (`HEAD`) or speak of the repository/git — either tells the operator why
//   no baseline resolves. Its staging premise — the workspace lies inside
//   no repository's working tree — is checked through git itself under the
//   product's isolation and reported as a harness condition, never a
//   product verdict, should the OS temporary directory lie inside one.
// - The absent-configuration arms: the offending file is the configuration
//   absent at its repository-relative path in the ref's tree, so stderr
//   must name it (`xspec.config.ts`).
//
// Journal tampering below stays product-independent (H-4): a strictly longer
// baseline journal can be a prefix of no shorter current journal, whatever
// the entry bytes are; the appended garbage line is structureless bytes no
// conforming entry format accepts (T6.1-3's sanctioned staging), appended as
// a whole line under either final-line convention.

import { Buffer } from "node:buffer";
import { execFile } from "node:child_process";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import { promisify } from "node:util";
import type {
  ExportReport,
  ImpactReport,
} from "../../helpers/adapters/index.js";
import {
  decodeExportReport,
  decodeImpactReport,
} from "../../helpers/adapters/index.js";
import {
  assertExitCode,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import type { ProductBinding, RunResult } from "../../helpers/subprocess.js";
import { runProduct, summarizeResult } from "../../helpers/subprocess.js";
import { assertLeavesUnchanged } from "../../helpers/snapshot.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { WorkspaceMdxDecl } from "../../helpers/workspace.js";
import {
  assertSameJson,
  buildFindings,
  buildOk,
  expectErrorDocument,
  expectExit,
} from "./support.js";

// Exactly one spec group over specs/ (SPEC 7) — every fixture here except
// T6.3-1's, whose group membership is the moving part.
const SPECS_ONLY_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`;

const JOURNAL_PATH = ".xspec/journal";
const LF = 0x0a;

// Structureless bytes no conforming journal-entry format accepts — the
// TEST-SPEC-sanctioned shape-independent staging for an unreplayable entry
// (T6.3-4, H-4; the T6.1-3 technique).
const GARBAGE_LINE = "?? harness-injected garbage: not a journal entry ??";

/** Stage a fresh workspace (`files` must include the config), run, dispose. */
async function withWorkspace<T>(
  files: Readonly<Record<string, string>>,
  body: (workspace: TestWorkspace) => Promise<T>,
  mdx?: WorkspaceMdxDecl,
): Promise<T> {
  const workspace = await TestWorkspace.create({ files, mdx });
  try {
    return await body(workspace);
  } finally {
    await workspace.dispose();
  }
}

/**
 * Read the journal's exact bytes, failing diagnosed (H-8) when the path does
 * not hold a plain file (SPEC 6.1: the file comes into existence with the
 * first journaled operation; 13.4: durable files are plain files).
 */
async function readJournal(
  workspace: TestWorkspace,
  context: string,
): Promise<Uint8Array> {
  const kind = await workspace.kind(JOURNAL_PATH);
  if (kind !== "file") {
    fail(
      `${context}: expected the journal as a plain file at ${JOURNAL_PATH} ` +
        `(SPEC 6.1, 13.4); found ${kind}`,
    );
  }
  return await workspace.readBytes(JOURNAL_PATH);
}

/**
 * Lines in a line-oriented file, tolerating a terminated or unterminated
 * final line (0 for an empty file) — the fixed H-4 operationalization of
 * "one entry per line" (SUITE-21).
 */
function journalLineCount(bytes: Uint8Array): number {
  if (bytes.length === 0) return 0;
  let count = 0;
  for (const byte of bytes) {
    if (byte === LF) count += 1;
  }
  if (bytes[bytes.length - 1] !== LF) count += 1;
  return count;
}

/**
 * Append `line` to the journal as a whole line under either final-line
 * convention: the product's final line is terminated first when it left the
 * terminator off (the T6.1-3 technique).
 */
async function appendJournalLine(
  workspace: TestWorkspace,
  existing: Uint8Array,
  line: string,
): Promise<void> {
  const needsTerminator =
    existing.length > 0 && existing[existing.length - 1] !== LF;
  await workspace.file(
    JOURNAL_PATH,
    Buffer.concat([
      existing,
      Buffer.from((needsTerminator ? "\n" : "") + line + "\n", "utf8"),
    ]),
  );
}

/**
 * Run the product from an explicit absolute working directory (H-2) —
 * T6.3-5 drives it from the repository root and from the workspace's
 * subdirectory alike — asserting the exact exit code (H-5).
 */
async function expectExitAt(
  product: ProductBinding,
  cwd: string,
  argv: readonly string[],
  exitCode: number,
  context: string,
): Promise<RunResult> {
  const result = await runProduct(product, { cwd, argv });
  assertExitCode(result, exitCode, context);
  return result;
}

/**
 * `impact … --json` from `cwd`: exit 0 (impact is informational, SPEC 9.3;
 * H-5) with exactly one JSON document, decoded as the impact report (H-3).
 */
async function impactAt(
  product: ProductBinding,
  cwd: string,
  argv: readonly string[],
  context: string,
): Promise<ImpactReport> {
  const result = await expectExitAt(
    product,
    cwd,
    [...argv, "--json"],
    0,
    context,
  );
  return decodeImpactReport(parseJsonStdout(result, context), context);
}

/** `impact --base <ref> --json` from the workspace root. */
async function impactAgainst(
  product: ProductBinding,
  workspace: TestWorkspace,
  ref: string,
  context: string,
): Promise<ImpactReport> {
  return await impactAt(
    product,
    workspace.root,
    ["impact", "--base", ref],
    context,
  );
}

/**
 * Assert an impact report shows no differences: no requirement entry at all
 * (no node carries any change category — the T1.5-1 empty-requirements
 * convention) and both impacted-code groups empty (SPEC 6.2, 6.3, 9.1, 9.2).
 * `reason` explains why this baseline must resolve to no changes.
 */
function assertNoChanges(
  report: ImpactReport,
  reason: string,
  context: string,
): void {
  assertSameJson(
    report.requirements,
    [],
    `${context}: no node may receive any change category — ${reason} ` +
      `(SPEC 6.2, 6.3, 9.1; SPEC 9.3 groups output by category, so an ` +
      `uncategorized node appears under none)`,
  );
  assertSameJson(
    report.code,
    { direct: [], transitive: [] },
    `${context}: no code location is impacted — ${reason} (SPEC 9.2)`,
  );
}

/**
 * A baseline-resolution failure at a baseline-taking command (T6.3-4's
 * contract): run with `--json`, assert exit 2 exactly (a usage error,
 * SPEC 6.3, 12.0) and the single 12.7 error document as the entire stdout
 * (12.0: with JSON output in effect, an exit-2 invocation emits the error
 * document — no report, no validation findings; H-5). The actionable error
 * is stderr content (12.0); callers assert its naming duties on the result.
 */
async function expectBaselineUsageError(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  context: string,
): Promise<RunResult> {
  return await expectBaselineUsageErrorAt(
    product,
    workspace.root,
    argv,
    context,
  );
}

/** {@link expectBaselineUsageError} from an explicit working directory. */
async function expectBaselineUsageErrorAt(
  product: ProductBinding,
  cwd: string,
  argv: readonly string[],
  context: string,
): Promise<RunResult> {
  const result = await expectExitAt(
    product,
    cwd,
    [...argv, "--json"],
    2,
    `${context} — a baseline that cannot be read or reconstructed is a ` +
      `usage error (SPEC 6.3, 12.0)`,
  );
  expectErrorDocument(
    result,
    `${context} — under --json, the exit-2 error document is the entire ` +
      `stdout: the usage error emits no report and no validation findings ` +
      `(SPEC 12.0, 12.7, H-5)`,
  );
  return result;
}

/**
 * Assert the usage error on stderr satisfies a naming duty of SPEC 6.3 ("an
 * actionable error naming the offending entries or files"), via a pattern
 * from the module header's operationalizations.
 */
function assertStderrNames(
  result: RunResult,
  pattern: RegExp,
  requirement: string,
  context: string,
): void {
  if (pattern.test(result.stderr)) return;
  fail(
    `${context}: the actionable error on stderr must ${requirement} ` +
      `(SPEC 6.3: baseline-resolution failures name the offending entries ` +
      `or files; 12.0: usage-error messages are standard-error content); ` +
      `got ${summarizeResult(result)}`,
  );
}

/**
 * Does the stderr text name the garbage journal entry staged on line 2?
 * Accepted forms (module header, H-4): echoing the garbage line's text,
 * citing line/entry 2, or a `journal:2` file:line form.
 */
function stderrNamesGarbageEntry(stderr: string): boolean {
  if (stderr.includes(GARBAGE_LINE)) return true;
  if (/\b(?:line|entry)\s*#?\s*2\b/i.test(stderr)) return true;
  return stderr.includes("journal:2");
}

// ---------------------------------------------------------------------------
// T6.3-1 — configuration at the ref
// ---------------------------------------------------------------------------

// Group membership is the moving part: at the baseline commit the `main`
// group lists only A.mdx while B.mdx already exists on disk (committed,
// byte-identical to the current side); the current configuration adds B.mdx
// to the group. The baseline graph must reflect the configuration as it
// stood at the ref (SPEC 6.3), so B.mdx is absent from the baseline side and
// its nodes are added — `changed` only (SPEC 5.6). A product reconstructing
// the baseline with the *current* configuration discovers B.mdx at the ref
// (its bytes are there and unchanged) and reports no differences instead.
const cfgWithPatterns = (patterns: readonly string[]): string =>
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: [${patterns.map((pattern) => JSON.stringify(pattern)).join(", ")}]
  }
})
`;

const C1_A = "specs/A.mdx";
const C1_A_TOP = "specs/A.mdx#a";
const C1_B = "specs/B.mdx";
const C1_B_TOP = "specs/B.mdx#b";
const C1_A_SOURCE = ['<S id="a">', "Alpha text.", "</S>", ""].join("\n");
const C1_B_SOURCE = ['<S id="b">', "Beta text.", "</S>", ""].join("\n");
// The added file's nodes — root included — are the originating nodes
// (SPEC 5.6: added nodes carry `changed`).
const C1_ADDED = [C1_B, C1_B_TOP];

/**
 * Assert the impact report names exactly the added identities, each not
 * deleted, each `changed` and nothing else, attributed within the added set;
 * and no impacted code (T6.3-1; SPEC 5.6, 6.3, 9.3 — merging categories per
 * node identity across entries, the SUITE-20 convention).
 */
function assertAddedNodesOnly(
  report: ImpactReport,
  added: readonly string[],
  baselineSide: readonly string[],
  context: string,
): void {
  const merged = new Map<
    string,
    { deletedFlags: Set<boolean>; categories: Map<string, string[]> }
  >();
  for (const entry of report.requirements) {
    for (const identity of entry.nodes) {
      if (!added.includes(identity) && !baselineSide.includes(identity)) {
        fail(
          `${context}: the report names ${JSON.stringify(identity)}, which ` +
            `is no node of the fixture (in the workspace-relative identity ` +
            `form of SPEC 1.5); entry: ${JSON.stringify(entry)}`,
        );
      }
      let node = merged.get(identity);
      if (node === undefined) {
        node = { deletedFlags: new Set(), categories: new Map() };
        merged.set(identity, node);
      }
      node.deletedFlags.add(entry.deleted);
      for (const category of entry.categories) {
        const attributed = node.categories.get(category.category) ?? [];
        attributed.push(...category.attributedTo);
        node.categories.set(category.category, attributed);
      }
    }
  }

  assertSameJson(
    [...merged.keys()].sort(),
    [...added].sort(),
    `${context}: the baseline graph must reflect the configuration as it ` +
      `stood at the ref (SPEC 6.3), so exactly the file added to the group ` +
      `since then is absent from the baseline side: its nodes — and no ` +
      `others — are named as added. A report naming none means the baseline ` +
      `was reconstructed with the current configuration; a report naming ` +
      `the unchanged file's nodes gives categories SPEC 5.6 provides no ` +
      `ground for`,
  );
  for (const identity of added) {
    const node = merged.get(identity);
    if (node === undefined) continue; // already failed above
    for (const flag of node.deletedFlags) {
      if (flag) {
        fail(
          `${context}: ${identity} is added — absent from the baseline ` +
            `side, present now — and must not be flagged deleted (SPEC 9.3)`,
        );
      }
    }
    assertSameJson(
      [...node.categories.keys()].sort(),
      ["changed"],
      `${context}: the added node ${identity} is \`changed\` only — a node ` +
        `added since the baseline receives no category through its own ` +
        `hashes (SPEC 5.6)`,
    );
    const attributed = [
      ...new Set(node.categories.get("changed") ?? []),
    ].sort();
    for (const attribution of attributed) {
      if (!added.includes(attribution)) {
        fail(
          `${context}: the changed category of ${identity} is attributed to ` +
            `${JSON.stringify(attribution)}, outside the originating-node ` +
            `set ${JSON.stringify([...added].sort())} (SPEC 5.6: every ` +
            `category is attributed to its originating nodes)`,
        );
      }
    }
  }
  assertSameJson(
    report.code,
    { direct: [], transitive: [] },
    `${context}: no code groups are configured, so no code location is ` +
      `impacted (SPEC 9.2)`,
  );
}

const T6_3_1 = defineProductTest({
  id: "T6.3-1",
  title:
    "config at ref: against a baseline where the configuration had different group membership, the baseline graph reflects the old configuration — a file on disk at the ref but added to a spec group since then is absent from the baseline side, so its nodes report as added (`changed` only) and the unchanged file's nodes report nothing (SPEC 6.3, 5.6, 9.3)",
  run: async (product) => {
    await withWorkspace(
      {
        "xspec.config.ts": cfgWithPatterns([C1_A]),
        [C1_A]: C1_A_SOURCE,
        [C1_B]: C1_B_SOURCE,
      },
      async (workspace) => {
        await workspace.gitInit();
        const base = await workspace.gitCommitAll(
          "baseline: main lists only A.mdx; B.mdx on disk outside the group",
        );
        // The only change since the baseline: the configuration now lists
        // B.mdx in the group. Source bytes are untouched.
        await workspace.file("xspec.config.ts", cfgWithPatterns([C1_A, C1_B]));
        await buildOk(
          product,
          workspace,
          "T6.3-1 `build` under the widened configuration",
        );

        const label = "T6.3-1 `impact --base <pre-widening ref> --json`";
        assertAddedNodesOnly(
          await impactAgainst(product, workspace, base, label),
          C1_ADDED,
          [C1_A, C1_A_TOP],
          label,
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T6.3-2 — absent journal, both directions
// ---------------------------------------------------------------------------

// One file with a child (so the rename's prefix replacement gives the replay
// a descendant mapping too) — the subject of a single journaled rename.
const J2_FILE = "specs/A.mdx";
const J2_SOURCE = [
  '<S id="a">',
  "Alpha text.",
  '<S id="a.k">',
  "Kid text.",
  "</S>",
  "</S>",
  "",
].join("\n");

const T6_3_2 = defineProductTest({
  id: "T6.3-2",
  title:
    "absent journal: a baseline predating the journal file resolves normally — an absent journal reads as empty, an empty journal is a prefix of every journal, and the replayed rename maps identities so no change is reported; a current workspace whose journal file is absent while the baseline's journal is non-empty reads as empty on the current side and fails as a prefix violation — exit 2, the error naming the journal (SPEC 6.3, 6.2, 12.0; T6.3-4)",
  run: async (product) => {
    // --- Baseline predates the journal: resolves normally ---
    await withWorkspace(
      { "xspec.config.ts": SPECS_ONLY_CONFIG, [J2_FILE]: J2_SOURCE },
      async (workspace) => {
        const context = "T6.3-2 journal-absent-at-ref arm";
        await workspace.gitInit();
        const base = await workspace.gitCommitAll(
          "baseline predating the journal",
        );
        await buildOk(product, workspace, `${context}: \`build\``);
        await expectExit(
          product,
          workspace,
          ["rename", J2_FILE, "a", "a2"],
          0,
          `${context}: \`rename ${J2_FILE} a a2\` (the first journaled operation)`,
        );
        // Premise: the journal exists now, so the baseline really predates it.
        await readJournal(
          workspace,
          `${context}: after the journaled rename (staging premise)`,
        );

        const label = `${context}: \`impact --base <pre-journal ref> --json\``;
        assertNoChanges(
          await impactAgainst(product, workspace, base, label),
          "the journal absent at the baseline ref reads as an empty " +
            "journal, a prefix of every journal, so the baseline resolves " +
            "normally, the rename entry replays mapping a→a2 (descendant " +
            "included), and rename purity leaves every hash byte-identical",
          label,
        );
      },
    );

    // --- Baseline journal non-empty, current journal absent: prefix
    // violation (the T6.3-4 contract) ---
    await withWorkspace(
      { "xspec.config.ts": SPECS_ONLY_CONFIG, [J2_FILE]: J2_SOURCE },
      async (workspace) => {
        const context = "T6.3-2 journal-absent-currently arm";
        await workspace.gitInit();
        await buildOk(product, workspace, `${context}: \`build\``);
        await expectExit(
          product,
          workspace,
          ["rename", J2_FILE, "a", "a2"],
          0,
          `${context}: \`rename ${J2_FILE} a a2\` (the journal-creating operation)`,
        );
        // Premise: a non-empty journal is in the working tree, so the
        // all-inclusive commit below records it at the baseline ref.
        const journal = await readJournal(
          workspace,
          `${context}: before committing the baseline (staging premise)`,
        );
        if (journal.length === 0) {
          fail(
            `${context}: staging premise — the journaled rename must leave ` +
              `a non-empty journal at ${JOURNAL_PATH} (SPEC 6.1)`,
          );
        }
        const base = await workspace.gitCommitAll(
          "baseline with a non-empty journal",
        );
        await fsp.rm(workspace.path(JOURNAL_PATH));

        const result = await expectBaselineUsageError(
          product,
          workspace,
          ["impact", "--base", base],
          `${context}: \`impact --base <ref>\` with the current journal ` +
            `file deleted — the current journal reads as empty, and the ` +
            `non-empty baseline journal is not a prefix of it`,
        );
        assertStderrNames(
          result,
          /journal/i,
          "name the journal — the offending file of the prefix violation " +
            `(${JOURNAL_PATH})`,
          context,
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T6.3-3 — replay and composition
// ---------------------------------------------------------------------------

// The rename subject with a child (prefix replacement composes on the
// descendant too: a.kid → b.kid → c.kid) and an untouched sibling as control.
const R3_FILE = "specs/Chain.mdx";
const R3_SOURCE = [
  '<S id="a">',
  "Chain root text.",
  '<S id="a.kid">',
  "Chain kid text.",
  "</S>",
  "</S>",
  "",
  '<S id="keep">',
  "Control text staying put.",
  "</S>",
  "",
].join("\n");

const T6_3_3 = defineProductTest({
  id: "T6.3-3",
  title:
    "replay and composition: rename a→b, commit, rename b→c — `impact` with the older baseline maps a→c (descendants included) through composed journal entries and reports no changes (SPEC 6.3, 6.2)",
  run: async (product) => {
    await withWorkspace(
      { "xspec.config.ts": SPECS_ONLY_CONFIG, [R3_FILE]: R3_SOURCE },
      async (workspace) => {
        await workspace.gitInit();
        const older = await workspace.gitCommitAll(
          "older baseline, before both renames",
        );
        await buildOk(product, workspace, "T6.3-3 `build`");
        await expectExit(
          product,
          workspace,
          ["rename", R3_FILE, "a", "b"],
          0,
          `T6.3-3 \`rename ${R3_FILE} a b\``,
        );
        await workspace.gitCommitAll("mid commit, between the renames");
        await expectExit(
          product,
          workspace,
          ["rename", R3_FILE, "b", "c"],
          0,
          `T6.3-3 \`rename ${R3_FILE} b c\``,
        );

        const label = "T6.3-3 `impact --base <older baseline> --json`";
        assertNoChanges(
          await impactAgainst(product, workspace, older, label),
          "both journal entries are absent from the (empty) journal at the " +
            "older baseline and replay in file order, composing a→b and " +
            "b→c into a→c (a.kid→c.kid); a product that fails to compose " +
            "evaluates a deleted `a` and an added `c` instead and reports " +
            "spurious changes",
          label,
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T6.3-4 — the failure matrix (exit 2)
// ---------------------------------------------------------------------------

// A minimal rename subject for the journal-tampering arms.
const F4_FILE = "specs/A.mdx";
const F4_SOURCE = ['<S id="a">', "Alpha text.", "</S>", ""].join("\n");

// The invalid-baseline-sources arm: committed broken (unparseable — an
// unclosed section tag, 14.20), then fixed in the working tree.
const F4_BROKEN_FILE = "specs/Broken.mdx";
const F4_BROKEN_SOURCE = [
  '<S id="broken">',
  "Text that never closes.",
  "",
].join("\n");
const F4_FIXED_SOURCE = [
  '<S id="broken">',
  "Text that never closes.",
  "</S>",
  "",
].join("\n");

// The precedence arm's invalid current source: an unresolved local `d`
// reference (14.5) — a build validation failure.
const F4_INVALID_SOURCE = [
  '<S id="a" d={["nope"]}>',
  "Alpha text depending on nothing that exists.",
  "</S>",
  "",
].join("\n");

// A ref that resolves to nothing in any fixture repository, with a spelling
// unlikely to appear in an error message for any other reason.
const BOGUS_REF = "no-such-baseline-ref";

const T6_3_4 = defineProductTest({
  id: "T6.3-4",
  title:
    "failures: each baseline-resolution failure exits 2 at a baseline-taking command with an actionable stderr error naming the offending entries or files — a baseline journal that is not a prefix of the current journal (journal rewritten in the fixture); a garbage line appended to the current journal after the baseline commit, at `impact --base` and at `review create --base`, the error naming the offending entry and `review create` modifying nothing; a baseline whose sources fail parse/validation; an unresolvable ref; and the precedence arm — baseline resolution precedes source validation, so both commands with an unresolvable ref over currently-invalid sources exit 2 with the baseline error, report no validation findings, and modify nothing (SPEC 6.3, 10.7, 12.0)",
  run: async (product) => {
    // --- Prefix violation: the current journal was rewritten ---
    await withWorkspace(
      { "xspec.config.ts": SPECS_ONLY_CONFIG, [F4_FILE]: F4_SOURCE },
      async (workspace) => {
        const context = "T6.3-4 prefix-violation arm";
        await workspace.gitInit();
        await buildOk(product, workspace, `${context}: \`build\``);
        await expectExit(
          product,
          workspace,
          ["rename", F4_FILE, "a", "a2"],
          0,
          `${context}: first journaled operation \`rename ${F4_FILE} a a2\``,
        );
        await expectExit(
          product,
          workspace,
          ["rename", F4_FILE, "a2", "a3"],
          0,
          `${context}: second journaled operation \`rename ${F4_FILE} a2 a3\``,
        );
        const full = await readJournal(
          workspace,
          `${context}: after two journaled operations`,
        );
        if (journalLineCount(full) !== 2) {
          fail(
            `${context}: staging premise — two journaled operations yield a ` +
              `two-line journal (SPEC 6.1); found ` +
              `${String(journalLineCount(full))} line(s)`,
          );
        }
        const base = await workspace.gitCommitAll(
          "baseline with the two-entry journal",
        );
        // Rewrite the current journal: keep only the first entry. The
        // committed baseline journal is strictly longer, so it is a prefix
        // of no such current journal, whatever the entry bytes (H-4) — the
        // append-only invariant reads as violated.
        const firstLf = full.indexOf(LF);
        if (firstLf < 0 || firstLf === full.length - 1) {
          fail(
            `${context}: staging premise — the two-line journal must have ` +
              `bytes after its first line terminator`,
          );
        }
        await workspace.file(JOURNAL_PATH, full.subarray(0, firstLf + 1));

        const result = await expectBaselineUsageError(
          product,
          workspace,
          ["impact", "--base", base],
          `${context}: \`impact --base <ref>\` with the current journal ` +
            `truncated below the baseline's journal`,
        );
        assertStderrNames(
          result,
          /journal/i,
          "name the journal — the offending file of the prefix violation " +
            `(${JOURNAL_PATH})`,
          context,
        );
      },
    );

    // --- Unresolvable replay mapping: a garbage line appended to the
    // current journal after the baseline commit ---
    await withWorkspace(
      { "xspec.config.ts": SPECS_ONLY_CONFIG, [F4_FILE]: F4_SOURCE },
      async (workspace) => {
        const context = "T6.3-4 garbage-replay-line arm";
        await workspace.gitInit();
        await buildOk(product, workspace, `${context}: \`build\``);
        await expectExit(
          product,
          workspace,
          ["rename", F4_FILE, "a", "a2"],
          0,
          `${context}: the legitimate journaled operation \`rename ${F4_FILE} a a2\``,
        );
        const legitimate = await readJournal(
          workspace,
          `${context}: after the legitimate operation`,
        );
        if (journalLineCount(legitimate) !== 1) {
          fail(
            `${context}: staging premise — one journaled operation yields a ` +
              `one-line journal (SPEC 6.1), so the garbage lands on line 2; ` +
              `found ${String(journalLineCount(legitimate))} line(s)`,
          );
        }
        const base = await workspace.gitCommitAll(
          "baseline with the one-entry journal",
        );
        // The baseline journal stays a byte prefix of the current journal;
        // replay must apply exactly the appended garbage line — an entry no
        // conforming format resolves to a mapping (H-4).
        await appendJournalLine(workspace, legitimate, GARBAGE_LINE);

        const impactResult = await expectBaselineUsageError(
          product,
          workspace,
          ["impact", "--base", base],
          `${context}: \`impact --base <ref>\` replaying the garbage entry`,
        );
        if (!stderrNamesGarbageEntry(impactResult.stderr)) {
          fail(
            `${context}: \`impact --base\` must name the offending entry — ` +
              `the garbage on journal line 2 (SPEC 6.3): stderr echoing the ` +
              `garbage line's text, citing line/entry 2, or a journal:2 ` +
              `file:line form; got ${summarizeResult(impactResult)}`,
          );
        }

        // `review create --base` fails the same way and modifies nothing
        // (SPEC 10.7): whole-root byte snapshot around the refused command.
        const createResult = await assertLeavesUnchanged(
          workspace.root,
          async () =>
            await expectBaselineUsageError(
              product,
              workspace,
              ["review", "create", "--base", base, "--name", "s1"],
              `${context}: \`review create --base <ref> --name s1\` replaying the garbage entry`,
            ),
          `${context}: \`review create --base\` refused at baseline ` +
            `resolution modifies nothing — no session file, no other write ` +
            `(SPEC 10.7, 6.3)`,
        );
        if (!stderrNamesGarbageEntry(createResult.stderr)) {
          fail(
            `${context}: \`review create --base\` must name the offending ` +
              `entry — the garbage on journal line 2 (SPEC 6.3): stderr ` +
              `echoing the garbage line's text, citing line/entry 2, or a ` +
              `journal:2 file:line form; got ${summarizeResult(createResult)}`,
          );
        }
      },
    );

    // --- Baseline sources fail parse/validation ---
    await withWorkspace(
      {
        "xspec.config.ts": SPECS_ONLY_CONFIG,
        [F4_FILE]: F4_SOURCE,
        [F4_BROKEN_FILE]: F4_BROKEN_SOURCE,
      },
      async (workspace) => {
        const context = "T6.3-4 invalid-baseline-sources arm";
        await workspace.gitInit();
        const base = await workspace.gitCommitAll(
          "baseline with an unparseable source",
        );
        // S-9: the fixed source derives — the per-call declaration overrides
        // the workspace's `unparseable` entry for this write.
        await workspace.file(F4_BROKEN_FILE, F4_FIXED_SOURCE, {
          mdx: "well-formed",
        });
        await buildOk(
          product,
          workspace,
          `${context}: \`build\` over the fixed current sources (staging ` +
            `premise: the failure below is attributable to the baseline alone)`,
        );

        const result = await expectBaselineUsageError(
          product,
          workspace,
          ["impact", "--base", base],
          `${context}: \`impact --base <ref>\` where the baseline content ` +
            `cannot be parsed and validated as a workspace`,
        );
        assertStderrNames(
          result,
          /Broken\.mdx/,
          `name the offending file (${F4_BROKEN_FILE})`,
          context,
        );
      },
      // S-9: the baseline's broken source is the staged parse failure.
      { unparseable: [F4_BROKEN_FILE] },
    );

    // --- Unresolvable ref ---
    await withWorkspace(
      { "xspec.config.ts": SPECS_ONLY_CONFIG, [F4_FILE]: F4_SOURCE },
      async (workspace) => {
        const context = "T6.3-4 unresolvable-ref arm";
        await workspace.gitInit();
        await workspace.gitCommitAll("a commit, so the repository is real");
        await buildOk(product, workspace, `${context}: \`build\``);

        const result = await expectBaselineUsageError(
          product,
          workspace,
          ["impact", "--base", BOGUS_REF],
          `${context}: \`impact --base ${BOGUS_REF}\``,
        );
        assertStderrNames(
          result,
          new RegExp(BOGUS_REF),
          `echo the unresolvable ref (${BOGUS_REF}) — the offending item`,
          context,
        );
      },
    );

    // --- Precedence: baseline resolution precedes source validation ---
    await withWorkspace(
      { "xspec.config.ts": SPECS_ONLY_CONFIG, [F4_FILE]: F4_INVALID_SOURCE },
      async (workspace) => {
        const context = "T6.3-4 precedence arm";
        await workspace.gitInit();
        await workspace.gitCommitAll("a commit, so the repository is real");
        // Staging premise: the current sources really fail build validation
        // — the discrimination below is real (a product that validates the
        // current sources before resolving the baseline exits 1 with these
        // findings instead of 2 with the baseline error).
        const findings = await buildFindings(
          product,
          workspace,
          `${context}: \`build --json\` premise — the current sources fail ` +
            `build validation (unresolved d reference, SPEC 14.5)`,
        );
        if (findings.length === 0) {
          fail(
            `${context}: staging premise — the failing \`build\` must ` +
              `report at least one validation finding (SPEC 14)`,
          );
        }

        for (const argv of [
          ["impact", "--base", BOGUS_REF],
          ["review", "create", "--base", BOGUS_REF, "--name", "precedence"],
        ] as const) {
          const command = argv.join(" ");
          const result = await assertLeavesUnchanged(
            workspace.root,
            async () =>
              await expectBaselineUsageError(
                product,
                workspace,
                argv,
                `${context}: \`${command}\` — baseline resolution precedes ` +
                  `source validation (SPEC 12.0), so the unresolvable ref ` +
                  `is reported as exit 2 with the error document alone (no ` +
                  `validation findings), never exit 1 with findings`,
              ),
            `${context}: \`${command}\` modifies nothing (SPEC 6.3, 10.7, 12.0)`,
          );
          assertStderrNames(
            result,
            new RegExp(BOGUS_REF),
            `echo the unresolvable ref (${BOGUS_REF}) — the baseline error, ` +
              `not a validation report`,
            `${context} (\`${command}\`)`,
          );
        }
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T6.3-5 — repository and path of the baseline
// ---------------------------------------------------------------------------

// SPEC 6.3 fixes where a baseline resolves: the repository whose working tree
// contains the current configuration file — the innermost, where repositories
// nest — whatever repository the working directory lies in; the baseline
// configuration is the file at the current configuration file's
// repository-relative path in the ref's tree, the baseline root its
// directory. Four stagings, each a fresh workspace (H-1):
// (a) the workspace under `sub/` of a repository at the root, driven from
//     `R/sub` (the configuration found by the upward search) and from `R`
//     with `--config sub/xspec.config.ts`;
// (b) an inner repository at `inner/` inside an outer one at the root —
//     a nested repository initialized after the outer committed the inner
//     workspace's files (with an extra section), and separately a submodule
//     (the outer's `v1` a gitlink, no files) — both repositories tagged `v1`
//     at differing trees, driven from `R`;
// (c) a workspace lying in no repository at all;
// (d) refs whose trees hold no file at `sub/xspec.config.ts`.

const R5_SUB = "sub";
const R5_SUB_CONFIG = "sub/xspec.config.ts";
// The configuration under another name (arm d): a commit holding this file
// and no `sub/xspec.config.ts`.
const R5_SUB_RENAMED_CONFIG = "sub/xspec.previous.config.ts";
const R5_SUB_A = "sub/specs/A.mdx";
const R5_INNER = "inner";
const R5_INNER_CONFIG = "inner/xspec.config.ts";
const R5_INNER_A = "inner/specs/A.mdx";
// Identities are workspace-relative — to the configuration's directory
// (SPEC 1.5, 6.3) — so the same two nodes answer under every root.
const R5_A = "specs/A.mdx";
const R5_A_TOP = "specs/A.mdx#a";
const R5_EXTRA_TOP = "specs/A.mdx#extra";
const R5_TEXT_V0 = "Alpha text.";
const R5_TEXT_V1 = "Alpha text, edited.";
const R5_TAG = "v1";
const R5_SESSION = "s";

/** `specs/A.mdx`: section `a` holding `text`, then optionally `extra`. */
function r5Source(text: string, withExtra: boolean): string {
  const lines = ['<S id="a">', text, "</S>"];
  if (withExtra) lines.push('<S id="extra">', "Extra text.", "</S>");
  return lines.join("\n") + "\n";
}

// Identity for commits scripted inside the inner repository: the builder's
// commit helper serves the workspace root's repository only, so the inner
// history is scripted through `git -C inner` under the builder's isolated
// git environment, the identity given inline (hash determinism is not
// needed here — the two `v1` tags need only name distinct commits).
const INNER_IDENTITY = [
  "-c",
  "user.name=xspec fixture",
  "-c",
  "user.email=fixture@xspec.invalid",
] as const;

/**
 * Initialize a repository at `dir` (a subdirectory of the workspace), commit
 * everything under it, tag the commit `v1`, and return its hash.
 */
async function initInnerRepositoryAtV1(
  workspace: TestWorkspace,
  dir: string,
): Promise<string> {
  await workspace.git(["-C", dir, "init", "--quiet", "-b", "main"]);
  await workspace.git(["-C", dir, "config", "core.autocrlf", "false"]);
  await workspace.git(["-C", dir, "add", "-A"]);
  await workspace.git([
    ...INNER_IDENTITY,
    "-C",
    dir,
    "commit",
    "--quiet",
    "-m",
    "inner v1: the workspace without the extra section",
  ]);
  await workspace.git(["-C", dir, "tag", R5_TAG]);
  return (await workspace.git(["-C", dir, "rev-parse", R5_TAG])).stdout.trim();
}

/** Staging premise: the two `v1` tags name distinct commits. */
function assertDistinctTags(
  outerV1: string,
  innerV1: string,
  context: string,
): void {
  if (
    /^[0-9a-f]{40}$/.test(outerV1) &&
    /^[0-9a-f]{40}$/.test(innerV1) &&
    outerV1 !== innerV1
  ) {
    return;
  }
  fail(
    `${context} staging premise: the outer and inner repositories' ${R5_TAG} ` +
      `tags must name two distinct commits; got outer ${outerV1}, inner ` +
      `${innerV1}`,
  );
}

const execFileAsync = promisify(execFile);

/**
 * Staging premise for the no-repository arm (c): the workspace must lie
 * inside no repository's working tree. The builder places every workspace
 * under the OS temporary directory; should that directory itself lie inside
 * a repository, the arm cannot be staged, and the premise fails as a harness
 * condition (a plain error, never a product verdict). Checked through git
 * itself under the product's isolation — ambient `GIT_*` dropped, no
 * ceiling — the way the product's own git reads discover a repository.
 */
export async function assertOutsideAnyRepository(
  root: string,
  context: string,
): Promise<void> {
  const env: Record<string, string> = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (value === undefined || name.toUpperCase().startsWith("GIT_")) continue;
    env[name] = value;
  }
  env["GIT_CONFIG_NOSYSTEM"] = "1";
  env["GIT_CONFIG_GLOBAL"] = os.devNull;
  env["GIT_TERMINAL_PROMPT"] = "0";
  let toplevel: string;
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["-C", root, "rev-parse", "--show-toplevel"],
      { env, timeout: 60_000 },
    );
    toplevel = stdout.trim();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw error;
    return; // git finds no working tree enclosing the root: the premise holds
  }
  throw new Error(
    `${context}: staging premise — the workspace root ${root} must lie ` +
      `inside no repository's working tree, but git finds one at ` +
      `${toplevel} (the OS temporary directory lies inside a repository; ` +
      `T6.3-5's no-repository arm cannot be staged on this machine)`,
  );
}

/** Merge an impact report's entries per node identity (the SUITE-20 way). */
function mergeReportByIdentity(
  report: ImpactReport,
): Map<string, { deleted: Set<boolean>; categories: Map<string, string[]> }> {
  const merged = new Map<
    string,
    { deleted: Set<boolean>; categories: Map<string, string[]> }
  >();
  for (const entry of report.requirements) {
    for (const identity of entry.nodes) {
      let node = merged.get(identity);
      if (node === undefined) {
        node = { deleted: new Set(), categories: new Map() };
        merged.set(identity, node);
      }
      node.deleted.add(entry.deleted);
      for (const category of entry.categories) {
        const attributed = node.categories.get(category.category) ?? [];
        attributed.push(...category.attributedTo);
        node.categories.set(category.category, attributed);
      }
    }
  }
  return merged;
}

/**
 * Assert an impact report shows exactly the leaf edit of `specs/A.mdx#a`:
 * the section `changed` (attributed within itself) and its file root
 * `descendant-changed` attributed to it — SPEC 5.6's leaf-edit table
 * (T5.6-1) — under the workspace-relative identities of the configuration's
 * directory, no other identity, and no impacted code.
 */
function assertLeafEditOnly(report: ImpactReport, context: string): void {
  const merged = mergeReportByIdentity(report);
  assertSameJson(
    [...merged.keys()].sort(),
    [R5_A, R5_A_TOP].sort(),
    `${context}: the report names exactly the edited section and its file ` +
      `root, workspace-relative to the configuration's directory (SPEC 1.5, ` +
      `6.3: identities like \`sub/specs/A.mdx#a\` come from a root taken ` +
      `at the repository instead of the configuration's directory; ` +
      `\`${R5_EXTRA_TOP}\` from a baseline read at the outer repository's ` +
      `${R5_TAG} instead of the inner's — the repository whose working tree ` +
      `contains the configuration)`,
  );
  const expected: Record<string, { category: string; within: string[] }> = {
    [R5_A_TOP]: { category: "changed", within: [R5_A_TOP] },
    [R5_A]: { category: "descendant-changed", within: [R5_A_TOP] },
  };
  for (const [identity, { category, within }] of Object.entries(expected)) {
    const node = merged.get(identity);
    if (node === undefined) continue; // already failed above
    if (node.deleted.has(true)) {
      fail(
        `${context}: ${identity} is present on both sides and must not be ` +
          `flagged deleted (SPEC 9.3)`,
      );
    }
    assertSameJson(
      [...node.categories.keys()].sort(),
      [category],
      `${context}: ${identity} carries exactly \`${category}\` — the ` +
        `edited section is \`changed\`, its ancestor \`descendant-changed\` ` +
        `(SPEC 5.6's leaf edit)`,
    );
    const attributed = [...new Set(node.categories.get(category) ?? [])];
    for (const attribution of attributed) {
      if (!within.includes(attribution)) {
        fail(
          `${context}: the ${category} category of ${identity} is ` +
            `attributed to ${JSON.stringify(attribution)}, outside the ` +
            `originating node ${R5_A_TOP} (SPEC 5.6)`,
        );
      }
    }
    if (category === "descendant-changed" && attributed.length === 0) {
      fail(
        `${context}: the descendant-changed category of ${identity} must ` +
          `be attributed to the edited leaf ${R5_A_TOP} (SPEC 5.6)`,
      );
    }
  }
  assertSameJson(
    report.code,
    { direct: [], transitive: [] },
    `${context}: no code groups are configured, so no code location is ` +
      `impacted (SPEC 9.2)`,
  );
}

/** Every string leaf of a JSON value, walked with an explicit stack. */
function stringLeaves(value: unknown): string[] {
  const leaves: string[] = [];
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const current = stack.pop();
    if (typeof current === "string") {
      leaves.push(current);
    } else if (Array.isArray(current)) {
      for (const item of current) stack.push(item);
    } else if (current !== null && typeof current === "object") {
      for (const item of Object.values(current)) stack.push(item);
    }
  }
  return leaves;
}

/** Does any leaf spell `commit` — the full hash or an abbreviation (≥ 7)? */
function leavesNameCommit(leaves: readonly string[], commit: string): boolean {
  return leaves.some(
    (leaf) =>
      leaf.length >= 7 && /^[0-9a-f]+$/.test(leaf) && commit.startsWith(leaf),
  );
}

/**
 * Assert the exported session records the inner repository's `v1` commit as
 * the baseline `--base` resolved to at creation (SPEC 10.7; T10.5-6 observes
 * the same recording through re-derivation) — the module header's
 * string-leaf operationalization — and not the outer repository's `v1`.
 */
function assertRecordsInnerCommit(
  exported: ExportReport,
  innerV1: string,
  outerV1: string,
  context: string,
): void {
  const leaves = stringLeaves(exported.creationParameters);
  if (!leavesNameCommit(leaves, innerV1)) {
    fail(
      `${context}: \`review create --base ${R5_TAG}\` must record the ` +
        `commit identity the ref resolved to at creation (SPEC 10.7) — ` +
        `${R5_TAG} of the inner repository, ${innerV1}, the repository ` +
        `whose working tree contains the configuration (SPEC 6.3) — among ` +
        `the recorded creation parameters \`review export\` emits (as the ` +
        `full hash or an abbreviation); got ${JSON.stringify(exported.creationParameters)}`,
    );
  }
  if (leavesNameCommit(leaves, outerV1)) {
    fail(
      `${context}: the recorded creation parameters name the OUTER ` +
        `repository's ${R5_TAG}, ${outerV1} — the ref resolved in the ` +
        `working directory's repository rather than the innermost one ` +
        `containing the configuration (SPEC 6.3, 10.7); got ` +
        `${JSON.stringify(exported.creationParameters)}`,
    );
  }
}

/**
 * Assert no item of the exported session names the extra section — a node
 * only the outer repository's `v1` holds, so any item naming it (as scope,
 * context, or origin) was derived against the wrong repository's baseline.
 */
function assertNoItemNamesExtra(exported: ExportReport, context: string): void {
  for (const item of exported.items) {
    const named = [
      item.scope.node,
      ...item.context.map((state) => state.node),
      ...item.origin.map((origin) => origin.node),
    ];
    if (named.includes(R5_EXTRA_TOP)) {
      fail(
        `${context}: item ${item.id} (${item.kind}) names ${R5_EXTRA_TOP}, ` +
          `a node present only in the outer repository's ${R5_TAG}: the ` +
          `session was derived against a baseline read from the working ` +
          `directory's repository, not the inner one containing the ` +
          `configuration (SPEC 6.3, 10.5, 10.7); item: ${JSON.stringify(item)}`,
      );
    }
  }
}

/**
 * The shared body of both nested-repository stagings (b), driven from the
 * outer repository's root: `build`, `impact --base v1`, and `review create
 * --base v1` plus its `export`, each naming the configuration through
 * `--config inner/xspec.config.ts`.
 */
async function runNestedRepositoryArm(
  product: ProductBinding,
  workspace: TestWorkspace,
  innerV1: string,
  outerV1: string,
  context: string,
): Promise<void> {
  const configArgs = ["--config", R5_INNER_CONFIG];
  await expectExitAt(
    product,
    workspace.root,
    ["build", ...configArgs],
    0,
    `${context}: \`build --config ${R5_INNER_CONFIG}\` from R`,
  );
  const report = await impactAt(
    product,
    workspace.root,
    ["impact", "--base", R5_TAG, ...configArgs],
    `${context}: \`impact --base ${R5_TAG} --config ${R5_INNER_CONFIG} ` +
      `--json\` from R — the ref resolves in the inner repository, the one ` +
      `whose working tree contains the configuration, not in the working ` +
      `directory's (SPEC 6.3)`,
  );
  assertLeafEditOnly(
    report,
    `${context}: \`impact --base ${R5_TAG}\` from R (the extra section on ` +
      `neither side — neither deleted nor present)`,
  );
  await expectExitAt(
    product,
    workspace.root,
    ["review", "create", "--base", R5_TAG, ...configArgs, "--name", R5_SESSION],
    0,
    `${context}: \`review create --base ${R5_TAG} --config ` +
      `${R5_INNER_CONFIG} --name ${R5_SESSION}\` from R resolves ${R5_TAG} ` +
      `in the inner repository (SPEC 6.3, 10.7)`,
  );
  const label =
    `${context}: \`review export ${R5_SESSION} --config ${R5_INNER_CONFIG} ` +
    `--json\` from R`;
  const exportResult = await expectExitAt(
    product,
    workspace.root,
    ["review", "export", R5_SESSION, ...configArgs, "--json"],
    0,
    label,
  );
  const exported = decodeExportReport(
    parseJsonStdout(exportResult, label),
    label,
  );
  assertRecordsInnerCommit(exported, innerV1, outerV1, context);
  assertNoItemNamesExtra(exported, context);
}

const T6_3_5 = defineProductTest({
  id: "T6.3-5",
  title:
    "repository and path of the baseline: a workspace rooted in a repository subdirectory reports an edit against the baseline reconstructed from `sub/` at the ref — the configuration read from `sub/xspec.config.ts` in that tree, identities workspace-relative to `sub/` — from `R/sub` and from `R` with `--config` alike; with nested repositories (a nested repository and a submodule, both tagged `v1` at differing trees) `impact --base v1 --config inner/xspec.config.ts` from `R` resolves `v1` in the inner repository — the extra section on neither side — and `review create --base v1` records the inner commit; a configuration outside any working tree makes `impact --base HEAD` exit 2, as does a ref whose tree holds no file at the configuration's repository-relative path, each with an actionable error, nothing modified (SPEC 6.3, 7, 10.7, 12.0; T10.5-6)",
  timeoutMs: 240_000,
  run: async (product) => {
    // --- (a) A workspace rooted in a repository subdirectory ---
    await withWorkspace(
      {
        [R5_SUB_CONFIG]: SPECS_ONLY_CONFIG,
        [R5_SUB_A]: r5Source(R5_TEXT_V0, false),
      },
      async (workspace) => {
        const context = "T6.3-5 (a) repository-subdirectory arm";
        await workspace.gitInit();
        const c1 = await workspace.gitCommitAll(
          "c1: the workspace under sub/ of the repository",
        );
        await workspace.file(R5_SUB_A, r5Source(R5_TEXT_V1, false));
        const subDir = workspace.path(R5_SUB);
        await expectExitAt(
          product,
          subDir,
          ["build"],
          0,
          `${context}: \`build\` from R/sub (the configuration found by the ` +
            `upward search, SPEC 7)`,
        );

        const fromSub = await impactAt(
          product,
          subDir,
          ["impact", "--base", c1],
          `${context}: \`impact --base c1 --json\` from R/sub`,
        );
        assertLeafEditOnly(fromSub, `${context}: from R/sub`);

        const fromRoot = await impactAt(
          product,
          workspace.root,
          ["impact", "--base", c1, "--config", R5_SUB_CONFIG],
          `${context}: \`impact --base c1 --config ${R5_SUB_CONFIG} --json\` ` +
            `from R`,
        );
        assertLeafEditOnly(
          fromRoot,
          `${context}: from R with --config ${R5_SUB_CONFIG}`,
        );
        assertSameJson(
          { requirements: fromRoot.requirements, code: fromRoot.code },
          { requirements: fromSub.requirements, code: fromSub.code },
          `${context}: the report is the same from either working ` +
            `directory — the baseline is reconstructed from sub/ at c1, its ` +
            `configuration read from ${R5_SUB_CONFIG} in that tree, ` +
            `whatever repository the working directory lies in (SPEC 6.3)`,
        );
      },
    );

    // --- (b) Nested repositories: a nested repository ---
    await withWorkspace(
      {
        [R5_INNER_CONFIG]: SPECS_ONLY_CONFIG,
        [R5_INNER_A]: r5Source(R5_TEXT_V0, true),
      },
      async (workspace) => {
        const context = "T6.3-5 (b) nested-repository arm";
        // The outer repository commits the inner workspace's files — with
        // the extra section — and tags v1, before the inner repository
        // exists.
        await workspace.gitInit();
        const outerV1 = await workspace.gitCommitAll(
          "outer v1: the inner workspace's files, with the extra section",
        );
        await workspace.git(["tag", R5_TAG]);
        // The inner repository's v1: the workspace without the extra
        // section.
        await workspace.file(R5_INNER_A, r5Source(R5_TEXT_V0, false));
        const innerV1 = await initInnerRepositoryAtV1(workspace, R5_INNER);
        assertDistinctTags(outerV1, innerV1, context);
        const outerTree = (
          await workspace.git(["show", `${R5_TAG}:${R5_INNER_A}`])
        ).stdout;
        const innerTree = (
          await workspace.git(["-C", R5_INNER, "show", `${R5_TAG}:${R5_A}`])
        ).stdout;
        if (
          !outerTree.includes('id="extra"') ||
          innerTree.includes('id="extra"')
        ) {
          fail(
            `${context} staging premise: the outer ${R5_TAG} must hold ` +
              `${R5_INNER_A} with the extra section and the inner ${R5_TAG} ` +
              `${R5_A} without it; got outer ${JSON.stringify(outerTree)}, ` +
              `inner ${JSON.stringify(innerTree)}`,
          );
        }
        // The current edit.
        await workspace.file(R5_INNER_A, r5Source(R5_TEXT_V1, false));
        await runNestedRepositoryArm(
          product,
          workspace,
          innerV1,
          outerV1,
          context,
        );
      },
    );

    // --- (b) Nested repositories: a submodule ---
    await withWorkspace(
      {
        [R5_INNER_CONFIG]: SPECS_ONLY_CONFIG,
        [R5_INNER_A]: r5Source(R5_TEXT_V0, false),
      },
      async (workspace) => {
        const context = "T6.3-5 (b) submodule arm";
        // The inner repository first (its v1 the workspace without any extra
        // section), then the outer one, which adds it as a submodule in
        // place — a gitlink and no files at its v1.
        const innerV1 = await initInnerRepositoryAtV1(workspace, R5_INNER);
        await workspace.gitInit();
        await workspace.git([
          "-c",
          "protocol.file.allow=always",
          "submodule",
          "--quiet",
          "add",
          `./${R5_INNER}`,
          R5_INNER,
        ]);
        const outerV1 = await workspace.gitCommitAll(
          "outer v1: the inner workspace as a submodule (a gitlink, no files)",
        );
        await workspace.git(["tag", R5_TAG]);
        assertDistinctTags(outerV1, innerV1, context);
        const gitlink = (
          await workspace.git(["ls-tree", R5_TAG, "--", R5_INNER])
        ).stdout;
        const filesAtOuter = (
          await workspace.git(["ls-tree", "-r", R5_TAG, "--", R5_INNER_CONFIG])
        ).stdout;
        if (!/^160000 commit /.test(gitlink) || filesAtOuter.trim() !== "") {
          fail(
            `${context} staging premise: the outer ${R5_TAG} must hold ` +
              `${R5_INNER} as a gitlink and no ${R5_INNER_CONFIG}; got ` +
              `${JSON.stringify(gitlink)} and ${JSON.stringify(filesAtOuter)}`,
          );
        }
        // The current edit.
        await workspace.file(R5_INNER_A, r5Source(R5_TEXT_V1, false));
        await runNestedRepositoryArm(
          product,
          workspace,
          innerV1,
          outerV1,
          context,
        );
      },
    );

    // --- (c) A configuration outside any working tree ---
    await withWorkspace(
      {
        "xspec.config.ts": SPECS_ONLY_CONFIG,
        [R5_A]: r5Source(R5_TEXT_V0, false),
      },
      async (workspace) => {
        const context = "T6.3-5 (c) no-repository arm";
        await assertOutsideAnyRepository(workspace.root, context);
        await buildOk(product, workspace, `${context}: \`build\``);
        const argv = ["impact", "--base", "HEAD"];
        const result = await assertLeavesUnchanged(
          workspace.root,
          async () =>
            await expectBaselineUsageError(
              product,
              workspace,
              argv,
              `${context}: \`impact --base HEAD\` where the configuration ` +
                `file lies inside no repository's working tree — no ` +
                `baseline can be reconstructed`,
            ),
          `${context}: \`impact --base HEAD\` modifies nothing (SPEC 6.3, 12.0)`,
        );
        assertStderrNames(
          result,
          /HEAD|repositor|\bgit\b/i,
          `echo the ref (HEAD) or speak of the repository the configuration ` +
            `lies in none of`,
          context,
        );
      },
    );

    // --- (d) A ref whose tree holds no file at the configuration's path ---
    await withWorkspace(
      { [R5_SUB_A]: r5Source(R5_TEXT_V0, false) },
      async (workspace) => {
        const context = "T6.3-5 (d) configuration-absent-at-ref arm";
        await workspace.gitInit();
        const predating = await workspace.gitCommitAll(
          "c0: sources under sub/, no configuration file yet",
        );
        await workspace.file(R5_SUB_RENAMED_CONFIG, SPECS_ONLY_CONFIG);
        const renamed = await workspace.gitCommitAll(
          "c0': the configuration under another name",
        );
        await fsp.rm(workspace.path(R5_SUB_RENAMED_CONFIG));
        await workspace.file(R5_SUB_CONFIG, SPECS_ONLY_CONFIG);
        await workspace.gitCommitAll(
          `c1: the configuration at ${R5_SUB_CONFIG}`,
        );
        const subDir = workspace.path(R5_SUB);
        await expectExitAt(
          product,
          subDir,
          ["build"],
          0,
          `${context}: \`build\` from R/sub (staging premise: the current ` +
            `workspace is valid, so each exit 2 below is attributable to ` +
            `the baseline alone)`,
        );

        const refs = [
          [predating, `a commit predating ${R5_SUB_CONFIG}`],
          [
            renamed,
            "a commit in which the configuration file bore another name",
          ],
        ] as const;
        const roots = [
          [subDir, "R/sub", []],
          [workspace.root, "R", ["--config", R5_SUB_CONFIG]],
        ] as const;
        for (const [ref, description] of refs) {
          for (const [cwd, where, extra] of roots) {
            const argv = ["impact", "--base", ref, ...extra];
            const command = argv.join(" ");
            const result = await assertLeavesUnchanged(
              workspace.root,
              async () =>
                await expectBaselineUsageErrorAt(
                  product,
                  cwd,
                  argv,
                  `${context}: \`${command}\` from ${where} — ${description}: ` +
                    `the ref's tree holds no file at the configuration's ` +
                    `repository-relative path (${R5_SUB_CONFIG}), so the ` +
                    `baseline cannot be reconstructed`,
                ),
              `${context}: \`${command}\` from ${where} modifies nothing ` +
                `(SPEC 6.3, 12.0)`,
            );
            assertStderrNames(
              result,
              /xspec\.config\.ts/,
              `name the offending file — the configuration absent at ` +
                `${R5_SUB_CONFIG} in the tree of ${description}`,
              `${context} (\`${command}\` from ${where})`,
            );
          }
        }

        // `review create --base` fails the same way and modifies nothing
        // (SPEC 10.7): no session file, no other write.
        const createArgv = [
          "review",
          "create",
          "--base",
          predating,
          "--name",
          R5_SESSION,
        ];
        const createResult = await assertLeavesUnchanged(
          workspace.root,
          async () =>
            await expectBaselineUsageErrorAt(
              product,
              subDir,
              createArgv,
              `${context}: \`${createArgv.join(" ")}\` from R/sub — a ` +
                `commit predating ${R5_SUB_CONFIG}`,
            ),
          `${context}: \`review create --base\` refused at baseline ` +
            `resolution modifies nothing — no session file, no other write ` +
            `(SPEC 10.7, 6.3)`,
        );
        assertStderrNames(
          createResult,
          /xspec\.config\.ts/,
          `name the offending file — the configuration absent at ` +
            `${R5_SUB_CONFIG} in the predating commit's tree`,
          `${context} (\`review create --base\`)`,
        );
      },
    );
  },
});

/** TEST-SPEC §6.3, in canonical ID order (SUITE-23). */
export const section63Tests: readonly ProductTestEntry[] = [
  T6_3_1,
  T6_3_2,
  T6_3_3,
  T6_3_4,
  T6_3_5,
];
