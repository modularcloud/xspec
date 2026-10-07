// Blackbox subprocess driver for the xspec test harness (TEST-SPEC H-2, H-5,
// H-8, S-3; IMPLEMENTATION.md: CLI invocation is always as an executable run
// in a subprocess). Harness machinery only: this module never imports product
// code — a product is driven strictly as an executable.
//
// - A `ProductBinding` names the executable to drive. Product-facing tests
//   default to the built product (`builtProductBinding()`); the certification
//   runner substitutes a CERTIFICATIONS.md fixture executable through the
//   same binding shape, so certifying and testing use one code path (C-2) and
//   no test hard-codes the product path.
// - Every invocation controls the working directory (required and absolute:
//   each test runs the product inside its own workspace, H-1/H-2), argv
//   (passed verbatim to the process, no shell interpretation; raw-byte
//   elements for non-UTF-8 arguments ride a POSIX trampoline — see
//   `ArgvValue` and `resolveInvocation`), and the environment; it observes
//   the exact exit code and stdout/stderr as separated byte streams (H-5).
//   stdin is closed — SPEC.md commands are argv-driven.
// - Robustness (H-8): a hanging child is killed and converted into a
//   diagnosed timeout failure (never a skip, never a harness hang); a missing
//   executable or working directory is a diagnosed per-test failure, not a
//   harness crash; runaway output is capped and killed, surfacing as a loud
//   `ProductRunOutputOverflowError` — an exhausted capture limit is a
//   harness error, never a silent truncation (H-11) — and a failure of the
//   driver's own in-run evaluation of an answer (T6.5-22(a)'s check and
//   T12.7-1's walk, below) surfaces as the harness error
//   `HarnessEvaluationError` (H-11). Every
//   helper that converts a run's rejection into a diagnosed failure lets
//   both through unchanged (`rethrowHarnessError`), the driver's own
//   `waitForFile` included.
// - 13.5 support: background start (`startProduct`), hold-file choreography
//   (`createHoldFile` / `RunningProduct.waitForFile` / `releaseHoldFile`),
//   process kill, and concurrent invocations (every run is independent).
// - Environment policy (conservative choice): the child inherits the ambient
//   environment minus variables that would let the machine leak into
//   fixture-observable behavior — `GIT_*` and `EMAIL` (the product shells out
//   to the system git for baseline reads; ambient git control variables would
//   redirect or reconfigure those reads) and `NODE_OPTIONS` / `NODE_DEBUG` /
//   `NODE_V8_COVERAGE` / `FORCE_COLOR` / `CLICOLOR_FORCE` (they inject flags,
//   stderr noise, coverage writes, or colored bytes into the child). Git
//   config isolation is pinned (`GIT_CONFIG_NOSYSTEM=1`,
//   `GIT_CONFIG_GLOBAL=<devnull>`, `GIT_TERMINAL_PROMPT=0`) so machine-local
//   git configuration never alters product behavior and git can never prompt
//   (a prompt would be a hang). All of it is overridable: the binding's env
//   merges over the sanitized base, the invocation's env merges last
//   (`undefined` removes a variable) — tests that vary the environment
//   deliberately (T12.0-7) set it explicitly.
// - Undeclared-staging guard (S-9, H-8): right before spawning, every
//   invocation is noted with its working directory
//   (helpers/product-invocations.ts), marking the live workspace it runs in
//   and the registered test body running it — after which the workspace
//   builder refuses a plain `.mdx` staging that is not a staged-source
//   record (helpers/workspace.ts). This is the one path every invocation
//   takes, so the mark cannot be bypassed.
// - T6.5-22(a)'s universal assertion (helpers/added-import-identifiers.ts):
//   an invocation whose argv reads as a performed `move` has its
//   pre-operation sources read before it spawns, and once it exits 0 the
//   identifiers of every import declaration it added are judged before
//   `waitForExit` resolves — a breach rejects it with a diagnosed failure
//   (`HarnessAssertionError`) — so the assertion holds whichever test
//   performs the operation. The check is the harness evaluating the run's
//   answer with its own parsers and S-6's name analysis, so anything else
//   it throws — a crash of those parsers or of the analysis, an exhausted
//   internal limit — is a defect in the harness (H-11), never a diagnosed
//   product failure and never a pass: the driver wraps it in
//   `HarnessEvaluationError` (its `cause` the original), with which
//   `startProduct` rejects when the pre-operation reading fails and
//   `waitForExit` (so `runProduct` and `waitForFile`) when the judgement
//   does. The module loads only for an argv holding the token `move`.
// - T12.7-1's marker walk over every JSON document the suite captures
//   (helpers/capture-walk.ts; SPEC 12.7: no object of any form other than
//   `{"unavailable": true}` carries a member named `unavailable`): an
//   invocation with JSON output in effect — its argv read by SPEC 12.0's
//   grammar (helpers/invocation-grammar.ts `jsonOutputInEffect`: a
//   `--json` token read as a flag, or a JSON-only surface) — has its
//   captured stdout walked once it has exited and before `waitForExit`
//   resolves, whatever its exit code and however it ended (a run killed by
//   request included), whenever that stdout is one JSON document as
//   `parseJsonStdout` reads one. A near-marker rejects the run with the
//   walk's diagnosed failure (`HarnessAssertionError`, naming the JSON path
//   and the command line), so the clause holds over the documents a test
//   only byte-compares, checks the exit code of, or never reads — whichever
//   test, property, certification run, or self-test performs the run. The
//   walk is the harness evaluating the answer, so anything else it throws
//   is the harness error `HarnessEvaluationError` (stage `walk`, H-11). It
//   runs before T6.5-22(a)'s judgement. Runs without JSON output in effect
//   — human-readable reports, a preview without `--json`, consumer
//   programs and stand-ins under such an argv — are never walked; a run the
//   hang guard or the capture limit killed rejects with that error, never
//   walked. Product tests still parse with `parseJsonStdout`, which walks
//   the document it returns again (S-5's synthetic results never pass
//   through the driver); S-3 guards this integration, and S-8's capture
//   gate drives its largest document through it.

import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import type { AddedImportCheck } from "./added-import-identifiers.js";
import { HarnessAssertionError } from "./assertions.js";
import { walkCapturedJsonDocument } from "./capture-walk.js";
import { jsonOutputInEffect } from "./invocation-grammar.js";
import { noteProductInvocation } from "./product-invocations.js";

/** Hang guard applied to every invocation unless overridden (H-8). */
export const DEFAULT_TIMEOUT_MS = 30_000;
/**
 * Runaway-output guard: combined stdout+stderr cap per invocation. H-11
 * dimensions it to the largest answer SPEC.md permits a conforming product
 * over the inputs the suite stages — S-8 (test/self/s8-answer-scale-
 * capacity.test.ts) derives that scale from the suite's own generators
 * (about 204 MB: `view --text` over two depth-4096 section towers whose
 * line feeds a P-8 rewrite turned into U+2028 separators, every level's
 * subtree text re-emitting the levels below, spelled JSON-escaped) and gates
 * this constant at no less than twice it. Memory is committed only as output
 * arrives, so the cap costs ordinary runs nothing; exceeding it is a loud
 * `ProductRunOutputOverflowError`, never a silent truncation.
 */
export const DEFAULT_MAX_OUTPUT_BYTES = 512 * 1024 * 1024;
/** Default bound on hold-file waits (H-8: waits always terminate). */
export const DEFAULT_WAIT_FOR_FILE_TIMEOUT_MS = 10_000;

/**
 * How to invoke a product — the built `xspec` or a CERTIFICATIONS.md fixture
 * product. The binding is the only product-specific datum a test body sees
 * (C-2: an executable binding and nothing else).
 */
export interface ProductBinding {
  /** Human label used in failure diagnoses. */
  readonly label: string;
  /** Executable to spawn: an absolute path, or a name resolved via PATH. */
  readonly command: string;
  /**
   * Arguments prepended before each invocation's argv — e.g. the script path
   * when `command` is the Node binary.
   */
  readonly prefixArgs?: readonly string[];
  /** Environment pinned for every invocation of this binding. */
  readonly env?: Readonly<Record<string, string>>;
  /**
   * Files that must exist for the binding to be invocable, checked before
   * each run: a missing build artifact fails the test with a diagnosis
   * instead of a confusing spawn error (H-8).
   */
  readonly requiredFiles?: readonly string[];
}

/**
 * A run killed by the hang guard: the child did not terminate within its
 * timeout (H-8: hangs are failures, never skips or harness hangs). Typed so a
 * test whose *assertion* is termination (P-8 "every command terminates") can
 * convert exactly this outcome into a diagnosed assertion failure while every
 * other rejection stays a harness error.
 */
export class ProductRunTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductRunTimeoutError";
  }
}

/**
 * A run killed by the runaway-output guard (H-8: runaway output never hangs
 * the harness): combined stdout+stderr exceeded the invocation's byte cap.
 * The cap is the harness's capture limit, dimensioned to the suite's staged
 * answer scale (`DEFAULT_MAX_OUTPUT_BYTES`), so exhausting it is a loud
 * harness error — never a silent truncation, which is indistinguishable
 * from a partial document, and never a diagnosed product failure (H-11).
 * Typed so S-8 can pin that an exhausted cap fails loudly, so the
 * termination properties (P-8, P-11), which convert exactly the hang-guard
 * kill ({@link ProductRunTimeoutError}) into a diagnosed failure, tell the
 * two kills apart, and so every other helper converting a run's rejection
 * lets this one through ({@link rethrowHarnessError}, which lets
 * {@link HarnessEvaluationError} through as well).
 */
export class ProductRunOutputOverflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductRunOutputOverflowError";
  }
}

/**
 * Where the driver's in-run evaluation failed (see
 * {@link HarnessEvaluationError}): T6.5-22(a)'s check before the spawn
 * (`"prepare"`) or judging the exited run (`"verify"`), or T12.7-1's walk
 * over the exited run's captured stdout (`"walk"`).
 */
export type EvaluationStage = "prepare" | "verify" | "walk";

/**
 * A harness-side failure of the driver's in-run evaluation of an answer
 * (H-11), which threw something other than the evaluation's breach — a
 * `HarnessAssertionError`, the diagnosed product failure, which passes
 * through unchanged. T6.5-22(a)'s check of a performed move (module
 * header) fails either while reading the pre-operation sources before the
 * spawn (`"prepare"`: `startProduct` rejects with it, nothing spawned) or
 * while judging the run once it exited (`"verify"`: `waitForExit`, and so
 * `runProduct` and `waitForFile`, reject with it); T12.7-1's marker walk
 * over the captured stdout of a run with JSON output in effect (module
 * header) fails once the run exited (`"walk"`: `waitForExit` rejects with
 * it, as for `"verify"`). A crash of the harness's own TypeScript, MDX, or
 * JSON reading or of S-6's name analysis, an internal limit exhausted: a
 * defect in the harness, never a diagnosed product failure and never a
 * pass. The original error is its `cause`. Typed so every helper converting
 * a run's rejection into a diagnosed failure lets it through
 * ({@link rethrowHarnessError}).
 */
export class HarnessEvaluationError extends Error {
  /** The invocation whose evaluation failed. */
  readonly commandLine: string;
  /** Which evaluation failed, and where ({@link EvaluationStage}). */
  readonly stage: EvaluationStage;

  constructor(commandLine: string, stage: EvaluationStage, cause: unknown) {
    const what =
      stage === "walk"
        ? `T12.7-1's marker walk over the stdout ${commandLine} wrote failed`
        : `T6.5-22(a)'s check of ${commandLine} failed ` +
          (stage === "prepare"
            ? "reading the pre-operation sources before the spawn"
            : "judging the run once it exited");
    super(
      `harness error (H-11): ${what} — a defect in the harness, never a ` +
        `diagnosed product failure and never a pass: ${describeCause(cause)}`,
      { cause },
    );
    this.name = "HarnessEvaluationError";
    this.commandLine = commandLine;
    this.stage = stage;
  }
}

/**
 * H-11 at a conversion of a driver rejection: rethrow `error` unchanged when
 * it is a harness error — the capture limit killed the run
 * ({@link ProductRunOutputOverflowError}), or the driver's in-run
 * evaluation of the answer failed ({@link HarnessEvaluationError}) — and
 * return otherwise. A helper that turns a rejected run — the hang-guard
 * kill, a premature exit, a spawn failure, a T6.5-22(a) breach, a T12.7-1
 * near-marker — into a diagnosed failure (H-8) calls it first, so a
 * harness-side failure always surfaces as the harness error it is, never as
 * a diagnosed product failure.
 */
export function rethrowHarnessError(error: unknown): void {
  if (
    error instanceof ProductRunOutputOverflowError ||
    error instanceof HarnessEvaluationError
  ) {
    throw error;
  }
}

/**
 * What the driver's in-run evaluation — T6.5-22(a)'s check, T12.7-1's walk
 * — threw, as the driver reports it: a breach (`HarnessAssertionError`)
 * unchanged, anything else a {@link HarnessEvaluationError} wrapping it.
 */
function evaluationFailure(
  error: unknown,
  commandLine: string,
  stage: EvaluationStage,
): unknown {
  return error instanceof HarnessAssertionError
    ? error
    : new HarnessEvaluationError(commandLine, stage, error);
}

function describeCause(cause: unknown): string {
  return cause instanceof Error
    ? `${cause.name}: ${cause.message}`
    : String(cause);
}

const repoRoot = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));

/**
 * The default binding: the built product executable (`dist/cli/bin.js`, see
 * AGENTS.md), resolved relative to this module — never to the process cwd.
 */
export function builtProductBinding(): ProductBinding {
  const binJs = path.join(repoRoot, "dist", "cli", "bin.js");
  return {
    label: "built xspec product",
    command: process.execPath,
    prefixArgs: [binJs],
    requiredFiles: [binJs],
  };
}

/**
 * One argv element. Strings are passed to the child as their UTF-8 bytes; a
 * `Uint8Array` declares the element as raw bytes — Linux-leg staging for
 * arguments that are not valid UTF-8 (SPEC.md 6.5 destination paths, 12.0
 * non-UTF-8 argv; TEST-SPEC T6.5-4, T12.0-5). Byte elements are POSIX-only
 * and must not contain NUL (argv strings cannot); see `resolveInvocation`.
 */
export type ArgvValue = string | Uint8Array;

export interface RunOptions {
  /** Per-test working directory — required and absolute (H-1, H-2). */
  readonly cwd: string;
  /** Arguments after the binding's prefix, passed verbatim (no shell). */
  readonly argv?: readonly ArgvValue[];
  /**
   * Merged last, over the sanitized base and the binding's env; a value of
   * `undefined` removes the variable from the child's environment.
   */
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** Hang guard: the child is killed and the run fails diagnosed (H-8). */
  readonly timeoutMs?: number;
  /** Runaway-output guard (combined stdout+stderr bytes). */
  readonly maxOutputBytes?: number;
}

/**
 * The driver's two guards — the hang guard and the capture limit — as a
 * helper that runs a command for registered bodies takes them, each
 * defaulting to that helper's own bound. Registered bodies never pass them;
 * S-8 lowers them against stand-ins to pin which kill such a helper turns
 * into a diagnosed failure (the hang guard's) and which propagates as a
 * harness error (the capture limit's, H-11).
 */
export type RunGuards = Pick<RunOptions, "timeoutMs" | "maxOutputBytes">;

export interface RunResult {
  /** Exit code, or null when the process died by signal. */
  readonly exitCode: number | null;
  /** Terminating signal, or null on normal exit. */
  readonly signal: NodeJS.Signals | null;
  /** stdout decoded as UTF-8 (assert bytes via `stdoutBytes` where exactness matters). */
  readonly stdout: string;
  /** stderr decoded as UTF-8. */
  readonly stderr: string;
  /** stdout exactly as emitted (H-4/H-5 byte assertions, determinism compares). */
  readonly stdoutBytes: Uint8Array;
  /** stderr exactly as emitted. */
  readonly stderrBytes: Uint8Array;
  /** Diagnostic description of the invocation (command, argv, cwd). */
  readonly commandLine: string;
}

/**
 * Start an invocation in the background (13.5 choreography: the caller
 * coordinates via hold files, kills, or concurrent invocations, then awaits
 * `waitForExit`). Pre-flight problems — relative/missing working directory,
 * missing required files — throw diagnosed errors before anything is spawned.
 * A failure of T6.5-22(a)'s pre-operation reading rejects with the harness
 * error {@link HarnessEvaluationError} (H-11), nothing spawned.
 */
export async function startProduct(
  binding: ProductBinding,
  options: RunOptions,
): Promise<RunningProduct> {
  const fullArgs: readonly ArgvValue[] = [
    ...(binding.prefixArgs ?? []),
    ...(options.argv ?? []),
  ];
  const commandLine = describeCommand(binding, fullArgs, options.cwd);

  if (!path.isAbsolute(options.cwd)) {
    throw new Error(
      `per-test working directory must be an absolute path (H-1/H-2), got ${JSON.stringify(options.cwd)} for ${commandLine}`,
    );
  }
  const cwdStats = await fsp.stat(options.cwd).catch(() => undefined);
  if (!cwdStats) {
    throw new Error(
      `working directory does not exist: ${options.cwd} — every invocation runs inside a test-owned workspace (H-1); command: ${commandLine}`,
    );
  }
  if (!cwdStats.isDirectory()) {
    throw new Error(
      `working directory is not a directory: ${options.cwd}; command: ${commandLine}`,
    );
  }
  for (const required of binding.requiredFiles ?? []) {
    if (!(await pathExists(required))) {
      throw new Error(
        `${binding.label}: required file missing: ${required}. The harness drives the product strictly as a subprocess (TEST-SPEC H-2); if this is the built product, run \`npm run build\` first (AGENTS.md). H-8: a missing executable is a diagnosed per-test failure — the harness itself keeps running.`,
      );
    }
  }

  const invocation = resolveInvocation(binding.command, fullArgs, commandLine);
  // T6.5-22(a) (module header): a performed move's pre-operation sources,
  // read before anything is spawned.
  const addedImportCheck = await prepareAddedImportCheck(
    options.cwd,
    options.argv ?? [],
    commandLine,
  );
  // The undeclared-staging guard's mark (helpers/product-invocations.ts,
  // module header): from here on, a plain `.mdx` staging in this workspace
  // — or anywhere in the registered body running this — is one S-7's sweep
  // never reaches.
  noteProductInvocation(
    options.cwd,
    await fsp.realpath(options.cwd).catch(() => options.cwd),
  );
  const child = spawn(invocation.command, invocation.args, {
    cwd: options.cwd,
    env: childEnvironment(binding, options),
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  return new RunningProduct(
    child,
    commandLine,
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES,
    addedImportCheck,
    // T12.7-1 (module header): the run's captured stdout is walked exactly
    // when its argv puts JSON output in effect (SPEC 12.0).
    jsonOutputInEffect(options.argv ?? []),
  );
}

/**
 * T6.5-22(a)'s check for an invocation (helpers/added-import-identifiers.ts),
 * or undefined when its argv cannot read as a performed move — the module,
 * which loads the harness's TypeScript and MDX parsers, is loaded only for
 * an argv holding the token `move`. Anything it throws but a
 * `HarnessAssertionError` rejects as {@link HarnessEvaluationError} (H-11).
 */
async function prepareAddedImportCheck(
  cwd: string,
  argv: readonly ArgvValue[],
  commandLine: string,
): Promise<AddedImportCheck | undefined> {
  if (!argv.includes("move")) return undefined;
  try {
    const { prepareAddedImportCheck: prepare } =
      await import("./added-import-identifiers.js");
    return await prepare(cwd, argv, commandLine);
  } catch (error) {
    throw evaluationFailure(error, commandLine, "prepare");
  }
}

/** Run an invocation to completion — the common foreground path. */
export async function runProduct(
  binding: ProductBinding,
  options: RunOptions,
): Promise<RunResult> {
  const running = await startProduct(binding, options);
  return await running.waitForExit();
}

/**
 * A started invocation. `waitForExit` resolves with the run result (normal
 * exits and requested kills alike) and rejects, diagnosed, on timeout,
 * spawn failure, a near-marker in the captured stdout of a run with JSON
 * output in effect (T12.7-1), or a performed move's breach of T6.5-22(a) —
 * and with a harness error (H-11): `ProductRunOutputOverflowError` on
 * output overflow, `HarnessEvaluationError` when T12.7-1's walk or
 * T6.5-22(a)'s check itself fails.
 */
export class RunningProduct {
  readonly commandLine: string;

  readonly #child: ChildProcess;
  readonly #exit: Promise<RunResult>;
  #settled = false;
  /** The capture limit killed the child (its exit may not be seen yet). */
  #overflowed = false;

  /** @internal — obtain instances via `startProduct`. */
  constructor(
    child: ChildProcess,
    commandLine: string,
    timeoutMs: number,
    maxOutputBytes: number,
    addedImportCheck?: AddedImportCheck,
    walkCapturedJson = false,
  ) {
    this.#child = child;
    this.commandLine = commandLine;

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let totalBytes = 0;
    let timedOut = false;

    const capture = (sink: Buffer[]) => (chunk: Buffer) => {
      sink.push(chunk);
      totalBytes += chunk.length;
      if (totalBytes > maxOutputBytes && !this.#overflowed) {
        this.#overflowed = true;
        child.kill("SIGKILL");
      }
    };
    child.stdout?.on("data", capture(stdoutChunks));
    child.stderr?.on("data", capture(stderrChunks));

    const timer = setTimeout(() => {
      // The capture limit's kill came first: the run settles as that
      // harness error (H-11), never relabelled a hang.
      if (this.#overflowed) return;
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    const exit = new Promise<RunResult>((resolve, reject) => {
      let done = false;
      const settle = (complete: () => void): void => {
        if (done) return;
        done = true;
        this.#settled = true;
        clearTimeout(timer);
        complete();
      };
      child.once("error", (error) => {
        settle(() =>
          reject(
            new Error(
              `failed to start ${commandLine}: ${error.message} — is the executable present and invocable? H-8: a missing executable is a diagnosed per-test failure, not a harness crash.`,
            ),
          ),
        );
      });
      child.once("close", (exitCode, signal) => {
        settle(() => {
          if (timedOut) {
            reject(
              new ProductRunTimeoutError(
                `${commandLine} timed out after ${timeoutMs} ms and was killed (H-8: hangs are failures, never skips). Partial stdout: ${excerpt(Buffer.concat(stdoutChunks))}; partial stderr: ${excerpt(Buffer.concat(stderrChunks))}`,
              ),
            );
            return;
          }
          if (this.#overflowed) {
            reject(
              new ProductRunOutputOverflowError(
                `${commandLine} exceeded the output limit of ${maxOutputBytes} bytes and was killed: an exhausted capture limit is a harness error, never a silent truncation (H-11).`,
              ),
            );
            return;
          }
          const stdoutBytes = Buffer.concat(stdoutChunks);
          const stderrBytes = Buffer.concat(stderrChunks);
          resolve({
            exitCode,
            signal,
            stdout: stdoutBytes.toString("utf8"),
            stderr: stderrBytes.toString("utf8"),
            stdoutBytes,
            stderrBytes,
            commandLine,
          });
        });
      });
    });
    // T12.7-1: the marker walk over the captured stdout of a run with JSON
    // output in effect, once it has exited — however it ended — and before
    // any awaiter sees the result (module header); a near-marker rejects
    // with the walk's diagnosed failure, a failure of the walk itself with
    // the harness error `HarnessEvaluationError` (H-11).
    const walked = walkCapturedJson
      ? exit.then((result) => {
          try {
            walkCapturedJsonDocument(result);
          } catch (error) {
            throw evaluationFailure(error, commandLine, "walk");
          }
          return result;
        })
      : exit;
    // T6.5-22(a): a performed move's added imports, judged once it exits 0
    // and before any awaiter sees the result (helpers/subprocess.ts header);
    // a failure of the judgement itself is the harness error
    // `HarnessEvaluationError` (H-11), a breach passing through unchanged.
    this.#exit =
      addedImportCheck === undefined
        ? walked
        : walked.then(async (result) => {
            try {
              await addedImportCheck.verify(result);
            } catch (error) {
              throw evaluationFailure(error, commandLine, "verify");
            }
            return result;
          });
    // Mark rejections as observed even when a test aborts before awaiting;
    // awaiters of waitForExit() still receive the original rejection.
    this.#exit.catch(() => {});
  }

  get pid(): number | undefined {
    return this.#child.pid;
  }

  /** True once the process has exited (or failed to spawn). */
  hasExited(): boolean {
    return this.#settled;
  }

  /** Terminate the process (T13.5-3/7 kill choreography). Idempotent. */
  kill(signal: NodeJS.Signals = "SIGKILL"): void {
    this.#child.kill(signal);
  }

  /**
   * The run's outcome. Resolves for normal exits and requested kills; rejects
   * with a diagnosed error on timeout or spawn failure, with the harness
   * error `ProductRunOutputOverflowError` on output overflow (H-11), with a
   * diagnosed assertion failure when the captured stdout of a run with JSON
   * output in effect carries a near-marker (T12.7-1's walk) or a performed
   * move exiting 0 added an import T6.5-22(a) rejects, and with the harness
   * error `HarnessEvaluationError` when that walk or that check itself
   * fails (H-11). Callable any number of times.
   */
  async waitForExit(): Promise<RunResult> {
    return await this.#exit;
  }

  /**
   * Poll until a file appears at `absPath` — the hold-file handshake of
   * SPEC.md 13.5 (`--test-hold`). Fails diagnosed, never hangs (H-8): rejects
   * when the process exits first without creating it (the red-green path for
   * stub products, carrying the run outcome), and on timeout while the
   * process is still running. A run the capture limit killed, or whose
   * T12.7-1 walk or T6.5-22(a) check failed, rejects with that
   * `ProductRunOutputOverflowError` or `HarnessEvaluationError` itself,
   * never folded into the premature-exit error: both are harness errors
   * (H-11).
   */
  async waitForFile(
    absPath: string,
    options: {
      readonly timeoutMs?: number;
      readonly pollIntervalMs?: number;
    } = {},
  ): Promise<void> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_WAIT_FOR_FILE_TIMEOUT_MS;
    const pollIntervalMs = options.pollIntervalMs ?? 10;
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      if (await pathExists(absPath)) return;
      // A capture-limit kill counts as the exit at once: the run settles
      // with that error, which propagates as itself (H-11) — as does a
      // failure of T12.7-1's walk or T6.5-22(a)'s check, settled once the
      // run has exited.
      if (this.hasExited() || this.#overflowed) {
        const outcome = await this.#exit.then(
          summarizeResult,
          (error: unknown) => {
            rethrowHarnessError(error);
            return error instanceof Error ? error.message : String(error);
          },
        );
        throw new Error(
          `${this.commandLine} exited before creating ${absPath} — ${outcome}`,
        );
      }
      if (Date.now() >= deadline) {
        throw new Error(
          `timed out after ${timeoutMs} ms waiting for ${absPath} to appear; child still running: ${this.commandLine}`,
        );
      }
      await sleep(pollIntervalMs);
    }
  }
}

/**
 * Stage an empty hold file (e.g. T13.5-1's occupied-path arm). Refuses an
 * occupied path loudly — staging over an existing entry is a test bug.
 */
export async function createHoldFile(absPath: string): Promise<void> {
  await fsp.writeFile(absPath, "", { flag: "wx" });
}

/** Release a hold: delete the file at the path. Idempotent. */
export async function releaseHoldFile(absPath: string): Promise<void> {
  await fsp.rm(absPath, { force: true });
}

/**
 * Whether anything (file, directory, or symlink) occupies the path: a path
 * string, or its exact bytes (a name that need not be valid UTF-8).
 */
export async function pathExists(absPath: string | Buffer): Promise<boolean> {
  try {
    await fsp.lstat(absPath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

/** One-line outcome description for failure diagnoses. */
export function summarizeResult(result: RunResult): string {
  const death =
    result.signal !== null
      ? `killed by signal ${result.signal}`
      : `exit code ${String(result.exitCode)}`;
  return `${death}; stdout: ${excerpt(Buffer.from(result.stdoutBytes))}; stderr: ${excerpt(Buffer.from(result.stderrBytes))}`;
}

const EXCERPT_LIMIT = 2048;

function excerpt(bytes: Buffer): string {
  if (bytes.length === 0) return "<empty>";
  const text = bytes.toString("utf8", 0, Math.min(bytes.length, EXCERPT_LIMIT));
  return bytes.length > EXCERPT_LIMIT
    ? `${text}… (${bytes.length} bytes total)`
    : text;
}

function describeCommand(
  binding: ProductBinding,
  fullArgs: readonly ArgvValue[],
  cwd: string,
): string {
  const rendered = [binding.command, ...fullArgs].map(formatArg).join(" ");
  return `\`${rendered}\` [${binding.label}] (cwd: ${cwd})`;
}

function formatArg(arg: ArgvValue): string {
  if (typeof arg !== "string") {
    return `<argv bytes 0x${Buffer.from(arg).toString("hex")}>`;
  }
  return arg === "" || /[\s"'\\]/.test(arg) ? JSON.stringify(arg) : arg;
}

/**
 * Resolve the actual spawn target for an invocation. An all-string argv
 * spawns the command directly, exactly as before. An argv containing raw
 * bytes (`ArgvValue` as `Uint8Array`) cannot pass through Node's string-only
 * spawn API — any JS string encodes to *valid* UTF-8 — so it is routed
 * through a POSIX `sh` trampoline: every string element travels untouched as
 * a positional parameter (never interpreted), each byte element is
 * reconstructed inside the shell with `printf` octal escapes (an appended
 * sentinel protects trailing newlines from command-substitution stripping),
 * and the target command is `exec`ed with the elements in their original
 * order. The child therefore receives exactly the declared argv bytes, with
 * no shell interpretation of any value (H-2). POSIX-only staging (TEST-SPEC
 * T6.5-4, T12.0-5 gate themselves to the Linux leg); requesting byte argv on
 * Windows, or with a NUL byte (argv strings cannot contain NUL), is a
 * harness-usage error thrown as a plain `Error`.
 */
function resolveInvocation(
  command: string,
  fullArgs: readonly ArgvValue[],
  commandLine: string,
): { command: string; args: string[] } {
  if (fullArgs.every((arg): arg is string => typeof arg === "string")) {
    return { command, args: [...fullArgs] };
  }
  if (process.platform === "win32") {
    throw new Error(
      `byte (Uint8Array) argv elements are POSIX-only staging — Windows has no byte-argv channel; gate the arm to the Linux leg (TEST-SPEC T6.5-4, T12.0-5); command: ${commandLine}`,
    );
  }
  const assignments: string[] = [];
  const positionals: string[] = [command];
  const execRefs: string[] = ['"${1}"'];
  let byteIndex = 0;
  for (const arg of fullArgs) {
    if (typeof arg === "string") {
      positionals.push(arg);
      execRefs.push(`"\${${String(positionals.length)}}"`);
    } else {
      if (arg.includes(0)) {
        throw new Error(
          `byte argv element contains a NUL byte, which no argv string can carry (execve); command: ${commandLine}`,
        );
      }
      const name = `xspec_arg_${String(byteIndex)}`;
      byteIndex += 1;
      assignments.push(
        `${name}=$(printf '${octalEscape(arg)}x')`,
        `${name}=\${${name}%x}`,
      );
      execRefs.push(`"\${${name}}"`);
    }
  }
  const script = [...assignments, `exec ${execRefs.join(" ")}`].join("\n");
  return { command: "/bin/sh", args: ["-c", script, "sh", ...positionals] };
}

/** Every byte as a 3-digit octal `printf` escape (all-ASCII, quote-safe). */
function octalEscape(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) {
    out += `\\${byte.toString(8).padStart(3, "0")}`;
  }
  return out;
}

/** Ambient variables never passed through implicitly (see module header). */
function isDroppedAmbient(name: string): boolean {
  const upper = name.toUpperCase();
  if (upper.startsWith("GIT_")) return true;
  return (
    upper === "EMAIL" ||
    upper === "NODE_OPTIONS" ||
    upper === "NODE_DEBUG" ||
    upper === "NODE_V8_COVERAGE" ||
    upper === "FORCE_COLOR" ||
    upper === "CLICOLOR_FORCE"
  );
}

function childEnvironment(
  binding: ProductBinding,
  options: RunOptions,
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (value === undefined || isDroppedAmbient(name)) continue;
    env[name] = value;
  }
  // Pinned git isolation for the product's own git reads (IMPLEMENTATION.md:
  // system git via read-only plumbing): machine-local configuration must not
  // alter fixture-observable behavior, and git must never prompt.
  env["GIT_CONFIG_NOSYSTEM"] = "1";
  env["GIT_CONFIG_GLOBAL"] = os.devNull;
  env["GIT_TERMINAL_PROMPT"] = "0";
  Object.assign(env, binding.env ?? {});
  for (const [name, value] of Object.entries(options.env ?? {})) {
    if (value === undefined) {
      delete env[name];
    } else {
      env[name] = value;
    }
  }
  return env;
}
