// Shared staging/assertion sugar for the section registration modules in
// this directory (the product-facing suite, TEST-SPEC sections 1–16). Thin
// composition of already-self-tested harness machinery — the subprocess
// driver (S-3), the assertion protocol (H-4/H-5), and the H-3 adapters — so
// every section module stages and asserts the same way: bodies receive a
// `ProductBinding` and nothing else (C-2), run commands in their own
// workspace root (H-1/H-2), assert exact exit codes (H-5), and reject a
// product only via diagnosed assertion failures (H-8).

import { Buffer } from "node:buffer";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import type {
  AppliedMappingPair,
  Finding,
  FindingLocation,
  GraphEdge,
} from "../../helpers/adapters/index.js";
import {
  decodeErrorDocument,
  decodeFindingsReport,
  renderPathValue,
} from "../../helpers/adapters/index.js";
import {
  assertBytesEqual,
  assertExitCode,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { assertLeavesUnchanged } from "../../helpers/snapshot.js";
import type {
  ArgvValue,
  ProductBinding,
  RunResult,
} from "../../helpers/subprocess.js";
import { runProduct, summarizeResult } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";

/**
 * U+FFFD (REPLACEMENT CHARACTER), built from its code point so no tool layer
 * can decode or normalize the spelling on the way into this file.
 */
export const REPLACEMENT_CHARACTER = String.fromCodePoint(0xfffd);

/**
 * The U+FFFD-pathed spec source T1.5-2 and T11.5-3 both stage — TEST-SPEC's
 * `specs/A\uFFFD.mdx`, one spelling shared so the two tests stage the same
 * file. Stageable on every platform: the path is valid UTF-8 (U+FFFD encodes
 * as EF BF BD, a name any filesystem holds), unlike the non-UTF-8 byte paths
 * of the Linux leg. It is an invalid source path (SPEC 14.19) presented in
 * its plain string form — never the marked byte form (12.0) — that no
 * argument value names: a value containing U+FFFD is a malformed value, a
 * usage error of the syntax class (12.0).
 */
export const REPLACEMENT_CHARACTER_SPEC_PATH = `specs/A${REPLACEMENT_CHARACTER}.mdx`;

/**
 * Stage plain files OUTSIDE the workspace root, at paths relative to the
 * root's parent — the workspace's own temporary directory (`tempRoot`, whose
 * `work/` is the root), disposed with it. For arms whose subject is what a
 * product must never reach: an import specifier whose ascent passes above
 * the root designates nothing whatever the root's parent holds (SPEC 2.1,
 * 4), so a real file there discriminates lexical resolution from a
 * filesystem lookup.
 */
export async function stageBesideRoot(
  workspace: TestWorkspace,
  files: Readonly<Record<string, string>>,
): Promise<void> {
  for (const [rel, contents] of Object.entries(files)) {
    const abs = path.join(workspace.tempRoot, rel);
    await fsp.mkdir(path.dirname(abs), { recursive: true });
    await fsp.writeFile(abs, contents);
  }
}

/** Run one product command with the workspace root as working directory. */
export async function runCli(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly ArgvValue[],
): Promise<RunResult> {
  return await runProduct(product, { cwd: workspace.root, argv });
}

/** Run a command and assert its exact exit code (H-5). */
export async function expectExit(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly ArgvValue[],
  exitCode: number,
  context: string,
): Promise<RunResult> {
  const result = await runCli(product, workspace, argv);
  assertExitCode(result, exitCode, context);
  return result;
}

/** `xspec build` over the staged workspace must succeed (exit 0). */
export async function buildOk(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
): Promise<RunResult> {
  return await expectExit(product, workspace, ["build"], 0, context);
}

/**
 * Run a command expecting exit 0 and exactly one JSON document as the entire
 * stdout (H-5; SPEC.md 12.0), returned parsed for adapter decoding.
 */
export async function runJson(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  context: string,
): Promise<unknown> {
  const result = await expectExit(product, workspace, argv, 0, context);
  return parseJsonStdout(result, context);
}

/**
 * Decode an exit-2 run's stdout as the single 12.7 error document —
 * `{"error": …}` exactly, one finding form — and return the finding (SPEC
 * 12.0: with JSON output in effect, a usage or configuration error emits the
 * error document as the entire stdout; H-5). Callers assert the exit code
 * first (`expectExit`) and pass runs with JSON output in effect: `--json`
 * among the arguments, or a JSON-only surface (10.7 export, 11, 12.6). The
 * decode is form-exact (H-3); value assertions on `code`/`path` stay with
 * the caller (T12.7-3 pins them fully).
 */
export function expectErrorDocument(
  result: RunResult,
  context: string,
): Finding {
  return decodeErrorDocument(
    parseJsonStdout(
      result,
      `${context} — with JSON output in effect, an exit-2 invocation emits ` +
        `the 12.7 error document as its entire stdout (SPEC 12.0, H-5)`,
    ),
    context,
  ).error;
}

/**
 * Run a command with `--json` and assert the SPEC.md 14.14 configuration-error
 * contract: exit 2 exactly (a usage error, 12.0); stdout exactly the single
 * 12.7 error document `{"error": …}` (12.0/12.7, H-5), its finding carrying
 * the stable code `configuration-error` and a non-`null` concerned path (14
 * defines both for configuration errors; the exact anchoring-form spelling is
 * T12.7-3's assertion); and an actionable standard-error message identifying
 * the configuration as the failing subject — any phrasing naming either the
 * file (`xspec.config.ts`) or the condition ("configuration", "config…")
 * qualifies, so the operationalization is /config/i; wording is otherwise
 * free (H-3).
 */
export async function expectConfigurationError(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  context: string,
  cwd?: string,
): Promise<RunResult> {
  const result = await runProduct(product, {
    cwd: cwd ?? workspace.root,
    argv: [...argv, "--json"],
  });
  assertExitCode(
    result,
    2,
    `${context} — a missing or invalid configuration is a configuration ` +
      `error, reported by every command at configuration load as a usage ` +
      `error (SPEC 14.14, 12.0)`,
  );
  const error = expectErrorDocument(result, context);
  if (error.code !== "configuration-error") {
    fail(
      `${context}: the error document's finding must carry the stable code ` +
        `"configuration-error" (SPEC 14 condition 14, 12.7); got ` +
        `${JSON.stringify(error.code)} (message: ${JSON.stringify(error.message)})`,
    );
  }
  if (error.path === null) {
    fail(
      `${context}: a configuration error's finding carries its concerned ` +
        `path — the configuration file, or "." for a failed upward search — ` +
        `in the anchoring form (SPEC 14, 12.7); got null`,
    );
  }
  if (!/config/i.test(result.stderr)) {
    fail(
      `${context}: the configuration-error message on stderr must identify ` +
        `the configuration as the failing subject (SPEC 14.14; 12.0: ` +
        `configuration error messages are standard-error content) — any ` +
        `phrasing naming xspec.config.ts or "configuration" qualifies ` +
        `(H-3); got ${summarizeResult(result)}`,
    );
  }
  return result;
}

/**
 * Run a findings-report surface — `build --json`, `check --json`, a gated
 * read or refused operation with `--json` — asserting the exact exit code
 * (H-5) with exactly one JSON document as the entire stdout (SPEC.md 12.0),
 * decoded form-exact as the findings-only report `{"findings": […]}`
 * (SPEC.md 12.7; H-3): the one member, the literal finding form, the pinned
 * order. Returns the decoded findings.
 */
export async function runFindingsReport(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  exitCode: number,
  context: string,
): Promise<readonly Finding[]> {
  const result = await expectExit(product, workspace, argv, exitCode, context);
  return decodeFindingsReport(parseJsonStdout(result, context), context)
    .findings;
}

/**
 * Run `build --json` over a workspace staged with validation errors: assert
 * exit 1 (findings are exit-1 outcomes, SPEC.md 12.0; H-5) with exactly one
 * JSON document as the entire stdout, decoded as the findings report (H-3).
 */
export async function buildFindings(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
): Promise<readonly Finding[]> {
  return await runFindingsReport(
    product,
    workspace,
    ["build", "--json"],
    1,
    context,
  );
}

/**
 * Run a findings-report surface on a workspace expected to be finding-free —
 * a successful `build --json`, or `check --json` on a clean, freshly built
 * workspace — asserting exit 0 (SPEC.md 12.0: success; a report carrying
 * any finding exits 1) and exactly `{"findings": []}` as the entire stdout:
 * the findings-only form with the empty array — its one member and nothing
 * beside it (SPEC.md 12.7: a finding-free `findings` is `[]`, never `null`,
 * never omitted). "Exactly" is the form (H-3): the document's member set
 * and the array's emptiness, asserted through the form-exact decode —
 * SPEC.md 12.0/12.7 pin no byte layout for the serialization, so none is
 * compared.
 */
export async function expectFindingFreeReport(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  context: string,
): Promise<void> {
  const findings = await runFindingsReport(
    product,
    workspace,
    argv,
    0,
    `${context} — a finding-free report exits 0 (SPEC 12.0)`,
  );
  assertSameJson(
    findings,
    [],
    `${context} — the report is exactly {"findings": []}: the findings-only ` +
      `form's one member holding the empty array, never null (SPEC 12.7)`,
  );
}

/**
 * Read a product-generated TypeScript module as UTF-8 text, failing diagnosed
 * (H-8) when the module is missing, not a plain file, or not valid UTF-8
 * (SPEC.md 13.1: `NAME.mdx` generates `NAME.xspec.ts` in the source file's
 * directory).
 */
export async function readGeneratedModule(
  workspace: TestWorkspace,
  rel: string,
  context: string,
): Promise<string> {
  const kind = await workspace.kind(rel);
  if (kind !== "file") {
    fail(
      `${context}: expected the generated module as a plain file at ${rel} ` +
        `(SPEC 13.1: NAME.mdx generates NAME.xspec.ts in the source file's ` +
        `directory); found ${kind}`,
    );
  }
  const bytes = await workspace.readBytes(rel);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail(`${context}: the generated module at ${rel} is not valid UTF-8`);
  }
}

/**
 * Assert the exact multiset of SPEC.md 14 condition identities present in a
 * findings report (`{"14.2": 1, ...}`): every condition staged in the fixture
 * is reported — none masked away, none phantom, none double-reported (§14:
 * when several error conditions are present, each is reported). Counting keys
 * are the derived `14.N` identities of numbered-condition code tokens
 * (model.ts: the harness-pinned token table); a refusal finding counts under
 * its refusal code, and a code-less finding under `"(code-less)"`.
 */
export function assertConditionCounts(
  findings: readonly Finding[],
  expected: Readonly<Record<string, number>>,
  context: string,
): void {
  const counts: Record<string, number> = {};
  for (const finding of findings) {
    const key = finding.condition ?? finding.code ?? "(code-less)";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const render = (record: Readonly<Record<string, number>>): string[] =>
    Object.entries(record)
      .map(([condition, count]) => `${condition} x${String(count)}`)
      .sort();
  assertSameJson(
    render(counts),
    render(expected),
    `${context}: reported condition identities (SPEC.md 14)`,
  );
}

/**
 * A condition's findings in (file, range start) order — for a test staging
 * one condition more than once in a single `build --json` sweep (T14-2,
 * T2.4-5), where an exactly-one selection does not apply (the count is
 * `assertConditionCounts`'s). A finding without a location sorts first;
 * `assertFindingLocated` then rejects it.
 */
export function findingsInSourceOrder(
  findings: readonly Finding[],
  condition: string,
): Finding[] {
  const key = (finding: Finding): readonly [string, number] => {
    const first = finding.locations[0];
    if (first === undefined) return ["", -1];
    return [
      typeof first.file === "string" ? first.file : first.file.bytes,
      first.range.start,
    ];
  };
  return findings
    .filter((finding) => finding.condition === condition)
    .slice()
    .sort((a, b) => {
      const [fileA, startA] = key(a);
      const [fileB, startB] = key(b);
      if (fileA !== fileB) return fileA < fileB ? -1 : 1;
      return startA - startB;
    });
}

/**
 * A staged construct's byte window within a `prefix + construct + suffix`
 * fixture whose parts are known exactly: the construct's own byte range,
 * end-widened by one byte so a product reporting a line-granular location
 * (last construct line plus its terminator) still passes. Fixtures keep every
 * other staged construct outside the widened window, so a finding attributed
 * to the wrong construct fails.
 */
export function byteWindow(
  prefix: string,
  construct: string,
): { start: number; end: number } {
  const start = Buffer.byteLength(prefix, "utf8");
  return { start, end: start + Buffer.byteLength(construct, "utf8") + 1 };
}

/** What a finding must identify about its source (SPEC.md 14 preamble). */
export interface FindingSourceExpectation {
  /** The workspace-relative, `/`-separated source file (SPEC.md 1.5, 14). */
  readonly file: string;
  /**
   * Byte window the finding's location ranges must fall within — as computed
   * by the caller from its fixture's exact bytes (typically the offending
   * construct's own range, end-widened where the caller tolerates a
   * line-granular location).
   */
  readonly window?: { readonly start: number; readonly end: number };
}

/**
 * Assert a finding locates its offending construct(s): at least one
 * `locations` entry (SPEC.md 14: every condition that locates in source
 * carries the containing file and a range; 12.7), every entry naming the
 * expected workspace-relative file, and — when a window is given — every
 * range falling within the offending construct's byte window.
 */
export function assertFindingLocated(
  finding: Finding,
  expected: FindingSourceExpectation,
  context: string,
): void {
  if (finding.locations.length === 0) {
    fail(
      `${context}: the finding must carry a location (SPEC.md 14: errors identify ` +
        `the file, location, and correction; 12.7 locations); got none (message: ` +
        `${JSON.stringify(finding.message)})`,
    );
  }
  for (const location of finding.locations) {
    if (location.file !== expected.file) {
      fail(
        `${context}: the finding must locate in the workspace-relative source ` +
          `file (SPEC.md 14, 1.5, 12.7); expected ${JSON.stringify(expected.file)}, ` +
          `got ${JSON.stringify(location.file)} (message: ${JSON.stringify(finding.message)})`,
      );
    }
    const { window } = expected;
    if (
      window !== undefined &&
      (location.range.start < window.start || location.range.end > window.end)
    ) {
      fail(
        `${context}: the finding's location [${String(location.range.start)}, ` +
          `${String(location.range.end)}) must fall within the offending construct's ` +
          `byte window [${String(window.start)}, ${String(window.end)}] (message: ` +
          `${JSON.stringify(finding.message)})`,
      );
    }
  }
}

/**
 * Assert a finding's locations include the expected file — and, when a window
 * is given, a range within it (SPEC.md 14's location-cardinality rule: a
 * located concern such as a colliding bearer or a cycle-participating
 * reference spelling renders as a `locations` entry in its containing file).
 * SOME-quantified, unlike `assertFindingLocated`: the finding may locate
 * further participants elsewhere — every-participant cardinality is T14-8's
 * business.
 */
export function assertFindingMentionsLocation(
  finding: Finding,
  expected: FindingSourceExpectation,
  context: string,
): void {
  const matches = (location: FindingLocation): boolean => {
    if (location.file !== expected.file) return false;
    const { window } = expected;
    return (
      window === undefined ||
      (location.range.start >= window.start && location.range.end <= window.end)
    );
  };
  if (finding.locations.some(matches)) return;
  const rendered = finding.locations.map(
    (location) =>
      `${renderPathValue(location.file)} [${String(location.range.start)}, ` +
      `${String(location.range.end)})`,
  );
  fail(
    `${context}: the finding must locate the concerned construct in ` +
      `${JSON.stringify(expected.file)}` +
      (expected.window === undefined
        ? ""
        : ` within the byte window [${String(expected.window.start)}, ` +
          `${String(expected.window.end)}]`) +
      ` (SPEC.md 14, 12.7); got locations [${rendered.join("; ")}] ` +
      `(message: ${JSON.stringify(finding.message)})`,
  );
}

/**
 * One expected bearer of a jointly located concern whose bearers may nest —
 * a colliding section and its colliding child (SPEC.md 14, 6.4): its
 * containing file, its whole construct's byte window (the module-header
 * window convention: any in-construct precision passes), and, for a bearer
 * whose construct encloses another expected bearer's, `startBefore` — the
 * byte offset where the first enclosed construct begins, an exclusive bound
 * the location's start must fall before. An enclosed bearer's construct
 * lies within its parent's window, so windows alone cannot tell "the parent
 * and the child" from "the child twice"; the bound attributes each location
 * to one bearer at whatever precision the product locates — the opening
 * tag, the `id` attribute, and the whole construct all start inside the
 * parent's own leading bytes, before any enclosed construct.
 */
export interface BearerLocationExpectation {
  /** The workspace-relative, `/`-separated source file (SPEC.md 1.5, 14). */
  readonly file: string;
  /** The bearer's whole construct as a byte window (`byteWindow`). */
  readonly window: { readonly start: number; readonly end: number };
  /** Exclusive bound on the location's start: where an enclosed bearer begins. */
  readonly startBefore?: number;
}

/**
 * Assert a finding locates EVERY expected bearer and nothing else (SPEC.md
 * 14's location-cardinality rule — a condition several constructs jointly
 * violate is one finding carrying a location for every participating
 * construct, no representative chosen; the every-participant strictness,
 * with none of `assertFindingMentionsLocation`'s SOME-quantified
 * tolerance): exactly one location per bearer, index-wise in 12.7's
 * within-finding order (file bytes, then start, then end — an enclosing
 * bearer precedes the bearers it encloses at any precision), each in its
 * bearer's file within the bearer's byte window and, where a `startBefore`
 * bound is declared, starting before it; and, locating in source, the
 * finding concerns no path (12.7: `path` null for located conditions).
 */
export function assertFindingLocatesExactly(
  finding: Finding,
  bearers: readonly BearerLocationExpectation[],
  context: string,
): void {
  const rendered = (): string =>
    finding.locations
      .map(
        (location) =>
          `${renderPathValue(location.file)} [${String(location.range.start)}, ` +
          `${String(location.range.end)})`,
      )
      .join("; ");
  if (finding.locations.length !== bearers.length) {
    fail(
      `${context}: one finding carries a location for every participating ` +
        `bearer and none beside — expected exactly ${String(bearers.length)} ` +
        `location(s), got ${String(finding.locations.length)} ` +
        `[${rendered()}] (SPEC.md 14, 12.7; message: ` +
        `${JSON.stringify(finding.message)})`,
    );
  }
  bearers.forEach((bearer, index) => {
    const location = finding.locations[index]!;
    const inFile = location.file === bearer.file;
    const inWindow =
      location.range.start >= bearer.window.start &&
      location.range.end <= bearer.window.end;
    const attributable =
      bearer.startBefore === undefined ||
      location.range.start < bearer.startBefore;
    if (!inFile || !inWindow || !attributable) {
      fail(
        `${context}: location #${String(index + 1)} must locate bearer ` +
          `#${String(index + 1)} — in ${JSON.stringify(bearer.file)} within ` +
          `its byte window [${String(bearer.window.start)}, ` +
          `${String(bearer.window.end)}]` +
          (bearer.startBefore === undefined
            ? ""
            : `, starting before byte ${String(bearer.startBefore)} (the ` +
              `bearer's own leading bytes: an enclosed bearer's location ` +
              `is never this one's)`) +
          ` — in 12.7's within-finding order (file bytes, then start, then ` +
          `end); got ${renderPathValue(location.file)} ` +
          `[${String(location.range.start)}, ${String(location.range.end)}) ` +
          `among [${rendered()}] (SPEC.md 14, 12.7; message: ` +
          `${JSON.stringify(finding.message)})`,
      );
    }
  });
  if (finding.path !== null) {
    fail(
      `${context}: a finding locating in source concerns no path — ` +
        `\`path\` is null for located conditions (SPEC.md 12.7, 14); got ` +
        `${renderPathValue(finding.path)} (message: ` +
        `${JSON.stringify(finding.message)})`,
    );
  }
}

/**
 * The refusal reasons whose `identities` content SPEC.md 14 pins: a reason
 * concerning an identity — `refused-invalid-id`, `refused-identity-unchanged`,
 * `refused-structural-parent`, `refused-missing-target-parent` — carries it
 * as the sole element, in 1.5's form over the operation's destination file
 * (`<file>#id` for a rename, `<target-file>#id` for a section move, the bare
 * `<new-file>` for a file move), whether or not the ID is valid;
 * `refused-id-collision` carries the located bearers' identities in location
 * order; `refused-invalid-rewrite` carries the workspace-relative paths of
 * the files concerned — each a spec source's root identity or a code
 * source's whole-file identity, a created target file's spelled whatever
 * its path's validity — in byte order; `refused-moved-import` carries
 * none (its `identities` empty). For every other reason —
 * `refused-cycle` and the path-concerning
 * `refused-destination-exists` and `refused-invalid-destination` — 12.7
 * leaves the member informational, its composition unpinned, so no consumer
 * asserts it (H-4).
 */
export const IDENTITY_PINNED_REFUSAL_CODES: ReadonlySet<string> = new Set([
  "refused-invalid-id",
  "refused-identity-unchanged",
  "refused-id-collision",
  "refused-structural-parent",
  "refused-missing-target-parent",
  "refused-invalid-rewrite",
  "refused-moved-import",
]);

/**
 * Assert a finding's `identities` is exactly the expected ordered array
 * (SPEC.md 12.7: the member's content is contractual exactly where 14 states
 * it — a refusal reason's concerned identity as the sole element, the
 * collision's located bearers in location order, 14.11's foreign module,
 * 14.12's enumeration): the same entries in the same order, none beside — a
 * bare ID in place of the 1.5 identity, a further informational entry, or a
 * differently ordered bearer list fails (T6.4-3, T6.5-4, T14-7).
 */
export function assertFindingIdentities(
  finding: Finding,
  expected: readonly string[],
  context: string,
): void {
  const actual = finding.identities;
  const equal =
    actual.length === expected.length &&
    expected.every((entry, index) => actual[index] === entry);
  if (!equal) {
    fail(
      `${context}: the finding's \`identities\` must be exactly ` +
        `${JSON.stringify(expected)} — the same entries in the same order, ` +
        `none beside (SPEC.md 14, 12.7); got ${JSON.stringify(actual)} ` +
        `(message: ${JSON.stringify(finding.message)})`,
    );
  }
}

/**
 * Assert a refusal finding's `identities` per SPEC.md 14's pin for its
 * reason: a case states the exact array for every reason in
 * IDENTITY_PINNED_REFUSAL_CODES and states none for a refusal reason whose
 * composition 12.7 leaves unpinned — either slip is a harness defect (a
 * plain error, never `fail`: H-8's taxonomy), so no identity-concerning
 * refusal is under-asserted and no unpinned one over-asserted. A numbered
 * condition (the invalid-workspace refusal's findings) is asserted exactly
 * when the case states an array.
 */
export function assertRefusalIdentities(
  finding: Finding,
  code: string,
  expected: readonly string[] | undefined,
  context: string,
): void {
  const pinned = IDENTITY_PINNED_REFUSAL_CODES.has(code);
  if (expected === undefined) {
    if (pinned) {
      throw new Error(
        `harness defect: ${context} — SPEC.md 14 pins the \`identities\` of ` +
          `${JSON.stringify(code)} (its concerned identity as the sole ` +
          `element; the located bearers for refused-id-collision; the ` +
          `concerned files' paths in byte order for refused-invalid-rewrite; ` +
          `none for refused-moved-import), so the case must state the exact ` +
          `array`,
      );
    }
    return;
  }
  if (!pinned && code.startsWith("refused-")) {
    throw new Error(
      `harness defect: ${context} — SPEC.md 12.7 leaves the \`identities\` ` +
        `of ${JSON.stringify(code)} informational (composition unpinned), ` +
        `so the case must not state one`,
    );
  }
  assertFindingIdentities(finding, expected, context);
}

/**
 * Assert a finding concerns exactly the expected workspace-relative path via
 * its 12.7 `path` member (SPEC.md 14: conditions and refusal reasons without
 * an in-source location carry the file or path they concern).
 */
export function assertFindingConcernsPath(
  finding: Finding,
  expected: string,
  context: string,
): void {
  if (finding.path === expected) return;
  fail(
    `${context}: the finding must carry the concerned path ` +
      `${JSON.stringify(expected)} as its 12.7 path member (SPEC.md 14); ` +
      `got ${renderPathValue(finding.path)} (message: ` +
      `${JSON.stringify(finding.message)})`,
  );
}

function renderJson(value: unknown): string {
  return value === undefined ? "undefined" : JSON.stringify(value);
}

/**
 * Diagnosed deep equality over JSON-safe values (arrays are order-sensitive;
 * callers sort first where SPEC.md fixes no order).
 */
export function assertSameJson(
  actual: unknown,
  expected: unknown,
  context: string,
): void {
  const actualRendered = renderJson(actual);
  const expectedRendered = renderJson(expected);
  if (actualRendered === expectedRendered) return;
  fail(
    `${context}: values differ\n` +
      `  actual:   ${actualRendered}\n` +
      `  expected: ${expectedRendered}`,
  );
}

/**
 * The identities of reported rows/entries, sorted bytewise — for comparisons
 * where SPEC.md fixes membership but no particular order.
 */
export function sortedIdentities(
  rows: readonly { readonly identity: string }[],
): string[] {
  return rows.map((row) => row.identity).sort();
}

/**
 * Order-insensitive graph-edge set comparison (SPEC.md 5.2: edges of each
 * kind form a set), diagnosed with a readable rendering of both sides.
 */
export function assertEdgeSetEqual(
  actual: readonly GraphEdge[],
  expected: readonly GraphEdge[],
  context: string,
): void {
  const render = (edges: readonly GraphEdge[]): string[] =>
    edges.map((edge) => `${edge.kind}: ${edge.from} -> ${edge.to}`).sort();
  assertSameJson(render(actual), render(expected), context);
}

/**
 * Assert a successful `rename`/`move`'s applied mapping is exactly the
 * expected ordered array of identity pairs — every identity pair the
 * operation journaled, no more, in the pinned order (SPEC.md 6.4, 6.5: the
 * complete identity mapping, the preview's `mapping`, 6.6; 12.7: one
 * `{"from", "to"}` per mapped identity ordered by `from` bytes; T6.4-1,
 * T6.5-1). The performed document is a form-exact 12.7 surface (H-3), so the
 * comparison is order-sensitive: a product emitting the right pairs in
 * another order fails, as does a duplicated or extra pair. Callers list the
 * expected pairs in `from`-byte order.
 */
export function assertAppliedMapping(
  actual: readonly AppliedMappingPair[],
  expected: readonly AppliedMappingPair[],
  context: string,
): void {
  assertSameJson(actual, expected, context);
}

// ---------------------------------------------------------------------------
// `--file` pattern spellings (SPEC 7, 11.1, 11.3, 11.4, 12.3, 12.0)
// ---------------------------------------------------------------------------

/** One `--file` spelling with the reason SPEC 7's depth rule classes it. */
export interface FilePatternSpelling {
  readonly spelling: string;
  readonly why: string;
}

/**
 * `--file` patterns outside the workspace root by spelling alone — decided
 * as SPEC 7 decides a configured glob (T7-4): reading the `/`-separated
 * segments from a depth of zero, a `..` segment lowers the depth, a `.`,
 * empty, or `**` segment leaves it, every other segment raises it; a glob
 * beginning with `/`, or whose depth ever falls below zero, is outside.
 * Each is an invalid flag value on every `--file` surface (11.1, 11.3,
 * 11.4, 12.3): a plain usage error, exit 2, whatever the workspace or the
 * root's parent holds — callers stage {@link BESIDE_ROOT_FILE_PATTERN_DECOY}
 * so the ascending spellings, resolved, name a real file, and exit 2 never
 * comes from a side reason (T7-4's discipline); the absolute spelling's
 * premise is the spelling alone.
 */
export const OUTSIDE_ROOT_FILE_PATTERNS: readonly FilePatternSpelling[] = [
  {
    spelling: "../x/*.mdx",
    why: "the plain ascent: the depth falls below zero at the first segment",
  },
  {
    spelling: "../x",
    why: "the plain ascent naming a directory, no wildcard segment",
  },
  {
    spelling: "a/../../x",
    why:
      "an embedded ascent: `a` raises the depth to one, the two `..` " +
      "segments take it to minus one",
  },
  { spelling: "/specs/*.mdx", why: "a leading `/`" },
];

/**
 * The file the ascending spellings of {@link OUTSIDE_ROOT_FILE_PATTERNS}
 * name when resolved against the root's parent (`stageBesideRoot`): a
 * product deciding by what it finds rather than by spelling finds it.
 */
export const BESIDE_ROOT_FILE_PATTERN_DECOY: Readonly<Record<string, string>> =
  { "x/M.mdx": '<S id="m">\nM text.\n</S>\n' };

/**
 * Inside-root `--file` spellings over `dir` that match nothing (SPEC 7,
 * 12.0): a `.` segment and an empty segment (a doubled `/`) leave the depth
 * unchanged — the pattern is inside the root — and match no discovered
 * path, which carries no such segment. Each admits the empty set on every
 * `--file` surface: exit 0 with the surface's empty answer form. Sharp only
 * where `dir` holds a discovered `.mdx` at its top level — the file a
 * product normalizing the spelling (`./specs/*.mdx` → `specs/*.mdx`)
 * would match.
 */
export function insideNoMatchFilePatterns(
  dir: string,
): readonly FilePatternSpelling[] {
  return [
    { spelling: `./${dir}/*.mdx`, why: "a `.` segment matches nothing" },
    {
      spelling: `${dir}//*.mdx`,
      why: "an empty segment (a doubled `/`) matches nothing",
    },
  ];
}

/** TEST-SPEC's pinned inside spellings: `./specs/*.mdx`, `specs//*.mdx`. */
export const INSIDE_NO_MATCH_FILE_PATTERNS: readonly FilePatternSpelling[] =
  insideNoMatchFilePatterns("specs");

/**
 * One `--file` spelling outside the root: the invocation (`--file` and its
 * value in place; `--json` where the surface takes it, T12.3-1 and T11-2,
 * omitted on the JSON-only surfaces of 11.3 and 11.4) exits 2 exactly with
 * the 12.7 error document as its entire stdout — a plain usage error's
 * finding, `code` null, `path` null, `locations` [] (SPEC 12.7) — and a
 * message on standard error (12.0).
 */
export async function expectFilePatternUsageError(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  context: string,
): Promise<void> {
  const result = await expectExit(
    product,
    workspace,
    argv,
    2,
    `${context} — a \`--file\` pattern outside the workspace root by its ` +
      `spelling alone is an invalid flag value, a usage error, exit 2 ` +
      `(SPEC 7, 11.1, 11.3, 11.4, 12.3, 12.0)`,
  );
  const finding = expectErrorDocument(result, context);
  assertSameJson(
    { code: finding.code, path: finding.path, locations: finding.locations },
    { code: null, path: null, locations: [] },
    `${context}: a plain usage error's error document carries \`code\` ` +
      `null, \`path\` null, and no locations (SPEC 12.7)`,
  );
  if (result.stderrBytes.length === 0) {
    fail(
      `${context}: usage error messages are standard-error content (SPEC ` +
        `12.0), but stderr is empty`,
    );
  }
}

/**
 * One invocation expected to fail as a plain usage error — the syntax class
 * of SPEC 12.0, or any usage error no condition of 14 codes: exit 2 exactly
 * (H-5); stdout the single 12.7 error document (the caller's argv puts JSON
 * output in effect: `--json` among the arguments, or a JSON-only surface),
 * its finding carrying `code` null, `path` null, and no locations — never
 * a configuration error's stable code and concerned path (SPEC 12.7, 14);
 * and the usage message on standard error (12.0). Returns the run for byte
 * compares across workspaces (`expectSyntaxClassUsageError`).
 */
export async function expectPlainUsageError(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly ArgvValue[],
  context: string,
): Promise<RunResult> {
  const result = await expectExit(product, workspace, argv, 2, context);
  const error = expectErrorDocument(result, context);
  assertSameJson(
    { code: error.code, path: error.path, locations: error.locations },
    { code: null, path: null, locations: [] },
    `${context}: the reported error must be the plain usage error — ` +
      `\`code\` null, \`path\` null, no locations (SPEC 12.7, 14) — never ` +
      `a configuration error's stable code and concerned path (message: ` +
      `${JSON.stringify(error.message)})`,
  );
  if (result.stderrBytes.length === 0) {
    fail(
      `${context}: usage error messages are standard-error content (SPEC ` +
        `12.0), but stderr is empty`,
    );
  }
  return result;
}

/**
 * A configuration whose one defect is an unknown top-level key: every
 * command but `version` that loads it reports 14.14 (`configuration-error`,
 * SPEC 7, 14.14), so an invocation answering the plain usage error on a
 * workspace holding it demonstrably never loaded the configuration (12.0).
 */
export const UNKNOWN_KEY_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  bogus: true
})
`;

/**
 * The two configuration states under which a syntax-class usage error must
 * be reported exactly as on the configured workspace under test (SPEC 12.0:
 * an error the invocation's arguments alone determine is reported without
 * loading configuration — T12.0-10's discipline): a workspace whose
 * `xspec.config.ts` is invalid (`UNKNOWN_KEY_CONFIG`) and one holding
 * none. Both hold the caller's file set, so whatever the invocation would
 * consult next — discovery, a named file — is present in each and only the
 * configuration state differs.
 */
export interface ConfigurationStateTwins {
  readonly invalid: TestWorkspace;
  readonly missing: TestWorkspace;
  dispose(): Promise<void>;
}

/** Stage the twins from one file set, which stages no configuration. */
export async function stageConfigurationStateTwins(
  files: Readonly<Record<string, string>>,
): Promise<ConfigurationStateTwins> {
  if ("xspec.config.ts" in files) {
    throw new Error(
      "stageConfigurationStateTwins: the file set must not stage " +
        "xspec.config.ts — the twins stage their own configuration states",
    );
  }
  const invalid = await TestWorkspace.create({
    files: { "xspec.config.ts": UNKNOWN_KEY_CONFIG, ...files },
  });
  let missing: TestWorkspace;
  try {
    missing = await TestWorkspace.create({ files });
  } catch (error) {
    await invalid.dispose();
    throw error;
  }
  return {
    invalid,
    missing,
    dispose: async () => {
      await missing.dispose();
      await invalid.dispose();
    },
  };
}

/**
 * The T12.0-10 discipline for one syntax-class usage error (SPEC 12.0): the
 * invocation answers the plain usage error on `workspace` — the workspace
 * under test, whatever its configuration and findings — and again on each
 * configuration-state twin, each twin's error document byte-identical to
 * the workspace's (the document depends on the invocation's syntax alone,
 * never on configuration state; H-4's product-to-itself compare) and each
 * twin's tree unchanged around the run. A product that loads configuration
 * before judging the value answers 14.14 on the twins and fails at the
 * plain-error pin. Returns the workspace's run.
 */
export async function expectSyntaxClassUsageError(
  product: ProductBinding,
  workspace: TestWorkspace,
  twins: ConfigurationStateTwins,
  argv: readonly ArgvValue[],
  context: string,
): Promise<RunResult> {
  const reference = await expectPlainUsageError(
    product,
    workspace,
    argv,
    `${context} — a malformed value is a usage error of the syntax class: ` +
      `exit 2 with the plain usage error's document (SPEC 12.0, 12.7)`,
  );
  for (const [state, twin] of [
    ["invalid", twins.invalid],
    ["missing", twins.missing],
  ] as const) {
    const run = await assertLeavesUnchanged(
      twin.root,
      () =>
        expectPlainUsageError(
          product,
          twin,
          argv,
          `${context} (configuration file ${state}) — an error the ` +
            `arguments alone determine is reported without loading ` +
            `configuration: the plain usage error, never 14.14 (SPEC 12.0)`,
        ),
      `${context} (configuration file ${state}) — a syntax-class usage ` +
        `error modifies nothing (SPEC 12.0)`,
    );
    assertBytesEqual(
      run.stdoutBytes,
      reference.stdoutBytes,
      `${context} (configuration file ${state}): reported identically, ` +
        `byte for byte, to the configured workspace's answer — the error ` +
        `document depends on the invocation's syntax alone, never on ` +
        `configuration state (SPEC 12.0; H-4's product-to-itself compare)`,
    );
  }
  return reference;
}
