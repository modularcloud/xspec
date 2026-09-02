// Shared staging/assertion sugar for the section registration modules in
// this directory (the product-facing suite, TEST-SPEC sections 1–16). Thin
// composition of already-self-tested harness machinery — the subprocess
// driver (S-3), the assertion protocol (H-4/H-5), and the H-3 adapters — so
// every section module stages and asserts the same way: bodies receive a
// `ProductBinding` and nothing else (C-2), run commands in their own
// workspace root (H-1/H-2), assert exact exit codes (H-5), and reject a
// product only via diagnosed assertion failures (H-8).

import { Buffer } from "node:buffer";
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
  assertExitCode,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import type { ProductBinding, RunResult } from "../../helpers/subprocess.js";
import { runProduct, summarizeResult } from "../../helpers/subprocess.js";
import type { TestWorkspace } from "../../helpers/workspace.js";

/** Run one product command with the workspace root as working directory. */
export async function runCli(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
): Promise<RunResult> {
  return await runProduct(product, { cwd: workspace.root, argv });
}

/** Run a command and assert its exact exit code (H-5). */
export async function expectExit(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
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
 * Run `build --json` over a workspace staged with validation errors: assert
 * exit 1 (findings are exit-1 outcomes, SPEC.md 12.0; H-5) with exactly one
 * JSON document as the entire stdout, decoded as the findings report (H-3).
 */
export async function buildFindings(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
): Promise<readonly Finding[]> {
  const result = await expectExit(
    product,
    workspace,
    ["build", "--json"],
    1,
    context,
  );
  return decodeFindingsReport(parseJsonStdout(result, context), context)
    .findings;
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

/** A concerned identity, named by its containing file and its ID (SPEC.md 1.5). */
export interface ConcernedIdentity {
  /** The workspace-relative file whose `#`-form identity names the concern. */
  readonly file: string;
  /** The concerned ID — possibly one no node bears (a refused new ID). */
  readonly id: string;
}

/**
 * Assert a finding names a concerned identity (SPEC.md 14: a refusal reason's
 * concerned identity is contractual identity data on the finding, 12.7): at
 * least one `identities` entry identifies it — as the full 1.5 identity
 * `<file>#<id>` or as the ID alone, either spelling identifying it
 * unambiguously within the staged fixture (§14 requires identification, not
 * wording). Further informational entries are permitted (12.7).
 */
export function assertFindingNamesIdentity(
  finding: Finding,
  expected: ConcernedIdentity,
  context: string,
): void {
  const full = `${expected.file}#${expected.id}`;
  if (
    finding.identities.some((entry) => entry === full || entry === expected.id)
  ) {
    return;
  }
  fail(
    `${context}: the finding must name the concerned identity ` +
      `${JSON.stringify(full)} (or its ID ${JSON.stringify(expected.id)}) in ` +
      `its identities (SPEC.md 14, 12.7); got ` +
      `${JSON.stringify(finding.identities)} (message: ` +
      `${JSON.stringify(finding.message)})`,
  );
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
 * Assert a successful `rename`/`move`'s applied-mapping report carries
 * exactly the expected identity pairs — every identity pair the operation
 * journaled, no more (SPEC.md 6.4, 6.5: the complete identity mapping, the
 * information of the preview's `mapping`, 6.6; T6.4-1, T6.5-1). The report's
 * shape is unpinned (H-3), so pair order is not asserted: both sides compare
 * as complete sorted multisets (a duplicated or extra pair still fails).
 */
export function assertAppliedMapping(
  actual: readonly AppliedMappingPair[],
  expected: readonly AppliedMappingPair[],
  context: string,
): void {
  const render = (pairs: readonly AppliedMappingPair[]): string[] =>
    pairs.map((pair) => `${pair.from} -> ${pair.to}`).sort();
  assertSameJson(render(actual), render(expected), context);
}
