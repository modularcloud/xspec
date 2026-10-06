// TEST-SPEC §1.4 (ID segments and tags) — SUITE-03: T1.4-1 … T1.4-5.
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
//   - T1.4-1 stages neither U+00A0 nor U+0085 (§VIOL-VALID-WIDE expects
//     T1.4-1 to keep passing under that violator);
//   - T1.4-2's valid boundaries are U+00A0 and U+0085 alone: it stages
//     neither U+2028 nor U+2029, which 1.4's quote-and-escape bullet bars
//     (§VIOL-VALID-SEP expects T1.4-2 to keep passing under that violator);
//   - non-whitespace control characters appear only in T1.4-1's control arms
//     and T1.4-4's control tag arms (§VIOL-VALID-CTRL);
//   - U+2028 and U+2029 appear only in T1.4-1's and T1.4-4's one arm each
//     (§VIOL-VALID-SEP: each certified test fails on those arms alone).
// T1.4-3 is in no certification entry's scope: it exercises the generated
// module under standard TypeScript tooling (HARNESS-05, SPEC 13.1). Nor is
// T1.4-5 (CERTIFICATIONS.md's exclusions: its access arms ride the same
// tooling driver; its conversion arms are 6.4/6.5's rewrite byte contracts).
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

import { Buffer } from "node:buffer";
import type {
  Finding,
  GraphEdge,
  SourceRange,
} from "../../helpers/adapters/index.js";
import {
  decodeEdgesReport,
  decodeNodeSummary,
} from "../../helpers/adapters/index.js";
import { fail } from "../../helpers/assertions.js";
import {
  assertAddedImportInsertion,
  expectFreshIdentifier,
} from "../../helpers/import-insertion.js";
import { deriveMdx } from "../../helpers/mdx-derivability.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { stagedMdx } from "../../helpers/staged-mdx.js";
import type { StagedMdx } from "../../helpers/staged-mdx.js";
import { stagedTs } from "../../helpers/staged-ts.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import {
  assertCompileErrorAt,
  assertNoCompileErrors,
  ConsumerProject,
} from "../../helpers/tooling.js";
import { identifierRunAt } from "../../helpers/ts-identifiers.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import {
  assertConditionCounts,
  assertEdgeSetEqual,
  assertSameJson,
  buildFindings,
  buildOk,
  expectExit,
  expectFindingFreeReport,
  runJson,
} from "./support.js";

// Minimal declarative configuration (SPEC 7): exactly one spec group — the
// CONF-VALID scope, and T1.4-5's conversion arms'. A staged-source record
// (S-9's timing clause): the later arms' workspaces stage it after their
// body's first invocation.
const SPECS_ONLY_CONFIG = stagedTs(
  "T1.4-1/T1.4-4/T1.4-5 xspec.config.ts — the specs-only configuration of every arm workspace",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
);

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
 * The valid boundary code points (T1.4-2): U+00A0 (no-break space) and
 * U+0085 (next line), which SPEC 1.4 excludes from both character classes
 * and no rule of 1.4 bars. U+2028 and U+2029 belong to neither class either,
 * yet 1.4's quote-and-escape bullet bars both from every segment and tag:
 * they are T1.4-1's and T1.4-4's invalid arms, never valid ones here.
 */
const BOUNDARY_CODE_POINTS: readonly (readonly [number, string])[] = [
  [0x00a0, "no-break space"],
  [0x0085, "next line"],
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

/**
 * U+2028 (LINE SEPARATOR) and U+2029 (PARAGRAPH SEPARATOR): in neither 1.4
 * class (T1.4-2), yet barred from every segment and tag by 1.4's
 * quote-and-escape bullet — one invalid arm each in T1.4-1 and in T1.4-4,
 * each staged as the literal, validly encoded character (never an escape
 * spelling, which 2.4 reads verbatim as a value containing `\`).
 */
const LINE_SEPARATOR_CHARACTERS: readonly (readonly [number, string])[] = [
  [0x2028, "line separator"],
  [0x2029, "paragraph separator"],
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

/**
 * An assembled fixture registered as a staged-source record (S-9's timing
 * clause): every fixture this module stages after a body's first product
 * invocation — the matrix arms, the nested and lone empty segments — is
 * staged from `record`, which the S-9 self-test judged before any product
 * existed; `source` and `pinned` stay for the offset assertions.
 */
interface StagedAssembled extends Assembled {
  readonly record: StagedMdx;
}

/** Register an assembled fixture's source under `recordName`. */
function staged(recordName: string, assembled: Assembled): StagedAssembled {
  return { ...assembled, record: stagedMdx(recordName, assembled.source) };
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

/**
 * Stage one single-file workspace and collect its `build --json` findings.
 * `source` is a staged-source record wherever the calling body has already
 * invoked the product (S-9's timing clause); a body's first workspace may
 * stage plain contents.
 */
async function findingsOf(
  product: ProductBinding,
  source: string | StagedMdx,
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
  fixture: StagedAssembled,
  context: string,
): Promise<void> {
  const findings = await findingsOf(product, fixture.record, context);
  assertOnly144AtAttributes(findings, fixture.pinned, context);
}

// --- T1.4-1 ------------------------------------------------------------------

// The segment-validity matrix. Every representative is staged as its raw
// character between two ordinary letters (or as the whole segment, for the
// forbidden names) — the quote, escape, and character-reference characters,
// U+2028 and U+2029 (one arm each: 1.4's quote-and-escape bullet bars both,
// though neither is whitespace or a control character under 1.4, T1.4-2),
// and U+FFFD included (SPEC 1.4) — plus the two verbatim spellings of SPEC
// 2.4 (module header). U+00A0 and U+0085 belong to neither 1.4 class and no
// rule of 1.4 bars them: they are deliberately absent from this test — they
// are T1.4-2's (and §VIOL-VALID-WIDE's) subject.
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
  ...LINE_SEPARATOR_CHARACTERS.map(([codePoint, label]) => ({
    name: `${codePointName(codePoint)} (${label}) in a segment`,
    segment: between(codePoint),
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

// Every matrix arm's fixture, registered at module load in arm order — the
// template call the body used to make per arm, evaluated once here: the
// arms run after T1.4-1's template-control invocation, so each is a record
// the S-9 self-test judges before any product exists.
const INVALID_SEGMENT_FIXTURES = INVALID_SEGMENT_ARMS.map((arm) => ({
  arm,
  fixture: staged(
    `T1.4-1 arm ${arm.name} specs/A.mdx`,
    segmentStaging(arm.segment, arm.quote),
  ),
}));

// Empty segment, nested spelling: `a..b` is reachable only via the chain
// `a` → `a.` → `a..b`, where every level adds exactly one segment — 1.3 is
// satisfied and the empty segment (1.4 → 14.4) is the only condition staged.
// Both `a.` and `a..b` contain an empty segment, so both `id` attributes
// offend: one 14.4 finding per offending attribute, each located at its own
// attribute — the descendant spelling the malformed ancestor segment as its
// own prefix reports in its own attribute too (SPEC 14; T14-11).
const EMPTY_NESTED = staged(
  "T1.4-1 nested empty segment specs/A.mdx",
  assemble([
    `${SIBLING}<S id="a">\nAlpha.\n\n<S `,
    { pin: 'id="a."' },
    ">\nIntroduces the empty segment.\n\n<S ",
    { pin: 'id="a..b"' },
    ">\nNested under the empty segment.\n</S>\n</S>\n</S>\n",
  ]),
);

// The lone empty `id=""`, staged after the same invocation: a record too.
const LONE_EMPTY_SEGMENT = staged(
  'T1.4-1 lone empty id="" specs/A.mdx',
  segmentStaging(""),
);

const T1_4_1 = defineProductTest({
  id: "T1.4-1",
  title:
    'segment validity matrix: empty segments (`a..b` via nesting and a lone `id=""`), `#`, each whitespace character, each control-class representative, each forbidden name, the quote, escape, and character-reference characters (`"` single-quoted, `\'`, backslash, `&`), U+2028 and U+2029 (one arm each, between two letters), and U+FFFD fail with 14.4, one finding per offending `id` attribute located exactly at it; the verbatim escape and character-reference spellings of `.` are segments containing the backslash and `&` — condition 4, never the two-segment ID `a.b` (SPEC 1.4, 2.4, 14, 14.4)',
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
      await findingsOf(product, EMPTY_NESTED.record, nestedContext),
      EMPTY_NESTED.pinned,
      nestedContext,
    );

    // Empty segment as a lone empty id: one empty segment, so 1.3's
    // exactly-one-segment top-level rule holds and 14.4 alone reports.
    await expectSingle144(
      product,
      LONE_EMPTY_SEGMENT,
      'T1.4-1 `build --json` over a lone empty `id=""`',
    );

    for (const { arm, fixture } of INVALID_SEGMENT_FIXTURES) {
      await expectSingle144(
        product,
        fixture,
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

/** The staged boundary code points as `U+XXXX` names (diagnostics). */
const BOUNDARY_NAMES = BOUNDARY_CODE_POINTS.map(([codePoint]) =>
  codePointName(codePoint),
).join(" and ");

const T1_4_2 = defineProductTest({
  id: "T1.4-2",
  title:
    "segments containing U+00A0 and U+0085 are valid — SPEC 1.4 excludes them from both character classes and no rule of 1.4 bars them: builds succeed and the nodes are queryable by identity (U+2028 and U+2029, barred by 1.4's quote-and-escape bullet, are T1.4-1's and T1.4-4's invalid arms) (SPEC 1.4)",
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
        `T1.4-2 \`build\` over segments containing ${BOUNDARY_NAMES}`,
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

const BRACKET_CONSUMER = stagedTs(
  "T1.4-3 consumer.ts — bracket access to `login-v2`, staged after `build`",
  ['import SPEC from "./specs/A.xspec";', "", 'SPEC["login-v2"];', ""].join(
    "\n",
  ),
);

const DOT_CONSUMER = stagedTs(
  "T1.4-3 dot-consumer.ts — dot access to `login-v2`, staged after `build`",
  ['import SPEC from "./specs/A.xspec";', "", "SPEC.login-v2;", ""].join("\n"),
);

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

// Tags follow the segment rules except `.` is allowed. The valid boundary
// code points of T1.4-2, U+00A0 and U+0085, apply to tags too — and since
// neither is 1.4 whitespace, 2.6 splitting must not split on them: each
// staged value is exactly one tag, asserted exactly (a product splitting on
// U+00A0 would report two tags; §VIOL-VALID-WIDE rejects the value outright
// at `build`).
// The empty and whitespace rules of 1.4 admit no invalid-tag fixture: `tags`
// splits on runs of 1.4 whitespace with leading/trailing whitespace ignored
// (2.6), so no tag token can be empty or contain whitespace — whitespace-only
// values behave as omitted (T2.6-2), and the whitespace control characters
// U+0009–U+000D are split away as separators. The quote, escape, and
// character-reference characters, U+2028 and U+2029 (one arm each, 1.4's
// quote-and-escape bullet; neither is 1.4 whitespace, so 2.6 splitting keeps
// the staged value one tag and 14.4 alone rejects it), and U+FFFD are
// invalid in a tag as in a segment, and the escape spelling of `y` is read
// verbatim (module header).
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
  ...LINE_SEPARATOR_CHARACTERS.map(([codePoint, label]) => ({
    name: `a tag containing ${codePointName(codePoint)} (${label})`,
    tag: `x${String.fromCodePoint(codePoint)}y`,
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

// The tag arms' fixtures, registered at module load in arm order (the
// template calls the body used to make): the first valid arm's workspace is
// T1.4-4's first and the rest follow its invocations — the table converts
// uniformly — and every invalid arm runs after them (S-9's timing clause).
const VALID_TAG_FIXTURES = VALID_TAG_ARMS.map((arm) => ({
  arm,
  fixture: staged(`T1.4-4 arm ${arm.name} specs/A.mdx`, tagStaging(arm.tag)),
}));

const INVALID_TAG_FIXTURES = INVALID_TAG_ARMS.map((arm) => ({
  arm,
  fixture: staged(
    `T1.4-4 arm ${arm.name} specs/A.mdx`,
    tagStaging(arm.tag, arm.quote),
  ),
}));

const T1_4_4 = defineProductTest({
  id: "T1.4-4",
  title:
    "tags: `.` is valid; `#`, a forbidden name, non-whitespace control characters, the quote, escape, and character-reference characters (`\"` single-quoted, `'`, backslash, `&`), U+2028 and U+2029 (one arm each), and U+FFFD fail with 14.4, one finding per offending `tags` attribute located exactly at it; the verbatim escape spelling of `y` is a tag containing the backslash — condition 4, never the tag `xy`; the T1.4-2 boundary code points U+00A0 and U+0085 are valid in tags and never split (SPEC 1.4, 2.4, 2.6, 14, 14.4)",
  run: async (product) => {
    for (const { arm, fixture } of VALID_TAG_FIXTURES) {
      const workspace = await TestWorkspace.create({
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          "specs/A.mdx": fixture.record,
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
    for (const { arm, fixture } of INVALID_TAG_FIXTURES) {
      await expectSingle144(
        product,
        fixture,
        `T1.4-4 \`build --json\` with ${arm.name}`,
      );
    }
  },
});

// --- T1.4-5 ------------------------------------------------------------------

// Identifier by characters (TEST-SPEC T1.4-5; SPEC 1.4, 2.4, 4.1, 6.4, 6.5,
// 14.20). 1.4 makes "valid TypeScript identifier" a test of characters alone
// at the release and language level 14.20 fixes — TypeScript 5.9.3 at
// ESNext: the first character one that release admits to begin an
// identifier, each other one it admits to continue one. A reserved word is
// therefore one (2.4: a non-computed access's name is any identifier name
// the file's grammar admits there), and so is a non-ASCII letter; U+1C89
// (CYRILLIC CAPITAL LETTER TJE, a Unicode 16 letter) is not, though a
// runtime whose Unicode tables postdate 15.1 admits it to begin and to
// continue one; U+2EBF0 (a CJK ideograph of Unicode 15.1) is, at ESNext,
// though not at ES5. Three arms, each its own workspace:
// - (a) Access: dot access naming the reserved words `delete` and `default`
//   and the letter U+00E9 builds and checks clean from a spec source and a
//   code source alike, the complete `depends`, `embeds`, and `references`
//   edge set reported; and a consumer compiling the three dot spellings and
//   the quoted `SPEC["<U+1C89>x"]` type-checks under the tooling driver
//   (helpers/tooling.ts) at TypeScript 5.9.3 — whose program parses the
//   generated module too, so a product judging by its runtime's tables
//   whether a property name needs quoting, and leaving `<U+1C89>x` unquoted
//   where 5.9.3 cannot parse it, fails the compile (13.1).
// - (b) Conversion: section `m`, its `d` array holding the local references
//   `"delete"`, `"<U+00E9>"`, and `"n.2fa"` to origin nodes outside the moved
//   subtree, moves out of `specs/a.mdx` into the existing `specs/t.mdx`,
//   which lacks `a.mdx`'s module, so the references convert to imported form
//   through the target's added declaration in 6.4's fallback spellings: dot
//   access for the identifier-valid segments, the reserved word and the
//   non-ASCII letter included, and double-quoted computed access for `2fa`,
//   whose first character can only continue an identifier — the array's
//   brackets, commas, and spaces unchanged. The target's bytes are asserted
//   under T6.5-8's discipline (helpers/import-insertion.ts): composed from
//   the rules of 6.4/6.5 and 3 up to the fresh identifier, read off the
//   rewritten array, and the choice among the line-start admissible offsets.
// - (c) Release and language level: the same move over the local
//   references `"<U+1C89>x"` and `"<U+2EBF0>"` reads `<O>["<U+1C89>x"]` and
//   `<O>.<U+2EBF0>` — a product classing characters by its runtime's tables
//   writes `<O>.<U+1C89>x`, and one judging at ES5 `<O>["<U+2EBF0>"]`.
// The target holds an ESM block of its own, an import of `specs/k.mdx`'s
// module that its section references, so a line-start admissible offset
// stands beside it as at the file's end (the import-free target is
// T6.5-10's). The rewritten target must derive (S-9), and `check`, then
// `build`, are clean. The characters are built from their code points (the
// module header).
const E_ACUTE = String.fromCodePoint(0x00e9);
const TJE_X = `${String.fromCodePoint(0x1c89)}x`;
const IDEOGRAPH = String.fromCodePoint(0x2ebf0);

// Arm (a)'s configuration: one spec group and one code group (SPEC 7). The
// body's first workspace stages it before any invocation; a record all the
// same, as every T1.4-5 staging is.
const T1_4_5_ACCESS_CONFIG = stagedTs(
  "T1.4-5 xspec.config.ts — one spec group and one code group, arm (a)'s",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: {
    app: ["src/**/*.ts"]
  }
})
`,
);

const T1_4_5_B_SOURCE = stagedMdx(
  "T1.4-5 (a) specs/B.mdx — top-level sections delete, default, U+00E9, and U+1C89 then x",
  [
    '<S id="delete">',
    "Delete text.",
    "</S>",
    "",
    '<S id="default">',
    "Default text.",
    "</S>",
    "",
    `<S id="${E_ACUTE}">`,
    "Acute text.",
    "</S>",
    "",
    `<S id="${TJE_X}">`,
    "Tje text.",
    "</S>",
    "",
  ].join("\n"),
);

const T1_4_5_A_SOURCE = stagedMdx(
  "T1.4-5 (a) specs/A.mdx — importing B.mdx's module as B: d={B.delete}, {text(B.default)}, and d={B.<U+00E9>}",
  [
    'import B from "./B.xspec"',
    "",
    '<S id="uses" d={B.delete}>',
    "{text(B.default)}",
    "</S>",
    "",
    `<S id="acute" d={B.${E_ACUTE}}>`,
    "Acute dependent.",
    "</S>",
    "",
  ].join("\n"),
);

// The markers stand at module scope, so their edges are attributed to the
// file itself (SPEC 4.5, 4.6); the call records an `embeds` edge (4.3).
const T1_4_5_CODE_SOURCE = stagedTs(
  "T1.4-5 (a) src/c.ts — importing B.mdx's module as SPEC, { text }: the markers SPEC.delete and SPEC.<U+00E9>, the call text(SPEC.default)",
  [
    'import SPEC, { text } from "../specs/B.xspec";',
    "",
    "SPEC.delete;",
    `SPEC.${E_ACUTE};`,
    "text(SPEC.default);",
    "",
  ].join("\n"),
);

/** Arm (a)'s complete dependency-edge set (SPEC 2.2, 2.3, 4.3, 4.5, 5.2). */
const T1_4_5_ACCESS_EDGES: readonly GraphEdge[] = [
  { from: "specs/A.mdx#uses", to: "specs/B.mdx#delete", kind: "depends" },
  {
    from: "specs/A.mdx#acute",
    to: `specs/B.mdx#${E_ACUTE}`,
    kind: "depends",
  },
  { from: "specs/A.mdx#uses", to: "specs/B.mdx#default", kind: "embeds" },
  { from: "src/c.ts", to: "specs/B.mdx#default", kind: "embeds" },
  { from: "src/c.ts", to: "specs/B.mdx#delete", kind: "references" },
  { from: "src/c.ts", to: `specs/B.mdx#${E_ACUTE}`, kind: "references" },
];

// The consumer, staged after `build`: the three dot spellings and the
// quoted one, compiled against the generated module at TypeScript 5.9.3.
const T1_4_5_CONSUMER = stagedTs(
  'T1.4-5 (a) consumer.ts — SPEC.delete, SPEC.default, SPEC.<U+00E9>, and SPEC["<U+1C89>x"], staged after `build`',
  [
    'import SPEC from "./specs/B.xspec";',
    "",
    "SPEC.delete;",
    "SPEC.default;",
    `SPEC.${E_ACUTE};`,
    `SPEC["${TJE_X}"];`,
    "",
  ].join("\n"),
);

// Arms (b) and (c)'s target side: `specs/k.mdx`, whose module the target
// imports, and the target `specs/t.mdx`, holding no import of `a.mdx`'s
// module.
const T1_4_5_K_SOURCE = stagedMdx(
  "T1.4-5 (b)/(c) specs/k.mdx — the module the target imports",
  ['<S id="k">', "K text.", "</S>", ""].join("\n"),
);

const T1_4_5_TARGET_LINES: readonly string[] = [
  'import K from "./k.xspec"',
  "",
  '<S id="tgt" d={K.k}>',
  "Target text.",
  "</S>",
];

const T1_4_5_TARGET_SOURCE = stagedMdx(
  "T1.4-5 (b)/(c) specs/t.mdx — the existing target: an import of k.mdx's module, none of a.mdx's",
  [...T1_4_5_TARGET_LINES, ""].join("\n"),
);

/**
 * The target's expected post-move bytes WITHOUT the added import (SPEC 6.5,
 * 6.4, 3): `m` is top-level, so its text — its `d` array converted, its ID
 * unchanged — is inserted at the end of the file followed by U+000A, the
 * existing final line terminated (no preceding U+000A), every other byte
 * kept.
 */
function t145TargetBase(movedOpeningTag: string): string {
  return [
    ...T1_4_5_TARGET_LINES,
    movedOpeningTag,
    "Moved text.",
    "</S>",
    "",
  ].join("\n");
}

const T1_4_5_CONVERSION_ORIGIN = stagedMdx(
  'T1.4-5 (b) specs/a.mdx — section m\'s d array of the local references "delete", "<U+00E9>", and "n.2fa"',
  [
    '<S id="delete">',
    "Delete text.",
    "</S>",
    "",
    `<S id="${E_ACUTE}">`,
    "Acute text.",
    "</S>",
    "",
    '<S id="n">',
    "N text.",
    "",
    '<S id="n.2fa">',
    "Two-factor text.",
    "</S>",
    "</S>",
    "",
    `<S id="m" d={["delete", "${E_ACUTE}", "n.2fa"]}>`,
    "Moved text.",
    "</S>",
    "",
  ].join("\n"),
);

const T1_4_5_RELEASE_ORIGIN = stagedMdx(
  'T1.4-5 (c) specs/a.mdx — section m\'s d array of the local references "<U+1C89>x" and "<U+2EBF0>"',
  [
    `<S id="${TJE_X}">`,
    "Tje text.",
    "</S>",
    "",
    `<S id="${IDEOGRAPH}">`,
    "Ideograph text.",
    "</S>",
    "",
    `<S id="m" d={["${TJE_X}", "${IDEOGRAPH}"]}>`,
    "Moved text.",
    "</S>",
    "",
  ].join("\n"),
);

/** One conversion arm: (b) or (c). */
interface T145ConversionArm {
  readonly label: string;
  readonly origin: StagedMdx;
  /** The moved section's expected `d` attribute, rooted at `root`. */
  readonly attribute: (root: string) => string;
  /** That attribute in ASCII, for diagnoses. */
  readonly attributeForm: string;
  /** Why each entry reads as it does (6.4's fallback spellings, 1.4). */
  readonly why: string;
}

const T1_4_5_CONVERSION_ARMS: readonly T145ConversionArm[] = [
  {
    label: "(b) conversion",
    origin: T1_4_5_CONVERSION_ORIGIN,
    attribute: (root) =>
      `d={[${root}.delete, ${root}.${E_ACUTE}, ${root}.n["2fa"]]}`,
    attributeForm: 'd={[<O>.delete, <O>.<U+00E9>, <O>.n["2fa"]]}',
    why:
      "dot access for the identifier-valid segments `delete` (a reserved " +
      "word) and U+00E9 (a non-ASCII letter), and `n`, double-quoted " +
      "computed access for `2fa`, whose first character can only continue " +
      "an identifier",
  },
  {
    label: "(c) release and language level",
    origin: T1_4_5_RELEASE_ORIGIN,
    attribute: (root) => `d={[${root}["${TJE_X}"], ${root}.${IDEOGRAPH}]}`,
    attributeForm: 'd={[<O>["<U+1C89>x"], <O>.<U+2EBF0>]}',
    why:
      "double-quoted computed access for U+1C89 then `x` — TypeScript " +
      "5.9.3 admits U+1C89 neither to begin nor to continue an identifier, " +
      "whatever a runtime's later Unicode tables admit — and dot access for " +
      "U+2EBF0, a Unicode 15.1 ideograph that release admits at ESNext, " +
      "though not at ES5",
  },
];

/** Names the added import may not bind in the target (SPEC 2.1, 14.15). */
const T1_4_5_FORBIDDEN_ROOTS: readonly { name: string; why: string }[] = [
  {
    name: "K",
    why: "the identifier the target's retained import of k.mdx's module binds",
  },
  ...["S", "Spec", "text"].map((name) => ({
    name,
    why: "a compiler-provided name no import in an xspec source file may bind",
  })),
];

/**
 * The fresh identifier the moved `d` array is rooted at — the value-unpinned
 * binding of the added declaration (SPEC 6.5), read off its first entry as
 * TypeScript 5.9.3 at ESNext reads an identifier (helpers/ts-identifiers.ts:
 * a non-ASCII letter or U+2EBF0 as readily as `a`; SPEC 1.4, 14.20) —
 * after asserting the moved section's opening tag is exactly the expected
 * one: every entry in 6.4's fallback spelling, rooted at that one binding,
 * the array's brackets, commas, and spaces unchanged. Diagnosed (H-8) when
 * the target holds no such tag line, or more than one, or when the run the
 * array opens with reads as no identifier.
 */
function t145MovedArrayRoot(
  text: string,
  arm: T145ConversionArm,
  context: string,
): string {
  const tagLines = text
    .split("\n")
    .filter((line) => line.startsWith('<S id="m" '));
  const expectation =
    `the moved section's opening tag \`<S id="m" ${arm.attributeForm}>\` — ` +
    `its local references converted to imported form through one binding ` +
    `<O> of a.mdx's module in 6.4's fallback spellings: ${arm.why}; the ` +
    `array's brackets, commas, and spaces unchanged (SPEC 1.4, 6.4, 6.5, ` +
    `14.20)`;
  const [tagLine] = tagLines;
  if (tagLines.length !== 1 || tagLine === undefined) {
    fail(
      `${context}: specs/t.mdx must hold exactly one line opening with ` +
        `\`<S id="m" \`, ${expectation}; found ${String(tagLines.length)} ` +
        `in ${JSON.stringify(text)}`,
    );
  }
  // The run the array opens with, up to its first ASCII delimiter (the
  // entry's `.` or `[`), judged before the line is composed around it.
  const opening = '<S id="m" d={[';
  const root = tagLine.startsWith(opening)
    ? identifierRunAt(tagLine, opening.length)
    : "";
  if (root !== "") {
    expectFreshIdentifier(
      root,
      `${context}: specs/t.mdx's moved \`d\` array, in the line ` +
        `${JSON.stringify(tagLine)}, must be rooted at the added ` +
        `declaration's binding; ${expectation}`,
    );
  }
  if (root === "" || tagLine !== `<S id="m" ${arm.attribute(root)}>`) {
    fail(
      `${context}: specs/t.mdx must hold ${expectation}; the line reads ` +
        `${JSON.stringify(tagLine)}`,
    );
  }
  return root;
}

/**
 * Stage one conversion arm, move `m` into the target, and assert the
 * target's bytes under T6.5-8's discipline, its derivability (S-9), and a
 * clean `check`, then `build`.
 */
async function runT145ConversionArm(
  product: ProductBinding,
  arm: T145ConversionArm,
): Promise<void> {
  const context = `T1.4-5 ${arm.label}`;
  const workspace = await TestWorkspace.create({
    files: {
      "xspec.config.ts": SPECS_ONLY_CONFIG,
      "specs/a.mdx": arm.origin,
      "specs/t.mdx": T1_4_5_TARGET_SOURCE,
      "specs/k.mdx": T1_4_5_K_SOURCE,
    },
  });
  try {
    // Premise: the staging is valid (every reference resolves), so a later
    // failure is the move's, not the staging's.
    await buildOk(
      product,
      workspace,
      `${context} \`build\` over the staging, every reference resolving`,
    );
    await expectExit(
      product,
      workspace,
      ["move", "specs/a.mdx#m", "specs/t.mdx#m"],
      0,
      `${context} \`move specs/a.mdx#m specs/t.mdx#m\` into a target ` +
        `lacking a.mdx's module (SPEC 6.5)`,
    );
    const kind = await workspace.kind("specs/t.mdx");
    if (kind !== "file") {
      fail(`${context}: expected a plain file at specs/t.mdx; found ${kind}`);
    }
    const actual = await workspace.readBytes("specs/t.mdx");
    const text = new TextDecoder("utf-8", { fatal: false }).decode(actual);
    const root = t145MovedArrayRoot(text, arm, context);
    for (const forbidden of T1_4_5_FORBIDDEN_ROOTS) {
      if (root === forbidden.name) {
        fail(
          `${context}: the added import binds \`${forbidden.name}\`, ` +
            `${forbidden.why} — an added import binds fresh identifiers ` +
            `colliding with no binding already in the file (SPEC 6.5, ` +
            `2.1, 14.15)`,
        );
      }
    }
    // T6.5-8's discipline: composed up to the two unknowns — the fresh
    // identifier (now known) and the insertion offset (isolated by the
    // helper, which accepts a line-start reading alone; the target holds
    // one).
    assertAddedImportInsertion(
      {
        rel: "specs/t.mdx",
        base: Buffer.from(
          t145TargetBase(`<S id="m" ${arm.attribute(root)}>`),
          "utf8",
        ),
        actual,
        importerDir: "specs",
        expectedModule: "specs/a.xspec",
        identifier: root,
      },
      `${context}: specs/t.mdx after the move is its composed post-move ` +
        `bytes — the moved text appended at the end of the file, its \`d\` ` +
        `array converted (${arm.attributeForm}), every other byte kept — ` +
        `with exactly one import of a.mdx's module added as a line of its ` +
        `own, byte-exactly 6.5's spelling followed by U+000A at a ` +
        `line-start offset, binding the identifier the array is rooted at ` +
        `(SPEC 6.5, 6.4, 2.1, 3; T6.5-8's discipline)`,
    );
    const verdict = deriveMdx(actual);
    if (!verdict.derives) {
      fail(
        `${context}: specs/t.mdx after the move is not well-formed under ` +
          `the stock MDX 3 grammar, its identifier characters Unicode ` +
          `15.1's (S-9; SPEC 14.20): ${verdict.reason} — the file reads ` +
          JSON.stringify(text),
      );
    }
    await expectFindingFreeReport(
      product,
      workspace,
      ["check", "--json"],
      `${context} \`check --json\` immediately after the move — every ` +
        `converted reference resolves through the added binding, and no ` +
        `staleness remains (SPEC 6.5, 12.2)`,
    );
    await expectFindingFreeReport(
      product,
      workspace,
      ["build", "--json"],
      `${context} \`build --json\` after the move (SPEC 6.5, 12.1)`,
    );
  } finally {
    await workspace.dispose();
  }
}

const T1_4_5 = defineProductTest({
  id: "T1.4-5",
  title:
    "identifier by characters at TypeScript 5.9.3 and ESNext: dot access to the reserved words `delete` and `default` and to U+00E9 builds and checks clean from a spec source and a code source, each `depends`, `embeds`, and `references` edge reported, and a consumer compiling them and `SPEC[\"<U+1C89>x\"]` against the generated module type-checks at 5.9.3; a section move into a target lacking the origin's module converts a `d` array's local references to imported form in exactly 6.4's fallback spellings — dot access for `delete`, U+00E9, and U+2EBF0, double-quoted computed access for `2fa` and for U+1C89 then `x` — under T6.5-8's discipline, the target deriving and `build` and `check` clean (SPEC 1.4, 2.4, 4.1, 6.4, 6.5, 14.20)",
  run: async (product) => {
    // (a) Access.
    const workspace = await TestWorkspace.create({
      files: {
        "xspec.config.ts": T1_4_5_ACCESS_CONFIG,
        "specs/B.mdx": T1_4_5_B_SOURCE,
        "specs/A.mdx": T1_4_5_A_SOURCE,
        "src/c.ts": T1_4_5_CODE_SOURCE,
      },
    });
    try {
      await expectFindingFreeReport(
        product,
        workspace,
        ["build", "--json"],
        "T1.4-5 (a) `build --json` over dot access naming the reserved " +
          "words `delete` and `default` and the letter U+00E9, from a spec " +
          "source and a code source (SPEC 1.4, 2.4, 14.20)",
      );
      await expectFindingFreeReport(
        product,
        workspace,
        ["check", "--json"],
        "T1.4-5 (a) `check --json` after `build` (SPEC 1.4, 2.4, 12.2)",
      );
      const label =
        "T1.4-5 (a) `query edges --kinds depends,embeds,references`";
      assertEdgeSetEqual(
        decodeEdgesReport(
          await runJson(
            product,
            workspace,
            ["query", "edges", "--kinds", "depends,embeds,references"],
            label,
          ),
          label,
        ),
        T1_4_5_ACCESS_EDGES,
        `${label}: the complete dependency-edge set — each dot spelling's ` +
          "edge to its node: the spec source's two `depends` edges and its " +
          "`embeds` edge, the code source's two `references` edges and its " +
          "`embeds` edge, attributed to the file itself (SPEC 1.4, 2.4, " +
          "4.3, 4.5, 4.6, 5.2)",
      );
      await workspace.file("consumer.ts", T1_4_5_CONSUMER);
      const consumer = await ConsumerProject.load({
        rootDir: workspace.root,
        rootFiles: ["consumer.ts"],
      });
      assertNoCompileErrors(
        consumer,
        'T1.4-5 (a) consumer compiling `SPEC.delete`, `SPEC.default`, `SPEC.<U+00E9>`, and `SPEC["<U+1C89>x"]` against the generated module at TypeScript 5.9.3 — every identifier-valid segment a dot-accessible property, and the generated module parsing at that release, so `<U+1C89>x`, no identifier there, stands quoted (SPEC 1.4, 2.4, 4.1, 13.1, 14.20)',
      );
    } finally {
      await workspace.dispose();
    }
    // (b) Conversion, then (c) the release and language level.
    for (const arm of T1_4_5_CONVERSION_ARMS) {
      await runT145ConversionArm(product, arm);
    }
  },
});

/** TEST-SPEC §1.4, in canonical ID order (SUITE-03). */
export const section14Tests: readonly ProductTestEntry[] = [
  T1_4_1,
  T1_4_2,
  T1_4_3,
  T1_4_4,
  T1_4_5,
];
