// TEST-SPEC §12.0 III (global command conventions, third part) — SUITE-42
// continued: T12.0-14 (invocation grammar).
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
// dropped; flag tokens stand anywhere; the remaining tokens must match the
// synopsis exactly (no command word, an unknown command or subcommand, a
// missing operand, a surplus operand — never accepted and ignored); a flag
// may be given at most once; a flag's arity is fixed by its name across
// commands and known before the command word; list-valued flags take one
// comma-separated value (11.1).
//
// Conservative operationalizations (noted per H-3/H-4):
// - "Behaves as `ids`" and "byte-identical documents" are H-4's
//   product-to-itself compare: the same exit code and byte-identical stdout
//   for the two spellings on one fixture.
// - "JSON out of effect, stdout not a JSON document" (`ids --file --json`)
//   is asserted as: exit 0, stdout that does not parse as a JSON document
//   (an empty human listing included — the human form is unpinned, H-3),
//   and byte-identical to the human listing of a glob matching nothing —
//   with the premise that a matching glob restricts the listing (12.3), so
//   the pair is attributable to the glob `--json` being in effect.
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
//   `--config` being read as the global flag with its value.
// - `review create --strategy audit --name -a`: the session file's presence
//   at `.xspec/reviews/-a.json` (10.1) plus the session answering `next`;
//   `resolve … --note -x` is observed through `review show … --json`'s
//   `note` member (10.2, 10.7).
// - The `--kinds` arms run on `query edges` (JSON-only, 11), so the plain
//   usage error's document is on stdout with no `--json` given; the collapse
//   pair (`depends,depends` against `depends`) is the byte-identical compare
//   T11-4 pins in full.

import {
  decodeItemReport,
  decodeNextReport,
} from "../../helpers/adapters/index.js";
import {
  assertBytesEqual,
  assertStdoutEmpty,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import {
  assertLeavesUnchanged,
  diffSnapshots,
  snapshotDirectory,
} from "../../helpers/snapshot.js";
import type { ProductBinding, RunResult } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { WorkspaceDecl } from "../../helpers/workspace.js";
import { SPECS_ONLY_CONFIG } from "./section-5.6.js";
import {
  buildOk,
  expectConfigurationError,
  expectExit,
  expectPlainUsageError,
  runCli,
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

/** The grammar fixture's one spec source: a root node holding `a`. */
const GRAMMAR_SPEC_FILE = "specs/A.mdx";
const GRAMMAR_SOURCE = '<S id="a">\nAlpha text.\n</S>\n';
const GRAMMAR_FILES: Readonly<Record<string, string>> = {
  "xspec.config.ts": SPECS_ONLY_CONFIG,
  [GRAMMAR_SPEC_FILE]: GRAMMAR_SOURCE,
};
/** A `--file` glob inside the root (7) that matches no discovered file. */
const GRAMMAR_NO_MATCH_GLOB = "no-such-dir/*.mdx";
/** The `--config` arm's configuration, whose directory is the root (7). */
const GRAMMAR_CONFIG_DIR = "cfg";
const GRAMMAR_CONFIG_PATH = `${GRAMMAR_CONFIG_DIR}/xspec.config.ts`;
const GRAMMAR_CONFIG_FILES: Readonly<Record<string, string>> = {
  [GRAMMAR_CONFIG_PATH]: SPECS_ONLY_CONFIG,
  [`${GRAMMAR_CONFIG_DIR}/specs/B.mdx`]: '<S id="b">\nBeta text.\n</S>\n',
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

const T12_0_14 = defineProductTest({
  id: "T12.0-14",
  title:
    "invocation grammar (12.0's token rules, each arm discriminating a lenient parser): the remaining tokens match the synopsis exactly — `ids extra` and `rename specs/A.mdx a b c` (a fourth operand) exit 2 with nothing done (whole root byte-unchanged, journal and sources included), `xspec` alone and `query bogus` exit 2; `--name=value` spells no flag (`review create --strategy audit --name=n` exits 2 as an unknown flag, no session created); flag tokens stand anywhere (`--json ids` and `ids --json` emit byte-identical documents; `--config cfg/xspec.config.ts build` loads that configuration, exit 0 with derived output under `cfg/` alone where `build` alone is a configuration error); a value-taking flag takes the whole next token (`ids --file --json` runs with the glob `--json` — exit 0, an empty listing byte-identical to a no-match glob's, stdout not a JSON document; `ids --config --json` names the path `--json` — exit 2, missing configuration, stdout empty, the diagnostic on stderr — where `ids --json --config` exits 2 with the error document on stdout; `ids --file` as the last token exits 2); no single-dash short forms (`review create --strategy audit --name -a` creates `.xspec/reviews/-a.json`, `resolve … --note -x` stores the note `-x`, `ids -j` exits 2 as a surplus operand with stdout empty); `--` ends flag reading and is dropped (`ids --` byte-identical to `ids`; `ids -- --json` exits 2 with stdout empty); arity is fixed by name across commands (`build --file --json` exits 2 having consumed `--json`, stdout empty; `build --bogus --json` and `build --json --file` exit 2 with the error document; each modifying nothing); a repeated `--json` exits 2 with the error document as its entire stdout; list-valued flags: `--kinds depends,`, `,depends`, and `depends,,embeds` each exit 2 with the error document while `depends,depends` answers byte-identically to `depends` (SPEC 12.0, 12.3, 12.1, 10.1, 10.7, 11.1, 7, 12.7)",
  timeoutMs: 180_000,
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
      // Premise: a `--file` glob restricts the listing (SPEC 12.3), so the
      // no-match listing differs from the full one and the pair below is
      // attributable to the glob `--json` being in effect.
      const noMatch = await expectExit(
        product,
        workspace,
        ["ids", "--file", GRAMMAR_NO_MATCH_GLOB],
        0,
        `T12.0-14 premise \`ids --file ${GRAMMAR_NO_MATCH_GLOB}\` — a glob ` +
          `inside the root matching no discovered file restricts the ` +
          `listing to nothing: an empty listing, exit 0 (SPEC 12.3, 7)`,
      );
      if (
        noMatch.stdoutBytes.length === idsHuman.stdoutBytes.length &&
        noMatch.stdoutBytes.every(
          (byte, index) => byte === idsHuman.stdoutBytes[index],
        )
      ) {
        fail(
          `T12.0-14 premise \`ids --file ${GRAMMAR_NO_MATCH_GLOB}\`: the ` +
            `listing restricted to no file carries no file, so its bytes ` +
            `must differ from the unrestricted listing's — \`--file\` ` +
            `restricts the listing to the files the glob matches (SPEC ` +
            `12.3); got the unrestricted listing`,
        );
      }
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
      assertBytesEqual(
        fileJson.stdoutBytes,
        noMatch.stdoutBytes,
        `${fileJsonContext} against \`ids --file ${GRAMMAR_NO_MATCH_GLOB}\`: ` +
          `both are the human-form empty listing of a glob matching nothing ` +
          `— byte-identical standard output, JSON output out of effect in ` +
          `each (SPEC 12.0, 12.3; H-4's product-to-itself compare)`,
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
    });

    // --- `--config <path>` before the command word loads that
    // configuration: the root holds none (the premise below), so an exit-0
    // `build` writing derived output under `cfg/` alone is attributable to
    // the leading flag and its value (SPEC 12.0, 7).
    await withWorkspace({ files: GRAMMAR_CONFIG_FILES }, async (workspace) => {
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

export const section120iiiTests: readonly ProductTestEntry[] = [T12_0_14];
