// TEST-SPEC §1.3 (requirement IDs) — SUITE-02: T1.3-1 … T1.3-7.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), decodes findings through the H-3 adapters,
// and rejects a product only via diagnosed assertion failures (H-8). Error
// reports are asserted for the SPEC.md 14 required information — condition
// identity, file, location, and (14.2) a statement of the expected form —
// never exact wording.
//
// CONF-VALID in-scope (CERTIFICATIONS.md §CONF-VALID): every fixture stays
// within that entry's scope — one configured spec group of `.mdx` sources
// whose sections carry `id`/`tags` props only; no imports, embeddings, `d`
// props, code groups, `markdown`, `coverage`, `policy`, or git; the command
// surface is `build` (error reporting of 14.1–14.4, plus 14.17 as T1.3-6's
// invalid-form arms stage it) plus `query nodes`. T1.3-5's cross-file
// duplicate-ID arm is the multi-file case. T1.3-7 stands outside that
// scope — its command surface is `query subtree` and `view`, and
// CERTIFICATIONS.md places the scale-capacity class outside certification
// by construction.
//
// Location assertions: fixtures are staged as prefix + offending construct +
// suffix, all pure ASCII (string indices are byte offsets), and each negative
// arm asserts the finding's location falls within the offending construct's
// own byte window. The window is end-widened by one byte so a product
// reporting a line-granular location (last construct line plus its
// terminator) still passes; every other staged construct lies outside the
// widened window, so a finding attributed to the wrong construct fails.

import type { Finding, ViewNode } from "../../helpers/adapters/index.js";
import {
  assertReportMentions,
  decodeNodeRowsReport,
  decodeViewReport,
} from "../../helpers/adapters/index.js";
import { fail } from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import {
  assertConditionCounts,
  assertFindingLocated,
  buildFindings,
  buildOk,
  byteWindow,
  runJson,
  sortedIdentities,
} from "./support.js";

// Minimal declarative configuration (SPEC 7): exactly one spec group, nothing
// else — the CONF-VALID scope.
const SPECS_ONLY_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`;

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

// T1.3-1: a valid sibling first, so the offending construct is a proper
// sub-range of the file and the location assertion has teeth.
const MISSING_ID_PREFIX = '<S id="ok">\nA valid sibling section.\n</S>\n\n';
const MISSING_ID_CONSTRUCT = "<S>\nThis non-root section lacks an id.\n</S>";
const MISSING_ID_SOURCE = `${MISSING_ID_PREFIX}${MISSING_ID_CONSTRUCT}\n`;

const T1_3_1 = defineProductTest({
  id: "T1.3-1",
  title:
    "a non-root section without `id` fails `build` with condition 14.1 naming the file and location; exit 1 (SPEC 1.3, 14.1)",
  run: async (product) => {
    const context = "T1.3-1 `build --json` over a section without `id`";
    const findings = await findingsOf(product, MISSING_ID_SOURCE, context);
    assertConditionCounts(findings, { "14.1": 1 }, context);
    assertFindingLocated(
      findings[0]!,
      {
        file: "specs/A.mdx",
        window: byteWindow(MISSING_ID_PREFIX, MISSING_ID_CONSTRUCT),
      },
      `${context}: the 14.1 finding`,
    );
  },
});

// T1.3-2: SPEC 1.3's worked example builds; each invalid case from SPEC 1.3
// fails with 14.2 and an error stating the expected form.
const VALID_NESTING_SOURCE = [
  '<S id="login">',
  "Login behavior.",
  "",
  '<S id="login.validCredentials">',
  "A user with valid credentials can log in.",
  "</S>",
  "</S>",
  "",
].join("\n");

interface StructuralArm {
  /** Which SPEC 1.3 invalid case this is (failure diagnostics). */
  readonly name: string;
  readonly prefix: string;
  readonly construct: string;
  readonly suffix: string;
  /**
   * Substring every statement of the expected form exhibits, when the arm
   * admits one: for a child of parent `P`, the expected form is `P.` plus
   * exactly one segment (SPEC 1.3), so any statement of that form — the
   * corrected ID, `P.<segment>`, … — contains `P.`. The top-level arm's
   * expected form (the empty prefix: exactly one segment, 14.2) has no
   * implementation-independent substring, so it asserts none; the
   * discriminating positive/negative segment-count pair is T1.3-4.
   */
  readonly expectedFormMention?: string;
}

const STRUCTURAL_ARMS: readonly StructuralArm[] = [
  {
    name: '`<S id="validCredentials">` nested inside `login`',
    prefix: '<S id="login">\nLogin behavior.\n\n',
    construct:
      '<S id="validCredentials">\nDoes not equal the parent id plus one segment.\n</S>',
    suffix: "\n</S>\n",
    expectedFormMention: "login.",
  },
  {
    name: '`<S id="login.validCredentials">` nested inside `account`',
    prefix: '<S id="account">\nAccount behavior.\n\n',
    construct:
      '<S id="login.validCredentials">\nExtends a different parent id.\n</S>',
    suffix: "\n</S>\n",
    expectedFormMention: "account.",
  },
  {
    name: 'top-level `<S id="auth.login">` with no enclosing `auth`',
    prefix: "",
    construct:
      '<S id="auth.login">\nTop-level, yet the id has two segments.\n</S>',
    suffix: "\n",
  },
];

/**
 * Run one invalid-structure arm: exactly one 14.2 finding, located within the
 * offending construct, stating the expected form where the arm fixes one.
 */
async function runStructuralArm(
  product: ProductBinding,
  arm: StructuralArm,
  testId: string,
): Promise<void> {
  const context = `${testId} \`build --json\` over ${arm.name}`;
  const findings = await findingsOf(
    product,
    arm.prefix + arm.construct + arm.suffix,
    context,
  );
  assertConditionCounts(findings, { "14.2": 1 }, context);
  const finding = findings[0]!;
  assertFindingLocated(
    finding,
    { file: "specs/A.mdx", window: byteWindow(arm.prefix, arm.construct) },
    `${context}: the 14.2 finding`,
  );
  if (arm.expectedFormMention !== undefined) {
    assertReportMentions(
      finding.message,
      [arm.expectedFormMention],
      `${context}: the error states the expected form (SPEC 14.2) — any statement of ` +
        `the form for this child exhibits the parent prefix ` +
        `${JSON.stringify(arm.expectedFormMention)}`,
    );
  }
}

const T1_3_2 = defineProductTest({
  id: "T1.3-2",
  title:
    "valid nesting builds; each invalid case of SPEC 1.3 fails with 14.2 and an error stating the expected form (SPEC 1.3, 14.2)",
  run: async (product) => {
    const validWorkspace = await TestWorkspace.create({
      files: {
        "xspec.config.ts": SPECS_ONLY_CONFIG,
        "specs/A.mdx": VALID_NESTING_SOURCE,
      },
    });
    try {
      await buildOk(
        product,
        validWorkspace,
        "T1.3-2 `build` of the valid nesting (`login` containing `login.validCredentials`)",
      );
    } finally {
      await validWorkspace.dispose();
    }
    for (const arm of STRUCTURAL_ARMS) {
      await runStructuralArm(product, arm, "T1.3-2");
    }
  },
});

const T1_3_3 = defineProductTest({
  id: "T1.3-3",
  title:
    "an ID that skips a level (`a` containing `a.b.c` with no `a.b`) fails with 14.2 (SPEC 1.3, 14.2)",
  run: async (product) => {
    await runStructuralArm(
      product,
      {
        name: "`a` containing `a.b.c` with no `a.b` section",
        prefix: '<S id="a">\nAlpha.\n\n',
        construct: '<S id="a.b.c">\nSkips the level a.b.\n</S>',
        suffix: "\n</S>\n",
        // The offending id `a.b.c` itself contains every prefix-shaped
        // substring of the expected form (`a.`), so no message content is
        // implementation-independently assertable here.
      },
      "T1.3-3",
    );
  },
});

const TOP_LEVEL_MULTI_SEGMENT: StructuralArm = {
  name: "a top-level section with a multi-segment ID",
  prefix: "",
  construct: '<S id="alpha.beta">\nTwo segments at top level.\n</S>',
  suffix: "\n",
  // Checked against the empty prefix (14.2): the expected form — exactly one
  // segment — has no implementation-independent substring to require.
};

const TOP_LEVEL_ONE_SEGMENT_SOURCE =
  '<S id="alpha">\nOne segment at top level.\n</S>\n';

const T1_3_4 = defineProductTest({
  id: "T1.3-4",
  title:
    "a multi-segment top-level ID fails with 14.2 (checked against the empty prefix); a one-segment top-level ID passes (SPEC 1.3, 14.2)",
  run: async (product) => {
    await runStructuralArm(product, TOP_LEVEL_MULTI_SEGMENT, "T1.3-4");
    const workspace = await TestWorkspace.create({
      files: {
        "xspec.config.ts": SPECS_ONLY_CONFIG,
        "specs/A.mdx": TOP_LEVEL_ONE_SEGMENT_SOURCE,
      },
    });
    try {
      await buildOk(
        product,
        workspace,
        "T1.3-4 `build` of a one-segment top-level ID",
      );
    } finally {
      await workspace.dispose();
    }
  },
});

// T1.3-5, same-file arm: two occurrences of one ID, each a known byte range.
const DUP_FIRST = '<S id="dup">\nFirst occurrence.\n</S>';
const DUP_GAP = "\n\n";
const DUP_SECOND = '<S id="dup">\nSecond occurrence.\n</S>';
const DUP_SOURCE = `${DUP_FIRST}${DUP_GAP}${DUP_SECOND}\n`;

const T1_3_5 = defineProductTest({
  id: "T1.3-5",
  title:
    "duplicate IDs in one file fail with 14.3; the same ID in two files is valid — identities differ by path (SPEC 1.3, 1.5, 14.3)",
  run: async (product) => {
    // Same-file arm. SPEC 14.3 defines one condition over the duplicate pair;
    // whether a product reports the duplication once or per occurrence is not
    // fixed, so one or two findings are accepted — every one of them must be
    // 14.3, name the file, and point at one of the two `dup` constructs.
    const sameFileContext =
      "T1.3-5 `build --json` over two sections with the same ID in one file";
    const findings = await findingsOf(product, DUP_SOURCE, sameFileContext);
    const conditions = findings.map((finding) => finding.condition);
    if (
      findings.length < 1 ||
      findings.length > 2 ||
      conditions.some((condition) => condition !== "14.3")
    ) {
      fail(
        `${sameFileContext}: expected the duplicate pair to report condition 14.3 — ` +
          `one finding for the duplication, or one per occurrence — got ` +
          `${JSON.stringify(conditions)}`,
      );
    }
    const firstWindow = byteWindow("", DUP_FIRST);
    const secondWindow = byteWindow(DUP_FIRST + DUP_GAP, DUP_SECOND);
    for (const finding of findings) {
      const findingContext = `${sameFileContext}: a 14.3 finding`;
      assertFindingLocated(finding, { file: "specs/A.mdx" }, findingContext);
      const within = (
        location: { start: number; end: number },
        window: { start: number; end: number },
      ): boolean =>
        location.start >= window.start && location.end <= window.end;
      for (const { range } of finding.locations) {
        if (!within(range, firstWindow) && !within(range, secondWindow)) {
          fail(
            `${findingContext}: every location must point at one of the two duplicate ` +
              `constructs (byte windows [${String(firstWindow.start)}, ${String(firstWindow.end)}] ` +
              `and [${String(secondWindow.start)}, ${String(secondWindow.end)}]); got ` +
              `[${String(range.start)}, ${String(range.end)})`,
          );
        }
      }
    }

    // Cross-file arm: uniqueness is per file (SPEC 1.3), identities differ by
    // path (SPEC 1.5) — the build succeeds and both nodes are reported.
    const crossFile = await TestWorkspace.create({
      files: {
        "xspec.config.ts": SPECS_ONLY_CONFIG,
        "specs/A.mdx": '<S id="dup">\nIn file A.\n</S>\n',
        "specs/B.mdx": '<S id="dup">\nIn file B.\n</S>\n',
      },
    });
    try {
      await buildOk(
        product,
        crossFile,
        "T1.3-5 `build` with the same ID in two different files",
      );
      const queryContext = "T1.3-5 `query nodes` over the cross-file workspace";
      const rows = decodeNodeRowsReport(
        await runJson(product, crossFile, ["query", "nodes"], queryContext),
        queryContext,
      );
      const identities = sortedIdentities(rows);
      for (const identity of ["specs/A.mdx#dup", "specs/B.mdx#dup"]) {
        if (!identities.includes(identity)) {
          fail(
            `${queryContext}: expected ${identity} among the reported nodes — the same ` +
              `ID in two files yields two nodes whose identities differ by path ` +
              `(SPEC 1.3, 1.5); got ${JSON.stringify(identities)}`,
          );
        }
      }
    } finally {
      await crossFile.dispose();
    }
  },
});

// T1.3-6: one fixture carrying all three masking-relevant conditions.
//
//   <S>                 → 14.1 (missing id)
//     <S id="a.b">      → immediate child: 14.2 masked by the parent's 14.1
//                         (a non-masking product would flag `a.b` here, so
//                         the exact-count assertion below discriminates)
//       <S id="zzz">    → grandchild: its structural check runs normally
//                         against its parent's id `a.b` → the one 14.2
//     <S id="bad name"> → immediate child: 14.2 masked, but its own other
//                         condition — whitespace in a segment, 14.4 — still
//                         reports
const MASK_PREFIX =
  "<S>\nThe parent section lacks an id.\n\n" +
  '<S id="a.b">\nImmediate child: its structural check is masked by the parent missing an id.\n\n';
const MASK_GRANDCHILD =
  '<S id="zzz">\nGrandchild: checked against its parent id normally.\n</S>';
const MASK_MID = "\n</S>\n\n";
const MASK_BAD_CHILD =
  '<S id="bad name">\nImmediate child: its own non-structural condition still reports.\n</S>';
const MASK_SOURCE = `${MASK_PREFIX}${MASK_GRANDCHILD}${MASK_MID}${MASK_BAD_CHILD}\n</S>\n`;

// T1.3-6 invalid-form arms (SPEC 14.1: a repeated `id` attribute or a value
// not in quoted static-string form is condition 17, never condition 1, and
// each case spells no identity, masking condition 2 for the immediate
// children exactly as a missing `id` does — SPEC 2.7, 14.2, 14.17). Each arm
// stages one bearer with an immediate child whose ID the structural rule
// would otherwise judge — `a.b` extends none of the bearer's spelled value
// candidates (`one`, `two`, `x`; the valueless bearer spells none) and is
// multi-segment against the empty prefix, so a product that fails to mask,
// or silently adopts one of the spelled values as the identity, reports an
// extra 14.2 — and a grandchild whose structural check runs normally
// against its parent's spelled id `a.b`. The valueless arm (`<S id>`, the
// bare name — T2.7-3's form) masks the same children whether a product
// reads it as condition 17 or as an absent `id` (condition 1), so its
// discriminating assertion is the bearer's own code: exactly one 14.17 and
// no 14.1. A valid sibling precedes the bearer so the bearer's construct is
// a proper sub-range of the file and its location assertion has teeth.
interface InvalidIdFormArm {
  /** Which T1.3-6 invalid-form case this is (failure diagnostics). */
  readonly name: string;
  /** The bearer's opening tag plus its own text, up to the child. */
  readonly bearerOpen: string;
}

const FORM_SIBLING = '<S id="ok">\nA valid sibling section.\n</S>\n\n';
const FORM_CHILD_OPEN =
  '<S id="a.b">\nImmediate child: its structural check is masked by the bearer spelling no identity.\n\n';
const FORM_GRANDCHILD =
  '<S id="zzz">\nGrandchild: checked against its parent id normally.\n</S>';
const FORM_TAIL = "\n</S>\n</S>";

const INVALID_ID_FORM_ARMS: readonly InvalidIdFormArm[] = [
  {
    name: 'a repeated-`id` section (`<S id="one" id="two">`)',
    bearerOpen:
      '<S id="one" id="two">\nBearer: the id attribute is repeated.\n\n',
  },
  {
    name: 'a braced-`id` section (`<S id={"x"}>`)',
    bearerOpen:
      '<S id={"x"}>\nBearer: the id value is not a quoted static string literal.\n\n',
  },
  {
    name: "a valueless-`id` section (`<S id>`)",
    bearerOpen:
      "<S id>\nBearer: the id prop is the bare name, spelling no value at all.\n\n",
  },
];

/**
 * Run one invalid-form arm: the bearer reports 14.17 and no 14.1, its
 * immediate child reports no 14.2, and the grandchild's structural check
 * still reports (SPEC 14.1, 14.2, 14.17).
 */
async function runInvalidIdFormArm(
  product: ProductBinding,
  arm: InvalidIdFormArm,
): Promise<void> {
  const context = `T1.3-6 \`build --json\` over ${arm.name}`;
  const bearerConstruct =
    arm.bearerOpen + FORM_CHILD_OPEN + FORM_GRANDCHILD + FORM_TAIL;
  const findings = await findingsOf(
    product,
    `${FORM_SIBLING}${bearerConstruct}\n`,
    context,
  );
  // Exactly one 14.17 and one 14.2 in the whole report: the bearer reports
  // condition 17 — never 14.1 and never 14.20, the value form is a validity
  // matter, not a parse failure — the immediate child's 14.2 is masked, and
  // the grandchild's structural check still reports (the one 14.2).
  assertConditionCounts(findings, { "14.17": 1, "14.2": 1 }, context);
  const ofCondition = (condition: string): Finding =>
    findings.find((finding) => finding.condition === condition)!;
  assertFindingLocated(
    ofCondition("14.17"),
    {
      file: "specs/A.mdx",
      window: byteWindow(FORM_SIBLING, bearerConstruct),
    },
    `${context}: the bearer's 14.17 finding (an invalid id form is condition 17, ` +
      "never condition 1 — located at the bearer, not the valid sibling)",
  );
  assertFindingLocated(
    ofCondition("14.2"),
    {
      file: "specs/A.mdx",
      window: byteWindow(
        FORM_SIBLING + arm.bearerOpen + FORM_CHILD_OPEN,
        FORM_GRANDCHILD,
      ),
    },
    `${context}: the grandchild's 14.2 finding (its structural check runs against ` +
      "its parent's spelled id `a.b` normally)",
  );
}

const T1_3_6 = defineProductTest({
  id: "T1.3-6",
  title:
    "missing-id masking: immediate children of an id-less section report no 14.2, while their other conditions and the grandchildren's structural checks still report; a repeated-`id`, braced-`id`, or valueless-`id` (`<S id>`) bearer reports 14.17 — never 14.1 — masking the same way (SPEC 1.3, 2.7, 14.1, 14.2, 14.17)",
  run: async (product) => {
    const context =
      "T1.3-6 `build --json` over an id-less section with children";
    const findings = await findingsOf(product, MASK_SOURCE, context);
    // Exactly one 14.2 in the whole report: the grandchild's. A product that
    // fails to mask reports additional 14.2s for the immediate children
    // (`a.b` does not extend any parent id and is multi-segment against the
    // empty prefix); a product that over-masks reports none.
    assertConditionCounts(
      findings,
      { "14.1": 1, "14.2": 1, "14.4": 1 },
      context,
    );
    const ofCondition = (condition: string): Finding =>
      findings.find((finding) => finding.condition === condition)!;
    assertFindingLocated(
      ofCondition("14.1"),
      { file: "specs/A.mdx" },
      `${context}: the parent's 14.1 finding`,
    );
    // The one 14.2 must be the grandchild's — located within its construct,
    // which excludes both immediate children's constructs.
    assertFindingLocated(
      ofCondition("14.2"),
      {
        file: "specs/A.mdx",
        window: byteWindow(MASK_PREFIX, MASK_GRANDCHILD),
      },
      `${context}: the grandchild's 14.2 finding (its structural check runs against ` +
        "its parent's id normally)",
    );
    // The `bad name` child's own condition still reports, for that child.
    assertFindingLocated(
      ofCondition("14.4"),
      {
        file: "specs/A.mdx",
        window: byteWindow(
          MASK_PREFIX + MASK_GRANDCHILD + MASK_MID,
          MASK_BAD_CHILD,
        ),
      },
      `${context}: the immediate child's own 14.4 finding (other conditions are not masked)`,
    );

    // Invalid-form arms: a repeated `id`, a braced `id={"x"}`, and a
    // valueless `<S id>` each report condition 17 — the bare name is never
    // `missing-id` — and mask 14.2 for the immediate children the same way.
    for (const arm of INVALID_ID_FORM_ARMS) {
      await runInvalidIdFormArm(product, arm);
    }
  },
});

// ---------------------------------------------------------------------------
// T1.3-7 Depth — the deterministic anchor of P-8's giant-nesting floor.
//
// SPEC 1.3 bounds no nesting depth: its structural rule — a child's id is its
// parent's id plus "." plus exactly one segment — holds at every level. One
// valid file nests sections DEPTH_FLOOR levels deep. Because every id spells
// its whole ancestor chain, the file is quadratic in the depth (~4.2 MB at
// 2048 with one-letter segments) and both it and the expected identities are
// built iteratively; the answers (~4.5 MB of `query subtree` rows, ~13 MB of
// `view`) are walked iteratively too — H-11, S-8: never one frame per level.
// P-8's own tower repeats `id="g"` at every level, which 1.3 rejects (14.2)
// from the second level on — right for a robustness draw, wrong for the valid
// workspace T1.3-7 stages, so this fixture chains its ids instead.

/** P-8's giant-nesting floor (TEST-SPEC P-8, 16), staged here deterministically. */
const DEPTH_FLOOR = 2048;

/**
 * One-letter segments cycling through the alphabet: a level's identity is a
 * function of its position, so a level the product drops, duplicates, or
 * reorders shifts every deeper identity and the sequence comparison names
 * the first shifted position.
 */
const DEPTH_SEGMENTS = "abcdefghijklmnopqrstuvwxyz";

interface DepthTower {
  /** The file's bytes. */
  readonly source: string;
  /** Each level's `id` value, outermost first. */
  readonly ids: readonly string[];
}

/** Build the chain iteratively: level k's id is level k−1's id plus "." plus its own segment. */
function depthTower(depth: number): DepthTower {
  const ids: string[] = [];
  const openers: string[] = [];
  let id = "";
  for (let level = 1; level <= depth; level += 1) {
    const segment = DEPTH_SEGMENTS[(level - 1) % DEPTH_SEGMENTS.length]!;
    id = level === 1 ? segment : `${id}.${segment}`;
    ids.push(id);
    openers.push(`<S id="${id}">\n`);
  }
  return {
    source: `${openers.join("")}deep.\n${"</S>\n".repeat(depth)}`,
    ids,
  };
}

/** A long identity rendered within bounds for a diagnosis. */
function abbreviateIdentity(identity: string): string {
  const limit = 48;
  return identity.length <= limit
    ? JSON.stringify(identity)
    : `${JSON.stringify(identity.slice(0, limit))}… (${identity.length} characters)`;
}

/**
 * Diagnosed, position-by-position comparison of a reported identity sequence
 * against the expected one — the count and every position, so first, last,
 * and every sampled identity are covered — without rendering either
 * multi-megabyte sequence whole (`assertSameJson` would).
 */
function assertIdentitySequence(
  actual: readonly string[],
  expected: readonly string[],
  context: string,
): void {
  const shared = Math.min(actual.length, expected.length);
  for (let index = 0; index < shared; index += 1) {
    if (actual[index] !== expected[index]) {
      fail(
        `${context}: the identity at position ${index} differs\n` +
          `  actual:   ${abbreviateIdentity(actual[index]!)}\n` +
          `  expected: ${abbreviateIdentity(expected[index]!)}`,
      );
    }
  }
  if (actual.length !== expected.length) {
    const detail =
      actual.length > expected.length
        ? `the first surplus identity is ${abbreviateIdentity(actual[expected.length]!)}`
        : `the first missing identity is ${abbreviateIdentity(expected[actual.length]!)}`;
    fail(
      `${context}: ${expected.length} identities expected (the root plus ` +
        `${expected.length - 1} sections), got ${actual.length}; ${detail}`,
    );
  }
}

/**
 * Walk the positional tree iteratively (H-11): the staged file nests exactly
 * one section per level, so the tree must be one chain — every node has one
 * child until the deepest, which has none — and its preorder identities are
 * returned for the sequence comparison.
 */
function chainIdentities(root: ViewNode, context: string): string[] {
  const identities: string[] = [];
  let node = root;
  for (let level = 0; ; level += 1) {
    if (typeof node.identity !== "string") {
      fail(
        `${context}: the node at nesting level ${level} reports its identity as ` +
          "unavailable, but the file carries no finding — every identity of a " +
          "valid file is defined (SPEC 11.2, 1.5)",
      );
    }
    identities.push(node.identity);
    if (node.children.length === 0) return identities;
    if (node.children.length !== 1) {
      fail(
        `${context}: the node at nesting level ${level} ` +
          `(${abbreviateIdentity(node.identity)}) reports ${node.children.length} ` +
          "children, but the staged file nests exactly one section per level " +
          "(SPEC 11.4: the positional tree is defined by construct nesting alone)",
      );
    }
    node = node.children[0]!;
  }
}

const T1_3_7 = defineProductTest({
  id: "T1.3-7",
  title:
    "Depth: a valid 2048-deep section chain builds, and `query subtree` and `view` serve every level",
  async run(product) {
    const tower = depthTower(DEPTH_FLOOR);
    const expectedIdentities = [
      "specs/A.mdx",
      ...tower.ids.map((id) => `specs/A.mdx#${id}`),
    ];
    const workspace = await TestWorkspace.create({
      files: {
        "xspec.config.ts": SPECS_ONLY_CONFIG,
        "specs/A.mdx": tower.source,
      },
    });
    try {
      await buildOk(
        product,
        workspace,
        `T1.3-7 \`build\` over one file nesting sections ${DEPTH_FLOOR} levels deep — ` +
          "a valid workspace, SPEC 1.3 bounding no depth",
      );

      // `query subtree` on the root: the root plus every section, in document
      // order (SPEC 11.1) — the count and each identity by position.
      const subtreeLabel = "T1.3-7 `query subtree specs/A.mdx` (the root)";
      const rows = decodeNodeRowsReport(
        await runJson(
          product,
          workspace,
          ["query", "subtree", "specs/A.mdx"],
          subtreeLabel,
        ),
        subtreeLabel,
      );
      assertIdentitySequence(
        rows.map((row) => row.identity),
        expectedIdentities,
        `${subtreeLabel}: the root plus every section, in document order (SPEC 11.1)`,
      );

      // `view` on the file: the full positional tree — one chain, DEPTH_FLOOR
      // levels deep, every identity defined (SPEC 11.4).
      const viewLabel = "T1.3-7 `view specs/A.mdx`";
      const report = decodeViewReport(
        await runJson(product, workspace, ["view", "specs/A.mdx"], viewLabel),
        { text: false },
        viewLabel,
      );
      if (report.findings.length !== 0) {
        fail(
          `${viewLabel}: ${report.findings.length} finding(s) accompany the answer, ` +
            `but the workspace is valid — the ${DEPTH_FLOOR}-deep chain satisfies ` +
            "1.3 at every level",
        );
      }
      if (report.views.length !== 1) {
        fail(
          `${viewLabel}: expected exactly one per-file view (the one requested ` +
            `file), got ${report.views.length} (SPEC 11.4)`,
        );
      }
      assertIdentitySequence(
        chainIdentities(report.views[0]!.root, viewLabel),
        expectedIdentities,
        `${viewLabel}: the full positional tree — the root and one section per ` +
          `level, ${DEPTH_FLOOR} deep, in document order (SPEC 11.4)`,
      );
    } finally {
      await workspace.dispose();
    }
  },
});

/** TEST-SPEC §1.3, in canonical ID order (SUITE-02). */
export const section13Tests: readonly ProductTestEntry[] = [
  T1_3_1,
  T1_3_2,
  T1_3_3,
  T1_3_4,
  T1_3_5,
  T1_3_6,
  T1_3_7,
];
