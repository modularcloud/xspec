// Argument-value well-formedness (SPEC 12.0).
//
// Pure core, and deliberately free of imports: the CLI's argument parser
// (cli/args.ts) judges every argument token on every invocation — SPEC 12.0
// judges a malformed value before every per-flag and per-operand check — so
// this rule must not pull the review model or anything heavier into the
// parser's load. The review model (core/review.ts) applies the same rule to
// each stored item `id` (SPEC 10.2: an `id` never contains U+FFFD, so every
// item is nameable as an `<item-id>` operand, 12.0).

/**
 * SPEC 12.0: an argument value is well-formed only when its bytes are valid
 * UTF-8 and it contains no U+FFFD (REPLACEMENT CHARACTER). Node materializes
 * `process.argv` by decoding the OS argument bytes as UTF-8 with U+FFFD
 * substituted for every invalid sequence, so invalid input bytes are
 * observable only as U+FFFD in the decoded string: a value containing U+FFFD
 * is indistinguishable from mis-decoded bytes and is treated as not valid
 * UTF-8. A lone surrogate — which no UTF-8 decode produces, but an
 * in-process caller could pass and a JSON escape in a stored file can spell
 * — has no UTF-8 encoding and is rejected the same way.
 *
 * Callers: the argument parser on every token (cli/args.ts); `move`'s
 * destination-validity assessment (SPEC 6.5; core/refusal.ts takes the
 * path's UTF-8 validity as an input, cli/commands/move.ts supplying it —
 * always true for a CLI-supplied operand, per the parse rule above); and
 * the session parser's item-`id` rule (core/review.ts; SPEC 10.2, 10.1): an
 * `id` this predicate rejects is one no `<item-id>` operand can name, so
 * the session holding it is corrupt (14.21).
 */
export function isWellFormedArgumentValue(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit === 0xfffd) return false;
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = index + 1 < value.length ? value.charCodeAt(index + 1) : 0;
      if (next < 0xdc00 || next > 0xdfff) return false;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return false;
    }
  }
  return true;
}
