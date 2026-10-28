// TEST-SPEC §12.0 III (global command conventions, third part) — SUITE-42
// continued: T12.0-14 (invocation grammar) and T12.0-16 (byte order, never
// UTF-16 order; its fixture, operationalizations, and arms (a)–(f) in the
// section after T12.0-14's).
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), and rejects a product only via diagnosed
// assertion failures (H-8).
//
// SPEC 12.0's invocation grammar: arguments are tokens; a token beginning
// with `--` is a flag token spelled exactly `--` plus the flag's name, and no
// other token is (no single-dash short forms); a value-taking flag takes the
// whole next token whatever it looks like and lacks its value when none
// follows; `--name=value` spells no flag; `--` ends flag reading and is
// dropped; flag tokens stand anywhere, between the command word and its
// subcommand too; the remaining tokens must match the synopsis exactly (no
// command word, an unknown command or subcommand, a missing operand, a
// surplus operand — never accepted and ignored); a flag may be given at
// most once; a flag's arity is fixed by its name across commands and known
// before the command word; list-valued flags take one comma-separated
// value (11.1).
//
// Conservative operationalizations (noted per H-3/H-4):
// - "Behaves as `ids`" and "byte-identical documents" are H-4's
//   product-to-itself compare: the same exit code and byte-identical stdout
//   for the two spellings on one fixture. "Answers byte-identically" for a
//   flag between the command word and its subcommand (`review --json list`
//   against `review list --json`, `query --json nodes` against `query nodes
//   --json`) is the same compare, each spelling exit 0 and the reference a
//   JSON document: `query nodes` runs on the built fixture, and the
//   `review` pair once the session `-a` exists with an item resolved, so
//   the listing compared carries a session and its counts (10.7). A parser
//   reading the token after the command word as the subcommand meets
//   `--json` there — an unknown subcommand, exit 2.
// - "Matching nothing, an empty listing, exit 0 — and JSON out of effect,
//   stdout not a JSON document" (`ids --file --json`) is asserted as: exit
//   0; stdout that does not parse as a JSON document (an empty human
//   listing included — the human form is unpinned, H-3); and an empty
//   listing, observed through its information (H-3), never its bytes: the
//   human listing names no `specs/A.mdx`, where the unrestricted human
//   listing names it (12.3: requirement IDs grouped by file), its wording
//   free — it may name the glob it was given. A glob matching nothing
//   (`no-such-dir/*.mdx`) yields the same omission, the premise that
//   `--file` restricts the listing (12.3), so the empty listing is
//   attributable to the glob `--json` being in effect. The two listings
//   are never byte-compared: different globs are different input (12.0's
//   determinism is for identical input; H-4).
// - "Missing configuration, stdout empty (JSON out of effect, the diagnostic
//   on stderr)" (`ids --config --json`): exit 2, empty stdout, non-empty
//   stderr — wording unpinned (H-3). Its pair, `ids --json --config`,
//   answers the plain usage error document on stdout: `--config` lacking its
//   value with `--json` read as a flag.
// - "Nothing done" / "no session created": the compare-around-command
//   protocol over the whole root, `.xspec/` included, on a workspace built
//   beforehand — so a lenient parser that ignored the surplus token would
//   have a rename to journal or a session to write, and is observed.
// - "`xspec --config cfg/xspec.config.ts build` loads that configuration":
//   staged in a workspace whose root holds no configuration (the premise:
//   `build` alone is a configuration error, 14.14), so exit 0 with derived
//   output written under `cfg/` alone is attributable to the leading
//   `--config` being read as the global flag with its value. The premise's
//   failed upward search presumes nothing above the root: H-1's ancestor
//   precondition is verified first (`assertSelfContainedRoot`,
//   helpers/self-contained-root.ts), an unmet one a harness error.
// - `review create --strategy audit --name -a`: the session file's presence
//   at `.xspec/reviews/-a.json` (10.1) plus the session answering `next`;
//   `resolve … --note -x` is observed through `review show … --json`'s
//   `note` member (10.2, 10.7).
// - The `--kinds` arms run on `query edges` (JSON-only, 11), so the plain
//   usage error's document is on stdout with no `--json` given; the collapse
//   pair (`depends,depends` against `depends`) is the byte-identical compare
//   T11-4 pins in full.

import { Buffer } from "node:buffer";
import type {
  AppliedMappingPair,
  DecodedDatum,
  Finding,
  FindingLocation,
  InventoryDocument,
  ItemKind,
  OccurrenceRecord,
  PathValue,
  PreviewDelta,
  PreviewFileEntry,
  SourceRange,
  ViewNode,
  ViewReport,
} from "../../helpers/adapters/index.js";
import {
  assertReportMentions,
  assertReportOmits,
  decodeCoverageReport,
  decodeExportReport,
  decodeIdsReport,
  decodeInventoryDocument,
  decodeItemReport,
  decodeNextReport,
  decodeOccurrencesReport,
  decodePerformedOperationReport,
  decodePreviewReport,
  decodeReachableReport,
  decodeSessionStatusReport,
  decodeViewReport,
  renderPathValue,
} from "../../helpers/adapters/index.js";
import {
  assertBytesEqual,
  assertStdoutEmpty,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { assertSelfContainedRoot } from "../../helpers/self-contained-root.js";
import {
  assertLeavesUnchanged,
  diffSnapshots,
  snapshotDirectory,
} from "../../helpers/snapshot.js";
import { stagedMdx } from "../../helpers/staged-mdx.js";
import type { StagedMdx } from "../../helpers/staged-mdx.js";
import { stagedTs } from "../../helpers/staged-ts.js";
import type { StagedTs } from "../../helpers/staged-ts.js";
import type { ProductBinding, RunResult } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type {
  InitialFileContents,
  WorkspaceDecl,
} from "../../helpers/workspace.js";
import { STREAMS_VALID_SOURCE } from "./section-12.0-i.js";
import { deleteGraphData } from "./section-13.3.js";
import { impactAgainst, SPECS_ONLY_CONFIG } from "./section-5.6.js";
import {
  assertSameJson,
  buildOk,
  expectConfigurationError,
  expectExit,
  expectPlainUsageError,
  readGeneratedModule,
  runCli,
  runFindingsReport,
  runJson,
} from "./support.js";

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

// ---------------------------------------------------------------------------
// T12.0-14 — invocation grammar
// ---------------------------------------------------------------------------

/**
 * The grammar fixture's one spec source: a root node holding `a` — the
 * minimal section a, the staged-source record section-12.0-i.ts registers
 * (the same bytes, spelled once; helpers/staged-mdx.ts).
 */
const GRAMMAR_SPEC_FILE = "specs/A.mdx";
const GRAMMAR_FILES: Readonly<Record<string, InitialFileContents>> = {
  "xspec.config.ts": SPECS_ONLY_CONFIG,
  [GRAMMAR_SPEC_FILE]: STREAMS_VALID_SOURCE,
};
/** A `--file` glob inside the root (7) that matches no discovered file. */
const GRAMMAR_NO_MATCH_GLOB = "no-such-dir/*.mdx";
/** The `--config` arm's configuration, whose directory is the root (7). */
const GRAMMAR_CONFIG_DIR = "cfg";
const GRAMMAR_CONFIG_PATH = `${GRAMMAR_CONFIG_DIR}/xspec.config.ts`;
/**
 * The `--config`-first arm's source, staged in T12.0-14's second workspace
 * (after the grammar workspace's invocations): a staged-source record
 * (helpers/staged-mdx.ts; S-9's before-any-product clause).
 */
const T12_0_14_CFG_B_SOURCE = stagedMdx(
  "T12.0-14 cfg/specs/B.mdx (the --config-first arm's source)",
  '<S id="b">\nBeta text.\n</S>\n',
);
/**
 * The `--config`-first arm's configuration, staged in the same second
 * workspace: a TypeScript staged-source record (helpers/staged-ts.ts; S-9's
 * TypeScript and timing clauses) wrapping section-5.6.ts's SPECS_ONLY_CONFIG,
 * the same expression moved here (the grammar workspace, the body's first,
 * stages the constant plain).
 */
const T12_0_14_CFG_CONFIG = stagedTs(
  "T12.0-14 cfg/xspec.config.ts — one spec group, the --config-first arm's configuration (section-5.6.ts's SPECS_ONLY_CONFIG)",
  SPECS_ONLY_CONFIG,
);
const GRAMMAR_CONFIG_FILES: Readonly<Record<string, InitialFileContents>> = {
  [GRAMMAR_CONFIG_PATH]: T12_0_14_CFG_CONFIG,
  [`${GRAMMAR_CONFIG_DIR}/specs/B.mdx`]: T12_0_14_CFG_B_SOURCE,
};
/** The session `--name -a` creates and the note `--note -x` stores. */
const GRAMMAR_SESSION_NAME = "-a";
const GRAMMAR_SESSION_REL = `.xspec/reviews/${GRAMMAR_SESSION_NAME}.json`;
const GRAMMAR_NOTE = "-x";

/**
 * One invocation expected to fail as a usage error with JSON output out of
 * effect: exit 2 exactly (H-5), standard output empty (SPEC 12.0: when JSON
 * output is not in effect, an exit-2 error leaves standard output empty),
 * and the diagnostic on standard error (wording unpinned, H-3). The empty
 * stdout is the discriminating half of each pair: a parser reading a
 * `--json` token as the flag where 12.0 reads it as a value or an operand
 * emits the 12.7 error document there instead.
 */
async function expectSilentUsageError(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  context: string,
): Promise<RunResult> {
  const result = await expectExit(product, workspace, argv, 2, context);
  assertStdoutEmpty(
    result,
    `${context}: with JSON output not in effect, an exit-2 error leaves ` +
      `standard output empty (SPEC 12.0)`,
  );
  if (result.stderrBytes.length === 0) {
    fail(
      `${context}: usage and configuration error messages are ` +
        `standard-error content (SPEC 12.0), but stderr is empty`,
    );
  }
  return result;
}

/**
 * Assert that a run's standard output is not a JSON document: JSON output
 * is out of effect (SPEC 12.0), so the listing is in its human form —
 * whatever that form is (H-3), an empty stdout included, it is never a
 * single JSON document.
 */
function assertNotJsonDocument(result: RunResult, context: string): void {
  let parsed = false;
  try {
    JSON.parse(result.stdout);
    parsed = true;
  } catch {
    // Not a JSON document — the expected outcome.
  }
  if (parsed) {
    fail(
      `${context}: JSON output is out of effect — the \`--json\` token was ` +
        `taken whole as the value of the flag before it, never read as the ` +
        `flag (SPEC 12.0) — so standard output must not be a JSON document; ` +
        `got one: ${JSON.stringify(result.stdout.slice(0, 200))}`,
    );
  }
}

/**
 * A flag between the command word and its subcommand (SPEC 12.0: flag
 * tokens stand anywhere; once the flags are removed, the remaining tokens
 * are the command, its subcommand, and its operands): `<command> --json
 * <subcommand>` answers byte-identically to `<command> <subcommand>
 * --json` — the reference exit 0 with one JSON document as its entire
 * standard output, the flag-first spelling exit 0 with the same bytes
 * (H-4's product-to-itself compare). A parser reading the token after the
 * command word as the subcommand meets `--json` there: an unknown
 * subcommand, exit 2.
 */
async function expectSubcommandAfterFlag(
  product: ProductBinding,
  workspace: TestWorkspace,
  [command, subcommand]: readonly [string, string],
  answer: string,
): Promise<void> {
  const referenceContext = `T12.0-14 reference \`${command} ${subcommand} --json\``;
  const reference = await expectExit(
    product,
    workspace,
    [command, subcommand, "--json"],
    0,
    `${referenceContext} — ${answer}, exit 0`,
  );
  parseJsonStdout(
    reference,
    `${referenceContext} — with \`--json\` read as a flag, the single JSON ` +
      `document is the entire standard output (SPEC 12.0)`,
  );
  const flagFirstContext = `T12.0-14 \`${command} --json ${subcommand}\``;
  const flagFirst = await expectExit(
    product,
    workspace,
    [command, "--json", subcommand],
    0,
    `${flagFirstContext} — a flag token may stand between the command ` +
      `word and its subcommand: once the flags are removed, the remaining ` +
      `tokens are \`${command} ${subcommand}\`, the subcommand read past ` +
      `the flag — exit 0, never \`--json\` taken for an unknown subcommand ` +
      `(SPEC 12.0)`,
  );
  assertBytesEqual(
    flagFirst.stdoutBytes,
    reference.stdoutBytes,
    `${flagFirstContext} against \`${command} ${subcommand} --json\`: the ` +
      `same command with JSON output in effect, so the two spellings answer ` +
      `byte-identically (SPEC 12.0; H-4's product-to-itself compare)`,
  );
}

const T12_0_14 = defineProductTest({
  id: "T12.0-14",
  title:
    "invocation grammar (12.0's token rules, each arm discriminating a lenient parser): the remaining tokens match the synopsis exactly — `ids extra` and `rename specs/A.mdx a b c` (a fourth operand) exit 2 with nothing done (whole root byte-unchanged, journal and sources included), `xspec` alone and `query bogus` exit 2; `--name=value` spells no flag (`review create --strategy audit --name=n` exits 2 as an unknown flag, no session created); flag tokens stand anywhere (`--json ids` and `ids --json` emit byte-identical documents; `--config cfg/xspec.config.ts build` loads that configuration, exit 0 with derived output under `cfg/` alone where `build` alone is a configuration error; between the command word and its subcommand too, the subcommand read once the flags are removed — `review --json list` answers byte-identically to `review list --json`, and `query --json nodes` to `query nodes --json`, each exit 0); a value-taking flag takes the whole next token (`ids --file --json` runs with the glob `--json` — exit 0, an empty listing naming no `specs/A.mdx` where the unrestricted listing does, stdout not a JSON document; `ids --config --json` names the path `--json` — exit 2, missing configuration, stdout empty, the diagnostic on stderr — where `ids --json --config` exits 2 with the error document on stdout; `ids --file` as the last token exits 2); no single-dash short forms (`review create --strategy audit --name -a` creates `.xspec/reviews/-a.json`, `resolve … --note -x` stores the note `-x`, `ids -j` exits 2 as a surplus operand with stdout empty); `--` ends flag reading and is dropped (`ids --` byte-identical to `ids`; `ids -- --json` exits 2 with stdout empty); arity is fixed by name across commands (`build --file --json` exits 2 having consumed `--json`, stdout empty; `build --bogus --json` and `build --json --file` exit 2 with the error document; each modifying nothing); a repeated `--json` exits 2 with the error document as its entire stdout; list-valued flags: `--kinds depends,`, `,depends`, and `depends,,embeds` each exit 2 with the error document while `depends,depends` answers byte-identically to `depends` (SPEC 12.0, 12.3, 12.1, 10.1, 10.7, 11.1, 7, 12.7)",
  run: async (product) => {
    await withWorkspace({ files: GRAMMAR_FILES }, async (workspace) => {
      // Premise: the fixture builds, so a lenient rename or session write
      // below would have derived state to change and a journal to append.
      await buildOk(product, workspace, "T12.0-14 premise `build`");

      // Reference answers on this fixture: the human listing and the JSON
      // document of `ids` (SPEC 12.3, 12.0).
      const idsHuman = await expectExit(
        product,
        workspace,
        ["ids"],
        0,
        "T12.0-14 reference `ids` — the listing in its human form, exit 0 " +
          "(SPEC 12.3, 12.0)",
      );
      const idsJsonContext = "T12.0-14 reference `ids --json`";
      const idsJson = await expectExit(
        product,
        workspace,
        ["ids", "--json"],
        0,
        `${idsJsonContext} — the listing as a JSON document, exit 0 (SPEC ` +
          `12.3, 12.0)`,
      );
      parseJsonStdout(
        idsJson,
        `${idsJsonContext} — with \`--json\` read as a flag, the single ` +
          `JSON document is the entire standard output (SPEC 12.0)`,
      );

      // --- Flag tokens stand anywhere: before the command word too.
      const jsonFirst = await expectExit(
        product,
        workspace,
        ["--json", "ids"],
        0,
        "T12.0-14 `--json ids` — flag tokens may stand anywhere among the " +
          "arguments, before the command word included: the invocation is " +
          "`ids` with JSON output in effect, exit 0 (SPEC 12.0)",
      );
      assertBytesEqual(
        jsonFirst.stdoutBytes,
        idsJson.stdoutBytes,
        "T12.0-14 `--json ids` against `ids --json`: once the flags are " +
          "removed the remaining tokens are the same command, so the two " +
          "spellings emit byte-identical documents (SPEC 12.0; H-4's " +
          "product-to-itself compare)",
      );
      // Between the command word and its subcommand too: the subcommand is
      // read once the flags are removed (SPEC 12.0).
      await expectSubcommandAfterFlag(
        product,
        workspace,
        ["query", "nodes"],
        "the node listing of the built fixture (SPEC 11.1)",
      );

      // --- `--` ends flag reading and is dropped.
      const dashDash = await expectExit(
        product,
        workspace,
        ["ids", "--"],
        0,
        "T12.0-14 `ids --` — the token `--` ends flag reading and is " +
          "dropped, so the invocation is `ids`: exit 0, never a surplus " +
          "operand or an unknown flag (SPEC 12.0)",
      );
      assertBytesEqual(
        dashDash.stdoutBytes,
        idsHuman.stdoutBytes,
        "T12.0-14 `ids --` against `ids`: `--` is dropped, so the two " +
          "behave identically — byte-identical standard output (SPEC 12.0; " +
          "H-4's product-to-itself compare)",
      );
      await expectSilentUsageError(
        product,
        workspace,
        ["ids", "--", "--json"],
        "T12.0-14 `ids -- --json` — every token after `--` is a non-flag " +
          "token, `--`-prefixed spellings included, so `--json` is a " +
          "surplus operand: exit 2 with JSON output out of effect — " +
          "standard output empty, the usage message on standard error " +
          "(SPEC 12.0)",
      );

      // --- No single-dash short forms: `-j` is an operand, never a flag.
      await expectSilentUsageError(
        product,
        workspace,
        ["ids", "-j"],
        "T12.0-14 `ids -j` — a token beginning with a single `-` is an " +
          "operand or a value, never a flag: `-j` is a surplus operand to " +
          "`ids`, exit 2 with standard output empty (no `--json` flag is " +
          "in effect), never accepted as a short form of `--json` (SPEC " +
          "12.0)",
      );

      // --- The remaining tokens MUST match the synopsis exactly.
      await expectSilentUsageError(
        product,
        workspace,
        [],
        "T12.0-14 `xspec` alone — no command word is a usage error of the " +
          "syntax class: exit 2, standard output empty (SPEC 12.0)",
      );
      await expectPlainUsageError(
        product,
        workspace,
        ["query", "bogus", "--json"],
        "T12.0-14 `query bogus --json` — an unknown subcommand is a usage " +
          "error: exit 2 with the plain usage error's document (SPEC 12.0, " +
          "12.7)",
      );
      await assertLeavesUnchanged(
        workspace.root,
        () =>
          expectSilentUsageError(
            product,
            workspace,
            ["ids", "extra"],
            "T12.0-14 `ids extra` — more operands than the synopsis admits " +
              "is a usage error: exit 2, standard output empty (SPEC 12.0, " +
              "12.3)",
          ),
        "T12.0-14 `ids extra` — a surplus token is never accepted and " +
          "ignored: nothing is done (SPEC 12.0)",
      );
      await assertLeavesUnchanged(
        workspace.root,
        () =>
          expectSilentUsageError(
            product,
            workspace,
            ["rename", GRAMMAR_SPEC_FILE, "a", "b", "c"],
            "T12.0-14 `rename specs/A.mdx a b c` — a fourth operand to " +
              "`rename` (a three-operand synopsis, SPEC 6.4) is a usage " +
              "error: exit 2, standard output empty (SPEC 12.0)",
          ),
        "T12.0-14 `rename specs/A.mdx a b c` — a surplus token is never " +
          "accepted and ignored, so no rename occurs: the journal, the " +
          "sources, and every derived file stay byte-unchanged (SPEC 12.0)",
      );

      // --- `--name=value` is no flag spelling: an unknown flag.
      const nameEqualsContext =
        "T12.0-14 `review create --strategy audit --name=n --json`";
      await assertLeavesUnchanged(
        workspace.root,
        () =>
          expectPlainUsageError(
            product,
            workspace,
            ["review", "create", "--strategy", "audit", "--name=n", "--json"],
            `${nameEqualsContext} — \`--name=value\` is not a spelling of ` +
              `any flag: the token is an unknown flag, a usage error of ` +
              `the syntax class — exit 2 with the plain usage error's ` +
              `document (SPEC 12.0, 12.7)`,
          ),
        `${nameEqualsContext} — an unknown flag modifies nothing: no ` +
          `session is created (SPEC 12.0, 10.7)`,
      );
      if ((await workspace.kind(".xspec/reviews/n.json")) !== "absent") {
        fail(
          `${nameEqualsContext}: no session is created — \`--name=n\` ` +
            `names no session, so .xspec/reviews/n.json must not exist ` +
            `(SPEC 12.0, 10.1)`,
        );
      }

      // --- A value-taking flag takes the whole next token, whatever it
      // looks like — a value beginning with `--` included.
      // Premises: the unrestricted human listing names the listed file
      // `specs/A.mdx` (SPEC 12.3: requirement IDs grouped by file), and a
      // `--file` glob restricts the listing (SPEC 12.3) — the listing of a
      // glob matching nothing names no file — so the empty listing of the
      // glob `--json` below is observable through its information (H-3)
      // and attributable to that glob being in effect. Its bytes are never
      // compared with another glob's listing: different globs are
      // different input, and the human wording is free (it may name the
      // glob; SPEC 12.0's determinism is for identical input; H-3, H-4).
      assertReportMentions(
        idsHuman,
        [GRAMMAR_SPEC_FILE],
        `T12.0-14 premise: the unrestricted human listing of \`ids\` names ` +
          `the listed file ${GRAMMAR_SPEC_FILE} — \`ids\` lists requirement ` +
          `IDs grouped by file (SPEC 12.3), the human form carrying the same ` +
          `information as the JSON form (SPEC 12.0; T12.3-1 asserts the ` +
          `same information)`,
      );
      const noMatch = await expectExit(
        product,
        workspace,
        ["ids", "--file", GRAMMAR_NO_MATCH_GLOB],
        0,
        `T12.0-14 premise \`ids --file ${GRAMMAR_NO_MATCH_GLOB}\` — a glob ` +
          `inside the root matching no discovered file restricts the ` +
          `listing to nothing: an empty listing, exit 0 (SPEC 12.3, 7)`,
      );
      assertReportOmits(
        noMatch,
        [GRAMMAR_SPEC_FILE],
        `T12.0-14 premise \`ids --file ${GRAMMAR_NO_MATCH_GLOB}\`: \`--file\` ` +
          `restricts the listing to the files the glob matches (SPEC 12.3), ` +
          `so the listing restricted to no file names no file — never ` +
          `${GRAMMAR_SPEC_FILE}, which the unrestricted listing names — its ` +
          `wording free (H-3)`,
      );
      const fileJsonContext = "T12.0-14 `ids --file --json`";
      const fileJson = await expectExit(
        product,
        workspace,
        ["ids", "--file", "--json"],
        0,
        `${fileJsonContext} — \`--file\` takes the whole next token as its ` +
          `value whatever it looks like, so the invocation runs with the ` +
          `glob \`--json\`, which matches nothing: an empty listing, exit ` +
          `0 — never \`--file\` lacking its value (SPEC 12.0, 12.3)`,
      );
      assertNotJsonDocument(fileJson, fileJsonContext);
      assertReportOmits(
        fileJson,
        [GRAMMAR_SPEC_FILE],
        `${fileJsonContext}: \`--file\` takes the whole next token (SPEC ` +
          `12.0), so the glob \`--json\` matches nothing and the listing is ` +
          `empty (SPEC 12.3) — an empty listing names no file and so no ` +
          `requirement ID (\`${GRAMMAR_SPEC_FILE}#a\` contains the path; the ` +
          `bare ID \`a\` is too short to check for absence), never ` +
          `${GRAMMAR_SPEC_FILE}, which the unrestricted listing names; its ` +
          `wording is free (H-3), and it may name the glob`,
      );
      const configJson = await expectSilentUsageError(
        product,
        workspace,
        ["ids", "--config", "--json"],
        "T12.0-14 `ids --config --json` — `--config` takes the whole next " +
          "token, so the configuration path is `--json`, which nothing " +
          "occupies: missing configuration, exit 2, with JSON output out " +
          "of effect — standard output empty, the diagnostic on standard " +
          "error (SPEC 12.0, 7, 14.14)",
      );
      if (!/config/i.test(configJson.stderr)) {
        fail(
          `T12.0-14 \`ids --config --json\`: the diagnostic on standard ` +
            `error identifies the configuration as the failing subject — ` +
            `the path \`--json\` names no configuration file (SPEC 14.14, ` +
            `7); any phrasing naming the configuration qualifies (H-3); got ` +
            `${JSON.stringify(configJson.stderr)}`,
        );
      }
      await expectPlainUsageError(
        product,
        workspace,
        ["ids", "--json", "--config"],
        "T12.0-14 `ids --json --config` — `--config` as the last token " +
          "lacks its value, a usage error, with `--json` read as a flag: " +
          "exit 2 with the plain usage error's document as the entire " +
          "standard output — the pair with `ids --config --json` " +
          "discriminating a parser that recognizes `--json` in a value " +
          "position (SPEC 12.0, 12.7)",
      );
      await expectSilentUsageError(
        product,
        workspace,
        ["ids", "--file"],
        "T12.0-14 `ids --file` — a value-taking flag as the last token " +
          "lacks its value: a usage error, exit 2, standard output empty " +
          "(SPEC 12.0)",
      );

      // --- A flag's arity is fixed by its name across commands, known
      // before the command word; a `--` token naming no flag of any
      // command takes no value. Each is a syntax-class error, so `build`
      // modifies nothing (whole-root compares).
      await assertLeavesUnchanged(
        workspace.root,
        () =>
          expectSilentUsageError(
            product,
            workspace,
            ["build", "--file", "--json"],
            "T12.0-14 `build --file --json` — `--file` takes a value on " +
              "every command, so it consumes `--json` and is then an " +
              "unknown flag to `build`: exit 2 with JSON output out of " +
              "effect — standard output empty (SPEC 12.0, 12.1)",
          ),
        "T12.0-14 `build --file --json` — a syntax-class usage error " +
          "modifies nothing (SPEC 12.0)",
      );
      await assertLeavesUnchanged(
        workspace.root,
        () =>
          expectPlainUsageError(
            product,
            workspace,
            ["build", "--bogus", "--json"],
            "T12.0-14 `build --bogus --json` — a `--` token naming no flag " +
              "of any command takes no value, so `--json` stays a flag: " +
              "exit 2 with the plain usage error's document on standard " +
              "output (SPEC 12.0, 12.7)",
          ),
        "T12.0-14 `build --bogus --json` — a syntax-class usage error " +
          "modifies nothing (SPEC 12.0)",
      );
      await assertLeavesUnchanged(
        workspace.root,
        () =>
          expectPlainUsageError(
            product,
            workspace,
            ["build", "--json", "--file"],
            "T12.0-14 `build --json --file` — `--json` a flag, `--file` " +
              "unknown to `build` and lacking its value: exit 2 with the " +
              "plain usage error's document on standard output (SPEC " +
              "12.0, 12.1, 12.7)",
          ),
        "T12.0-14 `build --json --file` — a syntax-class usage error " +
          "modifies nothing (SPEC 12.0)",
      );

      // --- A repeated `--json` is a usage error that still puts JSON output
      // in effect.
      await expectPlainUsageError(
        product,
        workspace,
        ["ids", "--json", "--json"],
        "T12.0-14 `ids --json --json` — a flag may be given at most once: " +
          "the repetition is a usage error that still puts JSON output in " +
          "effect, so the plain usage error's document is the entire " +
          "standard output, exit 2 (SPEC 12.0, 12.7)",
      );

      // --- List-valued flags take one comma-separated value (SPEC 11.1):
      // an empty element is a usage error; a repeated element collapses.
      // `query` is JSON-only (11), so the error document is on stdout with
      // no `--json` given.
      for (const value of ["depends,", ",depends", "depends,,embeds"]) {
        await expectPlainUsageError(
          product,
          workspace,
          ["query", "edges", "--kinds", value],
          `T12.0-14 \`query edges --kinds ${value}\` — the comma-separated ` +
            `value carries an empty element (a trailing, leading, or ` +
            `doubled comma): an invalid flag value of the syntax class, ` +
            `exit 2 with the plain usage error's document (SPEC 12.0, ` +
            `11.1, 12.7)`,
        );
      }
      const single = await expectExit(
        product,
        workspace,
        ["query", "edges", "--kinds", "depends"],
        0,
        "T12.0-14 `query edges --kinds depends` — one element inside the " +
          "vocabulary, exit 0 (SPEC 11.1)",
      );
      const repeated = await expectExit(
        product,
        workspace,
        ["query", "edges", "--kinds", "depends,depends"],
        0,
        "T12.0-14 `query edges --kinds depends,depends` — a repeated " +
          "element collapses to the set {depends}: exit 0, never an " +
          "invalid flag value (SPEC 11.1, 12.0)",
      );
      assertBytesEqual(
        repeated.stdoutBytes,
        single.stdoutBytes,
        "T12.0-14 `query edges --kinds depends,depends` against `--kinds " +
          "depends`: the collapsed set answers byte-identically (SPEC 11.1, " +
          "12.0; T11-4 pins the answer; H-4's product-to-itself compare)",
      );

      // --- Values beginning with `-`: `--name -a` names the session `-a`
      // (a valid name, SPEC 10.1) and `--note -x` stores the note `-x`.
      const createContext =
        `T12.0-14 \`review create --strategy audit --name ` +
        `${GRAMMAR_SESSION_NAME}\``;
      await expectExit(
        product,
        workspace,
        [
          "review",
          "create",
          "--strategy",
          "audit",
          "--name",
          GRAMMAR_SESSION_NAME,
        ],
        0,
        `${createContext} — \`--name\` takes the whole next token, so ` +
          `\`-a\` is the session name: one or more characters from A–Z, ` +
          `a–z, 0–9, \`.\`, \`_\`, and \`-\`, not beginning with \`.\` — ` +
          `a valid name, the session created, exit 0 (SPEC 12.0, 10.1, ` +
          `10.7)`,
      );
      if ((await workspace.kind(GRAMMAR_SESSION_REL)) !== "file") {
        fail(
          `${createContext}: the session is stored at ${GRAMMAR_SESSION_REL} ` +
            `as a plain file (SPEC 10.1); got ` +
            `${await workspace.kind(GRAMMAR_SESSION_REL)}`,
        );
      }
      const nextContext = `T12.0-14 \`review next ${GRAMMAR_SESSION_NAME} --json\``;
      const next = decodeNextReport(
        await runJson(
          product,
          workspace,
          ["review", "next", GRAMMAR_SESSION_NAME, "--json"],
          `${nextContext} — the audit session over one requirement node ` +
            `holds unblocked items, the first of which \`next\` returns ` +
            `(SPEC 10.6, 10.7)`,
        ),
        nextContext,
      );
      if (next.fullyResolved || next.item === undefined) {
        fail(
          `${nextContext}: an audit session creates one subtree-coherence ` +
            `item per requirement node, root nodes included, the leaf's ` +
            `unblocked (SPEC 10.6), so \`next\` returns an item needing ` +
            `review; got fully resolved`,
        );
      }
      const itemId = next.item.id;
      const resolveContext =
        `T12.0-14 \`review resolve ${GRAMMAR_SESSION_NAME} ${itemId} ` +
        `--status updated --note ${GRAMMAR_NOTE}\``;
      await expectExit(
        product,
        workspace,
        [
          "review",
          "resolve",
          GRAMMAR_SESSION_NAME,
          itemId,
          "--status",
          "updated",
          "--note",
          GRAMMAR_NOTE,
        ],
        0,
        `${resolveContext} — \`--note\` takes the whole next token, so ` +
          `\`-x\` is the note, never a flag: the unblocked item resolves, ` +
          `exit 0 (SPEC 12.0, 10.7)`,
      );
      const showContext = `T12.0-14 \`review show ${GRAMMAR_SESSION_NAME} ${itemId} --json\``;
      const item = decodeItemReport(
        await runJson(
          product,
          workspace,
          ["review", "show", GRAMMAR_SESSION_NAME, itemId, "--json"],
          showContext,
        ),
        showContext,
      );
      if (item.note !== GRAMMAR_NOTE) {
        fail(
          `${showContext}: \`resolve … --note -x\` stores the note \`-x\` ` +
            `— the whole next token, a value beginning with \`-\` included ` +
            `(SPEC 12.0, 10.2, 10.7); got note ${JSON.stringify(item.note)}`,
        );
      }
      if (item.status !== "updated") {
        fail(
          `${showContext}: the resolved item carries the status \`updated\` ` +
            `(SPEC 10.3, 10.7); got ${JSON.stringify(item.status)}`,
        );
      }

      // --- A flag between `review` and its subcommand: `review --json
      // list` is `review list` with JSON output in effect, run once the
      // session `-a` exists with an item resolved, so the listing compared
      // carries it (SPEC 12.0, 10.7).
      await expectSubcommandAfterFlag(
        product,
        workspace,
        ["review", "list"],
        `the session listing, \`${GRAMMAR_SESSION_NAME}\` with its counts ` +
          `by status (SPEC 10.7)`,
      );
    });

    // --- `--config <path>` before the command word loads that
    // configuration: the root holds none (the premise below), so an exit-0
    // `build` writing derived output under `cfg/` alone is attributable to
    // the leading flag and its value (SPEC 12.0, 7).
    await withWorkspace({ files: GRAMMAR_CONFIG_FILES }, async (workspace) => {
      await assertSelfContainedRoot(
        product,
        workspace.root,
        "T12.0-14 (the `--config`-first arm's premise: a failed upward search)",
      );
      await expectConfigurationError(
        product,
        workspace,
        ["build"],
        "T12.0-14 premise `build` with no configuration at or above the " +
          "working directory — the upward search fails: a configuration " +
          "error, exit 2 (SPEC 7, 14.14), so the arm's exit 0 is " +
          "attributable to `--config` alone",
      );
      const configFirstContext = `T12.0-14 \`--config ${GRAMMAR_CONFIG_PATH} build\``;
      const before = await snapshotDirectory(workspace.root);
      await expectExit(
        product,
        workspace,
        ["--config", GRAMMAR_CONFIG_PATH, "build"],
        0,
        `${configFirstContext} — the global \`--config\` flag and its value ` +
          `stand before the command word: the named configuration is ` +
          `loaded, its directory the workspace root, and the build ` +
          `succeeds, exit 0 (SPEC 12.0, 7)`,
      );
      const after = await snapshotDirectory(workspace.root);
      const changes = diffSnapshots(before, after);
      if (changes.length === 0) {
        fail(
          `${configFirstContext}: a successful \`build\` over the named ` +
            `configuration's root writes derived output there — generated ` +
            `modules beside the sources and graph data under \`.xspec/\` ` +
            `(SPEC 12.1, 13.1, 13.3) — but nothing under the workspace ` +
            `changed`,
        );
      }
      const outside = changes.filter(
        (change) =>
          change.key !== GRAMMAR_CONFIG_DIR &&
          !change.key.startsWith(`${GRAMMAR_CONFIG_DIR}/`),
      );
      if (outside.length > 0) {
        fail(
          `${configFirstContext}: all configured paths resolve relative to ` +
            `the configuration file's directory, which is the workspace ` +
            `root (SPEC 7), so every write lands under ` +
            `${GRAMMAR_CONFIG_DIR}/; got changes outside it: ` +
            outside
              .slice(0, 10)
              .map((change) => `${change.change} ${change.path}`)
              .join(", "),
        );
      }
    });
  },
});

// ---------------------------------------------------------------------------
// T12.0-16 — byte order, never UTF-16 order
// ---------------------------------------------------------------------------
//
// SPEC 12.0: strings compare byte-wise, so every string order SPEC pins over
// paths, identities, and tags is byte order. UTF-16 code-unit order — a
// JavaScript string comparison's — agrees with it except where, at the first
// difference, a character from U+E000 through U+FFFF meets one above U+FFFF,
// a meeting the ordering fixtures elsewhere never stage; TEST-SPEC
// T12.0-16's separating pair, U+FF21 and U+1F600, is such a meeting. The
// fixture stages the pair in tags, identities, and paths, and each arm pins
// the byte order exactly: on 12.7's documents (`view`, `inventory`,
// `occurrences`, the findings reports of `build` and `check`, and the
// preview and performed `rename` documents) through their form-exact
// decodes, which reject a list out of byte order as a form failure before
// any pin compares it, and on the surfaces whose shape 12.7 leaves to their
// defining sections (`ids --json`, 12.3; `review status` and `export`, 10.7;
// `coverage`, 8.2; `impact`, 9.3; `query reachable`, 11.1) through their
// H-3 adapters and the pins alone.
//
// Conservative operationalizations (noted per H-3/H-4):
// - The fixture self-check (`checkByteOrderFixtureStaging`, harness-side,
//   before any invocation) proves that the pair separates the two orders,
//   that every list pinned below is in byte order and differs from its
//   UTF-16 code-unit sort — so a product ordering by UTF-16 code units
//   never coincides with a pinned list — that each shortest path (f) pins
//   is the byte-least of its two equal-length candidates and the other the
//   UTF-16 least, and that the composed ranges slice the staged bytes.
// - `view` is pinned per file by its tree's identities and tags: `p`'s tag
//   set [U+FF21, U+1F600] from `tags="U+1F600 U+FF21"`, its children
//   `p.U+1F600` then `p.U+FF21` in document order — the reverse of byte
//   order, so a product sorting a document-ordered list by bytes fails as
//   well — a tagless section's `tags` `[]`, a root's `null` (12.7). `ids`
//   is pinned with each file's IDs in document order beside the file order
//   (12.3).
// - `recorded` holds companions 13.1 does not enumerate, so it is pinned as
//   TEST-SPEC words it: its modules and Markdown present (13.1, 13.2),
//   every other entry a companion attributable to its source through 13.1's
//   naming, and every `specs/base.` entry before every `specs/U+FF21.` entry
//   before every `specs/U+1F600.` entry.
// - `occurrences` is pinned by each record's referencing file, kind, source
//   identity, and target, in occurrence order; its ranges are T5.7-*'s.
// - (c)'s findings are pinned form-exact by code, locations, and concerned
//   path, and by identities where 14 makes them contractual (14.12's
//   enumeration: the rule, then the edge's source, kind, and target);
//   messages and every other finding's identities are informational
//   (12.7). With both modules altered, `check` reports exactly the two
//   per-file condition-10 findings beside the two policy findings: no other
//   derived file differs from what `build` generates, graph data compares
//   sources, configuration, and journal alone (13.3), and the workspace
//   still passes `build`'s validations, so policy still holds (7.5). The
//   twins are fresh workspaces of the fixture's files, never built: on a
//   workspace failing `build`'s validations the mismatch forms of 14.10 are
//   undetectable and policy is not evaluated (14.10, 14.12), so each report
//   is exactly the staged condition's findings. The condition-5 locations
//   are pinned exactly — `BASE.missing`, the expression the braces enclose
//   (14) — and the condition-9 locations by file, in order, each within
//   its import declaration's byte window (T2.1-5's convention for an
//   import-cycle participant: the declaration end-widened by one byte).
// - Each staging of (d)–(f) changes the workspace it runs on (a performed
//   rename, deleted graph data, a narrowed glob, a baseline commit and edit,
//   a deletion, an added code source), so each sub-arm stages the built
//   fixture afresh (`stageByteOrderFixture`), and every later staging is a
//   staged-source record (S-9). (f)'s `impact` runs on (e)'s path-blocks
//   workspace: against its baseline, after its edit, as TEST-SPEC words it.
// - (d)'s previews are pinned by `mapping` exactly and `files` by path; the
//   edits inside each file entry are T6.6-4's, their order the decode's.
//   The delta directions hold companions 13.1 does not enumerate, so each is
//   pinned like `recorded` (`assertByteOrderPathGroups`): with graph data
//   deleted (T13.3-2's operational definition) nothing is recorded, so
//   `generated` holds every spec source's module and Markdown, every other
//   entry their companions, grouped `specs/base.`, `specs/U+FF21.`,
//   `specs/U+1F600.`; with the glob narrowed, `removed` holds the two
//   undiscovered sources' recorded paths alone, `specs/U+FF21.` before
//   `specs/U+1F600.`. The performed rename's applied mapping is the same
//   pinned `mapping`.
// - (e)'s orders are read from `status` and from `export` alike. The
//   path-blocks session is pinned by its `dependency-consistency` and
//   `code-impact` items, each kind's scopes in item order, the rest of its
//   order T10.5-4's. The `audit` and `coverage` sessions are pinned by each
//   item's kind and scope file in item order — the file grouping TEST-SPEC
//   words, document order within a file left to T10.6-*'s and T10.7-4's —
//   and the coverage session's two `x` items by scope. After the deletion,
//   `export`'s payload shows the premise (the deleted children's items
//   absent-scoped, the root's and `p`'s present), and specs/base.mdx's
//   present-scope items (a set) precede its absent-scope ones, pinned in
//   order by identity.
// - (f) pins each reported path exactly — `coverage pair`'s covering path of
//   `p`, src/U+FF21.ts's directly impacted entry (its edge and path), and
//   `query reachable`'s witness.

/**
 * The separating pair of TEST-SPEC T12.0-16, each character built from its
 * code point so no tool layer can decode or normalize the spelling on the
 * way into this file: U+FF21 (FULLWIDTH LATIN CAPITAL LETTER A; UTF-8
 * EF BC A1, UTF-16 FF21) and U+1F600 (GRINNING FACE; UTF-8 F0 9F 98 80,
 * UTF-16 D83D DE00). Byte order places a string holding U+FF21 before the
 * same string holding U+1F600 in its place (EF < F0), UTF-16 code-unit
 * order the reverse (D83D < FF21). Both are valid ID segments and tags
 * (SPEC 1.4) and stand in valid spec- and code-source paths (7.1, 14.19);
 * U+FF21 is an identifier character and U+1F600 none, so a reference to a
 * U+1F600 section uses bracket notation (2.4).
 */
export const BYTE_ORDER_FULLWIDTH_A = String.fromCodePoint(0xff21);
/** U+1F600, the pair's second character ({@link BYTE_ORDER_FULLWIDTH_A}). */
export const BYTE_ORDER_GRINNING_FACE = String.fromCodePoint(0x1f600);
const FULL_A = BYTE_ORDER_FULLWIDTH_A;
const GRIN = BYTE_ORDER_GRINNING_FACE;

/** The byte-order fixture's source paths (TEST-SPEC T12.0-16). */
export const BYTE_ORDER_PATHS = {
  /** The spec source holding `p` and its two children. */
  base: "specs/base.mdx",
  /** The spec source named by U+FF21, holding `x`. */
  fullA: `specs/${FULL_A}.mdx`,
  /** The spec source named by U+1F600, holding `x`. */
  grin: `specs/${GRIN}.mdx`,
  /** The code source named by U+FF21, marking `BASE.p`. */
  fullACode: `src/${FULL_A}.ts`,
  /** The code source named by U+1F600, marking `BASE.p`. */
  grinCode: `src/${GRIN}.ts`,
} as const;
const BO = BYTE_ORDER_PATHS;

/**
 * The fixture's configuration (TEST-SPEC T12.0-16) with the given spec
 * glob: spec group `specs` globbing `specGlob` — the fixture's
 * `specs/*.mdx`; (d)'s narrowed `specs/base.mdx` — code group `src`
 * globbing `src/*.ts`, emission enabled; profiles `pair` (`target` `specs`,
 * `targets` "all", `targetTags` configured [U+1F600, U+FF21] — UTF-16
 * order, which its set form must reorder — `boundary` `src`, `mode` direct)
 * and `bare` (`target` `specs`, `boundary` `src`, `mode` direct); and rule
 * `nope` (forbidden, from `{ group: "src" }` to `{ tags: [U+1F600,
 * U+FF21] }`). Valid (SPEC 7, 7.4, 7.5): `src` names a code group alone, so
 * each kind is inferred.
 */
function byteOrderConfigSource(specGlob: string): string {
  return `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    specs: ["${specGlob}"]
  },
  code: {
    src: ["src/*.ts"]
  },
  markdown: { emit: true },
  coverage: [
    {
      name: "pair",
      target: "specs",
      targets: "all",
      targetTags: ["${GRIN}", "${FULL_A}"],
      boundary: "src",
      mode: "direct"
    },
    {
      name: "bare",
      target: "specs",
      boundary: "src",
      mode: "direct"
    }
  ],
  policy: [
    {
      name: "nope",
      type: "forbidden",
      from: { group: "src" },
      to: { tags: ["${GRIN}", "${FULL_A}"] }
    }
  ]
})
`;
}

/** The own text of each of `p`'s two children in the built fixture. */
export const BYTE_ORDER_CHILD_TEXTS = {
  grin: "Grinning-face child text.",
  fullA: "Fullwidth-A child text.",
} as const;

/**
 * (e)'s edit, after the baseline commit: the own text of each of `p`'s two
 * children replaced (SPEC 1.6), each child then `changed` (5.6).
 */
const BYTE_ORDER_EDITED_CHILD_TEXTS: {
  readonly grin: string;
  readonly fullA: string;
} = {
  grin: "Grinning-face child text, edited.",
  fullA: "Fullwidth-A child text, edited.",
};

/**
 * The fixture's `specs/base.mdx` with the given child texts: a section `p`
 * spelled `tags="U+1F600 U+FF21"` — the tags in UTF-16 order, which the set
 * form must reorder — whose children are, in document order, `p.U+1F600`
 * then `p.U+FF21`: document order the reverse of byte order, so a list SPEC
 * orders by document (a view's `children`, `ids`' per-file IDs) and one it
 * orders by bytes part on this file. `p` carries the tags; its children
 * carry none. With `null`, both children deleted — (e)'s deletion: `p`
 * alone, its tags and own text as staged.
 */
export function byteOrderBaseSource(
  childTexts: {
    readonly grin: string;
    readonly fullA: string;
  } | null,
): string {
  const children =
    childTexts === null
      ? ""
      : "\n" +
        `<S id="p.${GRIN}">\n` +
        `${childTexts.grin}\n` +
        "</S>\n" +
        "\n" +
        `<S id="p.${FULL_A}">\n` +
        `${childTexts.fullA}\n` +
        "</S>\n";
  return (
    `<S id="p" tags="${GRIN} ${FULL_A}">\n` +
    "Parent text.\n" +
    children +
    "</S>\n"
  );
}

/** The own text of each spec source's `x`. */
const BYTE_ORDER_X_TEXTS = {
  fullA: "Fullwidth-A file text.",
  grin: "Grinning-face file text.",
} as const;

/**
 * One `x`-holding spec source of the fixture or a twin, composed from its
 * parts with every claimed range (SPEC 1.7; byte offsets): the `d` value's
 * expression, by its own characters (14, 5.7), and — on the import-cycle
 * twin — the import declaration of the other `x`-holding module.
 */
interface ByteOrderXSource {
  readonly file: string;
  readonly source: string;
  readonly dValue: { readonly spelling: string; readonly range: SourceRange };
  readonly otherImport: {
    readonly spelling: string;
    readonly range: SourceRange;
  } | null;
}

/**
 * Compose an `x`-holding source: `import BASE from "./base.xspec"`, then —
 * when `otherModule` is given — `import OTHER from "./<otherModule>.xspec"`
 * (its binding unused), then a blank line and `x` spelling
 * `d={<dSpelling>}` around `text`.
 */
function composeByteOrderXSource(
  file: string,
  text: string,
  dSpelling: string,
  otherModule: string | null,
): ByteOrderXSource {
  let source = "";
  const add = (segment: string): SourceRange => {
    const start = Buffer.byteLength(source, "utf8");
    source += segment;
    return { start, end: Buffer.byteLength(source, "utf8") };
  };
  add('import BASE from "./base.xspec"\n');
  let otherImport: ByteOrderXSource["otherImport"] = null;
  if (otherModule !== null) {
    const spelling = `import OTHER from "./${otherModule}.xspec"`;
    otherImport = { spelling, range: add(spelling) };
    add("\n");
  }
  add('\n<S id="x" d={');
  const dValue = { spelling: dSpelling, range: add(dSpelling) };
  add(`}>\n${text}\n</S>\n`);
  return { file, source, dValue, otherImport };
}

/** The fixture's `x`-holding spec sources, each `d={BASE.p}`. */
const BO_X_FULL_A = composeByteOrderXSource(
  BO.fullA,
  BYTE_ORDER_X_TEXTS.fullA,
  "BASE.p",
  null,
);
const BO_X_GRIN = composeByteOrderXSource(
  BO.grin,
  BYTE_ORDER_X_TEXTS.grin,
  "BASE.p",
  null,
);
/** The unresolved twin's: `x` in both spells `d={BASE.missing}`. */
const BO_MISSING_FULL_A = composeByteOrderXSource(
  BO.fullA,
  BYTE_ORDER_X_TEXTS.fullA,
  "BASE.missing",
  null,
);
const BO_MISSING_GRIN = composeByteOrderXSource(
  BO.grin,
  BYTE_ORDER_X_TEXTS.grin,
  "BASE.missing",
  null,
);
/** The import-cycle twin's: each also imports the other's module, unused. */
const BO_CYCLE_FULL_A = composeByteOrderXSource(
  BO.fullA,
  BYTE_ORDER_X_TEXTS.fullA,
  "BASE.p",
  GRIN,
);
const BO_CYCLE_GRIN = composeByteOrderXSource(
  BO.grin,
  BYTE_ORDER_X_TEXTS.grin,
  "BASE.p",
  FULL_A,
);

/**
 * The fixture's two code sources' shared bytes: `src/U+FF21.ts` and
 * `src/U+1F600.ts` each import `../specs/base.xspec` as `BASE` and mark
 * `BASE.p` at top level — a `references` edge from the file itself, no unit
 * enclosing the marker (SPEC 4.5, 4.6).
 */
const BYTE_ORDER_CODE_SOURCE =
  'import BASE from "../specs/base.xspec";\n\nBASE.p;\n';

/** (f)'s added code source, as TEST-SPEC names it. */
const BYTE_ORDER_C_CODE_PATH = "src/c.ts";

/**
 * (f)'s `src/c.ts`: importing `../specs/U+FF21.xspec` and
 * `../specs/U+1F600.xspec` and marking each module's `x` at top level — two
 * `references` edges from the file itself, so two equal-length paths lead
 * from it to `specs/base.mdx#p`, one through each `x` (SPEC 4.5, 4.6, 11.1).
 */
const BYTE_ORDER_C_CODE_SOURCE =
  `import FULLWIDTH from "../specs/${FULL_A}.xspec";\n` +
  `import GRINNING from "../specs/${GRIN}.xspec";\n` +
  "\n" +
  "FULLWIDTH.x;\n" +
  "GRINNING.x;\n";

// The staged-source records (helpers/staged-mdx.ts, helpers/staged-ts.ts;
// S-9): the fixture's files and its twins' — workspaces each body stages,
// the twins and (d)–(f)'s fresh fixtures after its first product invocation
// — and the stagings (d)–(f) make on a built fixture (the narrowed
// configuration, (e)'s edit and deletion, (f)'s code source), every one a
// record, so the S-9 self-test judges each before any product exists.
const BYTE_ORDER_CONFIG = stagedTs(
  "T12.0-16 byte-order fixture xspec.config.ts — spec group specs, code group src, emission enabled, profiles pair (targetTags U+1F600, U+FF21) and bare, rule nope (src to the tags U+1F600, U+FF21)",
  byteOrderConfigSource("specs/*.mdx"),
);
const BYTE_ORDER_NARROWED_CONFIG = stagedTs(
  "T12.0-16 (d) narrowed xspec.config.ts — spec group specs globbing specs/base.mdx alone, the rest the fixture's configuration",
  byteOrderConfigSource(BYTE_ORDER_PATHS.base),
);
const BYTE_ORDER_BASE = stagedMdx(
  "T12.0-16 byte-order fixture specs/base.mdx — p tagged U+1F600 U+FF21, its children p.U+1F600 then p.U+FF21",
  byteOrderBaseSource(BYTE_ORDER_CHILD_TEXTS),
);
const BYTE_ORDER_X_FULL_A = stagedMdx(
  "T12.0-16 byte-order fixture specs/U+FF21.mdx — x depending on BASE.p",
  BO_X_FULL_A.source,
);
const BYTE_ORDER_X_GRIN = stagedMdx(
  "T12.0-16 byte-order fixture specs/U+1F600.mdx — x depending on BASE.p",
  BO_X_GRIN.source,
);
const BYTE_ORDER_CODE = stagedTs(
  "T12.0-16 byte-order fixture src/U+FF21.ts and src/U+1F600.ts — BASE.p marked at top level",
  BYTE_ORDER_CODE_SOURCE,
);
const BYTE_ORDER_MISSING_FULL_A = stagedMdx(
  "T12.0-16 unresolved twin specs/U+FF21.mdx — x spelling d={BASE.missing}",
  BO_MISSING_FULL_A.source,
);
const BYTE_ORDER_MISSING_GRIN = stagedMdx(
  "T12.0-16 unresolved twin specs/U+1F600.mdx — x spelling d={BASE.missing}",
  BO_MISSING_GRIN.source,
);
const BYTE_ORDER_CYCLE_FULL_A = stagedMdx(
  "T12.0-16 import-cycle twin specs/U+FF21.mdx — also importing ./U+1F600.xspec, the binding unused",
  BO_CYCLE_FULL_A.source,
);
const BYTE_ORDER_CYCLE_GRIN = stagedMdx(
  "T12.0-16 import-cycle twin specs/U+1F600.mdx — also importing ./U+FF21.xspec, the binding unused",
  BO_CYCLE_GRIN.source,
);
const BYTE_ORDER_EDITED_BASE = stagedMdx(
  "T12.0-16 (e) specs/base.mdx — p.U+1F600's and p.U+FF21's own text edited",
  byteOrderBaseSource(BYTE_ORDER_EDITED_CHILD_TEXTS),
);
const BYTE_ORDER_CHILDLESS_BASE = stagedMdx(
  "T12.0-16 (e) specs/base.mdx — p.U+1F600 and p.U+FF21 deleted",
  byteOrderBaseSource(null),
);
const BYTE_ORDER_C_CODE = stagedTs(
  "T12.0-16 (f) src/c.ts — importing ../specs/U+FF21.xspec and ../specs/U+1F600.xspec, marking each module's x at top level",
  BYTE_ORDER_C_CODE_SOURCE,
);

/** The byte-order fixture's files (TEST-SPEC T12.0-16), every one a record. */
export const BYTE_ORDER_FIXTURE_FILES: Readonly<
  Record<string, StagedMdx | StagedTs>
> = {
  "xspec.config.ts": BYTE_ORDER_CONFIG,
  [BO.base]: BYTE_ORDER_BASE,
  [BO.fullA]: BYTE_ORDER_X_FULL_A,
  [BO.grin]: BYTE_ORDER_X_GRIN,
  [BO.fullACode]: BYTE_ORDER_CODE,
  [BO.grinCode]: BYTE_ORDER_CODE,
};

/** (c)'s unresolved twin: the fixture with `x` spelling `d={BASE.missing}`. */
const BYTE_ORDER_UNRESOLVED_TWIN_FILES: Readonly<
  Record<string, StagedMdx | StagedTs>
> = {
  ...BYTE_ORDER_FIXTURE_FILES,
  [BO.fullA]: BYTE_ORDER_MISSING_FULL_A,
  [BO.grin]: BYTE_ORDER_MISSING_GRIN,
};

/** (c)'s import-cycle twin: each `x`-holding source imports the other's. */
const BYTE_ORDER_CYCLE_TWIN_FILES: Readonly<
  Record<string, StagedMdx | StagedTs>
> = {
  ...BYTE_ORDER_FIXTURE_FILES,
  [BO.fullA]: BYTE_ORDER_CYCLE_FULL_A,
  [BO.grin]: BYTE_ORDER_CYCLE_GRIN,
};

/**
 * Stage the byte-order fixture in a fresh workspace (H-1) and build it —
 * exit 0: the fixture passes `build`'s validations, its policy rule
 * constraining the graph alone, which `build` never evaluates (SPEC 12.1,
 * 7.5). The caller disposes the workspace; it is disposed here when the
 * staging fails.
 */
export async function stageByteOrderFixture(
  product: ProductBinding,
  context: string,
): Promise<TestWorkspace> {
  const workspace = await TestWorkspace.create({
    files: BYTE_ORDER_FIXTURE_FILES,
  });
  try {
    await buildOk(
      product,
      workspace,
      `${context} — staging \`build\`: the byte-order fixture passes ` +
        `\`build\`'s validations, exit 0 (SPEC 12.1; \`build\` does not ` +
        `evaluate policy, 7.5)`,
    );
    return workspace;
  } catch (error) {
    await workspace.dispose();
    throw error;
  }
}

// --- the byte-order expectations ---------------------------------------------

/** A spec source's generated module path (SPEC 13.1: NAME.xspec.ts). */
function byteOrderModuleOf(specFile: string): string {
  return `${specFile.slice(0, -".mdx".length)}.xspec.ts`;
}

/** A spec source's Markdown emit destination, next to it (SPEC 13.2). */
function byteOrderMarkdownOf(specFile: string): string {
  return `${specFile.slice(0, -".mdx".length)}.md`;
}

/** Every tag set the fixture configures or spells, as a set: byte order. */
const BYTE_ORDER_TAG_SET: readonly string[] = [FULL_A, GRIN];

/** The spec sources in byte order of path — `view`'s and `ids`' orders. */
const BYTE_ORDER_SPEC_FILES: readonly string[] = [BO.base, BO.fullA, BO.grin];

/** (b)'s `view` operands, as TEST-SPEC names them. */
const BYTE_ORDER_VIEW_OPERANDS: readonly string[] = [
  BO.grin,
  BO.base,
  BO.fullA,
];

/** The discovered sources in byte order of path — `inventory`'s `sources`. */
const BYTE_ORDER_SOURCES: readonly string[] = [
  ...BYTE_ORDER_SPEC_FILES,
  BO.fullACode,
  BO.grinCode,
];

/** The four occurrences' referencing files, in occurrence order (5.7). */
const BYTE_ORDER_OCCURRENCE_FILES: readonly string[] = [
  BO.fullA,
  BO.grin,
  BO.fullACode,
  BO.grinCode,
];

/** The policy violations' edge sources, in the findings' order (12.7). */
const BYTE_ORDER_POLICY_SOURCES: readonly string[] = [
  BO.fullACode,
  BO.grinCode,
];

/** (c)'s altered modules, in the condition-10 findings' order (12.7). */
const BYTE_ORDER_STALE_MODULES: readonly string[] = [
  byteOrderModuleOf(BO.fullA),
  byteOrderModuleOf(BO.grin),
];

/** The located files of (c)'s condition-5 and condition-9 findings. */
const BYTE_ORDER_LOCATED_FILES: readonly string[] = [BO.fullA, BO.grin];

/**
 * Each spec source's derived-path stem and `recorded`'s per-source prefix
 * (`<stem>.`), in byte order: `specs/base.`, `specs/U+FF21.`,
 * `specs/U+1F600.`.
 */
const BYTE_ORDER_RECORDED_STEMS: readonly string[] = BYTE_ORDER_SPEC_FILES.map(
  (file) => file.slice(0, -".mdx".length),
);

/** A view node projected to its identity, tags, and children (12.7). */
interface IdentityTagsShape {
  readonly identity: string | { readonly unavailable: true };
  readonly tags: readonly string[] | null | { readonly unavailable: true };
  readonly children: readonly IdentityTagsShape[];
}

function projectIdentityTags(node: ViewNode): IdentityTagsShape {
  return {
    identity: node.identity,
    tags: node.tags,
    children: node.children.map(projectIdentityTags),
  };
}

/** An `x`-holding file's tree: the root, then `x`, tagless. */
function byteOrderXTree(file: string): IdentityTagsShape {
  return {
    identity: file,
    tags: null,
    children: [{ identity: `${file}#x`, tags: [], children: [] }],
  };
}

/**
 * The views' trees in byte order of file: `specs/base.mdx`'s `p` carrying
 * the tag set [U+FF21, U+1F600], its children in document order —
 * `p.U+1F600`, then `p.U+FF21` — each tagless (`[]`), every root's tags the
 * stated `null` (SPEC 11.4, 12.7).
 */
const BYTE_ORDER_VIEW_TREES: readonly IdentityTagsShape[] = [
  {
    identity: BO.base,
    tags: null,
    children: [
      {
        identity: `${BO.base}#p`,
        tags: BYTE_ORDER_TAG_SET,
        children: [
          { identity: `${BO.base}#p.${GRIN}`, tags: [], children: [] },
          { identity: `${BO.base}#p.${FULL_A}`, tags: [], children: [] },
        ],
      },
    ],
  },
  byteOrderXTree(BO.fullA),
  byteOrderXTree(BO.grin),
];

/** `ids`' listing: files in byte order, IDs in document order (12.3). */
const BYTE_ORDER_IDS: readonly {
  readonly file: string;
  readonly ids: readonly string[];
}[] = [
  { file: BO.base, ids: ["p", `p.${GRIN}`, `p.${FULL_A}`] },
  { file: BO.fullA, ids: ["x"] },
  { file: BO.grin, ids: ["x"] },
];

/** `inventory`'s `sources`: path order, each with its one group (11.6). */
const BYTE_ORDER_INVENTORY_SOURCES = BYTE_ORDER_SOURCES.map((path) => ({
  path,
  groups: path.startsWith("specs/")
    ? [{ name: "specs", kind: "spec" }]
    : [{ name: "src", kind: "code" }],
}));

/** `inventory`'s `derived`: one entry per spec source, in `source` order. */
const BYTE_ORDER_INVENTORY_DERIVED = BYTE_ORDER_SPEC_FILES.map((source) => ({
  source,
  module: byteOrderModuleOf(source),
  markdown: byteOrderMarkdownOf(source),
}));

/** An occurrence record projected to what (b) pins of it (5.7, 12.7). */
interface OccurrenceOrderShape {
  readonly file: PathValue;
  readonly kind: string;
  readonly source: string | { readonly unavailable: true };
  readonly target: string;
}

function projectOccurrenceOrder(
  record: OccurrenceRecord,
): OccurrenceOrderShape {
  return {
    file: record.file,
    kind: record.kind,
    source:
      "identity" in record.source ? record.source.identity : record.source,
    target: record.target,
  };
}

/**
 * The four occurrences in occurrence order: each `x`'s `depends` reference
 * from its section, then each code source's top-level marker, a
 * `references` edge from the file (SPEC 5.7, 4.5, 4.6), every target `p`.
 */
const BYTE_ORDER_OCCURRENCES: readonly OccurrenceOrderShape[] = [
  ...[BO.fullA, BO.grin].map((file) => ({
    file,
    kind: "depends",
    source: `${file}#x`,
    target: `${BO.base}#p`,
  })),
  ...[BO.fullACode, BO.grinCode].map((file) => ({
    file,
    kind: "references",
    source: file,
    target: `${BO.base}#p`,
  })),
];

/**
 * A finding projected to what (c) pins (SPEC 12.7): code, locations, and
 * concerned path, and — for a policy violation alone, whose identities 14.12
 * enumerates — identities; messages stay informational.
 */
interface OrderFindingShape {
  readonly code: string | null;
  readonly locations: readonly FindingLocation[];
  readonly path: PathValue | null;
  readonly identities?: readonly string[];
}

function projectOrderFinding(finding: Finding): OrderFindingShape {
  const shape = {
    code: finding.code,
    locations: finding.locations,
    path: finding.path,
  };
  return finding.code === "policy-violation"
    ? { ...shape, identities: finding.identities }
    : shape;
}

/**
 * `nope`'s two violations (SPEC 14.12): `locations` `[]` and `path` `null`,
 * so the identities decide — the rule, the edge's source, kind, and target,
 * src/U+FF21.ts's edge first by bytes.
 */
const BYTE_ORDER_POLICY_FINDINGS: readonly OrderFindingShape[] =
  BYTE_ORDER_POLICY_SOURCES.map((source) => ({
    code: "policy-violation",
    locations: [],
    path: null,
    identities: ["nope", source, "references", `${BO.base}#p`],
  }));

/** The altered modules' per-file condition-10 findings (SPEC 14.10). */
const BYTE_ORDER_STALE_FINDINGS: readonly OrderFindingShape[] =
  BYTE_ORDER_STALE_MODULES.map((path) => ({
    code: "stale-output",
    locations: [],
    path,
  }));

/** The unresolved twin's two condition-5 findings, located exactly (14). */
const BYTE_ORDER_UNRESOLVED_FINDINGS: readonly OrderFindingShape[] = [
  BO_MISSING_FULL_A,
  BO_MISSING_GRIN,
].map((x) => ({
  code: "unknown-dependency",
  locations: [{ file: x.file, range: x.dValue.range }],
  path: null,
}));

/** (d)'s rename, as TEST-SPEC names it: `p` renamed `q` in specs/base.mdx. */
const BYTE_ORDER_RENAME_ARGV: readonly string[] = ["rename", BO.base, "p", "q"];

/**
 * (d)'s identity mapping (SPEC 6.4, 6.6, 12.7): `p` and each descendant,
 * ordered by `from` bytes — `specs/base.mdx#p` (a prefix of the others),
 * then `#p.U+FF21` (EF BC A1), then `#p.U+1F600` (F0 9F 98 80) — the order
 * of the preview's `mapping` and of the performed rename's applied mapping.
 */
const BYTE_ORDER_RENAME_MAPPING: readonly AppliedMappingPair[] = [
  { from: `${BO.base}#p`, to: `${BO.base}#q` },
  { from: `${BO.base}#p.${FULL_A}`, to: `${BO.base}#q.${FULL_A}` },
  { from: `${BO.base}#p.${GRIN}`, to: `${BO.base}#q.${GRIN}` },
];

/**
 * (d)'s rewritten files in byte order of path (SPEC 6.6, 12.7): every
 * discovered source — specs/base.mdx's three `id` attributes, each
 * `x`-holding source's `d` reference, each code source's marker.
 */
const BYTE_ORDER_RENAME_FILES: readonly string[] = BYTE_ORDER_SOURCES;

/** The spec sources (d)'s narrowed glob leaves undiscovered (SPEC 7). */
const BYTE_ORDER_UNDISCOVERED_FILES: readonly string[] = [BO.fullA, BO.grin];

/** (e)'s session names (SPEC 10.1). */
const BYTE_ORDER_PATH_BLOCKS_SESSION = "pb";
const BYTE_ORDER_AUDIT_SESSION = "audit";
const BYTE_ORDER_COVERAGE_SESSION = "cov";

/**
 * The two `x` sections, by file path bytes: (e)'s depth-1
 * `dependency-consistency` scopes (SPEC 10.5) and its last two
 * `uncovered-requirement` scopes (10.7).
 */
const BYTE_ORDER_X_SCOPES: readonly string[] = [
  `${BO.fullA}#x`,
  `${BO.grin}#x`,
];

/** (e)'s `code-impact` scopes, by code-location identity bytes (10.5). */
const BYTE_ORDER_CODE_IMPACT_SCOPES: readonly string[] = [
  BO.fullACode,
  BO.grinCode,
];

/**
 * (e)'s `audit` items as kind and scope file, in item order (SPEC 10.6): one
 * `subtree-coherence` item per requirement node, roots included —
 * specs/base.mdx's root, `p`, `p.U+1F600`, and `p.U+FF21`, then each
 * `x`-holding file's root and `x` — by scope-node file path bytes.
 */
const BYTE_ORDER_AUDIT_ITEMS: readonly string[] = [
  BO.base,
  BO.base,
  BO.base,
  BO.base,
  BO.fullA,
  BO.fullA,
  BO.grin,
  BO.grin,
].map((file) => `subtree-coherence ${file}`);

/** The deletion's present specs/base.mdx scopes — the root and `p` — a set. */
const BYTE_ORDER_PRESENT_BASE_SCOPES: readonly string[] = [
  BO.base,
  `${BO.base}#p`,
];

/** The deleted children's absent scopes, by scope-node identity bytes. */
const BYTE_ORDER_ABSENT_SCOPES: readonly string[] = [
  `${BO.base}#p.${FULL_A}`,
  `${BO.base}#p.${GRIN}`,
];

/**
 * (e)'s `coverage` items over `bare` as kind and scope file, in item order
 * (SPEC 10.7, 8.1): one `uncovered-requirement` item per uncovered required
 * node — the leaves `p.U+1F600`, `p.U+FF21`, and each `x`, none of which a
 * code source's marker reaches directly — by file path bytes.
 */
const BYTE_ORDER_COVERAGE_ITEMS: readonly string[] = [
  BO.base,
  BO.base,
  BO.fullA,
  BO.grin,
].map((file) => `uncovered-requirement ${file}`);

/**
 * One shortest path (f) pins, beside the other equal-length candidate SPEC
 * 12.0's tie-break passes over: the byte-least node-identity sequence, the
 * other the UTF-16 code-unit least.
 */
interface ByteOrderTieBreak {
  readonly what: string;
  readonly reported: readonly string[];
  readonly passedOver: readonly string[];
}

/** (f)'s covering path of `p` under `pair`: the boundary's direct edge (8.2). */
const BYTE_ORDER_COVERING_TIE: ByteOrderTieBreak = {
  what: "(f)'s covering path",
  reported: [BO.fullACode, `${BO.base}#p`],
  passedOver: [BO.grinCode, `${BO.base}#p`],
};

/** (f)'s witness path of src/U+FF21.ts's direct impact: `p` to a child (9.3). */
const BYTE_ORDER_IMPACT_TIE: ByteOrderTieBreak = {
  what: "(f)'s impact witness path",
  reported: [`${BO.base}#p`, `${BO.base}#p.${FULL_A}`],
  passedOver: [`${BO.base}#p`, `${BO.base}#p.${GRIN}`],
};

/** (f)'s `reachable` witness from src/c.ts to specs/base.mdx#p (11.1). */
const BYTE_ORDER_REACHABLE_TIE: ByteOrderTieBreak = {
  what: "(f)'s reachable witness",
  reported: [BYTE_ORDER_C_CODE_PATH, `${BO.fullA}#x`, `${BO.base}#p`],
  passedOver: [BYTE_ORDER_C_CODE_PATH, `${BO.grin}#x`, `${BO.base}#p`],
};

/** Byte order over UTF-8 encodings (SPEC 12.0). */
function byteOrderCompare(a: string, b: string): number {
  return Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

/** UTF-16 code-unit order: JavaScript's own string comparison. */
function utf16Compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** `values` sorted by {@link byteOrderCompare}. */
function byteOrderSorted(values: readonly string[]): string[] {
  return [...values].sort(byteOrderCompare);
}

/** `values` sorted by {@link utf16Compare}. */
function utf16Sorted(values: readonly string[]): string[] {
  return [...values].sort(utf16Compare);
}

/**
 * Element-wise comparison of two node-identity sequences under `compare`, a
 * proper prefix first (SPEC 12.0's shortest-path tie-break, by bytes).
 */
function compareIdentitySequences(
  a: readonly string[],
  b: readonly string[],
  compare: (x: string, y: string) => number,
): number {
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    const order = compare(a[i]!, b[i]!);
    if (order !== 0) return order;
  }
  return a.length - b.length;
}

/**
 * Fixture self-check (harness-side, before any product invocation; a failure
 * is a staging defect of this test, thrown as a harness error, never a
 * product result): the pair's encodings are TEST-SPEC's; each list the arms
 * pin is in byte order and differs from its UTF-16 code-unit sort, so a
 * product ordering by UTF-16 code units never coincides with it; `p`'s
 * children's document order is the reverse of byte order; each shortest
 * path (f) pins is the element-wise byte-least of its two equal-length
 * candidates, the other the UTF-16 code-unit least; (e)'s edit changes both
 * children's own text; (b)'s operands stand in neither order; and every
 * composed range slices the staged bytes to its spelling.
 */
function checkByteOrderFixtureStaging(): void {
  const misstaged = (what: string): never => {
    throw new Error(
      `T12.0-16 fixture self-check — ${what} (a harness-side staging ` +
        `error, not a product failure)`,
    );
  };
  if (Buffer.from(FULL_A, "utf8").toString("hex") !== "efbca1") {
    misstaged("U+FF21 does not encode as UTF-8 EF BC A1");
  }
  if (Buffer.from(GRIN, "utf8").toString("hex") !== "f09f9880") {
    misstaged("U+1F600 does not encode as UTF-8 F0 9F 98 80");
  }
  if (FULL_A.length !== 1 || FULL_A.charCodeAt(0) !== 0xff21) {
    misstaged("U+FF21 is not the one UTF-16 code unit FF21");
  }
  if (
    GRIN.length !== 2 ||
    GRIN.charCodeAt(0) !== 0xd83d ||
    GRIN.charCodeAt(1) !== 0xde00
  ) {
    misstaged("U+1F600 is not the UTF-16 code units D83D DE00");
  }
  const pinned: readonly (readonly [string, readonly string[]])[] = [
    ["the tag set", BYTE_ORDER_TAG_SET],
    ["the views' and ids' file order", BYTE_ORDER_SPEC_FILES],
    ["inventory's sources", BYTE_ORDER_SOURCES],
    ["recorded's per-source prefixes", BYTE_ORDER_RECORDED_STEMS],
    ["the occurrences' referencing files", BYTE_ORDER_OCCURRENCE_FILES],
    ["the policy findings' edge sources", BYTE_ORDER_POLICY_SOURCES],
    ["the condition-10 findings' concerned paths", BYTE_ORDER_STALE_MODULES],
    [
      "the condition-5 and -9 findings' located files",
      BYTE_ORDER_LOCATED_FILES,
    ],
    [
      "(d)'s mapping's `from` identities",
      BYTE_ORDER_RENAME_MAPPING.map((pair) => pair.from),
    ],
    ["(d)'s rewritten files", BYTE_ORDER_RENAME_FILES],
    [
      "(d)'s `removed` per-source prefixes",
      BYTE_ORDER_UNDISCOVERED_FILES.map(byteOrderStemOf),
    ],
    ["(e)'s `x` scopes", BYTE_ORDER_X_SCOPES],
    ["(e)'s code-impact scopes", BYTE_ORDER_CODE_IMPACT_SCOPES],
    ["(e)'s audit items' scope files", BYTE_ORDER_AUDIT_ITEMS],
    ["(e)'s absent scopes", BYTE_ORDER_ABSENT_SCOPES],
    ["(e)'s coverage items' scope files", BYTE_ORDER_COVERAGE_ITEMS],
  ];
  for (const [what, list] of pinned) {
    if (JSON.stringify(byteOrderSorted(list)) !== JSON.stringify(list)) {
      misstaged(`${what} ${JSON.stringify(list)} is not in byte order`);
    }
    if (JSON.stringify(utf16Sorted(list)) === JSON.stringify(list)) {
      misstaged(
        `${what} ${JSON.stringify(list)} coincides with its UTF-16 ` +
          `code-unit order, so the arm could not see a product ordering ` +
          `by UTF-16 code units`,
      );
    }
  }
  const children = [`p.${GRIN}`, `p.${FULL_A}`];
  if (
    JSON.stringify(byteOrderSorted(children)) !==
    JSON.stringify([...children].reverse())
  ) {
    misstaged("p's children's document order is not the reverse of byte order");
  }
  // (f): each pinned shortest path is the element-wise byte-least of its two
  // equal-length candidates, the other the UTF-16 code-unit least.
  for (const tie of [
    BYTE_ORDER_COVERING_TIE,
    BYTE_ORDER_IMPACT_TIE,
    BYTE_ORDER_REACHABLE_TIE,
  ]) {
    if (
      tie.reported.length !== tie.passedOver.length ||
      compareIdentitySequences(
        tie.reported,
        tie.passedOver,
        byteOrderCompare,
      ) >= 0 ||
      compareIdentitySequences(tie.reported, tie.passedOver, utf16Compare) <= 0
    ) {
      misstaged(
        `${tie.what} ${JSON.stringify(tie.reported)} is not the byte-least ` +
          `of two equal-length candidates whose UTF-16 code-unit least is ` +
          `${JSON.stringify(tie.passedOver)}`,
      );
    }
  }
  // (e): the edit changes both children's own text.
  if (
    BYTE_ORDER_EDITED_CHILD_TEXTS.grin === BYTE_ORDER_CHILD_TEXTS.grin ||
    BYTE_ORDER_EDITED_CHILD_TEXTS.fullA === BYTE_ORDER_CHILD_TEXTS.fullA
  ) {
    misstaged("(e)'s edit leaves a child's own text as built");
  }
  for (const order of [
    BYTE_ORDER_SPEC_FILES,
    utf16Sorted(BYTE_ORDER_SPEC_FILES),
  ]) {
    if (JSON.stringify(order) === JSON.stringify(BYTE_ORDER_VIEW_OPERANDS)) {
      misstaged(
        "(b)'s view operands stand in byte or UTF-16 order, so a product " +
          "echoing its operands would coincide with an order",
      );
    }
  }
  const sliceCheck = (
    x: ByteOrderXSource,
    claim: { readonly spelling: string; readonly range: SourceRange },
    what: string,
  ): void => {
    const bytes = Buffer.from(x.source, "utf8");
    const sliced = bytes
      .subarray(claim.range.start, claim.range.end)
      .toString("utf8");
    if (sliced !== claim.spelling) {
      misstaged(
        `${x.file}'s ${what} range [${String(claim.range.start)}, ` +
          `${String(claim.range.end)}) slices ${JSON.stringify(sliced)}, ` +
          `not ${JSON.stringify(claim.spelling)}`,
      );
    }
  };
  for (const x of [
    BO_X_FULL_A,
    BO_X_GRIN,
    BO_MISSING_FULL_A,
    BO_MISSING_GRIN,
    BO_CYCLE_FULL_A,
    BO_CYCLE_GRIN,
  ]) {
    sliceCheck(x, x.dValue, "`d` value");
    if (x.otherImport !== null) sliceCheck(x, x.otherImport, "other import");
  }
}

// --- the byte-order arms -----------------------------------------------------

/** The decoded documents (a) reads, whose file orders (b) pins. */
interface ByteOrderReads {
  readonly view: ViewReport;
  readonly inventory: InventoryDocument;
}

/**
 * (a) Tag sets (SPEC 12.7; T11.4-3, T11.6-2): `view` reports `p`'s `tags`
 * exactly [U+FF21, U+1F600] — spelled `tags="U+1F600 U+FF21"` — and
 * `inventory` reports `pair`'s `targetTags` and `nope`'s `tags` selector
 * list, each configured [U+1F600, U+FF21], exactly so. Both answers are
 * complete and finding-free (exit 0, `findings` `[]`): the policy
 * violations are no file's findings and accompany no answer (14.12, 11.6).
 */
async function expectByteOrderTagSets(
  product: ProductBinding,
  workspace: TestWorkspace,
): Promise<ByteOrderReads> {
  const viewContext = "T12.0-16 (a) bare `view`";
  const view = decodeViewReport(
    await runJson(
      product,
      workspace,
      ["view"],
      `${viewContext} — the request covers every discovered spec source: a ` +
        `complete, finding-free answer, exit 0 (SPEC 11.4, 12.0)`,
    ),
    { text: false },
    viewContext,
  );
  assertSameJson(
    view.findings,
    [],
    `${viewContext}: finding-free — the fixture's sources carry no ` +
      `finding, and the policy violations are no file's findings (SPEC ` +
      `11.4, 14.12)`,
  );
  const p = view.views.find((entry) => entry.file === BO.base)?.root
    .children[0];
  if (p === undefined) {
    fail(
      `${viewContext}: the answer must carry specs/base.mdx's view with its ` +
        `section \`p\` (SPEC 11.4); got the views ` +
        JSON.stringify(view.views.map((entry) => entry.file)),
    );
  }
  assertSameJson(
    { identity: p.identity, tags: p.tags },
    { identity: `${BO.base}#p`, tags: BYTE_ORDER_TAG_SET },
    `${viewContext} — specs/base.mdx's \`p\`, spelled tags="U+1F600 ` +
      `U+FF21": its interpreted tags a tag set in byte order — U+FF21 (EF ` +
      `BC A1) before U+1F600 (F0 9F 98 80) — never UTF-16 code-unit order, ` +
      `which puts U+1F600 (D83D) first (SPEC 12.7, 12.0, 11.4)`,
  );

  const inventoryContext = "T12.0-16 (a) `inventory`";
  const inventory = decodeInventoryDocument(
    await runJson(
      product,
      workspace,
      ["inventory"],
      `${inventoryContext} — the inventory answers whatever the sources' ` +
        `validity: a complete answer, exit 0 (SPEC 11.6, 12.0)`,
    ),
    inventoryContext,
  );
  assertSameJson(
    inventory.findings,
    [],
    `${inventoryContext}: finding-free — condition 23 is the only finding ` +
      `an inventory answer carries, and nothing stages it (SPEC 11.6)`,
  );
  assertSameJson(
    inventory.configuration.coverage.find((profile) => profile.name === "pair")
      ?.targetTags,
    BYTE_ORDER_TAG_SET,
    `${inventoryContext} — the profile \`pair\`'s \`targetTags\`, configured ` +
      `[U+1F600, U+FF21] and read as a set: a tag set in byte order, ` +
      `U+FF21 first, never the configured or UTF-16 order (SPEC 12.7, 7.4, ` +
      `11.6, 12.0; undefined: no profile \`pair\` reported)`,
  );
  assertSameJson(
    inventory.configuration.policy.find((rule) => rule.name === "nope")?.to,
    { tags: BYTE_ORDER_TAG_SET },
    `${inventoryContext} — the rule \`nope\`'s \`to\` selector, configured ` +
      `{ tags: [U+1F600, U+FF21] }: one member, a tag set in byte order, ` +
      `U+FF21 first, never the configured or UTF-16 order (SPEC 12.7, 7.5, ` +
      `11.6, 12.0; undefined: no rule \`nope\` reported)`,
  );
  return { view, inventory };
}

/**
 * Assert a `view` answer's file order and trees (SPEC 11.4, 12.7): exactly
 * the three spec sources in byte order of path — `specs/base.mdx`, then
 * `specs/U+FF21.mdx`, then `specs/U+1F600.mdx` — each view the named
 * file's, its tree's identities and tags as staged, children in document
 * order.
 */
function assertByteOrderViews(
  report: ViewReport,
  why: string,
  context: string,
): void {
  assertSameJson(
    report.views.map((entry) => entry.file),
    BYTE_ORDER_SPEC_FILES,
    `${context}: the per-file views in byte order of workspace-relative ` +
      `path — specs/base.mdx (0x62), specs/U+FF21.mdx (EF BC A1), ` +
      `specs/U+1F600.mdx (F0 9F 98 80) — ${why}; never UTF-16 code-unit ` +
      `order, which puts specs/U+1F600.mdx (D83D) before specs/U+FF21.mdx ` +
      `(FF21) (SPEC 11.4, 12.7, 12.0)`,
  );
  report.views.forEach((entry, index) => {
    assertSameJson(
      projectIdentityTags(entry.root),
      BYTE_ORDER_VIEW_TREES[index],
      `${context} — ${renderPathValue(entry.file)}: the view is the named ` +
        `file's — the root and its section tree, identities and tags, ` +
        `children in document order (specs/base.mdx's p.U+1F600 before ` +
        `p.U+FF21, the reverse of byte order), a tagless section's tags ` +
        `[], a root's null (SPEC 11.4, 12.7)`,
    );
  });
}

/**
 * A list of derived-file paths made of one or more spec sources' derived
 * paths, as a 12.7 document presents it — `inventory`'s `recorded` (SPEC
 * 11.6) or a preview delta's direction (6.6) — with why each source's paths
 * stand in it.
 */
interface ByteOrderPathList {
  /** The list's name in a diagnosis: "`recorded`", "the delta's `removed`". */
  readonly name: string;
  /** The spec sources whose derived paths it holds, in byte order of path. */
  readonly sources: readonly string[];
  /** Why each source's module and Markdown stand in it. */
  readonly holds: string;
  /** The passage its content follows, cited in every diagnosis. */
  readonly cites: string;
}

/** A derived-path stem as a diagnosis spells it, with its first bytes. */
function byteOrderStemLabel(stem: string): string {
  if (stem === byteOrderStemOf(BO.fullA)) return "specs/U+FF21. (EF BC A1)";
  if (stem === byteOrderStemOf(BO.grin)) return "specs/U+1F600. (F0 9F 98 80)";
  return `${stem}.`;
}

/** A spec source's derived-path stem (SPEC 13.1, 13.2): its path less `.mdx`. */
function byteOrderStemOf(specFile: string): string {
  return specFile.slice(0, -".mdx".length);
}

/**
 * Assert a list of derived-file paths grouped by source in byte order (SPEC
 * 12.7: `recorded` and each delta direction list their paths in byte
 * order): every entry a plain string (every derived path here is valid
 * UTF-8, 12.0), each listed source's module and Markdown present (13.1,
 * 13.2), every other entry a companion attributable to one of them through
 * 13.1's naming (`<stem>.xspec.` plus a suffix) — the companions are the
 * product's own (H-4) — and the sources' groups in byte order of stem:
 * `specs/base.` before `specs/U+FF21.` before `specs/U+1F600.`, never
 * UTF-16 code-unit order.
 */
function assertByteOrderPathGroups(
  paths: readonly PathValue[],
  list: ByteOrderPathList,
  context: string,
): void {
  const entries = paths.map((entry, index) => {
    if (typeof entry === "string") return entry;
    return fail(
      `${context}: ${list.name} entry ${String(index)} arrived in the ` +
        `marked byte form (${renderPathValue(entry)}) — every derived path ` +
        `here is valid UTF-8, never presented in the byte form (SPEC 12.0, ` +
        `12.7)`,
    );
  });
  for (const pinned of [
    ...list.sources.map(byteOrderModuleOf),
    ...list.sources.map(byteOrderMarkdownOf),
  ]) {
    if (!entries.includes(pinned)) {
      fail(
        `${context}: ${list.name} must list ${JSON.stringify(pinned)} — ` +
          `${list.holds}, the modules and the emitted Markdown among them ` +
          `(${list.cites}, 13.1, 13.2); ${list.name}: ` +
          JSON.stringify(entries),
      );
    }
  }
  const stems = list.sources.map(byteOrderStemOf);
  const groups = entries.map((entry) => {
    const group = stems.findIndex(
      (stem) =>
        entry === `${stem}.md` ||
        (entry.startsWith(`${stem}.xspec.`) &&
          entry.length > `${stem}.xspec.`.length),
    );
    if (group === -1) {
      fail(
        `${context}: ${list.name} entry ${JSON.stringify(entry)} is ` +
          `attributable to none of ${stems.map(byteOrderStemLabel).join(", ")} ` +
          `— neither its Markdown nor its module or a companion through the ` +
          `13.1 naming scheme ("<stem>.xspec." plus a suffix) — and ` +
          `${list.name} holds those sources' generated modules, companions, ` +
          `and emitted Markdown alone: ${list.holds} (${list.cites}, 13.1)`,
      );
    }
    return group;
  });
  for (let i = 1; i < groups.length; i += 1) {
    if (groups[i - 1]! > groups[i]!) {
      fail(
        `${context}: ${list.name} in byte order — ` +
          stems
            .map((stem) => `every ${byteOrderStemLabel(stem)} path`)
            .join(", then ") +
          ` — never UTF-16 code-unit order, which puts specs/U+1F600. ` +
          `(D83D) before specs/U+FF21. (FF21) (${list.cites}, 12.7, 12.0); ` +
          `${JSON.stringify(entries[i - 1])} precedes ` +
          `${JSON.stringify(entries[i])} in ${JSON.stringify(entries)}`,
      );
    }
  }
}

/**
 * Assert `recorded` (SPEC 11.6, 13.3; T11.6-3): the plain list — the record
 * exists and is readable after the build — grouped by source in byte order
 * ({@link assertByteOrderPathGroups}): each spec source's module and
 * Markdown present, every other entry a companion attributable to its
 * source, and every `specs/base.` entry before every `specs/U+FF21.` entry
 * before every `specs/U+1F600.` entry.
 */
function assertByteOrderRecorded(
  recorded: DecodedDatum<readonly PathValue[]>,
  context: string,
): void {
  if (recorded.state !== "value") {
    fail(
      `${context}: \`recorded\` must be the plain list of the recorded ` +
        `derived-file paths — the build recorded them and the record is ` +
        `readable (SPEC 11.6, 13.3, 12.7); got state "${recorded.state}"`,
    );
  }
  assertByteOrderPathGroups(
    recorded.value,
    {
      name: "`recorded`",
      sources: BYTE_ORDER_SPEC_FILES,
      holds: "the recorded paths are the paths as last generated",
      cites: "SPEC 11.6, 13.3",
    },
    context,
  );
}

/**
 * (b) File orders: `view`, with no operand — (a)'s answer — and with the
 * operands `specs/U+1F600.mdx specs/base.mdx specs/U+FF21.mdx`, orders its
 * views `specs/base.mdx`, `specs/U+FF21.mdx`, `specs/U+1F600.mdx` (11.4,
 * T11.4-1); `ids` lists the files in that order (12.3, T12.3-1); `inventory`
 * — (a)'s answer — lists `sources` `specs/base.mdx`, `specs/U+FF21.mdx`,
 * `specs/U+1F600.mdx`, `src/U+FF21.ts`, `src/U+1F600.ts`, `derived` in that
 * order of `source`, and `recorded` every `specs/U+FF21.` path before every
 * `specs/U+1F600.` path (11.6, T11.6-3); and `occurrences` orders its
 * records by referencing file `specs/U+FF21.mdx`, `specs/U+1F600.mdx`,
 * `src/U+FF21.ts`, `src/U+1F600.ts` (5.7, T5.7-3).
 */
async function expectByteOrderFileOrders(
  product: ProductBinding,
  workspace: TestWorkspace,
  reads: ByteOrderReads,
): Promise<void> {
  assertByteOrderViews(
    reads.view,
    "with no operand the request covers every discovered spec source",
    "T12.0-16 (b) bare `view` ((a)'s answer)",
  );
  const operandContext =
    "T12.0-16 (b) `view specs/U+1F600.mdx specs/base.mdx specs/U+FF21.mdx`";
  const operandView = decodeViewReport(
    await runJson(
      product,
      workspace,
      ["view", ...BYTE_ORDER_VIEW_OPERANDS],
      `${operandContext} — three discovered spec sources named: a complete, ` +
        `finding-free answer, exit 0 (SPEC 11.4, 12.0)`,
    ),
    { text: false },
    operandContext,
  );
  assertSameJson(
    operandView.findings,
    [],
    `${operandContext}: finding-free (SPEC 11.4)`,
  );
  assertByteOrderViews(
    operandView,
    "the requested files form a set, viewed in byte order of path " +
      "whatever order the operands name them in",
    operandContext,
  );

  const idsContext = "T12.0-16 (b) `ids --json`";
  const ids = decodeIdsReport(
    await runJson(
      product,
      workspace,
      ["ids", "--json"],
      `${idsContext} — the listing as a JSON document, exit 0 (SPEC 12.3, ` +
        `12.0)`,
    ),
    idsContext,
  );
  assertSameJson(
    ids.files,
    BYTE_ORDER_IDS,
    `${idsContext}: one entry per discovered spec source in byte order of ` +
      `path — specs/base.mdx, specs/U+FF21.mdx, specs/U+1F600.mdx, never ` +
      `UTF-16 code-unit order — each holding its file's IDs in document ` +
      `order (p, p.U+1F600, p.U+FF21), no entry for a code source (SPEC ` +
      `12.3, 12.0)`,
  );

  const inventoryContext = "T12.0-16 (b) `inventory` ((a)'s answer)";
  assertSameJson(
    reads.inventory.sources,
    BYTE_ORDER_INVENTORY_SOURCES,
    `${inventoryContext} — \`sources\` in byte order of workspace-relative ` +
      `path — specs/base.mdx, specs/U+FF21.mdx, specs/U+1F600.mdx, ` +
      `src/U+FF21.ts, src/U+1F600.ts — never UTF-16 code-unit order, each ` +
      `with its group membership (SPEC 11.6, 12.7, 12.0)`,
  );
  assertSameJson(
    reads.inventory.derived,
    BYTE_ORDER_INVENTORY_DERIVED,
    `${inventoryContext} — \`derived\` in that order of \`source\`, each ` +
      `spec source's module and, emission enabled, its Markdown next to it ` +
      `(SPEC 11.6, 12.7, 13.1, 13.2, 12.0)`,
  );
  assertByteOrderRecorded(reads.inventory.recorded, inventoryContext);

  const occurrencesContext = "T12.0-16 (b) `occurrences`";
  const occurrences = decodeOccurrencesReport(
    await runJson(
      product,
      workspace,
      ["occurrences"],
      `${occurrencesContext} — a complete, finding-free answer, exit 0 ` +
        `(SPEC 11.3, 12.0)`,
    ),
    occurrencesContext,
  );
  assertSameJson(
    occurrences.findings,
    [],
    `${occurrencesContext}: finding-free — the policy violations accompany ` +
      `no answer of 11.3 (SPEC 14.12)`,
  );
  assertSameJson(
    occurrences.occurrences.map(projectOccurrenceOrder),
    BYTE_ORDER_OCCURRENCES,
    `${occurrencesContext}: the four occurrences in occurrence order, by ` +
      `referencing file path bytes — specs/U+FF21.mdx, specs/U+1F600.mdx, ` +
      `src/U+FF21.ts, src/U+1F600.ts — never UTF-16 code-unit order; each ` +
      `\`x\`'s \`depends\` reference, then each code source's top-level ` +
      `marker, a \`references\` edge from the file, every target \`p\` ` +
      `(SPEC 5.7, 12.7, 4.5, 4.6, 12.0)`,
  );
}

/**
 * (c)'s first two findings arms (SPEC 12.7; T12.7-2): `check` on the built
 * fixture reports exactly `nope`'s two condition-12 findings, the edge from
 * `src/U+FF21.ts` first by identities; with `specs/U+FF21.xspec.ts` and
 * `specs/U+1F600.xspec.ts` then each altered, their per-file condition-10
 * findings, `specs/U+FF21.xspec.ts`'s first by concerned path, beside the
 * two.
 */
async function expectByteOrderCheckFindings(
  product: ProductBinding,
  workspace: TestWorkspace,
): Promise<void> {
  const policyContext = "T12.0-16 (c) `check --json` on the built fixture";
  const policy = await runFindingsReport(
    product,
    workspace,
    ["check", "--json"],
    1,
    `${policyContext} — the policy violations are findings, exit 1 (SPEC ` +
      `12.2, 7.5, 12.0)`,
  );
  assertSameJson(
    policy.map(projectOrderFinding),
    BYTE_ORDER_POLICY_FINDINGS,
    `${policyContext}: exactly \`nope\`'s two condition-12 findings, one ` +
      `per offending edge — \`locations\` [] and \`path\` null, so the ` +
      `identities decide: src/U+FF21.ts's edge before src/U+1F600.ts's, ` +
      `compared element-wise by bytes, never UTF-16 code-unit order (SPEC ` +
      `12.7, 14.12, 12.0)`,
  );

  const staleContext =
    "T12.0-16 (c) `check --json` with specs/U+FF21.xspec.ts and " +
    "specs/U+1F600.xspec.ts altered";
  for (const module of BYTE_ORDER_STALE_MODULES) {
    const original = await readGeneratedModule(
      workspace,
      module,
      `${staleContext} — ${module} as the build generated it (SPEC 13.1)`,
    );
    // An edit of product-written bytes — a derived file, no code source,
    // whose well-formedness the document does not declare — staged
    // `unchecked` (S-9), as T12.2-2's hand-edited module is.
    await workspace.file(module, `${original}// altered\n`, {
      ts: "unchecked",
    });
  }
  const stale = await runFindingsReport(
    product,
    workspace,
    ["check", "--json"],
    1,
    `${staleContext} — stale generated output and the policy violations ` +
      `are findings, exit 1 (SPEC 12.2, 14.10, 12.0)`,
  );
  assertSameJson(
    stale.map(projectOrderFinding),
    [...BYTE_ORDER_STALE_FINDINGS, ...BYTE_ORDER_POLICY_FINDINGS],
    `${staleContext}: exactly the two altered modules' per-file ` +
      `condition-10 findings — \`locations\` [], so the concerned paths ` +
      `decide: specs/U+FF21.xspec.ts before specs/U+1F600.xspec.ts, never ` +
      `UTF-16 code-unit order — then \`nope\`'s two condition-12 findings ` +
      `as before (code order: 10 before 12; no other derived file differs ` +
      `and graph data is current; SPEC 12.7, 14.10, 14.12, 13.3, 12.0)`,
  );
}

/**
 * (c)'s unresolved twin: `x` in both spec sources spells `d={BASE.missing}`
 * — `build` and `check` report exactly the two condition-5 findings,
 * `specs/U+FF21.mdx`'s first by locations (file path bytes), each located
 * at `BASE.missing` exactly (SPEC 14.5, 14, 12.7).
 */
async function expectByteOrderUnresolvedTwin(
  product: ProductBinding,
): Promise<void> {
  await withWorkspace(
    { files: BYTE_ORDER_UNRESOLVED_TWIN_FILES },
    async (twin) => {
      for (const command of ["build", "check"]) {
        const context =
          `T12.0-16 (c) \`${command} --json\` on the twin whose \`x\`s ` +
          `spell d={BASE.missing}`;
        const findings = await runFindingsReport(
          product,
          twin,
          [command, "--json"],
          1,
          `${context} — an unresolved \`d\` reference is a validation ` +
            `error, exit 1 (SPEC 14.5, 12.0)`,
        );
        assertSameJson(
          findings.map(projectOrderFinding),
          BYTE_ORDER_UNRESOLVED_FINDINGS,
          `${context}: exactly the two condition-5 findings, each located ` +
            `at its \`d\` value's expression \`BASE.missing\` and concerning ` +
            `no path — the locations decide: specs/U+FF21.mdx's before ` +
            `specs/U+1F600.mdx's by file path bytes, never UTF-16 code-unit ` +
            `order; a failing workspace's mismatch forms of 14.10 ` +
            `undetectable and its policy unevaluated (SPEC 12.7, 14.5, 14, ` +
            `14.10, 14.12, 12.0)`,
        );
      }
    },
  );
}

/**
 * (c)'s import-cycle twin: `specs/U+FF21.mdx` and `specs/U+1F600.mdx` each
 * also import the other's module, the binding unused — `check` reports the
 * spec import cycle as exactly one condition-9 finding whose `locations`
 * place `specs/U+FF21.mdx`'s declaration before `specs/U+1F600.mdx`'s, each
 * within its declaration's byte window (SPEC 14.9, 14, 12.7, 2.1).
 */
async function expectByteOrderImportCycleTwin(
  product: ProductBinding,
): Promise<void> {
  await withWorkspace({ files: BYTE_ORDER_CYCLE_TWIN_FILES }, async (twin) => {
    const context =
      "T12.0-16 (c) `check --json` on the twin whose `x`-holding sources " +
      "import each other's modules";
    const findings = await runFindingsReport(
      product,
      twin,
      ["check", "--json"],
      1,
      `${context} — a spec import cycle is a validation error, exit 1 ` +
        `(SPEC 2.1, 14.9, 12.0)`,
    );
    const [cycle] = findings;
    if (
      findings.length !== 1 ||
      cycle === undefined ||
      cycle.code !== "cycle" ||
      cycle.path !== null
    ) {
      fail(
        `${context}: exactly one finding — the spec import cycle's one ` +
          `condition-9 finding, stable code "cycle", concerning no path ` +
          `(located) — the workspace failing \`build\`'s validations, its ` +
          `mismatch forms of 14.10 undetectable and its policy unevaluated ` +
          `(SPEC 14.9, 14, 12.7, 14.10, 14.12); got ` +
          JSON.stringify(findings.map(projectOrderFinding)),
      );
    }
    assertSameJson(
      cycle.locations.map((location) => location.file),
      BYTE_ORDER_LOCATED_FILES,
      `${context}: the cycle locates each participating import ` +
        `declaration, ordered by file path bytes — specs/U+FF21.mdx's ` +
        `before specs/U+1F600.mdx's, never UTF-16 code-unit order (SPEC ` +
        `14.9, 14, 12.7, 12.0)`,
    );
    [BO_CYCLE_FULL_A, BO_CYCLE_GRIN].forEach((x, index) => {
      const location = cycle.locations[index]!;
      const declaration = x.otherImport!;
      const window = {
        start: declaration.range.start,
        end: declaration.range.end + 1,
      };
      if (
        location.range.start < window.start ||
        location.range.end > window.end
      ) {
        fail(
          `${context}: locations[${String(index)}] in ${x.file} must fall ` +
            `within the import declaration ${JSON.stringify(declaration.spelling)}'s ` +
            `byte window [${String(window.start)}, ${String(window.end)}] — ` +
            `the cycle locates each participating import declaration by ` +
            `its own characters (SPEC 14, 14.9, 11.4); got ` +
            `[${String(location.range.start)}, ${String(location.range.end)})`,
        );
      }
    });
  });
}

// --- (d)–(f): previews, review items, and shortest paths --------------------

/**
 * Stage the built fixture afresh (`stageByteOrderFixture`, H-1), run `body`
 * on it, and dispose: each of (d)–(f)'s stagings changes the workspace it
 * runs on — a performed rename, deleted graph data, a narrowed glob, a
 * baseline commit and edit, a deletion, an added code source — so each
 * starts from the built fixture TEST-SPEC names.
 */
async function withBuiltByteOrderFixture(
  product: ProductBinding,
  context: string,
  body: (workspace: TestWorkspace) => Promise<void>,
): Promise<void> {
  const workspace = await stageByteOrderFixture(product, context);
  try {
    await body(workspace);
  } finally {
    await workspace.dispose();
  }
}

/** A successful preview's plan: no member `null`, the delta plain (6.6). */
interface ByteOrderPreviewPlan {
  readonly mapping: readonly AppliedMappingPair[];
  readonly files: readonly PreviewFileEntry[];
  readonly delta: PreviewDelta;
}

/**
 * Run (d)'s preview, `rename specs/base.mdx p q --preview --json`: exit 0 —
 * the real operation would proceed, the workspace passing `build`'s
 * validations (SPEC 6.4, 6.6) — the document decoded form-exact (12.7: the
 * decode rejects a `mapping`, `files`, or delta direction out of byte order
 * before any pin compares it), findings `[]`, and the success plan: no
 * member `null`, the delta a plain two-direction value — an absent record
 * is the nothing-recorded success path, never the 14.23 unavailability.
 */
async function runByteOrderPreview(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
): Promise<ByteOrderPreviewPlan> {
  const report = decodePreviewReport(
    await runJson(
      product,
      workspace,
      [...BYTE_ORDER_RENAME_ARGV, "--preview", "--json"],
      `${context} — the real rename would proceed (the workspace passes ` +
        `\`build\`'s validations, \`p\` exists, \`q\` collides with nothing), ` +
        `so the preview succeeds, exit 0 (SPEC 6.4, 6.6, 12.0)`,
    ),
    context,
  );
  assertSameJson(
    report.findings,
    [],
    `${context}: a preview whose real operation would proceed reports ` +
      `findings [] (SPEC 6.6, 12.7)`,
  );
  const { mapping, files, delta } = report;
  if (mapping === null || files === null || delta === null) {
    fail(
      `${context}: a successful preview reports its plan — \`mapping\`, ` +
        `\`files\`, and \`delta\` are null exactly on refusal (SPEC 6.6, 12.7)`,
    );
  }
  if ("unavailable" in delta) {
    fail(
      `${context}: the delta is explicitly unavailable only where recorded ` +
        `state exists but cannot be read as a record (SPEC 14.23) — a ` +
        `built record, or none, is reported as a plain two-direction value ` +
        `(SPEC 6.6)`,
    );
  }
  return { mapping, files, delta };
}

/**
 * (d) Previews (SPEC 6.6, 6.4, 12.7; T6.6-4(a), T6.6-5): on the built
 * fixture `rename specs/base.mdx p q --preview` reports `mapping` ordered by
 * `from` — specs/base.mdx#p, #p.U+FF21, #p.U+1F600 — and `files` ordered
 * specs/base.mdx, specs/U+FF21.mdx, specs/U+1F600.mdx, src/U+FF21.ts,
 * src/U+1F600.ts, and the performed rename reports the same `mapping`; with
 * graph data deleted (T13.3-2's operational definition), the same preview's
 * `generated` holds every derived path, every specs/U+FF21. path before
 * every specs/U+1F600. path; and on the built fixture with `specs`' glob
 * narrowed to specs/base.mdx and no rebuild, its `removed` holds the two
 * undiscovered sources' recorded paths likewise.
 */
async function expectByteOrderPreviews(product: ProductBinding): Promise<void> {
  await withBuiltByteOrderFixture(
    product,
    "T12.0-16 (d) preview and performed rename",
    async (workspace) => {
      const context =
        "T12.0-16 (d) `rename specs/base.mdx p q --preview --json` on the " +
        "built fixture";
      const plan = await runByteOrderPreview(product, workspace, context);
      assertSameJson(
        plan.mapping,
        BYTE_ORDER_RENAME_MAPPING,
        `${context}: \`mapping\` — one pair per identity the rename changes, ` +
          `\`p\` and each descendant, ordered by \`from\` bytes: ` +
          `specs/base.mdx#p, then #p.U+FF21 (EF BC A1), then #p.U+1F600 ` +
          `(F0 9F 98 80), never UTF-16 code-unit order, which puts ` +
          `#p.U+1F600 (D83D) first (SPEC 6.6, 6.4, 12.7, 12.0)`,
      );
      assertSameJson(
        plan.files.map((entry) => entry.file),
        BYTE_ORDER_RENAME_FILES,
        `${context}: \`files\` — every file the rename would rewrite (the ` +
          `three \`id\` attributes, each \`x\`'s \`d\` reference, each code ` +
          `source's marker), ordered by file path bytes: specs/base.mdx, ` +
          `specs/U+FF21.mdx, specs/U+1F600.mdx, src/U+FF21.ts, ` +
          `src/U+1F600.ts, never UTF-16 code-unit order (SPEC 6.6, 12.7, 12.0)`,
      );
      const performedContext =
        "T12.0-16 (d) the performed `rename specs/base.mdx p q --json`";
      const performed = decodePerformedOperationReport(
        await runJson(
          product,
          workspace,
          [...BYTE_ORDER_RENAME_ARGV, "--json"],
          `${performedContext} — the rename the preview planned succeeds, ` +
            `exit 0 (SPEC 6.4, 6.6, 12.0)`,
        ),
        performedContext,
      );
      assertSameJson(
        performed.mapping,
        BYTE_ORDER_RENAME_MAPPING,
        `${performedContext}: the applied mapping is the complete identity ` +
          `mapping the operation journaled — the preview's \`mapping\`, in ` +
          `its order by \`from\` bytes, U+FF21's child before U+1F600's ` +
          `(SPEC 6.4, 6.6, 12.7, 12.0)`,
      );
    },
  );

  await withBuiltByteOrderFixture(
    product,
    "T12.0-16 (d) preview with graph data deleted",
    async (workspace) => {
      const context =
        "T12.0-16 (d) `rename specs/base.mdx p q --preview --json` with " +
        "graph data deleted";
      await deleteGraphData(workspace, `${context} staging`);
      const plan = await runByteOrderPreview(product, workspace, context);
      assertByteOrderPathGroups(
        plan.delta.generated,
        {
          name: "the delta's `generated`",
          sources: BYTE_ORDER_SPEC_FILES,
          holds:
            "with graph data deleted nothing is recorded (the record " +
            "missing, read as empty), so every derived path the " +
            "post-operation workspace generates is newly generated",
          cites: "SPEC 6.6, 11.6",
        },
        context,
      );
    },
  );

  await withBuiltByteOrderFixture(
    product,
    "T12.0-16 (d) preview with the glob narrowed",
    async (workspace) => {
      const context =
        "T12.0-16 (d) `rename specs/base.mdx p q --preview --json` with " +
        "`specs`' glob narrowed to specs/base.mdx and no rebuild";
      await workspace.file("xspec.config.ts", BYTE_ORDER_NARROWED_CONFIG);
      const plan = await runByteOrderPreview(product, workspace, context);
      assertByteOrderPathGroups(
        plan.delta.removed,
        {
          name: "the delta's `removed`",
          sources: BYTE_ORDER_UNDISCOVERED_FILES,
          holds:
            "specs/U+FF21.mdx and specs/U+1F600.mdx no longer discovered, " +
            "their recorded paths are the recorded paths the operation " +
            "would leave no longer generated, and specs/base.mdx's are " +
            "generated again",
          cites: "SPEC 6.6, 13.3, 7",
        },
        context,
      );
    },
  );
}

/** One review item as `status` or `export` presents it, in item order. */
interface ByteOrderItemRow {
  readonly kind: ItemKind;
  readonly scope: string;
  /** The scope node's presence (10.4) — `export`'s payload alone has it. */
  readonly present?: boolean;
}

/** A session's items as one read subcommand presents them (10.7). */
interface ByteOrderSessionView {
  readonly label: string;
  readonly items: readonly ByteOrderItemRow[];
  /** Whether its items carry their scope nodes' presence (`export`'s). */
  readonly withPresence: boolean;
}

/**
 * A session's item order as `status` and `export` each present it (SPEC
 * 10.5, 10.7: `status`, `next`, and `export` present items in item order):
 * `review status <name> --json` and `review export <name> --json`, each a
 * read answering exit 0, decoded (H-3).
 */
async function readByteOrderSession(
  product: ProductBinding,
  workspace: TestWorkspace,
  name: string,
  context: string,
): Promise<readonly ByteOrderSessionView[]> {
  const statusLabel = `${context} — \`review status ${name} --json\``;
  const status = decodeSessionStatusReport(
    await runJson(
      product,
      workspace,
      ["review", "status", name, "--json"],
      `${statusLabel}: a read subcommand answering, exit 0 (SPEC 10.7, 12.0)`,
    ),
    statusLabel,
  );
  const exportLabel = `${context} — \`review export ${name} --json\``;
  const exported = decodeExportReport(
    await runJson(
      product,
      workspace,
      ["review", "export", name, "--json"],
      `${exportLabel}: a read subcommand answering, exit 0 (SPEC 10.7, 12.0)`,
    ),
    exportLabel,
  );
  return [
    {
      label: statusLabel,
      items: status.items.map((row) => ({ kind: row.kind, scope: row.scope })),
      withPresence: false,
    },
    {
      label: exportLabel,
      items: exported.items.map((item) => ({
        kind: item.kind,
        scope: item.scope.node,
        present: item.scope.present,
      })),
      withPresence: true,
    },
  ];
}

/** The file part of an identity (SPEC 1.5): before `#`, or a root's whole. */
function byteOrderFileOf(identity: string): string {
  const hash = identity.indexOf("#");
  return hash === -1 ? identity : identity.slice(0, hash);
}

/** A view's items as `<kind> <scope file>`, in item order. */
function byteOrderKindFiles(view: ByteOrderSessionView): readonly string[] {
  return view.items.map(
    (item) => `${item.kind} ${byteOrderFileOf(item.scope)}`,
  );
}

/** A view's scopes of one kind, in item order. */
function byteOrderScopesOf(
  view: ByteOrderSessionView,
  kind: ItemKind,
): readonly string[] {
  return view.items
    .filter((item) => item.kind === kind)
    .map((item) => item.scope);
}

/**
 * (e)'s `path-blocks` session (SPEC 10.5; T10.5-4): with the built fixture
 * committed as the baseline and the own text of `p.U+1F600` and `p.U+FF21`
 * then edited, the session orders its depth-1 `dependency-consistency`
 * items specs/U+FF21.mdx#x's before specs/U+1F600.mdx#x's (by scope-node
 * file path) and its `code-impact` items src/U+FF21.ts's before
 * src/U+1F600.ts's (by code-location identity), as `status` and `export`
 * present it. (f)'s impact arm then runs here, against that baseline after
 * that edit.
 */
async function expectByteOrderPathBlocks(
  product: ProductBinding,
): Promise<void> {
  await withBuiltByteOrderFixture(
    product,
    "T12.0-16 (e) path-blocks session",
    async (workspace) => {
      await workspace.gitInit();
      const baseline = await workspace.gitCommitAll(
        "T12.0-16 byte-order fixture, built",
      );
      await workspace.file(BO.base, BYTE_ORDER_EDITED_BASE);
      const context =
        "T12.0-16 (e) the path-blocks session against the built fixture, " +
        "p.U+1F600's and p.U+FF21's own text then edited";
      await expectExit(
        product,
        workspace,
        [
          "review",
          "create",
          "--base",
          baseline,
          "--name",
          BYTE_ORDER_PATH_BLOCKS_SESSION,
        ],
        0,
        `${context} — \`review create --base <baseline> --name ` +
          `${BYTE_ORDER_PATH_BLOCKS_SESSION}\` on a valid workspace with a ` +
          `resolvable baseline, exit 0 (SPEC 10.7, 6.3)`,
      );
      for (const view of await readByteOrderSession(
        product,
        workspace,
        BYTE_ORDER_PATH_BLOCKS_SESSION,
        context,
      )) {
        assertSameJson(
          byteOrderScopesOf(view, "dependency-consistency"),
          BYTE_ORDER_X_SCOPES,
          `${view.label}: the depth-1 \`dependency-consistency\` items — one ` +
            `per \`x\`, whose \`d\` edge targets \`p\`, its effectiveHash ` +
            `changed — tied on depth and kind, ordered by scope-node file ` +
            `path bytes: specs/U+FF21.mdx#x's (EF BC A1) before ` +
            `specs/U+1F600.mdx#x's (F0 9F 98 80), never UTF-16 code-unit ` +
            `order (SPEC 10.5, 5.6, 12.0)`,
        );
        assertSameJson(
          byteOrderScopesOf(view, "code-impact"),
          BYTE_ORDER_CODE_IMPACT_SCOPES,
          `${view.label}: the \`code-impact\` items — one per directly ` +
            `impacted code location, each code source's marker reaching ` +
            `\`p\` — ordered by code-location identity bytes: ` +
            `src/U+FF21.ts's before src/U+1F600.ts's, never UTF-16 code-unit ` +
            `order (SPEC 10.5, 9.2, 12.0)`,
        );
      }
      await expectByteOrderImpactTieBreak(product, workspace, baseline);
    },
  );
}

/**
 * (e)'s `audit` and `coverage` sessions (SPEC 10.6, 10.7, 10.5): an `audit`
 * session created on the built fixture orders specs/base.mdx's items, then
 * specs/U+FF21.mdx's, then specs/U+1F600.mdx's (by file path); a `coverage`
 * session over `bare` on the built fixture orders its
 * `uncovered-requirement` items specs/U+FF21.mdx#x's before
 * specs/U+1F600.mdx#x's (by file path); and, `p.U+1F600` and `p.U+FF21`
 * then deleted, the `audit` session places their now absent-scope items
 * after specs/base.mdx's present-scope ones, specs/base.mdx#p.U+FF21's first
 * (by scope-node identity) — each order as `status` and `export` present
 * it.
 */
async function expectByteOrderAuditAndCoverage(
  product: ProductBinding,
): Promise<void> {
  await withBuiltByteOrderFixture(
    product,
    "T12.0-16 (e) audit and coverage sessions",
    async (workspace) => {
      const auditContext =
        "T12.0-16 (e) the audit session created on the built fixture";
      await expectExit(
        product,
        workspace,
        [
          "review",
          "create",
          "--strategy",
          "audit",
          "--name",
          BYTE_ORDER_AUDIT_SESSION,
        ],
        0,
        `${auditContext} — \`review create --strategy audit --name ` +
          `${BYTE_ORDER_AUDIT_SESSION}\` on a valid workspace, exit 0 (SPEC ` +
          `10.7)`,
      );
      for (const view of await readByteOrderSession(
        product,
        workspace,
        BYTE_ORDER_AUDIT_SESSION,
        auditContext,
      )) {
        assertSameJson(
          byteOrderKindFiles(view),
          BYTE_ORDER_AUDIT_ITEMS,
          `${view.label}: one \`subtree-coherence\` item per requirement ` +
            `node, roots included, ordered by scope-node file path bytes — ` +
            `specs/base.mdx's four, then specs/U+FF21.mdx's two (EF BC A1), ` +
            `then specs/U+1F600.mdx's two (F0 9F 98 80), never UTF-16 ` +
            `code-unit order (SPEC 10.6, 12.0)`,
        );
      }

      const coverageContext =
        "T12.0-16 (e) the coverage session over `bare` on the built fixture";
      await expectExit(
        product,
        workspace,
        [
          "review",
          "create",
          "--coverage",
          "bare",
          "--name",
          BYTE_ORDER_COVERAGE_SESSION,
        ],
        0,
        `${coverageContext} — \`review create --coverage bare --name ` +
          `${BYTE_ORDER_COVERAGE_SESSION}\` on a valid workspace, exit 0 ` +
          `(SPEC 10.7)`,
      );
      for (const view of await readByteOrderSession(
        product,
        workspace,
        BYTE_ORDER_COVERAGE_SESSION,
        coverageContext,
      )) {
        assertSameJson(
          byteOrderKindFiles(view),
          BYTE_ORDER_COVERAGE_ITEMS,
          `${view.label}: one \`uncovered-requirement\` item per uncovered ` +
            `required node of \`bare\` — the leaves p.U+1F600, p.U+FF21, and ` +
            `each \`x\`, no code source marking any — ordered by file path ` +
            `bytes, specs/base.mdx's two before specs/U+FF21.mdx's before ` +
            `specs/U+1F600.mdx's, never UTF-16 code-unit order (SPEC 10.7, ` +
            `8.1, 12.0)`,
        );
        assertSameJson(
          view.items
            .filter((item) => byteOrderFileOf(item.scope) !== BO.base)
            .map((item) => item.scope),
          BYTE_ORDER_X_SCOPES,
          `${view.label}: the last two items are the \`x\`s', ` +
            `specs/U+FF21.mdx#x's before specs/U+1F600.mdx#x's (SPEC 10.7, ` +
            `8.1, 12.0)`,
        );
      }

      await workspace.file(BO.base, BYTE_ORDER_CHILDLESS_BASE);
      const deletedContext =
        "T12.0-16 (e) the audit session, p.U+1F600 and p.U+FF21 then deleted";
      for (const view of await readByteOrderSession(
        product,
        workspace,
        BYTE_ORDER_AUDIT_SESSION,
        deletedContext,
      )) {
        if (view.withPresence) {
          const presenceOf = (scope: string): boolean | null =>
            view.items.find((item) => item.scope === scope)?.present ?? null;
          assertSameJson(
            [
              ...BYTE_ORDER_PRESENT_BASE_SCOPES,
              ...BYTE_ORDER_ABSENT_SCOPES,
            ].map(presenceOf),
            [true, true, false, false],
            `${view.label} — staging premise: specs/base.mdx's root's and ` +
              `\`p\`'s items present their scope nodes present, and the ` +
              `deleted children's items stay in the session with their scope ` +
              `nodes absent — in that order, \`null\` for a missing item ` +
              `(SPEC 10.4, 10.5: no re-derivation without an \`updated\` ` +
              `resolve)`,
          );
        }
        assertSameJson(
          byteOrderKindFiles(view),
          BYTE_ORDER_AUDIT_ITEMS,
          `${view.label}: the same items, still by scope-node file path ` +
            `bytes — specs/base.mdx's four, then specs/U+FF21.mdx's, then ` +
            `specs/U+1F600.mdx's (SPEC 10.6, 10.5, 12.0)`,
        );
        const baseScopes = view.items.slice(0, 4).map((item) => item.scope);
        assertSameJson(
          [...baseScopes.slice(0, 2)].sort(byteOrderCompare),
          BYTE_ORDER_PRESENT_BASE_SCOPES,
          `${view.label}: specs/base.mdx's present-scope items — its root's ` +
            `and \`p\`'s — come first among its items (SPEC 10.5: only a ` +
            `present scope node has a document position)`,
        );
        assertSameJson(
          baseScopes.slice(2),
          BYTE_ORDER_ABSENT_SCOPES,
          `${view.label}: the absent-scope items follow specs/base.mdx's ` +
            `present-scope ones, ordered by scope-node identity bytes — ` +
            `specs/base.mdx#p.U+FF21's (EF BC A1) before ` +
            `specs/base.mdx#p.U+1F600's (F0 9F 98 80), never UTF-16 ` +
            `code-unit order nor their former document order (SPEC 10.5, ` +
            `10.6, 12.0)`,
        );
      }
    },
  );
}

/**
 * (f)'s impact arm (SPEC 9.3, 12.0; T12.0-8), against (e)'s baseline after
 * its edit: `impact` reports src/U+FF21.ts directly impacted through its
 * edge to specs/base.mdx#p along the path specs/base.mdx#p →
 * specs/base.mdx#p.U+FF21, of the two equal-length paths to an edited child.
 */
async function expectByteOrderImpactTieBreak(
  product: ProductBinding,
  workspace: TestWorkspace,
  baseline: string,
): Promise<void> {
  const context =
    "T12.0-16 (f) `impact --base <baseline> --json` against (e)'s baseline, " +
    "after its edit";
  const report = await impactAgainst(product, workspace, baseline, context);
  const entry = report.code.direct.find(
    (candidate) => candidate.location === BO.fullACode,
  );
  if (entry === undefined) {
    fail(
      `${context}: src/U+FF21.ts is directly impacted — its marker's ` +
        `\`references\` edge targets specs/base.mdx#p, whose subtreeHash ` +
        `changed with its children's edited text (SPEC 9.2) — so it must be ` +
        `among the directly impacted code; got ` +
        JSON.stringify(
          report.code.direct.map((candidate) => candidate.location),
        ),
    );
  }
  assertSameJson(
    {
      edge: { from: entry.edge.from, to: entry.edge.to, kind: entry.edge.kind },
      path: entry.path,
    },
    {
      edge: { from: BO.fullACode, to: `${BO.base}#p`, kind: "references" },
      path: BYTE_ORDER_IMPACT_TIE.reported,
    },
    `${context}: src/U+FF21.ts's one impact edge, to specs/base.mdx#p, and ` +
      `its one shortest propagation path — of the two equal-length paths ` +
      `from \`p\` to an edited child, the element-wise byte-least: through ` +
      `#p.U+FF21 (EF BC A1), never #p.U+1F600 (F0 9F 98 80), which UTF-16 ` +
      `code-unit order would pick (SPEC 9.3, 12.0)`,
  );
}

/**
 * (f) Shortest-path tie-break on the built fixture (SPEC 12.0, 8.2, 11.1;
 * T12.0-8): `coverage pair` reports `p` covered through src/U+FF21.ts →
 * specs/base.mdx#p, of two direct candidates; and, with src/c.ts added
 * importing ../specs/U+FF21.xspec and ../specs/U+1F600.xspec and marking
 * each module's `x`, `query reachable --from src/c.ts --to
 * specs/base.mdx#p` reports the witness src/c.ts → specs/U+FF21.mdx#x →
 * specs/base.mdx#p. (f)'s impact arm runs on (e)'s path-blocks workspace
 * ({@link expectByteOrderImpactTieBreak}).
 */
async function expectByteOrderTieBreaks(
  product: ProductBinding,
): Promise<void> {
  await withBuiltByteOrderFixture(
    product,
    "T12.0-16 (f) coverage and reachable",
    async (workspace) => {
      const coverageContext = "T12.0-16 (f) `coverage pair --json`";
      const coverage = decodeCoverageReport(
        await runJson(
          product,
          workspace,
          ["coverage", "pair", "--json"],
          `${coverageContext} — informational without \`--check\`, exit 0 ` +
            `(SPEC 8.2, 12.0)`,
        ),
        coverageContext,
      );
      const profile = coverage.profiles.find((entry) => entry.name === "pair");
      const covered = profile?.covered.find(
        (entry) => entry.identity === `${BO.base}#p`,
      );
      if (covered === undefined) {
        fail(
          `${coverageContext}: \`p\` is \`pair\`'s one required node — it ` +
            `alone carries a \`targetTags\` tag — and each code source's ` +
            `marker reaches it by one direct edge, so the profile reports it ` +
            `covered (SPEC 8, 8.1, 8.2); got ` +
            JSON.stringify(
              coverage.profiles.map((entry) => ({
                name: entry.name,
                covered: entry.covered.map((node) => node.identity),
              })),
            ),
        );
      }
      assertSameJson(
        covered.path,
        BYTE_ORDER_COVERING_TIE.reported,
        `${coverageContext}: \`p\`'s one shortest covering path — of the two ` +
          `direct candidates, the element-wise byte-least: from ` +
          `src/U+FF21.ts (EF BC A1), never src/U+1F600.ts (F0 9F 98 80), ` +
          `which UTF-16 code-unit order would pick (SPEC 8.2, 12.0)`,
      );

      await workspace.file(BYTE_ORDER_C_CODE_PATH, BYTE_ORDER_C_CODE);
      const reachableContext =
        "T12.0-16 (f) `query reachable --from src/c.ts --to " +
        "specs/base.mdx#p`, src/c.ts added";
      const reachable = decodeReachableReport(
        await runJson(
          product,
          workspace,
          [
            "query",
            "reachable",
            "--from",
            BYTE_ORDER_C_CODE_PATH,
            "--to",
            `${BO.base}#p`,
          ],
          `${reachableContext} — a valid workspace's query answering, exit 0 ` +
            `(SPEC 11.1, 12.0)`,
        ),
        reachableContext,
      );
      if (!reachable.reachable) {
        fail(
          `${reachableContext}: src/c.ts marks each \`x\`, whose \`d\` ` +
            `edge targets \`p\`, so a dependency path exists (SPEC 11.1)`,
        );
      }
      assertSameJson(
        reachable.path,
        BYTE_ORDER_REACHABLE_TIE.reported,
        `${reachableContext}: the one shortest witness — of the two ` +
          `equal-length paths, the element-wise byte-least: through ` +
          `specs/U+FF21.mdx#x (EF BC A1), never specs/U+1F600.mdx#x (F0 9F ` +
          `98 80), which UTF-16 code-unit order would pick (SPEC 11.1, 12.0)`,
      );
    },
  );
}

const T12_0_16 = defineProductTest({
  id: "T12.0-16",
  title:
    "byte order, never UTF-16 order, on the separating pair U+FF21 (UTF-8 EF BC A1, UTF-16 FF21) and U+1F600 (UTF-8 F0 9F 98 80, UTF-16 D83D DE00) — byte order placing a string holding U+FF21 before the same string holding U+1F600, UTF-16 code-unit order the reverse — over the built fixture (spec group `specs` globbing specs/*.mdx, code group `src` globbing src/*.ts, emission enabled; profiles `pair` (`targets` all, `targetTags` configured [U+1F600, U+FF21]) and `bare`; rule `nope` forbidding `src` to `{ tags: [U+1F600, U+FF21] }`; specs/base.mdx's `p` spelled tags=\"U+1F600 U+FF21\", its children p.U+1F600 then p.U+FF21 in document order, the reverse of byte order; specs/U+FF21.mdx and specs/U+1F600.mdx each importing ./base.xspec as BASE, their `x` spelling d={BASE.p}; src/U+FF21.ts and src/U+1F600.ts each marking BASE.p at top level), every pinned list differing from its UTF-16 code-unit sort (a harness-side self-check): (a) tag sets — `view` reports `p`'s `tags` exactly [U+FF21, U+1F600], and `inventory` `pair`'s `targetTags` and `nope`'s `tags` selector list each exactly so; (b) file orders — `view`, bare and with the operands specs/U+1F600.mdx specs/base.mdx specs/U+FF21.mdx, orders its views specs/base.mdx, specs/U+FF21.mdx, specs/U+1F600.mdx (each tree's children in document order), `ids` lists the files in that order, `inventory` lists `sources` specs/base.mdx, specs/U+FF21.mdx, specs/U+1F600.mdx, src/U+FF21.ts, src/U+1F600.ts, `derived` in that order of `source`, and `recorded` with every specs/U+FF21. path before every specs/U+1F600. path, and `occurrences` orders its records by referencing file specs/U+FF21.mdx, specs/U+1F600.mdx, src/U+FF21.ts, src/U+1F600.ts; (c) findings — `check` reports exactly `nope`'s two condition-12 findings (`locations` [], `path` null), src/U+FF21.ts's edge first by identities; with specs/U+FF21.xspec.ts and specs/U+1F600.xspec.ts altered, their per-file condition-10 findings, specs/U+FF21.xspec.ts's first by concerned path, beside the two; on a twin whose `x`s spell d={BASE.missing}, `build` and `check` exactly the two condition-5 findings, specs/U+FF21.mdx's first by locations; and on a twin whose two `x`-holding sources each also import the other's module, the binding unused, `check` exactly the spec import cycle's one condition-9 finding, its locations placing specs/U+FF21.mdx's declaration before specs/U+1F600.mdx's; (d) previews — `rename specs/base.mdx p q --preview` reports `mapping` ordered by `from` (specs/base.mdx#p, #p.U+FF21, #p.U+1F600) and `files` ordered specs/base.mdx, specs/U+FF21.mdx, specs/U+1F600.mdx, src/U+FF21.ts, src/U+1F600.ts, the performed rename the same `mapping`; with graph data deleted, the same preview's `delta` `generated` holds every derived path, every specs/U+FF21. path before every specs/U+1F600. path, and on the built fixture with `specs`' glob narrowed to specs/base.mdx and no rebuild its `removed` likewise; (e) review items, each order as `status` and `export` present it — with the built fixture committed as the baseline and p.U+1F600's and p.U+FF21's own text edited, a `path-blocks` session's depth-1 `dependency-consistency` items specs/U+FF21.mdx#x's before specs/U+1F600.mdx#x's and its `code-impact` items src/U+FF21.ts's before src/U+1F600.ts's; an `audit` session on the built fixture specs/base.mdx's items, then specs/U+FF21.mdx's, then specs/U+1F600.mdx's, and, p.U+1F600 and p.U+FF21 then deleted, their absent-scope items after specs/base.mdx's present-scope ones, specs/base.mdx#p.U+FF21's first; and a `coverage` session over `bare` its `uncovered-requirement` items specs/U+FF21.mdx#x's before specs/U+1F600.mdx#x's; (f) shortest-path tie-break — `coverage pair` reports `p` covered through src/U+FF21.ts → specs/base.mdx#p, of two direct candidates; `impact` against (e)'s baseline, after its edit, src/U+FF21.ts directly impacted through its edge to specs/base.mdx#p along specs/base.mdx#p → specs/base.mdx#p.U+FF21, of the two equal-length paths to an edited child; and, with src/c.ts added importing ../specs/U+FF21.xspec and ../specs/U+1F600.xspec and marking each module's `x`, `query reachable --from src/c.ts --to specs/base.mdx#p` the witness src/c.ts → specs/U+FF21.mdx#x → specs/base.mdx#p — every order form-exact on 12.7's documents and through the H-3 decode elsewhere (SPEC 12.0, 12.7, 11.4, 11.6, 12.3, 5.7, 6.4, 6.6, 8.2, 9.3, 10.5, 10.6, 10.7, 11.1, 14.5, 14.9, 14.10, 14.12)",
  run: async (product) => {
    checkByteOrderFixtureStaging();
    const workspace = await stageByteOrderFixture(product, "T12.0-16");
    try {
      const reads = await expectByteOrderTagSets(product, workspace);
      await expectByteOrderFileOrders(product, workspace, reads);
      await expectByteOrderCheckFindings(product, workspace);
    } finally {
      await workspace.dispose();
    }
    await expectByteOrderUnresolvedTwin(product);
    await expectByteOrderImportCycleTwin(product);
    await expectByteOrderPreviews(product);
    await expectByteOrderPathBlocks(product);
    await expectByteOrderAuditAndCoverage(product);
    await expectByteOrderTieBreaks(product);
  },
});

export const section120iiiTests: readonly ProductTestEntry[] = [
  T12_0_14,
  T12_0_16,
];
