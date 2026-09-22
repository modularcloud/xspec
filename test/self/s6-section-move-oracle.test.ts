// S-6 section-move-oracle vectors (TEST-SPEC 17 S-6): the in-harness
// section-move category oracle for P-5 (test/helpers/oracles/section-move.ts)
// passes this fixed vector suite, derived from SPEC.md 6.2's worked
// straddling-line case, the clean-boundary case and sibling stagings of
// TEST-SPEC T6.2-3, and T6.2-4's final-position shapes, before any property
// test trusts it. Every vector's expected sequences and category tables
// are hand-computed; no product is involved (the product's own 6.2/5.6
// behavior is asserted by the suite's T6.2-* tests against fixtures, not
// against this oracle). Every vector's composed documents, before and
// after the move, derive under the harness's own S-9 check (`deriveMdx`)
// wherever the vector states them.
//
// Coverage, by the rules the vectors derive from:
//   * T6.2-3's clean-boundary case: tags alone on their lines — every moved
//     node's own-content sequence is preserved, the origin and target
//     parents are each `changed`, the file roots' `descendant-changed` and
//     the dependents' `upstream-changed` cascade with exact attributions
//     (SPEC 6.2, 5.6);
//   * SPEC 6.2's worked straddling-line case (T6.2-3's impure arm): the
//     moved section's opening tag preceded on its origin line by
//     non-whitespace and followed there only by whitespace — the
//     within-construct remainder and terminator contribute at the origin
//     (line kept) and not at the destination (line dropped, SPEC 3), the
//     moved node itself `changed`, with the two-sided descendant-changed
//     tolerance on the parents and roots exactly as T6.2-3 documents;
//   * T6.2-4's final-position case: a parent's last child moved onto itself
//     reproduces the parent's sequence — no node changes, no categories;
//     its contrast: a non-final child re-inserted at the end changes the
//     coincident parent;
//   * P-5's created-target-file rule: the created root is `changed` as an
//     added node and carries no other category — even over a changed moved
//     descendant;
//   * 6.5's insertion terminators (the preceding U+000A landing in the
//     target parent's run when the insertion point is mid-line), the
//     self-closing moved section, and the self-closing target parent
//     rewrite (T6.5-2's byte rule);
//   * the drop-rule delegation to P-2's oracle, expansion semantics
//     included (a non-empty expansion keeps the origin straddling line);
//   * 6.2's enumeration beyond the parents and the moved subtree — each
//     other node with own-content bytes on a line the deletion joins or
//     drops or the insertion splits, `changed` iff the drop rule of 3
//     decides that line differently: T6.2-3's sibling stagings (d) (a
//     sibling's whitespace residue left alone on the deletion's merged
//     line — kept before, dropped after) and (e) (a sibling's U+000C
//     residue left alone on the line the insertion splits), a residue the
//     deletion joins to prose (dropped before, kept after), and a
//     non-parent ancestor whose whitespace lead rides the merged line;
//   * T6.2-3(c)'s `body</S>` variant with a U+000B/U+000C remainder —
//     whitespace under 1.4, dropped at the destination by the delegated
//     rule whatever the tag's position there;
//   * a section tag spanning lines: its internal terminator deleted with
//     the construct, the lines joined (SPEC 3);
// plus misuse guards: degenerate constructs and incomplete graphs throw
// plain errors (harness defects), never diagnosed product failures.

import { expect, test } from "vitest";
import { deriveMdx } from "../helpers/mdx-derivability.js";
import {
  predictSectionMoveImpact,
  sectionMoveSourceText,
} from "../helpers/oracles/section-move.js";
import type {
  SectionMoveDocument,
  SectionMoveGraphNode,
  SectionMovePiece,
  SectionMovePrediction,
} from "../helpers/oracles/section-move.js";

// --- vector-side document builders -------------------------------------------

// U+000B and U+000C, built from code points (never escape spellings).
const VT = String.fromCharCode(0x0b);
const FF = String.fromCharCode(0x0c);

const content = (text: string): SectionMovePiece => ({ kind: "content", text });

/** S-9: a vector's composed document derives under the harness's own check. */
function expectDerives(label: string, text: string): void {
  expect(
    deriveMdx(text, { allowances: [] }),
    `${label} must derive (S-9): ${JSON.stringify(text)}`,
  ).toEqual({ derives: true });
}

/** A paired-form section with its open-tag props spelled by the vector. */
function sec(
  id: string,
  props: string,
  body: readonly SectionMovePiece[],
  depends: readonly string[] = [],
): SectionMovePiece {
  return {
    kind: "section",
    id,
    open: `<S id="${id}"${props}>`,
    close: "</S>",
    body,
    depends,
  };
}

/** A self-closing section (SPEC 1.1): the whole tag, empty body. */
function selfClosing(id: string, props: string): SectionMovePiece {
  return {
    kind: "section",
    id,
    open: `<S id="${id}"${props} />`,
    close: null,
    body: [],
    depends: [],
  };
}

function doc(
  path: string,
  pieces: readonly SectionMovePiece[],
): SectionMoveDocument {
  return { path, pieces };
}

function node(
  identity: string,
  children: readonly string[] = [],
  edgeTargets: readonly string[] = [],
): SectionMoveGraphNode {
  return { identity, children, edgeTargets };
}

// --- expectation helpers -----------------------------------------------------

interface CategoryRow {
  readonly required: boolean;
  readonly within: readonly string[];
  readonly mustInclude: readonly string[];
}

/** The full prediction table as plain JSON (sorted members). */
function tableOf(
  prediction: SectionMovePrediction,
): Record<string, Record<string, CategoryRow>> {
  const table: Record<string, Record<string, CategoryRow>> = {};
  for (const [identity, nodePrediction] of prediction.nodes) {
    const categories: Record<string, CategoryRow> = {};
    for (const [name, category] of nodePrediction.categories) {
      categories[name] = {
        required: category.required,
        within: [...category.attributionWithin],
        mustInclude: [...category.attributionMustInclude],
      };
    }
    table[identity] = categories;
  }
  return table;
}

/** Required with exact attribution: within = mustInclude = `ids`. */
const req = (...ids: string[]): CategoryRow => ({
  required: true,
  within: [...ids].sort(),
  mustInclude: [...ids].sort(),
});

/** Required, attribution within `within`, must include `mustInclude`. */
const reqWithin = (
  within: readonly string[],
  mustInclude: readonly string[],
): CategoryRow => ({
  required: true,
  within: [...within].sort(),
  mustInclude: [...mustInclude].sort(),
});

/** Tolerated-optional with attribution bound `ids` (a relocated cause). */
const opt = (...ids: string[]): CategoryRow => ({
  required: false,
  within: [...ids].sort(),
  mustInclude: [],
});

/** The `changed` row: attribution within the whole originating set. */
const chg = (allChanged: readonly string[]): CategoryRow => ({
  required: true,
  within: [...allChanged].sort(),
  mustInclude: [],
});

function sortedSet(values: ReadonlySet<string>): string[] {
  return [...values].sort();
}

// =============================================================================
// T6.2-3 clean boundary (the C3 fixture shapes of the suite's section-6.2)
// =============================================================================

const ORIGIN = "specs/Origin.mdx";
const OP = "specs/Origin.mdx#origin";
const TARGET = "specs/Target.mdx";
const TP = "specs/Target.mdx#tgt";
const MV_POST = "specs/Target.mdx#tgt.mv";
const KID_POST = "specs/Target.mdx#tgt.mv.kid";
const WATCH = "specs/Watch.mdx";
const W_TOP = "specs/Watch.mdx#watch";
const W_ONORIGIN = "specs/Watch.mdx#watch.onorigin";
const W_ONTARGET = "specs/Watch.mdx#watch.ontarget";

function cleanOrigin(): SectionMoveDocument {
  // <S id="origin">\nOrigin holder text.\n\n<S id="origin.mv" …>\nMoved root
  // text.\n\n<S id="origin.mv.kid">\nMoved kid text.\n</S>\n</S>\n</S>\n
  return doc(ORIGIN, [
    sec("origin", "", [
      content("\nOrigin holder text.\n\n"),
      sec("origin.mv", ' coverage="none" tags="keep mv"', [
        content("\nMoved root text.\n\n"),
        sec("origin.mv.kid", "", [content("\nMoved kid text.\n")]),
        content("\n"),
      ]),
      content("\n"),
    ]),
    content("\n"),
  ]);
}

function cleanTarget(): SectionMoveDocument {
  return doc(TARGET, [
    sec("tgt", "", [content("\nTarget parent text.\n")]),
    content("\n"),
  ]);
}

const WATCH_NODES: readonly SectionMoveGraphNode[] = [
  node(WATCH, [W_TOP]),
  node(W_TOP, [W_ONORIGIN, W_ONTARGET]),
  node(W_ONORIGIN, [], [OP]),
  node(W_ONTARGET, [], [TP]),
];

test("S-6 (T6.2-3 clean boundary): parents changed, moved subtree preserved, cascades attributed per parent", () => {
  const prediction = predictSectionMoveImpact({
    origin: cleanOrigin(),
    target: cleanTarget(),
    movedId: "origin.mv",
    newId: "tgt.mv",
    otherNodes: WATCH_NODES,
  });

  expect(Object.fromEntries(prediction.identityMap)).toEqual({
    "specs/Origin.mdx#origin.mv": MV_POST,
    "specs/Origin.mdx#origin.mv.kid": KID_POST,
  });
  expect(sortedSet(prediction.changed)).toEqual([OP, TP]);
  expect(sortedSet(prediction.added)).toEqual([]);

  // Every moved node keeps its own-content sequence (clean boundary): the
  // straddling tag-only lines are dropped at origin and destination alike.
  expect(prediction.beforeOwnTokens.get("specs/Origin.mdx#origin.mv")).toEqual([
    ["run", "Moved root text.\n\n"],
    ["child", "specs/Origin.mdx#origin.mv.kid"],
    ["run", ""],
  ]);
  expect(prediction.afterOwnTokens.get(MV_POST)).toEqual([
    ["run", "Moved root text.\n\n"],
    ["child", KID_POST],
    ["run", ""],
  ]);
  expect(
    prediction.beforeOwnTokens.get("specs/Origin.mdx#origin.mv.kid"),
  ).toEqual([["run", "Moved kid text.\n"]]);
  expect(prediction.afterOwnTokens.get(KID_POST)).toEqual([
    ["run", "Moved kid text.\n"],
  ]);

  const changed = [OP, TP];
  expect(tableOf(prediction)).toEqual({
    [ORIGIN]: { "descendant-changed": req(OP) },
    [OP]: { changed: chg(changed) },
    [TARGET]: { "descendant-changed": req(TP) },
    [TP]: { changed: chg(changed) },
    [MV_POST]: {},
    [KID_POST]: {},
    [WATCH]: { "upstream-changed": req(OP, TP) },
    [W_TOP]: { "upstream-changed": req(OP, TP) },
    [W_ONORIGIN]: { "upstream-changed": req(OP) },
    [W_ONTARGET]: { "upstream-changed": req(TP) },
  });
});

// =============================================================================
// SPEC 6.2's worked straddling-line case (T6.2-3's impure arm; the I3 shapes)
// =============================================================================

const ROOM = "specs/Room.mdx";
const I_OP = "specs/Room.mdx#op";
const I_IMP_PRE = "specs/Room.mdx#op.imp";
const HALL = "specs/Hall.mdx";
const I_TP = "specs/Hall.mdx#tp";
const I_IMP_POST = "specs/Hall.mdx#tp.imp";
const DEPS = "specs/Deps.mdx";
const D_TOP = "specs/Deps.mdx#watch";
const D_ONIMP = "specs/Deps.mdx#watch.onimp";

function impureRoom(): SectionMoveDocument {
  // <S id="op">\nOp holder text.\n\nLead-in prose.<S id="op.imp" …>  \n
  // Impure line one.\nImpure line two.\n</S>\n</S>\n — the moved section's
  // opening tag preceded on its line by non-whitespace and followed there
  // only by whitespace (SPEC 6.2's worked case).
  return doc(ROOM, [
    sec("op", "", [
      content("\nOp holder text.\n\nLead-in prose."),
      sec("op.imp", ' coverage="none" tags="edge imp"', [
        content("  \nImpure line one.\nImpure line two.\n"),
      ]),
      content("\n"),
    ]),
    content("\n"),
  ]);
}

function impureHall(): SectionMoveDocument {
  return doc(HALL, [
    sec("tp", "", [content("\nHall parent text.\n")]),
    content("\n"),
  ]);
}

const DEPS_NODES: readonly SectionMoveGraphNode[] = [
  node(DEPS, [D_TOP]),
  node(D_TOP, [D_ONIMP]),
  node(D_ONIMP, [], [I_IMP_PRE]),
];

test("S-6 (SPEC 6.2 worked case): the impure-boundary moved node contributes the remainder and terminator at the origin, not at the destination, and is itself changed", () => {
  const prediction = predictSectionMoveImpact({
    origin: impureRoom(),
    target: impureHall(),
    movedId: "op.imp",
    newId: "tp.imp",
    otherNodes: DEPS_NODES,
  });

  // The straddling-line drop of 6.2, computed by the rules of 3: at the
  // origin the opening tag's line is kept (preceded by `Lead-in prose.`),
  // so the within-construct remainder `  ` and its terminator contribute;
  // at the destination the tag-only line is dropped.
  expect(prediction.beforeOwnTokens.get(I_IMP_PRE)).toEqual([
    ["run", "  \nImpure line one.\nImpure line two.\n"],
  ]);
  expect(prediction.afterOwnTokens.get(I_IMP_POST)).toEqual([
    ["run", "Impure line one.\nImpure line two.\n"],
  ]);
  // The origin parent keeps the lead-in prose and the merged line's
  // terminator after the deletion.
  expect(prediction.afterOwnTokens.get(I_OP)).toEqual([
    ["run", "Op holder text.\n\nLead-in prose.\n"],
  ]);

  expect(sortedSet(prediction.changed)).toEqual([I_TP, I_IMP_POST, I_OP]);
  expect(sortedSet(prediction.added)).toEqual([]);

  const changed = [I_OP, I_TP, I_IMP_POST];
  expect(tableOf(prediction)).toEqual({
    [ROOM]: {
      "descendant-changed": reqWithin([I_OP, I_IMP_POST], [I_OP]),
    },
    [I_OP]: {
      changed: chg(changed),
      "descendant-changed": opt(I_IMP_POST),
    },
    [HALL]: {
      "descendant-changed": reqWithin([I_TP, I_IMP_POST], [I_TP]),
    },
    [I_TP]: {
      changed: chg(changed),
      "descendant-changed": opt(I_IMP_POST),
    },
    [I_IMP_POST]: { changed: chg(changed) },
    [DEPS]: { "upstream-changed": req(I_IMP_POST) },
    [D_TOP]: { "upstream-changed": req(I_IMP_POST) },
    [D_ONIMP]: { "upstream-changed": req(I_IMP_POST) },
  });
});

// =============================================================================
// T6.2-4 final position (the P4 shapes) and its non-final contrast
// =============================================================================

const P_FILE = "specs/P.mdx";
const P_TOP = "specs/P.mdx#p";
const P_FIRST = "specs/P.mdx#p.first";
const P_LAST = "specs/P.mdx#p.last";
const P_FINAL = "specs/P.mdx#p.final";
const P_WATCH = "specs/Watch.mdx";
const P_W_TOP = "specs/Watch.mdx#watch";

function pDoc(): SectionMoveDocument {
  // <S id="p">\nParent text.\n\n<S id="p.first">\nFirst child text.\n</S>\n
  // \n<S id="p.last" …>\nTail child text.\n</S>\n</S>\n
  return doc(P_FILE, [
    sec("p", "", [
      content("\nParent text.\n\n"),
      sec("p.first", "", [content("\nFirst child text.\n")]),
      content("\n\n"),
      sec("p.last", ' coverage="none" tags="tail"', [
        content("\nTail child text.\n"),
      ]),
      content("\n"),
    ]),
    content("\n"),
  ]);
}

const P_WATCH_NODES: readonly SectionMoveGraphNode[] = [
  node(P_WATCH, [P_W_TOP]),
  // `d={P.p.last}` plus `{text(P.p.last)}`: two edge kinds, one target.
  node(P_W_TOP, [], [P_LAST, P_LAST]),
];

test("S-6 (T6.2-4): a parent's last child moved onto itself reproduces the parent's sequence — no node changed, no categories", () => {
  const document = pDoc();
  const prediction = predictSectionMoveImpact({
    origin: document,
    target: document,
    movedId: "p.last",
    newId: "p.final",
    otherNodes: P_WATCH_NODES,
  });

  expect(Object.fromEntries(prediction.identityMap)).toEqual({
    [P_LAST]: P_FINAL,
  });
  expect(sortedSet(prediction.changed)).toEqual([]);
  expect(sortedSet(prediction.added)).toEqual([]);
  // The coincident parent's re-insertion reproduces its sequence exactly
  // (SPEC 6.2: a final construct re-inserted at its own former position).
  expect(prediction.afterOwnTokens.get(P_TOP)).toEqual([
    ["run", "Parent text.\n\n"],
    ["child", P_FIRST],
    ["run", "\n"],
    ["child", P_FINAL],
    ["run", ""],
  ]);
  expect(tableOf(prediction)).toEqual({
    [P_FILE]: {},
    [P_TOP]: {},
    [P_FIRST]: {},
    [P_FINAL]: {},
    [P_WATCH]: {},
    [P_W_TOP]: {},
  });
});

test("S-6 (T6.2-4 contrast): a non-final child re-inserted at the end fails to reproduce the coincident parent's sequence — the parent alone is changed", () => {
  const document = pDoc();
  const prediction = predictSectionMoveImpact({
    origin: document,
    target: document,
    movedId: "p.first",
    newId: "p.zeta",
  });

  expect(sortedSet(prediction.changed)).toEqual([P_TOP]);
  // Children reordered and the dropped/kept line pattern shifted: the
  // parent's own-content sequence differs.
  expect(prediction.afterOwnTokens.get(P_TOP)).toEqual([
    ["run", "Parent text.\n\n\n"],
    ["child", P_LAST],
    ["run", ""],
    ["child", "specs/P.mdx#p.zeta"],
    ["run", ""],
  ]);
  expect(tableOf(prediction)).toEqual({
    [P_FILE]: { "descendant-changed": req(P_TOP) },
    [P_TOP]: { changed: chg([P_TOP]) },
    [P_LAST]: {},
    ["specs/P.mdx#p.zeta"]: {},
  });
});

// =============================================================================
// Created target file: the root is changed as an added node (P-5)
// =============================================================================

const NEW_FILE = "specs/New.mdx";
const NEW_IMP = "specs/New.mdx#imp2";

test("S-6 (P-5 created target): the created root is changed by addition and carries no other category — even over a changed moved descendant", () => {
  const prediction = predictSectionMoveImpact({
    origin: impureRoom(),
    target: { createdPath: NEW_FILE },
    movedId: "op.imp",
    newId: "imp2",
    otherNodes: DEPS_NODES,
  });

  expect(sortedSet(prediction.added)).toEqual([NEW_FILE]);
  expect(sortedSet(prediction.changed)).toEqual([NEW_FILE, NEW_IMP, I_OP]);
  // The created file's context is a line start with a trailing terminator
  // (6.5), so the impure boundary still drops the tag-only line there.
  expect(prediction.afterOwnTokens.get(NEW_IMP)).toEqual([
    ["run", "Impure line one.\nImpure line two.\n"],
  ]);

  const changed = [I_OP, NEW_FILE, NEW_IMP];
  expect(tableOf(prediction)).toEqual({
    [ROOM]: { "descendant-changed": reqWithin([I_OP, NEW_IMP], [I_OP]) },
    [I_OP]: {
      changed: chg(changed),
      "descendant-changed": opt(NEW_IMP),
    },
    // Added: `changed` only — never descendant-changed, whatever changed
    // children it holds (SPEC 5.6; P-5: by addition, not comparison).
    [NEW_FILE]: { changed: chg(changed) },
    [NEW_IMP]: { changed: chg(changed) },
    [DEPS]: { "upstream-changed": req(NEW_IMP) },
    [D_TOP]: { "upstream-changed": req(NEW_IMP) },
    [D_ONIMP]: { "upstream-changed": req(NEW_IMP) },
  });
});

// =============================================================================
// Self-closing arms (SPEC 1.1; T6.5-2's target-parent rewrite)
// =============================================================================

test("S-6 (6.5 self-closing moved section): the tag's own characters move; its empty sequence is preserved", () => {
  const origin = doc("specs/O.mdx", [
    sec("op", "", [
      content("\nOp text.\n"),
      selfClosing("op.solo", ""),
      content("\n"),
    ]),
    content("\n"),
  ]);
  const target = doc("specs/H.mdx", [
    sec("tp", "", [content("\nHall parent text.\n")]),
    content("\n"),
  ]);
  const prediction = predictSectionMoveImpact({
    origin,
    target,
    movedId: "op.solo",
    newId: "tp.solo",
  });
  expect(sortedSet(prediction.changed)).toEqual([
    "specs/H.mdx#tp",
    "specs/O.mdx#op",
  ]);
  expect(prediction.afterOwnTokens.get("specs/H.mdx#tp.solo")).toEqual([
    ["run", ""],
  ]);
  const changed = ["specs/O.mdx#op", "specs/H.mdx#tp"];
  expect(tableOf(prediction)).toEqual({
    "specs/O.mdx": { "descendant-changed": req("specs/O.mdx#op") },
    "specs/O.mdx#op": { changed: chg(changed) },
    "specs/H.mdx": { "descendant-changed": req("specs/H.mdx#tp") },
    "specs/H.mdx#tp": { changed: chg(changed) },
    "specs/H.mdx#tp.solo": {},
  });
});

test("S-6 (T6.5-2): a self-closing target parent is rewritten to paired form and gains the moved child, the moved subtree preserved", () => {
  const origin = doc("specs/O.mdx", [
    sec("m", "", [content("\nMoved body.\n")]),
    content("\n"),
  ]);
  const target = doc("specs/H.mdx", [selfClosing("tp", ""), content("\n")]);
  const prediction = predictSectionMoveImpact({
    origin,
    target,
    movedId: "m",
    newId: "tp.m",
  });
  // The rewrite (`<S id="tp">` + U+000A + moved + U+000A + `</S>`) keeps
  // the moved node's clean boundary: sequence preserved.
  expect(prediction.beforeOwnTokens.get("specs/O.mdx#m")).toEqual([
    ["run", "Moved body.\n"],
  ]);
  expect(prediction.afterOwnTokens.get("specs/H.mdx#tp.m")).toEqual([
    ["run", "Moved body.\n"],
  ]);
  expect(prediction.afterOwnTokens.get("specs/H.mdx#tp")).toEqual([
    ["run", ""],
    ["child", "specs/H.mdx#tp.m"],
    ["run", ""],
  ]);
  const changed = ["specs/O.mdx", "specs/H.mdx#tp"];
  expect(tableOf(prediction)).toEqual({
    "specs/O.mdx": { changed: chg(changed) },
    "specs/H.mdx": { "descendant-changed": req("specs/H.mdx#tp") },
    "specs/H.mdx#tp": { changed: chg(changed) },
    "specs/H.mdx#tp.m": {},
  });
});

// =============================================================================
// Insertion terminators (SPEC 6.5): the mid-line insertion point
// =============================================================================

test("S-6 (6.5 insertion): a top-level move into a file whose last line has no terminator inserts the preceding U+000A into the target root's run", () => {
  const origin = doc("specs/O.mdx", [
    sec("m", "", [content("\nM body.\n")]),
    content("\n"),
  ]);
  // `<S id="tp">x</S>` with no trailing terminator: the insertion point
  // (end of file) is not at a line start.
  const target = doc("specs/T.mdx", [sec("tp", "", [content("x")])]);
  const prediction = predictSectionMoveImpact({
    origin,
    target,
    movedId: "m",
    newId: "z",
  });
  expect(prediction.afterOwnTokens.get("specs/T.mdx")).toEqual([
    ["run", ""],
    ["child", "specs/T.mdx#tp"],
    ["run", "\n"], // the inserted preceding terminator (SPEC 6.5)
    ["child", "specs/T.mdx#z"],
    ["run", ""],
  ]);
  const changed = ["specs/O.mdx", "specs/T.mdx"];
  expect(sortedSet(prediction.changed)).toEqual([...changed].sort());
  expect(tableOf(prediction)).toEqual({
    "specs/O.mdx": { changed: chg(changed) },
    "specs/T.mdx": { changed: chg(changed) },
    "specs/T.mdx#tp": {},
    "specs/T.mdx#z": {},
  });
});

// =============================================================================
// Drop-rule delegation to P-2's oracle: expansion semantics
// =============================================================================

test("S-6 (3, delegated): a non-empty expansion keeps the origin straddling line — the moved node's leading terminator contributes there and not at the destination", () => {
  const origin = doc("specs/E.mdx", [
    sec("op", "", [
      content("\nOp text.\n\n"),
      {
        kind: "embedding",
        text: "{text(X)}",
        expansion: "EXP",
        target: "specs/X.mdx#x",
      },
      sec("op.mv", "", [content("\nBody.\n")]),
      content("\n"),
    ]),
    content("\n"),
  ]);
  const target = doc("specs/H2.mdx", [
    sec("tp", "", [content("\nHall text.\n")]),
    content("\n"),
  ]);
  const prediction = predictSectionMoveImpact({
    origin,
    target,
    movedId: "op.mv",
    newId: "tp.mv",
    otherNodes: [node("specs/X.mdx", ["specs/X.mdx#x"]), node("specs/X.mdx#x")],
  });

  // Origin: the line `{text(X)}<S id="op.mv">` + terminator is kept — the
  // non-empty expansion keeps it (3) — so the moved node's leading
  // terminator contributes at the origin; the destination drops the
  // tag-only line.
  expect(prediction.beforeOwnTokens.get("specs/E.mdx#op.mv")).toEqual([
    ["run", "\nBody.\n"],
  ]);
  expect(prediction.afterOwnTokens.get("specs/H2.mdx#tp.mv")).toEqual([
    ["run", "Body.\n"],
  ]);
  // The origin parent keeps the embedding token and gains the merged
  // line's terminator (the line stays kept after the deletion).
  expect(prediction.afterOwnTokens.get("specs/E.mdx#op")).toEqual([
    ["run", "Op text.\n\n"],
    ["embed", "specs/X.mdx#x"],
    ["run", "\n"],
  ]);

  const MV2 = "specs/H2.mdx#tp.mv";
  const changed = ["specs/E.mdx#op", "specs/H2.mdx#tp", MV2];
  expect(sortedSet(prediction.changed)).toEqual([...changed].sort());
  expect(tableOf(prediction)).toEqual({
    "specs/E.mdx": {
      "descendant-changed": reqWithin(
        ["specs/E.mdx#op", MV2],
        ["specs/E.mdx#op"],
      ),
    },
    "specs/E.mdx#op": {
      changed: chg(changed),
      "descendant-changed": opt(MV2),
    },
    "specs/H2.mdx": {
      "descendant-changed": reqWithin(
        ["specs/H2.mdx#tp", MV2],
        ["specs/H2.mdx#tp"],
      ),
    },
    "specs/H2.mdx#tp": {
      changed: chg(changed),
      "descendant-changed": opt(MV2),
    },
    [MV2]: { changed: chg(changed) },
    "specs/X.mdx": {},
    "specs/X.mdx#x": {},
  });
});

// =============================================================================
// 6.2's enumeration beyond the parents and the moved subtree: a sibling
// whose residue the deletion joins to prose (dropped before, kept after)
// =============================================================================

const G = "specs/G.mdx";
const G_P = "specs/G.mdx#p";
const G_PX = "specs/G.mdx#p.x";
const G_MV_PRE = "specs/G.mdx#p.mv";
const H3 = "specs/H3.mdx";
const H3_TP = "specs/H3.mdx#tp";
const H3_MV = "specs/H3.mdx#tp.mv";

test("S-6 (6.2's enumeration): a sibling whose whitespace residue the deletion joins to prose — its line dropped before, kept after — is changed", () => {
  // Origin `<S id="p">`, U+000A, `<S id="p.x"> </S><S id="p.mv">`, U+000C,
  // U+000A, `M.`, U+000A, U+000C, `</S>tail`, U+000A, `</S>`, U+000A — the
  // moved section in T6.2-3(b)'s both-sided spelling (its tags in text
  // position at both sides), the sibling `p.x` sharing its opening line.
  // Before, that line is left whitespace-only purely by removals (` ` and
  // U+000C are 1.4 whitespace) and drops, so `p.x` contributes nothing;
  // the deletion joins the residue `<S id="p.x"> </S>` to `tail`, a kept
  // line, so its run ` ` appears — `p.x` is `changed` beside the parents.
  // The moved node's lead U+000C rides a kept line at the origin and a
  // dropped one at the destination, so it is `changed` too (T6.2-3(b)).
  const origin = doc(G, [
    sec("p", "", [
      content("\n"),
      sec("p.x", "", [content(" ")]),
      sec("p.mv", "", [content(`${FF}\nM.\n${FF}`)]),
      content("tail\n"),
    ]),
    content("\n"),
  ]);
  const target = doc(H3, [sec("tp", "", [content("\nT.\n")]), content("\n")]);
  expectDerives("G before", sectionMoveSourceText(origin.pieces));
  expectDerives("G after", '<S id="p">\n<S id="p.x"> </S>tail\n</S>\n');
  expectDerives("H3 before", sectionMoveSourceText(target.pieces));
  expectDerives(
    "H3 after",
    `<S id="tp">\nT.\n<S id="tp.mv">${FF}\nM.\n${FF}</S>\n</S>\n`,
  );

  const prediction = predictSectionMoveImpact({
    origin,
    target,
    movedId: "p.mv",
    newId: "tp.mv",
  });

  expect(prediction.beforeOwnTokens.get(G_PX)).toEqual([["run", ""]]);
  expect(prediction.afterOwnTokens.get(G_PX)).toEqual([["run", " "]]);
  expect(prediction.beforeOwnTokens.get(G_MV_PRE)).toEqual([
    ["run", `M.\n${FF}`],
  ]);
  expect(prediction.afterOwnTokens.get(H3_MV)).toEqual([["run", "M.\n"]]);
  expect(prediction.afterOwnTokens.get(G_P)).toEqual([
    ["run", ""],
    ["child", G_PX],
    ["run", "tail\n"],
  ]);

  expect(sortedSet(prediction.changed)).toEqual([G_P, G_PX, H3_TP, H3_MV]);
  expect(sortedSet(prediction.added)).toEqual([]);

  const changed = [G_P, G_PX, H3_TP, H3_MV];
  expect(tableOf(prediction)).toEqual({
    [G]: {
      "descendant-changed": reqWithin([G_P, G_PX, H3_MV], [G_P, G_PX]),
    },
    [G_P]: {
      changed: chg(changed),
      "descendant-changed": reqWithin([G_PX, H3_MV], [G_PX]),
    },
    [G_PX]: { changed: chg(changed) },
    [H3]: { "descendant-changed": reqWithin([H3_TP, H3_MV], [H3_TP]) },
    [H3_TP]: { changed: chg(changed), "descendant-changed": opt(H3_MV) },
    [H3_MV]: { changed: chg(changed) },
  });
});

// =============================================================================
// T6.2-3's sibling stagings (d) and (e), and a non-parent ancestor: 6.2's
// enumeration reaching every node with bytes on a line the edits touch
// =============================================================================

const A = "specs/a.mdx";
const A_P = "specs/a.mdx#p";
const A_PS = "specs/a.mdx#p.s";
const A_PM = "specs/a.mdx#p.m";
const B = "specs/b.mdx";
const B_K = "specs/b.mdx#k";
const B_M = "specs/b.mdx#m";

test("S-6 (T6.2-3(d)): at the origin, a sibling's whitespace residue left alone on the deletion's merged line — kept before, dropped after — is changed; the moved node keeps its sequence", () => {
  // Origin `<S id="p">`, U+000A, `<S id="p.s"> </S><S id="p.m">text</S>`,
  // U+000A, `</S>`, U+000A; `move a.mdx#p.m b.mdx#m`, the target
  // `<S id="k">z</S>`, U+000A. The second line, a paragraph of two in-line
  // siblings, is kept before (`text` remaining once the tags are removed)
  // and dropped after (`<S id="p.s"> </S>` alone, whitespace-only purely by
  // removals), so `p.s` loses its run ` `; `p.m`'s `text` rides a kept
  // line at both sides.
  const origin = doc(A, [
    sec("p", "", [
      content("\n"),
      sec("p.s", "", [content(" ")]),
      sec("p.m", "", [content("text")]),
      content("\n"),
    ]),
    content("\n"),
  ]);
  const target = doc(B, [sec("k", "", [content("z")]), content("\n")]);
  expectDerives("a before", sectionMoveSourceText(origin.pieces));
  expectDerives("a after", '<S id="p">\n<S id="p.s"> </S>\n</S>\n');
  expectDerives("b before", sectionMoveSourceText(target.pieces));
  expectDerives("b after", '<S id="k">z</S>\n<S id="m">text</S>\n');

  const prediction = predictSectionMoveImpact({
    origin,
    target,
    movedId: "p.m",
    newId: "m",
  });

  expect(prediction.beforeOwnTokens.get(A_PS)).toEqual([["run", " "]]);
  expect(prediction.afterOwnTokens.get(A_PS)).toEqual([["run", ""]]);
  expect(prediction.beforeOwnTokens.get(A_PM)).toEqual([["run", "text"]]);
  expect(prediction.afterOwnTokens.get(B_M)).toEqual([["run", "text"]]);
  expect(prediction.beforeOwnTokens.get(A_P)).toEqual([
    ["run", ""],
    ["child", A_PS],
    ["run", ""],
    ["child", A_PM],
    ["run", "\n"],
  ]);
  expect(prediction.afterOwnTokens.get(A_P)).toEqual([
    ["run", ""],
    ["child", A_PS],
    ["run", ""],
  ]);
  expect(prediction.afterOwnTokens.get(B)).toEqual([
    ["run", ""],
    ["child", B_K],
    ["run", "\n"],
    ["child", B_M],
    ["run", "\n"],
  ]);

  expect(sortedSet(prediction.changed)).toEqual([A_P, A_PS, B]);
  const changed = [A_P, A_PS, B];
  expect(tableOf(prediction)).toEqual({
    [A]: { "descendant-changed": req(A_P, A_PS) },
    [A_P]: { changed: chg(changed), "descendant-changed": req(A_PS) },
    [A_PS]: { changed: chg(changed) },
    [B]: { changed: chg(changed) },
    [B_K]: {},
    [B_M]: {},
  });
});

const E_A = "specs/ea.mdx";
const E_AA = "specs/ea.mdx#a";
const E_B = "specs/eb.mdx";
const E_BP = "specs/eb.mdx#p";
const E_BPS = "specs/eb.mdx#p.s";
const E_BPN = "specs/eb.mdx#p.n";

test("S-6 (T6.2-3(e)): at the destination, a sibling's U+000C residue left alone on the line the insertion splits — kept before, dropped after — is changed; the target root keeps its content", () => {
  // Target `foo <S id="p">`, U+000A, `<S id="p.s">`, U+000C, `</S></S> tail`,
  // U+000A receiving `<S id="m">text</S>` (alone on its origin line) into
  // `p.n`: the insertion point, preceded by `p.s`'s closing tag, is not at
  // a line start, so 6.5's added terminator splits the line, leaving
  // `<S id="p.s">`, U+000C, `</S>` alone — dropped as whitespace-only under
  // 1.4 — while `foo ` and ` tail` ride kept lines at both sides.
  const origin = doc(E_A, [
    sec("a", "", [content("x")]),
    content("\n"),
    sec("m", "", [content("text")]),
    content("\n"),
  ]);
  const target = doc(E_B, [
    content("foo "),
    sec("p", "", [content("\n"), sec("p.s", "", [content(FF)])]),
    content(" tail\n"),
  ]);
  expectDerives("ea before", sectionMoveSourceText(origin.pieces));
  expectDerives("ea after", '<S id="a">x</S>\n');
  expectDerives("eb before", sectionMoveSourceText(target.pieces));
  expectDerives(
    "eb after",
    `foo <S id="p">\n<S id="p.s">${FF}</S>\n<S id="p.n">text</S>\n</S> tail\n`,
  );

  const prediction = predictSectionMoveImpact({
    origin,
    target,
    movedId: "m",
    newId: "p.n",
  });

  expect(prediction.beforeOwnTokens.get(E_BPS)).toEqual([["run", FF]]);
  expect(prediction.afterOwnTokens.get(E_BPS)).toEqual([["run", ""]]);
  expect(prediction.afterOwnTokens.get(E_BPN)).toEqual([["run", "text"]]);
  expect(prediction.beforeOwnTokens.get(E_B)).toEqual([
    ["run", "foo "],
    ["child", E_BP],
    ["run", " tail\n"],
  ]);
  expect(prediction.afterOwnTokens.get(E_B)).toEqual([
    ["run", "foo "],
    ["child", E_BP],
    ["run", " tail\n"],
  ]);
  expect(prediction.afterOwnTokens.get(E_BP)).toEqual([
    ["run", "\n"],
    ["child", E_BPS],
    ["run", ""],
    ["child", E_BPN],
    ["run", "\n"],
  ]);
  expect(prediction.afterOwnTokens.get(E_A)).toEqual([
    ["run", ""],
    ["child", E_AA],
    ["run", "\n"],
  ]);

  expect(sortedSet(prediction.changed)).toEqual([E_A, E_BP, E_BPS]);
  const changed = [E_A, E_BP, E_BPS];
  expect(tableOf(prediction)).toEqual({
    [E_A]: { changed: chg(changed) },
    [E_AA]: {},
    [E_B]: { "descendant-changed": req(E_BP, E_BPS) },
    [E_BP]: { changed: chg(changed), "descendant-changed": req(E_BPS) },
    [E_BPS]: { changed: chg(changed) },
    [E_BPN]: {},
  });
});

const N_A = "specs/na.mdx";
const N_G = "specs/na.mdx#g";
const N_GP = "specs/na.mdx#g.p";
const N_GPM = "specs/na.mdx#g.p.m";
const N_B = "specs/nb.mdx";
const N_BK = "specs/nb.mdx#k";
const N_BM = "specs/nb.mdx#m";

test("S-6 (6.2's enumeration): a non-parent ancestor whose whitespace lead rides the deletion's merged line — kept before, dropped after — is changed", () => {
  // Origin `<S id="g">`, U+000A, `  <S id="g.p"><S id="g.p.m">body`, U+000A,
  // `lead</S></S>`, U+000A, `</S>`, U+000A: the moved section a multi-line
  // in-line section with prose remainder and lead (both text-position),
  // the parent `g.p` an in-line element holding nothing else, and the
  // grandparent `g` owning the opening line's two-space lead and the
  // closing line's terminator — on kept lines before (`body`, `lead`) and
  // on the merged line `  <S id="g.p"></S>` after, whitespace-only purely
  // by removals and dropped. Moved to `nb.mdx`'s top level, the moved node
  // keeps its sequence: `body`, U+000A, `lead` ride kept lines there too.
  const origin = doc(N_A, [
    sec("g", "", [
      content("\n  "),
      sec("g.p", "", [sec("g.p.m", "", [content("body\nlead")])]),
      content("\n"),
    ]),
    content("\n"),
  ]);
  const target = doc(N_B, [sec("k", "", [content("z")]), content("\n")]);
  expectDerives("na before", sectionMoveSourceText(origin.pieces));
  expectDerives("na after", '<S id="g">\n  <S id="g.p"></S>\n</S>\n');
  expectDerives("nb before", sectionMoveSourceText(target.pieces));
  expectDerives("nb after", '<S id="k">z</S>\n<S id="m">body\nlead</S>\n');

  const prediction = predictSectionMoveImpact({
    origin,
    target,
    movedId: "g.p.m",
    newId: "m",
  });

  expect(prediction.beforeOwnTokens.get(N_G)).toEqual([
    ["run", "  "],
    ["child", N_GP],
    ["run", "\n"],
  ]);
  expect(prediction.afterOwnTokens.get(N_G)).toEqual([
    ["run", ""],
    ["child", N_GP],
    ["run", ""],
  ]);
  expect(prediction.afterOwnTokens.get(N_GP)).toEqual([["run", ""]]);
  expect(prediction.beforeOwnTokens.get(N_GPM)).toEqual([
    ["run", "body\nlead"],
  ]);
  expect(prediction.afterOwnTokens.get(N_BM)).toEqual([["run", "body\nlead"]]);

  expect(sortedSet(prediction.changed)).toEqual([N_G, N_GP, N_B]);
  const changed = [N_G, N_GP, N_B];
  expect(tableOf(prediction)).toEqual({
    [N_A]: { "descendant-changed": req(N_G, N_GP) },
    [N_G]: { changed: chg(changed), "descendant-changed": req(N_GP) },
    [N_GP]: { changed: chg(changed) },
    [N_B]: { changed: chg(changed) },
    [N_BK]: {},
    [N_BM]: {},
  });
});

// =============================================================================
// T6.2-3(c): the `body</S>` variant with a U+000B/U+000C remainder
// =============================================================================

const C_A = "specs/ca.mdx";
const C_AM = "specs/ca.mdx#m";
const C_B = "specs/cb.mdx";
const C_BK = "specs/cb.mdx#k";
const C_BM = "specs/cb.mdx#m";

for (const [name, ws] of [
  ["U+000B", VT],
  ["U+000C", FF],
] as const) {
  test(`S-6 (T6.2-3(c)): the body</S> variant with a ${name} remainder — whitespace under 1.4 — drops its opening line at the destination whatever the tag's position there, so the moved node is changed`, () => {
    // Origin `foo <S id="m">`, ${name}, U+000A, `body</S>`, U+000A — an
    // in-line section closed within its paragraph — moved to `cb.mdx`'s top
    // level (`<S id="k">z</S>`, U+000A): the origin's opening line is kept
    // (`foo`), contributing the remainder and its terminator; the
    // destination line `<S id="m">`, ${name} is whitespace-only purely by
    // the removal and drops — the tag staying an in-line tag there too — so
    // the moved node loses those two characters; both roots `changed` as
    // parents, no other node.
    const origin = doc(C_A, [
      content("foo "),
      sec("m", "", [content(`${ws}\nbody`)]),
      content("\n"),
    ]);
    const target = doc(C_B, [sec("k", "", [content("z")]), content("\n")]);
    expectDerives("ca before", sectionMoveSourceText(origin.pieces));
    expectDerives("ca after", "foo \n");
    expectDerives("cb before", sectionMoveSourceText(target.pieces));
    expectDerives("cb after", `<S id="k">z</S>\n<S id="m">${ws}\nbody</S>\n`);

    const prediction = predictSectionMoveImpact({
      origin,
      target,
      movedId: "m",
      newId: "m",
    });

    expect(prediction.beforeOwnTokens.get(C_AM)).toEqual([
      ["run", `${ws}\nbody`],
    ]);
    expect(prediction.afterOwnTokens.get(C_BM)).toEqual([["run", "body"]]);
    expect(prediction.afterOwnTokens.get(C_A)).toEqual([["run", "foo \n"]]);
    expect(prediction.afterOwnTokens.get(C_B)).toEqual([
      ["run", ""],
      ["child", C_BK],
      ["run", "\n"],
      ["child", C_BM],
      ["run", "\n"],
    ]);

    expect(sortedSet(prediction.changed)).toEqual([C_A, C_B, C_BM]);
    const changed = [C_A, C_B, C_BM];
    expect(tableOf(prediction)).toEqual({
      [C_A]: { changed: chg(changed), "descendant-changed": opt(C_BM) },
      [C_B]: { changed: chg(changed), "descendant-changed": opt(C_BM) },
      [C_BK]: {},
      [C_BM]: { changed: chg(changed) },
    });
  });
}

// =============================================================================
// Multi-line section tags (SPEC 3): a tag's internal terminators
// =============================================================================

test("S-6 (3): a section tag spanning lines — its internal terminator deleted with the construct, the lines joined — is handled like any multi-line removal", () => {
  // Origin `<S`, U+000A, `  id="m">`, U+000A, `x`, U+000A, `</S>`, U+000A
  // (the own-lines multi-line tag form of the §3 fixtures), moved to a
  // created file: the joined tag line is left empty purely by the removal
  // at both sides and drops, so the moved node's sequence is preserved;
  // the deletion leaves the origin empty (its whole first line dropped).
  const O = "specs/O.mdx";
  const N = "specs/N.mdx";
  const origin = doc(O, [
    {
      kind: "section",
      id: "m",
      open: '<S\n  id="m">',
      close: "</S>",
      body: [content("\nx\n")],
      depends: [],
    },
    content("\n"),
  ]);
  expectDerives("O before", sectionMoveSourceText(origin.pieces));
  expectDerives("O after", "");
  expectDerives("N after", '<S\n  id="m2">\nx\n</S>\n');

  const prediction = predictSectionMoveImpact({
    origin,
    target: { createdPath: N },
    movedId: "m",
    newId: "m2",
  });
  expect(prediction.beforeOwnTokens.get(`${O}#m`)).toEqual([["run", "x\n"]]);
  expect(prediction.afterOwnTokens.get(`${N}#m2`)).toEqual([["run", "x\n"]]);
  expect(prediction.afterOwnTokens.get(O)).toEqual([["run", ""]]);
  expect(sortedSet(prediction.changed)).toEqual([N, O]);
  expect(sortedSet(prediction.added)).toEqual([N]);
  const changed = [N, O];
  expect(tableOf(prediction)).toEqual({
    [N]: { changed: chg(changed) },
    [`${N}#m2`]: {},
    [O]: { changed: chg(changed) },
  });
});

// =============================================================================
// Misuse guards
// =============================================================================

test("S-6: a moved id the origin does not spell throws", () => {
  expect(() =>
    predictSectionMoveImpact({
      origin: cleanOrigin(),
      target: cleanTarget(),
      movedId: "origin.absent",
      newId: "tgt.z",
    }),
  ).toThrow(/oracle misuse:.*spells no section/);
});

test("S-6: a missing target parent throws — the oracle predicts successful moves only", () => {
  expect(() =>
    predictSectionMoveImpact({
      origin: cleanOrigin(),
      target: cleanTarget(),
      movedId: "origin.mv",
      newId: "zz.mv",
    }),
  ).toThrow(/oracle misuse:.*spells no section/);
});

test("S-6: a created target file with a multi-segment new id throws", () => {
  expect(() =>
    predictSectionMoveImpact({
      origin: cleanOrigin(),
      target: { createdPath: "specs/New.mdx" },
      movedId: "origin.mv",
      newId: "a.b",
    }),
  ).toThrow(/oracle misuse:.*single-segment/);
});

test("S-6: a self-closing section declaring a body throws", () => {
  const origin = doc("specs/O.mdx", [
    {
      kind: "section",
      id: "m",
      open: '<S id="m" />',
      close: null,
      body: [content("x")],
      depends: [],
    },
    content("\n"),
  ]);
  expect(() =>
    predictSectionMoveImpact({
      origin,
      target: { createdPath: "specs/N.mdx" },
      movedId: "m",
      newId: "m2",
    }),
  ).toThrow(/oracle misuse:.*no body/);
});

test("S-6: an otherNodes edge target that is no node throws — the cascade graph must be complete", () => {
  expect(() =>
    predictSectionMoveImpact({
      origin: cleanOrigin(),
      target: cleanTarget(),
      movedId: "origin.mv",
      newId: "tgt.mv",
      otherNodes: [node("specs/W.mdx", [], ["specs/Gone.mdx#nope"])],
    }),
  ).toThrow(/oracle misuse:.*no node/);
});

test("S-6: duplicate section identities in one document throw", () => {
  const origin = doc("specs/O.mdx", [
    sec("m", "", [content("\nx\n")]),
    content("\n"),
    sec("m", "", [content("\ny\n")]),
    content("\n"),
  ]);
  expect(() =>
    predictSectionMoveImpact({
      origin,
      target: { createdPath: "specs/N.mdx" },
      movedId: "m",
      newId: "m2",
    }),
  ).toThrow(/oracle misuse:.*duplicate section identity/);
});
