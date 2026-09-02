// TEST-SPEC §6.5 (move) — SUITE-25: T6.5-1…T6.5-7.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), decodes output through the H-3 adapters,
// and rejects a product only via diagnosed assertion failures (H-8).
//
// SPEC 6.5: `xspec move <old-file> <new-file>` relocates a source file (IDs
// unchanged, identities change file part only, the moved file's own import
// specifiers and other files' imports of its generated module rewritten so
// everything resolves); `xspec move <file>#<id> <target-file>#<new-id>`
// extracts a section subtree, re-identified by prefix replacement, with exact
// text edits: the moved text is the construct's own characters (or the
// self-closing tag's own characters, 1.1); origin lines left empty or
// whitespace-only purely by the deletion are dropped with their terminators
// (rule of 3); insertion is immediately before the target parent's closing
// tag (end of file for a top-level `new-id`), followed by U+000A and preceded
// by one when the insertion point is not at the start of a line; a
// self-closing target parent is first rewritten to paired form; the target
// file is created when absent. Beyond these edits, the identity and reference
// rewrites, and the finishing regeneration, a move changes no bytes. All
// references are rewritten to resolve, converting between local and imported
// forms; imports are added binding fresh, non-colliding identifiers and
// removed exactly when a binding had references and the rewrite leaves it
// with none; the full mapping is appended to the journal in both forms;
// rewritten content is byte-deterministic. Validation mirrors rename (6.4) in
// identity terms, plus move-specific refusals; a nonexistent origin file or
// ID is a usage error (12.0).
//
// Conservative operationalizations (noted per H-4):
// - T6.5-1 "rewritten so everything resolves" is asserted as the specifier
//   rewrite's byte contract (TEST-SPEC T6.5-1): the `import-specifier-rewrite`
//   ranges are read by running the preview on a copy of the fixture (SPEC
//   6.6: a rewrite's range is the specifier literal's characters, in
//   pre-operation coordinates), and after the real move each rewritten file
//   — the moved file, the importing `.mdx`, the importing `.ts` — must be
//   its pre-move bytes with exactly those ranges replaced by one string
//   literal of 2.1's form designating the right module from the file's
//   post-move directory (6.5: beyond its exact edits a move changes no
//   bytes). SPEC pins the form, not a canonical spelling (several relative
//   paths resolve to one file), so the literal's quote kind and relative
//   spelling are the product's, resolved rather than compared; `check`
//   exit 0 then enforces that everything actually resolves (12.2).
// - "Mapping appended to the journal" uses the SUITE-21 operationalization:
//   the journal (absent before the first journaled operation, SPEC 6.1) is a
//   plain file holding exactly one line-oriented entry after the one move;
//   entry content stays opaque (H-4). T6.5-1 asserts it for the file form,
//   T6.5-3 for the section form — "the full mapping … (6.5: both forms)".
// - The applied-mapping report — "a successful move … reports its applied
//   mapping, as rename does" (SPEC 6.5, 6.4) — is asserted with T6.4-1's
//   protocol: the move runs with `--json` (a single JSON document as the
//   entire stdout, 12.0), its report decodes through the H-3
//   `decodeAppliedMappingReport` adapter (the successful operation's report
//   shape is unpinned), and the decoded pairs are asserted as a complete set
//   (`assertAppliedMapping`) — every identity pair the operation journaled,
//   the information of the preview's `mapping` (SPEC 6.4, 6.6). Both forms
//   report as rename does, split as the journal clause is: T6.5-1 decodes
//   the file form's report — every node of the moved file mapped, the
//   implicit root included (its identity is the path alone, 1.2, 1.5), IDs
//   kept and file parts changed — and T6.5-3 the section form's: exactly
//   the moved subtree's prefix-replaced pairs, no other identity mapped.
// - T6.5-1/T6.5-3 "finishing regeneration as T6.4-7" is the H-6 two-directory
//   protocol: a second workspace is seeded with the post-move configuration,
//   sources, and journal (derived files are reproducible from those,
//   SPEC 13.4), `xspec build` runs there, and the two workspace roots are
//   compared as whole byte trees, normalizing nothing.
// - T6.5-2 compares every staged source file byte-exactly after the move; an
//   uninvolved bystander file in each arm witnesses "no other byte changes".
//   The finishing regeneration's derived files are deliberately outside these
//   compares (they are T6.5-1/T6.5-3's fresh-build business).
// - T6.5-3 identifier choice and placement for added imports are
//   deterministic per SPEC 6.5/6.1 but their concrete spelling is
//   product-chosen, so freshness/non-collision is asserted through the
//   observable contract: the target file already binds the identifier `Keep`
//   (to another module) that the added `./Keep.xspec` import would naturally
//   take, so a non-fresh choice becomes a duplicate binding (14.15) and fails
//   the post-move `check`; byte determinism itself is the H-6 two-directory
//   protocol over the whole move (rewritten sources, derived files, and
//   journal alike). Conversion spellings that 6.4's rules do pin — converted
//   references become double-quoted string literals, kept forms keep their
//   quote style — are asserted as exact substrings (`d={"tm"}`,
//   `{text("tm.k1")}`, `d={"tm.k1"}`).
// - T6.5-4/T6.5-6 refusal arms run with `--json`: a refused operation's
//   report is the form-exact 12.7 findings-only report (SPEC 12.7, H-3), and
//   each arm asserts exactly one finding per applicable refusal reason,
//   carrying its exact stable code (SPEC 14: one finding per applicable
//   reason, every applicable reason reported together; TEST-SPEC preamble: a
//   code is contract) — most arms stage a single cause; T6.5-4's
//   out-of-group `.mdx` occupant stages two applicable reasons at once —
//   with the concern §14 assigns the reason: the concerned identity
//   (refused-invalid-id, refused-identity-unchanged,
//   refused-missing-target-parent; the full 1.5 identity or its bare ID —
//   §14 requires identification, not spelling), the concerned path
//   (refused-destination-exists, refused-invalid-destination), or a located
//   participant (refused-id-collision locates every colliding bearer — the
//   remaining bearer's construct is the window where the staged bytes are
//   known; refused-cycle locates every reference spelling recording a
//   participating dependency edge — the `d={"keep"}` spelling for the
//   dependency-cycle arm, while the would-be spec-import cycle's
//   participating import declarations exist in no pre-operation source, so
//   that arm pins the code and form alone). "Modifies nothing" stays the
//   whole-workspace-root byte snapshot compare around each refused command
//   with the pre-refusal `build`'s derived files present (the T6.4-3
//   protocol); because each arm proves it modified nothing, the arms share
//   one staged workspace — except the derived-path arm, which stages its
//   own: it needs `markdown.outDir` emission and a spec glob admitting the
//   destination `new/b.mdx` (SPEC 7.3, 13.2). The precondition arm's
//   invalid-workspace refusal
//   instead reports the workspace's numbered findings alone (SPEC 14, 6.4):
//   exactly its one 14.5 finding located in the offending file. The 6.5
//   destination clauses "containing `#`" and "not valid UTF-8" admit no
//   refusal staging (T6.5-4's dead-letter note): every operand spelling that
//   would present either is an exit-2 usage error before any refusal is
//   evaluated — those stagings are T6.5-5's.
// - T6.5-5 exit-2 arms run with `--json`: stdout exactly one 12.7 error
//   document (12.0: with JSON output in effect, an exit-2 invocation emits
//   the error document as its entire stdout — no report, no validation
//   findings: the 12.0-ordering discriminator) and the usage error message
//   on stderr (presence, not wording). The existence and kind checks ride
//   both a valid workspace and the ordering arm's failing one (12.0:
//   checked before source validation, as T6.4-4): a nonexistent origin
//   file — in each form, both of T6.4-4's spellings: absent on disk, and a
//   valid `.mdx` present on disk (holding a section spelling the origin
//   ID) but matched by no spec group, its absence from the discovered set
//   pinned through `ids --json` on the valid workspace (a file named in an
//   argument exists as a member of the discovered set, SPEC 12.0) — or
//   origin ID, and a discovered code source as the origin in each
//   form — both forms' origin operands name discovered spec sources
//   (SPEC 6.5), so a code-source origin is a wrong-kind operand, judged
//   like existence before any content question — the wrong-kind arms on
//   the valid workspace inside whole-root modifies-nothing snapshot
//   compares (a product accepting a code origin would relocate the file or
//   act on its named unit), and the existence table inside one such
//   compare in the valid-workspace and ordering arms alike (a product
//   probing the filesystem for the stray origin would move it). The
//   masking arm asserts exit 1 with exactly
//   one 14.20 finding naming the unparseable origin file, and origin-ID
//   existence is parse-local over spelled identities, as T6.4-4
//   (SPEC 6.5, 6.4, 11.2): an origin ID two sections both spell, or one
//   whose sole bearer spells it beneath an ancestor spelling no identity,
//   exists — the invalid-workspace refusal reports the workspace's one
//   14.3 or 14.1 finding instead (exit 1, never exit 2, nothing modified,
//   the target file not created) — while an origin ID whose only would-be
//   bearer spells no identity (its `id` attribute repeated on the tag, a
//   14.17 premise pinned via `build`) is nonexistent: exit 2 even beside
//   that file's findings. Operand classification is by spelling alone
//   (SPEC 6.5: an operand containing `#` is a `<file>#<id>` pair under the
//   12.0 split, one without is a file): the three mixed-synopsis
//   invocations — bare-file origin with pair destination, pair origin with
//   bare-file destination, and the `#`-containing file-form destination
//   classified as a pair (T6.5-4's dead-letter note) — match neither
//   synopsis and exit 2, each inside a whole-root modifies-nothing
//   snapshot compare (every operand names staged content, so a product
//   accepting a mixed form would perform a move); and a non-UTF-8
//   destination operand, a usage-error argument value (SPEC 12.0), is
//   staged on the Linux leg only (mirroring T1.5-2's platform note): argv
//   bytes exist as a channel there, carried by the subprocess driver's
//   raw-byte argv support.
// - T6.5-7 asserts the real move's operation-side rewrite bytes — the
//   assertion T6.5-2's no-other-byte-changes check excludes and T6.6-4 makes
//   only of the preview's report — as whole-file byte compares against
//   independently composed expected constants (H-4, normalizing nothing),
//   each delta cited to the rule of SPEC 6.5, 6.4, or 3 that forces it. The
//   fixture is staged so no import is added: every moved reference converts
//   imported → local, the one rewrite direction free of implementation
//   latitude (SPEC 6.5: identifier choice and insertion offset attach to
//   added imports alone), so the two files' post-move bytes are the rules'
//   unique composition; the moved subtree spells a descendant's `id`
//   attribute single-quoted (SPEC 2.7), re-identified with its quotes kept
//   (SPEC 6.4: minimal in-place edits bind the `id`-attribute rewrite as
//   they bind references, T6.4-2). The code-source counterpart, two `.ts`
//   files in the same workspace, each importing the origin, target, and
//   third modules with the origin binding referenced only by markers on
//   moved nodes (SPEC 4.5): the origin declaration alone on its line in one
//   file and following the third module's on a shared line in the other,
//   removed with 6.5's exact extent as in MDX, the moved markers re-rooted
//   at the existing target binding (no import added), each file byte-equal
//   to its composed expectation. A premise `build` pins the staging valid
//   (the shared-line two-declaration import blocks parse, SPEC 2.1, 4) and
//   a post-move `check` guards the composition's soundness: if the product's
//   bytes equal the expected bytes yet something failed to resolve, the
//   staging itself was defective and must fail loud.
// - T6.5-6's unstageable clauses are documented at the test, per TEST-SPEC:
//   the collision clause's after-the-removal qualifier admits no
//   discriminating fixture (structural IDs make the vacated set exactly the
//   moved subtree's IDs, so a `<new-id>` matching only vacated identities is
//   always independently refused), and the mirrored "all rewritten references
//   resolve" clause is unstageable for T6.4-3's reason.

import { Buffer } from "node:buffer";
import * as fsp from "node:fs/promises";
import { join as joinPath, posix as posixPath } from "node:path";
import type {
  GraphEdge,
  PreviewFileEntry,
  SourceRange,
} from "../../helpers/adapters/index.js";
import {
  decodeAppliedMappingReport,
  decodeEdgesReport,
  decodeFindingsReport,
  decodeIdsReport,
  decodeNodeRowsReport,
  decodePreviewReport,
  renderPathValue,
} from "../../helpers/adapters/index.js";
import {
  assertBytesEqual,
  assertExitCode,
  assertFileBytes,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { assertAcrossDirectoriesDeterministic } from "../../helpers/determinism.js";
import { assertAddedImportInsertion } from "../../helpers/import-insertion.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import {
  assertDirectoriesEqual,
  assertLeavesUnchanged,
} from "../../helpers/snapshot.js";
import { runProduct } from "../../helpers/subprocess.js";
import type {
  ArgvValue,
  ProductBinding,
  RunResult,
} from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { ConcernedIdentity, FindingSourceExpectation } from "./support.js";
import {
  assertAppliedMapping,
  assertConditionCounts,
  assertEdgeSetEqual,
  assertFindingConcernsPath,
  assertFindingLocated,
  assertFindingMentionsLocation,
  assertFindingNamesIdentity,
  assertSameJson,
  buildFindings,
  buildOk,
  byteWindow,
  expectErrorDocument,
  expectExit,
  runJson,
  sortedIdentities,
} from "./support.js";

// Exactly one spec group (SPEC 7), for the byte-exact edit and identity-terms
// fixtures.
const SPECS_ONLY_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`;

// One spec group plus one code group (SPEC 7.2), for T6.5-5's wrong-kind
// origin arms: the staged code source is discovered, so a code-source origin
// operand is a wrong-kind usage error in either form (SPEC 6.5, 6.4, 12.0).
const SPEC_AND_CODE_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: {
    app: ["src/**/*.ts"]
  }
})
`;

// One spec group plus Markdown emission (SPEC 7.3), so T6.5-3's fresh-build
// compare covers generated modules, Markdown output, and graph data alike.
const SPECS_MD_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  markdown: { emit: true }
})
`;

// Specs, code, and Markdown emission, for the T6.5-1 file-form fixture whose
// rewrites span MDX and TypeScript sources and whose fresh-build compare
// covers every derived-file kind (the T6.4-7 configuration).
const FULL_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: {
    app: ["src/**/*.ts"]
  },
  markdown: { emit: true }
})
`;

// The T6.5-4 refusal configuration: the second spec glob admits `.mdx`-less
// destinations under `specs/plain/` (isolating the lacking-`.mdx` refusal
// from the no-spec-group one), and the code group overlaps the spec globs at
// `specs/dual/` (the belonging-to-a-code-group-as-well refusal, 14.14). Both
// extra globs match no staged file, so the workspace itself stays valid.
const REFUSAL_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx", "specs/plain/**"]
  },
  code: {
    dual: ["specs/dual/**"]
  }
})
`;

const JOURNAL_PATH = ".xspec/journal";
const LF = 0x0a;

/** Stage a fresh workspace (config plus `files`), run `body`, dispose (H-1). */
async function withWorkspace<T>(
  config: string,
  files: Readonly<Record<string, string>>,
  body: (workspace: TestWorkspace) => Promise<T>,
): Promise<T> {
  const workspace = await TestWorkspace.create({
    files: { "xspec.config.ts": config, ...files },
  });
  try {
    return await body(workspace);
  } finally {
    await workspace.dispose();
  }
}

/**
 * Read the journal's exact bytes, failing diagnosed (H-8) when the path does
 * not hold a plain file (SPEC 6.1: the file comes into existence with the
 * first journaled operation; 13.4: durable files are plain files).
 */
async function readJournal(
  workspace: TestWorkspace,
  context: string,
): Promise<Uint8Array> {
  const kind = await workspace.kind(JOURNAL_PATH);
  if (kind !== "file") {
    fail(
      `${context}: expected the journal as a plain file at ${JOURNAL_PATH} ` +
        `(SPEC 6.1, 13.4); found ${kind}`,
    );
  }
  return await workspace.readBytes(JOURNAL_PATH);
}

/**
 * Lines in a line-oriented file, tolerating a terminated or unterminated
 * final line (0 for an empty file) — the fixed H-4 operationalization of
 * "one entry per line" (SUITE-21).
 */
function journalLineCount(bytes: Uint8Array): number {
  if (bytes.length === 0) return 0;
  let count = 0;
  for (const byte of bytes) {
    if (byte === LF) count += 1;
  }
  if (bytes[bytes.length - 1] !== LF) count += 1;
  return count;
}

/** Assert the journal holds exactly one line-oriented entry (SPEC 6.1, 6.5). */
async function assertJournalHoldsOneEntry(
  workspace: TestWorkspace,
  context: string,
): Promise<void> {
  const journal = await readJournal(workspace, context);
  const lines = journalLineCount(journal);
  if (lines !== 1) {
    fail(
      `${context}: the move must append its full mapping to the journal as ` +
        `exactly one line-oriented entry — the journal came into existence ` +
        `with this first journaled operation (SPEC 6.5, 6.1); found ` +
        `${String(lines)} line(s) in ${String(journal.length)} bytes`,
    );
  }
}

/**
 * Assert `query nodes` enumerates exactly the expected requirement-node
 * identities (SPEC 11; the workspace-relative identity form of SPEC 1.5).
 */
async function assertNodeIdentities(
  product: ProductBinding,
  workspace: TestWorkspace,
  expected: readonly string[],
  reason: string,
  context: string,
): Promise<void> {
  const label = `${context} \`query nodes\``;
  const rows = decodeNodeRowsReport(
    await runJson(product, workspace, ["query", "nodes"], label),
    label,
  );
  assertSameJson(
    sortedIdentities(rows),
    [...expected].sort(),
    `${label}: ${reason}`,
  );
}

/**
 * The workspace's complete edge set of one dependency kind, via
 * `query edges --kinds <kind>` (SPEC 11), for exact-set comparison (5.2).
 */
async function queryEdgesOfKind(
  product: ProductBinding,
  workspace: TestWorkspace,
  kind: "depends" | "embeds" | "references",
  context: string,
): Promise<readonly GraphEdge[]> {
  const label = `${context} \`query edges --kinds ${kind}\``;
  return decodeEdgesReport(
    await runJson(
      product,
      workspace,
      ["query", "edges", "--kinds", kind],
      label,
    ),
    label,
  );
}

/**
 * Read a workspace source file as UTF-8 text, failing diagnosed (H-8) when
 * the path does not hold a plain file.
 */
async function readSourceText(
  workspace: TestWorkspace,
  rel: string,
  context: string,
): Promise<string> {
  const kind = await workspace.kind(rel);
  if (kind !== "file") {
    fail(`${context}: expected a plain file at ${rel}; found ${kind}`);
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(
    await workspace.readBytes(rel),
  );
}

/** Assert a rewritten source still contains `needle` (SPEC 6.5), diagnosed. */
function assertContains(
  text: string,
  rel: string,
  needle: string,
  why: string,
  context: string,
): void {
  if (!text.includes(needle)) {
    fail(
      `${context}: ${rel} does not contain ${JSON.stringify(needle)} — ${why}`,
    );
  }
}

/** Assert a rewritten source no longer contains `needle`, diagnosed. */
function assertLacks(
  text: string,
  rel: string,
  needle: string,
  why: string,
  context: string,
): void {
  if (text.includes(needle)) {
    fail(
      `${context}: ${rel} still contains ${JSON.stringify(needle)} — ${why}`,
    );
  }
}

/** UTF-8 byte length of `text` — SPEC 1.7 ranges are byte offsets. */
function utf8Length(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

/**
 * Byte span (SPEC 1.7) of exactly one occurrence of `fragment` in `source`.
 * An absent or ambiguous fragment is a staging defect — a harness error,
 * never a product failure: a precomputed span must name its bytes uniquely.
 */
function uniqueSpan(
  source: string,
  fragment: string,
  where: string,
): SourceRange {
  const first = source.indexOf(fragment);
  if (first === -1) {
    throw new Error(
      `${where}: staging locator — fragment ${JSON.stringify(fragment)} ` +
        `not found`,
    );
  }
  if (source.indexOf(fragment, first + 1) !== -1) {
    throw new Error(
      `${where}: staging locator — fragment ${JSON.stringify(fragment)} ` +
        `is ambiguous`,
    );
  }
  const start = utf8Length(source.slice(0, first));
  return { start, end: start + utf8Length(fragment) };
}

/**
 * The `import-specifier-rewrite` ranges a completed preview reports for the
 * file at `rel` — its current, pre-operation path — in the report's own
 * order (SPEC 6.6: every file the operation would rewrite, with every edit
 * it would make there, each classed; 12.7: edits ordered by range start).
 * A file the preview lists other than exactly once, or without a specifier
 * rewrite, fails diagnosed: the caller's fixture stages in each such file
 * one specifier the file-form move must rewrite.
 */
function specifierRewriteRanges(
  files: readonly PreviewFileEntry[],
  rel: string,
  context: string,
): readonly SourceRange[] {
  const entries = files.filter((entry) => entry.file === rel);
  if (entries.length !== 1) {
    fail(
      `${context}: the preview must list ${rel} exactly once among the ` +
        `files the move would rewrite (SPEC 6.6, 12.7); found it ` +
        `${entries.length} time(s) in [${files
          .map((entry) => renderPathValue(entry.file))
          .join(", ")}]`,
    );
  }
  const ranges = entries[0]!.edits
    .filter((edit) => edit.class === "import-specifier-rewrite")
    .map((edit) => edit.range);
  if (ranges.length === 0) {
    fail(
      `${context}: the preview's entry for ${rel} reports no ` +
        `\`import-specifier-rewrite\` edit, yet the relocation must rewrite ` +
        `the specifier staged there (SPEC 6.5, 6.6)`,
    );
  }
  return ranges;
}

/** The first offset at which two byte runs differ, or -1 when equal. */
function firstDifference(a: Uint8Array, b: Uint8Array): number {
  const shared = Math.min(a.length, b.length);
  for (let i = 0; i < shared; i += 1) {
    if (a[i] !== b[i]) return i;
  }
  return a.length === b.length ? -1 : shared;
}

/** Up to 24 bytes of `bytes` from `offset`, rendered for a diagnosis. */
function excerpt(bytes: Uint8Array, offset: number): string {
  return JSON.stringify(
    Buffer.from(bytes.subarray(offset, offset + 24)).toString("utf8"),
  );
}

/**
 * The file-form move's specifier-rewrite byte contract (TEST-SPEC T6.5-1).
 * `post` must be `pre` with each previewed range — read on a copy, in
 * pre-operation coordinates (SPEC 6.6, 1.7) — replaced by one string
 * literal and nothing else (6.5: beyond its exact edits a move changes no
 * bytes): the splice walks `pre` and `post` together, requiring every byte
 * outside the ranges to recur at its spliced position, and reads each
 * range's post-move content as one quoted literal — the quote kind the
 * product's, no quote byte inside — whose text has 2.1's form (a relative
 * path beginning with `./` or `../` and ending in `.xspec`) and, resolved
 * against `importerDir`, the importing file's post-move directory,
 * designates `expectedModule` (2.1: `DIR/NAME.xspec` designates
 * `DIR/NAME.mdx`). The relative spelling is the product's — 2.1 pins the
 * form, not a canonical spelling — so it is resolved, never compared.
 */
function assertSpecifierRewriteByteContract(
  options: {
    readonly rel: string;
    readonly pre: Uint8Array;
    readonly post: Uint8Array;
    readonly ranges: readonly SourceRange[];
    readonly importerDir: string;
    readonly expectedModule: string;
  },
  context: string,
): void {
  const { rel, pre, post, ranges, importerDir, expectedModule } = options;
  const postBuf = Buffer.from(post.buffer, post.byteOffset, post.byteLength);
  let preCursor = 0;
  let postCursor = 0;
  for (const range of ranges) {
    if (
      range.start < preCursor ||
      range.end <= range.start ||
      range.end > pre.length
    ) {
      fail(
        `${context}: ${rel} — the previewed import-specifier-rewrite range ` +
          `[${range.start}, ${range.end}) must be non-empty, lie within the ` +
          `${pre.length} pre-move bytes, and follow the preceding range ` +
          `(SPEC 6.6, 1.7)`,
      );
    }
    // Bytes outside the ranges: the pre-move run before this range recurs
    // verbatim at its spliced position.
    const kept = pre.subarray(preCursor, range.start);
    const spliced = post.subarray(postCursor, postCursor + kept.length);
    const drift = firstDifference(kept, spliced);
    if (drift !== -1) {
      fail(
        `${context}: ${rel} — bytes outside the previewed ` +
          `import-specifier-rewrite ranges changed: from pre-move byte ` +
          `${preCursor + drift} the file held ${excerpt(kept, drift)}… and ` +
          `now holds ${excerpt(spliced, drift)}… there — a file-form move ` +
          `rewrites nothing beyond the specifier literals (SPEC 6.5, 6.6)`,
      );
    }
    postCursor += kept.length;
    // The range's post-move content: exactly one quoted string literal.
    const quote = post[postCursor];
    if (quote !== 0x22 && quote !== 0x27) {
      fail(
        `${context}: ${rel} — at the previewed import-specifier-rewrite ` +
          `range [${range.start}, ${range.end}) the file must hold one ` +
          `quoted specifier literal; found ${excerpt(post, postCursor)}… ` +
          `(SPEC 6.6, 2.1)`,
      );
    }
    const close = postBuf.indexOf(quote, postCursor + 1);
    if (close === -1) {
      fail(
        `${context}: ${rel} — the specifier literal opened at post-move ` +
          `byte ${postCursor} is never closed (SPEC 2.1)`,
      );
    }
    const specifier = postBuf.subarray(postCursor + 1, close).toString("utf8");
    const relative = specifier.startsWith("./") || specifier.startsWith("../");
    if (!relative || !specifier.endsWith(".xspec")) {
      fail(
        `${context}: ${rel} — the rewritten specifier ` +
          `${JSON.stringify(specifier)} must be a relative path beginning ` +
          `with \`./\` or \`../\` and ending in \`.xspec\` (SPEC 2.1)`,
      );
    }
    const resolved = posixPath.join(importerDir, specifier);
    if (resolved !== expectedModule) {
      fail(
        `${context}: ${rel} — the rewritten specifier ` +
          `${JSON.stringify(specifier)}, resolved against the file's ` +
          `directory ${importerDir}/, designates ${resolved}; the ` +
          `relocation must make it designate ${expectedModule} so the ` +
          `import resolves (SPEC 6.5, 2.1)`,
      );
    }
    postCursor = close + 1;
    preCursor = range.end;
  }
  // After the last range: the pre-move tail recurs and nothing follows it.
  const preTail = pre.subarray(preCursor);
  const postTail = post.subarray(postCursor);
  const drift = firstDifference(preTail, postTail);
  if (drift !== -1) {
    fail(
      `${context}: ${rel} — after the last previewed ` +
        `import-specifier-rewrite range the file must end with its ` +
        `pre-move bytes verbatim; they diverge at pre-move byte ` +
        `${preCursor + drift} (pre ${excerpt(preTail, drift)}…, post ` +
        `${excerpt(postTail, drift)}…) — a file-form move rewrites nothing ` +
        `beyond the specifier literals (SPEC 6.5, 6.6)`,
    );
  }
}

/** Human rendering of an argv that may carry raw-byte elements. */
function renderArgv(argv: readonly ArgvValue[]): string {
  return argv
    .map((arg) =>
      typeof arg === "string"
        ? arg
        : `<bytes 0x${Buffer.from(arg).toString("hex")}>`,
    )
    .join(" ");
}

/**
 * What one finding of a refused move's report must hold (SPEC 14, 12.7):
 * its exact stable code plus whichever concern §14 assigns the reason: a
 * located participant, a concerned identity, a concerned path, or nothing
 * further where no pre-operation construct renders the concern. An arm
 * staging several applicable reasons passes one expectation per reason
 * (SPEC 14: every applicable reason reports together, one finding each).
 * Exported for T6.6-3, which stages T6.5-4's refusals identically and
 * asserts the `--preview` invocation's refusal equivalence (TEST-SPEC §6.6).
 */
export interface RefusalExpectation {
  /**
   * The finding's counting key (`assertConditionCounts` vocabulary): a
   * stable refusal code token (`refused-…`), or a `14.N` condition identity
   * for the invalid-workspace refusal, which reports the workspace's
   * numbered findings alone (SPEC 14, 6.4, 6.5).
   */
  readonly finding: string;
  /** At least one location names this file (and byte window when given). */
  readonly locatedAt?: FindingSourceExpectation;
  /** At least one identities entry names this concerned identity. */
  readonly identity?: ConcernedIdentity;
  /** The finding's 12.7 path member equals this workspace-relative path. */
  readonly path?: string;
}

/**
 * A refused move (SPEC 6.5: every validation failure beyond the argument
 * existence checks refuses with exit 1): run with `--json`, assert exit 1
 * exactly, decode stdout as the form-exact 12.7 findings-only report of a
 * refused operation (SPEC 12.7, H-3), assert the report holds exactly one
 * finding per expected refusal reason — its stable code with its concerned
 * data (SPEC 14, T14-7: every applicable reason together, one finding each,
 * and none beside) — and assert the refusal modifies nothing — a
 * whole-workspace-root byte snapshot compare around the command (derived
 * files, sources, and the journal all included). Per-reason concern lookup
 * is by counting key, total because a refusal report never carries two
 * findings of one reason (SPEC 14: one finding per reason).
 */
async function expectRefusalModifiesNothing(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  expected: RefusalExpectation | readonly RefusalExpectation[],
  context: string,
): Promise<void> {
  const expectations: readonly RefusalExpectation[] = Array.isArray(expected)
    ? expected
    : [expected];
  const command = argv.join(" ");
  await assertLeavesUnchanged(
    workspace.root,
    async () => {
      const result = await runProduct(product, {
        cwd: workspace.root,
        argv: [...argv, "--json"],
      });
      assertExitCode(
        result,
        1,
        `${context}: \`${command} --json\` — the refusal is a validation ` +
          `failure, exit 1 (SPEC 6.5, 12.0)`,
      );
      const findings = decodeFindingsReport(
        parseJsonStdout(result, `${context}: \`${command} --json\``),
        `${context}: \`${command} --json\` — a refused operation's report ` +
          `is the form-exact 12.7 findings-only report (SPEC 12.7, H-3)`,
      ).findings;
      const counts: Record<string, number> = {};
      for (const expectation of expectations) {
        counts[expectation.finding] = (counts[expectation.finding] ?? 0) + 1;
      }
      assertConditionCounts(
        findings,
        counts,
        `${context}: the report holds exactly one finding per applicable ` +
          `refusal reason, each carrying its exact stable code, and no ` +
          `reason beside the staged one(s) — a code is contract (SPEC 14, ` +
          `12.7, T14-7)`,
      );
      for (const expectation of expectations) {
        const finding = findings.find(
          (candidate) =>
            (candidate.condition ?? candidate.code ?? "(code-less)") ===
            expectation.finding,
        );
        if (finding === undefined) {
          fail(
            `${context}: no reported finding carries ` +
              `${JSON.stringify(expectation.finding)} (SPEC 14, 12.7)`,
          );
        }
        if (expectation.locatedAt !== undefined) {
          assertFindingMentionsLocation(
            finding,
            expectation.locatedAt,
            `${context}: the ${expectation.finding} refusal's concerned ` +
              `construct`,
          );
        }
        if (expectation.identity !== undefined) {
          assertFindingNamesIdentity(
            finding,
            expectation.identity,
            `${context}: the ${expectation.finding} refusal's concerned ` +
              `identity`,
          );
        }
        if (expectation.path !== undefined) {
          assertFindingConcernsPath(
            finding,
            expectation.path,
            `${context}: the ${expectation.finding} refusal's concerned ` +
              `path`,
          );
        }
      }
    },
    `${context}: \`${command}\` refused — modifies nothing (SPEC 6.5)`,
  );
}

/**
 * A move usage error (SPEC 6.5, 12.0): run with `--json`, assert exit 2
 * exactly, the single 12.7 error document as the entire stdout (12.0: no
 * report and no validation findings — the 12.0-ordering discriminator; H-5),
 * and a usage error message on stderr (presence, not wording). Accepts
 * raw-byte argv elements for the Linux-leg non-UTF-8 destination arm
 * (T6.5-5, T12.0-5: argv is a byte channel there, carried by the subprocess
 * driver's raw-byte argv support).
 */
async function expectMoveUsageError(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly ArgvValue[],
  context: string,
): Promise<RunResult> {
  const command = renderArgv(argv);
  const result = await runProduct(product, {
    cwd: workspace.root,
    argv: [...argv, "--json"],
  });
  assertExitCode(
    result,
    2,
    `${context}: \`${command} --json\` — a usage error, exit 2 (SPEC 6.5, ` +
      `12.0)`,
  );
  expectErrorDocument(
    result,
    `${context}: \`${command} --json\` — under --json, the exit-2 error ` +
      `document is the entire stdout: the usage error emits no report and ` +
      `no validation findings (SPEC 12.0, 12.7, H-5)`,
  );
  if (result.stderrBytes.length === 0) {
    fail(
      `${context}: \`${command} --json\` — usage error messages are ` +
        `standard-error content (SPEC 12.0), but stderr is empty`,
    );
  }
  return result;
}

// ---------------------------------------------------------------------------
// T6.5-1 — file form
// ---------------------------------------------------------------------------

// The moved file imports another spec file (its own import specifier must be
// rewritten across the directory change) and its generated module is imported
// by a spec file and a code file (their import paths rewritten); its sections
// are referenced through `d`, MDX and TS `text(...)`, and a TS marker, so the
// post-move edge sets witness that everything resolves under the new
// identities — file part changed, IDs unchanged (SPEC 6.5).
const F1_OTHER = "specs/Other.mdx";
const F1_CORE = "specs/Core.mdx";
const F1_MOVED = "specs/sub/Moved.mdx";
const F1_REFS = "specs/Refs.mdx";
const F1_APP = "src/app.ts";

const F1_OTHER_SOURCE = [
  '<S id="oth">',
  "Outside target text.",
  "</S>",
  "",
].join("\n");

const F1_CORE_SOURCE = [
  'import Other from "./Other.xspec"',
  "",
  '<S id="core">',
  "Core holder text.",
  "",
  '<S id="core.mid" d={Other.oth}>',
  "Mid text.",
  "",
  '<S id="core.mid.leaf">',
  "Leaf embeds: {text(Other.oth)}",
  "</S>",
  "</S>",
  "</S>",
  "",
].join("\n");

const F1_REFS_SOURCE = [
  'import Core from "./Core.xspec"',
  "",
  '<S id="refs" d={Core.core.mid}>',
  "Refs embeds: {text(Core.core.mid.leaf)}",
  "</S>",
  "",
].join("\n");

const F1_APP_SOURCE = [
  'import CORE, { text } from "../specs/Core.xspec";',
  "",
  "CORE.core.mid.leaf;",
  "text(CORE.core.mid);",
  "",
].join("\n");

const F1_UNCHANGED_IDENTITIES = [
  F1_OTHER,
  `${F1_OTHER}#oth`,
  F1_REFS,
  `${F1_REFS}#refs`,
];
const F1_PRE_IDENTITIES = [
  ...F1_UNCHANGED_IDENTITIES,
  F1_CORE,
  `${F1_CORE}#core`,
  `${F1_CORE}#core.mid`,
  `${F1_CORE}#core.mid.leaf`,
];
// Identities change only in their file part (SPEC 6.5): same IDs, new path.
const F1_POST_IDENTITIES = [
  ...F1_UNCHANGED_IDENTITIES,
  F1_MOVED,
  `${F1_MOVED}#core`,
  `${F1_MOVED}#core.mid`,
  `${F1_MOVED}#core.mid.leaf`,
];

/** The fixture's complete dependency-kind edge sets, per moved-file path. */
function f1Edges(coreFile: string): {
  depends: GraphEdge[];
  embeds: GraphEdge[];
  references: GraphEdge[];
} {
  return {
    depends: [
      {
        from: `${coreFile}#core.mid`,
        to: `${F1_OTHER}#oth`,
        kind: "depends",
      },
      {
        from: `${F1_REFS}#refs`,
        to: `${coreFile}#core.mid`,
        kind: "depends",
      },
    ],
    embeds: [
      {
        from: `${coreFile}#core.mid.leaf`,
        to: `${F1_OTHER}#oth`,
        kind: "embeds",
      },
      {
        from: `${F1_REFS}#refs`,
        to: `${coreFile}#core.mid.leaf`,
        kind: "embeds",
      },
      { from: F1_APP, to: `${coreFile}#core.mid`, kind: "embeds" },
    ],
    references: [
      { from: F1_APP, to: `${coreFile}#core.mid.leaf`, kind: "references" },
    ],
  };
}

/** Assert the workspace-wide edge set of each dependency kind (SPEC 5.2, 11). */
async function assertF1Edges(
  product: ProductBinding,
  workspace: TestWorkspace,
  coreFile: string,
  context: string,
): Promise<void> {
  const expected = f1Edges(coreFile);
  for (const kind of ["depends", "embeds", "references"] as const) {
    assertEdgeSetEqual(
      await queryEdgesOfKind(product, workspace, kind, context),
      expected[kind],
      `${context}: the workspace's complete \`${kind}\` edge set — every ` +
        `reference resolves to the moved file's new identities, whose file ` +
        `part alone changed (SPEC 6.5, 5.2)`,
    );
  }
}

// The non-derived workspace state seeded into the fresh-build directory:
// configuration, every source file (post-move bytes), and the journal
// (derived files are reproducible from those, SPEC 13.4).
const F1_SEED_FILES = [
  "xspec.config.ts",
  F1_OTHER,
  F1_MOVED,
  F1_REFS,
  F1_APP,
  JOURNAL_PATH,
] as const;

/**
 * The specifier rewrites the file-form move must make (SPEC 6.5), one per
 * rewritten file: the file's pre-operation path — the preview lists it
 * there (6.6) — and its post-move path, the staged source holding exactly
 * one specifier literal, that literal, and the module the rewritten
 * specifier must designate (2.1) from the file's post-move directory: the
 * moved module for its `.mdx` and `.ts` importers; for the moved file's
 * own import, the unmoved `Other` module, now reached from `specs/sub/`.
 */
const F1_SPECIFIER_REWRITES = [
  {
    pre: F1_CORE,
    post: F1_MOVED,
    source: F1_CORE_SOURCE,
    literal: '"./Other.xspec"',
    module: "specs/Other.xspec",
  },
  {
    pre: F1_REFS,
    post: F1_REFS,
    source: F1_REFS_SOURCE,
    literal: '"./Core.xspec"',
    module: "specs/sub/Moved.xspec",
  },
  {
    pre: F1_APP,
    post: F1_APP,
    source: F1_APP_SOURCE,
    literal: '"../specs/Core.xspec"',
    module: "specs/sub/Moved.xspec",
  },
] as const;

/** Staged sources the file-form move rewrites nothing in (SPEC 6.5). */
const F1_UNTOUCHED = ["xspec.config.ts", F1_OTHER] as const;

const T6_5_1 = defineProductTest({
  id: "T6.5-1",
  title:
    "file form: `xspec move old.mdx new.mdx` keeps IDs unchanged and changes identities only in their file part; the moved file's own import specifiers and other files' imports of its generated module are rewritten so everything resolves — under the specifier rewrite's byte contract: the moved file, the importing `.mdx`, and the importing `.ts` (T6.2-2's shape — a marker and a `text(...)` call through one `.xspec` import) are each byte-identical to their pre-move bytes outside the `import-specifier-rewrite` ranges a `--preview` taken on a copy reports, and within each such range hold one string literal of 2.1's form designating the moved module (the moved file's own import: the unmoved one) from the file's post-move directory, its quote kind and relative spelling the product's, while every other staged source is byte-unchanged; the mapping is appended to the journal; finishing regeneration as T6.4-7 — byte-identical to a fresh `build`, `check` clean; and the command's own report is the applied mapping as T6.4-1 — every journaled identity pair, carried in JSON per 12.0 (SPEC 6.5, 6.6, 2.1, 1.7, 6.4, 6.1, 12.0, 12.1, 12.7, 14.10; H-3 adapter, report shape unpinned; 6.5: both forms report as rename does — the section form's report is T6.5-3's assertion)",
  run: async (product) => {
    await withWorkspace(
      FULL_CONFIG,
      {
        [F1_OTHER]: F1_OTHER_SOURCE,
        [F1_CORE]: F1_CORE_SOURCE,
        [F1_REFS]: F1_REFS_SOURCE,
        [F1_APP]: F1_APP_SOURCE,
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T6.5-1 `build` over the staged workspace",
        );

        // Staging premises: no journal before the first journaled operation
        // (SPEC 6.1); the pre-move node and edge inventories are exactly as
        // staged, so the post-move assertions witness a real transition.
        const journalBefore = await workspace.kind(JOURNAL_PATH);
        if (journalBefore !== "absent") {
          fail(
            `T6.5-1: staging premise — no journal file exists before the ` +
              `first journaled operation (SPEC 6.1); found ${journalBefore} ` +
              `at ${JOURNAL_PATH}`,
          );
        }
        await assertNodeIdentities(
          product,
          workspace,
          F1_PRE_IDENTITIES,
          "staging premise — the pre-move enumeration is exactly the staged " +
            "node set (SPEC 11, 1.5)",
          "T6.5-1 pre-move",
        );
        await assertF1Edges(product, workspace, F1_CORE, "T6.5-1 pre-move");

        // Specifier-rewrite byte contract, the preview side (TEST-SPEC
        // T6.5-1): the `import-specifier-rewrite` ranges — in current,
        // pre-operation coordinates (SPEC 6.6, 1.7) — are read by running
        // the preview on a copy of the fixture, staged and built like the
        // original, whose pre-move state no preview then touches.
        // Premises: the preview completes with its full plan (6.6), and
        // each rewritten file's ranges are exactly its one staged
        // specifier literal's characters, quotes included (6.6: a
        // specifier rewrite's range is the literal's characters).
        const previewRanges = await withWorkspace(
          FULL_CONFIG,
          {
            [F1_OTHER]: F1_OTHER_SOURCE,
            [F1_CORE]: F1_CORE_SOURCE,
            [F1_REFS]: F1_REFS_SOURCE,
            [F1_APP]: F1_APP_SOURCE,
          },
          async (copy) => {
            await buildOk(
              product,
              copy,
              "T6.5-1 `build` over the copy staged for the preview",
            );
            const context = "T6.5-1 `move … --preview --json` on the copy";
            const report = decodePreviewReport(
              await runJson(
                product,
                copy,
                ["move", F1_CORE, F1_MOVED, "--preview", "--json"],
                context,
              ),
              context,
            );
            assertSameJson(
              report.findings,
              [],
              `${context}: the preview of the valid file-form move ` +
                `completes with findings [] (SPEC 6.6)`,
            );
            if (report.files === null) {
              fail(
                `${context}: the completed preview reports its plan — ` +
                  `\`files\` non-null (SPEC 6.6, 12.7)`,
              );
            }
            const files = report.files;
            return new Map(
              F1_SPECIFIER_REWRITES.map((rewrite) => {
                const ranges = specifierRewriteRanges(
                  files,
                  rewrite.pre,
                  context,
                );
                assertSameJson(
                  ranges,
                  [uniqueSpan(rewrite.source, rewrite.literal, "T6.5-1")],
                  `${context}: ${rewrite.pre} — the previewed ` +
                    `import-specifier-rewrite ranges are exactly the one ` +
                    `staged specifier literal's characters, quotes ` +
                    `included (SPEC 6.6, 1.7)`,
                );
                return [rewrite.pre, ranges] as const;
              }),
            );
          },
        );

        // The pre-move bytes of every source the contract reads, taken from
        // the original just before the move (staging premise: as staged —
        // `build` rewrites no source, T6.1-1).
        const preMoveBytes = new Map<string, Uint8Array>();
        for (const rel of [
          ...F1_SPECIFIER_REWRITES.map((rewrite) => rewrite.pre),
          ...F1_UNTOUCHED,
        ]) {
          preMoveBytes.set(rel, await workspace.readBytes(rel));
        }
        for (const rewrite of F1_SPECIFIER_REWRITES) {
          assertBytesEqual(
            preMoveBytes.get(rewrite.pre)!,
            rewrite.source,
            `T6.5-1: staging premise — ${rewrite.pre} holds its staged ` +
              `source before the move`,
          );
        }

        // The command's own report is the applied mapping — every identity
        // pair the operation journaled, the information of the preview's
        // `mapping` (SPEC 6.5: both forms report as rename does; 6.4, 6.6) —
        // carried in JSON per 12.0 and decoded through the H-3 adapter (the
        // successful operation's report shape is unpinned; T6.4-1's
        // protocol). The fixture pins the journaled mapping completely: the
        // file form changes every moved-file identity in its file part alone
        // — the implicit root included, its identity being the path alone
        // (SPEC 1.2, 1.5), and its pair journaled like every other, else a
        // pre-move baseline could not unify the root across the move (6.3,
        // T6.2-2) — while the premise enumeration above pins the moved
        // file's nodes as exactly these four, so no other identity is
        // mapped.
        const moveReport = await runJson(
          product,
          workspace,
          ["move", F1_CORE, F1_MOVED, "--json"],
          "T6.5-1 file-form `move specs/Core.mdx specs/sub/Moved.mdx --json`",
        );
        assertAppliedMapping(
          decodeAppliedMappingReport(moveReport, "T6.5-1"),
          [
            { from: F1_CORE, to: F1_MOVED },
            { from: `${F1_CORE}#core`, to: `${F1_MOVED}#core` },
            { from: `${F1_CORE}#core.mid`, to: `${F1_MOVED}#core.mid` },
            {
              from: `${F1_CORE}#core.mid.leaf`,
              to: `${F1_MOVED}#core.mid.leaf`,
            },
          ],
          "T6.5-1: the successful file-form move's report is the applied " +
            "mapping — exactly the identity pairs the operation journaled: " +
            "every node of the moved file, the implicit root included, its " +
            "ID kept and its file part changed (SPEC 6.5, 6.4, 6.6, 12.0)",
        );

        // The file was relocated.
        const originKind = await workspace.kind(F1_CORE);
        if (originKind !== "absent") {
          fail(
            `T6.5-1: the origin file ${F1_CORE} must be gone after the ` +
              `file-form move (SPEC 6.5); found ${originKind}`,
          );
        }

        // Specifier-rewrite byte contract, the operation side (TEST-SPEC
        // T6.5-1; SPEC 6.5: relocation rewrites the moved file's own import
        // specifiers and the paths by which other files import its
        // generated module, and beyond its exact edits a move changes no
        // bytes): each rewritten file — the moved file under its new path,
        // the importing `.mdx`, the importing `.ts` — is its pre-move
        // bytes with exactly the previewed ranges replaced by one string
        // literal of 2.1's form designating the right module from the
        // file's post-move directory, the quote kind and relative spelling
        // the product's (2.1 pins the form; T6.1-2/H-6 pin the spelling
        // product-to-itself).
        for (const rewrite of F1_SPECIFIER_REWRITES) {
          const kind = await workspace.kind(rewrite.post);
          if (kind !== "file") {
            fail(
              `T6.5-1 rewrite check: expected a plain file at ` +
                `${rewrite.post} after the move (SPEC 6.5, 13.4); found ` +
                `${kind}`,
            );
          }
          assertSpecifierRewriteByteContract(
            {
              rel: rewrite.post,
              pre: preMoveBytes.get(rewrite.pre)!,
              post: await workspace.readBytes(rewrite.post),
              ranges: previewRanges.get(rewrite.pre)!,
              importerDir: posixPath.dirname(rewrite.post),
              expectedModule: rewrite.module,
            },
            "T6.5-1 rewrite check",
          );
        }
        // Nothing else changed: a source the move rewrites nothing in is
        // byte-identical to its pre-move bytes (SPEC 6.5).
        for (const rel of F1_UNTOUCHED) {
          await assertFileBytes(
            workspace.path(rel),
            preMoveBytes.get(rel)!,
            `T6.5-1: ${rel} — a source the file-form move rewrites nothing ` +
              `in must be byte-identical to its pre-move bytes (SPEC 6.5)`,
          );
        }

        // Mapping appended to the journal (SPEC 6.5, 6.1; SUITE-21
        // operationalization, content opaque per H-4).
        await assertJournalHoldsOneEntry(workspace, "T6.5-1 after the move");

        // Everything resolves and no stale output remains: `check` exit 0
        // immediately after the move (SPEC 6.5, 12.2, 14.10).
        await expectExit(
          product,
          workspace,
          ["check"],
          0,
          "T6.5-1 `check` immediately after the file-form move — all " +
            "rewritten imports and references resolve and the finishing " +
            "regeneration left no staleness (SPEC 6.5, 12.2, 14.10)",
        );

        // IDs unchanged; identities change file part only (query-asserted).
        await assertNodeIdentities(
          product,
          workspace,
          F1_POST_IDENTITIES,
          "after the file-form move, every moved identity keeps its ID and " +
            "changes only its file part; every other identity is unchanged " +
            "(SPEC 6.5, 1.5)",
          "T6.5-1 post-move",
        );
        await assertF1Edges(product, workspace, F1_MOVED, "T6.5-1 post-move");

        // Finishing regeneration as T6.4-7 (H-6 two-directory protocol):
        // seed a fresh workspace with the post-move sources, configuration,
        // and journal; `build`; compare the whole roots byte-for-byte.
        const fresh = await TestWorkspace.create();
        try {
          for (const rel of F1_SEED_FILES) {
            const kind = await workspace.kind(rel);
            if (kind !== "file") {
              fail(
                `T6.5-1: expected ${rel} as a plain file in the moved ` +
                  `workspace to seed the fresh-build directory (SPEC 6.5, ` +
                  `6.1, 13.4); found ${kind}`,
              );
            }
            await fresh.file(rel, await workspace.readBytes(rel));
          }
          await buildOk(
            product,
            fresh,
            "T6.5-1 fresh `build` over the post-move sources",
          );
          await assertDirectoriesEqual(
            workspace.root,
            fresh.root,
            "T6.5-1: the moved workspace vs a fresh `build` of the post-move " +
              "sources — generated modules, Markdown output, and graph data " +
              "must be byte-identical (SPEC 6.5: a successful move " +
              "regenerates derived files as rename does; 6.4, 12.0 " +
              "determinism; H-4/H-6, normalizing nothing)",
          );
        } finally {
          await fresh.dispose();
        }
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T6.5-2 — section form text edits (byte-exact)
// ---------------------------------------------------------------------------

// Shared origin: the moved construct `a.mv` spans whole lines — its own
// characters run from the `<` of its opening tag through the `>` of its
// closing tag. Deleting them in place merges the three construct lines into
// one line holding only the closing tag's terminator; that line contained
// non-whitespace in the source and is left empty purely by the deletion, so
// it is dropped with its terminator (rule of 3), while the blank line above
// it — already empty in the source — is kept (SPEC 6.5, 3).
const X2_ORIGIN = "specs/A.mdx";
const X2_ORIGIN_BEFORE = [
  '<S id="a">',
  "Alpha holder.",
  "",
  '<S id="a.mv">',
  "Moved text.",
  "</S>",
  "</S>",
  "",
].join("\n");
const X2_ORIGIN_AFTER = ['<S id="a">', "Alpha holder.", "", "</S>", ""].join(
  "\n",
);

// Uninvolved bystander, asserted byte-identical in every arm: beyond the
// stated edits, the identity and reference rewrites, and the finishing
// regeneration, a move changes no bytes (SPEC 6.5).
const X2_ZED = "specs/Zed.mdx";
const X2_ZED_SOURCE = ['<S id="zed">', "Zed text.", "</S>", ""].join("\n");

/** One byte-exact arm: staged files, the move argv, expected file bytes. */
interface ByteExactArm {
  readonly name: string;
  readonly files: Readonly<Record<string, string>>;
  readonly argv: readonly string[];
  readonly expected: Readonly<Record<string, string>>;
}

const X2_ARMS: readonly ByteExactArm[] = [
  {
    // Deletion drops the merged construct line (rule of 3), keeps the
    // pre-existing blank line; insertion immediately before the target
    // parent's closing tag, whose line start makes a preceding U+000A
    // unnecessary; the moved text travels verbatim except its re-identified
    // `id`, followed by U+000A.
    name: "line-start insertion + origin line-drop",
    files: {
      [X2_ORIGIN]: X2_ORIGIN_BEFORE,
      "specs/B.mdx": ['<S id="b">', "Beta holder.", "</S>", ""].join("\n"),
    },
    argv: ["move", "specs/A.mdx#a.mv", "specs/B.mdx#b.mv"],
    expected: {
      [X2_ORIGIN]: X2_ORIGIN_AFTER,
      "specs/B.mdx": [
        '<S id="b">',
        "Beta holder.",
        '<S id="b.mv">',
        "Moved text.",
        "</S>",
        "</S>",
        "",
      ].join("\n"),
    },
  },
  {
    // The target parent's closing tag is mid-line (preceded by `.`), so the
    // insertion is preceded by one U+000A as well as followed by one.
    name: "mid-line insertion point",
    files: {
      [X2_ORIGIN]: X2_ORIGIN_BEFORE,
      "specs/C.mdx": '<S id="c">Gamma holder.</S>\n',
    },
    argv: ["move", "specs/A.mdx#a.mv", "specs/C.mdx#c.mv"],
    expected: {
      [X2_ORIGIN]: X2_ORIGIN_AFTER,
      "specs/C.mdx": [
        '<S id="c">Gamma holder.',
        '<S id="c.mv">',
        "Moved text.",
        "</S>",
        "</S>",
        "",
      ].join("\n"),
    },
  },
  {
    // Top-level `new-id` into an absent target: the file is created, empty
    // before insertion; position 0 of the empty file is the start of a line,
    // so no preceding U+000A.
    name: "target file created when absent (top-level new-id)",
    files: { [X2_ORIGIN]: X2_ORIGIN_BEFORE },
    argv: ["move", "specs/A.mdx#a.mv", "specs/New.mdx#solo"],
    expected: {
      [X2_ORIGIN]: X2_ORIGIN_AFTER,
      "specs/New.mdx": ['<S id="solo">', "Moved text.", "</S>", ""].join("\n"),
    },
  },
  {
    // Top-level `new-id` into an existing file whose final line is
    // terminated: end-of-file insertion at the start of a line — no
    // preceding U+000A.
    name: "end-of-file insertion after a terminated final line",
    files: {
      [X2_ORIGIN]: X2_ORIGIN_BEFORE,
      "specs/D.mdx": ['<S id="d">', "Delta text.", "</S>", ""].join("\n"),
    },
    argv: ["move", "specs/A.mdx#a.mv", "specs/D.mdx#dm"],
    expected: {
      [X2_ORIGIN]: X2_ORIGIN_AFTER,
      "specs/D.mdx": [
        '<S id="d">',
        "Delta text.",
        "</S>",
        '<S id="dm">',
        "Moved text.",
        "</S>",
        "",
      ].join("\n"),
    },
  },
  {
    // Top-level `new-id` into an existing file whose final line has no
    // terminator (SPEC 3 allows it): the end of file is not at the start of
    // a line, so the insertion is preceded by one U+000A.
    name: "end-of-file insertion after an unterminated final line",
    files: {
      [X2_ORIGIN]: X2_ORIGIN_BEFORE,
      "specs/E.mdx": ['<S id="e">', "Echo text.", "</S>"].join("\n"),
    },
    argv: ["move", "specs/A.mdx#a.mv", "specs/E.mdx#em"],
    expected: {
      [X2_ORIGIN]: X2_ORIGIN_AFTER,
      "specs/E.mdx": [
        '<S id="e">',
        "Echo text.",
        "</S>",
        '<S id="em">',
        "Moved text.",
        "</S>",
        "",
      ].join("\n"),
    },
  },
  {
    // Self-closing moved section (1.1, 6.5): the moved text is exactly the
    // self-closing tag's own characters — it stays self-closing at the
    // destination, re-identified; its origin line is dropped (rule of 3).
    name: "self-closing moved section",
    files: {
      [X2_ORIGIN]: [
        '<S id="a">',
        "Alpha holder.",
        '<S id="a.todo" />',
        "</S>",
        "",
      ].join("\n"),
      "specs/B.mdx": ['<S id="b">', "Beta holder.", "</S>", ""].join("\n"),
    },
    argv: ["move", "specs/A.mdx#a.todo", "specs/B.mdx#b.todo"],
    expected: {
      [X2_ORIGIN]: ['<S id="a">', "Alpha holder.", "</S>", ""].join("\n"),
      "specs/B.mdx": [
        '<S id="b">',
        "Beta holder.",
        '<S id="b.todo" />',
        "</S>",
        "",
      ].join("\n"),
    },
  },
  {
    // Self-closing target parent (the TEST-SPEC worked example): its `/` and
    // the whitespace immediately before it are deleted, `</Spec>` — the
    // closing tag matching the opening tag's name — is appended immediately
    // after the tag's terminating `>`, and the insertion rule then applies
    // before that closing tag: `<Spec id="p" />` becomes `<Spec id="p">` +
    // U+000A + the moved text + U+000A + `</Spec>` (SPEC 6.5, 1.1).
    name: "self-closing target parent rewritten to paired form",
    files: {
      [X2_ORIGIN]: X2_ORIGIN_BEFORE,
      "specs/P.mdx": '<Spec id="p" />\n',
    },
    argv: ["move", "specs/A.mdx#a.mv", "specs/P.mdx#p.mv"],
    expected: {
      [X2_ORIGIN]: X2_ORIGIN_AFTER,
      "specs/P.mdx": [
        '<Spec id="p">',
        '<S id="p.mv">',
        "Moved text.",
        "</S>",
        "</Spec>",
        "",
      ].join("\n"),
    },
  },
];

const T6_5_2 = defineProductTest({
  id: "T6.5-2",
  title:
    "section form text edits, byte-exact: moved text spans the opening tag's first character through the closing tag's last; origin deletion drops lines left empty/whitespace-only (rule of 3); insertion immediately before the target parent's closing tag (or end of file for top-level `new-id`), followed by U+000A and preceded by one when not at line start; target file created when absent; self-closing sections move as exactly their tag's characters and a self-closing target parent is first rewritten to paired form; no other byte changes (SPEC 6.5, 3, 1.1)",
  run: async (product) => {
    for (const arm of X2_ARMS) {
      await withWorkspace(
        SPECS_ONLY_CONFIG,
        { ...arm.files, [X2_ZED]: X2_ZED_SOURCE },
        async (workspace) => {
          const context = `T6.5-2 (${arm.name})`;
          await expectExit(
            product,
            workspace,
            arm.argv,
            0,
            `${context}: \`${arm.argv.join(" ")}\``,
          );
          for (const [rel, bytes] of Object.entries(arm.expected)) {
            await assertFileBytes(
              workspace.path(rel),
              bytes,
              `${context}: ${rel} after the move — the section form's text ` +
                `edits are exact (SPEC 6.5, 3, 1.1; H-4, normalizing nothing)`,
            );
          }
          await assertFileBytes(
            workspace.path(X2_ZED),
            X2_ZED_SOURCE,
            `${context}: ${X2_ZED} (uninvolved bystander) after the move — ` +
              `beyond the stated edits, the identity and reference rewrites, ` +
              `and the finishing regeneration, a move changes no bytes ` +
              `(SPEC 6.5)`,
          );
        },
      );
    }
  },
});

// ---------------------------------------------------------------------------
// T6.5-3 — re-identification and reference conversion
// ---------------------------------------------------------------------------

// The conversion matrix in one move (`org.mv` → top-level `tm` in Target):
// - local → imported: the origin's remaining `org.usemv` references the moved
//   node locally (`d` and `text(...)`), so Origin.mdx needs an added import
//   of the target module (fresh binding).
// - imported → local: Target.mdx references the moved node through its `Org`
//   import; those references become local strings, leaving the `Org` binding
//   referenceless — removed, because it *had* references (exact removal).
// - import added to the target: the moved node's own `d={Keep.keep}` needs a
//   `./Keep.xspec` binding Target.mdx lacks; Target.mdx already binds the
//   identifier `Keep` (to `./Spare.xspec`), so the added import must choose a
//   fresh, non-colliding identifier or fail the post-move `check` (14.15).
// - import removed from the origin: the moved node was the origin's only
//   user of its `Keep` binding, so that import goes.
// - unreferenced import stays: Target.mdx's `Keep` → `./Spare.xspec` binding
//   had no references before the move and must survive byte-verbatim.
// - within the moved subtree: `org.mv.k2`'s local `d={"org.mv.k1"}` stays
//   local, re-identified by prefix replacement to `d={"tm.k1"}`.
const R3_KEEP = "specs/Keep.mdx";
const R3_SPARE = "specs/Spare.mdx";
const R3_ORIGIN = "specs/Origin.mdx";
const R3_TARGET = "specs/Target.mdx";

const R3_KEEP_SOURCE = ['<S id="keep">', "Keep text.", "</S>", ""].join("\n");
const R3_SPARE_SOURCE = ['<S id="sp">', "Spare text.", "</S>", ""].join("\n");

const R3_ORIGIN_SOURCE = [
  'import Keep from "./Keep.xspec"',
  "",
  '<S id="org">',
  "Origin holder text.",
  "",
  '<S id="org.mv" d={Keep.keep}>',
  "Moved root text.",
  "",
  '<S id="org.mv.k1">',
  "Moved first kid.",
  "</S>",
  "",
  '<S id="org.mv.k2" d={"org.mv.k1"}>',
  "Moved second kid.",
  "</S>",
  "</S>",
  "",
  '<S id="org.usemv" d={"org.mv"}>',
  'Uses the moved node: {text("org.mv.k1")}',
  "</S>",
  "</S>",
  "",
].join("\n");

const R3_TARGET_SOURCE = [
  'import Org from "./Origin.xspec"',
  'import Keep from "./Spare.xspec"',
  "",
  '<S id="tgt" d={Org.org.mv}>',
  "Target text: {text(Org.org.mv.k1)}",
  "</S>",
  "",
].join("\n");

const R3_FILES: Readonly<Record<string, string>> = {
  "xspec.config.ts": SPECS_MD_CONFIG,
  [R3_KEEP]: R3_KEEP_SOURCE,
  [R3_SPARE]: R3_SPARE_SOURCE,
  [R3_ORIGIN]: R3_ORIGIN_SOURCE,
  [R3_TARGET]: R3_TARGET_SOURCE,
};

// `--json` carries the command's own report — the applied mapping — as a
// single JSON document (SPEC 12.0; the report assertion below); identical
// argv in both determinism directories, so H-6's compare is unaffected.
const R3_MOVE_ARGV = [
  "move",
  "specs/Origin.mdx#org.mv",
  "specs/Target.mdx#tm",
  "--json",
] as const;

// Subtree re-identified by prefix replacement: org.mv → tm, descendants too.
const R3_POST_IDENTITIES = [
  R3_KEEP,
  `${R3_KEEP}#keep`,
  R3_SPARE,
  `${R3_SPARE}#sp`,
  R3_ORIGIN,
  `${R3_ORIGIN}#org`,
  `${R3_ORIGIN}#org.usemv`,
  R3_TARGET,
  `${R3_TARGET}#tgt`,
  `${R3_TARGET}#tm`,
  `${R3_TARGET}#tm.k1`,
  `${R3_TARGET}#tm.k2`,
];

const R3_SEED_FILES = [
  "xspec.config.ts",
  R3_KEEP,
  R3_SPARE,
  R3_ORIGIN,
  R3_TARGET,
  JOURNAL_PATH,
] as const;

// Third-file arms (TEST-SPEC T6.5-3; SPEC 6.5: "all references across the
// workspace are rewritten"): a spec source that is neither origin nor target
// imports the origin module and references the moved node through it (a `d`
// chain). After the move that reference is rewritten to the target module
// under an import added to the third file. The added declaration's
// identifier and insertion offset are 6.5's latitude, so the file's bytes
// are asserted with T6.5-8's discipline (`assertAddedImportInsertion`): its
// expected post-move bytes are composed from the rules of 6.4/6.5 and 3
// WITHOUT the added import, the fresh identifier read off the rewritten
// reference, and the single inserted run isolated by diff must be exactly
// the declaration under 6.5's line rules (followed by U+000A; preceded by
// one at a mid-line offset). The origin import's fate splits the arms (6.5:
// removed exactly when its binding had references and the rewrite leaves it
// with none):
// - (a) `Org`'s only reference was to the moved node → the own-line
//   declaration's characters are deleted and its emptied line dropped with
//   its terminator (6.5, 3); the blank line after it was blank before the
//   deletion, so it stays — the composed file begins with that U+000A.
// - (b) `th2` keeps `d={Org.org}` through the binding → the declaration
//   survives byte-for-byte; only the moved reference is rewritten.
// The rewritten reference keeps its access form — `Org.org.mv` becomes
// `<fresh>.tm`, dot access for the identifier-valid segment (6.4) — and the
// fresh binding may not collide with `Org` where it stays, nor be `S`,
// `Spec`, or `text` (2.1); `check` would fail either, but the arms name the
// collision first.
const R3_THIRD = "specs/Third.mdx";
const R3_TARGET_MODULE = "specs/Target.xspec";

const R3_THIRD_A_SOURCE = [
  'import Org from "./Origin.xspec"',
  "",
  '<S id="th" d={Org.org.mv}>',
  "Third text.",
  "</S>",
  "",
].join("\n");

/** Arm (a)'s expected post-move bytes without the added import (6.5, 3). */
const R3_THIRD_A_BASE = (root: string): string =>
  ["", `<S id="th" d={${root}.tm}>`, "Third text.", "</S>", ""].join("\n");

const R3_THIRD_B_SOURCE = [
  'import Org from "./Origin.xspec"',
  "",
  '<S id="th" d={Org.org.mv}>',
  "Third text.",
  "</S>",
  "",
  '<S id="th2" d={Org.org}>',
  "Third keeps the origin.",
  "</S>",
  "",
].join("\n");

/** Arm (b)'s expected post-move bytes without the added import (6.5). */
const R3_THIRD_B_BASE = (root: string): string =>
  [
    'import Org from "./Origin.xspec"',
    "",
    `<S id="th" d={${root}.tm}>`,
    "Third text.",
    "</S>",
    "",
    '<S id="th2" d={Org.org}>',
    "Third keeps the origin.",
    "</S>",
    "",
  ].join("\n");

/** The section form's journaled mapping: the moved subtree, nothing else. */
const R3_MAPPING = [
  { from: `${R3_ORIGIN}#org.mv`, to: `${R3_TARGET}#tm` },
  { from: `${R3_ORIGIN}#org.mv.k1`, to: `${R3_TARGET}#tm.k1` },
  { from: `${R3_ORIGIN}#org.mv.k2`, to: `${R3_TARGET}#tm.k2` },
] as const;

/** The complete post-move `depends` edge set of the four-file fixture. */
const R3_DEPENDS_EDGES: readonly GraphEdge[] = [
  { from: `${R3_ORIGIN}#org.usemv`, to: `${R3_TARGET}#tm`, kind: "depends" },
  { from: `${R3_TARGET}#tgt`, to: `${R3_TARGET}#tm`, kind: "depends" },
  { from: `${R3_TARGET}#tm`, to: `${R3_KEEP}#keep`, kind: "depends" },
  { from: `${R3_TARGET}#tm.k2`, to: `${R3_TARGET}#tm.k1`, kind: "depends" },
];

/** `<S id="th" d={<root>.tm}>` — the third file's rewritten reference. */
const R3_THIRD_REWRITTEN = /<S id="th" d=\{([A-Za-z_$][A-Za-z0-9_$]*)\.tm\}>/g;

/**
 * The identifier the third file's rewritten reference is rooted at — the
 * value-unpinned fresh binding (SPEC 6.5), read off the one place 6.4's
 * pinned spelling makes it observable.
 */
function thirdFileReferenceRoot(text: string, context: string): string {
  const matches = [...text.matchAll(R3_THIRD_REWRITTEN)];
  const root = matches.length === 1 ? matches[0]?.[1] : undefined;
  if (root === undefined) {
    fail(
      `${context}: ${R3_THIRD} must hold exactly one ` +
        `\`<S id="th" d={<binding>.tm}>\` — the third file's reference to ` +
        `the moved node rewritten to the target module under the new ` +
        `identity, its access form kept (dot access for the ` +
        `identifier-valid segment; SPEC 6.5, 6.4); found ` +
        `${String(matches.length)} in ${JSON.stringify(text)}`,
    );
  }
  return root;
}

/**
 * One third-file arm: stage the four-file fixture plus `Third.mdx`, run the
 * identical section-form move, and assert the third file's rewrite — the
 * moved reference re-rooted at a fresh binding of the target module, added
 * under 6.5's line discipline; the origin import removed or kept as
 * `originImportKept` says — beside the applied-mapping report, the journal
 * entry, the complete `depends` edge set, and a clean `check`.
 */
async function runThirdFileArm(
  product: ProductBinding,
  created: TestWorkspace[],
  arm: {
    readonly label: string;
    readonly source: string;
    readonly base: (root: string) => string;
    readonly originImportKept: boolean;
    readonly thirdEdges: readonly GraphEdge[];
  },
): Promise<void> {
  const context = `T6.5-3 third-file arm ${arm.label}`;
  const workspace = await TestWorkspace.create({
    files: { ...R3_FILES, [R3_THIRD]: arm.source },
  });
  created.push(workspace);
  const result = await runProduct(product, {
    cwd: workspace.root,
    argv: [...R3_MOVE_ARGV],
  });
  assertExitCode(
    result,
    0,
    `${context} \`move specs/Origin.mdx#org.mv specs/Target.mdx#tm --json\``,
  );
  assertAppliedMapping(
    decodeAppliedMappingReport(
      parseJsonStdout(result, `${context} report (SPEC 12.0)`),
      context,
    ),
    [...R3_MAPPING],
    `${context}: the applied mapping is exactly the moved subtree's ` +
      `prefix-replaced pairs — the third file's rewrite maps no identity ` +
      `(SPEC 6.5, 6.4)`,
  );

  const text = await readSourceText(workspace, R3_THIRD, context);
  const root = thirdFileReferenceRoot(text, context);
  if (arm.originImportKept) {
    assertContains(
      text,
      R3_THIRD,
      'import Org from "./Origin.xspec"\n',
      "the `Org` binding keeps a reference (`th2`'s `d={Org.org}`) after " +
        "the rewrite, so its import stays byte-for-byte (SPEC 6.5, 2.1)",
      context,
    );
    if (root === "Org") {
      fail(
        `${context}: the added import binds \`Org\`, an identifier the ` +
          `file's retained origin import already binds — an added import ` +
          `binds fresh identifiers colliding with no binding already in ` +
          `the file (SPEC 6.5, 2.1, 14.15)`,
      );
    }
  } else {
    assertLacks(
      text,
      R3_THIRD,
      "Origin.xspec",
      "the `Org` binding's only reference was to the moved node, so the " +
        "rewrite leaves it with none and the import is removed (SPEC 6.5, " +
        "2.1)",
      context,
    );
  }
  for (const reserved of ["S", "Spec", "text"]) {
    if (root === reserved) {
      fail(
        `${context}: the added import binds \`${reserved}\`, a ` +
          `compiler-provided name no import may bind (SPEC 2.1, 14.15)`,
      );
    }
  }
  // Composed from the rules of 6.4/6.5 and 3 up to the two unknowns — the
  // fresh identifier (now known) and the insertion offset (isolated below).
  assertAddedImportInsertion(
    {
      rel: R3_THIRD,
      base: Buffer.from(arm.base(root), "utf8"),
      actual: await workspace.readBytes(R3_THIRD),
      importerDir: posixPath.dirname(R3_THIRD),
      expectedModule: R3_TARGET_MODULE,
      identifier: root,
    },
    `${context}: the third file's rewrite is its composed post-move bytes ` +
      `with exactly one import of the target module added under 6.5's ` +
      `line discipline (SPEC 6.5, 2.1, 6.4, 3; T6.5-8)`,
  );

  await assertJournalHoldsOneEntry(workspace, `${context} after the move`);
  assertEdgeSetEqual(
    await queryEdgesOfKind(product, workspace, "depends", context),
    [...R3_DEPENDS_EDGES, ...arm.thirdEdges],
    `${context}: the complete \`depends\` edge set — the third file's ` +
      `edge is reported under the moved node's new identity` +
      (arm.originImportKept
        ? ", its other edge through the retained origin binding unchanged"
        : "") +
      ` (SPEC 6.5, 5.2)`,
  );
  await expectExit(
    product,
    workspace,
    ["check"],
    0,
    `${context} \`check\` immediately after the move — the third file's ` +
      `rewritten reference and added import resolve, the fresh binding ` +
      `collides with nothing (14.15), and no staleness remains (SPEC 6.5, ` +
      `12.2, 14.10)`,
  );
}

const T6_5_3 = defineProductTest({
  id: "T6.5-3",
  title:
    "re-identification and reference conversion: the moved subtree is re-identified by prefix replacement; references convert between local and imported forms; needed spec imports are added binding fresh, non-colliding identifiers and unneeded ones removed exactly (an import unreferenced before the move stays); rewritten content is byte-deterministic across two identical fixtures; the full mapping is appended to the journal and reported as the command's own applied-mapping report — the section form reports as rename does, T6.4-1's protocol (SPEC 6.5, 2.1, 6.1, 6.4, 12.0, 12.1, 14.10; H-3 adapter, report shape unpinned); third-file arms — a spec source neither origin nor target, importing the origin module and referencing the moved node through a `d` chain, has that reference rewritten to the target module under an import added there (bytes per T6.5-8's discipline: the single inserted run isolated by diff against bytes composed from 6.4/6.5 and 3, its identifier and offset the product's), the origin import removed exactly when the moved reference was its binding's last and kept byte-for-byte when another reference through it remains, `query edges` listing the third file's `depends` edge under the new identity and `check` clean (SPEC 6.5, 2.1, 6.4, 3)",
  run: async (product) => {
    const created: TestWorkspace[] = [];
    try {
      // Byte determinism (H-6, two-directory form): two identical fixtures,
      // the identical section-form move in each; run outputs and the written
      // files — rewritten sources, added/removed imports, derived files, and
      // the journal entry — must be byte-identical (SPEC 6.5, 6.1, 12.0).
      const { first, firstWorkspace } =
        await assertAcrossDirectoriesDeterministic({
          makeWorkspace: async () => {
            const workspace = await TestWorkspace.create({ files: R3_FILES });
            created.push(workspace);
            return workspace;
          },
          binding: product,
          makeRun: (workspace) => ({
            cwd: workspace.root,
            argv: [...R3_MOVE_ARGV],
          }),
          context:
            "T6.5-3 byte determinism of the section-form move (two identical " +
            "fixtures produce identical bytes; SPEC 6.5, 6.1, 12.0; H-6)",
        });
      assertExitCode(
        first,
        0,
        "T6.5-3 `move specs/Origin.mdx#org.mv specs/Target.mdx#tm --json`",
      );
      const workspace = firstWorkspace;

      // The command's own report is the applied mapping — the section form
      // reports as rename does (SPEC 6.5, 6.4; the file form is T6.5-1's
      // assertion) — carried in JSON per 12.0 and decoded through the H-3
      // adapter (report shape unpinned; T6.4-1's protocol). The fixture pins
      // the journaled mapping completely: the section form maps exactly the
      // moved subtree, `org.mv` and its two descendants re-identified by
      // prefix replacement of `org.mv` with `tm` (SPEC 6.5), while every
      // identity outside the subtree — both files' roots, `org`,
      // `org.usemv`, `tgt`, `keep`, `sp` — is unchanged and unmapped
      // (R3_POST_IDENTITIES pins that below).
      assertAppliedMapping(
        decodeAppliedMappingReport(
          parseJsonStdout(
            first,
            "T6.5-3 the section-form move's report — a single JSON document " +
              "as the entire stdout (SPEC 12.0)",
          ),
          "T6.5-3",
        ),
        [...R3_MAPPING],
        "T6.5-3: the successful section-form move's report is the applied " +
          "mapping — exactly the identity pairs the operation journaled: " +
          "the moved subtree's prefix-replaced identities, nothing else " +
          "(SPEC 6.5, 6.4, 6.6, 12.0)",
      );

      // Conversion and import-rewrite observables (module header, H-4).
      const originText = await readSourceText(
        workspace,
        R3_ORIGIN,
        "T6.5-3 rewrite check",
      );
      assertLacks(
        originText,
        R3_ORIGIN,
        "org.mv",
        "the moved subtree left the origin and every remaining local " +
          "reference to it converts to the imported form under the new " +
          "identity (SPEC 6.5)",
        "T6.5-3 rewrite check",
      );
      assertContains(
        originText,
        R3_ORIGIN,
        "Target.xspec",
        "the origin's converted references need a binding of the target " +
          "module, so an import is added (SPEC 6.5, 2.1)",
        "T6.5-3 rewrite check",
      );
      assertLacks(
        originText,
        R3_ORIGIN,
        "Keep.xspec",
        "the origin's `Keep` binding had references (the moved node's " +
          "`d={Keep.keep}`) and the rewrite leaves it with none, so the " +
          "import is removed (SPEC 6.5, 2.1)",
        "T6.5-3 rewrite check",
      );
      const targetText = await readSourceText(
        workspace,
        R3_TARGET,
        "T6.5-3 rewrite check",
      );
      assertLacks(
        targetText,
        R3_TARGET,
        "Origin.xspec",
        "the target's `Org` binding had references and the rewrite converts " +
          "them all to local form, so the import is removed (SPEC 6.5, 2.1)",
        "T6.5-3 rewrite check",
      );
      assertLacks(
        targetText,
        R3_TARGET,
        "org.mv",
        "the moved subtree is re-identified by prefix replacement and every " +
          "reference to it is rewritten to the new identities (SPEC 6.5)",
        "T6.5-3 rewrite check",
      );
      assertContains(
        targetText,
        R3_TARGET,
        "Keep.xspec",
        "the moved node's `d={Keep.keep}` needs a `./Keep.xspec` binding the " +
          "target file lacks, so an import is added — binding a fresh " +
          "identifier, since `Keep` is already bound in the file (SPEC 6.5, " +
          "2.1, 4)",
        "T6.5-3 rewrite check",
      );
      assertContains(
        targetText,
        R3_TARGET,
        'import Keep from "./Spare.xspec"',
        "an import whose binding was already unreferenced before the move " +
          "stays, byte-verbatim — removal is exact: only a binding that had " +
          "references and lost them all is removed (SPEC 6.5, 2.1)",
        "T6.5-3 rewrite check",
      );
      // Conversion spellings 6.4's rules pin byte-wise: converted references
      // are double-quoted string literals; the kept local reference inside
      // the moved subtree keeps its double quotes, re-identified.
      assertContains(
        targetText,
        R3_TARGET,
        'd={"tm"}',
        "the target's imported reference to the moved node converts to the " +
          "local string form — a double-quoted string literal (SPEC 6.5, 6.4)",
        "T6.5-3 rewrite check",
      );
      assertContains(
        targetText,
        R3_TARGET,
        '{text("tm.k1")}',
        "the target's imported `text(...)` reference converts to the local " +
          "string form under the re-identified descendant (SPEC 6.5, 6.4)",
        "T6.5-3 rewrite check",
      );
      assertContains(
        targetText,
        R3_TARGET,
        'd={"tm.k1"}',
        "a local reference within the moved subtree stays local and is " +
          "re-identified by prefix replacement, preserving its quote style " +
          "(SPEC 6.5, 6.4)",
        "T6.5-3 rewrite check",
      );

      // The full mapping is appended to the journal — the section form
      // (SPEC 6.5: both forms; the file form is T6.5-1's assertion).
      await assertJournalHoldsOneEntry(workspace, "T6.5-3 after the move");

      // Re-identification and conversion resolve: enumeration under the new
      // identities, exact dependency-edge sets, and a clean `check`.
      await assertNodeIdentities(
        product,
        workspace,
        R3_POST_IDENTITIES,
        "the moved subtree is enumerated under the prefix-replaced " +
          "identities and every other identity is unchanged (SPEC 6.5, 1.5)",
        "T6.5-3 post-move",
      );
      assertEdgeSetEqual(
        await queryEdgesOfKind(
          product,
          workspace,
          "depends",
          "T6.5-3 post-move",
        ),
        R3_DEPENDS_EDGES,
        "T6.5-3: the complete `depends` edge set — every converted, added, " +
          "and re-identified reference resolves to the new identities " +
          "(SPEC 6.5, 5.2)",
      );
      assertEdgeSetEqual(
        await queryEdgesOfKind(
          product,
          workspace,
          "embeds",
          "T6.5-3 post-move",
        ),
        [
          {
            from: `${R3_ORIGIN}#org.usemv`,
            to: `${R3_TARGET}#tm.k1`,
            kind: "embeds",
          },
          {
            from: `${R3_TARGET}#tgt`,
            to: `${R3_TARGET}#tm.k1`,
            kind: "embeds",
          },
        ],
        "T6.5-3: the complete `embeds` edge set after conversion (SPEC 6.5, " +
          "5.2)",
      );
      await expectExit(
        product,
        workspace,
        ["check"],
        0,
        "T6.5-3 `check` immediately after the move — every rewritten " +
          "reference and import resolves (a non-fresh added-import " +
          "identifier would be a duplicate binding, 14.15), no dependency " +
          "or import cycles, and the finishing regeneration left no " +
          "staleness (SPEC 6.5, 12.2, 14.10)",
      );

      // Finishing regeneration as T6.4-7: fresh `build` of the post-move
      // sources, configuration, and journal; whole-tree byte compare.
      const fresh = await TestWorkspace.create();
      created.push(fresh);
      for (const rel of R3_SEED_FILES) {
        const kind = await workspace.kind(rel);
        if (kind !== "file") {
          fail(
            `T6.5-3: expected ${rel} as a plain file in the moved workspace ` +
              `to seed the fresh-build directory (SPEC 6.5, 6.1, 13.4); ` +
              `found ${kind}`,
          );
        }
        await fresh.file(rel, await workspace.readBytes(rel));
      }
      await buildOk(
        product,
        fresh,
        "T6.5-3 fresh `build` over the post-move sources",
      );
      await assertDirectoriesEqual(
        workspace.root,
        fresh.root,
        "T6.5-3: the moved workspace vs a fresh `build` of the post-move " +
          "sources — generated modules, Markdown output, and graph data " +
          "must be byte-identical (SPEC 6.5, 6.4, 12.0; H-4/H-6, " +
          "normalizing nothing)",
      );

      // Third-file arms (SPEC 6.5: all references across the workspace):
      // (a) the moved reference was the origin binding's last — import
      // removed; (b) another reference through it remains — import kept.
      await runThirdFileArm(product, created, {
        label: "(a) origin import removed",
        source: R3_THIRD_A_SOURCE,
        base: R3_THIRD_A_BASE,
        originImportKept: false,
        thirdEdges: [
          { from: `${R3_THIRD}#th`, to: `${R3_TARGET}#tm`, kind: "depends" },
        ],
      });
      await runThirdFileArm(product, created, {
        label: "(b) origin import kept",
        source: R3_THIRD_B_SOURCE,
        base: R3_THIRD_B_BASE,
        originImportKept: true,
        thirdEdges: [
          { from: `${R3_THIRD}#th`, to: `${R3_TARGET}#tm`, kind: "depends" },
          { from: `${R3_THIRD}#th2`, to: `${R3_ORIGIN}#org`, kind: "depends" },
        ],
      });
    } finally {
      for (const workspace of created) {
        await workspace.dispose();
      }
    }
  },
});

// ---------------------------------------------------------------------------
// T6.5-4 — refusals (exit 1, nothing modified)
// ---------------------------------------------------------------------------

// One valid workspace stages every refusal cause in isolation:
// - `mv` depends locally on `keep` and is depended on by `user`, so moving
//   `mv` into B.mdx forces imports in both directions (A ↔ B): the spec
//   import cycle. Moving `mv` *under* `keep` in the same file makes it depend
//   on its own ancestor: the dependency cycle (5.3) — no imports involved.
// - `x`/`x.sub` carry no references: the collision, target-parent, and
//   section-form occupant arms refuse on exactly their stated grounds.
// - B.mdx exists (file-form destination), holds `y` (cross-file collision),
//   and has no `nope` (missing target parent).
// - The destination-path arms use the file form of the reference-free A.mdx,
//   each violating exactly one destination rule under REFUSAL_CONFIG.
// - Destination occupants (SPEC 6.5): the file form refuses on ANY occupant
//   — a plain file (B.mdx), a directory (a product probing for a file alone
//   sees none and proceeds), a symbolic link, a broken symbolic link (target
//   absent; a product probing existence through link-following stat sees
//   that path absent and proceeds to relocate) — and the section form on
//   any occupant that is not a discovered spec source: a directory, a
//   symbolic link resolving to the discovered B.mdx (discovery never yields
//   a symlink, SPEC 7 — a product resolving the target path through the
//   filesystem finds a spec source there and inserts through the link), or
//   the out-of-group plain `.mdx` file docs/Occ.mdx (present, right
//   extension, still no discovered spec source), the latter refusing under
//   both applicable reasons at once — refused-destination-exists beside
//   refused-invalid-destination, one finding per reason (SPEC 14, T14-7).
//   The non-file occupants stage at in-group `specs/*.mdx` paths discovery
//   ignores (no source file, so no discovery, no derived paths), so the
//   pre-refusal `build` stays valid and every arm refuses on exactly its
//   staged ground rather than the invalid-workspace precondition.
const V4_A = "specs/A.mdx";
const V4_A_SOURCE = [
  '<S id="keep">',
  "Keep text.",
  "</S>",
  "",
  '<S id="mv" d={"keep"}>',
  "Moved candidate text.",
  "</S>",
  "",
  '<S id="user" d={"mv"}>',
  "User text.",
  "</S>",
  "",
  '<S id="x">',
  "X holder.",
  "",
  '<S id="x.sub">',
  "X sub text.",
  "</S>",
  "</S>",
  "",
].join("\n");

const V4_B = "specs/B.mdx";
const V4_B_SOURCE = [
  '<S id="b">',
  "B holder text.",
  "</S>",
  "",
  '<S id="y">',
  "Y text.",
  "</S>",
  "",
].join("\n");

// Destination-occupant paths (the staging note above): non-file occupants at
// in-group `.mdx` paths, staged in the test body before the pre-refusal
// `build`, plus the out-of-group plain `.mdx` file (in the files map).
const V4_SYM_DEST = "specs/SymDest.mdx"; // file form: symlink → B.mdx
const V4_GONE_DEST = "specs/GoneDest.mdx"; // file form: broken symlink
const V4_DIR_DEST = "specs/DirDest.mdx"; // file form: directory
const V4_DIR_TARGET = "specs/DirTarget.mdx"; // section form: directory
const V4_LINK_TARGET = "specs/LinkTarget.mdx"; // section form: symlink → B.mdx
const V4_OCC = "docs/Occ.mdx"; // section form: out-of-group `.mdx` file
const V4_OCC_SOURCE = ['<S id="occ">', "Occupant text.", "</S>", ""].join("\n");

// Location windows within the staged sources (SPEC 14): the dependency-cycle
// arm locates the reference spelling recording the participating dependency
// edge — the moved node's `d={"keep"}` — and the cross-file collision arm
// locates the remaining colliding bearer `y`'s construct in the target file
// (any in-window precision passes; wrong-construct attribution fails).
const V4_KEEP_SPELLING = 'd={"keep"}';
const V4_KEEP_WINDOW = byteWindow(
  V4_A_SOURCE.slice(0, V4_A_SOURCE.indexOf(V4_KEEP_SPELLING)),
  V4_KEEP_SPELLING,
);
const V4_Y_CONSTRUCT = '<S id="y">\nY text.\n</S>';
const V4_Y_WINDOW = byteWindow(
  V4_B_SOURCE.slice(0, V4_B_SOURCE.indexOf(V4_Y_CONSTRUCT)),
  V4_Y_CONSTRUCT,
);

// The precondition arm's other file: valid at staging (so the pre-refusal
// `build` succeeds), then overwritten with an unresolved local `d` reference
// (14.5) — the pre-existing validation error elsewhere (as T6.4-6).
const V4_OTHER = "specs/Other.mdx";
const V4_OTHER_VALID = ['<S id="oth">', "Other text.", "</S>", ""].join("\n");
const V4_OTHER_INVALID = [
  '<S id="oth" d={"nope"}>',
  "Other text.",
  "</S>",
  "",
].join("\n");

// The derived-path arm of refused-invalid-destination (SPEC 6.5: a
// workspace-relative directory component of a derived path the destination
// would generate — 13.1, 13.2, 7.3 — occupied by a non-directory), on its
// own workspace: Markdown emission redirected under `markdown.outDir`, and a
// second spec glob admitting the file-form destination `new/b.mdx`. The
// destination is otherwise valid — in-group, `.mdx`, unoccupied, its own
// directory component `new/` absent (a nonexistent component is never a
// refusal cause, SPEC 13.4) and the destination's generated module and
// companions sharing that same absent directory (13.1) — but the destination
// would emit `mdout/new/b.md` (13.2, 7.3: outDir preserves
// workspace-relative paths), and that derived path's directory component
// `mdout/new` is occupied by a plain file. The occupant lies under no
// current source's write path (specs/Solo.mdx writes specs/Solo.xspec.ts
// with its companions and mdout/specs/Solo.md), so the staged workspace
// passes `build`'s validations, and the refusal is the move's own:
// refused-invalid-destination concerning the destination path, never 14.22
// (SPEC 14, T14-7) — discriminating a product that vets only the
// destination path's own components (it sees `new/` absent and proceeds).
const V4_OUTDIR_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx", "new/**/*.mdx"]
  },
  markdown: { emit: true, outDir: "mdout" }
})
`;
const V4_SOLO = "specs/Solo.mdx";
const V4_SOLO_SOURCE = ['<S id="solo">', "Solo text.", "</S>", ""].join("\n");
const V4_MDOUT_OCCUPANT = "mdout/new";
const V4_MDOUT_OCCUPANT_CONTENT = "not a directory\n";

// The symbolic-link arms of the same clause (SPEC 6.5: a workspace-relative
// directory component of the destination path, or of a derived path the
// destination would generate, occupied by a symbolic link — whatever it
// targets: discovery never traverses one, 7, and writes never traverse or
// replace one, 13.4, 14.22). `specs/sub` is a symbolic link to a real, empty
// directory, so the file-form destination `specs/sub/b.mdx` and the section
// form's created target file `specs/sub/new.mdx` each have that link as a
// directory component. Staged twice: with the link targeting the empty
// directory `linked/` inside the workspace root (on the main refusal
// workspace, beside the occupant arms), and, on its own workspace, a real
// directory outside the root — beside the workspace in the test-owned
// temporary directory, disposed with it. These discriminate a product
// vetting components through link-following stat: it sees a directory at
// the link, proceeds, and writes the moved file — and its regenerated
// derived files — through the link, possibly outside the workspace; the
// outside-root arms therefore also compare the link's target directory
// around each refusal, since the whole-root compare cannot see a write
// landing there. The link lies under no current source's write path and is
// never a source (SPEC 7), so the premise `build` passes; through the link
// the destination path itself is absent (the target directory is empty), so
// no occupant refusal applies beside the component one — one finding,
// refused-invalid-destination concerning the destination path (14, T14-7),
// never 14.22. The derived-path arm's sibling stages `mdout/new` — the emit
// destination's directory component — as such a link (to `linked/`) instead
// of a plain file, refused identically.
const V4_LINK_COMPONENT = "specs/sub";
const V4_LINKED_DIR = "linked"; // the real, empty inside-root target
const V4_LINKED_TARGET = "../linked"; // spelled from one level below the root
const V4_OUTSIDE_DIR = "outside"; // beside the root in the temporary directory
const V4_OUTSIDE_TARGET = "../../outside"; // work/specs/sub → tempRoot/outside
const V4_LINK_FILE_DEST = "specs/sub/b.mdx";
const V4_LINK_SECTION_DEST = "specs/sub/new.mdx";

/**
 * One T6.5-4 refusal case: the full move argv (without `--json`), the
 * expected refusal finding — or one expectation per applicable reason where
 * the staging carries several (SPEC 14) — and its diagnosis context.
 */
export interface MoveRefusalCase {
  readonly argv: readonly string[];
  readonly expected: RefusalExpectation | readonly RefusalExpectation[];
  readonly reason: string;
}

/**
 * The two link-component arms (V4_LINK_COMPONENT's note) for one staging of
 * `specs/sub` — the file-form destination and the section form's created
 * target file — each refused refused-invalid-destination concerning the
 * destination path (SPEC 6.5, 14, T14-7), never 14.22; `target` names what
 * the staged link resolves to, for diagnosis.
 */
function linkComponentCases(target: string): readonly MoveRefusalCase[] {
  return [
    {
      argv: ["move", "specs/A.mdx", V4_LINK_FILE_DEST],
      expected: {
        finding: "refused-invalid-destination",
        path: V4_LINK_FILE_DEST,
      },
      reason:
        "file form whose destination path has its directory component " +
        `specs/sub occupied by a symbolic link to ${target} — a component ` +
        "occupied by anything other than a directory, a symbolic link " +
        "whatever it targets, is the move's own refusal, never 14.22; a " +
        "product vetting components through link-following stat sees a " +
        "directory there, proceeds, and writes the moved file through the " +
        "link (SPEC 6.5, 7, 13.4, 14)",
    },
    {
      argv: ["move", "specs/A.mdx#x", `${V4_LINK_SECTION_DEST}#tnew`],
      expected: {
        finding: "refused-invalid-destination",
        path: V4_LINK_SECTION_DEST,
      },
      reason:
        "section form creating the target file specs/sub/new.mdx, whose " +
        `directory component specs/sub is a symbolic link to ${target} — ` +
        "the created target file's path is vetted like the file form's " +
        "destination, refused never 14.22; through the link the path is " +
        "absent, so no occupant reason applies beside it (SPEC 6.5, 7, " +
        "13.4, 14)",
    },
  ];
}

/**
 * T6.5-4's main-workspace staging and complete refusal-case table, exported
 * so T6.6-3 can stage each refusal identically and assert the `--preview`
 * invocation's refusal equivalence over it (TEST-SPEC §6.6: "for each
 * refusal of T6.4-3 and T6.5-4 — the invalid-workspace precondition included
 * — staged identically"). The workspace is MOVE_REFUSAL_CONFIG +
 * MOVE_REFUSAL_FILES with the destination occupants staged by
 * `stageMoveRefusalOccupants` BEFORE the premise `build` (which must still
 * pass — the staging note above the V4 fixtures).
 */
export const MOVE_REFUSAL_CONFIG = REFUSAL_CONFIG;
export const MOVE_REFUSAL_FILES: Readonly<Record<string, string>> = {
  [V4_A]: V4_A_SOURCE,
  [V4_B]: V4_B_SOURCE,
  [V4_OCC]: V4_OCC_SOURCE,
};

/**
 * Destination occupants (the V4 staging note): non-file occupants at
 * in-group `.mdx` paths discovery ignores, staged before the pre-refusal
 * `build` — a directory is no source file and discovery never yields a
 * symbolic link (SPEC 7), so the build stays valid and each occupant arm
 * refuses on exactly its staged ground — plus the inside-root staging of
 * the link-component arms (V4_LINK_COMPONENT's note): `specs/sub` a
 * symbolic link to the real, empty directory `linked/` at the root.
 */
export async function stageMoveRefusalOccupants(
  workspace: TestWorkspace,
): Promise<void> {
  await workspace.dir(V4_DIR_TARGET);
  await workspace.dir(V4_DIR_DEST);
  await workspace.symlink(V4_SYM_DEST, "B.mdx");
  await workspace.symlink(V4_LINK_TARGET, "B.mdx");
  await workspace.symlink(V4_GONE_DEST, "missing-target.mdx");
  await workspace.dir(V4_LINKED_DIR);
  await workspace.symlink(V4_LINK_COMPONENT, V4_LINKED_TARGET, "dir");
}

// Each case's expected refusal finding (SPEC 14): the exact stable code with
// the concern §14 assigns the reason — identity, path, or located
// participant (the module header's T6.5-4 note walks the per-reason
// choices). No `#`-containing and no non-UTF-8 destination case: those 6.5
// destination clauses are dead letters as refusals (T6.5-4's note) — every
// spelling that would present either is an exit-2 usage error first, staged
// in T6.5-5.
export const MOVE_REFUSAL_CASES: readonly MoveRefusalCase[] = [
  {
    argv: ["move", "specs/A.mdx#mv", "specs/B.mdx#bmv"],
    // The would-be spec import cycle's participating import declarations
    // exist in no pre-operation source (the move would add both), so no
    // concern window is assertable: the case pins the exact code and the
    // 12.7 form alone.
    expected: { finding: "refused-cycle" },
    reason:
      "spec import cycle — the moved node's local `d` on `keep` needs " +
      "B.mdx to import A.mdx while `user`'s reference to the moved " +
      "node needs A.mdx to import B.mdx (SPEC 6.5, 2.1)",
  },
  {
    argv: ["move", "specs/A.mdx#mv", "specs/A.mdx#keep.mv"],
    expected: {
      finding: "refused-cycle",
      locatedAt: { file: V4_A, window: V4_KEEP_WINDOW },
    },
    reason:
      "dependency cycle — the moved node depends on `keep` and would " +
      "become its child, a dependency on its own ancestor (SPEC 6.5, 5.3)",
  },
  {
    argv: ["move", "specs/A.mdx", "specs/B.mdx"],
    expected: { finding: "refused-destination-exists", path: V4_B },
    reason: "file form whose destination file already exists (SPEC 6.5)",
  },
  {
    argv: ["move", "specs/A.mdx", V4_SYM_DEST],
    expected: { finding: "refused-destination-exists", path: V4_SYM_DEST },
    reason:
      "file form whose destination path is occupied by a symbolic link — " +
      "whatever kind of filesystem object occupies it, a symbolic link " +
      "included (SPEC 6.5)",
  },
  {
    argv: ["move", "specs/A.mdx", V4_GONE_DEST],
    expected: { finding: "refused-destination-exists", path: V4_GONE_DEST },
    reason:
      "file form whose destination path is occupied by a broken symbolic " +
      "link, target absent — a product probing existence through " +
      "link-following stat sees the path absent and proceeds (SPEC 6.5)",
  },
  {
    argv: ["move", "specs/A.mdx", V4_DIR_DEST],
    expected: { finding: "refused-destination-exists", path: V4_DIR_DEST },
    reason:
      "file form whose destination path is occupied by a directory — " +
      "whatever kind of filesystem object occupies it; a product probing " +
      "for a file alone sees none there and proceeds (SPEC 6.5)",
  },
  {
    argv: ["move", "specs/A.mdx#x", `${V4_DIR_TARGET}#tdir`],
    expected: { finding: "refused-destination-exists", path: V4_DIR_TARGET },
    reason:
      "section form whose target path is occupied by a directory — not a " +
      "discovered spec source: neither an insertion target nor an absent " +
      "path to create (SPEC 6.5)",
  },
  {
    argv: ["move", "specs/A.mdx#x", `${V4_LINK_TARGET}#tlink`],
    expected: { finding: "refused-destination-exists", path: V4_LINK_TARGET },
    reason:
      "section form whose target path is occupied by a symbolic link " +
      "resolving to a discovered spec source — discovery never yields a " +
      "symlink (SPEC 6.5, 7): a product resolving the target path through " +
      "the filesystem finds a spec source there and inserts through the " +
      "link into B.mdx",
  },
  {
    argv: ["move", "specs/A.mdx#x", `${V4_OCC}#tocc`],
    expected: [
      { finding: "refused-destination-exists", path: V4_OCC },
      { finding: "refused-invalid-destination", path: V4_OCC },
    ],
    reason:
      "section form whose target path is occupied by an existing `.mdx` " +
      "file outside every configured spec group — present, right " +
      "extension, still no discovered spec source — refusing under both " +
      "applicable reasons, one finding per reason (SPEC 6.5, 14)",
  },
  {
    argv: ["move", "specs/A.mdx#keep", "specs/B.mdx#then"],
    expected: {
      finding: "refused-invalid-id",
      identity: { file: V4_B, id: "then" },
    },
    reason:
      "section form whose <new-id> is invalid per 1.4 — the forbidden " +
      "name `then` (the mirrored new-ID-is-valid check, SPEC 6.5)",
  },
  {
    argv: ["move", "specs/A.mdx#keep", "specs/B.mdx#ha lf"],
    expected: {
      finding: "refused-invalid-id",
      identity: { file: V4_B, id: "ha lf" },
    },
    reason:
      "section form whose <new-id> is invalid per 1.4 — a " +
      "whitespace-bearing segment (SPEC 6.5)",
  },
  {
    argv: ["move", "specs/A.mdx#keep", "specs/B.mdx#"],
    expected: {
      finding: "refused-invalid-id",
      identity: { file: V4_B, id: "" },
    },
    reason:
      "section form whose <new-id> is empty — the destination operand " +
      "`specs/B.mdx#` holds one `#`, a well-formed 12.0 split whose id " +
      "part has zero segments, refused as an invalid intrinsic ID (one or " +
      "more segments, SPEC 14) — never the exit-2 malformed-value " +
      "treatment a product gets by generalizing 11.3's `--to` spelling " +
      "rule to move operands (SPEC 6.5, 12.0)",
  },
  {
    argv: ["move", "specs/A.mdx#x", "specs/B.mdx#y"],
    expected: {
      finding: "refused-id-collision",
      locatedAt: { file: V4_B, window: V4_Y_WINDOW },
    },
    reason:
      "the ordinary cross-file collision — <new-id> `y` collides with the " +
      "section `y` already present in the distinct target file (SPEC 6.5)",
  },
  {
    argv: ["move", "specs/A.mdx#keep", "specs/B.mdx#nope.k"],
    expected: {
      finding: "refused-missing-target-parent",
      identity: { file: V4_B, id: "nope" },
    },
    reason:
      "section form whose target parent (`nope`, the <new-id> minus its " +
      "final segment) is missing from the target file (SPEC 6.5)",
  },
  {
    argv: ["move", "specs/A.mdx#x", "specs/A.mdx#x.sub.q"],
    expected: {
      finding: "refused-missing-target-parent",
      identity: { file: V4_A, id: "x.sub" },
    },
    reason:
      "section form whose target parent (`x.sub`) lies within the moved " +
      "subtree, leaving no insertion point after the removal (SPEC 6.5)",
  },
  {
    argv: ["move", "specs/A.mdx", "docs/Out.mdx"],
    expected: { finding: "refused-invalid-destination", path: "docs/Out.mdx" },
    reason:
      "destination path belonging to no configured spec group — a move " +
      "never takes a node out of the workspace (SPEC 6.5)",
  },
  {
    argv: ["move", "specs/A.mdx", "specs/dual/Out.mdx"],
    expected: {
      finding: "refused-invalid-destination",
      path: "specs/dual/Out.mdx",
    },
    reason:
      "destination path belonging to a code group as well (SPEC 6.5, 14.14)",
  },
  {
    argv: ["move", "specs/A.mdx", "specs/plain/Out.md"],
    expected: {
      finding: "refused-invalid-destination",
      path: "specs/plain/Out.md",
    },
    reason:
      "destination path lacking the `.mdx` extension — it matches the " +
      "`specs/plain/**` spec glob, isolating 14.19's extension rule " +
      "(SPEC 6.5, 7.1, 14.19)",
  },
  // The inside-root staging of the link-component arms (V4_LINK_COMPONENT's
  // note): `specs/sub` → `linked/`, staged by stageMoveRefusalOccupants; the
  // whole-root compare sees any write landing through the link.
  ...linkComponentCases(
    "the empty directory linked/ inside the workspace root",
  ),
];

/**
 * T6.5-4's derived-path arm (its own workspace; the V4_OUTDIR_CONFIG staging
 * note), exported for T6.6-3: the otherwise-valid destination's emit
 * destination has its directory component occupied by a plain file lying
 * under no current source's write path, so the premise `build` passes and
 * the refusal is the move's own — refused-invalid-destination concerning the
 * destination path, never 14.22.
 */
export const MOVE_DERIVED_PATH_CONFIG = V4_OUTDIR_CONFIG;
export const MOVE_DERIVED_PATH_FILES: Readonly<Record<string, string>> = {
  [V4_SOLO]: V4_SOLO_SOURCE,
  [V4_MDOUT_OCCUPANT]: V4_MDOUT_OCCUPANT_CONTENT,
};
export const MOVE_DERIVED_PATH_CASE: MoveRefusalCase = {
  argv: ["move", V4_SOLO, "new/b.mdx"],
  expected: { finding: "refused-invalid-destination", path: "new/b.mdx" },
  reason:
    "derived-path arm — a workspace-relative directory component of a " +
    "derived path the destination would generate, the emit destination " +
    "mdout/new/b.md under markdown.outDir, is occupied by a plain file: " +
    "refused refused-invalid-destination concerning the destination path, " +
    "never 14.22 — a product vetting only the destination path's own " +
    "components sees new/ absent and proceeds (SPEC 6.5, 7.3, 13.1, 13.2, 14)",
};

/**
 * T6.5-4's outside-root staging of the link-component arms
 * (V4_LINK_COMPONENT's note), exported for T6.6-3: MOVE_LINK_OUTSIDE_FILES
 * under MOVE_REFUSAL_CONFIG, `specs/sub` a symbolic link to a real, empty
 * directory created beside the workspace root in the test-owned temporary
 * directory (disposed with the workspace). Returns that directory's
 * absolute path: the caller compares its byte state around each refusal
 * (`assertLeavesUnchanged`), since the whole-root compare cannot see a
 * write landing through the link outside the root.
 */
export const MOVE_LINK_OUTSIDE_FILES: Readonly<Record<string, string>> = {
  [V4_A]: V4_A_SOURCE,
  [V4_B]: V4_B_SOURCE,
};
export async function stageMoveLinkOutsideComponent(
  workspace: TestWorkspace,
): Promise<string> {
  const outside = joinPath(workspace.tempRoot, V4_OUTSIDE_DIR);
  await fsp.mkdir(outside);
  await workspace.symlink(V4_LINK_COMPONENT, V4_OUTSIDE_TARGET, "dir");
  return outside;
}
export const MOVE_LINK_OUTSIDE_CASES: readonly MoveRefusalCase[] =
  linkComponentCases("an empty directory outside the workspace root");

/**
 * The derived-path arm's symbolic-link sibling (V4_LINK_COMPONENT's note),
 * exported for T6.6-3: MOVE_DERIVED_LINK_FILES under
 * MOVE_DERIVED_PATH_CONFIG, with `mdout/new` — the emit destination's
 * directory component — staged as a symbolic link to the real, empty
 * directory `linked/` instead of a plain file; the link lies under no
 * current source's write path (specs/Solo.mdx emits mdout/specs/Solo.md),
 * so the premise `build` passes, and the move is refused identically —
 * refused-invalid-destination concerning the destination path, never
 * 14.22, the link and its target byte-identical afterward.
 */
export const MOVE_DERIVED_LINK_FILES: Readonly<Record<string, string>> = {
  [V4_SOLO]: V4_SOLO_SOURCE,
};
export async function stageMoveDerivedLinkComponent(
  workspace: TestWorkspace,
): Promise<void> {
  await workspace.dir(V4_LINKED_DIR);
  await workspace.symlink(V4_MDOUT_OCCUPANT, V4_LINKED_TARGET, "dir");
}
export const MOVE_DERIVED_LINK_CASE: MoveRefusalCase = {
  argv: MOVE_DERIVED_PATH_CASE.argv,
  expected: MOVE_DERIVED_PATH_CASE.expected,
  reason:
    "derived-path arm's symbolic-link sibling — the emit destination's " +
    "directory component mdout/new occupied by a symbolic link to the " +
    "empty directory linked/ instead of a plain file (a component occupied " +
    "by a symbolic link, whatever it targets; writes never traverse one): " +
    "refused refused-invalid-destination concerning the destination path, " +
    "never 14.22, the link and its target byte-identical (SPEC 6.5, 7.3, " +
    "13.1, 13.2, 13.4, 14)",
};

/**
 * T6.5-4's valid-workspace precondition arm (as T6.4-6), exported for
 * T6.6-3: stage MOVE_PRECONDITION_FILES under MOVE_REFUSAL_CONFIG, `build`
 * (exit 0), then overwrite MOVE_PRECONDITION_BREAK_FILE with
 * MOVE_PRECONDITION_BREAK_SOURCE — the pre-existing validation error
 * elsewhere (14.5) — and the otherwise-valid move refuses reporting the
 * workspace's numbered findings alone.
 */
export const MOVE_PRECONDITION_FILES: Readonly<Record<string, string>> = {
  [V4_A]: V4_A_SOURCE,
  [V4_B]: V4_B_SOURCE,
  [V4_OTHER]: V4_OTHER_VALID,
};
export const MOVE_PRECONDITION_BREAK_FILE = V4_OTHER;
export const MOVE_PRECONDITION_BREAK_SOURCE = V4_OTHER_INVALID;
export const MOVE_PRECONDITION_CASE: MoveRefusalCase = {
  argv: ["move", "specs/A.mdx#keep", "specs/B.mdx#kp"],
  expected: { finding: "14.5", locatedAt: { file: V4_OTHER } },
  reason:
    "valid-workspace precondition as T6.4-6 — the workspace fails the " +
    "validations of `xspec build` through an unresolved d reference in " +
    "specs/Other.mdx (SPEC 14.5), so the move refuses before modifying " +
    "anything, reporting the workspace's numbered findings alone " +
    "(SPEC 6.5, 6.4, 12.1, 14)",
};

const T6_5_4 = defineProductTest({
  id: "T6.5-4",
  title:
    "refusals (exit 1, nothing modified): a move creating a spec import cycle or a dependency cycle (refused-cycle, the dependency arm locating the participating `d` spelling); file form whose destination exists — occupied by a plain file, by a directory, by a symbolic link, and by a broken symbolic link with its target absent, one arm each, the directory arm discriminating a product probing for a file alone and the broken-link arm discriminating a product probing existence through link-following stat (refused-destination-exists, concerning that path); section form whose target path is occupied by anything other than a discovered spec source — a directory; a symbolic link resolving to a discovered spec source (discovery never yields a symlink); and an existing `.mdx` file outside every configured spec group, the latter refusing under refused-destination-exists and refused-invalid-destination together, one finding per applicable reason; section form with a 1.4-invalid `<new-id>` (forbidden name `then`; whitespace-bearing segment; the empty `<new-id>` of destination operand `specs/B.mdx#`, a well-formed 12.0 split with zero id segments, never the exit-2 generalization of 11.3's `--to` spelling rule — refused-invalid-id, concerning that identity); the ordinary cross-file `<new-id>` collision (refused-id-collision, locating the remaining bearer); a missing target parent and a target parent within the moved subtree (refused-missing-target-parent, concerning the target-parent identity); destination paths in no configured spec group, in a code group as well, or lacking `.mdx`, and the derived-path arm — emission enabled under `markdown.outDir`, the otherwise-valid destination's emit-destination directory component `mdout/new` occupied by a plain file lying under no current source's write path, refused never 14.22 (refused-invalid-destination, concerning the destination path); the symbolic-link arms of the same clause — a file-form move to `specs/sub/b.mdx` and a section-form move creating the target file `specs/sub/new.mdx`, `specs/sub` a symbolic link to a real, empty directory, staged with the link targeting a directory inside the workspace root and, on its own workspace, one outside it — each refused-invalid-destination concerning the destination path, never 14.22, nothing written through the link inside or outside the workspace (the link and its target directory byte-identical afterward), and the derived-path arm's sibling staging `mdout/new` as such a link instead of a plain file, refused identically — each refusal the form-exact 12.7 findings-only report holding exactly one finding per applicable reason with its exact stable code; the `#`-containing and non-UTF-8 destination clauses admit no refusal staging (the dead-letter note): every such operand spelling is an exit-2 usage error first, staged in T6.5-5; plus the valid-workspace precondition as T6.4-6, reporting the workspace's numbered findings alone (SPEC 6.5, 7, 7.3, 5.3, 2.1, 1.4, 1.3, 13.1, 13.2, 13.4, 14.14, 14.19, 14.22, 12.0, 12.7, 14)",
  run: async (product) => {
    await withWorkspace(
      MOVE_REFUSAL_CONFIG,
      MOVE_REFUSAL_FILES,
      async (workspace) => {
        // Destination occupants (the staging note above): staged before the
        // pre-refusal `build`, which must still pass, so each occupant arm
        // refuses on exactly its staged ground, not the invalid-workspace
        // precondition.
        await stageMoveRefusalOccupants(workspace);
        // Build first, so the modifies-nothing compares include intact
        // derived files (the T6.4-3 protocol).
        await buildOk(
          product,
          workspace,
          "T6.5-4 `build` over the staged workspace",
        );

        // The complete case table (module scope, shared with T6.6-3's
        // preview-refusal equivalence — TEST-SPEC §6.6 "staged identically";
        // the dead-letter destination spellings stay in T6.5-5, the module
        // header's note).
        for (const { argv, expected, reason } of MOVE_REFUSAL_CASES) {
          await expectRefusalModifiesNothing(
            product,
            workspace,
            argv,
            expected,
            `T6.5-4 (${reason})`,
          );
        }
      },
    );

    // The outside-root staging of the link-component arms
    // (V4_LINK_COMPONENT's note): `specs/sub` a symbolic link to a real,
    // empty directory beside the workspace root. Each refusal is compared
    // over the link's target directory as well — a product writing the
    // moved file, or its regenerated derived files, through the link lands
    // them outside the root, where the whole-root compare cannot see them.
    await withWorkspace(
      MOVE_REFUSAL_CONFIG,
      MOVE_LINK_OUTSIDE_FILES,
      async (workspace) => {
        const outside = await stageMoveLinkOutsideComponent(workspace);
        await buildOk(
          product,
          workspace,
          "T6.5-4 outside-root link staging `build` — the link specs/sub " +
            "is never discovered nor traversed and lies under no current " +
            "source's write path (SPEC 7, 13.4), so the workspace passes " +
            "`build`'s validations and each refusal below is the move's own",
        );
        for (const { argv, expected, reason } of MOVE_LINK_OUTSIDE_CASES) {
          await assertLeavesUnchanged(
            outside,
            () =>
              expectRefusalModifiesNothing(
                product,
                workspace,
                argv,
                expected,
                `T6.5-4 (${reason})`,
              ),
            `T6.5-4 (${reason}): the link's target directory outside the ` +
              `workspace root stays byte-identical — nothing is written ` +
              `through the link (SPEC 6.5, 13.4)`,
          );
        }
      },
    );

    // The derived-path arm of refused-invalid-destination, on its own
    // workspace (V4_OUTDIR_CONFIG's note): the destination `new/b.mdx` is
    // otherwise valid and its own directory components unobstructed (`new/`
    // absent — a nonexistent component is never a refusal cause, SPEC
    // 13.4), but the emit destination `mdout/new/b.md` it would generate
    // (SPEC 13.2, 7.3) has its directory component `mdout/new` occupied by
    // a plain file.
    await withWorkspace(
      MOVE_DERIVED_PATH_CONFIG,
      MOVE_DERIVED_PATH_FILES,
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T6.5-4 derived-path arm `build` over the staged workspace — the " +
            "plain file mdout/new lies under no current source's write " +
            "path (SPEC 13.4), so the workspace passes `build`'s " +
            "validations and the refusal below is the move's own",
        );
        await expectRefusalModifiesNothing(
          product,
          workspace,
          MOVE_DERIVED_PATH_CASE.argv,
          MOVE_DERIVED_PATH_CASE.expected,
          `T6.5-4 (${MOVE_DERIVED_PATH_CASE.reason})`,
        );
      },
    );

    // The derived-path arm's symbolic-link sibling (V4_LINK_COMPONENT's
    // note): `mdout/new` a symbolic link to the empty directory `linked/`
    // instead of a plain file — refused identically, the link and its
    // target byte-identical (both inside the root: the whole-root compare).
    await withWorkspace(
      MOVE_DERIVED_PATH_CONFIG,
      MOVE_DERIVED_LINK_FILES,
      async (workspace) => {
        await stageMoveDerivedLinkComponent(workspace);
        await buildOk(
          product,
          workspace,
          "T6.5-4 derived-path link sibling `build` — the link mdout/new " +
            "lies under no current source's write path (SPEC 13.4), so the " +
            "workspace passes `build`'s validations and the refusal below " +
            "is the move's own",
        );
        await expectRefusalModifiesNothing(
          product,
          workspace,
          MOVE_DERIVED_LINK_CASE.argv,
          MOVE_DERIVED_LINK_CASE.expected,
          `T6.5-4 (${MOVE_DERIVED_LINK_CASE.reason})`,
        );
      },
    );

    // Valid-workspace precondition, as T6.4-6: with a pre-existing
    // validation error elsewhere, the move's own arguments being valid, the
    // move refuses (exit 1) before modifying anything. The invalid-workspace
    // refusal reports the workspace's findings themselves — exactly the one
    // 14.5 finding located in the offending file, no refusal reason
    // evaluated or reported beside it (SPEC 6.5, 6.4, 14).
    await withWorkspace(
      MOVE_REFUSAL_CONFIG,
      MOVE_PRECONDITION_FILES,
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T6.5-4 precondition arm `build` over the staged workspace",
        );
        await workspace.file(
          MOVE_PRECONDITION_BREAK_FILE,
          MOVE_PRECONDITION_BREAK_SOURCE,
        );
        await expectRefusalModifiesNothing(
          product,
          workspace,
          MOVE_PRECONDITION_CASE.argv,
          MOVE_PRECONDITION_CASE.expected,
          `T6.5-4 (${MOVE_PRECONDITION_CASE.reason})`,
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T6.5-5 — usage errors (exit 2)
// ---------------------------------------------------------------------------

const U5_A = "specs/A.mdx";
const U5_A_SOURCE = [
  '<S id="a">',
  "Alpha text.",
  "",
  '<S id="a.mid">',
  "Mid text.",
  "</S>",
  "</S>",
  "",
].join("\n");

const U5_B = "specs/B.mdx";
const U5_B_SOURCE = ['<S id="b">', "Beta text.", "</S>", ""].join("\n");

// The ordering arm's unrelated validation error: an unresolved local `d`
// reference (14.5) in a file untouched by the move arguments.
const U5_BAD = "specs/Bad.mdx";
const U5_BAD_SOURCE = [
  '<S id="bad" d={"nope"}>',
  "Bad text depending on nothing that exists.",
  "</S>",
  "",
].join("\n");

// The masking arm's unparseable origin file: an unclosed section tag (14.20).
const U5_BROKEN = "specs/Broken.mdx";
const U5_BROKEN_SOURCE = [
  '<S id="broken">',
  "Text that never closes.",
  "",
].join("\n");

// The wrong-kind arms' discovered code source (SPEC 7.2): valid TypeScript
// with no spec references, so the base arm's workspace still builds clean —
// a code source bears no requirement IDs, and both forms' origin operands
// name discovered spec sources (SPEC 6.5), making a code-source origin a
// wrong-kind operand in either form, judged like existence before any
// content question (SPEC 6.4, 12.0).
const U5_CODE = "src/app.ts";
const U5_CODE_SOURCE = "export function noop(): void {}\n";

// The second nonexistent-`<file>` spelling (TEST-SPEC T6.5-5: "both of
// T6.4-4's spellings"): a valid `.mdx` present on disk, holding a section
// spelling the origin ID `a`, but outside every configured spec group
// (`specs/**/*.mdx`, SPEC 7) — both forms' origin operands name discovered
// spec sources (SPEC 6.5), and a file named in an argument exists as a
// member of the discovered set (SPEC 12.0), so this operand is as
// nonexistent as an absent path in either form. A product probing the
// filesystem for the operand finds the file (file form) and the origin ID
// it spells (section form) and proceeds — moving the stray file to
// `specs/New.mdx`, or inserting its `a` subtree into `specs/B.mdx` as `z` —
// instead of exiting 2, so the existence table runs inside whole-root
// modifies-nothing compares. Its `a` beside `specs/A.mdx`'s is no
// duplicate-ID condition even when discovered (SPEC 14 condition 3 is a
// duplicate within a file), so the base arm pins the stray file's absence
// from the discovered set directly, through `ids --json` (SPEC 12.3), as
// T6.4-4 does.
const U5_STRAY = "docs/Stray.mdx";
const U5_STRAY_SOURCE = [
  '<S id="a">',
  "Stray text outside every spec group.",
  "</S>",
  "",
].join("\n");

// Parse-local existence fixtures, mirroring T6.4-4 (SPEC 6.5, 6.4, 11.2).
// Two sections both spelling the same ID: every bearer's node identity is
// undefined (11.2, duplicate spellings), yet each spells `dup`, so the
// origin ID exists and the duplicate-ID finding (14.3) refuses instead of
// any usage error.
const U5_DUP = "specs/Dup.mdx";
const U5_DUP_SOURCE = [
  '<S id="dup">',
  "First bearer text.",
  "</S>",
  "",
  '<S id="dup">',
  "Second bearer text.",
  "</S>",
  "",
].join("\n");

// A sole bearer spelling its ID beneath an ancestor spelling no identity —
// no `id` attribute at all (14.1): the bearer's node identity is undefined
// through the ancestor chain (11.2), yet it spells `kid`, so the origin ID
// exists and the ancestor's finding refuses. The bearer's own structural
// check (14.2) is masked by the parent's condition (SPEC 14 condition 2), so
// the workspace's findings are exactly the one 14.1.
const U5_ANC = "specs/Anc.mdx";
const U5_ANC_SOURCE = [
  "<S>",
  "Ancestor text spelling no identity.",
  "",
  '<S id="kid">',
  "Kid text.",
  "</S>",
  "</S>",
  "",
].join("\n");

// The origin ID's only would-be bearer spells no identity — its `id`
// attribute repeated on the tag (11.2; condition 17, never 14.1) — so the
// origin ID is nonexistent: exit 2 even beside that file's findings.
const U5_SOLO = "specs/Solo.mdx";
const U5_SOLO_SOURCE = [
  '<S id="solo" id="solo">',
  "Sole would-be bearer text.",
  "</S>",
  "",
].join("\n");

// Destination operand that is not valid UTF-8: `specs/<0xFF>.mdx` (Linux-leg
// staging — argv is a byte channel there; T6.5-5, T12.0-5, T1.5-2's note).
// It contains no `#`, so only the argument-value rule makes it exit 2: a
// non-UTF-8 argument value is a usage error (SPEC 12.0), and a valid operand
// therefore never denotes a non-UTF-8 destination path — the 6.5 refusal
// clause is unreachable (T6.5-4's dead-letter note).
const U5_NON_UTF8_DESTINATION: Uint8Array = Buffer.concat([
  Buffer.from("specs/", "utf8"),
  Buffer.from([0xff]),
  Buffer.from(".mdx", "utf8"),
]);

// The T6.5-5 usage tables below are exported so T6.6-3 can assert each
// `--preview` variant exits 2 identically (TEST-SPEC §6.6: "for the usage
// errors of T6.4-4/T6.5-5 the preview exits 2 identically — argument checks
// precede either way").

export const MOVE_USAGE_CASES: readonly (readonly [
  readonly string[],
  string,
])[] = [
  [
    ["move", "specs/Missing.mdx", "specs/New.mdx"],
    "file form, nonexistent origin file, absent on disk",
  ],
  [
    ["move", U5_STRAY, "specs/New.mdx"],
    "file form, nonexistent origin file — an .mdx present on disk but " +
      "matched by no spec group (a file named in an argument exists as a " +
      "member of the discovered set, SPEC 12.0; both forms' origin " +
      "operands name discovered spec sources, SPEC 6.5)",
  ],
  [
    ["move", "specs/Missing.mdx#a", "specs/B.mdx#z"],
    "section form, nonexistent origin file, absent on disk",
  ],
  [
    ["move", `${U5_STRAY}#a`, "specs/B.mdx#z"],
    "section form, nonexistent origin file — an .mdx present on disk " +
      "(holding a section spelling the origin ID) but matched by no spec " +
      "group (SPEC 6.5, 12.0)",
  ],
  [
    ["move", "specs/A.mdx#nope", "specs/B.mdx#z"],
    "section form, nonexistent origin ID",
  ],
];

// Wrong-kind origins (SPEC 6.5: both forms' origin operands name discovered
// spec sources; a code source bears no requirement IDs, so a code-source
// origin is a wrong-kind operand, judged like existence before any content
// question, SPEC 6.4, 12.0). The section form's id part names the code
// file's real exported unit (`noop`), so a product that resolves code units
// in move origins is discriminated. These cases ride the base arm (inside
// modifies-nothing compares) and the ordering arm (the wrong-kind check
// precedes source validation, as T6.4-4).
export const MOVE_WRONG_KIND_CASES: readonly (readonly [
  readonly string[],
  string,
])[] = [
  [
    ["move", U5_CODE, "specs/New.mdx"],
    "file form, discovered code source as origin",
  ],
  [
    ["move", `${U5_CODE}#noop`, "specs/B.mdx#z"],
    "section form, discovered code source as origin file",
  ],
];

// The three mixed-synopsis invocations (SPEC 6.5: a move operand is
// classified by spelling alone — an operand containing `#` is a
// `<file>#<id>` pair under the 12.0 split, one without is a file — so an
// invocation mixing the two synopses' forms matches neither). Every operand
// names staged content (`specs/A.mdx`, its section `a`, `specs/B.mdx`), so a
// product accepting a mixed form would perform a move — each case runs
// inside a whole-root modifies-nothing compare. The third, the
// `#`-containing file-form destination, is also the staging T6.5-4's
// dead-letter note sets aside: exit 2, never the 6.5 destination refusal
// (exit 1) it would be were the operand a path.
export const MOVE_MIXED_SYNOPSIS_CASES: readonly (readonly [
  readonly string[],
  string,
])[] = [
  [
    ["move", U5_A, "specs/B.mdx#y"],
    "mixed synopsis `a.mdx b.mdx#y` — a bare-file origin with a pair " +
      "destination matches neither form (SPEC 6.5, 12.0)",
  ],
  [
    ["move", `${U5_A}#a`, U5_B],
    "mixed synopsis `a.mdx#x b.mdx` — a pair origin with a bare-file " +
      "destination matches neither form (SPEC 6.5, 12.0)",
  ],
  [
    ["move", "specs/A.mdx", "specs/Ha#sh.mdx"],
    "mixed synopsis `a.mdx b#c.mdx` — the `#`-containing file-form " +
      "destination classifies as a `<file>#<id>` pair by spelling alone, " +
      "so the invocation mixes the two synopses' forms and matches " +
      "neither (SPEC 6.5, 12.0; the staging T6.5-4's dead-letter note " +
      "sets aside)",
  ],
];

/**
 * The non-UTF-8 destination operand invocation (raw argv bytes; the other
 * dead-letter staging) — Linux leg only: Linux argv is a byte channel, so
 * the destination is passed as raw bytes via the subprocess driver's
 * raw-argv support; other platforms cannot carry the argument at all
 * (T1.5-2's platform note). Callers gate on `process.platform === "linux"`.
 */
export const MOVE_NON_UTF8_ARGV: readonly ArgvValue[] = [
  "move",
  U5_A,
  U5_NON_UTF8_DESTINATION,
];

/** The base/ordering staging shared by the usage cases (T6.4-4's mirror):
 * valid sources, the discovered code source, the undiscovered stray `.mdx`,
 * and — in the ordering variant — the failing Bad.mdx, exported for
 * T6.6-3's preview sweep. */
export const MOVE_USAGE_CONFIG = SPEC_AND_CODE_CONFIG;
export const MOVE_USAGE_ORDERING_FILES: Readonly<Record<string, string>> = {
  [U5_A]: U5_A_SOURCE,
  [U5_B]: U5_B_SOURCE,
  [U5_BAD]: U5_BAD_SOURCE,
  [U5_CODE]: U5_CODE_SOURCE,
  [U5_STRAY]: U5_STRAY_SOURCE,
};

/**
 * T6.5-5's parse-local nonexistence staging (the sole would-be bearer
 * spells no identity — its `id` attribute repeated): the move is exit 2 even
 * beside that file's findings. Exported for T6.6-3's preview variant; stage
 * under MOVE_SOLO_CONFIG and pin the one-14.17 premise before invoking.
 */
export const MOVE_SOLO_CONFIG = SPECS_ONLY_CONFIG;
export const MOVE_SOLO_FILES: Readonly<Record<string, string>> = {
  [U5_SOLO]: U5_SOLO_SOURCE,
};
export const MOVE_SOLO_ARGV: readonly string[] = [
  "move",
  `${U5_SOLO}#solo`,
  "specs/New.mdx#solo2",
];

const T6_5_5 = defineProductTest({
  id: "T6.5-5",
  title:
    "usage errors (exit 2): a nonexistent origin file in either form — absent on disk, or an `.mdx` present on disk but matched by no spec group (a file named in an argument exists as a member of the discovered set), its absence from the discovered set pinned through `ids --json` — a nonexistent origin ID, and a discovered code source as the origin in each form — both forms' origin operands name discovered spec sources, so a code-source origin is a wrong-kind operand, judged like existence before any content question — are usage errors checked before source validation, the same exit 2 even when the workspace also has unrelated validation errors (12.0 ordering, as T6.4-4); an origin ID inside an unparseable origin file is masked: the validation findings are reported and the command exits 1; origin-ID existence is parse-local over spelled identities: an ID two sections both spell, or one whose sole bearer spells it beneath an ancestor spelling no identity, exists — the duplicate-ID or ancestor finding refuses instead (exit 1, never exit 2, nothing modified) — while an ID whose only would-be bearer spells no identity (its `id` attribute repeated on the tag) is nonexistent, exit 2 even beside that file's findings; operand classification is by spelling alone: the three mixed-synopsis invocations — bare-file origin with pair destination, pair origin with bare-file destination, and a `#`-containing file-form destination classified as a pair — match neither synopsis (exit 2), and a non-UTF-8 destination operand (raw argv bytes, Linux leg) is a usage-error argument value (exit 2) — the latter two the stagings T6.5-4's dead-letter note sets aside — the existence, wrong-kind, mixed-synopsis, dead-letter, and refusal arms each proving nothing modified (SPEC 6.5, 6.4, 11.2, 12.0, 14, 14.20)",
  run: async (product) => {
    // --- Base arm: a valid workspace ---
    await withWorkspace(
      SPEC_AND_CODE_CONFIG,
      {
        [U5_A]: U5_A_SOURCE,
        [U5_B]: U5_B_SOURCE,
        [U5_CODE]: U5_CODE_SOURCE,
        [U5_STRAY]: U5_STRAY_SOURCE,
      },
      async (workspace) => {
        const context = "T6.5-5 valid-workspace arm";
        await buildOk(product, workspace, `${context}: \`build\``);
        // Staging premise: the stray file is outside the discovered set —
        // `ids --json` lists the discovered spec sources (SPEC 12.3), and it
        // lists `specs/A.mdx` but never `docs/Stray.mdx`. Pinning this makes
        // the exit-2 assertions on the stray origin demonstrably a
        // discovered-set judgement over a file present on disk, not a
        // filesystem miss (as T6.4-4).
        const idsLabel = `${context}: \`ids --json\` premise`;
        const listed = decodeIdsReport(
          await runJson(product, workspace, ["ids", "--json"], idsLabel),
          idsLabel,
        ).files.map((entry) => entry.file);
        if (!listed.includes(U5_A) || listed.includes(U5_STRAY)) {
          fail(
            `${context}: staging premise — the discovered spec sources must ` +
              `include ${U5_A} and exclude the stray ${U5_STRAY} (outside ` +
              `every spec group, SPEC 7; a file named in an argument exists ` +
              `as a member of the discovered set, SPEC 12.0), but \`ids ` +
              `--json\` listed ${JSON.stringify(listed)}`,
          );
        }
        // Every usage error modifies nothing (SPEC 12.0): one whole-root
        // byte compare around the existence table — derived files, sources,
        // and the stray file alike (a product probing the filesystem for the
        // stray origin would move it, or insert its subtree into B.mdx).
        await assertLeavesUnchanged(
          workspace.root,
          async () => {
            for (const [argv, label] of MOVE_USAGE_CASES) {
              await expectMoveUsageError(
                product,
                workspace,
                argv,
                `${context}, ${label}`,
              );
            }
          },
          `${context}: the usage errors modify nothing (SPEC 6.5, 12.0)`,
        );

        // Wrong-kind origins (SPEC 6.5: both forms' origin operands name
        // discovered spec sources), each inside a whole-root
        // modifies-nothing snapshot compare: the operands name a real
        // discovered code file and its real exported unit, so a product
        // accepting a code-source origin would relocate the file (file
        // form) or act on the named unit (section form).
        for (const [argv, label] of MOVE_WRONG_KIND_CASES) {
          await assertLeavesUnchanged(
            workspace.root,
            async () => {
              await expectMoveUsageError(
                product,
                workspace,
                argv,
                `${context}, ${label} — a code source bears no requirement ` +
                  `IDs, so a code-source origin is a wrong-kind operand, ` +
                  `judged like existence before any content question ` +
                  `(SPEC 6.5, 6.4, 12.0)`,
              );
            },
            `${context}, ${label}: the usage error modifies nothing ` +
              `(SPEC 6.5, 12.0)`,
          );
        }

        // The three mixed-synopsis invocations (the module-scope table's
        // note): each asserted with a whole-root modifies-nothing snapshot
        // compare around the command.
        for (const [argv, label] of MOVE_MIXED_SYNOPSIS_CASES) {
          await assertLeavesUnchanged(
            workspace.root,
            async () => {
              await expectMoveUsageError(
                product,
                workspace,
                argv,
                `${context}, ${label}`,
              );
            },
            `${context}, ${label}: the usage error modifies nothing ` +
              `(SPEC 6.5, 12.0)`,
          );
        }

        // Non-UTF-8 destination operand — the other staging T6.5-4's
        // dead-letter note sets aside (SPEC 6.5's non-UTF-8 destination
        // clause: a non-UTF-8 argument value is a usage error before any
        // refusal is evaluated) — staged on the Linux leg only (mirroring
        // T1.5-2's platform note): Linux argv is a byte channel, so the
        // destination is passed as raw bytes (driver trampoline); other
        // platforms cannot carry the argument at all.
        if (process.platform === "linux") {
          await assertLeavesUnchanged(
            workspace.root,
            async () => {
              await expectMoveUsageError(
                product,
                workspace,
                MOVE_NON_UTF8_ARGV,
                `${context}, non-UTF-8 destination operand (raw argv ` +
                  `bytes, Linux leg) — a non-UTF-8 argument value is a ` +
                  `usage error (SPEC 12.0)`,
              );
            },
            `${context}: \`move ${U5_A} <non-UTF-8 bytes>\` — the usage ` +
              `error modifies nothing (SPEC 6.5, 12.0)`,
          );
        }
      },
    );

    // --- Ordering arm: the workspace also fails build validation ---
    await withWorkspace(
      MOVE_USAGE_CONFIG,
      MOVE_USAGE_ORDERING_FILES,
      async (workspace) => {
        const context = "T6.5-5 ordering arm";
        // Staging premise: the workspace really fails build validation, so
        // the exit-2/empty-stdout observations discriminate — a product that
        // validates sources before the argument existence checks exits 1
        // with these findings instead (SPEC 12.0).
        const findings = await buildFindings(
          product,
          workspace,
          `${context}: \`build --json\` premise — the staged workspace fails ` +
            `build validation (unresolved d reference, SPEC 14.5)`,
        );
        if (findings.length === 0) {
          fail(
            `${context}: staging premise — the failing \`build\` must report ` +
              `at least one validation finding (SPEC 14)`,
          );
        }
        await assertLeavesUnchanged(
          workspace.root,
          async () => {
            for (const [argv, label] of MOVE_USAGE_CASES) {
              await expectMoveUsageError(
                product,
                workspace,
                argv,
                `${context}, ${label}, with unrelated validation errors ` +
                  `present — the existence checks precede source ` +
                  `validation (SPEC 12.0)`,
              );
            }
            for (const [argv, label] of MOVE_WRONG_KIND_CASES) {
              await expectMoveUsageError(
                product,
                workspace,
                argv,
                `${context}, ${label}, with unrelated validation errors ` +
                  `present — the wrong-kind operand is judged like ` +
                  `existence, before source validation (SPEC 6.5, 6.4, ` +
                  `12.0)`,
              );
            }
          },
          `${context}: the usage errors modify nothing (SPEC 6.5, 12.0)`,
        );
      },
    );

    // --- Masking arm: the origin ID lives inside an unparseable file ---
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      {
        [U5_A]: U5_A_SOURCE,
        [U5_B]: U5_B_SOURCE,
        [U5_BROKEN]: U5_BROKEN_SOURCE,
      },
      async (workspace) => {
        const context = "T6.5-5 masking arm";
        const command = `move ${U5_BROKEN}#broken specs/B.mdx#bk --json`;
        const result = await expectExit(
          product,
          workspace,
          ["move", `${U5_BROKEN}#broken`, "specs/B.mdx#bk", "--json"],
          1,
          `${context}: \`${command}\` — an origin ID inside an unparseable ` +
            `origin file (14.20) is masked: the validation findings are ` +
            `reported and the command exits 1, not 2 (SPEC 6.5, 12.0, 14)`,
        );
        const findings = decodeFindingsReport(
          parseJsonStdout(result, `${context}: \`${command}\``),
          `${context}: \`${command}\``,
        ).findings;
        assertConditionCounts(
          findings,
          { "14.20": 1 },
          `${context}: the reported findings are exactly the workspace's one ` +
            `unparseable-source condition (SPEC 14.20; the unparseable file ` +
            `masks the conditions inside itself, SPEC 14)`,
        );
        assertFindingLocated(
          findings[0]!,
          { file: U5_BROKEN },
          `${context}: the 14.20 finding identifies the unparseable origin ` +
            `file and the location of the parse failure (SPEC 14, 14.20)`,
        );
      },
    );

    // --- Parse-local existence: duplicate spellings still establish it ---
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [U5_DUP]: U5_DUP_SOURCE },
      async (workspace) => {
        // Moving an ID two sections both spell is no usage error: the
        // bearers establish existence, their undefined node identities
        // notwithstanding (SPEC 6.5, 6.4, 11.2), and the duplicate-ID
        // finding refuses instead — the invalid-workspace refusal, exit 1,
        // reporting the workspace's numbered findings alone: exactly one
        // 14.3 finding (duplicate identities are one finding locating every
        // bearer, SPEC 14), nothing modified, the absent target file not
        // created (creation is the successful section move's business,
        // SPEC 6.5).
        await expectRefusalModifiesNothing(
          product,
          workspace,
          ["move", `${U5_DUP}#dup`, "specs/New.mdx#dup2"],
          { finding: "14.3", locatedAt: { file: U5_DUP } },
          "T6.5-5 parse-local existence, duplicate spellings (moving an " +
            "ID two sections both spell is no usage error — the " +
            "duplicate-ID finding refuses instead: exit 1, never exit 2; " +
            "SPEC 6.5, 11.2, 14)",
        );
      },
    );

    // --- Parse-local existence: an undefined ancestor chain still
    // establishes it ---
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [U5_ANC]: U5_ANC_SOURCE },
      async (workspace) => {
        // The sole bearer spells `kid` beneath an ancestor spelling no
        // identity (no `id` attribute): the bearer establishes existence —
        // its undefined ancestor chain notwithstanding (SPEC 6.5, 6.4,
        // 11.2) — and the ancestor's finding refuses: exit 1 with exactly
        // the one 14.1 finding (the bearer's structural check is masked by
        // the parent's condition, SPEC 14 condition 2), never exit 2,
        // nothing modified.
        await expectRefusalModifiesNothing(
          product,
          workspace,
          ["move", `${U5_ANC}#kid`, "specs/New.mdx#kid2"],
          { finding: "14.1", locatedAt: { file: U5_ANC } },
          "T6.5-5 parse-local existence, sole bearer beneath an ancestor " +
            "spelling no identity (the bearer establishes existence and " +
            "the ancestor's missing-id finding refuses: exit 1, never " +
            "exit 2; SPEC 6.5, 11.2, 14)",
        );
      },
    );

    // --- Parse-local nonexistence: a would-be bearer spelling no
    // identity ---
    await withWorkspace(
      MOVE_SOLO_CONFIG,
      MOVE_SOLO_FILES,
      async (workspace) => {
        const context = "T6.5-5 spells-no-identity arm";
        // Staging premise: the repeated-`id` bearer leaves the file with
        // exactly one 14.17 finding — a repeated prop is condition 17,
        // never 14.1, spells no identity, and has no children whose masked
        // 14.2 could add findings (SPEC 11.2, 14). Pinning the premise
        // makes the exit-2 assertion below demonstrably run beside that
        // file's findings: a product that takes a repeated-`id` value as
        // spelled, or that reports the file's findings in the origin ID's
        // place, exits 1 here instead.
        const findings = await buildFindings(
          product,
          workspace,
          `${context}: \`build --json\` premise — the staged workspace ` +
            `fails build validation (repeated \`id\` attribute, SPEC 14.17)`,
        );
        assertConditionCounts(
          findings,
          { "14.17": 1 },
          `${context}: staging premise — the repeated-\`id\` bearer is the ` +
            `file's one finding (SPEC 14: a repeated prop is condition 17, ` +
            `never condition 1)`,
        );
        await expectMoveUsageError(
          product,
          workspace,
          MOVE_SOLO_ARGV,
          `${context}: an origin ID whose only would-be bearer spells no ` +
            `identity (its \`id\` attribute repeated on the tag) is ` +
            `nonexistent — exit 2 even beside that file's findings ` +
            `(SPEC 6.5, 6.4, 11.2, 12.0)`,
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T6.5-6 — identity terms
// ---------------------------------------------------------------------------

// The new-identity checks read in identity terms (SPEC 6.5). Two clauses
// admit no discriminating fixture, per TEST-SPEC T6.5-6, and are documented
// rather than staged:
// - The collision clause's after-the-removal qualifier: structural IDs (1.3)
//   make the vacated set exactly the moved subtree's IDs, so a `<new-id>`
//   matching only vacated identities is always independently refused — as
//   the exact self-move, or because its target parent is missing or lies
//   within the moved subtree (T6.5-4).
// - The mirrored "all rewritten references resolve" clause, for T6.4-3's
//   reason: a move rewrites only valid workspaces and retargets every
//   affected reference to identities that exist after the operation; it is
//   exercised as the always-passing side of every successful move.
const I6_A = "specs/A.mdx";
const I6_A_SOURCE = [
  '<S id="a">',
  "Alpha text.",
  "</S>",
  "",
  '<S id="x">',
  "Ex text.",
  "</S>",
  "",
].join("\n");

const I6_B = "specs/B.mdx";
const I6_B_SOURCE = ['<S id="b">', "Bee text.", "</S>", ""].join("\n");

const T6_5_6 = defineProductTest({
  id: "T6.5-6",
  title:
    "identity terms: a cross-file section move keeping its ID (`a.mdx#x` → `b.mdx#x`, no `x` in `b.mdx`) is valid — the new identity differs in its file part; the exact self-move (`<target-file>#<new-id>` equal to `<file>#<id>`) is refused with exit 1 as exactly one refused-identity-unchanged finding concerning that identity (no collision reason beside it), modifies nothing, and appends no journal entry (journal byte-compared around the attempt); a same-file move whose `<new-id>` collides with an ID remaining in the target file after the removal is refused as exactly one refused-id-collision finding locating the remaining bearer (SPEC 6.5, 1.5, 6.1, 12.7, 14)",
  run: async (product) => {
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [I6_A]: I6_A_SOURCE, [I6_B]: I6_B_SOURCE },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T6.5-6 `build` over the staged workspace",
        );

        // Valid: the cross-file move keeping its ID — the new identity
        // specs/B.mdx#x differs from specs/A.mdx#x in its file part
        // (SPEC 6.5: "a cross-file section move keeping its ID is
        // therefore valid").
        await expectExit(
          product,
          workspace,
          ["move", "specs/A.mdx#x", "specs/B.mdx#x"],
          0,
          "T6.5-6 `move specs/A.mdx#x specs/B.mdx#x` — a cross-file section " +
            "move keeping its ID is valid: the identity check compares " +
            "identities, not IDs (SPEC 6.5, 1.5)",
        );
        await assertNodeIdentities(
          product,
          workspace,
          [I6_A, `${I6_A}#a`, I6_B, `${I6_B}#b`, `${I6_B}#x`],
          "the kept-ID move relocated the node: same ID, new file part " +
            "(SPEC 6.5, 1.5)",
          "T6.5-6 post-move",
        );
        await assertJournalHoldsOneEntry(
          workspace,
          "T6.5-6 after the kept-ID move",
        );

        // Refused: the exact self-move — `<target-file>#<new-id>` equal to
        // `<file>#<id>` — exit 1, modifies nothing, appends no journal
        // entry (byte-compared around the attempt).
        const journalBefore = await readJournal(
          workspace,
          "T6.5-6 before the exact self-move attempt",
        );
        await expectRefusalModifiesNothing(
          product,
          workspace,
          ["move", "specs/B.mdx#x", "specs/B.mdx#x"],
          {
            // Reported alone — no collision reason beside it: the
            // after-removal check collides with nothing (SPEC 6.4, 14,
            // T14-7) — concerning the unchanged identity.
            finding: "refused-identity-unchanged",
            identity: { file: I6_B, id: "x" },
          },
          "T6.5-6 (the exact self-move — the new identity equals the old " +
            "one, SPEC 6.5)",
        );
        assertBytesEqual(
          await readJournal(
            workspace,
            "T6.5-6 after the exact self-move attempt",
          ),
          journalBefore,
          "T6.5-6: the journal byte-compared around the refused exact " +
            "self-move — the refusal appends no journal entry (SPEC 6.5, 6.1)",
        );

        // Refused: a same-file move whose <new-id> collides with an ID
        // remaining in the target file after the removal — `b` remains in
        // B.mdx when `x`'s subtree is removed (SPEC 6.5).
        await expectRefusalModifiesNothing(
          product,
          workspace,
          ["move", "specs/B.mdx#x", "specs/B.mdx#b"],
          {
            // The collision locates every colliding bearer (SPEC 14); the
            // remaining bearer `b` lives in B.mdx, whose bytes the earlier
            // successful move rewrote (product-written), so the arm asserts
            // the bearer's file without a byte window.
            finding: "refused-id-collision",
            locatedAt: { file: I6_B },
          },
          "T6.5-6 (same-file move whose <new-id> `b` collides with the ID " +
            "`b` remaining in the target file after the removal, SPEC 6.5)",
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T6.5-7 — operation-side rewrite bytes for the real move
// ---------------------------------------------------------------------------

// The fixture (TEST-SPEC T6.5-7): the origin imports the target module under
// two bindings (valid, SPEC 2.1 — multiple imports may bind one module under
// different names), one declaration alone on its line (`TWO`), the other
// (`TB`) following the retained, still-referenced third-module import
// (`Keep`, referenced by `org.stay` OUTSIDE the moved subtree) on a shared
// line. Every reference through the two bindings — the `d` chain
// `d={TWO.hub}` and the embedding `{text(TB.aux)}` — lies inside the moved
// subtree `org.mv`, which also holds the single-quoted local string
// reference `d={'org.mv.leaf'}` to a moved descendant and spells that
// descendant's `id` attribute single-quoted (`id='org.mv.leaf'`, SPEC 2.7:
// single- or double-quoted alike); no reference to a moved node lies
// outside the subtree, and no moved reference targets a node remaining in
// the origin — so the rewrite adds no import anywhere, the one direction
// free of implementation latitude (SPEC 6.5).
const B7_ORIGIN = "specs/Origin.mdx";
const B7_TARGET = "specs/Target.mdx";
const B7_KEEP = "specs/Keep.mdx";

const B7_ORIGIN_BEFORE = [
  'import TWO from "./Target.xspec"',
  'import Keep from "./Keep.xspec"; import TB from "./Target.xspec"',
  "",
  '<S id="org">',
  "Origin holder text.",
  "",
  '<S id="org.mv" d={TWO.hub}>',
  "Moved head text.",
  "",
  "{text(TB.aux)}",
  "",
  "<S id='org.mv.leaf'>",
  "Moved leaf text.",
  "</S>",
  "",
  "<S id=\"org.mv.use\" d={'org.mv.leaf'}>",
  "Moved user text.",
  "</S>",
  "</S>",
  "",
  '<S id="org.stay" d={Keep.keep}>',
  "Staying text.",
  "</S>",
  "</S>",
  "",
].join("\n");

const B7_TARGET_BEFORE = [
  '<S id="hub">',
  "Hub text.",
  "</S>",
  "",
  '<S id="aux">',
  "Aux text.",
  "</S>",
  "",
].join("\n");

const B7_KEEP_SOURCE = ['<S id="keep">', "Keep text.", "</S>", ""].join("\n");

// Expected origin bytes, composed from the rules of SPEC 6.5 and 3 — not
// from any product output:
// - The own-line `TWO` declaration's own characters are deleted in place;
//   its line, left empty purely by that deletion, is dropped with its
//   terminator (SPEC 6.5, 3) — a product leaving an emptied line behind
//   fails here.
// - On the shared line, the removed `TB` declaration's own characters ALONE
//   are deleted — the declaration spans `import TB from "./Target.xspec"`
//   exactly (no trailing `;` exists to reach) — so the retained `Keep`
//   import, its `;`, AND the separating U+0020 survive byte-for-byte: the
//   kept line ends `"./Keep.xspec"; ` with a trailing space before its
//   terminator (spelled as an explicit concatenation below so the byte is
//   loud). A product normalizing whitespace around a removed declaration
//   fails here.
// - The moved text — the `org.mv` construct's own characters, opening `<`
//   through the closing tag's `>` — is deleted in place; the merged line it
//   leaves holds only the closing tag's terminator and is dropped (SPEC
//   6.5, 3). Both surrounding blank lines were already blank in the source,
//   so both are kept: two adjacent blank lines remain (rule of 3 drops only
//   lines a removal blanked).
const B7_ORIGIN_AFTER = [
  'import Keep from "./Keep.xspec";' + " ",
  "",
  '<S id="org">',
  "Origin holder text.",
  "",
  "",
  '<S id="org.stay" d={Keep.keep}>',
  "Staying text.",
  "</S>",
  "</S>",
  "",
].join("\n");

// Expected target bytes, composed from the same rules:
// - Top-level `<new-id>` (`mv`): the moved text is inserted at the end of
//   the file, followed by U+000A; the existing final line is terminated, so
//   the insertion point sits at the start of a line and no preceding U+000A
//   is added (SPEC 6.5).
// - Re-identification by prefix replacement `org.mv` → `mv` rewrites the
//   three `id` attributes in place (SPEC 6.5).
// - The imported references convert to local form — their targets `hub` and
//   `aux` live in the target file — in 6.4's pinned spelling for converted
//   references: double-quoted string literals, `d={"hub"}` and
//   `{text("aux")}` (SPEC 6.5, 6.4). A product spelling a converted
//   reference single-quoted fails here.
// - The local reference stays local, re-identified by prefix replacement
//   with its single-quote spelling preserved: `d={'mv.leaf'}` (SPEC 6.4:
//   minimal in-place edits preserve quote style); the descendant's
//   single-quoted `id` attribute is re-identified the same way, its quotes
//   kept: `id='mv.leaf'` (SPEC 6.4 binds the `id`-attribute rewrite as it
//   binds references — the double-quoted fallback applies only where a form
//   cannot be kept, and `mv.leaf` holds no quote character). A product
//   re-emitting a rewritten `id` attribute double-quoted fails here.
const B7_TARGET_AFTER = [
  '<S id="hub">',
  "Hub text.",
  "</S>",
  "",
  '<S id="aux">',
  "Aux text.",
  "</S>",
  '<S id="mv" d={"hub"}>',
  "Moved head text.",
  "",
  '{text("aux")}',
  "",
  "<S id='mv.leaf'>",
  "Moved leaf text.",
  "</S>",
  "",
  "<S id=\"mv.use\" d={'mv.leaf'}>",
  "Moved user text.",
  "</S>",
  "</S>",
  "",
].join("\n");

// The code-source counterpart (TEST-SPEC T6.5-7), fully composed — no
// import is added, so no latitude: two `.ts` files of the configured code
// group, each importing the origin module, the target module, and the
// retained third module (SPEC 4: default bindings, `.xspec` specifiers
// resolved as 2.1), whose only references through the origin binding
// (`ORG`) are markers (SPEC 4.5) on nodes of the moved subtree — the moved
// root `org.mv` and its descendant `org.mv.leaf` — beside a marker through
// the target binding (`TGT.hub`) and one through the third (`Keep.keep`).
// The variants differ in the origin declaration's line alone: alone on its
// line (between the other two) in `src/own-line.ts`; following the third
// module's declaration on a shared line in `src/shared-line.ts`. As in the
// MDX fixture, the removed declaration carries no `;` — the declaration
// spans `import ORG from "../specs/Origin.xspec"` exactly, so its extent
// reaches no terminator character whose membership could be argued — while
// the retained declarations keep theirs (TypeScript's grammar admits both,
// a line break ending the `;`-less declaration).
const B7_TS_OWN = "src/own-line.ts";
const B7_TS_SHARED = "src/shared-line.ts";

const B7_TS_OWN_BEFORE = [
  'import TGT from "../specs/Target.xspec";',
  'import ORG from "../specs/Origin.xspec"',
  'import Keep from "../specs/Keep.xspec";',
  "",
  "export function ownLine(): void {",
  "  ORG.org.mv;",
  "  ORG.org.mv.leaf; // moved descendant",
  "  TGT.hub;",
  "  Keep.keep;",
  "}",
  "",
].join("\n");

const B7_TS_SHARED_BEFORE = [
  'import Keep from "../specs/Keep.xspec"; import ORG from "../specs/Origin.xspec"',
  'import TGT from "../specs/Target.xspec";',
  "",
  "export function sharedLine(): void {",
  "  ORG.org.mv;",
  "  ORG.org.mv.leaf; // moved descendant",
  "  TGT.hub;",
  "  Keep.keep;",
  "}",
  "",
].join("\n");

// Expected code bytes, composed from the rules of SPEC 6.4/6.5 and 3 — not
// from any product output:
// - The moved markers are rewritten through the EXISTING target binding
//   (SPEC 6.5: an import is added only where the file lacks the binding):
//   re-rooted at `TGT` with the prefix `org.mv` replaced by `mv`, dot access
//   kept (SPEC 6.4: minimal in-place edits preserve access form; every
//   segment is an identifier), so `ORG.org.mv` → `TGT.mv` and
//   `ORG.org.mv.leaf` → `TGT.mv.leaf`, each marker's `;`, indentation, and
//   trailing comment untouched.
// - The origin binding is left without references, so its declaration is
//   removed with 6.5's exact extent: in the own-line variant, the line left
//   empty purely by the deletion is dropped with its terminator (SPEC 6.5,
//   3); in the shared-line variant, the declaration's own characters ALONE
//   are deleted, so the retained `Keep` import, its `;`, AND the separating
//   U+0020 survive byte-for-byte — the kept line ends
//   `"../specs/Keep.xspec"; ` with a trailing space before its terminator
//   (an explicit concatenation below, so the byte is loud).
// - The `TGT.hub` and `Keep.keep` markers, the retained imports, and every
//   other byte are unchanged: a product reprinting the code file on removal
//   — re-indenting, dropping the comment, or normalizing `;` or whitespace
//   — fails here while passing every resolution-only assertion.
const B7_TS_OWN_AFTER = [
  'import TGT from "../specs/Target.xspec";',
  'import Keep from "../specs/Keep.xspec";',
  "",
  "export function ownLine(): void {",
  "  TGT.mv;",
  "  TGT.mv.leaf; // moved descendant",
  "  TGT.hub;",
  "  Keep.keep;",
  "}",
  "",
].join("\n");

const B7_TS_SHARED_AFTER = [
  'import Keep from "../specs/Keep.xspec";' + " ",
  'import TGT from "../specs/Target.xspec";',
  "",
  "export function sharedLine(): void {",
  "  TGT.mv;",
  "  TGT.mv.leaf; // moved descendant",
  "  TGT.hub;",
  "  Keep.keep;",
  "}",
  "",
].join("\n");

const B7_MOVE_ARGV = [
  "move",
  "specs/Origin.mdx#org.mv",
  "specs/Target.mdx#mv",
] as const;

const T6_5_7 = defineProductTest({
  id: "T6.5-7",
  title:
    "operation-side rewrite bytes for the real move: import-edit extents and reference-conversion spellings byte-asserted against independently composed expected files, staged so no import is added (the one rewrite direction free of implementation latitude) — the own-line target-module import's line dropped with its terminator, the shared-line declaration's own characters alone deleted with the retained third-module import kept byte-for-byte on its kept line, the moved references converted to local form as double-quoted string literals, the single-quoted local reference and the single-quoted descendant `id` attribute each re-identified by prefix replacement with their quote spellings preserved; and the code-source counterpart — two `.ts` files whose origin-module import, its binding referenced only by markers on moved nodes, is removed with the same exact extent (own-line and shared-line variants) while the moved markers are rewritten through the existing target binding, each file byte-equal to its composed expectation (SPEC 6.5, 6.4, 3, 2.1, 2.7, 4.5; H-4, normalizing nothing)",
  run: async (product) => {
    await withWorkspace(
      SPEC_AND_CODE_CONFIG,
      {
        [B7_ORIGIN]: B7_ORIGIN_BEFORE,
        [B7_TARGET]: B7_TARGET_BEFORE,
        [B7_KEEP]: B7_KEEP_SOURCE,
        [B7_TS_OWN]: B7_TS_OWN_BEFORE,
        [B7_TS_SHARED]: B7_TS_SHARED_BEFORE,
      },
      async (workspace) => {
        // Premise: the staging is valid — most acutely, the shared lines'
        // two import declarations parse as two bindings in MDX (SPEC 2.1)
        // and in TypeScript (SPEC 4) alike, and every marker resolves (SPEC
        // 4.5) — so a later failure is the move's, not the staging's.
        await buildOk(product, workspace, "T6.5-7 `build` over the staging");

        await expectExit(
          product,
          workspace,
          [...B7_MOVE_ARGV],
          0,
          "T6.5-7 `move specs/Origin.mdx#org.mv specs/Target.mdx#mv`",
        );

        await assertFileBytes(
          workspace.path(B7_ORIGIN),
          B7_ORIGIN_AFTER,
          "T6.5-7: the origin after the move — both target-module imports " +
            "left unreferenced are removed with 6.5's exact extent: the " +
            "own-line declaration's line dropped with its terminator, the " +
            "shared-line declaration's own characters alone deleted, the " +
            "retained import (its `;` and the separating space included) " +
            "kept byte-for-byte on its kept line (SPEC 6.5, 2.1, 3; H-4, " +
            "normalizing nothing)",
        );
        await assertFileBytes(
          workspace.path(B7_TARGET),
          B7_TARGET_AFTER,
          "T6.5-7: the target after the move — the moved references " +
            "convert to local form as double-quoted string literals " +
            '(`d={"hub"}`, `{text("aux")}`), the local reference is ' +
            "re-identified by prefix replacement with its single-quote " +
            "spelling preserved (`d={'mv.leaf'}`), and the insertion adds " +
            "exactly the rewritten moved text plus U+000A at end of file " +
            "(SPEC 6.5, 6.4; H-4, normalizing nothing)",
        );
        await assertFileBytes(
          workspace.path(B7_KEEP),
          B7_KEEP_SOURCE,
          "T6.5-7: the retained third module's own file is an uninvolved " +
            "bystander — beyond the stated edits, the identity and " +
            "reference rewrites, and the finishing regeneration, a move " +
            "changes no bytes (SPEC 6.5)",
        );

        // The code-source counterpart: the import-removal rule binds code
        // sources as it binds MDX, and the moved markers are rewritten
        // through the binding the file already has.
        await assertFileBytes(
          workspace.path(B7_TS_OWN),
          B7_TS_OWN_AFTER,
          "T6.5-7: the own-line code variant after the move — the " +
            "origin-module import, its binding left without references, " +
            "is removed with 6.5's exact extent (its line dropped with its " +
            "terminator), the moved markers are rewritten through the " +
            "existing target binding (`TGT.mv`, `TGT.mv.leaf`; no import " +
            "added), and every other byte — the retained imports, the " +
            "`TGT.hub` and `Keep.keep` markers, indentation, `;`, and the " +
            "trailing comment — is unchanged (SPEC 6.5, 6.4, 4.5, 3; H-4, " +
            "normalizing nothing: a product reprinting the code file on " +
            "removal fails here)",
        );
        await assertFileBytes(
          workspace.path(B7_TS_SHARED),
          B7_TS_SHARED_AFTER,
          "T6.5-7: the shared-line code variant after the move — the " +
            "origin-module declaration's own characters alone are deleted " +
            "from the line it shares with the retained third-module " +
            "import, which is kept byte-for-byte (its `;` and the " +
            "separating space included) on its kept line, the moved " +
            "markers are rewritten through the existing target binding, " +
            "and every other byte is unchanged (SPEC 6.5, 6.4, 4.5, 3; " +
            "H-4, normalizing nothing)",
        );

        // Soundness guard on the composed expectation itself: everything
        // resolves after the move — if the product's bytes matched the
        // expected bytes yet a reference or import failed to resolve, the
        // COMPOSITION was defective, and it must fail loud rather than
        // certify a broken rewrite (SPEC 6.5, 12.2).
        await expectExit(
          product,
          workspace,
          ["check"],
          0,
          "T6.5-7 `check` immediately after the move — every converted, " +
            "re-identified, and re-rooted reference (MDX references and " +
            "TS markers alike) resolves and no staleness remains " +
            "(SPEC 6.5, 12.2, 14.10)",
        );
      },
    );
  },
});

/** TEST-SPEC §6.5, in canonical ID order (SUITE-25). */
export const section65Tests: readonly ProductTestEntry[] = [
  T6_5_1,
  T6_5_2,
  T6_5_3,
  T6_5_4,
  T6_5_5,
  T6_5_6,
  T6_5_7,
];
