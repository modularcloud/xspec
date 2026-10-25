// TEST-SPEC §6.5 (move), sixth part — SUITE-25 (continued): T6.5-24, nested
// bindings: visibility and wholly-between timeliness; T6.5-25, a TypeScript
// declaration standing as another statement's body stays; and T6.5-26,
// TypeScript removal extents: decorators and modifiers, and what a removal
// leaves. T6.5-1 … T6.5-10 are section-6.5.ts's business, T6.5-11
// section-6.5-ii.ts's, T6.5-12 … T6.5-19 section-6.5-iii.ts's, T6.5-20 …
// T6.5-22 section-6.5-iv.ts's, and T6.5-23 section-6.5-v.ts's; this module
// keeps that file's edits bounded (the section-10.7-i/-ii precedent).
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), decodes output through the H-3 adapters,
// and rejects a product only via diagnosed assertion failures (H-8).
//
// SPEC 6.5 (the reference rewrite, added imports): a binding the file already
// holds is eligible for a spelling — a chain's default binding and a call's
// `text` binding alike, a spelling being a chain or a call's callee — only
// where its identifier, spelled at the occurrence, resolves to it there
// (2.4): it is visible there, a nested import's binding visible only within
// the import's own scope (4.5), and no local declaration shadows it; and, in
// a TypeScript source, only where it is timely — declared at or before the
// binding the spelling was rooted at, or after it with no top-level
// statement between them but import declarations — a top-level statement
// standing between two declarations exactly when it lies wholly after the
// one and before the other, never one enclosing either, such as the
// function or namespace holding a nested import. Where no held binding is
// eligible, a declaration is added at an admissible offset, binding an
// identifier bound by no declaration already in the file, in any scope; an
// import whose bindings lose their last use is removed with the lines its
// deletion leaves empty or whitespace-only (3). A rooted spelling's edge is
// attributed to the innermost named code unit enclosing it, or to the file
// where none does (4.6).
//
// T6.5-24's conservative operationalizations (noted per H-4 — wording is
// free, so only the stated observables are asserted):
// - Each arm is an `S23Arm` run by section-6.5-v.ts's `runS23Arms`, T6.5-23's
//   machinery: one fresh workspace per arm (H-1), every file a staged-source
//   record (S-9's timing clause: every arm's workspace past the body's first
//   is created after a product invocation) — T6.5-23's configuration (one
//   spec group `specs/**/*.mdx`, one code group `src/**/*.ts`, emission
//   disabled), `specs/origin.mdx` holding `x` and `w` (in (c) `x` alone, a
//   record of its own), and `specs/target.mdx` holding `z`, the same
//   records, beside the arm's `src/c.ts`, TEST-SPEC's text exactly, each
//   line ended by U+000A — under TEST-SPEC's `move specs/origin.mdx#x
//   specs/target.mdx#y`.
// - Per arm: `build --json` clean over the staging (the premise: the
//   workspace valid before the move, its nested import declarations
//   well-formed, never 14.20, as T14-12 places that assertion here); the
//   `--preview --json` twin taken first (a preview modifies nothing, 6.6);
//   the real move with `--json`, exit 0 and the form-exact 12.7
//   performed-operation document; `src/c.ts` after it a plain file of valid
//   UTF-8 that TypeScript 5.9.3 accepts both as module code and as script
//   code (S-9's judge, `judgeTypeScript`, held as an assertion on the
//   product's bytes); `query edges` for each of the arm's edges; then
//   `check --json` and `build --json`, each exactly `{"findings": []}`.
// - Arms (a), (f), (g), and (h) re-root the moved spelling at a held nested
//   binding and add nothing: T6.5-22(a)'s judgement reads no added
//   declaration, and the file is exactly the staged bytes with the
//   spelling's span replaced — byte-composable exactly, no other byte
//   changed — the span computed from the staged bytes and checked at module
//   load against TEST-SPEC's ([102, 105), [168, 174), [120, 123), and
//   [94, 97)), a mismatch a harness defect thrown at load, never a product
//   verdict. The preview's entry for `src/c.ts` holds exactly one
//   `reference-rewrite`, spanning it, no `import-addition` or
//   `import-removal`, and no edit of any other class — TEST-SPEC's "exactly
//   those listed", every arm's preview expectation `exact`
//   (section-6.5-v.ts's `S23PreviewExpectation`), asserted after the
//   listed classes. `query edges --from <unit> --to specs/target.mdx#y
//   --kinds <kind>` answers exactly the spelling's edge: the marker's
//   `references` edge from `src/c.ts#f` ((a)), from `src/c.ts#f.h` ((g):
//   the arrow function `h` in `f`, a named unit, 4.6), or from `src/c.ts#N`
//   ((h)); the call's `embeds` edge from `src/c.ts#g` ((f)).
// - Arms (b) through (e) find no held binding eligible and gain one
//   declaration of the target module: the file is exactly the staged bytes
//   composed in pre-operation coordinates (6.6) — the spelling's span
//   replaced by `<X>.y` (in (e) the call's by `<Y>(T.y)`), in (c) `O`'s
//   nested declaration removed with its line, a rewrite spelled `""` over
//   TEST-SPEC's [22, 62) (T6.5-23 (h)'s expression of a removal), and the
//   declaration inserted under 6.5's line discipline at an admissible
//   offset TEST-SPEC names: 38 in (b) and (d), 70 in (c), 53 or 91 in (e)
//   (6.5's latitude between those two). It is value-blind in the
//   identifier alone, read from the one declaration the file gained, and
//   byte-exact in every other character (T6.5-8's discipline). The
//   identifier is judged by T6.5-22(a)'s judgement (with the subprocess
//   driver's hook, one code path), whose S-6 name analysis of the
//   pre-operation file counts every declaration in any scope, so the
//   nested `T` and `tt` bar those names: TEST-SPEC's "never `T`" and "never
//   `tt`". (b), (c), and (d) add exactly `import <X> from
//   "../specs/target.xspec"`; (e) adds exactly `import { text as <Y> } from
//   "../specs/target.xspec"`, or `import { text } from …` where the fresh
//   identifier is `text` itself, with no default binding (an
//   `S23Spelling`). The preview's entry for `src/c.ts` holds exactly one
//   `reference-rewrite`, spanning the spelling ([38, 41), [64, 67),
//   [114, 117), [91, 97)), the one `import-addition` zero-length at the
//   offset the bytes name (T6.6-4(b)), exactly the `import-removal` edits
//   listed — (c)'s [22, 62), none elsewhere — and no edit of any other
//   class (`exact`, as for the held arms). `query edges` answers
//   each listed edge exactly: the marker's `references` edge to
//   `specs/target.mdx#y` from `src/c.ts` ((b): a top-level statement's
//   spelling is attributed to the file, 4.6) or from `src/c.ts#f` ((c),
//   (d)), with, in (b), `T.z`'s from `src/c.ts#f` to `specs/target.mdx#z`;
//   in (e), the call's `embeds` edge from `src/c.ts` and `tt(T.z)`'s from
//   `src/c.ts#g` to `specs/target.mdx#z`. Those kept spellings' edges are
//   asserted after the move: "as before the move", the premise build having
//   found the staging valid.
// - At module load each pinned construct is checked against the staged
//   bytes — the spelling's span, (d)'s `const q = 1` at [38, 49), (c)'s
//   nested declaration's own characters at [24, 61) and its line, the
//   removal's [22, 62), holding nothing else but its two-space indentation
//   and its terminator, and each admissible offset as the start of the line
//   TEST-SPEC names — and each admissible offset's form, composed with a
//   placeholder identifier (in (e) with `text` too), is checked equal to the
//   text TEST-SPEC spells for the file: a mismatch is a harness defect
//   thrown at load, never a product verdict.
// - Before any product is driven on an arm, the staged text and the form
//   the rewrite alone composes — or, where a declaration is added, each
//   admissible offset's composed form, a placeholder in the identifier's
//   place — are held to the same TypeScript judge (S-9: a form it rejects is
//   a harness defect, never a product verdict).
// - None is compiled under H-2's channel: TypeScript's checker rejects a
//   nested import declaration after parsing (T4.5-10), so each arm observes
//   xspec's surfaces alone.
// - Every arm runs; each one's diagnosed failure is collected and the body
//   fails once at the end, naming every arm that failed, so one product
//   failure hides no other arm's verdict. A harness error — anything but a
//   diagnosed assertion failure, a hang included — propagates at once.
//
// SPEC 6.5 (Import edits): in a TypeScript source an import declaration
// standing as another statement's body, where TypeScript's parser admits one
// (14.20) — either branch of an `if` statement, or the body of a `do`,
// `while`, `for`, `for…in`, `for…of`, `with`, or labeled statement — stays,
// its bindings unused and no removal reported for it (6.6), since its
// deletion would leave that statement no body.
//
// T6.5-25's conservative operationalizations (noted per H-4):
// - Its ten arms are `S23Arm`s run by `runS23Arms`, as T6.5-24's are: one
//   fresh workspace per arm (H-1) of records — T6.5-23's configuration and
//   target (`specs/target.mdx` holding `z`), `specs/origin.mdx` holding `x`
//   alone (TEST-SPEC: holding `x`; a record of this test's own), and the
//   arm's `src/c.ts`, TEST-SPEC's text exactly, each line ended by U+000A —
//   under TEST-SPEC's `move specs/origin.mdx#x specs/target.mdx#y`. Nine
//   top-level arms (`s25TopLevelArm`) stage one statement each, holding
//   `import O from "../specs/origin.xspec"` as its body, above `O.x`; the
//   tenth, `(nested)`, stages `export function f() {`, `  if (c) import O
//   from "../specs/origin.xspec"`, `  O.x`, `}`.
// - Before the move (the arm's `before`, asserted after the premise `build
//   --json` clean and before the preview): `check --json` exactly
//   `{"findings": []}` — the statement-body declaration well-formed, never
//   14.20, as T14-12 places that assertion here — and `query edges --from
//   <unit> --to specs/origin.mdx#x --kinds references` exactly the marker's
//   edge, the marker rooted at the declaration, which binds in the file's
//   scope, or in `f`'s (4.5): from `src/c.ts` (a top-level spelling is
//   attributed to the file, 4.6), in the nested arm from `src/c.ts#f`.
// - After it, as for T6.5-24's arms gaining a declaration: exit 0 and the
//   form-exact 12.7 document; `src/c.ts` well-formed under S-9's judge and
//   exactly the staged bytes composed in pre-operation coordinates (6.6) —
//   the marker's span replaced by `<X>.y` and `import <X> from
//   "../specs/target.xspec"` inserted under 6.5's line discipline at the one
//   admissible offset TEST-SPEC names, the start of line 2 (in the nested
//   arm the file's end, 77) — so the declaration stays in place
//   byte-for-byte and nothing else changes; value-blind in `<X>` alone, read
//   from the one declaration the file gained (T6.5-22(a)'s judgement reads
//   top-level declarations alone, so the kept one is never read as added)
//   and judged by T6.5-22(a)'s judgement, which bars `O`. The preview's entry
//   for `src/c.ts` holds exactly one `reference-rewrite`, spanning the
//   marker, the one `import-addition`, zero-length at that offset
//   (T6.6-4(b)), no `import-removal`, and no edit of any other class
//   (`exact`, as for T6.5-24's arms: the byte contract pins every change to
//   the file to those edits, and SPEC 6.6 reports every edit the operation
//   makes, each under one class); `query edges` answers the marker's
//   `references` edge from the same unit to `specs/target.mdx#y`; then
//   `check --json` and `build --json` are clean. A product deleting the
//   declaration fails the byte contract — and, in the `do` arm, the
//   post-move well-formedness check too (`do  while (c)`, 14.20).
// - At module load each arm's pins are checked against the staged bytes:
//   the declaration's own characters once, inside its statement (TEST-SPEC's
//   [31, 68) in the nested arm), the marker once, at the start of line 2
//   (TEST-SPEC's [71, 74) in the nested arm, and its `}` at [75, 76), `f`'s
//   end 76), and the admissible offset as its line's start; the form
//   composed at that offset with a placeholder identifier is checked equal
//   to the text TEST-SPEC spells for the file (`s24AssertSpelledForms`), and
//   that text and the staged one are held to S-9's TypeScript judge,
//   `judgeTypeScript` (`s25AssertWellFormed`) — a mismatch a harness defect
//   thrown at load, never a product verdict. Before any product is driven on
//   an arm, `runS23Arm` judges its premises again.
// - None is compiled under H-2's channel: TypeScript's checker rejects a
//   nested import declaration after parsing (T4.5-10). Every arm runs, the
//   body failing once at the end, naming every arm that failed.
//
// SPEC 6.5 (Import edits): an import removal deletes the declaration's own
// characters in place — in a TypeScript source from its first decorator or
// modifier where it carries any (`@dec import …`, `export import …`,
// `declare import …`, which TypeScript's parser admits and only its
// post-parse grammar checks reject, 14.20), so that none is left to attach
// to what follows — and lines left empty or whitespace-only purely by that
// deletion are dropped with their line terminators (3). A removal changes
// nothing beyond that extent: the comments and statements around a removed
// TypeScript declaration stay as they stand, whatever they then mean to
// TypeScript.
//
// T6.5-26's conservative operationalizations (noted per H-4):
// - Its ten stagings are `S23Arm`s run by `runS23Arms`, as T6.5-24's and
//   T6.5-25's are: one fresh workspace per staging (H-1) of records —
//   T6.5-23's configuration and target (`specs/target.mdx` holding `z`),
//   `specs/origin.mdx` holding `x` alone (a record of this test's own), and
//   the staging's `src/c.ts`, TEST-SPEC's text exactly, each line ended by
//   U+000A — under TEST-SPEC's `move specs/origin.mdx#x specs/target.mdx#y`.
//   `src/c.ts` holds `import T from "../specs/target.xspec"`, visible,
//   unshadowed, and timely for the moved marker `O.x`, so the marker is
//   re-rooted to `T.y`, nothing is added, and `O`'s declaration, the marker
//   its only use, is removed (`s26Arm`).
// - Before the move: the premise `build --json` and, as the arm's `before`
//   (no edge listed), `check --json`, each exactly `{"findings": []}` — the
//   decorated, modified, and nested declarations well-formed, never 14.20,
//   as T14-12 places that assertion here.
// - After it, as for T6.5-24's held arms: exit 0 and the form-exact 12.7
//   document; `src/c.ts` well-formed under S-9's judge and exactly the
//   staged bytes with the removal's range deleted — a rewrite spelled `""`,
//   T6.5-23 (h)'s expression of a removal — and the marker's span replaced
//   by `T.y`: byte-composable exactly, no declaration added (T6.5-22(a)'s
//   judgement reads none), no other byte changed (T6.5-7's discipline). The
//   preview's entry for `src/c.ts` holds exactly one `reference-rewrite`,
//   spanning the marker, exactly one `import-removal`, spanning the
//   removal's range — from the first decorator or modifier (T6.6-4(b)) —
//   no `import-addition`, and no edit of any other class (`exact`, as for
//   T6.5-24's and T6.5-25's arms); `query edges` from `src/c.ts#f` to
//   `specs/target.mdx#y` of kind `references` answers exactly the marker's
//   edge (the marker stands in `f` in every staging, 4.6); then
//   `check --json` and `build --json` are clean.
// - At module load each staging's pins are checked against the staged
//   bytes: the declaration's own characters — from its first decorator or
//   modifier where it carries any — once, where TEST-SPEC places them, and
//   the removal's range, TEST-SPEC's, their line — its start through the
//   next line's — holding nothing else but indentation before them and the
//   line's U+000A after them (`s24RemovalRange`); the marker once, at the
//   offset the staged bytes give (`s24Span` — TEST-SPEC states none). The
//   form the removal and the rewrite compose (section-6.5-v.ts's
//   `s23RewrittenForm`, the bytes `runS23Arm` asserts) is checked equal to
//   the text TEST-SPEC spells for the file, and that text and the staged one
//   are held to S-9's TypeScript judge (`s25AssertWellFormed`) — a mismatch
//   a harness defect thrown at load, never a product verdict. Before any
//   product is driven on a staging, `runS23Arm` judges its premises again.
// - None is compiled under H-2's channel: TypeScript's checker rejects the
//   decorators and modifiers of (a) through (c), (g), and (h) and the
//   nested declarations of (f) and (h), and (d) and (e) assert bytes alone.
//   Every staging runs, the body failing once at the end, naming every
//   staging that failed.
// - T6.6-4(b)'s clause that an `import-removal` spans a TypeScript
//   declaration from its first decorator or modifier where it carries any
//   is pinned by these previews; T6.6-4's own stagings (section-6.6.ts) hold
//   no decorated or modified declaration — its arm (b) removes a spec
//   source's import — so its body needs no change.

import { Buffer } from "node:buffer";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { type StagedMdx, stagedMdx } from "../../helpers/staged-mdx.js";
import { type StagedTs, stagedTs } from "../../helpers/staged-ts.js";
import { judgeTypeScript } from "../../helpers/ts-derivability.js";
import {
  runS23Arms,
  s23ComposedForm,
  s23RewrittenForm,
  type S23Arm,
  type S23Edge,
  type S23Span,
  type S23Spelling,
  S23_APP,
  S23_ARGV,
  S23_CONFIG,
  S23_IMPORT_O,
  S23_ORIGIN,
  S23_ORIGIN_SOURCE,
  S23_TARGET,
  S23_TARGET_SOURCE,
  S23_TARGET_SPECIFIER,
} from "./section-6.5-v.js";

// ---------------------------------------------------------------------------
// T6.5-24 Nested bindings: visibility and wholly-between timeliness
// ---------------------------------------------------------------------------

/** The moved node's identity after the move. */
const S24_MOVED = "specs/target.mdx#y";

/** The kept node `T.z` and `tt(T.z)` designate in (b) and (e). */
const S24_KEPT = "specs/target.mdx#z";

/** `T`'s declaration of the target module, nested two spaces deep in the
 * function or namespace holding it ((a), (b), (d), (g), (h)). */
const S24_NESTED_IMPORT_T = '  import T from "../specs/target.xspec"';

/** The origin module's declaration binding its default and its `text` as
 * `t` ((e), (f)). */
const S24_IMPORT_O_T = 'import O, { text as t } from "../specs/origin.xspec"';

/** `T`'s top-level declaration of the target module ((e), (f)). */
const S24_IMPORT_T = 'import T from "../specs/target.xspec"';

/** `tt`'s declaration of the target module's `text`, nested in `g` ((e),
 * (f)). */
const S24_NESTED_IMPORT_TT =
  '  import { text as tt } from "../specs/target.xspec"';

/** A placeholder identifier the module-load self-checks compose with. */
const S24_PLACEHOLDER = "X";

// (c)'s origin: the moved section `x` alone, so that no use of `O` remains
// after the move and its declaration is removed.
const S24_ORIGIN_X_ALONE: StagedMdx = stagedMdx(
  "T6.5-24 (c) specs/origin.mdx (the moved x alone)",
  ['<S id="x">', "Origin x text.", "</S>", ""].join("\n"),
);

/** A staged `src/c.ts` of T6.5-24 (S-9's record, declared well-formed
 * TypeScript). */
function s24StagedApp(key: string, text: string): StagedTs {
  return stagedTs(`T6.5-24 ${key} ${S23_APP}`, text, "well-formed", "ts");
}

/**
 * The byte span of `spelling` in `text` (UTF-8), TEST-SPEC's `stated` one: a
 * harness defect, thrown at module load, unless the spelling occurs exactly
 * once in the staged text, there. `test` names the registered test in the
 * error (T6.5-25's and T6.5-26's pins share this), and `whose` the stated
 * span's source (T6.5-26's markers: the staged bytes', TEST-SPEC stating
 * none).
 */
function s24Span(
  key: string,
  text: string,
  spelling: string,
  stated: S23Span,
  test = "T6.5-24",
  whose = "TEST-SPEC's",
): S23Span {
  const bytes = Buffer.from(text, "utf8");
  const start = bytes.indexOf(spelling);
  const last = bytes.lastIndexOf(spelling);
  const end = start + Buffer.byteLength(spelling, "utf8");
  if (
    start < 0 ||
    last !== start ||
    start !== stated.start ||
    end !== stated.end
  ) {
    throw new Error(
      `${test} ${key}: a harness defect — the staged ${S23_APP} must hold ` +
        `\`${spelling}\` exactly once, at ${whose} ` +
        `[${String(stated.start)}, ${String(stated.end)}); it is found ` +
        (start < 0
          ? "nowhere"
          : `first at ${String(start)} and last at ${String(last)}`),
    );
  }
  return { start, end };
}

/** Each line's start in `lines` joined by U+000A with a final U+000A, then
 * the file's end, in bytes. */
function s24Starts(lines: readonly string[]): readonly number[] {
  const starts: number[] = [];
  let offset = 0;
  for (const line of lines) {
    starts.push(offset);
    offset += Buffer.byteLength(line, "utf8") + 1;
  }
  starts.push(offset);
  return starts;
}

/** `actual`, failing as a harness defect at module load unless it is
 * TEST-SPEC's `stated` offset of `what` — `test` naming the registered test
 * in the error (T6.5-25's pins share this). */
function s24Stated(
  key: string,
  what: string,
  actual: number | undefined,
  stated: number,
  test = "T6.5-24",
): number {
  if (actual !== stated) {
    throw new Error(
      `${test} ${key}: a harness defect — ${what} lies at ` +
        `${String(actual)} in the staged text, not at TEST-SPEC's ` +
        String(stated),
    );
  }
  return stated;
}

/** The moved marker's `references` edge after the move, from `from`, the
 * named unit holding it (4.6). */
function s24MarkerEdge(from: string): S23Edge {
  return {
    from,
    to: S24_MOVED,
    kind: "references",
    what: "the moved marker",
  };
}

/**
 * An arm re-rooting the moved spelling at a held nested binding, nothing
 * added ((a), (f), (g), and (h)), at module load: its `src/c.ts` record —
 * `lines`, each ended by U+000A — beside T6.5-23's configuration and spec
 * sources, under T6.5-23's move; the spelling's span (TEST-SPEC's,
 * cross-checked) replaced by `rewritten`; the preview's one
 * `reference-rewrite` spanning it and no `import-removal` (and no
 * `import-addition`, which `runS23Arm` asserts wherever nothing is added),
 * the expectation `exact` — no edit of any other class; and the spelling's
 * edge after the move.
 */
function s24HeldArm(spec: {
  readonly key: string;
  readonly lines: readonly string[];
  readonly spelling: string;
  readonly span: S23Span;
  readonly rewritten: string;
  readonly edge: S23Edge;
  readonly placement: string;
}): S23Arm {
  const text = [...spec.lines, ""].join("\n");
  const span = s24Span(spec.key, text, spec.spelling, spec.span);
  return {
    test: "T6.5-24",
    key: spec.key,
    receiver: S23_APP,
    kind: "typescript",
    text,
    staged: s24StagedApp(spec.key, text),
    files: {
      "xspec.config.ts": S23_CONFIG,
      [S23_ORIGIN]: S23_ORIGIN_SOURCE,
      [S23_TARGET]: S23_TARGET_SOURCE,
    },
    argv: S23_ARGV,
    rewrites: [{ ...span, spelled: () => spec.rewritten }],
    addition: undefined,
    placement: spec.placement,
    excluded: {},
    preview: { rewrites: [span], removals: [], exact: true },
    edges: [spec.edge],
  };
}

/** An admissible offset TEST-SPEC names for an added declaration: the start
 * of line `line` of the staged text. */
interface S24Offset {
  readonly line: number;
  readonly offset: number;
}

/** A removal TEST-SPEC states ((c), and each of T6.5-26's stagings): the
 * declaration `declaration`, its own characters at `own` on line `line`,
 * removed with that line — `range`. */
interface S24Removal {
  readonly declaration: string;
  readonly own: S23Span;
  readonly line: number;
  readonly range: S23Span;
}

/**
 * The removal's range, TEST-SPEC's `range`: a harness defect, thrown at
 * module load, unless the declaration's own characters occur once, at
 * `own`, and `range` is their line — its start through the next line's —
 * holding nothing else but indentation before them and the line's U+000A
 * after them, the whitespace-only line their deletion leaves (6.5, 3).
 * `test` names the registered test in the error (T6.5-26's removals share
 * this).
 */
function s24RemovalRange(
  key: string,
  text: string,
  starts: readonly number[],
  removal: S24Removal,
  test = "T6.5-24",
): S23Span {
  const own = s24Span(key, text, removal.declaration, removal.own, test);
  const start = s24Stated(
    key,
    `the start of line ${String(removal.line)}, the removal's start`,
    starts[removal.line - 1],
    removal.range.start,
    test,
  );
  const end = s24Stated(
    key,
    `the start of line ${String(removal.line + 1)}, the removal's end`,
    starts[removal.line],
    removal.range.end,
    test,
  );
  const bytes = Buffer.from(text, "utf8");
  const indentation = bytes.subarray(start, own.start).toString("utf8");
  const rest = bytes.subarray(own.end, end).toString("utf8");
  if (!/^[ \t]*$/.test(indentation) || rest !== "\n") {
    throw new Error(
      `${test} ${key}: a harness defect — the removal's range ` +
        `[${String(start)}, ${String(end)}) must hold the declaration's own ` +
        `characters [${String(own.start)}, ${String(own.end)}), indentation ` +
        `before them and the line's U+000A after them alone; it holds ` +
        `${JSON.stringify(indentation)} before and ${JSON.stringify(rest)} after`,
    );
  }
  return { start, end };
}

/**
 * The module-load self-check of an arm gaining a declaration (T6.5-24's or
 * T6.5-25's, its `test` naming it in the error): at each admissible offset,
 * the form `s23ComposedForm` composes — with the placeholder identifier and
 * every identifier the declaration's spelling treats apart — is exactly the
 * text TEST-SPEC spells for the file, `spelledForm`'s lines each ended by
 * U+000A; a harness defect otherwise.
 */
function s24AssertSpelledForms(
  arm: S23Arm,
  offsets: readonly number[],
  spelledForm: (ident: string, offset: number) => readonly string[],
): void {
  const idents = [S24_PLACEHOLDER, ...(arm.addition?.spelled?.also ?? [])];
  for (const ident of idents) {
    for (const offset of offsets) {
      const composed = s23ComposedForm(arm, ident, offset);
      const spelled = Buffer.from(
        [...spelledForm(ident, offset), ""].join("\n"),
        "utf8",
      );
      if (composed === undefined || Buffer.compare(composed, spelled) !== 0) {
        throw new Error(
          `${arm.test} ${arm.key}: a harness defect — the form composed at ` +
            `offset ${String(offset)} with the identifier \`${ident}\` ` +
            `must be the text TEST-SPEC spells, ` +
            `${JSON.stringify(spelled.toString("utf8"))}; it is ` +
            (composed === undefined
              ? "none, the offset lying inside a replaced span"
              : JSON.stringify(composed.toString("utf8"))),
        );
      }
    }
  }
}

/**
 * An arm whose `src/c.ts` gains a declaration of the target module ((b)
 * through (e)), at module load: its record — `lines`, each ended by U+000A
 * — beside T6.5-23's configuration, the origin (`origin`, else T6.5-23's
 * `x` and `w`), and T6.5-23's target, under T6.5-23's move; the spelling's
 * span (TEST-SPEC's, cross-checked) rewritten as `rewritten` spells it for
 * the added binding's identifier; `removal`, where given, a rewrite spelled
 * `""` over TEST-SPEC's range (cross-checked); the declaration —
 * `import <X> from "../specs/target.xspec"`, or as `spelled` spells it — at
 * TEST-SPEC's admissible offsets, each cross-checked as its line's start;
 * the preview's one `reference-rewrite` spanning the spelling and exactly
 * the listed `import-removal` (the `import-addition` parity `runS23Arm`
 * asserts wherever a declaration is added), the expectation `exact` — no
 * edit of any other class; and the edges after the move.
 * Each admissible offset's composed form is held to TEST-SPEC's spelling of
 * the file (`s24AssertSpelledForms`).
 */
function s24AddedArm(spec: {
  readonly key: string;
  readonly lines: readonly string[];
  readonly origin?: StagedMdx;
  readonly spelling: string;
  readonly span: S23Span;
  readonly rewritten: (ident: string) => string;
  readonly pinned?: readonly {
    readonly spelling: string;
    readonly span: S23Span;
  }[];
  readonly removal?: S24Removal;
  readonly spelled?: S23Spelling;
  readonly offsets: readonly S24Offset[];
  readonly why: string;
  readonly placement: string;
  readonly excluded: Readonly<Record<number, string>>;
  readonly edges: readonly S23Edge[];
  readonly spelledForm: (ident: string, offset: number) => readonly string[];
}): S23Arm {
  const text = [...spec.lines, ""].join("\n");
  const span = s24Span(spec.key, text, spec.spelling, spec.span);
  for (const pin of spec.pinned ?? []) {
    s24Span(spec.key, text, pin.spelling, pin.span);
  }
  const starts = s24Starts(spec.lines);
  const offsets = spec.offsets.map(({ line, offset }) =>
    s24Stated(
      spec.key,
      `the start of line ${String(line)}, an admissible offset`,
      starts[line - 1],
      offset,
    ),
  );
  const removal =
    spec.removal === undefined
      ? undefined
      : s24RemovalRange(spec.key, text, starts, spec.removal);
  const arm: S23Arm = {
    test: "T6.5-24",
    key: spec.key,
    receiver: S23_APP,
    kind: "typescript",
    text,
    staged: s24StagedApp(spec.key, text),
    files: {
      "xspec.config.ts": S23_CONFIG,
      [S23_ORIGIN]: spec.origin ?? S23_ORIGIN_SOURCE,
      [S23_TARGET]: S23_TARGET_SOURCE,
    },
    argv: S23_ARGV,
    rewrites: [
      ...(removal === undefined ? [] : [{ ...removal, spelled: () => "" }]),
      { ...span, spelled: spec.rewritten },
    ],
    addition: {
      specifier: S23_TARGET_SPECIFIER,
      ...(spec.spelled === undefined ? {} : { spelled: spec.spelled }),
      offsets,
      why: spec.why,
    },
    placement: spec.placement,
    excluded: spec.excluded,
    preview: {
      rewrites: [span],
      removals: removal === undefined ? [] : [removal],
      exact: true,
    },
    edges: spec.edges,
  };
  s24AssertSpelledForms(arm, offsets, spec.spelledForm);
  return arm;
}

/** Why offset 0 is excluded: no statement's end precedes it (6.5). */
const S24_NO_STATEMENT_BEFORE =
  "offset 0 — no statement's end precedes it (6.5)";

/** Why a mid-line admissible offset loses to the line-start one. */
function s24MidLine(where: string, lineStart: string): string {
  return (
    `${where} — admissible, but mid-line, while ${lineStart} is ` +
    "admissible, taken over any other (6.5's preference)"
  );
}

/** Why an offset is excluded as untimely: `between` lies wholly between the
 * declaration of the binding the spelling was rooted at and it. */
function s24Untimely(where: string, between: string): string {
  return (
    `${where} — untimely, ${between} lying wholly between it and the ` +
    "declaration of the binding the spelling was rooted at (6.5: an added " +
    "binding is declared at or before that binding, or after it with no " +
    "top-level statement between them but import declarations)"
  );
}

/** Why an offset inside a function's body is excluded. */
function s24Inside(where: string, unit: string, more = ""): string {
  return (
    `${where} — inside the statement \`${unit}\`, where a declaration is ` +
    `no top-level one (6.5; T6.5-23(n))${more}`
  );
}

// (a) a held nested binding, visible and timely.
const S24_A = s24HeldArm({
  key: "(a)",
  lines: [
    S23_IMPORT_O,
    "export function f() {",
    S24_NESTED_IMPORT_T,
    "  O.x",
    "  O.w",
    "  T.z",
    "}",
  ],
  spelling: "O.x",
  span: { start: 102, end: 105 },
  rewritten: "T.y",
  edge: s24MarkerEdge(`${S23_APP}#f`),
  placement:
    "`T`, the nested import's binding of the target module, is visible at " +
    "the marker `O.x`, both standing in `f`'s scope (4.5), and timely — its " +
    "declaration follows `O`'s with no top-level statement wholly between " +
    "them, `f` enclosing it (6.5) — so the marker is re-rooted to `T.y` and " +
    "nothing is added, `O`'s declaration staying, kept by `O.w`; a product " +
    "ignoring nested bindings, or counting the enclosing `f` as standing " +
    'between, adds `import <X> from "../specs/target.xspec"` at the start ' +
    "of line 2 and writes `<X>.y`",
});

// (b) the same binding invisible to a spelling outside its scope.
const S24_B = s24AddedArm({
  key: "(b)",
  lines: [
    S23_IMPORT_O,
    "O.x",
    "O.w",
    "export function f() {",
    S24_NESTED_IMPORT_T,
    "  T.z",
    "}",
  ],
  spelling: "O.x",
  span: { start: 38, end: 41 },
  rewritten: (ident) => `${ident}.y`,
  offsets: [{ line: 2, offset: 38 }],
  why:
    "`T`'s scope is `f`'s (4.5: a nested import's binding is visible only " +
    "within its own scope), so `T` is ineligible for the top-level marker " +
    "`O.x`, and the file holds no other binding of the target module, so " +
    "one declaration of it is added, binding `<X>`, never `T` (bound by a " +
    "declaration already in the file, in `f`'s scope); `O` keeps its use " +
    "by `O.w`",
  placement:
    "the start of line 2, offset 38, the only line-start admissible offset " +
    "— the end of line 1, admissible too, is mid-line, and every later " +
    "offset is untimely, `O.x` standing between — the marker becoming " +
    "`<X>.y`, and `O.w`, `f`, and `f`'s body unchanged; a product picking a " +
    "held binding by module or by name alone writes `T.y` at top level, " +
    "rooted at nothing there (T4.5-10(c)), and one binding `T` at top " +
    "level makes the pair 14.15 reports, whatever scope each declares it " +
    "in (T4.5-10(d))",
  excluded: {
    0: S24_NO_STATEMENT_BEFORE,
    37: s24MidLine(
      "the end of line 1, `O`'s declaration's end",
      "the start of line 2",
    ),
    41: s24Untimely("the end of `O.x`", "the statement `O.x`"),
    42: s24Untimely("the start of line 3", "the statement `O.x`"),
    46: s24Untimely("the start of line 4", "the statements `O.x` and `O.w`"),
    68: s24Inside(
      "the start of line 5",
      "f",
      ", and untimely besides, `O.x` and `O.w` standing between",
    ),
    108: s24Inside(
      "the start of line 6",
      "f",
      ", and untimely besides, `O.x` and `O.w` standing between",
    ),
    114: s24Inside(
      "the start of line 7",
      "f",
      ", and untimely besides, `O.x` and `O.w` standing between",
    ),
    116: s24Untimely("the file's end", "the statements `O.x`, `O.w`, and `f`"),
  },
  edges: [
    s24MarkerEdge(S23_APP),
    {
      from: `${S23_APP}#f`,
      to: S24_KEPT,
      kind: "references",
      what: "the kept spelling `T.z`",
    },
  ],
  spelledForm: (ident) => [
    'import O from "../specs/origin.xspec"',
    `import ${ident} from "../specs/target.xspec"`,
    `${ident}.y`,
    "O.w",
    "export function f() {",
    '  import T from "../specs/target.xspec"',
    "  T.z",
    "}",
  ],
});

// (c) an added declaration timely directly after the function holding the
// replaced nested binding, that binding's declaration removed with its line.
const S24_C = s24AddedArm({
  key: "(c)",
  lines: [
    "export function f() {",
    `  ${S23_IMPORT_O}`,
    "  O.x",
    "}",
    "export const k = 1",
  ],
  origin: S24_ORIGIN_X_ALONE,
  spelling: "O.x",
  span: { start: 64, end: 67 },
  rewritten: (ident) => `${ident}.y`,
  removal: {
    declaration: S23_IMPORT_O,
    own: { start: 24, end: 61 },
    line: 2,
    range: { start: 22, end: 62 },
  },
  offsets: [{ line: 5, offset: 70 }],
  why:
    "the marker is rooted at the nested `O`, and the file holds no binding " +
    "of the target module, so one declaration of it is added; `O`'s " +
    "declaration, its last use gone, is removed from `f`'s body with its " +
    "line — its own characters [24, 61) deleted and the line they leave " +
    "holding two spaces dropped with its terminator, [22, 62) (6.5, 3)",
  placement:
    "the start of line 5, offset 70, the only line-start admissible offset " +
    "— every offset inside `f` lies inside a statement, a declaration there " +
    "being no top-level one (T6.5-23(n)); offset 70 follows `f`'s end and " +
    "is timely, `f` enclosing `O`'s declaration and so not standing between " +
    "it and the added one (6.5), while every later offset is untimely, " +
    "`export const k = 1` lying wholly between them; `f`'s end, 69, " +
    "admissible too, is mid-line — the marker becoming `<X>.y`; a product " +
    "counting the enclosing `f` as standing between finds no admissible " +
    "offset and refuses the move (`refused-invalid-rewrite`), one placing " +
    "the declaration inside `f`'s body or after `export const k = 1` fails " +
    "the byte contract, and so does one deleting the nested declaration's " +
    "own characters alone, which leaves the two-space line behind",
  excluded: {
    0:
      "offset 0 — `f` is the file's first statement, so no statement's end " +
      "precedes it (6.5)",
    22: s24Inside(
      "the start of line 2, the removal's start",
      "f",
      ": a product placing the declaration in `f`'s body fails",
    ),
    62: s24Inside(
      "the start of line 3, the removal's end",
      "f",
      ": a product placing the declaration in `f`'s body fails",
    ),
    68: s24Inside("the start of line 4", "f"),
    69: s24MidLine("`f`'s end, 69", "the start of line 5"),
    88: s24Untimely(
      "the end of `export const k = 1`",
      "the statement `export const k = 1`",
    ),
    89: s24Untimely("the file's end", "the statement `export const k = 1`"),
  },
  edges: [s24MarkerEdge(`${S23_APP}#f`)],
  spelledForm: (ident) => [
    "export function f() {",
    `  ${ident}.y`,
    "}",
    `import ${ident} from "../specs/target.xspec"`,
    "export const k = 1",
  ],
});

// (d) a held nested binding, visible but untimely: a top-level statement
// lying wholly between the replaced binding's declaration and the held
// one's.
const S24_D = s24AddedArm({
  key: "(d)",
  lines: [
    S23_IMPORT_O,
    "const q = 1",
    "export function f() {",
    S24_NESTED_IMPORT_T,
    "  O.x",
    "  O.w",
    "  T.z",
    "}",
  ],
  spelling: "O.x",
  span: { start: 114, end: 117 },
  rewritten: (ident) => `${ident}.y`,
  pinned: [{ spelling: "const q = 1", span: { start: 38, end: 49 } }],
  offsets: [{ line: 2, offset: 38 }],
  why:
    "`T` is visible at the marker `O.x`, both standing in `f`'s scope, but " +
    "untimely — the statement `const q = 1`, [38, 49), lies wholly after " +
    "`O`'s declaration and before `T`'s (6.5) — so `T` is ineligible, and " +
    "the file holds no other binding of the target module, so one " +
    "declaration of it is added, binding `<X>`, never `T`; `O` keeps its " +
    "use by `O.w`",
  placement:
    "the start of line 2, offset 38, the only line-start admissible offset " +
    "— the end of line 1, admissible too, is mid-line; the start of line 3 " +
    "and every later offset outside `f` are untimely, `const q = 1` " +
    "standing between, and every offset inside `f` lies inside a statement " +
    "(T6.5-23(n)) — `const q = 1` staying below the added line and the " +
    "marker's span [114, 117) becoming `<X>.y`, every other byte unchanged; " +
    "a product judging timeliness for top-level held bindings alone " +
    "re-roots the marker to `T.y` and adds nothing",
  excluded: {
    0: S24_NO_STATEMENT_BEFORE,
    37: s24MidLine(
      "the end of line 1, `O`'s declaration's end",
      "the start of line 2",
    ),
    49: s24Untimely("the end of `const q = 1`", "the statement `const q = 1`"),
    50: s24Untimely("the start of line 3", "the statement `const q = 1`"),
    72: s24Inside("the start of line 4", "f"),
    112: s24Inside("the start of line 5", "f"),
    118: s24Inside("the start of line 6", "f"),
    124: s24Inside("the start of line 7", "f"),
    130: s24Inside("the start of line 8", "f"),
    132: s24Untimely("the file's end", "the statements `const q = 1` and `f`"),
  },
  edges: [s24MarkerEdge(`${S23_APP}#f`)],
  spelledForm: (ident) => [
    'import O from "../specs/origin.xspec"',
    `import ${ident} from "../specs/target.xspec"`,
    "const q = 1",
    "export function f() {",
    '  import T from "../specs/target.xspec"',
    `  ${ident}.y`,
    "  O.w",
    "  T.z",
    "}",
  ],
});

/** (e)'s added declaration: the target module's `text` alone (6.5's
 * spellings), with no default binding. */
const S24_TEXT_SPELLING: S23Spelling = {
  declaration: (ident) =>
    ident === "text"
      ? `import { text } from "${S23_TARGET_SPECIFIER}"`
      : `import { text as ${ident} } from "${S23_TARGET_SPECIFIER}"`,
  form:
    `\`import { text as <Y> } from "${S23_TARGET_SPECIFIER}"\`, or ` +
    `\`import { text } from "${S23_TARGET_SPECIFIER}"\` where the fresh ` +
    "identifier is `text` itself, binding the target module's `text` " +
    "alone — no default binding",
  also: ["text"],
};

// (e) visibility on the callee side: a nested `text` binding invisible at
// the call.
const S24_E = s24AddedArm({
  key: "(e)",
  lines: [
    S24_IMPORT_O_T,
    S24_IMPORT_T,
    "t(O.x)",
    "O.w",
    "export function g() {",
    S24_NESTED_IMPORT_TT,
    "  tt(T.z)",
    "}",
  ],
  spelling: "t(O.x)",
  span: { start: 91, end: 97 },
  rewritten: (ident) => `${ident}(T.y)`,
  spelled: S24_TEXT_SPELLING,
  offsets: [
    { line: 2, offset: 53 },
    { line: 3, offset: 91 },
  ],
  why:
    "the call, its target carried into the target module, is rewritten " +
    "whole (6.5) — its argument re-rooted at `T`, visible and timely, its " +
    "declaration directly following `O`'s — while `tt`, the file's only " +
    "`text` binding of the target module, is declared in `g`'s scope and " +
    "so invisible at the top-level call, so a declaration binding that " +
    "module's `text` alone is added, binding `<Y>`, never `tt` (bound by a " +
    "declaration already in the file, in `g`'s scope); `O` keeps its use " +
    "by `O.w`",
  placement:
    "the start of line 2 or of line 3 (offset 53 or 91), the two " +
    "line-start admissible offsets, both timely for the callee, only the " +
    "import declaration of `T` lying between `t`'s declaration and the " +
    "latter (6.5's latitude between them) — the call's occurrence span " +
    "[91, 97) becoming exactly `<Y>(T.y)`, and no other byte changing; a " +
    "product picking a held `text` binding by module and checking only " +
    "shadowing at the call writes `tt(T.y)` and adds nothing — `tt` bound " +
    "nowhere at top level, so the post-move `check` reports the call " +
    "(14.18, T4.5-10(g))",
  excluded: {
    0: S24_NO_STATEMENT_BEFORE,
    52: s24MidLine(
      "the end of line 1, `t`'s declaration's end",
      "the start of line 2 or of line 3",
    ),
    90: s24MidLine(
      "the end of line 2, `T`'s declaration's end",
      "the start of line 2 or of line 3",
    ),
    97: s24Untimely("the end of `t(O.x)`", "the statement `t(O.x)`"),
    98: s24Untimely("the start of line 4", "the statement `t(O.x)`"),
    102: s24Untimely(
      "the start of line 5",
      "the statements `t(O.x)` and `O.w`",
    ),
    124: s24Inside("the start of line 6", "g"),
    177: s24Inside("the start of line 7", "g"),
    187: s24Inside("the start of line 8", "g"),
    189: s24Untimely(
      "the file's end",
      "the statements `t(O.x)`, `O.w`, and `g`",
    ),
  },
  edges: [
    { from: S23_APP, to: S24_MOVED, kind: "embeds", what: "the call" },
    {
      from: `${S23_APP}#g`,
      to: S24_KEPT,
      kind: "embeds",
      what: "the kept call `tt(T.z)`",
    },
  ],
  spelledForm: (ident, offset) => {
    const added =
      ident === "text"
        ? 'import { text } from "../specs/target.xspec"'
        : `import { text as ${ident} } from "../specs/target.xspec"`;
    const origin = 'import O, { text as t } from "../specs/origin.xspec"';
    const target = 'import T from "../specs/target.xspec"';
    const head =
      offset === 53
        ? [origin, added, target]
        : offset === 91
          ? [origin, target, added]
          : undefined;
    if (head === undefined) {
      throw new Error(
        `T6.5-24 (e): a harness defect — TEST-SPEC spells no form at ` +
          `offset ${String(offset)}`,
      );
    }
    return [
      ...head,
      `${ident}(T.y)`,
      "O.w",
      "export function g() {",
      '  import { text as tt } from "../specs/target.xspec"',
      "  tt(T.z)",
      "}",
    ];
  },
});

// (f) the callee side's control: the nested `text` binding visible and
// timely at the call.
const S24_F = s24HeldArm({
  key: "(f)",
  lines: [
    S24_IMPORT_O_T,
    S24_IMPORT_T,
    "export function g() {",
    S24_NESTED_IMPORT_TT,
    "  t(O.x)",
    "  tt(T.z)",
    "}",
    "O.w",
  ],
  spelling: "t(O.x)",
  span: { start: 168, end: 174 },
  rewritten: "tt(T.y)",
  edge: {
    from: `${S23_APP}#g`,
    to: S24_MOVED,
    kind: "embeds",
    what: "the call",
  },
  placement:
    "the call `t(O.x)`, its target carried into the target module, is " +
    "rewritten whole (6.5): it stands in `g`'s scope, where `tt`, the " +
    "nested import's `text` binding of the target module, is visible, and " +
    "`tt` is timely, the import declaration of `T` alone lying wholly " +
    "between `t`'s declaration and `tt`'s, `g` enclosing the latter — so " +
    "the callee is re-rooted at `tt` and the argument at `T`, `tt(T.y)`, " +
    "nothing is added, and `O`'s declaration stays, kept by `O.w`; a " +
    "product never re-rooting a callee at a nested `text` binding adds " +
    "`import { text as <Y> } …`",
});

// (g) a held nested binding visible in a scope nested within its own.
const S24_G = s24HeldArm({
  key: "(g)",
  lines: [
    S23_IMPORT_O,
    "export function f() {",
    S24_NESTED_IMPORT_T,
    "  const h = () => { O.x }",
    "  O.w",
    "  T.z",
    "}",
  ],
  spelling: "O.x",
  span: { start: 120, end: 123 },
  rewritten: "T.y",
  edge: s24MarkerEdge(`${S23_APP}#f.h`),
  placement:
    "`T`, declared in `f`'s scope, is visible at the marker `O.x` in the " +
    "arrow function `h`, a scope nested within `f`'s that shadows nothing " +
    "(6.5: visible within the import's own scope), and timely as in (a), " +
    "so the marker is re-rooted to `T.y` and nothing is added, `O`'s " +
    "declaration staying, kept by `O.w`; a product matching a held nested " +
    "binding only against the innermost function enclosing the spelling, " +
    "never walking outward, finds `T` invisible at the marker, adds " +
    '`import <X> from "../specs/target.xspec"` at the start of line 2, and ' +
    "writes `<X>.y`",
});

// (h) the holding container a namespace.
const S24_H = s24HeldArm({
  key: "(h)",
  lines: [
    S23_IMPORT_O,
    "namespace N {",
    S24_NESTED_IMPORT_T,
    "  O.x",
    "  O.w",
    "  T.z",
    "}",
  ],
  spelling: "O.x",
  span: { start: 94, end: 97 },
  rewritten: "T.y",
  edge: s24MarkerEdge(`${S23_APP}#N`),
  placement:
    "`T` is visible at the marker `O.x`, both standing in `N`'s scope " +
    "(4.5), and timely, `N` enclosing its declaration (6.5: a statement " +
    "enclosing either declaration, such as the function or namespace " +
    "holding a nested import, never stands between them), so the marker is " +
    "re-rooted to `T.y` and nothing is added, `O`'s declaration staying, " +
    "kept by `O.w`; a product exempting an enclosing function, but not an " +
    "enclosing namespace, from standing between adds `import <X> from " +
    '"../specs/target.xspec"` at the start of line 2 and writes `<X>.y`',
});

/** T6.5-24's staged arms, in TEST-SPEC's order. */
const S24_ARMS: readonly S23Arm[] = [
  S24_A,
  S24_B,
  S24_C,
  S24_D,
  S24_E,
  S24_F,
  S24_G,
  S24_H,
];

/**
 * T6.5-24 (SUITE-25): 6.5's eligibility of a held binding for a moved
 * spelling — visible at the occurrence, a nested import's binding only
 * within its own scope (4.5), and, in a TypeScript source, timely under the
 * wholly-between rule, a statement enclosing a nested declaration never
 * standing between it and another. Arms (a), (f), (g), and (h) each hold a
 * nested binding visible and timely at the moved spelling, which is
 * re-rooted at it, nothing added: (a) `T` imported in the function holding
 * the marker, (f) a call's callee re-rooted at a nested `text` binding, (g)
 * the marker in an arrow function nested in `T`'s scope, (h) the holding
 * container a namespace. Arms (b) through (e) each find no held binding
 * eligible and gain one declaration of the target module, its fresh
 * identifier never one a nested declaration binds: (b) the nested `T`
 * invisible at a top-level marker, the declaration added at 38; (c) the
 * marker rooted at a nested `O` whose declaration, its last use gone, is
 * removed with its line over [22, 62), the declaration added at 70,
 * directly after the function holding it; (d) the nested `T` visible but
 * untimely, `const q = 1` lying wholly between, the declaration added at
 * 38; (e) the callee side, the nested `tt` invisible at a top-level call,
 * which gains `import { text as <Y> } …` (or `import { text } …`) at 53 or
 * 91.
 */
const T6_5_24 = defineProductTest({
  id: "T6.5-24",
  title:
    "nested bindings: visibility and wholly-between timeliness — arms (a) through (h), each `move specs/origin.mdx#x specs/target.mdx#y` over `src/c.ts` (`specs/origin.mdx` holding `x` and `w`, in (c) `x` alone, and `specs/target.mdx` holding `z`), the workspace valid before the move, its nested import declarations well-formed (never 14.20): (a) `import O from \"../specs/origin.xspec\"` above `export function f() {` holding `import T from \"../specs/target.xspec\"`, `O.x`, `O.w`, and `T.z` — `T` visible at the marker and timely, `f` enclosing its declaration and so standing between nothing — the marker re-rooted at `T`, nothing added, the file's one change the marker's span [102, 105) replaced by `T.y`, and `query edges` the marker's `references` edge from `src/c.ts#f` to `specs/target.mdx#y`; (b) `T` invisible outside its scope: `import O …`, `O.x`, and `O.w` above `f` holding `import T …` and `T.z` — the file gains `import <X> from \"../specs/target.xspec\"` at offset 38, the start of line 2, `<X>` never `T`, the marker's span [38, 41) becoming `<X>.y`, every other byte unchanged, the preview's `reference-rewrite` spanning [38, 41), and the marker's `references` edge from `src/c.ts` beside `T.z`'s from `src/c.ts#f` to `specs/target.mdx#z`; (c) an added declaration timely directly after the function holding the replaced nested binding: `f` holding `import O …` and `O.x`, then `export const k = 1` — `O`'s declaration removed with its line over [22, 62), the declaration added at 70, the start of line 5, the file becoming exactly `export function f() {`, `  <X>.y`, `}`, `import <X> from \"../specs/target.xspec\"`, `export const k = 1`, the preview's `reference-rewrite` spanning [64, 67) and its one `import-removal` spanning [22, 62), and the marker's edge from `src/c.ts#f`; (d) a held nested binding visible but untimely: (a) with `const q = 1` between `O`'s declaration and `f` — the declaration added at 38, `<X>` never `T`, the marker's span [114, 117) becoming `<X>.y`, the preview's `reference-rewrite` spanning [114, 117), and the marker's edge from `src/c.ts#f`; (e) the callee side: `t(O.x)` at top level below `import O, { text as t } …` and `import T …`, `g` holding `import { text as tt } from \"../specs/target.xspec\"` and `tt(T.z)` — `tt` invisible at the call, the file gains exactly `import { text as <Y> } from \"../specs/target.xspec\"` (or `import { text } …` where the fresh identifier is `text`), `<Y>` never `tt`, at offset 53 or 91, the call's span [91, 97) becoming `<Y>(T.y)`, the preview's `reference-rewrite` spanning [91, 97), and the call's `embeds` edge from `src/c.ts` beside `tt(T.z)`'s from `src/c.ts#g` to `specs/target.mdx#z`; (f) the callee side's control: `t(O.x)` in `g`, beside `g`'s nested `import { text as tt } …`, `O.w` after `g` — the call re-rooted at `tt` and `T`, nothing added, its span [168, 174) replaced by `tt(T.y)`, and the call's `embeds` edge from `src/c.ts#g`; (g) (a) with the marker in the arrow function `h` in `f`, a scope nested within `T`'s — [120, 123) replaced by `T.y`, nothing added, the edge from `src/c.ts#f.h`; (h) (a) with `namespace N {` in `export function f() {`'s place — [94, 97) replaced by `T.y`, nothing added, the edge from `src/c.ts#N` — each move exiting 0, `src/c.ts` after it well-formed (TypeScript 5.9.3's module and script readings) and byte-composable exactly, value-blind in an added declaration's fresh identifier alone, `O`'s declaration kept by `O.w` but in (c), the preview's edits for `src/c.ts` exactly those listed — the one `import-addition` at the offset the real operation used where the file gains a declaration (T6.6-4(b)), none elsewhere, no `import-removal` but (c)'s, and no edit of any other class — and `check` and `build` clean after it (SPEC 6.5, 2.4, 3, 4.5, 4.6, 5.2, 6.6, 11.1, 12.7, 14.20)",
  run: (product) => runS23Arms(product, "T6.5-24", S24_ARMS),
});

// ---------------------------------------------------------------------------
// T6.5-25 A TypeScript declaration standing as another statement's body stays
// ---------------------------------------------------------------------------

/** The node the marker designates before the move. */
const S25_ORIGIN_NODE = "specs/origin.mdx#x";

// The origin (TEST-SPEC: `specs/origin.mdx` holding `x`): the moved section
// alone, so that the marker is `O`'s only use, gone after the move.
const S25_ORIGIN_X_ALONE: StagedMdx = stagedMdx(
  "T6.5-25 specs/origin.mdx (the moved x alone)",
  ['<S id="x">', "Origin x text.", "</S>", ""].join("\n"),
);

/** A staged `src/c.ts` of T6.5-25 (S-9's record, declared well-formed
 * TypeScript). */
function s25StagedApp(key: string, text: string): StagedTs {
  return stagedTs(`T6.5-25 ${key} ${S23_APP}`, text, "well-formed", "ts");
}

/** Why each arm's `src/c.ts` gains its declaration while `O`'s stays (SPEC
 * 6.5). */
const S25_WHY =
  "the marker is rooted at `O`, whose declaration, standing as another " +
  "statement's body, binds in the scope holding that statement (4.5), and " +
  "the file holds no binding of the target module, so one declaration of " +
  "it is added, binding `<X>`, never `O` (bound by a declaration already in " +
  "the file); `O`'s declaration, its bindings unused after the move, stays " +
  "in place, no removal reported for it (6.5, 6.6: its deletion would leave " +
  "that statement no body)";

/** The marker's `references` edge before the move, from `from`, the unit
 * holding it or the file (4.6). */
function s25OriginEdge(from: string): S23Edge {
  return {
    from,
    to: S25_ORIGIN_NODE,
    kind: "references",
    what: "the marker",
  };
}

/**
 * The module-load S-9 check of an arm: its staged text and `spelled`, the
 * file TEST-SPEC spells after the move with a placeholder in `<X>`'s place,
 * are text TypeScript 5.9.3 accepts both as module code and as script code
 * (`judgeTypeScript`); a harness defect, thrown at load, otherwise.
 */
function s25AssertWellFormed(arm: S23Arm, spelled: string): void {
  for (const form of [
    { what: "the staged text", text: arm.text },
    { what: "the file TEST-SPEC spells after the move", text: spelled },
  ]) {
    const verdict = judgeTypeScript(form.text, arm.receiver);
    if (verdict.verdict !== "well-formed") {
      throw new Error(
        `${arm.test} ${arm.key}: a harness defect — ${form.what} must be ` +
          `text TypeScript 5.9.3 accepts both as module code and as script ` +
          `code (S-9); its verdict is ${JSON.stringify(verdict)}; the text ` +
          `reads ${JSON.stringify(form.text)}`,
      );
    }
  }
}

/**
 * An arm of T6.5-25 at module load: its `src/c.ts` record — `lines`, each
 * ended by U+000A — beside T6.5-23's configuration and target and the
 * `x`-alone origin, under T6.5-23's move; `O`'s declaration's own characters
 * at `declaration` and the marker `O.x` at `marker` (each cross-checked:
 * once, there; `pinned` likewise), the declaration kept byte-for-byte — no
 * rewrite touches it — and the marker rewritten to `<X>.y`; `import <X> from
 * "../specs/target.xspec"` added at the one admissible offset TEST-SPEC
 * names, cross-checked as its line's start; the preview's one
 * `reference-rewrite` spanning the marker and no `import-removal` (the
 * `import-addition` parity `runS23Arm` asserts), the expectation `exact` —
 * no edit of any other class; before the move, `check`
 * clean and the marker's `references` edge from `unit` to
 * `specs/origin.mdx#x`, and after it the same unit's to
 * `specs/target.mdx#y`. The form composed at the offset is held to the text
 * TEST-SPEC spells (`s24AssertSpelledForms`), and that text and the staged
 * one to S-9's TypeScript judge (`s25AssertWellFormed`).
 */
function s25Arm(spec: {
  readonly key: string;
  readonly lines: readonly string[];
  readonly declaration: S23Span;
  readonly marker: S23Span;
  readonly pinned?: readonly {
    readonly spelling: string;
    readonly span: S23Span;
  }[];
  readonly offset: S24Offset;
  readonly unit: string;
  readonly placement: string;
  readonly excluded: Readonly<Record<number, string>>;
  readonly spelledForm: (ident: string) => readonly string[];
}): S23Arm {
  const test = "T6.5-25";
  const text = [...spec.lines, ""].join("\n");
  s24Span(spec.key, text, S23_IMPORT_O, spec.declaration, test);
  const marker = s24Span(spec.key, text, "O.x", spec.marker, test);
  for (const pin of spec.pinned ?? []) {
    s24Span(spec.key, text, pin.spelling, pin.span, test);
  }
  const offset = s24Stated(
    spec.key,
    `the start of line ${String(spec.offset.line)}, the admissible offset`,
    s24Starts(spec.lines)[spec.offset.line - 1],
    spec.offset.offset,
    test,
  );
  const arm: S23Arm = {
    test,
    key: spec.key,
    receiver: S23_APP,
    kind: "typescript",
    text,
    staged: s25StagedApp(spec.key, text),
    files: {
      "xspec.config.ts": S23_CONFIG,
      [S23_ORIGIN]: S25_ORIGIN_X_ALONE,
      [S23_TARGET]: S23_TARGET_SOURCE,
    },
    argv: S23_ARGV,
    rewrites: [{ ...marker, spelled: (ident) => `${ident}.y` }],
    addition: {
      specifier: S23_TARGET_SPECIFIER,
      offsets: [offset],
      why: S25_WHY,
    },
    placement: spec.placement,
    excluded: spec.excluded,
    preview: { rewrites: [marker], removals: [], exact: true },
    edges: [s24MarkerEdge(spec.unit)],
    before: { check: true, edges: [s25OriginEdge(spec.unit)] },
  };
  s24AssertSpelledForms(arm, [offset], spec.spelledForm);
  s25AssertWellFormed(
    arm,
    [...spec.spelledForm(S24_PLACEHOLDER), ""].join("\n"),
  );
  return arm;
}

/** What a product deleting the declaration leaves in every top-level arm
 * but the `do` arm. */
const S25_BODY_TAKEN =
  "the statement taking the added declaration as its body — the file still " +
  "parsing, the marker still rooted (4.5: that declaration binds in the " +
  "file's scope), `check` clean — behind a reported success";

/**
 * A top-level arm: `src/c.ts` = `statement`, U+000A, `O.x`, U+000A, the
 * declaration standing as the statement's body; the marker at the start of
 * line 2, where the declaration is added — the only line-start admissible
 * offset — and the edges from `src/c.ts` (a top-level spelling is attributed
 * to the file, 4.6). `removed` is what a product deleting the declaration
 * leaves, for diagnoses.
 */
function s25TopLevelArm(spec: {
  readonly key: string;
  readonly statement: string;
  readonly removed: string;
}): S23Arm {
  const length = Buffer.byteLength(spec.statement, "utf8");
  const own = Buffer.from(spec.statement, "utf8").indexOf(S23_IMPORT_O);
  const line2 = length + 1;
  const excluded: Record<number, string> = {};
  for (let inside = 1; inside < length; inside += 1) {
    excluded[inside] =
      `inside the statement \`${spec.statement}\`, which a declaration ` +
      "there would split (6.5: an admissible offset lies inside none of the " +
      "file's statements)";
  }
  excluded[0] =
    `offset 0 — the start of the statement \`${spec.statement}\`, the ` +
    "file's first, so no statement's end precedes it (6.5)";
  excluded[length] = s24MidLine(
    "the statement's end, the end of line 1",
    "the start of line 2",
  );
  excluded[line2 + 3] = s24Untimely("the end of `O.x`", "the statement `O.x`");
  excluded[line2 + 4] = s24Untimely("the file's end", "the statement `O.x`");
  return s25Arm({
    key: spec.key,
    lines: [spec.statement, "O.x"],
    declaration: {
      start: own,
      end: own + Buffer.byteLength(S23_IMPORT_O, "utf8"),
    },
    marker: { start: line2, end: line2 + 3 },
    offset: { line: 2, offset: line2 },
    unit: S23_APP,
    placement:
      `the start of line 2, offset ${String(line2)}, the only line-start ` +
      `admissible offset — it follows the end of the statement ` +
      `\`${spec.statement}\` and is timely, that statement enclosing \`O\`'s ` +
      "declaration and so not standing between it and the added one (6.5), " +
      "while offset 0 follows no statement's end, every offset inside the " +
      "statement lies inside one, and the file's end is untimely, `O.x` " +
      "standing between — `O`'s declaration staying in place byte-for-byte, " +
      "its binding unused and no removal reported for it (6.5: its deletion " +
      "would leave the statement no body), and the marker becoming `<X>.y`; " +
      `a product removing the declaration fails the byte contract, ` +
      spec.removed,
    excluded,
    spelledForm: (ident) => [
      spec.statement,
      `import ${ident} from "../specs/target.xspec"`,
      `${ident}.y`,
    ],
  });
}

/** The nested arm's `src/c.ts` lines (TEST-SPEC). */
const S25_NESTED_LINES = [
  "export function f() {",
  '  if (c) import O from "../specs/origin.xspec"',
  "  O.x",
  "}",
] as const;

/** Why each offset of the nested arm but the file's end is excluded. */
function s25NestedExcluded(): Readonly<Record<number, string>> {
  const excluded: Record<number, string> = {};
  for (let inside = 1; inside < 76; inside += 1) {
    excluded[inside] =
      "inside the statement `f`, where a declaration is no top-level one " +
      "(6.5; T6.5-23(n))";
  }
  excluded[0] =
    "offset 0 — `f` is the file's first statement, so no statement's end " +
    "precedes it (6.5)";
  excluded[22] = s24Inside("the start of line 2", "f");
  excluded[31] = s24Inside(
    "the start of `O`'s declaration, 31",
    "f",
    ", and inside the statement `if (c) …` besides, which a declaration " +
      "there would split",
  );
  excluded[68] = s24Inside("the end of the `if` statement, 68", "f");
  excluded[69] = s24Inside("the start of line 3", "f");
  excluded[75] = s24Inside("the start of line 4", "f");
  excluded[76] = s24MidLine("`f`'s end, 76", "the file's end, 77");
  return excluded;
}

// The nested arm: the rule reaches a statement-body declaration wherever the
// statement holding it stands (6.5).
const S25_NESTED = s25Arm({
  key: "(nested)",
  lines: S25_NESTED_LINES,
  declaration: { start: 31, end: 68 },
  marker: { start: 71, end: 74 },
  pinned: [{ spelling: "}", span: { start: 75, end: 76 } }],
  offset: { line: 5, offset: 77 },
  unit: `${S23_APP}#f`,
  placement:
    "the file's end, offset 77, the only line-start admissible offset — it " +
    "follows `f`'s end and is timely, `f` enclosing the replaced " +
    "declaration and so not standing between it and the added one (6.5, " +
    "T6.5-24(c)), while offset 0 follows no statement's end and every other " +
    "line start lies inside `f` (`f`'s end, 76, admissible too, is " +
    "mid-line) — `O`'s declaration [31, 68), binding in `f`'s scope (4.5, " +
    "T4.5-10), staying in place byte-for-byte, its binding unused and no " +
    "removal reported for it, and the marker [71, 74) becoming `<X>.y`; a " +
    "product applying the rule to top-level statements alone deletes the " +
    "declaration, leaving `  if (c) ` on its line to take `<X>.y` as its " +
    "body — the file still parsing, the marker still rooted, `check` clean " +
    "— failing the byte contract behind a reported success",
  excluded: s25NestedExcluded(),
  spelledForm: (ident) => [
    "export function f() {",
    '  if (c) import O from "../specs/origin.xspec"',
    `  ${ident}.y`,
    "}",
    `import ${ident} from "../specs/target.xspec"`,
  ],
});

/** T6.5-25's staged arms, in TEST-SPEC's order. */
const S25_ARMS: readonly S23Arm[] = [
  s25TopLevelArm({
    key: "(if)",
    statement: 'if (c) import O from "../specs/origin.xspec"',
    removed: S25_BODY_TAKEN,
  }),
  s25TopLevelArm({
    key: "(else)",
    statement: 'if (c) {} else import O from "../specs/origin.xspec"',
    removed: S25_BODY_TAKEN,
  }),
  s25TopLevelArm({
    key: "(do)",
    statement: 'do import O from "../specs/origin.xspec"; while (c)',
    removed:
      "leaving `do  while (c)` before the added line — the `;`, the " +
      "declaration's own terminator, deleted with it — text that no longer " +
      "parses (14.20)",
  }),
  s25TopLevelArm({
    key: "(while)",
    statement: 'while (c) import O from "../specs/origin.xspec"',
    removed: S25_BODY_TAKEN,
  }),
  s25TopLevelArm({
    key: "(for)",
    statement: 'for (; c; ) import O from "../specs/origin.xspec"',
    removed: S25_BODY_TAKEN,
  }),
  s25TopLevelArm({
    key: "(for-in)",
    statement: 'for (const k in o) import O from "../specs/origin.xspec"',
    removed: S25_BODY_TAKEN,
  }),
  s25TopLevelArm({
    key: "(for-of)",
    statement: 'for (const k of o) import O from "../specs/origin.xspec"',
    removed: S25_BODY_TAKEN,
  }),
  s25TopLevelArm({
    key: "(with)",
    statement: 'with (o) import O from "../specs/origin.xspec"',
    removed: S25_BODY_TAKEN,
  }),
  s25TopLevelArm({
    key: "(labeled)",
    statement: 'l: import O from "../specs/origin.xspec"',
    removed: S25_BODY_TAKEN,
  }),
  S25_NESTED,
];

/**
 * T6.5-25 (SUITE-25): 6.5 keeps an import declaration standing as another
 * statement's body — either branch of an `if` statement, or the body of a
 * `do`, `while`, `for`, `for…in`, `for…of`, `with`, or labeled statement —
 * its bindings unused and no removal reported for it (6.6), since its
 * deletion would leave that statement no body. Nine top-level arms, one per
 * position, each `src/c.ts` = the statement, U+000A, `O.x`, U+000A: before
 * the move `build` and `check` clean and the marker's edge from `src/c.ts`
 * to `specs/origin.mdx#x` recorded; after it the declaration in place
 * byte-for-byte, the marker `<X>.y`, rooted at `import <X> from
 * "../specs/target.xspec"` added at the start of line 2, the preview's one
 * `reference-rewrite` and its `import-addition` there, with no
 * `import-removal` and no other edit, and the marker's edge from `src/c.ts`
 * to `specs/target.mdx#y`. A tenth,
 * nested arm holds the `if` statement in `f`: the declaration [31, 68) kept,
 * the marker [71, 74) rewritten, the declaration added at the file's end,
 * 77, the edges from `src/c.ts#f`.
 */
const T6_5_25 = defineProductTest({
  id: "T6.5-25",
  title:
    'a TypeScript declaration standing as another statement\'s body stays — one arm per position, each `move specs/origin.mdx#x specs/target.mdx#y` (`specs/origin.mdx` holding `x`, `specs/target.mdx` holding `z`) over `src/c.ts` = the statement, U+000A, `O.x`, U+000A, the statement in turn `if (c) import O from "../specs/origin.xspec"`, `if (c) {} else import O from "../specs/origin.xspec"`, `do import O from "../specs/origin.xspec"; while (c)`, `while (c) import O from "../specs/origin.xspec"`, `for (; c; ) import O from "../specs/origin.xspec"`, `for (const k in o) import O from "../specs/origin.xspec"`, `for (const k of o) import O from "../specs/origin.xspec"`, `with (o) import O from "../specs/origin.xspec"`, and `l: import O from "../specs/origin.xspec"` — before the move `build` and `check` clean, the statement-body declaration well-formed (never 14.20) and binding in the file\'s scope, and `query edges` the marker\'s `references` edge from `src/c.ts` to `specs/origin.mdx#x`; each move exiting 0, `src/c.ts` after it well-formed (TypeScript 5.9.3\'s module and script readings) and exactly the statement, U+000A, `import <X> from "../specs/target.xspec"`, U+000A, `<X>.y`, U+000A — the declaration kept in place byte-for-byte, its binding unused, the added declaration at the start of line 2, value-blind in `<X>` alone, never `O` — the preview\'s edits for `src/c.ts` exactly one `reference-rewrite` spanning `O.x` and the one `import-addition` at the start of line 2 (T6.6-4(b)), with no `import-removal` and no edit of any other class, `check` and `build` clean after it, and `query edges` the marker\'s `references` edge from `src/c.ts` to `specs/target.mdx#y`; and a nested arm over `export function f() {`, `  if (c) import O from "../specs/origin.xspec"`, `  O.x`, `}` — before the move `build` and `check` clean and the marker\'s edge from `src/c.ts#f` to `specs/origin.mdx#x` — the declaration [31, 68) kept byte-for-byte and the declaration added at the file\'s end, 77, the file becoming exactly `export function f() {`, `  if (c) import O from "../specs/origin.xspec"`, `  <X>.y`, `}`, `import <X> from "../specs/target.xspec"`, the preview\'s edits for `src/c.ts` exactly one `reference-rewrite` spanning [71, 74) and its `import-addition` at 77, with no `import-removal` and no edit of any other class, `check` and `build` clean after it, and the marker\'s edge from `src/c.ts#f` to `specs/target.mdx#y` (SPEC 6.5, 3, 4.5, 4.6, 5.2, 6.6, 11.1, 12.7, 14.20)',
  run: (product) => runS23Arms(product, "T6.5-25", S25_ARMS),
});

// ---------------------------------------------------------------------------
// T6.5-26 TypeScript removal extents: decorators and modifiers, and what a
// removal leaves
// ---------------------------------------------------------------------------

// The origin (TEST-SPEC: `specs/origin.mdx` holding `x`): the moved section
// alone, so that the marker is `O`'s only use, gone after the move.
const S26_ORIGIN_X_ALONE: StagedMdx = stagedMdx(
  "T6.5-26 specs/origin.mdx (the moved x alone)",
  ['<S id="x">', "Origin x text.", "</S>", ""].join("\n"),
);

/** `f` of (a) through (e) and (g): the marker `O.x`, `O`'s only use, beside
 * `T.z`. */
const S26_F = "export function f() { O.x; T.z }";

/** `O`'s declaration carrying a decorator ((a), and nested in (h)). */
const S26_DECORATED = `@dec ${S23_IMPORT_O}`;

/** The text TEST-SPEC spells for the file (a) through (c) and (g) leave. */
const S26_TOP_LEVEL_LEFT = [
  'import T from "../specs/target.xspec"',
  "export function f() { T.y; T.z }",
] as const;

/** A staged `src/c.ts` of T6.5-26 (S-9's record, declared well-formed
 * TypeScript). */
function s26StagedApp(key: string, text: string): StagedTs {
  return stagedTs(`T6.5-26 ${key} ${S23_APP}`, text, "well-formed", "ts");
}

/** A span in words, for diagnoses. */
function s26Range(span: S23Span): string {
  return `[${String(span.start)}, ${String(span.end)})`;
}

/** Why a staging's `src/c.ts` gains nothing and loses `O`'s declaration,
 * for diagnoses: `extent` says where the removal runs, what stays, and what
 * a deviating product leaves. */
function s26Placement(extent: string): string {
  return (
    "`T`, held, visible, unshadowed, and timely for the moved marker " +
    "`O.x`, re-roots it to `T.y`, so nothing is added, and `O`'s " +
    `declaration, the marker its only use, is removed: ${extent}`
  );
}

/**
 * The module-load self-check of a staging: the form its removal and its
 * rewrite compose (section-6.5-v.ts's `s23RewrittenForm`, the bytes
 * `runS23Arm` asserts) is exactly `spelled`, the text TEST-SPEC spells for
 * the file after the move; a harness defect otherwise.
 */
function s26AssertSpelledForm(arm: S23Arm, spelled: string): void {
  const composed = s23RewrittenForm(arm);
  if (Buffer.compare(composed, Buffer.from(spelled, "utf8")) !== 0) {
    throw new Error(
      `${arm.test} ${arm.key}: a harness defect — the form the removal and ` +
        `the rewrite compose must be the text TEST-SPEC spells, ` +
        `${JSON.stringify(spelled)}; it is ` +
        JSON.stringify(composed.toString("utf8")),
    );
  }
}

/**
 * A staging of T6.5-26 at module load: its `src/c.ts` record — `lines`,
 * each ended by U+000A — beside T6.5-23's configuration and target and the
 * test's `x`-alone origin, under T6.5-23's move; `O`'s declaration removed
 * over TEST-SPEC's range (`removal`, cross-checked by `s24RemovalRange`), a
 * rewrite spelled `""`, and the marker `O.x` (at `marker`, the staged
 * bytes' offset, cross-checked by `s24Span`) rewritten to `T.y`, nothing
 * added; before the move `check` clean; the preview's one
 * `reference-rewrite` spanning the marker, its one `import-removal`
 * spanning the removal's range, and no `import-addition` (which `runS23Arm`
 * asserts wherever nothing is added), the expectation `exact` — no edit of
 * any other class; and after the move the marker's
 * `references` edge from `src/c.ts#f`, the unit holding it in every
 * staging (4.6), to `specs/target.mdx#y`. The composed form is held to
 * `spelled`, the text TEST-SPEC spells for the file after the move
 * (`s26AssertSpelledForm`), and that text and the staged one to S-9's
 * TypeScript judge (`s25AssertWellFormed`).
 */
function s26Arm(spec: {
  readonly key: string;
  readonly lines: readonly string[];
  readonly removal: S24Removal;
  readonly marker: S23Span;
  readonly placement: string;
  readonly spelled: readonly string[];
}): S23Arm {
  const test = "T6.5-26";
  const text = [...spec.lines, ""].join("\n");
  const removal = s24RemovalRange(
    spec.key,
    text,
    s24Starts(spec.lines),
    spec.removal,
    test,
  );
  const marker = s24Span(
    spec.key,
    text,
    "O.x",
    spec.marker,
    test,
    "the pinned",
  );
  const arm: S23Arm = {
    test,
    key: spec.key,
    receiver: S23_APP,
    kind: "typescript",
    text,
    staged: s26StagedApp(spec.key, text),
    files: {
      "xspec.config.ts": S23_CONFIG,
      [S23_ORIGIN]: S26_ORIGIN_X_ALONE,
      [S23_TARGET]: S23_TARGET_SOURCE,
    },
    argv: S23_ARGV,
    rewrites: [
      { ...removal, spelled: () => "" },
      { ...marker, spelled: () => "T.y" },
    ],
    addition: undefined,
    placement: spec.placement,
    excluded: {},
    preview: { rewrites: [marker], removals: [removal], exact: true },
    edges: [s24MarkerEdge(`${S23_APP}#f`)],
    before: { check: true, edges: [] },
  };
  const spelled = [...spec.spelled, ""].join("\n");
  s26AssertSpelledForm(arm, spelled);
  s25AssertWellFormed(arm, spelled);
  return arm;
}

/**
 * A top-level staging of (a) through (c) and (g): `src/c.ts` = `import T
 * …`, U+000A, `declaration`, U+000A, `f`, U+000A — the declaration's own
 * characters from `first`, its first decorator or modifier, at `own`, its
 * line [38, `range.end`) removed — the file becoming exactly what TEST-SPEC
 * spells for (a) through (c); `deviating` says what a product deleting from
 * elsewhere leaves.
 */
function s26TopLevelArm(spec: {
  readonly key: string;
  readonly declaration: string;
  readonly first: string;
  readonly own: S23Span;
  readonly range: S23Span;
  readonly marker: S23Span;
  readonly deviating: string;
}): S23Arm {
  return s26Arm({
    key: spec.key,
    lines: [S24_IMPORT_T, spec.declaration, S26_F],
    removal: {
      declaration: spec.declaration,
      own: spec.own,
      line: 2,
      range: spec.range,
    },
    marker: spec.marker,
    placement: s26Placement(
      `the deletion starts at ${spec.first}, so that none is left to ` +
        `attach to what follows — its own characters ${s26Range(spec.own)} ` +
        "deleted and the line it empties dropped with its terminator, " +
        `${s26Range(spec.range)} (6.5, 3), the marker becoming \`T.y\`; ` +
        spec.deviating,
    ),
    spelled: S26_TOP_LEVEL_LEFT,
  });
}

/** What a product deleting from `import` leaves in (a) through (c). */
function s26FromImport(left: string): string {
  return (
    `a product deleting from \`import\` leaves ${left} — still parsing ` +
    "(14.20), so that the post-move `check` passes — failing the byte " +
    "contract and the preview's range"
  );
}

/** What a product starting (g)'s deletion anywhere but the first of the
 * declaration's decorator and modifier leaves. */
const S26_G_DEVIATING =
  "a product starting anywhere else — at the modifier nearest `import`, at " +
  "the first modifier before any decorator, as TypeScript 5's separate " +
  "decorator and modifier accessors invite, or at the first decorator " +
  "before any modifier — leaves `@dec ` or `export ` above the function " +
  "declaration in one of (g)'s stagings or the other, each still parsing " +
  "(14.20), so that the post-move `check` passes, failing the byte contract " +
  "and the preview's range";

/** (e): `O`'s declaration heading the file, `comment` — a pragma or a
 * triple-slash directive — between it and `T`'s. */
function s26LeadingArm(spec: {
  readonly comment: string;
  readonly what: string;
  readonly marker: S23Span;
}): S23Arm {
  return s26Arm({
    key: `(e) with \`${spec.comment}\``,
    lines: [S23_IMPORT_O, spec.comment, S24_IMPORT_T, S26_F],
    removal: {
      declaration: S23_IMPORT_O,
      own: { start: 0, end: 37 },
      line: 1,
      range: { start: 0, end: 38 },
    },
    marker: spec.marker,
    placement: s26Placement(
      "`T` is timely, its declaration following `O`'s with nothing but a " +
        "comment between (6.5); the removal's range is [0, 38), the " +
        `declaration's line, and the ${spec.what} \`${spec.comment}\` ` +
        "stays, now leading the file, where TypeScript reads pragmas and " +
        "triple-slash directives (6.5: a removal changes nothing beyond its " +
        "extent, whatever the comments around it then mean to TypeScript); " +
        "a product deleting the comment with the declaration, as " +
        "TypeScript's own edit utilities may, or keeping the declaration " +
        `because its removal would bring the ${spec.what} to the file's ` +
        "head, fails the byte contract and the preview's range",
    ),
    spelled: [
      spec.comment,
      'import T from "../specs/target.xspec"',
      "export function f() { T.y; T.z }",
    ],
  });
}

/** T6.5-26's staged arms, in TEST-SPEC's order. */
const S26_ARMS: readonly S23Arm[] = [
  // (a) through (c): a decorated or modified declaration, a valid spec
  // module import — no xspec condition reads a declaration's decorators or
  // modifiers.
  s26TopLevelArm({
    key: "(a) `@dec import O …`",
    declaration: S26_DECORATED,
    first: "the decorator's `@`",
    own: { start: 38, end: 80 },
    range: { start: 38, end: 81 },
    marker: { start: 103, end: 106 },
    deviating: s26FromImport(
      "`@dec ` decorating the function declaration after it",
    ),
  }),
  s26TopLevelArm({
    key: "(b) `export import O …`",
    declaration: `export ${S23_IMPORT_O}`,
    first: "its `export` modifier",
    own: { start: 38, end: 82 },
    range: { start: 38, end: 83 },
    marker: { start: 105, end: 108 },
    deviating: s26FromImport(
      "`export ` exporting the function declaration after it",
    ),
  }),
  s26TopLevelArm({
    key: "(c) `declare import O …`",
    declaration: `declare ${S23_IMPORT_O}`,
    first: "its `declare` modifier",
    own: { start: 38, end: 83 },
    range: { start: 38, end: 84 },
    marker: { start: 106, end: 109 },
    deviating: s26FromImport(
      "a stray `declare` above the function declaration",
    ),
  }),
  // (d) a comment that comes to govern what followed the declaration,
  // nothing added in its place.
  s26Arm({
    key: "(d)",
    lines: [
      S24_IMPORT_T,
      "// @ts-expect-error",
      S23_IMPORT_O,
      'const n: number = "x"',
      S26_F,
    ],
    removal: {
      declaration: S23_IMPORT_O,
      own: { start: 58, end: 95 },
      line: 3,
      range: { start: 58, end: 96 },
    },
    marker: { start: 140, end: 143 },
    placement: s26Placement(
      "the removal's range is [58, 96), the declaration's line alone (6.5, " +
        "3), nothing added in its place, and the comment " +
        "`// @ts-expect-error` above it stays, now governing the `const` " +
        "line (6.5: a removal changes nothing beyond its extent, whatever " +
        "the comments around it then mean to TypeScript); a product " +
        "deleting the comment attached to the declaration along with it, " +
        "as TypeScript's own edit utilities may, or keeping the declaration " +
        "because its removal would change what the comment governs, fails " +
        "the byte contract and the preview's range",
    ),
    spelled: [
      'import T from "../specs/target.xspec"',
      "// @ts-expect-error",
      'const n: number = "x"',
      "export function f() { T.y; T.z }",
    ],
  }),
  // (e) comments that come to lead the file.
  s26LeadingArm({
    comment: "// @ts-nocheck",
    what: "pragma",
    marker: { start: 113, end: 116 },
  }),
  s26LeadingArm({
    comment: '/// <reference lib="esnext" />',
    what: "triple-slash directive",
    marker: { start: 129, end: 132 },
  }),
  // (f) a string-literal statement that comes to head a function body's
  // directive prologue.
  s26Arm({
    key: "(f)",
    lines: [
      S24_IMPORT_T,
      "export function f() {",
      `  ${S23_IMPORT_O}`,
      '  "use strict"',
      "  O.x",
      "  T.z",
      "}",
    ],
    removal: {
      declaration: S23_IMPORT_O,
      own: { start: 62, end: 99 },
      line: 3,
      range: { start: 60, end: 100 },
    },
    marker: { start: 117, end: 120 },
    placement: s26Placement(
      "`O`'s declaration, nested at the head of `f`'s body, binds in `f`'s " +
        "scope (4.5, T4.5-10), where `T` is visible and timely, its " +
        "declaration preceding `O`'s; the removal's range is [60, 100), the " +
        "nested declaration's line with its indentation (6.5, 3), and the " +
        'string-literal statement `"use strict"` stays, now heading the ' +
        "body and so its directive prologue (6.5: a removal changes nothing " +
        "beyond its extent); a product deleting the string-literal " +
        "statement after the declaration along with it, or keeping the " +
        'declaration because its removal would make `"use strict"` a ' +
        "directive, fails the byte contract and the preview's range",
    ),
    spelled: [
      'import T from "../specs/target.xspec"',
      "export function f() {",
      '  "use strict"',
      "  T.y",
      "  T.z",
      "}",
    ],
  }),
  // (g) a declaration carrying both a decorator and a modifier, which tells
  // "first" apart from "only".
  s26TopLevelArm({
    key: "(g) `@dec export import O …`",
    declaration: `@dec export ${S23_IMPORT_O}`,
    first: "the decorator's `@`, the first of its decorator and modifier",
    own: { start: 38, end: 87 },
    range: { start: 38, end: 88 },
    marker: { start: 110, end: 113 },
    deviating: S26_G_DEVIATING,
  }),
  s26TopLevelArm({
    key: "(g) `export @dec import O …`",
    declaration: `export @dec ${S23_IMPORT_O}`,
    first:
      "its `export` modifier, the first of its modifier and decorator " +
      "(TypeScript's parser admitting a decorator after a leading modifier " +
      "as before it, 14.20)",
    own: { start: 38, end: 87 },
    range: { start: 38, end: 88 },
    marker: { start: 110, end: 113 },
    deviating: S26_G_DEVIATING,
  }),
  // (h) a decorated declaration nested in a function body.
  s26Arm({
    key: "(h)",
    lines: [
      S24_IMPORT_T,
      "export function f() {",
      `  ${S26_DECORATED}`,
      "  O.x",
      "  T.z",
      "}",
    ],
    removal: {
      declaration: S26_DECORATED,
      own: { start: 62, end: 104 },
      line: 3,
      range: { start: 60, end: 105 },
    },
    marker: { start: 107, end: 110 },
    placement: s26Placement(
      "`O`'s decorated declaration, nested in `f`'s body, binds in `f`'s " +
        "scope (4.5, T4.5-10), where `T` is visible and timely, its " +
        "declaration preceding `O`'s; the deletion starts at the " +
        "decorator's `@` — the extent rule reaching a declaration wherever " +
        "it stands — its own characters [62, 104) deleted and the line they " +
        "leave holding two spaces dropped with its terminator, [60, 105) " +
        "(6.5, 3); a product starting a nested declaration's deletion at " +
        "`import` leaves `  @dec ` on its line, before `T.y` and no " +
        "declaration, so that the file no longer parses (14.20), failing " +
        "the byte contract and the preview's range",
    ),
    spelled: [
      'import T from "../specs/target.xspec"',
      "export function f() {",
      "  T.y",
      "  T.z",
      "}",
    ],
  }),
];

/**
 * T6.5-26 (SUITE-25): 6.5's TypeScript removal extents — an import removal
 * deletes the declaration from its first decorator or modifier where it
 * carries any, so that none is left to attach to what follows, the lines it
 * empties dropped with their terminators (3), and changes nothing beyond
 * its extent, the comments and statements around the declaration staying
 * whatever they then mean to TypeScript. Ten stagings, each the move of
 * `specs/origin.mdx#x` (holding `x` alone) to `specs/target.mdx#y` over
 * `src/c.ts` holding `import T from "../specs/target.xspec"`, the marker
 * `O.x` re-rooted to `T.y`, nothing added, and `O`'s declaration removed:
 * (a)–(c) `@dec import O …`, `export import O …`, and `declare import O …`
 * between `T`'s declaration and `f`, the removal [38, 81), [38, 83), and
 * [38, 84); (d) `// @ts-expect-error` above the declaration, staying to
 * govern the `const` line, the removal [58, 96); (e) the declaration
 * heading the file above `// @ts-nocheck`, and separately above
 * `/// <reference lib="esnext" />`, which comes to lead it, the removal
 * [0, 38); (f) the declaration nested at the head of `f`'s body above
 * `"use strict"`, which comes to head its directive prologue, the removal
 * [60, 100); (g) `@dec export import O …` and `export @dec import O …`,
 * the removal [38, 88) in each, from the first of the decorator and
 * modifier; (h) `@dec import O …` nested in `f`'s body, the removal
 * [60, 105). Each file is asserted byte-equal to the staged bytes with the
 * removal's range deleted and the marker rewritten, the preview's
 * `import-removal` spanning that range (T6.6-4(b)'s decorator-and-modifier
 * clause pinned here; T6.6-4's own stagings hold no decorated or modified
 * declaration) beside its one `reference-rewrite`, and no other edit.
 */
const T6_5_26 = defineProductTest({
  id: "T6.5-26",
  title:
    "TypeScript removal extents: decorators and modifiers, and what a removal leaves — ten stagings, each `move specs/origin.mdx#x specs/target.mdx#y` (`specs/origin.mdx` holding `x`, `specs/target.mdx` holding `z`) over `src/c.ts` holding `import T from \"../specs/target.xspec\"`, visible, unshadowed, and timely for the moved marker `O.x` — the marker re-rooted to `T.y`, nothing added, and `O`'s declaration, the marker its only use, removed — the workspace valid before the move, `build` and `check` clean, its decorated, modified, and nested declarations well-formed (never 14.20): (a)–(c) `src/c.ts` = `import T …`, U+000A, the declaration `@dec import O from \"../specs/origin.xspec\"`, `export import O …`, or `declare import O …`, U+000A, `export function f() { O.x; T.z }`, U+000A — the deletion starting at the `@`, `export`, or `declare`, the line it empties dropped with its terminator, the removal's range [38, 81), [38, 83), or [38, 84), the file becoming exactly `import T …`, U+000A, `export function f() { T.y; T.z }`, U+000A; (d) `// @ts-expect-error` above `import O …`, `const n: number = \"x\"` below it — the removal's range [58, 96), the declaration's line alone, the comment staying to govern the `const` line; (e) `import O …` heading the file above `// @ts-nocheck`, and separately above `/// <reference lib=\"esnext\" />`, then `import T …` — the removal's range [0, 38), the pragma or directive coming to lead the file; (f) `import O …` nested at the head of `f`'s body above `\"use strict\"` — the removal's range [60, 100), the line with its indentation, `\"use strict\"` coming to head the body's directive prologue; (g) (a)–(c)'s file with `@dec export import O …` and, separately, `export @dec import O …` — the deletion starting at the first of them, the removal's range [38, 88) in each, the file becoming exactly what (a)–(c) leave; (h) `  @dec import O …` nested in `f`'s body — its own characters [62, 104) deleted and the two-space line they leave dropped with its terminator, the removal's range [60, 105) — each move exiting 0 with the form-exact 12.7 document, `src/c.ts` after it well-formed (TypeScript 5.9.3's module and script readings) and exactly the staged bytes with the removal's range deleted and the marker's span replaced by `T.y`, no declaration added and no other byte changed, the preview's edits for `src/c.ts` exactly one `reference-rewrite` spanning the marker and one `import-removal` spanning the removal's range — from the first decorator or modifier (T6.6-4(b)) — with no `import-addition` and no edit of any other class, `check` and `build` clean after it, and `query edges` the marker's `references` edge from `src/c.ts#f` to `specs/target.mdx#y` (SPEC 6.5, 3, 4.5, 4.6, 5.2, 6.4, 6.6, 11.1, 12.7, 14.20)",
  run: (product) => runS23Arms(product, "T6.5-26", S26_ARMS),
});

/** TEST-SPEC §6.5, sixth part, in canonical ID order (SUITE-25). */
export const section65viTests: readonly ProductTestEntry[] = [
  T6_5_24,
  T6_5_25,
  T6_5_26,
];
