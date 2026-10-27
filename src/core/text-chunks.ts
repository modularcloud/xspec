// Texts in chunks — how a derived text too long to spell as one string is
// carried, written, and compared (SPEC 12.0, 13.1, 13.3).
//
// Pure core (IMPLEMENTATION Architecture). V8 caps a string's length at
// 2^29 − 24 code units, and some derived texts are quadratic in a long
// embedding chain's length (SPEC 2.3, 3, 5.3 bound no chain): graph data
// holds every node's own and subtree text (SPEC 13.3), and a generated
// module every node's subtree text (SPEC 4.3, 13.1). Such a text is
// produced as consecutive chunks (`ChunkedText`), written chunk by chunk
// (workspace/writes.ts) and compared with stored bytes chunk by chunk
// (`textMatchesBytes`), so no string ever holds the whole; its bytes are
// exactly those the whole text would encode to (SPEC 12.0).

/**
 * The chunk size, in UTF-16 code units, at which `gatherChunks` hands out
 * the pieces gathered so far: a chunk exceeds it by less than one piece —
 * the bound `canonicalJsonChunks` keeps for JSON text.
 */
const CHUNK_UNITS = 1 << 20;

/**
 * A text spelled in consecutive chunks: its content is the chunks'
 * concatenation (UTF-8 once written, SPEC 12.0), produced afresh by each
 * call of `chunks`, each chunk only when asked for. No chunk ends inside a
 * surrogate pair, so each encodes to UTF-8 on its own.
 */
export interface ChunkedText {
  readonly chunks: () => Iterable<string>;
}

/** A derived file's text: one string, or consecutive chunks. */
export type DerivedText = string | ChunkedText;

/**
 * `pieces` concatenated into consecutive chunks of about `CHUNK_UNITS`
 * code units, each produced only when asked for — a chunk ends where a
 * piece does, so no chunk splits a piece.
 */
export function* gatherChunks(
  pieces: Iterable<string>,
): Generator<string, void, undefined> {
  const out: string[] = [];
  let gathered = 0;
  for (const piece of pieces) {
    out.push(piece);
    gathered += piece.length;
    if (gathered >= CHUNK_UNITS) {
      yield out.join("");
      out.length = 0;
      gathered = 0;
    }
  }
  if (gathered > 0) {
    yield out.join("");
  }
}

const utf8Encoder = new TextEncoder();

/**
 * Whether `bytes` are exactly the UTF-8 encoding of `text` (SPEC 12.0:
 * comparisons are byte-wise) — for a chunked text chunk by chunk, each
 * chunk's bytes against `bytes` at its offset, stopping at the first
 * difference, so the text is never spelled, nor encoded, as a whole.
 */
export function textMatchesBytes(
  text: DerivedText,
  bytes: Uint8Array,
): boolean {
  const chunks = typeof text === "string" ? [text] : text.chunks();
  let offset = 0;
  for (const chunk of chunks) {
    const encoded = utf8Encoder.encode(chunk);
    if (!bytesMatchAt(bytes, offset, encoded)) {
      return false;
    }
    offset += encoded.length;
  }
  return offset === bytes.length;
}

/** Whether `stored` holds exactly `bytes` from `offset` on. */
function bytesMatchAt(
  stored: Uint8Array,
  offset: number,
  bytes: Uint8Array,
): boolean {
  if (offset + bytes.length > stored.length) {
    return false;
  }
  for (let index = 0; index < bytes.length; index += 1) {
    if (stored[offset + index] !== bytes[index]) {
      return false;
    }
  }
  return true;
}
