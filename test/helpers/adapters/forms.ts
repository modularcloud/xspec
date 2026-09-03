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
//   - the version document {"product","interface"} (12.6)
//   - the three-state datum decode: plain value / `null` /
//     {"unavailable": true} (11.4, 12.7)
//   - the scoped inventory decodes: the `recorded` datum, the `findings`
//     member, the `root`/`config` anchoring, and the resolved
//     configuration/sources/derived map (11.6), plus the full ten-member
//     inventory document decode composing them with the `graphData`,
//     `journal`, and `sessions` forms (T11.6-3)
//   - the occurrence-record form {"file","range","kind","source","target"}
//     and the occurrences document {"findings","occurrences"} (5.7, 11.3)
//   - the at document {"findings","resolution"} (11.5)
//   - the scoped view decode: top level {"findings","views"} and each
//     per-file wrapper's form with its `file` member (11.4)
//   - the full view decode: per-file positional trees with node, attribute,
//     import, occurrence, and comment forms, `--text` conditional presence
//     (11.4, T11.2-1, T11.4-*)
//   - the rename/move preview document {"findings","mapping","files","delta"}
//     (6.6) with the ten edit classes and the pinned orders
//   - the unavailability-marker structural walk T12.7-1 relies on: no object
//     of any form other than the marker carries a member named "unavailable".
//     Every public DOCUMENT decoder below runs the walk over the whole raw
//     document before decoding members — the scoped decoders included, whose
//     unread members the walk still covers — so the T12.7-1 walk runs over
//     every 12.7 document the suite captures (captures go through these
//     entry points; S-5 guards both the walk and this integration)

import { Buffer, isUtf8 } from "node:buffer";
import type {
  AppliedMappingPair,
  AtReport,
  AtResolution,
  AtSection,
  DependencyEdgeKind,
  ErrorDocument,
  FileView,
  Finding,
  FindingLocation,
  FindingsReport,
  InventoryAnchoring,
  InventoryConfigurationView,
  InventoryCoverageProfileView,
  InventoryDerivedEntry,
  InventoryGroupDef,
  InventoryJournalStatus,
  InventoryPolicyRuleView,
  InventoryPolicySelector,
  InventoryResolvedMap,
  InventorySourceEntry,
  MarkedBytePath,
  OccurrenceRecord,
  OccurrenceSource,
  OccurrenceSourceNode,
  OccurrencesReport,
  PathValue,
  PreviewDelta,
  PreviewDeltaDatum,
  PreviewEdit,
  PreviewFileEntry,
  PreviewReport,
  SourceRange,
  VersionDocument,
  ViewAttributeEntry,
  ViewFilesReport,
  ViewImportEntry,
  ViewNode,
  ViewReport,
} from "./model.js";
import {
  CONDITION_CODE_TOKENS,
  COVERAGE_ATTRIBUTE_VALUES,
  COVERAGE_MODES,
  COVERAGE_TARGETS_VALUES,
  DEPENDENCY_EDGE_KINDS,
  GROUP_KINDS,
  POLICY_RULE_TYPES,
  PREVIEW_EDIT_CLASSES,
  REFUSAL_CODE_TOKENS,
  conditionIdentityOf,
} from "./model.js";
import type { DecodeSite } from "./decode.js";
import {
  at,
  describeJsonValue,
  expectArray,
  expectBoolean,
  expectNonEmptyString,
  expectNonEmptyStringArray,
  expectNonNegativeInteger,
  expectObject,
  expectString,
  expectToken,
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
  assertUnavailabilityMarkerForms(doc, context);
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
  assertUnavailabilityMarkerForms(doc, context);
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

// --- the version document (12.6, 12.7) ----------------------------------------

/**
 * The `version` document — `{"product", "interface"}` exactly, both strings
 * (SPEC 12.6, 12.7): the product version and the machine-interface version.
 * 12.6 is a JSON-only surface, so this single document is `version`'s only
 * output form, with or without `--json` (12.0). Form-exact (H-3): 12.7 fixes
 * the document form of 12.6, no adapter in the path. Value contracts — the
 * machine-interface value exactly `"1"` (the string form of 12.6's stated
 * value) and per-build fixedness — stay with the caller (T12.6-1/2).
 */
export function decodeVersionDocument(
  doc: unknown,
  context?: string,
): VersionDocument {
  assertUnavailabilityMarkerForms(doc, context);
  const site = rootSite("12.7 version document", context);
  const obj = expectObject(doc, site);
  expectOnlyMembers(obj, ["product", "interface"], site);
  return {
    product: expectString(
      requiredKey(obj, "product", site),
      at(site, "product"),
    ),
    interface: expectString(
      requiredKey(obj, "interface", site),
      at(site, "interface"),
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

// --- scoped inventory decode: the `recorded` datum (11.6, 12.7) ---------------

/**
 * Scoped decode of the inventory document's `recorded` member (SPEC 11.6,
 * 12.7): the record-supplied datum — the recorded derived-file paths, each a
 * 12.7 path value, the list in byte order of workspace-relative path with no
 * duplicate (11.6/12.7 pin the order; decoder-enforced, exactly as the
 * `sources`/`derived` orders are) — as a three-state datum: a plain list,
 * `null`, or the explicit-unavailability marker (14.23). Which states are
 * legitimate for this member is the caller's value assertion (a conforming
 * inventory reports the plain list or unavailability, never `null`,
 * 11.6/12.7). Deliberately scoped: SPEC 12.7 fixes the whole inventory form
 * and the T11.6-* tests pin it entirely; this decoder reads exactly the one
 * pinned member the record-recovery contract needs (T12.2-2's
 * unreadable-record arm: after a successful `build` replaces the corrupt
 * state, `inventory` reports `recorded` again) — the top level must be an
 * object and the member present (`null` is never omission, 12.7) while every
 * other member stays unread. Form-exact (H-3): never adjustable to a
 * product's shape.
 */
export function decodeInventoryRecordedDatum(
  doc: unknown,
  context?: string,
): DecodedDatum<readonly PathValue[]> {
  assertUnavailabilityMarkerForms(doc, context);
  const site = rootSite("11.6 inventory (recorded datum)", context);
  const obj = expectObject(doc, site);
  const recordedSite = at(site, "recorded");
  return decodeDatum(obj["recorded"], recordedSite, (value, valueSite) => {
    const paths = expectArray(value, valueSite).map((element, index) =>
      decodePathValue(element, at(valueSite, index)),
    );
    for (let i = 1; i < paths.length; i += 1) {
      const order = Buffer.compare(
        pathValueBytes(paths[i - 1]!),
        pathValueBytes(paths[i]!),
      );
      if (order === 0) {
        formFail(
          at(valueSite, i),
          "recorded derived-file paths without duplicates (SPEC 11.6: a " +
            "deterministically ordered path list)",
          value,
        );
      }
      if (order > 0) {
        formFail(
          at(valueSite, i),
          "recorded derived-file paths in byte order of workspace-relative " +
            "path (SPEC 11.6, 12.7)",
          value,
        );
      }
    }
    return paths;
  });
}

/**
 * Scoped decode of the inventory document's `findings` member (SPEC 11.6,
 * 12.7): the pinned `"findings"` array in the literal finding form and the
 * pinned findings order. Deliberately scoped exactly as
 * `decodeInventoryRecordedDatum` is: SPEC 12.7 fixes the whole inventory
 * form and the T11.6-* tests pin it entirely; this decoder reads the one
 * member the reporter matrix needs (T14-4's 14.23 row: the condition-23
 * finding accompanies the inventory answer) — the top level must be an
 * object and the member present (`[]` is never `null`, and wherever a
 * document carries findings they form this member, 12.7) while every other
 * member stays unread. Form-exact (H-3): never adjustable to a product's
 * shape.
 */
export function decodeInventoryFindings(
  doc: unknown,
  context?: string,
): Finding[] {
  assertUnavailabilityMarkerForms(doc, context);
  const site = rootSite("11.6 inventory (findings)", context);
  const obj = expectObject(doc, site);
  return decodeFindingsArray(
    requiredKey(obj, "findings", site),
    at(site, "findings"),
  );
}

/**
 * Scoped decode of the inventory document's anchoring members (SPEC 11.6,
 * 12.7): exactly `root` and `config` — the workspace root and the
 * configuration file identified relative to the invocation working
 * directory — each a 12.7 path value (`decodePathValue`: a plain string
 * where the bytes are valid UTF-8, the marked byte form otherwise, never the
 * byte form for a valid-UTF-8 path). The canonical relative spelling (`.`,
 * ascent-`..`-then-descent joined with `/`) and the platform-absolute
 * drive-mismatch form are value contracts the caller asserts byte-exactly
 * (T11.6-1); the decoder's job is that neither member is ever absent (`null`
 * is never omission, 12.7) or mis-formed. Deliberately scoped exactly as
 * `decodeInventoryRecordedDatum` is: SPEC 12.7 fixes the whole inventory
 * form and the T11.6-* tests pin it entirely; every other member stays
 * unread here. Form-exact (H-3): never adjustable to a product's shape.
 */
export function decodeInventoryAnchoring(
  doc: unknown,
  context?: string,
): InventoryAnchoring {
  assertUnavailabilityMarkerForms(doc, context);
  const site = rootSite("11.6 inventory (anchoring)", context);
  const obj = expectObject(doc, site);
  return {
    root: decodePathValue(requiredKey(obj, "root", site), at(site, "root")),
    config: decodePathValue(
      requiredKey(obj, "config", site),
      at(site, "config"),
    ),
  };
}

// --- scoped inventory decode: configuration, sources, derived (11.6, 12.7) ----

/**
 * A member that is the stated `null` or a 12.7 path value (`markdown.outDir`
 * unset; a non-generating source's `module`/`markdown`). The member must be
 * present — `null` is never omission (12.7) — and a present value must be a
 * well-formed path value; the unavailability marker is no path value and
 * rejects (these members are configuration- and discovery-determined, never
 * record-supplied, 11.6).
 */
function decodeNullablePathMember(
  obj: Record<string, unknown>,
  key: string,
  site: DecodeSite,
): PathValue | null {
  const value = requiredMember(obj, key, site);
  if (value === null) return null;
  return decodePathValue(value, at(site, key));
}

/** One group of the view: `{"name", "globs"}` exactly (12.7). */
function decodeInventoryGroupDef(
  value: unknown,
  site: DecodeSite,
): InventoryGroupDef {
  const obj = expectObject(value, site);
  expectOnlyMembers(obj, ["name", "globs"], site);
  return {
    name: expectNonEmptyString(
      requiredKey(obj, "name", site),
      at(site, "name"),
    ),
    globs: expectNonEmptyStringArray(
      requiredKey(obj, "globs", site),
      at(site, "globs"),
    ),
  };
}

/** A group list of the view (`specs`/`code`), each entry `{"name","globs"}`. */
function decodeInventoryGroupList(
  value: unknown,
  site: DecodeSite,
): InventoryGroupDef[] {
  return expectArray(value, site).map((element, index) =>
    decodeInventoryGroupDef(element, at(site, index)),
  );
}

/** An edge-kind list member (`edgeKinds`/`kinds`): 5.2's tokens only. */
function decodeEdgeKindList(
  value: unknown,
  site: DecodeSite,
): DependencyEdgeKind[] {
  return expectArray(value, site).map((element, index) =>
    expectToken(element, DEPENDENCY_EDGE_KINDS, at(site, index)),
  );
}

const COVERAGE_PROFILE_VIEW_MEMBERS = [
  "name",
  "target",
  "targetTags",
  "targets",
  "boundary",
  "boundaryKind",
  "mode",
  "edgeKinds",
] as const;

/**
 * One resolved coverage profile (12.7): all eight members present — every
 * default and inferred kind explicit (11.6) — `targetTags` `null` where
 * absent, never omitted.
 */
function decodeCoverageProfileView(
  value: unknown,
  site: DecodeSite,
): InventoryCoverageProfileView {
  const obj = expectObject(value, site);
  expectOnlyMembers(obj, COVERAGE_PROFILE_VIEW_MEMBERS, site);
  const targetTagsValue = requiredMember(obj, "targetTags", site);
  return {
    name: expectNonEmptyString(
      requiredKey(obj, "name", site),
      at(site, "name"),
    ),
    target: expectNonEmptyString(
      requiredKey(obj, "target", site),
      at(site, "target"),
    ),
    targetTags:
      targetTagsValue === null
        ? null
        : expectNonEmptyStringArray(targetTagsValue, at(site, "targetTags")),
    targets: expectToken(
      requiredKey(obj, "targets", site),
      COVERAGE_TARGETS_VALUES,
      at(site, "targets"),
    ),
    boundary: expectNonEmptyString(
      requiredKey(obj, "boundary", site),
      at(site, "boundary"),
    ),
    boundaryKind: expectToken(
      requiredKey(obj, "boundaryKind", site),
      GROUP_KINDS,
      at(site, "boundaryKind"),
    ),
    mode: expectToken(
      requiredKey(obj, "mode", site),
      COVERAGE_MODES,
      at(site, "mode"),
    ),
    edgeKinds: decodeEdgeKindList(
      requiredKey(obj, "edgeKinds", site),
      at(site, "edgeKinds"),
    ),
  };
}

/**
 * A resolved policy selector (7.5, 12.7): exactly one of `{"group","kind"}`
 * (the kind explicit though inferred), `{"files"}`, or `{"tags"}`.
 */
function decodePolicySelectorView(
  value: unknown,
  site: DecodeSite,
): InventoryPolicySelector {
  const obj = expectObject(value, site);
  if (Object.hasOwn(obj, "group")) {
    expectOnlyMembers(obj, ["group", "kind"], site);
    return {
      group: expectNonEmptyString(
        requiredKey(obj, "group", site),
        at(site, "group"),
      ),
      kind: expectToken(
        requiredKey(obj, "kind", site),
        GROUP_KINDS,
        at(site, "kind"),
      ),
    };
  }
  if (Object.hasOwn(obj, "files")) {
    expectOnlyMembers(obj, ["files"], site);
    return {
      files: expectNonEmptyString(
        requiredKey(obj, "files", site),
        at(site, "files"),
      ),
    };
  }
  if (Object.hasOwn(obj, "tags")) {
    expectOnlyMembers(obj, ["tags"], site);
    return {
      tags: expectNonEmptyStringArray(
        requiredKey(obj, "tags", site),
        at(site, "tags"),
      ),
    };
  }
  formFail(
    site,
    'a selector in exactly one of the forms {"group", "kind"}, {"files"}, ' +
      'or {"tags"} (SPEC 7.5, 12.7)',
    value,
  );
}

/** One resolved policy rule (12.7): `{"name","type","from","to","kinds"}`. */
function decodePolicyRuleView(
  value: unknown,
  site: DecodeSite,
): InventoryPolicyRuleView {
  const obj = expectObject(value, site);
  expectOnlyMembers(obj, ["name", "type", "from", "to", "kinds"], site);
  return {
    name: expectNonEmptyString(
      requiredKey(obj, "name", site),
      at(site, "name"),
    ),
    type: expectToken(
      requiredKey(obj, "type", site),
      POLICY_RULE_TYPES,
      at(site, "type"),
    ),
    from: decodePolicySelectorView(
      requiredKey(obj, "from", site),
      at(site, "from"),
    ),
    to: decodePolicySelectorView(requiredKey(obj, "to", site), at(site, "to")),
    kinds: decodeEdgeKindList(
      requiredKey(obj, "kinds", site),
      at(site, "kinds"),
    ),
  };
}

/** One `sources` entry: `{"path", "groups"}` exactly (12.7). */
function decodeInventorySourceEntry(
  value: unknown,
  site: DecodeSite,
): InventorySourceEntry {
  const obj = expectObject(value, site);
  expectOnlyMembers(obj, ["path", "groups"], site);
  const groupsSite = at(site, "groups");
  return {
    path: decodePathValue(requiredKey(obj, "path", site), at(site, "path")),
    groups: expectArray(requiredKey(obj, "groups", site), groupsSite).map(
      (element, index) => {
        const membershipSite = at(groupsSite, index);
        const membership = expectObject(element, membershipSite);
        expectOnlyMembers(membership, ["name", "kind"], membershipSite);
        return {
          name: expectNonEmptyString(
            requiredKey(membership, "name", membershipSite),
            at(membershipSite, "name"),
          ),
          kind: expectToken(
            requiredKey(membership, "kind", membershipSite),
            GROUP_KINDS,
            at(membershipSite, "kind"),
          ),
        };
      },
    ),
  };
}

/** One `derived` entry: `{"source", "module", "markdown"}` exactly (12.7). */
function decodeInventoryDerivedEntry(
  value: unknown,
  site: DecodeSite,
): InventoryDerivedEntry {
  const obj = expectObject(value, site);
  expectOnlyMembers(obj, ["source", "module", "markdown"], site);
  return {
    source: decodePathValue(
      requiredKey(obj, "source", site),
      at(site, "source"),
    ),
    module: decodeNullablePathMember(obj, "module", site),
    markdown: decodeNullablePathMember(obj, "markdown", site),
  };
}

/**
 * Scoped decode of the inventory document's `configuration`, `sources`, and
 * `derived` members (SPEC 11.6, 12.7; T11.6-2's subject): the resolved
 * configuration view `{"specs", "code", "markdown", "coverage", "policy"}` —
 * every member present, every default and inferred kind explicit, each
 * group/profile/rule carried with its complete definition in the 12.7 member
 * forms — one `{"path", "groups"}` per discovered file, and one `{"source",
 * "module", "markdown"}` per discovered spec source. The `sources` and
 * `derived` lists must arrive in byte order of workspace-relative path with
 * one entry per file (11.6/12.7 pin that order; configuration order for
 * groups, profiles, and rules is the caller's value assertion — this decoder
 * cannot know the configuration). Deliberately scoped exactly as
 * `decodeInventoryRecordedDatum` is: SPEC 12.7 fixes the whole inventory
 * form and the T11.6-* tests pin it entirely; every other member stays
 * unread here. Form-exact (H-3): never adjustable to a product's shape.
 */
export function decodeInventoryResolvedMap(
  doc: unknown,
  context?: string,
): InventoryResolvedMap {
  assertUnavailabilityMarkerForms(doc, context);
  const site = rootSite("11.6 inventory (resolved map)", context);
  const obj = expectObject(doc, site);

  const configurationSite = at(site, "configuration");
  const configurationObj = expectObject(
    requiredKey(obj, "configuration", site),
    configurationSite,
  );
  expectOnlyMembers(
    configurationObj,
    ["specs", "code", "markdown", "coverage", "policy"],
    configurationSite,
  );
  const markdownSite = at(configurationSite, "markdown");
  const markdownObj = expectObject(
    requiredKey(configurationObj, "markdown", configurationSite),
    markdownSite,
  );
  expectOnlyMembers(markdownObj, ["emit", "outDir"], markdownSite);
  const coverageSite = at(configurationSite, "coverage");
  const policySite = at(configurationSite, "policy");
  const configuration: InventoryConfigurationView = {
    specs: decodeInventoryGroupList(
      requiredKey(configurationObj, "specs", configurationSite),
      at(configurationSite, "specs"),
    ),
    code: decodeInventoryGroupList(
      requiredKey(configurationObj, "code", configurationSite),
      at(configurationSite, "code"),
    ),
    markdown: {
      emit: expectBoolean(
        requiredKey(markdownObj, "emit", markdownSite),
        at(markdownSite, "emit"),
      ),
      outDir: decodeNullablePathMember(markdownObj, "outDir", markdownSite),
    },
    coverage: expectArray(
      requiredKey(configurationObj, "coverage", configurationSite),
      coverageSite,
    ).map((element, index) =>
      decodeCoverageProfileView(element, at(coverageSite, index)),
    ),
    policy: expectArray(
      requiredKey(configurationObj, "policy", configurationSite),
      policySite,
    ).map((element, index) =>
      decodePolicyRuleView(element, at(policySite, index)),
    ),
  };

  const sourcesSite = at(site, "sources");
  const sources = expectArray(
    requiredKey(obj, "sources", site),
    sourcesSite,
  ).map((element, index) =>
    decodeInventorySourceEntry(element, at(sourcesSite, index)),
  );
  for (let i = 1; i < sources.length; i += 1) {
    const order = Buffer.compare(
      pathValueBytes(sources[i - 1]!.path),
      pathValueBytes(sources[i]!.path),
    );
    if (order === 0) {
      formFail(
        at(sourcesSite, i),
        'one {"path", "groups"} entry per discovered file (SPEC 12.7)',
        obj["sources"],
      );
    }
    if (order > 0) {
      formFail(
        at(sourcesSite, i),
        "source entries in byte order of workspace-relative path (SPEC 11.6)",
        obj["sources"],
      );
    }
  }

  const derivedSite = at(site, "derived");
  const derived = expectArray(
    requiredKey(obj, "derived", site),
    derivedSite,
  ).map((element, index) =>
    decodeInventoryDerivedEntry(element, at(derivedSite, index)),
  );
  for (let i = 1; i < derived.length; i += 1) {
    const order = Buffer.compare(
      pathValueBytes(derived[i - 1]!.source),
      pathValueBytes(derived[i]!.source),
    );
    if (order === 0) {
      formFail(
        at(derivedSite, i),
        'one {"source", "module", "markdown"} entry per discovered spec ' +
          "source (SPEC 12.7)",
        obj["derived"],
      );
    }
    if (order > 0) {
      formFail(
        at(derivedSite, i),
        "derived entries in byte order of workspace-relative source path " +
          "(SPEC 11.6)",
        obj["derived"],
      );
    }
  }

  return { configuration, sources, derived };
}

// --- the full inventory document (11.6, 12.7) ---------------------------------

/**
 * The complete decoded inventory document (SPEC 11.6, 12.7 — the surface the
 * T11.6-* tests pin together): every member of the pinned form
 * `{"findings", "root", "config", "configuration", "sources", "derived",
 * "recorded", "graphData", "journal", "sessions"}`.
 */
export interface InventoryDocument {
  readonly findings: readonly Finding[];
  readonly root: PathValue;
  readonly config: PathValue;
  readonly configuration: InventoryConfigurationView;
  readonly sources: readonly InventorySourceEntry[];
  readonly derived: readonly InventoryDerivedEntry[];
  readonly recorded: DecodedDatum<readonly PathValue[]>;
  readonly graphData: PathValue;
  readonly journal: InventoryJournalStatus;
  readonly sessions: readonly PathValue[];
}

/** The ten members of the inventory document form, exactly (SPEC 12.7). */
const INVENTORY_DOCUMENT_MEMBERS = [
  "findings",
  "root",
  "config",
  "configuration",
  "sources",
  "derived",
  "recorded",
  "graphData",
  "journal",
  "sessions",
] as const;

/** The file-name bytes of a 12.7 path value (its bytes after the last `/`). */
function pathValueFileNameBytes(value: PathValue): Buffer {
  const bytes = pathValueBytes(value);
  const lastSep = bytes.lastIndexOf(0x2f);
  return lastSep === -1 ? bytes : bytes.subarray(lastSep + 1);
}

/**
 * The `journal` member form: `{"path", "occupied"}` exactly — the journal
 * path as a 12.7 path value and occupancy as a boolean (SPEC 11.6, 12.7).
 */
function decodeInventoryJournalStatus(
  value: unknown,
  site: DecodeSite,
): InventoryJournalStatus {
  const obj = expectObject(value, site);
  expectOnlyMembers(obj, ["path", "occupied"], site);
  return {
    path: decodePathValue(requiredKey(obj, "path", site), at(site, "path")),
    occupied: expectBoolean(
      requiredKey(obj, "occupied", site),
      at(site, "occupied"),
    ),
  };
}

/**
 * Full decode of the inventory document (SPEC 11.6, 12.7; the T11.6-3 entry
 * completes the member set the T11.6-* tests pin): the top level carries
 * exactly the ten members of the pinned form — `null` never omission, no
 * member outside the form — decoded through the scoped decoders above (one
 * code path per member form) plus the `recorded`, `graphData`, `journal`,
 * and `sessions` members: `recorded` the three-state record-supplied datum
 * (byte-ordered paths, or the unavailability marker, 14.23); `graphData` a
 * path value (the `.xspec` spelling is the caller's byte-exact value
 * assertion); `journal` `{"path", "occupied"}`; `sessions` the session file
 * paths in byte order of file name with no duplicate (11.6 pins that order;
 * decoder-enforced). Form-exact (H-3): never adjustable to a product's
 * shape.
 */
export function decodeInventoryDocument(
  doc: unknown,
  context?: string,
): InventoryDocument {
  assertUnavailabilityMarkerForms(doc, context);
  const site = rootSite("11.6 inventory (document)", context);
  const obj = expectObject(doc, site);
  expectOnlyMembers(obj, INVENTORY_DOCUMENT_MEMBERS, site);

  const anchoring = decodeInventoryAnchoring(doc, context);
  const map = decodeInventoryResolvedMap(doc, context);
  const findings = decodeInventoryFindings(doc, context);
  const recorded = decodeInventoryRecordedDatum(doc, context);

  const graphData = decodePathValue(
    requiredKey(obj, "graphData", site),
    at(site, "graphData"),
  );
  const journal = decodeInventoryJournalStatus(
    requiredKey(obj, "journal", site),
    at(site, "journal"),
  );

  const sessionsSite = at(site, "sessions");
  const sessions = expectArray(
    requiredKey(obj, "sessions", site),
    sessionsSite,
  ).map((element, index) => decodePathValue(element, at(sessionsSite, index)));
  for (let i = 1; i < sessions.length; i += 1) {
    const order = Buffer.compare(
      pathValueFileNameBytes(sessions[i - 1]!),
      pathValueFileNameBytes(sessions[i]!),
    );
    if (order === 0) {
      formFail(
        at(sessionsSite, i),
        "one entry per session file — directory entries are unique, so no " +
          "two session file names coincide (SPEC 11.6, 10.1)",
        obj["sessions"],
      );
    }
    if (order > 0) {
      formFail(
        at(sessionsSite, i),
        "session files in byte order of file name (SPEC 11.6)",
        obj["sessions"],
      );
    }
  }

  return {
    findings,
    root: anchoring.root,
    config: anchoring.config,
    configuration: map.configuration,
    sources: map.sources,
    derived: map.derived,
    recorded,
    graphData,
    journal,
    sessions,
  };
}

// --- the occurrences document (5.7, 11.3, 12.7) -------------------------------

const OCCURRENCE_RECORD_MEMBERS = [
  "file",
  "range",
  "kind",
  "source",
  "target",
] as const;

/** The source graph node member form: `{"identity", "range"}` exactly. */
function decodeOccurrenceSourceNode(
  value: unknown,
  site: DecodeSite,
): OccurrenceSourceNode {
  const obj = expectObject(value, site);
  expectOnlyMembers(obj, ["identity", "range"], site);
  return {
    identity: expectNonEmptyString(
      requiredKey(obj, "identity", site),
      at(site, "identity"),
    ),
    range: decodeRangeForm(requiredKey(obj, "range", site), at(site, "range")),
  };
}

/**
 * One reference occurrence record in the literal 12.7 form: exactly the five
 * members `{"file", "range", "kind", "source", "target"}` — the referencing
 * file as a 12.7 path value, the occurrence's own range, its edge kind
 * (`"depends"`, `"embeds"`, or `"references"`; 5.2 — `contains` is no
 * reference kind), the source graph node `{"identity", "range"}` or the
 * unavailability marker where 11.2 leaves the source node's identity
 * undefined (one datum, never `null`), and the resolved target's identity.
 */
export function decodeOccurrenceRecordForm(
  value: unknown,
  site: DecodeSite,
): OccurrenceRecord {
  const obj = expectObject(value, site);
  expectOnlyMembers(obj, OCCURRENCE_RECORD_MEMBERS, site);
  const file = decodePathValue(
    requiredKey(obj, "file", site),
    at(site, "file"),
  );
  const range = decodeRangeForm(
    requiredKey(obj, "range", site),
    at(site, "range"),
  );
  const kind = expectToken(
    requiredKey(obj, "kind", site),
    DEPENDENCY_EDGE_KINDS,
    at(site, "kind"),
  );
  const sourceSite = at(site, "source");
  const sourceDatum = decodeDatum(
    obj["source"],
    sourceSite,
    decodeOccurrenceSourceNode,
  );
  if (sourceDatum.state === "null") {
    formFail(
      sourceSite,
      'the source graph node {"identity", "range"} or the unavailability ' +
        "marker — one datum, defined or explicitly unavailable, never null " +
        "(SPEC 5.7, 11.2, 12.7)",
      null,
    );
  }
  const source: OccurrenceSource =
    sourceDatum.state === "value"
      ? sourceDatum.value
      : { unavailable: true as const };
  const target = expectNonEmptyString(
    requiredKey(obj, "target", site),
    at(site, "target"),
  );
  return { file, range, kind, source, target };
}

/**
 * The pinned occurrence order (SPEC 5.7): by referencing file path bytes,
 * then range start, then range end. Total and deterministic; distinct
 * occurrences occupy distinct spans, so equal keys never occur.
 */
function compareOccurrenceRecords(
  a: OccurrenceRecord,
  b: OccurrenceRecord,
): number {
  const byFile = Buffer.compare(pathValueBytes(a.file), pathValueBytes(b.file));
  if (byFile !== 0) return byFile;
  if (a.range.start !== b.range.start) return a.range.start - b.range.start;
  return a.range.end - b.range.end;
}

/**
 * The `occurrences` document (11.3) — `{"findings", "occurrences"}` exactly
 * (SPEC 12.7): the consulted domain's findings in the pinned findings order,
 * and occurrence records in occurrence order (5.7 — file path bytes, then
 * range start, then range end; identical spans do not occur). Form-exact
 * (H-3): 11.3 is a JSON-only surface, no adapter in the path.
 */
export function decodeOccurrencesReport(
  doc: unknown,
  context?: string,
): OccurrencesReport {
  assertUnavailabilityMarkerForms(doc, context);
  const site = rootSite("12.7 occurrences document", context);
  const obj = expectObject(doc, site);
  expectOnlyMembers(obj, ["findings", "occurrences"], site);
  const findings = decodeFindingsArray(
    requiredKey(obj, "findings", site),
    at(site, "findings"),
  );
  const occurrencesSite = at(site, "occurrences");
  const occurrences = expectArray(
    requiredKey(obj, "occurrences", site),
    occurrencesSite,
  ).map((element, index) =>
    decodeOccurrenceRecordForm(element, at(occurrencesSite, index)),
  );
  for (let i = 1; i < occurrences.length; i += 1) {
    const order = compareOccurrenceRecords(
      occurrences[i - 1]!,
      occurrences[i]!,
    );
    if (order === 0) {
      formFail(
        at(occurrencesSite, i),
        "distinct occurrences occupying distinct spans — records with an " +
          "identical (file, range) key do not occur (SPEC 5.7)",
        obj["occurrences"],
      );
    }
    if (order > 0) {
      formFail(
        at(occurrencesSite, i),
        "records in occurrence order: by referencing file path bytes, then " +
          "range start, then range end (SPEC 5.7, 12.7)",
        obj["occurrences"],
      );
    }
  }
  return { findings, occurrences };
}

// --- the at document (11.5, 12.7) ---------------------------------------------

/**
 * The resolution's section member: `{"identity", "range"}` exactly — the
 * innermost enclosing section construct's range, and its node identity per
 * 11.2: a plain identity string, or the unavailability marker where 11.2
 * leaves it undefined; never `null`.
 */
function decodeAtSectionForm(value: unknown, site: DecodeSite): AtSection {
  const obj = expectObject(value, site);
  expectOnlyMembers(obj, ["identity", "range"], site);
  const identitySite = at(site, "identity");
  const identityDatum = decodeDatum(
    obj["identity"],
    identitySite,
    expectNonEmptyString,
  );
  if (identityDatum.state === "null") {
    formFail(
      identitySite,
      "the section's node identity — a plain identity string, or the " +
        "unavailability marker where 11.2 leaves it undefined, never null " +
        "(SPEC 11.5, 11.2, 12.7)",
      null,
    );
  }
  return {
    identity:
      identityDatum.state === "value"
        ? identityDatum.value
        : { unavailable: true as const },
    range: decodeRangeForm(requiredKey(obj, "range", site), at(site, "range")),
  };
}

/**
 * The `at` document (11.5) — `{"findings", "resolution"}` exactly (SPEC
 * 12.7): the consulted domain's findings, and `resolution` as
 * `{"section", "occurrence"}` — the innermost enclosing section construct
 * and the containing occurrence's record, `occurrence` `null` when the
 * offset lies within none — or the unavailability marker on an unparseable
 * file; never `null`. Form-exact (H-3): 11.5 is a JSON-only surface, no
 * adapter in the path.
 */
export function decodeAtReport(doc: unknown, context?: string): AtReport {
  assertUnavailabilityMarkerForms(doc, context);
  const site = rootSite("12.7 at document", context);
  const obj = expectObject(doc, site);
  expectOnlyMembers(obj, ["findings", "resolution"], site);
  const findings = decodeFindingsArray(
    requiredKey(obj, "findings", site),
    at(site, "findings"),
  );
  const resolutionSite = at(site, "resolution");
  const resolutionDatum = decodeDatum(
    obj["resolution"],
    resolutionSite,
    (value, valueSite): AtResolution => {
      const res = expectObject(value, valueSite);
      expectOnlyMembers(res, ["section", "occurrence"], valueSite);
      const occurrenceValue = requiredMember(res, "occurrence", valueSite);
      return {
        section: decodeAtSectionForm(
          requiredKey(res, "section", valueSite),
          at(valueSite, "section"),
        ),
        occurrence:
          occurrenceValue === null
            ? null
            : decodeOccurrenceRecordForm(
                occurrenceValue,
                at(valueSite, "occurrence"),
              ),
      };
    },
  );
  if (resolutionDatum.state === "null") {
    formFail(
      resolutionSite,
      'the resolution {"section", "occurrence"}, or the unavailability ' +
        "marker on an unparseable file — never null (SPEC 11.5, 12.7)",
      null,
    );
  }
  return {
    findings,
    resolution:
      resolutionDatum.state === "value"
        ? resolutionDatum.value
        : { unavailable: true as const },
  };
}

// --- scoped view decode: the per-file `file` members (11.4, 12.7) -------------

const VIEW_FILE_ENTRY_MEMBERS = [
  "file",
  "root",
  "imports",
  "occurrences",
  "comments",
] as const;

/**
 * Scoped decode of the `view` document (SPEC 11.4, 12.7): the top level —
 * `{"findings", "views"}` exactly — and each per-file view's wrapper form —
 * `{"file", "root", "imports", "occurrences", "comments"}` exactly, every
 * member present — with `file` decoded as a 12.7 path value and the
 * per-file order enforced: byte order of workspace-relative path, strictly
 * ascending, since the requested files form a set (11.4). Deliberately
 * scoped (the `decodeInventoryRecordedDatum` pattern): the T11.4-* tests
 * pin the full per-file view; this decoder reads exactly what a
 * whole-domain dispatch or membership assertion needs, `root`, `imports`,
 * `occurrences`, and `comments` staying unread. Form-exact (H-3): never
 * adjustable to a product's shape.
 */
export function decodeViewFilesReport(
  doc: unknown,
  context?: string,
): ViewFilesReport {
  assertUnavailabilityMarkerForms(doc, context);
  const site = rootSite("12.7 view document (files)", context);
  const obj = expectObject(doc, site);
  expectOnlyMembers(obj, ["findings", "views"], site);
  const findings = decodeFindingsArray(
    requiredKey(obj, "findings", site),
    at(site, "findings"),
  );
  const viewsSite = at(site, "views");
  const files = expectArray(requiredKey(obj, "views", site), viewsSite).map(
    (element, index) => {
      const entrySite = at(viewsSite, index);
      const entry = expectObject(element, entrySite);
      expectOnlyMembers(entry, VIEW_FILE_ENTRY_MEMBERS, entrySite);
      for (const member of VIEW_FILE_ENTRY_MEMBERS) {
        if (member === "file") continue;
        requiredMember(entry, member, entrySite);
      }
      return decodePathValue(
        requiredKey(entry, "file", entrySite),
        at(entrySite, "file"),
      );
    },
  );
  for (let i = 1; i < files.length; i += 1) {
    if (
      Buffer.compare(
        pathValueBytes(files[i - 1]!),
        pathValueBytes(files[i]!),
      ) >= 0
    ) {
      formFail(
        at(viewsSite, i),
        "per-file views ordered by byte order of workspace-relative path — " +
          "the requested files form a set, so the order is strict " +
          "(SPEC 11.4, 12.7)",
        obj["views"],
      );
    }
  }
  return { findings, files };
}

// --- the full view decode (11.4, 12.7) ----------------------------------------

const VIEW_NODE_MEMBERS = [
  "identity",
  "range",
  "opening",
  "closing",
  "attributes",
  "tags",
  "coverage",
  "children",
] as const;
const VIEW_NODE_TEXT_MEMBERS = ["ownText", "subtreeText"] as const;

/** A tag-range member: a range form or `null` where none exists (11.4). */
function decodeTagRangeMember(
  value: unknown,
  site: DecodeSite,
): SourceRange | null {
  if (value === undefined) {
    formFail(
      site,
      "a present member: null is never omission (SPEC 12.7)",
      value,
    );
  }
  return value === null ? null : decodeRangeForm(value, site);
}

/** One attribute entry: `{"name", "range", "text"}` exactly (11.4, 12.7). */
function decodeViewAttributeEntry(
  value: unknown,
  site: DecodeSite,
): ViewAttributeEntry {
  const obj = expectObject(value, site);
  expectOnlyMembers(obj, ["name", "range", "text"], site);
  const nameValue = requiredMember(obj, "name", site);
  const range = decodeRangeForm(
    requiredKey(obj, "range", site),
    at(site, "range"),
  );
  const text = expectNonEmptyString(
    requiredKey(obj, "text", site),
    at(site, "text"),
  );
  if (Buffer.byteLength(text, "utf8") !== range.end - range.start) {
    formFail(
      at(site, "text"),
      "the attribute's own characters — the source text's byte length " +
        "equals its range's length (SPEC 11.4, 1.7)",
      value,
    );
  }
  return {
    name:
      nameValue === null
        ? null
        : expectNonEmptyString(nameValue, at(site, "name")),
    range,
    text,
  };
}

/** A text-member datum: a plain string or the marker, never `null` (11.2). */
function decodeViewTextMember(
  value: unknown,
  site: DecodeSite,
): string | { readonly unavailable: true } {
  const datum = decodeDatum(value, site, expectString);
  if (datum.state === "null") {
    formFail(
      site,
      "an own/subtree text value — a plain string, or the unavailability " +
        "marker where 11.2 leaves the whole value undefined, never null " +
        "(SPEC 11.2, 11.4, 12.7)",
      null,
    );
  }
  return datum.state === "value" ? datum.value : { unavailable: true as const };
}

/**
 * One node of the positional section tree in the literal 12.7 form:
 * `{"identity", "range", "opening", "closing", "attributes", "tags",
 * "coverage", "children"}` plus `"ownText"`/`"subtreeText"` exactly when
 * `--text` is given (the stated conditional presence — absent without the
 * flag, both present with it). `identity` is a plain identity string or the
 * unavailability marker, never `null` (11.2 defines no structural absence
 * for it); `tags`/`coverage` are three-state datums (a root's stated `null`,
 * 11.4); `attributes` entries are in tag order and `children` in document
 * order — both strictly ascending by range start (distinct constructs occupy
 * distinct spans).
 *
 * H-11: the tree is walked through an explicit stack, never by native
 * recursion per nesting level — the suite stages section towers 2048 and
 * 4096 deep (P-8, P-11), past V8's frame budget — and no depth cap of any
 * kind. The checks run per node in exactly the order a recursive descent
 * runs them: the node's own members first, then each child completely
 * (subtree included) in document order, then the children's order and the
 * text members.
 */
function decodeViewNodeForm(
  value: unknown,
  site: DecodeSite,
  text: boolean,
): ViewNode {
  const stack: ViewNodeFrame[] = [enterViewNode(value, site, text)];
  for (;;) {
    const top = stack[stack.length - 1]!;
    if (top.nextChild < top.rawChildren.length) {
      const index = top.nextChild;
      top.nextChild += 1;
      stack.push(
        enterViewNode(
          top.rawChildren[index],
          at(top.childrenSite, index),
          text,
        ),
      );
      continue;
    }
    const node = leaveViewNode(top, text);
    stack.pop();
    const parent = stack[stack.length - 1];
    if (parent === undefined) return node;
    parent.children.push(node);
  }
}

/** One node's decode in flight: its own members decoded, children pending. */
interface ViewNodeFrame {
  readonly site: DecodeSite;
  readonly obj: Record<string, unknown>;
  readonly identity: ViewNode["identity"];
  readonly range: SourceRange;
  readonly opening: SourceRange | null;
  readonly closing: SourceRange | null;
  readonly attributes: ViewAttributeEntry[];
  readonly tags: ViewNode["tags"];
  readonly coverage: ViewNode["coverage"];
  readonly childrenSite: DecodeSite;
  readonly rawChildren: readonly unknown[];
  /** The children decoded so far, in document order. */
  readonly children: ViewNode[];
  /** The index of the next raw child to decode. */
  nextChild: number;
}

/**
 * A node's own members, in form order — everything that precedes its
 * children's decode: the member allow-list (with or without `--text`), the
 * identity datum (never `null`), the range, the opening and closing tag
 * ranges, the attribute entries in tag order, the tags and coverage datums,
 * and the array form of the children member.
 */
function enterViewNode(
  value: unknown,
  site: DecodeSite,
  text: boolean,
): ViewNodeFrame {
  const obj = expectObject(value, site);
  const allowed = text
    ? [...VIEW_NODE_MEMBERS, ...VIEW_NODE_TEXT_MEMBERS]
    : [...VIEW_NODE_MEMBERS];
  expectOnlyMembers(obj, allowed, site);

  const identitySite = at(site, "identity");
  const identityDatum = decodeDatum(
    obj["identity"],
    identitySite,
    expectNonEmptyString,
  );
  if (identityDatum.state === "null") {
    formFail(
      identitySite,
      "the node's identity — a plain identity string, or the unavailability " +
        "marker where 11.2 leaves it undefined, never null (SPEC 11.2, " +
        "11.4, 12.7)",
      null,
    );
  }

  const range = decodeRangeForm(
    requiredKey(obj, "range", site),
    at(site, "range"),
  );
  const opening = decodeTagRangeMember(obj["opening"], at(site, "opening"));
  const closing = decodeTagRangeMember(obj["closing"], at(site, "closing"));

  const attributesSite = at(site, "attributes");
  const attributes = expectArray(
    requiredKey(obj, "attributes", site),
    attributesSite,
  ).map((element, index) =>
    decodeViewAttributeEntry(element, at(attributesSite, index)),
  );
  for (let i = 1; i < attributes.length; i += 1) {
    if (attributes[i - 1]!.range.start >= attributes[i]!.range.start) {
      formFail(
        at(attributesSite, i),
        "one entry per spelled attribute in tag order — ranges strictly " +
          "ascending (SPEC 11.4, 12.7)",
        obj["attributes"],
      );
    }
  }

  const tagsDatum = decodeDatum(
    obj["tags"],
    at(site, "tags"),
    (tagsValue, tagsSite) =>
      expectArray(tagsValue, tagsSite).map((element, index) =>
        expectNonEmptyString(element, at(tagsSite, index)),
      ),
  );
  const coverageDatum = decodeDatum(
    obj["coverage"],
    at(site, "coverage"),
    (coverageValue, coverageSite) =>
      expectToken(coverageValue, COVERAGE_ATTRIBUTE_VALUES, coverageSite),
  );

  const childrenSite = at(site, "children");
  const rawChildren = expectArray(
    requiredKey(obj, "children", site),
    childrenSite,
  );

  return {
    site,
    obj,
    identity:
      identityDatum.state === "value"
        ? identityDatum.value
        : { unavailable: true as const },
    range,
    opening,
    closing,
    attributes,
    tags:
      tagsDatum.state === "value"
        ? tagsDatum.value
        : tagsDatum.state === "null"
          ? null
          : { unavailable: true as const },
    coverage:
      coverageDatum.state === "value"
        ? coverageDatum.value
        : coverageDatum.state === "null"
          ? null
          : { unavailable: true as const },
    childrenSite,
    rawChildren,
    children: [],
    nextChild: 0,
  };
}

/**
 * A node's completion once every child is decoded: the children's document
 * order (strictly ascending by start), the node itself, and the text
 * members exactly when `--text` is given.
 */
function leaveViewNode(frame: ViewNodeFrame, text: boolean): ViewNode {
  const { site, obj, childrenSite, children } = frame;
  for (let i = 1; i < children.length; i += 1) {
    if (children[i - 1]!.range.start >= children[i]!.range.start) {
      formFail(
        at(childrenSite, i),
        "child nodes in document order — construct ranges strictly " +
          "ascending by start (SPEC 11.4, 12.7)",
        obj["children"],
      );
    }
  }

  const node: {
    identity: ViewNode["identity"];
    range: SourceRange;
    opening: SourceRange | null;
    closing: SourceRange | null;
    attributes: ViewAttributeEntry[];
    tags: ViewNode["tags"];
    coverage: ViewNode["coverage"];
    children: ViewNode[];
    ownText?: ViewNode["ownText"];
    subtreeText?: ViewNode["subtreeText"];
  } = {
    identity: frame.identity,
    range: frame.range,
    opening: frame.opening,
    closing: frame.closing,
    attributes: frame.attributes,
    tags: frame.tags,
    coverage: frame.coverage,
    children,
  };
  if (text) {
    node.ownText = decodeViewTextMember(obj["ownText"], at(site, "ownText"));
    node.subtreeText = decodeViewTextMember(
      obj["subtreeText"],
      at(site, "subtreeText"),
    );
  }
  return node;
}

/** One import entry: `{"range", "name", "target"}` exactly (11.4, 12.7). */
function decodeViewImportEntry(
  value: unknown,
  site: DecodeSite,
): ViewImportEntry {
  const obj = expectObject(value, site);
  expectOnlyMembers(obj, ["range", "name", "target"], site);
  const nameValue = requiredMember(obj, "name", site);
  const targetSite = at(site, "target");
  const targetDatum = decodeDatum(obj["target"], targetSite, decodePathValue);
  if (targetDatum.state === "null") {
    formFail(
      targetSite,
      "the import's resolved target — a path value where specifier form " +
        "and discovery define one, the unavailability marker otherwise, " +
        "never null (SPEC 11.4, 11.2, 12.7)",
      null,
    );
  }
  return {
    range: decodeRangeForm(requiredKey(obj, "range", site), at(site, "range")),
    name:
      nameValue === null
        ? null
        : expectNonEmptyString(nameValue, at(site, "name")),
    target:
      targetDatum.state === "value"
        ? targetDatum.value
        : { unavailable: true as const },
  };
}

/**
 * The full `view` document (SPEC 11.4) — `{"findings", "views"}` exactly,
 * each per-file view `{"file", "root", "imports", "occurrences", "comments"}`
 * exactly, decoded in the literal 12.7 forms (H-3: form-exact, never
 * adjustable to a product's shape). `text` states whether the invocation
 * carried `--text`: the node text members must be present exactly then
 * (12.7's stated conditional presence). Enforced orders: per-file views by
 * file path bytes, strictly ascending (the requested files form a set,
 * 11.4); per file, imports and comments in document order and occurrence
 * records in document order over distinct spans (5.7), each record's `file`
 * equal to the view's file (11.4: the FILE's occurrence records).
 */
export function decodeViewReport(
  doc: unknown,
  options: { readonly text: boolean },
  context?: string,
): ViewReport {
  assertUnavailabilityMarkerForms(doc, context);
  const site = rootSite("12.7 view document", context);
  const obj = expectObject(doc, site);
  expectOnlyMembers(obj, ["findings", "views"], site);
  const findings = decodeFindingsArray(
    requiredKey(obj, "findings", site),
    at(site, "findings"),
  );
  const viewsSite = at(site, "views");
  const views = expectArray(requiredKey(obj, "views", site), viewsSite).map(
    (element, index): FileView => {
      const entrySite = at(viewsSite, index);
      const entry = expectObject(element, entrySite);
      expectOnlyMembers(entry, VIEW_FILE_ENTRY_MEMBERS, entrySite);
      const file = decodePathValue(
        requiredKey(entry, "file", entrySite),
        at(entrySite, "file"),
      );
      const root = decodeViewNodeForm(
        requiredKey(entry, "root", entrySite),
        at(entrySite, "root"),
        options.text,
      );
      const importsSite = at(entrySite, "imports");
      const imports = expectArray(
        requiredKey(entry, "imports", entrySite),
        importsSite,
      ).map((importValue, importIndex) =>
        decodeViewImportEntry(importValue, at(importsSite, importIndex)),
      );
      for (let i = 1; i < imports.length; i += 1) {
        if (imports[i - 1]!.range.start >= imports[i]!.range.start) {
          formFail(
            at(importsSite, i),
            "import declarations in document order — ranges strictly " +
              "ascending by start (SPEC 11.4, 12.7)",
            entry["imports"],
          );
        }
      }
      const occurrencesSite = at(entrySite, "occurrences");
      const occurrences = expectArray(
        requiredKey(entry, "occurrences", entrySite),
        occurrencesSite,
      ).map((recordValue, recordIndex) => {
        const recordSite = at(occurrencesSite, recordIndex);
        const record = decodeOccurrenceRecordForm(recordValue, recordSite);
        if (
          Buffer.compare(pathValueBytes(record.file), pathValueBytes(file)) !==
          0
        ) {
          formFail(
            at(recordSite, "file"),
            `the viewed file's own occurrence records — each record's file ` +
              `equals the view's file (SPEC 11.4, 12.7); the view is of ` +
              `${JSON.stringify(renderPathValue(file))}`,
            recordValue,
          );
        }
        return record;
      });
      for (let i = 1; i < occurrences.length; i += 1) {
        const previous = occurrences[i - 1]!;
        const current = occurrences[i]!;
        const ordered =
          previous.range.start < current.range.start ||
          (previous.range.start === current.range.start &&
            previous.range.end < current.range.end);
        if (!ordered) {
          formFail(
            at(occurrencesSite, i),
            "occurrence records in document order over distinct spans — " +
              "(start, end) strictly ascending (SPEC 5.7, 11.4, 12.7)",
            entry["occurrences"],
          );
        }
      }
      const commentsSite = at(entrySite, "comments");
      const comments = expectArray(
        requiredKey(entry, "comments", entrySite),
        commentsSite,
      ).map((commentValue, commentIndex) =>
        decodeRangeForm(commentValue, at(commentsSite, commentIndex)),
      );
      for (let i = 1; i < comments.length; i += 1) {
        if (comments[i - 1]!.start >= comments[i]!.start) {
          formFail(
            at(commentsSite, i),
            "comment ranges in document order — strictly ascending by " +
              "start (SPEC 11.4, 12.7)",
            entry["comments"],
          );
        }
      }
      return { file, root, imports, occurrences, comments };
    },
  );
  for (let i = 1; i < views.length; i += 1) {
    if (
      Buffer.compare(
        pathValueBytes(views[i - 1]!.file),
        pathValueBytes(views[i]!.file),
      ) >= 0
    ) {
      formFail(
        at(viewsSite, i),
        "per-file views ordered by byte order of workspace-relative path — " +
          "the requested files form a set, so the order is strict " +
          "(SPEC 11.4, 12.7)",
        obj["views"],
      );
    }
  }
  return { findings, views };
}

// --- the rename/move preview document (6.6, 12.7) -----------------------------

/** One `mapping` entry: `{"from", "to"}` exactly, identities are strings. */
function decodePreviewMappingPair(
  value: unknown,
  site: DecodeSite,
): AppliedMappingPair {
  const obj = expectObject(value, site);
  expectOnlyMembers(obj, ["from", "to"], site);
  return {
    from: expectNonEmptyString(
      requiredKey(obj, "from", site),
      at(site, "from"),
    ),
    to: expectNonEmptyString(requiredKey(obj, "to", site), at(site, "to")),
  };
}

/** One edit: `{"class", "range"}` exactly — class-plus-range only (6.6). */
function decodePreviewEdit(value: unknown, site: DecodeSite): PreviewEdit {
  const obj = expectObject(value, site);
  expectOnlyMembers(obj, ["class", "range"], site);
  return {
    class: expectToken(
      requiredKey(obj, "class", site),
      PREVIEW_EDIT_CLASSES,
      at(site, "class"),
    ),
    range: decodeRangeForm(requiredKey(obj, "range", site), at(site, "range")),
  };
}

/**
 * The pinned edit order (SPEC 12.7): by range start, then range end, then
 * class-name BYTES — the final tie-break `import-addition` before
 * `target-insertion` on coinciding zero-length insertion points (T6.6-4).
 * 12.7 states no collapse rule for edits, so equal keys are admitted by the
 * order check (content is the tests' business).
 */
function comparePreviewEdits(a: PreviewEdit, b: PreviewEdit): number {
  if (a.range.start !== b.range.start) return a.range.start - b.range.start;
  if (a.range.end !== b.range.end) return a.range.end - b.range.end;
  return compareStringBytes(a.class, b.class);
}

/** One `files` entry: `{"file", "edits"}` exactly, edits in the 12.7 order. */
function decodePreviewFileEntry(
  value: unknown,
  site: DecodeSite,
): PreviewFileEntry {
  const obj = expectObject(value, site);
  expectOnlyMembers(obj, ["file", "edits"], site);
  const file = decodePathValue(
    requiredKey(obj, "file", site),
    at(site, "file"),
  );
  const editsSite = at(site, "edits");
  const edits = expectArray(requiredKey(obj, "edits", site), editsSite).map(
    (element, index) => decodePreviewEdit(element, at(editsSite, index)),
  );
  for (let i = 1; i < edits.length; i += 1) {
    if (comparePreviewEdits(edits[i - 1]!, edits[i]!) > 0) {
      formFail(
        at(editsSite, i),
        "edits ordered by range start, then range end, then class-name " +
          "bytes (SPEC 12.7)",
        obj["edits"],
      );
    }
  }
  return { file, edits };
}

/** One delta direction: 12.7 path values in byte order, one per path. */
function decodeDeltaDirection(value: unknown, site: DecodeSite): PathValue[] {
  const paths = expectArray(value, site).map((element, index) =>
    decodePathValue(element, at(site, index)),
  );
  for (let i = 1; i < paths.length; i += 1) {
    const order = Buffer.compare(
      pathValueBytes(paths[i - 1]!),
      pathValueBytes(paths[i]!),
    );
    if (order === 0) {
      formFail(
        at(site, i),
        "one entry per derived path — a direction of the delta is a set of " +
          "paths (SPEC 6.6)",
        value,
      );
    }
    if (order > 0) {
      formFail(
        at(site, i),
        "the direction's paths in byte order (SPEC 12.7)",
        value,
      );
    }
  }
  return paths;
}

/** The delta value form: `{"generated", "removed"}` exactly (6.6, 12.7). */
function decodePreviewDelta(value: unknown, site: DecodeSite): PreviewDelta {
  const obj = expectObject(value, site);
  expectOnlyMembers(obj, ["generated", "removed"], site);
  return {
    generated: decodeDeltaDirection(
      requiredKey(obj, "generated", site),
      at(site, "generated"),
    ),
    removed: decodeDeltaDirection(
      requiredKey(obj, "removed", site),
      at(site, "removed"),
    ),
  };
}

/**
 * The `rename`/`move` preview document (SPEC 6.6) — `{"findings", "mapping",
 * "files", "delta"}` exactly (SPEC 12.7). Form-exact (H-3): `mapping` one
 * `{"from", "to"}` per mapped identity, ordered by `from` bytes; `files` one
 * `{"file", "edits"}` per file, ordered by file path bytes, each edit
 * `{"class", "range"}` with one of the ten 12.7 class names, edits ordered
 * by range start, then range end, then class-name bytes; `delta`
 * `{"generated", "removed"}` with each direction's paths in byte order, or
 * unavailable as one datum (14.23). On refusal `mapping`, `files`, and
 * `delta` are `null` — all three together: a refused preview reports the
 * refusal findings alone (6.6), so a document with some but not all of them
 * `null` matches neither the refusal nor the success encoding and rejects.
 */
export function decodePreviewReport(
  doc: unknown,
  context?: string,
): PreviewReport {
  assertUnavailabilityMarkerForms(doc, context);
  const site = rootSite("12.7 preview document", context);
  const obj = expectObject(doc, site);
  expectOnlyMembers(obj, ["findings", "mapping", "files", "delta"], site);
  const findings = decodeFindingsArray(
    requiredKey(obj, "findings", site),
    at(site, "findings"),
  );

  const mappingValue = requiredMember(obj, "mapping", site);
  let mapping: AppliedMappingPair[] | null = null;
  if (mappingValue !== null) {
    const mappingSite = at(site, "mapping");
    mapping = expectArray(mappingValue, mappingSite).map((element, index) =>
      decodePreviewMappingPair(element, at(mappingSite, index)),
    );
    for (let i = 1; i < mapping.length; i += 1) {
      const order = compareStringBytes(mapping[i - 1]!.from, mapping[i]!.from);
      if (order === 0) {
        formFail(
          at(mappingSite, i),
          'one {"from", "to"} per mapped identity (SPEC 12.7)',
          mappingValue,
        );
      }
      if (order > 0) {
        formFail(
          at(mappingSite, i),
          "mapping entries ordered by `from` bytes (SPEC 12.7)",
          mappingValue,
        );
      }
    }
  }

  const filesValue = requiredMember(obj, "files", site);
  let files: PreviewFileEntry[] | null = null;
  if (filesValue !== null) {
    const filesSite = at(site, "files");
    files = expectArray(filesValue, filesSite).map((element, index) =>
      decodePreviewFileEntry(element, at(filesSite, index)),
    );
    for (let i = 1; i < files.length; i += 1) {
      const order = Buffer.compare(
        pathValueBytes(files[i - 1]!.file),
        pathValueBytes(files[i]!.file),
      );
      if (order === 0) {
        formFail(
          at(filesSite, i),
          'one {"file", "edits"} per file (SPEC 12.7)',
          filesValue,
        );
      }
      if (order > 0) {
        formFail(
          at(filesSite, i),
          "file entries ordered by file path bytes (SPEC 12.7)",
          filesValue,
        );
      }
    }
  }

  const deltaDatum = decodeDatum(
    obj["delta"],
    at(site, "delta"),
    (value, valueSite) => decodePreviewDelta(value, valueSite),
  );
  const delta: PreviewDeltaDatum | null =
    deltaDatum.state === "null"
      ? null
      : deltaDatum.state === "unavailable"
        ? { unavailable: true as const }
        : deltaDatum.value;

  const nullCount = [mapping, files, delta].filter(
    (member) => member === null,
  ).length;
  if (nullCount !== 0 && nullCount !== 3) {
    formFail(
      site,
      "`mapping`, `files`, and `delta` null together (the refusal " +
        "encoding) or none of them null (a successful preview's plan) — " +
        "SPEC 6.6, 12.7",
      doc,
    );
  }
  return { findings, mapping, files, delta };
}

// --- the unavailability-marker structural walk (T12.7-1) -----------------------

/**
 * Walk a decoded JSON document and assert 12.7's marker uniqueness: no
 * object of any form other than the unavailability marker carries a member
 * named `unavailable` — every object with that member is exactly
 * `{"unavailable": true}`. Diagnoses name the offending JSON path.
 *
 * Every public document decoder in this module runs this walk over the
 * whole raw document before decoding members (the scoped decoders included,
 * whose unread members the walk still covers), and every adjustable adapter
 * (query.ts, review.ts, reports.ts, operations.ts) runs it through
 * {@link documentRootSite} at each of its document-decode entries, so it
 * runs over every JSON document the suite captures — the pinned 12.7
 * document forms and the unpinned-shape surfaces of H-3 alike, the marker's
 * exclusivity being universal like the value forms (T12.7-1; S-5 guards the
 * walk and both integrations). Tests may additionally call it directly.
 */
export function assertUnavailabilityMarkerForms(
  doc: unknown,
  context?: string,
): void {
  // H-11: an explicit stack, never native recursion per nesting level — the
  // documents this walk covers include `view` towers 4096 sections deep
  // (P-8, P-11), past V8's frame budget; no depth cap of any kind. The visit
  // order is a recursive descent's: each value before its members, array
  // elements by index and object members in property order, each subtree
  // completely before the next sibling.
  const pending: { readonly value: unknown; readonly site: DecodeSite }[] = [
    { value: doc, site: rootSite("12.7 unavailability-marker walk", context) },
  ];
  while (pending.length > 0) {
    const { value, site } = pending.pop()!;
    if (Array.isArray(value)) {
      for (let index = value.length - 1; index >= 0; index -= 1) {
        pending.push({ value: value[index], site: at(site, index) });
      }
      continue;
    }
    if (typeof value !== "object" || value === null) continue;
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
    const entries = Object.entries(obj);
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const [key, member] = entries[index]!;
      pending.push({ value: member, site: at(site, key) });
    }
  }
}

/**
 * The document-decode entry of an adjustable H-3 adapter (query.ts,
 * review.ts, reports.ts, operations.ts): run the 12.7 marker walk over the
 * whole raw document — the members the adapter reads, the ones it ignores,
 * and the product-shaped ones it passes through whole alike — then return
 * the root site the adapter decodes from. 12.7's value forms are universal
 * (H-3), so the marker's exclusivity binds on an unpinned-shape surface
 * exactly as on a pinned document form: an object of any other form
 * carrying a member named `unavailable` fails loudly at every adapter, never
 * decoding (T12.7-1; S-5 guards the integration). The diagnosis names the
 * adapter and its context.
 */
export function documentRootSite(
  doc: unknown,
  adapter: string,
  context?: string,
): DecodeSite {
  const site = rootSite(adapter, context);
  assertUnavailabilityMarkerForms(doc, site.adapter);
  return site;
}
