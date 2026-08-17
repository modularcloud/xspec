// S-6 section-move-oracle vectors (TEST-SPEC 17 S-6): the in-harness
// section-move category oracle for P-5 (test/helpers/oracles/section-move.ts)
// passes this fixed vector suite, derived from SPEC.md 6.2's worked
// straddling-line case plus the clean-boundary and final-position cases of
// TEST-SPEC T6.2-3/T6.2-4, before any property test trusts it. Every
// vector's expected sequences and category tables are hand-computed; no
// product is involved (the product's own 6.2/5.6 behavior is asserted by
// the suite's T6.2-* tests against fixtures, not against this oracle).
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
// plus misuse guards: stagings outside P-5's exactly-three-groups changed
// set, degenerate constructs, and incomplete graphs throw plain errors
// (harness defects), never diagnosed product failures.

import { expect, test } from "vitest";
import { predictSectionMoveImpact } from "../helpers/oracles/section-move.js";
import type {
  SectionMoveDocument,
  SectionMoveGraphNode,
  SectionMovePiece,
  SectionMovePrediction,
} from "../helpers/oracles/section-move.js";

// --- vector-side document builders -------------------------------------------

const content = (text: string): SectionMovePiece => ({ kind: "content", text });

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

/** Tolerated-optional with attribution bound `ids` (the T6.2-3 tolerance). */
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
// Misuse guards
// =============================================================================

test("S-6: a staging whose move changes a node outside P-5's three groups throws — the sibling whose whitespace residue rides a flipped line", () => {
  // Before: the line `<S id="p.x"> </S><S id="p.mv">` is dropped (residue
  // ` ` is whitespace-only), so the sibling `p.x` contributes nothing.
  // After the deletion the merged line keeps `tail`, so ` ` survives — the
  // sibling's sequence changes, outside the changed-set pin of P-5.
  const origin = doc("specs/G.mdx", [
    sec("p", "", [
      content("\n"),
      sec("p.x", "", [content(" ")]),
      sec("p.mv", "", [content("\nM.\n")]),
      content("tail\n"),
    ]),
    content("\n"),
  ]);
  const target = doc("specs/H3.mdx", [
    sec("tp", "", [content("\nT.\n")]),
    content("\n"),
  ]);
  expect(() =>
    predictSectionMoveImpact({
      origin,
      target,
      movedId: "p.mv",
      newId: "tp.mv",
    }),
  ).toThrow(/oracle misuse:.*changed set from exactly/s);
});

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

test("S-6: a multi-line section tag throws (staged scope)", () => {
  const origin = doc("specs/O.mdx", [
    {
      kind: "section",
      id: "m",
      open: '<S\n id="m">',
      close: "</S>",
      body: [content("\nx\n")],
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
  ).toThrow(/oracle misuse:.*single-line/);
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
