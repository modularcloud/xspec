// JSX names judged by code point (SPEC 14.20).
//
// SPEC 14.20: "ECMAScript 2024 takes its identifier characters, JSX names'
// included, ... from the latest Unicode version". A JSX element's or
// attribute's name — each of its parts, member and local names included —
// is an identifier start (a code point with the ID_Start property, `$`, or
// `_`) followed by identifier parts (ID_Continue, `$`, U+200C, U+200D) and
// `-`, each judged as one code point under the runtime's Unicode tables
// (Node 22's, Unicode 15.1 or later: a text deriving only under a later
// version's is not fixed by SPEC 14.20). remark-mdx's JSX tokenizer
// (micromark-extension-mdx-jsx 3, through estree-util-is-identifier-name)
// judges one UTF-16 code unit at a time instead: a supplementary-plane
// character is two units, neither an identifier character alone, so the
// tokenizer fails at its first unit ("Unexpected character ... (U+D87A) in
// name") though ECMAScript admits it — U+2EBF0, U+10400, and U+1D465 alike.
//
// The grammar stays remark-mdx's (IMPLEMENTATION) and is handed a respelled
// text instead. Where its tokenizer fails at a supplementary-plane character
// that is an identifier character, that character — and each one after it
// in the run of identifier parts it begins, which the tokenizer reads in the
// same name — is respelled as two Basic Multilingual Plane identifier
// characters (a stand-in), and the text is parsed again:
//
// - a stand-in admits exactly what its character does: its first unit is
//   an ID_Start character (a CJK unified ideograph) where the character is
//   ID_Start, and an ID_Continue character that is no ID_Start one (a
//   nonspacing mark) where it is not, so a name may not begin with it; its
//   second unit, read inside the name, is ID_Continue (a Hangul syllable);
// - nothing else reads it otherwise: stand-ins are letters and marks outside
//   ASCII — no whitespace, punctuation, or line ending — which no Markdown
//   construct reads apart from the supplementary-plane letters and marks
//   they replace, and an identifier of the same class to acorn;
// - names compare as spelled: each code point respelled has its own two
//   stand-in units, drawn from characters the text does not hold, so two
//   names are equal exactly when their spellings are (the closing tag pairs
//   by its spelling), and the original spelling is recovered unit by unit
//   (`restoreNameSpelling`);
// - no offset moves and no line changes: two units replace two units.
//
// Where the tokenizer then fails at a respelled character, it admits no
// name character there (`<a/` then the character) and the original failure
// is thrown; every failure thrown is restored to the original spelling,
// since a tag-pairing failure quotes names. A text that holds no such
// character is parsed once, as spelled.

/** A stock grammar failure, structurally (a `VFileMessage`). */
interface GrammarFailure {
  readonly source?: unknown;
  readonly ruleId?: unknown;
  readonly place?: unknown;
  reason?: unknown;
  message?: unknown;
}

/**
 * The respelling one parse used: each stand-in code unit, with the original
 * code unit (a surrogate) it replaced. Empty where nothing was respelled.
 */
export interface NameStandIns {
  readonly units: ReadonlyMap<number, number>;
}

/** No respelling: nothing to restore. */
export const NO_NAME_STAND_INS: NameStandIns = { units: new Map() };

/** How many runs one parse may respell — one per name at most. */
const NAME_RESPELLINGS = 4096;

const ID_START = /^\p{ID_Start}$/u;
const ID_CONTINUE = /^\p{ID_Continue}$/u;

/** First units of an ID_Start character's stand-in: CJK unified ideographs. */
const START_UNITS: readonly [number, number] = [0x4e00, 0x9fff];
/** Second units of every stand-in: Hangul syllables (ID_Continue). */
const SECOND_UNITS: readonly [number, number] = [0xac00, 0xd7a3];

/** First units of an ID_Continue-only character's stand-in. */
let continueOnly: readonly number[] | null = null;

/**
 * The nonspacing marks of the Basic Multilingual Plane (below the
 * surrogates) that are ID_Continue and not ID_Start — computed once.
 */
function continueUnits(): readonly number[] {
  if (continueOnly === null) {
    const units: number[] = [];
    for (let code = 0x80; code < 0xd800; code += 1) {
      const character = String.fromCharCode(code);
      if (
        /^\p{Mn}$/u.test(character) &&
        ID_CONTINUE.test(character) &&
        !ID_START.test(character)
      ) {
        units.push(code);
      }
    }
    continueOnly = units;
  }
  return continueOnly;
}

/** Whether the code point at `at` continues an identifier (JSX: `-` too). */
function continuesName(text: string, at: number): boolean {
  const code = text.codePointAt(at);
  if (code === undefined) return false;
  // `$`, `-`, U+200C, U+200D (ECMAScript's and JSX's additions).
  if (code === 0x24 || code === 0x2d || code === 0x200c || code === 0x200d) {
    return true;
  }
  return ID_CONTINUE.test(String.fromCodePoint(code));
}

/** A failure's start offset (UTF-16), if it has one. */
function failureOffset(failure: GrammarFailure): number | undefined {
  const place = failure.place as
    | { readonly offset?: unknown; readonly start?: { offset?: unknown } }
    | null
    | undefined;
  const point = place?.start ?? place;
  return typeof point?.offset === "number" ? point.offset : undefined;
}

/**
 * Where the JSX tokenizer failed at a supplementary-plane identifier
 * character of `spelled` — the offset of its first unit; undefined for any
 * other failure.
 */
function nameCharacterAt(spelled: string, error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const failure = error as GrammarFailure;
  if (
    failure.source !== "micromark-extension-mdx-jsx" ||
    failure.ruleId !== "unexpected-character"
  ) {
    return undefined;
  }
  const at = failureOffset(failure);
  if (at === undefined) return undefined;
  const code = spelled.codePointAt(at);
  return code !== undefined &&
    code > 0xffff &&
    ID_CONTINUE.test(String.fromCodePoint(code))
    ? at
    : undefined;
}

/**
 * One text's respelling in progress: its stand-ins, and the failure each
 * respelled run's start undid.
 */
class Respelling implements NameStandIns {
  readonly units = new Map<number, number>();
  private readonly pairs = new Map<number, string>();
  private readonly undone = new Map<number, unknown>();
  /** The pool code units the original text holds, which no stand-in may be. */
  private readonly held = new Set<number>();
  private nextStart = START_UNITS[0];
  private nextSecond = SECOND_UNITS[0];
  private nextContinue = 0;

  constructor(text: string) {
    for (let index = 0; index < text.length; index += 1) {
      const code = text.charCodeAt(index);
      if (code >= 0x300 && code < 0xd800) this.held.add(code);
    }
  }

  /** The original failure where `error` lies at a respelled run's start. */
  undoneAt(error: unknown): unknown {
    if (typeof error !== "object" || error === null) return undefined;
    const at = failureOffset(error as GrammarFailure);
    return at === undefined ? undefined : this.undone.get(at);
  }

  /**
   * `spelled` with the run of identifier parts beginning at `at` (a
   * supplementary-plane identifier character, where `error` failed)
   * respelled; null where the stand-ins run out.
   */
  respell(spelled: string, at: number, error: unknown): string | null {
    const units = spelled.split("");
    let index = at;
    while (index < spelled.length && continuesName(spelled, index)) {
      const code = spelled.codePointAt(index) ?? 0;
      if (code <= 0xffff) {
        index += 1;
        continue;
      }
      const pair = this.pairFor(code);
      if (pair === null) return null;
      units[index] = pair[0];
      units[index + 1] = pair[1];
      index += 2;
    }
    this.undone.set(at, error);
    return units.join("");
  }

  /** The stand-in pair of one code point — its own, the same at every use. */
  private pairFor(code: number): string | null {
    const known = this.pairs.get(code);
    if (known !== undefined) return known;
    const first = ID_START.test(String.fromCodePoint(code))
      ? this.takeStart()
      : this.takeContinue();
    const second = first === undefined ? undefined : this.takeSecond();
    if (first === undefined || second === undefined) return null;
    const pair = String.fromCharCode(first, second);
    const original = String.fromCodePoint(code);
    this.units.set(first, original.charCodeAt(0));
    this.units.set(second, original.charCodeAt(1));
    this.pairs.set(code, pair);
    return pair;
  }

  private takeStart(): number | undefined {
    while (this.nextStart <= START_UNITS[1]) {
      const code = this.nextStart;
      this.nextStart += 1;
      if (!this.held.has(code) && ID_START.test(String.fromCharCode(code))) {
        return code;
      }
    }
    return undefined;
  }

  private takeSecond(): number | undefined {
    while (this.nextSecond <= SECOND_UNITS[1]) {
      const code = this.nextSecond;
      this.nextSecond += 1;
      if (!this.held.has(code) && ID_START.test(String.fromCharCode(code))) {
        return code;
      }
    }
    return undefined;
  }

  private takeContinue(): number | undefined {
    const candidates = continueUnits();
    while (this.nextContinue < candidates.length) {
      const code = candidates[this.nextContinue];
      this.nextContinue += 1;
      if (!this.held.has(code)) return code;
    }
    return undefined;
  }
}

/**
 * `value` — read from a text respelled by `judgingNamesByCodePoint` — with
 * each stand-in unit restored to the original spelling.
 */
export function restoreNameSpelling(
  value: string,
  standIns: NameStandIns,
): string {
  if (standIns.units.size === 0) return value;
  const units = value.split("");
  let changed = false;
  for (let index = 0; index < units.length; index += 1) {
    const original = standIns.units.get(value.charCodeAt(index));
    if (original !== undefined) {
      units[index] = String.fromCharCode(original);
      changed = true;
    }
  }
  return changed ? units.join("") : value;
}

/** A thrown failure with its texts restored to the original spelling. */
function restoredFailure(error: unknown, standIns: NameStandIns): unknown {
  if (standIns.units.size === 0) return error;
  if (typeof error !== "object" || error === null) return error;
  const failure = error as GrammarFailure;
  if (typeof failure.reason === "string") {
    failure.reason = restoreNameSpelling(failure.reason, standIns);
  }
  if (typeof failure.message === "string") {
    failure.message = restoreNameSpelling(failure.message, standIns);
  }
  return error;
}

/**
 * `attempt` — one parse by remark-mdx's grammar, throwing its failure —
 * applied to `text` with JSX names judged by code point (SPEC 14.20): where
 * the tokenizer fails at a supplementary-plane identifier character, the
 * text is respelled (see above) and parsed again. Returns the result with
 * the stand-ins it was parsed with (names read from the result carry them:
 * `restoreNameSpelling`); throws the failure that stands, restored to the
 * original spelling.
 */
export function judgingNamesByCodePoint<T>(
  text: string,
  attempt: (spelled: string) => T,
): { readonly result: T; readonly standIns: NameStandIns } {
  let spelled = text;
  let respelling: Respelling | null = null;
  for (let round = 0; ; round += 1) {
    try {
      return {
        result: attempt(spelled),
        standIns: respelling ?? NO_NAME_STAND_INS,
      };
    } catch (error) {
      const standIns = respelling ?? NO_NAME_STAND_INS;
      // The tokenizer admits no name character where a run was respelled:
      // the character's own failure stands.
      const undone = respelling?.undoneAt(error);
      if (undone !== undefined) throw restoredFailure(undone, standIns);
      const at =
        round < NAME_RESPELLINGS ? nameCharacterAt(spelled, error) : undefined;
      if (at === undefined) throw restoredFailure(error, standIns);
      respelling ??= new Respelling(text);
      const next = respelling.respell(spelled, at, error);
      if (next === null) throw restoredFailure(error, respelling);
      spelled = next;
    }
  }
}
