// The certification fixtures' reading of the configuration's import
// (CERTIFICATIONS.md preamble, third paragraph; SPEC 7, 2.4).
//
// CERTIFICATIONS.md requires: "Every conformer reads the configuration's
// import as 7 states too: its module specifier is any static string literal
// (2.4), never interpreted, resolved, or loaded, and the configuration file
// is a source only where a configured group discovers it." Certification
// exercises only the specifiers its in-scope tests stage, so a reader that
// refuses every specifier but one passes it while breaking the rule; this
// guard pins the rule itself, as the invocation-grammar guard
// (certification-fixture-grammar.test.ts) pins 12.0's grammar: one test per
// conformer with a reader of its own, each run through the subprocess
// driver against the conformer's binding from CERTIFICATION_FIXTURES. A
// violator runs its conformer's `product.mjs` with one deviation switch, so
// the conformer's reader is its violators' too; and the CONF-RACE,
// CONF-READERS, and CONF-LEFTOVER conformers run CONF-CORE's `product.mjs`
// deviation-free, so CONF-CORE's row pins their readers as well.
//
// Each row stages its conformer's valid workspace — its grammar table's own
// declaration (certification-fixture-stagings.ts) — once as the twin,
// importing from "xspec", and once per entry of SPELLINGS, each
// configuration differing from the twin's in the specifier alone: the
// spelling spliced in by concatenation exactly as the file is to hold it
// (no printer, no decoding, no re-quoting), every backslash, line
// terminator, and U+FFFD built from its code point, so this source holds
// none. S-9's TypeScript check judges each configuration well-formed as it
// is staged (helpers/workspace.ts), so no spelling a scanner rejects is
// staged. On each workspace the row runs, in order, commands its grammar
// table drives within the conformer's served surface, each under `--json`
// (`build` first wherever a later command would otherwise meet a workspace
// never built), and each run must exit and answer exactly as the twin's
// same run: exit code and standard output byte-equal, and the workspace
// after it byte-equal to the twin's after the same run (H-6's lock-path
// exclusion aside) but for the configuration file, which differs by design
// and must still hold its staged bytes, and graph data (`isGraphDataKey`),
// whose opaque content a differing configuration file may change (TEST-SPEC
// T7-9 leaves it out of its compares alike). The twin's own runs must exit
// as SPEC fixes them over its valid workspace, each answering one JSON
// document, so a fixture refusing the twin as well cannot pass by agreeing
// with itself. The rule's other half — the configuration file a source only
// where a configured group discovers it — each reader keeps by deciding
// discovery by its configured globs alone, none of which matches the
// configuration file here; the spelling that designates the configuration
// file itself (`"./xspec.config.ts"`) fails a reader that resolves its
// specifier and so takes that file up as a source.
//
// Every spelling of a row runs, each failing at its first deviating command
// (later commands would run on a state the deviation left), and the test
// then fails once listing every failing spelling, so a red check shows each
// deviation in one run. Anything but a diagnosed assertion failure
// (`HarnessAssertionError`) — a hang guard's kill, an output overflow, a
// staging error — propagates at once: it is a harness defect, never a
// spelling's verdict.
//
// Run: `npx vitest run --config test/vitest.config.ts --project self
// test/self/certification-fixture-import.test.ts`, under the unprivileged
// namespace as the whole self project runs (AGENTS.md).

import { Buffer } from "node:buffer";
import { test } from "vitest";
import { isGraphDataKey } from "../helpers/adapters/index.js";
import {
  assertBytesEqual,
  assertExitCode,
  bytesEqual,
  fail,
  HarnessAssertionError,
  parseJsonStdout,
} from "../helpers/assertions.js";
import {
  assertSnapshotsEqual,
  describeEntry,
  snapshotDirectory,
} from "../helpers/snapshot.js";
import type { DirectorySnapshot } from "../helpers/snapshot.js";
import { runProduct } from "../helpers/subprocess.js";
import type { ProductBinding, RunResult } from "../helpers/subprocess.js";
import { TestWorkspace } from "../helpers/workspace.js";
import type { WorkspaceDecl } from "../helpers/workspace.js";
import { CERTIFICATION_FIXTURES } from "./certification-fixtures.js";
import {
  AVAIL_STAGING,
  CORE_STAGING,
  DISC_STAGING,
  IMPORT_STAGING,
  MD_STAGING,
  ORPHAN_STAGING,
  VALID_STAGING,
} from "./certification-fixture-stagings.js";

/** The configuration file every staging here holds at its root (SPEC 7). */
const CONFIG_PATH = "xspec.config.ts";
/** The twin's import, spelled exactly once in each staging's configuration. */
const TWIN_IMPORT = 'from "xspec"';

const BACKSLASH = String.fromCodePoint(0x5c);
const LINE_FEED = String.fromCodePoint(0x0a);
const CARRIAGE_RETURN = String.fromCodePoint(0x0d);
const LINE_SEPARATOR = String.fromCodePoint(0x2028);
const REPLACEMENT_CHARACTER = String.fromCodePoint(0xfffd);

/** One specifier spelling: the literal exactly as the file holds it. */
interface Spelling {
  /** What it is, for diagnoses (the literal itself may hold line breaks). */
  readonly label: string;
  /** The static string literal (2.4), its quotes included. */
  readonly literal: string;
}

/**
 * The spellings each conformer's reader must accept as its `"xspec"` twin
 * (SPEC 7: "a bare or scoped package name, a relative or absolute path, a
 * URL, and the empty string are accepted alike, in either quote style and
 * with escape sequences, line continuations, or U+FFFD") — the scoped name,
 * the single-quoted relative path, the empty string, an escape, a line
 * continuation, and a raw U+FFFD among them, beside the spellings a reader
 * matching a literal's delimiters wrongly would trip on: an escaped quote of
 * the literal's own kind, an escaped backslash before its closing quote, the
 * other quote kind unescaped, a CRLF or U+2028 continuation, and `//`
 * inside the literal.
 */
const SPELLINGS: readonly Spelling[] = [
  { label: "a scoped name", literal: '"@acme/config"' },
  { label: "a single-quoted relative path", literal: "'./lib/define.js'" },
  { label: "the empty string", literal: '""' },
  {
    label: "a URL, its `//` inside the literal",
    literal: '"https://example.com/define.js"',
  },
  {
    label: "a relative path designating the configuration file itself",
    literal: '"./xspec.config.ts"',
  },
  {
    label: "a hexadecimal escape (a backslash, then `x78`)",
    literal: `"${BACKSLASH}x78spec"`,
  },
  {
    label: "a braced Unicode escape (a backslash, then `u{78}`)",
    literal: `"${BACKSLASH}u{78}spec"`,
  },
  {
    label: "a line continuation (a backslash, then U+000A)",
    literal: `"xs${BACKSLASH}${LINE_FEED}pec"`,
  },
  {
    label: "a single-quoted line continuation (a backslash, then CRLF)",
    literal: `'xs${BACKSLASH}${CARRIAGE_RETURN}${LINE_FEED}pec'`,
  },
  {
    label: "a line continuation (a backslash, then U+2028)",
    literal: `"xs${BACKSLASH}${LINE_SEPARATOR}pec"`,
  },
  {
    label:
      "an escaped double quote inside double quotes, then an escaped " +
      "backslash before the closing quote",
    literal: `"a${BACKSLASH}"b${BACKSLASH}${BACKSLASH}"`,
  },
  {
    label: "a double quote inside single quotes, unescaped",
    literal: `'a"b'`,
  },
  {
    label: "a raw U+FFFD",
    literal: `"x${REPLACEMENT_CHARACTER}spec"`,
  },
];

/** One command of a row, run under `--json`. */
interface ImportStep {
  /** The arguments after the executable, `--json` among them. */
  readonly argv: readonly string[];
  /** The exit SPEC 12.0 fixes for it over the twin's valid workspace. */
  readonly exit: 0 | 2;
}

/** One conformer's reader, driven over its grammar table's staging. */
interface ImportRow {
  /** The conformer's `## CONF-…` name in CERTIFICATION_FIXTURES. */
  readonly conformer: string;
  /** Its grammar table's declaration: the twin's workspace. */
  readonly staging: WorkspaceDecl;
  /** Why these commands and their exits (CERTIFICATIONS.md, SPEC). */
  readonly clause: string;
  /** Run in order on one workspace, the twin's and each spelling's alike. */
  readonly steps: readonly ImportStep[];
}

const ROWS: readonly ImportRow[] = [
  {
    conformer: "CONF-CORE",
    staging: CORE_STAGING,
    clause:
      "§CONF-CORE's surface: `build`; the reads `check`, `ids`, `show`, " +
      "`query`, and `review list`; `review create --strategy audit`, " +
      "`rename`, and file-form `move` performing on a valid workspace " +
      "(exit 0, 12.0); and `impact --base` without git, the exit-2 " +
      "unreadable-baseline case of 6.3/12.0",
    steps: [
      { argv: ["build", "--json"], exit: 0 },
      { argv: ["check", "--json"], exit: 0 },
      { argv: ["ids", "--json"], exit: 0 },
      { argv: ["show", "specs/A.mdx#a", "--json"], exit: 0 },
      { argv: ["query", "nodes", "--json"], exit: 0 },
      {
        argv: [
          "review",
          "create",
          "--strategy",
          "audit",
          "--name",
          "s",
          "--json",
        ],
        exit: 0,
      },
      { argv: ["review", "list", "--json"], exit: 0 },
      { argv: ["rename", "specs/A.mdx", "a", "b", "--json"], exit: 0 },
      { argv: ["move", "specs/A.mdx", "specs/B.mdx", "--json"], exit: 0 },
      { argv: ["impact", "--base", "main", "--json"], exit: 2 },
    ],
  },
  {
    conformer: "CONF-VALID",
    staging: VALID_STAGING,
    clause:
      "§CONF-VALID's surface: `build` and `query node`/`query nodes`, " +
      "`--tag` filtered, over a valid workspace (exit 0, 12.0)",
    steps: [
      { argv: ["build", "--json"], exit: 0 },
      { argv: ["query", "nodes", "--json"], exit: 0 },
      { argv: ["query", "nodes", "--tag", "x", "--json"], exit: 0 },
      { argv: ["query", "node", "specs/A.mdx#a", "--json"], exit: 0 },
    ],
  },
  {
    conformer: "CONF-MD",
    staging: MD_STAGING,
    clause:
      "§CONF-MD's surface: `build`, then `check` exiting 0 on the built " +
      "workspace, and `query node`, `query nodes`, and `query edges` " +
      "unfiltered (exit 0, 12.0)",
    steps: [
      { argv: ["build", "--json"], exit: 0 },
      { argv: ["check", "--json"], exit: 0 },
      { argv: ["query", "nodes", "--json"], exit: 0 },
      { argv: ["query", "node", "specs/A.mdx#a", "--json"], exit: 0 },
      { argv: ["query", "edges", "--json"], exit: 0 },
    ],
  },
  {
    conformer: "CONF-DISC",
    staging: DISC_STAGING,
    clause:
      "§CONF-DISC's surface over a valid workspace: `build`, `ids`, " +
      "`inventory`, and `query edges --from <path>` (exit 0, 12.0)",
    steps: [
      { argv: ["build", "--json"], exit: 0 },
      { argv: ["ids", "--json"], exit: 0 },
      { argv: ["inventory", "--json"], exit: 0 },
      { argv: ["query", "edges", "--from", "specs/A.mdx", "--json"], exit: 0 },
    ],
  },
  {
    conformer: "CONF-IMPORT",
    staging: IMPORT_STAGING,
    clause:
      "§CONF-IMPORT's surface: `build`, `check` on the built workspace, " +
      "`ids`, and `inventory`, each under `--json`, over T7-9's valid " +
      "workspace (exit 0, 12.0)",
    steps: [
      { argv: ["build", "--json"], exit: 0 },
      { argv: ["check", "--json"], exit: 0 },
      { argv: ["ids", "--json"], exit: 0 },
      { argv: ["inventory", "--json"], exit: 0 },
    ],
  },
  {
    conformer: "CONF-AVAIL",
    staging: AVAIL_STAGING,
    clause:
      "§CONF-AVAIL's surface: `view`, with and without `--text`, and " +
      "`occurrences`, unrestricted and with `--to`, answering from the " +
      "current sources (11.2; exit 0, 12.0)",
    steps: [
      { argv: ["view", "--json"], exit: 0 },
      { argv: ["view", "--text", "--json"], exit: 0 },
      { argv: ["occurrences", "--json"], exit: 0 },
      { argv: ["occurrences", "--to", "specs/A.mdx#a", "--json"], exit: 0 },
    ],
  },
  {
    conformer: "CONF-ORPHAN",
    staging: ORPHAN_STAGING,
    clause:
      "§CONF-ORPHAN's surface: `build`, then `check` on the built " +
      "workspace (exit 0, 12.0)",
    steps: [
      { argv: ["build", "--json"], exit: 0 },
      { argv: ["check", "--json"], exit: 0 },
    ],
  },
];

/** The clause every spelling's run is held to. */
const IMPORT_RULE =
  "CERTIFICATIONS.md preamble: every conformer reads the configuration's " +
  'import as 7 states — "its module specifier is any static string ' +
  'literal (2.4), never interpreted, resolved, or loaded"; SPEC 7: a ' +
  "configuration's validity, and everything xspec derives from it as " +
  "configuration, are independent of the specifier's designation and " +
  "spelling";

function conformerBinding(name: string): ProductBinding {
  const entry = CERTIFICATION_FIXTURES.find((fixture) => fixture.name === name);
  if (entry === undefined) {
    throw new Error(
      `import row names ${name}, which CERTIFICATION_FIXTURES does not list`,
    );
  }
  return entry.binding();
}

function spell(argv: readonly string[]): string {
  return "`" + argv.join(" ") + "`";
}

/** The staging's configuration text, which must be a plain string. */
function configurationOf(staging: WorkspaceDecl): string {
  const text = staging.files?.[CONFIG_PATH];
  if (typeof text !== "string") {
    throw new Error(
      `import guard: a staging's ${CONFIG_PATH} must be plain text to vary`,
    );
  }
  return text;
}

/**
 * The staging with its configuration's specifier spelled `literal`: the
 * twin's text with its one `from "xspec"` respelled by concatenation, so
 * the two configurations differ in the specifier alone.
 */
function respecified(staging: WorkspaceDecl, literal: string): WorkspaceDecl {
  const text = configurationOf(staging);
  const at = text.indexOf(TWIN_IMPORT);
  if (at === -1 || text.indexOf(TWIN_IMPORT, at + 1) !== -1) {
    throw new Error(
      `import guard: a staging's ${CONFIG_PATH} must spell ${TWIN_IMPORT} ` +
        `exactly once`,
    );
  }
  const respelled =
    text.slice(0, at) + "from " + literal + text.slice(at + TWIN_IMPORT.length);
  return { ...staging, files: { ...staging.files, [CONFIG_PATH]: respelled } };
}

/**
 * The compared view of a workspace snapshot: every entry but the
 * configuration file and graph data (module header); H-6's lock-path
 * exclusion is the compare's own.
 */
function comparedView(snapshot: DirectorySnapshot): DirectorySnapshot {
  return {
    ...snapshot,
    entries: new Map(
      [...snapshot.entries].filter(
        ([key]) => key !== CONFIG_PATH && !isGraphDataKey(key),
      ),
    ),
  };
}

/** What one of the twin's runs left: its result and the compared view. */
interface TwinOutcome {
  readonly result: RunResult;
  readonly view: DirectorySnapshot;
}

/**
 * Run the row's commands on the twin's workspace, each exiting as SPEC fixes
 * it and answering one JSON document, recording what each left.
 */
async function runTwin(
  binding: ProductBinding,
  row: ImportRow,
  workspace: TestWorkspace,
): Promise<TwinOutcome[]> {
  const outcomes: TwinOutcome[] = [];
  for (const step of row.steps) {
    const context =
      `${row.conformer}: the twin importing from "xspec", ` +
      `${spell(step.argv)} (${row.clause})`;
    const result = await runProduct(binding, {
      cwd: workspace.root,
      argv: step.argv,
    });
    assertExitCode(result, step.exit, context);
    parseJsonStdout(
      result,
      `${context} — with JSON output in effect, its entire stdout is one ` +
        `JSON document (SPEC 12.0)`,
    );
    outcomes.push({
      result,
      view: comparedView(await snapshotDirectory(workspace.root)),
    });
  }
  return outcomes;
}

/**
 * Run the row's commands on a fresh workspace whose specifier is spelled
 * `spelling`, each answering exactly as the twin's same run (module header).
 */
async function checkSpelling(
  binding: ProductBinding,
  row: ImportRow,
  spelling: Spelling,
  twin: readonly TwinOutcome[],
): Promise<void> {
  const staging = respecified(row.staging, spelling.literal);
  const stagedConfiguration = Buffer.from(configurationOf(staging), "utf8");
  const workspace = await TestWorkspace.create(staging);
  try {
    for (const [index, step] of row.steps.entries()) {
      const outcome = twin[index];
      if (outcome === undefined) {
        throw new Error(
          `import guard: no twin outcome for step ${String(index)}`,
        );
      }
      const context =
        `${row.conformer}, ${spelling.label}: ` + spell(step.argv);
      const result = await runProduct(binding, {
        cwd: workspace.root,
        argv: step.argv,
      });
      assertExitCode(
        result,
        step.exit,
        `${context} must exit as the twin importing from "xspec" does ` +
          `(${IMPORT_RULE})`,
      );
      assertBytesEqual(
        result.stdoutBytes,
        outcome.result.stdoutBytes,
        `${context}: standard output, against the twin's same run ` +
          `(${IMPORT_RULE})`,
      );
      const snapshot = await snapshotDirectory(workspace.root);
      const configuration = snapshot.entries.get(CONFIG_PATH);
      if (
        configuration?.kind !== "file" ||
        !bytesEqual(configuration.bytes, stagedConfiguration)
      ) {
        fail(
          `${context}: the configuration file must still hold its staged ` +
            `bytes — no command writes it (SPEC 13.4: every file xspec ` +
            `writes is a derived, durable, or transient file) — but it ` +
            `holds ` +
            (configuration === undefined
              ? "nothing"
              : describeEntry(configuration)),
        );
      }
      assertSnapshotsEqual(
        outcome.view,
        comparedView(snapshot),
        `${context}: the workspace after it, against the twin's after the ` +
          `same run — the configuration file and graph data aside, whose ` +
          `opaque content a differing configuration file may change ` +
          `(TEST-SPEC T7-9) — (${IMPORT_RULE})`,
      );
    }
  } finally {
    await workspace.dispose();
  }
}

/** Run every spelling of a row, then fail once listing each failing one. */
async function runImportRow(row: ImportRow): Promise<void> {
  const binding = conformerBinding(row.conformer);
  const twinWorkspace = await TestWorkspace.create(row.staging);
  try {
    const twin = await runTwin(binding, row, twinWorkspace);
    const failures: string[] = [];
    for (const spelling of SPELLINGS) {
      try {
        await checkSpelling(binding, row, spelling, twin);
      } catch (error) {
        if (!(error instanceof HarnessAssertionError)) throw error;
        failures.push(
          `- ${spelling.label}: ` +
            error.message.split(LINE_FEED).join(`${LINE_FEED}    `),
        );
      }
    }
    if (failures.length > 0) {
      fail(
        `${row.conformer}: ${String(failures.length)} of ` +
          `${String(SPELLINGS.length)} specifier spellings fail ` +
          `(${IMPORT_RULE}):${LINE_FEED}` +
          failures.join(LINE_FEED),
      );
    }
  } finally {
    await twinWorkspace.dispose();
  }
}

for (const row of ROWS) {
  test(
    `${row.conformer} reads the configuration's import as SPEC 7 states: ` +
      "any static string literal its specifier, never interpreted, " +
      "resolved, or loaded (CERTIFICATIONS.md preamble)",
    async () => {
      // No guard of its own (TEST-SPEC S-3, helpers/hang-guards.ts): the
      // row's fixture invocations each carry the driver's.
      await runImportRow(row);
    },
  );
}
