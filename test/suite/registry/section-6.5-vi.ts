// TEST-SPEC §6.5 (move), sixth part — SUITE-25 (continued): T6.5-24, nested
// bindings: visibility and wholly-between timeliness. T6.5-1 … T6.5-10 are
// section-6.5.ts's business, T6.5-11 section-6.5-ii.ts's, T6.5-12 …
// T6.5-19 section-6.5-iii.ts's, T6.5-20 … T6.5-22 section-6.5-iv.ts's, and
// T6.5-23 section-6.5-v.ts's; this module keeps that file's edits bounded
// (the section-10.7-i/-ii precedent).
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
// function or namespace holding a nested import. A rooted spelling's edge
// is attributed to the innermost named code unit enclosing it, or to the
// file where none does (4.6).
//
// T6.5-24's conservative operationalizations (noted per H-4 — wording is
// free, so only the stated observables are asserted):
// - Each arm is an `S23Arm` run by section-6.5-v.ts's `runS23Arms`, T6.5-23's
//   machinery: one fresh workspace per arm (H-1), every file a staged-source
//   record (S-9's timing clause: every arm's workspace past the body's first
//   is created after a product invocation) — T6.5-23's configuration (one
//   spec group `specs/**/*.mdx`, one code group `src/**/*.ts`, emission
//   disabled), `specs/origin.mdx` holding `x` and `w`, and
//   `specs/target.mdx` holding `z`, the same records, beside the arm's
//   `src/c.ts`, TEST-SPEC's text exactly, each line ended by U+000A — under
//   TEST-SPEC's `move specs/origin.mdx#x specs/target.mdx#y`.
// - Per arm: `build --json` clean over the staging (the premise: the
//   workspace valid before the move, its nested import declaration
//   well-formed, never 14.20, as T14-12 places that assertion here); the
//   `--preview --json` twin taken first (a preview modifies nothing, 6.6);
//   the real move with `--json`, exit 0 and the form-exact 12.7
//   performed-operation document; `src/c.ts` after it a plain file of valid
//   UTF-8 that TypeScript 5.9.3 accepts both as module code and as script
//   code (S-9's judge, `judgeTypeScript`, held as an assertion on the
//   product's bytes); `query edges` for the arm's edge; then `check --json`
//   and `build --json`, each exactly `{"findings": []}`.
// - Arms (a), (f), (g), and (h) re-root the moved spelling at a held nested
//   binding and add nothing: T6.5-22(a)'s judgement reads no added
//   declaration, and the file is exactly the staged bytes with the
//   spelling's span replaced — byte-composable exactly, no other byte
//   changed — the span computed from the staged bytes and checked at module
//   load against TEST-SPEC's ([102, 105), [168, 174), [120, 123), and
//   [94, 97)), a mismatch a harness defect thrown at load, never a product
//   verdict. The preview's entry for `src/c.ts` holds exactly one
//   `reference-rewrite`, spanning it, and no `import-addition` or
//   `import-removal`. `query edges --from <unit> --to specs/target.mdx#y
//   --kinds <kind>` answers exactly the spelling's edge: the marker's
//   `references` edge from `src/c.ts#f` ((a)), from `src/c.ts#f.h` ((g):
//   the arrow function `h` in `f`, a named unit, 4.6), or from `src/c.ts#N`
//   ((h)); the call's `embeds` edge from `src/c.ts#g` ((f)).
// - Before any product is driven on an arm, the staged text and the form the
//   rewrite alone composes are held to the same TypeScript judge (S-9: a
//   form it rejects is a harness defect, never a product verdict).
// - None is compiled under H-2's channel: TypeScript's checker rejects a
//   nested import declaration after parsing (T4.5-10), so each arm observes
//   xspec's surfaces alone.
// - Every arm runs; each one's diagnosed failure is collected and the body
//   fails once at the end, naming every arm that failed, so one product
//   failure hides no other arm's verdict. A harness error — anything but a
//   diagnosed assertion failure, a hang included — propagates at once.

import { Buffer } from "node:buffer";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { type StagedTs, stagedTs } from "../../helpers/staged-ts.js";
import {
  runS23Arms,
  type S23Arm,
  type S23Edge,
  type S23Span,
  S23_APP,
  S23_ARGV,
  S23_CONFIG,
  S23_IMPORT_O,
  S23_ORIGIN,
  S23_ORIGIN_SOURCE,
  S23_TARGET,
  S23_TARGET_SOURCE,
} from "./section-6.5-v.js";

// ---------------------------------------------------------------------------
// T6.5-24 Nested bindings: visibility and wholly-between timeliness
// ---------------------------------------------------------------------------

/** The moved node's identity after the move. */
const S24_MOVED = "specs/target.mdx#y";

/** `T`'s declaration of the target module, nested two spaces deep in the
 * function or namespace holding it ((a), (g), (h)). */
const S24_NESTED_IMPORT_T = '  import T from "../specs/target.xspec"';

/** A staged `src/c.ts` of T6.5-24 (S-9's record, declared well-formed
 * TypeScript). */
function s24StagedApp(key: string, text: string): StagedTs {
  return stagedTs(`T6.5-24 ${key} ${S23_APP}`, text, "well-formed", "ts");
}

/**
 * The byte span of `spelling` in `text` (UTF-8), TEST-SPEC's `stated` one: a
 * harness defect, thrown at module load, unless the spelling occurs exactly
 * once in the staged text, there.
 */
function s24Span(
  key: string,
  text: string,
  spelling: string,
  stated: S23Span,
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
      `T6.5-24 ${key}: a harness defect — the staged ${S23_APP} must hold ` +
        `\`${spelling}\` exactly once, at TEST-SPEC's ` +
        `[${String(stated.start)}, ${String(stated.end)}); it is found ` +
        (start < 0
          ? "nowhere"
          : `first at ${String(start)} and last at ${String(last)}`),
    );
  }
  return { start, end };
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
 * `import-addition`, which `runS23Arm` asserts wherever nothing is added);
 * and the spelling's edge after the move.
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
    preview: { rewrites: [span], removals: [] },
    edges: [spec.edge],
  };
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

// (f) the callee side's control: the nested `text` binding visible and
// timely at the call.
const S24_F = s24HeldArm({
  key: "(f)",
  lines: [
    'import O, { text as t } from "../specs/origin.xspec"',
    'import T from "../specs/target.xspec"',
    "export function g() {",
    '  import { text as tt } from "../specs/target.xspec"',
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
const S24_ARMS: readonly S23Arm[] = [S24_A, S24_F, S24_G, S24_H];

/**
 * T6.5-24 (SUITE-25): 6.5's eligibility of a held binding for a moved
 * spelling — visible at the occurrence, a nested import's binding only
 * within its own scope (4.5), and, in a TypeScript source, timely under the
 * wholly-between rule, a statement enclosing a nested declaration never
 * standing between it and another. Its arms (a), (f), (g), and (h) each
 * hold a nested binding visible and timely at the moved spelling, which is
 * re-rooted at it, nothing added: (a) `T` imported in the function holding
 * the marker, (f) a call's callee re-rooted at a nested `text` binding, (g)
 * the marker in an arrow function nested in `T`'s scope, (h) the holding
 * container a namespace. Its arms (b) through (e), where the file gains a
 * declaration, are not staged yet.
 */
const T6_5_24 = defineProductTest({
  id: "T6.5-24",
  title:
    "nested bindings: visibility and wholly-between timeliness — arms (a), (f), (g), and (h), each `move specs/origin.mdx#x specs/target.mdx#y` over `src/c.ts` (`specs/origin.mdx` holding `x` and `w`, `specs/target.mdx` holding `z`), the workspace valid before the move, its nested import declaration well-formed (never 14.20), and a held nested binding visible and timely at the moved spelling, which is re-rooted at it, nothing added, `O`'s declaration kept by `O.w`: (a) `import O from \"../specs/origin.xspec\"` above `export function f() {` holding `import T from \"../specs/target.xspec\"`, `O.x`, `O.w`, and `T.z` — `T` visible at the marker and timely, `f` enclosing its declaration and so standing between nothing — the file's one change the marker's span [102, 105) replaced by `T.y`, and `query edges` the marker's `references` edge from `src/c.ts#f` to `specs/target.mdx#y`; (f) the callee side: `t(O.x)` in `g`, beside `g`'s nested `import { text as tt } from \"../specs/target.xspec\"`, below `import O, { text as t } …` and `import T …`, `O.w` after `g` — the call's span [168, 174) replaced by `tt(T.y)`, and the call's `embeds` edge from `src/c.ts#g`; (g) (a) with the marker in the arrow function `h` in `f`, a scope nested within `T`'s — [120, 123) replaced by `T.y`, the edge from `src/c.ts#f.h`; (h) (a) with `namespace N {` in `export function f() {`'s place — [94, 97) replaced by `T.y`, the edge from `src/c.ts#N` — each move exiting 0, `src/c.ts` after it well-formed (TypeScript 5.9.3's module and script readings) and byte-composable exactly, no declaration added, the preview's one `reference-rewrite` spanning the replaced span and no `import-addition` or `import-removal`, and `check` and `build` clean after it (SPEC 6.5, 2.4, 4.5, 4.6, 5.2, 6.6, 11.1, 12.7, 14.20)",
  run: (product) => runS23Arms(product, "T6.5-24", S24_ARMS),
});

/** TEST-SPEC §6.5, sixth part, in canonical ID order (SUITE-25). */
export const section65viTests: readonly ProductTestEntry[] = [T6_5_24];
