// TEST-SPEC §6.3 (baseline resolution) — SUITE-23: T6.3-1…T6.3-6.
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
// map baseline identities to current identities; chained mappings compose;
// baseline hashes are computed with the journal content at the baseline ref.
// Replay that produces an unresolvable mapping, a baseline journal that is
// not a prefix of the current journal, and baseline content — sources or
// configuration — that cannot be parsed and validated all MUST fail with an
// actionable error naming the offending entries or files; a baseline that
// cannot be read or reconstructed is a usage error (12.0, exit 2) — a plain
// one, its 12.7 error document's `code` and `path` `null` (T6.3-4), unlike
// a journal error the resolution meets reading the current journal first
// (14.13, T6.3-6), and a plain one too where the environment refuses a read
// of git data, the repository's discovery included, never a read failure
// (14.25, T6.3-6(e)) — and baseline resolution precedes source validation
// (12.0).
//
// Conservative operationalizations (noted per H-4):
// - "Resolves normally" / "reports no changes" is asserted as an empty
//   `requirements` list plus empty impacted-code groups — the suite's fixed
//   T1.5-1 interpretation (SPEC 9.3 groups output by category, so an
//   uncategorized node appears under none), carried through SUITE-20/22.
// - A baseline's journal content is what its commit's tree holds at
//   `.xspec/journal` (6.3): where an arm's baseline commit is to hold a
//   journal the product wrote — T6.3-3's intermediate commit, T6.3-4's
//   prefix arm — `git ls-tree` must list that path in the commit's tree, a
//   staging premise beside the journal's line counts (6.1: one entry per
//   line), so an uncommitted journal never reads as a replay verdict.
// - Every failure arm runs with `--json`: exit 2 exactly (H-5), stdout
//   exactly one 12.7 error document (12.0: with JSON output in effect, an
//   exit-2 invocation emits the error document as its entire stdout), and
//   the actionable error on stderr (12.0: usage and configuration error
//   messages are standard-error content). T6.3-4's arms also pin the
//   document's finding as the plain usage error — `code` and `path` `null`
//   (12.7; T12.7-3), never a numbered condition's stable code and concerned
//   path — its `message`, `locations`, and `identities` informational, as
//   T6.3-4 pins none of them; each runs at `impact --base` and at `review
//   create --base … --name n` alike, the latter modifying nothing.
// - "Naming the offending entries or files" for prefix violations: the
//   offending file is the journal, so stderr must name it — it must match
//   /journal/i (satisfied by the path `.xspec/journal` or the word).
// - The prefix arm's current journal is one the product wrote on its
//   workspace — the one-entry journal of its first rename, restored byte
//   for byte once the baseline commit holds the two-entry journal of both
//   — and `check --json` must report no condition-13 error
//   (`journal-error`, 14.13) on it, exiting 0 or 1 as its findings dictate
//   (12.0, 12.2): the restored journal changes canonical identities (5.4),
//   so graph data built beside the two-entry one is stale (14.10), a
//   finding the premise admits. The outcome so stays the code-less prefix
//   violation, never the current journal's own condition (T6.3-6).
// - A baseline whose sources fail parse/validation: stderr must name the
//   offending file — it must contain the file's name (`Broken.mdx`).
// - A baseline whose configuration fails: `c1`'s `xspec.config.ts` is the
//   working tree's configuration plus an unknown top-level key, or that
//   configuration with its `defineConfig` call's closing parenthesis
//   removed (unparseable, 14.20, so declared in its S-9 record), the
//   working tree's configuration and sources valid; the offending file is
//   the configuration in `c1`'s tree, so stderr must name it
//   (`xspec.config.ts`).
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
//   no baseline resolves. Its staging premise is H-1's ancestor
//   precondition (`assertSelfContainedRoot`,
//   helpers/self-contained-root.ts), verified before the arm's first
//   invocation: no ancestor of the root holds an entry named
//   `xspec.config.ts`, and git itself, under the environment the product
//   runs in, finds no working tree enclosing the root — an unmet one a
//   harness error (`HarnessStagingError`), never a product verdict, should
//   the OS temporary directory have either above it.
// - The absent-configuration arms: the offending file is the configuration
//   absent at its repository-relative path in the ref's tree, so stderr
//   must name it (`xspec.config.ts`).
// - T6.3-6's journal error, (a), (b), and (d): T6.1-3's garbage line
//   appended, as its own line, to the one-line journal the product's
//   `rename specs/A.mdx a a2` wrote — read as a plain file first
//   (`readJournal`) — on a workspace whose sources pass `build`. Where
//   the arm's ref is `c1` ((a), (c), (d)), `c1` is the all-inclusive
//   commit taken before the append or the journal path's restaging, its
//   tree holding that one-entry journal (`assertJournalInTree`), so the
//   garbage line is the one entry absent from the ref's journal: a
//   product reading the current journal only through 6.3's replay meets
//   it there as an unresolvable mapping, the code-less usage error the
//   arm fails. (a)'s staging, `stageJournalErrorAtC1`, is exported:
//   T12.7-3's journal-error arm (section-12.7.ts) and T14-4's and T14-6's
//   baseline arms (section-14.ts) stage through it.
// - Each T6.3-6 arm (a)–(d) runs `impact --base <ref>`, then `review create
//   --base <ref> --name n`, each with `--json` under a whole-root compare
//   (H-6's lock-path exclusion applied: no session written; sources,
//   journal, derived files, and graph data byte-identical): exit 2
//   exactly, the 12.7 error document as the entire stdout, and its
//   finding pinned form-exact on `code` `"journal-error"`, `path`
//   `".xspec/journal"`, and `locations` `[]` (12.7, 14, 14.13;
//   T12.7-3) — `message` and `identities` informational, as T6.3-6 pins
//   neither.
// - T6.3-6(a)'s human form (T12.0-15; SPEC 12.0): each command's argv
//   without `--json`, run after its `--json` twin on the same state (the
//   twin modified nothing) under its own whole-root compare, exits 2
//   with standard output empty, and its standard-error message, decoded
//   by the exit-2 adapter (`decodeHumanErrorMessage`,
//   helpers/adapters/human-reports.ts), carries the code
//   `journal-error` and the path `.xspec/journal`
//   (`assertHumanErrorMessageCarries`) — its wording free (H-3).
// - T6.3-6(b)'s stagings: the unresolvable ref is TEST-SPEC's `nope`,
//   beside a commit so the repository is real; the no-repository
//   staging is T6.3-5(c)'s — a workspace directory that is no
//   repository, `--base HEAD` — behind H-1's ancestor precondition
//   (`assertSelfContainedRoot`), verified before its first invocation;
//   the refused discovery is (e)'s nested-repository staging, the garbage
//   line appended to the journal the inner workspace's rename wrote
//   (`build` and the rename run from `R` with `--config
//   inner/xspec.config.ts`, as every run there is), `--base v1`.
// - T6.3-6(c)'s journal-path stagings, each on its own workspace at
//   `c1` (whose tree holds the journal the product wrote): the journal
//   replaced by an empty directory; moved to the root's `journal-target`
//   (out of the graph-data area, no group's file) and linked from the
//   journal path (`../journal-target`), so a product reading through the
//   link resolves `c1` normally; replaced by a FIFO
//   (helpers/lock-staging.ts `stageFifo`, never opened by the harness),
//   checked still a FIFO in place after each run (`assertFifosIntact`) —
//   a product opening it blocks, ended by its run's own guard (S-3); and
//   kept, its read permission removed around each run (T14-10's
//   discipline, `stageReadRefusalOfFile`, verified on the harness). The
//   FIFO and the permission removal are the Linux leg's.
// - T6.3-6(e)'s git data: the object store `.git/objects`
//   (`stageObjectStoreUnsearchable`, exported for T14-9's and T14-10(j)'s
//   baseline arms), and the nested repository's inner `.git`, each staged
//   mode 000 around each run (`stageDirectoryMode`, helpers/permissions.ts
//   — the harness verifying on itself that its own listing of the
//   directory and its own read of a file below it, `c1`'s loose object and
//   `HEAD`, are refused, E-1), the Linux leg's. Each run's error document
//   is pinned as T6.3-4's are — `code` and `path` `null`, never
//   `read-failure` — its stderr unasserted (T6.3-6(e) pins no message: git
//   data is no file 6.3 models, so no offending file is named). The
//   baseline session `s` is created with `review create --base c1` before
//   the staging, exit 0 — the premise that `c1` resolves unstaged — so
//   `review status s` meets the recorded baseline (10.7) refused. Under a
//   mode-000 git directory git's own discovery passes the directory by and
//   walks on upward (its probe of a git directory reaches `HEAD`,
//   `objects/`, and `refs/` inside it), so a product handing discovery to
//   it finds the outer repository from `inner/` and answers against its
//   `v1` — the arm's named failure.
// - Every T6.3-6 staging a run carries — the unreadable journal, a
//   mode-000 git directory — is made just before the run and restored in
//   a `finally` once it ends, before anything is asserted on the result
//   (`runUnderStaging`), inside the run's whole-root compare, whose
//   snapshots are taken outside it: the harness's own walk, which can
//   neither list a mode-000 directory nor read a `-w-------` file, never
//   meets the staging.
// - T6.3-6(d)'s failing sources: `specs/A.mdx` restaged after `c1` with
//   the renamed section's unresolved local `d` reference (14.5), the
//   premise `build --json` exiting 1 with at least one finding before
//   the garbage line is appended; each command then exits 2 with the
//   journal error, never the gate's exit 1 with its findings (12.0: a
//   given baseline is never so masked).
//
// Journal tampering below stays product-independent (H-4): the prefix arm's
// baseline journal, the two-entry journal of both renames, is strictly
// longer than the one-entry journal of the first — the current journal it
// restores — so it can be a prefix of no such current journal, whatever the
// entry bytes are. T6.3-6's garbage line is structureless bytes no
// conforming entry format accepts (T6.1-3's), never a duplicate or
// recombination of product-written entries.
//
// Staged-source records (TEST-SPEC S-9's before-any-product clause;
// helpers/staged-mdx.ts, helpers/staged-ts.ts): every workspace a body here
// creates after its first product invocation — T6.3-2's second arm, T6.3-4's
// five later arms, T6.3-5's arms (b)–(d), T6.3-6's stagings after (a) —
// takes its initial `.mdx` sources and configuration files as ledger
// records, judged by test/self/s9-staged-sources.test.ts before any product
// exists; where a body's first workspace stages the same expression, the
// record stands there too (converted uniformly). T6.3-6(d)'s failing
// source, staged by `file()` after the arm's invocations, is a record too,
// as are the nested-repository staging's inner sources T6.3-5 and T6.3-6
// share (`stageNestedRepositories`).
// T6.3-1's and T6.3-3's one workspace each precede any invocation and stay
// plain.

import { Buffer } from "node:buffer";
import * as fsp from "node:fs/promises";
import type {
  ErrorInformation,
  ExportReport,
  ImpactReport,
} from "../../helpers/adapters/index.js";
import {
  assertHumanErrorMessageCarries,
  decodeExportReport,
  decodeFindingsReport,
  decodeImpactReport,
} from "../../helpers/adapters/index.js";
import {
  assertExitCode,
  assertStdoutEmpty,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { assertFifosIntact, stageFifo } from "../../helpers/lock-staging.js";
import type { PermissionStaging } from "../../helpers/permissions.js";
import {
  stageDirectoryMode,
  stageReadRefusalOfFile,
} from "../../helpers/permissions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { assertSelfContainedRoot } from "../../helpers/self-contained-root.js";
import { stagedMdx } from "../../helpers/staged-mdx.js";
import { stagedTs } from "../../helpers/staged-ts.js";
import type { StagedTs } from "../../helpers/staged-ts.js";
import type { ProductBinding, RunResult } from "../../helpers/subprocess.js";
import { runProduct, summarizeResult } from "../../helpers/subprocess.js";
import { assertLeavesUnchanged } from "../../helpers/snapshot.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { InitialFileContents } from "../../helpers/workspace.js";
import {
  assertSameJson,
  buildFindings,
  buildOk,
  expectErrorDocument,
  expectExit,
  runCli,
} from "./support.js";

// Exactly one spec group over specs/ (SPEC 7) — every fixture here except
// T6.3-1's, whose group membership is the moving part. T6.3-2, T6.3-4,
// T6.3-5, and T6.3-6 stage it after a product invocation — in a later
// workspace, at `xspec.config.ts` or `inner/xspec.config.ts`, and by
// `file()` at `xspec.config.ts` (T6.3-4's baseline-configuration arms,
// over the configuration their `c1` commits), `sub/xspec.previous.config.ts`,
// and `sub/xspec.config.ts` — and T14-10 (section-14-ii.ts) at
// `inner/xspec.config.ts`, through the nested-repository staging its arm
// (j) shares (`NESTED_REPOSITORY_FILES`) — so it is a staged-source record
// (S-9's timing clause; test/self/s9-staged-sources.test.ts). Its text is
// kept apart for T6.3-4's two baseline configurations, derived from it at
// module load.
const SPECS_ONLY_CONFIG_TEXT = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`;
const SPECS_ONLY_CONFIG = stagedTs(
  "T6.3-2/T6.3-4/T6.3-5/T6.3-6/T14-10 xspec.config.ts — exactly one spec group over specs/, staged at every configuration path",
  SPECS_ONLY_CONFIG_TEXT,
);

const JOURNAL_PATH = ".xspec/journal";
const LF = 0x0a;

/** Stage a fresh workspace (`files` must include the config), run, dispose. */
async function withWorkspace<T>(
  files: Readonly<Record<string, InitialFileContents>>,
  body: (workspace: TestWorkspace) => Promise<T>,
): Promise<T> {
  const workspace = await TestWorkspace.create({ files });
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
 * `journalPath` is relative to the root the harness built — the root
 * workspace's journal by default, `inner/.xspec/journal` where the
 * configuration names a workspace below it (T6.3-6's nested repository).
 */
async function readJournal(
  workspace: TestWorkspace,
  context: string,
  journalPath: string = JOURNAL_PATH,
): Promise<Uint8Array> {
  const kind = await workspace.kind(journalPath);
  if (kind !== "file") {
    fail(
      `${context}: expected the journal as a plain file at ${journalPath} ` +
        `(SPEC 6.1, 13.4); found ${kind}`,
    );
  }
  return await workspace.readBytes(journalPath);
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
 * Staging premise on a journal the product wrote: exactly `lines` lines
 * (`journalLineCount`; SPEC 6.1: one entry per line, each journaled
 * operation appending one), failing diagnosed (H-8) otherwise.
 */
function assertJournalLines(
  journal: Uint8Array,
  lines: number,
  why: string,
  context: string,
): void {
  const found = journalLineCount(journal);
  if (found === lines) return;
  fail(
    `${context}: staging premise — ${why} (SPEC 6.1: one entry per line); ` +
      `found ${String(found)} line(s)`,
  );
}

/**
 * Staging premise (module header): `commit`'s tree holds `.xspec/journal` —
 * the all-inclusive commit took the journal the product wrote (SPEC 13.4:
 * durable files are suitable for committing), so the baseline's journal
 * content at the ref (6.3) is that journal, never an absent one read as
 * empty.
 */
async function assertJournalInTree(
  workspace: TestWorkspace,
  commit: string,
  context: string,
): Promise<void> {
  const listed = (await workspace.git(["ls-tree", commit, "--", JOURNAL_PATH]))
    .stdout;
  if (/^100(?:644|755) blob [0-9a-f]+\t\.xspec\/journal$/m.test(listed)) {
    return;
  }
  fail(
    `${context}: staging premise — the commit's tree must hold the journal ` +
      `the product wrote at ${JOURNAL_PATH}, the baseline's journal content ` +
      `at the ref (SPEC 6.3; 13.4: durable files are suitable for ` +
      `committing); \`git ls-tree\` listed ${JSON.stringify(listed)}`,
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
 * A baseline-resolution failure at a baseline-taking command (every failure
 * arm here; T6.3-4's arms pin its finding further,
 * `expectCodelessBaselineError`): run with `--json`, assert exit 2 exactly
 * (a usage error, SPEC 6.3, 12.0) and the single 12.7 error document as the
 * entire stdout (12.0: with JSON output in effect, an exit-2 invocation
 * emits the error document — no report, no validation findings; H-5). The
 * actionable error is stderr content (12.0); callers assert its naming
 * duties on the result.
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
 * T6.3-4's failure contract at one baseline-taking command: the exit-2 usage
 * error with the 12.7 error document as the entire stdout
 * (`expectBaselineUsageError`), its finding the plain usage error — `code`
 * and `path` `null` (SPEC 6.3, 12.7: every exit-2 error but the conditions
 * 14 codes; T12.7-3) — never a numbered condition's stable code and
 * concerned path: neither the current journal's own journal error (14.13,
 * T6.3-6) nor the configuration error a current-configuration loader would
 * report for a baseline's configuration (14.14). `message`, `locations`,
 * and `identities` are informational (module header).
 */
async function expectCodelessBaselineError(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  context: string,
): Promise<RunResult> {
  const result = await expectBaselineUsageError(
    product,
    workspace,
    argv,
    context,
  );
  const error = expectErrorDocument(result, context);
  assertSameJson(
    { code: error.code, path: error.path },
    { code: null, path: null },
    `${context}: a baseline that cannot be read or reconstructed is a plain ` +
      `usage error — the error document's \`code\` and \`path\` \`null\` ` +
      `(SPEC 6.3, 12.7; T12.7-3), never a numbered condition's stable code ` +
      `and concerned path (message: ${JSON.stringify(error.message)})`,
  );
  return result;
}

/** A naming duty of SPEC 6.3 on the actionable error, for `assertStderrNames`. */
interface NamingDuty {
  readonly pattern: RegExp;
  readonly requirement: string;
}

// The session name T6.3-4's refused `review create --base` runs ask for.
const F4_SESSION = "n";

/**
 * One T6.3-4 failure at both baseline-taking commands on `workspace`:
 * `impact --base <ref>`, then `review create --base <ref> --name n`, each
 * the code-less baseline error (`expectCodelessBaselineError`) whose stderr
 * meets `naming`, `review create` modifying nothing — a whole-root byte
 * compare around it, H-6's lock-path exclusion applied: no session file
 * written; sources, journal, derived files, and graph data byte-identical
 * (SPEC 10.7, 6.3). `why` says why the baseline cannot be reconstructed.
 */
async function expectBaselineFailureAtBothCommands(
  product: ProductBinding,
  workspace: TestWorkspace,
  ref: string,
  naming: NamingDuty,
  why: string,
  context: string,
): Promise<void> {
  const impact = await expectCodelessBaselineError(
    product,
    workspace,
    ["impact", "--base", ref],
    `${context}: \`impact --base <ref>\` — ${why}`,
  );
  assertStderrNames(
    impact,
    naming.pattern,
    naming.requirement,
    `${context} (\`impact --base\`)`,
  );
  const create = await assertLeavesUnchanged(
    workspace.root,
    async () =>
      await expectCodelessBaselineError(
        product,
        workspace,
        ["review", "create", "--base", ref, "--name", F4_SESSION],
        `${context}: \`review create --base <ref> --name ${F4_SESSION}\` — ` +
          why,
      ),
    `${context}: \`review create --base\` refused at baseline resolution ` +
      `modifies nothing — no session file written; sources, journal, ` +
      `derived files, and graph data byte-identical (SPEC 10.7, 6.3)`,
  );
  assertStderrNames(
    create,
    naming.pattern,
    naming.requirement,
    `${context} (\`review create --base\`)`,
  );
}

/**
 * The prefix arm's current-journal premise (module header): `check --json`
 * reports no condition-13 error (`journal-error`, 14.13) on the journal the
 * product wrote, so the baseline-taking commands meet the code-less prefix
 * violation rather than the current journal's own condition (T6.3-6). The
 * report is decoded form-exact (H-3), its exit 0 exactly when it carries no
 * finding (SPEC 12.0, 12.2) — the staleness the restored journal brings
 * (14.10) admitted.
 */
async function assertCheckReportsNoJournalError(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
): Promise<void> {
  const label =
    `${context}: \`check --json\` on the current journal (premise: no ` +
    `condition-13 error)`;
  const result = await runProduct(product, {
    cwd: workspace.root,
    argv: ["check", "--json"],
  });
  if (
    result.signal !== null ||
    (result.exitCode !== 0 && result.exitCode !== 1)
  ) {
    fail(
      `${label}: \`check\` reports its findings, exit 0 or 1 (SPEC 12.2, ` +
        `12.0); got ${summarizeResult(result)}`,
    );
  }
  const { findings } = decodeFindingsReport(
    parseJsonStdout(result, label),
    label,
  );
  assertExitCode(
    result,
    findings.length === 0 ? 0 : 1,
    `${label} — \`check\` exits 1 on any finding, else 0 (SPEC 12.2, 12.0)`,
  );
  const journalErrors = findings.filter(
    (finding) => finding.code === "journal-error",
  );
  if (journalErrors.length > 0) {
    fail(
      `${label}: the current journal is one the product wrote on this ` +
        `workspace — its first rename's one entry — so \`check\` reports ` +
        `no condition-13 error on it (SPEC 6.1, 14.13; T6.3-4: the current ` +
        `journal kept free of condition-13 errors, so the outcome stays the ` +
        `code-less prefix violation rather than the current journal's own, ` +
        `T6.3-6); got ${JSON.stringify(journalErrors)}`,
    );
  }
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
// Staged in both arms' workspaces; the second follows the first's
// invocations, so it is a staged-source record (module header) — the
// expression wrapped in place.
const J2_SOURCE = stagedMdx(
  "T6.3-2 specs/A.mdx",
  [
    '<S id="a">',
    "Alpha text.",
    '<S id="a.k">',
    "Kid text.",
    "</S>",
    "</S>",
    "",
  ].join("\n"),
);

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
// The file root's own content references the subject by its canonical
// identity (5.4), so a baseline side at the intermediate commit computed
// with no journal — `b` its own canonical identity rather than `a` —
// changes the root's ownHash: the intermediate arm's discrimination.
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
    "replay and composition: rename a→b, commit, rename b→c — `impact` with the older baseline maps a→c (descendants included) through composed journal entries and reports no changes; `impact` with the intermediate commit, its tree holding the one-entry journal the a→b rename wrote, maps b→c through the one entry absent from it and likewise reports no changes, the baseline's hashes computed with the journal content at the ref (SPEC 6.3, 6.2, 5.4)",
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
        assertJournalLines(
          await readJournal(workspace, "T6.3-3: after `rename a b`"),
          1,
          "the first journaled operation yields a one-line journal, the " +
            "one entry the intermediate commit holds",
          "T6.3-3",
        );
        const intermediate = await workspace.gitCommitAll(
          "intermediate commit, between the renames: the one-entry journal",
        );
        await assertJournalInTree(
          workspace,
          intermediate,
          "T6.3-3 the intermediate commit",
        );
        await expectExit(
          product,
          workspace,
          ["rename", R3_FILE, "b", "c"],
          0,
          `T6.3-3 \`rename ${R3_FILE} b c\``,
        );
        assertJournalLines(
          await readJournal(workspace, "T6.3-3: after `rename b c`"),
          2,
          "the second journaled operation appends the current journal's " +
            "second entry, the one absent from the intermediate commit's",
          "T6.3-3",
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

        const intermediateLabel =
          "T6.3-3 `impact --base <intermediate commit> --json`";
        assertNoChanges(
          await impactAgainst(
            product,
            workspace,
            intermediate,
            intermediateLabel,
          ),
          "the intermediate commit's journal holds the a→b entry, so the " +
            "b→c entry alone is absent from it and replays, mapping b→c " +
            "(b.kid→c.kid), and the baseline's hashes are computed with " +
            "that journal content (SPEC 6.3), `b` taking `a` as its " +
            "canonical identity as `c` does (5.4); a product that computes " +
            "the baseline side's canonical identities with no journal takes " +
            "`b` itself as `b`'s, and `b`'s parent, the file root, then " +
            "differs in ownHash and reports changed",
          intermediateLabel,
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T6.3-4 — the failure matrix (exit 2)
// ---------------------------------------------------------------------------

// A minimal valid source: the prefix arm's rename subject, beside each
// later arm's subject.
const F4_FILE = "specs/A.mdx";
// Every arm after the first creates its workspace after the earlier arms'
// invocations, so the initial `.mdx` sources and configuration files are
// staged-source records (module header), each expression wrapped in place:
// the shared A.mdx (staged in the first arm too), the broken source under
// its `unparseable` declaration — the record carries what the workspace
// declaration's entry for the path used to — the baseline-configuration
// arms' two configurations, and the precedence arm's invalid, parseable
// source.
const F4_SOURCE = stagedMdx(
  "T6.3-4 specs/A.mdx",
  ['<S id="a">', "Alpha text.", "</S>", ""].join("\n"),
);

// The invalid-baseline-sources arm: committed broken (unparseable — an
// unclosed section tag, 14.20), then fixed in the working tree.
const F4_BROKEN_FILE = "specs/Broken.mdx";
const F4_BROKEN_SOURCE = stagedMdx(
  "T6.3-4 invalid-baseline-sources arm: specs/Broken.mdx committed broken",
  ['<S id="broken">', "Text that never closes.", ""].join("\n"),
  "unparseable",
);
const F4_FIXED_SOURCE = [
  '<S id="broken">',
  "Text that never closes.",
  "</S>",
  "",
].join("\n");
// The fix is staged after the body's earlier arms invoked the product, so
// it is a ledger record (S-9's before-any-product clause;
// helpers/staged-mdx.ts): the same constant, carrying the call's former
// `well-formed` option as its declaration — the record's declaration
// governs the write, whatever the path's initial record declared.
const T6_3_4_FIXED = stagedMdx(
  "T6.3-4 invalid-baseline-sources arm: specs/Broken.mdx fixed in the working tree",
  F4_FIXED_SOURCE,
  "well-formed",
);

/**
 * The working tree's configuration (`SPECS_ONLY_CONFIG_TEXT`) with its one
 * occurrence of `anchor` replaced — a baseline configuration derived at
 * module load, so it differs from the working tree's in exactly the stated
 * way. An anchor occurring other than once is a defect of this module.
 */
function deriveBaselineConfig(
  anchor: string,
  replacement: string,
  what: string,
): string {
  const at = SPECS_ONLY_CONFIG_TEXT.indexOf(anchor);
  if (at < 0 || SPECS_ONLY_CONFIG_TEXT.indexOf(anchor, at + 1) >= 0) {
    throw new Error(
      `section-6.3 T6.3-4 ${what}: the anchor ${JSON.stringify(anchor)} ` +
        "must occur exactly once in the configuration it derives from",
    );
  }
  return (
    SPECS_ONLY_CONFIG_TEXT.slice(0, at) +
    replacement +
    SPECS_ONLY_CONFIG_TEXT.slice(at + anchor.length)
  );
}

/** A baseline-configuration arm: its label and `c1`'s configuration. */
interface BaselineConfigArm {
  readonly label: string;
  readonly config: StagedTs;
}

// The baseline-configuration arms (TEST-SPEC T6.3-4): each `c1` commits one
// of these at `xspec.config.ts` beside valid sources, no journal, and the
// working tree then takes the valid configuration back
// (`SPECS_ONLY_CONFIG`). The first adds the unknown top-level key `bogus`
// after `specs`; the second removes the `defineConfig` call's closing
// parenthesis, leaving no well-formed TypeScript (14.20) — declared so in its
// S-9 record.
const F4_BASELINE_CONFIG_ARMS: readonly BaselineConfigArm[] = [
  {
    label: "an unknown top-level key",
    config: stagedTs(
      "T6.3-4 baseline-configuration arm: c1's xspec.config.ts — the working tree's configuration plus an unknown top-level key",
      deriveBaselineConfig(
        "\n  }\n})\n",
        "\n  },\n  bogus: true\n})\n",
        "unknown-key configuration",
      ),
    ),
  },
  {
    label: "its `defineConfig` call's closing parenthesis removed",
    config: stagedTs(
      "T6.3-4 baseline-configuration arm: c1's xspec.config.ts — the working tree's configuration, its defineConfig call's closing parenthesis removed",
      deriveBaselineConfig("})\n", "}\n", "unclosed-call configuration"),
      "unparseable",
    ),
  },
];

// The precedence arm's invalid current source: an unresolved local `d`
// reference (14.5) — a build validation failure.
const F4_INVALID_SOURCE = stagedMdx(
  "T6.3-4 precedence arm specs/A.mdx",
  [
    '<S id="a" d={["nope"]}>',
    "Alpha text depending on nothing that exists.",
    "</S>",
    "",
  ].join("\n"),
);

// A ref that resolves to nothing in any fixture repository, with a spelling
// unlikely to appear in an error message for any other reason.
const BOGUS_REF = "no-such-baseline-ref";

const T6_3_4 = defineProductTest({
  id: "T6.3-4",
  title:
    "failures: each baseline-resolution failure exits 2 at both baseline-taking commands, `impact --base` and `review create --base … --name n` — `review create` modifying nothing — as a plain usage error, the error document's `code` and `path` `null`, with an actionable stderr error naming the offending entries or files: a baseline journal that is not a prefix of the current journal (the current journal restored to the one entry the product wrote before the baseline's two, `check` reporting no 14.13 on it); a baseline whose sources fail parse/validation; a baseline whose configuration does — `c1`'s `xspec.config.ts` the working tree's configuration plus an unknown top-level key, and separately with its `defineConfig` call's closing parenthesis removed — the error naming `xspec.config.ts`, no session written; an unresolvable ref; and the precedence arm — baseline resolution precedes source validation, so both commands with an unresolvable ref over currently-invalid sources exit 2 with the baseline error, report no validation findings, and modify nothing (SPEC 6.3, 10.7, 12.0, 12.7)",
  run: async (product) => {
    // --- Prefix violation: the current journal restored to the one entry
    // the product wrote before the baseline's two ---
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
        const first = await readJournal(
          workspace,
          `${context}: after the first journaled operation`,
        );
        assertJournalLines(
          first,
          1,
          "one journaled operation yields a one-line journal",
          context,
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
        assertJournalLines(
          full,
          2,
          "two journaled operations yield a two-line journal",
          context,
        );
        if (full.length <= first.length) {
          fail(
            `${context}: staging premise — the second journaled operation ` +
              `appends to the journal (SPEC 6.1: append-only), so the ` +
              `two-entry journal is strictly longer than the one-entry ` +
              `journal it extends; found ${String(full.length)} byte(s) ` +
              `after ${String(first.length)}`,
          );
        }
        const base = await workspace.gitCommitAll(
          "baseline with the two-entry journal",
        );
        await assertJournalInTree(
          workspace,
          base,
          `${context}: the baseline commit`,
        );
        // Restore the one-entry journal the product wrote at the first
        // rename. The committed baseline journal is strictly longer, so it
        // is a prefix of no such current journal, whatever the entry bytes
        // (H-4) — the append-only invariant reads as violated — while the
        // current journal stays one the product wrote on this workspace,
        // `check` reporting no condition-13 error on it (module header).
        await workspace.file(JOURNAL_PATH, first);
        await assertCheckReportsNoJournalError(product, workspace, context);

        await expectBaselineFailureAtBothCommands(
          product,
          workspace,
          base,
          {
            pattern: /journal/i,
            requirement:
              "name the journal — the offending file of the prefix " +
              `violation (${JOURNAL_PATH})`,
          },
          "the baseline's two-entry journal is not a prefix of the current " +
            "one-entry journal",
          context,
        );
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
        // S-9: the fixed source derives — the record's `well-formed`
        // declaration governs this write, the initial record's `unparseable`
        // one the staging above.
        await workspace.file(F4_BROKEN_FILE, T6_3_4_FIXED);
        await buildOk(
          product,
          workspace,
          `${context}: \`build\` over the fixed current sources (staging ` +
            `premise: the failure below is attributable to the baseline alone)`,
        );

        await expectBaselineFailureAtBothCommands(
          product,
          workspace,
          base,
          {
            pattern: /Broken\.mdx/,
            requirement: `name the offending file (${F4_BROKEN_FILE})`,
          },
          "the baseline content cannot be parsed and validated as a workspace",
          context,
        );
      },
    );

    // --- Baseline configuration fails validation: the unknown key, then
    // the unclosed call ---
    for (const arm of F4_BASELINE_CONFIG_ARMS) {
      await withWorkspace(
        { "xspec.config.ts": arm.config, [F4_FILE]: F4_SOURCE },
        async (workspace) => {
          const context = `T6.3-4 baseline-configuration arm (${arm.label})`;
          // A workspace rooted at its repository's root: `c1` commits the
          // configuration under test beside valid sources — no journal, no
          // operation having run here — and the working tree takes the
          // valid configuration back.
          await workspace.gitInit();
          const c1 = await workspace.gitCommitAll(
            `c1: xspec.config.ts with ${arm.label}`,
          );
          await workspace.file("xspec.config.ts", SPECS_ONLY_CONFIG);
          await buildOk(
            product,
            workspace,
            `${context}: \`build\` over the working tree's valid ` +
              `configuration and sources (staging premise: the failure ` +
              `below is attributable to c1's configuration alone)`,
          );

          await expectBaselineFailureAtBothCommands(
            product,
            workspace,
            c1,
            {
              pattern: /xspec\.config\.ts/,
              requirement:
                "name the offending file — the configuration in c1's tree " +
                "(xspec.config.ts)",
            },
            `c1's configuration (${arm.label}) fails validation, the ` +
              `baseline reconstructed from sources and configuration alike ` +
              `— its configuration the file at the current configuration's ` +
              `repository-relative path in the ref's tree, git data (SPEC ` +
              `6.3), never the configuration 7 locates and 14.14 judges at ` +
              `load, so neither read leniently nor reported as ` +
              `\`configuration-error\``,
            context,
          );
        },
      );
    }

    // --- Unresolvable ref ---
    await withWorkspace(
      { "xspec.config.ts": SPECS_ONLY_CONFIG, [F4_FILE]: F4_SOURCE },
      async (workspace) => {
        const context = "T6.3-4 unresolvable-ref arm";
        await workspace.gitInit();
        await workspace.gitCommitAll("a commit, so the repository is real");
        await buildOk(product, workspace, `${context}: \`build\``);

        await expectBaselineFailureAtBothCommands(
          product,
          workspace,
          BOGUS_REF,
          {
            pattern: new RegExp(BOGUS_REF),
            requirement: `echo the unresolvable ref (${BOGUS_REF}) — the offending item`,
          },
          `the ref ${BOGUS_REF} resolves to no commit`,
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
              await expectCodelessBaselineError(
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
export const R5_INNER = "inner";
const R5_INNER_CONFIG = "inner/xspec.config.ts";
const R5_INNER_A = "inner/specs/A.mdx";
// Identities are workspace-relative — to the configuration's directory
// (SPEC 1.5, 6.3) — so the same two nodes answer under every root.
const R5_A = "specs/A.mdx";
const R5_A_TOP = "specs/A.mdx#a";
const R5_EXTRA_TOP = "specs/A.mdx#extra";
const R5_TEXT_V0 = "Alpha text.";
const R5_TEXT_V1 = "Alpha text, edited.";
export const R5_TAG = "v1";
const R5_SESSION = "s";

/** `specs/A.mdx`: section `a` holding `text`, then optionally `extra`. */
function r5Source(text: string, withExtra: boolean): string {
  const lines = ['<S id="a">', text, "</S>"];
  if (withExtra) lines.push('<S id="extra">', "Extra text.", "</S>");
  return lines.join("\n") + "\n";
}

// Every staging after arm (a)'s product invocations is a ledger record
// (S-9's before-any-product clause; helpers/staged-mdx.ts) — the same
// template calls, moved to module level. The source without the extra
// section is ONE record (identical bytes), staged as an initial file at
// (a)'s and (d)'s `sub/specs/A.mdx` ((a)'s workspace, the body's first,
// converted uniformly), the submodule arm's `inner/specs/A.mdx`, and (c)'s
// `specs/A.mdx`, and by `file()` as the nested-repository staging's inner
// v1; the source with the extra section is that staging's initial
// `inner/specs/A.mdx`, the outer v1. T6.3-6's (b) and (e), and T14-10's (j)
// (section-14-ii.ts), make the same nested-repository staging
// (`stageNestedRepositories`) after earlier invocations, so its records
// name the three tests. Arm (a)'s own edit precedes the body's first
// invocation and stays a plain staging (S-7's sweep reaches it against the
// stub).
const T6_3_5_WITHOUT_EXTRA = stagedMdx(
  "T6.3-5/T6.3-6/T14-10 specs/A.mdx without the extra section: T6.3-5 (a) and (d) under sub/, (b) under inner/ (the nested repository's v1, the submodule's initial file), (c) at the root; T6.3-6 (b) and (e) and T14-10 (j) the nested repository's inner v1",
  r5Source(R5_TEXT_V0, false),
);
const T6_3_5_WITH_EXTRA = stagedMdx(
  "T6.3-5/T6.3-6/T14-10 nested-repository staging (T6.3-5 (b), T6.3-6 (b) and (e), T14-10 (j)): inner/specs/A.mdx with the extra section, the outer repository's v1",
  r5Source(R5_TEXT_V0, true),
);
const T6_3_5_INNER_EDITED = stagedMdx(
  "T6.3-5/T6.3-6/T14-10 nested-repository and submodule stagings: the current edit of the inner workspace's source",
  r5Source(R5_TEXT_V1, false),
);

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

/**
 * The initial files of T6.3-5(b)'s nested-repository staging
 * (`stageNestedRepositories`): the inner workspace at `inner/`, its source
 * holding the extra section the outer repository's `v1` commits. Exported,
 * with the staging, for T14-10(j)'s discovery arm (section-14-ii.ts).
 */
export const NESTED_REPOSITORY_FILES: Readonly<
  Record<string, InitialFileContents>
> = {
  [R5_INNER_CONFIG]: SPECS_ONLY_CONFIG,
  [R5_INNER_A]: T6_3_5_WITH_EXTRA,
};

/** The two `v1` commits of a nested-repository staging. */
interface NestedRepositories {
  readonly innerV1: string;
  readonly outerV1: string;
}

/**
 * T6.3-5(b)'s nested-repository staging — the nested repository, not the
 * submodule — on a workspace created with `NESTED_REPOSITORY_FILES` (T6.3-6
 * stages it too: (b)'s refused discovery and (e)'s git data; and T14-10(j),
 * section-14-ii.ts, its refused discovery, as (e) stages it): the outer
 * repository at the root commits the inner workspace's files, with the
 * extra section, and tags `v1` before the inner repository exists; the
 * inner repository at `inner/` then commits the workspace without the extra
 * section and tags its own `v1`; the current edit of the inner source
 * follows. The staging premises — two distinct `v1` commits, the extra
 * section in the outer `v1`'s tree alone — fail diagnosed when unmet (H-8).
 * Returns both commits.
 */
export async function stageNestedRepositories(
  workspace: TestWorkspace,
  context: string,
): Promise<NestedRepositories> {
  // The outer repository commits the inner workspace's files — with the
  // extra section — and tags v1, before the inner repository exists.
  await workspace.gitInit();
  const outerV1 = await workspace.gitCommitAll(
    "outer v1: the inner workspace's files, with the extra section",
  );
  await workspace.git(["tag", R5_TAG]);
  // The inner repository's v1: the workspace without the extra section.
  await workspace.file(R5_INNER_A, T6_3_5_WITHOUT_EXTRA);
  const innerV1 = await initInnerRepositoryAtV1(workspace, R5_INNER);
  assertDistinctTags(outerV1, innerV1, context);
  const outerTree = (await workspace.git(["show", `${R5_TAG}:${R5_INNER_A}`]))
    .stdout;
  const innerTree = (
    await workspace.git(["-C", R5_INNER, "show", `${R5_TAG}:${R5_A}`])
  ).stdout;
  if (!outerTree.includes('id="extra"') || innerTree.includes('id="extra"')) {
    fail(
      `${context} staging premise: the outer ${R5_TAG} must hold ` +
        `${R5_INNER_A} with the extra section and the inner ${R5_TAG} ` +
        `${R5_A} without it; got outer ${JSON.stringify(outerTree)}, ` +
        `inner ${JSON.stringify(innerTree)}`,
    );
  }
  // The current edit.
  await workspace.file(R5_INNER_A, T6_3_5_INNER_EDITED);
  return { innerV1, outerV1 };
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
  run: async (product) => {
    // --- (a) A workspace rooted in a repository subdirectory ---
    await withWorkspace(
      {
        [R5_SUB_CONFIG]: SPECS_ONLY_CONFIG,
        [R5_SUB_A]: T6_3_5_WITHOUT_EXTRA,
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
    await withWorkspace(NESTED_REPOSITORY_FILES, async (workspace) => {
      const context = "T6.3-5 (b) nested-repository arm";
      const { innerV1, outerV1 } = await stageNestedRepositories(
        workspace,
        context,
      );
      await runNestedRepositoryArm(
        product,
        workspace,
        innerV1,
        outerV1,
        context,
      );
    });

    // --- (b) Nested repositories: a submodule ---
    await withWorkspace(
      {
        [R5_INNER_CONFIG]: SPECS_ONLY_CONFIG,
        [R5_INNER_A]: T6_3_5_WITHOUT_EXTRA,
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
        await workspace.file(R5_INNER_A, T6_3_5_INNER_EDITED);
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
        [R5_A]: T6_3_5_WITHOUT_EXTRA,
      },
      async (workspace) => {
        const context = "T6.3-5 (c) no-repository arm";
        // H-1's ancestor precondition (module header), before the arm's
        // first invocation.
        await assertSelfContainedRoot(product, workspace.root, context);
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
      { [R5_SUB_A]: T6_3_5_WITHOUT_EXTRA },
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

// ---------------------------------------------------------------------------
// T6.3-6 — a given baseline's journal read, and git data
// ---------------------------------------------------------------------------

// SPEC 6.3: a given baseline's resolution — `impact --base` (9), `review
// create --base` (10.7) — precedes the gate of 13.3 (12.0) and reads the
// current journal before any other cause can fail it; a journal error
// (14.13) there, whatever its form, fails it as a usage error carrying
// condition 13's stable code and concerned path (12.7), never as the gate's
// finding; and every other read a given or recorded baseline's resolution
// makes is of git data — the repository's discovery and its stored data —
// whose refusal leaves the baseline unreadable: a plain usage error, never
// a read failure (14.25). Each staging below is a fresh workspace (H-1),
// every run exiting 2 and modifying nothing. Arms (a)–(d) run at both
// baseline-taking commands on a journal the product wrote — `build`
// passing, then the journaled `rename specs/A.mdx a a2` — each staging's
// journal error:
// (a) the garbage line appended, on valid sources, `--base c1` — the error
//     document's finding form-exact, and each command's human form;
// (b) the garbage line beside another cause that can fail the resolution,
//     one staging each: an unresolvable ref (`--base nope`), a
//     configuration inside no repository's working tree (T6.3-5(c)'s
//     staging, `--base HEAD`), and a refused discovery of the repository
//     ((e)'s nested-repository staging, the garbage line appended to the
//     inner workspace's journal, `--base v1` from `R` with `--config
//     inner/xspec.config.ts`) — still the journal error, never the
//     code-less error: the journal is read first;
// (c) the journal path holding anything but a plain file, or content the
//     environment refuses (13.4, 14.25), `--base c1`: a directory; a
//     symbolic link to a plain file holding the journal the product wrote;
//     a FIFO, never opened; and the journal, its read permission removed
//     (T14-10's discipline) — never `read-failure`, never code-less;
// (d) the garbage line on sources that also fail `build`'s validations,
//     `--base c1` — the journal error, never the gate's exit 1 (12.0: a
//     given baseline is never so masked).
// (e) Git data refused, the sources, configuration, and journal valid and
//     readable: the repository's object store staged mode 000 — `impact
//     --base c1`, `review create --base c1 --name n`, and `review status s`
//     of a baseline session created before the staging — and T6.3-5(b)'s
//     nested repository with the inner `.git` directory staged mode 000 —
//     `impact --base v1` and `review create --base v1 --name n` from `R`
//     with `--config inner/xspec.config.ts` — each the plain usage error,
//     `code` and `path` `null`: never `read-failure`, and never an answer
//     computed against the outer repository's `v1` (the inner repository,
//     whose working tree contains the configuration file, is still the
//     innermost).
// The FIFO, the unreadable journal, and the mode-000 git directories are
// the Linux leg's stagings (`J6_ENVIRONMENT_STAGED`); the rest run on
// every leg.

// Deliberately structureless bytes no conforming entry format accepts —
// T6.1-3's garbage line, shape-independent (H-4): never a duplicate or
// recombination of product-written entries, whose acceptance would be
// product-dependent.
const J6_GARBAGE_LINE = "?? harness-injected garbage: not a journal entry ??";

// The one source of every T6.3-6 workspace at the root: section `a`, the
// subject of the journaled rename that writes the journal the garbage line
// joins. Every workspace after the first is created after the body's
// earlier invocations, so its initial source is a staged-source record
// (module header); the first workspace's is the same record, converted
// uniformly. The nested-repository stagings take T6.3-5(b)'s records.
const J6_FILE = "specs/A.mdx";
const J6_SOURCE = stagedMdx(
  "T6.3-6 specs/A.mdx — every arm's valid source, section a the journaled rename's subject",
  ['<S id="a">', "Alpha text.", "</S>", ""].join("\n"),
);

// (d)'s current source, staged after `c1`: the renamed section with an
// unresolved local `d` reference (14.5) — a build validation failure.
const J6_INVALID_SOURCE = stagedMdx(
  "T6.3-6 (d) specs/A.mdx — the renamed section a2 with an unresolved d reference (14.5), failing build validation",
  [
    '<S id="a2" d={["absent"]}>',
    "Alpha text depending on nothing that exists.",
    "</S>",
    "",
  ].join("\n"),
);

// (b)'s unresolvable ref, as TEST-SPEC T6.3-6 spells it: no branch, tag, or
// commit of the fixture repository bears the name.
const J6_UNRESOLVABLE_REF = "nope";

// The session name every refused `review create --base` run here asks for.
const J6_SESSION = "n";

// (e)'s baseline session, created before the staging refuses git data — the
// session `review status s` names (TEST-SPEC T6.3-6(e)).
const J6_BASELINE_SESSION = "s";

// The nested-repository stagings' runs, each from `R` naming the inner
// workspace's configuration (SPEC 7: the workspace root is the
// configuration file's directory, so the journal the garbage line joins is
// the inner workspace's). Exported for T14-10(j)'s discovery arm
// (section-14-ii.ts), whose runs name it alike.
export const J6_INNER_CONFIG_ARGS: readonly string[] = [
  "--config",
  R5_INNER_CONFIG,
];
const J6_INNER_JOURNAL = `${R5_INNER}/${JOURNAL_PATH}`;

// (c)'s symbolic link's target: the journal the product wrote, moved to the
// workspace root (T6.1-3's and T13.4-6's staging) — out of the graph-data
// area, whose layout is unenumerated (SPEC 13.3), so nothing staged inside
// it could be told apart from graph data — where no configured group's
// glob matches it (SPEC 7), the journal path's occupant staying the
// workspace's one defect.
const J6_LINK_TARGET = "journal-target";

// (b)'s and (e)'s git directories: read, write, and search all removed
// (helpers/permissions.ts, Directory modes), so their listing, every
// examination below them, and every read below them are refused, by
// whatever route a product takes.
const J6_UNSEARCHABLE_MODE = 0o000;

/**
 * Whether T6.3-6's environment stagings run: (c)'s FIFO and unreadable
 * journal, (b)'s refused discovery, and (e)'s refused git data — FIFOs and
 * permission removals, the Linux leg's (E-1), each permission staging
 * verified on the harness itself before any product sees it, an
 * ineffective one (a privileged runner) a harness error, never a pass or a
 * skip (H-9, H-11). On any other platform the other stagings alone run
 * (the NU3_STAGED pattern of section-11.5).
 */
const J6_ENVIRONMENT_STAGED = process.platform === "linux";

// The journal error a given baseline's resolution reports (SPEC 6.3, 12.7,
// 14, 14.13; T12.7-3): condition 13's stable code and its concerned path,
// the journal path — what the `--json` error document carries and the
// human form's standard-error message must carry too (T12.0-15). The path
// is workspace-relative, so the nested repository's inner journal is
// `.xspec/journal` too.
const J6_JOURNAL_ERROR: ErrorInformation = {
  code: "journal-error",
  path: JOURNAL_PATH,
};

/**
 * T6.3-6's journal staging on a fresh workspace, before the arm's ref is
 * fixed: `build` exit 0 — the sources valid (SPEC 12.1) — then the
 * journaled `rename specs/A.mdx a a2`, the operation that writes the
 * journal (SPEC 6.1); each run from the root, given `configArgs` (`--config
 * inner/xspec.config.ts` on the nested repository, whose inner journal the
 * rename then writes).
 */
async function buildAndRename(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
  configArgs: readonly string[] = [],
): Promise<void> {
  const shown = configArgs.length === 0 ? "" : ` ${configArgs.join(" ")}`;
  await expectExit(
    product,
    workspace,
    ["build", ...configArgs],
    0,
    `${context}: \`build${shown}\` (staging premise: the sources are valid)`,
  );
  await expectExit(
    product,
    workspace,
    ["rename", J6_FILE, "a", "a2", ...configArgs],
    0,
    `${context}: \`rename ${J6_FILE} a a2${shown}\` (the journaled ` +
      `operation writing the journal the garbage line joins)`,
  );
}

/**
 * Append the garbage line to the journal the product wrote (module header):
 * the journal read as a plain file at `journalPath` (`readJournal`; the
 * root workspace's by default, the inner workspace's on the nested
 * repository) holding the one line its rename appended
 * (`assertJournalLines`), then the garbage appended as its own line — the
 * product's final line terminated first if it left the terminator off, so
 * the tampering is a whole-line append under either line convention
 * (T6.1-3's staging).
 */
async function appendGarbageLine(
  workspace: TestWorkspace,
  context: string,
  journalPath: string = JOURNAL_PATH,
): Promise<void> {
  const journal = await readJournal(
    workspace,
    `${context}: before appending the garbage line`,
    journalPath,
  );
  assertJournalLines(
    journal,
    1,
    "the one journaled operation yields a one-line journal, the " +
      "product-written entry the garbage line follows",
    context,
  );
  const needsTerminator = journal[journal.length - 1] !== LF;
  await workspace.file(
    journalPath,
    Buffer.concat([
      journal,
      Buffer.from(
        (needsTerminator ? "\n" : "") + J6_GARBAGE_LINE + "\n",
        "utf8",
      ),
    ]),
  );
}

/**
 * The repository of (a), (c), (d), and (e)'s object-store arm: the
 * workspace's git repository initialized, the journal staged
 * (`buildAndRename`), and `c1` — the all-inclusive commit, its tree holding
 * the one-entry journal the rename wrote (`assertJournalInTree`), so the
 * garbage line appended after it is the one entry absent from the ref's
 * journal, and a product reading (c)'s linked journal resolves `c1`
 * normally — returned.
 */
async function stageRepositoryAtC1(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
): Promise<string> {
  await workspace.gitInit();
  await buildAndRename(product, workspace, context);
  const c1 = await workspace.gitCommitAll(
    "c1: the valid sources and the one-entry journal the rename wrote",
  );
  await assertJournalInTree(workspace, c1, `${context}: c1`);
  return c1;
}

/**
 * (a)'s staging — the journal error on valid sources at `c1`: the
 * repository at `c1` (`stageRepositoryAtC1`), then the garbage line
 * appended to the one-entry journal (`appendGarbageLine`), so the current
 * journal holds the entry the ref's journal holds and the garbage line
 * after it; `c1` returned. The workspace holds valid sources under one spec
 * group, `specs/A.mdx` holding section `a`, the journaled rename's subject.
 * Exported for T12.7-3's journal-error arm (section-12.7.ts) and T14-4's
 * and T14-6's baseline arms (section-14.ts), which stage their error
 * documents' journal error exactly as (a) does.
 */
export async function stageJournalErrorAtC1(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
): Promise<string> {
  const c1 = await stageRepositoryAtC1(product, workspace, context);
  await appendGarbageLine(workspace, context);
  return c1;
}

/**
 * What a T6.3-6 staging holds around each command's run beyond the
 * workspace's own state: a staging made just before the run and restored
 * once it ends (`runUnderStaging`) — so the run's whole-root compare, whose
 * snapshots are taken outside it, reads what the staging refuses (the
 * unreadable journal, a mode-000 git directory) — and a check of the
 * staged occupant once the run has ended (a FIFO still a FIFO in place:
 * never opened, TEST-SPEC S-3). Neither: the workspace's state alone.
 */
interface J6RunStaging {
  /** Made just before each run; restored once it ends. */
  readonly stage?: () => Promise<PermissionStaging>;
  /** Asserted once each run has ended, `label` naming the run. */
  readonly check?: (label: string) => Promise<void>;
}

/**
 * Run `argv` from the workspace root under `staging`'s staging, made just
 * before the run and restored in a `finally` once it ends — before
 * anything is asserted on its result, so no assertion meets the staging.
 */
async function runUnderStaging(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  staging: J6RunStaging,
): Promise<RunResult> {
  let made: PermissionStaging | undefined;
  try {
    made = await staging.stage?.();
    return await runCli(product, workspace, argv);
  } finally {
    if (made !== undefined) await made.restore();
  }
}

/**
 * T6.3-6's journal error at one baseline-taking command (`argv`, run with
 * `--json` from the workspace root under `staging`), under a whole-root
 * compare taken outside the staging — H-6's lock-path exclusion applied: no
 * session written; sources, journal, derived files, and graph data
 * byte-identical (SPEC 6.3, 10.7, 12.0): exit 2 exactly (a usage error,
 * SPEC 6.3, 12.0; `why` says what the exit code rules out), the single
 * 12.7 error document as the entire stdout — no report, no validation
 * findings (12.0, H-5) — and its finding the journal error, form-exact:
 * `code` `"journal-error"`, `path` `".xspec/journal"`, and `locations` `[]`
 * (12.7, 14, 14.13; T12.7-3) — a journal condition has no in-source
 * location, so the error names the offending line, never locating it —
 * never the code-less baseline error nor `read-failure`; then the
 * staging's check. `message` and `identities` are informational (module
 * header).
 */
async function expectJournalErrorAt(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  why: string,
  context: string,
  staging: J6RunStaging = {},
): Promise<void> {
  const label = `${context}: \`${[...argv, "--json"].join(" ")}\``;
  await assertLeavesUnchanged(
    workspace.root,
    async () => {
      const result = await runUnderStaging(
        product,
        workspace,
        [...argv, "--json"],
        staging,
      );
      assertExitCode(
        result,
        2,
        `${label} — the given baseline's resolution reads the current ` +
          `journal before any other cause can fail it, and a journal error ` +
          `there fails it as a usage error (SPEC 6.3, 12.0): ${why}`,
      );
      const error = expectErrorDocument(
        result,
        `${label} — under --json, the exit-2 error document is the entire ` +
          `stdout: no report and no validation findings (SPEC 12.0, 12.7, ` +
          `H-5)`,
      );
      assertSameJson(
        { code: error.code, path: error.path, locations: error.locations },
        {
          code: J6_JOURNAL_ERROR.code,
          path: J6_JOURNAL_ERROR.path,
          locations: [],
        },
        `${label}: the error reported is the journal error with its stable ` +
          `code and concerned path, never the code-less baseline error nor ` +
          `\`read-failure\` — \`code\` "journal-error", \`path\` ` +
          `".xspec/journal", and empty \`locations\`, a journal condition ` +
          `having no in-source location (SPEC 6.3, 12.7, 14, 14.13, 14.25; ` +
          `T12.7-3) (message: ${JSON.stringify(error.message)})`,
      );
      await staging.check?.(label);
    },
    `${label}: a given baseline's resolution failing modifies nothing — no ` +
      `session written; sources, journal, derived files, and graph data ` +
      `byte-identical (SPEC 6.3, 10.7, 12.0)`,
  );
}

/**
 * The human form of T6.3-6's journal error at one baseline-taking command
 * (T6.3-6(a); TEST-SPEC T12.0-15, H-5): `argv` without `--json`, run after
 * its `--json` twin on the same state — the twin modified nothing — under
 * `staging` and its own whole-root compare: exit 2 exactly, standard output
 * empty (SPEC 12.0: with JSON output not in effect, an exit-2 error leaves
 * standard output empty), and the standard-error message, the error's only
 * report, decoded by the exit-2 adapter (`decodeHumanErrorMessage`,
 * helpers/adapters/human-reports.ts) and carrying the code `journal-error`
 * and the concerned path `.xspec/journal` its twin's error document carries
 * (`assertHumanErrorMessageCarries`) — wording free (H-3), a message
 * omitting either failing; then the staging's check.
 */
async function expectHumanJournalErrorAt(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  context: string,
  staging: J6RunStaging = {},
): Promise<void> {
  const label = `${context}: \`${argv.join(" ")}\` (human form)`;
  await assertLeavesUnchanged(
    workspace.root,
    async () => {
      const result = await runUnderStaging(product, workspace, argv, staging);
      assertExitCode(
        result,
        2,
        `${label} — the output form never changes an exit code: exit 2, as ` +
          `its --json twin (SPEC 12.0, 6.3)`,
      );
      assertStdoutEmpty(
        result,
        `${label} — without JSON output in effect, an exit-2 error leaves ` +
          `standard output empty (SPEC 12.0, H-5)`,
      );
      assertHumanErrorMessageCarries(
        result,
        J6_JOURNAL_ERROR,
        `${label} — the standard-error message, the exit-2 error's only ` +
          `report, carries condition 13's stable code and concerned path ` +
          `(SPEC 12.0, 14, 14.13; TEST-SPEC T12.0-15, H-5)`,
      );
      await staging.check?.(label);
    },
    `${label}: modifies nothing — no session written; sources, journal, ` +
      `derived files, and graph data byte-identical (SPEC 6.3, 10.7, 12.0)`,
  );
}

/** How `expectJournalErrorAtBothCommands` runs a staging's commands. */
interface J6CommandOptions {
  /** Each command's human form after its `--json` run too ((a)). */
  readonly human?: boolean;
  /** Appended to each command: `--config inner/xspec.config.ts` from `R`. */
  readonly configArgs?: readonly string[];
  /** Made around each run and checked after it. */
  readonly staging?: J6RunStaging;
}

/**
 * One T6.3-6 staging at both baseline-taking commands, from the workspace
 * root: `impact --base <ref>`, then `review create --base <ref> --name n`,
 * each given `options.configArgs`, each the journal error
 * (`expectJournalErrorAt`) under `options.staging` and — `options.human`
 * set, (a) — then its human form (`expectHumanJournalErrorAt`). `why` says
 * what besides the journal error stands in the workspace.
 */
async function expectJournalErrorAtBothCommands(
  product: ProductBinding,
  workspace: TestWorkspace,
  ref: string,
  why: string,
  context: string,
  options: J6CommandOptions = {},
): Promise<void> {
  const configArgs = options.configArgs ?? [];
  const staging = options.staging ?? {};
  const commands: readonly (readonly string[])[] = [
    ["impact", "--base", ref, ...configArgs],
    ["review", "create", "--base", ref, "--name", J6_SESSION, ...configArgs],
  ];
  for (const argv of commands) {
    await expectJournalErrorAt(product, workspace, argv, why, context, staging);
    if (options.human === true) {
      await expectHumanJournalErrorAt(
        product,
        workspace,
        argv,
        context,
        staging,
      );
    }
  }
}

/** One of (c)'s journal-path stagings (SPEC 13.4, 14.13, 14.25). */
interface J6JournalOccupant {
  /** The arm's context, after "T6.3-6 ". */
  readonly arm: string;
  /** What occupies the journal path, for the diagnoses. */
  readonly what: string;
  /** A Linux-leg staging (`J6_ENVIRONMENT_STAGED`). */
  readonly environment: boolean;
  /**
   * Stage the occupant on a workspace whose `.xspec/journal` is the plain
   * file the product wrote (`c1`'s too), returning what each run carries.
   */
  readonly occupy: (workspace: TestWorkspace) => Promise<J6RunStaging>;
}

// (c)'s four stagings, in TEST-SPEC's order: anything but a plain file at
// the journal path (SPEC 13.4: such a journal a journal error, 14.13), and
// content the environment refuses (14.25's row for the journal: condition
// 13). A product following the link reads `c1`'s own journal and resolves
// normally; one treating any occupant as an absent, empty journal meets a
// baseline journal that is no prefix of it — the code-less error; one
// reading the FIFO blocks (no writer), its run's own guard ending it
// (S-3); one meeting the refused read as condition 25 reports
// `read-failure`: each fails.
const J6_JOURNAL_OCCUPANTS: readonly J6JournalOccupant[] = [
  {
    arm: "(c) directory arm",
    what: "a directory occupies the journal path",
    environment: false,
    occupy: async (workspace) => {
      await fsp.rm(workspace.path(JOURNAL_PATH));
      await workspace.dir(JOURNAL_PATH);
      return {};
    },
  },
  {
    arm: "(c) symbolic-link arm",
    what:
      `a symbolic link occupies the journal path, to a plain file at ` +
      `${J6_LINK_TARGET} holding the journal the product wrote — never ` +
      `read through it (SPEC 13.4)`,
    environment: false,
    occupy: async (workspace) => {
      await fsp.rename(
        workspace.path(JOURNAL_PATH),
        workspace.path(J6_LINK_TARGET),
      );
      await workspace.symlink(JOURNAL_PATH, `../${J6_LINK_TARGET}`);
      return {};
    },
  },
  {
    arm: "(c) FIFO arm",
    what:
      "a FIFO occupies the journal path — never opened (TEST-SPEC " +
      "T13.4-13, S-3)",
    environment: true,
    occupy: async (workspace) => {
      await fsp.rm(workspace.path(JOURNAL_PATH));
      const staged = await stageFifo(workspace, JOURNAL_PATH);
      return {
        check: async (label) =>
          await assertFifosIntact(
            staged,
            `${label}: the FIFO at ${JOURNAL_PATH} still a FIFO in place — ` +
              `termination and the FIFO in place are all "never opened" ` +
              `asserts (TEST-SPEC S-3, T13.4-13)`,
          ),
      };
    },
  },
  {
    arm: "(c) unreadable-journal arm",
    what:
      "the journal the product wrote has its read permission removed " +
      "(`-w-------`, T14-10's discipline), content the environment " +
      "refuses to deliver (SPEC 14.25)",
    environment: true,
    occupy: async (workspace) => ({
      stage: async () =>
        await stageReadRefusalOfFile(workspace.path(JOURNAL_PATH)),
    }),
  },
];

/**
 * The loose object file of `commit` below the object store,
 * `<first two hex digits>/<the rest>` — git's loose-object layout, which
 * `git commit` writes — the file (e)'s staging reads on the harness itself
 * (E-1); `stageDirectoryMode` requires a plain file there before the mode
 * changes, so a packed object is a staging error, never a verdict.
 */
function looseObjectPath(commit: string): string {
  return `${commit.slice(0, 2)}/${commit.slice(2)}`;
}

/**
 * A git directory refused (TEST-SPEC T6.3-6(b), (e)): `rel` — `.git/objects`,
 * or the inner repository's `.git` — staged unreadable and unsearchable,
 * mode 000, through `stageDirectoryMode` (helpers/permissions.ts,
 * Directory modes), verified on the harness itself before it returns (E-1,
 * T14-10's way): its own listing of the directory and its own read of the
 * file `probe` below it refused. Its restore reinstates the mode where the
 * directory still stands.
 */
async function stageGitDirectoryUnsearchable(
  workspace: TestWorkspace,
  rel: string,
  probe: string,
): Promise<PermissionStaging> {
  return await stageDirectoryMode(workspace.path(rel), J6_UNSEARCHABLE_MODE, [
    { attempt: "list", refused: true },
    { attempt: "read", name: probe, refused: true },
  ]);
}

/**
 * T6.3-6(e)'s object-store staging, exported for the baseline arms of T14-9
 * and T14-10(j), which stage the same refusal: the repository's object
 * store `.git/objects` mode 000 (`stageGitDirectoryUnsearchable`), its
 * probes the listing and the read of `commit`'s loose object file
 * (`looseObjectPath`) — a commit the repository holds, written loose by
 * `git commit`.
 */
export async function stageObjectStoreUnsearchable(
  workspace: TestWorkspace,
  commit: string,
): Promise<PermissionStaging> {
  return await stageGitDirectoryUnsearchable(
    workspace,
    ".git/objects",
    looseObjectPath(commit),
  );
}

/**
 * The nested repository's refused discovery (TEST-SPEC T6.3-6(b), (e)): the
 * inner repository's `.git` mode 000 (`stageGitDirectoryUnsearchable`, its
 * probes the listing and the read of `HEAD`). Exported for T14-10(j)'s
 * discovery arm (section-14-ii.ts), which stages the same refusal.
 */
export async function stageInnerGitUnsearchable(
  workspace: TestWorkspace,
): Promise<PermissionStaging> {
  return await stageGitDirectoryUnsearchable(
    workspace,
    `${R5_INNER}/.git`,
    "HEAD",
  );
}

/**
 * (b)'s refused discovery and (e)'s nested-repository arm: the inner
 * `.git` mode 000 (`stageInnerGitUnsearchable`), carried by each run — made
 * just before it and restored once it ends (`runUnderStaging`).
 */
function innerGitUnsearchable(workspace: TestWorkspace): J6RunStaging {
  return { stage: async () => await stageInnerGitUnsearchable(workspace) };
}

/**
 * (e)'s refused git data at one baseline-resolving command (`argv`, run
 * with `--json` from the workspace root under `staging`), under a
 * whole-root compare taken outside the staging, H-6's lock-path exclusion
 * applied: exit 2 exactly — the baseline unreadable, a usage error (SPEC
 * 6.3, 10.7, 12.0) — the 12.7 error document as the entire stdout, and its
 * finding the plain usage error, `code` and `path` `null` (12.7; T12.7-3):
 * never `read-failure` (14.25: git data is no file this specification
 * models, 6.3) nor any numbered condition's code; nothing modified — no
 * session written; sources, journal, derived files, graph data, and
 * `.git/` byte-identical. `why` says what the staging refuses.
 */
async function expectGitDataRefusedAt(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  staging: J6RunStaging,
  why: string,
  context: string,
): Promise<void> {
  const label = `${context}: \`${[...argv, "--json"].join(" ")}\``;
  await assertLeavesUnchanged(
    workspace.root,
    async () => {
      const result = await runUnderStaging(
        product,
        workspace,
        [...argv, "--json"],
        staging,
      );
      assertExitCode(
        result,
        2,
        `${label} — ${why}: the baseline is unreadable, a usage error ` +
          `(SPEC 6.3, 10.7, 12.0), never an answer`,
      );
      const error = expectErrorDocument(
        result,
        `${label} — under --json, the exit-2 error document is the entire ` +
          `stdout (SPEC 12.0, 12.7, H-5)`,
      );
      assertSameJson(
        { code: error.code, path: error.path },
        { code: null, path: null },
        `${label}: refused git data leaves the baseline unreadable, a plain ` +
          `usage error — the error document's \`code\` and \`path\` ` +
          `\`null\` (SPEC 6.3, 12.7; T12.7-3), never \`read-failure\` (14.25) ` +
          `nor another condition's code (message: ` +
          `${JSON.stringify(error.message)})`,
      );
    },
    `${label}: modifies nothing — no session written; sources, journal, ` +
      `derived files, graph data, and .git/ byte-identical (SPEC 6.3, 10.7, ` +
      `12.0)`,
  );
}

const T6_3_6 = defineProductTest({
  id: "T6.3-6",
  title:
    "a given baseline's journal read, and git data: `impact --base` and `review create --base … --name n` read the current journal before any other cause can fail the resolution, a journal error there failing it as a usage error that carries condition 13's code and path — a garbage line appended to a journal the product wrote, on valid sources, makes each exit 2 with the error document's `code` `journal-error`, `path` `.xspec/journal`, and `locations` [] (without `--json`: standard output empty, the standard-error message carrying the code and the path); the same journal error beside an unresolvable ref (`--base nope`), beside a configuration inside no repository's working tree (`--base HEAD`), and beside a refused discovery of the repository (a nested repository's inner `.git` mode 000, `--base v1` from the outer root with `--config inner/xspec.config.ts`) is still `journal-error`, never the code-less error; the journal path holding a directory, a symbolic link to the journal the product wrote, or a FIFO (never opened), or the journal unreadable, is `journal-error` too, never `read-failure`; and beside sources failing `build`'s validations each exits 2 with `journal-error`, never the gate's exit 1; while git data refused — the object store mode 000 (`impact --base c1`, `review create --base c1 --name n`, and `review status s` of a baseline session) or a nested repository's inner `.git` mode 000 (`--base v1` from the outer root) — is the plain usage error, exit 2, `code` and `path` null, never `read-failure` and never an answer from the outer repository's `v1` — every run modifying nothing, no session written (SPEC 6.3, 10.7, 12.0, 12.7, 13.4, 14.13, 14.25)",
  run: async (product) => {
    // --- (a) The journal error on valid sources ---
    await withWorkspace(
      { "xspec.config.ts": SPECS_ONLY_CONFIG, [J6_FILE]: J6_SOURCE },
      async (workspace) => {
        const context = "T6.3-6 (a) journal-error arm";
        const c1 = await stageJournalErrorAtC1(product, workspace, context);
        await expectJournalErrorAtBothCommands(
          product,
          workspace,
          c1,
          "the sources and the ref are valid, so the journal error is the " +
            "one cause failing the resolution",
          context,
          { human: true },
        );
      },
    );

    // --- (b) The journal error beside an unresolvable ref ---
    await withWorkspace(
      { "xspec.config.ts": SPECS_ONLY_CONFIG, [J6_FILE]: J6_SOURCE },
      async (workspace) => {
        const context = "T6.3-6 (b) unresolvable-ref arm";
        await workspace.gitInit();
        await buildAndRename(product, workspace, context);
        await workspace.gitCommitAll("a commit, so the repository is real");
        await appendGarbageLine(workspace, context);
        await expectJournalErrorAtBothCommands(
          product,
          workspace,
          J6_UNRESOLVABLE_REF,
          `the ref ${J6_UNRESOLVABLE_REF} resolves to no commit, and the ` +
            `journal is read first — a product resolving the ref before ` +
            `reading the journal reports the code-less error instead`,
          context,
        );
      },
    );

    // --- (b) The journal error beside a configuration inside no
    // repository's working tree (T6.3-5(c)'s staging) ---
    await withWorkspace(
      { "xspec.config.ts": SPECS_ONLY_CONFIG, [J6_FILE]: J6_SOURCE },
      async (workspace) => {
        const context = "T6.3-6 (b) no-repository arm";
        // H-1's ancestor precondition (module header), before the arm's
        // first invocation.
        await assertSelfContainedRoot(product, workspace.root, context);
        await buildAndRename(product, workspace, context);
        await appendGarbageLine(workspace, context);
        await expectJournalErrorAtBothCommands(
          product,
          workspace,
          "HEAD",
          "the configuration file lies inside no repository's working " +
            "tree, and the journal is read first — a product discovering " +
            "the repository before reading the journal reports the " +
            "code-less error instead",
          context,
        );
      },
    );

    // --- (b) The journal error beside a refused discovery of the
    // repository ((e)'s nested-repository staging; the Linux leg's) ---
    if (J6_ENVIRONMENT_STAGED) {
      await withWorkspace(NESTED_REPOSITORY_FILES, async (workspace) => {
        const context = "T6.3-6 (b) refused-discovery arm";
        await stageNestedRepositories(workspace, context);
        await buildAndRename(product, workspace, context, J6_INNER_CONFIG_ARGS);
        await appendGarbageLine(workspace, context, J6_INNER_JOURNAL);
        await expectJournalErrorAtBothCommands(
          product,
          workspace,
          R5_TAG,
          `the inner repository's .git directory is unreadable and ` +
            `unsearchable (mode 000), so the repository's discovery is ` +
            `refused (git data, SPEC 6.3), and the journal is read first — ` +
            `a product discovering the repository before reading the ` +
            `journal reports the code-less error instead, or, walking on ` +
            `upward, resolves ${R5_TAG} in the outer repository`,
          context,
          {
            configArgs: J6_INNER_CONFIG_ARGS,
            staging: innerGitUnsearchable(workspace),
          },
        );
      });
    }

    // --- (c) The journal path holding anything but a plain file, or
    // content the environment refuses ---
    for (const occupant of J6_JOURNAL_OCCUPANTS) {
      if (occupant.environment && !J6_ENVIRONMENT_STAGED) continue;
      await withWorkspace(
        { "xspec.config.ts": SPECS_ONLY_CONFIG, [J6_FILE]: J6_SOURCE },
        async (workspace) => {
          const context = `T6.3-6 ${occupant.arm}`;
          const c1 = await stageRepositoryAtC1(product, workspace, context);
          const staging = await occupant.occupy(workspace);
          await expectJournalErrorAtBothCommands(
            product,
            workspace,
            c1,
            `${occupant.what}: a journal error (SPEC 13.4, 14.13, 14.25), ` +
              `whatever its form — never \`read-failure\`, never the ` +
              `code-less error`,
            context,
            { staging },
          );
        },
      );
    }

    // --- (d) The journal error beside sources failing `build`'s
    // validations ---
    await withWorkspace(
      { "xspec.config.ts": SPECS_ONLY_CONFIG, [J6_FILE]: J6_SOURCE },
      async (workspace) => {
        const context = "T6.3-6 (d) invalid-sources arm";
        const c1 = await stageRepositoryAtC1(product, workspace, context);
        await workspace.file(J6_FILE, J6_INVALID_SOURCE);
        // Staging premise: the current sources really fail build validation
        // — a product masking the given baseline behind the gate exits 1
        // with these findings instead.
        const findings = await buildFindings(
          product,
          workspace,
          `${context}: \`build --json\` premise — the current sources fail ` +
            `build validation (an unresolved d reference, SPEC 14.5)`,
        );
        if (findings.length === 0) {
          fail(
            `${context}: staging premise — the failing \`build\` must ` +
              `report at least one validation finding (SPEC 14)`,
          );
        }
        await appendGarbageLine(workspace, context);
        await expectJournalErrorAtBothCommands(
          product,
          workspace,
          c1,
          "the current sources also fail `build`'s validations, yet a given " +
            "baseline is never masked by the gate — never exit 1 with its " +
            "findings (SPEC 12.0, 13.3)",
          context,
        );
      },
    );

    // --- (e) Git data refused (the Linux leg's) ---
    if (J6_ENVIRONMENT_STAGED) {
      // The repository's object store, unreadable and unsearchable.
      await withWorkspace(
        { "xspec.config.ts": SPECS_ONLY_CONFIG, [J6_FILE]: J6_SOURCE },
        async (workspace) => {
          const context = "T6.3-6 (e) object-store arm";
          const c1 = await stageRepositoryAtC1(product, workspace, context);
          await expectExit(
            product,
            workspace,
            ["review", "create", "--base", c1, "--name", J6_BASELINE_SESSION],
            0,
            `${context}: \`review create --base c1 --name ` +
              `${J6_BASELINE_SESSION}\` — the baseline session created ` +
              `before the staging (premise: c1 resolves on the unstaged ` +
              `repository, SPEC 6.3, 10.7)`,
          );
          const staging: J6RunStaging = {
            stage: async () =>
              await stageObjectStoreUnsearchable(workspace, c1),
          };
          const commands: readonly (readonly string[])[] = [
            ["impact", "--base", c1],
            ["review", "create", "--base", c1, "--name", J6_SESSION],
            ["review", "status", J6_BASELINE_SESSION],
          ];
          for (const argv of commands) {
            await expectGitDataRefusedAt(
              product,
              workspace,
              argv,
              staging,
              "the repository's object store is unreadable and unsearchable " +
                "(mode 000), the sources, configuration, and journal valid " +
                "and readable — a given baseline, or the recorded one the " +
                "baseline session names (SPEC 10.7), unreadable",
              context,
            );
          }
        },
      );

      // The repository's discovery: T6.3-5(b)'s nested repository, its
      // inner `.git` directory unreadable and unsearchable.
      await withWorkspace(NESTED_REPOSITORY_FILES, async (workspace) => {
        const context = "T6.3-6 (e) nested-repository arm";
        await stageNestedRepositories(workspace, context);
        await expectExit(
          product,
          workspace,
          ["build", ...J6_INNER_CONFIG_ARGS],
          0,
          `${context}: \`build ${J6_INNER_CONFIG_ARGS.join(" ")}\` from R ` +
            `(staging premise: the inner workspace's sources are valid)`,
        );
        const staging = innerGitUnsearchable(workspace);
        const commands: readonly (readonly string[])[] = [
          ["impact", "--base", R5_TAG, ...J6_INNER_CONFIG_ARGS],
          [
            "review",
            "create",
            "--base",
            R5_TAG,
            "--name",
            J6_SESSION,
            ...J6_INNER_CONFIG_ARGS,
          ],
        ];
        for (const argv of commands) {
          await expectGitDataRefusedAt(
            product,
            workspace,
            argv,
            staging,
            `the inner repository's .git directory is unreadable and ` +
              `unsearchable (mode 000), so its discovery is refused (git ` +
              `data, SPEC 6.3) — the inner repository, whose working tree ` +
              `contains the configuration file, still the innermost, never ` +
              `skipped for the outer repository's ${R5_TAG}`,
            context,
          );
        }
      });
    }
  },
});

/** TEST-SPEC §6.3, in canonical ID order (SUITE-23). */
export const section63Tests: readonly ProductTestEntry[] = [
  T6_3_1,
  T6_3_2,
  T6_3_3,
  T6_3_4,
  T6_3_5,
  T6_3_6,
];
