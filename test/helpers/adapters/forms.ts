// The literal SPEC.md 12.7 decode layer — form-exact surfaces (TEST-SPEC §0
// H-3, §17 S-5).
//
// SPEC.md 12.7 fixes the concrete JSON shape — member names, `null`-vs-
// omission, `[]`-vs-`null`, the range, path, byte-form, unavailability-marker,
// and finding value forms, and findings order — of every findings array and
// findings-only report, the exit-2 error document, and the document forms of
// 6.6, 11.3–11.6, and 12.6. Assertions on those surfaces are form-exact:
// this module decodes the 12.7 member names and forms literally, and unlike
// the adapters beside it (query.ts, reports.ts, review.ts) it is NEVER
// adjustable to a product's shape — output differing from 12.7 in shape is a
// conformance failure, not an adapter fixture (H-3, T12.7-1..3). It shares
// the adapters' fail-loud discipline (decode.ts, S-5): a wrong form is a
// diagnosed test failure, never a default.
//
// Contents:
//   - path values: UTF-8 string vs the marked byte form (12.0/12.7)
//   - the finding form {"code","message","locations","path","identities"}
//     with the harness-pinned token→condition table (model.ts)
//   - the pinned findings-order comparator and duplicate collapse (12.7)
//   - findings arrays and the findings-only report {"findings": […]}
//   - the exit-2 error document {"error": …} holding one finding form (12.0)
//   - the three-state datum decode: plain value / `null` /
//     {"unavailable": true} (11.4, 12.7)
//   - the unavailability-marker structural walk T12.7-1 relies on: no object
//     of any form other than the marker carries a member named "unavailable"

import { Buffer, isUtf8 } from "node:buffer";
import type {
  ErrorDocument,
  Finding,
  FindingLocation,
  FindingsReport,
  MarkedBytePath,
  PathValue,
  SourceRange,
} from "./model.js";
import {
  CONDITION_CODE_TOKENS,
  REFUSAL_CODE_TOKENS,
  conditionIdentityOf,
} from "./model.js";
import type { DecodeSite } from "./decode.js";
import {
  at,
  describeJsonValue,
  expectArray,
  expectNonEmptyString,
  expectNonNegativeInteger,
  expectObject,
  requiredKey,
  requiredMember,
  rootSite,
} from "./decode.js";
import { fail } from "../assertions.js";

/**
 * Fail a form-exact decode loudly. Unlike the adjustable adapters'
 * `decodeFail`, the diagnosis never invites adjusting the decode: SPEC.md
 * 12.7 fixes these member names and forms literally, so a mismatch is a
 * product conformance failure (H-3), and the fix is never here.
 */
function formFail(site: DecodeSite, expected: string, actual: unknown): never {
  fail(
    `${site.adapter} adapter: at ${site.path}: expected ${expected}, got ${describeJsonValue(actual)}. ` +
      `H-3: this surface is form-exact — SPEC 12.7 fixes its member names and forms literally, ` +
      `so output differing from them is a product conformance failure; this decode is never adjusted to a product's shape.`,
  );
}

// --- form-exact object membership --------------------------------------------

/**
 * 12.7: each object carries exactly the members its form names — a member
 * whose datum does not arise is `null`, never omitted, and no member outside
 * the form appears. Callers check presence per member; this rejects extras.
 */
function expectOnlyMembers(
  obj: Record<string, unknown>,
  allowed: readonly string[],
  site: DecodeSite,
): void {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) {
      formFail(
        at(site, key),
        `no member ${JSON.stringify(key)} — the form carries exactly ` +
          `${allowed.map((k) => JSON.stringify(k)).join(", ")} (SPEC 12.7)`,
        obj[key],
      );
    }
  }
}

// --- value forms --------------------------------------------------------------

/** A source range in the literal 12.7 form: `{"start", "end"}` exactly. */
export function decodeRangeForm(value: unknown, site: DecodeSite): SourceRange {
  const obj = expectObject(value, site);
  expectOnlyMembers(obj, ["start", "end"], site);
  const start = expectNonNegativeInteger(
    requiredKey(obj, "start", site),
    at(site, "start"),
  );
  const end = expectNonNegativeInteger(
    requiredKey(obj, "end", site),
    at(site, "end"),
  );
  if (end < start) formFail(site, "a range with end >= start", value);
  return { start, end };
}

const MARKED_BYTES_PATTERN = /^(?:[0-9a-f]{2})+$/;

/**
 * A 12.7 path value: a string whose bytes are valid UTF-8, or the marked
 * byte form `{"bytes": "…"}` — lowercase hexadecimal, two digits per byte —
 * used exactly where the path's bytes are NOT valid UTF-8 (a valid-UTF-8
 * path presented in byte form differs from 12.7 and is rejected).
 */
export function decodePathValue(value: unknown, site: DecodeSite): PathValue {
  if (typeof value === "string") {
    // A JSON string with lone surrogates encodes no UTF-8 byte sequence, so
    // it is no 12.7 path string (UTF-8 round-trip replaces lone surrogates,
    // so inequality detects them).
    if (Buffer.from(value, "utf8").toString("utf8") !== value) {
      formFail(
        site,
        "a path string whose bytes are valid UTF-8 (SPEC 12.7; lone " +
          "surrogates encode none)",
        value,
      );
    }
    return value;
  }
  const obj = expectObject(value, site);
  expectOnlyMembers(obj, ["bytes"], site);
  const hex = expectNonEmptyString(
    requiredKey(obj, "bytes", site),
    at(site, "bytes"),
  );
  if (!MARKED_BYTES_PATTERN.test(hex)) {
    formFail(
      at(site, "bytes"),
      "the path's exact bytes as lowercase hexadecimal, two digits per " +
        "byte (SPEC 12.0, 12.7)",
      value,
    );
  }
  if (isUtf8(Buffer.from(hex, "hex"))) {
    formFail(
      site,
      "a marked byte form only for a path whose bytes are NOT valid UTF-8 " +
        "(SPEC 12.7: a valid-UTF-8 path is a plain string)",
      value,
    );
  }
  return { bytes: hex };
}

/** The exact bytes a 12.7 path value denotes (paths compare byte-wise). */
export function pathValueBytes(value: PathValue): Buffer {
  return typeof value === "string"
    ? Buffer.from(value, "utf8")
    : Buffer.from(value.bytes, "hex");
}

/** Render a path value for diagnoses and file-mention matching. */
export function renderPathValue(value: PathValue | null): string {
  if (value === null) return "<null path>";
  return typeof value === "string" ? value : `bytes:${value.bytes}`;
}

// --- the finding form ---------------------------------------------------------

const FINDING_MEMBERS = [
  "code",
  "message",
  "locations",
  "path",
  "identities",
] as const;

const KNOWN_CODE_TOKENS: readonly string[] = [
  ...CONDITION_CODE_TOKENS,
  ...REFUSAL_CODE_TOKENS,
];

function decodeFindingLocation(
  value: unknown,
  site: DecodeSite,
): FindingLocation {
  const obj = expectObject(value, site);
  expectOnlyMembers(obj, ["file", "range"], site);
  return {
    file: decodePathValue(requiredKey(obj, "file", site), at(site, "file")),
    range: decodeRangeForm(requiredKey(obj, "range", site), at(site, "range")),
  };
}

function compareLocations(a: FindingLocation, b: FindingLocation): number {
  const byFile = Buffer.compare(pathValueBytes(a.file), pathValueBytes(b.file));
  if (byFile !== 0) return byFile;
  if (a.range.start !== b.range.start) return a.range.start - b.range.start;
  return a.range.end - b.range.end;
}

/**
 * Decode one finding in the literal 12.7 form: exactly the five members,
 * `code` the stable token 14 assigns (or `null`), locations ordered by file
 * path bytes, then range start, then range end (12.7, T14-8). The decoded
 * finding additionally carries the derived `14.N` condition identity
 * (model.ts: `conditionIdentityOf`) — a lookup, never a document member.
 */
export function decodeFindingForm(value: unknown, site: DecodeSite): Finding {
  const obj = expectObject(value, site);
  expectOnlyMembers(obj, FINDING_MEMBERS, site);
  const codeValue = requiredMember(obj, "code", site);
  let code: string | null = null;
  if (codeValue !== null) {
    const codeSite = at(site, "code");
    const token = expectNonEmptyString(codeValue, codeSite);
    if (!KNOWN_CODE_TOKENS.includes(token)) {
      formFail(
        codeSite,
        "a stable code: one of SPEC 14's condition tokens " +
          "(missing-id … unreadable-record) or refusal codes " +
          "(refused-invalid-id … refused-invalid-destination), or null " +
          "where 14 assigns none",
        codeValue,
      );
    }
    code = token;
  }
  const message = expectNonEmptyString(
    requiredKey(obj, "message", site),
    at(site, "message"),
  );
  const locationsSite = at(site, "locations");
  const locations = expectArray(
    requiredKey(obj, "locations", site),
    locationsSite,
  ).map((element, index) =>
    decodeFindingLocation(element, at(locationsSite, index)),
  );
  for (let i = 1; i < locations.length; i += 1) {
    if (compareLocations(locations[i - 1]!, locations[i]!) > 0) {
      formFail(
        at(locationsSite, i),
        "locations ordered by file path bytes, then range start, then " +
          "range end (SPEC 12.7)",
        obj["locations"],
      );
    }
  }
  const pathValue = requiredMember(obj, "path", site);
  const path =
    pathValue === null ? null : decodePathValue(pathValue, at(site, "path"));
  const identitiesSite = at(site, "identities");
  const identities = expectArray(
    requiredKey(obj, "identities", site),
    identitiesSite,
  ).map((element, index) =>
    expectNonEmptyString(element, at(identitiesSite, index)),
  );
  return {
    code,
    message,
    locations,
    path,
    identities,
    condition: conditionIdentityOf(code),
  };
}

// --- the pinned findings-order comparator (12.7) ------------------------------

/**
 * A code's rank in the findings order: the numbered conditions in numeric
 * order, then the refusal reasons in the order 14 lists them, then code-less
 * findings (SPEC 12.7). Total over decoded findings — decode admits only the
 * known tokens.
 */
function codeRank(code: string | null): number {
  if (code === null) {
    return CONDITION_CODE_TOKENS.length + REFUSAL_CODE_TOKENS.length;
  }
  const condition = (CONDITION_CODE_TOKENS as readonly string[]).indexOf(code);
  if (condition !== -1) return condition;
  return (
    CONDITION_CODE_TOKENS.length +
    (REFUSAL_CODE_TOKENS as readonly string[]).indexOf(code)
  );
}

function compareSequences<T>(
  a: readonly T[],
  b: readonly T[],
  compareElement: (x: T, y: T) => number,
): number {
  const shared = Math.min(a.length, b.length);
  for (let i = 0; i < shared; i += 1) {
    const byElement = compareElement(a[i]!, b[i]!);
    if (byElement !== 0) return byElement;
  }
  // A sequence that is a proper prefix of another sorts first (SPEC 12.7).
  return a.length - b.length;
}

function compareStringBytes(a: string, b: string): number {
  return Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

/**
 * The pinned SPEC 12.7 findings-order comparator: by code (numbered
 * conditions in numeric order, then refusal reasons in 14's order, then
 * code-less), then by locations element-wise (file path bytes, range start,
 * range end; proper prefix first), then by concerned path (`null` before any
 * path; byte-wise whatever the presentation form), then by identities
 * (element-wise by bytes, prefix rule), then by message (bytes). Returns 0
 * exactly for findings identical in every member — which 12.7 collapses to
 * one, so a compliant array is strictly ascending.
 */
export function compareFindings(a: Finding, b: Finding): number {
  const byCode = codeRank(a.code) - codeRank(b.code);
  if (byCode !== 0) return byCode;
  const byLocations = compareSequences(
    a.locations,
    b.locations,
    compareLocations,
  );
  if (byLocations !== 0) return byLocations;
  if ((a.path === null) !== (b.path === null)) return a.path === null ? -1 : 1;
  if (a.path !== null && b.path !== null) {
    const byPath = Buffer.compare(
      pathValueBytes(a.path),
      pathValueBytes(b.path),
    );
    if (byPath !== 0) return byPath;
  }
  const byIdentities = compareSequences(
    a.identities,
    b.identities,
    compareStringBytes,
  );
  if (byIdentities !== 0) return byIdentities;
  return compareStringBytes(a.message, b.message);
}

// --- findings arrays and the findings-only report -----------------------------

/**
 * Decode a `"findings"` array value in the literal 12.7 form: every element
 * a well-formed finding, the array in the pinned findings order, findings
 * identical in every member collapsed to one (adjacent equality is an
 * uncollapsed duplicate; both violations reject, form-exact per H-3).
 */
export function decodeFindingsArray(
  value: unknown,
  site: DecodeSite,
): Finding[] {
  const findings = expectArray(value, site).map((element, index) =>
    decodeFindingForm(element, at(site, index)),
  );
  for (let i = 1; i < findings.length; i += 1) {
    const order = compareFindings(findings[i - 1]!, findings[i]!);
    if (order === 0) {
      formFail(
        at(site, i),
        "findings identical in every member collapsed to one (SPEC 12.7)",
        value,
      );
    }
    if (order > 0) {
      formFail(
        at(site, i),
        "findings in the pinned 12.7 order: by code (numbered conditions " +
          "in numeric order, then refusal reasons in 14's order, then " +
          "code-less), then locations, concerned path, identities, message",
        value,
      );
    }
  }
  return findings;
}

/**
 * A findings-only report — `{"findings": […]}` exactly (SPEC 12.7): a
 * failing `build`'s validation errors, `check`'s findings, the findings of
 * refusing reads (13.3) and refused operations (6.4, 6.5, 10.7). Form-exact
 * (H-3): the one member, the literal finding form, the pinned order.
 */
export function decodeFindingsReport(
  doc: unknown,
  context?: string,
): FindingsReport {
  const site = rootSite("12.7 findings report", context);
  const obj = expectObject(doc, site);
  expectOnlyMembers(obj, ["findings"], site);
  return {
    findings: decodeFindingsArray(
      requiredKey(obj, "findings", site),
      at(site, "findings"),
    ),
  };
}

// --- the exit-2 error document (12.0, 12.7) -----------------------------------

/**
 * The exit-2 error document — `{"error": …}` exactly, holding one finding
 * form (SPEC 12.0, 12.7). With JSON output in effect — `--json` among the
 * invocation's arguments, even when the arguments are themselves the error,
 * or a JSON-only surface (10.7 export, 11, 12.6) — an invocation failing
 * with a usage or configuration error (exit 2) emits this document as its
 * entire stdout. Form-exact (H-3): the one member, the literal finding form;
 * the document carries no `findings` member (12.7). Content: a configuration
 * error carries the stable code and concerned path (14); a plain usage error
 * carries `code` and `path` `null` — value assertions belong to callers
 * (T12.7-3), this decode admits any well-formed finding.
 */
export function decodeErrorDocument(
  doc: unknown,
  context?: string,
): ErrorDocument {
  const site = rootSite("12.7 error document", context);
  const obj = expectObject(doc, site);
  expectOnlyMembers(obj, ["error"], site);
  return {
    error: decodeFindingForm(
      requiredKey(obj, "error", site),
      at(site, "error"),
    ),
  };
}

// --- the three-state datum decode (11.4, 12.7) --------------------------------

/**
 * The three observable states of a datum (SPEC 11.4, 12.7): a plain value,
 * the stated `null`, or explicit unavailability `{"unavailable": true}`.
 */
export type DecodedDatum<T> =
  | { readonly state: "value"; readonly value: T }
  | { readonly state: "null" }
  | { readonly state: "unavailable" };

/**
 * Decode one datum's three states literally. The member must be present —
 * `null` is never omission (12.7) — so callers pass the raw member value
 * read via `requiredMember` semantics: `undefined` (an absent member)
 * rejects here. An object carrying a member named `unavailable` must be
 * exactly the marker `{"unavailable": true}` (12.7); anything else with that
 * member is a wrong form, never a plain value. Plain values decode through
 * the caller's `decodeValue`, so `null` and the marker never collapse into a
 * defaulted value (S-5).
 */
export function decodeDatum<T>(
  value: unknown,
  site: DecodeSite,
  decodeValue: (value: unknown, site: DecodeSite) => T,
): DecodedDatum<T> {
  if (value === undefined) {
    formFail(
      site,
      "a present member: a datum that does not arise is null, never " +
        "omitted (SPEC 12.7)",
      value,
    );
  }
  if (value === null) return { state: "null" };
  if (
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.hasOwn(value, "unavailable")
  ) {
    const obj = value as Record<string, unknown>;
    if (Object.keys(obj).length !== 1 || obj["unavailable"] !== true) {
      formFail(
        site,
        'the unavailability marker {"unavailable": true} exactly (SPEC ' +
          '12.7: no other object carries a member named "unavailable")',
        value,
      );
    }
    return { state: "unavailable" };
  }
  return { state: "value", value: decodeValue(value, site) };
}

// --- the unavailability-marker structural walk (T12.7-1) -----------------------

/**
 * Walk a decoded JSON document and assert 12.7's marker uniqueness: no
 * object of any form other than the unavailability marker carries a member
 * named `unavailable` — every object with that member is exactly
 * `{"unavailable": true}`. Diagnoses name the offending JSON path.
 */
export function assertUnavailabilityMarkerForms(
  doc: unknown,
  context?: string,
): void {
  const walk = (value: unknown, site: DecodeSite): void => {
    if (Array.isArray(value)) {
      value.forEach((element, index) => {
        walk(element, at(site, index));
      });
      return;
    }
    if (typeof value !== "object" || value === null) return;
    const obj = value as Record<string, unknown>;
    if (
      Object.hasOwn(obj, "unavailable") &&
      (Object.keys(obj).length !== 1 || obj["unavailable"] !== true)
    ) {
      formFail(
        site,
        "no object of any form other than the unavailability marker " +
          '{"unavailable": true} carrying a member named "unavailable" ' +
          "(SPEC 12.7)",
        value,
      );
    }
    for (const [key, member] of Object.entries(obj)) {
      walk(member, at(site, key));
    }
  };
  walk(doc, rootSite("12.7 unavailability-marker walk", context));
}
