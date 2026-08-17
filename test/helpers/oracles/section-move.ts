// In-harness section-move category oracle (TEST-SPEC 16 P-5, 17 S-6): an
// independent implementation of the SPEC.md 6.2/5.6 prediction for the
// section form of `xspec move` — which nodes are `changed` and exactly which
// 5.6 cascades (`descendant-changed`, `upstream-changed`, attributions
// included) follow, relative to a baseline committed immediately before the
// move. Per S-6, the oracle passes its fixed vector suite
// (test/self/s6-section-move-oracle.test.ts) — derived from SPEC.md 6.2's
// worked straddling-line case plus the clean-boundary and final-position
// cases of TEST-SPEC T6.2-3/T6.2-4 — before any property test trusts it.
// Harness machinery only: pure functions, no product imports, no I/O, no
// test-framework dependence.
//
// The oracle does not parse MDX (the markdown oracle's independence
// discipline): its caller — the P-5 generator, the S-6 vectors — composed
// the documents, so it describes them as piece trees (`SectionMovePiece`),
// every construct located by construction, and states the move
// (`movedId` → `newId` into `target`). Everything is stated in BASELINE
// identities; the oracle derives the identity mapping (prefix replacement,
// SPEC 6.5) and reports its prediction in CURRENT identities.
//
// SPEC.md 6.2/5.6 via TEST-SPEC P-5, as implemented here:
//
// * The `changed` set is drawn from exactly the origin parent, the target
//   parent, and the moved subtree's nodes — each `changed` iff its own
//   content sequence (1.6) differs across the move:
//     - distinct parents necessarily (one loses a child reference, one
//       gains one — reference tokens enter the sequence at their positions);
//     - a created target file's root, present on no baseline side, is
//       instead `changed` as an added node — by addition, not comparison —
//       and per 5.6 carries no other category;
//     - a coincident parent iff the re-insertion fails to reproduce its
//       sequence (a final child re-inserted at its own former position is
//       pure in effect, 6.2);
//     - a moved-subtree node iff the straddling-line drops of 6.2 change
//       its runs, computed by the line-drop rules of 3 — the oracle
//       delegates every logical line's keep/drop decision to P-2's markdown
//       oracle (`compileMarkdown`), so the two oracles cannot disagree on 3.
//   Any other node whose sequence differs (a sibling whose whitespace-only
//   residue rides a straddling line whose keep/drop status the move flips,
//   an ancestor's bytes on the deletion's merged line) is outside P-5's
//   staged input space and throws: the generator must never stage it.
// * `metadata-changed` on no node (6.2: every moved node keeps its
//   metadataHash, and canonical identities preserve every other node's) —
//   the prediction's category vocabulary simply excludes it.
// * `descendant-changed` and `upstream-changed` exactly per 5.6's cascades
//   from the changed nodes, attributions included, with the two-sided
//   tolerance T6.2-3 documents: SPEC 5.6's baseline comparison is defined
//   for nodes present on both sides, and the relocated moved subtree is a
//   descendant of each parent's chain on only one side — so a cascade whose
//   only cause is a relocated (one-side-only) member is predicted as
//   tolerated-optional (accepted present or absent), while a both-sides
//   cause makes the category required with the causing originators pinned
//   into its attribution.
//
// Own-content sequences (SPEC 1.6, 5.5, as the P-4 model pins them): per
// node, its own-text runs in document order interleaved with one reference
// token per child construct and per `text(...)` embedding, each entering as
// the referenced node's identity — child and embedding references
// distinguished. Reference tokens are unconditional (a construct on a
// dropped line still divides the runs, 1.6); run bytes are exactly the
// node's surviving content bytes under the rules of 3, expansions excluded
// (an embedded target's text is no part of the embedder's own content, 5.5)
// though a non-empty expansion still keeps its line (3, delegated). All
// reference values compare as canonical identities, which the journaled
// move preserves (5.4): the baseline side is mapped through the move's
// identity mapping before comparison, and the after side reads every
// reference in current identities.
//
// The after side is derived, not supplied: the oracle performs 6.5's edits
// at the piece level — the origin deletion enters the compile as one
// removal piece (its merged straddling line dropped iff left empty or
// whitespace-only, the rule of 3, which composes with the after compile's
// own removals to the same sequences the two-stage edit yields); the
// insertion places the moved construct as the target parent's last child,
// followed by a U+000A content piece and preceded by one when the insertion
// point is not at the start of a line in the post-deletion file bytes; a
// self-closing target parent is first rewritten to paired form (T6.5-2's
// byte rule). Import additions and removals are not modeled: 6.5 pins added
// imports as lines of their own and removals as the declaration plus its
// adjunct line drop, so import edits never touch any node's surviving runs
// or reference tokens.
//
// Staged-scope contracts (guarded where checkable, documented where not):
// section tags are single-line; a self-closing section has an empty body;
// an embedding's `expansion` is emptiness-stable across the move — only
// emptiness enters the drop decision (a non-empty expansion keeps its line
// regardless of content), and the P-5 generator stages no empty subtree
// texts, so the before-side expansion decides both sides.

import { compileMarkdown } from "./markdown.js";
import type { MarkdownPiece } from "./markdown.js";

// ---------------------------------------------------------------------------
// Input model

/** One own-content token: a text run, or a child/embedding reference. */
export type SectionMoveOwnToken = readonly [
  kind: "run" | "child" | "embed",
  value: string,
];

/** One piece of a document, in document order (nested for sections). */
export type SectionMovePiece =
  | {
      /** Plain source content: preserved, subject only to the drop rule. */
      readonly kind: "content";
      readonly text: string;
    }
  | {
      /**
       * A non-section removed construct's own characters — a spec module
       * import declaration or an MDX comment (SPEC.md 3). May contain line
       * terminators (a multi-line comment merges its lines when removed).
       */
      readonly kind: "removal";
      readonly text: string;
    }
  | {
      /**
       * A `text(...)` embedding: `text` is the expression's own characters
       * (the braced container included), `expansion` the target's compiled
       * subtree text (caller-computed, the markdown oracle's contract), and
       * `target` the referenced node's identity in baseline space.
       */
      readonly kind: "embedding";
      readonly text: string;
      readonly expansion: string;
      readonly target: string;
    }
  | SectionMoveSection;

/** A requirement-section construct (SPEC 1.1) with its nested body. */
export interface SectionMoveSection {
  readonly kind: "section";
  /** The section's dotted id exactly as spelled (SPEC 1.3). */
  readonly id: string;
  /** Opening tag's own characters (the whole tag when self-closing). */
  readonly open: string;
  /** Closing tag's own characters; `null` = self-closing (empty body). */
  readonly close: string | null;
  readonly body: readonly SectionMovePiece[];
  /** The section's `d`-declared target identities, baseline space. */
  readonly depends: readonly string[];
}

/** A document: its workspace-relative path plus its pieces. */
export interface SectionMoveDocument {
  readonly path: string;
  readonly pieces: readonly SectionMovePiece[];
}

/**
 * A node of a file the move does not textually touch, carried for the 5.6
 * cascade computation (dependents live anywhere). Everything in baseline
 * identities; the oracle maps reference targets through the move's mapping.
 */
export interface SectionMoveGraphNode {
  readonly identity: string;
  /** Direct child identities in document order. */
  readonly children: readonly string[];
  /** Dependency-edge target identities (`depends` and `embeds` union). */
  readonly edgeTargets: readonly string[];
}

export interface SectionMoveInput {
  /** The origin document, before the move; contains the moved section. */
  readonly origin: SectionMoveDocument;
  /**
   * The target document before the move, or `{ createdPath }` when the
   * move creates the target file. A same-file move passes the identical
   * document object as both `origin` and `target`.
   */
  readonly target: SectionMoveDocument | { readonly createdPath: string };
  /** Dotted id of the moved section in the origin document. */
  readonly movedId: string;
  /** Dotted new id (SPEC 6.5); its parent chain locates the target parent. */
  readonly newId: string;
  /** Nodes of every file not textually involved in the move. */
  readonly otherNodes?: readonly SectionMoveGraphNode[];
}

// ---------------------------------------------------------------------------
// Output model

export type SectionMoveCategoryName =
  "changed" | "descendant-changed" | "upstream-changed";

/** The prediction for one category of one node. */
export interface SectionMoveCategoryPrediction {
  /**
   * True: the category must be reported. False: tolerated-optional — its
   * only cause is a relocated one-side-only member (the T6.2-3 tolerance),
   * so it is accepted present or absent.
   */
  readonly required: boolean;
  /** Sorted bound: the reported attribution must be a subset. */
  readonly attributionWithin: readonly string[];
  /** Sorted; a reported category's attribution must include these. */
  readonly attributionMustInclude: readonly string[];
}

/** Per-node prediction: absent category name = must not be reported. */
export interface SectionMoveNodePrediction {
  readonly categories: ReadonlyMap<
    SectionMoveCategoryName,
    SectionMoveCategoryPrediction
  >;
}

export interface SectionMovePrediction {
  /** Baseline → current identities of the moved subtree (others map to themselves). */
  readonly identityMap: ReadonlyMap<string, string>;
  /** Every current-graph node's prediction (one entry per node, possibly empty). */
  readonly nodes: ReadonlyMap<string, SectionMoveNodePrediction>;
  /** The `changed` set — the originating nodes (added created-root included). */
  readonly changed: ReadonlySet<string>;
  /** Current identities added by the move: the created target root, if any. */
  readonly added: ReadonlySet<string>;
  /** Per-node own-content token sequences, baseline side, baseline identities. */
  readonly beforeOwnTokens: ReadonlyMap<string, readonly SectionMoveOwnToken[]>;
  /** Per-node own-content token sequences, current side, current identities. */
  readonly afterOwnTokens: ReadonlyMap<string, readonly SectionMoveOwnToken[]>;
}

// ---------------------------------------------------------------------------
// Guards

function misuse(message: string): never {
  throw new Error(`section-move oracle misuse: ${message}`);
}

function defect(message: string): never {
  throw new Error(`section-move oracle defect: ${message}`);
}

function hasTerminator(text: string): boolean {
  return text.includes("\n") || text.includes("\r");
}

function isTerminatorCode(code: number): boolean {
  return code === 0x0a || code === 0x0d;
}

/** SPEC 1.4 whitespace-only (the classes P-2's oracle pins). */
function isWhitespaceOnly(text: string): boolean {
  return /^[\t\n\v\f\r ]*$/.test(text);
}

// ---------------------------------------------------------------------------
// Piece-tree utilities

/** The source text a piece list concatenates to (tags and bodies included). */
export function sectionMoveSourceText(
  pieces: readonly SectionMovePiece[],
): string {
  let text = "";
  for (const piece of pieces) {
    if (piece.kind === "section") {
      text +=
        piece.open + sectionMoveSourceText(piece.body) + (piece.close ?? "");
    } else {
      text += piece.text;
    }
  }
  return text;
}

interface LocatedSection {
  readonly section: SectionMoveSection;
  /** Construct-range string indices into the document's source text. */
  readonly start: number;
  readonly end: number;
}

/** Locate the section spelling `id`, with its source-text range. */
function locateSection(
  pieces: readonly SectionMovePiece[],
  id: string,
  offset: number,
): LocatedSection | null {
  let cursor = offset;
  for (const piece of pieces) {
    if (piece.kind === "section") {
      const length =
        piece.open.length +
        sectionMoveSourceText(piece.body).length +
        (piece.close ?? "").length;
      if (piece.id === id) {
        return { section: piece, start: cursor, end: cursor + length };
      }
      const inner = locateSection(piece.body, id, cursor + piece.open.length);
      if (inner !== null) return inner;
      cursor += length;
    } else {
      cursor += piece.text.length;
    }
  }
  return null;
}

/**
 * Replace the section spelling `id` with one removal piece holding its full
 * source text — 6.5's origin deletion as a rule-of-3 removal: the merged
 * straddling line enters the compile with the construct's characters
 * counting as source non-whitespace and is dropped exactly when the
 * deletion leaves it empty or whitespace-only.
 */
function replaceWithRemoval(
  pieces: readonly SectionMovePiece[],
  id: string,
): { readonly pieces: SectionMovePiece[]; readonly found: boolean } {
  const out: SectionMovePiece[] = [];
  let found = false;
  for (const piece of pieces) {
    if (!found && piece.kind === "section") {
      if (piece.id === id) {
        out.push({
          kind: "removal",
          text:
            piece.open +
            sectionMoveSourceText(piece.body) +
            (piece.close ?? ""),
        });
        found = true;
        continue;
      }
      const inner = replaceWithRemoval(piece.body, id);
      if (inner.found) {
        out.push({ ...piece, body: inner.pieces });
        found = true;
        continue;
      }
    }
    out.push(piece);
  }
  return { pieces: out, found };
}

/** Rewrite the moved subtree's section ids by prefix replacement. */
function mapMovedIds(
  section: SectionMoveSection,
  mapDotted: (dotted: string) => string,
): SectionMoveSection {
  const mapPieces = (pieces: readonly SectionMovePiece[]): SectionMovePiece[] =>
    pieces.map((piece) =>
      piece.kind === "section"
        ? { ...piece, id: mapDotted(piece.id), body: mapPieces(piece.body) }
        : piece,
    );
  return {
    ...section,
    id: mapDotted(section.id),
    body: mapPieces(section.body),
  };
}

/** Map every reference (embedding target, `d` target) through `mapIdentity`. */
function mapReferencesDeep(
  pieces: readonly SectionMovePiece[],
  mapIdentity: (identity: string) => string,
): SectionMovePiece[] {
  return pieces.map((piece) => {
    if (piece.kind === "section") {
      return {
        ...piece,
        depends: piece.depends.map(mapIdentity),
        body: mapReferencesDeep(piece.body, mapIdentity),
      };
    }
    if (piece.kind === "embedding") {
      return { ...piece, target: mapIdentity(piece.target) };
    }
    return piece;
  });
}

/**
 * The paired form of a self-closing target parent (SPEC 6.5, T6.5-2): the
 * `/` and any whitespace immediately before or after it deleted from the
 * tag, and the closing tag matching the opening tag's name appended.
 */
function pairSelfClosing(open: string): {
  readonly open: string;
  readonly close: string;
} {
  const nameMatch = /^<\s*(Spec|S)\b/.exec(open);
  if (nameMatch === null) {
    misuse(
      `a section's open tag must begin <S or <Spec (SPEC 1.1); got ${JSON.stringify(open)}`,
    );
  }
  if (!open.endsWith(">")) {
    misuse(`a tag's own characters end with ">"; got ${JSON.stringify(open)}`);
  }
  const inner = open.slice(0, -1);
  const stripped = inner.replace(/[\t\n\v\f\r ]*\/[\t\n\v\f\r ]*$/, "");
  if (stripped === inner) {
    misuse(
      `pairSelfClosing called on a non-self-closing tag ${JSON.stringify(open)}`,
    );
  }
  return { open: `${stripped}>`, close: `</${nameMatch[1]}>` };
}

/**
 * Insert `moved` as the last child of the section spelling `parentId`
 * (`null` = the document root): appended to the parent's body immediately
 * before its closing tag (at the end of the piece list for the root),
 * followed by a U+000A content piece and preceded by one when the insertion
 * point is not at a line start (`atLineStart`, judged over the
 * post-deletion file bytes). A self-closing parent is first rewritten to
 * paired form, the insertion point then following its opening tag's `>` —
 * never at a line start (T6.5-2's worked bytes).
 */
function insertMoved(
  pieces: readonly SectionMovePiece[],
  parentId: string | null,
  moved: SectionMoveSection,
  atLineStart: boolean,
): { readonly pieces: SectionMovePiece[]; readonly found: boolean } {
  const newline: SectionMovePiece = { kind: "content", text: "\n" };
  const splice = (lineStart: boolean): SectionMovePiece[] => [
    ...(lineStart ? [] : [newline]),
    moved,
    newline,
  ];
  if (parentId === null) {
    return { pieces: [...pieces, ...splice(atLineStart)], found: true };
  }
  const out: SectionMovePiece[] = [];
  let found = false;
  for (const piece of pieces) {
    if (!found && piece.kind === "section") {
      if (piece.id === parentId) {
        found = true;
        if (piece.close === null) {
          const paired = pairSelfClosing(piece.open);
          out.push({
            ...piece,
            open: paired.open,
            close: paired.close,
            body: splice(false),
          });
        } else {
          out.push({ ...piece, body: [...piece.body, ...splice(atLineStart)] });
        }
        continue;
      }
      const inner = insertMoved(piece.body, parentId, moved, atLineStart);
      if (inner.found) {
        out.push({ ...piece, body: inner.pieces });
        found = true;
        continue;
      }
    }
    out.push(piece);
  }
  return { pieces: out, found };
}

// ---------------------------------------------------------------------------
// Edit-stage file bytes (for the insertion's line-start decision)
//
// 6.5's insertion is "preceded by [a U+000A] when the insertion point is
// not at the start of a line" — a fact about the file bytes the insertion
// edits: the target document as staged, or (same-file move) the
// post-deletion origin bytes, where the deletion has removed the
// construct's characters and dropped its merged straddling line when the
// deletion left it empty or whitespace-only.

interface EditStageDeletion {
  readonly start: number;
  readonly end: number;
}

/** Whether `position` in `source` starts a line after applying `deletion`. */
function atLineStartAfterDeletion(
  source: string,
  position: number,
  deletion: EditStageDeletion | null,
): boolean {
  const removed: [number, number][] = [];
  if (deletion !== null) {
    // The deletion's merged line over the original bytes (SPEC 3's line
    // model; CRLF pairs never straddle the construct, whose own characters
    // begin `<` and end `>`).
    let lineStart = deletion.start;
    while (
      lineStart > 0 &&
      !isTerminatorCode(source.charCodeAt(lineStart - 1))
    ) {
      lineStart -= 1;
    }
    let residueEnd = deletion.end;
    while (
      residueEnd < source.length &&
      !isTerminatorCode(source.charCodeAt(residueEnd))
    ) {
      residueEnd += 1;
    }
    let lineEnd = residueEnd;
    if (lineEnd < source.length) {
      lineEnd +=
        source.charCodeAt(lineEnd) === 0x0d &&
        source.charCodeAt(lineEnd + 1) === 0x0a
          ? 2
          : 1;
    }
    const residue =
      source.slice(lineStart, deletion.start) +
      source.slice(deletion.end, residueEnd);
    removed.push(
      isWhitespaceOnly(residue)
        ? [lineStart, lineEnd] // dropped with its terminator (SPEC 6.5, 3)
        : [deletion.start, deletion.end],
    );
  }
  // Walk backwards from `position` over the post-deletion bytes.
  let i = position;
  for (;;) {
    const skip = removed.find(([from, to]) => i > from && i <= to);
    if (skip !== undefined) {
      i = skip[0];
      continue;
    }
    if (i === 0) return true;
    return isTerminatorCode(source.charCodeAt(i - 1));
  }
}

/**
 * String index of the insertion point in the concatenation of `pieces`:
 * the first character of the target parent's closing tag, or the end of
 * the document for a top-level new id.
 */
function insertionPoint(
  pieces: readonly SectionMovePiece[],
  parentDotted: string | null,
  sourceLength: number,
): number {
  if (parentDotted === null) return sourceLength;
  const parent = locateSection(pieces, parentDotted, 0);
  if (parent === null) {
    misuse(
      `the target document spells no section ${JSON.stringify(parentDotted)} ` +
        `(a refused move; the oracle predicts successful moves only)`,
    );
  }
  return parent.end - (parent.section.close ?? "").length;
}

// ---------------------------------------------------------------------------
// Attributed compilation: piece tree → per-node own-content sequences
//
// Mirrors the structure of P-2's oracle but delegates every logical line's
// keep/drop decision to it: the line's pieces (content chunks, tag/import/
// comment removals, embeddings with their expansions) plus its terminator
// are handed to `compileMarkdown`, whose empty output is exactly "dropped"
// (a kept line always retains its terminator and an all-whitespace source
// line is kept; the terminator-less final line borrows a sentinel
// terminator, which cannot change the decision).

interface DocumentStructure {
  /** Identity → own-content token sequence, this document's nodes. */
  readonly sequences: Map<string, SectionMoveOwnToken[]>;
  /** Identity → declared `d` targets, this document's sections. */
  readonly depends: Map<string, readonly string[]>;
}

type FlatEntry =
  | { readonly kind: "content"; readonly owner: string; readonly text: string }
  | { readonly kind: "construct"; readonly piece: MarkdownPiece }
  | {
      readonly kind: "token";
      readonly owner: string;
      readonly token: SectionMoveOwnToken;
    };

function flattenInto(
  pieces: readonly SectionMovePiece[],
  path: string,
  owner: string,
  entries: FlatEntry[],
  register: (identity: string, depends: readonly string[]) => void,
): void {
  for (const piece of pieces) {
    switch (piece.kind) {
      case "content":
        if (piece.text.length > 0) {
          entries.push({ kind: "content", owner, text: piece.text });
        }
        break;
      case "removal":
        entries.push({
          kind: "construct",
          piece: { kind: "removal", text: piece.text },
        });
        break;
      case "embedding":
        entries.push({ kind: "token", owner, token: ["embed", piece.target] });
        entries.push({
          kind: "construct",
          piece: {
            kind: "embedding",
            text: piece.text,
            expansion: piece.expansion,
          },
        });
        break;
      case "section": {
        if (hasTerminator(piece.open) || hasTerminator(piece.close ?? "")) {
          misuse(
            `section tags are single-line in the staged scope (the P-5 ` +
              `generator and SPEC 6.2's worked material stage no multi-line ` +
              `tag); got ${JSON.stringify(piece.open)}`,
          );
        }
        const identity = `${path}#${piece.id}`;
        register(identity, piece.depends);
        entries.push({ kind: "token", owner, token: ["child", identity] });
        entries.push({
          kind: "construct",
          piece: { kind: "removal", text: piece.open },
        });
        if (piece.close === null) {
          if (piece.body.length > 0) {
            misuse(
              `a self-closing section has no body (SPEC 1.1); ` +
                `${identity} declares ${String(piece.body.length)} piece(s)`,
            );
          }
        } else {
          flattenInto(piece.body, path, identity, entries, register);
          entries.push({
            kind: "construct",
            piece: { kind: "removal", text: piece.close },
          });
        }
        break;
      }
    }
  }
}

/** Merge strictly-adjacent content entries (always same-owner by grammar). */
function coalesceEntries(entries: readonly FlatEntry[]): FlatEntry[] {
  const out: FlatEntry[] = [];
  for (const entry of entries) {
    const last = out[out.length - 1];
    if (
      entry.kind === "content" &&
      last !== undefined &&
      last.kind === "content"
    ) {
      if (last.owner !== entry.owner) {
        defect(
          "adjacent content with distinct owners — a section boundary " +
            "always interposes a tag",
        );
      }
      out[out.length - 1] = {
        kind: "content",
        owner: last.owner,
        text: last.text + entry.text,
      };
      continue;
    }
    out.push(entry);
  }
  return out;
}

function compileDocument(document: SectionMoveDocument): DocumentStructure {
  const sequences = new Map<string, SectionMoveOwnToken[]>();
  const depends = new Map<string, readonly string[]>();
  const runs = new Map<string, string>();
  const register = (identity: string, deps: readonly string[]): void => {
    if (sequences.has(identity)) {
      misuse(`duplicate section identity ${identity} in ${document.path}`);
    }
    sequences.set(identity, []);
    depends.set(identity, deps);
    runs.set(identity, "");
  };
  // The implicit root (SPEC 1.2): no `d` targets (5.5).
  register(document.path, []);

  const entries: FlatEntry[] = [];
  flattenInto(document.pieces, document.path, document.path, entries, register);

  const appendRun = (owner: string, text: string): void => {
    runs.set(owner, (runs.get(owner) ?? "") + text);
  };
  const flushToken = (owner: string, token: SectionMoveOwnToken): void => {
    const sequence = sequences.get(owner);
    if (sequence === undefined) defect(`no stream for ${owner}`);
    sequence.push(["run", runs.get(owner) ?? ""], token);
    runs.set(owner, "");
  };

  type LineEvent =
    | { readonly kind: "bytes"; readonly owner: string; readonly text: string }
    | {
        readonly kind: "token";
        readonly owner: string;
        readonly token: SectionMoveOwnToken;
      };
  let linePieces: MarkdownPiece[] = [];
  let lineEvents: LineEvent[] = [];

  const finalizeLine = (terminator: string, owner: string | null): void => {
    if (
      linePieces.length === 0 &&
      lineEvents.length === 0 &&
      terminator === ""
    ) {
      return; // nothing pending at end of input
    }
    const probe: MarkdownPiece[] = [
      ...linePieces,
      { kind: "content", text: terminator === "" ? "\n" : terminator },
    ];
    const dropped = compileMarkdown(probe) === "";
    for (const event of lineEvents) {
      if (event.kind === "token") flushToken(event.owner, event.token);
      else if (!dropped) appendRun(event.owner, event.text);
    }
    if (!dropped && terminator !== "" && owner !== null) {
      appendRun(owner, terminator);
    }
    linePieces = [];
    lineEvents = [];
  };

  for (const entry of coalesceEntries(entries)) {
    if (entry.kind === "construct") {
      linePieces.push(entry.piece);
      continue;
    }
    if (entry.kind === "token") {
      lineEvents.push({
        kind: "token",
        owner: entry.owner,
        token: entry.token,
      });
      continue;
    }
    const text = entry.text;
    let start = 0;
    let i = 0;
    while (i < text.length) {
      const code = text.charCodeAt(i);
      if (!isTerminatorCode(code)) {
        i += 1;
        continue;
      }
      // A CR ending the entry is a lone CR: adjacent content was coalesced,
      // so the next source character (if any) is a construct's first own
      // character — never the LF of a CRLF pair (the markdown oracle's
      // rule).
      const terminator =
        code === 0x0d && text.charCodeAt(i + 1) === 0x0a ? "\r\n" : text[i];
      const chunk = text.slice(start, i);
      if (chunk.length > 0) {
        linePieces.push({ kind: "content", text: chunk });
        lineEvents.push({ kind: "bytes", owner: entry.owner, text: chunk });
      }
      finalizeLine(terminator, entry.owner);
      i += terminator.length;
      start = i;
    }
    const tail = text.slice(start);
    if (tail.length > 0) {
      linePieces.push({ kind: "content", text: tail });
      lineEvents.push({ kind: "bytes", owner: entry.owner, text: tail });
    }
  }
  finalizeLine("", null);

  for (const [identity, sequence] of sequences) {
    sequence.push(["run", runs.get(identity) ?? ""]);
  }
  return { sequences, depends };
}

// ---------------------------------------------------------------------------
// Graph derivation and the 5.6 cascade computation

interface GraphNode {
  readonly children: readonly string[];
  readonly edgeTargets: readonly string[];
}

function dedupSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function tokensJson(tokens: readonly SectionMoveOwnToken[]): string {
  return JSON.stringify(tokens);
}

function mapTokens(
  tokens: readonly SectionMoveOwnToken[],
  mapIdentity: (identity: string) => string,
): SectionMoveOwnToken[] {
  return tokens.map(([kind, value]) =>
    kind === "run" ? [kind, value] : [kind, mapIdentity(value)],
  );
}

function graphNodeOf(
  tokens: readonly SectionMoveOwnToken[],
  deps: readonly string[],
): GraphNode {
  const children: string[] = [];
  const embeds: string[] = [];
  for (const [kind, value] of tokens) {
    if (kind === "child") children.push(value);
    else if (kind === "embed") embeds.push(value);
  }
  return { children, edgeTargets: dedupSorted([...deps, ...embeds]) };
}

/** Memoized strict-descendant sets over one side's `children` lists. */
function strictDescendants(
  graph: ReadonlyMap<string, GraphNode>,
): Map<string, Set<string>> {
  const memo = new Map<string, Set<string>>();
  const visiting = new Set<string>();
  const resolve = (identity: string): Set<string> => {
    const cached = memo.get(identity);
    if (cached !== undefined) return cached;
    if (visiting.has(identity)) {
      defect(`contains-cycle through ${identity}`);
    }
    visiting.add(identity);
    const node = graph.get(identity);
    if (node === undefined) {
      misuse(
        `${identity} is a child of some node but has no node of its own — ` +
          `otherNodes must cover every node of every untouched file`,
      );
    }
    const descendants = new Set<string>();
    for (const child of node.children) {
      descendants.add(child);
      for (const inner of resolve(child)) descendants.add(inner);
    }
    visiting.delete(identity);
    memo.set(identity, descendants);
    return descendants;
  };
  for (const identity of graph.keys()) resolve(identity);
  return memo;
}

// ---------------------------------------------------------------------------
// The oracle

export function predictSectionMoveImpact(
  input: SectionMoveInput,
): SectionMovePrediction {
  const { origin, movedId, newId } = input;
  let targetDocument: SectionMoveDocument | null;
  let targetPath: string;
  if ("pieces" in input.target) {
    targetDocument = input.target;
    targetPath = input.target.path;
  } else {
    targetDocument = null;
    targetPath = input.target.createdPath;
  }
  const created = targetDocument === null;
  const coincident =
    targetDocument !== null && targetDocument.path === origin.path;
  if (coincident && targetDocument !== origin) {
    misuse(
      "a same-file move passes the identical document object as origin and target",
    );
  }
  if (created && targetPath === origin.path) {
    misuse("the created target path collides with the origin document");
  }

  // --- The identity mapping (prefix replacement, SPEC 6.5) ---
  const located = locateSection(origin.pieces, movedId, 0);
  if (located === null) {
    misuse(`the origin document spells no section ${JSON.stringify(movedId)}`);
  }
  const mapDotted = (dotted: string): string => {
    if (dotted === movedId) return newId;
    if (dotted.startsWith(`${movedId}.`)) {
      return newId + dotted.slice(movedId.length);
    }
    misuse(
      `section ${JSON.stringify(dotted)} inside the moved subtree does not ` +
        `extend the moved id ${JSON.stringify(movedId)} (SPEC 1.3)`,
    );
  };
  const identityMap = new Map<string, string>();
  const collectMapping = (section: SectionMoveSection): void => {
    identityMap.set(
      `${origin.path}#${section.id}`,
      `${targetPath}#${mapDotted(section.id)}`,
    );
    for (const piece of section.body) {
      if (piece.kind === "section") collectMapping(piece);
    }
  };
  collectMapping(located.section);
  const mapIdentity = (identity: string): string =>
    identityMap.get(identity) ?? identity;

  // --- Parents ---
  const parentDottedOf = (dotted: string): string | null => {
    const lastDot = dotted.lastIndexOf(".");
    return lastDot === -1 ? null : dotted.slice(0, lastDot);
  };
  const originParentDotted = parentDottedOf(movedId);
  const originParent =
    originParentDotted === null
      ? origin.path
      : `${origin.path}#${originParentDotted}`;
  const targetParentDotted = parentDottedOf(newId);
  if (created && targetParentDotted !== null) {
    misuse(
      "a created target file holds no sections, so a move creating it " +
        "carries a single-segment new id (SPEC 6.5: the target parent must " +
        "exist)",
    );
  }
  // The created root is `changed` by addition, not comparison (P-5).
  const targetParent = created
    ? null
    : targetParentDotted === null
      ? targetPath
      : `${targetPath}#${targetParentDotted}`;

  // --- Before-side compilation ---
  const beforeDocs: DocumentStructure[] = [compileDocument(origin)];
  if (!coincident && targetDocument !== null) {
    beforeDocs.push(compileDocument(targetDocument));
  }

  // --- After-side trees (6.5's edits at the piece level) ---
  const movedMapped = mapMovedIds(located.section, mapDotted);
  const removedOrigin = replaceWithRemoval(origin.pieces, movedId);
  if (!removedOrigin.found) {
    defect("located section not found by the removal pass");
  }
  const afterDocs: DocumentStructure[] = [];
  if (coincident) {
    const source = sectionMoveSourceText(origin.pieces);
    const insertAt = insertionPoint(
      origin.pieces,
      targetParentDotted,
      source.length,
    );
    const atLineStart = atLineStartAfterDeletion(source, insertAt, {
      start: located.start,
      end: located.end,
    });
    const spliced = insertMoved(
      removedOrigin.pieces,
      targetParentDotted,
      movedMapped,
      atLineStart,
    );
    if (!spliced.found) {
      misuse(
        `the target parent ${JSON.stringify(targetParentDotted)} is missing ` +
          `after the removal — absent or within the moved subtree (a ` +
          `refused move; the oracle predicts successful moves only)`,
      );
    }
    afterDocs.push(
      compileDocument({
        path: origin.path,
        pieces: mapReferencesDeep(spliced.pieces, mapIdentity),
      }),
    );
  } else {
    afterDocs.push(
      compileDocument({
        path: origin.path,
        pieces: mapReferencesDeep(removedOrigin.pieces, mapIdentity),
      }),
    );
    if (targetDocument === null) {
      afterDocs.push(
        compileDocument({
          path: targetPath,
          pieces: mapReferencesDeep(
            [movedMapped, { kind: "content", text: "\n" }],
            mapIdentity,
          ),
        }),
      );
    } else {
      const source = sectionMoveSourceText(targetDocument.pieces);
      const insertAt = insertionPoint(
        targetDocument.pieces,
        targetParentDotted,
        source.length,
      );
      const atLineStart = atLineStartAfterDeletion(source, insertAt, null);
      const spliced = insertMoved(
        targetDocument.pieces,
        targetParentDotted,
        movedMapped,
        atLineStart,
      );
      if (!spliced.found) {
        misuse(
          `the target document spells no section ` +
            `${JSON.stringify(targetParentDotted)} (a refused move; the ` +
            `oracle predicts successful moves only)`,
        );
      }
      afterDocs.push(
        compileDocument({
          path: targetPath,
          pieces: mapReferencesDeep(spliced.pieces, mapIdentity),
        }),
      );
    }
  }

  // --- Merge sides; bring the baseline into current identities ---
  const beforeRaw = new Map<string, readonly SectionMoveOwnToken[]>();
  const mappedBefore = new Map<string, readonly SectionMoveOwnToken[]>();
  const mappedBeforeGraph = new Map<string, GraphNode>();
  for (const doc of beforeDocs) {
    for (const [identity, tokens] of doc.sequences) {
      if (beforeRaw.has(identity)) {
        misuse(`identity ${identity} appears in two documents`);
      }
      beforeRaw.set(identity, tokens);
      const mapped = mapIdentity(identity);
      const mappedTokens = mapTokens(tokens, mapIdentity);
      if (mappedBefore.has(mapped)) {
        defect(`the identity map collapsed ${mapped}`);
      }
      mappedBefore.set(mapped, mappedTokens);
      mappedBeforeGraph.set(
        mapped,
        graphNodeOf(
          mappedTokens,
          (doc.depends.get(identity) ?? []).map(mapIdentity),
        ),
      );
    }
  }
  const after = new Map<string, readonly SectionMoveOwnToken[]>();
  const afterGraph = new Map<string, GraphNode>();
  for (const doc of afterDocs) {
    for (const [identity, tokens] of doc.sequences) {
      if (after.has(identity)) {
        misuse(`identity ${identity} appears in two after-side documents`);
      }
      after.set(identity, tokens);
      afterGraph.set(
        identity,
        graphNodeOf(tokens, doc.depends.get(identity) ?? []),
      );
    }
  }
  for (const node of input.otherNodes ?? []) {
    if (mappedBefore.has(node.identity) || identityMap.has(node.identity)) {
      misuse(
        `otherNodes entry ${node.identity} belongs to a document of the move`,
      );
    }
    if (afterGraph.has(node.identity)) {
      misuse(`duplicate otherNodes entry ${node.identity}`);
    }
    const graphNode: GraphNode = {
      children: node.children.map(mapIdentity),
      edgeTargets: dedupSorted(node.edgeTargets.map(mapIdentity)),
    };
    mappedBeforeGraph.set(node.identity, graphNode);
    afterGraph.set(node.identity, graphNode);
  }
  for (const [identity, node] of afterGraph) {
    for (const target of node.edgeTargets) {
      if (!afterGraph.has(target)) {
        misuse(
          `${identity} has a dependency-edge target ${target} that is no ` +
            `node — otherNodes must cover every node of every untouched file`,
        );
      }
    }
  }

  // --- Kept/added bookkeeping ---
  for (const identity of mappedBefore.keys()) {
    if (!after.has(identity)) {
      defect(
        `${identity} is missing on the after side — a section move deletes ` +
          `no node`,
      );
    }
  }
  const added = new Set<string>();
  for (const identity of after.keys()) {
    if (!mappedBefore.has(identity)) added.add(identity);
  }
  const expectedAdded = created ? [targetPath] : [];
  if (JSON.stringify([...added].sort()) !== JSON.stringify(expectedAdded)) {
    defect(
      `added identities ${JSON.stringify([...added].sort())}; expected ` +
        `exactly ${JSON.stringify(expectedAdded)}`,
    );
  }

  // --- The changed set (P-5's exactly-three-groups pin) ---
  const candidates = new Set<string>(identityMap.values());
  candidates.add(originParent);
  if (targetParent !== null) candidates.add(targetParent);
  const changed = new Set<string>();
  for (const [identity, beforeTokens] of mappedBefore) {
    const afterTokens = after.get(identity);
    if (afterTokens === undefined) continue; // unreachable: guarded above
    if (tokensJson(beforeTokens) === tokensJson(afterTokens)) continue;
    if (!candidates.has(identity)) {
      misuse(
        `the own-content sequence of ${identity} differs across the move, ` +
          `but P-5 draws the changed set from exactly the origin parent, ` +
          `the target parent, and the moved subtree's nodes — the generator ` +
          `must never stage another node's bytes on a line whose keep/drop ` +
          `status the move flips (TEST-SPEC 16 P-5; SPEC 6.2, 3)`,
      );
    }
    changed.add(identity);
  }
  for (const identity of added) changed.add(identity);

  // Dependency-edge sets are identity-stable across a section move
  // (canonical identities, SPEC 5.4): guard that the two derivations agree.
  for (const [identity, beforeNode] of mappedBeforeGraph) {
    const afterNode = afterGraph.get(identity);
    if (afterNode === undefined) continue; // unreachable: guarded above
    if (
      JSON.stringify(beforeNode.edgeTargets) !==
      JSON.stringify(afterNode.edgeTargets)
    ) {
      misuse(
        `the dependency-edge target set of ${identity} differs across the ` +
          `move (${JSON.stringify([...beforeNode.edgeTargets])} vs ` +
          `${JSON.stringify([...afterNode.edgeTargets])}) — a section move ` +
          `retargets spellings, never edges (SPEC 5.4, 6.5)`,
      );
    }
  }

  // --- 5.6 cascades from the changed nodes ---
  const keptSet = new Set(mappedBeforeGraph.keys());
  const descBefore = strictDescendants(mappedBeforeGraph);
  const descAfter = strictDescendants(afterGraph);
  const descAt = (
    memo: Map<string, Set<string>>,
    identity: string,
  ): Set<string> => memo.get(identity) ?? new Set<string>();
  const commonChildren = (identity: string): string[] => {
    const beforeNode = mappedBeforeGraph.get(identity);
    const afterNode = afterGraph.get(identity);
    if (beforeNode === undefined || afterNode === undefined) return [];
    return beforeNode.children.filter(
      (child) => keptSet.has(child) && afterNode.children.includes(child),
    );
  };
  const edgeTargetsOf = (identity: string): readonly string[] =>
    (afterGraph.get(identity)?.edgeTargets ?? []).filter((target) =>
      keptSet.has(target),
    );

  // effCauses(n): the changed originators whose edits the SPEC 5.5
  // effectiveHash recursion propagates to n — n itself when changed, plus
  // the causes of its both-sides children and of its dependency-edge
  // targets (edge sets are identity-stable, guarded above).
  const effCausesMemo = new Map<string, ReadonlySet<string>>();
  const effVisiting = new Set<string>();
  const effCauses = (identity: string): ReadonlySet<string> => {
    const cached = effCausesMemo.get(identity);
    if (cached !== undefined) return cached;
    if (effVisiting.has(identity)) {
      defect(
        `dependency/contains cycle through ${identity} — staged graphs are ` +
          `acyclic (SPEC 5.3)`,
      );
    }
    effVisiting.add(identity);
    const causes = new Set<string>();
    if (changed.has(identity)) causes.add(identity);
    for (const child of commonChildren(identity)) {
      for (const cause of effCauses(child)) causes.add(cause);
    }
    for (const target of edgeTargetsOf(identity)) {
      for (const cause of effCauses(target)) causes.add(cause);
    }
    effVisiting.delete(identity);
    effCausesMemo.set(identity, causes);
    return causes;
  };

  // directCauses(n): originators reaching n through a dependency edge of
  // n's own — the 5.6 upstream-changed trigger at one node.
  const directCauses = (identity: string): ReadonlySet<string> => {
    const causes = new Set<string>();
    for (const target of edgeTargetsOf(identity)) {
      for (const cause of effCauses(target)) causes.add(cause);
    }
    return causes;
  };

  const changedSorted = [...changed].sort();
  const changedEntry: SectionMoveCategoryPrediction = {
    required: true,
    attributionWithin: changedSorted,
    attributionMustInclude: [],
  };
  const nodes = new Map<string, SectionMoveNodePrediction>();
  for (const identity of [...afterGraph.keys()].sort()) {
    const categories = new Map<
      SectionMoveCategoryName,
      SectionMoveCategoryPrediction
    >();
    if (added.has(identity)) {
      // An added node is `changed` and receives no category through its own
      // hashes (SPEC 5.6; P-5: by addition, not comparison).
      categories.set("changed", changedEntry);
      nodes.set(identity, { categories });
      continue;
    }
    if (changed.has(identity)) categories.set("changed", changedEntry);

    const beforeDesc = descAt(descBefore, identity);
    const afterDesc = descAt(descAfter, identity);
    const bothDesc = [...beforeDesc].filter((d) => afterDesc.has(d));
    const oneSidedDesc = [...new Set([...beforeDesc, ...afterDesc])].filter(
      (d) => keptSet.has(d) && !(beforeDesc.has(d) && afterDesc.has(d)),
    );

    // descendant-changed (SPEC 5.6): a changed descendant present on both
    // sides makes it required; a changed relocated (one-side-only)
    // descendant alone makes it tolerated-optional (T6.2-3's documented
    // two-sided ambiguity), the attribution bounded by those descendants.
    const changedBoth = bothDesc.filter((d) => changed.has(d)).sort();
    const changedOneSided = oneSidedDesc.filter((d) => changed.has(d)).sort();
    if (changedBoth.length > 0 || changedOneSided.length > 0) {
      categories.set("descendant-changed", {
        required: changedBoth.length > 0,
        attributionWithin: dedupSorted([...changedBoth, ...changedOneSided]),
        attributionMustInclude: changedBoth,
      });
    }

    // upstream-changed (SPEC 5.6): a dependency-edge cause at the node
    // itself or at a both-sides subtree member is required; a cause carried
    // only by a relocated one-side-only member is tolerated-optional.
    const requiredCauses = new Set<string>(directCauses(identity));
    for (const member of bothDesc) {
      if (!keptSet.has(member)) continue;
      for (const cause of directCauses(member)) requiredCauses.add(cause);
    }
    const optionalCauses = new Set<string>();
    for (const member of oneSidedDesc) {
      for (const cause of directCauses(member)) {
        if (!requiredCauses.has(cause)) optionalCauses.add(cause);
      }
    }
    if (requiredCauses.size > 0 || optionalCauses.size > 0) {
      categories.set("upstream-changed", {
        required: requiredCauses.size > 0,
        attributionWithin: dedupSorted([...requiredCauses, ...optionalCauses]),
        attributionMustInclude: [...requiredCauses].sort(),
      });
    }
    nodes.set(identity, { categories });
  }

  return {
    identityMap,
    nodes,
    changed,
    added,
    beforeOwnTokens: beforeRaw,
    afterOwnTokens: after,
  };
}
