// The validation-finding data model.
//
// IMPLEMENTATION (cross-cutting rules): every validation failure is
// represented as data carrying its SPEC 14 stable code and exit class;
// reports are built as data and rendered once per output form (human, JSON)
// by the CLI layer. SPEC 14: reported errors are actionable — they identify
// the file, location, and correction — and when several conditions are
// present, each is reported, not only the first. SPEC 12.7 fixes the
// observable finding form — `{"code", "message", "locations", "path",
// "identities"}` — which this model mirrors as data, plus the total findings
// order and duplicate collapse this module implements for every emitter.

import type { ByteRange } from "./bytes.js";
import { compareBytes } from "./bytes.js";
import type { PathText } from "./path-text.js";
import { comparePathTexts } from "./path-text.js";

/**
 * SPEC 12.0: exit codes partition all outcomes — 0 success, 1 findings
 * (source, workspace, and operation validation failures), 2 usage and
 * configuration errors.
 */
export type ExitCode = 0 | 1 | 2;

/** SPEC 14: the defined error conditions, numbered 1–23. */
export type ConditionNumber =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20
  | 21
  | 22
  | 23;

/**
 * SPEC 14: the numbered conditions' stable code tokens, listed in condition
 * order — index N−1 is condition N's token. A code's value is its token
 * string (12.7); the numeral is the condition's ordinal, ordering findings,
 * no part of the value.
 */
export const CONDITION_CODES = [
  "missing-id", // 14.1
  "invalid-structural-id", // 14.2
  "duplicate-id", // 14.3
  "invalid-segment-or-tag", // 14.4
  "unknown-dependency", // 14.5
  "unknown-text-target", // 14.6
  "unknown-ts-reference", // 14.7
  "invalid-argument", // 14.8
  "cycle", // 14.9
  "stale-output", // 14.10
  "cross-module-text", // 14.11
  "policy-violation", // 14.12
  "journal-error", // 14.13
  "configuration-error", // 14.14
  "invalid-import", // 14.15
  "invalid-construct", // 14.16
  "invalid-prop", // 14.17
  "unsupported-node-usage", // 14.18
  "invalid-source-path", // 14.19
  "unparseable-source", // 14.20
  "corrupt-session", // 14.21
  "obstructed-write-path", // 14.22
  "unreadable-record", // 14.23
] as const;
export type ConditionCode = (typeof CONDITION_CODES)[number];

/**
 * SPEC 14: the refusal reasons of `rename`/`move` (6.4, 6.5), stable codes
 * in the order 14 lists them — the findings order after the numbered
 * conditions (12.7).
 */
export const REFUSAL_CODES = [
  "refused-invalid-id",
  "refused-identity-unchanged",
  "refused-id-collision",
  "refused-structural-parent",
  "refused-unresolvable-reference",
  "refused-cycle",
  "refused-destination-exists",
  "refused-missing-target-parent",
  "refused-invalid-destination",
] as const;
export type RefusalCode = (typeof REFUSAL_CODES)[number];

/** Every stable code SPEC 14 assigns: numbered conditions, then refusals. */
export type FindingCode = ConditionCode | RefusalCode;

/** Condition N's stable code token (SPEC 14: `1` → `"missing-id"`). */
export function conditionCode(condition: ConditionNumber): ConditionCode {
  return CONDITION_CODES[condition - 1];
}

/**
 * One offending construct's location: the containing file (workspace-
 * relative, `/`-separated, SPEC 1.5) and its byte range (SPEC 1.7). The
 * observable form is `{"file", "range"}` (SPEC 12.7). The file is a
 * `PathText`: a plain string except for a file whose path is not valid
 * UTF-8 (SPEC 14.19), presented in the marked byte form (SPEC 12.0, 12.7).
 */
export interface FindingLocation {
  readonly file: PathText;
  readonly range: ByteRange;
}

/**
 * One validation failure, carried as data in the shape of SPEC 12.7's
 * finding form and rendered later by the CLI:
 *
 * - `code`: the stable token SPEC 14 assigns, or null where 14 assigns none
 *   (plain usage errors, review-operation refusals).
 * - `message`: the human-readable description — actionable, stating the
 *   correction (SPEC 14).
 * - `locations`: one entry per offending construct, ordered by file path
 *   bytes, then range start, then range end; empty for conditions without
 *   in-source locations (SPEC 14, 12.7).
 * - `path`: the concerned file or path for non-located conditions
 *   (configuration, path-level, journal, session, and record conditions);
 *   null for located ones (SPEC 14). A `PathText`: a non-UTF-8 concerned
 *   path (SPEC 14.19) carries its exact bytes, presented in the marked
 *   byte form (SPEC 12.0, 12.7).
 * - `identities`: the identities or other context strings the condition
 *   names, empty where none — contractual exactly where 14 states it
 *   (14.12's enumeration, 14.11's foreign module, a refusal reason's
 *   concerned identity), otherwise informational (SPEC 12.7).
 */
export interface Finding {
  readonly code: FindingCode | null;
  readonly message: string;
  readonly locations: readonly FindingLocation[];
  readonly path: PathText | null;
  readonly identities: readonly string[];
}

/**
 * A finding locating its offending construct(s) in source: `path` null
 * (SPEC 14: located conditions carry no concerned path). Locations are
 * sorted into the pinned within-finding order (SPEC 12.7).
 */
export function locatedFinding(
  condition: ConditionNumber,
  message: string,
  locations: readonly FindingLocation[],
  identities: readonly string[] = [],
): Finding {
  return {
    code: conditionCode(condition),
    message,
    locations: sortLocations(locations),
    path: null,
    identities,
  };
}

/**
 * A finding without in-source locations, concerning a file or path (SPEC
 * 14: configuration, path-level, journal, session, and record conditions
 * carry the file or path they concern) — or, for conditions carrying
 * context identities alone (14.12), no path either.
 */
export function pathFinding(
  condition: ConditionNumber,
  message: string,
  path: PathText | null,
  identities: readonly string[] = [],
): Finding {
  return {
    code: conditionCode(condition),
    message,
    locations: [],
    path,
    identities,
  };
}

/**
 * A code's rank in the findings order (SPEC 12.7): the numbered conditions
 * in numeric order, then the refusal reasons in the order 14 lists them,
 * then code-less findings.
 */
export function codeOrdinal(code: FindingCode | null): number {
  if (code === null) return CONDITION_CODES.length + REFUSAL_CODES.length;
  const condition = (CONDITION_CODES as readonly string[]).indexOf(code);
  if (condition !== -1) return condition;
  return (
    CONDITION_CODES.length + (REFUSAL_CODES as readonly string[]).indexOf(code)
  );
}

/**
 * The exit class of a command reporting a finding with this code (SPEC
 * 12.0): 2 for condition 14, a usage error preceding all source analysis
 * (SPEC 14.14); 1 for every other finding, refusals and code-less findings
 * included.
 */
export function codeExitClass(code: FindingCode | null): 1 | 2 {
  return code === "configuration-error" ? 2 : 1;
}

/**
 * The pinned within-finding location order (SPEC 12.7). Files compare by
 * their exact path bytes whatever their presentation form (SPEC 12.0): a
 * marked byte-form path and a plain string sort in one byte order.
 */
export function compareLocations(
  a: FindingLocation,
  b: FindingLocation,
): number {
  return (
    comparePathTexts(a.file, b.file) ||
    a.range.start - b.range.start ||
    a.range.end - b.range.end
  );
}

/** Sort locations into the pinned within-finding order (SPEC 12.7). */
export function sortLocations(
  locations: readonly FindingLocation[],
): readonly FindingLocation[] {
  return [...locations].sort(compareLocations);
}

/**
 * Element-wise sequence comparison under the prefix rule (SPEC 12.7): a
 * sequence that is a proper prefix of another sorts first.
 */
function compareSequences<T>(
  a: readonly T[],
  b: readonly T[],
  compareElement: (x: T, y: T) => number,
): number {
  const shared = Math.min(a.length, b.length);
  for (let index = 0; index < shared; index += 1) {
    const byElement = compareElement(a[index]!, b[index]!);
    if (byElement !== 0) return byElement;
  }
  return a.length - b.length;
}

/**
 * The total findings order of SPEC 12.7: by code (numbered conditions in
 * numeric order, then refusal reasons in 14's listed order, then code-less
 * findings), then by locations element-wise (file path bytes, range start,
 * range end; proper prefix first), then by concerned path (null before any
 * path; paths compare byte-wise whatever their presentation form — a
 * marked byte-form path and a plain string sort in one byte order, SPEC
 * 12.0), then by identities element-wise under the same prefix rule
 * (byte-wise elements), then by message. Returns 0 exactly for findings
 * identical in every member — which collapse to one (12.7) — so the order
 * is total.
 */
export function compareFindings(a: Finding, b: Finding): number {
  const byCode = codeOrdinal(a.code) - codeOrdinal(b.code);
  if (byCode !== 0) return byCode;
  const byLocations = compareSequences(
    a.locations,
    b.locations,
    compareLocations,
  );
  if (byLocations !== 0) return byLocations;
  if ((a.path === null) !== (b.path === null)) return a.path === null ? -1 : 1;
  if (a.path !== null && b.path !== null) {
    const byPath = comparePathTexts(a.path, b.path);
    if (byPath !== 0) return byPath;
  }
  const byIdentities = compareSequences(a.identities, b.identities, (x, y) =>
    compareBytes(x, y),
  );
  if (byIdentities !== 0) return byIdentities;
  return compareBytes(a.message, b.message);
}

/**
 * The `"findings"` array discipline of SPEC 12.7, applied by every findings
 * emitter: the pinned total order, findings identical in every member
 * collapsed to one.
 */
export function orderFindings(findings: readonly Finding[]): Finding[] {
  const ordered = [...findings].sort(compareFindings);
  const collapsed: Finding[] = [];
  for (const finding of ordered) {
    const previous = collapsed[collapsed.length - 1];
    if (previous !== undefined && compareFindings(previous, finding) === 0) {
      continue;
    }
    collapsed.push(finding);
  }
  return collapsed;
}
