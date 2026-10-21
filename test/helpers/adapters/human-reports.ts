// H-3 output adapters — the human-report decoders (TEST-SPEC H-3 "Report
// forms", H-5, T12.0-15, S-5; SPEC 12.0, 14). Harness machinery only: no
// product imports.
//
// H-3: "the human report of every command that has one … is asserted,
// decoded by a human-report adapter held to the rules above (shape-aware,
// value-blind, failing loudly when required information is absent)". Where
// the mention matcher beside this module (human.ts) asks only that each
// datum appear somewhere, associating nothing, these decoders take a human
// report onto the information model the `--json` assertions use — each
// finding's stable code, its locations, its concerned path, and its
// identities, one finding per finding (model.ts `FindingInformation`), and
// an exit-2 error's stable code and concerned path (`ErrorInformation`) —
// so a comparison against the `--json` twin's decoded document can tell
// which datum belongs to which finding and which the human report omits
// (T12.0-15: "a datum the `--json` document carries and the human report
// omits fails"). The preview decoder beside them takes a `rename`/`move
// --preview` report onto the preview model the form-exact `--json` decode
// produces (model.ts `PreviewReport`): its findings as above, and its plan
// — the mapping's pairs, each file with its edits' classes and ranges, and
// the delta's two directions or its unavailability (TEST-SPEC T6.6-7). The
// performed-report decoder takes a successful `rename`/`move` report onto
// the applied mapping the form-exact `--json` decode produces (model.ts
// `PerformedOperationReport`): every pair the operation journaled, its
// `from` and `to` identity (TEST-SPEC T12.0-15; SPEC 6.4, 6.5).
// Like every adapter here they are the one place aware of the report's
// concrete shape: adjustable to shape, never to values, and failing loudly
// — a diagnosed `HarnessAssertionError` naming the line and the datum —
// when a report's text fits none of the layout below or lacks what the
// layout carries. Later decoders for the other human reports (impact,
// review, coverage, ids, show) go beside these.
//
// The layout, fitted to what the built product emits (observed by running
// it on T14-11's per-condition fixtures, T1.5-2's arms, T12.7-3's stagings,
// and hand-staged 14.11, 14.12, 14.13, 14.21, refusal, and code-less
// findings, the previews of T6.6-2 through T6.6-6, and the performed
// reports of T6.4-1's rename and T6.5-1's file moves — never by reading
// its source):
//
// - A findings report — a failing `build`'s validation errors, `check`'s
//   findings, a gated read's report (13.3), a refused operation's refusal
//   reasons (6.4–6.6, 10.7) — is empty when there is no finding, and is
//   otherwise one line per finding, in any order, then an optional count
//   line (`3 findings`, `1 finding`), which must then equal the number of
//   finding lines. A finding line is
//     `[<head>: ]<code>: <message>[ (also at <loc>, …)][ [<identity>, …]]`
//   where `<head>` is the first location `<path>:<start>-<end>` of a
//   located finding, the concerned `<path>` of a path-level one, or absent
//   (a policy violation, a refusal concerning an identity, a code-less
//   finding); `<code>` is the stable code (SPEC 14) or, for a code-less
//   finding (10.7), the word `finding`; the parenthesized list holds every
//   further location in the same `<path>:<start>-<end>` form; and the
//   bracketed list holds the identities, in their order. The message is
//   free wording (H-3; T12.0-15: never asked) and is never decoded. A
//   datum the built product prints as it stands may hold a line feed
//   (U+000A) — T6.5-4's barred destination `specs/a<U+000A>b.mdx`, the
//   concerned path of its refusal, a valid-UTF-8 path with no marked form
//   (12.0) — which then breaks its finding line in two: a line holding no
//   `: ` at all is no finding line by itself, so it is read together with
//   the line after it, joined by the line feed, until the text holds a
//   `: ` (never joined with the count line ending the report, nor in a
//   preview with a section header or a section's item). SPEC fixes no
//   human spelling for such a path: a product printing the line feed
//   escaped or quoted reads here as another path, failing the comparison —
//   a layout this adapter would be adjusted to, as to any other shape,
//   never a value.
// - An exit-2 error's standard-error message (12.0: with JSON output not
//   in effect, its only report) opens with the diagnostic prefix
//   `xspec: `; a coded error continues `<code>: <path>: <message>`, with
//   one such line per defect where a condition reports several (a
//   configuration file's distinct defects), each repeating the code and
//   the path; a plain usage error continues with its message alone.
// - A preview report — `rename … --preview` or `move … --preview` without
//   `--json` (SPEC 6.6) — is, for a refused preview, the findings report of
//   its refusal findings alone (above, its count line ending it). Any other
//   preview prints its plan: three sections, each opened by a header line
//   at the margin — `mapping:`, `files:`, and `delta:`, in that order as
//   the built product prints them, read in any order, each exactly once —
//   after the finding lines of an answer carrying a finding (14.23's
//   unavailable delta beside its condition-23 finding; the built product
//   prints no count line there, and one ending the finding lines is read).
//   Beneath `mapping:`, one line per mapped identity, indented two spaces:
//   `<from> -> <to>`. Beneath `files:`, each file's path indented two
//   spaces, and beneath it one line per edit indented four:
//   `<start>-<end> <class>` — the range's two pre-operation byte offsets
//   (1.7; a creation's `0-0`, the new file's start) and its class, one of
//   the ten 12.7 class names, read as a code is (below). Beneath `delta:`,
//   one line per derived path, indented two spaces: `generated <path>` or
//   `removed <path>`, nothing beneath it where both directions are empty —
//   or, the delta unavailable (14.23), the header `delta: unavailable` with
//   nothing beneath it. A finding line may stand at the margin between
//   sections too; it closes the section above it.
// - A performed report — a successful `rename …` or `move …` without
//   `--json` (SPEC 6.4: a successful rename's report is the applied
//   mapping, and a move reports its own as rename does, 6.5) — is one line
//   per mapped identity at the margin, `<from> -> <to>`, in any order, then
//   an optional count line (`2 identities mapped`, `1 identity mapped`),
//   which must then equal the number of pair lines. A successful operation
//   carries no finding (12.7: `findings` `[]`), so no finding line belongs
//   there: a line holding no pair fits no layout.
// - A code is recognized at the position the layout gives it, spelled as
//   human.ts's `codeMention` spells one, over the whole segment: its words
//   case-insensitive, joined by one character that is neither letter nor
//   digit or by nothing — the findings report prints `missing-id`, the
//   standard-error message `configuration error`. A segment spelling no
//   stable code is no code.
// - A path is a plain path as it stands, or the marked byte form 12.0
//   requires for a non-UTF-8 path — `<bytes <hex>>`, the path's exact
//   bytes as lowercase hexadecimal, two digits per byte — recognized by
//   that mark alone, whatever the bytes are (T12.0-15: "telling it from a
//   plain path string by that mark alone and recovering from it the path's
//   exact bytes"), and decoded to the same model value the `--json` marked
//   form decodes to (`{ bytes }`), so the comparison below holds the two
//   presentations to the same bytes and the same form: a valid-UTF-8 path
//   presented marked, or a non-UTF-8 path presented plain — lossily
//   decoded (U+FFFD-substituted) or otherwise unmarked — differs from its
//   twin. A report whose bytes are not valid UTF-8 fails at once: every
//   datum a report carries has a UTF-8 spelling (identities and plain
//   paths are valid UTF-8, and a non-UTF-8 path has no plain form, 12.0),
//   so such bytes are a path printed raw.
//
// Conservative operationalizations (noted per H-3):
// - The layout's separators are its own: a datum spelling one cannot be
//   told from the layout. A path holding a `: `-bounded segment that spells
//   a stable code before its finding's code, or ending in `:<n>-<n>`, a
//   location path or identity holding `, `, an identity holding ` [`, a
//   concerned path holding `: ` in a standard-error message, a message
//   ending in `)` after ` (also at ` or in `]` after ` [`, and a line
//   feed (U+000A) anywhere but in a finding's head — or in a head whose
//   part before it holds `: ` — would mis-decode — never into a pass:
//   the decoded finding then differs from its twin, or the line fits no
//   layout, and the comparison or the decode fails diagnosed. The data of
//   T14-11's fixtures, T1.5-2's arms, T12.7-3's stagings, and T6.6-3's
//   refused previews hold none.
//   Likewise in a preview's plan: an identity holding ` -> ` (a pair line
//   holding it twice fails as ambiguous), and an identity or path
//   beginning with a space, which the indentation absorbs — the data of
//   T6.6-2's, T6.6-4's, T6.6-5's, and T6.6-6's stagings hold none, and
//   the refused previews of T6.6-3 print no plan. In a performed report,
//   an identity holding ` -> ` likewise, or one spelling the count line's
//   form as the report's last line — the performed operations of T6.4-1
//   and T6.5-1 map none.
// - A code's words at the code's position are the code — human.ts's
//   convention, under which `missing ID` carries `missing-id` — so a line
//   whose code token is gone but whose message opens with its own code's
//   words up to a `: ` (the built product's `unknown dependency: …`)
//   reads as carrying the code; a message opening with another code's
//   words reads as that code, and fails the comparison.
// - The comparison is exact on the information model: the human report's
//   findings, as a multiset, equal the `--json` document's — one human
//   finding per JSON finding, findings equal in every datum included (two
//   14.13 findings on different journal lines differ in their messages
//   alone) — each finding's locations as a multiset (their order the JSON
//   form's alone, 12.7), its identities as a sequence (their positions
//   carry their roles: 14.12's rule, source, kind, and target; a
//   refusal's bearers in location order), and every path compared in form
//   and bytes.
// - A preview's comparison is exact on the preview model, its order free
//   (SPEC fixes none for the human report; 12.7's orders are the JSON
//   form's, T12.0-15): its findings as above; a plan exactly where the
//   `--json` twin reports one — none beside a refusal's findings (6.6) —
//   its mapping as a multiset of `from`/`to` pairs, its files as a set of
//   paths in form and bytes (a path listed twice reads as one file, its
//   edits merged), each file's edits as a multiset of class and range, and
//   the delta reported unavailable exactly where the twin's is (14.23),
//   else each direction's paths as a multiset in form and bytes, a path
//   under the other direction named as such.
// - A performed report's comparison is exact on the applied mapping, its
//   order free (12.7's `from`-byte order is the JSON form's, T12.0-15): its
//   pairs as a multiset of `from`/`to` pairs, a pair the human report
//   omits, changes, or lists beside the twin's named as such.

import { Buffer } from "node:buffer";
import { fail } from "../assertions.js";
import { guardSyncStep } from "../step-guards.js";
import type { RunResult } from "../subprocess.js";
import { pathValueBytes, renderPathValue } from "./forms.js";
import { STABLE_CODES } from "./human.js";
import type {
  AppliedMappingPair,
  ErrorInformation,
  Finding,
  FindingInformation,
  FindingLocation,
  PathValue,
  PerformedOperationReport,
  PreviewDeltaDatum,
  PreviewEdit,
  PreviewEditClass,
  PreviewReport,
} from "./model.js";
import { PREVIEW_EDIT_CLASSES } from "./model.js";

// --- the decoded forms ---------------------------------------------------------

/** One finding decoded from a human findings report, with where it stood. */
export interface HumanFinding extends FindingInformation {
  /** The report line it was decoded from, 1-based. */
  readonly line: number;
  /** That line's text. */
  readonly text: string;
}

/** A human findings report decoded onto the information model. */
export interface HumanFindingsReport {
  /** Every finding, in the report's own order (free, T12.0-15). */
  readonly findings: readonly HumanFinding[];
}

/** An exit-2 standard-error message decoded onto the information model. */
export interface HumanErrorMessage extends ErrorInformation {
  /** The message's text. */
  readonly text: string;
}

/**
 * One identity pair of a human preview's mapping or of a performed report's
 * applied mapping, with where it stood.
 */
export interface HumanMappingPair extends AppliedMappingPair {
  /** The report line it was decoded from, 1-based. */
  readonly line: number;
  /** That line's text. */
  readonly text: string;
}

/** One edit a human preview lists beneath its file, with where it stood. */
export interface HumanPreviewEdit extends PreviewEdit {
  /** The report line it was decoded from, 1-based. */
  readonly line: number;
  /** That line's text. */
  readonly text: string;
}

/** One file a human preview lists, with the edits beneath it. */
export interface HumanPreviewFile {
  /** The file's path, plain or in the marked byte form's model value. */
  readonly file: PathValue;
  /** Its edits, in the report's own order (free, T12.0-15). */
  readonly edits: readonly HumanPreviewEdit[];
  /** The report line its path stood on, 1-based. */
  readonly line: number;
  /** That line's text. */
  readonly text: string;
}

/** One derived path a human preview's delta lists, with where it stood. */
export interface HumanDeltaPath {
  /** The path, plain or in the marked byte form's model value. */
  readonly path: PathValue;
  /** The report line it was decoded from, 1-based. */
  readonly line: number;
  /** That line's text. */
  readonly text: string;
}

/**
 * A human preview's delta: its two directions, each in the report's own
 * order, or reported unavailable as one datum (SPEC 6.6, 14.23).
 */
export type HumanPreviewDelta =
  | {
      readonly generated: readonly HumanDeltaPath[];
      readonly removed: readonly HumanDeltaPath[];
    }
  | {
      readonly unavailable: true;
      /** The report line of the `delta: unavailable` header, 1-based. */
      readonly line: number;
    };

/** A human preview's plan: its mapping, files, and delta (SPEC 6.6). */
export interface HumanPreviewPlan {
  readonly mapping: readonly HumanMappingPair[];
  readonly files: readonly HumanPreviewFile[];
  readonly delta: HumanPreviewDelta;
}

/**
 * A human preview report decoded onto the preview model (TEST-SPEC
 * T6.6-7): its findings, and its plan — `null` where the report prints none,
 * as a refused preview's does (SPEC 6.6).
 */
export interface HumanPreviewReport {
  /** Every finding, in the report's own order (free, T12.0-15). */
  readonly findings: readonly HumanFinding[];
  readonly plan: HumanPreviewPlan | null;
  /** The report's text, for diagnoses. */
  readonly text: string;
}

/**
 * A human performed report decoded onto the applied mapping (TEST-SPEC
 * T12.0-15; SPEC 6.4, 6.5): every pair the report lists.
 */
export interface HumanPerformedReport {
  /** Every mapped pair, in the report's own order (free, T12.0-15). */
  readonly mapping: readonly HumanMappingPair[];
  /** The report's text, for diagnoses. */
  readonly text: string;
}

// --- diagnoses -------------------------------------------------------------------

const EXCERPT_LIMIT = 2048;

function excerpt(text: string): string {
  if (text.length === 0) return "<empty>";
  const clipped = text.slice(0, EXCERPT_LIMIT);
  return text.length > EXCERPT_LIMIT
    ? `${JSON.stringify(clipped)}… (${String(text.length)} chars total)`
    : JSON.stringify(clipped);
}

/** Render raw bytes for a diagnosis: hexadecimal, bounded. */
function renderBytes(bytes: Uint8Array): string {
  const LIMIT = 512;
  const hex = Buffer.from(bytes.subarray(0, LIMIT)).toString("hex");
  return bytes.length > LIMIT
    ? `hex ${hex}… (${String(bytes.length)} bytes total)`
    : `hex ${hex}`;
}

/** The adapter's name in a diagnosis, the caller's context beside it. */
function adapterName(kind: string, context: string | undefined): string {
  return context === undefined
    ? `human ${kind} adapter`
    : `human ${kind} adapter (${context})`;
}

/**
 * Fail a decode loudly (H-3: a test error, never a pass), naming the
 * adapter, the line, and what the layout expected there.
 */
function decodeFail(
  adapter: string,
  where: string,
  expected: string,
  report: string,
): never {
  fail(
    `${adapter}: ${where}: expected ${expected}. ` +
      `H-3: the human-report adapter is fitted to the product's report layout and fails loudly ` +
      `when required information is absent or unparseable, never defaulting; if the product's ` +
      `real layout legitimately differs, adjust this adapter's shape — never its values.\n` +
      `Report: ${excerpt(report)}`,
  );
}

/** A line of the report, quoted for a diagnosis. */
function atLine(line: number, text: string): string {
  return `line ${String(line)} (${excerpt(text)})`;
}

// --- shared readings -------------------------------------------------------------

/**
 * The report's text, its bytes valid UTF-8 — else the decode fails: such
 * bytes are a path printed raw (the module header).
 */
function utf8Text(bytes: Uint8Array, adapter: string, stream: string): string {
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      bytes,
    );
  } catch {
    return fail(
      `${adapter}: the ${stream} is not valid UTF-8 — every datum a report carries has a UTF-8 ` +
        `spelling and a non-UTF-8 path has no plain form, so these bytes are a path printed raw ` +
        `(SPEC 12.0: such a path is presented in an explicitly marked byte form wherever an ` +
        `output carries one; TEST-SPEC T12.0-15): ${renderBytes(bytes)}`,
    );
  }
}

/** The report's lines, a final line break ending the last one. */
function reportLines(text: string): string[] {
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/** One separator character between a code's words, or none (human.ts). */
const CODE_WORD_SEPARATOR = "[^A-Za-z0-9]?";

/** The whole-segment spelling of each stable code (the module header). */
const CODE_SPELLINGS: readonly {
  readonly code: string;
  readonly pattern: RegExp;
}[] = STABLE_CODES.map((code) => ({
  code,
  pattern: new RegExp(`^${code.split("-").join(CODE_WORD_SEPARATOR)}$`, "i"),
}));

/** The word a findings report prints in a code-less finding's code position. */
const CODE_LESS_WORD = /^finding$/i;

/**
 * The stable code a whole segment spells (the module header), `null` for
 * the code-less word, or `undefined` for a segment spelling neither.
 */
function codeSpelledBy(segment: string): string | null | undefined {
  if (CODE_LESS_WORD.test(segment)) return null;
  const spelled = CODE_SPELLINGS.filter(({ pattern }) => pattern.test(segment));
  if (spelled.length > 1) {
    throw new Error(
      `harness defect: the segment ${JSON.stringify(segment)} spells the stable codes ` +
        `${spelled.map(({ code }) => code).join(", ")} at once — SPEC 14's codes are a closed ` +
        `vocabulary no two of whose spellings coincide (human.ts STABLE_CODES)`,
    );
  }
  return spelled[0]?.code;
}

/** The marked byte form of a non-UTF-8 path, the whole token (the module header). */
const BYTE_MARK = /^<bytes ((?:[0-9a-f]{2})+)>$/;

/**
 * A path token as a human report presents it (the module header): the
 * marked byte form, recognized by its mark alone and decoded to its exact
 * bytes (`{ bytes }`, the model value of the `--json` marked form), or a
 * plain path string as it stands. An empty token is no path.
 */
function decodeHumanPathToken(
  token: string,
  adapter: string,
  where: string,
  report: string,
): PathValue {
  if (token.length === 0) {
    decodeFail(adapter, where, "a path, never an empty token", report);
  }
  const mark = BYTE_MARK.exec(token);
  return mark === null ? token : { bytes: mark[1]! };
}

/**
 * A location token: its path — whatever it holds, a line feed included
 * (the module header) — then its offsets, each decimal as the layout
 * spells it: no sign, no leading zero.
 */
const LOCATION_TOKEN = /^([\s\S]+):(0|[1-9][0-9]*)-(0|[1-9][0-9]*)$/;

/**
 * A location token `<path>:<start>-<end>` (the module header), or
 * `undefined` where the token has no such form; a malformed range — an
 * end before its start, an offset past the safe integers — fails.
 */
function decodeLocationToken(
  token: string,
  adapter: string,
  where: string,
  report: string,
): FindingLocation | undefined {
  const match = LOCATION_TOKEN.exec(token);
  if (match === null) return undefined;
  const start = Number(match[2]);
  const end = Number(match[3]);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
    decodeFail(
      adapter,
      where,
      `byte offsets within the safe integers (SPEC 1.7), got ${match[2]!}-${match[3]!}`,
      report,
    );
  }
  if (end < start) {
    decodeFail(
      adapter,
      where,
      `a range whose end is not before its start (SPEC 1.7), got ${match[2]!}-${match[3]!}`,
      report,
    );
  }
  return {
    file: decodeHumanPathToken(match[1]!, adapter, where, report),
    range: { start, end },
  };
}

// --- the findings report -----------------------------------------------------------

/** The layout's separator between a line's head, its code, and its message. */
const SEGMENT_SEPARATOR = ": ";

/** The further locations' list, opening (the module header). */
const ALSO_AT_OPENING = " (also at ";

/** The identities' list, opening (the module header). */
const IDENTITIES_OPENING = " [";

/** The count line ending a report that lists any finding. */
const COUNT_LINE = /^(0|[1-9][0-9]*) findings?$/;

/**
 * A finding line's head, its code, and the rest of it: the first segment
 * spelling a stable code or the code-less word, everything before it the
 * head — `undefined` where no segment does.
 */
function splitAtCode(text: string):
  | {
      readonly head: string;
      readonly code: string | null;
      readonly rest: string;
    }
  | undefined {
  let start = 0;
  for (;;) {
    const end = text.indexOf(SEGMENT_SEPARATOR, start);
    const segment = end === -1 ? text.slice(start) : text.slice(start, end);
    const code = codeSpelledBy(segment);
    if (code !== undefined) {
      return {
        head:
          start === 0 ? "" : text.slice(0, start - SEGMENT_SEPARATOR.length),
        code,
        rest: end === -1 ? "" : text.slice(end + SEGMENT_SEPARATOR.length),
      };
    }
    if (end === -1) return undefined;
    start = end + SEGMENT_SEPARATOR.length;
  }
}

/** One finding line decoded onto the information model (the module header). */
function decodeFindingLine(
  text: string,
  line: number,
  adapter: string,
  report: string,
): HumanFinding {
  const where = atLine(line, text);
  const split = splitAtCode(text);
  if (split === undefined) {
    decodeFail(
      adapter,
      where,
      "a finding line — `[<head>: ]<code>: <message>`, its code a stable code SPEC 14 lists " +
        "or the code-less word `finding` — or the count line ending the report; no segment " +
        "of this line spells a stable code",
      report,
    );
  }
  let body = split.rest;
  let identities: string[] = [];
  if (body.endsWith("]")) {
    const opening = body.lastIndexOf(IDENTITIES_OPENING);
    if (opening !== -1) {
      const listed = body.slice(opening + IDENTITIES_OPENING.length, -1);
      identities = listed.length === 0 ? [] : listed.split(", ");
      body = body.slice(0, opening);
      if (identities.some((identity) => identity.length === 0)) {
        decodeFail(
          adapter,
          where,
          "an identities list `[<identity>, …]` of non-empty identities",
          report,
        );
      }
    }
  }
  const further: FindingLocation[] = [];
  if (body.endsWith(")")) {
    const opening = body.lastIndexOf(ALSO_AT_OPENING);
    if (opening !== -1) {
      const listed = body.slice(opening + ALSO_AT_OPENING.length, -1);
      for (const token of listed.split(", ")) {
        const location = decodeLocationToken(token, adapter, where, report);
        if (location === undefined) {
          decodeFail(
            adapter,
            where,
            `every further location in the \`(also at …)\` list as \`<path>:<start>-<end>\`, ` +
              `its two byte offsets included (SPEC 1.7, 14), got ${JSON.stringify(token)}`,
            report,
          );
        }
        further.push(location);
      }
    }
  }
  if (split.head.length === 0) {
    if (further.length > 0) {
      decodeFail(
        adapter,
        where,
        "a first location `<path>:<start>-<end>` heading a line that lists further locations",
        report,
      );
    }
    return {
      code: split.code,
      locations: [],
      path: null,
      identities,
      line,
      text,
    };
  }
  const first = decodeLocationToken(split.head, adapter, where, report);
  if (first !== undefined) {
    return {
      code: split.code,
      locations: [first, ...further],
      path: null,
      identities,
      line,
      text,
    };
  }
  if (further.length > 0) {
    decodeFail(
      adapter,
      where,
      "a first location `<path>:<start>-<end>`, its two byte offsets included, heading a " +
        `line that lists further locations (SPEC 1.7, 14), got ${JSON.stringify(split.head)}`,
      report,
    );
  }
  return {
    code: split.code,
    locations: [],
    path: decodeHumanPathToken(split.head, adapter, where, report),
    identities,
    line,
    text,
  };
}

/**
 * The finding line opening at `index`, with every line a line feed broke
 * off it (the module header): a line holding no `: ` separator is no
 * finding line by itself — a datum holding a line feed (U+000A), printed
 * as it stands, ends it there — so it is read together with the line after
 * it, joined by the line feed, while the text holds no separator and that
 * line may continue it (`continues`: never the count line ending the
 * report, a section header, or a section's item). Returns the text and the
 * index of its last line.
 */
function findingLineAt(
  lines: readonly string[],
  index: number,
  continues: (next: number) => boolean,
): { readonly text: string; readonly last: number } {
  let text = lines[index]!;
  let last = index;
  while (
    !text.includes(SEGMENT_SEPARATOR) &&
    last + 1 < lines.length &&
    continues(last + 1)
  ) {
    last += 1;
    text = `${text}\n${lines[last]!}`;
  }
  return { text, last };
}

/** The decode of a findings report's bytes, under its guard. */
function decodeFindingsBytes(
  bytes: Uint8Array,
  context: string | undefined,
): HumanFindingsReport {
  const adapter = adapterName("findings report", context);
  const report = utf8Text(bytes, adapter, "report");
  const lines = reportLines(report);
  const findings: HumanFinding[] = [];
  let counted: number | undefined = undefined;
  const endsReport = (index: number): boolean =>
    index === lines.length - 1 && COUNT_LINE.test(lines[index]!);
  for (let index = 0; index < lines.length; index += 1) {
    const text = lines[index]!;
    const line = index + 1;
    if (endsReport(index)) {
      counted = Number(COUNT_LINE.exec(text)![1]);
      continue;
    }
    if (text.length === 0) {
      decodeFail(
        adapter,
        atLine(line, text),
        "a finding line, never an empty line",
        report,
      );
    }
    const run = findingLineAt(lines, index, (next) => !endsReport(next));
    findings.push(decodeFindingLine(run.text, line, adapter, report));
    index = run.last;
  }
  if (counted !== undefined && counted !== findings.length) {
    decodeFail(
      adapter,
      atLine(lines.length, lines[lines.length - 1]!),
      `a count line equal to the ${String(findings.length)} finding line(s) the report lists — ` +
        `it counts ${String(counted)}`,
      report,
    );
  }
  return { findings };
}

/**
 * Decode a human findings report — the standard output of a failing
 * `build`, of `check`, of a gated read's report, or of a refused
 * operation (SPEC 12.0, 13.3, 14) — onto the information model, one
 * {@link HumanFinding} per finding line (the module header's layout).
 * Takes a run (its stdout bytes: reports are standard-output content,
 * 12.0) or the report's bytes. Fails diagnosed on bytes that are not
 * valid UTF-8, on a line fitting no layout, on a malformed location or
 * identities list, and on a count line disagreeing with the lines. A
 * harness step under its own guard (TEST-SPEC S-3): synchronous, bounded
 * by the capture limit, measured.
 */
export function decodeHumanFindingsReport(
  output: RunResult | Uint8Array,
  context?: string,
): HumanFindingsReport {
  const bytes = output instanceof Uint8Array ? output : output.stdoutBytes;
  const step =
    output instanceof Uint8Array
      ? "decoding a human findings report (decodeHumanFindingsReport)"
      : `decoding the human findings report of ${output.commandLine} (decodeHumanFindingsReport)`;
  return guardSyncStep(step, () => decodeFindingsBytes(bytes, context));
}

// --- the exit-2 standard-error message ----------------------------------------------

/** The product's diagnostic prefix opening a standard-error message line. */
const DIAGNOSTIC_PREFIX = "xspec: ";

/**
 * A prefixed line's head (the module header): the code its first segment
 * spells and the path its second holds before the message — the code
 * `null` where the first segment spells none (a plain usage error), the
 * path `null` where no message follows it.
 */
function errorHead(
  body: string,
  adapter: string,
  where: string,
  report: string,
): ErrorInformation {
  const first = body.indexOf(SEGMENT_SEPARATOR);
  const code = codeSpelledBy(first === -1 ? body : body.slice(0, first));
  if (code === undefined || code === null) return { code: null, path: null };
  if (first === -1) return { code, path: null };
  const rest = body.slice(first + SEGMENT_SEPARATOR.length);
  const second = rest.indexOf(SEGMENT_SEPARATOR);
  if (second === -1) return { code, path: null };
  return {
    code,
    path: decodeHumanPathToken(rest.slice(0, second), adapter, where, report),
  };
}

/** Whether two path values are the same path in the same form (the module header). */
function samePath(a: PathValue | null, b: PathValue | null): boolean {
  if (a === null || b === null) return a === b;
  if ((typeof a === "string") !== (typeof b === "string")) return false;
  return Buffer.compare(pathValueBytes(a), pathValueBytes(b)) === 0;
}

/** The decode of a standard-error message's bytes, under its guard. */
function decodeErrorBytes(
  bytes: Uint8Array,
  context: string | undefined,
): HumanErrorMessage {
  const adapter = adapterName("standard-error message", context);
  const report = utf8Text(bytes, adapter, "standard-error message");
  const lines = reportLines(report);
  if (lines.length === 0) {
    decodeFail(
      adapter,
      "the whole stream",
      "the exit-2 error's message — without JSON output in effect it is the error's only " +
        "report (SPEC 12.0; TEST-SPEC T12.0-15) — but standard error is empty",
      report,
    );
  }
  let heads = 0;
  let decoded: (ErrorInformation & { readonly where: string }) | undefined =
    undefined;
  for (const [index, text] of lines.entries()) {
    if (!text.startsWith(DIAGNOSTIC_PREFIX)) continue;
    heads += 1;
    const where = atLine(index + 1, text);
    const head = errorHead(
      text.slice(DIAGNOSTIC_PREFIX.length),
      adapter,
      where,
      report,
    );
    if (head.code === null) continue;
    if (decoded === undefined) {
      decoded = { ...head, where };
      continue;
    }
    if (head.code !== decoded.code || !samePath(head.path, decoded.path)) {
      decodeFail(
        adapter,
        where,
        `every coded line naming the one error's code and concerned path — ${decoded.where} ` +
          `names ${describeError(decoded)}, this line ${describeError(head)}, so which the ` +
          `error's are is ambiguous`,
        report,
      );
    }
  }
  if (heads === 0) {
    decodeFail(
      adapter,
      "the whole stream",
      `a message opening with the product's diagnostic prefix ${JSON.stringify(DIAGNOSTIC_PREFIX)}`,
      report,
    );
  }
  return {
    code: decoded?.code ?? null,
    path: decoded?.path ?? null,
    text: report,
  };
}

/**
 * Decode an exit-2 error's standard-error message — its only report when
 * JSON output is not in effect (SPEC 12.0; TEST-SPEC H-5, T12.0-15) — onto
 * `{ code, path }` (the module header's layout): the stable code and
 * concerned path its coded lines name, or neither where no line carries a
 * code (a plain usage error, 14). Takes a run (its stderr bytes) or the
 * message's bytes. Fails diagnosed on an empty stream, bytes that are not
 * valid UTF-8, no line opening with the diagnostic prefix, an empty path
 * token, and coded lines naming different codes or paths. A harness step
 * under its own guard (TEST-SPEC S-3).
 */
export function decodeHumanErrorMessage(
  output: RunResult | Uint8Array,
  context?: string,
): HumanErrorMessage {
  const bytes = output instanceof Uint8Array ? output : output.stderrBytes;
  const step =
    output instanceof Uint8Array
      ? "decoding a standard-error message (decodeHumanErrorMessage)"
      : `decoding the standard-error message of ${output.commandLine} (decodeHumanErrorMessage)`;
  return guardSyncStep(step, () => decodeErrorBytes(bytes, context));
}

// --- the preview report ------------------------------------------------------------

/** The plan's three sections, by the word of each header line. */
type PreviewSection = "mapping" | "files" | "delta";

/** The plan's sections, in the order the built product prints them. */
const PREVIEW_SECTIONS: readonly PreviewSection[] = [
  "mapping",
  "files",
  "delta",
];

/** The word after `delta: ` where the delta is unavailable (14.23). */
const UNAVAILABLE_WORD = /^unavailable$/i;

/**
 * A line at the margin opening one of the plan's sections (the module
 * header): `mapping:`, `files:`, `delta:`, or `delta: unavailable` — or
 * `undefined` for any other line.
 */
function previewSectionHeader(
  text: string,
):
  | { readonly section: PreviewSection; readonly unavailable: boolean }
  | undefined {
  if (text === "mapping:") return { section: "mapping", unavailable: false };
  if (text === "files:") return { section: "files", unavailable: false };
  if (text === "delta:") return { section: "delta", unavailable: false };
  const opening = "delta: ";
  if (
    text.startsWith(opening) &&
    UNAVAILABLE_WORD.test(text.slice(opening.length))
  ) {
    return { section: "delta", unavailable: true };
  }
  return undefined;
}

/** The indentation of a section's item lines (the module header). */
const ITEM_INDENT = "  ";

/** The indentation of an edit beneath its file (the module header). */
const EDIT_INDENT = "    ";

/** The separator between a mapping pair's two identities. */
const MAPPING_ARROW = " -> ";

/** An edit's range as the layout spells it — no sign, no leading zero — then its class. */
const EDIT_LINE = /^(0|[1-9][0-9]*)-(0|[1-9][0-9]*) (.+)$/;

/** The whole-segment spelling of each edit class, as a stable code's (the module header). */
const EDIT_CLASS_SPELLINGS: readonly {
  readonly editClass: PreviewEditClass;
  readonly pattern: RegExp;
}[] = PREVIEW_EDIT_CLASSES.map((editClass) => ({
  editClass,
  pattern: new RegExp(
    `^${editClass.split("-").join(CODE_WORD_SEPARATOR)}$`,
    "i",
  ),
}));

/** The delta's two direction words, opening each of its lines. */
const DELTA_DIRECTIONS: readonly {
  readonly direction: "generated" | "removed";
  readonly pattern: RegExp;
}[] = [
  { direction: "generated", pattern: /^generated$/i },
  { direction: "removed", pattern: /^removed$/i },
];

/**
 * A mapping line's pair (the module header): `<from> -> <to>`, both
 * present, after `indent` — a preview's item indentation beneath its
 * `mapping:` header, nothing for a performed report's pair at the margin.
 */
function decodeMappingLine(
  text: string,
  indent: string,
  line: number,
  adapter: string,
  report: string,
): HumanMappingPair {
  const where = atLine(line, text);
  const body = text.slice(indent.length);
  const arrow = body.indexOf(MAPPING_ARROW);
  if (arrow === -1) {
    decodeFail(
      adapter,
      where,
      `a mapping line \`${indent}<from> -> <to>\` — both identities of the pair present, the ` +
        "arrow between them (SPEC 6.6: the mapping's every `from` and `to` identity; 6.4, " +
        "6.5: the applied mapping a performed operation reports)",
      report,
    );
  }
  if (body.indexOf(MAPPING_ARROW, arrow + 1) !== -1) {
    decodeFail(
      adapter,
      where,
      `one ${JSON.stringify(MAPPING_ARROW)} between a pair's two identities — this line holds ` +
        "several, so where the `from` identity ends is ambiguous",
      report,
    );
  }
  const from = body.slice(0, arrow);
  const to = body.slice(arrow + MAPPING_ARROW.length);
  if (from.length === 0 || to.length === 0) {
    decodeFail(
      adapter,
      where,
      `both identities of a mapping pair, never an empty one — its ${from.length === 0 ? "`from`" : "`to`"} ` +
        "identity is absent (SPEC 6.6)",
      report,
    );
  }
  return { from, to, line, text };
}

/** An edit line beneath its file (the module header): `<start>-<end> <class>`. */
function decodeEditLine(
  text: string,
  line: number,
  adapter: string,
  report: string,
): HumanPreviewEdit {
  const where = atLine(line, text);
  const match = EDIT_LINE.exec(text.slice(EDIT_INDENT.length));
  if (match === null) {
    decodeFail(
      adapter,
      where,
      "an edit line `    <start>-<end> <class>` — the edit's range as its two pre-operation " +
        "byte offsets (SPEC 1.7, 6.6; a creation's at the new file's start), then its class",
      report,
    );
  }
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
    decodeFail(
      adapter,
      where,
      `byte offsets within the safe integers (SPEC 1.7), got ${match[1]!}-${match[2]!}`,
      report,
    );
  }
  if (end < start) {
    decodeFail(
      adapter,
      where,
      `a range whose end is not before its start (SPEC 1.7), got ${match[1]!}-${match[2]!}`,
      report,
    );
  }
  const spelled = EDIT_CLASS_SPELLINGS.filter(({ pattern }) =>
    pattern.test(match[3]!),
  );
  if (spelled.length > 1) {
    throw new Error(
      `harness defect: the segment ${JSON.stringify(match[3]!)} spells the edit classes ` +
        `${spelled.map(({ editClass }) => editClass).join(", ")} at once — 12.7's ten class ` +
        `names are a closed vocabulary no two of whose spellings coincide`,
    );
  }
  const editClass = spelled[0]?.editClass;
  if (editClass === undefined) {
    decodeFail(
      adapter,
      where,
      `the edit's class, one of the ten class names SPEC 12.7 lists (${PREVIEW_EDIT_CLASSES.join(", ")}), ` +
        `after its range — got ${JSON.stringify(match[3]!)}`,
      report,
    );
  }
  return { class: editClass, range: { start, end }, line, text };
}

/**
 * A delta line (the module header): `<direction> <path>`, the direction
 * `generated` or `removed`.
 */
function decodeDeltaLine(
  text: string,
  line: number,
  adapter: string,
  report: string,
): {
  readonly direction: "generated" | "removed";
  readonly path: HumanDeltaPath;
} {
  const where = atLine(line, text);
  const body = text.slice(ITEM_INDENT.length);
  const space = body.indexOf(" ");
  const word = space === -1 ? body : body.slice(0, space);
  const direction = DELTA_DIRECTIONS.find(({ pattern }) =>
    pattern.test(word),
  )?.direction;
  if (direction === undefined || space === -1) {
    decodeFail(
      adapter,
      where,
      "a delta line `  <direction> <path>` — the direction `generated` or `removed`, then " +
        "the derived path (SPEC 6.6: the delta's paths in both directions, one datum)",
      report,
    );
  }
  return {
    direction,
    path: {
      path: decodeHumanPathToken(body.slice(space + 1), adapter, where, report),
      line,
      text,
    },
  };
}

/** A file being read, its edits still gathering beneath it. */
interface GatheringFile {
  readonly file: PathValue;
  readonly edits: HumanPreviewEdit[];
  readonly line: number;
  readonly text: string;
}

/** The decode of a preview report's bytes, under its guard. */
function decodePreviewBytes(
  bytes: Uint8Array,
  context: string | undefined,
): HumanPreviewReport {
  const adapter = adapterName("preview report", context);
  const report = utf8Text(bytes, adapter, "report");
  const lines = reportLines(report);
  const findings: HumanFinding[] = [];
  let counted: { readonly count: number; readonly line: number } | undefined =
    undefined;
  const opened = new Map<PreviewSection, number>();
  let unavailable: number | undefined = undefined;
  let section: PreviewSection | undefined = undefined;
  let file: GatheringFile | undefined = undefined;
  const mapping: HumanMappingPair[] = [];
  const files: GatheringFile[] = [];
  const generated: HumanDeltaPath[] = [];
  const removed: HumanDeltaPath[] = [];
  // The count line ending the finding lines: the report's last line, or
  // one a section header follows.
  const endsFindings = (index: number): boolean => {
    const next = lines[index + 1];
    return (
      COUNT_LINE.test(lines[index]!) &&
      (next === undefined || previewSectionHeader(next) !== undefined)
    );
  };
  for (let index = 0; index < lines.length; index += 1) {
    const text = lines[index]!;
    const line = index + 1;
    const where = atLine(line, text);
    if (text.length === 0) {
      decodeFail(
        adapter,
        where,
        "a line of the preview layout — a finding, a section header, or a section's " +
          "item — never an empty line",
        report,
      );
    }
    const header = previewSectionHeader(text);
    if (header !== undefined) {
      const first = opened.get(header.section);
      if (first !== undefined) {
        decodeFail(
          adapter,
          where,
          `each of the plan's sections once — the ${header.section} section opened on line ` +
            `${String(first)} opens again here`,
          report,
        );
      }
      opened.set(header.section, line);
      if (header.unavailable) unavailable = line;
      section = header.section;
      file = undefined;
      continue;
    }
    if (!text.startsWith(ITEM_INDENT)) {
      // At the margin: the count line ending the finding lines, or a
      // finding line — which closes the section above it.
      section = undefined;
      file = undefined;
      if (endsFindings(index)) {
        if (counted !== undefined) {
          decodeFail(
            adapter,
            where,
            `one count line ending the finding lines — line ${String(counted.line)} counts them ` +
              "already",
            report,
          );
        }
        counted = { count: Number(COUNT_LINE.exec(text)![1]), line };
        continue;
      }
      const run = findingLineAt(
        lines,
        index,
        (next) =>
          previewSectionHeader(lines[next]!) === undefined &&
          !lines[next]!.startsWith(ITEM_INDENT) &&
          !endsFindings(next),
      );
      findings.push(decodeFindingLine(run.text, line, adapter, report));
      index = run.last;
      continue;
    }
    if (section === undefined) {
      decodeFail(
        adapter,
        where,
        "an indented line inside one of the plan's sections, a header line at the margin " +
          "— `mapping:`, `files:`, or `delta:` — opening it",
        report,
      );
    }
    switch (section) {
      case "mapping":
        mapping.push(
          decodeMappingLine(text, ITEM_INDENT, line, adapter, report),
        );
        break;
      case "files":
        if (text.startsWith(EDIT_INDENT)) {
          if (file === undefined) {
            decodeFail(
              adapter,
              where,
              "an edit line beneath the file it edits — a file line `  <path>` above it",
              report,
            );
          }
          file.edits.push(decodeEditLine(text, line, adapter, report));
        } else {
          file = {
            file: decodeHumanPathToken(
              text.slice(ITEM_INDENT.length),
              adapter,
              where,
              report,
            ),
            edits: [],
            line,
            text,
          };
          files.push(file);
        }
        break;
      case "delta": {
        if (unavailable !== undefined) {
          decodeFail(
            adapter,
            where,
            "nothing beneath `delta: unavailable` — the delta is reported unavailable as one " +
              "datum (SPEC 6.6, 14.23), never beside paths",
            report,
          );
        }
        const decoded = decodeDeltaLine(text, line, adapter, report);
        (decoded.direction === "generated" ? generated : removed).push(
          decoded.path,
        );
        break;
      }
    }
  }
  if (counted !== undefined && counted.count !== findings.length) {
    decodeFail(
      adapter,
      atLine(counted.line, lines[counted.line - 1]!),
      `a count line equal to the ${String(findings.length)} finding line(s) the report lists — ` +
        `it counts ${String(counted.count)}`,
      report,
    );
  }
  if (opened.size === 0) return { findings, plan: null, text: report };
  for (const expected of PREVIEW_SECTIONS) {
    if (!opened.has(expected)) {
      decodeFail(
        adapter,
        "the whole report",
        `the plan's three sections — \`mapping:\`, \`files:\`, and \`delta:\` — each once ` +
          `(SPEC 6.6: the mapping, every file with its edits, and the delta); the ${expected} ` +
          "section is missing",
        report,
      );
    }
  }
  return {
    findings,
    plan: {
      mapping,
      files,
      delta:
        unavailable === undefined
          ? { generated, removed }
          : { unavailable: true, line: unavailable },
    },
    text: report,
  };
}

/**
 * Decode a human preview report — the standard output of `rename …
 * --preview` or `move … --preview` without `--json` (SPEC 6.6, 12.0) —
 * onto the preview model (the module header's layout): its findings, one
 * {@link HumanFinding} per finding line, and its plan, `null` where the
 * report prints none (a refused preview's findings report). Takes a run
 * (its stdout bytes) or the report's bytes. Fails diagnosed on bytes that
 * are not valid UTF-8, an empty line, a finding line fitting no layout, a
 * count line disagreeing with the finding lines, a section opened twice or
 * missing beside the others, an indented line outside every section, a
 * mapping line without both identities, an edit line without its range or
 * its class or above every file, a delta line without its direction, and
 * a path beneath `delta: unavailable`. A harness step under its own guard
 * (TEST-SPEC S-3).
 */
export function decodeHumanPreviewReport(
  output: RunResult | Uint8Array,
  context?: string,
): HumanPreviewReport {
  const bytes = output instanceof Uint8Array ? output : output.stdoutBytes;
  const step =
    output instanceof Uint8Array
      ? "decoding a human preview report (decodeHumanPreviewReport)"
      : `decoding the human preview report of ${output.commandLine} (decodeHumanPreviewReport)`;
  return guardSyncStep(step, () => decodePreviewBytes(bytes, context));
}

// --- the performed report ------------------------------------------------------------

/** The count line ending a performed report (the module header). */
const MAPPED_COUNT_LINE = /^(0|[1-9][0-9]*) identit(?:y|ies) mapped$/;

/** The decode of a performed report's bytes, under its guard. */
function decodePerformedBytes(
  bytes: Uint8Array,
  context: string | undefined,
): HumanPerformedReport {
  const adapter = adapterName("performed report", context);
  const report = utf8Text(bytes, adapter, "report");
  const lines = reportLines(report);
  const mapping: HumanMappingPair[] = [];
  let counted: number | undefined = undefined;
  for (const [index, text] of lines.entries()) {
    const line = index + 1;
    if (index === lines.length - 1 && MAPPED_COUNT_LINE.test(text)) {
      counted = Number(MAPPED_COUNT_LINE.exec(text)![1]);
      continue;
    }
    if (text.length === 0) {
      decodeFail(
        adapter,
        atLine(line, text),
        "a mapping line `<from> -> <to>`, never an empty line",
        report,
      );
    }
    mapping.push(decodeMappingLine(text, "", line, adapter, report));
  }
  if (counted !== undefined && counted !== mapping.length) {
    decodeFail(
      adapter,
      atLine(lines.length, lines[lines.length - 1]!),
      `a count line equal to the ${String(mapping.length)} mapping line(s) the report lists — ` +
        `it counts ${String(counted)}`,
      report,
    );
  }
  return { mapping, text: report };
}

/**
 * Decode a human performed report — the standard output of a successful
 * `rename …` or `move …` without `--json` (SPEC 6.4, 6.5, 12.0) — onto the
 * applied mapping (the module header's layout), one
 * {@link HumanMappingPair} per pair line. Takes a run (its stdout bytes)
 * or the report's bytes. Fails diagnosed on bytes that are not valid
 * UTF-8, an empty line, a line holding no pair or a pair without both
 * identities, a line holding the arrow twice, and a count line disagreeing
 * with the pair lines. A harness step under its own guard (TEST-SPEC S-3).
 */
export function decodeHumanPerformedReport(
  output: RunResult | Uint8Array,
  context?: string,
): HumanPerformedReport {
  const bytes = output instanceof Uint8Array ? output : output.stdoutBytes;
  const step =
    output instanceof Uint8Array
      ? "decoding a human performed report (decodeHumanPerformedReport)"
      : `decoding the human performed report of ${output.commandLine} (decodeHumanPerformedReport)`;
  return guardSyncStep(step, () => decodePerformedBytes(bytes, context));
}

// --- the comparisons with the --json twin ---------------------------------------------

/**
 * A decoded `--json` finding's information (model.ts): its code,
 * locations, concerned path, and identities — its message and derived
 * condition left out.
 */
export function findingInformation(
  finding: FindingInformation,
): FindingInformation {
  return {
    code: finding.code,
    locations: finding.locations,
    path: finding.path,
    identities: finding.identities,
  };
}

/** A path's form and bytes, as a key part. */
function pathKey(path: PathValue): string {
  return `${typeof path === "string" ? "plain" : "marked"}:${pathValueBytes(path).toString("hex")}`;
}

/** A location as a key part. */
function locationKey(location: FindingLocation): string {
  return `${pathKey(location.file)}@${String(location.range.start)}-${String(location.range.end)}`;
}

/**
 * A finding's information as one comparable key: the code, the locations
 * as a sorted multiset, the path in form and bytes, and the identities in
 * order (the module header).
 */
function informationKey(finding: FindingInformation): string {
  return JSON.stringify([
    finding.code,
    finding.locations.map(locationKey).sort(),
    finding.path === null ? null : pathKey(finding.path),
    finding.identities,
  ]);
}

function describePath(path: PathValue): string {
  return typeof path === "string"
    ? JSON.stringify(path)
    : `the marked byte form of ${renderPathValue(path)}`;
}

function describeLocation(location: FindingLocation): string {
  return `${describePath(location.file)} ${String(location.range.start)}-${String(location.range.end)}`;
}

/** A finding's information, rendered for a diagnosis. */
function describeInformation(finding: FindingInformation): string {
  const code = finding.code === null ? "code-less" : `code ${finding.code}`;
  const locations =
    finding.locations.length === 0
      ? "no location"
      : `locations [${finding.locations.map(describeLocation).join(", ")}]`;
  const path =
    finding.path === null
      ? "no concerned path"
      : `concerned path ${describePath(finding.path)}`;
  const identities =
    finding.identities.length === 0
      ? "no identity"
      : `identities ${JSON.stringify(finding.identities)}`;
  return `${code}; ${locations}; ${path}; ${identities}`;
}

function describeError(error: ErrorInformation): string {
  const code = error.code === null ? "no stable code" : `code ${error.code}`;
  const path =
    error.path === null
      ? "no concerned path"
      : `concerned path ${describePath(error.path)}`;
  return `${code}, ${path}`;
}

/** The locations of `of` missing from `from`, as multisets. */
function missingLocations(
  of: readonly FindingLocation[],
  from: readonly FindingLocation[],
): FindingLocation[] {
  const left = from.map(locationKey);
  const missing: FindingLocation[] = [];
  for (const location of of) {
    const at = left.indexOf(locationKey(location));
    if (at === -1) missing.push(location);
    else left.splice(at, 1);
  }
  return missing;
}

/** How alike two findings are: shared locations, path, and identities. */
function overlap(a: FindingInformation, b: FindingInformation): number {
  const shared =
    a.locations.length - missingLocations(a.locations, b.locations).length;
  const path = a.path !== null && samePath(a.path, b.path) ? 1 : 0;
  const identities = a.identities.filter((identity) =>
    b.identities.includes(identity),
  ).length;
  return shared + path + identities;
}

/** What the human finding lacks or holds beside the `--json` one, named. */
function describeDifference(
  json: FindingInformation,
  human: HumanFinding,
): string {
  const parts: string[] = [];
  const missing = missingLocations(json.locations, human.locations);
  const extra = missingLocations(human.locations, json.locations);
  if (missing.length > 0) {
    parts.push(
      `missing location(s) ${missing.map(describeLocation).join(", ")}`,
    );
  }
  if (extra.length > 0) {
    parts.push(
      `location(s) the --json finding lacks ${extra.map(describeLocation).join(", ")}`,
    );
  }
  if (!samePath(json.path, human.path)) {
    parts.push(
      json.path === null
        ? `a concerned path the --json finding lacks, ${describePath(human.path!)}`
        : human.path === null
          ? `missing concerned path ${describePath(json.path)}`
          : `concerned path ${describePath(human.path)} where the --json finding carries ${describePath(json.path)}`,
    );
  }
  if (JSON.stringify(json.identities) !== JSON.stringify(human.identities)) {
    const absent = json.identities.filter(
      (identity) => !human.identities.includes(identity),
    );
    parts.push(
      absent.length > 0
        ? `missing identit${absent.length === 1 ? "y" : "ies"} ${JSON.stringify(absent)} (it carries ${JSON.stringify(human.identities)}, the --json finding ${JSON.stringify(json.identities)})`
        : `identities ${JSON.stringify(human.identities)} where the --json finding carries ${JSON.stringify(json.identities)}`,
    );
  }
  return parts.join("; ");
}

/**
 * Assert a decoded human findings report carries the information of the
 * `--json` twin's findings (TEST-SPEC T12.0-15, H-3; the module header's
 * comparison): as multisets, one human finding per JSON finding, equal in
 * code, locations, concerned path, and identities — messages never
 * compared, order free. Fails diagnosed, naming for every JSON finding
 * without a counterpart the nearest human finding and the datum it omits
 * or differs in, and every human finding without one.
 */
export function assertHumanFindingsCarry(
  human: HumanFindingsReport,
  findings: readonly FindingInformation[],
  context: string,
): void {
  // Each human finding's key computed once, its line indices queued by key,
  // so the multiset match is linear in the report.
  const byKey = new Map<string, number[]>();
  human.findings.forEach((candidate, index) => {
    const key = informationKey(candidate);
    const queued = byKey.get(key);
    if (queued === undefined) byKey.set(key, [index]);
    else queued.push(index);
  });
  const matched = new Set<number>();
  const unmatchedJson: FindingInformation[] = [];
  for (const finding of findings) {
    const at = byKey.get(informationKey(finding))?.shift();
    if (at === undefined) unmatchedJson.push(finding);
    else matched.add(at);
  }
  const unmatchedHuman = human.findings.filter(
    (_candidate, index) => !matched.has(index),
  );
  if (unmatchedJson.length === 0 && unmatchedHuman.length === 0) return;
  const lines: string[] = [];
  for (const finding of unmatchedJson) {
    const sameCode = unmatchedHuman.filter(
      (candidate) => candidate.code === finding.code,
    );
    if (sameCode.length === 0) {
      lines.push(
        `- the --json finding (${describeInformation(finding)}) has no counterpart: the human ` +
          `report carries no further finding with its ${finding.code === null ? "code-less form" : `code ${finding.code}`}`,
      );
      continue;
    }
    const nearest = sameCode.reduce((best, candidate) =>
      overlap(finding, candidate) > overlap(finding, best) ? candidate : best,
    );
    lines.push(
      `- the --json finding (${describeInformation(finding)}) has no counterpart; the nearest ` +
        `human finding, line ${String(nearest.line)} (${describeInformation(nearest)}), has ` +
        `${describeDifference(finding, nearest)}`,
    );
  }
  for (const finding of unmatchedHuman) {
    lines.push(
      `- the human finding on line ${String(finding.line)} (${describeInformation(finding)}) ` +
        `matches no --json finding`,
    );
  }
  fail(
    `${context}: the human report does not carry the information its --json twin carries ` +
      `(TEST-SPEC T12.0-15: every finding's code, locations, concerned path, and identities, ` +
      `decoded by the human-report adapter, H-3 — wording, layout, and order free; a datum the ` +
      `--json document carries and the human report omits fails):\n${lines.join("\n")}\n` +
      `Human report lines: ${excerpt(human.findings.map((finding) => finding.text).join("\n"))}`,
  );
}

/**
 * Decode a run's human findings report and assert it carries the
 * information of its `--json` twin's decoded findings (TEST-SPEC
 * T12.0-15): `decodeHumanFindingsReport`, then `assertHumanFindingsCarry`.
 * Returns the decoded report.
 */
export function assertHumanFindingsReportCarries(
  human: RunResult,
  findings: readonly Finding[],
  context: string,
): HumanFindingsReport {
  const decoded = decodeHumanFindingsReport(human, context);
  assertHumanFindingsCarry(decoded, findings.map(findingInformation), context);
  return decoded;
}

/**
 * Assert a decoded exit-2 standard-error message carries the stable code
 * and the concerned path its `--json` twin's error document carries
 * (TEST-SPEC T12.0-15, H-5): equal code, and the same path in form and
 * bytes. A twin carrying no code — a plain usage error — is asserted for
 * neither (T12.0-15: it carries no code and concerns no path). Fails
 * diagnosed, naming the datum the message omits or differs in.
 */
export function assertHumanErrorCarries(
  human: HumanErrorMessage,
  error: ErrorInformation,
  context: string,
): void {
  if (error.code === null) return;
  const problems: string[] = [];
  if (human.code !== error.code) {
    problems.push(
      human.code === null
        ? `it carries no stable code where the --json twin's error document carries ${error.code}`
        : `it carries the code ${human.code} where the --json twin's error document carries ${error.code}`,
    );
  }
  if (!samePath(human.path, error.path)) {
    problems.push(
      error.path === null
        ? `it carries the concerned path ${describePath(human.path!)} the --json twin's error document lacks`
        : human.path === null
          ? `it carries no concerned path where the --json twin's error document carries ${describePath(error.path)}`
          : `it carries the concerned path ${describePath(human.path)} where the --json twin's error document carries ${describePath(error.path)}`,
    );
  }
  if (problems.length === 0) return;
  fail(
    `${context}: the exit-2 standard-error message does not carry the stable code and concerned ` +
      `path its --json twin carries (TEST-SPEC T12.0-15, H-5: without JSON output in effect the ` +
      `message is the error's only report, wording free; a message omitting either fails): ` +
      `${problems.join("; ")}.\nStandard error: ${excerpt(human.text)}`,
  );
}

/**
 * Decode a run's exit-2 standard-error message and assert it carries the
 * stable code and concerned path of its `--json` twin's error document
 * (TEST-SPEC T12.0-15): for a twin carrying a code,
 * `decodeHumanErrorMessage`, then `assertHumanErrorCarries`; a twin
 * carrying none — a plain usage error — asserts nothing of the message
 * (14).
 */
export function assertHumanErrorMessageCarries(
  human: RunResult,
  error: ErrorInformation,
  context: string,
): void {
  if (error.code === null) return;
  assertHumanErrorCarries(
    decodeHumanErrorMessage(human, context),
    error,
    context,
  );
}

// --- the preview comparison with the --json twin --------------------------------------

/**
 * The multiset difference of two lists by key (the module header): the
 * `--json` elements with no human counterpart, and the human elements left
 * over once each `--json` element has taken its counterpart — linear in
 * both.
 */
function multisetDifference<J, H>(
  json: readonly J[],
  human: readonly H[],
  jsonKey: (element: J) => string,
  humanKey: (element: H) => string,
): { readonly missing: J[]; readonly extra: H[] } {
  const queued = new Map<string, number[]>();
  human.forEach((element, index) => {
    const key = humanKey(element);
    const indices = queued.get(key);
    if (indices === undefined) queued.set(key, [index]);
    else indices.push(index);
  });
  const matched = new Set<number>();
  const missing: J[] = [];
  for (const element of json) {
    const at = queued.get(jsonKey(element))?.shift();
    if (at === undefined) missing.push(element);
    else matched.add(at);
  }
  return {
    missing,
    extra: human.filter((_element, index) => !matched.has(index)),
  };
}

/** A mapping pair as one comparable key. */
function pairKey(pair: AppliedMappingPair): string {
  return JSON.stringify([pair.from, pair.to]);
}

/** A mapping pair, rendered for a diagnosis. */
function describePair(pair: AppliedMappingPair): string {
  return `${JSON.stringify(pair.from)} -> ${JSON.stringify(pair.to)}`;
}

/** An edit's class and range as one comparable key. */
function editKey(edit: PreviewEdit): string {
  return `${edit.class}@${String(edit.range.start)}-${String(edit.range.end)}`;
}

/** An edit, rendered for a diagnosis. */
function describeEdit(edit: PreviewEdit): string {
  return `${edit.class} ${String(edit.range.start)}-${String(edit.range.end)}`;
}

/** What the human mapping omits, misplaces, or holds beside the `--json` one. */
function mappingProblems(
  json: readonly AppliedMappingPair[],
  human: readonly HumanMappingPair[],
): string[] {
  const { missing, extra } = multisetDifference(json, human, pairKey, pairKey);
  const problems: string[] = [];
  const left = [...extra];
  for (const pair of missing) {
    const sameFrom = left.findIndex(
      (candidate) => candidate.from === pair.from,
    );
    const at =
      sameFrom !== -1
        ? sameFrom
        : left.findIndex((candidate) => candidate.to === pair.to);
    if (at === -1) {
      problems.push(`the mapping pair ${describePair(pair)} is missing`);
      continue;
    }
    const [near] = left.splice(at, 1);
    problems.push(
      `the mapping pair ${describePair(pair)} is missing — line ${String(near!.line)} pairs ` +
        `${describePair(near!)} instead`,
    );
  }
  for (const pair of left) {
    problems.push(
      `line ${String(pair.line)} lists the mapping pair ${describePair(pair)}, which the ` +
        "--json twin's mapping lacks",
    );
  }
  return problems;
}

/** A file's edits gathered under its path, every listing of it merged. */
interface FileEdits<E extends PreviewEdit> {
  readonly file: PathValue;
  readonly edits: E[];
  readonly lines: number[];
}

/** Files gathered by path in form and bytes (the module header). */
function filesByPath<E extends PreviewEdit>(
  entries: readonly {
    readonly file: PathValue;
    readonly edits: readonly E[];
    readonly line?: number;
  }[],
): Map<string, FileEdits<E>> {
  const byPath = new Map<string, FileEdits<E>>();
  for (const entry of entries) {
    const key = pathKey(entry.file);
    let gathered = byPath.get(key);
    if (gathered === undefined) {
      gathered = { file: entry.file, edits: [], lines: [] };
      byPath.set(key, gathered);
    }
    gathered.edits.push(...entry.edits);
    if (entry.line !== undefined) gathered.lines.push(entry.line);
  }
  return byPath;
}

/** What the human files omit, misplace, or hold beside the `--json` ones. */
function filesProblems(
  json: readonly {
    readonly file: PathValue;
    readonly edits: readonly PreviewEdit[];
  }[],
  human: readonly HumanPreviewFile[],
): string[] {
  const problems: string[] = [];
  const humanFiles = filesByPath(human);
  const jsonFiles = filesByPath(json);
  for (const [key, entry] of jsonFiles) {
    const listed = humanFiles.get(key);
    if (listed === undefined) {
      problems.push(
        `the file ${describePath(entry.file)} is missing, with its ${String(entry.edits.length)} ` +
          `edit(s) ${entry.edits.map(describeEdit).join(", ")}`,
      );
      continue;
    }
    const { missing, extra } = multisetDifference(
      entry.edits,
      listed.edits,
      editKey,
      editKey,
    );
    const left = [...extra];
    for (const edit of missing) {
      let at = -1;
      let distance = Number.POSITIVE_INFINITY;
      left.forEach((candidate, index) => {
        if (candidate.class !== edit.class) return;
        const apart =
          Math.abs(candidate.range.start - edit.range.start) +
          Math.abs(candidate.range.end - edit.range.end);
        if (apart < distance) {
          at = index;
          distance = apart;
        }
      });
      if (at === -1) {
        problems.push(
          `in ${describePath(entry.file)}, the edit ${describeEdit(edit)} is missing`,
        );
        continue;
      }
      const [near] = left.splice(at, 1);
      problems.push(
        `in ${describePath(entry.file)}, the edit ${describeEdit(edit)} is missing — the ` +
          `nearest ${edit.class} edit there, line ${String(near!.line)}, spans ` +
          `${String(near!.range.start)}-${String(near!.range.end)}`,
      );
    }
    for (const edit of left) {
      problems.push(
        `in ${describePath(entry.file)}, line ${String(edit.line)} lists the edit ` +
          `${describeEdit(edit)}, which the --json twin lacks`,
      );
    }
  }
  for (const [key, entry] of humanFiles) {
    if (jsonFiles.has(key)) continue;
    problems.push(
      `line ${String(entry.lines[0] ?? 0)} lists the file ${describePath(entry.file)}, which ` +
        "the --json twin's files lack",
    );
  }
  return problems;
}

/** A derived path of the human delta as a key part. */
function deltaPathKey(path: HumanDeltaPath): string {
  return pathKey(path.path);
}

/** What the human delta omits, misplaces, or holds beside the `--json` one. */
function deltaProblems(
  json: PreviewDeltaDatum,
  human: HumanPreviewDelta,
): string[] {
  if ("unavailable" in json) {
    if ("unavailable" in human) return [];
    return [
      `the --json twin reports the delta unavailable (SPEC 6.6, 14.23), but the human ` +
        `report lists it as a value — ${String(human.generated.length)} generated and ` +
        `${String(human.removed.length)} removed path(s) — never \`delta: unavailable\``,
    ];
  }
  if ("unavailable" in human) {
    return [
      `line ${String(human.line)} reports the delta unavailable where the --json twin ` +
        `carries its two directions — ${String(json.generated.length)} generated and ` +
        `${String(json.removed.length)} removed path(s) (SPEC 6.6, 14.23)`,
    ];
  }
  const problems: string[] = [];
  const generated = multisetDifference(
    json.generated,
    human.generated,
    pathKey,
    deltaPathKey,
  );
  const removed = multisetDifference(
    json.removed,
    human.removed,
    pathKey,
    deltaPathKey,
  );
  const directions = [
    { name: "generated", own: generated, other: removed, otherName: "removed" },
    { name: "removed", own: removed, other: generated, otherName: "generated" },
  ];
  for (const { name, own, other, otherName } of directions) {
    for (const path of own.missing) {
      const at = other.extra.findIndex(
        (candidate) => deltaPathKey(candidate) === pathKey(path),
      );
      if (at === -1) {
        problems.push(`the ${name} path ${describePath(path)} is missing`);
        continue;
      }
      const [misplaced] = other.extra.splice(at, 1);
      problems.push(
        `the path ${describePath(path)}, ${name} in the --json twin, is listed under ` +
          `${otherName} on line ${String(misplaced!.line)}`,
      );
    }
  }
  for (const { name, own } of directions) {
    for (const path of own.extra) {
      problems.push(
        `line ${String(path.line)} lists the ${name} path ${describePath(path.path)}, which ` +
          "the --json twin's delta lacks",
      );
    }
  }
  return problems;
}

/**
 * Assert a decoded human preview report carries the information of its
 * `--json` twin's decoded preview document (TEST-SPEC T6.6-7, T12.0-15;
 * the module header's comparison): its findings as
 * `assertHumanFindingsCarry` compares them, then its plan — none beside a
 * refusal's findings, and otherwise the mapping's every `from` and `to`
 * identity, every file with each of its edits' class and range, and the
 * delta's paths in both directions or its unavailability, order free.
 * Fails diagnosed, naming every datum the human report omits, misplaces,
 * or holds beside its twin's.
 */
export function assertHumanPreviewCarries(
  human: HumanPreviewReport,
  json: PreviewReport,
  context: string,
): void {
  assertHumanFindingsCarry(
    human,
    json.findings.map(findingInformation),
    context,
  );
  const problems: string[] = [];
  const { mapping, files, delta } = json;
  if (mapping === null || files === null || delta === null) {
    if (human.plan !== null) {
      problems.push(
        "the --json twin is a refused preview, reporting its refusal findings alone — " +
          "`mapping`, `files`, and `delta` null (SPEC 6.6, 12.7) — but the human report " +
          `prints a plan (${String(human.plan.mapping.length)} mapping pair(s), ` +
          `${String(human.plan.files.length)} file(s))`,
      );
    }
  } else if (human.plan === null) {
    problems.push(
      "the human report prints no plan — no `mapping:`, `files:`, or `delta:` section — " +
        `where the --json twin reports ${String(mapping.length)} mapping pair(s), ` +
        `${String(files.length)} file(s), and its delta (SPEC 6.6)`,
    );
  } else {
    problems.push(
      ...mappingProblems(mapping, human.plan.mapping),
      ...filesProblems(files, human.plan.files),
      ...deltaProblems(delta, human.plan.delta),
    );
  }
  if (problems.length === 0) return;
  fail(
    `${context}: the human preview report does not carry the information its --json twin ` +
      "carries (TEST-SPEC T6.6-7: the mapping's every `from` and `to` identity; every file " +
      "the operation would rewrite, relocate, or create, with each of its edits' class and " +
      "range as its two pre-operation byte offsets; and the delta's paths in both " +
      "directions, or the delta reported unavailable beside the condition-23 finding — " +
      "decoded by the human-report adapter, H-3; wording, layout, and order free):\n" +
      `${problems.map((problem) => `- ${problem}`).join("\n")}\n` +
      `Human report: ${excerpt(human.text)}`,
  );
}

/**
 * Decode a run's human preview report and assert it carries the
 * information of its `--json` twin's decoded preview document (TEST-SPEC
 * T6.6-7): `decodeHumanPreviewReport`, then `assertHumanPreviewCarries`.
 * Returns the decoded report.
 */
export function assertHumanPreviewReportCarries(
  human: RunResult,
  json: PreviewReport,
  context: string,
): HumanPreviewReport {
  const decoded = decodeHumanPreviewReport(human, context);
  assertHumanPreviewCarries(decoded, json, context);
  return decoded;
}

// --- the performed-report comparison with the --json twin ---------------------------

/**
 * Assert a decoded human performed report carries the applied mapping of
 * its `--json` twin's form-exact performed-operation document (TEST-SPEC
 * T12.0-15; SPEC 6.4, 6.5; the module header's comparison): its pairs as
 * a multiset of `from`/`to` pairs, order free. Fails diagnosed, naming
 * every pair the human report omits or changes and every pair it lists
 * that the twin's mapping lacks.
 */
export function assertHumanPerformedCarries(
  human: HumanPerformedReport,
  json: PerformedOperationReport,
  context: string,
): void {
  const problems = mappingProblems(json.mapping, human.mapping);
  if (problems.length === 0) return;
  fail(
    `${context}: the human report of the performed operation does not carry the applied ` +
      "mapping its --json twin carries (TEST-SPEC T12.0-15: every pair the operation " +
      "journaled, its `from` and `to` identity — SPEC 6.4: a successful rename's report is " +
      "the applied mapping, and a move reports its own as rename does, 6.5 — decoded by the " +
      "human-report adapter, H-3; wording, layout, and order free):\n" +
      `${problems.map((problem) => `- ${problem}`).join("\n")}\n` +
      `Human report: ${excerpt(human.text)}`,
  );
}

/**
 * Decode a run's human performed report and assert it carries the applied
 * mapping of its `--json` twin's decoded performed-operation document
 * (TEST-SPEC T12.0-15): `decodeHumanPerformedReport`, then
 * `assertHumanPerformedCarries`. Returns the decoded report.
 */
export function assertHumanPerformedReportCarries(
  human: RunResult,
  json: PerformedOperationReport,
  context: string,
): HumanPerformedReport {
  const decoded = decodeHumanPerformedReport(human, context);
  assertHumanPerformedCarries(decoded, json, context);
  return decoded;
}
