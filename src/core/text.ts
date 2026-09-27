// Character classes and the line model.
//
// SPEC 1.4 defines the whitespace and control-character classes exactly, and
// they apply throughout the specification: ID segment and tag rules (1.4),
// tag splitting (2.6), and line dropping (3) all use these definitions.
// SPEC 3 defines line terminators and lines for Markdown compilation and for
// every rule that drops or preserves lines.

/**
 * SPEC 1.4: whitespace means exactly U+0009 (tab), U+000A (line feed),
 * U+000B (vertical tab), U+000C (form feed), U+000D (carriage return), and
 * U+0020 (space). No other code point (U+00A0, U+0085, and U+2028 included)
 * belongs to the class.
 */
export function isWhitespaceCodePoint(codePoint: number): boolean {
  return (codePoint >= 0x09 && codePoint <= 0x0d) || codePoint === 0x20;
}

/**
 * SPEC 1.4: control characters means exactly U+0000–U+001F and U+007F. No
 * other code point belongs to the class.
 */
export function isControlCodePoint(codePoint: number): boolean {
  return (codePoint >= 0x00 && codePoint <= 0x1f) || codePoint === 0x7f;
}

/**
 * True when every character of `text` is SPEC 1.4 whitespace; true for the
 * empty string. This is the "empty or whitespace-only" test of the SPEC 3
 * line-drop rule.
 */
export function isWhitespaceOnly(text: string): boolean {
  for (let index = 0; index < text.length; index += 1) {
    // All whitespace characters are single UTF-16 code units, so a code-unit
    // scan is exact: any surrogate half fails the predicate, as it should.
    if (!isWhitespaceCodePoint(text.charCodeAt(index))) {
      return false;
    }
  }
  return true;
}

/**
 * SPEC 1.4: the five forbidden segment (and tag) names, judged by
 * `segmentViolation` below.
 */
const FORBIDDEN_SEGMENT_NAMES: ReadonlySet<string> = new Set([
  "$",
  "__proto__",
  "prototype",
  "constructor",
  "then",
]);

/**
 * SPEC 1.4: the quote, escape, and character-reference characters — `"`,
 * `'`, `\`, and `&` — which no segment or tag contains, so that every
 * segment is spelled verbatim in every form (2.4, 2.7, 6.4). Keyed by code
 * unit; each value names the character for diagnostics.
 */
const VERBATIM_BREAKING_CHARACTERS: ReadonlyMap<number, string> = new Map([
  [0x22, 'a double quote (")'],
  [0x27, "a single quote (')"],
  [0x5c, "a backslash (\\)"],
  [0x26, "an ampersand (&)"],
]);

/** SPEC 1.4: U+FFFD (REPLACEMENT CHARACTER), which no argument value carries (12.0). */
const REPLACEMENT_CHARACTER = 0xfffd;

/**
 * Which rule of SPEC 1.4 a value breaks as an ID segment or a tag — one
 * variant per rule of 1.4's list — as data, so each validating site keeps
 * its own message frame around `describeSegmentViolation`'s wording.
 */
export type SegmentViolation =
  | { readonly rule: "empty" }
  | { readonly rule: "dot" }
  | { readonly rule: "hash" }
  | { readonly rule: "whitespace" }
  | { readonly rule: "control" }
  | { readonly rule: "verbatim"; readonly character: string }
  | { readonly rule: "replacement" }
  | { readonly rule: "forbidden-name" };

/**
 * The one SPEC 1.4 validator: the first rule `value` breaks as an ID
 * segment (`kind` `"segment"`) or a tag (`"tag"`, which MAY contain `"."`,
 * 1.4's last paragraph), or null when it satisfies every rule. A segment:
 * is non-empty; contains no `"."`, no `"#"`, no whitespace or control
 * character (this module's exact classes), none of `"`, `'`, `\`, `&`, and
 * no U+FFFD; and is none of the forbidden names. Every site that judges a
 * segment or a tag goes through here — MDX `id`/`tags` props (14.4),
 * rename and move's `<new-id>` (`refused-invalid-id`, 14), `occurrences
 * --to` spellings (11.3), `query nodes --tag` spellings (11.1), and journal
 * entries (14.13).
 */
export function segmentViolation(
  value: string,
  kind: "segment" | "tag",
): SegmentViolation | null {
  if (value.length === 0) {
    return { rule: "empty" };
  }
  // A single code-unit scan is exact: every character the rules name is
  // one UTF-16 code unit, and no surrogate half is any of them.
  let violation: SegmentViolation | null = null;
  for (let index = 0; index < value.length && violation === null; index += 1) {
    const code = value.charCodeAt(index);
    if (code === 0x2e) {
      if (kind === "segment") violation = { rule: "dot" };
    } else if (code === 0x23) {
      violation = { rule: "hash" };
    } else if (isWhitespaceCodePoint(code)) {
      violation = { rule: "whitespace" };
    } else if (isControlCodePoint(code)) {
      violation = { rule: "control" };
    } else if (code === REPLACEMENT_CHARACTER) {
      violation = { rule: "replacement" };
    } else {
      const character = VERBATIM_BREAKING_CHARACTERS.get(code);
      if (character !== undefined) {
        violation = { rule: "verbatim", character };
      }
    }
  }
  if (violation !== null) {
    return violation;
  }
  return FORBIDDEN_SEGMENT_NAMES.has(value) ? { rule: "forbidden-name" } : null;
}

/**
 * Every segment of the dotted ID `id` (SPEC 1.3: segments joined by `"."`)
 * that breaks SPEC 1.4, in order, with the first rule each breaks; empty
 * exactly when `id` is well-formed. The split makes 1.4's no-`"."` rule
 * structural: a doubled, leading, or trailing `"."` yields an empty
 * segment.
 */
export function idSegmentViolations(
  id: string,
): { readonly segment: string; readonly violation: SegmentViolation }[] {
  const violations: {
    readonly segment: string;
    readonly violation: SegmentViolation;
  }[] = [];
  for (const segment of id.split(".")) {
    const violation = segmentViolation(segment, "segment");
    if (violation !== null) {
      violations.push({ segment, violation });
    }
  }
  return violations;
}

/**
 * The shared wording of a SPEC 1.4 violation: a predicate completing "the
 * segment …" or "the tag …" (e.g. `contains "#"`).
 */
export function describeSegmentViolation(violation: SegmentViolation): string {
  switch (violation.rule) {
    case "empty":
      return "is empty";
    case "dot":
      return 'contains "."';
    case "hash":
      return 'contains "#"';
    case "whitespace":
      return "contains whitespace";
    case "control":
      return "contains a control character";
    case "verbatim":
      return (
        `contains ${violation.character}, one of the quote, escape, and ` +
        `character-reference characters`
      );
    case "replacement":
      return "contains U+FFFD (REPLACEMENT CHARACTER)";
    case "forbidden-name":
      return (
        'is one of the forbidden names ("$", "__proto__", "prototype", ' +
        '"constructor", "then")'
      );
  }
}

/** A SPEC 3 line terminator: CRLF (one terminator), lone LF, or lone CR. */
export type LineTerminator = "\r\n" | "\n" | "\r";

/**
 * One line under the SPEC 3 line model: a maximal terminator-free run of
 * characters plus the terminator that ends it; the final line MAY have no
 * terminator (terminator `""`). Indices are UTF-16 code-unit offsets into
 * the split text: content = text.slice(start, contentEnd) and
 * terminator = text.slice(contentEnd, end).
 */
export interface Line {
  readonly content: string;
  readonly terminator: LineTerminator | "";
  readonly start: number;
  readonly contentEnd: number;
  readonly end: number;
}

/**
 * Splits `text` into SPEC 3 lines. A line terminator is the sequence U+000D
 * U+000A (one terminator), a U+000A not preceded by U+000D, or a U+000D not
 * followed by U+000A. The concatenation of every line's content and
 * terminator restores `text` exactly; empty text yields no lines, and text
 * not ending in a terminator yields a final line with terminator `""`.
 */
export function splitLines(text: string): Line[] {
  const lines: Line[] = [];
  let start = 0;
  let index = 0;
  while (index < text.length) {
    const code = text.charCodeAt(index);
    if (code === 0x0d) {
      const terminator: LineTerminator =
        index + 1 < text.length && text.charCodeAt(index + 1) === 0x0a
          ? "\r\n"
          : "\r";
      const end = index + terminator.length;
      lines.push({
        content: text.slice(start, index),
        terminator,
        start,
        contentEnd: index,
        end,
      });
      start = end;
      index = end;
    } else if (code === 0x0a) {
      // A preceding U+000D would have consumed this U+000A as CRLF, so this
      // is a U+000A not preceded by U+000D: a lone-LF terminator.
      lines.push({
        content: text.slice(start, index),
        terminator: "\n",
        start,
        contentEnd: index,
        end: index + 1,
      });
      start = index + 1;
      index = start;
    } else {
      index += 1;
    }
  }
  if (start < text.length) {
    lines.push({
      content: text.slice(start),
      terminator: "",
      start,
      contentEnd: text.length,
      end: text.length,
    });
  }
  return lines;
}
