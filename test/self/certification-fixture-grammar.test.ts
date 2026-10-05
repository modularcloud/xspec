// The certification fixtures' invocation grammar and JSON error delivery
// (CERTIFICATIONS.md preamble, third paragraph; SPEC 12.0, 12.7, 14).
//
// CERTIFICATIONS.md requires every conformer, whatever its scope, to read its
// arguments under the invocation grammar of 12.0 — flag tokens standing
// anywhere, a value-taking flag taking the whole next token whatever it looks
// like, arity fixed by name across commands, the remaining tokens matching
// the synopsis exactly, a surplus operand a usage error — and, with JSON in
// effect, to report every usage error in the exit-2 error document of 12.7:
// "the grammar is universal (12.0), so no in-scope usage-error assertion is
// left to a fixture's own parser". Certification exercises only the
// spellings its in-scope tests happen to use, so this guard pins the grammar
// itself: one test per conformer, each running a table of rows through the
// subprocess driver against the conformer's binding from
// CERTIFICATION_FIXTURES. A violator runs its conformer's `product.mjs` with
// one deviation switch, so the conformer's reader is its violators' too.
//
// A row names an argv and the outcome SPEC fixes for it — derived from 12.0,
// 12.7, and 14, its clause quoted in the row, never read off a fixture's
// current output: the exit code; standard output byte-empty, the 12.7 error
// document (decoded form-exact, its finding's `code` and `path` asserted and
// its `locations` empty), a document the surface's adapter decodes, or
// byte-equal to a canonical spelling's answer over the same state; and, for
// a `--test-hold` row, whether the hold file exists afterwards (13.5). Every
// row runs in a fresh workspace staged from its table's declaration before
// any invocation, so a row that writes (`build`) never changes another row's
// state; a canonical spelling runs in a twin staged the same way, and the
// two workspaces' after-states must then be byte-identical (12.0's
// determinism). An exit-2 row carries its message on standard error (12.0)
// and leaves its workspace byte-for-byte unchanged: a syntax-class error is
// reported from the arguments alone, without loading configuration (12.0),
// and a `build` failing with a configuration error modifies nothing (12.1).
//
// Every row of a table runs, and the test then fails once listing every
// failing row, so a red check shows each deviation in one run. Anything but
// a diagnosed assertion failure (`HarnessAssertionError`) — a hang guard's
// kill, an output overflow, a staging error — propagates at once: it is a
// harness defect, never a row's verdict.
//
// Run: `npx vitest run --config test/vitest.config.ts --project self
// test/self/certification-fixture-grammar.test.ts`, under the unprivileged
// namespace as the whole self project runs (AGENTS.md).

import { test } from "vitest";
import {
  decodeErrorDocument,
  decodeFindingsReport,
} from "../helpers/adapters/index.js";
import {
  assertBytesEqual,
  assertExitCode,
  assertStdoutEmpty,
  fail,
  HarnessAssertionError,
  parseJsonStdout,
} from "../helpers/assertions.js";
import {
  assertDirectoriesEqual,
  assertSnapshotsEqual,
  snapshotDirectory,
} from "../helpers/snapshot.js";
import { pathExists, runProduct } from "../helpers/subprocess.js";
import type { ProductBinding, RunResult } from "../helpers/subprocess.js";
import { TestWorkspace } from "../helpers/workspace.js";
import type { WorkspaceDecl } from "../helpers/workspace.js";
import { CERTIFICATION_FIXTURES } from "./certification-fixtures.js";

/** A decoder of a surface's document (H-3): fails diagnosed, never defaults. */
type DocumentCheck = (doc: unknown, context: string) => void;

/** The standard output SPEC fixes for a row (12.0, 12.7). */
type StdoutExpectation =
  /**
   * Byte-empty: an exit-2 error with JSON output not in effect (12.0), or a
   * human-form answer the row compares no further.
   */
  | { readonly form: "empty" }
  /**
   * The exit-2 error document of 12.7, `{"error": …}` exactly: its finding's
   * `code` and `path` as given — both `null` for a plain usage error, the
   * stable code and concerned path for a configuration, write, or read
   * failure (14.14, 14.24, 14.25) — and no locations (12.7, 14).
   */
  | {
      readonly form: "error-document";
      readonly code: string | null;
      readonly path: string | null;
    }
  /** One document of the invoked surface, judged by its adapter. */
  | { readonly form: "document"; readonly check: DocumentCheck }
  /**
   * Byte-equal to the answer of `canonical` — the same invocation spelled
   * canonically — over the same state: run in a twin workspace staged from
   * the same declaration, with the row's exit code, its document judged by
   * `check` when given, and the two after-states byte-identical.
   */
  | {
      readonly form: "like";
      readonly canonical: readonly string[];
      readonly check?: DocumentCheck;
    };

/** One invocation and the outcome SPEC fixes for it. */
interface GrammarRow {
  /** The arguments after the executable, passed verbatim. */
  readonly argv: readonly string[];
  /** The clause fixing the outcome, quoted (SPEC, CERTIFICATIONS.md). */
  readonly clause: string;
  /** The exit code SPEC 12.0 fixes. */
  readonly exit: 0 | 1 | 2;
  readonly stdout: StdoutExpectation;
  /**
   * A `--test-hold` row: the hold file's path, relative to the working
   * directory (12.0), and whether the invocation leaves it created (13.5).
   */
  readonly hold?: { readonly path: string; readonly created: boolean };
}

/** One conformer's rows over one staged workspace shape. */
interface GrammarTable {
  /** The conformer's `## CONF-…` name in CERTIFICATION_FIXTURES. */
  readonly conformer: string;
  /** Staged afresh for every row, and for every canonical twin. */
  readonly staging: WorkspaceDecl;
  readonly rows: readonly GrammarRow[];
}

const EMPTY: StdoutExpectation = { form: "empty" };

/** The plain usage error's document: `code` and `path` `null` (12.7). */
const PLAIN_USAGE_ERROR: StdoutExpectation = {
  form: "error-document",
  code: null,
  path: null,
};

function like(
  canonical: readonly string[],
  check?: DocumentCheck,
): StdoutExpectation {
  return check === undefined
    ? { form: "like", canonical }
    : { form: "like", canonical, check };
}

/**
 * A finding-free `build` or `check` report: `{"findings": []}` (12.7: a
 * report whose defined content is findings alone; a finding-free answer's
 * `findings` is `[]`), the answer of an exit-0 run with JSON in effect.
 */
const findingFreeReport: DocumentCheck = (doc, context) => {
  const report = decodeFindingsReport(doc, context);
  if (report.findings.length > 0) {
    fail(
      `${context}: an exit-0 build or check report carries no findings ` +
        `(SPEC 12.0's exit partition, 12.7), but it carries ` +
        `${String(report.findings.length)}: ` +
        JSON.stringify(report.findings.map((finding) => finding.code)),
    );
  }
};

function conformerBinding(name: string): ProductBinding {
  const entry = CERTIFICATION_FIXTURES.find((fixture) => fixture.name === name);
  if (entry === undefined) {
    throw new Error(
      `grammar table names ${name}, which CERTIFICATION_FIXTURES does not list`,
    );
  }
  return entry.binding();
}

function spell(argv: readonly string[]): string {
  return argv.length === 0 ? "(no arguments)" : `\`${argv.join(" ")}\``;
}

/** Run every row of a table, then fail once listing each failing row. */
async function runGrammarTable(table: GrammarTable): Promise<void> {
  const binding = conformerBinding(table.conformer);
  const failures: string[] = [];
  for (const row of table.rows) {
    try {
      await checkRow(binding, table, row);
    } catch (error) {
      if (!(error instanceof HarnessAssertionError)) throw error;
      // The row's spelling heads its entry: an adapter's decode failure
      // names its site first and the row's context only within it.
      failures.push(
        `- ${spell(row.argv)}: ${error.message.replaceAll("\n", "\n    ")}`,
      );
    }
  }
  if (failures.length > 0) {
    fail(
      `${table.conformer}: ${String(failures.length)} of ` +
        `${String(table.rows.length)} invocation-grammar rows fail ` +
        `(CERTIFICATIONS.md preamble: every conformer reads its arguments ` +
        `under the invocation grammar of 12.0 and, with JSON in effect, ` +
        `reports every usage error in the exit-2 error document of 12.7):\n` +
        failures.join("\n"),
    );
  }
}

/** Run one row in a fresh workspace and assert the outcome it names. */
async function checkRow(
  binding: ProductBinding,
  table: GrammarTable,
  row: GrammarRow,
): Promise<void> {
  const context = `${table.conformer} ${spell(row.argv)} (${row.clause})`;
  const workspace = await TestWorkspace.create(table.staging);
  try {
    const before = await snapshotDirectory(workspace.root);
    const result = await runProduct(binding, {
      cwd: workspace.root,
      argv: row.argv,
    });
    assertExitCode(result, row.exit, context);
    if (row.exit === 2) {
      if (result.stderrBytes.length === 0) {
        fail(
          `${context}: usage and configuration error messages (exit 2) ` +
            `are standard-error content (SPEC 12.0), but stderr is empty`,
        );
      }
      assertSnapshotsEqual(
        before,
        await snapshotDirectory(workspace.root),
        `${context}: an exit-2 error modifies nothing — a syntax-class ` +
          `error is reported from the arguments alone, without loading ` +
          `configuration (SPEC 12.0), and a build failing with a ` +
          `configuration error modifies nothing (12.1)`,
      );
    }
    await checkStdout(binding, table, row, workspace, result, context);
    if (row.hold !== undefined) {
      const created = await pathExists(workspace.path(row.hold.path));
      if (created !== row.hold.created) {
        fail(
          `${context}: the hold file ${JSON.stringify(row.hold.path)} ` +
            (row.hold.created
              ? "was not created (SPEC 13.5)"
              : "was created, though the invocation is refused before " +
                "any acquisition or hold (SPEC 12.0, 13.5)"),
        );
      }
    }
  } finally {
    await workspace.dispose();
  }
}

async function checkStdout(
  binding: ProductBinding,
  table: GrammarTable,
  row: GrammarRow,
  workspace: TestWorkspace,
  result: RunResult,
  context: string,
): Promise<void> {
  const expectation = row.stdout;
  switch (expectation.form) {
    case "empty":
      assertStdoutEmpty(result, context);
      return;
    case "error-document": {
      const { error } = decodeErrorDocument(
        parseJsonStdout(
          result,
          `${context} — with JSON output in effect, an exit-2 invocation ` +
            `emits the 12.7 error document as its entire stdout (SPEC 12.0)`,
        ),
        context,
      );
      const actual = JSON.stringify({
        code: error.code,
        path: error.path,
        locations: error.locations,
      });
      const expected = JSON.stringify({
        code: expectation.code,
        path: expectation.path,
        locations: [],
      });
      if (actual !== expected) {
        fail(
          `${context}: the error document's finding must carry ${expected} ` +
            `(SPEC 12.7: for a plain usage error \`code\` and \`path\` ` +
            `null; for a configuration, write, or read failure its stable ` +
            `code and concerned path; 14: no in-source location), but it ` +
            `carries ${actual} (message: ${JSON.stringify(error.message)})`,
        );
      }
      return;
    }
    case "document":
      expectation.check(parseJsonStdout(result, context), context);
      return;
    case "like": {
      const twin = await TestWorkspace.create(table.staging);
      try {
        const canonicalContext = `${context}: the canonical spelling ${spell(expectation.canonical)}`;
        const canonical = await runProduct(binding, {
          cwd: twin.root,
          argv: expectation.canonical,
        });
        assertExitCode(canonical, row.exit, canonicalContext);
        if (expectation.check !== undefined) {
          expectation.check(
            parseJsonStdout(canonical, canonicalContext),
            canonicalContext,
          );
        }
        assertBytesEqual(
          result.stdoutBytes,
          canonical.stdoutBytes,
          `${context}: standard output, against the canonical spelling ` +
            `${spell(expectation.canonical)}'s over the same state`,
        );
        await assertDirectoriesEqual(
          twin.root,
          workspace.root,
          `${context}: the workspace after the run, against the canonical ` +
            `spelling ${spell(expectation.canonical)}'s (first) over the ` +
            `same staging`,
        );
      } finally {
        await twin.dispose();
      }
      return;
    }
  }
}

// --- the clauses the rows cite (SPEC 12.0, 12.7, 13.5, 14) --------------------

const UNKNOWN_FLAG =
  'SPEC 12.0: "any `--` token naming no flag the command accepts — the ' +
  "flags its synopsis or defining section names, plus the global `--json` " +
  "and `--config` and, for a mutating command, `--test-hold` (13.5 …) — is " +
  'an unknown flag, a usage error"';
const NOT_MUTATING =
  "13.5: the mutating commands are `rename` and `move`, their `--preview` " +
  "invocations excepted, and the mutating `review` subcommands";
const ARITY_BY_NAME =
  "SPEC 12.0: \"A flag's arity is fixed by its name, the same for every " +
  'command — known before the command word is identified"';
const JSON_IN_EFFECT =
  'SPEC 12.0: JSON output is in effect exactly when "a `--json` token ' +
  'read as a flag, not as another flag\'s value" is given, "governing ' +
  'error delivery even when the arguments are themselves the error"';
const NO_JSON_EMPTY =
  'SPEC 12.0: "When JSON output is not in effect, an exit-2 error leaves ' +
  'standard output empty"';
const PLAIN_DOCUMENT =
  '12.7: the exit-2 error document carries, "for a plain usage error, ' +
  '`code` and `path` `null`"';
const DASH_DASH =
  'SPEC 12.0: "The token `--` ends flag reading: it is dropped, and every ' +
  'later token is a non-flag token, `--`-prefixed spellings included"';
const SURPLUS =
  'SPEC 12.0: "more operands than the synopsis admits … is a usage error ' +
  'of the syntax class … a surplus token is never accepted and ignored"';

// --- CONF-ORPHAN (CERTIFICATIONS.md §CONF-ORPHAN: `build` and `check`) --------

/**
 * One spec group of one trivial single-section source, as §CONF-ORPHAN's
 * scope admits (its staging constraint: the spec glob matches `.mdx` names
 * alone), Markdown emission absent: a valid workspace `build` regenerates.
 */
const ORPHAN_STAGING: WorkspaceDecl = {
  files: {
    "xspec.config.ts": `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/*.mdx"]
  }
})
`,
    "specs/A.mdx": `<S id="a">
Alpha text.
</S>
`,
  },
};

const ORPHAN_TABLE: GrammarTable = {
  conformer: "CONF-ORPHAN",
  staging: ORPHAN_STAGING,
  rows: [
    // `--test-hold` beside a command that is not mutating (13.5).
    {
      argv: ["build", "--test-hold", "h"],
      clause: `${UNKNOWN_FLAG}, \`build\` not mutating (${NOT_MUTATING}); ${NO_JSON_EMPTY}`,
      exit: 2,
      stdout: EMPTY,
      hold: { path: "h", created: false },
    },
    {
      argv: ["build", "--test-hold", "--json"],
      clause: `${ARITY_BY_NAME}: \`--test-hold\` takes \`--json\` as its value (CERTIFICATIONS.md preamble: "so \`build --test-hold --json\` consumes \`--json\` as its value and leaves JSON out of effect"), and is \`build\`'s unknown flag; ${NO_JSON_EMPTY}`,
      exit: 2,
      stdout: EMPTY,
      hold: { path: "--json", created: false },
    },
    {
      argv: ["build", "--test-hold", "h", "--json"],
      clause: `${UNKNOWN_FLAG}, \`build\` not mutating (${NOT_MUTATING}); ${JSON_IN_EFFECT}; ${PLAIN_DOCUMENT}`,
      exit: 2,
      stdout: PLAIN_USAGE_ERROR,
      hold: { path: "h", created: false },
    },
    {
      argv: ["check", "--test-hold", "h", "--json"],
      clause: `${UNKNOWN_FLAG}, \`check\` not mutating (${NOT_MUTATING}); ${JSON_IN_EFFECT}; ${PLAIN_DOCUMENT}`,
      exit: 2,
      stdout: PLAIN_USAGE_ERROR,
      hold: { path: "h", created: false },
    },
    {
      argv: ["--test-hold", "h", "build"],
      clause: `${ARITY_BY_NAME}: before the command word \`--test-hold\` takes \`h\`, and \`build\` is the command, whose unknown flag it is (${UNKNOWN_FLAG}); ${NO_JSON_EMPTY}`,
      exit: 2,
      stdout: EMPTY,
      hold: { path: "h", created: false },
    },
    // The grammar's other rules over `build`.
    {
      argv: ["--json", "build"],
      clause:
        'SPEC 12.0: "Flag tokens may stand anywhere among the arguments — ' +
        'before the command word, between it and its operands, or after them"',
      exit: 0,
      stdout: like(["build", "--json"], findingFreeReport),
    },
    {
      argv: ["build", "--json", "--"],
      clause: DASH_DASH,
      exit: 0,
      stdout: like(["build", "--json"], findingFreeReport),
    },
    {
      argv: ["--", "build"],
      clause: `${DASH_DASH}: the command word included`,
      exit: 0,
      stdout: like(["build"]),
    },
    {
      argv: ["build", "--", "--json"],
      clause: `${DASH_DASH}, so \`--json\` is no flag but \`build\`'s surplus operand (${SURPLUS}); ${NO_JSON_EMPTY}`,
      exit: 2,
      stdout: EMPTY,
    },
    {
      argv: ["build", "extra", "--json"],
      clause: `${SURPLUS}; ${JSON_IN_EFFECT}; ${PLAIN_DOCUMENT}`,
      exit: 2,
      stdout: PLAIN_USAGE_ERROR,
    },
    {
      argv: ["build", "--json", "--json"],
      clause:
        'SPEC 12.0: "repeating a flag is a usage error", and "a repeated ' +
        '`--json`, itself a usage error, still puts it in effect"; ' +
        PLAIN_DOCUMENT,
      exit: 2,
      stdout: PLAIN_USAGE_ERROR,
    },
    {
      argv: ["build", "--json", "--config"],
      clause:
        'SPEC 12.0: a flag that takes a value "lacks its value, a usage ' +
        `error, when no token follows"; ${JSON_IN_EFFECT}; ${PLAIN_DOCUMENT}`,
      exit: 2,
      stdout: PLAIN_USAGE_ERROR,
    },
    {
      argv: ["build", "--config=x", "--json"],
      clause:
        'SPEC 12.0: "`--name=value` is not a spelling of any flag" — an ' +
        'unknown flag — and "a `--` token naming no flag of any command ' +
        'takes no value", so the `--json` after it is read as a flag; ' +
        PLAIN_DOCUMENT,
      exit: 2,
      stdout: PLAIN_USAGE_ERROR,
    },
    {
      argv: ["build", "--json", "--config", "--json"],
      clause:
        'SPEC 12.0: a value-taking flag "takes the whole next token as its ' +
        'value, whatever that token looks like", so `--config` names the ' +
        'path `--json`; 14: "a `--config` path nothing occupies … is ' +
        'reported as the argument value exactly as given" in a configuration ' +
        "error (14.14), `configuration-error`",
      exit: 2,
      stdout: {
        form: "error-document",
        code: "configuration-error",
        path: "--json",
      },
    },
  ],
};

// --- the tests ----------------------------------------------------------------

/**
 * A hang guard only (H-10): a table runs a few dozen fixture invocations,
 * each bounded by the driver's own hang guard.
 */
const TABLE_TIMEOUT_MS = 120_000;

const GRAMMAR_TABLES: readonly GrammarTable[] = [ORPHAN_TABLE];

for (const table of GRAMMAR_TABLES) {
  test(
    `${table.conformer} reads its arguments under SPEC 12.0's invocation ` +
      "grammar and reports usage errors in the 12.7 error document " +
      "(CERTIFICATIONS.md preamble)",
    async () => {
      await runGrammarTable(table);
    },
    TABLE_TIMEOUT_MS,
  );
}
