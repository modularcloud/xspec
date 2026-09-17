// TEST-SPEC §1.4 (ID segments and tags) — SUITE-03: T1.4-1 … T1.4-4.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), decodes output through the H-3 adapters,
// and rejects a product only via diagnosed assertion failures (H-8).
//
// Byte-exact staging (HARNESS-01): every character under test — raw control
// bytes included — is written into the fixture's source bytes exactly as the
// arm declares it (UTF-8 encoded, no BOM, no newline translation), so the
// fixtures stay valid UTF-8 and segment/tag validity (14.4) — never source
// encoding (14.20) — is the condition at stake. In this module's own source
// the characters are constructed from hex code points (visible, tool-safe,
// immune to editor/formatter normalization); the builder encodes the
// resulting strings to the identical raw bytes.
//
// CONF-VALID in-scope: T1.4-1, T1.4-2, T1.4-4 (CERTIFICATIONS.md
// §CONF-VALID). Their fixtures stay within that entry's scope — one
// configured spec group of `.mdx` sources whose sections carry `id`/`tags`
// props only; the command surface is `build` (14.4 reporting) plus
// `query node`, decoded through the minimal identity/tags summary adapter so
// nothing beyond the entry's scoped query surface (identity, tags,
// metadataHash) is demanded of the fixture product. Certification staging
// constraints honored here:
//   - T1.4-1 stages none of U+00A0/U+0085/U+2028 (§VIOL-VALID-WIDE expects
//     T1.4-1 to keep passing under that violator);
//   - non-whitespace control characters appear only in T1.4-1's control arms
//     and T1.4-4's control tag arms (§VIOL-VALID-CTRL).
// T1.4-3 is in no certification entry's scope: it exercises the generated
// module under standard TypeScript tooling (HARNESS-05, SPEC 13.1).
//
// Location assertions follow the SUITE-02 discipline, pinned exactly: each
// fixture is assembled from parts with exactly known bytes (`assemble`), and
// every negative arm asserts that its 14.4 finding locates exactly the
// offending attribute's own characters — the `id`/`tags` name through the
// closing quote, the attribute range of SPEC 11.4 that an attribute condition
// locates (SPEC 14; T14-11) — one finding per offending attribute, however
// many segments or tokens of its value violate 1.4.
//
// Verbatim reading (SPEC 2.4): a quoted attribute value is the characters
// between its delimiters exactly as spelled, so the six-character escape
// spelling of `.` (a backslash followed by `u002E`) and the character
// reference `&#46;` are a segment containing `\` or `&` — condition 4, never
// the two-segment ID `a.b` — and the escape spelling of `y` (a backslash then
// `u0079`) a tag containing `\`, never the tag `xy`. Those spellings are built
// here from the backslash's code point, so no tool layer decodes them on the
// way into this file, and the arms staging them assert exactly one 14.4
// finding: a product interpreting the escape or the reference reads a
// different ID or tag — the two-segment `a.b`, structurally invalid at the
// top level (SPEC 1.3), or the accepted tag `xy` — and fails the arm.

import type { Finding, SourceRange } from "../../helpers/adapters/index.js";
import { decodeNodeSummary } from "../../helpers/adapters/index.js";
import { fail } from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import {
  assertCompileErrorAt,
  assertNoCompileErrors,
  ConsumerProject,
} from "../../helpers/tooling.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import {
  assertConditionCounts,
  assertSameJson,
  buildFindings,
  buildOk,
  runJson,
} from "./support.js";

// Minimal declarative configuration (SPEC 7): exactly one spec group — the
// CONF-VALID scope.
const SPECS_ONLY_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`;

// --- character classes under test (SPEC 1.4, exact) -------------------------

/** `U+XXXX` rendering for arm names and diagnostics. */
function codePointName(codePoint: number): string {
  return `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
}

/** The character under test placed between two ordinary letters. */
function between(codePoint: number): string {
  return `a${String.fromCodePoint(codePoint)}b`;
}

/** SPEC 1.4's whitespace class — exactly these six characters. */
const WHITESPACE_CHARACTERS: readonly (readonly [number, string])[] = [
  [0x0009, "tab"],
  [0x000a, "line feed"],
  [0x000b, "vertical tab"],
  [0x000c, "form feed"],
  [0x000d, "carriage return"],
  [0x0020, "space"],
];

/** Control-class representatives (SPEC 1.4: U+0000–U+001F and U+007F). */
const CONTROL_REPRESENTATIVES: readonly number[] = [0x0000, 0x001f, 0x007f];

/** The forbidden segment names of SPEC 1.4, all five. */
const FORBIDDEN_NAMES: readonly string[] = [
  "$",
  "__proto__",
  "prototype",
  "constructor",
  "then",
];

/**
 * The boundary code points SPEC 1.4 excludes from both character classes:
 * U+00A0 (no-break space), U+0085 (next line), U+2028 (line separator).
 */
const BOUNDARY_CODE_POINTS: readonly (readonly [number, string])[] = [
  [0x00a0, "no-break space"],
  [0x0085, "next line"],
  [0x2028, "line separator"],
];

/** The backslash, built from its code point (see the module header). */
const BACKSLASH = String.fromCodePoint(0x5c);

/** An attribute value's delimiter — either quote kind (SPEC 2.7). */
type QuoteKind = '"' | "'";

/**
 * The quote, escape, and character-reference characters SPEC 1.4 forbids in
 * segments and tags — `"` `'` `\` `&` — each staged in the quote kind that
 * keeps the value spellable: a `"` inside a single-quoted value, the rest
 * double-quoted.
 */
interface ForbiddenCharacterClass {
  readonly name: string;
  readonly character: string;
  readonly quote: QuoteKind;
}

const QUOTE_ESCAPE_REFERENCE_CHARACTERS: readonly ForbiddenCharacterClass[] = [
  {
    name: 'the double quote `"` (single-quoted value)',
    character: '"',
    quote: "'",
  },
  { name: "the single quote `'`", character: "'", quote: '"' },
  {
    name: "the escape character (backslash)",
    character: BACKSLASH,
    quote: '"',
  },
  { name: "the character-reference character `&`", character: "&", quote: '"' },
];

/** U+FFFD (REPLACEMENT CHARACTER), which no argument value carries (SPEC 1.4, 12.0). */
const REPLACEMENT_CHARACTER = 0xfffd;

/**
 * Verbatim spellings (SPEC 2.4; module header): the six-character Unicode
 * escape and the decimal character reference an interpreting reader would
 * turn into `.`, and the escape it would turn into `y`. Read verbatim, each
 * is a value containing `\` or `&` — condition 4.
 */
const ESCAPE_SPELLED_DOT = `${BACKSLASH}u002E`;
const REFERENCE_SPELLED_DOT = "&#46;";
const ESCAPE_SPELLED_Y = `${BACKSLASH}u0079`;

// --- shared staging ----------------------------------------------------------

// Shared fixture template: a valid sibling first, so each offending attribute
// is a proper sub-range of the file and the location assertions have teeth —
// the sibling's own `id` attribute is a different range, so a finding
// attributed to the wrong attribute fails. Arms differ from one another only
// in the one segment or tag under test.
const SIBLING = '<S id="ok">\nA valid sibling section.\n</S>\n\n';

/** A fixture assembled from parts, with the pinned attributes' byte ranges. */
interface Assembled {
  readonly source: string;
  /** The pinned attributes' ranges in source order (SPEC 1.7 byte offsets). */
  readonly pinned: readonly SourceRange[];
}

/**
 * Assemble a fixture from string parts; a `{ pin }` part is an attribute
 * whose own characters — name through closing quote — are pinned as the
 * range a 14.4 finding on it must locate (SPEC 14, 11.4). Each offset is the
 * UTF-8 byte length of the text before the pinned part (SPEC 1.7).
 */
function assemble(
  parts: readonly (string | { readonly pin: string })[],
): Assembled {
  let source = "";
  const pinned: SourceRange[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      source += part;
      continue;
    }
    const start = Buffer.byteLength(source, "utf8");
    pinned.push({ start, end: start + Buffer.byteLength(part.pin, "utf8") });
    source += part.pin;
  }
  return { source, pinned };
}

/** One section after the sibling whose `id` attribute is under test. */
function segmentStaging(segment: string, quote: QuoteKind = '"'): Assembled {
  return assemble([
    `${SIBLING}<S `,
    { pin: `id=${quote}${segment}${quote}` },
    ">\nSection with the segment under test.\n</S>\n",
  ]);
}

/** One section after the sibling whose `tags` attribute is under test. */
function tagStaging(tags: string, quote: QuoteKind = '"'): Assembled {
  return assemble([
    `${SIBLING}<S id="sec" `,
    { pin: `tags=${quote}${tags}${quote}` },
    ">\nTagged section.\n</S>\n",
  ]);
}

/** Stage one single-file workspace and collect its `build --json` findings. */
async function findingsOf(
  product: ProductBinding,
  source: string,
  context: string,
): Promise<readonly Finding[]> {
  const workspace = await TestWorkspace.create({
    files: { "xspec.config.ts": SPECS_ONLY_CONFIG, "specs/A.mdx": source },
  });
  try {
    return await buildFindings(product, workspace, context);
  } finally {
    await workspace.dispose();
  }
}

/**
 * Assert `build --json` reported exactly one 14.4 finding per pinned
 * attribute and nothing else, each finding locating exactly one range — its
 * attribute's own characters in `specs/A.mdx`, name through closing quote,
 * the attribute range of SPEC 11.4 (SPEC 14: file, location, condition
 * identity; T14-11). The ranges are compared as a multiset: which finding
 * comes first is 12.7's ordering, not this test's concern.
 */
function assertOnly144AtAttributes(
  findings: readonly Finding[],
  attributes: readonly SourceRange[],
  context: string,
): void {
  assertConditionCounts(findings, { "14.4": attributes.length }, context);
  const got = findings.map((finding) => {
    if (finding.locations.length !== 1) {
      fail(
        `${context}: a 14.4 finding locates exactly one construct — the offending ` +
          "attribute (SPEC 14: one finding per offending `id`/`tags` attribute); got " +
          `${String(finding.locations.length)} locations (message: ` +
          `${JSON.stringify(finding.message)})`,
      );
    }
    const location = finding.locations[0]!;
    if (location.file !== "specs/A.mdx") {
      fail(
        `${context}: the 14.4 finding must locate in the workspace-relative source ` +
          `file (SPEC 14, 1.5, 12.7); expected "specs/A.mdx", got ` +
          `${JSON.stringify(location.file)} (message: ${JSON.stringify(finding.message)})`,
      );
    }
    return { start: location.range.start, end: location.range.end };
  });
  const byStart = (a: SourceRange, b: SourceRange): number => a.start - b.start;
  assertSameJson(
    [...got].sort(byStart),
    [...attributes].sort(byStart),
    `${context}: the 14.4 finding(s) locate exactly the offending attribute's own ` +
      "characters — name through closing quote, the attribute range of SPEC 11.4 — " +
      "as zero-based byte offsets, end-exclusive (SPEC 14, 1.7, 12.7)",
  );
}

/**
 * Run one negative arm over the shared template: `build --json` reports
 * exactly one finding, condition 14.4, located exactly at the one pinned
 * attribute.
 */
async function expectSingle144(
  product: ProductBinding,
  staged: Assembled,
  context: string,
): Promise<void> {
  const findings = await findingsOf(product, staged.source, context);
  assertOnly144AtAttributes(findings, staged.pinned, context);
}

// --- T1.4-1 ------------------------------------------------------------------

// The segment-validity matrix. Every representative is staged as its raw
// character between two ordinary letters (or as the whole segment, for the
// forbidden names) — the quote, escape, and character-reference characters
// and U+FFFD included (SPEC 1.4) — plus the two verbatim spellings of SPEC
// 2.4 (module header). U+00A0, U+0085, and U+2028 belong to neither 1.4
// class and are deliberately absent from this test — they are T1.4-2's (and
// §VIOL-VALID-WIDE's) subject.
interface SegmentArm {
  /** Which SPEC 1.4 rule this segment violates (failure diagnostics). */
  readonly name: string;
  readonly segment: string;
  /** The `id` value's delimiter — single quotes only where the segment holds `"`. */
  readonly quote?: QuoteKind;
}

const INVALID_SEGMENT_ARMS: readonly SegmentArm[] = [
  { name: '"#" in a segment', segment: "a#b" },
  ...WHITESPACE_CHARACTERS.map(([codePoint, label]) => ({
    name: `whitespace ${codePointName(codePoint)} (${label}) in a segment`,
    segment: between(codePoint),
  })),
  ...CONTROL_REPRESENTATIVES.map((codePoint) => ({
    name: `control character ${codePointName(codePoint)} in a segment`,
    segment: between(codePoint),
  })),
  ...FORBIDDEN_NAMES.map((name) => ({
    name: `forbidden name "${name}" as a segment`,
    segment: name,
  })),
  ...QUOTE_ESCAPE_REFERENCE_CHARACTERS.map(({ name, character, quote }) => ({
    name: `${name} in a segment`,
    segment: `a${character}b`,
    quote,
  })),
  {
    name: "U+FFFD (REPLACEMENT CHARACTER) in a segment",
    segment: between(REPLACEMENT_CHARACTER),
  },
  {
    name:
      "the verbatim escape spelling of `.` (a backslash then `u002E`) in a segment — " +
      "a segment containing the escape character, never the two-segment ID `a.b` " +
      "(SPEC 2.4)",
    segment: `a${ESCAPE_SPELLED_DOT}b`,
  },
  {
    name:
      "the verbatim character reference `&#46;` in a segment — a segment containing " +
      "`&`, never the two-segment ID `a.b` (SPEC 2.4)",
    segment: `a${REFERENCE_SPELLED_DOT}b`,
  },
];

// Empty segment, nested spelling: `a..b` is reachable only via the chain
// `a` → `a.` → `a..b`, where every level adds exactly one segment — 1.3 is
// satisfied and the empty segment (1.4 → 14.4) is the only condition staged.
// Both `a.` and `a..b` contain an empty segment, so both `id` attributes
// offend: one 14.4 finding per offending attribute, each located at its own
// attribute — the descendant spelling the malformed ancestor segment as its
// own prefix reports in its own attribute too (SPEC 14; T14-11).
const EMPTY_NESTED = assemble([
  `${SIBLING}<S id="a">\nAlpha.\n\n<S `,
  { pin: 'id="a."' },
  ">\nIntroduces the empty segment.\n\n<S ",
  { pin: 'id="a..b"' },
  ">\nNested under the empty segment.\n</S>\n</S>\n</S>\n",
]);

const T1_4_1 = defineProductTest({
  id: "T1.4-1",
  title:
    'segment validity matrix: empty segments (`a..b` via nesting and a lone `id=""`), `#`, each whitespace character, each control-class representative, each forbidden name, the quote, escape, and character-reference characters (`"` single-quoted, `\'`, backslash, `&`), and U+FFFD fail with 14.4, one finding per offending `id` attribute located exactly at it; the verbatim escape and character-reference spellings of `.` are segments containing the backslash and `&` — condition 4, never the two-segment ID `a.b` (SPEC 1.4, 2.4, 14, 14.4)',
  run: async (product) => {
    // Template control: the base workspace differs from every negative arm
    // only in the one segment, so each arm's 14.4 is attributable to the
    // segment alone, not to the template.
    const control = await TestWorkspace.create({
      files: {
        "xspec.config.ts": SPECS_ONLY_CONFIG,
        "specs/A.mdx": segmentStaging("okseg").source,
      },
    });
    try {
      await buildOk(
        product,
        control,
        "T1.4-1 `build` of the base template with a valid segment",
      );
    } finally {
      await control.dispose();
    }

    // Empty segment via nesting (`a..b`): two offending `id` attributes.
    const nestedContext =
      "T1.4-1 `build --json` over the nested empty segment (`a` -> `a.` -> `a..b`)";
    assertOnly144AtAttributes(
      await findingsOf(product, EMPTY_NESTED.source, nestedContext),
      EMPTY_NESTED.pinned,
      nestedContext,
    );

    // Empty segment as a lone empty id: one empty segment, so 1.3's
    // exactly-one-segment top-level rule holds and 14.4 alone reports.
    await expectSingle144(
      product,
      segmentStaging(""),
      'T1.4-1 `build --json` over a lone empty `id=""`',
    );

    for (const arm of INVALID_SEGMENT_ARMS) {
      await expectSingle144(
        product,
        segmentStaging(arm.segment, arm.quote),
        `T1.4-1 \`build --json\` with ${arm.name}`,
      );
    }
  },
});

// --- T1.4-2 ------------------------------------------------------------------

/** One section per boundary code point; IDs differ in the middle character. */
const BOUNDARY_SEGMENT_IDS: readonly string[] = BOUNDARY_CODE_POINTS.map(
  ([codePoint]) => between(codePoint),
);

const BOUNDARY_SEGMENTS_SOURCE = BOUNDARY_CODE_POINTS.map(
  ([codePoint, label]) =>
    `<S id="${between(codePoint)}">\nSegment containing the ${label} character.\n</S>\n`,
).join("\n");

const T1_4_2 = defineProductTest({
  id: "T1.4-2",
  title:
    "segments containing U+00A0, U+0085, and U+2028 are valid — SPEC 1.4 excludes them from both character classes: builds succeed and the nodes are queryable by identity (SPEC 1.4)",
  run: async (product) => {
    const workspace = await TestWorkspace.create({
      files: {
        "xspec.config.ts": SPECS_ONLY_CONFIG,
        "specs/A.mdx": BOUNDARY_SEGMENTS_SOURCE,
      },
    });
    try {
      await buildOk(
        product,
        workspace,
        "T1.4-2 `build` over segments containing U+00A0, U+0085, and U+2028",
      );
      for (const id of BOUNDARY_SEGMENT_IDS) {
        const identity = `specs/A.mdx#${id}`;
        const label = `T1.4-2 \`query node\` addressing ${JSON.stringify(identity)}`;
        const summary = decodeNodeSummary(
          await runJson(product, workspace, ["query", "node", identity], label),
          label,
        );
        if (summary.identity !== identity) {
          fail(
            `${label}: the node must be queryable by its identity (SPEC 1.4, 1.5); ` +
              `expected identity ${JSON.stringify(identity)}, got ` +
              JSON.stringify(summary.identity),
          );
        }
      }
    } finally {
      await workspace.dispose();
    }
  },
});

// --- T1.4-3 ------------------------------------------------------------------

// A valid non-identifier segment, exposed via bracket notation in the
// generated module (SPEC 2.4/4.1) — exercised under standard TypeScript
// tooling with no xspec runtime dependency (SPEC 13.1, HARNESS-05). The
// bracket consumer must compile cleanly (the property type-checks and
// resolves); the dot consumer must fail at `login` — `SPEC.login-v2` parses
// as `(SPEC.login) - v2`, so no dot spelling can name the `login-v2`
// property, and against a conforming skeleton `login` is no property at all.
// The pair also discriminates an `any`-typed default export (both consumers
// would compile, but the dot consumer would carry no error at `login`).
const DASH_SEGMENT_SOURCE = '<S id="login-v2">\nDashed segment.\n</S>\n';

const BRACKET_CONSUMER = [
  'import SPEC from "./specs/A.xspec";',
  "",
  'SPEC["login-v2"];',
  "",
].join("\n");

const DOT_CONSUMER = [
  'import SPEC from "./specs/A.xspec";',
  "",
  "SPEC.login-v2;",
  "",
].join("\n");

const T1_4_3 = defineProductTest({
  id: "T1.4-3",
  title:
    'a non-identifier segment like `login-v2` is valid; the generated module exposes it via bracket notation — `SPEC["login-v2"]` type-checks and resolves, dot access is a type error (SPEC 1.4, 2.4, 4.1)',
  run: async (product) => {
    const workspace = await TestWorkspace.create({
      files: {
        "xspec.config.ts": SPECS_ONLY_CONFIG,
        "specs/A.mdx": DASH_SEGMENT_SOURCE,
      },
    });
    try {
      await buildOk(
        product,
        workspace,
        "T1.4-3 `build` over the non-identifier segment `login-v2`",
      );
      await workspace.file("consumer.ts", BRACKET_CONSUMER);
      await workspace.file("dot-consumer.ts", DOT_CONSUMER);
      const bracket = await ConsumerProject.load({
        rootDir: workspace.root,
        rootFiles: ["consumer.ts"],
      });
      assertNoCompileErrors(
        bracket,
        'T1.4-3 consumer accessing SPEC["login-v2"] via bracket notation (SPEC 2.4, 4.1)',
      );
      const dot = await ConsumerProject.load({
        rootDir: workspace.root,
        rootFiles: ["dot-consumer.ts"],
      });
      assertCompileErrorAt(
        dot,
        dot.locate("dot-consumer.ts", "SPEC.login-v2", {
          charOffset: "SPEC.".length,
        }),
        {},
        "T1.4-3 dot access to the non-identifier segment (`SPEC.login-v2` cannot name " +
          "the `login-v2` property — a type error, SPEC 1.4/4.1)",
      );
    } finally {
      await workspace.dispose();
    }
  },
});

// --- T1.4-4 ------------------------------------------------------------------

// Tags follow the segment rules except `.` is allowed. The boundary code
// points of T1.4-2 apply to tags too — and since none of the three is 1.4
// whitespace, 2.6 splitting must not split on them: each staged value is
// exactly one tag, asserted exactly (a product splitting on U+00A0 would
// report two tags; §VIOL-VALID-WIDE rejects the value outright at `build`).
// The empty and whitespace rules of 1.4 admit no invalid-tag fixture: `tags`
// splits on runs of 1.4 whitespace with leading/trailing whitespace ignored
// (2.6), so no tag token can be empty or contain whitespace — whitespace-only
// values behave as omitted (T2.6-2), and the whitespace control characters
// U+0009–U+000D are split away as separators. The quote, escape, and
// character-reference characters and U+FFFD are invalid in a tag as in a
// segment, and the escape spelling of `y` is read verbatim (module header).
interface TagArm {
  readonly name: string;
  readonly tag: string;
  /** The `tags` value's delimiter — single quotes only where the tag holds `"`. */
  readonly quote?: QuoteKind;
}

const VALID_TAG_ARMS: readonly TagArm[] = [
  { name: 'a tag containing "." (valid for tags)', tag: "a.b" },
  ...BOUNDARY_CODE_POINTS.map(([codePoint, label]) => ({
    name: `a tag containing ${codePointName(codePoint)} (${label})`,
    tag: between(codePoint),
  })),
];

const INVALID_TAG_ARMS: readonly TagArm[] = [
  { name: 'a tag containing "#"', tag: "a#b" },
  { name: 'a tag that is the forbidden name "__proto__"', tag: "__proto__" },
  ...([0x0000, 0x007f] as const).map((codePoint) => ({
    name: `a tag containing the non-whitespace control character ${codePointName(codePoint)}`,
    tag: between(codePoint),
  })),
  ...QUOTE_ESCAPE_REFERENCE_CHARACTERS.map(({ name, character, quote }) => ({
    name: `a tag containing ${name}`,
    tag: `x${character}y`,
    quote,
  })),
  {
    name: "a tag containing U+FFFD (REPLACEMENT CHARACTER)",
    tag: `x${String.fromCodePoint(REPLACEMENT_CHARACTER)}y`,
  },
  {
    name:
      "the verbatim escape spelling of `y` (`x`, a backslash, then `u0079`) — a tag " +
      "containing the escape character, never the tag `xy` (SPEC 2.4)",
    tag: `x${ESCAPE_SPELLED_Y}`,
  },
];

const T1_4_4 = defineProductTest({
  id: "T1.4-4",
  title:
    "tags: `.` is valid; `#`, a forbidden name, non-whitespace control characters, the quote, escape, and character-reference characters (`\"` single-quoted, `'`, backslash, `&`), and U+FFFD fail with 14.4, one finding per offending `tags` attribute located exactly at it; the verbatim escape spelling of `y` is a tag containing the backslash — condition 4, never the tag `xy`; the T1.4-2 boundary code points are valid in tags and never split (SPEC 1.4, 2.4, 2.6, 14, 14.4)",
  run: async (product) => {
    for (const arm of VALID_TAG_ARMS) {
      const workspace = await TestWorkspace.create({
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          "specs/A.mdx": tagStaging(arm.tag).source,
        },
      });
      try {
        await buildOk(product, workspace, `T1.4-4 \`build\` with ${arm.name}`);
        const label = `T1.4-4 \`query node specs/A.mdx#sec\` (${arm.name})`;
        const summary = decodeNodeSummary(
          await runJson(
            product,
            workspace,
            ["query", "node", "specs/A.mdx#sec"],
            label,
          ),
          label,
        );
        assertSameJson(
          summary.tags,
          [arm.tag],
          `${label}: exactly the one staged tag — valid per SPEC 1.4, and not split ` +
            "(2.6 splits only on 1.4 whitespace, which excludes this code point)",
        );
      } finally {
        await workspace.dispose();
      }
    }
    for (const arm of INVALID_TAG_ARMS) {
      await expectSingle144(
        product,
        tagStaging(arm.tag, arm.quote),
        `T1.4-4 \`build --json\` with ${arm.name}`,
      );
    }
  },
});

/** TEST-SPEC §1.4, in canonical ID order (SUITE-03). */
export const section14Tests: readonly ProductTestEntry[] = [
  T1_4_1,
  T1_4_2,
  T1_4_3,
  T1_4_4,
];
