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
// omits fails"). Like every adapter here they are the one place aware of
// the report's concrete shape: adjustable to shape, never to values, and
// failing loudly — a diagnosed `HarnessAssertionError` naming the line and
// the datum — when a report's text fits none of the layout below or lacks
// what the layout carries. Later decoders for the other human reports
// (previews, performed reports, impact, review, coverage, ids, show) go
// beside these.
//
// The layout, fitted to what the built product emits (observed by running
// it on T14-11's per-condition fixtures, T1.5-2's arms, T12.7-3's stagings,
// and hand-staged 14.11, 14.12, 14.13, 14.21, refusal, and code-less
// findings — never by reading its source):
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
//   free wording (H-3; T12.0-15: never asked) and is never decoded.
// - An exit-2 error's standard-error message (12.0: with JSON output not
//   in effect, its only report) opens with the diagnostic prefix
//   `xspec: `; a coded error continues `<code>: <path>: <message>`, with
//   one such line per defect where a condition reports several (a
//   configuration file's distinct defects), each repeating the code and
//   the path; a plain usage error continues with its message alone.
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
//   ending in `)` after ` (also at ` or in `]` after ` [`, and any datum
//   holding a line break (U+000A) would mis-decode — never into a pass:
//   the decoded finding then differs from its twin, or the line fits no
//   layout, and the comparison or the decode fails diagnosed. The data of
//   T14-11's fixtures, T1.5-2's arms, and T12.7-3's stagings hold none.
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

import { Buffer } from "node:buffer";
import { fail } from "../assertions.js";
import { guardSyncStep } from "../step-guards.js";
import type { RunResult } from "../subprocess.js";
import { pathValueBytes, renderPathValue } from "./forms.js";
import { STABLE_CODES } from "./human.js";
import type {
  ErrorInformation,
  Finding,
  FindingInformation,
  FindingLocation,
  PathValue,
} from "./model.js";

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

/** A decimal offset as the layout spells it: no sign, no leading zero. */
const LOCATION_TOKEN = /^(.+):(0|[1-9][0-9]*)-(0|[1-9][0-9]*)$/;

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
  for (const [index, text] of lines.entries()) {
    const line = index + 1;
    const count = COUNT_LINE.exec(text);
    if (count !== null && index === lines.length - 1) {
      counted = Number(count[1]);
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
    findings.push(decodeFindingLine(text, line, adapter, report));
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
