// TEST-SPEC §16 P-8 (parser robustness) — PROP-06.
//
// One registered product-facing fuzz test (C-2 "one code path"): a seeded,
// reproducible generator (helpers/property.ts, H-10; fixed seed set in CI,
// E-5) mutates the byte content of a small valid workspace — MDX spec
// sources, a code-group TypeScript file, and `xspec.config.ts` — and drives
// the SPEC 12 command surface over the result, asserting only the robustness
// contract P-8 states, never any parse verdict:
//
//   * every command terminates — operationalized by the subprocess driver's
//     hang guard (helpers/subprocess.ts): a run killed by the per-invocation
//     timeout or by the runaway-output cap is converted into a *diagnosed
//     assertion failure* (H-8), because termination is this property's
//     assertion, not merely its harness hygiene;
//   * a command never dies by signal and always exits 0, 1, or 2 — the
//     SPEC 12.0 exit-code partition ("exit codes partition all outcomes");
//   * under `--json`, stdout is never a partial JSON document: exit 0/1
//     emits exactly one JSON document as the entire stdout, and exit 2
//     emits the 12.7 error document — `{"error": …}` — as that document
//     (SPEC 12.0; the shared `assertJsonOutputConvention`, H-5);
//   * a failing `build` — exit 1 or exit 2 — modifies nothing: the whole
//     workspace tree, prior derived files and graph data included, is
//     byte-identical around the invocation (SPEC 12.1, H-4; snapshot
//     machinery from helpers/snapshot.ts, as T12.1-4 asserts
//     deterministically).
//
// Staging: each trial creates the fixed base workspace, runs one staging
// `build` (expected exit 0 — the base is SPEC-valid by construction), so the
// workspace holds prior derived state (generated modules, emitted Markdown,
// graph data) for the modifies-nothing arm; then the trial's mutations are
// written over the sources/config, and the command sweep runs: the fixed
// `build --json` arm first, then the trial's drawn commands. Mutations never
// touch derived or durable files — P-8's input space is "mutated
// MDX/TS/config" (corrupt stored state is 13.4/P-9 territory).
//
// The mutation menu covers every input class P-8 names, each applied at a
// drawn offset of a drawn file (mutations stack, 1–3 per trial, applied
// against the evolving bytes at generation time so replay and shrinking
// re-derive identical staged bytes, H-10):
//
//   * splice     — insert/delete short runs of boundary bytes (MDX/TS
//                  structural ASCII, control bytes, UTF-8 lead/continuation
//                  bytes) — "mutated MDX/TS/config";
//   * invalidUtf8 — canned ill-formed sequences (lone continuation, overlong
//                  encoding, truncated multi-byte, surrogate encoding, 0xFF,
//                  lead byte at EOF);
//   * bom        — UTF-8 BOM at offset 0 or mid-file; UTF-16LE/BE BOMs at
//                  offset 0 (making the tail ill-formed UTF-8 in context);
//   * terminators — pathological line terminators: every LF rewritten to a
//                  drawn sequence (CR, CRLF, CRCRLF, LFCR, doubled LF, NEL
//                  U+0085, LS U+2028 — the two encoded as UTF-8), a run of
//                  1–64 terminator sequences inserted at an offset, or a
//                  lone CR appended at EOF;
//   * nesting    — giant nesting (depth 512 / 2048 / 4096): balanced or
//                  unbalanced `<S id="g">` towers for `.mdx` targets,
//                  balanced parenthesis or unbalanced bracket towers for TS
//                  targets, appended to or replacing the file;
//   * truncate   — the file cut at a drawn byte offset (mid-construct,
//                  mid-code-point);
//   * shuffle    — a drawn byte range removed and reinserted at a drawn
//                  position (closers before openers, headers displaced);
//   * garbage    — the whole file replaced by 0–64 uniformly drawn bytes;
//   * fragment   — `<>…</>` insertion and unbalancing: a balanced fragment
//                  around a drawn interior (empty, prose, a section, an
//                  embedding, a comment, a nested fragment, a multi-line
//                  interior), a lone `<>` or `</>`, or a fragment wrapping a
//                  drawn byte range (crossing whatever constructs it spans);
//   * braces     — brace content at the comment/expression/parse-failure
//                  boundaries of SPEC 2.7 and 14.20, applied to a drawn
//                  `{…}` container of the file (one seeded when it holds
//                  none): comment ↔ expression rewrites (the content wrapped
//                  in a block comment, an expression beside it, comments and
//                  line comments before or after it — the U+000A-, U+000D-,
//                  and U+2028-ended and run-on forms of T2.3-3/T2.7-4 —
//                  empty braces, two comments, and the ECMAScript-whitespace
//                  and non-whitespace singletons of T2.7-4); the content
//                  replaced by a boundary expression (the early errors,
//                  comma sequences, `await`, and function forms of T14-12,
//                  the negative embedding forms of T2.3-3, JSX and a section
//                  inside braces, two expressions, an unclosed call, a lone
//                  `]`, an unclosed block comment); the spread grammar pair
//                  of T2.7-3 and its neighbours inserted on a `<S ` tag;
//                  empty braces in flow, text, and attribute-value position
//                  (`d={}`, `d={ /* c */ }`, `coverage={}`); and unbalanced
//                  braces at EOF (an unclosed embedding, brace, comment, or
//                  attribute value appended, a stray `}`, or the file's last
//                  `}` deleted);
//   * esmBlock   — ESM-block mutations on a drawn `import`/`export` line
//                  (one seeded at a drawn line start when the file holds
//                  none): comment insertion (own-line line and block
//                  comments before it, a block comment spanning lines, a
//                  comment on its line before the declaration, trailing
//                  comments, an own-line comment after it with no blank line
//                  between); terminator changes (`;` appended or removed, the
//                  line's terminator rewritten to CR, CRLF, U+2028, U+2029, a
//                  blank line, or a space joining the next line); indentation
//                  (spaces or a tab before the declaration); splitting and
//                  joining blocks (a second declaration after a blank line
//                  or directly on the next line — a duplicate binding, a
//                  fresh binding, a side-effect-only import, import
//                  attributes, an export naming no declaration, an export
//                  holding JSX — or the blank line after the block deleted);
//                  and a statement at a line start (`const x = 1` and its
//                  kin directly after the declaration, the T14-12 negative,
//                  or at any drawn line start).
//
// The refined classes stage the forms most likely to make a product
// misjudge the well-formedness boundary (T14-12) — every spelling a fixed
// constant of at most a few dozen bytes, so no refined draw approaches a
// tower's growth (S-8) — while the property asserts no parse verdict on any
// of them: its contract stays the robustness clauses above, and the verdicts
// themselves are T2.3-3's, T2.7-3's, T2.7-4's, T3-7's, and T14-12's.
//
// The command sweep spans the SPEC 12 surface: `build` (both output forms —
// the human form via the drawn menu), `check`, `ids`, `show`, all five
// `query` subcommands, `coverage`, `impact --base` (no repository is staged:
// an unreadable baseline is itself an exit-2 outcome, 6.3/12.0), `review`
// reads and `review create`, `rename`, and file-form `move`. Mutating
// commands may legitimately succeed and modify the workspace when the
// mutations happen to be benign — P-8 constrains their termination, exit
// class, and JSON form only; the modifies-nothing arm is `build`'s
// (SPEC 12.1). An implementation-time dry-run over the committed default
// seeds at the registered 12 runs per seed (`drawFixedSeedTrials`, the S-8
// replay) verified that every menu entry, every mutation kind — the three
// refined classes included — and every mutation target occurs — giant MDX
// section towers (depths 512 and 2048), all three BOM flavors, a mid-file
// BOM, lone and balanced fragments and a range-wrapping one, spread
// attributes, empty braces, an EOF-unbalanced brace, a deleted closer, a
// whitespace-singleton container, seeded and existing declaration lines
// with comment, terminator, indentation, and split mutations included — so
// the CI-pinned trial set (E-5) exercises every kind deterministically,
// with staged files bounded (~32 KiB max); the refined classes' remaining
// modes (a boundary expression replacing a container's content, a joined
// block, a statement at a line start) are reached under
// `XSPEC_PROPERTY_SEED=random` runs, not by the pinned set.
//
// P-8 is outside every CERTIFICATIONS.md fixture scope (its preamble: "P-8
// sweeps every command, exceeding any narrow conformer scope"), so this body
// binds only to the real product surface.
//
// Shared machinery: P-11 (availability robustness, section-16-p11.ts) is
// specified over "P-8's generators" (TEST-SPEC §16 P-11), so the base
// workspace (`FUZZ_BASE_FILES`) and the mutation menu (`drawFuzzMutation`)
// are exported and drawn by both properties — one input-space definition,
// two command surfaces.

import { Buffer } from "node:buffer";
import { assertJsonOutputConvention, fail } from "../../helpers/assertions.js";
import type { Choices, Gen } from "../../helpers/property.js";
import { checkProperty, listOf } from "../../helpers/property.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import type { ProductBinding, RunResult } from "../../helpers/subprocess.js";
import {
  ProductRunOutputOverflowError,
  ProductRunTimeoutError,
  runProduct,
} from "../../helpers/subprocess.js";
import {
  assertSnapshotsEqual,
  snapshotDirectory,
} from "../../helpers/snapshot.js";
import type { StagedMdx } from "../../helpers/staged-mdx.js";
import { stagedMdx } from "../../helpers/staged-mdx.js";
import type { InitialFileContents } from "../../helpers/workspace.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import { buildOk } from "./support.js";

// ---------------------------------------------------------------------------
// The base workspace: small, SPEC-valid, covering the three parse surfaces
// P-8 mutates — MDX spec sources (imports, nesting, tags, `d` references,
// embeddings, an own-line comment), a code-group TypeScript consumer, and
// the declarative configuration (spec group + code group + Markdown
// emission, SPEC 7), so a successful staging `build` leaves generated
// modules, emitted Markdown, and graph data as prior derived state.

const BASE_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: {
    app: ["src/**/*.ts"]
  },
  markdown: { emit: true }
})
`;

const BASE_SPEC_A = [
  '<S id="a" tags="t1 t2">',
  "Alpha behavior line one.",
  "",
  '<S id="a.b">',
  "Beta behavior detail.",
  "</S>",
  "</S>",
  "",
  "{/* an own-line comment */}",
  "",
  '<S id="c" d={["a"]} coverage="none">',
  'Gamma consumes {text("a.b")} inline.',
  "</S>",
  "",
].join("\n");

const BASE_SPEC_B = [
  'import A from "./A.xspec"',
  "",
  '<S id="b" d={[A.a]}>',
  "Bravo builds on {text(A.c)} downstream.",
  "</S>",
  "",
].join("\n");

const BASE_CODE = [
  'import SPEC, { text } from "../specs/A.xspec";',
  "",
  "export const alpha: string = text(SPEC.a);",
  "",
].join("\n");

/**
 * The fuzz base workspace: exactly the files whose bytes P-8's trials fuzz
 * (P-11 mutates the three sources only, never the configuration — see
 * section-16-p11.ts). SPEC-valid by construction; shared per TEST-SPEC §16
 * P-11 ("P-8's generators").
 */
export const FUZZ_BASE_FILES: ReadonlyArray<readonly [string, string]> = [
  ["xspec.config.ts", BASE_CONFIG],
  ["specs/A.mdx", BASE_SPEC_A],
  ["specs/B.mdx", BASE_SPEC_B],
  ["src/app.ts", BASE_CODE],
];

const MUTATION_TARGETS: readonly string[] = FUZZ_BASE_FILES.map(
  ([path]) => path,
);

/**
 * The base workspace's `.mdx` sources as staged-source records (S-9's
 * before-any-product clause; helpers/staged-mdx.ts): P-8 stages the base
 * workspace afresh per trial and P-11 its unmutated base files per trial —
 * from the second trial on, after the body's first product invocation:
 * initial files S-7's sweep never reaches — so the ledger self-test judges
 * them before any product exists. `FUZZ_BASE_FILES` keeps the strings: the
 * generators mutate their bytes.
 */
export const FUZZ_BASE_RECORDS: ReadonlyMap<string, StagedMdx> = new Map([
  ["specs/A.mdx", stagedMdx("P-8/P-11 specs/A.mdx", BASE_SPEC_A)],
  ["specs/B.mdx", stagedMdx("P-8/P-11 specs/B.mdx", BASE_SPEC_B)],
]);

/** The base workspace as initial `files`: each `.mdx` entry its record. */
function fuzzBaseWorkspaceFiles(): Record<string, InitialFileContents> {
  return Object.fromEntries(
    FUZZ_BASE_FILES.map(([path, text]) => [
      path,
      FUZZ_BASE_RECORDS.get(path) ?? text,
    ]),
  );
}

// ---------------------------------------------------------------------------
// The command menu (SPEC 12 surface). Every entry is drawn by trials; the
// fixed `build --json` arm runs on every trial in addition. Argument values
// name base-workspace nodes/files — after mutation they may no longer exist,
// which is itself a legitimate exit-2 outcome (12.0: unknown node identities
// or files named in arguments are usage errors). Entries are data, never
// interpreted by a shell (H-2).

const COMMAND_MENU: ReadonlyArray<readonly string[]> = [
  ["build"],
  ["check", "--json"],
  ["check"],
  ["ids", "--json"],
  ["ids", "--tree"],
  ["show", "specs/A.mdx#a"],
  ["show", "specs/A.mdx"],
  ["query", "node", "specs/A.mdx#a.b", "--json"],
  ["query", "nodes", "--json"],
  ["query", "edges", "--json"],
  ["query", "subtree", "specs/A.mdx#a", "--json"],
  ["query", "ancestors", "specs/A.mdx#a.b", "--json"],
  ["coverage", "--json"],
  ["coverage"],
  ["impact", "--base", "HEAD", "--json"],
  ["review", "list", "--json"],
  ["review", "create", "--strategy", "audit", "--name", "r1", "--json"],
  ["review", "next", "r1", "--json"],
  ["rename", "specs/A.mdx", "c", "c2", "--json"],
  ["move", "specs/B.mdx", "specs/moved.mdx", "--json"],
];

// ---------------------------------------------------------------------------
// Mutations. Each apply function is pure (bytes in, bytes out) and draws all
// of its parameters through `Choices`, so identical tapes re-derive identical
// staged bytes on replay and during shrinking (H-10).

/**
 * Splice-insert alphabet: MDX/TS structural ASCII, whitespace/control bytes,
 * and UTF-8 lead/continuation boundary bytes. Plain letter first (the shrink
 * target).
 */
const SPLICE_BYTES: readonly number[] = [
  0x61, // "a"
  0x3c, // "<"
  0x3e, // ">"
  0x7b, // "{"
  0x7d, // "}"
  0x2f, // "/"
  0x5c, // "\"
  0x22, // '"'
  0x27, // "'"
  0x60, // "`"
  0x3d, // "="
  0x23, // "#"
  0x28, // "("
  0x29, // ")"
  0x5b, // "["
  0x5d, // "]"
  0x0a, // LF
  0x0d, // CR
  0x09, // TAB
  0x00, // NUL
  0x01, // SOH
  0x1b, // ESC
  0x7f, // DEL
  0x80, // continuation byte
  0xbf, // continuation byte
  0xc0, // overlong lead
  0xc2, // 2-byte lead
  0xe2, // 3-byte lead
  0xef, // 3-byte lead (BOM lead)
  0xf0, // 4-byte lead
  0xfe, // never valid in UTF-8
  0xff, // never valid in UTF-8
];

/** Canned ill-formed UTF-8 sequences (see the module header). */
const INVALID_UTF8_SEQUENCES: ReadonlyArray<readonly number[]> = [
  [0x80], // lone continuation byte
  [0xbf], // lone continuation byte
  [0xc0, 0xaf], // overlong "/"
  [0xe2, 0x82], // truncated 3-byte sequence
  [0xed, 0xa0, 0x80], // encoded UTF-16 surrogate U+D800
  [0xf5, 0x80, 0x80, 0x80], // lead byte above U+10FFFF
  [0xff], // never valid
  [0xc2], // lead byte with no continuation
];

const UTF8_BOM: readonly number[] = [0xef, 0xbb, 0xbf];
const UTF16LE_BOM: readonly number[] = [0xff, 0xfe];
const UTF16BE_BOM: readonly number[] = [0xfe, 0xff];

/** Line-terminator sequences LF is rewritten to / runs are built from. */
export const TERMINATOR_SEQUENCES: ReadonlyArray<
  readonly [string, readonly number[]]
> = [
  ["CR", [0x0d]],
  ["CRLF", [0x0d, 0x0a]],
  ["CRCRLF", [0x0d, 0x0d, 0x0a]],
  ["LFCR", [0x0a, 0x0d]],
  ["LFLF", [0x0a, 0x0a]],
  ["NEL", [0xc2, 0x85]], // U+0085 as UTF-8
  ["LS", [0xe2, 0x80, 0xa8]], // U+2028 as UTF-8
];

// Every nesting draw is genuinely giant (P-8 "giant nesting"); the smallest
// entry first so counterexamples shrink toward the shallowest tower. Exported
// (with `sectionTowerSource` and `MAX_MUTATIONS_PER_TRIAL`) so S-8's capacity
// gate derives the suite's staged maxima from the generator itself (H-11).
export const NESTING_DEPTHS: readonly number[] = [512, 2048, 4096];

/**
 * The MDX section tower a nesting mutation stages: `depth` nested `<S id="g">`
 * openers, balanced ones closing around one content line, unclosed ones left
 * open (an unparseable file). Byte-exact — S-2/S-8 stage and size the same
 * tower the fuzz draws stage.
 */
export function sectionTowerSource(depth: number, balanced: boolean): string {
  return balanced
    ? `${'<S id="g">\n'.repeat(depth)}deep.\n${"</S>\n".repeat(depth)}`
    : '<S id="g">\n'.repeat(depth);
}

function spliceBytes(
  bytes: Uint8Array,
  offset: number,
  deleteCount: number,
  insert: readonly number[],
): Uint8Array {
  const out = new Uint8Array(bytes.length - deleteCount + insert.length);
  out.set(bytes.subarray(0, offset), 0);
  out.set(insert, offset);
  out.set(bytes.subarray(offset + deleteCount), offset + insert.length);
  return out;
}

function renderBytes(sequence: readonly number[]): string {
  return sequence
    .map((byte) => `0x${byte.toString(16).padStart(2, "0")}`)
    .join(" ");
}

/** One mutation: new bytes plus a human-readable description for the log. */
export interface MutationResult {
  readonly bytes: Uint8Array;
  readonly description: string;
}

function mutateSplice(choices: Choices, bytes: Uint8Array): MutationResult {
  const offset = choices.intInclusive(0, bytes.length);
  const deleteCount = choices.intInclusive(
    0,
    Math.min(8, bytes.length - offset),
  );
  const insert = listOf((c: Choices) => c.pick(SPLICE_BYTES), { max: 8 })(
    choices,
  );
  return {
    bytes: spliceBytes(bytes, offset, deleteCount, insert),
    description:
      `splice at ${String(offset)}: delete ${String(deleteCount)}, ` +
      `insert [${renderBytes(insert)}]`,
  };
}

function mutateInvalidUtf8(
  choices: Choices,
  bytes: Uint8Array,
): MutationResult {
  const sequence = choices.pick(INVALID_UTF8_SEQUENCES);
  const offset = choices.intInclusive(0, bytes.length);
  return {
    bytes: spliceBytes(bytes, offset, 0, sequence),
    description: `insert ill-formed UTF-8 [${renderBytes(sequence)}] at ${String(offset)}`,
  };
}

function mutateBom(choices: Choices, bytes: Uint8Array): MutationResult {
  const [name, bom, atStartOnly] = choices.pick([
    ["UTF-8 BOM", UTF8_BOM, false] as const,
    ["UTF-16LE BOM", UTF16LE_BOM, true] as const,
    ["UTF-16BE BOM", UTF16BE_BOM, true] as const,
  ]);
  const offset =
    atStartOnly || !choices.boolean(0.4)
      ? 0
      : choices.intInclusive(0, bytes.length);
  return {
    bytes: spliceBytes(bytes, offset, 0, bom),
    description: `insert ${name} at ${String(offset)}`,
  };
}

function mutateTerminators(
  choices: Choices,
  bytes: Uint8Array,
): MutationResult {
  const mode = choices.pick(["replaceAll", "insertRun", "appendCr"] as const);
  if (mode === "appendCr") {
    return {
      bytes: spliceBytes(bytes, bytes.length, 0, [0x0d]),
      description: "append a lone CR at EOF",
    };
  }
  const [name, sequence] = choices.pick(TERMINATOR_SEQUENCES);
  if (mode === "insertRun") {
    const offset = choices.intInclusive(0, bytes.length);
    const count = 1 + choices.intInclusive(0, 63);
    const run: number[] = [];
    for (let i = 0; i < count; i += 1) run.push(...sequence);
    return {
      bytes: spliceBytes(bytes, offset, 0, run),
      description: `insert a run of ${String(count)} ${name} terminator(s) at ${String(offset)}`,
    };
  }
  const out: number[] = [];
  for (const byte of bytes) {
    if (byte === 0x0a) out.push(...sequence);
    else out.push(byte);
  }
  return {
    bytes: Uint8Array.from(out),
    description: `rewrite every LF to ${name}`,
  };
}

function mutateNesting(
  choices: Choices,
  bytes: Uint8Array,
  path: string,
): MutationResult {
  const depth = choices.pick(NESTING_DEPTHS);
  const balanced = choices.boolean(0.6);
  const replace = choices.boolean(0.3);
  let tower: string;
  let shape: string;
  if (path.endsWith(".mdx")) {
    shape = balanced ? "balanced section tower" : "unclosed section tower";
    tower = sectionTowerSource(depth, balanced);
  } else {
    shape = balanced
      ? "balanced parenthesis tower"
      : "unbalanced bracket tower";
    tower = balanced
      ? `const zz = ${"(".repeat(depth)}1${")".repeat(depth)}\n`
      : `const zz = ${"[".repeat(depth)}\n`;
  }
  const towerBytes = Buffer.from(tower, "utf8");
  const out = replace
    ? Uint8Array.from(towerBytes)
    : spliceBytes(bytes, bytes.length, 0, [...towerBytes]);
  return {
    bytes: out,
    description:
      `${replace ? "replace with" : "append"} a depth-${String(depth)} ` +
      `${shape}`,
  };
}

function mutateTruncate(choices: Choices, bytes: Uint8Array): MutationResult {
  const keep = choices.intInclusive(0, bytes.length);
  return {
    bytes: bytes.slice(0, keep),
    description: `truncate to the first ${String(keep)} byte(s)`,
  };
}

function mutateShuffle(choices: Choices, bytes: Uint8Array): MutationResult {
  if (bytes.length < 2) {
    // Degenerate file: nothing to displace — fall back to a splice.
    return mutateSplice(choices, bytes);
  }
  const start = choices.intInclusive(0, bytes.length - 1);
  const end = choices.intInclusive(start + 1, bytes.length);
  const slice = bytes.slice(start, end);
  const removed = spliceBytes(bytes, start, end - start, []);
  const at = choices.intInclusive(0, removed.length);
  return {
    bytes: spliceBytes(removed, at, 0, [...slice]),
    description: `move bytes [${String(start)}, ${String(end)}) to ${String(at)}`,
  };
}

function mutateGarbage(choices: Choices, bytes: Uint8Array): MutationResult {
  void bytes;
  const garbage = listOf((c: Choices) => c.intInclusive(0, 255), { max: 64 })(
    choices,
  );
  return {
    bytes: Uint8Array.from(garbage),
    description: `replace the whole file with ${String(garbage.length)} drawn byte(s)`,
  };
}

// ---------------------------------------------------------------------------
// The refined mutation classes (module header: fragment, braces, esmBlock).
// Each edits the evolving bytes at a drawn anchor found by scanning them — a
// `{…}` container, a `<S ` tag, an `import`/`export` line, a line start — or
// at a drawn offset, and seeds an anchor when the file holds none, so every
// mode is meaningful on every target after every earlier mutation of the
// trial. Byte-level throughout: a container's content is spliced as bytes,
// never decoded, so ill-formed UTF-8 an earlier mutation staged survives
// untouched (H-10: the staged bytes are a pure function of the tape).

const LF = 0x0a;
const CR = 0x0d;

function utf8(text: string): number[] {
  return [...Buffer.from(text, "utf8")];
}

/** Non-overlapping offsets of every occurrence of `needle` in `bytes`. */
function findAll(bytes: Uint8Array, needle: readonly number[]): number[] {
  const hits: number[] = [];
  if (needle.length === 0) return hits;
  for (let i = 0; i + needle.length <= bytes.length; i += 1) {
    let match = true;
    for (let j = 0; j < needle.length; j += 1) {
      if (bytes[i + j] !== needle[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      hits.push(i);
      i += needle.length - 1;
    }
  }
  return hits;
}

/** Offsets at which a line begins: 0 and the byte after each LF, CRLF, or lone CR. */
function lineStarts(bytes: Uint8Array): number[] {
  const starts = [0];
  for (let i = 0; i < bytes.length; i += 1) {
    if (bytes[i] === LF || (bytes[i] === CR && bytes[i + 1] !== LF)) {
      starts.push(i + 1);
    }
  }
  return starts;
}

/** The offset of the terminator (or EOF) ending the line that begins at `start`. */
function lineEnd(bytes: Uint8Array, start: number): number {
  let i = start;
  while (i < bytes.length && bytes[i] !== LF && bytes[i] !== CR) i += 1;
  return i;
}

/** The length of the terminator at `offset`: 2 for CRLF, 1 for LF or CR, 0 at EOF. */
function terminatorLength(bytes: Uint8Array, offset: number): number {
  if (offset >= bytes.length) return 0;
  if (bytes[offset] === CR && bytes[offset + 1] === LF) return 2;
  return 1;
}

/** A half-open byte range [start, end). */
interface ByteSpan {
  readonly start: number;
  readonly end: number;
}

/** Every `{…}` span of the file: an opening brace through the nearest later closing brace. */
function braceContainers(bytes: Uint8Array): ByteSpan[] {
  const spans: ByteSpan[] = [];
  let i = 0;
  while (i < bytes.length) {
    if (bytes[i] !== 0x7b) {
      i += 1;
      continue;
    }
    let j = i + 1;
    while (j < bytes.length && bytes[j] !== 0x7d) j += 1;
    if (j >= bytes.length) break;
    spans.push({ start: i, end: j + 1 });
    i = j + 1;
  }
  return spans;
}

// Code points spelled by number (never as escape spellings in source):
const NBSP = String.fromCharCode(0xa0); // U+00A0 — ECMAScript whitespace
const ZWNBSP = String.fromCharCode(0xfeff); // U+FEFF — ECMAScript whitespace
const LS = String.fromCharCode(0x2028); // U+2028 — ECMAScript line terminator
const PS = String.fromCharCode(0x2029); // U+2029 — ECMAScript line terminator
const NEL = String.fromCharCode(0x85); // U+0085 — neither (14.20)
const ZWSP = String.fromCharCode(0x200b); // U+200B — neither (14.20)
const BACKSLASH = String.fromCharCode(0x5c);

// --- fragment ---------------------------------------------------------------

/** Fragment interiors, [name, text]; empty first (the shrink target). */
const FRAGMENT_INTERIORS: ReadonlyArray<readonly [string, string]> = [
  ["empty", ""],
  ["prose", "frag"],
  ["a section", '<S id="f">frag.</S>'],
  ["an embedding", '{text("a.b")}'],
  ["a comment", "{/* c */}"],
  ["a nested fragment", "<>nested</>"],
  ["a multi-line interior", "\nfrag line\n"],
];

function mutateFragment(choices: Choices, bytes: Uint8Array): MutationResult {
  const mode = choices.pick([
    "balanced",
    "openOnly",
    "closeOnly",
    "wrapRange",
  ] as const);
  const offset = choices.intInclusive(0, bytes.length);
  if (mode === "balanced") {
    const [name, interior] = choices.pick(FRAGMENT_INTERIORS);
    return {
      bytes: spliceBytes(bytes, offset, 0, utf8(`<>${interior}</>`)),
      description: `insert a balanced fragment (${name}) at ${String(offset)}`,
    };
  }
  if (mode === "openOnly" || mode === "closeOnly") {
    const tag = mode === "openOnly" ? "<>" : "</>";
    return {
      bytes: spliceBytes(bytes, offset, 0, utf8(tag)),
      description: `insert a lone fragment tag ${tag} at ${String(offset)}`,
    };
  }
  const close = choices.intInclusive(offset, bytes.length);
  const opened = spliceBytes(bytes, offset, 0, utf8("<>"));
  return {
    bytes: spliceBytes(opened, close + 2, 0, utf8("</>")),
    description: `wrap bytes [${String(offset)}, ${String(close)}) in a fragment`,
  };
}

// --- braces ------------------------------------------------------------------

/**
 * Content rewrites of a `{…}` container at the comment/expression boundary
 * (SPEC 2.7, 14.20; T2.3-3, T2.7-4): [name, "wrap", prefix, suffix] keeps the
 * content bytes between the two spellings; [name, "replace", text] replaces
 * them. Names describe the form; the forms with U+2028 and the whitespace
 * singletons carry their code points, so descriptions name rather than
 * quote them.
 */
type ContentRewrite =
  | readonly [string, "wrap", string, string]
  | readonly [string, "replace", string];

const CONTENT_REWRITES: readonly ContentRewrite[] = [
  ["the content wrapped in a block comment", "wrap", "/* ", " */"],
  ["an expression beside the content", "wrap", "", " 1"],
  ["a block comment before the content", "wrap", "/* n */ ", ""],
  ["a block comment after the content", "wrap", "", " /* n */"],
  ["a line comment ended by U+000A before the content", "wrap", "// n\n", ""],
  ["a line comment ended by U+000D before the content", "wrap", "// n\r", ""],
  [
    "a run-on line comment (a brace on the commented-out line)",
    "wrap",
    "// c}\n",
    "",
  ],
  [
    "a line comment ended by U+2028, then a brace and U+000A",
    "wrap",
    `// c${LS}}\n`,
    "",
  ],
  ["empty braces", "replace", ""],
  ["two block comments", "replace", " /* a */ /* b */ "],
  ["a line comment reaching the closing brace", "replace", "// c"],
  ["U+00A0 alone", "replace", NBSP],
  ["U+FEFF alone", "replace", ZWNBSP],
  ["U+2028 alone", "replace", LS],
  ["U+2029 alone", "replace", PS],
  ["U+0085 alone", "replace", NEL],
  ["U+200B alone", "replace", ZWSP],
];

/**
 * Boundary expressions replacing a container's content (SPEC 14.20's
 * derivability contract, T14-12; the embedding forms of T2.3-3): well-formed
 * expressions that are no embedding, early-error forms, two expressions, and
 * syntax failures.
 */
const BOUNDARY_EXPRESSIONS: readonly string[] = [
  "1",
  "a, b",
  "1 = 2",
  "let",
  "010",
  "await x",
  "function(){}",
  '(text)("a")',
  'text?.("a")',
  'text("a"), 1',
  `te${BACKSLASH}u0078t("a")`,
  'text("a") text("b")',
  "text(",
  "]",
  '<S id="q">in braces</S>',
  "<b/>",
  "<></>",
  "/* unclosed",
];

/** Spread attributes inserted on a `<S ` tag (T2.7-3's grammar pair and neighbours). */
const SPREAD_ATTRIBUTES: readonly string[] = [
  " {...(a, b)}",
  " {...a, b}",
  " {...a}",
  " {...}",
  " {... /* c */ a}",
  " {...a /* c */}",
];

/** Empty-brace insertions: [text, anchor] — on a `<S ` tag or at any offset. */
const EMPTY_BRACE_INSERTIONS: ReadonlyArray<readonly [string, "tag" | "any"]> =
  [
    ["{}", "any"],
    ["{ }", "any"],
    ["{ /* c */ }", "any"],
    ["{// c\n}", "any"],
    [" d={}", "tag"],
    [" d={ /* c */ }", "tag"],
    [" coverage={}", "tag"],
  ];

/** Tails appended at EOF leaving a brace unbalanced (or a stray closer). */
const EOF_BRACE_TAILS: readonly string[] = [
  '{text("a")',
  "{",
  "{/* c",
  "{// c}",
  "{// c\n",
  "}",
  '<S id="z" d={',
  '<S id="z" d={[A.a]',
];

/** The offset just after a drawn `<S ` tag name, or a drawn offset when the file spells none. */
function drawTagOffset(choices: Choices, bytes: Uint8Array): number {
  const tags = findAll(bytes, utf8("<S "));
  return tags.length > 0
    ? choices.pick(tags) + 2
    : choices.intInclusive(0, bytes.length);
}

function mutateBraces(choices: Choices, bytes: Uint8Array): MutationResult {
  const mode = choices.pick([
    "rewriteContent",
    "boundaryExpression",
    "spreadAttribute",
    "emptyBraces",
    "unbalancedAtEof",
  ] as const);
  if (mode === "rewriteContent" || mode === "boundaryExpression") {
    let staged = bytes;
    let span: ByteSpan;
    let seeded = "";
    const spans = braceContainers(bytes);
    if (spans.length > 0) {
      span = choices.pick(spans);
    } else {
      const offset = choices.intInclusive(0, bytes.length);
      const embedding = utf8('{text("a.b")}');
      staged = spliceBytes(bytes, offset, 0, embedding);
      span = { start: offset, end: offset + embedding.length };
      seeded = " (seeded, the file holding no container)";
    }
    const content = staged.subarray(span.start + 1, span.end - 1);
    if (mode === "rewriteContent") {
      const rewrite = choices.pick(CONTENT_REWRITES);
      const replaced =
        rewrite[1] === "wrap"
          ? [...utf8(rewrite[2]), ...content, ...utf8(rewrite[3])]
          : utf8(rewrite[2]);
      return {
        bytes: spliceBytes(staged, span.start + 1, content.length, replaced),
        description: `rewrite the container at ${String(span.start)}${seeded}: ${rewrite[0]}`,
      };
    }
    const expression = choices.pick(BOUNDARY_EXPRESSIONS);
    return {
      bytes: spliceBytes(
        staged,
        span.start + 1,
        content.length,
        utf8(expression),
      ),
      description:
        `replace the content of the container at ${String(span.start)}${seeded} ` +
        `with ${JSON.stringify(expression)}`,
    };
  }
  if (mode === "spreadAttribute") {
    const attribute = choices.pick(SPREAD_ATTRIBUTES);
    const offset = drawTagOffset(choices, bytes);
    return {
      bytes: spliceBytes(bytes, offset, 0, utf8(attribute)),
      description: `insert the spread attribute ${JSON.stringify(attribute.trim())} at ${String(offset)}`,
    };
  }
  if (mode === "emptyBraces") {
    const [text, anchor] = choices.pick(EMPTY_BRACE_INSERTIONS);
    const offset =
      anchor === "tag"
        ? drawTagOffset(choices, bytes)
        : choices.intInclusive(0, bytes.length);
    return {
      bytes: spliceBytes(bytes, offset, 0, utf8(text)),
      description: `insert empty braces ${JSON.stringify(text.trim())} at ${String(offset)}`,
    };
  }
  const lastCloser = bytes.lastIndexOf(0x7d);
  if (lastCloser >= 0 && choices.boolean(0.25)) {
    return {
      bytes: spliceBytes(bytes, lastCloser, 1, []),
      description: `delete the file's last closing brace at ${String(lastCloser)}`,
    };
  }
  const tail = choices.pick(EOF_BRACE_TAILS);
  return {
    bytes: spliceBytes(bytes, bytes.length, 0, utf8(tail)),
    description: `append ${JSON.stringify(tail)} at EOF (unbalanced braces)`,
  };
}

// --- esmBlock ----------------------------------------------------------------

const ESM_LINE_LEADS: ReadonlyArray<readonly number[]> = [
  utf8("import "),
  utf8("export "),
];

/** Start offsets of the lines beginning with `import ` or `export `. */
function esmLineStarts(bytes: Uint8Array): number[] {
  return lineStarts(bytes).filter((start) =>
    ESM_LINE_LEADS.some((lead) =>
      lead.every((byte, i) => bytes[start + i] === byte),
    ),
  );
}

const SEEDED_DECLARATION = 'import Z from "./A.xspec"';

/**
 * Comment insertions around a declaration line, [name, text, anchor]: before
 * the line (own-line forms), at its start (a comment before the declaration
 * on its line), at its end (trailing), or on the line after it with no blank
 * line between (SPEC 14.20's block; T3-7's forms).
 */
const ESM_COMMENT_INSERTIONS: ReadonlyArray<
  readonly [string, string, "before" | "lineStart" | "lineEnd" | "after"]
> = [
  ["an own-line line comment before it", "// note\n", "before"],
  ["an own-line block comment before it", "/* c */\n", "before"],
  ["a block comment spanning lines before it", "/* a\n b */\n", "before"],
  [
    "a block comment before the declaration on its line",
    "/* c */ ",
    "lineStart",
  ],
  ["a trailing line comment", " // note", "lineEnd"],
  ["a trailing block comment", " /* c */", "lineEnd"],
  [
    "an own-line line comment after it, no blank line between",
    "// tail\n",
    "after",
  ],
  [
    "an own-line block comment after it, no blank line between",
    "/* tail */\n",
    "after",
  ],
];

/** Terminator rewrites of a declaration line, [name, text] replacing its terminator. */
const ESM_TERMINATOR_REWRITES: ReadonlyArray<readonly [string, string]> = [
  ["CR", "\r"],
  ["CRLF", "\r\n"],
  ["U+2028", LS],
  ["U+2029", PS],
  ["a blank line", "\n\n"],
  ["a space (joining the next line)", " "],
  ["`;` and LF", ";\n"],
];

/** Indentation prefixes, [name, text]. */
const ESM_INDENTS: ReadonlyArray<readonly [string, string]> = [
  ["one space", " "],
  ["three spaces", "   "],
  ["four spaces", "    "],
  ["a tab", "\t"],
];

/** Second declarations joining or following a block, [name, text]. */
const ESM_SECOND_DECLARATIONS: ReadonlyArray<readonly [string, string]> = [
  ["a duplicate binding", 'import A from "./A.xspec"'],
  ["a fresh binding", SEEDED_DECLARATION],
  ["a side-effect-only import", 'import "./A.xspec"'],
  ["import attributes", 'import A from "./A.xspec" with { type: "json" }'],
  ["an export naming no declaration", "export { nope }"],
  ["an export holding JSX", "export const x = <b/>"],
  ["a default export", "export default 1"],
];

/** Statements at a line start, [name, text]. */
const ESM_STATEMENTS: ReadonlyArray<readonly [string, string]> = [
  ["a declaration statement", "const x = 1"],
  ["an expression statement", "x;"],
  ["a bare `let`", "let"],
  ["an exported declaration", "export const x = 1"],
  ["a statement holding a spec import", 'const y = import("./A.xspec")'],
];

function mutateEsmBlock(choices: Choices, bytes: Uint8Array): MutationResult {
  const mode = choices.pick([
    "comment",
    "terminator",
    "indent",
    "split",
    "join",
    "statement",
  ] as const);
  // Anchor: a drawn declaration line, seeded at a drawn line start when the
  // file holds none.
  let staged = bytes;
  let start: number;
  let seeded = "";
  const declarations = esmLineStarts(bytes);
  if (declarations.length > 0) {
    start = choices.pick(declarations);
  } else {
    start = choices.pick(lineStarts(bytes));
    staged = spliceBytes(bytes, start, 0, utf8(`${SEEDED_DECLARATION}\n\n`));
    seeded = " (seeded, the file holding no declaration line)";
  }
  const end = lineEnd(staged, start);
  const terminator = terminatorLength(staged, end);
  const nextLine = end + terminator;
  const at = `the declaration line at ${String(start)}${seeded}`;
  if (mode === "comment") {
    const [name, text, anchor] = choices.pick(ESM_COMMENT_INSERTIONS);
    const offset =
      anchor === "before" || anchor === "lineStart"
        ? start
        : anchor === "lineEnd"
          ? end
          : nextLine;
    const insert = anchor === "after" && terminator === 0 ? `\n${text}` : text;
    return {
      bytes: spliceBytes(staged, offset, 0, utf8(insert)),
      description: `insert ${name} around ${at}`,
    };
  }
  if (mode === "terminator") {
    if (choices.boolean(0.3)) {
      const semicolon = end > start && staged[end - 1] === 0x3b;
      return {
        bytes: semicolon
          ? spliceBytes(staged, end - 1, 1, [])
          : spliceBytes(staged, end, 0, [0x3b]),
        description: `${semicolon ? "remove" : "append"} the \`;\` of ${at}`,
      };
    }
    const [name, text] = choices.pick(ESM_TERMINATOR_REWRITES);
    return {
      bytes: spliceBytes(staged, end, terminator, utf8(text)),
      description: `rewrite the terminator of ${at} to ${name}`,
    };
  }
  if (mode === "indent") {
    const [name, text] = choices.pick(ESM_INDENTS);
    return {
      bytes: spliceBytes(staged, start, 0, utf8(text)),
      description: `indent ${at} by ${name}`,
    };
  }
  if (mode === "split") {
    const [name, text] = choices.pick(ESM_SECOND_DECLARATIONS);
    return {
      bytes: spliceBytes(staged, end, 0, utf8(`\n\n${text}`)),
      description: `add ${name} in a separate block after ${at}`,
    };
  }
  if (mode === "join") {
    if (choices.boolean(0.4)) {
      // Delete the blank line(s) after the block so the following content
      // joins it.
      let blankEnd = nextLine;
      while (blankEnd < staged.length) {
        const lineTerminator = terminatorLength(staged, blankEnd);
        if (lineTerminator === 0 || lineEnd(staged, blankEnd) !== blankEnd) {
          break;
        }
        blankEnd += lineTerminator;
      }
      if (blankEnd > nextLine) {
        return {
          bytes: spliceBytes(staged, nextLine, blankEnd - nextLine, []),
          description: `delete the blank line(s) after ${at}`,
        };
      }
    }
    const [name, text] = choices.pick(ESM_SECOND_DECLARATIONS);
    return {
      bytes: spliceBytes(staged, end, 0, utf8(`\n${text}`)),
      description: `add ${name} on the line after ${at} (one block)`,
    };
  }
  const [name, text] = choices.pick(ESM_STATEMENTS);
  if (choices.boolean(0.6)) {
    return {
      bytes: spliceBytes(staged, end, 0, utf8(`\n${text}`)),
      description: `add ${name} on the line after ${at} (one block)`,
    };
  }
  const lineStart = choices.pick(lineStarts(staged));
  return {
    bytes: spliceBytes(staged, lineStart, 0, utf8(`${text}\n`)),
    description: `insert ${name} at the line start ${String(lineStart)}${seeded}`,
  };
}

type Mutator = (
  choices: Choices,
  bytes: Uint8Array,
  path: string,
) => MutationResult;

/** Simplest-first (weightedPick shrinks toward the first entry). */
const MUTATION_KINDS: ReadonlyArray<readonly [number, Mutator]> = [
  [5, (c, b) => mutateSplice(c, b)],
  [3, (c, b) => mutateInvalidUtf8(c, b)],
  [2, (c, b) => mutateBom(c, b)],
  [3, (c, b) => mutateTerminators(c, b)],
  [2, mutateNesting],
  [2, (c, b) => mutateTruncate(c, b)],
  [2, (c, b) => mutateShuffle(c, b)],
  [2, (c, b) => mutateGarbage(c, b)],
  [2, (c, b) => mutateFragment(c, b)],
  [3, (c, b) => mutateBraces(c, b)],
  [3, (c, b) => mutateEsmBlock(c, b)],
];

/**
 * Draw one mutation from the weighted menu (the module header's full input
 * classes of P-8) and apply it to the given bytes: one weightedPick for the
 * kind, then the kind's own parameter draws — all through `choices`, so
 * identical tapes re-derive identical staged bytes on replay and during
 * shrinking (H-10). The one mutation-drawing entry point shared with P-11
 * (TEST-SPEC §16 P-11: "P-8's generators").
 */
export function drawFuzzMutation(
  choices: Choices,
  bytes: Uint8Array,
  path: string,
): MutationResult {
  const mutate = choices.weightedPick(MUTATION_KINDS);
  return mutate(choices, bytes, path);
}

// ---------------------------------------------------------------------------
// Trial generation

/** One generated trial: final staged bytes, a log, and drawn commands. */
export interface FuzzTrial {
  /** Staged bytes per workspace-relative path (base files + mutations). */
  readonly files: ReadonlyArray<readonly [string, Uint8Array]>;
  /** Human-readable description of each applied mutation. */
  readonly mutations: readonly string[];
  /** Drawn command invocations, run after the fixed `build --json` arm. */
  readonly commands: ReadonlyArray<readonly string[]>;
}

/** Mutations applied per trial: 1 + a draw in [0, MAX_MUTATIONS_PER_TRIAL - 1]. */
export const MAX_MUTATIONS_PER_TRIAL = 3;

/** The P-8 trial generator (see the module header). */
export const genFuzzTrial: Gen<FuzzTrial> = (choices) => {
  const files = new Map<string, Uint8Array>(
    FUZZ_BASE_FILES.map(([path, text]) => [
      path,
      Uint8Array.from(Buffer.from(text, "utf8")),
    ]),
  );
  const mutations: string[] = [];
  const mutationCount =
    1 + choices.intInclusive(0, MAX_MUTATIONS_PER_TRIAL - 1);
  for (let i = 0; i < mutationCount; i += 1) {
    const path = choices.pick(MUTATION_TARGETS);
    const current = files.get(path);
    if (current === undefined) {
      throw new Error(`P-8 harness defect: no staged bytes for ${path}`);
    }
    const result = drawFuzzMutation(choices, current, path);
    files.set(path, result.bytes);
    mutations.push(`${path}: ${result.description}`);
  }
  const commands = listOf((c: Choices) => c.pick(COMMAND_MENU), {
    min: 2,
    max: 4,
  })(choices);
  return { files: [...files.entries()], mutations, commands };
};

/** Counterexample rendering: the mutation log and the drawn commands. */
export function renderFuzzTrial(trial: FuzzTrial): string {
  return JSON.stringify({
    mutations: trial.mutations,
    commands: trial.commands.map((argv) => argv.join(" ")),
  });
}

// ---------------------------------------------------------------------------
// Assertions

/**
 * Per-invocation hang guard for fuzz runs. Purely the H-8 guard bounding the
 * observation "the command terminates" — never an assertion input beyond
 * that (H-10); generously above any plausible parse time for these staged
 * inputs (≤ ~100 KiB per file), and small enough that a falsified
 * termination clause shrinks within the test budget.
 */
const FUZZ_COMMAND_TIMEOUT_MS = 10_000;

/**
 * Run one command over the fuzzed workspace, converting the hang-guard and
 * runaway-output kills — exactly those — into diagnosed assertion failures:
 * P-8's first clause is that every command terminates. Anything else thrown
 * by the driver stays a harness error (H-8).
 */
async function runFuzzCommand(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
): Promise<RunResult> {
  try {
    return await runProduct(product, {
      cwd: workspace.root,
      argv,
      timeoutMs: FUZZ_COMMAND_TIMEOUT_MS,
    });
  } catch (error) {
    if (error instanceof ProductRunTimeoutError) {
      fail(
        `P-8: every command must terminate on fuzzed input (TEST-SPEC §16 P-8; ` +
          `SPEC 12.0), but the invocation was still running when the harness's ` +
          `hang guard killed it — ${error.message}`,
      );
    }
    if (error instanceof ProductRunOutputOverflowError) {
      fail(
        `P-8: every command must terminate on fuzzed input with bounded output ` +
          `(TEST-SPEC §16 P-8; SPEC 12.0), but the invocation emitted unbounded ` +
          `output until the harness's runaway-output guard killed it — ${error.message}`,
      );
    }
    throw error;
  }
}

/**
 * The 12.0 exit-code partition for a run without `--json`: no signal death,
 * exit code exactly 0, 1, or 2. (`assertJsonOutputConvention` asserts the
 * same partition plus the stdout contract for `--json` runs.)
 */
function assertExitPartition(result: RunResult, context: string): void {
  if (result.signal !== null) {
    fail(
      `${context}: ${result.commandLine} died by signal ${String(result.signal)} ` +
        `instead of exiting — SPEC 12.0 partitions all outcomes into exit ` +
        `codes 0, 1, and 2 (P-8)`,
    );
  }
  if (result.exitCode !== 0 && result.exitCode !== 1 && result.exitCode !== 2) {
    fail(
      `${context}: exit code ${String(result.exitCode)} from ${result.commandLine} ` +
        `is outside the SPEC 12.0 partition (0 success, 1 findings, 2 ` +
        `usage/configuration) — P-8: fuzzed input never yields another exit class`,
    );
  }
}

function describeCommand(argv: readonly string[]): string {
  return `\`xspec ${argv.join(" ")}\``;
}

/**
 * Run one command with the P-8 assertions: termination (via
 * `runFuzzCommand`), the 12.0 exit partition, and — when the invocation
 * carries `--json` — the never-a-partial-JSON-document contract. For `build`
 * invocations the modifies-nothing arm rides along: on a non-zero exit the
 * whole workspace tree must be byte-identical around the run (SPEC 12.1).
 */
async function runFuzzArm(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  trial: FuzzTrial,
): Promise<void> {
  const context =
    `P-8 ${describeCommand(argv)} over the fuzzed workspace ` +
    `(mutations: ${JSON.stringify(trial.mutations)})`;
  const isBuild = argv[0] === "build";
  const before = isBuild ? await snapshotDirectory(workspace.root) : undefined;
  const result = await runFuzzCommand(product, workspace, argv);
  if (argv.includes("--json")) {
    assertJsonOutputConvention(result, context);
  } else {
    assertExitPartition(result, context);
  }
  if (before !== undefined && result.exitCode !== 0) {
    const after = await snapshotDirectory(workspace.root);
    assertSnapshotsEqual(
      before,
      after,
      `${context}: a \`build\` failing with exit ${String(result.exitCode)} ` +
        `modifies nothing — every derived file and all graph data remain ` +
        `byte-for-byte as they were (SPEC 12.1; P-8)`,
    );
  }
}

/** The P-8 property body for one trial (see the module header). */
async function runFuzzTrial(
  product: ProductBinding,
  trial: FuzzTrial,
): Promise<void> {
  // S-9: the base `.mdx` sources are the harness's constants, staged afresh
  // per trial — as records from the second trial on too (`FUZZ_BASE_RECORDS`).
  const workspace = await TestWorkspace.create({
    files: fuzzBaseWorkspaceFiles(),
  });
  try {
    // Staging: the base workspace is SPEC-valid; a successful build leaves
    // prior derived state for the modifies-nothing arm.
    await buildOk(
      product,
      workspace,
      "P-8 staging `build` over the valid base workspace (prior derived " +
        "state for the modifies-nothing arm, SPEC 12.1)",
    );
    for (const [path, bytes] of trial.files) {
      // S-9: a mutated document's derivability is undeclared (fuzz).
      await workspace.file(path, bytes, { mdx: "unchecked" });
    }
    await runFuzzArm(product, workspace, ["build", "--json"], trial);
    for (const argv of trial.commands) {
      await runFuzzArm(product, workspace, argv, trial);
    }
  } finally {
    await workspace.dispose();
  }
}

// ---------------------------------------------------------------------------
// The registered fuzz test

const P_8 = defineProductTest({
  id: "P-8",
  title:
    "fuzz: over byte-mutated MDX/TS/config (fragments, brace content at the " +
    "2.7/14.20 boundaries, ESM-block mutations, invalid UTF-8, BOMs, giant " +
    "nesting, pathological line terminators), every command terminates, never emits a " +
    "partial JSON document under --json, always exits 0, 1, or 2, and failing " +
    "`build`s modify nothing (SPEC 12.0, 12.1; TEST-SPEC §16 P-8)",
  // Wall-clock hang guard only (H-10): three fixed seeds (E-5), one staging
  // build plus a 3–5 command sweep with per-arm snapshots per trial, plus
  // the shrink budget on falsification.
  timeoutMs: 420_000,
  run: async (product) => {
    await checkProperty(
      "P-8 parser robustness",
      genFuzzTrial,
      async (trial) => {
        await runFuzzTrial(product, trial);
      },
      { runs: 12, maxShrinkExecutions: 100, render: renderFuzzTrial },
    );
  },
});

/** TEST-SPEC §16 P-8 (PROP-06). */
export const section16P8Tests: readonly ProductTestEntry[] = [P_8];
