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
//   product invocation): one spec group (`specs/**/*.mdx`) and one code
//   group (`src/**/*.ts`); `specs/origin.mdx` holding the top-level sections
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

import { Buffer } from "node:buffer";
import type { PreviewFileEntry } from "../../helpers/adapters/index.js";
import {
  decodeAppliedMappingReport,
  decodePreviewReport,
} from "../../helpers/adapters/index.js";
import { judgeAddedImportsOfFile } from "../../helpers/added-import-identifiers.js";
import { fail, HarnessAssertionError } from "../../helpers/assertions.js";
import { atLineStart } from "../../helpers/import-insertion.js";
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
import { expectFindingFreeReport, runJson } from "./support.js";

// ---------------------------------------------------------------------------
// T6.5-23 Statement boundaries, the directive prologue, and timeliness
// ---------------------------------------------------------------------------

const S23_ORIGIN = "specs/origin.mdx";
const S23_TARGET = "specs/target.mdx";
const S23_C_SPEC = "specs/c.mdx";
/** The receiving file of every staging below. */
const S23_APP = "src/c.ts";
/** The arms' move (TEST-SPEC: "a section move of `specs/origin.mdx#x` to
 * `specs/target.mdx#y`"). */
const S23_ARGV = ["move", "specs/origin.mdx#x", "specs/target.mdx#y"] as const;
const S23_MOVE_LABEL = S23_ARGV.join(" ");
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
 * coordinates (6.6). */
interface S23Rewrite {
  readonly start: number;
  readonly end: number;
  /** The replacement's characters, given the added binding's identifier. */
  readonly spelled: (ident: string) => string;
}

/** One byte-asserted staging of T6.5-23. */
interface S23Arm {
  /** The entry's arm and staging, e.g. `(a) between two directives`. */
  readonly key: string;
  /** The staged `src/c.ts`. */
  readonly text: string;
  /** Its staged-source record (S-9). */
  readonly staged: StagedTs;
  /** Further files beside the common staging. */
  readonly extra?: Readonly<Record<string, InitialFileContents>>;
  /** The rewrite's replaced spans. */
  readonly rewrites: readonly S23Rewrite[];
  /** The admissible offsets TEST-SPEC names, pre-operation bytes. */
  readonly offsets: readonly number[];
  /** Where 6.5 admits the added line here, and why, for diagnoses. */
  readonly placement: string;
  /** Inadmissible offsets TEST-SPEC names, with why, for diagnoses. */
  readonly excluded: Readonly<Record<number, string>>;
  /** (c): why the file compiles clean under standard tooling (H-2). */
  readonly compiles?: string;
}

/** The added declaration (6.5's exact spelling) binding `ident`. */
function s23Declaration(ident: string): string {
  return `import ${ident} from "${S23_TARGET_SPECIFIER}"`;
}

/** The marker `O.x`'s span in `text`, rewritten to `<X>.y` (6.4: prefix
 * replacement, the chain re-rooted at the added binding). */
function s23Marker(text: string, key: string): S23Rewrite {
  const bytes = Buffer.from(text, "utf8");
  const start = bytes.indexOf("O.x");
  if (start < 0 || bytes.lastIndexOf("O.x") !== start) {
    throw new Error(
      `T6.5-23 ${key}: a harness defect — the staged ${S23_APP} must hold ` +
        `the marker \`O.x\` exactly once`,
    );
  }
  return { start, end: start + 3, spelled: (ident) => `${ident}.y` };
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
 * The staging's premises, judged before any product is driven on it (a
 * harness defect otherwise, never a product verdict): the staged text and
 * each admissible offset's composed form — the placeholder in `<X>`'s
 * place — are text TypeScript 5.9.3 accepts both as module code and as
 * script code (14.20; S-9's judge), and the admissible offsets compose
 * pairwise distinct bytes, so the product's bytes name the one it used.
 */
function s23AssertPremises(arm: S23Arm): void {
  const pre = Buffer.from(arm.text, "utf8");
  const forms = [{ offset: -1, bytes: pre as Uint8Array }];
  for (const offset of arm.offsets) {
    const composed = s23Compose(pre, arm.rewrites, S23_PLACEHOLDER, {
      offset,
      declaration: s23Declaration(S23_PLACEHOLDER),
    });
    if (composed === undefined) {
      throw new Error(
        `T6.5-23 ${arm.key}: a harness defect — the admissible offset ` +
          `${String(offset)} lies inside a replaced span`,
      );
    }
    forms.push({ offset, bytes: composed });
  }
  for (const form of forms) {
    const verdict = judgeTypeScript(form.bytes, S23_APP);
    if (verdict.verdict !== "well-formed") {
      throw new Error(
        `T6.5-23 ${arm.key}: a harness defect — ` +
          (form.offset < 0
            ? "the staged text"
            : `the form composed at offset ${String(form.offset)}`) +
          ` is not text TypeScript 5.9.3 accepts both as module code and ` +
          `as script code (14.20; S-9): ${JSON.stringify(verdict)}; the ` +
          `text reads ${JSON.stringify(Buffer.from(form.bytes).toString("utf8"))}`,
      );
    }
  }
  const distinct = new Set(
    forms.slice(1).map((form) => Buffer.from(form.bytes).toString("hex")),
  );
  if (distinct.size !== arm.offsets.length) {
    throw new Error(
      `T6.5-23 ${arm.key}: a harness defect — two admissible offsets ` +
        `compose the same bytes, so the bytes cannot name the offset used`,
    );
  }
}

/** The receiving file's text after the move, failing diagnosed unless it is
 * a plain file of valid UTF-8 (SPEC 6.5 rewrites it in place; 1.6). */
async function s23ReadReceiver(
  workspace: TestWorkspace,
  context: string,
): Promise<{ readonly bytes: Uint8Array; readonly text: string }> {
  const kind = await workspace.kind(S23_APP);
  if (kind !== "file") {
    fail(
      `${context}: after the move, ${S23_APP} must still be a plain file — ` +
        `the move rewrites it in place (SPEC 6.5); found ${kind}`,
    );
  }
  const bytes = await workspace.readBytes(S23_APP);
  try {
    const text = new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: true,
    }).decode(bytes);
    return { bytes, text };
  } catch {
    fail(
      `${context}: after the move, ${S23_APP} is not valid UTF-8 — 6.5 ` +
        `keeps every file a move rewrites well-formed (SPEC 1.6, 14.20)`,
    );
  }
}

/** The preview's entry for `src/c.ts`, taken before the real move (SPEC
 * 6.6: a preview modifies nothing). */
async function s23PreviewEntry(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
): Promise<PreviewFileEntry> {
  const label = `${context}: \`${S23_MOVE_LABEL} --preview --json\` before the real move`;
  const report = decodePreviewReport(
    await runJson(
      product,
      workspace,
      [...S23_ARGV, "--preview", "--json"],
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
    (candidate) => candidate.file === S23_APP,
  );
  const entry = entries.length === 1 ? entries[0] : undefined;
  if (entry === undefined) {
    fail(
      `${label}: \`files\` holds exactly one entry for ${S23_APP}, a file ` +
        `the operation rewrites — its marker's rewrite and its import ` +
        `addition (SPEC 6.6, 12.7); got ` +
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
  pre: Uint8Array,
  actual: Uint8Array,
  ident: string,
): string {
  const found: string[] = [];
  for (let offset = 0; offset <= pre.length; offset += 1) {
    for (const lead of [undefined, true, false]) {
      const composed = s23Compose(pre, arm.rewrites, ident, {
        offset,
        declaration: s23Declaration(ident),
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
        "line discipline beside the marker's rewrite, at any offset"
    : `the bytes read as the declaration inserted at ${found.join("; or at ")}`;
}

/** One staging in its own fresh workspace (see the notes). */
async function runS23Arm(product: ProductBinding, arm: S23Arm): Promise<void> {
  const context = `T6.5-23 ${arm.key}`;
  s23AssertPremises(arm);
  const workspace = await TestWorkspace.create({
    files: {
      "xspec.config.ts": S23_CONFIG,
      [S23_ORIGIN]: S23_ORIGIN_SOURCE,
      [S23_TARGET]: S23_TARGET_SOURCE,
      ...arm.extra,
      [S23_APP]: arm.staged,
    },
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
          rootFiles: [S23_APP],
        }),
        `${context}: ${S23_APP} compiles clean under standard tooling ` +
          `before the move (H-2) — ${arm.compiles}`,
      );
    }
    const preview = await s23PreviewEntry(product, workspace, context);
    decodeAppliedMappingReport(
      await runJson(
        product,
        workspace,
        [...S23_ARGV, "--json"],
        `${context}: \`${S23_MOVE_LABEL} --json\` — a valid move whose ` +
          `receiver holds an admissible offset is performed: exit 0 (SPEC ` +
          `6.5, 12.0)`,
      ),
      `${context}: \`${S23_MOVE_LABEL} --json\` — the form-exact 12.7 ` +
        `performed-operation document (SPEC 6.5, 12.7)`,
    );

    const pre = Buffer.from(arm.text, "utf8");
    const after = await s23ReadReceiver(workspace, context);
    const verdict = judgeTypeScript(after.bytes, S23_APP);
    if (verdict.verdict !== "well-formed") {
      fail(
        `${context}: ${S23_APP} after the move is text TypeScript 5.9.3 ` +
          `accepts both as module code and as script code — 6.5 keeps every ` +
          `file a move rewrites well-formed (SPEC 14.20); the judge's ` +
          `verdict: ${JSON.stringify(verdict)}; the file reads ` +
          `${JSON.stringify(after.text)}`,
      );
    }
    const judgement = judgeAddedImportsOfFile(
      S23_APP,
      "typescript",
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
    const added = judgement.added;
    const ident =
      added.length === 1 &&
      added[0]?.specifier === S23_TARGET_SPECIFIER &&
      added[0].identifiers.length === 1
        ? added[0].identifiers[0]
        : undefined;
    if (ident === undefined) {
      fail(
        `${context}: the move adds exactly one import declaration to ` +
          `${S23_APP}, binding the target module's default — ` +
          `\`import <X> from "${S23_TARGET_SPECIFIER}"\` (SPEC 6.5: one ` +
          `declaration per module whose bindings the rewritten spellings ` +
          `are rooted at and the file lacks; \`O\` keeps its use by ` +
          `\`O.w\`); the declarations added: ` +
          JSON.stringify(added.map((declaration) => declaration.text)) +
          `; the file reads ${JSON.stringify(after.text)}`,
      );
    }

    const declaration = s23Declaration(ident);
    const readings = arm.offsets.filter((offset) => {
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
        `${context}: ${S23_APP} after the move is exactly the staged bytes ` +
          `with the marker \`O.x\` rewritten in place to \`${ident}.y\` and ` +
          `${JSON.stringify(declaration)} inserted under 6.5's line ` +
          `discipline (U+000A after it, one before it where the offset is ` +
          `not at a line's start) at ` +
          arm.offsets.map((offset) => s23Where(pre, offset)).join(" or ") +
          ` — ${arm.placement} (SPEC 6.5, 1.4, 3, 6.4; T6.5-8's ` +
          `discipline, value-blind in the identifier alone); ` +
          `${s23Misplacement(arm, pre, after.bytes, ident)}; the file ` +
          `reads ${JSON.stringify(after.text)}`,
      );
    }

    const additions = preview.edits.filter(
      (edit) => edit.class === "import-addition",
    );
    const addition = additions.length === 1 ? additions[0] : undefined;
    if (
      addition === undefined ||
      addition.range.start !== addition.range.end ||
      !readings.includes(addition.range.start)
    ) {
      fail(
        `${context}: the preview's entry for ${S23_APP} reports exactly ` +
          `one \`import-addition\`, zero-length at the offset the real ` +
          `operation then used — ` +
          readings.map((offset) => s23Where(pre, offset)).join(" or ") +
          `, where the bytes above stand (SPEC 6.6, 6.5: the offset is ` +
          `exactly the one the preview reports; T6.6-4(b)); the preview's ` +
          `edits: ${JSON.stringify(preview.edits)}`,
      );
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
          rootFiles: [S23_APP],
        }),
        `${context}: ${S23_APP} compiles clean under standard tooling ` +
          `after the move (H-2) — ${arm.compiles}; the file reads ` +
          `${JSON.stringify(after.text)}`,
      );
    }
  } finally {
    await workspace.dispose();
  }
}

/** An arm at module load: its `src/c.ts` record and its marker's rewrite. */
function s23Arm(spec: Omit<S23Arm, "staged" | "rewrites">): S23Arm {
  return {
    ...spec,
    staged: stagedTs(
      `T6.5-23 ${spec.key} ${S23_APP}`,
      spec.text,
      "well-formed",
      "ts",
    ),
    rewrites: [s23Marker(spec.text, spec.key)],
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

/** Arms (a) through (e), in TEST-SPEC's order. */
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
];

const T6_5_23 = defineProductTest({
  id: "T6.5-23",
  title:
    'statement boundaries, the directive prologue, and timeliness — arms (a) through (e), each a section move `move specs/origin.mdx#x specs/target.mdx#y` whose receiver `src/c.ts` (`import O from "../specs/origin.xspec"` beside `f` = `export function f() { O.x; O.w }`) gains exactly `import <X> from "../specs/target.xspec"`, value-blind in `<X>` alone, at an admissible offset, the marker rewritten in place to `<X>.y`, every other byte as staged: (a) after a `"use client"` prologue at the start of line 2 or 3, never offset 0, and between two directives (`"use client"`, then `"use strict"; import O … // note`), no line start admissible, at offset 26, 27, 64, or 65; (b) under `// @ts-nocheck` and under `/// <reference lib="esnext" />` at the start of line 3, never above the directive; (c) at the start of line 2, before a `// @ts-expect-error` comment, never between it and the statement it governs, the file compiling clean under standard tooling before and after the move; (d) after a trailing `// note` mid-line at 37 or 38, and after U+00A0 or U+2028 at 37 alone (1.4\'s whitespace, 3\'s terminators); (e) after a `;` terminating `O`\'s declaration across a line at the start of line 3, never inside the declaration, and in 6.5\'s own shape (one call statement across two lines) at one of six mid-line offsets, never at the start of line 3 — each move exiting 0, the result text TypeScript 5.9.3 accepts both as module code and as script code, the preview\'s one `import-addition` at the offset the real operation used (T6.6-4(b)), and `check` and `build` clean after it (SPEC 6.5, 1.4, 3, 6.4, 6.6, 12.7, 14.20)',
  timeoutMs: 300_000,
  run: async (product) => {
    const failures: string[] = [];
    for (const arm of S23_ARMS) {
      try {
        await runS23Arm(product, arm);
      } catch (error) {
        if (!(error instanceof HarnessAssertionError)) throw error;
        failures.push(error.message);
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
