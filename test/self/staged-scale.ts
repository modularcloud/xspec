// The suite's staged input maxima, derived from what the suite stages
// (TEST-SPEC 17 S-2 and S-8; §0 H-11: every input the suite stages,
// deterministic fixtures and generator draws (16) alike): the deepest
// section tower P-8's giant-nesting draws stage, the largest document any
// generator draw stages, the largest document any deterministic fixture
// stages (T1.3-7's chained-id tower), and the larger of those two — the
// largest document the suite stages. S-2 stages these maxima through the
// workspace builder and reads them back byte-complete (the input side — a
// truncating writer or recursion-limited serializer cannot stage shallower
// or smaller inputs than declared); S-8 sizes every decoder, walk, and
// capture limit against the answers a conforming product may emit over them
// (the answer side). One derivation, so neither gate can drift from what
// the suite actually stages, and a grown bound — a generator's, or T1.3-7's
// DEPTH_FLOOR — moves both.

import { Buffer } from "node:buffer";
import { DEPTH_FLOOR, depthTower } from "../suite/registry/section-1.3.js";
import {
  FUZZ_BASE_FILES,
  MAX_MUTATIONS_PER_TRIAL,
  NESTING_DEPTHS,
  sectionTowerSource,
  TERMINATOR_SEQUENCES,
} from "../suite/registry/section-16-p8.js";

// Nesting. P-8's giant-nesting draws stage balanced towers `<S id="g">` ×
// depth (NESTING_DEPTHS; the deepest 4096, the floor 2048 that T1.3-7
// anchors). A trial applies up to MAX_MUTATIONS_PER_TRIAL mutations to the
// same file, and a shuffle mutation relocates one contiguous byte range, so
// tower + tower + shuffle can drop the second tower into the first's
// innermost level: the deepest section chain any P-8/P-11 draw can stage is
// 2 × 4096 = 8192 (a third tower would need a fourth mutation). Every `view`
// and `ids --tree` answer over such an input nests one node per level.
/** P-8's test-strength floor on staged nesting (TEST-SPEC §16 P-8). */
export const GIANT_NESTING_FLOOR = 2048;
/** The deepest tower any nesting draw stages. */
export const DEEPEST_STAGED_TOWER = Math.max(...NESTING_DEPTHS);

// Document size — generator draws. The largest file any draw stages is the
// largest fuzz base file with every mutation of the budget appending the
// deepest balanced tower. The competing growth is a terminator rewrite
// (every LF → the fattest sequence of TERMINATOR_SEQUENCES, U+2028 at three
// bytes): `towers` towers plus `rewrites` rewrites grow each line feed to at
// most 2^(rewrites − 1) × 3 bytes (LFLF doublings, then the fattest
// sequence), and every such mix is computed below — the all-towers mix
// wins. Splices (≤ 8 bytes), garbage (≤ 64), BOMs (≤ 3), and terminator
// runs (≤ 64 × 3) are smaller than any tower; truncate and shuffle never
// grow a file. P-2/P-3 documents (≤ 3 files × ≤ 6 sections of single-line
// constructs) and P-4/P-9's (≤ 3 sections per file, prose runs ≤ 8
// characters) are far smaller. Deterministic fixtures are sized separately
// below — T1.3-7's document is ~21× this generator maximum.
/**
 * The deepest tower the suite stages, byte for byte — what a nesting draw
 * over an `.mdx` file appends (`mutateNesting`, section-16-p8.ts).
 */
export const TOWER_SOURCE = sectionTowerSource(DEEPEST_STAGED_TOWER, true);
export const TOWER_BYTES = Buffer.byteLength(TOWER_SOURCE, "utf8");
export const FATTEST_TERMINATOR = Math.max(
  ...TERMINATOR_SEQUENCES.map(([, sequence]) => sequence.length),
);

export function countLineFeeds(text: string): number {
  let count = 0;
  for (
    let index = text.indexOf("\n");
    index >= 0;
    index = text.indexOf("\n", index + 1)
  ) {
    count += 1;
  }
  return count;
}

/** Every tower/rewrite mix of the mutation budget over one base file. */
export function stagedSizeCandidates(base: string): number[] {
  const bytes = Buffer.byteLength(base, "utf8");
  const feeds = countLineFeeds(base);
  const towerFeeds = countLineFeeds(TOWER_SOURCE);
  const candidates: number[] = [];
  for (let towers = 0; towers <= MAX_MUTATIONS_PER_TRIAL; towers += 1) {
    const rewrites = MAX_MUTATIONS_PER_TRIAL - towers;
    const bytesPerFeed =
      rewrites === 0 ? 1 : 2 ** (rewrites - 1) * FATTEST_TERMINATOR;
    candidates.push(
      bytes +
        towers * TOWER_BYTES +
        (feeds + towers * towerFeeds) * (bytesPerFeed - 1),
    );
  }
  return candidates;
}

/** The largest fuzz base file (path, text); a tie resolves to the first. */
export const LARGEST_BASE_FILE: readonly [string, string] =
  FUZZ_BASE_FILES.reduce((largest, candidate) =>
    Buffer.byteLength(candidate[1], "utf8") >
    Buffer.byteLength(largest[1], "utf8")
      ? candidate
      : largest,
  );
export const LARGEST_BASE_BYTES = Buffer.byteLength(
  LARGEST_BASE_FILE[1],
  "utf8",
);
/** The largest document any generator draw stages, in bytes. */
export const LARGEST_GENERATED_INPUT_BYTES = Math.max(
  ...FUZZ_BASE_FILES.flatMap(([, text]) => stagedSizeCandidates(text)),
);

/**
 * The largest document any generator draw stages, byte for byte: the
 * largest base file with the whole mutation budget spent on appended
 * deepest towers — exactly what MAX_MUTATIONS_PER_TRIAL nesting draws over
 * it (depth DEEPEST_STAGED_TOWER, balanced, appending rather than
 * replacing) produce, the tower being the section tower because that base
 * is an `.mdx` file (asserted by S-8's derivation test). Built by
 * concatenation, never by recursion, and sized at
 * LARGEST_GENERATED_INPUT_BYTES.
 */
export function largestGeneratedDocument(): Uint8Array {
  const parts = [Buffer.from(LARGEST_BASE_FILE[1], "utf8")];
  const tower = Buffer.from(TOWER_SOURCE, "utf8");
  for (let index = 0; index < MAX_MUTATIONS_PER_TRIAL; index += 1) {
    parts.push(tower);
  }
  return Buffer.concat(parts);
}

// Document size — deterministic fixtures. T1.3-7 (section-1.3.ts) stages
// P-8's giant-nesting floor deterministically: one valid `specs/A.mdx`
// nesting sections DEPTH_FLOOR deep with chained ids (`a`, `a.b`, `a.b.c`,
// …). Because every id spells its whole ancestor chain, the file is
// quadratic in the depth — per level k an opener `<S id="` (7 bytes) plus a
// (2k − 1)-byte id plus `">\n` (3 bytes), then the content line `deep.\n`
// (6 bytes), then `</S>\n` × D (5 bytes each): 9·D + D·(D + 1) + 6 + 5·D
// bytes, 4,225,030 at D = 2048, pure ASCII (bytes = characters). No other
// deterministic fixture's size grows with a bound of that order: the
// registry's only other large repeat counts are T4.1's 745-code-point
// truncation probes (section-4.1-4.2.ts), a few KiB each.
export { DEPTH_FLOOR, depthTower };
export type { DepthTower } from "../suite/registry/section-1.3.js";
/** The largest document any deterministic fixture stages, in bytes. */
export const LARGEST_DETERMINISTIC_INPUT_BYTES = Buffer.byteLength(
  depthTower(DEPTH_FLOOR).source,
  "utf8",
);

/**
 * The largest document any deterministic fixture stages, byte for byte —
 * exactly the `specs/A.mdx` T1.3-7 declares through the workspace builder,
 * built by depthTower's loop (never by recursion) and sized at
 * LARGEST_DETERMINISTIC_INPUT_BYTES.
 */
export function largestDeterministicDocument(): Uint8Array {
  return Buffer.from(depthTower(DEPTH_FLOOR).source, "utf8");
}

// The suite's staged maximum: the larger kind's — today the deterministic
// one — so the name S-2's requirement uses ("the largest document size the
// suite stages") means exactly that.
/** The largest document the suite stages, in bytes. */
export const LARGEST_STAGED_INPUT_BYTES = Math.max(
  LARGEST_GENERATED_INPUT_BYTES,
  LARGEST_DETERMINISTIC_INPUT_BYTES,
);

/**
 * The largest document the suite stages, byte for byte — the larger kind's
 * document (a tie resolves to the deterministic one), sized at
 * LARGEST_STAGED_INPUT_BYTES.
 */
export function largestStagedDocument(): Uint8Array {
  return LARGEST_DETERMINISTIC_INPUT_BYTES >= LARGEST_GENERATED_INPUT_BYTES
    ? largestDeterministicDocument()
    : largestGeneratedDocument();
}
