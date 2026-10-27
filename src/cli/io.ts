// CLI I/O surface types.
//
// IMPLEMENTATION (Architecture): the CLI entry point is a function
// `(argv, cwd, stdout, stderr) → exit code` (cli/reruns.ts); the bin is a
// trivial wrapper around it. Handlers receive the streams and working
// directory through `CommandContext`, never `process` globals, so every
// invocation path — the executable, a rerun on a worker thread's larger
// stack (cli/reruns.ts), and any in-process caller — shares one code path.

/**
 * Minimal writable surface of `process.stdout`/`process.stderr`. Strings are
 * encoded as UTF-8 by Node's streams, so identical report text yields
 * identical bytes (SPEC 12.0 byte-determinism).
 */
export interface CliWriter {
  /**
   * Write `chunk`; `callback`, when given, runs once the stream has taken
   * it — with the error when it could not — the backpressure a chunked
   * document's emission waits on (commands/common.ts
   * `emitDocumentStreamed`).
   */
  write(chunk: string, callback?: (error?: Error | null) => void): unknown;
}

import type { LoadedWorkspace } from "../workspace/config.js";

/**
 * The two output streams of one invocation (SPEC 12.0): the report goes to
 * standard output, diagnostics to standard error. Exit-2 emitters take this
 * pair — the stderr diagnostic always, and with JSON output in effect the
 * 12.7 error document as the entire standard output. `CommandContext`
 * satisfies it structurally.
 */
export interface CommandIo {
  readonly stdout: CliWriter;
  readonly stderr: CliWriter;
}

/** Per-invocation context handed to command handlers. */
export interface CommandContext {
  /**
   * The invocation's working directory. `--config <path>` and
   * `--test-hold <path>` are filesystem paths resolved against it, while
   * node/graph-node/file/glob arguments are workspace-relative and
   * independent of it (SPEC 12.0). `null` for a working directory with no
   * path, one removed before the process started (cli/bin.ts): a relative
   * path resolved against it designates nothing (SPEC 12.0, 13.5).
   */
  readonly cwd: string | null;
  /**
   * The loaded workspace: root directory and validated configuration.
   * Every command loads it before running — a missing or invalid
   * configuration exits 2 before any handler is reached (SPEC 7, 14.14).
   */
  readonly workspace: LoadedWorkspace;
  /** SPEC 12.0: the report — findings included — is standard-output content. */
  readonly stdout: CliWriter;
  /**
   * SPEC 12.0: usage and configuration error messages (exit 2) and all other
   * diagnostic text are standard-error content.
   */
  readonly stderr: CliWriter;
}
