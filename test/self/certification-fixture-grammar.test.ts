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
  decodeEdgesReport,
  decodeErrorDocument,
  decodeFindingsReport,
  decodeIdsReport,
  decodeInventoryDocument,
  decodeOccurrencesReport,
  decodeViewReport,
} from "../helpers/adapters/index.js";
import type {
  Finding,
  GraphEdge,
  IdsFileEntry,
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

/** A document's `findings` member is `[]`, as `premise` states. */
function assertNoFindings(
  findings: readonly Finding[],
  context: string,
  premise: string,
): void {
  if (findings.length > 0) {
    fail(
      `${context}: ${premise}, but it carries ` +
        `${String(findings.length)}: ` +
        JSON.stringify(findings.map((finding) => finding.code)),
    );
  }
}

/**
 * A finding-free `build` or `check` report: `{"findings": []}` (12.7: a
 * report whose defined content is findings alone; a finding-free answer's
 * `findings` is `[]`), the answer of an exit-0 run with JSON in effect.
 */
const findingFreeReport: DocumentCheck = (doc, context) => {
  assertNoFindings(
    decodeFindingsReport(doc, context).findings,
    context,
    "an exit-0 build or check report carries no findings (SPEC 12.0's " +
      "exit partition, 12.7)",
  );
};

/** An exit-0 answer of a query surface is complete and finding-free (11.2). */
const FINDING_FREE_ANSWER =
  "an exit-0 answer is complete and finding-free (SPEC 11.2, 12.0's exit " +
  "partition)";

/**
 * A `view` answer (11.4, 12.7), finding-free, holding exactly the per-file
 * views of `files`, in byte order of path; `text` says whether `--text` is
 * in effect, so whether every node carries its own and subtree text.
 */
function viewOf(files: readonly string[], text: boolean): DocumentCheck {
  return (doc, context) => {
    const report = decodeViewReport(doc, { text }, context);
    assertNoFindings(report.findings, context, FINDING_FREE_ANSWER);
    const actual = JSON.stringify(report.views.map((view) => view.file));
    const expected = JSON.stringify(files);
    if (actual !== expected) {
      fail(
        `${context}: the view document holds the per-file views of ` +
          `${expected} (SPEC 11.4: the requested files, in byte order of ` +
          `path), but it holds those of ${actual}`,
      );
    }
  };
}

/**
 * An `occurrences` answer (11.3, 12.7), finding-free, its records' targets
 * exactly `targets`, in occurrence order (5.7).
 */
function occurrencesOf(targets: readonly string[]): DocumentCheck {
  return (doc, context) => {
    const report = decodeOccurrencesReport(doc, context);
    assertNoFindings(report.findings, context, FINDING_FREE_ANSWER);
    const actual = JSON.stringify(
      report.occurrences.map((record) => record.target),
    );
    const expected = JSON.stringify(targets);
    if (actual !== expected) {
      fail(
        `${context}: the occurrences document's records target ${expected} ` +
          `in occurrence order (SPEC 11.3, 5.7), but they target ${actual}`,
      );
    }
  };
}

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
const FLAGS_ANYWHERE =
  'SPEC 12.0: "Flag tokens may stand anywhere among the arguments — ' +
  'before the command word, between it and its operands, or after them"';
const NO_COMMAND =
  'SPEC 12.0: "no command word, an unknown command or subcommand, a ' +
  "missing operand, or more operands than the synopsis admits … is a " +
  'usage error of the syntax class"';
const WHOLE_NEXT_TOKEN =
  'SPEC 12.0: a value-taking flag "takes the whole next token as its ' +
  "value, whatever that token looks like — a value beginning with `-` or " +
  '`--` included"';
const MISSING_VALUE =
  'SPEC 12.0: a flag that takes a value "lacks its value, a usage error, ' +
  'when no token follows"';
const NO_VALUE_UNLESS_KNOWN =
  'SPEC 12.0: "a `--` token naming no flag of any command takes no value"';
const REPEATED =
  'SPEC 12.0: "repeating a flag is a usage error", and "a repeated ' +
  '`--json`, itself a usage error, still puts it in effect"';
/** SPEC 12.0's JSON-only rule, naming the row's surfaces among them. */
function jsonOnly(surfaces: string): string {
  return (
    'SPEC 12.0: JSON output is in effect also "when the invoked surface is ' +
    "JSON-only, a single JSON document its only output form with or without " +
    `\`--json\` (10.7, 11, 12.6)" — ${surfaces} among them (11)`
  );
}
const JSON_ONLY = jsonOnly("`view` and `occurrences`");
const MALFORMED =
  'SPEC 12.0: "An argument value is well-formed only when its bytes are ' +
  "valid UTF-8 and it contains no U+FFFD (REPLACEMENT CHARACTER); any " +
  "other argument value is a malformed value — a usage error of the " +
  'syntax class (below), judged before every per-flag and per-operand check"';
const CONFIG_AS_GIVEN =
  'SPEC 14: "a `--config` path nothing occupies … is reported as the ' +
  'argument value exactly as given (12.0)" in a configuration error ' +
  "(14.14), `configuration-error`";
const SUBCOMMAND_ORDER =
  'SPEC 12.0: "once the flags, their values, and any `--` are removed, the ' +
  "remaining tokens are, in order, the command, its subcommand where it " +
  'has one (`query`, `review`), and its operands"';
const MALFORMED_IDENTITY =
  'SPEC 12.0: "a spelling containing more than one `#` is a malformed ' +
  'value, a usage error", of the syntax class ("a `--to` or `--tag` ' +
  'spelling malformed as an identity or tag")';
const INVALID_KINDS =
  '11.1: in a `--kinds` list, "an element that is empty — a leading, ' +
  "trailing, or doubled comma — or outside the vocabulary is an invalid " +
  'flag value (12.0)", of the syntax class (12.0: "each `--kinds` element ' +
  'outside its vocabulary")';
const MISSING_REQUIRED =
  'SPEC 12.0: "a missing required flag or argument" is a usage error of ' +
  "the syntax class — 11.1's synopsis `xspec query reachable --from " +
  "<graph-node> --to <graph-node> [--kinds <kinds>]` requires both";
const FILE_OUTSIDE_ROOT =
  '11.1: "a `--file` pattern resolving outside the workspace root is an ' +
  'invalid flag value (12.0)" — 12.0: "decided by its spelling alone (7)", ' +
  'of the syntax class; 12.3: `ids --file <glob>` follows "the rules of ' +
  '7, as in 11"';

// --- stagings shared by the tables --------------------------------------------

/** One spec group of `.mdx` sources (SPEC 7.1), no other configuration. */
const SPEC_GROUP_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/*.mdx"]
  }
})
`;

// --- CONF-DISC (CERTIFICATIONS.md §CONF-DISC: `build`, `check`, `ids`,
// `inventory`, and `query edges`) ----------------------------------------------

/**
 * One trivial single-section `.mdx` source in one spec group, as
 * §CONF-DISC's scope admits: no code group (so the conformer never loads
 * TypeScript), Markdown emission absent — a valid workspace `build`
 * regenerates and `ids` lists.
 */
const DISC_STAGING: WorkspaceDecl = {
  files: {
    "xspec.config.ts": SPEC_GROUP_CONFIG,
    "specs/A.mdx": `<S id="a">
Alpha text.
</S>
`,
  },
};

const DISC_FILE = "specs/A.mdx";
/** The workspace's one `contains` edge: the root to its section (5.2). */
const DISC_EDGES: readonly GraphEdge[] = [
  { from: DISC_FILE, to: `${DISC_FILE}#a`, kind: "contains" },
];
/** The configuration file name with a U+FFFD appended: malformed (12.0). */
const MALFORMED_CONFIG = "xspec.config.ts" + String.fromCodePoint(0xfffd);

/**
 * An `ids` answer (12.3) listing exactly `files`: requirement IDs grouped by
 * file, files in byte order of path, IDs in document order.
 */
function idsOf(files: readonly IdsFileEntry[]): DocumentCheck {
  return (doc, context) => {
    const actual = JSON.stringify(
      decodeIdsReport(doc, context).files.map(({ file, ids }) => ({
        file,
        ids,
      })),
    );
    const expected = JSON.stringify(files);
    if (actual !== expected) {
      fail(
        `${context}: the ids document lists ${expected} (SPEC 12.3: ` +
          `requirement IDs grouped by file, files in byte order of path, ` +
          `IDs in document order), but it lists ${actual}`,
      );
    }
  };
}

/** A `query edges` answer (11.1) holding exactly `edges`, in order. */
function edgesOf(edges: readonly GraphEdge[]): DocumentCheck {
  return (doc, context) => {
    const actual = JSON.stringify(
      decodeEdgesReport(doc, context).map(({ from, to, kind }) => ({
        from,
        to,
        kind,
      })),
    );
    const expected = JSON.stringify(edges);
    if (actual !== expected) {
      fail(
        `${context}: the edge enumeration is ${expected} (SPEC 11.1: the ` +
          `edges the filters select; 5.2: a root contains its top-level ` +
          `sections), but it is ${actual}`,
      );
    }
  };
}

/**
 * An `inventory` answer (11.6) in its full 12.7 document form, finding-free,
 * its discovered sources exactly `sources`, in byte order of path.
 */
function inventoryOf(sources: readonly string[]): DocumentCheck {
  return (doc, context) => {
    const inventory = decodeInventoryDocument(doc, context);
    assertNoFindings(
      inventory.findings,
      context,
      "an inventory over a workspace holding no recorded state carries no " +
        "finding (SPEC 11.6: condition 23 is the only finding an inventory " +
        "answer ever carries)",
    );
    const actual = JSON.stringify(inventory.sources.map((entry) => entry.path));
    const expected = JSON.stringify(sources);
    if (actual !== expected) {
      fail(
        `${context}: the inventory lists the discovered sources ${expected} ` +
          `(SPEC 11.6: every discovered source file, in byte order of ` +
          `path), but it lists ${actual}`,
      );
    }
  };
}

const DISC_IDS = idsOf([{ file: DISC_FILE, ids: ["a"] }]);
const DISC_INVENTORY = inventoryOf([DISC_FILE]);
const QUERY_JSON_ONLY = jsonOnly("`query`");
const INVENTORY_JSON_ONLY = jsonOnly("`inventory`");

const DISC_TABLE: GrammarTable = {
  conformer: "CONF-DISC",
  staging: DISC_STAGING,
  rows: [
    // Flag tokens anywhere, the subcommand among the remaining tokens (12.0).
    {
      argv: ["--json", "ids"],
      clause: FLAGS_ANYWHERE,
      exit: 0,
      stdout: like(["ids", "--json"], DISC_IDS),
    },
    {
      argv: ["--json", "build"],
      clause: FLAGS_ANYWHERE,
      exit: 0,
      stdout: like(["build", "--json"], findingFreeReport),
    },
    {
      argv: ["--json", "inventory"],
      clause: FLAGS_ANYWHERE,
      exit: 0,
      stdout: like(["inventory", "--json"], DISC_INVENTORY),
    },
    {
      argv: ["--config", "xspec.config.ts", "ids", "--json"],
      clause: `${FLAGS_ANYWHERE}; ${ARITY_BY_NAME}`,
      exit: 0,
      stdout: like(["ids", "--json", "--config", "xspec.config.ts"], DISC_IDS),
    },
    {
      argv: ["query", "--from", DISC_FILE, "edges"],
      clause: `${FLAGS_ANYWHERE}; ${SUBCOMMAND_ORDER}`,
      exit: 0,
      stdout: like(
        ["query", "edges", "--from", DISC_FILE],
        edgesOf(DISC_EDGES),
      ),
    },
    // The JSON-only surfaces answer in JSON without `--json` (12.0, 11).
    {
      argv: ["query", "edges"],
      clause: `${QUERY_JSON_ONLY}; 11.1: \`edges\` with no filter enumerates every edge`,
      exit: 0,
      stdout: { form: "document", check: edgesOf(DISC_EDGES) },
    },
    {
      argv: ["inventory"],
      clause: `${INVENTORY_JSON_ONLY}; §CONF-DISC's Scope: "\`inventory\` (11.6) in its full 12.7 document form"`,
      exit: 0,
      stdout: like(["inventory", "--json"], DISC_INVENTORY),
    },
    // `--` ends flag reading (12.0).
    {
      argv: ["ids", "--json", "--"],
      clause: DASH_DASH,
      exit: 0,
      stdout: like(["ids", "--json"], DISC_IDS),
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
      argv: ["ids", "--", "--json"],
      clause: `${DASH_DASH}, so \`--json\` is no flag but \`ids\`'s surplus operand (${SURPLUS}); ${NO_JSON_EMPTY}`,
      exit: 2,
      stdout: EMPTY,
    },
    // Arity fixed by name: a value-taking flag takes the whole next token.
    {
      argv: ["build", "--test-hold", "--json"],
      clause: `${ARITY_BY_NAME}: \`--test-hold\` takes \`--json\` as its value (CERTIFICATIONS.md preamble: "so \`build --test-hold --json\` consumes \`--json\` as its value and leaves JSON out of effect"), and is \`build\`'s unknown flag (${NOT_MUTATING}); ${NO_JSON_EMPTY}`,
      exit: 2,
      stdout: EMPTY,
      hold: { path: "--json", created: false },
    },
    {
      argv: ["build", "--base", "--json"],
      clause: `${ARITY_BY_NAME}: \`--base\` (9, 10.7) takes \`--json\` as its value and is \`build\`'s unknown flag (${UNKNOWN_FLAG}); ${NO_JSON_EMPTY}`,
      exit: 2,
      stdout: EMPTY,
    },
    {
      argv: ["build", "--name", "--json"],
      clause: `${ARITY_BY_NAME}: \`--name\` (10.7) takes \`--json\` as its value and is \`build\`'s unknown flag (${UNKNOWN_FLAG}); ${NO_JSON_EMPTY}`,
      exit: 2,
      stdout: EMPTY,
    },
    {
      argv: ["nosuch", "--config", "--json"],
      clause: `${ARITY_BY_NAME}: \`--config\` takes \`--json\` as its value, so JSON output is out of effect for the unknown command (${NO_COMMAND}); ${NO_JSON_EMPTY}`,
      exit: 2,
      stdout: EMPTY,
    },
    {
      argv: ["nosuch", "--bogus", "--json"],
      clause: `${NO_VALUE_UNLESS_KNOWN}, so \`--json\` is read as a flag; ${JSON_IN_EFFECT}; ${PLAIN_DOCUMENT}`,
      exit: 2,
      stdout: PLAIN_USAGE_ERROR,
    },
    {
      argv: ["query", "edges", "--from", "--json"],
      clause: `${WHOLE_NEXT_TOKEN}, so \`--from\` names the path \`--json\` — 11.1: "a path in no configured group is unknown (12.0)", a plain usage error; ${QUERY_JSON_ONLY}; ${PLAIN_DOCUMENT}`,
      exit: 2,
      stdout: PLAIN_USAGE_ERROR,
    },
    {
      argv: ["ids", "--json", "--config", "--json"],
      clause: `${WHOLE_NEXT_TOKEN}, so \`--config\` names the path \`--json\`; ${CONFIG_AS_GIVEN}`,
      exit: 2,
      stdout: {
        form: "error-document",
        code: "configuration-error",
        path: "--json",
      },
    },
    // `--test-hold` beside a command that is not mutating (13.5).
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
    // Usage errors of the syntax class (12.0), each in the error document
    // whenever JSON output is in effect — decided before any of the
    // fixture's scope refusals, which the remaining rows reach no further.
    {
      argv: ["--json", "nosuch"],
      clause: `${NO_COMMAND}; ${JSON_IN_EFFECT}; ${PLAIN_DOCUMENT}`,
      exit: 2,
      stdout: PLAIN_USAGE_ERROR,
    },
    {
      argv: [],
      clause: `${NO_COMMAND}: no command word; ${NO_JSON_EMPTY}`,
      exit: 2,
      stdout: EMPTY,
    },
    {
      argv: ["query"],
      clause: `${SUBCOMMAND_ORDER}, and they "MUST match the command's synopsis exactly" — \`query\` names a subcommand (11.1); ${QUERY_JSON_ONLY}; ${PLAIN_DOCUMENT}`,
      exit: 2,
      stdout: PLAIN_USAGE_ERROR,
    },
    {
      argv: ["query", "nosuch"],
      clause: `${NO_COMMAND}: an unknown subcommand; ${QUERY_JSON_ONLY}; ${PLAIN_DOCUMENT}`,
      exit: 2,
      stdout: PLAIN_USAGE_ERROR,
    },
    {
      argv: ["query", "edges", "extra"],
      clause: `${SURPLUS} (11.1: \`query edges\` takes no operand); ${QUERY_JSON_ONLY}; ${PLAIN_DOCUMENT}`,
      exit: 2,
      stdout: PLAIN_USAGE_ERROR,
    },
    {
      argv: ["query", "nodes", "extra"],
      clause: `${SURPLUS} (11.1: \`query nodes\` takes no operand); ${QUERY_JSON_ONLY}; ${PLAIN_DOCUMENT}`,
      exit: 2,
      stdout: PLAIN_USAGE_ERROR,
    },
    {
      argv: ["query", "node"],
      clause: `${NO_COMMAND}: a missing operand (11.1: \`query node <node>\`); ${QUERY_JSON_ONLY}; ${PLAIN_DOCUMENT}`,
      exit: 2,
      stdout: PLAIN_USAGE_ERROR,
    },
    {
      argv: ["query", "reachable", "--from", DISC_FILE],
      clause: `${MISSING_REQUIRED}; ${QUERY_JSON_ONLY}; ${PLAIN_DOCUMENT}`,
      exit: 2,
      stdout: PLAIN_USAGE_ERROR,
    },
    {
      argv: ["inventory", "extra"],
      clause: `${SURPLUS} (11.6: \`inventory\` takes no operand); ${INVENTORY_JSON_ONLY}; ${PLAIN_DOCUMENT}`,
      exit: 2,
      stdout: PLAIN_USAGE_ERROR,
    },
    {
      argv: ["ids", "extra", "--json"],
      clause: `${SURPLUS} — 12.0's own example, \`xspec ids extra\`; ${JSON_IN_EFFECT}; ${PLAIN_DOCUMENT}`,
      exit: 2,
      stdout: PLAIN_USAGE_ERROR,
    },
    {
      argv: ["ids", "--tree", "extra", "--json"],
      clause: `${SURPLUS} — \`--tree\` is \`ids\`'s own flag (12.3); ${JSON_IN_EFFECT}; ${PLAIN_DOCUMENT}`,
      exit: 2,
      stdout: PLAIN_USAGE_ERROR,
    },
    {
      argv: ["check", "extra"],
      clause: `${SURPLUS} (12.2: \`check\` takes no operand); ${NO_JSON_EMPTY}`,
      exit: 2,
      stdout: EMPTY,
    },
    {
      argv: ["ids", "--json", "--json"],
      clause: `${REPEATED}; ${PLAIN_DOCUMENT}`,
      exit: 2,
      stdout: PLAIN_USAGE_ERROR,
    },
    {
      argv: ["build", "--json", "--config"],
      clause: `${MISSING_VALUE}; ${JSON_IN_EFFECT}; ${PLAIN_DOCUMENT}`,
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
      argv: ["view", "--bogus"],
      clause: `${UNKNOWN_FLAG}; ${jsonOnly("`view`")}; ${PLAIN_DOCUMENT}`,
      exit: 2,
      stdout: PLAIN_USAGE_ERROR,
    },
    {
      argv: ["ids", "--json", "--config", MALFORMED_CONFIG],
      clause: `${MALFORMED} — a malformed \`--config\` path is no configuration error but a plain usage error; ${JSON_IN_EFFECT}; ${PLAIN_DOCUMENT}`,
      exit: 2,
      stdout: PLAIN_USAGE_ERROR,
    },
    {
      argv: ["query", "edges", "--from", `${DISC_FILE}#a#b`],
      clause: `${MALFORMED_IDENTITY}; ${QUERY_JSON_ONLY}; ${PLAIN_DOCUMENT}`,
      exit: 2,
      stdout: PLAIN_USAGE_ERROR,
    },
    {
      argv: ["query", "edges", "--to", `${DISC_FILE}#a#b`],
      clause: `${MALFORMED_IDENTITY}; ${QUERY_JSON_ONLY}; ${PLAIN_DOCUMENT}`,
      exit: 2,
      stdout: PLAIN_USAGE_ERROR,
    },
    {
      argv: ["query", "edges", "--kinds", "contains,,embeds"],
      clause: `${INVALID_KINDS}; ${QUERY_JSON_ONLY}; ${PLAIN_DOCUMENT}`,
      exit: 2,
      stdout: PLAIN_USAGE_ERROR,
    },
    {
      argv: ["ids", "--json", "--file", "../A.mdx"],
      clause: `${FILE_OUTSIDE_ROOT}; ${JSON_IN_EFFECT}; ${PLAIN_DOCUMENT}`,
      exit: 2,
      stdout: PLAIN_USAGE_ERROR,
    },
    // Configuration located at the path `--config` names (12.0, 14).
    {
      argv: ["build", "--json", "--config", "./nosuch.ts"],
      clause: `${CONFIG_AS_GIVEN}; ${JSON_IN_EFFECT}`,
      exit: 2,
      stdout: {
        form: "error-document",
        code: "configuration-error",
        path: "./nosuch.ts",
      },
    },
    {
      argv: ["inventory", "--config", "./nosuch.ts"],
      clause: `${CONFIG_AS_GIVEN}; ${INVENTORY_JSON_ONLY}`,
      exit: 2,
      stdout: {
        form: "error-document",
        code: "configuration-error",
        path: "./nosuch.ts",
      },
    },
  ],
};

// --- CONF-AVAIL (CERTIFICATIONS.md §CONF-AVAIL: `view` and `occurrences`) -----

/**
 * One finding-free spec source as §CONF-AVAIL's scope admits: a section `a`,
 * and a section `b` whose `d` prop and embedding each reference `a` locally
 * — two resolving occurrences (5.7), so the answers compared hold records.
 */
const AVAIL_STAGING: WorkspaceDecl = {
  files: {
    "xspec.config.ts": SPEC_GROUP_CONFIG,
    "specs/A.mdx": `<S id="a">
Alpha text.
</S>

<S id="b" d={"a"}>
Beta: {text("a")}
</S>
`,
  },
};

const AVAIL_FILE = "specs/A.mdx";
const AVAIL_TARGET = "specs/A.mdx#a";
/** `b`'s `d` entry, then its embedding: occurrence order (5.7). */
const AVAIL_RECORDS = [AVAIL_TARGET, AVAIL_TARGET];
/** `AVAIL_TARGET` with a U+FFFD appended: a malformed value (12.0). */
const MALFORMED_TO = AVAIL_TARGET + String.fromCodePoint(0xfffd);

const AVAIL_TABLE: GrammarTable = {
  conformer: "CONF-AVAIL",
  staging: AVAIL_STAGING,
  rows: [
    // The JSON-only surfaces answer in JSON without `--json` (12.0, 11).
    {
      argv: ["view"],
      clause: `${JSON_ONLY}; 11.4: "with neither, the request covers every discovered spec source"`,
      exit: 0,
      stdout: { form: "document", check: viewOf([AVAIL_FILE], false) },
    },
    {
      argv: ["occurrences"],
      clause: `${JSON_ONLY}; 11.3: "Without \`--file\`, the consulted domain is the entire discovered set"`,
      exit: 0,
      stdout: { form: "document", check: occurrencesOf(AVAIL_RECORDS) },
    },
    // Flag tokens anywhere, arity fixed by name (12.0).
    {
      argv: ["--json", "view"],
      clause: FLAGS_ANYWHERE,
      exit: 0,
      stdout: like(["view", "--json"], viewOf([AVAIL_FILE], false)),
    },
    {
      argv: ["--json", "occurrences"],
      clause: FLAGS_ANYWHERE,
      exit: 0,
      stdout: like(["occurrences", "--json"], occurrencesOf(AVAIL_RECORDS)),
    },
    {
      argv: ["--to", AVAIL_TARGET, "occurrences"],
      clause: `${FLAGS_ANYWHERE}; ${ARITY_BY_NAME}`,
      exit: 0,
      stdout: like(
        ["occurrences", "--to", AVAIL_TARGET],
        occurrencesOf(AVAIL_RECORDS),
      ),
    },
    {
      argv: ["--file", AVAIL_FILE, "view"],
      clause: `${FLAGS_ANYWHERE}; ${ARITY_BY_NAME}`,
      exit: 0,
      stdout: like(["view", "--file", AVAIL_FILE], viewOf([AVAIL_FILE], false)),
    },
    {
      argv: ["--config", "xspec.config.ts", "occurrences"],
      clause: `${FLAGS_ANYWHERE}; ${ARITY_BY_NAME}`,
      exit: 0,
      stdout: like(
        ["occurrences", "--config", "xspec.config.ts"],
        occurrencesOf(AVAIL_RECORDS),
      ),
    },
    {
      argv: ["view", "--text", AVAIL_FILE],
      clause: FLAGS_ANYWHERE,
      exit: 0,
      stdout: like(["view", AVAIL_FILE, "--text"], viewOf([AVAIL_FILE], true)),
    },
    // `--` ends flag reading (12.0).
    {
      argv: ["view", "--"],
      clause: DASH_DASH,
      exit: 0,
      stdout: like(["view"], viewOf([AVAIL_FILE], false)),
    },
    {
      argv: ["occurrences", "--"],
      clause: DASH_DASH,
      exit: 0,
      stdout: like(["occurrences"], occurrencesOf(AVAIL_RECORDS)),
    },
    {
      argv: ["--", "view", AVAIL_FILE],
      clause: `${DASH_DASH}: the command word included`,
      exit: 0,
      stdout: like(["view", AVAIL_FILE], viewOf([AVAIL_FILE], false)),
    },
    {
      argv: ["view", "--", "--json"],
      clause: `${DASH_DASH}, so \`--json\` is a \`<file>\` operand — 11.4: "a file outside the discovered set is an unknown file (12.0)", a plain usage error; ${JSON_ONLY}; ${PLAIN_DOCUMENT}`,
      exit: 2,
      stdout: PLAIN_USAGE_ERROR,
    },
    // A value-taking flag takes the whole next token (12.0).
    {
      argv: ["view", "--file", "--text"],
      clause: `${WHOLE_NEXT_TOKEN}, so the glob is \`--text\`, and \`--text\` is not in effect; 11.4: "a glob admitting none … admits the empty set, an empty, finding-free answer, exit 0"`,
      exit: 0,
      stdout: { form: "document", check: viewOf([], false) },
    },
    {
      argv: ["occurrences", "--to", "--json"],
      clause: `${WHOLE_NEXT_TOKEN}, so \`--to\` names the bare path \`--json\`; 11.3: \`--to\` "accepts any syntactically well-formed requirement-node identity … whatever the workspace contains", and when it "does not currently resolve — its file not discovered … — the selection is empty"`,
      exit: 0,
      stdout: { form: "document", check: occurrencesOf([]) },
    },
    {
      argv: ["nosuch", "--config", "--json"],
      clause: `${ARITY_BY_NAME}: \`--config\` takes \`--json\` as its value, so JSON output is out of effect for the unknown command (${NO_COMMAND}); ${NO_JSON_EMPTY}`,
      exit: 2,
      stdout: EMPTY,
    },
    {
      argv: ["nosuch", "--bogus", "--json"],
      clause: `${NO_VALUE_UNLESS_KNOWN}, so \`--json\` is read as a flag; ${JSON_IN_EFFECT}; ${PLAIN_DOCUMENT}`,
      exit: 2,
      stdout: PLAIN_USAGE_ERROR,
    },
    // Usage errors of the syntax class (12.0), each in the error document
    // whenever JSON output is in effect.
    {
      argv: ["--json", "nosuch"],
      clause: `${NO_COMMAND}; ${JSON_IN_EFFECT}; ${PLAIN_DOCUMENT}`,
      exit: 2,
      stdout: PLAIN_USAGE_ERROR,
    },
    {
      argv: ["--json"],
      clause: `${NO_COMMAND}: no command word; ${JSON_IN_EFFECT}; ${PLAIN_DOCUMENT}`,
      exit: 2,
      stdout: PLAIN_USAGE_ERROR,
    },
    {
      argv: [],
      clause: `${NO_COMMAND}: no command word; ${NO_JSON_EMPTY}`,
      exit: 2,
      stdout: EMPTY,
    },
    {
      argv: ["occurrences", "extra"],
      clause: `${SURPLUS} (11.3: \`occurrences\` takes no operand); ${JSON_ONLY}; ${PLAIN_DOCUMENT}`,
      exit: 2,
      stdout: PLAIN_USAGE_ERROR,
    },
    {
      argv: ["occurrences", "--file"],
      clause: `${MISSING_VALUE}; ${JSON_ONLY}; ${PLAIN_DOCUMENT}`,
      exit: 2,
      stdout: PLAIN_USAGE_ERROR,
    },
    {
      argv: ["occurrences", "--json", "--json"],
      clause: `${REPEATED}; ${PLAIN_DOCUMENT}`,
      exit: 2,
      stdout: PLAIN_USAGE_ERROR,
    },
    {
      argv: ["occurrences", "--tree"],
      clause: `${UNKNOWN_FLAG} — \`--tree\` is \`ids\`'s (12.3), not \`occurrences\`'s (11.3); ${JSON_ONLY}; ${PLAIN_DOCUMENT}`,
      exit: 2,
      stdout: PLAIN_USAGE_ERROR,
    },
    {
      argv: ["view", "--config=x"],
      clause: `SPEC 12.0: "\`--name=value\` is not a spelling of any flag", an unknown flag; ${JSON_ONLY}; ${PLAIN_DOCUMENT}`,
      exit: 2,
      stdout: PLAIN_USAGE_ERROR,
    },
    {
      argv: ["view", "--file", AVAIL_FILE, AVAIL_FILE],
      clause: `11.4: "Combining \`<file>\` operands with \`--file\` is a usage error", of the syntax class (12.0); ${JSON_ONLY}; ${PLAIN_DOCUMENT}`,
      exit: 2,
      stdout: PLAIN_USAGE_ERROR,
    },
    {
      argv: ["occurrences", "--to", MALFORMED_TO],
      clause: `${MALFORMED}; ${JSON_ONLY}; ${PLAIN_DOCUMENT}`,
      exit: 2,
      stdout: PLAIN_USAGE_ERROR,
    },
    // `--test-hold` beside a command that is not mutating (13.5).
    {
      argv: ["view", "--test-hold", "h"],
      clause: `${UNKNOWN_FLAG}, \`view\` not mutating (${NOT_MUTATING}); ${JSON_ONLY}; ${PLAIN_DOCUMENT}`,
      exit: 2,
      stdout: PLAIN_USAGE_ERROR,
      hold: { path: "h", created: false },
    },
    {
      argv: ["--test-hold", "h", "occurrences"],
      clause: `${ARITY_BY_NAME}: before the command word \`--test-hold\` takes \`h\`, and \`occurrences\` is the command, whose unknown flag it is (${UNKNOWN_FLAG}; ${NOT_MUTATING}); ${JSON_ONLY}; ${PLAIN_DOCUMENT}`,
      exit: 2,
      stdout: PLAIN_USAGE_ERROR,
      hold: { path: "h", created: false },
    },
    {
      argv: ["view", "--test-hold", "--json"],
      clause: `${ARITY_BY_NAME}: \`--test-hold\` takes \`--json\` as its value and is \`view\`'s unknown flag; ${JSON_ONLY} — in effect whatever the arguments; ${PLAIN_DOCUMENT}`,
      exit: 2,
      stdout: PLAIN_USAGE_ERROR,
      hold: { path: "--json", created: false },
    },
    // Configuration located at the path `--config` names (12.0, 14).
    {
      argv: ["view", "--config", "./nosuch.ts"],
      clause: `${CONFIG_AS_GIVEN}; ${JSON_ONLY}`,
      exit: 2,
      stdout: {
        form: "error-document",
        code: "configuration-error",
        path: "./nosuch.ts",
      },
    },
  ],
};

// --- CONF-ORPHAN (CERTIFICATIONS.md §CONF-ORPHAN: `build` and `check`) --------

/**
 * One spec group of one trivial single-section source, as §CONF-ORPHAN's
 * scope admits (its staging constraint: the spec glob matches `.mdx` names
 * alone), Markdown emission absent: a valid workspace `build` regenerates.
 */
const ORPHAN_STAGING: WorkspaceDecl = {
  files: {
    "xspec.config.ts": SPEC_GROUP_CONFIG,
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
      clause: FLAGS_ANYWHERE,
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
      clause: `${REPEATED}; ${PLAIN_DOCUMENT}`,
      exit: 2,
      stdout: PLAIN_USAGE_ERROR,
    },
    {
      argv: ["build", "--json", "--config"],
      clause: `${MISSING_VALUE}; ${JSON_IN_EFFECT}; ${PLAIN_DOCUMENT}`,
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
      clause: `${WHOLE_NEXT_TOKEN}, so \`--config\` names the path \`--json\`; ${CONFIG_AS_GIVEN}`,
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

const GRAMMAR_TABLES: readonly GrammarTable[] = [
  DISC_TABLE,
  AVAIL_TABLE,
  ORPHAN_TABLE,
];

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
