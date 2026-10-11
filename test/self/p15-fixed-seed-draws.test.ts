// P-15's fixed-seed draw guard (TEST-SPEC §16 P-15; §18 E-5; §0 H-10;
// CERTIFICATIONS.md §CONF-LEFTOVER). CI runs P-15 over the fixed seed set
// (E-5), so the trees it stages are a pure function of its generator, the
// seed set, and its registered runs per seed (`P15_RUNS_PER_SEED`; P-15
// passes no `seeds`). They are replayed here exactly as `checkProperty`
// draws them — `drawFixedSeedTrials`, one sequential PRNG stream per seed —
// with no property body and no product (H-8's ordering: the guard holds
// before any product exists). Each CONF-LEFTOVER violator fails P-15 only on
// a draw reaching the class its deviation turns on, and P-15 passes against
// it exactly when the generator never reaches that class (§CONF-LEFTOVER's
// justification: criterion (a)'s reachability case), so the guard pins,
// over those draws:
//
//   1. the certified classes, each at the lock directory's top level and
//      nested in a directory acquisition lists to remove — every ancestor
//      below the lock directory named so that the deviating listing still
//      shows it: a name beginning with `.` (VIOL-LEFTOVER-DOTNAMES; no
//      ancestor's name beginning with `.`), a name that is not valid UTF-8
//      (VIOL-LEFTOVER-BYTENAMES; every ancestor's name valid UTF-8), and a
//      symbolic link to a directory outside the workspace
//      (VIOL-LEFTOVER-FOLLOWLINK);
//   2. the rest of P-15's search space, so that a generator change cannot
//      drop a class silently: a leftover MAX_LEVEL levels deep (a removal
//      stopping short of a tree's depth), plain files with every permission
//      removed, FIFOs at the top level and nested, links to plain files and
//      dangling links, valid UTF-8 beyond ASCII, names opening with a byte a
//      command line or a glob reads specially or with a control byte, and
//      each of the five commands;
//   3. the constraints the staging (helpers/lock-staging.ts) enforces as
//      usage errors, and the one it cannot see: no plain file at the lock
//      directory's top level; every name a name (non-empty, no `/` or NUL,
//      never `.` or `..`) unique in its directory; every link to a
//      directory reaching a plain file; and no valid name holding U+FFFD,
//      so that no name spells another's replacement-character decoding
//      (VIOL-LEFTOVER-BYTENAMES' decoded address then designates nothing).
//
// Should the fixed seeds miss a class, raise `P15_RUNS_PER_SEED` or the
// class's weight; never weaken this.

import { Buffer } from "node:buffer";
import { expect, test } from "vitest";
import type { LeftoverChild } from "../helpers/lock-staging.js";
import {
  DEFAULT_PROPERTY_SEEDS,
  drawFixedSeedTrials,
} from "../helpers/property.js";
import { T13_5_10_OPERATIONS } from "../suite/registry/section-13.5-ii.js";
import {
  BYTE_PREFIXES,
  DOT_PREFIXES,
  genP15Draw,
  INVALID_UTF8,
  MAX_LEVEL,
  P15_RUNS_PER_SEED,
} from "../suite/registry/section-16-p15.js";
import type { P15Draw } from "../suite/registry/section-16-p15.js";

const DOT = 0x2e;
const REPLACEMENT = String.fromCodePoint(0xfffd);
/** `-`, `~`, `#`, `*`, `[`: first bytes a command line or a glob reads specially. */
const EDGE_PUNCTUATION: readonly number[] = [0x2d, 0x7e, 0x23, 0x2a, 0x5b];
const FATAL = new TextDecoder("utf-8", { fatal: true });

/** The bytes' UTF-8 text, or `undefined` where they are not valid UTF-8. */
function utf8(bytes: Uint8Array): string | undefined {
  try {
    return FATAL.decode(bytes);
  } catch {
    return undefined;
  }
}

/** One replayed draw, labelled with its seed and 1-based trial number. */
interface Replayed {
  readonly label: string;
  readonly draw: P15Draw;
}

const REPLAYED: readonly Replayed[] = drawFixedSeedTrials(
  genP15Draw,
  P15_RUNS_PER_SEED,
).map((draw, index) => ({
  label:
    `seed ${String(DEFAULT_PROPERTY_SEEDS[Math.floor(index / P15_RUNS_PER_SEED)])} ` +
    `trial ${String((index % P15_RUNS_PER_SEED) + 1)}`,
  draw,
}));

/** One leftover as the walk meets it, with what its ancestors are named. */
interface Visited {
  readonly name: Buffer;
  readonly child: LeftoverChild;
  /** 1 at the lock directory's top level. */
  readonly level: number;
  /** Some ancestor below the lock directory is named beginning with `.`. */
  readonly underDotName: boolean;
  /** Some ancestor below the lock directory is named in bytes not UTF-8. */
  readonly underByteName: boolean;
  /** Its siblings' names, itself included. */
  readonly siblings: readonly Buffer[];
}

function visitAll(draw: P15Draw): Visited[] {
  const visited: Visited[] = [];
  const walk = (
    entries: readonly LeftoverChild[],
    level: number,
    underDotName: boolean,
    underByteName: boolean,
  ): void => {
    const siblings = entries.map((child) => Buffer.from(child.name));
    for (const child of entries) {
      const name = Buffer.from(child.name);
      visited.push({
        name,
        child,
        level,
        underDotName,
        underByteName,
        siblings,
      });
      if (child.node.kind === "dir") {
        walk(
          child.node.entries ?? [],
          level + 1,
          underDotName || name[0] === DOT,
          underByteName || utf8(name) === undefined,
        );
      }
    }
  };
  walk(draw.tree, 1, false, false);
  return visited;
}

/** The labels of the draws holding a leftover `matches` accepts. */
function drawsWhere(matches: (visited: Visited) => boolean): string[] {
  return REPLAYED.filter(({ draw }) => visitAll(draw).some(matches)).map(
    ({ label }) => label,
  );
}

const isDotName = (visited: Visited): boolean => visited.name[0] === DOT;
const isByteName = (visited: Visited): boolean =>
  utf8(visited.name) === undefined;
const isDirectoryLink = (visited: Visited): boolean =>
  visited.child.node.kind === "symlink" &&
  visited.child.node.target.kind === "dir";

test("P-15's fixed-seed draws reach each class a CONF-LEFTOVER violator turns on, at the lock directory's top level and nested in a directory acquisition lists to remove", () => {
  const reach = {
    dotTop: drawsWhere((v) => v.level === 1 && isDotName(v)),
    dotNested: drawsWhere(
      (v) => v.level > 1 && !v.underDotName && isDotName(v),
    ),
    bytesTop: drawsWhere((v) => v.level === 1 && isByteName(v)),
    bytesNested: drawsWhere(
      (v) => v.level > 1 && !v.underByteName && isByteName(v),
    ),
    directoryLinkTop: drawsWhere((v) => v.level === 1 && isDirectoryLink(v)),
    directoryLinkNested: drawsWhere((v) => v.level > 1 && isDirectoryLink(v)),
  };
  const missing = Object.entries(reach)
    .filter(([, labels]) => labels.length === 0)
    .map(([name]) => name);
  expect(
    missing,
    `classes P-15's fixed seeds never reach — a violator turning on one ` +
      `would pass P-15 (criterion (a)'s reachability case); reach: ` +
      JSON.stringify(reach),
  ).toEqual([]);
});

test("P-15's fixed-seed draws reach the rest of its search space: depth, permission removals, FIFOs, every link kind, every name class, every command", () => {
  const all = REPLAYED.flatMap(({ draw }) => visitAll(draw));
  const deepest = Math.max(...all.map((v) => v.level));
  expect(deepest, "a leftover MAX_LEVEL levels deep").toBe(MAX_LEVEL);
  const kinds = {
    noPermissionFile: all.some(
      (v) => v.child.node.kind === "file" && v.child.node.mode === 0o000,
    ),
    fifoTop: all.some((v) => v.level === 1 && v.child.node.kind === "fifo"),
    fifoNested: all.some((v) => v.level > 1 && v.child.node.kind === "fifo"),
    fileLink: all.some(
      (v) =>
        v.child.node.kind === "symlink" && v.child.node.target.kind === "file",
    ),
    danglingLink: all.some(
      (v) =>
        v.child.node.kind === "symlink" &&
        v.child.node.target.kind === "dangling",
    ),
    emptyDirectory: all.some(
      (v) =>
        v.child.node.kind === "dir" &&
        (v.child.node.entries ?? []).length === 0,
    ),
    textBeyondAscii: all.some(
      (v) => utf8(v.name) !== undefined && v.name.some((byte) => byte > 0x7f),
    ),
    edgeFirstByte: all.some((v) => {
      const first = v.name[0];
      return (
        first !== undefined &&
        (first < 0x21 || first === 0x7f || EDGE_PUNCTUATION.includes(first))
      );
    }),
    dotAndBytes: all.some((v) => isDotName(v) && isByteName(v)),
  };
  expect(
    Object.entries(kinds)
      .filter(([, reached]) => !reached)
      .map(([name]) => name),
    "classes of P-15's search space its fixed seeds never reach",
  ).toEqual([]);
  const commands = new Set(REPLAYED.map(({ draw }) => draw.operation));
  expect(
    [...commands].sort(),
    "every one of T13.5-10's five commands is drawn",
  ).toEqual(T13_5_10_OPERATIONS.map((_, index) => index));
});

test("P-15's generator keeps the staging's constraints: no plain file at the top level, names valid and unique, every directory link reaching a plain file, no valid name holding U+FFFD", () => {
  const violations: string[] = [];
  for (const { label, draw } of REPLAYED) {
    for (const v of visitAll(draw)) {
      const shown = `${label}: ${JSON.stringify(v.name.toString("hex"))}`;
      if (v.level === 1 && v.child.node.kind === "file") {
        violations.push(`${shown} is a plain file at the top level`);
      }
      const bytes = v.name;
      if (
        bytes.length === 0 ||
        bytes.includes(0x2f) ||
        bytes.includes(0x00) ||
        bytes.equals(Buffer.from(".")) ||
        bytes.equals(Buffer.from(".."))
      ) {
        violations.push(`${shown} is no name`);
      }
      if (v.siblings.filter((other) => other.equals(bytes)).length !== 1) {
        violations.push(`${shown} is not unique in its directory`);
      }
      const text = utf8(bytes);
      if (text?.includes(REPLACEMENT) === true) {
        violations.push(`${shown} holds U+FFFD`);
      }
      const node = v.child.node;
      if (node.kind === "symlink" && node.target.kind === "dir") {
        const holdsFile = (node.target.entries ?? []).some(
          (entry) =>
            entry.node.kind === "file" ||
            (entry.node.entries ?? []).some(
              (inner) => inner.node.kind === "file",
            ),
        );
        if (!holdsFile) {
          violations.push(`${shown} links to a directory holding no file`);
        }
      }
    }
  }
  expect(violations).toEqual([]);
});

test("each ill-formed sequence P-15 draws stays ill-formed wherever a name places it", () => {
  const contexts = [...BYTE_PREFIXES, ...DOT_PREFIXES];
  const valid: string[] = [];
  for (const sequence of INVALID_UTF8) {
    for (const prefix of contexts) {
      for (const suffix of ["-0", "-3"]) {
        const name = Buffer.concat([
          Buffer.from(prefix, "latin1"),
          Buffer.from(sequence),
          Buffer.from(suffix, "latin1"),
        ]);
        if (utf8(name) !== undefined) valid.push(name.toString("hex"));
      }
    }
  }
  expect(valid).toEqual([]);
});
