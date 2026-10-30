// TEST-SPEC §7 configuration import — T7-9's arms (a), the specifier's
// spellings, (b), the scanner-rejected escapes, (c), the specifier's
// designations, and (d), installs. Configuration basics
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
// no git repository, and no `node_modules` but (d)'s. Every workspace is
// fresh (H-1), and every configuration and source is a staged-source record
// made at module load (S-9's timing clause: each arm's workspace is created
// after the body's first product invocation, the twin's) but (d)'s one
// configuration composed at run time (below).
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
// (d) Installs (SPEC 7: no command's outcome depends, through a
// configuration's import, on the `defineConfig` module or on whether a
// project installed it; 7.6: no name is privileged). The configuration
// imports from `"N"`, double-quoted, beside one of two stagings
// (`T7_9_D_KINDS`) at `node_modules/N`, where resolving `N` from the
// configuration file's directory, the workspace root, looks: a trap
// package — its manifest (`trapManifest`) giving `N` as its `name` and
// naming `index.js` as its entry (`main`, and `exports`), the entry
// (`TRAP_ENTRY`, a CommonJS module, so that it parses as script code too,
// S-9), if loaded, writing the marker `t7-9-trap-marker` at the workspace
// root (the parent of its own nearest `node_modules` ancestor, and nowhere
// where it has none), printing a line holding `TRAP_TELL` on each stream,
// and exiting 113 — and, separately, a `node_modules/N` holding only its
// `package.json`, a FIFO (`stageFifo`, never opened by the harness). Each
// is staged under three names: `trap` and `xspec`, the executable's name
// (`T7_9_D_FIXED_NAMES`); and the `name` the module channel's package
// manifest gives (`thirdInstallName`), read as T7.6-4(a) reads it
// (helpers/module-channel.ts `modulePackageDirectory`:
// the binding's package directory checked as every test of 7.6 checks it,
// its `package.json` read strictly by `readManifestName`), wherever that is
// a name of 7.6's grammar (`moduleNameGrammarProblem`; 7.6's exclusions
// concern TypeScript's and Node.js's resolution, which no command
// performs, so none applies) — staged once where it is `trap` or `xspec`
// (TEST-SPEC: the last two coinciding where it is `xspec`), and not at all
// where the manifest gives no such name, as TEST-SPEC stages it only where
// it is one. That name's configuration, known only once the package
// directory is read, is composed through `configImportText` and judged by
// S-9's TypeScript check, as module and as script code, before anything is
// staged (`composedInstallConfig`, as T7.6-4(a)'s composed files are), then
// staged under the per-draw declaration (`ts.perDraw`: judged again at
// staging, no module-level record being able to hold it); the fixed
// names' configurations are records. With no package directory given —
// or, on the built product's binding, one that does not exist — that
// name's two arms each fail as a diagnosed assertion failure naming the
// missing package directory: the module channel counts as part of the
// product (H-8), and an arm is never skipped (H-9) — a conservative
// choice, TEST-SPEC naming no outcome for a name it cannot read.
//
// Each name's twin — the same configuration and sources, holding no
// `node_modules` — runs first, in a workspace of its own, T7-8's
// representative commands (`T7_9_D_COMMANDS`): `build`, `check`, `ids`,
// `view specs/A.mdx`, `inventory`, `review list`, and `rename specs/A.mdx a
// b`, each under `--json`, in that order, the files each writes taken as
// T7-8 takes them (the workspace's snapshots around the run, the lock path
// pruned, H-6). Then each kind's arm runs them in its own fresh workspace,
// and after each command asserts: no marker at the workspace root, and
// neither standard output nor standard error holding `TRAP_TELL`; the
// FIFO, where staged, still a FIFO in place (`assertFifosIntact`), the
// command having ended within its own guard — all that "unopened" asserts
// (S-3); the exit outcome and standard output equal to the twin's same
// command's; the files it wrote byte-equal to those the twin's wrote
// (`assertWriteDeltasEqual`, graph data included, the two configurations
// being byte-identical; the lock path aside, H-6); and the outcome such a
// workspace gives it (H-5) — `build` and `check` exit 0 finding-free, `ids`
// 0 with its listing (`a` in `specs/A.mdx`, `b` in `specs/B.mdx`), `view`
// and `inventory` 0 finding-free, `review list` 0 listing no session and
// no finding, and the `rename` 0 with its applied mapping `specs/A.mdx#a`
// to `specs/A.mdx#b` — so that the arm stays red against S-7's stub, whose
// runs equal its twin's.
//
// Every arm runs: each arm's diagnosed failure (a `HarnessAssertionError`,
// its message naming the arm) is collected, and the body fails once at the
// end naming every failed arm, so one run diagnoses every spelling,
// designation, and install; a harness error or a hang propagates at once —
// a (c) or (d) arm's hang renamed for its arm and command, the driver's
// kill kept as its cause, so the certification runner still records the
// hang it is (helpers/hang-guards.ts `isHangGuardKill`; S-3: a tripped
// guard ends its test). Certification: T7-9 is in no
// conformer's scope (CERTIFICATIONS.md, Exclusions, "T7-9 and T7-10": its
// operative assertions are positive, each failing loud against the product
// it targets; every FIFO, (d)'s manifest among them, is asserted afterwards
// still a FIFO in place, so a staging whose effect misses fails loud).

import { Buffer } from "node:buffer";
import type { AppliedMappingPair } from "../../helpers/adapters/index.js";
import {
  decodeAppliedMappingReport,
  decodeFindingsReport,
  decodeIdsReport,
  decodeInventoryDocument,
  decodeSessionListReport,
  decodeViewReport,
} from "../../helpers/adapters/index.js";
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
import type { WriteDeltaLabels } from "../../helpers/determinism.js";
import { assertWriteDeltasEqual } from "../../helpers/determinism.js";
import { isHangGuardKill } from "../../helpers/hang-guards.js";
import { EXCLUDE_LOCK_PATH } from "../../helpers/lock-path.js";
import type { StagedLeftover } from "../../helpers/lock-staging.js";
import { assertFifosIntact, stageFifo } from "../../helpers/lock-staging.js";
import {
  moduleNameGrammarProblem,
  modulePackageDirectory,
} from "../../helpers/module-channel.js";
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
  SnapshotChange,
  SnapshotOptions,
} from "../../helpers/snapshot.js";
import {
  assertSnapshotsEqual,
  diffSnapshots,
  snapshotDirectory,
} from "../../helpers/snapshot.js";
import { stagedTs } from "../../helpers/staged-ts.js";
import type { StagedTs } from "../../helpers/staged-ts.js";
import { guardSyncStep } from "../../helpers/step-guards.js";
import type { ProductBinding, RunResult } from "../../helpers/subprocess.js";
import { runProduct, summarizeResult } from "../../helpers/subprocess.js";
import {
  judgeTypeScript,
  tsDeclarationProblem,
} from "../../helpers/ts-derivability.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { EntryKind, WorkspaceDecl } from "../../helpers/workspace.js";
import {
  assertAppliedMapping,
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
 * is not compared: its wording is free (12.0). `twinLabel` and `rule` name
 * the twin and why (defaulting to (a)'s, (c)'s, and their `"xspec"` twin's).
 */
function assertAnswersAsTwin(
  result: RunResult,
  twin: RunResult,
  context: string,
  twinLabel = `its twin importing from ${CONFIG_IMPORT_TWIN_LITERAL}`,
  rule = TWIN_RULE,
): void {
  if (result.exitCode !== twin.exitCode || result.signal !== twin.signal) {
    fail(
      `${context}: it exits exactly as on ${twinLabel} — ${rule}; the arm: ` +
        `${summarizeResult(result)}; the twin: ${summarizeResult(twin)}`,
    );
  }
  assertBytesEqual(
    result.stdoutBytes,
    twin.stdoutBytes,
    `${context}: its standard output is byte-equal to the twin's — ${rule}`,
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
 * A (c) or (d) arm's command, `argv` run from the workspace root within
 * the driver's own guard (S-3). Its hang propagates at once, ending the test
 * (S-3: a tripped guard ends its test), renamed for the arm and the command
 * — `blocked` saying what a product blocking there opened — with the
 * driver's kill as its cause, so the certification runner still records it
 * as the hang it is (`isHangGuardKill`); anything else the run rejects with
 * propagates unchanged.
 */
async function runGuardedCommand(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  context: string,
  blocked: string,
): Promise<RunResult> {
  try {
    return await runProduct(product, { cwd: workspace.root, argv });
  } catch (error) {
    if (!isHangGuardKill(error)) throw error;
    throw new Error(
      `${context}: the command did not end within its own guard, which ` +
        `killed it — ${blocked} (S-3: a tripped guard ends its test) — ` +
        (error instanceof Error ? error.message : String(error)),
      { cause: error },
    );
  }
}

/** Why a (c) command's hang is the product's (module header). */
const DESIGNATION_BLOCKED =
  "a product opening what the specifier designates, a FIFO with no " +
  "writer among them, blocks there, where xspec never resolves, reads, or " +
  "loads the specifier (SPEC 7; TEST-SPEC T7-9(c))";

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
        const result = await runGuardedCommand(
          product,
          workspace,
          [command.word, "--json"],
          context,
          DESIGNATION_BLOCKED,
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
// (d) Installs: the names, the trap package, and the FIFO manifest

/** T7-9(d)'s first name (module header). */
const TRAP_NAME = "trap";
/** T7-9(d)'s second name, the executable's (module header). */
const EXECUTABLE_NAME = "xspec";

/** The marker the trap's entry writes at the workspace root, if loaded. */
const TRAP_MARKER = "t7-9-trap-marker";
/** What every line the trap's entry prints holds, on either stream. */
const TRAP_TELL = "T7-9(d) trap entry ran";
/**
 * The trap's exit code: non-zero, outside 12.0's partition (0, 1, 2), and
 * apart from S-7's stub's 87, so that a diagnosis quoting it names the trap.
 */
const TRAP_EXIT_CODE = 113;

/** A package's manifest within its directory (SPEC 7.6). */
const PACKAGE_MANIFEST = "package.json";
/** The trap package's entry within its directory, its manifest naming it. */
const TRAP_ENTRY_FILE = "index.js";

/**
 * The trap package's entry (module header): a CommonJS module that, if
 * loaded, finds its own nearest `node_modules` ancestor and writes the
 * marker in that directory's parent, the workspace root (nowhere where it
 * finds none), prints a line holding `TRAP_TELL` on each stream, and exits
 * `TRAP_EXIT_CODE`. Its strings are plain ASCII, with no backslash (checked
 * at load): its line feed is built from its code point when it runs.
 */
const TRAP_ENTRY_TEXT = [
  '"use strict";',
  'const fs = require("node:fs");',
  'const path = require("node:path");',
  "const lineFeed = String.fromCharCode(10);",
  "let holder = __dirname;",
  'while (path.basename(holder) !== "node_modules") {',
  "  const parent = path.dirname(holder);",
  "  if (parent === holder) break;",
  "  holder = parent;",
  "}",
  'if (path.basename(holder) === "node_modules") {',
  "  fs.writeFileSync(",
  `    path.join(path.dirname(holder), ${JSON.stringify(TRAP_MARKER)}),`,
  `    ${JSON.stringify(TRAP_TELL)} + lineFeed`,
  "  );",
  "}",
  `process.stdout.write(${JSON.stringify(`${TRAP_TELL}: standard output`)} + lineFeed);`,
  `process.stderr.write(${JSON.stringify(`${TRAP_TELL}: standard error`)} + lineFeed);`,
  `process.exit(${String(TRAP_EXIT_CODE)});`,
  "",
].join(LINE_FEED);

const TRAP_ENTRY: StagedTs = stagedTs(
  `T7-9 node_modules/N/${TRAP_ENTRY_FILE} ((d) the trap package's entry under each name N: if loaded, it writes the marker ${TRAP_MARKER} at the workspace root, prints a line on each stream, and exits ${String(TRAP_EXIT_CODE)})`,
  TRAP_ENTRY_TEXT,
);

/**
 * The trap package's manifest under `name` (module header): `name` itself,
 * a version, and the entry for every resolution — `main`, and `exports` —
 * so that a product resolving `N` from the configuration file's directory
 * and loading it runs the trap. Plain JSON, which nothing judges (S-9).
 */
function trapManifest(name: string): string {
  const manifest = {
    name,
    version: "1.0.0",
    main: TRAP_ENTRY_FILE,
    exports: `./${TRAP_ENTRY_FILE}`,
  };
  return JSON.stringify(manifest, null, 2) + LINE_FEED;
}

/** One of T7-9(d)'s names N (module header), with its configuration. */
interface InstallName {
  readonly name: string;
  /** How diagnoses describe the name beside its spelling. */
  readonly what: string;
  /**
   * The configuration importing from `"N"`, double-quoted: a record for a
   * fixed name, else the text composed once the package directory was
   * read, declared per draw (module header).
   */
  readonly config: StagedTs | string;
}

/** The configuration importing from `"N"`, double-quoted (module header). */
function installConfigText(name: string): string {
  return configImportText(DOUBLE_QUOTE + name + DOUBLE_QUOTE);
}

/** T7-9(d)'s two fixed names (module header), each configuration a record. */
const T7_9_D_FIXED_NAMES: readonly InstallName[] = [
  {
    name: TRAP_NAME,
    what: "the name trap",
    config: stagedTs(
      'T7-9 xspec.config.ts ((d) importing from "trap": beside the trap package or the FIFO manifest at node_modules/trap, and in its twin)',
      installConfigText(TRAP_NAME),
    ),
  },
  {
    name: EXECUTABLE_NAME,
    what: "xspec, the executable's name",
    config: CONFIG_IMPORT_TWIN_CONFIG,
  },
];

// The module-load self-checks of (d)'s staging (module header): the trap's
// entry holds no backslash and its tell no character JSON or a line could
// re-spell; each fixed name is a name of 7.6's grammar — so that a
// manifest's name equal to it is recognized as it — and its configuration's
// bytes are the builder's over the double-quoted name.
if (
  occurrences(TRAP_ENTRY_TEXT, BACKSLASH) !== 0 ||
  !/^[A-Za-z0-9 ():-]+$/.test(TRAP_TELL) ||
  !/^[a-z0-9.-]+$/.test(TRAP_MARKER)
) {
  throw new Error(
    "T7-9(d): the trap's entry holds a backslash, or its tell or marker a " +
      "character outside plain ASCII words (module header)",
  );
}
for (const fixed of T7_9_D_FIXED_NAMES) {
  const problem = moduleNameGrammarProblem(fixed.name);
  if (
    problem !== null ||
    typeof fixed.config === "string" ||
    fixed.config.source !== installConfigText(fixed.name)
  ) {
    throw new Error(
      `T7-9(d): the fixed name ${JSON.stringify(fixed.name)} ` +
        (problem === null
          ? "has no configuration record whose bytes are the builder's over " +
            "the double-quoted name"
          : `is no name of 7.6's grammar: it ${problem}`) +
        " (module header)",
    );
  }
}

/** T7-9(d)'s two stagings at `node_modules/N` (module header). */
type InstallKind = "trap" | "fifo";

/** The stagings, in the order each name's arms run. */
const T7_9_D_KINDS: readonly InstallKind[] = ["trap", "fifo"];

/** `node_modules/N`, workspace-relative. */
function installedDirectory(name: string): string {
  return `node_modules/${name}`;
}

/** An arm as diagnoses name it. */
function installArmLabel(installName: InstallName, kind: InstallKind): string {
  const { name } = installName;
  const at = installedDirectory(name);
  return (
    `importing from ${JSON.stringify(name)} (${installName.what}) ` +
    (kind === "trap"
      ? `beside a trap package at ${at}`
      : `beside ${at} whose ${PACKAGE_MANIFEST} is a FIFO`)
  );
}

/**
 * A (d) workspace (module header): the configuration and the two sources,
 * and, for an arm, its staging's files and directories — the trap package's
 * manifest and entry, or the directory the FIFO manifest is made in once
 * the workspace stands. A composed configuration is declared per draw.
 */
function installDecl(
  installName: InstallName,
  kind?: InstallKind,
): WorkspaceDecl {
  const at = installedDirectory(installName.name);
  return {
    files: {
      [CONFIG_IMPORT_CONFIG_PATH]: installName.config,
      ...CONFIG_IMPORT_SOURCES,
      ...(kind === "trap"
        ? {
            [`${at}/${PACKAGE_MANIFEST}`]: trapManifest(installName.name),
            [`${at}/${TRAP_ENTRY_FILE}`]: TRAP_ENTRY,
          }
        : {}),
    },
    ...(kind === "fifo" ? { dirs: [at] } : {}),
    ...(typeof installName.config === "string"
      ? { ts: { perDraw: [CONFIG_IMPORT_CONFIG_PATH] } }
      : {}),
  };
}

/**
 * The configuration importing from `name`, composed once the package
 * directory is read (module header): `installConfigText` over it, judged by
 * S-9's TypeScript check — accepted as module code and as script code —
 * before anything is staged, a failure a harness error (H-11), as
 * T7.6-4(a)'s composed files' is.
 */
function composedInstallConfig(name: string, context: string): string {
  const text = installConfigText(name);
  const problem = guardSyncStep(
    `judging the configuration importing from ${JSON.stringify(name)} ` +
      "(T7-9(d), S-9)",
    () =>
      tsDeclarationProblem(
        judgeTypeScript(text, CONFIG_IMPORT_CONFIG_PATH),
        "well-formed",
      ),
  );
  if (problem !== undefined) {
    throw new HarnessStagingError(
      "ts-derivability",
      CONFIG_IMPORT_CONFIG_PATH,
      `${context}: the configuration importing from ${JSON.stringify(name)}, ` +
        `composed once the package directory was read, is ${problem} ` +
        "(TEST-SPEC S-9: a composed configuration file is judged " +
        "well-formed before the product is driven on it)",
    );
  }
  return text;
}

/**
 * T7-9(d)'s third name (module header): the name the module channel's
 * package manifest gives, staged as `name`; none to stage where the
 * manifest gives no name of 7.6's grammar, or one of the fixed names; or
 * the diagnosis its missing package directory is (H-8, H-9).
 */
type ThirdInstallName =
  | { readonly kind: "name"; readonly installName: InstallName }
  | { readonly kind: "none" }
  | { readonly kind: "missing"; readonly diagnosis: string };

/** How diagnoses name the third name where it cannot be read. */
const THIRD_NAME_CONTEXT =
  "T7-9(d), under its third name, the name the module channel's package " +
  "manifest gives";

/**
 * Read T7-9(d)'s third name off `product`'s package directory, as
 * T7.6-4(a) reads it (module header): the directory checked by
 * `modulePackageDirectory`, its manifest read strictly. None given, or the
 * built product's missing one, is a diagnosis to record for each of the
 * name's arms; every other refusal of the directory is a harness error.
 */
async function thirdInstallName(
  product: ProductBinding,
): Promise<ThirdInstallName> {
  if (product.packageDir === undefined) {
    const executable = [product.command, ...(product.prefixArgs ?? [])];
    return {
      kind: "missing",
      diagnosis:
        `${product.label}: no package directory is given beside the ` +
        `executable (${executable.join(" ")}), so that name cannot be ` +
        "read — the module channel counts as part of the product " +
        "(TEST-SPEC H-8) and an arm is never skipped (H-9), so each of its " +
        "arms fails here, diagnosed. Give the directory " +
        ".github/scripts/pack-package.sh prints as XSPEC_PACKAGE_DIR " +
        "(AGENTS.md). Nothing was staged.",
    };
  }
  let manifestName: string | undefined;
  try {
    const pkg = await modulePackageDirectory(
      product,
      "T7-9(d), reading its third name",
    );
    manifestName = pkg.manifestName.name;
  } catch (error) {
    if (!(error instanceof HarnessAssertionError)) throw error;
    return { kind: "missing", diagnosis: error.message };
  }
  if (
    manifestName === undefined ||
    moduleNameGrammarProblem(manifestName) !== null ||
    T7_9_D_FIXED_NAMES.some((fixed) => fixed.name === manifestName)
  ) {
    return { kind: "none" };
  }
  return {
    kind: "name",
    installName: {
      name: manifestName,
      what: "the name the module channel's package manifest gives",
      config: composedInstallConfig(manifestName, THIRD_NAME_CONTEXT),
    },
  };
}

// ---------------------------------------------------------------------------
// (d) Installs: the representative commands

/** One of T7-9(d)'s representative commands (T7-8's), under `--json`. */
interface InstallCommand {
  readonly argv: readonly string[];
  /** The outcome such a workspace gives it (H-5; module header). */
  readonly expect: (result: RunResult, context: string) => void;
}

/** One `{file, ids}` entry of `ids`'s flat listing (SPEC 12.3). */
interface IdsListingEntry {
  readonly file: string;
  readonly ids: readonly string[];
}

/** A listing sorted bytewise by file path (membership is the subject). */
function sortedIdsListing(
  entries: readonly IdsListingEntry[],
): IdsListingEntry[] {
  return entries
    .map((entry) => ({ file: entry.file, ids: entry.ids }))
    .sort((a, b) =>
      Buffer.compare(Buffer.from(a.file, "utf8"), Buffer.from(b.file, "utf8")),
    );
}

/** Every (d) workspace's discovered set: `a` and `b`, by file (SPEC 12.3). */
const T7_9_D_LISTING: readonly IdsListingEntry[] = [
  { file: "specs/A.mdx", ids: ["a"] },
  { file: "specs/B.mdx", ids: ["b"] },
];

/** The representative `rename`'s applied mapping (SPEC 6.4, 12.7). */
const T7_9_D_MAPPING: readonly AppliedMappingPair[] = [
  { from: "specs/A.mdx#a", to: "specs/A.mdx#b" },
];

/**
 * T7-9(d)'s commands (module header): T7-8's representative commands, each
 * under `--json`, in TEST-SPEC's order — the `rename`, the one writing
 * sources, last — each with the outcome such a workspace gives it (H-5).
 */
const T7_9_D_COMMANDS: readonly InstallCommand[] = [
  {
    argv: ["build", "--json"],
    expect: (result, context) => {
      expectFindingFree(result, context, "SPEC 12.1");
    },
  },
  {
    argv: ["check", "--json"],
    expect: (result, context) => {
      expectFindingFree(result, context, "SPEC 12.2: graph data current");
    },
  },
  {
    argv: ["ids", "--json"],
    expect: (result, context) => {
      assertExitCode(
        result,
        0,
        `${context} — a valid workspace's ` +
          "`ids` answers, exit 0 (SPEC 12.3, 13.3; H-5)",
      );
      const report = decodeIdsReport(parseJsonStdout(result, context), context);
      assertSameJson(
        sortedIdsListing(report.files),
        sortedIdsListing(T7_9_D_LISTING),
        `${context}: its listing — requirement IDs grouped by file, compared ` +
          "bytewise-sorted by path — is the workspace's discovered set, a " +
          "in specs/A.mdx and b in specs/B.mdx (SPEC 12.3, 7)",
      );
    },
  },
  {
    argv: ["view", "specs/A.mdx", "--json"],
    expect: (result, context) => {
      assertExitCode(
        result,
        0,
        `${context} — ` +
          "`view` answers for a discovered source, exit 0 (SPEC 11.4, 12.0; H-5)",
      );
      assertSameJson(
        decodeViewReport(
          parseJsonStdout(result, context),
          { text: false },
          context,
        ).findings,
        [],
        `${context}: the answer is finding-free — the workspace is valid ` +
          "(SPEC 11.4, 11.2)",
      );
    },
  },
  {
    argv: ["inventory", "--json"],
    expect: (result, context) => {
      assertExitCode(
        result,
        0,
        `${context} — ` + "`inventory` answers, exit 0 (SPEC 11.6, 12.0; H-5)",
      );
      assertSameJson(
        decodeInventoryDocument(parseJsonStdout(result, context), context)
          .findings,
        [],
        `${context}: the inventory is finding-free — no journal, session, ` +
          "or record condition stands on the workspace (SPEC 11.6)",
      );
    },
  },
  {
    argv: ["review", "list", "--json"],
    expect: (result, context) => {
      assertExitCode(
        result,
        0,
        `${context} — ` +
          "`review list` answers, exit 0 (SPEC 10.7, 10.1; H-5)",
      );
      const listing = decodeSessionListReport(
        parseJsonStdout(result, context),
        context,
      );
      assertSameJson(
        { sessions: listing.sessions, findings: listing.findings ?? [] },
        { sessions: [], findings: [] },
        `${context}: no session is listed and no finding reported — the ` +
          "workspace holds no session directory (SPEC 10.1: an absent " +
          "session directory holds no sessions; 10.7)",
      );
    },
  },
  {
    argv: ["rename", "specs/A.mdx", "a", "b", "--json"],
    expect: (result, context) => {
      assertExitCode(
        result,
        0,
        `${context} — the rename applies, exit 0 (SPEC 6.4, 12.0; H-5)`,
      );
      assertAppliedMapping(
        decodeAppliedMappingReport(parseJsonStdout(result, context), context),
        T7_9_D_MAPPING,
        `${context}: its applied mapping is exactly specs/A.mdx#a → ` +
          "specs/A.mdx#b — IDs are unique within a file, so b in " +
          "specs/B.mdx collides with nothing (SPEC 6.4, 12.7)",
      );
    },
  },
];

/** A (d) command as diagnoses name it. */
function installCommandLabel(command: InstallCommand): string {
  return "`" + command.argv.join(" ") + "`";
}

// ---------------------------------------------------------------------------
// (d) Installs: the twins and the arms

/** Why each (d) answer must be the twin's (TEST-SPEC T7-9(d); SPEC 7, 7.6). */
const INSTALL_RULE =
  "no command's outcome depends, through a configuration's import, on the " +
  "defineConfig module or on whether a project installed it, and no name " +
  "is privileged: xspec never executes the configuration and never " +
  "resolves or loads its import, so nothing node_modules holds reaches an " +
  "answer (SPEC 7, 7.6; TEST-SPEC T7-9(d))";

/** Why a (d) command's hang is the product's (module header). */
const INSTALL_BLOCKED =
  "a product resolving or loading the configuration's import opens the " +
  "installed package's manifest, here a FIFO with no writer, and blocks " +
  "there, where xspec never resolves or loads the import (SPEC 7, 7.6; " +
  "TEST-SPEC T7-9(d))";

/** A (d) arm's twin, as diagnoses name it. */
const INSTALL_TWIN_LABEL =
  "its twin, the same workspace and configuration holding no node_modules";

/** How the written-file compare names a (d) arm's two runs. */
const T7_9_D_TWIN_LABELS: WriteDeltaLabels = {
  first: "the arm's workspace",
  second: "its twin",
  pair: "the arm's workspace and its twin",
};

/** One of a (d) twin's runs: its result, and the files it wrote. */
interface InstallTwinRun {
  readonly result: RunResult;
  /** Its workspace's changes across the run (the lock path pruned, H-6). */
  readonly delta: readonly SnapshotChange[];
  /** Its workspace after the run (the lock path pruned). */
  readonly after: DirectorySnapshot;
}

/**
 * A name's twin (module header): its configuration and the two sources in
 * a fresh workspace holding no `node_modules`, the commands run in order,
 * each with the files it writes — the workspace's snapshots around the
 * run, the lock path pruned (H-6). The workspace is disposed once they are
 * taken; a run the twin's guard kills propagates as the hang it is.
 */
async function runInstallTwin(
  product: ProductBinding,
  installName: InstallName,
): Promise<readonly InstallTwinRun[]> {
  const workspace = await TestWorkspace.create(installDecl(installName));
  try {
    const runs: InstallTwinRun[] = [];
    for (const command of T7_9_D_COMMANDS) {
      const before = await snapshotDirectory(workspace.root, EXCLUDE_LOCK_PATH);
      const result = await runProduct(product, {
        cwd: workspace.root,
        argv: command.argv,
      });
      const after = await snapshotDirectory(workspace.root, EXCLUDE_LOCK_PATH);
      runs.push({ result, delta: diffSnapshots(before, after), after });
    }
    return runs;
  } finally {
    await workspace.dispose();
  }
}

/**
 * After each (d) command (module header): no marker at the workspace root,
 * and neither standard output nor standard error holding the trap's tell —
 * the trap package's entry never ran.
 */
async function assertTrapNeverRan(
  workspace: TestWorkspace,
  result: RunResult,
  context: string,
): Promise<void> {
  const marker = await workspace.kind(TRAP_MARKER);
  if (marker !== "absent") {
    fail(
      `${context}: the trap's marker ${TRAP_MARKER} stands at the ` +
        `workspace root (${marker}) — the trap package's entry ran, ` +
        `loaded through the configuration's import — where ${INSTALL_RULE}; ` +
        summarizeResult(result),
    );
  }
  const streams: ReadonlyArray<readonly [string, Uint8Array]> = [
    ["standard output", result.stdoutBytes],
    ["standard error", result.stderrBytes],
  ];
  for (const [stream, bytes] of streams) {
    if (Buffer.from(bytes).includes(TRAP_TELL)) {
      fail(
        `${context}: its ${stream} carries what the trap package's entry ` +
          `prints (${JSON.stringify(TRAP_TELL)}) — the entry ran, loaded ` +
          `through the configuration's import — where ${INSTALL_RULE}; ` +
          summarizeResult(result),
      );
    }
  }
}

/**
 * One (d) arm (module header): a fresh workspace staging `installName`'s
 * configuration, the two sources, and `kind`'s staging at `node_modules/N`
 * — the FIFO made and verified once the workspace stands, never opened by
 * the harness — then each command in order: the trap never ran, the FIFO
 * still in place, the twin's answer and written files, and the outcome
 * such a workspace gives it (H-5).
 */
async function runInstallArm(
  product: ProductBinding,
  installName: InstallName,
  kind: InstallKind,
  twin: readonly InstallTwinRun[],
): Promise<void> {
  const label = installArmLabel(installName, kind);
  const manifest = `${installedDirectory(installName.name)}/${PACKAGE_MANIFEST}`;
  const workspace = await TestWorkspace.create(installDecl(installName, kind));
  try {
    const fifo: StagedLeftover | undefined =
      kind === "fifo" ? await stageFifo(workspace, manifest) : undefined;
    for (const [index, command] of T7_9_D_COMMANDS.entries()) {
      const twinRun = twin[index];
      if (twinRun === undefined) {
        throw new Error(
          `T7-9(d): no twin run for ${installCommandLabel(command)}`,
        );
      }
      const context = `T7-9(d), ${label}: ${installCommandLabel(command)}`;
      const before = await snapshotDirectory(workspace.root, EXCLUDE_LOCK_PATH);
      const result = await runGuardedCommand(
        product,
        workspace,
        command.argv,
        context,
        INSTALL_BLOCKED,
      );
      const after = await snapshotDirectory(workspace.root, EXCLUDE_LOCK_PATH);
      await assertTrapNeverRan(workspace, result, context);
      if (fifo !== undefined) {
        await assertFifosIntact(
          fifo,
          `${context}: ${manifest} is still a FIFO in place, the command ` +
            "having ended within its own guard — unopened, as xspec never " +
            "resolves or loads the configuration's import (SPEC 7, 7.6; " +
            "TEST-SPEC T7-9(d), S-3)",
        );
      }
      assertAnswersAsTwin(
        result,
        twinRun.result,
        context,
        INSTALL_TWIN_LABEL,
        INSTALL_RULE,
      );
      assertWriteDeltasEqual(
        diffSnapshots(before, after),
        after,
        twinRun.delta,
        twinRun.after,
        `${context}: the files it writes are byte-equal to those the same ` +
          `command writes on ${INSTALL_TWIN_LABEL}, the two configurations ` +
          "byte-identical (TEST-SPEC T7-9(d); H-6: the lock path left out " +
          "of every written-file compare across workspaces)",
        T7_9_D_TWIN_LABELS,
      );
      command.expect(result, context);
    }
  } finally {
    await workspace.dispose();
  }
}

/**
 * T7-9(d) (module header): the third name read first, so that a refused
 * package directory ends the body before anything runs; then each name in
 * turn — `trap`, `xspec`, and the manifest's where staged — its twin, then
 * its two arms, each arm's diagnosed failure collected into `failures`;
 * with the third name's package directory missing, a diagnosis for each of
 * its arms. Returns how many arms it counted.
 */
async function runInstalls(
  product: ProductBinding,
  failures: string[],
): Promise<number> {
  const third = await thirdInstallName(product);
  const names: readonly InstallName[] =
    third.kind === "name"
      ? [...T7_9_D_FIXED_NAMES, third.installName]
      : T7_9_D_FIXED_NAMES;
  let arms = 0;
  for (const installName of names) {
    const twin = await runInstallTwin(product, installName);
    for (const kind of T7_9_D_KINDS) {
      arms += 1;
      await collectArmFailure(failures, () =>
        runInstallArm(product, installName, kind, twin),
      );
    }
  }
  if (third.kind === "missing") {
    for (const kind of T7_9_D_KINDS) {
      arms += 1;
      failures.push(
        `${THIRD_NAME_CONTEXT}, its arm beside ` +
          (kind === "trap"
            ? "a trap package"
            : `a ${PACKAGE_MANIFEST} that is a FIFO`) +
          `: ${third.diagnosis}`,
      );
    }
  }
  return arms;
}

// ---------------------------------------------------------------------------
// Registration

const T7_9 = defineProductTest({
  id: "T7-9",
  title:
    "configuration import (TEST-SPEC T7-9 (a), (b), (c), (d)): on a valid " +
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
    "ending within its guard; (d) the configuration importing from " +
    '"N" beside a trap package at node_modules/N — its manifest naming an ' +
    "entry that, if loaded, writes a marker into the workspace, prints to " +
    "both streams, and exits non-zero — and, separately, beside a " +
    "node_modules/N whose package.json is a FIFO, under each of the names " +
    "trap, xspec, and the name the module channel's package manifest " +
    "gives, wherever that is a name of 7.6's grammar (no package " +
    "directory given, its arms fail diagnosed): `build`, `check`, `ids`, " +
    "`view specs/A.mdx`, `inventory`, `review list`, and `rename " +
    "specs/A.mdx a b`, each under `--json`, exit and answer exactly as on " +
    "the twin holding no node_modules — exit code and standard output " +
    "equal, the files each writes byte-equal, the lock path aside — and " +
    "as such a workspace gives them (`build` and `check` 0 finding-free, " +
    "`ids` 0 with its listing, `view` and `inventory` 0 finding-free, " +
    "`review list` 0, the `rename` 0 with its applied mapping), no marker " +
    "written, neither stream carrying what the entry prints, the FIFO " +
    "after each command still a FIFO in place, each command ending within " +
    "its guard (SPEC 7, 7.6, 2.4, 12.7, 14; S-3)",
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
    const installArms = await runInstalls(product, failures);
    if (failures.length > 0) {
      const arms =
        T7_9_A_ARMS.length +
        T7_9_B_ARMS.length +
        T7_9_C_ARMS.length +
        installArms;
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
