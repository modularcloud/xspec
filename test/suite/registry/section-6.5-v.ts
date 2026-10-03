// TEST-SPEC §6.5 (move), fifth part — SUITE-25 (continued): T6.5-23,
// statement boundaries, the directive prologue, and timeliness. T6.5-1…
// T6.5-10 are section-6.5.ts's business, T6.5-11 section-6.5-ii.ts's,
// T6.5-12…T6.5-19 section-6.5-iii.ts's, and T6.5-20…T6.5-22
// section-6.5-iv.ts's; this module keeps those files' edits bounded (the
// section-10.7-i/-ii precedent).
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), decodes output through the H-3 adapters,
// and rejects a product only via diagnosed assertion failures (H-8).
//
// SPEC 6.5 (Added imports): a declaration added to a file existing before
// the operation stands at an admissible offset — one lying inside none of
// the file's statements before the edit, so that it splits none, and, in a
// TypeScript source, a top-level declaration whose bindings are timely for
// every spelling rooted at them, at or after the end of the file's
// directive prologue, following the end of a top-level statement with
// nothing but whitespace (1.4) between, the prologue's end and the
// statement's each judged, like timeliness, over the file before the edit.
// An admissible offset at the start of a line is taken over any other; the
// choice among several such, or among mid-line ones where no line start is
// admissible, is the implementation's latitude.
//
// Conservative operationalizations (noted per H-4):
// - One fresh workspace per staging (H-1), every file a staged-source record
//   (S-9's timing clause: every staging but the body's first follows a
//   product invocation). Arms (a) through (e): one spec group
//   (`specs/**/*.mdx`) and one code group (`src/**/*.ts`);
//   `specs/origin.mdx` holding the top-level sections
//   `x`, moved, and `w`, kept; `specs/target.mdx` holding `z` (the target
//   (o) names, one staging throughout); the staging's `src/c.ts`; and, for
//   (e)'s 6.5 shape, `specs/c.mdx` holding `c`. Each arm is TEST-SPEC's
//   `move specs/origin.mdx#x specs/target.mdx#y`: the marker `O.x` sits on
//   the moved node and `O.w` on a kept one, so the origin declaration stays
//   and the receiver gains one declaration, binding the target module's
//   default.
// - Per staging (`runS23Arm`): `build --json` clean over the staging (the
//   premise — a valid workspace, so a later failure is the move's); the
//   `--preview --json` twin taken first (a preview modifies nothing, 6.6);
//   then the real move with `--json`, exit 0 and the form-exact 12.7
//   performed-operation document.
// - The byte contract: `src/c.ts` after the move is a plain file of valid
//   UTF-8 that TypeScript 5.9.3 accepts both as module code and as script
//   code (`judgeTypeScript`, S-9's judge, held as an assertion on the
//   product's bytes; 14.20), and it is exactly the staged bytes composed in
//   pre-operation coordinates (6.6): the marker's span replaced by `<X>.y`,
//   and `import <X> from "../specs/target.xspec"` inserted under 6.5's line
//   discipline — followed by U+000A, preceded by one exactly when the offset
//   is not at the start of a line of the composed text with the insertion
//   absent (3's terminators, `atLineStart`) — at one of the admissible
//   offsets TEST-SPEC names for the staging. Value-blind in `<X>` alone,
//   read from the one declaration the file gained (`judgeAddedImportsOfFile`,
//   T6.5-22(a)'s judgement over the file's two texts, one code path with the
//   subprocess driver's hook, which judges every performed move besides),
//   byte-exact in every other character (T6.5-8's discipline). Each staging's
//   admissible offsets compose pairwise distinct bytes, so the bytes name the
//   offset the real operation used.
// - The preview parity (T6.6-4(b)): the preview's entry for `src/c.ts` holds
//   exactly one `import-addition` edit, zero-length, at that offset. The
//   entry's other edits are T6.6-4's and T6.6-3's business, unasserted here.
// - `check --json`, then `build --json`, exactly `{"findings": []}` after the
//   move.
// - (c)'s standard-tooling compile (H-2): the consumer project over
//   `src/c.ts` (`test/helpers/tooling.ts`) reports no diagnostic after the
//   premise build and none after the move — the `@ts-expect-error` directive
//   governing `const n: number = "x"`, its one type error, both times.
// - Before any product is driven on a staging, each admissible offset's
//   composed form, a placeholder in `<X>`'s place, is held to the same
//   TypeScript judge: a form it rejects is a harness defect (S-9: the
//   derivability of every composed form), never a product verdict.
// - Every staging runs; each one's diagnosed failure is collected and the
//   body fails once at the end, naming every staging that failed, so one run
//   diagnoses every placement. A harness error — anything but a diagnosed
//   assertion failure, a hang included — propagates at once. Where the
//   product's bytes read as the declaration inserted at another offset, the
//   diagnosis names that offset and, where TEST-SPEC states it, why 6.5
//   excludes it.
// - Arms (f) and (g) widen the staging: each names its own move, files, and
//   receiver (`S23Arm`). (f)'s seven stagings are TEST-SPEC's `move
//   specs/A.mdx#m specs/B.mdx#m` over `specs/A.mdx` holding `m` and `k` and
//   `specs/B.mdx` holding `b` and no `m`, the receiver `src/c.ts` under the
//   arms' two groups. Where the receiver gains a declaration it is `import
//   <X> from "../specs/B.xspec"`, the marker `A.m` rewritten in place to
//   `<X>.m`, composed and judged as above; where it gains none (the control,
//   the two exempt-side stagings, the precedence branch) the file is exactly
//   the staged bytes with `A.m` rewritten to `B.m` — no declaration added
//   (T6.5-22(a)'s judgement reads none), no other byte changed. The preview
//   is taken wherever the receiver gains a declaration (the
//   `import-addition` parity) and wherever TEST-SPEC states the preview's
//   edits — the exempt side: one `reference-rewrite` and no
//   `import-addition` or `import-removal`; the precedence branch: one
//   `reference-rewrite` spanning [70, 73) and the same absences; the
//   control states none, so its preview is not taken. After 6.5's example
//   and the precedence branch, `query edges --from src/c.ts --to
//   specs/B.mdx#m --kinds references` answers exactly the marker's edge (a
//   top-level statement's reference is attributed to the file, 4.6).
// - (g)'s receiver is the spec source `specs/target.mdx`, receiving into
//   `p.n` T6.5-13(h)'s moved text: T6.5-13's cross-file origin `specs/a.mdx`
//   and third module `specs/x.mdx` (section-6.5-iii.ts's records, under its
//   one-spec-group R16_CONFIG), the same `a`-alone record at `specs/k.mdx`
//   for `K.a`, and `move specs/a.mdx#m specs/target.mdx#p.n`. The moved text
//   — its lines, its embedding re-rooted at `<X>`, and a U+000A — is a
//   zero-length span of the rewrite at the start of the `</S>` line, as
//   T6.5-13 composes it; `import <X> from "./x.xspec"` stands at offset 0,
//   28, or 59 (6.5's latitude among the three line starts). Its forms are
//   judged by S-9's MDX judge (`deriveMdx`) in place of the TypeScript one,
//   the form composed at the start of line 2 among the premises: it derives,
//   TEST-SPEC states, though it splits `K`'s declaration.
// - Arms (h) through (j) stage `f` = `export function f() { O.x }`, so `O`'s
//   declaration loses its last use and is removed with its line: the removal
//   is a rewrite spelled `""` over TEST-SPEC's range (cross-checked against
//   the staged text at module load), and the declaration stands at the
//   removal's end, the one admissible offset. The removal's start composes
//   the same bytes (an insertion before an edit beginning there), so the
//   preview's `import-addition` parity alone tells the two apart
//   (T6.6-4(b)). (h) states its preview's edits — one `reference-rewrite`
//   spanning the marker, one `import-removal` spanning [0, 38) — and the
//   marker's `references` edge from `src/c.ts#f`, the unit holding it (4.6).
// - (k) is (f)'s move over a call: `ta(A.m)` rewritten whole, the added
//   declaration binding `B`'s module's `text` alone — `import { text as <Y> }
//   from "../specs/B.xspec"`, or `import { text } …` where the identifier is
//   `text` itself (`S23Spelling`; value-blind in `<Y>` alone, each
//   spelling's composed forms among the premises); its control adds nothing,
//   the call re-rooted at `tb(B.m)`. Both state the preview's one
//   `reference-rewrite` spanning the call and no `import-removal`, and the
//   call's `embeds` edge from `src/c.ts` to `specs/B.mdx#m`.
// - (l) and (m) are (f)'s move over two declarations of `A`'s module, `A1`
//   and `A2`, `specs/A.mdx` holding `m`, its child `m.c`, and `k`: the
//   markers `A1.m` and `A2.m.c` are two rewrites, (l) rooting both at the
//   one added binding (`<X>.m`, `<X>.m.c`), (m) `A1.m` alone, `A2.m.c`
//   re-rooted at the held `B` (`B.m.c`); each at offset 34 alone (the
//   line-start preference), the preview's two `reference-rewrite` edits and
//   no `import-removal`, and both markers' `references` edges from
//   `src/c.ts`.
// - (n) is (d)'s file with `f` spread over lines, and with `namespace N {`
//   in its place: 37 or 38; the line starts inside the body are judged
//   among the premises as deriving (`deriving`), as TEST-SPEC states.
// - (o)'s receiver is the spec source `specs/third.mdx` (R16_CONFIG, no
//   code group): `O.x` re-rooted at the later-declared `T`, nothing added,
//   `O`'s declaration removed with its line, [0, 31) (a rewrite spelled
//   `""`); the preview's `reference-rewrite` [45, 48) and `import-removal`
//   [0, 31), and `p`'s `depends` edge to `specs/target.mdx#y`.
// - (p) stages each of U+0020, U+0009, U+000B, and U+000C (built from code
//   points) between `O`'s declaration and its line's terminator: 39 alone,
//   the preview's `reference-rewrite` [61, 64) and no `import-removal`.

import { Buffer } from "node:buffer";
import type {
  EdgeKind,
  PreviewEdit,
  PreviewEditClass,
  PreviewFileEntry,
} from "../../helpers/adapters/index.js";
import {
  decodeAppliedMappingReport,
  decodeEdgesReport,
  decodePreviewReport,
} from "../../helpers/adapters/index.js";
import {
  type AddedImportDeclaration,
  judgeAddedImportsOfFile,
} from "../../helpers/added-import-identifiers.js";
import { fail, HarnessAssertionError } from "../../helpers/assertions.js";
import { atLineStart } from "../../helpers/import-insertion.js";
import { deriveMdx } from "../../helpers/mdx-derivability.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { type StagedMdx, stagedMdx } from "../../helpers/staged-mdx.js";
import { type StagedTs, stagedTs } from "../../helpers/staged-ts.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import {
  assertNoCompileErrors,
  ConsumerProject,
} from "../../helpers/tooling.js";
import { judgeTypeScript } from "../../helpers/ts-derivability.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { InitialFileContents } from "../../helpers/workspace.js";
import {
  A13_ORIGIN_STAGED,
  A13_THIRD_STAGED,
  a13MovedLines,
  R16_CONFIG,
} from "./section-6.5-iii.js";
import {
  assertEdgeSetEqual,
  expectFindingFreeReport,
  runJson,
} from "./support.js";

// ---------------------------------------------------------------------------
// T6.5-23 Statement boundaries, the directive prologue, and timeliness
// ---------------------------------------------------------------------------

const S23_ORIGIN = "specs/origin.mdx";
const S23_TARGET = "specs/target.mdx";
const S23_C_SPEC = "specs/c.mdx";
/** The receiving file of every staging below but (g)'s. */
const S23_APP = "src/c.ts";
/** The arms' move (TEST-SPEC: "a section move of `specs/origin.mdx#x` to
 * `specs/target.mdx#y`"). */
const S23_ARGV = ["move", "specs/origin.mdx#x", "specs/target.mdx#y"] as const;
/** The target module's canonical relative specifier from `src/` (6.5). */
const S23_TARGET_SPECIFIER = "../specs/target.xspec";

// One spec group and one code group (SPEC 7.1, 7.2): a staged-source record,
// staged by every staging after the body's first invocation (S-9's timing
// clause).
const S23_CONFIG = stagedTs(
  "T6.5-23 xspec.config.ts — one spec group and one code group globbing src/**/*.ts",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: {
    app: ["src/**/*.ts"]
  }
})
`,
);

// The origin: the moved section `x` and the kept `w`, each alone on its
// lines.
const S23_ORIGIN_SOURCE: StagedMdx = stagedMdx(
  "T6.5-23 specs/origin.mdx (the moved x, the kept w)",
  [
    '<S id="x">',
    "Origin x text.",
    "</S>",
    "",
    '<S id="w">',
    "Kept w text.",
    "</S>",
    "",
  ].join("\n"),
);

// The target: an existing discovered source holding `z` ((o)'s target), so
// the move inserts the re-identified `y` into it.
const S23_TARGET_SOURCE: StagedMdx = stagedMdx(
  "T6.5-23 specs/target.mdx (z)",
  ['<S id="z">', "Target z text.", "</S>", ""].join("\n"),
);

// (e)'s 6.5 shape embeds `c` through `textC(C.c)`.
const S23_C_SOURCE: StagedMdx = stagedMdx(
  "T6.5-23 (e) specs/c.mdx (c, embedded by 6.5's own shape)",
  ['<S id="c">', "C text.", "</S>", ""].join("\n"),
);

/** The origin module's declaration, `O`'s, at [0, 37) where it heads a line. */
const S23_IMPORT_O = 'import O from "../specs/origin.xspec"';

/** `f` (TEST-SPEC): the marker `O.x` on the moved node, `O.w` on a kept one. */
const S23_F = "export function f() { O.x; O.w }";

// The two characters (d) stages after `O`'s declaration, built from their
// code points (never escape-spelled in this source).
/** U+00A0 NO-BREAK SPACE: whitespace under ECMAScript, none under 1.4. */
const S23_NBSP = String.fromCodePoint(0xa0);
/** U+2028 LINE SEPARATOR: an ECMAScript line terminator, none under 3. */
const S23_LSEP = String.fromCodePoint(0x2028);

/** One span of the receiving file the rewrite replaces, in pre-operation
 * coordinates (6.6) — zero-length for an insertion ((g)'s moved text). */
interface S23Rewrite {
  readonly start: number;
  readonly end: number;
  /** The replacement's characters, given the added binding's identifier. */
  readonly spelled: (ident: string) => string;
}

/**
 * An added declaration's exact spelling other than `import <X> from "…"`
 * (SPEC 6.5's spellings: `import { text as Y } from "…"`, the named binding
 * `{ text }` where its identifier is `text` itself) — (k)'s.
 */
interface S23Spelling {
  /** The declaration's characters, given the added binding's identifier. */
  readonly declaration: (ident: string) => string;
  /** The form in words, for diagnoses. */
  readonly form: string;
  /** Identifiers the spelling treats apart ((k): `text` itself), whose
   * composed forms the premises judge beside the placeholder's. */
  readonly also: readonly string[];
}

/** The one declaration a staging's receiver gains (SPEC 6.5). */
interface S23Addition {
  /** Its module's canonical specifier, as 6.5 spells it from the receiver. */
  readonly specifier: string;
  /** Its spelling where it binds no module default — `undefined`: exactly
   * `import <X> from "<specifier>"`, binding the module's default. */
  readonly spelled?: S23Spelling;
  /** The admissible offsets TEST-SPEC names, pre-operation bytes. */
  readonly offsets: readonly number[];
  /** Why the receiver gains exactly this declaration, for diagnoses. */
  readonly why: string;
}

/** A span a preview edit covers, pre-operation bytes (SPEC 6.6, 12.7). */
interface S23Span {
  readonly start: number;
  readonly end: number;
}

/**
 * What the receiver's preview entry reports beside the `import-addition`
 * parity — exactly one, zero-length at the offset the real operation used,
 * where the receiver gains a declaration; none where it gains none: its
 * `reference-rewrite` edits (their exact spans, or their count where
 * TEST-SPEC names no span) and its `import-removal` edits (their exact
 * spans), each unasserted where undefined — T6.6-4's and T6.6-3's business.
 */
interface S23PreviewExpectation {
  readonly rewrites?: number | readonly S23Span[];
  readonly removals?: readonly S23Span[];
}

/** A `query edges` answer after the move: exactly this edge between its two
 * graph nodes, of its kind (SPEC 11.1, 5.2, 4.6). */
interface S23Edge {
  readonly from: string;
  readonly to: string;
  readonly kind: EdgeKind;
  /** Whose edge it is, for diagnoses. */
  readonly what: string;
}

/** One byte-asserted staging of T6.5-23. */
interface S23Arm {
  /** The entry's arm and staging, e.g. `(a) between two directives`. */
  readonly key: string;
  /** The receiving file — the one whose post-move bytes the arm composes. */
  readonly receiver: string;
  /** Its kind: the grammar S-9 and T6.5-22(a)'s judgement read it under. */
  readonly kind: "typescript" | "spec-source";
  /** The staged receiver. */
  readonly text: string;
  /** Its staged-source record (S-9). */
  readonly staged: StagedTs | StagedMdx;
  /** Every other file of the staging, the configuration included. */
  readonly files: Readonly<Record<string, InitialFileContents>>;
  /** The move. */
  readonly argv: readonly string[];
  /** The rewrite's replaced spans. */
  readonly rewrites: readonly S23Rewrite[];
  /** The declaration the receiver gains, or `undefined`: it gains none. */
  readonly addition: S23Addition | undefined;
  /** Where 6.5 admits the added line here and why — or why nothing is
   * added — for diagnoses. */
  readonly placement: string;
  /** Inadmissible offsets TEST-SPEC names, with why, for diagnoses. */
  readonly excluded: Readonly<Record<number, string>>;
  /** Inadmissible offsets whose composed forms TEST-SPEC states derive
   * (S-9), judged with the premises. */
  readonly deriving?: readonly number[];
  /** What the preview's entry reports, where TEST-SPEC states it; the
   * preview is taken wherever this is set or the receiver gains a
   * declaration (T6.6-4(b)). */
  readonly preview?: S23PreviewExpectation;
  /** `query edges` answers after the move. */
  readonly edges?: readonly S23Edge[];
  /** (c): why the file compiles clean under standard tooling (H-2). */
  readonly compiles?: string;
}

/** The added declaration (6.5's exact spelling) binding `ident` to the
 * module `specifier` designates. */
function s23Declaration(
  ident: string,
  specifier: string = S23_TARGET_SPECIFIER,
): string {
  return `import ${ident} from "${specifier}"`;
}

/** The declaration `addition` adds, spelled for the identifier `ident`. */
function s23Added(addition: S23Addition, ident: string): string {
  return (
    addition.spelled?.declaration(ident) ??
    s23Declaration(ident, addition.specifier)
  );
}

/** `addition`'s spelling in words, for diagnoses. */
function s23Form(addition: S23Addition): string {
  return (
    addition.spelled?.form ??
    `\`import <X> from "${addition.specifier}"\`, binding its module's default`
  );
}

/** The marker's span in `text` — `O.x` unless `marker` says otherwise —
 * rewritten as `spelled` spells it, `<X>.y` by default (6.4: prefix
 * replacement, the chain re-rooted at the binding 6.5 chooses). */
function s23Marker(
  text: string,
  key: string,
  marker = "O.x",
  spelled: (ident: string) => string = (ident) => `${ident}.y`,
): S23Rewrite {
  const bytes = Buffer.from(text, "utf8");
  const start = bytes.indexOf(marker);
  if (start < 0 || bytes.lastIndexOf(marker) !== start) {
    throw new Error(
      `T6.5-23 ${key}: a harness defect — the staged ${S23_APP} must hold ` +
        `the marker \`${marker}\` exactly once`,
    );
  }
  return { start, end: start + Buffer.byteLength(marker, "utf8"), spelled };
}

/**
 * The receiving file as the rewrite leaves it, composed in pre-operation
 * coordinates (SPEC 6.5, 6.6): each rewrite's span replaced whole and, given
 * an addition, its declaration inserted at the offset — before an edit
 * beginning there, after one ending there — followed by U+000A and preceded
 * by one exactly when the offset is not at the start of a line of the
 * composed text with the insertion's own result absent (6.5; 3's
 * terminators, `atLineStart`) — or, for the misplacement diagnosis alone,
 * exactly when `lead` says so. `undefined` when the offset lies strictly
 * inside a replaced span (no admissible offset does, 6.5).
 */
function s23Compose(
  pre: Uint8Array,
  rewrites: readonly S23Rewrite[],
  ident: string,
  addition?: {
    readonly offset: number;
    readonly declaration: string;
    readonly lead?: boolean;
  },
): Buffer | undefined {
  const sorted = [...rewrites].sort((a, b) => a.start - b.start);
  const parts: Uint8Array[] = [];
  let length = 0;
  let cursor = 0;
  let insertAt: number | undefined;
  const push = (part: Uint8Array): void => {
    parts.push(part);
    length += part.length;
  };
  const place = (): void => {
    if (addition === undefined || insertAt !== undefined) return;
    push(pre.subarray(cursor, addition.offset));
    cursor = addition.offset;
    insertAt = length;
  };
  for (const rewrite of sorted) {
    if (addition !== undefined) {
      if (addition.offset > rewrite.start && addition.offset < rewrite.end) {
        return undefined;
      }
      if (addition.offset <= rewrite.start) place();
    }
    push(pre.subarray(cursor, rewrite.start));
    push(Buffer.from(rewrite.spelled(ident), "utf8"));
    cursor = rewrite.end;
  }
  place();
  push(pre.subarray(cursor));
  const base = Buffer.concat(parts);
  if (addition === undefined || insertAt === undefined) return base;
  const lead = addition.lead ?? !atLineStart(base, insertAt);
  const terminator = lead ? "\n" : "";
  return Buffer.concat([
    base.subarray(0, insertAt),
    Buffer.from(`${terminator}${addition.declaration}\n`, "utf8"),
    base.subarray(insertAt),
  ]);
}

/** A placeholder identifier the premise check composes with. */
const S23_PLACEHOLDER = "X";

/**
 * Why `bytes` are no well-formed text of the receiver's kind — `undefined`
 * when they are: a TypeScript source is text TypeScript 5.9.3 accepts both
 * as module code and as script code, a spec source text the stock MDX 3
 * grammar derives (14.20; S-9's judges).
 */
function s23Malformed(arm: S23Arm, bytes: Uint8Array): string | undefined {
  if (arm.kind === "spec-source") {
    const verdict = deriveMdx(bytes);
    return verdict.derives
      ? undefined
      : `not text the stock MDX 3 grammar derives (14.20; S-9): ` +
          JSON.stringify(verdict);
  }
  const verdict = judgeTypeScript(bytes, arm.receiver);
  return verdict.verdict === "well-formed"
    ? undefined
    : `not text TypeScript 5.9.3 accepts both as module code and as script ` +
        `code (14.20; S-9): ${JSON.stringify(verdict)}`;
}

/**
 * The staging's premises, judged before any product is driven on it (a
 * harness defect otherwise, never a product verdict): the staged text, each
 * admissible offset's composed form — the placeholder in `<X>`'s place — or,
 * where nothing is added, the form the rewrite alone composes, and each form
 * TEST-SPEC states derives at an inadmissible offset are well-formed text of
 * the receiver's kind (14.20; S-9's judges), and the admissible offsets
 * compose pairwise distinct bytes, so the product's bytes name the one it
 * used.
 */
function s23AssertPremises(arm: S23Arm): void {
  const pre = Buffer.from(arm.text, "utf8");
  const forms: { readonly what: string; readonly bytes: Uint8Array }[] = [
    { what: "the staged text", bytes: pre },
  ];
  const addition = arm.addition;
  if (addition === undefined) {
    if (arm.deriving !== undefined) {
      throw new Error(
        `T6.5-23 ${arm.key}: a harness defect — a staging gaining no ` +
          `declaration names no offset of one`,
      );
    }
    forms.push({
      what: "the form the rewrite alone composes",
      bytes: s23Compose(pre, arm.rewrites, S23_PLACEHOLDER) ?? pre,
    });
  } else {
    for (const ident of [S23_PLACEHOLDER, ...(addition.spelled?.also ?? [])]) {
      const named =
        ident === S23_PLACEHOLDER ? "" : ` with the identifier \`${ident}\``;
      const admissible: Buffer[] = [];
      for (const [offset, judged] of [
        ...addition.offsets.map((offset) => [offset, "admissible"] as const),
        ...(arm.deriving ?? []).map((offset) => [offset, "deriving"] as const),
      ]) {
        const composed = s23Compose(pre, arm.rewrites, ident, {
          offset,
          declaration: s23Added(addition, ident),
        });
        if (composed === undefined) {
          throw new Error(
            `T6.5-23 ${arm.key}: a harness defect — the ${judged} offset ` +
              `${String(offset)} lies inside a replaced span`,
          );
        }
        if (judged === "admissible") admissible.push(composed);
        forms.push({
          what:
            `the form composed at ${judged === "admissible" ? "the admissible" : "the inadmissible, deriving"} ` +
            `offset ${String(offset)}${named}`,
          bytes: composed,
        });
      }
      const distinct = new Set(admissible.map((form) => form.toString("hex")));
      if (distinct.size !== addition.offsets.length) {
        throw new Error(
          `T6.5-23 ${arm.key}: a harness defect — two admissible offsets ` +
            `compose the same bytes${named}, so the bytes cannot name the ` +
            `offset used`,
        );
      }
    }
  }
  for (const form of forms) {
    const malformed = s23Malformed(arm, form.bytes);
    if (malformed !== undefined) {
      throw new Error(
        `T6.5-23 ${arm.key}: a harness defect — ${form.what} is ` +
          `${malformed}; the text reads ` +
          JSON.stringify(Buffer.from(form.bytes).toString("utf8")),
      );
    }
  }
}

/** The receiving file's text after the move, failing diagnosed unless it is
 * a plain file of valid UTF-8 (SPEC 6.5 rewrites it in place; 1.6). */
async function s23ReadReceiver(
  workspace: TestWorkspace,
  arm: S23Arm,
  context: string,
): Promise<{ readonly bytes: Uint8Array; readonly text: string }> {
  const kind = await workspace.kind(arm.receiver);
  if (kind !== "file") {
    fail(
      `${context}: after the move, ${arm.receiver} must still be a plain ` +
        `file — the move rewrites it in place (SPEC 6.5); found ${kind}`,
    );
  }
  const bytes = await workspace.readBytes(arm.receiver);
  try {
    const text = new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: true,
    }).decode(bytes);
    return { bytes, text };
  } catch {
    fail(
      `${context}: after the move, ${arm.receiver} is not valid UTF-8 — ` +
        `6.5 keeps every file a move rewrites well-formed (SPEC 1.6, 14.20)`,
    );
  }
}

/** The preview's entry for the receiver, taken before the real move (SPEC
 * 6.6: a preview modifies nothing). */
async function s23PreviewEntry(
  product: ProductBinding,
  workspace: TestWorkspace,
  arm: S23Arm,
  context: string,
): Promise<PreviewFileEntry> {
  const label = `${context}: \`${arm.argv.join(" ")} --preview --json\` before the real move`;
  const report = decodePreviewReport(
    await runJson(
      product,
      workspace,
      [...arm.argv, "--preview", "--json"],
      `${label} — a performable move previews with exit 0 (SPEC 6.6, 6.5)`,
    ),
    label,
  );
  if (report.files === null) {
    fail(
      `${label}: a preview exiting 0 succeeds as the real operation would ` +
        `and reports its \`files\` — \`null\` is a refused preview's form ` +
        `(SPEC 6.6, 12.7); findings: ${JSON.stringify(report.findings)}`,
    );
  }
  const entries = report.files.filter(
    (candidate) => candidate.file === arm.receiver,
  );
  const entry = entries.length === 1 ? entries[0] : undefined;
  if (entry === undefined) {
    fail(
      `${label}: \`files\` holds exactly one entry for ${arm.receiver}, a ` +
        `file the operation rewrites (SPEC 6.6, 12.7); got ` +
        `[${report.files.map((candidate) => JSON.stringify(candidate.file)).join(", ")}]`,
    );
  }
  return entry;
}

/** The 1-based line and column of byte `offset` in `bytes` (lines by 3's
 * terminators), for diagnoses. */
function s23Where(bytes: Uint8Array, offset: number): string {
  let line = 1;
  let start = 0;
  for (let i = 0; i < offset; i += 1) {
    const byte = bytes[i];
    if (byte === 0x0a || (byte === 0x0d && bytes[i + 1] !== 0x0a)) {
      line += 1;
      start = i + 1;
    }
  }
  return `offset ${String(offset)} (line ${String(line)}, byte column ${String(offset - start + 1)})`;
}

/**
 * Name the product's placement when its bytes read as the staged bytes
 * composed with the declaration inserted at offsets other than the
 * admissible ones (every offset of the file tried) — under 6.5's line
 * discipline, else as a line of its own with or without a U+000A before it
 * against that discipline — each with the reason TEST-SPEC gives where it
 * names one.
 */
function s23Misplacement(
  arm: S23Arm,
  addition: S23Addition,
  pre: Uint8Array,
  actual: Uint8Array,
  ident: string,
): string {
  const found: string[] = [];
  for (let offset = 0; offset <= pre.length; offset += 1) {
    for (const lead of [undefined, true, false]) {
      const composed = s23Compose(pre, arm.rewrites, ident, {
        offset,
        declaration: s23Added(addition, ident),
        lead,
      });
      if (composed === undefined || Buffer.compare(composed, actual) !== 0) {
        continue;
      }
      const why = arm.excluded[offset];
      found.push(
        s23Where(pre, offset) +
          (lead === undefined
            ? ""
            : ` with${lead ? "" : "out"} a U+000A before it, against ` +
              `6.5's line discipline (the offset is ` +
              `${atLineStart(pre, offset) ? "" : "not "}at a line's start)`) +
          (why === undefined ? "" : ` — ${why}`),
      );
      break;
    }
  }
  return found.length === 0
    ? "the bytes read as no single insertion of the declaration under 6.5's " +
        "line discipline beside the rewrite's edits, at any offset"
    : `the bytes read as the declaration inserted at ${found.join("; or at ")}`;
}

/** The rewrite's edits in words, given the added binding's identifier, for
 * diagnoses. */
function s23Rewritten(
  pre: Uint8Array,
  rewrites: readonly S23Rewrite[],
  ident: string,
): string {
  return rewrites
    .map((rewrite) => {
      const spelled = rewrite.spelled(ident);
      const replaced = Buffer.from(
        pre.subarray(rewrite.start, rewrite.end),
      ).toString("utf8");
      if (rewrite.start === rewrite.end) {
        return (
          `${JSON.stringify(spelled)} inserted at offset ` +
          String(rewrite.start)
        );
      }
      return spelled === ""
        ? `${JSON.stringify(replaced)} removed, ` +
            `[${String(rewrite.start)}, ${String(rewrite.end)})`
        : `\`${replaced}\` rewritten in place to \`${spelled}\``;
    })
    .join(", ");
}

/** The receiver's text after the move, as read. */
interface S23After {
  readonly bytes: Uint8Array;
  readonly text: string;
}

/**
 * The receiver gains exactly one declaration, of `addition`'s module and
 * binding its default, value-blind in the identifier alone, at an
 * admissible offset: the admissible offsets whose composed bytes the
 * product's equal (pairwise distinct per staging, so one), failing diagnosed
 * where none does.
 */
function s23AssertAddition(
  arm: S23Arm,
  addition: S23Addition,
  pre: Uint8Array,
  after: S23After,
  added: readonly AddedImportDeclaration[],
  context: string,
): readonly number[] {
  const ident =
    added.length === 1 &&
    added[0]?.specifier === addition.specifier &&
    added[0].identifiers.length === 1
      ? added[0].identifiers[0]
      : undefined;
  if (ident === undefined) {
    fail(
      `${context}: the move adds exactly one import declaration to ` +
        `${arm.receiver}, of one binding — ${s23Form(addition)} (SPEC ` +
        `6.5: ${addition.why}); the declarations added: ` +
        JSON.stringify(added.map((declaration) => declaration.text)) +
        `; the file reads ${JSON.stringify(after.text)}`,
    );
  }
  const declaration = s23Added(addition, ident);
  const readings = addition.offsets.filter((offset) => {
    const composed = s23Compose(pre, arm.rewrites, ident, {
      offset,
      declaration,
    });
    return (
      composed !== undefined && Buffer.compare(composed, after.bytes) === 0
    );
  });
  if (readings.length === 0) {
    fail(
      `${context}: ${arm.receiver} after the move is exactly the staged ` +
        `bytes with ${s23Rewritten(pre, arm.rewrites, ident)} and ` +
        `${JSON.stringify(declaration)} inserted under 6.5's line ` +
        `discipline (U+000A after it, one before it where the offset is ` +
        `not at a line's start) at ` +
        addition.offsets.map((offset) => s23Where(pre, offset)).join(" or ") +
        ` — ${arm.placement} (SPEC 6.5, 1.4, 3, 6.4; T6.5-8's ` +
        `discipline, value-blind in the identifier alone); ` +
        `${s23Misplacement(arm, addition, pre, after.bytes, ident)}; the ` +
        `file reads ${JSON.stringify(after.text)}`,
    );
  }
  return readings;
}

/**
 * The receiver gains no declaration — T6.5-22(a)'s judgement reads none —
 * and is exactly the staged bytes with the rewrite's edits alone, byte-
 * composable exactly, failing diagnosed otherwise.
 */
function s23AssertNothingAdded(
  arm: S23Arm,
  pre: Uint8Array,
  after: S23After,
  added: readonly AddedImportDeclaration[],
  context: string,
): void {
  if (added.length > 0) {
    fail(
      `${context}: the move adds no import declaration to ${arm.receiver} ` +
        `— ${arm.placement} (SPEC 6.5); the declarations added: ` +
        JSON.stringify(added.map((declaration) => declaration.text)) +
        `; the file reads ${JSON.stringify(after.text)}`,
    );
  }
  const expected = s23Compose(pre, arm.rewrites, "") ?? Buffer.from(pre);
  if (Buffer.compare(expected, after.bytes) !== 0) {
    fail(
      `${context}: ${arm.receiver} after the move is exactly the staged ` +
        `bytes with ${s23Rewritten(pre, arm.rewrites, "")} and no other ` +
        `byte changed — ${arm.placement} (SPEC 6.5, 6.4; byte-composable ` +
        `exactly); expected ${JSON.stringify(expected.toString("utf8"))}, ` +
        `the file reads ${JSON.stringify(after.text)}`,
    );
  }
}

/** The spans of `edits`, in a canonical order, against `spans`. */
function s23SameSpans(
  edits: readonly PreviewEdit[],
  spans: readonly S23Span[],
): boolean {
  const key = (span: S23Span): string =>
    `${String(span.start)}:${String(span.end)}`;
  const got = edits.map((edit) => key(edit.range)).sort();
  const want = spans.map(key).sort();
  return (
    got.length === want.length &&
    got.every((value, index) => value === want[index])
  );
}

/** Spans in words, for diagnoses. */
function s23Spans(spans: readonly S23Span[]): string {
  return spans
    .map((span) => `[${String(span.start)}, ${String(span.end)})`)
    .join(", ");
}

/**
 * The preview's entry for the receiver against the real operation (SPEC
 * 6.6: a preview reports exactly the real operation's edits; T6.6-4(b)):
 * the `import-addition` parity, then whatever the arm's preview expectation
 * states.
 */
function s23AssertPreview(
  arm: S23Arm,
  pre: Uint8Array,
  entry: PreviewFileEntry,
  readings: readonly number[],
  context: string,
): void {
  const label = `${context}: the preview's entry for ${arm.receiver}`;
  const of = (cls: PreviewEditClass): readonly PreviewEdit[] =>
    entry.edits.filter((edit) => edit.class === cls);
  const additions = of("import-addition");
  if (arm.addition !== undefined) {
    const addition = additions.length === 1 ? additions[0] : undefined;
    if (
      addition === undefined ||
      addition.range.start !== addition.range.end ||
      !readings.includes(addition.range.start)
    ) {
      fail(
        `${label} reports exactly one \`import-addition\`, zero-length at ` +
          `the offset the real operation then used — ` +
          readings.map((offset) => s23Where(pre, offset)).join(" or ") +
          `, where the bytes above stand (SPEC 6.6, 6.5: the offset is ` +
          `exactly the one the preview reports; T6.6-4(b)); the preview's ` +
          `edits: ${JSON.stringify(entry.edits)}`,
      );
    }
  } else if (additions.length > 0) {
    fail(
      `${label} reports no \`import-addition\` — the real operation adds ` +
        `no declaration to it (SPEC 6.6, 6.5; T6.6-4(b)); the preview's ` +
        `edits: ${JSON.stringify(entry.edits)}`,
    );
  }
  const wanted = arm.preview?.rewrites;
  if (wanted !== undefined) {
    const rewrites = of("reference-rewrite");
    const holds =
      typeof wanted === "number"
        ? rewrites.length === wanted
        : s23SameSpans(rewrites, wanted);
    if (!holds) {
      fail(
        `${label} reports ` +
          (typeof wanted === "number"
            ? `exactly ${String(wanted)} \`reference-rewrite\` ` +
              `edit${wanted === 1 ? "" : "s"}`
            : `exactly the \`reference-rewrite\` edits spanning ` +
              s23Spans(wanted)) +
          ` (SPEC 6.6, 6.5, 12.7: the real operation's rewrites); the ` +
          `preview's edits: ${JSON.stringify(entry.edits)}`,
      );
    }
  }
  const removals = arm.preview?.removals;
  if (removals !== undefined && !s23SameSpans(of("import-removal"), removals)) {
    fail(
      `${label} reports ` +
        (removals.length === 0
          ? "no `import-removal`"
          : `exactly the \`import-removal\` edits spanning ${s23Spans(removals)}`) +
        ` (SPEC 6.6, 6.5, 12.7: the real operation's removals); the ` +
        `preview's edits: ${JSON.stringify(entry.edits)}`,
    );
  }
}

/** `query edges` after the move answers exactly the arm's edge between its
 * two graph nodes, of its kind (SPEC 11.1, 5.2, 4.6). */
async function s23AssertEdge(
  product: ProductBinding,
  workspace: TestWorkspace,
  edge: S23Edge,
  context: string,
): Promise<void> {
  const argv = [
    "query",
    "edges",
    "--from",
    edge.from,
    "--to",
    edge.to,
    "--kinds",
    edge.kind,
  ];
  const label = `${context}: \`${argv.join(" ")}\` after the move`;
  assertEdgeSetEqual(
    decodeEdgesReport(
      await runJson(
        product,
        workspace,
        argv,
        `${label} — a valid workspace answers with exit 0 (SPEC 11.1, 13.3)`,
      ),
      label,
    ),
    [{ from: edge.from, to: edge.to, kind: edge.kind }],
    `${label}: exactly ${edge.what}'s \`${edge.kind}\` edge from ` +
      `${edge.from} to ${edge.to} (SPEC 6.5, 5.2, 4.6, 11.1)`,
  );
}

/** One staging in its own fresh workspace (see the notes). */
async function runS23Arm(product: ProductBinding, arm: S23Arm): Promise<void> {
  const context = `T6.5-23 ${arm.key}`;
  const moveLabel = arm.argv.join(" ");
  s23AssertPremises(arm);
  const workspace = await TestWorkspace.create({
    files: { ...arm.files, [arm.receiver]: arm.staged },
  });
  try {
    await expectFindingFreeReport(
      product,
      workspace,
      ["build", "--json"],
      `${context}: premise \`build --json\` over the staging — clean: a ` +
        `valid workspace, so a later failure is the move's (SPEC 12.1, 6.5)`,
    );
    if (arm.compiles !== undefined) {
      assertNoCompileErrors(
        await ConsumerProject.load({
          rootDir: workspace.root,
          rootFiles: [arm.receiver],
        }),
        `${context}: ${arm.receiver} compiles clean under standard tooling ` +
          `before the move (H-2) — ${arm.compiles}`,
      );
    }
    const preview =
      arm.addition !== undefined || arm.preview !== undefined
        ? await s23PreviewEntry(product, workspace, arm, context)
        : undefined;
    decodeAppliedMappingReport(
      await runJson(
        product,
        workspace,
        [...arm.argv, "--json"],
        `${context}: \`${moveLabel} --json\` — a valid move` +
          (arm.addition === undefined
            ? ""
            : " whose receiver holds an admissible offset") +
          ` is performed: exit 0 (SPEC 6.5, 12.0)`,
      ),
      `${context}: \`${moveLabel} --json\` — the form-exact 12.7 ` +
        `performed-operation document (SPEC 6.5, 12.7)`,
    );

    const pre = Buffer.from(arm.text, "utf8");
    const after = await s23ReadReceiver(workspace, arm, context);
    const malformed = s23Malformed(arm, after.bytes);
    if (malformed !== undefined) {
      fail(
        `${context}: ${arm.receiver} after the move is well-formed — 6.5 ` +
          `keeps every file a move rewrites well-formed (SPEC 14.20) — yet ` +
          `it is ${malformed}; the file reads ${JSON.stringify(after.text)}`,
      );
    }
    const judgement = judgeAddedImportsOfFile(
      arm.receiver,
      arm.kind,
      arm.text,
      after.text,
    );
    if (judgement.problems.length > 0) {
      fail(
        `${context}: T6.5-22(a)'s constraints on the added identifiers ` +
          `(SPEC 6.5), read from the added bytes:\n` +
          judgement.problems.map((problem) => `  - ${problem}`).join("\n"),
      );
    }
    let readings: readonly number[] = [];
    if (arm.addition === undefined) {
      s23AssertNothingAdded(arm, pre, after, judgement.added, context);
    } else {
      readings = s23AssertAddition(
        arm,
        arm.addition,
        pre,
        after,
        judgement.added,
        context,
      );
    }
    if (preview !== undefined) {
      s23AssertPreview(arm, pre, preview, readings, context);
    }
    for (const edge of arm.edges ?? []) {
      await s23AssertEdge(product, workspace, edge, context);
    }

    await expectFindingFreeReport(
      product,
      workspace,
      ["check", "--json"],
      `${context}: \`check --json\` after the move — clean (SPEC 6.5, 6.4, ` +
        `12.2, 14.10)`,
    );
    await expectFindingFreeReport(
      product,
      workspace,
      ["build", "--json"],
      `${context}: \`build --json\` after the move — clean: the rewritten ` +
        `workspace is valid (SPEC 6.5, 12.1)`,
    );
    if (arm.compiles !== undefined) {
      // A fresh project: the language service snapshots files on first
      // access, and the move rewrote them.
      assertNoCompileErrors(
        await ConsumerProject.load({
          rootDir: workspace.root,
          rootFiles: [arm.receiver],
        }),
        `${context}: ${arm.receiver} compiles clean under standard tooling ` +
          `after the move (H-2) — ${arm.compiles}; the file reads ` +
          `${JSON.stringify(after.text)}`,
      );
    }
  } finally {
    await workspace.dispose();
  }
}

/** A staged `src/c.ts` (S-9's record, declared well-formed TypeScript). */
function s23StagedApp(key: string, text: string): StagedTs {
  return stagedTs(`T6.5-23 ${key} ${S23_APP}`, text, "well-formed", "ts");
}

/** Why each staging of (a) through (e) gains its declaration (SPEC 6.5). */
const S23_O_WHY =
  "one declaration per module whose bindings the rewritten spellings are " +
  "rooted at and the file lacks; `O` keeps its use by `O.w`";

/** An arm of (a) through (e) at module load: its `src/c.ts` record, the
 * common staging, the arms' move, the marker's rewrite to `<X>.y`, and the
 * target module's declaration at one of `offsets`. */
function s23Arm(spec: {
  readonly key: string;
  readonly text: string;
  readonly extra?: Readonly<Record<string, InitialFileContents>>;
  readonly offsets: readonly number[];
  readonly placement: string;
  readonly excluded: Readonly<Record<number, string>>;
  readonly deriving?: readonly number[];
  readonly preview?: S23PreviewExpectation;
  readonly compiles?: string;
}): S23Arm {
  return {
    key: spec.key,
    receiver: S23_APP,
    kind: "typescript",
    text: spec.text,
    staged: s23StagedApp(spec.key, spec.text),
    files: {
      "xspec.config.ts": S23_CONFIG,
      [S23_ORIGIN]: S23_ORIGIN_SOURCE,
      [S23_TARGET]: S23_TARGET_SOURCE,
      ...spec.extra,
    },
    argv: S23_ARGV,
    rewrites: [s23Marker(spec.text, spec.key)],
    addition: {
      specifier: S23_TARGET_SPECIFIER,
      offsets: spec.offsets,
      why: S23_O_WHY,
    },
    placement: spec.placement,
    excluded: spec.excluded,
    ...(spec.deriving === undefined ? {} : { deriving: spec.deriving }),
    ...(spec.preview === undefined ? {} : { preview: spec.preview }),
    ...(spec.compiles === undefined ? {} : { compiles: spec.compiles }),
  };
}

/** Why the file's end is excluded in every staging below. */
const S23_UNTIMELY_END =
  "the file's end — untimely, the statement `f` standing between it and " +
  "`O`'s declaration (6.5: an added binding is declared at or before the " +
  "binding the spelling was rooted at, or after it with only import " +
  "declarations between)";

/** Why offset 0 is excluded in every staging below. */
const S23_NO_STATEMENT_BEFORE =
  "offset 0 — no statement's end precedes it (6.5)";

/** Why a mid-line admissible offset loses to a line-start one. */
function s23MidLine(where: string): string {
  return (
    `${where} — admissible, but mid-line, while the staging holds a ` +
    `line-start admissible offset, taken over any other (6.5's preference)`
  );
}

// (a) the directive prologue.
const S23_A_PROLOGUE = s23Arm({
  key: "(a)",
  text: ['"use client"', S23_IMPORT_O, S23_F, ""].join("\n"),
  offsets: [13, 51],
  placement:
    "the start of line 2 or of line 3, the line starts after the " +
    "prologue's statement and after `O`'s, both timely (6.5's latitude " +
    "between them), never offset 0, which would end the prologue",
  excluded: {
    0:
      "offset 0 — a declaration there would end the directive prologue, " +
      "and no statement's end precedes it (6.5)",
    12: s23MidLine('the end of `"use client"`'),
    50: s23MidLine("the end of `O`'s declaration"),
    84: S23_UNTIMELY_END,
  },
});

// (a) a line start between two directives: the prologue condition alone
// decides it.
const S23_A_BETWEEN = s23Arm({
  key: "(a) between two directives",
  text: [
    '"use client"',
    `"use strict"; ${S23_IMPORT_O} // note`,
    S23_F,
    "",
  ].join("\n"),
  offsets: [26, 27, 64, 65],
  placement:
    "no line start being admissible — the start of line 2 lies before the " +
    'prologue\'s end (26, `"use strict";` being [13, 26)), the start of ' +
    "line 3 follows a comment, and the file's end is untimely — the " +
    "prologue's end, after the space following it, `O`'s declaration's " +
    "end, or after the space before `//` (6.5's latitude among them), both " +
    "directives staying directives",
  excluded: {
    0: S23_NO_STATEMENT_BEFORE,
    12:
      'the end of `"use client"` — before the prologue\'s end, 26 (6.5: at ' +
      "or after the end of the directive prologue)",
    13:
      'the start of line 2 — it follows `"use client"`\'s end and is ' +
      "timely but lies before the prologue's end, 26: a product lacking the " +
      "prologue condition takes it under the line-start preference and " +
      'leaves `"use strict"` an ordinary statement after the added line ' +
      "(6.5)",
    73:
      "the start of line 3 — it follows the comment `// note`, no " +
      "statement's end with whitespace alone between (6.5)",
    106: S23_UNTIMELY_END,
  },
});

// (b) file-top directives in the prologue's place.
function s23FileTop(directive: string, key: string): S23Arm {
  const text = [directive, S23_IMPORT_O, S23_F, ""].join("\n");
  const line2 = Buffer.byteLength(directive, "utf8") + 1;
  const line3 = line2 + Buffer.byteLength(S23_IMPORT_O, "utf8") + 1;
  return s23Arm({
    key,
    text,
    offsets: [line3],
    placement:
      "the start of line 3, directly after `O`'s declaration — no " +
      "statement precedes the start of line 2, so the added line never " +
      "stands above the directive",
    excluded: {
      0: `offset 0 — above the directive, no statement's end preceding it (6.5)`,
      [line2]:
        `the start of line 2 — it follows the comment \`${directive}\` ` +
        `alone, no statement's end (6.5)`,
      [line3 - 1]: s23MidLine("the end of `O`'s declaration"),
      [Buffer.byteLength(text, "utf8")]: S23_UNTIMELY_END,
    },
  });
}

const S23_B_NOCHECK = s23FileTop(
  "// @ts-nocheck",
  "(b) under `// @ts-nocheck`",
);
const S23_B_REFERENCE = s23FileTop(
  '/// <reference lib="esnext" />',
  '(b) under `/// <reference lib="esnext" />`',
);

// (c) a comment governing a statement.
const S23_C_GOVERNED = s23Arm({
  key: "(c)",
  text: [
    S23_IMPORT_O,
    "// @ts-expect-error",
    'const n: number = "x"',
    S23_F,
    "",
  ].join("\n"),
  offsets: [38],
  placement:
    "the start of line 2, before the comment, never between it and the " +
    "statement it governs (6.5: the added line parts no comment from the " +
    "statement it precedes); the start of line 4 and every later offset " +
    "are untimely",
  excluded: {
    0: S23_NO_STATEMENT_BEFORE,
    37: s23MidLine("the end of `O`'s declaration"),
    58:
      "the start of line 3 — between the `// @ts-expect-error` comment and " +
      "the statement it governs: the directive would then govern the " +
      "import and leave the type error bare (6.5)",
    80:
      "the start of line 4 — untimely, the statement `const n: number = " +
      '"x"` standing between it and `O`\'s declaration (6.5)',
    113: S23_UNTIMELY_END,
  },
  compiles:
    "the `// @ts-expect-error` directive governs `const n: number = " +
    '"x"`, the file\'s one type error (6.5: the added line parts no ' +
    "comment from the statement it precedes)",
});

// (d) a trailing comment: the forced mid-line placement in a TypeScript
// source.
const S23_D_COMMENT = s23Arm({
  key: "(d)",
  text: [`${S23_IMPORT_O} // note`, S23_F, ""].join("\n"),
  offsets: [37, 38],
  placement:
    "no line start qualifying — the start of line 2 follows the comment " +
    "and every later one is untimely — the declaration's end or after the " +
    "space before `//`, both mid-line (6.5's latitude between them; " +
    "T6.5-13(c)'s forced mid-line placement met in a TypeScript source)",
  excluded: {
    0: S23_NO_STATEMENT_BEFORE,
    46:
      "the start of line 2 — it follows the comment `// note`, no " +
      "statement's end with whitespace alone between (6.5)",
    79: S23_UNTIMELY_END,
  },
});

// (d) the same forced placement where a character no whitespace under 1.4,
// though ECMAScript's lexical grammar takes it for whitespace or a line
// terminator, follows the declaration.
const S23_D_NBSP = s23Arm({
  key: "(d) with U+00A0",
  text: `${S23_IMPORT_O}${S23_NBSP}\n${S23_F}\n`,
  offsets: [37],
  placement:
    "the declaration's end, 37, the only admissible offset — U+00A0 " +
    "[37, 39), no whitespace under 1.4, stands between that end and both " +
    "the offset after it (39) and the start of line 2 (40); offset 0 " +
    "follows no statement's end, every offset inside a statement is " +
    "excluded, and those after `f` are untimely — U+00A0 then leading the " +
    "line after the added one (6.5's statement-end condition reads " +
    "whitespace as 1.4 defines it)",
  excluded: {
    0: S23_NO_STATEMENT_BEFORE,
    39:
      "offset 39 — U+00A0, no whitespace under 1.4, stands between the " +
      "declaration's end and it (6.5)",
    40:
      "the start of line 2 — U+00A0, no whitespace under 1.4, stands " +
      "between the declaration's end and it: a product judging the " +
      "statement-end condition with ECMAScript's whitespace (TypeScript's " +
      "own trivia) takes it under the line-start preference (6.5, 1.4)",
    73: S23_UNTIMELY_END,
  },
});

const S23_D_LSEP = s23Arm({
  key: "(d) with U+2028",
  text: `${S23_IMPORT_O}${S23_LSEP}${S23_F}\n`,
  offsets: [37],
  placement:
    "the declaration's end, 37, the only admissible offset — U+2028 " +
    "[37, 40), no whitespace under 1.4 and no line terminator under 3, " +
    "stands between that end and the offset after it (40), no line start " +
    "either; offset 0 follows no statement's end, every offset inside a " +
    "statement is excluded, and those after `f` are untimely — U+2028 " +
    "then leading the line after the added one",
  excluded: {
    0: S23_NO_STATEMENT_BEFORE,
    40:
      "offset 40 — U+2028, no whitespace under 1.4, stands between the " +
      "declaration's end and it, and it is no line start, U+2028 being no " +
      "line terminator (3): a product taking U+2028 for a line terminator " +
      "takes it for one under the line-start preference (6.5, 1.4, 3)",
    73: S23_UNTIMELY_END,
  },
});

// (e) statement splitting: the `;` terminating `O`'s declaration across a
// line, the declaration spanning [0, 39).
const S23_E_SEMICOLON = s23Arm({
  key: "(e)",
  text: [S23_IMPORT_O, ";", S23_F, ""].join("\n"),
  offsets: [40],
  placement:
    "the start of line 3, never the start of line 2, inside `O`'s " +
    "declaration, which the `;` on line 2 terminates (6.5: the added line " +
    "splits no statement)",
  excluded: {
    0: S23_NO_STATEMENT_BEFORE,
    37:
      "offset 37 — inside `O`'s declaration, which the `;` on line 2 " +
      "terminates (6.5: the added line splits no statement)",
    38:
      "the start of line 2 — inside `O`'s declaration, which the `;` on " +
      "that line terminates (6.5: the added line splits no statement)",
    39: s23MidLine("the end of `O`'s declaration"),
    73: S23_UNTIMELY_END,
  },
});

// (e) 6.5's own shape: its in-statement line start is the one line start a
// product judging statement ends over the composed text would find.
const S23_E_SHAPE = s23Arm({
  key: "(e) 6.5's own shape",
  text: [
    'import C, { text as textC } from "../specs/c.xspec" // c1',
    "const s = textC",
    "(C.c) // c3",
    `${S23_IMPORT_O} // c4`,
    S23_F,
    "",
  ].join("\n"),
  extra: { [S23_C_SPEC]: S23_C_SOURCE },
  offsets: [51, 52, 79, 80, 123, 124],
  placement:
    "every admissible offset mid-line — at, or after the space following, " +
    "the end of line 1's declaration, of the call statement on line 3, or " +
    "of `O`'s declaration, each before its comment (6.5's latitude among " +
    "the six) — never at the start of line 3, where automatic semicolon " +
    "insertion would part the statement",
  excluded: {
    0: S23_NO_STATEMENT_BEFORE,
    58:
      "the start of line 2 — it follows the comment `// c1`, no " +
      "statement's end with whitespace alone between (6.5)",
    74:
      "the start of line 3 — inside the statement `const s = textC` " +
      "`(C.c)`, one call of `textC` across lines 2 and 3, which automatic " +
      "semicolon insertion would let the added line part, leaving `s` the " +
      "function `textC` itself and `(C.c)` a non-static bare reference " +
      "(6.5, 14.8)",
    86:
      "the start of line 4 — it follows the comment `// c3`, no " +
      "statement's end with whitespace alone between (6.5)",
    130:
      "the start of line 5 — it follows the comment `// c4`, no " +
      "statement's end with whitespace alone between (6.5)",
    163: S23_UNTIMELY_END,
  },
});

// (f) timeliness: TEST-SPEC's `move specs/A.mdx#m specs/B.mdx#m`, over
// `specs/A.mdx` holding `m` and `k` and `specs/B.mdx` holding `b` and no `m`,
// as throughout (f).
const S23_F_ARGV = ["move", "specs/A.mdx#m", "specs/B.mdx#m"] as const;
/** `B`'s module's canonical relative specifier from `src/` (6.5). */
const S23_F_SPECIFIER = "../specs/B.xspec";

const S23_F_A_SOURCE: StagedMdx = stagedMdx(
  "T6.5-23 (f) specs/A.mdx (the moved m, the kept k)",
  [
    '<S id="m">',
    "M text.",
    "</S>",
    "",
    '<S id="k">',
    "K text.",
    "</S>",
    "",
  ].join("\n"),
);

const S23_F_B_SOURCE: StagedMdx = stagedMdx(
  "T6.5-23 (f) specs/B.mdx (b, no m)",
  ['<S id="b">', "B text.", "</S>", ""].join("\n"),
);

/** `A`'s declaration, at [0, 32) where it heads the file. */
const S23_IMPORT_A = 'import A from "../specs/A.xspec"';
/** `B`'s declaration. */
const S23_IMPORT_B = 'import B from "../specs/B.xspec"';

/** The moved marker's edge after the move: from `src/c.ts` — a top-level
 * statement's reference is attributed to the file (4.6) — to the moved
 * node's new identity. */
const S23_F_EDGE: S23Edge = {
  from: S23_APP,
  to: "specs/B.mdx#m",
  kind: "references",
  what: "the moved marker",
};

/** Why an offset after `A.m` is excluded in (f): untimely. */
function s23FUntimely(where: string, between: string): string {
  return (
    `${where} — untimely, ${between} standing between it and \`A\`'s ` +
    `declaration (6.5: an added binding is declared at or before the ` +
    `binding the spelling was rooted at, or after it with no top-level ` +
    `statement between but import declarations)`
  );
}

/** A staging of (f) at module load: the marker `A.m` rewritten in place to
 * `<X>.m` where `B`'s module gains a declaration, re-rooted to `B.m`
 * where it gains none. */
function s23FArm(spec: {
  readonly key: string;
  readonly lines: readonly string[];
  readonly addition?: {
    readonly offsets: readonly number[];
    readonly why: string;
  };
  readonly placement: string;
  readonly excluded?: Readonly<Record<number, string>>;
  readonly preview?: S23PreviewExpectation;
  readonly edges?: readonly S23Edge[];
}): S23Arm {
  const text = [...spec.lines, ""].join("\n");
  const addition = spec.addition;
  return {
    key: spec.key,
    receiver: S23_APP,
    kind: "typescript",
    text,
    staged: s23StagedApp(spec.key, text),
    files: {
      "xspec.config.ts": S23_CONFIG,
      "specs/A.mdx": S23_F_A_SOURCE,
      "specs/B.mdx": S23_F_B_SOURCE,
    },
    argv: S23_F_ARGV,
    rewrites: [
      addition === undefined
        ? s23Marker(text, spec.key, "A.m", () => "B.m")
        : s23Marker(text, spec.key, "A.m", (ident) => `${ident}.m`),
    ],
    addition:
      addition === undefined
        ? undefined
        : { specifier: S23_F_SPECIFIER, ...addition },
    placement: spec.placement,
    excluded: spec.excluded ?? {},
    ...(spec.preview === undefined ? {} : { preview: spec.preview }),
    ...(spec.edges === undefined ? {} : { edges: spec.edges }),
  };
}

// (f) 6.5's example: `B` is untimely for the moved marker.
const S23_F_EXAMPLE = s23FArm({
  key: "(f) 6.5's example",
  lines: [S23_IMPORT_A, "A.m", "A.k", S23_IMPORT_B, "B.b"],
  addition: {
    offsets: [33],
    why:
      "`B` is untimely for the moved marker — its declaration follows " +
      "`A`'s with the statement `A.m` between — so a second declaration " +
      "of `B`'s module is added, binding `<X>` distinct from `B`; a " +
      "product rooting at `B` writes `B.m`, which TypeScript's CommonJS " +
      "output reads before initializing `B`",
  },
  placement:
    "the start of line 2 (offset 33), the only line-start admissible " +
    "offset — the end of line 1, admissible too, is mid-line, and every " +
    "later line start is untimely — `A.k`, `import B …`, and `B.b` " +
    "unchanged",
  excluded: {
    0: S23_NO_STATEMENT_BEFORE,
    32: s23MidLine("the end of line 1, `A`'s declaration's end"),
    37: s23FUntimely("the start of line 3", "the statement `A.m`"),
    41: s23FUntimely("the start of line 4", "the statements `A.m` and `A.k`"),
    74: s23FUntimely("the start of line 5", "the statements `A.m` and `A.k`"),
    78: s23FUntimely(
      "the file's end",
      "the statements `A.m`, `A.k`, and `B.b`",
    ),
  },
  edges: [S23_F_EDGE],
});

// (f) its control: `B`'s declaration on line 2, before `A.m`.
const S23_F_CONTROL = s23FArm({
  key: "(f) control",
  lines: [S23_IMPORT_A, S23_IMPORT_B, "A.m", "A.k", "B.b"],
  placement:
    "`B` is timely — its declaration directly follows `A`'s (6.5: or " +
    "follows it with no top-level statement between them but import " +
    "declarations) — so the marker is re-rooted to `B.m` and nothing is " +
    "added",
});

/** The control with `line` interposed between `import A …` and `import B
 * …`, its lines and the byte offsets of its line starts after line 2. */
function s23FInterposed(line: string): {
  readonly lines: readonly string[];
  readonly starts: readonly number[];
} {
  const lines = [S23_IMPORT_A, line, S23_IMPORT_B, "A.m", "A.k", "B.b"];
  const starts: number[] = [];
  let offset = 0;
  for (const each of lines) {
    offset += Buffer.byteLength(each, "utf8") + 1;
    starts.push(offset);
  }
  return { lines, starts: starts.slice(1) };
}

// (f) the boundary of the import-declaration exemption: a top-level
// statement other than an import declaration interposed in the control.
function s23FBoundary(line: string, key: string, why: string): S23Arm {
  const { lines, starts } = s23FInterposed(line);
  const [line3, line4, line5, line6, end] = starts as [
    number,
    number,
    number,
    number,
    number,
  ];
  return s23FArm({
    key,
    lines,
    addition: { offsets: [33], why },
    placement:
      "the start of line 2 (offset 33), between `import A …` and the " +
      "interposed line — the one line-start admissible offset, the start " +
      "of line 3 and every later one untimely — the marker rewritten in " +
      "place to `<X>.m`, every other line unchanged",
    excluded: {
      0: S23_NO_STATEMENT_BEFORE,
      32: s23MidLine("the end of line 1, `A`'s declaration's end"),
      [line3]: s23FUntimely("the start of line 3", `\`${line}\``),
      [line4]: s23FUntimely("the start of line 4", `\`${line}\``),
      [line5]: s23FUntimely("the start of line 5", `\`${line}\` and \`A.m\``),
      [line6]: s23FUntimely(
        "the start of line 6",
        `\`${line}\`, \`A.m\`, and \`A.k\``,
      ),
      [end]: s23FUntimely(
        "the file's end",
        `\`${line}\`, \`A.m\`, \`A.k\`, and \`B.b\``,
      ),
    },
  });
}

const S23_F_TYPE_ALIAS = s23FBoundary(
  "type T = number",
  "(f) boundary: `type T = number`",
  "`type T = number` reads no `B` and emits no code, yet it is a top-level " +
    "statement other than an import declaration standing between the two " +
    "declarations, so `B` is untimely and a declaration of `B`'s module is " +
    "added, binding `<X>` distinct from `B`; a product exempting statements " +
    "that emit no code re-roots the marker at `B` and adds nothing",
);

const S23_F_IMPORT_EQUALS = s23FBoundary(
  'import Z = require("./z")',
  '(f) boundary: `import Z = require("./z")`',
  '`import Z = require("./z")`, a module-linking form other than an ' +
    "import declaration (4), reads no `B`, yet it is a top-level statement " +
    "other than an import declaration standing between the two " +
    "declarations, so `B` is untimely and a declaration of `B`'s module is " +
    "added, binding `<X>` distinct from `B`; a product exempting every " +
    "module-linking form re-roots the marker at `B` and adds nothing",
);

// (f) the exempt side: an import declaration interposed instead, binding no
// value and naming no spec module.
function s23FExempt(line: string, key: string, what: string): S23Arm {
  return s23FArm({
    key,
    lines: s23FInterposed(line).lines,
    placement:
      `\`${line}\`, ${what}, is an import declaration, so \`B\` stays ` +
      "timely (6.5: no top-level statement between the two declarations " +
      "but import declarations), the marker is re-rooted to `B.m`, and " +
      "nothing is added; a product exempting only spec module imports, or " +
      "only imports binding a value, adds a declaration of `B`'s module",
    preview: { rewrites: 1, removals: [] },
  });
}

const S23_F_TYPE_IMPORT = s23FExempt(
  'import type { T } from "./t"',
  '(f) exempt: `import type { T } from "./t"`',
  "a type-only import declaration binding no value and naming no spec module",
);

const S23_F_SIDE_EFFECT = s23FExempt(
  'import "./p"',
  '(f) exempt: `import "./p"`',
  "a side-effect import declaration binding nothing and naming no spec module",
);

// (f) the precedence branch at a distance: `B`'s declaration precedes
// `A`'s, the statement `B.b` between them; the marker `A.m` at [70, 73).
const S23_F_PRECEDENCE = s23FArm({
  key: "(f) the precedence branch at a distance",
  lines: [S23_IMPORT_B, "B.b", S23_IMPORT_A, "A.m", "A.k"],
  placement:
    "`B`'s declaration precedes `A`'s, so `B` is timely for the moved " +
    "marker (6.5: its declaration is or precedes that of the binding the " +
    "spelling was rooted at), though the statement `B.b` stands between " +
    "them — the precedence branch bounds no distance, the " +
    "import-declaration condition governing a later declaration alone — " +
    "so the marker is re-rooted to `B.m`, nothing is added, and `A`'s " +
    "declaration stays, kept by `A.k`; a product applying the succession " +
    "condition in both directions adds a declaration of `B`'s module and " +
    "writes `<X>.m`",
  preview: { rewrites: [{ start: 70, end: 73 }], removals: [] },
  edges: [S23_F_EDGE],
});

// (g) the spec-source side of the split rule: TEST-SPEC's target, its first
// two lines one declaration of one ESM block, receiving into `p.n`
// T6.5-13(h)'s moved text — T6.5-13's cross-file origin and third module —
// which needs `import <X> from "./x.xspec"`.
const S23_G_RECEIVER = "specs/target.mdx";
const S23_G_TEXT = [
  'import K from "./k.xspec"',
  ";",
  "",
  '<S id="p">',
  "x {text(K.a)}",
  "</S>",
  "",
].join("\n");
/** The start of the `</S>` line, where the moved text and a U+000A are
 * inserted (T6.5-13's composition). */
const S23_G_CLOSE = Buffer.from(S23_G_TEXT, "utf8").lastIndexOf("</S>");

const S23_G: S23Arm = {
  key: "(g)",
  receiver: S23_G_RECEIVER,
  kind: "spec-source",
  text: S23_G_TEXT,
  staged: stagedMdx(
    "T6.5-23 (g) specs/target.mdx (K's declaration across lines 1 and 2 of one ESM block, then p)",
    S23_G_TEXT,
  ),
  files: {
    "xspec.config.ts": R16_CONFIG,
    "specs/a.mdx": A13_ORIGIN_STAGED,
    "specs/x.mdx": A13_THIRD_STAGED,
    "specs/k.mdx": A13_THIRD_STAGED,
  },
  argv: ["move", "specs/a.mdx#m", `${S23_G_RECEIVER}#p.n`],
  rewrites: [
    {
      start: S23_G_CLOSE,
      end: S23_G_CLOSE,
      spelled: (ident) => [...a13MovedLines("p.n", ident), ""].join("\n"),
    },
  ],
  addition: {
    specifier: "./x.xspec",
    offsets: [0, 28, 59],
    why:
      "the moved text's `{text(X.a)}` embedding is rooted at the origin's " +
      "binding of `specs/x.mdx`, a module the target lacks — its `K` binds " +
      "`specs/k.mdx` — so exactly one declaration of it is added " +
      "(T6.5-13's shape)",
  },
  placement:
    "offset 0, the start of the empty line (28), or the file's end (59) — " +
    "the admissible line starts, 6.5's latitude among them — never the " +
    "start of line 2; the moved text inserted at the start of the `</S>` " +
    "line, its embedding re-rooted at `<X>`",
  excluded: {
    26:
      "the start of line 2 — its form derives (S-9) yet splits `K`'s " +
      'declaration, `import K from "./k.xspec"` and the `;` on line 2 one ' +
      "declaration of one ESM block (6.5: an admissible offset lies inside " +
      "none of the file's statements before the edit — in a spec source, " +
      "its ESM blocks' declarations)",
  },
  deriving: [26],
};

// (h) through (j): a removed declaration's place. `f` holds the marker alone,
// so `O`'s declaration loses its last use and is removed with its line (6.5's
// import edits) while the receiver gains the target module's declaration —
// at the removal's end, the statement-end condition and the prologue judged
// over the file before the edit, the removed declaration included.

/** `f` in (h) through (j): the marker alone, the origin import losing its
 * last use. */
const S23_F_LAST_USE = "export function f() { O.x }";

/** Why each staging of (h) through (j) gains its declaration (SPEC 6.5). */
const S23_REMOVED_WHY =
  "one declaration per module whose bindings the rewritten spellings are " +
  "rooted at and the file lacks; `O`'s declaration, its last use gone, is " +
  "removed with its line, the added line taking its place";

/** The marker's edge after (h)'s move: from `f`, the unit holding it (4.6),
 * to the moved node's new identity. */
const S23_H_EDGE: S23Edge = {
  from: `${S23_APP}#f`,
  to: "specs/target.mdx#y",
  kind: "references",
  what: "the moved marker",
};

/** Why an offset's composed bytes equal the removal's end's. */
function s23SameAsRemovalEnd(where: string, end: number): string {
  return (
    `${where}: its composed bytes equal those of the removal's end, ` +
    `${String(end)}, so the preview's \`import-addition\` alone tells them ` +
    "apart — a product mapping the composed position to the removal's " +
    "start reports this offset (T6.6-4(b))"
  );
}

/**
 * A staging of (h) through (j) at module load: `head` above `O`'s
 * declaration and `tail` below it, `f` last; `O`'s declaration removed with
 * its line — TEST-SPEC's `removal` range, cross-checked against the staged
 * text, a rewrite spelled `""` — the marker rewritten in place to `<X>.y`,
 * and the target module's declaration at the removal's end. Where
 * `statesEdits`, the preview's `reference-rewrite` spans the marker and its
 * `import-removal` the removal ((h)).
 */
function s23RemovalArm(spec: {
  readonly key: string;
  readonly head: readonly string[];
  readonly tail: readonly string[];
  readonly removal: S23Span;
  readonly placement: string;
  readonly excluded: Readonly<Record<number, string>>;
  readonly statesEdits?: boolean;
  readonly edges?: readonly S23Edge[];
}): S23Arm {
  const text = [...spec.head, S23_IMPORT_O, ...spec.tail, ""].join("\n");
  const start = spec.head.reduce(
    (sum, line) => sum + Buffer.byteLength(line, "utf8") + 1,
    0,
  );
  const end = start + Buffer.byteLength(S23_IMPORT_O, "utf8") + 1;
  if (start !== spec.removal.start || end !== spec.removal.end) {
    throw new Error(
      `T6.5-23 ${spec.key}: a harness defect — \`O\`'s declaration with ` +
        `its line spans [${String(start)}, ${String(end)}) in the staged ` +
        `text, not TEST-SPEC's removal range ` +
        `[${String(spec.removal.start)}, ${String(spec.removal.end)})`,
    );
  }
  const marker = s23Marker(text, spec.key);
  return {
    key: spec.key,
    receiver: S23_APP,
    kind: "typescript",
    text,
    staged: s23StagedApp(spec.key, text),
    files: {
      "xspec.config.ts": S23_CONFIG,
      [S23_ORIGIN]: S23_ORIGIN_SOURCE,
      [S23_TARGET]: S23_TARGET_SOURCE,
    },
    argv: S23_ARGV,
    rewrites: [{ start, end, spelled: () => "" }, marker],
    addition: {
      specifier: S23_TARGET_SPECIFIER,
      offsets: [end],
      why: S23_REMOVED_WHY,
    },
    placement: spec.placement,
    excluded: spec.excluded,
    ...(spec.statesEdits === true
      ? {
          preview: {
            rewrites: [{ start: marker.start, end: marker.end }],
            removals: [{ start, end }],
          },
        }
      : {}),
    ...(spec.edges === undefined ? {} : { edges: spec.edges }),
  };
}

// (h) a removed declaration's place: the basic move, `O`'s declaration
// removed over [0, 38).
const S23_H_BASIC = s23RemovalArm({
  key: "(h)",
  head: [],
  tail: [S23_F_LAST_USE],
  removal: { start: 0, end: 38 },
  placement:
    "the removal's end, offset 38, the only admissible offset — it follows " +
    "the removed declaration's end with nothing but that line's terminator " +
    "between, and is timely (6.5: a statement's end judged over the file " +
    "before the edit, a statement the rewrite removes included); a product " +
    "judging statement ends over the composed text finds no admissible " +
    "offset and refuses the move (`refused-invalid-rewrite`)",
  excluded: {
    0: s23SameAsRemovalEnd(S23_NO_STATEMENT_BEFORE, 38),
    37: "offset 37 — strictly inside the removal's range [0, 38)",
    66: S23_UNTIMELY_END,
  },
  statesEdits: true,
  edges: [S23_H_EDGE],
});

// (i) a comment above the removed declaration — 6.5's own example.
function s23CommentAbove(comment: string, removal: S23Span): S23Arm {
  return s23RemovalArm({
    key: `(i) under \`${comment}\``,
    head: [comment],
    tail: [S23_F_LAST_USE],
    removal,
    placement:
      `the removal's end, offset ${String(removal.end)}, the only ` +
      "admissible offset — the removal's start, the start of line 2, " +
      `follows only the comment \`${comment}\`, no statement's end — the ` +
      "comment then preceding the added line (6.5: a comment that " +
      "preceded the removed declaration then precedes the added line)",
    excluded: {
      0:
        "offset 0 — above the comment, no statement's end preceding it " +
        "(6.5): a product placing the added line above the comment fails",
      [removal.start]: s23SameAsRemovalEnd(
        `the start of line 2, the removal's start — it follows only the ` +
          `comment \`${comment}\`, no statement's end (6.5)`,
        removal.end,
      ),
      [removal.end + Buffer.byteLength(S23_F_LAST_USE, "utf8") + 1]:
        S23_UNTIMELY_END,
    },
  });
}

const S23_I_NOTE = s23CommentAbove("// note", { start: 8, end: 46 });
const S23_I_EXPECT_ERROR = s23CommentAbove("// @ts-expect-error", {
  start: 20,
  end: 58,
});

// (j) a string-literal statement after the removed declaration.
const S23_J_STRING = s23RemovalArm({
  key: "(j)",
  head: [],
  tail: ['"use client"', S23_F_LAST_USE],
  removal: { start: 0, end: 38 },
  placement:
    "the removal's end, offset 38, the only admissible offset — before the " +
    "edit the file's directive prologue is empty, its first statement an " +
    'import declaration, so `"use client"` is no directive, and judged ' +
    "over the file before the edit (6.5) the removal that would bring it " +
    "to the file's head changes neither — the string-literal statement " +
    "staying, as before the edit, no directive; a product judging the " +
    'prologue over the composed text admits no offset before `"use ' +
    'client"`, finds every later one untimely, and refuses the move',
  excluded: {
    0: s23SameAsRemovalEnd(S23_NO_STATEMENT_BEFORE, 38),
    37: "offset 37 — strictly inside the removal's range [0, 38)",
    51:
      'the start of line 3 — untimely, the statement `"use client"` ' +
      "standing between it and `O`'s declaration (6.5)",
    79:
      'the file\'s end — untimely, the statements `"use client"` and `f` ' +
      "standing between it and `O`'s declaration (6.5)",
  },
});

// (k) a callee's timeliness: (f)'s move and spec sources; the call, its
// target carried into `B`'s file, rewritten whole (6.5).

/** `A`'s declaration, binding its module's default and its `text` as `ta`. */
const S23_K_IMPORT_A = 'import A, { text as ta } from "../specs/A.xspec"';
/** A declaration binding `B`'s module's `text` as `tb`. */
const S23_K_IMPORT_TB = 'import { text as tb } from "../specs/B.xspec"';
/** The call the move carries into `B`'s file. */
const S23_K_CALL = "ta(A.m)";

/** (k)'s added declaration: `B`'s module's `text` alone (6.5's spellings). */
const S23_K_SPELLING: S23Spelling = {
  declaration: (ident) =>
    ident === "text"
      ? `import { text } from "${S23_F_SPECIFIER}"`
      : `import { text as ${ident} } from "${S23_F_SPECIFIER}"`,
  form:
    `\`import { text as <Y> } from "${S23_F_SPECIFIER}"\`, or ` +
    `\`import { text } from "${S23_F_SPECIFIER}"\` where the fresh ` +
    "identifier is `text` itself, binding `B`'s module's `text` alone — no " +
    "second default binding",
  also: ["text"],
};

/** The call's edge after the move: from `src/c.ts` — a top-level
 * statement's embedding is attributed to the file (4.6) — to the moved
 * node's new identity. */
const S23_K_EDGE: S23Edge = {
  from: S23_APP,
  to: "specs/B.mdx#m",
  kind: "embeds",
  what: "the call",
};

/** Why an offset is excluded in (k): untimely for the callee. */
function s23KUntimely(where: string, between: string): string {
  return (
    `${where} — untimely for the callee, ${between} standing between it ` +
    "and `ta`'s declaration (6.5: an added binding is declared at or " +
    "before the binding the spelling was rooted at, or after it with no " +
    "top-level statement between but import declarations)"
  );
}

/** A staging of (k) at module load: the call rewritten whole as
 * `rewritten` spells it, the preview's one `reference-rewrite` spanning it
 * and no `import-removal`, and the call's `embeds` edge after the move. */
function s23KArm(spec: {
  readonly key: string;
  readonly lines: readonly string[];
  readonly rewritten: (ident: string) => string;
  readonly addition?: {
    readonly offsets: readonly number[];
    readonly why: string;
  };
  readonly placement: string;
  readonly excluded?: Readonly<Record<number, string>>;
}): S23Arm {
  const text = [...spec.lines, ""].join("\n");
  const call = s23Marker(text, spec.key, S23_K_CALL, spec.rewritten);
  return {
    key: spec.key,
    receiver: S23_APP,
    kind: "typescript",
    text,
    staged: s23StagedApp(spec.key, text),
    files: {
      "xspec.config.ts": S23_CONFIG,
      "specs/A.mdx": S23_F_A_SOURCE,
      "specs/B.mdx": S23_F_B_SOURCE,
    },
    argv: S23_F_ARGV,
    rewrites: [call],
    addition:
      spec.addition === undefined
        ? undefined
        : {
            specifier: S23_F_SPECIFIER,
            spelled: S23_K_SPELLING,
            ...spec.addition,
          },
    placement: spec.placement,
    excluded: spec.excluded ?? {},
    preview: {
      rewrites: [{ start: call.start, end: call.end }],
      removals: [],
    },
    edges: [S23_K_EDGE],
  };
}

const S23_K_CALLEE = s23KArm({
  key: "(k)",
  lines: [
    S23_K_IMPORT_A,
    S23_IMPORT_B,
    S23_K_CALL,
    S23_K_IMPORT_TB,
    "tb(B.b)",
    "A.k",
  ],
  rewritten: (ident) => `${ident}(B.m)`,
  addition: {
    offsets: [49, 82],
    why:
      "the call's argument is re-rooted at `B`, timely, its declaration " +
      "directly following `A`'s, but its callee needs `B`'s module's " +
      "`text`, and `tb`, binding it, is untimely — the statement `ta(A.m)` " +
      "stands between `ta`'s declaration and `tb`'s — so a declaration " +
      "binding only that `text` is added; a product judging timeliness for " +
      "default bindings alone writes `tb(B.m)`, which TypeScript's CommonJS " +
      "output reads before initializing `tb`'s module binding",
  },
  placement:
    "the start of line 2 or of line 3 (offset 49 or 82), the two " +
    "line-start admissible offsets, both timely (6.5's latitude between " +
    "them) — the call's occurrence span becoming exactly `<Y>(B.m)`, " +
    "`A`'s declaration staying, kept by `A.k`, and no other byte changing",
  excluded: {
    0: S23_NO_STATEMENT_BEFORE,
    48: s23MidLine("the end of line 1, `A`'s declaration's end"),
    81: s23MidLine("the end of line 2, `B`'s declaration's end"),
    90: s23KUntimely("the start of line 4", "the statement `ta(A.m)`"),
    136: s23KUntimely("the start of line 5", "the statement `ta(A.m)`"),
    144: s23KUntimely(
      "the start of line 6",
      "the statements `ta(A.m)` and `tb(B.b)`",
    ),
    148: s23KUntimely(
      "the file's end",
      "the statements `ta(A.m)`, `tb(B.b)`, and `A.k`",
    ),
  },
});

// (k) its control: re-rooting at bindings the file holds.
const S23_K_CONTROL = s23KArm({
  key: "(k) control",
  lines: [
    S23_K_IMPORT_A,
    S23_K_IMPORT_TB,
    S23_IMPORT_B,
    S23_K_CALL,
    "tb(B.b)",
    "A.k",
  ],
  rewritten: () => "tb(B.m)",
  placement:
    "`tb` is timely for the callee, its declaration directly following " +
    "`ta`'s, and `B` for the argument, `tb`'s import declaration alone " +
    "standing between `A`'s declaration and `B`'s (6.5: or follows it with " +
    "no top-level statement between them but import declarations), so the " +
    "call is re-rooted at both existing bindings, `tb(B.m)`, nothing is " +
    "added, and `A`'s declaration stays, kept by `A.k`; a product never " +
    "re-rooting a callee at a `text` binding the file holds adds `import " +
    "{ text as <Y> } …`, and one judging timeliness as precedence or " +
    "direct succession alone adds a declaration binding `B`'s module's " +
    "default",
});

/** Each line's start in `lines` joined by U+000A with a final U+000A, then
 * the file's end, in bytes. */
function s23Starts(lines: readonly string[]): readonly number[] {
  const starts: number[] = [];
  let offset = 0;
  for (const line of lines) {
    starts.push(offset);
    offset += Buffer.byteLength(line, "utf8") + 1;
  }
  starts.push(offset);
  return starts;
}

/** `actual`, failing as a harness defect unless it is TEST-SPEC's `stated`
 * offset of `what`. */
function s23Stated(
  key: string,
  what: string,
  actual: number | undefined,
  stated: number,
): number {
  if (actual !== stated) {
    throw new Error(
      `T6.5-23 ${key}: a harness defect — ${what} lies at ` +
        `${String(actual)} in the staged text, not at TEST-SPEC's ` +
        String(stated),
    );
  }
  return stated;
}

// (l) and (m): (f)'s move over two declarations of `A`'s module binding
// distinct identifiers (valid, 4, T4-4), the moved `m` carrying its child
// `m.c`.

/** `specs/A.mdx` in (l) and (m): the moved `m`, its child `m.c`, and the
 * kept `k`. */
const S23_LM_A_SOURCE: StagedMdx = stagedMdx(
  "T6.5-23 (l)/(m) specs/A.mdx (the moved m and its child m.c, the kept k)",
  [
    '<S id="m">',
    "M text.",
    "",
    '<S id="m.c">',
    "C text.",
    "</S>",
    "</S>",
    "",
    '<S id="k">',
    "K text.",
    "</S>",
    "",
  ].join("\n"),
);

/** `A1`'s declaration, heading the file at [0, 33). */
const S23_IMPORT_A1 = 'import A1 from "../specs/A.xspec"';
/** `A2`'s declaration, of the same module. */
const S23_IMPORT_A2 = 'import A2 from "../specs/A.xspec"';

/** The rewritten markers' edges after the move: from `src/c.ts` — a
 * top-level statement's reference is attributed to the file (4.6) — to the
 * moved nodes' new identities. */
const S23_LM_EDGES: readonly S23Edge[] = [
  {
    from: S23_APP,
    to: "specs/B.mdx#m",
    kind: "references",
    what: "the rewritten marker `A1.m`",
  },
  {
    from: S23_APP,
    to: "specs/B.mdx#m.c",
    kind: "references",
    what: "the rewritten marker `A2.m.c`",
  },
];

/** Why an offset of (l) or (m) is excluded: untimely for `A1.m`. */
function s23LmUntimely(where: string, between: string, more = ""): string {
  return (
    `${where} — untimely for \`A1.m\`, ${between} standing between it and ` +
    `\`A1\`'s declaration${more} (6.5: an added declaration's bindings are ` +
    "timely for every spelling rooted at them — declared at or before the " +
    "binding each spelling was rooted at, or after it with only import " +
    "declarations between)"
  );
}

/** A staging of (l) or (m) at module load: `A1.m` rewritten in place to
 * `<X>.m` and `A2.m.c` as `chained` spells it, `B`'s module's declaration at
 * the start of line 2 (TEST-SPEC's offset 34, cross-checked against the
 * staged text), the preview's two `reference-rewrite` edits and no
 * `import-removal`, and both markers' `references` edges. */
function s23LmArm(spec: {
  readonly key: string;
  readonly lines: readonly string[];
  readonly chained: (ident: string) => string;
  readonly why: string;
  readonly placement: string;
  readonly excluded: Readonly<Record<number, string>>;
}): S23Arm {
  const text = [...spec.lines, ""].join("\n");
  const line2 = s23Stated(
    spec.key,
    "the start of line 2",
    s23Starts(spec.lines)[1],
    34,
  );
  return {
    key: spec.key,
    receiver: S23_APP,
    kind: "typescript",
    text,
    staged: s23StagedApp(spec.key, text),
    files: {
      "xspec.config.ts": S23_CONFIG,
      "specs/A.mdx": S23_LM_A_SOURCE,
      "specs/B.mdx": S23_F_B_SOURCE,
    },
    argv: S23_F_ARGV,
    rewrites: [
      s23Marker(text, spec.key, "A1.m", (ident) => `${ident}.m`),
      s23Marker(text, spec.key, "A2.m.c", spec.chained),
    ],
    addition: {
      specifier: S23_F_SPECIFIER,
      offsets: [line2],
      why: spec.why,
    },
    placement: spec.placement,
    excluded: spec.excluded,
    preview: { rewrites: 2, removals: [] },
    edges: S23_LM_EDGES,
  };
}

// (l) one added binding rooting spellings formerly rooted at different
// bindings.
const S23_L_ONE_BINDING = s23LmArm({
  key: "(l)",
  lines: [S23_IMPORT_A1, "A1.m", S23_IMPORT_A2, "A2.m.c", "A1.k", "A2.k"],
  chained: (ident) => `${ident}.m.c`,
  why:
    "both moved markers, `A1.m` and `A2.m.c`, need `B`'s module's default, " +
    "which the file lacks, so one declaration of it is added, its binding " +
    "rooting both — and it must be timely for each (6.5: its bindings " +
    "timely for every spelling rooted at them)",
  placement:
    "the start of line 2 (offset 34), the only line-start admissible " +
    "offset — timely for `A1.m` and for `A2.m.c`; the end of line 1, " +
    "admissible too, is mid-line, and the starts of lines 3 and 4 are " +
    "timely for `A2.m.c` alone — the one added binding rooting both, " +
    "`<X>.m` and `<X>.m.c`, both former declarations kept by `A1.k` and " +
    "`A2.k`",
  excluded: {
    0: S23_NO_STATEMENT_BEFORE,
    33: s23MidLine("the end of line 1, `A1`'s declaration's end"),
    39: s23LmUntimely(
      "the start of line 3",
      "the statement `A1.m`",
      ", though timely for `A2.m.c`: a product judging the added binding's " +
        "timeliness against one spelling's former binding alone — `A2`, " +
        "the last found — admits it",
    ),
    72: s23LmUntimely(
      "the end of line 3, `A2`'s declaration's end",
      "the statement `A1.m`",
      ", though timely for `A2.m.c`",
    ),
    73: s23LmUntimely(
      "the start of line 4",
      "the statement `A1.m`",
      ", though timely for `A2.m.c`: a product placing the added line " +
        "directly after the last-found former binding's declaration, " +
        "`A2`'s, writes it here, after `<X>.m`, which TypeScript's " +
        "CommonJS output then runs before initializing `<X>`",
    ),
    80: s23LmUntimely(
      "the start of line 5",
      "the statements `A1.m` and `A2.m.c`",
      ", and for `A2.m.c` as well",
    ),
    85: s23LmUntimely(
      "the start of line 6",
      "the statements `A1.m`, `A2.m.c`, and `A1.k`",
      ", and for `A2.m.c` as well",
    ),
    90: s23LmUntimely(
      "the file's end",
      "the statements `A1.m`, `A2.m.c`, `A1.k`, and `A2.k`",
      ", and for `A2.m.c` as well",
    ),
  },
});

// (m) a held binding beside an added one, for one module in one file.
const S23_M_HELD_BESIDE = s23LmArm({
  key: "(m)",
  lines: [
    S23_IMPORT_A1,
    "A1.m",
    S23_IMPORT_B,
    S23_IMPORT_A2,
    "A2.m.c",
    "A1.k",
    "A2.k",
    "B.b",
  ],
  chained: () => "B.m.c",
  why:
    "`B` is untimely for `A1.m` — the statement `A1.m` stands between " +
    "`A1`'s declaration and `B`'s — so a declaration of `B`'s module is " +
    "added, binding `<X>` distinct from `B`, rooting `A1.m` alone, while " +
    "`B`'s declaration precedes `A2`'s, so `B` is timely for `A2.m.c`, " +
    "which is re-rooted at it (6.5: a spelling is rooted at a binding the " +
    "file already holds, unshadowed and timely, and at an added " +
    "declaration's binding only where the file holds none)",
  placement:
    "the start of line 2 (offset 34), the only line-start admissible " +
    "offset — the end of line 1, admissible too, is mid-line, and every " +
    "later offset is untimely for `A1.m` — `A1.m` rewritten in place to " +
    "`<X>.m` and `A2.m.c` to `B.m.c`, never `<X>.m.c` (a product rooting " +
    "every spelling of a module at the added binding, once one needs it, " +
    "writes `<X>.m.c`), both former declarations kept by `A1.k` and " +
    "`A2.k`, and `B`'s by `B.b`",
  excluded: {
    0: S23_NO_STATEMENT_BEFORE,
    33: s23MidLine("the end of line 1, `A1`'s declaration's end"),
    39: s23LmUntimely("the start of line 3", "the statement `A1.m`"),
    72: s23LmUntimely("the start of line 4", "the statement `A1.m`"),
    106: s23LmUntimely("the start of line 5", "the statement `A1.m`"),
    113: s23LmUntimely(
      "the start of line 6",
      "the statements `A1.m` and `A2.m.c`",
    ),
    118: s23LmUntimely(
      "the start of line 7",
      "the statements `A1.m`, `A2.m.c`, and `A1.k`",
    ),
    123: s23LmUntimely(
      "the start of line 8",
      "the statements `A1.m`, `A2.m.c`, `A1.k`, and `A2.k`",
    ),
    127: s23LmUntimely(
      "the file's end",
      "the statements `A1.m`, `A2.m.c`, `A1.k`, `A2.k`, and `B.b`",
    ),
  },
});

// (n) nested statement lists: (d)'s file with `f` spread over lines, and
// separately with `namespace N {` in place of `export function f() {`.
function s23Nested(spec: {
  readonly key: string;
  readonly opener: string;
  /** The statement whose body the inner line starts lie in. */
  readonly unit: string;
  /** That body in words. */
  readonly body: string;
  /** What else a product taking the body's line start does, in words. */
  readonly also: string;
}): S23Arm {
  const lines = [`${S23_IMPORT_O} // note`, spec.opener, "  O.x", "  O.w", "}"];
  const [, line2, line3, line4, line5, end] = s23Starts(lines) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const derives =
    ", though the form there derives (S-9: TypeScript 5.9.3's parser " +
    `derives an import declaration in ${spec.body}, the restrictions on ` +
    "where one may stand being post-parse grammar checks 14.20 excludes)";
  const inside = `inside the statement \`${spec.unit}\`, where a declaration is no top-level one (6.5)`;
  return s23Arm({
    key: spec.key,
    text: [...lines, ""].join("\n"),
    offsets: [37, 38],
    placement:
      "no line start qualifying — the start of line 2 follows the comment, " +
      `every line start of ${spec.body} lies inside the statement ` +
      `\`${spec.unit}\`, where a declaration is no top-level one, and every ` +
      "offset after it is untimely, the statement standing between it and " +
      "`O`'s declaration — the declaration's end or after the space before " +
      "`//`, 37 or 38, both mid-line (6.5's latitude between them), the " +
      "marker rewritten in place to `<X>.y`",
    excluded: {
      0: S23_NO_STATEMENT_BEFORE,
      [line2]:
        "the start of line 2 — it follows the comment `// note`, no " +
        "statement's end with whitespace alone between (6.5)",
      [line3]: `the start of line 3 — ${inside}${derives}`,
      [line4]:
        `the start of line 4, after \`O.x\`'s end — ${inside}${derives}: a ` +
        "product judging statement boundaries within the innermost " +
        "statement list alone finds it admissible and takes it under the " +
        `line-start preference${spec.also}`,
      [line5]: `the start of line 5, before \`}\` — ${inside}${derives}`,
      [end]:
        "the file's end — untimely, the statement " +
        `\`${spec.unit}\` standing between it and \`O\`'s declaration (6.5)`,
    },
    deriving: [line3, line4, line5],
  });
}

const S23_N_FUNCTION = s23Nested({
  key: "(n)",
  opener: "export function f() {",
  unit: "f",
  body: "a function body",
  also: "",
});

const S23_N_NAMESPACE = s23Nested({
  key: "(n) with `namespace N {`",
  opener: "namespace N {",
  unit: "N",
  body: "a namespace body",
  also:
    ", as does one taking a namespace body — a module block, where " +
    "TypeScript also admits import-equals declarations — for a " +
    "declaration site",
});

// (o) timeliness, a TypeScript source's condition alone: a third spec source
// under the arms' move, `T`'s ESM block following `O`'s with the section `p`
// between them.
const S23_O_RECEIVER = "specs/third.mdx";
/** `O`'s declaration, heading the file, with its line: [0, 31). */
const S23_O_IMPORT = 'import O from "./origin.xspec"';
const S23_O_TEXT = [
  S23_O_IMPORT,
  "",
  '<S id="p" d={O.x} />',
  "",
  'import T from "./target.xspec"',
  "",
  '<S id="q" d={T.z} />',
  "",
].join("\n");
const S23_O_REMOVAL_END = s23Stated(
  "(o)",
  "the end of `O`'s declaration's line",
  Buffer.byteLength(S23_O_IMPORT, "utf8") + 1,
  31,
);
const S23_O_REFERENCE = s23Marker(S23_O_TEXT, "(o)", "O.x", () => "T.y");
s23Stated("(o)", "the reference `O.x`", S23_O_REFERENCE.start, 45);

const S23_O: S23Arm = {
  key: "(o)",
  receiver: S23_O_RECEIVER,
  kind: "spec-source",
  text: S23_O_TEXT,
  staged: stagedMdx(
    "T6.5-23 (o) specs/third.mdx (O's ESM block, p, T's ESM block, q)",
    S23_O_TEXT,
  ),
  files: {
    "xspec.config.ts": R16_CONFIG,
    [S23_ORIGIN]: S23_ORIGIN_SOURCE,
    [S23_TARGET]: S23_TARGET_SOURCE,
  },
  argv: S23_ARGV,
  rewrites: [
    { start: 0, end: S23_O_REMOVAL_END, spelled: () => "" },
    S23_O_REFERENCE,
  ],
  addition: undefined,
  placement:
    "`T` is a binding the file holds and no local declaration shadows, so " +
    "the reference `O.x` is re-rooted at it, `T.y` — a spec source, which " +
    "6.5 holds to no timeliness, re-roots wherever the file holds one " +
    "unshadowed, though `T`'s ESM block follows `O`'s with the section `p` " +
    "between them — nothing is added, and `O`'s declaration, its last use " +
    "gone, is removed with its line, [0, 31); a product judging timeliness " +
    "in a spec source too, the flow content between two ESM blocks counted " +
    "as a statement standing between their declarations, adds a " +
    "declaration of the target module and roots the reference at its " +
    "binding",
  excluded: {},
  preview: {
    rewrites: [{ start: S23_O_REFERENCE.start, end: S23_O_REFERENCE.end }],
    removals: [{ start: 0, end: S23_O_REMOVAL_END }],
  },
  edges: [
    {
      from: `${S23_O_RECEIVER}#p`,
      to: "specs/target.mdx#y",
      kind: "depends",
      what: "the section `p`",
    },
  ],
};

// (p) whitespace between a statement's end and its line's terminator: the
// members of 1.4's class that are no line terminator (3), each staged after
// `O`'s declaration where (d) stages characters outside the class.
function s23TrailingWhitespace(codePoint: number): S23Arm {
  const name = `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
  const key = `(p) with ${name}`;
  const text = `${S23_IMPORT_O}${String.fromCodePoint(codePoint)}\n${S23_F}\n`;
  const bytes = Buffer.from(text, "utf8");
  s23Stated(key, "`f`", bytes.indexOf(S23_F), 39);
  const marker = s23Marker(text, key);
  s23Stated(key, "the marker `O.x`", marker.start, 61);
  const narrower =
    codePoint === 0x0b || codePoint === 0x0c
      ? `, and one judging whitespace over a set narrower than 1.4's — ` +
        `space, tab, CR, and LF, say — takes 37 here, ${name} lying ` +
        "outside it"
      : "";
  const midLine = (where: string): string =>
    `${where} — admissible, but mid-line, while the start of line 2 is ` +
    "admissible, taken over any other (6.5's preference): a product " +
    "admitting a line start only where the line terminator before it " +
    "directly follows a statement's end takes 37 or 38" +
    narrower;
  return s23Arm({
    key,
    text,
    offsets: [39],
    placement:
      "the start of line 2 (offset 39), the only line-start admissible " +
      `offset — 37, 38, and 39 each follow the declaration's end with ` +
      `nothing but whitespace (1.4: ${name} is a member of the class) ` +
      "between, and are timely, while offset 0 follows no statement's end, " +
      "every offset inside `O`'s declaration or `f` lies inside a " +
      "statement, and every offset after `f` is untimely — " +
      `${name} kept at the end of line 1, the marker rewritten in place to ` +
      "`<X>.y`",
    excluded: {
      0: S23_NO_STATEMENT_BEFORE,
      37: midLine("the declaration's end, 37"),
      38: midLine(`offset 38, after ${name}`),
      72: S23_UNTIMELY_END,
    },
    preview: {
      rewrites: [{ start: marker.start, end: marker.end }],
      removals: [],
    },
  });
}

const S23_P_SPACE = s23TrailingWhitespace(0x20);
const S23_P_TAB = s23TrailingWhitespace(0x09);
const S23_P_VT = s23TrailingWhitespace(0x0b);
const S23_P_FF = s23TrailingWhitespace(0x0c);

/** Arms (a) through (p), in TEST-SPEC's order. */
const S23_ARMS: readonly S23Arm[] = [
  S23_A_PROLOGUE,
  S23_A_BETWEEN,
  S23_B_NOCHECK,
  S23_B_REFERENCE,
  S23_C_GOVERNED,
  S23_D_COMMENT,
  S23_D_NBSP,
  S23_D_LSEP,
  S23_E_SEMICOLON,
  S23_E_SHAPE,
  S23_F_EXAMPLE,
  S23_F_CONTROL,
  S23_F_TYPE_ALIAS,
  S23_F_IMPORT_EQUALS,
  S23_F_TYPE_IMPORT,
  S23_F_SIDE_EFFECT,
  S23_F_PRECEDENCE,
  S23_G,
  S23_H_BASIC,
  S23_I_NOTE,
  S23_I_EXPECT_ERROR,
  S23_J_STRING,
  S23_K_CALLEE,
  S23_K_CONTROL,
  S23_L_ONE_BINDING,
  S23_M_HELD_BESIDE,
  S23_N_FUNCTION,
  S23_N_NAMESPACE,
  S23_O,
  S23_P_SPACE,
  S23_P_TAB,
  S23_P_VT,
  S23_P_FF,
];

const T6_5_23 = defineProductTest({
  id: "T6.5-23",
  title:
    'statement boundaries, the directive prologue, and timeliness — arms (a) through (p), each a section move: in (a) through (e) `move specs/origin.mdx#x specs/target.mdx#y`, whose receiver `src/c.ts` (`import O from "../specs/origin.xspec"` beside `f` = `export function f() { O.x; O.w }`) gains exactly `import <X> from "../specs/target.xspec"`, value-blind in `<X>` alone, at an admissible offset, the marker rewritten in place to `<X>.y`, every other byte as staged: (a) after a `"use client"` prologue at the start of line 2 or 3, never offset 0, and between two directives (`"use client"`, then `"use strict"; import O … // note`), no line start admissible, at offset 26, 27, 64, or 65; (b) under `// @ts-nocheck` and under `/// <reference lib="esnext" />` at the start of line 3, never above the directive; (c) at the start of line 2, before a `// @ts-expect-error` comment, never between it and the statement it governs, the file compiling clean under standard tooling before and after the move; (d) after a trailing `// note` mid-line at 37 or 38, and after U+00A0 or U+2028 at 37 alone (1.4\'s whitespace, 3\'s terminators); (e) after a `;` terminating `O`\'s declaration across a line at the start of line 3, never inside the declaration, and in 6.5\'s own shape (one call statement across two lines) at one of six mid-line offsets, never at the start of line 3; (f) timeliness under `move specs/A.mdx#m specs/B.mdx#m`: 6.5\'s example (`import A …`, `A.m`, `A.k`, `import B …`, `B.b`), `B` untimely for the marker, gains `import <X> from "../specs/B.xspec"` at the start of line 2, the marker written `<X>.m`, and `query edges` reports the marker\'s `references` edge from `src/c.ts` to `specs/B.mdx#m`; its control (`import B …` on line 2) is re-rooted to `B.m`, nothing added; with `type T = number` or `import Z = require("./z")` interposed between the two declarations `B` is untimely and the declaration is added at offset 33; with `import type { T } from "./t"` or `import "./p"` interposed `B` stays timely, the marker re-rooted to `B.m`, nothing added, the preview one `reference-rewrite` and no `import-addition` or `import-removal`; the precedence branch at a distance (`import B …`, `B.b`, `import A …`, `A.m`, `A.k`) re-rooted to `B.m`, nothing added, the preview\'s one `reference-rewrite` spanning [70, 73), and the marker\'s edge reported; (g) the spec-source side of the split rule: a target whose first two lines are one declaration of one ESM block (`import K from "./k.xspec"`, `;`), receiving T6.5-13(h)\'s moved text into `p.n`, gains `import <X> from "./x.xspec"` at offset 0, the empty line\'s start, or the file\'s end, never at the start of line 2, which derives yet splits the declaration; (h) a removed declaration\'s place: with `f` = `export function f() { O.x }`, `O`\'s declaration losing its last use and removed with its line over [0, 38), the added line stands at the removal\'s end, offset 38, the file becoming exactly `import <X> from "../specs/target.xspec"`, U+000A, `export function f() { <X>.y }`, U+000A, the preview one `reference-rewrite` spanning the marker, one `import-removal` spanning [0, 38), and the `import-addition` at 38, never 0, and `query edges` the marker\'s `references` edge from `src/c.ts#f` to `specs/target.mdx#y`; (i) that file headed by `// note` or by `// @ts-expect-error`: the added line at the removal\'s end, 46 or 58, the comment then preceding it; (j) `"use client"` after the removed declaration: the added line at 38, the string-literal statement staying no directive; (k) a callee\'s timeliness under (f)\'s move: `ta(A.m)`, below `import A, { text as ta } …` and `import B …` and above `import { text as tb } …`, rewritten whole to `<Y>(B.m)`, the file gaining exactly `import { text as <Y> } from "../specs/B.xspec"` (or `import { text } …`) at offset 49 or 82, the preview one `reference-rewrite` spanning the call and no `import-removal`, and `query edges` the call\'s `embeds` edge from `src/c.ts` to `specs/B.mdx#m`; its control, `import { text as tb } …` on line 2, re-rooted at both existing bindings, `tb(B.m)`, nothing added; (l) under (f)\'s move, two declarations of one module (`import A1 …`, `A1.m`, `import A2 …`, `A2.m.c`, `A1.k`, `A2.k`): one added `import <X> from "../specs/B.xspec"` at offset 34, timely for both markers, which become `<X>.m` and `<X>.m.c`, the preview two `reference-rewrite` edits and no `import-removal`, and `query edges` the markers\' `references` edges from `src/c.ts` to `specs/B.mdx#m` and `specs/B.mdx#m.c`; (m) the same with `import B …` after `A1.m` and `B.b` last: the declaration added at 34 for `A1.m` alone, `A2.m.c` re-rooted at the timely `B` as `B.m.c`; (n) (d)\'s file with `f` spread over lines, or with `namespace N {` in its place: at 37 or 38, never at a line start inside the body; (o) a spec source (`import O …`, `<S id="p" d={O.x} />`, `import T …`, `<S id="q" d={T.z} />`): `O.x` re-rooted at the later-declared `T`, nothing added, `O`\'s declaration removed with its line, the preview one `reference-rewrite` spanning [45, 48) and one `import-removal` spanning [0, 31), and `query edges` `p`\'s `depends` edge to `specs/target.mdx#y`; (p) U+0020, U+0009, U+000B, or U+000C between `O`\'s declaration and its line\'s terminator: at the start of line 2, 39, the preview one `reference-rewrite` spanning [61, 64) and no `import-removal` — each move exiting 0, every receiver well-formed after it (TypeScript 5.9.3\'s module and script readings; the stock MDX 3 grammar), the preview\'s one `import-addition` at the offset the real operation used wherever a declaration is added (T6.6-4(b)), and `check` and `build` clean after it (SPEC 6.5, 1.4, 3, 4, 4.6, 5.2, 6.4, 6.6, 11.1, 12.7, 14.20)',
  timeoutMs: 300_000,
  run: async (product) => {
    const failures: string[] = [];
    for (const arm of S23_ARMS) {
      try {
        await runS23Arm(product, arm);
      } catch (error) {
        if (!(error instanceof HarnessAssertionError)) throw error;
        // A failure diagnosed outside the staging's own assertions — the
        // subprocess driver's T6.5-22(a) hook, say — is named by its
        // staging too.
        const context = `T6.5-23 ${arm.key}`;
        failures.push(
          error.message.startsWith(`${context}:`)
            ? error.message
            : `${context}: ${error.message}`,
        );
      }
    }
    if (failures.length > 0) {
      fail(
        `T6.5-23: ${String(failures.length)} of ${String(S23_ARMS.length)} ` +
          `stagings failed, each diagnosed:\n` +
          failures.map((failure) => `* ${failure}`).join("\n"),
      );
    }
  },
});

/** TEST-SPEC §6.5, fifth part, in canonical ID order (SUITE-25). */
export const section65vTests: readonly ProductTestEntry[] = [T6_5_23];
