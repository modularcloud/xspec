// TEST-SPEC §7 configuration import — T7-9's arms (a), the specifier's
// spellings, (b), the scanner-rejected escapes, and (c), the specifier's
// designations. Configuration basics
// (T7-1…T7-3) and T7-7 live in section-7-basics.ts, discovery (T7-4…T7-6,
// T7-8) in section-7-discovery.ts, and P-19, the property searching the
// spellings (a) never stages, in section-16-p19.ts.
//
// Registered product-facing body (C-2 "one code path"): each arm builds its
// own fresh workspace (H-1), drives the product strictly as a subprocess
// (H-2), asserts exact exit codes (H-5), decodes reports through the H-3
// adapters, and rejects a product only via diagnosed assertion failures
// (H-8).
//
// SPEC 7: the configuration's import takes any static string literal (2.4)
// as its module specifier, and wherever xspec reads a configuration it never
// executes the file and never interprets, resolves, or loads the specifier,
// making no read and no network access on its account — so validity, and
// everything xspec derives from the configuration, are independent of what
// the specifier designates and of its spelling wherever the file stays
// well-formed TypeScript (14.20), while an escape TypeScript 5.9.3's scanner
// rejects leaves the file not well-formed, a configuration error (14.14).
//
// The workspace (T7-9's opening; helpers/config-import.ts, shared with
// P-19): `xspec.config.ts` with one spec group `main` globbing `specs/*.mdx`
// and `markdown: { emit: true }`, emitting next to sources — no code group,
// so no configured group discovers the configuration file — over
// `specs/A.mdx` (`<S id="a">A</S>`) and `specs/B.mdx` (`<S id="b">B</S>`);
// no git repository and no `node_modules`. Every workspace is fresh (H-1),
// and every configuration and source is a staged-source record made at
// module load (S-9's timing clause: each arm's workspace is created after
// the body's first product invocation, the twin's).
//
// The twin imports from `"xspec"` (`CONFIG_IMPORT_TWIN_CONFIG`). It runs
// first, in a workspace of its own, and holds the outcome such a workspace
// gives (H-5): `build` and `check` exit 0 finding-free, `ids` and
// `inventory` exit 0 with one JSON document each. A twin failing there fails
// the body at once, (a)'s premise unmet.
//
// (a) Spellings (`T7_9_A_ARMS`): eleven configurations, each differing from
// the twin's in the specifier alone — the bare names `"XSPEC"` (a
// single-casing arm, 12.0: no case folding) and `"left-pad"`, the scoped
// name `"@acme/config"`, the relative path `"./lib/define.js"`, the absolute
// path `"/opt/define.mjs"`, the URL `"https://example.com/define.js"`, the
// empty string, the single-quoted `xspec`, `xspec` with its `x` written as a
// hexadecimal escape, a line continuation between `xs` and `pec` (a
// backslash, then U+000A), and a raw U+FFFD between `x` and `spec`. Each arm
// runs `build`, `check`, `ids`, and `inventory`, each under `--json`, in
// that order, and answers as the twin did — the same exit outcome and
// byte-equal standard output (`inventory`'s `configuration` byte-identical
// among it, and `build` and `check` therefore exiting 0 finding-free) — and,
// once the four have run, every file outside `.xspec/` but the
// configuration file is byte-identical to the twin's: the generated modules
// and the emitted Markdown, graph data, whose opaque content a differing
// configuration file may change, not compared (as in T7-8), and the lock
// path with it (H-6). Standard error is not compared: its wording is free
// (12.0). P-19 holds each of its draws to these same assertions (TEST-SPEC
// P-19: "under T7-9's assertions") and compares alike. The URL arm's network
// is the one every product invocation has: CI's Linux jobs run
// network-denied (E-1; .github/scripts/run-without-network.sh), so a product
// fetching the specifier fails there; the harness adds no denial of its own.
//
// Staging (CERTIFICATIONS.md, Exclusions, "T7-9 and T7-10"; §CONF-IMPORT's
// two staging hazards): a literal reaches its file exactly as spelled. Every
// arm's configuration is the shared builder's `configImportText` over the
// literal — three strings joined, nothing printed, decoded, or re-quoted —
// the one path P-19's draws are staged through, so that (a)'s
// escape-spelled, line-continuation, single-quoted, and raw-U+FFFD arms ride
// CONF-IMPORT's certification of P-19 representatively. Every backslash is
// the builder's `BACKSLASH`, built from code point U+005C, and every line
// feed is built from its code point, so this module's source spells no
// escape at all. A module-load self-check (`assertStagedAsSpelled`) pins
// each record's bytes: the builder's head, the literal, and the builder's
// tail, nothing else; the literal delimited by its arm's quote; and the
// literal holding exactly the backslashes, line feeds, and U+FFFD its arm
// spells, each escape at its place — so a staging that decoded, re-quoted,
// or re-spelled a literal fails at load, a harness error, never an arm that
// equals its twin for every product.
//
// (b) Scanner-rejected escapes (`T7_9_B_ARMS`): the specifier a hexadecimal
// escape with one hex digit, a braced Unicode escape of the code point
// 110000 hexadecimal (past U+10FFFF), an octal escape (a backslash, `0`,
// `1`), and a backslash before `8` — each a scanning error of TypeScript
// 5.9.3 under both readings, so each record is declared unparseable and S-9
// verifies it so before any product exists
// (test/self/s9-staged-sources.test.ts; each escape's one scanning error is
// pinned in test/self/s9-typescript-well-formedness.test.ts). Each leaves
// the file not well-formed (14.20): `build`, `check`, `ids`, and
// `inventory`, each under `--json`, are held to the shared 14.14 contract
// (support.ts `expectConfigurationError`: exit 2, the 12.7 error document as
// the whole of standard output, a standard-error diagnostic naming the
// configuration), the document's one finding exactly `code`
// `"configuration-error"`, `path` `"xspec.config.ts"` — the file the upward
// search found, anchored at the workspace root (T12.7-3) — and `locations`
// `[]`, a configuration condition carrying no in-source location (SPEC 14).
//
// (c) Designations (`T7_9_C_ARMS`): seven configurations, each differing
// from the twin's in the specifier alone, a double-quoted relative path
// designating, from the configuration file's directory (the workspace
// root): nothing (`"./nowhere.js"`); a plain file the environment refuses
// to read (`"./locked.js"`, an ES module defining `defineConfig`, staged
// mode 0o200 by `stageReadRefusalOfFile` — T14-10's discipline, Linux leg:
// its content refused, its write kept — and its kind verified still
// examinable); a path below a directory stripped of its read and search
// permission both (`"./sealed/define.js"`, `sealed/` holding that module,
// staged mode 000 by `stageDirectoryMode` — T14-10(l)'s discipline, Linux
// leg: the directory's listing, the entry's kind, and its content each
// refused); a FIFO (`"./fifo"`, made by `stageFifo` and never opened by the
// harness); a directory (`"./specs"`, the sources' own); and the
// configuration file itself, spelled `"./xspec.config"` and
// `"./xspec.config.ts"`. Each staging is made once the arm's workspace
// stands, before its first command, and verifies itself on the harness
// (E-1: a privileged runner, whose own read reaches the refused object, is
// the harness error `HarnessStagingError`, never a verdict); a permission
// staging stands around the arm's four commands and is restored before the
// compare. Each arm runs (a)'s four commands and compares as (a) does, its
// designated entry — the staged file, directory, or FIFO, which the twin's
// workspace does not hold — pruned from the file compare beside graph data
// and the configuration file: discovery under the one glob `specs/*.mdx`
// never examines a root-level entry but `specs` (SPEC 7), so the answers
// are the twin's. After each command of the FIFO arm, the FIFO is still a
// FIFO in place (`assertFifosIntact`), and the command ended within its own
// guard: with termination, that is all "unopened" asserts (S-3; a product
// opening a FIFO with no writer blocks until its guard kills it). A read
// on the specifier's account that the product survives reaches nothing
// H-2's channel observes and admits no discriminating staging (TEST-SPEC
// T7-9(c)), so nothing is recorded for it. Every (c) record — the seven
// configurations and the two modules — is a staged-source record made at
// module load and declared well-formed (S-9); each configuration's bytes
// are pinned as (a)'s are (`assertStagedAsSpelled`), and its literal
// against the path its arm stages at (`assertDesignates`).
//
// Every arm runs: each arm's diagnosed failure (a `HarnessAssertionError`,
// its message naming the arm) is collected, and the body fails once at the
// end naming every failed arm, so one run diagnoses every spelling and
// designation; a harness error or a hang propagates at once — a (c) arm's
// hang renamed for its arm and command, the driver's kill kept as its
// cause, so the certification runner still records the hang it is
// (helpers/hang-guards.ts `isHangGuardKill`; S-3: a tripped guard ends its
// test). Certification: T7-9 is in no
// conformer's scope (CERTIFICATIONS.md, Exclusions, "T7-9 and T7-10": its
// operative assertions are positive, each failing loud against the product
// it targets).

import { Buffer } from "node:buffer";
import { decodeFindingsReport } from "../../helpers/adapters/index.js";
import {
  assertBytesEqual,
  assertExitCode,
  fail,
  HarnessAssertionError,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import {
  BACKSLASH,
  CONFIG_IMPORT_CONFIG_PATH,
  CONFIG_IMPORT_HEAD,
  CONFIG_IMPORT_SOURCES,
  CONFIG_IMPORT_TAIL,
  CONFIG_IMPORT_TWIN_CONFIG,
  CONFIG_IMPORT_TWIN_LITERAL,
  configImportText,
} from "../../helpers/config-import.js";
import { isHangGuardKill } from "../../helpers/hang-guards.js";
import { assertFifosIntact, stageFifo } from "../../helpers/lock-staging.js";
import {
  HarnessStagingError,
  stageDirectoryMode,
  stageReadRefusalOfFile,
} from "../../helpers/permissions.js";
import type { DirectoryModeProbe } from "../../helpers/permissions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import type {
  DirectorySnapshot,
  SnapshotOptions,
} from "../../helpers/snapshot.js";
import {
  assertSnapshotsEqual,
  snapshotDirectory,
} from "../../helpers/snapshot.js";
import { stagedTs } from "../../helpers/staged-ts.js";
import type { StagedTs } from "../../helpers/staged-ts.js";
import type { ProductBinding, RunResult } from "../../helpers/subprocess.js";
import { runProduct, summarizeResult } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { EntryKind, WorkspaceDecl } from "../../helpers/workspace.js";
import {
  assertSameJson,
  expectConfigurationError,
  expectErrorDocument,
  REPLACEMENT_CHARACTER,
} from "./support.js";

// ---------------------------------------------------------------------------
// Code points and spellings

/** U+000A, built from its code point (the module spells no escape). */
const LINE_FEED = String.fromCodePoint(0x0a);
/** U+0022 and U+0027, the two quote styles of a static string literal. */
const DOUBLE_QUOTE = '"';
const SINGLE_QUOTE = "'";

/** How many times `piece` occurs in `text` (non-overlapping). */
function occurrences(text: string, piece: string): number {
  return text.split(piece).length - 1;
}

// ---------------------------------------------------------------------------
// The arms' configurations

/**
 * What an arm's literal spells, pinned at module load
 * (`assertStagedAsSpelled`): its quote, and how many backslashes, line
 * feeds, and U+FFFD it holds; and, for an escape, the escape's spelling and
 * the code-unit index at which it stands in the literal.
 */
interface Spelled {
  readonly quote: string;
  readonly backslashes: number;
  readonly lineFeeds: number;
  readonly replacements: number;
  readonly escape?: { readonly spelling: string; readonly at: number };
}

/** A literal with no escape, no line feed, and no U+FFFD. */
const PLAIN_DOUBLE: Spelled = {
  quote: DOUBLE_QUOTE,
  backslashes: 0,
  lineFeeds: 0,
  replacements: 0,
};

/** One arm of T7-9's (a) or (b). */
interface ImportArm {
  /** The arm as diagnoses name it — every escape named in words. */
  readonly label: string;
  /** The specifier exactly as it stands in the file, its quotes included. */
  readonly literal: string;
  /** What `literal` spells (module header). */
  readonly spelled: Spelled;
  /** The configuration over `literal`, a staged-source record (S-9). */
  readonly config: StagedTs;
}

/** An (a) arm: its configuration declared well-formed (14.20, S-9). */
function spellingArm(
  label: string,
  literal: string,
  spelled: Spelled,
): ImportArm {
  return {
    label,
    literal,
    spelled,
    config: stagedTs(
      `T7-9 xspec.config.ts ((a) importing from ${label})`,
      configImportText(literal),
    ),
  };
}

/**
 * A (b) arm: `escape` the whole of a double-quoted specifier, the
 * configuration declared unparseable (14.20, S-9).
 */
function rejectedEscapeArm(label: string, escape: string): ImportArm {
  const literal = DOUBLE_QUOTE + escape + DOUBLE_QUOTE;
  return {
    label,
    literal,
    spelled: {
      ...PLAIN_DOUBLE,
      backslashes: 1,
      escape: { spelling: escape, at: 1 },
    },
    config: stagedTs(
      `T7-9 xspec.config.ts ((b) importing from a specifier holding ${label}, a scanning error)`,
      configImportText(literal),
      "unparseable",
    ),
  };
}

/**
 * T7-9(a)'s eleven spellings (TEST-SPEC T7-9(a)), each a configuration
 * differing from the twin's in the specifier alone.
 */
export const T7_9_A_ARMS: readonly ImportArm[] = [
  spellingArm(
    'the bare name "XSPEC", a single-casing arm (12.0: no case folding)',
    '"XSPEC"',
    PLAIN_DOUBLE,
  ),
  spellingArm('the bare name "left-pad"', '"left-pad"', PLAIN_DOUBLE),
  spellingArm('the scoped name "@acme/config"', '"@acme/config"', PLAIN_DOUBLE),
  spellingArm(
    'the relative path "./lib/define.js"',
    '"./lib/define.js"',
    PLAIN_DOUBLE,
  ),
  spellingArm(
    'the absolute path "/opt/define.mjs"',
    '"/opt/define.mjs"',
    PLAIN_DOUBLE,
  ),
  spellingArm(
    'the URL "https://example.com/define.js", under the denied network every product invocation has (E-1)',
    '"https://example.com/define.js"',
    PLAIN_DOUBLE,
  ),
  spellingArm('the empty string ""', '""', PLAIN_DOUBLE),
  spellingArm("the single-quoted 'xspec'", "'xspec'", {
    ...PLAIN_DOUBLE,
    quote: SINGLE_QUOTE,
  }),
  spellingArm(
    "an escape sequence: xspec with its x written as the hexadecimal escape of U+0078 (a backslash, x, 7, 8)",
    `"${BACKSLASH}x78spec"`,
    {
      ...PLAIN_DOUBLE,
      backslashes: 1,
      escape: { spelling: `${BACKSLASH}x78`, at: 1 },
    },
  ),
  spellingArm(
    "a line continuation: xs, a backslash, U+000A, then pec",
    `"xs${BACKSLASH}${LINE_FEED}pec"`,
    {
      ...PLAIN_DOUBLE,
      backslashes: 1,
      lineFeeds: 1,
      escape: { spelling: BACKSLASH + LINE_FEED, at: 3 },
    },
  ),
  spellingArm(
    "a raw U+FFFD: x, U+FFFD, then spec",
    `"x${REPLACEMENT_CHARACTER}spec"`,
    { ...PLAIN_DOUBLE, replacements: 1 },
  ),
];

/**
 * T7-9(b)'s four scanner-rejected escapes (TEST-SPEC T7-9(b); SPEC 7, 14.20),
 * each the whole of a double-quoted specifier.
 */
export const T7_9_B_ARMS: readonly ImportArm[] = [
  rejectedEscapeArm(
    "a hexadecimal escape with one hex digit (a backslash, x, then 4)",
    `${BACKSLASH}x4`,
  ),
  rejectedEscapeArm(
    "a braced Unicode escape of the code point 110000 hexadecimal, past U+10FFFF (a backslash, u, then 110000 in braces)",
    `${BACKSLASH}u{110000}`,
  ),
  rejectedEscapeArm(
    "an octal escape (a backslash, 0, then 1)",
    `${BACKSLASH}01`,
  ),
  rejectedEscapeArm("a backslash before 8", `${BACKSLASH}8`),
];

/**
 * What a (c) arm stages once its workspace stands, verified on the harness
 * itself before the arm's first command (module header).
 */
interface DesignationStaging {
  /** Reinstate what the staging changed (a permission staging's mode). */
  readonly restore: () => Promise<void>;
  /**
   * After each command: the staging still in place where TEST-SPEC asserts
   * it — the FIFO still a FIFO in place.
   */
  readonly afterCommand: (context: string) => Promise<void>;
}

/** One arm of T7-9's (c): what its specifier designates, and its staging. */
interface DesignationArm extends ImportArm {
  /**
   * The workspace-relative path the specifier designates from the
   * configuration file's directory, the workspace root: the literal is
   * exactly `"./<target>"` (pinned at module load, `assertDesignates`).
   */
  readonly target: string;
  /** The arm's own files, beside the configuration and the two sources. */
  readonly files: Readonly<Record<string, StagedTs>>;
  /**
   * The top-level entry the arm stages beyond the twin's workspace — the
   * file, directory, or FIFO at or above `target` — pruned from the file
   * compare; none where the arm stages nothing.
   */
  readonly staged?: string;
  /** The staging made at `staged` once the workspace stands. */
  readonly stage?: (workspace: TestWorkspace) => Promise<DesignationStaging>;
}

/**
 * The module `"./locked.js"` and `"./sealed/define.js"` designate: a plain
 * ES module defining `defineConfig` as the identity, which no conforming
 * product reads (module header).
 */
const DESIGNATED_MODULE_TEXT =
  "export function defineConfig(config) {" +
  LINE_FEED +
  "  return config;" +
  LINE_FEED +
  "}" +
  LINE_FEED;

/** The plain file whose content `"./locked.js"`'s arm refuses. */
const LOCKED_PATH = "locked.js";
/** The directory `"./sealed/define.js"`'s arm strips (mode 000). */
const SEALED_DIR = "sealed";
/** The plain file under `sealed/` that `"./sealed/define.js"` designates. */
const SEALED_ENTRY = "define.js";
/** The FIFO `"./fifo"` designates. */
const FIFO_PATH = "fifo";

const LOCKED_MODULE: StagedTs = stagedTs(
  'T7-9 locked.js ((c) the plain file "./locked.js" designates, its content refused: an ES module defining defineConfig)',
  DESIGNATED_MODULE_TEXT,
);

const SEALED_MODULE: StagedTs = stagedTs(
  'T7-9 sealed/define.js ((c) the plain file "./sealed/define.js" designates, below sealed/ of mode 000: an ES module defining defineConfig)',
  DESIGNATED_MODULE_TEXT,
);

/** A staging with nothing to undo or recheck. */
const NOTHING_TO_UNDO = async (): Promise<void> => undefined;

/**
 * `"./locked.js"`'s staging (module header; TEST-SPEC T7-9(c), T14-10's
 * discipline, Linux leg): its content read refused and its write kept
 * (`stageReadRefusalOfFile`, mode 0o200, verified on the harness itself),
 * and its kind still examinable — the harness's own examination, never
 * following a link, finds the plain file still there.
 */
async function stageLockedFile(
  workspace: TestWorkspace,
): Promise<DesignationStaging> {
  const staging = await stageReadRefusalOfFile(workspace.path(LOCKED_PATH));
  let kind: EntryKind | undefined;
  let examination = "";
  try {
    kind = await workspace.kind(LOCKED_PATH);
  } catch (thrown) {
    examination = thrown instanceof Error ? thrown.message : String(thrown);
  }
  if (kind !== "file") {
    await staging.restore();
    throw new HarnessStagingError(
      "read-refusal-of-file",
      workspace.path(LOCKED_PATH),
      "T7-9(c) refuses its content alone, its kind still examinable, but " +
        "the harness's own examination of it " +
        (kind === undefined
          ? `failed — ${examination}`
          : `found ${kind}, not a plain file`) +
        " (E-1)",
    );
  }
  return {
    restore: () => staging.restore(),
    afterCommand: NOTHING_TO_UNDO,
  };
}

/**
 * T14-10(l)'s verification of `sealed/` stripped of its read and search
 * permission both: the harness's own listing of it, examination of
 * `define.js`'s kind, and read of `define.js`, each refused.
 */
const SEALED_PROBES: readonly DirectoryModeProbe[] = [
  { attempt: "list", refused: true },
  { attempt: "examine", name: SEALED_ENTRY, refused: true },
  { attempt: "read", name: SEALED_ENTRY, refused: true },
];

/**
 * `"./sealed/define.js"`'s staging (module header; TEST-SPEC T7-9(c),
 * T14-10(l)'s discipline, Linux leg): `sealed/` given mode 000 by
 * `stageDirectoryMode`, every route to the designated path refused and
 * verified so on the harness itself.
 */
async function stageSealedDirectory(
  workspace: TestWorkspace,
): Promise<DesignationStaging> {
  const staging = await stageDirectoryMode(
    workspace.path(SEALED_DIR),
    0o000,
    SEALED_PROBES,
  );
  return {
    restore: () => staging.restore(),
    afterCommand: NOTHING_TO_UNDO,
  };
}

/**
 * `"./fifo"`'s staging (module header; TEST-SPEC T7-9(c), S-3): a FIFO made
 * by `stageFifo`, verified a FIFO in place on the harness itself and never
 * opened by it; after each command it is still a FIFO in place.
 */
async function stageDesignatedFifo(
  workspace: TestWorkspace,
): Promise<DesignationStaging> {
  const staged = await stageFifo(workspace, FIFO_PATH);
  return {
    restore: NOTHING_TO_UNDO,
    afterCommand: async (context) => {
      await assertFifosIntact(
        staged,
        `${context}: the FIFO "./fifo" designates is still a FIFO in ` +
          "place, the command having ended within its own guard — " +
          "unopened, as xspec never resolves, reads, or loads the " +
          "specifier (SPEC 7; TEST-SPEC T7-9(c), S-3)",
      );
    },
  };
}

/** A (c) arm: its configuration declared well-formed (14.20, S-9). */
function designationArm(
  label: string,
  literal: string,
  target: string,
  staging: Pick<DesignationArm, "files" | "staged" | "stage"> = {
    files: {},
  },
): DesignationArm {
  return {
    label,
    literal,
    spelled: PLAIN_DOUBLE,
    config: stagedTs(
      `T7-9 xspec.config.ts ((c) importing from ${label})`,
      configImportText(literal),
    ),
    target,
    ...staging,
  };
}

/**
 * T7-9(c)'s seven designations (TEST-SPEC T7-9(c)), each a configuration
 * differing from the twin's in the specifier alone, a double-quoted
 * relative path.
 */
export const T7_9_C_ARMS: readonly DesignationArm[] = [
  designationArm(
    'the relative specifier "./nowhere.js", designating nothing',
    '"./nowhere.js"',
    "nowhere.js",
  ),
  designationArm(
    'the relative specifier "./locked.js", designating a plain file whose ' +
      "content the environment refuses, its kind still examinable " +
      "(T14-10's discipline, Linux leg)",
    '"./locked.js"',
    LOCKED_PATH,
    {
      files: { [LOCKED_PATH]: LOCKED_MODULE },
      staged: LOCKED_PATH,
      stage: stageLockedFile,
    },
  ),
  designationArm(
    'the relative specifier "./sealed/define.js", designating a path below ' +
      "sealed/, a directory of mode 000 holding define.js, every route to " +
      "it refused (T14-10(l)'s discipline, Linux leg)",
    '"./sealed/define.js"',
    `${SEALED_DIR}/${SEALED_ENTRY}`,
    {
      files: { [`${SEALED_DIR}/${SEALED_ENTRY}`]: SEALED_MODULE },
      staged: SEALED_DIR,
      stage: stageSealedDirectory,
    },
  ),
  designationArm(
    'the relative specifier "./fifo", designating a FIFO',
    '"./fifo"',
    FIFO_PATH,
    { files: {}, staged: FIFO_PATH, stage: stageDesignatedFifo },
  ),
  designationArm(
    'the relative specifier "./specs", designating a directory (the ' +
      "sources' own)",
    '"./specs"',
    "specs",
  ),
  designationArm(
    'the relative specifier "./xspec.config", designating the ' +
      "configuration file itself, its extension left off",
    '"./xspec.config"',
    "xspec.config",
  ),
  designationArm(
    'the relative specifier "./xspec.config.ts", designating the ' +
      "configuration file itself",
    '"./xspec.config.ts"',
    CONFIG_IMPORT_CONFIG_PATH,
  ),
];

/**
 * The module-load self-check (module header): `arm`'s record holds the
 * builder's head, the literal, and the builder's tail, nothing else, and the
 * literal spells exactly what the arm states. A mismatch is a harness error
 * thrown at load — the registry fails to load — never a product verdict.
 */
function assertStagedAsSpelled(arm: ImportArm): void {
  const { literal, spelled } = arm;
  const problems: string[] = [];
  if (arm.config.source !== CONFIG_IMPORT_HEAD + literal + CONFIG_IMPORT_TAIL) {
    problems.push(
      "its configuration is not the builder's head, the literal, and the " +
        "builder's tail, joined",
    );
  }
  if (
    literal.length < 2 ||
    !literal.startsWith(spelled.quote) ||
    !literal.endsWith(spelled.quote) ||
    occurrences(literal, spelled.quote) !== 2
  ) {
    problems.push(
      `the literal is not delimited by ${JSON.stringify(spelled.quote)} ` +
        "alone",
    );
  }
  const counts: ReadonlyArray<readonly [string, string, number]> = [
    ["backslashes (U+005C)", BACKSLASH, spelled.backslashes],
    ["line feeds (U+000A)", LINE_FEED, spelled.lineFeeds],
    ["U+FFFD", REPLACEMENT_CHARACTER, spelled.replacements],
  ];
  for (const [what, piece, expected] of counts) {
    const found = occurrences(literal, piece);
    if (found !== expected) {
      problems.push(
        `the literal holds ${String(found)} ${what} where its arm spells ` +
          String(expected),
      );
    }
  }
  if (
    spelled.escape !== undefined &&
    literal.indexOf(spelled.escape.spelling) !== spelled.escape.at
  ) {
    problems.push(
      "the literal's escape does not stand at code unit " +
        String(spelled.escape.at),
    );
  }
  if (problems.length > 0) {
    throw new Error(
      `T7-9 ${arm.label}: the staged record ${JSON.stringify(arm.config.name)} ` +
        `is not spelled as its arm states — ${problems.join("; ")} (module ` +
        "header: a literal reaches its file exactly as spelled; the " +
        `literal's code points: ${codePointsOf(literal)})`,
    );
  }
}

/** `text`'s code points, as `U+XXXX` each, for a diagnosis. */
function codePointsOf(text: string): string {
  return [...text]
    .map(
      (character) =>
        "U+" +
        character.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0"),
    )
    .join(" ");
}

for (const piece of [CONFIG_IMPORT_HEAD, CONFIG_IMPORT_TAIL]) {
  if (
    occurrences(piece, BACKSLASH) !== 0 ||
    occurrences(piece, REPLACEMENT_CHARACTER) !== 0
  ) {
    throw new Error(
      "T7-9: the configuration builder's head or tail holds a backslash or " +
        "U+FFFD, so a literal's count of them no longer pins the file's " +
        "(helpers/config-import.ts)",
    );
  }
}
// The twin: the double-quoted `xspec` between the same head and tail, so
// that each arm's configuration differs from the twin's in the specifier
// alone (TEST-SPEC T7-9).
if (
  CONFIG_IMPORT_TWIN_LITERAL !== DOUBLE_QUOTE + "xspec" + DOUBLE_QUOTE ||
  CONFIG_IMPORT_TWIN_CONFIG.source !==
    CONFIG_IMPORT_HEAD + CONFIG_IMPORT_TWIN_LITERAL + CONFIG_IMPORT_TAIL
) {
  throw new Error(
    "T7-9: the twin's record is not the builder's head, the double-quoted " +
      "xspec, and the builder's tail, joined (helpers/config-import.ts)",
  );
}
for (const arm of [...T7_9_A_ARMS, ...T7_9_B_ARMS, ...T7_9_C_ARMS]) {
  assertStagedAsSpelled(arm);
}

/** Whether the workspace-relative `rel` is `entry` or lies below it. */
function atOrBelow(rel: string, entry: string): boolean {
  return rel === entry || rel.startsWith(entry + "/");
}

/** The twin's top-level entries (module header), which no arm stages. */
const TWIN_ENTRIES: readonly string[] = [
  CONFIG_IMPORT_CONFIG_PATH,
  ".xspec",
  ...Object.keys(CONFIG_IMPORT_SOURCES).map((rel) => rel.split("/")[0]!),
];

/**
 * The module-load self-check of a (c) arm (module header): its literal is
 * exactly `"./<target>"`; and what it stages lies where its specifier
 * designates — its one staged entry a top-level entry the twin's workspace
 * does not hold, at or above `target`, made by a staging of its own, its
 * files all at or below it. A mismatch is a harness error thrown at load.
 */
function assertDesignates(arm: DesignationArm): void {
  const problems: string[] = [];
  if (arm.literal !== DOUBLE_QUOTE + "./" + arm.target + DOUBLE_QUOTE) {
    problems.push(`its literal is not "./${arm.target}", double-quoted`);
  }
  const { staged } = arm;
  if ((staged === undefined) !== (arm.stage === undefined)) {
    problems.push(
      "it names a staged entry without a staging, or a staging without one",
    );
  }
  if (staged !== undefined) {
    if (staged.includes("/") || TWIN_ENTRIES.includes(staged)) {
      problems.push(
        `its staged entry ${staged} is no top-level entry of its own beside the twin's`,
      );
    }
    if (!atOrBelow(arm.target, staged)) {
      problems.push(
        `the path it designates lies neither at nor below ${staged}`,
      );
    }
  }
  for (const rel of Object.keys(arm.files)) {
    if (staged === undefined || !atOrBelow(rel, staged)) {
      problems.push(`its file ${rel} lies outside its staged entry`);
    }
  }
  if (problems.length > 0) {
    throw new Error(
      `T7-9 ${arm.label}: the arm does not stage where its specifier ` +
        `designates — ${problems.join("; ")} (module header)`,
    );
  }
}

for (const arm of T7_9_C_ARMS) {
  assertDesignates(arm);
}

// ---------------------------------------------------------------------------
// The commands, the twin, and the compared files

/** One of T7-9's four commands, run from the workspace root under `--json`. */
interface ImportCommand {
  readonly word: "build" | "check" | "ids" | "inventory";
  /** The outcome the twin's valid workspace gives it (H-5). */
  readonly expectOnTwin: (result: RunResult, context: string) => void;
}

/** A findings-only surface: exit 0 with exactly `{"findings": []}`. */
function expectFindingFree(
  result: RunResult,
  context: string,
  rule: string,
): void {
  assertExitCode(
    result,
    0,
    `${context} — on a valid workspace it exits 0 finding-free (${rule}; H-5)`,
  );
  assertSameJson(
    decodeFindingsReport(parseJsonStdout(result, context), context).findings,
    [],
    `${context} — the report is exactly {"findings": []}, the ` +
      `findings-only form's one member holding the empty array (SPEC 12.7)`,
  );
}

/** A reading surface: exit 0 with exactly one JSON document (H-5, 12.0). */
function expectAnswered(
  result: RunResult,
  context: string,
  rule: string,
): void {
  assertExitCode(
    result,
    0,
    `${context} — a valid workspace's answer, exit 0 (${rule}; H-5)`,
  );
  parseJsonStdout(result, context);
}

/** T7-9's commands, in the order every arm runs them. */
const T7_9_COMMANDS: readonly ImportCommand[] = [
  {
    word: "build",
    expectOnTwin: (result, context) => {
      expectFindingFree(result, context, "SPEC 12.1");
    },
  },
  {
    word: "check",
    expectOnTwin: (result, context) => {
      expectFindingFree(result, context, "SPEC 12.2: graph data current");
    },
  },
  {
    word: "ids",
    expectOnTwin: (result, context) => {
      expectAnswered(result, context, "SPEC 12.3");
    },
  },
  {
    word: "inventory",
    expectOnTwin: (result, context) => {
      expectAnswered(result, context, "SPEC 11.6");
    },
  },
];

/** A command as diagnoses name it. */
function commandLabel(command: ImportCommand): string {
  return "`" + command.word + " --json`";
}

/**
 * An arm's workspace: its configuration record beside the two sources, and
 * a (c) arm's own files.
 */
function armDecl(
  config: StagedTs,
  files: Readonly<Record<string, StagedTs>> = {},
): WorkspaceDecl {
  return {
    files: {
      [CONFIG_IMPORT_CONFIG_PATH]: config,
      ...CONFIG_IMPORT_SOURCES,
      ...files,
    },
  };
}

/**
 * What an arm compares with the twin's files (module header): every entry
 * outside `.xspec/` but the configuration file — the sources, the generated
 * modules (13.1), and the emitted Markdown (13.2) — and, for a (c) arm, but
 * its `staged` entry with everything below it. Graph data, the lock path,
 * and everything else under `.xspec/` are pruned.
 */
function comparedFiles(staged?: string): SnapshotOptions {
  return {
    exclude: (relPathBytes) => {
      const rel = Buffer.from(relPathBytes).toString("latin1");
      return (
        atOrBelow(rel, ".xspec") ||
        rel === CONFIG_IMPORT_CONFIG_PATH ||
        (staged !== undefined && atOrBelow(rel, staged))
      );
    },
  };
}

/** What the twin and each (a) arm compare (module header). */
const T7_9_COMPARED_FILES: SnapshotOptions = comparedFiles();

/** The twin's four runs and its compared files, once they have run. */
interface ImportTwin {
  readonly results: readonly RunResult[];
  readonly compared: DirectorySnapshot;
}

/**
 * The twin (module header): the four commands in order on its fresh
 * workspace, each holding the outcome that workspace gives it (H-5), then
 * its compared files; the workspace is disposed once they are taken.
 */
async function runImportTwin(product: ProductBinding): Promise<ImportTwin> {
  const workspace = await TestWorkspace.create(
    armDecl(CONFIG_IMPORT_TWIN_CONFIG),
  );
  try {
    const results: RunResult[] = [];
    for (const command of T7_9_COMMANDS) {
      const context =
        `T7-9's twin (importing from ${CONFIG_IMPORT_TWIN_LITERAL}): ` +
        commandLabel(command);
      const result = await runProduct(product, {
        cwd: workspace.root,
        argv: [command.word, "--json"],
      });
      command.expectOnTwin(result, context);
      results.push(result);
    }
    return {
      results,
      compared: await snapshotDirectory(workspace.root, T7_9_COMPARED_FILES),
    };
  } finally {
    await workspace.dispose();
  }
}

/** Why each (a) answer must be the twin's (TEST-SPEC T7-9; SPEC 7, 2.4). */
const TWIN_RULE =
  "the configuration differs from the twin's in its import's specifier " +
  "alone, a static string literal xspec reads as spelled and never " +
  "interprets, resolves, or loads, so that validity and everything xspec " +
  "derives from the configuration are independent of its spelling and of " +
  "what it designates (SPEC 7, 2.4; TEST-SPEC T7-9)";

/**
 * An arm's run answers exactly as the twin's: the same exit outcome — exit
 * code, or death by signal — and byte-equal standard output (for
 * `inventory`, its `configuration` byte-identical among it). Standard error
 * is not compared: its wording is free (12.0).
 */
function assertAnswersAsTwin(
  result: RunResult,
  twin: RunResult,
  context: string,
): void {
  if (result.exitCode !== twin.exitCode || result.signal !== twin.signal) {
    fail(
      `${context}: it exits exactly as on its twin importing from ` +
        `${CONFIG_IMPORT_TWIN_LITERAL} — ${TWIN_RULE}; the arm: ` +
        `${summarizeResult(result)}; the twin: ${summarizeResult(twin)}`,
    );
  }
  assertBytesEqual(
    result.stdoutBytes,
    twin.stdoutBytes,
    `${context}: its standard output is byte-equal to the twin's — ` +
      TWIN_RULE,
  );
}

// ---------------------------------------------------------------------------
// The arms

/**
 * One (a) arm (module header): a fresh workspace staging the arm's
 * configuration, the four commands in order, each answering as the twin's
 * did, then the compared files byte-identical to the twin's.
 */
async function runSpellingArm(
  product: ProductBinding,
  twin: ImportTwin,
  arm: ImportArm,
): Promise<void> {
  const workspace = await TestWorkspace.create(armDecl(arm.config));
  try {
    for (const [index, command] of T7_9_COMMANDS.entries()) {
      const twinResult = twin.results[index];
      if (twinResult === undefined) {
        throw new Error(`T7-9: no twin run for ${commandLabel(command)}`);
      }
      const result = await runProduct(product, {
        cwd: workspace.root,
        argv: [command.word, "--json"],
      });
      assertAnswersAsTwin(
        result,
        twinResult,
        `T7-9(a), importing from ${arm.label}: ${commandLabel(command)}`,
      );
    }
    assertSnapshotsEqual(
      twin.compared,
      await snapshotDirectory(workspace.root, T7_9_COMPARED_FILES),
      `T7-9(a), importing from ${arm.label}, once its four commands have ` +
        `run: the generated modules and emitted Markdown — every file ` +
        `outside .xspec/ but the configuration file, the twin's first, the ` +
        `arm's second — are byte-identical to the twin's, graph data not ` +
        `compared (${TWIN_RULE})`,
    );
  } finally {
    await workspace.dispose();
  }
}

/**
 * One (b) arm (module header): a fresh workspace staging the arm's
 * unparseable configuration; each of the four commands under `--json` held
 * to the 14.14 contract, its error document's one finding exactly the
 * configuration error concerning `xspec.config.ts`, with no location.
 */
async function runRejectedEscapeArm(
  product: ProductBinding,
  arm: ImportArm,
): Promise<void> {
  const workspace = await TestWorkspace.create(armDecl(arm.config));
  try {
    for (const command of T7_9_COMMANDS) {
      const context =
        `T7-9(b), importing from a specifier holding ${arm.label}: ` +
        commandLabel(command);
      const result = await expectConfigurationError(
        product,
        workspace,
        [command.word],
        `${context} — the escape is a scanning error of TypeScript 5.9.3, ` +
          `so the file is not well-formed TypeScript (SPEC 7, 14.20)`,
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
          path: CONFIG_IMPORT_CONFIG_PATH,
          locations: [],
        },
        `${context}: the error document's one finding carries the stable ` +
          `code "configuration-error" (SPEC 14 condition 14), as its ` +
          `concerned path the configuration file the upward search found, ` +
          `in the anchoring form of 11.6 relative to the invocation working ` +
          `directory — the workspace root, so exactly "xspec.config.ts" ` +
          `(SPEC 14, 12.7; T12.7-3) — and locations [], a configuration ` +
          `condition carrying no in-source location (SPEC 14)`,
      );
    }
  } finally {
    await workspace.dispose();
  }
}

/**
 * A (c) arm's `command`, run from the workspace root under `--json` within
 * the driver's own guard (S-3). Its hang propagates at once, ending the test
 * (S-3: a tripped guard ends its test), renamed for the arm and the command
 * with the driver's kill as its cause, so the certification runner still
 * records it as the hang it is (`isHangGuardKill`); anything else the run
 * rejects with propagates unchanged.
 */
async function runDesignationCommand(
  product: ProductBinding,
  workspace: TestWorkspace,
  command: ImportCommand,
  context: string,
): Promise<RunResult> {
  try {
    return await runProduct(product, {
      cwd: workspace.root,
      argv: [command.word, "--json"],
    });
  } catch (error) {
    if (!isHangGuardKill(error)) throw error;
    throw new Error(
      `${context}: the command did not end within its own guard, which ` +
        "killed it — a product opening what the specifier designates, a " +
        "FIFO with no writer among them, blocks there, where xspec never " +
        "resolves, reads, or loads the specifier (SPEC 7; TEST-SPEC " +
        "T7-9(c), S-3: a tripped guard ends its test) — " +
        (error instanceof Error ? error.message : String(error)),
      { cause: error },
    );
  }
}

/**
 * One (c) arm (module header): a fresh workspace staging the arm's
 * configuration and files; its staging made and verified on the harness
 * itself; the four commands in order, each answering as the twin's did and
 * leaving the staging in place where asserted (the FIFO); then, the staging
 * restored, the compared files — the arm's staged entry pruned —
 * byte-identical to the twin's.
 */
async function runDesignationArm(
  product: ProductBinding,
  twin: ImportTwin,
  arm: DesignationArm,
): Promise<void> {
  const workspace = await TestWorkspace.create(armDecl(arm.config, arm.files));
  try {
    const staging =
      arm.stage === undefined ? undefined : await arm.stage(workspace);
    try {
      for (const [index, command] of T7_9_COMMANDS.entries()) {
        const twinResult = twin.results[index];
        if (twinResult === undefined) {
          throw new Error(`T7-9: no twin run for ${commandLabel(command)}`);
        }
        const context =
          `T7-9(c), importing from ${arm.label}: ` + commandLabel(command);
        const result = await runDesignationCommand(
          product,
          workspace,
          command,
          context,
        );
        assertAnswersAsTwin(result, twinResult, context);
        await staging?.afterCommand(context);
      }
    } finally {
      await staging?.restore();
    }
    assertSnapshotsEqual(
      twin.compared,
      await snapshotDirectory(workspace.root, comparedFiles(arm.staged)),
      `T7-9(c), importing from ${arm.label}, once its four commands have ` +
        `run and its staging is undone: the generated modules and emitted ` +
        `Markdown — every file outside .xspec/ but the configuration file` +
        (arm.staged === undefined
          ? ""
          : ` and the arm's own staged ${arm.staged}`) +
        `, the twin's first, the arm's second — are byte-identical to the ` +
        `twin's, graph data not compared (${TWIN_RULE})`,
    );
  } finally {
    await workspace.dispose();
  }
}

/**
 * Run one arm, collecting its diagnosed failure (module header): a
 * `HarnessAssertionError` is recorded and the next arm runs; anything else —
 * a harness error, a hang — propagates at once.
 */
async function collectArmFailure(
  failures: string[],
  arm: () => Promise<void>,
): Promise<void> {
  try {
    await arm();
  } catch (error) {
    if (!(error instanceof HarnessAssertionError)) throw error;
    failures.push(error.message);
  }
}

// ---------------------------------------------------------------------------
// Registration

const T7_9 = defineProductTest({
  id: "T7-9",
  title:
    "configuration import (TEST-SPEC T7-9 (a), (b), (c)): on a valid " +
    "workspace — one spec group globbing specs/*.mdx over specs/A.mdx and " +
    "specs/B.mdx, Markdown emitted next to sources, no group discovering " +
    "the configuration file — (a) the import's module specifier spelled as " +
    'the bare names "XSPEC" (a single-casing arm, 12.0: no case folding) ' +
    'and "left-pad", the scoped name "@acme/config", the relative path ' +
    '"./lib/define.js", the absolute path "/opt/define.mjs", the URL ' +
    '"https://example.com/define.js" under the denied network (E-1), the ' +
    "empty string, the single-quoted xspec, xspec with its x written as a " +
    "hexadecimal escape, a line continuation between xs and pec, and a raw " +
    "U+FFFD between x and spec — each staged exactly as spelled and " +
    'differing from its twin importing from "xspec" in the specifier alone ' +
    "— answers as the twin: `build`, `check`, `ids`, and `inventory`, each " +
    "under `--json`, exit code and standard output equal to the twin's " +
    "(`inventory`'s `configuration` byte-identical among them), `build` " +
    "and `check` exiting 0 finding-free, and the generated modules and " +
    "emitted Markdown byte-identical, graph data not compared; (b) a " +
    "scanner-rejected escape as the specifier — a hexadecimal escape with " +
    "one hex digit, a braced Unicode escape of the code point 110000 " +
    "hexadecimal, an octal escape, and a backslash before 8, each a " +
    "scanning error of TypeScript 5.9.3 declared unparseable (S-9) — " +
    "leaves the file not well-formed (14.20): the four commands, each " +
    "under `--json`, report 14.14, exit 2, the error document's one " +
    'finding `code` "configuration-error", `path` "xspec.config.ts", and ' +
    "`locations` []; (c) the specifier designating, from the workspace " +
    'root, nothing ("./nowhere.js"), a plain file whose content the ' +
    'environment refuses, its kind still examinable ("./locked.js", mode ' +
    "0o200: T14-10's discipline, Linux leg), a path below a directory of " +
    'mode 000 holding it ("./sealed/define.js": ' +
    "T14-10(l)'s discipline, Linux leg, every route refused), a FIFO " +
    '("./fifo"), a directory ("./specs"), and the configuration file ' +
    'itself ("./xspec.config", "./xspec.config.ts") — each staging ' +
    "verified on the harness itself — answers as the twin, as (a) " +
    "compares, the arm's staged entry left out of the file compare, and " +
    "the FIFO after each command still a FIFO in place, each command " +
    "ending within its guard (SPEC 7, 2.4, 12.7, 14; S-3)",
  run: async (product) => {
    const twin = await runImportTwin(product);
    const failures: string[] = [];
    for (const arm of T7_9_A_ARMS) {
      await collectArmFailure(failures, () =>
        runSpellingArm(product, twin, arm),
      );
    }
    for (const arm of T7_9_B_ARMS) {
      await collectArmFailure(failures, () =>
        runRejectedEscapeArm(product, arm),
      );
    }
    for (const arm of T7_9_C_ARMS) {
      await collectArmFailure(failures, () =>
        runDesignationArm(product, twin, arm),
      );
    }
    if (failures.length > 0) {
      const arms = T7_9_A_ARMS.length + T7_9_B_ARMS.length + T7_9_C_ARMS.length;
      fail(
        `T7-9: ${String(failures.length)} of ${String(arms)} arms failed, ` +
          "each diagnosed below:" +
          LINE_FEED +
          failures.join(LINE_FEED),
      );
    }
  },
});

/** TEST-SPEC §7 configuration import: T7-9. */
export const section7ImportTests: readonly ProductTestEntry[] = [T7_9];
