// TEST-SPEC §16 P-15 (leftover trees) — PROP-13.
//
// One registered product-facing property test (C-2 "one code path") over
// SPEC 13.5's removal of leftovers: acquisition removes every leftover in
// the lock directory `.xspec/lock` — everything there but its own entry, a
// directory with all it holds and a symbolic link itself, never its target —
// and reads no file's content. T13.5-10(b)'s fixed trees anchor the property
// (section-13.5-ii.ts); this module searches the trees they never stage. A
// seeded, reproducible generator (helpers/property.ts, H-10; the fixed seed
// set in CI, E-5) draws, per trial, one mutating command and one leftover
// tree for the lock directory:
//
//   * varied depth and breadth — up to MAX_TOP entries at the lock
//     directory's top level and MAX_BREADTH in each directory below it,
//     directories nested so that leftovers lie up to MAX_LEVEL levels deep,
//     about MAX_NODES leftovers per tree at most (a soft bound);
//   * names of many first bytes and byte sequences, each unique in its
//     directory (a `-<n>` suffix, its position there): plain ASCII names;
//     names beginning with `.` (one, two, or three dots before a stem —
//     never `.` or `..` themselves); names that are not valid UTF-8
//     (INVALID_UTF8: lone continuation bytes, bytes UTF-8 never uses, a
//     lead byte without its continuation, a truncated sequence, overlong
//     and surrogate encodings, and sequences past U+10FFFF — opening a name
//     or inside it, after `.` or not), on the Linux leg, P-15's only leg;
//     valid UTF-8 beyond ASCII (U+FFFD excluded, so that no name spells
//     another's replacement-character decoding); and names opening with a
//     byte a command line or a glob reads specially (`-`, a space, `~`,
//     `#`, `*`, `[`) or with a control byte;
//   * plain files below the top level, some with every permission removed
//     (mode 0o000, the harness's own read of each verified refused), some
//     read-only, their contents arbitrary bytes;
//   * symbolic links to directories outside the workspace — each holding at
//     least one plain file, every directory in it listable, searchable, and
//     writable (CONF-LEFTOVER's staging constraint: an empty target leaves a
//     removal that follows the link nothing to delete) — to plain files
//     outside it, and dangling ones, their targets absent from a writable
//     directory outside it;
//   * FIFOs;
//
// the lock directory's own top level holding no plain file (TEST-SPEC P-15
// and T13.5-10(b): such a file may read as an entry in 13.5's gap, which
// MAY refuse) and every generated directory listable, searchable, and
// writable (mode 0o755), so the outcome is never a refused read's or a
// refused write's (T13.5-10(d) stages those). The tree is staged on a
// freshly built valid workspace holding an `audit` session `s` created
// while it was valid — T13.5-10's session staging on its CONF-CORE-shaped
// workspace (`stageArmWorkspace`, CORE_DECL), fresh for each draw — by the
// leftover builder (helpers/lock-staging.ts `stageLeftover`: names staged
// as their exact bytes, never decoded, the staging hazard CONF-LEFTOVER's
// justification names), which verifies it on the harness itself before the
// product runs (an ineffective staging a harness error, E-1, H-11, never a
// pass or a skip).
//
// Each draw runs its command — one of T13.5-10's five: `rename`, file-form
// `move`, `review create --strategy audit`, `resolve`, and `split`
// (T13_5_10_OPERATIONS, within CONF-LEFTOVER's surface), each an operation
// succeeding on its leftover-free twin (`unstagedTwin`: the same staging,
// nothing at the lock path, run once per command before any draw; twins are
// no draws) — under `--json`, and holds it to T13.5-10(b)'s takeover outcome
// (`assertTakeover`, the anchor's own machinery, which
// VIOL-LEFTOVER-FOLLOWLINK's certification of P-15 exercises):
//
//   * it completes promptly (`runBounded`, a hang guard only, H-10), so no
//     FIFO is opened: a reader opening a FIFO with no writer blocks;
//   * it exits 0, its result — exit code, standard output and error, and
//     final workspace (H-6: the lock path aside) — byte-equal to its twin's;
//   * `.xspec/lock` is absent once it ends;
//   * every link's target outside the workspace is byte-identical
//     afterward, nothing written through a link (13.4).
//
// So P-15 fails a product whose removal skips names beginning with `.`,
// mis-decodes a name that is not valid UTF-8 and so cannot remove it, stops
// short of a tree's depth, or follows a link.
//
// Certification: §CONF-LEFTOVER (P-15 in scope; the CONF-CORE product run
// deviation-free from test/fixtures/conf-leftover/bin.mjs) and its three
// violators, VIOL-LEFTOVER-FOLLOWLINK, -DOTNAMES, and -BYTENAMES, each
// failing P-15 at the fixed seeds, whose draws reach every class each one
// turns on — a link to a directory, a name beginning with `.`, a name that
// is not valid UTF-8 — at the lock directory's top level and nested in a
// directory acquisition lists to remove (CERTIFICATIONS.md's criterion (a)
// reachability case; test/self/p15-fixed-seed-draws.test.ts pins it, with
// the depth, the permission removals, the FIFOs, the link kinds, the name
// classes, and the five commands the draws reach).

import { Buffer } from "node:buffer";
import { LOCK_PATH } from "../../helpers/lock-path.js";
import type {
  LeftoverChild,
  LeftoverNode,
  OutsideChild,
  OutsideTarget,
} from "../../helpers/lock-staging.js";
import { renderRel, stageLeftover } from "../../helpers/lock-staging.js";
import type { Choices, Gen } from "../../helpers/property.js";
import { checkProperty } from "../../helpers/property.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import { CORE_DECL, runBounded, SPECS_ONLY_CONFIG } from "./section-13.5.js";
import type { UnstagedTwin } from "./section-13.5-ii.js";
import {
  assertTakeover,
  stageArmWorkspace,
  T13_5_10_OPERATIONS,
  unstagedTwin,
} from "./section-13.5-ii.js";

/**
 * Trials per fixed seed (E-5): the default three seeds, twelve draws, each a
 * fresh workspace, its session staging, a staged tree, and one command.
 * test/self/p15-fixed-seed-draws.test.ts replays exactly these.
 */
export const P15_RUNS_PER_SEED = 4;

/** Shrink budget, in draws (helpers/property.ts): each costs a full draw. */
const P15_MAX_SHRINK_EXECUTIONS = 8;

/** Entries at the lock directory's top level: at least one. */
export const MAX_TOP = 4;
/** Entries in each generated directory below the top level: none or more. */
export const MAX_BREADTH = 4;
/** The deepest level a leftover lies at, the lock directory's own entries at 1. */
export const MAX_LEVEL = 5;
/**
 * Leftovers per tree, every level counted: a directory draws no more
 * entries than remain — a soft bound, a directory's later siblings drawn
 * once its own subtree has spent it.
 */
const MAX_NODES = 24;

/** One P-15 draw: the command, and the lock directory's top-level leftovers. */
export interface P15Draw {
  /** The command's index in T13_5_10_OPERATIONS. */
  readonly operation: number;
  /**
   * The leftover tree the lock directory holds: never a plain file at its
   * top level, every name exact bytes (a `Buffer`), unique in its directory.
   */
  readonly tree: readonly LeftoverChild[];
}

// ---------------------------------------------------------------------------
// The generator

type DrawnKind = "dir" | "file" | "symlink" | "fifo";

/** Kinds at the lock directory's top level: never a plain file. */
const TOP_KINDS: ReadonlyArray<readonly [number, DrawnKind]> = [
  [3, "dir"],
  [2, "symlink"],
  [2, "fifo"],
];
/** Kinds below the top level, above MAX_LEVEL. */
const NESTED_KINDS: ReadonlyArray<readonly [number, DrawnKind]> = [
  [4, "file"],
  [3, "dir"],
  [2, "symlink"],
  [1, "fifo"],
];
/** Kinds at MAX_LEVEL, where no directory is drawn. */
const DEEPEST_KINDS: ReadonlyArray<readonly [number, DrawnKind]> = [
  [4, "file"],
  [2, "symlink"],
  [1, "fifo"],
];

/** A plain file's mode: every permission removed, or read-only, or neither. */
const FILE_MODES: ReadonlyArray<readonly [number, number]> = [
  [3, 0o644],
  [2, 0o000],
  [1, 0o444],
];

/** What a plain file holds: never read by a conforming acquisition. */
const FILE_CONTENTS: readonly (string | Uint8Array)[] = [
  "A leftover the harness staged.\n",
  "",
  Uint8Array.from([0xff, 0x00, 0xfe, 0x0a]),
];

type TargetKind = "dir" | "file" | "dangling";

const TARGET_KINDS: ReadonlyArray<readonly [number, TargetKind]> = [
  [3, "dir"],
  [2, "file"],
  [2, "dangling"],
];

/** What each plain file outside the workspace holds. */
const OUTSIDE_TEXT = "Held outside the workspace.\n";

type NameForm = "plain" | "dot" | "bytes" | "dot-bytes" | "text" | "edge";

const NAME_FORMS: ReadonlyArray<readonly [number, NameForm]> = [
  [6, "plain"],
  [3, "dot"],
  [3, "bytes"],
  [1, "dot-bytes"],
  [1, "text"],
  [1, "edge"],
];

const PLAIN_STEMS: readonly string[] = ["leftover", "stale", "x"];

/** Prefixes of names beginning with `.`: a stem always follows. */
export const DOT_PREFIXES: readonly string[] = [".", "..", "..."];

/** What precedes an ill-formed sequence in a name not beginning with `.`. */
export const BYTE_PREFIXES: readonly string[] = ["", "stale"];

/**
 * Byte sequences that are not valid UTF-8 wherever a name places them —
 * after nothing, `stale`, or dots, before the `-<n>` suffix: lone
 * continuation bytes, bytes UTF-8 never uses, a two-byte lead before `(`, an
 * overlong `/`, a three-byte sequence cut short, a UTF-16 surrogate, a
 * sequence past U+10FFFF, and a five-byte form.
 */
export const INVALID_UTF8: readonly (readonly number[])[] = [
  [0xff],
  [0xfe],
  [0x80],
  [0xbf],
  [0xc3, 0x28],
  [0xc0, 0xaf],
  [0xe2, 0x82],
  [0xed, 0xa0, 0x80],
  [0xf4, 0x90, 0x80, 0x80],
  [0xf8, 0x88, 0x80, 0x80, 0x80],
];

const cp = (...codes: number[]): string => String.fromCodePoint(...codes);

/** Valid UTF-8 beyond ASCII: two-, three-, and four-byte forms, a combining mark. */
const TEXT_STEMS: readonly string[] = [
  `${cp(0xe9)}t`,
  cp(0x65e5, 0x672c),
  cp(0x1f5c2),
  `e${cp(0x301)}`,
];

/** First bytes a command line or a glob reads specially, and control bytes. */
const EDGE_FIRST_BYTES: readonly number[] = [
  0x2d, 0x20, 0x7e, 0x23, 0x2a, 0x5b, 0x01, 0x0a, 0x7f,
];

interface Budget {
  left: number;
}

/** P-15's generator: the command first, then the tree (module header). */
export const genP15Draw: Gen<P15Draw> = (choices) => {
  const operation = choices.intInclusive(0, T13_5_10_OPERATIONS.length - 1);
  const budget: Budget = { left: MAX_NODES };
  return { operation, tree: genEntries(choices, 1, budget) };
};

/** A directory's entries at `level` (the lock directory's own at 1). */
function genEntries(
  choices: Choices,
  level: number,
  budget: Budget,
): LeftoverChild[] {
  const top = level === 1;
  const least = top ? 1 : 0;
  const most = Math.max(
    least,
    Math.min(top ? MAX_TOP : MAX_BREADTH, budget.left),
  );
  const count = choices.intInclusive(least, most);
  const entries: LeftoverChild[] = [];
  for (let index = 0; index < count; index += 1) {
    budget.left -= 1;
    const name = genName(choices, index);
    entries.push({ name, node: genNode(choices, level, budget) });
  }
  return entries;
}

function genNode(
  choices: Choices,
  level: number,
  budget: Budget,
): LeftoverNode {
  const kinds =
    level === 1 ? TOP_KINDS : level < MAX_LEVEL ? NESTED_KINDS : DEEPEST_KINDS;
  switch (choices.weightedPick(kinds)) {
    case "dir":
      return { kind: "dir", entries: genEntries(choices, level + 1, budget) };
    case "file":
      return {
        kind: "file",
        content: choices.pick(FILE_CONTENTS),
        mode: choices.weightedPick(FILE_MODES),
      };
    case "symlink":
      return { kind: "symlink", target: genTarget(choices) };
    case "fifo":
      return { kind: "fifo" };
  }
}

/**
 * A link's target outside the workspace: a directory holding a plain file
 * first and up to two more entries (plain files, or a directory holding
 * one), a plain file, or nothing (dangling).
 */
function genTarget(choices: Choices): OutsideTarget {
  switch (choices.weightedPick(TARGET_KINDS)) {
    case "dir": {
      const entries: OutsideChild[] = [
        { name: "held-0", node: { kind: "file", content: OUTSIDE_TEXT } },
      ];
      const extra = choices.intInclusive(0, 2);
      for (let index = 1; index <= extra; index += 1) {
        entries.push(
          choices.boolean(0.3)
            ? {
                name: `sub-${String(index)}`,
                node: {
                  kind: "dir",
                  entries: [
                    {
                      name: "held",
                      node: { kind: "file", content: OUTSIDE_TEXT },
                    },
                  ],
                },
              }
            : {
                name: `held-${String(index)}`,
                node: { kind: "file", content: OUTSIDE_TEXT },
              },
        );
      }
      return { kind: "dir", entries };
    }
    case "file":
      return { kind: "file", content: OUTSIDE_TEXT };
    case "dangling":
      return { kind: "dangling" };
  }
}

/** One name's exact bytes, its `-<index>` suffix keeping it unique. */
function genName(choices: Choices, index: number): Buffer {
  const suffix = ascii(`-${String(index)}`);
  switch (choices.weightedPick(NAME_FORMS)) {
    case "plain":
      return Buffer.concat([ascii(choices.pick(PLAIN_STEMS)), suffix]);
    case "dot":
      return Buffer.concat([
        ascii(choices.pick(DOT_PREFIXES)),
        ascii(choices.pick(PLAIN_STEMS)),
        suffix,
      ]);
    case "bytes":
      return Buffer.concat([
        ascii(choices.pick(BYTE_PREFIXES)),
        Buffer.from(choices.pick(INVALID_UTF8)),
        suffix,
      ]);
    case "dot-bytes":
      return Buffer.concat([
        ascii(choices.pick(DOT_PREFIXES)),
        Buffer.from(choices.pick(INVALID_UTF8)),
        suffix,
      ]);
    case "text":
      return Buffer.concat([
        Buffer.from(choices.pick(TEXT_STEMS), "utf8"),
        suffix,
      ]);
    case "edge":
      return Buffer.concat([
        Buffer.from([choices.pick(EDGE_FIRST_BYTES)]),
        ascii("edge"),
        suffix,
      ]);
  }
}

function ascii(text: string): Buffer {
  return Buffer.from(text, "latin1");
}

// ---------------------------------------------------------------------------
// Rendering (a falsification's counterexample)

/** A draw as text: the command, then the tree, names rendered readably. */
export function renderP15Draw(draw: P15Draw): string {
  const operation = T13_5_10_OPERATIONS[draw.operation];
  const lines = [
    `${operation === undefined ? `command ${String(draw.operation)}` : operation.what} --json, ${LOCK_PATH} holding:`,
  ];
  const visit = (entries: readonly LeftoverChild[], indent: string): void => {
    for (const child of entries) {
      lines.push(
        `${indent}${renderRel(Buffer.from(child.name))} ${describeLeftover(child.node)}`,
      );
      if (child.node.kind === "dir") {
        visit(child.node.entries ?? [], `${indent}  `);
      }
    }
  };
  visit(draw.tree, "  ");
  return lines.join("\n");
}

function describeLeftover(node: LeftoverNode): string {
  switch (node.kind) {
    case "dir":
      return (node.entries ?? []).length === 0
        ? "(an empty directory)"
        : "(a directory)";
    case "file": {
      const length =
        node.content === undefined
          ? 0
          : typeof node.content === "string"
            ? Buffer.byteLength(node.content, "utf8")
            : node.content.length;
      const mode = (node.mode ?? 0o644).toString(8).padStart(3, "0");
      return `(a plain file, mode 0o${mode}, ${String(length)} bytes)`;
    }
    case "symlink":
      return `(${describeTarget(node.target)})`;
    case "fifo":
      return "(a FIFO)";
  }
}

function describeTarget(target: OutsideTarget): string {
  switch (target.kind) {
    case "dir":
      return (
        `a symbolic link to a directory outside the workspace holding ` +
        `${String((target.entries ?? []).length)} entries`
      );
    case "file":
      return "a symbolic link to a plain file outside the workspace";
    case "dangling":
      return "a dangling symbolic link";
  }
}

// ---------------------------------------------------------------------------
// One draw

/** The rule a draw's exit 0 cites. */
const EXIT_RULE =
  "a leftover tree MUST NOT block a later command — acquisition removes " +
  "every leftover in the lock directory, a directory with all it holds at " +
  "every depth and a symbolic link itself, whatever its name's bytes, and " +
  "the command proceeds, exit 0 (SPEC 13.5)";

/**
 * One draw (module header): a fresh CORE_DECL workspace, its session
 * staging, the drawn tree staged at `.xspec/lock` and verified, then the
 * drawn command under `--json`, bounded, judged by T13.5-10(b)'s takeover
 * outcome against the command's leftover-free twin.
 */
async function runP15Draw(
  product: ProductBinding,
  twins: readonly UnstagedTwin[],
  draw: P15Draw,
): Promise<void> {
  const twin = twins[draw.operation];
  if (twin === undefined) {
    throw new Error(`P-15: no twin for command ${String(draw.operation)}`);
  }
  const workspace = await TestWorkspace.create(CORE_DECL);
  try {
    const context = `P-15 ${twin.operation.what} --json over the drawn leftover tree`;
    const items = await stageArmWorkspace(product, workspace, context);
    const staged = await stageLeftover(workspace, LOCK_PATH, {
      kind: "dir",
      entries: draw.tree,
    });
    const result = await runBounded(
      product,
      workspace.root,
      [...twin.operation.argv(items), "--json"],
      context,
    );
    await assertTakeover(
      workspace.root,
      result,
      twin,
      [staged],
      context,
      EXIT_RULE,
    );
  } finally {
    await workspace.dispose();
  }
}

/**
 * S-9's fixed TypeScript vectors (test/self/s9-typescript-well-formedness
 * .test.ts): P-15's one configuration file, CORE_DECL's fixed record (P-15
 * composes no source: its search space is the leftover tree).
 */
export const P15_TS_FORM_VECTORS: ReadonlyArray<
  readonly [name: string, path: string, source: string | Uint8Array]
> = [
  [
    "P-15 configuration (SPECS_ONLY_CONFIG)",
    "xspec.config.ts",
    SPECS_ONLY_CONFIG.source,
  ],
];

// ---------------------------------------------------------------------------
// Registration

const P_15 = defineProductTest({
  id: "P-15",
  title:
    "leftover trees (TEST-SPEC §16 P-15): seeded random leftover trees staged in `.xspec/lock` on a freshly built valid workspace holding an `audit` session `s` created while it was valid — varied depth and breadth; names beginning with `.`, names that are not valid UTF-8 (the Linux leg), and names of other first bytes; plain files below the top level, some with every permission removed; symbolic links to directories outside the workspace (each holding a plain file), to plain files outside it, and dangling ones; and FIFOs — the lock directory's top level holding no plain file and every directory listable, searchable, and writable; each draw runs one mutating command (`rename`, file-form `move`, `review create --strategy audit`, `review resolve`, or `review split`), an operation succeeding on its leftover-free twin, under `--json`: it completes promptly, no FIFO opened, and exits 0 with its result (exit code, standard output and error, and final workspace, H-6) byte-equal to the twin's, `.xspec/lock` absent once it ends, every link's target outside the workspace byte-identical afterward and nothing written through a link — acquisition removing every leftover, a directory with all it holds at every depth and a symbolic link itself, never its target, reading no file's content (SPEC 13.5, 13.4; T13.5-10(b)'s fixed trees anchor it; E-5)",
  // Wall-clock hang guard only (H-10): five twins, then three fixed seeds
  // (E-5) of P15_RUNS_PER_SEED draws, each four product runs, plus up to
  // P15_MAX_SHRINK_EXECUTIONS shrink draws on a falsification — measured
  // ~5 s passing against the CONF-LEFTOVER conformer and ~12 s failing
  // against the built product; a product blocking on a FIFO spends
  // `runBounded`'s 15 s guard on each such draw, shrinking included.
  timeoutMs: 600_000,
  run: async (product) => {
    const twins: UnstagedTwin[] = [];
    for (const operation of T13_5_10_OPERATIONS) {
      twins.push(await unstagedTwin(product, operation, "P-15"));
    }
    await checkProperty(
      "P-15 leftover trees",
      genP15Draw,
      async (draw) => {
        await runP15Draw(product, twins, draw);
      },
      {
        runs: P15_RUNS_PER_SEED,
        maxShrinkExecutions: P15_MAX_SHRINK_EXECUTIONS,
        render: renderP15Draw,
      },
    );
  },
});

/** TEST-SPEC §16 P-15 (PROP-13). */
export const section16P15Tests: readonly ProductTestEntry[] = [P_15];
