// TEST-SPEC §2.7 (permitted constructs) — SUITE-10: T2.7-1 … T2.7-4.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5) and exact bytes where SPEC.md fixes bytes
// (H-4 — emitted Markdown per SPEC 3, own/subtree text per SPEC 1.6), decodes
// output through the H-3 adapters, and rejects a product only via diagnosed
// assertion failures (H-8).
//
// SPEC 2.7: beyond standard Markdown content, a source file may contain only
// spec module imports, `<S>`/`<Spec>` sections, `{text(...)}` embeddings, and
// MDX comments — any other JSX element, any other expression container, and
// any export statement are invalid (14.16); a section is an MDX element
// node, so `<S>` spelled inside an expression container is part of that
// container's expression — content under 3, never a section (T2.7-1's
// container arm: one 14.16 brace through brace, no node in the view's tree,
// the container's bytes preserved in the enclosing text, 11.2, 11.4; `ids`
// and `query` are gated on the failing workspace, 13.3, so the absence is
// asserted in the view alone). Comments are pure annotations:
// they do not enter own text or any hash, and Markdown output removes them
// (3). The defined props are `id`, `d`, `coverage`, and `tags`; a repeated
// prop (defined or unknown), an unknown prop, and a spread attribute are
// invalid (14.17); `id`/`coverage`/`tags` values MUST be quoted-form static
// string literals — single- or double-quoted alike (2.4) — and any other
// value form, a braced expression or the bare valueless name alike, is
// invalid (14.17) — a bare `<S id>` is condition 17, never the missing-id
// condition 1 (14.1); `d` MUST be a braced expression — a quoted or
// valueless `d` is invalid (14.17), and a braced `d` value that is not a
// static reference or an array literal of them is a dynamic argument (14.8).
// A fragment (`<>` through `</>`) is an invalid element (14.16): one finding
// from `<>` through `</>`, no node, its enclosed content preserved under
// `view --text` (T2.7-1's fragment arm); an attribute value expression is
// part of its element, no container of condition 16 — `<S id="x" d={1}>`
// reports 14.8 alone, `<div a={1}></div>` exactly one 14.16. A spread
// attribute's grammar pair (14.20): `{...(a, b)}` is well-formed — 14.17 at
// the whole braced construct — while `{...a, b}` is not, 14.20 at the
// offset of its comma (T2.7-3's pair, staged under S-9's `unparseable`
// declaration). The comment forms of 2.7 beyond the usual `{/* … */}` —
// `{}`, ECMAScript-only and ASCII whitespace between braces, a block-comment
// sequence, line-comment containers ended by U+000A or U+000D, and the
// run-on `{// c}` U+000A `}` — each behave as T2.7-2's comment (removed
// from Markdown output, absent from own text, no finding, listed under
// `view`'s `comments` brace through brace); an expression beside a comment
// is 14.16; U+0085 or U+200B between braces, `{// c` U+2028/U+2029 `}`
// U+000A `}`, and `{// c}` with no later `}` are 14.20 at the offsets SPEC
// 14 fixes (T2.7-4, each 14.20 staging declared `unparseable`).
//
// Location assertions follow the SUITE-08 discipline: negative fixtures are
// pure ASCII, composed as `prefix + construct + suffix` with exactly known
// parts, so string indices are byte offsets and each finding must fall within
// the offending construct's own byte window (end-widened by one byte, see
// support.ts byteWindow); the valid sibling section and every other staged
// construct lie outside the widened window. T2.7-1's container arm pins an
// exact range instead — the container brace through brace (14) — and its
// fixture carries one multibyte character before the container, so every
// pinned offset is a UTF-8 byte length (1.7) that a code-unit count misses.
//
// The valueless-`tags` file is exported as VALUELESS_TAGS_FIXTURE — its exact
// bytes, attribute offsets, and finding location — because TEST-SPEC T11.4-3
// stages the same bytes for `view`: build and view share one fixture, the
// 14.17 beside the view being the condition the build reports here.
//
// No certification fixture scopes any T2.7 test (CERTIFICATIONS.md keeps the
// 2.7 negative matrix among the representatively-certified ones), so only
// TEST-SPEC's own requirements bind these fixtures.

import { Buffer } from "node:buffer";

import type {
  Finding,
  ImpactReport,
  ImpactRequirementEntry,
  NodeReport,
  SourceRange,
  ViewNode,
} from "../../helpers/adapters/index.js";
import {
  decodeImpactReport,
  decodeNodeReport,
  decodeViewReport,
} from "../../helpers/adapters/index.js";
import {
  assertBytesEqual,
  assertFileBytes,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { WorkspaceMdxDecl } from "../../helpers/workspace.js";
import type {
  FindingSourceExpectation,
  UnparseableStaging,
} from "./support.js";
import {
  assertConditionCounts,
  assertFindingLocated,
  assertSameJson,
  buildFindings,
  buildOk,
  byteWindow,
  expectExit,
  runJson,
} from "./support.js";

// Minimal declarative configuration (SPEC 7): exactly one spec group — the
// negative arms need nothing else.
const SPECS_ONLY_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`;

// Markdown emission next to each source (SPEC 7.3, 13.2) for the arms that
// byte-assert compiled output (T2.7-2's comment removal, T2.7-3's quoting
// equivalence).
const EMIT_TRUE_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  markdown: { emit: true }
})
`;

// Shared negative-arm template (the SUITE-02/03 discipline): a valid sibling
// first, so the offending construct is a proper sub-range of the file and the
// location assertion has teeth.
const SIBLING_CONSTRUCT = '<S id="ok">\nA valid sibling section.\n</S>';
const SIBLING = `${SIBLING_CONSTRUCT}\n\n`;

// T2.7-3's one-defect file: the sibling, then the offending section — its
// opening tag the staged construct, its body and closing tag fixed — at one
// workspace-relative path.
const INVALID_PROP_FILE = "specs/A.mdx";
const INVALID_PROP_BODY = "\nBody text.\n</S>";

/** The one-defect file's exact bytes for an offending opening tag. */
function invalidPropSource(construct: string): string {
  return `${SIBLING}${construct}${INVALID_PROP_BODY}\n`;
}

/**
 * Stage a fresh workspace (config plus `files`, under the S-9 declaration
 * `mdx` where a staging declares an unparseable source), run `body`,
 * dispose (H-1).
 */
async function withWorkspace<T>(
  config: string,
  files: Readonly<Record<string, string>>,
  body: (workspace: TestWorkspace) => Promise<T>,
  mdx?: WorkspaceMdxDecl,
): Promise<T> {
  const workspace = await TestWorkspace.create({
    files: { "xspec.config.ts": config, ...files },
    mdx,
  });
  try {
    return await body(workspace);
  } finally {
    await workspace.dispose();
  }
}

/**
 * `query node <identity>` decoded through the H-3 adapter, with the resolved
 * identity checked so a mis-addressed report cannot satisfy the assertions.
 */
async function queryNode(
  product: ProductBinding,
  workspace: TestWorkspace,
  identity: string,
  context: string,
): Promise<NodeReport> {
  const label = `${context} \`query node ${identity}\``;
  const node = decodeNodeReport(
    await runJson(product, workspace, ["query", "node", identity], label),
    label,
  );
  if (node.identity !== identity) {
    fail(
      `${label}: expected the report to be about ${JSON.stringify(identity)} (SPEC 1.5), ` +
        `got identity ${JSON.stringify(node.identity)}`,
    );
  }
  return node;
}

/** Assert an opaque hash value changed across an edit (H-4: self-compare). */
function assertHashChanged(
  before: string,
  after: string,
  what: string,
  context: string,
): void {
  if (before === after) {
    fail(
      `${context}: ${what} must change across the edit (SPEC 5.5), but it is ` +
        `byte-identical: ${JSON.stringify(before)}`,
    );
  }
}

/** Assert an opaque hash value is byte-identical across an edit. */
function assertHashStable(
  before: string,
  after: string,
  what: string,
  context: string,
): void {
  if (before !== after) {
    fail(
      `${context}: ${what} must be byte-identical across the edit (SPEC 5.5), ` +
        `but it changed: ${JSON.stringify(before)} -> ${JSON.stringify(after)}`,
    );
  }
}

/** UTF-8 byte length of `text` — the offset unit of SPEC 1.7. */
function utf8Bytes(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

/**
 * Assert a finding carries exactly one location — `file` at `range`, as byte
 * offsets (SPEC 1.7) — and, locating in source, concerns no path (12.7:
 * `path` is null for located conditions). The exact-range form of the
 * module's location assertions, for the arms where SPEC 14 pins the range
 * beyond a construct's window.
 */
function assertSoleLocationExactly(
  finding: Finding,
  file: string,
  range: SourceRange,
  context: string,
): void {
  assertSameJson(
    finding.locations.map((location) => ({
      file: location.file,
      range: { start: location.range.start, end: location.range.end },
    })),
    [{ file, range: { start: range.start, end: range.end } }],
    `${context} (message: ${JSON.stringify(finding.message)})`,
  );
  if (finding.path !== null) {
    fail(
      `${context}: a finding locating in source concerns no path — \`path\` ` +
        `is null for located conditions (SPEC 12.7, 14); got ` +
        `${JSON.stringify(finding.path)} (message: ` +
        `${JSON.stringify(finding.message)})`,
    );
  }
}

/**
 * Byte range (SPEC 1.7) of exactly one occurrence of `part` within
 * `construct`, the construct itself standing at byte `constructStart` of its
 * file. An absent or ambiguous part is a staging defect — a harness error,
 * never a product failure: a precomputed range must name its bytes uniquely.
 */
function constructPartRange(
  construct: string,
  part: string,
  constructStart: number,
  where: string,
): SourceRange {
  const first = construct.indexOf(part);
  if (first === -1) {
    throw new Error(
      `${where}: staging locator — part ${JSON.stringify(part)} not found ` +
        `in ${JSON.stringify(construct)}`,
    );
  }
  if (construct.indexOf(part, first + 1) !== -1) {
    throw new Error(
      `${where}: staging locator — part ${JSON.stringify(part)} is ` +
        `ambiguous in ${JSON.stringify(construct)}`,
    );
  }
  const start = constructStart + utf8Bytes(construct.slice(0, first));
  return { start, end: start + utf8Bytes(part) };
}

// ---------------------------------------------------------------------------
// T2.7-1
// ---------------------------------------------------------------------------

// One representative per forbidden construct class of SPEC 2.7 (each the only
// defect in its otherwise valid fixture). The JSX-element and
// expression-container arms sit inside a section — nesting inside `<S>` earns
// no exemption; the export statement is top-level ESM with a valid section
// after it, so its window has content on both sides. The attribute-value
// pair (SPEC 14.16: an attribute value expression is part of its element, no
// container of the condition): `<S id="x" d={1}>` reports 14.8 alone — the
// braced `d` value holding a number is a dynamic argument (2.7), its braces
// no expression container — and `<div a={1}></div>` exactly one condition-16
// finding, the element's; in each arm the absence of any second finding is
// the assertion, so the count is exact over every condition.
const T2_7_1_SECTION_PREFIX = `${SIBLING}<S id="sec">\nSection text.\n\n`;

interface ForeignConstructArm {
  /** Which SPEC 2.7 forbidden class this is (failure diagnostics). */
  readonly name: string;
  /** Everything before the offending construct, exactly. */
  readonly prefix: string;
  /** The offending construct's own characters, exactly. */
  readonly construct: string;
  /** Everything after the offending construct, exactly. */
  readonly suffix: string;
  /**
   * The one condition the arm reports: 14.16, or 14.8 for the attribute-value
   * control, whose braced `d` value is a dynamic argument and no container.
   */
  readonly condition: "14.16" | "14.8";
  /** The SPEC reason the count is exactly one (failure diagnostics). */
  readonly reason: string;
}

const FOREIGN_CONSTRUCT_ARMS: readonly ForeignConstructArm[] = [
  {
    name: "a JSX element other than `<S>`/`<Spec>`",
    prefix: T2_7_1_SECTION_PREFIX,
    construct: "<div>foreign block</div>",
    suffix: "\n</S>\n",
    condition: "14.16",
    reason:
      "only imports, sections, `text(...)` embeddings, and MDX comments are " +
      "permitted; any other JSX element is invalid (SPEC 2.7, 14.16)",
  },
  {
    name: "an expression container other than `text(...)` or an MDX comment",
    prefix: T2_7_1_SECTION_PREFIX,
    construct: "{40 + 2}",
    suffix: "\n</S>\n",
    condition: "14.16",
    reason:
      "only imports, sections, `text(...)` embeddings, and MDX comments are " +
      "permitted; any other expression container is invalid (SPEC 2.7, 14.16)",
  },
  {
    name: "an export statement",
    prefix: SIBLING,
    construct: "export const flag = 1",
    suffix: '\n\n<S id="sec">\nSection text.\n</S>\n',
    condition: "14.16",
    reason:
      "only imports, sections, `text(...)` embeddings, and MDX comments are " +
      "permitted; any export statement is invalid (SPEC 2.7, 14.16)",
  },
  {
    name: 'a braced `d` value holding a number (`<S id="x" d={1}>`)',
    prefix: SIBLING,
    construct: '<S id="x" d={1}>',
    suffix: "\nX text.\n</S>\n",
    condition: "14.8",
    reason:
      "an attribute value expression is part of its element, no container " +
      "of condition 16 — the braced `d` value holding a number is a dynamic " +
      "argument, 14.8 alone, never beside a second, condition-16 finding " +
      "(SPEC 14.16, 2.7)",
  },
  {
    name: "a foreign element carrying an attribute value expression (`<div a={1}></div>`)",
    prefix: T2_7_1_SECTION_PREFIX,
    construct: "<div a={1}></div>",
    suffix: "\n</S>\n",
    condition: "14.16",
    reason:
      "exactly one condition-16 finding, the element's — its attribute value " +
      "expression is part of the element, no container earning a second " +
      "finding (SPEC 14.16, 2.7)",
  },
];

// The enclosed-construct arms: a construct spelled on its own line inside
// `sec`, invalid (14.16) yet creating no node and preserved as content.
// (a) The section-in-container arm. SPEC 2.7: a section is an MDX element
// node, so `<S>` spelled inside an expression container is part of that
// container's expression — content under 3, never a section. The container
// is one invalid expression container (14.16), located from its opening
// brace through its closing brace (14). (b) The fragment arm. SPEC 2.7: a
// fragment (`<>` through `</>`) is an invalid element (14.16), located from
// `<>` through `</>` (14); no node is created for it, and its enclosed
// content stays content — a stray element is preserved by its own tags
// (11.2; the sections and embeddings a stray element encloses are T11.2-4's
// enclosure arm). In both, the construct's bytes match no removal rule's
// form and are content, preserved byte-for-byte in the enclosing section's
// own and subtree text (11.2, 1.6); the view's section tree — defined by
// construct nesting alone, existing whatever findings the file carries —
// holds no node for the construct or anything it encloses (11.4). `ids` and
// `query` are gated on these failing workspaces (13.3), so the absence is
// asserted in the view's tree alone. Each fixture is the module's ASCII
// template plus one multibyte character (`é`, two bytes) before the
// construct, so the pinned construct and section ranges are byte offsets
// (1.7) — a product counting code units mislocates every construct after it.
const T2_7_1_ENCLOSED_FILE = "specs/A.mdx";
const T2_7_1_ENCLOSED_HEAD = "Section text é.\n\n";
const T2_7_1_ENCLOSED_TAIL_LINES = "\n\nTail text.\n";
const T2_7_1_ENCLOSED_PREFIX = `${SIBLING}<S id="sec">\n${T2_7_1_ENCLOSED_HEAD}`;
const T2_7_1_ENCLOSED_SEC_CLOSE = `${T2_7_1_ENCLOSED_TAIL_LINES}</S>`;

/** The view's tree projected to what these arms pin (T11.2-4's projection). */
interface TextTreeExpectation {
  readonly identity: ViewNode["identity"];
  readonly range: SourceRange;
  readonly ownText: string | { readonly unavailable: true };
  readonly subtreeText: string | { readonly unavailable: true };
  readonly children: readonly TextTreeExpectation[];
}

function projectTextNode(node: ViewNode): TextTreeExpectation {
  return {
    identity: node.identity,
    range: node.range,
    ownText: node.ownText!,
    subtreeText: node.subtreeText!,
    children: node.children.map(projectTextNode),
  };
}

/** One enclosed-construct fixture: its bytes, the construct's range, the tree. */
interface EnclosedConstructFixture {
  /** The construct's own characters, exactly. */
  readonly construct: string;
  /** The file's exact bytes. */
  readonly source: string;
  /** The construct's own characters as a byte range (SPEC 14, 1.7). */
  readonly range: SourceRange;
  /** The section tree with its text values (SPEC 11.4, 1.6, 3). */
  readonly tree: TextTreeExpectation;
}

function enclosedConstructFixture(construct: string): EnclosedConstructFixture {
  const source = `${T2_7_1_ENCLOSED_PREFIX}${construct}${T2_7_1_ENCLOSED_SEC_CLOSE}\n`;
  // Text values per SPEC 1.6 and 3: each section's tag lines are emptied
  // purely by removals and drop with their terminators; the blank line
  // between the sibling and `sec` is the root's own contribution and keeps;
  // the construct is content and stays byte-for-byte; the root's subtree
  // text is the children's contributions interleaved with its own in
  // document order.
  const okText = "A valid sibling section.\n";
  const secText = T2_7_1_ENCLOSED_HEAD + construct + T2_7_1_ENCLOSED_TAIL_LINES;
  const rootOwn = "\n";
  return {
    construct,
    source,
    range: {
      start: utf8Bytes(T2_7_1_ENCLOSED_PREFIX),
      end: utf8Bytes(T2_7_1_ENCLOSED_PREFIX + construct),
    },
    tree: {
      identity: T2_7_1_ENCLOSED_FILE,
      range: { start: 0, end: utf8Bytes(source) },
      ownText: rootOwn,
      subtreeText: okText + rootOwn + secText,
      children: [
        {
          identity: `${T2_7_1_ENCLOSED_FILE}#ok`,
          range: { start: 0, end: utf8Bytes(SIBLING_CONSTRUCT) },
          ownText: okText,
          subtreeText: okText,
          children: [],
        },
        {
          identity: `${T2_7_1_ENCLOSED_FILE}#sec`,
          range: {
            start: utf8Bytes(SIBLING),
            end: utf8Bytes(
              T2_7_1_ENCLOSED_PREFIX + construct + T2_7_1_ENCLOSED_SEC_CLOSE,
            ),
          },
          ownText: secText,
          subtreeText: secText,
          children: [],
        },
      ],
    },
  };
}

/** One enclosed-construct arm: its fixture and how its assertions read. */
interface EnclosedConstructArm {
  readonly fixture: EnclosedConstructFixture;
  /** The arm's name in contexts. */
  readonly name: string;
  /** What the one 14.16 finding is and why nothing stands beside it. */
  readonly soleFinding: string;
  /** How SPEC 14 bounds the finding's range. */
  readonly rangeRule: string;
  /** Why the tree holds no node within the construct's range. */
  readonly noNode: string;
  /** The pinned tree, in words. */
  readonly treeShape: string;
}

const T2_7_1_CONTAINER_ARM: EnclosedConstructArm = {
  fixture: enclosedConstructFixture('{<S id="x">Inner x text.</S>}'),
  name: "a section spelled inside an expression container",
  soleFinding:
    "exactly one condition-16 finding, the container's, and none beside — " +
    "the `<S>` spelled inside it is part of the container's expression, " +
    "earning no finding of its own (SPEC 2.7, 14.16)",
  rangeRule:
    "the 14.16 finding locates the expression container from its opening " +
    "brace through its closing brace, as byte offsets (SPEC 14, 1.7)",
  noNode:
    'no node for the `<S id="x">` spelled inside the expression container — ' +
    "it is part of the container's expression, never a section",
  treeShape:
    "the section tree by construct nesting — the root, `ok`, and `sec`, no " +
    'node for the enclosed `<S id="x">` — with the container\'s bytes ' +
    "preserved byte-for-byte as content in `sec`'s own and subtree text",
};

const T2_7_1_FRAGMENT_ARM: EnclosedConstructArm = {
  fixture: enclosedConstructFixture("<>Fragment text.</>"),
  name: "a fragment (`<>` through `</>`)",
  soleFinding:
    "exactly one condition-16 finding, the fragment's, and none beside — a " +
    "fragment is an invalid element, and the content it encloses earns no " +
    "finding of its own (SPEC 2.7, 14.16)",
  rangeRule:
    "the 14.16 finding locates the fragment from `<>` through `</>`, as " +
    "byte offsets (SPEC 14, 1.7)",
  noNode:
    "no node for the fragment — an invalid element is no section and " +
    "creates no node, and this one encloses no section",
  treeShape:
    "the section tree by construct nesting — the root, `ok`, and `sec`, no " +
    "node for the fragment — with the fragment and its enclosed content " +
    "preserved byte-for-byte as content in `sec`'s own and subtree text (a " +
    "stray element is preserved by its own tags, SPEC 11.2)",
};

/** Every node of a view tree, document order (explicit stack, AGENTS.md). */
function everyViewNode(root: ViewNode): ViewNode[] {
  const nodes: ViewNode[] = [];
  const stack: ViewNode[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    nodes.push(node);
    for (let index = node.children.length - 1; index >= 0; index -= 1) {
      stack.push(node.children[index]!);
    }
  }
  return nodes;
}

/**
 * An enclosed-construct fixture's findings: exactly one, condition 16,
 * located once — the construct's own characters, in byte offsets — and
 * concerning no path.
 */
function assertEnclosedConstructFinding(
  findings: readonly Finding[],
  arm: EnclosedConstructArm,
  context: string,
): void {
  assertConditionCounts(
    findings,
    { "14.16": 1 },
    `${context}: ${arm.soleFinding}`,
  );
  assertSoleLocationExactly(
    findings[0]!,
    T2_7_1_ENCLOSED_FILE,
    arm.fixture.range,
    `${context}: ${arm.rangeRule}`,
  );
}

/**
 * One enclosed-construct arm of `testId`: `build --json`, then the bare
 * `view --text` (T2.7-1's container and fragment arms, T2.7-4's expression
 * arm).
 */
async function runEnclosedConstructArm(
  product: ProductBinding,
  testId: string,
  arm: EnclosedConstructArm,
): Promise<void> {
  await withWorkspace(
    SPECS_ONLY_CONFIG,
    { [T2_7_1_ENCLOSED_FILE]: arm.fixture.source },
    async (workspace) => {
      const buildContext = `${testId} \`build --json\` with ${arm.name}`;
      assertEnclosedConstructFinding(
        await buildFindings(product, workspace, buildContext),
        arm,
        buildContext,
      );

      const viewContext = `${testId} bare \`view --text\` with ${arm.name}`;
      const result = await expectExit(
        product,
        workspace,
        ["view", "--text"],
        1,
        `${viewContext}: the construct's finding accompanies the answer, so ` +
          "exit 1 with the full view (SPEC 11.2, 12.0)",
      );
      const report = decodeViewReport(
        parseJsonStdout(
          result,
          `${viewContext}: a single JSON document is the only output form (SPEC 11)`,
        ),
        { text: true },
        viewContext,
      );
      assertEnclosedConstructFinding(
        report.findings,
        arm,
        `${viewContext}: the accompanying findings (SPEC 11.2)`,
      );
      assertSameJson(
        report.views.map((view) => view.file),
        [T2_7_1_ENCLOSED_FILE],
        `${viewContext}: one per-file view, the parseable file's (SPEC 11.4)`,
      );
      const view = report.views[0]!;
      const { start, end } = arm.fixture.range;
      const intruders = everyViewNode(view.root).filter(
        (node) => node.range.start >= start && node.range.start < end,
      );
      if (intruders.length > 0) {
        fail(
          `${viewContext}: ${arm.noNode}, so the view's tree holds no node ` +
            `within the construct's range [${String(start)}, ${String(end)}) ` +
            `(SPEC 2.7, 11.4); got ${intruders
              .map(
                (node) =>
                  `${JSON.stringify(node.identity)} [${String(node.range.start)}, ` +
                  `${String(node.range.end)})`,
              )
              .join(", ")}`,
        );
      }
      assertSameJson(
        projectTextNode(view.root),
        arm.fixture.tree,
        `${viewContext}: ${arm.treeShape}, the tag lines dropped, and the ` +
          "root's subtree text in document order (SPEC 2.7, 11.2, 11.4, 1.6, 3)",
      );
      assertSameJson(
        [view.imports, view.occurrences, view.comments],
        [[], [], []],
        `${viewContext}: the construct is no embedding and no comment — no ` +
          "occurrence record and no comment range; no import staged (SPEC " +
          "2.7, 5.7, 12.7)",
      );
    },
  );
}

const T2_7_1 = defineProductTest({
  id: "T2.7-1",
  title:
    "a JSX element other than `<S>`/`<Spec>`, an expression container other than `text(...)` or an MDX comment, and an export statement each fail with 14.16; a fragment is one 14.16 from `<>` through `</>`, no node, its enclosed content preserved under `view --text`; an attribute value expression is part of its element — `<S id=\"x\" d={1}>` reports 14.8 alone and `<div a={1}></div>` exactly one 14.16; a section spelled inside an expression container is part of the container's expression — one 14.16 brace through brace, no node in the view's tree, its bytes content in the enclosing text (SPEC 2.7, 14.16, 11.2, 11.4)",
  run: async (product) => {
    for (const arm of FOREIGN_CONSTRUCT_ARMS) {
      const context = `T2.7-1 \`build --json\` with ${arm.name}`;
      await withWorkspace(
        SPECS_ONLY_CONFIG,
        { "specs/A.mdx": arm.prefix + arm.construct + arm.suffix },
        async (workspace) => {
          const findings = await buildFindings(product, workspace, context);
          assertConditionCounts(
            findings,
            { [arm.condition]: 1 },
            `${context}: ${arm.reason}`,
          );
          assertFindingLocated(
            findings[0]!,
            {
              file: "specs/A.mdx",
              window: byteWindow(arm.prefix, arm.construct),
            },
            `${context}: the ${arm.condition} finding (SPEC 2.7, 14)`,
          );
        },
      );
    }
    await runEnclosedConstructArm(product, "T2.7-1", T2_7_1_CONTAINER_ARM);
    await runEnclosedConstructArm(product, "T2.7-1", T2_7_1_FRAGMENT_ARM);
  },
});

// ---------------------------------------------------------------------------
// T2.7-2
// ---------------------------------------------------------------------------

// The comment workspace: one section carrying an inline comment (sharing its
// line with retained non-whitespace) and an own-line comment, plus a
// dependent section so the boundary arm observes the full 5.6 cascade
// (`changed` at the section, `descendant-changed` at the root,
// `upstream-changed` at the dependent and — through its subtree — the root).
const T2_7_2_BASELINE = [
  '<S id="sec">',
  "Alpha text {/* inline note */} beta.",
  "",
  "{/* own-line note */}",
  "",
  "Gamma text.",
  "</S>",
  "",
  '<S id="dep" d={"sec"}>',
  "Dep text.",
  "</S>",
  "",
].join("\n");

// Hand-derived per SPEC 3 (cross-checked against the S-6 oracle): tag-only
// and comment-only lines are emptied purely by removals and drop with their
// terminators; the inline comment is deleted exactly in place (leaving the
// author's two spaces); already-empty lines are kept. No comment byte
// survives anywhere in these constants.
const T2_7_2_COMPILED = "Alpha text  beta.\n\n\nGamma text.\n\nDep text.\n";
const T2_7_2_SEC_TEXT = "Alpha text  beta.\n\n\nGamma text.\n";
const T2_7_2_DEP_TEXT = "Dep text.\n";

// The boundary variant: only the own-line comment's construct characters are
// deleted, so its line — previously dropped as left empty purely by removals
// — is now already empty in the source and kept, contributing its terminator
// (SPEC 3; TEST-SPEC T3-3): one more U+000A in the section's contribution.
const T2_7_2_BOUNDARY_COMPILED =
  "Alpha text  beta.\n\n\n\nGamma text.\n\nDep text.\n";
const T2_7_2_BOUNDARY_SEC_TEXT = "Alpha text  beta.\n\n\n\nGamma text.\n";

// The stability arms: each applies exactly one comment-only edit to the
// committed baseline. Every variant compiles to T2_7_2_COMPILED — comments
// (and their whole-line deletion) leave own content untouched (SPEC 1.6, 3).
const T2_7_2_STABILITY_ARMS: readonly { name: string; source: string }[] = [
  {
    name: "editing only the inline comment's content",
    source: T2_7_2_BASELINE.replace(
      "{/* inline note */}",
      "{/* inline note, reworded */}",
    ),
  },
  {
    name: "editing only the own-line comment's content",
    source: T2_7_2_BASELINE.replace(
      "{/* own-line note */}",
      "{/* a different remark */}",
    ),
  },
  {
    name: "deleting the inline comment sharing its line with retained non-whitespace content",
    source: T2_7_2_BASELINE.replace("{/* inline note */}", ""),
  },
  {
    name: "deleting the own-line comment together with its entire line (construct plus terminator)",
    source: T2_7_2_BASELINE.replace("{/* own-line note */}\n", ""),
  },
];

const T2_7_2_BOUNDARY = T2_7_2_BASELINE.replace("{/* own-line note */}", "");

const T2_7_2_ROOT = "specs/A.mdx";
const T2_7_2_SEC = "specs/A.mdx#sec";
const T2_7_2_DEP = "specs/A.mdx#dep";
const T2_7_2_IDENTITIES = [T2_7_2_ROOT, T2_7_2_SEC, T2_7_2_DEP] as const;

/** Full node reports of the workspace's three nodes, keyed by identity. */
async function captureReports(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
): Promise<Map<string, NodeReport>> {
  const reports = new Map<string, NodeReport>();
  for (const identity of T2_7_2_IDENTITIES) {
    reports.set(
      identity,
      await queryNode(product, workspace, identity, context),
    );
  }
  return reports;
}

/**
 * The impact entry containing `identity`, asserted to cover exactly that one
 * present node (with distinct category sets on every node here, no 9.3
 * ancestor chain may collapse).
 */
function soleEntryFor(
  impact: ImpactReport,
  identity: string,
  context: string,
): ImpactRequirementEntry {
  const entries = impact.requirements.filter((entry) =>
    entry.nodes.includes(identity),
  );
  if (entries.length !== 1) {
    fail(
      `${context}: expected exactly one requirement entry containing ${identity} ` +
        `(SPEC 5.6, 9.3); got ${String(entries.length)} among entries for ` +
        JSON.stringify(impact.requirements.map((entry) => entry.nodes)),
    );
  }
  const entry = entries[0]!;
  assertSameJson(
    entry.nodes,
    [identity],
    `${context}: the entry containing ${identity} covers exactly that node ` +
      "(SPEC 9.3: its category set differs from every neighbor's, so no " +
      "ancestor chain collapses onto it)",
  );
  assertSameJson(
    entry.deleted,
    false,
    `${context}: ${identity} is present on both sides of the comparison`,
  );
  return entry;
}

const T2_7_2 = defineProductTest({
  id: "T2.7-2",
  title:
    "an MDX comment inside a section is absent from Markdown output and not part of own text; comment-content edits, inline-comment deletion, and whole-line own-line-comment deletion change no hash and produce no change categories against a committed baseline; deleting only an own-line comment's construct characters — leaving the emptied line — changes the section's ownHash and makes it `changed` with the 5.6 cascades, the kept line contributing its terminator (SPEC 2.7, 1.6, 3, 5.5, 5.6)",
  run: async (product) => {
    await withWorkspace(
      EMIT_TRUE_CONFIG,
      { "specs/A.mdx": T2_7_2_BASELINE },
      async (workspace) => {
        await workspace.gitInit();
        const baseCommit = await workspace.gitCommitAll("baseline");

        // Absent from Markdown output: byte equality of the whole emitted
        // file against the hand-derived compilation — no comment byte can
        // survive anywhere (SPEC 2.7, 3).
        await buildOk(
          product,
          workspace,
          "T2.7-2 `build` with emission over the comment-bearing baseline",
        );
        await assertFileBytes(
          workspace.path("specs/A.md"),
          T2_7_2_COMPILED,
          "T2.7-2 emitted Markdown (SPEC 3) — both comments are removed; the " +
            "comment-only line drops with its terminator, the inline comment " +
            "is deleted exactly in place (SPEC 2.7)",
        );

        // Not part of own text (`query node`): exact bytes (SPEC 1.6).
        const baseline = await captureReports(
          product,
          workspace,
          "T2.7-2 baseline:",
        );
        const baselineSec = baseline.get(T2_7_2_SEC)!;
        assertBytesEqual(
          baselineSec.ownText,
          T2_7_2_SEC_TEXT,
          "T2.7-2 own text of the comment-bearing section — comments are not " +
            "part of own text (SPEC 2.7, 1.6)",
        );
        assertBytesEqual(
          baselineSec.subtreeText,
          T2_7_2_SEC_TEXT,
          "T2.7-2 subtree text of the comment-bearing section (no children, " +
            "so it equals own text; SPEC 1.6)",
        );
        assertBytesEqual(
          baseline.get(T2_7_2_DEP)!.ownText,
          T2_7_2_DEP_TEXT,
          "T2.7-2 own text of the dependent section",
        );
        assertBytesEqual(
          baseline.get(T2_7_2_ROOT)!.subtreeText,
          T2_7_2_COMPILED,
          "T2.7-2 the root's subtree text equals the file's compiled output " +
            "(SPEC 1.6) — comment-free there too",
        );

        // Hash and category stability, each arm one edit against the
        // committed baseline: comments enter no hash (SPEC 2.7, 1.6, 5.5),
        // so all four hashes of every node are byte-identical and `impact`
        // reports no change category for any node (SPEC 5.6, 9.1).
        for (const arm of T2_7_2_STABILITY_ARMS) {
          const context = `T2.7-2 (${arm.name})`;
          await workspace.file("specs/A.mdx", arm.source);
          const after = await captureReports(product, workspace, context);
          for (const identity of T2_7_2_IDENTITIES) {
            assertSameJson(
              after.get(identity)!.hashes,
              baseline.get(identity)!.hashes,
              `${context}: all four hashes of ${identity} — comments enter no ` +
                "hash (SPEC 2.7, 1.6, 5.5)",
            );
          }
          const impactLabel = `${context} \`impact --base <baseline> --json\``;
          const impact = decodeImpactReport(
            await runJson(
              product,
              workspace,
              ["impact", "--base", baseCommit, "--json"],
              impactLabel,
            ),
            impactLabel,
          );
          assertSameJson(
            impact.requirements,
            [],
            `${impactLabel}: the comment-only edit produces no change ` +
              "categories for any node (SPEC 2.7, 5.6, 9.1)",
          );
          assertSameJson(
            impact.code.direct,
            [],
            `${impactLabel}: no directly impacted code (SPEC 9.2)`,
          );
          assertSameJson(
            impact.code.transitive,
            [],
            `${impactLabel}: no transitively impacted code (SPEC 9.2)`,
          );
        }

        // Boundary: deleting only the own-line comment's construct
        // characters leaves the emptied line in place — already empty in the
        // source, it is kept and contributes its terminator (SPEC 3;
        // TEST-SPEC T3-3), so the section's own content gains that byte.
        const boundary =
          "T2.7-2 (boundary: own-line comment's construct characters deleted, emptied line kept)";
        await workspace.file("specs/A.mdx", T2_7_2_BOUNDARY);
        await buildOk(product, workspace, `${boundary} \`build\``);
        await assertFileBytes(
          workspace.path("specs/A.md"),
          T2_7_2_BOUNDARY_COMPILED,
          `${boundary}: the line, previously dropped as left empty purely by ` +
            "removals, is now already empty in the source and kept, " +
            "contributing its terminator (SPEC 3)",
        );
        const after = await captureReports(product, workspace, boundary);
        const afterSec = after.get(T2_7_2_SEC)!;
        assertBytesEqual(
          afterSec.ownText,
          T2_7_2_BOUNDARY_SEC_TEXT,
          `${boundary}: the section's own text gains the kept line's terminator (SPEC 1.6, 3)`,
        );

        // The containing section: ownHash changed (and with it subtreeHash
        // and effectiveHash); metadata untouched (SPEC 5.5).
        const secContext = `${boundary} section ${T2_7_2_SEC}`;
        assertHashChanged(
          baselineSec.hashes.ownHash,
          afterSec.hashes.ownHash,
          "ownHash (the kept empty line's terminator entered the own content sequence)",
          secContext,
        );
        assertHashChanged(
          baselineSec.hashes.subtreeHash,
          afterSec.hashes.subtreeHash,
          "subtreeHash",
          secContext,
        );
        assertHashChanged(
          baselineSec.hashes.effectiveHash,
          afterSec.hashes.effectiveHash,
          "effectiveHash",
          secContext,
        );
        assertHashStable(
          baselineSec.hashes.metadataHash,
          afterSec.hashes.metadataHash,
          "metadataHash (no d/coverage/tags change)",
          secContext,
        );

        // The root: descendant propagation only — its own content runs are
        // untouched (SPEC 5.5).
        const rootContext = `${boundary} root ${T2_7_2_ROOT}`;
        const rootBefore = baseline.get(T2_7_2_ROOT)!.hashes;
        const rootAfter = after.get(T2_7_2_ROOT)!.hashes;
        assertHashStable(
          rootBefore.ownHash,
          rootAfter.ownHash,
          "ownHash (the edit is inside the child construct, not a root-level run)",
          rootContext,
        );
        assertHashChanged(
          rootBefore.subtreeHash,
          rootAfter.subtreeHash,
          "subtreeHash",
          rootContext,
        );
        assertHashChanged(
          rootBefore.effectiveHash,
          rootAfter.effectiveHash,
          "effectiveHash",
          rootContext,
        );
        assertHashStable(
          rootBefore.metadataHash,
          rootAfter.metadataHash,
          "metadataHash",
          rootContext,
        );

        // The dependent: upstream propagation only (SPEC 5.5).
        const depContext = `${boundary} dependent ${T2_7_2_DEP}`;
        const depBefore = baseline.get(T2_7_2_DEP)!.hashes;
        const depAfter = after.get(T2_7_2_DEP)!.hashes;
        assertHashStable(
          depBefore.ownHash,
          depAfter.ownHash,
          "ownHash",
          depContext,
        );
        assertHashStable(
          depBefore.subtreeHash,
          depAfter.subtreeHash,
          "subtreeHash",
          depContext,
        );
        assertHashChanged(
          depBefore.effectiveHash,
          depAfter.effectiveHash,
          "effectiveHash (its dependency-edge target's effectiveHash changed)",
          depContext,
        );
        assertHashStable(
          depBefore.metadataHash,
          depAfter.metadataHash,
          "metadataHash",
          depContext,
        );

        // The cascades of 5.6 in `impact --base`: the section is `changed`;
        // the dependent is `upstream-changed`; the root is both
        // `descendant-changed` (its subtree changed) and `upstream-changed`
        // (its subtree holds the dependent) — every category attributed to
        // the section, the one originating node.
        const impactLabel = `${boundary} \`impact --base <baseline> --json\``;
        const impact = decodeImpactReport(
          await runJson(
            product,
            workspace,
            ["impact", "--base", baseCommit, "--json"],
            impactLabel,
          ),
          impactLabel,
        );
        assertSameJson(
          impact.requirements.length,
          3,
          `${impactLabel}: exactly the section, the dependent, and the root ` +
            "carry categories, each in its own entry (SPEC 5.6, 9.3 — the " +
            "three category sets are pairwise distinct, so nothing collapses)",
        );
        assertSameJson(
          soleEntryFor(impact, T2_7_2_SEC, impactLabel).categories.map(
            (entry) => entry.category,
          ),
          ["changed"],
          `${impactLabel}: the containing section is exactly \`changed\` — its ` +
            "ownHash changed; it has no descendants and no dependencies (SPEC 5.6)",
        );
        assertSameJson(
          soleEntryFor(impact, T2_7_2_DEP, impactLabel).categories,
          [{ category: "upstream-changed", attributedTo: [T2_7_2_SEC] }],
          `${impactLabel}: the dependent is exactly \`upstream-changed\`, ` +
            "attributed to the section (SPEC 5.6)",
        );
        assertSameJson(
          [...soleEntryFor(impact, T2_7_2_ROOT, impactLabel).categories].sort(
            (a, b) => (a.category < b.category ? -1 : 1),
          ),
          [
            { category: "descendant-changed", attributedTo: [T2_7_2_SEC] },
            { category: "upstream-changed", attributedTo: [T2_7_2_SEC] },
          ],
          `${impactLabel}: the root is \`descendant-changed\` and — its subtree ` +
            "holding the dependent — `upstream-changed`, both attributed to " +
            "the section (SPEC 5.6)",
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T2.7-3
// ---------------------------------------------------------------------------

// The invalid-prop matrix (SPEC 2.7 → 14.17/14.8), each arm a fresh minimal
// workspace whose offending opening tag is the one staged defect, reported
// as exactly one finding of the arm's condition and nothing else. The quoted
// `d` names the existing sibling, so a product wrongly accepting quoted-form
// `d` resolves it and builds clean — caught by the exit-1 expectation rather
// than accidentally passing via an unresolved-reference finding. The three
// valueless string-prop arms are the bare-name forms — `<S id>`,
// `<S id="x" coverage>`, `<S id="x" tags>` — of 2.7's "any other value
// form" (14.17); the bare `<S id>` is condition 17, never the missing-id
// condition 1 (14.1), so a product reading it as an absent `id` fails on the
// bearer's own code (its masking of children: T1.3-6; the view side of the
// bare-name forms: T11.2-2, T11.4-3).
interface InvalidPropArm {
  /** Which SPEC 2.7 prop rule this violates (failure diagnostics). */
  readonly name: string;
  /** The offending opening tag, exactly. */
  readonly construct: string;
  /** The SPEC 14 condition the arm must report. */
  readonly condition: "14.17" | "14.8";
  /**
   * A condition the arm discriminates against — the one a product misreading
   * the construct would report instead — checked ahead of the exact count so
   * the failure states the SPEC reason (the count alone rejects it too).
   */
  readonly forbids?: { readonly condition: string; readonly reason: string };
  /**
   * Where the one finding locates exactly, when SPEC 14 pins it beyond the
   * opening tag's window: the attribute's own characters — for a spread
   * attribute its whole braced construct (14, 11.4; T14-11) — spelled
   * exactly once in `construct`.
   */
  readonly locate?: string;
}

/** A staged attribute's exact bytes — the `view` entry form of SPEC 11.4. */
export interface StagedAttribute {
  /** The attribute's name as spelled. */
  readonly name: string;
  /** Its byte range within the file (SPEC 1.7). */
  readonly range: SourceRange;
  /** Its source text: the name through its value's last character, or the bare name. */
  readonly text: string;
}

/**
 * T2.7-3's valueless-`tags` file, the fixture T11.4-3 shares for `view`
 * (TEST-SPEC T11.4-3: one fixture for build and view — the build arm asserts
 * its one 14.17; the view arm asserts the bearer's identity defined beside
 * it, its attribute entries, and its interpreted tags unavailable, SPEC
 * 11.2/11.4). Pure ASCII, so string indices are byte offsets; every offset —
 * the bearer's and the valid sibling's — derives from the exact parts, and
 * T2.7-3 slices each back against `source` before staging.
 */
export interface ValuelessTagsFixture {
  /** Workspace-relative path the file is staged at. */
  readonly file: string;
  /** The file's exact bytes: the valid sibling section, then the bearer. */
  readonly source: string;
  /** The bearer's spelled `id` value — well-formed, its identity defined (SPEC 11.2). */
  readonly id: string;
  /** The bearer's opening tag, exactly — the one staged defect. */
  readonly construct: string;
  /** The bearer's construct range, opening tag through closing tag (SPEC 1.7). */
  readonly sectionRange: SourceRange;
  /** The bearer's attributes in tag order: `id="x"`, then the bare `tags`. */
  readonly attributes: readonly StagedAttribute[];
  /**
   * The valid sibling preceding the bearer — `<S id="ok">`, the file's first
   * bytes — every datum of it plain under SPEC 11.2 (the defaults for its
   * absent `tags` and `coverage`): the control beside the one defect.
   */
  readonly sibling: {
    /** Its spelled `id` value. */
    readonly id: string;
    /** Its construct range, opening tag through closing tag (SPEC 1.7). */
    readonly sectionRange: SourceRange;
    /** Its attributes in tag order: the one `id="ok"`. */
    readonly attributes: readonly StagedAttribute[];
  };
  /** Where the one 14.17 finding must locate: the opening tag's window (SPEC 14). */
  readonly finding: FindingSourceExpectation;
}

function valuelessTagsFixture(): ValuelessTagsFixture {
  const construct = '<S id="x" tags>';
  const idText = 'id="x"';
  const tagsText = "tags";
  const tagStart = Buffer.byteLength(SIBLING, "utf8");
  const idStart = tagStart + Buffer.byteLength("<S ", "utf8");
  const tagsStart = idStart + Buffer.byteLength(`${idText} `, "utf8");
  const siblingIdText = 'id="ok"';
  const siblingIdStart = Buffer.byteLength("<S ", "utf8");
  return {
    file: INVALID_PROP_FILE,
    source: invalidPropSource(construct),
    id: "x",
    construct,
    sectionRange: {
      start: tagStart,
      end: tagStart + Buffer.byteLength(construct + INVALID_PROP_BODY, "utf8"),
    },
    attributes: [
      {
        name: "id",
        range: { start: idStart, end: idStart + idText.length },
        text: idText,
      },
      {
        name: "tags",
        range: { start: tagsStart, end: tagsStart + tagsText.length },
        text: tagsText,
      },
    ],
    sibling: {
      id: "ok",
      sectionRange: {
        start: 0,
        end: Buffer.byteLength(SIBLING_CONSTRUCT, "utf8"),
      },
      attributes: [
        {
          name: "id",
          range: {
            start: siblingIdStart,
            end: siblingIdStart + siblingIdText.length,
          },
          text: siblingIdText,
        },
      ],
    },
    finding: {
      file: INVALID_PROP_FILE,
      window: byteWindow(SIBLING, construct),
    },
  };
}

export const VALUELESS_TAGS_FIXTURE: ValuelessTagsFixture =
  valuelessTagsFixture();

/**
 * The exported fixture's declared offsets against its own bytes (staging
 * integrity, T11.4-3's slice-check precedent): each attribute's range slices
 * to its text and the section range to the bearer's whole construct, so
 * T11.4-3 asserts `view` against offsets the build arm has verified — and
 * runs this same check itself, since it may run alone.
 */
export function assertValuelessTagsFixture(): void {
  const fixture = VALUELESS_TAGS_FIXTURE;
  const context = "T2.7-3 staging: the exported valueless-`tags` fixture";
  const bytes = Buffer.from(fixture.source, "utf8");
  const slice = (range: SourceRange): string =>
    bytes.subarray(range.start, range.end).toString("utf8");
  for (const attribute of fixture.attributes) {
    assertSameJson(
      slice(attribute.range),
      attribute.text,
      `${context}: the \`${attribute.name}\` attribute's range slices to its text`,
    );
  }
  assertSameJson(
    slice(fixture.sectionRange),
    fixture.construct + INVALID_PROP_BODY,
    `${context}: the section range slices to the bearer's whole construct`,
  );
  for (const attribute of fixture.sibling.attributes) {
    assertSameJson(
      slice(attribute.range),
      attribute.text,
      `${context}: the sibling's \`${attribute.name}\` attribute's range ` +
        `slices to its text`,
    );
  }
  assertSameJson(
    slice(fixture.sibling.sectionRange),
    SIBLING_CONSTRUCT,
    `${context}: the sibling's section range slices to its whole construct`,
  );
}

const INVALID_PROP_ARMS: readonly InvalidPropArm[] = [
  {
    name: "a repeated defined prop (`tags` twice)",
    construct: '<S id="sec" tags="a" tags="b">',
    condition: "14.17",
  },
  {
    name: "an unknown prop",
    construct: '<S id="sec" wibble="x">',
    condition: "14.17",
  },
  {
    name: "a spread attribute",
    construct: '<S id="sec" {...extra}>',
    condition: "14.17",
    locate: "{...extra}",
  },
  {
    name: "a spread attribute whose braces hold a parenthesized comma sequence (`{...(a, b)}`, well-formed)",
    construct: '<S id="x" {...(a, b)}>',
    condition: "14.17",
    locate: "{...(a, b)}",
    forbids: {
      condition: "14.20",
      reason:
        "a spread attribute's braces hold `...` followed by exactly one " +
        "AssignmentExpression, and a parenthesized comma sequence is one, " +
        "so `{...(a, b)}` is well-formed MDX — the spread is an invalid " +
        "prop, 14.17, never a parse failure (SPEC 14.20, 2.7; T14-12)",
    },
  },
  {
    name: "a braced `id` value",
    construct: '<S id={"login"}>',
    condition: "14.17",
  },
  {
    name: "a braced `coverage` value",
    construct: '<S id="sec" coverage={"none"}>',
    condition: "14.17",
  },
  {
    name: "a braced `tags` value",
    construct: '<S id="sec" tags={"a"}>',
    condition: "14.17",
  },
  {
    name: "a valueless `id` (the bare name `<S id>`)",
    construct: "<S id>",
    condition: "14.17",
    forbids: {
      condition: "14.1",
      reason:
        "a bare `<S id>` spells an id value not in quoted static-string " +
        "form — condition 17, never condition 1 (SPEC 14.1, 2.7): a product " +
        "reading the bare name as an absent `id` and reporting missing-id fails",
    },
  },
  {
    name: 'a valueless `coverage` (`<S id="x" coverage>`)',
    construct: '<S id="x" coverage>',
    condition: "14.17",
  },
  {
    name: 'a valueless `tags` (`<S id="x" tags>`, the file T11.4-3 shares)',
    construct: VALUELESS_TAGS_FIXTURE.construct,
    condition: "14.17",
  },
  {
    name: "a quoted `d` value",
    construct: '<S id="sec" d="ok">',
    condition: "14.17",
  },
  {
    name: "a valueless `d`",
    construct: '<S id="sec" d>',
    condition: "14.17",
  },
  {
    name: "a braced `d` holding a number",
    construct: '<S id="sec" d={42}>',
    condition: "14.8",
  },
  {
    name: "a braced `d` holding an object literal",
    construct: '<S id="sec" d={{a: 1}}>',
    condition: "14.8",
  },
];

// A repeated unknown prop is simultaneously repeated and unknown — two causes
// of the one condition 14.17, so SPEC fixes the condition of every finding
// but not one exact count. Its arm asserts all findings are 14.17 at the
// construct instead of a count.
const REPEATED_UNKNOWN_CONSTRUCT = '<S id="sec" wibble="a" wibble="b">';

// The spread grammar pair's ill-formed half (SPEC 14.20: a spread attribute's
// braces hold `...` followed by exactly one AssignmentExpression, so
// `{...a, b}` is not well-formed while `{...(a, b)}` — the arm above — is):
// the file is unparseable, 14.20 alone, its one zero-length range at the
// offset SPEC 14's syntax-failure rule fixes — the byte length of the longest
// whole-character prefix with which some well-formed file begins: the prefix
// through `{...a` begins one (`}>` closes the spread), the prefix through
// the comma none (after an identifier operand only a comma operator can
// follow, which no AssignmentExpression derives) — the comma's own offset
// (T14-11, T14-12). Staged under S-9's `unparseable` declaration; an
// unparseable file masks every other condition (T14-3), so the count is
// exact over all conditions, and a product parsing past the comma and
// reporting the spread as an invalid prop fails on the condition.
const T2_7_3_SPREAD_UNPARSEABLE_CONSTRUCT = '<S id="x" {...a, b}>';
const T2_7_3_SPREAD_COMMA_OFFSET = utf8Bytes(`${SIBLING}<S id="x" {...a`);

/**
 * The failing half's staging — the very bytes the arm below drives, the
 * one-defect file `invalidPropSource` composes — with the comma's offset,
 * exported for T14-11's re-assertion of the offset the same way (TEST-SPEC
 * T14-11's closing clause); declared unparseable under S-9 wherever staged.
 */
export const T2_7_3_SPREAD_UNPARSEABLE_STAGING: UnparseableStaging = {
  name:
    "a spread attribute `{...a, b}` — `...` followed by more than one " +
    "assignment expression, the zero-length range at its comma (T2.7-3)",
  kind: "spec-source",
  file: INVALID_PROP_FILE,
  files: {
    [INVALID_PROP_FILE]: invalidPropSource(T2_7_3_SPREAD_UNPARSEABLE_CONSTRUCT),
  },
  offset: T2_7_3_SPREAD_COMMA_OFFSET,
};

// The positive quoting arm (SPEC 2.7: single- or double-quoted alike; 2.4):
// the two spellings of one workspace, rebuilt in place. Byte equality is
// asserted where SPEC.md fixes bytes — the emitted Markdown (3) — and the
// spellings' equivalence everywhere else through the full `query node`
// reports (identity, source ranges — equal offsets, the quotes are
// same-length — texts, all four hashes, tags, coverage, edges): the hash
// inputs of 5.5 are identical across the spellings, so equal hashes are a
// SPEC consequence, compared product-to-itself (H-4). Generated-module and
// graph-data bytes are not pinned across the *different* sources: SPEC fixes
// their information, not their bytes (13.1, 13.3; H-4) — the T1.1-2
// tag-equivalence precedent.
const T2_7_3_DOUBLE_QUOTED =
  '<S id="login" coverage="none" tags="a b">\nLogin behavior.\n</S>\n';
const T2_7_3_SINGLE_QUOTED =
  "<S id='login' coverage='none' tags='a b'>\nLogin behavior.\n</S>\n";
const T2_7_3_QUOTED_COMPILED = "Login behavior.\n";
const T2_7_3_QUOTED_IDENTITIES = ["specs/A.mdx", "specs/A.mdx#login"] as const;

const T2_7_3 = defineProductTest({
  id: "T2.7-3",
  title:
    'repeated props (defined or unknown), unknown props, spread attributes, braced or valueless `id`/`coverage`/`tags` values — the bare `<S id>` reporting 14.17 and never 14.1 — and quoted or valueless `d` fail with 14.17, each arm exactly one finding located at its opening tag, a spread attribute\'s at its whole braced construct; the spread grammar pair — `{...(a, b)}` well-formed, 14.17 at the braced construct, `{...a, b}` not, 14.20 at its comma; a braced `d` holding a non-reference expression fails with 14.8; single-quoted `id`/`coverage`/`tags` build byte-identically in outputs to the double-quoted variants (SPEC 2.7, 2.4, 14.1, 14.20); the `<S id="x" tags>` file is exported as the fixture T11.4-3 shares for `view`',
  run: async (product) => {
    // The exported fixture's offsets are verified before its arm stages it
    // (T11.4-3 stages the same bytes for `view`).
    assertValuelessTagsFixture();

    for (const arm of INVALID_PROP_ARMS) {
      const context = `T2.7-3 \`build --json\` with ${arm.name}`;
      const { forbids } = arm;
      await withWorkspace(
        SPECS_ONLY_CONFIG,
        { [INVALID_PROP_FILE]: invalidPropSource(arm.construct) },
        async (workspace) => {
          const findings = await buildFindings(product, workspace, context);
          if (forbids !== undefined) {
            const wrong = findings.find(
              (finding) => finding.condition === forbids.condition,
            );
            if (wrong !== undefined) {
              fail(
                `${context}: ${forbids.reason}; got a ${forbids.condition} ` +
                  `finding (message: ${JSON.stringify(wrong.message)})`,
              );
            }
          }
          assertConditionCounts(findings, { [arm.condition]: 1 }, context);
          if (arm.locate === undefined) {
            assertFindingLocated(
              findings[0]!,
              {
                file: INVALID_PROP_FILE,
                window: byteWindow(SIBLING, arm.construct),
              },
              `${context}: the ${arm.condition} finding (SPEC 2.7)`,
            );
          } else {
            assertSoleLocationExactly(
              findings[0]!,
              INVALID_PROP_FILE,
              constructPartRange(
                arm.construct,
                arm.locate,
                utf8Bytes(SIBLING),
                context,
              ),
              `${context}: the ${arm.condition} finding locates the ` +
                "attribute's own characters — the spread's whole braced " +
                "construct, as byte offsets (SPEC 14, 11.4, 1.7; T14-11)",
            );
          }
        },
      );
    }

    // The spread grammar pair's ill-formed half: 14.20 alone, at the comma.
    const spreadUnparseable =
      "T2.7-3 `build --json` with a spread attribute whose braces hold a " +
      "bare comma sequence (`{...a, b}`, not well-formed)";
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      T2_7_3_SPREAD_UNPARSEABLE_STAGING.files,
      async (workspace) => {
        const findings = await buildFindings(
          product,
          workspace,
          spreadUnparseable,
        );
        const wrong = findings.find((finding) => finding.condition === "14.17");
        if (wrong !== undefined) {
          fail(
            `${spreadUnparseable}: a spread attribute's braces hold \`...\` ` +
              "followed by exactly one AssignmentExpression, which `a, b` " +
              "is not, so the file is not well-formed MDX — 14.20, never " +
              "the invalid-prop condition a product parsing past the comma " +
              "would report (SPEC 14.20, 2.7; T14-12); got a 14.17 finding " +
              `(message: ${JSON.stringify(wrong.message)})`,
          );
        }
        assertConditionCounts(
          findings,
          { "14.20": 1 },
          `${spreadUnparseable}: 14.20 alone — an unparseable file masks ` +
            "every other condition (SPEC 14.20; T14-3)",
        );
        assertSoleLocationExactly(
          findings[0]!,
          INVALID_PROP_FILE,
          {
            start: T2_7_3_SPREAD_COMMA_OFFSET,
            end: T2_7_3_SPREAD_COMMA_OFFSET,
          },
          `${spreadUnparseable}: the one zero-length range at the comma's ` +
            "offset — the byte length of the longest whole-character prefix " +
            "with which some well-formed file begins, the prefix through " +
            "`{...a` beginning one and the prefix through the comma none " +
            "(SPEC 14, 14.20; T14-11, T14-12)",
        );
      },
      { unparseable: [INVALID_PROP_FILE] },
    );

    // Repeated unknown prop: every finding is 14.17, at the construct.
    const repeatedUnknown =
      "T2.7-3 `build --json` with a repeated unknown prop";
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [INVALID_PROP_FILE]: invalidPropSource(REPEATED_UNKNOWN_CONSTRUCT) },
      async (workspace) => {
        const findings = await buildFindings(
          product,
          workspace,
          repeatedUnknown,
        );
        if (findings.length === 0) {
          fail(
            `${repeatedUnknown}: the repeated unknown prop must be reported ` +
              "(SPEC 2.7, 14.17); the findings report is empty",
          );
        }
        for (const finding of findings) {
          assertSameJson(
            finding.condition,
            "14.17",
            `${repeatedUnknown}: every finding carries condition 14.17 — the ` +
              "prop is both repeated and unknown, each an invalid-prop cause " +
              `(SPEC 2.7, 14.17); message: ${JSON.stringify(finding.message)}`,
          );
          assertFindingLocated(
            finding,
            {
              file: INVALID_PROP_FILE,
              window: byteWindow(SIBLING, REPEATED_UNKNOWN_CONSTRUCT),
            },
            `${repeatedUnknown}: a 14.17 finding`,
          );
        }
      },
    );

    // Positive quoting arm.
    await withWorkspace(
      EMIT_TRUE_CONFIG,
      { "specs/A.mdx": T2_7_3_DOUBLE_QUOTED },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T2.7-3 `build` with double-quoted `id`/`coverage`/`tags`",
        );
        await assertFileBytes(
          workspace.path("specs/A.md"),
          T2_7_3_QUOTED_COMPILED,
          "T2.7-3 emitted Markdown of the double-quoted variant (SPEC 3)",
        );
        const before: NodeReport[] = [];
        for (const identity of T2_7_3_QUOTED_IDENTITIES) {
          before.push(
            await queryNode(
              product,
              workspace,
              identity,
              "T2.7-3 (double-quoted):",
            ),
          );
        }

        await workspace.file("specs/A.mdx", T2_7_3_SINGLE_QUOTED);
        await buildOk(
          product,
          workspace,
          "T2.7-3 `build` with single-quoted `id`/`coverage`/`tags` — " +
            "single- or double-quoted alike (SPEC 2.7, 2.4)",
        );
        await assertFileBytes(
          workspace.path("specs/A.md"),
          T2_7_3_QUOTED_COMPILED,
          "T2.7-3 emitted Markdown of the single-quoted variant — " +
            "byte-identical output (SPEC 2.7, 3)",
        );
        for (const [index, identity] of T2_7_3_QUOTED_IDENTITIES.entries()) {
          assertSameJson(
            await queryNode(
              product,
              workspace,
              identity,
              "T2.7-3 (single-quoted):",
            ),
            before[index],
            `T2.7-3 the full \`query node ${identity}\` report — identity, ` +
              "source range, texts, hashes, tags, coverage, and edges all " +
              "equal the double-quoted variant's: the spellings are " +
              "equivalent (SPEC 2.7, 2.4, 5.5)",
          );
        }
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T2.7-4
// ---------------------------------------------------------------------------

// The comment forms of SPEC 2.7 beyond T2.7-2's usual `{/* … */}`: an MDX
// comment is an expression container whose content — the characters between
// its braces — is nothing but whitespace and JavaScript comments as 14.20
// counts them: whitespace and line terminators ECMAScript's (1.4), a line
// comment running through the first U+000A or U+000D, and a brace on a
// commented-out line closing nothing, so the run-on `{// c}` runs to the
// next `}`. Every such form behaves as T2.7-2's comment: removed from
// Markdown output (byte-asserted, 3), absent from own text (`query node`),
// no finding, `build` exit 0, and listed in `view`'s `comments` with its full
// container range, opening brace through closing brace (11.4). A container
// holding anything else is no comment: an invalid expression container
// (14.16) where the grammar derives its content, an unparseable file (14.20)
// where it does not — U+0085 and U+200B being neither ECMAScript whitespace
// nor line terminators, and the comment grammar's own failures (T14-12). The
// code points are spelled from their values, never as escape literals.
const CARRIAGE_RETURN = String.fromCodePoint(0x0d);
const NO_BREAK_SPACE = String.fromCodePoint(0xa0);
const ZERO_WIDTH_NO_BREAK_SPACE = String.fromCodePoint(0xfeff);
const LINE_SEPARATOR = String.fromCodePoint(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCodePoint(0x2029);
const NEXT_LINE = String.fromCodePoint(0x85);
const ZERO_WIDTH_SPACE = String.fromCodePoint(0x200b);

/** One comment form of 2.7: its container's exact characters and staging. */
interface CommentForm {
  /** The form's own file, workspace-relative (one file per form). */
  readonly file: string;
  /** The arm's name in contexts. */
  readonly name: string;
  /** The container's own characters, opening brace through closing brace. */
  readonly construct: string;
  /**
   * `twin`: an inline occurrence sharing its line with retained
   * non-whitespace on both sides, then an own-line occurrence between blank
   * lines; `lone-inline`: the inline occurrence alone — the carriage-return
   * twin is staged with no later `}` in its file, so that a product ending
   * line comments at U+000A alone reads its `}` as lying on the
   * commented-out line, finds the container unclosed (14.20), and fails.
   */
  readonly layout: "twin" | "lone-inline";
}

const T2_7_4_COMMENT_FORMS: readonly CommentForm[] = [
  {
    file: "specs/empty.mdx",
    name: "the empty container `{}`",
    construct: "{}",
    layout: "twin",
  },
  {
    file: "specs/space.mdx",
    name: "ASCII whitespace between braces (`{ }`)",
    construct: "{ }",
    layout: "twin",
  },
  {
    file: "specs/blocks.mdx",
    name: "a block-comment sequence `{ /* a */ /* b */ }`",
    construct: "{ /* a */ /* b */ }",
    layout: "twin",
  },
  {
    file: "specs/line-lf.mdx",
    name: "a line-comment container ended by U+000A before its closing brace",
    construct: "{// c\n}",
    layout: "twin",
  },
  {
    file: "specs/line-cr.mdx",
    name:
      "a line-comment container ended by U+000D before its closing brace, " +
      "no later `}` in the file",
    construct: `{// c${CARRIAGE_RETURN}}`,
    layout: "lone-inline",
  },
  {
    file: "specs/run-on.mdx",
    name:
      "the run-on form `{// c}` U+000A `}`, its first brace on the " +
      "commented-out line closing nothing",
    construct: "{// c}\n}",
    layout: "twin",
  },
  {
    file: "specs/nbsp.mdx",
    name: "U+00A0 between braces",
    construct: `{${NO_BREAK_SPACE}}`,
    layout: "twin",
  },
  {
    file: "specs/feff.mdx",
    name: "U+FEFF between braces",
    construct: `{${ZERO_WIDTH_NO_BREAK_SPACE}}`,
    layout: "twin",
  },
  {
    file: "specs/ls.mdx",
    name: "U+2028 between braces",
    construct: `{${LINE_SEPARATOR}}`,
    layout: "twin",
  },
  {
    file: "specs/ps.mdx",
    name: "U+2029 between braces",
    construct: `{${PARAGRAPH_SEPARATOR}}`,
    layout: "twin",
  },
];

// Each form's file: one section holding the form inline — `Alpha ` before
// it and ` beta.` after it on its line — and, in the twin layout, once more
// on a line of its own between blank lines, then a closing paragraph.
const T2_7_4_OPEN = '<S id="sec">\nAlpha ';
const T2_7_4_AFTER_INLINE = " beta.\n\n";
const T2_7_4_AFTER_OWN_LINE = "\n\n";
const T2_7_4_CLOSE = "Gamma text.\n</S>\n";

/** A comment form staged: its bytes, its container ranges, its text. */
interface CommentFormFixture {
  readonly form: CommentForm;
  /** The file's exact bytes. */
  readonly source: string;
  /** Every container's range, brace through brace, document order (11.4). */
  readonly comments: readonly SourceRange[];
  /** The section's own text and the file's compiled output (SPEC 1.6, 3). */
  readonly text: string;
}

function commentFormFixture(form: CommentForm): CommentFormFixture {
  const { construct } = form;
  const inlineStart = utf8Bytes(T2_7_4_OPEN);
  const inline: SourceRange = {
    start: inlineStart,
    end: inlineStart + utf8Bytes(construct),
  };
  const throughInline = T2_7_4_OPEN + construct + T2_7_4_AFTER_INLINE;
  // Hand-derived per SPEC 3 (T3-3's rules): the tag lines are emptied purely
  // by removals and drop with their terminators; the inline container is
  // deleted exactly in place — a line terminator among its own characters
  // deleted with it, joining the lines it spanned into one — leaving the
  // author's two spaces; already-empty lines are kept. No construct byte
  // survives anywhere in the text.
  if (form.layout === "lone-inline") {
    return {
      form,
      source: throughInline + T2_7_4_CLOSE,
      comments: [inline],
      text: "Alpha  beta.\n\nGamma text.\n",
    };
  }
  // The own-line container's line — the lines a multi-line form spans merged
  // into one — is left empty purely by the removal and drops with its
  // terminator; the blank lines around it keep.
  const ownLineStart = utf8Bytes(throughInline);
  return {
    form,
    source: throughInline + construct + T2_7_4_AFTER_OWN_LINE + T2_7_4_CLOSE,
    comments: [
      inline,
      { start: ownLineStart, end: ownLineStart + utf8Bytes(construct) },
    ],
    text: "Alpha  beta.\n\n\nGamma text.\n",
  };
}

const T2_7_4_FIXTURES: readonly CommentFormFixture[] =
  T2_7_4_COMMENT_FORMS.map(commentFormFixture);

/** The emitted Markdown path beside a form's source (SPEC 7.3, 13.2). */
function emittedMarkdownPath(file: string): string {
  return file.replace(/\.mdx$/u, ".md");
}

/**
 * The comment forms, all in one emitting workspace: `build` exit 0 with no
 * finding, each file's emitted Markdown byte-exact with the form removed,
 * each section's own text comment-free, and each container listed under
 * `view`'s `comments` by its full range.
 */
async function runCommentForms(product: ProductBinding): Promise<void> {
  const files: Record<string, string> = {};
  for (const fixture of T2_7_4_FIXTURES) {
    files[fixture.form.file] = fixture.source;
  }
  await withWorkspace(EMIT_TRUE_CONFIG, files, async (workspace) => {
    await buildOk(
      product,
      workspace,
      "T2.7-4 `build` with emission over the comment forms of 2.7 — every " +
        "form is a comment, so no finding and exit 0 (SPEC 2.7)",
    );
    for (const fixture of T2_7_4_FIXTURES) {
      const context = `T2.7-4 (${fixture.form.name})`;
      // Removed from Markdown output: byte equality of the whole emitted
      // file against the hand-derived compilation (SPEC 2.7, 3; T3-3).
      await assertFileBytes(
        workspace.path(emittedMarkdownPath(fixture.form.file)),
        fixture.text,
        `${context}: emitted Markdown — the comment is removed by its own ` +
          "characters, exact deletion in place, an emptied own line dropped " +
          "with its terminator and a multi-line form's lines merged (SPEC " +
          "2.7, 3; T3-3)",
      );
      // Not part of own text (`query node`): exact bytes (SPEC 1.6).
      const node = await queryNode(
        product,
        workspace,
        `${fixture.form.file}#sec`,
        context,
      );
      assertBytesEqual(
        node.ownText,
        fixture.text,
        `${context}: own text — the comment is not part of it (SPEC 2.7, 1.6)`,
      );
    }

    // Listed in `view`'s `comments` with the full container range, opening
    // brace through closing brace, in document order (SPEC 11.4) — nothing
    // else in the view: no import staged, no embedding.
    const viewContext = "T2.7-4 bare `view --text` over the comment forms";
    const report = decodeViewReport(
      await runJson(
        product,
        workspace,
        ["view", "--text"],
        `${viewContext}: a finding-free answer, exit 0 (SPEC 11.2, 12.0)`,
      ),
      { text: true },
      viewContext,
    );
    assertSameJson(
      report.findings,
      [],
      `${viewContext}: every form is a comment — no finding (SPEC 2.7)`,
    );
    assertSameJson(
      report.views.map((view) => view.file),
      T2_7_4_FIXTURES.map((fixture) => fixture.form.file).sort(),
      `${viewContext}: one per-file view per discovered spec source, by byte ` +
        "order of workspace-relative path (SPEC 11.4)",
    );
    for (const fixture of T2_7_4_FIXTURES) {
      const context = `${viewContext} (${fixture.form.name})`;
      const view = report.views.find(
        (candidate) => candidate.file === fixture.form.file,
      )!;
      assertSameJson(
        view.comments,
        fixture.comments,
        `${context}: \`comments\` lists each container's source range — its ` +
          "full braced container, opening brace through closing brace, as " +
          "byte offsets (SPEC 11.4, 1.7)",
      );
      assertSameJson(
        [view.imports, view.occurrences],
        [[], []],
        `${context}: a comment is no import and no embedding — no import ` +
          "entry and no occurrence record (SPEC 2.7, 5.7, 11.4)",
      );
      const section = view.root.children[0];
      assertSameJson(
        [view.root.children.length, section?.identity],
        [1, `${fixture.form.file}#sec`],
        `${context}: the tree holds the root and the one section (SPEC 11.4)`,
      );
      assertBytesEqual(
        typeof section?.ownText === "string" ? section.ownText : "",
        fixture.text,
        `${context}: the section's own text under \`--text\` — comment-free ` +
          "(SPEC 11.4, 1.6)",
      );
    }
  });
}

// An expression beside comments is no comment: an invalid expression
// container (14.16), the grammar deriving its content — T2.7-1's
// enclosed-construct machinery pins the one finding brace through brace, the
// view's tree without a node for it, its bytes preserved as content (11.2),
// and no `comments` entry.
const T2_7_4_EXPRESSION_ARM: EnclosedConstructArm = {
  fixture: enclosedConstructFixture("{/* a */ 1}"),
  name: "an expression beside a comment (`{/* a */ 1}`)",
  soleFinding:
    "exactly one condition-16 finding, the container's, and none beside — " +
    "an expression beside comments is no comment but an invalid expression " +
    "container, the grammar deriving its content (SPEC 2.7, 14.16)",
  rangeRule:
    "the 14.16 finding locates the expression container from its opening " +
    "brace through its closing brace, as byte offsets (SPEC 14, 1.7)",
  noNode: "no node within the container — it encloses no section",
  treeShape:
    "the section tree by construct nesting — the root, `ok`, and `sec` — " +
    "with the container's bytes preserved byte-for-byte as content in " +
    "`sec`'s own and subtree text (the by-form classification of 11.2)",
};

/**
 * A form 2.7 makes unparseable (14.20), staged alone under S-9's
 * `unparseable` declaration: the one zero-length range at the offset SPEC 14
 * fixes — the byte length of the longest whole-character prefix with which
 * some well-formed file begins — precomputed from the staged bytes.
 */
interface UnparseableCommentArm {
  /** The arm's name in contexts. */
  readonly name: string;
  /** The file's exact bytes. */
  readonly source: string;
  /** The pinned offset (SPEC 1.7 bytes). */
  readonly offset: number;
  /** Why SPEC 14 fixes that offset. */
  readonly rule: string;
}

const T2_7_4_UNPARSEABLE_FILE = "specs/A.mdx";
const T2_7_4_UNPARSEABLE_PREFIX = `${SIBLING}<S id="bad">\nAlpha.\n\n`;
const T2_7_4_UNPARSEABLE_SUFFIX = "\n\nOmega.\n</S>\n";

/** A construct on a line of its own inside the section after the sibling. */
function unparseableInSection(
  construct: string,
  within: number,
  name: string,
  rule: string,
): UnparseableCommentArm {
  return {
    name,
    source: T2_7_4_UNPARSEABLE_PREFIX + construct + T2_7_4_UNPARSEABLE_SUFFIX,
    offset: utf8Bytes(T2_7_4_UNPARSEABLE_PREFIX) + within,
    rule,
  };
}

const T2_7_4_CODE_POINT_RULE =
  "the zero-length range at the offset of the code point — neither U+0085 " +
  "nor U+200B is ECMAScript whitespace or a line terminator (14.20 excludes " +
  "both by name), so the content is no empty expression, and neither begins " +
  "any token of the grammar, so it derives no expression either; the prefix " +
  "through `{` begins a well-formed file (SPEC 14, 14.20, 1.4; T14-11)";
const T2_7_4_FIRST_BRACE_RULE =
  "the zero-length range at the offset of the first `}` — the deletion " +
  "judgement runs the line comment through U+000A, so the first brace " +
  "closes nothing, while the lexical grammar ends the comment at the " +
  "separator and finds a brace token; the prefix through the separator " +
  "begins a well-formed file, the one through the brace none (SPEC 14, " +
  "14.20; T14-12)";
const T2_7_4_RUN_ON_TAIL = "{// c}\n";
const T2_7_4_RUN_ON_SOURCE = `${SIBLING}${T2_7_4_RUN_ON_TAIL}`;

const T2_7_4_UNPARSEABLE_ARMS: readonly UnparseableCommentArm[] = [
  unparseableInSection(
    `{${NEXT_LINE}}`,
    utf8Bytes("{"),
    "U+0085 between braces",
    T2_7_4_CODE_POINT_RULE,
  ),
  unparseableInSection(
    `{${ZERO_WIDTH_SPACE}}`,
    utf8Bytes("{"),
    "U+200B between braces",
    T2_7_4_CODE_POINT_RULE,
  ),
  unparseableInSection(
    `{// c${LINE_SEPARATOR}}\n}`,
    utf8Bytes(`{// c${LINE_SEPARATOR}`),
    "`{// c` U+2028 `}` U+000A `}`",
    T2_7_4_FIRST_BRACE_RULE,
  ),
  unparseableInSection(
    `{// c${PARAGRAPH_SEPARATOR}}\n}`,
    utf8Bytes(`{// c${PARAGRAPH_SEPARATOR}`),
    "`{// c` U+2029 `}` U+000A `}`",
    T2_7_4_FIRST_BRACE_RULE,
  ),
  {
    name: "`{// c}` as the file's last construct, no later `}` in the file",
    source: T2_7_4_RUN_ON_SOURCE,
    offset: utf8Bytes(T2_7_4_RUN_ON_SOURCE),
    rule:
      "the zero-length range at the file's byte length — the first `}` " +
      "lies on the commented-out line and closes nothing, and the whole " +
      "file is a prefix of a well-formed one, a later `}` closing the " +
      "container (SPEC 14, 14.20, 2.7; T14-12)",
  },
];

/**
 * The five stagings as T14-11 re-asserts them (TEST-SPEC T14-11's closing
 * clause): each arm's bytes as `specs/A.mdx` with its offset — the same
 * staging `runUnparseableCommentArm` drives; declared unparseable under S-9
 * wherever staged.
 */
export const T2_7_4_UNPARSEABLE_STAGINGS: readonly UnparseableStaging[] =
  T2_7_4_UNPARSEABLE_ARMS.map((arm): UnparseableStaging => ({
    name: `${arm.name} (T2.7-4)`,
    kind: "spec-source",
    file: T2_7_4_UNPARSEABLE_FILE,
    files: { [T2_7_4_UNPARSEABLE_FILE]: arm.source },
    offset: arm.offset,
  }));

/** One unparseable form: `build --json`, then the bare `view --text`. */
async function runUnparseableCommentArm(
  product: ProductBinding,
  arm: UnparseableCommentArm,
): Promise<void> {
  const assertUnparseable = (
    findings: readonly Finding[],
    context: string,
  ): void => {
    assertConditionCounts(
      findings,
      { "14.20": 1 },
      `${context}: 14.20 alone — the container's content is no empty ` +
        "expression and derives no expression, so the file is not " +
        "well-formed MDX, and an unparseable file masks every other " +
        "condition (SPEC 2.7, 14.20; T14-3)",
    );
    assertSoleLocationExactly(
      findings[0]!,
      T2_7_4_UNPARSEABLE_FILE,
      { start: arm.offset, end: arm.offset },
      `${context}: ${arm.rule}`,
    );
  };
  await withWorkspace(
    SPECS_ONLY_CONFIG,
    { [T2_7_4_UNPARSEABLE_FILE]: arm.source },
    async (workspace) => {
      const buildContext = `T2.7-4 \`build --json\` with ${arm.name}`;
      assertUnparseable(
        await buildFindings(product, workspace, buildContext),
        buildContext,
      );
      const viewContext = `T2.7-4 bare \`view --text\` with ${arm.name}`;
      const result = await expectExit(
        product,
        workspace,
        ["view", "--text"],
        1,
        `${viewContext}: the parse-failure finding accompanies the answer, ` +
          "so exit 1 (SPEC 11.2, 11.4, 12.0; T14-4)",
      );
      const report = decodeViewReport(
        parseJsonStdout(
          result,
          `${viewContext}: a single JSON document is the only output form (SPEC 11)`,
        ),
        { text: true },
        viewContext,
      );
      assertUnparseable(
        report.findings,
        `${viewContext}: the accompanying findings (SPEC 11.2; T14-4)`,
      );
      assertSameJson(
        report.views.map((view) => view.file),
        [],
        `${viewContext}: an unparseable requested file contributes no view ` +
          "(SPEC 11.4), and it is the only discovered spec source",
      );
    },
    { unparseable: [T2_7_4_UNPARSEABLE_FILE] },
  );
}

const T2_7_4 = defineProductTest({
  id: "T2.7-4",
  title:
    "every comment form of 2.7 — `{}`, ASCII and ECMAScript-only whitespace between braces (U+00A0, U+FEFF, U+2028, U+2029), a block-comment sequence, line-comment containers ended by U+000A or U+000D before their closing brace, and the run-on `{// c}` U+000A `}` — is removed from Markdown output byte-exactly, absent from own text, finding-free with `build` exit 0, and listed in `view`'s `comments` brace through brace; an expression beside a comment is one 14.16 brace through brace with no `comments` entry; U+0085 or U+200B between braces, `{// c` U+2028/U+2029 `}` U+000A `}`, and `{// c}` with no later `}` are 14.20 at the offsets SPEC 14 fixes (SPEC 2.7, 14.16, 14.20, 1.4, 3, 11.2, 11.4)",
  run: async (product) => {
    await runCommentForms(product);
    await runEnclosedConstructArm(product, "T2.7-4", T2_7_4_EXPRESSION_ARM);
    for (const arm of T2_7_4_UNPARSEABLE_ARMS) {
      await runUnparseableCommentArm(product, arm);
    }
  },
});

/** TEST-SPEC §2.7, in canonical ID order (SUITE-10). */
export const section27Tests: readonly ProductTestEntry[] = [
  T2_7_1,
  T2_7_2,
  T2_7_3,
  T2_7_4,
];
